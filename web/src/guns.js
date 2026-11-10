import * as THREE from 'three';
import { piece, mesh, PAINT, glow, sph, cyl, box, rbox, torus } from './shapes.js';
import { GUNS } from './pure/guns.js';

// The six creature guns as you hold them at the holo range, and what their shots look like. Each one is built from
// simple shapes, nose forward (-z, the way the camera looks), and moves in its own way: idle, kick when it fires, and its
// own reload (Snorkel gulps, Grumble hides in his shell, Vix shifts colour, Mochi squishes, Zap charges, Dusty flutters).
const K = '#26292f', K2 = '#3a3e46', EYE = '#111216', WHITE = '#f4f4f0';

function grip(parts, z = 0.05) {
  parts.push(piece(rbox(0.032, 0.085, 0.045, 0.01), K, [0, -0.07, z], [0.25, 0, 0]));
  parts.push(piece(rbox(0.026, 0.02, 0.07, 0.008), K2, [0, -0.035, z - 0.02]));
}
const eyes = (parts, x, y, z, r = 0.009) => { for (const s of [-1, 1]) parts.push(piece(sph(r, 10, 8), EYE, [s * x, y, z]), piece(sph(r * 0.35, 6, 5), WHITE, [s * x + s * r * 0.2, y + r * 0.35, z - r * 0.8])); };

function snorkel() {
  const g = new THREE.Group(), P = '#ff9cc8', F = '#ff4f9a', parts = [];
  parts.push(piece(sph(1, 18, 12), P, [0, 0, 0.0], [0, 0, 0], [0.048, 0.042, 0.13]));
  parts.push(piece(sph(1, 18, 12), P, [0, 0.008, -0.12], [0, 0, 0], [0.058, 0.044, 0.05]));
  parts.push(piece(sph(1, 12, 8), '#ffc4de', [0, -0.012, -0.11], [0, 0, 0], [0.04, 0.02, 0.04]));
  parts.push(piece(sph(1, 12, 8), P, [0, 0.004, 0.15], [0, 0, 0], [0.008, 0.032, 0.07]));
  eyes(parts, 0.032, 0.022, -0.152);
  grip(parts);
  g.add(mesh(parts, PAINT));
  // The frilly gills, three a side, on their own so they can flutter.
  const gills = [];
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const gl = mesh([piece(new THREE.ConeGeometry(0.009, 0.05, 6), F, [0, 0.025, 0])], PAINT);
    gl.position.set(s * 0.05, 0.03 - i * 0.017, -0.11 + i * 0.008);
    gl.rotation.set(0.3, 0, s * (0.9 + i * 0.35));
    g.add(gl); gills.push({ o: gl, base: gl.rotation.z, s, i });
  }
  return { g, muzzle: new THREE.Vector3(0, 0, -0.17), anim(t, a) {
    for (const q of gills) q.o.rotation.z = q.base + q.s * Math.sin(t * 9 + q.i) * (0.12 + a.reload * 0.5);
    g.scale.set(1 + a.reload * 0.08, 1 + a.reload * 0.08, 1 - a.reload * 0.06);
  } };
}

function grumble() {
  const g = new THREE.Group(), S1 = '#c98a4b', S2 = '#9e652f', R = '#e0553a', parts = [];
  grip(parts, 0.06);
  const body = new THREE.Group(), shell = new THREE.Group();
  const sp = [];
  [[0.058, 0, 0.03, 0.04], [0.047, 0.035, 0.05, 0.02], [0.036, 0.06, 0.035, -0.005], [0.024, 0.075, 0.015, -0.02], [0.015, 0.082, 0.0, -0.03]]
    .forEach(([r, y, z, x], i) => sp.push(piece(sph(r, 16, 12), i % 2 ? S2 : S1, [x, y, z])));
  shell.add(mesh(sp, PAINT));
  const bp = [];
  bp.push(piece(sph(1, 14, 10), R, [0, -0.005, -0.05], [0, 0, 0], [0.042, 0.03, 0.04]));
  bp.push(piece(sph(1, 12, 10), R, [0.04, -0.01, -0.09], [0, 0, 0], [0.026, 0.022, 0.034]));
  bp.push(piece(new THREE.ConeGeometry(0.012, 0.035, 6), R, [0.05, -0.002, -0.12], [-Math.PI / 2, 0, -0.3]));
  bp.push(piece(new THREE.ConeGeometry(0.01, 0.03, 6), R, [0.032, -0.022, -0.12], [-Math.PI / 2, 0, 0.3]));
  bp.push(piece(sph(1, 10, 8), R, [-0.035, -0.012, -0.08], [0, 0, 0], [0.014, 0.012, 0.02]));
  for (const s of [-1, 1]) {
    bp.push(piece(cyl(0.003, 0.003, 0.035, 6), R, [s * 0.014, 0.03, -0.07]));
    bp.push(piece(sph(0.0075, 8, 6), EYE, [s * 0.014, 0.05, -0.07]));
  }
  body.add(mesh(bp, PAINT));
  g.add(mesh(parts, PAINT), shell, body);
  return { g, muzzle: new THREE.Vector3(0.05, 0, -0.14), anim(t, a) {
    // Reloading, he pulls into his shell and comes back out.
    const hide = Math.sin(Math.min(1, a.reload) * Math.PI);
    body.scale.setScalar(Math.max(0.25, 1 - hide * 0.75));
    body.position.set(0, 0.02 * hide, 0.05 * hide);
    shell.rotation.z = Math.sin(t * 1.3) * 0.03;
  } };
}

function vix() {
  const g = new THREE.Group(), G = '#5fcf6a', parts = [];
  parts.push(piece(sph(1, 18, 12), G, [0, 0.005, 0], [0, 0, 0], [0.04, 0.048, 0.12]));
  parts.push(piece(sph(1, 16, 10), G, [0, 0.01, -0.115], [0.15, 0, 0], [0.034, 0.036, 0.05]));
  for (let i = 0; i < 6; i++) parts.push(piece(new THREE.ConeGeometry(0.007, 0.022, 5), '#3faa4c', [0, 0.052 - i * 0.002, -0.08 + i * 0.03]));
  parts.push(piece(torus(0.03, 0.009, 8, 20), G, [0, -0.07, 0.07], [0, Math.PI / 2, 0]));
  grip(parts);
  const body = mesh(parts, new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }));
  g.add(body);
  // Turret eyes, each on its own swivel.
  const eyeBalls = [-1, 1].map(s => {
    const e = new THREE.Group();
    e.add(mesh([piece(sph(0.016, 12, 10), '#9be07a'), piece(sph(0.0075, 10, 8), EYE, [0, 0, -0.012])], PAINT));
    e.position.set(s * 0.03, 0.028, -0.12); g.add(e); return e;
  });
  return { g, muzzle: new THREE.Vector3(0, 0.0, -0.165), anim(t, a) {
    eyeBalls[0].rotation.set(Math.sin(t * 1.7) * 0.4, Math.sin(t * 1.1) * 0.6, 0);
    eyeBalls[1].rotation.set(Math.cos(t * 1.3) * 0.4, Math.cos(t * 0.9 + 1) * 0.6, 0);
    // Reloading, the colour runs through the rainbow and settles back to green.
    if (a.reload > 0) body.material.color.setHSL((t * 0.9) % 1, 0.7, 0.62);
    else body.material.color.setRGB(1, 1, 1);
  } };
}

function mochi() {
  const g = new THREE.Group(), T = '#5fe0d0', parts = [];
  parts.push(piece(cyl(0.016, 0.018, 0.12, 14), K2, [0, -0.03, -0.06], [Math.PI / 2, 0, 0]));
  grip(parts, 0.04);
  g.add(mesh(parts, PAINT));
  const bun = new THREE.Group();
  const bp = [piece(sph(0.062, 20, 14), T, [0, 0, 0], [0, 0, 0], [1, 0.82, 1])];
  for (const s of [-1, 1]) bp.push(piece(sph(1, 12, 10), T, [s * 0.026, 0.07, 0.01], [0, 0, s * -0.25], [0.014, 0.04, 0.012]), piece(sph(0.008, 8, 6), '#ffa3c4', [s * 0.03, -0.004, -0.055]));
  eyes(bp, 0.02, 0.012, -0.058, 0.0085);
  bun.add(mesh(bp, PAINT));
  bun.position.set(0, 0.035, 0.0);
  g.add(bun);
  return { g, muzzle: new THREE.Vector3(0, -0.03, -0.13), anim(t, a) {
    const wobble = Math.sin(t * 6) * 0.03, squish = a.kick * 0.25 + Math.sin(Math.min(1, a.reload) * Math.PI * 3) * 0.2 * (a.reload > 0 ? 1 : 0);
    bun.scale.set(1 + squish + wobble, 1 - squish - wobble, 1 + squish * 0.5);
  } };
}

function zap() {
  const g = new THREE.Group(), N = '#25306a', parts = [];
  parts.push(piece(cyl(0.013, 0.013, 0.24, 12), '#8a919c', [0, 0, -0.03], [Math.PI / 2, 0, 0]));
  for (let i = 0; i < 26; i++) {
    const u = i / 25, a = u * Math.PI * 6, z = 0.08 - u * 0.2, r = 0.022;
    parts.push(piece(sph(0.011 + 0.004 * Math.sin(u * Math.PI), 8, 6), N, [Math.cos(a) * r, Math.sin(a) * r, z]));
  }
  parts.push(piece(sph(1, 14, 10), N, [0, 0.02, -0.14], [0, 0, 0], [0.022, 0.018, 0.034]));
  grip(parts, 0.06);
  g.add(mesh(parts, PAINT));
  const eyeMat = glow(2.2, 2.0, 0.4);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(sph(0.0055, 8, 6), eyeMat); e.position.set(s * 0.012, 0.03, -0.165); g.add(e); }
  return { g, muzzle: new THREE.Vector3(0, 0, -0.16), anim(t, a) {
    // Charging on a reload: the eyes flicker bright.
    const k = a.reload > 0 ? 1.6 + Math.random() * 1.6 : 1 + Math.sin(t * 3) * 0.15;
    eyeMat.color.setRGB(2.2 * k, 2.0 * k, 0.4 * k);
  } };
}

function dusty() {
  const g = new THREE.Group(), B = '#e8dcc0', parts = [];
  parts.push(piece(sph(1, 16, 12), B, [0, 0, -0.02], [0, 0, 0], [0.045, 0.045, 0.1]));
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; parts.push(piece(sph(0.016, 8, 6), WHITE, [Math.cos(a) * 0.04, Math.sin(a) * 0.04 + 0.005, -0.085])); }
  parts.push(piece(sph(0.04, 14, 10), B, [0, 0.008, -0.115]));
  eyes(parts, 0.026, 0.016, -0.148, 0.012);
  for (const s of [-1, 1]) {
    parts.push(piece(cyl(0.002, 0.002, 0.07, 5), '#7a6a52', [s * 0.022, 0.06, -0.12], [0.5, 0, s * -0.35]));
    for (let k = 0; k < 4; k++) parts.push(piece(new THREE.ConeGeometry(0.004, 0.016, 4), '#9a8a6a', [s * (0.028 + k * 0.006), 0.07 + k * 0.008, -0.13 - k * 0.004], [0.5, 0, s * -1.2]));
  }
  grip(parts, 0.05);
  g.add(mesh(parts, PAINT));
  const wings = [-1, 1].map(s => {
    const w = new THREE.Group();
    w.add(mesh([piece(sph(1, 14, 8), '#d6c9a8', [s * 0.05, 0, 0.02], [0, 0, 0], [0.05, 0.004, 0.08]), piece(sph(0.012, 8, 6), '#8a7a5a', [s * 0.06, 0.004, 0.03])], PAINT));
    w.position.set(s * 0.025, 0.02, 0); g.add(w); return { w, s };
  });
  return { g, muzzle: new THREE.Vector3(0, 0, -0.16), anim(t, a) {
    const flap = a.reload > 0 ? Math.sin(t * 28) * 0.8 : Math.sin(t * 2) * 0.08;
    for (const { w, s } of wings) w.rotation.z = s * (0.35 + flap);
  } };
}

const BUILD = { snorkel, grumble, vix, mochi, zap, dusty };

export function makeGunView(scene) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  const models = GUNS.map(gun => { const m = BUILD[gun.id](); m.g.visible = false; root.add(m.g); return m; });
  let shown = -1, kick = 0, swap = 0, t = 0;
  // Shot effects: lines (a beam, a jagged bolt or a tongue) and a pool of little balls (bubbles, goo, dust).
  const lineGeo = new THREE.BufferGeometry(), linePos = new Float32Array(64 * 3), lineCol = new Float32Array(64 * 3);
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  lineGeo.setAttribute('color', new THREE.BufferAttribute(lineCol, 3));
  const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  lines.frustumCulled = false; scene.add(lines);
  const balls = Array.from({ length: 40 }, () => {
    const m = new THREE.Mesh(sph(1, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    m.visible = false; scene.add(m);
    return { m, from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, life: 0, size: 0 };
  });
  let lineUntil = 0, lineN = 0;
  const c = new THREE.Color(), off = new THREE.Vector3(0.2, -0.19, -0.42), tmp = new THREE.Vector3();
  function addLine(pts, colour) {
    c.set(colour);
    for (let i = 0; i + 1 < pts.length && lineN < 63; i++) {
      linePos.set([pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z], lineN * 3);
      lineCol.set([c.r * 2, c.g * 2, c.b * 2, c.r * 2, c.g * 2, c.b * 2], lineN * 3);
      lineN += 2;
    }
    lineGeo.setDrawRange(0, lineN);
    lineGeo.attributes.position.needsUpdate = lineGeo.attributes.color.needsUpdate = true;
  }
  function ball(from, to, colour, size, life) {
    const b = balls.find(x => !x.m.visible);
    if (!b) return;
    b.from.copy(from); b.to.copy(to); b.t = 0; b.life = life; b.size = size;
    b.m.material.color.set(colour); b.m.material.opacity = 0.9; b.m.visible = true;
  }
  return {
    show(on) { root.visible = on; },
    // The muzzle, in the room, for the shot to start from.
    muzzle(out) { const m = models[shown]; return m ? out.copy(m.muzzle).applyMatrix4(m.g.matrixWorld) : out.set(0, 0, 0); },
    fire() { kick = 1; },
    // What one shot looks like, from the muzzle to where it landed.
    effect(gunIndex, from, to) {
      const gun = GUNS[gunIndex];
      if (!lineUntil || t > lineUntil) { lineN = 0; }
      lineUntil = t + 0.09;
      if (gun.id === 'zap') {
        const pts = [from.clone()];
        for (let i = 1; i < 7; i++) pts.push(from.clone().lerp(to, i / 7).add(tmp.set((Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.18)));
        pts.push(to.clone());
        addLine(pts, gun.colour);
      } else if (gun.id === 'vix') {
        addLine([from, to], gun.colour);
        lineUntil = t + 0.16;
      } else if (gun.id === 'grumble') {
        ball(from, to, gun.colour, 0.035, 0.22);
      } else {
        const n = gun.id === 'snorkel' ? 3 : 1;
        for (let i = 0; i < n; i++) ball(from, to, gun.colour, gun.id === 'dusty' ? 0.018 : gun.id === 'mochi' ? 0.028 : 0.016, 0.18 + i * 0.05);
        if (gun.id === 'snorkel') addLine([from, to], '#a8dcff');
      }
    },
    tick(dt, camera, arsenal) {
      t += dt;
      if (!root.visible) return;
      if (arsenal.gun !== shown) {
        if (shown >= 0) models[shown].g.visible = false;
        shown = arsenal.gun; models[shown].g.visible = true; swap = 1;
      }
      kick = Math.max(0, kick - dt * 6);
      swap = Math.max(0, swap - dt * 4);
      const gun = GUNS[shown], reload = arsenal.reloading ? 1 - arsenal.reloading / gun.reload : 0;
      // Held low and to the right, swaying a little; dips for a reload, comes up on a switch, kicks back when it fires.
      root.position.copy(camera.position);
      root.quaternion.copy(camera.quaternion);
      const m = models[shown];
      const dip = arsenal.reloading ? Math.sin(reload * Math.PI) : 0;
      m.g.position.copy(off).add(tmp.set(Math.sin(t * 1.3) * 0.004, Math.sin(t * 2.1) * 0.004 - dip * 0.07 - swap * 0.12, kick * 0.045));
      m.g.rotation.set(kick * 0.28 - dip * 0.5, -0.12, dip * 0.25);
      m.anim(t, { kick, reload: arsenal.reloading ? reload || 0.001 : 0 });
      root.updateMatrixWorld(true);
      // The shots in flight.
      if (lineUntil && t > lineUntil) { lineN = 0; lineGeo.setDrawRange(0, 0); lineUntil = 0; }
      for (const b of balls) {
        if (!b.m.visible) continue;
        b.t += dt / b.life;
        if (b.t >= 1) { b.m.visible = false; continue; }
        b.m.position.lerpVectors(b.from, b.to, b.t);
        b.m.scale.setScalar(b.size * (1 + b.t * 0.5));
        b.m.material.opacity = 0.9 * (1 - b.t * 0.6);
      }
    },
    hideEffects() { for (const b of balls) b.m.visible = false; lineGeo.setDrawRange(0, 0); lineN = 0; },
  };
}
