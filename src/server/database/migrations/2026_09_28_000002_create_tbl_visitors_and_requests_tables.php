<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tbl_visitors', function (Blueprint $table) {
            $table->id('visitor_id');
            $table->string('full_name', 150);
            $table->string('contact_number', 30);
            $table->string('vehicle_plate', 30)->nullable();
            $table->string('vehicle_type', 50)->nullable();
            $table->timestamps();
        });

        Schema::create('tbl_visitor_requests', function (Blueprint $table) {
            $table->id('request_id');
            $table->unsignedBigInteger('visitor_id');
            $table->unsignedBigInteger('resident_id');
            $table->unsignedBigInteger('guard_id')->nullable();
            $table->enum('requested_by', ['resident', 'guard'])->default('resident');
            $table->date('visit_date');
            $table->string('visit_time', 30);
            $table->string('purpose', 255);
            $table->enum('status', [
                'PENDING',
                'APPROVED',
                'DENIED',
                'CONFIRMED',
                'REJECTED',
                'COMPLETED',
                'CANCELLED'
            ])->default('PENDING');
            $table->text('notes')->nullable();
            $table->text('guard_remarks')->nullable();
            $table->timestamps();

            $table->foreign('visitor_id')
                ->references('visitor_id')
                ->on('tbl_visitors')
                ->onDelete('cascade');

            $table->foreign('resident_id')
                ->references('user_id')
                ->on('tbl_users')
                ->onDelete('cascade');

            $table->foreign('guard_id')
                ->references('user_id')
                ->on('tbl_users')
                ->onDelete('set null');
        });

        Schema::table('tbl_notifications', function (Blueprint $table) {
            $table->unsignedBigInteger('request_id')->nullable()->after('user_id');

            $table->foreign('request_id')
                ->references('request_id')
                ->on('tbl_visitor_requests')
                ->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('tbl_notifications', function (Blueprint $table) {
            $table->dropForeign(['request_id']);
            $table->dropColumn('request_id');
        });

        Schema::dropIfExists('tbl_visitor_requests');
        Schema::dropIfExists('tbl_visitors');
    }
};
