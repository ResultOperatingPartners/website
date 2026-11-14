# Website-editor (lokaal)

Teksten, lettergrootte en volgorde van de site aanpassen zonder code —
rechtstreeks op je eigen computer, zoals bewerken in PowerPoint.

## Starten

```
cd pad/naar/je/lokale-kloon-van-website
python3 tools/editor/server.py
```

Er opent automatisch een browservenster met een lijstje van pagina's.
Kies daar de pagina die je wilt bewerken (elke pagina is ook direct
te openen door `?bewerken=1` aan het adres toe te voegen, bijvoorbeeld
`http://localhost:8787/afspraak/?bewerken=1`).

**Nodig:** Python 3 (standaard aanwezig op macOS) en git met je eigen
push-rechten op deze repository — dezelfde manier waarop je nu al met
GitHub werkt op deze computer.

## Bewerken

- **Tekst**: klik erop en typ. Het verandert meteen op het scherm.
- **Lettergrootte**: selecteer een tekst, gebruik de A− / A+ knoppen
  in de zwevende werkbalk die verschijnt.
- **Breedte van een blok**: ↔− / ↔+ in diezelfde werkbalk.
- **Volgorde**: ↑ / ↓ verplaatst het geselecteerde onderdeel voor of
  na zijn buurman.
- **Ongedaan maken**: bovenin de balk, tot 30 stappen terug (alleen
  binnen deze sessie — sluit je de pagina, dan verdwijnt de historie).

## Opslaan en publiceren

- **Opslaan** schrijft je wijzigingen naar het bestand op je eigen
  computer. Nog niet live, en nog niet naar GitHub gestuurd.
- **Publiceren → pull request** stuurt je wijzigingen naar GitHub als
  een nieuwe pull request (met een link die automatisch opent). Niets
  gaat live totdat jij die pull request op GitHub bekijkt en
  goedkeurt/merget — precies zoals je hebt aangegeven te willen.

## Let op: mobiele weergave

De site past zich aan op een telefoon (andere lettergroottes, andere
indeling). De editor laat je maar één schermgrootte tegelijk zien
(die van je browservenster). Maak na het bewerken je browservenster
smal (of gebruik de "mobiel"-weergave van je browser, meestal via de
ontwikkelaarstools) om te checken of het er op een telefoon ook nog
goed uitziet, vóórdat je de pull request goedkeurt.

## Als er iets misgaat

- De editor raakt alleen `.html`-bestanden aan; CSS/afbeeldingen/JS
  blijven ongewijzigd.
- Niet tevreden met een pull request? Sluit 'm gewoon op GitHub
  zonder te mergen — er verandert dan niets aan de live site.
- Script stoppen: terug naar het terminalvenster, `Ctrl+C`.
