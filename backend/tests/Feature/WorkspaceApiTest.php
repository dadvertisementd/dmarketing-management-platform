<?php

namespace Tests\Feature;

use App\Events\ChatMessageCreated;
use App\Models\Client;
use App\Models\ClientPostingSchedule;
use App\Models\Integration;
use App\Models\PostingCheck;
use App\Models\Project;
use App\Models\SharedFile;
use App\Models\SocialPost;
use App\Models\Task;
use App\Models\TaskAttachment;
use App\Models\TaskComment;
use App\Models\TaskSubtask;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class WorkspaceApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_worker_cannot_create_tasks(): void
    {
        $worker = User::factory()->create(['role' => 'worker']);

        $this->actingAs($worker)
            ->postJson('/api/tasks', [
                'title' => 'Should not be accepted',
                'priority' => 'normal',
            ])
            ->assertForbidden();
    }

    public function test_created_task_response_includes_status_and_priority_defaults(): void
    {
        $manager = User::factory()->create(['role' => 'manager', 'is_active' => true]);
        $client = Client::create(['name' => 'Client One']);

        $this->actingAs($manager)
            ->postJson('/api/tasks', [
                'client_id' => $client->id,
                'title' => 'Create launch checklist',
                'priority' => 'normal',
            ])
            ->assertCreated()
            ->assertJsonPath('status', 'todo')
            ->assertJsonPath('priority', 'normal');
    }

    public function test_manager_can_create_task_with_attachments(): void
    {
        Storage::fake('local');
        $manager = User::factory()->create(['role' => 'manager', 'is_active' => true]);
        $client = Client::create(['name' => 'Client One']);

        $response = $this->actingAs($manager)
            ->post('/api/tasks', [
                'client_id' => $client->id,
                'title' => 'Prepare ad creative',
                'priority' => 'high',
                'attachments' => [
                    UploadedFile::fake()->create('creative-brief.pdf', 120, 'application/pdf'),
                ],
            ]);

        $response
            ->assertCreated()
            ->assertJsonCount(1, 'attachments')
            ->assertJsonPath('attachments.0.name', 'creative-brief.pdf');

        $attachment = TaskAttachment::firstOrFail();
        Storage::disk('local')->assertExists($attachment->path);
    }

    public function test_task_attachment_download_requires_task_access(): void
    {
        Storage::fake('local');
        $manager = User::factory()->create(['role' => 'manager', 'is_active' => true]);
        $clientUser = User::factory()->create(['role' => 'client']);
        $otherClientUser = User::factory()->create(['role' => 'client']);
        $client = Client::create(['portal_user_id' => $clientUser->id, 'name' => 'Client One']);
        Client::create(['portal_user_id' => $otherClientUser->id, 'name' => 'Client Two']);

        $task = Task::create(['client_id' => $client->id, 'title' => 'Visible Task', 'priority' => 'normal']);
        Storage::disk('local')->put('task-attachments/test-file.txt', 'brief');
        $attachment = TaskAttachment::create([
            'task_id' => $task->id,
            'uploaded_by' => $manager->id,
            'name' => 'test-file.txt',
            'disk' => 'local',
            'path' => 'task-attachments/test-file.txt',
            'mime_type' => 'text/plain',
            'size' => 5,
        ]);

        $this->actingAs($clientUser)
            ->get("/api/tasks/{$task->id}/attachments/{$attachment->id}/download")
            ->assertOk();

        $this->actingAs($otherClientUser)
            ->get("/api/tasks/{$task->id}/attachments/{$attachment->id}/download")
            ->assertForbidden();
    }

    public function test_user_with_task_access_can_add_attachment_to_existing_task(): void
    {
        Storage::fake('local');
        $worker = User::factory()->create(['role' => 'worker', 'is_active' => true]);
        $client = Client::create(['name' => 'Client One']);
        $task = Task::create([
            'client_id' => $client->id,
            'assigned_to' => $worker->id,
            'title' => 'Review website copy',
            'priority' => 'normal',
        ]);

        $response = $this->actingAs($worker)
            ->post("/api/tasks/{$task->id}/attachments", [
                'attachments' => [
                    UploadedFile::fake()->create('homepage-copy.docx', 80, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
                ],
            ]);

        $response
            ->assertCreated()
            ->assertJsonCount(1)
            ->assertJsonPath('0.name', 'homepage-copy.docx');

        $attachment = TaskAttachment::firstOrFail();
        Storage::disk('local')->assertExists($attachment->path);
    }

    public function test_task_response_includes_subtasks_comments_and_attachments(): void
    {
        $manager = User::factory()->create(['role' => 'manager', 'is_active' => true]);
        $client = Client::create(['name' => 'Client One']);
        $task = Task::create(['client_id' => $client->id, 'title' => 'Launch checklist', 'priority' => 'normal']);
        TaskSubtask::create(['task_id' => $task->id, 'created_by' => $manager->id, 'title' => 'Draft copy']);
        TaskComment::create(['task_id' => $task->id, 'user_id' => $manager->id, 'body' => 'Use the approved brand voice.']);

        $this->actingAs($manager)
            ->getJson('/api/tasks')
            ->assertOk()
            ->assertJsonPath('0.subtasks.0.title', 'Draft copy')
            ->assertJsonPath('0.comments.0.body', 'Use the approved brand voice.')
            ->assertJsonPath('0.comments.0.user.name', $manager->name);
    }

    public function test_user_with_task_access_can_manage_subtasks_and_comments(): void
    {
        $worker = User::factory()->create(['role' => 'worker', 'is_active' => true]);
        $client = Client::create(['name' => 'Client One']);
        $task = Task::create([
            'client_id' => $client->id,
            'assigned_to' => $worker->id,
            'title' => 'Prepare reels package',
            'priority' => 'normal',
        ]);

        $subtaskResponse = $this->actingAs($worker)
            ->postJson("/api/tasks/{$task->id}/subtasks", ['title' => 'Export 9:16 version'])
            ->assertCreated()
            ->assertJsonPath('title', 'Export 9:16 version');

        $subtaskId = $subtaskResponse->json('id');

        $this->actingAs($worker)
            ->patchJson("/api/tasks/{$task->id}/subtasks/{$subtaskId}", ['is_completed' => true])
            ->assertOk()
            ->assertJsonPath('is_completed', true);

        $this->actingAs($worker)
            ->postJson("/api/tasks/{$task->id}/comments", ['body' => 'First export is ready for review.'])
            ->assertCreated()
            ->assertJsonPath('body', 'First export is ready for review.')
            ->assertJsonPath('user.id', $worker->id);
    }

    public function test_admin_can_create_team_member(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        $this->actingAs($admin)
            ->postJson('/api/users', [
                'name' => 'New Designer',
                'email' => 'designer.new@example.com',
                'password' => 'ChangeMe123!',
                'role' => 'worker',
                'title' => 'Graphic Designer',
                'weekly_capacity' => 35,
                'avatar_color' => '#2563eb',
            ])
            ->assertCreated()
            ->assertJsonPath('name', 'New Designer')
            ->assertJsonPath('role', 'worker')
            ->assertJsonPath('avatar_color', '#2563eb')
            ->assertJsonMissingPath('password');

        $this->assertDatabaseHas('users', [
            'email' => 'designer.new@example.com',
            'role' => 'worker',
            'title' => 'Graphic Designer',
            'avatar_color' => '#2563eb',
        ]);
    }

    public function test_admin_can_delete_team_member(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $worker = User::factory()->create(['role' => 'worker', 'is_active' => true]);

        $this->actingAs($admin)
            ->deleteJson("/api/users/{$worker->id}")
            ->assertOk()
            ->assertJsonPath('message', 'User deleted.');

        $this->assertDatabaseMissing('users', ['id' => $worker->id]);
    }

    public function test_admin_cannot_delete_their_own_account(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        $this->actingAs($admin)
            ->deleteJson("/api/users/{$admin->id}")
            ->assertUnprocessable();

        $this->assertDatabaseHas('users', ['id' => $admin->id]);
    }

    public function test_admin_can_delete_inactive_admin_account(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $inactiveAdmin = User::factory()->create(['role' => 'admin', 'is_active' => false]);

        $this->actingAs($admin)
            ->deleteJson("/api/users/{$inactiveAdmin->id}")
            ->assertOk();

        $this->assertDatabaseMissing('users', ['id' => $inactiveAdmin->id]);
    }

    public function test_client_only_sees_their_own_tasks(): void
    {
        $clientUser = User::factory()->create(['role' => 'client']);
        $otherUser = User::factory()->create(['role' => 'client']);
        $client = Client::create(['portal_user_id' => $clientUser->id, 'name' => 'Client One']);
        $otherClient = Client::create(['portal_user_id' => $otherUser->id, 'name' => 'Client Two']);
        $visibleTask = Task::create(['client_id' => $client->id, 'title' => 'Visible', 'priority' => 'normal']);
        Task::create(['client_id' => $otherClient->id, 'title' => 'Hidden', 'priority' => 'normal']);

        $this->actingAs($clientUser)
            ->getJson('/api/tasks')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $visibleTask->id);
    }

    public function test_projects_workspace_returns_combined_visible_data(): void
    {
        $manager = User::factory()->create(['role' => 'manager', 'is_active' => true]);
        $client = Client::create(['name' => 'Client One']);
        $project = Project::create(['client_id' => $client->id, 'manager_id' => $manager->id, 'name' => 'Visible Project']);
        $task = Task::create(['project_id' => $project->id, 'client_id' => $client->id, 'title' => 'Visible Task', 'priority' => 'normal']);

        $this->actingAs($manager)
            ->getJson('/api/projects-workspace')
            ->assertOk()
            ->assertJsonPath('projects.0.id', $project->id)
            ->assertJsonPath('clients.0.id', $client->id)
            ->assertJsonPath('tasks.0.id', $task->id)
            ->assertJsonPath('team.0.id', $manager->id);
    }

    public function test_manager_can_create_client(): void
    {
        $manager = User::factory()->create(['role' => 'manager', 'is_active' => true]);

        $this->actingAs($manager)
            ->postJson('/api/clients', [
                'name' => 'Vatra Residence',
                'industry' => 'Construction',
                'contact_name' => 'Client Contact',
                'contact_email' => 'client@example.com',
                'status' => 'onboarding',
            ])
            ->assertCreated()
            ->assertJsonPath('name', 'Vatra Residence')
            ->assertJsonPath('status', 'onboarding');

        $this->assertDatabaseHas('clients', [
            'name' => 'Vatra Residence',
            'industry' => 'Construction',
        ]);
    }

    public function test_client_with_linked_work_cannot_be_deleted(): void
    {
        $manager = User::factory()->create(['role' => 'manager', 'is_active' => true]);
        $client = Client::create(['name' => 'Client With Work']);
        Project::create(['client_id' => $client->id, 'name' => 'Ongoing Social Media']);

        $this->actingAs($manager)
            ->deleteJson("/api/clients/{$client->id}")
            ->assertUnprocessable();

        $this->assertDatabaseHas('clients', ['id' => $client->id]);
    }

    public function test_manager_can_assign_multiple_team_members_to_project(): void
    {
        $manager = User::factory()->create(['role' => 'manager', 'is_active' => true]);
        $designer = User::factory()->create(['role' => 'worker', 'title' => 'Graphic Designer', 'is_active' => true]);
        $developer = User::factory()->create(['role' => 'worker', 'title' => 'Developer', 'is_active' => true]);
        $client = Client::create(['name' => 'Vatra Residence']);

        $this->actingAs($manager)
            ->postJson('/api/projects', [
                'client_id' => $client->id,
                'name' => 'Ongoing Social Media Management',
                'type' => 'ongoing_social_media',
                'status' => 'active',
                'member_ids' => [$designer->id, $developer->id],
            ])
            ->assertCreated()
            ->assertJsonPath('name', 'Ongoing Social Media Management')
            ->assertJsonCount(3, 'users');

        $this->assertDatabaseHas('project_user', ['user_id' => $manager->id]);
        $this->assertDatabaseHas('project_user', ['user_id' => $designer->id]);
        $this->assertDatabaseHas('project_user', ['user_id' => $developer->id]);
    }

    public function test_chat_message_dispatches_realtime_event(): void
    {
        Event::fake([ChatMessageCreated::class]);
        $manager = User::factory()->create(['role' => 'manager', 'is_active' => true]);
        $client = Client::create(['name' => 'Client']);
        $project = Project::create(['client_id' => $client->id, 'name' => 'Project']);

        $this->actingAs($manager)
            ->postJson('/api/chat-messages', [
                'client_id' => $client->id,
                'project_id' => $project->id,
                'message' => 'Campaign artwork is ready for review.',
            ])
            ->assertCreated();

        Event::assertDispatched(ChatMessageCreated::class);
    }

    public function test_manager_can_send_social_post_to_client_review(): void
    {
        $manager = User::factory()->create(['role' => 'manager', 'is_active' => true]);
        $client = Client::create(['name' => 'Client']);
        $post = SocialPost::create([
            'client_id' => $client->id,
            'platform' => 'instagram',
            'title' => 'Campaign draft',
            'status' => 'draft',
        ]);

        $this->actingAs($manager)
            ->patchJson("/api/social-posts/{$post->id}", [
                'status' => 'pending_client_review',
            ])
            ->assertOk()
            ->assertJsonPath('status', 'pending_client_review');

        $this->assertDatabaseHas('social_posts', [
            'id' => $post->id,
            'status' => 'pending_client_review',
        ]);
    }

    public function test_manager_can_request_social_post_revision(): void
    {
        $manager = User::factory()->create(['role' => 'manager', 'is_active' => true]);
        $client = Client::create(['name' => 'Client']);
        $post = SocialPost::create([
            'client_id' => $client->id,
            'platform' => 'instagram',
            'title' => 'Campaign draft',
            'status' => 'review',
        ]);

        $this->actingAs($manager)
            ->patchJson("/api/social-posts/{$post->id}", [
                'status' => 'needs_revision',
            ])
            ->assertOk()
            ->assertJsonPath('status', 'needs_revision');

        $this->assertDatabaseHas('social_posts', [
            'id' => $post->id,
            'status' => 'needs_revision',
        ]);
    }

    public function test_client_cannot_post_chat_message_to_another_client(): void
    {
        Event::fake([ChatMessageCreated::class]);
        $clientUser = User::factory()->create(['role' => 'client']);
        Client::create(['portal_user_id' => $clientUser->id, 'name' => 'Client One']);
        $otherClient = Client::create(['name' => 'Client Two']);

        $this->actingAs($clientUser)
            ->postJson('/api/chat-messages', [
                'client_id' => $otherClient->id,
                'message' => 'I should not be able to send this.',
            ])
            ->assertForbidden();

        Event::assertNotDispatched(ChatMessageCreated::class);
    }

    public function test_chat_message_rejects_mismatched_project_and_client(): void
    {
        $manager = User::factory()->create(['role' => 'manager', 'is_active' => true]);
        $client = Client::create(['name' => 'Client One']);
        $otherClient = Client::create(['name' => 'Client Two']);
        $project = Project::create(['client_id' => $client->id, 'name' => 'Project']);

        $this->actingAs($manager)
            ->postJson('/api/chat-messages', [
                'client_id' => $otherClient->id,
                'project_id' => $project->id,
                'message' => 'Mismatched records should fail.',
            ])
            ->assertUnprocessable();
    }

    public function test_worker_only_sees_projects_they_are_assigned_to(): void
    {
        $worker = User::factory()->create(['role' => 'worker']);
        $client = Client::create(['name' => 'Client']);
        $visibleProject = Project::create(['client_id' => $client->id, 'name' => 'Visible Project']);
        Project::create(['client_id' => $client->id, 'name' => 'Hidden Project']);
        $visibleProject->users()->attach($worker->id, ['role' => 'contributor']);

        $this->actingAs($worker)
            ->getJson('/api/projects')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $visibleProject->id);
    }

    public function test_client_cannot_upload_files_to_another_client(): void
    {
        Storage::fake('local');
        $clientUser = User::factory()->create(['role' => 'client']);
        Client::create(['portal_user_id' => $clientUser->id, 'name' => 'Client One']);
        $otherClient = Client::create(['name' => 'Client Two']);

        $this->actingAs($clientUser)
            ->postJson('/api/files', [
                'client_id' => $otherClient->id,
                'file' => UploadedFile::fake()->create('campaign.pdf', 100, 'application/pdf'),
            ])
            ->assertForbidden();
    }

    public function test_user_can_download_accessible_vault_file(): void
    {
        Storage::fake('local');
        $manager = User::factory()->create(['role' => 'manager', 'is_active' => true]);
        $client = Client::create(['name' => 'Client One']);

        Storage::disk('local')->put('shared-files/logo.png', 'logo-bytes');

        $file = SharedFile::create([
            'client_id' => $client->id,
            'uploaded_by' => $manager->id,
            'name' => 'logo.png',
            'category' => 'logos',
            'disk' => 'local',
            'path' => 'shared-files/logo.png',
            'mime_type' => 'image/png',
            'size' => 10,
        ]);

        $this->actingAs($manager)
            ->get("/api/files/{$file->id}/download")
            ->assertOk();
    }

    public function test_integrations_endpoint_does_not_expose_secret_configuration(): void
    {
        $manager = User::factory()->create(['role' => 'manager', 'is_active' => true]);

        Integration::create([
            'provider' => 'secret_test_provider',
            'status' => 'connected',
            'configuration' => ['bot_token' => 'xoxb-secret-token'],
        ]);

        $this->actingAs($manager)
            ->getJson('/api/integrations')
            ->assertOk()
            ->assertJsonMissing(['configuration' => ['bot_token' => 'xoxb-secret-token']])
            ->assertJsonMissingPath('0.configuration');
    }

    public function test_weekly_posting_tracker_combines_schedule_posts_and_manual_checks(): void
    {
        $manager = User::factory()->create(['role' => 'manager', 'is_active' => true]);
        $client = Client::create(['name' => 'D Marketing']);

        ClientPostingSchedule::create(['client_id' => $client->id, 'day_of_week' => 1]);
        ClientPostingSchedule::create(['client_id' => $client->id, 'day_of_week' => 3]);
        ClientPostingSchedule::create(['client_id' => $client->id, 'day_of_week' => 5]);
        SocialPost::create([
            'client_id' => $client->id,
            'platform' => 'instagram',
            'title' => 'Monday launch',
            'status' => 'published',
            'published_at' => '2026-01-05 12:00:00',
        ]);
        PostingCheck::create([
            'client_id' => $client->id,
            'post_date' => '2026-01-09',
            'status' => 'skipped',
            'checked_by' => $manager->id,
        ]);

        $this->actingAs($manager)
            ->getJson('/api/posting-tracker?week_start=2026-01-05')
            ->assertOk()
            ->assertJsonPath('clients.0.name', 'D Marketing')
            ->assertJsonPath('clients.0.days.0.status', 'posted')
            ->assertJsonPath('clients.0.days.2.status', 'missed')
            ->assertJsonPath('clients.0.days.4.status', 'skipped')
            ->assertJsonPath('clients.0.days.6.status', 'not_planned');
    }

    public function test_manager_can_update_client_posting_schedule(): void
    {
        $manager = User::factory()->create(['role' => 'manager', 'is_active' => true]);
        $client = Client::create(['name' => 'D Marketing']);
        ClientPostingSchedule::create(['client_id' => $client->id, 'day_of_week' => 1]);

        $this->actingAs($manager)
            ->putJson("/api/clients/{$client->id}/posting-schedule", [
                'days' => [
                    ['day_of_week' => 2, 'required_posts' => 1],
                    ['day_of_week' => 4, 'required_posts' => 1],
                ],
            ])
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonPath('0.day_of_week', 2)
            ->assertJsonPath('1.day_of_week', 4);

        $this->assertDatabaseHas('client_posting_schedules', ['client_id' => $client->id, 'day_of_week' => 1, 'is_active' => false]);
    }
}
