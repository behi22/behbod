import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { b2t } from '../engine.js';
import { U, lit, makeDetail } from './lit.js';
import { MOODS } from '../pure/moods.js';
import { inSlices } from '../pure/slices.js';
import { useAhead } from '../useahead.js';

// The range's rooms. Unlike the house, whose zones are baked pictures, these are real materials: each surface's own
// colour and finish, lit by a lightmap that holds the light alone, with the room reflected in the floor and the
// steel. They are fetched after the house and drawn as a scene of their own.
const GLOW = { E_range_white: [0.82, 0.9, 1.0, 3.2], E_range_panel: [1.0, 0.93, 0.84, 2.4], E_teal: [0.1, 0.9, 0.8, 3.0], E_onair: [1.0, 0.1, 0.07, 3.0], E_warm: [1.0, 0.62, 0.3, 2.6] };
// The detail each surface wears and how deep its bumps are.
const SURFACE = { r_floor: ['floor', 0.05], r_wall: ['mottle', 0.15], r_panel: ['mottle', 0.3], r_steel: ['brushed', 0.25], r_dark: ['mottle', 0.1],
  r_rubber: ['mottle', 0.5], r_yellow: ['mottle', 0.2], r_bench: ['brushed', 0.3], r_line: ['mottle', 0.2], r_crate: ['mottle', 0.3] };
const BOARD = [1024, 602];
// How far each glow dims with the lights out (the rest are lamps of their own), and which mood colour the hall's copy takes.
const DIM = { E_range_white: 0.02, E_range_panel: 0.05, E_teal: 0.3 }, TONE = { E_range_white: 'strip', E_teal: 'accent' };

// A glow that a band of light can run along, down the hall and away from the line (some stages' strips chase).
export function pulsing(material, P) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, P);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vRangeZ;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvRangeZ = (modelMatrix * vec4(transformed, 1.0)).z;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vRangeZ; uniform float uTime, uPulse, uSpeed;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n  float band = pow(0.5 + 0.5 * sin((vRangeZ - uTime * uSpeed) * 0.34), 6.0);\n  diffuseColor.rgb *= mix(1.0, 0.22 + 2.2 * band, uPulse);');
  };
  material.customProgramCacheKey = () => 'range-pulse';
  return material;
}

// The rooms are made ready while the visitor is walking about the house, so the work is done a piece at a time with
// a breath between the pieces: a frame or two gets drawn, and nothing is felt.
export const breathe = () => new Promise(done => setTimeout(done, 30));

// Builds a scene's shaders ahead of its first frame. The graphics card needs a different program for drawing
// straight to the screen (the lowest quality) than for drawing into a picture (every other quality, and the look
// around the room), and three decides which by what is being drawn into at the moment it is asked. So it is asked
// twice, once with each in place; the building itself goes on off the frame.
let linear = null;
// `into`: the scene a piece added later will be drawn in, whose lights its shaders are built for.
export async function prepare(renderer, scene, camera, { screen = true, picture = true, into = null } = {}) {
  // Asked a piece at a time, in slices of a frame's time: asking for a whole room at once held a slow phone for up to
  // a quarter of a second. One piece per material and kind of mesh (each kind needs its own program); the rest share.
  const pieces = [], seen = new Set(), lights = into || scene;
  scene.traverse(o => {
    for (const m of [].concat(o.material || [])) {
      const kind = `${m.uuid}|${!!o.isSkinnedMesh}|${!!o.isInstancedMesh}|${!!o.isBatchedMesh}|${!!o.morphTargetInfluences}|${!!o.isPoints}|${!!o.isLine}`;
      if (!seen.has(kind)) { seen.add(kind); pieces.push(o); }
    }
  });
  // One kind of target at a time, each waited for: three only watches the programs it was last asked for.
  for (const target of [picture ? (linear ||= new THREE.WebGLRenderTarget(1, 1)) : undefined, screen ? null : undefined]) {
    if (target === undefined) continue;
    const jobs = [];
    await inSlices(pieces, o => {
      const was = renderer.getRenderTarget();
      // The target is in place only while three decides what to build, and is put back whatever happens.
      try { renderer.setRenderTarget(target); if (renderer.compileAsync) jobs.push(renderer.compileAsync(o, camera, lights)); else renderer.compile(o, camera, lights); }
      finally { renderer.setRenderTarget(was); }
    }, { rest: breathe });
    await Promise.all(jobs);
  }
  const mats = new Set();
  for (const o of pieces) for (const m of [].concat(o.material || [])) mats.add(m);
  await useAhead(renderer, mats, { rest: breathe });
}

// three builds a reflection's two blur shaders the moment it first draws with them, which held a frame for up to a
// quarter of a second; here they are asked for first and left to build between frames. These are three's own inner
// names (three 0.170, pinned in index.html); if they ever change, this does nothing and the build happens as before.
async function readyBlur(renderer, pmrem, size) {
  if (typeof pmrem._setSize !== 'function' || typeof pmrem._allocateTargets !== 'function' || !renderer.compileAsync) return;
  pmrem._setSize(size);
  pmrem._allocateTargets().dispose();
  const group = new THREE.Group(), was = renderer.getRenderTarget();
  let job = null;
  // Built for drawing into a picture, as the blur does.
  try {
    renderer.setRenderTarget(linear ||= new THREE.WebGLRenderTarget(1, 1));
    pmrem.compileCubemapShader();
    for (const m of [pmrem._cubemapMaterial, pmrem._blurMaterial]) if (m && pmrem._lodPlanes?.[0]) group.add(new THREE.Mesh(pmrem._lodPlanes[0], m));
    job = renderer.compileAsync(group, new THREE.OrthographicCamera());
  } finally { renderer.setRenderTarget(was); }
  await job;
  await useAhead(renderer, [pmrem._cubemapMaterial, pmrem._blurMaterial].filter(Boolean), { rest: breathe });
}

async function picture(url, small) {
  // Decoded off the main thread where the browser can, so a big lightmap never stalls a frame. `small` halves it
  // each way: a quarter of the memory, for phones. A browser resizes on the page's own thread, so that is done in a
  // worker; if the worker cannot, it is done here as before.
  if (typeof createImageBitmap === 'function') {
    if (small) { const shrunk = await shrinkInWorker(url, 2048).catch(() => null); if (shrunk) return new THREE.Texture(shrunk); }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`could not load ${url} (${res.status})`);
    const blob = await res.blob();
    // A browser that cannot resize while decoding gets the picture whole.
    if (small) { try { return new THREE.Texture(await createImageBitmap(blob, { resizeWidth: 2048, resizeHeight: 2048, resizeQuality: 'medium' })); } catch (e) { /* whole, below */ } }
    return new THREE.Texture(await createImageBitmap(blob));
  }
  return new THREE.TextureLoader().loadAsync(url);
}
function shrinkInWorker(url, size) {
  if (typeof Worker !== 'function') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./pictureworker.js', import.meta.url), { type: 'module' });
    w.onmessage = ({ data }) => { w.terminate(); if (data.bitmap) resolve(data.bitmap); else reject(new Error(data.error)); };
    w.onerror = e => { w.terminate(); reject(e); };
    w.postMessage({ url: new URL(url, location.href).href, width: size, height: size });
  });
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
  // One mesh per colour per room, a few draw calls in all, so the hall's can take the stage's colours while the loadout room's stay.
  const R = meta.range, benchZ = -(R.line[1] - 0.3);
  U.hallZ.value.set(benchZ, benchZ + 1.7);
  const glow = {}, pulse = { uTime: { value: 0 }, uPulse: { value: 0 }, uSpeed: { value: 0 } };
  const centreZ = o => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).z;
  for (const [name, list] of Object.entries(glowing)) {
    const [r, g, b, k] = GLOW[name], base = new THREE.Color(r * k, g * k, b * k);
    for (const hall of [false, true]) {
      const part = list.filter(o => (centreZ(o) > benchZ) === hall);
      if (!part.length) continue;
      const material = new THREE.MeshBasicMaterial({ color: base.clone(), fog: false });
      if (hall) pulsing(material, pulse);
      const geos = part.map(o => { const q = o.geometry.clone().applyMatrix4(o.matrixWorld); for (const a of Object.keys(q.attributes)) if (a !== 'position') q.deleteAttribute(a); return q; });
      const mesh = new THREE.Mesh(mergeGeometries(geos), material);
      mesh.name = 'glow_' + name + (hall ? '_hall' : '');
      scene.add(mesh);
      for (const q of geos) q.dispose();
      glow[name + (hall ? '@hall' : '')] = { name, material, base, hall, k };
    }
    for (const o of list) { o.parent.remove(o); o.geometry.dispose(); }
  }
  scene.traverse(o => { o.updateMatrix(); o.matrixAutoUpdate = false; });
  scene.matrixWorldAutoUpdate = true;

  // The room as its own reflection: one look around from the middle of the hall, blurred into steps of roughness.
  // Without float pictures to draw into (some phones), plain ones do, and the reflections are only a little flatter.
  // (Taken from open floor short of the first cover: right behind a barrier, its lit yellow cap filled the picture
  // and every piece of steel came out gold.)
  const eye = b2t(R.line[0], R.line[1] - 4.5, 2.4);
  if (R.box) {
    const a = b2t(...R.box[0]), b = b2t(...R.box[1]);
    U.boxMin.value.copy(a).min(b); U.boxMax.value.copy(a).max(b); U.probe.value.copy(eye);
  }
  const float = renderer.capabilities.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
  const REFLECT_SIZE = 128;
  async function reflect() {
    const target = new THREE.WebGLCubeRenderTarget(REFLECT_SIZE, { type: float ? THREE.HalfFloatType : THREE.UnsignedByteType });
    const look = new THREE.CubeCamera(0.1, 120, target);
    look.position.copy(eye);
    const pmrem = new THREE.PMREMGenerator(renderer);
    await readyBlur(renderer, pmrem, REFLECT_SIZE);
    // Every picture the look draws goes to the graphics card first, one per breath, not all inside the look.
    const pictures = new Set();
    scene.traverse(o => { for (const m of [].concat(o.material || [])) for (const v of Object.values(m)) if (v?.isTexture && !v.isRenderTargetTexture) pictures.add(v); });
    await inSlices([...pictures], t => renderer.initTexture(t), { rest: breathe });
    const was = scene.environment;
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
  await reflect();
  await breathe();

  let lightsK = 1, mood = MOODS.warmup, dip = 1;
  const skyBase = sky.color.clone(), keyBase = key.color.clone(), c = new THREE.Color();
  function apply() {
    const k = lightsK, b = mood.bright * dip;
    for (const m of Object.values(surfaces)) m.lightMapIntensity = Math.PI * (0.035 + 0.965 * k);
    // The room's reflection is of the hall lit up, so it goes down with the lights; the teal strips stay as a faint guide.
    scene.environmentIntensity = stage.environmentIntensity = 0.03 + 0.97 * k;
    U.hallTint.value.setRGB(mood.tint[0] * b, mood.tint[1] * b, mood.tint[2] * b);
    U.haze.value.setRGB(...mood.haze); U.hazeK.value = mood.hazeK;
    for (const g of Object.values(glow)) {
      const tone = g.hall && TONE[g.name] ? mood[TONE[g.name]] : null;
      if (tone) g.material.color.setRGB(tone[0] * g.k, tone[1] * g.k, tone[2] * g.k); else g.material.color.copy(g.base);
      g.material.color.multiplyScalar((DIM[g.name] ?? 1) + (1 - (DIM[g.name] ?? 1)) * k).multiplyScalar(g.hall ? dip : 1);
    }
    // What moves in the hall takes a little of its colour, never its brightness: the targets are as easy to see in every mood.
    c.setRGB(0.7 + 0.3 * mood.tint[0], 0.7 + 0.3 * mood.tint[1], 0.7 + 0.3 * mood.tint[2]);
    sky.color.copy(skyBase).multiply(c); key.color.copy(keyBase).multiply(c);
    sky.intensity = 0.9 * (0.04 + 0.96 * k); key.intensity = 2.2 * (0.02 + 0.98 * k);
  }
  return {
    scene, stage, group, light, detail, surfaces, glow, eye, pulse,
    board: { canvas: board, texture: boardTex },
    get env() { return scene.environment; },
    // The hall's lights: 1 is on; toward 0 the baked light fades to a trace and the strips go out (the dark stage).
    setLights(k) {
      if (Math.abs(k - lightsK) < 1e-3) return;
      lightsK = k;
      apply();
    },
    // The stage's look in the hall (see pure/moods.js), and how far its lights have dipped while it changes.
    setMood(m, d = 1) {
      if (m === mood && d === dip) return;
      mood = m; dip = d;
      apply();
    },
    get mood() { return mood; },
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
