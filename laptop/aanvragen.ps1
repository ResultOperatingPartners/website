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
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

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
    # Nog eens na 15 minuten voor de zekerheid. Momenten die vlak bij een al geplande keer liggen, slaan we over.
    foreach ($m in @((Get-Date).AddSeconds(60), (Get-Date).AddMinutes(6), (Get-Date).AddMinutes(15))) {
        $dichtbij = $script:bijwerkenOm | Where-Object { [math]::Abs(($_ - $m).TotalSeconds) -lt 150 }
        if (-not $dichtbij) { $script:bijwerkenOm += $m }
    }
}

# ---- Eigen agendawijzigingen opmerken (afspraak erbij, weg of verzet) -------
$script:vorigeAgenda = $null
function Controleer-Agenda {
    $van = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    $tot = (Get-Date).ToUniversalTime().AddDays(120).ToString('yyyy-MM-ddTHH:mm:ssZ')
    $pad = "/me/calendarView?startDateTime=$van&endDateTime=$tot&`$select=id,start,end,showAs,isCancelled&`$top=999"
    $regels = @()
    while ($pad) {
        $res = Graph GET $pad $null
        foreach ($e in $res.value) {
            $regels += "$($e.id)|$($e.start.dateTime)|$($e.end.dateTime)|$($e.showAs)|$($e.isCancelled)"
        }
        $volgendeLink = $res.'@odata.nextLink'
        $pad = if ($volgendeLink) { $volgendeLink -replace '^https://graph.microsoft.com/v1.0', '' } else { $null }
    }
    $afdruk = (($regels | Sort-Object) -join "`n")
    if ($null -ne $script:vorigeAgenda -and $afdruk -ne $script:vorigeAgenda) {
        Log 'Agenda gewijzigd'
        Plan-Sitebijwerking
    }
    $script:vorigeAgenda = $afdruk
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
<style>body{font-family:Segoe UI,Arial,sans-serif;background:#14213d;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px 0}
main{background:#fff;color:#14213d;border-radius:12px;padding:36px 40px;max-width:680px}h1{margin-top:0}a{color:#14213d;font-weight:700}
.dag{margin:18px 0 8px;font-weight:700;text-transform:capitalize}.chips{display:flex;flex-wrap:wrap;gap:8px}
.chips label{border:1.5px solid #c8ced8;border-radius:999px;padding:6px 12px;cursor:pointer;font-size:14px}
.chips label:has(input:checked){border-color:#14213d;background:#14213d;color:#fff}.chips input{margin:0 6px 0 0}
textarea{width:100%;box-sizing:border-box;min-height:90px;font:inherit;padding:10px;border:1.5px solid #c8ced8;border-radius:8px}
button{margin-top:18px;padding:12px 24px;border:0;border-radius:999px;background:#c9a227;color:#14213d;font-weight:700;font-size:15px;cursor:pointer}
.klein{color:#5d6878;font-size:13px}.fout{color:#a4262c;font-weight:700}</style>
</head><body><main><h1>$(Html $titel)</h1>$tekst</main></body></html>
"@
}

# ---- Vrije momenten volgens de instellingen van de site + je agenda ---------
$NL = [System.Globalization.CultureInfo]::GetCultureInfo('nl-NL')
function Lees-Instellingen {
    $c = @{ blokken = @{ 5 = @(, @(540, 1020)) }; duur = 30; stap = 30; vooraf = 24; dagen = 60; uit = @(); na = 0 }
    $pad = Join-Path $PSScriptRoot '..\assets\afspraak-config.js'
    if (-not (Test-Path $pad)) { return $c }
    $txt = ((Get-Content $pad -Encoding UTF8) | Where-Object { $_ -notmatch '^\s*//' }) -join "`n"
    $namen = 'zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'
    $blokken = @{}
    for ($i = 0; $i -lt 7; $i++) {
        $m = [regex]::Match($txt, "(?m)^\s*$($namen[$i])\s*:\s*\[(.*)\]")
        if (-not $m.Success) { continue }
        $lijst = @()
        foreach ($p in [regex]::Matches($m.Groups[1].Value, "'(\d\d):(\d\d)'\s*,\s*'(\d\d):(\d\d)'")) {
            $lijst += , @(([int]$p.Groups[1].Value * 60 + [int]$p.Groups[2].Value), ([int]$p.Groups[3].Value * 60 + [int]$p.Groups[4].Value))
        }
        if ($lijst.Count) { $blokken[$i] = $lijst }
    }
    if ($blokken.Count) { $c.blokken = $blokken }
    foreach ($k in @(@('na', 'bufferNaAfspraakMinuten'), @('duur', 'duurMinuten'), @('stap', 'stapMinuten'), @('vooraf', 'minimaalUrenVooraf'), @('dagen', 'maximaalDagenVooruit'))) {
        $m = [regex]::Match($txt, "$($k[1])\s*:\s*(\d+)")
        if ($m.Success) { $c[$k[0]] = [int]$m.Groups[1].Value }
    }
    $m = [regex]::Match($txt, 'nietBeschikbaar\s*:\s*\[([\s\S]*?)\]')
    if ($m.Success) { $c.uit = @([regex]::Matches($m.Groups[1].Value, '\d{4}-\d{2}-\d{2}') | ForEach-Object { $_.Value }) }
    return $c
}

function Vrije-Momenten($negeerEventId, $origineel) {
    $c = Lees-Instellingen
    $van = (Get-Date).Date
    $tot = $van.AddDays($c.dagen + 1)
    $uri = 'https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=' + $van.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ') +
           '&endDateTime=' + $tot.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ') + '&$select=id,start,end,showAs,isCancelled&$top=999'
    $bezet = @()
    while ($uri) {
        $res = Invoke-MgGraphRequest -Method GET -Uri $uri -Headers @{ Prefer = "outlook.timezone=`"$TijdZone`"" }
        foreach ($e in $res.value) {
            if ($e.id -eq $negeerEventId -or $e.isCancelled -or $e.showAs -eq 'free') { continue }
            $bezet += , @([datetime]::Parse($e.start.dateTime, [cultureinfo]::InvariantCulture), [datetime]::Parse($e.end.dateTime, [cultureinfo]::InvariantCulture))
        }
        $uri = $res.'@odata.nextLink'
    }
    $vroegst = (Get-Date).AddHours($c.vooraf)
    $uit = @()
    for ($i = 0; $i -le $c.dagen; $i++) {
        $dag = $van.AddDays($i)
        if ($c.uit -contains $dag.ToString('yyyy-MM-dd')) { continue }
        $blok = $c.blokken[[int]$dag.DayOfWeek]
        if (-not $blok) { continue }
        foreach ($b in $blok) {
            for ($s = $b[0]; $s + $c.duur -le $b[1]; $s += $c.stap) {
                $begin = $dag.AddMinutes($s); $eind = $begin.AddMinutes($c.duur)
                if ($begin -lt $vroegst -or $begin -eq $origineel) { continue }
                $vrij = $true
                foreach ($x in $bezet) { if ($x[0] -lt $eind -and $x[1].AddMinutes($c.na) -gt $begin) { $vrij = $false; break } }
                if ($vrij) { $uit += [pscustomobject]@{ start = $begin; eind = $eind } }
            }
        }
    }
    return $uit
}

function Moment-Tekst($begin, $eind) {
    return $begin.ToString('dddd d MMMM', $NL) + ', ' + $begin.ToString('HH:mm') + ' - ' + $eind.ToString('HH:mm') + ' uur'
}

function Keuze-Pagina($id, $t, $d, $opties, $melding) {
    $r = "<p>Kies een of meer momenten die je <b>$(Html $d.naam)</b> wilt voorstellen in plaats van $(Html $d.moment). " +
         "$(Html $d.naam) krijgt daarna automatisch een nette mail met deze momenten.</p>"
    if ($melding) { $r += "<p class='fout'>$(Html $melding)</p>" }
    if (-not $opties.Count) {
        return $r + "<p>Er zijn geen vrije momenten gevonden binnen de periode die de site toont. Pas je beschikbaarheid aan of mail $(Html $d.naam) zelf: <a href='mailto:$(Html $d.email)'>$(Html $d.email)</a>.</p>"
    }
    $r += "<form method='post' action='/ander-moment'><input type='hidden' name='id' value='$(Html $id)'><input type='hidden' name='t' value='$(Html $t)'>"
    foreach ($groep in ($opties | Group-Object { $_.start.Date })) {
        $r += "<div class='dag'>$(Html ($groep.Group[0].start.ToString('dddd d MMMM', $NL)))</div><div class='chips'>"
        foreach ($o in $groep.Group) {
            $r += "<label><input type='checkbox' name='keuze' value='$($o.start.ToString('yyyy-MM-ddTHH:mm'))'>$($o.start.ToString('HH:mm'))</label>"
        }
        $r += '</div>'
    }
    $r += "<p class='dag' style='text-transform:none'>Persoonlijke toevoeging (optioneel)</p><textarea name='opmerking' placeholder='Bijvoorbeeld: Vrijdagochtend heeft mijn voorkeur.'></textarea>"
    $r += "<button type='submit'>Verstuur voorstel aan $(Html $d.naam)</button>"
    $r += "<p class='klein'>Het voorlopige blok voor $(Html $d.moment) wordt daarbij uit je agenda gehaald.</p></form>"
    return $r
}

function Voorstel-Mail($d, $momenten, $opmerking) {
    $soort = if ($d.soort -eq 'teams') { 'een Teams-gesprek' } else { 'een telefonische kennismaking' }
    $lijst = ($momenten | ForEach-Object { "<li style='margin:4px 0'>$(Html (Moment-Tekst $_.start $_.eind))</li>" }) -join ''
    $extra = if ($opmerking) { "<p>$((Html $opmerking) -replace "`r?`n", '<br>')</p>" } else { '' }
    $vraag = if ($momenten.Count -gt 1) { 'Laat je weten welk moment je het beste uitkomt?' } else { 'Laat je weten of dit moment je uitkomt?' }
    return @"
<div style="font-family:Segoe UI,Arial,sans-serif;color:#14213d;font-size:15px;line-height:1.55">
<p>Beste $(Html $d.naam),</p>
<p>Dank voor je aanvraag voor $soort. Het moment dat je koos, $(Html $d.moment), kan ik helaas niet vrijmaken. Graag stel ik een ander moment voor:</p>
<ul style="padding-left:20px">$lijst</ul>
$extra
<p>$vraag Een kort antwoord op deze mail is voldoende; je ontvangt daarna een uitnodiging in je agenda.</p>
<p>Met vriendelijke groet,<br><b>Dave Venmans</b><br>Result Operating Partners<br>06 46 74 85 49<br><a href="https://www.resultop.nl" style="color:#14213d">www.resultop.nl</a></p>
</div>
"@
}

function Behandel-Verzoek($ctx, $status) {
    $req = $ctx.Request
    $form = $null
    if ($req.HttpMethod -eq 'POST') {
        $lezer = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
        $form = [System.Web.HttpUtility]::ParseQueryString($lezer.ReadToEnd())
        $id = $form['id']; $t = $form['t']
    } else { $id = $req.QueryString['id']; $t = $req.QueryString['t'] }
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
        elseif ($pad -eq '/ander-moment' -and $null -eq $form) {
            # Stap 1: vrije momenten tonen om uit te kiezen
            $opties = @(Vrije-Momenten $item.eventId ([datetime]$d.start))
            $html = Pagina 'Ander moment voorstellen' (Keuze-Pagina $id $t $d $opties $null)
        }
        elseif ($pad -eq '/ander-moment') {
            # Stap 2: gekozen momenten mailen
            $gekozen = @($form.GetValues('keuze') | Where-Object { $_ })
            if (-not $gekozen.Count) {
                $opties = @(Vrije-Momenten $item.eventId ([datetime]$d.start))
                $html = Pagina 'Ander moment voorstellen' (Keuze-Pagina $id $t $d $opties 'Kies minstens een moment.')
            } else {
                $duur = ([datetime]$d.eind - [datetime]$d.start).TotalMinutes
                if ($duur -le 0) { $duur = 30 }
                $momenten = @($gekozen | Sort-Object | ForEach-Object {
                    $b = [datetime]::ParseExact($_, 'yyyy-MM-ddTHH:mm', [cultureinfo]::InvariantCulture)
                    [pscustomobject]@{ start = $b; eind = $b.AddMinutes($duur) }
                })
                Graph POST '/me/sendMail' @{
                    message = @{
                        subject = 'Kennismaking Result Operating Partners: voorstel voor een nieuw moment'
                        body = @{ contentType = 'HTML'; content = (Voorstel-Mail $d $momenten $form['opmerking']) }
                        toRecipients = @(@{ emailAddress = @{ address = $d.email; name = $d.naam } })
                    }
                    saveToSentItems = $true
                } | Out-Null
                try { Graph DELETE ("/me/events/" + $item.eventId) $null | Out-Null } catch { Log "Voorlopig blok niet gevonden: $($_.Exception.Message)" }
                $item.status = 'ander moment voorgesteld'
                Plan-Sitebijwerking
                Log "Ander moment voorgesteld aan $($d.naam): $($momenten.Count) moment(en)"
                $lijst = ($momenten | ForEach-Object { "<li>$(Html (Moment-Tekst $_.start $_.eind))</li>" }) -join ''
                $html = Pagina 'Voorstel verstuurd' "<p>$(Html $d.naam) heeft een mail gekregen op $(Html $d.email) met:</p><ul>$lijst</ul><p>Het voorlopige blok is uit je agenda gehaald. De mail staat in je Verzonden items; het antwoord komt gewoon in je inbox.</p>"
            }
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
Add-Type -AssemblyName System.Web
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
            try { Controleer-Agenda }
            catch { Log "Fout bij agenda controleren: $($_.Exception.Message)" }
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
