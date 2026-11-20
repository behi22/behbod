import { test } from 'node:test';
import assert from 'node:assert/strict';

// Counts the formatters made for Vancouver's clock (making one is far dearer than using one).
const Real = Intl.DateTimeFormat;
let made = 0;
Intl.DateTimeFormat = function (locale, options) { if (options?.timeZone === 'America/Vancouver' && options?.minute) made++; return new Real(locale, options); };
Intl.DateTimeFormat.prototype = Real.prototype;
const { vanTime } = await import('../../web/src/pure/calendar.js');

// Regression: every reading of Vancouver's clock made a new date formatter; on a slowed phone a run of them held a
// frame for 120 ms.
test('Vancouver time is read with one formatter, made once, with the same answers as before', () => {
  for (let i = 0; i < 50; i++) vanTime(new Date(Date.UTC(2026, 6, 1, i % 24, 7)));
  assert.ok(made <= 1, `${made} formatters made for 50 readings`);
  assert.deepEqual(vanTime(new Date('2026-07-01T19:00:00Z')), { y: 2026, m: 7, d: 1, h: 12, min: 0 });
  assert.deepEqual(vanTime(new Date('2026-07-02T06:30:00Z')), { y: 2026, m: 7, d: 1, h: 23, min: 30 });
  assert.equal(vanTime(new Date('2026-07-02T07:05:00Z')).h, 0);
});
