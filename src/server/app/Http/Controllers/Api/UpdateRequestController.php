<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\UpdateRequest;
use App\Models\User;
use App\Services\GateService;
use Illuminate\Http\Request;

class UpdateRequestController extends Controller
{
    public function loadRequests(Request $request)
    {
        $query = UpdateRequest::with(['resident.gender'])
            ->orderByDesc('created_at');

        if ($request->user()->isResident()) {
            $query->where('user_id', $request->user()->user_id);
        } elseif ($request->status) {
            $query->where('status', $request->status);
        }

        return response()->json(['requests' => $query->paginate(15)], 200);
    }

    public function storeRequest(Request $request)
    {
        $requestType = $request->input('request_type', 'profile_update');

        if ($requestType === 'guest_access') {
            $guestsInput = $request->input('guests');
            if (is_array($guestsInput) && count($guestsInput) > 0) {
                $firstGuest = $guestsInput[0];
                if (!$request->filled('guest_name')) {
                    $request->merge([
                        'guest_name' => $firstGuest['name'] ?? $firstGuest['guest_name'] ?? 'Guest',
                    ]);
                }
            }

            $validated = $request->validate([
                'request_type' => ['required', 'in:guest_access'],
                'guest_name' => ['required', 'max:155'],
                'guest_age' => ['nullable', 'integer', 'min:1', 'max:150'],
                'guest_contact_number' => ['nullable', 'string'],
                'guest_address' => ['nullable', 'max:255'],
                'guest_plate_number' => ['nullable', 'max:20'],
                'guest_car_model' => ['nullable', 'max:55'],
                'guest_car_color' => ['nullable', 'max:55'],
                'access_date' => ['nullable', 'date'],
                'access_reason' => ['required', 'max:500'],
                'guests' => ['nullable', 'array'],
            ]);

            if (empty($validated['access_date'])) {
                $validated['access_date'] = now()->toDateString();
            }

            if (! empty($validated['guest_plate_number'])) {
                $validated['guest_plate_number'] = strtoupper($validated['guest_plate_number']);
            }

            // Normalize guests list
            $guestsList = [];
            if (!empty($validated['guests']) && is_array($validated['guests'])) {
                foreach ($validated['guests'] as $g) {
                    if (!is_array($g)) continue;
                    $gName = trim($g['name'] ?? $g['guest_name'] ?? '');
                    if (empty($gName)) continue;
                    $gPlate = !empty($g['plate_number']) ? strtoupper(trim($g['plate_number'])) : (!empty($g['guest_plate_number']) ? strtoupper(trim($g['guest_plate_number'])) : null);
                    $gContact = $g['contact_number'] ?? $g['guest_contact_number'] ?? ($validated['guest_contact_number'] ?? 'N/A');
                    $gModel = $g['car_model'] ?? $g['guest_car_model'] ?? ($validated['guest_car_model'] ?? null);
                    $gColor = $g['car_color'] ?? $g['guest_car_color'] ?? ($validated['guest_car_color'] ?? null);

                    $guestsList[] = [
                        'name' => $gName,
                        'guest_name' => $gName,
                        'contact_number' => $gContact,
                        'guest_contact_number' => $gContact,
                        'plate_number' => $gPlate,
                        'guest_plate_number' => $gPlate,
                        'car_model' => $gModel,
                        'guest_car_model' => $gModel,
                        'car_color' => $gColor,
                        'guest_car_color' => $gColor,
                    ];
                }
            }

            if (empty($guestsList)) {
                $guestsList[] = [
                    'name' => $validated['guest_name'],
                    'guest_name' => $validated['guest_name'],
                    'contact_number' => $validated['guest_contact_number'] ?? 'N/A',
                    'guest_contact_number' => $validated['guest_contact_number'] ?? 'N/A',
                    'plate_number' => !empty($validated['guest_plate_number']) ? strtoupper(trim($validated['guest_plate_number'])) : null,
                    'guest_plate_number' => !empty($validated['guest_plate_number']) ? strtoupper(trim($validated['guest_plate_number'])) : null,
                    'car_model' => $validated['guest_car_model'] ?? null,
                    'guest_car_model' => $validated['guest_car_model'] ?? null,
                    'car_color' => $validated['guest_car_color'] ?? null,
                    'guest_car_color' => $validated['guest_car_color'] ?? null,
                ];
            }

            $validated['guests'] = $guestsList;
            if (count($guestsList) > 1) {
                $validated['guest_name'] = $guestsList[0]['name'] . ' (+ ' . (count($guestsList) - 1) . ' others)';
            }

            $changes = array_filter($validated, fn ($v) => $v !== null && $v !== '');
        } else {
            $validated = $request->validate([
                'first_name' => ['nullable', 'max:55'],
                'middle_name' => ['nullable', 'max:55'],
                'last_name' => ['nullable', 'max:55'],
                'gender' => ['nullable', 'exists:tbl_genders,gender_id'],
                'birth_date' => ['nullable', 'date'],
                'contact_number' => ['nullable', 'string', 'regex:/^[0-9]{11}$/'],
                'address' => ['nullable', 'max:255'],
                'plate_number' => ['nullable', 'max:20'],
                'car_model' => ['nullable', 'max:55'],
                'car_color' => ['nullable', 'max:55'],
            ]);

            $changes = array_filter($validated, fn ($v) => $v !== null && $v !== '');
        }

        if (empty($changes)) {
            return response()->json(['message' => 'No changes submitted.'], 422);
        }

        $updateRequest = UpdateRequest::create([
            'user_id' => $request->user()->user_id,
            'requested_changes' => $changes,
            'status' => 'pending',
        ]);

        if ($requestType === 'guest_access') {
            $guestPlate = ! empty($changes['guest_plate_number']) ? ' (' . $changes['guest_plate_number'] . ')' : '';

            // Record in tbl_visitors and tbl_visitor_requests for all guests in ticket
            foreach ($guestsList as $gItem) {
                try {
                    $visitor = \App\Models\Visitor::create([
                        'full_name' => $gItem['name'] ?? 'Visitor',
                        'contact_number' => $gItem['contact_number'] ?? 'N/A',
                        'age' => !empty($changes['guest_age']) ? (int) $changes['guest_age'] : null,
                        'address' => $changes['guest_address'] ?? null,
                        'vehicle_plate' => ! empty($gItem['plate_number']) ? strtoupper(trim($gItem['plate_number'])) : null,
                        'vehicle_type' => $gItem['car_model'] ?? 'Vehicle',
                        'car_model' => $gItem['car_model'] ?? null,
                        'car_color' => $gItem['car_color'] ?? null,
                    ]);

                    \App\Models\VisitorRequest::create([
                        'visitor_id' => $visitor->visitor_id,
                        'resident_id' => $request->user()->user_id,
                        'guard_id' => null,
                        'requested_by' => 'resident',
                        'visit_date' => !empty($changes['access_date']) ? $changes['access_date'] : now()->toDateString(),
                        'visit_time' => !empty($changes['access_time']) ? $changes['access_time'] : '10:00 AM',
                        'purpose' => !empty($changes['access_reason']) ? $changes['access_reason'] : 'Guest Visit',
                        'status' => 'PENDING',
                        'notes' => 'Submitted from Mobile App [UpdateReq ID: ' . $updateRequest->update_request_id . ']',
                    ]);
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::warning('Guest access visitor creation error: ' . $e->getMessage());
                }
            }

            $countSuffix = count($guestsList) > 1 ? ' (' . count($guestsList) . ' guests)' : '';
            GateService::notifySecurityGuards(
                'Guest Access Pass Requested',
                $request->user()->owner_name . ' requested a guest access pass for ' . ($changes['guest_name'] ?? 'Visitor') . $guestPlate . $countSuffix . '. [REQUEST_ID:' . $updateRequest->update_request_id . ']',
                'guest_access'
            );
        } else {
            GateService::notifyAdmins(
                'Profile Update Request',
                $request->user()->owner_name . ' submitted a profile update request. [REQUEST_ID:' . $updateRequest->update_request_id . ']',
                'update_request'
            );
        }

        return response()->json([
            'message' => $requestType === 'guest_access'
                ? 'Guest access request submitted for admin review.'
                : 'Update request submitted for admin review.',
            'request' => $updateRequest,
        ], 200);
    }

    public function showRequest(Request $request, UpdateRequest $updateRequest)
    {
        $updateRequest->load(['resident.gender']);
        return response()->json(['request' => $updateRequest], 200);
    }

    public function reviewRequest(Request $request, UpdateRequest $updateRequest)
    {
        $validated = $request->validate([
            'status' => ['required', 'in:approved,rejected'],
            'admin_notes' => ['nullable', 'string', 'max:500'],
        ]);

        if ($updateRequest->status !== 'pending') {
            return response()->json(['message' => 'Request already reviewed.'], 422);
        }

        $updateRequest->update([
            'status' => $validated['status'],
            'admin_notes' => $validated['admin_notes'] ?? null,
        ]);

        $resident = User::find($updateRequest->user_id);

        if ($validated['status'] === 'approved' && $resident && (($updateRequest->requested_changes['request_type'] ?? 'profile_update') !== 'guest_access')) {
            $changes = $updateRequest->requested_changes;

            if (isset($changes['plate_number'])) {
                $changes['plate_number'] = strtoupper($changes['plate_number']);
            }

            if (isset($changes['birth_date'])) {
                $changes['age'] = date_diff(date_create($changes['birth_date']), date_create('now'))->y;
            }

            if (isset($changes['gender'])) {
                $changes['gender_id'] = $changes['gender'];
                unset($changes['gender']);
            }

            $resident->update($changes);

            // Sync with tbl_vehicles if plate provided
            if (!empty($changes['plate_number'])) {
                \App\Models\Vehicle::updateOrCreate(
                    [
                        'user_id' => $resident->user_id,
                        'plate_number' => $changes['plate_number'],
                    ],
                    [
                        'car_model' => $changes['car_model'] ?? 'Vehicle',
                        'car_color' => $changes['car_color'] ?? 'N/A',
                        'is_primary' => true,
                        'status' => 'approved',
                    ]
                );
            }
        } elseif (($updateRequest->requested_changes['request_type'] ?? '') === 'guest_access') {
            $guestName = $updateRequest->requested_changes['guest_name'] ?? null;
            $newStatus = $validated['status'] === 'approved' ? 'APPROVED' : 'DENIED';

            try {
                \App\Models\VisitorRequest::where('resident_id', $updateRequest->user_id)
                    ->where(function ($q) use ($guestName, $updateRequest) {
                        $q->where('notes', 'like', '%[UpdateReq ID: ' . $updateRequest->update_request_id . ']%');
                        if ($guestName) {
                            $q->orWhereHas('visitor', function ($vq) use ($guestName) {
                                $vq->where('full_name', $guestName);
                            });
                        }
                    })
                    ->update([
                        'status' => $newStatus,
                        'guard_remarks' => $validated['admin_notes'] ?? null,
                    ]);
            } catch (\Throwable $e) {}
        }

        Notification::create([
            'user_id' => $updateRequest->user_id,
            'title' => (($updateRequest->requested_changes['request_type'] ?? 'profile_update') === 'guest_access' ? 'Guest Access ' : 'Update Request ') . ucfirst($validated['status']),
            'message' => $validated['status'] === 'approved'
                ? ((($updateRequest->requested_changes['request_type'] ?? 'profile_update') === 'guest_access')
                    ? 'Your guest access request has been approved.'
                    : 'Your profile update has been approved and applied.')
                : ((($updateRequest->requested_changes['request_type'] ?? 'profile_update') === 'guest_access')
                    ? 'Your guest access request was rejected.'
                    : 'Your profile update request was rejected.') . ($validated['admin_notes'] ? ' Note: ' . $validated['admin_notes'] : ''),
            'type' => 'update_request',
        ]);

        return response()->json([
            'message' => 'Update request reviewed.',
            'request' => $updateRequest->load('resident'),
        ], 200);
    }
}
