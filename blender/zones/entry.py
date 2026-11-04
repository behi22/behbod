"""The entry hall under the mezzanine and the bookshelf corridor beside it: the front door's mat, coat hooks and shoe
bench, the holiday corner, the departure-board about panel with the neon over it, the resume clipboard, the guestbook,
the mailbox and QR code, the bookshelf with its secret door, and BH-22's dock under the stairs."""
import math, random
import bpy
from mathutils import Vector, Matrix
from lib.core import zone, box, cyl, sphere, plane, tube, collider, point, screen, interact, char_light, lamp, potted, META
from zones.layout import MEZZ_UNDER, SECRET_DOOR, STAIRS


def build(M, E, G):
    with zone('entry', px=2048):
        h = MEZZ_UNDER
        # The wall between the entry and the bookshelf corridor, open at its north end.
        box('entry_wall', (0.15, 2.6, h), (4.5, 1.3, h / 2), M['wall'])
        collider('entry_wall', (4.42, 0.0, -1), (4.58, 2.6, h))
        # The welcome mat inside the door (its line is drawn at runtime) and the doormat's rubber edge.
        box('doormat_edge', (1.04, 0.62, 0.012), (2.5, 0.42, 0.006), M['black'])
        plane('screen_doormat', 0.96, 0.54, (2.5, 0.42, 0.014), M['felt'], '+Z')
        screen('doormat', (2.5, 0.42, 0.014), 0.96, 0.54, normal='+Z')
        # Coat hooks with a jacket and a scarf over a shoe bench, on the south wall west of the door.
        box('hook_rail', (1.2, 0.03, 0.08), (0.9, 0.02, 1.75), M['walnut'])
        for i in range(4):
            tube(f'hook{i}', [(0.45 + i * 0.3, 0.04, 1.74), (0.45 + i * 0.3, 0.1, 1.72), (0.45 + i * 0.3, 0.11, 1.78)], 0.008, M['brass'])
        box('jacket', (0.42, 0.12, 0.7), (0.6, 0.12, 1.36), M['sofa'], bevel=0.05, seg=3)
        box('scarf_hung', (0.12, 0.06, 0.6), (1.35, 0.1, 1.42), M['white'], bevel=0.02)
        box('shoe_bench', (1.2, 0.36, 0.45), (0.9, 0.2, 0.225), M['oak'], bevel=0.01)
        for i, x in enumerate((0.55, 0.85, 1.2)):
            box(f'shoe{i}', (0.12, 0.28, 0.1), (x, 0.2, 0.05), M['white'] if i % 2 else M['black'], bevel=0.04, seg=3)
        collider('shoe_bench', (0.3, 0.0, -1), (1.5, 0.38, 0.45))
        # The mailbox and the QR code beside the door.
        box('mailbox', (0.3, 0.12, 0.38), (3.35, 0.07, 1.2), M['black'], bevel=0.01)
        box('mailbox_slot', (0.22, 0.01, 0.03), (3.35, 0.135, 1.32), M['brass'])
        point('mailbox', (3.35, 0.14, 1.2))
        interact('mailbox', 'Leave me a message', (3.35, 0.8, 0), r=0.8)
        box('qr_frame', (0.26, 0.02, 0.26), (1.75, 0.01, 1.45), M['frame'])
        plane('screen_qr', 0.22, 0.22, (1.75, 0.022, 1.45), M['white'], '+Y')
        screen('qr', (1.75, 0.022, 1.45), 0.22, 0.22, normal='+Y')
        # The holiday corner on the west wall: a low table whose things change with the README's calendar.
        box('holiday_table', (0.42, 1.4, 0.7), (0.21, 1.4, 0.35), M['walnut'], bevel=0.01)
        box('holiday_frame', (0.03, 1.1, 0.7), (0.015, 1.4, 1.45), M['frame'], bevel=0.005)
        plane('screen_holiday', 1.02, 0.62, (0.032, 1.4, 1.45), E['screen'], '+X')
        screen('holiday', (0.032, 1.4, 1.45), 1.02, 0.62, normal='+X')
        for i, (dy, m) in enumerate(((-0.45, 'gold'), (-0.15, 'red'), (0.2, 'leaf2'), (0.5, 'tile'))):
            cyl(f'holiday_thing{i}', 0.05, 0.12, (0.22, 1.4 + dy, 0.76), M[m], seg=16, kind='emit')
        collider('holiday_table', (0.0, 0.7, -1), (0.42, 2.1, 0.7))
        interact('holiday', 'What day is it?', (0.9, 1.4, 0), r=0.9)
        # The about board on the entry wall, made like a departure board, the resume clipboard under it, the neon above.
        bx = 4.42
        box('about_case', (0.05, 1.1, 0.66), (bx - 0.025, 1.55, 1.55), M['black'], bevel=0.01)
        plane('screen_about', 1.02, 0.58, (bx - 0.052, 1.55, 1.55), E['screen'], '-X')
        screen('about', (bx - 0.052, 1.55, 1.55), 1.02, 0.58)
        interact('about', 'Read about me', (3.6, 1.55, 0), r=1.0)
        box('clipboard', (0.015, 0.24, 0.32), (bx - 0.01, 0.75, 1.15), M['oak'], bevel=0.004)
        plane('screen_resume', 0.2, 0.27, (bx - 0.019, 0.75, 1.14), M['paper'], '-X')
        screen('resume', (bx - 0.019, 0.75, 1.14), 0.2, 0.27)
        box('clipboard_clip', (0.02, 0.08, 0.03), (bx - 0.02, 0.75, 1.3), M['steel'])
        interact('resume', 'Take my resume', (3.75, 0.75, 0), r=0.8)
        plane('neon', 1.3, 0.32, (bx - 0.012, 1.55, 2.2), E['warm_soft'], '-X')
        screen('neon', (bx - 0.012, 1.55, 2.2), 1.3, 0.32)
        # The guestbook, open on a lectern.
        cyl('guest_stand', 0.025, 0.95, (3.6, 0.7 + 0.35, 0.475), M['black'])
        cyl('guest_foot', 0.16, 0.02, (3.6, 1.05, 0.01), M['black'], seg=20)
        box('guest_desk', (0.42, 0.32, 0.03), (3.6, 1.05, 0.98), M['walnut'], tilt=(math.radians(18), 0, 0))
        plane('screen_guestbook', 0.38, 0.26, (3.6, 1.05, 1.0), M['paper'], '+Z')
        piv, R = Vector((3.6, 1.05, 1.0)), Matrix.Rotation(math.radians(18), 3, 'X')
        for v in bpy.data.objects['screen_guestbook'].data.vertices:
            v.co = piv + R @ (v.co - piv) + Vector((0, 0, 0.02))
        screen('guestbook', (3.6, 1.05, 1.02), 0.38, 0.26, normal='+Z')
        collider('guestbook', (3.4, 0.85, -1), (3.8, 1.25, 1.0))
        interact('guestbook', 'Sign the guestbook', (3.6, 1.7, 0), r=0.8)
        potted('entry_plant', (4.1, 2.4, 0), M, r=0.18, h=0.45, mat='pot', leaves=10, size=0.18)
        for i, (x, y) in enumerate(((1.4, 1.5), (3.2, 1.5), (6.2, 1.5), (8.4, 1.5))):
            cyl(f'downlight{i}', 0.07, 0.02, (x, y, h - 0.01), E['warm_soft'], seg=20, kind='emit')
            lamp(f'L_down{i}', 45, (x, y, h - 0.12), (1.0, 0.8, 0.55), soft=0.1)

        # The bookshelf along the south wall from the entry wall to the mezzanine's edge, with the secret door.
        sa, sb = SECRET_DOOR
        rnd = random.Random(5)
        for name, (a, b) in {'w': (4.6, sa), 'e': (sb, 9.8)}.items():
            box(f'shelf_case_{name}', (b - a, 0.38, h - 0.05), ((a + b) / 2, 0.19, (h - 0.05) / 2), M['walnut'], bevel=0.008)
            for r_ in range(6):
                zz = 0.12 + r_ * 0.41
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
            collider(f'bookshelf_{name}', (a, 0.0, -1), (b, 0.38, h))
        box('shelf_led', (9.8 - 4.6, 0.012, 0.01), (7.2, 0.37, h - 0.06), E['warm_soft'], kind='emit')
        # The secret door is a bookcase on a pivot; the page swings it open.
        box('secret_door', (sb - sa - 0.02, 0.36, 2.06), ((sa + sb) / 2, 0.2, 1.04), M['walnut'], kind='emit')
        for r_ in range(5):
            box(f'secret_shelf{r_}', (sb - sa - 0.06, 0.34, 0.025), ((sa + sb) / 2, 0.21, 0.12 + r_ * 0.41), M['black'], kind='emit')
            for k in range(14):
                box(f'secret_book{r_}_{k}', (0.05, 0.22, 0.28 - (k % 3) * 0.03), (sa + 0.08 + k * 0.064, 0.26, 0.12 + r_ * 0.41 + 0.15), M[f'book{(k + r_) % 4 + 1}'], kind='emit')
        META['doors'] = [{'id': 'secret', 'collider': 'secret_door', 'pivot': [sa + 0.01, 0.38, 0], 'swing': -100, 'parts': 'secret_'}]
        collider('secret_door', (sa, 0.0, -1), (sb, 0.4, 2.1))
        interact('secret', 'Pull the red book', ((sa + sb) / 2, 0.9, 0), r=0.8)

        # BH-22's dock under the high end of the stairs: a charging pad with a glowing ring, and BH-22 waiting on it.
        dx, dy = (STAIRS[0] + STAIRS[1]) / 2 - 0.0, 3.6
        cyl('bh_dock', 0.32, 0.04, (dx, dy, 0.02), M['black'], seg=32)
        cyl('bh_dock_ring', 0.3, 0.006, (dx, dy, 0.043), E['rgb_teal'], seg=32, kind='emit')
        box('bh_dock_post', (0.12, 0.08, 0.5), (dx, dy - 0.28, 0.25), M['black'], bevel=0.02)
        box('bh_dock_led', (0.004, 0.06, 0.2), (dx, dy - 0.239, 0.32), E['rgb_teal'], kind='emit')
        point('bh22_dock', (dx, dy, 0.045))
        # Hopper: matte black, a rounded body on two springy wheel-legs, LED dot eyes.
        bz = 0.045
        sphere('bh22_body', 0.16, (dx, dy, bz + 0.34), M['matte'], sub=3, scale=(1, 0.9, 0.85), kind='emit')
        box('bh22_face', (0.2, 0.02, 0.1), (dx, dy + 0.13, bz + 0.36), M['aria_face'], bevel=0.03, kind='emit')
        for s in (-1, 1):
            sphere(f'bh22_eye{s}', 0.016, (dx + s * 0.045, dy + 0.145, bz + 0.37), E['aria_eye'], sub=1, kind='emit')
            tube(f'bh22_leg{s}', [(dx + s * 0.1, dy, bz + 0.25), (dx + s * 0.14, dy + 0.02, bz + 0.14), (dx + s * 0.12, dy, bz + 0.06)], 0.018, M['black'], kind='emit')
            cyl(f'bh22_wheel{s}', 0.055, 0.03, (dx + s * 0.12, dy, bz + 0.055), M['black'], axis='X', seg=16, kind='emit')
        box('bh22_edge', (0.3, 0.005, 0.008), (dx, dy + 0.12, bz + 0.27), E['rgb_teal'], kind='emit')
        cyl('bh22_antenna', 0.004, 0.08, (dx, dy, bz + 0.52), M['steel'], kind='emit')
        sphere('bh22_tip', 0.012, (dx, dy, bz + 0.565), E['onair'], sub=1, kind='emit')
        collider('bh22_dock', (dx - 0.32, dy - 0.36, -1), (dx + 0.32, dy + 0.32, 0.5))
        interact('bh22', 'Say hi to BH-22', (dx, dy + 0.75, 0), r=0.8)
        char_light('point', '#ffc890', 2.0, (2.3, 1.5, 2.3), 4.0)
        char_light('point', '#ffc890', 1.4, (7.2, 1.5, 2.3), 4.0)
        META['looks'] += [[bx - 0.05, 1.55, 1.55], [0.03, 1.4, 1.45], [dx, dy, 0.4]]
