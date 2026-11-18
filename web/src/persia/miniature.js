import * as THREE from 'three';
import { makeKit, paint } from './kit.js';
import { paintMiniature, DESIGN } from './paint.js';

// The painting on the mezzanine's back wall: a black lacquer frame with a gold lip, a brass picture light over it,
// and the picture itself, painted in the page once the house is up (a moment of work kept off the first frames).
export function makeMiniature({ center: [x, y, z], w, h, frame }) {
  const kit = makeKit(), F = frame, D = 0.035, BLACK = '#1f1a19', GOLD = '#c9a24a', z0 = -y;
  for (const s of [-1, 1]) {
    kit.box(w + 2 * F, F, D, BLACK, { at: [x, z + s * (h / 2 + F / 2), z0 - D / 2] });
    kit.box(F, h, D, BLACK, { at: [x + s * (w / 2 + F / 2), z, z0 - D / 2] });
    kit.box(w + 0.016, 0.008, 0.012, GOLD, { at: [x, z + s * (h / 2 + 0.004), z0 - D + 0.004] });
    kit.box(0.008, h, 0.012, GOLD, { at: [x + s * (w / 2 + 0.004), z, z0 - D + 0.004] });
  }
  const ly = z + h / 2 + F + 0.08;
  kit.box(0.014, 0.014, 0.15, '#b8913f', { at: [x, ly, z0 - 0.075] });
  kit.cyl(0.018, 0.018, w * 0.62, '#b8913f', { at: [x, ly, z0 - 0.16], rot: [0, 0, Math.PI / 2], seg: 12 });
  kit.box(w * 0.58, 0.004, 0.02, '#ffdcae', { at: [x, ly - 0.017, z0 - 0.155], light: () => 1.7 });
  const group = new THREE.Group();
  group.name = 'miniature';
  group.add(kit.mesh());

  // The picture, lit by its lamp: brighter at the top.
  const geo = new THREE.PlaneGeometry(w, h, 1, 6).toNonIndexed();
  geo.rotateY(Math.PI);
  geo.translate(x, z, z0 - 0.009);
  paint(geo, '#ffffff', (n, p) => 0.78 + 0.2 * (p.y - (z - h / 2)) / h);
  // Until it is painted, a dark board in its place; never hidden, since the loading screen briefly shows every hidden
  // thing to build its shaders and would hide it again after.
  const board = document.createElement('canvas');
  board.width = board.height = 4;
  const bg = board.getContext('2d'); bg.fillStyle = '#2a2420'; bg.fillRect(0, 0, 4, 4);
  const blank = new THREE.CanvasTexture(board);
  blank.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, map: blank });
  const picture = new THREE.Mesh(geo, mat);
  picture.name = 'miniature_picture';
  group.add(picture);
  group.traverse(o => { o.matrixAutoUpdate = false; o.updateMatrix(); });

  let done = null;
  // Painted once; `size` is the picture's width in pixels.
  function paintNow(size = DESIGN[0]) {
    if (done) return done;
    const c = document.createElement('canvas');
    c.width = size; c.height = Math.round(size * DESIGN[1] / DESIGN[0]);
    paintMiniature(c.getContext('2d'), c.width, c.height);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    mat.map = t;
    blank.dispose();
    done = Promise.resolve(t);
    return done;
  }
  return { group, picture, paint: paintNow, get painted() { return !!done; } };
}
