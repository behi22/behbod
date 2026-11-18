// Bug Hunt, on the computer: bugs crawl across the code and you squash them before they dig in. Quick ones are
// worth more; squashes in a row build a combo; the ladybird is a friend, and swatting her costs time. Forty-five
// seconds. Pure: `step` moves the bugs, `swat` is a click, and both say what happened.
export const FIELD = { w: 720, h: 420, time: 45, reach: 26, stay: 7 };
export const KINDS = {
  bug: { points: 10, speed: 70, size: 15 },
  quick: { points: 25, speed: 150, size: 11 },
  friend: { points: 0, speed: 55, size: 15, cost: 5 },
};
const COMBO_KEPT = 1.4, COMBO_STEP = 0.1, COMBO_TOP = 2;

export function newHunt() {
  return { t: 0, bugs: [], score: 0, squashed: 0, combo: 0, comboBest: 0, lastHit: -9, misses: 0, escaped: 0, next: 0.5, ids: 0, over: false };
}
export const left = h => Math.max(0, FIELD.time - h.t);

function bug(h, rng) {
  const roll = rng(), kind = roll < 0.12 ? 'friend' : roll < 0.34 + Math.min(0.2, h.t / 150) ? 'quick' : 'bug', K = KINDS[kind];
  // In from an edge, heading for somewhere in the middle of the page.
  const side = Math.floor(rng() * 4), along = rng();
  const x = side === 0 ? -K.size : side === 1 ? FIELD.w + K.size : along * FIELD.w, y = side === 2 ? -K.size : side === 3 ? FIELD.h + K.size : along * FIELD.h;
  const tx = FIELD.w * (0.15 + 0.7 * rng()), ty = FIELD.h * (0.15 + 0.7 * rng()), d = Math.hypot(tx - x, ty - y) || 1;
  return { id: ++h.ids, kind, x, y, vx: (tx - x) / d * K.speed, vy: (ty - y) / d * K.speed, born: h.t, turn: 0.6 + rng() * 0.9 };
}

// Events: spawn { id, kind }, escape { id }, end.
export function step(h, dt, rng = Math.random) {
  const ev = [];
  if (h.over || !(dt > 0)) return ev;
  h.t += dt;
  if (h.t >= FIELD.time) { h.t = FIELD.time; h.over = true; ev.push({ type: 'end' }); return ev; }
  for (const b of h.bugs) {
    b.x += b.vx * dt; b.y += b.vy * dt;
    // Every so often it changes its mind, and it turns back from the page's edge once it is on the page.
    b.turn -= dt;
    const K = KINDS[b.kind], on = b.x > 20 && b.x < FIELD.w - 20 && b.y > 20 && b.y < FIELD.h - 20;
    if (b.turn <= 0 && on) { const a = rng() * Math.PI * 2; b.vx = Math.cos(a) * K.speed; b.vy = Math.sin(a) * K.speed; b.turn = 0.5 + rng() * 1.1; }
    if (h.t - b.born > 1.5) {
      if (b.x < 14 && b.vx < 0) b.vx = -b.vx; else if (b.x > FIELD.w - 14 && b.vx > 0) b.vx = -b.vx;
      if (b.y < 14 && b.vy < 0) b.vy = -b.vy; else if (b.y > FIELD.h - 14 && b.vy > 0) b.vy = -b.vy;
    }
  }
  // One that has been about too long digs in and is gone.
  for (const b of h.bugs.filter(b => h.t - b.born > FIELD.stay)) { if (b.kind !== 'friend') h.escaped++; ev.push({ type: 'escape', id: b.id }); }
  h.bugs = h.bugs.filter(b => h.t - b.born <= FIELD.stay);
  h.next -= dt;
  if (h.next <= 0) {
    // They come quicker as the clock runs down, and never more than a dozen at once.
    h.next = 0.85 - 0.5 * Math.min(1, h.t / 35);
    if (h.bugs.length < 12) { const b = bug(h, rng); h.bugs.push(b); ev.push({ type: 'spawn', id: b.id, kind: b.kind }); }
  }
  return ev;
}

// A click at (x, y). Events: squash { id, kind, points, combo }, ouch { id } (the ladybird: time lost), miss.
export function swat(h, x, y) {
  if (h.over || !Number.isFinite(x) || !Number.isFinite(y)) return [];
  let best = null, bd = Infinity;
  for (const b of h.bugs) { const d = Math.hypot(b.x - x, b.y - y); if (d <= FIELD.reach + KINDS[b.kind].size / 2 && d < bd) { bd = d; best = b; } }
  if (!best) { h.combo = 0; h.misses++; return [{ type: 'miss' }]; }
  h.bugs = h.bugs.filter(b => b !== best);
  if (best.kind === 'friend') { h.combo = 0; h.t = Math.min(FIELD.time, h.t + KINDS.friend.cost); return [{ type: 'ouch', id: best.id }]; }
  h.combo = h.t - h.lastHit <= COMBO_KEPT ? h.combo + 1 : 1;
  h.lastHit = h.t;
  h.comboBest = Math.max(h.comboBest, h.combo);
  const points = Math.round(KINDS[best.kind].points * Math.min(COMBO_TOP, 1 + (h.combo - 1) * COMBO_STEP));
  h.score += points; h.squashed++;
  return [{ type: 'squash', id: best.id, kind: best.kind, points, combo: h.combo }];
}
