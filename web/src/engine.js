import * as THREE from 'three';
import { EffectComposer, RenderPass, Pass, EffectPass, Effect, EffectAttribute, BloomEffect, SMAAEffect, VignetteEffect, NoiseEffect, BlendFunction } from 'postprocessing';
import { TIERS, TIER_ORDER, effectsOf } from './pure/tier.js';
import { makeRebuilder, STALE } from './pure/rebuild.js';
import { inSlices } from './pure/slices.js';

export { TIERS };

// Blender is Z-up with the room's north at +Y; glTF/three is Y-up, so Blender (x, y, z) lands at (x, z, -y).
export const b2t = (x, y, z) => new THREE.Vector3(x, z, -y);

// The mosaic over the toy head (and its mirror image) blurs what is round each pixel, so it has its own pass ahead of the others.
const MOSAIC_FS = `uniform vec2 centre, centre2, drift; uniform float radius, radius2, cells, aspect;
  vec3 block(vec2 at, vec2 cell) {
    vec3 s = vec3(0.0);
    // A fixed level: these reads sit behind a branch only some pixels take, where the implicit level is undefined.
    for (int a = 0; a < 4; a++) for (int b = 0; b < 4; b++) s += textureLod(inputBuffer, at + (vec2(float(a), float(b)) - 1.5) * cell * 0.36, 0.0).rgb;
    return s / 16.0;
  }
  vec3 veil(vec3 col, vec2 uv, vec2 c, float r) {
    float k = 1.0 - smoothstep(0.62 * r, 1.2 * r, length((uv - c) * vec2(aspect / 0.85, 1.0)));
    if (k <= 0.0) return col;
    vec2 cell = vec2(r / cells / aspect, r / cells);
    vec2 h = (uv - c) / cell + drift - 0.5, i = floor(h), f = fract(h);
    vec2 at = c + (i + 0.5 - drift) * cell;
    vec3 q00 = block(at, cell), q10 = block(at + vec2(cell.x, 0.0), cell), q01 = block(at + vec2(0.0, cell.y), cell), q11 = block(at + cell, cell);
    vec3 soft = mix(mix(q00, q10, f.x), mix(q01, q11, f.x), f.y);
    vec2 n = smoothstep(0.44, 0.56, f);
    vec3 hard = mix(mix(q00, q10, n.x), mix(q01, q11, n.x), n.y);
    return mix(col, mix(soft, hard, 0.22), k);
  }
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 col = inputColor.rgb;
    if (radius > 0.0) col = veil(col, uv, centre, radius);
    if (radius2 > 0.0) col = veil(col, uv, centre2, radius2);
    outputColor = vec4(col, inputColor.a);
  }`;

export function makeEngine(canvas, coarse) {
  // Phones skip post effects, so they get cheap hardware antialiasing instead.
  // alpha: the live video plays in a page layer under the canvas, seen through a see-through hole in the picture.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: coarse, powerPreference: 'high-performance', stencil: false, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0f1c);
  scene.fog = new THREE.FogExp2(0x0a0f1c, 0.05);
  const camera = new THREE.PerspectiveCamera(coarse ? 60 : 55, 1, 0.05, 120);
  const mosaicU = { centre: new THREE.Uniform(new THREE.Vector2()), centre2: new THREE.Uniform(new THREE.Vector2()), drift: new THREE.Uniform(new THREE.Vector2()),
    radius: new THREE.Uniform(0), radius2: new THREE.Uniform(0), cells: new THREE.Uniform(3.4), aspect: new THREE.Uniform(1) };
  const onTier = [], layers = [];
  let composer = null, tier = TIERS.medium, wanted = null, chains = null, bg = null, bgOn = true;

  // The world outside the glass is its own scene with its own far-reaching camera, drawn first; the loft goes on top.
  // Layers are scenes of their own drawn with it. One marked `under` (the range's rooms) goes in before the loft and
  // shares its depth, so each hides the other properly and the loft's see-through things (my shadow on the floor)
  // still show over it; the rest (the gun in the hand, on a fresh depth and its own camera) go on top.
  function drawScenes(target) {
    renderer.setRenderTarget(target);
    renderer.autoClear = false;
    renderer.clear();
    if (bgOn) renderer.render(bg.scene, bg.camera);
    renderer.clearDepth();
    drawLayers(true);
    renderer.render(scene, camera);
    drawLayers(false);
    renderer.autoClear = true;
  }
  // under: true or false draws that half of the layers; left out, all of them.
  function drawLayers(under) {
    for (const l of layers) {
      if (!l.on() || (under !== undefined && !!l.under !== under)) continue;
      if (l.clearDepth) renderer.clearDepth();
      renderer.render(l.scene, l.camera || camera);
    }
  }
  class BackgroundPass extends Pass {
    constructor() { super('BackgroundPass'); this.needsSwap = false; }
    render(r, inputBuffer) { drawScenes(this.renderToScreen ? null : inputBuffer); }
  }
  // Without the world outside, the loft is drawn the plain way and the layers go over it.
  class LayersPass extends Pass {
    constructor() { super('LayersPass'); this.needsSwap = false; }
    render(r, inputBuffer) {
      if (!layers.some(l => l.on())) return;
      renderer.setRenderTarget(this.renderToScreen ? null : inputBuffer);
      renderer.autoClear = false;
      drawLayers();
      renderer.autoClear = true;
    }
  }

  // The effects chain for a tier: its passes made and their shaders written, nothing drawn yet.
  function makeChain(t) {
    if (!t.post) return null;
    const c = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
    if (bg) c.addPass(new BackgroundPass());
    else { c.addPass(new RenderPass(scene, camera)); c.addPass(new LayersPass()); }
    c.addPass(new EffectPass(camera, new Effect('Mosaic', MOSAIC_FS, { attributes: EffectAttribute.CONVOLUTION, uniforms: new Map(Object.entries(mosaicU)) })));
    const fx = [];
    if (t.bloom) fx.push(new BloomEffect({ luminanceThreshold: 0.82, luminanceSmoothing: 0.25, intensity: 1.15, mipmapBlur: true, radius: 0.72 }));
    fx.push(new VignetteEffect({ offset: 0.32, darkness: 0.55 }));
    if (t.grain) { const n = new NoiseEffect({ blendFunction: BlendFunction.SOFT_LIGHT, premultiply: true }); n.blendMode.opacity.value = 0.35; fx.push(n); }
    if (t.smaa) fx.push(new SMAAEffect());
    c.addPass(new EffectPass(camera, ...fx));
    return c;
  }
  function buildPost() {
    composer?.dispose();
    composer = makeChain(tier);
    resize();
  }
  // Every shader of a chain built off the frame, a slice at a time, both ways it may draw (into a picture, and to the
  // screen for its last pass), and every picture it draws into or reads made on the graphics card, so its first frame
  // has nothing left to build.
  const breath = () => new Promise(done => setTimeout(done, 30));
  async function readyChain(c, stale) {
    if (!c || !renderer.compileAsync) return;
    const mats = new Set(), targets = new Set(), pictures = new Set(), seen = new Set();
    const look = (o, depth) => {
      if (!o || typeof o !== 'object' || seen.has(o) || depth > 5) return;
      seen.add(o);
      if (o.isMaterial) { mats.add(o); for (const u of Object.values(o.uniforms || {})) if (u?.value?.isTexture && !u.value.isRenderTargetTexture && u.value.image) pictures.add(u.value); return; }
      if (o.isMesh) { for (const m of [].concat(o.material || [])) look(m, depth + 1); return; }
      if (o.isRenderTarget || o.isWebGLRenderTarget) { targets.add(o); return; }
      if (o.isTexture) { if (!o.isRenderTargetTexture && o.image) pictures.add(o); return; }
      if (o.isWebGLRenderer || o.isObject3D || o.isBufferGeometry) return;
      for (const v of Object.values(o)) look(v, depth + 1);
    };
    for (const p of c.passes) look(p, 0);
    // Only a pass that draws to the screen needs its shader built that way too; all draw into pictures.
    const toScreen = new Set(c.passes.filter(p => p.renderToScreen && p.fullscreenMaterial).map(p => p.fullscreenMaterial));
    await inSlices([...targets], t => { if (stale()) throw STALE; renderer.initRenderTarget(t); }, { rest: breath });
    await inSlices([...pictures], t => { if (stale()) throw STALE; renderer.initTexture(t); }, { rest: breath });
    const tri = new THREE.BufferGeometry(), flat = new THREE.OrthographicCamera(), picture = new THREE.WebGLRenderTarget(1, 1);
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    try {
      for (const [target, list] of [[picture, mats], [null, toScreen]]) {
        const jobs = [];
        await inSlices([...list], m => {
          if (stale()) throw STALE;
          const was = renderer.getRenderTarget();
          try { renderer.setRenderTarget(target); jobs.push(renderer.compileAsync(new THREE.Mesh(tri, m), flat)); } finally { renderer.setRenderTarget(was); }
        }, { rest: breath });
        await Promise.all(jobs);
      }
    } finally { tri.dispose(); picture.dispose(); }
    // A program's first use reads its compile logs back from the graphics card, which waits for all the card has queued:
    // most of a frame at 2x, held inside the swap's first frame. Each program that linked is first used here instead,
    // with that read left out; one that failed to link keeps its logs.
    const gl = renderer.getContext(), checks = renderer.debug.checkShaderErrors, used = new Set();
    for (const m of mats) for (const prog of renderer.properties.get(m).programs?.values() || []) used.add(prog);
    await inSlices([...used], prog => {
      if (stale()) throw STALE;
      if (!gl.getProgramParameter(prog.program, gl.LINK_STATUS)) return;
      renderer.debug.checkShaderErrors = false;
      try { prog.getUniforms(); } finally { renderer.debug.checkShaderErrors = checks; }
    }, { rest: breath });
  }
  // The chain for a set of effects, built in the background; the tier last asked for has that set.
  async function buildChain(effects, { made, stale }) {
    await breath();
    if (stale()) throw STALE;
    const c = makeChain(TIERS[effectsOf(wanted) === effects ? wanted : TIER_ORDER.find(t => effectsOf(t) === effects)]);
    made.push(c);
    await readyChain(c, stale);
    if (stale()) throw STALE;
    return c;
  }
  function apply(name) {
    tier = TIERS[name];
    renderer.setPixelRatio(Math.min(devicePixelRatio, tier.ratio));
  }
  function swapChain(c) {
    const old = composer;
    composer = c;
    resize();
    old?.dispose();
  }
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    composer?.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  // A change of tier: the sharpness changes at once (the old chain keeps drawing at the new size); a new set of effects
  // is built in the background, at that size, and swapped in when it is ready. The first tier, while the house loads,
  // is built at once. Resizing the picture while a new chain was being swapped in held the frame twice as long.
  function setTier(name) {
    for (const f of onTier) f(name);
    wanted = name;
    apply(name);
    if (!chains) {
      buildPost();
      chains = makeRebuilder({ current: effectsOf(name), build: buildChain, swap: swapChain, discard: made => made.forEach(c => c?.dispose()), onError: e => console.warn('[engine] the effects could not be built', e) });
      return;
    }
    resize();
    chains.want(effectsOf(name));
  }
  function render(dt) {
    if (composer) composer.render(dt);
    else if (bg) drawScenes(null);
    else { renderer.render(scene, camera); if (layers.some(l => l.on())) { renderer.autoClear = false; drawLayers(); renderer.autoClear = true; } }
  }
  // A scene drawn with the loft each frame while `on()` says so. under: before the loft, sharing its depth;
  // clearDepth: start from a fresh depth (the gun in the hand never pokes through a wall); camera: its own, or the loft's.
  function addLayer(layer) { layers.push({ on: () => true, ...layer }); return layer; }
  function setBackground(outside) { bg = outside; scene.background = null; buildPost(); }
  // Every shader is prepared while the loading screen is up, hidden things included, so nothing coming into view later
  // (the mirror, the range targets, the telescope) stalls a frame while the graphics card builds its program.
  async function warmUp() {
    const hidden = [];
    scene.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    try {
      // Each shader is built both ways three draws: straight to the screen (the low tier) and into a picture (every
      // other tier and the reflections), so a change of tier or a first look somewhere new has nothing left to build.
      // three picks the way by what is being drawn into when it is asked, so a picture is put in place to ask.
      const picture = new THREE.WebGLRenderTarget(1, 1);
      for (const [s, cam] of [[scene, camera], bg && [bg.scene, bg.camera]].filter(Boolean)) {
        for (const target of [null, picture]) {
          const was = renderer.getRenderTarget();
          let job = null;
          try { renderer.setRenderTarget(target); if (renderer.compileAsync) job = renderer.compileAsync(s, cam); else renderer.compile(s, cam); }
          finally { renderer.setRenderTarget(was); }
          await job;
        }
      }
      picture.dispose();
      // Pictures go to the graphics card the first time they are drawn: a 4096 px lightmap is a long stall, so send
      // every one now instead of when its zone first comes into view.
      const textures = new Set();
      for (const s of [scene, bg?.scene]) s?.traverse(o => {
        for (const m of [].concat(o.material || [])) for (const v of Object.values(m)) if (v?.isTexture && !v.isRenderTargetTexture) textures.add(v);
      });
      for (const t of textures) renderer.initTexture(t);
      // Reflections (the mirror, the studio floor) set up their own picture the first time they are seen; look at each
      // one once now, from in front of it.
      scene.updateMatrixWorld();
      const eye = new THREE.PerspectiveCamera(50, 1, 0.05, 50), c = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Quaternion();
      scene.traverse(o => {
        if (!o.isReflector) return;
        o.getWorldPosition(c); n.set(0, 0, 1).applyQuaternion(o.getWorldQuaternion(q));
        eye.position.copy(c).addScaledVector(n, 2); eye.lookAt(c); eye.updateMatrixWorld();
        o.onBeforeRender(renderer, scene, eye);
      });
    } finally { for (const o of hidden) o.visible = false; }
    // One real frame through the whole pipeline compiles the post effects too.
    render(0);
  }
  addEventListener('resize', resize);
  return { renderer, scene, camera, mosaicU, setTier, resize, render, setBackground, warmUp, addLayer, onTier: f => onTier.push(f),
    // The world outside is not drawn while nothing of it can be seen (at the range's firing line).
    showBackground(on) { bgOn = on; }, get tier() { return tier; } };
}
