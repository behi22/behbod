"""The mezzanine at 2.9 m: the reading loft with the story book on its lectern, the trophy shelf and the collection,
bean bags and a reading lamp; the dressing area with the wardrobe, the live mirror and the unlocks on display; the
landing with a bench; hanging plants on the glass rail; the nastaliq in light on the back wall."""
import math
from lib.core import zone, box, cyl, sphere, plane, tube, collider, point, screen, interact, char_light, area, lamp, potted, tilt_obj, META
from zones.layout import MEZZ_Z, MEZZ, STAIRS


def build(M, E, G):
    with zone('mezz', px=2048):
        z = MEZZ_Z
        # Reading loft: a rug, two bean bags, an arc lamp, the lectern with the story book, the trophy shelf and collection.
        cyl('rug_mezz', 1.3, 0.012, (1.9, 1.5, z + 0.006), M['rug'], seg=64)
        for i, (bx, by, m) in enumerate(((1.2, 1.9, 'beanbag'), (2.5, 2.1, 'cushion_teal'))):
            sphere(f'mezz_bean{i}', 0.4, (bx, by, z + 0.19), M[m], sub=3, scale=(1, 1.05, 0.5))
            sphere(f'mezz_bean{i}_dent', 0.26, (bx + 0.02, by + 0.05, z + 0.34), M[m], sub=3, scale=(1, 1, 0.35))
            collider(f'mezz_bean{i}', (bx - 0.4, by - 0.42, z - 1), (bx + 0.4, by + 0.42, z + 0.38))
        tube('arc_lamp', [(0.4, 0.5, z), (0.4, 0.5, z + 1.6), (0.8, 0.9, z + 2.1), (1.4, 1.5, z + 2.0)], 0.014, M['steel'], seg=10)
        cyl('arc_lamp_base', 0.17, 0.03, (0.4, 0.5, z + 0.015), M['marble'], seg=24)
        cyl('arc_lamp_shade', 0.22, 0.18, (1.45, 1.55, z + 1.92), M['brass'], seg=24, r2=0.08, cap=False)
        sphere('arc_lamp_bulb', 0.05, (1.45, 1.55, z + 1.86), E['warm'], sub=2, kind='emit')
        collider('arc_lamp', (0.22, 0.32, z - 1), (0.58, 0.68, z + 1.7))
        cyl('lectern_post', 0.04, 1.0, (3.1, 1.0, z + 0.5), M['walnut'])
        cyl('lectern_foot', 0.2, 0.03, (3.1, 1.0, z + 0.015), M['walnut'], seg=24)
        box('lectern_top', (0.5, 0.36, 0.03), (3.1, 1.0, z + 1.02), M['walnut'], tilt=(math.radians(-20), 0, 0))
        box('story_book', (0.42, 0.3, 0.035), (3.1, 1.0, z + 1.05), M['cover'], bevel=0.004, tilt=(math.radians(-20), 0, 0))
        tilt_obj(plane('screen_book', 0.38, 0.26, (3.1, 1.0, z + 1.05), M['paper'], '+Z'), (3.1, 1.0, z + 1.05), -20, lift=0.021)
        screen('book', (3.1, 0.995, z + 1.075), 0.38, 0.26, normal='+Z', tilt=-20)
        collider('lectern', (2.85, 0.8, z - 1), (3.35, 1.2, z + 1.05))
        interact('book', 'Read the story', (3.1, 1.6, z), r=0.8)
        box('trophy_shelf', (2.2, 0.32, 1.6), (1.6, 0.16, z + 0.8), M['walnut'], bevel=0.008)
        for k in range(3):
            box(f'trophy_board{k}', (2.16, 0.3, 0.02), (1.6, 0.17, z + 0.2 + k * 0.5), M['black'])
        for k, zz in enumerate((0.68, 1.18, 1.58)):
            box(f'trophy_led{k}', (2.1, 0.01, 0.008), (1.6, 0.31, z + zz), E['warm_soft'], kind='emit')
        for i, (tx, tz, kind) in enumerate(((0.8, 0.21, 'cup'), (1.3, 0.21, 'ball'), (1.9, 0.21, 'cup'), (2.4, 0.21, 'medal'),
                                              (0.9, 0.71, 'figure'), (1.4, 0.71, 'figure'), (2.0, 0.71, 'cup'), (2.5, 0.71, 'figure'),
                                              (0.85, 1.21, 'ball'), (1.6, 1.21, 'figure'), (2.3, 1.21, 'cup'))):
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
        collider('trophy_shelf', (0.5, 0.0, z - 1), (2.7, 0.32, z + 1.6))
        # The khatam pen box and the Shahnameh on a side table.
        box('side_table', (0.5, 0.5, 0.45), (3.3, 2.4, z + 0.225), M['walnut'], bevel=0.01)
        box('khatam_box', (0.24, 0.08, 0.05), (3.25, 2.35, z + 0.475), M['tile'], bevel=0.004)
        box('shahnameh', (0.26, 0.2, 0.06), (3.32, 2.5, z + 0.48), M['cover'], bevel=0.004, rot=0.3)
        collider('side_table', (3.05, 2.15, z - 1), (3.55, 2.65, z + 0.45))

        # Dressing: the wardrobe, the live mirror, and the unlocks waiting on their stands.
        box('wardrobe', (2.0, 0.6, 2.4), (5.4, 0.3, z + 1.2), M['walnut'], bevel=0.01)
        box('wardrobe_split', (0.01, 0.02, 2.3), (5.4, 0.61, z + 1.2), M['black'])
        for s in (-1, 1):
            box(f'wardrobe_handle{s}', (0.02, 0.03, 0.4), (5.4 + s * 0.06, 0.63, z + 1.2), M['brass'])
        collider('wardrobe', (4.4, 0.0, z - 1), (6.4, 0.6, z + 2.4))
        interact('wardrobe', 'Change clothes', (5.4, 1.3, z), r=0.9)
        # The live mirror hangs flat on the back wall beside the wardrobe.
        box('mirror_frame', (0.9, 0.05, 1.9), (7.0, 0.025, z + 1.05), M['brass'], bevel=0.01)
        plane('mirror', 0.8, 1.8, (7.0, 0.056, z + 1.05), G['glass'], '+Y', kind='glass')
        screen('mirror', (7.0, 0.056, z + 1.05), 0.8, 1.8, normal='+Y')
        collider('mirror', (6.55, 0.0, z - 1), (7.45, 0.1, z + 2.0))
        for i, (ux, name, label) in enumerate(((4.4, 'unlock_kit', 'BEHI 22 keeper kit'), (5.0, 'unlock_gold', 'Gold colourway'), (5.6, 'unlock_visor', 'Red visor'))):
            cyl(f'{name}_plinth', 0.16, 0.9, (ux, 2.5, z + 0.45), M['black'], seg=24)
            cyl(f'{name}_glow', 0.15, 0.006, (ux, 2.5, z + 0.905), E['holo'], seg=24, kind='emit')
            plane(f'screen_{name}', 0.26, 0.08, (ux, 2.665, z + 0.6), E['screen'], '+Y')
            screen(name, (ux, 2.665, z + 0.6), 0.26, 0.08, normal='+Y', label=label)
            collider(f'{name}_plinth', (ux - 0.17, 2.33, z - 1), (ux + 0.17, 2.67, z + 0.9))
        box('unlock_kit_shirt', (0.3, 0.1, 0.36), (4.4, 2.5, z + 1.1), M['kit_white'], bevel=0.04, seg=3, kind='emit')
        for s in (-1, 1):
            box(f'unlock_kit_glove{s}', (0.08, 0.06, 0.1), (4.4 + s * 0.2, 2.5, z + 1.0), M['black'], bevel=0.02, kind='emit')
        box('unlock_gold_hoodie', (0.32, 0.12, 0.38), (5.0, 2.5, z + 1.12), M['gold'], bevel=0.05, seg=3, kind='emit')
        sphere('unlock_visor_helmet', 0.13, (5.6, 2.5, z + 1.06), M['matte'], sub=3, kind='emit')
        box('unlock_visor_band', (0.2, 0.04, 0.05), (5.6, 2.62, z + 1.08), E['onair'], bevel=0.015, kind='emit')
        META['unlocks'] = [{'id': 'kit', 'parts': 'unlock_kit'}, {'id': 'gold', 'parts': 'unlock_gold'}, {'id': 'visor', 'parts': 'unlock_visor'}]

        # The landing where the stairs arrive: a bench and a tall plant.
        box('landing_bench', (1.2, 0.4, 0.42), (8.6, 0.4, z + 0.21), M['oak'], bevel=0.01)
        box('landing_cushion', (1.15, 0.36, 0.06), (8.6, 0.4, z + 0.45), M['cushion_rust'], bevel=0.02)
        collider('landing_bench', (8.0, 0.2, z - 1), (9.2, 0.6, z + 0.45))
        potted('landing_plant', (9.4, 1.6, z), M, r=0.2, h=0.55, mat='pot_white', leaves=11, size=0.22)
        # Hanging plants on the glass rail.
        for i, x in enumerate((2.2, 4.6, 7.0)):
            cyl(f'rail_pot{i}', 0.12, 0.16, (x, 3.12, z + 0.9), M['pot'], r2=0.14)
            for k in range(6):
                a = k * 1.05
                tube(f'rail_vine{i}_{k}', [(x + math.cos(a) * 0.1, 3.12 + math.sin(a) * 0.1, z + 0.86), (x + math.cos(a) * 0.16, 3.14 + math.sin(a) * 0.14, z + 0.5), (x + math.cos(a) * 0.12, 3.2 + math.sin(a) * 0.1, z + 0.1 - (k % 3) * 0.25)], 0.012, M['leaf2' if k % 2 else 'leaf'])
        # The nastaliq in light along the back wall.
        plane('screen_nastaliq', 4.4, 0.9, (4.2, 0.02, z + 2.15), E['warm_soft'], '+Y')
        screen('nastaliq', (4.2, 0.02, z + 2.15), 4.4, 0.9, normal='+Y')

        lamp('L_arc', 120, (1.45, 1.55, z + 1.8), (1.0, 0.75, 0.45))
        area('L_nastaliq', 80, (4.2, 0.6), (4.2, 0.12, z + 2.15), (math.radians(-90), 0, 0), (1.0, 0.75, 0.45))
        lamp('L_dressing', 70, (5.6, 1.6, z + 2.6), (1.0, 0.85, 0.7))
        char_light('point', '#ffc08a', 2.0, (2.0, 1.5, z + 2.0), 4.5)
        char_light('point', '#ffd8b0', 1.6, (5.8, 1.6, z + 2.4), 4.0)
        META['looks'] += [[3.1, 1.0, z + 1.05], [7.0, 0.06, z + 1.2], [5.0, 2.5, z + 1.1]]
