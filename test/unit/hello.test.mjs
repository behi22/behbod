import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { helloWorld, stitches, readStitches, HOOP_LINES, HOOP, SPOT, SAYS, FINDS } from '../../web/src/pure/hello.js';
import { checkLayout } from '../../web/src/pure/layoutcheck.js';
import { makeInteract } from '../../web/src/pure/interact.js';

const WORLD = JSON.parse(readFileSync(new URL('../../web/assets/world.json', import.meta.url), 'utf8'));
const fresh = () => JSON.parse(JSON.stringify(WORLD));
const raw = String.raw;

test('the bare words, typed any way, answer hello, world and point at the other languages', () => {
  for (const s of ['hello world', 'Hello World', 'hello, world', 'HELLO, WORLD!', '  hello   world.  ', 'hello world!!']) {
    const r = helloWorld(s);
    assert.ok(r, s);
    assert.equal(r.lang, null);
    assert.deepEqual(r.lines, ['hello, world', 'every programmer\'s first program.', 'try it in your favourite language too.']);
  }
});

test('a hello world program in each language prints its string as written and names the language', () => {
  const cases = [
    ['print("hello world")', 'python', 'hello world'],
    ["print('Hello, World!')", 'python', 'Hello, World!'],
    ['print "hello world"', 'python 2', 'hello world'],
    ['console.log("hello world");', 'javascript', 'hello world'],
    ['console.log(`Hello World`)', 'javascript', 'Hello World'],
    ['alert("hello, world")', 'javascript', 'hello, world'],
    [raw`printf("hello, world\n");`, 'c', 'hello, world'],
    ['puts("hello world")', 'c', 'hello world'],
    ['std::cout << "Hello, World!" << std::endl;', 'c++', 'Hello, World!'],
    ['cout << "hello world"', 'c++', 'hello world'],
    ['System.out.println("Hello, World!");', 'java', 'Hello, World!'],
    ['Console.WriteLine("Hello World");', 'c#', 'Hello World'],
    ['fmt.Println("hello world")', 'go', 'hello world'],
    ['println!("Hello, world!");', 'rust', 'Hello, world!'],
    ['println("hello world")', 'kotlin', 'hello world'],
    ['puts "hello world"', 'ruby', 'hello world'],
    ['echo hello world', 'shell', 'hello world'],
    ["echo 'hello, world'", 'shell', 'hello, world'],
    ['<?php echo "Hello World"; ?>', 'php', 'Hello World'],
    ['putStrLn "hello world"', 'haskell', 'hello world'],
    ['10 PRINT "HELLO WORLD"', 'basic', 'HELLO WORLD'],
    ['Write-Host "Hello World"', 'powershell', 'Hello World'],
    ['IO.puts "hello world"', 'elixir', 'hello world'],
    ["SELECT 'hello world';", 'sql', 'hello world'],
    ['(print "hello world")', 'lisp', 'hello world'],
  ];
  for (const [s, lang, out] of cases) {
    const r = helloWorld(s);
    assert.ok(r, s);
    assert.equal(r.lang, lang, s);
    assert.deepEqual(r.lines, [out, `that was ${lang}. everyone starts here.`], s);
  }
});

test('C wrapped in main() as in the 1978 book gets its own line; other mains are plain C', () => {
  assert.deepEqual(helloWorld(raw`main() { printf("hello, world\n"); }`).lines, ['hello, world', 'that was c, as kernighan and ritchie printed it in 1978.']);
  assert.deepEqual(helloWorld(raw`main(){printf("hello, world\n");}`).lines[1], 'that was c, as kernighan and ritchie printed it in 1978.');
  assert.deepEqual(helloWorld(raw`int main() { printf("Hello World\n"); }`).lines, ['Hello World', 'that was c. everyone starts here.']);
  // The book's main() had no int, no void and no return 0, so later C is not said to be as printed in 1978.
  for (const s of [raw`int main(void) { printf("hello, world\n"); return 0; }`, raw`int main() { printf("hello, world\n"); }`, raw`main(void) { printf("hello, world\n"); }`, raw`main() { printf("hello, world\n"); return 0; }`]) {
    assert.deepEqual(helloWorld(s).lines, ['hello, world', 'that was c. everyone starts here.'], s);
  }
});

test('the terminal hands the lowercased command to the house, and that still counts', () => {
  for (const s of ['System.out.println("Hello, World!");', 'Console.WriteLine("Hello World");', 'Write-Host "Hello World"']) {
    const cmd = s.trim().toLowerCase().replace(/\s+/g, ' ');
    assert.ok(helloWorld(cmd), cmd);
  }
});

test('anything else is left to the terminal: near misses, other strings, the printer, hello friend', () => {
  for (const s of ['hello', 'world', 'hello worlds', 'helloworld', 'hello there world', 'say hello world', 'print("vase")', 'print hello world',
    'print(hello world)', 'print("hello world"', 'echo hi', 'echo "hello world', 'hello friend', 'hello, friend', '', '   ', 'printf("hello world\\t")',
    'x'.repeat(81), null, undefined, 42]) {
    assert.equal(helloWorld(s), null, String(s));
  }
});

test('every answer fits the terminal window', () => {
  const longest = 'System.out.println("Hello, World!");';
  for (const s of ['hello world', longest, raw`main() { printf("hello, world\n"); }`, '<?php echo "Hello World"; ?>']) for (const l of helloWorld(s).lines) assert.ok(l.length <= 60, l);
});

test('the hoop reads hello, / world, with a cursor after world', () => {
  const st = stitches();
  assert.deepEqual(readStitches(st), HOOP_LINES);
  assert.deepEqual(HOOP_LINES, ['hello,', 'world']);
  const cursor = st.list.filter(s => s.ink === 2), world = st.list.filter(s => s.ink === 1);
  assert.equal(cursor.length, 18);
  assert.ok(Math.min(...cursor.map(s => s.col)) > Math.max(...world.map(s => s.col)) + 1, 'the cursor sits after the last letter, a gap between');
  assert.equal(new Set(st.list.map(s => `${s.col},${s.row}`)).size, st.list.length, 'no stitch twice');
});

test('every stitch is on the cloth, clear of the ring, and the text is centred', () => {
  const st = stitches(), cloth = HOOP.radius - 0.012;
  for (const s of st.list) assert.ok(Math.hypot(s.u, s.v) * HOOP.stitch + HOOP.stitch < cloth - 0.015, `${s.col},${s.row}`);
  const us = st.list.map(s => s.u), vs = st.list.map(s => s.v);
  assert.ok(Math.abs(Math.min(...us) + Math.max(...us)) <= 1 && Math.abs(Math.min(...vs) + Math.max(...vs)) <= 1);
  // Big enough to read from the spot: a letter at least 4 cm tall.
  assert.ok(7 * HOOP.stitch >= 0.04);
});

test('the hoop hangs between the two posters above the plant, flat on the wall', () => {
  const meta = fresh(), [x, y, z] = HOOP.center, R = HOOP.radius + 0.01;
  assert.equal(y, 0);
  const wallS = meta.colliders.find(c => c.name === 'wall_s_b');
  assert.equal(wallS.max[1], 0, 'the south wall face is at y 0');
  for (const w of meta.walls.filter(w => w.wall === 's')) assert.ok(x + R <= w.u[0] || x - R >= w.u[1] || z + R <= w.z[0] || z - R - 0.08 >= w.z[1], w.name);
  const near = meta.walls.filter(w => w.wall === 's' && Math.abs((w.u[0] + w.u[1]) / 2 - x) < 1.2).map(w => w.name).sort();
  assert.deepEqual(near, ['claude', 'poster']);
  const plant = meta.colliders.find(c => c.name === 'studio_plant2');
  assert.ok(x > plant.min[0] && x < plant.max[0] && z - R > plant.max[2] + 0.05, 'over the plant, clear of its top');
  // Its top (the nail) stays below the studio's ceiling line of things on the wall.
  assert.ok(z + HOOP.radius + 0.08 < 2.43 + 0.05);
});

test('its spot is on the studio floor with room to stand, and nothing else answers there', () => {
  const meta = fresh();
  meta.interact.push({ ...SPOT, at: [...SPOT.at] });
  const problems = checkLayout(meta).filter(p => p.startsWith(SPOT.id));
  assert.deepEqual(problems, []);
  const it = makeInteract(meta.interact), [x, y, z] = SPOT.at;
  assert.equal(it.nearest({ x, y: z, z: -y }).id, SPOT.id);
  for (const o of WORLD.interact) if (Math.abs(o.at[2] - z) < 1) assert.ok(Math.hypot(o.at[0] - x, o.at[1] - y) > o.r + SPOT.r - 0.05, o.id);
  // Standing there, the hoop is in front, within a couple of metres.
  assert.ok(Math.abs(x - HOOP.center[0]) < 0.1 && y - HOOP.center[1] > 0.9 && y - HOOP.center[1] < 1.6);
});

test('what it says: plain, short, no dashes, and the finds a later achievement can count', () => {
  assert.equal(SAYS.length, 2);
  for (const s of SAYS) { assert.ok(s.length < 170, s); assert.ok(!/[–—]/.test(s), s); }
  assert.ok(SAYS[0].includes('Try it on the computer'));
  assert.deepEqual(FINDS, ['hoop', 'terminal']);
});
