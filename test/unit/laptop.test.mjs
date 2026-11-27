import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LID, SHEET, STICKERS, LOGO, onSheet } from '../../web/src/pure/laptop.js';

const props = readFileSync(new URL('../../blender/zones/studio_props.py', import.meta.url), 'utf8');

test('the sticker sheet is the lid the studio builds, and lies within its flat top', () => {
  const m = props.match(/LAPTOP = \{'w': ([\d.]+), 'd': ([\d.]+)/);
  assert.ok(m && +m[1] === LID.w && +m[2] === LID.d, `studio_props.py ${m && m.slice(1)}`);
  const lid = props.match(/slab\('laptop_lid'[^\n]*et=([\d.]+)/);
  assert.ok(lid && +lid[1] === LID.edge, 'the lid top\'s rounded edge');
  assert.ok(SHEET.w < LID.w - 2 * LID.edge && SHEET.d < LID.d - 2 * LID.edge);
});

test('his eight stickers, each within the sheet and clear of the lid\'s edges, none over another or over the logo', () => {
  assert.deepEqual(STICKERS.map(s => s.id).sort(), ['bh22', 'controller', 'heart', 'pomegranate', 'pressf', 'soccer', 'starball', 'vancouver']);
  for (const s of STICKERS) {
    // The radius it fits in covers its die-cut edge, at any turn.
    assert.ok(s.reach / 1000 <= s.r + 1e-9, `${s.id} reaches past its radius`);
    const [x, y] = s.at, limX = LID.w / 2 - SHEET.keep, limY = LID.d / 2 - SHEET.keep;
    assert.ok(Math.abs(x) + s.r <= limX + 1e-9 && Math.abs(y) + s.r <= limY + 1e-9, `${s.id} reaches past the lid's edge`);
    const d = Math.hypot(x - LOGO.at[0], y - LOGO.at[1]);
    assert.ok(d >= s.r + LOGO.r + 0.004, `${s.id} is on the logo`);
  }
  for (let i = 0; i < STICKERS.length; i++) for (let j = i + 1; j < STICKERS.length; j++) {
    const a = STICKERS[i], b = STICKERS[j], d = Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1]);
    assert.ok(d >= a.r + b.r + 0.004, `${a.id} and ${b.id} overlap (${(d * 1000).toFixed(0)} mm apart)`);
  }
});

test('a mix of angles, and the sheet\'s picture maps the lid\'s middle to its middle with its far edge on top', () => {
  const turns = STICKERS.map(s => s.turn);
  assert.ok(turns.some(t => t > 5) && turns.some(t => t < -5) && turns.some(t => Math.abs(t) < 5), turns.join(' '));
  assert.deepEqual(onSheet([0, 0], 2048, 1000), [1024, 500]);
  assert.ok(onSheet([0, 0.05], 2048, 1000)[1] < 500 && onSheet([0.05, 0], 2048, 1000)[0] > 1024);
});
