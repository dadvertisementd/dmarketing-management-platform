<?php

namespace App\Filament\Resources\SharedFiles\Schemas;

use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class SharedFileForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('project_id')
                    ->numeric(),
                TextInput::make('client_id')
                    ->required()
                    ->numeric(),
                TextInput::make('uploaded_by')
                    ->numeric(),
                TextInput::make('name')
                    ->required(),
                TextInput::make('category')
                    ->required()
                    ->default('asset'),
                TextInput::make('disk')
                    ->required()
                    ->default('local'),
                TextInput::make('path')
                    ->required(),
                TextInput::make('mime_type'),
                TextInput::make('size')
                    ->required()
                    ->numeric()
                    ->default(0),
            ]);
    }
}
