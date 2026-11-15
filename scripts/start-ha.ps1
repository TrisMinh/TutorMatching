$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
$transcribing = $false
try {
    $logDirectory = Join-Path $projectRoot '.logs'
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    $logPath = Join-Path $logDirectory ('rebuild-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
    Start-Transcript -Path $logPath -Force | Out-Null
    $transcribing = $true
    Write-Host ('Project: ' + $projectRoot)
    Write-Host ('Build log: ' + $logPath)
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker is not installed or is not on PATH. Run setup.cmd, then open a new terminal.' }
    $engine = docker info --format '{{.OSType}}'
    if ($LASTEXITCODE -ne 0) { throw 'Docker is not ready. Open Docker Desktop, wait for the engine, then run rebuild.cmd again.' }
    if ($engine.Trim() -ne 'linux') { throw 'Switch Docker Desktop to Linux containers, then run rebuild.cmd again.' }
    & (Join-Path $PSScriptRoot 'initialize-env.ps1')
    $configJson = docker compose -f compose.yaml -f compose.ha.yaml config --format json
    if ($LASTEXITCODE -ne 0) { throw 'Invalid Compose configuration. Check compose.yaml and .env.' }
    $configuration = ($configJson -join "`n") | ConvertFrom-Json
    & (Join-Path $PSScriptRoot 'test-email-config.ps1') -ComposeConfiguration $configuration
    & (Join-Path $PSScriptRoot 'sync-local-passwords.ps1') -ComposeConfiguration $configuration
    # Do not print or log the resolved configuration: it contains credentials.
    $configuration = $null
    $configJson = $null
    docker compose --progress plain -f compose.yaml -f compose.ha.yaml up -d --build --wait --wait-timeout 300
    if ($LASTEXITCODE -ne 0) { throw 'Docker build/start failed. See errors above. Existing database volumes were preserved.' }
    docker compose -f compose.yaml -f compose.ha.yaml ps
    if ($LASTEXITCODE -ne 0) { throw 'Unable to read container status.' }
    foreach ($url in @('http://localhost:3000/', 'http://localhost:8080/health/ready', 'http://localhost:5050/misc/ping')) {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 15
        if ($response.StatusCode -ne 200) { throw "HTTP verification failed: $url" }
        Write-Host ("Verified HTTP 200: " + $url)
    }
    Write-Host 'Rebuild complete: all containers ready and HTTP checks passed.' -ForegroundColor Green
} catch {
    Write-Host ('Rebuild failed: ' + $_.Exception.Message) -ForegroundColor Red
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        docker compose -f compose.yaml -f compose.ha.yaml ps -a
    }
    throw
} finally {
    if ($transcribing) { Stop-Transcript | Out-Null }
    Pop-Location
}
