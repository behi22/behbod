import * as THREE from 'three';
import { b2t } from './engine.js';
import { piece, mesh, glow, sph, cyl, box, rbox, PAINT } from './shapes.js';

// The fleet over the lounge: an Imperial Star Destroyer as a display model hovering in the double-height space, and a dogfight of
// small X-wings and TIE fighters looping round it, with laser bolts, hits and sparks. Every ship is a solid (the old
// TIE's wings were single faces and vanished when seen from behind). Ships face +z, so lookAt points them along a path.

function xwing() {
  const g = new THREE.Group();
  const W = '#e7e5df', G = '#9aa0a8', R = '#b5392d', K = '#2a2d33';
  const parts = [
    piece(rbox(0.06, 0.05, 0.3, 0.012), W, [0, 0, 0]),
    piece(cyl(0.008, 0.03, 0.15, 10), W, [0, -0.004, 0.22], [Math.PI / 2, 0, 0]),
    piece(sph(0.022, 12, 8), '#1d232b', [0, 0.028, 0.04], [0, 0, 0], [1, 0.7, 1.9]),
    piece(sph(0.011, 10, 8), '#3d6fd6', [0, 0.028, -0.03]),
    piece(box(0.062, 0.006, 0.05), R, [0, 0.026, 0.13]),
  ];
  // S-foils open in attack position: four wings, each with an engine at the root and a cannon at the tip.
  for (const sy of [-1, 1]) for (const sx of [-1, 1]) {
    const tilt = sy * sx * 0.21;
    parts.push(piece(box(0.22, 0.006, 0.1), sy > 0 ? W : G, [sx * 0.13, sy * 0.022 + sy * 0.023, -0.07], [0, 0, tilt]));
    if (sy > 0) parts.push(piece(box(0.12, 0.007, 0.022), R, [sx * 0.15, 0.05, -0.07], [0, 0, tilt]));
    parts.push(piece(cyl(0.017, 0.017, 0.12, 10), G, [sx * 0.042, sy * 0.026, -0.09], [Math.PI / 2, 0, 0]));
    parts.push(piece(cyl(0.004, 0.004, 0.17, 6), K, [sx * 0.24, sy * 0.068, -0.02], [Math.PI / 2, 0, 0]));
  }
  g.add(mesh(parts, PAINT));
  // Engine glow at the back of each engine.
  const fire = glow(3.2, 1.0, 0.6);
  for (const sy of [-1, 1]) for (const sx of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.CircleGeometry(0.014, 12), fire);
    f.position.set(sx * 0.042, sy * 0.026, -0.152); f.rotation.y = Math.PI; g.add(f);
  }
  return g;
}

function tie() {
  const g = new THREE.Group();
  const G = '#70757e', K = '#24272c', L = '#8b919a';
  const parts = [
    piece(sph(0.05, 16, 12), G, [0, 0, 0]),
    piece(cyl(0.028, 0.028, 0.012, 16), '#14171b', [0, 0, 0.046], [Math.PI / 2, 0, 0]),
    ...[0, 1, 2, 3].map(i => piece(box(0.05, 0.004, 0.004), L, [0, 0, 0.053], [0, 0, i * Math.PI / 4])),
    piece(cyl(0.013, 0.013, 0.2, 10), G, [0, 0, 0], [0, 0, Math.PI / 2]),
  ];
  // Two hexagonal wing panels with a raised frame and six spokes, solid so they show from both sides.
  for (const sx of [-1, 1]) {
    parts.push(piece(cyl(0.125, 0.125, 0.008, 6), K, [sx * 0.105, 0, 0], [0, 0, Math.PI / 2]));
    parts.push(piece(cyl(0.13, 0.13, 0.005, 6), L, [sx * 0.105, 0, 0], [0, 0, Math.PI / 2], [1, 1, 1], 0.5));
    for (let i = 0; i < 3; i++) parts.push(piece(box(0.012, 0.25, 0.012), L, [sx * 0.11, 0, 0], [i * Math.PI / 3, 0, 0]));
    parts.push(piece(cyl(0.022, 0.022, 0.016, 12), L, [sx * 0.105, 0, 0], [0, 0, Math.PI / 2]));
  }
  g.add(mesh(parts, PAINT));
  const fire = glow(2.4, 0.5, 0.4);
  for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.CircleGeometry(0.008, 10), fire); f.position.set(sx * 0.016, 0, -0.051); f.rotation.y = Math.PI; g.add(f); }
  return g;
}

// A small seeded random, so the Star Destroyer's surface detail is the same on every visit.
function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// A solid from corner points and triangles, each wound counter-clockwise seen from outside (the material is one-sided).
function poly(v, faces) {
  const pos = [];
  for (const [a, b, c] of faces) pos.push(...v[a], ...v[b], ...v[c]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// An Imperial Star Destroyer, nose forward (+z): the dagger hull with a stepped upper deck over a shallower keel, the
// trench down the front of the spine, the stepped command tower with its T bridge and two shield domes, the engines.
function starDestroyer() {
  const g = new THREE.Group();
  const L = 0.86, HW = 0.56, TOP = 0.15, KEEL = 0.1;
  const LIGHT = '#c3c6cb', MID = '#a5a9af', DARK = '#6e737a', DEEP = '#3d4148';
  // The main hull from five corners: the nose, the stern corners, the top of the stern on the spine, the keel's foot.
  // The underside is its own darker piece, so seen from the lounge below the hull reads as a ship and not a pale sheet.
  const V5 = [[0, 0, L], [-HW, 0, -L], [HW, 0, -L], [0, TOP, -L], [0, -KEEL, -L]];
  const parts = [
    piece(poly(V5, [[0, 3, 1], [0, 2, 3], [1, 3, 2]]), LIGHT, [0, 0, 0], [0, 0, 0], [1, 1, 1], 0.9),
    piece(poly(V5, [[0, 1, 4], [0, 4, 2], [1, 2, 4]]), '#7d8188', [0, 0, 0], [0, 0, 0], [1, 1, 1], 0.6),
  ];
  // The underside's height at a point, and its slope across: the keel runs down the middle, highest at the edges.
  const under = (x, z) => -KEEL * ((L - z) / (2 * L) - Math.abs(x) / HW);
  const keelSlope = Math.atan2(KEEL, HW);
  // Down the middle of the keel: the ridge, the main hangar's dark mouth with its lit inside, the reactor dome aft.
  parts.push(piece(box(0.03, 0.022, 0.68), DARK, [0, under(0, -0.41) - 0.006, -0.41], [-Math.atan2(KEEL, 2 * L), 0, 0], [1, 1, 1], 0.6));
  parts.push(piece(box(0.13, 0.012, 0.2), '#15181c', [0, under(0, 0.08) - 0.004, 0.08], [-Math.atan2(KEEL, 2 * L), 0, 0], [1, 1, 1], 0));
  parts.push(piece(sph(0.095, 20, 12), MID, [0, under(0, -0.56) - 0.006, -0.56], [0, 0, 0], [1, 0.32, 1.15], 0.7));
  // The upper deck steps up twice toward the spine, the terraces the class is known by.
  const ridge = z => TOP * (L - z) / (2 * L);
  const deckY = (x, z) => Math.max(0, ridge(z) - TOP * Math.abs(x) / HW);
  const terraces = [[0.76, 0.28, 0.016, MID], [0.5, -0.22, 0.016, LIGHT]];
  let base = 0;
  for (const [w, zn, lift, col] of terraces) {
    const hw = HW * w, rn = ridge(zn) + base, dl = deckY(hw, -L) + base;
    const v = [[0, rn + lift, zn], [-hw, dl + lift, -L], [hw, dl + lift, -L], [0, TOP + base + lift, -L], [0, rn, zn], [-hw, dl, -L], [hw, dl, -L]];
    parts.push(piece(poly(v, [[0, 3, 1], [0, 2, 3], [4, 0, 1], [4, 1, 5], [4, 2, 0], [4, 6, 2], [1, 3, 2], [5, 1, 2], [5, 2, 6]]), col, [0, 0, 0], [0, 0, 0], [1, 1, 1], 0.9));
    base += lift;
  }
  // The deck's height at a point, terraces included, so the detail sits on whichever step it lands on.
  const surf = (x, z) => {
    let y = deckY(x, z);
    for (const [w, zn, lift] of terraces) if (z <= zn && Math.abs(x) <= HW * w * (zn - z) / (zn + L)) y += lift;
    return y;
  };
  // The trench along the spine, ahead of the terraces.
  parts.push(piece(box(0.026, 0.01, 0.4), DEEP, [0, ridge(0.5) - 0.002, 0.5], [Math.atan2(TOP, 2 * L), 0, 0]));
  // The command tower: stacked blocks, then the neck, the T bridge with its window band, the two domes on stalks.
  const tz = -0.66, ty = TOP + base;
  for (const [w, h, d, y, c] of [[0.34, 0.05, 0.3, ty + 0.025, MID], [0.25, 0.05, 0.22, ty + 0.075, LIGHT], [0.16, 0.045, 0.15, ty + 0.122, MID]]) {
    parts.push(piece(box(w, h, d), c, [0, y, tz]));
  }
  parts.push(piece(box(0.05, 0.09, 0.05), MID, [0, ty + 0.19, tz - 0.02]));
  parts.push(piece(box(0.26, 0.03, 0.065), LIGHT, [0, ty + 0.245, tz - 0.02]));
  parts.push(piece(box(0.24, 0.008, 0.012), '#1b1e22', [0, ty + 0.242, tz + 0.014]));
  for (const sx of [-1, 1]) {
    parts.push(piece(cyl(0.006, 0.006, 0.03, 8), DARK, [sx * 0.07, ty + 0.275, tz - 0.02]));
    parts.push(piece(sph(0.024, 16, 12), LIGHT, [sx * 0.07, ty + 0.3, tz - 0.02]));
  }
  // Detail on the decks: low blocks lying on the slope of the step they land on, clear of the tower and the trench.
  const rnd = seeded(41), slope = Math.atan2(TOP, HW);
  // A plate stays inside the hull's edge where the hull is narrowest under it (its nose end), and on one side of the
  // spine, so it never hangs over the edge or bridges the centre line at the wrong tilt.
  const onHull = (x, z, w, d) => Math.abs(x) + w / 2 <= HW * (L - z - d / 2) / (2 * L) * 0.96 && Math.abs(x) - w / 2 >= 0.004;
  for (let n = 0; n < 220; n++) {
    const z = -L + 0.06 + rnd() * 1.5, half = HW * (L - z) / (2 * L);
    const x = (rnd() * 2 - 1) * half * 0.88;
    if ((Math.abs(x) < 0.19 && z < -0.48) || (Math.abs(x) < 0.03 && z > 0.28)) continue;
    const w = 0.01 + rnd() * 0.035, d = 0.01 + rnd() * 0.04, h = 0.003 + rnd() * 0.01;
    if (!onHull(x, z, w, d)) continue;
    parts.push(piece(box(w, h, d), rnd() > 0.55 ? DARK : MID, [x, surf(x, z) + h / 2 - 0.001, z], [0, 0, -Math.sign(x) * slope]));
  }
  // Plating detail on the underside too, lying on whichever half of the keel it lands on, clear of the hangar and the dome.
  for (let n = 0; n < 110; n++) {
    const z = -L + 0.06 + rnd() * 1.5, half = HW * (L - z) / (2 * L);
    const x = (rnd() * 2 - 1) * half * 0.86;
    if (Math.abs(x) < 0.09 && z > -0.66 && z < 0.2) continue;
    const w = 0.012 + rnd() * 0.04, d = 0.012 + rnd() * 0.05, h = 0.003 + rnd() * 0.008;
    if (!onHull(x, z, w, d)) continue;
    parts.push(piece(box(w, h, d), rnd() > 0.5 ? DARK : DEEP, [x, under(x, z) - h / 2 + 0.001, z], [0, 0, Math.sign(x) * keelSlope], [1, 1, 1], 0.6));
  }
  // The stern: the three big engines, four small ones, and the dark band they sit in.
  parts.push(piece(box(0.62, 0.13, 0.02), DEEP, [0, 0.025, -L - 0.005]));
  const engines = [[0, 0.035, 0.05], [-0.16, 0.03, 0.045], [0.16, 0.03, 0.045], [-0.26, 0.02, 0.022], [0.26, 0.02, 0.022], [-0.08, -0.025, 0.022], [0.08, -0.025, 0.022]];
  for (const [x, y, r] of engines) parts.push(piece(cyl(r, r * 0.85, 0.06, 18), DARK, [x, y, -L - 0.035], [Math.PI / 2, 0, 0]));
  g.add(mesh(parts, PAINT));
  // The hangar's inside, a warm working light seen from below.
  const bay = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.17), glow(1.4, 1.05, 0.6));
  bay.rotation.x = Math.PI / 2 - Math.atan2(KEEL, 2 * L); bay.position.set(0, under(0, 0.08) - 0.0105, 0.08); g.add(bay);
  const fire = glow(1.1, 1.6, 3.2);
  for (const [x, y, r] of engines) { const e = new THREE.Mesh(new THREE.CircleGeometry(r * 0.8, 18), fire); e.position.set(x, y, -L - 0.066); e.rotation.y = Math.PI; g.add(e); }
  // Window lights in rows along the hull's edges and across the tower's front.
  const pts = [];
  for (let i = 0; i < 70; i++) {
    const t = i / 70, z = L - 2 * L * t, hw = HW * t;
    for (const sx of [-1, 1]) pts.push(sx * hw * 0.985, -0.006, z);
  }
  for (const [w, y] of [[0.3, ty + 0.01], [0.22, ty + 0.06], [0.14, ty + 0.105]]) for (let i = 0; i <= 10; i++) pts.push(-w / 2 + (w * i) / 10, y, tz + (w === 0.3 ? 0.152 : w === 0.22 ? 0.112 : 0.077));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: new THREE.Color(1.5, 1.4, 1.1), size: 0.008, sizeAttenuation: true })));
  return g;
}

export function makeFleet(scene, meta, { sound } = {}) {
  const F = meta.fighters;
  if (!F) return { tick() {} };
  const c = F.center;
  // The space the fight keeps to, in Blender axes: round the lounge's double-height space, clear of heads and ceiling.
  const P = (dx, dy, z) => b2t(c[0] + dx * F.rx, c[1] + dy * F.ry, z);
  const lanes = [
    [P(1, 0, 4.4), P(0.6, 0.85, 5.6), P(-0.4, 1, 6.0), P(-1, 0.2, 5.2), P(-0.7, -0.8, 4.1), P(0.3, -1, 4.6), P(0.95, -0.5, 5.4)],
    [P(-1, -0.2, 5.8), P(-0.3, 0.9, 4.6), P(0.7, 0.6, 3.9), P(1, -0.3, 4.8), P(0.2, -1, 5.9), P(-0.8, -0.8, 5.2)],
    [P(0, 1, 3.8), P(0.9, 0.2, 4.3), P(0.4, -0.9, 5.7), P(-0.6, -0.6, 6.0), P(-1, 0.5, 4.9), P(-0.3, 0.6, 4.0)],
  ].map(points => new THREE.CatmullRomCurve3(points, true, 'centripetal'));
  const LAP = 30;
  const root = new THREE.Group();
  scene.add(root);
  const big = starDestroyer();
  big.position.copy(P(0, 0, 5.75));
  root.add(big);
  const ships = [];
  lanes.forEach((lane, i) => {
    const x = xwing(); root.add(x);
    ships.push({ o: x, lane, phase: i / 3, side: 'x', roll: 0, spin: 0 });
  });
  // Five TIEs: two on the first X-wing's tail, two on the second, one on the third, each a little behind.
  [[0, 0.035, 0.05], [0, 0.06, -0.05], [1, 0.04, 0.06], [1, 0.07, -0.04], [2, 0.045, 0]].forEach(([k, lag, off]) => {
    const t = tie(); root.add(t);
    ships.push({ o: t, lane: lanes[k], phase: k / 3 - lag, side: 't', off, target: ships[k], roll: 0, spin: 0, nextShot: 1 + k + lag * 20 });
  });
  ships.filter(s => s.side === 'x').forEach((s, i) => { s.nextShot = 3 + i * 1.7; });

  // Laser bolts: one line set, red from the X-wings, green from the TIEs.
  const BOLTS = 48, boltPos = new Float32Array(BOLTS * 6), boltCol = new Float32Array(BOLTS * 6), bolts = [];
  const boltGeo = new THREE.BufferGeometry();
  boltGeo.setAttribute('position', new THREE.BufferAttribute(boltPos, 3));
  boltGeo.setAttribute('color', new THREE.BufferAttribute(boltCol, 3));
  const boltLines = new THREE.LineSegments(boltGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  boltLines.frustumCulled = false;
  root.add(boltLines);
  for (let i = 0; i < BOLTS; i++) bolts.push({ p: new THREE.Vector3(), d: new THREE.Vector3(), life: 0 });
  // Sparks when a TIE is hit.
  const SPARKS = 40, sparkPos = new Float32Array(SPARKS * 3), sparks = [];
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkPts = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: new THREE.Color(3, 1.8, 0.6), size: 0.025, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  sparkPts.frustumCulled = false;
  root.add(sparkPts);
  for (let i = 0; i < SPARKS; i++) sparks.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0 });

  const p = new THREE.Vector3(), ahead = new THREE.Vector3(), t0 = new THREE.Vector3(), t1 = new THREE.Vector3(), side = new THREE.Vector3(), fwd = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  function fire(from, dir, red) {
    const b = bolts.find(x => x.life <= 0);
    if (!b) return;
    b.p.copy(from); b.d.copy(dir).normalize(); b.life = 0.7; b.red = red;
  }
  function burst(at) {
    let n = 0;
    for (const s of sparks) if (s.life <= 0 && n < 14) { s.p.copy(at); s.v.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).multiplyScalar(1.4); s.life = 0.6 + Math.random() * 0.4; n++; }
  }
  let hitAt = 12;
  return {
    tick(dt, t, cam) {
      big.rotation.y = t * 0.02;
      big.position.y = P(0, 0, 5.75).y + Math.sin(t * 0.3) * 0.03;
      for (const s of ships) {
        const u = (((t / LAP + s.phase) % 1) + 1) % 1;
        s.lane.getPointAt(u, p);
        s.lane.getPointAt((u + 0.004) % 1, ahead);
        s.lane.getTangentAt(u, t0); s.lane.getTangentAt((u + 0.02) % 1, t1);
        // A TIE flies a little to one side of the X-wing it chases.
        if (s.off) { side.crossVectors(t0, UP).normalize(); p.addScaledVector(side, s.off); ahead.addScaledVector(side, s.off); }
        s.o.position.copy(p);
        s.o.lookAt(ahead);
        // Bank into the turn; the X-wings throw in a barrel roll now and then.
        const turn = Math.atan2(t0.x * t1.z - t0.z * t1.x, t0.x * t1.x + t0.z * t1.z);
        s.roll += (THREE.MathUtils.clamp(-turn * 9, -1.1, 1.1) - s.roll) * Math.min(1, dt * 3);
        let extra = 0;
        if (s.side === 'x') { const k = ((t + s.phase * 17) % 23) / 23; if (k > 0.9) extra = ((k - 0.9) / 0.1) * Math.PI * 2; }
        if (s.spin > 0) { s.spin -= dt; extra += s.spin * 9; }
        s.o.rotateZ(s.roll + extra);
        // Shooting: TIEs fire at the X-wing ahead of them, X-wings fire forward.
        s.nextShot -= dt;
        if (s.nextShot <= 0) {
          s.o.getWorldDirection(fwd);
          if (s.side === 't' && s.target) fwd.copy(s.target.o.position).sub(p).normalize().add(new THREE.Vector3((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.25));
          fire(p, fwd, s.side === 'x');
          if (sound && cam && cam.distanceTo(p) < 8) sound.tone(s.side === 'x' ? 1500 : 1100, s.side === 'x' ? 500 : 380, 0.12, 0.015);
          s.nextShot = s.side === 'x' ? 2.6 + Math.random() * 2 : 1.4 + Math.random() * 1.6;
        }
      }
      // Every so often an X-wing scores: a TIE sparks and tumbles, then rights itself.
      if (t > hitAt) {
        hitAt = t + 9 + Math.random() * 8;
        const ties = ships.filter(s => s.side === 't'), victim = ties[Math.floor(Math.random() * ties.length)];
        victim.spin = 1.2; burst(victim.o.position);
      }
      for (let i = 0; i < BOLTS; i++) {
        const b = bolts[i];
        if (b.life > 0) { b.life -= dt; b.p.addScaledVector(b.d, dt * 7); }
        const on = b.life > 0, k = on ? Math.min(1, b.life * 3) : 0;
        boltPos.set([b.p.x, b.p.y, b.p.z, b.p.x - b.d.x * 0.14, b.p.y - b.d.y * 0.14, b.p.z - b.d.z * 0.14], i * 6);
        const col = b.red ? [2.6 * k, 0.3 * k, 0.25 * k] : [0.4 * k, 2.6 * k, 0.5 * k];
        boltCol.set([...col, ...col], i * 6);
      }
      boltGeo.attributes.position.needsUpdate = true; boltGeo.attributes.color.needsUpdate = true;
      for (let i = 0; i < SPARKS; i++) {
        const s = sparks[i];
        if (s.life > 0) { s.life -= dt; s.p.addScaledVector(s.v, dt); s.v.y -= dt * 1.2; }
        sparkPos.set(s.life > 0 ? [s.p.x, s.p.y, s.p.z] : [0, -100, 0], i * 3);
      }
      sparkGeo.attributes.position.needsUpdate = true;
    },
  };
}
