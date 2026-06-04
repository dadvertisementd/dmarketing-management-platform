<?php

namespace App\Filament\Resources\Users\Schemas;

use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;

class UserForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('name')
                    ->required(),
                TextInput::make('email')
                    ->label('Email address')
                    ->email()
                    ->unique(ignoreRecord: true)
                    ->required(),
                DateTimePicker::make('email_verified_at'),
                TextInput::make('password')
                    ->password()
                    ->revealable()
                    ->formatStateUsing(fn () => null)
                    ->required(fn (string $operation): bool => $operation === 'create')
                    ->dehydrated(fn (?string $state): bool => filled($state)),
                Select::make('role')
                    ->options([
                        'admin' => 'Admin',
                        'manager' => 'Manager',
                        'worker' => 'Worker',
                        'client' => 'Client',
                    ])
                    ->native(false)
                    ->required()
                    ->default('client'),
                TextInput::make('title'),
                TextInput::make('weekly_capacity')
                    ->required()
                    ->numeric()
                    ->minValue(0)
                    ->maxValue(168)
                    ->default(40),
                Toggle::make('is_active')
                    ->default(true)
                    ->required(),
            ]);
    }
}
