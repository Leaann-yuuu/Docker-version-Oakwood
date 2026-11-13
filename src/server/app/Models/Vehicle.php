<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Vehicle extends Model
{
    use HasFactory;

    protected $table = 'tbl_vehicles';
    protected $primaryKey = 'vehicle_id';

    protected $fillable = [
        'user_id',
        'plate_number',
        'car_model',
        'car_color',
        'is_primary',
        'or_cr_image',
        'license_image',
        'status',
    ];

    protected $casts = [
        'is_primary' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }
}
