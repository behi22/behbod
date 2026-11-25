import test from 'node:test';
import assert from 'node:assert/strict';
import { keyFor, fingerFor, HOME, reachable, strokeAt, STROKE, TRAVEL } from '../../web/src/pure/typing.js';
import { KEYS } from '../../web/src/pure/realposes.js';
import { deepest } from '../../web/src/pure/realhand.js';
import { typingHand, deskShape, keyTop } from '../../web/src/pure/realholds.js';

test('keys: letters, digits and the named keys land where a keyboard has them; others are ignored', () => {
  assert.deepEqual(keyFor('KeyA', 'a'), [2, 13]);
  assert.deepEqual(keyFor('KeyJ', 'J'), [2, 7]);
  assert.deepEqual(keyFor('KeyP', 'p'), [3, 4]);
  assert.deepEqual(keyFor('Digit1', '!'), [4, 13]);
  assert.deepEqual(keyFor('Space', ' '), [0, 7]);
  assert.deepEqual(keyFor('Enter', 'Enter'), [2, 2]);
  assert.deepEqual(keyFor('ArrowUp', 'ArrowUp'), [3, 12]);
  assert.equal(keyFor('F5', 'F5'), null);
  assert.equal(keyFor('MetaLeft', 'Meta'), null);
});

test('fingers: touch typing, each hand its half, the thumbs the bottom row, every key someone\'s', () => {
  assert.deepEqual(fingerFor([2, 13]), { side: 'left', digit: 'pinky' });
  assert.deepEqual(fingerFor([3, 9]), { side: 'left', digit: 'index' });
  assert.deepEqual(fingerFor([2, 7]), { side: 'right', digit: 'index' });
  assert.deepEqual(fingerFor([0, 7]), { side: 'right', digit: 'thumb' });
  const all = new Set();
  for (const side of ['left', 'right']) for (const d of ['index', 'middle', 'ring', 'pinky', 'thumb']) {
    assert.ok(reachable(side, d).some(k => k[0] === HOME[side][d][0] && k[1] === HOME[side][d][1]), `${side} ${d} home`);
    for (const k of reachable(side, d)) { assert.ok(!all.has(k.join())); all.add(k.join()); }
  }
  assert.equal(all.size, 75);
});

test('a stroke: over to the key, down to the bottom, a moment held, back up and home, in about a fifth of a second', () => {
  const away = [], at = t => strokeAt(t, true);
  for (let t = 0; t <= at(0).length + 0.01; t += 0.005) away.push(at(t));
  assert.ok(Math.max(...away.map(s => s.press)) === 1 && away[0].press === 0 && away.at(-1).press === 0 && away.at(-1).done);
  // It only presses once it is over the key, and is home again by the end.
  for (const s of away) if (s.press > 0) assert.ok(s.over > 0.999);
  assert.ok(away.at(-1).over < 1e-6 && Math.max(...away.map(s => s.lift)) > 0.9);
  const len = at(0).length;
  assert.ok(len > 0.25 && len < 0.4, String(len));
  const home = strokeAt(0, false);
  assert.ok(home.length < len && strokeAt(STROKE.down + 0.01, false).press === 1 && strokeAt(0.03, false).over === 0);
});

test('the per-key table: every finger has every key it types, resting on it and pressing it down, never into the desk', () => {
  for (const side of ['left', 'right']) for (const d of ['index', 'middle', 'ring', 'pinky', 'thumb']) {
    for (const k of reachable(side, d)) {
      const K = KEYS[side][d][k.join()];
      // The space row's corners are no finger's business but Ctrl's (column 14): the table has them, nothing types them.
      if (d !== 'thumb' && k[0] === 0 && k[1] !== 14) { assert.ok(K); continue; }
      assert.ok(K && K.top.length >= 4 && K.press.length === K.top.length, `${side} ${d} ${k}`);
      const P = { ...typingHand(side), at: typingHand(side).at.map((v, i) => v + K.shift[i]), digits: { [d]: K.top, index: K.top, middle: K.top, ring: K.top, pinky: K.top, thumb: d === 'thumb' ? K.top : [0, 0, 0, 0, 0] } };
      P.digits = { ...P.digits, [d]: K.top };
      // Resting: the digit goes no deeper than skin into the keys, the desk or the case.
      // The far rows (numbers, and the space row for the fingers) are a stretch: a little deeper there.
      assert.ok(deepest(side, P, deskShape, [d]) > (k[0] === 0 || k[0] === 4 ? -0.0036 : -0.0016), `${side} ${d} ${k} rests on it`);
      // Pressing: its tip goes down by about the key's travel.
      const low = Q => deepest(side, Q, q => q[1], [d]), down = low({ ...P, digits: { ...P.digits, [d]: K.press } }), up = low(P);
      assert.ok(Math.abs(up - down - TRAVEL) < 0.0005, `${side} ${d} ${k} presses: ${up - down}`);
    }
  }
  assert.ok(keyTop(2, 7)[1] > 0.03);
});
