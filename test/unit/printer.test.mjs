import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePrint, cleanPrint, cleanText, describe, DEFAULT, SHOWN, SWATCHES, COLOURS, MAX_TEXT, sidesOf } from '../../web/src/pure/printer.js';
import { MODELS, MODEL } from '../../web/src/pure/models.js';
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
    assert.ok(b.shade.every(v => v > 0.02 && v < 1.3), m.id);
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
  const field = letterField(blocks());
  assert.deepEqual(field.box, [10, 10, 150, 50]);
  assert.ok(field.sd[30 * 160 + 30] < -10 && field.sd[30 * 160 + 75] > 10);
  const k = keychain(field);
  assert.ok(k.f(-1.5, 1.6, 0.6) < 0, 'a letter is solid');
  assert.ok(k.f(0, 0.5, 0) < 0, 'the bar joins them');
  assert.ok(k.f(0, 1.6, 0.6) > 0, 'the gap between them is open in front');
  assert.equal(letterField({ w: 4, h: 4, data: new Uint8Array(16) }), null);
  const blank = finish(buildPrint(cleanPrint({ model: 'word', text: 'x' }), { points: 20000, field: null }));
  assert.ok(blank.index.length > 300, 'letters that drew nothing still give a tag');
  const word = build({ model: 'word', text: 'ab' }, 30000, field);
  assert.ok(word.radius <= REACH / 100 + 1e-6 && word.height > 0.03);
  assert.ok(build({ model: 'word', text: 'ab', depth: 0.3 }, 30000, letterField(blocks())).height > word.height * 1.05, 'a spiky keychain');
});
