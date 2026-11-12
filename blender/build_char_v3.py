import bpy, bmesh, sys, math, random
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
import numpy as np
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))).replace(os.sep, '/')
sys.path.insert(0, ROOT + '/blender')

# Character v3: his designer-toy self (option A, soft white). One rig and one base outfit (oversized hoodie,
# relaxed cargos, high-tops); every head and accessory is its own piece so the page can swap them.
DL = ROOT + '/_downloads'
UBC = DL + '/quaternius-ubc/x/Universal Base Characters[Standard]'
UAL1 = DL + '/quaternius-ual1/x/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb'
OUT = ROOT + '/web/assets/behbod_v3.glb'
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREVIEW = ARGS[0] if ARGS else ''
KEEP = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Crouch_Idle_Loop', 'Crouch_Fwd_Loop',
        'Roll', 'Interact', 'Sitting_Enter', 'Sitting_Idle_Loop', 'Sitting_Exit', 'Idle_Talking_Loop', 'Dance_Loop']
random.seed(22)
SC = None


def setup():
    global SC, arm, body
    bpy.ops.wm.read_factory_settings(use_empty=True)
    SC = bpy.context.scene.collection
    bpy.ops.import_scene.gltf(filepath=UBC + '/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf')
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    arm.name = 'Behbod'
    for o in list(bpy.data.objects):
        if o.type == 'MESH' and (o.parent is None or o.name in ('Eyes', 'Eyebrows')):
            bpy.data.objects.remove(o)
    body = bpy.data.objects['SuperHero_Male']


setup()


def bone_seg(name):
    b = arm.data.bones[name]
    return arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local


def closest_on_seg(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return a + ab * t, t


def group_weights(obj):
    names = {g.index: g.name for g in obj.vertex_groups}
    return [{names[g.group]: g.weight for g in v.groups if g.weight > 0.001} for v in obj.data.vertices]


def dom(w):
    return max(w.items(), key=lambda kv: kv[1])[0] if w else ''


RADIAL = {'upperarm_l': 0.9, 'upperarm_r': 0.9, 'lowerarm_l': 0.92, 'lowerarm_r': 0.92, 'thigh_l': 0.9, 'thigh_r': 0.9,
          'calf_l': 0.92, 'calf_r': 0.92, 'neck_01': 0.8, 'spine_02': 0.94, 'spine_03': 0.92, 'clavicle_l': 0.96, 'clavicle_r': 0.96}
segs = {n: bone_seg(n) for n in RADIAL}
FINGERS = ('thumb', 'index', 'middle', 'ring', 'pinky')


def reshape(obj):
    # Slimmer limbs and torso, and chunky toy hands about 12% bigger.
    mw, mwi = obj.matrix_world, obj.matrix_world.inverted()
    hands = {s: bone_seg('hand_' + s)[0] for s in 'lr'}
    for v, w in zip(obj.data.vertices, group_weights(obj)):
        p = mw @ v.co
        d = Vector()
        for g, f in RADIAL.items():
            if g in w:
                q, _ = closest_on_seg(p, *segs[g])
                off = p - q
                if g.startswith('spine'):
                    off = Vector((off.x * 0.9, off.y, 0))
                d += w[g] * off * (f - 1)
        for s in 'lr':
            hw = sum(x for k, x in w.items() if k == 'hand_' + s or (k.startswith(FINGERS) and k.endswith('_' + s)))
            if hw:
                d += hw * (p - hands[s]) * 0.12
        v.co = mwi @ (p + d)


reshape(body)


def mat(name, color, rough, sheen=0.0, emit=None, strength=0.0, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if sheen:
        b.inputs['Sheen Weight'].default_value = sheen
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m


def knit_normal(name, fu=24, fv=48, px=512, amp=6):
    y, x = np.mgrid[0:px, 0:px] / px
    h = 0.5 + 0.28 * np.sin(2 * np.pi * (x * fu + 0.25 * np.sin(2 * np.pi * y * fv))) + 0.06 * np.random.RandomState(3).rand(px, px)
    gy, gx = np.gradient(h)
    n = np.dstack([-gx * amp, -gy * amp, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    img = bpy.data.images.new(name, px, px)
    img.pixels = np.dstack([(n + 1) / 2, np.ones((px, px))]).astype(np.float32).ravel()
    img.pack()
    img.colorspace_settings.name = 'Non-Color'
    return img


def fabric(name, color, rough, img, scale, sheen=0.15, strength=0.22):
    m = mat(name, color, rough, sheen)
    nt = m.node_tree
    t = nt.nodes.new('ShaderNodeTexImage')
    t.image = img
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (scale, scale, 1)
    nt.links.new(nt.nodes.new('ShaderNodeTexCoord').outputs['UV'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], t.inputs['Vector'])
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nm.inputs['Strength'].default_value = strength
    nt.links.new(t.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], nt.nodes['Principled BSDF'].inputs['Normal'])
    return m


KNIT = knit_normal('T_Knit')
RIB = knit_normal('T_Rib', 60, 2)
TWILL = knit_normal('T_Twill', 40, 40, amp=4)
M_TOY = mat('M_Toy', (0.83, 0.82, 0.79), 0.55)
M_SOCKET = mat('M_Socket', (0.32, 0.33, 0.36), 0.35, metal=0.3)
M_HOODIE = fabric('M_Hoodie', (0.04, 0.055, 0.11), 0.9, KNIT, 11)
M_RIB = fabric('M_Hoodie_Rib', (0.035, 0.05, 0.1), 0.92, RIB, 4)
M_PANTS = fabric('M_Pants', (0.035, 0.038, 0.045), 0.85, TWILL, 9, 0.1, 0.3)
M_POCKET = fabric('M_Pants_Pocket', (0.03, 0.033, 0.04), 0.85, TWILL, 9, 0.1, 0.3)
M_SHOE = mat('M_Shoe', (0.86, 0.86, 0.84), 0.55)
M_SOLE = mat('M_Sole', (0.93, 0.92, 0.88), 0.7)
M_ACCENT = mat('M_Shoe_Accent', (0.12, 0.13, 0.16), 0.5)
M_LACE = mat('M_Lace', (0.95, 0.95, 0.94), 0.8)
M_SOCK = fabric('M_Sock', (0.05, 0.052, 0.06), 0.95, RIB, 2, 0.2, 0.4)
for slot in body.material_slots:
    slot.material = M_TOY

mw = body.matrix_world
zb = lambda bn, end=0: bone_seg(bn)[end].z
head_pivot = bone_seg('Head')[0]
neck_c = bone_seg('neck_01')[0]
neck_z = zb('neck_01') + 0.015
waist_z = zb('pelvis') + 0.08
hem_z = zb('thigh_l') + 0.05
ankle_z = zb('foot_l') + 0.07
elbow_l, wrist_l = bone_seg('lowerarm_l')
wrist_x = abs(wrist_l.x) - 0.02
WRIST = {s: bone_seg('hand_' + s)[0] for s in 'lr'}
FORE = {s: (bone_seg('hand_' + s)[0] - bone_seg('lowerarm_' + s)[0]).normalized() for s in 'lr'}
HC = head_pivot + Vector((0, 0.0, 0.16))


def ray_grid(tree, pts, d, lift):
    # Project points onto a surface along direction d; returns (point lifted along the normal) or None per point.
    out = []
    for p in pts:
        hit = tree.ray_cast(p - d * 0.5, d, 3.0)
        out.append(hit[0] + hit[1] * lift if hit[0] is not None else None)
    return out


def patch(name, tree, grid_pts, d, lift, material, thickness=0.005):
    # A clean patch (pocket, flap) from a grid of points projected onto the garment.
    nz, nx = len(grid_pts), len(grid_pts[0])
    b = bmesh.new()
    V = [[None] * nx for _ in range(nz)]
    for j in range(nz):
        for i, q in enumerate(ray_grid(tree, grid_pts[j], d, lift)):
            if q is not None:
                V[j][i] = b.verts.new(q)
    for j in range(nz - 1):
        for i in range(nx - 1):
            q = (V[j][i], V[j][i + 1], V[j + 1][i + 1], V[j + 1][i])
            if all(q):
                b.faces.new(q)
    b.normal_update()
    bmesh.ops.reverse_faces(b, faces=[f for f in b.faces if f.normal.dot(d) > 0])
    o = bpy.data.objects.new(name, bpy.data.meshes.new(name))
    SC.objects.link(o)
    o.matrix_world = mw
    finish(o, b, thickness, 1)
    o.data.materials.append(material)
    return o


def body_copy(name, material):
    o = body.copy()
    o.data = body.data.copy()
    o.name = name
    SC.objects.link(o)
    o.data.materials.clear()
    o.data.materials.append(material)
    return o


def clean_copy(name, material, voxel=0.01):
    # A watertight remesh of the toy body: no seams, flaps or double layers from the base's separate pieces.
    o = body_copy(name, material)
    for m in list(o.modifiers):
        o.modifiers.remove(m)
    rm = o.modifiers.new('rm', 'REMESH')
    rm.mode, rm.voxel_size, rm.adaptivity = 'VOXEL', voxel, 0.0
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    o.modifiers.clear()
    o.vertex_groups.clear()
    o.data = me
    me.materials.clear()
    me.materials.append(material)
    return o


def cut(bm, co, no):
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=Vector(co), plane_no=Vector(no), clear_outer=True)


def loops_of(bm):
    edges = [e for e in bm.edges if e.is_boundary]
    at = {}
    for e in edges:
        for v in e.verts:
            at.setdefault(v, []).append(e)
    seen, out = set(), []
    for e in edges:
        if e in seen:
            continue
        comp, stack = set(), [e]
        while stack:
            x = stack.pop()
            if x in comp:
                continue
            comp.add(x)
            for v in x.verts:
                stack.extend(y for y in at[v] if y not in comp)
        seen |= comp
        out.append(list({v for e2 in comp for v in e2.verts}))
    return sorted(out, key=len, reverse=True)


def drop_islands(bm, min_faces):
    left = set(bm.faces)
    while left:
        f0 = left.pop()
        isl, stack = {f0}, [f0]
        while stack:
            f = stack.pop()
            for e in f.edges:
                for g in e.link_faces:
                    if g not in isl:
                        isl.add(g)
                        stack.append(g)
        left -= isl
        if len(isl) < min_faces:
            bmesh.ops.delete(bm, geom=list(isl), context='FACES')


def band(bm, verts, c, d, length, squeeze, steps=2):
    ring = verts
    for _ in range(steps):
        vs = set(ring)
        edges = [e for e in bm.edges if e.is_boundary and e.verts[0] in vs and e.verts[1] in vs]
        res = bmesh.ops.extrude_edge_only(bm, edges=edges)
        ring = [g for g in res['geom'] if isinstance(g, bmesh.types.BMVert)]
        f = squeeze ** (1 / steps)
        for v in ring:
            off = v.co - c
            along = d * off.dot(d)
            v.co = c + along + (off - along) * f + d * (length / steps)
        c = c + d * (length / steps)
    return ring


def cen(l):
    return sum((v.co for v in l), Vector()) / len(l)


def face_out(bm, name=''):
    # A garment is an open shell, and Blender's own guess at which side is the outside can come out backwards (it did
    # for the trousers once their hems changed). Pockets and seams are laid on a garment a little way out along its
    # normals, so on an inside-out one they end up inside it. From a sample of faces a ray goes out along each normal:
    # on the outside it meets nothing, on the inside it meets the far wall. If most meet a wall, the shell is turned.
    bm.normal_update()
    tree = BVHTree.FromBMesh(bm)
    faces = bm.faces[:][::7] or bm.faces[:]
    inward = sum(1 for f in faces if tree.ray_cast(f.calc_center_median() + f.normal * 1e-4, f.normal, 1.0)[0] is not None)
    if inward * 2 > len(faces):
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
        bm.normal_update()
        print(name, 'was inside out', f'({inward} of {len(faces)} sampled faces looked inward): turned')
    return bm


def lining(bm, loop, normal, inset, grow=1.0):
    # Closes an opening from the inside with a shallow cup: a wall from the opening's edge `inset` back into the
    # garment, facing inward, and a floor across it, facing out of the opening. Garments are single surfaces with
    # nothing inside, so without this a look up a sleeve or a trouser leg shows a hollow tube all the way up.
    c, n = cen(loop), Vector(normal).normalized()
    u = n.cross(Vector((0, 0, 1)) if abs(n.z) < 0.9 else Vector((1, 0, 0))).normalized()
    w = n.cross(u)
    ring = sorted(loop, key=lambda v: math.atan2((v.co - c).dot(w), (v.co - c).dot(u)))
    # The wall starts on the opening's own edge, so it moves with the cloth, and narrows going in, so the cup stays
    # inside the garment however the cloth folds.
    vs = [bm.verts.new(c + (v.co - c) * grow - n * inset) for v in ring]
    mid = bm.verts.new(c - n * inset)
    k = len(vs)
    for i in range(k):
        j = (i + 1) % k
        bm.faces.new((mid, vs[i], vs[j]))
        bm.faces.new((ring[i], ring[j], vs[j], vs[i]))
    # Each point of the cup with the point of the edge it hangs from, to be weighted exactly like it later.
    return list(zip(vs, ring)) + [(mid, ring[0])]


LINING_SRC = {}


def keep_linings(name, bm, pairs):
    bm.verts.index_update()
    LINING_SRC[name] = [(a.index, b.index) for a, b in pairs]


def settle_linings(o):
    # A lining moves as one with the edge it closes: every point takes the bone weights of the edge point it hangs from.
    for vi, si in LINING_SRC.get(o.name, []):
        for g in o.vertex_groups:
            g.remove([vi])
        for g in o.data.vertices[si].groups:
            o.vertex_groups[g.group].add([vi], g.weight, 'REPLACE')


def finish(o, bm, thickness=0.0, sub=1, rim_only=False):
    bm.transform(mw.inverted())
    bm.to_mesh(o.data)
    bm.free()
    for p in o.data.polygons:
        p.use_smooth = True
    if not o.data.polygons:
        raise RuntimeError('empty mesh for ' + o.name)
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.01)
    bpy.ops.object.mode_set(mode='OBJECT')
    if sub:
        o.modifiers.new('sub', 'SUBSURF').levels = sub
    if thickness:
        m = o.modifiers.new('thick', 'SOLIDIFY')
        m.thickness, m.offset, m.use_even_offset, m.use_quality_normals = thickness, -1, False, True
        m.use_rim_only = rim_only


# ---------- oversized hoodie, built from simple shapes like a designer toy: a rounded torso, straight sleeves that
# follow the arms to a slim cuff, fused into one surface; no drawstrings ----------
sh_z = bone_seg('upperarm_l')[0].z
BV = [mw @ v.co for v in body.data.vertices]


def extent(z, axis, lim=0.3, band=0.015):
    pts = [p for p in BV if abs(p.z - z) < band and abs(p.x) < lim]
    if axis == 'x':
        return max(abs(p.x) for p in pts)
    return min(p.y for p in pts), max(p.y for p in pts)


chest_w = extent(sh_z - 0.15, 'x', 0.26)
fy, by = extent(waist_z + 0.12, 'y', 0.26)
hip_w = extent(zb('thigh_l'), 'x', 0.3)
TW = max(chest_w, hip_w) + 0.055
TD = (by - fy) / 2 + 0.05
TCY, EXP = (by + fy) / 2, 3.0
print('body chest', round(chest_w, 3), 'hip', round(hip_w, 3), 'depth', round((by - fy) / 2, 3), '-> hoodie box', round(TW, 3), round(TD, 3))
HEM_BOTTOM = zb('thigh_l') - 0.12
RIB_TOP = HEM_BOTTOM + 0.055
NECK_Y = neck_c.y + 0.004
TILT = 0.2
SHOULDER0 = sh_z - 0.03
DOME_H = max(0.08, (neck_z - SHOULDER0) / 0.82)
print('shoulder z', round(sh_z, 3), 'neck z', round(neck_z, 3), 'dome', round(DOME_H, 3))


def superellipse_ring(b, z, w, d, cy, e, n=64, tilt=0.0):
    ring = []
    for j in range(n):
        a = 2 * math.pi * j / n
        c, s = math.cos(a), math.sin(a)
        y = cy + d * math.copysign(abs(s) ** (2 / e), s)
        ring.append(b.verts.new((w * math.copysign(abs(c) ** (2 / e), c), y, z + tilt * (y - cy))))
    return ring


def skin_rings(b, rings, close_top=None, close_bottom=None):
    n = len(rings[0])
    for k in range(len(rings) - 1):
        for j in range(n):
            b.faces.new((rings[k][j], rings[k][(j + 1) % n], rings[k + 1][(j + 1) % n], rings[k + 1][j]))
    if close_bottom is not None:
        c = b.verts.new(close_bottom)
        for j in range(n):
            b.faces.new((rings[0][(j + 1) % n], rings[0][j], c))
    if close_top is not None:
        c = b.verts.new(close_top)
        for j in range(n):
            b.faces.new((rings[-1][j], rings[-1][(j + 1) % n], c))


def capsule(b, a, c, r1, r2, n=32, m=10):
    # A tapered tube from a to c with round ends.
    ax = (c - a).normalized()
    X, Y, Z = frame(ax, Vector((0, 0, 1)))
    rings = []
    for k in range(m + 1):
        t = k / m
        p, r = a.lerp(c, t), r1 + (r2 - r1) * t
        rings.append([b.verts.new(p + (Y * math.cos(2 * math.pi * j / n) + Z * math.sin(2 * math.pi * j / n)) * r) for j in range(n)])
    skin_rings(b, rings)
    for end, r, sgn in ((a, r1, -1), (c, r2, 1)):
        g = bmesh.ops.create_uvsphere(b, u_segments=n, v_segments=12, radius=r)
        bmesh.ops.translate(b, vec=end, verts=g['verts'])


def frame(ax, hint):
    up = (hint - ax * hint.dot(ax)).normalized()
    return ax, ax.cross(up).normalized(), up


def fused(name, build, material, voxel=0.014, faces=0, smooth=8):
    # Fuse the shapes with a voxel remesh, thin it to a sensible count, then smooth the joins.
    b = bmesh.new()
    build(b)
    o = bpy.data.objects.new(name, bpy.data.meshes.new(name))
    SC.objects.link(o)
    b.to_mesh(o.data)
    b.free()
    rm = o.modifiers.new('rm', 'REMESH')
    rm.mode, rm.voxel_size, rm.adaptivity = 'VOXEL', voxel, 0.0
    dg = bpy.context.evaluated_depsgraph_get()
    n = len(o.evaluated_get(dg).data.polygons)
    print(name, 'remesh faces', n)
    if faces:
        dc = o.modifiers.new('dc', 'DECIMATE')
        dc.ratio = min(1.0, faces / max(n, 1))
    sm = o.modifiers.new('sm', 'SMOOTH')
    sm.factor, sm.iterations = 0.5, smooth
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    o.modifiers.clear()
    old = o.data
    o.data = me
    bpy.data.meshes.remove(old)
    o.matrix_world = mw
    me.transform(mw.inverted())
    me.materials.clear()
    me.materials.append(material)
    return o


ARM = {s: (bone_seg('upperarm_' + s)[0], bone_seg('lowerarm_' + s)[0], bone_seg('hand_' + s)[0]) for s in 'lr'}


def oval(verts, z0, rx, ry, r0x, r0y):
    # Each point keeps its own angle around the neck, so no face twists.
    for v in verts:
        a = math.atan2((v.co.y - NECK_Y) / r0y, v.co.x / r0x)
        y = NECK_Y + math.sin(a) * ry
        v.co = Vector((math.cos(a) * rx, y, z0 + TILT * (y - NECK_Y)))


def build_hoodie(name, tw, td, hem_bottom, sr=(0.066, 0.058, 0.05), suffix=''):
    # One hoodie: the body box with its dome, the sleeves, a ribbed collar, cuffs and hem, and the kangaroo pocket.
    rib_top = hem_bottom + 0.055

    def shape(b):
        rings = []
        zs = [hem_bottom - 0.01 + (SHOULDER0 - hem_bottom + 0.01) * i / 24 for i in range(25)]
        for z in zs:
            k = 0.97 if z < rib_top else 1.0
            rings.append(superellipse_ring(b, z, tw * k, td * k, TCY, EXP))
        for i in range(1, 13):
            u = i / 12 * 0.97
            f = math.sqrt(1 - u * u)
            z = SHOULDER0 + DOME_H * u
            rings.append(superellipse_ring(b, z, tw * f, td * f, TCY + (NECK_Y - TCY) * u, EXP - 0.8 * u))
        skin_rings(b, rings, close_top=Vector((0, NECK_Y, SHOULDER0 + DOME_H + 0.002)), close_bottom=Vector((0, TCY, zs[0])))
        for s in 'lr':
            sho, elb, wri = ARM[s]
            capsule(b, sho.lerp(elb, 0.15), elb, sr[0], sr[1])
            capsule(b, elb, wri + FORE[s] * 0.02, sr[1], sr[2])

    o = fused(name, shape, M_HOODIE)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.transform(mw)
    cut(bm, (0, 0, hem_bottom), (0, 0, -1))
    cut(bm, (0, NECK_Y, neck_z), (0, -TILT, 1))
    for s in 'lr':
        cut(bm, WRIST[s] + FORE[s] * 0.008, FORE[s])
    drop_islands(bm, 300)
    bm.normal_update()
    L = loops_of(bm)
    cuff_l = min(L, key=lambda l: (cen(l) - WRIST['l']).length)
    cuff_r = min(L, key=lambda l: (cen(l) - WRIST['r']).length)
    mid = [l for l in L if l is not cuff_l and l is not cuff_r]
    neck_loop = max(mid, key=lambda l: cen(l).z)
    print(name, 'openings', len(L), 'neck loop', len(neck_loop))
    cuff = {}
    for loop, s in ((cuff_l, 'l'), (cuff_r, 'r')):
        ce = cen(loop)
        cuff[s] = (ce, FORE[s], sum((v.co - ce).length for v in loop) / len(loop))
    r0x = max(abs(v.co.x) for v in neck_loop)
    r0y = (max(v.co.y for v in neck_loop) - min(v.co.y for v in neck_loop)) / 2
    ring = neck_loop
    for dz, rx, ry in ((0.02, 0.092, 0.086), (0.052, 0.075, 0.07)):
        vs = set(ring)
        res = bmesh.ops.extrude_edge_only(bm, edges=[e for e in bm.edges if e.is_boundary and e.verts[0] in vs and e.verts[1] in vs])
        ring = [g for g in res['geom'] if isinstance(g, bmesh.types.BMVert)]
        oval(ring, neck_z + dz, rx, ry, r0x, r0y)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    face_out(bm, name)
    tree = BVHTree.FromBMesh(bm)
    # Linings inside the hem and the cuffs (after the tree, so nothing is projected onto them).
    pairs = lining(bm, min(mid, key=lambda l: cen(l).z), (0, 0, -1), 0.025, 0.94)
    for loop, s in ((cuff_l, 'l'), (cuff_r, 'r')):
        pairs += lining(bm, loop, FORE[s], 0.015, 0.92)
    keep_linings(name, bm, pairs)
    finish(o, bm, 0.01, 0, True)
    for p in o.data.polygons:
        c = mw @ p.center
        collar = c.z > neck_z - 0.003 + TILT * (c.y - NECK_Y) and Vector((c.x, c.y - NECK_Y, 0)).length < r0x + 0.012
        cf = any((c - cuff[s][0]).dot(cuff[s][1]) > -0.045 and (c - cuff[s][0]).length < 0.1 for s in 'lr')
        if collar or cf or c.z < rib_top:
            p.material_index = 1
    o.data.materials.append(M_RIB)
    # Kangaroo pocket: a clean trapezoid projected onto the front, slanted hand openings at the sides.
    pz0, pz1 = rib_top + 0.012, rib_top + 0.175
    grid = []
    for j in range(9):
        z = pz0 + (pz1 - pz0) * j / 8
        half = min(0.145, tw * 0.62) - 0.05 * j / 8
        grid.append([Vector((-half + 2 * half * i / 14, -1.0, z)) for i in range(15)])
    pk = patch('V3_pocket' + suffix, tree, grid, Vector((0, 1, 0)), 0.006, M_HOODIE)
    return {'o': o, 'pocket': pk, 'tree': tree, 'cuff': cuff, 'r0x': r0x}


H = build_hoodie('V3_hoodie', TW, TD, HEM_BOTTOM)
hood_o, pocket, HOOD_TREE, CUFF, rx0 = H['o'], H['pocket'], H['tree'], H['cuff'], H['r0x']
COLLAR_TOP = neck_z + 0.052
# Variations to try on: hip length, and a less boxy fit with slimmer sleeves.
HOODIE_VARIANTS = [build_hoodie('V3_hoodie_short', TW, TD, zb('thigh_l') + 0.015, suffix='_short'),
                   build_hoodie('V3_hoodie_relaxed', max(chest_w, hip_w) + 0.04, (by - fy) / 2 + 0.035, HEM_BOTTOM, (0.06, 0.053, 0.046), '_relaxed')]


def ellipsoid(name, center, size, material, cuts=(), u=32, v=18):
    b = bmesh.new()
    bmesh.ops.create_uvsphere(b, u_segments=u, v_segments=v, radius=1.0)
    bmesh.ops.scale(b, vec=Vector(size), verts=b.verts)
    bmesh.ops.translate(b, vec=Vector(center), verts=b.verts)
    for c in cuts:
        cut(b, *c)
    o = bpy.data.objects.new(name, bpy.data.meshes.new(name))
    SC.objects.link(o)
    b.to_mesh(o.data)
    b.free()
    o.data.materials.append(material)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


# Hood up: one continuous shape that rises out of the collar, wraps the head and leaves a face opening.
HOOD_C = HC + Vector((0, 0.025, 0.01))
HOOD_R = (0.2, 0.215, 0.225)


def build_hood_up(name='V3_hood_up', HOOD_C=HOOD_C, HOOD_R=HOOD_R):
    N, M = 48, 28
    top, z_bot = HOOD_C.z + HOOD_R[2], neck_z + 0.012
    b = bmesh.new()
    rings = []
    for k in range(M + 1):
        z = z_bot + (top - z_bot) * k / M
        if z >= HOOD_C.z:
            f = max(0.05, math.sqrt(max(0.0, 1 - ((z - HOOD_C.z) / HOOD_R[2]) ** 2)))
            rx, ry, cy, tilt = HOOD_R[0] * f, HOOD_R[1] * f, HOOD_C.y, 0.0
        else:
            s = (z - z_bot) / (HOOD_C.z - z_bot)
            e = math.sin(math.pi / 2 * s) ** 0.8
            rx, ry = 0.07 + (HOOD_R[0] - 0.07) * e, 0.066 + (HOOD_R[1] - 0.066) * e
            cy, tilt = NECK_Y + (HOOD_C.y - NECK_Y) * e, TILT * (1 - s)
        ring = []
        for j in range(N):
            a = 2 * math.pi * j / N
            y = cy + math.sin(a) * ry
            ring.append(b.verts.new((math.cos(a) * rx, y, z + tilt * (y - cy))))
        rings.append(ring)
    for k in range(M):
        for j in range(N):
            b.faces.new((rings[k][j], rings[k][(j + 1) % N], rings[k + 1][(j + 1) % N], rings[k + 1][j]))
    cap = b.verts.new((0, HOOD_C.y, top + 0.002))
    for j in range(N):
        b.faces.new((rings[-1][j], rings[-1][(j + 1) % N], cap))
    b.normal_update()
    if cap.link_faces[0].normal.z < 0:
        bmesh.ops.reverse_faces(b, faces=b.faces[:])
    cut(b, (0, HC.y - 0.1, HOOD_C.z), (0, -1, 0.25))
    o = bpy.data.objects.new(name, bpy.data.meshes.new(name))
    SC.objects.link(o)
    o.matrix_world = Matrix()
    b.to_mesh(o.data)
    b.free()
    o.data.materials.append(M_HOODIE)
    for p in o.data.polygons:
        p.use_smooth = True
    o.modifiers.new('sub', 'SUBSURF').levels = 1
    m = o.modifiers.new('thick', 'SOLIDIFY')
    m.thickness, m.offset, m.use_even_offset = 0.014, -1, False
    return o


hood_up = build_hood_up()
# The TV keeps its full size and gets its own roomier hood (his Room Lab pick), so no corner of it shows through.
TV_HOOD = (HC + Vector((0, 0.005, 0.04)), (0.258, 0.268, 0.272))
hood_up_tv = build_hood_up('V3_hood_up_tv', *TV_HOOD)

# Hood down, his Room Lab pick: the hood hangs down the back with its tip pointing down (wide across the shoulder blades,
# narrowing to the point, fuller down the middle), a seam down its centre, and its edge sewn into the neckline,
# crossing over at the front in a small V.
def tube_mesh(b, pts, r, seg=8, mi=0):
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        u = t.cross(Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))).normalized()
        v = t.cross(u)
        rings.append([b.verts.new(p + (u * math.cos(2 * math.pi * k / seg) + v * math.sin(2 * math.pi * k / seg)) * r) for k in range(seg)])
    for a, c in zip(rings, rings[1:]):
        for k in range(seg):
            b.faces.new((a[k], a[(k + 1) % seg], c[(k + 1) % seg], c[k])).material_index = mi
    # The two end caps face opposite ways, each out of its own end.
    for ring, end, flip in ((rings[0], pts[0], True), (rings[-1], pts[-1], False)):
        cap = b.verts.new(end)
        for k in range(seg):
            q = (ring[(k + 1) % seg], ring[k], cap) if flip else (ring[k], ring[(k + 1) % seg], cap)
            b.faces.new(q).material_index = mi


def build_hood_down():
    # The seam and the neckline are placed from the bones, in the room's axes; the hoodie's surface is in the body's.
    assert all(abs(mw[i][j] - (1 if i == j else 0)) < 1e-6 for i in range(4) for j in range(4)), f'body transform {mw}'
    z_top, z_tip, W0, NU, NT = COLLAR_TOP - 0.006, neck_z - 0.25, 0.122, 15, 16
    # Back-surface points, shot from behind onto the hoodie, then lifted for the fabric's fullness.
    rows = []
    for j in range(NT + 1):
        t = j / NT
        w = W0 * max(0.0, 1 - t ** 2.1) ** 0.75
        z = z_top + (z_tip - z_top) * t
        row = []
        for i in range(NU):
            u = -1 + 2 * i / (NU - 1)
            hit = HOOD_TREE.ray_cast(Vector((u * w, 1.0, z)), Vector((0, -1, 0)), 3.0)
            if hit[0] is None:
                row.append(None)
                continue
            lift = 0.006 + 0.024 * (1 - u * u) * math.sin(math.pi * min(1.0, t * 1.15)) ** 0.6
            row.append(hit[0] + hit[1] * lift)
        rows.append(row)
    b = bmesh.new()
    V = [[b.verts.new(p) if p is not None else None for p in row] for row in rows]
    for j in range(NT):
        for i in range(NU - 1):
            q = (V[j][i], V[j][i + 1], V[j + 1][i + 1], V[j + 1][i])
            if all(q):
                b.faces.new(q)
    bmesh.ops.remove_doubles(b, verts=b.verts[:], dist=0.0005)
    b.normal_update()
    bmesh.ops.reverse_faces(b, faces=[f for f in b.faces if f.normal.y < 0])
    o = bpy.data.objects.new('V3_hood_down', bpy.data.meshes.new('V3_hood_down'))
    SC.objects.link(o)
    o.matrix_world = mw
    finish(o, b, 0.009, 1)
    o.data.materials.append(M_HOODIE)
    o.data.materials.append(M_RIB)
    # The drape's subdivision and thickness are applied before the seams join it, so the thin seam tubes keep their size.
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    for mod in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    # The seam down the middle and the edge sewn into the neckline.
    s = bmesh.new()
    seam = [p for p in (row[NU // 2] for row in rows) if p is not None]
    tube_mesh(s, [p + Vector((0, 0.004, 0)) for p in seam], 0.0028, 6, mi=1)
    # Each side's edge runs from the back round to a V at the front, laid onto the hoodie: a ray from outside finds the
    # fabric at that height and the tube sits on it, so the seam hugs the neckline instead of floating round it.
    rx, ry, zc, TR = rx0 + 0.012, 0.082, COLLAR_TOP - 0.008, 0.0085
    for side in (-1, 1):
        pts = []
        for k in range(25):
            a = math.pi / 2 + side * math.pi * k / 24 * 1.07
            dip = 0.03 * max(0.0, -math.sin(a)) ** 6
            z = zc - dip + TILT * (math.sin(a) * ry)
            d = Vector((math.cos(a), math.sin(a), 0))
            hit = HOOD_TREE.ray_cast(Vector((0, NECK_Y, z)) + d * 0.5, -d, 0.6)
            pts.append(hit[0] + hit[1].normalized() * TR * 0.7 if hit[0] is not None else Vector((d.x * rx, NECK_Y + d.y * ry, z)))
        tube_mesh(s, pts, TR, 10, mi=0)
    me = bpy.data.meshes.new('hood_seam')
    s.to_mesh(me)
    s.free()
    extra = bpy.data.objects.new('hood_seam', me)
    SC.objects.link(extra)
    extra.data.materials.append(M_HOODIE)
    extra.data.materials.append(M_RIB)
    for p in extra.data.polygons:
        p.use_smooth = True
    bpy.ops.object.select_all(action='DESELECT')
    for x in (o, extra):
        x.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.join()
    return o


hood_dn = build_hood_down()

# ---------- relaxed cargo pants from simple shapes: a hip block inside the hoodie and straight, slightly tapered legs ----------
# The trouser hem ends just above the sneaker's collar, with the sock between them. It must not come down over the
# collar: the hem follows the calf and the shoe the foot, so a bending ankle would push the collar through the cloth.
PANT_END = 0.2
# The sneaker's collar, and the sock that runs from inside the shoe up into the trouser leg.
COLLAR_Z, SOCK_Z0, SOCK_UP = 0.16, 0.07, 0.25
LEG = {s: (bone_seg('thigh_' + s)[0], bone_seg('calf_' + s)[0], bone_seg('calf_' + s)[1]) for s in 'lr'}
PW, PD = TW * 0.86, TD * 0.84


def build_pants(name, radii=(0.092, 0.082, 0.074), end=PANT_END, squeeze=0.88, suffix=''):
    def shape(b):
        z_top, z_crotch = waist_z + 0.03, zb('thigh_l') - 0.07
        rings = [superellipse_ring(b, z_top - (z_top - z_crotch) * i / 8, PW * (1 - 0.1 * i / 8), PD, TCY, 2.6) for i in range(9)]
        skin_rings(b, rings, close_top=Vector((0, TCY, z_top)), close_bottom=Vector((0, TCY, z_crotch)))
        for s in 'lr':
            hip, knee, ankle = LEG[s]
            capsule(b, hip + Vector((0, 0, -0.02)), knee, radii[0], radii[1])
            capsule(b, knee, ankle + Vector((0, 0, -0.04)), radii[1], radii[2])

    o = fused(name, shape, M_PANTS)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.transform(mw)
    cut(bm, (0, 0, waist_z), (0, 0, 1))
    cut(bm, (0, 0, end + 0.03), (0, 0, -1))
    drop_islands(bm, 300)
    L = sorted(loops_of(bm), key=lambda l: -cen(l).z)
    # The waistband goes on the waist itself: the biggest of the openings at the top, not a stray small one.
    top = max((l for l in L if cen(l).z > cen(L[0]).z - 0.02), key=len)
    band(bm, top, cen(top), Vector((0, 0, 1)), 0.02, 0.98)
    # The two legs' hems are the two lowest openings (a stray one higher up must not be taken for a hem).
    print(name, 'openings', [(len(l), tuple(round(c, 3) for c in cen(l))) for l in L])
    hems = [band(bm, loop, cen(loop), Vector((0, 0, -1)), 0.03, squeeze, 2) for loop in L[-2:]]
    # Everything the hoodie covers stays well inside it, so the legs never show through the hem.
    for v in bm.verts:
        p = v.co
        if p.z < HEM_BOTTOM - 0.03:
            continue
        lim = 0.86 if p.z > HEM_BOTTOM + 0.03 else 0.86 + (0.03 - (p.z - HEM_BOTTOM)) / 0.06 * 0.1
        r = (abs(p.x) / TW) ** EXP + (abs(p.y - TCY) / TD) ** EXP
        if r > lim ** EXP:
            f = lim / r ** (1 / EXP)
            v.co = Vector((p.x * f, TCY + (p.y - TCY) * f, p.z))
    for _ in range(3):
        bmesh.ops.smooth_vert(bm, verts=[v for v in bm.verts if not v.is_boundary and v.co.z > HEM_BOTTOM - 0.06], factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    face_out(bm, name)
    tree = BVHTree.FromBMesh(bm)
    keep_linings(name, bm, [q for hem in hems for q in lining(bm, hem, (0, 0, -1), 0.025, 0.9)])
    finish(o, bm, 0.008, 0, True)
    o.data.materials.append(M_PANTS)
    # Cargo pockets with a flap, on the outside of each thigh, projected onto the leg.
    pz = (zb('thigh_l') + zb('calf_l')) / 2 + 0.02
    parts = []
    for s in (1, -1):
        hip, knee, _ = LEG['l' if s > 0 else 'r']
        ty = (hip.y + knee.y) / 2
        body_pts = [[Vector((s * 1.0, ty - 0.05 + 0.1 * i / 10, pz - 0.075 + 0.11 * j / 8)) for i in range(11)] for j in range(9)]
        flap_pts = [[Vector((s * 1.0, ty - 0.056 + 0.112 * i / 10, pz + 0.03 + 0.032 * j / 3)) for i in range(11)] for j in range(4)]
        sd = 'l' if s > 0 else 'r'
        parts.append(patch(f'V3_cargo_{sd}{suffix}', tree, body_pts, Vector((-s, 0, 0)), 0.007, M_POCKET))
        parts.append(patch(f'V3_flap_{sd}{suffix}', tree, flap_pts, Vector((-s, 0, 0)), 0.014, M_POCKET))
    return o, tree, parts


pants, PANTS_TREE, cargo_parts = build_pants('V3_pants')
# A variation to try on: tapered cargos with a gathered cuff that shows the whole high-top.
PANTS_VARIANTS = [build_pants('V3_pants_tapered', (0.088, 0.072, 0.056), PANT_END, 0.82, '_tapered')]


# ---------- high-top sneakers, lofted from rounded cross-sections: round toe box, padded collar, a parody swoosh ----------
def sneaker(side):
    s = 1 if side == 'l' else -1
    foot, _ = bone_seg('foot_' + side)
    ball, ball_t = bone_seg('ball_' + side)
    fwd = Vector((ball_t.x - foot.x, ball_t.y - foot.y, 0)).normalized()
    right = Vector((fwd.y, -fwd.x, 0))
    heel = Vector((foot.x, foot.y, 0)) - fwd * 0.07
    length = (Vector((ball_t.x, ball_t.y, 0)) - heel).dot(fwd) + 0.045
    N, K = 24, 28

    def ends(t):
        # Round the heel and the toe in plan view.
        f = 1.0
        if t < 0.1:
            f *= math.sqrt(max(0.0, 1 - ((0.1 - t) / 0.1) ** 2 * 0.7))
        if t > 0.78:
            f *= math.sqrt(max(0.0, 1 - ((t - 0.78) / 0.22) ** 2))
        return f

    def ease(a, b, x):
        x = max(0.0, min(1.0, x))
        return a + (b - a) * (0.5 - 0.5 * math.cos(math.pi * x))

    def upper_prof(t):
        w = (0.046 + 0.014 * math.sin(math.pi * min(1.0, t * 1.15))) * ends(t)
        top = ease(0.168, 0.108, (t - 0.4) / 0.24) if t < 0.64 else ease(0.108, 0.078, (t - 0.64) / 0.16)
        if t > 0.78:
            top = 0.03 + (top - 0.03) * (0.45 + 0.55 * math.sqrt(max(0.0, 1 - ((t - 0.78) / 0.22) ** 2)))
        return w, 0.026, top

    def sole_prof(t):
        w = (0.052 + 0.014 * math.sin(math.pi * min(1.0, t * 1.15))) * max(ends(t), 0.25 if 0.05 < t < 0.95 else 0.0)
        spring = max(0.0, t - 0.82) * 0.12
        return w, spring, 0.03 + spring * 0.4

    def stripe_prof(t):
        w = (0.0535 + 0.014 * math.sin(math.pi * min(1.0, t * 1.15))) * max(ends(t), 0.25 if 0.05 < t < 0.95 else 0.0)
        spring = max(0.0, t - 0.82) * 0.12
        return w, 0.029 + spring * 0.4, 0.036 + spring * 0.4

    def loft(name, material, prof, t0=0.0, t1=1.0, ex=0.6, ez=0.75):
        b = bmesh.new()
        rings = []
        for i in range(K + 1):
            t = t0 + (t1 - t0) * i / K
            w, z0, z1 = prof(t)
            w = max(w, 0.004)
            base = heel + fwd * (t * length)
            ring = []
            for j in range(N):
                a = 2 * math.pi * j / N
                cx, cz = math.cos(a), math.sin(a)
                rx = math.copysign(abs(cx) ** ex, cx) * w
                rz = (z0 + z1) / 2 + math.copysign(abs(cz) ** ez, cz) * (z1 - z0) / 2
                ring.append(b.verts.new(base + right * rx + Vector((0, 0, rz))))
            rings.append(ring)
        for i in range(K):
            for j in range(N):
                b.faces.new((rings[i][j], rings[i][(j + 1) % N], rings[i + 1][(j + 1) % N], rings[i + 1][j]))
        for ring, t in ((rings[0], t0), (rings[-1], t1)):
            w, z0, z1 = prof(t)
            c = b.verts.new(heel + fwd * (t * length + (0.004 if t > 0.5 else -0.004)) + Vector((0, 0, (z0 + z1) / 2)))
            for j in range(N):
                b.faces.new((ring[j], ring[(j + 1) % N], c))
        bmesh.ops.recalc_face_normals(b, faces=b.faces[:])
        tree = BVHTree.FromBMesh(b)
        o = bpy.data.objects.new(name, bpy.data.meshes.new(name))
        SC.objects.link(o)
        b.to_mesh(o.data)
        b.free()
        o.data.materials.append(material)
        for p in o.data.polygons:
            p.use_smooth = True
        o.modifiers.new('sub', 'SUBSURF').levels = 1
        return o, tree

    upper, tree = loft('V3_upper_' + side, M_SHOE, upper_prof, 0.0, 0.995)
    sole_o, _ = loft('V3_sole_' + side, M_SOLE, sole_prof, 0.0, 1.0, 0.45, 0.4)
    stripe, _ = loft('V3_midline_' + side, M_ACCENT, stripe_prof, 0.0, 1.0, 0.45, 0.3)

    def onto(p, d, lift):
        hit = tree.ray_cast(p - d * 0.3, d, 0.6)
        return hit[0] + hit[1] * lift if hit[0] is not None else None

    b = bmesh.new()
    # Laces: crossed between six pairs of eyelets, every point laid on the instep so none floats, with a bar across
    # the top and the bottom pair.
    def eyelet(k, sd):
        t = 0.47 + k * 0.042
        return heel + fwd * (t * length) + right * (sd * upper_prof(t)[0] * 0.5)

    def lace(a, c, n=9):
        pts = [onto(a.lerp(c, i / n) + Vector((0, 0, 0.3)), Vector((0, 0, -1)), 0.0032) for i in range(n + 1)]
        if None not in pts:
            tube_mesh(b, pts, 0.0027, 6)

    for k in range(6):
        for sd in (1, -1):
            q = onto(eyelet(k, sd) + Vector((0, 0, 0.3)), Vector((0, 0, -1)), 0.002)
            if q is not None:
                g = bmesh.ops.create_icosphere(b, subdivisions=1, radius=0.0042)
                bmesh.ops.translate(b, vec=q, verts=g['verts'])
            if k < 5:
                lace(eyelet(k, sd), eyelet(k + 1, -sd))
    lace(eyelet(0, 1), eyelet(0, -1))
    lace(eyelet(5, 1), eyelet(5, -1))
    laces = bpy.data.objects.new('V3_laces_' + side, bpy.data.meshes.new('V3_laces_' + side))
    SC.objects.link(laces)
    b.to_mesh(laces.data)
    b.free()
    laces.data.materials.append(M_LACE)
    # The parody swoosh (a wave, not the real mark) on both sides, plus a heel tab and a padded collar.
    b = bmesh.new()
    for sd in (1, -1):
        prev = None
        for i in range(25):
            u = i / 24
            t = 0.16 + 0.5 * u
            zc = 0.088 + 0.02 * math.sin(2 * math.pi * u * 1.25) + 0.012 * u
            half = 0.0065 * math.sin(math.pi * (0.08 + 0.84 * u)) + 0.002
            base = heel + fwd * (t * length)
            pts = [onto(base + right * (sd * 0.2) + Vector((0, 0, zc + dz)), -right * sd, 0.0025) for dz in (-half, half)]
            if None in pts:
                prev = None
                continue
            cur = [b.verts.new(p) for p in pts]
            if prev:
                b.faces.new((prev[0], cur[0], cur[1], prev[1]) if sd > 0 else (prev[1], cur[1], cur[0], prev[0]))
            prev = cur
    tab = onto(heel + Vector((0, 0, 0.145)) - fwd * 0.2, fwd, 0.006)
    if tab is not None:
        g = bmesh.ops.create_cube(b, size=1.0)
        bmesh.ops.scale(b, vec=Vector((0.008, 0.026, 0.04)), verts=g['verts'])
        bmesh.ops.rotate(b, cent=Vector(), matrix=Matrix.Rotation(math.atan2(fwd.y, fwd.x), 3, 'Z'), verts=g['verts'])
        bmesh.ops.translate(b, vec=tab, verts=g['verts'])
    logo = bpy.data.objects.new('V3_swoosh_' + side, bpy.data.meshes.new('V3_swoosh_' + side))
    SC.objects.link(logo)
    b.to_mesh(logo.data)
    b.free()
    logo.data.materials.append(M_ACCENT)
    for p in logo.data.polygons:
        p.use_smooth = True
    for p in laces.data.polygons:
        p.use_smooth = True
    # A padded collar round the leg and a tongue standing in front of it.
    ank = Vector((foot.x, foot.y, 0.0))
    b = bmesh.new()
    cc = ank - fwd * 0.004 + Vector((0, 0, COLLAR_Z))
    R1, R2, rt = 0.043, 0.04, 0.0105
    rings = []
    for i in range(28):
        a = 2 * math.pi * i / 28
        c = cc + fwd * (math.cos(a) * R1) + right * (math.sin(a) * R2) + Vector((0, 0, -0.006 * math.cos(a)))
        out = (fwd * math.cos(a) * R2 + right * math.sin(a) * R1).normalized()
        rings.append([b.verts.new(c + out * (math.cos(q) * rt) + Vector((0, 0, math.sin(q) * rt * 1.25))) for q in (2 * math.pi * j / 10 for j in range(10))])
    for i in range(28):
        for j in range(10):
            b.faces.new((rings[i][j], rings[(i + 1) % 28][j], rings[(i + 1) % 28][(j + 1) % 10], rings[i][(j + 1) % 10]))
    g = bmesh.ops.create_cube(b, size=1.0)
    bmesh.ops.scale(b, vec=Vector((0.013, 0.05, 0.062)), verts=g['verts'])
    bmesh.ops.bevel(b, geom=[e for e in b.edges if all(v in g['verts'] for v in e.verts)], offset=0.005, segments=3, profile=0.5, affect='EDGES')
    tv = [v for v in b.verts if not any(v in r for r in rings)]
    bmesh.ops.rotate(b, cent=Vector(), matrix=Matrix.Rotation(math.radians(-16), 3, 'Y'), verts=tv)
    bmesh.ops.rotate(b, cent=Vector(), matrix=Matrix.Rotation(math.atan2(fwd.y, fwd.x), 3, 'Z'), verts=tv)
    bmesh.ops.translate(b, vec=cc + fwd * (R1 + 0.004) + Vector((0, 0, 0.004)), verts=tv)
    bmesh.ops.recalc_face_normals(b, faces=b.faces[:])
    collar = bpy.data.objects.new('V3_collar_' + side, bpy.data.meshes.new('V3_collar_' + side))
    SC.objects.link(collar)
    b.to_mesh(collar.data)
    b.free()
    collar.data.materials.append(M_SHOE)
    for p in collar.data.polygons:
        p.use_smooth = True
    parts = (upper, sole_o, stripe, laces, logo, collar)
    for o in parts:
        o.vertex_groups.new(name='foot_' + side)
        o.vertex_groups.new(name='ball_' + side)
        for v in o.data.vertices:
            t = (v.co - heel).dot(fwd) / length
            wb = max(0.0, min(1.0, (t - 0.55) / 0.15))
            o.vertex_groups['foot_' + side].add([v.index], 1 - wb, 'REPLACE')
            if wb > 0:
                o.vertex_groups['ball_' + side].add([v.index], wb, 'REPLACE')
    return parts


def sock(side):
    # A ribbed sock from inside the shoe up the leg into the trousers, bending at the ankle: whatever the pose, what
    # shows between the collar and the hem is the sock, never the room behind.
    knee, ankle = bone_seg('calf_' + side)
    up = (knee - ankle).normalized()
    x = Vector((1, 0, 0))
    x = (x - up * x.dot(up)).normalized()
    y = up.cross(x)
    low = Vector((ankle.x, ankle.y, SOCK_Z0))
    stations = [(low, 0.034), (low.lerp(ankle, 0.5), 0.036), (ankle, 0.037)] + [(ankle + up * d, r) for d, r in ((0.035, 0.038), (0.08, 0.041), (0.13, 0.045), (0.18, 0.048), (SOCK_UP, 0.049))]
    b = bmesh.new()
    uv = b.loops.layers.uv.new('UVMap')
    N = 20
    rings, vs = [], []
    run = 0.0
    for i, (c, r) in enumerate(stations):
        if i:
            run += (c - stations[i - 1][0]).length
        rings.append([b.verts.new(c + (x * math.cos(a) + y * math.sin(a)) * r) for a in (2 * math.pi * j / N for j in range(N))])
        vs.append(run)
    for i in range(len(rings) - 1):
        for j in range(N):
            f = b.faces.new((rings[i][j], rings[i][(j + 1) % N], rings[i + 1][(j + 1) % N], rings[i + 1][j]))
            for lp, (u, v) in zip(f.loops, ((j / N, vs[i]), ((j + 1) / N, vs[i]), ((j + 1) / N, vs[i + 1]), (j / N, vs[i + 1]))):
                lp[uv].uv = (u * 4, v * 4)
    for ring, c in ((rings[0], stations[0][0]), (rings[-1], stations[-1][0])):
        m = b.verts.new(c)
        for j in range(N):
            b.faces.new((ring[j], ring[(j + 1) % N], m))
    bmesh.ops.recalc_face_normals(b, faces=b.faces[:])
    o = bpy.data.objects.new('V3_sock_' + side, bpy.data.meshes.new('V3_sock_' + side))
    SC.objects.link(o)
    b.to_mesh(o.data)
    b.free()
    o.data.materials.append(M_SOCK)
    for p in o.data.polygons:
        p.use_smooth = True
    for n in ('foot_', 'calf_'):
        o.vertex_groups.new(name=n + side)
    for v in o.data.vertices:
        k = max(0.0, min(1.0, ((v.co - ankle).dot(up) + 0.012) / 0.06))
        k = k * k * (3 - 2 * k)
        o.vertex_groups['calf_' + side].add([v.index], k, 'REPLACE')
        o.vertex_groups['foot_' + side].add([v.index], 1 - k, 'REPLACE')
    return o


shoe_parts = sneaker('l') + sneaker('r') + (sock('l'), sock('r'))

# ---------- the toy body: only the hands show (four chunky fingers); clothes and the neck socket cover the rest ----------
W = group_weights(body)
bm = bmesh.new()
bm.from_mesh(body.data)
bm.transform(mw)
bm.verts.ensure_lookup_table()
HANDS = ('hand_',) + FINGERS
dead = []
for f in bm.faces:
    fw = {}
    for v in f.verts:
        for k, x in W[v.index].items():
            fw[k] = fw.get(k, 0) + x
    d = dom(fw)
    c = f.calc_center_median()
    side = 'l' if c.x > 0 else 'r'
    if not d.startswith(HANDS) or d.startswith('pinky') or (c - WRIST[side]).dot(FORE[side]) < -0.035:
        dead.append(f)
bmesh.ops.delete(bm, geom=dead, context='FACES')
drop_islands(bm, 20)
for l in loops_of(bm):
    s = set(l)
    bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary and e.verts[0] in s and e.verts[1] in s], sides=0)
# The filled ends (the wrist, where the little finger was) must face outward like the rest, or they draw as holes.
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
bm.normal_update()
for v in bm.verts:
    v.co += v.normal * 0.003
for _ in range(3):
    bmesh.ops.smooth_vert(bm, verts=bm.verts[:], factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
bm.transform(mw.inverted())
bm.to_mesh(body.data)
bm.free()
body.name = 'V3_body'
for p in body.data.polygons:
    p.use_smooth = True
print('hands verts', len(body.data.vertices), 'cuffs', {s: (tuple(round(x, 3) for x in CUFF[s][0]), round(CUFF[s][2], 3)) for s in 'lr'})


def rig_to(o, groups):
    keep = o.matrix_world.copy()
    o.parent = arm
    o.matrix_parent_inverse = Matrix()
    o.matrix_world = keep
    for m in list(o.modifiers):
        if m.type == 'ARMATURE':
            o.modifiers.remove(m)
    if isinstance(groups, str):
        o.vertex_groups.clear()
        o.vertex_groups.new(name=groups).add(range(len(o.data.vertices)), 1.0, 'REPLACE')
    elif groups is not None:
        dt = o.modifiers.new('dt', 'DATA_TRANSFER')
        dt.object = groups
        dt.use_vert_data = True
        dt.data_types_verts = {'VGROUP_WEIGHTS'}
        dt.vert_mapping = 'POLYINTERP_NEAREST'
        dt.layers_vgroup_select_src = 'ALL'
        dt.layers_vgroup_select_dst = 'NAME'
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.datalayout_transfer(modifier='dt')
        bpy.ops.object.modifier_apply(modifier='dt')
    o.modifiers.new('Armature', 'ARMATURE').object = arm


before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=UBC + '/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf')
new = [o for o in bpy.data.objects if o not in before]
full = next(o for o in new if o.type == 'MESH' and o.name.startswith('SuperHero_Male'))
fmw = full.matrix_world.copy()
full.parent = None
full.matrix_world = fmw
for o in new:
    if o is not full:
        bpy.data.objects.remove(o)
for m in list(full.modifiers):
    full.modifiers.remove(m)
reshape(full)
def smooth_weights(o, iters=25):
    # Garments sit away from the body, so the copied weights jump between bones; diffuse them over the surface.
    names = [g.name for g in o.vertex_groups]
    nv = len(o.data.vertices)
    Wt = np.zeros((nv, len(names)), dtype=np.float64)
    for v in o.data.vertices:
        for g in v.groups:
            Wt[v.index, g.group] = g.weight
    # Linings are left out: a lining's floor joins every point round an opening to one middle point, and smoothing
    # across it would bleed the left side's weights into the right (they take their edge's weights afterwards).
    lined = {vi for vi, _ in LINING_SRC.get(o.name, [])}
    e = np.array([ed.vertices[:] for ed in o.data.edges if ed.vertices[0] not in lined and ed.vertices[1] not in lined], dtype=np.int64)
    deg = np.bincount(e.ravel(), minlength=nv).astype(np.float64)[:, None]
    for _ in range(iters):
        S = np.zeros_like(Wt)
        np.add.at(S, e[:, 0], Wt[e[:, 1]])
        np.add.at(S, e[:, 1], Wt[e[:, 0]])
        Wt = 0.5 * Wt + 0.5 * S / np.maximum(deg, 1)
    Wt /= np.maximum(Wt.sum(1, keepdims=True), 1e-9)
    for gi, name in enumerate(names):
        g = o.vertex_groups[name]
        col = Wt[:, gi]
        g.remove(range(nv))
        for vi in np.nonzero(col > 0.002)[0]:
            g.add([int(vi)], float(col[vi]), 'REPLACE')


for o in (hood_o, hood_dn, pants):
    rig_to(o, full)
    smooth_weights(o)


def hang_from_hips(o, z_top, span, most=1.0):
    if 'pelvis' not in o.vertex_groups:
        o.vertex_groups.new(name='pelvis')
    idx = {g.index: g.name for g in o.vertex_groups}
    pel = o.vertex_groups['pelvis']
    for v in o.data.vertices:
        k = most * max(0.0, min(1.0, (z_top - (o.matrix_world @ v.co).z) / span))
        if not k:
            continue
        moved = 0.0
        for g in v.groups:
            if idx[g.group].startswith(('thigh', 'calf')):
                moved += g.weight * k
                g.weight *= 1 - k
        if moved:
            pel.add([v.index], moved, 'ADD')


hang_from_hips(hood_o, waist_z + 0.02, 0.12, 0.6)
smooth_weights(hood_o, 6)
rig_to(pocket, hood_o)
for o in cargo_parts:
    rig_to(o, pants)
for V in HOODIE_VARIANTS:
    rig_to(V['o'], full)
    smooth_weights(V['o'])
    hang_from_hips(V['o'], waist_z + 0.02, 0.12, 0.6)
    smooth_weights(V['o'], 6)
    rig_to(V['pocket'], V['o'])
for po, _, parts_ in PANTS_VARIANTS:
    rig_to(po, full)
    smooth_weights(po)
    for o in parts_:
        rig_to(o, po)
for o in shoe_parts:
    rig_to(o, None)
for hu in (hood_up, hood_up_tv):
    rig_to(hu, None)
    hu.vertex_groups.new(name='neck_01')
    hu.vertex_groups.new(name='Head')
    for v in hu.data.vertices:
        wh = max(0.0, min(1.0, (v.co.z - COLLAR_TOP - 0.01) / 0.1))
        hu.vertex_groups['Head'].add([v.index], wh, 'REPLACE')
        hu.vertex_groups['neck_01'].add([v.index], 1 - wh, 'REPLACE')


for o in [hood_o, pants] + [V['o'] for V in HOODIE_VARIANTS] + [po for po, _, _ in PANTS_VARIANTS]:
    settle_linings(o)


# Nothing pokes through a hood: every head's points, down to well below the hood's middle, must sit inside it (inside
# the fabric, which thickens inward), apart from the face opening at the front. Prints how many do not, per head; the
# build stops if any head breaks through.
def through(head_names, C, R):
    n = 0
    for name in head_names:
        o = bpy.data.objects[name]
        for v in o.data.vertices:
            p = o.matrix_world @ v.co
            if p.z < C.z - 0.6 * R[2] or p.y < HC.y - 0.1 + 0.25 * (p.z - C.z):
                continue
            e = (p.x / R[0]) ** 2 + ((p.y - C.y) / R[1]) ** 2 + ((p.z - C.z) / R[2]) ** 2
            if e > 0.84:
                n += 1
                if n <= 12:
                    print('  through:', name, 'at', tuple(round(x, 3) for x in (p - C)), 'reach', round(e, 3))
    return n


bpy.data.objects.remove(full)


def piece(name, build, materials, bone='Head', smooth=True):
    b = bmesh.new()
    build(b)
    o = bpy.data.objects.new(name, bpy.data.meshes.new(name))
    SC.objects.link(o)
    b.to_mesh(o.data)
    b.free()
    for m in (materials if isinstance(materials, list) else [materials]):
        o.data.materials.append(m)
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
    rig_to(o, bone)
    return o


def rbox(b, size, center, bevel=0.0, seg=3, mi=0):
    before = set(b.faces)
    g = bmesh.ops.create_cube(b, size=1.0)
    bmesh.ops.scale(b, vec=Vector(size), verts=g['verts'])
    bmesh.ops.translate(b, vec=Vector(center), verts=g['verts'])
    if bevel:
        bmesh.ops.bevel(b, geom=list({e for v in g['verts'] for e in v.link_edges}), offset=bevel, segments=seg, profile=0.5, affect='EDGES')
    faces = [f for f in b.faces if f not in before]
    for f in faces:
        f.material_index = mi
    return faces


def cyl(b, r1, r2, depth, center, axis='Z', seg=24, cap=True, mi=0):
    before = set(b.faces)
    g = bmesh.ops.create_cone(b, cap_ends=cap, segments=seg, radius1=r1, radius2=r2, depth=depth)
    if axis == 'X':
        bmesh.ops.rotate(b, cent=Vector(), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'), verts=g['verts'])
    elif axis == 'Y':
        bmesh.ops.rotate(b, cent=Vector(), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'), verts=g['verts'])
    bmesh.ops.translate(b, vec=Vector(center), verts=g['verts'])
    for f in b.faces:
        if f not in before:
            f.material_index = mi


def sphere(b, size, center, mi=0, sub=3):
    before = set(b.faces)
    g = bmesh.ops.create_icosphere(b, subdivisions=sub, radius=1.0)
    bmesh.ops.scale(b, vec=Vector(size), verts=g['verts'])
    bmesh.ops.translate(b, vec=Vector(center), verts=g['verts'])
    for f in b.faces:
        if f not in before:
            f.material_index = mi


def screen(b, w, h, center, mi, round_r=0.0, segs=48):
    uv = b.loops.layers.uv.verify()
    c = Vector(center)
    if round_r:
        mid = b.verts.new(c)
        ring = [b.verts.new(c + Vector((math.cos(2 * math.pi * i / segs) * round_r, 0, math.sin(2 * math.pi * i / segs) * round_r))) for i in range(segs)]
        for i in range(segs):
            f = b.faces.new((mid, ring[(i + 1) % segs], ring[i]))
            f.material_index = mi
            for l in f.loops:
                p = l.vert.co - c
                l[uv].uv = (0.5 + p.x / (2 * round_r), 0.5 + p.z / (2 * round_r))
        return
    hw, hh = w / 2, h / 2
    vs = [b.verts.new(c + Vector(p)) for p in ((-hw, 0, -hh), (hw, 0, -hh), (hw, 0, hh), (-hw, 0, hh))]
    f = b.faces.new(vs)
    f.material_index = mi
    for l, t in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        l[uv].uv = t


M_TV = mat('M_TV_Case', (0.8, 0.79, 0.76), 0.45)
M_TV_TRIM = mat('M_TV_Trim', (0.3, 0.31, 0.34), 0.35, metal=0.4)
M_SCREEN_TV = mat('M_TV_Screen', (0, 0, 0), 0.15, emit=(0.15, 0.9, 0.78), strength=1.5)
M_HELMET = mat('M_Helmet', (0.82, 0.81, 0.78), 0.35)
M_VISOR = mat('M_Visor', (0.012, 0.014, 0.02), 0.08, metal=0.2)
M_LED = mat('M_Visor_Face', (0, 0, 0), 0.5, emit=(0.15, 0.9, 0.78), strength=2.2)
M_SCREEN_EMOJI = mat('M_Emoji_Screen', (0, 0, 0), 0.15, emit=(1.0, 0.82, 0.3), strength=1.6)
M_RING = mat('M_Ring', (0.15, 0.9, 0.78), 0.4, emit=(0.15, 0.9, 0.78), strength=2.5)
M_VOID = mat('M_Void', (0.0, 0.0, 0.0), 1.0)
M_EYES = mat('M_Eye_Glow', (0, 0, 0), 0.5, emit=(0.2, 1.0, 0.85), strength=6)
M_CURL = mat('M_Hair', (0.06, 0.05, 0.05), 0.6)

# The neck socket every head sits in: a short soft-white neck with a ring around it.
socket_z = head_pivot.z - 0.005


def build_socket(b):
    # The neck runs from well inside the hoodie up into the ring, so no gap shows at any neckline.
    n0, n1 = neck_z - 0.075, socket_z + 0.02
    cyl(b, 0.05, 0.046, n1 - n0, (0, neck_c.y + 0.004, (n0 + n1) / 2), seg=32, mi=0)
    before = set(b.faces)
    g = bmesh.ops.create_cone(b, cap_ends=False, segments=32, radius1=0.062, radius2=0.058, depth=0.022)
    bmesh.ops.translate(b, vec=Vector((0, neck_c.y + 0.004, socket_z + 0.02)), verts=g['verts'])
    for f in b.faces:
        if f not in before:
            f.material_index = 1


socket = piece('V3_socket', build_socket, [M_TOY, M_SOCKET], bone='neck_01')
PLUG = (0, neck_c.y + 0.004, socket_z + 0.045)


def build_tv(b):
    c = HC + Vector((0, -0.005, 0.03))
    rbox(b, (0.33, 0.28, 0.27), c, 0.04, mi=0)
    rbox(b, (0.265, 0.02, 0.205), c + Vector((-0.015, -0.138, 0)), 0.03, mi=1)
    screen(b, 0.235, 0.18, c + Vector((-0.015, -0.151, 0)), 2)
    for k in range(2):
        cyl(b, 0.016, 0.016, 0.016, c + Vector((0.138, -0.138, 0.04 - k * 0.065)), axis='Y', mi=1)
    for k in range(5):
        rbox(b, (0.004, 0.15, 0.01), c + Vector((0.166, 0.03, -0.065 + k * 0.028)), mi=1)
    cyl(b, 0.05, 0.06, 0.04, (PLUG[0], PLUG[1], PLUG[2] + 0.005), mi=1)


tv = piece('V3_head_tv', build_tv, [M_TV, M_TV_TRIM, M_SCREEN_TV, M_RING], smooth=False)
for p in tv.data.polygons:
    p.use_smooth = p.material_index != 2
def build_tv_antennas(b):
    c = HC + Vector((0, -0.005, 0.03))
    for s in (-1, 1):
        before = set(b.faces)
        g = bmesh.ops.create_cone(b, cap_ends=True, segments=8, radius1=0.005, radius2=0.0025, depth=0.16)
        bmesh.ops.rotate(b, cent=Vector(), matrix=Matrix.Rotation(s * 0.45, 3, 'Y'), verts=g['verts'])
        bmesh.ops.translate(b, vec=c + Vector((s * 0.07, 0.02, 0.21)), verts=g['verts'])
        for f in b.faces:
            if f not in before:
                f.material_index = 1
        sphere(b, (0.013, 0.013, 0.013), c + Vector((s * 0.105, 0.02, 0.28)), mi=3, sub=2)
tv_antennas = piece('V3_head_tv_antennas', build_tv_antennas, [M_TV, M_TV_TRIM, M_SCREEN_TV, M_RING])


def build_helmet(b):
    sphere(b, (0.155, 0.17, 0.178), HC + Vector((0, 0.005, 0)), mi=0)
    for s in (-1, 1):
        cyl(b, 0.05, 0.046, 0.034, HC + Vector((s * 0.153, 0.012, -0.005)), axis='X', mi=0)
        cyl(b, 0.036, 0.036, 0.006, HC + Vector((s * 0.172, 0.012, -0.005)), axis='X', cap=False, mi=1)
    cyl(b, 0.05, 0.058, 0.04, PLUG, mi=2)


helmet = piece('V3_head_helmet', build_helmet, [M_HELMET, M_RING, M_SOCKET])


def build_visor(b):
    sphere(b, (0.158, 0.174, 0.182), HC + Vector((0, 0.005, 0)))
    cut(b, (0, HC.y - 0.07, 0), (0, 1, 0))
    cut(b, (0, 0, HC.z + 0.075), (0, 0, 1))
    cut(b, (0, 0, HC.z - 0.085), (0, 0, -1))


visor = piece('V3_head_visor', build_visor, M_VISOR)


def build_leds(b):
    for gx in range(-3, 4):
        for gz in range(-1, 2):
            x, z = gx * 0.019, gz * 0.019
            y = HC.y + 0.005 - math.sqrt(max(0.0, 1 - (x / 0.158) ** 2 - (z / 0.182) ** 2)) * 0.174 - 0.004
            sphere(b, (0.0055, 0.0055, 0.0055), (x, y, HC.z + z), sub=1)


leds = piece('V3_head_visor_face', build_leds, M_LED)


def build_emoji(b):
    c = HC + Vector((0, 0, 0.0))
    cyl(b, 0.165, 0.165, 0.085, c, axis='Y', seg=56, mi=0)
    cyl(b, 0.168, 0.168, 0.014, c + Vector((0, -0.037, 0)), axis='Y', seg=56, cap=False, mi=1)
    screen(b, 0, 0, c + Vector((0, -0.0435, 0)), 2, round_r=0.15)
    cyl(b, 0.05, 0.06, 0.06, (PLUG[0], PLUG[1], PLUG[2] - 0.005), mi=0)


emoji = piece('V3_head_emoji', build_emoji, [M_TV, M_RING, M_SCREEN_EMOJI])


def build_void(b):
    sphere(b, (0.125, 0.07, 0.15), HC + Vector((0, -0.05, -0.01)), mi=0)
    for s in (-1, 1):
        sphere(b, (0.024, 0.008, 0.014), HC + Vector((s * 0.046, -0.117, 0.018)), mi=1, sub=2)


void = piece('V3_head_void', build_void, [M_VOID, M_EYES])
def build_void_full(b):
    sphere(b, (0.15, 0.163, 0.172), HC + Vector((0, 0.005, 0)), mi=0)
    for s in (-1, 1):
        sphere(b, (0.026, 0.009, 0.015), HC + Vector((s * 0.05, -0.153, 0.02)), mi=1, sub=2)
    # With the hood down the neck is black too, from inside the hoodie up into the head; the white socket is hidden.
    n0, n1 = neck_z - 0.075, socket_z + 0.07
    cyl(b, 0.051, 0.05, n1 - n0, (0, neck_c.y + 0.004, (n0 + n1) / 2), seg=32, mi=0)
void_full = piece('V3_head_void_full', build_void_full, [M_VOID, M_EYES])


# The toy version of his head for the mosaic achievement: an egg head, sculpted curls and a beard shape.
def merge(b, src, mi):
    vm = {v: b.verts.new(v.co) for v in src.verts}
    for f in src.faces:
        b.faces.new([vm[v] for v in f.verts]).material_index = mi
    src.free()


def build_toyhead(b):
    # His head as a designer toy: smooth egg, small ears, a curly mohawk with bare sides, and a short beard.
    sphere(b, (0.118, 0.13, 0.15), HC + Vector((0, 0, -0.005)), mi=0)
    for s in (-1, 1):
        sphere(b, (0.018, 0.012, 0.03), HC + Vector((s * 0.118, 0.01, -0.01)), mi=0, sub=2)
    rng = random.Random(7)
    for i in range(90):
        u = rng.random()
        y = HC.y - 0.11 + u * 0.24
        x = rng.uniform(-1, 1) * 0.05 * (1 - 0.3 * u)
        zz = HC.z - 0.005 + 0.15 * math.sqrt(max(0.0, 1 - ((y - HC.y) / 0.135) ** 2)) * math.sqrt(max(0.0, 1 - (x / 0.118) ** 2)) + 0.01
        r = rng.uniform(0.017, 0.025)
        sphere(b, (r, r, r * 0.9), (x, y, zz), mi=1, sub=2)
    beard = bmesh.new()
    bmesh.ops.create_uvsphere(beard, u_segments=28, v_segments=16, radius=1.0)
    bmesh.ops.scale(beard, vec=Vector((0.124, 0.136, 0.135)), verts=beard.verts)
    bmesh.ops.translate(beard, vec=HC + Vector((0, -0.006, -0.03)), verts=beard.verts)
    cut(beard, (0, 0, HC.z - 0.06), (0, 0, 1))
    cut(beard, (0, HC.y + 0.005, 0), (0, 1, 0))
    merge(b, beard, 1)
    sphere(b, (0.035, 0.012, 0.009), HC + Vector((0, -0.128, -0.05)), mi=1, sub=2)


toyhead = piece('V3_head_toy', build_toyhead, [M_TOY, M_CURL])
HOOD_CHECK = {'hood': (['V3_head_void'], HOOD_C, HOOD_R), 'tv': (['V3_head_tv'], *TV_HOOD),
              'visor': (['V3_head_helmet', 'V3_head_visor', 'V3_head_visor_face'], HOOD_C, HOOD_R),
              'emoji': (['V3_head_emoji'], HOOD_C, HOOD_R), 'mosaic': (['V3_head_toy'], HOOD_C, HOOD_R)}
bad = {k: through(*v) for k, v in HOOD_CHECK.items()}
print('points through the hood, per head:', bad)
assert not any(bad.values()), f'a head pokes through its hood: {bad}'

# ---------- accessories, fitted to the default hood-up head ----------
M_PHONES = mat('M_Headphones', (0.07, 0.075, 0.09), 0.4)
M_GOLD = mat('M_Gold', (0.85, 0.65, 0.3), 0.25, metal=1.0)
M_WATCH = mat('M_Watch', (0.06, 0.06, 0.07), 0.3)
M_WFACE = mat('M_Watch_Face', (0, 0, 0), 0.3, emit=(0.15, 0.9, 0.78), strength=2)
M_BEAD = mat('M_Bead', (0.06, 0.04, 0.03), 0.35)
M_BEAD2 = mat('M_Bead2', (0.3, 0.17, 0.09), 0.4)
M_BAG = fabric('M_Backpack', (0.16, 0.17, 0.2), 0.85, KNIT, 5)
M_SCARF = mat('M_Scarf', (0.95, 0.95, 0.93), 0.85)
M_SCARF2 = mat('M_Scarf_Stripe', (0.33, 0.15, 0.5), 0.8)
M_GLASS = mat('M_Estekan', (0.85, 0.6, 0.35), 0.1)
M_CAP = mat('M_Cap', (0.08, 0.085, 0.1), 0.75)
M_BEANIE = fabric('M_Beanie', (0.55, 0.14, 0.09), 0.9, RIB, 5)


def build_phones(b):
    R = 0.215
    for s in (-1, 1):
        cyl(b, 0.058, 0.052, 0.042, HOOD_C + Vector((s * (R + 0.01), 0, -0.02)), axis='X', mi=0)
        cyl(b, 0.042, 0.042, 0.005, HOOD_C + Vector((s * (R + 0.033), 0, -0.02)), axis='X', cap=False, mi=1)
    top = HOOD_C.z + 0.235
    for i in range(24):
        a0, a1 = math.pi * i / 24, math.pi * (i + 1) / 24
        p0 = Vector((math.cos(a0) * (R + 0.012), HOOD_C.y, HOOD_C.z - 0.02 + math.sin(a0) * (top - HOOD_C.z + 0.02)))
        p1 = Vector((math.cos(a1) * (R + 0.012), HOOD_C.y, HOOD_C.z - 0.02 + math.sin(a1) * (top - HOOD_C.z + 0.02)))
        d = p1 - p0
        before = set(b.faces)
        g = bmesh.ops.create_cube(b, size=1.0)
        bmesh.ops.scale(b, vec=Vector((d.length + 0.005, 0.04, 0.016)), verts=g['verts'])
        bmesh.ops.rotate(b, cent=Vector(), matrix=Matrix.Rotation(-math.atan2(d.z, d.x), 3, 'Y'), verts=g['verts'])
        bmesh.ops.translate(b, vec=(p0 + p1) / 2, verts=g['verts'])


phones = piece('V3_acc_headphones', build_phones, [M_PHONES, M_RING])


def build_chain(b):
    # A chain lying on the hoodie's front, every link projected onto the fabric.
    for i in range(44):
        a = math.pi * (0.06 + 0.88 * i / 43)
        p = ray_grid(HOOD_TREE, [Vector((math.cos(a) * 0.085, -1.0, neck_z - 0.035 - math.sin(a) * 0.13))], Vector((0, 1, 0)), 0.008)[0]
        if p is not None:
            sphere(b, (0.0055, 0.0055, 0.0055), p, sub=1)
    p = ray_grid(HOOD_TREE, [Vector((0, -1.0, neck_z - 0.185))], Vector((0, 1, 0)), 0.01)[0]
    if p is not None:
        cyl(b, 0.017, 0.017, 0.005, p, axis='Y')


chain = piece('V3_acc_chain', build_chain, M_GOLD, bone='spine_03')


def frame(ax, hint):
    # Axes for a ring around `ax`, with `up` turned as close to `hint` as it can be.
    up = (hint - ax * hint.dot(ax)).normalized()
    return ax, ax.cross(up).normalized(), up


def obox(b, size, center, X, Y, Z, mi=0):
    g = bmesh.ops.create_cube(b, size=1.0)
    M = Matrix((X, Y, Z)).transposed()
    for v in g['verts']:
        v.co = Vector(center) + M @ Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    for f in {f for v in g['verts'] for f in v.link_faces}:
        f.material_index = mi


def ring(b, center, ax, side, r, width, thick, segs=24, mi=0):
    X, Y, Z = frame(ax, Vector((0, 0, 1)))
    for i in range(segs):
        a = 2 * math.pi * i / segs
        rad = Y * math.cos(a) + Z * math.sin(a)
        tan = ax.cross(rad)
        obox(b, (width, 2 * math.pi * r / segs * 1.12, thick), center + rad * r, ax, tan, rad, mi)


def build_watch(b):
    # A chunky watch worn over the left cuff, face up and out.
    c, ax, r = CUFF['l']
    at = c - ax * 0.022
    ring(b, at, ax, 1, r + 0.006, 0.02, 0.006)
    X, Y, Z = frame(ax, Vector((0.6, 0, 1)))
    obox(b, (0.034, 0.034, 0.012), at + Z * (r + 0.012), X, Y, Z, 0)
    obox(b, (0.026, 0.026, 0.003), at + Z * (r + 0.018), X, Y, Z, 1)


watch = piece('V3_acc_watch', build_watch, [M_WATCH, M_WFACE], bone='lowerarm_l', smooth=False)


def build_beads(b):
    # Two bead bracelets on the right wrist, just past the cuff.
    c, ax, r = CUFF['r']
    X, Y, Z = frame(ax, Vector((0, 0, 1)))
    hv = [mw @ v.co for v in body.data.vertices]
    for k, (off, n, br, mi) in enumerate(((0.006, 18, 0.0062, 0), (0.019, 16, 0.0068, 1))):
        at = c + ax * off
        near = [(p - at) - ax * (p - at).dot(ax) for p in hv if abs((p - at).dot(ax)) < 0.006 and (p - at).length < 0.08]
        rad = (max(v.length for v in near) if near else r * 0.8) + br * 0.8
        for i in range(n):
            a = 2 * math.pi * i / n
            sphere(b, (br, br, br), at + (Y * math.cos(a) + Z * math.sin(a)) * rad, mi=mi, sub=1)


beads = piece('V3_acc_bracelets', build_beads, [M_BEAD, M_BEAD2], bone='hand_r')
back_y = max((hood_o.matrix_world @ v.co).y for v in hood_o.data.vertices)


def build_bag(b):
    rbox(b, (0.32, 0.13, 0.42), (0, back_y + 0.07, neck_z - 0.3), 0.05)
    rbox(b, (0.24, 0.05, 0.16), (0, back_y + 0.15, neck_z - 0.4), 0.025)


bag = piece('V3_acc_backpack', build_bag, M_BAG, bone='spine_03')
front_y = min((hood_o.matrix_world @ v.co).y for v in hood_o.data.vertices if (hood_o.matrix_world @ v.co).z > neck_z - 0.12)


def build_scarf(b):
    for i in range(36):
        a = 2 * math.pi * i / 36
        p = Vector((math.cos(a) * 0.1, neck_c.y + math.sin(a) * 0.1, neck_z - 0.01))
        before = set(b.faces)
        g = bmesh.ops.create_cube(b, size=1.0)
        bmesh.ops.scale(b, vec=Vector((0.03, 0.03, 0.045)), verts=g['verts'])
        bmesh.ops.translate(b, vec=p, verts=g['verts'])
        for f in b.faces:
            if f not in before:
                f.material_index = 1 if i % 6 == 0 else 0
    for k in range(10):
        before = set(b.faces)
        rbox(b, (0.07, 0.02, 0.045), (0.05, front_y - 0.01, neck_z - 0.07 - k * 0.045), 0.006, mi=1 if k % 3 == 1 else 0)


scarf = piece('V3_acc_scarf', build_scarf, [M_SCARF, M_SCARF2], bone='spine_03', smooth=False)
hr_a, hr_b = bone_seg('hand_r')


def build_tea(b):
    c = hr_b + Vector((0, -0.03, -0.02))
    cyl(b, 0.024, 0.03, 0.075, c, seg=16, mi=0)
    cyl(b, 0.045, 0.045, 0.006, c + Vector((0, 0, -0.04)), seg=24, mi=1)


tea = piece('V3_acc_tea', build_tea, [M_GLASS, M_TOY], bone='hand_r')
TOP = HC.z + 0.155


def build_cap(b):
    before = set(b.faces)
    g = bmesh.ops.create_uvsphere(b, u_segments=30, v_segments=16, radius=1.0)
    bmesh.ops.scale(b, vec=Vector((0.132, 0.145, 0.1)), verts=g['verts'])
    bmesh.ops.translate(b, vec=Vector((0, HC.y + 0.005, TOP - 0.06)), verts=g['verts'])
    cut(b, (0, 0, TOP - 0.06), (0, 0, -1))
    cyl(b, 0.115, 0.115, 0.009, (0, HC.y - 0.13, TOP - 0.062), seg=28)


cap = piece('V3_acc_cap', build_cap, M_CAP)


def build_beanie(b):
    g = bmesh.ops.create_uvsphere(b, u_segments=30, v_segments=16, radius=1.0)
    bmesh.ops.scale(b, vec=Vector((0.135, 0.148, 0.14)), verts=g['verts'])
    bmesh.ops.translate(b, vec=Vector((0, HC.y + 0.006, TOP - 0.085)), verts=g['verts'])
    cut(b, (0, 0, TOP - 0.095), (0, 0, -1))
    cyl(b, 0.14, 0.142, 0.045, (0, HC.y + 0.006, TOP - 0.085), seg=30, cap=False)


beanie = piece('V3_acc_beanie', build_beanie, M_BEANIE)

# ---------- animations ----------
before_o, before_a = set(bpy.data.objects), set(bpy.data.actions)
bpy.ops.import_scene.gltf(filepath=UAL1)
for o in [o for o in bpy.data.objects if o not in before_o]:
    bpy.data.objects.remove(o)
arm.animation_data_create()
for act in [a for a in bpy.data.actions if a not in before_a]:
    if act.name not in KEEP:
        bpy.data.actions.remove(act)
        continue
    act.use_fake_user = True
    tr = arm.animation_data.nla_tracks.new()
    tr.name = act.name
    st = tr.strips.new(act.name, int(act.frame_range[0]), act)
    if hasattr(st, 'action_slot') and act.slots:
        st.action_slot = act.slots[0]
    tr.mute = True
# A sitting style for each kind of seat (sit down, idle, stand up), and where each style puts the hips.
from lib import sitposes
sitposes.add_sitting(arm, ROOT + '/web/assets/sitposes.json')


# ---------- no gaps at the joints ----------
# Through the middle of every joint (ankles, wrists, hips, neck), from all round and from below as well as above, a ray
# must meet a surface: in every move, every sitting pose, every fit of hoodie and trousers and under every head. One
# that gets clean through is a place where you would see the room through the body, like the space there used to be
# between each trouser hem and its shoe. Any face stops a ray, as the page draws both sides of the character's cloth.
def along(bone, t0, t1, n):
    return [(bone, t0 + (t1 - t0) * i / (n - 1)) for i in range(n)]


JOINTS = {
    'ankle_l': along('calf_l', 0.55, 1.0, 10) + along('foot_l', 0.15, 0.45, 3),
    'ankle_r': along('calf_r', 0.55, 1.0, 10) + along('foot_r', 0.15, 0.45, 3),
    'wrist_l': along('lowerarm_l', 0.7, 1.0, 7) + along('hand_l', 0.2, 0.6, 3),
    'wrist_r': along('lowerarm_r', 0.7, 1.0, 7) + along('hand_r', 0.2, 0.6, 3),
    'hip_l': along('thigh_l', 0.0, 0.4, 6),
    'hip_r': along('thigh_r', 0.0, 0.4, 6),
    'neck': [('spine_03', 0.85)] + along('neck_01', 0.0, 1.0, 7),
}
GAP_DIRS = [Vector((math.cos(e) * math.sin(a), -math.cos(e) * math.cos(a), -math.sin(e)))
            for e in (math.radians(v) for v in (-30, -15, 0, 20, 45, 70)) for a in (2 * math.pi * k / 12 for k in range(12))]
WORN = ['V3_body'] + [o.name for o in shoe_parts]
HOODIE = lambda sfx: ['V3_hoodie' + sfx, 'V3_pocket' + sfx]
PANTS = lambda sfx: [n + sfx for n in ('V3_pants', 'V3_cargo_l', 'V3_cargo_r', 'V3_flap_l', 'V3_flap_r')]
HOOD_HEAD = ['V3_socket', 'V3_hood_up', 'V3_head_void']
# What is worn together, and which joints that look is checked at (the page hides the neck socket under the hood
# head with its hood down, and gives the TV its own hood).
LOOKS = {
    'boxy hoodie, straight trousers': (WORN + HOODIE('') + PANTS('') + HOOD_HEAD, list(JOINTS)),
    'short hoodie, tapered trousers': (WORN + HOODIE('_short') + PANTS('_tapered') + HOOD_HEAD, list(JOINTS)),
    'relaxed hoodie, tapered trousers': (WORN + HOODIE('_relaxed') + PANTS('_tapered') + HOOD_HEAD, list(JOINTS)),
    'hood head, hood down': (WORN + HOODIE('') + ['V3_hood_down', 'V3_head_void_full'], ['neck']),
    'tv, hood up': (WORN + HOODIE('') + ['V3_socket', 'V3_hood_up_tv', 'V3_head_tv'], ['neck']),
    'tv, hood down': (WORN + HOODIE('') + ['V3_socket', 'V3_hood_down', 'V3_head_tv', 'V3_head_tv_antennas'], ['neck']),
    'visor, hood down': (WORN + HOODIE('') + ['V3_socket', 'V3_hood_down', 'V3_head_helmet', 'V3_head_visor', 'V3_head_visor_face'], ['neck']),
    'emoji, hood down': (WORN + HOODIE('') + ['V3_socket', 'V3_hood_down', 'V3_head_emoji'], ['neck']),
    'toy head, hood down': (WORN + HOODIE('') + ['V3_socket', 'V3_hood_down', 'V3_head_toy'], ['neck']),
    'visor, hood up': (WORN + HOODIE('') + ['V3_socket', 'V3_hood_up', 'V3_head_helmet', 'V3_head_visor', 'V3_head_visor_face'], ['neck']),
    'emoji, hood up': (WORN + HOODIE('') + ['V3_socket', 'V3_hood_up', 'V3_head_emoji'], ['neck']),
    'toy head, hood up': (WORN + HOODIE('') + ['V3_socket', 'V3_hood_up', 'V3_head_toy'], ['neck']),
}


def joint_gaps(looks, skip=None, frames=4, reach=1.2):
    found = {}
    used = sorted({n for names, _ in looks.values() for n in names if not (skip and n.startswith(skip))})
    for tr in [t for t in arm.animation_data.nla_tracks if t.strips]:
        act = tr.strips[0].action
        arm.animation_data.action = act
        if act.slots:
            arm.animation_data.action_slot = act.slots[0]
        f0, f1 = act.frame_range
        # The sitting clip holds one pose per frame, so every frame of it is checked; the moves are sampled.
        at = range(int(f0), int(f1) + 1) if tr.name == 'SitPoses' else [int(round(f0 + (f1 - f0) * (k + 0.5) / frames)) for k in range(frames)]
        for frame in at:
            bpy.context.scene.frame_set(frame)
            dg = bpy.context.evaluated_depsgraph_get()
            trees = {}
            for n in used:
                o = bpy.data.objects[n]
                inv = o.matrix_world.inverted()
                trees[n] = (BVHTree.FromObject(o, dg), inv, inv.to_3x3())
            mids = {j: [(arm.matrix_world @ arm.pose.bones[b].head).lerp(arm.matrix_world @ arm.pose.bones[b].tail, t) for b, t in pts] for j, pts in JOINTS.items()}
            for look, (names, joints) in looks.items():
                mine = [trees[n] for n in names if n in trees]
                for joint in joints:
                    n = 0
                    for mid in mids[joint]:
                        for d in GAP_DIRS:
                            o0 = mid - d * reach
                            for tree, inv, rot in mine:
                                ld = rot @ d
                                if tree.ray_cast(inv @ o0, ld.normalized(), 2 * reach * ld.length)[0] is not None:
                                    break
                            else:
                                n += 1
                    if n:
                        key = f'{joint} ({look})'
                        worst = found.get(key, (0, 0, ''))
                        found[key] = (worst[0] + n, max(worst[1], n), f'{tr.name} frame {frame}' if n > worst[1] else worst[2])
    arm.animation_data.action = None
    return found


# `NOSOCK` in the preview name leaves the socks out of the check, to see it fail.
GAPS = joint_gaps(LOOKS, skip='V3_sock_' if 'NOSOCK' in PREVIEW else None)
for key, (total, most, where) in sorted(GAPS.items()):
    print(f'  GAP {key}: {total} rays through in all, {most} at worst ({where})')
print('joints: no gaps' if not GAPS else f'joints: GAPS at {len(GAPS)}: {sorted(GAPS)}')
assert not GAPS, f'the body shows through at a joint: {sorted(GAPS)}'

for m in bpy.data.materials:
    for n in list(m.node_tree.nodes if m.node_tree else []):
        if n.type == 'TEX_IMAGE' and (not n.image or len(n.image.pixels) == 0):
            m.node_tree.nodes.remove(n)
print('objects', sorted(o.name for o in bpy.data.objects if o.type == 'MESH'))
arm.data.pose_position = 'REST'
dg = bpy.context.evaluated_depsgraph_get()
tris = 0
for o in bpy.data.objects:
    if o.type == 'MESH':
        me = o.evaluated_get(dg).to_mesh()
        tris += sum(len(p.vertices) - 2 for p in me.polygons)
        ps = [o.matrix_world @ v.co for v in me.vertices]
        ext = max(max(p[i] for p in ps) - min(p[i] for p in ps) for i in range(3)) if ps else 0
        if ext > 1.95:
            print('size warning', o.name, round(ext, 2))
        o.evaluated_get(dg).to_mesh_clear()
arm.data.pose_position = 'POSE'
print('total triangles (all options)', tris)
if 'DEBUG' in PREVIEW:
    arm.data.pose_position = 'REST'
    dg = bpy.context.evaluated_depsgraph_get()
    for name in ('V3_hoodie', 'V3_pants'):
        o = bpy.data.objects[name]
        me = o.evaluated_get(dg).to_mesh()
        ps = [o.matrix_world @ v.co for v in me.vertices]
        raw = [o.matrix_world @ v.co for v in o.data.vertices]
        for z in [0.84 + 0.03 * i for i in range(14)]:
            sl = [p for p in ps if abs(p.z - z) < 0.012 and abs(p.x) < 0.3]
            sr = [p for p in raw if abs(p.z - z) < 0.012 and abs(p.x) < 0.3]
            if sl:
                print(name, round(z, 2), 'eval y', round(min(p.y for p in sl), 3), round(max(p.y for p in sl), 3), 'x', round(max(abs(p.x) for p in sl), 3),
                      '| raw y', round(min(p.y for p in sr), 3) if sr else '-', round(max(p.y for p in sr), 3) if sr else '-')
        o.evaluated_get(dg).to_mesh_clear()
    arm.data.pose_position = 'POSE'

# `-- <prefix>HEADS`: every head with its hood up and with it down, from the front three-quarter and from behind.
if PREVIEW and 'HEADS' in PREVIEW:
    from preview_lib import render_views
    SETS = {'hood': (['V3_head_void'], ['V3_head_void_full']), 'tv': (['V3_head_tv'], ['V3_head_tv', 'V3_head_tv_antennas']),
            'visor': (['V3_head_helmet', 'V3_head_visor', 'V3_head_visor_face'],) * 2, 'emoji': (['V3_head_emoji'],) * 2, 'mosaic': (['V3_head_toy'],) * 2}
    every = {n for up, down in SETS.values() for n in up + down} | {'V3_hood_up', 'V3_hood_up_tv', 'V3_hood_down'} | {o.name for o in bpy.data.objects if o.name.startswith('V3_acc_')}
    for o in bpy.data.objects:
        if o.name.endswith(('_short', '_relaxed', '_tapered')):
            o.hide_render = True
    tr = arm.animation_data.nla_tracks['Idle_Loop']
    arm.animation_data.action = tr.strips[0].action
    if tr.strips[0].action.slots:
        arm.animation_data.action_slot = tr.strips[0].action.slots[0]
    bpy.context.scene.frame_set(10)
    for key, (up_set, down_set) in SETS.items():
        for up in (True, False):
            show = set(up_set if up else down_set) | ({'V3_hood_up_tv' if key == 'tv' else 'V3_hood_up'} if up else {'V3_hood_down'})
            for o in bpy.data.objects:
                if o.name in every:
                    o.hide_render = o.name not in show
            render_views(f'{PREVIEW}-{key}-{"up" if up else "down"}', target=(0, 0, 1.5), dist=1.6, views=(('3q', 30), ('back', 160)), res=(420, 480), height=1.62)
    for o in bpy.data.objects:
        o.hide_render = False
    arm.animation_data.action = None
elif PREVIEW and 'FEET' in PREVIEW:
    # `-- <prefix>FEET`: the ankles up close, standing and mid-stride, and one hand.
    from preview_lib import render_views
    keep = set(LOOKS['boxy hoodie, straight trousers'][0])
    for o in bpy.data.objects:
        if o.type == 'MESH':
            o.hide_render = o.name not in keep
    for clip, frame in (('Idle_Loop', 10), ('Walk_Loop', 8), ('Sprint_Loop', 6), ('Crouch_Idle_Loop', 10)):
        tr = arm.animation_data.nla_tracks[clip]
        arm.animation_data.action = tr.strips[0].action
        if tr.strips[0].action.slots:
            arm.animation_data.action_slot = tr.strips[0].action.slots[0]
        bpy.context.scene.frame_set(frame)
        render_views(f'{PREVIEW}-{clip}', target=(0, 0, 0.14), dist=1.0, views=(('front', 20), ('side', 90), ('back', 200)), res=(640, 520), height=0.3)
        render_views(f'{PREVIEW}-{clip}-top', target=(0, 0, 0.14), dist=0.75, views=(('3q', 40),), res=(640, 520), height=0.75)
        if clip == 'Idle_Loop':
            hand = arm.matrix_world @ arm.pose.bones['hand_l'].tail
            render_views(f'{PREVIEW}-hand', target=tuple(hand), dist=0.55, views=(('front', 0), ('out', 90), ('back', 180), ('in', 270)), res=(520, 520), height=hand.z + 0.08)
    for o in bpy.data.objects:
        o.hide_render = False
    arm.animation_data.action = None
elif PREVIEW:
    from preview_lib import render_views
    HEADSET = {'hood': ['V3_hood_up', 'V3_head_void'], 'tv': ['V3_head_tv', 'V3_hood_down'],
               'visor': ['V3_head_helmet', 'V3_head_visor', 'V3_head_visor_face', 'V3_hood_down'],
               'emoji': ['V3_head_emoji', 'V3_hood_down'], 'toy': ['V3_head_toy', 'V3_hood_down'], 'mosaic': ['V3_head_toy', 'V3_hood_up']}
    swap = {n for v in HEADSET.values() for n in v} | {o.name for o in bpy.data.objects if o.name.startswith('V3_acc_')}
    VARIANTS = [o for o in bpy.data.objects if o.name.endswith(('_short', '_relaxed', '_tapered'))]
    for o in VARIANTS:
        o.hide_render = True
    tr = arm.animation_data.nla_tracks['Idle_Loop']
    arm.animation_data.action = tr.strips[0].action
    if tr.strips[0].action.slots:
        arm.animation_data.action_slot = tr.strips[0].action.slots[0]
    bpy.context.scene.frame_set(10)
    for key, names in HEADSET.items():
        for o in bpy.data.objects:
            if o.name in swap:
                o.hide_render = o.name not in names
        if key == 'hood':
            render_views(PREVIEW + '-body', target=(0, 0, 1.0), dist=3.3, views=(('front', 0), ('side', 90), ('back', 180), ('3q', 35)))
            arm.data.pose_position = 'REST'
            render_views(PREVIEW + '-rest', target=(0, 0, 1.0), dist=3.3, views=(('back', 180), ('side', 90)))
            if 'DEBUG' in PREVIEW:
                keep = {o.name: o.hide_render for o in bpy.data.objects}
                for only in ('V3_hoodie', 'V3_pants', 'V3_pocket'):
                    for o in bpy.data.objects:
                        if o.type == 'MESH':
                            o.hide_render = o.name != only
                    render_views(PREVIEW + '-only-' + only, target=(0, 0, 1.0), dist=2.4, views=(('side', 90), ('back', 180)), res=(400, 500))
                for o in bpy.data.objects:
                    o.hide_render = keep[o.name]
            arm.data.pose_position = 'POSE'
        render_views(PREVIEW + '-' + key, target=(0, 0, 1.65), dist=1.2, views=(('3q', 30),), res=(480, 520), height=1.72)
    for o in bpy.data.objects:
        if o.name in swap:
            o.hide_render = o.name not in HEADSET['hood'] + ['V3_acc_headphones', 'V3_acc_chain', 'V3_acc_watch', 'V3_acc_bracelets', 'V3_acc_tea']
    render_views(PREVIEW + '-acc', target=(0, 0, 1.25), dist=2.1, views=(('3q', 25),), res=(560, 680), height=1.5)
    # One render per variation: the default with that piece swapped in.
    for o in bpy.data.objects:
        if o.name in swap:
            o.hide_render = o.name not in HEADSET['hood']
    base = {'short': ['V3_hoodie', 'V3_pocket'], 'relaxed': ['V3_hoodie', 'V3_pocket'], 'tapered': ['V3_pants', 'V3_cargo_l', 'V3_cargo_r', 'V3_flap_l', 'V3_flap_r']}
    for key, hide in base.items():
        for o in VARIANTS:
            o.hide_render = not o.name.endswith('_' + key)
        for n in hide:
            bpy.data.objects[n].hide_render = True
        render_views(PREVIEW + '-var-' + key, target=(0, 0, 1.0), dist=3.3, views=(('3q', 35), ('back', 180)))
        for n in hide:
            bpy.data.objects[n].hide_render = False
    for o in bpy.data.objects:
        o.hide_render = False
    arm.animation_data.action = None

bpy.ops.object.select_all(action='DESELECT')
# Keyframes as they are, not resampled every frame: the sitting clips have a handful of poses each, and sampling them
# every frame added 2 MB.
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_animation_mode='NLA_TRACKS',
                          export_image_format='WEBP', export_yup=True, export_apply=True, export_skins=True,
                          export_force_sampling=False)
print('exported', OUT)
