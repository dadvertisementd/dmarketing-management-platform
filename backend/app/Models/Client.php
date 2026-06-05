<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Client extends Model
{
    protected $fillable = ['portal_user_id', 'name', 'industry', 'contact_name', 'contact_email', 'status'];

    public function postingSchedules(): HasMany
    {
        return $this->hasMany(ClientPostingSchedule::class);
    }

    public function postingChecks(): HasMany
    {
        return $this->hasMany(PostingCheck::class);
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }

    public function socialPosts(): HasMany
    {
        return $this->hasMany(SocialPost::class);
    }

    public function sharedFiles(): HasMany
    {
        return $this->hasMany(SharedFile::class);
    }
}
