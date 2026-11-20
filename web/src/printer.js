import * as THREE from 'three';
import { DEFAULT, COLOURS, parsePrint, cleanPrint, describe } from './pure/printer.js';
import { buildPrint, PATH } from './pure/printbuild.js';
import { drawLetters } from './pure/keychain.js';

// Models are built off the page's thread the first time they are needed, never when the page starts.
const KEY = 'home.print', HEAT = 1.8, PRINT = 15, SLOW = 300, NEAR = 12;
// The models' fronts face the room (-x), where a visitor stands.
const FACE = -Math.PI / 2, UP = new THREE.Vector3(0, 1, 0);

// The keychain's words drawn on the page, for a browser whose workers cannot draw.
let cv = null;
export const letters = text => drawLetters(text, (w, h) => {
  cv ||= document.createElement('canvas');
  cv.width = w; cv.height = h;
  return cv.getContext('2d', { willReadFrequently: true });
});

export function makePrinter({ scene, meta, parts, store, b2t, renderer, sfx = null, coarse = false }) {
  if (!meta.points.print_bed || !meta.points.printer) return null;
  const bedTop = b2t(...meta.points.print_bed), headRest = b2t(...meta.points.printer);
  const home = Object.fromEntries(Object.entries(parts).filter(([, o]) => o).map(([k, o]) => [k, o.position.clone()]));
  if (renderer) renderer.localClippingEnabled = true;
  // Cut at the layer being printed; the inside is drawn flat, so the cut looks like a solid top, as on a real print.
  const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const stripes = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255, 222, 222, 222, 255]), 1, 2);
  stripes.wrapS = stripes.wrapT = THREE.RepeatWrapping;
  stripes.minFilter = THREE.LinearMipmapLinearFilter; stripes.magFilter = THREE.LinearFilter; stripes.generateMipmaps = true;
  stripes.needsUpdate = true;
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, map: stripes, fog: true, clippingPlanes: [cutPlane] });
  const capMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: true, clippingPlanes: [cutPlane] });
  const group = new THREE.Group();
  group.name = 'print_part';
  group.position.copy(bedTop); group.rotation.y = FACE;
  // Until a print is built the meshes hold nothing, but stay in the scene, so their shaders are made with the house's.
  const EMPTY = new THREE.BufferGeometry(), mesh = new THREE.Mesh(EMPTY, mat), cap = new THREE.Mesh(EMPTY, capMat);
  mesh.frustumCulled = cap.frustumCulled = false;
  group.add(mesh, cap);
  scene.add(group);

  let p = DEFAULT, mine = false;
  try { const saved = JSON.parse(store.get(KEY) || 'null'); if (saved) { p = cleanPrint(saved); mine = true; } } catch { /* a broken save prints the default */ }
  let built = null, asked = false, failed = false, worker = null, slow = null, job = 0;
  let clock = 0, start = 0, printFrom = 0, done = mine, sounding = false;
  const paint = () => { mat.color.set(COLOURS[p.colour]); capMat.color.set(COLOURS[p.colour]).multiplyScalar(0.9); };
  paint();

  function take(id, b) {
    if (id !== job) return;
    const g = new THREE.BufferGeometry(), c = new Float32Array(b.shade.length * 3);
    for (let i = 0; i < b.shade.length; i++) { const s = b.shade[i]; c[i * 3] = s; c[i * 3 + 1] = s * 0.99; c[i * 3 + 2] = s * 0.97; }
    g.setAttribute('position', new THREE.BufferAttribute(b.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(b.uv, 2));
    g.setIndex(new THREE.BufferAttribute(b.index, 1));
    g.computeBoundingSphere();
    clear();
    mesh.geometry = cap.geometry = g;
    mesh.frustumCulled = cap.frustumCulled = true;
    built = b;
  }
  function clear() {
    if (mesh.geometry !== EMPTY) mesh.geometry.dispose();
    mesh.geometry = cap.geometry = EMPTY;
    mesh.frustumCulled = cap.frustumCulled = false;
  }
  function fail(id, why) {
    if (id !== job) return;
    console.warn('[loft] printer:', why);
    failed = true; slow = null;
  }
  const points = coarse ? 150000 : 240000;
  let busy = false;
  function build() {
    const id = ++job, print = { ...p };
    asked = true; built = null; slow = null; failed = false;
    clear();
    if (typeof Worker === 'function' && worker !== false) {
      try {
        // A print asked for while another is still being made replaces it: the old one is not finished first.
        if (worker && busy) { worker.terminate(); worker = null; }
        if (!worker) {
          worker = new Worker(new URL('./printwork.js', import.meta.url), { type: 'module' });
          worker.onmessage = ({ data }) => {
            busy = data.letters;
            if (data.error) fail(data.id, data.error);
            // A worker without a canvas of its own gets the letters drawn here.
            else if (data.letters) { if (data.id === job) { const bitmap = letters(p.text); worker.postMessage({ id: data.id, print: { ...p }, bitmap, points }, [bitmap.data.buffer]); } }
            else take(data.id, data.b);
          };
          // Where the worker cannot run, the latest print is built here instead, a little each frame.
          worker.onerror = e => { e.preventDefault?.(); worker.terminate(); worker = false; if (!built) slowly(job, { ...p }); };
        }
        worker.postMessage({ id, print, points });
        busy = true;
        return;
      } catch { worker = false; }
    }
    slowly(id, print);
  }
  async function slowly(id, print) {
    try {
      const { letterField } = await import('./pure/keychain.js');
      if (id === job) slow = { id, gen: buildPrint(print, { field: print.model === 'word' ? letterField(letters(print.text)) : null, points }) };
    } catch (e) { fail(id, e.message); }
  }
  function stepSlow() {
    const t0 = performance.now(), s = slow;
    try {
      while (performance.now() - t0 < 5) {
        const r = s.gen.next();
        if (r.done) { slow = null; take(s.id, r.value); return; }
      }
    } catch (e) { fail(s.id, e.message); }
  }

  const heating = () => mine && !done && (!built || clock - start < HEAT);
  function progress() {
    if (done) return 1;
    if (!mine) return (0.45 + clock / SLOW) % 1;
    if (heating()) return 0;
    printFrom ||= clock;
    return Math.min(1, (clock - printFrom) / PRINT);
  }
  function begin(q, said) {
    p = cleanPrint(q); mine = true; done = false; start = clock; printFrom = 0;
    paint(); build();
    store.set(KEY, JSON.stringify(p));
    return said;
  }

  const tmp = new THREE.Vector3(), nz = new THREE.Vector3(), mid = new THREE.Vector3(), right = new THREE.Vector3(), upv = new THREE.Vector3();
  const target = { head: new THREE.Vector3(), gantry: new THREE.Vector3(), bed: new THREE.Vector3() };
  const lastHead = new THREE.Vector3(), lastBed = new THREE.Vector3(), soundAt = new THREE.Vector3();
  const box = new THREE.Box3().setFromCenterAndSize(bedTop.clone().add(new THREE.Vector3(0, 0.13, 0)), new THREE.Vector3(0.5, 0.42, 0.5));

  return {
    group, mesh, cap,
    get print() { return { ...p }; },
    get progress() { return progress(); },
    get heating() { return heating(); },
    get mine() { return mine; },
    get failed() { return failed; },
    get sounding() { return sounding; },
    get built() { return built ? { height: built.height, radius: built.radius, layers: built.layers, tris: built.index.length / 3 } : null; },
    describe: () => describe(p),
    ask(text) {
      const r = parsePrint(text, p);
      return r ? begin(r.p, r.said) : null;
    },
    start(pick) {
      const q = cleanPrint({ model: pick.model, text: pick.text, colour: pick.colour, size: pick.size });
      if (q.model !== pick.model) return null;
      return begin(q, `Printing ${describe(q)}.`);
    },
    hit(ray, blockers) {
      const h = ray.ray.intersectBox(box, tmp);
      if (!h) return null;
      const d = ray.ray.origin.distanceTo(h);
      if (blockers && ray.intersectObjects(blockers, true)[0]?.distance < d - 0.05) return null;
      return meta.interact.find(i => i.id === 'printer') || null;
    },
    view(eye, look, camera, cover = { right: 0, bottom: 0 }) {
      const h = built ? built.height : 0.15;
      mid.copy(bedTop).add(nz.set(0, Math.max(0.08, h * 0.52), 0));
      const vf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), hf = vf * camera.aspect, half = Math.max(0.17, h * 0.5 + 0.08);
      const dist = Math.min(1.7, Math.max(0.62, half / Math.max(0.2, (1 - cover.bottom) * vf), half / Math.max(0.2, (1 - cover.right) * hf)));
      const yaw = Math.PI - 0.3, rise = 0.4;
      eye.set(Math.cos(yaw) * Math.cos(rise), Math.sin(rise), Math.sin(yaw) * Math.cos(rise)).multiplyScalar(dist).add(mid);
      const fwd = nz.copy(mid).sub(eye).normalize();
      right.crossVectors(fwd, UP).normalize(); upv.crossVectors(right, fwd);
      look.copy(mid).addScaledVector(right, cover.right * hf * dist).addScaledVector(upv, -cover.bottom * vf * dist);
    },
    tick(dt, cam) {
      clock += dt;
      const near = cam.distanceToSquared(bedTop) < NEAR * NEAR;
      if (near && !asked) build();
      if (slow) stepSlow();
      const k = progress(), warm = heating();
      if (mine && k >= 1) done = true;
      const printing = k < 1 && !!built && !warm, layers = built ? built.layers : 1, layer = Math.min(layers, Math.floor(k * layers));
      cutPlane.constant = !built || warm ? bedTop.y - 1 : k < 1 ? bedTop.y + (layer / layers) * built.height + 1e-4 : bedTop.y + 10;
      const run = mine && !done && !failed;
      if (!near && !run) { if (sounding) { sounding = false; sfx?.printer(false); } return; }
      // The nozzle follows this layer's outline; when nothing is printing the head parks and the bed comes home.
      if (printing) {
        const f = (k * layers - layer) * PATH, i = Math.min(PATH - 1, Math.floor(f)), j = Math.min(PATH - 1, i + 1), w = f - i, o = layer * PATH, P = built.path;
        nz.set(P[(o + i) * 2] * (1 - w) + P[(o + j) * 2] * w, 0, P[(o + i) * 2 + 1] * (1 - w) + P[(o + j) * 2 + 1] * w).applyAxisAngle(UP, FACE);
        target.head.set(0, ((layer + 1) / layers) * built.height + 0.037 + bedTop.y - headRest.y, nz.z);
        target.bed.set(-nz.x, 0, 0);
      } else {
        target.head.set(0, 0, 0);
        target.bed.set(0, 0, 0);
      }
      target.gantry.set(0, target.head.y, 0);
      const f = Math.min(1, dt * (printing ? 25 : 4));
      for (const [name, o] of Object.entries(parts)) if (o) o.position.lerp(tmp.copy(home[name]).add(target[name]), f);
      group.position.set(bedTop.x + (parts.bed ? parts.bed.position.x - home.bed.x : 0), bedTop.y, bedTop.z);
      // Only a print of yours is heard, so the desk stays quiet the rest of the time.
      if (run && sfx) {
        const step = Math.max(dt, 1e-3), hv = parts.head ? parts.head.position.distanceTo(lastHead) / step : 0, bv = parts.bed ? parts.bed.position.distanceTo(lastBed) / step : 0;
        sounding = true;
        sfx.printer(true, soundAt.copy(bedTop).setY(bedTop.y + 0.12), { a: printing ? Math.min(1, hv / 1.2) : 0, b: printing ? Math.min(1, bv / 1.2) : 0 });
      } else if (sounding) { sounding = false; sfx?.printer(false); }
      if (parts.head) lastHead.copy(parts.head.position);
      if (parts.bed) lastBed.copy(parts.bed.position);
    },
  };
}
