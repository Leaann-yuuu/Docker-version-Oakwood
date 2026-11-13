<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use App\Models\Visitor;
use App\Models\VisitorRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class VisitorManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        \App\Models\Gender::firstOrCreate(['gender_id' => 1], ['gender' => 'Male']);
    }

    public function test_flow_1_resident_registers_visitor_and_guard_approves(): void
    {
        // 1. Create Resident and Guard users
        $resident = User::firstOrCreate(
            ['username' => 'test_resident_vms'],
            [
                'first_name' => 'Juan',
                'last_name' => 'Dela Cruz',
                'role' => 'resident',
                'password' => bcrypt('password123'),
                'gender_id' => 1,
                'birth_date' => '1990-01-01',
                'age' => 36,
                'contact_number' => '09171112222',
                'address' => 'Block 5 Lot 10 Oakwood',
                'is_approved' => 1,
                'is_deleted' => 0,
            ]
        );

        $guard = User::firstOrCreate(
            ['username' => 'test_guard_vms'],
            [
                'first_name' => 'Alex',
                'last_name' => 'Guard',
                'role' => 'security_guard',
                'password' => bcrypt('password123'),
                'gender_id' => 1,
                'birth_date' => '1985-05-15',
                'age' => 41,
                'contact_number' => '09173334444',
                'is_approved' => 1,
                'is_deleted' => 0,
            ]
        );

        // 2. Resident submits visitor request (Flow 1)
        Sanctum::actingAs($resident);

        $payload = [
            'full_name' => 'Maria Santos',
            'contact_number' => '09189998888',
            'visit_date' => now()->addDay()->toDateString(),
            'visit_time' => '14:00',
            'purpose' => 'Personal Visit',
            'vehicle_plate' => 'ABC 1234',
            'vehicle_type' => 'Sedan',
            'notes' => 'Visiting for family dinner',
        ];

        $response = $this->postJson('/api/visitor/resident-create', $payload);
        $response->assertStatus(201);
        $response->assertJsonPath('request.status', 'PENDING');
        $response->assertJsonPath('request.requested_by', 'resident');

        $requestId = $response->json('request.request_id');
        $this->assertNotNull($requestId);

        // Verify notification sent to guard
        $guardNotification = Notification::where('user_id', $guard->user_id)
            ->where('request_id', $requestId)
            ->first();
        $this->assertNotNull($guardNotification);
        $this->assertStringContainsString('Maria Santos', $guardNotification->message);

        // 3. Security Guard reviews request -> APPROVE
        Sanctum::actingAs($guard);

        $reviewResponse = $this->putJson("/api/visitor/guard-review/{$requestId}", [
            'decision' => 'APPROVED',
            'guard_remarks' => 'Pre-approved for gate entry pass',
        ]);

        $reviewResponse->assertStatus(200);
        $reviewResponse->assertJsonPath('request.status', 'APPROVED');

        // Verify notification sent to resident
        $residentNotification = Notification::where('user_id', $resident->user_id)
            ->where('request_id', $requestId)
            ->where('type', 'visitor_approved')
            ->first();
        $this->assertNotNull($residentNotification);
        $this->assertStringContainsString('approved', $residentNotification->message);
    }

    public function test_flow_2_guard_registers_walkin_and_resident_confirms(): void
    {
        $resident = User::firstOrCreate(
            ['username' => 'test_resident_vms2'],
            [
                'first_name' => 'Maria',
                'last_name' => 'Clara',
                'role' => 'resident',
                'password' => bcrypt('password123'),
                'gender_id' => 1,
                'birth_date' => '1992-02-02',
                'age' => 34,
                'contact_number' => '09175556666',
                'address' => 'Block 8 Lot 12 Oakwood',
                'is_approved' => 1,
                'is_deleted' => 0,
            ]
        );

        $guard = User::firstOrCreate(
            ['username' => 'test_guard_vms2'],
            [
                'first_name' => 'Alex',
                'last_name' => 'Guard',
                'role' => 'security_guard',
                'password' => bcrypt('password123'),
                'gender_id' => 1,
                'birth_date' => '1985-05-15',
                'age' => 41,
                'contact_number' => '09173334444',
                'is_approved' => 1,
                'is_deleted' => 0,
            ]
        );

        // 1. Guard registers walk-in visitor at the gate (Flow 2)
        Sanctum::actingAs($guard);

        $walkinPayload = [
            'full_name' => 'Pedro Garcia',
            'contact_number' => '09192223333',
            'resident_id' => $resident->user_id,
            'visit_date' => now()->toDateString(),
            'visit_time' => '15:30',
            'purpose' => 'Plumbing Maintenance',
            'vehicle_plate' => 'XYZ 9876',
            'vehicle_type' => 'Van',
            'notes' => 'Contractor',
            'guard_remarks' => 'Waiting at gate post 1',
        ];

        $response = $this->postJson('/api/visitor/guard-create', $walkinPayload);
        $response->assertStatus(201);
        $response->assertJsonPath('request.status', 'PENDING');
        $response->assertJsonPath('request.requested_by', 'guard');

        $requestId = $response->json('request.request_id');

        // Verify alert notification sent to resident
        $residentAlert = Notification::where('user_id', $resident->user_id)
            ->where('request_id', $requestId)
            ->where('type', 'walkin_request')
            ->first();
        $this->assertNotNull($residentAlert);
        $this->assertStringContainsString('Pedro Garcia', $residentAlert->message);
        $this->assertStringContainsString('gate', $residentAlert->message);

        // 2. Resident confirms the walk-in visitor
        Sanctum::actingAs($resident);

        $confirmResponse = $this->putJson("/api/visitor/resident-respond/{$requestId}", [
            'response' => 'CONFIRM',
            'notes' => 'Expected contractor for bathroom repairs',
        ]);

        $confirmResponse->assertStatus(200);
        $confirmResponse->assertJsonPath('request.status', 'CONFIRMED');

        // 3. Security Guard allows visitor and marks visit COMPLETED
        Sanctum::actingAs($guard);

        $completeResponse = $this->putJson("/api/visitor/status/{$requestId}", [
            'status' => 'COMPLETED',
            'guard_remarks' => 'Visitor departed subdivision gate at 17:00',
        ]);

        $completeResponse->assertStatus(200);
        $completeResponse->assertJsonPath('request.status', 'COMPLETED');
    }
}
