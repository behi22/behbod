"""The tea bar: the island with turquoise tiles and a marble top, the samovar and estekans, three stools, pendant
lights, and the tea cabinet at its east end with the girih print, the Persian corner of the loft."""
import math
from lib.core import zone, box, cyl, sphere, plane, tube, collider, point, screen, interact, char_light, lamp, potted, META

IX0, IY0, IX1, IY1 = 9.9, 4.26, 13.1, 5.2
TOP = 0.95


def build(M, E, G):
    with zone('teabar', px=2048):
        cx, cy = (IX0 + IX1) / 2, (IY0 + IY1) / 2
        box('island_base', (IX1 - IX0 - 0.1, IY1 - IY0 - 0.1, TOP - 0.05), (cx, cy, (TOP - 0.05) / 2), M['walnut'], bevel=0.01)
        box('island_tiles', (IX1 - IX0 - 0.14, 0.02, TOP - 0.2), (cx, IY0 + 0.04, (TOP - 0.05) / 2 + 0.05), M['tile'])
        box('island_kick', (IX1 - IX0 - 0.2, 0.06, 0.08), (cx, IY0 + 0.1, 0.04), M['black'])
        box('island_top', (IX1 - IX0, IY1 - IY0, 0.05), (cx, cy, TOP - 0.025), M['marble'], bevel=0.01)
        box('island_led', (IX1 - IX0 - 0.2, 0.012, 0.01), (cx, IY0 - 0.004, TOP - 0.06), E['warm_soft'], kind='emit')
        collider('island', (IX0, IY0, -1), (IX1, IY1, TOP))
        # The samovar on its tray, a teapot on top, estekans and a sugar bowl.
        sx, sy = 11.0, 4.8
        cyl('samovar_tray', 0.24, 0.015, (sx, sy, TOP + 0.008), M['brass'], seg=32)
        cyl('samovar_foot', 0.08, 0.08, (sx, sy, TOP + 0.055), M['brass'], seg=24, r2=0.06)
        cyl('samovar_body', 0.13, 0.3, (sx, sy, TOP + 0.24), M['brass'], seg=32, r2=0.11, smooth=True)
        sphere('samovar_shoulder', 0.11, (sx, sy, TOP + 0.39), M['brass'], sub=2, scale=(1, 1, 0.45))
        cyl('samovar_crown', 0.06, 0.06, (sx, sy, TOP + 0.46), M['brass'], seg=24)
        cyl('samovar_teapot', 0.065, 0.09, (sx, sy, TOP + 0.535), M['white'], seg=24, r2=0.05, smooth=True)
        tube('samovar_tap', [(sx, sy - 0.12, TOP + 0.16), (sx, sy - 0.2, TOP + 0.15), (sx, sy - 0.21, TOP + 0.12)], 0.01, M['brass'])
        for s in (-1, 1):
            tube(f'samovar_handle{s}', [(sx + s * 0.12, sy, TOP + 0.34), (sx + s * 0.18, sy, TOP + 0.32), (sx + s * 0.17, sy, TOP + 0.24)], 0.008, M['black'])
        point('samovar', (sx, sy, TOP + 0.6))
        for i in range(4):
            ex, ey = 11.45 + i * 0.12, 4.62 + (i % 2) * 0.06
            cyl(f'saucer_t{i}', 0.045, 0.005, (ex, ey, TOP + 0.003), M['clockface'])
            cyl(f'estekan_t{i}', 0.02, 0.065, (ex, ey, TOP + 0.037), G['teaglass'], seg=16, kind='glass', r2=0.024)
            cyl(f'tea_t{i}', 0.018, 0.05, (ex, ey, TOP + 0.03), M['tea'], seg=16, r2=0.022)
        cyl('sugar_bowl', 0.05, 0.05, (12.1, 4.75, TOP + 0.025), M['tile'], seg=20, r2=0.06)
        for i in range(5):
            box(f'sugar{i}', (0.012, 0.012, 0.012), (12.08 + (i % 3) * 0.015, 4.74 + (i // 3) * 0.015, TOP + 0.052), M['white'])
        box('baklava_plate', (0.22, 0.14, 0.01), (12.5, 4.7, TOP + 0.005), M['white'], bevel=0.004)
        for i in range(6):
            box(f'baklava{i}', (0.04, 0.04, 0.02), (12.43 + (i % 3) * 0.06, 4.66 + (i // 3) * 0.07, TOP + 0.02), M['gold'], rot=math.pi / 4)
        interact('tea', 'Pour a glass of tea', (11.0, 5.65, 0), r=0.9)
        # Three bar stools on the studio side.
        for i, x in enumerate((10.6, 11.5, 12.4)):
            cyl(f'stool{i}_seat', 0.19, 0.06, (x, 3.88, 0.74), M['leather_brown'], seg=24)
            cyl(f'stool{i}_post', 0.025, 0.7, (x, 3.88, 0.37), M['steel'])
            cyl(f'stool{i}_ring', 0.17, 0.015, (x, 3.88, 0.3), M['steel'], seg=24, cap=False)
            cyl(f'stool{i}_base', 0.2, 0.02, (x, 3.88, 0.01), M['steel'], seg=24)
            collider(f'stool{i}', (x - 0.2, 3.68, -1), (x + 0.2, 4.08, 0.77))
        # Three pendant lights over the island.
        for i, x in enumerate((10.5, 11.5, 12.5)):
            tube(f'pendant{i}_cord', [(x, cy, 6.0), (x, cy, 2.1)], 0.005, M['black'])
            cyl(f'pendant{i}_shade', 0.15, 0.2, (x, cy, 2.0), M['brass'], seg=24, r2=0.05, cap=False)
            sphere(f'pendant{i}_bulb', 0.045, (x, cy, 1.92), E['warm'], sub=2, kind='emit')
            lamp(f'L_pendant{i}', 60, (x, cy, 1.85), (1.0, 0.72, 0.42), soft=0.08)

        # The tea cabinet at the island's east end: turquoise tiles, shelves of tea tins and glasses, the girih print.
        tx = 13.4
        box('tea_cabinet', (0.2, 1.4, 1.9), (tx, 4.7, 0.95), M['walnut'], bevel=0.008)
        box('tea_cabinet_tiles', (0.02, 1.3, 0.9), (tx - 0.11, 4.7, 0.6), M['tile'])
        for k, zz in enumerate((1.2, 1.45)):
            box(f'tea_shelf{k}', (0.16, 1.3, 0.02), (tx - 0.18, 4.7, zz), M['walnut'])
            for j in range(5):
                if (j + k) % 2:
                    cyl(f'tea_tin{k}_{j}', 0.035, 0.11, (tx - 0.18, 4.2 + j * 0.25, zz + 0.065), M['tile' if j % 3 else 'red'], seg=16)
                else:
                    cyl(f'tea_glass{k}_{j}', 0.02, 0.07, (tx - 0.18, 4.2 + j * 0.25, zz + 0.045), G['teaglass'], seg=14, kind='glass', r2=0.025)
        box('girih_frame', (0.025, 0.72, 0.72), (tx - 0.112, 4.7, 1.62 + 0.25), M['frame'], bevel=0.004)
        plane('screen_girih', 0.64, 0.64, (tx - 0.126, 4.7, 1.87), M['paper'], '-X')
        screen('girih', (tx - 0.126, 4.7, 1.87), 0.64, 0.64)
        collider('tea_cabinet', (tx - 0.25, 4.0, -1), (tx + 0.1, 5.4, 1.9))
        char_light('point', '#ffb070', 2.0, (11.5, 4.7, 1.9), 4.0)
        META['looks'] += [[sx, sy, TOP + 0.3], [tx - 0.126, 4.7, 1.87]]
