import * as THREE from 'three';
import { b2t } from '../engine.js';
import { COUPLET, NOTE_SAY, PLAQUES, noteCorners, PLAQUE_AT } from '../pure/shahnameh.js';
import { wrap } from '../pure/desktop.js';
import { FA_FONT } from './art.js';

const SERIF = "Georgia, 'Times New Roman', serif";
function texture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d'), t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const paint = () => { draw(g, w, h); t.needsUpdate = true; };
  paint();
  document.fonts?.load(`500 80px 'Noto Nastaliq Urdu'`, COUPLET.fa.join(' ')).then(paint).catch(() => {});
  document.fonts?.ready.then(paint);
  return t;
}
// A flat quad from four corners in Blender axes: top left, top right, bottom left, bottom right as seen from the front.
function quad(corners, map, tint = 0.95) {
  const [tl, tr, bl, br] = corners.map(v => b2t(...v));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([tl, tr, bl, br].flatMap(v => v.toArray()), 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
  geo.setIndex([0, 2, 3, 0, 3, 1]);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, color: new THREE.Color(tint, tint, tint) }));
}

// Ferdowsi's couplet on a pink sticky note, the two halves of the line one under the other, signed.
function drawNote(g, w, h) {
  const paper = g.createLinearGradient(0, 0, 0, h);
  paper.addColorStop(0, '#ffd3dc'); paper.addColorStop(0.85, '#f7b9c6'); paper.addColorStop(1, '#eda6b5');
  g.fillStyle = paper; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(0, 0, w, h * 0.13);
  g.fillStyle = '#2b1519'; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  // Each half sized to the note's width, centred on the ink (Nastaliq reaches past its advance width).
  const line = (text, y, max, px0) => {
    let px = px0;
    g.font = `500 ${px}px ${FA_FONT}`;
    let m = g.measureText(text), ink = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    if (ink > max) { px = Math.floor(px * max / ink); g.font = `500 ${px}px ${FA_FONT}`; m = g.measureText(text); }
    g.fillText(text, w / 2 + (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2, y);
  };
  line(COUPLET.fa[0], h * 0.33, w * 0.84, 90);
  line(COUPLET.fa[1], h * 0.6, w * 0.84, 90);
  g.fillStyle = '#6b3a44';
  g.textAlign = 'left'; g.font = `500 ${Math.round(h * 0.085)}px ${FA_FONT}`;
  g.fillText('فردوسی', w * 0.1, h * 0.84);
}

// A bronze plaque: its title, a rule, and the story.
function drawPlaque({ title, text, fa }, short) {
  if (short) return (g, w, h) => {
    const m = g.createLinearGradient(0, 0, w, h);
    m.addColorStop(0, '#8a6530'); m.addColorStop(1, '#5a3d1a');
    g.fillStyle = m; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d9b46a'; g.lineWidth = 12; g.strokeRect(16, 16, w - 32, h - 32);
    g.fillStyle = '#f3dca0'; g.textBaseline = 'middle'; g.direction = 'ltr'; g.textAlign = 'left';
    g.font = `700 ${Math.round(h * 0.2)}px ${SERIF}`;
    g.fillText(title.toUpperCase(), 64, h * 0.38, w - 300);
    g.font = `400 ${Math.round(h * 0.13)}px ${SERIF}`;
    g.fillText('Shahnameh, the reign of Khosrow', 64, h * 0.68, w - 300);
    g.direction = 'rtl'; g.textAlign = 'right'; g.font = `500 ${Math.round(h * 0.26)}px ${FA_FONT}`;
    g.fillText(fa, w - 64, h * 0.42);
  };
  return (g, w, h) => {
    const m = g.createLinearGradient(0, 0, w, h);
    m.addColorStop(0, '#6a4a22'); m.addColorStop(0.5, '#8a6530'); m.addColorStop(1, '#5a3d1a');
    g.fillStyle = m; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d9b46a'; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, h - 28);
    g.strokeStyle = 'rgba(40,24,8,.6)'; g.lineWidth = 3; g.strokeRect(30, 30, w - 60, h - 60);
    g.fillStyle = '#f3dca0'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.direction = 'ltr';
    g.font = `700 ${Math.round(h * 0.085)}px ${SERIF}`;
    g.fillText(title.toUpperCase(), 64, h * 0.2);
    g.direction = 'rtl'; g.textAlign = 'right'; g.font = `500 ${Math.round(h * 0.08)}px ${FA_FONT}`;
    g.fillText(fa, w - 64, h * 0.2);
    g.direction = 'ltr'; g.textAlign = 'left';
    g.fillRect(64, h * 0.26, w - 128, 3);
    g.font = `400 ${Math.round(h * 0.056)}px ${SERIF}`;
    const cols = Math.floor((w - 128) / (h * 0.056 * 0.48));
    wrap(text, cols).forEach((l, i) => g.fillText(l, 64, h * 0.36 + i * h * 0.075));
  };
}

// Ferdowsi's note on the monitor, and the plaques telling the story of chess and backgammon by their tables.
export function makeShahnameh(scene, meta) {
  const screen = meta.screens?.main;
  const note = screen ? quad(noteCorners(screen), texture(512, 512, drawNote)) : null;
  if (note) { note.name = 'ferdowsi_note'; scene.add(note); }
  const spots = [];
  for (const [id, p] of Object.entries(PLAQUE_AT)) {
    const mesh = quad(p.corners, texture(...p.size, drawPlaque(PLAQUES[id], p.short)), 0.9);
    mesh.name = id;
    scene.add(mesh);
    const [x, y, z] = p.spot;
    spots.push({ id, label: 'Read the plaque', at: p.spot, r: 0.5, x, y: z, z: -y });
  }
  return {
    spots,
    // A press on the note; given `blockers`, only when none of them is in front.
    noteHit(ray, blockers) {
      if (!note) return false;
      const d = ray.intersectObject(note, false)[0]?.distance;
      if (d === undefined) return false;
      return !blockers || !(ray.intersectObjects(blockers, true)[0]?.distance < d - 0.05);
    },
    noteSay: NOTE_SAY,
    // What pressing E at a plaque says, or null for anything else.
    read: id => (Object.hasOwn(PLAQUES, id) ? `${PLAQUES[id].title}. ${PLAQUES[id].text}` : null),
  };
}
