// The save of the week on the TV: the clip played as the broadcast plays the match, slowed down round the save, then a
// card to watch it again. The house's own save, or the visitor's when theirs is better (see pure/replay.js).
import { drawMatch, makeCamera, follow } from './matchdraw.js';
import { matchKits } from './pure/kits.js';
import { kitId } from './kit.js';
import { h, button, fit, injectStyles, DIM, MONO } from './ui.js';
import { weekSave } from '../weeksave.js';
import { frameAt, rate, length, HZ } from '../pure/replay.js';

const STYLE = { id: 'replay', css: `
.g-rp-hud { flex: none; padding: 8px 16px 6px; font-size: 12px; color: ${DIM}; }
` };
const SANS = "'Segoe UI', system-ui, sans-serif";

export function mount(body, api) {
  injectStyles(STYLE);
  const stage = h('div', { class: 'g-stage' }), canvas = h('canvas', { 'aria-label': 'The save of the week, replayed' });
  stage.append(canvas);
  const line = h('div', { class: 'g-rp-hud', 'aria-live': 'polite', text: 'Rewinding the tape...' });
  body.append(line, stage);
  const kits = matchKits(kitId());
  let clip = null, t = 0, raf = 0, last = performance.now(), view = null, card = null, cam = makeCamera(), m = null, gone = false;
  function layout() { const r = stage.getBoundingClientRect(); view = fit(canvas, r.width, r.height); }
  const ro = new ResizeObserver(layout);
  ro.observe(stage);
  layout();

  // The broadcast's lower third: REPLAY over whose save it is, shrunk to fit a narrow screen.
  function caption(g, w, hh) {
    const text = clip.who === 'you' ? 'SAVE OF THE WEEK  ·  YOUR SAVE' : 'SAVE OF THE WEEK  ·  BEHI FC';
    let fs = Math.round(hh / 24);
    const pad = fs * 0.6;
    g.font = `800 ${fs}px ${SANS}`;
    const room = w - pad * 2, need = g.measureText(text).width + fs * 1.4;
    if (need > room) { fs = Math.max(9, Math.floor(fs * room / need)); g.font = `800 ${fs}px ${SANS}`; }
    const tw = g.measureText(text).width, y = hh - pad - fs * 1.8;
    g.textAlign = 'left';
    g.fillStyle = 'rgba(8,10,16,.86)'; g.fillRect(pad, y, tw + fs * 1.4, fs * 1.7);
    g.fillStyle = '#7d4fe0'; g.fillRect(pad, y, fs * 0.25, fs * 1.7);
    g.fillStyle = '#e8edf5'; g.fillText(text, pad + fs * 0.7, y + fs * 1.18);
    g.font = `700 ${Math.round(fs * 0.72)}px ${MONO}`; g.fillStyle = '#3ee6c4';
    g.fillText('REPLAY', pad + fs * 0.7, y - fs * 0.45);
  }
  function draw() {
    if (!view || !clip) return;
    view.g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const at = clip.save / HZ, near = t >= at - 0.05 && t < at + 0.9;
    drawMatch(view.g, view.w, view.h, m, cam, { minute: clip.minute, live: false, banner: near ? 'SAVED!' : '', kits, you: clip.who === 'you' ? m.players.find(p => p.team === 0 && p.role === 'keeper') : null });
    caption(view.g, view.w, view.h);
  }
  function play() {
    card?.remove(); card = null;
    t = 0; m = frameAt(clip, 0, m); cam.x = m.ball.x;
    last = performance.now();
    line.textContent = clip.who === 'you' ? 'Your save is the best this week. Slowed down round the save.' : "BEHI FC's best save this week. Beat it as keeper in the match.";
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }
  function end() {
    const text = clip.who === 'you' ? 'That one is yours: the best save made here this week.' : 'Make a better one as keeper in the match and it takes this spot.';
    card = h('div', { class: 'g-card-wrap' },
      h('div', { class: 'g-card', role: 'alertdialog', 'aria-label': 'Save of the week' },
        h('h2', { text: 'SAVE OF THE WEEK' }), h('p', { text }),
        h('div', { class: 'g-row' }, button('Watch again', play, 'g-main'), button('Close', () => api.close()))));
    stage.append(card);
    card.querySelector('.g-main').focus({ preventScroll: true });
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t = Math.min(length(clip), t + dt * rate(clip, t));
    m = frameAt(clip, t, m);
    follow(cam, m, dt);
    draw();
    if (t >= length(clip)) { end(); return; }
    raf = requestAnimationFrame(frame);
  }
  // Until the house's match is played out, a slice of it each frame (a few ms), then the replay.
  function wait() {
    if (gone) return;
    if (!weekSave.pump()) { raf = requestAnimationFrame(wait); return; }
  }
  weekSave.get().then(c => {
    if (gone) return;
    clip = c;
    if (!clip) { line.textContent = 'No save yet this week. Join the match as keeper and make one.'; return; }
    play();
  });
  raf = requestAnimationFrame(wait);
  // The end card's buttons take Space and Enter themselves (Watch again has the focus).
  return {
    destroy() { gone = true; cancelAnimationFrame(raf); ro.disconnect(); },
  };
}
