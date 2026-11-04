// Shared pieces for the game overlays: the stylesheet, a tiny element builder, canvas sizing and the end card.
export const ACCENT = '#3ee6c4', INK = '#e8edf5', DIM = '#8a93a6', BAD = '#ff6b7a', PURPLE = '#b49cff';
export const MONO = "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace";

const CSS = `
.g-overlay { position: fixed; inset: 0; z-index: 60; display: flex; flex-direction: column; background: rgba(5,7,11,.92);
  color: ${INK}; font-family: ${MONO}; font-size: 13px; line-height: 1.4; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain;
  -webkit-tap-highlight-color: transparent; -webkit-user-select: none; user-select: none; opacity: 0; transition: opacity .18s;
  padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px); }
.g-overlay.g-on { opacity: 1; }
.g-overlay:focus { outline: none; }
.g-overlay *, .g-overlay *::before, .g-overlay *::after { box-sizing: border-box; }
.g-head { flex: none; display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid rgba(62,230,196,.16); }
.g-title { font-weight: 700; letter-spacing: .16em; color: ${ACCENT}; white-space: nowrap; font-size: 13px; }
.g-score { flex: 1; min-width: 0; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13px; }
.g-score b { color: ${ACCENT}; font-weight: 700; margin: 0 4px; }
.g-body { flex: 1; min-height: 0; position: relative; display: flex; flex-direction: column; }
.g-btn { font: inherit; font-size: 12px; color: ${INK}; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.16);
  border-radius: 8px; padding: 8px 14px; min-height: 36px; cursor: pointer; white-space: nowrap; transition: border-color .15s, color .15s, background .15s; }
.g-btn:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 2px; }
.g-btn:disabled { opacity: .35; cursor: default; }
.g-btn.g-main { background: ${ACCENT}; border-color: ${ACCENT}; color: #05070b; font-weight: 700; }
.g-btn.g-main:disabled { background: transparent; color: ${ACCENT}; border-color: rgba(62,230,196,.5); }
@media (hover: hover) { .g-btn:hover:not(:disabled) { border-color: ${ACCENT}; color: ${ACCENT}; } .g-btn.g-main:hover:not(:disabled) { color: #05070b; background: #6af0d5; } }
.g-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.g-dim { color: ${DIM}; }
.g-card-wrap { position: absolute; inset: 0; display: grid; place-items: center; padding: 16px; background: rgba(5,7,11,.55); z-index: 3;
  animation: g-fade .2s ease-out; }
.g-card { width: min(340px, 100%); padding: 22px 20px 18px; border-radius: 8px; background: rgba(8,12,18,.96); border: 1px solid rgba(62,230,196,.45);
  box-shadow: 0 0 40px rgba(62,230,196,.12); text-align: center; animation: g-pop .28s cubic-bezier(.2,1.4,.4,1); }
.g-card h2 { margin: 0 0 6px; font-size: 20px; letter-spacing: .12em; color: ${ACCENT}; }
.g-card.g-bad h2 { color: ${BAD}; }
.g-card p { margin: 0 0 16px; color: ${DIM}; }
.g-card .g-row { justify-content: center; }
.g-stage { position: relative; flex: 1; min-height: 0; }
.g-stage canvas { position: absolute; left: 0; top: 0; display: block; touch-action: none; }
@keyframes g-fade { from { opacity: 0; } }
@keyframes g-pop { from { transform: scale(.88); opacity: 0; } }
@media (max-width: 560px) { .g-head { padding: 8px 10px; gap: 8px; } .g-title { font-size: 12px; letter-spacing: .1em; } .g-score { font-size: 12px; } }
@media (prefers-reduced-motion: reduce) { .g-card, .g-card-wrap { animation: none; } }
`;

let injected = false;
export function injectStyles(extra = '') {
  if (!injected) {
    const st = document.createElement('style');
    st.dataset.games = '';
    st.textContent = CSS;
    document.head.append(st);
    injected = true;
  }
  if (extra && !document.querySelector(`style[data-games="${extra.id}"]`)) {
    const st = document.createElement('style');
    st.dataset.games = extra.id;
    st.textContent = extra.css;
    document.head.append(st);
  }
}

export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k);
  return e;
}

export const button = (text, onclick, cls = '') => h('button', { class: `g-btn ${cls}`.trim(), type: 'button', text, onclick });

// Sizes a canvas to its box at the screen's pixel density; returns the drawing size in CSS pixels.
export function fit(canvas, w, h) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w, h, dpr };
}

export function endCard(parent, { title, text, good = true, again, close }) {
  const wrap = h('div', { class: 'g-card-wrap' },
    h('div', { class: `g-card${good ? '' : ' g-bad'}`, role: 'alertdialog', 'aria-label': title },
      h('h2', { text: title }), h('p', { text }),
      h('div', { class: 'g-row' }, button('Play again', () => { wrap.remove(); again(); }, 'g-main'), button('Close', close))));
  parent.append(wrap);
  wrap.querySelector('.g-main').focus({ preventScroll: true });
  return wrap;
}

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
