// The kit pick, remembered in this browser, and the swatches on the games' start cards.
import { KITS, kitById } from './pure/kits.js';
import { h, injectStyles, ACCENT, DIM } from './ui.js';

const KEY = 'loft.kit';
const STYLE = { id: 'kit', css: `
.g-kit { margin: 0 0 14px; }
.g-kit-name { font-size: 11px; color: ${DIM}; letter-spacing: .06em; margin-bottom: 7px; }
.g-kit-row { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
.g-kit-sw { width: 32px; height: 32px; padding: 0; border-radius: 50%; border: 1px solid rgba(255,255,255,.3); cursor: pointer; flex: none;
  transition: transform .12s, box-shadow .12s; }
.g-kit-sw[aria-pressed="true"] { box-shadow: 0 0 0 2px #05070b, 0 0 0 4px ${ACCENT}; transform: scale(1.06); }
.g-kit-sw:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 4px; }
@media (hover: hover) { .g-kit-sw:hover { transform: scale(1.1); } }
@media (pointer: coarse) { .g-kit-sw { width: 38px; height: 38px; } }
` };

let current = null;
export function kitId() {
  if (current) return current;
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { saved = null; }
  return (current = kitById(saved).id);
}
export function setKit(id) {
  current = kitById(id).id;
  try { localStorage.setItem(KEY, current); } catch (e) { /* kept for this visit only */ }
  return current;
}

function show(row) {
  const id = kitId();
  row.querySelector('.g-kit-name').textContent = `Your kit: ${kitById(id).name}`;
  for (const s of row.querySelectorAll('.g-kit-sw')) s.setAttribute('aria-pressed', String(s.dataset.kit === id));
}

// Picking in one row updates every row on the page.
export function kitRow() {
  injectStyles(STYLE);
  const swatches = KITS.map(k => h('button', {
    class: 'g-kit-sw', type: 'button', title: k.name, 'aria-label': `${k.name} kit`, 'data-kit': k.id,
    style: `background: linear-gradient(135deg, ${k.shirt} 0 60%, ${k.trim} 60% 100%)`,
    onclick: () => { setKit(k.id); document.querySelectorAll('.g-kit').forEach(show); },
  }));
  const row = h('div', { class: 'g-kit' }, h('div', { class: 'g-kit-name' }), h('div', { class: 'g-kit-row', role: 'group', 'aria-label': 'BEHI FC kit' }, swatches));
  show(row);
  return row;
}
