"""The two galleries: project frames on the west wall beside the stairs, so you climb past them on the way up, and a
screening wall of three video frames on the east wall with two lounge chairs facing it."""
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
        # The screening wall on the east wall: three 16:9 frames that play my videos.
        for i, y in enumerate((6.65, 7.65, 8.65)):
            box(f'video_frame{i}', (0.03, 0.88, 0.52), (W - 0.015, y, 1.7), M['frame'], bevel=0.004)
            plane(f'screen_video{i}', 0.8, 0.45, (W - 0.032, y, 1.7), E['screen'], '-X')
            screen(f'video{i}', (W - 0.032, y, 1.7), 0.8, 0.45, slot=i)
            wallspot(f'video{i}', 'e', y - 0.44, y + 0.44, 1.44, 1.96)
            interact(f'video{i}', 'Play this video', (W - 1.0, y, 0), r=0.45)
            box(f'video_lamp{i}', (0.06, 0.3, 0.03), (W - 0.06, y, 2.08), M['black'])
            box(f'video_lamp{i}_glow', (0.04, 0.26, 0.006), (W - 0.06, y, 2.062), E['warm_soft'], kind='emit')
        # Two lounge chairs facing the screening wall.
        for i, y in enumerate((7.15, 8.15)):
            cx = W - 2.3
            box(f'lounge_chair{i}_seat', (0.7, 0.7, 0.4), (cx, y, 0.2), M['leather'], bevel=0.06, seg=3)
            box(f'lounge_chair{i}_back', (0.18, 0.7, 0.55), (cx - 0.3, y, 0.62), M['leather'], bevel=0.06, seg=3, tilt=(0, -0.2, 0))
            collider(f'lounge_chair{i}', (cx - 0.4, y - 0.36, -1), (cx + 0.36, y + 0.36, 0.5))
            seat(f'lounge_chair{i}', 'Sit and watch', (cx + 0.85, y + (0.5 if i else -0.5), 0), (cx + 0.05, y, 0.0), 0)
        lamp('L_videos', 60, (W - 0.8, 7.65, 2.4), (1.0, 0.78, 0.55))
        char_light('point', '#ffc890', 1.2, (W - 1.0, 7.65, 2.2), 3.5)
        META['looks'] += [[W - 0.03, 7.65, 1.7], [0.03, 6.4, 2.6]]
