<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_users', function (Blueprint $table) {
            if (Schema::hasColumn('tbl_users', 'rfid_card_uid')) {
                try {
                    $table->dropUnique('tbl_users_rfid_card_uid_unique');
                } catch (\Throwable $e) {
                    // Ignore if index does not exist
                }
                $table->dropColumn('rfid_card_uid');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tbl_users', function (Blueprint $table) {
            $table->string('rfid_card_uid', 50)->nullable()->unique()->after('car_color');
        });
    }
};
