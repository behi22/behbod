"""Build the whole loft: every zone, baked light, one model per zone and web/assets/world.json.

blender -b --factory-startup -P blender/build_world.py -- draft    (about two minutes, a quick look)
blender -b --factory-startup -P blender/build_world.py              (full quality)
blender -b --factory-startup -P blender/build_world.py -- reuse     (finish and export the last full bake again)
blender -b --factory-startup -P blender/build_world.py -- only=gallery,shell   (bake just these zones, reuse the rest)
blender -b --factory-startup -P blender/build_world.py -- meta  (only write web/assets/world.json, for the layout checks)
blender -b --factory-startup -P blender/build_world.py -- only=studio cpu=8   (bake on 8 processor cores instead of the graphics chip)
"""
import bpy, os, sys, random
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))).replace(os.sep, '/')
sys.path.insert(0, ROOT + '/blender')
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(7)
from lib.core import make_materials
from lib import bake
from zones import shell, studio, lounge, piano, teabar, entry, mezz, balcony, gallery, range as holo_range, world

M, E, G = make_materials()
for z in (shell, studio, lounge, piano, teabar, entry, mezz, balcony, gallery, holo_range):
    z.build(M, E, G)
world.build(M, E, G)
EXPOSURE = next((float(a[9:]) for a in ARGS if a.startswith('exposure=')), 1.3)
# `reuse` finishes and exports from the bakes saved in blender/build instead of baking again.
ONLY = next((set(a[5:].split(',')) for a in ARGS if a.startswith('only=')), None)
if 'meta' in ARGS:
    # Layout only: the room's data without baking or exporting, so the placement checks run in seconds.
    import json
    from lib.core import META
    with open(ROOT + '/web/assets/world.json', 'w') as f:
        json.dump(META, f, indent=1)
    print('world.json written (layout only)')
    sys.exit(0)
CPU = next((int(a[4:]) for a in ARGS if a.startswith('cpu=')), 0)
bake.build_all(ROOT, draft='draft' in ARGS, exposure=EXPOSURE, reuse='reuse' in ARGS, only=ONLY, cpu=CPU)
