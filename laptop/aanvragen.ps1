<#
  Result Operating Partners - aanvragen verwerken op de laptop
  ------------------------------------------------------------
  Draait op de achtergrond zolang je bent ingelogd (zie installeren.ps1).

  1. Kijkt elke paar minuten of er een nieuwe aanvraag van de website binnen is
     (mail van FormSubmit met "Aanvraag kennismaking" in het onderwerp).
  2. Zet dat moment als VOORLOPIG in je agenda (de site toont het dan als bezet)
     en stuurt jou een mail met de knoppen "Accepteren" en "Ander moment voorstellen".
  3. Accepteren: de afspraak wordt definitief, de bezoeker krijgt een uitnodiging
     (= bevestiging met herinnering). Bij Teams komt er een Teams-link bij.
     Ander moment: het voorlopige blok wordt verwijderd en er opent een mail aan de bezoeker.

  Inloggen gaat met je eigen Microsoft-account (geen API-sleutel, geen wachtwoord in bestanden).
  De knoppen werken alleen op deze laptop, terwijl dit programma draait.
#>

$ErrorActionPreference = 'Stop'

# ---- Instellingen ----------------------------------------------------------
$Postvak       = 'dave@resultop.nl'
$Poort         = 47811                       # alleen bereikbaar vanaf deze laptop
$ControleerElk = 120                         # seconden tussen controles van de mailbox
$TijdZone      = 'W. Europe Standard Time'
$Afzender      = 'submissions@formsubmit.co'
$Map           = Join-Path $env:LOCALAPPDATA 'ResultOP'
$StatusBestand = Join-Path $Map 'aanvragen.json'
$Logboek       = Join-Path $Map 'logboek.txt'
$SleutelBestand = Join-Path $Map 'github-sleutel.txt'   # versleuteld (alleen leesbaar voor jouw Windows-account)
$Repo          = 'ResultOperatingPartners/website'
# ---------------------------------------------------------------------------

New-Item -ItemType Directory -Force -Path $Map | Out-Null

function Log($tekst) {
    $regel = '{0:yyyy-MM-dd HH:mm:ss}  {1}' -f (Get-Date), $tekst
    Add-Content -Path $Logboek -Value $regel -Encoding UTF8
}

function Html($t) { [System.Net.WebUtility]::HtmlEncode([string]$t) }

function Laad-Status {
    if (Test-Path $StatusBestand) {
        $obj = Get-Content $StatusBestand -Raw -Encoding UTF8 | ConvertFrom-Json
        $h = @{}
        foreach ($p in $obj.PSObject.Properties) { $h[$p.Name] = $p.Value }
        return $h
    }
    return @{}
}
function Bewaar-Status($status) {
    ($status | ConvertTo-Json -Depth 8) | Set-Content -Path $StatusBestand -Encoding UTF8
}

function Graph($methode, $pad, $inhoud) {
    $uri = 'https://graph.microsoft.com/v1.0' + $pad
    if ($null -ne $inhoud) {
        $json = $inhoud | ConvertTo-Json -Depth 10
        return Invoke-MgGraphRequest -Method $methode -Uri $uri -Body $json -ContentType 'application/json; charset=utf-8'
    }
    return Invoke-MgGraphRequest -Method $methode -Uri $uri
}

function Lees-Gegevens($html) {
    $m = [regex]::Match([string]$html, '\[\[ROP\]\]([A-Za-z0-9+/=]+)\[\[/ROP\]\]')
    if (-not $m.Success) { return $null }
    $json = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($m.Groups[1].Value))
    return $json | ConvertFrom-Json
}

function Details-Html($d) {
    $r = "<p><b>Naam:</b> $(Html $d.naam)<br><b>E-mail:</b> $(Html $d.email)"
    if ($d.telefoon) { $r += "<br><b>Telefoon:</b> $(Html $d.telefoon)" }
    if ($d.organisatie) { $r += "<br><b>Organisatie:</b> $(Html $d.organisatie)" }
    $r += "<br><b>Soort:</b> $(Html $d.soortTekst)<br><b>Moment:</b> $(Html $d.moment)</p>"
    if ($d.bericht) { $r += "<p><b>Toelichting:</b><br>$((Html $d.bericht) -replace "`n", '<br>')</p>" }
    return $r
}

function Nieuw-Token {
    $b = New-Object byte[] 24
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    return ([Convert]::ToBase64String($b) -replace '[+/=]', '')
}

# ---- Site direct laten bijwerken (zodat het moment snel bezet is) -----------
$script:bijwerkenOm = @()
function Plan-Sitebijwerking {
    # Nu (na een minuut) en nog eens na 6 minuten: Outlook werkt de gepubliceerde agenda met wat vertraging bij.
    $script:bijwerkenOm += (Get-Date).AddSeconds(60)
    $script:bijwerkenOm += (Get-Date).AddMinutes(6)
}
function Werk-SiteBij {
    if (-not (Test-Path $SleutelBestand)) { return }
    try {
        # Trim: het bestand eindigt met een regeleinde, daar struikelt ConvertTo-SecureString over
        $veilig = (Get-Content $SleutelBestand -Raw).Trim() | ConvertTo-SecureString
        $sleutel = [System.Net.NetworkCredential]::new('', $veilig).Password
        Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/$Repo/actions/workflows/pages.yml/dispatches" `
            -Headers @{ Authorization = "Bearer $sleutel"; Accept = 'application/vnd.github+json'; 'X-GitHub-Api-Version' = '2022-11-28' } `
            -Body '{"ref":"main"}' -ContentType 'application/json' | Out-Null
        Log 'Site laten bijwerken'
    } catch { Log "Site bijwerken mislukt: $($_.Exception.Message)" }
}

# ---- Stap 1 en 2: nieuwe aanvragen ophalen ---------------------------------
function Controleer-Mailbox($status) {
    $sinds = (Get-Date).ToUniversalTime().AddDays(-14).ToString('yyyy-MM-ddTHH:mm:ssZ')
    $pad = "/me/messages?`$filter=receivedDateTime ge $sinds and from/emailAddress/address eq '$Afzender'&`$select=id,subject,body,receivedDateTime&`$top=50"
    $res = Graph GET $pad $null
    foreach ($msg in $res.value) {
        $id = [string]$msg.id
        if ($status.ContainsKey($id)) { continue }
        if ([string]$msg.subject -notlike 'Aanvraag kennismaking*') { $status[$id] = @{ status = 'genegeerd' }; continue }
        $d = Lees-Gegevens $msg.body.content
        if ($null -eq $d) { $status[$id] = @{ status = 'onleesbaar' }; Log "Aanvraag zonder gegevensregel: $($msg.subject)"; continue }
        if ([datetime]$d.start -lt (Get-Date)) { $status[$id] = @{ status = 'verlopen' }; continue }

        # Voorlopig in de agenda (blokkeert het moment op de site)
        $event = Graph POST '/me/events' @{
            subject   = "Voorlopig: kennismaking $($d.naam)"
            start     = @{ dateTime = $d.start; timeZone = $TijdZone }
            end       = @{ dateTime = $d.eind;  timeZone = $TijdZone }
            showAs    = 'tentative'
            body      = @{ contentType = 'HTML'; content = "<p>Nog niet bevestigd. Accepteer via de mail 'Nieuwe aanvraag'.</p>" + (Details-Html $d) }
            isReminderOn = $false
        }

        $token = Nieuw-Token
        $basis = "http://localhost:$Poort"
        $sleutel = [uri]::EscapeDataString($id)
        $accept = "$basis/accepteren?id=$sleutel&t=$token"
        $ander  = "$basis/ander-moment?id=$sleutel&t=$token"

        $knop = 'display:inline-block;padding:12px 22px;border-radius:999px;font-weight:700;text-decoration:none;margin:6px 8px 6px 0'
        $inhoud = @"
<div style="font-family:Segoe UI,Arial,sans-serif;color:#14213d;font-size:15px">
<p>Er is een nieuwe aanvraag voor een kennismaking binnengekomen. Het moment staat als <b>voorlopig</b> in je agenda.</p>
$(Details-Html $d)
<p>
<a href="$accept" style="$knop;background:#c9a227;color:#14213d">Accepteren en uitnodiging sturen</a>
<a href="$ander" style="$knop;border:1.5px solid #14213d;color:#14213d">Ander moment voorstellen</a>
</p>
<p style="color:#5d6878;font-size:13px">De knoppen werken op je laptop zolang het aanvragenprogramma draait.</p>
</div>
"@
        Graph POST '/me/sendMail' @{
            message = @{
                subject = "Nieuwe aanvraag: $($d.naam), $($d.moment)"
                body = @{ contentType = 'HTML'; content = $inhoud }
                toRecipients = @(@{ emailAddress = @{ address = $Postvak } })
                importance = 'high'
            }
            saveToSentItems = $false
        } | Out-Null

        $status[$id] = @{ status = 'wacht'; token = $token; eventId = $event.id; gegevens = $d }
        Plan-Sitebijwerking
        Log "Nieuwe aanvraag: $($d.naam), $($d.moment)"
    }
}

# ---- Stap 3: knoppen afhandelen --------------------------------------------
function Pagina($titel, $tekst) {
    @"
<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><title>$(Html $titel)</title>
<style>body{font-family:Segoe UI,Arial,sans-serif;background:#14213d;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0}
main{background:#fff;color:#14213d;border-radius:12px;padding:36px 40px;max-width:560px}h1{margin-top:0}a{color:#14213d;font-weight:700}</style>
</head><body><main><h1>$(Html $titel)</h1>$tekst</main></body></html>
"@
}

function Behandel-Verzoek($ctx, $status) {
    $req = $ctx.Request
    $id = $req.QueryString['id']; $t = $req.QueryString['t']
    $pad = $req.Url.AbsolutePath
    $html = Pagina 'Onbekende link' '<p>Deze link is ongeldig of al gebruikt.</p>'

    try {
    if ($id -and $status.ContainsKey($id) -and $status[$id].token -and $status[$id].token -eq $t) {
        $item = $status[$id]; $d = $item.gegevens
        if ($item.status -ne 'wacht') {
            $html = Pagina 'Al verwerkt' "<p>Deze aanvraag is al verwerkt ($(Html $item.status)).</p>"
        }
        elseif ($pad -eq '/accepteren') {
            $tekst = "<p>Beste $(Html $d.naam),</p><p>Dank voor je aanvraag. Hierbij bevestig ik onze kennismaking op $(Html $d.moment).</p>"
            if ($d.soort -eq 'teams') { $tekst += '<p>De Teams-link staat in deze uitnodiging.</p>' }
            else { $tekst += "<p>Ik bel je op $(Html $d.telefoon).</p>" }
            $tekst += '<p>Met vriendelijke groet,<br>Dave Venmans<br>Result Operating Partners<br>06 46 74 85 49</p>'
            $wijziging = @{
                subject   = 'Kennismaking Result Operating Partners'
                showAs    = 'busy'
                isReminderOn = $true
                reminderMinutesBeforeStart = 15
                body      = @{ contentType = 'HTML'; content = $tekst }
                attendees = @(@{ type = 'required'; emailAddress = @{ address = $d.email; name = $d.naam } })
            }
            if ($d.soort -eq 'teams') {
                $wijziging.isOnlineMeeting = $true
                $wijziging.onlineMeetingProvider = 'teamsForBusiness'
            } else {
                $wijziging.location = @{ displayName = "Telefonisch ($($d.telefoon))" }
            }
            Graph PATCH ("/me/events/" + $item.eventId) $wijziging | Out-Null
            $item.status = 'geaccepteerd'
            Plan-Sitebijwerking
            Log "Geaccepteerd: $($d.naam), $($d.moment)"
            $html = Pagina 'Afspraak bevestigd' "<p>De afspraak met <b>$(Html $d.naam)</b> op $(Html $d.moment) staat vast in je agenda. $(Html $d.naam) heeft een uitnodiging ontvangen op $(Html $d.email).</p>"
        }
        elseif ($pad -eq '/ander-moment') {
            try { Graph DELETE ("/me/events/" + $item.eventId) $null | Out-Null } catch { Log "Voorlopig blok niet gevonden: $($_.Exception.Message)" }
            $item.status = 'ander moment'
            Plan-Sitebijwerking
            Log "Ander moment: $($d.naam)"
            $onderwerp = [uri]::EscapeDataString('Je aanvraag voor een kennismaking')
            $tekstMail = [uri]::EscapeDataString("Beste $($d.naam),`n`nDank voor je aanvraag voor een kennismaking op $($d.moment). Helaas past dat moment mij niet. Zou een van de volgende momenten wel uitkomen?`n`n- `n- `n`nMet vriendelijke groet,`nDave Venmans`nResult Operating Partners`n06 46 74 85 49")
            $mailto = "mailto:$($d.email)?subject=$onderwerp&body=$tekstMail"
            $html = Pagina 'Voorlopig blok verwijderd' "<p>Het moment is weer vrij in je agenda.</p><p><a href=""$mailto"">Mail $(Html $d.naam) een ander moment</a></p>"
        }
        Bewaar-Status $status
    }
    } catch {
        Log "Fout bij knop: $($_.Exception.Message)"
        $html = Pagina 'Er ging iets mis' "<p>De actie is niet gelukt. Probeer het zo nog eens; staat het programma aan en ben je online?</p><p style='color:#5d6878;font-size:13px'>$(Html $_.Exception.Message)</p>"
    }

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($html)
    $ctx.Response.ContentType = 'text/html; charset=utf-8'
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $ctx.Response.Close()
}

# ---- Start -----------------------------------------------------------------
Import-Module Microsoft.Graph.Authentication
# Inloggen via de gewone browser (het Windows-inlogvenster verdwijnt soms achter andere vensters)
Set-MgGraphOption -DisableLoginByWAM $true
Connect-MgGraph -Scopes 'Mail.ReadWrite', 'Mail.Send', 'Calendars.ReadWrite' -NoWelcome
Log 'Gestart'

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Poort/")
$listener.Start()

$status = Laad-Status
$volgende = Get-Date
$wacht = $listener.GetContextAsync()
try {
    while ($true) {
        if ((Get-Date) -ge $volgende) {
            try { Controleer-Mailbox $status; Bewaar-Status $status }
            catch { Log "Fout bij controleren: $($_.Exception.Message)" }
            $volgende = (Get-Date).AddSeconds($ControleerElk)
        }
        if ($script:bijwerkenOm.Count -gt 0 -and (Get-Date) -ge ($script:bijwerkenOm | Sort-Object | Select-Object -First 1)) {
            $nu = Get-Date
            $script:bijwerkenOm = @($script:bijwerkenOm | Where-Object { $_ -gt $nu })
            Werk-SiteBij
        }
        if ($wacht.Wait(500)) {
            try { Behandel-Verzoek $wacht.Result $status }
            catch { Log "Fout bij knop: $($_.Exception.Message)" }
            $wacht = $listener.GetContextAsync()
        }
    }
}
finally {
    $listener.Stop()
    Log 'Gestopt'
}
