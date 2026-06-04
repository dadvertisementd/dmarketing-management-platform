<?php

use App\Models\Client;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('chat.client.{clientId}', function ($user, $clientId) {
    return $user->isAgencyMember()
        || Client::whereKey($clientId)->where('portal_user_id', $user->id)->exists();
});
