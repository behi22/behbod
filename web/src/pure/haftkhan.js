// Haft Khan, Rostam's seven labours, as seven quick rounds: the rules, with no drawing. A round won scores 100 and a
// little more for speed; a round lost costs one of three lives and is tried again. Field units: 720 by 420, y down.
export const FIELD = { w: 720, h: 420, ground: 340 };
export const LABOURS = [
  { id: 'lion', name: 'The lion', how: 'Rostam sleeps. Strike as the lion leaps into the ring.', par: 7 },
  { id: 'desert', name: 'The waterless desert', how: 'Keep close to the ram. It knows the way to water.', par: 9 },
  { id: 'dragon', name: 'The dragon', how: 'It hides in the dark. Strike it while you can see it.', par: 8 },
  { id: 'sorceress', name: 'The sorceress', how: 'Watch the cup she charmed, and pick it when they stop.', par: 6 },
  { id: 'olad', name: 'Olad', how: 'Throw your lasso where Olad is riding.', par: 6 },
  { id: 'arzhang', name: 'The div Arzhang', how: 'Push him back. Strike fast, again and again.', par: 6 },
  { id: 'whitediv', name: 'The White Div', how: 'Dodge his rocks. Strike when he is open.', par: 10 },
];
export const LIVES = 3, INTRO = 1.8, PAUSE = 1.1;
export const LION = { from: 760, ring: [230, 330], rakhsh: 200, speed: 240, faster: 40, need: 3 };
export const DESERT = { reach: 70, fill: 7, thirst: 4.5, walk: 280, ram: 110 };
export const DRAGON = { need: 3, show: 1.25, faster: 0.15, reach: 64, limit: 16 };
export const CUPS = { slots: [200, 360, 520], show: 1.4, swaps: 5, swap: 0.42, reach: 70 };
export const OLAD = { speed: 230, fly: 0.5, reach: 46, aim: 380, limit: 12 };
export const ARZHANG = { push: 0.055, pull: 0.11, harder: 0.004, limit: 15 };
export const WHITE = { reach: 60, warn: 0.85, open: 1.0, need: 3, walk: 300 };

const rand = st => ((st.rs = (st.rs * 1664525 + 1013904223) >>> 0) / 4294967296);
function round(st, i) {
  const id = LABOURS[i].id;
  if (id === 'lion') return { x: LION.from, speed: LION.speed, kicks: 0, wait: 0.5, cool: 0 };
  if (id === 'desert') return { rx: 180, ram: 420, to: 420, turn: 1.2, water: 1, got: 0 };
  if (id === 'dragon') return { hits: 0, at: null, show: 0, hide: 0.8, cool: 0 };
  if (id === 'sorceress') {
    const swaps = [];
    for (let k = 0; k < CUPS.swaps; k++) { const a = Math.floor(rand(st) * 3), b = (a + 1 + Math.floor(rand(st) * 2)) % 3; swaps.push([a, b]); }
    return { cups: [0, 1, 2], charmed: Math.floor(rand(st) * 3), swaps, at: 0, stage: 'show', sel: 1, was: { left: false, right: false }, picked: null };
  }
  if (id === 'olad') return { ox: 120, ov: OLAD.speed, aim: 360, lasso: null };
  if (id === 'arzhang') return { bar: 0.5 };
  return { rx: 360, rock: null, next: 1.0, open: 0, strikes: 0, cool: 0 };
}

export function newQuest(seed = 1) {
  const st = { rs: seed >>> 0 || 1, labour: 0, lives: LIVES, score: 0, phase: 'intro', t: 0, rt: 0, done: false, won: false, r: null };
  st.r = round(st, 0);
  return st;
}
export const labour = st => LABOURS[Math.min(st.labour, LABOURS.length - 1)];

// Rostam (or the aim) walks toward the pointer, or with the arrow keys.
function walk(x, input, speed, dt) {
  if (Number.isFinite(input.x)) x += Math.max(-speed * 1.4 * dt, Math.min(speed * 1.4 * dt, input.x - x));
  else x += ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * speed * dt;
  return Math.max(40, Math.min(FIELD.w - 40, x));
}

// One step of `dt` seconds. input: { x (the pointer across the field, or null), left, right, presses: [{ x, y } or {}] }.
// Returns what happened: hit, miss, hurt, won (a labour), end.
export function step(st, dt, input = {}) {
  const ev = [], presses = input.presses || [];
  if (st.done || !(dt > 0)) return ev;
  dt = Math.min(dt, 0.05);
  st.t += dt;
  if (st.phase === 'intro') {
    // A press after the first moment skips the words.
    if ((st.t > INTRO) || (st.t > 0.4 && presses.length)) { st.phase = 'play'; st.t = 0; st.rt = 0; }
    return ev;
  }
  if (st.phase === 'won' || st.phase === 'hurt') {
    if (st.t < PAUSE) return ev;
    if (st.phase === 'won') {
      st.labour++;
      if (st.labour >= LABOURS.length) { st.score += st.lives * 50; st.done = st.won = true; st.phase = 'end'; ev.push({ type: 'end', won: true, score: st.score }); return ev; }
    }
    st.r = round(st, st.labour); st.phase = 'intro'; st.t = 0;
    return ev;
  }
  st.rt += dt;
  const r = st.r, id = labour(st).id;
  let result = null;
  const win = () => { result = 'won'; }, hurt = () => { result = 'hurt'; };
  if (id === 'lion') {
    r.cool = Math.max(0, r.cool - dt);
    if (r.wait > 0) r.wait -= dt; else r.x -= r.speed * dt;
    for (const p of presses) {
      if (r.cool > 0 || r.wait > 0) continue;
      if (r.x >= LION.ring[0] && r.x <= LION.ring[1]) {
        r.kicks++; ev.push({ type: 'hit' });
        if (r.kicks >= LION.need) { win(); break; }
        r.x = LION.from; r.wait = 0.5; r.speed += LION.faster;
      } else { r.cool = 0.45; ev.push({ type: 'miss' }); }
    }
    if (!result && r.x < LION.rakhsh) hurt();
  } else if (id === 'desert') {
    r.rx = walk(r.rx, input, DESERT.walk, dt);
    if ((r.turn -= dt) <= 0) { r.to = 80 + rand(st) * 560; r.turn = 1.2 + rand(st) * 0.8; }
    r.ram += Math.max(-DESERT.ram * dt, Math.min(DESERT.ram * dt, r.to - r.ram));
    if (Math.abs(r.rx - r.ram) < DESERT.reach) r.got += dt / DESERT.fill; else r.water -= dt / DESERT.thirst;
    if (r.got >= 1) win(); else if (r.water <= 0) hurt();
  } else if (id === 'dragon') {
    r.cool = Math.max(0, r.cool - dt);
    if (r.show > 0) { r.show -= dt; if (r.show <= 0) { r.at = null; r.hide = 0.6 + rand(st) * 0.5; } }
    else if ((r.hide -= dt) <= 0) { r.at = { x: 100 + rand(st) * 520, y: 120 + rand(st) * 180 }; r.show = DRAGON.show - DRAGON.faster * r.hits; }
    for (const p of presses) {
      if (r.cool > 0) continue;
      const near = r.at && (!Number.isFinite(p.x) || Math.hypot(p.x - r.at.x, p.y - r.at.y) < DRAGON.reach);
      if (near) {
        r.hits++; ev.push({ type: 'hit' }); r.at = null; r.show = 0; r.hide = 0.7;
        if (r.hits >= DRAGON.need) { win(); break; }
      } else { r.cool = 0.3; ev.push({ type: 'miss' }); }
    }
    if (!result && st.rt > DRAGON.limit) hurt();
  } else if (id === 'sorceress') {
    if (r.stage === 'show' && st.rt > CUPS.show) { r.stage = 'shuffle'; r.at = 0; }
    if (r.stage === 'shuffle') {
      r.at += dt / CUPS.swap;
      while (r.at >= 1 && r.swaps.length) { const [a, b] = r.swaps.shift(); [r.cups[a], r.cups[b]] = [r.cups[b], r.cups[a]]; r.at -= 1; }
      if (!r.swaps.length) { r.stage = 'pick'; r.at = 0; }
    } else if (r.stage === 'pick') {
      // The arrow keys move the choice one cup at a time, as each is pressed.
      if (input.left && !r.was.left) r.sel = Math.max(0, r.sel - 1);
      if (input.right && !r.was.right) r.sel = Math.min(2, r.sel + 1);
      for (const p of presses) {
        const slot = Number.isFinite(p.x) ? CUPS.slots.findIndex(s => Math.abs(s - p.x) < CUPS.reach) : r.sel;
        if (slot < 0) continue;
        r.picked = slot;
        if (r.cups[slot] === r.charmed) { ev.push({ type: 'hit' }); win(); } else hurt();
        break;
      }
    }
    r.was = { left: !!input.left, right: !!input.right };
  } else if (id === 'olad') {
    r.ox += r.ov * dt;
    if (r.ox > FIELD.w - 60 || r.ox < 60) { r.ov = -Math.sign(r.ov) * (OLAD.speed * (0.85 + rand(st) * 0.4)); r.ox = Math.max(60, Math.min(FIELD.w - 60, r.ox)); }
    r.aim = walk(r.aim, input, OLAD.aim, dt);
    if (r.lasso) {
      r.lasso.t += dt;
      if (r.lasso.t >= OLAD.fly) {
        if (Math.abs(r.ox - r.lasso.x) < OLAD.reach) { ev.push({ type: 'hit' }); win(); } else { ev.push({ type: 'miss' }); r.lasso = null; }
      }
    } else if (presses.length) {
      const p = presses[0];
      r.lasso = { x: Number.isFinite(p.x) ? Math.max(40, Math.min(FIELD.w - 40, p.x)) : r.aim, t: 0 };
    }
    if (!result && st.rt > OLAD.limit) hurt();
  } else if (id === 'arzhang') {
    for (const p of presses) { r.bar += ARZHANG.push; ev.push({ type: 'hit' }); }
    r.bar -= (ARZHANG.pull + ARZHANG.harder * st.rt) * dt;
    if (r.bar >= 1) win(); else if (r.bar <= 0 || st.rt > ARZHANG.limit) hurt();
  } else {
    r.rx = walk(r.rx, input, WHITE.walk, dt);
    r.cool = Math.max(0, r.cool - dt);
    if (r.open > 0) r.open -= dt;
    else if (r.rock) {
      r.rock.t += dt;
      if (r.rock.t >= WHITE.warn) {
        if (Math.abs(r.rx - r.rock.x) < WHITE.reach) hurt(); else { r.open = WHITE.open; ev.push({ type: 'dodge' }); }
        r.rock = null; r.next = 0.5;
      }
    } else if ((r.next -= dt) <= 0) r.rock = { x: r.rx, t: 0 };
    for (const p of presses) {
      if (result) break;
      if (r.open > 0) { r.strikes++; r.open = 0; ev.push({ type: 'hit' }); if (r.strikes >= WHITE.need) win(); }
      else if (r.cool <= 0) { r.cool = 0.3; ev.push({ type: 'miss' }); }
    }
  }
  if (result === 'won') {
    st.score += 100 + Math.max(0, Math.round(labour(st).par - st.rt)) * 10;
    st.phase = 'won'; st.t = 0; ev.push({ type: 'won', labour: st.labour });
  } else if (result === 'hurt') {
    st.lives--; st.phase = 'hurt'; st.t = 0; ev.push({ type: 'hurt' });
    if (st.lives <= 0) { st.done = true; st.phase = 'end'; ev.push({ type: 'end', won: false, score: st.score }); }
  }
  return ev;
}

// Where each cup is drawn during the shuffle: its slot, or between two slots part way through a swap.
export function cupX(r, cup) {
  const slot = r.cups.indexOf(cup);
  if (r.stage !== 'shuffle' || !r.swaps.length) return { x: CUPS.slots[slot], lift: 0 };
  const [a, b] = r.swaps[0], u = Math.min(1, r.at);
  if (slot !== a && slot !== b) return { x: CUPS.slots[slot], lift: 0 };
  const to = slot === a ? b : a, e = u * u * (3 - 2 * u);
  return { x: CUPS.slots[slot] + (CUPS.slots[to] - CUPS.slots[slot]) * e, lift: Math.sin(Math.PI * e) * (slot === a ? -26 : 26) };
}
export const status = st => `labour ${Math.min(st.labour + 1, LABOURS.length)} of ${LABOURS.length}   score ${st.score}   lives ${Math.max(0, st.lives)}`;
