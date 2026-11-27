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


# ---------- the PC case on the return: front mesh, glass side, top I/O, rear I/O, and a full build inside ----------
def pc(M, E, G, PCX, PCY, DZ):
    X0, X1, Y0, Y1 = PCX - 0.25, PCX + 0.25, PCY - 0.13, PCY + 0.13
    # Everything inside is dark, so the coolant's glow reads against it (shown darker after the bake, blender/lib/core.py).
    inside = principled('pc_inside', (0.02, 0.022, 0.026), 0.6)
    Z = DZ + 0.012
    shell = M['black']
    # Rubber feet lift the case 1.2 cm.
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl(f'pc_foot{sx}{sy}', 0.014, 0.012, (PCX + sx * 0.2, PCY + sy * 0.095, DZ + 0.006), M['black'], seg=16)
    # Panels meet at edges, never sharing a face: the solid side, floor and roof between the front and rear frames.
    box('pc_back', (0.476, 0.012, 0.496), (PCX, Y0 + 0.006, Z + 0.26), shell, bevel=0.004)
    box('pc_floor', (0.476, 0.26, 0.012), (PCX, PCY, Z + 0.006), shell, bevel=0.004)
    box('pc_roof', (0.476, 0.26, 0.012), (PCX, PCY, Z + 0.514), shell, bevel=0.004)
    # The front: a frame round a mesh, three lit fans behind it.
    fx = X0 + 0.006
    boxes('pc_front_frame', [((fx, PCY, Z + 0.025), (0.012, 0.26, 0.05)), ((fx, PCY, Z + 0.505), (0.012, 0.26, 0.03)),
                             ((fx, Y0 + 0.02, Z + 0.27), (0.012, 0.04, 0.44)), ((fx, Y1 - 0.02, Z + 0.27), (0.012, 0.04, 0.44))], shell)
    bars = [((X0 + 0.004, PCY, Z + 0.05 + 0.012 * k), (0.002, 0.18, 0.0018)) for k in range(37)]
    bars += [((X0 + 0.0055, Y0 + 0.04 + 0.012 * k, Z + 0.27), (0.002, 0.0018, 0.44)) for k in range(16)]
    boxes('pc_front_mesh', bars, M['metal'])
    for i in range(3):
        fan(f'pc_front_fan{i}', (X0 + 0.03, PCY, Z + 0.17 + i * 0.12), 'x', 0.058, M, E, ring=f'fan{i}', dark=inside)
    # A small logo of my own under the mesh: BH-22 in light pixels.
    glyph = {'B': ['110', '101', '110', '101', '110'], 'H': ['101', '101', '111', '101', '101'], '-': ['000', '000', '111', '000', '000'], '2': ['111', '001', '111', '100', '111']}
    px, cells, y = 0.0022, [], PCY + 0.035
    for ch in 'BH-22':
        for row, line in enumerate(glyph[ch]):
            for col, on in enumerate(line):
                if on == '1':
                    cells.append(((X0 - 0.0006, y - col * px, Z + 0.035 - row * px), (0.0012, px * 0.9, px * 0.9)))
        y -= 4 * px
    boxes('pc_logo', cells, M['white'])
    # The rear: a solid panel carrying the I/O plate and its ports, the slot covers, the PSU's vent and switch, and the
    # grille of the rear fan inside.
    box('pc_rear', (0.012, 0.26, 0.52), (X1 - 0.006, PCY, Z + 0.26), shell, bevel=0.004)
    boxes('pc_rear_io', [((X1 + 0.0005, Y0 + 0.07, Z + 0.43), (0.003, 0.06, 0.12))], M['metal'])
    boxes('pc_rear_ports', [((X1 + 0.002, Y0 + 0.07 + dy, Z + 0.39 + dz), (0.0024, 0.012, 0.006)) for dy in (-0.015, 0.0, 0.015) for dz in (0.0, 0.012, 0.024, 0.06)], M['black'])
    boxes('pc_slots', [((X1 + 0.0005, Y0 + 0.07, Z + 0.135 + 0.022 * k), (0.003, 0.06, 0.016)) for k in range(7)], M['metal'])
    boxes('pc_psu_vent', [((X1 + 0.0007, Y0 + 0.13, Z + 0.025 + 0.009 * k), (0.0014, 0.1, 0.0035)) for k in range(8)], M['metal'])
    boxes('pc_psu_switch', [((X1 + 0.002, Y1 - 0.03, Z + 0.06), (0.004, 0.014, 0.01))], M['black'])
    fan('pc_rear_fan', (X1 - 0.03, Y0 + 0.17, Z + 0.4), 'x', 0.052, M, E, ring='fan3', face=1, dark=inside)
    boxes('pc_rear_grille', [((X1 + 0.0004, Y0 + 0.17, Z + 0.352 + 0.012 * k), (0.0012, 0.1, 0.0016)) for k in range(9)], M['metal'])
    # Screws on the rear frame and the glass's thumbscrews.
    for dy, dz in ((0.02, 0.02), (0.24, 0.02), (0.02, 0.5), (0.24, 0.5)):
        cyl(f'pc_screw{dy}{dz}', 0.003, 0.002, (X1 + 0.001, Y0 + dy, Z + dz), M['metal'], seg=10, axis='X')
    # The glass side: glass, a thin black trim round it and four thumbscrews.
    gy = Y1 - 0.001
    boxes('pc_glass_trim', [((PCX, gy, Z + 0.016), (0.48, 0.004, 0.008)), ((PCX, gy, Z + 0.504), (0.48, 0.004, 0.008)),
                            ((X0 + 0.016, gy, Z + 0.26), (0.008, 0.004, 0.48)), ((X1 - 0.016, gy, Z + 0.26), (0.008, 0.004, 0.48))], M['black'])
    for sx in (-1, 1):
        for sz in (-1, 1):
            cyl(f'pc_thumbscrew{sx}{sz}', 0.006, 0.006, (PCX + sx * 0.22, Y1 + 0.003, Z + 0.26 + sz * 0.22), M['metal'], seg=16, axis='Y')
    plane('pc_glass', 0.46, 0.47, (PCX, Y1 - 0.003, Z + 0.26), G['glass'], '+Y', kind='glass')
    # The top: a mesh over the radiator with its dust filter's frame, and the front I/O.
    boxes('pc_top_mesh', [((PCX + 0.02, PCY - 0.01 + dy, Z + 0.52085), (0.36, 0.0016, 0.0011)) for dy in (-0.04, 0.0, 0.04)]
          + [((PCX - 0.16 + 0.012 * k, PCY - 0.01, Z + 0.5205), (0.0016, 0.16, 0.001)) for k in range(31)], M['metal'])
    # The dust filter's frame round the mesh, a little higher than its bars.
    boxes('pc_top_filter', [((PCX + 0.02, PCY - 0.095, Z + 0.52075), (0.38, 0.008, 0.0015)), ((PCX + 0.02, PCY + 0.075, Z + 0.52075), (0.38, 0.008, 0.0015)),
                            ((PCX - 0.172, PCY - 0.01, Z + 0.52075), (0.008, 0.162, 0.0015)), ((PCX + 0.212, PCY - 0.01, Z + 0.52075), (0.008, 0.162, 0.0015))], M['black'])
    cyl('pc_power', 0.007, 0.004, (X0 + 0.03, PCY + 0.06, Z + 0.522), M['metal'], seg=20)
    rings('pc_power_ring', [((X0 + 0.03, PCY + 0.06, Z + 0.5215), 0.0095, 0.0075, 0.002, 'z')], E['rgb_teal'], kind='emit')
    boxes('pc_top_ports', [((X0 + 0.03, PCY + 0.02, Z + 0.5205), (0.006, 0.013, 0.001)), ((X0 + 0.03, PCY + 0.0, Z + 0.5205), (0.006, 0.013, 0.001)),
                           ((X0 + 0.03, PCY - 0.018, Z + 0.5205), (0.003, 0.009, 0.001))], M['black'])
    cyl('pc_top_jack', 0.002, 0.001, (X0 + 0.03, PCY - 0.034, Z + 0.5205), M['black'], seg=12)
    # Inside: the motherboard on the solid side, its heatsinks, I/O shroud, standoffs, chipset and M.2 covers.
    by = Y0 + 0.017
    box('pc_board', (0.40, 0.006, 0.42), (PCX + 0.03, by, Z + 0.29), inside)
    boxes('pc_board_bits', [((PCX + 0.12, by + 0.012, Z + 0.465), (0.06, 0.018, 0.08)),      # I/O shroud
                            ((PCX - 0.01, by + 0.009, Z + 0.46), (0.11, 0.012, 0.03)),     # VRM heatsink, top
                            ((PCX - 0.08, by + 0.009, Z + 0.39), (0.03, 0.012, 0.1)),      # VRM heatsink, left
                            ((PCX + 0.06, by + 0.005, Z + 0.17), (0.07, 0.004, 0.05)),      # chipset cover
                            ((PCX - 0.02, by + 0.005, Z + 0.25), (0.12, 0.004, 0.025))], M['metal'])
    for k, (dx, dz) in enumerate(((-0.15, 0.1), (0.2, 0.1), (-0.15, 0.48), (0.2, 0.48), (0.03, 0.1), (0.03, 0.48))):
        cyl(f'pc_standoff{k}', 0.003, 0.004, (PCX + dx, by + 0.004, Z + dz), M['metal'], seg=10, axis='Y')
    # The CPU's pump block, keeping its teal coolant glow, and the RAM, lit along their tops.
    cyl('cpu_block', 0.035, 0.02, (PCX + 0.06, by + 0.013, Z + 0.37), E['rgb_teal'], axis='Y', kind='emit')
    rings('cpu_block_trim', [((PCX + 0.06, by + 0.024, Z + 0.37), 0.037, 0.03, 0.003, 'y')], M['metal'])
    boxes('ram', [((PCX + 0.12 + i * 0.011, by + 0.02, Z + 0.35), (0.007, 0.03, 0.12)) for i in range(4)], inside)
    for i in range(4):
        box(f'ram{i}_led', (0.006, 0.026, 0.007), (PCX + 0.12 + i * 0.011, by + 0.02, Z + 0.4135), E['rgb_purple'] if i % 2 else E['rgb_teal'], kind='emit')
    # The graphics card stood up on a vertical mount, its three fans facing the glass, a lit strip along its top edge.
    gx, gy, gc = PCX - 0.03, PCY + 0.035, Z + 0.24
    box('gpu', (0.30, 0.045, 0.13), (gx, gy, gc), inside, bevel=0.006)
    box('gpu_backplate', (0.29, 0.004, 0.12), (gx, gy - 0.0244, gc), M['metal'])
    box('gpu1_led', (0.26, 0.006, 0.004), (gx, gy, gc + 0.066), E['rgb_purple'], kind='emit')
    box('gpu_mount', (0.32, 0.03, 0.01), (gx, gy - 0.01, gc - 0.07), M['metal'])
    for i in range(3):
        fan(f'gpu_fan{i}', (gx - 0.1 + i * 0.1, gy + 0.0305, gc), 'y', 0.042, M, E, face=1, dark=inside)
    # Water cooling: the reservoir, the radiator under the roof with three lit fans, hard tubes round the loop.
    cyl('coolant_res', 0.032, 0.168, (PCX + 0.19, PCY + 0.05, Z + 0.199), E['rgb_teal'], seg=20, kind='emit')
    cyl('res_cap', 0.034, 0.012, (PCX + 0.19, PCY + 0.05, Z + 0.29), M['metal'], seg=20)
    cyl('res_base', 0.034, 0.012, (PCX + 0.19, PCY + 0.05, Z + 0.109), M['metal'], seg=20)
    box('radiator', (0.4, 0.12, 0.028), (PCX - 0.01, PCY - 0.02, Z + 0.48), inside, bevel=0.004)
    for i in range(3):
        fan(f'pc_rad_fan{i}', (PCX - 0.14 + i * 0.13, PCY - 0.02, Z + 0.458), 'z', 0.052, M, E, ring=f'rad_fan{i}', dark=inside)
    for i, pts in enumerate((
        [(0.19, 0.05, 0.296), (0.19, 0.05, 0.43), (0.06, -0.05, 0.43), (0.06, -0.096, 0.43), (0.06, -0.096, 0.385)],
        [(0.06, -0.1, 0.355), (0.0, -0.1, 0.355), (0.0, -0.06, 0.355), (0.0, -0.06, 0.466)],
        [(-0.2, -0.02, 0.466), (-0.2, 0.05, 0.44), (-0.2, 0.05, 0.12), (0.19, 0.05, 0.12), (0.19, 0.05, 0.103)],
    )):
        tube(f'coolant_pipe{i}', [(PCX + x, PCY + y, Z + z) for x, y, z in pts], 0.006, E['rgb_teal'], seg=8, kind='emit')
    # The power supply's shroud along the floor, its cables in braided sleeves up to the board and the card.
    box('pc_shroud', (0.476, 0.23, 0.09), (PCX, PCY - 0.003, Z + 0.057), inside, bevel=0.003)
    boxes('pc_shroud_vents', [((PCX - 0.1 + 0.02 * k, PCY + 0.1125, Z + 0.07), (0.01, 0.002, 0.03)) for k in range(6)], M['metal'])
    tube('pc_cable_24pin', bezier((PCX + 0.21, by + 0.02, Z + 0.09), (PCX + 0.215, by + 0.05, Z + 0.15), (PCX + 0.215, by + 0.03, Z + 0.25), (PCX + 0.2, by + 0.005, Z + 0.3)), 0.008, M['braid'], seg=10)
    tube('pc_cable_gpu', bezier((gx + 0.138, gy - 0.035, Z + 0.1), (gx + 0.138, gy - 0.035, gc + 0.1), (gx + 0.138, gy, gc + 0.1), (gx + 0.138, gy, gc + 0.063)), 0.005, M['braid'], seg=10)
    tube('pc_cable_cpu', bezier((PCX - 0.22, by + 0.02, Z + 0.1), (PCX - 0.23, by + 0.03, Z + 0.3), (PCX - 0.2, by + 0.02, Z + 0.47), (PCX - 0.15, by + 0.005, Z + 0.48)), 0.005, M['braid'], seg=10)
