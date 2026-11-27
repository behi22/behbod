import test from 'node:test';
import assert from 'node:assert/strict';
import { KEYS, KEY, U, keyFor, keysForText, fingerFor, HOME, reachable, spotOn, strokeAt, advance, STROKE, TRAVEL } from '../../web/src/pure/typing.js';
import { KEYS as TABLE, DESK_POSES } from '../../web/src/pure/realposes.js';
import { deepest, worldFor, bi, FINGERS } from '../../web/src/pure/realhand.js';
import { typingHand, deskShape, landing, onKey, capShape } from '../../web/src/pure/realholds.js';

test('the board: a 65% gaming keyboard, 68 keys in five staggered rows 16 keys wide, none overlapping', () => {
  assert.equal(KEYS.length, 68);
  assert.deepEqual([0, 1, 2, 3, 4].map(r => KEYS.filter(k => k.row === r).length), [10, 14, 14, 15, 15]);
  for (const r of [0, 1, 2, 3, 4]) {
    const row = KEYS.filter(k => k.row === r);
    assert.ok(Math.abs(row[0].z - row[0].w / 2 + 8 * U) < 0.001 && Math.abs(row.at(-1).z + row.at(-1).w / 2 - 8 * U) < 0.001, `row ${r} edge to edge`);
    for (let i = 1; i < row.length; i++) assert.ok(row[i].z - row[i].w / 2 > row[i - 1].z + row[i - 1].w / 2, `row ${r} key ${i}`);
  }
  // The home row's letters in their usual stagger: A a quarter key right of Q, Z half a key right of A.
  assert.ok(Math.abs(KEY.KeyA.z - KEY.KeyQ.z - 0.25 * U) < 1e-9 && Math.abs(KEY.KeyZ.z - KEY.KeyA.z - 0.5 * U) < 1e-9);
  assert.ok(KEY.ArrowUp.z === KEY.ArrowDown.z && KEY.ArrowUp.row === KEY.ArrowDown.row + 1);
  assert.equal(KEY.Space.w, 6.25 * U - 0.00155);
});

test('keys: by code, by what was typed when a phone names no key, shifted characters on their own keys; others ignored', () => {
  assert.equal(keyFor('KeyA', 'a'), KEY.KeyA);
  assert.equal(keyFor('Digit1', '!'), KEY.Digit1);
  assert.equal(keyFor('Space', ' '), KEY.Space);
  assert.equal(keyFor('Enter', 'Enter'), KEY.Enter);
  assert.equal(keyFor('ArrowUp', 'ArrowUp'), KEY.ArrowUp);
  assert.equal(keyFor('Backquote', '`'), KEY.Escape);
  assert.equal(keyFor('', 'Unidentified'), null);
  assert.equal(keyFor('', 'Q'), KEY.KeyQ);
  assert.equal(keyFor('', '?'), KEY.Slash);
  assert.equal(keyFor('', 'Backspace'), KEY.Backspace);
  assert.equal(keyFor('F5', 'F5'), null);
  assert.equal(keyFor('Numpad1', '1'), KEY.Digit1);
});

test('a phone\'s typing read from the box: the characters added, or a Backspace for each one taken away', () => {
  assert.deepEqual(keysForText('hel', 'hello').map(k => k.id), ['KeyL', 'KeyO']);
  assert.deepEqual(keysForText('hello', 'hel').map(k => k.id), ['Backspace', 'Backspace']);
  assert.deepEqual(keysForText('teh', 'the ').map(k => k.id), ['Backspace', 'Backspace', 'KeyH', 'KeyE', 'Space']);
  assert.deepEqual(keysForText('', 'Hi!').map(k => k.id), ['KeyH', 'KeyI', 'Digit1']);
  assert.equal(keysForText('a', 'a').length, 0);
  // A whole pasted paragraph is a few strokes, not hundreds.
  assert.ok(keysForText('', 'x'.repeat(500)).length <= 8);
});

test('fingers: touch typing, each hand its half, the thumbs the space bar and Alt keys, every key someone\'s', () => {
  assert.deepEqual(fingerFor(KEY.KeyA), { side: 'left', digit: 'pinky' });
  assert.deepEqual(fingerFor(KEY.KeyG), { side: 'left', digit: 'index' });
  assert.deepEqual(fingerFor(KEY.KeyJ), { side: 'right', digit: 'index' });
  assert.deepEqual(fingerFor(KEY.Space), { side: 'right', digit: 'thumb' });
  assert.deepEqual(fingerFor(KEY.Backspace), { side: 'right', digit: 'pinky' });
  const all = new Set();
  for (const side of ['left', 'right']) for (const d of ['index', 'middle', 'ring', 'pinky', 'thumb']) {
    // Both thumbs rest on the space bar, which the right one types.
    assert.ok(reachable(side, d).includes(KEY[HOME[side][d]]) || (side === 'left' && d === 'thumb'), `${side} ${d} home`);
    for (const k of reachable(side, d)) { assert.ok(!all.has(k.id)); all.add(k.id); }
  }
  assert.equal(all.size, KEYS.length);
  // A finger lands on the end of a wide key nearest it, each thumb on its own part of the space bar.
  const [, l] = spotOn(KEY.Space, 'left', 'thumb'), [, r] = spotOn(KEY.Space, 'right', 'thumb');
  assert.ok(l < r && Math.abs(l - r) > U);
});

test('a stroke: over to the key, down to the bottom, a moment held, back up and home, in about a fifth of a second', () => {
  const away = [], at = t => strokeAt(t, true);
  for (let t = 0; t <= at(0).length + 0.01; t += 0.005) away.push(at(t));
  assert.ok(Math.max(...away.map(s => s.press)) === 1 && away[0].press === 0 && away.at(-1).press === 0 && away.at(-1).done);
  for (const s of away) if (s.press > 0) assert.ok(s.over > 0.999);
  assert.ok(away.at(-1).over < 1e-6 && Math.max(...away.map(s => s.lift)) > 0.9);
  const len = at(0).length;
  assert.ok(len > 0.25 && len < 0.4, String(len));
  const home = strokeAt(0, false);
  assert.ok(home.length < len && strokeAt(STROKE.down + 0.01, false).press === 1 && strokeAt(0.03, false).over === 0);
});

test('a slow frame never steps over the key held at the bottom: it shows all the way down at least once', () => {
  for (const away of [true, false]) for (const dt of [1 / 60, 1 / 20, 1 / 8, 0.3]) {
    let t = 0, most = 0;
    while (!strokeAt(t, away).done) { t = advance(t, dt, away); most = Math.max(most, strokeAt(t, away).press); }
    assert.equal(most, 1, `${away} ${dt}`);
  }
  assert.equal(advance(0.01, 1 / 60, false), 0.01 + 1 / 60);
});

// The hand a key's table entry puts there: the wrist shifted, the digit's angles, the rest of the hand at home.
const posed = (side, d, K, a) => { const b = typingHand(side); return { ...b, at: b.at.map((v, i) => v + K.shift[i]), digits: { ...DESK_POSES.home[side].digits, [d]: a } }; };
test('the per-key table: every finger lands on every key it types, its tip on the cap pressed to the bottom, within a few mm', () => {
  const worst = { off: 0, gap: 0 };
  for (const side of ['left', 'right']) for (const d of ['index', 'middle', 'ring', 'pinky', 'thumb']) for (const k of reachable(side, d)) {
    const K = TABLE[side][d][k.id];
    assert.ok(K && K.top.length === K.press.length && K.lift.length === K.top.length, `${side} ${d} ${k.id}`);
    // Resting on it: the tip on the cap's top, two and a half millimetres at most over it.
    const top = landing(side, d, k, posed(side, d, K, K.top), 0);
    assert.ok(top.inside && top.off < 0.003 && top.gap > -0.0006 && top.gap < 0.0025, `${side} ${d} ${k.id} rests: ${JSON.stringify(top)}`);
    // Pressed to the bottom: the tip on the cap, rolled back along it at most 8 mm, at most 2.5 mm over it gone down,
    // never through it.
    const down = landing(side, d, k, posed(side, d, K, K.press));
    assert.ok(down.inside && down.off < 0.008 && down.gap > -0.0006 && down.gap < 0.0025, `${side} ${d} ${k.id} pressed: ${JSON.stringify(down)}`);
    assert.ok(deepest(side, posed(side, d, K, K.press), capShape(k, TRAVEL), [d]) > -0.0006, `${side} ${d} ${k.id} not through its key`);
    // Lifted on the way, clear of the keys.
    const up = deepest(side, posed(side, d, K, K.lift), deskShape, [d]);
    assert.ok(up > 0, `${side} ${d} ${k.id} lifted: ${up}`);
    worst.off = Math.max(worst.off, down.off); worst.gap = Math.max(worst.gap, down.gap);
  }
  assert.ok(worst.off < 0.008 && worst.gap < 0.0025, JSON.stringify(worst));
});

test('the keys the old hands missed now land: P, Q, 1, Backspace and J', () => {
  for (const id of ['KeyP', 'KeyQ', 'Digit1', 'Backspace', 'KeyJ']) {
    const k = KEY[id], { side, digit } = fingerFor(k), K = onKey(side, digit, k, DESK_POSES.home[side].digits[digit]);
    const r = landing(side, digit, k, posed(side, digit, K, K.press));
    assert.ok(r.inside && r.off < 0.008 && r.gap < 0.0025, `${id} ${JSON.stringify(r)}`);
  }
});

// The back of the hand's rise from the wrist to the middle finger's knuckle (radians, up is more than none).
const pitchOf = (side, P) => { const F = worldFor(side, P), w = F[bi('hand')].p, m = F[bi('middle1')].p; return Math.atan2(m[1] - w[1], Math.hypot(m[0] - w[0], m[2] - w[2])); };
test('typing hands as a typist holds them: the back level, the knuckles high, the fingers curving down, none bent back at any moment', () => {
  for (const side of ['left', 'right']) {
    const home = DESK_POSES.home[side], F = worldFor(side, home), rest = pitchOf(side, home);
    // The back of the hand level, its knuckles a little higher than the wrist; every knuckle over its middle joint.
    assert.ok(rest > 0.05 && rest < 0.3 && F[bi('middle1')].p[1] > F[bi('hand')].p[1], `${side} back of the hand rises ${rest}`);
    for (const d of FINGERS) assert.ok(F[bi(d + '1')].p[1] > F[bi(d + '2')].p[1] + 0.003, `${side} ${d} knuckle over its middle joint`);
    for (const d of [...FINGERS, 'thumb']) for (const k of reachable(side, d)) {
      const K = TABLE[side][d][k.id];
      // A stroke is a blend of resting at home, on the key, pressed and lifted: in every one each joint is bent forward,
      // so it is at every moment between them.
      for (const a of [home.digits[d], K.top, K.press, K.lift]) {
        if (d === 'thumb') assert.ok(a[2] > -0.06, `${side} thumb ${k.id} knuckle ${a}`);
        else assert.ok(a[1] > 0.25 && a[2] > 0.05, `${side} ${d} ${k.id} knuckle and middle joint bent: ${a}`);
      }
      // The press is the finger bending a little more, the hand holding still: its back tips no more than resting.
      if (d !== 'thumb') assert.ok(K.press[1] + K.press[2] >= K.top[1] + K.top[2] - 0.05 && K.press.every((v, i) => Math.abs(v - K.top[i]) < 0.45), `${side} ${d} ${k.id} press ${K.top} -> ${K.press}`);
      assert.equal(K.shift[1], 0);
      assert.ok(Math.abs(pitchOf(side, posed(side, d, K, K.press)) - rest) < 1e-4);
    }
  }
});
