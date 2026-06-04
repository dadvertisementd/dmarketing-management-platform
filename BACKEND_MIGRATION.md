# DMARKETING Laravel Backend

The independent backend is in `backend/`. It runs on Laravel 12 with Sanctum,
Filament, Reverb, queued notifications, and S3-compatible file storage.

## Local Setup

```powershell
cd E:\dmarketing-management-platform\backend
php artisan migrate:fresh --seed
php artisan serve --host=127.0.0.1 --port=8011
php artisan queue:work
php artisan schedule:work
php artisan reverb:start
```

Open the admin panel at `http://127.0.0.1:8011/admin`.

Local seed login:

```text
admin@dmarketing.me
ChangeMe123!
```

Change this password before deployment.

## Current Backend Coverage

- Users with admin, manager, worker, and client roles
- Clients, projects, task assignment, deadlines, and completion tracking
- Monthly social media posts and scheduling records
- Client file upload and download
- Project chat messages with Reverb broadcast events
- Database and email deadline reminders
- Team performance report endpoint
- Slack, Asana, and Google Workspace integration records
- Filament admin screens for core records

## React Migration Boundary

The existing React screens still call Firebase directly. `src/lib/laravelApi.ts`
is the Sanctum-aware REST client for the screen-by-screen migration. Do not
remove Firebase until each React view uses Laravel endpoints for reads and
writes. The Laravel admin panel is usable immediately without Firebase.

## Production

Deploy Laravel on a private HTTPS subdomain such as `app.dmarketing.me`.
For standard hosting, create a MySQL or MariaDB database in the hosting panel
and use those credentials in `backend/.env`:

```text
DB_CONNECTION=mysql
DB_HOST=<hosting database host>
DB_PORT=3306
DB_DATABASE=<database name>
DB_USERNAME=<database user>
DB_PASSWORD=<database password>
```

Use `APP_ENV=production`, `APP_DEBUG=false`, `SESSION_ENCRYPT=true`, and
`SESSION_SECURE_COOKIE=true`. Set `APP_URL`, `FRONTEND_URL`, `SESSION_DOMAIN`,
and `SANCTUM_STATEFUL_DOMAINS` to the real production domains.

Run a queue worker and scheduler, configure SMTP mail, and keep Reverb behind
the same HTTPS reverse proxy if realtime chat is enabled. For larger file
storage, use S3 or an S3-compatible provider instead of local disk. Do not
expose the seeded password or local Reverb credentials.
