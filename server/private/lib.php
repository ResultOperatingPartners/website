<?php
/**
 * Gedeelde functies voor het contact-/aanvraagformulier en de beheerpagina.
 * Dit bestand staat op de server BUITEN de openbare map (www) en is dus
 * niet via internet op te vragen.
 */
declare(strict_types=1);

const RESULT_PRIVATE_DIR = __DIR__;

function cfg(): array
{
    static $cfg = null;
    if ($cfg === null) {
        $file = RESULT_PRIVATE_DIR . '/config.php';
        if (!is_file($file)) {
            throw new RuntimeException('config.php ontbreekt');
        }
        $cfg = require $file;
        $cfg += [
            'ontvanger' => 'dave@resultop.nl',
            'afzender' => 'noreply@resultop.nl',
            'afzender_naam' => 'Result Operating Partners',
            'bewaar_dagen' => 365,
            'beheer_ips' => [],
            'beheer_wachtwoord_hash' => '',
            'toegestane_domeinen' => ['resultop.nl', 'www.resultop.nl'],
            'max_per_uur' => 5,
            'bevestiging_termijn' => 'binnen één werkdag',
        ];
    }
    return $cfg;
}

function data_dir(string $sub): string
{
    $dir = RESULT_PRIVATE_DIR . '/data/' . $sub;
    if (!is_dir($dir)) {
        mkdir($dir, 0700, true);
    }
    return $dir;
}

function client_ip(): string
{
    return (string)($_SERVER['REMOTE_ADDR'] ?? '');
}

function ip_toegestaan(): bool
{
    $ip = client_ip();
    if ($ip === '') {
        return false;
    }
    foreach (cfg()['beheer_ips'] as $toegestaan) {
        if (ip_in_bereik($ip, trim((string)$toegestaan))) {
            return true;
        }
    }
    return false;
}

/** Klopt het IP-adres met een los adres of een bereik zoals 2001:db8:1234::/48? */
function ip_in_bereik(string $ip, string $bereik): bool
{
    if (!str_contains($bereik, '/')) {
        $a = @inet_pton($ip);
        $b = @inet_pton($bereik);
        return $a !== false && $b !== false && hash_equals($b, $a);
    }
    [$net, $bits] = explode('/', $bereik, 2);
    $a = @inet_pton($ip);
    $n = @inet_pton($net);
    if ($a === false || $n === false || strlen($a) !== strlen($n) || !ctype_digit($bits)) {
        return false;
    }
    $bits = (int)$bits;
    if ($bits > strlen($a) * 8) {
        return false;
    }
    $heel = intdiv($bits, 8);
    $rest = $bits % 8;
    if (substr($a, 0, $heel) !== substr($n, 0, $heel)) {
        return false;
    }
    if ($rest === 0) {
        return true;
    }
    $masker = (0xFF << (8 - $rest)) & 0xFF;
    return (ord($a[$heel]) & $masker) === (ord($n[$heel]) & $masker);
}

function json_antwoord(int $status, array $data): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Verwijdert tekens die niet in een formulier thuishoren en kort in. */
function schoon($v, int $max): string
{
    $s = is_scalar($v) ? (string)$v : '';
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s) ?? '';
    return mb_substr(trim($s), 0, $max);
}

/** Eén regel: ook regeleinden eruit (voorkomt het injecteren van mailheaders). */
function schoon_regel($v, int $max): string
{
    return str_replace(["\r", "\n"], ' ', schoon($v, $max));
}

function valideer(array $in): array
{
    // Spamval: verborgen veld dat mensen niet zien.
    if (!empty($in['website'])) {
        return ['spam' => true];
    }
    // Binnen 3 seconden ingevuld = vrijwel zeker een robot.
    if (isset($in['t']) && is_numeric($in['t']) && (int)$in['t'] < 3000) {
        return ['spam' => true];
    }
    $d = [
        'type' => ($in['type'] ?? '') === 'telefoon' ? 'telefoon' : (($in['type'] ?? '') === 'teams' ? 'teams' : ''),
        'datum' => schoon_regel($in['date'] ?? '', 10),
        'tijd' => schoon_regel($in['time'] ?? '', 5),
        'naam' => schoon_regel($in['name'] ?? '', 100),
        'organisatie' => schoon_regel($in['company'] ?? '', 120),
        'email' => strtolower(schoon_regel($in['email'] ?? '', 254)),
        'telefoon' => schoon_regel($in['phone'] ?? '', 20),
        'toelichting' => schoon($in['message'] ?? '', 1500),
        'toestemming' => ($in['consent'] ?? false) === true,
    ];
    if ($d['type'] === '') return ['fout' => 'Kies een soort gesprek.'];
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $d['datum']) || !preg_match('/^\d{2}:\d{2}$/', $d['tijd'])) return ['fout' => 'Kies een datum en tijd.'];
    $dt = DateTime::createFromFormat('Y-m-d', $d['datum']);
    if (!$dt || $dt->format('Y-m-d') !== $d['datum']) return ['fout' => 'Kies een geldige datum.'];
    if (mb_strlen($d['naam']) < 2) return ['fout' => 'Vul uw naam in.'];
    if (!filter_var($d['email'], FILTER_VALIDATE_EMAIL)) return ['fout' => 'Vul een geldig e-mailadres in.'];
    $telOk = $d['telefoon'] === '' || preg_match('/^\+?[0-9 ()\-]{8,20}$/', $d['telefoon']);
    if (!$telOk || ($d['type'] === 'telefoon' && $d['telefoon'] === '')) return ['fout' => 'Vul een geldig telefoonnummer in.'];
    if (!$d['toestemming']) return ['fout' => 'Geef toestemming voor het gebruik van uw gegevens.'];
    return ['data' => $d];
}

/** Maximaal X aanvragen per uur per bezoeker. IP-adres wordt alleen gehasht bewaard. */
function te_veel_aanvragen(): bool
{
    $sleutel = hash('sha256', client_ip() . '|' . __FILE__);
    $file = data_dir('limiet') . '/' . $sleutel . '.json';
    $nu = time();
    $lijst = is_file($file) ? (json_decode((string)file_get_contents($file), true) ?: []) : [];
    $lijst = array_values(array_filter($lijst, fn($t) => is_int($t) && $nu - $t < 3600));
    $lijst[] = $nu;
    file_put_contents($file, json_encode($lijst), LOCK_EX);
    return count($lijst) > (int)cfg()['max_per_uur'];
}

function opslaan(array $d): string
{
    $id = date('Ymd-His') . '-' . bin2hex(random_bytes(4));
    $d['id'] = $id;
    $d['ontvangen'] = date('c');
    $file = data_dir('aanvragen') . '/' . $id . '.json';
    file_put_contents($file, json_encode($d, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    @chmod($file, 0600);
    return $id;
}

/** Verwijdert aanvragen en limietbestanden ouder dan de bewaartermijn. */
function opruimen(): void
{
    $grens = time() - max(1, (int)cfg()['bewaar_dagen']) * 86400;
    foreach (glob(data_dir('aanvragen') . '/*.json') ?: [] as $f) {
        if (filemtime($f) < $grens) @unlink($f);
    }
    foreach (glob(data_dir('limiet') . '/*.json') ?: [] as $f) {
        if (filemtime($f) < time() - 86400) @unlink($f);
    }
}

function alle_aanvragen(): array
{
    $out = [];
    foreach (glob(data_dir('aanvragen') . '/*.json') ?: [] as $f) {
        $j = json_decode((string)file_get_contents($f), true);
        if (is_array($j)) $out[] = $j;
    }
    usort($out, fn($a, $b) => strcmp($b['id'] ?? '', $a['id'] ?? ''));
    return $out;
}

function verwijder_aanvraag(string $id): bool
{
    if (!preg_match('/^\d{8}-\d{6}-[0-9a-f]{8}$/', $id)) return false;
    $f = data_dir('aanvragen') . '/' . $id . '.json';
    return is_file($f) && unlink($f);
}

const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

function nl_datum(string $iso): string
{
    $dt = new DateTime($iso);
    return DAGEN[(int)$dt->format('w')] . ' ' . (int)$dt->format('j') . ' ' . MAANDEN[(int)$dt->format('n') - 1] . ' ' . $dt->format('Y');
}

function soort(array $d): string
{
    return $d['type'] === 'teams' ? 'Teams-gesprek' : 'Telefonisch gesprek';
}

function verstuur(string $aan, string $aanNaam, string $onderwerp, string $tekst, ?string $antwoordAan = null): bool
{
    $c = cfg();
    $van = sprintf('%s <%s>', mb_encode_mimeheader($c['afzender_naam'], 'UTF-8', 'Q'), $c['afzender']);
    $headers = [
        'From: ' . $van,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        'X-Auto-Response-Suppress: All',
    ];
    if ($antwoordAan) $headers[] = 'Reply-To: ' . $antwoordAan;
    $naar = $aanNaam !== '' ? sprintf('%s <%s>', mb_encode_mimeheader($aanNaam, 'UTF-8', 'Q'), $aan) : $aan;
    return mail($naar, mb_encode_mimeheader($onderwerp, 'UTF-8', 'Q'), $tekst, implode("\r\n", $headers), '-f' . $c['afzender']);
}

function mail_naar_dave(array $d): bool
{
    $regels = [
        'Nieuwe aanvraag voor een kennismakingsgesprek via de website.',
        '',
        'Voorkeursmoment: ' . nl_datum($d['datum']) . ' om ' . $d['tijd'] . ' uur',
        'Soort gesprek:   ' . soort($d),
        'Naam:            ' . $d['naam'],
        'Organisatie:     ' . ($d['organisatie'] ?: '-'),
        'E-mail:          ' . $d['email'],
        'Telefoon:        ' . ($d['telefoon'] ?: '-'),
        '',
        'Toelichting:',
        $d['toelichting'] ?: '-',
        '',
        'Beantwoorden? Klik op Beantwoorden; uw antwoord gaat direct naar ' . $d['email'] . '.',
        'Referentie: ' . $d['id'],
    ];
    $onderwerp = 'Kennismaking via website: ' . soort($d) . ', ' . nl_datum($d['datum']) . ' ' . $d['tijd'] . ' - ' . $d['naam'];
    return verstuur(cfg()['ontvanger'], '', $onderwerp, implode("\n", $regels), $d['email']);
}

function bevestiging_naar_bezoeker(array $d): bool
{
    $c = cfg();
    $regels = [
        'Beste ' . $d['naam'] . ',',
        '',
        'Hartelijk dank voor uw aanvraag voor een kennismakingsgesprek met Result Operating Partners. Wij hebben de volgende gegevens ontvangen:',
        '',
        'Voorkeursmoment: ' . nl_datum($d['datum']) . ' om ' . $d['tijd'] . ' uur',
        'Soort gesprek:   ' . soort($d),
        $d['type'] === 'telefoon' ? 'Wij bellen u op:  ' . $d['telefoon'] : 'U ontvangt de Teams-link bij de bevestiging van het gesprek.',
        '',
        'Dave Venmans neemt ' . $c['bevestiging_termijn'] . ' contact met u op om het moment te bevestigen.',
        '',
        'Heeft u in de tussentijd een vraag? Beantwoord dan gerust deze e-mail.',
        '',
        'Met vriendelijke groet,',
        '',
        'Dave Venmans',
        'Result Operating Partners',
        $c['ontvanger'],
        '',
        '--',
        'Dit is een automatisch verstuurde bevestiging. Uw gegevens worden uitsluitend gebruikt om contact met u op te nemen over deze aanvraag.',
    ];
    return verstuur($d['email'], $d['naam'], 'Bevestiging van uw aanvraag - Result Operating Partners', implode("\n", $regels), $c['ontvanger']);
}
