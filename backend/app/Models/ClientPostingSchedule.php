<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientPostingSchedule extends Model
{
    protected $fillable = ['client_id', 'day_of_week', 'required_posts', 'is_active'];

    protected function casts(): array
    {
        return [
            'day_of_week' => 'integer',
            'required_posts' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
