import * as THREE from 'three';

// A knit's surface for the sleeve and ribs for the cuff, drawn here: a little picture whose slopes are the normals.
function knitNormal(rib) {
  const N = 64, c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N);
  const h = (x, y) => rib ? Math.sin(x / N * Math.PI * 2 * 8) : Math.sin(x / N * Math.PI * 2 * 12) * 0.5 + Math.abs(Math.sin((y / N + 0.5 * Math.abs(Math.sin(x / N * Math.PI * 12))) * Math.PI * 16)) * 0.7;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1), k = rib ? 0.9 : 0.6, l = Math.hypot(dx * k, dy * k, 1), i = (y * N + x) * 4;
    img.data[i] = (-dx * k / l * 0.5 + 0.5) * 255; img.data[i + 1] = (-dy * k / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rib ? 3 : 4, rib ? 1 : 6);
  return t;
}

// The hoodie's knit for the sleeves over my hands at the range.
export function makeSleeveMaterials(prepare = m => m) {
  const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
  return {
    cloth: prepare(new THREE.MeshStandardMaterial({ name: 'M_Hoodie', color: lin(0.04, 0.055, 0.11), roughness: 0.9, metalness: 0, normalMap: knitNormal(false), normalScale: new THREE.Vector2(0.35, 0.35) })),
    rib: prepare(new THREE.MeshStandardMaterial({ name: 'M_Hoodie_Rib', color: lin(0.035, 0.05, 0.1), roughness: 0.92, metalness: 0, normalMap: knitNormal(true), normalScale: new THREE.Vector2(0.8, 0.8) })),
  };
}
