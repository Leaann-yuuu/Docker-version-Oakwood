<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_vehicles', function (Blueprint $table) {
            if (!Schema::hasColumn('tbl_vehicles', 'or_cr_image')) {
                $table->string('or_cr_image', 255)->nullable()->after('is_primary');
            }
            if (!Schema::hasColumn('tbl_vehicles', 'license_image')) {
                $table->string('license_image', 255)->nullable()->after('or_cr_image');
            }
            if (!Schema::hasColumn('tbl_vehicles', 'status')) {
                $table->string('status', 25)->default('approved')->after('license_image'); // pending, approved, rejected
            }
        });
    }

    public function down(): void
    {
        Schema::table('tbl_vehicles', function (Blueprint $table) {
            $table->dropColumn(['or_cr_image', 'license_image', 'status']);
        });
    }
};
