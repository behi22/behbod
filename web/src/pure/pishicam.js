// The Pishi cam's choices in room metres as in Blender (x east, y north, z up): which camera, how wide, what it says.

// High on the walls (and one over the sunken lounge, whose couches hide the floor), each over a part of the house she uses.
export const CAMS = [
  { n: 1, at: [6.2, 4.2, 2.5] },
  { n: 2, at: [5.6, 11.6, 3.3] },
  { n: 3, at: [14.2, 11.8, 2.7] },
  { n: 4, at: [18.2, 3.6, 2.5] },
  { n: 5, at: [7.4, 9.9, 3.5] },
];
// Another camera takes over only once it is this much closer, so she is not cut back and forth at a border.
export const SWITCH_BY = 0.8;
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function pickCam(cat, current = null) {
  let best = CAMS[0];
  for (const c of CAMS) if (dist2(c.at, cat) < dist2(best.at, cat)) best = c;
  const now = CAMS.find(c => c.n === current);
  return now && dist2(now.at, cat) <= dist2(best.at, cat) + SWITCH_BY ? now : best;
}

// The lens closes in as she gets further, so she fills about the same part of the picture wherever she is.
export const FRAME = 1.5, FOV_MIN = 14, FOV_MAX = 62;
export function fovFor(at, cat) {
  const d = Math.hypot(at[0] - cat[0], at[1] - cat[1], at[2] - cat[2]);
  return Math.min(FOV_MAX, Math.max(FOV_MIN, 2 * Math.atan(FRAME / 2 / Math.max(d, 0.1)) * 180 / Math.PI));
}

// Where she is, in the words of the house.
export function placeOf([x, y, z], state) {
  if (state === 'keys') return 'desk';
  if (state === 'window') return 'window sill';
  if (state === 'perch') return 'perch by the fire';
  if (z > 0.6 && x < 2.2) return y < 13.6 ? 'wall shelves' : 'cat tree';
  if (x > 15 && y < 7) return 'studio';
  if (x >= 2.4 && x <= 9.8 && y >= 7 && y <= 13.6) return 'lounge';
  if (x < 2.4 && y >= 7 && y <= 13.6) return 'by the fire';
  if (y > 13.6) return 'by the window';
  if (x > 15) return 'piano corner';
  if (x > 9.8 && y >= 7) return 'tea bar';
  if (x < 5 && y < 3) return 'front door';
  return 'hall';
}

const DOING = {
  window: 'watching outside', towindow: 'off to the window', climb: 'climbing', perch: 'asleep', treesit: 'hiding up high',
  flee: 'running off', wander: 'walking', down: 'jumping down', todesk: 'off to the desk', keys: 'walking on the keyboard',
  play: 'playing', treat: 'eating a treat', petted: 'being petted', totreat: 'off for a treat',
};
export const doingOf = (state, grooming = false) => (state === 'sit' ? (grooming ? 'grooming' : 'sitting') : DOING[state] || 'around');
