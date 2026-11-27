import test from 'node:test';
import assert from 'node:assert/strict';
import { KEYS, DESK } from '../../web/src/pure/typing.js';
import { LIT, legendGeometry, plateGeometry, normals } from '../../web/src/pure/kblight.js';

// Seen from the seat, above the board: a triangle wound the other way faces down and the page never draws it.
test('every legend and the glowing plate face up, so they show from above', () => {
  for (const [name, g] of [['legends', legendGeometry()], ['plate', plateGeometry()]]) {
    const n = normals(g);
    assert.equal(n.length, g.index.length / 3);
    n.forEach(([x, y, z], i) => assert.ok(y > 0 && Math.abs(x) < 1e-12 && Math.abs(z) < 1e-12, `${name} triangle ${i} faces ${[x, y, z]}`));
  }
});

test('one legend over every labelled key but Escape, just over its cap, read the right way round from the seat', () => {
  const g = legendGeometry();
  assert.equal(LIT.length, 66);
  assert.equal(g.pos.length / 12, LIT.length);
  LIT.forEach((k, q) => {
    const c = [0, 1, 2, 3].map(i => 4 * q + i), at = i => g.pos.slice(3 * i, 3 * i + 3), uv = i => g.uv.slice(2 * i, 2 * i + 2);
    for (const i of c) {
      const [x, y, z] = at(i);
      assert.ok(Math.abs(Math.abs(x - k.x) - k.d / 2) < 1e-9 && Math.abs(Math.abs(z - k.z) - k.w / 2) < 1e-9, `${k.id} corner off its cap`);
      assert.ok(y > DESK.key.top && y < DESK.key.top + 0.001, `${k.id} height ${y}`);
      assert.equal(g.key[i], k.index);
    }
    // Toward the monitor reads as up the letter, to my right as along it.
    const [a, b, d] = [c[0], c[1], c[2]];
    assert.ok(uv(b)[0] > uv(a)[0] && at(b)[2] > at(a)[2], `${k.id} mirrored across`);
    assert.ok(uv(d)[1] > uv(a)[1] && at(d)[0] > at(a)[0], `${k.id} upside down`);
  });
  assert.ok(!LIT.some(k => k.id === 'Escape') && KEYS.filter(k => k.label).length === LIT.length + 1);
});

test('the plate lies on the case top under every key', () => {
  const g = plateGeometry(), xs = [], zs = [];
  for (let i = 0; i < g.pos.length; i += 3) { xs.push(g.pos[i]); zs.push(g.pos[i + 2]); assert.ok(Math.abs(g.pos[i + 1] - (DESK.case.at[1] + DESK.case.size[1] / 2)) < 0.001); }
  for (const k of KEYS) assert.ok(k.x >= Math.min(...xs) && k.x <= Math.max(...xs) && k.z >= Math.min(...zs) && k.z <= Math.max(...zs), k.id);
});
