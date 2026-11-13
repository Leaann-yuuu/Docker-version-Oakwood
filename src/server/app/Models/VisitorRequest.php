<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class VisitorRequest extends Model
{
    use HasFactory;

    protected $table = 'tbl_visitor_requests';
    protected $primaryKey = 'request_id';

    protected $fillable = [
        'visitor_id',
        'resident_id',
        'guard_id',
        'requested_by',
        'visit_date',
        'visit_time',
        'purpose',
        'status',
        'notes',
        'guard_remarks',
    ];

    protected $appends = ['guard'];

    public function visitor()
    {
        return $this->belongsTo(Visitor::class, 'visitor_id', 'visitor_id');
    }

    public function resident()
    {
        return $this->belongsTo(User::class, 'resident_id', 'user_id');
    }

    public function securityGuard()
    {
        return $this->belongsTo(User::class, 'guard_id', 'user_id');
    }

    public function getGuardAttribute()
    {
        return $this->relationLoaded('securityGuard') ? $this->securityGuard : $this->securityGuard()->first();
    }

    public function notifications()
    {
        return $this->hasMany(Notification::class, 'request_id', 'request_id');
    }
}
