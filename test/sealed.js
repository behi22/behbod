// Is the house sealed? Builds the house in Blender without baking and sends rays through the south, west and east
// walls (one every centimetre), the ceiling and the floor (every two) (blender/lib/sealed.py). A ray that gets past a
// wall went through a hole you could see out of the map through, like the gaps there used to be round the front door.
// Run it by hand after any change to the walls, doors, floors or ceiling; it is not part of `npm test` (it needs Blender).
//   node test/sealed.js        BLENDER=<path to blender> overrides where Blender is looked for.
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const guesses = [process.env.BLENDER, 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe', '/Applications/Blender.app/Contents/MacOS/Blender', 'blender'].filter(Boolean);
const blender = guesses.find(g => g === 'blender' || fs.existsSync(g));
const r = spawnSync(blender, ['-b', '--factory-startup', '-P', path.join(ROOT, 'blender', 'build_world.py'), '--', 'sealed'], { cwd: ROOT, encoding: 'utf8' });
if (r.error) { console.error('could not run Blender:', r.error.message); process.exit(2); }
const lines = (r.stdout || '').split(/\r?\n/).filter(l => /LEAK|sealed|SEALED/.test(l));
console.log(lines.join('\n') || (r.stderr || '').slice(-600));
process.exit(lines.some(l => l.trim() === 'sealed') && r.status === 0 ? 0 : 1);
