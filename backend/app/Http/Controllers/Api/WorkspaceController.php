<?php

namespace App\Http\Controllers\Api;

use App\Events\ChatMessageCreated;
use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
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
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class WorkspaceController extends Controller
{
    public function dashboard(Request $request): JsonResponse
    {
        $tasks = $this->visibleTasks($request);
        $projects = $this->visibleProjects($request);

        return response()->json([
            'stats' => [
                'activeProjects' => (clone $projects)->where('status', '!=', 'completed')->count(),
                'openTasks' => (clone $tasks)->where('status', '!=', 'completed')->count(),
                'completedTasks' => (clone $tasks)->where('status', 'completed')->count(),
                'scheduledPosts' => $this->visibleSocialPosts($request)->where('status', 'scheduled')->count(),
            ],
            'upcomingTasks' => $tasks->where('status', '!=', 'completed')->orderBy('due_at')->limit(8)->get(),
        ]);
    }

    public function clients(Request $request): JsonResponse
    {
        $query = Client::query()->latest();

        if (! $request->user()->isAgencyMember()) {
            $query->where('portal_user_id', $request->user()->id);
        }

        return response()->json($query->get());
    }

    public function storeClient(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'industry' => ['nullable', 'string', 'max:255'],
            'contact_name' => ['nullable', 'string', 'max:255'],
            'contact_email' => ['nullable', 'email', 'max:255'],
            'status' => ['nullable', 'in:active,onboarding,paused,inactive'],
        ]);

        $client = Client::create($data + ['status' => 'active']);

        return response()->json($client, 201);
    }

    public function updateClient(Request $request, Client $client): JsonResponse
    {
        abort_unless($this->canAccessClient($request, $client->id), 403);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'industry' => ['sometimes', 'nullable', 'string', 'max:255'],
            'contact_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'contact_email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'status' => ['sometimes', 'in:active,onboarding,paused,inactive'],
        ]);

        $client->update($data);

        return response()->json($client->fresh());
    }

    public function destroyClient(Request $request, Client $client): JsonResponse
    {
        abort_unless($this->canAccessClient($request, $client->id), 403);

        $hasLinkedWork = $client->projects()->exists()
            || $client->tasks()->exists()
            || $client->socialPosts()->exists()
            || $client->sharedFiles()->exists();

        if ($hasLinkedWork) {
            abort(422, 'This client has linked work. Set the client status to inactive instead of deleting it.');
        }

        $client->delete();

        return response()->json(['message' => 'Client deleted.']);
    }

    public function projects(Request $request): JsonResponse
    {
        return response()->json($this->visibleProjects($request)->with($this->projectRelations())->latest()->get());
    }

    public function projectsWorkspace(Request $request): JsonResponse
    {
        return response()->json([
            'projects' => $this->visibleProjects($request)->with($this->projectRelations())->latest()->get(),
            'clients' => $this->visibleClients($request)->latest()->get(),
            'tasks' => $this->visibleTasks($request)->with($this->taskRelations())->orderBy('due_at')->get(),
            'team' => $request->user()->isManager()
                ? $this->agencyTeamQuery()->get($this->teamMemberColumns())
                : [],
        ]);
    }

    public function teamMembers(): JsonResponse
    {
        return response()->json($this->agencyTeamQuery()
            ->get($this->teamMemberColumns()));
    }

    public function storeUser(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'string', 'min:10'],
            'role' => ['required', 'in:admin,manager,worker,client'],
            'title' => ['nullable', 'string', 'max:255'],
            'weekly_capacity' => ['nullable', 'integer', 'min:1', 'max:80'],
            'is_active' => ['sometimes', 'boolean'],
            'avatar_color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
        ]);

        $user = User::create($data + ['weekly_capacity' => 40, 'is_active' => true]);

        return response()->json($user->fresh(), 201);
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['sometimes', 'nullable', 'string', 'min:10'],
            'role' => ['sometimes', 'in:admin,manager,worker,client'],
            'title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'weekly_capacity' => ['sometimes', 'integer', 'min:1', 'max:80'],
            'is_active' => ['sometimes', 'boolean'],
            'avatar_color' => ['sometimes', 'nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
        ]);

        if (($data['is_active'] ?? true) === false && $user->id === $request->user()->id) {
            abort(422, 'You cannot disable your own account.');
        }

        if (($data['password'] ?? null) === null) {
            unset($data['password']);
        }

        $user->update($data);

        return response()->json($user->fresh());
    }

    public function destroyUser(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            abort(422, 'You cannot delete your own account.');
        }

        if ($user->role === 'admin' && $user->is_active) {
            $activeAdminCount = User::query()
                ->where('role', 'admin')
                ->where('is_active', true)
                ->count();

            if ($activeAdminCount <= 1) {
                abort(422, 'You cannot delete the last active admin account.');
            }
        }

        if (Schema::hasTable('personal_access_tokens')) {
            $user->tokens()->delete();
        }

        $user->delete();

        return response()->json(['message' => 'User deleted.']);
    }

    public function storeProject(Request $request): JsonResponse
    {
        $data = $request->validate([
            'client_id' => ['required', 'exists:clients,id'],
            'manager_id' => ['nullable', 'exists:users,id'],
            'name' => ['required', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'max:80'],
            'status' => ['required', 'in:briefing,in_progress,active,on_hold,completed'],
            'progress' => ['nullable', 'integer', 'min:0', 'max:100'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'description' => ['nullable', 'string'],
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => ['integer', 'exists:users,id'],
        ]);

        abort_unless($this->canAccessClient($request, (int) $data['client_id']), 403);
        $this->authorizeAssignedUser($data['manager_id'] ?? null);
        foreach ($data['member_ids'] ?? [] as $memberId) {
            $this->authorizeAssignedUser($memberId);
        }

        $memberIds = $data['member_ids'] ?? [];
        unset($data['member_ids']);

        $project = Project::create($data + ['manager_id' => $request->user()->id, 'type' => 'marketing', 'progress' => 0]);
        $this->syncProjectMembers($project, array_unique(array_filter([...$memberIds, $project->manager_id])));

        return response()->json($project->fresh($this->projectRelations()), 201);
    }

    public function updateProject(Request $request, Project $project): JsonResponse
    {
        abort_unless($this->canAccessProject($request, $project->id), 403);

        $data = $request->validate([
            'client_id' => ['sometimes', 'exists:clients,id'],
            'manager_id' => ['sometimes', 'nullable', 'exists:users,id'],
            'name' => ['sometimes', 'string', 'max:255'],
            'type' => ['sometimes', 'nullable', 'string', 'max:80'],
            'status' => ['sometimes', 'in:briefing,in_progress,active,on_hold,completed'],
            'progress' => ['sometimes', 'integer', 'min:0', 'max:100'],
            'starts_at' => ['sometimes', 'nullable', 'date'],
            'ends_at' => ['sometimes', 'nullable', 'date'],
            'description' => ['sometimes', 'nullable', 'string'],
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => ['integer', 'exists:users,id'],
        ]);

        if (isset($data['client_id'])) {
            abort_unless($this->canAccessClient($request, (int) $data['client_id']), 403);
        }

        $this->authorizeAssignedUser($data['manager_id'] ?? null);
        foreach ($data['member_ids'] ?? [] as $memberId) {
            $this->authorizeAssignedUser($memberId);
        }

        $memberIds = $data['member_ids'] ?? null;
        unset($data['member_ids']);

        $project->update($data);

        if ($memberIds !== null) {
            $this->syncProjectMembers($project, array_unique(array_filter([...$memberIds, $project->manager_id])));
        }

        return response()->json($project->fresh($this->projectRelations()));
    }

    public function destroyProject(Request $request, Project $project): JsonResponse
    {
        abort_unless($this->canAccessProject($request, $project->id), 403);
        $project->delete();

        return response()->json(['message' => 'Project deleted.']);
    }

    public function tasks(Request $request): JsonResponse
    {
        return response()->json($this->visibleTasks($request)->with($this->taskRelations())->orderBy('due_at')->get());
    }

    public function storeTask(Request $request): JsonResponse
    {
        $data = $request->validate([
            'project_id' => ['nullable', 'exists:projects,id'],
            'client_id' => ['nullable', 'exists:clients,id'],
            'assigned_to' => ['nullable', 'exists:users,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'status' => ['nullable', 'in:todo,in_progress,review,completed'],
            'priority' => ['required', 'in:low,normal,high,urgent'],
            'due_at' => ['nullable', 'date'],
            'attachments' => ['sometimes', 'array', 'max:5'],
            'attachments.*' => ['file', 'max:20480'],
        ]);

        $attachments = $request->file('attachments', []);
        unset($data['attachments']);

        $data['status'] ??= 'todo';

        if ($data['status'] === 'completed') {
            $data['completed_at'] = now();
        }

        $this->authorizeProjectClientPair($request, $data['project_id'] ?? null, $data['client_id'] ?? null);
        $this->authorizeAssignedUser($data['assigned_to'] ?? null);

        $task = Task::create($data + ['created_by' => $request->user()->id]);
        $this->storeTaskAttachmentFiles($request, $task, $attachments);

        return response()->json($task->fresh($this->taskRelations()), 201);
    }

    public function updateTask(Request $request, Task $task): JsonResponse
    {
        abort_unless($this->canAccessTask($request, $task), 403);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
            'status' => ['sometimes', 'in:todo,in_progress,review,completed'],
            'priority' => ['sometimes', 'in:low,normal,high,urgent'],
            'due_at' => ['sometimes', 'nullable', 'date'],
            'assigned_to' => ['sometimes', 'nullable', 'exists:users,id'],
        ]);

        if (($data['status'] ?? null) === 'completed') {
            $data['completed_at'] = now();
        }

        if (! $request->user()->isManager()) {
            abort_unless(array_diff(array_keys($data), ['status', 'completed_at']) === [], 403);
        }

        $this->authorizeAssignedUser($data['assigned_to'] ?? null);

        $task->update($data);

        return response()->json($task->fresh($this->taskRelations()));
    }

    public function destroyTask(Request $request, Task $task): JsonResponse
    {
        abort_unless($this->canAccessTask($request, $task), 403);
        $task->attachments->each(fn (TaskAttachment $attachment) => Storage::disk($attachment->disk)->delete($attachment->path));
        $task->delete();

        return response()->json(['message' => 'Task deleted.']);
    }

    public function storeTaskAttachments(Request $request, Task $task): JsonResponse
    {
        abort_unless($this->canAccessTask($request, $task), 403);

        $data = $request->validate([
            'attachments' => ['required', 'array', 'max:5'],
            'attachments.*' => ['file', 'max:20480'],
        ]);

        $this->storeTaskAttachmentFiles($request, $task, $data['attachments']);

        return response()->json($task->fresh('attachments')->attachments, 201);
    }

    public function storeTaskSubtask(Request $request, Task $task): JsonResponse
    {
        abort_unless($this->canAccessTask($request, $task), 403);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
        ]);

        $subtask = TaskSubtask::create([
            'task_id' => $task->id,
            'created_by' => $request->user()->id,
            'title' => $data['title'],
            'sort_order' => (int) $task->subtasks()->max('sort_order') + 1,
        ]);

        return response()->json($subtask, 201);
    }

    public function updateTaskSubtask(Request $request, Task $task, TaskSubtask $taskSubtask): JsonResponse
    {
        abort_unless($taskSubtask->task_id === $task->id && $this->canAccessTask($request, $task), 403);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'is_completed' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('is_completed', $data)) {
            $data['completed_at'] = $data['is_completed'] ? now() : null;
            $data['completed_by'] = $data['is_completed'] ? $request->user()->id : null;
        }

        $taskSubtask->update($data);

        return response()->json($taskSubtask->fresh());
    }

    public function destroyTaskSubtask(Request $request, Task $task, TaskSubtask $taskSubtask): JsonResponse
    {
        abort_unless($taskSubtask->task_id === $task->id && $this->canAccessTask($request, $task), 403);
        $taskSubtask->delete();

        return response()->json(['message' => 'Subtask deleted.']);
    }

    public function storeTaskComment(Request $request, Task $task): JsonResponse
    {
        abort_unless($this->canAccessTask($request, $task), 403);

        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $comment = TaskComment::create([
            'task_id' => $task->id,
            'user_id' => $request->user()->id,
            'body' => $data['body'],
        ]);

        return response()->json($comment->load('user:id,name,email,role,title'), 201);
    }

    public function downloadTaskAttachment(Request $request, Task $task, TaskAttachment $taskAttachment): StreamedResponse
    {
        abort_unless($taskAttachment->task_id === $task->id && $this->canAccessTask($request, $task), 403);

        return Storage::disk($taskAttachment->disk)->download($taskAttachment->path, $taskAttachment->name);
    }

    public function destroyTaskAttachment(Request $request, Task $task, TaskAttachment $taskAttachment): JsonResponse
    {
        abort_unless($taskAttachment->task_id === $task->id && $this->canAccessTask($request, $task), 403);
        abort_unless($request->user()->isManager() || $taskAttachment->uploaded_by === $request->user()->id, 403);

        Storage::disk($taskAttachment->disk)->delete($taskAttachment->path);
        $taskAttachment->delete();

        return response()->json(['message' => 'Attachment deleted.']);
    }

    public function socialPosts(Request $request): JsonResponse
    {
        return response()->json($this->visibleSocialPosts($request)->orderBy('scheduled_at')->get());
    }

    public function weeklyPostingTracker(Request $request): JsonResponse
    {
        $data = $request->validate([
            'week_start' => ['nullable', 'date'],
        ]);

        $weekStart = CarbonImmutable::parse($data['week_start'] ?? now())->startOfWeek();
        $weekEnd = $weekStart->addDays(6);
        $days = collect(range(0, 6))->map(fn (int $offset): array => [
            'day_of_week' => $offset + 1,
            'date' => $weekStart->addDays($offset)->toDateString(),
            'label' => $weekStart->addDays($offset)->format('D'),
        ]);

        $clients = Client::query()
            ->when(! $request->user()->isAgencyMember(), fn (Builder $query) => $query->where('portal_user_id', $request->user()->id))
            ->orderBy('name')
            ->get();
        $clientIds = $clients->pluck('id');

        $schedules = ClientPostingSchedule::query()
            ->whereIn('client_id', $clientIds)
            ->where('is_active', true)
            ->get()
            ->groupBy('client_id');

        $checks = PostingCheck::query()
            ->whereIn('client_id', $clientIds)
            ->whereBetween('post_date', [$weekStart->toDateString(), $weekEnd->toDateString()])
            ->get()
            ->keyBy(fn (PostingCheck $check): string => "{$check->client_id}:{$check->post_date->toDateString()}");

        $publishedCounts = SocialPost::query()
            ->whereIn('client_id', $clientIds)
            ->where('status', 'published')
            ->whereBetween('published_at', [$weekStart->startOfDay(), $weekEnd->endOfDay()])
            ->selectRaw('client_id, date(published_at) as post_date, count(*) as total')
            ->groupBy('client_id', 'post_date')
            ->get()
            ->keyBy(fn (SocialPost $post): string => "{$post->client_id}:{$post->post_date}");

        return response()->json([
            'week_start' => $weekStart->toDateString(),
            'week_end' => $weekEnd->toDateString(),
            'days' => $days,
            'clients' => $clients->map(function (Client $client) use ($days, $schedules, $checks, $publishedCounts): array {
                $clientSchedule = $schedules->get($client->id, collect())->keyBy('day_of_week');

                return [
                    ...$client->toArray(),
                    'schedule_days' => $clientSchedule->keys()->values(),
                    'days' => $days->map(function (array $day) use ($client, $clientSchedule, $checks, $publishedCounts): array {
                        $key = "{$client->id}:{$day['date']}";
                        $schedule = $clientSchedule->get($day['day_of_week']);
                        $check = $checks->get($key);
                        $publishedCount = (int) ($publishedCounts->get($key)?->total ?? 0);
                        $planned = $schedule !== null;
                        $required = (int) ($schedule?->required_posts ?? 0);
                        $manualStatus = $check?->status;
                        $status = 'not_planned';

                        if ($planned) {
                            $status = match (true) {
                                $manualStatus === 'posted' || $publishedCount >= $required => 'posted',
                                $manualStatus === 'skipped' => 'skipped',
                                $manualStatus === 'missed' => 'missed',
                                CarbonImmutable::parse($day['date'])->lt(CarbonImmutable::today()) => 'missed',
                                default => 'pending',
                            };
                        } elseif ($manualStatus) {
                            $status = $manualStatus;
                        }

                        return [
                            ...$day,
                            'planned' => $planned,
                            'required_posts' => $required,
                            'published_count' => $publishedCount,
                            'manual_status' => $manualStatus,
                            'note' => $check?->note,
                            'status' => $status,
                        ];
                    })->values(),
                ];
            })->values(),
        ]);
    }

    public function updatePostingSchedule(Request $request, Client $client): JsonResponse
    {
        abort_unless($request->user()->isManager() && $this->canAccessClient($request, $client->id), 403);

        $data = $request->validate([
            'days' => ['present', 'array'],
            'days.*.day_of_week' => ['required', 'integer', 'between:1,7'],
            'days.*.required_posts' => ['nullable', 'integer', 'min:1', 'max:10'],
        ]);

        $requestedDays = collect($data['days'])
            ->mapWithKeys(fn (array $day): array => [(int) $day['day_of_week'] => max(1, (int) ($day['required_posts'] ?? 1))]);

        $inactiveScheduleQuery = ClientPostingSchedule::query()->where('client_id', $client->id);

        if ($requestedDays->isEmpty()) {
            $inactiveScheduleQuery->update(['is_active' => false]);
        } else {
            $inactiveScheduleQuery
                ->whereNotIn('day_of_week', $requestedDays->keys())
                ->update(['is_active' => false]);
        }

        foreach ($requestedDays as $dayOfWeek => $requiredPosts) {
            ClientPostingSchedule::updateOrCreate(
                ['client_id' => $client->id, 'day_of_week' => $dayOfWeek],
                ['required_posts' => $requiredPosts, 'is_active' => true],
            );
        }

        return response()->json($client->postingSchedules()->where('is_active', true)->orderBy('day_of_week')->get());
    }

    public function markPostingCheck(Request $request, Client $client): JsonResponse
    {
        abort_unless($request->user()->isAgencyMember() && $this->canAccessClient($request, $client->id), 403);

        $data = $request->validate([
            'post_date' => ['required', 'date'],
            'status' => ['required', 'in:pending,posted,missed,skipped'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $check = PostingCheck::updateOrCreate(
            ['client_id' => $client->id, 'post_date' => CarbonImmutable::parse($data['post_date'])->toDateString()],
            [
                'status' => $data['status'],
                'note' => $data['note'] ?? null,
                'checked_by' => $request->user()->id,
            ],
        );

        return response()->json($check->fresh());
    }

    public function storeSocialPost(Request $request): JsonResponse
    {
        $data = $request->validate([
            'project_id' => ['nullable', 'exists:projects,id'],
            'client_id' => ['required', 'exists:clients,id'],
            'owner_id' => ['nullable', 'exists:users,id'],
            'platform' => ['required', 'string', 'max:80'],
            'title' => ['required', 'string', 'max:255'],
            'content' => ['nullable', 'string'],
            'status' => ['required', 'in:draft,review,pending_agency_approval,pending_client_review,needs_revision,approved,scheduled,published'],
            'scheduled_at' => ['nullable', 'date'],
        ]);

        $this->authorizeProjectClientPair($request, $data['project_id'] ?? null, $data['client_id']);
        $this->authorizeAssignedUser($data['owner_id'] ?? null);

        $post = SocialPost::create($data);

        return response()->json($post, 201);
    }

    public function updateSocialPost(Request $request, SocialPost $socialPost): JsonResponse
    {
        abort_unless($this->canAccessClient($request, $socialPost->client_id), 403);

        $data = $request->validate([
            'project_id' => ['sometimes', 'nullable', 'exists:projects,id'],
            'client_id' => ['sometimes', 'exists:clients,id'],
            'owner_id' => ['sometimes', 'nullable', 'exists:users,id'],
            'platform' => ['sometimes', 'string', 'max:80'],
            'title' => ['sometimes', 'string', 'max:255'],
            'content' => ['sometimes', 'nullable', 'string'],
            'status' => ['sometimes', 'in:draft,review,pending_agency_approval,pending_client_review,needs_revision,approved,scheduled,published'],
            'scheduled_at' => ['sometimes', 'nullable', 'date'],
            'published_at' => ['sometimes', 'nullable', 'date'],
        ]);

        if (! $request->user()->isAgencyMember()) {
            abort_unless(array_diff(array_keys($data), ['status']) === [], 403);
            abort_unless(in_array($data['status'] ?? '', ['approved', 'needs_revision'], true), 422);
        }

        $this->authorizeProjectClientPair(
            $request,
            $data['project_id'] ?? $socialPost->project_id,
            $data['client_id'] ?? $socialPost->client_id,
        );
        $this->authorizeAssignedUser($data['owner_id'] ?? null);

        $socialPost->update($data);

        return response()->json($socialPost->fresh());
    }

    public function destroySocialPost(Request $request, SocialPost $socialPost): JsonResponse
    {
        abort_unless($this->canAccessClient($request, $socialPost->client_id), 403);
        $socialPost->delete();

        return response()->json(['message' => 'Social post deleted.']);
    }

    public function chatMessages(Request $request): JsonResponse
    {
        $query = ChatMessage::query()
            ->with('user:id,name,email,role,title,avatar_color')
            ->latest()
            ->limit(100);

        if (! $request->user()->isAgencyMember()) {
            $clientId = Client::where('portal_user_id', $request->user()->id)->value('id');
            $query->where('client_id', $clientId);
        }

        return response()->json($query->get());
    }

    public function storeChatMessage(Request $request): JsonResponse
    {
        $data = $request->validate([
            'project_id' => ['nullable', 'exists:projects,id'],
            'client_id' => ['nullable', 'exists:clients,id'],
            'message' => ['required', 'string', 'max:5000'],
        ]);

        abort_unless(($data['project_id'] ?? null) || ($data['client_id'] ?? null), 422, 'A project or client is required.');

        if ($projectId = $data['project_id'] ?? null) {
            $project = Project::findOrFail($projectId);
            $data['client_id'] ??= $project->client_id;
        }

        $this->authorizeProjectClientPair($request, $data['project_id'] ?? null, $data['client_id'] ?? null);

        $message = ChatMessage::create($data + ['user_id' => $request->user()->id])
            ->load('user:id,name,email,role,title,avatar_color');

        ChatMessageCreated::dispatch($message);

        return response()->json($message, 201);
    }

    public function files(Request $request): JsonResponse
    {
        return response()->json($this->visibleFiles($request)->latest()->get());
    }

    public function storeFile(Request $request): JsonResponse
    {
        $data = $request->validate([
            'project_id' => ['nullable', 'exists:projects,id'],
            'client_id' => ['required', 'exists:clients,id'],
            'category' => ['nullable', 'string', 'max:80'],
            'file' => ['required', 'file', 'max:10240'],
        ]);

        abort_unless($this->canAccessClient($request, (int) $data['client_id']), 403);
        $this->authorizeProjectClientPair($request, $data['project_id'] ?? null, $data['client_id']);

        $uploadedFile = $request->file('file');
        $disk = config('filesystems.default');
        $path = $uploadedFile->store("shared-files/{$data['client_id']}", $disk);

        $file = SharedFile::create([
            'project_id' => $data['project_id'] ?? null,
            'client_id' => $data['client_id'],
            'uploaded_by' => $request->user()->id,
            'name' => $uploadedFile->getClientOriginalName(),
            'category' => $data['category'] ?? 'asset',
            'disk' => $disk,
            'path' => $path,
            'mime_type' => $uploadedFile->getClientMimeType(),
            'size' => $uploadedFile->getSize(),
        ]);

        return response()->json($file, 201);
    }

    public function downloadFile(Request $request, SharedFile $sharedFile): StreamedResponse
    {
        abort_unless($this->canAccessClient($request, $sharedFile->client_id), 403);

        return Storage::disk($sharedFile->disk)->download($sharedFile->path, $sharedFile->name);
    }

    public function destroyFile(Request $request, SharedFile $sharedFile): JsonResponse
    {
        abort_unless($this->canAccessClient($request, $sharedFile->client_id), 403);
        Storage::disk($sharedFile->disk)->delete($sharedFile->path);
        $sharedFile->delete();

        return response()->json(['message' => 'File deleted.']);
    }

    public function notifications(Request $request): JsonResponse
    {
        return response()->json($request->user()->notifications()->latest()->limit(50)->get());
    }

    public function markNotificationRead(Request $request, DatabaseNotification $notification): JsonResponse
    {
        abort_unless($notification->notifiable_id === $request->user()->id, 403);
        $notification->markAsRead();

        return response()->json($notification->fresh());
    }

    public function teamPerformance(): JsonResponse
    {
        $users = User::query()
            ->whereIn('role', ['admin', 'manager', 'worker'])
            ->where('is_active', true)
            ->get(['id', 'name', 'title', 'role', 'weekly_capacity']);

        $totals = Task::query()
            ->select('assigned_to')
            ->selectRaw("sum(case when status = 'completed' then 1 else 0 end) as completed_tasks")
            ->selectRaw("sum(case when status != 'completed' then 1 else 0 end) as open_tasks")
            ->groupBy('assigned_to')
            ->get()
            ->keyBy('assigned_to');

        return response()->json($users->map(function (User $user) use ($totals): array {
            $tasks = $totals->get($user->id);

            return [
                ...$user->toArray(),
                'completed_tasks' => (int) ($tasks?->completed_tasks ?? 0),
                'open_tasks' => (int) ($tasks?->open_tasks ?? 0),
            ];
        }));
    }

    public function integrations(): JsonResponse
    {
        return response()->json(Integration::query()
            ->select(['id', 'provider', 'status', 'last_synced_at', 'updated_at'])
            ->orderBy('provider')
            ->get());
    }

    private function visibleProjects(Request $request): Builder
    {
        $query = Project::query();

        if ($request->user()->role === 'worker') {
            $query->whereHas('users', fn (Builder $users) => $users->whereKey($request->user()->id));
        } elseif (! $request->user()->isAgencyMember()) {
            $query->whereHas('client', fn (Builder $client) => $client->where('portal_user_id', $request->user()->id));
        }

        return $query;
    }

    private function visibleClients(Request $request): Builder
    {
        $query = Client::query();

        if (! $request->user()->isAgencyMember()) {
            $query->where('portal_user_id', $request->user()->id);
        }

        return $query;
    }

    private function agencyTeamQuery(): Builder
    {
        return User::query()
            ->whereIn('role', ['admin', 'manager', 'worker'])
            ->orderBy('name');
    }

    private function visibleTasks(Request $request): Builder
    {
        $query = Task::query();

        if ($request->user()->role === 'worker') {
            $query->where('assigned_to', $request->user()->id);
        } elseif (! $request->user()->isAgencyMember()) {
            $query->whereIn('client_id', Client::where('portal_user_id', $request->user()->id)->select('id'));
        }

        return $query;
    }

    private function visibleSocialPosts(Request $request): Builder
    {
        $query = SocialPost::query();

        if (! $request->user()->isAgencyMember()) {
            $query->whereIn('client_id', Client::where('portal_user_id', $request->user()->id)->select('id'));
        }

        return $query;
    }

    private function visibleFiles(Request $request): Builder
    {
        $query = SharedFile::query();

        if (! $request->user()->isAgencyMember()) {
            $query->whereIn('client_id', Client::where('portal_user_id', $request->user()->id)->select('id'));
        }

        return $query;
    }

    private function canAccessClient(Request $request, int $clientId): bool
    {
        return $request->user()->isAgencyMember()
            || Client::whereKey($clientId)->where('portal_user_id', $request->user()->id)->exists();
    }

    private function canAccessProject(Request $request, int $projectId): bool
    {
        if ($request->user()->isManager()) {
            return true;
        }

        if ($request->user()->role === 'worker') {
            return Project::whereKey($projectId)
                ->whereHas('users', fn (Builder $users) => $users->whereKey($request->user()->id))
                ->exists();
        }

        return Project::whereKey($projectId)
            ->whereHas('client', fn (Builder $client) => $client->where('portal_user_id', $request->user()->id))
            ->exists();
    }

    private function canAccessTask(Request $request, Task $task): bool
    {
        return $request->user()->isManager()
            || $task->assigned_to === $request->user()->id
            || $task->client_id === Client::where('portal_user_id', $request->user()->id)->value('id');
    }

    private function authorizeProjectClientPair(Request $request, mixed $projectId, mixed $clientId): void
    {
        if ($projectId !== null) {
            $project = Project::findOrFail((int) $projectId);

            abort_unless($this->canAccessProject($request, $project->id), 403);

            if ($clientId !== null) {
                abort_unless($project->client_id === (int) $clientId, 422, 'Project does not belong to the selected client.');
            }
        }

        if ($clientId !== null) {
            abort_unless($this->canAccessClient($request, (int) $clientId), 403);
        }
    }

    private function authorizeAssignedUser(mixed $userId): void
    {
        if ($userId === null) {
            return;
        }

        abort_unless(
            User::whereKey((int) $userId)
                ->where('is_active', true)
                ->whereIn('role', ['admin', 'manager', 'worker'])
                ->exists(),
            422,
            'Assigned user must be an active agency member.',
        );
    }

    /**
     * @return array<int, string>
     */
    private function taskRelations(): array
    {
        return [
            'attachments',
            'subtasks',
            'comments.user:id,name,email,role,title,avatar_color',
        ];
    }

    /**
     * @return array<int, string>
     */
    private function teamMemberColumns(): array
    {
        return ['id', 'name', 'email', 'role', 'title', 'weekly_capacity', 'is_active', 'avatar_color', 'created_at', 'updated_at'];
    }

    /**
     * @return array<int, string>
     */
    private function projectRelations(): array
    {
        return [
            'users:id,name,email,role,title,avatar_color',
        ];
    }

    /**
     * @param array<int, \Illuminate\Http\UploadedFile> $files
     */
    private function storeTaskAttachmentFiles(Request $request, Task $task, array $files): void
    {
        if ($files === []) {
            return;
        }

        $disk = config('filesystems.default');

        foreach ($files as $uploadedFile) {
            $path = $uploadedFile->store("task-attachments/{$task->id}", $disk);

            TaskAttachment::create([
                'task_id' => $task->id,
                'uploaded_by' => $request->user()->id,
                'name' => $uploadedFile->getClientOriginalName(),
                'disk' => $disk,
                'path' => $path,
                'mime_type' => $uploadedFile->getClientMimeType(),
                'size' => $uploadedFile->getSize(),
            ]);
        }
    }

    /**
     * @param array<int, int|string|null> $memberIds
     */
    private function syncProjectMembers(Project $project, array $memberIds): void
    {
        $project->users()->syncWithPivotValues($memberIds, ['role' => 'contributor']);
    }
}
