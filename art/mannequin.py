"""
THE DOJO'S MANNEQUIN (stage 2e, decision 0015): a character made and animated by this script, run by
Blender without a screen (`npm run art`), never by hand. It writes `games/dojo/assets/mannequin.glb`.

- Its shape: few polygons, the capsule's size (1.6 m, its origin at the capsule's center, looking
  at -Z, the engine's forward), and three colors: the body's, the joints', and the visor that shows
  where it looks (the capsule had one).
- Its skeleton: a hierarchy of bones; each piece of the body hangs from one (no skin weights: the
  pieces move rigidly, as a mannequin's do). And its sockets, where something is held or worn: one
  for each hand and one for the head (`hand_L_socket`, `hand_R_socket`, `head_socket`).
- Its animations: one per way of moving the presentation draws, named after it: `idle`, `walk`,
  `run`, `air`, `glide`, `climb`. Made of keyframes computed here (sines and angles), each one a loop
  of whole seconds' fractions, with no root motion: the simulation moves the character, the
  animation only moves its limbs.

It is built in Blender's frame (Z up, its front towards -Y). The glTF exporter turns Blender's -Y into
+Z, glTF's front; but the engine's front is -Z (where a character looks, and the capsule's visor). So
the skeleton's root is turned half a turn before it is written: in the engine, the mannequin looks
where the character looks. (The first version did not, and walked backwards: the author saw it.)
"""

import math
import os
import sys

import bpy
from mathutils import Euler, Vector

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "games/dojo/assets/mannequin.glb"
FPS = 30

# ---------------------------------------------------------------- the scene, empty

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS


def material(name, rgb):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    bsdf.inputs["Roughness"].default_value = 0.85
    return m


def srgb(hex_color):
    """A color as Blender wants it (linear), from the sRGB hex the site uses."""
    c = [int(hex_color[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


BODY = material("body", srgb("93d9c9"))
JOINT = material("joint", srgb("4f7f76"))
VISOR = material("visor", srgb("1a1714"))

# ---------------------------------------------------------------- the skeleton
#
# Heights from the capsule's center (Blender's Z): the feet at -0.8, the head's top at +0.8.

arm_obj = bpy.data.objects.new("mannequin", bpy.data.armatures.new("mannequin"))
scene.collection.objects.link(arm_obj)
bpy.context.view_layer.objects.active = arm_obj
bpy.ops.object.mode_set(mode="EDIT")
edit = arm_obj.data.edit_bones

BONES = {
    # name: (head, tail, parent)
    "hips": ((0, 0, -0.06), (0, 0, 0.06), None),
    "spine": ((0, 0, 0.06), (0, 0, 0.42), "hips"),
    "head": ((0, 0, 0.47), (0, 0, 0.8), "spine"),
    "upper_arm_L": ((0.21, 0, 0.40), (0.21, 0, 0.12), "spine"),
    "forearm_L": ((0.21, 0, 0.12), (0.21, 0, -0.14), "upper_arm_L"),
    "upper_arm_R": ((-0.21, 0, 0.40), (-0.21, 0, 0.12), "spine"),
    "forearm_R": ((-0.21, 0, 0.12), (-0.21, 0, -0.14), "upper_arm_R"),
    "thigh_L": ((0.1, 0, -0.08), (0.1, 0, -0.44), "hips"),
    "shin_L": ((0.1, 0, -0.44), (0.1, 0, -0.8), "thigh_L"),
    "thigh_R": ((-0.1, 0, -0.08), (-0.1, 0, -0.44), "hips"),
    "shin_R": ((-0.1, 0, -0.44), (-0.1, 0, -0.8), "thigh_R"),
}
for name, (head, tail, parent) in BONES.items():
    b = edit.new(name)
    b.head, b.tail = Vector(head), Vector(tail)
    # Every bone with the same roll, its local X along the world's X: so a rotation around X swings
    # a limb forward and back for every bone alike.
    b.roll = 0
    if parent:
        b.parent = edit[parent]
        b.use_connect = False
bpy.ops.object.mode_set(mode="OBJECT")

# ---------------------------------------------------------------- the pieces of the body


def piece(name, bone, size, center, mat, bevel=0.025):
    """A box of `size` at `center` (in the capsule's frame), its edges rounded, hanging from `bone`."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.active_object
    # Its own name, never its bone's: three.js finds what an animation moves by name.
    obj.name = f"{name}_piece"
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    mod = obj.modifiers.new("bevel", "BEVEL")
    mod.width = bevel
    mod.segments = 2
    bpy.ops.object.modifier_apply(modifier="bevel")
    obj.data.materials.append(mat)
    # Hang it from its bone, keeping where it is.
    world = obj.matrix_world.copy()
    obj.parent = arm_obj
    obj.parent_type = "BONE"
    obj.parent_bone = bone
    obj.matrix_world = world
    return obj


piece("pelvis", "hips", (0.3, 0.18, 0.16), (0, 0, -0.04), JOINT)
piece("torso", "spine", (0.36, 0.2, 0.36), (0, 0, 0.24), BODY)
piece("neck", "head", (0.1, 0.1, 0.08), (0, 0, 0.46), JOINT, bevel=0.015)
piece("head", "head", (0.24, 0.24, 0.26), (0, 0, 0.62), BODY, bevel=0.05)
# The visor: a dark band on the head's face, towards -Y (Blender's forward: the engine's -Z).
piece("visor", "head", (0.2, 0.04, 0.07), (0, -0.115, 0.65), VISOR, bevel=0.01)
for side, x in (("L", 1), ("R", -1)):
    piece(f"upper_arm_{side}", f"upper_arm_{side}", (0.09, 0.09, 0.27), (0.21 * x, 0, 0.26), BODY)
    piece(f"forearm_{side}", f"forearm_{side}", (0.08, 0.08, 0.25), (0.21 * x, 0, -0.01), JOINT)
    piece(f"thigh_{side}", f"thigh_{side}", (0.12, 0.12, 0.35), (0.1 * x, 0, -0.26), BODY)
    piece(f"shin_{side}", f"shin_{side}", (0.1, 0.1, 0.33), (0.1 * x, 0, -0.6), JOINT)
    piece(f"foot_{side}", f"shin_{side}", (0.11, 0.18, 0.05), (0.1 * x, -0.03, -0.775), JOINT, bevel=0.015)

# ---------------------------------------------------------------- the sockets
#
# Where something is held or worn (decision 0015: every character has them, also one from a pack):
# empty points hanging from a bone, which follow it as it moves, found by their name. Each one is
# turned like the model (its front, the model's front), so what hangs there looks forward when the
# arms hang. A hand's, at the end of its forearm; the head's, where it looks from (the visor: for a
# first person view, phase 4, or something worn on the head).


def socket(name, bone, where):
    obj = bpy.data.objects.new(f"{name}_socket", None)
    scene.collection.objects.link(obj)
    obj.location = where
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = arm_obj
    obj.parent_type = "BONE"
    obj.parent_bone = bone
    obj.matrix_world = world


socket("hand_L", "forearm_L", (0.21, 0, -0.16))
socket("hand_R", "forearm_R", (-0.21, 0, -0.16))
socket("head", "head", (0, -0.135, 0.65))

# ---------------------------------------------------------------- the animations
#
# Which way a rotation turns a bone depends on where the bone points (its own Y goes from its head
# to its tail): around its X, a bone that points up (the hips, the spine, the head) leans forward
# with a positive angle, and one that points down (an arm, a leg) swings backward. So the poses are
# written with what they mean, and these turn it into angles:

def lean(a, side=0.0, twist=0.0):
    """An upward bone (hips, spine, head): leaning forward `a` degrees; to its side; twisted."""
    return (a, twist, side)


def swing_limb(a, out=0.0, side="L"):
    """A downward bone (an upper arm, a thigh): forward `a` degrees; `out`, away from the body."""
    return (-a, 0.0, -out if side == "L" else out)


def bend_knee(a):
    """A shin: the knee bends, the foot goes back."""
    return (a, 0.0, 0.0)


def bend_elbow(a):
    """A forearm: the elbow bends, the hand comes forward."""
    return (-a, 0.0, 0.0)


# A pose is, for some bones, a rotation (degrees, around the bone's own X, Y, Z). Each animation is a
# loop: `keys(t)` gives the pose at t from 0 to 1, sampled on its frames, the last equal to the first.

pose = arm_obj.pose
for pb in pose.bones:
    pb.rotation_mode = "XYZ"


def animate(name, seconds, keys, frames=None):
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    arm_obj.animation_data_create()
    arm_obj.animation_data.action = action
    count = frames or max(2, round(seconds * FPS))
    for f in range(count + 1):
        t = f / count
        for pb in pose.bones:
            pb.rotation_euler = Euler((0, 0, 0))
        for bone, (rx, ry, rz) in keys(t).items():
            pose.bones[bone].rotation_euler = Euler((math.radians(rx), math.radians(ry), math.radians(rz)))
        for pb in pose.bones:
            pb.keyframe_insert("rotation_euler", frame=1 + f * (seconds * FPS / count))
    # Pushed to its own track, so the exporter takes each animation by its name.
    track = arm_obj.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 1, action)
    arm_obj.animation_data.action = None


def wave(t, amplitude, phase=0.0):
    return amplitude * math.sin(2 * math.pi * (t + phase))


def once(t, amplitude, phase=0.0):
    """Only one way (a knee, an elbow): the positive half of a wave."""
    return amplitude * max(0.0, math.sin(2 * math.pi * (t + phase)))


def legs_and_arms(t, stride, knee, arm, elbow):
    """A walking cycle: each leg forward when its arm goes back; the knee bends while the leg comes forward."""
    return {
        "thigh_L": swing_limb(wave(t, stride)),
        "shin_L": bend_knee(once(t, knee, 0.0)),
        "thigh_R": swing_limb(wave(t, -stride)),
        "shin_R": bend_knee(once(t, knee, 0.5)),
        "upper_arm_L": swing_limb(wave(t, -arm), 5, "L"),
        "forearm_L": bend_elbow(elbow),
        "upper_arm_R": swing_limb(wave(t, arm), 5, "R"),
        "forearm_R": bend_elbow(elbow),
    }


# Quiet: it breathes, its arms hang a little out.
animate(
    "idle",
    2.0,
    lambda t: {
        "spine": lean(wave(t, 1.5)),
        "head": lean(wave(t, -1.0, 0.1)),
        "upper_arm_L": swing_limb(wave(t, 2), 6, "L"),
        "upper_arm_R": swing_limb(wave(t, 2), 6, "R"),
        "forearm_L": bend_elbow(8),
        "forearm_R": bend_elbow(8),
    },
)

# Walking (the engine's walk is a jog, 4.5 m/s), leaning a little forward.
animate("walk", 0.6, lambda t: {"spine": lean(6, 0, wave(t, 4)), **legs_and_arms(t, 32, 55, 28, 40)})

# Running: the same, faster and wider, leaning more.
animate("run", 0.45, lambda t: {"spine": lean(14, 0, wave(t, 6)), "head": lean(-8), **legs_and_arms(t, 48, 90, 45, 75)})

# In the air: knees up, arms out and a little up, a slow sway.
animate(
    "air",
    1.0,
    lambda t: {
        "spine": lean(4),
        "thigh_L": swing_limb(40 + wave(t, 3)),
        "shin_L": bend_knee(75),
        "thigh_R": swing_limb(18 + wave(t, -3)),
        "shin_R": bend_knee(45),
        "upper_arm_L": swing_limb(10, 45, "L"),
        "forearm_L": bend_elbow(25),
        "upper_arm_R": swing_limb(10, 45, "R"),
        "forearm_R": bend_elbow(25),
    },
)

# Gliding: arms spread like wings, the body tilted forward, legs straight behind, looking ahead.
animate(
    "glide",
    1.2,
    lambda t: {
        "hips": lean(35),
        "spine": lean(5, wave(t, 3)),
        "head": lean(-30),
        "upper_arm_L": swing_limb(wave(t, 3), 85, "L"),
        "forearm_L": bend_elbow(5),
        "upper_arm_R": swing_limb(wave(t, -3), 85, "R"),
        "forearm_R": bend_elbow(5),
        "thigh_L": swing_limb(-8, 5, "L"),
        "thigh_R": swing_limb(-8, 5, "R"),
        "shin_L": bend_knee(12),
        "shin_R": bend_knee(12),
    },
)

# Climbing: facing the wall, arms reaching up in turns, knees too.
animate(
    "climb",
    0.8,
    lambda t: {
        "upper_arm_L": swing_limb(150 + wave(t, 25), 8, "L"),
        "forearm_L": bend_elbow(25 + once(t, 45, 0.5)),
        "upper_arm_R": swing_limb(150 + wave(t, -25), 8, "R"),
        "forearm_R": bend_elbow(25 + once(t, 45, 0.0)),
        "thigh_L": swing_limb(45 + wave(t, -25)),
        "shin_L": bend_knee(70 + once(t, 30, 0.0)),
        "thigh_R": swing_limb(45 + wave(t, 25)),
        "shin_R": bend_knee(70 + once(t, 30, 0.5)),
    },
)

# ---------------------------------------------------------------- a look at it (optional)
#
# With `--preview <folder>`: a picture of each animation, a quarter into it, seen from the front and
# a little from the side (to check the look by running something, as everything else).

if "--preview" in sys.argv:
    folder = sys.argv[sys.argv.index("--preview") + 1]
    os.makedirs(folder, exist_ok=True)
    cam = bpy.data.objects.new("camera", bpy.data.cameras.new("camera"))
    scene.collection.objects.link(cam)
    cam.location = (2.2, -3.4, 0.6)
    cam.rotation_euler = Euler((math.radians(86), 0, math.radians(33)))
    cam.data.lens = 50
    scene.camera = cam
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.rotation_euler = Euler((math.radians(50), 0, math.radians(30)))
    scene.collection.objects.link(sun)
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.render.resolution_x, scene.render.resolution_y = 360, 480
    views = {"front": ((2.2, -3.4, 0.6), (86, 0, 33)), "side": ((4.0, 0, 0.4), (88, 0, 90))}
    for track in arm_obj.animation_data.nla_tracks:
        arm_obj.animation_data.action = track.strips[0].action
        start, end = track.strips[0].action.frame_range
        scene.frame_set(int(start + (end - start) * 0.25))
        for view, (location, rotation) in views.items():
            cam.location = location
            cam.rotation_euler = Euler([math.radians(a) for a in rotation])
            scene.render.filepath = os.path.join(folder, f"{track.name}-{view}.png")
            bpy.ops.render.render(write_still=True)
    arm_obj.animation_data.action = None

# ---------------------------------------------------------------- written
#
# Half a turn around the vertical: Blender's front (-Y) becomes glTF's +Z when exported, and the
# engine's front is -Z.

arm_obj.rotation_euler = Euler((0, 0, math.pi))

os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    export_animations=True,
    export_animation_mode="NLA_TRACKS",
    export_yup=True,
    export_apply=True,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
    # No texture coordinates: colors, not textures (and Blender's bevel gives them other last bits
    # on every run, so the same script would not write the same file).
    export_texcoords=False,
    # Only what the script animates, the bones' turns (no translation or scale in any animation): not
    # every channel sampled. Every bone keeps its channel even where it does not change, because
    # constant is not resting (an elbow bent all through a walk).
    export_force_sampling=False,
    export_optimize_animation_size=True,
    export_optimize_animation_keep_anim_armature=True,
)
print(f"MANNEQUIN written: {OUT}")
