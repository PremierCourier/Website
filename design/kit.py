# Premier Courier "what we carry" kit — the home hero's floating objects.
#
#   blender -b -P design/kit.py -- OBJECT [--preview] [--turntable N]
#
#   OBJECT: cooler | vials | envelope | sterile | all
#
# Each object is built from scratch (no external assets except the P mark cropped from the
# official logo), floated on a transparent background under one product-launch light rig,
# and framed by its own camera. Output:
#   renders/<object>.png                  still (frame 0 of the turntable)
#   renders/turntable/<object>/NNN.png    N frames turning a full circle about the vertical
#   blend/<object>.blend                  scene only (no UI state, no local paths)
#
# Privacy: vials are empty, frosted, and unlabeled; the envelope is closed; the sterile pack
# carries plain tape. Nothing shows a label, barcode, requisition, or patient detail.
# Render metadata stamps are off; npm run stills strips what Blender still writes.

import math
import os
import sys

import bpy
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREVIEW = '--preview' in ARGS
TURNTABLE = int(ARGS[ARGS.index('--turntable') + 1]) if '--turntable' in ARGS else 0
OBJECTS = ('cooler', 'vials', 'envelope', 'sterile')
WHICH = [a for a in ARGS if a in OBJECTS + ('all',)]
if not WHICH:
    sys.exit('usage: blender -b -P design/kit.py -- cooler|vials|envelope|sterile|all [--preview] [--turntable N]')
TARGETS = list(OBJECTS) if 'all' in WHICH else WHICH

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, 'renders')
BLEND_DIR = os.path.join(HERE, 'blend')

# Brand palette (sRGB hex, from tokens.css).
COURIER_BLUE = '#178EC7'
DEEP_BLUE = '#0A5A96'
NAVY = '#0B3556'
SKY = '#6BADDF'
WHITE = '#FFFFFF'
PAPER = '#F4F6F8'

MARK_ASPECT = 40 / 59  # width / height of design/p-mark.png

# Per object: still size (px), camera azimuth (deg), tilt of the object inside the rig
# (deg about X, then Y), so a vertical spin reads as a floating tumble.
SPECS = {
    'cooler':   {'size': 1200, 'azimuth': 34, 'tilt': (6, 0)},
    'vials':    {'size': 800,  'azimuth': 20, 'tilt': (0, 24)},
    'envelope': {'size': 800,  'azimuth': 22, 'tilt': (10, 16)},
    'sterile':  {'size': 800,  'azimuth': 30, 'tilt': (28, -10)},
}


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


def material(name, hex_color, roughness=0.24, coat=0.65, coat_roughness=0.06, **extra):
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
    # The P mark from the official logo, packed into the .blend. (A loaded image keeps its
    # absolute path, and remapping it to "//" leaves the old path's bytes in the file.)
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


def rounded_box(name, size, location, bevel, mat, segments=8):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = active()
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = obj.modifiers.new('Bevel', 'BEVEL')
    mod.width = bevel
    mod.segments = segments
    mod.limit_method = 'NONE'
    mod.harden_normals = True
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(mat)
    return obj


def disc(name, radius, depth, location, rotation, mat, vertices=96):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth,
                                        location=location, rotation=rotation)
    obj = active()
    obj.name = name
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(mat)
    return obj


def mark_plane(name, height, location, rotation, mat):
    bpy.ops.mesh.primitive_plane_add(size=1, location=location, rotation=rotation)
    obj = active()
    obj.name = name
    obj.scale = (height * MARK_ASPECT, height, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return obj


def seal(prefix, radius, location, rotation, normal_offset):
    """White round sticker with a Courier Blue ring and the P mark — the brand's seal."""
    white = material(f'{prefix} Seal', WHITE, roughness=0.45, coat=0.2)
    ring = material(f'{prefix} Seal Ring', COURIER_BLUE)
    loc = Vector(location)
    n = Vector(normal_offset)
    disc(f'{prefix} Seal Ring', radius, 0.0012, loc, rotation, ring)
    disc(f'{prefix} Seal', radius * 0.86, 0.0014, loc + n * 0.0002, rotation, white)
    mark_plane(f'{prefix} Seal Mark', radius * 1.2, loc + n * 0.0012, rotation, mark_material())


# ---------- objects ----------

def build_cooler():
    W, D, H = 0.56, 0.38, 0.30
    LID_H, OVER, SEAM = 0.075, 0.008, 0.005
    body = material('Cooler Body', COURIER_BLUE)
    lid = material('Cooler Lid', DEEP_BLUE)
    hardware = material('Hardware', NAVY, roughness=0.45, coat=0.2)

    rounded_box('Body', (W, D, H), (0, 0, H / 2), 0.035, body)
    rounded_box('Lid', (W + 2 * OVER, D + 2 * OVER, LID_H), (0, 0, H + SEAM + LID_H / 2), 0.03, lid)
    top = H + SEAM + LID_H
    rounded_box('Lid Panel', (W - 0.1, D - 0.1, 0.016), (0, 0, top + 0.004), 0.007, lid, 4)

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
    for x in (-0.15, 0.15):
        rounded_box(f'Handle Mount {x:+.2f}', (0.05, 0.05, 0.024), (x, 0, top + 0.016), 0.008, hardware, 4)

    latch_y = D / 2 + OVER + 0.004
    for side, y in (('Front', -latch_y), ('Back', latch_y)):
        for x in (-0.17, 0.17):
            rounded_box(f'Latch {side} {x:+.2f}', (0.052, 0.018, 0.072), (x, y, H + 0.01), 0.006, hardware, 4)

    # Front decal: the brand guide's white panel carrying the P mark.
    white = material('Decal', WHITE, roughness=0.45, coat=0.2)
    z = H * 0.47
    disc('Decal', 0.078, 0.002, (0, -(D / 2) - 0.0008, z), (math.radians(90), 0, 0), white)
    mark_plane('P Mark', 0.112, (0, -(D / 2) - 0.0022, z), (math.radians(90), 0, 0), mark_material())


def round_cap(name, radius, height, location, mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=radius, depth=height, location=location)
    obj = active()
    obj.name = name
    mod = obj.modifiers.new('Bevel', 'BEVEL')
    mod.width = min(radius, height) * 0.25
    mod.segments = 5
    mod.limit_method = 'ANGLE'
    mod.harden_normals = True
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(mat)
    return obj


def build_vials():
    # Three sealed collection tubes: frosted, empty, unlabeled, with brand-blue caps.
    glass = material('Tube', '#C4D8E9', roughness=0.3, coat=0.6,
                     Transmission_Weight=0.08, IOR=1.45)
    caps = [material('Cap Deep', DEEP_BLUE), material('Cap Courier', COURIER_BLUE), material('Cap Navy', NAVY)]
    R, L = 0.0095, 0.092
    for i, (x, y, dz) in enumerate(((-0.02, 0.0, 0.0), (0.0, -0.014, 0.012), (0.02, 0.004, -0.006))):
        bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=R, depth=L, location=(x, y, dz + L / 2))
        tube = active()
        tube.name = f'Tube {i}'
        bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=R, location=(x, y, dz))
        cap_end = active()
        cap_end.name = f'Tube Bottom {i}'
        for o in (tube, cap_end):
            bpy.ops.object.select_all(action='DESELECT')
        tube.select_set(True)
        cap_end.select_set(True)
        bpy.context.view_layer.objects.active = tube
        bpy.ops.object.join()
        bpy.ops.object.shade_smooth()
        tube.data.materials.append(glass)
        round_cap(f'Cap {i}', R * 1.2, 0.024, (x, y, dz + L + 0.009), caps[i])
        round_cap(f'Cap Rim {i}', R * 1.3, 0.005, (x, y, dz + L - 0.001), caps[i])


def build_envelope():
    # A closed document envelope, flap side toward camera, sealed with the P-mark sticker.
    W, H, T = 0.24, 0.165, 0.005
    paper = material('Envelope', PAPER, roughness=0.72, coat=0.0, Sheen_Weight=0.25)
    rounded_box('Envelope', (W, T, H), (0, 0, 0), 0.0025, paper, 3)
    # Flap: a shallow triangle folded over the back face (−Y side faces camera).
    mesh = bpy.data.meshes.new('Flap')
    y = -T / 2 - 0.0009
    verts = [(-W / 2 + 0.003, y, H / 2 - 0.002), (W / 2 - 0.003, y, H / 2 - 0.002), (0, y, -0.012)]
    mesh.from_pydata(verts, [], [(0, 1, 2)])
    flap = bpy.data.objects.new('Flap', mesh)
    bpy.context.collection.objects.link(flap)
    flap_mat = material('Flap', '#EDF1F5', roughness=0.7, coat=0.0)
    mesh.materials.append(flap_mat)
    solid = flap.modifiers.new('Thickness', 'SOLIDIFY')
    solid.thickness = 0.0012
    seal('Envelope', 0.021, (0, y - 0.0012, -0.004), (math.radians(90), 0, 0), (0, -1, 0))


def build_sterile():
    # Sterile instrument pack: blue wrap folded envelope-style, closed with plain white tape.
    W, D, H = 0.24, 0.16, 0.06
    wrap = material('Sterile Wrap', '#4E9AD3', roughness=0.8, coat=0.0, Sheen_Weight=0.4)
    fold = material('Sterile Wrap Fold', '#2F7FBE', roughness=0.8, coat=0.0, Sheen_Weight=0.4)
    tape = material('Tape', WHITE, roughness=0.5, coat=0.1)
    rounded_box('Pack', (W, D, H), (0, 0, 0), 0.012, wrap, 5)
    top = H / 2
    # Envelope folds on top: four shallow triangles meeting near the centre.
    mesh = bpy.data.meshes.new('Folds')
    z = top + 0.0025
    c = (0.0, 0.012, z + 0.006)
    verts = [(-W / 2 + 0.01, -D / 2 + 0.01, z), (W / 2 - 0.01, -D / 2 + 0.01, z),
             (W / 2 - 0.01, D / 2 - 0.01, z), (-W / 2 + 0.01, D / 2 - 0.01, z), c]
    mesh.from_pydata(verts, [], [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)])
    folds = bpy.data.objects.new('Folds', mesh)
    bpy.context.collection.objects.link(folds)
    mesh.materials.append(fold)
    mod = folds.modifiers.new('Thickness', 'SOLIDIFY')
    mod.thickness = 0.0015
    # Tape band across the pack, over the folds
    rounded_box('Tape', (0.03, D + 0.004, 0.003), (0.0, 0.0, top + 0.004), 0.001, tape, 2)
    rounded_box('Tape Front', (0.03, 0.003, H * 0.7), (0.0, -D / 2 - 0.0015, top - H * 0.35), 0.001, tape, 2)


BUILDERS = {'cooler': build_cooler, 'vials': build_vials, 'envelope': build_envelope, 'sterile': build_sterile}


# ---------- scene ----------

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


def world_bounds(objs):
    bpy.context.view_layer.update()
    pts = []
    for o in objs:
        if o.type in {'MESH', 'CURVE'}:
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def build_scene(name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    spec = SPECS[name]
    BUILDERS[name]()
    parts = [o for o in scene.objects if o.type in {'MESH', 'CURVE'}]

    # Centre the object on the origin, tilt it inside the rig, then spin the rig.
    lo, hi = world_bounds(parts)
    centre = (lo + hi) / 2
    tilt = bpy.data.objects.new('Tilt', None)
    rig = bpy.data.objects.new('Rig', None)
    for o in (tilt, rig):
        scene.collection.objects.link(o)
    tilt.parent = rig
    tilt.rotation_euler = (math.radians(spec['tilt'][0]), math.radians(spec['tilt'][1]), 0)
    for o in parts:
        o.location -= centre
        o.parent = tilt

    # Bounding sphere over every turntable angle = sphere around the centred parts.
    bpy.context.view_layer.update()
    radius = max((o.matrix_world @ Vector(c)).length for o in parts for c in o.bound_box)

    target = bpy.data.objects.new('Target', None)
    scene.collection.objects.link(target)
    cam_data = bpy.data.cameras.new('Camera')
    cam_data.lens = 85
    cam = bpy.data.objects.new('Camera', cam_data)
    half_fov = math.atan(18 / cam_data.lens)
    dist = radius / math.sin(half_fov) * 1.2   # margin keeps the object clear of the edge fade
    elev, az = math.radians(18), math.radians(spec['azimuth'])
    cam.location = Vector((-math.sin(az) * math.cos(elev), -math.cos(az) * math.cos(elev), math.sin(elev))) * dist
    scene.collection.objects.link(cam)
    c = cam.constraints.new('TRACK_TO')
    c.target = target
    c.track_axis = 'TRACK_NEGATIVE_Z'
    c.up_axis = 'UP_Y'
    scene.camera = cam

    # Product-launch rig, scaled to the object. Lights cast no shadows: the objects float.
    s = radius / 0.4
    area_light('Key', Vector((-1.1, -1.3, 2.1)) * s, 40 * s * s, 1.6 * s, target)
    area_light('Fill', Vector((1.7, -0.9, 0.8)) * s, 12 * s * s, 2.2 * s, target)
    area_light('Rim', Vector((0.7, 1.7, 1.5)) * s, 110 * s * s, 1.0 * s, target, size_y=0.3 * s)
    area_light('Rim Left', Vector((-1.5, 1.2, 1.0)) * s, 55 * s * s, 0.8 * s, target, size_y=0.25 * s)
    area_light('Strip', Vector((1.25, -1.55, 0.75)) * s, 60 * s * s, 0.12 * s, target, size_y=1.8 * s)
    area_light('Top', Vector((0, 0, 1.5)) * s, 30 * s * s, 0.8 * s, target)

    world = bpy.data.worlds.new('White')
    try:
        world.use_nodes = True
    except AttributeError:
        pass
    bg = world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value = (1, 1, 1, 1)
    bg.inputs['Strength'].default_value = 0.14
    scene.world = world

    configure_render(scene, spec['size'])
    return scene, rig


def configure_render(scene, size):
    r = scene.render
    r.engine = 'CYCLES'
    r.film_transparent = True
    # Translucent tubes composite as solid frosted plastic: with transparent glass on, they
    # vanish. The page behind is white either way.
    scene.cycles.film_transparent_glass = False
    r.resolution_x = r.resolution_y = size
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
    # Brand blues render true to hex under Standard; AgX would desaturate them.
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = -0.25
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


def render(name):
    scene, rig = build_scene(name)
    os.makedirs(OUT_DIR, exist_ok=True)
    if TURNTABLE:
        out = os.path.join(OUT_DIR, 'turntable', name)
        os.makedirs(out, exist_ok=True)
        for f in os.listdir(out):
            os.remove(os.path.join(out, f))
        # Frames cover the object at 2x its largest display size.
        scene.render.resolution_percentage = 60 if name == 'cooler' else 60
        scene.cycles.samples = 140
        for i in range(TURNTABLE):
            rig.rotation_euler.z = math.radians(i * 360 / TURNTABLE)
            scene.render.filepath = os.path.join(out, f'{i:03d}.png')
            bpy.ops.render.render(write_still=True)
        rig.rotation_euler.z = 0
        print(f'Wrote {TURNTABLE} frames: {out}')
        return
    os.makedirs(BLEND_DIR, exist_ok=True)
    bpy.data.libraries.write(os.path.join(BLEND_DIR, f'{name}.blend'), {scene}, path_remap='RELATIVE_ALL', compress=False)
    suffix = '-preview' if PREVIEW else ''
    scene.render.filepath = os.path.join(OUT_DIR, f'kit-{name}{suffix}.png')
    bpy.ops.render.render(write_still=True)
    print(f'Wrote {scene.render.filepath}')


for target_name in TARGETS:
    render(target_name)
