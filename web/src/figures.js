// The desk shelf's figures: a tiny Pishi and a tiny Jessi, sitting, copied from the residents' own models, and a BEHI 22
// bobblehead of me in the keeper kit with the hood head. They are built a piece at a time in the page's spare moments
// once the house has settled, and the room's three plain peg figures are folded away as they appear. A click bobs the head.
import * as THREE from 'three';
import { piece, mesh, PAINT, sph, cyl, rbox, torus, glow } from './shapes.js';
import { SHELF_TOP, PEG_X, PEG_Z, PEG_BOXES, trianglesInside, foldTriangles, newBob, nudgeBob, stepBob, pixelText } from './pure/figures.js';

// A real cat or dog at about a quarter size; the house's sit pose (see animatePet in creatures.js), eased all the way in.
const SCALE = 0.27, KIT = '#111114', TRIM = '#7b2ff7', CREAM = '#e8e3d8', GLOVE = '#f2f2f2', BASE = '#1a1c21', HOOD = '#2a2d35', VOID = '#030304';
// The figures face the room (west), the two pets turned a little toward the bobblehead between them.
const FACING = { pishi: -Math.PI / 2 - 0.35, behi: -Math.PI / 2, jessi: -Math.PI / 2 + 0.35 };
// A piece is built in a spare moment with this many ms left in it, or after this many ms at the latest.
const ROOM = 3, WAIT = 300;
// The studio's model is looked through for the pegs this many indices at a time (a whole number of triangles).
const PART = 3 * 8192;
const later = typeof requestIdleCallback === 'function' ? f => requestIdleCallback(f, { timeout: WAIT }) : f => setTimeout(() => f(null), 50);

// A copy of a resident (it shares their shapes, so it costs next to nothing), sat down at figure size and facing +z.
// Every part the house animates is set outright, so whatever the resident is doing just then does not show.
function sitting(agent, size, tail) {
  const root = agent.root.clone(true), from = [], to = [];
  agent.root.traverse(o => from.push(o));
  root.traverse(o => to.push(o));
  const twin = o => to[from.indexOf(o)];
  root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.scale.setScalar(SCALE);
  for (const l of agent.legs) { const hip = twin(l.hip); hip.rotation.set(l.front ? 0 : -1.2, 0, 0); hip.scale.set(1, 1, 1); }
  const body = twin(agent.body), head = twin(agent.head);
  body.rotation.set(-0.45, 0, 0); body.position.set(0, -size * 0.15, -size * 0.2);
  head.rotation.set(0.35, 0, 0);
  twin(agent.tail).rotation.set(tail, 0, 0);
  return root;
}

// Every shown piece of a model painted with the house's shared paint, as one new geometry in the model's own space
// (the model's own shapes are left as they are), its footprint centred on 0 and standing on top of a round display
// base. A piece at a time (each `yield` a breath); the shape goes into `out.geo`.
function* flatten(root, out) {
  root.updateMatrixWorld(true);
  const meshes = [], geos = [];
  root.traverse(o => { if (o.isMesh && o.visible && o.material === PAINT) meshes.push(o); });
  for (const o of meshes) { geos.push(o.geometry.clone().applyMatrix4(o.matrixWorld)); yield; }
  const g = mesh(geos).geometry;
  for (const x of geos) x.dispose();
  yield;
  g.computeBoundingBox();
  const bb = g.boundingBox;
  out.geo = g.translate(-(bb.min.x + bb.max.x) / 2, 0.006 - bb.min.y, -(bb.min.z + bb.max.z) / 2);
}

// Raised squares (the lettering) written straight into one geometry: each square's front and four sides, shaded as
// `piece` shades. `cells`: [x, y] centres; all on the plane z = `z`, standing `depth` out of it.
function squares(cells, size, depth, z, color) {
  const c = new THREE.Color(color), shade = ny => 1 - 0.4 * (1 - (0.5 + 0.35 * (0.5 + 0.5 * ny)));
  const faces = [[0, 0, 1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]], h = size / 2;
  const pos = new Float32Array(cells.length * 30 * 3), nor = new Float32Array(pos.length), col = new Float32Array(pos.length);
  let k = 0;
  const put = (x, y, zz, n, s) => { pos.set([x, y, zz], k); nor.set(n, k); col.set([c.r * s, c.g * s * 0.98, c.b * s * 0.95], k); k += 3; };
  for (const [cx, cy] of cells) {
    for (const n of faces) {
      const s = shade(n[1]);
      // Two triangles per face, wound to face out along n.
      const q = n[2] ? [[-h, -h, depth], [h, -h, depth], [h, h, depth], [-h, h, depth]]
        : n[0] ? [[n[0] * h, -h, 0], [n[0] * h, -h, depth], [n[0] * h, h, depth], [n[0] * h, h, 0]]
          : [[-h, n[1] * h, 0], [h, n[1] * h, 0], [h, n[1] * h, depth], [-h, n[1] * h, depth]];
      const flip = n[0] < 0 || n[1] > 0;
      for (const i of flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]) put(cx + q[i][0], cy + q[i][1], z + q[i][2], n, s);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
// The display base a pet stands on, as large as the peg's footprint in the baked light.
const roundBase = () => piece(cyl(0.036, 0.038, 0.006, 28), BASE, [0, 0.003, 0]);

// The bobblehead, facing +z and standing at 0: its base, its body, and its head (apart, to bob).
const TOP = 0.0175, NECK = TOP + 0.088;
// The bobblehead's shapes, put into `parts` a few at a time (each `yield` is a breath between them). A square base
// with my name on its front in raised squares.
function* bobbleBase(parts) {
  parts.push(piece(rbox(0.074, 0.016, 0.058, 0.004, 2), BASE, [0, 0.008, 0]), piece(rbox(0.075, 0.003, 0.059, 0.0012, 1), TRIM, [0, 0.0158, 0]));
  yield;
  const label = pixelText('BEHI 22'), px = 0.0021;
  parts.push(squares(label.cells.map(([c, r]) => [(c - (label.cols - 1) / 2) * px, 0.0135 - r * px]), px * 0.9, 0.0006, 0.029, CREAM));
}
function* bobbleBody(parts) {
  const top = TOP;
  // Boots, socks and shorts, the shirt, the arms down at the sides ending in big keeper gloves.
  for (const s of [-1, 1]) {
    parts.push(piece(rbox(0.014, 0.008, 0.022, 0.003, 2), GLOVE, [s * 0.009, top + 0.004, 0.003]));
    parts.push(piece(cyl(0.0055, 0.006, 0.026, 12), KIT, [s * 0.009, top + 0.02, 0]));
    parts.push(piece(rbox(0.0035, 0.012, 0.0035, 0.001, 1), TRIM, [s * 0.009, top + 0.016, 0.004]));
    yield;
  }
  parts.push(piece(rbox(0.032, 0.016, 0.022, 0.005, 2), KIT, [0, top + 0.038, 0]));
  parts.push(piece(rbox(0.036, 0.034, 0.024, 0.008, 2), KIT, [0, top + 0.06, 0]));
  yield;
  parts.push(piece(rbox(0.037, 0.003, 0.025, 0.001, 1), TRIM, [0, top + 0.046, 0]));
  parts.push(piece(torus(0.0075, 0.0018, 6, 18), TRIM, [0, top + 0.077, 0], [Math.PI / 2, 0, 0]));
  // The hoodie's drawstrings, down the chest.
  for (const s of [-1, 1]) parts.push(piece(cyl(0.0009, 0.0009, 0.016, 6), CREAM, [s * 0.0055, top + 0.069, 0.0128], [0.12, 0, s * 0.06]));
  yield;
  const chest = pixelText('22'), cp = 0.0022;
  parts.push(squares(chest.cells.map(([c, r]) => [(c - (chest.cols - 1) / 2) * cp, top + 0.068 - r * cp]), cp * 0.9, 0.0005, 0.0118, CREAM));
  yield;
  for (const s of [-1, 1]) {
    parts.push(piece(rbox(0.01, 0.032, 0.012, 0.004, 2), KIT, [s * 0.023, top + 0.058, 0.001], [0, 0, s * 0.18]));
    parts.push(piece(rbox(0.011, 0.003, 0.013, 0.001, 1), TRIM, [s * 0.026, top + 0.044, 0.001], [0, 0, s * 0.18]));
    parts.push(piece(sph(0.0085, 12, 9), GLOVE, [s * 0.027, top + 0.038, 0.003], [0, 0, 0], [0.9, 1.15, 0.8]));
    yield;
  }
  // The spring the head nods on.
  parts.push(piece(cyl(0.004, 0.004, 0.012, 10), '#5c6068', [0, top + 0.083, 0]));
}

// The hood head, oversized as a bobblehead's is: the hood up, the dark of the face an oval just breaking its front, a
// thin purple edge round the opening. The two eyes glow apart from it, as mine do. Its shape and eyes go into `out`.
function* bobbleHead(out) {
  const r = 0.036, cy = r * 1.02, fy = cy - r * 0.06, parts = [piece(sph(r, 24, 18), HOOD, [0, cy, -0.003], [0, 0, 0], [1, 1.08, 1.06])];
  yield;
  parts.push(piece(sph(r * 0.66, 20, 14), VOID, [0, fy, r * 0.62], [0, 0, 0], [0.9, 1.08, 0.75], 0), piece(torus(r * 0.47, 0.0015, 6, 30), TRIM, [0, fy, r * 0.94], [0, 0, 0], [1, 1.25, 1]));
  yield;
  out.geo = mesh(parts).geometry;
  yield;
  out.eyes = mesh([-1, 1].map(s => piece(rbox(0.0105, 0.0075, 0.002, 0.0025, 2), '#ffffff', [s * 0.0105, fy + r * 0.1, r * 1.055], [0, s * 0.3, s * -0.12], [1, 1, 1], 0)), glow(0.3, 1.9, 1.6));
  out.eyes.material.userData.lamp = 'glow';
}

export function makeFigures(scene, { creatures, settle = 3, coarse = false } = {}) {
  const at = z => new THREE.Vector3(PEG_X, SHELF_TOP, z);
  const place = (g, name, z) => { const o = new THREE.Matrix4().makeRotationY(FACING[name]).setPosition(at(z)); return g.applyMatrix4(o); };
  const bob = newBob();
  let since = 0, asked = 0, times = [], head = null, body = null, done = false, folded = 0;
  // The build, in small pieces (each `yield` a breath): each pet copied and sat, made one shape on its base; the
  // bobblehead's base and body, then its head; all of it joined; the pegs looked for a part of the model at a time;
  // then everything goes up with the pegs folded away together.
  function* building() {
    const pets = [];
    for (const [name, size, tail, z] of [['pishi', 0.2, 0.9, PEG_Z[0]], ['jessi', 0.22, 0, PEG_Z[2]]]) {
      const sat = sitting(creatures[name], size, tail);
      yield;
      const pet = {};
      yield* flatten(sat, pet);
      yield;
      pets.push(place(pet.geo, name, z), place(roundBase(), name, z));
      yield;
    }
    // The bobblehead's base, then its body in two halves, each made one shape and stood in its place.
    const bobble = [], parts = [];
    yield* bobbleBase(parts);
    bobble.push(place(mesh(parts.splice(0)).geometry, 'behi', PEG_Z[1]));
    yield;
    yield* bobbleBody(parts);
    yield;
    bobble.push(place(mesh(parts.splice(0, parts.length >> 1)).geometry, 'behi', PEG_Z[1]));
    yield;
    bobble.push(place(mesh(parts).geometry, 'behi', PEG_Z[1]));
    yield;
    const hood = {};
    yield* bobbleHead(hood);
    yield;
    const all = [...pets, ...bobble], geo = mesh(all).geometry;
    for (const g of all) g.dispose();
    yield;
    const studio = scene.getObjectByName('studio_baked')?.geometry, idx = studio?.index, starts = [];
    if (idx) for (let from = 0; from < idx.count; from += PART) { trianglesInside(idx.array, studio.attributes.position.array, PEG_BOXES, from, from + PART, starts); yield; }
    body = new THREE.Mesh(geo, PAINT);
    body.name = 'shelf_figures';
    head = new THREE.Group();
    head.name = 'bobble_head';
    head.position.copy(at(PEG_Z[1])).add(new THREE.Vector3(0, NECK, 0));
    head.rotation.y = FACING.behi;
    const tilt = new THREE.Group();
    tilt.add(new THREE.Mesh(hood.geo, PAINT), hood.eyes);
    head.add(tilt);
    head.userData.tilt = tilt;
    // Nothing here moves but the head's tilt while it bobs, so no matrix is worked out again each frame otherwise.
    scene.add(body, head);
    for (const o of [body, head, tilt, ...tilt.children]) { o.updateMatrix(); o.matrixAutoUpdate = false; }
    head.updateMatrixWorld(true); body.updateMatrixWorld(true);
    folded = idx ? foldPegs(idx, starts) : 0;
    done = true;
  }
  const build = building();
  function work(deadline) {
    const t0 = performance.now();
    if (deadline && !deadline.didTimeout && deadline.timeRemaining() < ROOM && t0 - asked < WAIT) { later(work); return; }
    // A piece, then more while this spare moment has room for another.
    let end;
    do {
      const s = performance.now();
      end = build.next().done;
      times.push(+(performance.now() - s).toFixed(2));
    } while (!end && deadline && !deadline.didTimeout && deadline.timeRemaining() >= ROOM);
    asked = performance.now();
    if (!end) later(work);
  }
  // Seen from the floor the figures are small, so a finger only has to land near the bobblehead.
  const pad = coarse ? 0.1 : 0.04;
  const hitBox = new THREE.Box3(at(PEG_Z[1] - pad).add(new THREE.Vector3(-pad, 0, 0)), at(PEG_Z[1] + pad).add(new THREE.Vector3(pad, coarse ? 0.24 : 0.19, 0)));

  return {
    get built() { return done; },
    get folded() { return folded; },
    get bobbing() { return bob.on; },
    get tilt() { return bob.a.slice(); },
    // How long each piece of the build took, in ms.
    get times() { return times.slice(); },
    // Starts the build once the house has been up `settle` seconds, then only works while the head bobs.
    tick(dt) {
      if (!done) { if (!asked && (since += dt) >= settle) { asked = performance.now(); later(work); } return; }
      if (!bob.on) return;
      stepBob(bob, dt);
      const tilt = head.userData.tilt;
      tilt.rotation.set(bob.a[0], 0, bob.a[1]);
      tilt.updateMatrix();
    },
    // A click or tap on the bobblehead sets its head nodding; true when it was hit and nothing stood in front.
    hit(ray, blockers) {
      if (!done) return false;
      const p = ray.ray.intersectBox(hitBox, new THREE.Vector3());
      if (!p) return false;
      const d = p.distanceTo(ray.ray.origin);
      if (blockers && ray.intersectObjects(blockers, true).some(h => h.distance < d - 0.05)) return false;
      nudgeBob(bob, 2.2 + Math.random() * 0.8, (Math.random() - 0.5) * 2.4);
      return true;
    },
  };
}

// The pegs' triangles folded away in the studio's model, and only the changed run of its index sent to the graphics
// card; returns how many went.
function foldPegs(idx, starts) {
  const run = foldTriangles(idx.array, starts);
  if (!run) return 0;
  idx.addUpdateRange(run.start, run.count);
  idx.needsUpdate = true;
  return starts.length;
}
