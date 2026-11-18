import * as THREE from 'three';
import { material, OUT } from './outside/glsl.js';
import { unitBox } from './outside/city.js';
import { houseLots, houseOn, towerGrid, yardTrees } from './pure/scope.js';
import { rng } from './pure/outside.js';

// Built on the first look only: balcony slabs on the glass towers, North Shore houses and garden trees.

// How many houses each quality of the world outside draws, nearest first.
const HOUSES = { low: 3500, medium: 7000, high: 10000 };

const SLAB_V = /* glsl */ `
  varying vec3 vWp, vN;
  void main() {
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWp = wp.xyz; vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const SLAB_F = /* glsl */ `
  varying vec3 vWp, vN;
  void main() {
    vec3 n = normalize(vN);
    vec3 alb = vec3(0.6, 0.6, 0.58) * (n.y < -0.5 ? 0.45 : 1.0);
    vec3 col = alb * (uSunCol * max(dot(n, uSunDir), 0.0) + uAmbient * (0.55 + 0.45 * n.y) + uMoonAmb * 0.6);
    // The underside catches the light of the rooms below it after dark.
    col += vec3(0.05, 0.035, 0.02) * uNight * uWinFrac * step(n.y, -0.5);
    gl_FragColor = vec4(applyHaze(col, vWp), 1.0);
    ${OUT}
  }`;

// A unit house; y is a code (0 foot, 1 eaves, 2 ridge) the vertex shader turns into each house's own metres.
const HOUSE_V = /* glsl */ `
  attribute vec4 aAt, aSize; attribute float aPaint;
  varying vec3 vWp, vN; varying vec2 vFace; varying float vPaint, vRoof, vWall;
  void main() {
    float y = position.y < 0.5 ? -6.0 : position.y < 1.5 ? aSize.z : aSize.z + aSize.w;
    vRoof = step(0.5, normal.y);
    vec3 lp = vec3(position.x * aSize.x, y, position.z * aSize.y);
    vec3 ln = vRoof > 0.5 ? normalize(vec3(0.0, aSize.y * 0.5, sign(normal.z) * aSize.w)) : normal;
    float c = cos(aAt.w), s = sin(aAt.w);
    vec3 wp = vec3(aAt.x + c * lp.x + s * lp.z, aAt.y + lp.y, aAt.z - s * lp.x + c * lp.z);
    vN = vec3(c * ln.x + s * ln.z, ln.y, -s * ln.x + c * ln.z);
    vFace = vec2(abs(normal.x) > 0.5 ? lp.z : lp.x, lp.y);
    vWp = wp; vPaint = aPaint; vWall = aSize.z;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }`;
const HOUSE_F = /* glsl */ `
  varying vec3 vWp, vN; varying vec2 vFace; varying float vPaint, vRoof, vWall;
  void main() {
    vec3 n = normalize(vN);
    float h1 = fract(vPaint * 13.7), h2 = fract(vPaint * 71.3);
    vec3 wall = h1 < 0.3 ? vec3(0.5, 0.5, 0.47) : h1 < 0.5 ? vec3(0.36, 0.35, 0.32) : h1 < 0.62 ? vec3(0.25, 0.27, 0.28)
      : h1 < 0.72 ? vec3(0.27, 0.29, 0.25) : h1 < 0.9 ? vec3(0.17, 0.13, 0.1) : vec3(0.33, 0.27, 0.23);
    vec3 roof = h2 < 0.45 ? vec3(0.07, 0.075, 0.08) : h2 < 0.7 ? vec3(0.13, 0.1, 0.08) : h2 < 0.85 ? vec3(0.06, 0.07, 0.06) : vec3(0.17, 0.17, 0.16);
    roof = mix(roof, vec3(0.8, 0.82, 0.86), smoothstep(uSnowLine, uSnowLine + 120.0, vWp.y - WATER_Y));
    float win = 0.0, lit = 0.0;
    if (vRoof < 0.5) {
      vec2 g = vec2(vFace.x / 3.2 + 0.5, (vFace.y - 0.4) / 2.8), f = fract(g), cell = floor(g);
      win = step(abs(f.x - 0.5), 0.2) * step(abs(f.y - 0.58), 0.2) * step(0.6, vFace.y) * step(vFace.y, vWall - 0.5);
      lit = step(hash13(vec3(cell, vPaint * 91.0)), uWinFrac * 1.4);
    }
    vec3 alb = vRoof > 0.5 ? roof : mix(wall, vec3(0.03, 0.035, 0.04), win * 0.85);
    vec3 diffuse = uSunCol * max(dot(n, uSunDir), 0.0) + uAmbient * (0.55 + 0.45 * n.y) + uMoonAmb * 0.6;
    vec3 col = alb * diffuse * mix(0.6, 1.0, smoothstep(-1.0, 2.0, vFace.y));
    col += vec3(1.0, 0.68, 0.38) * win * lit * uNight * 0.55;
    gl_FragColor = vec4(applyHaze(col, vWp), 1.0);
    ${OUT}
  }`;

// Garden trees: one rough ball, drawn tall and pointed for a fir or round for a broadleaf, which turns with the season.
const TREE_V = /* glsl */ `
  attribute vec4 aTree; attribute float aKind;
  varying vec3 vWp, vN; varying float vKind, vTint;
  void main() {
    vec3 p = position;
    float fir = 1.0 - aKind;
    p.xz *= mix(1.0, mix(1.0, 0.12, (p.y + 1.0) * 0.5), fir);
    p *= vec3(mix(3.6, 2.6, fir), mix(3.2, 7.0, fir), mix(3.6, 2.6, fir)) * aTree.w;
    vec3 wp = aTree.xyz + vec3(p.x, p.y + mix(5.0, 6.5, fir) * aTree.w, p.z);
    vN = normalize(normal * vec3(1.0, mix(1.0, 0.45, fir), 1.0));
    vWp = wp; vKind = aKind; vTint = fract(aTree.x * 0.37 + aTree.z * 0.61);
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }`;
const TREE_F = /* glsl */ `
  varying vec3 vWp, vN; varying float vKind, vTint;
  void main() {
    vec3 n = normalize(vN);
    vec3 fir = mix(vec3(0.018, 0.034, 0.022), vec3(0.03, 0.05, 0.03), vTint);
    vec3 leaf = mix(vec3(0.05, 0.08, 0.03), mix(vec3(0.11, 0.075, 0.02), vec3(0.08, 0.05, 0.03), vTint), uSeason * step(0.3, vTint));
    vec3 alb = mix(fir, leaf, vKind) * (0.75 + 0.5 * texture2D(uNoise, vWp.xz / 3.0 + vWp.y / 2.0).a);
    vec3 col = alb * (uSunCol * max(dot(n, uSunDir), 0.0) + uAmbient * (0.5 + 0.5 * n.y) + uMoonAmb);
    gl_FragColor = vec4(applyHaze(col, vWp), 1.0);
    ${OUT}
  }`;

function houseShape() {
  const pos = [], nrm = [];
  const tri = (a, b, c, n) => { pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) nrm.push(...n); };
  const quad = (a, b, c, d, n) => { tri(a, b, c, n); tri(a, c, d, n); };
  const o = 0.56;
  for (const s of [-1, 1]) {
    quad([-0.5, 0, s * 0.5], [0.5, 0, s * 0.5], [0.5, 1, s * 0.5], [-0.5, 1, s * 0.5], [0, 0, s]);
    quad([s * 0.5, 0, -0.5], [s * 0.5, 0, 0.5], [s * 0.5, 1, 0.5], [s * 0.5, 1, -0.5], [s, 0, 0]);
    tri([s * 0.5, 1, -0.5], [s * 0.5, 1, 0.5], [s * 0.5, 2, 0], [s, 0, 0]);
    quad([-o, 1, s * o], [o, 1, s * o], [o, 2, 0], [-o, 2, 0], [0, 1, s]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return g;
}

function makeSlabs(U, towers) {
  // The same towers the facade paints rails on: glass, and most of them (by their seed).
  const list = towers.filter(t => !t.own && t.style === 0 && t.seed < 0.85);
  let n = 0;
  for (const t of list) n += Math.floor((t.h - 0.5) / 3);
  const mesh = new THREE.InstancedMesh(unitBox(), material(U, { vertex: SLAB_V, fragment: SLAB_F }), Math.max(1, n));
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 0.3, 1), Y = new THREE.Vector3(0, 1, 0);
  let i = 0;
  for (const t of list) {
    Q.setFromAxisAngle(Y, t.rot || 0);
    S.set(t.w + 3, 0.3, t.d + 3);
    // On the line the facade paints as each floor's slab: the top sixth of every 3 m storey.
    for (let k = 0; k < Math.floor((t.h - 0.5) / 3); k++) mesh.setMatrixAt(i++, M.compose(P.set(t.x, t.base + k * 3 + 2.61, t.z), Q, S));
  }
  mesh.count = i;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

// The houses take a few frames to lay out, a slice at a time, so the first look through never stalls.
async function makeHouses(U, towers, count) {
  const lots = houseLots(), grid = towerGrid(towers), rand = rng(3), out = [], trees = [];
  let t0 = performance.now();
  for (const lot of lots) {
    if (out.length >= count) break;
    const h = houseOn(lot, rand, grid);
    if (h) out.push(h);
    if (h !== null) trees.push(...yardTrees(lot, h, rand));
    if (performance.now() - t0 > 6) { await new Promise(r => setTimeout(r, 0)); t0 = performance.now(); }
  }
  const shape = houseShape(), geo = new THREE.InstancedBufferGeometry().copy(shape);
  shape.dispose();
  const at = new Float32Array(out.length * 4), size = new Float32Array(out.length * 4), paint = new Float32Array(out.length);
  out.forEach(([x, y, z, w, d, wall, roof, turn, p], i) => { at.set([x, y, z, turn], i * 4); size.set([w, d, wall, roof], i * 4); paint[i] = p; });
  geo.setAttribute('aAt', new THREE.InstancedBufferAttribute(at, 4));
  geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 4));
  geo.setAttribute('aPaint', new THREE.InstancedBufferAttribute(paint, 1));
  geo.instanceCount = out.length;
  const mesh = new THREE.Mesh(geo, material(U, { vertex: HOUSE_V, fragment: HOUSE_F, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  const ball = new THREE.IcosahedronGeometry(1, 0), tg = new THREE.InstancedBufferGeometry().copy(ball);
  ball.dispose();
  const ta = new Float32Array(trees.length * 4), tk = new Float32Array(trees.length);
  trees.forEach(([x, y, z, size, kind], i) => { ta.set([x, y, z, size], i * 4); tk[i] = kind; });
  tg.setAttribute('aTree', new THREE.InstancedBufferAttribute(ta, 4));
  tg.setAttribute('aKind', new THREE.InstancedBufferAttribute(tk, 1));
  tg.instanceCount = trees.length;
  const wood = new THREE.Mesh(tg, material(U, { vertex: TREE_V, fragment: TREE_F }));
  wood.frustumCulled = false;
  return [mesh, wood];
}

export async function makeScopeCity({ outside }) {
  const U = outside.U, group = new THREE.Group();
  group.visible = false;
  group.add(makeSlabs(U, outside.towers));
  outside.extras.add(group);
  const [houses, trees] = await makeHouses(U, outside.towers, HOUSES[outside.quality] || HOUSES.medium);
  group.add(houses, trees);
  return {
    group,
    get houses() { return houses.geometry.instanceCount; },
    get trees() { return trees.geometry.instanceCount; },
    get slabs() { return group.children[0].count; },
    show(on) { group.visible = on; },
    dispose() {
      group.removeFromParent();
      for (const m of group.children) { m.geometry.dispose(); m.material.dispose(); if (m.isInstancedMesh) m.dispose(); }
    },
  };
}
