<?php
/**
 * Ontvangt aanvragen van de reserveringspagina.
 * Kan alleen ontvangen: geeft nooit eerder ingestuurde gegevens terug.
 */
declare(strict_types=1);
require dirname(__DIR__, 2) . '/private/lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    json_antwoord(405, ['error' => 'Niet toegestaan.']);
}

// Alleen aanvragen vanaf de eigen website accepteren.
$origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origin !== '') {
    $host = (string)parse_url($origin, PHP_URL_HOST);
    if (!in_array($host, cfg()['toegestane_domeinen'], true)) {
        json_antwoord(403, ['error' => 'Niet toegestaan.']);
    }
}

$raw = file_get_contents('php://input', false, null, 0, 10001);
if ($raw === false || strlen($raw) > 10000) {
    json_antwoord(413, ['error' => 'Aanvraag te groot.']);
}
$in = json_decode($raw, true);
if (!is_array($in)) {
    json_antwoord(400, ['error' => 'Ongeldige aanvraag.']);
}

try {
    if (te_veel_aanvragen()) {
        json_antwoord(429, ['error' => 'Te veel aanvragen. Probeer het later opnieuw of mail ons.']);
    }
    $v = valideer($in);
    if (!empty($v['spam'])) {
        json_antwoord(200, ['ok' => true]); // robots krijgen geen hint
    }
    if (isset($v['fout'])) {
        json_antwoord(400, ['error' => $v['fout']]);
    }
    $d = $v['data'];
    $d['id'] = opslaan($d);
    $naarDave = mail_naar_dave($d);
    $bevestigd = bevestiging_naar_bezoeker($d);
    opruimen();
    json_antwoord(200, ['ok' => true, 'bevestigd' => $bevestigd, 'gemeld' => $naarDave]);
} catch (Throwable $e) {
    error_log('aanvraag.php: ' . $e->getMessage());
    json_antwoord(503, ['error' => 'Het versturen is niet gelukt. Mail ons gerust rechtstreeks.']);
}
