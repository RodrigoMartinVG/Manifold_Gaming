"""
THE DOJO'S DOOR (stage 3c, decision 0015): a door made by this script, run by Blender without a screen
(`npm run art`), never by hand. It writes `games/dojo/assets/door.glb`.

- Its size: 1.2 m wide, 2.2 m high, 0.12 m thick, the box a level gives a door (the machines room's:
  `box … 0.6 1.1 0.06 door -0.6 0 0 y 90 1 gate model dojo.door`).
- Its origin at the slab's center: the simulation turns a door around its hinge and puts its center
  where that takes it (decision 0018), so what draws it needs no pivot of its own.
- What makes it a door, in the engine's frame (x across, y up, z through it): its hinges, three
  knuckles on its left edge (-x), where a level puts its hinge; a handle on each face near the right
  edge (+x); and two panels sunk into each face. Three colors: the wood, the panels, the metal.

It is built in Blender's frame (Z up, Y through the door); the glTF exporter turns Blender's Z into
glTF's Y, and Blender's -Y into glTF's +Z, so the door stands, across x, in the engine.
"""

import os
import sys

import bpy

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "games/dojo/assets/door.glb"

bpy.ops.wm.read_factory_settings(use_empty=True)


def srgb(hex_color):
    """A color as Blender wants it (linear), from the sRGB hex the site uses."""
    c = [int(hex_color[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def material(name, hex_color, roughness):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*srgb(hex_color), 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*srgb(hex_color), 1)
    bsdf.inputs["Roughness"].default_value = roughness
    return m


WOOD = material("wood", "8a6a42", 0.8)
PANEL = material("panel", "74572f", 0.85)
METAL = material("metal", "b8b0a0", 0.4)

W, H, T = 1.2, 2.2, 0.12  # across (x), up (Blender's z), through (Blender's y)


def box(name, size, center, mat, bevel=0.0):
    """A box of `size` (x, through, up) at `center`, in Blender's frame."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 1
        bpy.ops.object.modifier_apply(modifier="bevel")
    obj.data.materials.append(mat)
    return obj


def cylinder(name, radius, depth, center, mat):
    """An upright cylinder (along Blender's z), few sides."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=radius, depth=depth, location=center)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


# The slab, its edges a little rounded, a hair inside the box (so it never pokes out of what collides).
slab = box("door", (W - 0.004, T - 0.004, H - 0.004), (0, 0, 0), WOOD, bevel=0.01)

# Two panels sunk into each face: a thin slab, darker, a little behind the face.
for side in (-1, 1):
    y = side * (T / 2 - 0.012)
    for z, height in ((0.45, 0.9), (-0.55, 0.7)):
        box(f"panel_{'front' if side < 0 else 'back'}_{'top' if z > 0 else 'bottom'}", (W - 0.36, 0.02, height), (0, y, z), PANEL)

# The hinges: three knuckles on the left edge (-x), where a level puts its hinge.
for i, z in enumerate((0.8, 0.0, -0.8)):
    cylinder(f"hinge_{i + 1}", 0.022, 0.16, (-W / 2, 0, z), METAL)

# A handle on each face, near the right edge (+x), at a hand's height (1 m from the floor: -0.1 here).
for side in (-1, 1):
    y = side * (T / 2 + 0.03)
    box(f"handle_{'front' if side < 0 else 'back'}", (0.14, 0.025, 0.03), (W / 2 - 0.16, y, -0.1), METAL)
    box(f"handle_post_{'front' if side < 0 else 'back'}", (0.03, 0.04, 0.03), (W / 2 - 0.1, side * (T / 2 + 0.012), -0.1), METAL)

# One object, its origin at the slab's center.
bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = slab
bpy.ops.object.join()
slab.name = "door"

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
    # No texture coordinates: colors, not textures (and the same script writes the same file).
    export_texcoords=False,
)
print(f"DOOR written: {OUT}")
