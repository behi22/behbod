"""The range's guns, built part by part so every piece that moves on a real one moves here: the slide, the barrel, the
trigger, the magazine and its top round, the slide stop and the magazine release, plus each attachment as its own piece.
The hands that hold it are built in the page (web/src/range/hands.js), posed from web/src/pure/handling.js.
Original designs: no real maker's shapes or names. X is forward (the muzzle), Y is the shooter's left, Z is up, and
z = 0 is the line where the slide rides on the frame.

blender -b --factory-startup -P blender/build_guns.py                 (build and export blender/build/p22.glb, then
                                                                       node blender/squeeze.js makes web/assets/range/p22.glb)
blender -b --factory-startup -P blender/build_guns.py -- <prefix>     (also render look-at pictures to <prefix>-*.png)
blender -b --factory-startup -P blender/build_guns.py -- gun=smg      (the other guns: smg, rifle, sniper, lmg, each to
                                                                       blender/build/<its file>.glb; squeeze.js takes the paths)
The long guns share the pistol's grip and trigger guard (one hand fits them all) and leave empties named
<prefix>_mount_muzzle, _mount_optic, _mount_rail and _mount_mag where the attachments still to come will sit.
"""
import bpy, bmesh, sys, os, math
from mathutils import Vector, Matrix
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))).replace(os.sep, '/')
sys.path.insert(0, ROOT + '/blender')
from lib import cad

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
GUN = next((a[4:] for a in ARGS if a.startswith('gun=')), 'pistol')
PREVIEW = next((a for a in ARGS if '=' not in a), '')
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
    base = [frame, slide, barrel, trigger, stop, rel, mag] + [rounds[0][0]]
    # Soft shadow and worn edges, painted with the gun assembled; each attachment against the gun it sits on.
    cad.shade(base)
    for extra in ([mag_ext, rounds[1][0]], [light], [sup], [holo], [scope], [casing]):
        cad.shade(base + extra, only=extra)
    for o in (frame, slide, barrel, trigger, stop, rel, mag, mag_ext, casing, light, sup, scope):
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


# ---------- the long guns: the same toy finish, the pistol's grip and trigger guard under each receiver ----------
def long_lower(name, outline, mat, well=None):
    """The housing under a long gun's receiver: the P-22's grip and trigger guard, so the hand that fits one fits all,
    grown forward into a magazine well. `well` is (x0, x1, half-width, depth below the top) of its opening."""
    up = cad.outline(name, outline, 0.0131, mat)
    rings = []
    for i in range(14):
        z = -0.022 + (GRIP_Z + 0.022) * i / 13
        u = (-z - 0.022) / (-GRIP_Z - 0.022)
        xf = min(front(z), 0.0285)
        xb = back(z) - 0.0035 * math.sin(math.pi * max(0.0, min(1.0, (-z - 0.035) / 0.08)))
        b = 0.0131 + 0.0014 * min(1.0, u / 0.3) + 0.0011 * math.sin(math.pi * u) + (0.0009 if i == 13 else 0.0)
        rings.append(cad.oval((xf + xb) / 2, 0, z, (xf - xb) / 2, b))
    cad.union(up, [cad.loft('grip', rings)])
    cutters = [
        cad.outline('c', [(0.0335, -0.0235), (0.078, -0.0235), (0.0815, -0.028), (0.0815, -0.043), (0.077, -0.0475), (0.043, -0.0475), (0.0355, -0.043), (0.0335, -0.036)], 0.03),
        cad.box('c', (0.05, 0.02, 0.031), (0.059, 0.0185, -0.0395)),
        cad.box('c', (0.05, 0.02, 0.031), (0.059, -0.0185, -0.0395)),
    ]
    if well:
        x0, x1, hw, zb = well
        cutters.append(cad.box('c', (x1 - x0, 2 * hw, 0.3), ((x0 + x1) / 2, 0, zb + 0.15)))
    cad.cut(up, cutters)
    cad.split_at(up, (-0.062, GRIP_Z + 0.009))
    done(up, 0.0008, 2)
    up.data.materials.append(M['grip'])
    bm = bmesh.new()
    bm.from_mesh(up.data)
    for f in bm.faces:
        c, n = f.calc_center_median(), f.normal
        if GRIP_Z + 0.0095 < c.z < -0.0625 and c.x < 0.034 and (abs(n.y) > 0.75 or abs(n.x) > 0.8) and abs(n.z) < 0.5:
            f.material_index = 1
    bm.to_mesh(up.data)
    bm.free()
    return up


def rail(name, x0, x1, z, mat, axis='top', y=0.0):
    """A toothed accessory rail along x, on top of something (its foot at z) or under it (hanging from z)."""
    s = 1 if axis == 'top' else -1
    r = cad.box(name, (x1 - x0, 0.021, 0.0065), ((x0 + x1) / 2, y, z + s * 0.00325), mat)
    n = int((x1 - x0) / 0.01)
    cad.cut(r, [cad.box('c', (0.0045, 0.03, 0.0035), (x0 + 0.005 + i * 0.01, y, z + s * 0.0065)) for i in range(n)])
    return done(r, 0.0004)


def peep(name, x, z_aim, mat, foot):
    """A rear aperture: a block on the rail, two guarding ears, the ring the eye looks through."""
    base = cad.box(name, (0.022, 0.02, z_aim - foot - 0.004), (x, 0, (foot + z_aim - 0.004) / 2), mat)
    ears = [cad.box('ear', (0.014, 0.003, 0.015), (x, s * 0.0085, z_aim + 0.001), mat) for s in (1, -1)]
    ring = cad.cyl('ring', 0.0062, 0.003, (x, 0, z_aim), mat, seg=24)
    cad.union(base, ears + [ring])
    cad.cut(base, [cad.cyl('c', 0.0022, 0.03, (x, 0, z_aim), seg=20)])
    return done(base, 0.0003)


def post(name, x, z_tip, foot, mat):
    """A front sight: a base, two hooding ears, the post with a dot that glows a little."""
    base = cad.box(name, (0.018, 0.02, 0.006), (x, 0, foot + 0.003), mat)
    ears = [cad.box('ear', (0.012, 0.0025, z_tip - foot - 0.002), (x, s * 0.0085, (foot + z_tip) / 2 + 0.002), mat) for s in (1, -1)]
    pin = cad.box('post', (0.004, 0.0028, z_tip - foot - 0.006), (x, 0, (foot + 0.006 + z_tip) / 2), mat)
    cad.union(base, ears + [pin])
    done(base, 0.0003)
    dot = cad.cyl('dot', 0.0011, 0.0006, (x - 0.0021, 0, z_tip - 0.0015), M['dot'], seg=14)
    cad.box_uv(dot)
    return cad.join(name, [base, dot])


def marks(objs, y, lines):
    """Etched lettering on a side: (text, size, x, z) each; y > 0 is the left side, read from the left."""
    for t, size, x, z in lines:
        o = cad.text('mk', t, size, (x, y, z), M['mark'], rot_z=math.pi if y > 0 else 0.0)
        cad.box_uv(o)
        objs.append(o)


def finish(root, prefix, base, loose, anchors):
    """Shades the gun assembled, parents it, and leaves its anchors and attachment mounts as empties."""
    cad.shade(base)
    for extra in loose:
        cad.shade(base + [extra], only=[extra])
    for o in base + loose:
        if o.parent is None:
            o.parent = root
    for name, at in anchors.items():
        empty(f'{prefix}_{name}', at, root)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    # An exact boolean on touching faces can leave a point flung far off: stop the build rather than ship it.
    bpy.context.view_layer.update()
    for o in meshes:
        far = max(abs(c) for v in o.data.vertices for c in (o.matrix_world @ v.co))
        if far > 1.0:
            raise SystemExit(f'{o.name} has a point {far:.3g} m out')
    print(prefix + ':', len(meshes), 'pieces,', cad.tris(meshes), 'triangles:', ', '.join(f'{o.name} {cad.tris([o])}' for o in sorted(meshes, key=lambda o: -cad.tris([o]))))
    return root


def rename(o, name):
    o.name = name
    o.data.name = name
    return o


def seat_round(r, mag, at, tilt=-4):
    r.rotation_euler = (0, deg(tilt), 0)
    r.location = at
    bpy.context.view_layer.update()
    keep = r.matrix_world.copy()
    r.parent = mag
    r.matrix_parent_inverse = mag.matrix_world.inverted()
    r.matrix_world = keep


# ---------- the Vesper: a compact submachine gun, closed bolt, a side charging handle, a folding wire stock ----------
VBZ = 0.030
M['slate'] = cad.material('G_Slate', (0.026, 0.033, 0.05), 0.55, 0.0, SPECKLE, 60, 0.14)


def vesper_mag(name):
    top, bot = 0.010, -0.185
    body = cad.outline('mag', [(0.0935, top), (0.1215, top), (0.1235, bot), (0.0915, bot)], 0.0105, M['dark'])
    cad.cut(body, [cad.box('c', (0.022, 0.03, 0.0016), (0.1075, 0, z)) for z in (-0.03, -0.075, -0.12)])
    done(body, 0.0006, 2)
    pad = cad.outline('pad', [(0.0895, bot + 0.003), (0.1255, bot + 0.003), (0.1275, bot - 0.011), (0.0875, bot - 0.011)], 0.0125, M['slate'])
    done(pad, 0.0015, 3)
    lip = cad.outline('lip', [(0.0945, top + 0.0005), (0.1205, top + 0.0005), (0.1205, top - 0.004), (0.0945, top - 0.004)], 0.0072, M['poly'])
    done(lip, 0.0004)
    return cad.origin(cad.join(name, [body, pad, lip]), (0.1075, 0, -0.09))


def vesper():
    root = bpy.data.objects.new('VSP', None)
    cad.SC().objects.link(root)
    lower = long_lower('VSP_lower', [(-0.062, 0.0), (0.205, 0.0), (0.205, -0.010), (0.138, -0.015), (0.139, -0.064), (0.133, -0.070), (0.089, -0.070),
                                     (0.086, -0.052), (0.0835, -0.0525), (0.037, -0.0525), (0.0285, -0.049), (0.0245, -0.058), (-0.0335, -0.058), (-0.0235, -0.020), (-0.062, -0.014)],
                       M['poly'], well=(0.0925, 0.1225, 0.0109, -0.075))
    body = cad.section('VSP_body', [(-0.019, 0.0), (0.019, 0.0), (0.019, 0.047), (0.0145, 0.053), (-0.0145, 0.053), (-0.019, 0.047)], -0.068, 0.205, M['slide'])
    cad.cut(body, [
        cad.box('c', (0.25, 0.024, 0.036), (0.07, 0, 0.03)),            # the inside, where the bolt runs
        cad.box('c', (0.05, 0.02, 0.022), (0.06, -0.015, 0.031)),       # the ejection port, on the right
        cad.box('c', (0.085, 0.02, 0.008), (0.1375, 0.015, 0.034)),     # the charging handle's slot, on the left
        cad.box('c', (0.03, 0.0218, 0.03), (0.1075, 0, 0.0)),           # the magazine's way up
    ])
    done(body, 0.0006)
    top = rail('VSP_rail', -0.05, 0.14, 0.053, M['dark'])
    guard = cad.section('VSP_guard', [(-0.021, -0.008), (0.021, -0.008), (0.023, 0.004), (0.023, 0.044), (0.016, 0.052), (-0.016, 0.052), (-0.023, 0.044), (-0.023, 0.004)], 0.205, 0.335, M['slate'])
    cuts = [cad.cyl('c', 0.0105, 0.2, (0.27, 0, VBZ), seg=24)]
    for i in range(4):                                                                        # vents through to the barrel
        for s in (1, -1):
            cuts.append(cad.box('c', (0.016, 0.03, 0.007), (0.225 + i * 0.026, s * 0.02, VBZ + 0.002)))
    cad.cut(guard, cuts)
    done(guard, 0.001, 2)
    under = rail('VSP_underrail', 0.268, 0.328, -0.008, M['dark'], axis='under')
    barrel = cad.tube('VSP_barrel', 0.0072, 0.0045, 0.282, (0.231, 0, VBZ), M['steel'], seg=32)
    can = cad.cyl('muzzle', 0.0095, 0.022, (0.361, 0, VBZ), M['dark'], seg=28)
    cad.cut(can, [cad.cyl('c', 0.0046, 0.04, (0.361, 0, VBZ), seg=20)] + [cad.tube('c', 0.0105, 0.0085, 0.0014, (0.355 + i * 0.004, 0, VBZ), seg=28) for i in range(3)])
    done(barrel, 0.0003)
    done(can, 0.0004, 1)
    barrel = cad.join('VSP_barrel', [barrel, can])
    front_sight = post('VSP_front', 0.318, 0.072, 0.052, M['dark'])
    rear_sight = peep('VSP_rear', -0.03, 0.072, M['dark'], 0.0595)
    # A folding wire stock, locked open: a hinge block, a skeleton loop, a rubber butt.
    hinge = done(cad.box('VSP_hinge', (0.018, 0.03, 0.05), (-0.077, 0, 0.022), M['dark']), 0.002, 2)
    stock = cad.outline('VSP_stock', [(-0.084, 0.05), (-0.29, 0.046), (-0.304, 0.038), (-0.304, -0.072), (-0.29, -0.08), (-0.272, -0.074), (-0.084, -0.006)], 0.0085, M['dark'])
    cad.cut(stock, [cad.outline('c', [(-0.112, 0.036), (-0.275, 0.033), (-0.283, 0.025), (-0.283, -0.055), (-0.272, -0.058), (-0.112, -0.0)], 0.02)])
    done(stock, 0.002, 2)
    butt = done(cad.outline('VSP_butt', [(-0.3, 0.048), (-0.318, 0.046), (-0.321, 0.035), (-0.321, -0.072), (-0.318, -0.082), (-0.3, -0.083)], 0.017, M['slate']), 0.003, 3)
    bolt = cad.box('VSP_bolt', (0.09, 0.0205, 0.028), (0.045, 0, 0.031), M['steel'])
    cad.cut(bolt, [cad.box('c', (0.03, 0.03, 0.004), (0.02, 0, 0.031)), cad.cyl('c', 0.0046, 0.02, (0.09, 0, VBZ), seg=16)])
    done(bolt, 0.0006)
    ext = done(cad.box('ext', (0.02, 0.0016, 0.004), (0.078, -0.0103, 0.036), M['dark']), 0.0003)
    bolt = cad.origin(cad.join('VSP_bolt', [bolt, ext]), (0.045, 0, 0.031))
    arm = cad.box('VSP_handle', (0.008, 0.016, 0.006), (0.175, 0.025, 0.034), M['dark'])
    knob = cad.cyl('knob', 0.0055, 0.012, (0.175, 0.037, 0.034), M['poly'], axis='Y', seg=20)
    done(arm, 0.0006)
    done(knob, 0.001, 2)
    handle = cad.origin(cad.join('VSP_handle', [arm, knob]), (0.175, 0.019, 0.034))
    trigger = rename(build_trigger(), 'VSP_trigger')
    stop, rel = build_controls()
    bpy.data.objects.remove(stop)
    rel = rename(rel, 'VSP_magrelease')
    mag = vesper_mag('VSP_mag')
    rnd = build_round('VSP_round')
    seat_round(rnd, mag, (0.1075, 0, 0.0145), -2)
    casing = build_round('VSP_casing', loose=True)
    casing.location = (0.05, -0.05, 0.05)
    extra = []
    marks(extra, 0.01905, [('VESPER', 0.0075, 0.17, 0.006), ('KEEPER ARMS  VANCOUVER BC', 0.0024, 0.16, 0.0185), ('9 MM', 0.0028, 0.16, 0.0225)])
    marks(extra, -0.01905, [('BH22 000222', 0.0026, 0.115, 0.006)])
    body = cad.join('VSP_body', [body] + extra)
    base = [lower, body, top, guard, under, barrel, front_sight, rear_sight, hinge, stock, butt, bolt, handle, trigger, rel, mag, rnd]
    return finish(root, 'VSP', base, [casing], {
        'muzzle': (0.372, 0, VBZ), 'eject': (0.06, -0.021, 0.034), 'aim_iron': (-0.03, 0, 0.072),
        'mount_muzzle': (0.372, 0, VBZ), 'mount_optic': (0.045, 0, 0.0595), 'mount_rail': (0.298, 0, -0.0145), 'mount_mag': (0.1075, 0, -0.07),
    })


# ---------- the Keeper: a rifle, its upper one piece with a rail end to end, a side charger, a curved magazine ----------
KBZ = 0.032
M['olive'] = cad.material('G_Olive', (0.042, 0.047, 0.03), 0.6, 0.0, SPECKLE, 60, 0.14)


def rifle_round(name, loose=False):
    """A longer, bottlenecked-looking cartridge: the pistol's round drawn out."""
    r = build_round(name, loose)
    r.data.transform(Matrix.Diagonal((1.9, 1.05, 1.05, 1.0)))
    return r


def keeper_mag(name):
    body = cad.outline('mag', [(0.096, 0.008), (0.150, 0.008), (0.152, -0.04), (0.158, -0.09), (0.168, -0.14), (0.180, -0.178), (0.124, -0.192), (0.112, -0.145), (0.104, -0.095), (0.099, -0.045)], 0.0108, M['dark'])
    cad.cut(body, [cad.box('c', (0.06, 0.03, 0.0018), (0.13 + k * 0.012, 0, z), rot=('Y', deg(-8 - k * 6))) for k, z in enumerate((-0.03, -0.085, -0.135))])
    done(body, 0.0007, 2)
    pad = cad.outline('pad', [(0.123, -0.188), (0.183, -0.17), (0.189, -0.182), (0.13, -0.204), (0.12, -0.198)], 0.0128, M['poly'])
    done(pad, 0.0015, 3)
    return cad.origin(cad.join(name, [body, pad]), (0.125, 0, -0.09))


def keeper():
    root = bpy.data.objects.new('KPR', None)
    cad.SC().objects.link(root)
    lower = long_lower('KPR_lower', [(-0.075, 0.0), (0.22, 0.0), (0.22, -0.012), (0.158, -0.016), (0.16, -0.072), (0.153, -0.078), (0.093, -0.078), (0.089, -0.058),
                                     (0.0835, -0.0525), (0.037, -0.0525), (0.0285, -0.049), (0.0245, -0.058), (-0.0335, -0.058), (-0.0235, -0.020), (-0.075, -0.014)],
                       M['poly'], well=(0.093, 0.153, 0.0116, -0.085))
    body = cad.section('KPR_body', [(-0.0185, 0.0), (0.0185, 0.0), (0.0185, 0.044), (0.013, 0.05), (-0.013, 0.05), (-0.0185, 0.044)], -0.078, 0.222, M['slide'])
    cad.cut(body, [
        cad.box('c', (0.27, 0.024, 0.032), (0.075, 0, 0.028)),          # the inside, where the bolt carrier runs
        cad.box('c', (0.055, 0.02, 0.02), (0.065, -0.015, 0.03)),       # the ejection port, on the right
        cad.box('c', (0.06, 0.0232, 0.03), (0.123, 0, 0.0)),            # the magazine's way up
        cad.box('c', (0.095, 0.02, 0.009), (-0.03, 0.015, 0.038)),       # the side charger's slot, on the left
    ])
    done(body, 0.0006)
    top = rail('KPR_rail', -0.072, 0.48, 0.05, M['dark'])
    guard = cad.section('KPR_guard', [(-0.013, -0.006), (0.013, -0.006), (0.021, 0.004), (0.021, 0.04), (0.013, 0.05), (-0.013, 0.05), (-0.021, 0.04), (-0.021, 0.004)], 0.222, 0.48, M['olive'])
    cuts = [cad.cyl('c', 0.011, 0.3, (0.35, 0, KBZ), seg=24)]
    for i in range(7):                                                                        # hexagonal vents, through
        cuts.append(cad.cyl('c', 0.0062, 0.06, (0.252 + i * 0.033, 0, KBZ - 0.004), axis='Y', seg=6))
    cad.cut(guard, cuts)
    done(guard, 0.0012, 2)
    under = rail('KPR_underrail', 0.405, 0.475, -0.006, M['dark'], axis='under')
    barrel = cad.tube('KPR_barrel', 0.0075, 0.0028, 0.5, (0.35, 0, KBZ), M['steel'], seg=32)
    brake = cad.cyl('brake', 0.0112, 0.042, (0.621, 0, KBZ), M['dark'], seg=28)
    cad.cut(brake, [cad.cyl('c', 0.0034, 0.06, (0.621, 0, KBZ), seg=16)] + [cad.box('c', (0.006, 0.03, 0.009), (0.608 + i * 0.011, 0, KBZ)) for i in range(3)])
    done(barrel, 0.0003)
    done(brake, 0.0005, 1)
    barrel = cad.join('KPR_barrel', [barrel, brake])
    front_sight = post('KPR_front', 0.455, 0.075, 0.0565, M['dark'])
    rear_sight = peep('KPR_rear', -0.04, 0.075, M['dark'], 0.0565)
    # The stock on its tube, a window for a sling, a rubber butt.
    tube_ = done(cad.cyl('KPR_tube', 0.0145, 0.2, (-0.178, 0, 0.02), M['dark'], seg=28), 0.001, 1)
    stock = cad.outline('KPR_stock', [(-0.19, 0.041), (-0.33, 0.043), (-0.345, 0.036), (-0.345, -0.086), (-0.33, -0.093), (-0.25, -0.062), (-0.19, -0.012)], 0.016, M['olive'])
    cad.cut(stock, [cad.outline('c', [(-0.222, 0.012), (-0.298, 0.018), (-0.304, -0.05), (-0.29, -0.06), (-0.222, -0.022)], 0.03)])
    done(stock, 0.002, 2)
    butt = done(cad.outline('KPR_butt', [(-0.343, 0.044), (-0.358, 0.042), (-0.36, 0.03), (-0.36, -0.088), (-0.357, -0.097), (-0.343, -0.096)], 0.018, M['poly']), 0.003, 3)
    carrier = cad.box('KPR_bolt', (0.10, 0.021, 0.026), (0.04, 0, 0.029), M['steel'])
    cad.cut(carrier, [cad.box('c', (0.04, 0.03, 0.004), (0.015, 0, 0.03)), cad.cyl('c', 0.0042, 0.02, (0.09, 0, KBZ), seg=16)])
    done(carrier, 0.0006)
    bolt = cad.origin(carrier, (0.04, 0, 0.029))
    # A side charger at the back of the receiver, on the left: it stays put while the carrier works.
    arm = cad.box('KPR_handle', (0.012, 0.014, 0.007), (0.005, 0.0245, 0.038), M['dark'])
    knob = cad.cyl('knob', 0.006, 0.013, (0.005, 0.036, 0.038), M['poly'], axis='Y', seg=20)
    done(arm, 0.0006)
    done(knob, 0.001, 2)
    handle = cad.origin(cad.join('KPR_handle', [arm, knob]), (0.005, 0.0185, 0.038))
    trigger = rename(build_trigger(), 'KPR_trigger')
    stop, rel = build_controls()
    bpy.data.objects.remove(stop)
    rel = rename(rel, 'KPR_magrelease')
    mag = keeper_mag('KPR_mag')
    rnd = rifle_round('KPR_round')
    seat_round(rnd, mag, (0.122, 0, 0.0125), -2)
    casing = rifle_round('KPR_casing', loose=True)
    casing.location = (0.05, -0.05, 0.05)
    extra = []
    marks(extra, 0.01855, [('KEEPER', 0.0075, 0.2, 0.006), ('KEEPER ARMS  VANCOUVER BC', 0.0024, 0.19, 0.019), ('5.56', 0.0028, 0.19, 0.0235)])
    marks(extra, -0.01855, [('BH22 000322', 0.0026, 0.1, 0.006)])
    body = cad.join('KPR_body', [body] + extra)
    base = [lower, body, top, guard, under, barrel, front_sight, rear_sight, tube_, stock, butt, bolt, handle, trigger, rel, mag, rnd]
    return finish(root, 'KPR', base, [casing], {
        'muzzle': (0.642, 0, KBZ), 'eject': (0.065, -0.021, 0.032), 'aim_iron': (-0.04, 0, 0.075),
        'mount_muzzle': (0.642, 0, KBZ), 'mount_optic': (0.06, 0, 0.0565), 'mount_rail': (0.44, 0, -0.0125), 'mount_mag': (0.123, 0, -0.078),
    })


# ---------- the Longview: a bolt-action rifle on a chassis, a round receiver, a heavy barrel, a five-round box ----------
LBZ = 0.034
M['sand'] = cad.material('G_Sand', (0.16, 0.13, 0.085), 0.62, 0.0, SPECKLE, 60, 0.14)


def heavy_round(name, loose=False):
    r = build_round(name, loose)
    r.data.transform(Matrix.Diagonal((2.25, 1.22, 1.22, 1.0)))
    return r


def longview_mag(name):
    body = done(cad.outline('mag', [(0.097, 0.006), (0.163, 0.006), (0.163, -0.07), (0.097, -0.07)], 0.0115, M['dark']), 0.0007, 2)
    pad = done(cad.outline('pad', [(0.094, -0.068), (0.166, -0.068), (0.166, -0.082), (0.094, -0.082)], 0.0132, M['poly']), 0.002, 3)
    return cad.origin(cad.join(name, [body, pad]), (0.13, 0, -0.035))


def longview():
    root = bpy.data.objects.new('LNG', None)
    cad.SC().objects.link(root)
    lower = long_lower('LNG_lower', [(-0.09, 0.0), (0.21, 0.0), (0.21, -0.012), (0.17, -0.016), (0.171, -0.066), (0.165, -0.071), (0.093, -0.071), (0.089, -0.058),
                                     (0.0835, -0.0525), (0.037, -0.0525), (0.0285, -0.049), (0.0245, -0.058), (-0.0335, -0.058), (-0.0235, -0.020), (-0.09, -0.014)],
                       M['poly'], well=(0.097, 0.163, 0.0118, -0.075))
    base = cad.box('LNG_base', (0.2, 0.032, 0.03), (0.05, 0, 0.015), M['slide'])
    tube_ = cad.cyl('tube', 0.017, 0.2, (0.05, 0, LBZ), M['slide'], seg=40)
    cad.union(base, [tube_])
    cad.cut(base, [
        cad.cyl('c', 0.0102, 0.21, (0.04, 0, LBZ), seg=28),                    # the bolt's way
        cad.box('c', (0.065, 0.03, 0.017), (0.0325, -0.018, LBZ + 0.004)),     # the ejection port, on the right
        cad.box('c', (0.066, 0.0236, 0.04), (0.13, 0, 0.0)),                    # the magazine's way up
    ])
    done(base, 0.0006)
    extra = []
    marks(extra, 0.0161, [('LONGVIEW', 0.0068, 0.13, 0.004), ('KEEPER ARMS  VANCOUVER BC', 0.0022, 0.12, 0.016)])
    marks(extra, -0.0161, [('BH22 000422', 0.0024, 0.075, 0.004)])
    body = cad.join('LNG_body', [base] + extra)
    top = rail('LNG_rail', -0.045, 0.14, 0.051, M['dark'])
    fore = cad.section('LNG_fore', [(-0.016, -0.014), (0.016, -0.014), (0.02, -0.006), (0.02, 0.02), (0.014, 0.026), (-0.014, 0.026), (-0.02, 0.02), (-0.02, -0.006)], 0.17, 0.52, M['sand'])
    cuts = [cad.cyl('c', 0.0135, 0.4, (0.36, 0, LBZ), seg=24)]
    for i in range(6):                                                                        # long slots down each side
        cuts.append(cad.box('c', (0.03, 0.06, 0.007), (0.21 + i * 0.048, 0, 0.007)))
    cad.cut(fore, cuts)
    done(fore, 0.0012, 2)
    under = rail('LNG_underrail', 0.44, 0.51, -0.014, M['dark'], axis='under')
    barrel = cad.tube('LNG_barrel', 0.0105, 0.0032, 0.61, (0.455, 0, LBZ), M['slide'], seg=36)
    brake = cad.box('brake', (0.045, 0.026, 0.022), (0.782, 0, LBZ), M['dark'])
    cad.cut(brake, [cad.cyl('c', 0.004, 0.06, (0.782, 0, LBZ), seg=16)] + [cad.box('c', (0.007, 0.04, 0.012), (0.768 + i * 0.012, 0, LBZ)) for i in range(3)])
    done(barrel, 0.0004)
    done(brake, 0.0008, 2)
    barrel = cad.join('LNG_barrel', [barrel, brake])
    front_sight = post('LNG_front', 0.735, 0.08, LBZ + 0.0105, M['dark'])
    rear_sight = peep('LNG_rear', -0.03, 0.08, M['dark'], 0.0575)
    # A precision stock: a thumbhole, a raised cheek rest, a thick rubber butt.
    stock = cad.outline('LNG_stock', [(-0.09, 0.03), (-0.13, 0.04), (-0.39, 0.04), (-0.405, 0.03), (-0.405, -0.095), (-0.39, -0.103), (-0.3, -0.07), (-0.2, -0.06), (-0.12, -0.065), (-0.09, -0.02)], 0.017, M['sand'])
    cad.cut(stock, [cad.outline('c', [(-0.115, 0.012), (-0.2, 0.014), (-0.215, -0.005), (-0.2, -0.042), (-0.125, -0.045), (-0.108, -0.02)], 0.03)])
    done(stock, 0.002, 2)
    cheek = done(cad.box('LNG_cheek', (0.13, 0.03, 0.012), (-0.27, 0, 0.046), M['dark']), 0.003, 3)
    butt = done(cad.outline('LNG_butt', [(-0.403, 0.042), (-0.42, 0.04), (-0.423, 0.028), (-0.423, -0.098), (-0.42, -0.108), (-0.403, -0.106)], 0.019, M['poly']), 0.003, 3)
    # The bolt: its body, a shroud at the back, the handle's stalk and its ball; it turns about the bore.
    bbody = cad.cyl('LNG_bolt', 0.0095, 0.22, (0.0, 0, LBZ), M['steel'], seg=28)
    shroud = cad.cyl('shroud', 0.0122, 0.018, (-0.115, 0, LBZ), M['dark'], seg=28)
    stalk = cad.capsule('stalk', (-0.062, -0.012, LBZ), (-0.07, -0.042, LBZ - 0.02), 0.0035, M['steel'], seg=12, rings=3)
    ball = cad.capsule('ball', (-0.072, -0.046, LBZ - 0.024), (-0.0721, -0.0461, LBZ - 0.0241), 0.0075, M['poly'], seg=16, rings=6)
    for o in (bbody, shroud):
        done(o, 0.0005, 1)
    for o in (stalk, ball):
        cad.smooth(o, 40)
        cad.box_uv(o)
    bolt = cad.origin(cad.join('LNG_bolt', [bbody, shroud, stalk, ball]), (-0.062, 0, LBZ))
    trigger = rename(build_trigger(), 'LNG_trigger')
    stop, rel = build_controls()
    bpy.data.objects.remove(stop)
    rel = rename(rel, 'LNG_magrelease')
    mag = longview_mag('LNG_mag')
    rnd = heavy_round('LNG_round')
    seat_round(rnd, mag, (0.128, 0, 0.012), -1)
    casing = heavy_round('LNG_casing', loose=True)
    casing.location = (0.05, -0.05, 0.05)
    base_parts = [lower, body, top, fore, under, barrel, front_sight, rear_sight, stock, cheek, butt, bolt, trigger, rel, mag, rnd]
    return finish(root, 'LNG', base_parts, [casing], {
        'muzzle': (0.806, 0, LBZ), 'eject': (0.03, -0.019, LBZ + 0.006), 'aim_iron': (-0.03, 0, 0.08),
        'mount_muzzle': (0.806, 0, LBZ), 'mount_optic': (0.05, 0, 0.0575), 'mount_rail': (0.475, 0, -0.0205), 'mount_mag': (0.13, 0, -0.071),
    })


# ---------- the Gatekeeper: a belt-fed machine gun, a feed cover that lifts, a box hung under it, a shrouded barrel ----------
GBZ = 0.042
M['ember'] = cad.material('G_Ember', (0.075, 0.022, 0.018), 0.58, 0.0, SPECKLE, 60, 0.14)


def gatekeeper_box(name):
    box_ = cad.box('box', (0.1, 0.07, 0.12), (0.155, 0.015, -0.065), M['ember'])
    cad.cut(box_, [cad.box('c', (0.106, 0.08, 0.002), (0.155, 0.015, -0.03))] + [cad.box('c', (0.002, 0.08, 0.07), (0.12 + i * 0.023, 0.015, -0.075)) for i in range(4)])
    done(box_, 0.003, 2)
    latch = done(cad.box('latch', (0.02, 0.006, 0.012), (0.155, 0.0515, -0.02), M['steel']), 0.001, 1)
    grip_ = cad.outline('carry', [(0.125, -0.06), (0.185, -0.06), (0.185, -0.09), (0.125, -0.09)], 0.004, M['dark'], y=0.053)
    cad.cut(grip_, [cad.outline('c', [(0.133, -0.066), (0.177, -0.066), (0.177, -0.084), (0.133, -0.084)], 0.02, y=0.053)])
    done(grip_, 0.001, 2)
    return cad.origin(cad.join(name, [box_, latch, grip_]), (0.155, 0.015, -0.065))


def gatekeeper_belt(name):
    """Five rounds and their links going up from the box's mouth into the feed port on the left."""
    parts = []
    for i in range(5):
        r = heavy_round('r')
        r.location = (0.14, 0.036, -0.002 + i * 0.012)
        bpy.context.view_layer.update()
        r.data.transform(r.matrix_world)
        r.matrix_world = Matrix.Identity(4)
        link = done(cad.box('link', (0.016, 0.004, 0.009), (0.142, 0.0295, -0.002 + i * 0.012), M['steel']), 0.0006, 1)
        parts += [r, link]
    return cad.origin(cad.join(name, parts), (0.14, 0.036, 0.022))


def gatekeeper():
    root = bpy.data.objects.new('GTK', None)
    cad.SC().objects.link(root)
    lower = long_lower('GTK_lower', [(-0.11, 0.0), (0.095, 0.0), (0.095, -0.012), (0.0875, -0.017), (0.088, -0.046), (0.0835, -0.0525), (0.037, -0.0525),
                                     (0.0285, -0.049), (0.0245, -0.058), (-0.0335, -0.058), (-0.0235, -0.020), (-0.11, -0.014)], M['poly'])
    body = cad.section('GTK_body', [(-0.024, 0.0), (0.024, 0.0), (0.024, 0.062), (0.02, 0.066), (-0.02, 0.066), (-0.024, 0.062)], -0.115, 0.22, M['slide'])
    cad.cut(body, [
        cad.box('c', (0.3, 0.034, 0.05), (0.06, 0, 0.034)),             # the inside
        cad.box('c', (0.07, 0.02, 0.026), (0.14, 0.02, 0.042)),         # the feed port, on the left
        cad.box('c', (0.05, 0.02, 0.02), (0.06, -0.02, 0.03)),          # the ejection port, on the right
        cad.box('c', (0.11, 0.02, 0.008), (0.16, 0.02, 0.016)),         # the charging handle's slot, on the left
    ])
    done(body, 0.0008)
    extra = []
    marks(extra, 0.02405, [('GATEKEEPER', 0.0062, 0.07, 0.004), ('KEEPER ARMS  VANCOUVER BC', 0.0022, 0.06, 0.054)])
    marks(extra, -0.02405, [('BH22 000522', 0.0024, 0.12, 0.006)])
    body = cad.join('GTK_body', [body] + extra)
    # The feed cover, hinged at its front: its rail and the rear sight ride on it.
    lid = done(cad.box('GTK_cover', (0.22, 0.044, 0.014), (0.05, 0, 0.073), M['slide']), 0.001, 2)
    top = rail('rail', -0.04, 0.13, 0.08, M['dark'])
    rear_sight = peep('rear', -0.03, 0.1, M['dark'], 0.0865)
    hinge = cad.cyl('hinge', 0.005, 0.046, (0.158, 0, 0.073), M['steel'], axis='Y', seg=16)
    cad.box_uv(hinge)
    cover = cad.origin(cad.join('GTK_cover', [lid, top, rear_sight, hinge]), (0.158, 0, 0.073))
    guard = cad.section('GTK_guard', [(-0.017, -0.03), (0.017, -0.03), (0.022, -0.022), (0.022, 0.02), (-0.022, 0.02), (-0.022, -0.022)], 0.22, 0.45, M['ember'])
    cad.cut(guard, [cad.box('c', (0.024, 0.06, 0.006), (0.245 + i * 0.04, 0, -0.01)) for i in range(5)])
    done(guard, 0.0012, 2)
    under = rail('GTK_underrail', 0.37, 0.44, -0.03, M['dark'], axis='under')
    shroud = cad.tube('GTK_shroud', 0.024, 0.0205, 0.25, (0.345, 0, GBZ), M['dark'], seg=32)
    cad.cut(shroud, [cad.box('c', (0.013, 0.06, 0.009), (0.25 + i * 0.03, 0, GBZ)) for i in range(7)] +
            [cad.box('c', (0.013, 0.009, 0.06), (0.265 + i * 0.03, 0, GBZ)) for i in range(6)])
    done(shroud, 0.0005, 1)
    barrel = cad.tube('GTK_barrel', 0.0115, 0.0035, 0.48, (0.44, 0, GBZ), M['steel'], seg=32)
    hider = cad.cyl('hider', 0.0125, 0.05, (0.705, 0, GBZ), M['dark'], seg=24)
    cad.cut(hider, [cad.cyl('c', 0.0075, 0.06, (0.705, 0, GBZ), seg=20)] + [cad.box('c', (0.032, 0.003, 0.04), (0.715, 0, GBZ), rot=('X', k * math.pi / 3)) for k in range(3)])
    done(barrel, 0.0004)
    done(hider, 0.0005, 1)
    barrel = cad.join('GTK_barrel', [barrel, hider])
    tower = done(cad.box('GTK_tower', (0.016, 0.014, 0.034), (0.655, 0, GBZ + 0.0115 + 0.017), M['dark']), 0.001, 2)
    front_sight = post('GTK_front', 0.655, 0.1, GBZ + 0.0115 + 0.034, M['dark'])
    # The bipod, folded along the barrel.
    clamp = cad.tube('GTK_bipod', 0.0145, 0.0115, 0.016, (0.48, 0, GBZ), M['dark'], seg=24)
    legs = [cad.capsule('leg', (0.49, s * 0.012, GBZ - 0.016), (0.63, s * 0.012, GBZ - 0.012), 0.0042, M['dark'], seg=12, rings=3) for s in (1, -1)]
    feet = [cad.capsule('foot', (0.632, s * 0.012, GBZ - 0.013), (0.64, s * 0.016, GBZ - 0.019), 0.005, M['poly'], seg=12, rings=3) for s in (1, -1)]
    for o in [clamp] + legs + feet:
        cad.smooth(o, 40)
        cad.box_uv(o)
    bipod = cad.join('GTK_bipod', [clamp] + legs + feet)
    stock = cad.outline('GTK_stock', [(-0.115, 0.06), (-0.4, 0.05), (-0.415, 0.04), (-0.415, -0.09), (-0.4, -0.1), (-0.3, -0.07), (-0.2, -0.04), (-0.115, -0.02)], 0.018, M['ember'])
    cad.cut(stock, [cad.outline('c', [(-0.15, 0.03), (-0.33, 0.03), (-0.34, -0.03), (-0.2, -0.012), (-0.15, -0.004)], 0.03)])
    done(stock, 0.002, 2)
    butt = done(cad.outline('GTK_butt', [(-0.413, 0.052), (-0.43, 0.05), (-0.433, 0.038), (-0.433, -0.093), (-0.43, -0.103), (-0.413, -0.103)], 0.02, M['poly']), 0.003, 3)
    arm = cad.box('GTK_handle', (0.01, 0.016, 0.007), (0.205, 0.03, 0.016), M['dark'])
    knob = cad.cyl('knob', 0.006, 0.014, (0.205, 0.04, 0.016), M['poly'], axis='Y', seg=20)
    done(arm, 0.0006)
    done(knob, 0.001, 2)
    handle = cad.origin(cad.join('GTK_handle', [arm, knob]), (0.205, 0.024, 0.016))
    trigger = rename(build_trigger(), 'GTK_trigger')
    mag = gatekeeper_box('GTK_mag')
    rnd = heavy_round('GTK_round')
    seat_round(rnd, mag, (0.14, 0.036, -0.014), 0)
    belt = gatekeeper_belt('GTK_belt')
    casing = heavy_round('GTK_casing', loose=True)
    casing.location = (0.05, -0.05, 0.05)
    base = [lower, body, cover, guard, under, shroud, barrel, tower, front_sight, bipod, stock, butt, handle, trigger, mag, rnd, belt]
    return finish(root, 'GTK', base, [casing], {
        'muzzle': (0.73, 0, GBZ), 'eject': (0.06, -0.025, 0.03), 'aim_iron': (-0.03, 0, 0.1),
        'mount_muzzle': (0.73, 0, GBZ), 'mount_optic': (0.045, 0, 0.0865), 'mount_rail': (0.405, 0, -0.0365), 'mount_mag': (0.155, 0.015, -0.005),
    })


FILES = {'pistol': 'p22', 'smg': 'vesper', 'rifle': 'keeper', 'sniper': 'longview', 'lmg': 'gatekeeper'}
BUILD = {'pistol': pistol, 'smg': vesper, 'rifle': keeper, 'sniper': longview, 'lmg': gatekeeper}
root = BUILD[GUN]()

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
    # A long gun is looked at from further off, about its middle.
    k, mid = (1.0, Vector((0.06, 0, -0.03))) if GUN == 'pistol' else (2.6, Vector((0.05 + (0.15 if GUN in ('sniper', 'rifle') else 0.0), 0, 0.0)))
    for name, energy, loc, size in (('key', 14, (0.15, 0.35, 0.4), 0.5), ('fill', 5, (-0.35, 0.3, 0.1), 0.6), ('rim', 16, (0.1, -0.4, 0.3), 0.4), ('under', 2, (0.1, 0.1, -0.4), 0.6)):
        l = bpy.data.lights.new(name, 'AREA')
        l.energy, l.size = energy * k * k, size * k
        o = bpy.data.objects.new(name, l)
        cad.SC().objects.link(o)
        o.location = Vector(loc) * k
        o.rotation_euler = (mid - o.location).to_track_quat('-Z', 'Y').to_euler()
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cad.SC().objects.link(cam)
    cam.data.lens = 85
    cam.data.clip_start = 0.01
    scn.camera = cam
    ATT = [o for o in bpy.data.objects if o.name.startswith('P22_att_') or o.name == 'P22_round_ext']
    def shot(tag, eye, at=(0.06, 0, -0.035), show=()):
        for o in ATT:
            o.hide_render = not any(o.name.endswith(s) for s in show)
        if GUN == 'pistol':
            bpy.data.objects['P22_mag'].hide_render = 'mag' in show
            bpy.data.objects['P22_round'].hide_render = 'mag' in show
        cam.location = eye
        cam.rotation_euler = (Vector(at) - Vector(eye)).to_track_quat('-Z', 'Y').to_euler()
        scn.render.filepath = f'{PREVIEW}-{tag}.png'
        bpy.ops.render.render(write_still=True)
    for o in bpy.data.objects:
        if o.name.endswith('_casing'):
            o.hide_render = True
    if GUN == 'pistol':
        shot('left', (0.06, 0.62, 0.02))
        shot('right', (0.06, -0.62, 0.02))
        shot('3q', (-0.28, 0.42, 0.2))
        shot('top', (0.06, 0.12, 0.6), (0.06, 0, 0))
        shot('rear', (-0.5, 0.06, 0.1), (0.0, 0, 0.0))
        shot('kit', (-0.3, 0.5, 0.2), (0.12, 0, -0.01), show=('light', 'suppressor', 'holo', 'mag', 'round_ext'))
        shot('scope', (-0.3, 0.5, 0.25), (0.06, 0, 0.01), show=('scope',))
    else:
        c, d = tuple(mid), (2.4 if GUN in ('sniper', 'rifle', 'lmg') else 1.8)
        shot('left', (mid.x, d, 0.02), c)
        shot('right', (mid.x, -d, 0.02), c)
        shot('3q', (mid.x - 0.45 * d, 0.62 * d, 0.3 * d), c)
        shot('front', (mid.x + 0.8 * d, -0.35 * d, 0.16 * d), c)
    for o in bpy.data.objects:
        o.hide_render = False
    for n in ('key', 'fill', 'rim', 'under', 'cam'):
        bpy.data.objects.remove(bpy.data.objects[n])

out = ROOT + '/blender/build'
os.makedirs(out, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
path = f'{out}/{FILES[GUN]}.glb'
bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                          export_image_format='WEBP', export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_active_vertex_color_when_no_material=True)
print('exported', path, os.path.getsize(path), 'bytes')
