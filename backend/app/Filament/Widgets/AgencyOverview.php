<?php

namespace App\Filament\Widgets;

use App\Models\Client;
use App\Models\Project;
use App\Models\SocialPost;
use App\Models\Task;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class AgencyOverview extends StatsOverviewWidget
{
    protected function getStats(): array
    {
        return [
            Stat::make('Active projects', Project::where('status', '!=', 'completed')->count())
                ->description('Campaigns currently in motion'),
            Stat::make('Open tasks', Task::where('status', '!=', 'completed')->count())
                ->description('Work still requiring attention'),
            Stat::make('Scheduled posts', SocialPost::where('status', 'scheduled')->count())
                ->description('Content queued for publishing'),
            Stat::make('Active clients', Client::where('status', 'active')->count())
                ->description('Client accounts under management'),
        ];
    }
}
