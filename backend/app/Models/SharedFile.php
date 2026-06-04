<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SharedFile extends Model
{
    protected $fillable = [
        'project_id',
        'client_id',
        'uploaded_by',
        'name',
        'category',
        'disk',
        'path',
        'mime_type',
        'size',
    ];
}
