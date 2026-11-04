import bpy, math, mathutils


def look_at(obj, target):
    d = mathutils.Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def render_views(out_prefix, target=(0, 0, 0.95), dist=3.2, views=(('front', 0), ('side', 90), ('back', 180)), res=(640, 800), lens=50, height=1.1):
    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_EEVEE'
    scn.render.resolution_x, scn.render.resolution_y = res
    scn.render.film_transparent = False
    world = bpy.data.worlds.new('pv') if not scn.world else scn.world
    scn.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.18, 0.2, 0.24, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.6
    for name, energy, loc in (('key', 900, (2.5, -3, 3.5)), ('fill', 300, (-3, -2, 2)), ('rim', 600, (0, 3.5, 3))):
        if name not in bpy.data.objects:
            l = bpy.data.lights.new(name, 'AREA')
            l.energy, l.size = energy, 2
            o = bpy.data.objects.new(name, l)
            scn.collection.objects.link(o)
            o.location = loc
            look_at(o, target)
    cam = bpy.data.objects.get('pvcam')
    if not cam:
        cam = bpy.data.objects.new('pvcam', bpy.data.cameras.new('pvcam'))
        scn.collection.objects.link(cam)
    cam.data.lens = lens
    scn.camera = cam
    for name, ang in views:
        a = math.radians(ang)
        cam.location = (target[0] + dist * math.sin(a), target[1] - dist * math.cos(a), height)
        look_at(cam, target)
        scn.render.filepath = f'{out_prefix}-{name}.png'
        bpy.ops.render.render(write_still=True)
