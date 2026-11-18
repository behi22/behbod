import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLACES, SPOTS, SAYS, addPersia, makeSayer } from '../../web/src/pure/persia.js';
import { makeInteract } from '../../web/src/pure/interact.js';
import { makeCollision } from '../../web/src/pure/collide.js';

const WORLD = JSON.parse(readFileSync(new URL('../../web/assets/world.json', import.meta.url), 'utf8'));
const fresh = () => JSON.parse(JSON.stringify(WORLD));

test('the pieces join the house through their E spots, copied', () => {
  const meta = fresh(), before = meta.interact.length;
  addPersia(meta);
  assert.equal(meta.interact.length, before + SPOTS.length);
  meta.interact.at(-1).at[0] = 99;
  assert.notEqual(SPOTS.at(-1).at[0], 99);
});

test('each E spot is reached from where you stand, and nothing else of the house\'s is nearer there', () => {
  {
    const meta = fresh();
    addPersia(meta);
    const things = makeInteract(meta.interact), col = makeCollision(meta);
    for (const s of SPOTS) {
      const p = { x: s.at[0], y: s.at[2], z: -s.at[1] };
      assert.equal(things.nearest(p)?.id, s.id, s.id);
      // The spot is open floor: standing there runs into nothing.
      assert.ok(!col.boxes.some(b => !b.off && p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1 && p.y + 0.5 > b.y0 && p.y + 0.5 < b.y1), `${s.id} stands in a collider`);
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

test('the words: plain, no dashes, the facts the cards must carry', () => {
  const all = Object.values(SAYS).flat();
  for (const s of all) { assert.ok(!/[\u2013\u2014]/.test(s), s); assert.ok(s.length <= 330, `${s.length}: ${s}`); }
  for (const s of SPOTS) assert.ok(SAYS[s.id], `${s.id} has words`);
});

test('pressing E: the Simorgh gives its line each time, anything else nothing', () => {
  const say = makeSayer();
  assert.equal(say('simorgh'), SAYS.simorgh[0]);
  assert.equal(say('simorgh'), SAYS.simorgh[0]);
  for (const id of ['tv', 'desk', 'holiday', '__proto__', 'constructor', 'toString', undefined]) assert.equal(say(id), null, String(id));
});

