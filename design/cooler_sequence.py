# Premier Courier cooler — open/close frame sequence for the scroll-scrubbed hero.
#
#   blender -b -P design/cooler_sequence.py -- --still closed|exploded [--preview]
#   blender -b -P design/cooler_sequence.py -- --sequence N [--preview]
#
# One parameter, `open` (0 = sealed, 1 = fully exploded), drives the whole scene: the lid
# lifts first, then the top cold pack, the inner pouch, and the bottom cold pack, each on its
# own eased curve; the latches swing down as the lid leaves; the camera pulls back so the
# closed cooler fills the frame and the open stack still fits. The page scrubs 0 → 1 → 0.
#
# Output (transparent background, soft contact shadow):
#   renders/sequence/closed.png, renders/sequence/exploded.png   the two approval stills
#   renders/sequence/frames/NNN.png                              N frames, open 0 → 1
#   blend/cooler_sequence.blend                                  scene only, no UI state/paths
#
# Nothing in the cooler carries a label, barcode, tube, form, or text. The P mark is the real
# mark cropped from the official logo (design/p-mark.png), applied as a texture — never drawn.

import math
import os
import sys

import bpy
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREVIEW = '--preview' in ARGS
STILL = ARGS[ARGS.index('--still') + 1] if '--still' in ARGS else None
SEQUENCE = int(ARGS[ARGS.index('--sequence') + 1]) if '--sequence' in ARGS else 0
if not STILL and not SEQUENCE:
    sys.exit('usage: blender -b -P design/cooler_sequence.py -- --still closed|exploded | --sequence N [--preview]')

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'renders', 'sequence')
SIZE = 1200

COURIER_BLUE = '#178EC7'
DEEP_BLUE = '#0A5A96'
NAVY = '#0B3556'
SKY = '#6BADDF'
FOAM = '#EEF3F8'
WHITE = '#FFFFFF'
MARK_ASPECT = 40 / 59

# Cooler, metres
W, D, H = 0.56, 0.38, 0.30          # body outside
WALL = 0.035                        # insulated wall and floor
LID_H, OVER, SEAM = 0.075, 0.008, 0.004
CAV_W, CAV_D = W - 2 * WALL, D - 2 * WALL

# Exploded layout: (lift in m, x shift, y shift, z-rotation deg, x-tilt deg, y-tilt deg).
# Order is the opening order; each part starts a little after the previous one.
PARTS = {
    'lid':      {'order': 0, 'lift': 0.88, 'dx': 0.00, 'dy': 0.02, 'rz': 0,  'rx': -12, 'ry': 6},
    'pack_top': {'order': 1, 'lift': 0.66, 'dx': -0.03, 'dy': 0.0, 'rz': -7, 'rx': 0,   'ry': -3},
    'pouch':    {'order': 2, 'lift': 0.50, 'dx': 0.03, 'dy': 0.0, 'rz': 9,  'rx': 0,   'ry': 4},
    'pack_bot': {'order': 3, 'lift': 0.34, 'dx': -0.02, 'dy': 0.0, 'rz': -4, 'rx': 0,   'ry': -2},
}
STAGGER = 0.1


# ---------- helpers ----------

def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgba(h):
    h = h.lstrip('#')
    return tuple(srgb_to_linear(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)) + (1.0,)


def set_input(node, names, value):
    for n in names:
        if n in node.inputs:
            node.inputs[n].default_value = value
            return


def material(name, hex_color, roughness=0.26, coat=0.55, coat_roughness=0.08, **extra):
    mat = bpy.data.materials.new(name)
    try:
        mat.use_nodes = True
    except AttributeError:
        pass
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    set_input(bsdf, ['Base Color'], hex_rgba(hex_color))
    set_input(bsdf, ['Roughness'], roughness)
    set_input(bsdf, ['Coat Weight', 'Clearcoat'], coat)
    set_input(bsdf, ['Coat Roughness', 'Clearcoat Roughness'], coat_roughness)
    for key, value in extra.items():
        set_input(bsdf, [key.replace('_', ' ')], value)
    return mat


def mark_material():
    # Pixels copied into a packed image: a loaded image keeps its absolute path in the .blend.
    mat = bpy.data.materials.new('P Mark')
    try:
        mat.use_nodes = True
    except AttributeError:
        pass
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    src = bpy.data.images.load(os.path.join(HERE, 'p-mark.png'))
    img = bpy.data.images.new('P Mark', src.size[0], src.size[1], alpha=True)
    img.pixels = src.pixels[:]
    img.pack()
    bpy.data.images.remove(src)
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = img
    tex.interpolation = 'Cubic'
    tex.extension = 'CLIP'
    links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
    set_input(bsdf, ['Roughness'], 0.5)
    return mat


def active():
    return bpy.context.active_object


def box(name, size, location, bevel, mat, segments=6, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = active()
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = 'ANGLE'
        mod.harden_normals = True
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(mat)
    if parent:
        set_parent(obj, parent)
    return obj


def set_parent(obj, parent):
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_parent_inverse = parent.matrix_world.inverted()
    obj.matrix_world = world


def empty(name, location=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    e.location = location
    bpy.context.collection.objects.link(e)
    return e


def area_light(name, location, energy, size, target, size_y=None, shadow=False):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.use_shadow = shadow
    if size_y:
        data.shape = 'RECTANGLE'
        data.size, data.size_y = size, size_y
    else:
        data.size = size
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    bpy.context.collection.objects.link(obj)
    c = obj.constraints.new('TRACK_TO')
    c.target = target
    c.track_axis = 'TRACK_NEGATIVE_Z'
    c.up_axis = 'UP_Y'
    return obj


def smoothstep(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


# ---------- model ----------

def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene

    shell = material('Shell', COURIER_BLUE)
    lid_mat = material('Lid', DEEP_BLUE)
    foam = material('Insulation', FOAM, roughness=0.9, coat=0.0, Sheen_Weight=0.3)
    hardware = material('Hardware', NAVY, roughness=0.45, coat=0.2)
    gel = material('Cold Pack', '#2F97D2', roughness=0.3, coat=0.25, Transmission_Weight=0.06, IOR=1.33)
    pouch_mat = material('Pouch', '#AFC4D6', roughness=0.55, coat=0.15)
    seal_mat = material('Pouch Seal', '#8FA9C0', roughness=0.55, coat=0.1)
    white = material('Decal', WHITE, roughness=0.45, coat=0.2)

    # Body: a hollow insulated shell. The cavity is cut by a hidden box whose foam material
    # transfers onto the cut faces, so the inside reads as white insulation.
    body = box('Body', (W, D, H), (0, 0, H / 2), 0.035, shell)
    cutter = box('Cavity Cutter', (CAV_W, CAV_D, H), (0, 0, WALL + H / 2 + 0.001), 0, foam)
    cutter.hide_render = True
    cutter.display_type = 'WIRE'
    boolean = body.modifiers.new('Cavity', 'BOOLEAN')
    boolean.operation = 'DIFFERENCE'
    boolean.object = cutter
    boolean.solver = 'EXACT'
    try:
        boolean.material_mode = 'TRANSFER'
    except (AttributeError, TypeError):
        pass
    body.data.materials.append(foam)
    # Boolean before bevel so the rim is rounded too.
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_move_to_index(modifier='Cavity', index=0)
    set_parent(cutter, body)

    # Front decal: white panel with the real P mark.
    z = H * 0.47
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=0.078, depth=0.002,
                                        location=(0, -(D / 2) - 0.0008, z), rotation=(math.radians(90), 0, 0))
    decal = active()
    decal.name = 'Decal'
    bpy.ops.object.shade_smooth()
    decal.data.materials.append(white)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -(D / 2) - 0.0022, z), rotation=(math.radians(90), 0, 0))
    mark = active()
    mark.name = 'P Mark'
    mark.scale = (0.112 * MARK_ASPECT, 0.112, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mark.data.materials.append(mark_material())

    # Latches hinge at their bottom edge on the body front and swing down as the lid leaves.
    latches = []
    for x in (-0.17, 0.17):
        hinge = empty(f'Latch Hinge {x:+.2f}', (x, -(D / 2 + 0.006), H - 0.03))
        latch = box(f'Latch {x:+.2f}', (0.052, 0.018, 0.072), (x, -(D / 2 + 0.006), H - 0.03 + 0.036), 0.006, hardware, 4)
        set_parent(latch, hinge)
        latches.append(hinge)

    # Lid: shell, raised panel, foam plug underneath, carry handle.
    lid = empty('Lid Rig', (0, 0, H + SEAM + LID_H / 2))
    box('Lid Shell', (W + 2 * OVER, D + 2 * OVER, LID_H), lid.location, 0.03, lid_mat, parent=lid)
    top = H + SEAM + LID_H
    box('Lid Panel', (W - 0.1, D - 0.1, 0.016), (0, 0, top + 0.004), 0.007, lid_mat, 4, parent=lid)
    box('Lid Plug', (CAV_W - 0.006, CAV_D - 0.006, 0.03), (0, 0, H + SEAM - 0.015), 0.01, foam, 4, parent=lid)
    curve = bpy.data.curves.new('Handle', 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = 0.013
    curve.bevel_resolution = 6
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(2)
    for bp, co in zip(spline.bezier_points, [(-0.15, 0, top + 0.022), (0, 0, top + 0.085), (0.15, 0, top + 0.022)]):
        bp.co = co
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    handle = bpy.data.objects.new('Handle', curve)
    bpy.context.collection.objects.link(handle)
    curve.materials.append(hardware)
    set_parent(handle, lid)
    for x in (-0.15, 0.15):
        box(f'Handle Mount {x:+.2f}', (0.05, 0.05, 0.024), (x, 0, top + 0.016), 0.008, hardware, 4, parent=lid)

    # Contents, stacked inside the cavity: cold pack, sealed plain pouch, cold pack.
    pack_size = (CAV_W - 0.03, CAV_D - 0.03, 0.032)
    z1 = WALL + 0.004 + 0.016
    pack_bot = empty('Pack Bottom Rig', (0, 0, z1))
    box('Cold Pack Bottom', pack_size, (0, 0, z1), 0.012, gel, parent=pack_bot)
    z2 = z1 + 0.016 + 0.004 + 0.035
    pouch = empty('Pouch Rig', (0, 0, z2))
    box('Pouch', (CAV_W - 0.07, CAV_D - 0.06, 0.07), (0, 0, z2), 0.022, pouch_mat, 8, parent=pouch)
    box('Pouch Seal', (0.022, CAV_D - 0.07, 0.012), ((CAV_W - 0.07) / 2 - 0.004, 0, z2), 0.004, seal_mat, 3, parent=pouch)
    z3 = z2 + 0.035 + 0.004 + 0.016
    pack_top = empty('Pack Top Rig', (0, 0, z3))
    box('Cold Pack Top', pack_size, (0, 0, z3), 0.012, gel, parent=pack_top)

    rigs = {'lid': lid, 'pack_top': pack_top, 'pouch': pouch, 'pack_bot': pack_bot}
    rest = {k: v.location.copy() for k, v in rigs.items()}

    # Shadow-catcher floor: only the overhead softbox casts a shadow.
    bpy.ops.mesh.primitive_plane_add(size=14, location=(0, 0, 0))
    floor = active()
    floor.name = 'Shadow Catcher'
    floor.is_shadow_catcher = True

    target = empty('Target')
    cam_data = bpy.data.cameras.new('Camera')
    cam_data.lens = 70
    cam = bpy.data.objects.new('Camera', cam_data)
    bpy.context.collection.objects.link(cam)
    c = cam.constraints.new('TRACK_TO')
    c.target = target
    c.track_axis = 'TRACK_NEGATIVE_Z'
    c.up_axis = 'UP_Y'
    scene.camera = cam

    area_light('Key', (-1.4, -1.6, 2.6), 60, 1.8, target)
    area_light('Fill', (2.0, -1.1, 1.0), 16, 2.4, target)
    area_light('Rim', (0.9, 2.0, 2.0), 150, 1.2, target, size_y=0.35)
    area_light('Rim Left', (-1.8, 1.4, 1.3), 70, 1.0, target, size_y=0.3)
    area_light('Strip', (1.5, -1.9, 1.0), 70, 0.14, target, size_y=2.2)
    area_light('Top', (0, 0, 2.6), 45, 1.1, target, shadow=True)

    world = bpy.data.worlds.new('White')
    try:
        world.use_nodes = True
    except AttributeError:
        pass
    bg = world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value = (1, 1, 1, 1)
    bg.inputs['Strength'].default_value = 0.1
    scene.world = world

    configure_render(scene)
    return scene, {'rigs': rigs, 'rest': rest, 'latches': latches, 'cam': cam, 'target': target}


def pose(state, open_amount):
    """Place every part for open_amount in [0, 1]."""
    n = len(PARTS)
    span = 1 - STAGGER * (n - 1)
    for name, p in PARTS.items():
        k = smoothstep((open_amount - p['order'] * STAGGER) / span)
        rig = state['rigs'][name]
        rig.location = state['rest'][name] + Vector((p['dx'] * k, p['dy'] * k, p['lift'] * k))
        rig.rotation_euler = (math.radians(p['rx'] * k), math.radians(p['ry'] * k), math.radians(p['rz'] * k))
    # Latches swing down in the first part of the lid's travel.
    latch_k = smoothstep(open_amount / (STAGGER * 1.5))
    for hinge in state['latches']:
        hinge.rotation_euler = (math.radians(100 * latch_k), 0, 0)
    # Camera pulls back and up as the stack rises.
    cam_k = smoothstep(open_amount)
    target_z = 0.2 + 0.47 * cam_k
    dist = 1.95 + 1.05 * cam_k
    elev, az = math.radians(20 + 4 * cam_k), math.radians(34)
    state['target'].location = (0, 0, target_z)
    state['cam'].location = Vector((0, 0, target_z)) + Vector((
        -math.sin(az) * math.cos(elev), -math.cos(az) * math.cos(elev), math.sin(elev))) * dist
    bpy.context.view_layer.update()


def configure_render(scene):
    r = scene.render
    r.engine = 'CYCLES'
    r.film_transparent = True
    scene.cycles.film_transparent_glass = False
    r.resolution_x = r.resolution_y = SIZE
    r.resolution_percentage = 50 if PREVIEW else 100
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGBA'
    r.image_settings.color_depth = '8'
    r.use_stamp = False
    for attr in dir(r):
        if attr.startswith('use_stamp_'):
            try:
                setattr(r, attr, False)
            except (AttributeError, TypeError):
                pass
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = -0.45
    c = scene.cycles
    c.samples = 64 if PREVIEW else 320
    c.use_denoising = True
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for backend in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = backend
            prefs.get_devices()
            if any(d.type == backend for d in prefs.devices):
                for d in prefs.devices:
                    d.use = d.type == backend
                c.device = 'GPU'
                return
        except TypeError:
            continue
    c.device = 'CPU'


def main():
    scene, state = build()
    os.makedirs(OUT, exist_ok=True)
    if STILL:
        pose(state, 0.0 if STILL == 'closed' else 1.0)
        os.makedirs(os.path.join(HERE, 'blend'), exist_ok=True)
        bpy.data.libraries.write(os.path.join(HERE, 'blend', 'cooler_sequence.blend'), {scene},
                                 path_remap='RELATIVE_ALL', compress=False)
        suffix = '-preview' if PREVIEW else ''
        scene.render.filepath = os.path.join(OUT, f'{STILL}{suffix}.png')
        bpy.ops.render.render(write_still=True)
        print(f'Wrote {scene.render.filepath}')
        return
    scene.cycles.samples = 64 if PREVIEW else 180   # denoised; frames are seen in motion
    frames_dir = os.path.join(OUT, 'frames')
    os.makedirs(frames_dir, exist_ok=True)
    for f in os.listdir(frames_dir):
        os.remove(os.path.join(frames_dir, f))
    for i in range(SEQUENCE):
        pose(state, i / (SEQUENCE - 1))
        scene.render.filepath = os.path.join(frames_dir, f'{i:03d}.png')
        bpy.ops.render.render(write_still=True)
    print(f'Wrote {SEQUENCE} frames: {frames_dir}')


main()
