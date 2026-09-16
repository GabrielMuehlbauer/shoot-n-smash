"""Build the final, texture-free slingshot. Blender 4.5+ / 5.x.

    blender --background --python generate_slingshot.py

Model coordinates: X right, Y forward, Z up; metres, grip-centred pivot.
Only Slingshot_Root and its six mesh children are exported to GLB.
"""
from pathlib import Path
import json
import math
import random
import shutil

import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parent
RNG = random.Random(914)
MATERIALS = {}


def material(name, color, roughness):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = 0
    shader.inputs['Roughness'].default_value = roughness
    # COLOR_0 survives glTF export, unlike an unbaked procedural texture.
    if name != 'Ice_Detail':
        colors = mat.node_tree.nodes.new('ShaderNodeVertexColor')
        colors.layer_name = 'Color'
        mat.node_tree.links.new(colors.outputs['Color'], shader.inputs['Base Color'])
    else:
        shader.inputs['Emission Color'].default_value = (0.06, 0.24, 0.32, 1)
        shader.inputs['Emission Strength'].default_value = 0.035
    MATERIALS[name] = mat
    return mat


def paint(obj, base=None, variation=0.10):
    base = base or obj.data.materials[0].diffuse_color[:3]
    colors = obj.data.color_attributes.get('Color') or obj.data.color_attributes.new(
        name='Color', type='FLOAT_COLOR', domain='CORNER')
    obj.data.color_attributes.active_color = colors
    for face in obj.data.polygons:
        factor = 1 + RNG.uniform(-variation, variation)
        # A little directional warmth on the carved facets, never white facets.
        for index in face.loop_indices:
            colors.data[index].color = (*[min(1, c * factor) for c in base], 1)


def mesh(name, verts, faces, mat, smooth=False):
    data = bpy.data.meshes.new(name + '_Mesh')
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    data.materials.append(MATERIALS[mat])
    for face in data.polygons:
        face.use_smooth = smooth
    if mat != 'Ice_Detail':
        paint(obj)
    return obj


def activate(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply(obj, modifier):
    activate(obj)
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def join(objects, name):
    activate(objects[0])
    for obj in objects:
        obj.select_set(True)
    bpy.ops.object.join()
    result = bpy.context.object
    result.name = name
    # Joining preserves per-corner colours, using only the shared material.
    return result


def sweep(name, centers, radii, mat, sides=10, smooth=False):
    """Editable, irregular loft. Radius can be a (width, depth) pair."""
    centers = [Vector(c) for c in centers]
    verts, faces = [], []
    for i, center in enumerate(centers):
        tangent = (centers[min(i+1, len(centers)-1)] - centers[max(0, i-1)]).normalized()
        cross = tangent.cross(Vector((0, 1, 0))).normalized()
        depth = tangent.cross(cross).normalized()
        rx, ry = radii[i] if isinstance(radii[i], tuple) else (radii[i], radii[i])
        for j in range(sides):
            angle = j * math.tau / sides
            point = center + cross * (rx * math.cos(angle)) + depth * (ry * math.sin(angle))
            verts.append(tuple(point))
    for i in range(len(centers)-1):
        for j in range(sides):
            a, b = i*sides+j, i*sides+(j+1)%sides
            faces.append((a, b, b+sides, a+sides))
    faces.extend([tuple(reversed(range(sides))), tuple((len(centers)-1)*sides+j for j in range(sides))])
    return mesh(name, verts, faces, mat, smooth)


def wood_frame():
    # Three custom variable-section lofts are voxel-unioned, so the Y is a
    # single closed manifold, not three overlapping cylinders.
    handle = sweep('Handle_Loft', [
        (-.009,.003,-.19), (-.012,0,-.175), (-.008,.002,-.12),
        (.005,.005,-.055), (.007,.002,.015), (0,0,.09), (0,0,.17),
        (0,.003,.215)], [.034,.047,.046,.043,.047,.053,.060,.028], 'Wood_Main', 12)
    left = sweep('Left_Loft', [
        (0,0,.14), (-.035,-.003,.205), (-.078,.001,.26),
        (-.128,.008,.32), (-.163,.006,.385), (-.194,.004,.445),
        (-.203,.005,.475), (-.201,.006,.491)],
        [.058,.055,.047,.041,.037,.039,.043,.038], 'Wood_Main', 12)
    right = sweep('Right_Loft', [
        (0,0,.14), (.044,.004,.201), (.097,.010,.253),
        (.149,.014,.322), (.182,.009,.388), (.202,.012,.45),
        (.207,.012,.477), (.204,.013,.49)],
        [.058,.052,.045,.040,.036,.038,.042,.036], 'Wood_Main', 12)
    frame = join([handle, left, right], 'Wood_Frame')
    # Voxel union also eliminates hidden internal faces at the branch junction.
    remesh = frame.modifiers.new('Continuous branch union', 'REMESH')
    remesh.mode = 'VOXEL'
    remesh.voxel_size = .006
    remesh.use_smooth_shade = False
    apply(frame, remesh)
    relax = frame.modifiers.new('Organic junction', 'SMOOTH')
    relax.factor = 1.1
    relax.iterations = 4
    apply(frame, relax)
    frame.data.calc_loop_triangles()
    decimate = frame.modifiers.new('Carved low-poly facets', 'DECIMATE')
    decimate.ratio = min(1, 1150 / len(frame.data.loop_triangles))
    apply(frame, decimate)
    bevel = frame.modifiers.new('Small worn edges', 'BEVEL')
    bevel.width = .0015
    bevel.segments = 1
    bevel.angle_limit = .60
    apply(frame, bevel)
    paint(frame, variation=.13)
    # Slightly lighter narrow cuts follow the inside of the fork, adding grain
    # without another material or a texture fetch. These are actual shallow cuts.
    accents = [frame]
    for side in [-1, 1]:
        for offset in [-.006, .010]:
            centers = [(side*.072+offset,-.040,.237), (side*.102+offset,-.037,.284),
                       (side*.137+offset,-.030,.339), (side*.157+offset,-.028,.382)]
            accent = sweep('Carved grain', centers, [.0007,.0012,.001,.0004], 'Wood_Main', 4)
            paint(accent, (.245,.115,.047), .08)
            accents.append(accent)
    return join(accents, 'Wood_Frame')


def grip_wrap():
    verts, faces = [], []
    turns, steps = 6, 108
    # Continuous wide leather ribbon, not a stack of floating rings.
    for i in range(steps+1):
        t = i/steps
        angle = t * turns * math.tau + .45
        z = -.143 + .215*t
        radius = .048 + .005*math.cos(t*math.pi*2 + .4)
        center_x = .004*math.sin(t*5)
        for edge, lift in [(-1,0),(1,0),(1,.0032),(-1,.0032)]:
            r = radius+lift
            verts.append((center_x + r*math.cos(angle), r*math.sin(angle), z+edge*.0155))
    for i in range(steps):
        for j in range(4):
            a = i*4+j
            b = i*4+(j+1)%4
            faces.append((a,b,b+4,a+4))
    faces += [(3,2,1,0), tuple(steps*4+j for j in range(4))]
    grip = mesh('Grip_Wrap', verts, faces, 'Leather')
    paint(grip, (.062,.027,.014), .16)
    pieces = [grip]
    # Secure, broad bindings at both fork tips; rubber exits from their face.
    for side in [-1,1]:
        x, y = (-.195,.005) if side == -1 else (.202,.012)
        centers = [(x,y,.446),(x,y,.452),(x,y,.469),(x,y,.475)]
        collar = sweep('Fork binding', centers, [(.039,.038),(.044,.042),(.044,.042),(.038,.036)], 'Leather', 12)
        pieces.append(collar)
    return join(pieces, 'Grip_Wrap')


def band(name, tip, end):
    centers = []
    for i in range(13):
        t = i/12
        p = Vector(tip).lerp(Vector(end), t)
        p.z -= math.sin(t*math.pi)*.012
        p.y -= math.sin(t*math.pi)*.008
        centers.append(p)
    obj = sweep(name, centers, [(.007,.0045)]*13, 'Rubber', 8, True)
    # Attachment positions, in Blender coordinates, documented as extras.
    obj['tip_blender'] = list(tip)
    obj['pouch_attachment_blender'] = list(end)
    return obj


def pouch():
    verts, faces = [], []
    nx, nz = 12, 4
    for layer in range(2):
        for j in range(nz+1):
            v = j/nz*2-1
            for i in range(nx+1):
                u = i/nx*2-1
                x = u*.074
                z = v*(.020 + .013*(1-u*u))
                y = -.026*(1-u*u)*(1-.3*v*v) + layer*.004
                verts.append((x,y,z))
    layer_size = (nx+1)*(nz+1)
    for layer in range(2):
        for j in range(nz):
            for i in range(nx):
                a = layer*layer_size+j*(nx+1)+i
                f = (a,a+1,a+nx+2,a+nx+1)
                faces.append(f if layer == 0 else tuple(reversed(f)))
    boundary = list(range(nx+1))
    boundary += [j*(nx+1)+nx for j in range(1,nz+1)]
    boundary += [nz*(nx+1)+i for i in range(nx-1,-1,-1)]
    boundary += [j*(nx+1) for j in range(nz-1,0,-1)]
    for i,a in enumerate(boundary):
        b = boundary[(i+1)%len(boundary)]
        faces.append((a,b,b+layer_size,a+layer_size))
    body = mesh('Leather_Pouch', verts, faces, 'Leather', True)
    paint(body, (.035,.014,.008), .07)
    pieces = [body]
    # Small saddle stitches are joined to the pouch and move with it.
    for sign in [-1,1]:
        for i in range(11):
            u = (i-5)/6
            x = u*.074
            z = sign*(.020+.013*(1-u*u)-.005)
            y = -.026*(1-u*u)*.84-.0015
            stitch = sweep('Pouch stitch', [(x-.0014,y,z-.0014),(x+.0014,y,z+.0014)], [.0009,.0009], 'Leather', 4)
            paint(stitch, (.25,.135,.063), .08)
            pieces.append(stitch)
    body = join(pieces, 'Leather_Pouch')
    body.location = (0,-.122,.321)
    return body


def ice_details():
    # Only the left tip is frosted: the item remains predominantly wood.
    cap = sweep('Ice_Details', [(-.211,.006,.482),(-.208,.006,.493),(-.211,.008,.501)],
                [(.031,.029),(.033,.030),(.020,.020)], 'Ice_Detail', 9)
    crystals = [cap]
    for x,y,z,height in [(-.229,-.011,.483,.032),(-.214,.020,.493,.029),(-.235,.012,.48,.018)]:
        shard = sweep('Frost chip', [(x,y,z),(x-.002,y,z+height*.5),(x-.004,y,z+height)],
                      [.008,.006,.0005], 'Ice_Detail', 5)
        crystals.append(shard)
    return join(crystals, 'Ice_Details')


def stats(objects):
    meshes = [o for o in objects if o.type == 'MESH']
    for obj in meshes:
        obj.data.calc_loop_triangles()
    return {
        'objects': len(objects), 'mesh_objects': len(meshes),
        'vertices': sum(len(o.data.vertices) for o in meshes),
        'faces': sum(len(o.data.polygons) for o in meshes),
        'triangles': sum(len(o.data.loop_triangles) for o in meshes),
        'materials': sorted({m.name for o in meshes for m in o.data.materials}),
    }


def preview():
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 40
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 800
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 85
    scene.world.color = (.20,.24,.30)
    scene.view_settings.view_transform = 'AgX'
    def aim(obj, point):
        obj.rotation_euler = (Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=(.85,-2.4,.95))
    camera = bpy.context.object
    camera.name = 'Preview_Only_Camera'
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = .90
    aim(camera, (0,0,.15))
    scene.camera = camera
    for location, power, color, size in [((-1,-2,2),180,(1,.82,.65),2),
                                         ((1,0,1),140,(.48,.75,1),1.5),
                                         ((0,1,.8),110,(.72,.85,1),1)]:
        bpy.ops.object.light_add(type='AREA', location=location)
        light = bpy.context.object
        light.data.energy, light.data.color, light.data.shape, light.data.size = power,color,'DISK',size
        aim(light,(0,0,.2))
    scene.render.film_transparent = False
    scene.render.filepath = str(OUT/'slingshot_final_preview.jpg')
    bpy.ops.render.render(write_still=True)
    # Second view: camera-aligned inspection of the inside of the Y and pouch.
    camera.location = (.02,-2.4,.55)
    aim(camera,(0,0,.15))
    scene.render.filepath = str(OUT/'slingshot_first_person_preview.jpg')
    bpy.ops.render.render(write_still=True)


def main():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    material('Wood_Main', (.19,.078,.028), .78)
    material('Leather', (.046,.020,.011), .73)
    material('Rubber', (.011,.015,.019), .5)
    material('Ice_Detail', (.25,.58,.72), .26)
    root = bpy.data.objects.new('Slingshot_Root', None)
    scene.collection.objects.link(root)
    root.empty_display_type = 'PLAIN_AXES'
    root.empty_display_size = .035
    root['units'] = 'metres'
    # 'pivot' is reserved by GLTFLoader for a numeric vector, not a description.
    root['pivot_description'] = 'centre of grip'
    root['forward_blender'] = '+Y'
    root['forward_gltf'] = '-Z'
    parts = [wood_frame(), grip_wrap(),
             band('Band_L',(-.195,-.038,.463),(-.070,-.125,.321)),
             band('Band_R',(.202,-.031,.463),(.070,-.125,.321)),
             pouch(), ice_details()]
    for obj in parts:
        obj.parent = root
        activate(obj)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        # Recalculate outside normals for all closed meshes after construction.
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode='OBJECT')
    objects = [root,*parts]
    report = stats(objects)
    bounds = [obj.matrix_world @ Vector(corner) for obj in parts for corner in obj.bound_box]
    bpy.context.view_layer.update()
    bounds = [obj.matrix_world @ Vector(corner) for obj in parts for corner in obj.bound_box]
    minimum = [min(p[i] for p in bounds) for i in range(3)]
    maximum = [max(p[i] for p in bounds) for i in range(3)]
    report['dimensions_blender_m'] = [round(maximum[i]-minimum[i],5) for i in range(3)]
    report['bounds_blender_m'] = [minimum,maximum]
    report['validation'] = {
        'centred_x': abs((minimum[0]+maximum[0])/2) < .025,
        'height_055_to_075_m': .55 <= report['dimensions_blender_m'][2] <= .75,
        'scales_applied': all(tuple(o.scale) == (1,1,1) for o in objects),
        'grip_pivot_at_origin': tuple(root.location) == (0,0,0),
        'separate_bands_and_pouch': all(any(o.name == n for o in parts) for n in ['Band_L','Band_R','Leather_Pouch']),
        'under_5000_triangles': report['triangles'] <= 5000,
        'four_materials': len(report['materials']) == 4,
        'no_textures': not any(n.type == 'TEX_IMAGE' for m in MATERIALS.values() for n in m.node_tree.nodes),
        'no_exported_camera_or_light': all(o.type in ['EMPTY','MESH'] for o in objects),
    }
    assert all(report['validation'].values()), report
    # Save an asset-only .blend; presentation camera/lights are created afterwards.
    activate(root)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'slingshot_final.blend'), compress=True)
    for obj in objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/'slingshot_final.glb'), export_format='GLB',
        use_selection=True, export_cameras=False, export_lights=False, export_yup=True,
        export_apply=True, export_extras=True)
    report['glb_bytes'] = (OUT/'slingshot_final.glb').stat().st_size
    report['blender_version'] = bpy.app.version_string
    public = OUT/'client/public/models/slingshot_final.glb'
    public.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(OUT/'slingshot_final.glb',public)
    (OUT/'slingshot_final_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print('SLINGSHOT_REPORT='+json.dumps(report),flush=True)
    preview()


if __name__ == '__main__':
    main()
