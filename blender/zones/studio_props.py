# The studio's two detailed props: the closed laptop on the return and the PC case behind glass beside it. Every part
# is a closed solid (or a ring with thickness), and parts meet without sharing a face, so nothing flickers or vanishes.
import math
import bmesh
from mathutils import Vector, Matrix
from lib.core import area, box, cyl, link, plane, point, principled, tube, bezier, P


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


# ---------- the PC case on the return: front mesh, glass side, top I/O, rear I/O, and a full build inside ----------
def add_cyl(bm, r, h, c, axis='Z', seg=12):
    g = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r, depth=h)
    vs = g['verts']
    if axis in ('X', 'Y'):
        bmesh.ops.rotate(bm, cent=Vector(), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y' if axis == 'X' else 'X'), verts=vs)
    bmesh.ops.translate(bm, vec=P(c), verts=vs)


def rounded(pts, R, n=4):
    # A polyline with every corner bent round an arc of radius R, as hard tubing is bent, not mitred.
    out = [Vector(pts[0])]
    for i in range(1, len(pts) - 1):
        a, b, c = Vector(pts[i - 1]), Vector(pts[i]), Vector(pts[i + 1])
        u, w = (a - b).normalized(), (c - b).normalized()
        ang = u.angle(w)
        ctr = b + (u + w).normalized() * (R / math.sin(ang / 2))
        v0, v1 = b + u * (R / math.tan(ang / 2)) - ctr, b + w * (R / math.tan(ang / 2)) - ctr
        om = v0.angle(v1)
        out += [ctr + (math.sin((1 - k / n) * om) * v0 + math.sin(k / n * om) * v1) / math.sin(om) for k in range(n + 1)]
    out.append(Vector(pts[-1]))
    return out


def pipe(bm, pts, r, seg=10):
    # A round tube along a path whose rings are carried along it without twisting; its open ends sit flat on the faces
    # it runs into.
    pts = [P(p) for p in pts]
    n = len(pts)
    T = [(pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized() for i in range(n)]
    N = T[0].cross(Vector((0, 0, 1)) if abs(T[0].z) < 0.9 else Vector((1, 0, 0))).normalized()
    rings = []
    for i in range(n):
        if i and T[i - 1].cross(T[i]).length > 1e-9:
            N = Matrix.Rotation(T[i - 1].angle(T[i]), 3, T[i - 1].cross(T[i]).normalized()) @ N
        B = T[i].cross(N)
        rings.append([bm.verts.new(pts[i] + (N * math.cos(2 * math.pi * k / seg) + B * math.sin(2 * math.pi * k / seg)) * r) for k in range(seg)])
    for a, b in zip(rings, rings[1:]):
        for k in range(seg):
            bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))


def cell_plate(bm, at, cells, t0, t1, seg=32):
    # A plate from t0 to t1 through its thickness, made of rectangular cells side by side, each with a round hole: a fan
    # frame, or a graphics card's shroud. cells: (u0, u1, v0, v1, cu, cv, r); at(u, v, t) gives the point.
    U0, U1 = min(c[0] for c in cells), max(c[1] for c in cells)
    V0, V1 = min(c[2] for c in cells), max(c[3] for c in cells)
    cache = {}

    def vert(u, v, t):
        k = (round(u, 7), round(v, 7), t)
        if k not in cache:
            cache[k] = bm.verts.new(P(at(u, v, t)))
        return cache[k]

    border = lambda p, q: any(abs(p[i] - e) < 1e-7 and abs(q[i] - e) < 1e-7 for i, e in ((0, U0), (0, U1), (1, V0), (1, V1)))
    for u0, u1, v0, v1, cu, cv, r in cells:
        corners = sorted(((math.atan2(y - cv, x - cu) % (2 * math.pi), (x, y)) for x, y in ((u0, v0), (u1, v0), (u1, v1), (u0, v1))))
        ring, edge = [], []
        for k in range(seg):
            a = 2 * math.pi * (k + 0.5) / seg
            ca, sa = math.cos(a), math.sin(a)
            s = min((u1 - cu) / ca if ca > 1e-9 else (u0 - cu) / ca if ca < -1e-9 else 1e9, (v1 - cv) / sa if sa > 1e-9 else (v0 - cv) / sa if sa < -1e-9 else 1e9)
            ring.append((cu + r * ca, cv + r * sa))
            edge.append((a, (cu + s * ca, cv + s * sa)))
        for k in range(seg):
            a0, a1 = edge[k][0], edge[(k + 1) % seg][0] + (2 * math.pi if k == seg - 1 else 0)
            mid = [p for ang, p in corners if a0 < ang < a1 or a0 < ang + 2 * math.pi < a1]
            outer = [edge[k][1]] + mid + [edge[(k + 1) % seg][1]]
            for t in (t0, t1):
                bm.faces.new([vert(*ring[k], t), vert(*ring[(k + 1) % seg], t)] + [vert(*p, t) for p in outer[::-1]])
            bm.faces.new((vert(*ring[k], t0), vert(*ring[(k + 1) % seg], t0), vert(*ring[(k + 1) % seg], t1), vert(*ring[k], t1)))
            for p, q in zip(outer, outer[1:]):
                if border(p, q):
                    bm.faces.new((vert(*p, t0), vert(*q, t0), vert(*q, t1), vert(*p, t1)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])


def rect_panel(bm, at, U, V, t0, t1, holes):
    # A panel from t0 to t1 with rectangular openings, built on a grid through every opening's edges so it stays one
    # closed solid with no T-junctions. holes: (u0, u1, v0, v1).
    us = sorted({*U, *(h[0] for h in holes), *(h[1] for h in holes)})
    vs = sorted({*V, *(h[2] for h in holes), *(h[3] for h in holes)})
    cache = {}

    def vert(i, j, t):
        if (i, j, t) not in cache:
            cache[(i, j, t)] = bm.verts.new(P(at(us[i], vs[j], t)))
        return cache[(i, j, t)]

    def solid(i, j):
        if not (0 <= i < len(us) - 1 and 0 <= j < len(vs) - 1):
            return False
        cu, cv = (us[i] + us[i + 1]) / 2, (vs[j] + vs[j + 1]) / 2
        return not any(h[0] < cu < h[1] and h[2] < cv < h[3] for h in holes)

    for i in range(len(us) - 1):
        for j in range(len(vs) - 1):
            if not solid(i, j):
                continue
            for t in (t0, t1):
                bm.faces.new((vert(i, j, t), vert(i + 1, j, t), vert(i + 1, j + 1, t), vert(i, j + 1, t)))
            for (di, dj), (a, b) in (((-1, 0), ((i, j), (i, j + 1))), ((1, 0), ((i + 1, j), (i + 1, j + 1))), ((0, -1), ((i, j), (i + 1, j))), ((0, 1), ((i, j + 1), (i + 1, j + 1)))):
                if not solid(i + di, j + dj):
                    bm.faces.new((vert(*a, t0), vert(*b, t0), vert(*b, t1), vert(*a, t1)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])


def rotor(bm, c, axis, hub, length, blades, tip, chord, pitch, sticker=None):
    # A fan's hub, a prism of twice as many sides as it has blades, and its blades, each one's root lying flat on a face
    # of the hub. sticker: (bits, side), a light disc on the hub's face on that side (+1 or -1) of its axis.
    t = {'X': 0, 'Y': 1, 'Z': 2}[axis]
    ax = Vector([1.0 if i == t else 0.0 for i in range(3)])
    e1 = Vector([1.0 if i == (t + 1) % 3 else 0.0 for i in range(3)])
    e2 = ax.cross(e1)
    C, n = P(c), 2 * blades
    rv = hub / math.cos(math.pi / n)
    ring = [[bm.verts.new(C + (e1 * math.cos(2 * math.pi * (k + 0.5) / n) + e2 * math.sin(2 * math.pi * (k + 0.5) / n)) * rv + ax * s * length / 2) for k in range(n)] for s in (-1, 1)]
    for k in range(n):
        bm.faces.new((ring[0][k], ring[0][(k + 1) % n], ring[1][(k + 1) % n], ring[1][k]))
    bm.faces.new(ring[0][::-1])
    bm.faces.new(ring[1])
    p = math.radians(pitch)
    for j in range(blades):
        a = 2 * math.pi * j / blades
        er = e1 * math.cos(a) + e2 * math.sin(a)
        et = ax.cross(er)
        cd, th = et * math.cos(p) + ax * math.sin(p), -et * math.sin(p) + ax * math.cos(p)
        vs = [bm.verts.new(C + er * rad + cd * sc * w / 2 + th * st * d / 2) for rad, w, d in ((hub, chord[0], 0.002), (tip, chord[1], 0.0015)) for sc, st in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        for f in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
            bm.faces.new([vs[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    if sticker:
        bits, side = sticker
        bits.cyl('light', hub * 0.62, 0.0006, tuple(Vector(c) + ax * side * (length / 2 + 0.0003)), axis, seg=10)


class Bits:
    # Small parts drawn in one flat colour each at runtime instead of baked: ports, screws, blades, fittings, the logo's
    # pixels. Baked, each face would take a lightmap island of its own with its margin, coarsening the whole studio.
    def __init__(self, mats):
        self.mats, self.bm = mats, {k: bmesh.new() for k in mats}

    def box(self, k, e):
        add_box(self.bm[k], *e)

    def cyl(self, k, r, h, c, axis='Z', seg=12):
        add_cyl(self.bm[k], r, h, c, axis, seg)

    def done(self):
        for k, bm in self.bm.items():
            if bm.verts:
                bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
                link(f'pc_bits_{k}', bm, self.mats[k], 'emit')
            else:
                bm.free()


def pc(M, E, G, PCX, PCY, DZ):
    # Local axes: x from the front (-0.25) to the rear (+0.25), y from the solid side (-0.13) to the glass (+0.13), z up
    # from the bottom of the case (0) to its top (0.52), which stands on 1.2 cm feet.
    Z = DZ + 0.012
    at = lambda x, y, z: (PCX + x, PCY + y, Z + z)
    ext = lambda x0, x1, y0, y1, z0, z1: (at((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), (x1 - x0, y1 - y0, z1 - z0))
    bx = lambda name, e, mat, bevel=0.0, kind='baked': box(name, e[1], e[0], mat, bevel=bevel, kind=kind)
    case = principled('pc_case', (0.015, 0.015, 0.018), 0.45)
    # The rear faces the monitor's light and bakes grey; it is shown darker so the case reads as one black (core.SHADE).
    rear_mat = principled('pc_case_rear', (0.015, 0.015, 0.018), 0.45)
    pcb = principled('pc_pcb', (0.018, 0.02, 0.024), 0.7)
    sink = principled('pc_sink', (0.07, 0.072, 0.08), 0.45)
    gpu_mat = principled('pc_gpu', (0.04, 0.042, 0.048), 0.5)
    alu = principled('pc_alu', (0.3, 0.31, 0.33), 0.4)
    fan_mat = principled('pc_fan', (0.02, 0.02, 0.024), 0.6)
    bits = Bits({'black': principled('pc_bits_black', (0.012, 0.012, 0.014), 0.6), 'dark': principled('pc_bits_dark', (0.08, 0.082, 0.09), 0.5),
                 'metal': principled('pc_bits_metal', (0.45, 0.46, 0.48), 0.35), 'light': principled('pc_bits_light', (0.42, 0.42, 0.4), 0.5),
                 'gold': principled('pc_bits_gold', (0.55, 0.4, 0.12), 0.35), 'blue': principled('pc_bits_blue', (0.05, 0.18, 0.55), 0.4)})
    lit = {k: bmesh.new() for k in ('front', 'rad', 'rear', 'gpu', 'ram0', 'ram1')}

    # ---- the shell: rubber feet, the solid side, floor and roof between the front and rear panels ----
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl(f'pc_foot{sx}{sy}', 0.014, 0.012, (PCX + sx * 0.2, PCY + sy * 0.095, DZ + 0.006), M['black'], seg=16)
    bx('pc_back', ext(-0.238, 0.238, -0.13, -0.118, 0.012, 0.508), case, bevel=0.004)
    bx('pc_floor', ext(-0.238, 0.238, -0.13, 0.13, 0.0, 0.012), case, bevel=0.004)
    bx('pc_roof', ext(-0.238, 0.238, -0.13, 0.13, 0.508, 0.52), case, bevel=0.004)

    # ---- the glass side: the glass, its black border and four thumbscrews seated on it ----
    boxes('pc_glass_trim', [ext(-0.238, 0.238, 0.127, 0.131, 0.012, 0.02), ext(-0.238, 0.238, 0.127, 0.131, 0.5, 0.508),
                            ext(-0.238, -0.23, 0.127, 0.131, 0.02, 0.5), ext(0.23, 0.238, 0.127, 0.131, 0.02, 0.5)], M['black'])
    for sx in (-1, 1):
        for sz in (0.035, 0.485):
            bits.cyl('dark', 0.0055, 0.005, at(sx * 0.222, 0.1295, sz), 'Y', seg=14)
    glass = plane('pc_glass', 0.46, 0.48, at(0, 0.127, 0.26), G['glass'], '+Y', kind='glass')
    mesh_mat = principled('G_mesh', (0.1, 0.1, 0.11), 0.5, transmission=1.0)
    mesh_mat.surface_render_method = 'BLENDED'

    # ---- the front: a panel round a perforated mesh, three fans behind it with lit rings, my BH-22 under it ----
    fb = bmesh.new()
    rect_panel(fb, lambda u, v, t: at(t, u, v), (-0.13, 0.13), (0.0, 0.52), -0.25, -0.238, [(-0.1, 0.1, 0.09, 0.49)])
    link('pc_front', fb, case)
    fans = []
    for zc in (0.166, 0.288, 0.41):
        fans.append(('front', lambda u, v, t: at(t, u, v), 'X', (0.0, zc), (-0.237, -0.212), -1))
    glyph = {'B': ['110', '101', '110', '101', '110'], 'H': ['101', '101', '111', '101', '101'], '-': ['000', '000', '111', '000', '000'], '2': ['111', '001', '111', '100', '111']}
    px, y = 0.0022, 0.035
    for ch in 'BH-22':
        for row, line in enumerate(glyph[ch]):
            for col, on in enumerate(line):
                if on == '1':
                    bits.box('light', ext(-0.2512, -0.25, y - col * px - px * 0.45, y - col * px + px * 0.45, 0.035 - row * px - px * 0.45, 0.035 - row * px + px * 0.45))
        y -= 4 * px

    # ---- the rear: a panel with openings for the I/O shield, the rear fan behind its grille, the slot covers, the
    # graphics card's own bracket on the vertical slots, and the power supply ----
    IO, FAN, SLOTS, VSLOT, PSU = (-0.112, -0.068, 0.33, 0.49), (-0.017, 0.077, 0.353, 0.447), (-0.112, -0.012, 0.128, 0.262), (0.048, 0.092, 0.128, 0.262), (-0.075, 0.075, 0.012, 0.098)
    rb = bmesh.new()
    rect_panel(rb, lambda u, v, t: at(t, u, v), (-0.13, 0.13), (0.0, 0.52), 0.238, 0.25, [IO, FAN, SLOTS, VSLOT, PSU])
    link('pc_rear', rb, rear_mat)
    inset = lambda h: ext(0.243, 0.246, h[0], h[1], h[2], h[3])
    bx('pc_io_shield', inset(IO), rear_mat)
    PSU_GRILLE = (-0.064, 0.03, 0.03, 0.088)
    pb = bmesh.new()
    rect_panel(pb, lambda u, v, t: at(t, u, v), PSU[:2], PSU[2:], 0.243, 0.246, [PSU_GRILLE])
    link('pc_psu_back', pb, rear_mat)
    bx('pc_gpu_bracket_out', inset(VSLOT), rear_mat)
    h = (SLOTS[3] - SLOTS[2]) / 7
    boxes('pc_slot_covers', [inset((SLOTS[0], SLOTS[1], SLOTS[2] + k * h, SLOTS[2] + (k + 1) * h)) for k in range(7)], rear_mat)
    for k in range(7):
        zc = SLOTS[2] + (k + 0.5) * h
        for dy in (-0.03, 0.0, 0.03):
            bits.box('black', ext(0.246, 0.2466, -0.062 + dy - 0.012, -0.062 + dy + 0.012, zc - 0.0022, zc + 0.0022))
        bits.cyl('dark', 0.003, 0.0012, at(0.2506, -0.12, zc), 'X', seg=8)
    fans.append(('rear', lambda u, v, t: at(t, u, v), 'X', (0.03, 0.4), (0.212, 0.237), -1))
    for y0, z0 in ((-0.0225, 0.3475), (0.0825, 0.3475), (-0.0225, 0.4525), (0.0825, 0.4525)):
        bits.cyl('dark', 0.0032, 0.0012, at(0.2506, y0, z0), 'X', seg=8)
    for y0, z0 in ((-0.124, 0.006), (0.124, 0.006), (-0.124, 0.514), (0.124, 0.514)):
        bits.cyl('dark', 0.0032, 0.0012, at(0.2506, y0, z0), 'X', seg=8)

    def port(y, z, w, hgt, tongue=None, shell='metal', face=0.246):
        # A socket: its shell, the dark opening on it and, inside, the tongue (all stacked, none inside another).
        bits.box(shell, ext(face, face + 0.0012, y - w / 2, y + w / 2, z - hgt / 2, z + hgt / 2))
        bits.box('black', ext(face + 0.0012, face + 0.0018, y - w / 2 + 0.0007, y + w / 2 - 0.0007, z - hgt / 2 + 0.0007, z + hgt / 2 - 0.0007))
        if tongue:
            bits.box(tongue, ext(face + 0.0018, face + 0.0024, y - w / 2 + 0.0018, y + w / 2 - 0.0018, z - 0.0006, z + 0.0006))

    # The board's I/O, top to bottom: two Wi-Fi antenna posts, the BIOS button, four USB 3, two USB-C and HDMI, the
    # network port, and the audio jacks with the optical out.
    for yy in (-0.102, -0.078):
        bits.cyl('gold', 0.0032, 0.007, at(0.2495, yy, 0.475), 'X', seg=12)
    port(-0.09, 0.459, 0.007, 0.007, shell='dark')
    for zz in (0.443, 0.428):
        for yy in (-0.1, -0.08):
            port(yy, zz, 0.0132, 0.0058, tongue='blue')
    port(-0.1, 0.413, 0.0086, 0.0028, tongue='metal')
    port(-0.086, 0.413, 0.0086, 0.0028, tongue='metal')
    port(-0.075, 0.413, 0.0098, 0.0048)
    port(-0.09, 0.392, 0.016, 0.0135, shell='dark')
    for yy in (-0.0965, -0.0835):
        bits.cyl('gold', 0.0018, 0.0006, at(0.2463, yy, 0.4025), 'X', seg=8)
    for yy, zz in ((-0.102, 0.366), (-0.09, 0.366), (-0.078, 0.366), (-0.102, 0.35), (-0.09, 0.35)):
        bits.cyl('gold', 0.0032, 0.0015, at(0.24675, yy, zz), 'X', seg=12)
        bits.cyl('black', 0.0019, 0.0006, at(0.2478, yy, zz), 'X', seg=10)
    port(-0.078, 0.35, 0.0075, 0.0068, shell='dark')
    # The graphics card's outputs on its bracket: three DisplayPort and an HDMI, its vents under them.
    for zz in (0.245, 0.229, 0.213):
        port(0.07, zz, 0.0165, 0.0058, tongue='dark')
    port(0.07, 0.197, 0.0155, 0.0058, tongue='dark')
    for k in range(5):
        bits.box('black', ext(0.246, 0.2466, 0.054, 0.086, 0.14 + 0.009 * k, 0.1442 + 0.009 * k))
    # The power supply's back: its grille, the mains socket with its three pins, the rocker switch and a label.
    port(0.052, 0.062, 0.026, 0.02, shell='dark')
    for yy, zz in ((0.046, 0.066), (0.058, 0.066), (0.052, 0.057)):
        bits.box('metal', ext(0.2478, 0.2486, yy - 0.0011, yy + 0.0011, zz - 0.0023, zz + 0.0023))
    bits.box('black', ext(0.246, 0.2495, 0.046, 0.058, 0.026, 0.042))
    bits.box('light', ext(0.2495, 0.2501, 0.0485, 0.0555, 0.0365, 0.0385))
    bits.box('light', ext(0.246, 0.2466, -0.068, -0.034, 0.016, 0.026))
    for yy in (-0.071, 0.071):
        for zz in (0.016, 0.094):
            bits.cyl('dark', 0.0028, 0.0012, at(0.2466, yy, zz), 'X', seg=8)

    # ---- the top: a mesh over the radiator in its dust filter's frame, the power button and front I/O ----
    X0 = PCX - 0.25
    # Its three long bars rest on the cross bars rather than running through them.
    boxes('pc_top_mesh', [((PCX + 0.02, PCY - 0.01 + dy, Z + 0.52155), (0.36, 0.0016, 0.0011)) for dy in (-0.04, 0.0, 0.04)]
          + [((PCX - 0.16 + 0.012 * k, PCY - 0.01, Z + 0.5205), (0.0016, 0.16, 0.001)) for k in range(31)], M['metal'])
    boxes('pc_top_filter', [((PCX + 0.02, PCY - 0.095, Z + 0.52075), (0.38, 0.008, 0.0015)), ((PCX + 0.02, PCY + 0.075, Z + 0.52075), (0.38, 0.008, 0.0015)),
                            ((PCX - 0.172, PCY - 0.01, Z + 0.52075), (0.008, 0.162, 0.0015)), ((PCX + 0.212, PCY - 0.01, Z + 0.52075), (0.008, 0.162, 0.0015))], M['black'])
    cyl('pc_power', 0.007, 0.004, (X0 + 0.03, PCY + 0.06, Z + 0.522), M['metal'], seg=20)
    rings('pc_power_ring', [((X0 + 0.03, PCY + 0.06, Z + 0.521), 0.0095, 0.0075, 0.002, 'z')], E['rgb_teal'], kind='emit')
    boxes('pc_top_ports', [((X0 + 0.03, PCY + 0.02, Z + 0.5205), (0.006, 0.013, 0.001)), ((X0 + 0.03, PCY + 0.0, Z + 0.5205), (0.006, 0.013, 0.001)),
                           ((X0 + 0.03, PCY - 0.018, Z + 0.5205), (0.003, 0.009, 0.001))], M['black'])
    cyl('pc_top_jack', 0.002, 0.001, (X0 + 0.03, PCY - 0.034, Z + 0.5205), M['black'], seg=12)

    # ---- the motherboard on standoffs off the solid side: its heatsinks round the processor, the I/O shroud, chokes,
    # the RAM slots, M.2 and chipset heatsinks, the empty graphics slot with the riser plugged in, power connectors ----
    B0, B1 = -0.112, -0.11
    bx('pc_board', ext(-0.02, 0.225, B0, B1, 0.135, 0.44), pcb)
    for xx, zz in ((-0.01, 0.43), (-0.01, 0.145), (0.05, 0.43), (0.215, 0.145), (0.215, 0.26)):
        bits.cyl('metal', 0.0032, 0.0012, at(xx, B1 + 0.0006, zz), 'Y', seg=8)
        bits.cyl('metal', 0.003, 0.006, at(xx, -0.115, zz), 'Y', seg=8)
    for name, e in (('pc_vrm_top', ext(0.06, 0.17, B1, -0.085, 0.395, 0.43)), ('pc_vrm_rear', ext(0.145, 0.17, B1, -0.085, 0.29, 0.39)),
                    ('pc_io_shroud', ext(0.175, 0.237, B1, -0.078, 0.29, 0.435)), ('pc_m2', ext(-0.01, 0.1, B1, -0.104, 0.255, 0.267)),
                    ('pc_chipset', ext(0.13, 0.2, B1, -0.098, 0.15, 0.205))):
        bx(name, e, sink, bevel=0.0015 if name == 'pc_m2' else 0.003)
    for k in range(6):
        bits.box('black', ext(0.072 + 0.018 * k, 0.074 + 0.018 * k, -0.085, -0.0844, 0.4, 0.425))
    for k in range(5):
        bits.box('black', ext(0.149, 0.166, -0.085, -0.0844, 0.3 + 0.018 * k, 0.302 + 0.018 * k))
    bits.box('metal', ext(0.18, 0.232, -0.078, -0.0774, 0.428, 0.4295))
    bits.box('metal', ext(-0.004, 0.094, -0.104, -0.1034, 0.2605, 0.2615))
    bits.box('metal', ext(0.155, 0.175, -0.098, -0.0974, 0.168, 0.188))
    for k in range(5):
        bits.box('dark', ext(0.07 + 0.0135 * k, 0.077 + 0.0135 * k, B1, -0.104, 0.381, 0.388))
    add_box(lit['ram1'], *ext(0.2, 0.203, -0.078, -0.0765, 0.3, 0.425))
    # The processor: its retention frame, the pump block with a lit ring, the two ports on its top.
    bits.box('dark', ext(0.07, 0.13, B1, -0.104, 0.31, 0.37))
    cyl('cpu_block_body', 0.034, 0.018, at(0.1, -0.095, 0.34), alu, seg=32, axis='Y')
    rings('cpu_block', [(at(0.1, -0.085, 0.34), 0.033, 0.029, 0.002, 'y')], E['rgb_teal'], kind='emit', seg=36)
    for zz in (0.352, 0.328):
        bits.cyl('metal', 0.0085, 0.012, at(0.1, -0.08, zz), 'Y', seg=16)
    # Four sticks of RAM on their slots, each lit along the edge toward the glass.
    for i in range(4):
        xx = 0.02 + 0.01 * i
        bits.box('black', ext(xx - 0.003, xx + 0.003, B1, -0.102, 0.27, 0.41))
        bx(f'pc_ram{i}', ext(xx - 0.0035, xx + 0.0035, -0.102, -0.064, 0.274, 0.406), sink, bevel=0.001)
        add_box(lit['ram1' if i % 2 else 'ram0'], *ext(xx - 0.0024, xx + 0.0024, -0.064, -0.059, 0.276, 0.404))
    # The empty graphics slot, the riser's plug in it and its ribbon down behind the card.
    bits.box('metal', ext(0.126, 0.215, B1, -0.101, 0.228, 0.242))
    bits.box('black', ext(0.13, 0.211, -0.101, -0.094, 0.23, 0.24))
    bits.box('black', ext(0.13, 0.211, -0.094, 0.04, 0.234, 0.236))
    bits.box('black', ext(0.13, 0.211, 0.038, 0.04, 0.104, 0.234))
    # Power: the 24-pin and the processor's 8-pin, their braided cables out through the tray's rubber grommets.
    bits.box('black', ext(-0.018, -0.006, B1, -0.092, 0.27, 0.322))
    bits.box('black', ext(0.019, 0.039, B1, -0.094, 0.418, 0.436))
    bits.box('black', ext(-0.062, -0.034, -0.118, -0.113, 0.262, 0.33))
    bits.box('black', ext(0.012, 0.046, -0.118, -0.113, 0.45, 0.472))
    cables = bmesh.new()
    # Each cable leaves its plug and meets its grommet square on, so its open ends sit flat on them.
    square = lambda a, b, c, d: [a] + bezier(tuple(Vector(a) + (Vector(b) - Vector(a)).normalized() * 0.004), b, c, tuple(Vector(d) + (Vector(c) - Vector(d)).normalized() * 0.004), n=10) + [d]
    for zz in (0.276, 0.286, 0.296, 0.306, 0.316):
        pipe(cables, square(at(-0.012, -0.092, zz), at(-0.012, -0.065, zz), at(-0.048, -0.065, zz), at(-0.048, -0.113, zz)), 0.0034, seg=6)
    for xx in (0.024, 0.034):
        pipe(cables, square(at(xx, -0.094, 0.427), at(xx, -0.07, 0.427), at(xx, -0.07, 0.461), at(xx, -0.113, 0.461)), 0.003, seg=6)

    # ---- the graphics card, stood up on a riser mount with its fans to the glass: backplate, finned body, shroud
    # round three fans with lit rings, a lit strip and its power cable on top, its bracket at the rear ----
    bx('gpu_backplate', ext(-0.073, 0.223, 0.045, 0.049, 0.127, 0.253), alu)
    bx('gpu', ext(-0.075, 0.225, 0.049, 0.083, 0.125, 0.255), gpu_mat, bevel=0.002)
    sb = bmesh.new()
    cell_plate(sb, lambda u, v, t: at(u, t, v), [(x0, x0 + 0.1, 0.125, 0.255, x0 + 0.05, 0.19, 0.045) for x0 in (-0.075, 0.025, 0.125)], 0.083, 0.095, seg=32)
    link('gpu_shroud', sb, gpu_mat)
    for xc in (-0.025, 0.075, 0.175):
        add_ring(lit['gpu'], at(xc, 0.096, 0.19), 0.049, 0.046, 0.002, 'y', 32)
        rotor(bits.bm['dark'], at(xc, 0.089, 0.19), 'Y', 0.0125, 0.008, 9, 0.042, (0.0035, 0.02), 25, sticker=(bits, 1))
    for zz in (0.127, 0.2525):
        bits.box('metal', ext(-0.07, 0.22, 0.095, 0.0956, zz, zz + 0.0015))
    for k in range(40):
        xx = -0.068 + 0.0072 * k
        if not -0.016 < xx < 0.016:
            bits.box('black', ext(xx, xx + 0.0009, 0.051, 0.067, 0.255, 0.2556))
    bx('gpu1_led', ext(-0.06, 0.15, 0.07, 0.08, 0.255, 0.259), E['rgb_purple'], kind='emit')
    bx('gpu_bracket', ext(0.225, 0.237, 0.043, 0.095, 0.12, 0.26), alu)
    bx('gpu_riser', ext(0.05, 0.2, 0.043, 0.07, 0.104, 0.125), alu, bevel=0.002)
    bits.box('black', ext(-0.012, 0.012, 0.053, 0.067, 0.255, 0.265))
    for xx in (-0.006, 0.0, 0.006):
        pipe(cables, rounded([at(xx, 0.06, 0.265), at(xx, 0.06, 0.282), at(xx, 0.02, 0.282), at(xx, 0.02, 0.106)], 0.012), 0.0024, seg=6)
    link('pc_cables', cables, M['braid'])

    # ---- the power supply's shroud along the floor: vents on its side, grommets on its top ----
    bx('pc_shroud', ext(-0.238, 0.238, -0.118, 0.112, 0.012, 0.104), case, bevel=0.003)
    for k in range(6):
        bits.box('black', ext(-0.2 + 0.02 * k, -0.188 + 0.02 * k, 0.112, 0.1126, 0.03, 0.08))
    bits.box('black', ext(-0.02, 0.02, 0.005, 0.035, 0.104, 0.106))

    # ---- water cooling: a pump with its reservoir on the shroud, the radiator under the roof with three fans, and hard
    # tubes bent round from pump to processor, processor to radiator, radiator back to the reservoir ----
    bx('pc_pump', ext(-0.192, -0.128, -0.002, 0.062, 0.104, 0.138), gpu_mat, bevel=0.003)
    cyl('res_base', 0.031, 0.008, at(-0.16, 0.03, 0.142), alu, seg=32)
    cyl('coolant_res', 0.026, 0.154, at(-0.16, 0.03, 0.223), E['coolant'], seg=32, kind='emit')
    cyl('res_cap', 0.031, 0.014, at(-0.16, 0.03, 0.307), alu, seg=32)
    for dx in (-0.0283, 0.0283):
        bits.cyl('metal', 0.0018, 0.154, at(-0.16 + dx, 0.03, 0.223), seg=8)
    bits.cyl('metal', 0.0085, 0.013, at(-0.16, 0.03, 0.3205), seg=16)
    bits.cyl('metal', 0.0085, 0.012, at(-0.122, 0.03, 0.121), 'X', seg=16)
    bx('radiator', ext(-0.18, 0.18, -0.06, 0.06, 0.476, 0.502), fan_mat, bevel=0.002)
    for s in (-1, 1):
        bx(f'radiator_tank{s}', ext(min(s * 0.18, s * 0.204), max(s * 0.18, s * 0.204), -0.062, 0.062, 0.475, 0.503), fan_mat, bevel=0.002)
        for yy in (-0.045, 0.045):
            bits.cyl('black', 0.003, 0.005, at(s * 0.192, yy, 0.5055), seg=10)
    for yy in (-0.03, 0.03):
        bits.cyl('metal', 0.0085, 0.027, at(0.1925, yy, 0.4615), seg=16)
    for xc in (-0.12, 0.0, 0.12):
        fans.append(('rad', lambda u, v, t: at(u, v, t), 'Z', (xc, 0.0), (0.45, 0.4745), -1))
    loop = bmesh.new()
    for pts in ([at(-0.116, 0.03, 0.121), at(-0.095, 0.03, 0.121), at(-0.095, 0.03, 0.3), at(0.1, 0.03, 0.3), at(0.1, 0.03, 0.328), at(0.1, -0.074, 0.328)],
                [at(0.1, -0.074, 0.352), at(0.1, -0.03, 0.352), at(0.1, -0.03, 0.4), at(0.1925, -0.03, 0.4), at(0.1925, -0.03, 0.448)],
                [at(0.1925, 0.03, 0.448), at(0.1925, 0.03, 0.42), at(-0.16, 0.03, 0.42), at(-0.16, 0.03, 0.327)]):
        pipe(loop, rounded(pts, 0.01), 0.0065, seg=10)
    link('coolant_loop', loop, E['coolant'], 'emit')

    # ---- the case fans: square frames round their blades, each lit ring on the face it shows ----
    for k, (group, f, axis, (cu, cv), (t0, t1), face) in enumerate(fans):
        fm = bmesh.new()
        cell_plate(fm, f, [(cu - 0.06, cu + 0.06, cv - 0.06, cv + 0.06, cu, cv, 0.058)], t0, t1, seg=24)
        link(f'pc_fan{k}', fm, fan_mat)
        ft = t0 - 0.002 if face < 0 else t1
        # The front rings are wider, so they read whole through the perforated steel.
        add_ring(lit[group], f(cu, cv, ft + 0.001), 0.0598, 0.0555 if group == 'front' else 0.0582, 0.002, axis.lower(), 40 if group == 'front' else 24)
        rotor(bits.bm['dark'], f(cu, cv, (t0 + t1) / 2), axis, 0.02, 0.02, 7, 0.054, (0.008, 0.03), 30, sticker=(bits, face if group != 'rear' else 1))
    for k, name, mat in (('front', 'pc_fans_front', 'rgb_teal'), ('rad', 'pc_fans_rad', 'rgb_teal'), ('rear', 'pc_fans_rear', 'rgb_teal'), ('gpu', 'pc_fans_gpu', 'rgb_purple'),
                         ('ram0', 'ram0_led', 'rgb_teal'), ('ram1', 'ram1_led', 'rgb_purple')):
        link(name, lit[k], E[mat], 'emit')

    # ---- the perforated steel: the front's mesh, the rear fan's grille and the power supply's, one see-through sheet
    # whose holes the page draws (world.js) ----
    mb = bmesh.new()
    uv = mb.loops.layers.uv.new('UVMap')
    for x, (y0, y1, z0, z1) in ((-0.2465, (-0.1, 0.1, 0.09, 0.49)), (0.2465, FAN), (0.2445, PSU_GRILLE)):
        q = [(y0, z0), (y1, z0), (y1, z1), (y0, z1)]
        f = mb.faces.new([mb.verts.new(P(at(x, yy, zz))) for yy, zz in (q if x > 0 else q[::-1])])
        for lp, (yy, zz) in zip(f.loops, q if x > 0 else q[::-1]):
            lp[uv].uv = (yy / 0.0025, zz / 0.0025)
    grille = link('pc_mesh', mb, mesh_mat, 'glass')
    # Thin flat glass and open mesh bend no light: the bake sees straight through them to the parts inside.
    for o in (glass, grille):
        o.visible_diffuse = o.visible_glossy = o.visible_transmission = o.visible_shadow = o.visible_volume_scatter = False
    bits.done()

    # The inside of the case, lit by its own lights: the page keeps them on when the room's lamps go off (lightswitch.js).
    point('pc_inside_lo', at(-0.2385, -0.1185, 0.0115))
    point('pc_inside_hi', at(0.2385, 0.1275, 0.5085))
    # The light the case's hidden strip under the roof casts on the parts inside, for the bake only.
    area('L_pc_case', 2.0, (0.42, 0.012), at(0.0, 0.1, 0.495), (math.radians(-35), 0, 0), (0.85, 0.9, 1.0))
