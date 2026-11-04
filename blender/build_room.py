import bpy, bmesh, math, json, sys, random
from mathutils import Vector, Matrix
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))).replace(os.sep, '/')

OUT = ROOT + '/web/assets/'
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
BAKE_PX = int(ARGS[0]) if ARGS else 2048
SAMPLES = int(ARGS[1]) if len(ARGS) > 1 else 128
random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene
col = scn.collection
META = {'colliders': [], 'floors': [], 'screens': {}, 'points': {}, 'leds': [], 'clocks': {}}


# ---------- materials ----------
def principled(name, color, rough=0.6, metal=0.0, emit=None, strength=0.0, alpha=1.0, transmission=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    if transmission:
        b.inputs['Transmission Weight'].default_value = transmission
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
    return m


def node_mat(name, build):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    build(nt, b)
    return m


def wood_floor(nt, b):
    n = nt.nodes
    tc = n.new('ShaderNodeTexCoord')
    mp = n.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1, 5.5, 1)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    br = n.new('ShaderNodeTexBrick')
    br.inputs['Scale'].default_value = 1.0
    br.inputs['Mortar Size'].default_value = 0.004
    br.inputs['Brick Width'].default_value = 1.4
    br.inputs['Row Height'].default_value = 0.18
    br.offset = 0.37
    br.inputs['Color1'].default_value = (0.20, 0.105, 0.055, 1)
    br.inputs['Color2'].default_value = (0.15, 0.075, 0.04, 1)
    br.inputs['Mortar'].default_value = (0.05, 0.03, 0.02, 1)
    nt.links.new(mp.outputs['Vector'], br.inputs['Vector'])
    wv = n.new('ShaderNodeTexWave')
    wv.inputs['Scale'].default_value = 3.0
    wv.inputs['Distortion'].default_value = 6.0
    wv.inputs['Detail'].default_value = 3.0
    nt.links.new(tc.outputs['Object'], wv.inputs['Vector'])
    mix = n.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 0.35
    nt.links.new(br.outputs['Color'], mix.inputs['A'])
    nt.links.new(wv.outputs['Color'], mix.inputs['B'])
    nt.links.new(mix.outputs['Result'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.45


def persian_rug(nt, b):
    n = nt.nodes
    tc = n.new('ShaderNodeTexCoord')
    sep = n.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs['Vector'])
    # Border rings and a medallion from the distance to the rug centre.
    sub_x = n.new('ShaderNodeMath'); sub_x.operation = 'SUBTRACT'; sub_x.inputs[1].default_value = 0.5
    sub_y = n.new('ShaderNodeMath'); sub_y.operation = 'SUBTRACT'; sub_y.inputs[1].default_value = 0.5
    nt.links.new(sep.outputs['X'], sub_x.inputs[0]); nt.links.new(sep.outputs['Y'], sub_y.inputs[0])
    cmb = n.new('ShaderNodeCombineXYZ')
    nt.links.new(sub_x.outputs[0], cmb.inputs['X']); nt.links.new(sub_y.outputs[0], cmb.inputs['Y'])
    ln = n.new('ShaderNodeVectorMath'); ln.operation = 'LENGTH'
    nt.links.new(cmb.outputs[0], ln.inputs[0])
    ramp = n.new('ShaderNodeValToRGB')
    nt.links.new(ln.outputs['Value'], ramp.inputs['Fac'])
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.0, (0.62, 0.42, 0.18, 1)
    els[1].position, els[1].color = 0.1, (0.28, 0.035, 0.04, 1)
    for pos, c in ((0.16, (0.06, 0.07, 0.16, 1)), (0.2, (0.3, 0.04, 0.045, 1)), (0.37, (0.32, 0.045, 0.05, 1)),
                   (0.39, (0.62, 0.45, 0.2, 1)), (0.42, (0.05, 0.06, 0.14, 1)), (0.47, (0.05, 0.06, 0.14, 1)),
                   (0.48, (0.62, 0.45, 0.2, 1)), (0.5, (0.2, 0.03, 0.035, 1))):
        e = els.new(pos)
        e.color = c
    ramp.color_ramp.interpolation = 'CONSTANT'
    vor = n.new('ShaderNodeTexVoronoi')
    vor.inputs['Scale'].default_value = 26
    nt.links.new(tc.outputs['Generated'], vor.inputs['Vector'])
    mix = n.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'OVERLAY'
    mix.inputs['Factor'].default_value = 0.25
    nt.links.new(ramp.outputs['Color'], mix.inputs['A'])
    nt.links.new(vor.outputs['Color'], mix.inputs['B'])
    nt.links.new(mix.outputs['Result'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.95


def noisy(color, scale=8, amount=0.12, rough=0.8):
    def build(nt, b):
        n = nt.nodes
        no = n.new('ShaderNodeTexNoise')
        no.inputs['Scale'].default_value = scale
        mix = n.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = amount
        mix.inputs['A'].default_value = (*color, 1)
        nt.links.new(no.outputs['Color'], mix.inputs['B'])
        nt.links.new(mix.outputs['Result'], b.inputs['Base Color'])
        b.inputs['Roughness'].default_value = rough
    return build


M = {
    'floor': node_mat('floor', wood_floor),
    'rug': node_mat('rug', persian_rug),
    'wall': node_mat('wall', noisy((0.42, 0.4, 0.37), 14, 0.15, 0.9)),
    'plinth': principled('plinth', (0.06, 0.06, 0.065), 0.5),
    'slat': node_mat('slat', noisy((0.24, 0.13, 0.07), 30, 0.3, 0.6)),
    'felt': principled('felt', (0.05, 0.05, 0.06), 0.9),
    'desk': node_mat('desk', noisy((0.16, 0.085, 0.045), 40, 0.25, 0.4)),
    'metal': principled('metal', (0.11, 0.115, 0.12), 0.35, 0.3),
    'black': principled('black', (0.015, 0.015, 0.018), 0.4),
    'plastic': principled('plastic', (0.04, 0.042, 0.048), 0.5),
    'keycap': principled('keycap', (0.11, 0.115, 0.13), 0.55),
    'chair': principled('chair', (0.03, 0.03, 0.035), 0.6),
    'chair_acc': principled('chair_acc', (0.55, 0.06, 0.08), 0.5),
    'pot': principled('pot', (0.74, 0.32, 0.16), 0.8),
    'leaf': principled('leaf', (0.15, 0.32, 0.17), 0.6),
    'leaf2': principled('leaf2', (0.24, 0.42, 0.22), 0.6),
    'soil': principled('soil', (0.06, 0.04, 0.03), 1.0),
    'pearl': principled('pearl', (0.82, 0.84, 0.88), 0.25),
    'aria_face': principled('aria_face', (0.02, 0.03, 0.06), 0.2),
    'book1': principled('book1', (0.35, 0.08, 0.07), 0.7), 'book2': principled('book2', (0.06, 0.16, 0.3), 0.7),
    'book3': principled('book3', (0.55, 0.45, 0.25), 0.7), 'book4': principled('book4', (0.1, 0.25, 0.2), 0.7),
    'sofa': principled('sofa', (0.16, 0.17, 0.2), 0.95),
    'gold': principled('gold', (0.75, 0.55, 0.2), 0.3, 0.15),
    'red': principled('red', (0.7, 0.03, 0.04), 0.3),
    'ceiling': principled('ceiling', (0.08, 0.075, 0.07), 0.9),
    'clockface': principled('clockface', (0.85, 0.84, 0.8), 0.6),
    'tea': principled('tea', (0.5, 0.12, 0.02), 0.1),
    'lampshade': principled('lampshade', (0.9, 0.82, 0.65), 0.9),
    'cable': principled('cable', (0.02, 0.02, 0.02), 0.6),
}
E = {  # emitters: lit at runtime and kept out of the bake target, but they light the bake
    'screen': principled('E_screen', (0, 0, 0), 0.3, emit=(0.55, 0.7, 1.0), strength=2.5),
    'rgb_purple': principled('E_purple', (0, 0, 0), 0.5, emit=(0.55, 0.15, 1.0), strength=12),
    'rgb_teal': principled('E_teal', (0, 0, 0), 0.5, emit=(0.1, 0.9, 0.8), strength=10),
    'warm': principled('E_warm', (0, 0, 0), 0.5, emit=(1.0, 0.62, 0.3), strength=8),
    'onair': principled('E_onair', (0, 0, 0), 0.5, emit=(1.0, 0.08, 0.06), strength=6),
    'led_green': principled('E_led_green', (0, 0, 0), 0.5, emit=(0.2, 1.0, 0.4), strength=6),
    'led_blue': principled('E_led_blue', (0, 0, 0), 0.5, emit=(0.2, 0.5, 1.0), strength=6),
    'aria_eye': principled('E_aria_eye', (0, 0, 0), 0.5, emit=(0.2, 1.0, 0.85), strength=6),
    'sky': principled('E_sky', (0, 0, 0), 1.0, emit=(0.12, 0.17, 0.32), strength=1.6),
}
G = {
    'glass': principled('G_glass', (0.8, 0.9, 1.0), 0.02, transmission=1.0),
    'teaglass': principled('G_teaglass', (0.9, 0.9, 0.9), 0.02, transmission=1.0),
}
for m in G.values():
    if hasattr(m, 'surface_render_method'):
        m.surface_render_method = 'BLENDED'

BAKED, EMIT, GLASS = [], [], []


# ---------- geometry helpers ----------
def link(name, bm, mat, group):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    col.objects.link(o)
    me.materials.append(mat)
    group.append(o)
    return o


def box(name, size, loc, mat, bevel=0.0, group=None, rot=0.0, seg=2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=seg, profile=0.5, affect='EDGES')
    if rot:
        bmesh.ops.rotate(bm, cent=Vector(), matrix=Matrix.Rotation(rot, 3, 'Z'), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(loc), verts=bm.verts)
    return link(name, bm, mat, BAKED if group is None else group)


def cyl(name, r, h, loc, mat, seg=24, group=None, axis='Z', r2=None, cap=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    if axis == 'X':
        bmesh.ops.rotate(bm, cent=Vector(), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'), verts=bm.verts)
    elif axis == 'Y':
        bmesh.ops.rotate(bm, cent=Vector(), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(loc), verts=bm.verts)
    return link(name, bm, mat, BAKED if group is None else group)


def sphere(name, r, loc, mat, sub=3, group=None, scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(loc), verts=bm.verts)
    o = link(name, bm, mat, BAKED if group is None else group)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def plane(name, w, h, loc, mat, normal='-X', group=None):
    # A quad facing `normal`, UV 0..1 so runtime canvases map onto it.
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    hw, hh = w / 2, h / 2
    if normal == '-X':
        pts = [(0, hw, -hh), (0, -hw, -hh), (0, -hw, hh), (0, hw, hh)]
    elif normal == '+X':
        pts = [(0, -hw, -hh), (0, hw, -hh), (0, hw, hh), (0, -hw, hh)]
    elif normal == '-Y':
        pts = [(-hw, 0, -hh), (hw, 0, -hh), (hw, 0, hh), (-hw, 0, hh)]
    else:
        pts = [(hw, 0, -hh), (-hw, 0, -hh), (-hw, 0, hh), (hw, 0, hh)]
    vs = [bm.verts.new(Vector(p) + Vector(loc)) for p in pts]
    f = bm.faces.new(vs)
    for l, (u, v) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        l[uv].uv = (u, v)
    return link(name, bm, mat, EMIT if group is None else group)


def collider(name, mn, mx):
    META['colliders'].append({'name': name, 'min': list(mn), 'max': list(mx)})


# ---------- shell: split level, walls, window ----------
FX0, FX1, FY0, FY1 = -3.6, 3.5, -1.5, 3.0
box('studio_floor', (FX1 - FX0, FY1 - FY0, 0.45), ((FX0 + FX1) / 2, (FY0 + FY1) / 2, -0.225), M['floor'])
box('lounge_floor', (FX1 - FX0, 2.6, 0.1), ((FX0 + FX1) / 2, -2.8, -0.5), M['floor'])
META['floors'].append({'min': [FX0, FY0], 'max': [FX1, FY1], 'z': 0.0})
META['floors'].append({'min': [FX0, -4.1], 'max': [FX1, FY0], 'z': -0.45})
for i, (y0, z) in enumerate(((-1.5, -0.15), (-1.8, -0.3))):
    box(f'step{i}', (2.0, 0.3, 0.45 + z), (0.0, y0 - 0.15, -0.45 + (0.45 + z) / 2), M['floor'], bevel=0.006)
    META['floors'].append({'min': [-1.0, y0 - 0.3], 'max': [1.0, y0], 'z': z})
box('step_lip_led', (FX1 - FX0 - 0.1, 0.02, 0.012), ((FX0 + FX1) / 2, FY0 - 0.012, -0.04), E['rgb_purple'], group=EMIT)
box('wall_east', (0.2, 7.2, 5.1), (FX1 + 0.1, -0.5, 2.1), M['wall'])
box('wall_north_low', (6.0, 0.2, 0.4), (FX0 + 3.0, FY1 + 0.1, 0.2), M['wall'])
box('wall_north_east', (1.2, 0.2, 5.1), (FX1 - 0.6, FY1 + 0.1, 2.1), M['wall'])
box('ceiling', (8, 8, 0.1), (0, -0.5, 4.6), M['ceiling'])
box('wall_north_upper', (6.0, 0.2, 1.6), (FX0 + 3.0, FY1 + 0.1, 3.8), M['wall'])
collider('wall_east', (FX1, -5, -1), (FX1 + 1, 5, 4))
collider('wall_north', (-5, FY1, -1), (5, FY1 + 1, 4))
collider('edge_west', (FX0 - 1, -5, -1), (FX0, 5, 4))
collider('edge_south', (-5, -4.6, -1), (5, -4.1, 4))
box('plinth_east', (0.02, 4.5, 0.08), (FX1 - 0.01, 0.75, 0.04), M['plinth'])
# Window wall to the north: frame and mullions, glass, and the city outside.
for i, x in enumerate((FX0, FX0 + 1.5, FX0 + 3.0, FX0 + 4.5, FX0 + 6.0)):
    box(f'mullion{i}', (0.06, 0.12, 2.6), (x, FY1 + 0.05, 1.7), M['black'])
box('window_head', (6.0, 0.14, 0.08), (FX0 + 3.0, FY1 + 0.05, 2.98), M['black'])
box('window_sill', (6.0, 0.3, 0.05), (FX0 + 3.0, FY1 - 0.08, 0.42), M['desk'], bevel=0.008)
plane('window_glass', 6.0, 2.6, (FX0 + 3.0, FY1 + 0.06, 1.7), G['glass'], '-Y', group=GLASS)
plane('backdrop', 60, 22, (0, 24, 6), E['sky'], '-Y')
# Slat wall behind the desk with LED strips.
for i in range(26):
    box(f'slat{i}', (0.03, 0.045, 2.55), (FX1 - 0.03, -0.75 + i * 0.105, 1.3), M['slat'], bevel=0.004)
box('slat_led_top', (0.02, 2.8, 0.02), (FX1 - 0.07, 0.6, 2.62), E['rgb_teal'], group=EMIT)

# ---------- desk ----------
DX0, DX1, DY0, DY1, DZ = 2.68, 3.45, -0.75, 1.95, 0.76
box('desk_top', (DX1 - DX0, DY1 - DY0, 0.04), ((DX0 + DX1) / 2, (DY0 + DY1) / 2, DZ - 0.02), M['desk'], bevel=0.008)
for y in (DY0 + 0.06, DY1 - 0.06):
    box(f'desk_leg{y:.1f}', (0.66, 0.05, DZ - 0.04), ((DX0 + DX1) / 2, y, (DZ - 0.04) / 2), M['metal'], bevel=0.01)
box('desk_beam', (0.05, DY1 - DY0 - 0.2, 0.06), (DX1 - 0.15, (DY0 + DY1) / 2, 0.5), M['metal'])
box('desk_underglow', (0.02, DY1 - DY0 - 0.2, 0.012), (DX0 + 0.03, (DY0 + DY1) / 2, DZ - 0.05), E['rgb_purple'], group=EMIT)
collider('desk', (DX0, DY0, -1), (4, DY1, DZ))
# Main 45 inch ultrawide, curved, on an arm.
MW, MH, MR = 1.07, 0.45, 1.6
MC = Vector((3.1, 0.62, 1.17))
bm = bmesh.new()
uv = bm.loops.layers.uv.new('UVMap')
cols, ang = 24, MW / MR
grid = []
for i in range(cols + 1):
    a = -ang / 2 + ang * i / cols
    y = MC.y + MR * math.sin(a)
    x = MC.x - MR * (1 - math.cos(a))
    grid.append([bm.verts.new((x, y, MC.z - MH / 2)), bm.verts.new((x, y, MC.z + MH / 2))])
for i in range(cols):
    f = bm.faces.new((grid[i + 1][0], grid[i][0], grid[i][1], grid[i + 1][1]))
    u0, u1 = 1 - (i + 1) / cols, 1 - i / cols
    for l, t in zip(f.loops, ((u0, 0), (u1, 0), (u1, 1), (u0, 1))):
        l[uv].uv = t
scr = link('screen_main', bm, E['screen'], EMIT)
# The monitor's body follows the screen's curve: a thin curved shell with a bezel lip, built column by column.
bm = bmesh.new()
ring = []
for i in range(cols + 1):
    a = -(ang * 1.025) / 2 + ang * 1.025 * i / cols
    y = MC.y + MR * math.sin(a)
    x = MC.x - MR * (1 - math.cos(a))
    zb, zt = MC.z - MH / 2 - 0.014, MC.z + MH / 2 + 0.014
    ring.append([bm.verts.new((x + 0.002, y, zb)), bm.verts.new((x + 0.002, y, zt)),
                 bm.verts.new((x + 0.04, y, zt)), bm.verts.new((x + 0.04, y, zb))])
for i in range(cols):
    for k in range(4):
        bm.faces.new((ring[i][k], ring[i + 1][k], ring[i + 1][(k + 1) % 4], ring[i][(k + 1) % 4]))
for side in (ring[0], ring[-1][::-1]):
    bm.faces.new(side)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
link('monitor_back', bm, M['black'], BAKED)
box('monitor_arm', (0.05, 0.05, 0.42), (3.3, 0.62, DZ + 0.21), M['metal'], bevel=0.01)
box('monitor_arm2', (0.16, 0.04, 0.04), (3.27, 0.62, 1.12), M['metal'], bevel=0.01)
META['screens']['main'] = {'center': list(MC), 'w': MW, 'h': MH, 'r': MR}
# Post-it on the bottom right of the main monitor (text drawn at runtime in Nastaliq).
PY = MC.y - MW / 2 + 0.11
PX = MC.x - MR * (1 - math.cos((PY - MC.y) / MR)) - 0.006
plane('postit', 0.085, 0.085, (PX, PY, MC.z - MH / 2 + 0.035), principled('postit', (0.98, 0.86, 0.32), 0.9), '-X', group=EMIT)
META['points']['postit'] = [PX, PY, MC.z - MH / 2 + 0.035]
# Vertical code monitor on the left, angled in.
vm = Vector((3.12, -0.32, 1.2))
plane('screen_code', 0.34, 0.6, (0, 0, 0), E['screen'], '-X')
o = bpy.data.objects['screen_code']
o.rotation_euler = (0, 0, math.radians(-28))
o.location = vm
box('vmon_back', (0.035, 0.37, 0.63), (0, 0, 0), M['black'], bevel=0.01).matrix_world = Matrix.Translation(vm + Vector((0.025, 0.012, 0))) @ Matrix.Rotation(math.radians(-28), 4, 'Z')
box('vmon_stand', (0.04, 0.04, 0.3), (3.18, -0.3, DZ + 0.15), M['metal'])
cyl('vmon_base', 0.11, 0.015, (3.18, -0.3, DZ + 0.008), M['metal'])
META['screens']['code'] = {'center': list(vm), 'w': 0.34, 'h': 0.6, 'yaw': -28}
# Three little screens under the main one: contributions, training loss, Pishi cam.
for i, (y, nm) in enumerate(((0.2, 'contrib'), (0.62, 'loss'), (1.04, 'pishi'))):
    box(f'mini_case_{nm}', (0.05, 0.18, 0.115), (2.98, y, DZ + 0.075), M['black'], bevel=0.008)
    plane(f'screen_{nm}', 0.16, 0.095, (2.954, y, DZ + 0.078), E['screen'], '-X')
    META['screens'][nm] = {'center': [2.954, y, DZ + 0.078], 'w': 0.16, 'h': 0.095}
# Keyboard: a case with a grid of keycaps.
kb = Vector((2.86, 0.62, DZ + 0.018))
box('kb_case', (0.15, 0.44, 0.022), kb, M['plastic'], bevel=0.006)
bm = bmesh.new()
for r in range(5):
    for c in range(15):
        g = bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=Vector((0.022, 0.024, 0.012)), verts=g['verts'])
        bmesh.ops.translate(bm, vec=kb + Vector((-0.055 + r * 0.027, -0.196 + c * 0.028, 0.016)), verts=g['verts'])
link('keycaps', bm, M['keycap'], BAKED)
box('kb_glow', (0.152, 0.442, 0.004), kb + Vector((0, 0, -0.012)), E['rgb_teal'], group=EMIT)
box('mouse', (0.11, 0.065, 0.035), (2.88, 1.03, DZ + 0.018), M['plastic'], bevel=0.016, seg=4)
# Stream deck, DEPLOY button, mic boom with ON AIR light.
box('streamdeck', (0.09, 0.12, 0.03), (2.86, 0.18, DZ + 0.02), M['black'], bevel=0.006, rot=0)
for r in range(3):
    for c in range(5):
        box(f'sd_key{r}{c}', (0.018, 0.018, 0.006), (2.835 + r * 0.025, 0.13 + c * 0.024, DZ + 0.037), E['rgb_teal'] if (r + c) % 3 else E['rgb_purple'], group=EMIT)
cyl('deploy_base', 0.045, 0.02, (2.88, 1.27, DZ + 0.01), M['black'])
sphere('deploy_btn', 0.035, (2.88, 1.27, DZ + 0.022), E['onair'], group=EMIT, scale=(1, 1, 0.55))
META['points']['deploy'] = [2.88, 1.27, DZ + 0.03]
cyl('mic_clamp', 0.02, 0.08, (3.35, 1.45, DZ + 0.04), M['metal'])
box('mic_arm1', (0.025, 0.025, 0.45), (3.3, 1.42, DZ + 0.28), M['metal']).rotation_euler = (math.radians(12), math.radians(-18), 0)
box('mic_arm2', (0.4, 0.022, 0.022), (3.1, 1.32, 1.02), M['metal']).rotation_euler = (0, math.radians(18), math.radians(16))
cyl('mic', 0.028, 0.15, (2.92, 1.26, 0.98), M['black'], axis='Z')
box('onair_box', (0.03, 0.24, 0.08), (DX1 - 0.02, 0.62, 1.58), M['black'], bevel=0.006)
plane('onair', 0.22, 0.06, (DX1 - 0.04, 0.62, 1.58), E['onair'], '-X')
# PC tower behind glass with GPUs, fans and a coolant loop.
PCX, PCY = 3.12, 1.68
box('pc_case', (0.48, 0.24, 0.5), (PCX, PCY, DZ + 0.25), M['black'], bevel=0.01)
box('pc_board', (0.4, 0.01, 0.42), (PCX + 0.02, PCY + 0.1, DZ + 0.26), M['plastic'])
box('gpu1', (0.32, 0.05, 0.1), (PCX - 0.02, PCY + 0.05, DZ + 0.2), M['metal'], bevel=0.006)
box('gpu2', (0.32, 0.05, 0.1), (PCX - 0.02, PCY + 0.05, DZ + 0.33), M['metal'], bevel=0.006)
box('gpu1_led', (0.3, 0.004, 0.012), (PCX - 0.02, PCY + 0.022, DZ + 0.2), E['rgb_purple'], group=EMIT)
box('gpu2_led', (0.3, 0.004, 0.012), (PCX - 0.02, PCY + 0.022, DZ + 0.33), E['rgb_purple'], group=EMIT)
for i in range(3):
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=False, segments=24, radius=0.055)
    bmesh.ops.rotate(bm, cent=Vector(), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'), verts=bm.verts)
    ring = bmesh.ops.extrude_edge_only(bm, edges=bm.edges[:])
    for g in ring['geom']:
        if isinstance(g, bmesh.types.BMVert):
            g.co *= 0.82
    bmesh.ops.translate(bm, vec=Vector((PCX - 0.235, PCY, DZ + 0.12 + i * 0.13)), verts=bm.verts)
    bmesh.ops.rotate(bm, cent=Vector((PCX - 0.235, PCY, DZ + 0.12 + i * 0.13)), matrix=Matrix.Rotation(math.pi / 2, 3, 'Z'), verts=bm.verts)
    link(f'fan{i}', bm, E['rgb_teal'], EMIT)
cyl('coolant_tube', 0.009, 0.36, (PCX + 0.1, PCY + 0.03, DZ + 0.26), E['rgb_teal'], seg=10, group=EMIT)
cyl('cpu_block', 0.035, 0.02, (PCX + 0.06, PCY + 0.09, DZ + 0.36), E['rgb_teal'], axis='Y', group=EMIT)
plane('pc_glass', 0.46, 0.48, (PCX, PCY - 0.121, DZ + 0.25), G['glass'], '-Y', group=GLASS)
collider('pc', (PCX - 0.25, PCY - 0.13, -1), (PCX + 0.25, PCY + 0.13, DZ + 0.5))
# Server rack in the corner with status LEDs.
RX, RY = 3.12, 2.6
box('rack', (0.62, 0.62, 1.25), (RX, RY, 0.625), M['black'], bevel=0.012)
for u in range(7):
    box(f'rack_unit{u}', (0.01, 0.54, 0.12), (RX - 0.31, RY, 0.18 + u * 0.15), M['plastic'])
    for k in range(6):
        nm = f'led_{u}_{k}'
        box(nm, (0.006, 0.012, 0.008), (RX - 0.318, RY - 0.22 + k * 0.02, 0.2 + u * 0.15), E['led_green'] if k % 2 else E['led_blue'], group=EMIT)
        META['leds'].append(nm)
collider('rack', (RX - 0.31, RY - 0.31, -1), (RX + 0.31, RY + 0.31, 1.25))
# Headset on a stand, tea in an estekan, the succulent, a closed sticker laptop.
cyl('hs_base', 0.06, 0.012, (2.95, -0.62, DZ + 0.006), M['metal'])
cyl('hs_pole', 0.008, 0.26, (2.95, -0.62, DZ + 0.13), M['metal'])
bm = bmesh.new()
bmesh.ops.create_circle(bm, cap_ends=False, segments=20, radius=0.085)
bmesh.ops.rotate(bm, cent=Vector(), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'), verts=bm.verts)
bmesh.ops.translate(bm, vec=Vector((2.95, -0.62, DZ + 0.22)), verts=bm.verts)
geom = bmesh.ops.extrude_edge_only(bm, edges=bm.edges[:])
bmesh.ops.translate(bm, vec=Vector((0.03, 0, 0)), verts=[g for g in geom['geom'] if isinstance(g, bmesh.types.BMVert)])
link('headset_band', bm, M['black'], BAKED)
for s in (-1, 1):
    cyl(f'hs_cup{s}', 0.045, 0.03, (2.95, -0.62 + s * 0.085, DZ + 0.16), M['black'], axis='Y')
cyl('saucer', 0.05, 0.006, (2.82, -0.2, DZ + 0.003), M['clockface'])
cyl('estekan', 0.022, 0.07, (2.82, -0.2, DZ + 0.04), G['teaglass'], seg=16, group=GLASS, r2=0.026)
cyl('tea', 0.02, 0.055, (2.82, -0.2, DZ + 0.033), M['tea'], seg=16, r2=0.024)
cyl('succ_pot', 0.045, 0.07, (3.36, -0.66, DZ + 0.035), M['pot'], r2=0.055)
cyl('succ_soil', 0.05, 0.005, (3.36, -0.66, DZ + 0.068), M['soil'])
for i in range(14):
    a = i * 2.4
    rr = 0.012 + 0.0025 * i
    leaf = sphere(f'succ_leaf{i}', 0.018, (3.36 + math.cos(a) * rr, -0.66 + math.sin(a) * rr, DZ + 0.085 - i * 0.001), M['leaf2'] if i % 2 else M['leaf'], sub=1, scale=(1.6, 0.7, 0.5))
    leaf.rotation_euler = (0, -0.5, a)
box('laptop', (0.24, 0.3, 0.018), (3.24, -0.4, DZ + 0.009), M['metal'], bevel=0.006)
for i, c in enumerate(('red', 'gold', 'book2', 'leaf2')):
    box(f'sticker{i}', (0.05, 0.05, 0.001), (3.19 + (i % 2) * 0.09, -0.46 + (i // 2) * 0.11, DZ + 0.0185), M[c])
# Aria, the desk robot: pearl sphere, dark face, teal eyes, small wheeled base.
AR = Vector((3.22, -0.06, DZ + 0.12))
sphere('aria_body', 0.075, AR, M['pearl'], sub=3)
cyl('aria_base', 0.06, 0.035, (AR.x, AR.y, DZ + 0.02), M['plastic'])
for s in (-1, 1):
    cyl(f'aria_wheel{s}', 0.022, 0.012, (AR.x, AR.y + s * 0.055, DZ + 0.022), M['black'], axis='Y')
box('aria_face', (0.02, 0.085, 0.05), (AR.x - 0.064, AR.y, AR.z + 0.005), M['aria_face'], bevel=0.012)
for s in (-1, 1):
    box(f'aria_eye{s}', (0.006, 0.014, 0.022), (AR.x - 0.0755, AR.y + s * 0.02, AR.z + 0.008), E['aria_eye'], bevel=0.005, group=EMIT)
cyl('aria_antenna', 0.003, 0.05, (AR.x, AR.y, AR.z + 0.095), M['metal'])
sphere('aria_tip', 0.009, (AR.x, AR.y, AR.z + 0.124), E['warm'], sub=2, group=EMIT)
META['points']['aria'] = list(AR)
# Shelf, books, figures, trophy; Vancouver and Tehran clocks.
box('shelf', (0.22, 1.7, 0.03), (DX1 - 0.12, 0.62, 1.78), M['desk'], bevel=0.006)
box('shelf_led', (0.01, 1.6, 0.01), (DX1 - 0.2, 0.62, 1.762), E['warm'], group=EMIT)
y = -0.15
for i in range(11):
    h = random.uniform(0.17, 0.25)
    t = random.uniform(0.025, 0.045)
    box(f'book{i}', (0.16, t, h), (DX1 - 0.12, y + t / 2, 1.795 + h / 2), M[f'book{i % 4 + 1}'], bevel=0.003)
    y += t + 0.004
cyl('trophy_base', 0.035, 0.03, (DX1 - 0.12, 1.05, 1.81), M['black'])
cyl('trophy_cup', 0.045, 0.09, (DX1 - 0.12, 1.05, 1.88), M['gold'], r2=0.025)
sphere('figure_head', 0.03, (DX1 - 0.12, 1.3, 1.93), M['clockface'], sub=2)
cyl('figure_body', 0.03, 0.12, (DX1 - 0.12, 1.3, 1.855), M['black'])
for nm, yy in (('van', 0.2), ('teh', 1.04)):
    cyl(f'clock_{nm}', 0.11, 0.025, (DX1 - 0.02, yy, 2.25), M['black'], axis='X', seg=32)
    cyl(f'clockface_{nm}', 0.1, 0.004, (DX1 - 0.035, yy, 2.25), M['clockface'], axis='X', seg=32)
    for hand, ln, w in (('h', 0.055, 0.008), ('m', 0.085, 0.005)):
        box(f'clock_{nm}_{hand}', (0.004, w, ln), (0, 0, ln / 2 - 0.01), M['black'], group=EMIT)
        o = bpy.data.objects[f'clock_{nm}_{hand}']
        o.location = (DX1 - 0.04, yy, 2.25)
    META['clocks'][nm] = [DX1 - 0.04, yy, 2.25]
# Gaming chair on the Persian rug.
cyl('rug', 1.05, 0.012, (2.05, 0.62, 0.006), M['rug'], seg=64)
CX, CY = 2.15, 0.62
cyl('chair_seat', 0.27, 0.09, (CX, CY, 0.5), M['chair'], seg=28)
box('chair_back', (0.1, 0.52, 0.78), (CX - 0.25, CY, 0.95), M['chair'], bevel=0.04, seg=3).rotation_euler = (0, math.radians(-10), 0)
box('chair_stripe', (0.102, 0.08, 0.6), (CX - 0.25, CY, 0.98), M['chair_acc'], bevel=0.02).rotation_euler = (0, math.radians(-10), 0)
for s in (-1, 1):
    box(f'chair_arm{s}', (0.3, 0.06, 0.04), (CX - 0.02, CY + s * 0.28, 0.68), M['chair'], bevel=0.015)
    box(f'chair_armpost{s}', (0.04, 0.04, 0.16), (CX - 0.02, CY + s * 0.28, 0.6), M['metal'])
cyl('chair_gas', 0.025, 0.36, (CX, CY, 0.27), M['metal'])
for i in range(5):
    a = i * 2 * math.pi / 5
    box(f'chair_leg{i}', (0.32, 0.04, 0.03), (CX + math.cos(a) * 0.16, CY + math.sin(a) * 0.16, 0.07), M['metal'], rot=a)
    sphere(f'chair_wheel{i}', 0.03, (CX + math.cos(a) * 0.31, CY + math.sin(a) * 0.31, 0.03), M['black'], sub=1)
collider('chair', (CX - 0.33, CY - 0.33, -1), (CX + 0.2, CY + 0.33, 0.55))
# A plant by the window, and the lounge below: sofa, table, warm floor lamp.
cyl('plant_pot', 0.17, 0.4, (-2.9, 2.55, 0.2), M['plastic'], r2=0.2)
for i in range(9):
    a = i * 0.7
    # Each leaf turns about its own centre (turning the object would swing it around the room's origin).
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.16)
    bmesh.ops.scale(bm, vec=Vector((1.4, 0.55, 0.12)), verts=bm.verts)
    from mathutils import Euler
    bmesh.ops.rotate(bm, cent=Vector(), matrix=Euler((random.uniform(-0.5, 0.5), random.uniform(-0.6, -0.2), a)).to_matrix(), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector((-2.9 + math.cos(a) * 0.16, 2.55 + math.sin(a) * 0.16, 0.75 + (i % 3) * 0.18)), verts=bm.verts)
    lf = link(f'plant_leaf{i}', bm, M['leaf'] if i % 2 else M['leaf2'], BAKED)
    for pp in lf.data.polygons:
        pp.use_smooth = True
cyl('plant_stem', 0.012, 0.7, (-2.9, 2.55, 0.7), M['leaf'])
collider('plant', (-3.1, 2.35, -1), (-2.7, 2.75, 1.2))
box('sofa_base', (2.4, 0.9, 0.42), (-1.2, -3.55, -0.24), M['sofa'], bevel=0.06, seg=3)
box('sofa_back', (2.4, 0.22, 0.5), (-1.2, -3.95, 0.12), M['sofa'], bevel=0.08, seg=3)
for s in (-1, 1):
    box(f'sofa_arm{s}', (0.22, 0.9, 0.3), (-1.2 + s * 1.15, -3.55, 0.0), M['sofa'], bevel=0.08, seg=3)
collider('sofa', (-2.45, -4.1, -1), (0.05, -3.1, 0.2))
box('table', (1.0, 0.55, 0.05), (-1.2, -2.55, -0.08), M['desk'], bevel=0.01)
for sx in (-1, 1):
    for sy in (-1, 1):
        cyl(f'table_leg{sx}{sy}', 0.015, 0.32, (-1.2 + sx * 0.44, -2.55 + sy * 0.22, -0.27), M['metal'])
collider('table', (-1.72, -2.84, -1), (-0.68, -2.26, -0.05))
cyl('lamp_pole', 0.014, 1.5, (0.4, -3.8, 0.3), M['metal'])
cyl('lamp_base', 0.14, 0.025, (0.4, -3.8, -0.435), M['metal'])
cyl('lamp_shade', 0.2, 0.28, (0.4, -3.8, 1.12), M['lampshade'], r2=0.14, cap=False)
sphere('lamp_bulb', 0.05, (0.4, -3.8, 1.08), E['warm'], sub=2, group=EMIT)
collider('lamp', (0.22, -3.98, -1), (0.58, -3.62, 1.3))
box('wall_west', (0.2, 7.2, 5.1), (FX0 - 0.1, -0.5, 2.1), M['wall'])
box('shelf_tall', (0.36, 2.6, 2.4), (FX0 + 0.18, -0.3, 1.2), M['desk'], bevel=0.01)
for r_ in range(5):
    box(f'shelf_board{r_}', (0.38, 2.5, 0.03), (FX0 + 0.2, -0.3, 0.3 + r_ * 0.46), M['black'])
    yy_ = -1.5
    while yy_ < 0.85:
        t_ = random.uniform(0.03, 0.06)
        h_ = random.uniform(0.24, 0.38)
        if random.random() < 0.88:
            box(f'wb{r_}_{yy_:.2f}', (0.26, t_, h_), (FX0 + 0.22, yy_ + t_ / 2, 0.315 + r_ * 0.46 + h_ / 2), M[f'book{random.randint(1, 4)}'])
        yy_ += t_ + 0.006
collider('shelf_tall', (FX0, -1.6, -1), (FX0 + 0.37, 1.0, 2.4))
# Mezzanine edge in the far north-west corner, high enough to stay out of the camera's way.
box('mezz_slab', (2.0, 1.7, 0.22), (FX0 + 1.0, 2.2, 3.05), M['desk'], bevel=0.01)
box('mezz_rail', (2.0, 0.02, 0.9), (FX0 + 1.0, 1.35, 3.61), G['glass'], group=GLASS)
# The platform's 45 cm edge is a wall from the lounge side, except where the steps are.
collider('riser_west', (FX0, FY0, -1), (-1.0, FY1, 0.0))
collider('riser_east', (1.0, FY0, -1), (FX1, FY1, 0.0))
META['points']['spawn'] = [0.2, -0.7, 0.0]
META['points']['desk_use'] = [1.62, 0.62, 0.0]

# ---------- bake lights ----------
def area(name, power, size, loc, rot, color):
    l = bpy.data.lights.new(name, 'AREA')
    l.energy, l.color = power, color
    l.shape = 'RECTANGLE'
    l.size, l.size_y = size
    o = bpy.data.objects.new(name, l)
    col.objects.link(o)
    o.location, o.rotation_euler = loc, rot
    return o


area('L_window', 700, (6.0, 2.6), (FX0 + 3.0, FY1 - 0.05, 1.7), (math.radians(90), 0, 0), (0.55, 0.66, 1.0))
area('L_monitor', 80, (1.0, 0.45), (MC.x - 0.05, MC.y, MC.z), (0, math.radians(-90), 0), (0.75, 0.82, 1.0))
area('L_pendant', 130, (0.8, 0.8), (2.4, 0.62, 2.9), (0, 0, 0), (1.0, 0.78, 0.55))
area('L_fill', 240, (6.5, 6.5), (0, -0.5, 2.9), (0, 0, 0), (0.72, 0.78, 1.0))
pl = bpy.data.lights.new('L_lamp', 'POINT')
pl.energy, pl.color, pl.shadow_soft_size = 220, (1.0, 0.7, 0.42), 0.15
o = bpy.data.objects.new('L_lamp', pl)
col.objects.link(o)
o.location = (0.4, -3.8, 1.05)
scn.world = bpy.data.worlds.new('w')
scn.world.use_nodes = True
scn.world.node_tree.nodes['Background'].inputs[0].default_value = (0.012, 0.015, 0.025, 1)

# ---------- room v2: battlestation details ----------
M['leather'] = principled('leather', (0.025, 0.025, 0.028), 0.55)
M['speaker'] = node_mat('speaker', noisy((0.06, 0.055, 0.05), 60, 0.2, 0.7))
M['cone'] = principled('cone', (0.02, 0.02, 0.022), 0.7)
M['paper'] = principled('paper', (0.82, 0.8, 0.74), 0.85)
M['cover'] = principled('cover', (0.32, 0.06, 0.07), 0.7)
M['lego_r'] = principled('lego_r', (0.75, 0.06, 0.05), 0.35)
M['lego_y'] = principled('lego_y', (0.95, 0.72, 0.08), 0.35)
M['lego_b'] = principled('lego_b', (0.05, 0.25, 0.65), 0.35)
M['lego_w'] = principled('lego_w', (0.85, 0.85, 0.82), 0.35)
M['pom'] = principled('pom', (0.6, 0.04, 0.08), 0.35)
M['braid'] = node_mat('braid', noisy((0.03, 0.03, 0.035), 300, 0.4, 0.6))
M['panel'] = node_mat('panel', noisy((0.12, 0.14, 0.18), 120, 0.25, 0.95))
M['panel2'] = node_mat('panel2', noisy((0.28, 0.16, 0.1), 120, 0.25, 0.95))
def wicker(nt, b):
    # Woven rattan: a fine basket weave from a brick pattern, warmed with noise.
    n = nt.nodes
    tc = n.new('ShaderNodeTexCoord')
    br = n.new('ShaderNodeTexBrick')
    br.inputs['Scale'].default_value = 28
    br.inputs['Mortar Size'].default_value = 0.08
    br.inputs['Brick Width'].default_value = 0.9
    br.inputs['Row Height'].default_value = 0.3
    br.inputs['Color1'].default_value = (0.42, 0.29, 0.15, 1)
    br.inputs['Color2'].default_value = (0.34, 0.22, 0.11, 1)
    br.inputs['Mortar'].default_value = (0.09, 0.055, 0.03, 1)
    nt.links.new(tc.outputs['Object'], br.inputs['Vector'])
    nt.links.new(br.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.75


M['rattan'] = node_mat('rattan', wicker)
M['cushion'] = principled('cushion', (0.72, 0.68, 0.6), 0.95)
M['beanbag'] = node_mat('beanbag', noisy((0.3, 0.12, 0.08), 70, 0.2, 0.95))
M['frame'] = principled('frame', (0.03, 0.03, 0.03), 0.45)
E['warm_soft'] = principled('E_warm_soft', (0, 0, 0), 0.5, emit=(1.0, 0.75, 0.45), strength=5)
E['bias'] = principled('E_bias', (0, 0, 0), 0.5, emit=(0.35, 0.45, 1.0), strength=7)


def tube(name, pts, r, mat, seg=8, group=None):
    # A round tube along a polyline, for cables and coils.
    bm = bmesh.new()
    rings = []
    for i, p in enumerate(pts):
        a, b = pts[max(0, i - 1)], pts[min(len(pts) - 1, i + 1)]
        t = (Vector(b) - Vector(a)).normalized()
        up = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
        x = t.cross(up).normalized()
        y = t.cross(x)
        rings.append([bm.verts.new(Vector(p) + (x * math.cos(2 * math.pi * k / seg) + y * math.sin(2 * math.pi * k / seg)) * r) for k in range(seg)])
    for i in range(len(rings) - 1):
        for k in range(seg):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % seg], rings[i + 1][(k + 1) % seg], rings[i + 1][k]))
    o = link(name, bm, mat, BAKED if group is None else group)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def bezier(p0, p1, p2, p3, n=24):
    out = []
    for i in range(n + 1):
        t = i / n
        out.append(tuple((1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d for a, b, c, d in zip(p0, p1, p2, p3)))
    return out


# The world map desk mat (drawn at runtime), under the keyboard and mouse.
bm = bmesh.new()
uvl = bm.loops.layers.uv.new('UVMap')
mx, my, hd, hw = 2.97, 0.62, 0.225, 0.56
vs = [bm.verts.new((mx - hd, my + hw, DZ + 0.004)), bm.verts.new((mx - hd, my - hw, DZ + 0.004)), bm.verts.new((mx + hd, my - hw, DZ + 0.004)), bm.verts.new((mx + hd, my + hw, DZ + 0.004))]
f = bm.faces.new(vs)
for l, uv in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
    l[uvl].uv = uv
link('desk_mat', bm, M['felt'], EMIT)
META['screens']['mat'] = {'center': [mx, my, DZ + 0.004], 'w': hw * 2, 'h': hd * 2}
# Monitor light bar on top of the ultrawide, and bias light behind it.
box('lightbar', (0.035, 0.46, 0.022), (MC.x - 0.03, MC.y, MC.z + MH / 2 + 0.03), M['metal'], bevel=0.006)
box('lightbar_glow', (0.012, 0.42, 0.004), (MC.x - 0.045, MC.y, MC.z + MH / 2 + 0.018), E['warm_soft'], group=EMIT)
box('lightbar_clip', (0.06, 0.03, 0.03), (MC.x + 0.01, MC.y, MC.z + MH / 2 + 0.012), M['metal'])
box('bias_glow', (0.008, 1.0, 0.012), (MC.x + 0.07, MC.y, MC.z - 0.05), E['bias'], group=EMIT)
# Wrist rest and the pomegranate artisan keycap.
box('wrist_rest', (0.07, 0.44, 0.016), (kb.x - 0.115, kb.y, DZ + 0.012), M['leather'], bevel=0.008, seg=3)
sphere('pom_key', 0.012, kb + Vector((-0.055 + 0 * 0.027, -0.196 + 14 * 0.028, 0.03)), M['pom'], sub=2, scale=(1, 1, 0.8))
for k in range(5):
    a = 2 * math.pi * k / 5
    box(f'pom_crown{k}', (0.003, 0.003, 0.006), kb + Vector((-0.055 + math.cos(a) * 0.004, -0.196 + 14 * 0.028 + math.sin(a) * 0.004, 0.042)), M['pom'])
# A coiled keyboard cable running back to the monitor arm.
coil = []
for i in range(160):
    t = i / 159
    base = Vector((kb.x + 0.08 + t * 0.32, kb.y + 0.12 - t * 0.12, DZ + 0.012 + t * 0.03))
    if 0.15 < t < 0.6:
        a = t * 70
        base += Vector((0, math.cos(a) * 0.008, math.sin(a) * 0.008))
    coil.append(tuple(base))
tube('kb_cable', coil, 0.0025, M['braid'], 6)
# Bookshelf speakers either side of the ultrawide, a subwoofer under the desk.
for nm, sy in (('l', 0.0), ('r', 1.3)):
    box(f'speaker_{nm}', (0.13, 0.1, 0.18), (3.37, sy, DZ + 0.09), M['speaker'], bevel=0.007)
    cyl(f'speaker_{nm}_woofer', 0.034, 0.006, (3.303, sy, DZ + 0.065), M['cone'], axis='X', seg=24)
    cyl(f'speaker_{nm}_tweeter', 0.012, 0.006, (3.303, sy, DZ + 0.14), M['cone'], axis='X', seg=16)
box('subwoofer', (0.32, 0.32, 0.32), (3.15, 0.25, 0.16), M['speaker'], bevel=0.012)
cyl('subwoofer_cone', 0.11, 0.008, (2.99, 0.25, 0.16), M['cone'], axis='X', seg=28)
# Cable tray under the desk with braided cables dropping into it.
box('cable_tray', (0.12, 1.6, 0.05), (DX1 - 0.12, 0.6, DZ - 0.12), M['metal'])
for i, (sy, ex) in enumerate(((0.62, 0.45), (1.3, 1.1), (1.68, 1.4), (-0.3, 0.0))):
    tube(f'cable{i}', bezier((DX1 - 0.06, sy, DZ + 0.02), (DX1 - 0.02, sy, DZ - 0.05), (DX1 - 0.1, ex, DZ - 0.05), (DX1 - 0.12, ex, DZ - 0.1)), 0.005, M['braid'])
tube('cable_floor', bezier((DX1 - 0.12, 0.2, DZ - 0.12), (DX1 - 0.1, -0.1, 0.3), (DX1 - 0.05, -0.2, 0.05), (DX1 - 0.03, -0.4, 0.01)), 0.008, M['braid'])
# Mic shock mount and pop filter.
MIC = Vector((2.92, 1.26, 0.98))
for dz in (-0.04, 0.04):
    tube(f'shock{dz:+.2f}', [(MIC.x + math.cos(2 * math.pi * k / 24) * 0.045, MIC.y + math.sin(2 * math.pi * k / 24) * 0.045, MIC.z + dz) for k in range(25)], 0.003, M['metal'])
cyl('pop_filter', 0.06, 0.004, (MIC.x - 0.12, MIC.y, MIC.z + 0.02), M['cone'], axis='X', seg=32)
tube('pop_ring', [(MIC.x - 0.12, MIC.y + math.cos(2 * math.pi * k / 32) * 0.062, MIC.z + 0.02 + math.sin(2 * math.pi * k / 32) * 0.062) for k in range(33)], 0.004, M['black'])
tube('pop_neck', bezier((MIC.x - 0.12, MIC.y, MIC.z - 0.04), (MIC.x - 0.08, MIC.y, MIC.z - 0.09), (MIC.x - 0.02, MIC.y, MIC.z - 0.09), (MIC.x, MIC.y, MIC.z - 0.05)), 0.003, M['metal'])
# Notebook with pens, a LEGO build, a pomodoro cube (its face is a runtime screen).
box('notebook', (0.15, 0.21, 0.012), (2.78, -0.48, DZ + 0.006), M['cover'], bevel=0.003, rot=math.radians(8))
box('notebook_pages', (0.145, 0.205, 0.006), (2.78, -0.48, DZ + 0.014), M['paper'], rot=math.radians(8))
for i, c in enumerate((M['black'], M['lego_b'])):
    cyl(f'pen{i}', 0.004, 0.14, (2.75 + i * 0.012, -0.34, DZ + 0.006), c, axis='X', seg=10)
LG = Vector((DX1 - 0.12, 0.55, 1.795))
for i, (dx, dy, dz, c) in enumerate(((0, 0, 0, 'lego_r'), (0, 0.032, 0, 'lego_r'), (0, 0.016, 0.019, 'lego_y'), (0, -0.016, 0.019, 'lego_b'), (0, 0.016, 0.038, 'lego_w'), (0, 0, 0.057, 'lego_y'))):
    box(f'lego{i}', (0.032, 0.064, 0.019), LG + Vector((dx, dy, dz + 0.0095)), M[c], bevel=0.001)
    for s in (-1, 1):
        cyl(f'lego{i}_stud{s}', 0.005, 0.004, LG + Vector((dx, dy + s * 0.016, dz + 0.021)), M[c], seg=10)
box('pomodoro', (0.06, 0.06, 0.06), (2.76, 1.5, DZ + 0.03), M['plastic'], bevel=0.008)
plane('screen_timer', 0.044, 0.03, (2.729, 1.5, DZ + 0.032), E['screen'], '-X')
META['screens']['timer'] = {'center': [2.729, 1.5, DZ + 0.032], 'w': 0.044, 'h': 0.03}
# RAM sticks with lit tops inside the PC.
for i in range(4):
    box(f'ram{i}', (0.006, 0.004, 0.05), (PCX + 0.12 + i * 0.012, PCY + 0.09, DZ + 0.4), M['black'])
    box(f'ram{i}_led', (0.006, 0.0045, 0.006), (PCX + 0.12 + i * 0.012, PCY + 0.09, DZ + 0.428), E['rgb_purple'] if i % 2 else E['rgb_teal'], group=EMIT)

# ---------- room v2: new ideas ----------
# Lit stairs: a warm strip under each step's nose.
for i, (y0, z) in enumerate(((-1.5, -0.15), (-1.8, -0.3))):
    box(f'step{i}_led', (1.9, 0.012, 0.01), (0.0, y0 - 0.3 - 0.008, z - 0.02), E['warm_soft'], group=EMIT)
# Hexagonal acoustic panels on the west wall, north of the tall shelf.
for i, (py, pz, m) in enumerate(((1.45, 1.55, 'panel'), (1.8, 1.75, 'panel2'), (2.15, 1.55, 'panel'), (1.45, 1.95, 'panel'), (2.15, 1.95, 'panel2'), (1.8, 2.15, 'panel'), (1.8, 1.35, 'panel'))):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.2, radius2=0.18, depth=0.04)
    bmesh.ops.rotate(bm, cent=Vector(), matrix=Matrix.Rotation(-math.pi / 2, 3, 'Y'), verts=bm.verts)
    bmesh.ops.rotate(bm, cent=Vector(), matrix=Matrix.Rotation(math.pi / 6, 3, 'X'), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector((FX0 + 0.02, py, pz)), verts=bm.verts)
    link(f'acoustic{i}', bm, M[m], BAKED)
# A hanging egg chair by the window, open toward the view.
EG = Vector((-1.9, 2.35, 0.95))
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=20, radius=1.0)
bmesh.ops.scale(bm, vec=Vector((0.48, 0.42, 0.62)), verts=bm.verts)
# Open toward the room and the window at once, so it reads as a chair from wherever you stand.
bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=Vector((0.6, 0.6, 0.3)).normalized() * 0.2, plane_no=Vector((0.6, 0.6, 0.3)).normalized(), clear_outer=True)
bmesh.ops.translate(bm, vec=EG, verts=bm.verts)
o = link('egg_chair', bm, M['rattan'], BAKED)
o.modifiers.new('sol', 'SOLIDIFY').thickness = 0.03
# Joining the baked pieces drops modifiers, so give the shell its thickness now.
bpy.context.view_layer.objects.active = o
bpy.ops.object.modifier_apply(modifier='sol')
for p in o.data.polygons:
    p.use_smooth = True
sphere('egg_cushion', 0.33, EG + Vector((0.0, 0.0, -0.3)), M['cushion'], sub=3, scale=(1, 1, 0.36))
sphere('egg_pillow', 0.16, EG + Vector((-0.17, -0.17, -0.04)), M['cushion'], sub=3, scale=(0.7, 0.7, 1))
# It hangs from the underside of the mezzanine slab above it.
tube('egg_rod', [(EG.x, EG.y - 0.05, EG.z + 0.6), (EG.x, EG.y - 0.05, 2.94)], 0.012, M['metal'])
cyl('egg_mount', 0.05, 0.03, (EG.x, EG.y - 0.05, 2.925), M['metal'])
collider('egg_chair', (EG.x - 0.48, EG.y - 0.42, -1), (EG.x + 0.48, EG.y + 0.42, 1.55))
# A bean bag in the lounge.
sphere('beanbag', 0.42, (-2.7, -2.5, -0.45 + 0.2), M['beanbag'], sub=3, scale=(1, 1.05, 0.5))
sphere('beanbag_dent', 0.28, (-2.72, -2.42, -0.45 + 0.36), M['beanbag'], sub=3, scale=(1, 1, 0.35))
collider('beanbag', (-3.12, -2.94, -1), (-2.28, -2.06, -0.05))
# A lava lamp on the lounge table (the glass is a runtime shader).
LV = Vector((-0.82, -2.5, -0.055))
cyl('lava_base', 0.045, 0.09, LV + Vector((0, 0, 0.045)), M['metal'], seg=24, r2=0.03)
cyl('lava_glass', 0.03, 0.2, LV + Vector((0, 0, 0.19)), E['warm_soft'], seg=24, r2=0.018, group=EMIT)
cyl('lava_cap', 0.018, 0.04, LV + Vector((0, 0, 0.31)), M['metal'], seg=24, r2=0.012)
# The lounge feature wall on the east side: neon, two art prints and two project frames (all drawn at runtime).
NX = FX1 - 0.012
plane('neon', 1.3, 0.32, (NX, -2.9, 1.95), E['warm_soft'], '-X')
META['screens']['neon'] = {'center': [NX, -2.9, 1.95], 'w': 1.3, 'h': 0.32}
for i, (py, w, h, key) in enumerate(((-1.95, 0.5, 0.7, 'art1'), (-2.65, 0.6, 0.45, 'proj1'), (-3.3, 0.6, 0.45, 'proj2'), (-3.9, 0.42, 0.56, 'art2'))):
    box(f'frame_{key}', (0.025, w + 0.06, h + 0.06), (FX1 - 0.013, py, 0.95), M['frame'], bevel=0.004)
    plane(f'screen_{key}', w, h, (FX1 - 0.027, py, 0.95), M['paper'], '-X')
    META['screens'][key] = {'center': [FX1 - 0.027, py, 0.95], 'w': w, 'h': h}
area('L_neon', 15, (0.3, 1.3), (NX - 0.1, -2.9, 1.95), (0, math.radians(-90), 0), (1.0, 0.55, 0.3))

# ---------- bake ----------
scn.render.engine = 'CYCLES'
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for dt in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI', 'METAL'):
        try:
            prefs.compute_device_type = dt
            prefs.get_devices()
            if any(d.type == dt for d in prefs.devices):
                for d in prefs.devices:
                    d.use = d.type == dt
                scn.cycles.device = 'GPU'
                print('bake device', dt)
                break
        except TypeError:
            continue
except Exception as e:
    print('gpu probe failed', e)
scn.cycles.samples = SAMPLES
scn.cycles.use_denoising = False
for o in BAKED:
    for f in o.data.polygons:
        f.use_smooth = False
bpy.ops.object.select_all(action='DESELECT')
for o in BAKED:
    o.select_set(True)
bpy.context.view_layer.objects.active = BAKED[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.join()
room = bpy.context.view_layer.objects.active
room.name = 'room_baked'
for uvl in list(room.data.uv_layers):
    room.data.uv_layers.remove(uvl)
lm = room.data.uv_layers.new(name='Lightmap')
room.data.uv_layers.active = lm
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004, area_weight=0.0, scale_to_bounds=False)
bpy.ops.uv.pack_islands(margin=0.003, rotate=True)
bpy.ops.object.mode_set(mode='OBJECT')
img = bpy.data.images.new('room_lightmap', BAKE_PX, BAKE_PX, float_buffer=True)
for slot in room.material_slots:
    nt = slot.material.node_tree
    n = nt.nodes.new('ShaderNodeTexImage')
    n.image = img
    nt.nodes.active = n
print('baking', len(room.data.polygons), 'faces at', BAKE_PX, 'px,', SAMPLES, 'samples')
bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT', 'COLOR'}, margin=6, use_clear=True)
img.filepath_raw = OUT + 'room_lightmap_raw.exr'
img.file_format = 'OPEN_EXR'
img.save()

# Baked look: one material that only shows the lightmap.
baked = bpy.data.materials.new('M_room_baked')
baked.use_nodes = True
nt = baked.node_tree
b = nt.nodes['Principled BSDF']
t = nt.nodes.new('ShaderNodeTexImage')
t.image = img
nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
room.data.materials.clear()
room.data.materials.append(baked)
for l in [o for o in bpy.data.objects if o.type == 'LIGHT']:
    bpy.data.objects.remove(l)
with open(OUT + 'room.json', 'w') as f:
    json.dump(META, f, indent=1)
print('room meta', len(META['colliders']), 'colliders', len(META['leds']), 'leds')
bpy.ops.wm.save_as_mainfile(filepath=ROOT + '/blender/room_baked.blend')
