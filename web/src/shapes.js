import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Shared helpers for the things built in code (the residents, the ships): simple shapes moved into place, painted with
// soft light from above (the room is baked and unlit, so these are too) and merged into one mesh each.
const E = new THREE.Euler(), Q = new THREE.Quaternion(), M4 = new THREE.Matrix4(), V = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color();

// `color` is a hex, or fn(x, y, z) giving one. `light` (0 to 1): how much the soft top light shades it.
export function piece(geo, color, at = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], light = 1) {
  geo.deleteAttribute('uv');
  geo.applyMatrix4(M4.compose(V.set(...at), Q.setFromEuler(E.set(...rot)), S.set(...scale)));
  const p = geo.attributes.position, n = geo.attributes.normal, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    C.set(typeof color === 'function' ? color(p.getX(i), p.getY(i), p.getZ(i)) : color);
    const k = 1 - light * (1 - (0.5 + 0.35 * (0.5 + 0.5 * n.getY(i))));
    c[i * 3] = C.r * k; c[i * 3 + 1] = C.g * k * 0.98; c[i * 3 + 2] = C.b * k * 0.95;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
export const PAINT = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
// Lights and screens: full colour, no shading.
export const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
export function mesh(pieces, mat, parent) {
  // Indexed and non-indexed shapes cannot merge together, so everything is merged as non-indexed.
  const geos = pieces.map(g => (g.index ? g.toNonIndexed() : g));
  const m = new THREE.Mesh(mergeGeometries(geos), mat || PAINT);
  if (parent) parent.add(m);
  return m;
}
export const sph = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
export const cyl = (a, b, h, n = 14) => new THREE.CylinderGeometry(a, b, h, n);
export const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
export const rbox = (x, y, z, r, seg = 3) => new RoundedBoxGeometry(x, y, z, seg, r);
export const torus = (r, t, a = 12, b = 24) => new THREE.TorusGeometry(r, t, a, b);
