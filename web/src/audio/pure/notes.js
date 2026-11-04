export const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);
export const freqToMidi = f => 69 + 12 * Math.log2(f / 440);

const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function noteToMidi(name) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note "${name}"`);
  return 12 * (+m[3] + 1) + LETTER[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

export const MODES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  majorPent: [0, 2, 4, 7, 9],
  minorPent: [0, 3, 5, 7, 10],
  // Shur: the second degree is koron (about a quarter tone flat), the colour that makes the mode.
  shur: [0, 1.5, 3, 5, 7, 8, 10],
};

export function degree(tonic, mode, d) {
  const n = mode.length, o = Math.floor(d / n), i = ((d % n) + n) % n;
  return tonic + 12 * o + mode[i];
}

export function inMode(midi, tonic, mode) {
  const pc = (((midi - tonic) % 12) + 12) % 12;
  return mode.some(x => Math.abs(x - pc) < 1e-6);
}

export const CHORDS = {
  maj: [0, 4, 7], min: [0, 3, 7],
  maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dom7: [0, 4, 7, 10],
  maj9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14], dom9: [0, 4, 7, 10, 14],
};

export function voiceChord(root, intervals, center) {
  return intervals.map(iv => {
    let n = root + iv;
    while (n < center - 6) n += 12;
    while (n >= center + 6) n -= 12;
    return n;
  }).sort((a, b) => a - b);
}

export const PIANO_KEYS = ['KeyA', 'KeyW', 'KeyS', 'KeyE', 'KeyD', 'KeyF', 'KeyT', 'KeyG', 'KeyY', 'KeyH', 'KeyU', 'KeyJ', 'KeyK', 'KeyO', 'KeyL', 'KeyP', 'Semicolon'];

// Pass the KeyboardEvent itself on keydown and keyup: a key releases the note it started even after an octave shift.
export function makeKeyMap(base = 60) {
  let octave = 0;
  const held = new Map();
  return {
    get octave() { return octave; },
    keyToMidi(code, type = 'keydown', repeat = false) {
      if (code && typeof code === 'object') { type = code.type || type; repeat = !!code.repeat; code = code.code; }
      const up = type === 'keyup';
      if (code === 'KeyZ' || code === 'KeyX') {
        if (!up && !repeat) octave = Math.max(-3, Math.min(3, octave + (code === 'KeyZ' ? -1 : 1)));
        return null;
      }
      const i = PIANO_KEYS.indexOf(code);
      if (i < 0) return null;
      if (up) {
        const m = held.get(code);
        held.delete(code);
        return m ?? null;
      }
      if (held.has(code)) return held.get(code);
      const m = base + 12 * octave + i;
      if (m < 21 || m > 108) return null;
      held.set(code, m);
      return m;
    },
  };
}
