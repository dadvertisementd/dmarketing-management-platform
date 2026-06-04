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
}
