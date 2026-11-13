'use strict';
// Communicatie met Microsoft Graph (je eigen Microsoft 365-omgeving).
// Er worden geen gegevens opgeslagen in deze API: alles gaat direct naar je agenda.
const { GRAPH_TZ } = require('./time');

let tokenCache = { token: null, exp: 0 };

async function getToken(cfg) {
  if (tokenCache.token && Date.now() < tokenCache.exp - 60_000) return tokenCache.token;
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const r = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(cfg.tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) throw new Error(`Token aanvragen mislukt (${r.status})`);
  const j = await r.json();
  tokenCache = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return tokenCache.token;
}

async function graph(cfg, method, path, payload, extraHeaders = {}) {
  const token = await getToken(cfg);
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: `outlook.timezone="${GRAPH_TZ}"`,
      ...extraHeaders,
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    const err = new Error(`Graph ${method} ${path.split('?')[0]} mislukt (${r.status})`);
    err.status = r.status; err.detail = text.slice(0, 500);
    throw err;
  }
  return r.status === 204 ? null : r.json();
}

// Bezette tijden ophalen (alleen begin/eind, geen inhoud van afspraken).
async function getBusy(cfg, fromDate, toDate) {
  const res = await graph(cfg, 'POST', `/users/${encodeURIComponent(cfg.mailbox)}/calendar/getSchedule`, {
    schedules: [cfg.mailbox],
    startTime: { dateTime: `${fromDate}T00:00:00`, timeZone: GRAPH_TZ },
    endTime: { dateTime: `${toDate}T23:59:00`, timeZone: GRAPH_TZ },
    availabilityViewInterval: 15,
  });
  const items = (res.value && res.value[0] && res.value[0].scheduleItems) || [];
  return items
    .filter((i) => i.status !== 'free')
    .map((i) => ({ start: i.start.dateTime, end: i.end.dateTime }));
}

async function createEvent(cfg, event) {
  return graph(cfg, 'POST', `/users/${encodeURIComponent(cfg.mailbox)}/events`, event);
}

module.exports = { getBusy, createEvent };
