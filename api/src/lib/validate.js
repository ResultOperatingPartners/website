'use strict';

const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,24}$/;
const PHONE = /^\+?[0-9 ()\-]{8,20}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

function clean(s, max) {
  return String(s == null ? '' : s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Controleert en schoont de invoer. Geeft { ok, data } of { ok:false, error }. */
function validateBooking(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Ongeldige aanvraag.' };
  // Spamval: dit veld is onzichtbaar voor mensen.
  if (body.website) return { ok: false, error: 'Ongeldige aanvraag.', spam: true };
  // Formulieren die binnen 3 seconden worden verstuurd zijn vrijwel zeker robots.
  if (typeof body.t === 'number' && body.t < 3000) return { ok: false, error: 'Ongeldige aanvraag.', spam: true };

  const d = {
    type: body.type === 'telefoon' ? 'telefoon' : body.type === 'teams' ? 'teams' : null,
    date: clean(body.date, 10),
    time: clean(body.time, 5),
    name: clean(body.name, 100),
    company: clean(body.company, 120),
    email: clean(body.email, 254).toLowerCase(),
    phone: clean(body.phone, 20),
    message: clean(body.message, 1500),
    consent: body.consent === true,
  };
  if (!d.type) return { ok: false, error: 'Kies een soort gesprek.' };
  if (!DATE.test(d.date) || !TIME.test(d.time)) return { ok: false, error: 'Kies een datum en tijd.' };
  if (d.name.length < 2) return { ok: false, error: 'Vul uw naam in.' };
  if (!EMAIL.test(d.email)) return { ok: false, error: 'Vul een geldig e-mailadres in.' };
  if (d.type === 'telefoon' && !PHONE.test(d.phone)) return { ok: false, error: 'Vul een geldig telefoonnummer in.' };
  if (d.phone && !PHONE.test(d.phone)) return { ok: false, error: 'Vul een geldig telefoonnummer in.' };
  if (!d.consent) return { ok: false, error: 'Geef toestemming voor het gebruik van uw gegevens.' };
  return { ok: true, data: d };
}

module.exports = { validateBooking, escapeHtml };
