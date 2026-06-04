<?php

namespace App\Filament\Resources\Integrations\Schemas;

use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\KeyValue;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class IntegrationForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('provider')
                    ->required(),
                Select::make('status')
                    ->options([
                        'not_connected' => 'Not connected',
                        'connected' => 'Connected',
                        'needs_attention' => 'Needs attention',
                        'disabled' => 'Disabled',
                    ])
                    ->native(false)
                    ->required()
                    ->default('not_connected'),
                KeyValue::make('configuration')
                    ->keyLabel('Setting')
                    ->valueLabel('Secret / value')
                    ->addButtonLabel('Add setting')
                    ->columnSpanFull(),
                DateTimePicker::make('last_synced_at'),
            ]);
    }
}
