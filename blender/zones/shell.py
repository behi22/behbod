"""The loft's structure: every floor level, the walls, the glass wall, ceiling and skylight, the mezzanine slab and
rail, the floating stairs, the sunken lounge and its steps, the piano dais and the raised studio."""
import math
from lib.core import zone, box, cyl, plane, ring, tube, collider, floor, area
from zones.layout import *


def disc_floors(cx, cy, r, z, bands=6):
    # A round platform as walkable strips, each as wide as the circle is at its narrowest point in the strip.
    for i in range(bands):
        y0, y1 = cy - r + 2 * r * i / bands, cy - r + 2 * r * (i + 1) / bands
        yn = max(abs(y0 - cy), abs(y1 - cy))
        hw = math.sqrt(max(0.0, r * r - yn * yn))
        if hw > 0.05:
            floor(cx - hw, y0, cx + hw, y1, z)


def build(M, E, G):
    with zone('shell', px=4096):
        x0, y0, x1, y1 = PIT
        # Ground floor around the sunken lounge, as thick slabs whose sides are the lounge's walls.
        for name, (a, b, c, d) in {'n': (0, y1, W, D), 's': (0, 0, W, y0), 'w': (0, y0, x0, y1), 'e': (x1, y0, W, y1)}.items():
            box(f'floor_{name}', (c - a, d - b, 0.6), ((a + c) / 2, (b + d) / 2, -0.3), M['floor'])
            floor(a, b, c, d, 0.0)
        box('floor_pit', (x1 - x0, y1 - y0, 0.2), ((x0 + x1) / 2, (y0 + y1) / 2, PIT_Z - 0.1), M['floor_dark'])
        floor(x0, y0, x1, y1, PIT_Z)
        # Two steps down into the lounge on its east side, each with a warm strip under the nose.
        sx0, sy0, sx1, sy1 = PIT_STEPS
        for i, z in enumerate((-0.15, -0.30)):
            xa, xb = sx1 - 0.3 * (i + 1), sx1 - 0.3 * i
            box(f'pit_step{i}', (0.3, sy1 - sy0, z - PIT_Z), ((xa + xb) / 2, (sy0 + sy1) / 2, (PIT_Z + z) / 2), M['floor'], bevel=0.006)
            floor(xa, sy0, xb, sy1, z)
            box(f'pit_step{i}_led', (0.012, sy1 - sy0 - 0.1, 0.01), (xa - 0.008, (sy0 + sy1) / 2, z - 0.02), E['warm_soft'], kind='emit')
        box('pit_edge_led', (0.012, sy1 - sy0 - 0.1, 0.01), (x1 - 0.008, (sy0 + sy1) / 2, -0.02), E['warm_soft'], kind='emit')
        # The lounge's edges are walls from inside it, except where the steps are.
        collider('pit_edge_n', (x0, y1, -1), (x1, y1 + 0.05, 0.0))
        collider('pit_edge_s', (x0, y0 - 0.05, -1), (x1, y0, 0.0))
        collider('pit_edge_w', (x0 - 0.05, y0, -1), (x0, y1, 0.0))
        collider('pit_edge_e1', (sx1 - 0.6, y0, -1), (x1 + 0.05, sy0, 0.0))
        collider('pit_edge_e2', (sx1 - 0.6, sy1, -1), (x1 + 0.05, y1, 0.0))

        # The piano dais: a round step and a round top under the skylight.
        cx, cy, r1, r0 = DAIS
        cyl('dais_step', r1, 0.15, (cx, cy, 0.075), M['walnut'], seg=72)
        cyl('dais_top', r0, 0.15, (cx, cy, 0.225), M['walnut'], seg=72)
        ring('dais_led', r1 - 0.005, r1 + 0.006, 0.13, 0.14, (cx, cy, 0), E['warm_soft'], seg=72, kind='emit')
        ring('dais_led2', r0 - 0.005, r0 + 0.006, 0.28, 0.29, (cx, cy, 0), E['warm_soft'], seg=72, kind='emit')
        disc_floors(cx, cy, r1, 0.15)
        disc_floors(cx, cy, r0, DAIS_Z)

        # The raised studio, with steps cut into its north edge.
        a, b, c, d = STUDIO
        qa, qb, qc, qd = STUDIO_STEPS
        box('studio_w', (qa - a, d - b, STUDIO_Z), ((a + qa) / 2, (b + d) / 2, STUDIO_Z / 2), M['floor'])
        box('studio_e', (c - qc, d - b, STUDIO_Z), ((qc + c) / 2, (b + d) / 2, STUDIO_Z / 2), M['floor'])
        box('studio_mid', (qc - qa, qb - b, STUDIO_Z), ((qa + qc) / 2, (b + qb) / 2, STUDIO_Z / 2), M['floor'])
        floor(a, b, qa, d, STUDIO_Z)
        floor(qc, b, c, d, STUDIO_Z)
        floor(qa, b, qc, qb, STUDIO_Z)
        for i, z in enumerate((0.15, 0.30)):
            ya, yb = qd - 0.25 * (i + 1), qd - 0.25 * i
            box(f'studio_step{i}', (qc - qa, 0.25, z), ((qa + qc) / 2, (ya + yb) / 2, z / 2), M['floor'], bevel=0.006)
            floor(qa, ya, qc, yb, z)
            box(f'studio_step{i}_led', (qc - qa - 0.1, 0.012, 0.01), ((qa + qc) / 2, yb - 0.008, z - 0.02), E['warm_soft'], kind='emit')
        box('studio_edge_led', (qa - a - 0.1, 0.012, 0.01), ((a + qa) / 2, d + 0.004, STUDIO_Z - 0.02), E['rgb_purple'], kind='emit')
        box('studio_edge_led2', (c - qc - 0.1, 0.012, 0.01), ((qc + c) / 2, d + 0.004, STUDIO_Z - 0.02), E['rgb_purple'], kind='emit')
        box('studio_edge_led3', (0.012, d - b - 0.1, 0.01), (a - 0.004, (b + d) / 2, STUDIO_Z - 0.02), E['rgb_purple'], kind='emit')
        collider('studio_riser_w', (a - 0.05, b, -1), (qa, d + 0.05, STUDIO_Z))
        collider('studio_riser_e', (qc, b, -1), (c, d + 0.05, STUDIO_Z))

        # Walls: south (with the front door and the secret door in the bookshelf), west, east.
        fa, fb = FRONT_DOOR
        sa, sb = SECRET_DOOR
        for name, (a, b) in {'s1': (-WALL, fa), 's2': (fb, sa), 's3': (sb, W + WALL)}.items():
            box(f'wall_{name}', (b - a, WALL, H), ((a + b) / 2, -WALL / 2, H / 2), M['wall'])
        box('wall_s_door_head', (fb - fa, WALL, H - 2.2), ((fa + fb) / 2, -WALL / 2, 2.2 + (H - 2.2) / 2), M['wall'])
        box('wall_s_secret_head', (sb - sa, WALL, H - 2.1), ((sa + sb) / 2, -WALL / 2, 2.1 + (H - 2.1) / 2), M['wall'])
        box('wall_w', (WALL, D, H), (-WALL / 2, D / 2, H / 2), M['wall'])
        box('wall_e', (WALL, D, H), (W + WALL / 2, D / 2, H / 2), M['brick'])
        # The front door, closed, with a brass handle.
        box('front_door', (fb - fa - 0.04, 0.06, 2.16), ((fa + fb) / 2, 0.02, 1.08), M['walnut'], bevel=0.01)
        cyl('front_door_handle', 0.018, 0.14, (fb - 0.12, 0.07, 1.05), M['brass'], seg=12)
        collider('front_door', (fa, -0.3, -1), (fb, 0.08, 2.3))
        collider('wall_s', (-1, -1, -1), (sa, 0.0, H))
        collider('wall_s_b', (sb, -1, -1), (W + 1, 0.0, H))
        collider('wall_s_secret_head', (sa, -1, 2.1), (sb, 0.0, H))
        collider('wall_w', (-1, -1, -1), (0.0, D + 1, H))
        collider('wall_e', (W, -1, -1), (W + 1, D + 1, H))
        box('plinth_s', (W, 0.02, 0.08), (W / 2, 0.01, 0.04), M['plinth'])
        box('plinth_w', (0.02, D, 0.08), (0.01, D / 2, 0.04), M['plinth'])

        # The glass wall: double-height glass on a black frame, with a sliding door to the balcony (one panel open).
        da, db = SLIDING_DOOR
        for i in range(9):
            x = i * 2.0
            box(f'mullion{i}', (0.08, 0.14, H), (x, D + 0.05, H / 2), M['black'])
        box('glass_transom', (W, 0.14, 0.08), (W / 2, D + 0.05, 3.0), M['black'])
        box('glass_head', (W, 0.16, 0.1), (W / 2, D + 0.05, H - 0.05), M['black'])
        box('glass_sill', (W, 0.2, 0.04), (W / 2, D + 0.05, 0.02), M['black'])
        plane('window_glass', W, H, (W / 2, D + 0.06, H / 2), G['window'], '-Y', kind='glass')
        box('slider_frame_a', (1.02, 0.05, 2.3), ((da + da + 1) / 2, D + 0.13, 1.15), M['black'])
        box('slider_frame_b', (1.02, 0.05, 2.3), ((da + 1 + da) / 2 + 0.02, D + 0.19, 1.15), M['black'])
        collider('glass_w', (-1, D, -1), (da + 1.0, D + 0.3, H))
        collider('glass_e', (db, D, -1), (W + 1, D + 0.3, H))
        collider('glass_above_door', (da + 1.0, D, 2.3), (db, D + 0.3, H))
        floor(da + 1.0, D - 0.1, db, D + 0.4, 0.0)

        # Ceiling at 6 m with the skylight over the piano.
        ka, kb, kc, kd = SKYLIGHT
        for name, (a, b, c, d) in {'w': (0, 0, ka, D), 'e': (kc, 0, W, D), 's': (ka, 0, kc, kb), 'n': (ka, kd, kc, D)}.items():
            box(f'ceiling_{name}', (c - a, d - b, 0.2), ((a + c) / 2, (b + d) / 2, H + 0.1), M['ceiling'])
        for name, (a, b, c, d) in {'w': (ka - 0.06, kb, ka, kd), 'e': (kc, kb, kc + 0.06, kd), 's': (ka, kb - 0.06, kc, kb), 'n': (ka, kd, kc, kd + 0.06)}.items():
            box(f'skylight_frame_{name}', (c - a, d - b, 0.5), ((a + c) / 2, (b + d) / 2, H + 0.25), M['black'])
        plane('skylight_glass', kc - ka, kd - kb, ((ka + kc) / 2, (kb + kd) / 2, H + 0.45), G['glass'], '+Z', kind='glass')
        plane('skylight_sky', kc - ka + 0.4, kd - kb + 0.4, ((ka + kc) / 2, (kb + kd) / 2, H + 1.2), E['sky'], '+Z', kind='emit')
        # Exposed beams across the double-height part.
        for i, y in enumerate((4.0, 6.0, 9.5)):
            box(f'beam{i}', (W, 0.18, 0.3), (W / 2, y, H - 0.15), M['walnut'])

        # The mezzanine slab over the entry and the bookshelf, edged in walnut, with a glass rail.
        a, b, c, d = MEZZ
        box('mezz_slab', (c - a, d - b, MEZZ_Z - MEZZ_UNDER), ((a + c) / 2, (b + d) / 2, (MEZZ_Z + MEZZ_UNDER) / 2), M['ceiling'])
        box('mezz_floor', (c - a, d - b, 0.03), ((a + c) / 2, (b + d) / 2, MEZZ_Z - 0.015), M['oak'])
        box('mezz_fascia_n', (c - a, 0.03, MEZZ_Z - MEZZ_UNDER + 0.02), ((a + c) / 2, d + 0.015, (MEZZ_Z + MEZZ_UNDER) / 2), M['walnut'])
        box('mezz_fascia_e', (0.03, d - b, MEZZ_Z - MEZZ_UNDER + 0.02), (c + 0.015, (b + d) / 2, (MEZZ_Z + MEZZ_UNDER) / 2), M['walnut'])
        box('mezz_under_led', (c - a - 0.2, 0.012, 0.012), ((a + c) / 2, d - 0.03, MEZZ_UNDER - 0.006), E['warm_soft'], kind='emit')
        floor(a, b, c, d, MEZZ_Z)
        # The slab as a solid too, so the camera stays under it in the entry hall.
        collider('mezz_slab', (a, b, MEZZ_UNDER), (c, d, MEZZ_Z))
        st0, st1 = STAIRS
        for name, (p, q) in {'rail_n1': ((a, d), (st0, d)), 'rail_n2': ((st1, d), (c, d)), 'rail_e': ((c, b), (c, d))}.items():
            (px, py), (qx, qy) = p, q
            horiz = abs(qy - py) < 1e-6
            size = (abs(qx - px), 0.02, 1.0) if horiz else (0.02, abs(qy - py), 1.0)
            box(f'mezz_{name}', size, ((px + qx) / 2, (py + qy) / 2 - (0.02 if horiz else 0), MEZZ_Z + 0.5), G['glass'], kind='glass')
            tube(f'mezz_{name}_cap', [(px, py - (0.02 if horiz else 0), MEZZ_Z + 1.02), (qx, qy - (0.02 if horiz else 0), MEZZ_Z + 1.02)], 0.022, M['steel'])
            collider(f'mezz_{name}', (min(px, qx) - 0.04, min(py, qy) - 0.06, MEZZ_Z), (max(px, qx) + 0.04, max(py, qy) + 0.02, MEZZ_Z + 1.1))

        # Floating stairs: walnut treads on a steel spine, a handrail on the open side, a warm strip under each nose.
        n = STAIR_N
        rise, run = MEZZ_Z / n, (STAIR_Y0 - STAIR_Y1) / n
        for i in range(n):
            yb, ya = STAIR_Y0 - run * i, STAIR_Y0 - run * (i + 1)
            z = rise * (i + 1)
            box(f'tread{i}', (st1 - st0, run + 0.02, 0.06), ((st0 + st1) / 2, (ya + yb) / 2, z - 0.03), M['walnut'], bevel=0.004)
            box(f'tread{i}_led', (st1 - st0 - 0.1, 0.01, 0.01), ((st0 + st1) / 2, yb - 0.004, z - 0.065), E['warm_soft'], kind='emit')
            floor(st0, ya, st1, yb, z)
        spine = [((st0 + st1) / 2, STAIR_Y0 + 0.05, 0.0), ((st0 + st1) / 2, STAIR_Y1, MEZZ_Z - 0.1)]
        tube('stair_spine', spine, 0.07, M['steel'], seg=12)
        rail = [(st1 - 0.03, STAIR_Y0 + 0.1, 0.95), (st1 - 0.03, STAIR_Y1, MEZZ_Z + 0.95)]
        tube('stair_rail', rail, 0.02, M['steel'])
        for i in range(0, n, 3):
            yb = STAIR_Y0 - run * (i + 0.5)
            z = rise * (i + 1)
            tube(f'stair_post{i}', [(st1 - 0.03, yb, z), (st1 - 0.03, yb, z + 0.95)], 0.012, M['steel'])
        collider('stair_rail', (st1 - 0.05, STAIR_Y1, 0.2), (st1 + 0.02, STAIR_Y0, MEZZ_Z + 1.0))

        # Bake light: the city and the moon through the glass, the skylight, and a soft fill so no corner is black.
        area('L_glass', 950, (W, H - 0.4), (W / 2, D - 0.1, H / 2), (math.radians(-90), 0, 0), (0.55, 0.66, 1.0))
        area('L_skylight', 260, (kc - ka, kd - kb), ((ka + kc) / 2, (kb + kd) / 2, H - 0.05), (0, 0, 0), (0.7, 0.8, 1.0))
        area('L_fill', 240, (W - 1, D - 1), (W / 2, D / 2, H - 0.35), (0, 0, 0), (0.72, 0.78, 1.0))
        area('L_under_mezz', 90, (9.4, 2.6), (4.9, 1.5, MEZZ_UNDER - 0.05), (0, 0, 0), (1.0, 0.82, 0.6))
