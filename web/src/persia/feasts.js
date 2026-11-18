import * as THREE from 'three';
import { makeKit, paint, paperMaterial } from './kit.js';

// Fetched only on its days or a ?holiday= preview. Blender positions in, three's axes out.
const P = (x, y, z) => [x, z, -y];
const rnd = seed => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

function texture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// A cloth over the table: its top and four short drops, with the picture `tex` spread over it.
function cloth(table, tex, drop = 0.07) {
  const [cx, cy, top] = table.center, [w, d] = table.size, W = w + 0.04, D = d + 0.04;
  const geo = new THREE.BoxGeometry(W, drop, D);
  geo.translate(...P(cx, cy, top + 0.002 - drop / 2));
  const g = geo.toNonIndexed();
  paint(g, '#ffffff', n => (n.y > 0.5 ? 1 : 0.7));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, vertexColors: true }));
  m.name = 'feast_cloth';
  return m;
}
// Small flames that flicker; their colour is past white so the bloom takes them.
function flames(spots) {
  const geo = new THREE.SphereGeometry(1, 8, 6);
  geo.scale(0.008, 0.022, 0.008);
  const g = new THREE.Group();
  g.name = 'feast_flames';
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.7, 0.7) });
  for (const p of spots) { const f = new THREE.Mesh(geo, mat); f.position.set(...P(...p)); g.add(f); }
  return g;
}
function candle(kit, x, y, z, h = 0.12, color = '#f3ece0') {
  kit.cyl(0.035, 0.04, 0.012, '#c9a04c', { at: P(x, y, z + 0.006) });
  kit.cyl(0.012, 0.014, 0.04, '#c9a04c', { at: P(x, y, z + 0.03) });
  kit.cyl(0.018, 0.018, h, color, { at: P(x, y, z + 0.05 + h / 2) });
  kit.cyl(0.0015, 0.0015, 0.012, '#2a2420', { at: P(x, y, z + 0.05 + h + 0.006), seg: 4 });
  return [x, y, z + 0.05 + h + 0.03];
}
function dish(kit, x, y, z, r, color = '#e6e1d6', rim = '#1d4fa0') {
  kit.lathe([[0, 0], [r * 0.6, 0], [r * 0.85, r * 0.25], [r, r * 0.45], [r * 0.96, r * 0.5], [r * 0.8, r * 0.3], [0, r * 0.2]], color, { at: P(x, y, z), seg: 22 });
  kit.cyl(r * 1.0, r * 0.98, 0.004, rim, { at: P(x, y, z + r * 0.46), seg: 22, open: true });
}

// ---------- the haft-sin ----------
function haftsin(table) {
  const kit = makeKit(), [cx, cy, z] = table.center, r = rnd(13), parts = new THREE.Group();
  const termeh = texture(256, 512, (g, w, h) => {
    g.fillStyle = '#7a1420'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d8a84a'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
    g.lineWidth = 2; g.strokeRect(22, 22, w - 44, h - 44);
    // Rows of small boteh, the paisley of a termeh cloth, turned alternately.
    for (let row = 0; row < 13; row++) for (let col = 0; col < 5; col++) {
      const x = 44 + col * 42 + (row % 2) * 21, y = 44 + row * 35, flip = row % 2 ? 1 : -1;
      if (x > w - 34) continue;
      g.save(); g.translate(x, y); g.scale(flip * 0.62, 0.62);
      g.beginPath(); g.moveTo(0, 18); g.bezierCurveTo(-20, 14, -20, -12, 0, -14); g.bezierCurveTo(14, -16, 18, -2, 10, 2); g.bezierCurveTo(4, -4, -4, 0, 6, 8); g.bezierCurveTo(10, 14, 6, 18, 0, 18);
      g.fillStyle = (row + col) % 3 ? '#b8862e' : '#2c6e64'; g.fill(); g.strokeStyle = '#e8c477'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#7a1420'; g.beginPath(); g.arc(-4, 6, 4, 0, 7); g.fill();
      g.restore();
    }
  });
  parts.add(cloth(table, termeh));
  const top = z + 0.004;
  // The mirror at the back, facing the sofa, with a candle either side.
  const mx = cx - 0.23;
  kit.box(0.05, 0.012, 0.16, '#b98f3e', { at: P(mx + 0.01, cy, top + 0.006) });
  const ring = new THREE.TorusGeometry(1, 0.08, 6, 28);
  kit.add(ring, '#d1a64a', { at: P(mx, cy, top + 0.17), rot: [0, Math.PI / 2, 0], scale: [0.105, 0.145, 0.105] });
  kit.add(new THREE.CircleGeometry(1, 28), (n, p) => { const k = (p.y - top - 0.03) / 0.28; return new THREE.Color().setRGB(0.18 + 0.3 * k, 0.24 + 0.32 * k, 0.32 + 0.3 * k); }, { at: P(mx + 0.003, cy, top + 0.17), rot: [0, Math.PI / 2, 0], scale: [0.1, 0.14, 1], light: () => 1 });
  kit.box(0.012, 0.11, 0.012, '#b98f3e', { at: P(mx - 0.03, cy, top + 0.07), rot: [0, 0, 0.35] });
  const wicks = [candle(kit, cx - 0.21, cy - 0.27, top), candle(kit, cx - 0.21, cy + 0.27, top)];
  // Sabzeh: wheat sprouts thick in a dish, tied with a red ribbon.
  dish(kit, cx + 0.1, cy, top, 0.085, '#e6e1d6', '#2a5fb0');
  kit.ball(1, '#3d7a2c', { at: P(cx + 0.1, cy, top + 0.035), scale: [0.075, 0.03, 0.075] });
  const blade = new THREE.ConeGeometry(0.004, 1, 3);
  for (let i = 0; i < 140; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.07, hh = 0.09 + r() * 0.07;
    kit.add(blade.clone(), r() < 0.5 ? '#5aa83c' : '#7cc451', { at: P(cx + 0.1 + Math.cos(a) * d, cy + Math.sin(a) * d, top + 0.04 + hh / 2), scale: [1, hh, 1], rot: [(r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3] });
  }
  kit.add(new THREE.TorusGeometry(0.068, 0.008, 6, 24), '#c8202c', { at: P(cx + 0.1, cy, top + 0.07), rot: [Math.PI / 2, 0, 0] });
  kit.box(0.02, 0.045, 0.004, '#c8202c', { at: P(cx + 0.17, cy - 0.01, top + 0.05), rot: [0, 0, 0.3] });
  // Samanu, a brown wheat pudding with a few nuts.
  dish(kit, cx + 0.12, cy - 0.3, top, 0.055, '#e6e1d6', '#2a5fb0');
  kit.cyl(0.046, 0.046, 0.004, '#7a4a26', { at: P(cx + 0.12, cy - 0.3, top + 0.022) });
  for (let i = 0; i < 5; i++) kit.ball(0.005, '#e8d6b0', { at: P(cx + 0.12 + Math.cos(i * 1.256) * 0.025, cy - 0.3 + Math.sin(i * 1.256) * 0.025, top + 0.026), seg: 6, rings: 4 });
  // Senjed, dried oleaster.
  dish(kit, cx - 0.08, cy - 0.36, top, 0.05, '#e6e1d6', '#2a5fb0');
  for (let i = 0; i < 12; i++) kit.ball(1, '#a0522d', { at: P(cx - 0.08 + (r() - 0.5) * 0.05, cy - 0.36 + (r() - 0.5) * 0.05, top + 0.02 + r() * 0.01), scale: [0.008, 0.006, 0.012], rot: [0, r() * 3, 0], seg: 6, rings: 4 });
  // Sir, garlic: three bulbs.
  for (let i = 0; i < 3; i++) {
    const gx = cx + 0.2 + (i === 2 ? -0.03 : 0), gy = cy - 0.16 + (i - 1) * 0.04;
    kit.ball(1, '#f1ece2', { at: P(gx, gy, top + 0.022), scale: [0.024, 0.022, 0.024], seg: 10, rings: 8 });
    kit.cyl(0.002, 0.008, 0.02, '#e6dccb', { at: P(gx, gy, top + 0.05), seg: 5 });
  }
  // Sib, red apples.
  for (const [ax, ay] of [[0.19, 0.18], [0.14, 0.24], [0.22, 0.25]]) {
    kit.ball(0.028, '#b51f24', { at: P(cx + ax, cy + ay, top + 0.027), seg: 12, rings: 8 });
    kit.cyl(0.0015, 0.002, 0.015, '#4a3020', { at: P(cx + ax, cy + ay, top + 0.058), seg: 4 });
  }
  // Somagh, a mound of red sumac, and serkeh, vinegar in a glass cruet.
  dish(kit, cx + 0.04, cy + 0.37, top, 0.05, '#e6e1d6', '#2a5fb0');
  kit.ball(1, '#7d1e22', { at: P(cx + 0.04, cy + 0.37, top + 0.02), scale: [0.038, 0.02, 0.038], seg: 10, rings: 6 });
  kit.lathe([[0, 0], [0.026, 0], [0.028, 0.05], [0.012, 0.09], [0.008, 0.12], [0.01, 0.125], [0, 0.125]], '#6b3a12', { at: P(cx - 0.12, cy + 0.4, top) });
  // Painted eggs on a plate, and a hyacinth.
  kit.cyl(0.055, 0.05, 0.008, '#e6e1d6', { at: P(cx - 0.06, cy + 0.17, top + 0.004), seg: 20 });
  for (const [k, c] of [[0, '#2a5fb0'], [1, '#c8202c'], [2, '#e2a63a']]) kit.ball(1, c, { at: P(cx - 0.075 + k * 0.025, cy + 0.15 + (k % 2) * 0.035, top + 0.024), scale: [0.017, 0.023, 0.017], seg: 10, rings: 8 });
  kit.cyl(0.03, 0.025, 0.05, '#2a5fb0', { at: P(cx - 0.22, cy + 0.44, top + 0.025) });
  for (let i = 0; i < 26; i++) kit.ball(0.009, i % 3 ? '#8a5cc8' : '#a982dc', { at: P(cx - 0.22 + (r() - 0.5) * 0.03, cy + 0.44 + (r() - 0.5) * 0.03, top + 0.08 + i * 0.0035), seg: 6, rings: 4 });
  kit.cyl(0.004, 0.004, 0.06, '#4b8a3c', { at: P(cx - 0.22, cy + 0.44, top + 0.075), seg: 4 });
  // The goldfish bowl: water and glass, two fish going round.
  const bx = cx - 0.08, by = cy - 0.15;
  kit.cyl(0.05, 0.045, 0.006, '#d1a64a', { at: P(bx, by, top + 0.003) });
  const mesh = kit.mesh();
  parts.add(mesh);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 14, 0, Math.PI * 2, 0.55, Math.PI - 0.55), new THREE.MeshBasicMaterial({ color: 0x9fd0e8, transparent: true, opacity: 0.28, depthWrite: false }));
  bowl.position.set(...P(bx, by, top + 0.068));
  bowl.renderOrder = 2;
  const fishKit = makeKit({ light: () => 1.05 });
  for (const s of [-1, 1]) {
    fishKit.ball(1, '#ff7a1a', { at: [s * 0.032, 0, 0], scale: [0.008, 0.009, 0.016], rot: [0, 0, 0], seg: 8, rings: 6 });
    fishKit.add(new THREE.ConeGeometry(0.008, 0.014, 4), '#ffa040', { at: [s * 0.032, 0, -s * 0.02], rot: [s * Math.PI / 2, 0, 0] });
  }
  const fish = new THREE.Mesh(fishKit.geometry(), paperMaterial());
  fish.name = 'feast_fish';
  fish.position.set(...P(bx, by, top + 0.06));
  parts.add(fish, bowl);
  const fl = flames(wicks);
  parts.add(fl);
  return { group: parts, fish, flames: fl };
}

// ---------- Shab-e Yalda ----------
function yalda(table) {
  const kit = makeKit(), [cx, cy, z] = table.center, r = rnd(29), parts = new THREE.Group();
  const red = texture(256, 512, (g, w, h) => {
    g.fillStyle = '#5e0f18'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d9a94b'; g.lineWidth = 8; g.strokeRect(12, 12, w - 24, h - 24);
    g.fillStyle = '#d9a94b';
    for (let y = 40; y < h - 30; y += 26) for (const x of [26, w - 26]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    // A sun medallion in the middle, the light the long night waits for.
    g.save(); g.translate(w / 2, h / 2);
    g.fillStyle = 'rgba(217,169,75,0.5)';
    for (let i = 0; i < 16; i++) { g.rotate(Math.PI / 8); g.beginPath(); g.moveTo(0, -30); g.quadraticCurveTo(9, -52, 0, -74); g.quadraticCurveTo(-9, -52, 0, -30); g.fill(); }
    g.beginPath(); g.arc(0, 0, 28, 0, 7); g.fill();
    g.fillStyle = '#5e0f18'; g.beginPath(); g.arc(0, 0, 18, 0, 7); g.fill();
    g.fillStyle = 'rgba(217,169,75,0.6)'; g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill();
    g.restore();
  });
  parts.add(cloth(table, red));
  const top = z + 0.004;
  // Half a watermelon, cut side up, and slices on a platter.
  const wx = cx + 0.05, wy = cy - 0.22;
  kit.add(new THREE.SphereGeometry(0.13, 22, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), (n, p) => {
    const a = Math.atan2(p.z + wy, p.x - wx);
    return new THREE.Color(Math.sin(a * 9) > 0.2 ? '#1f5a2a' : '#3f8a3a');
  }, { at: P(wx, wy, top + 0.13 * 0.75), scale: [1, 0.75, 1] });
  kit.cyl(0.13, 0.13, 0.004, '#c9e3a0', { at: P(wx, wy, top + 0.0975 + 0.002), seg: 28 });
  kit.cyl(0.118, 0.118, 0.006, '#e23a3c', { at: P(wx, wy, top + 0.0975 + 0.004), seg: 28 });
  for (let i = 0; i < 18; i++) { const a = r() * Math.PI * 2, d = 0.03 + r() * 0.07; kit.ball(1, '#1a1210', { at: P(wx + Math.cos(a) * d, wy + Math.sin(a) * d, top + 0.105), scale: [0.006, 0.002, 0.004], rot: [0, a, 0], seg: 6, rings: 3 }); }
  kit.cyl(0.13, 0.12, 0.01, '#e6e1d6', { at: P(cx + 0.14, cy + 0.06, top + 0.005), seg: 24 });
  // Three slices fanned on it: rind, the pale band, the red, each its own layer.
  for (let k = 0; k < 3; k++) {
    const turn = 0.9 + k * 0.72, at = P(cx + 0.14, cy + 0.06, top + 0.01);
    for (const [rr, hh, c] of [[0.1, 0.016, '#2f7a34'], [0.091, 0.019, '#d6ecb4'], [0.083, 0.022, '#e23a3c']]) {
      kit.add(new THREE.CylinderGeometry(rr, rr, hh, 12, 1, false, 0, 0.62), c, { at: [at[0], at[1] + hh / 2, at[2]], rot: [0, turn, 0] });
    }
    for (let i = 0; i < 4; i++) { const a = turn + 0.12 + i * 0.13, d = 0.045 + (i % 2) * 0.015; kit.ball(1, '#1a1210', { at: [at[0] + Math.sin(a) * d, at[1] + 0.023, at[2] + Math.cos(a) * d], scale: [0.004, 0.0015, 0.006], rot: [0, a, 0], seg: 5, rings: 3 }); }
  }
  // Pomegranates in a bowl, one broken open beside its seeds.
  dish(kit, cx - 0.12, cy + 0.32, top, 0.1, '#e9e2d2', '#7a1420');
  for (const [px, py, pz] of [[-0.14, 0.3, 0.06], [-0.09, 0.35, 0.06], [-0.12, 0.27, 0.06], [-0.11, 0.32, 0.1]]) {
    kit.ball(0.034, '#a3141e', { at: P(cx + px, cy + py, top + pz), seg: 14, rings: 10 });
    kit.cyl(0.006, 0.01, 0.014, '#6a1016', { at: P(cx + px, cy + py, top + pz + 0.036), seg: 6 });
  }
  kit.add(new THREE.SphereGeometry(0.034, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), '#a3141e', { at: P(cx + 0.04, cy + 0.36, top + 0.034) });
  kit.cyl(0.031, 0.031, 0.004, '#f2d8c8', { at: P(cx + 0.04, cy + 0.36, top + 0.034) });
  for (let i = 0; i < 26; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.026; kit.ball(0.0045, '#c4102a', { at: P(cx + 0.04 + Math.cos(a) * d, cy + 0.36 + Math.sin(a) * d, top + 0.038), seg: 5, rings: 3, light: () => 1.15 }); }
  // A dish of nuts.
  dish(kit, cx + 0.2, cy + 0.38, top, 0.05, '#e6e1d6', '#7a1420');
  for (let i = 0; i < 16; i++) kit.ball(1, ['#c49a5c', '#8a5a2e', '#e0c79a', '#5f8a3a'][i % 4], { at: P(cx + 0.2 + (r() - 0.5) * 0.05, cy + 0.38 + (r() - 0.5) * 0.05, top + 0.02 + r() * 0.012), scale: [0.008, 0.006, 0.01], rot: [0, r() * 3, 0], seg: 6, rings: 4 });
  // Candles.
  const wicks = [candle(kit, cx - 0.22, cy - 0.42, top, 0.1), candle(kit, cx - 0.22, cy - 0.32, top, 0.14), candle(kit, cx + 0.2, cy - 0.44, top, 0.08)];
  // The Divan of Hafez, open on a carved stand.
  const hx = cx - 0.13, hy = cy - 0.02;
  kit.box(0.13, 0.012, 0.21, '#6b3a1e', { at: [P(hx, hy, top)[0] - 0.006, top + 0.118, -hy], rot: [0, 0, -0.45] });
  kit.box(0.012, 0.12, 0.18, '#5a2f17', { at: [P(hx, hy, top)[0] - 0.05, top + 0.06, -hy] });
  kit.box(0.012, 0.07, 0.18, '#5a2f17', { at: [P(hx, hy, top)[0] + 0.045, top + 0.035, -hy] });
  const mesh = kit.mesh();
  parts.add(mesh);
  const pages = texture(256, 160, (g, w, h) => {
    g.fillStyle = '#efe2c2'; g.fillRect(0, 0, w, h);
    for (const ox of [0, w / 2]) {
      g.strokeStyle = '#c99a3a'; g.lineWidth = 3; g.strokeRect(ox + 12, 12, w / 2 - 24, h - 24);
      g.fillStyle = '#1e3a8a'; g.fillRect(ox + 16, 16, w / 2 - 32, 18);
      g.fillStyle = '#d9b04f'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(ox + 30 + k * 18, 25, 3.5, 0, 7); g.fill(); }
      // Lines of verse in two half-lines, as marks rather than letters.
      g.strokeStyle = '#2a1a10'; g.lineWidth = 1.6;
      for (let y = 48; y < h - 20; y += 14) for (const cxl of [ox + 38, ox + 90]) {
        g.beginPath(); g.moveTo(cxl + 18, y); let x = cxl + 18;
        while (x > cxl - 18) { const nx = x - 4 - r() * 5; g.quadraticCurveTo((x + nx) / 2, y - 3 - r() * 4, nx, y + (r() - 0.5) * 2); x = nx; }
        g.stroke();
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(w / 2 - 3, 0, 6, h);
  });
  const book = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.125, 2, 1).toNonIndexed(), new THREE.MeshBasicMaterial({ map: pages, vertexColors: true }));
  const pos = book.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.abs(pos.getX(i)) < 0.001 ? -0.012 : 0);
  book.geometry.computeVertexNormals();
  book.geometry.rotateX(-Math.PI / 2 + 0.45);
  book.geometry.rotateY(Math.PI / 2);
  book.geometry.translate(...P(hx, hy, top + 0.13));
  paint(book.geometry, '#ffffff', () => 1.0);
  parts.add(book);
  const fl = flames(wicks);
  parts.add(fl);
  return { group: parts, flames: fl };
}

export function makeFeast(id, table) {
  const f = id === 'haftsin' ? haftsin(table) : id === 'yalda' ? yalda(table) : null;
  if (!f) return null;
  f.group.name = 'feast_' + id;
  const flick = f.flames.children, y0 = f.fish?.position.y ?? 0;
  return {
    id, group: f.group,
    tick(dt, t) {
      for (let i = 0; i < flick.length; i++) { const k = 1 + 0.12 * Math.sin(t * 11 + i * 2.1) + 0.08 * Math.sin(t * 23 + i); flick[i].scale.set(1, k, 1); }
      if (f.fish) { f.fish.rotation.y = -t * 0.9; f.fish.position.y = y0 + Math.sin(t * 1.7) * 0.006; }
    },
  };
}
