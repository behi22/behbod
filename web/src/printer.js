import * as THREE from 'three';
import { DEFAULT, COLOURS, parsePrint, cleanPrint, buildPrint, nozzleAt } from './pure/printer.js';

// The 3D printer on the rack. Type to it and it prints what you asked for a layer at a time: the gantry rises, the head
// runs along it and the bed slides under the nozzle, so the nozzle traces each layer. Your last print stays on the bed
// for next time; with none, it is always part way through a slow vase.
const KEY = 'home.print', LAYERS = 40, QUICK = 14, SLOW = 300;

export function makePrinter({ scene, meta, parts, store, b2t }) {
  if (!meta.points.print_bed || !meta.points.printer) return null;
  const bedTop = b2t(...meta.points.print_bed), headRest = b2t(...meta.points.printer);
  const home = Object.fromEntries(Object.entries(parts).filter(([, o]) => o).map(([k, o]) => [k, o.position.clone()]));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: true });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  mesh.name = 'print_part';
  mesh.position.copy(bedTop);
  scene.add(mesh);

  let p = DEFAULT, build = null, start = 0, mine = false;
  try { const saved = JSON.parse(store.get(KEY) || 'null'); if (saved) { p = cleanPrint(saved); mine = true; } } catch (e) { /* a broken save prints the default */ }
  let clock = 0, done = mine;
  function load() {
    build = buildPrint(p, LAYERS);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(build.pos, 3));
    const c = new Float32Array(build.shade.length * 3);
    build.shade.forEach((s, i) => c.set([s, s, s], i * 3));
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    g.setIndex(new THREE.BufferAttribute(build.index, 1));
    mesh.geometry.dispose();
    mesh.geometry = g;
    mat.color.set(COLOURS[p.colour]);
  }
  load();

  // How far along the print is, 0 to 1. A visitor's print takes a few seconds; the default one never quite ends.
  const progress = () => (done ? 1 : mine ? Math.min(1, (clock - start) / QUICK) : (0.45 + clock / SLOW) % 1);
  const at = new THREE.Vector3(), target = { head: new THREE.Vector3(), gantry: new THREE.Vector3(), bed: new THREE.Vector3() };

  return {
    mesh,
    get print() { return { ...p }; },
    get progress() { return progress(); },
    // Takes what was typed; returns what the printer says, or null when there was nothing to print.
    ask(text) {
      const r = parsePrint(text, p);
      if (!r) return null;
      p = r.p; mine = true; done = false; start = clock;
      load();
      store.set(KEY, JSON.stringify(p));
      return r.said;
    },
    tick(dt, cam) {
      clock += dt;
      const k = progress();
      if (mine && k >= 1) done = true;
      const printing = k < 1, layer = Math.min(LAYERS, Math.floor(k * LAYERS));
      mesh.geometry.setDrawRange(0, printing ? build.bottom + build.perLayer * layer : Infinity);
      if (cam.distanceToSquared(bedTop) > 144) return;
      // The nozzle follows this layer's outline; when nothing is printing the head parks and the bed comes home.
      if (printing) {
        const n = nozzleAt(build, p, Math.min(LAYERS, layer + 1), k * LAYERS - layer);
        target.head.set(0, n.y + 0.037 + bedTop.y - headRest.y, n.z);
        target.bed.set(-n.x, 0, 0);
      } else {
        target.head.set(0, 0, 0);
        target.bed.set(0, 0, 0);
      }
      target.gantry.set(0, target.head.y, 0);
      const f = Math.min(1, dt * (printing ? 25 : 4));
      for (const [name, o] of Object.entries(parts)) {
        if (!o) continue;
        o.position.lerp(at.copy(home[name]).add(target[name]), f);
      }
      mesh.position.set(bedTop.x + (parts.bed ? parts.bed.position.x - home.bed.x : 0), bedTop.y, bedTop.z);
    },
  };
}
