"""
THE DOJO'S LAMP (stage 3e, decision 0015): a lamp, whole and broken in one model, made by this script,
run by Blender without a screen (`npm run art`), never by hand. It writes `games/dojo/assets/lamp.glb`.

- Its size: a bulb 0.3 m across (the ball a level gives a lamp that breaks: radius 0.15), under a
  metal cap, in a cage of four bars. Its origin at the bulb's center, where the simulation puts the lamp.
- Two nodes: `whole` (the bulb) and `broken` (what is left of it: a few shards around the socket). The
  cap and the cage are in both. The presentation shows one or the other, as the lamp is (its
  `breakable.broken`); the bulb's material is `glass`, the one that glows while the lamp is on.

It is built in Blender's frame (Z up); the glTF exporter turns Blender's Z into glTF's Y.
"""

import math
import os
import sys

import bpy

# The Blender these bytes come from (stage 5.5d): another version may write other bytes for the same script,
# and `npm run art:check` compares them with the committed files. Bumped by hand, with every asset made again.
BLENDER = (4, 5)
if tuple(bpy.app.version[:2]) != BLENDER:
    sys.exit(f"{os.path.basename(__file__)}: made with Blender {BLENDER[0]}.{BLENDER[1]}, and this is {bpy.app.version_string}")

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "games/dojo/assets/lamp.glb"

bpy.ops.wm.read_factory_settings(use_empty=True)


def srgb(hex_color):
    c = [int(hex_color[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def material(name, hex_color, roughness, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*srgb(hex_color), alpha)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*srgb(hex_color), 1)
    bsdf.inputs["Roughness"].default_value = roughness
    return m


GLASS = material("glass", "ffd27a", 0.3)
METAL = material("metal", "5a5450", 0.5)
SHARD = material("shard", "c8b07a", 0.4)


def joined(name, objects):
    """Several objects as one, named `name`."""
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    return obj


def box(size, center, mat, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center, rotation=rotation)
    obj = bpy.context.active_object
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    obj.data.materials.append(mat)
    return obj


# The cap: a short cylinder over the bulb, and its socket.
bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.07, depth=0.06, location=(0, 0, 0.17))
cap = bpy.context.active_object
cap.data.materials.append(METAL)
bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.045, depth=0.05, location=(0, 0, 0.12))
socket = bpy.context.active_object
socket.data.materials.append(METAL)

# The cage: four thin bars from the cap down around the bulb, and a ring at the bottom.
bars = []
for i in range(4):
    a = i * math.pi / 2 + math.pi / 4
    bars.append(box((0.012, 0.012, 0.3), (math.cos(a) * 0.155, math.sin(a) * 0.155, 0.0), METAL))
bpy.ops.mesh.primitive_torus_add(major_radius=0.155, minor_radius=0.007, major_segments=16, minor_segments=4, location=(0, 0, -0.15))
ring = bpy.context.active_object
ring.data.materials.append(METAL)
frame = joined("frame", [cap, socket, ring] + bars)

# Whole: the bulb.
# (An icosphere: a UV sphere's indices come out in another order on every run, and the same script
# would not write the same file.)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.13, location=(0, 0, 0))
bulb = bpy.context.active_object
bulb.data.materials.append(GLASS)
whole = joined("whole", [bulb])

# Broken: a few shards of glass still in the socket, of different lengths, hanging around it.
shards = []
for i in range(5):
    a = i * 2 * math.pi / 5
    length = 0.05 + 0.02 * (i % 3)
    shards.append(box((0.02, 0.02, length), (round(math.cos(a) * 0.04, 4), round(math.sin(a) * 0.04, 4), 0.095 - length / 2), SHARD))
broken = joined("broken", shards)

# One root, with the three hanging from it: the presentation finds `whole` and `broken` by name.
bpy.ops.object.empty_add(location=(0, 0, 0))
root = bpy.context.active_object
root.name = "lamp"
for o in (frame, whole, broken):
    o.parent = root

os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
    export_animations=False,
    export_texcoords=False,
)
print(f"LAMP written: {OUT}")
