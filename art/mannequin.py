"""
THE DOJO'S MANNEQUIN (stage 2e, decision 0015): a character made and animated by this script, run by
Blender without a screen (`npm run art`), never by hand. It writes `packages/character/assets/mannequin.glb` (the games' character since stage 4a).

- Its shape: few polygons, the capsule's size (1.6 m, its origin at the capsule's center, looking
  at -Z, the engine's forward), and three colors: the body's, the joints', and the visor that shows
  where it looks (the capsule had one).
- Its skeleton: a hierarchy of bones; each piece of the body hangs from one (no skin weights: the
  pieces move rigidly, as a mannequin's do). And its sockets, where something is held or worn: one
  for each hand and one for the head (`hand_L_socket`, `hand_R_socket`, `head_socket`).
- Its animations, the ones the presentation mixes (packages/presentation/src/locomotion.ts:
  `CHARACTER_CLIPS`): quiet (`idle`); walking and running, each forward, back and to each side
  (`walk`, `walk_back`, `walk_left`, `walk_right`, and `run…`); stepping on the spot while it turns
  (`turn`); crouching, quiet and moving the four ways (`crouch_idle`, `crouch`, `crouch_back`,
  `crouch_left`, `crouch_right`: stage 4b); climbing up and to each side (`climb`, `climb_left`,
  `climb_right`); rising and falling
  (`rise`, `fall`); gliding (`glide`); and two gestures played once over the rest: a somersault for
  the jump in the air (`flip`) and the weight of a landing (`land`). Made of keyframes computed here
  (sines and angles; walking and running, from where each foot must be: see "walking and running"),
  with no root motion: the simulation moves the character, the animation moves its limbs, and only
  the hips go up and down.
- The cycles of one family (walking, running, crouching, climbing) have one length and one timing: the left
  leg is the one that steps in the first half of every cycle, the right one in the second. So the
  presentation can mix forward with a side, at 45°, and the feet do not fight.

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

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "packages/character/assets/mannequin.glb"
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


# The hips' height (m, from where they are built): the one place an animation moves a bone instead of
# turning it, and only up and down (a gait's bounce: the stance leg cannot reach the floor at a slant
# from hips that stay where they are). A pose says it with this key; without it, 0.
HIPS_HEIGHT = "hips_height"


def animate(name, seconds, keys):
    """An animation of about `seconds`, keyed on every frame: its length is a whole number of frames
    (a landing, 0.3 s, is 9 frames). Keys between two frames were moved to one by the exporter, and a
    cycle came out shorter and uneven; the presentation does not need the exact length, it plays a
    cycle by the distance travelled (locomotion.ts)."""
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    arm_obj.animation_data_create()
    arm_obj.animation_data.action = action
    count = max(2, round(seconds * FPS))
    for f in range(count + 1):
        t = f / count
        for pb in pose.bones:
            pb.rotation_euler = Euler((0, 0, 0))
            pb.location = Vector((0, 0, 0))
        for bone, value in keys(t).items():
            if bone == HIPS_HEIGHT:
                # (The hips point up: their own Y is the world's up.)
                pose.bones["hips"].location = Vector((0, value, 0))
                continue
            rx, ry, rz = value
            pose.bones[bone].rotation_euler = Euler((math.radians(rx), math.radians(ry), math.radians(rz)))
        for pb in pose.bones:
            pb.keyframe_insert("rotation_euler", frame=1 + f)
        pose.bones["hips"].keyframe_insert("location", frame=1 + f)
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

# ---------------------------------------------------------------- walking and running
#
# THE FEET STAY WHERE THEY STAND (after the tutorial's pass). The presentation plays a cycle by the
# distance the character really travels (locomotion.ts: one cycle per stride), so a foot on the ground stays put
# only if, while it is down, it moves back under the hips exactly as fast as the body goes forward:
# in a straight line, at a constant speed, on the floor. (The first cycles swung the thigh a quarter
# of a cycle off the knee: the foot down went back and came forward again, and slid the whole
# distance.) So the legs are not swung by angles: each foot follows a path, and the angles that put
# it there are solved (two bones of 0.36 m, the knee forward):
#
#   - each foot is down a quarter of the cycle (`STANCE`), the right one around 0.25 and the left one
#     around 0.75 (so the left one steps, in the air, in the first half: the families mix);
#   - down, it goes from `sweep / 2` ahead of where it stands to `sweep / 2` behind, in a straight
#     line at a constant speed: the stride (one cycle's distance) is `sweep / STANCE`;
#   - up, it comes back along a smooth curve, lifted, leaving and arriving at the ground's speed;
#   - between the two feet's quarters, both are up (a jog and a run have their moment in the air): the
#     hips rise a little then, and come down for the next foot.
#
# The hips go down while a foot is down (`low`): from hips where they are built, a leg straight down
# just reaches the floor, and a foot ahead or behind would not. Nothing else moves: the root never.

THIGH = 0.36
SHIN = 0.36
FLOOR = -0.8
HIP = {"L": (0.1, 0.0, -0.08), "R": (-0.1, 0.0, -0.08)}
STANCE = 0.25
DOWN_AT = {"R": 0.25, "L": 0.75}
# A foot leaves the ground and comes back to it at the ground's speed under the hips (in the world, at
# rest): it does not scuff as it lands, nor jerk as it leaves. (So it goes on back a little, lifting,
# before it swings forward: the heel's kick.)
CARRY = 1.0


def leg(dx, dy, dz):
    """The turns that put a foot (the bottom of its shin) at (dx, dy, dz) from its hip (Blender's axes:
    Y is back), the knee forward: the thigh's (around its X: positive is back; around its Z: positive
    is towards -X) and the knee's. Out of reach, the leg points there, straight."""
    d = min(math.sqrt(dx * dx + dy * dy + dz * dz), (THIGH + SHIN) * 0.999)
    cos_knee = (d * d - THIGH * THIGH - SHIN * SHIN) / (2 * THIGH * SHIN)
    knee = math.acos(max(-1.0, min(1.0, cos_knee)))
    # How far back of the line from the hip to the foot the bent knee leaves the foot.
    behind = math.atan2(SHIN * math.sin(knee), THIGH + SHIN * math.cos(knee))
    down = -dz
    back = math.atan2(dy, math.hypot(dx, down)) - behind
    out = math.atan2(-dx, down)
    return (math.degrees(back), 0.0, math.degrees(out)), (math.degrees(knee), 0.0, 0.0)


def hermite(p0, p1, m0, m1, u):
    return (
        (2 * u**3 - 3 * u**2 + 1) * p0
        + (u**3 - 2 * u**2 + u) * m0
        + (-2 * u**3 + 3 * u**2) * p1
        + (u**3 - u**2) * m1
    )


def foot(t, side, motion, sweep, stand, lift):
    """Where a foot is at `t` (Blender's axes, from the capsule's center), going along `motion` (a
    unit vector on the floor) with `sweep` meters on the ground, standing around `stand` (x, y)."""
    u = (t - DOWN_AT[side] + STANCE / 2) % 1.0
    if u < STANCE:
        # Down: from half the sweep ahead to half behind, straight, at a constant speed.
        k = 0.5 - u / STANCE
        z = FLOOR
    else:
        w = (u - STANCE) / (1 - STANCE)
        speed = -CARRY * (1 - STANCE) / STANCE
        k = hermite(-0.5, 0.5, speed, speed, w)
        z = FLOOR + lift * math.sin(math.pi * w)
    return (stand[0] + motion[0] * sweep * k, stand[1] + motion[1] * sweep * k, z)


def hips_height(t, low, bounce):
    """Down `low` while a foot is down; in the air between them, up by `bounce` and down again."""
    for side in ("L", "R"):
        if (t - DOWN_AT[side] + STANCE / 2) % 1.0 < STANCE:
            return -low
    f = ((t - DOWN_AT["R"] - STANCE / 2) % 0.5) / (0.5 - STANCE)
    return -low + bounce * math.sin(math.pi * f) ** 2


def gait(t, motion, sweep, apart, lift, low, bounce):
    """The legs and the hips of a cycle: each foot along its path, the angles solved for it; `apart`,
    how much wider than the hips the feet stand (sideways, they must not cross)."""
    height = hips_height(t, low, bounce)
    pose = {HIPS_HEIGHT: height}
    for side, x in (("L", 1), ("R", -1)):
        hx, hy, hz = HIP[side]
        fx, fy, fz = foot(t, side, motion, sweep, (hx + x * apart, hy), lift)
        pose[f"thigh_{side}"], pose[f"shin_{side}"] = leg(fx - hx, fy - hy, fz - (hz + height))
    return pose


def arms(t, swing, elbow, out=5):
    """Each arm forward as its leg goes back (the left one most forward when the left foot leaves the
    ground, at 0.875)."""
    a = swing * math.cos(2 * math.pi * (t - DOWN_AT["L"] - STANCE / 2))
    return {
        "upper_arm_L": swing_limb(a, out, "L"),
        "forearm_L": bend_elbow(elbow),
        "upper_arm_R": swing_limb(-a, out, "R"),
        "forearm_R": bend_elbow(elbow),
    }


# The directions of motion on the floor (Blender's axes: its front is -Y, its right -X).
AHEAD, BACK, RIGHT, LEFT = (0, -1), (0, 1), (-1, 0), (1, 0)
# The hips' twist with the arms: the shoulders turn with the arm that goes forward.
twist = lambda t, a: a * math.cos(2 * math.pi * (t - DOWN_AT["L"] - STANCE / 2))

# Walking (the engine's walk is a jog, 4.5 m/s): 0.66 m on the ground for each foot, 2.64 m a cycle
# (1.7 cycles a second at 4.5 m/s); back, 0.56 m; to a side, the feet wider and 0.34 m (stepping out
# with the leading foot, the other coming next to it, never across).
#
# One length for all four, and for running's: 32 frames. The presentation plays a cycle by the distance
# travelled, so the length only says how finely it is drawn: a foot's quarter on the ground is 8 frames,
# from a key to a key. (Drawn in 18, its time on the ground fell between keys, and between two keys the
# angles go straight while the foot's path does not: it sank 1.5 cm into the floor.)
CYCLE = 32 / FPS
WALK = CYCLE
WALK_LEGS = dict(low=0.1, bounce=0.04)
animate(
    "walk",
    WALK,
    lambda t: {
        "spine": lean(6, 0, twist(t, 4)),
        **gait(t, AHEAD, 0.66, 0.0, 0.12, **WALK_LEGS),
        **arms(t, 28, 40),
    },
)
animate(
    "walk_back",
    WALK,
    lambda t: {
        "spine": lean(-4, 0, twist(t, -3)),
        **gait(t, BACK, 0.56, 0.0, 0.1, **WALK_LEGS),
        **arms(t, -20, 35),
    },
)
animate("walk_right", WALK, lambda t: {"spine": lean(3, 4), **gait(t, RIGHT, 0.34, 0.12, 0.08, **WALK_LEGS), **arms(t, 6, 30, 12)})
animate("walk_left", WALK, lambda t: {"spine": lean(3, -4), **gait(t, LEFT, 0.34, 0.12, 0.08, **WALK_LEGS), **arms(t, 6, 30, 12)})

# Running (7.5 m/s): longer on the ground (0.76 m: 3.04 m a cycle, 2.5 a second), lower, the feet
# higher behind, leaning more.
RUN = CYCLE
RUN_LEGS = dict(low=0.12, bounce=0.06)
animate(
    "run",
    RUN,
    lambda t: {
        "spine": lean(14, 0, twist(t, 6)),
        "head": lean(-8),
        **gait(t, AHEAD, 0.76, 0.0, 0.22, **RUN_LEGS),
        **arms(t, 45, 75),
    },
)
animate(
    "run_back",
    RUN,
    lambda t: {
        "spine": lean(-2, 0, twist(t, -4)),
        **gait(t, BACK, 0.6, 0.0, 0.14, **RUN_LEGS),
        **arms(t, -30, 60),
    },
)
animate("run_right", RUN, lambda t: {"spine": lean(3, 7), **gait(t, RIGHT, 0.4, 0.14, 0.1, **RUN_LEGS), **arms(t, 8, 30, 18)})
animate("run_left", RUN, lambda t: {"spine": lean(3, -7), **gait(t, LEFT, 0.4, 0.14, 0.1, **RUN_LEGS), **arms(t, 8, 30, 18)})

# Crouching (stage 4b: the engine's crouch, 2 m/s, its body 1 m tall where standing it is 1.6): the hips
# 0.4 m down and the knees deep; the back bent 45° forward, so that the head stays under the crouched
# capsule's top (0.2 m above the standing one's center); the head raised to look ahead; the arms
# forward, a little apart. Its feet follow paths as walking's do, with a shorter sweep: 0.36 m for a
# foot on the ground, 1.44 m a cycle (1.4 cycles a second at 2 m/s); back, 0.3 m; to a side, 0.24 m,
# the feet wider. Quiet, the same body on its two feet.
CROUCH = CYCLE
CROUCH_LEGS = dict(low=0.3, bounce=0.0)
CROUCH_BACK = 55
CROUCH_HEAD = -45


def crouch_arms(t, swing, elbow=50, out=10):
    """The arms of a crouch: hanging from the bent back (so forward and down), swinging a little."""
    a = swing * math.cos(2 * math.pi * (t - DOWN_AT["L"] - STANCE / 2))
    return {
        "upper_arm_L": swing_limb(a, out, "L"),
        "forearm_L": bend_elbow(elbow),
        "upper_arm_R": swing_limb(-a, out, "R"),
        "forearm_R": bend_elbow(elbow),
    }


def crouched_still(t):
    """Quiet, low: the feet under the hips, a little apart and ahead (the weight forward with the back)."""
    height = -CROUCH_LEGS["low"]
    pose = {HIPS_HEIGHT: height}
    for side, x in (("L", 1), ("R", -1)):
        hx, hy, hz = HIP[side]
        pose[f"thigh_{side}"], pose[f"shin_{side}"] = leg(x * 0.06, -0.04, FLOOR - (hz + height))
    return pose


animate(
    "crouch_idle",
    2.0,
    lambda t: {
        "spine": lean(CROUCH_BACK + wave(t, 1.5)),
        "head": lean(CROUCH_HEAD + wave(t, -1.0, 0.1)),
        **crouched_still(t),
        **crouch_arms(t, 2),
    },
)
animate(
    "crouch",
    CROUCH,
    lambda t: {
        "spine": lean(CROUCH_BACK, 0, twist(t, 3)),
        "head": lean(CROUCH_HEAD),
        **gait(t, AHEAD, 0.36, 0.04, 0.08, **CROUCH_LEGS),
        **crouch_arms(t, 12),
    },
)
animate(
    "crouch_back",
    CROUCH,
    lambda t: {
        "spine": lean(CROUCH_BACK, 0, twist(t, -2)),
        "head": lean(CROUCH_HEAD),
        **gait(t, BACK, 0.3, 0.04, 0.07, **CROUCH_LEGS),
        **crouch_arms(t, -10),
    },
)
animate(
    "crouch_right",
    CROUCH,
    lambda t: {
        "spine": lean(CROUCH_BACK, 4),
        "head": lean(CROUCH_HEAD),
        **gait(t, RIGHT, 0.24, 0.14, 0.06, **CROUCH_LEGS),
        **crouch_arms(t, 4, out=14),
    },
)
animate(
    "crouch_left",
    CROUCH,
    lambda t: {
        "spine": lean(CROUCH_BACK, -4),
        "head": lean(CROUCH_HEAD),
        **gait(t, LEFT, 0.24, 0.14, 0.06, **CROUCH_LEGS),
        **crouch_arms(t, 4, out=14),
    },
)

# Turning on the spot: small steps, one foot then the other, the arms quiet.
animate(
    "turn",
    0.5,
    lambda t: {
        "thigh_L": swing_limb(once(t, 16, 0.0), 4, "L"),
        "shin_L": bend_knee(once(t, 32, 0.0)),
        "thigh_R": swing_limb(once(t, 16, 0.5), 4, "R"),
        "shin_R": bend_knee(once(t, 32, 0.5)),
        "upper_arm_L": swing_limb(0, 8, "L"),
        "upper_arm_R": swing_limb(0, 8, "R"),
        "forearm_L": bend_elbow(12),
        "forearm_R": bend_elbow(12),
    },
)

# Rising: knees up, arms out and a little up, a slow sway.
animate(
    "rise",
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

# Falling: the legs reach down for the ground, the arms up and out to keep the balance, looking down.
animate(
    "fall",
    1.0,
    lambda t: {
        "spine": lean(-3),
        "head": lean(10),
        "thigh_L": swing_limb(14 + wave(t, 3)),
        "shin_L": bend_knee(18),
        "thigh_R": swing_limb(4 + wave(t, -3)),
        "shin_R": bend_knee(10),
        "upper_arm_L": swing_limb(25, 70 + wave(t, 4), "L"),
        "forearm_L": bend_elbow(15),
        "upper_arm_R": swing_limb(25, 70 + wave(t, -4), "R"),
        "forearm_R": bend_elbow(15),
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


def climbing(t, to=None):
    """Facing the wall, arms reaching up in turns, knees too (the left hand and the left foot in the
    first half). To a side (`to`: "R" or "L"), the reach is shorter up and goes out to that side: the
    hand and the foot on that side reach out, the others follow. (An arm raised past the horizontal
    turns "out" the other way: the turn away from the body is applied last, around the axis from front
    to back, and an arm pointing up goes towards the head with it. So the hands reach with a minus.)"""
    up = 1.0 if to is None else 0.5
    reach_R = 0 if to is None else (45 * once(t, 1, 0.5) if to == "R" else 10 * once(t, 1, 0.5))
    reach_L = 0 if to is None else (45 * once(t, 1, 0.0) if to == "L" else 10 * once(t, 1, 0.0))
    lean_to = 0 if to is None else (6 if to == "R" else -6)
    return {
        "spine": lean(0, lean_to),
        "upper_arm_L": swing_limb(150 + wave(t, 25 * up), 8 - reach_L, "L"),
        "forearm_L": bend_elbow(25 + once(t, 45 * up, 0.5)),
        "upper_arm_R": swing_limb(150 + wave(t, -25 * up), 8 - reach_R, "R"),
        "forearm_R": bend_elbow(25 + once(t, 45 * up, 0.0)),
        "thigh_L": swing_limb(45 + wave(t, -25 * up), 4 + reach_L * 0.6, "L"),
        "shin_L": bend_knee(70 + once(t, 30, 0.0)),
        "thigh_R": swing_limb(45 + wave(t, 25 * up), 4 + reach_R * 0.6, "R"),
        "shin_R": bend_knee(70 + once(t, 30, 0.5)),
    }


# Climbing, up and to each side. One length for all three: 0.8 s.
CLIMB = 0.8
animate("climb", CLIMB, lambda t: climbing(t))
animate("climb_right", CLIMB, lambda t: climbing(t, "R"))
animate("climb_left", CLIMB, lambda t: climbing(t, "L"))


def tucked(t):
    """How tucked a somersault is: nothing at its ends, all of it in the middle."""
    return math.sin(math.pi * t) ** 0.5


# The jump in the air: a somersault forward around the hips, tucked (played once, over the rest).
animate(
    "flip",
    0.45,
    lambda t: {
        "hips": lean(360 * (t * t * (3 - 2 * t))),
        "spine": lean(20 * tucked(t)),
        "head": lean(25 * tucked(t)),
        "thigh_L": swing_limb(100 * tucked(t)),
        "shin_L": bend_knee(120 * tucked(t)),
        "thigh_R": swing_limb(100 * tucked(t)),
        "shin_R": bend_knee(120 * tucked(t)),
        "upper_arm_L": swing_limb(60 * tucked(t), 10, "L"),
        "forearm_L": bend_elbow(90 * tucked(t)),
        "upper_arm_R": swing_limb(60 * tucked(t), 10, "R"),
        "forearm_R": bend_elbow(90 * tucked(t)),
    },
)


def impact(t):
    """A landing's crouch: all at once (at a third of it), then slowly up."""
    return t / 0.3 if t < 0.3 else (1 - t) / 0.7


# A landing's weight: the knees give, the body leans, the arms come forward (played once, over the rest).
animate(
    "land",
    0.3,
    lambda t: {
        "spine": lean(18 * impact(t)),
        "head": lean(-10 * impact(t)),
        "thigh_L": swing_limb(40 * impact(t)),
        "shin_L": bend_knee(75 * impact(t)),
        "thigh_R": swing_limb(40 * impact(t)),
        "shin_R": bend_knee(75 * impact(t)),
        "upper_arm_L": swing_limb(25 * impact(t), 15, "L"),
        "forearm_L": bend_elbow(35 * impact(t)),
        "upper_arm_R": swing_limb(25 * impact(t), 15, "R"),
        "forearm_R": bend_elbow(35 * impact(t)),
    },
)

# ---------------------------------------------------------------- a look at it (optional)
#
# With `--preview <folder>`: contact sheets of the animations, to check them by running something, as
# everything else. Each row is an animation (in the order they were made), at four points of its cycle,
# seen from the front and from its side: `sheet-1.png`, `sheet-2.png`… six rows each.

if "--preview" in sys.argv:
    import numpy as np

    folder = sys.argv[sys.argv.index("--preview") + 1]
    os.makedirs(folder, exist_ok=True)
    cam = bpy.data.objects.new("camera", bpy.data.cameras.new("camera"))
    scene.collection.objects.link(cam)
    cam.data.lens = 50
    scene.camera = cam
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.rotation_euler = Euler((math.radians(50), 0, math.radians(30)))
    scene.collection.objects.link(sun)
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    W, H = 180, 240
    scene.render.resolution_x, scene.render.resolution_y = W, H
    views = {"front": ((2.2, -3.4, 0.6), (86, 0, 33)), "side": ((4.0, 0, 0.4), (88, 0, 90))}
    phases = (0.0, 0.25, 0.5, 0.75)
    tracks = list(arm_obj.animation_data.nla_tracks)
    tile = os.path.join(folder, "tile.png")
    rows = []
    for track in tracks:
        action = track.strips[0].action
        arm_obj.animation_data.action = action
        start, end = action.frame_range
        row = []
        for view, (location, rotation) in views.items():
            cam.location = location
            cam.rotation_euler = Euler([math.radians(a) for a in rotation])
            for p in phases:
                scene.frame_set(int(round(start + (end - start) * p)))
                scene.render.filepath = tile
                bpy.ops.render.render(write_still=True)
                image = bpy.data.images.load(tile)
                pixels = np.empty(W * H * 4, dtype=np.float32)
                image.pixels.foreach_get(pixels)
                bpy.data.images.remove(image)
                row.append(pixels.reshape(H, W, 4))
        rows.append(np.concatenate(row, axis=1))
    arm_obj.animation_data.action = None
    os.remove(tile)
    for n in range(0, len(rows), 6):
        group = rows[n : n + 6]
        # (Blender's pixels go from the bottom row up: the first animation, on top.)
        sheet = np.concatenate(list(reversed(group)), axis=0)
        image = bpy.data.images.new(f"sheet-{n // 6 + 1}", sheet.shape[1], sheet.shape[0], alpha=True)
        image.pixels.foreach_set(sheet.ravel())
        image.filepath_raw = os.path.join(folder, f"sheet-{n // 6 + 1}.png")
        image.file_format = "PNG"
        image.save()
    print("PREVIEW:", ", ".join(t.name for t in tracks))

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
    # Every animation from 0 s: its keys are made from frame 1, and written as they are a cycle held
    # its first pose for a frame at each end (walking, 0.633 s instead of 0.6: two frames still in each step).
    export_anim_slide_to_zero=True,
    export_optimize_animation_size=True,
    export_optimize_animation_keep_anim_armature=True,
)
print(f"MANNEQUIN written: {OUT}")
