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

  // TIJDELIJK: aanvragen versturen via FormSubmit (geactiveerd op 13-11-2026).
  // De code hieronder hoort bij je e-mailadres, zodat dat niet in de code staat.
  // Zet op '' zodra de TransIP-webhosting draait.
  formsubmit: 'https://formsubmit.co/0ec4c8424ed28e1bd973e4d7df255dc1',


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
