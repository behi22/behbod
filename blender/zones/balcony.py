"""The balcony over the bay: the deck, the glass railing, planters, string lights, the telescope, the backgammon table
with two chairs, and the gull on the railing."""
import math
from lib.core import zone, box, cyl, sphere, plane, tube, collider, floor, point, interact, char_light, lamp, potted, META
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
        collider('bal_rail_n', (x0 - 0.2, y1 - 0.05, -1), (x1 + 0.2, y1 + 0.3, 1.2))
        collider('bal_rail_w', (x0 - 0.3, y0 - 0.2, -1), (x0 + 0.03, y1, 1.2))
        collider('bal_rail_e', (x1 - 0.03, y0 - 0.2, -1), (x1 + 0.3, y1, 1.2))
        # Planters along the railing.
        for name, (a, b) in {'w': (2.2, 4.4), 'e': (11.6, 13.8)}.items():
            box(f'planter_{name}', (b - a, 0.3, 0.4), ((a + b) / 2, y1 - 0.25, 0.2), M['concrete'], bevel=0.01)
            for k in range(7):
                sphere(f'planter_{name}_bush{k}', 0.16, (a + 0.15 + k * (b - a - 0.3) / 6, y1 - 0.25, 0.5), M['leaf' if k % 2 else 'leaf2'], sub=2, scale=(1.2, 0.9, 0.8))
            collider(f'planter_{name}', (a, y1 - 0.4, -1), (b, y1 - 0.1, 0.6))
        # String lights from the glass wall's frame out to two posts by the railing.
        for i, px in enumerate((3.0, 13.0)):
            tube(f'bal_post{i}', [(px, y1 - 0.5, 0), (px, y1 - 0.5, 2.6)], 0.03, M['black'])
        for i in range(8):
            t0 = i / 8
            pts = []
            for k in range(13):
                t = k / 12
                x = 3.0 + 10.0 * (t0 + t / 8)
                y = 12.2 + (y1 - 0.5 - 12.2) * (0.5 + 0.5 * math.sin(math.pi * (t0 + t / 8)))
                pts.append((x, y, 2.6 - 0.25 * math.sin(math.pi * t)))
            tube(f'string{i}', pts, 0.004, M['black'])
            for k in (3, 9):
                p = pts[k]
                sphere(f'bulb{i}_{k}', 0.03, (p[0], p[1], p[2] - 0.05), E['warm'], sub=1, kind='emit')
        # The telescope on its tripod, pointing up over the bay.
        tx, ty = 8.0, 13.3
        for k in range(3):
            a = k * 2 * math.pi / 3
            tube(f'tripod{k}', [(tx + math.cos(a) * 0.38, ty + math.sin(a) * 0.38, 0), (tx, ty, 1.05)], 0.015, M['black'])
        box('tele_mount', (0.12, 0.12, 0.1), (tx, ty, 1.1), M['black'], bevel=0.01)
        tube('telescope', [(tx - 0.1, ty - 0.35, 0.95), (tx + 0.05, ty + 0.45, 1.5)], 0.07, M['white'], seg=16)
        tube('tele_dew', [(tx + 0.05, ty + 0.45, 1.5), (tx + 0.08, ty + 0.6, 1.6)], 0.075, M['black'], seg=16)
        tube('tele_eyepiece', [(tx - 0.08, ty - 0.33, 1.0), (tx - 0.14, ty - 0.38, 1.06)], 0.018, M['black'])
        point('telescope', (tx, ty, 1.2))
        collider('telescope', (tx - 0.4, ty - 0.4, -1), (tx + 0.4, ty + 0.4, 1.4))
        interact('telescope', 'Look through the telescope', (tx, ty - 0.9, 0), r=0.9)
        # Backgammon on a bistro table with two chairs.
        bx, by = 10.4, 13.3
        cyl('bistro_top', 0.45, 0.03, (bx, by, 0.74), M['walnut'], seg=32)
        cyl('bistro_post', 0.03, 0.72, (bx, by, 0.37), M['black'])
        cyl('bistro_foot', 0.25, 0.02, (bx, by, 0.01), M['black'], seg=24)
        box('backgammon', (0.5, 0.36, 0.04), (bx, by, 0.775), M['walnut'], bevel=0.005)
        plane('screen_backgammon', 0.46, 0.32, (bx, by, 0.797), M['oak'], '+Z')
        for k in range(12):
            cyl(f'checker{k}', 0.016, 0.008, (bx - 0.2 + (k % 6) * 0.03, by - 0.13 + (k // 6) * 0.26, 0.803), M['white' if k < 6 else 'black'], seg=12, kind='emit')
        collider('bistro', (bx - 0.45, by - 0.45, -1), (bx + 0.45, by + 0.45, 0.76))
        for s in (-1, 1):
            cx = bx + s * 0.75
            box(f'bistro_chair{s}_seat', (0.4, 0.4, 0.04), (cx, by, 0.46), M['black'], bevel=0.01)
            box(f'bistro_chair{s}_back', (0.04, 0.4, 0.45), (cx + s * 0.2, by, 0.7), M['black'], bevel=0.01)
            for lx in (-0.17, 0.17):
                for ly in (-0.17, 0.17):
                    cyl(f'bistro_chair{s}_leg{lx}{ly}', 0.012, 0.45, (cx + lx, by + ly, 0.225), M['black'])
            collider(f'bistro_chair{s}', (cx - 0.22, by - 0.22, -1), (cx + 0.22, by + 0.22, 0.48))
        interact('backgammon', 'Play backgammon', (bx, by - 0.85, 0), r=0.9)
        # The gull on the railing (the page lets it fly off now and then).
        gx, gy = 12.8, y1 - 0.02
        sphere('gull_body', 0.08, (gx, gy, 1.18), M['white'], sub=2, scale=(1.6, 0.8, 0.8), kind='emit')
        sphere('gull_head', 0.045, (gx + 0.11, gy, 1.24), M['white'], sub=2, kind='emit')
        cyl('gull_beak', 0.012, 0.05, (gx + 0.165, gy, 1.235), M['lego_y'], axis='X', r2=0.002, kind='emit', seg=8)
        box('gull_wing', (0.16, 0.18, 0.02), (gx - 0.02, gy, 1.2), M['concrete'], kind='emit')
        point('gull', (gx, gy, 1.12))
        potted('bal_plant', (13.4, 12.6, 0), M, r=0.25, h=0.6, mat='concrete', leaves=12, size=0.24)
        lamp('L_balcony', 80, (8.0, 13.3, 2.4), (1.0, 0.75, 0.45))
        char_light('point', '#ffc08a', 1.6, (8.0, 13.3, 2.4), 6.0)
        META['looks'] += [[tx, ty, 1.2], [gx, gy, 1.2]]
