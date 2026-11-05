"""The holo range behind the bookshelf: a dark room with three lanes, a counter with the holo console, glowing lane
lines, holo targets at the far end, the scoreboard, and a second hidden door for the secret room."""
import math
from lib.core import zone, box, cyl, sphere, plane, collider, floor, point, screen, interact, char_light, area, META
from zones.layout import RANGE, SECRET_DOOR


def build(M, E, G):
    with zone('range', px=2048):
        x0, y0, x1, y1 = RANGE
        Hr = 3.0
        box('range_floor', (x1 - x0 + 0.4, y1 - y0 + 0.4, 0.2), ((x0 + x1) / 2, (y0 + y1) / 2, -0.1), M['concrete'])
        floor(x0, y0, x1, y1 + 0.25, 0.0)
        # The ceiling stops at the back of the loft's wall: running into it showed through on the studio side.
        box('range_ceiling', (x1 - x0 + 0.4, y1 - y0 + 0.2, 0.2), ((x0 + x1) / 2, (y0 + y1) / 2 - 0.1, Hr + 0.1), M['wall_dark'])
        box('range_wall_s', (x1 - x0 + 0.4, 0.2, Hr), ((x0 + x1) / 2, y0 - 0.1, Hr / 2), M['wall_dark'])
        box('range_wall_w', (0.2, y1 - y0, Hr), (x0 - 0.1, (y0 + y1) / 2, Hr / 2), M['wall_dark'])
        box('range_wall_e', (0.2, y1 - y0, Hr), (x1 + 0.1, (y0 + y1) / 2, Hr / 2), M['wall_dark'])
        collider('range_wall_s', (x0 - 1, y0 - 1, -1), (x1 + 1, y0, Hr), structure=True)
        collider('range_wall_w', (x0 - 1, y0, -1), (x0, y1, Hr), structure=True)
        collider('range_wall_e', (x1, y0, -1), (x1 + 1, y1, Hr), structure=True)
        # The counter across the room just inside the door, with the holo console on it; a gap at the north end.
        sa, sb = SECRET_DOOR
        cx = sb + 0.9
        box('range_counter', (0.5, y1 - y0 - 0.9, 1.05), (cx, y0 + (y1 - y0 - 0.9) / 2, 0.525), M['black'], bevel=0.01)
        box('range_counter_led', (0.01, y1 - y0 - 1.0, 0.012), (cx + 0.255, y0 + (y1 - y0 - 0.9) / 2, 1.0), E['holo'], kind='emit')
        collider('range_counter', (cx - 0.25, y0, -1), (cx + 0.25, y1 - 0.9, 1.05))
        box('holo_console', (0.3, 0.5, 0.06), (cx, -1.9, 1.08), M['metal'], bevel=0.01)
        plane('screen_console', 0.26, 0.44, (cx, -1.9, 1.112), E['holo'], '+Z')
        screen('console', (cx, -1.9, 1.112), 0.26, 0.44, normal='+Z')
        point('range_stand', (cx - 0.7, -1.9, 0))
        interact('range', 'Start the holo range', (cx - 0.7, -1.9, 0), r=0.6)
        # Three lanes with glowing lines and holo targets at the far end.
        lanes = [y0 + (y1 - y0) * (i + 0.5) / 3 for i in range(3)]
        for i in range(4):
            ly = y0 + 0.05 + (y1 - y0 - 0.1) * i / 3
            box(f'lane_line{i}', (x1 - cx - 0.4, 0.03, 0.005), ((cx + x1) / 2 + 0.2, ly, 0.004), E['holo'], kind='emit')
        for i, ly in enumerate(lanes):
            tx = x1 - 0.8 - i * 1.4
            cyl(f'target_base{i}', 0.2, 0.05, (tx, ly, 0.025), M['metal'], seg=24)
            cyl(f'target_pole{i}', 0.02, 1.1, (tx, ly, 0.6), M['metal'])
            for k, (rr, m) in enumerate(((0.3, 'holo'), (0.2, 'onair'), (0.1, 'holo'))):
                cyl(f'target{i}_ring{k}', rr, 0.01 + k * 0.004, (tx - k * 0.003, ly, 1.35), E[m], axis='X', seg=32, kind='emit')
            point(f'target{i}', (tx, ly, 1.35))
            collider(f'target{i}', (tx - 0.2, ly - 0.2, -1), (tx + 0.2, ly + 0.2, 1.65))
        META['range'] = {'x0': cx + 1.0, 'x1': x1 - 0.5, 'y0': y0 + 0.4, 'y1': y1 - 0.4, 'z0': 0.6, 'z1': 2.4}
        # The scoreboard over the far wall, and the second hidden door (the secret room's).
        box('score_case', (0.06, 1.6, 0.6), (x1 - 0.03, (y0 + y1) / 2, 2.2), M['black'], bevel=0.01)
        plane('screen_range', 1.5, 0.5, (x1 - 0.062, (y0 + y1) / 2, 2.2), E['screen'], '-X')
        screen('range', (x1 - 0.062, (y0 + y1) / 2, 2.2), 1.5, 0.5)
        box('vault_door', (0.05, 1.0, 2.1), (x1 - 0.025, y1 - 0.75, 1.05), M['steel'], bevel=0.01)
        box('vault_lock', (0.03, 0.1, 0.16), (x1 - 0.06, y1 - 0.35, 1.1), E['onair'], kind='emit')
        point('secret_room', (x1 - 0.4, y1 - 0.75, 0))
        interact('secret_room', 'A locked door', (x1 - 0.9, y1 - 0.6, 0), r=0.5)
        for i in range(3):
            box(f'range_strip{i}', (x1 - x0 - 0.6, 0.04, 0.02), ((x0 + x1) / 2, y0 + 0.6 + i * 1.1, Hr - 0.02), E['holo'], kind='emit')
        area('L_range', 220, (x1 - x0 - 0.6, y1 - y0 - 0.4), ((x0 + x1) / 2, (y0 + y1) / 2, Hr - 0.05), (0, 0, 0), (0.35, 0.7, 1.0))
        char_light('point', '#5fb0ff', 2.4, ((x0 + x1) / 2, (y0 + y1) / 2, 2.4), 8.0)
        META['looks'] += [[x1 - 0.8, lanes[0], 1.35]]
