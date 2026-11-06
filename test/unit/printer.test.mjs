import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePrint, cleanPrint, shapeFromWord, buildPrint, nozzleAt, section, DEFAULT, SHAPES, MAX_R } from '../../web/src/pure/printer.js';

test('a shape name starts that shape and keeps the colour', () => {
  const r = parsePrint('make me a star', { ...DEFAULT, colour: 'teal' });
  assert.equal(r.p.edge, 'star');
  assert.equal(r.p.colour, 'teal');
  assert.equal(r.said, 'Printing a teal star.');
});

test('words adjust the print that is there', () => {
  const start = parsePrint('vase').p;
  const r = parsePrint('taller and red', start);
  assert.ok(r.p.height > start.height);
  assert.equal(r.p.colour, 'red');
  assert.equal(r.p.name, 'vase');
  assert.match(r.said, /^Reprinting the vase, taller in red\.$/);
  assert.equal(parsePrint('more twist', start).p.twist, start.twist + 0.5);
  assert.equal(parsePrint('more points', parsePrint('star').p).p.sides, 6);
  assert.equal(parsePrint('fewer points', parsePrint('star').p).p.sides, 4);
  assert.equal(parsePrint('a 7 point star').p.sides, 7);
  assert.equal(parsePrint('again', start).p.height, start.height);
});

test('any other word grows its own shape, the same every time', () => {
  const a = parsePrint('dragon'), b = parsePrint('Dragon!');
  assert.deepEqual(a.p, b.p);
  assert.equal(a.p.name, 'dragon');
  assert.notDeepEqual(shapeFromWord('dragon'), shapeFromWord('pishi'));
  assert.equal(parsePrint('pink dragon').p.colour, 'pink');
});

test('nothing to act on gives nothing', () => {
  assert.equal(parsePrint(''), null);
  assert.equal(parsePrint('   '), null);
  assert.equal(parsePrint('the a please'), null);
  assert.equal(parsePrint(null), null);
});

test('everything stays inside what the printer can make', () => {
  let p = parsePrint('tower').p;
  for (let i = 0; i < 30; i++) p = parsePrint('taller wider twist spikier more sides', p).p;
  assert.ok(p.height <= 1.8 && p.width <= 1.5 && p.twist <= 2 && p.depth <= 0.6 && p.sides <= 12);
  for (let i = 0; i < 30; i++) p = parsePrint('shorter thinner rounder fewer sides', p).p;
  assert.ok(p.height >= 0.25 && p.width >= 0.6 && p.depth >= 0 && p.sides >= 3);
  assert.deepEqual(cleanPrint({ edge: 'blob', sides: 99, height: NaN, colour: 'mauve', name: 7 }), { ...DEFAULT, sides: 12 });
  assert.deepEqual(cleanPrint('junk'), DEFAULT);
});

test('every print fits on the bed and builds bottom, layers, then top', () => {
  for (const name of [...SHAPES, 'dragon', 'behbod', 'x']) {
    let p = parsePrint(name).p;
    p = parsePrint('bigger bigger bigger curvy curvy', p).p;
    const b = buildPrint(p, 40);
    let far = 0;
    for (let i = 0; i < b.pos.length; i += 3) far = Math.max(far, Math.hypot(b.pos[i], b.pos[i + 2]));
    assert.ok(far <= MAX_R + 1e-6, `${name} reaches ${far}`);
    const n = b.ring.length;
    assert.equal(b.bottom, n * 3);
    assert.equal(b.index.length, b.bottom + b.perLayer * 40 + n * 3);
    assert.ok(Math.max(...b.index) < b.pos.length / 3);
    assert.ok(b.shade.every(s => s > 0 && s < 1.2));
    const top = nozzleAt(b, p, 40, 0.5);
    assert.ok(Math.abs(top.y - b.height) < 1e-9 && Math.hypot(top.x, top.z) <= MAX_R + 1e-6);
  }
});

test('a star has its points where it should', () => {
  const ring = section({ ...DEFAULT, edge: 'star', sides: 5, depth: 0.5 });
  const r = ring.map(([x, y]) => Math.hypot(x, y));
  assert.ok(Math.abs(Math.max(...r) - 1) < 1e-9);
  assert.ok(Math.abs(Math.min(...r) - 0.5) < 0.02);
});
