# Installatie: website + eigen reserveringspagina

Deze handleiding zet de website online op **resultop.nl** met de eigen reserveringspagina (`afspraak.html`).

**Hoe het werkt:**
- **Website en reserveringspagina:** Azure Static Web Apps, regio West-Europa.
- **Beveiligd gedeelte** (`/api`): haalt vrije tijden op uit Outlook en plant afspraken in. De geheime sleutel staat alleen in Azure, nooit in deze repository of in de browser van een bezoeker.
- **Gegevens van bezoekers:** gaan rechtstreeks naar je eigen Microsoft 365-agenda. Er wordt niets anders opgeslagen.
- **Domeinnaam:** blijft bij TransIP. E-mail via Microsoft 365 blijft ongewijzigd.

Reken op ongeveer 30 minuten. Je hebt beheerdersrechten nodig op Microsoft 365.

---

## Stap 1 – Azure-account
1. Ga naar https://portal.azure.com en log in met **dave@resultop.nl**.
2. Heb je nog geen abonnement? Kies **Abonnement maken** → **Betalen per gebruik**. De gratis versie van Static Web Apps kost €0. Er is alleen een creditcard nodig ter verificatie.

## Stap 2 – Static Web App aanmaken
1. Zoek bovenin naar **Static Web Apps** → **+ Maken**.
2. Vul in:
   - **Naam:** `result-website`
   - **Abonnement:** het abonnement uit stap 1
   - **Plantype:** *Free*
   - **Regio (Azure Functions en staging):** *West Europe*
   - **Bron:** *GitHub* → log in → organisatie **ResultOperatingPartners**, repository **website**, branch **main**
   - **Build-voorinstelling:** *Custom*
   - **App-locatie:** `/` · **API-locatie:** `api` · **Uitvoerlocatie:** leeg laten
3. Klik op **Controleren en maken** → **Maken**.
   Azure zet automatisch een bestand in `.github/workflows/` in deze repository. Elke wijziging op `main` wordt daarna vanzelf gepubliceerd.

## Stap 3 – App-registratie (toegang tot je agenda)
1. Ga naar https://entra.microsoft.com → **Identiteit** → **Toepassingen** → **App-registraties** → **+ Nieuwe registratie**.
2. **Naam:** `Result reserveringspagina` · **Alleen accounts in deze organisatiemap** → **Registreren**.
3. Noteer van de overzichtspagina:
   - **Toepassings-id (client)**
   - **Map-id (tenant)**
4. Ga naar **Certificaten en geheimen** → **+ Nieuw clientgeheim** → geldig 24 maanden → kopieer direct de **Waarde**. Die zie je maar één keer.
5. Ga naar **Bedrijfstoepassingen**, zoek `Result reserveringspagina` op en noteer de **Object-id**.

> Geef de app géén API-machtigingen in Entra. De toegang wordt in stap 4 zó ingesteld dat de app **alleen bij de agenda van dave@resultop.nl** kan, en bij geen enkele andere mailbox.

## Stap 4 – Toegang beperken tot alleen jouw agenda
Open **PowerShell** op je computer en voer uit. Vervang `<CLIENT-ID>` en `<OBJECT-ID>` door de waarden uit stap 3.

```powershell
Install-Module ExchangeOnlineManagement -Scope CurrentUser   # alleen de eerste keer
Connect-ExchangeOnline -UserPrincipalName dave@resultop.nl

New-ServicePrincipal -AppId <CLIENT-ID> -ObjectId <OBJECT-ID> -DisplayName "Result reserveringspagina"
New-ManagementScope -Name "Alleen agenda Dave" -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'dave@resultop.nl'"
New-ManagementRoleAssignment -App <CLIENT-ID> -Role "Application Calendars.ReadWrite" -CustomResourceScope "Alleen agenda Dave"

# Controle: moet bij dave@resultop.nl "InScope: True" geven
Test-ServicePrincipalAuthorization -Identity <CLIENT-ID> -Resource dave@resultop.nl
```

Het kan tot een uur duren voordat de rechten actief zijn.

## Stap 5 – Instellingen in Azure invullen
In de Static Web App: **Instellingen** → **Omgevingsvariabelen** → voeg toe en klik op **Toepassen**:

| Naam | Waarde |
|---|---|
| `GRAPH_TENANT_ID` | Map-id (tenant) uit stap 3 |
| `GRAPH_CLIENT_ID` | Toepassings-id (client) uit stap 3 |
| `GRAPH_CLIENT_SECRET` | Waarde van het clientgeheim uit stap 3 |
| `AGENDA_MAILBOX` | `dave@resultop.nl` |
| `BESCHIKBAARHEID` | `5:09:00-17:00` (vrijdag 9–17 uur) |

Optioneel, met de standaardwaarde tussen haakjes: `DUUR_MINUTEN` (30), `BUFFER_MINUTEN` (15), `STAP_MINUTEN` (30), `MINIMAAL_UREN_VOORAF` (24), `MAXIMAAL_DAGEN_VOORUIT` (60).

**Beschikbaarheid aanpassen:** dag 1 = maandag … 7 = zondag. Bijvoorbeeld:
- `2:09:00-12:00,5:09:00-17:00` = dinsdagochtend en vrijdag.
- Vakantie of een afspraak zet je gewoon in Outlook. Die tijden worden automatisch overgeslagen.

## Stap 5b – Afgeschermde testomgeving (alleen jij)
De site staat standaard **achter een inlog**: alleen gebruikers met de rol `eigenaar` kunnen hem zien. Iedereen anders komt op een pagina "Binnenkort online".
1. Static Web App → **Rolbeheer** → **Uitnodigen**.
2. **Verificatieprovider:** *Microsoft Entra ID* · **Gebruiker:** `dave@resultop.nl` · **Rol:** `eigenaar` · **Verloopt na:** 168 uur.
3. Open de uitnodigingslink, log in met je Microsoft-account en geef toestemming.
Wil je dat iemand anders meekijkt? Nodig die persoon op dezelfde manier uit, met maximaal 25 personen.

**Testvarianten:** elke branch of pull request op GitHub krijgt automatisch een eigen testadres, dat ook afgeschermd is. Zo kun je varianten naast elkaar bekijken zonder de hoofdversie te wijzigen.

**Live gaan:** laat Claude in `staticwebapp.config.json` de regels met `"allowedRoles": ["eigenaar"]` weghalen. Daarna is de site openbaar.

## Stap 6 – Testen op het tijdelijke adres
1. Open in de Static Web App de **URL** (eindigt op `azurestaticapps.net`) en ga naar `/afspraak.html`.
2. Boek een testafspraak met je privé-e-mailadres. Controleer dan:
   - **In je Outlook-agenda:** de afspraak staat erin.
   - **Bij een Teams-gesprek:** de uitnodiging bevat een Teams-link.
   - **In je privémail:** de uitnodiging komt binnen, afzender dave@resultop.nl.
3. Verwijder daarna de testafspraak.

## Stap 7 – Je domeinnaam koppelen (TransIP)
1. Static Web App → **Aangepaste domeinen** → **+ Toevoegen** → `www.resultop.nl`. Azure toont een **CNAME-waarde**.
2. TransIP → **Domeinen** → `resultop.nl` → **DNS** → voeg toe:
   - `www` · **CNAME** · `<waarde uit Azure>.` (met punt aan het eind)
3. Voor `resultop.nl` zonder www: voeg dat domein ook toe in Azure (validatie via **TXT**), en zet in TransIP de **TXT**- en **ALIAS**-record die Azure toont.
4. **Laat de bestaande MX-, autodiscover- en TXT-records (SPF) van Microsoft 365 staan.** Die zijn voor je e-mail.
5. Het SSL-certificaat (https) wordt automatisch en gratis door Azure geregeld.

## Stap 8 – Microsoft Bookings uitzetten (optioneel)
Werkt alles? Dan kun je in Bookings de reserveringspagina op **Geen selfservice** zetten, of de pagina verwijderen.

---

### Beveiliging in het kort
- De sleutel staat alleen in Azure (versleuteld), nooit in de code of in de browser.
- De app kan uitsluitend bij de agenda van dave@resultop.nl (Exchange RBAC).
- De API geeft alleen vrije tijden terug, geen inhoud van je afspraken.
- Invoer wordt gecontroleerd en opgeschoond. Er is een spamval, en maximaal 5 boekingen per uur per bezoeker.
- Strikte beveiligingsheaders (CSP, HSTS, geen inbedding door andere sites).
- Opmerking: de site laadt lettertypes van Google Fonts. Wil je ook dat helemaal vermijden, dan kunnen de lettertypes lokaal in `assets/` worden gezet.
