// The desk's own rules: the DEPLOY button, and the fan BH-22 switches on. Places are Blender axes, in metres.

// Where I stand to press DEPLOY: in front of the desk, beside the chair.
export const DEPLOY_SPOT = [20.75, 1.95, 0.45];

// How far the DEPLOY button is pushed in, 0 to 1, `e` seconds after a press: straight down, held, then back up.
export function pressDepth(e) {
  if (!(e >= 0)) return 0;
  if (e < 0.06) return e / 0.06;
  if (e < 0.28) return 1;
  return e < 0.5 ? 1 - (e - 0.28) / 0.22 : 0;
}

// The desk fan. While the PC is busy (a game on its screen, a deploy) BH-22 comes over to switch it on; it spins down
// once the PC has been quiet for COOL seconds, counted from when it came on if that was later. BH-22 still comes up to
// CALL seconds after the PC was last busy, so a short deploy still gets its fan. Set by hand (the terminal's `fan`), the
// fan stays as set until the PC next gets busy.
export const COOL = 20, CALL = 30;
// The fan's middle, from the DEPLOY button's point, as blender/zones/studio.py places the two; and where BH-22 stands on
// the studio floor to switch it on: off the desk's north end, clear of the rack beside it.
export const FAN_FROM_DEPLOY = [0.4, 0.4, 0.13], FAN_SPOT = [20.95, 2.5, 0.45];

// spell: when the PC's latest busy spell began. Once the fan has been on for a spell, BH-22 is not sent again for it.
export const newFan = () => ({ on: false, hand: false, was: false, spell: -Infinity, lastBusy: -Infinity, onAt: -Infinity });

// One step: 'call' (BH-22 should come and switch it on), 'off' (time to spin down), or null.
export function fanStep(s, busy, t) {
  if (busy && !s.was) { s.hand = false; s.spell = t; }
  s.was = busy;
  if (busy) s.lastBusy = t;
  if (s.hand) return null;
  if (!s.on) return t - s.lastBusy < CALL && s.onAt < s.spell ? 'call' : null;
  return t - Math.max(s.lastBusy, s.onAt) > COOL ? 'off' : null;
}

export function fanSet(s, on, t, hand = false) {
  s.on = on;
  s.hand = hand;
  if (on) s.onAt = t;
}

// How fast the blades turn, 0 to 1: up to speed in about a second, then a slow coast down that stops dead at the end.
export function fanSpin(k, on, dt) {
  if (on) return Math.min(1, k + dt / 1.1);
  const next = k * Math.exp(-dt / 1.6) - dt * 0.02;
  return next > 0 ? next : 0;
}
