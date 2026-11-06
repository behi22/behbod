"""Sitting poses lab: loads the exported character, poses it in each sitting style next to a stand-in seat, and renders
side and three-quarter previews so the poses can be judged by eye before they go into the character build.

blender -b --factory-startup -P blender/sit_lab.py -- probe            (print the rig's directions and the chair pose)
blender -b --factory-startup -P blender/sit_lab.py -- render <outdir>  (one preview per sitting style)
"""
import bpy, os, sys
from mathutils import Vector
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))).replace(os.sep, '/')
sys.path.insert(0, ROOT + '/blender')
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=ROOT + '/web/assets/behbod_v3.glb')
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')


def world(name, tail=False):
    pb = arm.pose.bones[name]
    return arm.matrix_world @ (pb.tail if tail else pb.head)


def use_action(name, frame=1):
    arm.animation_data_create()
    act = bpy.data.actions[name]
    arm.animation_data.action = act
    if act.slots:
        arm.animation_data.action_slot = act.slots[0]
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()


if ARGS and ARGS[0] == 'probe':
    print('armature', arm.name, 'loc', tuple(round(v, 3) for v in arm.location), 'scale', tuple(round(v, 3) for v in arm.scale), 'rot', tuple(round(v, 3) for v in arm.rotation_euler))
    print('actions', sorted(a.name for a in bpy.data.actions))
    for act in ('Idle_Loop', 'Sitting_Idle_Loop'):
        use_action(act)
        print('---', act)
        for b in ('root', 'pelvis', 'spine_03', 'Head', 'thigh_l', 'calf_l', 'foot_l', 'ball_l', 'upperarm_l', 'lowerarm_l', 'hand_l'):
            h, t = world(b), world(b, True)
            print(f'  {b:12s} head {tuple(round(v, 3) for v in h)}  tail {tuple(round(v, 3) for v in t)}')

if ARGS and ARGS[0] == 'render':
    from lib import sitposes as S
    from preview_lib import render_views
    out = ARGS[1]
    only = ARGS[2].split(',') if len(ARGS) > 2 else list(S.FAMILIES)
    # One look only: the hood up, base fits, no accessories.
    for o in bpy.data.objects:
        n = o.name
        if (n.startswith('V3_head_') and n != 'V3_head_void') or (n.startswith('V3_hood_') and n != 'V3_hood_up') or n.startswith('V3_acc_') \
                or n.endswith(('_short', '_relaxed', '_tapered')):
            o.hide_render = True
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
    chair = S.pose_from_action(arm, 'Sitting_Idle_Loop')
    for fam in only:
        spec = S.FAMILIES[fam]
        S.build_pose(arm, chair, spec)
        top = S.m(spec['seat'])
        depth = S.m(0.9 if fam == 'stretch' else 0.5)
        y = S.m(spec['hip_back']) - depth / 2 + S.m(0.18)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, y, top / 2))
        seat = bpy.context.active_object
        seat.scale = (S.m(0.6), depth, top)
        render_views(f'{out}/{fam}', target=(0, S.m(0.05), S.m(0.55)), dist=S.m(3.2), views=(('side', 90), ('3q', 35)), res=(420, 420), height=S.m(1.0))
        bpy.data.objects.remove(seat)
    print('rendered', ', '.join(only))
