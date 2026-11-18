import * as THREE from 'three';
import { material, OUT } from './outside/glsl.js';
import { galilean, PLANET_SCALE } from './pure/scope.js';
import { makeScopeCity } from './scopecity.js';

// What only the telescope shows, fetched the first time someone looks through it: the moon close up, the five bright
// planets where they really are, each a lit disc with its own face (Jupiter's belts and moons, Saturn's rings, the
// phases of Venus), and the city close up (scopecity.js).
const R_PL = 29000;
const KIND = { mercury: 0, venus: 1, mars: 2, jupiter: 3, saturn: 4 };
// How far each quad reaches, in drawn radii: Jupiter's out to Callisto, Saturn's to the edge of its rings.
const REACH = { mercury: 1.04, venus: 1.04, mars: 1.04, jupiter: 7.0, saturn: 2.34 };

const VERTEX = /* glsl */ `
  uniform vec3 uDir, uPole, uLight; uniform float uSize, uReach;
  varying vec2 vUv; varying vec3 vL; varying float vPz;
  void main() {
    vec4 mv = viewMatrix * vec4(cameraPosition + uDir * ${R_PL.toFixed(1)}, 1.0);
    vec3 pv = (viewMatrix * vec4(uPole, 0.0)).xyz;
    float l = length(pv.xy);
    vec2 up = l > 1e-4 ? pv.xy / l : vec2(0.0, 1.0), right = vec2(up.y, -up.x);
    vec3 L = (viewMatrix * vec4(uLight, 0.0)).xyz;
    vL = normalize(vec3(dot(L.xy, right), dot(L.xy, up), L.z));
    vPz = clamp(pv.z, -0.999, 0.999);
    vUv = position.xy * uReach;
    mv.xy += (right * position.x + up * position.y) * uSize * uReach;
    gl_Position = projectionMatrix * mv;
  }`;

// vUv is in drawn radii, x along the equator and y towards the north pole as it falls on the eyepiece; vPz is how far
// that pole leans towards us, vL the sunlight in the same frame.
const FRAGMENT = /* glsl */ `
  uniform vec3 uDir; uniform float uKind, uFlat, uShow; uniform vec4 uMoonX, uMoonZ;
  varying vec2 vUv; varying vec3 vL; varying float vPz;
  float tex(vec2 p) { return texture2D(uNoise, p).r * 0.6 + texture2D(uNoise, p * 2.7 + 0.31).g * 0.4; }
  float band(float x, float a, float b, float s) { return smoothstep(a - s, a + s, x) * (1.0 - smoothstep(b - s, b + s, x)); }
  vec3 face(float lat, float lon) {
    vec3 out_ = vec3(0.0);
    float d = lat / 0.01745;
    float turb = tex(vec2(lon * 0.6 + sin(lat * 18.0) * 0.08, lat * 3.0)) - 0.5;
    if (uKind < 0.5) out_ = vec3(0.34, 0.31, 0.28) * (0.75 + 0.5 * tex(vec2(lon * 0.4, lat * 0.8)));
    else if (uKind < 1.5) out_ = vec3(0.95, 0.9, 0.78) * (0.94 + 0.12 * tex(vec2(lon * 0.15 + lat * 0.3, lat * 1.4)));
    else if (uKind < 2.5) {
      float m = smoothstep(0.42, 0.62, tex(vec2(lon * 0.35, lat * 0.7 + 0.2)));
      vec3 c = mix(vec3(0.78, 0.42, 0.22), vec3(0.42, 0.24, 0.15), m);
      out_ = mix(c, vec3(0.95, 0.94, 0.92), smoothstep(-1.12, -1.2, lat));
    } else if (uKind < 3.5) {
      // The belts and zones: the bright equator, the two dark equatorial belts, the paler tropics, the thin temperate belts.
      float dark = band(d, 7.0, 18.0, 1.5) + band(d, -21.0, -7.0, 1.5) + 0.55 * band(d, 25.0, 33.0, 1.5) + 0.5 * band(d, -36.0, -28.0, 1.5);
      dark = clamp(dark + turb * 0.35 * (0.4 + dark), 0.0, 1.0);
      vec3 c = mix(vec3(0.93, 0.87, 0.74), vec3(0.6, 0.43, 0.31), dark);
      c = mix(c, vec3(0.62, 0.6, 0.58), smoothstep(42.0, 62.0, abs(d)));
      // The Great Red Spot, just south of the south belt, wandering slowly along it.
      vec2 g = vec2(sin(lon - 2.1) * cos(lat) * 3.4, (d + 22.5) / 6.0);
      float spot = smoothstep(1.0, 0.6, length(g)) * step(0.0, cos(lon - 2.1));
      out_ = mix(c, vec3(0.8, 0.46, 0.33), spot * 0.85);
    } else {
      float sb = 0.5 + 0.5 * sin(d * 0.21 + turb * 0.6);
      vec3 c = mix(vec3(0.9, 0.82, 0.6), vec3(0.74, 0.64, 0.46), sb * 0.6);
      out_ = mix(c, vec3(0.6, 0.62, 0.6), smoothstep(55.0, 75.0, abs(d)));
    }
    return out_;
  }
  // Saturn's rings by distance from the centre: the faint C ring, the bright B ring, the Cassini gap, the A ring.
  float rings(float r) {
    return 0.18 * band(r, 1.24, 1.53, 0.01) + 0.95 * band(r, 1.53, 1.95, 0.01) + 0.6 * band(r, 2.03, 2.27, 0.01) * (1.0 - 0.5 * band(r, 2.21, 2.23, 0.004));
  }
  void main() {
    // A little shimmer from the air, as through any real telescope.
    vec2 p = vUv + vec2(sin(uTime * 13.0), cos(uTime * 11.0)) * 0.006;
    vec3 P = vec3(0.0, sqrt(1.0 - vPz * vPz), vPz), F = vec3(0.0, -vPz, sqrt(1.0 - vPz * vPz));
    vec2 q = vec2(p.x, p.y / uFlat);
    float r2 = dot(q, q), aa = max(fwidth(r2) * 1.5, 1e-4);
    vec3 col = vec3(0.0);
    float zFront = -1e3;
    if (r2 < 1.0) {
      vec3 n = vec3(q, sqrt(1.0 - r2));
      zFront = n.z;
      float lat = asin(clamp(dot(n, P), -1.0, 1.0));
      float lon = atan(n.x, dot(n, F));
      float lam = dot(n, vL);
      float lit = smoothstep(-0.04, 0.2, lam) * (0.55 + 0.45 * max(lam, 0.0));
      float limb = 0.5 + 0.5 * pow(n.z, 0.5);
      col = face(lat, lon) * lit * limb * smoothstep(1.0, 1.0 - aa, r2);
    }
    if (uKind > 3.5 && abs(P.z) > 0.002) {
      // Where this line of sight crosses the ring plane, and whether the ball stands in front of it there.
      float t = -(p.y * P.y) / P.z;
      vec3 R = vec3(p, t);
      float rr = length(R), ring = rings(rr);
      if (ring > 0.0 && (r2 >= 1.0 || t > zFront)) {
        vec3 along = R - dot(R, vL) * vL;
        float shade = (dot(R, vL) < 0.0 && dot(along, along) < 1.0) ? 0.08 : 1.0;
        vec3 rc = vec3(0.86, 0.79, 0.64) * ring * shade * (0.55 + 0.45 * abs(dot(P, vL)));
        col = mix(col, rc, clamp(ring * 1.1, 0.0, 0.92));
      }
    }
    if (uKind > 2.5 && uKind < 3.5) {
      // Jupiter's four big moons, on the line of its equator, hidden while behind it.
      for (int i = 0; i < 4; i++) {
        float x = uMoonX[i], z = uMoonZ[i];
        vec2 at = vec2(x, -z * vPz * 0.2);
        float d = length(p - at);
        if (z < 0.0 && abs(x) < 1.0) continue;
        col += vec3(0.95, 0.9, 0.82) * smoothstep(0.11, 0.05, d) * 0.9;
      }
    }
    float c = cloudAt(uDir);
    gl_FragColor = vec4(col * 1.25 * uShow * (1.0 - 0.97 * c) * (1.0 - uFog), 1.0);
    ${OUT}
  }`;

// The moon close up, over the plain one the sky draws (which is dimmed while the telescope is in use): the same size
// and phase, with its seas where the naked-eye moon has them, craters in four sizes lit by the low sun along the
// terminator, and the bright young craters with their rays.
const R_MOON = 29250, MOON_DEG = 0.36;
const MOON_V = /* glsl */ `
  uniform float uSize; varying vec2 vUv; varying vec3 vL;
  void main() {
    vUv = position.xy;
    vL = normalize((viewMatrix * vec4(uMoonLight, 0.0)).xyz);
    vec4 mv = viewMatrix * vec4(cameraPosition + uMoonDir * ${R_MOON.toFixed(1)}, 1.0);
    mv.xy += position.xy * uSize;
    gl_Position = projectionMatrix * mv;
  }`;
const MOON_F = /* glsl */ `
  varying vec2 vUv; varying vec3 vL;
  float blob(vec2 p, vec2 c, float r) { vec2 d = p - c; return exp(-dot(d, d) / (r * r)); }
  // One size of crater: at most one in each cell of a grid laid over the moon's own longitude and latitude, a bowl
  // with a raised rim. Adds its slope (for the light) to g and returns a little extra brightness for fresh ones.
  float craters(vec2 p, float cells, float seed, float keep, inout vec2 g) {
    vec2 q = p * cells, c = floor(q), f = fract(q) - 0.5;
    if (hash13(vec3(c, seed)) > keep) return 0.0;
    vec2 o = (vec2(hash13(vec3(c, seed + 1.0)), hash13(vec3(c, seed + 2.0))) - 0.5) * 0.28;
    float rad = 0.16 + 0.2 * hash13(vec3(c, seed + 3.0));
    vec2 d = (f - o) / rad;
    float l = length(d);
    if (l < 1.0) g += 0.55 * d;
    else if (l < 1.7) g += -0.5 * exp(-(l - 1.0) * (l - 1.0) / 0.06) * (l - 1.0) / 0.06 * d / l * 0.35;
    return step(0.93, hash13(vec3(c, seed + 4.0))) * smoothstep(1.4, 0.8, l);
  }
  // A young crater: a bright floor and rays thrown out across everything round it.
  float rays(vec2 p, vec2 c, float r, float reach) {
    vec2 d = p - c; float l = length(d), a = atan(d.y, d.x);
    float streak = pow(abs(sin(a * 7.0 + sin(a * 3.0) * 1.3)), 6.0) + pow(abs(sin(a * 11.0 + 1.7)), 12.0) * 0.6;
    return smoothstep(r * 1.3, r * 0.6, l) * 0.7 + streak * smoothstep(reach, r, l) * smoothstep(r * 0.8, r * 1.6, l) * 0.35;
  }
  void main() {
    float r2 = dot(vUv, vUv);
    if (r2 > 1.0) discard;
    vec3 n = vec3(vUv, sqrt(1.0 - r2));
    vec2 ll = vec2(atan(n.x, n.z), asin(clamp(n.y, -1.0, 1.0)));
    float maria = blob(vUv, vec2(-0.32, 0.42), 0.3) + blob(vUv, vec2(0.2, 0.36), 0.17) + blob(vUv, vec2(0.36, 0.1), 0.2)
      + blob(vUv, vec2(0.68, 0.3), 0.11) + blob(vUv, vec2(-0.6, 0.0), 0.33) + blob(vUv, vec2(-0.18, -0.36), 0.18)
      + blob(vUv, vec2(0.55, -0.12), 0.14) + blob(vUv, vec2(0.38, -0.27), 0.1) + blob(vUv, vec2(-0.05, 0.72), 0.12) * 0.6;
    float tex = texture2D(uNoise, vUv * 0.7 + 0.3).g * 0.6 + texture2D(uNoise, vUv * 2.3).b * 0.4;
    float sea = smoothstep(0.45, 0.75, maria * (0.75 + 0.5 * tex));
    vec2 g = vec2(0.0);
    // The seas are smooth lava: fewer and smaller craters there.
    float fresh = craters(ll, 7.0, 1.0, 0.5 - 0.35 * sea, g) + craters(ll, 15.0, 7.0, 0.55 - 0.3 * sea, g)
      + craters(ll, 31.0, 13.0, 0.6 - 0.25 * sea, g) + craters(ll, 63.0, 19.0, 0.6 - 0.2 * sea, g);
    float young = rays(vUv, vec2(-0.14, -0.72), 0.035, 0.75) + rays(vUv, vec2(-0.28, 0.17), 0.04, 0.42) * 0.8
      + rays(vUv, vec2(-0.52, 0.12), 0.022, 0.25) * 0.6 + rays(vUv, vec2(-0.62, 0.38), 0.016, 0.18);
    float alb = mix(0.2, 0.09, sea) * (0.82 + 0.36 * texture2D(uNoise, ll * 1.9).r) + 0.1 * fresh + 0.13 * young;
    vec3 nn = normalize(n + vec3(-g.x * 0.25, -g.y * 0.25, 0.0));
    float lam = dot(nn, vL), edge = smoothstep(1.0, 1.0 - 2.5 * fwidth(r2), r2);
    float lit = smoothstep(-0.02, 0.12, lam) * (0.35 + 0.65 * max(lam, 0.0));
    float c = cloudAt(uMoonDir);
    vec3 col = vec3(1.0, 0.97, 0.92) * alb * (lit * 3.6 + 0.012) * uMoonK;
    gl_FragColor = vec4(col * edge * (1.0 - 0.97 * c) * (1.0 - uFog), 1.0);
    ${OUT}
  }`;

// New shaders are built off the main thread where the browser can (so the first look through does not freeze): the
// things are shown to the renderer for a moment to collect them, and stay hidden until it says they are ready. Each is
// built twice, for drawing straight to the screen and into the effects' buffer (the higher qualities), which differ.
async function prepare(renderer, outside, things) {
  if (!renderer?.compileAsync) return;
  const was = things.map(o => o.visible), prev = renderer.getRenderTarget(), buffer = new THREE.WebGLRenderTarget(1, 1);
  for (const o of things) o.visible = true;
  const ready = [renderer.compileAsync(outside.scene, outside.camera)];
  renderer.setRenderTarget(buffer);
  ready.push(renderer.compileAsync(outside.scene, outside.camera));
  renderer.setRenderTarget(prev);
  things.forEach((o, i) => { o.visible = was[i]; });
  await Promise.all(ready).catch(() => {});
  buffer.dispose();
}

export function makeScopeKit({ outside, renderer }) {
  const U = outside.U, group = new THREE.Group(), geo = new THREE.PlaneGeometry(2, 2), planets = {};
  for (const [id, kind] of Object.entries(KIND)) {
    const m = new THREE.Mesh(geo, material(U, {
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uDir: { value: new THREE.Vector3(0, 1, 0) }, uPole: { value: new THREE.Vector3(0, 1, 0) }, uLight: { value: new THREE.Vector3(1, 0, 0) },
        uSize: { value: 1 }, uReach: { value: REACH[id] }, uKind: { value: kind }, uFlat: { value: 1 }, uShow: { value: 0 },
        uMoonX: { value: new THREE.Vector4(9, 9, 9, 9) }, uMoonZ: { value: new THREE.Vector4(1, 1, 1, 1) },
      },
      vertex: VERTEX, fragment: FRAGMENT,
    }));
    m.frustumCulled = false; m.renderOrder = 2; m.visible = false;
    group.add(m); planets[id] = m;
  }
  const moon = new THREE.Mesh(geo, material(U, {
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uSize: { value: R_MOON * Math.tan(MOON_DEG * Math.PI / 180) } }, vertex: MOON_V, fragment: MOON_F,
  }));
  moon.frustumCulled = false; moon.renderOrder = 3; moon.visible = false;
  group.add(moon);
  outside.extras.add(group);
  let on = false, city = null, ready = false;
  prepare(renderer, outside, [moon, ...Object.values(planets)]).then(() => { ready = true; });
  makeScopeCity({ outside }).then(async c => { await prepare(renderer, outside, [c.group]); city = c; city.show(on); }).catch(e => console.warn('[loft] the close-up city could not be built', e));
  // The sky's own moon steps aside while the close-up one is drawn (a rebuild brings a fresh one back at full).
  const plainMoon = v => { const m = outside.parts?.sky?.moon?.material?.uniforms?.uBright; if (m) m.value = v; };
  return {
    get city() { return city; },
    show(v) {
      on = v;
      city?.show(v);
      U.uScope.value = v ? 1 : 0;
      plainMoon(v ? 0 : 1);
      if (!v) { moon.visible = false; for (const m of Object.values(planets)) m.visible = false; }
    },
    // `list` from pure/scope.js planets(); each shows only while the telescope is in use and it is really up.
    update(list, date, active) {
      if (active !== on || active) this.show(active);
      moon.visible = ready && on && U.uMoonK.value > 0;
      for (const p of list) {
        const m = planets[p.id];
        if (!m) continue;
        m.visible = ready && on && p.shows;
        if (!m.visible) continue;
        const u = m.material.uniforms;
        u.uDir.value.set(...p.dir); u.uPole.value.set(...p.pole); u.uLight.value.set(...p.light);
        u.uSize.value = R_PL * Math.tan(p.radius * PLANET_SCALE);
        u.uFlat.value = p.flat;
        // Fades in as it climbs out of the murk on the horizon.
        u.uShow.value = Math.min(1, Math.max(0, (p.el - 1.5) / 3));
        if (p.id === 'jupiter') {
          const moons = galilean(date);
          u.uMoonX.value.set(...moons.map(g => (g.r * Math.sin(g.u)) / PLANET_SCALE));
          u.uMoonZ.value.set(...moons.map(g => Math.cos(g.u)));
        }
      }
    },
    dispose() {
      this.show(false);
      group.removeFromParent();
      geo.dispose();
      moon.material.dispose();
      for (const m of Object.values(planets)) m.material.dispose();
      city?.dispose();
    },
  };
}
