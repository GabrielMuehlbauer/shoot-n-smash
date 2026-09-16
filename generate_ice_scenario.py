"""Generate a stylized, game-ready frozen boss arena and export it as GLB.

Run with:
    blender --background --python generate_ice_scenario.py

The script is deterministic, self-contained, and writes every output next to itself.
"""

import bpy
import json
import math
import os
import random
from mathutils import Vector


SEED = 732451
random.seed(SEED)
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BLEND_PATH = os.path.join(ROOT_DIR, "ice_scenario.blend")
GLB_PATH = os.path.join(ROOT_DIR, "ice_scenario.glb")
PREVIEW_PATH = os.path.join(ROOT_DIR, "ice_scenario_preview.png")
REPORT_PATH = os.path.join(ROOT_DIR, "ice_scenario_report.json")


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials,
                       bpy.data.cameras, bpy.data.lights, bpy.data.collections):
        for datablock in list(datablocks):
            if getattr(datablock, "users", 0) == 0:
                datablocks.remove(datablock)


def collection(name):
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    return coll


def link_object(obj, coll):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    coll.objects.link(obj)


def exportable(obj):
    obj["export_glb"] = True
    return obj


def group_empty(name, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 1.0
    obj.parent = parent
    return exportable(obj)


def make_material(name, color, roughness, metallic=0.0, emission=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color[:3], color[3] if len(color) > 3 else 1.0)
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = mat.diffuse_color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    emission_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
    strength_input = bsdf.inputs.get("Emission Strength")
    if emission and emission_input:
        emission_input.default_value = (*emission[:3], 1.0)
    if emission and strength_input:
        strength_input.default_value = emission_strength
    return mat


def add_mesh_object(name, verts, faces, materials, coll, parent=None, material_indices=None):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update(calc_edges=True)
    for mat in materials:
        mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    coll.objects.link(obj)
    obj.parent = parent
    exportable(obj)
    if material_indices:
        for poly, index in zip(mesh.polygons, material_indices):
            poly.material_index = index
    return obj


def add_box(name, location, scale, material, coll, parent=None, rotation=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (scale[0] * 0.5, scale[1] * 0.5, scale[2] * 0.5)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    link_object(obj, coll)
    obj.data.materials.append(material)
    obj.parent = parent
    exportable(obj)
    if bevel > 0:
        mod = obj.modifiers.new("Soft_Faceted_Edges", "BEVEL")
        mod.width = bevel
        mod.segments = 1
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def add_cylinder(name, location, radius, depth, material, coll, parent=None, vertices=24, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth,
                                       location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    link_object(obj, coll)
    obj.data.materials.append(material)
    obj.parent = parent
    exportable(obj)
    return obj


def add_ico(name, location, scale, material, coll, parent=None, subdivisions=2, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1.0,
                                         location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    link_object(obj, coll)
    obj.data.materials.append(material)
    obj.parent = parent
    exportable(obj)
    return obj


def linked_copy(source, name, location, scale=(1, 1, 1), rotation=(0, 0, 0), parent=None, coll=None):
    obj = bpy.data.objects.new(name, source.data)
    (coll or source.users_collection[0]).objects.link(obj)
    obj.location = location
    obj.scale = scale
    obj.rotation_euler = rotation
    obj.parent = parent
    exportable(obj)
    return obj


def terrain_mesh(material, coll, parent):
    size_x, size_y, steps = 100.0, 90.0, 81
    verts, faces = [], []
    for iy in range(steps):
        y = -35.0 + size_y * iy / (steps - 1)
        for ix in range(steps):
            x = -size_x * 0.5 + size_x * ix / (steps - 1)
            d = math.sqrt((x / 50.0) ** 2 + ((y - 5.0) / 48.0) ** 2)
            z = (0.15 * math.sin(x * 0.23) + 0.11 * math.cos(y * 0.31)
                 + 0.08 * math.sin((x + y) * 0.41))
            z += max(0.0, d - 0.58) ** 2 * 2.3
            if -14 < x < 14 and -16 < y < 11:
                z *= 0.25
            verts.append((x, y, z))
    for iy in range(steps - 1):
        for ix in range(steps - 1):
            a = iy * steps + ix
            faces.extend(((a, a + 1, a + steps + 1), (a, a + steps + 1, a + steps)))
    return add_mesh_object("Snow_Ground", verts, faces, [material], coll, parent)


def ellipse_disc(name, center, rx, ry, z, material, coll, parent, segments=96):
    verts = [(center[0], center[1], z)]
    for i in range(segments):
        a = 2 * math.pi * i / segments
        wobble = 1.0 + 0.025 * math.sin(a * 7 + 0.8)
        verts.append((center[0] + math.cos(a) * rx * wobble,
                      center[1] + math.sin(a) * ry * wobble, z))
    faces = [(0, i + 1, ((i + 1) % segments) + 1) for i in range(segments)]
    return add_mesh_object(name, verts, faces, [material], coll, parent)


def crystal_geometry(radius, height, sides, seed):
    rng = random.Random(seed)
    verts = []
    ring_z = [0.0, height * 0.42, height * 0.78]
    for ring, z in enumerate(ring_z):
        factor = [1.0, 0.91, 0.74][ring]
        for i in range(sides):
            a = 2 * math.pi * i / sides
            rr = radius * factor * (0.9 + rng.random() * 0.18)
            verts.append((math.cos(a) * rr, math.sin(a) * rr, z))
    lean = (rng.uniform(-0.18, 0.18) * height, rng.uniform(-0.18, 0.18) * height)
    tip = len(verts)
    verts.append((lean[0], lean[1], height))
    faces = []
    faces.append(tuple(reversed(range(sides))))
    for ring in range(2):
        base = ring * sides
        nxt = (ring + 1) * sides
        for i in range(sides):
            j = (i + 1) % sides
            faces.append((base + i, base + j, nxt + j, nxt + i))
    top = 2 * sides
    for i in range(sides):
        faces.append((top + i, top + ((i + 1) % sides), tip))
    return verts, faces


def create_crystal_cluster(name, position, scale, rotation, crystal_count, material, seed, coll, parent):
    rng = random.Random(seed)
    cluster = group_empty(name, parent)
    cluster.location = position
    cluster.rotation_euler[2] = rotation
    count = 0
    for i in range(crystal_count):
        a = rng.random() * math.tau
        dist = rng.random() * scale * 0.65
        radius = scale * rng.uniform(0.12, 0.24)
        height = scale * rng.uniform(0.72, 1.42) * (1.28 if i == 0 else 1.0)
        verts, faces = crystal_geometry(radius, height, rng.choice((5, 6, 7, 8)), seed * 101 + i)
        crystal = add_mesh_object(f"{name}_Crystal_{i:02d}", verts, faces, [material], coll, cluster)
        crystal.location = (math.cos(a) * dist, math.sin(a) * dist, 0.0)
        crystal.rotation_euler[2] = rng.random() * math.tau
        count += 1
    return cluster, count


def pine_mesh(name, height, radius, levels, materials, coll, parent, seed):
    rng = random.Random(seed)
    verts, faces, indices = [], [], []

    def cone(z0, z1, r, sides, mat_index, phase=0.0):
        base = len(verts)
        for i in range(sides):
            a = math.tau * i / sides + phase
            rr = r * (0.94 + 0.08 * math.sin(i * 2.17 + seed))
            verts.append((math.cos(a) * rr, math.sin(a) * rr, z0))
        tip = len(verts)
        verts.append((0, 0, z1))
        faces.append(tuple(reversed(tuple(base + i for i in range(sides)))))
        indices.append(mat_index)
        for i in range(sides):
            faces.append((base + i, base + ((i + 1) % sides), tip))
            indices.append(mat_index)

    sides = 20
    trunk_r = radius * 0.13
    base = len(verts)
    for z in (0.0, height * 0.72):
        for i in range(10):
            a = math.tau * i / 10
            verts.append((math.cos(a) * trunk_r, math.sin(a) * trunk_r, z))
    for i in range(10):
        faces.append((base + i, base + (i + 1) % 10, base + 10 + (i + 1) % 10, base + 10 + i))
        indices.append(0)
    for level in range(levels):
        t = level / max(1, levels - 1)
        z0 = height * (0.12 + t * 0.62)
        r = radius * (1.0 - t * 0.55) * rng.uniform(0.94, 1.05)
        cone(z0, z0 + height * 0.31, r, sides, 0, level * 0.37)
        cone(z0 + height * 0.12, z0 + height * 0.32, r * 0.72, sides, 1, level * 0.37 + 0.04)
    obj = add_mesh_object(name, verts, faces, materials, coll, parent, indices)
    return obj


def mountain_mesh(name, location, radius, height, materials, coll, parent, seed):
    rng = random.Random(seed)
    steps = 29
    verts, faces = [], []
    phase = rng.uniform(0, math.tau)
    peaks = [
        (rng.uniform(-0.16, 0.16), rng.uniform(-0.12, 0.12), 1.0, 1.03),
        (-0.43, rng.uniform(-0.3, 0.25), 0.67, 0.64),
        (0.40, rng.uniform(-0.25, 0.3), 0.75, 0.67),
    ]
    for iy in range(steps):
        for ix in range(steps):
            u = -1 + 2 * ix / (steps - 1)
            v = -1 + 2 * iy / (steps - 1)
            if 0 < ix < steps - 1 and 0 < iy < steps - 1:
                u += rng.uniform(-0.014, 0.014)
                v += rng.uniform(-0.014, 0.014)
            elevations = []
            for px, py, strength, width in peaks:
                dx, dy = u - px, (v - py) * 1.12
                angle = math.atan2(dy, dx)
                ridge = 1 + 0.15 * math.cos(5 * angle + phase) + 0.07 * math.sin(9 * angle - phase)
                distance = math.hypot(dx, dy) / (width * ridge)
                elevations.append(strength * max(0, 1 - distance) ** 1.18)
            base = max(elevations)
            detail = (0.022 * math.sin(u * 34 + v * 17 + phase)
                      + 0.014 * math.sin(u * 61 - v * 27)
                      + 0.015 * math.cos(v * 46 + phase))
            envelope = min(1, max(0, (1 - max(abs(u), abs(v))) * 6))
            z = height * max(0, base + detail * min(1, base * 6)) * envelope
            verts.append((u * radius, v * radius, z))
    for iy in range(steps - 1):
        for ix in range(steps - 1):
            a = iy * steps + ix
            b, c, d = a + 1, a + steps, a + steps + 1
            if (ix + iy) % 2:
                faces.extend(((a, b, c), (b, d, c)))
            else:
                faces.extend(((a, b, d), (a, d, c)))
    obj = add_mesh_object(name, verts, faces, materials, coll, parent)
    for poly in obj.data.polygons:
        center = poly.center
        snowline = height * (0.20 + 0.065 * math.sin(center.x * 0.7 + phase)
                             + 0.04 * math.cos(center.y * 0.9))
        # Snow collects on shelves while steeper gullies expose dark stone.
        poly.material_index = int(center.z > snowline and poly.normal.z > 0.53)
    obj.location = location
    return obj


def detailed_rock(name, location, dimensions, mats, coll, parent, seed):
    rng = random.Random(seed)
    obj = add_ico(name, location, (1, 1, 1), mats[0], coll, parent, subdivisions=4)
    phase = rng.uniform(0, math.tau)
    for vertex in obj.data.vertices:
        direction = vertex.co.normalized()
        x, y, z = direction
        # A rounded block with stratification, fractured edges and an offset crown.
        shape = [math.copysign(abs(value) ** 0.77, value) for value in direction]
        relief = (1 + 0.075 * math.sin(7 * x + 4 * y + phase)
                  + 0.045 * math.sin(13 * y - 5 * z)
                  + 0.035 * math.cos(19 * z + 3 * x + phase))
        fissure = math.exp(-((x + 0.32 * z - 0.16) / 0.095) ** 2) * 0.13
        relief -= fissure
        vertex.co = (shape[0] * dimensions[0] * relief + 0.10 * z * dimensions[0],
                     shape[1] * dimensions[1] * relief,
                     shape[2] * dimensions[2] * relief)
    obj.data.update()
    # Keep extra triangles where the new fractures bend the silhouette.
    modifier = obj.modifiers.new('Rock_Geometry_Budget', 'DECIMATE')
    modifier.ratio = 0.5
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.materials.append(mats[1])
    obj.data.materials.append(mats[2])
    obj.data.update()
    for poly in obj.data.polygons:
        x, y, z = poly.center
        snowline = dimensions[2] * (0.3 + 0.09 * math.sin(x * 3 + phase))
        if z > snowline and poly.normal.z > 0.36:
            poly.material_index = 1
        elif abs(x / dimensions[0] + 0.32 * z / dimensions[2] - 0.16) < 0.11:
            poly.material_index = 2
        else:
            poly.material_index = 0
    return obj


def cylinder_between(name, a, b, radius, material, coll, parent=None, vertices=8):
    a, b = Vector(a), Vector(b)
    direction = b - a
    midpoint = (a + b) * 0.5
    obj = add_cylinder(name, midpoint, radius, direction.length, material, coll, parent, vertices)
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    return obj


def create_bush(name, location, scale, mats, coll, parent, seed):
    rng = random.Random(seed)
    bush = group_empty(name, parent)
    bush.location = location
    for i in range(6):
        a = (i / 6.0) * math.tau + rng.uniform(-0.25, 0.25)
        h = scale * rng.uniform(0.7, 1.2)
        end = (math.cos(a) * scale * 0.45, math.sin(a) * scale * 0.45, h)
        cylinder_between(f"{name}_Stem_{i}", (0, 0, 0), end, scale * 0.035, mats[0], coll, bush, 6)
        for side in (-1, 1):
            mid = Vector(end) * 0.58
            twig = (mid.x + math.cos(a + side * 0.8) * scale * 0.28,
                    mid.y + math.sin(a + side * 0.8) * scale * 0.28,
                    mid.z + scale * 0.22)
            cylinder_between(f"{name}_Twig_{i}_{side}", mid, twig, scale * 0.022, mats[0], coll, bush, 6)
        add_ico(f"{name}_Snow_{i}", end, (scale * 0.10, scale * 0.10, scale * 0.055),
                mats[1], coll, bush, subdivisions=1)
    return bush


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def build_scene():
    clear_scene()
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 540
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = PREVIEW_PATH
    scene.render.film_transparent = False
    scene.world.color = (0.035, 0.055, 0.11)
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.18, 0.34, 0.68, 1)
    background.inputs["Strength"].default_value = 0.72
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.8

    mats = {
        "Snow": make_material("Snow", (0.94, 0.975, 1.0, 1), 0.84),
        "Ice_Base": make_material("Ice_Base", (0.18, 0.56, 0.82, 1), 0.31, 0.02),
        "Ice_Dark": make_material("Ice_Dark", (0.035, 0.16, 0.34, 1), 0.43),
        "Crystal_Blue": make_material("Crystal_Blue", (0.03, 0.60, 1.0, 1), 0.19, 0.04,
                                       (0.0, 0.22, 0.72), 0.55),
        "Rock_Ice": make_material("Rock_Ice", (0.11, 0.23, 0.39, 1), 0.72),
        "Tree_Dark": make_material("Tree_Dark", (0.025, 0.12, 0.19, 1), 0.87),
        "Emission_Blue": make_material("Emission_Blue", (0.03, 0.48, 0.82, 1), 0.24,
                                        0.0, (0.0, 0.55, 1.0), 2.2),
        "Emission_Warm": make_material("Emission_Warm", (1.0, 0.22, 0.025, 1), 0.30,
                                        0.0, (1.0, 0.08, 0.004), 6.0),
    }

    root = group_empty("IceScenario_Root")
    group_names = ("Terrain", "Arena_Center", "Arena_Stairs", "Ice_Crystals", "Ice_Rocks",
                   "Small_Rocks", "Snow_Pines", "Crystal_Trees", "Frozen_Bushes", "Mountains",
                   "Frozen_Lake", "Ice_Braziers", "Decorations")
    groups = {name: group_empty(name, root) for name in group_names}
    colls = {name: collection(name) for name in group_names}
    preview_coll = collection("PREVIEW_ONLY")
    collision_coll = collection("COLLISION")

    terrain_mesh(mats["Snow"], colls["Terrain"], groups["Terrain"])
    lake = ellipse_disc("Frozen_Lake_Surface", (0, 27), 37, 12.5, 0.22, mats["Ice_Base"],
                        colls["Frozen_Lake"], groups["Frozen_Lake"])
    lake["semantic"] = "frozen_lake"
    for i in range(15):
        rng = random.Random(4100 + i)
        x, y = rng.uniform(-25, 25), rng.uniform(21, 33)
        length = rng.uniform(1.8, 5.0)
        angle = rng.uniform(-1.0, 1.0)
        a = (x, y, 0.245)
        b = (x + math.cos(angle) * length, y + math.sin(angle) * length, 0.245)
        cylinder_between(f"Lake_Crack_{i:02d}", a, b, 0.025, mats["Emission_Blue"],
                         colls["Frozen_Lake"], groups["Frozen_Lake"], 5)

    # Central arena: layered ice, individual perimeter blocks, snow top, and rune-like marks.
    add_cylinder("Arena_Core", (0, -2, 0.73), 9.3, 1.42, mats["Ice_Dark"],
                 colls["Arena_Center"], groups["Arena_Center"], 64)
    add_cylinder("Arena_Snow_Top", (0, -2, 1.48), 8.75, 0.16, mats["Snow"],
                 colls["Arena_Center"], groups["Arena_Center"], 64)
    for i in range(22):
        rng = random.Random(6200 + i)
        a = math.tau * i / 22
        r = 9.35
        add_box(f"Arena_Rim_Block_{i:02d}",
                (math.cos(a) * r, -2 + math.sin(a) * r, rng.uniform(0.55, 0.78)),
                (2.65, 1.65, rng.uniform(1.0, 1.48)), mats["Rock_Ice"],
                colls["Arena_Center"], groups["Arena_Center"],
                (rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05), a + rng.uniform(-0.05, 0.05)), 0.13)
        add_box(f"Arena_Rim_Snow_{i:02d}",
                (math.cos(a) * r, -2 + math.sin(a) * r, 1.39),
                (2.35, 1.42, 0.16), mats["Snow"], colls["Arena_Center"],
                groups["Arena_Center"], (0, 0, a), 0.07)
    for i in range(12):
        a = math.tau * i / 12
        cylinder_between(f"Arena_Rune_{i:02d}",
                         (math.cos(a) * 2.3, -2 + math.sin(a) * 2.3, 1.575),
                         (math.cos(a) * 6.8, -2 + math.sin(a) * 6.8, 1.575),
                         0.038, mats["Emission_Blue"], colls["Decorations"], groups["Decorations"], 5)

    for step in range(5):
        width = 6.8 - step * 0.52
        y = -13.5 + step * 1.32
        z = 0.18 + step * 0.27
        add_box(f"Arena_Stair_{step + 1}", (0.08 * math.sin(step), y, z),
                (width, 1.72, 0.48), mats["Rock_Ice"], colls["Arena_Stairs"],
                groups["Arena_Stairs"], (0, 0, 0.018 * (-1) ** step), 0.12)
        add_box(f"Arena_Stair_Snow_{step + 1}", (0.08 * math.sin(step), y - 0.05, z + 0.27),
                (width * 0.96, 1.5, 0.10), mats["Snow"], colls["Arena_Stairs"],
                groups["Arena_Stairs"], (0, 0, 0.018 * (-1) ** step), 0.04)

    # Crystal composition: large foreground silhouettes, medium side clusters, small distant accents.
    crystal_specs = [
        ("CrystalCluster_FG_Left", (-31, -24, 0.1), 5.2, -0.12, 11),
        ("CrystalCluster_FG_Left2", (-23, -28, 0.1), 3.8, 0.28, 8),
        ("CrystalCluster_FG_Right", (27, -26, 0.1), 5.4, 0.13, 11),
        ("CrystalCluster_LeftMid", (-22, -4, 0.2), 3.3, -0.3, 8),
        ("CrystalCluster_RightMid", (23, 2, 0.2), 3.5, 0.25, 9),
        ("CrystalCluster_LeftLake", (-28, 22, 0.25), 3.8, 0.0, 10),
        ("CrystalCluster_RightLake", (27, 24, 0.25), 4.1, 0.2, 10),
        ("CrystalCluster_Back", (4, 36, 0.2), 2.8, 0.1, 8),
        ("CrystalCluster_ArenaL", (-11.5, -7.5, 0.1), 1.65, 0.2, 6),
        ("CrystalCluster_ArenaR", (11.8, -3, 0.1), 1.85, -0.2, 7),
        ("CrystalCluster_SideL", (-39, 6, 0.1), 3.1, 0.1, 8),
        ("CrystalCluster_SideR", (39, 10, 0.1), 3.5, -0.1, 9),
    ]
    crystal_count = 0
    for i, spec in enumerate(crystal_specs):
        _, made = create_crystal_cluster(*spec, mats["Crystal_Blue"], 8000 + i,
                                         colls["Ice_Crystals"], groups["Ice_Crystals"])
        crystal_count += made

    # Fractured rock prototypes with snow on the actual surface, not floating caps.
    rock_protos = []
    for i in range(6):
        rng = random.Random(9000 + i)
        p = detailed_rock(f"Rock_Prototype_{i}", (-42 + i * 2.4, 5 + i, 0.7),
                    (rng.uniform(1.2, 2.2), rng.uniform(1.0, 1.8), rng.uniform(0.9, 1.7)),
                    [mats["Rock_Ice"], mats["Snow"], mats["Ice_Dark"]],
                    colls["Ice_Rocks"], groups["Ice_Rocks"], 9000 + i)
        rock_protos.append(p)
    rock_positions = []
    for i in range(48):
        rng = random.Random(10000 + i)
        side = -1 if i % 2 == 0 else 1
        x = side * rng.uniform(15, 46)
        y = rng.uniform(-22, 35)
        if abs(x) < 18 and -15 < y < 10:
            x += side * 10
        rock_positions.append((x, y))
        proto_idx = i % len(rock_protos)
        s = rng.uniform(0.55, 1.65)
        linked_copy(rock_protos[proto_idx], f"Ice_Rock_{i:02d}", (x, y, 0.45 * s),
                    (s, s * rng.uniform(0.85, 1.15), s), (0, 0, rng.random() * math.tau),
                    groups["Ice_Rocks"], colls["Ice_Rocks"])

    small_proto = add_ico("Small_Rock_Prototype", (-8, -22, 0.24), (0.42, 0.33, 0.24),
                          mats["Rock_Ice"], colls["Small_Rocks"], groups["Small_Rocks"], 2)
    for i in range(56):
        rng = random.Random(11000 + i)
        x, y = rng.uniform(-42, 42), rng.uniform(-29, 33)
        if x * x + (y + 2) ** 2 < 115:
            x += (1 if x >= 0 else -1) * 12
        s = rng.uniform(0.5, 1.65)
        linked_copy(small_proto, f"Small_Rock_{i:02d}", (x, y, rng.uniform(0.08, 0.28)),
                    (s, s * rng.uniform(0.65, 1.2), s), (0, rng.uniform(-0.3, 0.3), rng.random() * math.tau),
                    groups["Small_Rocks"], colls["Small_Rocks"])

    # Four richly faceted pine variants, instanced around the lateral frame.
    pine_protos = []
    for i, (h, r, levels) in enumerate(((6.8, 2.35, 6), (8.1, 2.65, 7), (5.7, 2.0, 5), (9.1, 2.85, 7))):
        proto = pine_mesh(f"Tree_{chr(65 + i)}", h, r, levels, [mats["Tree_Dark"], mats["Snow"]],
                          colls["Snow_Pines"], groups["Snow_Pines"], 12000 + i)
        proto.location = (-44 + i * 3.0, 13 + i * 2.0, 0.0)
        pine_protos.append(proto)
    for i in range(62):
        rng = random.Random(13000 + i)
        side = -1 if i % 2 == 0 else 1
        x = side * rng.uniform(18, 48)
        y = rng.uniform(-13, 39)
        if abs(x) < 25 and y < 10:
            x += side * 7
        s = rng.uniform(0.72, 1.28)
        linked_copy(pine_protos[i % 4], f"Snow_Pine_{i:02d}", (x, y, 0),
                    (s, s, s), (0, 0, rng.random() * math.tau), groups["Snow_Pines"], colls["Snow_Pines"])

    # Distant layered mountain wall.
    mountain_specs = [
        (-45, 43, 17, 22), (-32, 47, 14, 27), (-19, 49, 16, 25), (-5, 53, 11, 19),
        (11, 51, 13, 22), (26, 48, 16, 26), (42, 44, 18, 29), (-57, 48, 19, 25),
        (57, 49, 19, 27), (-38, 58, 13, 19), (-10, 60, 16, 24), (18, 59, 14, 21),
        (38, 57, 13, 20), (0, 63, 12, 18),
    ]
    for i, (x, y, r, h) in enumerate(mountain_specs):
        mountain_mesh(f"Mountain_{i:02d}", (x, y, 0), r, h,
                      [mats["Rock_Ice"], mats["Snow"]], colls["Mountains"], groups["Mountains"], 14000 + i)

    # Two twisted frozen trees assembled from low-sided branches and crystal foliage.
    for tree_i, (x, y, mirror) in enumerate(((-35, 24, 1), (35, 27, -1))):
        tree = group_empty(f"Crystal_Tree_{tree_i + 1}", groups["Crystal_Trees"])
        tree.location = (x, y, 0)
        trunk_points = [(0, 0, 0), (0.6 * mirror, 0.1, 2.5), (-0.2 * mirror, 0.0, 5.2),
                        (0.8 * mirror, 0.15, 8.0), (0.4 * mirror, 0.0, 10.2)]
        for i in range(len(trunk_points) - 1):
            cylinder_between(f"CrystalTree_{tree_i}_Trunk_{i}", trunk_points[i], trunk_points[i + 1],
                             0.38 - i * 0.05, mats["Ice_Dark"], colls["Crystal_Trees"], tree, 8)
        branch_id = 0
        for level in range(2, 5):
            origin = Vector(trunk_points[level])
            for side in (-1, 1):
                end = origin + Vector((side * mirror * (2.1 + level * 0.2), 0.4 * side, 1.4 + level * 0.22))
                cylinder_between(f"CrystalTree_{tree_i}_Branch_{branch_id}", origin, end, 0.16,
                                 mats["Ice_Dark"], colls["Crystal_Trees"], tree, 7)
                verts, faces = crystal_geometry(0.42, 1.45, 6, 15000 + tree_i * 20 + branch_id)
                tip = add_mesh_object(f"CrystalTree_{tree_i}_Leaf_{branch_id}", verts, faces,
                                      [mats["Crystal_Blue"]], colls["Crystal_Trees"], tree)
                tip.location = end
                tip.rotation_euler = (side * 0.3, side * 0.22, side * 0.5)
                branch_id += 1

    for i in range(18):
        rng = random.Random(16000 + i)
        x = rng.uniform(-38, 38)
        y = rng.uniform(-20, 31)
        if x * x + (y + 2) ** 2 < 150:
            x += (1 if x >= 0 else -1) * 15
        create_bush(f"Frozen_Bush_{i:02d}", (x, y, 0.2), rng.uniform(0.75, 1.25),
                    [mats["Tree_Dark"], mats["Snow"]], colls["Frozen_Bushes"], groups["Frozen_Bushes"], 17000 + i)

    # Warm braziers create focal contrast around the cool central arena.
    for i, (x, y) in enumerate(((-14, -7), (14, -7), (-14, 9), (14, 9), (0, 14))):
        bra = group_empty(f"Ice_Brazier_{i + 1}", groups["Ice_Braziers"])
        bra.location = (x, y, 0)
        add_cylinder(f"Brazier_{i}_Base", (0, 0, 0.48), 1.0, 0.95, mats["Rock_Ice"],
                     colls["Ice_Braziers"], bra, 8)
        add_cylinder(f"Brazier_{i}_Pillar", (0, 0, 1.25), 0.44, 0.85, mats["Ice_Dark"],
                     colls["Ice_Braziers"], bra, 8)
        verts, faces = crystal_geometry(0.38, 1.15, 6, 18000 + i)
        flame = add_mesh_object(f"Brazier_{i}_Warm_Crystal", verts, faces, [mats["Emission_Warm"]],
                                colls["Ice_Braziers"], bra)
        flame.location.z = 1.62

    # A few floating ice islands in the lake improve depth layering.
    for i, (x, y, s) in enumerate(((-16, 29, 1.4), (-3, 33, 0.9), (12, 26, 1.2), (22, 32, 0.75))):
        add_ico(f"Lake_Ice_Island_{i}", (x, y, 0.32), (2.3 * s, 1.2 * s, 0.24 * s),
                mats["Snow"], colls["Decorations"], groups["Decorations"], 2)

    # Simplified collision helpers stay in the blend but are never selected for GLB export.
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=9.0, depth=1.5, location=(0, -2, 0.75))
    col_arena = bpy.context.object
    col_arena.name = "COL_Arena"
    link_object(col_arena, collision_coll)
    col_arena.display_type = "WIRE"
    col_arena.hide_render = True
    for i, (x, y, sx, sy) in enumerate(((-48, 8, 4, 80), (48, 8, 4, 80), (0, 53, 92, 4))):
        bpy.ops.mesh.primitive_cube_add(location=(x, y, 3))
        obj = bpy.context.object
        obj.name = f"COL_Boundary_{i}"
        obj.scale = (sx * 0.5, sy * 0.5, 3)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        link_object(obj, collision_coll)
        obj.display_type = "WIRE"
        obj.hide_render = True

    # Preview-only lighting and camera.
    bpy.ops.object.light_add(type="SUN", location=(0, -15, 35))
    sun = bpy.context.object
    sun.name = "Preview_Sun"
    sun.data.energy = 2.8
    sun.data.color = (0.66, 0.79, 1.0)
    sun.rotation_euler = (math.radians(28), math.radians(-22), math.radians(-28))
    link_object(sun, preview_coll)
    bpy.ops.object.light_add(type="AREA", location=(0, -18, 24))
    area = bpy.context.object
    area.name = "Preview_Sky_Fill"
    area.data.energy = 1650
    area.data.shape = "DISK"
    area.data.size = 24
    area.data.color = (0.38, 0.63, 1.0)
    look_at(area, (0, 3, 0))
    link_object(area, preview_coll)
    bpy.ops.object.camera_add(location=(0, -76, 32))
    camera = bpy.context.object
    camera.name = "Preview_Camera"
    camera.data.lens = 45
    camera.data.sensor_width = 36
    look_at(camera, (0, 8, 6.4))
    link_object(camera, preview_coll)
    scene.camera = camera

    scene["generator"] = "generate_ice_scenario.py"
    scene["seed"] = SEED
    scene["crystal_objects"] = crystal_count
    scene["tree_objects"] = 62 + len(pine_protos) + 2
    scene["rock_objects"] = len(rock_positions) + len(rock_protos) + 56 + 1
    scene["mountain_objects"] = len(mountain_specs)
    return scene, mats


def export_objects():
    return [obj for obj in bpy.context.scene.objects if obj.get("export_glb", False)]


def calculate_stats(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    vertices = faces = triangles = 0
    mesh_objects = 0
    unique_meshes = set()
    used_materials = set()
    for obj in objects:
        if obj.type != "MESH":
            continue
        mesh_objects += 1
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        vertices += len(mesh.vertices)
        faces += len(mesh.polygons)
        triangles += len(mesh.loop_triangles)
        evaluated.to_mesh_clear()
        unique_meshes.add(obj.data.as_pointer())
        for slot in obj.material_slots:
            if slot.material:
                used_materials.add(slot.material.name)
    return {
        "vertices": vertices,
        "faces": faces,
        "triangles": triangles,
        "objects": len(objects),
        "mesh_objects": mesh_objects,
        "meshes": len(unique_meshes),
        "materials": len(used_materials),
        "material_names": sorted(used_materials),
    }


def validate_reimport(path):
    before = set(bpy.data.objects)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.import_scene.gltf(filepath=path)
    imported = [obj for obj in bpy.data.objects if obj not in before]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    material_names = {slot.material.name for obj in meshes for slot in obj.material_slots if slot.material}
    bounds = []
    for obj in meshes:
        for corner in obj.bound_box:
            bounds.append(obj.matrix_world @ Vector(corner))
    if bounds:
        mins = Vector((min(v.x for v in bounds), min(v.y for v in bounds), min(v.z for v in bounds)))
        maxs = Vector((max(v.x for v in bounds), max(v.y for v in bounds), max(v.z for v in bounds)))
        dimensions = maxs - mins
    else:
        dimensions = Vector((0, 0, 0))
    result = {
        "reimported": len(meshes) > 0,
        "imported_objects": len(imported),
        "imported_meshes": len(meshes),
        "imported_cameras": sum(obj.type == "CAMERA" for obj in imported),
        "imported_lights": sum(obj.type == "LIGHT" for obj in imported),
        "materials_present": len(material_names) >= 6,
        "emission_present": any("Emission" in name or "Crystal_Blue" in name for name in material_names),
        "dimensions": [round(v, 3) for v in dimensions],
        "scale_correct": 70.0 <= dimensions.x <= 160.0 and 65.0 <= dimensions.y <= 160.0 and 15.0 <= dimensions.z <= 80.0,
        "material_names": sorted(material_names),
    }
    for obj in imported:
        bpy.data.objects.remove(obj, do_unlink=True)
    return result


def main():
    print("[ICE] Building frozen arena...")
    scene, _ = build_scene()
    objects = export_objects()
    stats = calculate_stats(objects)
    print("[ICE] Stats before export:", stats)

    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH, compress=True)
    print("[ICE] Saved:", BLEND_PATH)

    bpy.context.scene.render.filepath = PREVIEW_PATH
    bpy.ops.render.render(write_still=True)
    print("[ICE] Preview rendered:", PREVIEW_PATH)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = next((o for o in objects if o.type == "MESH"), objects[0])
    bpy.ops.export_scene.gltf(
        filepath=GLB_PATH,
        export_format="GLB",
        use_selection=True,
        export_cameras=False,
        export_lights=False,
        export_yup=True,
        export_apply=True,
    )
    print("[ICE] Exported:", GLB_PATH)

    validation = validate_reimport(GLB_PATH)
    files = {
        "blend_bytes": os.path.getsize(BLEND_PATH) if os.path.exists(BLEND_PATH) else 0,
        "glb_bytes": os.path.getsize(GLB_PATH) if os.path.exists(GLB_PATH) else 0,
        "preview_bytes": os.path.getsize(PREVIEW_PATH) if os.path.exists(PREVIEW_PATH) else 0,
    }
    counts = {
        "crystal_objects": int(scene["crystal_objects"]),
        "trees": int(scene["tree_objects"]),
        "rocks": int(scene["rock_objects"]),
        "mountains": int(scene["mountain_objects"]),
    }
    report = {
        "status": "SUCCESS" if files["blend_bytes"] > 0 and files["glb_bytes"] > 0 and validation["reimported"] else "ERROR",
        "blender_version": bpy.app.version_string,
        "paths": {"blend": BLEND_PATH, "glb": GLB_PATH, "preview": PREVIEW_PATH},
        "files": files,
        "stats": stats,
        "counts": counts,
        "validation": validation,
    }
    with open(REPORT_PATH, "w", encoding="utf-8") as report_file:
        json.dump(report, report_file, indent=2, ensure_ascii=False)
    print("ICE_SCENARIO_REPORT=" + json.dumps(report, ensure_ascii=False))
    if report["status"] != "SUCCESS":
        raise RuntimeError("Generated files did not pass validation")


if __name__ == "__main__":
    main()
