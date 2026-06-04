<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PostingCheck extends Model
{
    protected $fillable = ['client_id', 'post_date', 'status', 'note', 'checked_by'];

    protected function casts(): array
    {
        return ['post_date' => 'date'];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
