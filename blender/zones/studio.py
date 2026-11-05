"""The raised studio: the L-shaped battlestation on the east wall, the racing chair, the rack and 3D printer, the glass
board and STAY CURIOUS poster, acoustic panels, the arcade cabinet and the GPU rig."""
import math, random
import bmesh
from mathutils import Vector, Matrix
from lib.core import (zone, box, cyl, sphere, plane, tube, bezier, prism, link, collider, point, screen, interact, char_light,
                      area, lamp, potted, principled, seat, rug, wallspot, at, P, L, META)
from zones.layout import STUDIO_Z, W, STUDIO

Z0 = STUDIO_Z
DZ = Z0 + 0.76                     # desk top
DX0, DX1, DY0, DY1 = 15.15, 15.95, 1.0, 3.4   # main run along the east wall
RX0, RY0, RY1 = 13.95, 1.0, 1.6     # the return on the right (south) end
MW, MH, MR = 1.07, 0.45, 1.6        # 45 inch ultrawide, curved
MC = Vector((15.58, 2.2, DZ + 0.41))
CHAIR = Vector((14.45, 2.2, Z0))
# The battlestation is written against an east wall at x 16 and moved onto the real one with at().
EW = 16.0
DESK_AT = (W - EW, 0.8, 0.0)


def curved_screen(M, E):
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    cols, ang = 24, MW / MR
    grid = []
    for i in range(cols + 1):
        a = -ang / 2 + ang * i / cols
        y, x = MC.y + MR * math.sin(a), MC.x - MR * (1 - math.cos(a))
        grid.append([bm.verts.new(P((x, y, MC.z - MH / 2))), bm.verts.new(P((x, y, MC.z + MH / 2)))])
    for i in range(cols):
        f = bm.faces.new((grid[i + 1][0], grid[i][0], grid[i][1], grid[i + 1][1]))
        u0, u1 = 1 - (i + 1) / cols, 1 - i / cols
        for lp, t in zip(f.loops, ((u0, 0), (u1, 0), (u1, 1), (u0, 1))):
            lp[uv].uv = t
    link('screen_main', bm, E['screen'], 'emit')
    # The monitor's body follows the curve: a thin shell with a bezel lip, built column by column.
    bm = bmesh.new()
    rows = []
    for i in range(cols + 1):
        a = -(ang * 1.025) / 2 + ang * 1.025 * i / cols
        y, x = MC.y + MR * math.sin(a), MC.x - MR * (1 - math.cos(a))
        zb, zt = MC.z - MH / 2 - 0.014, MC.z + MH / 2 + 0.014
        rows.append([bm.verts.new(P((x + 0.002, y, zb))), bm.verts.new(P((x + 0.002, y, zt))), bm.verts.new(P((x + 0.04, y, zt))), bm.verts.new(P((x + 0.04, y, zb)))])
    for i in range(cols):
        for k in range(4):
            bm.faces.new((rows[i][k], rows[i + 1][k], rows[i + 1][(k + 1) % 4], rows[i][(k + 1) % 4]))
    for side in (rows[0], rows[-1][::-1]):
        bm.faces.new(side)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    link('monitor_back', bm, M['black'])
    screen('main', MC, MW, MH, r=MR)


def flat_monitor(name, M, E, c, w, h, yaw=0.0, tilt=0.0):
    # A thin monitor facing -x turned by yaw, with its screen as a runtime canvas.
    o = plane(f'screen_{name}', w, h, c, E['screen'], '-X', yaw=math.radians(yaw))
    back = box(f'{name}_back', (0.03, w + 0.03, h + 0.03), (0, 0, 0), M['black'], bevel=0.008)
    for v in back.data.vertices:
        v.co = (Matrix.Translation(P(c)) @ Matrix.Rotation(math.radians(yaw), 4, 'Z') @ Matrix.Translation((0.018, 0, 0)) @ (v.co - P((0, 0, 0))).to_4d()).to_3d()
    if tilt:
        piv = P(c)
        R = Matrix.Rotation(math.radians(tilt), 3, Matrix.Rotation(math.radians(yaw), 3, 'Z') @ Vector((0, 1, 0)))
        for ob in (o, back):
            for v in ob.data.vertices:
                v.co = piv + R @ (v.co - piv)
    screen(name, c, w, h, yaw=yaw)
    return o


def build(M, E, G):
    M['rm_white'] = principled('rm_white', (0.86, 0.86, 0.84), 0.5)
    M['rm_gold'] = principled('rm_gold', (0.72, 0.52, 0.16), 0.35, 0.4)
    M['rm_purple'] = principled('rm_purple', (0.22, 0.08, 0.42), 0.5)
    with zone('studio', px=4096):
        with at(DESK_AT):
            # ---------- the L desk ----------
            box('desk_top', (DX1 - DX0, DY1 - DY0, 0.04), ((DX0 + DX1) / 2, (DY0 + DY1) / 2, DZ - 0.02), M['walnut'], bevel=0.008)
            box('desk_return', (DX0 - RX0, RY1 - RY0, 0.04), ((RX0 + DX0) / 2, (RY0 + RY1) / 2, DZ - 0.02), M['walnut'], bevel=0.008)
            for nm, (x, y) in {'a': (DX0 + 0.06, DY1 - 0.06), 'b': (DX1 - 0.06, DY1 - 0.06), 'c': (RX0 + 0.06, RY0 + 0.06), 'd': (RX0 + 0.06, RY1 - 0.06), 'e': (DX1 - 0.06, DY0 + 0.06)}.items():
                box(f'desk_leg_{nm}', (0.06, 0.06, DZ - Z0 - 0.04), (x, y, (DZ + Z0 - 0.04) / 2), M['black'], bevel=0.008)
            box('desk_beam', (0.05, DY1 - DY0 - 0.2, 0.06), (DX1 - 0.15, (DY0 + DY1) / 2, Z0 + 0.5), M['metal'])
            box('desk_underglow', (0.02, DY1 - DY0 - 0.2, 0.012), (DX0 + 0.03, (DY0 + DY1) / 2, DZ - 0.05), E['rgb_purple'], kind='emit')
            box('return_underglow', (DX0 - RX0 - 0.1, 0.02, 0.012), ((RX0 + DX0) / 2, RY1 - 0.03, DZ - 0.05), E['rgb_purple'], kind='emit')
            collider('desk', (DX0, DY0, Z0 - 1), (EW, DY1, DZ))
            collider('desk_return', (RX0, RY0, Z0 - 1), (DX0, RY1, DZ))

            # ---------- screens: the ultrawide, the 27 inch above it, the vertical code screen, three little ones ----------
            curved_screen(M, E)
            box('monitor_arm', (0.05, 0.05, 0.42), (15.78, MC.y, DZ + 0.21), M['metal'], bevel=0.01)
            box('monitor_arm2', (0.16, 0.04, 0.04), (15.72, MC.y, MC.z - 0.05), M['metal'], bevel=0.01)
            box('monitor_arm3', (0.04, 0.04, 0.5), (15.78, MC.y, MC.z + 0.35), M['metal'], bevel=0.01)
            top_c = (15.6, MC.y, MC.z + MH / 2 + 0.22)
            flat_monitor('top', M, E, top_c, 0.6, 0.34, tilt=-8)
            flat_monitor('code', M, E, (15.52, 3.16, DZ + 0.44), 0.34, 0.6, yaw=28)
            box('vmon_stand', (0.04, 0.04, 0.3), (15.6, 3.2, DZ + 0.15), M['metal'])
            cyl('vmon_base', 0.11, 0.015, (15.6, 3.2, DZ + 0.008), M['metal'])
            for y, nm in ((1.78, 'contrib'), (2.2, 'loss'), (2.62, 'pishi')):
                box(f'mini_case_{nm}', (0.05, 0.18, 0.115), (15.41, y, DZ + 0.075), M['black'], bevel=0.008)
                plane(f'screen_{nm}', 0.16, 0.095, (15.384, y, DZ + 0.078), E['screen'], '-X')
                screen(nm, (15.384, y, DZ + 0.078), 0.16, 0.095)
            # Light bar on the ultrawide, bias light behind it.
            box('lightbar', (0.035, 0.46, 0.022), (MC.x - 0.03, MC.y, MC.z + MH / 2 + 0.03), M['metal'], bevel=0.006)
            box('lightbar_glow', (0.012, 0.42, 0.004), (MC.x - 0.045, MC.y, MC.z + MH / 2 + 0.018), E['warm_soft'], kind='emit')
            box('bias_glow', (0.008, 1.0, 0.012), (MC.x + 0.07, MC.y, MC.z - 0.05), E['bias'], kind='emit')
            # The post-it on the bottom bezel, bottom right: glue strip on the plastic, peeling forward a little.
            a = math.asin((MC.y - MW / 2 + 0.11 - MC.y) / MR)
            top = Vector((MC.x - MR * (1 - math.cos(a)), MC.y + MR * math.sin(a), MC.z - MH / 2 - 0.005))
            note = plane('postit', 0.085, 0.085, (0, 0, 0), principled('postit', (0.98, 0.86, 0.32), 0.9), '-X')
            toward, along = Vector((-math.cos(a), -math.sin(a), 0)), Vector((-math.sin(a), math.cos(a), 0))
            R = Matrix.Rotation(math.radians(7), 3, along) @ Matrix.Rotation(math.radians(-2.5), 3, toward) @ Matrix.Rotation(a, 3, 'Z')
            base = P((0, 0, 0))
            for v in note.data.vertices:
                v.co = P(top) + toward * 0.0035 + R @ (v.co - base - Vector((0, 0, 0.0425)))
            point('postit', top - Vector((0, 0, 0.04)))

            # ---------- keyboard, mouse, desk mat, wrist rest, the pomegranate keycap, a coiled cable ----------
            kb = Vector((15.33, MC.y, DZ + 0.018))
            box('kb_case', (0.15, 0.44, 0.022), kb, M['plastic'], bevel=0.006)
            bm = bmesh.new()
            for r in range(5):
                for c in range(15):
                    g = bmesh.ops.create_cube(bm, size=1.0)
                    bmesh.ops.scale(bm, vec=Vector((0.022, 0.024, 0.012)), verts=g['verts'])
                    bmesh.ops.translate(bm, vec=P(kb + Vector((-0.055 + r * 0.027, -0.196 + c * 0.028, 0.016))), verts=g['verts'])
            link('keycaps', bm, M['keycap'])
            box('kb_glow', (0.152, 0.442, 0.004), kb + Vector((0, 0, -0.012)), E['rgb_teal'], kind='emit')
            sphere('pom_key', 0.012, kb + Vector((-0.055, -0.196 + 14 * 0.028, 0.03)), M['pom'], sub=2, scale=(1, 1, 0.8))
            box('wrist_rest', (0.07, 0.44, 0.016), (kb.x - 0.115, kb.y, DZ + 0.012), M['leather'], bevel=0.008, seg=3)
            box('mouse', (0.11, 0.065, 0.035), (15.35, 2.68, DZ + 0.018), M['plastic'], bevel=0.016, seg=4)
            coil = []
            for i in range(160):
                t = i / 159
                p = Vector((kb.x + 0.08 + t * 0.32, kb.y + 0.12 - t * 0.12, DZ + 0.012 + t * 0.03))
                if 0.15 < t < 0.6:
                    p += Vector((0, math.cos(t * 70) * 0.008, math.sin(t * 70) * 0.008))
                coil.append(tuple(p))
            tube('kb_cable', coil, 0.0025, M['braid'], 6)
            bm = bmesh.new()
            uvl = bm.loops.layers.uv.new('UVMap')
            mx, my, hd, hw = 15.43, MC.y, 0.225, 0.56
            vs = [bm.verts.new(P(v)) for v in ((mx - hd, my + hw, DZ + 0.004), (mx - hd, my - hw, DZ + 0.004), (mx + hd, my - hw, DZ + 0.004), (mx + hd, my + hw, DZ + 0.004))]
            f = bm.faces.new(vs)
            for lp, uv in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
                lp[uvl].uv = uv
            link('desk_mat', bm, M['felt'], 'emit')
            screen('mat', (mx, my, DZ + 0.004), hw * 2, hd * 2)

            # ---------- stream deck, DEPLOY, mic boom, ON AIR ----------
            box('streamdeck', (0.09, 0.12, 0.03), (15.33, 1.74, DZ + 0.02), M['black'], bevel=0.006)
            for r in range(3):
                for c in range(5):
                    box(f'sd_key{r}{c}', (0.018, 0.018, 0.006), (15.305 + r * 0.025, 1.69 + c * 0.024, DZ + 0.037), E['rgb_teal'] if (r + c) % 3 else E['rgb_purple'], kind='emit')
            cyl('deploy_base', 0.045, 0.02, (15.36, 2.9, DZ + 0.01), M['black'])
            sphere('deploy_btn', 0.035, (15.36, 2.9, DZ + 0.022), E['onair'], kind='emit', scale=(1, 1, 0.55))
            point('deploy', (15.36, 2.9, DZ + 0.03))
            MIC = Vector((15.4, 2.98, DZ + 0.22))
            cyl('mic_clamp', 0.02, 0.08, (15.88, 3.3, DZ + 0.04), M['metal'])
            tube('mic_arm', [(15.88, 3.3, DZ + 0.08), (15.8, 3.22, DZ + 0.5), (15.55, 3.08, DZ + 0.42), (MIC.x + 0.04, MIC.y, MIC.z + 0.05)], 0.012, M['metal'])
            cyl('mic', 0.028, 0.15, MIC, M['black'])
            for dz in (-0.04, 0.04):
                tube(f'shock{dz:+.2f}', [(MIC.x + math.cos(2 * math.pi * k / 24) * 0.045, MIC.y + math.sin(2 * math.pi * k / 24) * 0.045, MIC.z + dz) for k in range(25)], 0.003, M['metal'])
            tube('pop_ring', [(MIC.x - 0.12, MIC.y + math.cos(2 * math.pi * k / 32) * 0.062, MIC.z + 0.02 + math.sin(2 * math.pi * k / 32) * 0.062) for k in range(33)], 0.004, M['black'])
            cyl('pop_filter', 0.06, 0.004, (MIC.x - 0.12, MIC.y, MIC.z + 0.02), M['cone'], axis='X', seg=32)
            box('onair_box', (0.03, 0.3, 0.09), (EW - 0.02, MC.y, 2.62), M['black'], bevel=0.006)
            plane('onair', 0.27, 0.065, (EW - 0.04, MC.y, 2.62), E['onair'], '-X')

            # ---------- the maxed PC behind glass on the return, facing the room ----------
            PCX, PCY = 14.28, 1.3
            box('pc_case', (0.5, 0.26, 0.52), (PCX, PCY, DZ + 0.26), M['black'], bevel=0.01)
            box('pc_board', (0.42, 0.01, 0.44), (PCX, PCY - 0.11, DZ + 0.27), M['plastic'])
            for i, z in enumerate((0.2, 0.33)):
                box(f'gpu{i + 1}', (0.34, 0.05, 0.1), (PCX - 0.02, PCY - 0.05, DZ + z), M['metal'], bevel=0.006)
                box(f'gpu{i + 1}_led', (0.32, 0.004, 0.012), (PCX - 0.02, PCY - 0.022, DZ + z), E['rgb_purple'], kind='emit')
            for i in range(3):
                bm = bmesh.new()
                bmesh.ops.create_circle(bm, cap_ends=False, segments=24, radius=0.055)
                bmesh.ops.rotate(bm, cent=Vector(), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'), verts=bm.verts)
                rr = bmesh.ops.extrude_edge_only(bm, edges=bm.edges[:])
                for g in rr['geom']:
                    if isinstance(g, bmesh.types.BMVert):
                        g.co *= 0.82
                bmesh.ops.translate(bm, vec=P((PCX - 0.245, PCY, DZ + 0.12 + i * 0.13)), verts=bm.verts)
                link(f'fan{i}', bm, E['rgb_teal'], 'emit')
            cyl('coolant_tube', 0.009, 0.36, (PCX + 0.1, PCY - 0.03, DZ + 0.27), E['rgb_teal'], seg=10, kind='emit')
            cyl('cpu_block', 0.035, 0.02, (PCX + 0.06, PCY - 0.09, DZ + 0.37), E['rgb_teal'], axis='Y', kind='emit')
            for i in range(4):
                box(f'ram{i}', (0.006, 0.004, 0.05), (PCX + 0.12 + i * 0.012, PCY - 0.09, DZ + 0.41), M['black'])
                box(f'ram{i}_led', (0.006, 0.0045, 0.006), (PCX + 0.12 + i * 0.012, PCY - 0.09, DZ + 0.438), E['rgb_purple'] if i % 2 else E['rgb_teal'], kind='emit')
            plane('pc_glass', 0.48, 0.5, (PCX, PCY + 0.131, DZ + 0.26), G['glass'], '+Y', kind='glass')

            # ---------- the laptop, open on a stand, with its dock ----------
            LX, LY = 14.85, 1.3
            box('laptop_stand', (0.26, 0.2, 0.012), (LX, LY, DZ + 0.06), M['steel'], tilt=(math.radians(-14), 0, 0))
            box('laptop_stand_leg', (0.2, 0.012, 0.11), (LX, LY - 0.09, DZ + 0.055), M['steel'])
            box('laptop_base', (0.31, 0.22, 0.014), (LX, LY, DZ + 0.088), M['metal'], bevel=0.004, tilt=(math.radians(-14), 0, 0))
            lid_c = (LX, LY - 0.13, DZ + 0.2)
            box('laptop_lid', (0.31, 0.01, 0.21), lid_c, M['metal'], bevel=0.004, tilt=(math.radians(8), 0, 0))
            plane('screen_laptop', 0.28, 0.18, (LX, LY - 0.122, DZ + 0.2), E['screen'], '+Y')
            screen('laptop', (LX, LY - 0.122, DZ + 0.2), 0.28, 0.18)
            for i, c in enumerate(('red', 'gold', 'book2', 'leaf2')):
                box(f'sticker{i}', (0.05, 0.001, 0.05), (LX - 0.08 + (i % 2) * 0.1, LY - 0.14, DZ + 0.16 + (i // 2) * 0.07), M[c])
            box('dock', (0.06, 0.16, 0.025), (LX + 0.22, LY + 0.05, DZ + 0.013), M['black'], bevel=0.005)
            box('dock_led', (0.003, 0.02, 0.004), (LX + 0.19, LY + 0.1, DZ + 0.022), E['led_blue'], kind='emit')
            tube('dock_cable', bezier((LX + 0.2, LY + 0.0, DZ + 0.015), (LX + 0.17, LY - 0.05, DZ + 0.015), (LX + 0.14, LY - 0.05, DZ + 0.06), (LX + 0.155, LY - 0.02, DZ + 0.09)), 0.003, M['braid'])

            # ---------- speakers, subwoofer, cable tray ----------
            for nm, sy in (('l', 2.92), ('r', 1.45)):
                box(f'speaker_{nm}', (0.13, 0.1, 0.18), (15.85, sy, DZ + 0.09), M['speaker'], bevel=0.007)
                cyl(f'speaker_{nm}_woofer', 0.034, 0.006, (15.783, sy, DZ + 0.065), M['cone'], axis='X', seg=24)
                cyl(f'speaker_{nm}_tweeter', 0.012, 0.006, (15.783, sy, DZ + 0.14), M['cone'], axis='X', seg=16)
            box('subwoofer', (0.32, 0.32, 0.32), (15.6, 1.4, Z0 + 0.16), M['speaker'], bevel=0.012)
            cyl('subwoofer_cone', 0.11, 0.008, (15.44, 1.4, Z0 + 0.16), M['cone'], axis='X', seg=28)
            box('cable_tray', (0.12, 1.8, 0.05), (DX1 - 0.12, 2.2, DZ - 0.12), M['metal'])
            for i, (sy, ex) in enumerate(((2.2, 2.0), (2.92, 2.6), (1.45, 1.7), (3.16, 2.9))):
                tube(f'cable{i}', bezier((DX1 - 0.06, sy, DZ + 0.02), (DX1 - 0.02, sy, DZ - 0.05), (DX1 - 0.1, ex, DZ - 0.05), (DX1 - 0.12, ex, DZ - 0.1)), 0.005, M['braid'])
            tube('cable_floor', bezier((DX1 - 0.12, 1.4, DZ - 0.12), (DX1 - 0.1, 1.2, Z0 + 0.3), (DX1 - 0.05, 1.1, Z0 + 0.05), (DX1 - 0.03, 1.0, Z0 + 0.01)), 0.008, M['braid'])

            # ---------- the small things: headset, tea, succulent, notebook, phone on its charger, pomodoro, fan ----------
            cyl('hs_base', 0.06, 0.012, (15.72, 1.14, DZ + 0.006), M['metal'])
            cyl('hs_pole', 0.008, 0.26, (15.72, 1.14, DZ + 0.13), M['metal'])
            bm = bmesh.new()
            bmesh.ops.create_circle(bm, cap_ends=False, segments=20, radius=0.085)
            bmesh.ops.rotate(bm, cent=Vector(), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'), verts=bm.verts)
            bmesh.ops.translate(bm, vec=P((15.72, 1.14, DZ + 0.22)), verts=bm.verts)
            geom = bmesh.ops.extrude_edge_only(bm, edges=bm.edges[:])
            bmesh.ops.translate(bm, vec=Vector((0.03, 0, 0)), verts=[g for g in geom['geom'] if isinstance(g, bmesh.types.BMVert)])
            link('headset_band', bm, M['black'])
            for s in (-1, 1):
                cyl(f'hs_cup{s}', 0.045, 0.03, (15.72, 1.14 + s * 0.085, DZ + 0.16), M['black'], axis='Y')
            TEA = (15.28, 1.52, DZ)
            cyl('saucer', 0.05, 0.006, (TEA[0], TEA[1], DZ + 0.003), M['clockface'])
            cyl('estekan', 0.022, 0.07, (TEA[0], TEA[1], DZ + 0.04), G['teaglass'], seg=16, kind='glass', r2=0.026)
            cyl('tea', 0.02, 0.055, (TEA[0], TEA[1], DZ + 0.033), M['tea'], seg=16, r2=0.024)
            point('tea', (TEA[0], TEA[1], DZ + 0.08))
            cyl('succ_pot', 0.045, 0.07, (15.86, 1.08, DZ + 0.035), M['pot'], r2=0.055)
            cyl('succ_soil', 0.05, 0.005, (15.86, 1.08, DZ + 0.068), M['soil'])
            for i in range(14):
                a, rr = i * 2.4, 0.012 + 0.0025 * i
                sphere(f'succ_leaf{i}', 0.018, (15.86 + math.cos(a) * rr, 1.08 + math.sin(a) * rr, DZ + 0.085 - i * 0.001), M['leaf2'] if i % 2 else M['leaf'], sub=1, scale=(1.6, 0.7, 0.5), rot=(0, -0.5, a))
            box('notebook', (0.15, 0.21, 0.012), (14.6, 1.48, DZ + 0.006), M['cover'], bevel=0.003, rot=math.radians(8))
            box('notebook_pages', (0.145, 0.205, 0.006), (14.6, 1.48, DZ + 0.014), M['paper'], rot=math.radians(8))
            for i, c in enumerate((M['black'], M['lego_b'])):
                cyl(f'pen{i}', 0.004, 0.14, (14.58 + i * 0.012, 1.38, DZ + 0.006), c, axis='Y', seg=10)
            box('phone_stand', (0.05, 0.08, 0.012), (15.3, 3.08, DZ + 0.006), M['black'], bevel=0.003)
            box('phone', (0.012, 0.075, 0.15), (15.31, 3.08, DZ + 0.08), M['black'], bevel=0.004, tilt=(0, math.radians(-15), 0))
            plane('screen_phone', 0.066, 0.135, (15.302, 3.08, DZ + 0.081), E['screen'], '-X')
            screen('phone', (15.302, 3.08, DZ + 0.081), 0.066, 0.135)
            box('pomodoro', (0.06, 0.06, 0.06), (15.3, 2.95, DZ + 0.03), M['plastic'], bevel=0.008)
            plane('screen_timer', 0.044, 0.03, (15.269, 2.95, DZ + 0.032), E['screen'], '-X')
            screen('timer', (15.269, 2.95, DZ + 0.032), 0.044, 0.03)
            cyl('fan_base', 0.05, 0.015, (15.82, 3.3, DZ + 0.008), M['white'])
            cyl('fan_neck', 0.008, 0.12, (15.82, 3.3, DZ + 0.07), M['white'])
            cyl('fan_cage', 0.07, 0.04, (15.8, 3.3, DZ + 0.16), M['white'], axis='X', cap=False, seg=20)

            # ---------- Aria, the desk robot (the Pebble design): pearl body, dark face, teal eyes ----------
            AR = Vector((15.7, 2.86, DZ + 0.12))
            sphere('aria_body', 0.075, AR, M['pearl'], sub=3, scale=(1, 1, 0.92))
            cyl('aria_base', 0.06, 0.035, (AR.x, AR.y, DZ + 0.02), M['plastic'])
            for s in (-1, 1):
                cyl(f'aria_wheel{s}', 0.022, 0.012, (AR.x, AR.y + s * 0.055, DZ + 0.022), M['black'], axis='Y')
            box('aria_face', (0.02, 0.085, 0.05), (AR.x - 0.064, AR.y, AR.z + 0.005), M['aria_face'], bevel=0.012)
            for s in (-1, 1):
                box(f'aria_eye{s}', (0.006, 0.014, 0.022), (AR.x - 0.0755, AR.y + s * 0.02, AR.z + 0.008), E['aria_eye'], bevel=0.005, kind='emit')
            cyl('aria_antenna', 0.003, 0.05, (AR.x, AR.y, AR.z + 0.095), M['metal'])
            sphere('aria_tip', 0.009, (AR.x, AR.y, AR.z + 0.124), E['warm'], sub=2, kind='emit')
            point('aria', AR)

            # ---------- shelf above: books, figures, the LEGO build, a trophy; Vancouver and Tehran clocks ----------
            SZ = 2.95
            box('shelf', (0.22, 1.9, 0.03), (EW - 0.11, 2.2, SZ), M['walnut'], bevel=0.006)
            box('shelf_led', (0.01, 1.8, 0.01), (EW - 0.2, 2.2, SZ - 0.018), E['warm'], kind='emit')
            rnd = random.Random(11)
            y = 1.35
            for i in range(12):
                h, t = rnd.uniform(0.17, 0.25), rnd.uniform(0.025, 0.045)
                box(f'book{i}', (0.16, t, h), (EW - 0.12, y + t / 2, SZ + 0.015 + h / 2), M[f'book{i % 4 + 1}'], bevel=0.003)
                y += t + 0.004
            cyl('trophy_base', 0.035, 0.03, (EW - 0.12, 2.35, SZ + 0.03), M['black'])
            cyl('trophy_cup', 0.045, 0.09, (EW - 0.12, 2.35, SZ + 0.1), M['gold'], r2=0.025)
            for i, (fy, col) in enumerate(((2.55, 'clockface'), (2.7, 'red'), (2.85, 'lego_b'))):
                sphere(f'figure{i}_head', 0.028, (EW - 0.12, fy, SZ + 0.16), M['clockface'], sub=2)
                cyl(f'figure{i}_body', 0.028, 0.11, (EW - 0.12, fy, SZ + 0.07), M[col])
            LG = Vector((EW - 0.12, 3.0, SZ + 0.015))
            for i, (dy, dz, c) in enumerate(((0, 0, 'lego_r'), (0.032, 0, 'lego_r'), (0.016, 0.019, 'lego_y'), (-0.016, 0.019, 'lego_b'), (0.016, 0.038, 'lego_w'), (0, 0.057, 'lego_y'))):
                box(f'lego{i}', (0.032, 0.064, 0.019), LG + Vector((0, dy, dz + 0.0095)), M[c], bevel=0.001)
            for nm, yy in (('van', 1.55), ('teh', 2.85)):
                cyl(f'clock_{nm}', 0.11, 0.025, (EW - 0.02, yy, 3.4), M['black'], axis='X', seg=32)
                cyl(f'clockface_{nm}', 0.1, 0.004, (EW - 0.035, yy, 3.4), M['clockface'], axis='X', seg=32)
                for hand, ln, w in (('h', 0.055, 0.008), ('m', 0.085, 0.005)):
                    o = box(f'clock_{nm}_{hand}', (0.004, w, ln), (0, 0, ln / 2 - 0.01), M['black'], kind='emit')
                    for v in o.data.vertices:
                        v.co -= P((0, 0, 0))
                    o.location = P((EW - 0.04, yy, 3.4))
                META['clocks'][nm] = L((EW - 0.04, yy, 3.4))

            # ---------- the wall behind: walnut slats with a teal strip, hex acoustic panels above ----------
            for i in range(30):
                box(f'slat{i}', (0.03, 0.045, 2.6), (EW - 0.03, 0.75 + i * 0.1, Z0 + 1.3), M['slat'], bevel=0.004)
            box('slat_led_top', (0.02, 3.0, 0.02), (EW - 0.07, 2.2, Z0 + 2.62), E['rgb_teal'], kind='emit')
            hexes = [(1.2, 3.6, 'panel'), (1.55, 3.8, 'panel2'), (1.9, 3.6, 'panel'), (2.25, 3.8, 'panel'), (2.6, 3.6, 'panel2'), (2.95, 3.8, 'panel'),
                     (1.55, 4.2, 'panel'), (2.25, 4.2, 'panel2'), (2.95, 4.2, 'panel'), (1.9, 4.0, 'panel2'), (2.6, 4.0, 'panel')]
            for i, (py, pz, m) in enumerate(hexes):
                bm = bmesh.new()
                bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.2, radius2=0.18, depth=0.04)
                bmesh.ops.rotate(bm, cent=Vector(), matrix=Matrix.Rotation(-math.pi / 2, 3, 'Y'), verts=bm.verts)
                bmesh.ops.rotate(bm, cent=Vector(), matrix=Matrix.Rotation(math.pi / 6, 3, 'X'), verts=bm.verts)
                bmesh.ops.translate(bm, vec=P((EW - 0.02, py, pz)), verts=bm.verts)
                link(f'acoustic{i}', bm, M[m])

            # ---------- the racing chair: white with gold stitching and a purple stripe, on a Persian rug ----------
            rug('rug_studio', (CHAIR.x - 0.1, CHAIR.y, Z0), M['rug'], r=1.05)
            cx, cy = CHAIR.x, CHAIR.y
            box('chair_seat', (0.5, 0.52, 0.1), (cx, cy, Z0 + 0.5), M['rm_white'], bevel=0.04, seg=3)
            for s in (-1, 1):
                box(f'chair_bolster{s}', (0.46, 0.07, 0.08), (cx, cy + s * 0.24, Z0 + 0.58), M['rm_white'], bevel=0.03, seg=3)
                box(f'chair_wing{s}', (0.1, 0.08, 0.62), (cx - 0.25, cy + s * 0.25, Z0 + 0.98), M['rm_white'], bevel=0.035, seg=3, tilt=(0, math.radians(-12), 0))
            box('chair_back', (0.1, 0.46, 0.86), (cx - 0.27, cy, Z0 + 1.02), M['rm_white'], bevel=0.04, seg=3, tilt=(0, math.radians(-12), 0))
            box('chair_stripe', (0.102, 0.06, 0.7), (cx - 0.27, cy, Z0 + 1.0), M['rm_purple'], bevel=0.02, tilt=(0, math.radians(-12), 0))
            for s in (-1, 1):
                box(f'chair_stitch{s}', (0.104, 0.008, 0.72), (cx - 0.27, cy + s * 0.05, Z0 + 1.0), M['rm_gold'], tilt=(0, math.radians(-12), 0))
            box('chair_headrest', (0.08, 0.26, 0.12), (cx - 0.35, cy, Z0 + 1.36), M['black'], bevel=0.04, seg=3, tilt=(0, math.radians(-12), 0))
            box('chair_lumbar', (0.08, 0.3, 0.13), (cx - 0.2, cy, Z0 + 0.72), M['black'], bevel=0.04, seg=3)
            cyl('chair_crest', 0.045, 0.005, (cx - 0.222, cy, Z0 + 1.2), M['rm_gold'], axis='X', seg=24)
            for s in (-1, 1):
                box(f'chair_arm{s}', (0.3, 0.06, 0.04), (cx - 0.02, cy + s * 0.29, Z0 + 0.7), M['black'], bevel=0.015)
                box(f'chair_armpost{s}', (0.04, 0.04, 0.16), (cx - 0.02, cy + s * 0.29, Z0 + 0.61), M['metal'])
            cyl('chair_gas', 0.025, 0.36, (cx, cy, Z0 + 0.27), M['metal'])
            for i in range(5):
                a = i * 2 * math.pi / 5
                box(f'chair_leg{i}', (0.32, 0.04, 0.03), (cx + math.cos(a) * 0.16, cy + math.sin(a) * 0.16, Z0 + 0.07), M['metal'], rot=a)
                sphere(f'chair_wheel{i}', 0.03, (cx + math.cos(a) * 0.31, cy + math.sin(a) * 0.31, Z0 + 0.03), M['black'], sub=1)
            collider('chair', (cx - 0.34, cy - 0.33, Z0 - 1), (cx + 0.22, cy + 0.33, Z0 + 0.55))
            point('chair', (cx, cy, Z0))
            point('desk_use', (13.6, cy, Z0))
            interact('desk', 'Use computer', (13.6, cy, Z0), r=1.25)

            # Bake light for the battlestation: the screens, a downlight over the desk, the RGB.
            area('L_monitor', 90, (1.2, 0.8), (MC.x - 0.06, MC.y, MC.z + 0.1), (0, math.radians(90), 0), (0.75, 0.82, 1.0))
            area('L_desk_pendant', 120, (0.8, 0.8), (14.8, 2.2, 3.4), (0, 0, 0), (1.0, 0.78, 0.55))
            area('L_studio_rgb', 70, (0.3, 3.0), (15.9, 2.2, Z0 + 2.6), (0, math.radians(90), 0), (0.3, 0.9, 0.85))
            char_light('point', '#c4d4ff', 3.2, (15.3, 2.2, DZ + 0.4), 4)
            char_light('point', '#8a45ff', 2.2, (15.0, 2.2, DZ - 0.3), 3.2, role='rgb')
            char_light('point', '#ffc48a', 2.0, (14.4, 2.2, 3.2), 4.5)
            META['looks'] += [L(MC), META['points']['aria'], META['screens']['pishi']['center']]
        # ---------- the rack in the corner with the 3D printer on top ----------
        RXc, RYc = 21.6, 0.45
        box('rack', (0.62, 0.62, 1.25), (RXc, RYc, Z0 + 0.625), M['black'], bevel=0.012)
        for u in range(7):
            box(f'rack_unit{u}', (0.01, 0.54, 0.12), (RXc - 0.31, RYc, Z0 + 0.18 + u * 0.15), M['plastic'])
            for k in range(6):
                nm = f'led_{u}_{k}'
                box(nm, (0.006, 0.012, 0.008), (RXc - 0.318, RYc - 0.22 + k * 0.02, Z0 + 0.2 + u * 0.15), E['led_green'] if k % 2 else E['led_blue'], kind='emit')
                META['leds'].append(nm)
        collider('rack', (RXc - 0.31, RYc - 0.31, Z0 - 1), (RXc + 0.31, RYc + 0.31, Z0 + 1.25))
        PZ = Z0 + 1.25
        box('printer_base', (0.42, 0.42, 0.06), (RXc, RYc, PZ + 0.03), M['white'], bevel=0.008)
        for sx in (-1, 1):
            box(f'printer_post{sx}', (0.03, 0.03, 0.46), (RXc + sx * 0.19, RYc + 0.15, PZ + 0.29), M['black'])
        box('printer_gantry', (0.42, 0.04, 0.04), (RXc, RYc + 0.15, PZ + 0.38), M['black'])
        box('printer_head', (0.06, 0.06, 0.07), (RXc - 0.05, RYc + 0.12, PZ + 0.34), M['black'], kind='emit')
        box('printer_bed', (0.3, 0.3, 0.008), (RXc, RYc, PZ + 0.1), M['metal'])
        cyl('printer_print', 0.04, 0.09, (RXc - 0.05, RYc - 0.02, PZ + 0.15), M['lego_y'], seg=16, kind='emit')
        box('printer_led', (0.003, 0.3, 0.006), (RXc - 0.2, RYc, PZ + 0.07), E['rgb_teal'], kind='emit')
        point('printer', (RXc - 0.05, RYc + 0.12, PZ + 0.34))
        interact('printer', 'Check the 3D print', (RXc - 0.9, RYc + 0.6, Z0), r=0.7)

        # ---------- the south wall: the GPU rig shelf and a pegboard, the glass board and STAY CURIOUS ----------
        box('rig_shelf', (0.9, 0.3, 0.03), (20.6, 0.16, Z0 + 2.2), M['walnut'], bevel=0.005)
        for sx in (-0.4, 0.4):
            box(f'rig_rail{sx:+.1f}', (0.03, 0.26, 0.24), (20.6 + sx, 0.16, Z0 + 2.34), M['steel'])
        for i in range(4):
            box(f'rig_gpu{i}', (0.05, 0.24, 0.12), (20.32 + i * 0.18, 0.16, Z0 + 2.3), M['metal'], bevel=0.005)
            box(f'gpu{i + 3}_led', (0.052, 0.004, 0.01), (20.32 + i * 0.18, 0.282, Z0 + 2.33), E['rgb_purple'], kind='emit')
        wallspot('rig_shelf', 's', 20.15, 21.05, Z0 + 2.18, Z0 + 2.48)
        box('pegboard', (1.2, 0.02, 0.8), (19.2, 0.01, Z0 + 1.6), M['oak'])
        for i in range(6):
            for k in range(4):
                cyl(f'peg{i}_{k}', 0.004, 0.03, (18.7 + i * 0.2, 0.035, Z0 + 1.3 + k * 0.2), M['black'], axis='Y', seg=8)
        cyl('solder_iron', 0.008, 0.2, (18.85, 0.05, Z0 + 1.62), M['red'], seg=10, r2=0.004)
        box('cutters', (0.02, 0.015, 0.12), (19.07, 0.05, Z0 + 1.58), M['red'])
        tube('cable_loop', [(19.4 + 0.06 * math.cos(2 * math.pi * k / 20), 0.05, Z0 + 1.6 + 0.06 * math.sin(2 * math.pi * k / 20)) for k in range(21)], 0.006, M['braid'])
        wallspot('pegboard', 's', 18.6, 19.8, Z0 + 1.2, Z0 + 2.0)
        box('board_frame', (2.7, 0.04, 1.3), (13.95, 0.02, Z0 + 1.45), M['steel'])
        plane('screen_board', 2.6, 1.2, (13.95, 0.045, Z0 + 1.45), M['white'], '+Y')
        screen('board', (13.95, 0.045, Z0 + 1.45), 2.6, 1.2, normal='+Y')
        box('board_tray', (2.0, 0.08, 0.02), (13.95, 0.06, Z0 + 0.78), M['steel'])
        for i, c in enumerate(('red', 'lego_b', 'black')):
            cyl(f'marker{i}', 0.008, 0.12, (13.45 + i * 0.05, 0.07, Z0 + 0.8), M[c], axis='X', seg=10)
        wallspot('board', 's', 12.6, 15.3, Z0 + 0.75, Z0 + 2.1)
        box('frame_poster', (0.62, 0.025, 0.86), (16.0, 0.013, Z0 + 1.55), M['frame'], bevel=0.004)
        plane('screen_poster', 0.56, 0.8, (16.0, 0.027, Z0 + 1.55), M['paper'], '+Y')
        screen('poster', (16.0, 0.027, Z0 + 1.55), 0.56, 0.8, normal='+Y')
        wallspot('poster', 's', 15.69, 16.31, Z0 + 1.12, Z0 + 1.98)
        interact('board', 'Read the glass board', (13.95, 1.2, Z0), r=1.1)

        # ---------- a meeting corner by the board: a small sofa and a low table ----------
        box('studio_sofa_base', (1.8, 0.8, 0.38), (13.7, 4.75, Z0 + 0.19), M['sofa_warm'], bevel=0.05, seg=3)
        box('studio_sofa_back', (1.8, 0.2, 0.42), (13.7, 5.05, Z0 + 0.6), M['sofa_warm'], bevel=0.07, seg=3)
        for i in range(2):
            box(f'studio_sofa_seat{i}', (0.86, 0.6, 0.12), (13.27 + i * 0.88, 4.65, Z0 + 0.44), M['cushion'], bevel=0.05, seg=3)
        collider('studio_sofa', (12.8, 4.35, Z0 - 1), (14.6, 5.15, Z0 + 0.5))
        for i, x in enumerate((13.27, 14.15)):
            seat(f'studio_sofa{i}', 'Sit down', (x, 3.95, Z0), (x, 4.7, Z0), 270)
        box('studio_table', (1.0, 0.55, 0.05), (13.7, 3.3, Z0 + 0.4), M['walnut'], bevel=0.01)
        for sx in (-1, 1):
            for sy in (-1, 1):
                cyl(f'studio_table_leg{sx}{sy}', 0.015, 0.38, (13.7 + sx * 0.44, 3.3 + sy * 0.22, Z0 + 0.19), M['black'])
        collider('studio_table', (13.2, 3.02, Z0 - 1), (14.2, 3.58, Z0 + 0.42))
        box('studio_table_book', (0.22, 0.16, 0.03), (13.5, 3.25, Z0 + 0.44), M['cover'], rot=0.3)

        # ---------- the arcade cabinet against the partition, and plants ----------
        AX, AY = 12.05, 2.2
        prism('arcade_body', [(AX - 0.32, AY - 0.36), (AX + 0.32, AY - 0.36), (AX + 0.32, AY + 0.36), (AX - 0.32, AY + 0.36)], Z0, Z0 + 1.75, M['purple'])
        box('arcade_marquee', (0.04, 0.66, 0.2), (AX + 0.31, AY, Z0 + 1.62), E['rgb_teal'], kind='emit')
        box('arcade_panel', (0.3, 0.66, 0.06), (AX + 0.42, AY, Z0 + 0.98), M['black'], tilt=(0, math.radians(-15), 0))
        for i, c in enumerate(('red', 'lego_y', 'lego_b')):
            cyl(f'arcade_btn{i}', 0.016, 0.02, (AX + 0.44, AY - 0.08 + i * 0.07, Z0 + 1.02), M[c], seg=12)
        cyl('arcade_stick', 0.008, 0.07, (AX + 0.44, AY + 0.18, Z0 + 1.05), M['black'], seg=10)
        plane('screen_arcade', 0.5, 0.4, (AX + 0.33, AY, Z0 + 1.3), E['screen'], '+X', yaw=0)
        screen('arcade', (AX + 0.33, AY, Z0 + 1.3), 0.5, 0.4, normal='+X')
        collider('arcade', (AX - 0.32, AY - 0.36, Z0 - 1), (AX + 0.58, AY + 0.36, Z0 + 1.75))
        interact('arcade', 'Play Striker 22', (AX + 1.1, AY, Z0), r=0.8)
        potted('studio_plant', (11.85, 0.5, Z0), M, r=0.2, h=0.5, mat='pot_white', leaves=11, size=0.2)
        potted('studio_plant2', (17.6, 0.45, Z0), M, r=0.22, h=0.55, mat='pot', leaves=12, size=0.22)
        lamp('L_arcade', 25, (AX + 0.5, AY, Z0 + 1.4), (0.4, 0.9, 0.85))
        area('L_board', 80, (2.6, 0.6), (13.95, 0.8, Z0 + 2.6), (math.radians(30), 0, 0), (1.0, 0.85, 0.7))
        META['looks'] += [[13.95, 0.05, Z0 + 1.45]]
