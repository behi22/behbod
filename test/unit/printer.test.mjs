import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePrint, cleanPrint, cleanText, describe, DEFAULT, SHOWN, SWATCHES, COLOURS, MAX_TEXT, sidesOf, printColour } from '../../web/src/pure/printer.js';
import { MODELS, MODEL, petalRing } from '../../web/src/pure/models.js';
import { buildPrint, slice, REACH, TALLEST, PATH } from '../../web/src/pure/printbuild.js';
import { meshSdf, finish } from '../../web/src/pure/mesher.js';
import { letterField, keychain } from '../../web/src/pure/keychain.js';
import { sphere } from '../../web/src/pure/sdf.js';

const build = (p, points = 30000, field = null) => finish(buildPrint(cleanPrint(p), { points, field }));
// Two blocks of "letters", white on clear, as the page's canvas would give them.
function blocks(w = 160, h = 60) {
  const data = new Uint8Array(w * h);
  for (let y = 10; y < 50; y++) for (let x = 10; x < 150; x++) if (x < 60 || x > 90) data[y * w + x] = 255;
  return { w, h, data };
}

test('a model word starts that model in its own colour, and a colour word changes it', () => {
  const r = parsePrint('make me a rocket');
  assert.equal(r.p.model, 'rocket');
  assert.equal(r.p.colour, MODEL.rocket.colour);
  assert.equal(r.said, 'Printing a red rocket.');
  assert.equal(parsePrint('a teal rubber duck please').said, 'Printing a teal rubber duck.');
  assert.equal(parsePrint('bh-22').p.model, 'bh22');
  assert.equal(parsePrint('BH 22').p.model, 'bh22');
  assert.equal(parsePrint('a t-rex').p.model, 'dino');
  assert.equal(parsePrint('my cat').p.model, 'pishi');
  assert.equal(parsePrint('rocket ship and a duck').p.model, 'rocket');
});

test('every model answers to its own words, and the screen shows about 25 of them', () => {
  for (const m of MODELS) for (const w of m.words) assert.equal(parsePrint(w).p.model, m.id, w);
  assert.ok(SHOWN.length >= 25, `${SHOWN.length} shown`);
  for (const id of SHOWN) assert.ok(MODEL[id]);
  for (const m of MODELS) assert.ok(Object.hasOwn(COLOURS, m.colour), m.id);
  for (const c of SWATCHES) assert.ok(Object.hasOwn(COLOURS, c), c);
});

test('words adjust the print that is there', () => {
  const start = parsePrint('rocket').p;
  const r = parsePrint('taller and red', start);
  assert.ok(r.p.height > start.height);
  assert.equal(r.p.colour, 'red');
  assert.equal(r.p.model, 'rocket');
  assert.equal(r.said, 'Reprinting the rocket, taller in red.');
  assert.equal(parsePrint('more twist', start).p.twist, start.twist + 0.5);
  assert.equal(parsePrint('more fins', start).p.sides, 5);
  assert.equal(parsePrint('more fins', start).said, 'Reprinting the rocket with 5 fins.');
  assert.equal(parsePrint('fewer fins', start).p.sides, 3);
  assert.equal(parsePrint('6', start).p.sides, 6);
  assert.equal(parsePrint('a 7 point star').p.sides, 7);
  assert.equal(parsePrint('again', start).p.height, start.height);
  assert.equal(parsePrint('bigger', start).p.size, start.size * 1.15);
  // Spikier on a model with nothing of its own to sharpen grows spikes; more points then means more of them.
  const spiky = parsePrint('spikier', parsePrint('pishi').p).p;
  assert.ok(spiky.depth > 0);
  assert.equal(parsePrint('more points', spiky).p.sides, spiky.sides + 1);
  assert.ok(parsePrint('more points', parsePrint('duck').p).p.depth > 0);
});

test('any other word prints on a keychain, the words kept as typed', () => {
  const r = parsePrint('hello world');
  assert.equal(r.p.model, 'word');
  assert.equal(r.p.text, 'hello world');
  assert.match(r.said, /^Printing an? \w+ keychain that says hello world\.$/);
  assert.equal(parsePrint('"hello world"').p.text, 'hello world');
  assert.equal(parsePrint('("hello world")').p.text, 'hello world');
  // Quotes keep even a model's name as words.
  assert.equal(parsePrint('"rocket"').p.model, 'word');
  const s = parsePrint('print me Sam taller blue');
  assert.deepEqual([s.p.model, s.p.text, s.p.colour, s.p.height], ['word', 'Sam', 'blue', 1.25]);
  assert.equal(parsePrint('سلام دنیا').p.text, 'سلام دنیا');
  assert.equal(parsePrint('東京').p.text, '東京');
  assert.equal(parsePrint('2026').p.text, '2026');
  assert.equal(parsePrint('<3').p.text, '<3');
  assert.equal(parsePrint('!!!').p.text, '!!!');
  assert.equal(Array.from(parsePrint('x'.repeat(80)).p.text).length, MAX_TEXT);
  // The same word gets the same colour every time.
  assert.equal(parsePrint('Behbod').p.colour, parsePrint('Behbod').p.colour);
  // Punctuation next to a word is not a keychain of its own.
  assert.equal(parsePrint('taller!', parsePrint('rocket').p).p.model, 'rocket');
});

test('nothing to act on gives nothing', () => {
  for (const t of ['', '   ', 'the a please', null, undefined, '""', '"   "', '\u200b']) assert.equal(parsePrint(t), null, JSON.stringify(t));
});

test('twisty twists the print on the bed, as it did before the models', () => {
  const r = parsePrint('make it twisty', parsePrint('rocket').p);
  assert.deepEqual([r.p.model, r.p.twist], ['rocket', 0.5]);
  assert.equal(parsePrint('rocket twisty').p.twist, 0.5);
});

test('a Persian half-space and an emoji joiner stay in the words; other hidden marks go', () => {
  const half = 'می\u200cخواهم', family = '👨\u200d👩\u200d👧';
  assert.equal(cleanText(half), half);
  assert.equal(parsePrint(half).p.text, half);
  assert.equal(parsePrint(`"${half}"`).p.text, half);
  assert.equal(cleanText(family), family);
  assert.equal(cleanText('\u200cab\u200d'), 'ab');
  assert.equal(cleanText('a\u202eb\u200b'), 'ab');
  for (const t of ['\u200c', ' \u200d ', '"\u200c"']) assert.equal(parsePrint(t), null, JSON.stringify(t));
});

test('everything stays inside what the printer can make, and old saves come back', () => {
  let p = parsePrint('rocket').p;
  for (let i = 0; i < 30; i++) p = parsePrint('taller wider bigger twist spikier more fins curvy', p).p;
  assert.ok(p.height <= 2.2 && p.width <= 2 && p.size <= 1.5 && p.twist <= 2 && p.depth <= 0.6 && p.sides <= sidesOf('rocket')[1] && p.bulge <= 0.8);
  for (let i = 0; i < 30; i++) p = parsePrint('shorter thinner smaller rounder fewer fins', p).p;
  assert.ok(p.height >= 0.4 && p.width >= 0.5 && p.size >= 0.5 && p.depth >= 0 && p.sides >= sidesOf('rocket')[0]);
  assert.deepEqual(cleanPrint('junk'), DEFAULT);
  assert.deepEqual(cleanPrint({ model: 'nope', colour: 'mauve', size: NaN }), DEFAULT);
  assert.equal(cleanPrint({ model: 'rocket', sides: 99 }).sides, sidesOf('rocket')[1]);
  assert.equal(cleanPrint({ model: 'word', text: '' }).model, DEFAULT.model);
  // A print saved before the models: its shape's nearest model, or its word on a keychain, its colour kept.
  const old = cleanPrint({ edge: 'star', name: 'star', colour: 'teal', height: 0.35 });
  assert.deepEqual([old.model, old.colour, old.height], ['star', 'teal', 1]);
  assert.equal(cleanPrint({ edge: 'round', name: 'tower' }).model, 'rook');
  assert.equal(cleanPrint({ edge: 'round', name: 'dragon' }).model, 'dino');
  const w = cleanPrint({ edge: 'petal', name: 'behbod', colour: 'pink' });
  assert.deepEqual([w.model, w.text, w.colour], ['word', 'behbod', 'pink']);
  assert.equal(cleanText('  a \n b\tc  '), 'a b c');
  assert.equal(describe(cleanPrint({ model: 'duck', colour: 'gray' })), 'a grey rubber duck');
});

test('the mesher closes a sphere where it should be, facing out', () => {
  const m = finish(meshSdf(sphere(5, [0, 6, 0]), [-6, 0, -6, 6, 12, 6], { points: 30000, lip: 1 }));
  for (let i = 0; i < m.pos.length; i += 3) {
    const x = m.pos[i], y = m.pos[i + 1] - 6, z = m.pos[i + 2], r = Math.hypot(x, y, z);
    assert.ok(Math.abs(r - 5) < m.h * 0.3, `point at ${r}`);
    assert.ok((x * m.normal[i] + y * m.normal[i + 1] + z * m.normal[i + 2]) / r > 0.95);
  }
  const edges = new Map(), I = m.index;
  for (let k = 0; k < I.length; k += 3) for (let e = 0; e < 3; e++) { const a = I[k + e], b = I[k + (e + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`; edges.set(key, (edges.get(key) || 0) + 1); }
  assert.ok([...edges.values()].every(v => v === 2), 'every edge between two triangles');
  // Wound to face out: the first triangle's normal points away from the middle.
  const [a, b, c] = [I[0], I[1], I[2]].map(i => [m.pos[i * 3], m.pos[i * 3 + 1] - 6, m.pos[i * 3 + 2]]);
  const u = b.map((v, i) => v - a[i]), v = c.map((w, i) => w - a[i]), n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  assert.ok(n[0] * a[0] + n[1] * a[1] + n[2] * a[2] > 0);
});

test('every model is whole, inside its bounds, and fits on the bed standing up', () => {
  for (const m of MODELS) {
    const s = m.make({ sides: m.sides ? m.sides[2] : 8, depth: 0 }), [x0, y0, z0, x1, y1, z1] = s.bounds;
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
      const u = i / 8, v = j / 8;
      for (const pt of [[x0, y0 + (y1 - y0) * u, z0 + (z1 - z0) * v], [x1, y0 + (y1 - y0) * u, z0 + (z1 - z0) * v], [x0 + (x1 - x0) * u, y1, z0 + (z1 - z0) * v], [x0 + (x1 - x0) * u, y0 + (y1 - y0) * v, z0], [x0 + (x1 - x0) * u, y0 + (y1 - y0) * v, z1]]) {
        assert.ok(s.f(...pt) >= 0, `${m.id} reaches past its bounds at ${pt}`);
      }
    }
    const b = build({ model: m.id });
    let lo = Infinity;
    for (let i = 1; i < b.pos.length; i += 3) lo = Math.min(lo, b.pos[i]);
    assert.ok(Math.abs(lo) < 0.002, `${m.id} stands on the bed (${lo})`);
    assert.ok(b.height > 0.06 && b.height <= TALLEST / 100 + 1e-6 && b.radius <= REACH / 100 + 1e-6, `${m.id} ${b.height} ${b.radius}`);
    assert.ok(b.index.length > 3000 && Math.max(...b.index) < b.pos.length / 3, m.id);
    // The shading under the print's colour (base x s + sheen x s x s) stays between near black and a little over white.
    const { base, sheen } = printColour(cleanPrint({ model: m.id }).colour);
    for (let i = 0; i < b.colour.length; i += 3) {
      const v = b.colour[i], s = sheen ? (Math.sqrt(base[0] ** 2 + 4 * sheen * v) - base[0]) / (2 * sheen) : v / base[0];
      assert.ok(s > 0.02 && s < 1.3, `${m.id} ${s}`);
    }
    assert.equal(b.path.length, b.layers * PATH * 2);
  }
});

test('models seen side on have a leg, an arm and a wing on each side, not two on one', () => {
  for (const id of ['dino', 'duck', 'knight', 'car', 'teapot']) {
    const { f, bounds: [x0, y0, z0, x1, y1, z1] } = MODEL[id].make({ sides: 8, depth: 0 }), N = 20;
    let odd = null;
    for (let i = 0; i <= N && !odd; i++) for (let j = 0; j <= N && !odd; j++) for (let k = 0; k <= N && !odd; k++) {
      const x = x0 + ((x1 - x0) * i) / N, y = y0 + ((y1 - y0) * j) / N, z = z0 + ((z1 - z0) * k) / N;
      if ((f(x, y, z) < 0) !== (f(x, y, -z) < 0)) odd = [x, y, z].map(v => +v.toFixed(2));
    }
    assert.equal(odd, null, `${id} is solid on one side only at ${odd}`);
  }
});

test("the dinosaur's spikes stand up along its back, not inside it", () => {
  const { f } = MODEL.dino.make({ sides: 8, depth: 0 }), step = 0.05;
  const top = x => { for (let y = 13; y > 0; y -= 0.02) if (f(x, y, 0) < 0) return y; return 0; };
  const tops = [];
  for (let x = -5.6; x <= 2.2; x += step) tops.push(top(x));
  let peaks = 0;
  for (let i = 6; i < tops.length - 6; i++) {
    const near = tops.slice(i - 6, i + 7);
    if (tops[i] === Math.max(...near) && tops[i] - Math.min(tops[i - 6], tops[i + 6]) > 0.25) peaks++;
  }
  assert.ok(peaks >= 5, `${peaks} spikes stand out of the back`);
});

test("the flower's leaves stand apart from its head, with bare stem between", () => {
  const { f } = MODEL.flower.make({ sides: 7, depth: 0 });
  const width = y => { let w = 0; for (let x = -5.2; x <= 5.2; x += 0.1) for (let z = -1.5; z <= 2.5; z += 0.2) if (f(x, y, z) < 0) w = Math.max(w, Math.abs(x)); return w; };
  // Up from the pot: bare stem, the leaves, bare stem again, then the head.
  let runs = 0, wide = false;
  for (let y = 4.6; y <= 15; y += 0.1) { const now = width(y) > 0.8; if (now && !wide) runs++; wide = now; }
  assert.equal(runs, 2);
});

test('the settings change the shape: taller, wider, twisted, spikier, bigger only as far as the bed allows', () => {
  const base = build({ model: 'duck' });
  assert.ok(build({ model: 'duck', height: 1.25 }).height > base.height * 1.2);
  assert.ok(build({ model: 'duck', width: 1.25 }).radius > base.radius * 1.2);
  const twisted = build({ model: 'duck', twist: 1 });
  assert.equal(twisted.pos.length, base.pos.length);
  assert.ok(Math.abs(twisted.height - base.height) < 1e-6);
  assert.ok(twisted.pos.some((v, i) => Math.abs(v - base.pos[i]) > 1e-3));
  const sharp = build({ model: 'duck', depth: 0.45 }), plain = build({ model: 'duck' });
  assert.ok(sharp.height > plain.height * 1.05 && sharp.radius > plain.radius * 1.05, 'spikes stand out');
  const huge = build({ model: 'car', size: 1.5, width: 2, height: 2.2 });
  assert.ok(huge.radius <= REACH / 100 + 1e-6 && huge.height <= TALLEST / 100 + 1e-6);
  assert.notEqual(build({ model: 'star', sides: 5 }).index.length, build({ model: 'star', sides: 8 }).index.length);
});

test('each layer the nozzle traces lies on the print at that height', () => {
  const b = build({ model: 'trophy' });
  for (let l = 0; l < b.layers; l++) {
    for (let k = 0; k < PATH; k++) {
      const x = b.path[(l * PATH + k) * 2], z = b.path[(l * PATH + k) * 2 + 1];
      assert.ok(Math.hypot(x, z) <= b.radius + 1e-6, `layer ${l} point ${k}`);
    }
  }
  const top = Math.floor(b.layers * 0.9), xs = Array.from({ length: PATH }, (_, k) => b.path[(top * PATH + k) * 2]);
  assert.ok(Math.max(...xs) - Math.min(...xs) > b.radius * 0.8, 'a top layer spans the cup');
  assert.equal(finish(slice(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), new Uint32Array([0, 1, 2]), 2, 1)).length, 2 * PATH * 2);
});

test("a keychain from the page's letters: raised letters joined on a bar with a ring", () => {
  const field = finish(letterField(blocks()));
  assert.deepEqual(field.box, [10, 10, 150, 50]);
  assert.ok(field.sd[30 * 160 + 30] < -10 && field.sd[30 * 160 + 75] > 10);
  const k = keychain(field);
  assert.ok(k.f(-1.5, 1.6, 0.6) < 0, 'a letter is solid');
  assert.ok(k.f(0, 0.5, 0) < 0, 'the bar joins them');
  assert.ok(k.f(0, 1.6, 0.6) > 0, 'the gap between them is open in front');
  assert.equal(finish(letterField({ w: 4, h: 4, data: new Uint8Array(16) })), null);
  const blank = finish(buildPrint(cleanPrint({ model: 'word', text: 'x' }), { points: 20000, field: null }));
  assert.ok(blank.index.length > 300, 'letters that drew nothing still give a tag');
  const word = build({ model: 'word', text: 'ab' }, 30000, field);
  assert.ok(word.radius <= REACH / 100 + 1e-6 && word.height > 0.03);
  assert.ok(build({ model: 'word', text: 'ab', depth: 0.3 }, 30000, finish(letterField(blocks()))).height > word.height * 1.05, 'a spiky keychain');
});

// Run to the end with the clock always up, so it stops at every place it looks at the clock.
function everyStop(gen, count = () => 0) {
  let stops = 0, most = 0;
  for (;;) { const r = gen.next(); most = Math.max(most, count()); if (r.done) return { stops, most, value: r.value }; stops++; }
}
const same = (a, b) => assert.ok(Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(Buffer.from(b.buffer, b.byteOffset, b.byteLength)));

test('a build on the page without a worker looks at the clock between any two samples of the shape, and makes the same model', () => {
  let calls = 0;
  const ball = (x, y, z) => { calls++; return Math.hypot(x, y - 6, z) - 5; };
  const run = everyStop(meshSdf(ball, [-6, 0, -6, 6, 12, 6], { points: 30000, lip: 1, due: () => true }), () => { const c = calls; calls = 0; return c; });
  // One sample at a time while sampling; a surface point's slope and shading take seven.
  assert.ok(run.most <= 7, `${run.most} samples between two looks at the clock`);
  const plain = finish(meshSdf(ball, [-6, 0, -6, 6, 12, 6], { points: 30000, lip: 1 }));
  same(run.value.pos, plain.pos); same(run.value.index, plain.index); same(run.value.open, plain.open);
  for (const p of [{ model: 'star' }, { model: 'pishi', depth: 0.3 }, { model: 'word', text: 'ab' }]) {
    const q = cleanPrint(p), field = p.model === 'word' ? finish(letterField(blocks())) : null;
    const a = finish(buildPrint(q, { points: 30000, field })), b = everyStop(buildPrint(q, { points: 30000, field, due: () => true }));
    assert.ok(b.stops > 2000, `${p.model}: ${b.stops} stops`);
    for (const k of ['pos', 'colour', 'uv', 'index', 'path']) same(a[k], b.value[k]);
    assert.deepEqual(a.sphere, b.value.sphere);
  }
  // Working out the letters' distances stops at least once for every column and every row of their picture.
  const f = everyStop(letterField(blocks(), () => true));
  assert.ok(f.stops >= 160 + 60, `${f.stops} stops`);
  assert.deepEqual(f.value.box, finish(letterField(blocks())).box);
  same(f.value.sd, finish(letterField(blocks())).sd);
});

test('the page only hands on what the build made: its colours and bounding sphere are worked out with it', () => {
  const q = cleanPrint({ model: 'duck' }), { colour: name, ...plain } = q, { base, sheen } = printColour(name);
  const b = finish(buildPrint(q, { points: 30000 })), u = finish(buildPrint(plain, { points: 30000 })).colour, n = b.pos.length / 3;
  assert.equal(b.colour.length, n * 3);
  for (let i = 0; i < n; i++) {
    assert.equal(u[i * 3 + 1], Math.fround(u[i * 3] * 0.99));
    assert.equal(u[i * 3 + 2], Math.fround(u[i * 3] * 0.97));
    for (let k = 0; k < 3; k++) assert.equal(b.colour[i * 3 + k], Math.fround(base[k] * u[i * 3 + k] + sheen * u[i * 3 + k] ** 2));
  }
  // As three works it out: the middle of the box round every point, out to the farthest point.
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], b.pos[i * 3 + k]); hi[k] = Math.max(hi[k], b.pos[i * 3 + k]); }
  const c = lo.map((v, k) => (v + hi[k]) * 0.5);
  let r2 = 0;
  for (let i = 0; i < n; i++) r2 = Math.max(r2, (c[0] - b.pos[i * 3]) ** 2 + (c[1] - b.pos[i * 3 + 1]) ** 2 + (c[2] - b.pos[i * 3 + 2]) ** 2);
  assert.deepEqual(b.sphere, [...c, Math.sqrt(r2)]);
});

test('the mini BH-22 prints black, like the robot in the house', () => {
  assert.equal(MODEL.bh22.colour, 'black');
  assert.equal(parsePrint('bh22').said, 'Printing a black mini BH-22.');
  assert.equal(cleanPrint({ model: 'bh22' }).colour, 'black');
});

test('a flower always has five petals or more, so none of them makes a cross with one down the stem', () => {
  let p = parsePrint('flower').p;
  for (let i = 0; i < 10; i++) p = parsePrint('fewer petals', p).p;
  assert.equal(p.sides, 5);
  assert.equal(cleanPrint({ model: 'flower', sides: 4 }).sides, 5);
  assert.equal(cleanPrint({ model: 'flower', sides: 3 }).sides, 5);
  assert.ok(parsePrint('a 4 petal flower').p.sides >= 5);
  assert.ok(parsePrint('3 petals', parsePrint('flower').p).p.sides >= 5);
});

test("the duck's eyes are round dimples with soft rims, not holes with knife-thin edges", () => {
  const { f } = MODEL.duck.make({ sides: 8, depth: 0 });
  // The eye sits at (3.46, 7.55, 1.77) once the duck is set down on the bed; its head is a ball of 2.35 round (2, 6.7, 0).
  const at = y => { for (let z = 4; z > 0; z -= 0.002) if (f(3.46, y, z) < 0) return z; return null; };
  const head = y => Math.sqrt(2.35 ** 2 - 1.46 ** 2 - (y - 6.7) ** 2);
  const normal = (x, y, z) => { const e = 1e-3, g = [f(x + e, y, z) - f(x - e, y, z), f(x, y + e, z) - f(x, y - e, z), f(x, y, z + e) - f(x, y, z - e)], l = Math.hypot(...g); return g.map(v => v / l); };
  let prev = null, turn = 0, deepest = Infinity;
  for (let y = 6.75; y <= 8.35; y += 0.02) {
    const z = at(y);
    if (z === null) continue;
    if (Math.abs(y - 7.55) < 0.08) deepest = Math.min(deepest, z);
    const m = normal(3.46, y, z);
    if (prev) turn = Math.max(turn, Math.acos(Math.min(1, m[0] * prev[0] + m[1] * prev[1] + m[2] * prev[2])) * 180 / Math.PI);
    prev = m;
  }
  assert.ok(turn < 20, `the surface turns ${turn.toFixed(1)} degrees between points 0.2 mm apart`);
  assert.ok(head(7.55) - deepest > 0.2, `the dimple is ${(head(7.55) - deepest).toFixed(2)} cm deep`);
  // One each side, where the head would otherwise be solid.
  for (const z of [1.5, -1.5]) assert.ok(f(3.46, 7.55, z) > 0 && Math.abs(z) < head(7.55), 'an eye is open');
});

test('the little Pishi is a tabby: shallow stripes on her back and flanks, a plain chest, the same both sides', () => {
  const { f } = MODEL.pishi.make({ sides: 8, depth: 0 });
  // How far out her body reaches at a height, at an angle from her back (0) round to her chest (pi).
  const reach = (t, y) => { for (let r = 5; r > 0; r -= 0.004) if (f(Math.sin(t) * r, y, -0.4 - Math.cos(t) * r) < 0) return r; return 0; };
  const flank = [], chest = [];
  for (let t = 0; t <= 1.5; t += 0.025) flank.push(reach(t, 4.7));
  for (let t = 2.6; t <= Math.PI; t += 0.025) chest.push(reach(t, 4.7));
  const dips = flank.filter((r, i) => i > 0 && i < flank.length - 1 && r < flank[i - 1] - 0.1).length;
  assert.ok(dips >= 3, `${dips} stripes down her flank`);
  assert.ok(Math.max(...flank) - Math.min(...flank) < 0.32, 'the stripes are shallow');
  for (let i = 1; i < chest.length; i++) assert.ok(Math.abs(chest[i] - chest[i - 1]) < 0.05, 'her chest is plain');
  // An M on her brow: three grooves across the front of her head.
  let m = 0;
  for (const x of [0, 0.54, -0.54]) {
    const z = d => { for (let zz = 4; zz > 0; zz -= 0.002) if (f(x + d, 10.15, zz) < 0) return zz; return 0; };
    if (z(0) < (z(-0.17) + z(0.17)) / 2 - 0.04) m++;
  }
  assert.equal(m, 3);
  // Left and right alike above her tail, which curls round one side.
  for (let x = 0.05; x < 4.6; x += 0.15) for (let y = 2.2; y < 12.7; y += 0.15) for (let z = -4.2; z < 4.2; z += 0.15) {
    assert.equal(f(x, y, z) < 0, f(-x, y, z) < 0, `at ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`);
  }
});

test('a black print shows its shape in the dim room: a sheen on the faces the light reaches, its shadows still black', () => {
  const q = cleanPrint({ model: 'penguin' }), { colour: name, ...plain } = q;
  assert.equal(name, 'black');
  const b = finish(buildPrint(q, { points: 30000 })), u = finish(buildPrint(plain, { points: 30000 })).colour, { base } = printColour(name);
  // As the screen shows it, out of 255: how far the lit faces stand from the shadows, with the sheen and with black alone.
  const srgb = v => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) * 255;
  const spread = f => { const a = Array.from({ length: u.length / 3 }, (_, i) => srgb(f(i))).sort((x, y) => x - y); return [a[Math.floor(a.length * 0.05)], a[Math.floor(a.length * 0.95)]]; };
  const [lo, hi] = spread(i => b.colour[i * 3]), [plo, phi] = spread(i => base[0] * u[i * 3]);
  assert.ok(hi - lo > 1.6 * (phi - plo), `lit against shadow: ${(hi - lo).toFixed(0)} with the sheen, ${(phi - plo).toFixed(0)} without`);
  assert.ok(lo < 40, `its shadows stay black (${lo.toFixed(0)})`);
  for (const c of SWATCHES) assert.equal(printColour(c).sheen > 0, c === 'black', c);
});

test('an even number of petals is turned half a petal, so none points down the stem; every petal is there', () => {
  for (let n = 5; n <= 12; n++) {
    const ring = petalRing(n), at = (t, r) => ring(r * Math.sin(t), 12 + r * Math.cos(t), 0.6 - 0.12 * r);
    // Straight down from the middle of the head, where the stem comes in.
    assert.ok(at(Math.PI, 3.5) > 0, `${n} petals: one points down the stem`);
    let petals = 0, was = at(-0.01, 3.5) < 0;
    for (let t = 0; t < 2 * Math.PI; t += 0.01) { const now = at(t, 3.5) < 0; if (now && !was) petals++; was = now; }
    assert.equal(petals, n);
    // The head is the same either side of the stem.
    for (let t = 0.05; t < Math.PI; t += 0.05) assert.equal(at(t, 3) < 0, at(-t, 3) < 0, `${n} petals at ${t.toFixed(2)}`);
  }
});

test('a model named in two words is read whole: a chess king is the king, though chess alone is the knight', () => {
  for (const [typed, id] of [['chess king', 'king'], ['king', 'king'], ['chess knight', 'knight'], ['knight', 'knight'], ['chess', 'knight'],
    ['a black chess king please', 'king'], ['chess-king', 'king'], ['a chess king and a knight', 'king'], ['king chess', 'king'], ['chess piece king', 'king'],
    ['space rocket', 'rocket'], ['rocket ship and a duck', 'rocket']]) assert.equal(parsePrint(typed).p.model, id, typed);
  // Every model answers to its full name, and to each of its own words.
  for (const m of MODELS) {
    assert.equal(parsePrint(m.name).p.model, m.id, m.name);
    for (const w of m.words) assert.equal(parsePrint(w).p.model, m.id, w);
  }
  assert.equal(parsePrint('print a chess king taller').said, 'Printing a black chess king.');
});
