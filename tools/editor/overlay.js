(function () {
  'use strict';
  // Deze code draait alleen lokaal via server.py, nooit op de live site.
  var PAGE = window.__EDITOR_PAGE || '';
  var SELECTIE_TAGS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'A', 'BUTTON', 'LI', 'LABEL', 'SMALL', 'STRONG', 'EM', 'TD', 'TH', 'BLOCKQUOTE'];
  var actief = null;      // momenteel geselecteerd element
  var historie = [];      // undo-stack met volledige pagina-snapshots
  var vuil = false;

  function isBewerkbaarBlok(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.closest('#__editorUI')) return false;
    if (SELECTIE_TAGS.indexOf(el.tagName) === -1) return false;
    // alleen "bladeren": geen block-elementen als kind (anders selecteer je de hele pagina)
    for (var i = 0; i < el.children.length; i++) {
      var k = el.children[i];
      if (['DIV', 'SECTION', 'UL', 'OL', 'FORM', 'HEADER', 'FOOTER', 'MAIN', 'ARTICLE', 'NAV'].indexOf(k.tagName) !== -1) return false;
    }
    var tekst = (el.textContent || '').trim();
    return tekst.length > 0;
  }

  // ---------- UI opbouwen ----------
  var ui = document.createElement('div');
  ui.id = '__editorUI';
  ui.innerHTML =
    '<style data-editor-ui>' +
    '#__editorUI{all:initial}' +
    '.__e-bar{position:fixed;top:0;left:0;right:0;z-index:999999;background:#14213d;color:#fff;font:14px/1.4 system-ui,sans-serif;' +
    'padding:10px 16px;display:flex;gap:10px;align-items:center;box-shadow:0 2px 10px rgba(0,0,0,.25)}' +
    '.__e-bar b{font-weight:700;margin-right:auto}' +
    '.__e-bar select,.__e-bar button{font:inherit;border-radius:5px;border:1px solid #3a4a73;background:#1f3157;color:#fff;padding:6px 10px;cursor:pointer}' +
    '.__e-bar button.__primary{background:#c9a227;color:#14213d;border-color:#c9a227;font-weight:700}' +
    '.__e-bar button:disabled{opacity:.4;cursor:not-allowed}' +
    '.__e-msg{position:fixed;top:54px;left:16px;z-index:999999;background:#14213d;color:#fff;padding:8px 14px;border-radius:6px;font:13px system-ui,sans-serif;max-width:360px}' +
    '.__e-hover{outline:1.5px dashed #c9a227 !important;outline-offset:2px;cursor:text}' +
    '.__e-selected{outline:2.5px solid #c9a227 !important;outline-offset:2px}' +
    '.__e-toolbar{position:absolute;z-index:999998;background:#14213d;color:#fff;border-radius:7px;padding:6px;display:flex;gap:4px;' +
    'align-items:center;font:12px system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.3)}' +
    '.__e-toolbar button{background:#1f3157;color:#fff;border:1px solid #3a4a73;border-radius:4px;width:26px;height:26px;cursor:pointer;font:inherit}' +
    '.__e-toolbar button:hover{background:#2a4172}' +
    '.__e-toolbar .__lbl{padding:0 4px;color:#cfd6e4;white-space:nowrap}' +
    '.__e-resize{position:absolute;width:10px;height:10px;background:#c9a227;border:2px solid #14213d;border-radius:50%;cursor:ew-resize;z-index:999998}' +
    'body{padding-top:48px !important}' +
    '</style>' +
    '<div class="__e-bar">' +
    '<b>Editor — ' + PAGE + '</b>' +
    '<select class="__e-paginas"></select>' +
    '<button class="__e-undo" title="Ongedaan maken">↶ Ongedaan maken</button>' +
    '<button class="__e-save">Opslaan</button>' +
    '<button class="__e-publish __primary">Publiceren → pull request</button>' +
    '</div>';
  document.body.appendChild(ui);

  // paginakeuze vullen
  fetch('/').then(function (r) { return r.text(); }).then(function (t) {
    var sel = ui.querySelector('.__e-paginas');
    var tmp = document.createElement('div'); tmp.innerHTML = t;
    tmp.querySelectorAll('a').forEach(function (a) {
      var o = document.createElement('option');
      o.value = a.getAttribute('href'); o.textContent = a.textContent;
      if (a.textContent === PAGE) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () { window.location.href = sel.value; });
  });

  function melding(tekst, duur) {
    var m = document.createElement('div');
    m.className = '__e-msg'; m.textContent = tekst;
    ui.appendChild(m);
    setTimeout(function () { m.remove(); }, duur || 3500);
  }

  // ---------- hover / selectie ----------
  document.addEventListener('mouseover', function (e) {
    var el = e.target.closest(SELECTIE_TAGS.join(','));
    if (isBewerkbaarBlok(el)) el.classList.add('__e-hover');
  });
  document.addEventListener('mouseout', function (e) {
    var el = e.target.closest(SELECTIE_TAGS.join(','));
    if (el) el.classList.remove('__e-hover');
  });

  document.addEventListener('click', function (e) {
    if (e.target.closest('#__editorUI')) return;
    var el = e.target.closest(SELECTIE_TAGS.join(','));
    if (!isBewerkbaarBlok(el)) { deselecteer(); return; }
    e.preventDefault();
    selecteer(el);
  }, true);

  function deselecteer() {
    if (actief) { actief.classList.remove('__e-selected'); actief.removeAttribute('contenteditable'); }
    actief = null;
    var tb = ui.querySelector('.__e-toolbar'); if (tb) tb.remove();
    var rz = ui.querySelector('.__e-resize'); if (rz) rz.remove();
  }

  function huidigePx(el) { return parseFloat(getComputedStyle(el).fontSize) || 16; }

  function selecteer(el) {
    if (actief === el) return;
    deselecteer();
    actief = el;
    el.classList.add('__e-selected');
    el.setAttribute('contenteditable', 'true');
    toonWerkbalk(el);
  }

  function toonWerkbalk(el) {
    var oud = ui.querySelector('.__e-toolbar'); if (oud) oud.remove();
    var r = el.getBoundingClientRect();
    var tb = document.createElement('div');
    tb.className = '__e-toolbar';
    tb.style.top = Math.max(52, r.top + window.scrollY - 36) + 'px';
    tb.style.left = Math.max(4, r.left + window.scrollX) + 'px';
    tb.innerHTML =
      '<button data-a="kleiner" title="Kleinere tekst">A−</button>' +
      '<span class="__lbl">' + Math.round(huidigePx(el)) + 'px</span>' +
      '<button data-a="groter" title="Grotere tekst">A+</button>' +
      '<span class="__lbl">|</span>' +
      '<button data-a="smaller" title="Smaller blok">↔−</button>' +
      '<button data-a="breder" title="Breder blok">↔+</button>' +
      '<span class="__lbl">|</span>' +
      '<button data-a="omhoog" title="Naar voren verplaatsen">↑</button>' +
      '<button data-a="omlaag" title="Naar achteren verplaatsen">↓</button>';
    tb.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    tb.addEventListener('click', function (e) {
      var k = e.target.closest('button'); if (!k) return;
      e.preventDefault();
      bewerk(k.dataset.a);
    });
    ui.appendChild(tb);
  }

  function bewerk(actie) {
    if (!actief) return;
    voorSnapshot();
    var px = huidigePx(actief);
    if (actie === 'kleiner') actief.style.fontSize = Math.max(10, px - 1) + 'px';
    if (actie === 'groter') actief.style.fontSize = Math.min(96, px + 1) + 'px';
    if (actie === 'smaller' || actie === 'breder') {
      var doel = actief.closest('div,section,p,li') || actief;
      var breedte = doel.getBoundingClientRect().width;
      var nieuw = actie === 'breder' ? breedte + 24 : Math.max(60, breedte - 24);
      doel.style.maxWidth = Math.round(nieuw) + 'px';
    }
    if (actie === 'omhoog' || actie === 'omlaag') {
      var sib = actie === 'omhoog' ? actief.previousElementSibling : actief.nextElementSibling;
      if (sib) {
        if (actie === 'omhoog') actief.parentNode.insertBefore(actief, sib);
        else actief.parentNode.insertBefore(sib, actief);
      }
    }
    markeerVuil();
    toonWerkbalk(actief);
  }

  document.addEventListener('input', function (e) {
    if (e.target === actief) markeerVuil();
  }, true);

  function markeerVuil() {
    vuil = true;
    ui.querySelector('.__e-save').textContent = 'Opslaan ●';
  }

  // ---------- undo ----------
  function voorSnapshot() {
    historie.push(document.body.innerHTML);
    if (historie.length > 30) historie.shift();
  }
  ui.querySelector('.__e-undo').addEventListener('click', function () {
    if (!historie.length) { melding('Niets om ongedaan te maken.'); return; }
    var laatste = historie.pop();
    var sel = ui.querySelector('.__e-paginas') ? ui.querySelector('.__e-paginas').cloneNode(true) : null;
    deselecteer();
    document.body.innerHTML = laatste;
    document.body.appendChild(ui);
    markeerVuil();
  });

  // ---------- opslaan / publiceren ----------
  function schoneHtml() {
    var kopie = document.documentElement.cloneNode(true);
    kopie.querySelectorAll('#__editorUI').forEach(function (n) { n.remove(); });
    kopie.querySelectorAll('[data-editor-script], script[data-editor-boot]').forEach(function (n) { n.remove(); });
    kopie.querySelectorAll('[contenteditable]').forEach(function (n) { n.removeAttribute('contenteditable'); });
    kopie.querySelectorAll('.__e-hover,.__e-selected').forEach(function (n) {
      n.classList.remove('__e-hover', '__e-selected');
      if (!n.getAttribute('class')) n.removeAttribute('class');
    });
    var lichaam = kopie.querySelector('body');
    if (lichaam) lichaam.style.paddingTop = '';
    return '<!DOCTYPE html>\n' + kopie.outerHTML;
  }

  function opslaan(stil) {
    return fetch('/__save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: PAGE, html: schoneHtml() }),
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.ok) {
        vuil = false;
        ui.querySelector('.__e-save').textContent = 'Opslaan';
        if (!stil) melding('Opgeslagen op je computer (nog niet gepubliceerd).');
      } else {
        melding('Opslaan mislukt: ' + (j.error || 'onbekende fout'), 6000);
      }
      return j.ok;
    });
  }
  ui.querySelector('.__e-save').addEventListener('click', function () { opslaan(false); });

  ui.querySelector('.__e-publish').addEventListener('click', function () {
    var knop = ui.querySelector('.__e-publish');
    var notitie = window.prompt('Korte omschrijving van je wijziging (voor de pull request):', 'Teksten aangepast via de editor');
    if (notitie === null) return;
    knop.disabled = true; knop.textContent = 'Bezig…';
    opslaan(true).then(function (okOpgeslagen) {
      if (!okOpgeslagen) { knop.disabled = false; knop.textContent = 'Publiceren → pull request'; return; }
      fetch('/__publish', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: notitie }),
      }).then(function (r) { return r.json(); }).then(function (j) {
        knop.disabled = false; knop.textContent = 'Publiceren → pull request';
        if (j.ok) {
          melding('Pull request klaargezet' + (j.url ? ' — geopend in je browser.' : '.') + ' Keur die goed op GitHub om live te zetten.', 7000);
        } else {
          melding('Publiceren mislukt: ' + (j.error || 'onbekende fout'), 8000);
        }
      }).catch(function () {
        knop.disabled = false; knop.textContent = 'Publiceren → pull request';
        melding('Geen verbinding met de lokale editorserver.', 6000);
      });
    });
  });

  window.addEventListener('beforeunload', function (e) {
    if (vuil) { e.preventDefault(); e.returnValue = ''; }
  });

  melding('Klik op een tekst om te bewerken. Wijzigingen gaan pas live na "Publiceren" + jouw goedkeuring op GitHub.', 6000);
})();
