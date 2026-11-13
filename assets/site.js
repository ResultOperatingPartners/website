(function () {
  'use strict';
  // Niet toestaan dat de site in een frame van een andere site wordt getoond (clickjacking).
  if (window.top !== window.self) { try { window.top.location = window.self.location; } catch (e) { document.documentElement.style.display = 'none'; } }

  var hdr = document.querySelector('.site');
  if (hdr) { var sc = function () { hdr.classList.toggle('scrolled', window.scrollY > 10); }; window.addEventListener('scroll', sc, { passive: true }); sc(); }

  var jaar = document.getElementById('jaar');
  if (jaar) jaar.textContent = new Date().getFullYear();

  // Mobiel menu (alleen op de homepage)
  var b = document.querySelector('.menu-btn'), n = document.getElementById('hoofdmenu');
  if (!b || !n) return;
  function h() { document.documentElement.style.setProperty('--hdr', document.querySelector('.site').getBoundingClientRect().bottom + 'px'); }
  function t(o) { h(); document.body.classList.toggle('menu-open', o); b.setAttribute('aria-expanded', o); b.setAttribute('aria-label', o ? 'Menu sluiten' : 'Menu openen'); }
  b.addEventListener('click', function () { t(!document.body.classList.contains('menu-open')); });
  n.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { t(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') t(false); });
})();
