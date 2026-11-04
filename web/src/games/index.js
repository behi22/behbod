// The loft's mini games as full-screen overlays. Each game loads only when it is first opened.
import { injectStyles, h, button } from './ui.js';

const GAMES = {
  striker: { title: 'STRIKER 22', load: () => import('./striker.js') },
  holochess: { title: 'HOLOCHESS', load: () => import('./holochess.js') },
  backgammon: { title: 'BACKGAMMON', load: () => import('./backgammon.js') },
};

let current = null;
export const isGameOpen = () => !!(current && current.open);

export function openGame(name, { onClose, onEvent } = {}) {
  const def = GAMES[name];
  if (!def) throw new Error(`Unknown game "${name}". Use striker, holochess or backgammon.`);
  if (current) current.close();
  injectStyles();

  const before = document.activeElement;
  const score = h('div', { class: 'g-score', 'aria-live': 'polite' });
  const body = h('div', { class: 'g-body' }, h('div', { class: 'g-stage' }, h('p', { class: 'g-dim', style: 'text-align:center;margin-top:30vh', text: 'Loading' })));
  const root = h('div', { class: 'g-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': def.title, tabindex: '-1', oncontextmenu: e => e.preventDefault() },
    h('div', { class: 'g-head' }, h('div', { class: 'g-title', text: def.title }), score, button('Close', () => handle.close())),
    body);

  let open = true, game = null, shown = '';
  const emit = (type, data = {}) => {
    if (!open || !onEvent) return;
    try { onEvent(type, { game: name, ...data }); } catch (err) { console.error(err); }
  };
  const api = {
    emit,
    score(you, them) {
      if (shown === `${you}:${them}`) return;
      shown = `${you}:${them}`;
      score.replaceChildren('You', h('b', { text: `${you} : ${them}` }), 'Bot');
      emit('score', { you, them });
    },
    close: () => handle.close(),
  };
  // Capture phase on window runs before the loft's own key handlers, so stopping here keeps the loft still.
  const onKeyDown = e => {
    if (!open) return;
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); handle.close(); return; }
    if (game && game.key) game.key(e);
  };
  const onKeyUp = e => { if (open && game && game.keyup) game.keyup(e); };
  addEventListener('keydown', onKeyDown, true);
  addEventListener('keyup', onKeyUp, true);

  const handle = {
    close() {
      if (!open) return;
      open = false;
      removeEventListener('keydown', onKeyDown, true);
      removeEventListener('keyup', onKeyUp, true);
      try { game && game.destroy(); } catch (err) { console.error(err); }
      root.remove();
      if (current === handle) current = null;
      if (before && before.isConnected && typeof before.focus === 'function') before.focus({ preventScroll: true });
      if (onClose) try { onClose(); } catch (err) { console.error(err); }
    },
    get open() { return open; },
  };
  current = handle;

  document.body.append(root);
  root.focus({ preventScroll: true });
  requestAnimationFrame(() => root.classList.add('g-on'));
  def.load().then(m => {
    if (!open) return;
    body.replaceChildren();
    game = m.mount(body, api);
  }).catch(err => {
    console.error(err);
    if (open) body.replaceChildren(h('p', { class: 'g-dim', style: 'text-align:center;margin-top:30vh', text: 'This game could not load. Close it and try again.' }));
  });
  return handle;
}
