"""Generate a rigged, game-ready weak ice golem. Run in Blender background mode.

The sculpt follows the compact wave-one creature: oversized expressive head,
short powerful limbs, crystalline horns, ears, claws and layered ice plates.
There are no external textures, so the four glTF PBR materials export without
baking. The local -Y axis is the face direction (+Z after GLTFLoader).
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
    "Ice_Base": material("Ice_Base", (.42, .78, .92), .34),
    "Ice_Dark": material("Ice_Dark", (.012, .075, .17), .43),
    "Ice_Light": material("Ice_Light", (.78, .95, 1.0), .25),
    "Ice_Emission": material("Ice_Emission", (.025, .38, .66), .28,
                             emission=(.02, .68, 1.0)),
}


class MeshBuilder:
    def __init__(self, category, mat, bone):
        self.category = category
        self.mat = mat
        self.bone = bone
        self.verts = []
        self.faces = []
        self.face_smooth = []

    def add(self, verts, faces, flat=False):
        offset = len(self.verts)
        self.verts.extend(tuple(v) for v in verts)
        self.faces.extend(tuple(offset + i for i in face) for face in faces)
        self.face_smooth.extend([not flat] * len(faces))

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


def armor_plate(builder, center, wide, tall, depth, skew=0,
                normal=(0, -1, 0)):
    """A shallow trapezoidal armor slab split into readable planar facets.

    Unlike an ellipsoid this keeps the frontal silhouette broad while adding
    very little depth.  The raised, slightly off-center ridge gives large chest
    plates a sculpted crystalline break without requiring a texture map.
    """
    normal = Vector(normal).normalized()
    u = Vector((1, 0, 0)) if abs(normal.y) > .5 else Vector((0, 1, 0))
    v = Vector((0, 0, 1))
    c = Vector(center)
    outline = [(-.48, -.34), (-.30, -.55), (.24, -.58), (.48, -.31),
               (.52, .24), (.29, .51), (-.25, .56), (-.52, .22)]
    verts = []
    for layer, factor in ((0, 1.0), (1, .91)):
        for i, (dx, dz) in enumerate(outline):
            p = c + u * (dx + skew * dz * .10) * wide * factor
            p += v * dz * tall * factor
            if layer:
                p += normal * depth * (.68 + .08 * math.sin(i * 1.71 + skew))
            verts.append(p)
    ridge = c + normal * depth * .94 + u * skew * wide * .16
    ridge += v * tall * .02
    verts.append(ridge)
    faces = []
    count = len(outline)
    for i in range(count):
        a, b = i, (i + 1) % count
        inner_a, inner_b = count + i, count + (i + 1) % count
        faces.extend(((a, b, inner_a), (b, inner_b, inner_a)))
        faces.append((inner_a, inner_b, len(verts) - 1))
    builder.add(verts, faces, flat=True)


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


def ellipsoid(builder, center, radii, segments=48, rings=32, seed=0):
    """Closed faceted ellipsoid with controlled, deterministic ice breakup."""
    cx, cy, cz = center
    rx, ry, rz = radii
    verts = [(cx, cy, cz - rz)]
    for j in range(1, rings):
        phi = -math.pi / 2 + math.pi * j / rings
        cp, sp = math.cos(phi), math.sin(phi)
        for i in range(segments):
            theta = 2 * math.pi * i / segments
            grain = (1 + .018 * math.sin(i * 2.31 + j * .73 + seed)
                     + .012 * math.cos(i * .81 - j * 1.47 + seed * 2))
            verts.append((cx + rx * cp * math.cos(theta) * grain,
                          cy + ry * cp * math.sin(theta) * grain,
                          cz + rz * sp * grain))
    top = len(verts)
    verts.append((cx, cy, cz + rz))
    faces = []
    for i in range(segments):
        faces.append((0, 1 + (i + 1) % segments, 1 + i))
    for j in range(rings - 2):
        row = 1 + j * segments
        nxt = row + segments
        for i in range(segments):
            a, b = row + i, row + (i + 1) % segments
            c, d = nxt + (i + 1) % segments, nxt + i
            faces.extend(((a, b, d), (b, c, d)))
    last = 1 + (rings - 2) * segments
    for i in range(segments):
        faces.append((last + i, last + (i + 1) % segments, top))
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


# The original generator built a tall titan. The active model below deliberately
# replaces that draft with the compact, friendly-aggressive wave-one creature.
builders.clear()
rng.seed(SEED + 101)

# Round belly and oversized head establish the reference's readable chibi shape.
ellipsoid(B("Body"), (0, .02, 1.38), (.69, .55, .82), 64, 48, 50)
ellipsoid(B("Body", "Ice_Light"), (0, -.50, 1.46), (.43, .10, .52), 40, 30, 51)
for side in (-1, 1):
    for row in range(3):
        plate(B("Body", "Ice_Light" if row == 0 else "Ice_Base"),
              (side * (.17 + row * .14), -.565, 1.20 + row * .25),
              .23, .27, .038, side * (.08 + row * .04))

ellipsoid(B("Head", "Ice_Base", "Head"), (0, -.02, 2.55),
          (1.02, .78, .92), 72, 52, 60)
# Bright mask planes keep the face legible under the blue arena lighting.
for side in (-1, 1):
    plate(B("Head", "Ice_Light", "Head"),
          (side * .40, -.744, 2.66), .50, .54, .038, side * .08)

# Recessed family eyes: dark angular sockets, compact cyan ovals and heavy lids.
# They stay slightly larger than the other stages without reading as spheres.
for side in (-1, 1):
    plate(B("Head", "Ice_Dark", "Head"),
          (side * .31, -.762, 2.67), .37, .28, .024, side * .18)
    ellipsoid(B("Head", "Ice_Emission", "Head"),
              (side * .31, -.795, 2.66), (.155, .026, .115), 28, 18, 72 + side)
    ellipsoid(B("Head", "Ice_Dark", "Head"),
              (side * .31, -.821, 2.66), (.062, .012, .068), 22, 14, 74 + side)
    ellipsoid(B("Head", "Ice_Light", "Head"),
              (side * .285, -.834, 2.705), (.022, .007, .025), 12, 8, 76 + side)
    plate(B("Head", "Ice_Base", "Head"),
          (side * .31, -.806, 2.765), .31, .14, .026, side * .22)
    # The inner edge sits lower, producing curiosity with an aggressive focus.
    shard(B("Head", "Ice_Base", "Head"),
          (side * .075, -.800, 2.865), (side * .53, -.812, 3.025), .092, .060,
          sides=7, twist=side * .14)

# Smiling dark mouth with icy lip, tongue glint and six small teeth.
plate(B("Head", "Ice_Dark", "Head"), (0, -.814, 2.25), .78, .25, .055)
plate(B("Head", "Ice_Emission", "Head"), (0, -.877, 2.20), .31, .075, .012)
for i, x in enumerate((-.28, -.12, .12, .28)):
    top = i in (0, 3)
    shard(B("Head", "Ice_Light", "Head"),
          (x, -.89, 2.34 if top else 2.14),
          (x * .96, -.91, 2.20 if top else 2.27), .045, .035, sides=6)

# A short crystalline chin tuft satisfies the beard slot without aging the imp.
for i, x in enumerate((-.18, -.09, 0, .09, .18)):
    shard(B("Beard", "Ice_Light" if i % 2 else "Ice_Base", "Head"),
          (x, -.62, 2.02), (x * 1.05, -.66, 1.91 - .025 * (i % 2)), .044,
          sides=6, twist=i * .31)

# Tall curved horns, pointed ears and a crown of varied crystal fins.
for side, name in ((-1, "Horn_L"), (1, "Horn_R")):
    path = [(side * (.62 + .31 * math.sin(t * math.pi * .72)),
             -.05 + .08 * math.sin(t * math.pi),
             2.98 + .78 * t + .20 * math.sin(t * math.pi))
            for t in (i / 20 for i in range(21))]
    curved_horn(B(name, "Ice_Base", "Head"), path,
                [.16 * (1 - i / 21) ** 1.15 + .008 for i in range(21)], 14)
    shard(B(name, "Ice_Light", "Head"),
          (side * .70, -.02, 3.17), (side * .83, -.04, 3.63), .085)
    # Long elf-like side ear with a secondary translucent-looking inner shard.
    shard(B("Head", "Ice_Base", "Head"),
          (side * .83, -.05, 2.68), (side * 1.33, -.13, 2.92), .17, .09,
          sides=8, twist=.2)
    shard(B("Head", "Ice_Light", "Head"),
          (side * .90, -.12, 2.72), (side * 1.20, -.17, 2.86), .075, .04,
          sides=7)
for i, x in enumerate((-.43, -.22, 0, .22, .43)):
    height = (3.72, 3.87, 4.08, 3.83, 3.70)[i]
    shard(B("Head", "Ice_Light" if i in (1, 3) else "Ice_Base", "Head"),
          (x, .08, 3.16), (x * 1.12, .10, height), .13 - abs(x) * .07,
          sides=8, twist=i * .22)

# Compact shoulders with a few large, readable crystals instead of visual noise.
for side, name, suffix in ((-1, "Shoulder_L", "L"), (1, "Shoulder_R", "R")):
    ellipsoid(B(name, "Ice_Base", f"UpperArm_{suffix}"),
              (side * .78, .01, 1.78), (.34, .34, .37), 36, 26, 80 + side)
    for i in range(4):
        shard(B(name, "Ice_Light" if i == 1 else "Ice_Base", f"UpperArm_{suffix}"),
              (side * (.65 + i * .10), .05, 1.98),
              (side * (.73 + i * .15), .08 + .04 * i, 2.29 + .10 * (i % 2)),
              .075 + .018 * i, sides=7, twist=i * .35)

# Short arms, oversized mitten-like hands and three hooked claws per hand.
for side, suffix in ((-1, "L"), (1, "R")):
    loft(B(f"Arm_{suffix}", "Ice_Base", f"UpperArm_{suffix}"),
         (side * .91, 0, 1.34), (side * .78, 0, 1.83),
         .25, .27, .29, .30, sides=40, rings=28, seed=90 + side, bulge=.16)
    loft(B(f"Arm_{suffix}", "Ice_Base", f"LowerArm_{suffix}"),
         (side * 1.00, -.03, .94), (side * .91, 0, 1.37),
         .29, .30, .25, .27, sides=40, rings=26, seed=92 + side, bulge=.2)
    ellipsoid(B(f"Hand_{suffix}", "Ice_Base", f"Hand_{suffix}"),
              (side * 1.00, -.08, .82), (.32, .31, .31), 36, 26, 94 + side)
    for claw in range(3):
        x = side * (.80 + claw * .20)
        shard(B(f"Hand_{suffix}", "Ice_Light", f"Hand_{suffix}"),
              (x, -.23, .75), (x + side * .05, -.37, .47 + .05 * claw),
              .09, .075, sides=7, twist=claw * .2)
    for i in range(5):
        shard(B("Arm_Crystals", "Ice_Base", f"LowerArm_{suffix}"),
              (side * (.88 + .06 * i), .15, 1.05 + .10 * i),
              (side * (1.06 + .07 * i), .20, 1.18 + .16 * i),
              .055 + .009 * i, sides=6)
    glowing_crack(B("Arm_Crystals", "Ice_Emission", f"LowerArm_{suffix}"),
                  [(side * .93, -.31, 1.34), (side * .99, -.33, 1.20),
                   (side * .94, -.34, 1.05), (side * 1.02, -.32, .93)], .016)

# Squat legs and broad planted feet match the small enemy's low center of mass.
for side, suffix in ((-1, "L"), (1, "R")):
    loft(B(f"Leg_{suffix}", "Ice_Dark", f"UpperLeg_{suffix}"),
         (side * .41, .02, .66), (side * .36, .02, 1.18),
         .32, .31, .36, .34, sides=38, rings=28, seed=100 + side, bulge=.15)
    loft(B(f"Leg_{suffix}", "Ice_Base", f"LowerLeg_{suffix}"),
         (side * .43, 0, .26), (side * .41, .02, .70),
         .31, .34, .31, .31, sides=38, rings=26, seed=102 + side, bulge=.12)
    ellipsoid(B(f"Foot_{suffix}", "Ice_Base", f"Foot_{suffix}"),
              (side * .43, -.18, .20), (.43, .53, .22), 40, 28, 104 + side)
    for toe in range(3):
        x = side * (.20 + toe * .22)
        shard(B(f"Foot_{suffix}", "Ice_Light", f"Foot_{suffix}"),
              (x, -.52, .20), (x + side * .02, -.78, .05),
              .11, .095, sides=7, twist=toe * .17)
    for row in range(2):
        for col in range(2):
            plate(B("Leg_Crystals", "Ice_Base", f"LowerLeg_{suffix}"),
                  (side * (.30 + col * .23), -.34, .45 + row * .25),
                  .27, .28, .04, side * .14)
    glowing_crack(B("Leg_Crystals", "Ice_Emission", f"LowerLeg_{suffix}"),
                  [(side * .40, -.37, .72), (side * .46, -.39, .59),
                   (side * .39, -.40, .45), (side * .45, -.37, .31)], .015)

# Back crest and a small waist ruff repeat the head's crystalline rhythm.
for side in (-1, 1):
    for i in range(5):
        x = side * (.13 + i * .12)
        shard(B("Back_Crystals", "Ice_Base" if i % 2 else "Ice_Light"),
              (x, .45, 1.75 + .14 * i),
              (x + side * .08, .65, 2.17 + .20 * i),
              .075 + .012 * i, sides=7, twist=i * .28)
for i in range(15):
    a = 2 * math.pi * i / 15
    x, y = math.cos(a) * .55, math.sin(a) * .44
    shard(B("Waist_Armor", "Ice_Light" if i % 5 == 0 else "Ice_Base", "Pelvis"),
          (x, y, 1.02), (x * 1.10, y * 1.12, .76 - .06 * (i % 2)),
          .068, sides=6, twist=a)

# Central chest crystal and restrained branching cyan fissures.
shard(B("Chest_Core", "Ice_Emission"),
      (0, -.58, 1.72), (0, -.66, 1.28), .13, .085, sides=8)
for side in (-1, 1):
    glowing_crack(B("Chest_Core", "Ice_Emission"),
                  [(0, -.61, 1.72), (side * .16, -.62, 1.61),
                   (side * .29, -.59, 1.66), (side * .42, -.54, 1.54)], .016)


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
        ("Pelvis", "Root", (0, 0, .76), (0, 0, 1.10)),
        ("Spine", "Pelvis", (0, 0, 1.10), (0, 0, 1.48)),
        ("Chest", "Spine", (0, 0, 1.48), (0, 0, 1.88)),
        ("Neck", "Chest", (0, 0, 1.88), (0, 0, 2.14)),
        ("Head", "Neck", (0, 0, 2.14), (0, 0, 3.12)),
    ]
    for side, suffix in ((-1, "L"), (1, "R")):
        bones += [
            (f"UpperArm_{suffix}", "Chest",
             (side * .78, 0, 1.78), (side * .91, 0, 1.35)),
            (f"LowerArm_{suffix}", f"UpperArm_{suffix}",
             (side * .91, 0, 1.35), (side * 1.00, -.02, .93)),
            (f"Hand_{suffix}", f"LowerArm_{suffix}",
             (side * 1.00, -.02, .93), (side * 1.00, -.12, .67)),
            (f"UpperLeg_{suffix}", "Pelvis",
             (side * .36, 0, 1.10), (side * .41, 0, .66)),
            (f"LowerLeg_{suffix}", f"UpperLeg_{suffix}",
             (side * .41, 0, .66), (side * .43, 0, .28)),
            (f"Foot_{suffix}", f"LowerLeg_{suffix}",
             (side * .43, 0, .28), (side * .43, -.45, .12)),
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


def render_preview():
    """Render a deterministic beauty check without adding helpers to the GLB."""
    world = bpy.context.scene.world or bpy.data.worlds.new("Preview_World")
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (
        .012, .025, .045, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = .32

    bpy.ops.mesh.primitive_plane_add(size=16, location=(0, 0, -.025))
    ground = bpy.context.object
    ground.name = "Preview_Ground"
    ground_mat = material("Preview_Ground_Material", (.12, .28, .38), .58)
    ground.data.materials.append(ground_mat)

    def area(name, location, color, energy, size):
        data = bpy.data.lights.new(name, "AREA")
        data.color = color
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        obj.location = location
        direction = Vector((0, 0, 2.2)) - obj.location
        obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

    area("Preview_Key", (-4.5, -5.5, 7), (.72, .92, 1.0), 1250, 4.0)
    area("Preview_Fill", (4.5, -2.5, 4), (.28, .65, 1.0), 850, 3.0)
    area("Preview_Rim", (1.5, 4.0, 5.5), (.10, .48, 1.0), 1100, 3.0)

    camera_data = bpy.data.cameras.new("Preview_Camera")
    camera = bpy.data.objects.new("Preview_Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera_data.lens = 58
    bpy.context.scene.camera = camera

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    views = (
        ("front", (0, -9.6, 2.35)),
        ("3q", (5.9, -8.4, 3.8)),
        ("side", (9.6, 0, 2.35)),
    )
    for label, location in views:
        camera.location = location
        camera.rotation_euler = (
            Vector((0, 0, 2.15)) - camera.location
        ).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = str(OUT / f"ice_golem_preview_{label}.png")
        bpy.ops.render.render(write_still=True)
    shutil.copyfile(OUT / "ice_golem_preview_3q.png",
                    OUT / "ice_golem_preview.png")


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
            for polygon, smooth in zip(mesh.polygons, builder.face_smooth):
                polygon.material_index = 0 if smooth else 1
            bm = bmesh.new()
            bm.from_mesh(mesh)
            bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=1,
                                      use_grid_fill=True)
            bm.to_mesh(mesh)
            bm.free()
            mesh.update()
            builder.verts = [tuple(v.co) for v in mesh.vertices]
            builder.faces = [tuple(p.vertices) for p in mesh.polygons]
            builder.face_smooth = [p.material_index == 0 for p in mesh.polygons]
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
        verts, faces, face_materials, face_smooth, vertex_bones = [], [], [], [], []
        for builder in pieces:
            offset = len(verts)
            verts.extend(tuple(v * MODEL_SCALE for v in point)
                         for point in builder.verts)
            faces.extend(tuple(offset + i for i in face)
                         for face in builder.faces)
            face_materials.extend([material_indices[builder.mat]] * len(builder.faces))
            face_smooth.extend(builder.face_smooth)
            vertex_bones.extend([builder.bone] * len(builder.verts))

        mesh = bpy.data.meshes.new(category + "_Geometry")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        for name in material_names:
            mesh.materials.append(MATS[name])
        smooth_parts = {
            "Body", "Head", "Arm_L", "Arm_R", "Hand_L", "Hand_R",
            "Leg_L", "Leg_R", "Foot_L", "Foot_R",
        }
        for polygon, material_index, smooth in zip(
                mesh.polygons, face_materials, face_smooth):
            polygon.material_index = material_index
            polygon.use_smooth = category in smooth_parts and smooth
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
                if z < 1.0:
                    weights = (("Pelvis", 1.0),)
                elif z < 1.3:
                    t = round((z - 1.0) / .30, 2)
                    weights = (("Pelvis", 1 - t), ("Spine", t))
                elif z < 1.55:
                    weights = (("Spine", 1.0),)
                elif z < 1.82:
                    t = round((z - 1.55) / .27, 2)
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
        use_selection=True, export_apply=True, export_skins=True,
        export_yup=True, export_normals=True, export_texcoords=True,
        export_materials="EXPORT", export_extras=False,
        export_animations=False,
    )
    game_asset = OUT / "client" / "public" / "assets" / "models"
    if game_asset.is_dir():
        shutil.copyfile(OUT / "ice_golem.glb", game_asset / "ice_golem_weak.glb")
    render_preview()
    print(f"ICE_GOLEM_STATS vertices={sum(len(o.data.vertices) for o in meshes)} "
          f"faces={sum(len(o.data.polygons) for o in meshes)} "
          f"triangles={tris()} meshes={len(meshes)} "
          f"glb_bytes={(OUT / 'ice_golem.glb').stat().st_size}")


if __name__ == "__main__":
    main()
