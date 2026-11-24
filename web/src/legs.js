import * as THREE from 'three';
import { makeFooting } from './pure/footing.js';
import { reach } from './pure/ik.js';
import { makeStance } from './pure/steps.js';

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const UP = new THREE.Vector3(0, 1, 0);
// The toe's tip and the heel, in lengths from the ankle to the ball.
const TOE = 1.55, HEEL = -0.4;
// How the lead into a turn shares out between the chest and the neck.
const LEAD = [['spine_03', 0.4], ['neck_01', 0.6]];
// Walking, the hips drop at most this far (m) for a lower foot: the walk's stride spans about three stair treads, so
// reaching all the way down to the lower foot would sink me into a squat on every stair.
const WALK_DROP = 0.2;

// My feet on the floor they are over: each foot is put on the step or edge under it, the hips go down to the lower
// foot and the knees bend to make up the rest. Standing, the feet stay where they were put and step round as I turn.
// Runs after the animation each frame; the floor comes from the house's floor plan, never from rays.
//   tick(dt, { on, stand, vx, vz, spin }): on, the feet follow the floor; stand, the standing feet may step.
export function makeLegs(me, col, { onStep } = {}) {
  const B = me.bones, root = me.root;
  if (!B.pelvis || !B.thigh_l || !B.thigh_r) return { tick() {}, get state() { return null; } };
  const footing = makeFooting(col.floors, col.boxes);
  const stance = makeStance();
  const leg = s => ({ thigh: B['thigh_' + s], calf: B['calf_' + s], foot: B['foot_' + s], ball: B['ball_' + s], g: null, back: 0, px: null, pz: 0,
    c0: new THREE.Vector3(), b0: new THREE.Vector3(), a0: new THREE.Vector3(), len: 0, up: 0, q0: new THREE.Quaternion(), rest: [0, 0, 0], t: new THREE.Vector3(), dyaw: 0, short: 0, locked: false, lockG: 0, lockBack: 0, ux: 0, uz: 0,
    sol: { mid: [0, 0, 0], end: [0, 0, 0], short: 0 } });
  const legs = [leg('l'), leg('r')];
  for (const l of legs) l.chain = [l.thigh, l.calf, l.foot, l.ball];
  const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
  const a = new THREE.Vector3(), k = new THREE.Vector3(), c = new THREE.Vector3(), from = new THREE.Vector3(), to = new THREE.Vector3(), want = new THREE.Vector3();
  const qp = new THREE.Quaternion(), qb = new THREE.Quaternion(), r = new THREE.Quaternion();
  const A = [0, 0, 0], K = [0, 0, 0], C = [0, 0, 0], T = [0, 0, 0], ahead = [0, 0, 0];
  let w = 0, sw = 0, shift = 0, last = null, lx = null, lz = 0;
  // Made once and filled in each frame: the house makes nothing new per frame.
  const body = { x: 0, z: 0, facing: 0, vx: 0, vz: 0, spin: 0 }, rests = [legs[0].rest, legs[1].rest];
  let fx = 0, fz = 0, fux = 0, fuz = 0, frx = 0, frz = 0, fry = 0;
  const floorAt = t => footing.foot(fx + fux * t, fz + fuz * t, frx, frz, fry);

  const posOf = (o, v) => { o.matrixWorld.decompose(v, _q, _s); return v; };
  const turnOf = (o, out) => { o.matrixWorld.decompose(_p, out, _s); return out; };
  // Turns a bone about its own place so that a point of its child's at `now` goes to `goal`, in world space.
  function aim(bone, now, goal) {
    posOf(bone, a);
    from.subVectors(now, a).normalize(); to.subVectors(goal, a).normalize();
    r.setFromUnitVectors(from, to);
    turnOf(bone.parent, qp).invert();
    bone.quaternion.copy(qp.multiply(r.multiply(turnOf(bone, qb))));
    bone.updateWorldMatrix(false, true);
  }

  // The mixer only writes a bone whose animated value changed since the last frame, so in a held pose my bones would
  // keep last frame's legs and each frame's would add to them: each frame starts again from the animation's own pose.
  const turned = [...legs.flatMap(l => [l.thigh, l.calf, l.foot]), ...LEAD.filter(([n]) => B[n]).map(([n]) => B[n])];
  const held = [B.pelvis.position, ...turned.map(o => o.quaternion)].map(v => ({ v, anim: v.clone(), out: v.clone(), set: false }));
  function tick(dt, s) {
    for (let i = 0; i < held.length; i++) { const h = held[i]; if (h.set && h.v.equals(h.out)) h.v.copy(h.anim); h.anim.copy(h.v); h.set = false; }
    tickLegs(dt, s);
    for (let i = 0; i < held.length; i++) { const h = held[i]; h.out.copy(h.v); h.set = true; }
  }
  function tickLegs(dt, s) {
    const on = !!s.on;
    w += ((on ? 1 : 0) - w) * Math.min(1, dt * (on ? 8 : 14));
    if (!on && w < 0.002) { w = 0; sw = 0; shift = 0; stance.reset(); for (let i = 0; i < 2; i++) { const l = legs[i]; l.g = null; l.back = 0; l.px = null; l.locked = false; } last = null; lx = null; return; }
    const hs = Math.hypot(s.vx, s.vz), spin = s.spin || 0;
    // Standing still, or turning on the spot while the walk is only just starting, the feet are planted and step.
    const standGoal = on && s.stand ? Math.max(1 - Math.min(1, Math.max(0, (hs - 0.25) / 0.65)), hs < 1.2 ? Math.min(1, Math.abs(spin) / 2.5) : 0) : 0;
    sw += (standGoal - sw) * Math.min(1, dt * 10);
    const f = root.rotation.y, cf = Math.cos(f), sf = Math.sin(f), rx = root.position.x, ry = root.position.y, rz = root.position.z;
    // Put somewhere else in one go (leaving a seat, the desk): the feet start from the floor there, not glide to it.
    if (lx !== null && Math.hypot(rx - lx, rz - lz) > 0.6) for (let i = 0; i < 2; i++) { const l = legs[i]; l.g = null; l.px = null; l.locked = false; }
    lx = rx; lz = rz;
    B.pelvis.updateWorldMatrix(true, false);
    for (let i = 0; i < 2; i++) {
      const l = legs[i];
      for (let j = 0; j < 4; j++) l.chain[j].updateWorldMatrix(false, false);
      posOf(l.foot, l.c0); posOf(l.ball, l.b0); turnOf(l.foot, l.q0); posOf(l.thigh, l.a0);
      l.len = l.a0.distanceTo(posOf(l.calf, k)) + k.distanceTo(l.c0);
      const dx = l.c0.x - rx, dz = l.c0.z - rz;
      l.rest[0] = dx * cf - dz * sf; l.rest[1] = dx * sf + dz * cf;
      l.rest[2] = wrap(Math.atan2(l.b0.x - l.c0.x, l.b0.z - l.c0.z) - f);
    }
    body.x = rx; body.z = rz; body.facing = f; body.vx = s.vx; body.vz = s.vz; body.spin = spin;
    const st = stance.tick(dt, body, rests, sw);
    if (sw > 0.9) for (let i = 0; i < st.landed.length; i++) onStep?.(st.landed[i]);
    let dip = 0;
    for (let i = 0; i < 2; i++) {
      const l = legs[i], ft = st.feet[i];
      const hx = l.c0.x + (ft.x - l.c0.x) * sw, hz = l.c0.z + (ft.z - l.c0.z) * sw;
      l.dyaw = sw * wrap(ft.yaw - (f + l.rest[2]));
      // Along the foot, in lengths from the ankle to the ball: the foot stands on what is under its middle, or under its
      // heel where that is higher (the front then hangs over a step down, never the heel inside a tread). A toe that
      // would run into a step up draws the foot back clear of it; a heel may hang over a step down, as on real stairs.
      const bdx = l.b0.x - l.c0.x, bdz = l.b0.z - l.c0.z, cy = Math.cos(l.dyaw), sy = Math.sin(l.dyaw);
      const ux = l.ux = bdx * cy + bdz * sy, uz = l.uz = -bdx * sy + bdz * cy;
      fx = hx; fz = hz; fux = ux; fuz = uz; frx = rx; frz = rz; fry = ry;
      const up = l.up = l.c0.y - ry;
      let g = Math.max(floorAt(0.5), floorAt(HEEL)), back = 0;
      if (floorAt(TOE) > g + 0.02) {
        let lo = 0.5, hi = TOE;
        for (let n = 0; n < 4; n++) { const m = (lo + hi) / 2; if (floorAt(m) > g + 0.02) hi = m; else lo = m; }
        back = Math.min(1, TOE - hi + 0.08);
      }
      // A foot on its way somewhere looks a little ahead along its way (no further than the next step's edge), so it
      // is up over that step before it gets there.
      if (l.px !== null && dt > 0) {
        const vx = (hx - l.px) / dt, vz = (hz - l.pz) / dt, v = Math.hypot(vx, vz);
        if (v > 0.3) { const k = Math.min(0.12, v * 0.06) / v; g = Math.max(g, footing.foot(hx + ux * 0.5 + vx * k, hz + uz * 0.5 + vz * k, rx, rz, ry)); }
      }
      l.px = hx; l.pz = hz;
      // A planted foot keeps the floor it landed on until it steps again: at a tread's edge the reading would flip.
      if (sw > 0.9 && !ft.stepping) { if (l.locked) { g = l.lockG; back = l.lockBack; } else { l.locked = true; l.lockG = g; l.lockBack = back; } } else l.locked = false;
      // Up onto a higher floor at once (never into it), down to a lower one smoothly.
      const e = Math.min(1, dt * 25);
      l.g = l.g === null || g > l.g ? g : l.g + (g - l.g) * e;
      l.back += (back - l.back) * e;
      l.t.set(hx - ux * l.back, l.g + up + sw * ft.lift, hz - uz * l.back);
      dip = Math.max(dip, ft.lift);
    }
    shift = Math.min(0.3, Math.max(-WALK_DROP - (0.45 - WALK_DROP) * sw, Math.min(legs[0].g, legs[1].g) - ry)) - sw * dip * 0.15;
    // Standing, a leg that would have to stretch past its length to reach its foot (a planted foot crossed under as I
    // turn, a long step down) brings the hips down that little more, so the foot stays where it was put.
    let reachDrop = 0;
    for (let i = 0; i < 2; i++) {
      const l = legs[i];
      const t = c.lerpVectors(l.c0, l.t, w), h = Math.hypot(t.x - l.a0.x, t.z - l.a0.z), v = l.a0.y + shift * w - t.y, L = l.len * 0.985;
      if (L > h && h * h + v * v > L * L) reachDrop = Math.max(reachDrop, v - Math.sqrt(L * L - h * h));
    }
    shift -= Math.min(0.12, reachDrop) * sw / Math.max(w, 1e-3);
    posOf(B.pelvis, want).y += shift * w;
    B.pelvis.position.copy(B.pelvis.parent.worldToLocal(want));
    B.pelvis.updateWorldMatrix(false, false);
    for (let i = 0; i < 2; i++) {
      const l = legs[i];
      for (let j = 0; j < 3; j++) l.chain[j].updateWorldMatrix(false, false);
      posOf(l.thigh, a).toArray(A); posOf(l.calf, k); posOf(l.foot, c).toArray(C);
      // The knee turns half as far as a planted foot is turned from the body: the whole leg turned about the hip, so
      // both bones keep their lengths.
      k.sub(a).applyAxisAngle(UP, l.dyaw * w * 0.5).add(a).toArray(K);
      c.sub(a).applyAxisAngle(UP, l.dyaw * w * 0.5).add(a).toArray(C);
      l.t.lerpVectors(l.c0, l.t, w).toArray(T);
      ahead[0] = Math.sin(f); ahead[2] = Math.cos(f);
      const sol = reach(A, K, C, T, ahead, l.sol);
      // A foot the leg cannot reach (the hips held up walking the stairs) comes up onto whatever is under where it does
      // reach, never into the edge of a tread.
      for (let n = 0; n < 3 && sol.short > 1e-3; n++) {
        const ex = sol.end[0], ey = sol.end[1], ez = sol.end[2], g = Math.max(footing.foot(ex + l.ux * 0.5, ez + l.uz * 0.5, rx, rz, ry), footing.foot(ex + l.ux * HEEL, ez + l.uz * HEEL, rx, rz, ry));
        if (g + l.up <= ey) break;
        T[1] += g + l.up - ey;
        reach(A, K, C, T, ahead, sol);
      }
      l.short = sol.short;
      posOf(l.calf, k);
      aim(l.thigh, k, want.fromArray(sol.mid));
      posOf(l.foot, c);
      aim(l.calf, c, want.fromArray(sol.end));
      // The foot keeps the turn the animation gave it, plus the turn of where it was planted.
      r.setFromAxisAngle(UP, l.dyaw * w).multiply(l.q0);
      turnOf(l.calf, qp).invert();
      l.foot.quaternion.copy(qp.multiply(r));
      l.foot.updateWorldMatrix(false, true);
    }
    // Turning on the spot, the head and chest lead the way round a little ahead of the hips.
    const lead = Math.max(-0.35, Math.min(0.35, spin * 0.06)) * sw * w;
    if (Math.abs(lead) > 1e-3) for (let i = 0; i < LEAD.length; i++) if (B[LEAD[i][0]]) turnBy(B[LEAD[i][0]], lead * LEAD[i][1]);
    last = st;
  }
  // Turns a bone about the world's up by `angle`, keeping the rest of its turn.
  function turnBy(bone, angle) {
    bone.updateWorldMatrix(true, false);
    r.setFromAxisAngle(UP, angle);
    turnOf(bone.parent, qp).invert();
    bone.quaternion.copy(qp.multiply(r.multiply(turnOf(bone, qb))));
  }
  return {
    tick,
    // For the tests: the weights, the hips' drop and each foot's floor, aim, how far short of it the leg fell, and step.
    get state() { return { w, sw, shift, feet: legs.map((l, i) => ({ floor: l.g, up: l.up, at: l.t.toArray(), short: l.short, stepping: !!last?.feet[i].stepping })) }; },
  };
}
