'use strict';
const { app } = require('@azure/functions');
const { getConfig } = require('../lib/config');
const { getBusy } = require('../lib/graph');
const { computeSlots } = require('../lib/slots');
const { nowLocal, addDays } = require('../lib/time');

// Korte cache zodat de agenda niet bij elke bezoeker opnieuw wordt opgevraagd.
let cache = { at: 0, data: null };
const CACHE_MS = 60_000;

app.http('slots', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'slots',
  handler: async (request, context) => {
    try {
      if (cache.data && Date.now() - cache.at < CACHE_MS) {
        return json(200, cache.data);
      }
      const cfg = getConfig();
      const now = nowLocal();
      const busy = await getBusy(cfg, now.date, addDays(now.date, cfg.horizonDays));
      const days = computeSlots({ now, busy, ...cfg });
      const data = { durationMin: cfg.durationMin, days };
      cache = { at: Date.now(), data };
      return json(200, data);
    } catch (err) {
      context.error('slots fout', err.message, err.detail || '');
      return json(503, { error: 'De agenda is tijdelijk niet beschikbaar.' });
    }
  },
});

function json(status, body) {
  return {
    status,
    jsonBody: body,
    headers: { 'Cache-Control': 'no-store' },
  };
}

module.exports = { resetCache: () => (cache = { at: 0, data: null }) };
