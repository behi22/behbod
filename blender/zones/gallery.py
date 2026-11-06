"""The two galleries: project frames on the west wall beside the stairs, so you climb past them on the way up, and a
screening wall on the east wall: one big video frame with two lounge chairs facing it."""
from lib.core import zone, box, plane, screen, interact, seat, wallspot, collider, char_light, lamp, META
from zones.layout import STAIRS, STAIR_Y0, STAIR_Y1, MEZZ_Z, W

PROJECTS = ['meet-bex', 'profile-art', 'aic-voice-microsite', 'visitor-classifier', 'behbod']


def build(M, E, G):
    with zone('gallery', px=1024):
        # Project frames on the wall above the stairs, each at eye height for someone on the step below it.
        run = (STAIR_Y0 - STAIR_Y1) / len(PROJECTS)
        for i, name in enumerate(PROJECTS):
            y = STAIR_Y0 - run * (i + 0.5)
            z = MEZZ_Z * (STAIR_Y0 - y) / (STAIR_Y0 - STAIR_Y1) + 1.5
            box(f'proj_frame{i}', (0.03, 0.66, 0.51), (0.015, y, z), M['frame'], bevel=0.004)
            plane(f'screen_proj{i}', 0.6, 0.45, (0.032, y, z), M['paper'], '+X')
            screen(f'proj{i}', (0.032, y, z), 0.6, 0.45, project=name, normal='+X')
            wallspot(f'proj{i}', 'w', y - 0.33, y + 0.33, z - 0.255, z + 0.255)
        META['projects'] = PROJECTS
        interact('projects', 'See my projects', (1.9, STAIR_Y0 + 0.4, 0), r=0.55)
        # The screening wall on the east wall: one big 16:9 frame. It plays live (muted) when you are near, and E plays
        # it from the start with sound. The screen is a hole in the picture with the YouTube player behind it.
        y, z = 7.65, 1.75
        box('video_frame0', (0.04, 2.04, 1.2), (W - 0.02, y, z), M['frame'], bevel=0.006)
        plane('screen_video0', 1.92, 1.08, (W - 0.042, y, z), E['screen'], '-X')
        screen('video0', (W - 0.042, y, z), 1.92, 1.08, slot=0)
        wallspot('video0', 'e', y - 1.02, y + 1.02, z - 0.6, z + 0.6)
        interact('video0', 'Play from the start', (W - 1.3, y, 0), r=0.6)
        box('video_lamp0', (0.06, 1.3, 0.03), (W - 0.06, y, z + 0.72), M['black'])
        box('video_lamp0_glow', (0.04, 1.26, 0.006), (W - 0.06, y, z + 0.702), E['warm_soft'], kind='emit')
        # Two lounge chairs facing the screening wall.
        for i, y in enumerate((7.15, 8.15)):
            cx = W - 2.3
            box(f'lounge_chair{i}_seat', (0.7, 0.7, 0.4), (cx, y, 0.2), M['leather'], bevel=0.06, seg=3)
            box(f'lounge_chair{i}_back', (0.18, 0.7, 0.55), (cx - 0.3, y, 0.62), M['leather'], bevel=0.06, seg=3, tilt=(0, -0.2, 0))
            collider(f'lounge_chair{i}', (cx - 0.4, y - 0.36, -1), (cx + 0.36, y + 0.36, 0.5))
            seat(f'lounge_chair{i}', 'Sit and watch', (cx + 0.85, y + (0.5 if i else -0.5), 0), (cx - 0.06, y, 0.40), 0, 'lounge')
        lamp('L_videos', 60, (W - 0.8, 7.65, 2.7), (1.0, 0.78, 0.55))
        char_light('point', '#ffc890', 1.2, (W - 1.0, 7.65, 2.2), 3.5)
        META['looks'] += [[W - 0.04, 7.65, 1.75], [0.03, 6.4, 2.6]]
