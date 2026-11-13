# Website op TransIP: installatie

**Opzet**
- **Website, reserveringspagina en contactformulier:** TransIP-webhosting, in Nederland, altijd online.
- **Bij een aanvraag:** de aanvraag wordt opgeslagen buiten de openbare map. Jij krijgt een mail op dave@resultop.nl en de bezoeker krijgt automatisch een bevestiging.
- **Beheerpagina** (`/beheer/`): alleen vanaf jouw IP-adres en met een wachtwoord.
- **Publiceren:** vanaf je laptop, met een SSH-sleutel. SFTP staat alleen open voor jouw IP-adres. GitHub heeft geen toegang tot de hosting nodig.

Geef wachtwoorden en sleutels nooit aan iemand anders, ook niet aan Claude.

---

## Stap 1 – Webhosting bestellen
Bestel bij TransIP het kleinste webhostingpakket voor **resultop.nl**. Laat de **e-mail** van resultop.nl bij Microsoft 365: wijzig de MX-records niet.

## Stap 2 – Je IP-adres
Je IP-adressen staan bewust niet in GitHub (de repo is openbaar). Zoek ze op via https://api.ipify.org (IPv4) en https://api64.ipify.org (IPv6; neem de eerste drie blokken + `::/48`).
1. Vraag je internetprovider of dit een **vast** IP-adres is. Een wisselend adres sluit je op den duur buiten.
2. Werk je ook vanaf kantoor of een andere plek? Zoek daar je adres op via https://api.ipify.org en https://api64.ipify.org en voeg het toe.
3. Het adres staat op twee plekken:
   - `deploy/publiceer.config.psd1` → `BeheerIPs` (wordt bij de eerste keer publiceren aangemaakt uit het voorbeeld)
   - `deploy/config.php` → `beheer_ips` (zie stap 5)

## Stap 3 – SSH-sleutel maken (op je laptop)
Open in VS Code een terminal (**Ctrl+`**) en voer uit:
```powershell
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\resultop_transip -C "resultop-laptop"
```
- Kies een wachtwoordzin. Die beschermt de sleutel als je laptop kwijtraakt.
- Laat de **publieke** sleutel zien:
```powershell
Get-Content $env:USERPROFILE\.ssh\resultop_transip.pub
```
- Plak die regel (begint met `ssh-ed25519`) in het TransIP-controlepaneel bij je webhosting → **SSH/SFTP** → **SSH-sleutels**.
- Het bestand **zonder** `.pub` is je geheime sleutel. Die blijft op je laptop.

## Stap 4 – Toegang beperken tot jouw IP (TransIP-controlepaneel)
- **Webhosting → SFTP/SSH:** alleen jouw IP-adres toestaan, inloggen met wachtwoord uitzetten.
- **Account → Beveiliging:** tweestapsverificatie aan, en waar mogelijk IP-beperking voor het controlepaneel en de API.

## Stap 5 – Instellingen invullen
1. Vul in `deploy/publiceer.config.psd1` `Server` en `Gebruiker` in. Die staan in het controlepaneel bij SFTP/SSH.
2. Kopieer `server/private/config.voorbeeld.php` naar **`deploy/config.php`**. Dit bestand gaat niet naar GitHub. Vul je IP-adres in.

## Stap 6 – Eerste keer publiceren
In VS Code: **Terminal → Taak uitvoeren → Publiceren naar TransIP (met instellingen)**.
Daarna volstaat **Ctrl+Shift+B** ("Publiceren naar TransIP").

## Stap 7 – Wachtwoord van de beheerpagina
1. Open https://resultop.nl/beheer/wachtwoord.php vanaf je eigen netwerk.
2. Kies een wachtwoord van minimaal 12 tekens. Je krijgt een versleutelde regel te zien.
3. Plak die regel in `deploy/config.php` bij `beheer_wachtwoord_hash` en publiceer opnieuw **met instellingen**.
4. Log in op https://resultop.nl/beheer/.

## Stap 8 – Mail goed laten aankomen (DNS bij TransIP)
De bevestigingsmails worden via de mailserver van TransIP verstuurd. Om ze niet in de spam te laten belanden, voeg je in de DNS van resultop.nl de **authenticatierecords** toe die TransIP aangeeft (`x-transip-mail-auth`, SPF, DKIM). Laat de Microsoft 365-records staan en voeg TransIP toe aan de bestaande SPF-regel. Zonder die toevoeging worden de bevestigingsmails geweigerd, omdat de huidige SPF-regel eindigt op `-all` (zie `STAPPEN.md`). Claude kan dit met je instellen; controleer elke wijziging voordat je opslaat.

## Stap 9 – Testen
1. Doe een aanvraag via https://resultop.nl/afspraak.html met je privé-e-mailadres.
2. Controleer:
   - de mail aan dave@resultop.nl;
   - de bevestiging in je privémail (kijk ook in de spam);
   - de aanvraag op de beheerpagina.
3. Verwijder de testaanvraag op de beheerpagina.
