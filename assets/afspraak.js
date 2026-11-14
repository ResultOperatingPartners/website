(function () {
  'use strict';
  // Twee werkwijzen:
  //  1. AGENDA: er draait een beveiligde server (/api). Vrije tijden komen uit Outlook,
  //     de afspraak wordt direct ingepland en de bezoeker krijgt een uitnodiging.
  //  2. AANVRAAG: geen server (nu). Tijden komen uit assets/afspraak-config.js en de
  //     bezoeker verstuurt een kant-en-klare e-mail naar het ingestelde adres.
  var API = '/api';
  var CFG = window.AFSPRAAK_CONFIG || {};
  var EMAIL = CFG.email || 'dave@resultop.nl';
  var mode = 'agenda';
  var startedAt = Date.now();
  var state = { type: null, date: null, time: null, days: [] };
  var $ = function (id) { return document.getElementById(id); };
  var DAG = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  var DAG_LANG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  var MND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  var MND_LANG = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

  $('jaar').textContent = new Date().getFullYear();
  document.querySelectorAll('a[href^="mailto:dave@resultop.nl"]').forEach(function (a) {
    a.href = a.href.replace('dave@resultop.nl', EMAIL);
    if (a.textContent === 'dave@resultop.nl') a.textContent = EMAIL;
  });

  function pad(n) { return String(n).padStart(2, '0'); }
  function isoOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parts(iso) {
    var p = iso.split('-').map(Number);
    var wd = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
    return { y: p[0], m: p[1] - 1, d: p[2], wd: wd };
  }
  function longDate(iso) { var p = parts(iso); return DAG_LANG[p.wd] + ' ' + p.d + ' ' + MND_LANG[p.m]; }
  function toMin(t) { var a = String(t).split(':'); return Number(a[0]) * 60 + Number(a[1]); }
  function hhmm(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (html != null) e.innerHTML = html;
    return e;
  }
  function unlock(id) { $(id).classList.remove('locked'); }
  function lock(id) { $(id).classList.add('locked'); }

  // Tijdstip (ms) van een datum + minuten in Nederlandse tijd.
  function amsOffset(ms) {
    try {
      var tz = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Amsterdam', timeZoneName: 'shortOffset' })
        .formatToParts(new Date(ms)).find(function (x) { return x.type === 'timeZoneName'; }).value;
      var m = /GMT([+-]\d+)/.exec(tz); if (m) return Number(m[1]) * 60;
    } catch (e) { /* standaard +1 */ }
    return 60;
  }
  function amsMs(iso, min) {
    var p = iso.split('-').map(Number);
    var guess = Date.UTC(p[0], p[1] - 1, p[2], Math.floor(min / 60), min % 60);
    return guess - amsOffset(guess) * 60000;
  }
  function isoMetZone(iso, min) {
    var off = amsOffset(amsMs(iso, min)), sign = off >= 0 ? '+' : '-'; off = Math.abs(off);
    return iso + 'T' + hhmm(min) + ':00' + sign + pad(Math.floor(off / 60)) + ':' + pad(off % 60);
  }

  // Tijden berekenen uit de instellingen (werkwijze AANVRAAG), zonder bezette momenten uit de agenda.
  function localSlots(bezet) {
    bezet = bezet || [];
    var namen = { zondag: 0, maandag: 1, dinsdag: 2, woensdag: 3, donderdag: 4, vrijdag: 5, zaterdag: 6 };
    var bron = CFG.beschikbaarheid || { vrijdag: [['09:00', '17:00']] };
    var perDag = {};
    Object.keys(bron).forEach(function (k) {
      var n = namen[k.toLowerCase()];
      if (n != null) perDag[n] = bron[k] || [];
    });
    var duur = CFG.duurMinuten || 30, stap = CFG.stapMinuten || 30;
    var vroegst = Date.now() + (CFG.minimaalUrenVooraf == null ? 24 : CFG.minimaalUrenVooraf) * 3600000;
    var horizon = CFG.maximaalDagenVooruit || 60;
    var uit = CFG.nietBeschikbaar || [];
    var days = [];
    var d = new Date(); d.setHours(0, 0, 0, 0);
    for (var i = 0; i <= horizon; i++, d.setDate(d.getDate() + 1)) {
      var iso = isoOf(d);
      if (uit.indexOf(iso) !== -1) continue;
      var slots = [];
      (perDag[d.getDay()] || []).forEach(function (b) {
        for (var s = toMin(b[0]); s + duur <= toMin(b[1]); s += stap) {
          var begin = amsMs(iso, s), eind = amsMs(iso, s + duur);
          var vrij = !bezet.some(function (b) { return b[0] < eind && b[1] > begin; });
          if (begin >= vroegst && vrij) slots.push(hhmm(s));
        }
      });
      if (slots.length) days.push({ date: iso, slots: slots.filter(function (v, k, a) { return a.indexOf(v) === k; }).sort() });
    }
    return days;
  }

  // Stap 1: soort gesprek
  document.querySelectorAll('input[name=type]').forEach(function (r) {
    r.addEventListener('change', function () {
      state.type = r.value;
      $('phone').required = state.type === 'telefoon';
      $('phone-opt').textContent = state.type === 'telefoon' ? '(nodig om je te bellen)' : '(optioneel)';
      unlock('s2');
      if (state.date) unlock('s3');
      if (state.time) unlock('s4');
      update();
    });
  });

  // Stap 2: dagen ophalen — eerst de beveiligde server, anders de instellingen.
  function loadSlots() {
    fetch(API + '/slots', { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(function (r) {
        var ct = r.headers.get('content-type') || '';
        if (!r.ok || ct.indexOf('json') === -1) throw new Error('geen server');
        return r.json();
      })
      .then(function (data) { mode = 'agenda'; state.days = data.days || []; afterLoad(); })
      .catch(function () {
        mode = 'aanvraag';
        fetch('/assets/bezet.json', { cache: 'no-store' })
          .then(function (r) { return r.ok ? r.json() : {}; })
          .catch(function () { return {}; })
          .then(function (j) { state.days = localSlots((j && j.bezet) || []); afterLoad(); });
      });
  }

  function afterLoad() {
    if (mode === 'aanvraag') {
      $('submit').textContent = 'Aanvraag versturen';
      $('mode-note').textContent = 'Kies je voorkeursmoment. Dave bevestigt het gesprek persoonlijk, ' + (CFG.bevestigingTermijn || 'binnen één werkdag') + '.';
      $('mode-note').hidden = false;
    }
    renderDates();
  }

  function renderDates() {
    var wrap = $('dates-wrap');
    wrap.innerHTML = '';
    if (!state.days.length) {
      wrap.innerHTML = '<p class="hint">Er zijn op dit moment geen vrije momenten. Mail gerust naar <a href="mailto:' + EMAIL + '?subject=Kennismaking">' + EMAIL + '</a>.</p>';
      return;
    }
    var row = el('div', { class: 'dates', role: 'group', 'aria-label': 'Beschikbare dagen' });
    state.days.forEach(function (day) {
      var p = parts(day.date);
      var b = el('button', { type: 'button', class: 'date', 'aria-pressed': 'false', 'data-date': day.date, 'aria-label': longDate(day.date) },
        '<span class="wd">' + DAG[p.wd] + '</span><span class="d">' + p.d + '</span><span class="m">' + MND[p.m] + '</span>');
      b.addEventListener('click', function () { selectDate(day.date); });
      row.appendChild(b);
    });
    wrap.appendChild(row);
  }

  function selectDate(date) {
    state.date = date; state.time = null;
    document.querySelectorAll('.date').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.date === date)); });
    var day = state.days.find(function (d) { return d.date === date; });
    var wrap = $('times-wrap');
    wrap.innerHTML = '';
    var grid = el('div', { class: 'times', role: 'group', 'aria-label': 'Beschikbare tijden op ' + longDate(date) });
    (day ? day.slots : []).forEach(function (t) {
      var b = el('button', { type: 'button', class: 'time', 'aria-pressed': 'false', 'data-time': t }, t);
      b.addEventListener('click', function () { selectTime(t); });
      grid.appendChild(b);
    });
    wrap.appendChild(grid);
    unlock('s3'); lock('s4');
    update();
  }

  function selectTime(t) {
    state.time = t;
    document.querySelectorAll('.time').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.time === t)); });
    unlock('s4');
    update();
    if (window.matchMedia('(max-width:640px)').matches) $('s4').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function soort() { return state.type === 'teams' ? 'Teams-gesprek' : 'Telefonisch gesprek'; }

  function update() {
    var s = $('summary');
    if (state.type && state.date && state.time) {
      s.hidden = false;
      s.innerHTML = '<b>' + soort() + '</b> op <b>' + longDate(state.date) + '</b> om <b>' + state.time + ' uur</b> (' + (CFG.duurMinuten || 30) + ' minuten)';
    } else { s.hidden = true; }
    $('submit').disabled = !(state.type && state.date && state.time);
  }

  function showDone(title, lines) {
    $('form').hidden = true; $('done').hidden = false;
    $('done-title').textContent = title;
    $('done-text').textContent = lines[0];
    $('done-extra').textContent = lines[1] || '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }


  // Noodroute (bijv. lokaal testen zonder server): aanvraag via het e-mailprogramma van de bezoeker.
  function aanvraagPerMail(data, moment) {
    var subject = 'Aanvraag kennismaking: ' + soort() + ', ' + longDate(state.date) + ' ' + state.time + ' - ' + data.name;
    var body = [
      'Beste Dave,', '',
      'Graag plan ik een kennismakingsgesprek in.', '',
      'Voorkeursmoment: ' + longDate(state.date) + ' om ' + state.time + ' uur',
      'Soort gesprek: ' + soort(),
      'Naam: ' + data.name,
      data.company ? 'Organisatie: ' + data.company : null,
      'E-mail: ' + data.email,
      data.phone ? 'Telefoon: ' + data.phone : null,
      data.message ? '\nToelichting:\n' + data.message : null,
      '', 'Met vriendelijke groet,', data.name,
    ].filter(function (x) { return x !== null; }).join('\n');
    window.__openMail('mailto:' + EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body));
    showDone('Nog één stap: verstuur de e-mail', [
      'Je e-mailprogramma is geopend met de aanvraag voor: ' + moment + '. Klik daar op Verzenden.',
      'Dave bevestigt het gesprek ' + (CFG.bevestigingTermijn || 'binnen één werkdag') + '. Opende er geen e-mail? Stuur dan een bericht naar ' + EMAIL + ' met je voorkeursmoment.',
    ]);
  }

  // Vaste regel die Power Automate kan uitlezen (tussen [[ROP]] en [[/ROP]]).
  function systeemGegevens(data) {
    var start = toMin(state.time), duur = CFG.duurMinuten || 30;
    var schoon = function (v) { return String(v || '').replace(/[\[\]]/g, '').slice(0, 1500); };
    return '[[ROP]]' + naarBase64(JSON.stringify({
      naam: schoon(data.name), email: schoon(data.email), telefoon: schoon(data.phone), organisatie: schoon(data.company),
      soort: state.type === 'teams' ? 'teams' : 'telefoon', soortTekst: soort(),
      start: state.date + 'T' + hhmm(start) + ':00', eind: state.date + 'T' + hhmm(start + duur) + ':00',
      moment: longDate(state.date) + ' om ' + state.time + ' uur', bericht: schoon(data.message),
    })) + '[[/ROP]]';
  }
  function naarBase64(t) { return btoa(unescape(encodeURIComponent(t))); }

  // Link die de afspraak met één klik in Outlook (web) klaarzet.
  function agendaLink(data) {
    var start = toMin(state.time), duur = CFG.duurMinuten || 30;
    var q = {
      subject: 'Kennismaking ' + data.name + (data.company ? ' (' + data.company + ')' : '') + ' - ' + soort(),
      startdt: isoMetZone(state.date, start), enddt: isoMetZone(state.date, start + duur),
      body: 'Naam: ' + data.name + '\nE-mail: ' + data.email + (data.phone ? '\nTelefoon: ' + data.phone : '') + (data.message ? '\n\n' + data.message : ''),
    };
    if (state.type === 'teams') q.online = 'true';
    return 'https://outlook.office.com/calendar/deeplink/compose?' + Object.keys(q).map(function (k) { return k + '=' + encodeURIComponent(q[k]); }).join('&');
  }

  // Laatste, verse controle vlak vóór het versturen: de bezet-data kan verouderd zijn
  // als de bezoeker de pagina een tijdje open had staan. Voorkomt de meeste dubbele
  // aanvragen voor hetzelfde moment (geen garantie, want er draait geen server).
  function herbevestigNogVrij(klaar) {
    var begin = amsMs(state.date, toMin(state.time));
    var eind = amsMs(state.date, toMin(state.time) + (CFG.duurMinuten || 30));
    fetch('/assets/bezet.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (j) {
        var bezet = (j && j.bezet) || [];
        var botst = bezet.some(function (b) { return b[0] < eind && b[1] > begin; });
        klaar(!botst);
      })
      .catch(function () { klaar(true); }); // kon niet checken: laat de aanvraag gewoon door
  }

  // Tijdelijk (zolang er geen eigen server is): versturen via FormSubmit, op de
  // achtergrond. De bezoeker blijft op deze pagina en ziet geen scherm van FormSubmit.
  function aanvraagViaFormSubmit(data, moment) {
    var velden = {
      'Naam': data.name,
      'email': data.email,
      'Organisatie': data.company || '-',
      'Telefoon': data.phone || '-',
      'Soort gesprek': soort(),
      'Voorkeursmoment': longDate(state.date) + ' om ' + state.time + ' uur',
      'Toelichting': data.message || '-',
      'In mijn agenda zetten': agendaLink(data),
      'Gegevens voor automatische verwerking': systeemGegevens(data),
      '_subject': 'Aanvraag kennismaking: ' + soort() + ', ' + longDate(state.date) + ' ' + state.time + ' - ' + data.name,
      '_template': 'table',
      '_captcha': 'false',
      '_honey': '',
      '_autoresponse': 'Beste ' + data.name + ',\n\nBedankt voor je aanvraag voor een kennismakingsgesprek (' + soort() + ') op ' + longDate(state.date) + ' om ' + state.time + ' uur.\n\nDit is een automatische ontvangstbevestiging: Dave bevestigt het gesprek persoonlijk ' + (CFG.bevestigingTermijn || 'binnen één werkdag') + ' per e-mail. Tot die bevestiging staat het moment nog niet definitief vast.\n\nVragen? Mail gerust terug naar ' + EMAIL + '.\n\nMet vriendelijke groet,\nResult Operating Partners',
    };
    var url = CFG.formsubmit.replace('formsubmit.co/', 'formsubmit.co/ajax/');
    var b = $('submit'); var msg = $('msg');
    b.disabled = true; b.innerHTML = '<span class="spin"></span>Bezig met versturen…';
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(velden) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok && String(res.j.success) === 'true') {
          showDone('Je aanvraag is ontvangen', [
            'Aanvraag voor: ' + moment + '.',
            'Dave bevestigt het gesprek persoonlijk per e-mail, ' + (CFG.bevestigingTermijn || 'binnen één werkdag') + '. Geen bericht ontvangen? Kijk dan ook in je map met ongewenste e-mail.',
          ]);
          return;
        }
        throw new Error('mislukt');
      })
      .catch(function () {
        msg.textContent = 'Het versturen is niet gelukt. Mail of bel ons gerust: ' + EMAIL + ' of 06 46 74 85 49.';
        msg.className = 'msg err';
      })
      .finally(function () { b.innerHTML = 'Aanvraag versturen'; update(); });
  }

  // Wordt in tests vervangen; opent het e-mailprogramma van de bezoeker.
  window.__openMail = function (url) { window.location.href = url; };

  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = $('msg'); msg.textContent = ''; msg.className = 'msg';
    var f = e.target;
    var data = {
      type: state.type, date: state.date, time: state.time,
      name: f.name.value.trim(), company: f.company.value.trim(), email: f.email.value.trim(),
      phone: f.phone.value.trim(), message: f.message.value.trim(),
      consent: f.consent.checked, website: f.website.value, t: Date.now() - startedAt,
    };
    var problem =
      data.name.length < 2 ? 'Vul je naam in.' :
      !/^\S+@\S+\.\S+$/.test(data.email) ? 'Vul een geldig e-mailadres in.' :
      (data.type === 'telefoon' && data.phone.replace(/\D/g, '').length < 8) ? 'Vul het telefoonnummer in waarop Dave je kan bellen.' :
      !data.consent ? 'Geef toestemming voor het gebruik van je gegevens.' : '';
    if (problem) { msg.textContent = problem; msg.classList.add('err'); return; }
    if (data.website) return; // spamval

    var moment = soort() + ' op ' + longDate(state.date) + ' om ' + state.time + ' uur';

    if (mode === 'aanvraag' && CFG.formsubmit) {
      var btnC = $('submit');
      btnC.disabled = true; btnC.innerHTML = '<span class="spin"></span>Moment controleren…';
      herbevestigNogVrij(function (nogVrij) {
        if (!nogVrij) {
          msg.textContent = 'Dit moment is helaas net door iemand anders gekozen. Kies een ander moment hieronder.';
          msg.classList.add('err');
          btnC.innerHTML = 'Aanvraag versturen';
          state.time = null; lock('s4'); update();
          loadSlots();
          return;
        }
        aanvraagViaFormSubmit(data, moment);
      });
      return;
    }

    if (mode === 'aanvraag') {
      var btnA = $('submit');
      btnA.disabled = true; btnA.innerHTML = '<span class="spin"></span>Bezig met versturen…';
      fetch('/api/aanvraag.php', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) {
          var ct = r.headers.get('content-type') || '';
          if (ct.indexOf('json') === -1) throw new Error('geen server');
          return r.json().then(function (j) { return { ok: r.ok, j: j }; });
        })
        .then(function (res) {
          if (res.ok && res.j.ok) {
            showDone('Je aanvraag is ontvangen', [
              'Aanvraag voor: ' + moment + '.',
              'Je ontvangt een bevestiging per e-mail. Dave bevestigt het gesprek ' + (CFG.bevestigingTermijn || 'binnen één werkdag') + '. Geen e-mail ontvangen? Kijk dan ook in je map met ongewenste e-mail.',
            ]);
            return;
          }
          msg.textContent = res.j.error || 'Het versturen is niet gelukt. Probeer het opnieuw.';
          msg.classList.add('err');
        })
        .catch(function () { aanvraagPerMail(data, moment); })
        .finally(function () { btnA.innerHTML = 'Aanvraag versturen'; update(); });
      return;
    }

    var btn = $('submit');
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Bezig met inplannen…';
    fetch(API + '/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j.ok) {
          showDone('Je afspraak staat gepland', [moment + '.', 'Je ontvangt binnen enkele minuten een uitnodiging per e-mail. Geen e-mail ontvangen? Kijk dan ook even in je map met ongewenste e-mail.']);
          return;
        }
        msg.textContent = res.j.error || 'Het inplannen is niet gelukt. Probeer het opnieuw.';
        msg.classList.add('err');
        if (res.status === 409) { state.time = null; loadSlots(); lock('s3'); }
      })
      .catch(function () { msg.textContent = 'Geen verbinding. Controleer je internet en probeer het opnieuw.'; msg.classList.add('err'); })
      .finally(function () { btn.innerHTML = 'Afspraak bevestigen'; update(); });
  });

  loadSlots();
})();
