# The studio's two detailed props: the closed laptop on the return and the PC case behind glass beside it. Every part
# is a closed solid (or a ring with thickness), and parts meet without sharing a face, so nothing flickers or vanishes.
import math
import bmesh
from mathutils import Vector, Matrix
from lib.core import box, cyl, link, plane, point, principled, tube, bezier, P


def outline(w, d, r, seg=5, notch=0.0, depth=0.0):
    # A rounded rectangle w (x) by d (y) round its middle, corners of radius r, counter-clockwise from above; with a
    # shallow notch notch wide each way into the middle of its front (+y) edge.
    pts = []
    for (sx, sy, a0) in ((1, -1, -90), (1, 1, 0), (-1, 1, 90), (-1, -1, 180)):
        for k in range(seg + 1):
            a = math.radians(a0 + 90 * k / seg)
            pts.append((sx * (w / 2 - r) + r * math.cos(a), sy * (d / 2 - r) + r * math.sin(a)))
        if notch and (sx, sy) == (1, 1):
            for k in range(1, 8):
                t = k / 8
                pts.append((notch * (1 - 2 * t), d / 2 - depth * math.sin(math.pi * t)))
    return pts


def slab(name, c, w, d, r, z0, z1, mat, eb=0.0, et=0.0, notch=0.0, depth=0.0, kind='baked'):
    # A rounded slab from z0 to z1 whose bottom and top edges are rounded off by eb and et.
    bm, rings = bmesh.new(), []
    for e, z in ((eb, z0), (0.0, z0 + eb), (0.0, z1 - et), (et, z1)):
        rings.append([bm.verts.new(P((c[0] + x, c[1] + y, z))) for x, y in outline(w - 2 * e, d - 2 * e, max(r - e, 0.0015), notch=notch + e if notch else 0, depth=depth)])
    n = len(rings[0])
    for a, b in zip(rings, rings[1:]):
        if a[0].co == b[0].co:
            continue
        for k in range(n):
            bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]))
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return link(name, bm, mat, kind)


def add_box(bm, c, s):
    g = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(s), verts=g['verts'])
    bmesh.ops.translate(bm, vec=P(c), verts=g['verts'])


def boxes(name, items, mat, kind='baked'):
    # Many plain boxes as one object: (centre, size) each.
    bm = bmesh.new()
    for c, s in items:
        add_box(bm, c, s)
    return link(name, bm, mat, kind)


def add_ring(bm, c, ro, ri, ln, axis, seg=20):
    # A ring with thickness round an axis ('x', 'y' or 'z'): outer and inner walls and both rims.
    rows = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        row = []
        for r, t in ((ro, -ln / 2), (ro, ln / 2), (ri, ln / 2), (ri, -ln / 2)):
            u, v = r * math.cos(a), r * math.sin(a)
            off = {'x': (t, u, v), 'y': (u, t, v), 'z': (u, v, t)}[axis]
            row.append(bm.verts.new(P(Vector(c) + Vector(off))))
        rows.append(row)
    faces = []
    for i in range(seg):
        a, b = rows[i], rows[(i + 1) % seg]
        for k in range(4):
            faces.append(bm.faces.new((a[k], b[k], b[(k + 1) % 4], a[(k + 1) % 4])))
    bmesh.ops.recalc_face_normals(bm, faces=faces)


def rings(name, items, mat, kind='baked', seg=20):
    bm = bmesh.new()
    for c, ro, ri, ln, axis in items:
        add_ring(bm, c, ro, ri, ln, axis, seg)
    return link(name, bm, mat, kind)


def fan(name, c, axis, r, M, E, blades=7, ring=None, face=-1, dark=None):
    # A case fan seen through a grille or glass: a lit ring (named as the page's PC lights are, world.js), a dark frame
    # ring behind it, a hub and blades.
    t = {'x': 0, 'y': 1, 'z': 2}[axis]
    if ring:
        rings(ring, [(c, r, r - 0.004, 0.004, axis)], E['rgb_teal'], kind='emit')
    back = list(c)
    # Its frame and hub sit behind the lit ring, away from the side it faces.
    back[t] -= face * 0.006
    dark = dark or M['black']
    rings(f'{name}_frame', [(tuple(back), r + 0.002, r - 0.003, 0.008, axis)], dark)
    cyl(f'{name}_hub', r * 0.32, 0.012, tuple(back), dark, seg=16, axis=axis.upper())
    bm = bmesh.new()
    for i in range(blades):
        a = 2 * math.pi * i / blades
        g = bmesh.ops.create_cube(bm, size=1.0)
        span, chord = r * 0.62, r * 0.42
        size = {'x': (0.002, chord, span), 'y': (chord, 0.002, span), 'z': (chord, span, 0.002)}[axis]
        bmesh.ops.scale(bm, vec=Vector(size), verts=g['verts'])
        # Out along the blade, then pitched a little and turned round the hub.
        mid = r * 0.32 + span / 2
        local = {'x': Vector((0, 0, mid)), 'y': Vector((0, 0, mid)), 'z': Vector((0, mid, 0))}[axis]
        bmesh.ops.translate(bm, vec=local, verts=g['verts'])
        tilt = Matrix.Rotation(math.radians(25), 3, local.normalized())
        spin = Matrix.Rotation(a, 3, axis.upper())
        bmesh.ops.rotate(bm, cent=local, matrix=tilt, verts=g['verts'])
        bmesh.ops.rotate(bm, cent=Vector(), matrix=spin, verts=g['verts'])
        bmesh.ops.translate(bm, vec=P(back), verts=g['verts'])
    link(f'{name}_blades', bm, dark)


# ---------- the laptop, closed on the return, its lid for stickers ----------
LAPTOP = {'w': 0.31, 'd': 0.22, 'r': 0.012, 'feet': 0.0015, 'base': 0.0095, 'gap': 0.0012, 'lid': 0.0055}


def laptop(M, E, LX, LY, DZ):
    alu = principled('alu', (0.5, 0.51, 0.53), 0.4)
    L = LAPTOP
    z_base = DZ + L['feet']
    z_gap = z_base + L['base']
    z_lid = z_gap + L['gap']
    z_top = z_lid + L['lid']
    slab('laptop_base', (LX, LY), L['w'], L['d'], L['r'], z_base, z_gap, alu, eb=0.0015, et=0.002)
    # The slim dark gap between base and lid, set in from both, and the lid with the notch to lift it by.
    slab('laptop_gap', (LX, LY), L['w'] - 0.004, L['d'] - 0.004, L['r'] - 0.002, z_gap, z_lid, M['black'])
    slab('laptop_lid', (LX, LY), L['w'], L['d'], L['r'], z_lid, z_top, alu, eb=0.0008, et=0.0025, notch=0.016, depth=0.0035)
    # The hinge along the back edge, a little proud of it.
    cyl('laptop_hinge', 0.004, 0.24, (LX, LY - L['d'] / 2 + 0.003, z_gap + L['gap'] / 2), M['metal'], seg=16, axis='X')
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl(f'laptop_foot{sx}{sy}', 0.007, 0.0016, (LX + sx * (L['w'] / 2 - 0.028), LY + sy * (L['d'] / 2 - 0.025), DZ + 0.0008), M['black'], seg=12)
    # Ports on both sides at the base's middle height: USB-C, USB-C and a jack on the left, USB-A and USB-C on the right.
    zp = z_base + L['base'] / 2
    xl, xr = LX - L['w'] / 2, LX + L['w'] / 2
    boxes('laptop_ports', [((xl, LY - 0.05, zp), (0.0008, 0.009, 0.0026)), ((xl, LY - 0.035, zp), (0.0008, 0.009, 0.0026)),
                           ((xr, LY - 0.04, zp), (0.0008, 0.013, 0.0045)), ((xr, LY + 0.02, zp), (0.0008, 0.009, 0.0026))], M['black'])
    cyl('laptop_jack', 0.0018, 0.0008, (xl, LY + 0.04, zp), M['black'], seg=12, axis='X')
    # The page lays its stickers and logo on the lid's flat top.
    point('laptop_lid', (LX, LY, z_top))
    return xr, zp
