"""
THE GAMES' WEAPONS (stage 5g, decision 0015; two more in 5n): the weapons of `@manifold/arms`, one model each, made by
this script, run by Blender without a screen (`npm run art:weapons`), never by hand. It writes
`packages/arms/assets/weapons.glb`.

- Six nodes, one for each weapon, each at its own origin: `dart`, `bolt`, `stick`, `grenade`, `shotgun`,
  `launcher`. Each fits the box its look gives it (`WEAPON_LOOKS` in packages/arms/src/looks.ts: across,
  up, along, in meters), centered on its origin; along it is glTF's +Z, its muzzle (where a shot leaves
  it) the +Z end, as the presentation holds a tool (tools.ts: along it, its +Z).
- Its look, by role: the dart a slim pistol of blued metal; the bolt a crossbow of wood with its limbs
  across; the stick a staff with leather grips; the grenade a ribbed ball with its lever; the shotgun a
  pump gun, wood and dark metal, a wide bore; the launcher a long tube, olive, with a flared mouth.
  Few triangles (a weapon is held, small on the screen), four materials, no textures.

It is built in Blender's frame (Z up, and along a weapon is Blender's −Y); the glTF exporter turns
Blender's Z into glTF's Y and −Y into +Z.
"""

import math
import os
import sys

import bmesh
import bpy

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "packages/arms/assets/weapons.glb"

bpy.ops.wm.read_factory_settings(use_empty=True)


def srgb(hex_color):
    c = [int(hex_color[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def material(name, hex_color, roughness, metallic=0.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*srgb(hex_color), 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*srgb(hex_color), 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return m


METAL = material("gunmetal", "3c4248", 0.45, 0.6)
WOOD = material("wood", "8a5a34", 0.7)
LEATHER = material("leather", "4a3020", 0.85)
OLIVE = material("olive", "56603a", 0.6)


def at(across, up, along):
    """A point in a weapon's frame (across, up, along its +Z as glTF has it) in Blender's (x, −y, z)."""
    return (across, -along, up)


def box(size, center, mat):
    """A box `size` (across, up, along) at `center` (the same)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=at(*center))
    obj = bpy.context.active_object
    obj.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(scale=True)
    obj.data.materials.append(mat)
    return obj


def tube(radius, length, center, mat, vertices=10, radius_end=None):
    """A cylinder along the weapon (its axis along +Z as glTF has it), `length` long, centered at `center`."""
    if radius_end is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=length, location=at(*center))
    else:
        bpy.ops.mesh.primitive_cone_add(
            vertices=vertices, radius1=radius_end, radius2=radius, depth=length, location=at(*center)
        )
    obj = bpy.context.active_object
    obj.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    obj.data.materials.append(mat)
    return obj


def joined(name, objects):
    """Several objects as one, named `name`, its origin where the weapon's frame has it."""
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    # (Each one's place into its mesh first: joined, the weapon's origin is the frame's, not its first part's.)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(objects) > 1:
        bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name
    # Triangles, made here by a fixed rule, not left to the exporter (the same file on every run).
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method="FIXED", ngon_method="EAR_CLIP")
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def fits(obj, size):
    """Every vertex within the box `size` (across, up, along) round its origin: its look's box."""
    hx, hy, hz = size[0] / 2 + 1e-4, size[1] / 2 + 1e-4, size[2] / 2 + 1e-4
    for v in obj.data.vertices:
        across, along, up = v.co.x, -v.co.y, v.co.z
        assert abs(across) <= hx and abs(up) <= hy and abs(along) <= hz, (obj.name, tuple(v.co), size)


# The sizes, as packages/arms/src/looks.ts gives them (across, up, along).
SIZES = {
    "dart": (0.05, 0.13, 0.3),
    "bolt": (0.42, 0.1, 0.56),
    "stick": (0.04, 0.04, 1.2),
    "grenade": (0.14, 0.14, 0.14),
    "shotgun": (0.07, 0.13, 0.76),
    "launcher": (0.17, 0.19, 0.96),
    # (Stage 5n)
    "repeater": (0.06, 0.15, 0.42),
    "orb": (0.42, 0.1, 0.56),
}

made = {}

# The dart: a slim pistol. Its barrel along the top, its grip down at the back, a guard.
s = SIZES["dart"]
made["dart"] = joined(
    "dart",
    [
        box((0.04, 0.045, 0.3), (0, 0.04, 0), METAL),
        tube(0.011, 0.04, (0, 0.045, 0.13), METAL, 8),
        box((0.036, 0.085, 0.045), (0, -0.02, -0.085), LEATHER),
        box((0.01, 0.025, 0.06), (0, -0.0, -0.035), METAL),
    ],
)

# The bolt: a crossbow. Its stock along it, its limbs across at the front, the string, a bolt laid in.
s = SIZES["bolt"]
made["bolt"] = joined(
    "bolt",
    [
        box((0.05, 0.05, 0.56), (0, -0.02, 0), WOOD),
        box((0.42, 0.025, 0.035), (0, 0.0, 0.22), WOOD),
        box((0.4, 0.004, 0.004), (0, 0.0, 0.16), LEATHER),
        tube(0.006, 0.34, (0, 0.012, 0.08), METAL, 6),
        box((0.03, 0.03, 0.04), (0, -0.03, -0.1), METAL),
    ],
)

# The stick: a staff, its two grips of leather where the hands go (0.06 and 0.24 from its back end).
s = SIZES["stick"]
made["stick"] = joined(
    "stick",
    [
        tube(0.017, 1.2, (0, 0, 0), WOOD, 8),
        tube(0.02, 0.1, (0, 0, -0.6 + 0.06), LEATHER, 8),
        tube(0.02, 0.1, (0, 0, -0.6 + 0.24), LEATHER, 8),
    ],
)

# The grenade: a ribbed ball, its fuse's cap and lever on top.
s = SIZES["grenade"]
# (An icosphere: a UV sphere's triangles came out of the exporter in another order on each run, and the
# file a script makes is the same on every run.)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.055, location=at(0, -0.01, 0))
ball = bpy.context.active_object
ball.data.materials.append(OLIVE)
# Its ribs: two bands round it, upright cylinders a little wider than the ball, short.
ribs = []
for z in (-0.03, 0.01):
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.057, depth=0.008, location=at(0, z, 0))
    rib = bpy.context.active_object
    rib.data.materials.append(OLIVE)
    ribs.append(rib)
# (Its cap upright: Blender's cylinder stands along its Z, the weapon's up.)
bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.016, depth=0.02, location=at(0, 0.052, 0))
cap = bpy.context.active_object
cap.data.materials.append(METAL)
made["grenade"] = joined("grenade", [ball, *ribs, cap, box((0.012, 0.012, 0.09), (0, 0.055, -0.02), METAL)])

# The shotgun: a pump gun. Its stock of wood at the back, the receiver, a wide barrel, the pump under it.
s = SIZES["shotgun"]
made["shotgun"] = joined(
    "shotgun",
    [
        box((0.045, 0.1, 0.24), (0, -0.015, -0.26), WOOD),
        box((0.05, 0.07, 0.16), (0, 0.02, -0.07), METAL),
        tube(0.019, 0.46, (0, 0.035, 0.15), METAL, 10),
        tube(0.022, 0.18, (0, -0.005, 0.12), WOOD, 8),
        box((0.03, 0.05, 0.04), (0, -0.035, -0.12), METAL),
    ],
)

# The launcher: a long tube on the shoulder, its mouth flared at the front, two grips under it.
s = SIZES["launcher"]
made["launcher"] = joined(
    "launcher",
    [
        tube(0.06, 0.82, (0, 0.015, -0.07), OLIVE, 12),
        tube(0.06, 0.14, (0, 0.015, 0.41), OLIVE, 12, radius_end=0.074),
        tube(0.078, 0.06, (0, 0.015, 0.45), METAL, 12),
        box((0.03, 0.07, 0.04), (0, -0.06, -0.2), LEATHER),
        box((0.03, 0.07, 0.04), (0, -0.06, 0.1), LEATHER),
        box((0.02, 0.04, 0.08), (0.06, 0.06, -0.05), METAL),
    ],
)

# (Stage 5n) The repeater: a compact dart gun, a drum of darts on top, a short barrel, its grip.
s = SIZES["repeater"]
made["repeater"] = joined(
    "repeater",
    [
        box((0.05, 0.05, 0.3), (0, 0.02, -0.02), METAL),
        tube(0.012, 0.1, (0, 0.03, 0.16), METAL, 8),
        tube(0.026, 0.05, (0, 0.046, 0.02), LEATHER, 10),
        box((0.04, 0.08, 0.05), (0, -0.035, -0.11), LEATHER),
        box((0.012, 0.03, 0.07), (0, -0.01, -0.04), METAL),
    ],
)
# The attackers' orb caster: a stock, two prongs across at the front, and the orb held between them.
s = SIZES["orb"]
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.04, location=at(0, 0.0, 0.22))
glass = bpy.context.active_object
glass.data.materials.append(METAL)
made["orb"] = joined(
    "orb",
    [
        box((0.05, 0.05, 0.5), (0, -0.02, -0.03), WOOD),
        box((0.36, 0.03, 0.03), (0, 0.0, 0.16), METAL),
        box((0.03, 0.03, 0.1), (0.165, 0.0, 0.22), METAL),
        box((0.03, 0.03, 0.1), (-0.165, 0.0, 0.22), METAL),
        glass,
    ],
)

for name, obj in made.items():
    fits(obj, SIZES[name])
    obj.location = (0, 0, 0)

bpy.ops.export_scene.gltf(
    filepath=os.path.abspath(OUT),
    export_format="GLB",
    export_apply=True,
    export_yup=True,
    export_animations=False,
    export_cameras=False,
    export_lights=False,
)
