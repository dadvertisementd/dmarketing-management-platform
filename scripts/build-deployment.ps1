param(
    [string] $OutputDir = "deployment",
    [string] $PackageName = "dmarketing-deploy.zip"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$backend = Join-Path $root "backend"
$dist = Join-Path $root "dist"
$output = Join-Path $root $OutputDir
$appOut = Join-Path $output "dmarketing-app"
$publicOut = Join-Path $output "public_html"
$zipPath = Join-Path $output $PackageName

New-Item -ItemType Directory -Force -Path $output | Out-Null
foreach ($generatedPath in @($appOut, $publicOut, $zipPath)) {
    if (Test-Path $generatedPath) {
        Remove-Item -LiteralPath $generatedPath -Recurse -Force
    }
}

Push-Location $root
try {
    npm ci
    npm run lint
    npm run build
}
finally {
    Pop-Location
}

Copy-Item -LiteralPath (Join-Path $dist "index.html") -Destination (Join-Path $backend "public\index.html") -Force
New-Item -ItemType Directory -Force -Path (Join-Path $backend "public\assets") | Out-Null
Copy-Item -LiteralPath (Join-Path $dist "assets\*") -Destination (Join-Path $backend "public\assets") -Force

robocopy $backend $appOut /MIR /XD vendor node_modules storage\app\private storage\framework\cache\data storage\framework\sessions storage\framework\views storage\logs /XF .env database.sqlite .phpunit.result.cache | Out-Null
if ($LASTEXITCODE -gt 7) {
    throw "robocopy failed while copying Laravel app."
}

Push-Location $appOut
try {
    composer install --no-dev --optimize-autoloader --no-interaction --no-scripts
}
finally {
    Pop-Location
}

New-Item -ItemType Directory -Force -Path $publicOut | Out-Null
Copy-Item -LiteralPath (Join-Path $appOut "public\*") -Destination $publicOut -Recurse -Force

$indexPhp = @'
<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

if (file_exists($maintenance = __DIR__.'/../dmarketing-app/storage/framework/maintenance.php')) {
    require $maintenance;
}

require __DIR__.'/../dmarketing-app/vendor/autoload.php';

/** @var Application $app */
$app = require_once __DIR__.'/../dmarketing-app/bootstrap/app.php';

$app->handleRequest(Request::capture());
'@

Set-Content -LiteralPath (Join-Path $publicOut "index.php") -Value $indexPhp -Encoding ASCII

if (Test-Path $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive -Path (Join-Path $output "dmarketing-app"), (Join-Path $output "public_html") -DestinationPath $zipPath -Force

Write-Host "Deployment package created: $zipPath"
