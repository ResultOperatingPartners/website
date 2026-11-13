<?php
/**
 * Eenmalig hulpje: maakt de versleutelde vorm (hash) van je beheerwachtwoord.
 * Werkt alleen vanaf een toegestaan IP-adres en alleen zolang er nog geen
 * wachtwoord is ingesteld. Het wachtwoord zelf wordt nergens opgeslagen.
 */
declare(strict_types=1);
require dirname(__DIR__, 2) . '/private/lib.php';

header('X-Frame-Options: DENY');
header('Cache-Control: no-store');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'");

if (!ip_toegestaan() || (string)cfg()['beheer_wachtwoord_hash'] !== '') {
    http_response_code(403);
    exit('Geen toegang.');
}

$hash = '';
$fout = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $w = (string)($_POST['w'] ?? '');
    if (mb_strlen($w) < 12) {
        $fout = 'Kies een wachtwoord van minimaal 12 tekens.';
    } elseif ($w !== (string)($_POST['w2'] ?? '')) {
        $fout = 'De wachtwoorden zijn niet gelijk.';
    } else {
        $hash = password_hash($w, PASSWORD_DEFAULT);
    }
}
function h(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }
?><!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><title>Beheerwachtwoord instellen</title>
<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:60px auto;padding:0 16px;color:#14213d}input{font:inherit;padding:10px;width:100%;box-sizing:border-box;margin:6px 0 12px}code{display:block;background:#f6f4ee;padding:12px;word-break:break-all}.f{color:#b42318}</style></head><body>
<h1>Beheerwachtwoord instellen</h1>
<?php if ($hash): ?>
<p>Kopieer de regel hieronder naar <b>deploy/config.php</b> op je laptop, bij <i>beheer_wachtwoord_hash</i>, en publiceer met <b>-MetConfig</b>. Daarna werkt deze pagina niet meer.</p>
<code>'beheer_wachtwoord_hash' => '<?= h($hash) ?>',</code>
<?php else: ?>
<?php if ($fout): ?><p class="f"><?= h($fout) ?></p><?php endif; ?>
<form method="post"><label>Nieuw wachtwoord (min. 12 tekens)<input type="password" name="w" autocomplete="new-password" required></label>
<label>Herhaal<input type="password" name="w2" autocomplete="new-password" required></label><button>Maak versleutelde versie</button></form>
<?php endif; ?>
</body></html>
