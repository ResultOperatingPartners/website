'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { computeSlots } = require('../src/lib/slots');
const { parseAvailability } = require('../src/lib/config');
const { validateBooking } = require('../src/lib/validate');
const { nowLocal, isoWeekday } = require('../src/lib/time');

const base = {
  availability: parseAvailability('5:09:00-17:00'),
  durationMin: 30, bufferMin: 15, stepMin: 30, leadHours: 24, horizonDays: 14,
};

test('alleen vrijdagen, 09:00 t/m 16:30', () => {
  // woensdag 11 nov 2026, 10:00
  const days = computeSlots({ ...base, now: { date: '2026-11-11', minutes: 600 }, busy: [] });
  assert.ok(days.length >= 2);
  for (const d of days) assert.strictEqual(isoWeekday(d.date), 5);
  assert.strictEqual(days[0].date, '2026-11-13');
  assert.strictEqual(days[0].slots[0], '09:00');
  assert.strictEqual(days[0].slots.at(-1), '16:30');
  assert.strictEqual(days[0].slots.length, 16);
});

test('minimaal 24 uur vooraf', () => {
  // donderdag 12 nov 14:00 -> vrijdag pas vanaf 14:00
  const days = computeSlots({ ...base, now: { date: '2026-11-12', minutes: 14 * 60 }, busy: [] });
  assert.strictEqual(days[0].date, '2026-11-13');
  assert.strictEqual(days[0].slots[0], '14:00');
});

test('bezette tijd met buffer wordt overgeslagen', () => {
  const busy = [{ start: '2026-11-13T10:00:00.0000000', end: '2026-11-13T11:00:00.0000000' }];
  const days = computeSlots({ ...base, now: { date: '2026-11-11', minutes: 600 }, busy });
  const s = days[0].slots;
  // 09:30-10:00 botst met buffer (09:45), 11:00 botst met buffer (tot 11:15)
  assert.ok(s.includes('09:00'));
  assert.ok(!s.includes('09:30'));
  assert.ok(!s.includes('10:00'));
  assert.ok(!s.includes('10:30'));
  assert.ok(!s.includes('11:00'));
  assert.ok(s.includes('11:30'));
});

test('hele dag bezet (vakantie) geeft geen slots die dag', () => {
  const busy = [{ start: '2026-11-13T00:00:00', end: '2026-11-14T00:00:00' }];
  const days = computeSlots({ ...base, now: { date: '2026-11-11', minutes: 600 }, busy });
  assert.ok(!days.find((d) => d.date === '2026-11-13'));
  assert.strictEqual(days[0].date, '2026-11-20');
});

test('meerdere tijdvakken per week', () => {
  const availability = parseAvailability('2:09:00-10:00,4:13:00-14:00');
  const days = computeSlots({ ...base, availability, now: { date: '2026-11-11', minutes: 600 }, busy: [] });
  assert.deepStrictEqual(days[0], { date: '2026-11-12', slots: ['13:00', '13:30'] });
  assert.deepStrictEqual(days[1], { date: '2026-11-17', slots: ['09:00', '09:30'] });
});

test('lokale tijd Amsterdam (winter- en zomertijd)', () => {
  assert.deepStrictEqual(nowLocal(new Date('2026-01-15T08:00:00Z')), { date: '2026-01-15', minutes: 9 * 60 });
  assert.deepStrictEqual(nowLocal(new Date('2026-07-15T08:00:00Z')), { date: '2026-07-15', minutes: 10 * 60 });
  assert.deepStrictEqual(nowLocal(new Date('2026-07-15T22:30:00Z')), { date: '2026-07-16', minutes: 30 });
});

test('validatie', () => {
  const ok = { type: 'teams', date: '2026-11-13', time: '09:00', name: 'Jan Jansen', email: 'jan@voorbeeld.nl', consent: true, t: 20000 };
  assert.ok(validateBooking(ok).ok);
  assert.strictEqual(validateBooking({ ...ok, email: 'geen-mail' }).ok, false);
  assert.strictEqual(validateBooking({ ...ok, consent: false }).ok, false);
  assert.strictEqual(validateBooking({ ...ok, type: 'telefoon' }).ok, false); // nummer verplicht
  assert.ok(validateBooking({ ...ok, type: 'telefoon', phone: '+31 6 12345678' }).ok);
  assert.strictEqual(validateBooking({ ...ok, website: 'spam' }).spam, true);
  assert.strictEqual(validateBooking({ ...ok, t: 500 }).spam, true);
  assert.strictEqual(validateBooking({ ...ok, name: '<script>x</script>' }).data.name, '<script>x</script>'); // wordt bij uitvoer ge-escaped
});
