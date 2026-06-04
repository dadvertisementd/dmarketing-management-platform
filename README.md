# DMARKETING Management Platform

Internal Laravel + React platform for DMARKETING project, team, task, brand asset,
social content, and client workflow management.

## Stack

- React/Vite frontend
- Laravel 12 backend
- Laravel Sanctum session authentication
- MySQL/MariaDB for production hosting
- Filament admin panel

## Local Development

Install frontend dependencies:

```powershell
npm install
```

Install backend dependencies:

```powershell
cd backend
composer install
copy .env.example .env
php artisan key:generate
php artisan migrate:fresh --seed
```

Run the Laravel API:

```powershell
cd backend
php artisan serve --host=127.0.0.1 --port=8011
```

Run the frontend:

```powershell
npm run dev
```

## Checks

```powershell
npm run lint
cd backend
php artisan test
```

## Build cPanel Package Locally

```powershell
.\scripts\build-deployment.ps1
```

The script creates:

```text
deployment/dmarketing-deploy.zip
```

Upload that ZIP to the cPanel home directory, extract it, and keep this layout:

```text
/home1/dmarketingapp/dmarketing-app
/home1/dmarketingapp/public_html
```

`public_html/index.php` points to the private Laravel app in `../dmarketing-app`.

## GitHub Release Workflow

The repository includes `.github/workflows/release-package.yml`.

When code is pushed to `main`, GitHub Actions will:

- install PHP and Node dependencies
- run Laravel migrations against SQLite for tests
- run Laravel tests
- run TypeScript checks and frontend build
- create `deployment/dmarketing-deploy.zip`
- upload the ZIP as a workflow artifact

Use that artifact for cPanel updates.

## Production Notes

Never commit real `.env` files, database passwords, cPanel passwords, cookies,
or generated deployment secrets.

For real team use, the domain must have valid HTTPS. After SSL is fixed, update
production `.env` back to:

```text
APP_URL=https://dmarketing.app
FRONTEND_URL=https://dmarketing.app
SESSION_SECURE_COOKIE=true
```

Then clear and cache Laravel config again.
