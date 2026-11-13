'use strict';
// Alle instellingen komen uit de "Application settings" van Azure Static Web Apps.
// Geheimen (zoals GRAPH_CLIENT_SECRET) staan daar en NOOIT in deze repository.

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Instelling ${name} ontbreekt`);
  return v;
}

function int(name, fallback) {
  const v = parseInt(process.env[name] || '', 10);
  return Number.isFinite(v) ? v : fallback;
}

// BESCHIKBAARHEID: dagen en tijden waarop geboekt kan worden.
// Formaat: "dag:van-tot" gescheiden door komma's. Dag 1 = maandag ... 7 = zondag.
// Voorbeeld: "5:09:00-17:00" (alleen vrijdag) of "2:09:00-12:00,4:13:00-17:00".
function parseAvailability(s) {
  return String(s)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^([1-7]):(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
      if (!m) throw new Error(`Ongeldige BESCHIKBAARHEID: ${part}`);
      return {
        day: Number(m[1]),
        from: Number(m[2]) * 60 + Number(m[3]),
        to: Number(m[4]) * 60 + Number(m[5]),
      };
    });
}

function getConfig() {
  return {
    tenantId: required('GRAPH_TENANT_ID'),
    clientId: required('GRAPH_CLIENT_ID'),
    clientSecret: required('GRAPH_CLIENT_SECRET'),
    mailbox: required('AGENDA_MAILBOX'), // bijv. dave@resultop.nl
    availability: parseAvailability(process.env.BESCHIKBAARHEID || '5:09:00-17:00'),
    durationMin: int('DUUR_MINUTEN', 30),
    bufferMin: int('BUFFER_MINUTEN', 15),
    stepMin: int('STAP_MINUTEN', 30),
    leadHours: int('MINIMAAL_UREN_VOORAF', 24),
    horizonDays: int('MAXIMAAL_DAGEN_VOORUIT', 60),
  };
}

module.exports = { getConfig, parseAvailability };
