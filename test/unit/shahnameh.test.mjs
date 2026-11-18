import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as S from '../../web/src/pure/shahnameh.js';
import { equinox, nextNowruz, nowruzLines } from '../../web/src/pure/nowruz.js';
import { noteCorners as ariaCorners } from '../../web/src/pure/aria.js';

const meta = JSON.parse(readFileSync(new URL('../../web/assets/world.json', import.meta.url), 'utf8'));
const screen = meta.screens.main, tattoo = meta.points.postit;
const sub = (a, b) => a.map((q, i) => q - b[i]);
const len = v => Math.hypot(...v);
const visible = JSON.stringify([S.COUPLET, S.NOTE_SAY, S.STORIES, S.FIRESIDE, S.PLAQUES, S.ferdowsiLines()]);

test('the words: no long dashes, Persian letters (not the Arabic look-alikes), the couplet as he chose it', () => {
  assert.ok(!/[–—]/.test(visible), 'no long dashes');
  assert.ok(!/[كي]/.test(visible), 'Persian kaf and ye, not Arabic');
  assert.equal(S.COUPLET.fa.join(' · '), 'توانا بود هر که دانا بود · ز دانش دل پیر برنا بود');
  assert.equal(S.COUPLET.en, 'Whoever knows is strong; with knowledge an old heart grows young.');
});

test('the terminal: ferdowsi prints the couplet, its sound and its meaning, each line fitting the window', () => {
  const lines = S.ferdowsiLines();
  assert.equal(lines.length, 7);
  assert.ok(lines.some(l => l.includes(S.COUPLET.fa[0])) && lines.some(l => l.includes(S.COUPLET.latin[1])) && lines.slice(-2).map(l => l.trim()).join(' ') === `"${S.COUPLET.en}"`);
  // The wide terminal holds 66 characters a line.
  for (const l of lines) assert.ok(l.length <= 66, l);
});

test('the reader: four stories, each with its tab, titles in two languages and short paragraphs', () => {
  assert.deepEqual(S.STORIES.map(s => s.id), ['zal', 'labours', 'siavash', 'sohrab']);
  for (const s of S.STORIES) {
    assert.ok(s.tab && s.title && /[؀-ۿ]/.test(s.fa) && s.text.length >= 3, s.id);
    const words = s.text.join(' ').split(/\s+/).length;
    assert.ok(words >= 90 && words <= 190, `${s.id}: ${words} words`);
  }
  assert.equal(S.storyById('sohrab').title, 'Rostam and Sohrab');
  for (const odd of ['nope', '__proto__', 'constructor', '']) assert.equal(S.storyById(odd), null, odd);
});

test('BH-22 by the fire: a different story each visit, and the next one when asked again', () => {
  const n = S.FIRESIDE.length;
  assert.ok(n >= 5);
  for (const lines of S.FIRESIDE) { assert.ok(lines.length === 3, lines[0]); for (const l of lines) assert.ok(l.length <= 100, l); }
  const firsts = Array.from({ length: n }, (_, v) => S.firesideAt(v, 0));
  assert.equal(new Set(firsts).size, n, 'n visits in a row, n different first stories');
  assert.notEqual(S.firesideAt(3, 0), S.firesideAt(3, 1), 'asked again in a visit, the next story');
  assert.equal(S.firesideAt(n, 0), S.firesideAt(0, 0), 'they come round again');
  assert.equal(S.firesideAt(-1, 0), S.FIRESIDE[n - 1], 'a broken count still gives a story');
});

test('the plaques: a title, a Persian name, the story, a place to read it from', () => {
  assert.deepEqual(Object.keys(S.PLAQUES), Object.keys(S.PLAQUE_AT));
  for (const [id, p] of Object.entries(S.PLAQUES)) {
    assert.ok(p.title && /[؀-ۿ]/.test(p.fa) && p.text.length > 100 && p.text.length < 320, id);
    const at = S.PLAQUE_AT[id];
    assert.equal(at.corners.length, 4);
    // A front face whose normal points at the reader's spot.
    const [tl, , bl, br] = at.corners, e1 = sub(bl, tl), e2 = sub(br, tl);
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const toSpot = sub(at.spot, tl);
    assert.ok(n[0] * toSpot[0] + n[1] * toSpot[1] > 0, `${id} faces its spot`);
    assert.ok(Math.abs(len(sub(at.corners[1], tl)) / len(e1) - at.size[0] / at.size[1]) < 0.05, `${id} picture not stretched`);
  }
  // The chess plaque sits on the lounge pit's north step face, inside its height; the nard plate on the table top.
  const chess = S.PLAQUE_AT.plaque_chess.corners;
  assert.ok(chess.every(c => c[2] < 0 && c[2] > -0.45 && Math.abs(c[1] - 13.595) < 1e-9));
  const nard = S.PLAQUE_AT.plaque_nard.corners;
  assert.ok(nard.every(c => Math.hypot(c[0] - 15, c[1] - 16.6) < 0.45 && c[2] >= 0.755), 'on the bistro table');
});

test('the second note sits beside the tattoo post-it, apart from it, below the screen and facing the chair', () => {
  const [tl, tr, bl, br] = S.noteCorners(screen);
  for (const [a, b] of [[tl, tr], [bl, br], [tl, bl], [tr, br]]) assert.ok(Math.abs(len(sub(a, b)) - S.NOTE.size) < 1e-9);
  const bottom = screen.center[2] - screen.h / 2;
  for (const c of [tl, tr, bl, br]) assert.ok(c[2] < bottom, 'below the screen');
  const e1 = sub(bl, tl), e2 = sub(br, tl), n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  assert.ok(n[0] < 0 && tl[1] > tr[1], 'faces the chair');
  // The tattoo note is 8.5 cm square, centred 11 cm in from the bezel's right-hand end; this one is further in, a
  // centimetre or two clear of it, and on the other side of the screen's middle from Aria's.
  const tattooInner = tattoo[1] + 0.0425, mine = Math.min(...[tl, tr, bl, br].map(c => c[1]));
  assert.ok(mine - tattooInner > 0.005 && mine - tattooInner < 0.03, `gap ${(mine - tattooInner).toFixed(3)}`);
  assert.ok(Math.max(tl[1], bl[1]) < screen.center[1], 'right of the middle');
  assert.ok(Math.min(...ariaCorners(screen).map(c => c[1])) > screen.center[1]);
  assert.ok(Math.min(bl[2], br[2]) > tattoo[2] - 0.1, 'above the desk top');
});

test('nowruz: the March equinox to the minute, against the published times', () => {
  const known = { 2022: '2022-03-20T15:33', 2023: '2023-03-20T21:24', 2024: '2024-03-20T03:06', 2025: '2025-03-20T09:01', 2026: '2026-03-20T14:46', 2027: '2027-03-20T20:25' };
  for (const [y, t] of Object.entries(known)) {
    const d = Math.abs(equinox(+y) - new Date(t + 'Z'));
    assert.ok(d < 90000, `${y}: off by ${(d / 1000).toFixed(0)} s`);
  }
});

test('nowruz: the countdown, the days of Nowruz, and the year after', () => {
  const before = nowruzLines(new Date('2026-11-18T20:00:00Z'));
  assert.deepEqual(before.slice(0, 2), ['Nowruz 1406 begins at the spring equinox:', 'Sat 20 Mar 2027, 13:24 in Vancouver, 23:54 in Tehran.']);
  assert.match(before[2], /^122 days and 24 minutes to go\.$/);
  assert.equal(nowruzLines(new Date('2027-03-20T18:00:00Z'))[2], '2 hours and 24 minutes to go.');
  assert.equal(nowruzLines(new Date('2027-03-20T20:24:30Z'))[2], 'less than a minute to go.');
  assert.equal(nowruzLines(new Date('2027-03-19T19:23:00Z'))[2], '1 day, 1 hour and 1 minute to go.');
  assert.deepEqual(nowruzLines(new Date('2027-03-21T21:00:00Z')), ['Nowruz mobarak: happy new year 1406!', 'The year turned at the spring equinox, 1 day ago.']);
  assert.equal(nowruzLines(new Date('2027-03-20T21:00:00Z'))[1], 'The year turned at the spring equinox, today.');
  // Thirteen days on, the countdown is to the next year's.
  assert.equal(nextNowruz(new Date('2027-04-03T00:00:00Z')).getUTCFullYear(), 2028);
  assert.equal(nextNowruz(new Date('2027-03-30T00:00:00Z')).getUTCFullYear(), 2027);
  assert.equal(nextNowruz(new Date('2027-01-01T00:00:00Z')).getUTCFullYear(), 2027);
  for (const d of ['2026-01-01', '2026-06-01', '2026-12-31', '2027-03-25']) for (const l of nowruzLines(new Date(d + 'T12:00:00Z'))) assert.ok(l.length <= 66 && !/[–—]/.test(l), l);
});
