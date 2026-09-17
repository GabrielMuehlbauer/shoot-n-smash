"""Generate the rock-armored crystal Ice Golem used as enemy type 3.

Run with: blender --background --python generate_ice_golem_resistant.py

The model deliberately keeps the same 4.5-unit scale and skeleton layout as the
other golems, while using a distinct silhouette: a small crowned head, enormous
crystal forearms, overlapping rock/ice armor and emissive cyan seams.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent
sys.path.insert(0, str(OUT))

import generate_ice_golem_medium as shared

base = shared.base
base.builders.clear()
base.rng.seed(base.SEED + 303)

shared.OUTPUT_STEM = "ice_golem_resistant"
shared.STATS_LABEL = "ICE_GOLEM_RESISTANT_STATS"
shared.MIN_TRIANGLES = 102000
shared.MAX_TRIANGLES = 118000

B = base.B
ellipsoid = base.ellipsoid
loft = base.loft
plate = base.plate
shard = base.shard
glowing_crack = base.glowing_crack


# Dense, dark stone under-body. The pale ice pieces below overlap it like armor
# instead of reading as a collection of disconnected primitive spheres.
loft(B("Body", "Ice_Dark"), (0, .08, 1.48), (0, .08, 3.20),
     .67, .45, .96, .57, sides=64, rings=48, seed=300, bulge=.10)
ellipsoid(B("Body", "Ice_Dark", "Chest"), (0, .08, 2.58),
          (1.03, .56, .86), 56, 38, 301)

# Interlocking heart-shaped chest armor, abdominal boulders and side plates.
for side in (-1, 1):
    ellipsoid(B("Body", "Ice_Light", "Chest"),
              (side * .47, -.48, 2.86), (.56, .22, .53), 48, 32, 303 + side)
    plate(B("Body", "Ice_Base", "Chest"),
          (side * .34, -.655, 2.78), .55, .63, .055, side * .10)
    for row in range(3):
        ellipsoid(B("Body", "Ice_Dark", "Spine" if row else "Pelvis"),
                  (side * (.23 + .09 * (row == 0)), -.48, 1.86 + row * .34),
                  (.31, .18, .25), 30, 20, 310 + row * 3 + side)
        plate(B("Body", "Ice_Base", "Spine" if row else "Pelvis"),
              (side * (.30 + .04 * row), -.625, 1.86 + row * .35),
              .31, .32, .045, side * (.10 + row * .03))

# Small aggressive helmeted head, faceted mask and a dominant crown crystal.
ellipsoid(B("Head", "Ice_Dark", "Head"), (0, -.02, 3.43),
          (.43, .37, .43), 44, 30, 320)
plate(B("Head", "Ice_Base", "Head"), (0, -.37, 3.47), .64, .50, .06)
for side in (-1, 1):
    plate(B("Head", "Ice_Light", "Head"),
          (side * .20, -.425, 3.57), .30, .24, .035, side * .13)
    ellipsoid(B("Head", "Ice_Emission", "Head"),
              (side * .17, -.465, 3.48), (.115, .040, .066), 22, 14, 322 + side)
    shard(B("Head", "Ice_Dark", "Head"),
          (side * .03, -.44, 3.70), (side * .35, -.46, 3.61),
          .075, .05, sides=7, twist=side * .22)
shard(B("Head", "Ice_Light", "Head"),
      (0, -.03, 3.69), (0, -.01, 4.48), .25, .18, sides=9, twist=.13)
for side in (-1, 1):
    shard(B("Head", "Ice_Base", "Head"),
          (side * .11, -.02, 3.72), (side * .29, -.01, 4.14),
          .13, .09, sides=8, twist=side * .28)

# Angular jaw/beard guard, ending in a broad central diamond.
for side in (-1, 1):
    for i in range(3):
        x = side * (.09 + i * .11)
        shard(B("Beard", "Ice_Base" if i else "Ice_Light", "Head"),
              (x, -.38, 3.31), (x * 1.06, -.48, 3.05 - .05 * i),
              .085 + .012 * i, .06, sides=7, twist=side * i * .17)
shard(B("Beard", "Ice_Light", "Head"),
      (0, -.41, 3.33), (0, -.50, 2.94), .17, .11, sides=8, twist=.18)

# The reference has a crystalline crown instead of animal horns. These named
# rig parts are represented by swept side fins so the public hierarchy remains
# compatible with the other two characters.
for side, name in ((-1, "Horn_L"), (1, "Horn_R")):
    shard(B(name, "Ice_Base", "Head"),
          (side * .29, .00, 3.66), (side * .63, .10, 4.12),
          .13, .09, sides=8, twist=side * .34)
    shard(B(name, "Ice_Light", "Head"),
          (side * .39, .05, 3.76), (side * .76, .13, 3.94),
          .09, .06, sides=7, twist=side * .21)

# Boulder shoulders capped by tall translucent ice blades.
for side, name, suffix in ((-1, "Shoulder_L", "L"), (1, "Shoulder_R", "R")):
    ellipsoid(B(name, "Ice_Dark", f"UpperArm_{suffix}"),
              (side * 1.00, .04, 2.91), (.59, .49, .58), 46, 30, 335 + side)
    ellipsoid(B(name, "Ice_Base", f"UpperArm_{suffix}"),
              (side * 1.10, -.20, 2.83), (.48, .25, .43), 36, 24, 338 + side)
    shoulder_blades = [
        (.73, 3.12, .56, .13), (.94, 3.22, .77, .17),
        (1.17, 3.17, .67, .15), (1.37, 3.01, .49, .12),
    ]
    for i, (x, z, height, width) in enumerate(shoulder_blades):
        shard(B(name, "Ice_Light" if i in (0, 2) else "Ice_Base",
                f"UpperArm_{suffix}"),
              (side * x, .10 + .025 * i, z),
              (side * (x + .10 + .035 * i), .15, z + height),
              width, width * .70, sides=8, twist=side * i * .25)

# Arms are assembled from rock muscle masses with continuous ice plating.
for side, suffix in ((-1, "L"), (1, "R")):
    loft(B(f"Arm_{suffix}", "Ice_Dark", f"UpperArm_{suffix}"),
         (side * 1.26, .03, 2.12), (side * 1.06, .03, 2.90),
         .43, .40, .47, .43, sides=46, rings=34, seed=345 + side, bulge=.17)
    for i, (dx, dz, scale) in enumerate(((-.05, .08, .24), (.13, -.18, .28),
                                          (-.10, -.42, .25))):
        ellipsoid(B(f"Arm_{suffix}", "Ice_Base", f"UpperArm_{suffix}"),
                  (side * (1.16 + dx), -.30, 2.62 + dz),
                  (scale, .17, scale * 1.10), 30, 20, 350 + i + side)
    loft(B(f"Arm_{suffix}", "Ice_Dark", f"LowerArm_{suffix}"),
         (side * 1.48, -.02, 1.26), (side * 1.26, .02, 2.14),
         .48, .44, .39, .38, sides=48, rings=36, seed=356 + side, bulge=.18)
    # The forearm gauntlet is the main silhouette cue in the reference.
    for i in range(9):
        t = i / 8
        angle = -.85 + i * .22
        x = 1.34 + .18 * t + .11 * math.cos(angle)
        y = -.04 + .22 * math.sin(angle)
        z = 1.38 + .56 * t
        shard(B("Arm_Crystals", "Ice_Light" if i in (1, 5, 8) else "Ice_Base",
                f"LowerArm_{suffix}"),
              (side * x, y, z),
              (side * (x + .29 + .14 * t), y - .03, z + .34 + .24 * (i % 3)),
              .13 + .022 * (i % 3), sides=8, twist=side * i * .29)
    glowing_crack(B("Arm_Crystals", "Ice_Emission", f"LowerArm_{suffix}"),
                  [(side * 1.28, -.43, 2.09), (side * 1.36, -.46, 1.91),
                   (side * 1.31, -.48, 1.73), (side * 1.46, -.45, 1.50),
                   (side * 1.42, -.43, 1.31)], .021)

    # Huge hands built from palm stone and individually plated knuckles.
    ellipsoid(B(f"Hand_{suffix}", "Ice_Dark", f"Hand_{suffix}"),
              (side * 1.52, -.08, 1.07), (.47, .43, .43), 42, 28, 365 + side)
    for finger in range(3):
        x = 1.31 + finger * .20
        ellipsoid(B(f"Hand_{suffix}", "Ice_Base", f"Hand_{suffix}"),
                  (side * x, -.39, 1.08 + .04 * (finger == 1)),
                  (.16, .18, .17), 24, 16, 370 + finger + side)
        shard(B(f"Hand_{suffix}", "Ice_Light", f"Hand_{suffix}"),
              (side * x, -.48, 1.02),
              (side * (x + .02), -.69, .80 + .04 * finger),
              .105, .085, sides=7, twist=side * finger * .22)

# Massive legs alternate dark boulders with pale ice armor.
for side, suffix in ((-1, "L"), (1, "R")):
    loft(B(f"Leg_{suffix}", "Ice_Dark", f"UpperLeg_{suffix}"),
         (side * .54, .04, .88), (side * .48, .04, 1.88),
         .46, .42, .49, .44, sides=46, rings=34, seed=380 + side, bulge=.14)
    for i in range(4):
        ellipsoid(B(f"Leg_{suffix}", "Ice_Base" if i % 2 == 0 else "Ice_Dark",
                    f"UpperLeg_{suffix}"),
                  (side * (.46 + .08 * (i % 2)), -.35, 1.13 + i * .23),
                  (.28, .18, .27), 28, 18, 385 + i + side)
    loft(B(f"Leg_{suffix}", "Ice_Dark", f"LowerLeg_{suffix}"),
         (side * .57, .02, .27), (side * .54, .03, .98),
         .43, .42, .40, .39, sides=46, rings=32, seed=391 + side, bulge=.12)
    for i in range(6):
        t = i / 5
        shard(B("Leg_Crystals", "Ice_Light" if i in (0, 3) else "Ice_Base",
                f"LowerLeg_{suffix}"),
              (side * (.37 + .08 * i), -.04 + .10 * (i % 2), .42 + .09 * i),
              (side * (.42 + .11 * i), .02, .88 + .17 * (i % 3) + .22 * t),
              .11 + .016 * (i % 3), sides=8, twist=side * i * .24)
    glowing_crack(B("Leg_Crystals", "Ice_Emission", f"LowerLeg_{suffix}"),
                  [(side * .51, -.43, .96), (side * .45, -.45, .80),
                   (side * .59, -.45, .64), (side * .52, -.43, .47),
                   (side * .60, -.40, .31)], .020)
    ellipsoid(B(f"Foot_{suffix}", "Ice_Dark", f"Foot_{suffix}"),
              (side * .56, -.18, .21), (.55, .62, .25), 44, 28, 400 + side)
    for toe in range(3):
        x = .29 + toe * .27
        ellipsoid(B(f"Foot_{suffix}", "Ice_Base", f"Foot_{suffix}"),
                  (side * x, -.54, .19), (.20, .25, .17), 24, 16, 404 + toe + side)
        shard(B(f"Foot_{suffix}", "Ice_Light", f"Foot_{suffix}"),
              (side * x, -.62, .20), (side * (x + .01), -.86, .04),
              .12, .10, sides=7, twist=side * toe * .16)

# A jagged back skyline gives the creature a readable outline from VR angles.
for side in (-1, 1):
    back_data = [(.26, 3.11, .72), (.46, 3.05, .53), (.68, 2.98, .83),
                 (.91, 2.82, .64), (1.12, 2.62, .76), (1.29, 2.43, .52)]
    for i, (x, z, height) in enumerate(back_data):
        shard(B("Back_Crystals", "Ice_Light" if i in (0, 3) else "Ice_Base"),
              (side * x, .38 + .025 * (i % 2), z),
              (side * (x + .08 + .025 * i), .51, z + height),
              .12 + .018 * (i % 3), sides=8, twist=side * i * .31)

# Layered waist armor and a cyan core framed by a large downward ice diamond.
for i in range(14):
    a = 2 * math.pi * i / 14
    x, y = math.cos(a) * .70, math.sin(a) * .48
    mat = "Ice_Dark" if i % 3 else "Ice_Base"
    plate(B("Waist_Armor", mat, "Pelvis"),
          (x, y, 1.62), .29, .30, .06, math.sin(a) * .10,
          normal=(math.cos(a), math.sin(a), 0))
for side in (-1, 1):
    shard(B("Waist_Armor", "Ice_Base", "Pelvis"),
          (side * .20, -.57, 1.70), (side * .27, -.66, 1.15),
          .18, .11, sides=8, twist=side * .18)
shard(B("Waist_Armor", "Ice_Light", "Pelvis"),
      (0, -.61, 1.76), (0, -.72, 1.02), .25, .15, sides=9, twist=.10)
shard(B("Chest_Core", "Ice_Emission", "Chest"),
      (0, -.675, 2.73), (0, -.72, 2.30), .105, .065, sides=8)
for side in (-1, 1):
    glowing_crack(B("Chest_Core", "Ice_Emission", "Chest"),
                  [(0, -.67, 2.76), (side * .17, -.68, 2.64),
                   (side * .38, -.65, 2.70), (side * .62, -.58, 2.54),
                   (side * .79, -.50, 2.62)], .021)
    glowing_crack(B("Chest_Core", "Ice_Emission", "Spine"),
                  [(0, -.65, 2.33), (side * .13, -.66, 2.18),
                   (side * .08, -.65, 2.00)], .017)


if __name__ == "__main__":
    shared.main()
