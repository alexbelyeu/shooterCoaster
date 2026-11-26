"""The Blender crow (#1040, a spike of #381 step 4): an organic raven built, rigged, animated and AO-baked in Blender.

    python3.13 -m venv .venv-bpy && .venv-bpy/bin/pip install bpy==5.3.0   # once (bpy wheels are cp313)
    .venv-bpy/bin/python tools/art/crow.py                                  # -> src/entities/enemies/models/crow.glb

The body and head are metaballs melted into one surface, with a hooked cone beak; the wings and the tail fan are the
hand-coded crow's outlines (`SharedEnemyAssets.ts`) as solidified plates, each wing's arm and hand one plate. Model space is the game's:
+z forward (beak), +y up, the right wing on +x, the same size as `CROW_GEO`. Colours are the crow's palette
(docs/art/ENEMIES.md) times ambient occlusion, cast from every vertex with a fixed set of rays (no render engine, so
the bake is the same every run) into one vertex colour. Six bones (body, head, tail, arm and hand each side) carry one
looping clip, `flap`: one wingbeat over 24 frames, the hand-coded crow's `birdWingPose` sampled per frame, so the two
crows flap alike. The GLB's normals, colours and weights are then quantised (KHR_mesh_quantization, no decoder
needed) by gltf-transform.
"""

import math
import os
import subprocess
import sys

import bpy  # first: it puts bmesh and mathutils on the path
import bmesh
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'src', 'entities', 'enemies', 'models', 'crow.glb')
RAW = OUT.replace('.glb', '.raw.glb')
GLTF_TRANSFORM = '@gltf-transform/cli@4.2.1'

FRAMES = 24


def g(x, y, z):
    """Game coordinates (+y up, +z forward) to Blender's (+z up, -y forward); the glTF exporter maps them back."""
    return Vector((x, -z, y))


def srgb(hex_colour):
    """A #rrggbb colour in linear RGB, as THREE.Color reads it."""
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return Vector([lin(int(hex_colour[i:i + 2], 16)) for i in (1, 3, 5)])


BODY = srgb('#15131a')
SHEEN = srgb('#3a2a55')
TIP = srgb('#0b0a0f')
BEAK = srgb('#e8862a')
IRIS = srgb('#ffd166') * 1.6
PUPIL = srgb('#050406')

SHOULDER = (1.3, 0.55, 0.7)
ELBOW_X = 5.0
SPAN = ELBOW_X + 6.7
# The hand-coded crow's outlines, [x, z] from the shoulder / wrist / rump (SharedEnemyAssets.ts CROW_ARM, CROW_HAND).
ARM = [(0, 1.5), (2.4, 1.75), (5, 1.35), (5, -1.6), (4.3, -2.3), (3.6, -1.95), (2.8, -2.45),
       (2, -2.05), (1.2, -2.45), (0.3, -2), (0, -1.4)]
HAND = [(-0.3, 1.35), (2.6, 1.2), (4.9, 0.6), (6.7, -0.1), (5.6, -0.45), (6.3, -1), (5.1, -1.05),
        (5.5, -1.75), (4.3, -1.6), (4.4, -2.3), (3.2, -1.9), (1.6, -1.9), (-0.3, -1.6)]


def tail_outline():
    pts = [(0.45, 0.3)]
    for k in range(9):
        i = 4 - k
        a = i * 0.1375
        r = 3.8 - abs(a) * 1.2 if i % 2 == 0 else 3.2 - abs(a)
        pts.append((math.sin(a) * r, -math.cos(a) * r))
    pts.append((-0.45, 0.3))
    return pts


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def link(name, mesh):
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def bake_modifiers(obj):
    """Applies every modifier: the object's mesh becomes its evaluated one."""
    deps = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(deps))
    obj.modifiers.clear()
    old = obj.data
    obj.data = mesh
    bpy.data.meshes.remove(old)
    return obj


def metaball_body():
    """Rump, belly, chest, neck and head as metaballs melted into one surface, and a hooked beak on the front."""
    ball = bpy.data.metaballs.new('body')
    ball.resolution = ball.render_resolution = 0.34
    ball.threshold = 0.3
    obj = link('body', ball)
    # (game position, radius, (half-size across, along, up) of an ellipsoid)
    for p, r, size in [
        ((0, 0.2, -2.3), 1.6, (0.7, 1.4, 0.55)),
        ((0, 0.0, -0.2), 2.6, (0.95, 1.4, 0.85)),
        ((0, 0.15, 1.7), 2.5, (0.95, 0.9, 0.9)),
        ((0, 0.4, 3.2), 1.5, (0.9, 1.0, 0.95)),
        ((0, 0.55, 4.5), 1.9, (0.9, 1.0, 0.85)),
    ]:
        e = ball.elements.new(type='ELLIPSOID')
        e.co, e.radius = g(*p), r
        e.size_x, e.size_y, e.size_z = size
    deps = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(deps))
    bpy.data.objects.remove(obj)
    body = link('body', mesh)

    # The beak: an eight-sided cone from inside the head to a tip hooked down, its base sunk into the face.
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.62, radius2=0.04, depth=2.6)
    for v in bm.verts:
        x, y, z = v.co  # the cone runs along Blender z: its length becomes the game's forward
        t = (z + 1.3) / 2.6
        v.co = g(x, y * 0.8 + 0.35 - 0.35 * t * t, 5.6 + t * 2.6)
    beak = bpy.data.meshes.new('beak')
    bm.to_mesh(beak)
    bm.free()
    body.data.materials.clear()
    joined = bmesh.new()
    joined.from_mesh(body.data)
    joined.from_mesh(beak)
    joined.to_mesh(body.data)
    joined.free()
    bpy.data.meshes.remove(beak)
    return body


def plate(name, outline, thick, origin):
    """A feather plate: `outline` ([x, z] about `origin`) filled, its inside cut into a grid (so it bends smoothly where
    two bones meet) and solidified `thick` deep; its edges stay crisp, its faces smooth."""
    bm = bmesh.new()
    ox, oy, oz = origin
    bm.faces.new([bm.verts.new(g(ox + x, oy, oz + z)) for x, z in outline])
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method='BEAUTY', ngon_method='BEAUTY')
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True)
    bmesh.ops.beautify_fill(bm, faces=bm.faces[:], edges=bm.edges[:])
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = link(name, mesh)
    solid = obj.modifiers.new('solid', 'SOLIDIFY')
    solid.thickness = thick
    solid.offset = 0
    obj = bake_modifiers(obj)
    obj.data.set_sharp_from_angle(angle=math.radians(40))
    return obj


def wing(side):
    """The arm and the hand as one plate, so the wrist bends without a gap."""
    sx, sy, sz = SHOULDER
    hand = [(ELBOW_X + x, z) for x, z in HAND]
    arm_front = [p for p in ARM if p[1] > 0]
    arm_back = [p for p in ARM if p[1] <= 0 and p[0] < ELBOW_X]
    outline = arm_front + hand[:1] + hand[1:-1] + hand[-1:] + arm_back
    return plate(f'wing{side}', [(side * x, z) for x, z in outline], 0.28, (side * sx, sy, sz))


def eyes():
    bm = bmesh.new()
    for side in (1, -1):
        centre = g(side * 1.05, 0.55, 4.6)
        iris = bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=0.36)
        for v in iris['verts']:
            v.co += centre
        out = Vector((side * 0.8, 0.15, 0.55)).normalized()
        pupil = bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=5, radius=0.2)
        for v in pupil['verts']:
            v.co += centre + g(*(out * 0.24))
        glint = bmesh.ops.create_uvsphere(bm, u_segments=6, v_segments=3, radius=0.09)
        for v in glint['verts']:
            v.co += centre + g(*(Vector((side * 0.6, 0.6, 0.55)).normalized() * 0.36))
    mesh = bpy.data.meshes.new('eyes')
    bm.to_mesh(mesh)
    bm.free()
    obj = link('eyes', mesh)
    colour = mesh.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    for v in mesh.vertices:
        p = v.co
        # The pupil and glint sit outside the iris sphere: farther from the eye's centre than its radius.
        side = 1 if p.x > 0 else -1
        d = (p - g(side * 1.05, 0.55, 4.6)).length
        c = Vector((3, 3, 3)) if d > 0.5 else PUPIL if d > 0.37 else IRIS
        colour.data[v.index].color = (*c, 1)
    return obj


def game(v):
    """Blender coordinates back to the game's."""
    return Vector((v.x, v.z, -v.y))


def base_colour(p, part):
    if part == 'body':
        beak = max(0.0, min(1.0, (p.z - 5.95) / 0.35))
        return BODY.lerp(BEAK, beak)
    if part == 'tail':
        return SHEEN.lerp(TIP, max(0.0, min(1.0, 0.25 + (-2.4 - p.z) / 5)) ** 1.3)
    t = (abs(p.x) - SHOULDER[0]) / SPAN
    return SHEEN.lerp(TIP, max(0.0, min(1.0, t)) ** 1.3)


def hemisphere(n):
    """`n` fixed directions over the +z hemisphere, cosine-weighted (a Fibonacci spiral)."""
    dirs = []
    golden = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        r = math.sqrt((i + 0.5) / n)
        a = i * golden
        dirs.append(Vector((r * math.cos(a), r * math.sin(a), math.sqrt(max(0.0, 1 - r * r)))))
    return dirs


def bake_ao(parts, samples=48, reach=4.0):
    """Paints every part's vertex colour: its base colour times the share of `samples` rays that escape within `reach`."""
    deps = bpy.context.evaluated_depsgraph_get()
    trees = [BVHTree.FromObject(o, deps) for o, _ in parts]
    rays = hemisphere(samples)
    for obj, part in parts:
        mesh = obj.data
        colour = mesh.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        for v in mesh.vertices:
            n = v.normal
            frame = n.to_track_quat('Z', 'Y').to_matrix()
            origin = v.co + n * 0.02
            open_ = 0
            for d in rays:
                ray = frame @ d
                if all(t.ray_cast(origin, ray, reach)[0] is None for t in trees):
                    open_ += 1
            ao = 0.35 + 0.65 * open_ / samples
            c = base_colour(game(v.co), part) * ao
            colour.data[v.index].color = (*c, 1)


BONES = {
    # name: (head, tail, parent), game coordinates
    'body': ((0, 0, -1.2), (0, 0, 1.6), None),
    'head': ((0, 0.35, 3.0), (0, 0.5, 5.6), 'body'),
    'tail': ((0, 0.15, -2.4), (0, 0.2, -5.8), 'body'),
    'arm.R': (SHOULDER, (SHOULDER[0] + ELBOW_X, SHOULDER[1], SHOULDER[2]), 'body'),
    'hand.R': ((SHOULDER[0] + ELBOW_X, SHOULDER[1], SHOULDER[2]), (SHOULDER[0] + SPAN, SHOULDER[1], SHOULDER[2]), 'arm.R'),
    'arm.L': ((-SHOULDER[0], SHOULDER[1], SHOULDER[2]), (-SHOULDER[0] - ELBOW_X, SHOULDER[1], SHOULDER[2]), 'body'),
    'hand.L': ((-SHOULDER[0] - ELBOW_X, SHOULDER[1], SHOULDER[2]), (-SHOULDER[0] - SPAN, SHOULDER[1], SHOULDER[2]), 'arm.L'),
}


def armature():
    arm = bpy.data.armatures.new('rig')
    obj = link('crow', arm)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    for name, (head, tail, parent) in BONES.items():
        b = arm.edit_bones.new(name)
        b.head, b.tail = g(*head), g(*tail)
        b.roll = 0
        if parent:
            b.parent = arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    return obj


def smooth(edge, width, x):
    """0 below `edge - width`, 1 above `edge + width`, smoothstep between."""
    t = max(0.0, min(1.0, (x - edge + width) / (2 * width)))
    return t * t * (3 - 2 * t)


def weights(p, part):
    """Bone weights of a vertex at game position `p` of `part`."""
    if part == 'wing':
        side = 'R' if p.x > 0 else 'L'
        x = abs(p.x)
        hand = smooth(SHOULDER[0] + ELBOW_X, 0.5, x)
        arm = smooth(SHOULDER[0] + 0.3, 0.6, x) * (1 - hand)
        return {'body': 1 - arm - hand, f'arm.{side}': arm, f'hand.{side}': hand}
    if part == 'eyes':
        return {'head': 1}
    if part == 'tail':
        return {'tail': smooth(-2.6, 0.4, -p.z), 'body': 1 - smooth(-2.6, 0.4, -p.z)}
    head = smooth(3.0, 0.7, p.z)
    tail = smooth(2.4, 0.4, -p.z)
    return {'head': head, 'tail': tail, 'body': 1 - head - tail}


def skin(rig, obj, part_of):
    for name in BONES:
        obj.vertex_groups.new(name=name)
    for v in obj.data.vertices:
        for name, w in weights(game(v.co), part_of(v)).items():
            if w > 1e-4:
                obj.vertex_groups[name].add([v.index], w, 'REPLACE')
    obj.parent = rig
    obj.modifiers.new('rig', 'ARMATURE').object = rig


def wing_pose(phase):
    """SharedEnemyAssets.ts `birdWingPose`: (arm, hand) radians, + = down."""
    p = phase + 0.5 * math.sin(phase)
    return 0.05 + 0.6 * math.sin(p), 0.5 * math.sin(p - 0.9)


def animate(rig):
    """One wingbeat, `flap`: the arm about the shoulder and the hand about the wrist, both about the body's long axis."""
    action = bpy.data.actions.new('flap')
    rig.animation_data_create().action = action
    scene = bpy.context.scene
    scene.render.fps = FRAMES
    scene.frame_start, scene.frame_end = 0, FRAMES
    forward = g(0, 0, 1)
    for frame in range(FRAMES + 1):
        arm, hand = wing_pose(2 * math.pi * frame / FRAMES)
        for side, s in (('R', 1), ('L', -1)):
            for name, angle in ((f'arm.{side}', arm), (f'hand.{side}', hand)):
                bone = rig.pose.bones[name]
                rest = bone.bone.matrix_local.to_quaternion()
                # Down for the right wing is a turn about -forward, for the left about +forward.
                q = rest.inverted() @ Quaternion(forward, -s * angle) @ rest
                bone.rotation_mode = 'QUATERNION'
                bone.rotation_quaternion = q
                bone.keyframe_insert('rotation_quaternion', frame=frame)
    for fc in action.layers[0].strips[0].channelbag(action.slots[0]).fcurves if action.layers else action.fcurves:
        for k in fc.keyframe_points:
            k.interpolation = 'LINEAR'


def main():
    reset()
    body = metaball_body()
    tail = plate('tail', tail_outline(), 0.18, (0, 0.15, -2.4))
    wings = [wing(1), wing(-1)]
    eye = eyes()
    parts = [(body, 'body'), (tail, 'tail')] + [(w, 'wing') for w in wings]
    bake_ao(parts)

    # One feather mesh: the parts joined, each vertex remembering its part for the weights.
    part_names = []
    for obj, part in parts:
        part_names += [part] * len(obj.data.vertices)
    bpy.ops.object.select_all(action='DESELECT')
    for obj, _ in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    feathers = body
    feathers.name = feathers.data.name = 'feathers'
    for obj, name in ((feathers, 'feathers'), (eye, 'eyes')):
        obj.data.materials.append(bpy.data.materials.new(name))
        obj.data.shade_smooth()
        # Triangulated and sorted by position here: the metaballs' faces come out in a different order run to run.
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method='FIXED', ngon_method='BEAUTY')
        bm.faces.sort(key=lambda f: tuple(round(c, 4) for c in f.calc_center_median()))
        bm.to_mesh(obj.data)
        bm.free()

    rig = armature()
    skin(rig, feathers, lambda v: part_names[v.index])
    skin(rig, eye, lambda v: 'eyes')
    animate(rig)

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=RAW, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
        export_skins=True, export_animations=True, export_vertex_color='ACTIVE', export_all_vertex_colors=False,
        export_texcoords=False, export_tangents=False, export_materials='EXPORT', export_extras=False,
        export_force_sampling=True, export_frame_range=True, export_anim_single_armature=True,
        export_optimize_animation_size=True, export_optimize_animation_keep_anim_armature=False,
    )
    # Positions stay float: quantised, a skinned mesh's geometry is in the grid's space (its scale moves into the
    # inverse bind matrices), and its bounds, raycasts and the e2e probe would all read that.
    subprocess.run(['npx', '--yes', GLTF_TRANSFORM, 'quantize', RAW, OUT, '--pattern', '{NORMAL,COLOR_0,JOINTS_0,WEIGHTS_0}',
                    '--quantize-normal', '8'], check=True, cwd=ROOT)
    os.remove(RAW)
    tris = sum(len(p.vertices) - 2 for o in (feathers, eye) for p in o.data.polygons)
    print(f'crow.glb: {os.path.getsize(OUT)} bytes, {tris} triangles', file=sys.stderr)


if __name__ == '__main__':
    main()
