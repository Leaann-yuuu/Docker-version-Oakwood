<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tbl_vehicles', function (Blueprint $table) {
            $table->id('vehicle_id');
            $table->unsignedBigInteger('user_id');
            $table->string('plate_number', 20);
            $table->string('car_model', 55);
            $table->string('car_color', 55);
            $table->boolean('is_primary')->default(false);
            $table->timestamps();

            $table->foreign('user_id')
                ->references('user_id')
                ->on('tbl_users')
                ->onDelete('cascade');

            $table->index(['user_id']);
            $table->index(['plate_number']);
        });

        // Migrate any existing resident vehicles from tbl_users into tbl_vehicles
        try {
            $users = DB::table('tbl_users')
                ->whereNotNull('plate_number')
                ->where('plate_number', '!=', '')
                ->get();

            foreach ($users as $user) {
                DB::table('tbl_vehicles')->insert([
                    'user_id' => $user->user_id,
                    'plate_number' => strtoupper(trim($user->plate_number)),
                    'car_model' => $user->car_model ?? 'Vehicle',
                    'car_color' => $user->car_color ?? 'N/A',
                    'is_primary' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        } catch (\Throwable $e) {
            // Ignore if already populated or empty
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_vehicles');
    }
};
