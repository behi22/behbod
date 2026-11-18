import * as THREE from 'three';
import { b2t } from './engine.js';
import { W, H, BAR, DOCK, TITLE, PAD, STYLE, appById, dock, rows, layout, open, close, move, find, parseAct, termShown, calcLayout, tail, fit } from './pure/desktop.js';
import { show as calcShow, NAME as CALC_NAME } from './pure/calc.js';
import { SANDBOX, ALLOW, allowed, siteById, browserLayout, LOCK } from './pure/browser.js';
import { launcherLayout, playLayout, gameById } from './pure/arcade.js';
import { homography } from './pure/homography.js';
import { readerLayout } from './pure/reader.js';
import { paintStory } from './shah/scenes.js';
import { storyById } from './pure/shahnameh.js';

// The seated computer: while I sit at the desk, the same desktop the monitor paints is laid out in HTML right on top
// of the screen, so its windows can be dragged, its buttons clicked and its links followed. On a narrow screen the
// monitor does not fit the view, so the desktop fills the view instead, one window at a time.
const CSS = `
.dt { position: fixed; left: 0; top: 0; width: ${W}px; height: ${H}px; transform-origin: 0 0; overflow: hidden; display: none; opacity: 0;
  transition: opacity .25s; font-family: ${STYLE.font}; color: ${STYLE.ink}; user-select: none; -webkit-user-select: none; touch-action: none;
  background: radial-gradient(rgba(255,255,255,.035) 1px, transparent 1.6px) 24px ${BAR + 24}px / 48px 48px,
    linear-gradient(to bottom right, rgba(62,230,196,.09), rgba(40,60,120,.05) 55%, rgba(120,80,255,.10)), #070b11; }
.dt.on { opacity: 1; }
.dt-bar { position: absolute; left: 0; top: 0; right: 0; height: ${BAR}px; background: ${STYLE.bar}; font-size: ${STYLE.small}px; line-height: ${BAR}px; }
.dt-bar b { position: absolute; left: 18px; color: ${STYLE.ink}; }
.dt-bar .ttl { position: absolute; left: 84px; color: ${STYLE.dim}; }
.dt-bar .clk { position: absolute; right: 18px; color: ${STYLE.ink}; }
.dt-win { position: absolute; background: ${STYLE.window}; border-radius: 10px; box-shadow: 0 8px 26px rgba(0,0,0,.55), inset 0 0 0 1px ${STYLE.edge}; overflow: hidden; }
.dt-win.focus { box-shadow: 0 8px 26px rgba(0,0,0,.55), inset 0 0 0 1.5px rgba(62,230,196,.55); }
.dt-title { position: absolute; left: 0; right: 0; top: 0; height: ${TITLE}px; background: ${STYLE.title}; cursor: grab; font-size: ${STYLE.small}px; line-height: ${TITLE}px; }
.dt-title span { position: absolute; left: 92px; color: ${STYLE.dim}; }
.dt-win.focus .dt-title span { color: ${STYLE.ink}; }
.dt-dot { position: absolute; top: ${TITLE / 2 - 6.5}px; width: 13px; height: 13px; border-radius: 50%; padding: 0; border: 0; cursor: pointer; }
.dt-t { position: absolute; white-space: pre; line-height: 1; }
.dt-term { position: absolute; left: ${PAD}px; right: ${PAD}px; font-size: ${STYLE.term}px; line-height: ${STYLE.termLine}px; white-space: pre; }
.dt-term div { height: ${STYLE.termLine}px; overflow: hidden; }
.dt-term .in { color: ${STYLE.accent}; }
.dt-term .caret { display: inline-block; width: .6em; height: 1em; vertical-align: -.15em; background: ${STYLE.accent}; animation: dt-blink 1s steps(1) infinite; }
@keyframes dt-blink { 50% { opacity: 0; } }
.dt-pill { position: absolute; box-sizing: border-box; padding: 0 0 0 11px; text-align: left; border-radius: 999px; font: inherit; font-size: ${STYLE.small}px;
  color: ${STYLE.ink}; background: rgba(255,255,255,.04); border: 1px solid rgba(127,138,160,.4); cursor: pointer; white-space: pre; }
.dt-pill:hover { border-color: ${STYLE.accent}; }
.dt-pill.on { color: ${STYLE.accent}; background: rgba(62,230,196,.16); border-color: ${STYLE.accent}; }
.dt-notes { position: absolute; box-sizing: border-box; margin: 0; padding: 0; border: 0; outline: 0; resize: none; background: transparent; color: #e9dfb8;
  font: ${STYLE.text}px/28px ${STYLE.font}; user-select: text; -webkit-user-select: text; overflow: hidden; }
.dt-calc { position: absolute; box-sizing: border-box; border-radius: 10px; background: #05080d; text-align: right; overflow: hidden; white-space: pre; }
.dt-calc-top { position: absolute; right: 14px; top: 10px; line-height: 1; color: ${STYLE.dim}; }
.dt-calc-main { position: absolute; right: 14px; bottom: 12px; font-weight: 700; line-height: 1; color: ${STYLE.ink}; }
.dt-calc-main.err { color: ${STYLE.warm}; }
.dt-key { position: absolute; box-sizing: border-box; padding: 0; border: 0; border-radius: 10px; font: inherit; line-height: 1; color: ${STYLE.ink}; background: rgba(255,255,255,.05); cursor: pointer; }
.dt-key:hover { background: rgba(255,255,255,.1); } .dt-key:active { background: rgba(255,255,255,.16); }
.dt-key.op { font-weight: 700; color: ${STYLE.accent}; background: rgba(62,230,196,.12); } .dt-key.op:hover { background: rgba(62,230,196,.2); }
.dt-key.go { font-weight: 700; color: #05110f; background: ${STYLE.accent}; } .dt-key.go:hover { background: #6ff0d6; }
.dt-live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.dt-dockbg { position: absolute; border-radius: 18px; background: rgba(12,18,28,.82); box-shadow: inset 0 0 0 1px rgba(127,138,160,.18); }
.dt-icon { position: absolute; box-sizing: border-box; border-radius: 12px; padding: 0; background: #121a26; border: 1px solid rgba(127,138,160,.35); cursor: pointer; display: grid; place-items: center; }
.dt-icon.on { background: #16302f; border-color: ${STYLE.accent}; }
.dt-icon svg { width: 56%; height: 56%; fill: none; stroke: ${STYLE.ink}; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.dt-icon.on svg { stroke: ${STYLE.accent}; }
.dt-icon i { position: absolute; bottom: -7px; left: 50%; width: 4.4px; height: 4.4px; margin-left: -2.2px; border-radius: 50%; background: ${STYLE.dim}; }
.dt-icon.on i { background: ${STYLE.accent}; }
.dt-frame { position: absolute; overflow: hidden; border-radius: 8px; background: #05080d; }
.dt-frame p { position: absolute; left: 12px; right: 12px; top: 50%; margin: -10px 0 0; text-align: center; font-size: ${STYLE.small}px; line-height: 20px; color: ${STYLE.dim}; white-space: normal; }
.dt-frame iframe { position: absolute; left: 0; top: 0; border: 0; transform-origin: 0 0; color-scheme: normal; }
.dt-lock, .dt-gicon svg { position: absolute; fill: none; stroke: ${STYLE.dim}; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.dt-card { position: absolute; box-sizing: border-box; border-radius: 10px; background: rgba(255,255,255,.03); box-shadow: inset 0 0 0 1px ${STYLE.edge}; }
.dt-gicon { position: absolute; box-sizing: border-box; border-radius: 12px; background: #121a26; border: 1px solid rgba(127,138,160,.35); }
.dt-gicon svg { left: 22%; top: 22%; width: 56%; height: 56%; stroke: ${STYLE.ink}; }
.dt-pic { position: absolute; border-radius: 8px; background: #05080d; }
.dt-game { position: absolute; touch-action: none; cursor: crosshair; }
.dt.narrow .dt-title { cursor: default; position: sticky; z-index: 1; }
.dt.narrow .dt-win { overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; }
.dt.narrow .dt-term { white-space: pre-wrap; word-break: break-word; display: flex; flex-direction: column; justify-content: flex-end; }
.dt.narrow .dt-term div { height: auto; }
`;
// The narrow layout is designed at least this many desktop pixels wide and tall, then scaled to fit the view; a window
// whose rows run longer scrolls.
const NARROW_W = 540, NARROW_H = 360;

// `coarse`: a touch screen, whose command box and buttons along the bottom would cover the monitor, so it always gets
// the fitted layout between them.
export function makeDesktopView({ camera, meta, screens, act, tapTerminal, coarse = false, sfx = null }) {
  const D = screens.desktop;
  D.sfx = sfx;
  const css = document.createElement('style');
  css.textContent = CSS;
  document.head.append(css);
  const root = document.createElement('div');
  root.className = 'dt';
  root.setAttribute('role', 'application');
  root.setAttribute('aria-label', 'The computer on the desk');
  const hud = document.querySelector('.hud');
  hud ? hud.before(root) : document.body.append(root);
  // What a screen reader hears when the calculator's line changes. It sits outside the desktop, which is rebuilt on
  // every change: a line that is made anew each time is never read out.
  const live = document.createElement('div');
  live.className = 'dt-live'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
  root.after(live);

  // The curved screen's four corners: its edges curve toward me, so they sit a sagitta nearer than its middle.
  const s = meta.screens.main, c = b2t(...s.center), half = s.w / 2 / s.r;
  const chord = s.r * Math.sin(half), sag = s.r * (1 - Math.cos(half));
  const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([z, y]) => new THREE.Vector3(c.x - sag, c.y + y * s.h / 2, c.z + z * chord));
  const v = new THREE.Vector3();
  let shown = false, narrow = false, scale = 1, box = { w: W, h: H }, lastT = '', lastBox = '', drag = null, pending = false, notesEl = null;
  // A redraw replaces the buttons, so none happens while a finger or the mouse is down, or a click could miss.
  let down = false, typing = false, topFor = '', topY = 60;

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const px = n => `${Math.round(n * 100) / 100}px`;
  const place = (e, x, y, w, h) => { e.style.left = px(x); e.style.top = px(y); if (w != null) e.style.width = px(w); if (h != null) e.style.height = px(h); };
  const SVG = 'http://www.w3.org/2000/svg';
  function svgIcon(d) {
    const s = document.createElementNS(SVG, 'svg'); s.setAttribute('viewBox', '0 0 24 24');
    const p = document.createElementNS(SVG, 'path'); p.setAttribute('d', d); s.append(p);
    return s;
  }
  // In the narrow layout the window in front fills the space between the bar and the dock.
  const rectOf = w => (narrow ? { app: w.app, x: 0, y: BAR, w: box.w, h: box.h - BAR - DOCK } : w);

  // The browser's page. A frame taken out of the page and put back loads its page again, so the frame lives in a
  // holder of its own that the redraws leave in place; it is laid over the browser window's page area and stacked
  // just above that window. `frameAt` is that area, `frameOff` where it sits inside the window.
  const frameHost = el('div', 'dt-frame'), frameNote = el('p');
  frameHost.style.display = 'none';
  let frame = null, frameSite = null, frameAt = null, frameOff = null, frameK = 0;
  function loadFrame() {
    const site = siteById(D.browser.site), url = site && allowed(site.url, location.origin);
    frameHost.replaceChildren(frameNote);
    frame = null; frameSite = D.browser.site; frameK = 0;
    if (!url) { frameNote.textContent = 'This page cannot be shown here.'; return; }
    frameNote.textContent = `Loading ${new URL(url).host}`;
    const f = document.createElement('iframe');
    // Everything about the frame is settled before it has an address or a place on the page.
    f.setAttribute('sandbox', SANDBOX);
    f.setAttribute('allow', ALLOW);
    f.setAttribute('credentialless', '');
    f.setAttribute('referrerpolicy', 'no-referrer');
    f.title = site.title;
    // Loaded, a page with no background of its own sits on white, as in any browser.
    f.addEventListener('load', () => { f.style.background = '#fff'; });
    f.src = url;
    frameHost.append(f);
    frame = f;
    sizeFrame();
  }
  // The page is laid out at the size it really appears on the screen, then scaled to the window, so its writing is
  // as big as it would be in a real browser.
  function sizeFrame() {
    if (!frame || !frameAt) return;
    const k = Math.max(0.2, Math.round(scale * 100) / 100);
    if (k === frameK) return;
    frameK = k;
    frame.style.width = px(frameAt.w * k); frame.style.height = px(frameAt.h * k); frame.style.transform = `scale(${1 / k})`;
  }
  function dropFrame() { frameHost.replaceChildren(); frameHost.style.display = 'none'; frame = null; frameSite = null; frameAt = null; }

  // The game being played draws on one canvas that is carried over from redraw to redraw.
  let gameCanvas = null, gameArea = null, scoreEl = null, scoreW = 0, lastTick = 0;
  // `readerAt`: the story and page last shown, so a new one starts at the top of a scrolled window.
  let readerPic = null, readerAt = '', wallAt = '';
  document.fonts?.load("500 40px 'Noto Nastaliq Urdu'", 'زال و سیمرغ').then(() => { readerPic = null; D.changed(); }).catch(() => {});
  const G = D.games;
  function gamePoint(ev, kind) {
    if (!gameArea) return;
    const [x, y] = G.at(ev.offsetX, ev.offsetY, gameArea.w, gameArea.h);
    G.point(x, y, kind);
  }
  // Every finger (or mouse, or pen) down on the game counts, by its id and kind: lifting one while another is still
  // down does not let go.
  const fingers = new Map();
  function makeGameCanvas() {
    const c = el('canvas', 'dt-game');
    c.setAttribute('role', 'img');
    // Lifting is heard by the page itself (see `lift`), wherever the finger has wandered by then.
    c.addEventListener('pointerdown', ev => { fingers.set(ev.pointerId, ev.pointerType); c.setPointerCapture(ev.pointerId); gamePoint(ev, 'down'); });
    c.addEventListener('pointermove', ev => gamePoint(ev, 'move'));
    c.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse') gamePoint(ev, 'leave'); });
    return c;
  }
  function drawGame() {
    if (!G.playing || !gameCanvas?.isConnected || !gameArea) return;
    const k = scale * Math.min(2, devicePixelRatio || 1), cw = Math.max(1, Math.round(gameArea.w * k)), ch = Math.max(1, Math.round(gameArea.h * k));
    if (gameCanvas.width !== cw || gameCanvas.height !== ch) { gameCanvas.width = cw; gameCanvas.height = ch; }
    const g = gameCanvas.getContext('2d');
    g.clearRect(0, 0, cw, ch);
    G.draw(g, cw, ch);
    if (scoreEl) { const s = fit(G.status(), STYLE.small, scoreW); if (scoreEl.textContent !== s) scoreEl.textContent = s; }
  }
  // A still of each game on its card.
  function drawPic(c, id, w, h) {
    const k = scale * Math.min(2, devicePixelRatio || 1);
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    G.preview(c.getContext('2d'), id, c.width, c.height);
  }
  // The buttons that belong to the browser and the games are handled here; the rest go to the house.
  function press(a) {
    if (a.kind === 'site') {
      // The site already up starts again from its first page.
      if (a.arg === D.browser.site) frameSite = null;
      if (D.browserGo(a.arg) || frameSite === null) D.changed();
    } else if (a.kind === 'newtab') {
      const u = allowed(siteById(D.browser.site)?.url || '');
      if (u) act({ kind: 'link', arg: u });
    } else if (a.kind === 'game') {
      const [what, id, level] = a.arg.split(':');
      if (what === 'start') G.start(id, level);
      else if (what === 'again') G.again();
      else if (what === 'pause') G.pause();
      else if (what === 'back') G.stop();
      D.changed();
    } else if (a.kind === 'wallpaper') D.setWallpaper(a.arg);
    else if (a.kind === 'read' || a.kind === 'page') D.readerGo(`${a.kind}:${a.arg}`);
    else act(a);
  }
  // Text pieces and buttons, laid out by the pure layouts in window coordinates.
  function bits(e, L) {
    for (const t of L.texts) {
      const d = el('div', 'dt-t', t.s);
      d.style.fontSize = px(t.px); d.style.fontWeight = t.b; d.style.color = STYLE[t.c] || t.c;
      place(d, t.x, t.y - t.px * 0.86);
      e.append(d);
    }
    for (const p of L.pills) {
      const b = el('button', 'dt-pill' + (p.on ? ' on' : ''), p.label);
      b.tabIndex = -1;
      place(b, p.x, p.y, p.w, p.h);
      b.addEventListener('click', () => press(parseAct(p.act)));
      e.append(b);
    }
  }

  function windowEl(w, focused) {
    const r = rectOf(w), a = appById(w.app), e = el('div', 'dt-win' + (focused ? ' focus' : ''));
    e.dataset.app = w.app;
    place(e, r.x, r.y, r.w, r.h);
    const bar = el('div', 'dt-title');
    ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => {
      const d = el('button', 'dt-dot'); d.style.background = col; d.style.left = px(20 + i * 22 - 6.5);
      d.setAttribute('aria-label', i ? a.title : `Close ${a.title}`); d.tabIndex = -1;
      if (!i) d.addEventListener('click', () => { close(D.st, w.app); D.changed(); });
      bar.append(d);
    });
    bar.append(el('span', '', w.app === 'terminal' ? 'behbod@home: ~' : a.title));
    bar.addEventListener('pointerdown', e2 => {
      if (narrow || e2.target.classList.contains('dt-dot')) return;
      drag = { app: w.app, x: e2.clientX, y: e2.clientY, id: e2.pointerId, el: e };
      bar.setPointerCapture(e2.pointerId); bar.style.cursor = 'grabbing';
      // The browser's page is another document: a drag let go over it must still end here.
      frameHost.style.pointerEvents = 'none';
    });
    bar.addEventListener('pointermove', e2 => {
      if (!drag || e2.pointerId !== drag.id) return;
      move(D.st, drag.app, (e2.clientX - drag.x) / scale, (e2.clientY - drag.y) / scale);
      drag.x = e2.clientX; drag.y = e2.clientY;
      const m = find(D.st, drag.app); place(drag.el, m.x, m.y);
      if (drag.app === 'browser' && frameOff) { frameAt = { ...frameAt, x: m.x + frameOff.x, y: m.y + frameOff.y }; place(frameHost, frameAt.x, frameAt.y); }
      D.changed();
    });
    const end = e2 => { if (drag && e2.pointerId === drag.id) { drag = null; bar.style.cursor = ''; frameHost.style.pointerEvents = ''; if (!fingers.size) down = false; D.changed(); } };
    bar.addEventListener('pointerup', end); bar.addEventListener('pointercancel', end);
    e.append(bar);
    if (w.app === 'terminal') {
      const t = D.term, { lines, top } = termShown(t.lines, r.h), box2 = el('div', 'dt-term');
      // The first line's baseline sits `top` below the window's edge, as on the monitor.
      box2.style.top = px(top - STYLE.termLine / 2 - STYLE.term * 0.36);
      if (narrow) box2.style.bottom = px(PAD);
      for (const l of lines) { const d = el('div', '', l); d.style.color = l.startsWith('$') ? STYLE.accent : STYLE.ink; box2.append(d); }
      const inp = el('div', 'in', '$ ' + t.input);
      if (t.focus) inp.append(el('span', 'caret'));
      box2.append(inp);
      e.append(box2);
      e.addEventListener('click', () => tapTerminal?.());
    } else if (w.app === 'notes') {
      const ta = notesEl || el('textarea', 'dt-notes');
      notesEl = ta;
      ta.setAttribute('aria-label', 'Notes'); ta.spellcheck = false;
      if (document.activeElement !== ta) ta.value = D.notes;
      place(ta, PAD, TITLE + 11, r.w - 2 * PAD, r.h - TITLE - 22);
      e.append(ta);
    } else if (w.app === 'calc') {
      const d = calcShow(D.calc), L = calcLayout({ x: 0, y: 0, w: r.w, h: r.h }, d.main.length);
      const disp = el('div', 'dt-calc'), main = el('div', 'dt-calc-main' + (D.calc.error ? ' err' : ''), d.main);
      // A finished sum is read whole: its answer alone can read the same as the number typed last, and go unheard.
      const say = D.calc.done ? `${d.top} ${d.main}` : d.main;
      if (live.textContent !== say) live.textContent = say;
      const sum = el('div', 'dt-calc-top', tail(d.top, L.topPx, L.display.w - 28));
      main.style.fontSize = px(L.mainPx); sum.style.fontSize = px(L.topPx);
      place(disp, L.display.x, L.display.y, L.display.w, L.display.h);
      disp.append(sum, main);
      e.append(disp);
      for (const k of L.keys) {
        const b = el('button', 'dt-key ' + k.kind, k.label);
        b.tabIndex = -1; b.setAttribute('aria-label', CALC_NAME[k.key] || k.key);
        b.style.fontSize = px(L.keyPx);
        place(b, k.x, k.y, k.w, k.h);
        b.addEventListener('click', () => D.calcPress(k.key));
        e.append(b);
      }
    } else if (w.app === 'browser') {
      const L = browserLayout({ x: 0, y: 0, w: r.w, h: r.h }, D.browser.site);
      bits(e, L);
      if (L.lock) { const s = svgIcon(LOCK); s.setAttribute('class', 'dt-lock'); place(s, L.lock.x, L.lock.y, L.lock.size, L.lock.size); e.append(s); }
      frameOff = { x: L.page.x, y: L.page.y };
      frameAt = { x: r.x + L.page.x, y: r.y + L.page.y, w: L.page.w, h: L.page.h };
    } else if (w.app === 'games') {
      const p = G.playing, win = { x: 0, y: 0, w: r.w, h: r.h };
      if (p) {
        const L = playLayout(win, p.id, { state: p.done ? 'done' : p.paused ? 'paused' : 'play', touch: coarse, sideways: coarse && innerWidth > innerHeight });
        bits(e, L);
        scoreEl = el('div', 'dt-t'); scoreEl.style.fontSize = px(L.score.px); scoreEl.style.color = STYLE.ink; scoreW = L.score.w;
        place(scoreEl, L.score.x, L.score.y - L.score.px * 0.86);
        gameCanvas ||= makeGameCanvas();
        gameCanvas.setAttribute('aria-label', gameById(p.id).title);
        gameArea = L.area;
        place(gameCanvas, L.area.x, L.area.y, L.area.w, L.area.h);
        e.append(scoreEl, gameCanvas);
      } else {
        const L = launcherLayout(win, G.bests);
        for (const c of L.cards) {
          const card = el('div', 'dt-card'); place(card, c.x, c.y, c.w, c.h);
          const ic = el('div', 'dt-gicon'); place(ic, c.icon.x, c.icon.y, c.icon.size, c.icon.size); ic.append(svgIcon(gameById(c.id).icon));
          e.append(card, ic);
          if (c.pic) { const pc = el('canvas', 'dt-pic'); place(pc, c.pic.x, c.pic.y, c.pic.w, c.pic.h); drawPic(pc, c.id, c.pic.w, c.pic.h); e.append(pc); }
        }
        bits(e, L);
      }
    } else if (w.app === 'shahnameh') {
      // On a phone the window scrolls, so the story runs on in one piece under its picture.
      const L = readerLayout({ x: 0, y: 0, w: r.w, h: r.h }, D.reader, { scroll: narrow }), P = L.pic;
      const k = scale * Math.min(2, devicePixelRatio || 1), key = `${L.story} ${P.w} ${P.h} ${k}`;
      if (!readerPic || readerPic.key !== key) {
        const c = el('canvas', 'dt-pic');
        c.width = Math.max(1, Math.round(P.w * k)); c.height = Math.max(1, Math.round(P.h * k));
        const g = c.getContext('2d'); g.scale(c.width / P.w, c.height / P.h); paintStory(g, L.story, P.w, P.h);
        c.setAttribute('role', 'img'); c.setAttribute('aria-label', storyById(L.story).pic);
        readerPic = { key, c };
      }
      place(readerPic.c, P.x, P.y, P.w, P.h);
      e.append(readerPic.c);
      bits(e, L);
      if (narrow) { const end = el('div'); place(end, 0, L.bottom + PAD, 1, 1); e.append(end); }
    } else bits(e, layout({ x: 0, y: 0, w: r.w, h: r.h }, rows(w.app, D.ctx)));
    e.addEventListener('pointerdown', () => { if (D.st.focus !== w.app || D.st.wins.at(-1)?.app !== w.app) { open(D.st, w.app); D.changed(); } });
    return e;
  }

  function render() {
    pending = false;
    if (!shown || drag) return;
    const keepFocus = document.activeElement === notesEl, sel = keepFocus ? [notesEl.selectionStart, notesEl.selectionEnd] : null;
    // A window scrolled down stays where it was when the page is rebuilt.
    const scrolled = {};
    for (const e of root.querySelectorAll('.dt-win')) if (e.scrollTop) scrolled[e.dataset.app] = e.scrollTop;
    // Everything is made anew but the browser's page, which stays where it is (see frameHost).
    for (const c of [...root.children]) if (c !== frameHost) c.remove();
    if (frameHost.parentNode !== root) root.prepend(frameHost);
    // Windows stack in their order; the bar and the dock stay over them all.
    const over = e => { e.style.zIndex = 1000; return e; };
    const bar = el('div', 'dt-bar');
    bar.append(el('b', '', 'home'), el('span', 'ttl', D.st.focus ? appById(D.st.focus).title : ''), el('span', 'clk', D.ctx.clock || ''));
    root.append(over(bar));
    const top = D.st.wins.at(-1)?.app;
    const list = narrow ? D.st.wins.filter(w => w.app === top) : D.st.wins;
    if (!list.some(w => w.app === 'notes')) notesEl = null;
    if (!list.some(w => w.app === 'games')) { gameCanvas?.remove(); gameArea = null; scoreEl = null; }
    frameAt = null;
    const url = D.wallpaperURL() || '';
    if (url !== wallAt) { wallAt = url; root.style.background = url ? `#070b11 url("${url}") center / cover no-repeat` : ''; }
    const readerNow = `${D.reader.story} ${D.reader.page}`, readerKept = readerNow === readerAt;
    readerAt = readerNow;
    list.forEach((w, i) => {
      const e = windowEl(w, w.app === top && w.app === D.st.focus);
      e.style.zIndex = 2 * i + 1;
      root.append(e);
      if (scrolled[w.app] && (w.app !== 'shahnameh' || readerKept)) e.scrollTop = scrolled[w.app];
      if (w.app === 'browser') frameHost.style.zIndex = 2 * i + 2;
    });
    // The game's picture is drawn now it is on the page, not a frame later from an old picture.
    drawGame();
    // The page shows while its window is on the desktop, and is let go when the window is closed.
    if (!D.st.wins.some(w => w.app === 'browser')) dropFrame();
    else if (!frameAt) frameHost.style.display = 'none';
    else {
      place(frameHost, frameAt.x, frameAt.y, frameAt.w, frameAt.h);
      frameHost.style.display = '';
      if (frameSite !== D.browser.site) loadFrame();
      frameK = 0; sizeFrame();
    }
    const icons = dock(box.w, box.h), f = icons[0], l = icons.at(-1);
    const bg = el('div', 'dt-dockbg'); place(bg, f.x - 14, f.y - 7, l.x + l.size - f.x + 28, f.size + 14); root.append(over(bg));
    for (const d of icons) {
      const a = appById(d.app), b = el('button', 'dt-icon' + (d.app === D.st.focus ? ' on' : ''));
      b.tabIndex = -1; b.title = a.title; b.setAttribute('aria-label', `Open ${a.title}`);
      place(b, d.x, d.y, d.size, d.size);
      b.append(svgIcon(a.icon));
      if (D.st.wins.some(w => w.app === d.app)) b.append(el('i'));
      b.addEventListener('click', () => { open(D.st, d.app); D.changed(); });
      root.append(over(b));
    }
    if (keepFocus && notesEl) { notesEl.focus(); notesEl.setSelectionRange(...sel); }
  }
  // While the notes are being typed in, the page is not rebuilt (that would drop a phone's keyboard); only the clock
  // ticks over, and the rest catches up when they lose focus.
  const want = () => {
    if (!shown || pending || down) return;
    if (notesEl && document.activeElement === notesEl) { const clk = root.querySelector('.clk'); if (clk) clk.textContent = D.ctx.clock || ''; return; }
    pending = true; requestAnimationFrame(render);
  };
  // Typing in the notes repaints the monitor but leaves the page alone, so the caret stays put.
  D.listen(() => { if (typing) { typing = false; return; } want(); });
  // The last finger off the game lets it go. While one is still on it nothing is redrawn, as a redraw would take the
  // game's picture from under that finger. The first press of a kind (a new touch, the mouse, a pen) means none of
  // that kind is still down, so any of that kind still counted was lost along the way and is let go.
  const lift = e => {
    if (fingers.delete(e.pointerId) && !fingers.size) G.point(NaN, NaN, 'up');
    if (!fingers.size && down) { down = false; want(); }
  };
  addEventListener('pointerdown', e => {
    if (!e.isPrimary) return;
    let lost = false;
    for (const [id, kind] of fingers) if (kind === e.pointerType) { fingers.delete(id); lost = true; }
    if (lost && !fingers.size) G.point(NaN, NaN, 'up');
  }, true);
  addEventListener('pointerup', lift, true);
  addEventListener('pointercancel', lift, true);

  // Clicks and drags on the desktop stay on it; only the notes may take the keyboard's focus.
  // Marked before any window's own handler runs, so focusing a back window cannot rebuild the page under the click.
  root.addEventListener('pointerdown', () => { down = true; }, true);
  root.addEventListener('focusout', e => { if (e.target === notesEl) requestAnimationFrame(want); });
  root.addEventListener('pointerdown', e => { e.stopPropagation(); down = true; if (e.target.tagName !== 'TEXTAREA') { e.preventDefault(); if (document.activeElement === notesEl) notesEl.blur(); } });
  root.addEventListener('input', e => { if (e.target === notesEl) { typing = true; D.notes = notesEl.value; } });
  root.addEventListener('keydown', e => { if (e.target === notesEl && e.key === 'Escape') { notesEl.blur(); e.stopPropagation(); } });
  root.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
  // A click on the desktop takes the keyboard back from the browser's page; a click into the page (whose own clicks
  // never reach the house) brings the browser to the front.
  root.addEventListener('pointerdown', () => { if (frame && document.activeElement === frame) { frame.blur(); window.focus(); } }, true);
  addEventListener('blur', () => setTimeout(() => {
    if (shown && frame && document.activeElement === frame && (D.st.focus !== 'browser' || D.st.wins.at(-1)?.app !== 'browser')) { open(D.st, 'browser'); D.changed(); }
  }));
  // While a game is in front its keys are its own: none of them types into the terminal or reaches the rest of the
  // house (this runs before the house's own key handler). Esc still stands up, and shortcuts stay the browser's.
  addEventListener('keydown', e => {
    if (!shown || D.st.focus !== 'games' || !G.playing || e.ctrlKey || e.metaKey || e.altKey || e.key === 'Escape') return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const was = G.playing.paused, used = G.key(e.code, true, e.repeat);
    // P flips the pause, and the button over the game says which it is.
    if (G.playing.paused !== was) D.changed();
    if (used || e.key.length === 1 || e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  addEventListener('keyup', e => { G.key(e.code, false); }, true);
  // Losing the window loses every press with it: none of them will be heard lifting. A window being dragged stays
  // where it got to.
  addEventListener('blur', () => {
    G.release(); fingers.clear();
    const dragged = !!drag;
    if (drag) { drag = null; frameHost.style.pointerEvents = ''; }
    if (down || dragged) { down = false; want(); }
  });

  // Lays the desktop on the screen as the camera sees it, or across the view when the screen does not fit.
  function fitView() {
    const pts = corners.map(p => { v.copy(p).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; });
    const wide = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
    const fits = !coarse && pts.every(([x, y]) => x > -2 && x < innerWidth + 2 && y > -2 && y < innerHeight + 2) && wide >= 760;
    let tf;
    if (fits) {
      const m = homography(W, H, pts);
      if (!m) return;
      box = { w: W, h: H }; scale = wide / W;
      tf = `matrix3d(${m.map(n => +n.toFixed(9)).join(',')})`;
    } else {
      // Below the row of buttons in the corner, which wraps onto more lines on a narrow phone.
      if (topFor !== `${innerWidth}x${innerHeight}`) { topFor = `${innerWidth}x${innerHeight}`; topY = Math.max(60, (document.querySelector('.corner')?.getBoundingClientRect().bottom || 52) + 8); }
      const left = 10, top = topY, w = innerWidth - 20, h = Math.max(200, innerHeight - top - 150);
      scale = Math.min(w / NARROW_W, h / NARROW_H);
      box = { w: w / scale, h: h / scale };
      tf = `translate(${left}px, ${top}px) scale(${scale})`;
    }
    if (fits === narrow) { narrow = !fits; root.classList.toggle('narrow', narrow); }
    if (tf !== lastT) { lastT = tf; root.style.transform = tf; }
    const bk = `${narrow} ${box.w} ${box.h}`;
    if (bk !== lastBox) { lastBox = bk; root.style.width = px(box.w); root.style.height = px(box.h); want(); }
  }

  return {
    // `active`: I am seated and the camera has settled on the screen.
    tick(active) {
      if (active && !shown) {
        shown = true; lastT = ''; lastBox = '';
        root.style.display = 'block';
        D.covered = true;
        fitView();
        render();
        requestAnimationFrame(() => root.classList.add('on'));
      } else if (!active && shown) {
        shown = false; drag = null; frameHost.style.pointerEvents = '';
        notesEl?.blur(); notesEl = null;
        // Standing up pauses the game and lets the browser's page go.
        if (G.pause(true)) D.changed();
        dropFrame(); gameArea = null; scoreEl = null; fingers.clear();
        root.classList.remove('on'); root.style.display = 'none'; root.replaceChildren();
        live.textContent = '';
        D.covered = false;
      }
      const now = performance.now(), dt = (now - lastTick) / 1000;
      lastTick = now;
      if (!shown) return;
      fitView();
      sizeFrame();
      // A game waits while its window is not the one in front.
      if (G.playing && D.st.focus !== 'games' && G.pause(true)) D.changed();
      G.tick(dt);
      drawGame();
    },
    get shown() { return shown; },
    get narrow() { return narrow; },
  };
}
