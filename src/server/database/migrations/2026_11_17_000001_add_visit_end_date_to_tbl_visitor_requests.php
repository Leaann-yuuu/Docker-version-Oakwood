<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_visitor_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('tbl_visitor_requests', 'visit_end_date')) {
                $table->date('visit_end_date')->nullable()->after('visit_date');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tbl_visitor_requests', function (Blueprint $table) {
            if (Schema::hasColumn('tbl_visitor_requests', 'visit_end_date')) {
                $table->dropColumn('visit_end_date');
            }
        });
    }
};
