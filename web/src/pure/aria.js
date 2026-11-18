// Aria's sticky note and what she says until she becomes the real voice agent. Blender axes: the desk chair looks
// along +x, z is up.
export const NOTE_LINES = ['Aria', 'my voice agent', 'coming soon'];
export const SAYS = [
  'Aria: "Hi, I\'m Aria, Behbod\'s voice agent. I\'m still waking up. Soon you can talk to me right here."',
  'Aria: "Still waking up. Come back soon and we can talk."',
];
export const NOTE_SIZE = 0.085;

const rad = d => d * Math.PI / 180;
const turn = (v, k, t) => {
  const c = Math.cos(t), s = Math.sin(t), d = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const x = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
  return v.map((q, i) => q * c + x[i] * s + k[i] * d * (1 - c));
};

// The tattoo post-it in blender/zones/studio.py, mirrored to the other end of the curved monitor's bottom bezel, the
// end Aria sits by. Corners top left, top right, bottom left, bottom right, as seen from the chair.
export function noteCorners({ center: [cx, cy, cz], w, h, r }) {
  const a = Math.asin((w / 2 - 0.11) / r), S = NOTE_SIZE;
  const top = [cx - r * (1 - Math.cos(a)), cy + r * Math.sin(a), cz - h / 2 - 0.005];
  const toward = [-Math.cos(a), -Math.sin(a), 0], along = [-Math.sin(a), Math.cos(a), 0];
  return [[S / 2, 0], [-S / 2, 0], [S / 2, -S], [-S / 2, -S]].map(([y, z]) => {
    const v = turn(turn(turn([0, y, z], [0, 0, 1], a), toward, rad(2.5)), along, rad(7));
    return v.map((q, i) => top[i] + toward[i] * 0.0035 + q);
  });
}
