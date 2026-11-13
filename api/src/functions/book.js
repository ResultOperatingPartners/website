'use strict';
const crypto = require('node:crypto');
const { app } = require('@azure/functions');
const { getConfig } = require('../lib/config');
const { getBusy, createEvent } = require('../lib/graph');
const { computeSlots } = require('../lib/slots');
const { nowLocal, parseHHMM, hhmm, GRAPH_TZ } = require('../lib/time');
const { validateBooking, escapeHtml } = require('../lib/validate');
const slotsModule = require('./slots');

// Eenvoudige rem tegen misbruik: maximaal 5 boekingen per uur per IP-adres.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 3_600_000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 5;
}

const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
function dutchDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAGEN[wd]} ${d} ${MAANDEN[m - 1]} ${y}`;
}

app.http('book', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'book',
  handler: async (request, context) => {
    const ip = (request.headers.get('x-forwarded-for') || request.headers.get('x-client-ip') || 'onbekend').split(',')[0].trim();
    if (rateLimited(ip)) return json(429, { error: 'Te veel aanvragen. Probeer het later opnieuw.' });

    const len = Number(request.headers.get('content-length') || 0);
    if (len > 10_000) return json(413, { error: 'Aanvraag te groot.' });

    let body;
    try { body = await request.json(); } catch { return json(400, { error: 'Ongeldige aanvraag.' }); }

    const v = validateBooking(body);
    if (!v.ok) {
      // Robots krijgen een "succes" terug, zodat ze niet gaan proberen de val te omzeilen.
      if (v.spam) return json(200, { ok: true });
      return json(400, { error: v.error });
    }
    const d = v.data;

    try {
      const cfg = getConfig();
      const startMin = parseHHMM(d.time);
      if (startMin == null) return json(400, { error: 'Kies een datum en tijd.' });

      // Opnieuw controleren of het tijdstip nog vrij is (iemand anders kan net eerder geboekt hebben).
      const now = nowLocal();
      const busy = await getBusy(cfg, d.date, d.date);
      const free = computeSlots({ now, busy, ...cfg, horizonDays: cfg.horizonDays })
        .find((x) => x.date === d.date);
      if (!free || !free.slots.includes(d.time)) {
        return json(409, { error: 'Dit tijdstip is helaas net bezet geraakt. Kies een ander moment.' });
      }

      const endMin = startMin + cfg.durationMin;
      const isTeams = d.type === 'teams';
      const datum = dutchDate(d.date);
      const tijd = `${d.time} - ${hhmm(endMin)} uur`;

      const regels = [
        `<p>Beste ${escapeHtml(d.name)},</p>`,
        `<p>Bedankt voor het inplannen van een kennismakingsgesprek met Result Operating Partners. Hierbij de bevestiging van onze afspraak:</p>`,
        `<p><strong>${escapeHtml(datum)}, ${escapeHtml(tijd)}</strong><br>`,
        isTeams
          ? 'Via Microsoft Teams. U kunt deelnemen via de link in deze uitnodiging.'
          : `Telefonisch. Dave Venmans belt u op ${escapeHtml(d.phone)}.`,
        '</p>',
        d.company ? `<p>Organisatie: ${escapeHtml(d.company)}</p>` : '',
        d.message ? `<p>Uw toelichting:<br>${escapeHtml(d.message).replace(/\n/g, '<br>')}</p>` : '',
        '<p>Kunt u onverhoopt niet? Laat het ons dan weten door te reageren op deze uitnodiging of te mailen naar dave@resultop.nl.</p>',
        '<p>Met vriendelijke groet,<br>Dave Venmans<br>Result Operating Partners</p>',
      ];

      const event = {
        subject: `Kennismaking Result Operating Partners${isTeams ? ' (Teams)' : ' (telefonisch)'}`,
        body: { contentType: 'HTML', content: regels.join('\n') },
        start: { dateTime: `${d.date}T${d.time}:00`, timeZone: GRAPH_TZ },
        end: { dateTime: `${d.date}T${hhmm(endMin)}:00`, timeZone: GRAPH_TZ },
        location: { displayName: isTeams ? 'Microsoft Teams' : `Telefonisch: ${d.phone}` },
        attendees: [{ emailAddress: { address: d.email, name: d.name }, type: 'required' }],
        allowNewTimeProposals: false,
        isReminderOn: true,
        reminderMinutesBeforeStart: 15,
        transactionId: crypto.randomUUID(),
        ...(isTeams ? { isOnlineMeeting: true, onlineMeetingProvider: 'teamsForBusiness' } : {}),
      };

      await createEvent(cfg, event);
      slotsModule.resetCache();
      return json(200, { ok: true, date: d.date, time: d.time, type: d.type });
    } catch (err) {
      context.error('book fout', err.message, err.detail || '');
      return json(503, { error: 'Het inplannen is niet gelukt. Probeer het later opnieuw of mail naar dave@resultop.nl.' });
    }
  },
});

function json(status, body) {
  return { status, jsonBody: body, headers: { 'Cache-Control': 'no-store' } };
}
