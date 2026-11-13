# Stappen vóór de webhosting

Bijgewerkt op 12 november 2026. Dit is wat al klaarstaat, en wat alleen jij kunt doen.

## Al gedaan
- **Privacyverklaring** (`privacy.html`). Deze staat gelinkt in de footer en bij het vinkje op de afspraakpagina.
- **Basisbestanden**: een eigen 404-pagina, `robots.txt`, `sitemap.xml`, een omschrijving voor Google en een deelafbeelding voor LinkedIn/WhatsApp (`assets/deelbeeld.png`).
- **Automatische bevestiging via Outlook**: de tekst en stappen staan in `BEHEER.md`. Dit werkt nu al, ook zonder webhosting.
- **IP-adres** opgezocht (staat alleen op je laptop, niet in GitHub). De beheerpagina accepteert ook IPv6-bereiken.
- **DNS van resultop.nl** bekeken. Er is niets gewijzigd; de bevindingen staan hieronder.

## Wat jij nog moet doen (in deze volgorde)

| # | Stap | Waar | Tijd |
|---|------|------|------|
| 1 | **Tweestapsverificatie aanzetten** voor TransIP (als dat nog niet aan staat). | TransIP → Account → Beveiliging | 5 min |
| 2 | **IP-adres (KPN).** Voor consumenten is het officieel niet vast, maar KPN wijzigt het in de praktijk zelden. Je krijgt een eigen IPv6-blok `/48`. Zet in **MijnKPN** de melding aan voor als je IP-adres verandert. Een gegarandeerd vast IP krijg je alleen met een zakelijk KPN-abonnement. | MijnKPN | 5 min |
| 3 | **Outlook-regel aanmaken** voor de automatische bevestiging. | Klassiek Outlook, zie `BEHEER.md` | 10 min |
| 4 | ✅ *Gedaan op 12-11-2026.* **SSH-sleutel maken** op je laptop. Deel de privésleutel nooit, ook niet met Claude. | PowerShell, zie `TRANSIP.md` stap 3 | 5 min |
| 5 | ✅ *Gedaan.* **OpenSSH-client controleren.** Typ `sftp` in PowerShell. Bij "niet gevonden": Instellingen → Systeem → Optionele onderdelen → OpenSSH-client. | Windows | 5 min |
| 6 | **KvK-nummer en vestigingsadres** aanleveren. Een zakelijke website moet die volgens de wet tonen. Ik zet ze in de footer en de privacyverklaring. | Aan Claude | 1 min |
| 7 | **DKIM aanzetten voor Microsoft 365** (zie hieronder). | Microsoft Defender-portal + TransIP DNS | 15 min |
| 8 | **Webhosting bestellen** zodra je zover bent: het kleinste pakket, gekoppeld aan resultop.nl. Wijzig de e-mail/MX niet en kies geen WordPress. | TransIP | 10 min |

Daarna gaat het verder met `TRANSIP.md` vanaf stap 4.

## DNS-controle resultop.nl (alleen gelezen, niets gewijzigd)

| Onderdeel | Huidige stand | Oordeel |
|---|---|---|
| Website (A/AAAA) | `37.97.254.27` / `2a01:7c8:3:1337::27`, de parkeerpagina van TransIP | Goed zo. Bij de webhosting zet TransIP dit zelf om. |
| www | CNAME naar `@` | Goed |
| Mail (MX) | `resultop-nl.mail.protection.outlook.com` | Goed, Microsoft 365 |
| SPF | `v=spf1 include:spf.protection.outlook.com -all` | Goed voor nu. **Let op:** zodra de site mail verstuurt via TransIP, moet TransIP hieraan worden toegevoegd. Anders worden de bevestigingsmails geweigerd. |
| DKIM | Geen `selector1/selector2._domainkey`-records gevonden | **Ontbreekt.** Zet dit aan, zodat je mail minder vaak in de spam belandt. |
| DMARC | `v=DMARC1; p=none;` | Werkt, maar beschermt nog niet tegen misbruik van je adres. Stap over naar `p=quarantine` nadat DKIM een paar weken goed werkt. |
| DNSSEC | Aan | Goed |
| TTL mailrecords | 1 minuut | Werkt. Als alles stabiel is, kan dit naar 1 uur. |
| WHOIS-gegevens | Bedrijfsnaam "Resultop", e-mail op je KPN-adres | Overweeg dit te wijzigen naar "Result Operating Partners" en dave@resultop.nl. |

### DKIM aanzetten (stap 7)
1. Ga naar https://security.microsoft.com/dkimv2 en kies **resultop.nl**.
2. Microsoft toont twee CNAME-records (`selector1._domainkey` en `selector2._domainkey`). Voeg die toe in de DNS van resultop.nl bij TransIP. Zeg het als ik dit samen met je moet doen; ik vul dan in en jij controleert vóór het opslaan.
3. Wacht een uur en zet in Microsoft de schakelaar **Handtekeningen ondertekenen met DKIM** aan.

## Later, als er netwerktoegang is
- **Lettertypen zelf hosten** in plaats van via Google Fonts. Dan ziet Google de IP-adressen van bezoekers niet meer. Haal daarna de zin over Google Fonts uit de privacyverklaring.
