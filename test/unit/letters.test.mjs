import test from 'node:test';
import assert from 'node:assert/strict';
import { layout, sizeFor, graphemes, roughGraphemes, MIN, ONE } from '../../web/src/pure/letters.js';
import { parsePrint, cleanPrint, tooMany, MAX_TEXT } from '../../web/src/pure/printer.js';
import { buildPrint, REACH } from '../../web/src/pure/printbuild.js';
import { finish } from '../../web/src/pure/mesher.js';
import { letterField } from '../../web/src/pure/keychain.js';

const ZWJ = String.fromCharCode(0x200d);
// About how wide each letter is at 96 px in a heavy sans serif, so the layout can be checked without a canvas.
const WIDE = { W: 100, M: 95, m: 90, w: 80, ' ': 25, '-': 35, i: 30, l: 30, j: 30, I: 32, t: 38, f: 38, r: 42 };
const width = g => {
  if (g in WIDE) return WIDE[g];
  if (/\p{Extended_Pictographic}/u.test(g)) return 120;
  if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(g)) return 96;
  if (/\p{Script=Arabic}/u.test(g)) return 45;
  if (g === ZWJ) return 0;
  return /\p{Lu}/u.test(g) ? 70 : 55;
};
const measure = s => graphemes(s).reduce((a, g) => a + width(g), 0);

test('short words print on one line at a good size, long ones go on two', () => {
  const name = layout('Behbod', measure);
  assert.deepEqual(name.lines, ['Behbod']);
  assert.ok(name.fits && name.size >= ONE, `${name.size}`);
  const phrase = layout('really really long name', measure);
  assert.deepEqual(phrase.lines, ['really really', 'long name']);
  assert.ok(phrase.fits && phrase.size >= MIN);
});

test('one long word is broken over two lines with a hyphen, and its letters stay big enough to read', () => {
  const one = sizeFor(measure('Supercalifragilistic'));
  assert.ok(one < MIN, `on one line it would print at ${one.toFixed(2)} cm`);
  const l = layout('Supercalifragilistic', measure);
  assert.equal(l.lines.length, 2);
  assert.ok(l.lines[0].endsWith('-') && !l.lines[1].startsWith('-'), l.lines.join(' / '));
  assert.equal(l.lines[0].slice(0, -1) + l.lines[1], 'Supercalifragilistic');
  assert.ok(Math.abs(measure(l.lines[0]) - measure(l.lines[1])) < 120, 'the halves are about even');
  assert.ok(l.fits && l.size >= MIN && l.size > one * 1.6, `${l.size}`);
});

test('words too long to read even on two lines do not fit', () => {
  const w = layout('W'.repeat(24), measure);
  assert.equal(w.lines.length, 2);
  assert.ok(!w.fits && w.size < MIN, `${w.size}`);
  // Every size gets smaller as the line gets longer, and stops at the largest the keychain takes.
  for (let px = 50; px < 3000; px += 50) assert.ok(sizeFor(px + 50) <= sizeFor(px) + 1e-9);
});

test('other scripts break their own way: no hyphen in Chinese, joined letters stay joined in Persian, an emoji stays whole', () => {
  const han = layout('東京都庁舎展望台東京都', measure);
  assert.equal(han.lines.length, 2);
  assert.ok(han.lines.every(l => !l.includes('-')) && han.lines.join('') === '東京都庁舎展望台東京都' && han.fits);
  const fa = 'ابجدهوزحطیکلمنسعفصقرشت', p = layout(fa, measure);
  assert.equal(p.lines.length, 2);
  assert.ok(p.lines[0].endsWith(ZWJ) && p.lines[1].startsWith(ZWJ), 'a joiner each side of the break');
  assert.equal(p.lines.join('').split(ZWJ).join(''), fa);
  const family = ['👨', '👩', '👧', '👦'].join(ZWJ), e = layout(family.repeat(8), measure);
  assert.equal(e.lines.length, 2);
  for (const line of e.lines) assert.equal(line.split(family).join(''), '', 'only whole families on each line');
  // Without the browser's own splitter, marks and joined emoji still stay with their letter.
  assert.deepEqual(roughGraphemes('é' + family + 'x'), ['é', family, 'x']);
});

test('the size worked out for a line is the size the keychain prints at', () => {
  for (const px of [200, 420, 700, 1100]) {
    const w = px + 40, h = 150, data = new Uint8Array(w * h);
    for (let y = 20; y < 110; y++) for (let x = 20; x < 20 + px; x++) if ((x >> 4) & 1) data[y * w + x] = 255;
    const field = finish(letterField({ w, h, data }));
    assert.deepEqual([field.box[0], field.box[1], field.box[3]], [20, 20, 110]);
    const b = finish(buildPrint(cleanPrint({ model: 'word', text: 'x' }), { points: 20000, field }));
    const ink = field.box[2] - field.box[0];
    assert.ok(Math.abs(b.em - sizeFor(ink)) / sizeFor(ink) < 0.03, `${ink} px: prints at ${b.em.toFixed(2)} cm, worked out ${sizeFor(ink).toFixed(2)} cm`);
    assert.ok(b.radius <= REACH / 100 + 1e-6);
  }
});

test('a keychain is never cut short without saying so: more than it holds is marked', () => {
  assert.equal(parsePrint('hello world').cut, false);
  assert.equal(parsePrint('supercalifragilisticexpialidocious').cut, true);
  assert.equal(parsePrint(`print "${'a'.repeat(MAX_TEXT + 1)}"`).cut, true);
  assert.equal(parsePrint(`print "${'a'.repeat(MAX_TEXT)}"`).cut, false);
  assert.equal(parsePrint('a really really long name for a keychain here').cut, true);
  assert.equal(parsePrint('taller', parsePrint('sam').p).cut, false);
  assert.ok(tooMany('x'.repeat(MAX_TEXT + 1)) && !tooMany(` ${'x'.repeat(MAX_TEXT)} `));
});
