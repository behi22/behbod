"""The realistic hand: MakeHuman's base mesh right hand, made a young man's, cut a little up the forearm, subdivided once,
weighted by MakeHuman's own rig, in the hand's own axes. Writes blender/build/hand_mesh.json for blender/pack_hand.js,
and the skin picture web/assets/hand/skin.webp.
  blender -b --python blender/build_hand.py
Sources, all CC0, in _downloads/makehuman-base (gitignored): base.obj, rig.default.json, weights.default.json,
mpfb_fingernails.jpg and the targets universal-male-young-averagemuscle-averageweight and r-hand-fingers-diameter-incr
(.target.gz) from the data folder of MPFB 2.0.18 (makehumancommunity.org; the add-on's code is GPL, its data CC0, and
only the data is read here); young_lightskinned_male_diffuse3.png from makehuman_system_assets_cc0.zip (young_asian_male).
"""
import bpy, bmesh, gzip, json, math, os
import numpy as np
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))).replace(os.sep, '/')
SRC = ROOT + '/_downloads/makehuman-base'
OUT = ROOT + '/blender/build/hand_mesh.json'
SKIN_OUT = ROOT + '/web/assets/hand/skin.webp'
SKIN = SRC + '/young_lightskinned_male_diffuse3.png'
# A grown man's hand, wrist crease to the tip of the middle finger; a touch thicker fingers than the average man's.
LENGTH, THICKER = 0.188, 0.35
# How far up the forearm the cut is (the sleeve covers it).
CUT = 0.075
TEX = 512

# ---------- the base mesh: positions, uvs, faces and their groups ----------
V, VT, F, FT, groups = [], [], [], [], {}
g = None
for line in open(SRC + '/base.obj'):
    if line.startswith('v '):
        V.append([float(x) for x in line.split()[1:4]])
    elif line.startswith('vt '):
        VT.append([float(x) for x in line.split()[1:3]])
    elif line.startswith('g '):
        g = line.split()[1]
    elif line.startswith('f '):
        t = [x.split('/') for x in line.split()[1:]]
        F.append([int(a[0]) - 1 for a in t]); FT.append([int(a[1]) - 1 for a in t]); groups.setdefault(g, []).append(len(F) - 1)
V, VT = np.array(V), np.array(VT)


def target(name, k):
    for line in gzip.open(f'{SRC}/{name}.target.gz', 'rt'):
        if line[0].isdigit():
            i, x, y, z = line.split()
            V[int(i)] += k * np.array([float(x), float(y), float(z)])


target('universal-male-young-averagemuscle-averageweight', 1.0)
target('r-hand-fingers-diameter-incr', THICKER)


def joint(name):
    vs = sorted({i for f in groups[name] for i in F[f]})
    return V[vs].mean(0)


J = {k[len('joint-r-'):]: joint(k) for k in groups if k.startswith('joint-r-finger') or k in ('joint-r-hand', 'joint-r-hand-2', 'joint-r-hand-3', 'joint-r-elbow')}

# ---------- the hand's axes: x from the wrist to the middle knuckle, y out of the back, z toward the little finger ----------
wrist = J['hand']
x = J['finger-3-1'] - wrist; x /= np.linalg.norm(x)
z = J['finger-5-1'] - J['finger-2-1']; z -= x * z.dot(x); z /= np.linalg.norm(z)
y = np.cross(z, x)
R = np.stack([x, y, z])
scale = LENGTH / ((J['finger-3-4'] - wrist) @ x)
to_hand = lambda p: (R @ (np.asarray(p) - wrist).T).T * scale
P = to_hand(V)
JH = {k: to_hand(v).tolist() for k, v in J.items()}

# ---------- weights, renamed for the hand's own bones ----------
W = json.load(open(SRC + '/weights.default.json'))['weights']
NAMES = {'lowerarm01.R': 'arm', 'lowerarm02.R': 'arm', 'wrist.R': 'hand', 'metacarpal1.R': 'index0', 'metacarpal2.R': 'middle0',
         'metacarpal3.R': 'ring0', 'metacarpal4.R': 'pinky0', 'finger1-1.R': 'thumb1', 'finger1-2.R': 'thumb2', 'finger1-3.R': 'thumb3'}
for n, d in ((2, 'index'), (3, 'middle'), (4, 'ring'), (5, 'pinky')):
    for k in (1, 2, 3):
        NAMES[f'finger{n}-{k}.R'] = f'{d}{k}'
BONES = ['arm', 'hand', 'thumb1', 'thumb2', 'thumb3'] + [f'{d}{k}' for d in ('index', 'middle', 'ring', 'pinky') for k in (0, 1, 2, 3)]
w = np.zeros((len(V), len(BONES)))
for src, rows in W.items():
    if src in NAMES:
        b = BONES.index(NAMES[src])
        for i, v in rows:
            w[i, b] += v
arm_total = w.sum(1)
body = sorted({i for f in groups['body'] for i in F[f]})
keep = np.zeros(len(V), bool)
keep[body] = True
keep &= (arm_total > 0.5) & (P[:, 0] > -CUT)
faces = [f for f in groups['body'] if all(keep[i] for i in F[f])]

# ---------- the skin's picture: the hand's island cut out of the body's, and the faces' uvs moved onto it ----------
hand_w = w[:, 1:].sum(1)
isl = np.array([VT[t] for f in faces if all(hand_w[i] > 0.3 for i in F[f]) for t in FT[f]])
pad = 6 / 2048
u0, v0 = isl.min(0) - pad
u1, v1 = isl.max(0) + pad
# A plain patch of skin on the back of the hand, for the forearm's faces whose uvs lie on the body's island.
plain = np.array([u0 + (u1 - u0) * 0.62, v0 + (v1 - v0) * 0.3])


def uv_of(t):
    u, v = VT[t]
    if not (u0 <= u <= u1 and v0 <= v <= v1):
        u, v = plain
    return ((u - u0) / (u1 - u0), (v - v0) / (v1 - v0))


img = bpy.data.images.load(SKIN)
Wd, Ht = img.size
px = np.array(img.pixels[:], dtype=np.float32).reshape(Ht, Wd, 4)
c0, c1, r0, r1 = int(u0 * Wd), int(math.ceil(u1 * Wd)), int(v0 * Ht), int(math.ceil(v1 * Ht))
crop = px[r0:r1, c0:c1].copy()
out = bpy.data.images.new('hand_skin', c1 - c0, r1 - r0, alpha=False)
out.pixels[:] = crop.ravel()
out.scale(TEX, TEX)
out.filepath_raw = SKIN_OUT
out.file_format = 'WEBP'
os.makedirs(os.path.dirname(SKIN_OUT), exist_ok=True)
out.save(filepath=SKIN_OUT, quality=88)

nails_img = bpy.data.images.load(SRC + '/mpfb_fingernails.jpg')
NW, NH = nails_img.size
nails = np.array(nails_img.pixels[:], dtype=np.float32).reshape(NH, NW, 4)[:, :, 0]

# ---------- the mesh in Blender, so it can be subdivided with its uvs and weights ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
bm = bmesh.new()
uvl = bm.loops.layers.uv.new('UVMap')
nl = bm.loops.layers.uv.new('Nail')
dl = bm.verts.layers.deform.verify()
old = sorted({i for f in faces for i in F[f]})
vmap = {}
for i in old:
    v = bm.verts.new(Vector(P[i].tolist()))
    for b in np.nonzero(w[i] > 1e-4)[0]:
        v[dl][int(b)] = float(w[i, b])
    vmap[i] = v
for f, ft in zip([F[k] for k in faces], [FT[k] for k in faces]):
    try:
        face = bm.faces.new([vmap[i] for i in f])
    except ValueError:
        continue
    for lp, t in zip(face.loops, ft):
        lp[uvl].uv = uv_of(t)
        u, v = VT[t]
        lp[nl].uv = (float(nails[min(NH - 1, int(v * NH)), min(NW - 1, int(u * NW))]), 0)
me = bpy.data.meshes.new('hand')
bm.to_mesh(me)
bm.free()
ob = bpy.data.objects.new('hand', me)
bpy.context.scene.collection.objects.link(ob)
for b in BONES:
    ob.vertex_groups.new(name=b)
sub = ob.modifiers.new('sub', 'SUBSURF')
sub.levels = sub.render_levels = 1
sub.uv_smooth = 'PRESERVE_BOUNDARIES'
bpy.context.view_layer.objects.active = ob
bpy.ops.object.modifier_apply(modifier='sub')
tri = ob.modifiers.new('tri', 'TRIANGULATE')
bpy.ops.object.modifier_apply(modifier='tri')
me = ob.data
for p in me.polygons:
    p.use_smooth = True

# ---------- one vertex per corner that differs in uv: positions, normals, uvs, the nail mask, four weights ----------
uv = me.uv_layers['UVMap'].data
nu = me.uv_layers['Nail'].data
normals = [tuple(v.normal) for v in me.vertices]
key, out_v, idx = {}, [], []
for p in me.polygons:
    for li in p.loop_indices:
        vi = me.loops[li].vertex_index
        u = tuple(round(c, 6) for c in uv[li].uv)
        k = (vi, u)
        if k not in key:
            gs = sorted(((gg.weight, gg.group) for gg in me.vertices[vi].groups if gg.weight > 1e-4), reverse=True)[:4]
            tot = sum(a for a, _ in gs) or 1
            key[k] = len(out_v)
            out_v.append({'p': list(me.vertices[vi].co), 'n': list(normals[vi]), 'uv': list(u), 'nail': nu[li].uv[0], 'j': [b for _, b in gs], 'w': [a / tot for a, _ in gs]})
        idx.append(key[k])
data = {
    'bones': BONES, 'joints': JH, 'length': LENGTH,
    'pos': [round(c, 6) for v in out_v for c in v['p']], 'nor': [round(c, 5) for v in out_v for c in v['n']],
    'uv': [round(c, 6) for v in out_v for c in v['uv']], 'nail': [round(min(1, max(0, v['nail'])), 3) for v in out_v],
    'joint4': [v['j'][k] if k < len(v['j']) else 0 for v in out_v for k in range(4)],
    'weight4': [round(v['w'][k], 5) if k < len(v['w']) else 0 for v in out_v for k in range(4)],
    'index': idx,
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(data, open(OUT, 'w'))
print('hand', len(out_v), 'vertices', len(idx) // 3, 'triangles; uv box', [round(c, 4) for c in (u0, v0, u1, v1)], 'scale', round(scale, 5))
print('joints', {k: [round(c, 4) for c in v] for k, v in JH.items()})
