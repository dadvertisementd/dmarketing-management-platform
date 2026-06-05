<?php

namespace Database\Seeders;

use App\Models\Client;
use App\Models\ClientPostingSchedule;
use App\Models\Integration;
use App\Models\Project;
use App\Models\SocialPost;
use App\Models\Task;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use RuntimeException;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $seedPassword = env('SEED_USER_PASSWORD', 'ChangeMe123!');

        if (app()->environment('production') && $seedPassword === 'ChangeMe123!') {
            throw new RuntimeException('Set SEED_USER_PASSWORD in production before running the database seeder.');
        }

        $admin = User::query()->create([
            'name' => 'DMARKETING Admin',
            'email' => env('SEED_ADMIN_EMAIL', 'admin@dmarketing.me'),
            'password' => $seedPassword,
            'role' => 'admin',
            'title' => 'Agency Director',
            'avatar_color' => '#0f172a',
        ]);

        $manager = User::query()->create([
            'name' => 'Account Manager',
            'email' => 'manager@dmarketing.me',
            'password' => $seedPassword,
            'role' => 'manager',
            'title' => 'Marketing Manager',
            'avatar_color' => '#ff6321',
        ]);

        $designer = User::query()->create([
            'name' => 'Graphic Designer',
            'email' => 'designer@dmarketing.me',
            'password' => $seedPassword,
            'role' => 'worker',
            'title' => 'Graphic Designer',
            'avatar_color' => '#7c3aed',
        ]);

        $clientUser = User::query()->create([
            'name' => 'Client Contact',
            'email' => 'client@example.com',
            'password' => $seedPassword,
            'role' => 'client',
            'title' => 'Marketing Contact',
            'avatar_color' => '#059669',
        ]);

        $client = Client::query()->create([
            'portal_user_id' => $clientUser->id,
            'name' => 'Example Retail Client',
            'industry' => 'Retail',
            'contact_name' => $clientUser->name,
            'contact_email' => $clientUser->email,
        ]);

        $project = Project::query()->create([
            'client_id' => $client->id,
            'manager_id' => $manager->id,
            'name' => 'Summer Campaign',
            'type' => 'social_media',
            'status' => 'in_progress',
            'progress' => 45,
            'starts_at' => now()->startOfMonth(),
            'ends_at' => now()->addMonth()->endOfMonth(),
            'description' => 'Monthly content plan, campaign graphics, publishing, and performance review.',
        ]);

        $project->users()->attach([
            $manager->id => ['role' => 'manager'],
            $designer->id => ['role' => 'contributor'],
        ]);

        Task::query()->create([
            'project_id' => $project->id,
            'client_id' => $client->id,
            'assigned_to' => $designer->id,
            'created_by' => $admin->id,
            'title' => 'Prepare Instagram carousel graphics',
            'status' => 'in_progress',
            'priority' => 'high',
            'due_at' => now()->addDays(3)->setTime(17, 0),
        ]);

        Task::query()->create([
            'project_id' => $project->id,
            'client_id' => $client->id,
            'assigned_to' => $manager->id,
            'created_by' => $admin->id,
            'title' => 'Review monthly performance report',
            'status' => 'todo',
            'priority' => 'normal',
            'due_at' => now()->addDays(7)->setTime(12, 0),
        ]);

        SocialPost::query()->create([
            'project_id' => $project->id,
            'client_id' => $client->id,
            'owner_id' => $manager->id,
            'platform' => 'instagram',
            'title' => 'Summer collection launch',
            'content' => 'A draft post ready for client review.',
            'status' => 'review',
            'scheduled_at' => now()->addDays(5)->setTime(10, 0),
        ]);

        foreach ([1, 3, 5] as $dayOfWeek) {
            ClientPostingSchedule::query()->create([
                'client_id' => $client->id,
                'day_of_week' => $dayOfWeek,
                'required_posts' => 1,
            ]);
        }

        foreach (['slack', 'asana', 'google_workspace'] as $provider) {
            Integration::query()->create(['provider' => $provider]);
        }

        $this->command?->warn('Seeded admin login: '.$admin->email.' / value from SEED_USER_PASSWORD. Change it after first login.');
    }
}
