<?php
/**
 * Beheerpagina: ingekomen aanvragen bekijken en verwijderen.
 * Drie sloten: (1) .htaccess laat alleen de toegestane IP-adressen door,
 * (2) dit script controleert het IP-adres nogmaals, (3) wachtwoord.
 */
declare(strict_types=1);
require dirname(__DIR__, 2) . '/private/lib.php';

header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'");

if (!ip_toegestaan()) {
    http_response_code(403);
    exit('Geen toegang.');
}

session_set_cookie_params(['lifetime' => 0, 'path' => '/beheer/', 'secure' => true, 'httponly' => true, 'samesite' => 'Strict']);
session_name('rop_beheer');
session_start();

function h(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }

$hash = (string)cfg()['beheer_wachtwoord_hash'];
$melding = '';

// Inloggen
if (empty($_SESSION['ingelogd'])) {
    if ($hash === '') {
        $melding = 'Er is nog geen wachtwoord ingesteld. Open wachtwoord.php om er een te maken.';
    } elseif (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && isset($_POST['wachtwoord'])) {
        usleep(400000); // vertraagt raden
        if (password_verify((string)$_POST['wachtwoord'], $hash)) {
            session_regenerate_id(true);
            $_SESSION['ingelogd'] = true;
            $_SESSION['csrf'] = bin2hex(random_bytes(16));
            $_SESSION['sinds'] = time();
            header('Location: ./');
            exit;
        }
        $melding = 'Onjuist wachtwoord.';
    }
}

// Na 30 minuten opnieuw inloggen
if (!empty($_SESSION['ingelogd']) && time() - (int)($_SESSION['sinds'] ?? 0) > 1800) {
    $_SESSION = [];
    session_destroy();
    header('Location: ./');
    exit;
}

// Acties
if (!empty($_SESSION['ingelogd']) && ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    if (!hash_equals($_SESSION['csrf'] ?? '', (string)($_POST['csrf'] ?? ''))) {
        http_response_code(400);
        exit('Ongeldige aanvraag.');
    }
    if (isset($_POST['uitloggen'])) {
        $_SESSION = [];
        session_destroy();
        header('Location: ./');
        exit;
    }
    if (isset($_POST['verwijder'])) {
        verwijder_aanvraag((string)$_POST['verwijder']);
        header('Location: ./');
        exit;
    }
}

opruimen();
?><!DOCTYPE html>
<html lang="nl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Beheer aanvragen — Result Operating Partners</title>
<style>
body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#f6f4ee;color:#14213d}
header{background:#14213d;color:#fff;padding:16px 24px;display:flex;justify-content:space-between;align-items:center}
header b{letter-spacing:.04em}main{max-width:1000px;margin:24px auto;padding:0 16px}
.kaart{background:#fff;border:1px solid #e6e1d3;border-radius:6px;padding:18px 20px;margin-bottom:14px}
.kop{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
.kop strong{font-size:17px}.meta{color:#5d6878;font-size:14px}
dl{display:grid;grid-template-columns:140px 1fr;gap:4px 12px;margin:12px 0 0;font-size:15px}dt{color:#5d6878}dd{margin:0;white-space:pre-wrap;word-break:break-word}
button{font:inherit;border:1px solid #c9a227;background:#fff;color:#14213d;border-radius:999px;padding:6px 14px;cursor:pointer}
button.goud{background:#c9a227;border-color:#c9a227;font-weight:600}
input[type=password]{font:inherit;padding:10px 12px;border:1px solid #e6e1d3;border-radius:6px;width:100%;box-sizing:border-box;margin:10px 0}
.melding{color:#b42318}.leeg{color:#5d6878}
a{color:#14213d}
</style></head><body>
<header><b>RESULT · Beheer aanvragen</b>
<?php if (!empty($_SESSION['ingelogd'])): ?>
<form method="post"><input type="hidden" name="csrf" value="<?= h($_SESSION['csrf']) ?>"><button name="uitloggen" value="1">Uitloggen</button></form>
<?php endif; ?></header>
<main>
<?php if (empty($_SESSION['ingelogd'])): ?>
  <div class="kaart" style="max-width:380px;margin:60px auto">
    <strong>Inloggen</strong>
    <?php if ($melding): ?><p class="melding"><?= h($melding) ?></p><?php endif; ?>
    <?php if ($hash !== ''): ?>
    <form method="post"><input type="password" name="wachtwoord" autocomplete="current-password" required autofocus><button class="goud">Inloggen</button></form>
    <?php endif; ?>
  </div>
<?php else: $lijst = alle_aanvragen(); ?>
  <p class="meta"><?= count($lijst) ?> aanvraag/aanvragen. Aanvragen ouder dan <?= (int)cfg()['bewaar_dagen'] ?> dagen worden automatisch verwijderd.</p>
  <?php if (!$lijst): ?><p class="leeg">Nog geen aanvragen ontvangen.</p><?php endif; ?>
  <?php foreach ($lijst as $a): ?>
  <div class="kaart">
    <div class="kop">
      <div><strong><?= h($a['naam'] ?? '') ?></strong><?= !empty($a['organisatie']) ? ' · ' . h($a['organisatie']) : '' ?><br>
      <span class="meta"><?= h(soort($a)) ?> · voorkeur <?= h(nl_datum($a['datum'])) ?> om <?= h($a['tijd']) ?> uur</span></div>
      <form method="post" onsubmit="return confirm('Deze aanvraag definitief verwijderen?')">
        <input type="hidden" name="csrf" value="<?= h($_SESSION['csrf']) ?>"><button name="verwijder" value="<?= h($a['id']) ?>">Verwijderen</button></form>
    </div>
    <dl>
      <dt>E-mail</dt><dd><a href="mailto:<?= h($a['email']) ?>"><?= h($a['email']) ?></a></dd>
      <dt>Telefoon</dt><dd><?= $a['telefoon'] ? '<a href="tel:' . h($a['telefoon']) . '">' . h($a['telefoon']) . '</a>' : '-' ?></dd>
      <dt>Toelichting</dt><dd><?= h($a['toelichting'] ?: '-') ?></dd>
      <dt>Ontvangen</dt><dd><?= h(date('d-m-Y H:i', strtotime($a['ontvangen'] ?? 'now'))) ?></dd>
    </dl>
  </div>
  <?php endforeach; ?>
<?php endif; ?>
</main></body></html>
