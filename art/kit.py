"""
THE KIT OF LEVEL PIECES (stage 4.5e, decision 0026): the pieces the three games build their levels
with, made by this script, run by Blender without a screen (`npm run art:kit`), never by hand. It
writes `packages/kit/assets/kit.glb`, every piece a node of it, and beside it `kit.json`: each piece's
boxes (what it collides with, in its own frame), its size and its triangles. What is drawn and what
collides come from the same lines here, so they cannot drift apart.

- Their frame (the engine's: x across, y up, −z forward): the origin at the piece's footprint center,
  on the floor it stands on (a wall from y = 0 up; a floor tile's top at y = 0; a roof's underside);
  sizes on a grid of a meter: walls 1, 2 or 4 m long, 3 m tall, 0.3 m thick.
- Each collision box is drawn as itself, its edges chamfered, plus what makes it read as what it is: a
  wall's darker base and cap, a step's darker nose, a column's eight faces, a railing's posts.
- One palette, four materials: stone, a darker stone, wood, metal. No textures yet (4.5f).

Built in Blender's frame (Z up, −Y forward... the exporter turns Blender's Z into glTF's Y and −Y into
+Z): an engine point (x, y, z) is Blender's (x, −z, y), a rotation about the engine's x the same about
Blender's x (the map is a quarter turn about x: it leaves turns about x as they are).
"""

import json
import math
import os
import sys

import bmesh
import bpy

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "packages/kit/assets/kit.glb"

bpy.ops.wm.read_factory_settings(use_empty=True)


def srgb(hex_color):
    """A color as Blender wants it (linear), from the sRGB hex the site uses."""
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


STONE = material("stone", "8a8378", 0.9)
DARK = material("stone_dark", "5f5a52", 0.9)
WOOD = material("wood", "8a6a42", 0.8)
METAL = material("metal", "6f7680", 0.5, 0.6)

# ---------------------------------------------------------------- the pieces, in the engine's frame


def box(center, half, turn=None):
    """A collision box: its center and half sizes in the piece's frame, and its turn (axis, degrees), if any."""
    b = {"center": [round(v, 4) for v in center], "half": [round(v, 4) for v in half]}
    if turn:
        b["turn"] = {"axis": turn[0], "degrees": round(turn[1], 4)}
    return b


def wall(length):
    return [box((0, 1.5, 0), (length / 2, 1.5, 0.15))]


def stairs(steps, rise=0.2, run=0.4, width=2.0):
    """Steps going up towards −z, each a solid block from the floor: the first 0.2 m up at the near end."""
    near = steps * run / 2
    return [box((0, rise * k / 2, near - run * k + run / 2), (width / 2, rise * k / 2, run / 2)) for k in range(1, steps + 1)]


RAMP = math.degrees(math.atan2(1, 4))  # 1 m up over 4 m: 14.04°, flatter than a character stands on (30°)


def ramp():
    t = math.radians(RAMP)
    length = math.hypot(4, 1)
    # Its top's middle at (0, 0.5, 0): the slab's center a thickness below that, turned with it.
    return [box((0, 0.5 - 0.1 * math.cos(t), -0.1 * math.sin(t)), (1, 0.1, length / 2), ("x", RAMP))]


PIECES = {
    "floor_1": [box((0, -0.1, 0), (0.5, 0.1, 0.5))],
    "floor_2": [box((0, -0.1, 0), (1, 0.1, 1))],
    "floor_4": [box((0, -0.1, 0), (2, 0.1, 2))],
    "wall_1": wall(1),
    "wall_2": wall(2),
    "wall_4": wall(4),
    # A doorway 1 m wide and 2.2 m tall in a wall of 2 m (the Dojo's door is 1.2 m by 2.2: wider).
    "wall_door": [
        box((-0.75, 1.5, 0), (0.25, 1.5, 0.15)),
        box((0.75, 1.5, 0), (0.25, 1.5, 0.15)),
        box((0, 2.6, 0), (0.5, 0.4, 0.15)),
    ],
    # A doorway 2 m wide and 2.2 m tall in a wall of 4 m.
    "wall_door_wide": [
        box((-1.5, 1.5, 0), (0.5, 1.5, 0.15)),
        box((1.5, 1.5, 0), (0.5, 1.5, 0.15)),
        box((0, 2.6, 0), (1.0, 0.4, 0.15)),
    ],
    # A gate 2.4 m wide and 2.6 m tall in a wall of 4 m.
    "wall_gate": [
        box((-1.6, 1.5, 0), (0.4, 1.5, 0.15)),
        box((1.6, 1.5, 0), (0.4, 1.5, 0.15)),
        box((0, 2.8, 0), (1.2, 0.2, 0.15)),
    ],
    # A window a meter square, from 1 to 2 m up, in a wall of 2 m.
    "wall_window": [
        box((-0.75, 1.5, 0), (0.25, 1.5, 0.15)),
        box((0.75, 1.5, 0), (0.25, 1.5, 0.15)),
        box((0, 0.5, 0), (0.5, 0.5, 0.15)),
        box((0, 2.5, 0), (0.5, 0.5, 0.15)),
    ],
    "corner": [box((0, 1.5, -0.35), (0.5, 1.5, 0.15)), box((-0.35, 1.5, 0.15), (0.15, 1.5, 0.35))],
    "pillar": [box((0, 1.5, 0), (0.25, 1.5, 0.25))],
    "column": [box((0, 1.5, 0), (0.3, 1.5, 0.3))],
    "stairs_1": stairs(5),
    "stairs_3": stairs(15),
    "ramp_1": ramp(),
    "railing_2": [box((0, 0.5, 0), (1, 0.5, 0.05))],
    "bridge_4": [box((0, -0.1, 0), (0.75, 0.1, 2)), box((-0.7, 0.5, 0), (0.05, 0.5, 2)), box((0.7, 0.5, 0), (0.05, 0.5, 2))],
    "beam_4": [box((0, 0, 0), (2, 0.15, 0.15))],
    "slab_2": [box((0, 0.2, 0), (1, 0.2, 1))],
    "roof_4": [box((0, 0.125, 0), (2, 0.125, 2))],
    "ledge_2": [box((0, 0.1, 0), (1, 0.1, 0.2))],
    "block_1": [box((0, 0.5, 0), (0.5, 0.5, 0.5))],
}


# What each piece is drawn in: the material of its boxes.
LOOK = {name: STONE for name in PIECES}
LOOK.update({"bridge_4": WOOD, "beam_4": WOOD, "block_1": WOOD, "railing_2": METAL, "ledge_2": DARK})

# ---------------------------------------------------------------- building them in Blender


def blender_point(p):
    return (p[0], -p[2], p[1])


def piece_object(name, boxes, mat):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    for m in (mat, DARK, METAL):
        if m.name not in [s.name for s in mesh.materials]:
            mesh.materials.append(m)
    bm = bmesh.new()

    def add(center, half, turn=None, chamfer=0.02, material_index=0):
        before = set(bm.verts)
        made = bmesh.ops.create_cube(bm, size=1.0)
        verts = made["verts"]
        bmesh.ops.scale(bm, vec=(2 * half[0], 2 * half[2], 2 * half[1]), verts=verts)
        if chamfer > 0:
            edges = list({e for v in verts for e in v.link_edges})
            bmesh.ops.bevel(bm, geom=edges, offset=min(chamfer, *half) * 0.9, segments=1, affect="EDGES")
        new = [v for v in bm.verts if v not in before]
        if turn:
            from mathutils import Matrix

            mat_ = Matrix.Rotation(math.radians(turn[1]), 4, "X")
            bmesh.ops.transform(bm, matrix=mat_, verts=new)
        bmesh.ops.translate(bm, vec=blender_point(center), verts=new)
        for f in {f for v in new for f in v.link_faces}:
            f.material_index = material_index

    for b in boxes:
        turn = (b["turn"]["axis"], b["turn"]["degrees"]) if "turn" in b else None
        # (A stair's steps unchamfered: fifteen chamfered took the tallest over the kit's 600 triangles.)
        add(b["center"], b["half"], turn, chamfer=0 if name.startswith("stairs") else 0.02)
    # What makes it read as what it is.
    if name.startswith("wall") or name == "corner":
        for b in boxes:
            c, h = b["center"], b["half"]
            if c[1] - h[1] < 0.01:  # standing on the floor: a darker base
                add((c[0], 0.08, c[2]), (h[0] + 0.01, 0.08, h[2] + 0.02), chamfer=0.01, material_index=1)
            if c[1] + h[1] > 2.99:  # reaching the top: a cap
                add((c[0], 3.0, c[2]), (h[0] + 0.01, 0.04, h[2] + 0.03), chamfer=0.01, material_index=1)
    if name.startswith("stairs"):
        for b in boxes:
            c, h = b["center"], b["half"]
            add((c[0], 2 * h[1] - 0.02, c[2] + h[2] - 0.03), (h[0], 0.02, 0.03), chamfer=0, material_index=1)
    if name == "railing_2":
        for x in (-0.95, 0, 0.95):
            add((x, 0.5, 0), (0.04, 0.5, 0.04), chamfer=0.005, material_index=2)
    if name == "bridge_4":
        for z in (-1.5, -0.5, 0.5, 1.5):
            add((0, 0.005, z), (0.76, 0.006, 0.02), chamfer=0, material_index=1)
    bm.to_mesh(mesh)
    bm.free()
    if name == "column":
        # Eight faces, not four: a column (its collision stays the box, a little inside them).
        mesh.clear_geometry()
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.32, radius2=0.28, depth=2.8)
        bmesh.ops.translate(bm, vec=(0, 0, 1.5), verts=bm.verts)
        for f in bm.faces:
            f.material_index = 0
        before = set(bm.verts)
        for z, r in ((0.1, 0.38), (2.9, 0.36)):
            made = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=r, radius2=r, depth=0.2)
            bmesh.ops.translate(bm, vec=(0, 0, z), verts=made["verts"])
            for v in made["verts"]:
                for f in v.link_faces:
                    f.material_index = 1
        bm.to_mesh(mesh)
        bm.free()
    return obj


def triangles(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


objects = {}
for name, boxes in PIECES.items():
    objects[name] = piece_object(name, boxes, LOOK[name])
    # Side by side in the file, each at its own origin (the engine places each by its name).
    objects[name].location = (0, 0, 0)

# ---------------------------------------------------------------- written out

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=os.path.abspath(OUT),
    export_format="GLB",
    export_apply=True,
    export_yup=True,
    export_animations=False,
    export_cameras=False,
    export_lights=False,
)

def corners(b):
    """A box's eight corners in the piece's frame, turned with it (about x: the kit turns only about x)."""
    t = math.radians(b["turn"]["degrees"]) if "turn" in b else 0.0
    out = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                x, y, z = sx * b["half"][0], sy * b["half"][1], sz * b["half"][2]
                y, z = y * math.cos(t) - z * math.sin(t), y * math.sin(t) + z * math.cos(t)
                out.append((b["center"][0] + x, b["center"][1] + y, b["center"][2] + z))
    return out


def size(boxes):
    points = [p for b in boxes for p in corners(b)]
    return [round(max(p[k] for p in points) - min(p[k] for p in points), 4) for k in range(3)]


data = {"pieces": {name: {"boxes": PIECES[name], "size": size(PIECES[name]), "triangles": triangles(objects[name])} for name in PIECES}}
with open(os.path.join(os.path.dirname(OUT), "kit.json"), "w") as f:
    json.dump(data, f, indent=2, sort_keys=True)
    f.write("\n")
print(f"kit: {len(PIECES)} pieces, {sum(d['triangles'] for d in data['pieces'].values())} triangles -> {OUT}")
