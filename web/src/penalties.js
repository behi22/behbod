import * as THREE from 'three';
import { b2t } from './engine.js';
import { penaltyResult, keeperGuess, landing } from './pure/penalties.js';

// Penalties at the mini goal in the keeper's corner, with BH-22 in goal. Five kicks: aim with the pointer or the
// arrows, shoot with a click, a tap or Space. BH-22 guesses a side and hops for it; the net or the droid gets the ball.
const KICKS = 5, FLIGHT = 0.42;

export function makePenalties(scene, meta, { creatures, sfx, toast, onGoal, onDone, onExit }) {
  const P = meta.points;
  if (!P.pen_spot || !P.pen_line || !meta.penalty) return null;
  const { width: GW, height: GH } = meta.penalty;
  const lineT = b2t(...P.pen_line), spotT = b2t(...P.pen_spot);
  // The ball: white with a few dark patches, resting on the spot until someone takes a kick.
  const ball = new THREE.Group();
  ball.add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 14), new THREE.MeshBasicMaterial({ color: 0xeeeeea, fog: true })));
  const patch = new THREE.MeshBasicMaterial({ color: 0x1d1f24, fog: true });
  for (const [x, y, z] of [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.026, 5), patch);
    d.position.set(x * 0.0752, y * 0.0752, z * 0.0752); d.lookAt(x * 2, y * 2, z * 2); ball.add(d);
  }
  const rest = () => ball.position.copy(spotT).add(new THREE.Vector3(0, 0.075, 0));
  rest();
  scene.add(ball);
  // The aim: a ring on the goal mouth.
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.035, 0.05, 28), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.95, depthTest: false }));
  ring.renderOrder = 5; ring.visible = false;
  ring.lookAt(spotT.clone().sub(lineT));
  scene.add(ring);
  // The goal mouth as a plane, for aiming with the pointer.
  const mouth = new THREE.Plane(new THREE.Vector3().subVectors(spotT, lineT).setY(0).normalize(), 0);
  mouth.constant = -mouth.normal.dot(lineT);
  const across = new THREE.Vector3(0, 0, -1);

  let active = false, state = 'idle', kicks = [], aim = { y: 0, z: GH * 0.45 }, flight = null, wait = 0, hud = null;
  const keeperAt = lineT.clone().add(mouth.normal.clone().multiplyScalar(0.16));
  const toPoint = (y, z) => lineT.clone().addScaledVector(across, y).setY(lineT.y + z);
  function place() { ring.position.copy(toPoint(aim.y, aim.z)).addScaledVector(mouth.normal, 0.01); }
  function showHud(text) {
    if (!hud) {
      hud = document.createElement('div');
      hud.className = 'pen-hud';
      Object.assign(hud.style, { position: 'fixed', left: '50%', bottom: '18px', transform: 'translateX(-50%)', zIndex: 25, padding: '10px 16px', borderRadius: '8px',
        background: 'rgba(5,7,11,.82)', color: '#e8edf5', font: "13px 'JetBrains Mono', ui-monospace, monospace", border: '1px solid rgba(62,230,196,.35)', textAlign: 'center', maxWidth: 'calc(100vw - 32px)' });
      document.body.append(hud);
    }
    const dots = Array.from({ length: KICKS }, (_, i) => (kicks[i] === 'goal' ? '●' : kicks[i] ? '✕' : '○')).join(' ');
    hud.textContent = `PENALTIES  ${dots}   ${text}`;
  }
  const goals = () => kicks.filter(k => k === 'goal').length;

  function nextKick() {
    if (kicks.length >= KICKS) {
      state = 'done';
      const n = goals();
      showHud(`${n} of ${KICKS}. Press E or tap to play again, Esc to leave.`);
      toast(n >= 4 ? `${n} of ${KICKS} past BH-22. Clinical.` : n >= 2 ? `${n} of ${KICKS} past BH-22.` : `BH-22 saved ${KICKS - n} of ${KICKS}. It is very proud.`);
      creatures.keeperReset();
      onDone?.(n);
      return;
    }
    state = 'aim'; rest(); ring.visible = true; place();
    creatures.keeperReset();
    showHud(`Kick ${kicks.length + 1} of ${KICKS}: aim, then click or Space to shoot. Esc to leave.`);
  }
  // A click, tap or Space: kicks while aiming, and starts again once all five are taken (phones have no E key).
  function shoot() {
    if (state === 'done') { api.again(); return; }
    if (state !== 'aim') return;
    state = 'flight'; ring.visible = false;
    const guess = keeperGuess(aim, GW, GH, Math.random), at = landing(aim, [(Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.05]);
    creatures.keeperDive(guess.dy, guess.hop);
    flight = { t: 0, from: ball.position.clone(), to: toPoint(at.y, at.z), result: penaltyResult(at, guess, GW, GH) };
    sfx?.kick?.(ball.position);
  }
  function start() {
    kicks = []; state = 'calling';
    showHud('BH-22 is on its way to the goal...');
    const ok = creatures.keeper(keeperAt, spotT, () => { if (active && state === 'calling') nextKick(); });
    if (!ok) { toast('BH-22 is busy with the tea. Try again in a moment.'); api.exit(); }
  }

  const api = {
    get active() { return active; },
    get state() { return state; },
    get kicks() { return kicks.slice(); },
    enter() { active = true; aim = { y: 0, z: GH * 0.45 }; start(); },
    exit() {
      if (!active) return;
      active = false; state = 'idle'; ring.visible = false; flight = null; rest();
      hud?.remove(); hud = null;
      creatures.keeperRelease();
      onExit?.();
    },
    again() { if (active && state === 'done') { kicks = []; nextKick(); } },
    shoot,
    // Aiming: by the pointer over the goal mouth, or nudged by the arrows (dy across, dz up, in metres a second).
    aimAt(ray) {
      if (state !== 'aim') return;
      const hit = ray.intersectPlane(mouth, new THREE.Vector3());
      if (!hit) return;
      aim.y = THREE.MathUtils.clamp(hit.clone().sub(lineT).dot(across), -GW / 2 - 0.02, GW / 2 + 0.02);
      aim.z = THREE.MathUtils.clamp(hit.y - lineT.y, 0.04, GH + 0.02);
      place();
    },
    nudge(dy, dz) {
      if (state !== 'aim') return;
      aim.y = THREE.MathUtils.clamp(aim.y + dy, -GW / 2 - 0.02, GW / 2 + 0.02);
      aim.z = THREE.MathUtils.clamp(aim.z + dz, 0.04, GH + 0.02);
      place();
    },
    // The camera: behind the spot, a little above, looking at the goal.
    view(out, look) {
      out.copy(spotT).addScaledVector(mouth.normal, 1.5).setY(spotT.y + 0.95);
      look.copy(lineT).setY(lineT.y + GH * 0.4);
    },
    tick(dt) {
      if (!active || state !== 'flight' || !flight) {
        if (active && state === 'result' && (wait -= dt) <= 0) nextKick();
        return;
      }
      flight.t = Math.min(1, flight.t + dt / FLIGHT);
      const t = flight.t, r = flight.result;
      // Saved: it meets the droid short of the line and drops back toward the spot.
      const end = r === 'saved' ? 0.82 : 1;
      ball.position.lerpVectors(flight.from, flight.to, Math.min(t, end)).add(new THREE.Vector3(0, Math.sin(Math.PI * Math.min(t, end)) * 0.06, 0));
      ball.rotation.x += dt * 22;
      if (t >= 1) {
        kicks.push(r === 'goal' ? 'goal' : r);
        if (r === 'goal') { onGoal?.(); toast('GOAL!'); }
        else toast(r === 'saved' ? 'Saved by BH-22!' : r === 'wide' ? 'Wide of the post.' : 'Over the bar.');
        if (r === 'goal') ball.position.copy(flight.to).addScaledVector(mouth.normal, -0.25).setY(lineT.y + 0.075);
        else if (r === 'saved') ball.position.copy(flight.from).lerp(flight.to, 0.55).setY(lineT.y + 0.075);
        flight = null; state = 'result'; wait = 1.3;
        showHud(r === 'goal' ? 'GOAL!' : r === 'saved' ? 'SAVED!' : 'MISSED!');
      }
    },
  };
  return api;
}
