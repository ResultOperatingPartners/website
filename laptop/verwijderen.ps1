# Stopt en verwijdert het aanvragenprogramma van deze laptop.
Unregister-ScheduledTask -TaskName 'Result OP - aanvragen' -Confirm:$false -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like '*aanvragen.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Write-Host 'Aanvragenprogramma gestopt en verwijderd.' -ForegroundColor Green
