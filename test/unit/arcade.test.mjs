import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES, gameById, launcherLayout, playLayout, fitGame, toGame, readBest } from '../../web/src/pure/arcade.js';
import { textWidth, TITLE } from '../../web/src/pure/desktop.js';
import { COURT, LEVELS } from '../../web/src/pure/paddle.js';
import { SKY } from '../../web/src/pure/orbit.js';
import { FIELD } from '../../web/src/pure/bughunt.js';

// The size the Games window opens at on the monitor.
const GAMES_WIN = [300, 48, 820, 520];
const inside = (r, w) => r.x >= w.x - 1e-6 && r.x + r.w <= w.x + w.w + 1e-6 && r.y >= w.y - 1e-6 && r.y + r.h <= w.y + w.h + 1e-6;
const apart = (a, b) => a.x + a.w <= b.x + 1e-6 || b.x + b.w <= a.x + 1e-6 || a.y + a.h <= b.y + 1e-6 || b.y + b.h <= a.y + 1e-6;
const textBox = t => ({ x: t.x, y: t.y - t.px * 0.8, w: textWidth(t.s, t.px), h: t.px, s: t.s });

test('three games, each with its picture size, its controls and an icon', () => {
  assert.deepEqual(GAMES.map(g => g.id), ['paddle', 'orbit', 'bughunt']);
  assert.deepEqual(gameById('paddle').size, [COURT.w, COURT.h]);
  assert.deepEqual(gameById('orbit').size, [SKY.size, SKY.size]);
  assert.deepEqual(gameById('bughunt').size, [FIELD.w, FIELD.h]);
  for (const g of GAMES) assert.ok(g.title && g.line && g.hint && g.touch && /^M[\d\s.,MmLlHhVvAaZzCc-]+$/.test(g.icon), g.id);
  for (const odd of ['nope', '__proto__', 'constructor', '', null]) assert.equal(gameById(odd), null, String(odd));
  assert.ok(!/[\u2014\u2013]/.test(JSON.stringify(GAMES)), 'no long dashes in what a visitor reads');
});

test('the launcher: a card per game, inside the window, its words and buttons inside the card and apart', () => {
  const [x, y, w, h] = GAMES_WIN;
  const best = { paddle: 12, orbit: 0 };
  for (const win of [{ x, y, w, h }, { x: 0, y: 34, w: 540, h: 821 }, { x: 0, y: 34, w: 540, h: 256 }, { x: 0, y: 34, w: 1484, h: 256 }]) {
    const L = launcherLayout(win, best), at = `${win.w}x${win.h}`;
    assert.equal(L.cards.length, 3, at);
    for (const c of L.cards) {
      assert.ok(c.x >= win.x && c.x + c.w <= win.x + win.w + 1e-6 && c.y >= win.y + TITLE, `${at}: ${c.id} card across`);
      assert.ok(inside({ ...c.icon, w: c.icon.size, h: c.icon.size }, c), `${at}: ${c.id} icon in its card`);
      if (c.pic) assert.ok(inside(c.pic, c) && c.pic.y >= c.icon.y + c.icon.size, `${at}: ${c.id} picture in its card, under the icon`);
    }
    for (let i = 1; i < 3; i++) assert.ok(apart(L.cards[i - 1], L.cards[i]), `${at}: cards apart`);
    const owner = r => L.cards.find(c => inside(r, c));
    for (const p of L.pills) assert.ok(owner(p), `${at}: ${p.label} inside a card`);
    for (const t of L.texts) assert.ok(owner(textBox(t)), `${at}: "${t.s}" inside a card`);
    const all = [...L.pills, ...L.texts.map(textBox), ...L.cards.filter(c => c.pic).map(c => c.pic)];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) assert.ok(apart(all[i], all[j]), `${at}: "${all[i].label || all[i].s || 'picture'}" overlaps "${all[j].label || all[j].s || 'picture'}"`);
    assert.deepEqual(L.pills.map(p => p.act), [...Object.keys(LEVELS).map(l => `game:start:paddle:${l}`), 'game:start:orbit', 'game:start:bughunt'], at);
    assert.ok(L.texts.some(t => t.s === 'best rally 12'), `${at}: the best is shown`);
    assert.equal(L.texts.filter(t => t.s === 'no best yet').length, 2, `${at}: and no best where there is none`);
  }
  // In the monitor's window the cards stand side by side with pictures, and fit its height.
  const wide = launcherLayout({ x, y, w, h });
  assert.ok(wide.cards.every(c => c.y === wide.cards[0].y && c.pic && c.pic.h >= 100), 'side by side, with pictures');
  assert.ok(wide.bottom <= y + h, `fits its height: ${wide.bottom} against ${y + h}`);
  // On a phone they stack, and the window scrolls if it must.
  const phone = launcherLayout({ x: 0, y: 34, w: 540, h: 821 });
  assert.ok(phone.cards[1].y > phone.cards[0].y + phone.cards[0].h && phone.bottom <= 34 + 821, 'stacked, and they fit a phone held upright');
});

test('playing: the way back, the score, pause and the picture, all in the window; the right button for the moment', () => {
  const [x, y, w, h] = GAMES_WIN;
  for (const win of [{ x, y, w, h }, { x: 0, y: 34, w: 540, h: 821 }, { x: 0, y: 34, w: 540, h: 256 }]) for (const g of GAMES) {
    const at = `${win.w}x${win.h} ${g.id}`;
    const L = playLayout(win, g.id, { state: 'play', status: 'you 2 : 1 computer   rally 3   Normal and then a lot more words than fit' });
    assert.deepEqual(L.pills.map(p => p.label), ['← Games', 'Pause'], at);
    assert.ok(inside(L.area, win) && L.area.y >= Math.max(...L.pills.map(p => p.y + p.h)) && L.area.w > 200 && L.area.h >= 60, `${at}: the picture fits under the buttons`);
    for (const p of L.pills) assert.ok(inside(p, win), `${at}: ${p.label}`);
    const [score, hint] = L.texts;
    assert.ok(textBox(score).x + textBox(score).w <= L.pills[1].x - 15 && score.x >= L.pills[0].x + L.pills[0].w + 15, `${at}: the score sits between the buttons`);
    assert.ok(score.s.endsWith('…') || score.s.length <= L.score.w / (L.score.px * 0.6), `${at}: a long score line is cut`);
    assert.ok(textBox(hint).y >= L.area.y + L.area.h && inside(textBox(hint), win), `${at}: how to play, under the picture`);
    assert.ok(textWidth(g.hint, 15) <= win.w - 24 ? hint.s === g.hint : hint.s.endsWith('…'), `${at}: the whole hint where it fits`);
  }
  const win = { x, y, w, h };
  assert.equal(playLayout(win, 'orbit', { state: 'paused' }).pills[1].label, 'Go on');
  assert.equal(playLayout(win, 'orbit', { state: 'paused' }).pills[1].act, 'game:pause');
  assert.equal(playLayout(win, 'orbit', { state: 'done' }).pills[1].act, 'game:again');
  assert.equal(playLayout(win, 'orbit', { touch: true }).texts.at(-1).s, gameById('orbit').touch, 'a phone is told about fingers');
  assert.equal(playLayout({ x: 0, y: 34, w: 1484, h: 256 }, 'orbit', { touch: true, sideways: true }).texts.at(-1).s, 'turn your phone upright for a bigger game', 'and one on its side, to turn it');
  assert.equal(playLayout(win, 'orbit').texts.length, 1, 'no score line until there is one');
});

test('a game is drawn as big as fits, centred, and a point on it comes back in the game\'s own units', () => {
  const f = fitGame('paddle', 800, 410);
  assert.ok(Math.abs(f.h - 410) < 1e-9 && f.w < 800 && Math.abs(f.x - (800 - f.w) / 2) < 1e-9 && f.y === 0, 'touches top and bottom, centred across');
  const s = fitGame('orbit', 800, 410);
  assert.ok(Math.abs(s.w - s.h) < 1e-9 && s.h === 410);
  for (const id of ['paddle', 'orbit', 'bughunt']) for (const [bw, bh] of [[800, 410], [356, 600], [1, 1]]) {
    const b = fitGame(id, bw, bh), [gw, gh] = gameById(id).size;
    const [cx, cy] = toGame(id, bw / 2, bh / 2, bw, bh);
    assert.ok(Math.abs(cx - gw / 2) < 1e-6 && Math.abs(cy - gh / 2) < 1e-6, `${id} centre`);
    const [lx, ty] = toGame(id, b.x, b.y, bw, bh), [rx, by] = toGame(id, b.x + b.w, b.y + b.h, bw, bh);
    assert.ok(Math.abs(lx) < 1e-6 && Math.abs(ty) < 1e-6 && Math.abs(rx - gw) < 1e-6 && Math.abs(by - gh) < 1e-6, `${id} corners`);
  }
});

test('best scores read back from the browser keep only whole, positive scores of real games', () => {
  assert.deepEqual(readBest('{"paddle":7,"orbit":31.8,"bughunt":240}'), { paddle: 7, orbit: 31, bughunt: 240 });
  for (const bad of [null, '', 'not json', '[1,2]', '5', 'null', '"x"', '{"paddle":-3,"orbit":"12","bughunt":null}', '{"paddle":NaN}', '{"paddle":1e400}', '{"nope":5}', '{"__proto__":{"paddle":9}}', '{"paddle":0}'])
    assert.deepEqual(readBest(bad), {}, String(bad));
  assert.deepEqual(readBest('{"paddle":1e12}'), { paddle: 1e6 }, 'capped');
  assert.equal(Object.getPrototypeOf(readBest('{"__proto__":{"paddle":9}}')), Object.prototype);
});
