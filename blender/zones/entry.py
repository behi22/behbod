"""The entry hall and the library under the mezzanine: the mat, coat hooks and shoe bench, the holiday corner, the
departure-board about panel with the neon over it, the resume clipboard, the guestbook, the mailbox and QR code; the
bookshelf with its secret door, a reading chair, the keeper's corner, and BH-22's dock under the stairs."""
import math, random
import bpy
from mathutils import Vector, Matrix
from lib.core import (zone, box, cyl, sphere, plane, tube, collider, point, screen, interact, seat, wallspot, char_light,
                      lamp, potted, tilt_obj, META)
from zones.layout import MEZZ_UNDER, SECRET_DOOR, FRONT_DOOR, ENTRY_WALL_X, PARTITION_X, STAIRS


def build(M, E, G):
    with zone('entry', px=2048):
        h = MEZZ_UNDER
        fa, fb = FRONT_DOOR
        dc = (fa + fb) / 2
        # The welcome mat inside the door (its line is drawn at runtime).
        box('doormat_edge', (1.04, 0.62, 0.012), (dc, 0.42, 0.006), M['black'])
        plane('screen_doormat', 0.96, 0.54, (dc, 0.42, 0.014), M['felt'], '+Z')
        screen('doormat', (dc, 0.42, 0.014), 0.96, 0.54, normal='+Z')
        # Coat hooks with a jacket and a scarf over a shoe bench, on the south wall west of the door.
        box('hook_rail', (1.2, 0.03, 0.08), (0.95, 0.02, 1.75), M['walnut'])
        for i in range(4):
            tube(f'hook{i}', [(0.5 + i * 0.3, 0.04, 1.74), (0.5 + i * 0.3, 0.1, 1.72), (0.5 + i * 0.3, 0.11, 1.78)], 0.008, M['brass'])
        box('jacket', (0.42, 0.12, 0.7), (0.65, 0.12, 1.36), M['sofa'], bevel=0.05, seg=3)
        box('scarf_hung', (0.12, 0.06, 0.6), (1.4, 0.1, 1.42), M['white'], bevel=0.02)
        wallspot('coat_hooks', 's', 0.35, 1.55, 1.0, 1.8)
        box('shoe_bench', (1.2, 0.36, 0.45), (0.95, 0.2, 0.225), M['oak'], bevel=0.01)
        for i, x in enumerate((0.6, 0.9, 1.25)):
            box(f'shoe{i}', (0.12, 0.28, 0.1), (x, 0.2, 0.05), M['white'] if i % 2 else M['black'], bevel=0.04, seg=3)
        collider('shoe_bench', (0.35, 0.0, -1), (1.55, 0.38, 0.45))
        seat('shoe_bench', 'Sit on the bench', (0.95, 0.95, 0), (0.95, 0.20, 0.45), 90, 'bench')
        # The mailbox and the QR code beside the door.
        box('mailbox', (0.3, 0.12, 0.38), (3.55, 0.07, 1.2), M['black'], bevel=0.01)
        box('mailbox_slot', (0.22, 0.01, 0.03), (3.55, 0.135, 1.32), M['brass'])
        wallspot('mailbox', 's', 3.4, 3.7, 1.01, 1.39)
        point('mailbox', (3.55, 0.14, 1.2))
        interact('mailbox', 'Leave me a message', (3.55, 0.75, 0), r=0.55)
        box('qr_frame', (0.26, 0.02, 0.26), (4.25, 0.01, 1.45), M['frame'])
        plane('screen_qr', 0.22, 0.22, (4.25, 0.022, 1.45), M['white'], '+Y')
        screen('qr', (4.25, 0.022, 1.45), 0.22, 0.22, normal='+Y')
        wallspot('qr', 's', 4.12, 4.38, 1.32, 1.58)
        # The holiday corner on the west wall: a low table whose things change with the README's calendar.
        box('holiday_table', (0.42, 1.4, 0.7), (0.21, 1.9, 0.35), M['walnut'], bevel=0.01)
        box('holiday_frame', (0.03, 1.1, 0.7), (0.015, 1.9, 1.45), M['frame'], bevel=0.005)
        plane('screen_holiday', 1.02, 0.62, (0.032, 1.9, 1.45), E['screen'], '+X')
        screen('holiday', (0.032, 1.9, 1.45), 1.02, 0.62, normal='+X')
        wallspot('holiday', 'w', 1.35, 2.45, 1.1, 1.8)
        for i, (dy, m) in enumerate(((-0.45, 'gold'), (-0.15, 'red'), (0.2, 'leaf2'), (0.5, 'tile'))):
            cyl(f'holiday_thing{i}', 0.05, 0.12, (0.22, 1.9 + dy, 0.76), M[m], seg=16, kind='emit')
        collider('holiday_table', (0.0, 1.2, -1), (0.42, 2.6, 0.7))
        interact('holiday', 'What day is it?', (1.0, 1.9, 0), r=0.55)
        # The about board on the entry wall, made like a departure board, the resume under it, the neon above.
        bx = ENTRY_WALL_X - 0.075
        box('about_case', (0.05, 1.1, 0.66), (bx - 0.025, 1.6, 1.55), M['black'], bevel=0.01)
        plane('screen_about', 1.02, 0.58, (bx - 0.052, 1.6, 1.55), E['screen'], '-X')
        screen('about', (bx - 0.052, 1.6, 1.55), 1.02, 0.58)
        wallspot('about', 'entry', 1.05, 2.15, 1.22, 1.88)
        interact('about', 'Read about me', (bx - 0.75, 1.6, 0), r=0.6)
        box('clipboard', (0.015, 0.24, 0.32), (bx - 0.01, 2.6, 1.2), M['oak'], bevel=0.004)
        plane('screen_resume', 0.2, 0.27, (bx - 0.019, 2.6, 1.19), M['paper'], '-X')
        screen('resume', (bx - 0.019, 2.6, 1.19), 0.2, 0.27)
        box('clipboard_clip', (0.02, 0.08, 0.03), (bx - 0.02, 2.6, 1.35), M['steel'])
        wallspot('resume', 'entry', 2.48, 2.72, 1.04, 1.36)
        interact('resume', 'Take my resume', (bx - 0.75, 2.6, 0), r=0.45)
        plane('neon', 1.3, 0.32, (bx - 0.012, 1.6, 2.25), E['warm_soft'], '-X')
        screen('neon', (bx - 0.012, 1.6, 2.25), 1.3, 0.32)
        wallspot('neon', 'entry', 0.95, 2.25, 2.09, 2.41)
        # The guestbook, open on a lectern by the door.
        gx, gy = 3.3, 2.4
        cyl('guest_stand', 0.025, 0.95, (gx, gy, 0.475), M['black'])
        cyl('guest_foot', 0.16, 0.02, (gx, gy, 0.01), M['black'], seg=20)
        box('guest_desk', (0.42, 0.32, 0.03), (gx, gy, 0.98), M['walnut'], tilt=(math.radians(18), 0, 0))
        tilt_obj(plane('screen_guestbook', 0.38, 0.26, (gx, gy, 1.0), M['paper'], '+Z'), (gx, gy, 1.0), 18, lift=0.02)
        screen('guestbook', (gx, gy, 1.02), 0.38, 0.26, normal='+Z')
        collider('guestbook', (gx - 0.21, gy - 0.18, -1), (gx + 0.21, gy + 0.18, 1.0))
        interact('guestbook', 'Sign the guestbook', (gx - 0.1, gy + 0.65, 0), r=0.45)
        potted('entry_plant', (4.6, 3.75, 0), M, r=0.18, h=0.45, mat='pot', leaves=10, size=0.18)

        # The library: the bookshelf along the south wall with its secret door, a reading chair by a lamp.
        sa, sb = SECRET_DOOR
        rnd = random.Random(5)
        for name, (a, b) in {'w': (5.6, sa), 'e': (sb, 10.4)}.items():
            box(f'shelf_case_{name}', (b - a, 0.38, h - 0.05), ((a + b) / 2, 0.19, (h - 0.05) / 2), M['walnut'], bevel=0.008)
            for r_ in range(6):
                zz = 0.12 + r_ * 0.43
                box(f'shelf_{name}{r_}', (b - a - 0.04, 0.36, 0.025), ((a + b) / 2, 0.2, zz), M['black'])
                x = a + 0.05
                while x < b - 0.08:
                    t_, h_ = rnd.uniform(0.025, 0.055), rnd.uniform(0.22, 0.34)
                    if rnd.random() < 0.85:
                        box(f'b_{name}{r_}_{x:.2f}', (t_, 0.24, h_), (x + t_ / 2, 0.26, zz + 0.0125 + h_ / 2), M[f'book{rnd.randint(1, 4)}'])
                    elif rnd.random() < 0.5:
                        sphere(f'curio_{name}{r_}_{x:.2f}', 0.05, (x + 0.06, 0.26, zz + 0.06), M['brass' if rnd.random() < 0.5 else 'tile'], sub=2)
                        x += 0.08
                    x += t_ + 0.004
            collider(f'bookshelf_{name}', (a, 0.0, -1), (b, 0.38, h), structure=True)
        box('shelf_led', (10.4 - 5.6, 0.012, 0.01), (8.0, 0.37, h - 0.06), E['warm_soft'], kind='emit')
        # The secret door is a bookcase on a pivot; the page swings it open.
        box('secret_door', (sb - sa - 0.02, 0.36, 2.06), ((sa + sb) / 2, 0.2, 1.04), M['walnut'], kind='emit')
        for r_ in range(5):
            box(f'secret_shelf{r_}', (sb - sa - 0.06, 0.34, 0.025), ((sa + sb) / 2, 0.21, 0.12 + r_ * 0.41), M['black'], kind='emit')
            for k in range(14):
                red = r_ == 2 and k == 9
                box(f'secret_book{r_}_{k}', (0.05, 0.22, 0.28 - (k % 3) * 0.03), (sa + 0.08 + k * 0.064, 0.26, 0.12 + r_ * 0.41 + 0.15), M['red'] if red else M[f'book{(k + r_) % 4 + 1}'], kind='emit')
        META['doors'] = META.get('doors', []) + [{'id': 'secret', 'collider': 'secret_door', 'pivot': [sa + 0.01, 0.38, 0], 'swing': -100, 'parts': 'secret_'}]
        collider('secret_door', (sa, 0.0, -1), (sb, 0.4, 2.1), structure=True)
        interact('secret', 'Pull the red book', ((sa + sb) / 2, 0.95, 0), r=0.55)
        # A leather reading chair with a side table and a lamp.
        RCX, RCY = 6.2, 3.2
        box('read_chair_seat', (0.7, 0.7, 0.42), (RCX, RCY, 0.21), M['leather_brown'], bevel=0.06, seg=3)
        box('read_chair_back', (0.7, 0.18, 0.55), (RCX, RCY + 0.3, 0.65), M['leather_brown'], bevel=0.06, seg=3)
        for s in (-1, 1):
            box(f'read_chair_arm{s}', (0.14, 0.62, 0.22), (RCX + s * 0.3, RCY - 0.02, 0.5), M['leather_brown'], bevel=0.05, seg=3)
        collider('read_chair', (RCX - 0.37, RCY - 0.37, -1), (RCX + 0.37, RCY + 0.4, 0.5))
        seat('read_chair', 'Sit and read', (RCX, RCY - 0.85, 0), (RCX, RCY + 0.06, 0.42), 270, 'lounge')
        cyl('read_table', 0.22, 0.5, (RCX + 0.75, RCY + 0.1, 0.25), M['walnut'], seg=24)
        cyl('read_lamp_pole', 0.012, 1.35, (RCX - 0.62, RCY + 0.25, 0.68), M['brass'])
        cyl('read_lamp_base', 0.13, 0.02, (RCX - 0.62, RCY + 0.25, 0.01), M['brass'], seg=20)
        cyl('read_lamp_shade', 0.17, 0.24, (RCX - 0.62, RCY + 0.25, 1.42), M['lampshade'], r2=0.12, cap=False)
        sphere('read_lamp_bulb', 0.04, (RCX - 0.62, RCY + 0.25, 1.38), E['warm'], sub=1, kind='emit')
        collider('read_table', (RCX + 0.53, RCY - 0.12, -1), (RCX + 0.97, RCY + 0.32, 0.5))
        collider('read_lamp', (RCX - 0.77, RCY + 0.1, -1), (RCX - 0.47, RCY + 0.4, 1.5))
        lamp('L_read', 70, (RCX - 0.62, RCY + 0.25, 1.35), (1.0, 0.72, 0.45))

        # The keeper's corner against the partition: the BEHI 22 jersey in a frame, a mini goal, a ball.
        PX = PARTITION_X - 0.1
        box('jersey_frame', (0.04, 0.7, 0.85), (PX - 0.02, 2.25, 2.0), M['frame'], bevel=0.005)
        plane('screen_jersey', 0.62, 0.77, (PX - 0.045, 2.25, 2.0), M['kit_white'], '-X')
        screen('jersey', (PX - 0.045, 2.25, 2.0), 0.62, 0.77)
        wallspot('jersey', 'partition', 1.9, 2.6, 1.57, 2.43)
        # The mini goal faces the room: two posts and a crossbar, stays running back down to a bar on the floor by the
        # partition, and a net of thin cords on the back and both sides.
        GF, GB, GY0, GY1, GH = PX - 0.45, PX - 0.05, 1.8, 2.7, 0.6
        for sy, y in ((-1, GY0), (1, GY1)):
            tube(f'goal_post{sy}', [(GF, y, 0), (GF, y, GH)], 0.025, M['white'])
            tube(f'goal_back{sy}', [(GF, y, GH), (GB, y, 0.02)], 0.015, M['white'])
        tube('goal_bar', [(GF, GY0, GH), (GF, GY1, GH)], 0.025, M['white'])
        tube('goal_floor', [(GB, GY0, 0.02), (GB, GY1, 0.02)], 0.015, M['white'])
        stay_z = lambda x: GH + (0.02 - GH) * (x - GF) / (GB - GF)
        for k in range(1, 9):
            y = GY0 + (GY1 - GY0) * k / 9
            tube(f'goal_net_v{k}', [(GF, y, GH), (GB, y, 0.02)], 0.004, M['white'], seg=4)
        for k in range(1, 6):
            t = k / 6
            x, zz = GF + (GB - GF) * t, GH + (0.02 - GH) * t
            tube(f'goal_net_h{k}', [(x, GY0, zz), (x, GY1, zz)], 0.004, M['white'], seg=4)
        for sy, y in ((-1, GY0), (1, GY1)):
            for k in range(1, 4):
                x = GF + (GB - GF) * k / 4
                tube(f'goal_side{sy}_v{k}', [(x, y, 0.0), (x, y, stay_z(x))], 0.004, M['white'], seg=4)
            for k in range(1, 4):
                zz = GH * k / 4
                x1 = GF + (GB - GF) * (GH - zz) / (GH - 0.02)
                tube(f'goal_side{sy}_h{k}', [(GF, y, zz), (x1, y, zz)], 0.004, M['white'], seg=4)
        collider('goal', (PX - 0.5, 1.78, -1), (PX - 0.01, 2.72, 0.62))
        point('goal', (PX - 0.3, 2.25, 0.3))
        # Penalties with BH-22 in goal: the spot, the middle of the goal line, the mouth inside the posts and under the bar.
        point('pen_spot', (PX - 2.8, 2.25, 0.0))
        point('pen_line', (GF, 2.25, 0.0))
        META['penalty'] = {'width': round(GY1 - GY0 - 0.05, 3), 'height': round(GH - 0.025, 3)}
        interact('penalties', 'Take a penalty', (PX - 2.2, 2.25, 0), r=0.6)

        # BH-22's dock under the high end of the stairs (the robot itself is built by the page so it can roam).
        dx, dy = (STAIRS[0] + STAIRS[1]) / 2, 5.1
        cyl('bh_dock', 0.32, 0.04, (dx, dy, 0.02), M['black'], seg=32)
        cyl('bh_dock_ring', 0.3, 0.006, (dx, dy, 0.043), E['rgb_teal'], seg=32, kind='emit')
        box('bh_dock_post', (0.08, 0.12, 0.5), (0.2, dy, 0.25), M['black'], bevel=0.02)
        box('bh_dock_led', (0.004, 0.06, 0.2), (0.241, dy, 0.32), E['rgb_teal'], kind='emit')
        collider('bh_dock_post', (0.16, dy - 0.06, -1), (0.24, dy + 0.06, 0.5))
        point('bh22_dock', (dx, dy, 0.045))
        interact('bh22', 'Say hi to BH-22', (dx + 1.05, dy, 0), r=0.6)
        for i, (x, y) in enumerate(((1.4, 1.6), (3.2, 1.6), (2.5, 3.6), (6.5, 1.8), (8.6, 2.6), (10.2, 3.4))):
            cyl(f'downlight{i}', 0.07, 0.02, (x, y, h - 0.01), E['warm_soft'], seg=20, kind='emit')
            lamp(f'L_down{i}', 45, (x, y, h - 0.12), (1.0, 0.8, 0.55), soft=0.1)
        char_light('point', '#ffc890', 2.0, (2.5, 2.0, 2.4), 4.5)
        char_light('point', '#ffc890', 1.6, (8.0, 2.2, 2.4), 4.5)
        META['looks'] += [[bx - 0.05, 1.6, 1.55], [0.03, 1.9, 1.45], [dx, dy, 0.4], [PX - 0.05, 2.25, 2.0]]
