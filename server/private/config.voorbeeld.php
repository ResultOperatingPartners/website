<?php
/**
 * INSTELLINGEN CONTACTFORMULIER EN BEHEERPAGINA
 * ---------------------------------------------
 * 1. Kopieer dit bestand naar  deploy/config.php  (staat NIET in GitHub).
 * 2. Vul je IP-adres in.
 * 3. Publiceer één keer met: deploy\publiceer.ps1 -MetConfig
 *    Het bestand komt dan op de server in de map "private", buiten de website.
 */
return [
    // Waar aanvragen naartoe gaan.
    'ontvanger' => 'dave@resultop.nl',

    // Afzender van de automatische bevestiging aan de bezoeker.
    'afzender' => 'noreply@resultop.nl',
    'afzender_naam' => 'Result Operating Partners',

    // Hoe lang aanvragen op de server bewaard blijven (dagen). 365 = 12 maanden.
    'bewaar_dagen' => 365,

    // Alleen vanaf deze IP-adressen is de beheerpagina te openen.
    'beheer_ips' => [
        // Losse adressen of bereiken (CIDR), bijv. '203.0.113.10' of '2001:db8:1234::/48'.
        '0.0.0.0', // <-- vervang door je eigen IP-adres(sen)
    ],

    // Wachtwoord van de beheerpagina (versleuteld). Laat leeg en open
    // eenmalig https://resultop.nl/beheer/wachtwoord.php om dit te maken.
    'beheer_wachtwoord_hash' => '',

    // Vanaf welke domeinen het formulier mag worden verstuurd.
    'toegestane_domeinen' => ['resultop.nl', 'www.resultop.nl'],

    // Maximaal aantal aanvragen per uur per bezoeker.
    'max_per_uur' => 5,

    // Tekst in de bevestigingsmail.
    'bevestiging_termijn' => 'binnen één werkdag',
];
