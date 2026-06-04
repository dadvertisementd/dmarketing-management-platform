<?php

namespace App\Filament\Resources\SharedFiles;

use App\Filament\Resources\SharedFiles\Pages\CreateSharedFile;
use App\Filament\Resources\SharedFiles\Pages\EditSharedFile;
use App\Filament\Resources\SharedFiles\Pages\ListSharedFiles;
use App\Filament\Resources\SharedFiles\Schemas\SharedFileForm;
use App\Filament\Resources\SharedFiles\Tables\SharedFilesTable;
use App\Models\SharedFile;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

class SharedFileResource extends Resource
{
    protected static ?string $model = SharedFile::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    public static function form(Schema $schema): Schema
    {
        return SharedFileForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return SharedFilesTable::configure($table);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListSharedFiles::route('/'),
            'create' => CreateSharedFile::route('/create'),
            'edit' => EditSharedFile::route('/{record}/edit'),
        ];
    }
}
