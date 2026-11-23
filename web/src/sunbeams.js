import * as THREE from 'three';
import { GLASS, sunThrough, glassView, midsummer } from './pure/sunbeams.js';
import { skyColors, makeSkyState } from './pure/outside.js';

// The map of how far the light gets from each point of the glass, one texel to 2 cm of glass; FAR is past any wall.
const MAP = [1024, 512], NEAR = -0.3, FAR = 40;
// How bright the sunlit patches are against the baked light, and how much the air in a beam glows.
const LAND = 4.5, SHAFT = 0.006, STEPS = 12;
// The zones inside the glass; the balcony and the view are outside it, the range is elsewhere.
const INSIDE = /^(shell|studio|lounge|piano|teabar|entry|mezz|gallery)_baked$/;
const pause = () => new Promise(res => setTimeout(res, 0));

const COMMON = `
  uniform vec3 uD;
  uniform vec4 uGlass;
  uniform float uZg;
  uniform sampler2D uReach;
  uniform vec2 uTexel;
  // A point's place on the glass seen back along the sunlight, and how far the light has come from there.
  vec3 glassOf(vec3 p) { float t = (p.z - uZg) / uD.z; return vec3(p.xy - uD.xy * t, t); }
  vec2 uvOf(vec2 g) { return (g - uGlass.xz) / (uGlass.yw - uGlass.xz); }
  float reach(vec2 uv) { return textureLod(uReach, uv, 0.0).r * ${FAR.toFixed(1)}; }
  // Lit where the light from that point of the glass gets at least this far, blended between four texels.
  float lit(vec2 uv, float t) {
    vec2 st = uv / uTexel - 0.5, i = floor(st), f = st - i, c = (i + 0.5) * uTexel;
    float a = step(t, reach(c)), b = step(t, reach(c + vec2(uTexel.x, 0.0)));
    float e = step(t, reach(c + vec2(0.0, uTexel.y))), d = step(t, reach(c + uTexel));
    return mix(mix(a, b, f.x), mix(e, d, f.x), f.y);
  }
`;

const VERT = `
  varying vec3 vW;
  varying vec3 vN;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

// The sunlit patches: the surface's own colour brightened (dst * (1 + L)), so the wood stays wood, and the lamps' level
// taken back out, since sunlight does not dim with the switch.
const LAND_FS = `${COMMON}
  uniform vec3 uSun;
  uniform vec3 uLamp;
  uniform float uFog;
  varying vec3 vW;
  varying vec3 vN;
  void main() {
    vec3 g = glassOf(vW);
    vec2 uv = uvOf(g.xy);
    if (g.z <= 0.0 || uv.x <= 0.0 || uv.x >= 1.0 || uv.y <= 0.0 || uv.y >= 1.0) discard;
    float ndl = dot(normalize(vN), -uD);
    if (ndl <= 0.0) discard;
    // Softer the further the light has come past what shades it: the sun is half a degree wide.
    float k = 0.0, spread = 0.6 + max(g.z - reach(uv), 0.0) * 0.45;
    for (int i = 0; i < 4; i++) {
      vec2 o = vec2(i == 0 || i == 3 ? -1.0 : 1.0, i < 2 ? -1.0 : 1.0) * spread * uTexel;
      k += lit(uv + o, g.z - 0.04 - 0.004 * g.z) * 0.25;
    }
    // A soft shoulder, so a wall square to the sun glows instead of burning out to white.
    float e = k * ndl * ${LAND.toFixed(1)}, far = length(vW - cameraPosition) * uFog;
    gl_FragColor = vec4(uSun * uLamp * (e / (1.0 + 0.3 * e) * exp(-far * far)), 1.0);
  }
`;

// The light in the air: the view ray from the eye to the surface (or the glass), walked through the beam in a few steps,
// each one lit only if the sun gets that far. Brighter looking towards the sun, as dust and haze scatter light forward.
const SHAFT_FS = `${COMMON}
  uniform vec3 uShaft;
  varying vec3 vW;
  void clip(float a, float b, float lo, float hi, inout float s0, inout float s1) {
    if (abs(b) < 1e-6) { if (a < lo || a > hi) s1 = -1.0; return; }
    float p = (lo - a) / b, q = (hi - a) / b;
    s0 = max(s0, min(p, q)); s1 = min(s1, max(p, q));
  }
  void main() {
    vec3 rd = vW - cameraPosition;
    float len = length(rd), s0 = 0.0, s1 = len;
    rd /= len;
    vec2 k = uD.xy / uD.z;
    float az = cameraPosition.z - uZg;
    clip(az, rd.z, 0.0, 1e6, s0, s1);
    clip(cameraPosition.x - k.x * az, rd.x - k.x * rd.z, uGlass.x, uGlass.y, s0, s1);
    clip(cameraPosition.y - k.y * az, rd.y - k.y * rd.z, uGlass.z, uGlass.w, s0, s1);
    if (s1 <= s0) discard;
    float ds = (s1 - s0) / ${STEPS}.0, j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))), acc = 0.0;
    for (int i = 0; i < ${STEPS}; i++) {
      vec3 g = glassOf(cameraPosition + rd * (s0 + (float(i) + j) * ds));
      acc += step(g.z, reach(uvOf(g.xy))) * exp(-g.z / 5.5);
    }
    float c = dot(rd, -uD), hg = 0.7975 / pow(1.2025 - 0.9 * c, 1.5);
    gl_FragColor = vec4(uShaft * (acc * ds * (0.35 + hg)), 1.0);
  }
`;

const REACH_VS = `
  uniform vec3 uD;
  uniform float uZg;
  varying float vT;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vT = (w.z - uZg) / uD.z;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const REACH_FS = `varying float vT; void main() { gl_FragColor = vec4(vT / ${FAR.toFixed(1)}, 0.0, 0.0, 1.0); }`;

// Morning sun through the glass wall: sunlit patches on the floor, walls and furniture where the real sun would put them,
// shaded by the window frames and whatever stands in the way, and soft beams in the air. Built the first time the sun
// comes in, never on the low setting. The light switch and the light scenes leave it alone: it is sunlight.
export function makeSunbeams({ scene, renderer, camera, sky, weather, lamps, quality, search = location.search }) {
  const forced = new URLSearchParams(search).has('sunbeams');
  const S = [0, 0, 0], SKY = makeSkyState(), D = new THREE.Vector3(), last = new THREE.Vector3(), clear = new THREE.Color(), col = new THREE.Vector3(), DA = [0, 0, 0];
  let k = 0, clearK = 0, want = 0, built = null, building = false, summer = null;
  // A lost and restored graphics context comes back with an empty map: the next frame draws it again.
  renderer.domElement.addEventListener('webglcontextrestored', () => last.set(0, 0, 0));

  // The sun's direction to light by: the real one, or with the flag and no real sun to be had, a midsummer morning's.
  function sun() {
    const s = sky.light.sunDir;
    S[0] = s.x; S[1] = s.y; S[2] = s.z;
    const real = sunThrough(S);
    if (!forced || real > 0.05) return real;
    summer ||= midsummer(new Date().getFullYear());
    S[0] = summer[0]; S[1] = summer[1]; S[2] = summer[2];
    return sunThrough(S);
  }

  // Built in a few short steps, each in its own task, so no frame carries the whole of it.
  async function build() {
    building = true;
    const baked = [];
    scene.traverse(o => { if (o.isMesh && INSIDE.test(o.name)) baked.push(o); });
    for (const b of baked) { if (!b.geometry.boundingBox) { b.geometry.computeBoundingBox(); await pause(); } }
    const shared = {
      uD: { value: new THREE.Vector3(0, -1, 1).normalize() }, uZg: { value: GLASS.z },
      uGlass: { value: new THREE.Vector4(GLASS.x0, GLASS.x1, GLASS.y0, GLASS.y1) },
      uReach: { value: null }, uTexel: { value: new THREE.Vector2(1 / MAP[0], 1 / MAP[1]) },
    };
    const target = new THREE.WebGLRenderTarget(MAP[0], MAP[1], { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, generateMipmaps: false });
    shared.uReach.value = target.texture;
    const keep = { blendEquation: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };
    const common = { transparent: true, depthWrite: false, fog: false, blending: THREE.CustomBlending, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, ...keep };
    const land = new THREE.ShaderMaterial({ ...common, uniforms: { ...shared, uSun: { value: new THREE.Vector3() }, uLamp: { value: new THREE.Vector3(1, 1, 1) }, uFog: { value: 0 } },
      vertexShader: VERT, fragmentShader: LAND_FS, blendSrc: THREE.DstColorFactor, blendDst: THREE.OneFactor });
    const shaft = new THREE.ShaderMaterial({ ...common, uniforms: { ...shared, uShaft: { value: new THREE.Vector3() } },
      vertexShader: VERT, fragmentShader: SHAFT_FS, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
    for (const m of [land, shaft]) m.userData.lamp = 'glow';
    const group = new THREE.Group(), reachScene = new THREE.Scene();
    group.name = 'sunbeams';
    group.visible = false;
    // Only the far sides of things go in, so a lit surface never shades itself and the floor, which only faces the sun,
    // stays out. The glass seen along the light keeps east on the right, a mirror image, so those are the front faces here.
    const reachMat = new THREE.ShaderMaterial({ uniforms: { uD: shared.uD, uZg: shared.uZg }, vertexShader: REACH_VS, fragmentShader: REACH_FS, side: THREE.FrontSide });
    const zones = [];
    for (const b of baked) {
      b.updateMatrixWorld(true);
      const zone = { north: b.geometry.boundingBox.clone().applyMatrix4(b.matrixWorld).min.z, meshes: [] };
      for (const [mat, into, order] of [[land, group, -1], [shaft, group, 3], [reachMat, reachScene, 0]]) {
        const m = new THREE.Mesh(b.geometry, mat);
        m.matrixAutoUpdate = false;
        m.matrix.copy(b.matrixWorld);
        m.renderOrder = order;
        into.add(m);
        if (mat !== shaft) zone.meshes.push(m);
      }
      zones.push(zone);
    }
    // The glass itself, just outside it, so the beams show against the view too.
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(GLASS.x1 - GLASS.x0, GLASS.y1 - GLASS.y0), shaft);
    pane.position.set((GLASS.x0 + GLASS.x1) / 2, (GLASS.y0 + GLASS.y1) / 2, GLASS.z - 0.02);
    pane.renderOrder = 3;
    group.add(pane);
    group.updateMatrixWorld(true);
    await pause();
    // Each point of the glass in clip space, with how far along the light as depth: an oblique projection, set per sun.
    const eye = new THREE.Camera();
    reachScene.updateMatrixWorld(true);
    // Their shaders are built off the frame, the way they will draw: into a picture (the effects chain, the mirror), with
    // the house's lights counted as the house is drawn with them.
    renderer.initRenderTarget(target);
    const was = renderer.getRenderTarget(), jobs = [];
    try {
      renderer.setRenderTarget(target);
      jobs.push(renderer.compileAsync(group, camera, scene), renderer.compileAsync(reachScene, eye));
    } finally { renderer.setRenderTarget(was); }
    await Promise.all(jobs);
    scene.add(group);
    built = { group, land, shaft, target, reachScene, eye, shared, zones };
    last.set(0, 0, 0);
  }

  function drawReach() {
    const b = built, was = renderer.getRenderTarget(), alpha = renderer.getClearAlpha();
    renderer.getClearColor(clear);
    b.eye.projectionMatrix.set(...glassView(D.toArray(DA), NEAR, FAR));
    b.eye.projectionMatrixInverse.copy(b.eye.projectionMatrix).invert();
    renderer.setRenderTarget(b.target);
    renderer.setClearColor(0xffffff, 1);
    renderer.clear(true, true, false);
    renderer.render(b.reachScene, b.eye);
    renderer.setClearColor(clear, alpha);
    renderer.setRenderTarget(was);
  }

  function tick(dt) {
    const through = quality() === 'low' ? 0 : sun();
    clearK += ((forced || weather() === 'clear' ? 1 : 0) - clearK) * Math.min(1, dt * 0.8);
    if (clearK < 0.003) clearK = 0;
    want = through * clearK;
    k += (want - k) * Math.min(1, dt * 1.5);
    if (Math.abs(want - k) < 0.002) k = want;
    if (!built) { if (k > 0 && !building) build().catch(e => console.warn('[loft] the sunbeams could not be built', e)); return; }
    D.set(-S[0], -S[1], -S[2]).normalize();
    // Light along the glass (the sun due east, where none comes through anyway) has no place on it to trace back to.
    built.group.visible = k > 0.002 && D.z > 0.02;
    if (!built.group.visible) return;
    // The sun moves a quarter of a degree a minute: the map is redrawn every few seconds, not every frame.
    if (last.dot(D) < 0.999999995) {
      last.copy(D);
      built.shared.uD.value.copy(D);
      // A zone wholly south of where the light from the top of the glass reaches the lowest floor gets none and shades
      // nothing; its surfaces still end the view rays the beams in the air are added along.
      const reach = GLASS.z + D.z * (GLASS.y1 + 0.45) / Math.max(-D.y, 1e-3);
      for (const z of built.zones) for (const m of z.meshes) m.visible = z.north < reach;
      drawReach();
      skyColors(Math.asin(S[1]) * 180 / Math.PI, 0, 0, SKY);
      col.fromArray(SKY.sunLight);
    }
    const l = lamps.value;
    built.land.uniforms.uSun.value.copy(col).multiplyScalar(k);
    built.land.uniforms.uLamp.value.set(1 / Math.max(l.x, 0.05), 1 / Math.max(l.y, 0.05), 1 / Math.max(l.z, 0.05));
    built.land.uniforms.uFog.value = scene.fog?.density || 0;
    built.shaft.uniforms.uShaft.value.copy(col).multiplyScalar(SHAFT * k);
  }

  return {
    tick,
    get on() { return !!built?.group.visible; },
    get k() { return k; },
    get want() { return want; },
    get built() { return !!built; },
    get forced() { return forced; },
    get sun() { return S.slice(); },
  };
}
