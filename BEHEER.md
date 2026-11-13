# Beheer reserveringspagina

Alle instellingen staan in **één bestand**: `assets/afspraak-config.js`.

## Zo pas je iets aan
1. Klik in VS Code eerst op **Sync Changes**, zodat je de nieuwste versie hebt.
2. Open `assets/afspraak-config.js`.
3. Pas een waarde aan (zie hieronder) en sla op met **Ctrl+S**.
4. Controleer het resultaat: klik met de rechtermuisknop op `afspraak.html` en kies **Open with Live Server**.
5. Ga naar **Source Control** → typ een korte omschrijving → **Commit** → **Sync Changes**.

## Wat kun je instellen?

| Instelling | Wat het doet | Voorbeeld |
|---|---|---|
| `email` | Naar dit adres gaan de aanvragen | `'dave@resultop.nl'` |
| `beschikbaarheid` | Dagen en tijdblokken | `vrijdag: [['09:00', '17:00']]` |
| `duurMinuten` | Lengte van een gesprek | `30` |
| `stapMinuten` | Om de hoeveel minuten een tijd wordt aangeboden | `30` |
| `minimaalUrenVooraf` | Minimaal zoveel uur van tevoren plannen | `24` |
| `maximaalDagenVooruit` | Hoe ver vooruit geboekt kan worden | `60` |
| `nietBeschikbaar` | Losse dagen uitzetten (vakantie) | `'2026-12-31'` |
| `bevestigingTermijn` | Tekst voor de bezoeker | `'binnen één werkdag'` |

### Voorbeelden beschikbaarheid
```js
beschikbaarheid: {
  dinsdag:   [['09:00', '12:00']],                    // alleen dinsdagochtend
  donderdag: [['09:00', '12:00'], ['13:00', '17:00']],// donderdag met lunchpauze
  vrijdag:   [['09:00', '17:00']],                    // hele vrijdag
},
```

### Vakantie inplannen
```js
nietBeschikbaar: [
  '2027-07-19', '2027-07-20', '2027-07-21', '2027-07-22', '2027-07-23',
],
```

## Let op
- Komma's, aanhalingstekens en haakjes moeten blijven staan. Zie je geen tijden meer na een wijziging? Dan is er waarschijnlijk een komma of aanhalingsteken weggevallen. Druk op **F12** in de browser → tabblad **Console** om de foutmelding te zien.
- De pagina controleert je **Outlook-agenda niet**. Controleer bij elke aanvraag of het moment vrij is, en bevestig of stel een ander moment voor.
- Komt er later een server bij (zie `INSTALLATIE.md`), dan worden vrije tijden automatisch uit Outlook gehaald. De beschikbaarheid stel je dan in Azure in.

## Ingekomen aanvragen
- Elke aanvraag komt als mail binnen op het ingestelde adres. De bezoeker krijgt automatisch een bevestiging.
- Alle aanvragen staan ook op **https://resultop.nl/beheer/**. Die pagina werkt alleen vanaf je eigen IP-adres en met je beheerwachtwoord. Na 30 minuten word je automatisch uitgelogd.
- Aanvragen ouder dan de bewaartermijn (`bewaar_dagen` in `deploy/config.php`, standaard 365) worden automatisch verwijderd.

## Publiceren
Na een wijziging: **Ctrl+Shift+B** in VS Code. Dit werkt alleen op een netwerk met een toegestaan IP-adres. Zie `TRANSIP.md`.

## Automatische bevestiging zolang er nog geen webhosting is
Zonder webhosting opent de afspraakpagina het mailprogramma van de bezoeker. De mail komt binnen met een onderwerp dat begint met **Aanvraag kennismaking:**. Met een Outlook-regel stuurt je mailbox dan zelf een bevestiging terug. Dit gebeurt op de server van Microsoft, dus het werkt ook als je laptop uit staat.

Eenmalig instellen in **klassiek Outlook** voor Windows (de nieuwe Outlook en Outlook op het web hebben deze actie niet):
1. Maak een nieuwe e-mail. Onderwerp: `Wij hebben uw aanvraag ontvangen`. Plak de tekst hieronder in het bericht. Verstuur hem niet.
2. Ga naar **Bestand → Regels en waarschuwingen beheren → Nieuwe regel → Regel toepassen op berichten die ik ontvang**.
3. Voorwaarde: **met specifieke woorden in het onderwerp**. Vul in: `Aanvraag kennismaking:`.
4. Actie: **de server laten antwoorden met een specifiek bericht**. Klik op *een specifiek bericht* en kies de mail uit stap 1. Sluit dat venster en klik **Ja** op de vraag of je wilt opslaan.
5. Geef de regel de naam `Bevestiging kennismaking` en zet hem aan.
6. Test het vanaf een privé-adres via de afspraakpagina.

Zodra de webhosting draait, verstuurt de site zelf de bevestiging. **Zet de Outlook-regel dan uit**, anders krijgen bezoekers twee bevestigingen. (De site stuurt aanvragen dan met het onderwerp `Kennismaking via website:`, dus de regel slaat niet aan. Uitzetten is toch netter.)

Tekst voor de bevestiging:

> Geachte heer/mevrouw,
>
> Dank voor uw aanvraag voor een kennismakingsgesprek met Result Operating Partners. Wij hebben uw bericht in goede orde ontvangen.
>
> Binnen één werkdag ontvangt u een persoonlijke bevestiging van het gekozen moment, of een voorstel voor een ander moment als dat beter uitkomt. Bij een Teams-gesprek stuur ik u daarna een uitnodiging met de link.
>
> Wilt u tussentijds iets wijzigen of toevoegen? Beantwoord dan gewoon dit bericht of bel mij op 06 46 74 85 49.
>
> Met vriendelijke groet,
>
> Dave Venmans
> Operating Partner | Result Operating Partners
> dave@resultop.nl · 06 46 74 85 49 · www.resultop.nl
>
> *Dit is een automatisch bericht. Hoe wij met uw gegevens omgaan leest u op www.resultop.nl/privacy.html.*

## Agenda en formulier (GitHub Pages-versie)
- **Bezette tijden:** je Outlook-agenda is gepubliceerd met alleen "Kan zien wanneer ik bezet ben". GitHub haalt de ICS-link (geheim `AGENDA_ICS_URL`) elk kwartier tussen 7 en 23 uur op en blokkeert die momenten op /afspraak/. Alleen begin- en eindtijden komen op de site.
- **Aanvraag in je agenda:** elke aanvraagmail bevat de regel "In mijn agenda zetten". Klik erop, controleer en sla op; binnen een kwartier is dat moment op de site bezet.
- **Formulier:** verstuurt via FormSubmit naar de anonieme code in `assets/afspraak-config.js`. Mails van FormSubmit kunnen in Ongewenste e-mail belanden: markeer `submissions@formsubmit.co` als veilige afzender.
- **Agendakoppeling stoppen:** Outlook → Instellingen → Agenda → Gedeelde agenda's → publicatie ongedaan maken, en het geheim in GitHub verwijderen.
