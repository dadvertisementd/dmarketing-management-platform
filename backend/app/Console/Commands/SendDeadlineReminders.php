<?php

namespace App\Console\Commands;

use App\Models\Task;
use App\Notifications\TaskDeadlineReminder;
use Illuminate\Console\Command;

class SendDeadlineReminders extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:send-deadline-reminders';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send reminders for tasks due in the next 24 hours';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $tasks = Task::query()
            ->with('assignee')
            ->whereNotNull('assigned_to')
            ->where('status', '!=', 'completed')
            ->whereBetween('due_at', [now(), now()->addDay()])
            ->get();

        $tasks->each(function (Task $task): void {
            $task->assignee?->notify(new TaskDeadlineReminder($task));
        });

        $this->info("Sent {$tasks->count()} deadline reminder(s).");

        return self::SUCCESS;
    }
}
