<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Add extra guest profile fields to tbl_visitors if not present
        Schema::table('tbl_visitors', function (Blueprint $table) {
            if (!Schema::hasColumn('tbl_visitors', 'age')) {
                $table->unsignedSmallInteger('age')->nullable()->after('contact_number');
            }
            if (!Schema::hasColumn('tbl_visitors', 'address')) {
                $table->string('address', 255)->nullable()->after('age');
            }
            if (!Schema::hasColumn('tbl_visitors', 'car_model')) {
                $table->string('car_model', 55)->nullable()->after('vehicle_type');
            }
            if (!Schema::hasColumn('tbl_visitors', 'car_color')) {
                $table->string('car_color', 55)->nullable()->after('car_model');
            }
        });

        // 2. Migrate / merge data from tbl_guest and tbl_guest_request into tbl_visitors and tbl_visitor_requests
        if (Schema::hasTable('tbl_guest')) {
            $guestToVisitorMap = [];
            $guests = DB::table('tbl_guest')->get();

            foreach ($guests as $guest) {
                // Find matching visitor by vehicle_plate (if present) or by full_name
                $matchedVisitor = null;
                if (!empty($guest->vehicle_plate)) {
                    $matchedVisitor = DB::table('tbl_visitors')
                        ->where('vehicle_plate', $guest->vehicle_plate)
                        ->first();
                }

                if (!$matchedVisitor) {
                    $matchedVisitor = DB::table('tbl_visitors')
                        ->where('full_name', $guest->full_name)
                        ->first();
                }

                if ($matchedVisitor) {
                    // Update existing visitor record with guest-specific fields
                    DB::table('tbl_visitors')
                        ->where('visitor_id', $matchedVisitor->visitor_id)
                        ->update([
                            'age' => $guest->age ?? $matchedVisitor->age ?? null,
                            'address' => $guest->address ?? $matchedVisitor->address ?? null,
                            'car_model' => $guest->car_model ?? $matchedVisitor->car_model ?? null,
                            'car_color' => $guest->car_color ?? $matchedVisitor->car_color ?? null,
                            'vehicle_type' => $matchedVisitor->vehicle_type ?: $guest->vehicle_type,
                            'updated_at' => now(),
                        ]);

                    $guestToVisitorMap[$guest->guest_id] = $matchedVisitor->visitor_id;
                } else {
                    // Insert as new visitor in tbl_visitors
                    $newVisitorId = DB::table('tbl_visitors')->insertGetId([
                        'full_name' => $guest->full_name,
                        'contact_number' => $guest->contact_number ?: 'N/A',
                        'age' => $guest->age,
                        'address' => $guest->address,
                        'vehicle_plate' => $guest->vehicle_plate,
                        'vehicle_type' => $guest->vehicle_type ?: 'Vehicle',
                        'car_model' => $guest->car_model,
                        'car_color' => $guest->car_color,
                        'created_at' => $guest->created_at ?: now(),
                        'updated_at' => $guest->updated_at ?: now(),
                    ]);

                    $guestToVisitorMap[$guest->guest_id] = $newVisitorId;
                }
            }

            // 3. Migrate any guest requests from tbl_guest_request into tbl_visitor_requests
            if (Schema::hasTable('tbl_guest_request')) {
                $guestRequests = DB::table('tbl_guest_request')->get();

                foreach ($guestRequests as $gr) {
                    $visitorId = $guestToVisitorMap[$gr->guest_id] ?? null;
                    if (!$visitorId) {
                        continue;
                    }

                    // Check if already present in tbl_visitor_requests
                    $exists = DB::table('tbl_visitor_requests')
                        ->where('visitor_id', $visitorId)
                        ->where('resident_id', $gr->resident_id)
                        ->where('visit_date', $gr->access_date)
                        ->exists();

                    if (!$exists) {
                        $allowedStatuses = ['PENDING', 'APPROVED', 'DENIED', 'CONFIRMED', 'REJECTED', 'COMPLETED', 'CANCELLED'];
                        $status = in_array(strtoupper($gr->status), $allowedStatuses) ? strtoupper($gr->status) : 'PENDING';

                        DB::table('tbl_visitor_requests')->insert([
                            'visitor_id' => $visitorId,
                            'resident_id' => $gr->resident_id,
                            'guard_id' => $gr->guard_id,
                            'requested_by' => 'resident',
                            'visit_date' => $gr->access_date,
                            'visit_time' => $gr->visit_time ?: '10:00 AM',
                            'purpose' => $gr->access_reason ?: 'Guest visit',
                            'status' => $status,
                            'notes' => $gr->notes,
                            'guard_remarks' => $gr->guard_remarks,
                            'created_at' => $gr->created_at ?: now(),
                            'updated_at' => $gr->updated_at ?: now(),
                        ]);
                    }
                }
            }
        }

        // 4. Drop the guest / guest access tables from MySQL
        Schema::dropIfExists('tbl_guest_request');
        Schema::dropIfExists('tbl_guest');
    }

    public function down(): void
    {
        // Drop added columns if rolling back
        Schema::table('tbl_visitors', function (Blueprint $table) {
            $table->dropColumn(['age', 'address', 'car_model', 'car_color']);
        });
    }
};
