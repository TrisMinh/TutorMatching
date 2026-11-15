param([switch]$CheckOnly, [switch]$Elevated, [switch]$DevTools)
$ErrorActionPreference = 'Stop'

function Find-Docker {
    $command = Get-Command docker -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    foreach ($candidate in @(
        "$env:ProgramFiles\Docker\Docker\resources\bin\docker.exe",
        "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe"
    )) { if (Test-Path -LiteralPath $candidate) { return $candidate } }
    return $null
}
function Find-Git {
    $command = Get-Command git -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    foreach ($candidate in @("$env:ProgramFiles\Git\cmd\git.exe", "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe")) {
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    return $null
}
function Install-PackageWithWinget([string]$Id) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw 'WinGet is missing. Install/update App Installer from Microsoft Store, then rerun setup.cmd. See docs/setup-windows.md for manual downloads.'
    }
    Write-Host "Installing $Id... Windows may ask for administrator permission."
    & winget install --id $Id --exact --source winget --accept-source-agreements --accept-package-agreements --disable-interactivity
    if ($LASTEXITCODE -notin @(0, 3010, 1641)) { throw "Installation failed for $Id (exit $LASTEXITCODE). See docs/setup-windows.md for manual installation." }
}

try {
    Write-Host 'TutorMatching Windows setup'
    Write-Host 'Runtime: WSL2 + Docker Desktop. Git is installed for source updates.'
    Write-Host 'PostgreSQL, pgAdmin, Redis, RabbitMQ, Mailpit, .NET and Node run inside Docker.'
    $docker = Find-Docker
    $git = Find-Git
    $wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
    $wslReady = $false
    if ($wsl) {
        & $wsl.Source --status *> $null
        $wslReady = $LASTEXITCODE -eq 0
    }
    Write-Host ('Docker CLI installed: ' + [bool]$docker)
    Write-Host ('Git installed: ' + [bool]$git)
    Write-Host ('Node.js installed (data seeding tools): ' + [bool](Get-Command node -ErrorAction SilentlyContinue))
    Write-Host ('WSL status OK: ' + $wslReady)
    if ($CheckOnly) {
        if ($docker) {
            & $docker info --format 'Docker engine: {{.OSType}}'
            if ($LASTEXITCODE -ne 0) { Write-Host 'Open Docker Desktop and wait for its engine before rebuild.cmd.' }
            & $docker compose version
            if ($LASTEXITCODE -ne 0) { throw 'Docker Compose v2 is required. Update Docker Desktop.' }
        }
        Write-Host 'Check completed. No software or configuration was changed.'
        return
    }

    if (-not [Environment]::Is64BitOperatingSystem -or [Environment]::OSVersion.Version.Build -lt 19045) {
        throw 'Use a supported 64-bit Windows 10/11 release. See Docker Desktop requirements linked in docs/setup-windows.md.'
    }
    # Only WSL feature installation requires this script to be elevated.
    if (-not $wslReady) {
        $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
        $principal = New-Object Security.Principal.WindowsPrincipal($identity)
        if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
            if ($Elevated) { throw 'Administrator permission is required to enable WSL2.' }
            Write-Host 'Requesting administrator permission to enable WSL2...'
            $arguments = '-NoLogo -NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '" -Elevated'
            if ($DevTools) { $arguments += ' -DevTools' }
            $process = Start-Process -FilePath powershell.exe -Verb RunAs -ArgumentList $arguments -Wait -PassThru
            if ($process.ExitCode -ne 0) { throw 'Elevated setup did not finish successfully. Review its error and rerun setup.cmd.' }
            return
        }
        if (-not $wsl) { throw 'wsl.exe is missing. Update Windows and see the manual WSL installation link in docs/setup-windows.md.' }
        & $wsl.Source --install --no-distribution
        if ($LASTEXITCODE -notin @(0, 3010, 1641)) { throw "WSL installation failed (exit $LASTEXITCODE). Enable virtualization in BIOS/UEFI and see docs/setup-windows.md." }
        Write-Host 'WSL installation requested. Restart Windows after setup, then rerun setup.cmd.'
    } else {
        # Docker requires a recent WSL2 kernel; updating does not install a Linux distribution.
        & $wsl.Source --update
        if ($LASTEXITCODE -ne 0) { throw 'WSL update failed. Run wsl --update manually and rerun setup.cmd.' }
    }

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Install-PackageWithWinget 'OpenJS.NodeJS.LTS' }
    if ($DevTools -and -not (Get-Command dotnet -ErrorAction SilentlyContinue)) { Install-PackageWithWinget 'Microsoft.DotNet.SDK.10' }
    if (-not $git) { Install-PackageWithWinget 'Git.Git' }
    if (-not $docker) { Install-PackageWithWinget 'Docker.DockerDesktop' }
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
    $docker = Find-Docker
    if (-not $docker -or -not (Find-Git)) { throw 'An installed tool is not available yet. Restart Windows and rerun setup.cmd.' }
    & $docker compose version
    if ($LASTEXITCODE -ne 0) { throw 'Docker Compose v2 is missing. Repair/update Docker Desktop.' }
    & (Join-Path $PSScriptRoot 'initialize-env.ps1')
    Write-Host ''
    Write-Host 'Setup complete. If WSL was installed, restart Windows first.'
    Write-Host '1. Open Docker Desktop. Complete its first-run screens; use Linux containers / WSL2.'
    Write-Host '2. Edit .env if you want Gmail (EMAIL_PROVIDER=gmail). Default: Mailpit demo.'
    Write-Host '3. Double-click rebuild.cmd and wait for the build.'
    Write-Host 'Website: http://localhost:3000 | pgAdmin: http://localhost:5050'
    Write-Host 'pgAdmin login: PGADMIN_EMAIL / LOCAL_ADMIN_PASSWORD in .env.'
} catch {
    Write-Host ('Setup failed: ' + $_.Exception.Message) -ForegroundColor Red
    if ($Elevated) { Read-Host 'Press Enter to close' | Out-Null }
    exit 1
}
if ($Elevated) { Read-Host 'Press Enter to close' | Out-Null }
