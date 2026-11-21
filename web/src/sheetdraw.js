// The sheet music, drawn: an open book of two pages on a canvas, each page the song's own bars in a grand staff (the
// tune above, the left hand below) with clefs, the key, rests, beams, ties and page numbers. Drawn in code, no font.
import { accidentals, beams, spell, keyLetters, score } from './pure/sheet.js';

export const PAGE = { w: 420, h: 560 };
const S = 7;                                // one staff space, in canvas pixels
const INK = '#16140f', PAPER = '#f4f1e8', SERIF = "Georgia, 'Times New Roman', serif";
const STAFF = { treble: { top: 38, mid: 34 }, bass: { top: 26, mid: 22 } };
const GAP = 6 * S;                          // between the two staves of a system

// A smooth curve through the points (Catmull-Rom as Bezier segments), in staff spaces about (x, y).
function smooth(g, x, y, pts) {
  const P = pts.map(([u, v]) => [x + u * S, y + v * S]);
  g.moveTo(...P[0]);
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i - 1] || P[i], b = P[i], c = P[i + 1], d = P[i + 2] || c;
    g.bezierCurveTo(b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6, c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6, c[0], c[1]);
  }
}
function stroke(g, w, f) { g.beginPath(); f(); g.lineWidth = w * S; g.stroke(); }
function dot(g, x, y, r) { g.beginPath(); g.arc(x, y, r * S, 0, Math.PI * 2); g.fill(); }

// The G clef about the G line (y), the F clef about the F line.
function trebleClef(g, x, y) {
  const spiral = [[0.05, -0.3], [0.5, 0.05], [0.05, 0.65], [-0.5, 0.15], [0.0, -0.6], [0.85, -0.2], [0.75, 0.85], [-0.1, 1.15], [-0.95, 0.35]];
  const back = [[-0.95, 0.35], [-0.75, -0.95], [0.25, -2.35], [0.75, -3.55], [0.5, -4.45], [0.05, -4.1], [-0.2, -3.2], [-0.05, -1.6], [0.3, 0.6], [0.42, 1.9], [0.25, 2.55], [-0.3, 2.7], [-0.55, 2.35]];
  stroke(g, 0.17, () => smooth(g, x, y, spiral));
  stroke(g, 0.33, () => smooth(g, x, y, spiral.slice(5)));
  stroke(g, 0.17, () => smooth(g, x, y, back));
  stroke(g, 0.3, () => smooth(g, x, y, back.slice(0, 4)));
  dot(g, x - 0.42 * S, y + 2.2 * S, 0.32);
}
function bassClef(g, x, y) {
  dot(g, x + 0.05 * S, y + 0.05 * S, 0.36);
  stroke(g, 0.2, () => smooth(g, x, y, [[0.0, -0.2], [0.55, -0.62], [1.25, -0.25], [1.25, 0.85], [0.6, 1.95], [-0.25, 2.75]]));
  stroke(g, 0.36, () => smooth(g, x, y, [[0.55, -0.62], [1.25, -0.25], [1.25, 0.85], [0.75, 1.75]]));
  dot(g, x + 1.85 * S, y - 0.5 * S, 0.15); dot(g, x + 1.85 * S, y + 0.5 * S, 0.15);
}
function sharp(g, x, y) {
  stroke(g, 0.12, () => { g.moveTo(x - 0.22 * S, y - 1.25 * S); g.lineTo(x - 0.22 * S, y + 1.1 * S); g.moveTo(x + 0.22 * S, y - 1.1 * S); g.lineTo(x + 0.22 * S, y + 1.25 * S); });
  stroke(g, 0.3, () => { for (const k of [-0.45, 0.45]) { g.moveTo(x - 0.5 * S, y + (k + 0.15) * S); g.lineTo(x + 0.5 * S, y + (k - 0.15) * S); } });
}
function natural(g, x, y) {
  stroke(g, 0.12, () => { g.moveTo(x - 0.22 * S, y - 1.3 * S); g.lineTo(x - 0.22 * S, y + 0.5 * S); g.moveTo(x + 0.22 * S, y - 0.5 * S); g.lineTo(x + 0.22 * S, y + 1.3 * S); });
  stroke(g, 0.28, () => { for (const k of [-0.35, 0.45]) { g.moveTo(x - 0.22 * S, y + (k + 0.1) * S); g.lineTo(x + 0.22 * S, y + (k - 0.1) * S); } });
}
function head(g, x, y, open) {
  g.save(); g.translate(x, y); g.rotate(-0.38);
  g.beginPath(); g.ellipse(0, 0, 0.62 * S, 0.43 * S, 0, 0, Math.PI * 2); g.fill();
  if (open) { g.fillStyle = PAPER; g.beginPath(); g.ellipse(0, 0, 0.42 * S, 0.2 * S, -0.25, 0, Math.PI * 2); g.fill(); }
  g.restore();
}
function rest(g, x, top, dur, whole) {
  const y = top + 2 * S;                    // the middle line
  if (whole || dur >= 4) { g.fillRect(x - 0.6 * S, top + S, 1.2 * S, 0.5 * S); return; }
  if (dur >= 2) { g.fillRect(x - 0.6 * S, y - 0.5 * S, 1.2 * S, 0.5 * S); if (dur === 3) dot(g, x + 1.2 * S, y - 0.5 * S, 0.14); return; }
  if (dur >= 1) {
    stroke(g, 0.16, () => smooth(g, x, y, [[-0.3, -1.5], [0.3, -0.75], [-0.2, -0.05], [0.3, 0.6], [-0.3, 0.55], [0.0, 1.35]]));
    stroke(g, 0.36, () => smooth(g, x, y, [[0.3, -0.75], [-0.2, -0.05], [0.3, 0.6]]));
    if (dur === 1.5) dot(g, x + 1.0 * S, y - 0.5 * S, 0.14);
    return;
  }
  dot(g, x - 0.25 * S, y - 0.5 * S, 0.22);
  stroke(g, 0.13, () => { g.moveTo(x - 0.25 * S, y - 0.3 * S); g.quadraticCurveTo(x + 0.15 * S, y - 0.25 * S, x + 0.45 * S, y - 0.75 * S); g.lineTo(x - 0.05 * S, y + 1.0 * S); });
}

// One system: the two staves joined by a brace and bar lines, the bars spread across the width.
function system(g, sc, x0, x1, y, from, to, first) {
  const tops = { treble: y, bass: y + 4 * S + GAP }, bottom = tops.bass + 4 * S;
  g.fillStyle = INK; g.strokeStyle = INK;
  for (const t of Object.values(tops)) for (let l = 0; l < 5; l++) g.fillRect(x0, t + l * S - 0.6, x1 - x0, 1.2);
  g.fillRect(x0 - 0.6, y, 1.4, bottom - y);
  // The brace.
  g.beginPath();
  const bx = x0 - 0.9 * S, mid = (y + bottom) / 2;
  g.moveTo(bx, y); g.bezierCurveTo(bx - 1.4 * S, y + 2 * S, bx + 0.4 * S, mid - 2 * S, bx - 1.1 * S, mid);
  g.bezierCurveTo(bx + 0.4 * S, mid + 2 * S, bx - 1.4 * S, bottom - 2 * S, bx, bottom);
  g.bezierCurveTo(bx - 1.0 * S, bottom - 2 * S, bx + 0.9 * S, mid + 2 * S, bx - 1.1 * S, mid);
  g.bezierCurveTo(bx + 0.9 * S, mid - 2 * S, bx - 1.0 * S, y + 2 * S, bx, y);
  g.fill();
  let x = x0 + 0.9 * S;
  trebleClef(g, x + 0.8 * S, tops.treble + 3 * S);
  bassClef(g, x + 0.1 * S, tops.bass + S);
  x += 3.3 * S;
  const keys = keyLetters(sc.sharps);
  keys.forEach((letter, i) => {
    // F and C sit at the top of each staff: F5 and C5 above, F3 and C3 below.
    const tStep = 35 + letter - (letter > 4 ? 7 : 0), bStep = tStep - 14;
    sharp(g, x + i * 1.1 * S, staffY(tops.treble, 'treble', tStep));
    sharp(g, x + i * 1.1 * S, staffY(tops.bass, 'bass', bStep));
  });
  x += keys.length * 1.1 * S + (keys.length ? 0.6 * S : 0);
  if (first) {
    g.font = `700 ${2.6 * S}px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const t of Object.values(tops)) { g.fillText(String(sc.bpb), x + S, t + S); g.fillText('4', x + S, t + 3 * S); }
    x += 2.6 * S;
  } else if (from > 0) {
    g.font = `italic ${1.6 * S}px ${SERIF}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText(String(from + 1), x0 + 0.2 * S, y - 1.4 * S);
  }
  const w = (x1 - x) / (to - from), ties = [];
  for (let b = from; b < to; b++) {
    const bx0 = x + (b - from) * w, bx1 = bx0 + w;
    for (const staff of ['treble', 'bass']) {
      const voices = sc.bars[b][staff];
      voices.forEach((voice, v) => drawVoice(g, sc, voice, staff, tops[staff], bx0 + 1.6 * S, bx1 - 1.2 * S, voices.length > 1 ? (v ? 1 : -1) : 0, ties, x1));
    }
    const last = b === sc.bars.length - 1;
    g.fillRect(bx1 - (last ? 4 : 0.6), y, last ? 3 : 1.2, bottom - y);
    if (last) g.fillRect(bx1 - 6.5, y, 1.1, bottom - y);
  }
  return ties;
}

const staffY = (top, staff, step) => top + ((STAFF[staff].top - step) * S) / 2;

// One voice of one bar: `dir` is the stem direction (-1 up, 1 down, 0 by pitch).
function drawVoice(g, sc, voice, staff, top, xa, xb, dir, ties, sysEnd) {
  const xAt = beat => xa + (beat / sc.bpb) * (xb - xa);
  const signs = accidentals(voice, sc.sharps), groups = beams(voice), inBeam = new Map();
  groups.forEach(gr => gr.forEach(i => inBeam.set(i, gr)));
  const stems = [];
  voice.forEach((p, i) => {
    const x = xAt(p.beat);
    if (!p.midis.length) {
      const whole = voice.length === 1 && Math.abs(p.dur - sc.bpb) < 1e-6;
      rest(g, whole ? (xa + xb) / 2 : x + 0.3 * S, top + dir * 2 * S, p.dur, whole);
      return;
    }
    const steps = p.midis.map(m => spell(m).step), ys = steps.map(st => staffY(top, staff, st));
    const lo = Math.min(...steps), hi = Math.max(...steps), mid = STAFF[staff].mid;
    const gr = inBeam.get(i);
    const around = gr ? gr.flatMap(k => voice[k].midis.map(m => spell(m).step)) : [lo, hi];
    const sDir = dir || (around.reduce((a, b) => a + b, 0) / around.length >= mid ? 1 : -1);
    // Ledger lines above and below the staff.
    const bottomStep = STAFF[staff].top - 8;
    for (let k = bottomStep - 2; k >= lo; k -= 2) g.fillRect(x - 1.0 * S, staffY(top, staff, k) - 0.6, 2.0 * S, 1.2);
    for (let k = STAFF[staff].top + 2; k <= hi; k += 2) g.fillRect(x - 1.0 * S, staffY(top, staff, k) - 0.6, 2.0 * S, 1.2);
    steps.forEach((st, k) => {
      head(g, x, ys[k], p.dur >= 2);
      if (signs[i][k] === '#') sharp(g, x - 1.5 * S, ys[k]); else if (signs[i][k] === 'n') natural(g, x - 1.4 * S, ys[k]);
      if (p.dur === 3 || p.dur === 1.5) dot(g, x + 1.05 * S, ys[k] - ((st - bottomStep) % 2 === 0 ? 0.5 * S : 0), 0.15);
      // The tie coming in is taken before this note's own is added, or a note held over a system break finds its own.
      if (p.held) {
        const from = ties.findIndex(t => t.midi === p.midis[k] && t.voice === top + ':' + dir);
        const t = from >= 0 ? ties.splice(from, 1)[0] : { x: x - 3.2 * S, y: ys[k], dir: sDir };
        tie(g, t.x, x, ys[k], t.dir);
      }
      if (p.tie) ties.push({ x, y: ys[k], dir: sDir, midi: p.midis[k], end: sysEnd, voice: top + ':' + dir });
    });
    if (p.dur >= 4) return;
    const sx = x + (sDir < 0 ? 0.56 * S : -0.56 * S), yFar = sDir < 0 ? Math.min(...ys) : Math.max(...ys), yNear = sDir < 0 ? Math.max(...ys) : Math.min(...ys);
    const end = yFar + sDir * 3.4 * S;
    stems.push({ i, sx, yNear, end, dir: sDir });
    if (!gr) {
      g.fillRect(sx - 0.6, Math.min(yNear, end), 1.2, Math.abs(end - yNear));
      if (p.dur === 0.5) { g.beginPath(); g.moveTo(sx, end); g.bezierCurveTo(sx + 0.2 * S, end - sDir * 1.2 * S, sx + 1.3 * S, end - sDir * 1.4 * S, sx + 0.8 * S, end - sDir * 2.6 * S); g.lineWidth = 0.22 * S; g.stroke(); }
    }
  });
  // A beamed pair shares one beam, sloped at most a space, with neither stem shorter than it would be alone.
  for (const gr of groups) {
    const a = stems.find(s => s.i === gr[0]), b = stems.find(s => s.i === gr[1]);
    if (!a || !b) continue;
    const d = a.dir;
    let ya = a.end, yb = ya + Math.max(-S, Math.min(S, b.end - a.end));
    const k = d < 0 ? Math.min(0, a.end - ya, b.end - yb) : Math.max(0, a.end - ya, b.end - yb);
    ya += k; yb += k;
    g.fillRect(a.sx - 0.6, Math.min(a.yNear, ya), 1.2, Math.abs(ya - a.yNear));
    g.fillRect(b.sx - 0.6, Math.min(b.yNear, yb), 1.2, Math.abs(yb - b.yNear));
    g.beginPath();
    g.moveTo(a.sx - 0.6, ya); g.lineTo(b.sx + 0.6, yb); g.lineTo(b.sx + 0.6, yb - d * 0.5 * S); g.lineTo(a.sx - 0.6, ya - d * 0.5 * S);
    g.fill();
  }
}

function tie(g, xa, xb, y, dir) {
  // A long tie bows a little more, so it never reads as a staff line.
  const off = -dir * 0.7 * S, ya = y + off, bow = -dir * Math.min(1.6 * S, 0.5 * S + (xb - xa) * 0.025);
  g.beginPath();
  g.moveTo(xa + 0.7 * S, ya);
  g.quadraticCurveTo((xa + xb) / 2, ya + bow * 1.6, xb - 0.7 * S, ya);
  g.quadraticCurveTo((xa + xb) / 2, ya + bow * 1.1, xa + 0.7 * S, ya);
  g.fill();
}

// One page of the song at (ox, 0); `side` is which side its spine is on, for the paper's shading.
export function drawPage(g, sc, n, ox, side) {
  const { w, h } = PAGE;
  g.save();
  g.translate(ox, 0);
  const shade = g.createLinearGradient(side === 'left' ? w : 0, 0, side === 'left' ? 0 : w, 0);
  shade.addColorStop(0, '#d9d3c4'); shade.addColorStop(0.06, '#ebe6d9'); shade.addColorStop(0.2, PAPER); shade.addColorStop(1, '#f7f4ec');
  g.fillStyle = shade; g.fillRect(0, 0, w, h);
  const page = n === null ? null : sc.pages[n];
  if (page) {
    g.fillStyle = INK; g.strokeStyle = INK; g.lineCap = 'round'; g.lineJoin = 'round';
    let y = 104;
    if (n === 0) {
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.font = `700 ${3.3 * S}px ${SERIF}`; g.fillText(sc.heading, w / 2, 52);
      g.textAlign = 'right'; g.font = `italic ${1.75 * S}px ${SERIF}`; g.fillText(sc.composer, w - 22, 80);
      if (sc.marking) { g.textAlign = 'left'; g.font = `700 italic ${1.75 * S}px ${SERIF}`; g.fillText(sc.marking, 30, 110); }
      y = 150;
    }
    let bar = page.from;
    page.systems.forEach((count, k) => {
      const left = system(g, sc, 34, w - 20, y + k * 215, bar, bar + count, n === 0 && k === 0);
      // A tie carried over a system break runs to the edge and starts again before the next system's first note.
      for (const t of left) tie(g, t.x, t.end + 0.7 * S, t.y, t.dir);
      bar += count;
    });
    if (n > 0) {
      g.font = `${1.7 * S}px ${SERIF}`; g.textBaseline = 'alphabetic'; g.textAlign = side === 'left' ? 'left' : 'right';
      g.fillText(String(n + 1), side === 'left' ? 24 : w - 24, h - 22);
    }
  }
  g.restore();
}

// One side of the open book (page `n`, or null for a blank page), with its half of the fold.
export function drawSide(g, sc, n, side) {
  drawPage(g, sc, n, side === 'left' ? 0 : PAGE.w, side);
  g.fillStyle = 'rgba(60, 50, 35, 0.35)';
  g.fillRect(side === 'left' ? PAGE.w - 1 : PAGE.w, 0, 1, PAGE.h);
}
export function drawSpread(g, sc, left, right) {
  drawSide(g, sc, left, 'left');
  drawSide(g, sc, right, 'right');
}

// What the desk shows now (the piano changes it as songs play); panels.js draws the desk's canvas from it.
export const sheetState = { song: 'gymnopedie', left: 0, right: 1 };
export function drawSheet(g) {
  const sc = score(sheetState.song);
  drawSpread(g, sc, sheetState.left, sheetState.right);
}
