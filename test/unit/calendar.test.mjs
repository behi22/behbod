import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vanTime, sunElev, skyPhase, moonPhase, holidayAt, weatherFromCode, DAY } from '../../web/src/pure/calendar.js';

// Noon in Vancouver on a summer date is 19:00 UTC.
const vanNoon = (y, m, d) => new Date(Date.UTC(y, m - 1, d, 19));

test('vanTime reads the clock in Vancouver, not on the machine', () => {
  assert.deepEqual(vanTime(new Date('2026-07-01T19:00:00Z')), { y: 2026, m: 7, d: 1, h: 12, min: 0 });
  assert.deepEqual(vanTime(new Date('2026-07-02T06:30:00Z')), { y: 2026, m: 7, d: 1, h: 23, min: 30 });
  assert.equal(vanTime(new Date('2026-07-02T07:05:00Z')).h, 0);
});

test('the sun is high at a June noon and below the horizon at night', () => {
  const noon = sunElev(new Date('2026-06-21T20:15:00Z'));
  assert.ok(noon > 60 && noon < 66, String(noon));
  assert.ok(sunElev(new Date('2026-06-21T08:00:00Z')) < -10);
  assert.equal(skyPhase(new Date('2026-06-21T08:00:00Z')).phase, 'night');
  assert.equal(skyPhase(new Date('2026-06-21T20:15:00Z')).phase, 'day');
});

test('the moon phase starts new at the reference and is full half a month later', () => {
  const ref = Date.UTC(2000, 0, 6, 18, 14);
  assert.ok(moonPhase(new Date(ref)) < 1e-9);
  assert.ok(Math.abs(moonPhase(new Date(ref + 29.530588853 / 2 * DAY)) - 0.5) < 1e-9);
});

test('fixed date holidays', () => {
  assert.equal(holidayAt(vanNoon(2026, 7, 1)).id, 'canada');
  assert.equal(holidayAt(vanNoon(2026, 3, 5)).id, 'birthday');
  assert.equal(holidayAt(vanNoon(2026, 11, 11)).id, 'remembrance');
  assert.equal(holidayAt(vanNoon(2026, 9, 13)).id, 'programmers');
});

test('Yalda wins over the winter season and Christmas comes after it', () => {
  assert.equal(holidayAt(vanNoon(2026, 12, 10)).id, 'winter');
  assert.equal(holidayAt(vanNoon(2026, 12, 21)).id, 'yalda');
  assert.equal(holidayAt(vanNoon(2026, 12, 24)).id, 'christmas');
});

test('New Year runs across the year change and names the new year', () => {
  assert.equal(holidayAt(vanNoon(2026, 12, 31)).text, 'happy new year 2027');
  assert.equal(holidayAt(vanNoon(2027, 1, 1)).text, 'happy new year 2027');
});

test('Nowruz 2026 starts on March 21 and Chaharshanbe Suri is the Tuesday before', () => {
  assert.equal(holidayAt(vanNoon(2026, 3, 20)), null);
  assert.equal(holidayAt(vanNoon(2026, 3, 21)).id, 'nowruz');
  assert.equal(holidayAt(vanNoon(2026, 3, 17)).id, 'suri');
});

test('Thanksgiving is the weekend before the second Monday of October', () => {
  assert.equal(holidayAt(vanNoon(2026, 10, 11)).id, 'thanksgiving');
  assert.equal(holidayAt(vanNoon(2026, 10, 13)), null);
});

test('a plain day has no holiday, and a forced id overrides the date', () => {
  assert.equal(holidayAt(vanNoon(2026, 11, 4)), null);
  assert.equal(holidayAt(vanNoon(2026, 11, 4), 'yalda').id, 'yalda');
  assert.equal(holidayAt(vanNoon(2026, 11, 4), 'nope'), null);
});

test('weather codes map to what the window can show', () => {
  const cases = { 0: 'clear', 1: 'clear', 2: 'cloudy', 3: 'cloudy', 45: 'fog', 48: 'fog', 51: 'rain', 61: 'rain', 80: 'rain', 95: 'rain', 71: 'snow', 77: 'snow', 86: 'snow' };
  for (const [code, want] of Object.entries(cases)) assert.equal(weatherFromCode(+code), want, `code ${code}`);
});
