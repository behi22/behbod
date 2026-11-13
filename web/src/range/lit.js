import * as THREE from 'three';

// How everything at the range is lit. The house shows baked pictures; the range's surfaces, guns and targets are real
// materials under real light, so they share one exposure, one film curve and one haze, set here.
export const U = {
  exposure: { value: 0.9 }, tone: { value: 1 },
  haze: { value: new THREE.Color(0.012, 0.016, 0.024) }, hazeK: { value: 0.011 },
  // The hall as a box and where its reflection was taken from (see rangeProject); an empty box leaves reflections as they are.
  boxMin: { value: new THREE.Vector3(1, 1, 1) }, boxMax: { value: new THREE.Vector3(-1, -1, -1) }, probe: { value: new THREE.Vector3() },
};

const HEAD = `
uniform float uExposure, uTone, uHazeK; uniform vec3 uHaze, uBoxMin, uBoxMax, uProbe;
// The room's reflection is one look around from the firing line. Used as it is, a patch of floor far down the hall
// would mirror what is over the firing line; this follows the reflected ray to the hall's wall or ceiling and looks
// that way from where the picture was taken, so the floor mirrors the lights that are really above it.
vec3 rangeProject(vec3 dir) {
  vec3 pos = cameraPosition + (vec4(-vViewPosition, 0.0) * viewMatrix).xyz;
  if (any(lessThan(pos, uBoxMin)) || any(greaterThan(pos, uBoxMax))) return dir;
  vec3 t3 = (mix(uBoxMin, uBoxMax, step(0.0, dir)) - pos) / (dir + step(abs(dir), vec3(1e-5)) * 1e-5);
  return normalize(pos + dir * min(min(t3.x, t3.y), t3.z) - uProbe);
}
// A film curve (Narkowicz's fit of ACES): bright light rolls off to white instead of clipping.
vec3 rangeTone(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }`;
const TAIL = `
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, 1.0 - exp(-length(vViewPosition) * uHazeK));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, rangeTone(gl_FragColor.rgb * uExposure), uTone);`;
// A baked surface's soft light is its lightmap, stored squeezed as x / (1 + x); the reflections around it still come
// from the room's picture, but that picture's soft light would count the same light twice, so it is left out.
const MAPS = THREE.ShaderChunk.lights_fragment_maps, ENV = THREE.ShaderChunk.envmap_physical_pars_fragment;
const TURNED = 'reflectVec = inverseTransformDirection( reflectVec, viewMatrix );';
const BOXED_ENV = ENV.replace(TURNED, TURNED + ' reflectVec = rangeProject( reflectVec );');
const SQUEEZED = 'lightMapTexel.rgb * lightMapIntensity', TWICE = 'iblIrradiance += getIBLIrradiance( geometryNormal );';
const BAKED_MAPS = MAPS.replace(SQUEEZED, '( lightMapTexel.rgb / max( 1.0 - lightMapTexel.rgb, 0.02 ) ) * lightMapIntensity').replace(TWICE, '');
// If a newer three words these lines differently the look would change without a sound; say so instead.
export const patched = MAPS.includes(SQUEEZED) && MAPS.includes(TWICE) && ENV.includes(TURNED);
if (!patched) console.warn('[range] three\'s lighting shaders have changed; the range will look wrong');

// Makes a standard material one of the range's: its exposure, film curve and haze, and for a baked surface its
// lightmap read the range's way.
export function lit(material, baked = false) {
  material.fog = false;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { uExposure: U.exposure, uTone: U.tone, uHaze: U.haze, uHazeK: U.hazeK, uBoxMin: U.boxMin, uBoxMax: U.boxMax, uProbe: U.probe });
    let fs = shader.fragmentShader.replace('#include <common>', '#include <common>' + HEAD).replace('#include <tonemapping_fragment>', TAIL)
      .replace('#include <envmap_physical_pars_fragment>', BOXED_ENV);
    if (baked) fs = fs.replace('#include <lights_fragment_maps>', BAKED_MAPS);
    shader.fragmentShader = fs;
  };
  material.customProgramCacheKey = () => (baked ? 'range-baked' : 'range-lit');
  return material;
}

// ---------- surface detail, drawn here instead of downloaded ----------
// Smooth noise that repeats at the picture's edges, so the picture tiles.
function tileNoise(size, cells, seed) {
  const grid = new Float32Array(cells * cells);
  let a = seed >>> 0;
  for (let i = 0; i < grid.length; i++) { a = (a * 1664525 + 1013904223) >>> 0; grid[i] = a / 4294967296; }
  const out = new Float32Array(size * size), k = cells / size;
  for (let y = 0; y < size; y++) {
    const fy = y * k, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty), r0 = (y0 % cells) * cells, r1 = ((y0 + 1) % cells) * cells;
    for (let x = 0; x < size; x++) {
      const fx = x * k, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx), c0 = x0 % cells, c1 = (x0 + 1) % cells;
      out[y * size + x] = (grid[r0 + c0] * (1 - sx) + grid[r0 + c1] * sx) * (1 - sy) + (grid[r1 + c0] * (1 - sx) + grid[r1 + c1] * sx) * sy;
    }
  }
  return out;
}
function layers(size, seed, octaves) {
  const out = new Float32Array(size * size);
  let total = 0;
  for (const [cells, weight] of octaves) { const n = tileNoise(size, cells, seed + cells * 31); for (let i = 0; i < out.length; i++) out[i] += n[i] * weight; total += weight; }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}
function picture(size, paint, colour) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) { const p = paint(i); img.data[i * 4] = p[0]; img.data[i * 4 + 1] = p[1]; img.data[i * 4 + 2] = p[2]; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}
// The slope of a height field as a normal map.
function normals(size, height, strength) {
  return picture(size, i => {
    const x = i % size, y = (i - x) / size;
    const dx = height[y * size + (x + 1) % size] - height[y * size + (x + size - 1) % size], dy = height[((y + 1) % size) * size + x] - height[((y + size - 1) % size) * size + x];
    const nx = -dx * strength, ny = -dy * strength, l = Math.hypot(nx, ny, 1);
    return [(nx / l * 0.5 + 0.5) * 255, (ny / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255];
  }, false);
}

// The three kinds of surface detail: `map` tints the colour, `rough` (its green channel) scales the roughness,
// `normal` roughens the surface. Each is a picture of `size` pixels that repeats every `metres`. Drawing them is
// the heaviest sum in making the rooms ready, so `pause` (if given) is awaited between the kinds.
export async function makeDetail(size = 256, pause) {
  // Poured concrete and paint: slow mottling, fine pores.
  const slow = layers(size, 11, [[4, 1], [9, 0.6], [22, 0.3]]), fine = layers(size, 23, [[40, 1], [90, 0.5]]);
  const mottle = {
    metres: 3.2,
    map: picture(size, i => { const v = 255 * (0.78 + 0.22 * slow[i] + 0.03 * (fine[i] - 0.5)); return [v, v, v]; }, true),
    rough: picture(size, i => { const v = 255 * Math.min(1, 0.8 + 0.2 * slow[i]); return [v, v, v]; }, false),
    normal: normals(size, fine.map((v, i) => v * 0.3 + slow[i] * 0.7), 0.6),
  };
  await pause?.();
  // A sealed floor: polished where it is walked on, duller in patches.
  const wear = layers(size, 37, [[3, 1], [7, 0.7], [16, 0.35]]);
  const floor = {
    metres: 4.5,
    map: picture(size, i => { const v = 255 * (0.82 + 0.18 * wear[i]); return [v, v, v]; }, true),
    rough: picture(size, i => { const v = 255 * Math.min(1, 0.5 + 0.9 * Math.pow(wear[i], 1.5)); return [v, v, v]; }, false),
    normal: normals(size, wear, 0.5),
  };
  await pause?.();
  // Brushed steel: fine streaks one way.
  const streak = new Float32Array(size * size), lines = tileNoise(size, size / 2, 5), drift = tileNoise(size, 8, 9);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) streak[y * size + x] = lines[y * size] * 0.75 + drift[y * size + x] * 0.25;
  const brushed = {
    metres: 0.6,
    map: picture(size, i => { const v = 255 * (0.88 + 0.12 * streak[i]); return [v, v, v]; }, true),
    rough: picture(size, i => { const v = 255 * (0.7 + 0.3 * streak[i]); return [v, v, v]; }, false),
    normal: normals(size, streak, 0.5),
  };
  for (const d of [mottle, floor, brushed]) for (const t of [d.map, d.rough, d.normal]) t.repeat.setScalar(1 / d.metres);
  return { mottle, floor, brushed };
}
