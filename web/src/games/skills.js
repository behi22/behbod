// The Skills Shooter, the arcade's Claude game: shoot the skills as they drift down, dodge the bugs that fire back,
// and catch Claude for a few seconds of five-way fire. The rules live in pure/skills.js; this draws and steers it.
import * as S from './pure/skills.js';
import { h, button, fit, endCard, injectStyles, ACCENT, DIM, MONO, reducedMotion } from './ui.js';

const STYLE = { id: 'skills', css: `
.g-sk-hud { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 8px 14px; flex-wrap: wrap; padding: 8px 16px 6px; }
.g-sk-guns { display: flex; gap: 6px; flex-wrap: wrap; }
.g-sk-guns .g-btn { min-height: 30px; padding: 5px 10px; font-size: 11px; }
.g-sk-guns .g-btn.g-on { border-color: var(--c); color: var(--c); box-shadow: 0 0 10px color-mix(in srgb, var(--c) 35%, transparent); }
.g-sk-tip { font-size: 12px; color: ${DIM}; text-align: right; flex: 1 1 220px; }
@media (max-width: 560px) { .g-sk-hud { padding: 6px 10px 4px; } .g-sk-tip { text-align: left; flex-basis: 100%; } }
` };
const KEY = 'home.skills.best', CLAUDE = '#d97757';
const SANS = "'Segoe UI', system-ui, sans-serif";

export function mount(body, api) {
  injectStyles(STYLE);
  const stage = h('div', { class: 'g-stage' }), canvas = h('canvas', { 'aria-label': 'Skills Shooter' });
  stage.append(canvas);
  const guns = S.BLASTERS.map((b, i) => {
    const el = button(`${i + 1} ${b.name}`, () => { S.setBlaster(st, i); sync(); });
    el.style.setProperty('--c', b.color);
    el.title = b.line;
    return el;
  });
  const tip = h('div', { class: 'g-sk-tip' });
  body.append(h('div', { class: 'g-sk-hud' }, h('div', { class: 'g-sk-guns' }, guns), tip), stage);

  let best = 0;
  try { best = Number(localStorage.getItem(KEY)) || 0; } catch (e) { /* no storage: the best lasts this visit */ }
  let st = S.newGame(), playing = false, card = null, view = null, raf = 0, last = performance.now();
  const input = { left: false, right: false, fire: false };
  const stars = Array.from({ length: 90 }, () => ({ x: Math.random() * S.W, y: Math.random() * S.H, z: 0.3 + Math.random() * 0.7 }));
  let parts = [], shake = 0;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const still = reducedMotion();

  function sync() {
    guns.forEach((g, i) => g.classList.toggle('g-on', i === st.blaster));
    tip.textContent = playing ? (st.power > 0 ? 'Claude is with you: five-way fire' : S.BLASTERS[st.blaster].line)
      : coarse ? 'Tap to start, drag to steer' : 'Space to start. Arrows or A and D to move, 1 to 4 for blasters';
  }
  function start() {
    card?.remove(); card = null;
    st = S.newGame(); playing = true; parts = [];
    sync();
  }
  function over() {
    playing = false;
    const record = st.score > best;
    if (record) { best = st.score; try { localStorage.setItem(KEY, String(best)); } catch (e) { /* kept for this visit */ } }
    api.emit(st.score >= 500 ? 'win' : 'lose', { score: st.score });
    card = endCard(stage, { title: record ? 'NEW HIGH SCORE' : 'GAME OVER', text: `${st.score} points. Best ${best}.`, good: record || st.score >= 500, again: start, close: api.close });
    sync();
  }
  const boom = (x, y, c, n) => { if (!still) for (let i = 0; i < n; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * 320, vy: (Math.random() - 0.5) * 320, life: 0.3 + Math.random() * 0.4, c }); };

  function layout() {
    const r = stage.getBoundingClientRect();
    view = fit(canvas, r.width, r.height);
  }
  const ro = new ResizeObserver(layout);
  ro.observe(stage);
  layout();

  // Steering by touch or mouse: the ship follows the pointer across, and fires while it is held down.
  const toField = e => { const r = canvas.getBoundingClientRect(), k = Math.min(r.width / S.W, r.height / S.H); return (e.clientX - r.left - (r.width - S.W * k) / 2) / k; };
  let dragX = null;
  canvas.addEventListener('pointerdown', e => { if (!playing) { if (!card) start(); return; } dragX = toField(e); input.fire = true; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (dragX !== null) dragX = toField(e); });
  const up = () => { dragX = null; input.fire = false; };
  // Switching away mid-press never sends the key up, so let go of everything when the page loses focus.
  const release = () => { up(); input.left = input.right = false; };
  addEventListener('blur', release);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (playing) {
      const steer = dragX === null ? input : { ...input, left: dragX < st.x - 8, right: dragX > st.x + 8 };
      for (const e of S.step(st, dt, steer, Math.random)) {
        if (e === 'hurt') { shake = 1; boom(st.x, S.SHIP_Y, '#ff6b6b', 22); }
        else if (e === 'power') sync();
        else if (e === 'over') over();
        else if (e.kill) boom(e.x, e.y, e.kill === 'bug' ? '#ff6b6b' : e.kill === 'claude' ? CLAUDE : '#3dd6b5', e.kill === 'claude' ? 30 : 14);
      }
      if (st.power === 0 && tip.textContent.startsWith('Claude')) sync();
    } else {
      // Attract mode: the ship sways and nothing scores.
      st.t += dt;
      st.x = S.W / 2 + Math.sin(st.t * 1.2) * 260;
    }
    for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    parts = parts.filter(p => p.life > 0);
    shake = Math.max(0, shake - dt * 3);
    draw(dt);
    raf = requestAnimationFrame(frame);
  }

  function badge(g, x, y, label, edge, fill, text) {
    g.font = `700 18px ${MONO}`;
    const w = Math.max(70, g.measureText(label).width + 30);
    g.fillStyle = fill; g.strokeStyle = edge; g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x - w / 2 + 10, y - 18); g.lineTo(x + w / 2 - 10, y - 18); g.lineTo(x + w / 2, y); g.lineTo(x + w / 2 - 10, y + 18); g.lineTo(x - w / 2 + 10, y + 18); g.lineTo(x - w / 2, y);
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = text; g.textAlign = 'center'; g.fillText(label, x, y + 6);
  }
  function spark(g, x, y, r) {
    g.fillStyle = CLAUDE;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + st.t, ca = Math.cos(a), sa = Math.sin(a);
      g.beginPath(); g.moveTo(x - sa * 2.5, y + ca * 2.5); g.lineTo(x + ca * r, y + sa * r); g.lineTo(x + sa * 2.5, y - ca * 2.5); g.fill();
    }
  }

  function draw(dt) {
    if (!view) return;
    const g = view.g, k = Math.min(view.w / S.W, view.h / S.H), ox = (view.w - S.W * k) / 2, oy = (view.h - S.H * k) / 2;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    g.fillStyle = '#05070b'; g.fillRect(0, 0, view.w, view.h);
    g.save();
    g.translate(ox, oy); g.scale(k, k);
    if (shake) g.translate((Math.random() - 0.5) * 10 * shake, (Math.random() - 0.5) * 10 * shake);
    g.beginPath(); g.rect(0, 0, S.W, S.H); g.clip();
    const bg = g.createLinearGradient(0, 0, 0, S.H); bg.addColorStop(0, '#07051a'); bg.addColorStop(1, '#120a2e');
    g.fillStyle = bg; g.fillRect(0, 0, S.W, S.H);
    for (const s of stars) { s.y = (s.y + s.z * 60 * dt) % S.H; g.fillStyle = `rgba(255,255,255,${0.3 + s.z * 0.6})`; g.fillRect(s.x, s.y, 2 * s.z, 2 * s.z); }
    g.strokeStyle = 'rgba(124,156,255,.08)'; g.lineWidth = 1;
    for (let y = 0; y < S.H; y += 40) { const yy = y + (st.t * 40) % 40; g.beginPath(); g.moveTo(0, yy); g.lineTo(S.W, yy); g.stroke(); }
    for (const f of st.foes) {
      if (f.kind === 'bug') {
        g.fillStyle = '#ff6b6b'; g.beginPath(); g.ellipse(f.x, f.y, 22, 16, 0, 0, 7); g.fill();
        g.strokeStyle = '#ff6b6b'; g.lineWidth = 3;
        for (const sx of [-1, 1]) for (let l = 0; l < 3; l++) { g.beginPath(); g.moveTo(f.x + sx * 14, f.y - 6 + l * 7); g.lineTo(f.x + sx * 30, f.y - 12 + l * 10 + Math.sin(st.t * 12 + l) * 3); g.stroke(); }
        g.fillStyle = '#1a0a10'; g.fillRect(f.x - 9, f.y - 4, 5, 5); g.fillRect(f.x + 4, f.y - 4, 5, 5);
      } else if (f.kind === 'claude') {
        badge(g, f.x + 12, f.y, 'Claude', CLAUDE, 'rgba(217,119,87,.18)', '#ffe9e0');
        spark(g, f.x - 34, f.y, 13);
      } else badge(g, f.x, f.y, f.label, '#3dd6b5', 'rgba(61,214,181,.15)', '#e6fff8');
    }
    const B = S.BLASTERS[st.blaster], col = st.power > 0 ? CLAUDE : B.color;
    // Each shot glows with a soft halo drawn under it; a canvas shadow blur per shot is too slow on phones.
    for (const s of st.shots) {
      g.fillStyle = s.claude ? CLAUDE : col;
      g.globalAlpha = 0.3;
      if (s.rail) g.fillRect(s.x - 6, s.y - 64, 12, 78); else { g.beginPath(); g.arc(s.x, s.y, s.r * 2.2, 0, 7); g.fill(); }
      g.globalAlpha = 1;
      if (s.rail) g.fillRect(s.x - 2, s.y - 60, 4, 70); else { g.beginPath(); g.arc(s.x, s.y, s.r, 0, 7); g.fill(); }
    }
    g.fillStyle = '#ff6b6b'; for (const s of st.foeShots) g.fillRect(s.x - 2, s.y - 8, 4, 12);
    for (const p of parts) { g.globalAlpha = Math.max(0, p.life * 1.6); g.fillStyle = p.c; g.fillRect(p.x, p.y, 3, 3); }
    g.globalAlpha = 1;
    const sx = st.x, sy = S.SHIP_Y;
    g.shadowColor = col; g.shadowBlur = 18; g.fillStyle = '#e9e2ff';
    g.beginPath(); g.moveTo(sx, sy - 30); g.lineTo(sx + 26, sy + 18); g.lineTo(sx + 8, sy + 10); g.lineTo(sx, sy + 18); g.lineTo(sx - 8, sy + 10); g.lineTo(sx - 26, sy + 18); g.closePath(); g.fill();
    g.fillStyle = col; g.fillRect(sx - 3, sy - 14, 6, 14); g.shadowBlur = 0;
    if (st.power > 0) spark(g, sx, sy - 40, 8 + Math.sin(st.t * 10) * 2);
    g.fillStyle = 'rgba(255,170,90,.8)'; g.fillRect(sx - 6, sy + 18, 4, 6 + Math.random() * 8); g.fillRect(sx + 2, sy + 18, 4, 6 + Math.random() * 8);
    g.textAlign = 'left'; g.fillStyle = '#e6edf3'; g.font = `700 22px ${MONO}`;
    g.fillText(playing ? `SCORE ${st.score}` : 'SKILLS SHOOTER', 20, 34);
    g.textAlign = 'right'; g.fillText(`HI ${Math.max(best, st.score)}`, S.W - 20, 34);
    g.textAlign = 'left'; g.fillStyle = col; g.fillText(st.power > 0 ? 'CLAUDE' : `${st.blaster + 1} ${B.name.toUpperCase()}`, 20, S.H - 16);
    g.textAlign = 'right'; g.fillStyle = '#ff6b6b'; g.fillText('♥'.repeat(Math.max(0, st.lives)), S.W - 20, S.H - 16);
    if (!playing && !card) {
      g.textAlign = 'center'; g.fillStyle = 'rgba(7,5,26,.55)'; g.fillRect(0, S.H / 2 - 70, S.W, 140);
      g.fillStyle = '#e9e2ff'; g.font = `800 40px ${SANS}`; g.fillText(coarse ? 'TAP TO START' : 'PRESS SPACE TO START', S.W / 2, S.H / 2 + 4);
      g.font = `600 18px ${MONO}`; g.fillStyle = ACCENT; g.fillText('SHOOT THE SKILLS. DODGE THE BUGS. CATCH CLAUDE.', S.W / 2, S.H / 2 + 42);
    }
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < S.H; y += 3) g.fillRect(0, y, S.W, 1);
    g.restore();
  }

  const set = (e, on) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { input.left = on; e.preventDefault(); }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { input.right = on; e.preventDefault(); }
    if (e.code === 'Space') { input.fire = on; e.preventDefault(); }
  };
  sync();
  raf = requestAnimationFrame(frame);
  return {
    key(e) {
      if (e.code === 'Space' && !playing && !card && !e.repeat) { start(); e.preventDefault(); return; }
      if (/^Digit[1-4]$/.test(e.code)) { S.setBlaster(st, Number(e.code.slice(5)) - 1); sync(); }
      if (e.code === 'KeyQ') { S.setBlaster(st, st.blaster - 1); sync(); }
      if (e.code === 'KeyE') { S.setBlaster(st, st.blaster + 1); sync(); }
      set(e, true);
    },
    keyup(e) { set(e, false); },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('blur', release); },
  };
}
