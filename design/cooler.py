# Premier Courier transport cooler — hero still.
#
#   blender -b -P design/cooler.py -- [--preview] [--angle DEG]
#
# Builds the cooler from scratch (no external assets), lights it on white with a
# shadow-catcher floor, renders design/renders/cooler-hero.png with a transparent
# background, and saves design/cooler.blend for hand editing.
#
# The P mark decal is a flat placeholder disc until the P mark trace is approved.
# Render metadata stamps are disabled so no file path, host name, or date is written.

import math
import os
import sys

import bpy
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREVIEW = '--preview' in ARGS
AZIMUTH = float(ARGS[ARGS.index('--angle') + 1]) if '--angle' in ARGS else 34.0

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, 'renders')
OUT_NAME = 'cooler-hero-preview.png' if PREVIEW else 'cooler-hero.png'

# Brand palette (sRGB hex, from tokens.css).
COURIER_BLUE = '#178EC7'
DEEP_BLUE = '#0A5A96'
NAVY = '#0B3556'
SKY = '#6BADDF'

# Cooler dimensions, metres.
W, D, H_BODY = 0.56, 0.38, 0.30
LID_H, LID_OVERHANG, SEAM = 0.075, 0.008, 0.005


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


def plastic(name, hex_color, roughness=0.38, coat=0.35):
    mat = bpy.data.materials.new(name)
    try:
        mat.use_nodes = True
    except AttributeError:
        pass
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    set_input(bsdf, ['Base Color'], hex_rgba(hex_color))
    set_input(bsdf, ['Roughness'], roughness)
    set_input(bsdf, ['Coat Weight', 'Clearcoat'], coat)
    set_input(bsdf, ['Coat Roughness', 'Clearcoat Roughness'], 0.2)
    return mat


def rounded_box(name, size, location, bevel, mat, segments=8):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
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


def aim(obj, target):
    c = obj.constraints.new('TRACK_TO')
    c.target = target
    c.track_axis = 'TRACK_NEGATIVE_Z'
    c.up_axis = 'UP_Y'


def area_light(name, location, energy, size, target, size_y=None, shadow=True):
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
    aim(obj, target)
    return obj


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene

    body_mat = plastic('Cooler Body', COURIER_BLUE)
    lid_mat = plastic('Cooler Lid', DEEP_BLUE)
    hardware_mat = plastic('Hardware', NAVY, roughness=0.5, coat=0.1)
    decal_mat = plastic('Decal Placeholder', SKY, roughness=0.55, coat=0.0)

    # Body
    rounded_box('Body', (W, D, H_BODY), (0, 0, H_BODY / 2), 0.035, body_mat)

    # Lid, with a raised top panel
    lid_z = H_BODY + SEAM + LID_H / 2
    rounded_box('Lid', (W + 2 * LID_OVERHANG, D + 2 * LID_OVERHANG, LID_H), (0, 0, lid_z), 0.03, lid_mat)
    top_z = H_BODY + SEAM + LID_H
    rounded_box('Lid Panel', (W - 0.1, D - 0.1, 0.016), (0, 0, top_z + 0.004), 0.007, lid_mat, segments=4)

    # Carry handle: an arch across the lid, with two mounts
    curve = bpy.data.curves.new('Handle', 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = 0.013
    curve.bevel_resolution = 6
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(2)
    pts = [(-0.15, 0, top_z + 0.022), (0, 0, top_z + 0.085), (0.15, 0, top_z + 0.022)]
    for bp, co in zip(spline.bezier_points, pts):
        bp.co = co
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    handle = bpy.data.objects.new('Handle', curve)
    bpy.context.collection.objects.link(handle)
    curve.materials.append(hardware_mat)
    for x in (-0.15, 0.15):
        rounded_box(f'Handle Mount {x:+.2f}', (0.05, 0.05, 0.024), (x, 0, top_z + 0.016), 0.008, hardware_mat, 4)

    # Latches straddling the lid seam, front face (the decal side, −Y)
    latch_y = -(D / 2 + LID_OVERHANG + 0.004)
    for x in (-0.17, 0.17):
        rounded_box(f'Latch {x:+.2f}', (0.052, 0.018, 0.072), (x, latch_y, H_BODY + 0.01), 0.006, hardware_mat, 4)

    # Decal placeholder on the front face (the approved P mark replaces this)
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=0.078, depth=0.002,
                                        location=(0, -(D / 2) - 0.0008, H_BODY * 0.47),
                                        rotation=(math.radians(90), 0, 0))
    decal = bpy.context.active_object
    decal.name = 'Decal Placeholder'
    bpy.ops.object.shade_smooth()
    decal.data.materials.append(decal_mat)

    # Shadow-catcher floor: only the shadow reaches the transparent render
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
    floor = bpy.context.active_object
    floor.name = 'Shadow Catcher'
    floor.is_shadow_catcher = True

    # Target, camera, lights
    target = bpy.data.objects.new('Target', None)
    target.location = (0, 0, (H_BODY + LID_H) * 0.52)
    bpy.context.collection.objects.link(target)

    cam_data = bpy.data.cameras.new('Camera')
    cam_data.lens = 70
    cam = bpy.data.objects.new('Camera', cam_data)
    dist, elev, az = 1.85, math.radians(21), math.radians(AZIMUTH)
    cam.location = target.location + Vector((
        -math.sin(az) * math.cos(elev) * dist,
        -math.cos(az) * math.cos(elev) * dist,
        math.sin(elev) * dist,
    ))
    bpy.context.collection.objects.link(cam)
    aim(cam, target)
    scene.camera = cam

    # Only the overhead softbox casts a shadow: a compact contact shadow that grounds the
    # cooler without spreading a gray field across the transparent floor.
    area_light('Key', (-1.1, -1.3, 2.1), 55, 1.6, target, shadow=False)
    area_light('Fill', (1.7, -0.9, 0.8), 14, 2.2, target, shadow=False)
    area_light('Rim', (0.7, 1.7, 1.5), 60, 1.2, target, size_y=0.4, shadow=False)
    area_light('Top', (0, 0, 1.6), 40, 1.1, target)

    # Soft white world for ambient light (invisible: film is transparent)
    world = bpy.data.worlds.new('White')
    try:
        world.use_nodes = True
    except AttributeError:
        pass
    bg = world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value = (1, 1, 1, 1)
    bg.inputs['Strength'].default_value = 0.12
    scene.world = world

    return scene


def configure_render(scene):
    r = scene.render
    r.engine = 'CYCLES'
    r.film_transparent = True
    r.resolution_x = r.resolution_y = 1200
    r.resolution_percentage = 50 if PREVIEW else 100
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGBA'
    r.image_settings.color_depth = '8'
    r.filepath = '//renders/' + OUT_NAME

    # No metadata: no file path, host name, date, or render stats in the PNG.
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

    c = scene.cycles
    c.samples = 64 if PREVIEW else 384
    c.use_denoising = True

    prefs = bpy.context.preferences.addons['cycles'].preferences
    for backend in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = backend
            prefs.get_devices()
            gpus = [d for d in prefs.devices if d.type == backend]
            if gpus:
                for d in prefs.devices:
                    d.use = d.type == backend
                c.device = 'GPU'
                print(f'Rendering on {backend}: {", ".join(d.name for d in gpus)}')
                return
        except TypeError:
            continue
    c.device = 'CPU'
    print('Rendering on CPU')


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    scene = build()
    configure_render(scene)
    # Write only the scene and what it uses. save_as_mainfile would also store UI state,
    # including the last directory the Save As operator saw (a local user path).
    bpy.data.libraries.write(os.path.join(HERE, 'cooler.blend'), {scene}, path_remap='RELATIVE_ALL', compress=False)
    scene.render.filepath = os.path.join(OUT_DIR, OUT_NAME)
    bpy.ops.render.render(write_still=True)
    scene.render.filepath = '//renders/' + OUT_NAME
    print(f'Wrote {os.path.join(OUT_DIR, OUT_NAME)}')


main()
