"""The range's guns, built part by part so every piece that moves on a real one moves here: the slide, the barrel, the
trigger, the magazine and its top round, the slide stop and the magazine release, plus each attachment as its own piece,
and the hands that hold it (my toy hands in my hoodie's sleeves, shaped to this gun's grip).
Original designs: no real maker's shapes or names. X is forward (the muzzle), Y is the shooter's left, Z is up, and
z = 0 is the line where the slide rides on the frame.

blender -b --factory-startup -P blender/build_guns.py                 (build and export web/assets/range/p22.glb)
blender -b --factory-startup -P blender/build_guns.py -- <prefix>     (also render look-at pictures to <prefix>-*.png)
"""
import bpy, bmesh, sys, os, math
from mathutils import Vector, Matrix
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))).replace(os.sep, '/')
sys.path.insert(0, ROOT + '/blender')
from lib import cad

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREVIEW = ARGS[0] if ARGS else ''
bpy.ops.wm.read_factory_settings(use_empty=True)

SPECKLE = cad.grain('T_GunSpeckle', kind='speckle', amp=1.0)
STIPPLE = cad.grain('T_GunStipple', kind='stipple', amp=3.0, seed=4)
BRUSHED = cad.grain('T_GunBrushed', kind='brushed', amp=0.6, seed=7)
# The detail maps tile every few centimetres and are kept faint: a finish you see in the highlights, not as bumps.
M = {
    'slide': cad.material('G_Nitride', (0.024, 0.025, 0.028), 0.34, 1.0, SPECKLE, 40, 0.06),
    'steel': cad.material('G_Steel', (0.56, 0.57, 0.59), 0.26, 1.0, BRUSHED, 30, 0.12),
    'dark': cad.material('G_Phosphate', (0.05, 0.051, 0.055), 0.5, 1.0, SPECKLE, 50, 0.1),
    'poly': cad.material('G_Polymer', (0.017, 0.018, 0.02), 0.6, 0.0, SPECKLE, 60, 0.14),
    'grip': cad.material('G_Stipple', (0.014, 0.015, 0.017), 0.8, 0.0, STIPPLE, 34, 0.55),
    'mark': cad.material('G_Mark', (0.5, 0.51, 0.53), 0.45, 1.0),
    'dot': cad.material('G_SightDot', (0.85, 0.95, 0.85), 0.5, 0.0, emit=(0.45, 1.0, 0.55), emit_strength=0.8),
    'brass': cad.material('G_Brass', (0.8, 0.58, 0.25), 0.28, 1.0, BRUSHED, 22, 0.2),
    'copper': cad.material('G_Copper', (0.74, 0.4, 0.24), 0.3, 1.0),
    'glass': cad.material('G_Lens', (0.55, 0.75, 0.95), 0.04, 0.0, alpha=0.22),
    'reticle': cad.material('G_Reticle', (0.0, 0.0, 0.0), 0.5, 0.0, emit=(1.0, 0.12, 0.06), emit_strength=8.0),
    'beam': cad.material('G_LightLens', (0.9, 0.93, 1.0), 0.1, 0.0, emit=(0.9, 0.95, 1.0), emit_strength=0.4),
}
# The hands and sleeves take the character's own material names, so the page can give them the colours he is wearing.
KNIT = cad.grain('T_Knit', kind='speckle', amp=2.0, seed=3)
RIB = cad.grain('T_Rib', kind='brushed', amp=2.4, seed=9)
M.update({
    'toy': cad.material('M_Toy', (0.83, 0.82, 0.79), 0.5),
    'sleeve': cad.material('M_Hoodie', (0.04, 0.055, 0.11), 0.9, 0.0, KNIT, 90, 0.5),
    'rib': cad.material('M_Hoodie_Rib', (0.035, 0.05, 0.1), 0.92, 0.0, RIB, 26, 0.9),
})
BZ = 0.0155          # the bore's height above the frame line
GRIP_Z = -0.112      # the bottom of the grip
front = lambda z: 0.027 + (z + 0.050) * 0.353          # the front strap's line
back = lambda z: -0.022 + (z + 0.018) * 0.25           # the back strap's, before the palm swell
deg = math.radians


def done(o, width=0.0005, segments=2, angle=30, sharp=40, uv=1.0):
    cad.bevel(o, width, segments, angle)
    cad.smooth(o, sharp)
    cad.box_uv(o, uv)
    return o


def build_slide():
    sec = [(-0.013, 0.0), (0.013, 0.0), (0.013, 0.0185), (0.0098, 0.0275), (-0.0098, 0.0275), (-0.013, 0.0185)]
    o = cad.section('slide', sec, -0.028, 0.158, M['slide'])
    cutters = [
        cad.outline('c', [(0.149, -0.001), (0.160, -0.001), (0.160, 0.0078)], 0.02),          # the nose, relieved under the muzzle
        cad.outline('c', [(-0.030, 0.0285), (-0.030, 0.0235), (-0.021, 0.0285)], 0.02),       # the top rear corner, eased
        cad.cyl('c', 0.0079, 0.17, (0.085, 0, BZ)),                                            # the barrel's channel
        cad.cyl('c', 0.0042, 0.03, (0.150, 0, 0.0048)),                                        # the guide rod's hole
        cad.box('c', (0.040, 0.0245, 0.0225), (0.050, -0.00775, 0.02375)),                     # the ejection port
    ]
    for sgn in (1, -1):
        for i in range(8):                                                                    # rear grasping grooves
            cutters.append(cad.box('c', (0.0019, 0.0036, 0.0175), (-0.021 + i * 0.0042, sgn * 0.0139, 0.0095), rot=('Y', deg(14))))
        for i in range(5):                                                                    # and the front ones
            cutters.append(cad.box('c', (0.0019, 0.0036, 0.0175), (0.121 + i * 0.0042, sgn * 0.0139, 0.0095), rot=('Y', deg(14))))
    for y in (-0.0054, -0.0018, 0.0018, 0.0054):                                              # anti-glare lines along the top
        cutters.append(cad.box('c', (0.062, 0.0007, 0.0012), (0.108, y, 0.0275)))
    cad.cut(o, cutters)
    done(o, 0.00045)
    extra = []
    # Sights: a notched rear block and a ramped front post, each with dots that glow a little in the dark.
    rear = cad.box('rear', (0.0115, 0.0215, 0.0068), (-0.0195, 0, 0.0275 + 0.0034), M['dark'])
    cad.cut(rear, [cad.box('c', (0.014, 0.0037, 0.0046), (-0.0195, 0, 0.0275 + 0.0068 - 0.0022)),
                   cad.outline('c', [(-0.0145, 0.0275 + 0.0025), (-0.0125, 0.0275 + 0.0075), (-0.0125, 0.0275 + 0.0025)], 0.02)])
    post = cad.box('post', (0.0068, 0.0036, 0.0058), (0.1492, 0, 0.0275 + 0.0029), M['dark'])
    cad.cut(post, [cad.outline('c', [(0.1475, 0.0275 + 0.0062), (0.1535, 0.0275 + 0.0062), (0.1535, 0.0275 + 0.0012)], 0.01)])
    extra += [done(rear, 0.0003), done(post, 0.0003)]
    for y in (-0.0058, 0.0058):
        extra.append(cad.cyl('dot', 0.00115, 0.0006, (-0.02535, y, 0.0275 + 0.0043), M['dot'], seg=14))
    extra.append(cad.cyl('dot', 0.00115, 0.0006, (0.1457, 0, 0.0275 + 0.0041), M['dot'], seg=14))
    # The striker's cover plate at the back, the extractor beside the port.
    extra.append(done(cad.box('plate', (0.0008, 0.0165, 0.0185), (-0.0282, 0, 0.0108), M['dark']), 0.0003))
    extra.append(done(cad.box('extractor', (0.021, 0.0012, 0.0034), (0.0195, -0.0131, 0.0162), M['dark']), 0.0003))
    # Markings, etched: the model and the made-up maker on the left, a serial on the right.
    extra.append(cad.text('mk', 'P-22', 0.0082, (0.106, 0.01305, 0.0052), M['mark'], rot_z=math.pi))
    extra.append(cad.text('mk', 'KEEPER ARMS  VANCOUVER BC', 0.0024, (0.066, 0.01305, 0.0124), M['mark'], rot_z=math.pi))
    extra.append(cad.text('mk', '9 MM', 0.0028, (0.066, 0.01305, 0.0062), M['mark'], rot_z=math.pi))
    extra.append(cad.text('mk', 'BH22 000122', 0.0026, (0.074, -0.01305, 0.0052), M['mark']))
    for e in extra:
        if not e.data.uv_layers:
            cad.box_uv(e)
    return cad.join('P22_slide', [o] + extra)


def build_frame():
    up = cad.outline('frame', [(-0.028, 0.0), (0.150, 0.0), (0.1535, -0.004), (0.1535, -0.017), (0.0875, -0.017), (0.088, -0.046), (0.0835, -0.0525),
                               (0.037, -0.0525), (0.0285, -0.049), (0.0245, -0.058), (-0.0335, -0.058), (-0.0235, -0.020), (-0.0275, -0.012), (-0.0345, -0.0065), (-0.033, -0.002)], 0.0131, M['poly'])
    # The grip: a stack of rounded sections down the slant, fuller in the palm, flared a touch at the foot.
    rings = []
    for i in range(14):
        z = -0.022 + (GRIP_Z + 0.022) * i / 13
        u = (-z - 0.022) / (-GRIP_Z - 0.022)
        xf = min(front(z), 0.0285)
        xb = back(z) - 0.0035 * math.sin(math.pi * max(0.0, min(1.0, (-z - 0.035) / 0.08)))
        # It starts as narrow as the frame it grows out of (no ledge where they meet) and fills out below.
        b = 0.0131 + 0.0014 * min(1.0, u / 0.3) + 0.0011 * math.sin(math.pi * u) + (0.0009 if i == 13 else 0.0)
        rings.append(cad.oval((xf + xb) / 2, 0, z, (xf - xb) / 2, b))
    grip = cad.loft('grip', rings)
    cad.union(up, [grip])
    cutters = [
        # The trigger guard's opening, and the guard slimmer than the frame around it.
        cad.outline('c', [(0.0335, -0.0235), (0.078, -0.0235), (0.0815, -0.028), (0.0815, -0.043), (0.077, -0.0475), (0.043, -0.0475), (0.0355, -0.043), (0.0335, -0.036)], 0.03),
        cad.box('c', (0.057, 0.02, 0.031), (0.0625, 0.0185, -0.0395)),
        cad.box('c', (0.057, 0.02, 0.031), (0.0625, -0.0185, -0.0395)),
        # The magazine well, open at the foot of the grip.
        cad.outline('c', [(front(-0.012) - 0.0044, -0.012), (front(-0.012) - 0.0391, -0.012), (front(-0.13) - 0.0391, -0.13), (front(-0.13) - 0.0044, -0.13)], 0.0112),
    ]
    for x in (0.108, 0.122, 0.136):                                                           # the accessory rail's cross slots
        cutters.append(cad.box('c', (0.0032, 0.03, 0.0026), (x, 0, -0.0165)))
    for sgn in (1, -1):                                                                       # and its side grooves
        cutters.append(cad.box('c', (0.056, 0.0026, 0.0022), (0.122, sgn * 0.0131, -0.0106)))
        cutters.append(cad.box('c', (0.03, 0.0016, 0.012), (0.004, sgn * 0.0136, -0.013), rot=('Y', deg(-12))))   # thumb shelf
    cad.cut(up, cutters)
    # The gripping surfaces take the stippled finish: the sides, the front strap and the back strap, between two
    # straight lines clear of the top and the foot of the grip.
    cad.split_at(up, (-0.062, GRIP_Z + 0.009))
    done(up, 0.0008, 2)
    up.data.materials.append(M['grip'])
    bm = bmesh.new()
    bm.from_mesh(up.data)
    for f in bm.faces:
        c, n = f.calc_center_median(), f.normal
        if GRIP_Z + 0.0095 < c.z < -0.0625 and (abs(n.y) > 0.75 or abs(n.x) > 0.8) and abs(n.z) < 0.5:
            f.material_index = 1
    bm.to_mesh(up.data)
    bm.free()
    extra = []
    for x, z in ((0.049, -0.011), (0.0605, -0.005), (-0.012, -0.012)):                        # cross pins
        extra.append(cad.cyl('pin', 0.0017, 0.0267, (x, 0, z), M['steel'], axis='Y', seg=16))
    for sgn in (1, -1):                                                                       # takedown tabs
        extra.append(done(cad.box('tab', (0.009, 0.0016, 0.0032), (0.046, sgn * 0.0135, -0.0075), M['dark']), 0.0003))
    for e in extra:
        if not e.data.uv_layers:
            cad.box_uv(e)
    return cad.join('P22_frame', [up] + extra)


def build_barrel():
    b = cad.tube('barrel', 0.0072, 0.0046, 0.160, (0.0795, 0, BZ), M['steel'], seg=40)
    hood = cad.box('hood', (0.044, 0.0164, 0.0147), (0.050, 0, 0.01985), M['steel'])
    cad.cut(hood, [cad.cyl('c', 0.0046, 0.06, (0.05, 0, BZ))])
    rod = cad.cyl('rod', 0.0033, 0.1365, (0.0883, 0, 0.0048), M['dark'], seg=20)
    for o in (b, hood, rod):
        done(o, 0.0003)
    return cad.join('P22_barrel', [b, hood, rod])


def build_trigger():
    t = cad.outline('trigger', [(0.0535, -0.0165), (0.0575, -0.019), (0.0565, -0.029), (0.0525, -0.0395), (0.0485, -0.041), (0.0508, -0.029), (0.0495, -0.019)], 0.0038, M['poly'])
    tab = cad.outline('tab', [(0.0566, -0.022), (0.0578, -0.0225), (0.0568, -0.031), (0.0556, -0.0305)], 0.0011, M['dark'])
    for o in (t, tab):
        done(o, 0.0006, 3)
    return cad.origin(cad.join('P22_trigger', [t, tab]), (0.051, 0, -0.0155))


def build_controls():
    stop = cad.outline('stop', [(0.004, -0.0045), (0.030, -0.0045), (0.030, -0.001), (0.010, -0.001), (0.006, 0.0014), (-0.002, 0.0014), (-0.002, -0.003)], 0.0009, M['dark'], y=0.0139)
    cad.cut(stop, [cad.box('c', (0.0009, 0.004, 0.0008), (0.0 + i * 0.0018, 0.0146, 0.0014)) for i in range(4)])
    stop = cad.origin(done(stop, 0.0003), (0.030, 0.0139, -0.003))
    stop.name = 'P22_slidestop'
    rel = cad.cyl('rel', 0.004, 0.0028, (0.0295, 0.0136, -0.0275), M['dark'], axis='Y', seg=20)
    rel = cad.origin(done(rel, 0.0004), (0.0295, 0.0136, -0.0275))
    rel.name = 'P22_magrelease'
    return stop, rel


def build_mag(name, foot=GRIP_Z, pad=0.010, plus=False):
    top = -0.0105
    zb = foot - 0.0005
    body = cad.outline('mag', [(front(top) - 0.005, top), (front(top) - 0.0385, top), (front(zb) - 0.0385, zb), (front(zb) - 0.005, zb)], 0.0105, M['dark'])
    # Round witness holes down the back, one per few rounds.
    cad.cut(body, [cad.cyl('c', 0.0016, 0.006, (front(z) - 0.0385, 0, z)) for z in (-0.045, -0.065, -0.085)])
    done(body, 0.0006, 2)
    base = cad.outline('pad', [(front(zb) - 0.002, zb + 0.0015), (front(zb) - 0.043, zb + 0.0005), (front(zb - pad) - 0.045, zb - pad), (front(zb - pad) + 0.001, zb - pad + 0.0012)], 0.0142, M['poly'])
    done(base, 0.0012, 3)
    follower = cad.outline('fol', [(front(top) - 0.0075, top + 0.0012), (front(top) - 0.036, top + 0.0002), (front(top) - 0.036, top - 0.004), (front(top) - 0.0075, top - 0.004)], 0.0085, M['poly'])
    done(follower, 0.0004)
    parts = [body, base, follower]
    if plus:
        parts.append(cad.text('mk', '+6', 0.0055, (front(zb - pad) - 0.014, 0.01425, zb - pad + 0.002), M['mark'], rot_z=math.pi))
        cad.box_uv(parts[-1])
    mag = cad.join(name, parts)
    return cad.origin(mag, (front(-0.06) - 0.0218, 0, -0.06))


def build_round(name, loose=False):
    """A cartridge: brass case, copper bullet. `loose` is the spent case alone, for the ones thrown out of the port."""
    c = Vector((0, 0, 0))
    case = cad.cyl('case', 0.00485, 0.0192, c, M['brass'], seg=12)
    rim = cad.cyl('rim', 0.0049, 0.0011, c + Vector((-0.0096 + 0.00055, 0, 0)), M['brass'], seg=12)
    cad.cut(case, [cad.tube('c', 0.0052, 0.0043, 0.0009, c + Vector((-0.0096 + 0.0017, 0, 0)), seg=12)])
    parts = [done(case, 0.0003), rim]
    if loose:
        cad.cut(case, [cad.cyl('c', 0.0042, 0.012, c + Vector((0.0056, 0, 0)), seg=12)])
    else:
        parts.append(cad.capsule('bullet', c + Vector((0.0088, 0, 0)), c + Vector((0.0158, 0, 0)), 0.00445, M['copper'], seg=12, rings=4, r2=0.0021))
    for o in parts:
        cad.smooth(o, 40)
        if not o.data.uv_layers:
            cad.box_uv(o)
    return cad.join(name, parts)


def build_light():
    body = cad.outline('light', [(0.094, -0.0165), (0.146, -0.0165), (0.146, -0.0195), (0.141, -0.0425), (0.100, -0.0425), (0.094, -0.036)], 0.0122, M['dark'])
    head = cad.cyl('head', 0.0128, 0.021, (0.1495, 0, -0.0305), M['dark'], seg=24)
    cad.union(body, [head])
    cutters = [cad.cyl('c', 0.0108, 0.004, (0.1595, 0, -0.0305), seg=24)]
    for i in range(4):                                                                        # cooling grooves round the head
        cutters.append(cad.tube('c', 0.0135, 0.0121, 0.0012, (0.1425 + i * 0.0036, 0, -0.0305), seg=24))
    cad.cut(body, cutters)
    done(body, 0.0005, 1)
    lens = cad.cyl('lens', 0.0106, 0.0008, (0.1578, 0, -0.0305), M['beam'], seg=24)
    paddles = [done(cad.box('pad', (0.004, 0.006, 0.012), (0.0925, s * 0.0085, -0.029), M['poly'], rot=('Y', deg(-12))), 0.0006, 3) for s in (1, -1)]
    clamp = [done(cad.box('clamp', (0.03, 0.0022, 0.006), (0.118, s * 0.0138, -0.0125), M['dark']), 0.0004) for s in (1, -1)]
    screw = cad.cyl('screw', 0.0026, 0.0298, (0.118, 0, -0.0125), M['steel'], axis='Y', seg=12)
    for o in (lens, screw):
        cad.box_uv(o)
    return cad.join('P22_att_light', [body, lens, screw] + paddles + clamp)


def build_suppressor():
    x0, L, r = 0.1615, 0.172, 0.0165
    can = cad.cyl('can', r, L, (x0 + L / 2, 0, BZ), M['dark'], seg=28)
    cutters = [cad.cyl('c', 0.0052, 0.03, (x0 + L, 0, BZ), seg=24)]
    for i in range(5):                                                                        # wrench flats' worth of rings at the back
        cutters.append(cad.tube('c', r + 0.001, r - 0.0009, 0.0014, (x0 + 0.012 + i * 0.0048, 0, BZ), seg=28))
    cutters.append(cad.tube('c', r + 0.001, r - 0.0007, 0.0012, (x0 + L - 0.012, 0, BZ), seg=28))
    cad.cut(can, cutters)
    done(can, 0.0006, 1)
    nut = done(cad.cyl('nut', 0.0098, 0.0075, (0.1595, 0, BZ), M['steel'], seg=12), 0.0004)
    return cad.join('P22_att_suppressor', [can, nut])


def build_holo():
    z0 = 0.0275
    base = cad.outline('base', [(-0.0105, z0), (0.0265, z0), (0.0265, z0 + 0.0042), (0.020, z0 + 0.0042), (0.020, z0 + 0.0052), (0.0015, z0 + 0.0052), (-0.004, z0 + 0.0105), (-0.0105, z0 + 0.0105)], 0.0125, M['dark'])
    hoop = cad.box('hoop', (0.0032, 0.027, 0.0255), (0.0235, 0, z0 + 0.0042 + 0.01275), M['dark'])
    cad.cut(hoop, [cad.box('c', (0.01, 0.0222, 0.0195), (0.0235, 0, z0 + 0.0042 + 0.0125))])
    cad.union(base, [hoop])
    cad.cut(base, [cad.box('c', (0.0012, 0.006, 0.002), (-0.0105, 0, z0 + 0.0085))])
    done(base, 0.0005)
    glass = cad.box('glass', (0.0006, 0.0222, 0.0195), (0.0235, 0, z0 + 0.0042 + 0.0125), M['glass'])
    dot = cad.cyl('reticle', 0.00075, 0.0002, (0.0231, 0, z0 + 0.0042 + 0.0125), M['reticle'], seg=14)
    screws = [cad.cyl('screw', 0.0017, 0.0008, (x, s * 0.0085, z0 + 0.0054), M['steel'], axis='Z', seg=10) for x in (0.005, 0.016) for s in (1, -1)]
    for o in [glass, dot] + screws:
        cad.box_uv(o)
    return cad.join('P22_att_holo', [base, glass, dot] + screws)


def build_scope():
    zt = 0.046                                                                                # the bridge over the slide
    arms = []
    for s in (1, -1):
        arms.append(cad.outline('arm', [(0.040, -0.0155), (0.100, -0.0155), (0.100, -0.004), (0.092, 0.004), (0.092, zt), (0.048, zt), (0.048, 0.004), (0.040, -0.004)], 0.0022, M['dark'], y=s * 0.0163))
    top = cad.box('top', (0.058, 0.037, 0.0052), (0.070, 0, zt + 0.0026), M['dark'])
    cad.union(top, arms)
    cad.cut(top, [cad.box('c', (0.004, 0.05, 0.0018), (0.054 + i * 0.008, 0, zt + 0.0052)) for i in range(5)])
    for s in (1, -1):
        cad.cut(top, [cad.box('c', (0.03, 0.006, 0.02), (0.070, s * 0.0163, 0.022))])
    done(top, 0.0006)
    za = zt + 0.0052 + 0.0165
    tube = cad.tube('tube', 0.0128, 0.0108, 0.098, (0.068, 0, za), M['slide'], seg=24)
    bell = cad.tube('bell', 0.0168, 0.0142, 0.03, (0.125, 0, za), M['slide'], seg=24)
    cone = cad.cyl('cone', 0.0128, 0.014, (0.105, 0, za), M['slide'], seg=24, r2=0.0168)
    cad.cut(cone, [cad.cyl('c', 0.0108, 0.02, (0.105, 0, za), seg=24, r2=0.0142)])
    eye = cad.tube('eye', 0.0158, 0.0128, 0.026, (0.012, 0, za), M['slide'], seg=24)
    ring_r = cad.tube('ring', 0.0166, 0.0158, 0.007, (0.004, 0, za), M['poly'], seg=24)
    parts = [tube, bell, cone, eye, ring_r]
    for ang, name in ((0, 'up'), (-math.pi / 2, 'side')):                                     # the adjustment turrets
        t = cad.cyl('turret', 0.0072, 0.011, (0.068, 0, za + 0.017), M['dark'], axis='Z', seg=24)
        cad.cut(t, [cad.box('c', (0.001, 0.02, 0.006), (0.068 + 0.0068 * math.cos(k * math.pi / 5), 0.0068 * math.sin(k * math.pi / 5), za + 0.019), rot=('Z', k * math.pi / 5)) for k in range(10)])
        if ang:
            t.data.transform(Matrix.Translation((0.068, 0, za)) @ Matrix.Rotation(ang, 4, 'X') @ Matrix.Translation((-0.068, 0, -za)))
        parts.append(t)
    for x in (0.045, 0.091):                                                                  # the two rings that hold it
        r = cad.tube('mount', 0.0152, 0.0127, 0.0085, (x, 0, za), M['dark'], seg=24)
        foot = cad.box('foot', (0.0085, 0.02, 0.0075), (x, 0, za - 0.0165), M['dark'])
        cad.union(r, [foot])
        parts.append(r)
    for o in parts:
        done(o, 0.0004, 1)
    lens_f = cad.cyl('lensf', 0.0142, 0.0006, (0.1385, 0, za), M['glass'], seg=24)
    lens_r = cad.cyl('lensr', 0.0128, 0.0006, (0.0005, 0, za), M['glass'], seg=24)
    for o in (lens_f, lens_r):
        cad.box_uv(o)
    return cad.join('P22_att_scope', [top] + parts + [lens_f, lens_r]), za


# ---------- the hands ----------
GRIP_B = 0.0152                                         # the grip's half-width where the hands close on it
grip_back = lambda z: back(z) - 0.0035 * math.sin(math.pi * max(0.0, min(1.0, (-z - 0.035) / 0.08)))


def chain(pts, radii):
    """A finger, a thumb or a wrist: rounded rods through these points, tapering from each radius to the next."""
    return [cad.capsule('seg', pts[i], pts[i + 1], radii[i], seg=14, rings=4, r2=radii[i + 1]) for i in range(len(pts) - 1)]


def ball(c, r):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=18, v_segments=10, radius=1.0)
    bmesh.ops.scale(bm, vec=Vector(r), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(c), verts=bm.verts)
    return cad.obj_from('ball', bm)


def fuse(name, parts, voxel=0.0017, soften=13, keep=4200):
    """Melts overlapping rounded pieces into one skin (a toy hand is one moulded piece), smooths it, and thins the mesh."""
    o = cad.join(name, parts)
    o.data.remesh_voxel_size = voxel
    bpy.ops.object.voxel_remesh()
    o = bpy.context.view_layer.objects.active
    m = o.modifiers.new('soft', 'SMOOTH')
    m.factor, m.iterations = 0.6, soften
    cad._apply(o, m)
    n = cad.tris([o])
    if n > keep:
        m = o.modifiers.new('thin', 'DECIMATE')
        m.ratio = keep / n
        cad._apply(o, m)
    o.data.materials.clear()
    o.data.materials.append(M['toy'])
    for f in o.data.polygons:
        f.use_smooth = True
    cad.box_uv(o)
    o.name = o.data.name = name
    return o


def sleeve(name, wrist, elbow, r0=0.0305, r1=0.052, cuff=0.042, n=20):
    """A hoodie sleeve from the wrist back toward the elbow: a ribbed cuff, then loose cloth with a few soft folds."""
    a, b = Vector(wrist), Vector(elbow)
    ax = (b - a).normalized()
    u = ax.cross(Vector((0, 0, 1))).normalized()
    v = ax.cross(u)
    L = (b - a).length
    def tube_(s0, s1, steps, rad, mat):
        rings = []
        for i in range(steps + 1):
            sdist = s0 + (s1 - s0) * i / steps
            c = a + ax * sdist
            rings.append([tuple(c + (u * math.cos(2 * math.pi * k / n) + v * math.sin(2 * math.pi * k / n)) * rad(sdist, k)) for k in range(n)])
        o = cad.loft('sl', rings, mat)
        for f in o.data.polygons:
            f.use_smooth = True
        cad.box_uv(o)
        return o
    rib = tube_(-0.006, cuff, 5, lambda sd, k: r0 + 0.0022 * math.sin(math.pi * min(1.0, max(0.0, sd / cuff))), M['rib'])
    along = lambda sd: max(0.0, sd - cuff)
    fold = lambda sd, k: 1 + 0.045 * math.sin(sd * 46 + k * 0.9) * math.sin(k * 0.6 + 1.0) * min(1.0, along(sd) / 0.03)
    cloth = tube_(cuff - 0.004, L, 16, lambda sd, k: (r0 + 0.0055 + (r1 - r0 - 0.0055) * (along(sd) / (L - cuff)) ** 0.8) * fold(sd, k), M['sleeve'])
    return cad.join(name, [rib, cloth])


def wrap(z, out, r, side=1, reach=0.017, start=0.016, tip=0.0082):
    """A finger closed round the grip at height z, from its knuckle on one side panel, round the front strap, to its
    tip on the other side. `out`: how far outside the grip it runs (a finger of the other hand may lie under it);
    side: -1 starts on the right panel (the right hand), 1 on the left."""
    xf, B, s = front(z), GRIP_B, side
    pts = [(xf - start, s * (B + out + r * 0.95), z), (xf + 0.004, s * (B + out + r * 0.8), z + 0.001), (xf + out + r * 0.95, s * (B * 0.45 + out * 0.5), z + 0.002),
           (xf + out + r, -s * (B * 0.45 + out * 0.5) * 0.9, z + 0.002), (xf + out * 0.8 + r * 0.1, -s * (B + out + r * 0.8), z + 0.001), (xf - reach, -s * (B + out * 0.9 + r * 0.85), z)]
    return chain(pts, [r * 1.08, r * 1.03, r, r * 0.97, r * 0.93, tip])


def build_hands():
    RF = 0.0095
    rows = (-0.0685, -0.0885)
    # The right hand: high on the back strap, two fingers round the grip, the first on the trigger, the thumb forward
    # along the frame under the slide.
    right = []
    for z in rows:
        right += wrap(z, 0.0, RF, side=-1)
        right += chain([(front(z) - 0.016, -(GRIP_B + RF * 0.95), z), (-0.052, -(GRIP_B + 0.011), z - 0.004)], [0.0108, 0.0112])
    right += chain([(0.012, -0.0229, -0.0445), (0.036, -0.0223, -0.0385), (0.0535, -0.0165, -0.0345), (0.0625, -0.0075, -0.0335), (0.0635, 0.0035, -0.0335)], [0.0100, 0.0094, 0.0088, 0.0082, 0.0078])
    right += chain([(0.012, -0.0229, -0.0445), (-0.050, -0.0255, -0.047)], [0.0104, 0.0112])
    right += chain([(-0.034, 0.002, -0.034), (-0.020, 0.0165, -0.020), (0.004, 0.0225, -0.0125), (0.026, 0.0235, -0.0105)], [0.0135, 0.0118, 0.0105, 0.0092])
    right += [ball((-0.0405, -0.003, -0.026), (0.016, 0.017, 0.0135)), ball((-0.020, -0.0265, -0.064), (0.032, 0.0105, 0.031))]
    right += chain([(-0.047, -0.005, -0.040), (-0.057, -0.008, -0.088)], [0.0185, 0.0175])
    right += chain([(-0.058, -0.016, -0.066), (-0.094, -0.027, -0.084)], [0.0215, 0.0235])
    hand_r = fuse('hand_r', right)
    arm_r = cad.join('P22_hand_r', [hand_r, sleeve('sl', (-0.088, -0.0255, -0.081), (-0.40, -0.13, -0.235))])

    # The left hand: its palm on the left of the grip, its fingers over the right hand's, the first under the trigger
    # guard, the thumb forward along the frame below the right thumb.
    left = []
    OUT = 2 * RF * 0.9
    for z in (-0.0705, -0.0890, -0.1065):
        left += wrap(z, OUT, RF, side=1, reach=0.004, start=0.022)
        left += chain([(front(z) - 0.022, GRIP_B + OUT + RF * 0.95, z), (-0.050, 0.054, z - 0.006)], [0.0108, 0.0112])
    left += chain([(-0.030, 0.034, -0.052), (-0.008, 0.0345, -0.036), (0.022, 0.0305, -0.0265), (0.050, 0.0275, -0.0215)], [0.0135, 0.0118, 0.0105, 0.0092])
    left += [ball((-0.022, 0.052, -0.088), (0.031, 0.0105, 0.031))]
    left += chain([(-0.030, 0.040, -0.058), (-0.040, 0.043, -0.105)], [0.0185, 0.0175])
    left += chain([(-0.050, 0.052, -0.098), (-0.084, 0.069, -0.119)], [0.0215, 0.0235])
    hand_l = fuse('hand_l', left)
    arm_l = cad.join('P22_hand_l', [hand_l, sleeve('sl', (-0.078, 0.066, -0.116), (-0.33, 0.27, -0.30))])

    # The left hand bringing a magazine: cupped under its foot, thumb up the back, fingers up the front and the side.
    # Made where the magazine sits when it is home; the page moves hand and magazine together.
    zb = GRIP_Z - 0.0105
    xc = front(zb) - 0.022
    cup = [ball((xc - 0.004, 0.006, zb - 0.0165), (0.036, 0.030, 0.0145))]
    cup += chain([(xc - 0.026, 0.020, zb - 0.014), (xc - 0.0275, 0.012, zb + 0.005), (xc - 0.0255, 0.004, zb + 0.020)], [0.0125, 0.0108, 0.0092])
    cup += chain([(xc + 0.020, 0.030, zb - 0.014), (xc + 0.031, 0.018, zb + 0.003), (xc + 0.033, 0.004, zb + 0.017)], [0.0108, 0.0098, 0.0084])
    cup += chain([(xc + 0.006, 0.034, zb - 0.015), (xc + 0.008, 0.0262, zb + 0.004), (xc + 0.006, 0.0222, zb + 0.018)], [0.0108, 0.0098, 0.0084])
    cup += chain([(xc - 0.012, 0.034, zb - 0.016), (xc - 0.011, 0.0262, zb + 0.002), (xc - 0.012, 0.0222, zb + 0.016)], [0.0108, 0.0098, 0.0084])
    cup += chain([(xc - 0.010, 0.030, zb - 0.020), (xc - 0.022, 0.058, zb - 0.045)], [0.0215, 0.0235])
    hand_m = fuse('hand_m', cup)
    arm_m = cad.join('P22_hand_l_mag', [hand_m, sleeve('sl', (xc - 0.020, 0.054, zb - 0.041), (xc - 0.22, 0.27, zb - 0.27))])
    return arm_r, arm_l, arm_m


def empty(name, at, parent):
    e = bpy.data.objects.new(name, None)
    cad.SC().objects.link(e)
    e.empty_display_size = 0.01
    e.location = at
    e.parent = parent
    return e


def pistol():
    root = bpy.data.objects.new('P22', None)
    cad.SC().objects.link(root)
    frame, slide, barrel, trigger = build_frame(), build_slide(), build_barrel(), build_trigger()
    stop, rel = build_controls()
    mag, mag_ext = build_mag('P22_mag'), build_mag('P22_att_mag', GRIP_Z - 0.026, 0.013, True)
    top = -0.0105
    rounds = []
    for name, parent in (('P22_round', mag), ('P22_round_ext', mag_ext)):
        r = build_round(name)
        r.rotation_euler = (0, deg(-4), 0)
        r.location = (front(top) - 0.0245, 0, top + 0.0035)
        rounds.append((r, parent))
    casing = build_round('P22_casing', loose=True)
    casing.location = (0.05, -0.03, 0.03)
    light, sup, holo = build_light(), build_suppressor(), build_holo()
    scope, scope_z = build_scope()
    hands = build_hands()
    base = [frame, slide, barrel, trigger, stop, rel, mag] + [rounds[0][0]]
    # Soft shadow and worn edges, painted with the gun assembled; each attachment against the gun it sits on.
    cad.shade(base)
    for extra in ([mag_ext, rounds[1][0]], [light], [sup], [holo], [scope], [casing]):
        cad.shade(base + extra, only=extra)
    # The hands' shadows: both on the grip together, and the cupped one against the magazine alone.
    cad.shade(base + list(hands[:2]), only=list(hands[:2]), reach=0.05, depth=0.6, wear=0.0)
    cad.shade([mag, hands[2]], only=[hands[2]], reach=0.05, depth=0.6, wear=0.0)
    for o in (frame, slide, barrel, trigger, stop, rel, mag, mag_ext, casing, light, sup, scope, *hands):
        o.parent = root
    holo.parent = slide
    for r, parent in rounds:
        keep = r.matrix_world.copy()
        r.parent = parent
        r.matrix_parent_inverse = parent.matrix_world.inverted()
        r.matrix_world = keep
    empty('P22_muzzle', (0.1605, 0, BZ), root)
    empty('P22_muzzle_sup', (0.1615 + 0.172, 0, BZ), root)
    empty('P22_eject', (0.05, -0.0135, 0.0235), root)
    empty('P22_aim_iron', (-0.0252, 0, 0.0275 + 0.0052), root)
    empty('P22_aim_holo', (-0.0105, 0, 0.0275 + 0.0042 + 0.0125), root)
    empty('P22_aim_scope', (-0.012, 0, scope_z), root)
    empty('P22_light_at', (0.160, 0, -0.0305), root)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    print('P-22:', len(meshes), 'pieces,', cad.tris(meshes), 'triangles:', ', '.join(f'{o.name[4:]} {cad.tris([o])}' for o in sorted(meshes, key=lambda o: -cad.tris([o]))))
    return root


root = pistol()

if PREVIEW:
    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_EEVEE'
    scn.render.resolution_x, scn.render.resolution_y = 1400, 900
    scn.world = bpy.data.worlds.new('pv')
    scn.world.use_nodes = True
    scn.world.node_tree.nodes['Background'].inputs[0].default_value = (0.05, 0.055, 0.065, 1)
    scn.world.node_tree.nodes['Background'].inputs[1].default_value = 1.0
    try:
        scn.view_settings.view_transform = 'AgX'
    except TypeError:
        pass
    for name, energy, loc, size in (('key', 14, (0.15, 0.35, 0.4), 0.5), ('fill', 5, (-0.35, 0.3, 0.1), 0.6), ('rim', 16, (0.1, -0.4, 0.3), 0.4), ('under', 2, (0.1, 0.1, -0.4), 0.6)):
        l = bpy.data.lights.new(name, 'AREA')
        l.energy, l.size = energy, size
        o = bpy.data.objects.new(name, l)
        cad.SC().objects.link(o)
        o.location = loc
        o.rotation_euler = (Vector((0.06, 0, -0.03)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cad.SC().objects.link(cam)
    cam.data.lens = 85
    cam.data.clip_start = 0.01
    scn.camera = cam
    ATT = [o for o in bpy.data.objects if o.name.startswith('P22_att_') or o.name == 'P22_round_ext']
    def shot(tag, eye, at=(0.06, 0, -0.035), show=()):
        for o in ATT:
            o.hide_render = not any(o.name.endswith(s) for s in show)
        bpy.data.objects['P22_mag'].hide_render = 'mag' in show
        bpy.data.objects['P22_round'].hide_render = 'mag' in show
        cam.location = eye
        cam.rotation_euler = (Vector(at) - Vector(eye)).to_track_quat('-Z', 'Y').to_euler()
        scn.render.filepath = f'{PREVIEW}-{tag}.png'
        bpy.ops.render.render(write_still=True)
    bpy.data.objects['P22_casing'].hide_render = True
    HANDS = [bpy.data.objects[n] for n in ('P22_hand_r', 'P22_hand_l', 'P22_hand_l_mag')]
    def hands(*show):
        for o in HANDS:
            o.hide_render = o.name[9:] not in show
    if 'HANDS' in PREVIEW:
        cam.data.lens = 30
        hands('r', 'l')
        shot('fp-hip', (-0.42, 0.075, 0.115), (0.3, -0.03, -0.02))
        shot('fp-aim', (-0.40, 0.0, 0.0345), (0.3, 0.0, 0.03))
        cam.data.lens = 60
        shot('h-left', (-0.02, 0.6, -0.02), (-0.02, 0, -0.05))
        shot('h-right', (-0.02, -0.6, -0.02), (-0.02, 0, -0.05))
        shot('h-under', (0.0, 0.1, -0.6), (0.0, 0, -0.05))
        shot('h-front', (0.6, 0.12, 0.0), (0.0, 0, -0.05))
        shot('h-back', (-0.6, 0.1, 0.12), (0.0, 0, -0.05))
        hands('r', 'l_mag')
        shot('h-mag', (-0.1, 0.55, -0.2), (-0.02, 0, -0.09))
        shot('h-mag-fp', (-0.42, 0.075, 0.115), (0.3, -0.03, -0.1))
        cam.data.lens = 85
    hands()
    shot('left', (0.06, 0.62, 0.02))
    shot('right', (0.06, -0.62, 0.02))
    shot('3q', (-0.28, 0.42, 0.2))
    shot('top', (0.06, 0.12, 0.6), (0.06, 0, 0))
    shot('rear', (-0.5, 0.06, 0.1), (0.0, 0, 0.0))
    shot('kit', (-0.3, 0.5, 0.2), (0.12, 0, -0.01), show=('light', 'suppressor', 'holo', 'mag', 'round_ext'))
    shot('scope', (-0.3, 0.5, 0.25), (0.06, 0, 0.01), show=('scope',))
    for o in bpy.data.objects:
        o.hide_render = False
    for n in ('key', 'fill', 'rim', 'under', 'cam'):
        bpy.data.objects.remove(bpy.data.objects[n])

out = ROOT + '/web/assets/range'
os.makedirs(out, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out + '/p22.glb', export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                          export_image_format='WEBP', export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_active_vertex_color_when_no_material=True)
print('exported', out + '/p22.glb', os.path.getsize(out + '/p22.glb'), 'bytes')
