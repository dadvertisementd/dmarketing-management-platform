<?php

namespace App\Filament\Resources\Tasks\Schemas;

use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class TaskForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Select::make('project_id')
                    ->relationship('project', 'name'),
                TextInput::make('client_id')
                    ->numeric(),
                TextInput::make('assigned_to')
                    ->numeric(),
                TextInput::make('created_by')
                    ->numeric(),
                TextInput::make('title')
                    ->required(),
                Textarea::make('description')
                    ->columnSpanFull(),
                TextInput::make('status')
                    ->required()
                    ->default('todo'),
                TextInput::make('priority')
                    ->required()
                    ->default('normal'),
                DateTimePicker::make('due_at'),
                DateTimePicker::make('completed_at'),
            ]);
    }
}
