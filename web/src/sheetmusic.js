import * as THREE from 'three';
import { score, spreadAt, spreadOfBar, barAt, onDesk, TURN } from './pure/sheet.js';
import { drawSheet, drawSide, sheetState, PAGE } from './sheetdraw.js';

const COLS = 14;
const FACING = { '-Y': [0, 0, 1], '+Y': [0, 0, -1], '-X': [-1, 0, 0], '+X': [1, 0, 0] };

// The sheet music on the piano's desk shows the song playing, or being learned, from its first pages, and turns a page
// when the song reaches the next two: the right page lifts off the desk and lands on the left, in step with the song.
// While nothing plays, nothing moves.
export function makeSheetMusic({ scene, meta, sheet, texture }) {
  const at = meta.screens.sheet;
  if (!sheet || !at || !texture) return { tick() {}, get state() { return null; } };
  const W = at.w / 2, H = at.h, desk = texture.image, base = desk.getContext('2d');
  // The leaf being turned: its front (the page lifting) and its back (the next left page) are two meshes over the
  // same points, both reading one canvas, the back's page on its left half and the front's on its right.
  const leafCanvas = document.createElement('canvas');
  leafCanvas.width = PAGE.w * 2; leafCanvas.height = PAGE.h;
  const lg = leafCanvas.getContext('2d');
  const leafTex = new THREE.CanvasTexture(leafCanvas);
  leafTex.colorSpace = texture.colorSpace; leafTex.anisotropy = texture.anisotropy; leafTex.flipY = texture.flipY;
  // A copy of the desk sheet's own material, so the leaf looks the same, dims with the lamps and needs no new shader.
  const mat = sheet.material.clone();
  mat.map = leafTex;
  const tone = mat.color.r;
  const pos = new THREE.BufferAttribute(new Float32Array((COLS + 1) * 6), 3).setUsage(THREE.DynamicDrawUsage);
  const top = texture.flipY ? 1 : 0, uvF = [], uvB = [], iF = [], iB = [];
  for (let j = 0; j <= COLS; j++) {
    const u = j / COLS;
    uvF.push(0.5 + 0.5 * u, top, 0.5 + 0.5 * u, 1 - top);
    uvB.push(0.5 - 0.5 * u, top, 0.5 - 0.5 * u, 1 - top);
    if (j < COLS) { const a = j * 2, b = a + 1, c = a + 2, d = a + 3; iF.push(a, b, c, c, b, d); iB.push(a, c, b, c, d, b); }
  }
  const leaf = new THREE.Group();
  leaf.name = 'sheet_leaf';
  for (const [uv, index] of [[uvF, iF], [uvB, iB]]) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', pos);
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(index);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, W / 2), W * 1.2);
    leaf.add(new THREE.Mesh(geo, mat));
  }
  // The sheet was modelled upright in front of the leaning desk, which hid its lower half: it is laid on the desk.
  const lay = onDesk(), b2t = ([x, y, z]) => new THREE.Vector3(x, z, -y);
  const from = b2t(at.center), to = b2t(at.center.map((v, i) => v + lay.move[i]));
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), lay.tilt);
  sheet.updateMatrix();
  sheet.matrixAutoUpdate = false;
  sheet.matrix.premultiply(new THREE.Matrix4().compose(to, tilt, new THREE.Vector3(1, 1, 1)).multiply(new THREE.Matrix4().makeTranslation(-from.x, -from.y, -from.z)));
  sheet.matrixWorldNeedsUpdate = true;
  // The hinge is the fold down the middle of the open book, a hair off the desk's sheet so the two never fight.
  leaf.position.copy(to);
  leaf.quaternion.copy(tilt).multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...(FACING[at.normal] || FACING['-Y']))));
  leaf.visible = false;
  scene.add(leaf);

  let sc = score(sheetState.song), shown = 0, run = null, turn = null;
  function bend(s) {
    const e = s * s * (3 - 2 * s), th = Math.PI * e, lead = 0.6 * Math.sin(Math.PI * s), du = W / COLS;
    let x = 0, z = 0.0015;
    for (let j = 0; j <= COLS; j++) {
      pos.setXYZ(j * 2, x, H / 2, z); pos.setXYZ(j * 2 + 1, x, -H / 2, z);
      // The outer edge leads, as when a page is turned by its corner.
      const a = Math.min(Math.PI, th + lead * (j + 0.5) / COLS);
      x += Math.cos(a) * du; z += Math.sin(a) * du;
    }
    pos.needsUpdate = true;
    // Turned side on to the lamp, the page is a little darker.
    mat.color.setScalar(tone * (1 - 0.2 * Math.sin(th)));
  }
  function open(left, right) {
    sheetState.left = left; sheetState.right = right;
    drawSheet(base);
    texture.needsUpdate = true;
  }
  function show(id) {
    turn = null; leaf.visible = false;
    sheetState.song = id; sc = score(id); shown = 0;
    open(sc.spreads[0].left, sc.spreads[0].right);
  }
  // Each page is drawn once: the page being turned is copied onto the leaf, the next left page is drawn on the leaf
  // and copied back to the desk when it lands, and only the next right page is drawn on the desk itself.
  const half = (from, fromX, to, toX) => to.drawImage(from, fromX, 0, PAGE.w, PAGE.h, toX, 0, PAGE.w, PAGE.h);
  function begin(to, synced) {
    const next = sc.spreads[to];
    half(desk, PAGE.w, lg, PAGE.w);
    drawSide(lg, sc, next.left, 'left');
    leafTex.needsUpdate = true;
    // Under the lifting page the next right page is already there; the left page stays until the leaf lands on it.
    drawSide(base, sc, next.right, 'right');
    sheetState.right = next.right;
    texture.needsUpdate = true;
    turn = { to, synced, p: 0 };
    bend(0);
    leaf.visible = true;
  }
  function land() {
    shown = turn.to; turn = null;
    leaf.visible = false;
    half(leafCanvas, 0, base, 0);
    sheetState.left = sc.spreads[shown].left;
    texture.needsUpdate = true;
  }
  return {
    // Where the sheet is: the song, the pages open, and how far a turn has gone (null when none).
    get state() { return { song: sc.id, spread: shown, left: sheetState.left, right: sheetState.right, turn: turn ? { to: turn.to, p: turn.p } : null }; },
    get leaf() { return leaf; },
    // src: the song playing ({ id, run, at, live: true }) or the lesson ({ id, run, at, live: false }), or null.
    tick(dt, src) {
      if (src && (src.id !== sc.id || src.run !== run)) { run = src.run; show(src.id); }
      if (!turn && src) {
        const target = src.live ? spreadAt(sc, src.at) : spreadOfBar(sc, barAt(sc, src.at));
        if (target <= shown) return;
        // Back from a hidden tab the song may be pages on: go straight there, there is no turn to see.
        if (target > shown + 1 || (src.live && src.at - sc.turns[target] >= TURN)) { shown = target; open(sc.spreads[shown].left, sc.spreads[shown].right); return; }
        begin(target, src.live);
      }
      if (!turn) return;
      // A song's turn keeps to the song's clock; a lesson's, or one whose song stopped, finishes on its own.
      const p = turn.synced && src?.live ? (src.at - sc.turns[turn.to]) / TURN : turn.p + dt / TURN;
      turn.p = Math.min(1, Math.max(turn.p, p));
      if (turn.p >= 1) land(); else bend(turn.p);
    },
  };
}
