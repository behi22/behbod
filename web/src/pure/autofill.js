// The terminal's autofill: the commands a half-typed line can still become, best first, and Tab's turn through them.

// The commands visitors reach for most, in that order; the rest follow from a to z.
export const OFTEN = ['help', 'whoami', 'ls', 'projects', 'github', 'contact', 'clear', 'music', 'scene', 'lights', 'print', 'film', 'deploy', 'exit'];

// Every command in `names` that the typed line is the start of (not the line itself), best first. Leading spaces are
// ignored; a line with a space in it is past the command's name, so it gets none.
export function suggest(typed, names, often = OFTEN) {
  const t = String(typed ?? '').trimStart().toLowerCase();
  if (!t || /\s/.test(t)) return [];
  const rank = n => { const i = often.indexOf(n); return i < 0 ? often.length : i; };
  return [...new Set(names)].filter(n => n.length > t.length && n.startsWith(t)).sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1));
}

// The faint rest of the best command, shown after what is typed, or ''.
export function ghost(typed, names, often = OFTEN) {
  const best = suggest(typed, names, often)[0];
  return best ? best.slice(String(typed).trimStart().length) : '';
}

export const newFill = () => ({ list: [], at: -1, line: null });

// Tab (+1) or Shift+Tab (-1) on the line as it stands: the line to show instead, or null when nothing fits. The first
// press fills the best (Shift+Tab the last); while the line is still the one a press gave, the next goes round the
// same matches.
export function step(f, typed, names, dir = 1, often = OFTEN) {
  if (f.line === null || typed !== f.line) {
    f.list = suggest(typed, names, often);
    f.at = -1;
  }
  if (!f.list.length) { f.line = null; return null; }
  const n = f.list.length, d = dir < 0 ? -1 : 1;
  f.at = f.at < 0 ? (d > 0 ? 0 : n - 1) : (f.at + d + n) % n;
  f.line = f.list[f.at];
  return f.line;
}
