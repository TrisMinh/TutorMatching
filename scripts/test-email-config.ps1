param([Parameter(Mandatory = $true)]$ComposeConfiguration)
$ErrorActionPreference = 'Stop'
foreach ($serviceName in @('identity-service', 'notification-service')) {
    $settings = $ComposeConfiguration.services.$serviceName.environment
    $provider = ([string]$settings.Email__Provider).Trim().ToLowerInvariant()
    if ($provider -eq 'mailpit') { continue }
    if ($provider -ne 'gmail') { throw 'EMAIL_PROVIDER in .env must be mailpit or gmail.' }
    $username = ([string]$settings.Email__Gmail__Username).Trim()
    $password = ([string]$settings.Email__Gmail__AppPassword).Replace(' ', '')
    if ([string]::IsNullOrWhiteSpace($username) -or [string]::IsNullOrWhiteSpace($password)) {
        throw 'Gmail selected: fill GMAIL_USERNAME and GMAIL_APP_PASSWORD in .env before rebuilding, or select EMAIL_PROVIDER=mailpit.'
    }
    if ($username -cmatch '^[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*$') { $username += '@gmail.com' }
    try { $address = New-Object System.Net.Mail.MailAddress($username) } catch {
        throw 'GMAIL_USERNAME in .env must be a full email address or a Gmail username without @gmail.com.'
    }
    if ($address.Address -ine $username) { throw 'GMAIL_USERNAME in .env must contain only the email address, without a display name.' }
}
Write-Host 'Email configuration: valid. No credentials displayed or email sent.'
