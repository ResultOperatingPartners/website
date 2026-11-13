'use strict';
// Alle tijden worden behandeld als "lokale tijd in Nederland" (Europe/Amsterdam).
// We rekenen in minuten sinds middernacht per datum, zodat zomer-/wintertijd
// geen rol speelt: Outlook krijgt de tijd mee als W. Europe Standard Time.

const TZ = 'Europe/Amsterdam';
const GRAPH_TZ = 'W. Europe Standard Time';

// Huidige lokale datum/tijd in Nederland.
function nowLocal(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).reduce((a, p) => ((a[p.type] = p.value), a), {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

function addDays(isoDate, n) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

// 1 = maandag ... 7 = zondag
function isoWeekday(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

function hhmm(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

function parseHHMM(s) {
  const m = /^(\d{2}):(\d{2})$/.exec(s || '');
  if (!m) return null;
  const h = Number(m[1]); const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

// "2026-11-13T09:30:00.0000000" -> { date: '2026-11-13', minutes: 570 }
function parseGraphLocal(dt) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(dt);
  if (!m) return null;
  return { date: m[1], minutes: Number(m[2]) * 60 + Number(m[3]) };
}

// Absolute minuten (dag-index * 1440 + minuten) t.o.v. een basisdatum, voor vergelijkingen.
function absMinutes(baseDate, date, minutes) {
  const [y1, m1, d1] = baseDate.split('-').map(Number);
  const [y2, m2, d2] = date.split('-').map(Number);
  const days = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
  return days * 1440 + minutes;
}

module.exports = { TZ, GRAPH_TZ, nowLocal, addDays, isoWeekday, hhmm, parseHHMM, parseGraphLocal, absMinutes };
