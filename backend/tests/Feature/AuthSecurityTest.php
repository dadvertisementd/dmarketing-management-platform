<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_disabled_user_cannot_login_and_is_not_left_authenticated(): void
    {
        User::factory()->create([
            'email' => 'disabled@example.com',
            'password' => 'password',
            'is_active' => false,
        ]);

        $this->postJson('/login', [
            'email' => 'disabled@example.com',
            'password' => 'password',
        ])->assertForbidden();

        $this->assertGuest();
    }

    public function test_disabled_authenticated_user_cannot_use_api_routes(): void
    {
        $disabledUser = User::factory()->create(['is_active' => false]);

        $this->actingAs($disabledUser)
            ->getJson('/api/me')
            ->assertForbidden();
    }

    public function test_only_active_admins_can_access_filament_panel(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $manager = User::factory()->create(['role' => 'manager', 'is_active' => true]);
        $disabledAdmin = User::factory()->create(['role' => 'admin', 'is_active' => false]);

        $this->assertTrue($admin->canAccessPanel(filament()->getCurrentOrDefaultPanel()));
        $this->assertFalse($manager->canAccessPanel(filament()->getCurrentOrDefaultPanel()));
        $this->assertFalse($disabledAdmin->canAccessPanel(filament()->getCurrentOrDefaultPanel()));
    }
}
