// My moves: feet that stand on every stair and step and at every edge (foot IK on the house's floor plan), hips that
// never squat walking the stairs, a real turn on the spot (the feet step round, nothing slides), and the face blur
// still on my head while the hips drop. Desktop (the stairs also with the processor slowed 2x and 4x) and a phone.
// With --timing (run it under the lock's timing mode) it times the legs' own work and the frames instead, desktop and a
// phone slowed 4x; pointed at main, it times main's frames the same way.
//   LOFT_URL=http://127.0.0.1:8864 node test/moves.js [--timing]
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const TIMING = process.argv.includes('--timing');
const b2t = (x, y, z) => ({ x, y: z, z: -y });
let fails = 0;
// Timed runs only time: their checks are printed for reading, not counted.
const check = (name, ok, detail = '') => { if (!ok && !TIMING) fails++; console.log(`${name}${detail ? ' ' + detail : ''} ${TIMING ? '(timed run)' : ok ? 'PASS' : 'FAIL'}`); };
const OUTSIDE = /youtube|google|gstatic|ytimg|ggpht|doubleclick|open-meteo/;
const ANKLE = 0.072;
const NONE = { w: 0, sw: 0, shift: 0, feet: [{}, {}] };

async function open(b, opts, q = 'medium') {
  const ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400 && !OUTSIDE.test(r.url())) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('console', m => {
    if (m.type() === 'error' && !/favicon/.test(m.text()) && !OUTSIDE.test(m.location()?.url || '')) errs.push(m.text().slice(0, 200));
    if (m.type() === 'warning' && /WebGLProgram|WebGLShader/.test(m.text())) errs.push(m.text().slice(0, 200));
  });
  await p.goto(`${BASE}/?auto&mosaic&q=${q}`);
  await p.waitForFunction(() => window.__loft && __loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  // A record of every frame, taken once a frame when my pose is done (the head's look-around is its last touch): where
  // I am and face, both feet (ankle and ball), the floor each foot stands on (under its middle or its heel, read straight
  // from the floor plan, not from the legs), the pelvis and the legs' own state.
  await p.evaluate(() => {
    const L = __loft, V = L.camera.position.constructor, floors = L.meta.floors;
    const floorUnder = (x, z, top) => { let g = -Infinity; for (const f of floors) if (x >= f.min[0] && x <= f.max[0] && -z >= f.min[1] && -z <= f.max[1] && f.z <= top && f.z > g) g = f.z; return g; };
    window.__floorUnder = floorUnder;
    window.__feet = () => {
      const a = new V(), b = new V(), out = [];
      for (const s of ['l', 'r']) {
        L.me.bones['foot_' + s].getWorldPosition(a); L.me.bones['ball_' + s].getWorldPosition(b);
        // The floor it stands on: under the middle of the foot, or under its heel where that is higher.
        const top = L.pos.y + 0.45, mid = floorUnder((a.x + b.x) / 2, (a.z + b.z) / 2, top), heel = floorUnder(a.x + (a.x - b.x) * 0.4, a.z + (a.z - b.z) * 0.4, top);
        out.push({ ankle: a.toArray(), ball: b.toArray(), floor: Math.max(mid, heel) });
      }
      return out;
    };
    const look = L.me.lookAround;
    window.__rec = null;
    L.me.lookAround = (...a) => {
      look(...a);
      if (window.__rec) window.__rec.push({ t: performance.now(), x: L.pos.x, y: L.pos.y, z: L.pos.z, facing: L.facing, legs: window.__legs?.state || null, feet: __feet(), pelvis: L.me.bones.pelvis.getWorldPosition(new V()).y });
    };
  });
  return { ctx, p, errs };
}
const record = (p, on) => p.evaluate(on => { if (on) { window.__rec = []; return null; } const r = window.__rec; window.__rec = null; return r; }, on);
// Puts me on a spot (Blender x, y, floor) facing the way W walks with the camera at yaw `toward` (three's (-sin yaw,
// -cos yaw)): there, a short walk that way to face it (long enough for a half turn first), back on the spot, and the
// feet left to settle.
async function standAt(p, at, toward, settle = 1600) {
  await p.evaluate(([q, yw]) => { __loft.pos.set(q.x, q.y + 0.05, q.z); __loft.yaw = yw; }, [b2t(...at), toward]);
  await p.waitForTimeout(300);
  await p.keyboard.down('KeyW'); await p.waitForTimeout(1000); await p.keyboard.up('KeyW');
  await p.waitForTimeout(300);
  await p.evaluate(q => { __loft.pos.set(q.x, q.y + 0.05, q.z); }, b2t(...at));
  await p.waitForTimeout(settle);
}
// A foot's sole above the floor under its middle (m): the ankle joint sits ANKLE above the sole.
const clearance = f => f.ankle[1] - ANKLE - f.floor;
const dump = (name, rows) => { if (process.env.MOVES_DUMP) require('fs').writeFileSync(`${process.env.MOVES_DUMP}/${name}.json`, JSON.stringify(rows)); };

// ---------- the stairs up to the mezzanine: every tread, up and down ----------
async function stairs(p, label, phone) {
  await p.evaluate(q => { __loft.pos.set(q.x, q.y + 0.05, q.z); }, b2t(0.75, 9.3, 0));
  await p.waitForTimeout(1200);
  await record(p, true);
  // Up to the mezzanine and back down: on a phone by a tap at the top and one at the bottom, on a computer by the key.
  if (phone) { await p.evaluate(() => __loft.walkTo(0.75, 4.2, 3)); await p.waitForFunction(() => __loft.route === 0 && __loft.pos.y > 2.95, null, { timeout: 20000 }); }
  else { await p.evaluate(() => { __loft.yaw = Math.PI; }); await p.keyboard.down('KeyW'); await p.waitForFunction(() => __loft.pos.y > 2.95 && __loft.pos.z > -4.4, null, { timeout: 20000 }); await p.keyboard.up('KeyW'); }
  await p.waitForTimeout(800);
  if (phone) { await p.evaluate(() => __loft.walkTo(0.75, 9.4, 0)); await p.waitForFunction(() => __loft.route === 0 && __loft.pos.y < 0.05, null, { timeout: 20000 }); }
  else { await p.evaluate(() => { __loft.yaw = 0; }); await p.keyboard.down('KeyW'); await p.waitForFunction(() => __loft.pos.y < 0.05 && __loft.pos.z < -9.1, null, { timeout: 20000 }); await p.keyboard.up('KeyW'); }
  await p.waitForTimeout(600);
  const rows = await record(p, false);
  const onStairs = r => r.z > -8.34 && r.z < -4.5 && r.x > 0.15 && r.x < 1.35;
  const where = s => s && `(root ${s.row.x.toFixed(2)} ${s.row.y.toFixed(3)} ${s.row.z.toFixed(2)}, ankle ${s.f.ankle.map(v => v.toFixed(3)).join(' ')}, tread ${s.f.floor}, legs ${JSON.stringify(s.row.legs && { w: +s.row.legs.w.toFixed(3), sw: +s.row.legs.sw.toFixed(2), shift: +s.row.legs.shift.toFixed(3), floors: s.row.legs.feet.map(f => +f.floor.toFixed(3)), short: s.row.legs.feet.map(f => +(f.short || 0).toFixed(3)) })})`;
  dump(`stairs-${label}`, rows);
  // Walking, the stride is the walk's own (about three treads), so the hips drop only so far for the lower foot: never
  // into a squat.
  const walking = rows.filter(r => onStairs(r) && r.legs && r.legs.sw < 0.05);
  const squat = walking.reduce((m, r) => Math.min(m, r.legs.shift), 0);
  check(`${label}: walking on the stairs the hips drop for the lower foot but never into a squat`, walking.length > 40 && squat > -0.22, `${walking.length} frames, the hips down at most ${(-squat * 100).toFixed(1)} cm`);
  let sink = 0, deep = null;
  for (const r of rows) if (onStairs(r)) for (const f of r.feet) if (f.floor > 0 && -clearance(f) > sink) { sink = -clearance(f); deep = { f, row: r }; }
  check(`${label}: no foot ever sinks into a tread, in the air or down`, sink < 0.03, `deepest ${(sink * 100).toFixed(1)} cm ${sink >= 0.03 ? where(deep) : ''}`);
  return rows;
}

// ---------- standing on every stair, facing up and facing down ----------
async function treads(p, label, every = 1, ways = [Math.PI, 0]) {
  const list = await p.evaluate(() => __loft.meta.floors.filter(f => f.min[0] === 0.15 && f.max[0] === 1.35).map(f => [(f.min[1] + f.max[1]) / 2, f.z]).sort((a, b) => a[1] - b[1]));
  await standAt(p, [11.5, 11, 0], 0);
  const flat = await p.evaluate(() => __loft.me.bones.pelvis.getWorldPosition(__loft.camera.position.clone()).y - __loft.pos.y);
  for (const toward of ways) {
    let sole = 0, hips = 0, n = 0, at = '';
    const restless = [];
    for (let k = 0; k < list.length; k += every) {
      await standAt(p, [0.75, list[k][0], list[k][1]], toward, 1300);
      // Once the feet have stepped in under me (put back on the spot, they may still be on their way), they and I stay put.
      await p.waitForFunction(() => window.__legs.state.feet.every(f => !f.stepping), null, { timeout: 3000 }).catch(() => {});
      await record(p, true); await p.waitForTimeout(600);
      const still = await record(p, false), moved = Math.hypot(still[still.length - 1].x - still[0].x, still[still.length - 1].z - still[0].z);
      if (moved > 0.002 || still.some(row => row.legs.feet.some(f => f.stepping))) restless.push(k + 1);
      const r = await p.evaluate(() => ({ feet: __feet(), pelvis: __loft.me.bones.pelvis.getWorldPosition(__loft.camera.position.clone()).y }));
      const c = Math.max(...r.feet.map(f => Math.abs(clearance(f)))), h = Math.abs(r.pelvis - Math.min(...r.feet.map(f => f.floor)) - flat);
      if (c > sole || h > hips) at = `stair ${k + 1}: soles ${r.feet.map(f => (clearance(f) * 100).toFixed(1)).join(' and ')} cm off, pelvis ${((r.pelvis - Math.min(...r.feet.map(f => f.floor)) - flat) * 100).toFixed(1)} cm`;
      sole = Math.max(sole, c); hips = Math.max(hips, h); n++;
    }
    check(`${label}: standing on each of ${n} stairs facing ${toward ? 'up' : 'down'}, every sole on its tread and the hips over the lower foot, the feet still`, sole < 0.03 && hips < 0.04 && !restless.length, `worst sole ${(sole * 100).toFixed(1)} cm off, worst pelvis ${(hips * 100).toFixed(1)} cm (${at})${restless.length ? `, me or my feet still moving on stairs ${restless.join(' ')}` : ''}`);
  }
}

// ---------- standing half on an edge ----------
// Each spot: what it is, where I stand (Blender x, y, floor), which way I head to get there (along the edge, so one
// foot is each side of it), and whether the feet should each take their own level or both stay on a drop's edge.
const EDGES = [
  ['the studio steps, one foot on the platform and one on the top step', [16.3, 5.5, 0.45], -Math.PI / 2, 'step'],
  ['the studio steps, one foot on each step', [16.3, 5.75, 0.3], -Math.PI / 2, 'step'],
  ['the studio steps, the bottom step and the floor', [16.3, 6.0, 0.15], -Math.PI / 2, 'step'],
  ['the lounge pit steps, the rim and the first step', [9.8, 10.5, 0], 0, 'step'],
  ['the lounge pit steps, the two steps', [9.5, 10.5, -0.15], 0, 'step'],
  ['the lounge pit steps, the last step and the pit', [9.2, 10.5, -0.3], 0, 'step'],
  ['the piano dais, its two rings', [16.72, 11.0, 0.15], 0, 'step'],
  ['the piano dais, its outer ring and the floor', [16.32, 11.0, 0], 0, 'step'],
  ['a stair, one foot on each of two treads, side on', [0.75, 7.38, 0.9375], -Math.PI / 2, 'step'],
  ['the bottom stair and the floor, side on', [0.75, 8.34, 0.1875], -Math.PI / 2, 'step'],
  ['the studio platform\'s front edge over the drop', [13, 5.97, 0.45], -Math.PI / 2, 'ledge'],
  ['the lounge pit\'s rim over the drop', [6, 13.62, 0], -Math.PI / 2, 'ledge'],
];
async function edges(p, label) {
  // The pelvis's height over the floor standing on the flat, to compare with.
  await standAt(p, [11.5, 11, 0], 0);
  const flat = await p.evaluate(() => __loft.me.bones.pelvis.getWorldPosition(__loft.camera.position.clone()).y - __loft.pos.y);
  for (const [name, at, toward, kind] of EDGES) {
    await standAt(p, at, toward);
    const r = await p.evaluate(() => ({ feet: __feet(), y: __loft.pos.y, pelvis: __loft.me.bones.pelvis.getWorldPosition(__loft.camera.position.clone()).y, legs: window.__legs?.state || null }));
    const c = r.feet.map(clearance);
    if (kind === 'step') {
      const lo = Math.min(...r.feet.map(f => f.floor)), hi = Math.max(...r.feet.map(f => f.floor));
      // The hips go down to the lower foot: the pelvis stands over the lower floor as it stands over the flat, give or take the knee.
      const hips = r.pelvis - lo - flat;
      check(`${label}, ${name}: each foot on its own level, the hips over the lower`, hi - lo > 0.1 && c.every(x => Math.abs(x) < 0.03) && Math.abs(hips) < 0.04, `floors ${lo} and ${hi}, soles ${c.map(x => (x * 100).toFixed(1)).join(' and ')} cm off, pelvis ${(hips * 100).toFixed(1)} cm from standing height over the lower`);
    } else {
      const ankles = r.feet.map(f => f.ankle[1]);
      check(`${label}, ${name}: both feet stay on the edge, none hangs down`, ankles.every(y => Math.abs(y - ANKLE - at[2]) < 0.03), `ankles ${ankles.map(y => y.toFixed(3)).join(' and ')} over a floor at ${at[2]}`);
    }
  }
}

// ---------- put down out over a drop ----------
// My middle out past the lounge pit's rim and no key pressed: I come off the rim down into the pit, clear of its side,
// never sinking straight down into the side (as I would if standing still held me to up and down out there).
const DROPS = [['the lounge pit\'s south rim', [5, 7.2, 0], a => a[1] - 7], ['the lounge pit\'s north rim', [5, 13.4, 0], a => 13.6 - a[1]]];
async function drops(p, label) {
  for (const [name, at, gap] of DROPS) {
    await p.evaluate(q => { __loft.pos.set(q.x, q.y, q.z); }, b2t(...at));
    await p.waitForTimeout(2500);
    const r = await p.evaluate(() => [__loft.pos.x, -__loft.pos.z, __loft.pos.y]);
    // 0.27: the capsule's radius (R in collide.js).
    const clear = gap(r) - 0.27;
    check(`${label}, ${name}: put down out over the drop with no key, I come down into the pit clear of its side`, Math.abs(r[2] + 0.45) < 0.02 && clear > -0.005, `at ${r[2].toFixed(3)} m, ${(clear * 100).toFixed(1)} cm clear of the side`);
  }
}

// ---------- a held pose: the legs never add up ----------
// The animation and the legs' own clock held still (the mixer then writes no bone), standing with one foot a step
// lower: the hips keep exactly where they are on me and the feet where they stand, frame after frame (the body itself
// may settle a hair on the floor).
async function held(p, label) {
  await standAt(p, [16.3, 6.0, 0.15], -Math.PI / 2);
  const r = await p.evaluate(() => new Promise(res => {
    const L = __loft, m = L.me, B = m.bones, V = L.camera.position.constructor, a = m.animate, look = m.lookAround, legs = window.__legs, t = legs.tick, rows = [];
    m.animate = () => a(0, 0, false);
    legs.tick = (dt, s) => t(0, s);
    m.lookAround = (...x) => {
      look(...x);
      rows.push([m.root.worldToLocal(B.pelvis.getWorldPosition(new V())), B.foot_l.getWorldPosition(new V()), B.foot_r.getWorldPosition(new V())]);
      if (rows.length >= 30) { m.animate = a; m.lookAround = look; legs.tick = t; res({ drift: Math.max(...rows.map(row => Math.max(...row.map((v, i) => v.distanceTo(rows[0][i]))))), shift: window.__legs.state.shift }); }
    };
  }));
  check(`${label}: with the animation held still, the hips and legs keep exactly where they are`, r.drift < 1e-3 && r.shift < -0.1, `moved at most ${(r.drift * 1000).toFixed(2)} mm in 30 frames, the hips ${(-r.shift * 100).toFixed(1)} cm down for the lower foot`);
}

// ---------- the turn on the spot ----------
async function turn(p, label, phone) {
  await standAt(p, [11.5, 11, 0], 0, 1800);
  const f0 = await p.evaluate(() => __loft.facing);
  await record(p, true);
  // Asked to go the other way: on a phone by a tap behind me, on a computer by the key.
  if (phone) await p.evaluate(f => { const L = __loft; L.walkTo(L.pos.x - Math.sin(f) * 2.5, -(L.pos.z - Math.cos(f) * 2.5), 0); }, f0);
  else { await p.evaluate(f => { __loft.yaw = f; }, f0); await p.keyboard.down('KeyW'); }
  await p.waitForTimeout(1600);
  if (!phone) await p.keyboard.up('KeyW');
  await p.waitForTimeout(800);
  const rows = await record(p, false);
  const back = f0 + Math.PI, st = r => r.legs || NONE;
  const off = r => Math.abs(Math.atan2(Math.sin(back - r.facing), Math.cos(back - r.facing)));
  const startI = rows.findIndex(r => off(r) < Math.PI - 0.05), doneI = rows.findIndex(r => off(r) < 0.35);
  const secs = startI >= 0 && doneI > startI ? (rows[doneI].t - rows[startI].t) / 1000 : 0;
  check(`${label}: a half turn from standing takes a real turn's time, not a spin`, secs > 0.3 && secs < 0.95, `${secs.toFixed(2)} s`);
  const at90 = rows.findIndex(r => off(r) < Math.PI / 2);
  const moved = at90 >= 0 ? Math.hypot(rows[at90].x - rows[0].x, rows[at90].z - rows[0].z) : Infinity;
  check(`${label}: it turns on the spot before it walks off`, moved < 0.12, `moved ${(moved * 100).toFixed(0)} cm by the time it had turned half way`);
  let landings = 0, both = 0, slide = 0, slipAt = '';
  const since = [null, null];
  // From the start of the turn until the walk has taken over from the standing feet.
  let endI = doneI;
  while (endI + 1 < rows.length && rows[endI].legs && rows[endI].legs.sw > 0.5) endI++;
  for (let i = Math.max(1, startI); i <= endI; i++) {
    const a = rows[i - 1], b = rows[i];
    for (let k = 0; k < 2; k++) {
      if (st(a).feet[k].stepping && !st(b).feet[k].stepping) landings++;
      // A foot that is down stays where it was put, all the time it is down (on main every frame counts).
      const down = b.legs ? !st(b).feet[k].stepping && st(b).sw > 0.99 : true;
      if (!down) { since[k] = null; continue; }
      if (!since[k]) since[k] = b.feet[k].ankle;
      const drift = Math.hypot(b.feet[k].ankle[0] - since[k][0], b.feet[k].ankle[2] - since[k][2]);
      if (drift > slide) { slide = drift; slipAt = `foot ${k}, ${(b.t - rows[startI].t).toFixed(0)} ms into the turn, ${b.legs ? `w ${b.legs.w.toFixed(3)}, sw ${b.legs.sw.toFixed(3)}, leg short by ${(b.legs.feet[k].short * 1000).toFixed(1)} mm, hips ${(b.legs.shift * 100).toFixed(1)} cm` : 'no legs'}`; }
    }
    if (st(b).feet[0].stepping && st(b).feet[1].stepping) both++;
  }
  check(`${label}: the feet step round as it turns, one at a time`, landings >= 2 && both === 0, `${landings} steps, ${both} frames with both feet up`);
  check(`${label}: a planted foot never slides or spins on the floor`, slide < 0.002, `largest drift of a planted foot ${(slide * 1000).toFixed(1)} mm${slide >= 0.002 ? ' (' + slipAt + ')' : ''}`);
  const end = rows[rows.length - 1], walked = Math.hypot(end.x - rows[0].x, end.z - rows[0].z);
  // The body's turning speed never jumps: how fast it turns, over a frame either side, and how fast that changes.
  const turned = (u, v) => Math.atan2(Math.sin(v.facing - u.facing), Math.cos(v.facing - u.facing));
  const rate = [];
  for (let i = 1; i + 1 < rows.length; i++) rate.push([rows[i].t, turned(rows[i - 1], rows[i + 1]) / ((rows[i + 1].t - rows[i - 1].t) / 1000)]);
  let jerk = 0;
  for (let i = 1; i + 1 < rate.length; i++) jerk = Math.max(jerk, Math.abs(rate[i + 1][1] - rate[i - 1][1]) / ((rate[i + 1][0] - rate[i - 1][0]) / 1000));
  dump(`turn-${label}`, rows);
  check(`${label}: then it walks off, and the body's turning speed never jumps`, walked > 1 && jerk < 150, `walked ${walked.toFixed(2)} m, turning speed changing at most ${jerk.toFixed(0)} rad/s each second`);
  return rows;
}

// ---------- stopping from a walk: the knees always bend forward ----------
async function stop(p, label) {
  await standAt(p, [11.5, 11, 0], 0, 1200);
  const r = await p.evaluate(() => new Promise(res => {
    const L = __loft, m = L.me, B = m.bones, V = L.camera.position.constructor, look = m.lookAround, t0 = performance.now();
    const P = o => o.getWorldPosition(new V());
    let letGo = 0, worst = Infinity, at = '';
    L.keys.add('KeyW');
    m.lookAround = (...a) => {
      look(...a);
      const f = L.facing, ahead = new V(Math.sin(f), 0, Math.cos(f)), now = performance.now();
      if (!letGo) {
        // Let go with the right foot swinging through ahead of the hips: the standing pose then puts it well back.
        const fr = P(B.foot_r).sub(L.pos).dot(ahead), fl = P(B.foot_l).sub(L.pos).dot(ahead);
        if (now - t0 > 1500 && fr > 0.15 && fl < -0.2) { L.keys.delete('KeyW'); letGo = now; }
        else if (now - t0 > 5000) { L.keys.delete('KeyW'); m.lookAround = look; res(null); }
        return;
      }
      for (const s of ['l', 'r']) {
        const h = P(B['thigh_' + s]), ha = P(B['foot_' + s]).sub(h), hk = P(B['calf_' + s]).sub(h);
        const fwd = hk.addScaledVector(ha, -hk.dot(ha) / ha.lengthSq()).dot(ahead);
        if (fwd < worst) { worst = fwd; at = `${s === 'l' ? 'left' : 'right'} knee, ${Math.round(now - letGo)} ms after stopping`; }
      }
      if (now - letGo > 1500) { m.lookAround = look; res({ worst, at }); }
    };
  }));
  check(`${label}: stopping from a walk, neither knee ever bends backwards`, !!r && r.worst > 0.01, r ? `the least a knee stood ahead of the line from hip to ankle: ${(r.worst * 100).toFixed(1)} cm (${r.at})` : 'never caught the right foot ahead to let go');
}

// ---------- the face blur stays on my head while the hips drop on the stairs ----------
async function blur(p, label, aspect) {
  await p.evaluate(() => __loft.me.setLook({ head: 'mosaic', hood: null }));
  await p.evaluate(() => {
    const m = __loft.me, tick = m.tickMosaic;
    m.__tickBefore = tick;
    m.tickMosaic = (now, cam, u) => { tick(now, cam, u); const h = m.headNow().project(cam); window.__veils?.push([u.centre.value.x, u.centre.value.y, u.radius.value, (h.x + 1) / 2, (h.y + 1) / 2, window.__legs?.state?.shift || 0]); };
  });
  await p.evaluate(q => { __loft.pos.set(q.x, q.y + 0.05, q.z); __loft.yaw = 0; }, b2t(0.75, 4.6, 3));
  await p.waitForTimeout(900);
  await p.evaluate(() => { window.__veils = []; });
  await p.keyboard.down('KeyW'); await p.waitForTimeout(2200); await p.keyboard.up('KeyW');
  const v = await p.evaluate(() => { const v = window.__veils; window.__veils = null; __loft.me.tickMosaic = __loft.me.__tickBefore; __loft.me.setLook({ head: 'hood', hood: null }); return v; });
  const dropped = v.filter(x => x[5] < -0.05 && x[2] > 0);
  const worst = dropped.reduce((m, x) => Math.max(m, Math.hypot((x[0] - x[3]) * aspect, x[1] - x[4]) / x[2]), 0);
  check(`${label}: walking down the stairs, the face blur stays over my head as the hips drop`, dropped.length > 20 && worst < 0.5, `${dropped.length} frames with the hips down, my head at most ${(worst * 100).toFixed(0)}% of the blur's radius from its middle`);
}

async function timing(b) {
  for (const [name, opts, rate] of [['desktop', { viewport: { width: 1366, height: 768 } }, 1], ['phone slowed 4x', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, 4]]) {
    const { ctx, p } = await open(b, opts, 'medium');
    const cdp = await ctx.newCDPSession(p);
    await p.evaluate(() => {
      window.__lt = []; window.__ft = [];
      const l = window.__legs;
      if (l) { const tick = l.tick; l.tick = (dt, s) => { const t = performance.now(); tick(dt, s); window.__lt.push(performance.now() - t); }; }
      let last = performance.now();
      const loop = now => { window.__ft.push(now - last); last = now; requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    });
    if (rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    await p.evaluate(() => { window.__lt = []; window.__ft = []; });
    await stairs(p, `${name}`, opts.hasTouch);
    await turn(p, `${name}`, opts.hasTouch);
    const { lt, ft } = await p.evaluate(() => ({ lt: window.__lt, ft: window.__ft }));
    if (rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const q = (t, k) => t[Math.min(t.length - 1, Math.floor(t.length * k))];
    ft.sort((a, b) => a - b); lt.sort((a, b) => a - b);
    console.log(`${name}: frames ${ft.length}, median ${q(ft, 0.5).toFixed(1)} ms, 95th ${q(ft, 0.95).toFixed(1)} ms, worst ${ft[ft.length - 1].toFixed(1)} ms, over 50 ms ${ft.filter(x => x > 50).length}`);
    if (lt.length) console.log(`${name}: the legs' own work, ${lt.length} frames: median ${q(lt, 0.5).toFixed(3)} ms, 99th ${q(lt, 0.99).toFixed(3)} ms, worst ${lt[lt.length - 1].toFixed(3)} ms`);
    else console.log(`${name}: no legs here (main)`);
    await ctx.close();
  }
}

(async () => {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    if (TIMING) await timing(b);
    else {
      const d = await open(b, { viewport: { width: 1280, height: 720 } });
      await stairs(d.p, 'desktop');
      // Slow frames: a step up lifts me off the floor for more frames, and my feet must still never sink into a tread.
      const cdp = await d.ctx.newCDPSession(d.p);
      for (const rate of [2, 4]) { await cdp.send('Emulation.setCPUThrottlingRate', { rate }); await stairs(d.p, `desktop slowed ${rate}x`); }
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await treads(d.p, 'desktop');
      await edges(d.p, 'desktop');
      await drops(d.p, 'desktop');
      await held(d.p, 'desktop');
      await turn(d.p, 'desktop');
      await stop(d.p, 'desktop');
      await blur(d.p, 'desktop', 1280 / 720);
      check('desktop: no page errors, console errors or failed requests', d.errs.length === 0, d.errs.slice(0, 6).join(' | '));
      await d.ctx.close();
      const m = await open(b, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await stairs(m.p, 'phone', true);
      await treads(m.p, 'phone', 3, [Math.PI]);
      await turn(m.p, 'phone', true);
      check('phone: no page errors, console errors or failed requests', m.errs.length === 0, m.errs.slice(0, 6).join(' | '));
      await m.ctx.close();
    }
  } finally { await b.close(); }
  console.log(TIMING ? 'TIMED' : fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
