$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    if (-not (Test-Path -LiteralPath '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env' }
    docker compose -f compose.yaml -f compose.ha.yaml config --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Invalid demo compose configuration.' }
    docker compose -f compose.yaml -f compose.ha.yaml up -d --build --wait --wait-timeout 240
    if ($LASTEXITCODE -ne 0) { throw 'Demo deployment did not become healthy. Volumes were preserved.' }
    docker compose -f compose.yaml -f compose.ha.yaml ps
} finally { Pop-Location }
