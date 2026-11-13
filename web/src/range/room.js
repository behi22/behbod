import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { b2t } from '../engine.js';
import { U, lit, makeDetail } from './lit.js';

// The range's rooms. Unlike the house, whose zones are baked pictures, these are real materials: each surface's own
// colour and finish, lit by a lightmap that holds the light alone, with the room reflected in the floor and the
// steel. They are fetched after the house and drawn as a scene of their own.
const GLOW = { E_range_white: [0.82, 0.9, 1.0, 3.2], E_range_panel: [1.0, 0.93, 0.84, 2.4], E_teal: [0.1, 0.9, 0.8, 3.0], E_onair: [1.0, 0.1, 0.07, 3.0], E_warm: [1.0, 0.62, 0.3, 2.6] };
// The detail each surface wears and how deep its bumps are.
const SURFACE = { r_floor: ['floor', 0.05], r_wall: ['mottle', 0.15], r_panel: ['mottle', 0.3], r_steel: ['brushed', 0.25], r_dark: ['mottle', 0.1],
  r_rubber: ['mottle', 0.5], r_yellow: ['mottle', 0.2], r_bench: ['brushed', 0.3], r_line: ['mottle', 0.2], r_crate: ['mottle', 0.3] };
const BOARD = [1024, 602];

// The rooms are made ready while the visitor is walking about the house, so the work is done a piece at a time with
// a breath between the pieces: a frame or two gets drawn, and nothing is felt.
export const breathe = () => new Promise(done => setTimeout(done, 30));

// Builds a scene's shaders ahead of its first frame. The graphics card needs a different program for drawing
// straight to the screen (the lowest quality) than for drawing into a picture (every other quality, and the look
// around the room), and three decides which by what is being drawn into at the moment it is asked. So it is asked
// twice, once with each in place; the building itself goes on off the frame.
let linear = null;
export async function prepare(renderer, scene, camera, { screen = true, picture = true } = {}) {
  // One kind at a time, each waited for: three only watches the programs it was last asked for.
  for (const target of [picture ? (linear ||= new THREE.WebGLRenderTarget(1, 1)) : undefined, screen ? null : undefined]) {
    if (target === undefined) continue;
    const was = renderer.getRenderTarget();
    let job = null;
    // The target is in place only while three decides what to build, and is put back whatever happens.
    try { renderer.setRenderTarget(target); if (renderer.compileAsync) job = renderer.compileAsync(scene, camera); else renderer.compile(scene, camera); }
    finally { renderer.setRenderTarget(was); }
    await job;
  }
}

async function picture(url, small) {
  // Decoded off the main thread where the browser can, so a big lightmap never stalls a frame. `small` halves it
  // each way: a quarter of the memory, for phones.
  if (typeof createImageBitmap === 'function') {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`could not load ${url} (${res.status})`);
    const blob = await res.blob();
    // A browser that cannot resize while decoding gets the picture whole.
    if (small) { try { return new THREE.Texture(await createImageBitmap(blob, { resizeWidth: 2048, resizeHeight: 2048, resizeQuality: 'medium' })); } catch (e) { /* whole, below */ } }
    return new THREE.Texture(await createImageBitmap(blob));
  }
  return new THREE.TextureLoader().loadAsync(url);
}

export async function loadRangeRoom(meta, renderer, { small = false } = {}) {
  const zone = meta.zones.find(z => z.id === 'range');
  const [gltf, light] = await Promise.all([new GLTFLoader().loadAsync('assets/' + zone.glb), picture('assets/' + zone.light, small)]);
  light.flipY = false; light.colorSpace = THREE.SRGBColorSpace; light.channel = 1; light.anisotropy = 4; light.needsUpdate = true;
  await breathe();
  const detail = await makeDetail(small ? 128 : 256, breathe);
  await breathe();
  const scene = new THREE.Scene(), group = gltf.scene;
  scene.add(group);
  group.updateMatrixWorld(true);

  const surfaces = {}, glowing = {}, loose = [];
  const board = document.createElement('canvas');
  [board.width, board.height] = BOARD;
  const boardTex = new THREE.CanvasTexture(board);
  boardTex.colorSpace = THREE.SRGBColorSpace; boardTex.anisotropy = 4; boardTex.flipY = false;
  group.traverse(o => {
    if (!o.isMesh) return;
    const src = o.material;
    if (SURFACE[src.name]) {
      const [kind, bump] = SURFACE[src.name], d = detail[kind];
      surfaces[src.name] ||= lit(new THREE.MeshStandardMaterial({ name: src.name, color: src.color, roughness: src.roughness, metalness: src.metalness,
        map: d.map, roughnessMap: d.rough, normalMap: d.normal, normalScale: new THREE.Vector2(bump, bump), lightMap: light, lightMapIntensity: Math.PI }), true);
      o.material = surfaces[src.name];
    } else if (o.name.startsWith('rscreen_')) {
      o.material = new THREE.MeshBasicMaterial({ map: boardTex, fog: false });
    } else if (GLOW[src.name]) {
      (glowing[src.name] ||= []).push(o);
    } else {
      loose.push(o.name);
      o.material = lit(new THREE.MeshStandardMaterial({ color: src.color, roughness: src.roughness ?? 0.6, metalness: src.metalness ?? 0 }));
    }
  });
  if (loose.length) console.warn('[range] pieces without a baked surface:', loose.join(', '));
  // Every light of one colour is one mesh: a few draw calls for all the strips, rings and lamps.
  const glow = {};
  for (const [name, list] of Object.entries(glowing)) {
    const [r, g, b, k] = GLOW[name], base = new THREE.Color(r * k, g * k, b * k);
    const material = new THREE.MeshBasicMaterial({ color: base.clone(), fog: false });
    const geos = list.map(o => { const q = o.geometry.clone().applyMatrix4(o.matrixWorld); for (const a of Object.keys(q.attributes)) if (a !== 'position') q.deleteAttribute(a); return q; });
    const mesh = new THREE.Mesh(mergeGeometries(geos), material);
    mesh.name = 'glow_' + name;
    scene.add(mesh);
    for (const o of list) { o.parent.remove(o); o.geometry.dispose(); }
    for (const q of geos) q.dispose();
    glow[name] = { material, base };
  }
  scene.traverse(o => { o.updateMatrix(); o.matrixAutoUpdate = false; });
  scene.matrixWorldAutoUpdate = true;

  // The room as its own reflection: one look around from the middle of the hall, blurred into steps of roughness.
  // Without float pictures to draw into (some phones), plain ones do, and the reflections are only a little flatter.
  // (Taken from open floor short of the first cover: right behind a barrier, its lit yellow cap filled the picture
  // and every piece of steel came out gold.)
  const R = meta.range, eye = b2t(R.line[0], R.line[1] - 4.5, 2.4);
  if (R.box) {
    const a = b2t(...R.box[0]), b = b2t(...R.box[1]);
    U.boxMin.value.copy(a).min(b); U.boxMax.value.copy(a).max(b); U.probe.value.copy(eye);
  }
  const float = renderer.capabilities.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
  function reflect() {
    const target = new THREE.WebGLCubeRenderTarget(128, { type: float ? THREE.HalfFloatType : THREE.UnsignedByteType });
    const look = new THREE.CubeCamera(0.1, 120, target);
    look.position.copy(eye);
    const pmrem = new THREE.PMREMGenerator(renderer), was = scene.environment;
    scene.environment = null;
    U.tone.value = 0;
    look.update(renderer, scene);
    U.tone.value = 1;
    scene.environment = stage.environment = pmrem.fromCubemap(target.texture).texture;
    was?.dispose(); target.dispose(); pmrem.dispose();
    return scene.environment;
  }
  // What moves (targets, casings, sparks) is drawn as a second scene over the rooms, with lights of its own: the
  // rooms' light is baked, and a lamp in their scene would light them twice.
  const stage = new THREE.Scene();
  const sky = new THREE.HemisphereLight(0xcfe2ff, 0x14161c, 0.9), key = new THREE.DirectionalLight(0xdfeaff, 2.2);
  // From above and a little toward the firing line, so what faces the shooter is lit and what hangs under it is not.
  key.position.set(0.25, 1, -0.45);
  stage.add(sky, key, key.target);
  await breathe();
  // That look is drawn before the rooms have a reflection, with shaders of its own: built here, between frames, so
  // the look itself has nothing left to build.
  await prepare(renderer, scene, new THREE.PerspectiveCamera(90, 1, 0.1, 120), { screen: false });
  reflect();
  await breathe();

  let lightsK = 1;
  return {
    scene, stage, group, light, detail, surfaces, glow, eye,
    board: { canvas: board, texture: boardTex },
    get env() { return scene.environment; },
    // The hall's lights: 1 is on; toward 0 the baked light fades to a trace and the strips go out (the dark stage).
    setLights(k) {
      if (Math.abs(k - lightsK) < 1e-3) return;
      lightsK = k;
      for (const m of Object.values(surfaces)) m.lightMapIntensity = Math.PI * (0.035 + 0.965 * k);
      glow.E_range_white?.material.color.copy(glow.E_range_white.base).multiplyScalar(0.02 + 0.98 * k);
      sky.intensity = 0.9 * (0.04 + 0.96 * k); key.intensity = 2.2 * (0.02 + 0.98 * k);
    },
    get lights() { return lightsK; },
    // Builds every shader and sends every picture to the graphics card now, so the first look inside never stalls.
    async warmUp(camera) {
      // Hidden things too (a target waiting in its pool, a spent case): shown for the build, then hidden again.
      const hidden = [];
      stage.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } });
      try { for (const s of [scene, stage]) await prepare(renderer, s, camera); }
      finally { for (const o of hidden) o.visible = false; }
      const seen = new Set();
      for (const s of [scene, stage]) s.traverse(o => { for (const m of [].concat(o.material || [])) for (const v of Object.values(m)) if (v?.isTexture && !v.isRenderTargetTexture) seen.add(v); });
      for (const t of seen) { renderer.initTexture(t); await breathe(); }
    },
  };
}
