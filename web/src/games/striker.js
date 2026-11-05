// Striker 22: five penalties to take, five to save, then sudden death. A night-match goal view drawn on a canvas.
import * as S from './pure/striker.js';
import { h, fit, endCard, injectStyles, ACCENT, BAD, INK, DIM, MONO, reducedMotion } from './ui.js';

const STYLE = { id: 'striker', css: `
.g-st-hud { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 8px 16px; flex-wrap: wrap; padding: 8px 16px 6px; }
.g-st-tally { display: grid; grid-template-columns: auto auto; gap: 5px 10px; align-items: center; font-size: 11px; color: ${DIM}; letter-spacing: .08em; }
.g-st-dots { display: flex; gap: 5px; flex-wrap: wrap; }
.g-st-dot { width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,.22); position: relative; flex: none; }
.g-st-dot.g-goal { background: ${ACCENT}; border-color: ${ACCENT}; box-shadow: 0 0 8px rgba(62,230,196,.55); }
.g-st-dot.g-no { border-color: ${BAD}; }
.g-st-dot.g-no::before, .g-st-dot.g-no::after { content: ''; position: absolute; left: 50%; top: 50%; width: 9px; height: 1.5px; background: ${BAD}; }
.g-st-dot.g-no::before { transform: translate(-50%,-50%) rotate(45deg); } .g-st-dot.g-no::after { transform: translate(-50%,-50%) rotate(-45deg); }
.g-st-dot.g-now { border-color: ${INK}; box-shadow: 0 0 0 3px rgba(232,237,245,.12); }
.g-st-tip { font-size: 12px; color: ${INK}; text-align: right; flex: 1 1 220px; min-height: 17px; }
.g-st-tip b { color: ${ACCENT}; font-weight: 700; }
@media (max-width: 560px) { .g-st-hud { padding: 6px 10px 4px; } .g-st-tip { text-align: left; flex-basis: 100%; } }
` };

const CAM_Z = 20, CAM_H = 3.0, KEEPER_Z = 0.3, NET_Z = -1.8, BOARD_Z = -6;
const KITS = {
  you: { shirt: '#f3f4f8', shade: '#c9cbd6', trim: '#7d4fe0', shorts: '#f3f4f8', socks: '#f3f4f8', band: '#7d4fe0', gloves: '#7d4fe0', name: 'BEHI', num: '22' },
  them: { shirt: '#1f2533', shade: '#141923', trim: '#ff8a3d', shorts: '#1f2533', socks: '#ff8a3d', band: '#1f2533', gloves: '#ff8a3d', name: 'BOT', num: '9' },
  themKeeper: { shirt: '#ff8a3d', shade: '#d96c25', trim: '#1b1f29', shorts: '#1b1f29', socks: '#ff8a3d', band: '#1b1f29', gloves: '#f3f4f8', name: 'BOT', num: '1' },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => 1 - (1 - t) * (1 - t);

export function mount(body, api) {
  injectStyles(STYLE);
  const tallyYou = h('div', { class: 'g-st-dots' }), tallyThem = h('div', { class: 'g-st-dots' });
  const tip = h('div', { class: 'g-st-tip', 'aria-live': 'polite' });
  const canvas = h('canvas', { 'aria-label': 'Penalty shootout' });
  const stage = h('div', { class: 'g-stage' }, canvas);
  body.append(h('div', { class: 'g-st-hud' },
    h('div', { class: 'g-st-tally' }, h('span', { text: 'YOU' }), tallyYou, h('span', { text: 'BOT' }), tallyThem), tip), stage);

  const coarse = matchMedia('(pointer: coarse)').matches;
  const calm = reducedMotion();
  let g, W = 0, H = 0, f = 1, cx = 0, hy = 0, bg = null;
  let raf = 0, last = 0, clock = 0, alive = true;
  let so, st, history, card = null, held = new Set(), pendingV = null;
  const confetti = [];
  let shake = 0, banner = null, net = null, flash = null;

  // ---------- projection ----------
  const proj = (x, y, z) => { const d = CAM_Z - z; return { x: cx + x * f / d, y: hy + (CAM_H - y) * f / d, s: f / d }; };
  const unproj = (sx, sy) => ({ x: (sx - cx) * CAM_Z / f, y: CAM_H - (sy - hy) * CAM_Z / f });

  function layout() {
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    ({ g, w: W, h: H } = fit(canvas, Math.floor(r.width), Math.floor(r.height)));
    const top = (CAM_H - S.GOAL_H) / CAM_Z, ball = CAM_H / (CAM_Z - S.SPOT);
    f = Math.min((0.58 * H) / (ball - top), (0.86 * W) / (S.GOAL_W / CAM_Z));
    cx = W / 2;
    hy = H * 0.57 - f * (top + ball) / 2;
    bg = paintBackground();
  }

  function paintBackground() {
    const c = document.createElement('canvas');
    const { g: b } = fit(c, W, H);
    const sky = b.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#03050a'); sky.addColorStop(1, '#0a1220');
    b.fillStyle = sky; b.fillRect(0, 0, W, H);
    // The stand behind the goal, with a crowd made of dots.
    const standD = 34, standTop = proj(0, 11, CAM_Z - standD).y, boardY = proj(0, 0.95, BOARD_Z).y;
    const stand = b.createLinearGradient(0, standTop, 0, boardY);
    stand.addColorStop(0, '#0c121d'); stand.addColorStop(1, '#141c2a');
    b.fillStyle = stand; b.fillRect(0, standTop, W, boardY - standTop);
    const rng = S.seeded(22);
    const tiers = 14, rowH = (boardY - standTop) / tiers;
    for (let r = 0; r < tiers; r++) {
      const y = standTop + r * rowH;
      b.fillStyle = 'rgba(255,255,255,.025)'; b.fillRect(0, y, W, 1);
      const dot = Math.max(1.2, rowH * 0.32);
      for (let x = rng() * 6; x < W; x += dot * (2.1 + rng() * 1.6)) {
        const k = rng();
        b.fillStyle = k < 0.06 ? 'rgba(125,79,224,.6)' : k < 0.1 ? 'rgba(62,230,196,.4)' : k < 0.16 ? 'rgba(243,244,248,.35)' : `rgba(${60 + rng() * 50 | 0},${68 + rng() * 50 | 0},${88 + rng() * 50 | 0},.4)`;
        b.beginPath(); b.arc(x, y + rowH * 0.55 + (rng() - 0.5) * rowH * 0.2, dot / 2, 0, 7); b.fill();
      }
    }
    b.fillStyle = '#060910'; b.fillRect(0, standTop - 3, W, 3);
    for (const side of [-1, 1]) {
      const lx = cx + side * W * 0.42, ly = standTop - 10;
      const glow = b.createRadialGradient(lx, ly, 0, lx, ly, W * 0.35);
      glow.addColorStop(0, 'rgba(210,230,255,.22)'); glow.addColorStop(1, 'rgba(210,230,255,0)');
      b.fillStyle = glow; b.fillRect(0, 0, W, H);
      b.fillStyle = '#e8f0ff';
      for (let i = 0; i < 4; i++) { b.beginPath(); b.arc(lx + (i - 1.5) * 7, ly, 2.2, 0, 7); b.fill(); }
    }
    // Pitch stripes run across, so each band is a strip between two depths.
    const boardFoot = proj(0, 0, BOARD_Z).y;
    for (let z = BOARD_Z, i = 0; z < CAM_Z - 0.5; z += 2.5, i++) {
      const y0 = proj(0, 0, z).y, y1 = Math.min(H, proj(0, 0, Math.min(z + 2.5, CAM_Z - 0.5)).y);
      b.fillStyle = i % 2 ? '#0f3a2b' : '#124331';
      b.fillRect(0, y0, W, y1 - y0 + 1);
      if (y1 >= H) break;
    }
    const board = b.createLinearGradient(0, boardY, 0, boardFoot);
    board.addColorStop(0, '#0b1018'); board.addColorStop(1, '#070a10');
    b.fillStyle = board; b.fillRect(0, boardY, W, boardFoot - boardY);
    b.fillStyle = 'rgba(62,230,196,.5)'; b.fillRect(0, boardY, W, 1);
    const bh = boardFoot - boardY;
    b.font = `700 ${Math.max(8, bh * 0.52)}px ${MONO}`; b.textBaseline = 'middle'; b.textAlign = 'center';
    const words = ['STRIKER 22', 'BEHI 22', 'HOME FC'];
    const step = Math.max(110, bh * 9);
    for (let x = cx - step * 6, i = 0; x < W + step; x += step, i++) {
      b.fillStyle = i % 2 ? 'rgba(180,156,255,.85)' : 'rgba(62,230,196,.85)';
      b.shadowColor = b.fillStyle; b.shadowBlur = 8;
      b.fillText(words[(i + 30) % 3], x, boardY + bh / 2);
    }
    b.shadowBlur = 0;
    // Lines: the goal line, the six-yard box and the spot.
    b.strokeStyle = 'rgba(235,245,240,.7)'; b.lineCap = 'round';
    const line = (a, c) => { const p = proj(...a), q = proj(...c); b.lineWidth = Math.max(1, 0.12 * (p.s + q.s) / 2); b.beginPath(); b.moveTo(p.x, p.y); b.lineTo(q.x, q.y); b.stroke(); };
    line([-40, 0, 0], [40, 0, 0]);
    line([-9.16, 0, 0], [-9.16, 0, 5.5]); line([9.16, 0, 0], [9.16, 0, 5.5]); line([-9.16, 0, 5.5], [9.16, 0, 5.5]);
    const spot = proj(0, 0, S.SPOT);
    b.fillStyle = 'rgba(235,245,240,.8)'; b.beginPath(); b.ellipse(spot.x, spot.y, 0.13 * spot.s, 0.05 * spot.s, 0, 0, 7); b.fill();
    const vig = b.createRadialGradient(cx, H * 0.5, Math.min(W, H) * 0.3, cx, H * 0.5, Math.max(W, H) * 0.8);
    vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.55)');
    b.fillStyle = vig; b.fillRect(0, 0, W, H);
    return c;
  }

  // ---------- game flow ----------
  function reset() {
    so = S.newShootout(); history = []; confetti.length = 0; net = null; banner = null;
    card?.remove(); card = null;
    api.score(0, 0);
    nextKick();
  }

  function nextKick() {
    const k = S.nextKick(so);
    renderTally(k);
    if (!k) return finish();
    const kicks = so.kicks.length;
    if (k.by === 'you') {
      st = { phase: 'aim', by: 'you', k, aim: { x: 1.6, y: 1.1 }, t: 0 };
      if (kicks === 0) say('Take your penalties', `Kick 1 of ${S.KICKS}`);
      else if (k.sudden && kicks === S.KICKS * 2) say('Sudden death', 'Score and then save');
      setTip(coarse ? 'Drag to aim, let go to lock it.' : 'Move to aim, click to lock it. Arrows and Space work too.');
    } else {
      st = { phase: 'ready', by: 'them', k, t: 0, run: 0.9 + Math.random() * 0.5, dive: null };
      if (kicks === S.KICKS) say('Now you are in goal', 'BEHI 22, keep them out');
      setTip(coarse ? 'Tap or swipe where the ball is going.' : 'Dive with the arrows (hold Up for high), or click where the ball is going.');
    }
    stage.dataset.phase = st.phase;
  }

  function setPhase(p) { st.phase = p; st.t = 0; stage.dataset.phase = p; }
  const setTip = s => { tip.textContent = s; };
  const say = (big, small) => { banner = { big, small, t: 0 }; };

  function renderTally(k) {
    const by = who => so.kicks.filter(x => x.by === who);
    for (const [el, who] of [[tallyYou, 'you'], [tallyThem, 'them']]) {
      const done = by(who), slots = Math.max(S.KICKS, done.length + (k && k.by === who ? 1 : 0));
      el.replaceChildren(...Array.from({ length: slots }, (_, i) => {
        const r = done[i];
        const cls = r ? (r.result === 'goal' ? 'g-goal' : 'g-no') : (k && k.by === who && i === done.length ? 'g-now' : '');
        return h('span', { class: `g-st-dot ${cls}`.trim(), title: r ? r.result : '' });
      }));
    }
  }

  function lockAim() {
    if (st.phase !== 'aim') return;
    st.aim = { x: clamp(st.aim.x, -4.4, 4.4), y: clamp(st.aim.y, 0.12, 3.3) };
    setPhase('power'); st.meter = 0;
    setTip(coarse ? 'Tap when the bar is in the green.' : 'Click or press Space when the bar is in the green.');
  }

  function lockPower() {
    if (st.phase !== 'power') return;
    st.power = meterValue(st.meter);
    st.ball = S.shoot(st.aim, st.power, Math.random);
    st.plan = S.keeperPlan(st.ball, history, Math.random);
    history.push(st.ball.x);
    st.kickAt = clock + 0.45;
    setPhase('run');
    setTip('');
  }

  const meterValue = t => (1 - Math.cos(t * Math.PI * 2 / 1.25)) / 2;

  function dive(x, y) {
    if (st.by !== 'them' || st.dive || !['ready', 'run', 'flight'].includes(st.phase)) return;
    st.dive = { x: clamp(x, -S.KEEPER.maxX, S.KEEPER.maxX), y: clamp(y, S.KEEPER.minY, S.KEEPER.maxY), at: clock };
    if (st.phase === 'ready') setPhase('run');
  }

  function kick() {
    if (st.by === 'them') {
      const wentEarly = st.dive && st.dive.at < clock - 0.15 ? st.dive : null;
      const shot = S.botAim(Math.random, wentEarly);
      st.ball = S.shoot(shot.aim, shot.power, Math.random, S.BOT_PACE);
      st.early = !!wentEarly;
    }
    st.kickAt = clock;
    setPhase('flight');
  }

  const planNow = () => (st.by === 'you' ? st.plan : st.dive && { x: st.dive.x, y: st.dive.y, start: st.dive.at - st.kickAt });

  function resolve() {
    const b = st.ball, plan = planNow();
    let result = b.result === 'on' ? (S.saves(plan, b) ? 'save' : 'goal') : 'miss';
    const flight = b.flight, lift = 0.12 + 0.22 * clamp(b.y / S.GOAL_H, 0, 1.4);
    const k = S.keeperAt(plan, flight);
    st.fly = { x: b.x, y: b.y, z: 0, vx: b.x / flight, vy: ((b.y - S.BALL_R) - Math.PI * lift) / flight, vz: -S.SPOT / flight, spin: 0 };
    st.caught = false;
    if (result === 'save') {
      const dx = b.x - k.x, dy = b.y - k.y;
      st.caught = Math.hypot(dx, dy) < 0.42 && b.flight > 0.55;
      const side = Math.sign(dx) || (Math.random() < 0.5 ? -1 : 1);
      Object.assign(st.fly, { vx: side * (2.5 + Math.random() * 2.5), vy: 2 + Math.random() * 2.5, vz: 3 + Math.random() * 3, z: KEEPER_Z });
    } else if (b.result === 'post') {
      Object.assign(st.fly, { vx: -Math.sign(b.x || 1) * (1.5 + Math.random() * 2), vy: 1 + Math.random() * 2, vz: 5 + Math.random() * 2 });
      flash = { x: b.x, y: b.y, t: 0 };
    }
    st.result = result;
    so = S.recordKick(so, st.by, result);
    const t = S.tally(so);
    api.score(t.you, t.them);
    api.emit(result, { by: st.by });
    const mine = st.by === 'you';
    const good = mine ? result === 'goal' : result !== 'goal';
    let big, small = '';
    if (result === 'goal') {
      big = 'GOAL';
      if (mine) small = Math.abs(b.x) > 2.6 ? (b.y > 1.6 ? 'Top corner' : b.y < 0.7 ? 'Bottom corner' : 'In off the side') : Math.abs(b.x) < 0.9 ? 'Down the middle' : 'Tucked away';
      else small = st.early ? 'You went too early' : st.dive ? 'Just out of reach' : 'You did not move';
      if (mine) { burst(); shake = 0.35; }
    } else if (result === 'save') {
      big = st.caught ? 'CAUGHT' : 'SAVED';
      small = mine ? (st.plan.read ? 'He read it' : 'He guessed right') : 'BEHI 22 keeps it out';
      if (!mine) burst();
    } else {
      big = b.result === 'post' ? 'OFF THE POST' : b.result === 'over' ? 'OVER THE BAR' : 'WIDE';
      small = mine ? (st.power > S.SWEET[1] + 0.03 ? 'Too much power' : st.power < 0.3 ? 'Not enough power' : 'Just off target') : 'He missed';
    }
    st.say = { big, small, good, t: 0 };
    renderTally(null);
    setPhase('after');
  }

  function burst() {
    if (calm) return;
    for (let i = 0; i < 70; i++) confetti.push({ x: Math.random() * W, y: -10 - Math.random() * H * 0.3, vx: (Math.random() - 0.5) * 60, vy: 60 + Math.random() * 120,
      r: Math.random() * 6, vr: (Math.random() - 0.5) * 8, c: ['#3ee6c4', '#b49cff', '#f3f4f8', '#7d4fe0'][i % 4], s: 3 + Math.random() * 4 });
  }

  function finish() {
    const t = S.tally(so), out = S.outcome(so);
    const won = out === 'win';
    api.emit(won ? 'win' : 'lose', {});
    const sudden = so.kicks.length > S.KICKS * 2 ? ' after sudden death' : '';
    setPhase('over');
    setTip('');
    card = endCard(stage, { title: won ? 'YOU WIN' : 'YOU LOSE', good: won, text: `${t.you} to ${t.them} in the shootout${sudden}.`, again: reset, close: api.close });
  }

  // ---------- update ----------
  function update(dt) {
    clock += dt;
    if (!st) return;
    st.t += dt;
    if (banner) { banner.t += dt; if (banner.t > 1.7) banner = null; }
    if (shake > 0) shake = Math.max(0, shake - dt);
    if (flash) { flash.t += dt; if (flash.t > 0.5) flash = null; }
    for (let i = confetti.length - 1; i >= 0; i--) {
      const p = confetti[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      if (p.y > H + 20) confetti.splice(i, 1);
    }
    if (pendingV && clock - pendingV.at > 0.09) { const v = pendingV; pendingV = null; dive(0, v.dir > 0 ? 2.05 : 0.4); }
    if (st.phase === 'aim' && held.size) {
      const sp = 3.2 * dt;
      if (held.has('ArrowLeft') || held.has('KeyA')) st.aim.x -= sp;
      if (held.has('ArrowRight') || held.has('KeyD')) st.aim.x += sp;
      if (held.has('ArrowUp') || held.has('KeyW')) st.aim.y += sp * 0.6;
      if (held.has('ArrowDown') || held.has('KeyS')) st.aim.y -= sp * 0.6;
      st.aim.x = clamp(st.aim.x, -4.4, 4.4); st.aim.y = clamp(st.aim.y, 0.12, 3.3);
    }
    if (st.phase === 'power') st.meter += dt;
    if (st.phase === 'run' && st.by === 'you' && clock >= st.kickAt) setPhase('flight');
    if (st.phase === 'ready' && st.t > (banner ? 1.4 : 0.6)) { setPhase('run'); }
    if (st.phase === 'run' && st.by === 'them' && st.kickAt == null) st.kickAt = clock + st.run;
    if (st.phase === 'run' && st.by === 'them' && clock >= st.kickAt) kick();
    if (st.phase === 'flight' && clock - st.kickAt >= st.ball.flight) resolve();
    if (st.phase === 'after') {
      st.say.t += dt;
      stepBall(dt);
      if (st.t > 1.9) nextKick();
    }
  }

  function stepBall(dt) {
    const b = st.fly;
    if (st.caught) return;
    b.vy -= 9.8 * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    b.spin += dt * 8;
    if (b.y < S.BALL_R) { b.y = S.BALL_R; b.vy = Math.abs(b.vy) * 0.45; b.vx *= 0.8; b.vz *= 0.8; }
    if (st.result === 'goal' && b.z < NET_Z) {
      if (!net) net = { x: b.x, y: b.y, t: 0, depth: 0.55 };
      b.z = NET_Z; b.vz = 0; b.vx *= 0.3;
    }
    // A miss that stays low thuds into the boards behind the goal instead of flying through them.
    if (st.result !== 'goal' && b.z < BOARD_Z && b.vz < 0 && b.y < 0.95) { b.z = BOARD_Z; b.vz *= -0.3; b.vx *= 0.5; }
    if (net) net.t += dt;
  }

  // ---------- drawing ----------
  function draw() {
    if (!g || !bg) return;
    g.save();
    if (shake > 0) g.translate((Math.random() - 0.5) * 6 * shake, (Math.random() - 0.5) * 6 * shake);
    g.drawImage(bg, 0, 0, W, H);
    const ball = ballNow();
    drawNet();
    if (ball && ball.z < KEEPER_Z) drawBall(ball);
    drawFrame();
    drawKeeper();
    if (ball && ball.z >= KEEPER_Z) drawBall(ball);
    drawKicker();
    if (st && st.phase === 'aim') drawReticle(st.aim, true);
    if (st && st.phase === 'power') { drawReticle(st.aim, false); drawMeter(); }
    g.restore();
    drawConfetti();
    drawWords();
  }

  function ballNow() {
    if (!st) return null;
    if (st.phase === 'after') {
      if (st.caught) { const k = keeperState(); return { x: k.x + 0.05, y: k.y + 0.15, z: KEEPER_Z + 0.05, spin: 0 }; }
      return { ...st.fly };
    }
    if (st.phase === 'flight') {
      const s = clamp((clock - st.kickAt) / st.ball.flight, 0, 1);
      return { ...S.ballPath(st.ball, s), spin: s * 6 };
    }
    return { x: 0, y: S.BALL_R, z: S.SPOT, spin: 0 };
  }

  function netZ(x, y) {
    if (!net) return NET_Z;
    const t = net.t, env = Math.exp(-t * 3.2) * Math.cos(t * 10) * (t < 0.08 ? t / 0.08 : 1);
    return NET_Z - net.depth * env * Math.exp(-((x - net.x) ** 2 + (y - net.y) ** 2) / 0.7);
  }

  function drawNet() {
    const X = S.HALF, Y = S.GOAL_H;
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(230,240,255,.2)';
    g.fillStyle = 'rgba(8,14,22,.35)';
    const a = proj(-X, 0, NET_Z), b2 = proj(X, Y, NET_Z);
    g.fillRect(a.x, b2.y, b2.x - a.x, a.y - b2.y);
    g.beginPath();
    for (let x = -X; x <= X + 1e-6; x += 0.305) {
      for (let y = 0; y <= Y + 1e-6; y += 0.2) { const p = proj(x, y, netZ(x, y)); y === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y); }
    }
    for (let y = 0; y <= Y + 1e-6; y += 0.305) {
      for (let x = -X; x <= X + 1e-6; x += 0.2) { const p = proj(x, y, netZ(x, y)); x === -X ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y); }
    }
    for (const sx of [-X, X]) {
      for (let z = NET_Z; z <= 0.001; z += 0.3) { const p = proj(sx, 0, z), q = proj(sx, Y, z); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); }
      for (let y = 0; y <= Y + 1e-6; y += 0.305) { const p = proj(sx, y, NET_Z), q = proj(sx, y, 0); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); }
    }
    for (let x = -X; x <= X + 1e-6; x += 0.305) { const p = proj(x, Y, NET_Z), q = proj(x, Y, 0); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); }
    g.stroke();
  }

  function drawFrame() {
    const X = S.HALF, Y = S.GOAL_H, w = 0.12;
    const p0 = proj(-X - w / 2, Y + w / 2, 0), p1 = proj(X + w / 2, Y - w / 2, 0), foot = proj(0, 0, 0);
    g.save();
    g.shadowColor = 'rgba(255,255,255,.35)'; g.shadowBlur = 10;
    g.fillStyle = '#f2f5fa';
    const pw = Math.max(2, w * p0.s);
    g.fillRect(p0.x, p0.y, pw, foot.y - p0.y);
    g.fillRect(p1.x - pw, p0.y, pw, foot.y - p0.y);
    g.fillRect(p0.x, p0.y, p1.x - p0.x, Math.max(2, p1.y - p0.y));
    g.restore();
    g.fillStyle = 'rgba(120,130,150,.5)';
    g.fillRect(p0.x + pw * 0.6, p0.y + pw, pw * 0.4, foot.y - p0.y - pw);
    g.fillRect(p1.x - pw * 0.4, p0.y + pw, pw * 0.4, foot.y - p0.y - pw);
    if (flash) {
      const p = proj(Math.sign(flash.x) * Math.min(Math.abs(flash.x), X), Math.min(flash.y, Y), 0);
      g.fillStyle = `rgba(255,255,255,${0.8 * (1 - flash.t / 0.5)})`;
      g.beginPath(); g.arc(p.x, p.y, 14 * (1 + flash.t * 2), 0, 7); g.fill();
    }
  }

  function keeperState() {
    if (!st) return { x: 0, y: S.KEEPER.y, p: 0, lean: 0 };
    let plan = null, t = 0;
    if (st.by === 'you' && st.plan && st.kickAt != null) { plan = st.plan; t = clock - st.kickAt; }
    if (st.by === 'them' && st.dive) { plan = { x: st.dive.x, y: st.dive.y, start: 0 }; t = clock - st.dive.at; }
    const k = S.keeperAt(plan, t);
    const sway = (1 - k.p) * Math.sin(clock * 3.1) * 0.08;
    return { ...k, x: k.x + sway };
  }

  function drawKeeper() {
    const k = keeperState();
    const kit = st && st.by === 'them' ? KITS.you : KITS.themKeeper;
    const p = proj(k.x, k.y, KEEPER_Z);
    const high = clamp((k.y - 1) / 1.1, 0, 1);
    const angle = Math.sign(k.x) * k.lean * (1.35 - 0.4 * high);
    const arms = Math.max(k.p, high);
    const shadow = proj(k.x, 0, KEEPER_Z);
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.beginPath(); g.ellipse(shadow.x, shadow.y, (0.45 + k.lean * 0.5) * p.s, 0.08 * p.s, 0, 0, 7); g.fill();
    figure(g, p.x, p.y, p.s, angle, kit, { front: true, arms, crouch: 1 - k.p });
  }

  function drawKicker() {
    if (!st) return;
    const kit = st.by === 'you' ? KITS.you : KITS.them;
    // Starts back and to the left, but never so far left that a narrow screen cuts him off.
    const sz = 13.4, sx = -Math.min(1.05, Math.max(0.5, ((cx - 64) * (CAM_Z - sz)) / f));
    const start = { x: sx, z: sz }, end = { x: -0.42, z: S.SPOT + 0.42 };
    let u = 0, run = 0, kickP = 0;
    if (st.phase === 'run') {
      const total = st.by === 'you' ? 0.45 : st.run;
      const left = st.kickAt != null ? st.kickAt - clock : total;
      u = clamp(1 - left / total, 0, 1); run = clock * 11;
    } else if (st.phase === 'flight' || st.phase === 'after') { u = 1; kickP = clamp((clock - st.kickAt) / 0.35, 0, 1); }
    const x = lerp(start.x, end.x, ease(u)), z = lerp(start.z, end.z, ease(u));
    const p = proj(x, 0, z);
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.beginPath(); g.ellipse(p.x, p.y, 0.32 * p.s, 0.07 * p.s, 0, 0, 7); g.fill();
    figure(g, p.x, p.y, p.s, 0, kit, { front: false, run: u > 0 && u < 1 ? run : null, kick: kickP });
  }

  function drawBall(b) {
    const p = proj(b.x, b.y, b.z), sh = proj(b.x, 0, b.z);
    const r = Math.max(2.5, S.BALL_R * p.s * 1.35);
    g.fillStyle = `rgba(0,0,0,${0.35 * clamp(1 - b.y / 3, 0.2, 1)})`;
    g.beginPath(); g.ellipse(sh.x, sh.y, r * 1.1, r * 0.35, 0, 0, 7); g.fill();
    const grad = g.createRadialGradient(p.x - r * 0.35, p.y - r * 0.4, r * 0.1, p.x, p.y, r);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, '#b9c2d0');
    g.fillStyle = grad;
    g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fill();
    if (r > 4) {
      g.save(); g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.clip();
      g.fillStyle = '#20263a';
      for (let i = 0; i < 4; i++) {
        const a = b.spin + i * Math.PI / 2, d = r * 0.62;
        poly(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.8, r * 0.3, a);
      }
      poly(p.x + Math.cos(b.spin) * r * 0.1, p.y, r * 0.32, b.spin);
      g.restore();
    }
  }
  function poly(x, y, r, a) {
    g.beginPath();
    for (let i = 0; i < 5; i++) { const t = a + i * Math.PI * 2 / 5; g.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r); }
    g.fill();
  }

  function drawReticle(aim, live) {
    const p = proj(aim.x, aim.y, 0);
    const r = Math.max(11, 0.3 * p.s), pulse = live ? 1 + Math.sin(clock * 6) * 0.08 : 1;
    g.save();
    g.strokeStyle = ACCENT; g.shadowColor = ACCENT; g.shadowBlur = 10; g.lineWidth = 2;
    g.beginPath(); g.arc(p.x, p.y, r * pulse, 0, 7); g.stroke();
    g.lineWidth = 1.5;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.beginPath(); g.moveTo(p.x + dx * r * 0.45, p.y + dy * r * 0.45); g.lineTo(p.x + dx * r * 1.45, p.y + dy * r * 1.45); g.stroke(); }
    g.fillStyle = ACCENT; g.beginPath(); g.arc(p.x, p.y, 2, 0, 7); g.fill();
    g.restore();
  }

  function drawMeter() {
    const ball = proj(0, 0, S.SPOT);
    const mh = clamp(H * 0.3, 90, 170), mw = 14;
    const x = Math.min(W - mw - 14, ball.x + Math.max(70, W * 0.16)), y = ball.y - mh;
    const v = meterValue(st.meter);
    g.save();
    g.fillStyle = 'rgba(5,7,11,.7)'; rr(x - 6, y - 24, mw + 12, mh + 32, 8); g.fill();
    g.fillStyle = 'rgba(255,255,255,.08)'; rr(x, y, mw, mh, 4); g.fill();
    const band = (a, b2, c) => { g.fillStyle = c; g.fillRect(x, y + mh * (1 - b2), mw, mh * (b2 - a)); };
    band(S.SWEET[0], S.SWEET[1], 'rgba(62,230,196,.32)');
    band(S.SWEET[1], 1, 'rgba(255,107,122,.3)');
    const col = v > S.SWEET[1] ? BAD : v >= S.SWEET[0] ? ACCENT : INK;
    g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 10;
    g.fillRect(x, y + mh * (1 - v), mw, mh * v);
    g.fillRect(x - 4, y + mh * (1 - v) - 1.5, mw + 8, 3);
    g.shadowBlur = 0;
    g.font = `700 10px ${MONO}`; g.textAlign = 'center'; g.fillStyle = DIM;
    g.fillText('POWER', x + mw / 2, y - 10);
    g.restore();
  }
  function rr(x, y, w, hh, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, hh, r) : g.rect(x, y, w, hh); }

  function drawConfetti() {
    for (const p of confetti) {
      g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore();
    }
  }

  function drawWords() {
    const pop = (t) => (calm ? 1 : t < 0.18 ? 0.6 + (t / 0.18) * 0.55 : t < 0.3 ? 1.15 - ((t - 0.18) / 0.12) * 0.15 : 1);
    const big = Math.max(26, Math.min(60, W * 0.07));
    // The words sit in the stand, between the top of the view and the crossbar.
    const bar = proj(0, S.GOAL_H, 0).y, y = Math.max(big * 0.7, bar * 0.42);
    if (st && st.phase === 'after' && st.say) {
      const s = st.say, a = clamp(Math.min(s.t / 0.12, (1.9 - st.t) / 0.3), 0, 1);
      text(s.big, cx, y, big * pop(s.t), s.good ? ACCENT : BAD, a, 700);
      if (s.small) text(s.small, cx, y + big * 0.82, Math.max(12, big * 0.3), INK, a * 0.9, 400);
    } else if (banner) {
      const a = clamp(Math.min(banner.t / 0.2, (1.7 - banner.t) / 0.4), 0, 1);
      text(banner.big.toUpperCase(), cx, y, Math.min(big * 0.62, W / (banner.big.length * 0.68)), INK, a, 700);
      text(banner.small, cx, y + big * 0.6, Math.max(12, big * 0.26), ACCENT, a, 400);
    }
  }
  function text(s, x, y, px, col, alpha, weight) {
    g.save();
    g.globalAlpha = alpha;
    g.font = `${weight} ${px}px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = col; g.shadowBlur = weight === 700 ? 18 : 0;
    g.fillStyle = col; g.fillText(s, x, y);
    g.restore();
  }

  // ---------- input ----------
  let down = null;
  const local = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', e => {
    if (!st || card) return;
    const p = local(e);
    canvas.setPointerCapture?.(e.pointerId);
    if (st.phase === 'aim') { st.aim = unproj(p.x, p.y); down = { ...p, id: e.pointerId }; return; }
    if (st.phase === 'power') { lockPower(); return; }
    if (st.phase === 'after' && st.t > 0.6) { nextKick(); return; }
    if (st.by === 'them') {
      if (e.pointerType === 'mouse') { const q = unproj(p.x, p.y); dive(q.x, q.y); return; }
      down = { ...p, id: e.pointerId, swiped: false };
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (!st) return;
    const p = local(e);
    if (st.phase === 'aim' && (e.pointerType === 'mouse' || down)) { st.aim = unproj(p.x, p.y); return; }
    if (down && st.by === 'them' && !down.swiped) {
      const dx = p.x - down.x, dy = p.y - down.y, d = Math.hypot(dx, dy);
      if (d > 26) { down.swiped = true; dive((dx / d) * 3.0, S.KEEPER.y - (dy / d) * 1.15); }
    }
  });
  const up = e => {
    if (!st) return;
    if (st.phase === 'aim' && down) { st.aim = unproj(local(e).x, local(e).y); lockAim(); }
    else if (down && st.by === 'them' && !down.swiped && e.type === 'pointerup') { const q = unproj(down.x, down.y); dive(q.x, q.y); }
    down = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', () => { down = null; });

  function key(e) {
    if (!st || card || e.target.closest?.('button')) return;
    const c = e.code;
    const arrows = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'];
    if (arrows.includes(c) || c === 'Space' || c === 'Enter') e.preventDefault();
    if (e.repeat && st.phase !== 'aim') return;
    held.add(c);
    if (st.phase === 'aim' && (c === 'Space' || c === 'Enter')) return lockAim();
    if (st.phase === 'power' && (c === 'Space' || c === 'Enter')) return lockPower();
    if (st.phase === 'after' && (c === 'Space' || c === 'Enter') && st.t > 0.6) return nextKick();
    if (st.by === 'them') {
      const upHeld = held.has('ArrowUp') || held.has('KeyW'), downHeld = held.has('ArrowDown') || held.has('KeyS');
      const yFor = () => (upHeld ? 1.95 : downHeld ? 0.4 : 0.95);
      if (c === 'ArrowLeft' || c === 'KeyA') { pendingV = null; dive(-2.75, yFor()); }
      else if (c === 'ArrowRight' || c === 'KeyD') { pendingV = null; dive(2.75, yFor()); }
      else if (c === 'ArrowUp' || c === 'KeyW') pendingV = { dir: 1, at: clock };
      else if (c === 'ArrowDown' || c === 'KeyS') pendingV = { dir: -1, at: clock };
    }
  }
  const keyup = e => held.delete(e.code);

  // ---------- loop ----------
  const ro = new ResizeObserver(() => layout());
  ro.observe(stage);
  layout();
  reset();
  const frame = now => {
    if (!alive) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    update(dt);
    draw();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    key, keyup,
    destroy() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); },
  };
}

// A footballer from simple shapes, in metres scaled by s px per metre. Front view is the keeper, back view the kicker.
function figure(g, x, y, s, angle, kit, o) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.scale(s, s);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const limb = (pts, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a, -b) : g.moveTo(a, -b))); g.stroke(); };
  if (o.front) {
    // Keeper: origin at the middle of the body.
    const c = o.crouch, arms = o.arms;
    const knee = 0.18 + 0.06 * c, foot = 0.22 + 0.08 * c;
    for (const sd of [-1, 1]) {
      limb([[sd * 0.1, -0.22], [sd * knee, -0.58], [sd * foot, -0.93]], 0.13, kit.socks);
      limb([[sd * 0.1, -0.22], [sd * (0.1 + (knee - 0.1) * 0.5), -0.4]], 0.15, kit.shorts);
      limb([[sd * foot, -0.93], [sd * (foot + 0.06), -0.95]], 0.1, '#11141b');
    }
    g.fillStyle = kit.shorts; g.fillRect(-0.2, 0.16, 0.4, 0.2);
    torso(g, kit, true);
    for (const sd of [-1, 1]) {
      const hand = [lerp(sd * 0.46, sd * 0.2, arms), lerp(-0.02, 0.98, arms)];
      const elbow = [lerp(sd * 0.38, sd * 0.26, arms), lerp(0.16, 0.62, arms)];
      limb([[sd * 0.2, 0.3], elbow, hand], 0.1, kit.shirt);
      g.fillStyle = kit.gloves; g.beginPath(); g.arc(hand[0], -hand[1], 0.085, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(hand[0], -hand[1], 0.035, 0, 7); g.fill();
    }
    head(g, 0, 0.53, true);
  } else {
    // Kicker from behind: origin at the feet.
    const run = o.run, k = o.kick || 0;
    for (const sd of [-1, 1]) {
      let lift = run != null ? Math.max(0, Math.sin(run + (sd > 0 ? 0 : Math.PI))) * 0.22 : 0;
      if (sd > 0 && k > 0) lift = Math.sin(k * Math.PI) * 0.5;
      const footY = lift, kneeY = 0.48 + lift * 0.6;
      limb([[sd * 0.1, 0.9], [sd * 0.12, kneeY], [sd * 0.13, footY + 0.06]], 0.13, kit.socks);
      limb([[sd * 0.1, 0.92], [sd * 0.11, 0.72]], 0.15, kit.shorts);
      limb([[sd * 0.13, footY + 0.05], [sd * 0.13, footY]], 0.12, '#11141b');
    }
    g.fillStyle = kit.shorts; g.fillRect(-0.2, -0.95, 0.4, 0.23);
    g.save(); g.translate(0, -1.12); torso(g, kit, false); g.restore();
    const swing = run != null ? Math.sin(run) * 0.1 : k * 0.15;
    for (const sd of [-1, 1]) {
      limb([[sd * 0.22, 1.42], [sd * 0.31, 1.2], [sd * (0.3 + (sd > 0 ? k * 0.15 : 0)), 1.0 + sd * swing]], 0.095, kit.shirt);
      g.fillStyle = '#c89072'; g.beginPath(); g.arc(sd * (0.3 + (sd > 0 ? k * 0.15 : 0)), -(1.0 + sd * swing), 0.045, 0, 7); g.fill();
    }
    head(g, 0, 1.61, false);
  }
  g.restore();
}

function torso(g, kit, front) {
  g.beginPath();
  g.moveTo(-0.24, -0.38); g.lineTo(0.24, -0.38); g.lineTo(0.19, 0.2); g.lineTo(-0.19, 0.2); g.closePath();
  g.fillStyle = kit.shirt; g.fill();
  g.fillStyle = kit.shade; g.globalAlpha = 0.5;
  g.beginPath(); g.moveTo(0.08, -0.38); g.lineTo(0.24, -0.38); g.lineTo(0.19, 0.2); g.lineTo(0.06, 0.2); g.closePath(); g.fill();
  g.globalAlpha = 1;
  g.fillStyle = kit.trim;
  g.fillRect(-0.19, 0.12, 0.38, 0.06);
  g.fillRect(-0.06, -0.4, 0.12, 0.05);
  // Text is set at 100 times the size and scaled down, since some browsers drop fonts under a pixel.
  g.save(); g.scale(0.01, 0.01);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (front) { g.font = `700 17px ${MONO}`; g.fillText(kit.num, 0, -20); }
  else {
    g.font = `700 7.5px ${MONO}`; g.fillText(kit.name, 0, -29);
    g.font = `700 20px ${MONO}`; g.fillText(kit.num, 0, -13);
  }
  g.restore();
}

function head(g, x, y, front) {
  g.fillStyle = '#c89072'; g.fillRect(x - 0.045, -(y - 0.06), 0.09, 0.08);
  g.beginPath(); g.arc(x, -y, 0.115, 0, 7); g.fill();
  g.fillStyle = '#1c1512';
  g.beginPath();
  if (front) g.arc(x, -y - 0.02, 0.118, Math.PI * 1.05, Math.PI * 1.95);
  else g.arc(x, -y + 0.01, 0.12, Math.PI * 0.85, Math.PI * 2.15);
  g.fill();
}
