import * as THREE from 'three';
import { lit } from './lit.js';

// What a shot leaves behind: the streak of the bullet, sparks and a mark where it lands, a puff of dust off concrete,
// the spent case tumbling away, and the pieces of a target that has been shot apart. Everything comes from a pool made
// once, so a long burst never makes the page pause to tidy up.
const TRACERS = 10, SPARKS = 220, MARKS = 56, PUFFS = 14, CASINGS = 22, BITS = 70, G = 9.81;

function softDot(size = 64, inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.35)') {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d'), r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  r.addColorStop(0, inner); r.addColorStop(0.4, mid); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}
// A bullet's mark: a dark pit with a pale chipped ring.
function markTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(6,6,7,0.96)'); r.addColorStop(0.2, 'rgba(14,14,16,0.9)'); r.addColorStop(0.34, 'rgba(120,122,128,0.5)'); r.addColorStop(0.6, 'rgba(40,40,44,0.22)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeFx(stage, { tops = [], onCasing } = {}) {
  const up = new THREE.Vector3(0, 1, 0), a = new THREE.Vector3(), b = new THREE.Vector3(), q = new THREE.Quaternion();

  // Streaks: a thin bright rod that runs from the muzzle to where the shot lands.
  const rod = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true).rotateX(Math.PI / 2);
  const tracers = Array.from({ length: TRACERS }, () => {
    const m = new THREE.Mesh(rod, new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.2, 1.0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    m.visible = false; m.frustumCulled = false; stage.add(m);
    return { m, from: new THREE.Vector3(), dir: new THREE.Vector3(), len: 0, at: 0, on: false };
  });

  // Sparks: one cloud of points; a dead spark waits far below the floor.
  const sPos = new Float32Array(SPARKS * 3).fill(-999), sCol = new Float32Array(SPARKS * 3), sVel = new Float32Array(SPARKS * 3), sLife = new Float32Array(SPARKS), sSpan = new Float32Array(SPARKS), sTint = new Float32Array(SPARKS * 3);
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  const sparks = new THREE.Points(sGeo, new THREE.PointsMaterial({ size: 0.05, map: softDot(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  sparks.frustumCulled = false; stage.add(sparks);
  let sNext = 0;

  // Marks: small flat patches laid on what was hit; the oldest is used again.
  const markMat = new THREE.MeshBasicMaterial({ map: markTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, fog: false });
  const markGeo = new THREE.PlaneGeometry(1, 1);
  const marks = Array.from({ length: MARKS }, () => { const m = new THREE.Mesh(markGeo, markMat); m.visible = false; stage.add(m); return m; });
  let mNext = 0;

  // Dust: a soft grey puff that swells and thins.
  const puffTex = softDot(64, 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0.25)');
  const puffs = Array.from({ length: PUFFS }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: 0x8c9098, transparent: true, depthWrite: false, opacity: 0, fog: false }));
    s.visible = false; stage.add(s);
    return { s, t: 9, v: new THREE.Vector3() };
  });
  let pNext = 0;

  // Spent cases and the pieces of broken targets fall, bounce and spin the same way.
  const bodies = [];
  const casings = [];
  function body(mesh, pos, vel, spin, life, bounce, onBounce) {
    mesh.position.copy(pos); mesh.visible = true;
    const o = { mesh, v: vel.clone(), axis: spin.clone().normalize(), w: spin.length(), t: 0, life, bounce, onBounce, hits: 0, rest: false };
    bodies.push(o);
    return o;
  }
  const bitGeo = [new THREE.BoxGeometry(1, 1, 1), new THREE.TetrahedronGeometry(0.7), new THREE.CylinderGeometry(0.5, 0.5, 1, 6)];
  const bitMat = lit(new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.45, metalness: 0.9 }));
  const bits = Array.from({ length: BITS }, (_, i) => { const m = new THREE.Mesh(bitGeo[i % 3], bitMat); m.visible = false; stage.add(m); return m; });
  let bNext = 0;

  function spark(p, v, life, r, g, bl) {
    const i = sNext; sNext = (sNext + 1) % SPARKS;
    sPos[i * 3] = p.x; sPos[i * 3 + 1] = p.y; sPos[i * 3 + 2] = p.z;
    sVel[i * 3] = v.x; sVel[i * 3 + 1] = v.y; sVel[i * 3 + 2] = v.z;
    sLife[i] = sSpan[i] = life;
    sTint[i * 3] = r; sTint[i * 3 + 1] = g; sTint[i * 3 + 2] = bl;
  }

  const api = {
    tracer(from, to) {
      const t = tracers.find(x => !x.on) || tracers[0];
      t.from.copy(from); t.dir.copy(to).sub(from); t.len = t.dir.length(); t.dir.normalize(); t.at = 0; t.on = true;
    },
    // kind: 'concrete' (dust, a mark), 'steel' (bright sparks, a mark), 'bot' (sparks, no mark: it moves), 'plate' (a ring of sparks).
    impact(point, normal, kind = 'concrete', power = 1) {
      const n = kind === 'concrete' ? 5 : kind === 'bot' ? 12 : 16;
      for (let i = 0; i < n * power; i++) {
        a.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(kind === 'concrete' ? 1.4 : 2.6).addScaledVector(normal, 1.5 + Math.random() * (kind === 'concrete' ? 1.2 : 3.5));
        if (kind === 'concrete') spark(point, a, 0.12 + Math.random() * 0.18, 1.6, 1.3, 1.0);
        else spark(point, a, 0.18 + Math.random() * 0.35, 3.4, 2.2 + Math.random(), 0.7);
      }
      if (kind === 'concrete' || kind === 'steel') {
        const m = marks[mNext]; mNext = (mNext + 1) % MARKS;
        m.position.copy(point).addScaledVector(normal, 0.004);
        m.quaternion.setFromUnitVectors(a.set(0, 0, 1), normal);
        m.rotateZ(Math.random() * 6.28);
        m.scale.setScalar(kind === 'steel' ? 0.035 : 0.05 + Math.random() * 0.03);
        m.visible = true;
      }
      if (kind === 'concrete') {
        const p = puffs[pNext]; pNext = (pNext + 1) % PUFFS;
        p.s.position.copy(point).addScaledVector(normal, 0.05); p.v.copy(normal).multiplyScalar(0.5).add(a.set(0, 0.25, 0)); p.t = 0; p.s.visible = true;
      }
    },
    // A burst for something coming apart: sparks all round and a handful of tumbling pieces.
    burst(point, { sparks: n = 40, pieces = 8, size = 0.07, speed = 3.5, colour = [3.4, 2.4, 0.8] } = {}) {
      for (let i = 0; i < n; i++) {
        a.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random()));
        spark(point, a, 0.25 + Math.random() * 0.5, ...colour);
      }
      for (let i = 0; i < pieces; i++) {
        const m = bits[bNext]; bNext = (bNext + 1) % BITS;
        m.scale.set(size * (0.4 + Math.random()), size * (0.3 + Math.random() * 0.8), size * (0.4 + Math.random()));
        a.set(Math.random() - 0.5, Math.random() * 0.9 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.7));
        b.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(22);
        const old = bodies.findIndex(o => o.mesh === m);
        if (old >= 0) bodies.splice(old, 1);
        body(m, point, a, b, 2.6 + Math.random(), 0.35);
      }
    },
    // A loose part (an arm, a rotor) thrown as it is: the caller's mesh, already in the scene.
    toss(mesh, vel, spin, life = 3) { return body(mesh, mesh.position, vel, spin, life, 0.3); },
    casing(mesh, pos, vel, spin) {
      if (casings.length >= CASINGS) { const old = casings.shift(); stage.remove(old.mesh); const i = bodies.indexOf(old); if (i >= 0) bodies.splice(i, 1); }
      stage.add(mesh);
      casings.push(body(mesh, pos, vel, spin, 6, 0.42, onCasing));
    },
    tick(dt) {
      for (const t of tracers) {
        if (!t.on) continue;
        // The streak is eight metres long and crosses the hall in a blink.
        t.at += dt * 320;
        const head = Math.min(t.len, t.at), tail = Math.max(0, t.at - 8);
        if (tail >= t.len) { t.on = false; t.m.visible = false; continue; }
        t.m.visible = true;
        t.m.position.copy(t.from).addScaledVector(t.dir, (head + tail) / 2);
        t.m.quaternion.setFromUnitVectors(a.set(0, 0, 1), t.dir);
        t.m.scale.set(0.006, 0.006, Math.max(0.05, head - tail));
      }
      for (let i = 0; i < SPARKS; i++) {
        if (sLife[i] <= 0) continue;
        sLife[i] -= dt;
        const k = i * 3;
        if (sLife[i] <= 0) { sPos[k + 1] = -999; sCol[k] = sCol[k + 1] = sCol[k + 2] = 0; continue; }
        sVel[k + 1] -= G * 0.6 * dt;
        sPos[k] += sVel[k] * dt; sPos[k + 1] += sVel[k + 1] * dt; sPos[k + 2] += sVel[k + 2] * dt;
        if (sPos[k + 1] < 0.01) { sPos[k + 1] = 0.01; sVel[k + 1] *= -0.4; }
        const f = sLife[i] / sSpan[i];
        sCol[k] = sTint[k] * f; sCol[k + 1] = sTint[k + 1] * f * f; sCol[k + 2] = sTint[k + 2] * f * f * f;
      }
      sGeo.attributes.position.needsUpdate = true; sGeo.attributes.color.needsUpdate = true;
      for (const p of puffs) {
        if (p.t > 0.9) { if (p.s.visible) p.s.visible = false; continue; }
        p.t += dt;
        const f = p.t / 0.9;
        p.s.position.addScaledVector(p.v, dt * (1 - f));
        p.s.scale.setScalar(0.12 + 0.55 * Math.sqrt(f));
        p.s.material.opacity = 0.42 * (1 - f) * (1 - f);
      }
      for (let i = bodies.length - 1; i >= 0; i--) {
        const o = bodies[i], m = o.mesh;
        o.t += dt;
        if (o.t > o.life) { m.visible = false; bodies.splice(i, 1); const c = casings.indexOf(o); if (c >= 0) { casings.splice(c, 1); stage.remove(m); } continue; }
        if (o.rest) continue;
        o.v.y -= G * dt;
        const y0 = m.position.y;
        m.position.addScaledVector(o.v, dt);
        if (o.w > 0.01) m.quaternion.premultiply(q.setFromAxisAngle(o.axis, o.w * dt));
        // The floor, and anything with a flat top it comes down onto (the bench).
        let ground = 0.012;
        for (const t of tops) if (m.position.x > t.x0 && m.position.x < t.x1 && m.position.z > t.z0 && m.position.z < t.z1 && y0 >= t.y - 0.01) ground = Math.max(ground, t.y + 0.012);
        if (m.position.y < ground && o.v.y < 0) {
          m.position.y = ground;
          const hard = -o.v.y;
          o.v.y = hard * o.bounce; o.v.x *= 0.72; o.v.z *= 0.72; o.w *= 0.6;
          if (o.hits++ < 2 && hard > 0.8) o.onBounce?.(m.position, Math.min(1, hard / 4));
          if (hard < 0.5) { o.rest = true; o.v.set(0, 0, 0); }
        }
      }
    },
    clear() {
      for (const m of marks) m.visible = false;
      for (const o of bodies) o.mesh.visible = false;
      for (const c of casings) stage.remove(c.mesh);
      bodies.length = 0; casings.length = 0;
      sLife.fill(0); sPos.fill(-999);
      for (const t of tracers) { t.on = false; t.m.visible = false; }
    },
    get counts() { return { bodies: bodies.length, casings: casings.length }; },
  };
  return api;
}
