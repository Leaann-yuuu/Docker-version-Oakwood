<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Visitor extends Model
{
    use HasFactory;

    protected $table = 'tbl_visitors';
    protected $primaryKey = 'visitor_id';

    protected $fillable = [
        'full_name',
        'contact_number',
        'age',
        'address',
        'vehicle_plate',
        'vehicle_type',
        'car_model',
        'car_color',
    ];

    public function requests()
    {
        return $this->hasMany(VisitorRequest::class, 'visitor_id', 'visitor_id');
    }
}
