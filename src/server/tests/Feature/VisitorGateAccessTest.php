<?php

namespace Tests\Feature;

use App\Models\GateLog;
use App\Models\Notification;
use App\Models\SystemStatus;
use App\Models\User;
use App\Models\Visitor;
use App\Models\VisitorRequest;
use App\Services\GateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
}
