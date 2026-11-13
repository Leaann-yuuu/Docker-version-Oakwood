<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\ResidentGateAccessWelcomeMail;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\GateService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;

class ResidentController extends Controller
{
    public function loadResidents(Request $request)
    {
        $search = $request->input('search');

        $residents = User::with(['gender', 'vehicles'])
            ->where('role', 'resident')
            ->where('is_deleted', false)
            ->orderBy('last_name')
            ->orderBy('first_name');

        if ($search) {
            $residents->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('middle_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('plate_number', 'like', "%{$search}%")
                    ->orWhere('contact_number', 'like', "%{$search}%")
                    ->orWhere('username', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhereHas('vehicles', function ($vq) use ($search) {
                        $vq->where('plate_number', 'like', "%{$search}%")
                            ->orWhere('car_model', 'like', "%{$search}%")
                            ->orWhere('car_color', 'like', "%{$search}%");
                    });
            });
        }

        $paginated = $residents->paginate(15);

        return response()->json(['residents' => $paginated], 200);
    }

    public function storeResident(Request $request)
    {
        $validated = $this->validateResident($request);
        $plainPassword = $validated['password'];

        $age = date_diff(date_create($validated['birth_date']), date_create('now'))->y;

        $primaryPlate = !empty($validated['plate_number']) ? strtoupper($validated['plate_number']) : '';
        $primaryModel = $validated['car_model'] ?? '';
        $primaryColor = $validated['car_color'] ?? '';

        if (!empty($validated['vehicles']) && is_array($validated['vehicles'])) {
            $first = $validated['vehicles'][0];
            $primary = collect($validated['vehicles'])->firstWhere('is_primary', true) ?? $first;
            $primaryPlate = strtoupper(trim($primary['plate_number']));
            $primaryModel = trim($primary['car_model']);
            $primaryColor = trim($primary['car_color']);
        }

        $user = User::create([
            'role' => 'resident',
            'first_name' => $validated['first_name'],
            'middle_name' => $validated['middle_name'] ?? null,
            'last_name' => $validated['last_name'],
            'gender_id' => $validated['gender'],
            'birth_date' => $validated['birth_date'],
            'age' => $age,
            'email' => $validated['email'],
            'username' => $validated['username'],
            'password' => $plainPassword,
            'contact_number' => $validated['contact_number'],
            'address' => $validated['address'],
            'plate_number' => $primaryPlate,
            'car_model' => $primaryModel,
            'car_color' => $primaryColor,
        ]);

        if (!empty($validated['vehicles']) && is_array($validated['vehicles'])) {
            $vehicles = array_slice($validated['vehicles'], 0, 10);
            foreach ($vehicles as $idx => $v) {
                $isPrimary = !empty($v['is_primary']) || ($idx === 0 && !collect($vehicles)->contains('is_primary', true));
                $user->vehicles()->create([
                    'plate_number' => strtoupper(trim($v['plate_number'])),
                    'car_model' => trim($v['car_model']),
                    'car_color' => trim($v['car_color']),
                    'is_primary' => $isPrimary,
                ]);
            }
        } elseif ($primaryPlate) {
            $user->vehicles()->create([
                'plate_number' => $primaryPlate,
                'car_model' => $primaryModel,
                'car_color' => $primaryColor,
                'is_primary' => true,
            ]);
        }

        $user->load(['gender', 'vehicles']);

        $mailError = null;

        $credentialsMailbox = trim((string) $user->email);

        if (! filter_var($credentialsMailbox, FILTER_VALIDATE_EMAIL)) {
            $mailError = 'The registered resident does not have a valid email address.';
        } else {
            try {
                \Illuminate\Support\Facades\Log::info("Sending credentials email to: " . $credentialsMailbox);
                Mail::to($credentialsMailbox)->send(new ResidentGateAccessWelcomeMail(
                    $user,
                    $plainPassword,
                    config('gate.portal_url'),
                ));
            } catch (\Throwable $e) {
                report($e);
                $mailError = $e->getMessage();
            }
        }

        return response()->json([
            'message' => $mailError
                ? 'Resident saved, but credentials email failed. Check mail_error.'
                : 'Resident successfully saved. Credentials email sent to the resident email address.',
            'mail_sent' => $mailError === null,
            'mail_error' => $mailError,
            'mail_recipient' => $credentialsMailbox,
            'resident' => $user,
        ], 200);
    }

    public function updateResident(Request $request, User $resident)
    {
        if ($resident->role !== 'resident' || $resident->is_deleted) {
            return response()->json(['message' => 'Resident not found.'], 404);
        }

        $validated = $this->validateResident($request, $resident->user_id);
        $age = date_diff(date_create($validated['birth_date']), date_create('now'))->y;

        $update = [
            'first_name' => $validated['first_name'],
            'middle_name' => $validated['middle_name'] ?? null,
            'last_name' => $validated['last_name'],
            'gender_id' => $validated['gender'],
            'birth_date' => $validated['birth_date'],
            'age' => $age,
            'email' => $validated['email'],
            'username' => $validated['username'],
            'contact_number' => $validated['contact_number'],
            'address' => $validated['address'],
        ];

        if (!empty($validated['vehicles']) && is_array($validated['vehicles'])) {
            $vehicles = array_slice($validated['vehicles'], 0, 10);
            $resident->vehicles()->delete();
            $primaryVehicle = null;

            foreach ($vehicles as $idx => $v) {
                $isPrimary = !empty($v['is_primary']) || ($idx === 0 && !collect($vehicles)->contains('is_primary', true));
                $created = $resident->vehicles()->create([
                    'plate_number' => strtoupper(trim($v['plate_number'])),
                    'car_model' => trim($v['car_model']),
                    'car_color' => trim($v['car_color']),
                    'is_primary' => $isPrimary,
                ]);

                if ($isPrimary && !$primaryVehicle) {
                    $primaryVehicle = $created;
                }
            }

            if ($primaryVehicle) {
                $update['plate_number'] = $primaryVehicle->plate_number;
                $update['car_model'] = $primaryVehicle->car_model;
                $update['car_color'] = $primaryVehicle->car_color;
            } elseif (!empty($vehicles[0])) {
                $update['plate_number'] = strtoupper(trim($vehicles[0]['plate_number']));
                $update['car_model'] = trim($vehicles[0]['car_model']);
                $update['car_color'] = trim($vehicles[0]['car_color']);
            }
        } elseif (!empty($validated['plate_number'])) {
            $update['plate_number'] = strtoupper($validated['plate_number']);
            $update['car_model'] = $validated['car_model'];
            $update['car_color'] = $validated['car_color'];

            $resident->vehicles()->updateOrCreate(
                ['plate_number' => $update['plate_number']],
                [
                    'car_model' => $update['car_model'],
                    'car_color' => $update['car_color'],
                    'is_primary' => true,
                ]
            );
        }

        if ($request->filled('password')) {
            $update['password'] = $validated['password'];
        }

        $resident->update($update);

        return response()->json([
            'message' => 'Resident successfully updated.',
            'resident' => $resident->load(['gender', 'vehicles']),
        ], 200);
    }

    public function destroyResident(User $resident)
    {
        if ($resident->role !== 'resident') {
            return response()->json(['message' => 'Resident not found.'], 404);
        }

        $resident->update(['is_deleted' => true]);

        return response()->json(['message' => 'Resident successfully deleted.'], 200);
    }

    private function validateResident(Request $request, ?int $ignoreUserId = null): array
    {
        $hasVehiclesArray = $request->has('vehicles') && is_array($request->input('vehicles'));

        $rules = [
            'first_name' => ['required', 'max:55'],
            'middle_name' => ['nullable', 'max:55'],
            'last_name' => ['required', 'max:55'],
            'gender' => ['required', 'exists:tbl_genders,gender_id'],
            'birth_date' => ['required', 'date'],
            'email' => ['required', 'email', 'max:255'],
            'username' => ['required', 'min:6', 'max:50', Rule::unique('tbl_users', 'username')->ignore($ignoreUserId, 'user_id')],
            'password' => $ignoreUserId === null
                ? ['required', 'string', 'min:6', 'max:50', 'confirmed']
                : ['sometimes', 'nullable', 'string', 'min:6', 'max:50', 'confirmed'],
            'contact_number' => ['required', 'string', 'regex:/^[0-9]{11}$/'],
            'address' => ['required', 'max:255'],
        ];

        if ($hasVehiclesArray) {
            $rules['vehicles'] = ['required', 'array', 'min:1', 'max:10'];
            $rules['vehicles.*.plate_number'] = ['required', 'string', 'max:20'];
            $rules['vehicles.*.car_model'] = ['required', 'string', 'max:55'];
            $rules['vehicles.*.car_color'] = ['required', 'string', 'max:55'];
            $rules['vehicles.*.is_primary'] = ['nullable', 'boolean'];
            $rules['plate_number'] = ['nullable', 'max:20'];
            $rules['car_model'] = ['nullable', 'max:55'];
            $rules['car_color'] = ['nullable', 'max:55'];
        } else {
            $rules['plate_number'] = ['required', 'max:20'];
            $rules['car_model'] = ['required', 'max:55'];
            $rules['car_color'] = ['required', 'max:55'];
        }

        return $request->validate($rules);
    }

    public function myVehicles(Request $request)
    {
        $vehicles = Vehicle::where('user_id', $request->user()->user_id)
            ->orderByDesc('is_primary')
            ->orderBy('vehicle_id')
            ->get();

        return response()->json(['vehicles' => $vehicles], 200);
    }

    public function addVehicle(Request $request)
    {
        $validated = $request->validate([
            'plate_number' => ['required', 'string', 'max:20'],
            'car_model' => ['required', 'string', 'max:55'],
            'car_color' => ['required', 'string', 'max:55'],
            'or_cr_image' => ['required', 'file', 'image', 'max:10240'],
            'license_image' => ['required', 'file', 'image', 'max:10240'],
        ]);

        $user = $request->user();
        $normalizedPlate = strtoupper(trim(preg_replace('/\s+/', ' ', $validated['plate_number'])));

        // Check if plate already registered under another resident
        $existing = Vehicle::where('plate_number', $normalizedPlate)
            ->where('user_id', '!=', $user->user_id)
            ->first();

        if ($existing) {
            return response()->json([
                'message' => "Plate number {$normalizedPlate} is already registered to another resident account.",
            ], 422);
        }

        // Store OR/CR image
        $orCrPath = null;
        if ($request->hasFile('or_cr_image')) {
            $file = $request->file('or_cr_image');
            $filename = 'or_cr_' . $user->user_id . '_' . time() . '.' . ($file->getClientOriginalExtension() ?: 'jpg');
            $file->storeAs('img/vehicles/or_cr', $filename, 'public');
            $orCrPath = 'img/vehicles/or_cr/' . $filename;
        }

        // Store License image
        $licensePath = null;
        if ($request->hasFile('license_image')) {
            $file = $request->file('license_image');
            $filename = 'lic_' . $user->user_id . '_' . time() . '.' . ($file->getClientOriginalExtension() ?: 'jpg');
            $file->storeAs('img/vehicles/license', $filename, 'public');
            $licensePath = 'img/vehicles/license/' . $filename;
        }

        $isFirstVehicle = Vehicle::where('user_id', $user->user_id)->count() === 0;

        $vehicle = Vehicle::create([
            'user_id' => $user->user_id,
            'plate_number' => $normalizedPlate,
            'car_model' => trim($validated['car_model']),
            'car_color' => trim($validated['car_color']),
            'is_primary' => $isFirstVehicle,
            'or_cr_image' => $orCrPath,
            'license_image' => $licensePath,
            'status' => 'approved',
        ]);

        // If primary or first, update user's plate_number
        if ($isFirstVehicle || empty($user->plate_number)) {
            $user->update([
                'plate_number' => $normalizedPlate,
                'car_model' => $vehicle->car_model,
                'car_color' => $vehicle->car_color,
            ]);
        }

        // Notify admins
        try {
            GateService::notifyAdmins(
                'New Resident Vehicle Added',
                "{$user->owner_name} registered a new vehicle: {$vehicle->car_model} ({$vehicle->plate_number}) with uploaded OR/CR and license documents.",
                'vehicle_registered'
            );
        } catch (\Throwable $e) {}

        return response()->json([
            'message' => 'Vehicle registered successfully with verified OR/CR and license documents.',
            'vehicle' => $vehicle,
            'user' => $user->fresh()->load(['gender', 'vehicles']),
        ], 201);
    }
}
