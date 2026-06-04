<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SocialPost extends Model
{
    protected $fillable = ['project_id', 'client_id', 'owner_id', 'platform', 'title', 'content', 'status', 'scheduled_at', 'published_at'];

    protected function casts(): array
    {
        return ['scheduled_at' => 'datetime', 'published_at' => 'datetime'];
    }
}
