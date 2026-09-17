"""Generate the muscular, crystal-armored Ice Golem used as enemy type 2.

Run with: blender --background --python generate_ice_golem_medium.py
The shared mesh helpers and glTF-safe materials live in generate_ice_golem.py.
"""

from __future__ import annotations

import math
import shutil
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parent
sys.path.insert(0, str(OUT))

import generate_ice_golem as base

OUTPUT_STEM = "ice_golem_medium"
STATS_LABEL = "ICE_GOLEM_MEDIUM_STATS"
MIN_TRIANGLES = 82000
MAX_TRIANGLES = 98000
SMOOTH_PARTS = {
    "Body", "Head", "Arm_L", "Arm_R", "Hand_L", "Hand_R",
    "Leg_L", "Leg_R", "Foot_L", "Foot_R",
}
base.builders.clear()
base.rng.seed(base.SEED + 202)

B = base.B
ellipsoid = base.ellipsoid
loft = base.loft
plate = base.plate
armor_plate = base.armor_plate
shard = base.shard
curved_horn = base.curved_horn
glowing_crack = base.glowing_crack


# Wide inverted-triangle torso with a continuous ribcage and shallow armor.
loft(B("Body", "Ice_Dark"), (0, .05, 1.55), (0, .05, 3.18),
     .66, .36, .94, .44, sides=64, rings=50, seed=120, bulge=.10)
loft(B("Body"), (0, .04, 1.72), (0, .04, 3.17),
     .62, .32, .98, .42, sides=64, rings=46, seed=121, bulge=.08)
for side in (-1, 1):
    armor_plate(B("Body", "Ice_Base", "Chest"),
                (side * .43, -.39, 2.87), .96, .72, .10, side * .09)
    armor_plate(B("Body", "Ice_Light", "Chest"),
                (side * .46, -.47, 3.02), .70, .34, .050, side * .16)
    armor_plate(B("Body", "Ice_Light", "Chest"),
                (side * .36, -.465, 2.73), .52, .27, .043, side * .08)
    for row in range(3):
        ellipsoid(B("Body", "Ice_Base", "Spine" if row > 1 else "Pelvis"),
                  (side * .23, -.39, 1.93 + row * .32),
                  (.28, .10, .23), 26, 18, 126 + row + side)
    for i in range(3):
        plate(B("Body", "Ice_Base", "Chest"),
              (side * (.22 + i * .22), -.49, 3.10 - .11 * i),
              .27, .28, .034, side * (.13 + i * .02))
# A narrow inset between the two slabs houses the core and keeps the sternum deep.
armor_plate(B("Body", "Ice_Dark", "Chest"),
            (0, -.435, 2.77), .16, .73, .025, .0)

# Compact aggressive head, glowing eyes, heavy brows and ice-fang mouth.
ellipsoid(B("Head", "Ice_Base", "Head"), (0, -.02, 3.45),
          (.52, .43, .50), 48, 34, 135)
for side in (-1, 1):
    plate(B("Head", "Ice_Light", "Head"),
          (side * .21, -.405, 3.50), .34, .28, .04, side * .12)
    plate(B("Head", "Ice_Dark", "Head"),
          (side * .18, -.438, 3.51), .29, .17, .022, side * .18)
    ellipsoid(B("Head", "Ice_Emission", "Head"),
              (side * .18, -.468, 3.51), (.105, .025, .065), 24, 16, 138 + side)
    shard(B("Head", "Ice_Base", "Head"),
          (side * .03, -.47, 3.70), (side * .39, -.48, 3.61),
          .08, .055, sides=7, twist=side * .2)
plate(B("Head", "Ice_Dark", "Head"), (0, -.435, 3.28), .42, .14, .035)
for side in (-1, 1):
    shard(B("Head", "Ice_Light", "Head"),
          (side * .16, -.48, 3.31), (side * .18, -.52, 3.10),
          .055, .042, sides=6)

# Layered beard is broad at the cheeks and ends in one central diamond shard.
for row in range(3):
    count = 9 - row * 2
    for i in range(count):
        x = (i - (count - 1) / 2) * .09
        length = .17 + row * .09 + .10 * (1 - abs(x) / .45)
        shard(B("Beard", "Ice_Light" if (i + row) % 3 == 0 else "Ice_Base", "Head"),
              (x, -.40 - row * .025, 3.28 - row * .12),
              (x * 1.03, -.49, 3.28 - row * .12 - length),
              .064 + row * .008, sides=7, twist=i * .24)

# Swept segmented horns reproduce the reference's upright crescent silhouette.
for side, name in ((-1, "Horn_L"), (1, "Horn_R")):
    path = [(side * (.29 + .35 * math.sin(t * math.pi * .72)),
             -.01 + .07 * math.sin(t * math.pi),
             3.72 + .72 * t + .13 * math.sin(t * math.pi))
            for t in (i / 22 for i in range(23))]
    curved_horn(B(name, "Ice_Base", "Head"), path,
                [.145 * (1 - i / 23) ** 1.08 + .008 for i in range(23)], 14)
    for j in range(3):
        plate(B(name, "Ice_Light", "Head"),
              (side * (.35 + j * .10), -.12, 3.88 + j * .18),
              .16, .19, .028, side * .15)
for x in (-.22, 0, .22):
    shard(B("Head", "Ice_Light", "Head"),
          (x, .05, 3.77), (x * 1.08, .08, 4.15 + .12 * (x == 0)),
          .095, sides=8)

# Massive shoulders carry a small number of large, asymmetric crystal blades.
for side, name, suffix in ((-1, "Shoulder_L", "L"), (1, "Shoulder_R", "R")):
    ellipsoid(B(name, "Ice_Base", f"UpperArm_{suffix}"),
              (side * 1.03, .02, 2.85), (.52, .45, .55), 44, 30, 150 + side)
    crystal_data = [(.76, 3.04, .47), (.97, 3.15, .70), (1.18, 3.04, .58),
                    (1.35, 2.87, .43)]
    for i, (x, z, height) in enumerate(crystal_data):
        height += .05 if side > 0 and i == 1 else -.025 if side < 0 and i == 3 else 0
        shard(B(name, "Ice_Light" if i in (0, 2) else "Ice_Base",
                f"UpperArm_{suffix}"),
              (side * x, .10 + .04 * i, z),
              (side * (x + .12 + .04 * i), .15, z + height),
              .13 + .018 * i, sides=8, twist=i * .27)

# Long heavy arms, crystal gauntlets and clenched three-knuckle fists.
for side, suffix in ((-1, "L"), (1, "R")):
    loft(B(f"Arm_{suffix}", "Ice_Base", f"UpperArm_{suffix}"),
         (side * 1.28, .02, 2.15), (side * 1.03, .02, 2.91),
         .39, .38, .42, .40, sides=46, rings=34, seed=160 + side, bulge=.20)
    loft(B(f"Arm_{suffix}", "Ice_Dark", f"LowerArm_{suffix}"),
         (side * 1.48, -.02, 1.35), (side * 1.28, .02, 2.19),
         .43, .40, .37, .36, sides=46, rings=34, seed=163 + side, bulge=.22)
    for i in range(7):
        t = i / 6
        shard(B("Arm_Crystals", "Ice_Light" if i in (1, 5) else "Ice_Base",
                f"LowerArm_{suffix}"),
              (side * (1.28 + .28 * t), .06 + .10 * math.sin(i), 1.48 + .53 * t),
              (side * (1.62 + .22 * t), .12, 1.67 + .78 * t),
              .10 + .025 * (i % 3), sides=7, twist=i * .31)
    ellipsoid(B(f"Hand_{suffix}", "Ice_Base", f"Hand_{suffix}"),
              (side * 1.52, -.08, 1.12), (.43, .40, .39), 40, 28, 166 + side)
    for finger in range(3):
        x = side * (1.31 + finger * .20)
        shard(B(f"Hand_{suffix}", "Ice_Light", f"Hand_{suffix}"),
              (x, -.35, 1.10), (x + side * .03, -.52, .88 + .04 * finger),
              .105, .09, sides=7, twist=finger * .22)
    glowing_crack(B("Arm_Crystals", "Ice_Emission", f"LowerArm_{suffix}"),
                  [(side * 1.31, -.42, 2.12), (side * 1.39, -.44, 1.91),
                   (side * 1.34, -.45, 1.70), (side * 1.47, -.41, 1.49)], .017)

# Thick legs, plated shins, broad feet and crystal toes.
for side, suffix in ((-1, "L"), (1, "R")):
    loft(B(f"Leg_{suffix}", "Ice_Dark", f"UpperLeg_{suffix}"),
         (side * .53, .02, .92), (side * .48, .02, 1.90),
         .43, .40, .47, .42, sides=44, rings=34, seed=175 + side, bulge=.16)
    loft(B(f"Leg_{suffix}", "Ice_Base", f"LowerLeg_{suffix}"),
         (side * .56, 0, .28), (side * .54, .02, .98),
         .40, .42, .38, .38, sides=44, rings=32, seed=178 + side, bulge=.14)
    for i in range(5):
        shard(B("Leg_Crystals", "Ice_Light" if i == 2 else "Ice_Base",
                f"LowerLeg_{suffix}"),
              (side * (.36 + i * .10), -.05 + .10 * (i % 2), .66 + .07 * i),
              (side * (.39 + i * .13), .03, 1.14 + .14 * (i % 3)),
              .09 + .012 * i, sides=7, twist=i * .25)
    ellipsoid(B(f"Foot_{suffix}", "Ice_Base", f"Foot_{suffix}"),
              (side * .55, -.19, .21), (.52, .60, .24), 42, 28, 182 + side)
    for toe in range(3):
        x = side * (.28 + toe * .27)
        shard(B(f"Foot_{suffix}", "Ice_Light", f"Foot_{suffix}"),
              (x, -.56, .22), (x + side * .015, -.84, .035),
              .13, .11, sides=7, twist=toe * .19)
    glowing_crack(B("Leg_Crystals", "Ice_Emission", f"LowerLeg_{suffix}"),
                  [(side * .53, -.43, .89), (side * .47, -.44, .72),
                   (side * .58, -.43, .53), (side * .54, -.40, .34)], .016)

# Back skyline, dark belt and the large central waist crystal.
for side in (-1, 1):
    for i in range(7):
        x = side * (.35 + i * .13)
        height = .36 + .16 * (i % 3) + .10 * (i == 3)
        shard(B("Back_Crystals", "Ice_Light" if i in (1, 4) else "Ice_Base"),
              (x, .39 + .04 * (i % 2), 2.56 + .06 * i),
              (x + side * (.10 + .03 * i), .49, 2.78 + height),
              .11 + .018 * (i % 3), sides=8, twist=i * .29)
for i in range(14):
    a = 2 * math.pi * i / 14
    x, y = math.cos(a) * .70, math.sin(a) * .50
    plate(B("Waist_Armor", "Ice_Dark", "Pelvis"),
          (x, y, 1.67), .30, .31, .06, math.sin(a) * .12,
          normal=(math.cos(a), math.sin(a), 0))
shard(B("Waist_Armor", "Ice_Emission", "Pelvis"),
      (0, -.68, 1.82), (0, -.78, 1.06), .23, .15, sides=8)

# Chest core and restrained branching fissures keep the face as the focal point.
shard(B("Chest_Core", "Ice_Emission", "Chest"),
      (0, -.535, 2.66), (0, -.575, 2.30), .115, .08, sides=8)
for side in (-1, 1):
    glowing_crack(B("Chest_Core", "Ice_Emission", "Chest"),
                  [(0, -.555, 2.68), (side * .18, -.56, 2.57),
                   (side * .39, -.55, 2.62), (side * .61, -.50, 2.48)], .017)


def make_rig(root):
    arm_data = bpy.data.armatures.new("IceGolemMedium_Skeleton")
    arm = bpy.data.objects.new("IceGolem_Armature", arm_data)
    bpy.context.collection.objects.link(arm)
    arm.parent = root
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bones = [
        ("Root", None, (0, 0, 0), (0, 0, .3)),
        ("Pelvis", "Root", (0, 0, 1.55), (0, 0, 1.92)),
        ("Spine", "Pelvis", (0, 0, 1.92), (0, 0, 2.47)),
        ("Chest", "Spine", (0, 0, 2.47), (0, 0, 3.12)),
        ("Neck", "Chest", (0, 0, 3.12), (0, 0, 3.30)),
        ("Head", "Neck", (0, 0, 3.30), (0, 0, 3.78)),
    ]
    for side, suffix in ((-1, "L"), (1, "R")):
        bones += [
            (f"UpperArm_{suffix}", "Chest",
             (side * 1.03, 0, 2.88), (side * 1.28, 0, 2.17)),
            (f"LowerArm_{suffix}", f"UpperArm_{suffix}",
             (side * 1.28, 0, 2.17), (side * 1.48, 0, 1.36)),
            (f"Hand_{suffix}", f"LowerArm_{suffix}",
             (side * 1.48, 0, 1.36), (side * 1.53, -.12, 1.02)),
            (f"UpperLeg_{suffix}", "Pelvis",
             (side * .48, 0, 1.78), (side * .53, 0, .94)),
            (f"LowerLeg_{suffix}", f"UpperLeg_{suffix}",
             (side * .53, 0, .94), (side * .56, 0, .30)),
            (f"Foot_{suffix}", f"LowerLeg_{suffix}",
             (side * .56, 0, .30), (side * .56, -.48, .12)),
        ]
    for name, parent, head, tail in bones:
        bone = arm_data.edit_bones.new(name)
        bone.head = tuple(v * base.MODEL_SCALE for v in head)
        bone.tail = tuple(v * base.MODEL_SCALE for v in tail)
        if parent:
            bone.parent = arm_data.edit_bones[parent]
        bone.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    arm.select_set(False)
    return arm


def render_preview():
    world = bpy.context.scene.world or bpy.data.worlds.new("Medium_Preview_World")
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (.012, .025, .045, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = .34
    bpy.ops.mesh.primitive_plane_add(size=18, location=(0, 0, -.025))
    ground = bpy.context.object
    ground.data.materials.append(base.material("Medium_Preview_Ground", (.12, .27, .37), .6))

    def area(name, location, color, energy, size):
        data = bpy.data.lights.new(name, "AREA")
        data.color, data.energy, data.shape, data.size = color, energy, "DISK", size
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        obj.location = location
        obj.rotation_euler = (Vector((0, 0, 2.3)) - obj.location).to_track_quat("-Z", "Y").to_euler()

    area("Medium_Key", (-4.5, -5.5, 7), (.75, .93, 1.0), 1300, 4)
    area("Medium_Fill", (4.5, -3, 4), (.30, .68, 1.0), 800, 3)
    area("Medium_Rim", (1.5, 4, 5.5), (.10, .48, 1.0), 1100, 3)
    camera_data = bpy.data.cameras.new("Medium_Preview_Camera")
    camera = bpy.data.objects.new("Medium_Preview_Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera_data.lens = 62
    scene = bpy.context.scene
    scene.camera = camera
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "AgX - Medium High Contrast"
    views = (
        ("front", (0, -10.2, 2.45)),
        ("3q", (5.4, -9.5, 4.0)),
        ("side", (10.2, 0, 2.45)),
    )
    for label, location in views:
        camera.location = location
        camera.rotation_euler = (
            Vector((0, 0, 2.2)) - camera.location
        ).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = str(OUT / f"{OUTPUT_STEM}_preview_{label}.png")
        bpy.ops.render.render(write_still=True)
    shutil.copyfile(OUT / f"{OUTPUT_STEM}_preview_3q.png",
                    OUT / f"{OUTPUT_STEM}_preview.png")


def main():
    base.MODEL_SCALE = 4.5 / max(
        point[2] for builder in base.builders.values() for point in builder.verts)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    root = bpy.data.objects.new("IceGolem_Root", None)
    bpy.context.collection.objects.link(root)
    arm = make_rig(root)

    def tris():
        return sum(builder.triangles for builder in base.builders.values())

    for category in ("Body", "Shoulder_L", "Shoulder_R", "Leg_L", "Leg_R"):
        if tris() >= MIN_TRIANGLES:
            break
        candidates = [b for b in base.builders.values()
                      if b.category == category and b.mat == "Ice_Base"]
        for builder in candidates:
            gain = builder.triangles * 3
            if tris() + gain > MAX_TRIANGLES:
                continue
            mesh = bpy.data.meshes.new("Temporary_Medium_Refinement")
            mesh.from_pydata(builder.verts, [], builder.faces)
            mesh.update()
            for polygon, smooth in zip(mesh.polygons, builder.face_smooth):
                polygon.material_index = 0 if smooth else 1
            bm = bmesh.new()
            bm.from_mesh(mesh)
            bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=1, use_grid_fill=True)
            bm.to_mesh(mesh)
            bm.free()
            builder.verts = [tuple(v.co) for v in mesh.vertices]
            builder.faces = [tuple(p.vertices) for p in mesh.polygons]
            builder.face_smooth = [p.material_index == 0 for p in mesh.polygons]
            bpy.data.meshes.remove(mesh)

    meshes = []
    smooth_parts = SMOOTH_PARTS
    for category in base.PARTS:
        pieces = [b for b in base.builders.values() if b.category == category and b.faces]
        if not pieces:
            raise RuntimeError(f"Peça sem geometria: {category}")
        material_names = [name for name in base.MATS if any(b.mat == name for b in pieces)]
        material_indices = {name: i for i, name in enumerate(material_names)}
        verts, faces, face_materials, face_smooth, vertex_bones = [], [], [], [], []
        for builder in pieces:
            offset = len(verts)
            verts.extend(tuple(v * base.MODEL_SCALE for v in point) for point in builder.verts)
            faces.extend(tuple(offset + i for i in face) for face in builder.faces)
            face_materials.extend([material_indices[builder.mat]] * len(builder.faces))
            face_smooth.extend(builder.face_smooth)
            vertex_bones.extend([builder.bone] * len(builder.verts))
        mesh = bpy.data.meshes.new(category + "_Geometry")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        for name in material_names:
            mesh.materials.append(base.MATS[name])
        for polygon, material_index, smooth in zip(
                mesh.polygons, face_materials, face_smooth):
            polygon.material_index = material_index
            polygon.use_smooth = category in smooth_parts and smooth
        obj = bpy.data.objects.new(category, mesh)
        bpy.context.collection.objects.link(obj)
        obj.parent = arm
        obj.modifiers.new("Skin", "ARMATURE").object = arm
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(mesh)
        bm.free()
        uv = mesh.uv_layers.new(name="Ice_UV")
        for polygon in mesh.polygons:
            for loop_index in polygon.loop_indices:
                vertex = mesh.vertices[mesh.loops[loop_index].vertex_index].co
                uv.data[loop_index].uv = (vertex.x * .22 + .5, vertex.z * .22)
        weight_batches = {}
        for vertex, bone in zip(mesh.vertices, vertex_bones):
            if category == "Body":
                z = vertex.co.z / base.MODEL_SCALE
                if z < 1.85:
                    weights = (("Pelvis", 1.0),)
                elif z < 2.20:
                    t = round((z - 1.85) / .35, 2)
                    weights = (("Pelvis", 1 - t), ("Spine", t))
                elif z < 2.52:
                    weights = (("Spine", 1.0),)
                elif z < 2.82:
                    t = round((z - 2.52) / .30, 2)
                    weights = (("Spine", 1 - t), ("Chest", t))
                else:
                    weights = (("Chest", 1.0),)
            else:
                weights = ((bone, 1.0),)
            for name, weight in weights:
                if weight > 0:
                    weight_batches.setdefault((name, weight), []).append(vertex.index)
        groups = {name: obj.vertex_groups.new(name=name)
                  for name in {bone_name for bone_name, _ in weight_batches}}
        for (name, weight), indices in weight_batches.items():
            groups[name].add(indices, weight, "REPLACE")
        meshes.append(obj)

    for obj in meshes:
        obj.select_set(True)
    root.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / f"{OUTPUT_STEM}.blend"))
    bpy.ops.export_scene.gltf(
        filepath=str(OUT / f"{OUTPUT_STEM}.glb"), export_format="GLB",
        use_selection=True, export_apply=True, export_skins=True,
        export_yup=True, export_normals=True, export_texcoords=True,
        export_materials="EXPORT", export_extras=False, export_animations=False,
    )
    game_assets = OUT / "client" / "public" / "assets" / "models"
    if game_assets.is_dir():
        shutil.copyfile(OUT / f"{OUTPUT_STEM}.glb", game_assets / f"{OUTPUT_STEM}.glb")
    render_preview()
    print(f"{STATS_LABEL} vertices={sum(len(o.data.vertices) for o in meshes)} "
          f"faces={sum(len(o.data.polygons) for o in meshes)} triangles={tris()} "
          f"meshes={len(meshes)} glb_bytes={(OUT / f'{OUTPUT_STEM}.glb').stat().st_size}")


if __name__ == "__main__":
    main()
