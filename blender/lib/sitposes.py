"""Sitting styles for the character: one per kind of seat, each with a sit-down, an idle loop and a stand-up.

The animation library has one chair sit, so the rest are posed here by direction: where the hips go, how far the back
leans, where the feet and hands land; a two-joint solver works out the knees and elbows. Every style is built for the
seat height it is used on, so the hips rest on the cushion and the feet on the floor.

Character space (Blender): x is the character's left, -y is forward, z is up; the page draws the character at 90%, so
room measurements are divided by SCALE.
"""
import bpy, math
from mathutils import Vector, Matrix, Quaternion

SCALE = 0.9
CONTACT = 0.065   # the hip joint sits this far above the seat surface, in the room


def m(v):
    return v / SCALE


# Every measurement in room metres. hip_back: how far the hips sit behind the point between the feet (the character's
# origin). feet: (forward of the origin, height) of the ankles. lean: degrees the back leans back (negative: forward).
# hands: where the hands rest. mid: the in-between pose when sitting down ('chair', 'crouch' or None).
FAMILIES = {
    'sofa':    dict(seat=0.50, hip_back=0.30, lean=12, feet=(0.10, 0.076), spread=0.11, hands='lap', head=-6, mid='chair'),
    'lounge':  dict(seat=0.41, hip_back=0.28, lean=16, feet=(0.18, 0.076), spread=0.12, hands='lap', head=-8, mid='chair'),
    'bench':   dict(seat=0.45, hip_back=0.26, lean=-3, feet=(0.06, 0.076), spread=0.12, hands='knees', head=-4, mid='chair'),
    # Bean bags: the hips sink about 13 cm into the bag.
    'low':     dict(seat=0.28, hip_back=0.30, lean=30, feet=(0.32, 0.076), spread=0.15, hands='belly', head=-14, mid='crouch'),
    'cross':   dict(seat=0.14, hip_back=0.10, lean=-4, feet=(0.16, 0.06), spread=-0.10, hands='knees', head=-6, mid='crouch', cross=True),
    'stool':   dict(seat=0.77, hip_back=0.10, lean=-6, feet=(0.10, 0.33), spread=0.10, hands='counter', head=-4, mid=None),
    'egg':     dict(seat=0.87, hip_back=0.12, lean=22, feet=(0.30, 0.90), spread=0.10, hands='knees', head=-10, mid=None, knees_up=True),
    'recline': dict(seat=0.40, hip_back=0.32, lean=38, feet=(0.34, 0.076), spread=0.14, hands='belly', head=-22, mid='chair'),
    'piano':   dict(seat=0.57, hip_back=0.30, lean=-7, feet=(0.12, 0.076), spread=0.13, hands='keys', head=-12, mid='chair'),
    # The window seat: back against the pillows on the glass, knees up, feet on the cushion.
    'nook':    dict(seat=0.53, hip_back=0.14, lean=14, feet=(0.20, 0.60), spread=0.10, hands='knees', head=-8, mid='chair', knees_up=True),
}


def _update():
    bpy.context.view_layer.update()


def _pb(arm, name):
    return arm.pose.bones[name]


def aim(arm, name, d):
    """Turn a pose bone so its length (local Y) points along `d` (armature space), keeping its head where it is."""
    pb = _pb(arm, name)
    M = pb.matrix.copy()
    y = (M.to_3x3() @ Vector((0, 1, 0))).normalized()
    q = y.rotation_difference(d.normalized())
    R = (q.to_matrix() @ M.to_3x3()).to_4x4()
    R.translation = M.translation
    pb.matrix = R
    _update()


def twist(arm, name, deg):
    pb = _pb(arm, name)
    M = pb.matrix.copy()
    y = (M.to_3x3() @ Vector((0, 1, 0))).normalized()
    R = (Matrix.Rotation(math.radians(deg), 3, y) @ M.to_3x3()).to_4x4()
    R.translation = M.translation
    pb.matrix = R
    _update()


def head(arm, name):
    return _pb(arm, name).head.copy()


def tail(arm, name):
    return _pb(arm, name).tail.copy()


def two_bone(arm, upper, lower, target, pole):
    """Point a two-bone chain (thigh and calf, or upper and lower arm) at `target`, bending toward `pole`."""
    a = head(arm, upper)
    l1, l2 = arm.data.bones[upper].length, arm.data.bones[lower].length
    d = target - a
    dist = max(1e-4, min(d.length, (l1 + l2) * 0.999))
    dn = d.normalized()
    cos_a = max(-1.0, min(1.0, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist)))
    ang = math.acos(cos_a)
    pp = pole - dn * pole.dot(dn)
    if pp.length < 1e-6:
        pp = Vector((0, -1, 0))
    pp.normalize()
    up_dir = dn * math.cos(ang) + pp * math.sin(ang)
    aim(arm, upper, up_dir)
    joint = head(arm, lower)
    aim(arm, lower, (a + dn * dist) - joint)


def leaned(deg):
    """Straight up, tipped back by `deg` (toward +y, behind the character)."""
    r = math.radians(deg)
    return Vector((0, math.sin(r), math.cos(r)))


# ---------- reading and writing poses ----------

def capture(arm):
    return {pb.name: (pb.rotation_quaternion.copy(), pb.location.copy()) for pb in arm.pose.bones}


def apply(arm, pose):
    for pb in arm.pose.bones:
        if pb.name in pose:
            pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion, pb.location = pose[pb.name][0].copy(), pose[pb.name][1].copy()
    _update()


def pose_from_action(arm, action_name, frame=1):
    ad = arm.animation_data or arm.animation_data_create()
    act = bpy.data.actions[action_name]
    ad.action = act
    if getattr(act, 'slots', None):
        ad.action_slot = act.slots[0]
    bpy.context.scene.frame_set(frame)
    _update()
    p = capture(arm)
    ad.action = None
    return p


def build_pose(arm, base, spec, breathe=0.0, look=0.0):
    """One sitting pose from a family's spec, starting from the library's chair sit (`base`)."""
    apply(arm, base)
    hip_z = m(spec['seat'] + CONTACT)
    lean = spec['lean'] + breathe
    # Hips: placed behind the origin at seat height, tipped with the back.
    pel = _pb(arm, 'pelvis')
    M = pel.matrix.copy()
    M.translation = Vector((0, m(spec['hip_back']), hip_z))
    pel.matrix = M
    _update()
    aim(arm, 'pelvis', leaned(lean * 0.5))
    for name, k in (('spine_01', 0.7), ('spine_02', 0.9), ('spine_03', 1.0)):
        aim(arm, name, leaned(lean * k))
    aim(arm, 'neck_01', leaned(lean * 0.5 + spec['head'] * 0.5))
    aim(arm, 'Head', leaned(lean * 0.2 + spec['head']))
    if look:
        twist(arm, 'Head', look)
    # Legs: ankles at the family's spot, knees bending forward (up for knees-up and cross-legged poses).
    fy, fz = spec['feet']
    for side, sx in (('l', 1), ('r', -1)):
        if spec.get('cross'):
            # Each foot tucks under the other knee; the knees fall outward.
            target = Vector((-sx * abs(spec['spread']), -m(fy), m(fz)))
            pole = Vector((sx * 1.0, -0.6, 0.6))
        else:
            target = Vector((sx * m(spec['spread']), -m(fy), m(fz)))
            pole = Vector((sx * 0.1, -1.0, 0.9 if spec.get('knees_up') else 0.25))
        two_bone(arm, f'thigh_{side}', f'calf_{side}', target, pole)
        foot_dir = Vector((0, -0.55, 0.84)) if fz > 0.3 and fy > 0.4 else Vector((0, -0.89, -0.45))
        aim(arm, f'foot_{side}', foot_dir)
        aim(arm, f'ball_{side}', Vector((0, -1, 0.02)))
    # Arms: hands to where this family rests them; elbows out and back.
    for side, sx in (('l', 1), ('r', -1)):
        knee = head(arm, f'calf_{side}')
        hip = head(arm, f'thigh_{side}')
        pel_h = head(arm, 'pelvis')
        hd = tail(arm, 'Head')
        h = spec['hands']
        if h == 'lap':
            target, pole = hip.lerp(knee, 0.62) + Vector((sx * 0.02, 0, m(0.07))), Vector((sx * 0.8, 0.6, -0.3))
        elif h == 'knees':
            target, pole = knee + Vector((sx * 0.01, m(0.02), m(0.06))), Vector((sx * 0.8, 0.4, -0.2))
        elif h == 'belly':
            target, pole = pel_h + Vector((sx * m(0.09), -m(0.10), m(0.20))), Vector((sx * 1.0, 0.3, -0.4))
        elif h == 'keys':
            target, pole = Vector((sx * m(0.17), m(spec['hip_back'] - 0.46), m(0.76))), Vector((sx * 0.9, 0.3, -0.5))
        elif h == 'counter':
            target, pole = Vector((sx * m(0.19), m(spec['hip_back'] - 0.40), m(1.0))), Vector((sx * 0.9, 0.2, -0.6))
        else:  # behind_head
            target, pole = hd + Vector((sx * m(0.09), m(0.10), -m(0.06))), Vector((sx * 1.0, 0.0, 0.5))
        two_bone(arm, f'upperarm_{side}', f'lowerarm_{side}', target, pole)
        aim(arm, f'hand_{side}', tail(arm, f'lowerarm_{side}') - head(arm, f'lowerarm_{side}'))
    return capture(arm)


def hip_of(arm, pose):
    apply(arm, pose)
    return head(arm, 'pelvis')


# ---------- actions ----------

def _key(arm, pose, frame, prev):
    apply(arm, pose)
    for pb in arm.pose.bones:
        q = pb.rotation_quaternion.copy()
        # Keep each bone on the short way round between keys, or it would spin the long way.
        if pb.name in prev and q.dot(prev[pb.name]) < 0:
            q.negate()
            pb.rotation_quaternion = q
        prev[pb.name] = q.copy()
        pb.keyframe_insert('rotation_quaternion', frame=frame, group=pb.name)
        if pb.name in ('pelvis', 'root'):
            pb.keyframe_insert('location', frame=frame, group=pb.name)


def make_action(arm, name, keys):
    """An action from (frame, pose) keys, added as a muted NLA track the exporter writes out as its own clip."""
    ad = arm.animation_data or arm.animation_data_create()
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    ad.action = act
    prev = {}
    for frame, pose in keys:
        _key(arm, pose, frame, prev)
    for fc in _fcurves(act):
        for kp in fc.keyframe_points:
            kp.interpolation = 'BEZIER'
            kp.easing = 'EASE_IN_OUT'
    ad.action = None
    tr = ad.nla_tracks.new()
    tr.name = name
    st = tr.strips.new(name, 1, act)
    if hasattr(st, 'action_slot') and getattr(act, 'slots', None):
        st.action_slot = act.slots[0]
    tr.mute = True
    return act


def _fcurves(act):
    # Blender 5 keeps keys in layers and strips; older versions on the action itself.
    if hasattr(act, 'layers') and act.layers:
        for layer in act.layers:
            for strip in layer.strips:
                for bag in getattr(strip, 'channelbags', []):
                    yield from bag.fcurves
    elif hasattr(act, 'fcurves'):
        yield from act.fcurves


def add_sitting(arm, out_json=None):
    """Adds one clip, SitPoses, holding every pose the sitting styles need as single frames (standing, the chair and
    crouch in-betweens, then each family's sitting pose and two breathing variants), and writes which frame is which
    and where each family's hips land. The page builds the sit-down, idle and stand-up motions from these poses: one
    clip of a few dozen frames instead of thirty clips, each of which the exporter would describe bone by bone."""
    import json
    stand = pose_from_action(arm, 'Idle_Loop')
    chair = pose_from_action(arm, 'Sitting_Idle_Loop')
    crouch = pose_from_action(arm, 'Crouch_Idle_Loop')
    keys, frames, hips = [(1, stand), (2, chair), (3, crouch)], {}, {}
    f = 4
    for fam, spec in FAMILIES.items():
        sat = build_pose(arm, chair, spec)
        hips[fam] = [round(v, 4) for v in hip_of(arm, sat)]
        a = build_pose(arm, chair, spec, breathe=-1.2, look=6)
        b = build_pose(arm, chair, spec, breathe=-1.2, look=-6)
        keys += [(f, sat), (f + 1, a), (f + 2, b)]
        frames[fam] = {'sat': f, 'a': f + 1, 'b': f + 2, 'mid': {'chair': 2, 'crouch': 3}.get(spec['mid'])}
        f += 3
    make_action(arm, 'SitPoses', keys)
    apply(arm, stand)
    scn = bpy.context.scene
    if out_json:
        with open(out_json, 'w') as fh:
            json.dump({'scale': SCALE, 'fps': scn.render.fps / scn.render.fps_base, 'stand': 1,
                       'families': {k: {'hip': hips[k], 'seat': FAMILIES[k]['seat'], **frames[k]} for k in FAMILIES}}, fh, indent=1)
    return hips
