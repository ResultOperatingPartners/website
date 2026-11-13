'use strict';
// Test de volledige API-flow met een nagebootste Microsoft Graph (geen echte verbinding).
const test = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

// Nep-versie van @azure/functions die de handlers opvangt.
const handlers = {};
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
  if (req === '@azure/functions') return '@azure/functions';
  return origResolve.call(this, req, ...rest);
};
require.cache['@azure/functions'] = { id: '@azure/functions', filename: '@azure/functions', loaded: true,
  exports: { app: { http: (name, def) => (handlers[name] = def.handler) } } };

Object.assign(process.env, {
  GRAPH_TENANT_ID: 't', GRAPH_CLIENT_ID: 'c', GRAPH_CLIENT_SECRET: 'GEHEIM-xyz-123', AGENDA_MAILBOX: 'dave@resultop.nl',
  BESCHIKBAARHEID: '1:09:00-17:00,2:09:00-17:00,3:09:00-17:00,4:09:00-17:00,5:09:00-17:00', MINIMAAL_UREN_VOORAF: '0',
});

const calls = [];
global.fetch = async (url, opts = {}) => {
  calls.push({ url, opts });
  if (url.includes('/oauth2/')) return res(200, { access_token: 'tok', expires_in: 3600 });
  if (url.endsWith('/calendar/getSchedule')) return res(200, { value: [{ scheduleItems: [] }] });
  if (url.endsWith('/events')) return res(201, { id: 'abc' });
  return res(404, {});
};
function res(status, body) { return { ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) }; }

require('../src/functions/slots');
require('../src/functions/book');
const ctx = { error: () => {}, log: () => {} };
const req = (body, headers = {}) => ({ headers: new Map(Object.entries(headers)), json: async () => body });

test('slots geeft beschikbare dagen', async () => {
  const r = await handlers.slots(req(), ctx);
  assert.strictEqual(r.status, 200);
  assert.ok(r.jsonBody.days.length > 0);
  // geheim komt nooit in het antwoord
  assert.ok(!JSON.stringify(r.jsonBody).includes('GEHEIM'));
});

test('boeken maakt Teams-afspraak met uitnodiging', async () => {
  const s = await handlers.slots(req(), ctx);
  const day = s.jsonBody.days.at(-1);
  const r = await handlers.book(req({ type: 'teams', date: day.date, time: day.slots[0], name: 'Jan <b>Jansen</b>', email: 'jan@voorbeeld.nl', consent: true, t: 9000 }), ctx);
  assert.strictEqual(r.status, 200, JSON.stringify(r.jsonBody));
  const ev = JSON.parse(calls.filter((c) => c.url.endsWith('/events')).at(-1).opts.body);
  assert.strictEqual(ev.isOnlineMeeting, true);
  assert.strictEqual(ev.attendees[0].emailAddress.address, 'jan@voorbeeld.nl');
  assert.ok(ev.body.content.includes('Jan &lt;b&gt;Jansen&lt;/b&gt;'));
  assert.ok(!ev.body.content.includes('<b>Jansen'));
  assert.strictEqual(ev.start.timeZone, 'W. Europe Standard Time');
});

test('telefoongesprek zonder nummer wordt geweigerd', async () => {
  const r = await handlers.book(req({ type: 'telefoon', date: '2030-01-01', time: '09:00', name: 'Jan', email: 'jan@voorbeeld.nl', consent: true, t: 9000 }), ctx);
  assert.strictEqual(r.status, 400);
});

test('bezet tijdstip geeft 409', async () => {
  const r = await handlers.book(req({ type: 'teams', date: '2026-11-15', time: '09:00', name: 'Jan', email: 'jan@voorbeeld.nl', consent: true, t: 9000 }), ctx);
  // 15 nov 2026 is een zondag -> niet beschikbaar
  assert.strictEqual(r.status, 409);
});

test('spam krijgt nep-succes maar er wordt niets aangemaakt', async () => {
  const before = calls.filter((c) => c.url.endsWith('/events')).length;
  const r = await handlers.book(req({ website: 'http://spam', type: 'teams' }), ctx);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(calls.filter((c) => c.url.endsWith('/events')).length, before);
});
