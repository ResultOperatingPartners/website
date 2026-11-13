'use strict';
const { addDays, isoWeekday, hhmm, parseGraphLocal, absMinutes } = require('./time');

/**
 * Berekent vrije tijdsloten.
 * @param {object} o
 * @param {{date:string, minutes:number}} o.now   huidige lokale tijd (NL)
 * @param {Array} o.availability                  [{day, from, to}] in minuten
 * @param {Array} o.busy                          [{start:'YYYY-MM-DDTHH:MM..', end:'...'}] lokale tijd
 * @param {number} o.durationMin
 * @param {number} o.bufferMin   rust na (en vóór) een afspraak
 * @param {number} o.stepMin
 * @param {number} o.leadHours
 * @param {number} o.horizonDays
 * @returns {Array<{date:string, slots:string[]}>}
 */
function computeSlots(o) {
  const base = o.now.date;
  const earliest = o.now.minutes + o.leadHours * 60; // absolute minuten t.o.v. base
  const busy = (o.busy || [])
    .map((b) => {
      const s = parseGraphLocal(b.start); const e = parseGraphLocal(b.end);
      if (!s || !e) return null;
      return { s: absMinutes(base, s.date, s.minutes) - o.bufferMin, e: absMinutes(base, e.date, e.minutes) + o.bufferMin };
    })
    .filter(Boolean);

  const days = [];
  for (let i = 0; i <= o.horizonDays; i++) {
    const date = addDays(base, i);
    const wd = isoWeekday(date);
    const windows = o.availability.filter((a) => a.day === wd);
    const slots = [];
    for (const w of windows) {
      for (let start = w.from; start + o.durationMin <= w.to; start += o.stepMin) {
        const absS = i * 1440 + start;
        const absE = absS + o.durationMin;
        if (absS < earliest) continue;
        const clash = busy.some((b) => absS < b.e && absE > b.s);
        if (!clash) slots.push(hhmm(start));
      }
    }
    if (slots.length) days.push({ date, slots: [...new Set(slots)].sort() });
  }
  return days;
}

module.exports = { computeSlots };
