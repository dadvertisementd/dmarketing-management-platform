<?php

namespace App\Filament\Resources\Projects\Schemas;

use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class ProjectForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Select::make('client_id')
                    ->relationship('client', 'name')
                    ->required(),
                TextInput::make('manager_id')
                    ->numeric(),
                TextInput::make('name')
                    ->required(),
                TextInput::make('type')
                    ->required()
                    ->default('marketing'),
                TextInput::make('status')
                    ->required()
                    ->default('briefing'),
                TextInput::make('progress')
                    ->required()
                    ->numeric()
                    ->default(0),
                DatePicker::make('starts_at'),
                DatePicker::make('ends_at'),
                Textarea::make('description')
                    ->columnSpanFull(),
            ]);
    }
}
