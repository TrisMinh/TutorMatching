param([Parameter(Mandatory = $true)]$ComposeConfiguration)
$ErrorActionPreference = 'Stop'
function Get-ExistingContainer($service) {
    $id = docker compose -f compose.yaml -f compose.ha.yaml ps -a -q $service
    if (-not $id) { return $null }
    $running = docker inspect --format '{{.State.Running}}' $id
    if ($running -ne 'true') {
        $null = docker start $id
        if ($LASTEXITCODE -ne 0) { throw "Cannot start $service to synchronize credentials." }
        $ready = $false
        for ($attempt = 0; $attempt -lt 60; $attempt++) {
            $health = docker inspect --format '{{.State.Health.Status}}' $id
            if ($health -eq 'healthy') { $ready = $true; break }
            Start-Sleep -Seconds 2
        }
        if (-not $ready) { throw "Timed out waiting for $service before password synchronization." }
    }
    return $id
}
# Existing volumes keep their original passwords; update roles without deleting data.
foreach ($name in @('identity', 'tutor', 'student', 'scheduling', 'notification')) {
    $service = "$name-db"
    $containerId = Get-ExistingContainer $service
    if (-not $containerId) { continue }
    $databaseEnv = $ComposeConfiguration.services.$service.environment
    $role = $databaseEnv.POSTGRES_USER
    $password = $databaseEnv.POSTGRES_PASSWORD.Replace("'", "''")
    "ALTER ROLE $role WITH PASSWORD '$password';" | docker exec -i $containerId psql -U $role -d $databaseEnv.POSTGRES_DB -v ON_ERROR_STOP=1 -q
    if ($LASTEXITCODE -ne 0) { throw "Cannot synchronize password for $service." }
}
$pgadminId = Get-ExistingContainer 'pgadmin'
if ($pgadminId) {
    $adminEnv = $ComposeConfiguration.services.pgadmin.environment
    $result = docker exec $pgadminId /venv/bin/python3 /pgadmin4/setup.py update-user $adminEnv.PGADMIN_DEFAULT_EMAIL --password $adminEnv.PGADMIN_DEFAULT_PASSWORD
    if ($LASTEXITCODE -ne 0) { throw 'Cannot synchronize existing pgAdmin login.' }
}
Write-Host 'Synchronized pgAdmin and database passwords; existing data preserved.'
