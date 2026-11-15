<#
  Installeert het aanvragenprogramma op deze laptop (eenmalig).
  Start in PowerShell vanuit de map van de website:
      powershell -ExecutionPolicy Bypass -File .\laptop\installeren.ps1
#>
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'aanvragen.ps1'

Write-Host "`n1/3  Microsoft Graph-module controleren..." -ForegroundColor Cyan
if (-not (Get-Module -ListAvailable Microsoft.Graph.Authentication)) {
    Install-Module Microsoft.Graph.Authentication -Scope CurrentUser -Force -AllowClobber
}
Import-Module Microsoft.Graph.Authentication

Write-Host "2/3  Inloggen met je Microsoft-account (dave@resultop.nl)..." -ForegroundColor Cyan
Write-Host "     Er opent een inlogvenster. Geef toestemming voor: e-mail lezen/versturen en agenda beheren." -ForegroundColor Gray
Connect-MgGraph -Scopes 'Mail.ReadWrite', 'Mail.Send', 'Calendars.ReadWrite' -NoWelcome
$ik = (Get-MgContext).Account
Write-Host "     Ingelogd als $ik" -ForegroundColor Green

Write-Host "3/3  Automatisch starten bij inloggen instellen..." -ForegroundColor Cyan
$naam = 'Result OP - aanvragen'
$actie = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$inst = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 99 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $naam -Action $actie -Trigger $trigger -Settings $inst -Description 'Verwerkt aanvragen van resultop.nl' -Force | Out-Null
Start-ScheduledTask -TaskName $naam

Write-Host "`nKlaar. Het programma draait nu en start voortaan vanzelf als je inlogt." -ForegroundColor Green
Write-Host "Logboek: $env:LOCALAPPDATA\ResultOP\logboek.txt`n"
