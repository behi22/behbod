import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer, RenderPass, EffectPass, Effect, BloomEffect, SMAAEffect, VignetteEffect, NoiseEffect, BlendFunction } from 'postprocessing';
import { makeCanvases } from './screens.js';
import { Sound } from './sound.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { weatherNow, BRIDGE } from './room2.js';

const $ = id => document.getElementById(id);
const canvas = $('view');
const coarse = matchMedia('(pointer: coarse)').matches;
const params = new URLSearchParams(location.search);

// Blender is Z-up with the room's "north" at +Y; glTF/three is Y-up, so Blender (x, y, z) lands at (x, z, -y).
const b2t = (x, y, z) => new THREE.Vector3(x, z, -y);

// Phones skip post effects, so they get cheap hardware antialiasing instead.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: coarse, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.info.autoReset = false;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0f1c);
scene.fog = new THREE.FogExp2(0x0a0f1c, 0.05);
const camera = new THREE.PerspectiveCamera(coarse ? 60 : 55, 1, 0.05, 120);

// ---------- quality tiers ----------
const TIERS = {
  low: { ratio: 1, post: false, bloom: false },
  medium: { ratio: 1.25, post: true, bloom: true },
  high: { ratio: 2, post: true, bloom: true, smaa: true, grain: true },
};
let tierName = params.get('q') || 'auto', tier = TIERS.medium, autoTier = tierName === 'auto';
let composer = null;
// The mosaic that hides the toy head moves the image's UVs, so it needs its own pass ahead of the others.
const mosaicU = { centre: new THREE.Uniform(new THREE.Vector2()), drift: new THREE.Uniform(new THREE.Vector2()), radius: new THREE.Uniform(0), cells: new THREE.Uniform(40), aspect: new THREE.Uniform(1) };
const MOSAIC_FS = `uniform vec2 centre, drift; uniform float radius, cells, aspect;
  void mainUv(inout vec2 uv) {
    vec2 d = (uv - centre) * vec2(aspect, 1.0);
    if (radius > 0.0 && length(d / vec2(0.8, 1.0)) < radius) {
      vec2 cell = vec2(cells * aspect, cells), off = drift / cell;
      uv = (floor((uv + off) * cell) + 0.5) / cell - off;
    }
  }`;
function buildPost() {
  composer?.dispose();
  composer = null;
  if (!tier.post) return;
  composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new EffectPass(camera, new Effect('Mosaic', MOSAIC_FS, { uniforms: new Map(Object.entries(mosaicU)) })));
  const fx = [];
  if (tier.bloom) fx.push(new BloomEffect({ luminanceThreshold: 0.82, luminanceSmoothing: 0.25, intensity: 1.15, mipmapBlur: true, radius: 0.72 }));
  fx.push(new VignetteEffect({ offset: 0.32, darkness: 0.55 }));
  if (tier.grain) { const n = new NoiseEffect({ blendFunction: BlendFunction.SOFT_LIGHT, premultiply: true }); n.blendMode.opacity.value = 0.35; fx.push(n); }
  if (tier.smaa) fx.push(new SMAAEffect());
  composer.addPass(new EffectPass(camera, ...fx));
  resize();
}
function setTier(name) {
  tier = TIERS[name];
  setGloss?.(name === 'high');
  renderer.setPixelRatio(Math.min(devicePixelRatio, tier.ratio));
  buildPost();
  $('q').textContent = 'Quality: ' + (autoTier ? 'auto, ' : '') + name;
}
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer?.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ---------- loading ----------
const loader = new GLTFLoader();
const progress = {};
const showProgress = () => { const v = Object.values(progress); $('bar').style.width = (v.reduce((a, b) => a + b, 0) / 3 * 100).toFixed(0) + '%'; };
// The published page can't serve .glb files, so there the models ship as base64 text beside the page.
const B64 = !!window.__ASSET_B64;
async function load(url, key) {
  const res = await fetch(B64 ? url + '.txt' : url);
  if (!res.ok) throw new Error(`could not load ${url} (${res.status})`);
  const total = +res.headers.get('content-length') || 0, chunks = [];
  let got = 0;
  for (const reader = res.body.getReader(); ;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
    if (total) { progress[key] = got / total; showProgress(); }
  }
  progress[key] = 1; showProgress();
  let bytes = new Uint8Array(got);
  for (let o = 0, i = 0; i < chunks.length; o += chunks[i].length, i++) bytes.set(chunks[i], o);
  if (B64) {
    const bin = atob(new TextDecoder().decode(bytes));
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  }
  return new Promise((ok, fail) => loader.parse(bytes.buffer, '', ok, fail));
}
const [roomGltf, meGltf, meta] = await Promise.all([
  load('assets/room.glb', 'room'), load('assets/behbod_v3.glb', 'me'),
  fetch('assets/room.json').then(r => r.json()).finally(() => { progress.meta = 1; showProgress(); }),
]);

// ---------- the room ----------
const room = roomGltf.scene;
scene.add(room);
const screens = makeCanvases(meta);
const EMISSIVE = { E_purple: [0.55, 0.15, 1.0, 3.2], E_teal: [0.1, 0.9, 0.8, 3.0], E_warm: [1.0, 0.62, 0.3, 2.6], E_onair: [1.0, 0.1, 0.07, 3.0],
  E_led_green: [0.25, 1.0, 0.45, 3.5], E_led_blue: [0.25, 0.55, 1.0, 3.5], E_aria_eye: [0.25, 1.0, 0.85, 3.2], E_warm_soft: [1.0, 0.75, 0.45, 2.4], E_bias: [0.35, 0.45, 1.0, 2.6] };
const emits = {};
let lava = null;
const PRINTS = new Set(['art1', 'art2', 'proj1', 'proj2']);
const leds = [], clockHands = {}, aria = {};
room.traverse(o => {
  if (!o.isMesh) return;
  const m = o.material, name = o.name;
  if (name === 'room_baked') {
    o.material = new THREE.MeshBasicMaterial({ map: m.map, fog: true });
    o.material.map.anisotropy = 4;
  } else if (name === 'lava_glass') {
    lava = o;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    o.material = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, y0: { value: bb.min.y }, h: { value: bb.max.y - bb.min.y } },
      vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      // Slow rising and sinking wax blobs inside the glass.
      fragmentShader: `uniform float time, y0, h; varying vec3 vP;
        void main() {
          float v = (vP.y - y0) / h, u = atan(vP.z, vP.x) / 6.2832;
          float f = 0.0;
          for (int i = 0; i < 6; i++) {
            float fi = float(i);
            float cy = 0.5 + 0.42 * sin(time * (0.11 + fi * 0.03) + fi * 1.7);
            float cu = fract(fi * 0.37 + time * 0.01);
            vec2 d = vec2(min(abs(u - cu), 1.0 - abs(u - cu)) * 1.6, v - cy);
            f += 0.012 / (dot(d, d) + 0.004);
          }
          vec3 liquid = vec3(0.35, 0.05, 0.12), wax = vec3(2.2, 0.75, 0.25);
          gl_FragColor = vec4(mix(liquid, wax, smoothstep(0.9, 1.4, f)), 1.0);
        }`,
    });
  } else if (name.startsWith('screen_') || name === 'backdrop' || name === 'postit' || name === 'onair' || name === 'desk_mat' || name === 'neon') {
    const key = name === 'desk_mat' ? 'mat' : name.replace('screen_', '');
    const tex = screens.textures[key];
    const k = name === 'postit' ? 0.95 : name === 'backdrop' ? 1 : name === 'desk_mat' ? 0.62 : name === 'neon' ? 1.7 : PRINTS.has(key) ? 0.8 : 1.25;
    o.material = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(k, k, k), fog: name === 'backdrop' ? false : true });
    if (name === 'onair') o.material.color.setScalar(2.2);
  } else if (m.name?.startsWith('G_')) {
    o.material = new THREE.MeshBasicMaterial({ color: 0x9fb6d8, transparent: true, opacity: name === 'window_glass' ? 0.06 : 0.12, depthWrite: false, fog: true });
    o.renderOrder = 2;
  } else if (EMISSIVE[m.name]) {
    const [r, g, b, k] = EMISSIVE[m.name];
    o.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(r * k, g * k, b * k), fog: true });
    (emits[m.name] ||= []).push(o.material);
    if (name.startsWith('led_')) leds.push(o);
    if (name.startsWith('aria_eye')) (aria.eyes ||= []).push(o);
    if (name === 'aria_tip') aria.tip = o;
  } else if (name.startsWith('clock_')) {
    o.material = new THREE.MeshBasicMaterial({ color: 0x0a0a0c });
    clockHands[name] = o;
  } else {
    o.material = new THREE.MeshBasicMaterial({ color: (m.color || new THREE.Color(0.2, 0.2, 0.2)).clone().multiplyScalar(0.35), fog: true });
  }
});

// Lights only touch the character; the room's light is baked.
scene.add(new THREE.HemisphereLight(0x6d82c2, 0x2a1a12, 1.1));
const keyL = new THREE.DirectionalLight(0x9db2ff, 1.1);
keyL.position.copy(b2t(0, 6, 3));
scene.add(keyL);
const mon = new THREE.PointLight(0xc4d4ff, 3.2, 4, 2);
mon.position.copy(b2t(2.9, 0.62, 1.15));
const rgb = new THREE.PointLight(0x8a45ff, 2.2, 3.2, 2);
rgb.position.copy(b2t(2.6, 0.6, 0.45));
const pend = new THREE.PointLight(0xffc48a, 2.4, 4.5, 2);
pend.position.copy(b2t(2.3, 0.62, 2.6));
const lamp = new THREE.PointLight(0xffa25e, 3.0, 5, 2);
lamp.position.copy(b2t(0.4, -3.8, 1.05));
scene.add(mon, rgb, pend, lamp);
// Holidays from the README's calendar recolour the room's RGB strips.
if (screens.holiday) {
  const tintEmit = (name, hex, k) => (emits[name] || []).forEach(m => m.color.set(hex).multiplyScalar(k));
  tintEmit('E_purple', screens.holiday.c.hot, 3.0); tintEmit('E_teal', screens.holiday.c.a2, 2.6);
  rgb.color.set(screens.holiday.c.hot);
}

// ---------- outside: traffic on the bridge, rain on the glass, snow, from Vancouver's real weather ----------
// The backdrop is a 60 by 22 plane, 24 m out; canvas pixels map onto it so the cars follow the painted bridge.
const onBackdrop = (cx, cy) => new THREE.Vector3(-30 + 60 * cx / BRIDGE.canvasW, 17 - 22 * cy / BRIDGE.canvasH, -23.9);
const CARS = 44, carPos = new Float32Array(CARS * 3), carCol = new Float32Array(CARS * 3), cars = [];
for (let i = 0; i < CARS; i++) {
  const dir = i % 2 ? 1 : -1;
  cars.push({ u: Math.random(), dir, v: 0.025 + Math.random() * 0.02 });
  carCol.set(dir > 0 ? [1.6, 1.45, 1.1] : [1.6, 0.15, 0.1], i * 3);
}
const carGeo = new THREE.BufferGeometry();
carGeo.setAttribute('position', new THREE.BufferAttribute(carPos, 3));
carGeo.setAttribute('color', new THREE.BufferAttribute(carCol, 3));
const traffic = new THREE.Points(carGeo, new THREE.PointsMaterial({ size: 0.11, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
scene.add(traffic);
function tickTraffic(dt) {
  for (let i = 0; i < CARS; i++) {
    const c = cars[i];
    c.u = (c.u + c.dir * c.v * dt + 1) % 1;
    const cx = BRIDGE.x0 + c.u * (BRIDGE.x1 - BRIDGE.x0), cy = BRIDGE.y - Math.sin(c.u * Math.PI) * BRIDGE.sag - (c.dir > 0 ? 2.5 : 0.5);
    const p = onBackdrop(cx, cy);
    carPos[i * 3] = p.x; carPos[i * 3 + 1] = p.y; carPos[i * 3 + 2] = p.z;
  }
  carGeo.attributes.position.needsUpdate = true;
  traffic.material.opacity = screens.outside.dark ? 1 : 0.35;
}
let rain = null, snow = null, weather = 'clear';
weatherNow().then(w => {
  weather = w;
  screens.outside.weather = w;
  screens.outside.draw(new Date());
  if (w === 'rain') {
    // Streaks running down the inside of the window glass.
    rain = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.6), new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float time; varying vec2 vUv;
        float h(float n) { return fract(sin(n * 91.7) * 43758.5); }
        void main() {
          float col = floor(vUv.x * 140.0), r = h(col);
          float y = fract(vUv.y + time * (0.25 + r * 0.5) + r * 7.0);
          float streak = smoothstep(0.0, 0.02, y) * (1.0 - smoothstep(0.02, 0.12 + r * 0.15, y)) * step(0.55, r);
          float edge = 1.0 - abs(fract(vUv.x * 140.0) - 0.5) * 2.0;
          gl_FragColor = vec4(vec3(0.55, 0.62, 0.75) * streak * smoothstep(0.4, 1.0, edge) * 0.22, 1.0);
        }`,
    }));
    rain.position.copy(b2t(-0.6, 2.96, 1.7));
    scene.add(rain);
  } else if (w === 'snow') {
    const N = 900, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) pos.set([-4 + Math.random() * 7.5, Math.random() * 5, -3.3 - Math.random() * 10], i * 3);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    snow = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.035, color: 0xe8eefc, transparent: true, opacity: 0.85, depthWrite: false }));
    scene.add(snow);
  }
});
function tickWeather(dt, t) {
  if (rain) rain.material.uniforms.time.value = t;
  if (snow) {
    const a = snow.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) { let y = a.getY(i) - dt * (0.35 + (i % 7) * 0.04); if (y < 0) y += 5; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(t * 0.8 + i) * dt * 0.05); }
    a.needsUpdate = true;
  }
}
// Small, subtle reflections: the studio floor mirrors only the bright things (screens, LEDs, lamps), softly.
let floorGloss = null;
function setGloss(on) {
  if (!on) { if (floorGloss) { scene.remove(floorGloss); floorGloss.dispose(); floorGloss = null; } return; }
  if (floorGloss) return;
  floorGloss = new Reflector(new THREE.PlaneGeometry(7.1, 4.5), {
    textureWidth: Math.round(innerWidth * 0.35), textureHeight: Math.round(innerHeight * 0.35), clipBias: 0.003, color: 0xffffff,
    shader: {
      name: 'FloorGloss', uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } },
      vertexShader: Reflector.ReflectorShader.vertexShader,
      fragmentShader: `uniform vec3 color; uniform sampler2D tDiffuse; varying vec4 vUv;
        void main() { vec4 base = texture2DProj(tDiffuse, vUv); gl_FragColor = vec4(max(base.rgb - 0.6, 0.0) * 0.4 * color, 1.0); }`,
    },
  });
  floorGloss.material.transparent = true;
  floorGloss.material.blending = THREE.AdditiveBlending;
  floorGloss.material.depthWrite = false;
  floorGloss.rotation.x = -Math.PI / 2;
  floorGloss.position.set(-0.05, 0.004, -0.75);
  scene.add(floorGloss);
}
// Steam rising from the tea, and the PC's lights pulse harder while I'm at the computer.
const TEA = b2t(2.82, -0.2, 0.84), STEAM = 16;
const steamPos = new Float32Array(STEAM * 3), steamAge = Float32Array.from({ length: STEAM }, (_, i) => i / STEAM);
const steamGeo = new THREE.BufferGeometry();
steamGeo.setAttribute('position', new THREE.BufferAttribute(steamPos, 3));
const steam = new THREE.Points(steamGeo, new THREE.PointsMaterial({ size: 0.035, color: 0x9aa4b4, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
scene.add(steam);
function tickSteam(dt, t) {
  for (let i = 0; i < STEAM; i++) {
    steamAge[i] = (steamAge[i] + dt * 0.35) % 1;
    const a = steamAge[i];
    steamPos.set([TEA.x + Math.sin(t * 1.3 + i) * 0.012 * a, TEA.y + a * 0.17, TEA.z + Math.cos(t * 1.1 + i * 2) * 0.012 * a], i * 3);
  }
  steamGeo.attributes.position.needsUpdate = true;
}
const pcGlow = [];
room.traverse(o => { if (o.isMesh && /^(fan\d|coolant_tube|cpu_block|gpu\d_led|ram\d_led)$/.test(o.name)) pcGlow.push([o.material, o.material.color.clone()]); });
function tickPC(t, busy) {
  const k = busy ? 1.35 + 0.35 * Math.sin(t * 6) : 1;
  for (const [m, base] of pcGlow) m.color.copy(base).multiplyScalar(k);
}

// ---------- me ----------
// Character v3: the designer-toy me. One model holds every head and accessory; the page shows one look at a time.
const me = meGltf.scene;
const parts = {}, mats = {}, bones = {};
me.traverse(o => {
  if (o.isMesh) { o.frustumCulled = false; [].concat(o.material).forEach(m => { m.envMapIntensity = 0.4; (mats[m.name] ||= []).push(m); }); }
  if (o.isBone) bones[o.name] = o;
  if (o.name) (parts[o.name] ||= []).push(o);
});
scene.add(me);
const HEADS = { hood: ['V3_head_void'], tv: ['V3_head_tv'], visor: ['V3_head_helmet', 'V3_head_visor', 'V3_head_visor_face'], emoji: ['V3_head_emoji'], mosaic: ['V3_head_toy'] };
const HOOD_UP = { hood: true, tv: false, visor: false, emoji: false, mosaic: true };
const HEAD_NAMES = { hood: 'Head: hood', tv: 'Head: TV', visor: 'Head: visor', emoji: 'Head: emoji', mosaic: 'Head: the real you' };
let head = 'hood', mosaicUnlocked = params.has('mosaic');
// A head with several materials loads as a group whose parts carry their own names, so switch the whole subtree.
const show = (n, on) => (parts[n] || []).forEach(o => o.traverse(c => { c.visible = on; }));
function dress() {
  for (const n of Object.keys(parts)) if (n.startsWith('V3_head_') || n.startsWith('V3_acc_') || /_(short|relaxed|tapered)$/.test(n)) show(n, false);
  for (const n of HEADS[head]) show(n, true);
  show('V3_hood_up', HOOD_UP[head]);
  show('V3_hood_down', !HOOD_UP[head]);
  $('who').textContent = HEAD_NAMES[head];
}
// His saved look: navy hoodie, black cargos, white high-tops.
const tint = (names, hex, k = 1) => names.forEach(n => (mats[n] || []).forEach(m => { m.color.set(hex).multiplyScalar(k); if (m.sheen > 0) { m.sheen = 0.25; m.sheenRoughness = 0.85; m.sheenColor.copy(m.color); } }));
tint(['M_Hoodie'], '#1f2a44'); tint(['M_Hoodie_Rib'], '#1f2a44', 0.9); tint(['M_Pants'], '#141518'); tint(['M_Pants_Pocket'], '#141518', 0.85); tint(['M_Shoe'], '#eceae4');
const faces = {};
for (const [key, mat] of [['tv', 'M_TV_Screen'], ['emoji', 'M_Emoji_Screen']]) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false;
  faces[key] = { g: c.getContext('2d'), t, last: -1 };
  (mats[mat] || []).forEach(m => { m.emissiveMap = t; m.emissive.set(0xffffff); m.emissiveIntensity = 1.4; m.color.set(0x000000); });
}
function drawFace(now) {
  const f = faces[head];
  if (!f) return;
  const frame = Math.floor(now / 120);
  if (frame === f.last) return;
  f.last = frame;
  const g = f.g, blink = (now % 4200) < 140, beat = Math.floor(now / 2600) % 4;
  if (head === 'tv') {
    g.fillStyle = '#041714'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#3ee6c4';
    const eh = blink ? 4 : 34;
    g.fillRect(70, 96 - eh / 2, 26, eh); g.fillRect(160, 96 - eh / 2, 26, eh);
    if (beat === 2) g.fillRect(84, 168, 88, 12); else { g.fillRect(74, 156, 16, 12); g.fillRect(90, 168, 76, 12); g.fillRect(166, 156, 16, 12); }
    g.fillStyle = 'rgba(0,0,0,.28)'; for (let y = 0; y < 256; y += 4) g.fillRect(0, y, 256, 2);
  } else {
    g.fillStyle = '#0d1117'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#ffd34d'; g.lineWidth = 16; g.lineCap = 'round'; g.beginPath();
    if (beat === 1) { g.moveTo(70, 104); g.lineTo(108, 104); } else { g.moveTo(70, 112); g.quadraticCurveTo(89, 84, 108, 112); }
    if (blink) { g.moveTo(148, 104); g.lineTo(186, 104); } else { g.moveTo(148, 112); g.quadraticCurveTo(167, 84, 186, 112); }
    g.moveTo(80, 160); g.quadraticCurveTo(128, beat === 3 ? 176 : 206, 176, 160); g.stroke();
  }
  f.t.needsUpdate = true;
}
function nextHead() {
  const order = ['hood', 'tv', 'visor', 'emoji'].concat(mosaicUnlocked ? ['mosaic'] : []);
  head = order[(order.indexOf(head) + 1) % order.length];
  dress();
}
dress();
addEventListener('loft:cmd', e => {
  if (e.detail.cmd !== 'whoami' || mosaicUnlocked) return;
  mosaicUnlocked = true;
  e.detail.say('achievement unlocked: the real you.', "press H (or the head button) to wear it.");
  toast('Achievement unlocked: the real you');
});
function toast(text) {
  const t = $('toast'); if (!t) return;
  t.textContent = text; t.classList.add('on');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 3600);
}

// ---------- moves: a blended locomotion layer plus one-shots on top ----------
const mixer = new THREE.AnimationMixer(me);
const acts = {};
for (const c of meGltf.animations) { acts[c.name] = mixer.clipAction(c); acts[c.name].play(); acts[c.name].setEffectiveWeight(0); }
for (const n of ['Jump_Start', 'Jump_Land', 'Sitting_Enter', 'Sitting_Exit', 'Interact', 'Roll']) if (acts[n]) { acts[n].setLoop(THREE.LoopOnce, 1); acts[n].clampWhenFinished = true; }
// Walk, jog and sprint share one stride phase so the feet never skip when the blend changes.
const LOCO = [['Idle_Loop', 0], ['Walk_Loop', 1.6], ['Jog_Fwd_Loop', 3.4], ['Sprint_Loop', 5.6]];
const CROUCH = [['Crouch_Idle_Loop', 0], ['Crouch_Fwd_Loop', 1.2]];
const STRIDE = { Walk_Loop: 1.6, Jog_Fwd_Loop: 3.4, Sprint_Loop: 5.6, Crouch_Fwd_Loop: 1.2 };
for (const [n] of [...LOCO, ...CROUCH]) if (STRIDE[n] && acts[n]) acts[n].timeScale = 0;
const weight = new Map(Object.values(acts).map(a => [a, 0]));
let phase = 0, layer = 1, oneShot = null, oneShotEnd = 0, crouchK = 0;
function blendWeights(set, speed) {
  const out = new Map();
  for (let i = 0; i < set.length; i++) {
    const [n, s] = set[i], prev = set[i - 1], next = set[i + 1];
    let w = 0;
    if (speed <= s && prev) w = Math.max(0, (speed - prev[1]) / (s - prev[1]));
    else if (speed >= s && next) w = Math.max(0, (next[1] - speed) / (next[1] - s));
    else if ((speed <= s && !prev) || (speed >= s && !next)) w = 1;
    out.set(n, w);
  }
  return out;
}
function playOnce(name, hold = false) {
  const a = acts[name];
  if (!a) return;
  a.reset().play();
  oneShot = a;
  oneShotEnd = hold ? Infinity : performance.now() + a.getClip().duration * 1000 / a.timeScale - 120;
}
function holdPose(name) { const a = acts[name]; if (!a || oneShot === a) return; a.reset().play(); oneShot = a; oneShotEnd = Infinity; }
function endOneShot() { oneShot = null; }
function animate(dt, speed, crouching) {
  const now = performance.now();
  if (oneShot && now > oneShotEnd) oneShot = null;
  layer += ((oneShot ? 0 : 1) - layer) * Math.min(1, dt * 9);
  crouchK += ((crouching ? 1 : 0) - crouchK) * Math.min(1, dt * 8);
  phase += dt * speed / (speed > 4.5 ? 2.9 : speed > 2.6 ? 2.3 : 1.45);
  const stand = blendWeights(LOCO, speed), low = blendWeights(CROUCH, Math.min(speed, 1.2));
  const target = new Map();
  for (const [n, w] of stand) target.set(acts[n], w * layer * (1 - crouchK));
  for (const [n, w] of low) target.set(acts[n], w * layer * crouchK);
  if (oneShot) target.set(oneShot, (target.get(oneShot) || 0) + (1 - layer));
  for (const [a, w] of weight) {
    const goal = target.get(a) || 0;
    const v = a === oneShot ? Math.max(goal, 1 - layer) : w + (goal - w) * Math.min(1, dt * 12);
    weight.set(a, v);
    a.setEffectiveWeight(v);
    if (STRIDE[a.getClip().name]) a.time = (phase % 1) * a.getClip().duration;
  }
  mixer.update(dt);
}
const blob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), new THREE.MeshBasicMaterial({ map: radialShadow(), transparent: true, depthWrite: false, opacity: 0.75 }));
blob.rotation.x = -Math.PI / 2;
blob.renderOrder = 1;
scene.add(blob);
function radialShadow() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// ---------- world collision ----------
const floors = meta.floors.map(f => ({ x0: f.min[0], x1: f.max[0], z0: -f.max[1], z1: -f.min[1], y: f.z }));
const boxes = meta.colliders.map(c => ({ name: c.name, x0: c.min[0], x1: c.max[0], z0: -c.max[1], z1: -c.min[1], y0: c.min[2], y1: c.max[2] }));
const R = 0.27, STEP = 0.32;
function groundAt(x, z, feet) {
  let g = -10;
  for (const f of floors) if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1 && f.y <= feet + STEP && f.y > g) g = f.y;
  for (const b of boxes) if (b.y1 < 3 && x >= b.x0 - 0.05 && x <= b.x1 + 0.05 && z >= b.z0 - 0.05 && z <= b.z1 + 0.05 && b.y1 <= feet + 0.05 && b.y1 > g) g = b.y1;
  return g;
}
function pushOut(p, feet) {
  for (const b of boxes) {
    if (b.y1 <= feet + 0.05 || b.y0 >= feet + 1.7) continue;
    const cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1));
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < R * R) {
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (R - d) / d; p.x += dx * k; p.z += dz * k; }
      else { const ex = [p.x - b.x0, b.x1 - p.x, p.z - b.z0, b.z1 - p.z], i = ex.indexOf(Math.min(...ex)); if (i === 0) p.x = b.x0 - R; else if (i === 1) p.x = b.x1 + R; else if (i === 2) p.z = b.z0 - R; else p.z = b.z1 + R; }
    }
  }
}
// Rapier's character controller (a capsule that slides along walls and climbs steps). If it cannot load,
// the box collision above keeps working exactly as before.
let phys = null, physName = 'boxes';
try {
  const RAPIER = (await import('https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.14.0/+esm')).default;
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const cub = (x0, x1, y0, y1, z0, z1) => world.createCollider(RAPIER.ColliderDesc.cuboid((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2).setTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
  for (const f of floors) cub(f.x0, f.x1, f.y - 0.5, f.y, f.z0, f.z1);
  for (const b of boxes) cub(b.x0, b.x1, Math.max(b.y0, -1.5), b.y1, b.z0, b.z1);
  const HH = 0.5, RAD = R;
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
  const col = world.createCollider(RAPIER.ColliderDesc.capsule(HH, RAD).setTranslation(0, HH + RAD + 0.02, 0), body);
  const ctl = world.createCharacterController(0.02);
  ctl.enableAutostep(0.2, 0.1, false);
  ctl.enableSnapToGround(0.2);
  ctl.setMaxSlopeClimbAngle(50 * Math.PI / 180);
  ctl.setSlideEnabled(true);
  phys = {
    place(p) { body.setTranslation({ x: p.x, y: p.y, z: p.z }, true); world.step(); },
    move(p, d) {
      ctl.computeColliderMovement(col, d);
      const m = ctl.computedMovement(), t = body.translation();
      const n = { x: t.x + m.x, y: t.y + m.y, z: t.z + m.z };
      body.setNextKinematicTranslation(n);
      world.step();
      p.set(n.x, n.y, n.z);
      return ctl.computedGrounded();
    },
  };
  physName = 'rapier';
} catch (e) { console.warn('[loft] physics: Rapier unavailable, using box collision.', e.message); }

// ---------- input ----------
const keys = new Set();
let crouchHeld = false, lastCrouchTap = 0, rollT = 0, showStats = params.has('stats');
addEventListener('keydown', e => {
  if (e.target && e.target.id === 'cmd') return;
  if (mode === 'desk') { if (e.key.length === 1 || e.key === 'Enter') sound.key(); return screens.terminalKey(e, () => leaveDesk()); }
  if (!e.repeat && e.code === 'KeyC' && mode === 'walk') {
    const now = performance.now();
    // Double tap C to roll; hold it to crouch. (Ctrl is avoided on purpose: Ctrl+W closes the tab.)
    if (now - lastCrouchTap < 300 && grounded && rollT <= 0) { rollT = 0.85; playOnce('Roll'); }
    lastCrouchTap = now;
  }
  keys.add(e.code);
  if (e.code === 'KeyE' && nearDesk) useDesk();
  if (e.code === 'KeyH' && mode === 'walk') nextHead();
  if (e.code === 'Backquote') { showStats = !showStats; $('stats').style.display = showStats ? 'block' : 'none'; }
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
let yaw = -Math.PI / 2 - 0.35, pitch = 0.3, dist = coarse ? 4.3 : 3.3, dragging = null, lastLook = 0;
canvas.addEventListener('pointerdown', e => { dragging = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: 0 }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  if (!dragging || e.pointerId !== dragging.id) return;
  const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
  dragging.x = e.clientX; dragging.y = e.clientY; dragging.moved += Math.abs(dx) + Math.abs(dy);
  if (mode === 'desk' && desk.range) { desk.pan = Math.max(-1, Math.min(1, desk.pan - dx / (innerWidth * 0.5))); return; }
  if (mode !== 'walk') return;
  yaw -= dx * 0.005; pitch = Math.max(-0.15, Math.min(1.1, pitch + dy * 0.004)); lastLook = performance.now();
});
canvas.addEventListener('pointerup', e => {
  if (dragging && dragging.moved < 6 && mode === 'walk') tapMove(e);
  dragging = null;
});
canvas.addEventListener('wheel', e => { dist = Math.max(1.8, Math.min(6, dist * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: true });

// Click or tap the floor to walk there; click the desk or its screens to sit down and use the computer.
let autoTarget = null;
const SPOTS = { desk: b2t(...meta.points.desk_use), window: b2t(-1.6, 2.2, 0), lounge: b2t(-0.4, -2.6, 0) };
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { if (mode !== 'walk') return; autoTarget = SPOTS[b.dataset.go].clone(); autoTarget.useDesk = b.dataset.go === 'desk'; }));
$('cmd').addEventListener('keydown', e => { if (e.key === 'Enter') { screens.run(e.target.value, () => leaveDesk()); e.target.value = ''; sound.key(); } });
$('use').addEventListener('click', () => { if (mode === 'desk') leaveDesk(); else if (nearDesk) useDesk(); });
const ray = new THREE.Raycaster(), floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const deskThings = [];
room.traverse(o => { if (o.isMesh && /^(screen_|kb_|monitor|mini_case|desk_mat|mouse)/.test(o.name)) deskThings.push(o); });
function tapMove(e) {
  const p = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(p, camera);
  if (ray.intersectObjects(deskThings, false).length) { autoTarget = SPOTS.desk.clone(); autoTarget.useDesk = true; return; }
  floorPlane.constant = -pos.y;
  const hit = new THREE.Vector3();
  if (ray.ray.intersectPlane(floorPlane, hit)) autoTarget = hit;
}

// ---------- state ----------
const pos = b2t(...meta.points.spawn);
const vel = new THREE.Vector3();
let vy = 0, grounded = true, facing = Math.PI / 2, mode = 'walk', nearDesk = false, airT = 0, landT = 0, idleT = 0, lean = 0;
const deskUse = b2t(...meta.points.desk_use);
const chair = b2t(2.15, 0.62, 0);
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let glide = null;
me.position.copy(pos);
phys?.place(pos);
const physAt = pos.clone();

function forwardInput() {
  const f = new THREE.Vector3();
  if (keys.has('KeyW') || keys.has('ArrowUp')) f.z -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) f.z += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) f.x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) f.x += 1;
  if (f.lengthSq()) autoTarget = null;
  if (autoTarget) {
    const d = autoTarget.clone().sub(pos); d.y = 0;
    if (d.length() < 0.35) { const u = autoTarget.useDesk; autoTarget = null; if (u) useDesk(); return f; }
    return d.normalize();
  }
  if (!f.lengthSq()) return f;
  f.normalize();
  // The camera sits at angle `yaw` from me, so turning the input by `yaw` makes W point away from it.
  return f.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
}

// ---------- the desk: a Call of Duty style glide over my right shoulder and into my eyes ----------
const desk = { pan: 0, range: 0, c: null, d: 0, fov: 42 };
const deskAim = () => desk.c.clone().add(new THREE.Vector3(0, 0, desk.pan * desk.range));
const deskEye = () => deskAim().add(new THREE.Vector3(-desk.d, 0, 0));
const headPos = new THREE.Vector3();
function headNow() { bones.Head.getWorldPosition(headPos); return headPos.clone().add(new THREE.Vector3(0, 0.12, 0)); }
// My facing at the desk is +x, so my right is +z and behind me is -x.
function shoulderPoint(h) { return h.clone().add(new THREE.Vector3(-0.45, 0.22, 0.7)); }
function useDesk() {
  if (mode !== 'walk') return;
  mode = 'desk';
  autoTarget = null;
  sound.chair();
  playOnce('Sitting_Enter');
  me.position.copy(chair);
  me.rotation.set(0, Math.PI / 2, 0);
  setTimeout(() => { if (mode === 'desk') holdPose('Sitting_Idle_Loop'); }, 900);
  const s = meta.screens.main;
  const c = b2t(...s.center);
  const fov = camera.aspect < 1.2 ? 58 : 42, vf = THREE.MathUtils.degToRad(fov);
  const hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  // The curve brings the edges closer by its sagitta, so they need that much more distance to fit.
  const sag = s.r * (1 - Math.cos(s.w / 2 / s.r));
  const fitW = (s.w * 0.52) / Math.tan(hf / 2) + sag, fitH = (s.h * 0.56) / Math.tan(vf / 2);
  const d = Math.min(Math.max(fitW, fitH) + 0.03, camera.aspect < 1.2 ? 0.82 : 1.05);
  const half = Math.tan(hf / 2) * d;
  desk.range = Math.max(0, s.w / 2 - half + 0.02);
  desk.pan = desk.range ? -1 : 0;
  desk.c = c; desk.d = d; desk.fov = fov;
  glide = { t: 0, dur: 1.7, dir: 'in', fromP: camera.position.clone(), fromL: camLook.clone(), fromFov: camera.fov };
  $('prompt').classList.remove('on');
  screens.focusTerminal(true);
  document.body.classList.add('at-desk');
  $('use').textContent = 'Back';
}
function leaveDesk() {
  if (mode !== 'desk') return;
  mode = 'leaving';
  screens.focusTerminal(false);
  document.body.classList.remove('at-desk');
  $('cmd').blur();
  playOnce('Sitting_Exit');
  glide = { t: 0, dur: 1.4, dir: 'out', fromP: camera.position.clone(), fromL: camLook.clone(), fromFov: camera.fov,
    done: () => { mode = 'walk'; pos.copy(deskUse); me.position.copy(pos); phys?.place(pos); physAt.copy(pos); endOneShot(); } };
  $('use').textContent = 'Use';
}
// Points along the glide: start, over the right shoulder, into the eyes, the screen. Rebuilt every frame so it
// follows my head while the sitting animation moves it.
const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], false, 'centripetal');
function glidePose(g, e) {
  const h = headNow(), eyes = h.clone().add(new THREE.Vector3(0.06, -0.02, 0));
  const lookAhead = eyes.clone().add(new THREE.Vector3(1.2, -0.05, 0));
  if (g.dir === 'in') {
    curve.points[0].copy(g.fromP); curve.points[1].copy(shoulderPoint(h)); curve.points[2].copy(eyes); curve.points[3].copy(deskEye());
    const l = e < 0.55 ? g.fromL.clone().lerp(lookAhead, ease(e / 0.55)) : lookAhead.clone().lerp(deskAim(), ease((e - 0.55) / 0.45));
    return { p: curve.getPoint(e), l, fov: THREE.MathUtils.lerp(g.fromFov, desk.fov, e) };
  }
  const back = thirdPersonPose();
  curve.points[0].copy(g.fromP); curve.points[1].copy(eyes); curve.points[2].copy(shoulderPoint(h)); curve.points[3].copy(back.p);
  const l = e < 0.45 ? g.fromL.clone().lerp(lookAhead, ease(e / 0.45)) : lookAhead.clone().lerp(back.l, ease((e - 0.45) / 0.55));
  return { p: curve.getPoint(e), l, fov: THREE.MathUtils.lerp(g.fromFov, coarse ? 60 : 55, e) };
}
function thirdPersonPose() {
  const l = pos.clone().add(new THREE.Vector3(0, 1.45 - crouchK * 0.4, 0));
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(-0.32);
  l.add(side);
  // The camera slides in along its arm instead of passing through furniture or walls.
  const p = l.clone().add(dir.clone().multiplyScalar(cameraRoom(l, dir, dist)));
  p.x = Math.min(p.x, 3.3); p.z = Math.max(p.z, -2.85); p.z = Math.min(p.z, 4.0); p.x = Math.max(p.x, -3.45); p.y = Math.min(Math.max(p.y, pos.y + 0.4), 2.75);
  return { p, l };
}
function cameraRoom(o, d, want) {
  let best = want;
  for (const b of boxes) {
    if (b.y1 - b.y0 > 4.5 && b.name.startsWith('wall')) continue;
    let t0 = 0, t1 = want;
    for (const [oo, dd, lo, hi] of [[o.x, d.x, b.x0, b.x1], [o.y, d.y, b.y0, b.y1], [o.z, d.z, b.z0, b.z1]]) {
      if (Math.abs(dd) < 1e-6) { if (oo < lo || oo > hi) { t0 = Infinity; break; } continue; }
      let a = (lo - oo) / dd, c = (hi - oo) / dd;
      if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, c);
      if (t0 > t1) break;
    }
    if (t0 <= t1 && t0 > 0.05) best = Math.min(best, t0 - 0.12);
  }
  return Math.max(0.9, best);
}
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ---------- head look-at: my head turns toward things I pass ----------
const LOOKS = [b2t(...meta.screens.main.center), b2t(...meta.points.aria), b2t(-1.6, 2.6, 1.5), b2t(...meta.screens.pishi.center)];
const lookQ = new THREE.Quaternion(), qTmp = new THREE.Quaternion(), qParent = new THREE.Quaternion(), qWorld = new THREE.Quaternion();
let lookYaw = 0, lookPitch = 0;
function lookAround(dt, idle) {
  const h = bones.Head;
  if (!h || mode !== 'walk') { lookYaw *= 0.9; lookPitch *= 0.9; }
  else {
    const eye = headNow();
    let want = null, bestD = 3.2;
    for (const p of LOOKS) {
      const d = p.clone().sub(eye), dl = d.length();
      const rel = Math.atan2(Math.sin(Math.atan2(d.x, d.z) - facing), Math.cos(Math.atan2(d.x, d.z) - facing));
      if (dl < bestD && Math.abs(rel) < 1.6) { bestD = dl; want = [rel, Math.atan2(d.y, Math.hypot(d.x, d.z))]; }
    }
    if (!want && idle > 4) want = [Math.sin(performance.now() / 2300) * 0.6, 0.05];
    const [ty, tp] = want || [0, 0];
    lookYaw += (THREE.MathUtils.clamp(ty, -1, 1) - lookYaw) * Math.min(1, dt * 3);
    lookPitch += (THREE.MathUtils.clamp(tp, -0.4, 0.35) - lookPitch) * Math.min(1, dt * 3);
  }
  if (!h || (Math.abs(lookYaw) < 1e-3 && Math.abs(lookPitch) < 1e-3)) return;
  // Add the turn in world space on top of the animated pose, then convert back to the bone's own space.
  h.parent.getWorldQuaternion(qParent);
  h.getWorldQuaternion(qWorld);
  const right = new THREE.Vector3(Math.cos(facing), 0, -Math.sin(facing));
  lookQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), lookYaw * 0.75).multiply(qTmp.setFromAxisAngle(right, -lookPitch * 0.7));
  h.quaternion.copy(qParent.invert().multiply(lookQ.multiply(qWorld)));
}

// ---------- the mosaic over the toy head (post effect, so it only shows where post effects run) ----------
function tickMosaic(now) {
  const u = mosaicU;
  if (head !== 'mosaic' || !me.visible) { u.radius.value = 0; return; }
  const h = headNow().add(new THREE.Vector3(0, 0.04, 0)), dd = camera.position.distanceTo(h);
  h.project(camera);
  u.centre.value.set(h.x * 0.5 + 0.5, h.y * 0.5 + 0.5);
  // A head of radius r at distance dd covers r / (dd tan(fov/2)) of the half screen height; UVs span the full height.
  u.radius.value = 0.5 * 0.2 / dd / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  u.aspect.value = camera.aspect;
  u.cells.value = Math.max(30, Math.min(110, 26 * dd));
  u.drift.value.set(Math.sin(now / 900) * 0.5, Math.cos(now / 1300) * 0.5);
}

// ---------- frame loop ----------
const clock = new THREE.Clock();
let frames = 0, ftAcc = 0, tierChecked = 0, slowRuns = 0, prevFacing = facing;
const sound = new Sound();
let lastSafe = pos.clone();
function step() {
  const dt = Math.min(clock.getDelta(), 1 / 20), now = performance.now();
  renderer.info.reset();
  let hs = 0;
  if (mode === 'walk') {
    // Anything that moved me from outside (the tests, leaving the desk, the respawn) moves the capsule too.
    if (phys && pos.distanceToSquared(physAt) > 1e-6) phys.place(pos);
    const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
    crouchHeld = keys.has('KeyC') && rollT <= 0;
    const want = forwardInput();
    let speed = want.lengthSq() ? (crouchHeld ? 1.2 : run ? 5.6 : autoTarget ? 2.2 : 1.9) : 0;
    let target = want.multiplyScalar(speed);
    if (rollT > 0) { rollT -= dt; target = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing)).multiplyScalar(4.2); }
    const k = grounded ? 10 : 2.5;
    vel.x += (target.x - vel.x) * Math.min(1, k * dt);
    vel.z += (target.z - vel.z) * Math.min(1, k * dt);
    if (keys.has('Space') && grounded && rollT <= 0) { vy = 5.1; grounded = false; airT = 0; playOnce('Jump_Start'); sound.jump(); keys.delete('Space'); }
    vy -= 18 * dt;
    const wasGrounded = grounded;
    if (phys) {
      grounded = phys.move(pos, { x: vel.x * dt, y: vy * dt, z: vel.z * dt });
      if (grounded && vy < 0) vy = 0;
    } else {
      pos.x += vel.x * dt; pos.z += vel.z * dt;
      pushOut(pos, pos.y);
      pos.y += vy * dt;
      const g = groundAt(pos.x, pos.z, pos.y - vy * dt);
      if (pos.y <= g) { pos.y = g; vy = 0; grounded = true; } else if (pos.y > g + 0.05) grounded = false;
    }
    physAt.copy(pos);
    if (grounded && !wasGrounded && airT > 0.25) { playOnce('Jump_Land'); landT = 0.3; sound.land(); }
    // Safety net: if anything ever lets me slip out of the world, put me back where I last stood.
    if (grounded) { lastSafe.copy(pos); airT = 0; }
    else if (pos.y < -2) { pos.copy(lastSafe); vy = 0; vel.set(0, 0, 0); }
    if (!grounded) { airT += dt; if (airT > 0.22 && oneShot !== acts.Jump_Loop) holdPose('Jump_Loop'); }
    else if (oneShot === acts.Jump_Loop) endOneShot();
    hs = Math.hypot(vel.x, vel.z);
    if (hs > 0.05 && rollT <= 0) { const t = Math.atan2(vel.x, vel.z); let d = t - facing; d = Math.atan2(Math.sin(d), Math.cos(d)); facing += d * Math.min(1, 12 * dt); }
    // Lean into turns when moving fast.
    const turnRate = Math.atan2(Math.sin(facing - prevFacing), Math.cos(facing - prevFacing)) / Math.max(dt, 1e-3);
    prevFacing = facing;
    lean += (THREE.MathUtils.clamp(-turnRate * hs * 0.018, -0.2, 0.2) - lean) * Math.min(1, dt * 6);
    idleT = hs < 0.12 && grounded ? idleT + dt : 0;
    // Idle moments: left alone, I glance around, and now and then do something with my hands.
    if (idleT > 14 && !oneShot) { playOnce('Interact'); idleT = 4; }
    me.position.copy(pos);
    me.rotation.set(0, facing, lean, 'YXZ');
    landT -= dt;
    if (grounded && hs > 0.3) sound.stepTick(hs > 4.5 ? acts.Sprint_Loop : hs > 2.6 ? acts.Jog_Fwd_Loop : acts.Walk_Loop, hs);
    // Let the camera drift back behind me while I move and nobody is steering it.
    if (hs > 0.5 && now - lastLook > 1600 && !coarse) { let d = (facing + Math.PI) - yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); yaw += d * Math.min(1, 1.2 * dt); }
    nearDesk = pos.distanceTo(deskUse) < 1.25 && grounded;
    $('prompt').classList.toggle('on', nearDesk);
  }
  blob.position.set(me.position.x, groundAt(me.position.x, me.position.z, me.position.y + 0.05) + 0.012, me.position.z);
  blob.scale.setScalar(1 - Math.min(0.5, (me.position.y - blob.position.y) * 0.6));
  animate(dt, mode === 'walk' ? hs : 0, mode === 'walk' && crouchHeld);
  lookAround(dt, idleT);

  if (glide) {
    glide.t += dt / glide.dur;
    const e = ease(Math.min(1, glide.t));
    const g = glidePose(glide, e);
    camera.position.copy(g.p); camLook.copy(g.l);
    camera.fov = g.fov; camera.updateProjectionMatrix();
    // I disappear the moment the camera reaches my head, so it never shows the inside of the hood.
    me.visible = camera.position.distanceTo(headNow()) > 0.42 && !(glide.dir === 'in' && e > 0.75);
    if (glide.t >= 1) { const d = glide.done; glide = null; d?.(); me.visible = mode !== 'desk'; }
  } else if (mode === 'walk') {
    const tp = thirdPersonPose();
    camera.position.lerp(tp.p, Math.min(1, 7 * dt));
    camLook.lerp(tp.l, Math.min(1, 9 * dt));
  } else if (mode === 'desk' && desk.range) {
    camera.position.lerp(deskEye(), Math.min(1, 10 * dt));
    camLook.lerp(deskAim(), Math.min(1, 10 * dt));
  }
  camera.lookAt(camLook);
  drawFace(now);
  tickMosaic(now);

  screens.tick(now, dt, mode === 'desk');
  const t = now / 1000;
  for (let i = 0; i < leds.length; i++) leds[i].visible = Math.sin(t * (2 + (i % 7)) + i * 1.7) > -0.6;
  if (aria.eyes) { const blink = (t % 4.2) < 0.12; for (const e of aria.eyes) e.scale.y = blink ? 0.15 : 1; }
  if (aria.tip) aria.tip.material.color.setRGB(1.0 * (2 + Math.sin(t * 3)), 0.62 * (2 + Math.sin(t * 3)), 0.3 * (2 + Math.sin(t * 3)));
  tickClocks();
  tickTraffic(dt);
  tickWeather(dt, t);
  if (lava) lava.material.uniforms.time.value = t;
  tickSteam(dt, t);
  tickPC(t, mode === 'desk');

  if (composer) composer.render(dt); else renderer.render(scene, camera);

  frames++; ftAcc += dt;
  if (autoTier && frames > 40 && now - tierChecked > 2500) {
    const ms = ftAcc / frames * 1000;
    tierChecked = now;
    // Start at the best look and only step down when frames stay slow: the first seconds (shader warm-up) and a
    // single hitch don't count. The frame interval is capped by the screen's refresh rate, so it can never prove
    // there is room to step back up.
    const order = ['low', 'medium', 'high'], i = order.indexOf(tierName);
    slowRuns = now > 6000 && ms > 22 ? slowRuns + 1 : 0;
    if (slowRuns >= 2 && i > 0) { tierName = order[i - 1]; setTier(tierName); slowRuns = 0; }
    frames = 0; ftAcc = 0;
  }
  if (showStats) $('stats').textContent = `${(1 / Math.max(dt, 1e-3)).toFixed(0)} fps · ${renderer.info.render.calls} calls · ${(renderer.info.render.triangles / 1000).toFixed(0)}k tris · ${physName} · ${weather}${screens.holiday ? ' · ' + screens.holiday.id : ''}`;
  requestAnimationFrame(step);
}
function tickClocks() {
  const fmt = tz => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date()); return [+p.find(x => x.type === 'hour').value, +p.find(x => x.type === 'minute').value]; };
  for (const [nm, tz] of [['van', 'America/Vancouver'], ['teh', 'Asia/Tehran']]) {
    const [h, m] = fmt(tz);
    if (clockHands[`clock_${nm}_h`]) clockHands[`clock_${nm}_h`].rotation.x = -((h % 12) + m / 60) / 12 * Math.PI * 2;
    if (clockHands[`clock_${nm}_m`]) clockHands[`clock_${nm}_m`].rotation.x = -m / 60 * Math.PI * 2;
  }
}

$('q').addEventListener('click', () => {
  const order = ['auto', 'low', 'medium', 'high'];
  const next = order[(order.indexOf(autoTier ? 'auto' : tierName) + 1) % order.length];
  autoTier = next === 'auto';
  tierName = autoTier ? 'high' : next;
  setTier(tierName);
});
$('who').addEventListener('click', () => { if (mode === 'walk') nextHead(); });
$('snd').addEventListener('click', () => { const on = sound.toggle(); $('snd').textContent = on ? 'Sound on' : 'Sound off'; $('snd').classList.toggle('on', on); });
if (params.has('stats')) $('stats').style.display = 'block';

if (tierName === 'auto') tierName = coarse ? 'medium' : 'high';
setTier(tierName);
resize();
const start = thirdPersonPose();
camera.position.copy(start.p); camLook.copy(start.l);
$('note').textContent = coarse ? 'Tap a spot or the floor to walk there' : 'Drag to look around, WASD to walk, click to go somewhere';
$('enter').classList.add('ready');
$('enter').addEventListener('click', () => { $('gate').classList.add('gone'); sound.start(); $('snd').textContent = 'Sound on'; $('snd').classList.add('on'); });
if (params.has('auto')) $('gate').classList.add('gone');
window.__loft = { pos, keys, useDesk, leaveDesk, nextHead, get head() { return head; }, get mode() { return mode; }, get tier() { return tierName; }, get physics() { return physName; },
  get weights() { return Object.fromEntries([...weight].filter(([, w]) => w > 0.01).map(([a, w]) => [a.getClip().name, +w.toFixed(2)])); },
  get headVisible() { return me.visible; },
  // Meshes of the current head that would actually draw (every ancestor visible).
  get headMeshesShown() { let n = 0; for (const name of HEADS[head]) (parts[name] || []).forEach(o => o.traverse(c => { if (!c.isMesh) return; let v = true; for (let x = c; x; x = x.parent) v = v && x.visible; if (v) n++; })); return n; }, set yaw(v) { yaw = v; lastLook = performance.now(); }, renderer, camera, scene };
requestAnimationFrame(step);
