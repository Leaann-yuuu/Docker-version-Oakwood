<?php

namespace App\Services;

use App\Models\GateLog;
use App\Models\Notification;
use App\Models\SystemStatus;
use App\Models\UpdateRequest;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\Visitor;
use App\Models\VisitorRequest;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class GateService
{
    public static function captureImageUrl(?string $filename): ?string
    {
        if (! $filename) {
            return null;
        }

        if (str_starts_with($filename, 'http://') || str_starts_with($filename, 'https://')) {
            // Rewrite legacy broken storage/public/ path to the dedicated working API endpoint
            if (str_contains($filename, '/storage/public/img/gate/captures/')) {
                $filename = basename($filename);
            } else {
                return $filename;
            }
        }

        $basename = basename($filename);
        $baseUrl = request()?->getSchemeAndHttpHost() ?: rtrim(config('app.url', 'http://127.0.0.1:8080'), '/');

        return $baseUrl . '/api/gate/captures/' . $basename;
    }

    public static function storeCapture(?UploadedFile $file): ?string
    {
        if (! $file) {
            return null;
        }

        $filename = sha1(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME) . '_' . time()) . '.' . $file->getClientOriginalExtension();
        $file->storeAs('public/img/gate/captures', $filename);
        try {
            $file->storeAs('public/img/gate/captures', $filename, 'public');
        } catch (\Throwable) {
        }

        return $filename;
    }

    public static function formatLog(GateLog $log): GateLog
    {
        $log->capture_image = self::captureImageUrl($log->capture_image);

        return $log;
    }

    public static function verifyAccess(?string $plateNumber, ?string $direction, ?UploadedFile $image = null): array
    {
        $resident = null;
        $visitorRequest = null;
        $visitor = null;
        $guestRequest = null;
        $normalizedPlate = null;

        if ($plateNumber) {
            $normalizedPlate = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $plateNumber));
            [
                'resident' => $resident,
                'visitorRequest' => $visitorRequest,
                'visitor' => $visitor,
                'guestRequest' => $guestRequest,
            ] = self::findByPlate($normalizedPlate);
        }

        $direction = self::inferDirection($direction, $resident);

        $authorized = (bool) ($resident || $visitorRequest || $guestRequest);
        $status = $authorized ? 'authorized' : 'unauthorized';
        $captureFile = self::storeCapture($image);
        $guestChanges = $guestRequest?->requested_changes ?? [];

        $matchedDbPlate = $resident?->plate_number
            ?? ($visitor?->vehicle_plate
            ?? ($guestChanges['guest_plate_number'] ?? null));
        $logPlate = $matchedDbPlate
            ? strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $matchedDbPlate))
            : ($normalizedPlate ?: 'UNKNOWN');
        $loggedAt = now();

        $ownerName = null;
        $carModel = null;
        $carColor = null;
        $userId = null;

        if ($resident) {
            $userId = $resident->user_id;
            $ownerName = $resident->owner_name;
            $carModel = $resident->car_model;
            $carColor = $resident->car_color;
        } elseif ($visitorRequest && $visitor) {
            $userId = $visitorRequest->resident_id;
            $ownerName = $visitor->full_name;
            $carModel = $visitor->car_model ?? $visitor->vehicle_type ?? 'Visitor Vehicle';
            $carColor = $visitor->car_color;
        } elseif ($guestRequest) {
            $userId = $guestRequest->user_id;
            $ownerName = $guestChanges['guest_name'] ?? null;
            $carModel = $guestChanges['guest_car_model'] ?? null;
            $carColor = $guestChanges['guest_car_color'] ?? null;
        }

        $log = GateLog::create([
            'user_id' => $userId,
            'plate_number' => $logPlate,
            'owner_name' => $ownerName,
            'car_model' => $carModel,
            'car_color' => $carColor,
            'direction' => strtoupper($direction),
            'status' => $status,
            'capture_image' => $captureFile,
            'logged_at' => $loggedAt,
        ]);

        ActivityLogService::record(
            $authorized ? (strtoupper($direction) === 'IN' ? 'gate_entry_authorized' : 'gate_exit_authorized') : 'gate_access_unauthorized',
            $ownerName ?? $logPlate,
            $userId,
            request(),
            [
                'plate_number' => $logPlate,
                'direction' => strtoupper($direction),
                'status' => $status,
                'car_model' => $carModel,
                'car_color' => $carColor,
                'logged_at' => $loggedAt->copy()->setTimezone(config('app.timezone', 'Asia/Manila'))->toIso8601String(),
            ]
        );

        $system = SystemStatus::current();
        $statusUpdate = ['sensor_status' => 'online'];
        if ($authorized) {
            $statusUpdate['gate_status'] = 'open';
        }
        $system->update($statusUpdate);

        $displayIdentifier = $logPlate ?: 'UNKNOWN';

        if ($authorized) {
            if ($resident) {
                self::notifyAdmins(
                    'Gate Opened',
                    "Authorized {$direction} entry for {$displayIdentifier} ({$resident->owner_name}).",
                    'gate_open'
                );

                $localTimeStr = now()->setTimezone(config('app.timezone', 'Asia/Manila'))->format('g:i A');

                self::notifyUser(
                    $resident,
                    'Gate Access',
                    'Gate opened at ' . $localTimeStr . " ({$direction}).",
                    'gate_open'
                );
            } elseif ($visitorRequest && $visitor) {
                $hostResident = $visitorRequest->resident;
                $hostName = $hostResident ? $hostResident->owner_name : 'Resident';
                $localTimeStr = now()->setTimezone(config('app.timezone', 'Asia/Manila'))->format('g:i A');

                self::notifyAdmins(
                    'Visitor Gate Opened',
                    "Authorized {$direction} entry for visitor {$visitor->full_name} [{$displayIdentifier}] visiting {$hostName}.",
                    'visitor_access'
                );

                if ($hostResident) {
                    self::notifyUser(
                        $hostResident,
                        'Visitor Gate Access',
                        "Your visitor {$visitor->full_name} [{$displayIdentifier}] passed the gate at " . $localTimeStr . " ({$direction}).",
                        'visitor_access'
                    );
                }
            } elseif ($guestRequest?->resident) {
                $localTimeStr = now()->setTimezone(config('app.timezone', 'Asia/Manila'))->format('g:i A');
                self::notifyAdmins(
                    'Gate Opened',
                    "Authorized {$direction} entry for {$displayIdentifier}.",
                    'gate_open'
                );
                self::notifyUser(
                    $guestRequest->resident,
                    'Guest Gate Access',
                    'Approved guest plate ' . $logPlate . ' passed the gate at ' . $localTimeStr . " ({$direction}).",
                    'gate_open'
                );
            }
        } else {
            self::notifyAdmins(
                'Unauthorized Attempt',
                "Unauthorized {$direction} attempt detected for {$displayIdentifier}.",
                'unauthorized'
            );

            if ($normalizedPlate) {
                $linkedResident = User::where('role', 'resident')
                    ->where('is_deleted', false)
                    ->whereRaw('UPPER(REPLACE(REPLACE(plate_number, " ", ""), "-", "")) = ?', [$normalizedPlate])
                    ->first();

                if ($linkedResident) {
                    self::notifyUser(
                        $linkedResident,
                        'Security Alert',
                        "Unauthorized attempt detected with your plate ({$normalizedPlate}).",
                        'unauthorized'
                    );
                }
            }
        }

        $displayName = $resident?->owner_name
            ?? ($visitor ? ($visitor->full_name . ' (Visitor Pass)') : ($guestChanges['guest_name'] ?? null));

        return [
            'authorized' => $authorized,
            'registered' => $authorized,
            'plate_number' => $logPlate,
            'entry_timestamp' => $loggedAt->copy()->setTimezone(config('app.timezone', 'Asia/Manila'))->format('Y-m-d h:i:s A'),
            'gate_status' => $system->fresh()->gate_status,
            'direction' => strtoupper($direction),
            'gate_action' => strtoupper($direction) === 'IN' ? 'OPEN_ENTRANCE' : 'OPEN_EXIT',
            'gate_command' => strtoupper($direction) === 'IN' ? 'O' : 'X',
            'resident_username' => $resident?->username ?? $visitorRequest?->resident?->username,
            'resident_name' => $displayName,
            'owner_name' => $ownerName,
            'car_model' => $carModel,
            'car_color' => $carColor,
            'is_visitor' => (bool) $visitorRequest,
            'visitor_name' => $visitor?->full_name,
            'log' => self::formatLog($log),
        ];
    }

    public static function checkPlateRegistration(string $plateNumber): array
    {
        $normalizedPlate = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $plateNumber));
        [
            'resident' => $resident,
            'visitorRequest' => $visitorRequest,
            'visitor' => $visitor,
            'guestRequest' => $guestRequest,
        ] = self::findByPlate($normalizedPlate);

        $registered = (bool) ($resident || $visitorRequest || $guestRequest);
        $guestChanges = $guestRequest?->requested_changes ?? [];
        $displayPlate = $resident?->plate_number
            ?? ($visitor?->vehicle_plate
            ?? ($guestChanges['guest_plate_number'] ?? $normalizedPlate));

        $displayName = $resident?->owner_name
            ?? ($visitor ? ($visitor->full_name . ' (Visitor Pass)') : ($guestChanges['guest_name'] ?? null));

        $carModel = $resident?->car_model
            ?? ($visitor ? ($visitor->car_model ?? $visitor->vehicle_type) : ($guestChanges['guest_car_model'] ?? null));

        $carColor = $resident?->car_color
            ?? ($visitor?->car_color ?? ($guestChanges['guest_car_color'] ?? null));

        return [
            'registered' => $registered,
            'plate_number' => $displayPlate,
            'resident_name' => $displayName,
            'car_model' => $carModel,
            'car_color' => $carColor,
            'is_visitor' => (bool) $visitorRequest,
        ];
    }

    /**
     * Returns a dictionary of all currently authorized plates (residents, vehicles, active visitor passes, and today's guest passes)
     * for 0ms local memory lookup in the Python LPR service.
     */
    public static function getAuthorizedPlates(): array
    {
        $plates = [];

        // 1. Registered resident vehicles (tbl_vehicles)
        $vehicles = Vehicle::with('user')
            ->whereHas('user', function ($q) {
                $q->where('is_deleted', false);
            })
            ->get();

        foreach ($vehicles as $vehicle) {
            if (! $vehicle->user || ! $vehicle->plate_number) {
                continue;
            }
            $norm = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $vehicle->plate_number));
            if ($norm === '') {
                continue;
            }
            $plates[$norm] = [
                'registered' => true,
                'plate_number' => $norm,
                'resident_name' => $vehicle->user->owner_name,
                'car_model' => $vehicle->car_model,
                'car_color' => $vehicle->car_color,
                'is_visitor' => false,
                'user_id' => $vehicle->user->user_id,
            ];
        }

        // 2. Fallback resident plates on tbl_users
        $residents = User::where('is_deleted', false)
            ->whereNotNull('plate_number')
            ->where('plate_number', '!=', '')
            ->get();

        foreach ($residents as $resident) {
            $norm = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $resident->plate_number));
            if ($norm === '' || isset($plates[$norm])) {
                continue;
            }
            $plates[$norm] = [
                'registered' => true,
                'plate_number' => $norm,
                'resident_name' => $resident->owner_name,
                'car_model' => $resident->car_model,
                'car_color' => $resident->car_color,
                'is_visitor' => false,
                'user_id' => $resident->user_id,
            ];
        }

        // 3. Active Visitor Passes (tbl_visitor_requests + tbl_visitors) — strictly valid for today's stay window
        $today = now()->toDateString();
        $visitorRequests = self::scopeVisitorRequestActiveForDate(
            VisitorRequest::with('visitor')->whereNotIn('status', ['DENIED', 'REJECTED', 'CANCELLED']),
            $today
        )
            ->orderByDesc('request_id')
            ->get();

        foreach ($visitorRequests as $vr) {
            if (! self::isVisitorPassValidForToday($vr)) {
                continue;
            }
            $visitor = $vr->visitor;
            if (! $visitor || ! $visitor->vehicle_plate) {
                continue;
            }
            $norm = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $visitor->vehicle_plate));
            if ($norm === '' || isset($plates[$norm])) {
                continue;
            }
            $plates[$norm] = [
                'registered' => true,
                'plate_number' => $norm,
                'resident_name' => $visitor->full_name . ' (Visitor Pass)',
                'car_model' => $visitor->car_model ?? $visitor->vehicle_type ?? 'Visitor Vehicle',
                'car_color' => $visitor->car_color,
                'is_visitor' => true,
                'user_id' => $vr->resident_id,
            ];
        }

        // 4. Approved Guest Access Requests for today (tbl_update_requests)
        $guestRequests = UpdateRequest::with('resident')
            ->where('status', 'approved')
            ->whereDate('created_at', '<=', now())
            ->get();

        foreach ($guestRequests as $req) {
            if (! self::isGuestRequestValidForToday($req)) {
                continue;
            }
            $changes = $req->requested_changes ?? [];
            $primaryPlate = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $changes['guest_plate_number'] ?? ''));
            if ($primaryPlate !== '' && ! isset($plates[$primaryPlate])) {
                $plates[$primaryPlate] = [
                    'registered' => true,
                    'plate_number' => $primaryPlate,
                    'resident_name' => $changes['guest_name'] ?? 'Approved Guest',
                    'car_model' => $changes['guest_car_model'] ?? null,
                    'car_color' => $changes['guest_car_color'] ?? null,
                    'is_visitor' => true,
                    'user_id' => $req->user_id,
                ];
            }
            if (! empty($changes['guests']) && is_array($changes['guests'])) {
                foreach ($changes['guests'] as $g) {
                    $gPlate = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $g['plate_number'] ?? $g['guest_plate_number'] ?? ''));
                    if ($gPlate !== '' && ! isset($plates[$gPlate])) {
                        $plates[$gPlate] = [
                            'registered' => true,
                            'plate_number' => $gPlate,
                            'resident_name' => $g['name'] ?? $g['guest_name'] ?? ($changes['guest_name'] ?? 'Approved Guest'),
                            'car_model' => $g['car_model'] ?? $g['guest_car_model'] ?? ($changes['guest_car_model'] ?? null),
                            'car_color' => $g['car_color'] ?? $g['guest_car_color'] ?? ($changes['guest_car_color'] ?? null),
                            'is_visitor' => true,
                            'user_id' => $req->user_id,
                        ];
                    }
                }
            }
        }

        return [
            'count' => count($plates),
            'synced_at' => now()->toIso8601String(),
            'plates' => $plates,
        ];
    }

    public static function resolveCaptureUrl(?string $streamUrl): ?string
    {
        if (! $streamUrl) {
            return null;
        }

        $trimmed = rtrim(trim($streamUrl), '/');
        if (preg_match('/\/stream$/i', $trimmed)) {
            return preg_replace('/\/stream$/i', '/capture', $trimmed);
        }

        return $trimmed . '/capture';
    }

    /**
     * @return array{resident: ?User, visitorRequest: ?VisitorRequest, visitor: ?Visitor, guestRequest: ?UpdateRequest}
     */
    private static function findByPlate(string $normalizedPlate): array
    {
        // 1. Check in registered resident vehicles (tbl_vehicles)
        $vehicle = Vehicle::with('user.gender')
            ->whereHas('user', function ($q) {
                $q->where('is_deleted', false);
            })
            ->whereRaw('UPPER(REPLACE(REPLACE(plate_number, " ", ""), "-", "")) = ?', [$normalizedPlate])
            ->first();

        if ($vehicle && $vehicle->user) {
            $resident = $vehicle->user;
            $resident->plate_number = $vehicle->plate_number;
            $resident->car_model = $vehicle->car_model;
            $resident->car_color = $vehicle->car_color;
            return [
                'resident' => $resident,
                'visitorRequest' => null,
                'visitor' => null,
                'guestRequest' => null,
            ];
        }

        // 2. Fallback to tbl_users plate_number
        $resident = User::with('gender')
            ->where('is_deleted', false)
            ->whereRaw('UPPER(REPLACE(REPLACE(plate_number, " ", ""), "-", "")) = ?', [$normalizedPlate])
            ->first();

        if ($resident) {
            return [
                'resident' => $resident,
                'visitorRequest' => null,
                'visitor' => null,
                'guestRequest' => null,
            ];
        }

        // 3. Check for valid Visitor Pass (tbl_visitors + tbl_visitor_requests)
        [$visitorRequest, $visitor] = self::findVisitorPassByPlate($normalizedPlate);

        if ($visitorRequest && $visitor) {
            return [
                'resident' => null,
                'visitorRequest' => $visitorRequest,
                'visitor' => $visitor,
                'guestRequest' => null,
            ];
        }

        // 4. Legacy check for guest request in tbl_update_requests
        $guestRequest = UpdateRequest::with('resident')
            ->where('status', 'approved')
            ->whereDate('created_at', '<=', now())
            ->get()
            ->first(function (UpdateRequest $request) use ($normalizedPlate) {
                if (! self::isGuestRequestValidForToday($request)) {
                    return false;
                }

                $changes = $request->requested_changes ?? [];

                $guestPlate = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $changes['guest_plate_number'] ?? ''));
                if ($guestPlate === $normalizedPlate) {
                    return true;
                }

                if (!empty($changes['guests']) && is_array($changes['guests'])) {
                    foreach ($changes['guests'] as $g) {
                        $p = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $g['plate_number'] ?? $g['guest_plate_number'] ?? ''));
                        if ($p === $normalizedPlate) {
                            return true;
                        }
                    }
                }

                return false;
            });

        if ($guestRequest) {
            return [
                'resident' => null,
                'visitorRequest' => null,
                'visitor' => null,
                'guestRequest' => $guestRequest,
            ];
        }

        // 5. Fuzzy match for resident plates (Levenshtein)
        if (strlen($normalizedPlate) >= 5) {
            $resident = self::findClosestResidentPlate($normalizedPlate);
            if ($resident) {
                return [
                    'resident' => $resident,
                    'visitorRequest' => null,
                    'visitor' => null,
                    'guestRequest' => null,
                ];
            }

            // 6. Fuzzy match for visitor passes (Levenshtein)
            [$visitorRequest, $visitor] = self::findClosestVisitorPlate($normalizedPlate);
            if ($visitorRequest && $visitor) {
                return [
                    'resident' => null,
                    'visitorRequest' => $visitorRequest,
                    'visitor' => $visitor,
                    'guestRequest' => null,
                ];
            }
        }

        return [
            'resident' => null,
            'visitorRequest' => null,
            'visitor' => null,
            'guestRequest' => null,
        ];
    }

    /**
     * Constrains a VisitorRequest query to passes whose stay window covers $date.
     */
    private static function scopeVisitorRequestActiveForDate($query, string $date)
    {
        return $query->whereDate('visit_date', '<=', $date)
            ->where(function ($q) use ($date) {
                $q->whereDate('visit_end_date', '>=', $date)
                  ->orWhere(function ($q2) use ($date) {
                      $q2->whereNull('visit_end_date')->whereDate('visit_date', $date);
                  });
            });
    }

    /**
     * Checks whether a VisitorRequest is strictly scheduled for today's date (or stay window).
     */
    private static function isVisitorPassValidForToday(VisitorRequest $request): bool
    {
        if (! $request->visit_date) {
            return false;
        }

        try {
            $start = Carbon::parse($request->visit_date)->toDateString();
            $end = $request->visit_end_date
                ? Carbon::parse($request->visit_end_date)->toDateString()
                : $start;
            $today = now()->toDateString();

            return $today >= $start && $today <= $end;
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Checks whether a guest_access UpdateRequest covers today's date.
     */
    private static function isGuestRequestValidForToday(UpdateRequest $request): bool
    {
        $changes = $request->requested_changes ?? [];
        if (($changes['request_type'] ?? null) !== 'guest_access') {
            return false;
        }

        $startDate = $changes['access_date'] ?? null;
        if (! $startDate) {
            return false;
        }

        try {
            $start = Carbon::parse($startDate)->toDateString();
            $endDate = $changes['access_end_date'] ?? $changes['valid_until'] ?? $startDate;
            $end = $endDate ? Carbon::parse($endDate)->toDateString() : $start;
        } catch (\Throwable) {
            return false;
        }

        $today = now()->toDateString();

        return $today >= $start && $today <= $end;
    }

    /**
     * Finds an authorized visitor pass by plate number strictly for today's visit_date.
     *
     * @return array{0: ?VisitorRequest, 1: ?Visitor}
     */
    private static function findVisitorPassByPlate(string $normalizedPlate): array
    {
        $today = now()->toDateString();

        // 1. Direct query matching normalized plate for today's stay window
        $requests = self::scopeVisitorRequestActiveForDate(
            VisitorRequest::with(['visitor', 'resident', 'securityGuard'])
                ->whereHas('visitor', function ($q) use ($normalizedPlate) {
                    $q->whereNotNull('vehicle_plate')
                      ->whereRaw("UPPER(REPLACE(REPLACE(REPLACE(vehicle_plate, ' ', ''), '-', ''), '.', '')) = ?", [$normalizedPlate]);
                })
                ->whereNotIn('status', ['DENIED', 'REJECTED', 'CANCELLED']),
            $today
        )
            ->orderByDesc('request_id')
            ->get();

        // 2. Also check in-memory cleaned vehicle_plate in case of special characters
        if ($requests->isEmpty()) {
            $matchingVisitors = Visitor::whereNotNull('vehicle_plate')->get()->filter(function ($v) use ($normalizedPlate) {
                $cleaned = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $v->vehicle_plate ?? ''));
                return $cleaned === $normalizedPlate;
            });

            if ($matchingVisitors->isNotEmpty()) {
                $visitorIds = $matchingVisitors->pluck('visitor_id');
                $requests = self::scopeVisitorRequestActiveForDate(
                    VisitorRequest::with(['visitor', 'resident', 'securityGuard'])
                        ->whereIn('visitor_id', $visitorIds)
                        ->whereNotIn('status', ['DENIED', 'REJECTED', 'CANCELLED']),
                    $today
                )
                    ->orderByDesc('request_id')
                    ->get();
            }
        }

        if ($requests->isNotEmpty()) {
            $validToday = $requests->filter(fn ($r) => self::isVisitorPassValidForToday($r));

            $bestMatch = $validToday->first(function ($r) {
                return in_array($r->status, ['APPROVED', 'CONFIRMED', 'COMPLETED'], true);
            }) ?? $validToday->first();

            if ($bestMatch) {
                return [$bestMatch, $bestMatch->visitor];
            }
        }

        return [null, null];
    }

    private static function normalizeOcrLookalikes(string $plate): string
    {
        return strtr(strtoupper($plate), [
            'O' => '0',
            'Q' => '0',
            'D' => '0',
            'I' => '1',
            'L' => '1',
            'S' => '5',
            'B' => '8',
            'Z' => '2',
            'G' => '6',
        ]);
    }

    /**
     * Fuzzy matching for visitor plates in case of minor OCR misreads.
     *
     * @return array{0: ?VisitorRequest, 1: ?Visitor}
     */
    private static function findClosestVisitorPlate(string $normalizedPlate): array
    {
        $activeRequests = self::scopeVisitorRequestActiveForDate(
            VisitorRequest::with(['visitor', 'resident'])
                ->whereHas('visitor', function ($q) {
                    $q->whereNotNull('vehicle_plate');
                })
                ->whereNotIn('status', ['DENIED', 'REJECTED', 'CANCELLED']),
            now()->toDateString()
        )
            ->orderByDesc('request_id')
            ->get();

        $canonicalInput = self::normalizeOcrLookalikes($normalizedPlate);
        $bestMatch = null;
        $bestDistance = 2;

        foreach ($activeRequests as $req) {
            if (! self::isVisitorPassValidForToday($req)) {
                continue;
            }
            $registered = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $req->visitor?->vehicle_plate ?? ''));
            if ($registered === '' || abs(strlen($registered) - strlen($normalizedPlate)) > 1) {
                continue;
            }

            if (self::normalizeOcrLookalikes($registered) === $canonicalInput) {
                return [$req, $req->visitor];
            }

            $distance = levenshtein($normalizedPlate, $registered);
            if ($distance < $bestDistance) {
                $bestDistance = $distance;
                $bestMatch = $req;
            }
        }

        if ($bestDistance <= 1 && $bestMatch) {
            return [$bestMatch, $bestMatch->visitor];
        }

        return [null, null];
    }

    private static function findClosestResidentPlate(string $normalizedPlate): ?User
    {
        $canonicalInput = self::normalizeOcrLookalikes($normalizedPlate);

        // Search in tbl_vehicles first
        $vehicles = Vehicle::with('user')
            ->whereHas('user', function ($q) {
                $q->where('is_deleted', false);
            })
            ->get();

        $bestMatch = null;
        $bestDistance = 2;

        foreach ($vehicles as $veh) {
            $registered = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $veh->plate_number ?? ''));
            if ($registered === '' || abs(strlen($registered) - strlen($normalizedPlate)) > 1) {
                continue;
            }

            if (self::normalizeOcrLookalikes($registered) === $canonicalInput) {
                $user = $veh->user;
                $user->plate_number = $veh->plate_number;
                $user->car_model = $veh->car_model;
                $user->car_color = $veh->car_color;
                return $user;
            }

            $distance = levenshtein($normalizedPlate, $registered);
            if ($distance < $bestDistance) {
                $bestDistance = $distance;
                $user = $veh->user;
                $user->plate_number = $veh->plate_number;
                $user->car_model = $veh->car_model;
                $user->car_color = $veh->car_color;
                $bestMatch = $user;
            }
        }

        if ($bestDistance <= 1 && $bestMatch) {
            return $bestMatch;
        }

        $candidates = User::query()
            ->where('is_deleted', false)
            ->whereNotNull('plate_number')
            ->get();

        foreach ($candidates as $candidate) {
            $registered = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $candidate->plate_number ?? ''));
            if ($registered === '' || abs(strlen($registered) - strlen($normalizedPlate)) > 1) {
                continue;
            }

            if (self::normalizeOcrLookalikes($registered) === $canonicalInput) {
                return $candidate;
            }

            $distance = levenshtein($normalizedPlate, $registered);
            if ($distance < $bestDistance) {
                $bestDistance = $distance;
                $bestMatch = $candidate;
            }
        }

        return $bestDistance <= 1 ? $bestMatch : null;
    }

    private static function inferDirection(?string $direction, ?User $resident = null): string
    {
        if ($direction) {
            return strtoupper($direction);
        }

        if ($resident) {
            $lastLog = GateLog::where('user_id', $resident->user_id)
                ->orderByDesc('logged_at')
                ->first();

            if ($lastLog) {
                return $lastLog->direction === 'IN' ? 'OUT' : 'IN';
            }
        }

        $system = SystemStatus::current();
        return $system->gate_status === 'open' ? 'OUT' : 'IN';
    }

    public static function verifyPlate(string $plateNumber, string $direction, ?UploadedFile $image = null): array
    {
        return self::verifyAccess($plateNumber, null, $direction, $image);
    }

    public static function notifyUser(User $user, string $title, string $message, string $type): void
    {
        Notification::create([
            'user_id' => $user->user_id,
            'title' => $title,
            'message' => $message,
            'type' => $type,
        ]);
    }

    public static function notifyAdmins(string $title, string $message, string $type): void
    {
        $admins = User::where('role', 'admin')->where('is_deleted', false)->get();

        foreach ($admins as $admin) {
            self::notifyUser($admin, $title, $message, $type);
        }
    }

    public static function notifySecurityGuards(string $title, string $message, string $type): void
    {
        $guards = User::where('role', 'security_guard')->where('is_deleted', false)->get();

        foreach ($guards as $guard) {
            self::notifyUser($guard, $title, $message, $type);
        }
    }
}
