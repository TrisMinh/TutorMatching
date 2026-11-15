$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
$switched = $false
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is required for seeding. Install Node.js LTS or run setup.cmd -DevTools.' }
    New-Item -ItemType Directory -Path '.logs' -Force | Out-Null
    $override = Join-Path (Get-Location) '.logs/seed-mailpit.compose.yaml'
    $yaml = "services:`n  identity-service:`n    environment:`n      Email__Provider: mailpit`n  notification-service:`n    environment:`n      Email__Provider: mailpit`n"
    [System.IO.File]::WriteAllText($override, $yaml, (New-Object System.Text.UTF8Encoding($false)))
    $switched = $true
    docker compose -f compose.yaml -f compose.ha.yaml -f $override up -d --no-deps --wait --wait-timeout 120 identity-service notification-service
    if ($LASTEXITCODE -ne 0) { throw 'Could not prepare Mailpit delivery for demo data.' }
    node scripts/seed-demo.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Account/profile/booking seed failed. Existing data was preserved.' }
    node scripts/seed-courses.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Course seed failed. Existing data was preserved.' }
    node scripts/verify-data-integrity.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Data integrity check failed. See .logs/data-integrity.json.' }
    Write-Host 'Linked data ready. Demo password: TutorDemo!2026. Real user accounts were not modified.'
} finally {
    if ($switched) {
        docker compose -f compose.yaml -f compose.ha.yaml up -d --no-deps --wait --wait-timeout 120 identity-service notification-service
        if ($LASTEXITCODE -ne 0) { Write-Error 'Could not restore configured mail provider. Run rebuild.cmd.' }
    }
    Pop-Location
}
