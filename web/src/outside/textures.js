import * as THREE from 'three';
import { tileNoise } from '../pure/outside.js';

function dataTex(data, w, h, { repeat = true, mips = true } = {}) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.generateMipmaps = mips;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

export function noiseTexture(size = 256) {
  const bands = [tileNoise(size, 4, 5, 1), tileNoise(size, 8, 4, 2), tileNoise(size, 16, 3, 3), tileNoise(size, 32, 2, 4)];
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) for (let c = 0; c < 4; c++) data[i * 4 + c] = Math.round(bands[c][i] * 255);
  return dataTex(data, size, size);
}

// Wave slopes in red and green (0.5 is flat), height in blue.
export function waveTexture(size = 256) {
  const h = tileNoise(size, 5, 4, 9), data = new Uint8Array(size * size * 4);
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = (at(x + 1, y) - at(x - 1, y)) * size * 0.022, gy = (at(x, y + 1) - at(x, y - 1)) * size * 0.022;
      const i = (y * size + x) * 4;
      data[i] = Math.round(Math.max(0, Math.min(1, 0.5 + gx)) * 255);
      data[i + 1] = Math.round(Math.max(0, Math.min(1, 0.5 + gy)) * 255);
      data[i + 2] = Math.round(at(x, y) * 255);
      data[i + 3] = 255;
    }
  }
  return dataTex(data, size, size);
}

// Per azimuth: skyline elevation, distance, tower or not.
export function silhouetteTexture(sil) {
  const n = sil.el.length, data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    data[i * 4] = Math.round(Math.max(0, Math.min(1, (sil.el[i] + 0.02) / 0.3)) * 255);
    data[i * 4 + 1] = Math.round(Math.max(0, Math.min(1, Math.log(Math.max(sil.dist[i], 100) / 100) / Math.log(300))) * 255);
    data[i * 4 + 2] = Math.round(sil.tower[i] * 255);
    data[i * 4 + 3] = 255;
  }
  const t = dataTex(data, n, 1, { mips: false });
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
