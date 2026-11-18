import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLACES, SPOTS, FEAST_SPOTS, SAYS, FEASTS, feastAt, addPersia, makeSayer } from '../../web/src/pure/persia.js';
import { nowruz, EVENTS } from '../../web/src/pure/calendar.js';
import { makeInteract } from '../../web/src/pure/interact.js';
import { makeCollision } from '../../web/src/pure/collide.js';
import { CHARMS, CHARM, isOpen, readKit } from '../../web/src/pure/smith.js';
import { checkLayout } from '../../web/src/pure/layoutcheck.js';
import { makeNav } from '../../web/src/pure/nav.js';

const WORLD = JSON.parse(readFileSync(new URL('../../web/assets/world.json', import.meta.url), 'utf8'));
const fresh = () => JSON.parse(JSON.stringify(WORLD));
// About noon in Vancouver on a date, as a moment (UTC-8, or UTC-7 since BC kept its summer time: the same day either way).
const van = (y, m, d, h = 12) => new Date(Date.UTC(y, m - 1, d, h + 8));
const day = t => new Date(t).toISOString().slice(0, 10);

test('the haft-sin is out from Chaharshanbe Suri to Sizdah Bedar, and only then', () => {
  for (const y of [2026, 2027, 2028, 2031]) {
    const n = nowruz(y), suri = EVENTS.find(e => e.id === 'suri').span(y)[0], last = n + 12 * 864e5;
    const at = t => feastAt(new Date(t + 20 * 3600e3));
    assert.equal(at(suri), 'haftsin', `${y} suri ${day(suri)}`);
    assert.equal(at(n), 'haftsin', `${y} nowruz ${day(n)}`);
    assert.equal(at(last), 'haftsin', `${y} sizdah ${day(last)}`);
    assert.equal(at(suri - 864e5), null, `${y} the day before suri`);
    assert.equal(at(last + 864e5), null, `${y} the day after sizdah`);
    assert.ok(n - suri >= 864e5 && n - suri <= 8 * 864e5, `${y}: suri falls in the week before nowruz`);
  }
  // The day of the spring equinox in Tehran, the next day when it falls after noon there: 1 Farvardin.
  assert.equal(day(nowruz(2026)), '2026-03-21');
  assert.equal(day(nowruz(2027)), '2027-03-21');
  assert.equal(day(nowruz(2028)), '2028-03-20');
});

test('the Yalda table is out on the house\'s Yalda days, the solstice night among them', () => {
  assert.equal(feastAt(van(2026, 12, 20)), 'yalda');
  assert.equal(feastAt(van(2026, 12, 21, 20)), 'yalda');
  assert.equal(feastAt(van(2026, 12, 19)), null);
  assert.equal(feastAt(van(2026, 12, 22)), null);
  // Days are Vancouver's: 22 December at 05:00 UTC is still the 21st there.
  assert.equal(feastAt(new Date(Date.UTC(2026, 11, 22, 5))), 'yalda');
  assert.equal(feastAt(new Date(Date.UTC(2026, 11, 22, 9))), null);
  for (const [m, d] of [[1, 1], [6, 21], [9, 23], [11, 18], [3, 5]]) assert.equal(feastAt(van(2027, m, d)), null, `${m}/${d}`);
});

test('?holiday= previews a table: Nowruz, Suri and Sizdah the haft-sin, Yalda its own, anything else none', () => {
  for (const h of ['nowruz', 'suri', 'sizdah']) assert.equal(feastAt(van(2026, 7, 1), h), 'haftsin');
  assert.equal(feastAt(van(2026, 7, 1), 'yalda'), 'yalda');
  // A forced other holiday hides the table even on its real days, like the rest of the house's look.
  assert.equal(feastAt(van(2026, 3, 21), 'halloween'), null);
  assert.equal(feastAt(van(2026, 12, 20), 'nonsense'), null);
  assert.equal(feastAt(van(2026, 12, 20), ''), 'yalda');
  assert.deepEqual(Object.keys(FEASTS), ['haftsin', 'yalda']);
});

test('the pieces join the house: one collider for the shelf, their E spots, the table\'s only on its day', () => {
  const meta = fresh(), before = meta.interact.length, cols = meta.colliders.length;
  const got = addPersia(meta, null);
  assert.equal(meta.colliders.length, cols + 1);
  assert.equal(meta.interact.length, before + SPOTS.length);
  assert.equal(got.feast, null);
  const yal = fresh(); addPersia(yal, 'yalda');
  assert.equal(yal.interact.at(-1).id, 'yalda');
  for (const bad of ['bogus', '__proto__', 'constructor', '']) assert.equal(addPersia(fresh(), bad).feast, null, bad);
  // Copies: changing what was added never changes the module's own lists.
  meta.interact.at(-1).at[0] = 99;
  assert.notEqual(SPOTS.at(-1).at[0], 99);
});

test('each E spot is reached from where you stand, and nothing else of the house\'s is nearer there', () => {
  for (const feast of ['haftsin', 'yalda']) {
    const meta = fresh();
    addPersia(meta, feast);
    const things = makeInteract(meta.interact), col = makeCollision(meta);
    for (const s of [...SPOTS, FEAST_SPOTS[feast]]) {
      const p = { x: s.at[0], y: s.at[2], z: -s.at[1] };
      assert.equal(things.nearest(p)?.id, s.id, s.id);
      // The spot is open floor: standing there runs into nothing.
      assert.ok(!col.boxes.some(b => !b.off && p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1 && p.y + 0.5 > b.y0 && p.y + 0.5 < b.y1), `${s.id} stands in a collider`);
    }
  }
});

test('the shelf fits its corner: between the bookcase and the partition, under the collection case above', () => {
  const meta = fresh(), [x0, y0, z0] = PLACES.shelf.min, [x1, y1, z1] = PLACES.shelf.max;
  const solid = meta.colliders.filter(c => c.kind === 'solid');
  const overlaps = c => c.min[0] < x1 && c.max[0] > x0 && c.min[1] < y1 && c.max[1] > y0 && c.min[2] < z1 && c.max[2] > z0;
  assert.deepEqual(solid.filter(overlaps).map(c => c.name), []);
  const shelfE = meta.colliders.find(c => c.name === 'bookshelf_e'), part = meta.colliders.find(c => c.name === 'wall_partition');
  assert.ok(x0 >= shelfE.max[0] && x1 <= part.min[0], 'beside the bookcase, short of the partition');
  assert.ok(y0 >= 0 && y1 <= shelfE.max[1], 'no deeper than the bookcase');
});

test('with the pieces in, the house still passes its layout check and every old E spot is reached the same way', () => {
  for (const feast of [null, 'haftsin', 'yalda']) { const meta = fresh(); addPersia(meta, feast); assert.deepEqual(checkLayout(meta), [], String(feast)); }
  const before = fresh(), after = fresh();
  addPersia(after, null);
  const length = p => p.reduce((s, q, i) => (i ? s + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0), 0);
  for (const open of [false, true]) {
    const off = n => n === 'slider_slide' || (open && n === 'secret_door');
    const A = makeNav(before, { off }), B = makeNav(after, { off }), from = [4, 7, 0];
    for (const it of before.interact) {
      const a = A.path(from, it.at), b = B.path(from, it.at);
      assert.equal(!!b, !!a, it.id);
      if (a) assert.ok(Math.abs(length(b) - length(a)) < 0.3, `${it.id}: ${length(a).toFixed(2)} m before, ${length(b).toFixed(2)} m after`);
    }
  }
});

test('the Simorgh stays on the stair wall: clear of the frames, the chimney, the mezzanine slab and the ceiling', () => {
  const meta = fresh(), S = PLACES.simorgh;
  for (const [name, w] of Object.entries(meta.screens).filter(([k]) => /^proj\d$/.test(k))) {
    const top = w.center[2] + w.h / 2, u0 = w.center[1] - w.w / 2, u1 = w.center[1] + w.w / 2;
    // Over each frame's span, the bird's lowest point there is well above it (the tail comes down only north of 7 m).
    const low = u1 < 6.2 ? 4.95 : 3.85;
    assert.ok(low - top > 0.4 || u0 > S.u[1] || u1 < S.u[0], `${name}`);
  }
  const chimney = meta.colliders.find(c => c.name === 'chimney');
  assert.ok(S.u[1] < chimney.min[1], 'south of the chimney');
  assert.ok(S.u[0] >= 4.5 && S.z[0] > 3.0 + 0.6, 'north of the mezzanine and above its rail');
  assert.ok(S.z[1] < 6.5 - 0.3, 'below the beams');
});

test('the painting hangs in the gap on the mezzanine wall, between the trophy shelf and the wardrobe', () => {
  const meta = fresh(), M = PLACES.miniature, half = M.w / 2 + M.frame;
  const walls = meta.walls.filter(w => w.wall === 's_mezz');
  for (const w of walls) assert.ok(M.center[0] + half <= w.u[0] || M.center[0] - half >= w.u[1], w.name);
  assert.ok(M.center[2] - M.h / 2 - M.frame > 3.4 && M.center[2] + M.h / 2 + M.frame + 0.2 < 6.3);
  assert.ok(Math.abs(M.w / M.h - 3 / 4) < 1e-9, 'the picture is painted at 3 by 4');
});

test('the words: plain, no dashes, the facts the cards must carry', () => {
  const all = Object.values(SAYS).flat();
  for (const s of all) { assert.ok(!/[\u2013\u2014]/.test(s), s); assert.ok(s.length <= 330, `${s.length}: ${s}`); }
  assert.match(SAYS.persia_shelf[0], /539 BCE/);
  assert.match(SAYS.persia_shelf[0], /Babylon/);
  assert.match(SAYS.persia_shelf[0], /British Museum/);
  assert.match(SAYS.persia_shelf[0], /return of deported peoples/);
  assert.match(SAYS.persia_shelf[1], /Apadana/);
  assert.match(SAYS.persia_shelf[1], /two bulls/);
  for (const w of ['sabzeh', 'samanu', 'senjed', 'sir', 'sib', 'somagh', 'serkeh', 'mirror', 'goldfish']) assert.match(SAYS.haftsin[0], new RegExp(w, 'i'), w);
  for (const w of ['longest night', 'pomegranates', 'watermelon', 'Hafez']) assert.match(SAYS.yalda[0], new RegExp(w), w);
  assert.match(SAYS.miniature[0], /original painting/);
  for (const s of [...SPOTS, ...Object.values(FEAST_SPOTS)]) assert.ok(SAYS[s.id], `${s.id} has words`);
});

test('pressing E: the shelf gives its two cards in turn, the others the same line, anything else nothing', () => {
  const say = makeSayer();
  assert.equal(say('persia_shelf'), SAYS.persia_shelf[0]);
  assert.equal(say('persia_shelf'), SAYS.persia_shelf[1]);
  assert.equal(say('persia_shelf'), SAYS.persia_shelf[0]);
  assert.equal(say('simorgh'), SAYS.simorgh[0]);
  assert.equal(say('simorgh'), SAYS.simorgh[0]);
  for (const id of ['tv', 'desk', 'holiday', '__proto__', 'constructor', 'toString', undefined]) assert.equal(say(id), null, String(id));
});

test('the Simorgh feather: a charm anyone can hang, which says where it comes from', () => {
  const f = CHARM.feather;
  assert.equal(CHARMS.at(-1), f);
  assert.ok(isOpen(f, 0) && !f.unlock, 'free');
  assert.match(f.about, /Simorgh/); assert.match(f.about, /Zal/);
  assert.ok(!/[\u2013\u2014]/.test(f.about + f.name));
  assert.equal(readKit({ charm: 'feather' }).charm, 'feather', 'a saved feather comes back');
  assert.ok(CHARMS.filter(c => c.about).every(c => c.id === 'feather'), 'only the feather carries a line of its own');
});
