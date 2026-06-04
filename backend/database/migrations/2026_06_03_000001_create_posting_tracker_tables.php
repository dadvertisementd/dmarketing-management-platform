<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_posting_schedules', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('day_of_week');
            $table->unsignedTinyInteger('required_posts')->default(1);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['client_id', 'day_of_week']);
        });

        Schema::create('posting_checks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->date('post_date');
            $table->string('status')->default('posted');
            $table->text('note')->nullable();
            $table->foreignId('checked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['client_id', 'post_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('posting_checks');
        Schema::dropIfExists('client_posting_schedules');
    }
};
