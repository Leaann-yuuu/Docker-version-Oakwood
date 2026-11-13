<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Deprecated: tbl_guest and tbl_guest_request have been merged into tbl_visitors and tbl_visitor_requests.
     */
    public function up(): void
    {
        // No-op: Guest tables merged into tbl_visitors and tbl_visitor_requests
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op
    }
};
