$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$envPath = Join-Path $projectRoot '.env'
if (-not (Test-Path -LiteralPath $envPath)) {
    Copy-Item -LiteralPath (Join-Path $projectRoot '.env.example') -Destination $envPath
}
$content = [System.IO.File]::ReadAllText($envPath)
$original = $content
function New-LocalSecret {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [Convert]::ToBase64String($bytes)
}
if ($content -notmatch '(?m)^PGADMIN_EMAIL=') {
    $content = $content.TrimEnd() + "`r`nPGADMIN_EMAIL=admin@tutormatching.com`r`n"
}
foreach ($setting in @(
    @{ Key = 'JWT_SIGNING_KEY'; Placeholder = 'replace-with-at-least-32-random-bytes' },
    @{ Key = 'LOCAL_ADMIN_PASSWORD'; Placeholder = 'change-me-local-password' }
)) {
    $pattern = '(?m)^' + $setting.Key + '=([^\r\n]*)'
    $match = [regex]::Match($content, $pattern)
    if (-not $match.Success) {
        $content = $content.TrimEnd() + "`r`n" + $setting.Key + '=' + (New-LocalSecret) + "`r`n"
    } elseif ([string]::IsNullOrWhiteSpace($match.Groups[1].Value) -or $match.Groups[1].Value -eq $setting.Placeholder) {
        $content = [regex]::Replace($content, $pattern, ($setting.Key + '=' + (New-LocalSecret)))
    }
}
if ($content -ne $original) {
    [System.IO.File]::WriteAllText($envPath, $content, (New-Object System.Text.UTF8Encoding($false)))
}
Write-Host 'Local .env ready. Existing passwords preserved; login details are in .env.'
