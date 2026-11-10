import * as THREE from 'three';
import { b2t } from './engine.js';
import { W, H, BAR, DOCK, TITLE, PAD, STYLE, appById, dock, rows, layout, open, close, move, find, parseAct, termShown } from './pure/desktop.js';
import { homography } from './pure/homography.js';

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
.dt-dockbg { position: absolute; border-radius: 18px; background: rgba(12,18,28,.82); box-shadow: inset 0 0 0 1px rgba(127,138,160,.18); }
.dt-icon { position: absolute; box-sizing: border-box; border-radius: 12px; padding: 0; background: #121a26; border: 1px solid rgba(127,138,160,.35); cursor: pointer; display: grid; place-items: center; }
.dt-icon.on { background: #16302f; border-color: ${STYLE.accent}; }
.dt-icon svg { width: 56%; height: 56%; fill: none; stroke: ${STYLE.ink}; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.dt-icon.on svg { stroke: ${STYLE.accent}; }
.dt-icon i { position: absolute; bottom: -7px; left: 50%; width: 4.4px; height: 4.4px; margin-left: -2.2px; border-radius: 50%; background: ${STYLE.dim}; }
.dt-icon.on i { background: ${STYLE.accent}; }
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
export function makeDesktopView({ camera, meta, screens, act, tapTerminal, coarse = false }) {
  const D = screens.desktop;
  const css = document.createElement('style');
  css.textContent = CSS;
  document.head.append(css);
  const root = document.createElement('div');
  root.className = 'dt';
  root.setAttribute('role', 'application');
  root.setAttribute('aria-label', 'The computer on the desk');
  const hud = document.querySelector('.hud');
  hud ? hud.before(root) : document.body.append(root);

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
    });
    bar.addEventListener('pointermove', e2 => {
      if (!drag || e2.pointerId !== drag.id) return;
      move(D.st, drag.app, (e2.clientX - drag.x) / scale, (e2.clientY - drag.y) / scale);
      drag.x = e2.clientX; drag.y = e2.clientY;
      const m = find(D.st, drag.app); place(drag.el, m.x, m.y);
      D.changed();
    });
    const end = e2 => { if (drag && e2.pointerId === drag.id) { drag = null; bar.style.cursor = ''; down = false; D.changed(); } };
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
    } else {
      const L = layout({ x: 0, y: 0, w: r.w, h: r.h }, rows(w.app, D.ctx));
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
        b.addEventListener('click', () => act(parseAct(p.act)));
        e.append(b);
      }
    }
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
    root.replaceChildren();
    const bar = el('div', 'dt-bar');
    bar.append(el('b', '', 'home'), el('span', 'ttl', D.st.focus ? appById(D.st.focus).title : ''), el('span', 'clk', D.ctx.clock || ''));
    root.append(bar);
    const top = D.st.wins.at(-1)?.app;
    const list = narrow ? D.st.wins.filter(w => w.app === top) : D.st.wins;
    if (!list.some(w => w.app === 'notes')) notesEl = null;
    for (const w of list) { const e = windowEl(w, w.app === top && w.app === D.st.focus); root.append(e); if (scrolled[w.app]) e.scrollTop = scrolled[w.app]; }
    const icons = dock(box.w, box.h), f = icons[0], l = icons.at(-1);
    const bg = el('div', 'dt-dockbg'); place(bg, f.x - 14, f.y - 7, l.x + l.size - f.x + 28, f.size + 14); root.append(bg);
    for (const d of icons) {
      const a = appById(d.app), b = el('button', 'dt-icon' + (d.app === D.st.focus ? ' on' : ''));
      b.tabIndex = -1; b.title = a.title; b.setAttribute('aria-label', `Open ${a.title}`);
      place(b, d.x, d.y, d.size, d.size);
      b.append(svgIcon(a.icon));
      if (D.st.wins.some(w => w.app === d.app)) b.append(el('i'));
      b.addEventListener('click', () => { open(D.st, d.app); D.changed(); });
      root.append(b);
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
  addEventListener('pointerup', () => { if (down) { down = false; want(); } }, true);
  addEventListener('pointercancel', () => { if (down) { down = false; want(); } }, true);

  // Clicks and drags on the desktop stay on it; only the notes may take the keyboard's focus.
  // Marked before any window's own handler runs, so focusing a back window cannot rebuild the page under the click.
  root.addEventListener('pointerdown', () => { down = true; }, true);
  root.addEventListener('focusout', e => { if (e.target === notesEl) requestAnimationFrame(want); });
  root.addEventListener('pointerdown', e => { e.stopPropagation(); down = true; if (e.target.tagName !== 'TEXTAREA') { e.preventDefault(); if (document.activeElement === notesEl) notesEl.blur(); } });
  root.addEventListener('input', e => { if (e.target === notesEl) { typing = true; D.notes = notesEl.value; } });
  root.addEventListener('keydown', e => { if (e.target === notesEl && e.key === 'Escape') { notesEl.blur(); e.stopPropagation(); } });
  root.addEventListener('wheel', e => e.stopPropagation(), { passive: true });

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
        shown = false; drag = null;
        notesEl?.blur(); notesEl = null;
        root.classList.remove('on'); root.style.display = 'none'; root.replaceChildren();
        D.covered = false;
      }
      if (shown) fitView();
    },
    get shown() { return shown; },
    get narrow() { return narrow; },
  };
}
