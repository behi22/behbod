import * as THREE from 'three';
import { keyFor, fingerFor, HOME, strokeAt, TRAVEL, DESK } from './pure/typing.js';

// My hands at the desk, seen from my own eyes once the camera has glided in: fetched the first time I sit, they come
// up onto the keyboard as my body leaves the view. While I type at the terminal or play a desk game both hands are on
// the keys, each key press made by the finger that touch-types it, the key going down under it; otherwise the left
// hand is on the mouse (left of the keyboard) and the right rests beside the keys. Same soft white, same hoodie as me.
const FINGER_KEYS = ['index', 'middle', 'ring', 'pinky', 'thumb'];
const lerpA = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

export function makeDeskHands({ scene, world, me, playing = () => false, lamp = () => 1 }) {
  let kit = null, loading = null, seated = false, shown = 0, typing = 0, lastKey = -1e9, clock = 0, clicks = 0;
  const group = new THREE.Group(), strokes = [], press = new Float32Array(DESK.key.rows * DESK.key.cols);
  group.name = 'desk_hands';
  group.visible = false;

  // The keyboard's middle on the desk is where the hands' desk space starts (x toward the monitor, y up, z right): the
  // glow under the keyboard is its own mesh, centred under it 6 mm over the desk.
  function origin() {
    const g = world.deskThings.find(o => o.name === 'kb_glow'), c = new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3());
    return c.setY(c.y - 0.006);
  }
  // The keys are baked into the studio's one mesh: each of their corners learns which key it belongs to, so a press
  // can push just that key down, keeping its baked light.
  function keysPress(o) {
    let mesh = null;
    scene.traverse(m => { if (m.isMesh && m.name === 'studio_baked') mesh = m; });
    if (!mesh) return;
    const g = mesh.geometry, p = g.attributes.position, idx = new Float32Array(p.count).fill(-1), v = new THREE.Vector3(), K = DESK.key;
    mesh.updateMatrixWorld(true);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld).sub(o);
      if (v.y < K.top - K.h - 0.0006 || v.y > K.top + 0.0006) continue;
      const row = Math.round((v.x - K.x0) / K.dx), col = Math.round((K.z0 - v.z) / K.dz);
      if (row < 0 || row >= K.rows || col < 0 || col >= K.cols) continue;
      if (Math.abs(v.x - (K.x0 + row * K.dx)) > K.w / 2 + 0.0006 || Math.abs(v.z - (K.z0 - col * K.dz)) > K.d / 2 + 0.0006) continue;
      idx[i] = row * K.cols + col;
    }
    g.setAttribute('aKey', new THREE.BufferAttribute(idx, 1));
    // Down in the mesh's own axes, a metre long in the room's.
    const down = new THREE.Vector3(0, -1, 0).applyMatrix3(new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld).invert());
    const m = mesh.material, before = m.onBeforeCompile, key = m.customProgramCacheKey;
    const U = { uPress: { value: press }, uDown: { value: down } };
    m.onBeforeCompile = (sh, r) => {
      before.call(m, sh, r);
      Object.assign(sh.uniforms, U);
      sh.vertexShader = `attribute float aKey;\nuniform float uPress[${press.length}];\nuniform vec3 uDown;\n` + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nif (aKey >= 0.0) transformed += uDown * uPress[int(aKey + 0.5)];');
    };
    m.customProgramCacheKey = () => key.call(m) + '-keys';
    m.needsUpdate = true;
  }

  async function load() {
    const [{ loadHand, makeRealHand, makeSleeve, handMaterial }, { localsFor }, { DESK_POSES, KEYS }] = await Promise.all([import('./realhand.js'), import('./pure/realhand.js'), import('./pure/realposes.js')]);
    const geo = await loadHand();
    const mats = {};
    me.root.traverse(o => { for (const m of o.material ? [].concat(o.material) : []) mats[m.name] ||= m; });
    // My soft white, the same as at the range; it dims with the lamps by hand.
    const toy = handMaterial('toy');
    const hands = {};
    for (const side of ['left', 'right']) {
      const h = makeRealHand(side, geo, toy);
      h.root.getObjectByName(`${side}_arm`).add(makeSleeve({ cloth: mats.M_Hoodie, rib: mats.M_Hoodie_Rib || mats.M_Hoodie }));
      group.add(h.root);
      hands[side] = h;
    }
    const o = origin();
    group.position.copy(o);
    scene.add(group);
    keysPress(o);
    kit = { hands, localsFor, P: DESK_POSES, KEYS, base: o.clone(), toy, white: toy.color.clone() };
  }

  // A key pressed while I sit: its finger strokes it. Letters, digits, space, Enter, Backspace, Tab and the arrows count.
  addEventListener('keydown', e => {
    if (!seated || e.repeat) return;
    const key = keyFor(e.code, e.key);
    if (!key) return;
    const f = fingerFor(key), home = HOME[f.side][f.digit];
    strokes.push({ ...f, key, k: key.join(), t: 0, away: home[0] !== key[0] || home[1] !== key[1] });
    lastKey = clock;
  }, true);
  addEventListener('pointerdown', () => { if (seated) clicks = 0.16; }, true);

  // One finger's angles: home, over to its key, pressed, lifted on the way, from the per-key table.
  function fingerPose(side, digit, base) {
    let a = base, shift = [0, 0, 0];
    for (const s of strokes) {
      if (s.side !== side || s.digit !== digit) continue;
      const e = strokeAt(s.t, s.away), K = kit.KEYS[side][digit][s.k];
      if (!K) continue;
      const on = lerpA(K.top, K.press, e.press);
      a = lerpA(lerpA(base, on, s.away ? e.over : 1), K.lift, e.lift * 0.5);
      shift = K.shift.map(v => v * e.over);
      press[s.key[0] * DESK.key.cols + s.key[1]] = Math.max(press[s.key[0] * DESK.key.cols + s.key[1]], e.press * TRAVEL);
    }
    return { a, shift };
  }
  function poseHand(side) {
    const P = kit.P, typed = P.home[side], other = side === 'left' ? P.mouse.left : P.rest.right, digits = {}, k = typing;
    let shift = [0, 0, 0];
    for (const d of FINGER_KEYS) {
      // A finger at rest on its key breathes a little; one stroking a key follows its stroke.
      const idle = typed.digits[d].map((v, i) => v + (i === 2 ? 0.015 * Math.sin(clock * 1.7 + FINGER_KEYS.indexOf(d) * 1.3 + (side === 'left' ? 2 : 0)) : 0));
      const f = fingerPose(side, d, idle);
      if (f.shift.some(Boolean)) shift = f.shift;
      digits[d] = lerpA(other.digits[d], f.a, k);
    }
    // A click presses the mouse hand's first finger for a moment.
    if (side === 'left' && clicks > 0 && k < 0.5) digits.index = lerpA(digits.index, [digits.index[0], digits.index[1] + 0.12, digits.index[2] + 0.05, digits.index[3]], Math.sin(Math.PI * clicks / 0.16));
    const at = lerp3(other.at, typed.at.map((v, i) => v + shift[i]), k);
    // Between the mouse and the keys the hand lifts off the desk on its way.
    at[1] += 0.03 * Math.sin(Math.PI * k) * (side === 'left' ? 1 : 0.5);
    const q = new THREE.Quaternion(...other.q).slerp(new THREE.Quaternion(...typed.q), k).toArray();
    const pose = { at, q, cup: other.cup + (typed.cup - other.cup) * k, digits };
    const s = side === 'left' ? -1 : 1;
    kit.hands[side].pose(pose, [at[0] - 0.24, at[1] - 0.03, at[2] + 0.07 * s]);
  }

  return {
    group,
    get loaded() { return !!kit; },
    get typing() { return typing; },
    get strokes() { return strokes.length; },
    press,
    // seated: I sit at the desk; body: my body is still drawn (the glide has not reached my eyes yet).
    tick(dt, isSeated, body) {
      seated = isSeated;
      clock += dt;
      if (seated && !loading) loading = load().catch(e => console.warn('[loft] the desk hands did not load', e));
      if (!kit) return;
      shown = Math.max(0, Math.min(1, shown + (seated && !body ? dt : -dt) / 0.45));
      group.visible = shown > 0;
      if (!group.visible) { strokes.length = 0; press.fill(0); return; }
      const want = clock - lastKey < 2.5 || playing() ? 1 : 0;
      typing = Math.max(0, Math.min(1, typing + (want ? dt : -dt) / 0.4));
      clicks = Math.max(0, clicks - dt);
      press.fill(0);
      for (const s of strokes) s.t += dt;
      for (let i = strokes.length - 1; i >= 0; i--) if (strokeAt(strokes[i].t, strokes[i].away).done) strokes.splice(i, 1);
      // They come up from below the desk's edge as I arrive, and go back down as I leave.
      const e = shown * shown * (3 - 2 * shown);
      group.position.copy(kit.base).add(new THREE.Vector3(-0.16 * (1 - e), -0.2 * (1 - e), 0));
      kit.toy.color.copy(kit.white).multiplyScalar(0.3 + 0.7 * lamp());
      poseHand('left'); poseHand('right');
    },
  };
}
