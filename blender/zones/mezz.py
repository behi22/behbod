"""The mezzanine at 3 m: the reading loft by the top of the stairs with the story book on its lectern, the trophy
shelf, the Shahnameh and the khatam box, bean bags and an arc lamp; the dressing area with the wardrobe, the live
mirror and the unlocks on their stands; the collection cabinet and a cushion nook at the east end; hanging plants on
the glass rail; a kilim on the west wall over the reading nook."""
import math
from lib.core import zone, box, cyl, sphere, plane, tube, collider, point, screen, interact, seat, rug, wallspot, char_light, area, lamp, potted, tilt_obj, META
from zones.layout import MEZZ_Z, MEZZ


def build(M, E, G):
    with zone('mezz', px=2048):
        z = MEZZ_Z
        # Reading loft: a rug, two bean bags, an arc lamp, the lectern with the story book, the trophy shelf.
        rug('rug_mezz', (3.3, 2.3, z), M['rug'], r=1.25)
        for i, (bx, by, m) in enumerate(((2.45, 3.25, 'beanbag'), (4.2, 3.35, 'cushion_teal'))):
            sphere(f'mezz_bean{i}', 0.4, (bx, by, z + 0.19), M[m], sub=3, scale=(1, 1.05, 0.5))
            sphere(f'mezz_bean{i}_dent', 0.26, (bx + 0.02, by + 0.05, z + 0.34), M[m], sub=3, scale=(1, 1, 0.35))
            collider(f'mezz_bean{i}', (bx - 0.4, by - 0.42, z - 1), (bx + 0.4, by + 0.42, z + 0.38))
            seat(f'mezz_bean{i}', 'Sit on the bean bag', (bx, by - 0.85, z), (bx, by + 0.08, z + 0.28), 270, 'low')
        tube('arc_lamp', [(1.9, 0.6, z), (1.9, 0.6, z + 1.6), (2.3, 1.0, z + 2.1), (2.9, 1.6, z + 2.0)], 0.014, M['steel'], seg=10)
        cyl('arc_lamp_base', 0.17, 0.03, (1.9, 0.6, z + 0.015), M['marble'], seg=24)
        cyl('arc_lamp_shade', 0.22, 0.18, (2.95, 1.65, z + 1.92), M['brass'], seg=24, r2=0.08, cap=False)
        sphere('arc_lamp_bulb', 0.05, (2.95, 1.65, z + 1.86), E['warm'], sub=2, kind='emit')
        collider('arc_lamp', (1.72, 0.42, z - 1), (2.08, 0.78, z + 1.7))
        cyl('lectern_post', 0.04, 1.0, (3.6, 1.2, z + 0.5), M['walnut'])
        cyl('lectern_foot', 0.2, 0.03, (3.6, 1.2, z + 0.015), M['walnut'], seg=24)
        box('lectern_top', (0.5, 0.36, 0.03), (3.6, 1.2, z + 1.02), M['walnut'], tilt=(math.radians(-20), 0, 0))
        box('story_book', (0.42, 0.3, 0.035), (3.6, 1.2, z + 1.05), M['cover'], bevel=0.004, tilt=(math.radians(-20), 0, 0))
        tilt_obj(plane('screen_book', 0.38, 0.26, (3.6, 1.2, z + 1.05), M['paper'], '+Z'), (3.6, 1.2, z + 1.05), -20, lift=0.021)
        screen('book', (3.6, 1.195, z + 1.075), 0.38, 0.26, normal='+Z', tilt=-20)
        collider('lectern', (3.35, 1.0, z - 1), (3.85, 1.4, z + 1.05))
        interact('book', 'Read the story', (3.6, 1.95, z), r=0.5)
        box('trophy_shelf', (2.4, 0.32, 1.6), (3.2, 0.16, z + 0.8), M['walnut'], bevel=0.008)
        for k in range(3):
            box(f'trophy_board{k}', (2.36, 0.3, 0.02), (3.2, 0.17, z + 0.2 + k * 0.5), M['black'])
        for k, zz in enumerate((0.68, 1.18, 1.58)):
            box(f'trophy_led{k}', (2.3, 0.01, 0.008), (3.2, 0.31, z + zz), E['warm_soft'], kind='emit')
        for i, (tx, tz, kind) in enumerate(((2.2, 0.21, 'cup'), (2.7, 0.21, 'ball'), (3.3, 0.21, 'cup'), (3.9, 0.21, 'medal'),
                                              (2.3, 0.71, 'figure'), (2.8, 0.71, 'figure'), (3.4, 0.71, 'cup'), (4.0, 0.71, 'figure'),
                                              (2.25, 1.21, 'ball'), (3.0, 1.21, 'figure'), (3.7, 1.21, 'cup'))):
            if kind == 'cup':
                cyl(f'trophy{i}_base', 0.04, 0.04, (tx, 0.18, z + tz + 0.02), M['black'])
                cyl(f'trophy{i}_cup', 0.055, 0.14, (tx, 0.18, z + tz + 0.11), M['gold'], r2=0.03)
            elif kind == 'ball':
                sphere(f'trophy{i}', 0.08, (tx, 0.18, z + tz + 0.08), M['kit_white'], sub=2)
            elif kind == 'medal':
                cyl(f'trophy{i}', 0.05, 0.008, (tx, 0.3, z + tz + 0.25), M['gold'], axis='Y', seg=20)
            else:
                cyl(f'trophy{i}_body', 0.03, 0.14, (tx, 0.18, z + tz + 0.07), M['book2' if i % 2 else 'red'])
                sphere(f'trophy{i}_head', 0.028, (tx, 0.18, z + tz + 0.17), M['clockface'], sub=2)
        collider('trophy_shelf', (2.0, 0.0, z - 1), (4.4, 0.32, z + 1.6))
        wallspot('trophy_shelf', 's_mezz', 2.0, 4.4, z, z + 1.6)
        interact('trophies', 'Look at the trophies', (2.6, 0.8, z), r=0.4)
        box('side_table', (0.5, 0.5, 0.45), (5.0, 2.6, z + 0.225), M['walnut'], bevel=0.01)
        box('khatam_box', (0.24, 0.08, 0.05), (4.95, 2.55, z + 0.475), M['tile'], bevel=0.004)
        box('shahnameh', (0.26, 0.2, 0.06), (5.02, 2.7, z + 0.48), M['cover'], bevel=0.004, rot=0.3)
        collider('side_table', (4.75, 2.35, z - 1), (5.25, 2.85, z + 0.45))

        # Dressing: the wardrobe and the live mirror on the back wall, and the unlocks waiting on their stands.
        WX0, WX1 = 5.8, 7.8
        box('wardrobe', (WX1 - WX0, 0.6, 2.4), ((WX0 + WX1) / 2, 0.3, z + 1.2), M['walnut'], bevel=0.01)
        for s in (-1, 1):
            box(f'wardrobe_door{s}', ((WX1 - WX0) / 2 - 0.01, 0.02, 2.3), ((WX0 + WX1) / 2 + s * (WX1 - WX0) / 4, 0.61, z + 1.2), M['oak'], kind='emit')
            box(f'wardrobe_handle{s}', (0.02, 0.03, 0.4), ((WX0 + WX1) / 2 + s * 0.06, 0.635, z + 1.2), M['brass'], kind='emit')
        collider('wardrobe', (WX0, 0.0, z - 1), (WX1, 0.62, z + 2.4))
        wallspot('wardrobe', 's_mezz', WX0, WX1, z, z + 2.4)
        interact('wardrobe', 'Change clothes', ((WX0 + WX1) / 2, 1.35, z), r=0.6)
        MX = 8.4
        box('mirror_frame', (0.9, 0.05, 1.9), (MX, 0.025, z + 1.05), M['brass'], bevel=0.01)
        plane('mirror', 0.8, 1.8, (MX, 0.056, z + 1.05), G['glass'], '+Y', kind='glass')
        screen('mirror', (MX, 0.056, z + 1.05), 0.8, 1.8, normal='+Y')
        collider('mirror', (MX - 0.45, 0.0, z - 1), (MX + 0.45, 0.1, z + 2.0))
        wallspot('mirror', 's_mezz', MX - 0.45, MX + 0.45, z + 0.1, z + 2.0)
        interact('mirror', 'Look in the mirror', (MX, 1.2, z), r=0.5)
        for i, (ux, name, label) in enumerate(((6.1, 'unlock_kit', 'BEHI 22 keeper kit'), (6.8, 'unlock_gold', 'Gold colourway'), (7.5, 'unlock_visor', 'Red visor'))):
            cyl(f'{name}_plinth', 0.16, 0.9, (ux, 3.6, z + 0.45), M['black'], seg=24)
            cyl(f'{name}_glow', 0.15, 0.006, (ux, 3.6, z + 0.905), E['holo'], seg=24, kind='emit')
            plane(f'screen_{name}', 0.26, 0.08, (ux, 3.765, z + 0.6), E['screen'], '+Y')
            screen(name, (ux, 3.765, z + 0.6), 0.26, 0.08, normal='+Y', label=label)
            collider(f'{name}_plinth', (ux - 0.17, 3.43, z - 1), (ux + 0.17, 3.77, z + 0.9))
        box('unlock_kit_shirt', (0.3, 0.1, 0.36), (6.1, 3.6, z + 1.1), M['kit_white'], bevel=0.04, seg=3, kind='emit')
        for s in (-1, 1):
            box(f'unlock_kit_glove{s}', (0.08, 0.06, 0.1), (6.1 + s * 0.2, 3.6, z + 1.0), M['black'], bevel=0.02, kind='emit')
        box('unlock_gold_hoodie', (0.32, 0.12, 0.38), (6.8, 3.6, z + 1.12), M['gold'], bevel=0.05, seg=3, kind='emit')
        sphere('unlock_visor_helmet', 0.13, (7.5, 3.6, z + 1.06), M['matte'], sub=3, kind='emit')
        box('unlock_visor_band', (0.2, 0.04, 0.05), (7.5, 3.72, z + 1.08), E['onair'], bevel=0.015, kind='emit')
        META['unlocks'] = [{'id': 'kit', 'parts': 'unlock_kit'}, {'id': 'gold', 'parts': 'unlock_gold'}, {'id': 'visor', 'parts': 'unlock_visor'}]
        interact('unlocks', 'See what you can unlock', (6.8, 2.75, z), r=0.5)

        # The east end: the collection cabinet on the back wall and a cushion nook with a low table.
        box('collection_case', (1.6, 0.4, 1.8), (10.1, 0.2, z + 0.9), M['walnut'], bevel=0.008)
        box('collection_glass', (1.5, 0.02, 1.6), (10.1, 0.41, z + 0.95), G['glass'], kind='glass')
        for k in range(3):
            box(f'collection_board{k}', (1.5, 0.36, 0.02), (10.1, 0.2, z + 0.4 + k * 0.5), M['black'])
            for j in range(4):
                if (j + k) % 2:
                    box(f'collection_box{k}_{j}', (0.22, 0.12, 0.28), (9.55 + j * 0.37, 0.2, z + 0.55 + k * 0.5), M[('lego_y', 'lego_r', 'lego_b', 'red')[j]], bevel=0.005)
                else:
                    cyl(f'collection_fig{k}_{j}', 0.04, 0.2, (9.55 + j * 0.37, 0.2, z + 0.51 + k * 0.5), M[('clockface', 'black', 'book2', 'gold')[j]])
        collider('collection_case', (9.3, 0.0, z - 1), (10.9, 0.42, z + 1.8))
        wallspot('collection', 's_mezz', 9.3, 10.9, z, z + 1.8)
        interact('collection', 'Look at the collection', (10.1, 1.05, z), r=0.45)
        for i, (cx, cy) in enumerate(((9.3, 2.9), (10.5, 2.9))):
            cyl(f'floor_cushion{i}', 0.32, 0.14, (cx, cy, z + 0.07), M['cushion_rust' if i else 'cushion_teal'], seg=24)
            collider(f'floor_cushion{i}', (cx - 0.32, cy - 0.32, z - 1), (cx + 0.32, cy + 0.32, z + 0.14))
            seat(f'floor_cushion{i}', 'Sit on the cushion', (cx, cy - 0.75, z), (cx, cy, z + 0.14), 90, 'cross')
        box('nook_table', (0.6, 0.6, 0.3), (9.9, 3.8, z + 0.15), M['walnut'], bevel=0.01)
        collider('nook_table', (9.6, 3.5, z - 1), (10.2, 4.1, z + 0.3))
        # Hanging plants on the glass rail.
        for i, x in enumerate((2.6, 5.6, 8.6)):
            cyl(f'rail_pot{i}', 0.12, 0.16, (x, 4.62, z + 0.9), M['pot'], r2=0.14)
            for k in range(6):
                a = k * 1.05
                tube(f'rail_vine{i}_{k}', [(x + math.cos(a) * 0.1, 4.62 + math.sin(a) * 0.1, z + 0.86), (x + math.cos(a) * 0.16, 4.64 + math.sin(a) * 0.14, z + 0.5), (x + math.cos(a) * 0.12, 4.7 + math.sin(a) * 0.1, z + 0.1 - (k % 3) * 0.25)], 0.012, M['leaf2' if k % 2 else 'leaf'])
        # A woven kilim behind the reading nook, on a walnut rod, with a small brass picture light over it.
        KY, KZ, KW, KH = 2.3, z + 1.66, 1.9, 1.3
        plane('screen_kilim', KW, KH, (0.024, KY, KZ), M['paper'], '+X')
        screen('kilim', (0.024, KY, KZ), KW, KH, normal='+X')
        wallspot('kilim', 'w_mezz', KY - KW / 2 - 0.1, KY + KW / 2 + 0.1, KZ - KH / 2, KZ + KH / 2 + 0.3)
        cyl('kilim_rod', 0.014, KW + 0.14, (0.05, KY, KZ + KH / 2 + 0.02), M['walnut'], axis='Y', seg=12)
        for sy in (-1, 1):
            sphere(f'kilim_rod_end{sy}', 0.022, (0.05, KY + sy * (KW / 2 + 0.08), KZ + KH / 2 + 0.02), M['brass'], sub=1)
            box(f'kilim_bracket{sy}', (0.05, 0.012, 0.03), (0.025, KY + sy * (KW / 2 + 0.03), KZ + KH / 2 + 0.02), M['brass'])
        box('kilim_light_arm', (0.16, 0.012, 0.012), (0.08, KY, KZ + KH / 2 + 0.2), M['brass'])
        box('kilim_light', (0.05, 0.7, 0.03), (0.16, KY, KZ + KH / 2 + 0.19), M['brass'], bevel=0.006)
        box('kilim_light_glow', (0.03, 0.66, 0.004), (0.16, KY, KZ + KH / 2 + 0.173), E['warm_soft'], kind='emit')

        lamp('L_arc', 120, (2.95, 1.65, z + 1.8), (1.0, 0.75, 0.45))
        area('L_kilim', 55, (0.65, 0.06), (0.22, 2.3, z + 2.5), (0, math.radians(35), 0), (1.0, 0.8, 0.55))
        lamp('L_dressing', 70, (6.8, 1.8, z + 2.7), (1.0, 0.85, 0.7))
        lamp('L_collection', 50, (10.1, 0.8, z + 2.2), (1.0, 0.85, 0.7))
        char_light('point', '#ffc08a', 2.0, (3.2, 2.0, z + 2.0), 4.5)
        char_light('point', '#ffd8b0', 1.6, (7.5, 1.8, z + 2.4), 4.5)
        META['looks'] += [[3.6, 1.2, z + 1.05], [MX, 0.06, z + 1.2], [6.8, 3.6, z + 1.1], [10.1, 0.4, z + 1.2]]
