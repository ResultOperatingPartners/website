/*
 * ============================================================
 *  INSTELLINGEN RESERVERINGSPAGINA  (beheer: Dave Venmans)
 * ============================================================
 *  Pas hieronder de waarden aan, sla op en push naar GitHub.
 *  Alleen de tekst ná de dubbele punt aanpassen; laat
 *  aanhalingstekens, komma's en haakjes staan.
 * ============================================================
 */
window.AFSPRAAK_CONFIG = {

  // Naar dit adres gaan de aanvragen.
  email: 'dave@resultop.nl',

  // TIJDELIJK: aanvragen versturen via FormSubmit (zolang er geen webhosting is).
  // Na activatie krijg je van FormSubmit een code; vervang dan het e-mailadres
  // hieronder door die code (https://formsubmit.co/CODE). Zet op '' zodra de
  // TransIP-webhosting draait.
  formsubmit: 'https://formsubmit.co/dave@resultop.nl',

  // Automatische bevestiging aan de bezoeker (via FormSubmit).
  bevestigingTekst: 'Dank voor uw aanvraag voor een kennismakingsgesprek met Result Operating Partners. Wij hebben uw aanvraag in goede orde ontvangen. Binnen één werkdag ontvangt u een persoonlijke bevestiging van het gekozen moment, of een voorstel voor een ander moment. Bij een Teams-gesprek volgt daarna een uitnodiging met de link. Vragen? Mail naar dave@resultop.nl of bel 06 46 74 85 49. Met vriendelijke groet, Dave Venmans, Result Operating Partners',

  // Wanneer kunnen bezoekers een moment kiezen?
  // Dagen: maandag, dinsdag, woensdag, donderdag, vrijdag, zaterdag, zondag
  // Per dag één of meer blokken: ['van', 'tot']
  beschikbaarheid: {
    vrijdag: [['09:00', '17:00']],
    // Voorbeelden (haal de // weg om te gebruiken):
    // dinsdag:  [['09:00', '12:00']],
    // donderdag: [['09:00', '12:00'], ['13:00', '17:00']],
  },

  // Lengte van een gesprek en stappen tussen de tijden (in minuten).
  duurMinuten: 30,
  stapMinuten: 30,

  // Hoeveel uur van tevoren moet iemand minimaal plannen?
  minimaalUrenVooraf: 24,

  // Hoe ver vooruit kan iemand plannen (in dagen)?
  maximaalDagenVooruit: 60,

  // Dagen waarop je NIET beschikbaar bent (vakantie, feestdagen).
  // Formaat: 'JJJJ-MM-DD'
  nietBeschikbaar: [
    '2026-12-25',
    '2026-12-26',
    // '2027-01-01',
  ],

  // Hoe snel bevestig je een aanvraag? (wordt aan de bezoeker getoond)
  bevestigingTermijn: 'binnen één werkdag',
};
