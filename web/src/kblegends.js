import * as THREE from 'three';
import { U, KEYS } from './pure/typing.js';
import { ROWS, LIT, legendGeometry, plateGeometry } from './pure/kblight.js';

// The desk keyboard's backlight, as on a black gaming keyboard: each key's legend lit from inside it and light from under
// the keys showing between them, the studio's teal fading to purple across the board (pure/kblight.js). Both stay lit
// with the lamps off. A key pressed by my hand (deskhands.js, through `press`) takes its legend down with it.
const CELL = 64;

// Every legend in one picture: a cell a key wide per key, the words smaller than the letters, a soft halo round each.
function legends() {
  const c = document.createElement('canvas');
  c.width = 16 * CELL; c.height = ROWS * CELL;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const k of LIT) {
    const x = (k.z / U + 8) * CELL, y = (ROWS - 1 - k.row + 0.5) * CELL;
    g.font = k.label.length > 1 ? "600 15px system-ui, 'Segoe UI', Arial, sans-serif" : "600 27px system-ui, 'Segoe UI', Arial, sans-serif";
    g.shadowColor = 'rgba(255,255,255,0.9)'; g.shadowBlur = 7;
    g.fillText(k.label, x, y);
    g.shadowBlur = 0;
    g.fillText(k.label, x, y);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Down each vertex's key by its press, in the mesh's own axes (which are the desk's).
function pressed(m, press) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uPress = { value: press };
    sh.vertexShader = `attribute float aKey;\nuniform float uPress[${press.length}];\n` + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nif (aKey >= 0.0) transformed.y -= uPress[int(aKey + 0.5)];');
  };
  m.customProgramCacheKey = () => 'kb-legends';
  return m;
}

export function makeKeyLight(scene, world) {
  const glow = world.deskThings.find(o => o.name === 'kb_glow');
  if (!glow) return null;
  // The keyboard's middle on the desk, where deskhands.js puts its desk space too.
  const at = new THREE.Box3().setFromObject(glow).getCenter(new THREE.Vector3());
  at.y -= 0.006;
  const press = new Float32Array(KEYS.length);
  const L = legendGeometry(), geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(L.pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(L.uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(L.colour, 3));
  geo.setAttribute('aKey', new THREE.Float32BufferAttribute(L.key, 1));
  geo.setIndex(L.index);
  const mat = pressed(new THREE.MeshBasicMaterial({ name: 'M_KeyLegends', map: legends(), vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), press);
  mat.userData.lamp = 'glow';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'kb_legends';
  mesh.position.copy(at);
  mesh.userData.press = press;
  // The light under the keys, seen in the gaps between them: the plate they stand on, glowing.
  const Pl = plateGeometry(), pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute('position', new THREE.Float32BufferAttribute(Pl.pos, 3));
  pgeo.setAttribute('color', new THREE.Float32BufferAttribute(Pl.colour, 3));
  pgeo.setIndex(Pl.index);
  const pmat = new THREE.MeshBasicMaterial({ name: 'M_KeyPlate', vertexColors: true });
  pmat.userData.lamp = 'glow';
  const plate = new THREE.Mesh(pgeo, pmat);
  plate.name = 'kb_plate';
  mesh.add(plate);
  scene.add(mesh);
  return { mesh, press };
}
