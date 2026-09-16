"""Generate a rigged, game-ready ice titan. Run with Blender in background mode.

The sculpt is built from irregular lofts, inset armor plates and tapered crystal
meshes. There are no external textures, so the four glTF PBR materials export
without baking. The local -Y axis is the face direction (+Z after GLTFLoader).
"""

from __future__ import annotations

import math
import random
import shutil
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector


OUT = Path(__file__).resolve().parent
SEED = 4471
MODEL_SCALE = 1.0
rng = random.Random(SEED)

PARTS = [
    "Body", "Head", "Beard", "Horn_L", "Horn_R", "Shoulder_L",
    "Shoulder_R", "Arm_L", "Arm_R", "Hand_L", "Hand_R", "Leg_L",
    "Leg_R", "Foot_L", "Foot_R", "Back_Crystals", "Arm_Crystals",
    "Leg_Crystals", "Waist_Armor", "Chest_Core",
]


def material(name, color, roughness, metallic=0.02, emission=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.use_backface_culling = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = 1.8
    m.diffuse_color = (*color, 1)
    return m


MATS = {
    "Ice_Base": material("Ice_Base", (.055, .31, .58), .36),
    "Ice_Dark": material("Ice_Dark", (.013, .08, .20), .47),
    "Ice_Light": material("Ice_Light", (.27, .65, .88), .26),
    "Ice_Emission": material("Ice_Emission", (.01, .26, .48), .3,
                             emission=(0, .52, .86)),
}


class MeshBuilder:
    def __init__(self, category, mat, bone):
        self.category = category
        self.mat = mat
        self.bone = bone
        self.verts = []
        self.faces = []

    def add(self, verts, faces):
        offset = len(self.verts)
        self.verts.extend(tuple(v) for v in verts)
        self.faces.extend(tuple(offset + i for i in face) for face in faces)

    @property
    def triangles(self):
        return sum(len(face) - 2 for face in self.faces)


builders = {}


def B(category, mat="Ice_Base", bone="Chest"):
    key = (category, mat, bone)
    if key not in builders:
        builders[key] = MeshBuilder(*key)
    return builders[key]


def loft(builder, bottom, top, rx0, ry0, rx1, ry1,
         sides=48, rings=48, phase=0, seed=0, bulge=0.0):
    """An angular, irregular elliptical muscle or armor mass, open at joints."""
    verts, faces = [], []
    for j in range(rings + 1):
        t = j / rings
        cx = bottom[0] * (1 - t) + top[0] * t
        cy = bottom[1] * (1 - t) + top[1] * t
        z = bottom[2] * (1 - t) + top[2] * t
        swell = 1 + bulge * math.sin(math.pi * t)
        rx = (rx0 * (1 - t) + rx1 * t) * swell
        ry = (ry0 * (1 - t) + ry1 * t) * swell
        for i in range(sides):
            a = 2 * math.pi * i / sides + phase
            # Broad facets and fine crystal grain without smoothing the silhouette.
            noise = (1 + .052 * math.sin(i * 1.73 + j * .37 + seed)
                     + .026 * math.sin(i * 3.3 - j * 1.47 + seed * 2))
            ridge = 1 + .034 * math.cos(a * 12 + seed)
            verts.append((cx + math.cos(a) * rx * noise * ridge,
                          cy + math.sin(a) * ry * noise * ridge,
                          z + .011 * math.sin(i * 2.7 + j * .8 + seed)))
    for j in range(rings):
        for i in range(sides):
            a = j * sides + i
            b = j * sides + (i + 1) % sides
            c = (j + 1) * sides + (i + 1) % sides
            d = (j + 1) * sides + i
            faces.extend(((a, b, d), (b, c, d)))
    builder.add(verts, faces)


def shard(builder, base, tip, width, depth=None, sides=7, twist=0.0):
    """Off-axis, five-level crystal with a fractured ridge and sharp end."""
    depth = depth if depth is not None else width * .74
    base, tip = Vector(base), Vector(tip)
    axis = (tip - base).normalized()
    helper = Vector((0, 1, 0)) if abs(axis.y) < .9 else Vector((1, 0, 0))
    u = axis.cross(helper).normalized()
    v = axis.cross(u).normalized()
    length = (tip - base).length
    verts = []
    levels = ((0, .80), (.20, 1.08), (.55, .86), (.84, .42))
    for layer, (t, radius) in enumerate(levels):
        for i in range(sides):
            a = 2 * math.pi * i / sides + twist + layer * .09
            r = radius * (1 + .11 * math.sin(i * 2.2 + layer + twist))
            p = base + axis * (length * t)
            p += u * math.cos(a) * width * r + v * math.sin(a) * depth * r
            p += u * length * .035 * t * t
            verts.append(p)
    verts.append(tip)
    faces = []
    for layer in range(len(levels) - 1):
        for i in range(sides):
            a = layer * sides + i
            b = layer * sides + (i + 1) % sides
            c = (layer + 1) * sides + (i + 1) % sides
            d = (layer + 1) * sides + i
            faces.extend(((a, b, d), (b, c, d)))
    for i in range(sides):
        faces.append(((len(levels) - 1) * sides + i,
                      (len(levels) - 1) * sides + (i + 1) % sides,
                      len(verts) - 1))
    # The root is embedded in the body; no buried base cap.
    builder.add(verts, faces)


def curved_horn(builder, path, widths, sides=14):
    verts, faces = [], []
    path = [Vector(p) for p in path]
    for j, center in enumerate(path):
        tangent = (path[min(j + 1, len(path) - 1)] -
                   path[max(j - 1, 0)]).normalized()
        helper = Vector((0, 1, 0)) if abs(tangent.y) < .9 else Vector((1, 0, 0))
        u = tangent.cross(helper).normalized()
        v = tangent.cross(u).normalized()
        for i in range(sides):
            a = 2 * math.pi * i / sides
            p = center + u * math.cos(a) * widths[j] + v * math.sin(a) * widths[j] * .83
            verts.append(p)
    for j in range(len(path) - 1):
        for i in range(sides):
            a = j * sides + i
            b = j * sides + (i + 1) % sides
            c = (j + 1) * sides + (i + 1) % sides
            d = (j + 1) * sides + i
            faces.extend(((a, b, d), (b, c, d)))
    builder.add(verts, faces)


def plate(builder, center, wide, tall, depth, skew=0, normal=(0, -1, 0)):
    """Broad, shallow angular ice slab with a fractured bevel."""
    x, y, z = center
    normal = Vector(normal)
    u = Vector((1, 0, 0)) if abs(normal.y) > .5 else Vector((0, 1, 0))
    v = Vector((0, 0, 1))
    c = Vector((x, y, z))
    outline = [(-.47, -.40), (-.08, -.63), (.54, -.44), (.48, .12),
               (.23 + skew, .48), (-.28, .62), (-.56, .14)]
    verts = []
    for layer, factor in ((0, 1), (1, .88)):
        for i, (dx, dz) in enumerate(outline):
            p = c + u * dx * wide * factor + v * dz * tall * factor
            if layer:
                p += normal * depth * (.31 + .12 * math.sin(i * 1.9 + skew))
            verts.append(p)
    verts.append(c + normal * depth * .54 + u * skew * wide * .08)
    faces = []
    n = len(outline)
    for i in range(n):
        a, b = i, (i + 1) % n
        d, e = n + i, n + (i + 1) % n
        faces.extend(((a, b, d), (b, e, d)))
    for i in range(n):
        faces.append((n + i, n + (i + 1) % n, len(verts) - 1))
    builder.add(verts, faces)


def glowing_crack(builder, points, width=.018):
    """Thin raised emissive strip that survives glTF material export."""
    verts, faces = [], []
    for x, y, z in points:
        verts.extend(((x - width, y - .009, z),
                      (x + width, y - .009, z)))
    for i in range(len(points) - 1):
        a = i * 2
        faces.extend(((a, a + 1, a + 2), (a + 1, a + 3, a + 2)))
    builder.add(verts, faces)


# Broad inverted-triangle torso, narrow waist, and inset dark creases.
loft(B("Body"), (0, .08, 1.90), (0, .08, 3.56), .49, .35, .86, .53,
     sides=64, rings=60, seed=2, bulge=.12)
loft(B("Body", "Ice_Dark"), (0, -.015, 1.94), (0, -.015, 3.35),
     .43, .31, .75, .42, sides=40, rings=38, seed=6)

# Broad pectoral shields and irregular facets follow the reference's V chest.
for side in (-1, 1):
    plate(B("Body", "Ice_Light"),
          (side * .37, -.56, 3.19), .70, .51, .12, skew=side * .12)
    for row in range(2):
        for col in range(4):
            x = side * (.12 + col * .17 + rng.uniform(-.025, .025))
            z = 2.78 + row * .23 - col * .025 + rng.uniform(-.025, .025)
            y = -.52 - .055 * math.sin((col + 1) / 6 * math.pi)
            plate(B("Body", "Ice_Light" if (row + col) % 5 == 0 else "Ice_Base"),
                  (x, y, z), .26 + rng.uniform(-.03, .03),
                  .28 + rng.uniform(-.035, .035), .045, skew=side * .22)
    for row in range(3):
        for col in range(2):
            plate(B("Body", "Ice_Base"),
                  (side * (.20 + col * .29 + rng.uniform(-.02, .02)), -.34,
                   2.09 + row * .19 + rng.uniform(-.02, .02)),
                  .31, .28, .04, skew=side * .1)

# Small, angular head and a recessed aggressive face.
loft(B("Head", "Ice_Dark", "Head"), (0, -.10, 3.52), (0, -.09, 4.01),
     .27, .24, .225, .22, sides=40, rings=30, seed=8)
for side in (-1, 1):
    for row in range(2):
        for col in range(2):
            plate(B("Head", "Ice_Base", "Head"),
                  (side * (.065 + col * .11), -.298, 3.76 + row * .11),
                  .13, .13, .018, side * .2)
    # Cyan eyes, dark glowering brow and hooked cheek tusks.
    plate(B("Head", "Ice_Emission", "Head"),
          (side * .108, -.326, 3.83), .105, .058, .032)
    shard(B("Head", "Ice_Dark", "Head"),
          (side * .04, -.345, 3.89), (side * .22, -.37, 3.86), .050)
    shard(B("Head", "Ice_Light", "Head"),
          (side * .21, -.25, 3.65), (side * .24, -.32, 3.48), .065)
plate(B("Head", "Ice_Dark", "Head"), (0, -.34, 3.68), .24, .095, .014)

# Layered icicle beard. The cheek line stays wider than the chin.
for row in range(3):
    for i in range(13 - row * 2):
        x = (i - (12 - row * 2) / 2) * .054
        start_z = 3.66 - row * .095
        length = (.20 + .18 * (1 - abs(x) / .36) + .065 * row
                  + rng.uniform(-.035, .035))
        shard(B("Beard", "Ice_Light" if i % 3 == 0 else "Ice_Base", "Head"),
              (x, -.37 - row * .025, start_z),
              (x * 1.08, -.58 - row * .02, start_z - length), .046 + row * .008,
              sides=6, twist=i * .27)

# Two long, outward sweeping primary horns, with a crown of smaller spires.
for side, name in ((-1, "Horn_L"), (1, "Horn_R")):
    path = [(side * (.18 + .52 * math.sin(t * math.pi * .6)),
             -.08 + .11 * math.sin(t * math.pi),
             3.91 + .43 * math.sin(t * math.pi * .75) + .26 * t)
            for t in (i / 18 for i in range(19))]
    curved_horn(B(name, "Ice_Base", "Head"), path,
                [.16 * (1 - i / 19) ** 1.13 + .005 for i in range(19)])
    for j in range(2):
        shard(B(name, "Ice_Light", "Head"),
              (side * (.19 + j * .16), -.055, 4.00),
              (side * (.23 + j * .25), -.04, 4.34 + j * .10),
              .066 - j * .009)
for x in (-.18, -.09, 0, .09, .18):
    shard(B("Head", "Ice_Light", "Head"),
          (x, .0, 4.00), (x * 1.15, .015, 4.24 + .17 * (1 - abs(x) / .2)),
          .054)

# Massive shoulder guards and asymmetric spike fans behind them.
for side, name, bone in ((-1, "Shoulder_L", "UpperArm_L"),
                         (1, "Shoulder_R", "UpperArm_R")):
    loft(B(name, "Ice_Dark", bone), (side * 1.05, .02, 2.91),
         (side * 1.02, .05, 3.48), .42, .39, .50, .43,
         sides=48, rings=32, seed=12 + side, bulge=.2)
    for row in range(2):
        for col in range(4):
            x = side * (.76 + col * .18 + rng.uniform(-.025, .025))
            z = 3.05 + row * .245 + rng.uniform(-.025, .025)
            plate(B(name, "Ice_Light" if (col + row) % 4 == 0 else "Ice_Base", bone),
                  (x, -.37 - .06 * math.sin(col * .45), z),
                  .27, .31, .045, side * .18)
    for i in range(20):
        a = (i / 19) * math.pi
        x = side * (.76 + .58 * math.sin(a))
        z = 3.28 + .20 * math.cos(a)
        shard(B(name, "Ice_Light" if i % 4 == 0 else "Ice_Base", bone),
              (x, .02 + .13 * math.sin(i), z),
              (x + side * (.22 + .15 * rng.random()),
               .06 + .14 * rng.random(),
               z + .28 + .46 * rng.random()),
              .105 + .07 * rng.random(), sides=7, twist=i * .3)

# Arm mass is split at elbows for future animation. Forearm crystals dominate.
for side, suffix in ((-1, "L"), (1, "R")):
    loft(B(f"Arm_{suffix}", "Ice_Dark", f"UpperArm_{suffix}"),
         (side * 1.42, .04, 2.34), (side * 1.13, .02, 3.06),
         .28, .29, .33, .32, sides=48, rings=36, seed=20 + side, bulge=.19)
    loft(B(f"Arm_{suffix}", "Ice_Base", f"LowerArm_{suffix}"),
         (side * 1.60, -.05, 1.54), (side * 1.43, .02, 2.38),
         .38, .35, .31, .30, sides=48, rings=36, seed=24 + side, bulge=.24)
    for row in range(3):
        for col in range(3):
            plate(B(f"Arm_{suffix}", "Ice_Base", f"UpperArm_{suffix}"),
                  (side * (1.12 + col * .19 + row * .045 + rng.uniform(-.02, .02)),
                   -.275, 2.42 + row * .20 + rng.uniform(-.02, .02)),
                  .27, .29, .038, side * .2)
    for row in range(4):
        for col in range(3):
            plate(B("Arm_Crystals", "Ice_Light" if col % 5 == 0 else "Ice_Base",
                    f"LowerArm_{suffix}"),
                  (side * (1.31 + col * .21 + row * .03 + rng.uniform(-.02, .02)),
                   -.33, 1.63 + row * .205 + rng.uniform(-.02, .02)),
                  .30, .31, .045, side * .17)
    for i in range(35):
        t = i / 34
        z = 1.55 + t * .78
        x = side * (1.65 + .34 * rng.random())
        y = .04 + .32 * math.sin(i * 1.8)
        shard(B("Arm_Crystals", "Ice_Base", f"LowerArm_{suffix}"),
              (x, y, z), (x + side * (.13 + .15 * rng.random()),
                         y + .05, z + .12 + .22 * rng.random()),
              .045 + .045 * rng.random(), sides=6)
    loft(B(f"Hand_{suffix}", "Ice_Dark", f"Hand_{suffix}"),
         (side * 1.68, -.04, 1.17), (side * 1.60, -.05, 1.58),
         .27, .30, .32, .32, sides=36, rings=28, seed=29 + side)
    for finger in range(4):
        x = side * (1.47 + finger * .145)
        shard(B(f"Hand_{suffix}", "Ice_Base", f"Hand_{suffix}"),
              (x, -.23, 1.25), (x + side * .04, -.30, .84 + .05 * finger),
              .102, sides=7)
    shard(B(f"Hand_{suffix}", "Ice_Light", f"Hand_{suffix}"),
          (side * 1.42, -.26, 1.48), (side * 1.19, -.42, 1.12), .12)

# Trunk-like legs with overlapping plate rows, talon-shaped large feet.
for side, suffix in ((-1, "L"), (1, "R")):
    loft(B(f"Leg_{suffix}", "Ice_Dark", f"UpperLeg_{suffix}"),
         (side * .48, .03, 1.08), (side * .44, .03, 2.12),
         .37, .33, .42, .36, sides=48, rings=42, seed=34 + side,
         bulge=.13)
    loft(B(f"Leg_{suffix}", "Ice_Base", f"LowerLeg_{suffix}"),
         (side * .51, .03, .28), (side * .49, .03, 1.11),
         .37, .37, .35, .35, sides=48, rings=40, seed=37 + side,
         bulge=.14)
    for row in range(4):
        for col in range(3):
            z = .49 + row * .40 + rng.uniform(-.035, .035)
            x = side * (.23 + col * .24 + rng.uniform(-.03, .03))
            y = -.32 - .045 * math.sin(col * .5)
            bone = f"LowerLeg_{suffix}" if row < 2 else f"UpperLeg_{suffix}"
            plate(B("Leg_Crystals", "Ice_Light" if col == 2 and row % 3 == 0
                    else "Ice_Base", bone),
                  (x, y, z), .32, .42, .052, side * .17)
    for i in range(21):
        t = i / 20
        z = .42 + 1.45 * t
        x = side * (.73 + rng.random() * .17)
        shard(B("Leg_Crystals", "Ice_Base",
                f"LowerLeg_{suffix}" if t < .46 else f"UpperLeg_{suffix}"),
              (x, -.02, z), (x + side * .10, .02, z + .22 + rng.random() * .16),
              .06 + rng.random() * .04, sides=6)
    loft(B(f"Foot_{suffix}", "Ice_Dark", f"Foot_{suffix}"),
         (side * .52, -.17, .04), (side * .51, .01, .38),
         .44, .53, .34, .37, sides=48, rings=32, seed=41 + side)
    for toe in range(5):
        x = side * (.18 + toe * .17)
        shard(B(f"Foot_{suffix}", "Ice_Light" if toe % 2 else "Ice_Base",
                f"Foot_{suffix}"),
              (x, -.43, .17), (x + side * .015, -.72, .025),
              .11, .10, sides=7)

# The skirt has uneven overlapping icicles and an emissive central diamond.
for row in range(3):
    for i in range(27):
        a = 2 * math.pi * i / 27
        r = .53 + row * .04
        x, y = math.cos(a) * r, math.sin(a) * r
        length = .28 + .17 * rng.random() + row * .06
        shard(B("Waist_Armor", "Ice_Light" if i % 6 == 0 else "Ice_Base",
                "Pelvis"),
              (x, y, 2.11 - row * .10),
              (x * 1.13, y * 1.13, 2.11 - row * .10 - length),
              .072 + row * .008, sides=6, twist=a)
shard(B("Waist_Armor", "Ice_Emission", "Pelvis"),
      (0, -.65, 2.08), (0, -.71, 1.57), .15, .10, sides=8)

# Rear skyline repeats the image's long vertical glacier spires.
for side in (-1, 1):
    for i in range(17):
        x = side * (.35 + i * .056)
        z = 3.17 + .23 * rng.random()
        height = .38 + .65 * rng.random() + (i % 6 == 0) * .43
        shard(B("Back_Crystals", "Ice_Light" if i % 4 == 0 else "Ice_Base"),
              (x, .36 + .08 * rng.random(), z),
              (x + side * (.10 + .25 * rng.random()), .40, z + height),
              .105 + .065 * rng.random(), sides=7, twist=i * .29)

# Cleft torso core and branching emissive fissures on pecs, arms and shins.
shard(B("Chest_Core", "Ice_Emission"),
      (0, -.59, 3.15), (0, -.67, 2.75), .12, .085, sides=8)
for side in (-1, 1):
    glowing_crack(B("Chest_Core", "Ice_Emission"),
                  [(0, -.74, 3.18), (side * .16, -.73, 3.01),
                   (side * .32, -.71, 3.04), (side * .47, -.68, 2.89),
                   (side * .62, -.64, 2.86)], .018)
    glowing_crack(B("Chest_Core", "Ice_Emission"),
                  [(side * .13, -.69, 2.78), (side * .24, -.68, 2.62),
                   (side * .19, -.64, 2.48)], .017)
    suffix = "L" if side < 0 else "R"
    glowing_crack(B("Arm_Crystals", "Ice_Emission", f"LowerArm_{suffix}"),
                  [(side * 1.49, -.355, 2.34),
                   (side * 1.59, -.39, 2.12),
                   (side * 1.53, -.40, 1.92),
                   (side * 1.72, -.36, 1.68)], .018)
    glowing_crack(B("Leg_Crystals", "Ice_Emission", f"LowerLeg_{suffix}"),
                  [(side * .47, -.45, 1.08), (side * .43, -.45, .89),
                   (side * .55, -.45, .67), (side * .51, -.45, .36)], .018)


def make_rig(root):
    arm_data = bpy.data.armatures.new("IceGolem_Skeleton")
    arm = bpy.data.objects.new("IceGolem_Armature", arm_data)
    bpy.context.collection.objects.link(arm)
    arm.parent = root
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bones = [
        ("Root", None, (0, 0, 0), (0, 0, .3)),
        ("Pelvis", "Root", (0, 0, 1.72), (0, 0, 2.16)),
        ("Spine", "Pelvis", (0, 0, 2.16), (0, 0, 2.76)),
        ("Chest", "Spine", (0, 0, 2.76), (0, 0, 3.46)),
        ("Neck", "Chest", (0, 0, 3.46), (0, 0, 3.67)),
        ("Head", "Neck", (0, 0, 3.67), (0, 0, 4.05)),
    ]
    for side, suffix in ((-1, "L"), (1, "R")):
        bones += [
            (f"UpperArm_{suffix}", "Chest",
             (side * 1.02, 0, 3.23), (side * 1.42, 0, 2.35)),
            (f"LowerArm_{suffix}", f"UpperArm_{suffix}",
             (side * 1.42, 0, 2.35), (side * 1.62, 0, 1.55)),
            (f"Hand_{suffix}", f"LowerArm_{suffix}",
             (side * 1.62, 0, 1.55), (side * 1.68, 0, 1.15)),
            (f"UpperLeg_{suffix}", "Pelvis",
             (side * .46, 0, 2.03), (side * .49, 0, 1.08)),
            (f"LowerLeg_{suffix}", f"UpperLeg_{suffix}",
             (side * .49, 0, 1.08), (side * .51, 0, .36)),
            (f"Foot_{suffix}", f"LowerLeg_{suffix}",
             (side * .51, 0, .36), (side * .51, -.40, .08)),
        ]
    for name, parent, head, tail in bones:
        bone = arm_data.edit_bones.new(name)
        bone.head = tuple(v * MODEL_SCALE for v in head)
        bone.tail = tuple(v * MODEL_SCALE for v in tail)
        if parent:
            bone.parent = arm_data.edit_bones[parent]
        bone.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    arm.select_set(False)
    return arm


def main():
    global MODEL_SCALE
    MODEL_SCALE = 4.5 / max(point[2] for builder in builders.values()
                            for point in builder.verts)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    root = bpy.data.objects.new("IceGolem_Root", None)
    bpy.context.collection.objects.link(root)
    arm = make_rig(root)

    def tris():
        return sum(builder.triangles for builder in builders.values())

    # Raise geometric detail only where it adds visible broad surface fractures.
    # Refine before batching so the 20 logical parts remain 20 skinned meshes.
    for category in ("Body", "Shoulder_L", "Shoulder_R", "Leg_L", "Leg_R"):
        if tris() >= 82000:
            break
        candidates = [b for b in builders.values()
                      if b.category == category and b.mat == "Ice_Base"]
        for builder in candidates:
            gain = builder.triangles * 3
            if tris() + gain > 98000:
                continue
            mesh = bpy.data.meshes.new("Temporary_Refinement")
            mesh.from_pydata(builder.verts, [], builder.faces)
            mesh.update()
            bm = bmesh.new()
            bm.from_mesh(mesh)
            bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=1,
                                      use_grid_fill=True)
            bm.to_mesh(mesh)
            bm.free()
            mesh.update()
            builder.verts = [tuple(v.co) for v in mesh.vertices]
            builder.faces = [tuple(p.vertices) for p in mesh.polygons]
            bpy.data.meshes.remove(mesh)

    meshes = []
    for category in PARTS:
        pieces = [b for b in builders.values()
                  if b.category == category and b.faces]
        if not pieces:
            raise RuntimeError(f"Peça sem geometria: {category}")
        material_names = [name for name in MATS
                          if any(b.mat == name for b in pieces)]
        material_indices = {name: i for i, name in enumerate(material_names)}
        verts, faces, face_materials, vertex_bones = [], [], [], []
        for builder in pieces:
            offset = len(verts)
            verts.extend(tuple(v * MODEL_SCALE for v in point)
                         for point in builder.verts)
            faces.extend(tuple(offset + i for i in face)
                         for face in builder.faces)
            face_materials.extend([material_indices[builder.mat]] * len(builder.faces))
            vertex_bones.extend([builder.bone] * len(builder.verts))

        mesh = bpy.data.meshes.new(category + "_Geometry")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        for name in material_names:
            mesh.materials.append(MATS[name])
        for polygon, material_index in zip(mesh.polygons, face_materials):
            polygon.material_index = material_index
            polygon.use_smooth = False
        obj = bpy.data.objects.new(category, mesh)
        bpy.context.collection.objects.link(obj)
        obj.parent = arm
        modifier = obj.modifiers.new("Skin", "ARMATURE")
        modifier.object = arm

        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()

        # Planar UVs allow optional future baked detail; solid PBR colors need none.
        uv = mesh.uv_layers.new(name="Ice_UV")
        for polygon in mesh.polygons:
            for loop_index in polygon.loop_indices:
                vertex = mesh.vertices[mesh.loops[loop_index].vertex_index].co
                uv.data[loop_index].uv = (vertex.x * .22 + .5,
                                          vertex.z * .22)

        weight_batches = {}
        for vertex, bone in zip(mesh.vertices, vertex_bones):
            if category == "Body":
                z = vertex.co.z / MODEL_SCALE
                if z < 2.2:
                    weights = (("Pelvis", 1.0),)
                elif z < 2.55:
                    t = round((z - 2.2) / .35, 2)
                    weights = (("Pelvis", 1 - t), ("Spine", t))
                elif z < 2.78:
                    weights = (("Spine", 1.0),)
                elif z < 3.08:
                    t = round((z - 2.78) / .30, 2)
                    weights = (("Spine", 1 - t), ("Chest", t))
                else:
                    weights = (("Chest", 1.0),)
            else:
                weights = ((bone, 1.0),)
            for name, weight in weights:
                if weight > 0:
                    weight_batches.setdefault((name, weight), []).append(vertex.index)
        groups_by_name = {name: obj.vertex_groups.new(name=name)
                          for name in {bone_name for bone_name, _ in weight_batches}}
        for (name, weight), indices in weight_batches.items():
            groups_by_name[name].add(indices, weight, "REPLACE")
        meshes.append(obj)

    # Origin and scale stay exact: floor near zero, tallest shard ~4.5 m.
    for obj in meshes:
        obj.select_set(True)
    root.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "ice_golem.blend"))
    bpy.ops.export_scene.gltf(
        filepath=str(OUT / "ice_golem.glb"), export_format="GLB",
        use_selection=True, export_apply=False, export_skins=True,
        export_yup=True, export_normals=True, export_texcoords=True,
        export_materials="EXPORT", export_extras=False,
        export_animations=False,
    )
    game_asset = OUT / "client" / "public" / "assets" / "models"
    if game_asset.is_dir():
        shutil.copyfile(OUT / "ice_golem.glb", game_asset / "ice_golem.glb")
    print(f"ICE_GOLEM_STATS vertices={sum(len(o.data.vertices) for o in meshes)} "
          f"faces={sum(len(o.data.polygons) for o in meshes)} "
          f"triangles={tris()} meshes={len(meshes)} "
          f"glb_bytes={(OUT / 'ice_golem.glb').stat().st_size}")


if __name__ == "__main__":
    main()
