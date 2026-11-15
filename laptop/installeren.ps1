param([switch]$NieuweSleutel)
<#
  Installeert het aanvragenprogramma op deze laptop (eenmalig).
  Met -NieuweSleutel vraag je opnieuw om de GitHub-sleutel.
  Start in PowerShell vanuit de map van de website:
      powershell -ExecutionPolicy Bypass -File .\laptop\installeren.ps1
#>
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'aanvragen.ps1'

Write-Host "`n1/4  Microsoft Graph-module controleren..." -ForegroundColor Cyan
if (-not (Get-Module -ListAvailable Microsoft.Graph.Authentication)) {
    Install-Module Microsoft.Graph.Authentication -Scope CurrentUser -Force -AllowClobber
}
Import-Module Microsoft.Graph.Authentication
# Inloggen via de gewone browser (het Windows-inlogvenster verdwijnt soms achter andere vensters)
Set-MgGraphOption -DisableLoginByWAM $true

Write-Host "2/4  Inloggen met je Microsoft-account (dave@resultop.nl)..." -ForegroundColor Cyan
Write-Host "     Je browser opent met een Microsoft-inlogpagina. Log in en geef toestemming voor e-mail en agenda." -ForegroundColor Gray
Connect-MgGraph -Scopes 'Mail.ReadWrite', 'Mail.Send', 'Calendars.ReadWrite' -NoWelcome
$ik = (Get-MgContext).Account
if (-not $ik) { Write-Host "`nInloggen is niet gelukt. Start dit script opnieuw." -ForegroundColor Red; exit 1 }
Write-Host "     Ingelogd als $ik" -ForegroundColor Green

Write-Host "3/4  GitHub-sleutel (laat de site direct bijwerken na een nieuwe afspraak)..." -ForegroundColor Cyan
$map = Join-Path $env:LOCALAPPDATA 'ResultOP'; New-Item -ItemType Directory -Force -Path $map | Out-Null
$sleutelBestand = Join-Path $map 'github-sleutel.txt'
if ($NieuweSleutel -or -not (Test-Path $sleutelBestand)) {
    $s = Read-Host '     Plak de GitHub-sleutel (begint met github_pat_) en druk op Enter, of druk alleen op Enter om over te slaan' -AsSecureString
    if ($s.Length -gt 0) {
        $s | ConvertFrom-SecureString | Set-Content -Path $sleutelBestand
        Write-Host '     Sleutel versleuteld opgeslagen.' -ForegroundColor Green
    } else { Write-Host '     Overgeslagen: de site wordt dan elk uur bijgewerkt.' -ForegroundColor Yellow }
} else { Write-Host '     Sleutel is al opgeslagen.' -ForegroundColor Green }

Write-Host "4/4  Automatisch starten bij inloggen instellen..." -ForegroundColor Cyan
$naam = 'Result OP - aanvragen'
$vbs = Join-Path $PSScriptRoot 'start-verborgen.vbs'
$actie = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$vbs`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$inst = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 99 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
# Een eventueel draaiende oude versie (met zichtbaar venster) stoppen
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like '*aanvragen.ps1*' -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Register-ScheduledTask -TaskName $naam -Action $actie -Trigger $trigger -Settings $inst -Description 'Verwerkt aanvragen van resultop.nl' -Force | Out-Null
Start-ScheduledTask -TaskName $naam

Write-Host "`nKlaar. Het programma draait nu en start voortaan vanzelf als je inlogt." -ForegroundColor Green
Write-Host "Logboek: $env:LOCALAPPDATA\ResultOP\logboek.txt`n"
