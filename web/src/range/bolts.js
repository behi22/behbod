import * as THREE from 'three';
import { boltAt, BOLT } from '../pure/bolts.js';

// A missed bolt flies on past you and fades, so a dodge is seen to be a dodge.
const POOL = 8, TAIL = 5, PAST = 0.8;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.6)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function makeBolts(stage, fx, toRoom, { sfx } = {}) {
  const tex = glowTexture(), ball = new THREE.SphereGeometry(BOLT.radius * 0.5, 12, 8);
  const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.4, 3.8), fog: false });
  const sprite = (rgb, size) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(...rgb), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
    s.scale.setScalar(size);
    return s;
  };
  const pool = Array.from({ length: POOL }, () => {
    const g = new THREE.Group(), core = new THREE.Mesh(ball, coreMat), halo = sprite([4, 0.45, 0.8], BOLT.radius * 5);
    g.add(core, halo);
    const tail = Array.from({ length: TAIL }, (_, i) => sprite([2.6 * (1 - i / TAIL), 0.25, 0.5 * (1 - i / TAIL)], BOLT.radius * (3.2 - 0.45 * i)));
    stage.add(g, ...tail);
    g.visible = false; for (const s of tail) s.visible = false;
    return { g, halo, tail, id: 0, b: null, t0: 0, state: 'off', age: 0 };
  });
  const v = new THREE.Vector3(), ray = new THREE.Ray(), sphere = new THREE.Sphere(), hitAt = new THREE.Vector3();
  const find = id => pool.find(o => o.state !== 'off' && o.id === id);
  const off = o => { o.state = 'off'; o.g.visible = false; for (const s of o.tail) s.visible = false; };
  const place = (o, age, out) => { const p = boltAt(o.b, age); return toRoom(p.x, p.d, p.h, out); };

  return {
    get count() { return pool.filter(o => o.state !== 'off').length; },
    // A bolt leaves its drone: `b` is the run's record of it (its start, its speed, the time it left).
    launch(id, b) {
      const o = pool.find(x => x.state === 'off') || pool.reduce((a, x) => (x.t0 < a.t0 ? x : a));
      Object.assign(o, { id, b, t0: b.t0, state: 'fly', age: 0 });
      o.g.visible = true; o.halo.material.opacity = 1;
      for (const s of o.tail) { s.visible = true; s.material.opacity = 1; }
      sfx?.boltFire?.(place(o, 0, v));
    },
    // Each frame: `now` is the run's clock (the bolts in flight follow it, so they hold still in a pause).
    update(dt, now, t) {
      for (const o of pool) {
        if (o.state === 'off') continue;
        if (o.state === 'fly') o.age = now - o.t0;
        else { o.age += dt; if ((o.left -= dt) <= 0) { off(o); continue; } }
        place(o, o.age, o.g.position);
        o.halo.scale.setScalar(BOLT.radius * (4.6 + 0.8 * Math.sin(t * 40 + o.id)));
        o.tail.forEach((s, i) => place(o, Math.max(0, o.age - 0.028 * (i + 1)), s.position));
        if (o.state === 'past') { const k = Math.max(0, o.left / PAST); o.halo.material.opacity = k; for (const s of o.tail) s.material.opacity = k; }
      }
    },
    // It reached the line and went by: it flies on past and fades.
    miss(id) { const o = find(id); if (!o) return; o.state = 'past'; o.left = PAST; sfx?.boltPass?.(place(o, o.age, v)); },
    // It reached you: the glass shows the hit, and the ball is gone.
    strike(id) { const o = find(id); if (o) off(o); },
    // It was shot out of the air.
    parry(id) {
      const o = find(id);
      if (!o) return;
      place(o, o.age, v);
      fx.burst(v, { sparks: 34, pieces: 0, speed: 3, colour: [3.6, 0.6, 1.0] });
      sfx?.boltPop?.(v);
      off(o);
    },
    // Its drone went before it fired, or the run ended with it in the air.
    fizzle(id) { const o = find(id); if (o) { if (o.state === 'fly') fx.burst(place(o, o.age, v), { sparks: 12, pieces: 0, speed: 1.5, colour: [3, 0.5, 0.9] }); off(o); } },
    // The nearest bolt in flight on a shot's line (a little bigger than it looks, so a fair shot takes it).
    hit(origin, dir, far = Infinity) {
      let best = null;
      ray.set(origin, dir);
      for (const o of pool) {
        if (o.state !== 'fly') continue;
        if (!ray.intersectSphere(sphere.set(o.g.position, BOLT.radius * 1.8), hitAt)) continue;
        const d = hitAt.distanceTo(origin);
        if (d < far && (!best || d < best.dist)) best = { id: o.id, dist: d, point: hitAt.clone() };
      }
      return best;
    },
    // Where a bolt in flight is now, in the room (or null).
    at(id) { const o = find(id); return o && o.state === 'fly' ? o.g.position : null; },
    clear() { for (const o of pool) off(o); },
  };
}
