// "hello, world" in the terminal and on the studio wall. Blender axes (x east, y north, z up), metres.

// Where it can be found; a later achievement asks for both.
export const FINDS = ['hoop', 'terminal'];

// The words themselves, as typed or inside a program's string: any case, an optional comma, a trailing ! or full stop.
const PHRASE = /^hello,?\s+world[.!]*$/i;

// A program that prints a string, by language. The string is the last capture; a quote capture must match its close.
const Q = String.raw`(["'])(.*)\1`, DQ = String.raw`"(.*)"`;
const PROGRAMS = [
  ['python', String.raw`print\s*\(\s*${Q}\s*\)`],
  ['python 2', String.raw`print\s+${Q}`],
  ['javascript', String.raw`console\.log\s*\(\s*(["'\x60])(.*)\1\s*\)`],
  ['javascript', String.raw`(?:window\.)?alert\s*\(\s*(["'\x60])(.*)\1\s*\)`],
  ['c', String.raw`printf\s*\(\s*${DQ}\s*\)`],
  ['c', String.raw`puts\s*\(\s*${DQ}\s*\)`],
  ['c++', String.raw`(?:std::)?cout\s*<<\s*${DQ}(?:\s*<<\s*(?:std::)?endl)?`],
  ['java', String.raw`System\.out\.print(?:ln)?\s*\(\s*${DQ}\s*\)`],
  ['c#', String.raw`Console\.Write(?:Line)?\s*\(\s*${DQ}\s*\)`],
  ['go', String.raw`fmt\.Print(?:ln|f)?\s*\(\s*${DQ}\s*\)`],
  ['rust', String.raw`println!\s*\(\s*${DQ}\s*\)`],
  ['kotlin', String.raw`println\s*\(\s*${DQ}\s*\)`],
  ['ruby', String.raw`puts\s+${Q}`],
  ['shell', String.raw`echo\s+(?:${Q}|(.+))`],
  ['php', String.raw`<\?php\s+echo\s+${Q}\s*;?\s*\?>`],
  ['haskell', String.raw`putStrLn\s+${DQ}`],
  ['basic', String.raw`\d+\s+PRINT\s+${DQ}`],
  ['powershell', String.raw`Write-(?:Host|Output)\s+${Q}`],
  ['elixir', String.raw`IO\.puts\s*\(?\s*${DQ}\s*\)?`],
  ['sql', String.raw`select\s+'(.*)'`],
  ['lisp', String.raw`\(\s*(?:print|princ|format\s+t)\s+${DQ}\s*\)`],
].map(([lang, src]) => [lang, new RegExp(`^${src}$`, 'i')]);
// C wrapped in main() is unwrapped and read again; the 1978 book's own main() had no int, void or return.
const MAIN = /^(int\s+)?main\s*\(\s*(void)?\s*\)\s*\{\s*(.*?)\s*;?\s*(return\s+0\s*;)?\s*\}$/;

const tidy = s => s.trim().replace(/\s+/g, ' ').replace(/\s*;+$/, '');
// A string literal's text as it would print: a trailing newline escape dropped.
const printed = s => s.replace(/(\\n)+$/, '');

// What the terminal answers to a line, or null when the line is not a hello world. `lang` is null for the bare words.
export function helloWorld(text) {
  if (typeof text !== 'string') return null;
  let line = tidy(text);
  if (!line || line.length > 80) return null;
  if (PHRASE.test(line)) return { lang: null, lines: ['hello, world', 'every programmer\'s first program.', 'try it in your favourite language too.'] };
  const wrapped = MAIN.exec(line);
  if (wrapped) line = tidy(wrapped[3]);
  for (const [lang, re] of PROGRAMS) {
    const m = re.exec(line);
    if (!m) continue;
    const out = printed(m.slice(1).filter(x => x !== undefined).pop() ?? '');
    if (!PHRASE.test(out.trim())) return null;
    const classic = wrapped && !wrapped[1] && !wrapped[2] && !wrapped[4] && lang === 'c' && out === 'hello, world';
    return { lang, lines: [out, classic ? 'that was c, as kernighan and ritchie printed it in 1978.' : `that was ${lang}. everyone starts here.`] };
  }
  return null;
}

// ---------- the cross-stitch ----------
// A 5 by 7 lowercase stitch font with one row below the line for the comma's tail. '#' is a stitch.
const GLYPHS = {
  h: ['#....', '#....', '#.##.', '##..#', '#...#', '#...#', '#...#', '.....'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.', '.....'],
  l: ['##.', '.#.', '.#.', '.#.', '.#.', '.#.', '###', '...'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.', '.....'],
  ',': ['..', '..', '..', '..', '..', '.#', '.#', '#.'],
  w: ['.....', '.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.', '.....'],
  r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....', '.....'],
  d: ['....#', '....#', '.##.#', '#..##', '#...#', '#...#', '.####', '.....'],
};
export const HOOP_LINES = ['hello,', 'world'];
const ROWS = 8, GAP = 2, CURSOR = { w: 3, h: 6 };

// ink: 0 the first line, 1 the second, 2 the cursor after it; u and v are centred on the cloth, v going up.
export function stitches() {
  const out = [];
  const width = s => [...s].reduce((w, ch, i) => w + GLYPHS[ch][0].length + (i ? 1 : 0), 0);
  const w0 = width(HOOP_LINES[0]), w1 = width(HOOP_LINES[1]) + 1 + CURSOR.w;
  const W = Math.max(w0, w1), H = ROWS * 2 + GAP;
  HOOP_LINES.forEach((line, li) => {
    let x = Math.round((W - (li ? w1 : w0)) / 2);
    const top = li * (ROWS + GAP);
    for (const ch of line) {
      const g = GLYPHS[ch];
      g.forEach((row, r) => [...row].forEach((c, k) => { if (c === '#') out.push({ col: x + k, row: top + r, ink: li }); }));
      x += g[0].length + 1;
    }
    if (li) for (let r = 0; r < CURSOR.h; r++) for (let k = 0; k < CURSOR.w; k++) out.push({ col: x + k, row: top + 1 + r, ink: 2 });
  });
  return { W, H, list: out.map(s => ({ ...s, u: s.col - (W - 1) / 2, v: (H - 1) / 2 - s.row })) };
}
// Reads the stitched lines back, one string per line, for the tests.
export function readStitches({ list }) {
  return HOOP_LINES.map((line, li) => {
    const mine = list.filter(s => s.ink === li), top = li * (ROWS + GAP), at = new Set(mine.map(s => `${s.col},${s.row}`));
    let x = Math.min(...mine.map(s => s.col)), text = '';
    while (text.length < line.length) {
      const hit = Object.entries(GLYPHS).find(([, g]) => g.every((row, r) => [...row].every((c, k) => (c === '#') === at.has(`${x + k},${top + r}`))));
      if (!hit) break;
      text += hit[0];
      x += hit[1][0].length + 1;
    }
    return text;
  });
}

// The hoop on the studio's south wall, between the STAY CURIOUS poster and the Claude poster, above the plant.
export const HOOP = { center: [16.965, 0.0, 2.1], radius: 0.19, stitch: 0.0078 };
export const SPOT = { id: 'hello_hoop', label: 'Look at the cross-stitch', at: [16.97, 1.15, 0.45], r: 0.45 };
export const SAYS = [
  'hello, world, cross-stitched one pixel at a time: the first thing almost every programmer makes a computer say. Try it on the computer.',
  'It goes back to Brian Kernighan at Bell Labs in the early 1970s. His 1978 book on C, with Dennis Ritchie, made it every programmer\'s first program.',
];
