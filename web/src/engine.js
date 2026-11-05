import * as THREE from 'three';
import { EffectComposer, RenderPass, Pass, EffectPass, Effect, BloomEffect, SMAAEffect, VignetteEffect, NoiseEffect, BlendFunction } from 'postprocessing';

// Blender is Z-up with the room's north at +Y; glTF/three is Y-up, so Blender (x, y, z) lands at (x, z, -y).
export const b2t = (x, y, z) => new THREE.Vector3(x, z, -y);

export const TIERS = {
  low: { ratio: 1, post: false, bloom: false },
  medium: { ratio: 1.25, post: true, bloom: true },
  high: { ratio: 2, post: true, bloom: true, smaa: true, grain: true },
};

// The mosaic that hides the toy head moves the image's UVs, so it needs its own pass ahead of the others.
const MOSAIC_FS = `uniform vec2 centre, drift; uniform float radius, cells, aspect;
  void mainUv(inout vec2 uv) {
    vec2 d = (uv - centre) * vec2(aspect, 1.0);
    if (radius > 0.0 && length(d / vec2(0.8, 1.0)) < radius) {
      vec2 cell = vec2(cells * aspect, cells), off = drift / cell;
      uv = (floor((uv + off) * cell) + 0.5) / cell - off;
    }
  }`;

export function makeEngine(canvas, coarse) {
  // Phones skip post effects, so they get cheap hardware antialiasing instead.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: coarse, powerPreference: 'high-performance', stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0f1c);
  scene.fog = new THREE.FogExp2(0x0a0f1c, 0.05);
  const camera = new THREE.PerspectiveCamera(coarse ? 60 : 55, 1, 0.05, 120);
  const mosaicU = { centre: new THREE.Uniform(new THREE.Vector2()), drift: new THREE.Uniform(new THREE.Vector2()), radius: new THREE.Uniform(0), cells: new THREE.Uniform(40), aspect: new THREE.Uniform(1) };
  const onTier = [];
  let composer = null, tier = TIERS.medium, bg = null;

  // The world outside the glass is its own scene with its own far-reaching camera, drawn first; the loft goes on top.
  function drawScenes(target) {
    renderer.setRenderTarget(target);
    renderer.autoClear = false;
    renderer.clear();
    renderer.render(bg.scene, bg.camera);
    renderer.clearDepth();
    renderer.render(scene, camera);
    renderer.autoClear = true;
  }
  class BackgroundPass extends Pass {
    constructor() { super('BackgroundPass'); this.needsSwap = false; }
    render(r, inputBuffer) { drawScenes(this.renderToScreen ? null : inputBuffer); }
  }

  function buildPost() {
    composer?.dispose();
    composer = null;
    if (!tier.post) return;
    composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
    composer.addPass(bg ? new BackgroundPass() : new RenderPass(scene, camera));
    composer.addPass(new EffectPass(camera, new Effect('Mosaic', MOSAIC_FS, { uniforms: new Map(Object.entries(mosaicU)) })));
    const fx = [];
    if (tier.bloom) fx.push(new BloomEffect({ luminanceThreshold: 0.82, luminanceSmoothing: 0.25, intensity: 1.15, mipmapBlur: true, radius: 0.72 }));
    fx.push(new VignetteEffect({ offset: 0.32, darkness: 0.55 }));
    if (tier.grain) { const n = new NoiseEffect({ blendFunction: BlendFunction.SOFT_LIGHT, premultiply: true }); n.blendMode.opacity.value = 0.35; fx.push(n); }
    if (tier.smaa) fx.push(new SMAAEffect());
    composer.addPass(new EffectPass(camera, ...fx));
    resize();
  }
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    composer?.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  function setTier(name) {
    tier = TIERS[name];
    for (const f of onTier) f(name);
    renderer.setPixelRatio(Math.min(devicePixelRatio, tier.ratio));
    buildPost();
  }
  function render(dt) { if (composer) composer.render(dt); else if (bg) drawScenes(null); else renderer.render(scene, camera); }
  function setBackground(outside) { bg = outside; scene.background = null; buildPost(); }
  addEventListener('resize', resize);
  return { renderer, scene, camera, mosaicU, setTier, resize, render, setBackground, onTier: f => onTier.push(f) };
}
