import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { b2t } from '../engine.js';

// Placed in Blender's axes (x east, y north, z up), like the rest of the world file.
export const B = (x, y, z) => b2t(x, y, z);

export function drawn(w, h, draw, scale = 1) {
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale); c.height = Math.round(h * scale);
  const g = c.getContext('2d');
  g.scale(scale, scale);
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.userData.redraw = fn => { g.setTransform(scale, 0, 0, scale, 0, 0); g.clearRect(0, 0, w, h); fn(g, w, h); t.needsUpdate = true; };
  return t;
}

export function glowText(g, text, x, y, px, { weight = 800, blur = 0.22, font = 'system-ui, "Segoe UI", Arial, sans-serif', align = 'center', colour = '#ffffff' } = {}) {
  g.save();
  g.font = `${weight} ${px}px ${font}`;
  g.textAlign = align; g.textBaseline = 'middle';
  g.shadowColor = colour; g.fillStyle = colour;
  for (const [b, a] of [[px * blur, 0.9], [px * blur * 0.4, 1]]) { g.shadowBlur = b; g.globalAlpha = a; g.fillText(text, x, y); }
  g.restore();
}

export function box(w, d, h, at, turn = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (turn) g.rotateY(turn);
  return g.translate(...B(...at).toArray());
}
// `face`: '+y' looks north (toward the house), '-y' downrange, '+x' east, '-x' west.
export function card(w, h, at, face) {
  const g = new THREE.PlaneGeometry(w, h), turn = { '+y': Math.PI, '-y': 0, '+x': Math.PI / 2, '-x': -Math.PI / 2 }[face];
  g.rotateY(turn);
  return g.translate(...B(...at).toArray());
}

// One mesh per material: a few draw calls for a whole set.
export function batch() {
  const parts = new Map();
  return {
    add(material, ...geos) { if (!parts.has(material)) parts.set(material, []); parts.get(material).push(...geos); return this; },
    build(parent, name) {
      const meshes = [];
      for (const [material, geos] of parts) {
        const merged = mergeGeometries(geos.map(g => (g.index ? g.toNonIndexed() : g)));
        for (const g of geos) g.dispose();
        const m = new THREE.Mesh(merged, material);
        m.name = name; m.matrixAutoUpdate = false;
        parent.add(m); meshes.push(m);
      }
      parts.clear();
      return meshes;
    },
  };
}

let beamPic = null;
export function beamTexture() {
  return beamPic ||= drawn(128, 64, (g, w, h) => {
    const along = g.createLinearGradient(0, 0, w, 0);
    along.addColorStop(0, 'rgba(255,255,255,1)'); along.addColorStop(0.35, 'rgba(255,255,255,0.45)'); along.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = along; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-in';
    const across = g.createLinearGradient(0, 0, 0, h);
    across.addColorStop(0, 'rgba(0,0,0,0)'); across.addColorStop(0.5, 'rgba(0,0,0,1)'); across.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = across; g.fillRect(0, 0, w, h);
  });
}
export const additive = (color, map, opacity = 1) => new THREE.MeshBasicMaterial({ color, map, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false });
