<?php

namespace App\Filament\Resources\SharedFiles\Pages;

use App\Filament\Resources\SharedFiles\SharedFileResource;
use Filament\Resources\Pages\CreateRecord;

class CreateSharedFile extends CreateRecord
{
    protected static string $resource = SharedFileResource::class;
}
