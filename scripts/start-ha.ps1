$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    python scripts/init-security.py
    if ($LASTEXITCODE -ne 0) { throw 'Security material generation failed.' }
    docker compose -f compose.yaml -f compose.ha.yaml -f compose.security.yaml config --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Invalid HA compose configuration.' }
    docker compose -f compose.yaml -f compose.ha.yaml -f compose.security.yaml up -d --no-build --wait --wait-timeout 120 identity-db tutor-db student-db scheduling-db notification-db redis rabbitmq mailpit service-lb
    if ($LASTEXITCODE -ne 0) { throw 'Required infrastructure is not ready.' }
    python scripts/configure-databases.py
    if ($LASTEXITCODE -ne 0) { throw 'Database credential provisioning failed.' }
    python scripts/configure-broker.py
    if ($LASTEXITCODE -ne 0) { throw 'Broker service-account provisioning failed.' }
    docker compose -f compose.yaml -f compose.ha.yaml -f compose.security.yaml up -d --no-deps --build --force-recreate --wait --wait-timeout 240 identity-service tutor-service student-service scheduling-service notification-service gateway
    if ($LASTEXITCODE -ne 0) { throw 'HA deployment did not become healthy. Inspect compose logs; volumes were preserved.' }
    docker compose -f compose.yaml -f compose.ha.yaml -f compose.security.yaml up -d --no-deps --build --force-recreate --wait --wait-timeout 60 web
    if ($LASTEXITCODE -ne 0) { throw 'HTTPS frontend is not ready.' }
    docker compose -f compose.yaml -f compose.ha.yaml -f compose.security.yaml ps
} finally { Pop-Location }
