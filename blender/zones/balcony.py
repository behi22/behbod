"""The balcony over the bay: the deck, the glass railing, planters, string lights between two posts, the telescope, the
backgammon table with two chairs, two deck chairs, and the gull on the railing."""
import math
from lib.core import zone, box, cyl, sphere, plane, tube, collider, floor, point, interact, seat, char_light, lamp, potted, META
from zones.layout import BALCONY


def build(M, E, G):
    with zone('balcony', px=2048):
        x0, y0, x1, y1 = BALCONY
        y0 += 0.15
        box('deck', (x1 - x0, y1 - y0, 0.2), ((x0 + x1) / 2, (y0 + y1) / 2, -0.1), M['deck'])
        box('deck_edge', (x1 - x0, 0.06, 0.3), ((x0 + x1) / 2, y1 + 0.03, -0.15), M['black'])
        floor(x0, y0, x1, y1, 0.0)
        for name, size, c in (('n', (x1 - x0, 0.02, 1.05), ((x0 + x1) / 2, y1 - 0.02, 0.525)),
                              ('w', (0.02, y1 - y0, 1.05), (x0 + 0.01, (y0 + y1) / 2, 0.525)),
                              ('e', (0.02, y1 - y0, 1.05), (x1 - 0.01, (y0 + y1) / 2, 0.525))):
            box(f'bal_glass_{name}', size, c, G['glass'], kind='glass')
        tube('bal_cap_n', [(x0, y1 - 0.02, 1.07), (x1, y1 - 0.02, 1.07)], 0.03, M['walnut'])
        tube('bal_cap_w', [(x0 + 0.01, y0, 1.07), (x0 + 0.01, y1, 1.07)], 0.03, M['walnut'])
        tube('bal_cap_e', [(x1 - 0.01, y0, 1.07), (x1 - 0.01, y1, 1.07)], 0.03, M['walnut'])
        collider('bal_rail_n', (x0 - 0.2, y1 - 0.05, -1), (x1 + 0.2, y1 + 0.3, 1.2), structure=True)
        collider('bal_rail_w', (x0 - 0.3, y0 - 0.2, -1), (x0 + 0.03, y1, 1.2), structure=True)
        collider('bal_rail_e', (x1 - 0.03, y0 - 0.2, -1), (x1 + 0.3, y1, 1.2), structure=True)
        # Planters at both ends of the railing.
        for name, (a, b) in {'w': (x0 + 0.2, x0 + 2.4), 'e': (x1 - 2.4, x1 - 0.2)}.items():
            box(f'planter_{name}', (b - a, 0.3, 0.4), ((a + b) / 2, y1 - 0.25, 0.2), M['concrete'], bevel=0.01)
            for k in range(7):
                sphere(f'planter_{name}_bush{k}', 0.16, (a + 0.15 + k * (b - a - 0.3) / 6, y1 - 0.25, 0.5), M['leaf' if k % 2 else 'leaf2'], sub=2, scale=(1.2, 0.9, 0.8))
            collider(f'planter_{name}', (a, y1 - 0.4, -1), (b, y1 - 0.1, 0.6))
        # String lights on two posts at the railing's corners, sagging between them.
        for i, px in enumerate((x0 + 0.35, x1 - 0.35)):
            tube(f'bal_post{i}', [(px, y1 - 0.55, 0), (px, y1 - 0.55, 2.6)], 0.03, M['black'])
            collider(f'bal_post{i}', (px - 0.05, y1 - 0.6, -1), (px + 0.05, y1 - 0.5, 2.6))
        pts = [(x0 + 0.35 + (x1 - x0 - 0.7) * t, y1 - 0.55, 2.55 - 0.5 * math.sin(math.pi * t)) for t in (k / 40 for k in range(41))]
        tube('string_lights', pts, 0.004, M['black'])
        for k in range(2, 40, 3):
            p = pts[k]
            sphere(f'bulb{k}', 0.03, (p[0], p[1], p[2] - 0.05), E['warm'], sub=1, kind='emit')
        # The telescope on its tripod, pointing up over the bay.
        tx, ty = 7.5, 16.7
        for k in range(3):
            a = k * 2 * math.pi / 3
            tube(f'tripod{k}', [(tx + math.cos(a) * 0.38, ty + math.sin(a) * 0.38, 0), (tx, ty, 1.05)], 0.015, M['black'])
        box('tele_mount', (0.12, 0.12, 0.1), (tx, ty, 1.1), M['black'], bevel=0.01)
        tube('telescope', [(tx - 0.1, ty - 0.35, 0.95), (tx + 0.05, ty + 0.45, 1.5)], 0.07, M['white'], seg=16, kind='emit')
        tube('tele_dew', [(tx + 0.05, ty + 0.45, 1.5), (tx + 0.08, ty + 0.6, 1.6)], 0.075, M['black'], seg=16, kind='emit')
        tube('tele_eyepiece', [(tx - 0.08, ty - 0.33, 1.0), (tx - 0.14, ty - 0.38, 1.06)], 0.018, M['black'], kind='emit')
        point('telescope', (tx, ty, 1.2))
        collider('telescope', (tx - 0.4, ty - 0.4, -1), (tx + 0.4, ty + 0.4, 1.4))
        interact('telescope', 'Look through the telescope', (tx, ty - 0.95, 0), r=0.55)
        # Backgammon on a bistro table with two chairs.
        bx, by = 15.0, 16.6
        cyl('bistro_top', 0.45, 0.03, (bx, by, 0.74), M['walnut'], seg=32)
        cyl('bistro_post', 0.03, 0.72, (bx, by, 0.37), M['black'])
        cyl('bistro_foot', 0.25, 0.02, (bx, by, 0.01), M['black'], seg=24)
        box('backgammon', (0.5, 0.36, 0.04), (bx, by, 0.775), M['walnut'], bevel=0.005)
        plane('screen_backgammon', 0.46, 0.32, (bx, by, 0.797), M['oak'], '+Z')
        collider('bistro', (bx - 0.45, by - 0.45, -1), (bx + 0.45, by + 0.45, 0.76))
        for s in (-1, 1):
            cx = bx + s * 0.8
            box(f'bistro_chair{s}_seat', (0.4, 0.4, 0.04), (cx, by, 0.46), M['black'], bevel=0.01)
            box(f'bistro_chair{s}_back', (0.04, 0.4, 0.45), (cx + s * 0.2, by, 0.7), M['black'], bevel=0.01)
            for lx in (-0.17, 0.17):
                for ly in (-0.17, 0.17):
                    cyl(f'bistro_chair{s}_leg{lx}{ly}', 0.012, 0.45, (cx + lx, by + ly, 0.225), M['black'])
            collider(f'bistro_chair{s}', (cx - 0.22, by - 0.22, -1), (cx + 0.22, by + 0.22, 0.48))
        interact('backgammon', 'Play backgammon', (bx, by - 0.95, 0), r=0.55)
        # Two deck chairs facing the water.
        for i, cx in enumerate((4.6, 5.8)):
            box(f'deck_chair{i}_seat', (0.6, 0.7, 0.06), (cx, 16.3, 0.32), M['oak'], tilt=(math.radians(-8), 0, 0))
            box(f'deck_chair{i}_back', (0.6, 0.08, 0.6), (cx, 15.95, 0.6), M['oak'], tilt=(math.radians(25), 0, 0))
            box(f'deck_chair{i}_cushion', (0.54, 0.62, 0.05), (cx, 16.3, 0.37), M['cushion_teal' if i else 'cushion_rust'], bevel=0.02, tilt=(math.radians(-8), 0, 0))
            collider(f'deck_chair{i}', (cx - 0.32, 15.85, -1), (cx + 0.32, 16.68, 0.4))
            seat(f'deck_chair{i}', 'Sit and watch the bay', (cx, 17.1, 0), (cx, 16.25, 0.0), 90)
        # The gull on the railing (the page lets it fly off now and then).
        gx, gy = 12.8, y1 - 0.02
        sphere('gull_body', 0.08, (gx, gy, 1.18), M['white'], sub=2, scale=(1.6, 0.8, 0.8), kind='emit')
        sphere('gull_head', 0.045, (gx + 0.11, gy, 1.24), M['white'], sub=2, kind='emit')
        cyl('gull_beak', 0.012, 0.05, (gx + 0.165, gy, 1.235), M['lego_y'], axis='X', r2=0.002, kind='emit', seg=8)
        box('gull_wing', (0.16, 0.18, 0.02), (gx - 0.02, gy, 1.2), M['concrete'], kind='emit')
        point('gull', (gx, gy, 1.12))
        potted('bal_plant', (18.3, 15.6, 0), M, r=0.25, h=0.6, mat='concrete', leaves=12, size=0.24)
        lamp('L_balcony', 80, (11.0, 16.5, 2.4), (1.0, 0.75, 0.45))
        char_light('point', '#ffc08a', 1.6, (11.0, 16.5, 2.4), 7.0)
        META['looks'] += [[tx, ty, 1.2], [gx, gy, 1.2]]
