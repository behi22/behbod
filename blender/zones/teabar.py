"""The tea bar: the island with turquoise tiles and a marble top, the samovar and estekans, three stools, brass lamps,
and the tea cabinet at its east end with the girih print, the Persian corner of the loft."""
import math
from lib.core import zone, box, cyl, sphere, plane, tube, collider, point, screen, interact, seat, char_light, lamp, META
from zones.layout import TEABAR

TOP = 0.95


def build(M, E, G):
    IX0, IY0, IX1, IY1 = TEABAR
    with zone('teabar', px=2048):
        cx, cy = (IX0 + IX1) / 2, (IY0 + IY1) / 2
        box('island_base', (IX1 - IX0 - 0.1, IY1 - IY0 - 0.1, TOP - 0.05), (cx, cy, (TOP - 0.05) / 2), M['walnut'], bevel=0.01)
        box('island_tiles', (IX1 - IX0 - 0.14, 0.02, TOP - 0.2), (cx, IY0 + 0.04, (TOP - 0.05) / 2 + 0.05), M['tile'])
        box('island_kick', (IX1 - IX0 - 0.2, 0.06, 0.08), (cx, IY0 + 0.1, 0.04), M['black'])
        box('island_top', (IX1 - IX0, IY1 - IY0, 0.05), (cx, cy, TOP - 0.025), M['marble'], bevel=0.01)
        box('island_led', (IX1 - IX0 - 0.2, 0.012, 0.01), (cx, IY0 - 0.004, TOP - 0.06), E['warm_soft'], kind='emit')
        collider('island', (IX0, IY0, -1), (IX1, IY1, TOP))
        # The samovar on its tray, a teapot on top, estekans, a sugar bowl, baklava.
        sx, sy = IX0 + 0.9, cy + 0.1
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
            ex, ey = sx + 0.45 + i * 0.12, cy - 0.08 + (i % 2) * 0.06
            cyl(f'saucer_t{i}', 0.045, 0.005, (ex, ey, TOP + 0.003), M['clockface'])
            cyl(f'estekan_t{i}', 0.02, 0.065, (ex, ey, TOP + 0.037), G['teaglass'], seg=16, kind='glass', r2=0.024)
            cyl(f'tea_t{i}', 0.018, 0.05, (ex, ey, TOP + 0.03), M['tea'], seg=16, r2=0.022)
        cyl('sugar_bowl', 0.05, 0.05, (sx + 1.1, cy, TOP + 0.025), M['tile'], seg=20, r2=0.06)
        box('baklava_plate', (0.22, 0.14, 0.01), (sx + 1.55, cy - 0.05, TOP + 0.005), M['white'], bevel=0.004)
        for i in range(6):
            box(f'baklava{i}', (0.04, 0.04, 0.02), (sx + 1.48 + (i % 3) * 0.06, cy - 0.09 + (i // 3) * 0.07, TOP + 0.02), M['gold'], rot=math.pi / 4)
        # Two brass lamps on the island light it, so nothing hangs from the ceiling.
        for i, x in enumerate((IX0 + 0.3, IX1 - 0.35)):
            cyl(f'tea_lamp{i}_base', 0.07, 0.02, (x, cy + 0.2, TOP + 0.01), M['brass'], seg=20)
            cyl(f'tea_lamp{i}_stem', 0.01, 0.38, (x, cy + 0.2, TOP + 0.2), M['brass'])
            cyl(f'tea_lamp{i}_shade', 0.12, 0.14, (x, cy + 0.2, TOP + 0.43), M['lampshade'], seg=24, r2=0.07, cap=False)
            sphere(f'tea_lamp{i}_bulb', 0.03, (x, cy + 0.2, TOP + 0.42), E['warm'], sub=1, kind='emit')
            lamp(f'L_tea_lamp{i}', 45, (x, cy + 0.2, TOP + 0.42), (1.0, 0.72, 0.42), soft=0.06)
        interact('tea', 'Pour a glass of tea', (sx, IY1 + 0.55, 0), r=0.6)
        # Three bar stools on the studio side, each a place to sit.
        for i, x in enumerate((IX0 + 0.4, IX0 + 1.2, IX0 + 2.0)):
            cyl(f'stool{i}_seat', 0.19, 0.06, (x, IY0 - 0.45, 0.74), M['leather_brown'], seg=24)
            cyl(f'stool{i}_post', 0.025, 0.7, (x, IY0 - 0.45, 0.37), M['steel'])
            cyl(f'stool{i}_ring', 0.17, 0.015, (x, IY0 - 0.45, 0.3), M['steel'], seg=24, cap=False)
            cyl(f'stool{i}_base', 0.2, 0.02, (x, IY0 - 0.45, 0.01), M['steel'], seg=24)
            collider(f'stool{i}', (x - 0.2, IY0 - 0.65, -1), (x + 0.2, IY0 - 0.25, 0.77))
        seat('stool', 'Sit at the tea bar', (IX0 + 2.75, IY0 - 0.45, 0), (IX0 + 2.0, IY0 - 0.45, 0.3), 90)

        # The tea cabinet at the island's east end: turquoise tiles, shelves of tins and glasses, the girih print.
        tx = IX1 + 0.4
        box('tea_cabinet', (0.2, 1.4, 1.9), (tx, cy, 0.95), M['walnut'], bevel=0.008)
        box('tea_cabinet_tiles', (0.02, 1.3, 0.9), (tx - 0.11, cy, 0.6), M['tile'])
        for k, zz in enumerate((1.2, 1.45)):
            box(f'tea_shelf{k}', (0.16, 1.3, 0.02), (tx - 0.18, cy, zz), M['walnut'])
            for j in range(5):
                if (j + k) % 2:
                    cyl(f'tea_tin{k}_{j}', 0.035, 0.11, (tx - 0.18, cy - 0.5 + j * 0.25, zz + 0.065), M['tile' if j % 3 else 'red'], seg=16)
                else:
                    cyl(f'tea_glass{k}_{j}', 0.02, 0.07, (tx - 0.18, cy - 0.5 + j * 0.25, zz + 0.045), G['teaglass'], seg=14, kind='glass', r2=0.025)
        box('girih_frame', (0.025, 0.72, 0.72), (tx - 0.112, cy, 2.27), M['frame'], bevel=0.004)
        plane('screen_girih', 0.64, 0.64, (tx - 0.126, cy, 2.27), M['paper'], '-X')
        screen('girih', (tx - 0.126, cy, 2.27), 0.64, 0.64)
        box('tea_cabinet_top_lamp', (0.14, 0.5, 0.03), (tx - 0.05, cy, 1.95), M['brass'])
        box('tea_cabinet_glow', (0.02, 0.46, 0.01), (tx - 0.12, cy, 1.93), E['warm_soft'], kind='emit')
        collider('tea_cabinet', (tx - 0.26, cy - 0.7, -1), (tx + 0.1, cy + 0.7, 1.9))
        char_light('point', '#ffb070', 2.0, (cx, cy, 1.9), 4.0)
        META['looks'] += [[sx, sy, TOP + 0.3], [tx - 0.126, cy, 2.27]]
