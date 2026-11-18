import * as THREE from 'three';
import { b2t } from './engine.js';
import { noteCorners, NOTE_LINES, SAYS } from './pure/aria.js';

// Aria on the desk, until she is the real voice agent: her sticky note on the monitor's bezel, and a line from her
// when she or the note is pressed.
export function makeAria(scene, meta) {
  const screen = meta.screens.main, at = meta.points.aria;
  if (!screen || !at) return null;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d'), tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const draw = () => {
    const paper = g.createLinearGradient(0, 0, 0, 256);
    paper.addColorStop(0, '#a6ecdb'); paper.addColorStop(1, '#8fdcca');
    g.fillStyle = paper; g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(0, 0, 256, 40);
    g.fillStyle = '#12343c'; g.strokeStyle = '#12343c'; g.textAlign = 'center'; g.textBaseline = 'middle';
    // Written low on the note: the seated view on a phone covers its top, a computer's the very bottom.
    g.font = "60px Pacifico, 'Segoe Script', cursive";
    g.fillText(NOTE_LINES[0], 150, 116);
    // An arrow at her, on the note's left.
    g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(76, 124); g.quadraticCurveTo(54, 128, 22, 116); g.moveTo(36, 102); g.lineTo(22, 116); g.lineTo(38, 128); g.stroke();
    g.font = "700 29px system-ui, 'Segoe UI', Arial, sans-serif";
    g.fillText(NOTE_LINES[1], 128, 172);
    g.fillText(NOTE_LINES[2], 128, 208);
    g.lineWidth = 3; g.beginPath(); g.moveTo(50, 228); g.lineTo(206, 226); g.stroke();
    tex.needsUpdate = true;
  };
  draw();
  document.fonts?.load('60px Pacifico').then(draw).catch(() => {});
  document.fonts?.ready.then(draw);
  const [tl, tr, bl, br] = noteCorners(screen).map(v => b2t(...v));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([tl, tr, bl, br].flatMap(v => v.toArray()), 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
  geo.setIndex([0, 2, 3, 0, 3, 1]);
  const note = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.95, 0.95, 0.95) }));
  note.name = 'aria_note';
  scene.add(note);
  const body = new THREE.Sphere(b2t(...at), 0.11), hitAt = new THREE.Vector3();
  let said = 0;
  return {
    note,
    // A press on her or her note; given `blockers`, only when none of them is in front.
    hit(ray, blockers) {
      const d = ray.ray.intersectSphere(body, hitAt) ? ray.ray.origin.distanceTo(hitAt) : ray.intersectObject(note, false)[0]?.distance;
      if (d === undefined) return false;
      return !blockers || !(ray.intersectObjects(blockers, true)[0]?.distance < d - 0.05);
    },
    say: () => SAYS[said++ % SAYS.length],
  };
}
