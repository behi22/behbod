import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { lit } from './lit.js';
import { place } from '../pure/stages.js';
import { spring, springStep, kick, critical } from '../pure/springs.js';

// What you shoot at: steel plates on pop-up stands, walkers that cross the hall between the fins, and drones.
// Each is built once from simple machined shapes and kept in a pool. A target knows how to stand up, how to be hit
// (which part a shot struck), how to come apart, and how to leave if nobody hit it.
const std = (color, rough, metal, extra = {}) => lit(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));
const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), fog: false });
// A plate's radius, and how far its middle sits above the hinge it folds on.
const PLATE_R = 0.25, PLATE_UP = 0.29;
const rbox = (w, h, d, r = 0.02) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.2, h / 2.2, d / 2.2));

export function makeTargets(stage, fx, meta, { sfx } = {}) {
  const R = meta.range, cx = R.line[0], z0 = -R.line[1];
  // Range space (x across, d downrange, h up) into the room.
  const toRoom = (x, d, h, out) => out.set(cx + x, h, z0 + d);
  const M = {
    steel: std(0xa3a9b1, 0.34, 1), dark: std(0x1d1f24, 0.5, 0.7), orange: std(0xff5a1c, 0.45, 0.05), white: std(0xe9ebee, 0.5, 0.05),
    armour: std(0x8d949e, 0.36, 0.65), frame: std(0x24272e, 0.42, 0.85), joint: std(0x111215, 0.6, 0.5), hazard: std(0xd07e12, 0.5, 0.2), hull: std(0x1f2228, 0.38, 0.8),
    core: glow(3.4, 1.3, 0.25), eye: glow(3.6, 0.5, 0.2), visor: glow(3.0, 0.35, 0.2), dead: glow(0.05, 0.03, 0.02),
    blur: new THREE.MeshBasicMaterial({ color: 0x8892a0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, fog: false }),
  };
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), ray = new THREE.Ray(), inv = new THREE.Matrix4(), box = new THREE.Box3(), sphere = new THREE.Sphere();
  const live = new Map(), pools = { plate: [], walker: [], drone: [] }, leaving = [];

  // ---------- the steel plate ----------
  function buildPlate() {
    const g = new THREE.Group(), arm = new THREE.Group();
    const post = mesh(new THREE.CylinderGeometry(0.02, 0.026, 1, 10), M.dark), foot = mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.04, 16), M.dark, 0, 0.02, 0);
    const hinge = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 10).rotateZ(Math.PI / 2), M.steel);
    const neck = mesh(rbox(0.034, PLATE_UP, 0.014, 0.004), M.dark, 0, PLATE_UP / 2, 0.004);
    // A steel disc with a painted face: white, an orange ring and an orange middle, to be seen from the line.
    const disc = mesh(new THREE.CylinderGeometry(PLATE_R, PLATE_R, 0.014, 32).rotateX(Math.PI / 2), M.steel, 0, PLATE_UP, 0);
    const face = mesh(new THREE.CircleGeometry(PLATE_R - 0.012, 32), M.white, 0, PLATE_UP, -0.0074);
    const ring = mesh(new THREE.RingGeometry(0.125, 0.175, 32), M.orange, 0, PLATE_UP, -0.0078), dot = mesh(new THREE.CircleGeometry(0.062, 24), M.orange, 0, PLATE_UP, -0.0078);
    face.rotation.y = ring.rotation.y = dot.rotation.y = Math.PI;
    arm.add(neck, disc, face, ring, dot);
    g.add(post, foot, hinge, arm);
    stage.add(g); g.visible = false;
    return { kind: 'plate', g, arm, post, hinge, swing: spring(120, 5), rise: spring(260, critical(260) * 0.6), size: 1, up: 0, downAt: 0 };
  }
  function placePlate(o, s, at) {
    // The stand telescopes out of the floor; the hinge sits a hand under the plate's middle.
    const top = at.h - PLATE_UP * o.size;
    o.post.scale.y = Math.max(0.05, top - 0.03); o.post.position.y = 0.04 + (top - 0.03) / 2;
    o.hinge.position.y = top; o.arm.position.y = top;
    o.arm.scale.setScalar(o.size);
    toRoom(at.x, at.d, 0, o.g.position);
    o.g.position.y = -(at.h + 0.25) * (1 - o.rise.x);
    o.arm.rotation.x = o.swing.x;
  }

  // ---------- the walker ----------
  function buildWalker() {
    const g = new THREE.Group(), body = new THREE.Group();
    g.add(body);
    const part = {};
    // Model axes: x ahead (the way it walks), y up, z to its left. A dark frame carrying paler armour plates, an
    // orange yoke across the shoulders, the core glowing through its chest from side to side, a lit visor.
    part.pelvis = new THREE.Group(); part.pelvis.position.set(0, 0.93, 0);
    part.pelvis.add(mesh(rbox(0.26, 0.15, 0.3, 0.03), M.frame), mesh(rbox(0.2, 0.09, 0.34, 0.02), M.joint, 0, -0.05, 0), mesh(rbox(0.1, 0.12, 0.2, 0.02), M.armour, 0.1, 0.0, 0));
    part.torso = new THREE.Group(); part.torso.position.set(0.0, 1.27, 0);
    const ringGeo = new THREE.TorusGeometry(0.1, 0.02, 8, 24);
    part.torso.add(
      mesh(rbox(0.2, 0.22, 0.27, 0.03), M.frame, 0, -0.2, 0), mesh(rbox(0.36, 0.34, 0.46, 0.05), M.armour, 0.01, 0.03, 0), mesh(rbox(0.04, 0.2, 0.3, 0.012), M.frame, 0.187, 0.05, 0),
      mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.474, 22).rotateX(Math.PI / 2), M.core, 0.01, 0.0, 0),
      mesh(ringGeo, M.joint, 0.01, 0.0, 0.232), mesh(ringGeo, M.joint, 0.01, 0.0, -0.232), mesh(rbox(0.012, 0.028, 0.2, 0.004), M.core, 0.209, 0.05, 0),
      mesh(rbox(0.3, 0.05, 0.52, 0.014), M.hazard, 0.0, 0.2, 0), mesh(rbox(0.14, 0.32, 0.3, 0.03), M.frame, -0.24, 0.02, 0),
      mesh(rbox(0.02, 0.2, 0.06, 0.006), M.joint, -0.315, 0.03, 0.08), mesh(rbox(0.02, 0.2, 0.06, 0.006), M.joint, -0.315, 0.03, -0.08), mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.36, 6), M.joint, -0.26, 0.36, 0.11));
    part.core = part.torso.children[3]; part.slot = part.torso.children[6];
    part.head = new THREE.Group(); part.head.position.set(0.03, 1.665, 0);
    part.head.add(mesh(rbox(0.22, 0.15, 0.2, 0.04), M.frame), mesh(rbox(0.05, 0.04, 0.212, 0.012), M.visor, 0.092, 0.005, 0), mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.08, 12), M.joint, -0.02, -0.105, 0),
      mesh(rbox(0.13, 0.03, 0.21, 0.01), M.armour, -0.02, 0.085, 0), mesh(rbox(0.03, 0.06, 0.03, 0.008), M.joint, -0.08, 0.12, 0.06));
    part.visor = part.head.children[1];
    const limb = (side, shoulder) => {
      const top = new THREE.Group(), low = new THREE.Group();
      if (shoulder) {
        top.position.set(0, 1.44, side * 0.285);
        top.add(mesh(new THREE.SphereGeometry(0.07, 14, 10), M.joint), mesh(rbox(0.17, 0.11, 0.15, 0.03), M.armour, 0, 0.02, side * 0.02), mesh(rbox(0.085, 0.27, 0.085, 0.025), M.frame, 0, -0.18, 0));
        low.position.set(0, -0.34, 0);
        low.add(mesh(new THREE.SphereGeometry(0.052, 12, 8), M.joint), mesh(rbox(0.1, 0.25, 0.105, 0.028), M.armour, 0.005, -0.15, 0), mesh(rbox(0.075, 0.09, 0.09, 0.02), M.joint, 0, -0.32, 0));
      } else {
        top.position.set(0, 0.86, side * 0.115);
        top.add(mesh(new THREE.SphereGeometry(0.08, 14, 10), M.joint), mesh(rbox(0.13, 0.4, 0.14, 0.035), M.frame, 0, -0.22, 0), mesh(rbox(0.05, 0.26, 0.13, 0.016), M.armour, 0.062, -0.2, 0));
        low.position.set(0, -0.44, 0);
        const foot = mesh(rbox(0.27, 0.075, 0.13, 0.02), M.frame, 0.045, -0.385, 0);
        low.add(mesh(new THREE.SphereGeometry(0.066, 12, 8), M.joint), mesh(rbox(0.07, 0.09, 0.12, 0.02), M.armour, 0.05, 0.0, 0), mesh(rbox(0.11, 0.34, 0.115, 0.03), M.armour, 0, -0.2, 0), foot);
        low.userData.foot = foot;
      }
      top.add(low);
      top.userData.low = low;
      return top;
    };
    part.armL = limb(1, true); part.armR = limb(-1, true); part.legL = limb(1, false); part.legR = limb(-1, false);
    const whole = [part.pelvis, part.torso, part.head, part.armL, part.armR, part.legL, part.legR];
    body.add(...whole);
    const homes = whole.map(p => ({ p, pos: p.position.clone() }));
    // A head taller than a person, so it reads as a machine from the line.
    g.scale.setScalar(1.1);
    stage.add(g); g.visible = false;
    return { kind: 'walker', g, body, part, homes, flinch: spring(140, 9), dist: 0 };
  }
  function resetWalker(o) {
    for (const h of o.homes) { o.body.add(h.p); h.p.position.copy(h.pos); h.p.quaternion.identity(); h.p.scale.setScalar(1); h.p.visible = true; }
    o.part.core.material = o.part.slot.material = M.core; o.part.visor.material = M.visor;
    o.flinch.x = o.flinch.v = 0;
  }
  function poseWalker(o, s, at, dt) {
    toRoom(at.x, at.d, 0, o.g.position);
    o.g.rotation.y = at.heading > 0 ? 0 : Math.PI;
    // One stride every 1.3 m; a leg's knee folds while it swings forward.
    const ph = Math.abs(at.x - s.x) * (2 * Math.PI / 1.3), P = o.part, f = springStep(o.flinch, 0, dt);
    for (const [leg, off] of [[P.legL, 0], [P.legR, Math.PI]]) {
      const sw = Math.sin(ph + off), fold = Math.max(0, Math.cos(ph + off));
      leg.rotation.z = 0.5 * sw;
      leg.userData.low.rotation.z = -(0.12 + 0.85 * fold * fold);
      leg.userData.low.userData.foot.rotation.z = -(leg.rotation.z + leg.userData.low.rotation.z) * 0.8;
    }
    for (const [arm, off] of [[P.armL, Math.PI], [P.armR, 0]]) { arm.rotation.z = 0.42 * Math.sin(ph + off); arm.userData.low.rotation.z = 0.35 + 0.2 * Math.sin(ph + off); }
    o.body.position.y = 0.022 * Math.cos(ph * 2) - 0.02;
    P.torso.rotation.set(0, 0.07 * Math.sin(ph) + f * 0.5, -0.06 + f * 0.35);
    P.head.rotation.y = -0.05 * Math.sin(ph) + f * 0.3;
    P.pelvis.rotation.y = -0.09 * Math.sin(ph);
  }

  // ---------- the drone ----------
  function buildDrone() {
    const g = new THREE.Group(), body = new THREE.Group();
    g.add(body);
    // Model axes: -z is its face (it turns that toward the firing line). A dark hull under a pale top plate, four
    // guarded rotors, and one eye: a lit lens in a dark socket with a thin ring of light round it.
    const hull = mesh(new THREE.SphereGeometry(0.19, 24, 16), M.hull);
    hull.scale.set(1, 0.48, 1.14);
    const eye = mesh(new THREE.SphereGeometry(0.044, 16, 12), M.eye, 0, -0.012, -0.196), socket = mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.05, 20).rotateX(Math.PI / 2), M.joint, 0, -0.012, -0.178);
    const halo = mesh(new THREE.TorusGeometry(0.074, 0.006, 6, 28), M.eye, 0, -0.012, -0.204);
    const top = mesh(rbox(0.2, 0.045, 0.24, 0.02), M.armour, 0, 0.082, 0.02), belly = mesh(new THREE.CylinderGeometry(0.055, 0.035, 0.07, 12), M.joint, 0, -0.1, 0.03);
    const stripe = mesh(rbox(0.3, 0.02, 0.05, 0.008), M.hazard, 0, 0.032, 0.125), fin = mesh(rbox(0.012, 0.07, 0.1, 0.004), M.armour, 0, 0.13, 0.1);
    body.add(hull, eye, socket, halo, top, belly, stripe, fin);
    const rotors = [];
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const arm = new THREE.Group();
      arm.position.set(sx * 0.2, 0.02, sz * 0.17);
      const strut = mesh(rbox(0.2, 0.025, 0.03, 0.008), M.joint, -sx * 0.07, 0, -sz * 0.05);
      strut.rotation.y = -Math.atan2(sz * 0.17, sx * 0.2);
      const guard = mesh(new THREE.TorusGeometry(0.115, 0.011, 6, 24).rotateX(Math.PI / 2), M.armour, sx * 0.05, 0.02, sz * 0.04);
      const disc = mesh(new THREE.CircleGeometry(0.105, 18).rotateX(-Math.PI / 2), M.blur, sx * 0.05, 0.03, sz * 0.04);
      const hub = mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.05, 8), M.joint, sx * 0.05, 0.01, sz * 0.04);
      const blade = mesh(rbox(0.2, 0.006, 0.02, 0.002), M.joint, sx * 0.05, 0.034, sz * 0.04);
      const lamp = mesh(new THREE.SphereGeometry(0.012, 8, 6), sz < 0 ? M.visor : M.core, sx * 0.165, 0.02, sz * 0.04);
      arm.add(strut, guard, disc, hub, blade, lamp);
      body.add(arm);
      rotors.push({ arm, blade, home: arm.position.clone() });
    }
    const homes = [hull, eye, socket, halo, top, belly, stripe, fin].map(p => ({ p, pos: p.position.clone(), scale: p.scale.clone() }));
    g.scale.setScalar(1.4);
    stage.add(g); g.visible = false;
    return { kind: 'drone', g, body, eye, halo, rotors, homes, flinch: spring(160, 8), last: new THREE.Vector3(), vx: 0 };
  }
  function resetDrone(o) {
    for (const h of o.homes) { o.body.add(h.p); h.p.position.copy(h.pos); h.p.quaternion.identity(); h.p.scale.copy(h.scale); h.p.visible = true; }
    for (const r of o.rotors) { o.body.add(r.arm); r.arm.position.copy(r.home); r.arm.quaternion.identity(); r.arm.scale.setScalar(1); r.arm.visible = true; }
    o.eye.material = o.halo.material = M.eye; o.flinch.x = o.flinch.v = 0; o.vx = 0;
  }
  function poseDrone(o, s, at, age, dt, t) {
    toRoom(at.x, at.d, at.h, tmp);
    // It drops in from high at the far end over the first moments, then flies its own pattern.
    const inK = Math.min(1, age / 0.8), e = 1 - Math.pow(1 - inK, 3);
    tmp2.set(tmp.x * 0.4 + cx * 0.6, R.height - 0.5, z0 + R.far - 1.5);
    o.g.position.lerpVectors(tmp2, tmp, e);
    o.g.position.y += Math.sin(t * 5.3 + s.ph) * 0.02;
    const vx = (o.g.position.x - o.last.x) / Math.max(dt, 1e-3);
    o.vx += (vx - o.vx) * Math.min(1, dt * 6);
    o.last.copy(o.g.position);
    const f = springStep(o.flinch, 0, dt);
    o.body.rotation.set(0.06 + f * 0.6, 0, THREE.MathUtils.clamp(-o.vx * 0.16, -0.5, 0.5) + f * 0.4);
    for (const r of o.rotors) r.blade.rotation.y += dt * 70;
  }

  const build = { plate: buildPlate, walker: buildWalker, drone: buildDrone };
  // One of each is built with the rooms, so its shaders are ready before the first one walks out.
  for (const kind of Object.keys(build)) pools[kind].push(build[kind]());
  function take(kind) {
    const pool = pools[kind];
    let o = pool.find(x => !x.busy);
    if (!o) { o = build[kind](); pool.push(o); }
    o.busy = true;
    return o;
  }

  // Where a shot along this ray (in the room) meets this target: { dist, zone, point, normal } or null.
  function strike(o, origin, dir) {
    if (o.kind === 'plate') {
      // The plate's face: a disc that looks back up the hall.
      o.arm.updateWorldMatrix(true, false);
      tmp.set(0, PLATE_UP, 0).applyMatrix4(o.arm.matrixWorld);
      if (Math.abs(o.swing.x) > 0.5 || o.rise.x < 0.6 || dir.z <= 1e-4) return null;
      const t = (tmp.z - origin.z) / dir.z;
      if (t <= 0) return null;
      tmp2.copy(origin).addScaledVector(dir, t);
      if (tmp2.distanceTo(tmp) > PLATE_R * o.size) return null;
      return { dist: t, zone: 'plate', point: tmp2.clone(), normal: new THREE.Vector3(0, 0, -1) };
    }
    const frame = o.kind === 'walker' ? o.g : o.body;
    frame.updateWorldMatrix(true, false);
    inv.copy(frame.matrixWorld).invert();
    ray.origin.copy(origin).applyMatrix4(inv); ray.direction.copy(dir).transformDirection(inv);
    let best = null;
    const tryBall = (x, y, z, r, zone) => {
      const p = ray.intersectSphere(sphere.set(tmp.set(x, y, z), r), tmp2);
      if (p) { const d = p.distanceTo(ray.origin); if (!best || d < best.dist) best = { dist: d, zone, local: p.clone() }; }
    };
    const tryBox = (x0, y0, z0_, x1, y1, z1, zone) => {
      const p = ray.intersectBox(box.set(tmp.set(x0, y0, z0_), tmp2.set(x1, y1, z1)), tmp);
      if (p) { const d = p.distanceTo(ray.origin); if (!best || d < best.dist) best = { dist: d, zone, local: p.clone() }; }
    };
    if (o.kind === 'walker') {
      // What a shot counts as is what it passed through, the best first: the core, the head, the body, and a limb
      // only when it met nothing else. (It is seen side on, so an arm always hangs in front of the body; taking the
      // nearest part made most body shots count as the arm.)
      const through = [() => tryBall(0.01, 1.25, 0, 0.115, 'core'), () => tryBall(0.02, 1.63, 0, 0.145, 'head'), () => tryBox(-0.18, 0.83, -0.22, 0.19, 1.5, 0.22, 'body'),
        () => { tryBox(-0.3, 0.0, -0.19, 0.32, 0.86, 0.19, 'limb'); tryBox(-0.24, 0.92, 0.2, 0.24, 1.5, 0.34, 'limb'); tryBox(-0.24, 0.92, -0.34, 0.24, 1.5, -0.2, 'limb'); }];
      for (const look of through) { look(); if (best) break; }
    } else {
      tryBall(0, 0, 0, 0.25, 'body');
      const plain = best; best = null;
      tryBall(0, -0.012, -0.19, 0.09, 'eye');
      if (!best) best = plain;
    }
    if (!best) return null;
    const point = best.local.applyMatrix4(frame.matrixWorld);
    return { dist: point.distanceTo(origin), zone: best.zone, point, normal: tmp.copy(dir).negate().clone() };
  }

  const api = {
    get count() { return live.size; },
    live: () => [...live.values()],
    // A target appears (the run's `spawn` event).
    spawn(s) {
      const o = take(s.kind);
      o.id = s.id; o.s = s; o.dead = false; o.age = 0; o.g.visible = true;
      if (s.kind === 'plate') { o.size = s.size || 1; o.swing.x = o.swing.v = 0; o.rise.x = 0; o.rise.v = 0; o.up = 1; }
      else if (s.kind === 'walker') resetWalker(o);
      else { resetDrone(o); toRoom(s.x, s.d, s.h, o.last); }
      live.set(s.id, o);
      api.pose(o, 0, 0, 0);
      return o;
    },
    pose(o, age, dt, t) {
      const at = place(o.s, age);
      if (o.kind === 'plate') { springStep(o.rise, o.up, dt); springStep(o.swing, o.dead ? 1.45 : 0, dt); placePlate(o, o.s, at); }
      else if (o.kind === 'walker') poseWalker(o, o.s, at, dt);
      else poseDrone(o, o.s, at, age, dt, t);
    },
    // Moves everything on: live targets to where the run says they are, and the ones on their way out.
    update(dt, t, ages) {
      for (const o of live.values()) { o.age = ages(o.id); api.pose(o, o.age, dt, t); }
      for (let i = leaving.length - 1; i >= 0; i--) {
        const o = leaving[i];
        o.gone += dt;
        if (o.kind === 'plate') { o.age += dt * (o.dead ? 0 : 1); springStep(o.rise, o.gone > (o.dead ? 0.55 : 0) ? 0 : 1, dt); springStep(o.swing, o.dead ? 1.45 : 0, dt); placePlate(o, o.s, place(o.s, o.age)); }
        else if (o.kind === 'drone' && !o.dead) { o.g.position.y += dt * 9 * o.gone; o.g.position.z += dt * 6; for (const r of o.rotors) r.blade.rotation.y += dt * 70; }
        if (o.gone > (o.dead ? 3.4 : 0.9)) { o.g.visible = false; o.busy = false; leaving.splice(i, 1); }
      }
    },
    // The nearest live target on this shot's line, if any.
    hit(origin, dir, far = Infinity) {
      let best = null;
      for (const o of live.values()) { const h = strike(o, origin, dir); if (h && h.dist < far && (!best || h.dist < best.dist)) best = { ...h, id: o.id, kind: o.kind }; }
      return best;
    },
    // It was hit and is still up.
    hurt(id, h) {
      const o = live.get(id);
      if (!o) return;
      kick(o.flinch, o.kind === 'walker' ? 3.5 : 5);
      fx.impact(h.point, h.normal, 'bot', h.weak ? 1.6 : 1);
    },
    // It is finished: a plate rings and folds back; a walker or a drone comes apart.
    kill(id, h, dir) {
      const o = live.get(id);
      if (!o) return;
      live.delete(id);
      o.dead = true; o.gone = 0; leaving.push(o);
      if (o.kind === 'plate') { kick(o.swing, 16); fx.impact(h.point, h.normal, 'plate', 1.2); sfx?.plate?.(h.point); return; }
      const push = tmp.copy(dir).multiplyScalar(2.2);
      const loose = o.kind === 'walker' ? o.homes.map(x => x.p) : [...o.homes.map(x => x.p), ...o.rotors.map(r => r.arm)];
      if (o.kind === 'walker') { o.part.core.material = o.part.slot.material = o.part.visor.material = M.dead; } else o.eye.material = o.halo.material = M.dead;
      for (const p of loose) {
        stage.attach(p);
        const v = new THREE.Vector3((Math.random() - 0.5) * 2.4, 1.2 + Math.random() * 2.6, (Math.random() - 0.5) * 2.4).add(push);
        if (o.kind === 'drone') v.y -= 1.5;
        fx.toss(p, v, new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(14), 3.2);
      }
      fx.burst(h.point, o.kind === 'walker' ? { sparks: 46, pieces: 9, size: 0.06 } : { sparks: 60, pieces: 7, size: 0.045, speed: 4.5 });
      if (o.kind === 'walker') sfx?.botDown?.(h.point); else sfx?.droneDown?.(h.point);
    },
    // Nobody hit it in time: the plate folds away, the walker has reached the far wing, the drone climbs out.
    escape(id) {
      const o = live.get(id);
      if (!o) return;
      live.delete(id);
      o.dead = false; o.gone = 0;
      if (o.kind === 'walker') { o.g.visible = false; o.busy = false; } else { o.up = 0; leaving.push(o); }
    },
    clear() {
      for (const o of [...live.values(), ...leaving]) { o.g.visible = false; o.busy = false; if (o.kind === 'walker') resetWalker(o); if (o.kind === 'drone') resetDrone(o); }
      live.clear(); leaving.length = 0;
    },
    // A point on a live target, for the checks to aim at (the weak spot when it has one).
    // part: 'body' for a walker's chest above its core.
    aimPoint(id, part) {
      const o = live.get(id);
      if (!o) return null;
      if (o.kind === 'plate') { o.arm.updateWorldMatrix(true, false); return new THREE.Vector3(0, PLATE_UP, 0).applyMatrix4(o.arm.matrixWorld); }
      const frame = o.kind === 'walker' ? o.g : o.body;
      frame.updateWorldMatrix(true, false);
      return (o.kind === 'walker' ? new THREE.Vector3(0.01, part === 'body' ? 1.43 : 1.25, 0) : new THREE.Vector3(0, -0.012, -0.2)).applyMatrix4(frame.matrixWorld);
    },
  };
  return api;
}
