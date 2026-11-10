// Joining the match on the TV: ninety seconds as BEHI FC's striker (score what you can) or keeper (save what you can),
// in the same five-a-side the TV shows. The match itself lives in pure/match.js; this steers one player and draws it.
import { newMatch, stepMatch } from '../pure/match.js';
import { drawMatch, makeCamera, follow } from './matchdraw.js';
import { h, button, fit, endCard, injectStyles, DIM } from './ui.js';

const STYLE = { id: 'match', css: `
.g-mt-hud { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 8px 14px; flex-wrap: wrap; padding: 8px 16px 6px; }
.g-mt-tip { font-size: 12px; color: ${DIM}; flex: 1 1 260px; }
.g-mt-pad { flex: none; display: none; gap: 10px; justify-content: space-between; padding: 8px 12px 12px; }
.g-mt-pad .g-btn { min-height: 52px; min-width: 52px; font-size: 16px; touch-action: none; }
@media (pointer: coarse) { .g-mt-pad { display: flex; } }
` };
const TIME = 90, STEP = 1 / 60;

export function mount(body, api, mode = 'striker') {
  injectStyles(STYLE);
  const stage = h('div', { class: 'g-stage' }), canvas = h('canvas', { 'aria-label': `The match, playing as ${mode}` });
  stage.append(canvas);
  const tip = h('div', { class: 'g-mt-tip' }), tally = h('div', { class: 'g-mt-tally' });
  const keeper = mode === 'keeper';
  tip.textContent = keeper ? 'Arrows or WASD to move along your line, Space to dive, E to throw it out.' : 'Arrows or WASD to run, Space to shoot, Shift or E to pass.';
  // Touch: a direction pad on the left, the actions on the right; each holds while pressed.
  const held = { left: false, right: false, up: false, down: false, shoot: false, pass: false, dive: false };
  const hold = (label, key) => {
    const b = button(label, () => {});
    const on = v => e => { e.preventDefault(); held[key] = v; };
    b.addEventListener('pointerdown', on(true)); b.addEventListener('pointerup', on(false)); b.addEventListener('pointerleave', on(false)); b.addEventListener('pointercancel', on(false));
    return b;
  };
  const pad = h('div', { class: 'g-mt-pad' },
    h('div', { class: 'g-row' }, hold('◀', 'left'), hold('▲', 'up'), hold('▼', 'down'), hold('▶', 'right')),
    h('div', { class: 'g-row' }, keeper ? [hold('Throw', 'pass'), hold('Dive', 'dive')] : [hold('Pass', 'pass'), hold('Shoot', 'shoot')]));
  body.append(h('div', { class: 'g-mt-hud' }, tip, tally), stage, pad);

  let m, you, cam, left, goals, saves, conceded, over, raf = 0, last = performance.now(), acc = 0, card = null, view = null, banner = '', bannerT = 0;
  const keys = new Set();
  // Switching away mid-press never sends the key up, so let go of everything when the page loses focus.
  const release = () => { keys.clear(); for (const k of Object.keys(held)) held[k] = false; };
  addEventListener('blur', release);
  function start() {
    card?.remove(); card = null;
    m = newMatch({ kickoff: keeper ? 1 : 0 });
    // As keeper the bots come at you; as striker their keeper is a touch slower to react.
    m.aggro = keeper ? [0.6, 1.5] : [1.15, 0.9];
    you = m.players.find(p => p.team === 0 && (keeper ? p.role === 'keeper' : p.num === 22));
    cam = makeCamera(); cam.x = keeper ? -10 : 0;
    left = TIME; goals = 0; saves = 0; conceded = 0; over = false;
    show();
  }
  function show() {
    tally.textContent = keeper ? `${saves} saved, ${conceded} let in  ·  ${Math.ceil(left)}s` : `${goals} scored  ·  ${Math.ceil(left)}s`;
  }
  function finish() {
    over = true;
    const good = keeper ? saves >= 3 && conceded <= 1 : goals >= 2;
    if (good) api.emit('win', { mode });
    const text = keeper ? `You saved ${saves} and let in ${conceded}.` : `You scored ${goals} in ninety seconds.`;
    card = endCard(stage, { title: good ? (keeper ? 'WHAT A KEEPER' : 'WHAT A STRIKER') : 'FULL TIME', text, good, again: start, close: api.close });
  }
  function layout() { const r = stage.getBoundingClientRect(); view = fit(canvas, r.width, r.height); }
  const ro = new ResizeObserver(layout);
  ro.observe(stage);
  layout();

  const pressed = (...codes) => codes.some(c => keys.has(c));
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!over) {
      left = Math.max(0, left - dt);
      acc += dt;
      while (acc >= STEP) {
        acc -= STEP;
        const dx = (pressed('ArrowRight', 'KeyD') || held.right ? 1 : 0) - (pressed('ArrowLeft', 'KeyA') || held.left ? 1 : 0);
        const dy = (pressed('ArrowUp', 'KeyW') || held.up ? 1 : 0) - (pressed('ArrowDown', 'KeyS') || held.down ? 1 : 0);
        const act = pressed('Space') || held.shoot || held.dive;
        const control = { player: you, dx, dy, shoot: !keeper && act, pass: pressed('ShiftLeft', 'ShiftRight', 'KeyE') || held.pass, dive: keeper && act };
        for (const e of stepMatch(m, STEP, Math.random, control)) {
          if (e === 'save') { saves++; banner = 'SAVED!'; bannerT = 1.2; }
          if (e.goal === 0 && e.by === you) { goals++; api.emit('goal', { by: 'you' }); banner = 'GOAL!'; bannerT = 1.6; }
          if (e.goal === 1) { conceded += keeper ? 1 : 0; banner = 'GOAL FOR BOTS'; bannerT = 1.4; }
        }
        // A shot or a pass goes once per press; holding the key does not keep kicking.
        keys.delete('Space'); keys.delete('ShiftLeft'); keys.delete('ShiftRight'); keys.delete('KeyE'); held.shoot = held.pass = held.dive = false;
      }
      show();
      if (left <= 0) finish();
    }
    bannerT = Math.max(0, bannerT - dt);
    follow(cam, m, dt);
    if (view) {
      view.g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      drawMatch(view.g, view.w, view.h, m, cam, { you, minute: Math.floor(((TIME - left) / TIME) * 90), banner: bannerT > 0 ? banner : '' });
    }
    raf = requestAnimationFrame(frame);
  }
  start();
  raf = requestAnimationFrame(frame);
  return {
    key(e) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) keys.add(e.code);
      else if (!['Space', 'ShiftLeft', 'ShiftRight', 'KeyE'].includes(e.code)) keys.add(e.code);
    },
    keyup(e) { keys.delete(e.code); },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('blur', release); },
  };
}
