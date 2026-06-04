<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Integration extends Model
{
    protected $fillable = ['provider', 'status', 'configuration', 'last_synced_at'];

    protected $hidden = ['configuration'];

    protected function casts(): array
    {
        return ['configuration' => 'encrypted:array', 'last_synced_at' => 'datetime'];
    }
}
