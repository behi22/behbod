"""The loft's plan, in metres. Blender axes: x east from the west wall, y north from the south wall, z up. The glass
wall faces north over the bay at y = D. Laid out with walkways of at least 0.9 m and room around everything you use."""
W, D, H = 22.0, 15.0, 6.5
WALL = 0.2
# Floor levels.
PIT_Z, DAIS_Z, STUDIO_Z, MEZZ_Z = -0.45, 0.3, 0.45, 3.0
MEZZ_UNDER = 2.75
# The mezzanine over the entry and the library (x0, y0, x1, y1).
MEZZ = (0.0, 0.0, 11.2, 4.5)
# Stairs along the west wall: 16 steps from the ground at y STAIR_Y0 up to the mezzanine's edge at y STAIR_Y1.
STAIRS = (0.15, 1.35)
STAIR_Y0, STAIR_Y1, STAIR_N = 8.34, 4.5, 16
# Rooms on the ground floor.
ENTRY = (0.0, 0.0, 5.0, 4.5)
ENTRY_WALL_X, ENTRY_WALL_Y1 = 5.0, 3.2
LIBRARY = (5.15, 0.0, 11.2, 4.5)
FRONT_DOOR = (2.0, 3.1)
# The front door sits this deep in its wall, inside a frame whose casing is this wide on the wall's face.
DOOR_RECESS, DOOR_CASING = 0.09, 0.07
SECRET_DOOR = (7.6, 8.6)
PARTITION_X = 11.2
# The sunken lounge and its steps (cut into its east edge).
PIT = (2.4, 7.0, 9.8, 13.6)
PIT_STEPS = (9.2, 8.8, 9.8, 11.8)
# The raised studio and its steps (cut into its north edge).
STUDIO = (11.4, 0.0, 22.0, 6.0)
STUDIO_STEPS = (15.0, 5.5, 17.0, 6.0)
# The piano dais under the skylight: centre, outer and top radius.
DAIS = (18.3, 11.0, 2.0, 1.6)
SKYLIGHT = (17.3, 10.0, 19.3, 12.0)
TEABAR = (13.0, 7.4, 16.5, 8.3)
SLIDING_DOOR = (10.2, 12.2)
BALCONY = (3.0, 15.0, 19.0, 18.0)
RANGE = (5.2, -3.5, 18.2, -0.2)
