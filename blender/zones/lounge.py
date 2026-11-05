"""The sunken lounge and the ground floor around it: the U couch facing the TV over the fireplace, holochess, the bean
bag, the aquarium wall, the Vader cube, the window seat, the egg chair, the cat tree and Pishi's cat walk, Jessi's
bed, and the X-wing and TIE over the void."""
import math
import bpy, bmesh
from mathutils import Vector, Matrix
from lib.core import (zone, box, cyl, sphere, plane, tube, link, collider, floor, point, screen, interact, seat, rug, wallspot,
                      char_light, area, lamp, potted, principled, P, META)
from zones.layout import PIT, PIT_Z, D, SLIDING_DOOR


def couch_run(name, M, a, b, back, depth, z, mat):
    # One straight run of the U couch: base, seat cushions, back cushions. `back` is the side the back sits on.
    (x0, y0), (x1, y1) = a, b
    horiz = abs(y1 - y0) < 1e-6
    length = abs(x1 - x0) if horiz else abs(y1 - y0)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    off = {'n': (0, -depth / 2), 's': (0, depth / 2), 'e': (-depth / 2, 0), 'w': (depth / 2, 0)}[back]
    bx, by = cx + off[0], cy + off[1]
    size = (length, depth, 0.36) if horiz else (depth, length, 0.36)
    box(f'{name}_base', size, (bx, by, z + 0.18), M[mat], bevel=0.05, seg=3)
    n = max(1, round(length / 0.8))
    for i in range(n):
        mid = -length / 2 + length * (i + 0.5) / n
        cxi, cyi = (bx + mid, by) if horiz else (bx, by + mid)
        sz = (length / n - 0.03, depth - 0.18, 0.14) if horiz else (depth - 0.18, length / n - 0.03, 0.14)
        sx, sy = {'n': (0, -0.07), 's': (0, 0.07), 'e': (-0.07, 0), 'w': (0.07, 0)}[back]
        box(f'{name}_seat{i}', sz, (cxi + sx, cyi + sy, z + 0.43), M['cushion'], bevel=0.05, seg=3)
        bk = {'n': (0, depth / 2 - 0.1), 's': (0, -depth / 2 + 0.1), 'e': (depth / 2 - 0.1, 0), 'w': (-depth / 2 + 0.1, 0)}[back]
        bsz = (length / n - 0.04, 0.2, 0.42) if horiz else (0.2, length / n - 0.04, 0.42)
        box(f'{name}_back{i}', bsz, (cxi + bk[0], cyi + bk[1], z + 0.66), M['cushion'], bevel=0.07, seg=3)
    lo = (min(x0, x1) if horiz else bx - depth / 2, by - depth / 2 if horiz else min(y0, y1), z - 1)
    hi = (max(x0, x1) if horiz else bx + depth / 2, by + depth / 2 if horiz else max(y0, y1), z + 0.42)
    collider(name, lo, hi)


def ship_xwing(M, c):
    x, y, z = c
    box('ship_xwing_body', (0.9, 0.12, 0.12), (x, y, z), M['white'], bevel=0.02, kind='emit')
    cyl('ship_xwing_nose', 0.06, 0.4, (x + 0.6, y, z), M['white'], axis='X', r2=0.02, kind='emit', seg=12)
    for sy in (-1, 1):
        for sz in (-1, 1):
            box(f'ship_xwing_wing{sy}{sz}', (0.3, 0.55, 0.02), (x - 0.15, y + sy * 0.3, z + sz * 0.1), M['white'], kind='emit', tilt=(sy * sz * 0.25, 0, 0))
            cyl(f'ship_xwing_engine{sy}{sz}', 0.04, 0.22, (x - 0.25, y + sy * 0.12, z + sz * 0.07), M['metal'], axis='X', kind='emit', seg=10)
        box(f'ship_xwing_stripe{sy}', (0.2, 0.3, 0.022), (x - 0.12, y + sy * 0.35, z + 0.105), M['red'], kind='emit')


def ship_tie(M, c):
    x, y, z = c
    sphere('ship_tie_cockpit', 0.16, (x, y, z), M['metal'], sub=2, kind='emit')
    cyl('ship_tie_axle', 0.04, 0.6, (x, y, z), M['metal'], axis='Y', kind='emit', seg=10)
    for sy in (-1, 1):
        bm = bmesh.new()
        bmesh.ops.create_circle(bm, cap_ends=True, segments=6, radius=0.42)
        bmesh.ops.rotate(bm, cent=Vector(), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'), verts=bm.verts)
        bmesh.ops.translate(bm, vec=P((x, y + sy * 0.32, z)), verts=bm.verts)
        link(f'ship_tie_wing{sy}', bm, M['black'], 'emit')


def build(M, E, G):
    M['stone_fire'] = principled('stone_fire', (0.12, 0.12, 0.13), 0.85)
    M['fish_orange'] = principled('fish_orange', (0.9, 0.35, 0.05), 0.4)
    M['fish_blue'] = principled('fish_blue', (0.1, 0.4, 0.9), 0.4)
    with zone('lounge', px=2048):
        z = PIT_Z
        px0, py0, px1, py1 = PIT
        CY = 10.2
        rug('rug_lounge', (6.0, CY, z), M['rug_blue'], r=2.6)
        # The U couch opens west toward the TV, with a walkway behind it from the steps.
        couch_run('couch_n', M, (4.4, 12.6), (8.3, 12.6), 'n', 0.85, z, 'sofa')
        couch_run('couch_s', M, (4.4, 7.8), (8.3, 7.8), 's', 0.85, z, 'sofa')
        couch_run('couch_e', M, (8.3, 8.65), (8.3, 11.75), 'e', 0.85, z, 'sofa')
        for i, (bx, by, m, tilt) in enumerate(((4.8, 12.05, 'cushion_teal', 0.25), (5.7, 12.05, 'cushion_rust', 0.25), (4.8, 8.35, 'cushion_rust', -0.25), (7.85, 9.3, 'cushion_teal', 0))):
            box(f'pillow{i}', (0.36, 0.14, 0.32), (bx, by, z + 0.62), M[m], bevel=0.06, seg=3, tilt=(tilt, 0, 0), rot=math.pi / 2 if i == 3 else 0)
        seat('couch_north', 'Sit on the couch', (6.4, 11.3, z), (6.4, 12.2, z), 270)
        seat('couch_south', 'Sit on the couch', (6.4, 9.1, z), (6.4, 8.25, z), 90)
        seat('couch_east', 'Sit on the couch', (7.0, CY, z), (7.85, CY, z), 180)
        # Holochess: a round table whose top is a glowing board.
        cyl('holo_table_base', 0.2, 0.42, (6.1, CY, z + 0.21), M['black'], seg=32)
        cyl('holo_table_top', 0.45, 0.04, (6.1, CY, z + 0.44), M['black'], seg=48)
        cyl('holo_board', 0.38, 0.004, (6.1, CY, z + 0.462), E['holo'], seg=48, kind='emit')
        collider('holo_table', (5.65, CY - 0.45, z - 1), (6.55, CY + 0.45, z + 0.46))
        point('holochess', (6.1, CY, z + 0.47))
        interact('holochess', 'Play holochess', (5.15, CY, z), r=0.55)
        # The bean bag in front of the TV.
        sphere('beanbag', 0.42, (3.4, CY, z + 0.2), M['beanbag'], sub=3, scale=(1, 1.05, 0.5))
        sphere('beanbag_dent', 0.28, (3.45, CY, z + 0.36), M['beanbag'], sub=3, scale=(1, 1, 0.35))
        collider('beanbag', (2.98, CY - 0.44, z - 1), (3.82, CY + 0.44, z + 0.4))
        seat('beanbag', 'Sit on the bean bag', (4.35, CY - 0.75, z), (3.5, CY, z + 0.1), 180)
        interact('tv', 'Watch my videos', (4.35, CY + 0.75, z), r=0.5)
        # A floor lamp in the pit's north-east corner, clear of the steps.
        cyl('lounge_lamp_pole', 0.014, 1.5, (9.35, 13.2, z + 0.75), M['metal'])
        cyl('lounge_lamp_base', 0.14, 0.025, (9.35, 13.2, z + 0.012), M['metal'])
        cyl('lounge_lamp_shade', 0.2, 0.28, (9.35, 13.2, z + 1.57), M['lampshade'], r2=0.14, cap=False)
        sphere('lounge_lamp_bulb', 0.05, (9.35, 13.2, z + 1.53), E['warm'], sub=2, kind='emit')
        collider('lounge_lamp', (9.17, 13.02, z - 1), (9.53, 13.38, z + 1.7))

        # The fireplace sits north of the lounge's middle so the foot of the stairs has room in front of it.
        TVY = 10.6
        # The TV over the fireplace on a stone chimney breast, tall speakers either side, the console shelf.
        box('chimney', (0.45, 2.8, 6.5), (0.225, TVY, 3.25), M['stone_fire'])
        collider('chimney', (0.0, TVY - 1.4, -1), (0.45, TVY + 1.4, 6.5), structure=True)
        box('fire_opening', (0.04, 1.6, 0.4), (0.455, TVY, 0.55), M['black'])
        box('fire_glow', (0.02, 1.5, 0.14), (0.46, TVY, 0.44), E['fire'], kind='emit')
        for i in range(7):
            sphere(f'fire_stone{i}', 0.05, (0.48, TVY - 0.63 + i * 0.21, 0.4), M['stone'], sub=1, scale=(1, 1.4, 0.6))
        box('hearth', (0.7, 2.2, 0.08), (0.8, TVY, 0.04), M['stone'])
        collider('hearth', (0.45, TVY - 1.1, -1), (1.15, TVY + 1.1, 0.08), structure=True)
        floor(0.45, TVY - 1.1, 1.15, TVY + 1.1, 0.08)
        box('tv_back', (0.05, 1.7, 0.98), (0.475, TVY, 1.75), M['black'], bevel=0.01)
        plane('screen_tv', 1.64, 0.92, (0.502, TVY, 1.75), E['screen'], '+X')
        screen('tv', (0.502, TVY, 1.75), 1.64, 0.92, normal='+X')
        wallspot('tv', 'chimney', TVY - 0.85, TVY + 0.85, 1.26, 2.24)
        # Tall speakers stand on the ends of the hearth, either side of the fire.
        for i, sy in enumerate((TVY - 0.95, TVY + 0.95)):
            box(f'tower_speaker{i}', (0.24, 0.24, 1.05), (0.62, sy, 0.08 + 0.525), M['speaker'], bevel=0.01)
            for k, zz in enumerate((0.33, 0.63, 0.93)):
                cyl(f'tower_cone{i}_{k}', 0.07 if k else 0.035, 0.008, (0.744, sy, zz), M['cone'], axis='X', seg=20)
            collider(f'tower_speaker{i}', (0.5, sy - 0.12, 0.08), (0.74, sy + 0.12, 1.13))
        CS = 12.75
        box('console_shelf', (0.35, 0.9, 0.04), (0.6, CS, 0.55), M['walnut'])
        box('console_shelf2', (0.35, 0.9, 0.04), (0.6, CS, 1.05), M['walnut'])
        for sx in (-1, 1):
            box(f'console_side{sx}', (0.35, 0.03, 1.05), (0.6, CS + sx * 0.44, 0.525), M['walnut'])
        box('console', (0.25, 0.32, 0.07), (0.6, CS - 0.25, 0.605), M['white'], bevel=0.01)
        box('console_led', (0.004, 0.02, 0.004), (0.73, CS - 0.25, 0.6), E['led_blue'], kind='emit')
        for i, c in enumerate(('black', 'white')):
            box(f'controller{i}', (0.1, 0.15, 0.04), (0.6, CS + 0.05 + i * 0.17, 0.59), M[c], bevel=0.015, seg=3)
        for i in range(8):
            box(f'game{i}', (0.17, 0.014, 0.21), (0.6, CS - 0.38 + 0.02 * i, 1.07 + 0.105), M[f'book{i % 4 + 1}'], bevel=0.002)
        box('vr_visor', (0.18, 0.2, 0.1), (0.62, CS + 0.2, 1.12), M['white'], bevel=0.035, seg=3)
        box('vr_lens', (0.012, 0.16, 0.07), (0.716, CS + 0.2, 1.12), M['black'], bevel=0.02)
        tube('vr_strap', [(0.56, CS + 0.1, 1.12), (0.5, CS + 0.2, 1.16), (0.56, CS + 0.3, 1.12)], 0.012, M['black'])
        collider('console_shelf', (0.42, CS - 0.46, -1), (0.78, CS + 0.46, 1.1))
        interact('console', 'Play the console', (1.5, CS - 0.3, 0), r=0.55)

        # The aquarium wall on the entry hall's north side.
        AX0, AX1, AY = 2.6, 4.6, 4.5
        box('aqua_cabinet', (AX1 - AX0, 0.36, 0.85), ((AX0 + AX1) / 2, AY, 0.425), M['walnut'], bevel=0.008)
        box('aqua_water', (AX1 - AX0 - 0.06, 0.34, 0.6), ((AX0 + AX1) / 2, AY, 1.18), G['glass'], kind='glass')
        box('aqua_glow', (AX1 - AX0 - 0.1, 0.02, 0.02), ((AX0 + AX1) / 2, AY, 1.47), E['aqua'], kind='emit')
        box('aqua_lid', (AX1 - AX0, 0.38, 0.06), ((AX0 + AX1) / 2, AY, 1.51), M['black'])
        box('aqua_sand', (AX1 - AX0 - 0.06, 0.32, 0.05), ((AX0 + AX1) / 2, AY, 0.875), M['sand'])
        for i, (fx, fz, m) in enumerate(((0.3, 1.1, 'fish_orange'), (0.8, 1.25, 'fish_blue'), (1.3, 1.05, 'fish_orange'), (0.6, 1.35, 'fish_orange'), (1.7, 1.3, 'fish_blue'))):
            sphere(f'fish{i}', 0.04, (AX0 + fx, AY, fz), M[m], sub=1, scale=(1.6, 0.5, 0.8), kind='emit')
        for i in range(5):
            tube(f'aqua_weed{i}', [(AX0 + 0.2 + i * 0.4, AY + (i % 2) * 0.05, 0.9), (AX0 + 0.22 + i * 0.4, AY, 1.1), (AX0 + 0.18 + i * 0.4, AY, 1.3)], 0.012, M['leaf2'])
        collider('aquarium', (AX0, AY - 0.19, -1), (AX1, AY + 0.19, 1.55))
        lamp('L_aqua', 40, ((AX0 + AX1) / 2, AY, 1.4), (0.3, 0.6, 1.0))
        point('aquarium', ((AX0 + AX1) / 2, AY, 1.2))

        # The Vader figure with its saber in a glass cube, alone where you first see the loft.
        VX, VY = 5.6, 5.8
        box('vader_plinth', (0.7, 0.7, 1.0), (VX, VY, 0.5), M['black'], bevel=0.01)
        box('vader_glass', (0.66, 0.66, 0.7), (VX, VY, 1.36), G['glass'], kind='glass')
        cyl('vader_body', 0.08, 0.28, (VX, VY, 1.16), M['matte'], r2=0.06)
        sphere('vader_helmet', 0.06, (VX, VY, 1.36), M['matte'], sub=2, scale=(1, 1, 1.1))
        box('vader_cape', (0.04, 0.18, 0.3), (VX - 0.08, VY, 1.16), M['matte'], tilt=(0, 0.15, 0))
        cyl('vader_saber', 0.008, 0.36, (VX + 0.08, VY - 0.06, 1.3), E['onair'], seg=10, kind='emit')
        collider('vader', (VX - 0.35, VY - 0.35, -1), (VX + 0.35, VY + 0.35, 1.72))
        interact('vader', 'Look at the Vader figure', (VX + 0.85, VY, 0), r=0.6)
        lamp('L_vader', 30, (VX, VY, 1.68), (1.0, 0.25, 0.2), soft=0.05)

        # The window seat along the glass, with cushions and the bay behind it.
        WS0, WS1 = 3.5, 6.5
        box('window_seat', (WS1 - WS0, 0.5, 0.45), ((WS0 + WS1) / 2, D - 0.3, 0.225), M['walnut'], bevel=0.01)
        box('window_seat_cushion', (WS1 - WS0 - 0.1, 0.46, 0.08), ((WS0 + WS1) / 2, D - 0.3, 0.49), M['cushion'], bevel=0.03, seg=3)
        for i, (bx, m) in enumerate(((3.8, 'cushion_teal'), (4.4, 'cushion_rust'), (6.1, 'cushion_teal'))):
            box(f'seat_pillow{i}', (0.36, 0.13, 0.32), (bx, D - 0.16, 0.68), M[m], bevel=0.06, seg=3, tilt=(-0.2, 0, 0))
        collider('window_seat', (WS0, D - 0.55, -1), (WS1, D - 0.05, 0.53))
        seat('window_seat', 'Sit by the window', (5.1, D - 1.3, 0), (5.1, D - 0.4, 0.02), 270)
        point('cat_window', (5.4, D - 0.3, 0.53))
        # The egg chair on its C stand in the north-west corner, facing the bay.
        EG = Vector((1.8, 14.05, 1.05))
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=20, radius=1.0)
        bmesh.ops.scale(bm, vec=Vector((0.48, 0.42, 0.62)), verts=bm.verts)
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=Vector((0.15, 0.75, 0.25)).normalized() * 0.18, plane_no=Vector((0.15, 0.75, 0.25)).normalized(), clear_outer=True)
        bmesh.ops.translate(bm, vec=P(EG), verts=bm.verts)
        o = link('egg_chair', bm, M['rattan'])
        o.modifiers.new('sol', 'SOLIDIFY').thickness = 0.03
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier='sol')
        for p in o.data.polygons:
            p.use_smooth = True
        sphere('egg_cushion', 0.33, EG + Vector((0, 0, -0.3)), M['cushion'], sub=3, scale=(1, 1, 0.36))
        sphere('egg_pillow', 0.16, EG + Vector((0, -0.18, -0.04)), M['cushion_teal'], sub=3, scale=(0.7, 0.7, 1))
        arc = [(EG.x, EG.y - 0.75, 0.03)] + [(EG.x, EG.y - 0.75 + 0.75 * (i / 12) ** 2, 0.03 + 2.0 * (i / 12)) for i in range(1, 13)]
        tube('egg_stand', arc, 0.03, M['black'], seg=12)
        tube('egg_chain', [(EG.x, EG.y, EG.z + 0.62), (EG.x, EG.y, 2.03)], 0.01, M['steel'])
        cyl('egg_stand_base', 0.4, 0.04, (EG.x, EG.y - 0.75, 0.02), M['black'], seg=32)
        collider('egg_chair', (EG.x - 0.48, EG.y - 1.15, -1), (EG.x + 0.48, EG.y + 0.42, 1.65))
        seat('egg_chair', 'Sit in the egg chair', (EG.x + 1.0, EG.y - 0.1, 0), (EG.x, EG.y - 0.05, 0.3), 90)
        # Jessi's bed by the radiator, east of the sliding door.
        box('radiator', (1.2, 0.08, 0.6), (13.6, D - 0.14, 0.4), M['white'])
        for i in range(11):
            box(f'radiator_fin{i}', (0.02, 0.1, 0.56), (13.05 + i * 0.11, D - 0.16, 0.4), M['white'])
        collider('radiator', (13.0, D - 0.21, -1), (14.2, D - 0.05, 0.7))
        cyl('dog_bed', 0.38, 0.14, (13.6, D - 0.75, 0.07), M['sofa_warm'], seg=32)
        cyl('dog_bed_cushion', 0.3, 0.08, (13.6, D - 0.75, 0.12), M['cushion'], seg=32)
        sphere('dog_bone', 0.03, (13.85, D - 0.95, 0.17), M['white'], sub=1, scale=(2.5, 1, 1))
        collider('dog_bed', (13.22, D - 1.13, -1), (13.98, D - 0.37, 0.18))
        point('jessi_bed', (13.6, D - 0.75, 0.16))
        potted('door_plant', (9.6, D - 0.55, 0), M, r=0.22, h=0.55, mat='pot_white', leaves=12, size=0.22)

        # The cat tree in the north-west corner, and Pishi's cat walk along the west wall to a perch over the fire.
        cyl('cat_tree_base', 0.34, 0.05, (0.62, D - 0.75, 0.025), M['felt'], seg=24)
        cyl('cat_tree_post', 0.07, 2.0, (0.62, D - 0.75, 1.0), M['rattan'], seg=16)
        for i, (zz, rr) in enumerate(((0.6, 0.3), (1.2, 0.26), (1.8, 0.3))):
            cyl(f'cat_tree_deck{i}', rr, 0.05, (0.62 + (0.08 if i % 2 else -0.04), D - 0.75, zz), M['felt'], seg=24)
        sphere('cat_tree_den', 0.22, (0.62, D - 0.75, 0.9), M['felt'], sub=2, scale=(1, 1, 0.8))
        collider('cat_tree', (0.28, D - 1.09, -1), (0.96, D - 0.41, 1.9))
        steps = [(13.5, 2.1), (12.85, 2.3), (12.15, 2.5), (11.45, 2.7), (10.75, 2.85)]
        for i, (sy, sz) in enumerate(steps):
            dx = 0.45 if TVY - 1.4 <= sy <= TVY + 1.4 else 0
            box(f'catwalk{i}', (0.32, 0.5, 0.04), (0.16 + dx, sy, sz), M['walnut'], bevel=0.005)
            box(f'catwalk{i}_bracket', (0.02, 0.04, 0.12), (0.01 + dx, sy, sz - 0.08), M['black'])
        box('cat_perch', (0.5, 0.9, 0.05), (0.7, TVY, 3.0), M['walnut'], bevel=0.008)
        cyl('cat_perch_cushion', 0.3, 0.05, (0.7, TVY, 3.05), M['felt'], seg=24)
        META['catwalk'] = [[0.62, D - 0.75, 1.85]] + [[0.16 + (0.45 if TVY - 1.4 <= sy <= TVY + 1.4 else 0), sy, sz + 0.02] for sy, sz in steps] + [[0.7, TVY, 3.08]]

        # The X-wing and TIE in the double-height void over the lounge (the page flies them).
        ship_xwing(M, (5.0, CY, 5.3))
        ship_tie(M, (7.0, CY + 1.0, 5.6))
        META['fighters'] = {'center': [6.1, CY, 5.3], 'rx': 3.0, 'ry': 2.4, 'z0': 4.6, 'z1': 6.0, 'xwing': [5.0, CY, 5.3], 'tie': [7.0, CY + 1.0, 5.6]}

        # Bake light: the fire, the TV, the floor lamp, warm downlights over the couch.
        lamp('L_fire', 160, (0.65, TVY, 0.5), (1.0, 0.5, 0.2), soft=0.4)
        area('L_tv', 40, (1.6, 0.9), (0.55, TVY, 1.75), (0, math.radians(-90), 0), (0.55, 0.65, 1.0))
        lamp('L_lounge_lamp', 160, (9.35, 13.2, z + 1.5), (1.0, 0.72, 0.45))
        area('L_lounge_down', 200, (4.0, 3.0), (6.0, CY, 4.2), (0, 0, 0), (1.0, 0.8, 0.6))
        char_light('point', '#ffa25e', 2.6, (1.0, TVY, 0.6), 5)
        char_light('point', '#9db2ff', 1.6, (1.3, TVY, 1.7), 4)
        char_light('point', '#ffc890', 1.6, (6.0, CY, 2.6), 5)
        META['looks'] += [[0.5, TVY, 1.75], [VX, VY, 1.36], [(AX0 + AX1) / 2, AY, 1.16]]
