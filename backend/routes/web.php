<?php

use App\Http\Controllers\Api\AuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    if (file_exists(public_path('index.html'))) {
        return response()->file(public_path('index.html'));
    }

    return response()->json([
        'name' => 'DMARKETING API',
        'status' => 'ready',
        'admin' => url('/admin'),
    ]);
});

Route::post('/login', [AuthController::class, 'login'])->middleware(['guest', 'throttle:login'])->name('login');
Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth')->name('logout');

Route::get('/{path}', function () {
    abort_unless(file_exists(public_path('index.html')), 404);

    return response()->file(public_path('index.html'));
})->where('path', '^(?!api|admin|sanctum|storage).*$');
