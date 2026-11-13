(function () {
  'use strict';
  var form = document.getElementById('aanmeld');
  if (!form) return;
  var CFG = window.AFSPRAAK_CONFIG || {};
  var EMAIL = CFG.email || 'dave@resultop.nl';
  var start = Date.now();
  var msg = document.getElementById('msg');
  var knop = document.getElementById('verstuur');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    msg.textContent = ''; msg.className = 'msg';
    var f = form;
    var d = {
      naam: f.naam.value.trim(), email: f.email.value.trim(), telefoon: f.telefoon.value.trim(),
      linkedin: f.linkedin.value.trim(), vakgebied: f.vakgebied.value, beschikbaarheid: f.beschikbaarheid.value,
      toelichting: f.toelichting.value.trim(),
    };
    var fout =
      d.naam.length < 2 ? 'Vul je naam in.' :
      !/^\S+@\S+\.\S+$/.test(d.email) ? 'Vul een geldig e-mailadres in.' :
      !d.vakgebied ? 'Kies je vakgebied.' :
      (d.linkedin && !/^https:\/\/([a-z]+\.)?linkedin\.com\//i.test(d.linkedin)) ? 'Vul een geldige LinkedIn-link in (begint met https://www.linkedin.com/).' :
      !f.consent.checked ? 'Geef toestemming voor het gebruik van je gegevens.' : '';
    if (fout) { msg.textContent = fout; msg.classList.add('err'); return; }
    if (f.website.value || Date.now() - start < 3000) return; // spamval

    if (!CFG.formsubmit) {
      window.location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('Aanmelding interimmer: ' + d.naam) +
        '&body=' + encodeURIComponent(Object.keys(d).map(function (k) { return k + ': ' + (d[k] || '-'); }).join('\n'));
      return;
    }
    var velden = {
      'Naam': d.naam, 'email': d.email, 'Telefoon': d.telefoon || '-', 'LinkedIn': d.linkedin || '-',
      'Vakgebied': d.vakgebied, 'Beschikbaarheid': d.beschikbaarheid || '-', 'Toelichting': d.toelichting || '-',
      '_subject': 'Aanmelding interimmer: ' + d.naam + ' (' + d.vakgebied + ')',
      '_template': 'table', '_captcha': 'false', '_honey': '',
    };
    knop.disabled = true; knop.textContent = 'Bezig met versturen…';
    fetch(CFG.formsubmit.replace('formsubmit.co/', 'formsubmit.co/ajax/'), {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(velden),
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return r.ok && String(j.success) === 'true'; }); })
      .then(function (ok) {
        if (!ok) throw new Error('mislukt');
        form.hidden = true; document.getElementById('klaar').hidden = false;
      })
      .catch(function () {
        msg.textContent = 'Het versturen is niet gelukt. Mail je gegevens gerust naar ' + EMAIL + '.';
        msg.className = 'msg err';
      })
      .finally(function () { knop.disabled = false; knop.textContent = 'Aanmelding versturen'; });
  });
})();
