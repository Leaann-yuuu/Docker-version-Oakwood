<?php

namespace Tests\Feature;

use App\Models\GateLog;
use App\Models\Notification;
use App\Models\SystemStatus;
use App\Models\UpdateRequest;
use App\Models\User;
use App\Models\Visitor;
use App\Models\VisitorRequest;
use App\Services\GateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class VisitorGateAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        \App\Models\Gender::firstOrCreate(['gender_id' => 1], ['gender' => 'Male']);
    }

    public function test_visitor_pass_exact_plate_opens_gate(): void
    {
        // 1. Create Host Resident
        $resident = User::create([
            'username' => 'test_resident_gate',
            'first_name' => 'Lorenz',
            'last_name' => 'Luyahan',
            'role' => 'resident',
            'password' => bcrypt('password123'),
            'gender_id' => 1,
            'birth_date' => '1990-01-01',
            'age' => 36,
            'contact_number' => '09171112222',
            'address' => 'Block 5 Lot 10 Oakwood',
            'is_approved' => 1,
            'is_deleted' => 0,
        ]);

        // 2. Create Visitor with plate "730 FRL"
        $visitor = Visitor::create([
            'full_name' => 'JohnPaul Daliva',
            'contact_number' => '09288728685',
            'vehicle_plate' => '730 FRL',
            'vehicle_type' => 'Pickup Truck',
        ]);

        // 3. Create approved visitor request for today
        $visitorRequest = VisitorRequest::create([
            'visitor_id' => $visitor->visitor_id,
            'resident_id' => $resident->user_id,
            'requested_by' => 'resident',
            'visit_date' => now()->toDateString(),
            'visit_time' => '12:00 PM',
            'purpose' => 'Family visit',
            'status' => 'APPROVED',
        ]);

        // 4. Verify plate "730FRL" via API
        $response = $this->postJson('/api/gate/verify', [
            'plate_number' => '730FRL',
            'direction' => 'IN',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('authorized', true);
        $response->assertJsonPath('gate_command', 'O');
        $response->assertJsonPath('is_visitor', true);
        $response->assertJsonPath('owner_name', 'JohnPaul Daliva');
        $response->assertJsonPath('car_model', 'Pickup Truck');

        // Verify gate log created
        $log = GateLog::where('plate_number', '730FRL')->first();
        $this->assertNotNull($log);
        $this->assertEquals('authorized', $log->status);
        $this->assertEquals('JohnPaul Daliva', $log->owner_name);
        $this->assertEquals($resident->user_id, $log->user_id);

        // Verify system status
        $this->assertEquals('open', SystemStatus::current()->gate_status);

        // Verify notification sent to resident
        $resNotif = Notification::where('user_id', $resident->user_id)
            ->where('type', 'visitor_access')
            ->first();
        $this->assertNotNull($resNotif);
        $this->assertStringContainsString('JohnPaul Daliva', $resNotif->message);
    }

    public function test_visitor_pass_with_completed_status_opens_gate(): void
    {
        $resident = User::create([
            'username' => 'test_resident_gate2',
            'first_name' => 'Lorenz',
            'last_name' => 'Luyahan',
            'role' => 'resident',
            'password' => bcrypt('password123'),
            'gender_id' => 1,
            'birth_date' => '1990-01-01',
            'age' => 36,
            'contact_number' => '09171112222',
            'address' => 'Block 5 Lot 10 Oakwood',
            'is_approved' => 1,
            'is_deleted' => 0,
        ]);

        $visitor = Visitor::create([
            'full_name' => 'JohnPaul Daliva',
            'contact_number' => '09288728685',
            'vehicle_plate' => '730 FRL',
            'vehicle_type' => 'Pickup Truck',
        ]);

        VisitorRequest::create([
            'visitor_id' => $visitor->visitor_id,
            'resident_id' => $resident->user_id,
            'requested_by' => 'guard',
            'visit_date' => now()->toDateString(),
            'visit_time' => '12:00 PM',
            'purpose' => 'Visitor',
            'status' => 'COMPLETED',
        ]);

        $response = $this->postJson('/api/gate/verify', [
            'plate_number' => '730 FRL',
            'direction' => 'IN',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('authorized', true);
        $response->assertJsonPath('gate_command', 'O');
    }

    public function test_visitor_pass_fuzzy_plate_match(): void
    {
        $resident = User::create([
            'username' => 'test_resident_gate3',
            'first_name' => 'Lorenz',
            'last_name' => 'Luyahan',
            'role' => 'resident',
            'password' => bcrypt('password123'),
            'gender_id' => 1,
            'birth_date' => '1990-01-01',
            'age' => 36,
            'contact_number' => '09171112222',
            'address' => 'Block 5 Lot 10 Oakwood',
            'is_approved' => 1,
            'is_deleted' => 0,
        ]);

        $visitor = Visitor::create([
            'full_name' => 'Kyle',
            'contact_number' => '09387486736',
            'vehicle_plate' => 'LOR 123',
            'vehicle_type' => 'Sedan',
        ]);

        VisitorRequest::create([
            'visitor_id' => $visitor->visitor_id,
            'resident_id' => $resident->user_id,
            'requested_by' => 'resident',
            'visit_date' => now()->toDateString(),
            'visit_time' => '10:00 AM',
            'purpose' => 'Visit',
            'status' => 'APPROVED',
        ]);

        // OCR reads "LOR128" instead of "LOR123" (1 char difference)
        $response = $this->postJson('/api/gate/verify', [
            'plate_number' => 'LOR128',
            'direction' => 'IN',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('authorized', true);
    }

    public function test_cancelled_visitor_pass_is_denied(): void
    {
        $resident = User::create([
            'username' => 'test_resident_gate4',
            'first_name' => 'Lorenz',
            'last_name' => 'Luyahan',
            'role' => 'resident',
            'password' => bcrypt('password123'),
            'gender_id' => 1,
            'birth_date' => '1990-01-01',
            'age' => 36,
            'contact_number' => '09171112222',
            'address' => 'Block 5 Lot 10 Oakwood',
            'is_approved' => 1,
            'is_deleted' => 0,
        ]);

        $visitor = Visitor::create([
            'full_name' => 'Cancelled Guest',
            'contact_number' => '09111111111',
            'vehicle_plate' => 'BAD 9999',
            'vehicle_type' => 'SUV',
        ]);

        VisitorRequest::create([
            'visitor_id' => $visitor->visitor_id,
            'resident_id' => $resident->user_id,
            'requested_by' => 'resident',
            'visit_date' => now()->toDateString(),
            'visit_time' => '10:00 AM',
            'purpose' => 'Visit',
            'status' => 'CANCELLED',
        ]);

        $response = $this->postJson('/api/gate/verify', [
            'plate_number' => 'BAD9999',
            'direction' => 'IN',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('authorized', false);
    }

    public function test_visitor_pass_for_future_date_cannot_enter(): void
    {
        $resident = User::create([
            'username' => 'test_resident_future',
            'first_name' => 'Lorenz',
            'last_name' => 'Luyahan',
            'role' => 'resident',
            'password' => bcrypt('password123'),
            'gender_id' => 1,
            'birth_date' => '1990-01-01',
            'age' => 36,
            'contact_number' => '09171112222',
            'address' => 'Block 5 Lot 10 Oakwood',
            'is_approved' => 1,
            'is_deleted' => 0,
        ]);

        $visitor = Visitor::create([
            'full_name' => 'Future Visitor',
            'contact_number' => '09123456789',
            'vehicle_plate' => 'FUT 2026',
            'vehicle_type' => 'Sedan',
        ]);

        VisitorRequest::create([
            'visitor_id' => $visitor->visitor_id,
            'resident_id' => $resident->user_id,
            'requested_by' => 'resident',
            'visit_date' => now()->addDay()->toDateString(),
            'visit_time' => '10:00 AM',
            'purpose' => 'Future visit',
            'status' => 'APPROVED',
        ]);

        // Exact plate verify must be denied
        $response = $this->postJson('/api/gate/verify', [
            'plate_number' => 'FUT2026',
            'direction' => 'IN',
        ]);
        $response->assertStatus(200);
        $response->assertJsonPath('authorized', false);

        // Fuzzy plate verify must also be denied
        $fuzzyResponse = $this->postJson('/api/gate/verify', [
            'plate_number' => 'FUT2028',
            'direction' => 'IN',
        ]);
        $fuzzyResponse->assertStatus(200);
        $fuzzyResponse->assertJsonPath('authorized', false);

        // Must not appear in authorized plates whitelist
        $whitelist = GateService::getAuthorizedPlates();
        $this->assertArrayNotHasKey('FUT2026', $whitelist['plates']);
    }

    public function test_visitor_pass_for_past_date_cannot_enter(): void
    {
        $resident = User::create([
            'username' => 'test_resident_past',
            'first_name' => 'Lorenz',
            'last_name' => 'Luyahan',
            'role' => 'resident',
            'password' => bcrypt('password123'),
            'gender_id' => 1,
            'birth_date' => '1990-01-01',
            'age' => 36,
            'contact_number' => '09171112222',
            'address' => 'Block 5 Lot 10 Oakwood',
            'is_approved' => 1,
            'is_deleted' => 0,
        ]);

        $visitor = Visitor::create([
            'full_name' => 'Past Visitor',
            'contact_number' => '09123456780',
            'vehicle_plate' => 'PST 1010',
            'vehicle_type' => 'SUV',
        ]);

        VisitorRequest::create([
            'visitor_id' => $visitor->visitor_id,
            'resident_id' => $resident->user_id,
            'requested_by' => 'resident',
            'visit_date' => now()->subDay()->toDateString(),
            'visit_time' => '10:00 AM',
            'purpose' => 'Expired visit',
            'status' => 'APPROVED',
        ]);

        $response = $this->postJson('/api/gate/verify', [
            'plate_number' => 'PST1010',
            'direction' => 'IN',
        ]);
        $response->assertStatus(200);
        $response->assertJsonPath('authorized', false);

        $whitelist = GateService::getAuthorizedPlates();
        $this->assertArrayNotHasKey('PST1010', $whitelist['plates']);
    }

    public function test_guest_access_request_enforces_strict_date_range(): void
    {
        $resident = User::create([
            'username' => 'test_resident_guest_date',
            'first_name' => 'Lorenz',
            'last_name' => 'Luyahan',
            'role' => 'resident',
            'password' => bcrypt('password123'),
            'gender_id' => 1,
            'birth_date' => '1990-01-01',
            'age' => 36,
            'contact_number' => '09171112222',
            'address' => 'Block 5 Lot 10 Oakwood',
            'is_approved' => 1,
            'is_deleted' => 0,
        ]);

        // Future guest pass (tomorrow only) -> must be denied today
        UpdateRequest::create([
            'user_id' => $resident->user_id,
            'status' => 'approved',
            'requested_changes' => [
                'request_type' => 'guest_access',
                'guest_name' => 'Tomorrow Guest',
                'guest_plate_number' => 'GST 5555',
                'access_date' => now()->addDay()->toDateString(),
                'access_end_date' => now()->addDay()->toDateString(),
            ],
        ]);

        $futureRes = $this->postJson('/api/gate/verify', [
            'plate_number' => 'GST5555',
            'direction' => 'IN',
        ]);
        $futureRes->assertStatus(200);
        $futureRes->assertJsonPath('authorized', false);
        $this->assertArrayNotHasKey('GST5555', GateService::getAuthorizedPlates()['plates']);

        // Active multi-day guest pass (yesterday through tomorrow) -> must be allowed today
        UpdateRequest::create([
            'user_id' => $resident->user_id,
            'status' => 'approved',
            'requested_changes' => [
                'request_type' => 'guest_access',
                'guest_name' => 'Valid Guest',
                'guest_plate_number' => 'GST 7777',
                'access_date' => now()->subDay()->toDateString(),
                'access_end_date' => now()->addDay()->toDateString(),
            ],
        ]);

        $validRes = $this->postJson('/api/gate/verify', [
            'plate_number' => 'GST7777',
            'direction' => 'IN',
        ]);
        $validRes->assertStatus(200);
        $validRes->assertJsonPath('authorized', true);
        $this->assertArrayHasKey('GST7777', GateService::getAuthorizedPlates()['plates']);
    }

    public function test_resident_can_extend_visitor_duration_and_delete_pass_anytime(): void
    {
        $resident = User::create([
            'username' => 'test_resident_manage_pass',
            'first_name' => 'Lorenz',
            'last_name' => 'Luyahan',
            'role' => 'resident',
            'password' => bcrypt('password123'),
            'gender_id' => 1,
            'birth_date' => '1990-01-01',
            'age' => 36,
            'contact_number' => '09171112222',
            'address' => 'Block 5 Lot 10 Oakwood',
            'is_approved' => 1,
            'is_deleted' => 0,
        ]);

        $visitor = Visitor::create([
            'full_name' => 'Extended Visitor',
            'contact_number' => '09123456781',
            'vehicle_plate' => 'EXT 8888',
            'vehicle_type' => 'Sedan',
        ]);

        // Visit started yesterday; without extension it cannot enter today
        $vr = VisitorRequest::create([
            'visitor_id' => $visitor->visitor_id,
            'resident_id' => $resident->user_id,
            'requested_by' => 'resident',
            'visit_date' => now()->subDay()->toDateString(),
            'visit_time' => '10:00 AM',
            'purpose' => 'Stay',
            'status' => 'APPROVED',
        ]);

        $this->postJson('/api/gate/verify', [
            'plate_number' => 'EXT8888',
            'direction' => 'IN',
        ])->assertJsonPath('authorized', false);

        // Resident extends stay by 2 days -> covers today and tomorrow
        Sanctum::actingAs($resident);
        $extendRes = $this->putJson("/api/visitor/resident-extend/{$vr->request_id}", [
            'add_days' => 2,
        ]);
        $extendRes->assertStatus(200);
        $this->assertNotNull($extendRes->json('request.visit_end_date'));

        // Now visitor IS authorized today
        $this->postJson('/api/gate/verify', [
            'plate_number' => 'EXT8888',
            'direction' => 'IN',
        ])->assertJsonPath('authorized', true);
        $this->assertArrayHasKey('EXT8888', GateService::getAuthorizedPlates()['plates']);

        // Resident deletes the pass anytime -> immediately denied at gate
        $delRes = $this->deleteJson("/api/visitor/resident-delete/{$vr->request_id}");
        $delRes->assertStatus(200);

        $this->postJson('/api/gate/verify', [
            'plate_number' => 'EXT8888',
            'direction' => 'IN',
        ])->assertJsonPath('authorized', false);
        $this->assertArrayNotHasKey('EXT8888', GateService::getAuthorizedPlates()['plates']);
    }
}
