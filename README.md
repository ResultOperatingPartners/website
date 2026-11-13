# Result Operating Partners — website (testversie)

Een eenvoudige, statische testwebsite: alles staat in één bestand, `index.html` (HTML, CSS en JavaScript samen). Er is geen installatie of build-stap nodig.

## Bekijken

**Op je eigen computer**
1. Klik op GitHub op de groene knop **Code** → **Download ZIP**.
2. Pak de ZIP uit.
3. Dubbelklik op `index.html`. De site opent in je browser.

**Online (GitHub Pages)**
GitHub Pages werkt bij een privé-repository alleen met een betaald GitHub-abonnement (of je maakt de repo openbaar). Daarna:
1. Ga in de repo naar **Settings → Pages**.
2. Kies bij *Source* **Deploy from a branch**, branch `main`, map `/ (root)`, en klik **Save**.
3. Na een minuut of twee staat de site op `https://resultoperatingpartners.github.io/website/`.

## Aanpassen

- Teksten, namen en contactgegevens zijn voorbeeldteksten. Zoek ze op in `index.html` en vervang ze.
- Kleuren staan bovenaan in `index.html` onder `:root` (bijvoorbeeld `--accent` voor de oranje accentkleur).
- Verwijder de oranje testbalk bovenaan (`<div class="test-banner">`) zodra de site live gaat.
- Het contactformulier verstuurt nog niets; dat moet nog aan een formulierdienst of e-mail gekoppeld worden.

## Reserveringspagina

`afspraak.html` is de eigen reserveringspagina. Het beveiligde gedeelte staat in `api/` (Azure Functions). Zie **INSTALLATIE.md** voor het online zetten en koppelen aan je agenda.

Lokaal testen van de API-logica: `cd api && npm test`.
