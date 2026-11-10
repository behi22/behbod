// The loft's mini games as full-screen overlays. Each game loads only when it is first opened.
import { injectStyles, h, button } from './ui.js';

const GAMES = {
  // The arcade cabinet's own menu: its two games side by side.
  arcade: { title: 'ARCADE', menu: [['skills', 'Skills Shooter', 'The Claude game. Shoot the skills, dodge the bugs, catch Claude.'], ['striker', 'Striker 22', 'Five penalties to take, five to save, then sudden death.']] },
  // The TV's menu: join the live match in either role, or put my videos on instead.
  tv: { title: 'MATCH NIGHT', menu: [['match-striker', 'Join as striker', 'Ninety seconds up front for BEHI FC. Score what you can.'], ['match-keeper', 'Join as keeper', 'Ninety seconds in goal. The bots are coming.'], ['@videos', 'Watch my videos', 'Switch the TV over to my channel.']] },
  'match-striker': { title: 'MATCH NIGHT', load: () => import('./match.js').then(m => ({ mount: (b, api) => m.mount(b, api, 'striker') })) },
  'match-keeper': { title: 'MATCH NIGHT', load: () => import('./match.js').then(m => ({ mount: (b, api) => m.mount(b, api, 'keeper') })) },
  skills: { title: 'SKILLS SHOOTER', load: () => import('./skills.js') },
  striker: { title: 'STRIKER 22', load: () => import('./striker.js') },
  holochess: { title: 'HOLOCHESS', load: () => import('./holochess.js') },
  backgammon: { title: 'BACKGAMMON', load: () => import('./backgammon.js') },
};

let current = null;
export const isGameOpen = () => !!(current && current.open);

export function openGame(name, { onClose, onEvent, actions = {} } = {}) {
  const def = GAMES[name];
  if (!def) throw new Error(`Unknown game "${name}". Use ${Object.keys(GAMES).join(', ')}.`);
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
  if (def.menu) {
    // A menu hands over to the game picked: that game opens in place of the menu, with the same hooks.
    body.replaceChildren(h('div', { class: 'g-menu' }, def.menu.map(([id, title, line]) =>
      h('div', { class: 'g-card g-pick' }, h('h2', { text: title }), h('p', { text: line }),
        h('div', { class: 'g-row' }, button(id.startsWith('@') ? 'Go' : 'Play', () => {
          // An entry starting with @ is not a game: it closes the menu and hands back to the room.
          if (id.startsWith('@')) { handle.close(); actions[id.slice(1)]?.(); } else openGame(id, { onClose, onEvent, actions });
        }, 'g-main'))))));
    body.querySelector('.g-main')?.focus({ preventScroll: true });
    return handle;
  }
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
