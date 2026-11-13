"""Shared building blocks for the loft: materials, shapes, colliders and the metadata the page reads.

Every piece belongs to the zone that is open when it is made (see `zone`), and `at` shifts everything made inside it,
so a zone can be written around its own origin. Blender axes: x east, y north, z up; the glass wall is at y = 12.
"""
import bpy, bmesh, math, random
from contextlib import contextmanager
from mathutils import Vector, Matrix, Euler

META = {'zones': [], 'colliders': [], 'floors': [], 'screens': {}, 'points': {}, 'leds': [], 'clocks': {}, 'interact': [], 'lights': [], 'looks': [], 'spots': {}, 'rugs': [], 'walls': []}
GROUPS = {}
# Surfaces baked as one material but shown darker, per channel, so the light they bounce onto the room stays the same.
# The mezzanine's boards bake as oak and show as the dark wood of the version he liked.
SHADE = {'oak_mezz': (0.093, 0.082, 0.047)}
_zone = [None]
_off = [Vector()]


@contextmanager
def zone(zid, px=2048, lit=False):
    # lit: the bake holds the light alone and is saved beside the model; the surfaces keep their own materials, which
    # the page lights itself. Such a zone is fetched after the house, not with it.
    if zid not in GROUPS:
        GROUPS[zid] = {'baked': [], 'emit': [], 'glass': [], 'px': px, 'lit': lit}
        META['zones'].append({'id': zid, 'glb': f'zones/{zid}.glb', **({'lit': True, 'light': f'zones/{zid}_light.webp'} if lit else {})})
    prev = _zone[0]
    _zone[0] = zid
    try:
        yield GROUPS[zid]
    finally:
        _zone[0] = prev


@contextmanager
def at(offset):
    prev = _off[0]
    _off[0] = prev + Vector(offset)
    try:
        yield
    finally:
        _off[0] = prev


def P(v):
    return Vector(v) + _off[0]


def L(v):
    return [round(c, 4) for c in P(v)]


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
    build(m.node_tree, m.node_tree.nodes['Principled BSDF'])
    return m


def wood_floor(nt, b, c1=(0.20, 0.105, 0.055), c2=(0.15, 0.075, 0.04)):
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
    br.inputs['Color1'].default_value = (*c1, 1)
    br.inputs['Color2'].default_value = (*c2, 1)
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


def persian_rug(palette):
    def build(nt, b):
        n = nt.nodes
        tc = n.new('ShaderNodeTexCoord')
        sep = n.new('ShaderNodeSeparateXYZ')
        nt.links.new(tc.outputs['Generated'], sep.inputs['Vector'])
        # Border rings and a medallion from the distance to the rug centre.
        sx = n.new('ShaderNodeMath'); sx.operation = 'SUBTRACT'; sx.inputs[1].default_value = 0.5
        sy = n.new('ShaderNodeMath'); sy.operation = 'SUBTRACT'; sy.inputs[1].default_value = 0.5
        nt.links.new(sep.outputs['X'], sx.inputs[0]); nt.links.new(sep.outputs['Y'], sy.inputs[0])
        cmb = n.new('ShaderNodeCombineXYZ')
        nt.links.new(sx.outputs[0], cmb.inputs['X']); nt.links.new(sy.outputs[0], cmb.inputs['Y'])
        ln = n.new('ShaderNodeVectorMath'); ln.operation = 'LENGTH'
        nt.links.new(cmb.outputs[0], ln.inputs[0])
        ramp = n.new('ShaderNodeValToRGB')
        nt.links.new(ln.outputs['Value'], ramp.inputs['Fac'])
        els = ramp.color_ramp.elements
        gold, red, navy = palette
        els[0].position, els[0].color = 0.0, (*gold, 1)
        els[1].position, els[1].color = 0.1, (*red, 1)
        for pos, c in ((0.16, navy), (0.2, red), (0.37, red), (0.39, gold), (0.42, navy), (0.47, navy), (0.48, gold), (0.5, red)):
            e = els.new(pos)
            e.color = (*c, 1)
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
    return build


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


def weave(c1, c2, mortar, scale=28):
    # Woven rattan or fabric: a fine basket weave from a brick pattern.
    def build(nt, b):
        n = nt.nodes
        tc = n.new('ShaderNodeTexCoord')
        br = n.new('ShaderNodeTexBrick')
        br.inputs['Scale'].default_value = scale
        br.inputs['Mortar Size'].default_value = 0.08
        br.inputs['Brick Width'].default_value = 0.9
        br.inputs['Row Height'].default_value = 0.3
        br.inputs['Color1'].default_value = (*c1, 1)
        br.inputs['Color2'].default_value = (*c2, 1)
        br.inputs['Mortar'].default_value = (*mortar, 1)
        nt.links.new(tc.outputs['Object'], br.inputs['Vector'])
        nt.links.new(br.outputs['Color'], b.inputs['Base Color'])
        b.inputs['Roughness'].default_value = 0.75
    return build


def tiles(c1, c2, scale=9):
    # Turquoise Persian tiles: a checker of two glazes with thin grout.
    def build(nt, b):
        n = nt.nodes
        tc = n.new('ShaderNodeTexCoord')
        br = n.new('ShaderNodeTexBrick')
        br.offset = 0.0
        br.inputs['Scale'].default_value = scale
        br.inputs['Mortar Size'].default_value = 0.03
        br.inputs['Brick Width'].default_value = 1.0
        br.inputs['Row Height'].default_value = 1.0
        br.inputs['Color1'].default_value = (*c1, 1)
        br.inputs['Color2'].default_value = (*c2, 1)
        br.inputs['Mortar'].default_value = (0.8, 0.78, 0.7, 1)
        nt.links.new(tc.outputs['Object'], br.inputs['Vector'])
        nt.links.new(br.outputs['Color'], b.inputs['Base Color'])
        b.inputs['Roughness'].default_value = 0.2
    return build


def make_materials():
    M = {
        'floor': node_mat('floor', wood_floor),
        'floor_dark': node_mat('floor_dark', lambda nt, b: wood_floor(nt, b, (0.11, 0.06, 0.035), (0.085, 0.045, 0.03))),
        'concrete': node_mat('concrete', noisy((0.3, 0.3, 0.31), 6, 0.25, 0.85)),
        'deck': node_mat('deck', lambda nt, b: wood_floor(nt, b, (0.26, 0.17, 0.1), (0.22, 0.14, 0.08))),
        'rug': node_mat('rug', persian_rug(((0.62, 0.42, 0.18), (0.28, 0.035, 0.04), (0.06, 0.07, 0.16)))),
        'rug_blue': node_mat('rug_blue', persian_rug(((0.7, 0.6, 0.45), (0.05, 0.12, 0.3), (0.35, 0.05, 0.06)))),
        'wall': node_mat('wall', noisy((0.42, 0.4, 0.37), 14, 0.15, 0.9)),
        'wall_dark': node_mat('wall_dark', noisy((0.08, 0.085, 0.1), 14, 0.15, 0.9)),
        'brick': node_mat('brick', noisy((0.28, 0.12, 0.08), 40, 0.35, 0.95)),
        'plinth': principled('plinth', (0.06, 0.06, 0.065), 0.5),
        'slat': node_mat('slat', noisy((0.24, 0.13, 0.07), 30, 0.3, 0.6)),
        'felt': principled('felt', (0.05, 0.05, 0.06), 0.9),
        'desk': node_mat('desk', noisy((0.16, 0.085, 0.045), 40, 0.25, 0.4)),
        'oak': node_mat('oak', noisy((0.42, 0.27, 0.14), 40, 0.25, 0.5)),
        'oak_mezz': node_mat('oak_mezz', noisy((0.42, 0.27, 0.14), 40, 0.25, 0.5)),
        'walnut': node_mat('walnut', noisy((0.13, 0.07, 0.04), 40, 0.25, 0.45)),
        'metal': principled('metal', (0.11, 0.115, 0.12), 0.35, 0.3),
        'steel': principled('steel', (0.5, 0.52, 0.55), 0.3, 0.8),
        'brass': principled('brass', (0.7, 0.5, 0.2), 0.3, 0.8),
        'black': principled('black', (0.015, 0.015, 0.018), 0.4),
        'plastic': principled('plastic', (0.04, 0.042, 0.048), 0.5),
        'white': principled('white', (0.8, 0.8, 0.78), 0.5),
        'keycap': principled('keycap', (0.11, 0.115, 0.13), 0.55),
        'chair': principled('chair', (0.03, 0.03, 0.035), 0.6),
        'chair_white': principled('chair_white', (0.78, 0.78, 0.76), 0.55),
        'pot': principled('pot', (0.74, 0.32, 0.16), 0.8),
        'pot_white': principled('pot_white', (0.75, 0.73, 0.7), 0.7),
        'leaf': principled('leaf', (0.15, 0.32, 0.17), 0.6),
        'leaf2': principled('leaf2', (0.24, 0.42, 0.22), 0.6),
        'soil': principled('soil', (0.06, 0.04, 0.03), 1.0),
        'pearl': principled('pearl', (0.82, 0.84, 0.88), 0.25),
        'matte': principled('matte', (0.02, 0.02, 0.025), 0.75),
        'aria_face': principled('aria_face', (0.02, 0.03, 0.06), 0.2),
        'book1': principled('book1', (0.35, 0.08, 0.07), 0.7), 'book2': principled('book2', (0.06, 0.16, 0.3), 0.7),
        'book3': principled('book3', (0.55, 0.45, 0.25), 0.7), 'book4': principled('book4', (0.1, 0.25, 0.2), 0.7),
        'sofa': principled('sofa', (0.16, 0.17, 0.2), 0.95),
        'sofa_warm': principled('sofa_warm', (0.42, 0.33, 0.25), 0.95),
        'cushion': principled('cushion', (0.72, 0.68, 0.6), 0.95),
        'cushion_teal': principled('cushion_teal', (0.05, 0.3, 0.3), 0.95),
        'cushion_rust': principled('cushion_rust', (0.45, 0.14, 0.06), 0.95),
        'gold': principled('gold', (0.75, 0.55, 0.2), 0.3, 0.15),
        'red': principled('red', (0.7, 0.03, 0.04), 0.3),
        'purple': principled('purple', (0.25, 0.06, 0.45), 0.4),
        'ceiling': principled('ceiling', (0.08, 0.075, 0.07), 0.9),
        'clockface': principled('clockface', (0.85, 0.84, 0.8), 0.6),
        'tea': principled('tea', (0.5, 0.12, 0.02), 0.1),
        'lampshade': principled('lampshade', (0.9, 0.82, 0.65), 0.9),
        'cable': principled('cable', (0.02, 0.02, 0.02), 0.6),
        'leather': principled('leather', (0.025, 0.025, 0.028), 0.55),
        'leather_brown': principled('leather_brown', (0.2, 0.09, 0.04), 0.5),
        'speaker': node_mat('speaker', noisy((0.06, 0.055, 0.05), 60, 0.2, 0.7)),
        'cone': principled('cone', (0.02, 0.02, 0.022), 0.7),
        'paper': principled('paper', (0.82, 0.8, 0.74), 0.85),
        'cover': principled('cover', (0.32, 0.06, 0.07), 0.7),
        'lego_r': principled('lego_r', (0.75, 0.06, 0.05), 0.35), 'lego_y': principled('lego_y', (0.95, 0.72, 0.08), 0.35),
        'lego_b': principled('lego_b', (0.05, 0.25, 0.65), 0.35), 'lego_w': principled('lego_w', (0.85, 0.85, 0.82), 0.35),
        'pom': principled('pom', (0.6, 0.04, 0.08), 0.35),
        'braid': node_mat('braid', noisy((0.03, 0.03, 0.035), 300, 0.4, 0.6)),
        'panel': node_mat('panel', noisy((0.12, 0.14, 0.18), 120, 0.25, 0.95)),
        'panel2': node_mat('panel2', noisy((0.28, 0.16, 0.1), 120, 0.25, 0.95)),
        'rattan': node_mat('rattan', weave((0.42, 0.29, 0.15), (0.34, 0.22, 0.11), (0.09, 0.055, 0.03))),
        'beanbag': node_mat('beanbag', noisy((0.3, 0.12, 0.08), 70, 0.2, 0.95)),
        'frame': principled('frame', (0.03, 0.03, 0.03), 0.45),
        'tile': node_mat('tile', tiles((0.05, 0.42, 0.45), (0.02, 0.3, 0.36))),
        'marble': node_mat('marble', noisy((0.78, 0.77, 0.74), 3, 0.18, 0.2)),
        'piano': principled('piano', (0.008, 0.008, 0.01), 0.12),
        'ivory': principled('ivory', (0.85, 0.83, 0.78), 0.3),
        'vinyl': principled('vinyl', (0.01, 0.01, 0.012), 0.25),
        'grass': principled('grass', (0.1, 0.22, 0.08), 0.9),
        'water': principled('water', (0.02, 0.12, 0.16), 0.1),
        'sand': principled('sand', (0.5, 0.42, 0.3), 0.9),
        'stone': node_mat('stone', noisy((0.2, 0.2, 0.21), 9, 0.3, 0.8)),
        'kit_white': principled('kit_white', (0.86, 0.86, 0.84), 0.6),
        'turf': node_mat('turf', noisy((0.08, 0.2, 0.07), 200, 0.35, 0.9)),
        # The range's surfaces (a lit zone): plain values, which the page reads and lights itself.
        'r_floor': principled('r_floor', (0.05, 0.052, 0.058), 0.3),
        'r_wall': principled('r_wall', (0.13, 0.135, 0.147), 0.85),
        'r_panel': principled('r_panel', (0.03, 0.032, 0.038), 0.9),
        'r_steel': principled('r_steel', (0.45, 0.47, 0.5), 0.36, 1.0),
        'r_dark': principled('r_dark', (0.028, 0.03, 0.035), 0.42),
        'r_rubber': principled('r_rubber', (0.022, 0.022, 0.024), 0.95),
        'r_yellow': principled('r_yellow', (0.6, 0.4, 0.02), 0.55),
        'r_bench': principled('r_bench', (0.36, 0.23, 0.12), 0.48),
        'r_line': principled('r_line', (0.5, 0.51, 0.52), 0.6),
        'r_crate': principled('r_crate', (0.15, 0.18, 0.09), 0.7),
    }
    E = {  # emitters: lit at runtime and kept out of the bake target, but they light the bake
        'screen': principled('E_screen', (0, 0, 0), 0.3, emit=(0.55, 0.7, 1.0), strength=2.5),
        'rgb_purple': principled('E_purple', (0, 0, 0), 0.5, emit=(0.55, 0.15, 1.0), strength=12),
        'rgb_teal': principled('E_teal', (0, 0, 0), 0.5, emit=(0.1, 0.9, 0.8), strength=10),
        'warm': principled('E_warm', (0, 0, 0), 0.5, emit=(1.0, 0.62, 0.3), strength=8),
        'warm_soft': principled('E_warm_soft', (0, 0, 0), 0.5, emit=(1.0, 0.75, 0.45), strength=5),
        'onair': principled('E_onair', (0, 0, 0), 0.5, emit=(1.0, 0.08, 0.06), strength=6),
        'led_green': principled('E_led_green', (0, 0, 0), 0.5, emit=(0.2, 1.0, 0.4), strength=6),
        'led_blue': principled('E_led_blue', (0, 0, 0), 0.5, emit=(0.2, 0.5, 1.0), strength=6),
        'aria_eye': principled('E_aria_eye', (0, 0, 0), 0.5, emit=(0.2, 1.0, 0.85), strength=6),
        'bias': principled('E_bias', (0, 0, 0), 0.5, emit=(0.35, 0.45, 1.0), strength=7),
        'fire': principled('E_fire', (0, 0, 0), 0.5, emit=(1.0, 0.45, 0.12), strength=14),
        'holo': principled('E_holo', (0, 0, 0), 0.5, emit=(0.25, 0.75, 1.0), strength=9),
        'aqua': principled('E_aqua', (0, 0, 0), 0.5, emit=(0.15, 0.55, 0.8), strength=4),
        'sky': principled('E_sky', (0, 0, 0), 1.0, emit=(0.12, 0.17, 0.32), strength=1.6),
        'range_white': principled('E_range_white', (0, 0, 0), 0.5, emit=(0.82, 0.9, 1.0), strength=14),
        'range_panel': principled('E_range_panel', (0, 0, 0), 0.5, emit=(1.0, 0.93, 0.84), strength=10),
    }
    G = {
        'glass': principled('G_glass', (0.8, 0.9, 1.0), 0.02, transmission=1.0),
        'teaglass': principled('G_teaglass', (0.9, 0.9, 0.9), 0.02, transmission=1.0),
        'window': principled('G_window', (0.8, 0.9, 1.0), 0.02, transmission=1.0),
    }
    for m in G.values():
        if hasattr(m, 'surface_render_method'):
            m.surface_render_method = 'BLENDED'
    return M, E, G


# ---------- shapes ----------
def link(name, bm, mat, kind='baked'):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    me.materials.append(mat)
    GROUPS[_zone[0]][kind].append(o)
    return o


def box(name, size, loc, mat, bevel=0.0, kind='baked', rot=0.0, seg=2, tilt=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=seg, profile=0.5, affect='EDGES')
    if tilt:
        bmesh.ops.rotate(bm, cent=Vector(), matrix=Euler(tilt).to_matrix(), verts=bm.verts)
    if rot:
        bmesh.ops.rotate(bm, cent=Vector(), matrix=Matrix.Rotation(rot, 3, 'Z'), verts=bm.verts)
    bmesh.ops.translate(bm, vec=P(loc), verts=bm.verts)
    return link(name, bm, mat, kind)


def cyl(name, r, h, loc, mat, seg=24, kind='baked', axis='Z', r2=None, cap=True, smooth=False):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    if axis == 'X':
        bmesh.ops.rotate(bm, cent=Vector(), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'), verts=bm.verts)
    elif axis == 'Y':
        bmesh.ops.rotate(bm, cent=Vector(), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'), verts=bm.verts)
    bmesh.ops.translate(bm, vec=P(loc), verts=bm.verts)
    o = link(name, bm, mat, kind)
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
    return o


def sphere(name, r, loc, mat, sub=3, kind='baked', scale=(1, 1, 1), rot=None):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    if rot:
        bmesh.ops.rotate(bm, cent=Vector(), matrix=Euler(rot).to_matrix(), verts=bm.verts)
    bmesh.ops.translate(bm, vec=P(loc), verts=bm.verts)
    o = link(name, bm, mat, kind)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def plane(name, w, h, loc, mat, normal='-X', kind='emit', yaw=0.0):
    # A quad facing `normal` (then turned by `yaw` about z), UV 0..1 so runtime canvases map onto it.
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    hw, hh = w / 2, h / 2
    pts = {'-X': [(0, hw, -hh), (0, -hw, -hh), (0, -hw, hh), (0, hw, hh)],
           '+X': [(0, -hw, -hh), (0, hw, -hh), (0, hw, hh), (0, -hw, hh)],
           '-Y': [(-hw, 0, -hh), (hw, 0, -hh), (hw, 0, hh), (-hw, 0, hh)],
           '+Y': [(hw, 0, -hh), (-hw, 0, -hh), (-hw, 0, hh), (hw, 0, hh)],
           '+Z': [(-hw, -hh, 0), (hw, -hh, 0), (hw, hh, 0), (-hw, hh, 0)]}[normal]
    R = Matrix.Rotation(yaw, 3, 'Z')
    vs = [bm.verts.new(R @ Vector(p) + P(loc)) for p in pts]
    f = bm.faces.new(vs)
    for lp, (u, v) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uv].uv = (u, v)
    return link(name, bm, mat, kind)


def tube(name, pts, r, mat, seg=8, kind='baked'):
    # A round tube along a polyline, for cables, rails and coils.
    bm = bmesh.new()
    rings = []
    for i, p in enumerate(pts):
        a, b = pts[max(0, i - 1)], pts[min(len(pts) - 1, i + 1)]
        t = (Vector(b) - Vector(a)).normalized()
        up = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
        x = t.cross(up).normalized()
        y = t.cross(x)
        rings.append([bm.verts.new(P(p) + (x * math.cos(2 * math.pi * k / seg) + y * math.sin(2 * math.pi * k / seg)) * r) for k in range(seg)])
    for i in range(len(rings) - 1):
        for k in range(seg):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % seg], rings[i + 1][(k + 1) % seg], rings[i + 1][k]))
    o = link(name, bm, mat, kind)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def bezier(p0, p1, p2, p3, n=24):
    return [tuple((1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d for a, b, c, d in zip(p0, p1, p2, p3))
            for t in (i / n for i in range(n + 1))]


def prism(name, pts, z0, z1, mat, kind='baked'):
    # A flat outline (x, y) extruded from z0 to z1, for curved counters, dais rings and odd shapes.
    bm = bmesh.new()
    lo = [bm.verts.new(P((x, y, z0))) for x, y in pts]
    hi = [bm.verts.new(P((x, y, z1))) for x, y in pts]
    bm.faces.new(lo[::-1])
    bm.faces.new(hi)
    n = len(pts)
    for i in range(n):
        bm.faces.new((lo[i], lo[(i + 1) % n], hi[(i + 1) % n], hi[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return link(name, bm, mat, kind)


def ring(name, r0, r1, z0, z1, loc, mat, seg=48, kind='baked'):
    # A flat annulus with height: a dais step, a rim, a turntable platter edge.
    bm = bmesh.new()
    c = P(loc)
    outer = [(c.x + r1 * math.cos(2 * math.pi * k / seg), c.y + r1 * math.sin(2 * math.pi * k / seg)) for k in range(seg)]
    inner = [(c.x + r0 * math.cos(2 * math.pi * k / seg), c.y + r0 * math.sin(2 * math.pi * k / seg)) for k in range(seg)]
    vo = [[bm.verts.new((x, y, c.z + z)) for x, y in outer] for z in (z0, z1)]
    vi = [[bm.verts.new((x, y, c.z + z)) for x, y in inner] for z in (z0, z1)]
    for k in range(seg):
        j = (k + 1) % seg
        bm.faces.new((vo[1][k], vo[1][j], vi[1][j], vi[1][k]))
        bm.faces.new((vo[0][k], vo[0][j], vo[1][j], vo[1][k]))
        bm.faces.new((vi[0][j], vi[0][k], vi[1][k], vi[1][j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return link(name, bm, mat, kind)


def leafy(name, loc, M, n=9, size=0.16, height=0.75, spread=0.16, seed=0):
    # A potted plant's leaves, each turned about its own centre.
    rnd = random.Random(seed)
    c = Vector(loc)
    for i in range(n):
        a = i * 0.7 + seed
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=2, radius=size)
        bmesh.ops.scale(bm, vec=Vector((1.4, 0.55, 0.12)), verts=bm.verts)
        bmesh.ops.rotate(bm, cent=Vector(), matrix=Euler((rnd.uniform(-0.5, 0.5), rnd.uniform(-0.6, -0.2), a)).to_matrix(), verts=bm.verts)
        bmesh.ops.translate(bm, vec=P((c.x + math.cos(a) * spread, c.y + math.sin(a) * spread, c.z + height + (i % 3) * size * 1.1)), verts=bm.verts)
        o = link(f'{name}_leaf{i}', bm, M['leaf'] if i % 2 else M['leaf2'], 'baked')
        for p in o.data.polygons:
            p.use_smooth = True


def potted(name, loc, M, r=0.17, h=0.4, mat='plastic', leaves=9, size=0.16, solid=True):
    x, y, z = loc
    cyl(f'{name}_pot', r, h, (x, y, z + h / 2), M[mat], r2=r * 1.18)
    cyl(f'{name}_soil', r * 1.1, 0.01, (x, y, z + h - 0.01), M['soil'])
    cyl(f'{name}_stem', 0.012, h * 1.6, (x, y, z + h * 1.4), M['leaf'])
    leafy(name, (x, y, z), M, n=leaves, size=size, height=h + 0.3, spread=r, seed=sum(map(ord, name)) % 97)
    if solid:
        collider(name, (x - r * 1.2, y - r * 1.2, z - 1), (x + r * 1.2, y + r * 1.2, z + h + 0.8))


# ---------- metadata ----------
def collider(name, mn, mx, structure=False):
    # Structure (walls, edges, rails, glass, doors) may touch anything; furniture must never overlap other furniture.
    META['colliders'].append({'name': name, 'min': L(mn), 'max': L(mx), 'kind': 'structure' if structure else 'solid'})


def rug(name, loc, mat, r=None, size=None):
    # A rug lies flat on one floor; the layout check makes sure it never runs over a step or an edge.
    x, y, z = loc
    if r:
        cyl(name, r, 0.012, (x, y, z + 0.006), mat, seg=72)
        lo, hi = (x - r, y - r), (x + r, y + r)
    else:
        box(name, (size[0], size[1], 0.012), (x, y, z + 0.006), mat)
        lo, hi = (x - size[0] / 2, y - size[1] / 2), (x + size[0] / 2, y + size[1] / 2)
    a, b = P((*lo, z)), P((*hi, z))
    META['rugs'].append({'name': name, 'min': [round(a.x, 4), round(a.y, 4)], 'max': [round(b.x, 4), round(b.y, 4)], 'z': round(a.z, 4)})


def wallspot(name, wall, u0, u1, z0, z1):
    # Something mounted on a wall (a frame, a screen, shelves): the layout check keeps these from overlapping.
    META['walls'].append({'name': name, 'wall': wall, 'u': [round(u0, 3), round(u1, 3)], 'z': [round(z0, 3), round(z1, 3)]})


def floor(x0, y0, x1, y1, z):
    a, b = P((x0, y0, z)), P((x1, y1, z))
    META['floors'].append({'min': [round(min(a.x, b.x), 4), round(min(a.y, b.y), 4)], 'max': [round(max(a.x, b.x), 4), round(max(a.y, b.y), 4)], 'z': round(a.z, 4)})


def point(name, loc):
    META['points'][name] = L(loc)


def screen(key, loc, w, h, **extra):
    META['screens'][key] = {'center': L(loc), 'w': w, 'h': h, **extra}


SEAT_CONTACT = 0.065   # the hip joint sits this far above the seat surface (matches lib/sitposes.py)


def seat(iid, label, stand, hip, face, kind, r=0.75):
    # A place to sit: you stand at `stand` and sit facing `face` degrees (0 east, 90 north), in the sitting style
    # `kind` (lib/sitposes.py). `hip` is where the hips rest: x and y on the seat, z the seat's top surface.
    interact(iid, label, stand, r=r, seat=L((hip[0], hip[1], hip[2] + SEAT_CONTACT)), face=face, kind=kind)


def interact(iid, label, loc, r=1.2, **extra):
    # Something you can walk up to and press E on: the page shows `label` when you are within `r` metres.
    META['interact'].append({'id': iid, 'label': label, 'at': L(loc), 'r': r, **extra})


def char_light(kind, color, power, loc=None, rng=None, **extra):
    l = {'kind': kind, 'color': color, 'power': power, **extra}
    if loc is not None:
        l['at'] = L(loc)
    if rng is not None:
        l['range'] = rng
    META['lights'].append(l)


def area(name, power, size, loc, rot, color):
    l = bpy.data.lights.new(name, 'AREA')
    l.energy, l.color = power, color
    l.shape = 'RECTANGLE'
    l.size, l.size_y = size
    o = bpy.data.objects.new(name, l)
    bpy.context.scene.collection.objects.link(o)
    o.location, o.rotation_euler = P(loc), rot
    return o


def lamp(name, power, loc, color, soft=0.15):
    pl = bpy.data.lights.new(name, 'POINT')
    pl.energy, pl.color, pl.shadow_soft_size = power, color, soft
    o = bpy.data.objects.new(name, pl)
    bpy.context.scene.collection.objects.link(o)
    o.location = P(loc)
    return o


def tilt_obj(o, pivot, angle_x, lift=0.0):
    # Turn a finished piece about a horizontal east-west axis through `pivot` (for screens lying on tilted surfaces).
    piv, R = P(pivot), Matrix.Rotation(math.radians(angle_x), 3, 'X')
    for v in o.data.vertices:
        v.co = piv + R @ (v.co - piv) + Vector((0, 0, lift))
    return o
