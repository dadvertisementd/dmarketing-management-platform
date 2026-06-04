<?php

namespace App\Filament\Resources\SharedFiles\Pages;

use App\Filament\Resources\SharedFiles\SharedFileResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListSharedFiles extends ListRecords
{
    protected static string $resource = SharedFileResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
        ];
    }
}
