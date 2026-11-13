import test from 'node:test';
import assert from 'node:assert/strict';
import { APPS, W, H, BAR, DOCK, newDesktop, open, close, focus, move, hit, dock, rows, parseAct, find } from '../../web/src/pure/desktop.js';

test('the desktop starts with the terminal in front of the projects', () => {
  const st = newDesktop();
  assert.deepEqual(st.wins.map(w => w.app), ['projects', 'terminal']);
  assert.equal(st.focus, 'terminal');
});

test('every app window starts inside the screen, clear of the top bar and the dock', () => {
  for (const a of APPS) {
    const [x, y, w, h] = a.rect;
    assert.ok(x >= 0 && x + w <= W, `${a.id} fits across`);
    assert.ok(y >= BAR && y + h <= H - DOCK, `${a.id} fits between the bar and the dock`);
  }
});

test('opening an open app brings it to the front instead of a second copy', () => {
  const st = newDesktop();
  assert.ok(open(st, 'projects'));
  assert.deepEqual(st.wins.map(w => w.app), ['terminal', 'projects']);
  assert.equal(st.focus, 'projects');
  assert.ok(open(st, 'music'));
  assert.equal(st.wins.filter(w => w.app === 'music').length, 1);
  assert.equal(open(st, 'nope'), false);
});

test('closing the front window hands focus to the one behind it', () => {
  const st = newDesktop();
  open(st, 'notes');
  assert.ok(close(st, 'notes'));
  assert.equal(st.focus, 'terminal');
  assert.equal(close(st, 'notes'), false, 'already closed');
  close(st, 'terminal'); close(st, 'projects');
  assert.equal(st.focus, null);
  assert.equal(focus(st, 'terminal'), false, 'nothing to focus');
});

test('however many windows are opened, each new one lands wholly on the screen', () => {
  const st = newDesktop();
  for (let round = 0; round < 3; round++) for (const a of APPS) { close(st, a.id); open(st, a.id); }
  for (const w of st.wins) assert.ok(w.x >= 0 && w.x + w.w <= W && w.y >= BAR && w.y + w.h <= H - DOCK, `${w.app} at ${w.x},${w.y}`);
});

test('a dragged window keeps its title bar on the screen', () => {
  const st = newDesktop();
  move(st, 'terminal', -5000, -5000);
  const t = find(st, 'terminal');
  assert.ok(t.x + t.w >= 120 && t.y >= BAR);
  move(st, 'terminal', 9000, 9000);
  assert.ok(t.x <= W - 120 && t.y <= H - DOCK - 34);
  assert.equal(move(st, 'music', 1, 1), false);
});

test('a click lands on the topmost window under it', () => {
  const st = newDesktop();
  const p = find(st, 'projects'), x = p.x + 10, y = p.y + 10;
  assert.equal(hit(st, x, y), 'projects');
  open(st, 'about');
  const a = find(st, 'about');
  assert.equal(hit(st, a.x + 5, a.y + 5), 'about', 'the newer window is on top');
  assert.equal(hit(st, 2, H - 2), null);
});

test('the dock has one icon per app, centred and inside the screen', () => {
  const d = dock();
  assert.equal(d.length, APPS.length);
  const left = d[0].x, right = d.at(-1).x + d.at(-1).size;
  assert.ok(Math.abs(left - (W - right)) < 1, 'centred');
  for (const i of d) assert.ok(i.y >= H - DOCK && i.y + i.size <= H);
});

test('the projects window links each project, and only real ones', () => {
  const r = rows('projects', { projects: ['meet-bex', 'behbod', 'not-a-project'] });
  assert.equal(r.length, 2);
  assert.deepEqual(r[0].pills.map(p => p.act), ['link:https://behi22.github.io/meet-bex/', 'link:https://github.com/behi22/meet-bex']);
  assert.deepEqual(r[1].pills.map(p => p.label), ['Code'], 'this site has no separate page');
});

test('music shows what is playing and offers a stop only then', () => {
  const records = [{ id: 'a', title: 'A', mood: 'calm' }, { id: 'b', title: 'B', mood: 'up' }];
  let r = rows('music', { records, sound: true, playing: 'b' });
  assert.equal(r[1].pills[0].label, 'Playing');
  assert.ok(r[1].pills[0].on);
  assert.ok(r.at(-1).pills.some(p => p.act === 'music:off'));
  r = rows('music', { records, sound: false, playing: null });
  assert.ok(!r.at(-1).pills.some(p => p.act === 'music:off'));
  assert.equal(r.at(-1).text[0][0], 'sound is off');
  assert.equal(rows('music', {}).length, 1);
});

test('settings mark the current choice of each option', () => {
  const r = rows('settings', { quality: 'high', sound: true, hood: false, scenes: ['focus', 'party'], scene: 'party', coolant: 'gold' });
  const on = r.map(x => x.pills.filter(p => p.on).map(p => p.label));
  assert.deepEqual(on, [['high'], ['on'], ['down'], ['party'], ['gold']]);
});

test('an action keeps the colons in its argument', () => {
  assert.deepEqual(parseAct('link:https://github.com/behi22'), { kind: 'link', arg: 'https://github.com/behi22' });
  assert.deepEqual(parseAct('sound'), { kind: 'sound', arg: '' });
});

test('every window lays its rows out inside itself, with no text running under a button', async () => {
  const { layout, textWidth, appById } = await import('../../web/src/pure/desktop.js');
  const records = [
    { id: 'lofi', title: 'Night Shift', mood: 'Chill lo-fi hip hop: dusty drums, warm Rhodes chords, vinyl crackle' },
    { id: 'synth', title: 'Lions Gate', mood: 'Synthwave night drive: arpeggios, pads, gated snare' },
    { id: 'persian', title: 'Dastgah', mood: 'Persian-inspired: santur in Shur over tombak and a soft drone' },
    { id: 'piano', title: 'Rain Piano', mood: 'Soft solo piano' },
  ];
  const ctx = { records, playing: 'synth', sound: true, quality: 'ultra', hood: true, scenes: ['chill', 'focus', 'matchday', 'off', 'party', 'holiday'], scene: 'chill', coolant: 'teal' };
  for (const app of ['projects', 'about', 'music', 'settings']) {
    const [x, y, w, h] = appById(app).rect, win = { x, y, w, h };
    const L = layout(win, rows(app, ctx));
    assert.ok(L.bottom <= y + h, `${app} rows fit its height (${L.bottom} > ${y + h})`);
    for (const p of L.pills) assert.ok(p.x >= x && p.x + p.w <= x + w, `${app} pill ${p.label} inside`);
    for (const t of L.texts) {
      const tr = t.x + textWidth(t.s, t.px);
      assert.ok(t.x >= x && tr <= x + w, `${app} text "${t.s}" inside`);
      for (const p of L.pills) {
        const sameRow = t.y > p.y - 12 && t.y - t.px < p.y + p.h + 12;
        if (sameRow) assert.ok(tr <= p.x || t.x >= p.x + p.w, `${app}: "${t.s}" runs under ${p.label}`);
      }
    }
    for (let i = 1; i < L.pills.length; i++) {
      const a = L.pills[i - 1], b = L.pills[i];
      if (a.y === b.y) assert.ok(a.x + a.w <= b.x, `${app} pills ${a.label} and ${b.label} overlap`);
    }
  }
});

test('on the narrow phone layout every button stays inside its window, wrapping to a new line if it must', async () => {
  const { layout } = await import('../../web/src/pure/desktop.js');
  const ctx = { records: [{ id: 'a', title: 'Night Shift', mood: 'Chill lo-fi' }], sound: true, quality: 'ultra', hood: true, scenes: ['chill', 'focus', 'matchday', 'off', 'party'], scene: 'chill', coolant: 'teal' };
  for (const app of ['projects', 'about', 'music', 'settings']) {
    const win = { x: 0, y: 34, w: 540, h: 900 }, L = layout(win, rows(app, ctx));
    for (const p of L.pills) assert.ok(p.x >= win.x && p.x + p.w <= win.x + win.w, `${app}: ${p.label} at ${p.x}..${p.x + p.w}`);
    // Nothing overlaps anything: a wrapped line of buttons pushes the next row down.
    const boxes = [...L.pills.map(p => [p.x, p.y, p.w, p.h, p.label]), ...L.texts.map(t => [t.x, t.y - t.px * 0.8, t.s.length * t.px * 0.6, t.px, t.s])];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const [ax, ay, aw, ah, an] = boxes[i], [bx, by, bw, bh, bn] = boxes[j];
      assert.ok(ax + aw <= bx || bx + bw <= ax || ay + ah <= by || by + bh <= ay, `${app}: "${an}" overlaps "${bn}"`);
    }
  }
});

test('Pishi on the keys brings the terminal back behind whatever is in front, without taking the front', async () => {
  const { keepOpen } = await import('../../web/src/pure/desktop.js');
  const st = newDesktop();
  open(st, 'notes'); close(st, 'terminal');
  assert.ok(keepOpen(st, 'terminal'));
  assert.equal(st.focus, 'notes');
  assert.equal(st.wins.at(-1).app, 'notes');
  assert.equal(st.wins[0].app, 'terminal');
  assert.equal(keepOpen(st, 'terminal'), false, 'already open');
});

test('a long line is cut with an ellipsis to the width it has', async () => {
  const { fit } = await import('../../web/src/pure/desktop.js');
  assert.equal(fit('short', 20, 200), 'short');
  const f = fit('a much longer line than the room it has', 20, 120);
  assert.equal(f.length, 10);
  assert.ok(f.endsWith('…'));
  assert.equal(fit('abc', 20, 5), '');
});

test('the calculator fits its window: a display and twenty keys, none touching, at any window size', async () => {
  const { calcLayout, appById, TITLE } = await import('../../web/src/pure/desktop.js');
  const [, , w, h] = appById('calc').rect;
  for (const win of [{ x: 100, y: 60, w, h }, { x: 0, y: 34, w: 540, h: 256 }, { x: 0, y: 34, w: 900, h: 300 }, { x: 0, y: 34, w: 300, h: 420 }]) {
    const L = calcLayout(win, 21);
    // The lettering fits what it is written on: the sum line and the answer inside the display, a label inside its key.
    assert.ok(L.topPx + L.mainPx + 20 <= L.display.h, `the display's two lines fit ${win.w} by ${win.h}`);
    assert.ok(L.keyPx <= L.keys[0].h * 0.7 && L.keys[0].h >= 24, `keys ${L.keys[0].h.toFixed(0)} tall, labels ${L.keyPx}`);
    assert.ok(L.mainPx * 0.6 * 21 <= L.display.w - 28 + 1e-6, 'a long answer still fits across');
    assert.equal(L.keys.length, 20);
    for (const r of [L.display, ...L.keys]) {
      assert.ok(r.x >= win.x && r.x + r.w <= win.x + win.w + 1e-6 && r.y >= win.y + TITLE && r.y + r.h <= win.y + win.h + 1e-6, 'inside the window, under its title');
      assert.ok(r.w > 20 && r.h > 12, 'big enough to press');
    }
    for (const a of L.keys) for (const b of L.keys) if (a !== b) assert.ok(a.x + a.w <= b.x + 1e-6 || b.x + b.w <= a.x + 1e-6 || a.y + a.h <= b.y + 1e-6 || b.y + b.h <= a.y + 1e-6, `${a.key} and ${b.key} overlap`);
    assert.ok(L.keys.every(k => k.y >= L.display.y + L.display.h || k.x >= L.display.x + L.display.w), 'the keys sit under the display, or beside it in a wide window');
  }
  assert.ok(calcLayout({ x: 0, y: 0, w, h }, 21).mainPx < calcLayout({ x: 0, y: 0, w, h }, 3).mainPx, 'a long line is written smaller');
  assert.ok(calcLayout({ x: 0, y: 0, w, h }, 21).mainPx * 0.6 * 21 <= w - 28 - 28, 'and fits the display');
  const { tail } = await import('../../web/src/pure/desktop.js');
  assert.equal(tail('12 + 3', 15, 200), '12 + 3');
  const cut = tail('123456789 + 123456789 + 123456789 +', 15, 180);
  assert.ok(cut.startsWith('…') && cut.length === 20 && cut.endsWith('123456789 +'), `the newest end is kept: ${cut}`);
  assert.equal(tail('abc', 15, 5), '');
});

test('the dock holds every app, on the monitor and on a narrow phone', () => {
  for (const width of [W, 900, 540, 360]) {
    const icons = dock(width, H);
    assert.equal(icons.length, APPS.length);
    assert.ok(icons[0].x >= 8 && icons.at(-1).x + icons.at(-1).size <= width - 8, `fits ${width}`);
    for (let i = 1; i < icons.length; i++) assert.ok(icons[i].x >= icons[i - 1].x + icons[i - 1].size, 'no two icons overlap');
    assert.ok(icons.every(d => d.size >= 24), 'still big enough to tap');
  }
});
