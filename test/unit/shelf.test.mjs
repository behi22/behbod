import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES, SHELF, shelfSlots, thickness, titleLines } from '../../web/src/pure/shelf.js';

test('his twenty games, in the order he listed them, Spider-Man once', () => {
  assert.deepEqual(GAMES.map(g => g.title), [
    'Warzone', 'Escape from Tarkov', 'Battlefield', 'Call of Duty', 'Counter-Strike 1.6', 'CS:GO', 'Hunt: Showdown',
    'FIFA', 'Grand Theft Auto', 'Detroit: Become Human', 'Elden Ring', 'Spider-Man', 'Dark Souls', 'Mafia', "Assassin's Creed",
    'Max Payne', 'Rainbow Six Siege', 'Watch Dogs', 'Fallout', 'Batman',
  ]);
  assert.equal(new Set(GAMES.map(g => g.id)).size, 20);
  assert.equal(GAMES.filter(g => /spider/i.test(g.title)).length, 1);
});

test('each case has its colours, a scene and a sign, and a plain description of its cover for screen readers', () => {
  const arts = new Set();
  for (const g of GAMES) {
    for (const k of ['bg', 'ink', 'accent']) assert.match(g[k], /^#[0-9a-f]{6}$/, `${g.id} ${k}`);
    assert.ok(g.art && g.mark, g.id);
    arts.add(g.art);
    assert.ok(g.pic.length > 30 && !/[–—]/.test(g.pic), g.id);
  }
  assert.equal(arts.size, 20, 'every cover is its own scene');
});

test('the cases are 12.8 to 14.3 mm thick and pack the shelf with no gaps, from its south end', () => {
  const slots = shelfSlots();
  for (const g of GAMES) assert.ok(thickness(g.id) >= 0.0128 && thickness(g.id) <= 0.0143 + 1e-9, g.id);
  assert.ok(Math.abs(slots[0].y - slots[0].t / 2 - (SHELF.y0 + SHELF.end)) < 1e-9);
  for (let i = 1; i < slots.length; i++) assert.ok(Math.abs((slots[i].y - slots[i].t / 2) - (slots[i - 1].y + slots[i - 1].t / 2)) < 1e-9, `gap before ${slots[i].id}`);
  assert.deepEqual(slots.map(s => s.id), GAMES.map(g => g.id));
});

test('the row covers the eight old blank cases and stays clear of the console side and the VR headset', () => {
  // lounge.py: the old cases at y 12.37 + 0.02 i (i = 0..7), 14 mm thick, 0.17 deep at x 0.6, 0.21 tall on the top at 1.07.
  const slots = shelfSlots(), start = slots[0].y - slots[0].t / 2, end = slots.at(-1).y + slots.at(-1).t / 2;
  assert.ok(start <= 12.37 - 0.007 && end >= 12.51 + 0.007, `${start.toFixed(4)} to ${end.toFixed(4)}`);
  assert.ok(SHELF.x - SHELF.depth / 2 <= 0.6 - 0.085 && SHELF.x + SHELF.depth / 2 >= 0.6 + 0.085 + 0.002, 'deeper than the old cases, front and back');
  assert.ok(SHELF.height >= 0.21 + 0.002, 'taller than the old cases');
  // The console side's inner face is at 12.325; the headset starts at 12.85.
  assert.ok(SHELF.y0 > 12.325 && end + SHELF.end < 12.85 - 0.05);
});

test('titles split for a narrow spine at a colon or the space nearest the middle', () => {
  assert.deepEqual(titleLines('Warzone'), ['WARZONE']);
  assert.deepEqual(titleLines('Detroit: Become Human'), ['DETROIT:', 'BECOME HUMAN']);
  assert.deepEqual(titleLines('Escape from Tarkov', 14), ['ESCAPE FROM', 'TARKOV']);
  assert.deepEqual(titleLines('Rainbow Six Siege', 14), ['RAINBOW', 'SIX SIEGE']);
  assert.deepEqual(titleLines('Counter-Strike 1.6', 18), ['COUNTER-STRIKE 1.6']);
  for (const g of GAMES) assert.ok(titleLines(g.title, 18).length <= 2);
});
