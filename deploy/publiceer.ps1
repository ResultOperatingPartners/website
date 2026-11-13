<#
  Publiceert de website van je laptop naar TransIP-webhosting.
  Gebruik in VS Code: Ctrl+Shift+B  (of: Terminal > Taak uitvoeren > Publiceren naar TransIP)
  Eerste keer of na wijzigen van instellingen:  .\deploy\publiceer.ps1 -MetConfig
#>
param([switch]$MetConfig)
$ErrorActionPreference = 'Stop'

$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
function Stop-Met($tekst) { Write-Host "`n$tekst`n" -ForegroundColor Red; exit 1 }

# Instellingen staan alleen op deze laptop (niet in GitHub)
$cfgPad = Join-Path $PSScriptRoot 'publiceer.config.psd1'
if (-not (Test-Path $cfgPad)) {
    Copy-Item (Join-Path $PSScriptRoot 'publiceer.config.voorbeeld.psd1') $cfgPad
    Stop-Met 'deploy\publiceer.config.psd1 is aangemaakt. Vul daarin Server, Gebruiker en BeheerIPs in en start opnieuw.'
}
$cfg = Import-PowerShellDataFile $cfgPad

if ($cfg.Server -like '*VUL-IN*' -or $cfg.Gebruiker -like '*VUL-IN*') { Stop-Met 'Vul eerst Server en Gebruiker in, in deploy\publiceer.config.psd1.' }
if ($cfg.BeheerIPs -contains '0.0.0.0') { Stop-Met 'Vul eerst je IP-adres in bij BeheerIPs, in deploy\publiceer.config.psd1.' }
$sleutel = [Environment]::ExpandEnvironmentVariables($cfg.Sleutel)
if (-not (Test-Path $sleutel)) { Stop-Met "SSH-sleutel niet gevonden: $sleutel. Zie TRANSIP.md, stap 3." }
if (-not (Get-Command sftp -ErrorAction SilentlyContinue)) { Stop-Met 'sftp niet gevonden. Installeer "OpenSSH-client" via Windows-instellingen > Optionele onderdelen.' }
if ($MetConfig -and -not (Test-Path (Join-Path $PSScriptRoot 'config.php'))) { Stop-Met 'deploy\config.php bestaat nog niet. Kopieer server\private\config.voorbeeld.php naar deploy\config.php en vul hem in.' }

# Waarschuwen als er wijzigingen zijn die nog niet in GitHub staan
$status = git status --porcelain 2>$null
if ($status) { Write-Host 'Let op: er zijn wijzigingen die nog niet zijn gecommit. Die worden wel gepubliceerd.' -ForegroundColor Yellow }

# 1. Klaarzetten
$stage = Join-Path $env:TEMP 'rop-publiceer'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
$www = New-Item -ItemType Directory (Join-Path $stage 'www')
$priv = New-Item -ItemType Directory (Join-Path $stage 'private')

Copy-Item 'index.html', '404.html', 'robots.txt', 'sitemap.xml', 'llms.txt' $www
Copy-Item 'afspraak', 'privacy', 'assets', '.well-known' $www -Recurse
Copy-Item 'server\www\*' $www -Recurse -Force          # api, beheer, .htaccess
Copy-Item 'server\private\lib.php' $priv

# Beheerpagina: alleen toegankelijk vanaf de opgegeven IP-adressen
$regels = @('# Automatisch gemaakt door publiceer.ps1', '<RequireAny>') + ($cfg.BeheerIPs | ForEach-Object { "  Require ip $_" }) + @('</RequireAny>')
Set-Content -Path (Join-Path $www 'beheer\.htaccess') -Value $regels -Encoding ascii

# Map "private" extra afschermen (mocht hij ooit toch onder www komen te staan)
Set-Content -Path (Join-Path $priv '.htaccess') -Value 'Require all denied' -Encoding ascii
if ($MetConfig) { Copy-Item (Join-Path $PSScriptRoot 'config.php') (Join-Path $priv 'config.php') }

# 2. Versturen via SFTP
$s = $stage -replace '\\', '/'
$batch = @(
  "-mkdir $($cfg.MapWebsite)",
  "-mkdir $($cfg.MapPrivaat)",
  "-mkdir $($cfg.MapPrivaat)/data",
  "put -r `"$s/www`" $($cfg.MapWebsite)",
  "put `"$s/private/lib.php`" $($cfg.MapPrivaat)/lib.php",
  "put `"$s/private/.htaccess`" $($cfg.MapPrivaat)/.htaccess"
)
if ($MetConfig) { $batch += "put `"$s/private/config.php`" $($cfg.MapPrivaat)/config.php"; $batch += "chmod 600 $($cfg.MapPrivaat)/config.php" }
$batchFile = Join-Path $stage 'sftp-opdrachten.txt'
Set-Content -Path $batchFile -Value $batch -Encoding ascii

Write-Host "Publiceren naar $($cfg.Gebruiker)@$($cfg.Server) ..." -ForegroundColor Cyan
& sftp -i $sleutel -P $cfg.Poort -o StrictHostKeyChecking=accept-new -b $batchFile "$($cfg.Gebruiker)@$($cfg.Server)"
$code = $LASTEXITCODE
Remove-Item $stage -Recurse -Force

if ($code -ne 0) { Stop-Met 'Publiceren mislukt. Controleer je internetverbinding, of je op een netwerk met een toegestaan IP-adres zit, en je SSH-sleutel.' }
Write-Host "`nKlaar! De website is bijgewerkt.`n" -ForegroundColor Green
