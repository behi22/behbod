// Turning on the spot: the body turns to face the way it is asked to go before it walks there, and the feet step round
// under it instead of sliding or spinning on a point.
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// slow: below this ground speed (m/s) a change of way is a turn on the spot; max: the body's top turning speed (rad/s);
// ease: how quickly it gets up to that speed; brake: how hard it slows (rad/s each second), from as late as lets it
// stop on the way asked, so it never overshoots or stops dead; open: between these angles from the way asked (rad) the
// walk opens up from nothing to full; done: a turn under way carries on into the walk until it turns slower than this
// (rad/s), so the body's turning speed never jumps as the walk takes over.
export const TURN = { slow: 1, max: 6, ease: 10, brake: 20, open: [1.2, 0.35], done: 1 };

// One frame of the turn. want: the heading asked for (rad, as `facing`), or null with no input; hs: the ground speed.
// Returns the new facing and turning speed, the share of the asked speed to let through, and whether it applied (at a
// walk or faster, with no turn under way, the body follows its own way of travel instead, as before).
export function turnTick(facing, spin, want, hs, dt, o = TURN) {
  if (hs >= o.slow && Math.abs(spin) < o.done) return { facing, spin: 0, gate: 1, on: false };
  const off = want === null ? 0 : wrap(want - facing), room = Math.sqrt(2 * o.brake * Math.abs(off));
  spin += ((want === null ? 0 : Math.sign(off) * Math.min(o.max, room)) - spin) * Math.min(1, dt * o.ease);
  if (want !== null && Math.sign(spin) === Math.sign(off) && Math.abs(spin) > room) spin = Math.sign(off) * room;
  let turn = spin * dt;
  if (want !== null && Math.sign(turn) !== -Math.sign(off) && Math.abs(turn) >= Math.abs(off)) { turn = off; spin = dt > 0 ? off / dt : 0; }
  const left = Math.abs(off - turn);
  return { facing: facing + turn, spin, gate: want === null ? 1 : smooth(o.open[0], o.open[1], left), on: true };
}

// far, twist: a planted foot this far (m) or turned this far (rad) from its place under the body steps; settle*: once
// the body has stood still for settleAfter seconds, smaller errors are squared up, once per stop; maxTwist: beyond this
// a planted foot pivots on its ball rather than twist the leg further; lift: how high a step lifts the foot (m); dur:
// a step's time (s), quicker the faster the turn; lead: a step aims where the body will be as it lands; gap: the other
// foot waits this long after a landing; jump: the body moved further than this in one frame (it was put somewhere), so
// the feet are put under it without a step; urge: turning, a foot steps that much sooner for each rad/s of the turn, as
// a person turning on the spot steps off at once.
export const STEP = { far: 0.14, twist: 0.6, settleFar: 0.035, settleTwist: 0.15, settleAfter: 0.3, maxTwist: 0.9, lift: 0.07, dur: [0.2, 0.32], lead: 1, gap: 0.03, jump: 0.6, urge: 0.3 };

// The standing feet. Each tick takes the body (x, z, facing, vx, vz, spin), where each foot rests in the body's own
// frame ([x, z, yaw], body +z ahead, as three's object space) and how much the standing layer counts (0 walking, 1
// standing). Returns each foot's place, yaw and lift, and which feet landed this frame.
export function makeStance(o = STEP) {
  const feet = [{ x: 0, z: 0, yaw: 0, step: null }, { x: 0, z: 0, yaw: 0, step: null }];
  let ready = false, still = 0, since = 1, bx = 0, bz = 0, settled = false, lastFoot = -1;
  const spot = (r, f, x, z) => ({ x: x + r[0] * Math.cos(f) + r[1] * Math.sin(f), z: z - r[0] * Math.sin(f) + r[1] * Math.cos(f), yaw: f + r[2] });
  const place = (i, s) => Object.assign(feet[i], { x: s.x, z: s.z, yaw: s.yaw, step: null });

  function tick(dt, body, rest, w) {
    const landed = [];
    const jumped = Math.hypot(body.x - bx, body.z - bz) > o.jump;
    bx = body.x; bz = body.z;
    if (w < 0.01 || !ready || jumped) {
      for (let i = 0; i < 2; i++) place(i, spot(rest[i], body.facing, body.x, body.z));
      ready = w >= 0.01; still = 0; since = 1; settled = false; lastFoot = -1;
      return out(landed);
    }
    for (let i = 0; i < 2; i++) {
      const s = feet[i].step;
      if (!s) continue;
      s.t += dt / s.dur;
      if (s.t >= 1) { place(i, { x: s.tx, z: s.tz, yaw: s.tyaw }); landed.push(i); since = 0; lastFoot = i; }
    }
    since += dt;
    if (Math.hypot(body.vx, body.vz) > 0.05 || Math.abs(body.spin) > 0.05) { still = 0; settled = false; } else still += dt;
    // A planted foot turns on its ball once the body has turned past it as far as a leg twists.
    for (let i = 0; i < 2; i++) {
      const f = feet[i];
      if (f.step) continue;
      const tw = wrap(body.facing + rest[i][2] - f.yaw);
      if (Math.abs(tw) > o.maxTwist) f.yaw += tw - Math.sign(tw) * o.maxTwist;
    }
    if (!feet[0].step && !feet[1].step && since >= o.gap && w > 0.9) {
      let pick = -1, best = 0, loose = -1, settle = 0;
      for (let i = 0; i < 2; i++) {
        const f = feet[i], s = spot(rest[i], body.facing, body.x, body.z);
        const d = Math.hypot(f.x - s.x, f.z - s.z), tw = Math.abs(wrap(s.yaw - f.yaw));
        // The feet take turns, as a person's do; turning, the foot on the side turned to goes first, opening the stance.
        const leads = lastFoot >= 0 ? (lastFoot === i ? 0.5 : 1) : Math.abs(body.spin) > 0.5 && Math.sign(body.spin) === Math.sign(rest[i][0]) ? 1.3 : 1;
        const score = Math.max(d / o.far, tw / o.twist) * leads * (1 + Math.abs(body.spin) * o.urge), off = Math.max(d / o.settleFar, tw / o.settleTwist);
        if (score > best) { best = score; pick = i; }
        if (off > settle) { settle = off; loose = i; }
      }
      // Squaring up is done once the body has stood still a moment, and then not again until it moves: the idle's own
      // sway never sets the feet shuffling.
      const squaring = best < 1 && !settled && still >= o.settleAfter;
      if (squaring && settle < 1) settled = true;
      if (squaring && settle >= 1) pick = loose;
      if (pick >= 0 && (best >= 1 || (squaring && settle >= 1))) {
        const dur = best >= 1 ? Math.min(o.dur[1], Math.max(o.dur[0], o.dur[1] - 0.02 * Math.abs(body.spin))) : o.dur[1];
        const lead = Math.max(-0.6, Math.min(0.6, body.spin * dur * o.lead));
        const to = spot(rest[pick], body.facing + lead, body.x + body.vx * dur, body.z + body.vz * dur);
        const f = feet[pick], dist = Math.hypot(to.x - f.x, to.z - f.z);
        const ex = body.x + body.vx * dur, ez = body.z + body.vz * dur, a0 = Math.atan2(f.x - body.x, f.z - body.z);
        // Round the body the way it turns, never the long way back against the turn.
        let da = wrap(Math.atan2(to.x - ex, to.z - ez) - a0);
        if (Math.abs(body.spin) > 0.5 && Math.abs(da) > 1.5 && Math.sign(da) !== Math.sign(body.spin)) da += 2 * Math.PI * Math.sign(body.spin);
        f.step = { fx: f.x, fz: f.z, fyaw: f.yaw, tx: to.x, tz: to.z, tyaw: f.yaw + wrap(to.yaw - f.yaw), t: 0, dur, h: o.lift * Math.min(1, Math.max(0.45, dist / 0.2)),
          cx: body.x, cz: body.z, ex, ez, a0, da, r0: Math.hypot(f.x - body.x, f.z - body.z), r1: Math.hypot(to.x - ex, to.z - ez) };
      }
    }
    return out(landed);
  }
  function out(landed) {
    return {
      feet: feet.map(f => {
        const s = f.step;
        if (!s) return { x: f.x, z: f.z, yaw: f.yaw, lift: 0, stepping: false };
        // The foot swings round the body's middle (as the body turns) rather than cutting across under it, so it never
        // passes through the other foot.
        const e = s.t * s.t * (3 - 2 * s.t), cx = s.cx + (s.ex - s.cx) * e, cz = s.cz + (s.ez - s.cz) * e;
        const a = s.a0 + s.da * e, r = s.r0 + (s.r1 - s.r0) * e;
        return { x: cx + Math.sin(a) * r, z: cz + Math.cos(a) * r, yaw: s.fyaw + (s.tyaw - s.fyaw) * e, lift: s.h * Math.sin(Math.PI * s.t), stepping: true };
      }),
      landed,
    };
  }
  return { tick, reset() { ready = false; }, get feet() { return feet; } };
}
