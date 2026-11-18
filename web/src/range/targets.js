import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { lit } from './lit.js';
import { place } from '../pure/stages.js';
import { spring, springStep, kick, critical } from '../pure/springs.js';
import { makeFoeKit, poseWalker, hurtWalker, poseDrone, hurtDrone, chargeDrone, calmDrone, WALKER, DRONE } from './foes.js';

// Each kind is built once and pooled, so nothing is made in the middle of a run (the robots' shapes are in foes.js).
const std = (color, rough, metal, extra = {}) => lit(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));
// A plate's radius, and how far its middle sits above the hinge it folds on.
const PLATE_R = 0.25, PLATE_UP = 0.29;
const rbox = (w, h, d, r = 0.02) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.2, h / 2.2, d / 2.2));

export function makeTargets(stage, fx, meta, { sfx, low = false } = {}) {
  const R = meta.range, cx = R.line[0], z0 = -R.line[1];
  // Range space (x across, d downrange, h up) into the room.
  const toRoom = (x, d, h, out) => out.set(cx + x, h, z0 + d);
  const M = { steel: std(0xa3a9b1, 0.34, 1), dark: std(0x1d1f24, 0.5, 0.7), orange: std(0xff5a1c, 0.45, 0.05), white: std(0xe9ebee, 0.5, 0.05), rim: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.2, 0.3), fog: false }), faint: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.32, 0.11, 0.03), fog: false }) };
  const kit = makeFoeKit({ low });
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), home = new THREE.Vector3(), ray = new THREE.Ray(), inv = new THREE.Matrix4(), box = new THREE.Box3(), sphere = new THREE.Sphere();
  const live = new Map(), pools = { plate: [], walker: [], drone: [] }, leaving = [];
  let clock = 0;
  const frame = { dt: 0, t: 0, home, steps: null, spotted: null, smoke: (p, k) => fx.smoke(p, k) };
  // Footsteps and chirps only from the robots near enough to hear, so a busy stage is not a din.
  const line = new THREE.Vector3(cx, 1.5, z0);
  frame.steps = p => { if (p.distanceTo(line) < 22) sfx?.walkerStep?.(p); };
  frame.spotted = p => sfx?.walkerChirp?.(p);

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
    // With the lights out the rim glows faintly, like paint that holds the light, so a sweep of the flashlight finds it.
    const rim = mesh(new THREE.RingGeometry(PLATE_R * 0.97, PLATE_R * 1.14, 40), M.rim, 0, PLATE_UP, -0.009);
    face.rotation.y = ring.rotation.y = dot.rotation.y = rim.rotation.y = Math.PI;
    arm.add(neck, disc, face, ring, dot, rim);
    g.add(post, foot, hinge, arm);
    stage.add(g); g.visible = false;
    return { kind: 'plate', g, arm, post, hinge, rim, swing: spring(120, 5), rise: spring(260, critical(260) * 0.6), size: 1, up: 0, downAt: 0 };
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

  function buildRobot(kind) {
    const o = kit[kind]();
    stage.add(o.g); o.g.visible = false;
    return o;
  }
  const build = { plate: buildPlate, walker: () => buildRobot('walker'), drone: () => buildRobot('drone') };
  // A few of each are built with the rooms, so their shaders are ready and nothing is made in the middle of a run.
  for (const [kind, n] of [['plate', 3], ['walker', 3], ['drone', 5]]) for (let i = 0; i < n; i++) pools[kind].push(build[kind]());
  for (const o of pools.plate) o.rim.visible = false;
  function take(kind) {
    const pool = pools[kind];
    let o = pool.find(x => !x.busy);
    if (!o) { o = build[kind](); pool.push(o); }
    o.busy = true;
    return o;
  }
  const hum = (o, on) => {
    if (on && !o.hum) o.hum = sfx?.droneHum?.(o.g.position) || null;
    else if (!on && o.hum) { o.hum.stop(); o.hum = null; }
  };
  const hush = o => { o.whine?.stop(); o.whine = null; };

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
    const tryBall = ([x, y, z], r, zone) => {
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
      const through = [() => tryBall(WALKER.core, WALKER.coreR, 'core'), () => tryBall(WALKER.head, WALKER.headR, 'head'), () => tryBox(-0.27, 0.84, -0.27, 0.23, 1.54, 0.27, 'body'),
        () => { tryBox(-0.3, 0.0, -0.22, 0.32, 0.88, 0.22, 'limb'); tryBox(-0.2, 0.92, 0.2, 0.2, 1.52, 0.42, 'limb'); tryBox(-0.2, 0.92, -0.42, 0.2, 1.52, -0.2, 'limb'); }];
      for (const look of through) { look(); if (best) break; }
    } else {
      tryBall([0, 0, 0], DRONE.bodyR, 'body');
      const plain = best; best = null;
      tryBall(DRONE.eye, DRONE.eyeR, 'eye');
      if (!best) best = plain;
    }
    if (!best) return null;
    const point = best.local.applyMatrix4(frame.matrixWorld);
    return { dist: point.distanceTo(origin), zone: best.zone, point, normal: tmp.copy(dir).negate().clone() };
  }

  // Pulls a robot apart: each part flies off as it is and the pieces fade where they land.
  function scatterParts(o, parts, push, lift) {
    for (const p of parts) {
      stage.attach(p);
      const v = new THREE.Vector3((Math.random() - 0.5) * 2.4, lift + Math.random() * 2.6, (Math.random() - 0.5) * 2.4).add(push);
      fx.toss(p, v, new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(14), 3.2);
    }
  }
  function burstDrone(o) {
    // Its slot is held until these pieces are down, or a new drone would take them over in mid-air.
    o.fall = null; o.gone = 0;
    o.g.getWorldPosition(tmp);
    scatterParts(o, [o.core, ...o.rotors.map(r => r.arm)], tmp2.set(0, 0, 0), 0.6);
    fx.burst(tmp, { sparks: 60, pieces: 7, size: 0.045, speed: 4.5 });
    fx.smoke(tmp, 2);
    sfx?.droneDown?.(tmp);
  }

  const api = {
    // The hall's lights are out (the plates' rims glow).
    dark: false,
    get count() { return live.size; },
    live: () => [...live.values()],
    // Where a live target stands in the room (its group's place), or null.
    where: id => live.get(id)?.g.position || null,
    // A target appears (the run's `spawn` event).
    spawn(s) {
      const o = take(s.kind);
      o.id = s.id; o.s = s; o.dead = false; o.age = 0; o.g.visible = true;
      if (s.kind === 'plate') { o.size = s.size || 1; o.swing.x = o.swing.v = 0; o.rise.x = 0; o.rise.v = 0; o.up = 1; o.rim.visible = s.d > R.far || api.dark; o.rim.material = s.d > R.far ? M.rim : M.faint; }
      else { o.reset(); if (s.kind === 'drone') { toRoom(s.x, s.d, s.h, o.last); hum(o, true); } }
      live.set(s.id, o);
      api.pose(o, 0, 0, clock);
      return o;
    },
    pose(o, age, dt, t) {
      const at = place(o.s, age);
      frame.dt = dt; frame.t = t;
      if (o.kind === 'plate') { springStep(o.rise, o.up, dt); springStep(o.swing, o.dead ? 1.45 : 0, dt); placePlate(o, o.s, at); }
      else if (o.kind === 'walker') { toRoom(at.x, at.d, 0, o.g.position); poseWalker(o, at, Math.abs(at.x - o.s.x), frame); }
      else {
        toRoom(at.x, at.d, at.h, tmp);
        home.set(tmp.x * 0.4 + cx * 0.6, R.height - 0.5, z0 + R.far - 1.5);
        poseDrone(o, tmp, o.s, age, frame);
        o.hum?.move(o.g.position, o.hurt);
      }
    },
    // Moves everything on: live targets to where the run says they are, and the ones on their way out.
    update(dt, t, ages) {
      clock = t;
      for (const o of live.values()) { o.age = ages(o.id); api.pose(o, o.age, dt, t); }
      for (let i = leaving.length - 1; i >= 0; i--) {
        const o = leaving[i];
        o.gone += dt;
        if (o.kind === 'plate') { o.age += dt * (o.dead ? 0 : 1); springStep(o.rise, o.gone > (o.dead ? 0.55 : 0) ? 0 : 1, dt); springStep(o.swing, o.dead ? 1.45 : 0, dt); placePlate(o, o.s, place(o.s, o.age)); }
        else if (o.kind === 'drone' && o.fall) {
          // Shot down: it tumbles out of the air trailing smoke and breaks up where it hits the floor.
          const f = o.fall;
          f.v.y -= 9.81 * dt;
          o.g.position.addScaledVector(f.v, dt);
          o.body.rotation.y += f.spin * dt; o.body.rotation.x += f.spin * 0.3 * dt;
          f.smoke -= dt;
          if (f.smoke <= 0) { f.smoke = 0.05; fx.smoke(o.g.position, 0.7); }
          if (o.g.position.y < 0.3 || o.gone > 1.6) burstDrone(o);
        } else if (o.kind === 'drone' && !o.dead) { o.g.position.y += dt * 9 * o.gone; o.g.position.z += dt * 6; for (const r of o.rotors) r.spin.rotation.y += dt * 70; o.hum?.move(o.g.position, 0); }
        if (o.gone > (o.dead ? 3.4 : 0.9)) { if (o.fall) burstDrone(o); hum(o, false); o.g.visible = false; o.busy = false; leaving.splice(i, 1); }
      }
    },
    // The nearest live target on this shot's line, if any.
    hit(origin, dir, far = Infinity) {
      let best = null;
      for (const o of live.values()) { const h = strike(o, origin, dir); if (h && h.dist < far && (!best || h.dist < best.dist)) best = { ...h, id: o.id, kind: o.kind }; }
      return best;
    },
    // It was hit and is still up; `left` is the share of its strength it still has.
    hurt(id, h, left = 1) {
      const o = live.get(id);
      if (!o) return;
      if (o.kind === 'walker') hurtWalker(o, h.zone, left);
      else if (o.kind === 'drone') hurtDrone(o, h.zone, left);
      fx.impact(h.point, h.normal, 'bot', h.weak ? 1.6 : 1);
      if (o.kind !== 'plate' && left < 0.5) fx.smoke(h.point, 0.5);
    },
    // It is finished: a plate rings and folds back; a walker comes apart; a drone falls out of the air.
    kill(id, h, dir) {
      const o = live.get(id);
      if (!o) return;
      live.delete(id);
      o.dead = true; o.gone = 0; leaving.push(o);
      if (o.kind === 'plate') { kick(o.swing, 16); fx.impact(h.point, h.normal, 'plate', 1.2); sfx?.plate?.(h.point); return; }
      const C = kit.colours;
      if (o.kind === 'walker') {
        o.mat.core.color.setRGB(...C.DEAD); o.mat.eyes.color.setRGB(...C.DEAD); o.mat.vinyl.emissive.setScalar(0);
        scatterParts(o, o.homes.map(x => x.p), tmp.copy(dir).multiplyScalar(2.2), 1.2);
        fx.burst(h.point, { sparks: 50, pieces: 9, size: 0.06 });
        fx.smoke(h.point, 2.2);
        sfx?.botDown?.(h.point);
        return;
      }
      calmDrone(o, false);
      hum(o, false); hush(o);
      o.mat.eye.color.setRGB(...C.DEAD); o.mat.vinyl.emissive.setScalar(0);
      o.fall = { v: tmp.copy(dir).multiplyScalar(1.6).setY(0.6).clone(), spin: (Math.random() < 0.5 ? -1 : 1) * (9 + Math.random() * 5), smoke: 0 };
      fx.burst(h.point, { sparks: 26, pieces: 2, size: 0.04, speed: 3 });
      sfx?.droneHit?.(h.point);
    },
    // Nobody hit it in time: the plate folds away, the walker has reached the far wing, the drone climbs out.
    escape(id) {
      const o = live.get(id);
      if (!o) return;
      live.delete(id);
      o.dead = false; o.gone = 0;
      if (o.kind === 'drone') { calmDrone(o, false); hush(o); }
      if (o.kind === 'walker') { o.g.visible = false; o.busy = false; } else { o.up = 0; leaving.push(o); }
    },
    // On Hard a drone gathers a bolt in its eye for `span` seconds from `from` (its age) before it fires.
    charge(id, from, span) { const o = live.get(id); if (o?.kind === 'drone') { chargeDrone(o, from, span); hush(o); o.whine = sfx?.droneCharge?.(o.g.position, span) || null; } },
    // The bolt left (fired) or its drone went before it could (not fired).
    calm(id, fired) { const o = live.get(id); if (o?.kind === 'drone') { calmDrone(o, fired); if (fired) o.whine = null; else hush(o); } },
    clear() {
      for (const o of [...live.values(), ...leaving]) { o.g.visible = false; o.busy = false; if (o.kind !== 'plate') o.reset(); if (o.kind === 'drone') { hum(o, false); hush(o); } }
      live.clear(); leaving.length = 0;
    },
    // For the checks to aim at; `part` 'body' aims off the weak spot (a walker's chest, a drone's hull).
    aimPoint(id, part) {
      const o = live.get(id);
      if (!o) return null;
      if (o.kind === 'plate') { o.arm.updateWorldMatrix(true, false); return new THREE.Vector3(0, PLATE_UP, 0).applyMatrix4(o.arm.matrixWorld); }
      const frame = o.kind === 'walker' ? o.g : o.body;
      frame.updateWorldMatrix(true, false);
      const at = o.kind === 'walker' ? (part === 'body' ? WALKER.chest : WALKER.core) : part === 'body' ? [0, -0.17, -0.12] : DRONE.eye;
      return new THREE.Vector3(...at).applyMatrix4(frame.matrixWorld);
    },
  };
  return api;
}
