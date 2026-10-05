"""Shared toolkit for the EMBERFALL shots.

Every shot script builds its scene from nothing (no asset files), so this
module carries the pieces they all lean on: render settings, the painterly
material, in-shader atmospheric fog, cel-shaded FX materials, procedural
lightning, and the compositor grade.

Run a shot with:
    blender -b --factory-startup -P shots/shot_01_bridge.py -- [--render] [--still N] [--scale 0.5] [--samples 32]
"""
import bpy
import bmesh
import math
import os
import random
import sys
from mathutils import Vector, Matrix, Euler, noise

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS = 24
RES = (1920, 804)  # 2.39:1 scope, letterboxed to 16:9 at assembly


# --------------------------------------------------------------------- args

def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = {"render": False, "still": None, "scale": 1.0, "samples": None, "save": True, "tag": "final"}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--render":
            out["render"] = True
        elif a == "--still":
            out["still"] = int(argv[i + 1]); i += 1
        elif a == "--scale":
            out["scale"] = float(argv[i + 1]); i += 1
        elif a == "--samples":
            out["samples"] = int(argv[i + 1]); i += 1
        elif a == "--nosave":
            out["save"] = False
        elif a == "--tag":
            out["tag"] = argv[i + 1]; i += 1
        i += 1
    return out


# -------------------------------------------------------------------- scene

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scn = bpy.context.scene
    scn.render.fps = FPS
    return scn


def setup_render(scn, frames, samples=48, motion_blur=False, shutter=0.5, bounces=4):
    r = scn.render
    r.engine = "CYCLES"
    scn.cycles.device = "CPU"
    scn.cycles.samples = samples
    scn.cycles.use_adaptive_sampling = True
    scn.cycles.adaptive_threshold = 0.03
    scn.cycles.use_denoising = True
    scn.cycles.denoiser = "OPENIMAGEDENOISE"
    scn.cycles.denoising_input_passes = "RGB_ALBEDO_NORMAL"
    scn.cycles.max_bounces = bounces
    scn.cycles.diffuse_bounces = 2
    scn.cycles.glossy_bounces = 2
    scn.cycles.transmission_bounces = 4
    scn.cycles.volume_bounces = 0
    scn.cycles.transparent_max_bounces = 8
    scn.cycles.caustics_reflective = False
    scn.cycles.caustics_refractive = False
    scn.cycles.blur_glossy = 1.0
    scn.cycles.sample_clamp_indirect = 6.0
    r.resolution_x, r.resolution_y = RES
    r.resolution_percentage = 100
    r.use_motion_blur = motion_blur
    r.motion_blur_shutter = shutter
    r.motion_blur_position = "START"  # keeps one-frame bolts inside their own frame
    r.film_transparent = False
    r.use_persistent_data = True  # keep BVH between frames
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGB"
    r.image_settings.color_depth = "8"
    scn.frame_start, scn.frame_end = frames
    vs = scn.view_settings
    scn.display_settings.display_device = "sRGB"
    vs.view_transform = "AgX"
    vs.look = "AgX - Medium High Contrast"
    vs.exposure = 0.0
    vs.gamma = 1.0


def finish(scn, name, a):
    """Apply CLI overrides, save the .blend and optionally render."""
    if a["samples"]:
        scn.cycles.samples = a["samples"]
    scn.render.resolution_percentage = int(round(a["scale"] * 100))
    out_dir = os.path.join(ROOT, "render", a["tag"], name)
    os.makedirs(out_dir, exist_ok=True)
    if a["save"]:
        blend_dir = os.path.join(ROOT, "render", "blend")
        os.makedirs(blend_dir, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(blend_dir, name + ".blend"))
    if a["still"] is not None:
        scn.frame_set(a["still"])
        scn.render.filepath = os.path.join(ROOT, "render", "stills", f"{name}_{a['still']:04d}.png")
        bpy.ops.render.render(write_still=True)
    elif a["render"]:
        scn.render.filepath = os.path.join(out_dir, "####")
        bpy.ops.render.render(animation=True)


# ------------------------------------------------------------------ objects

def link(obj, coll=None):
    (coll or bpy.context.scene.collection).objects.link(obj)
    return obj


def collection(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


def mesh_obj(name, bm, mat=None, coll=None, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    if mat:
        ob.data.materials.append(mat)
    return link(ob, coll)


def box(name, size, loc=(0, 0, 0), rot=(0, 0, 0), mat=None, coll=None, bevel=0.0, taper=None):
    """Box with optional bevel and top taper (x,y scale of the top face)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
        if taper and v.co.z > 0:
            v.co.x *= taper[0]; v.co.y *= taper[1]
    ob = mesh_obj(name, bm, mat, coll)
    ob.location = loc
    ob.rotation_euler = rot
    if bevel > 0:
        m = ob.modifiers.new("bevel", "BEVEL")
        m.width = bevel
        m.segments = 2
        m.limit_method = "ANGLE"
    return ob


def cylinder(name, r, depth, loc=(0, 0, 0), rot=(0, 0, 0), mat=None, coll=None, verts=24, r2=None, smooth=True, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts,
                          radius1=r, radius2=r if r2 is None else r2, depth=depth)
    ob = mesh_obj(name, bm, mat, coll, smooth=smooth)
    if smooth:
        ob.data.set_sharp_from_angle(angle=math.radians(40))
    ob.location = loc
    ob.rotation_euler = rot
    if bevel > 0:
        m = ob.modifiers.new("bevel", "BEVEL")
        m.width = bevel
        m.segments = 2
        m.limit_method = "ANGLE"
    return ob


def sphere(name, r, loc=(0, 0, 0), mat=None, coll=None, segs=24, rings=12, scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=r)
    ob = mesh_obj(name, bm, mat, coll, smooth=True)
    ob.location = loc
    ob.scale = scale
    return ob


def torus(name, R, r, loc=(0, 0, 0), rot=(0, 0, 0), mat=None, coll=None, major=48, minor=12):
    bm = bmesh.new()
    verts = []
    for i in range(major):
        a = 2 * math.pi * i / major
        ring = []
        for j in range(minor):
            b = 2 * math.pi * j / minor
            x = (R + r * math.cos(b)) * math.cos(a)
            y = (R + r * math.cos(b)) * math.sin(a)
            z = r * math.sin(b)
            ring.append(bm.verts.new((x, y, z)))
        verts.append(ring)
    for i in range(major):
        for j in range(minor):
            bm.faces.new((verts[i][j], verts[(i + 1) % major][j],
                          verts[(i + 1) % major][(j + 1) % minor], verts[i][(j + 1) % minor]))
    ob = mesh_obj(name, bm, mat, coll, smooth=True)
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def empty(name, loc=(0, 0, 0), parent=None, coll=None):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.2
    link(e, coll)
    e.location = loc
    if parent:
        e.parent = parent
    return e


def subsurf(ob, levels=2):
    m = ob.modifiers.new("subsurf", "SUBSURF")
    m.levels = levels
    m.render_levels = levels
    return m


def camera(name, loc, target=None, lens=35, rot=None, sensor=36, dof=None):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.sensor_width = sensor
    cd.clip_start = 0.05
    cd.clip_end = 2000
    cam = link(bpy.data.objects.new(name, cd))
    cam.location = loc
    if rot:
        cam.rotation_euler = rot
    if target is not None:
        look_at(cam, target)
    if dof:
        cd.dof.use_dof = True
        cd.dof.focus_distance = dof[0]
        cd.dof.aperture_fstop = dof[1]
    bpy.context.scene.camera = cam
    return cam


def look_at(ob, target):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def light(kind, name, loc, energy, color, size=0.5, rot=None, target=None, spot=None):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy
    ld.color = color
    if kind == "AREA":
        ld.size = size
    elif kind in ("POINT", "SPOT"):
        ld.shadow_soft_size = size
    elif kind == "SUN":
        ld.angle = size
    if spot and kind == "SPOT":
        ld.spot_size = spot[0]
        ld.spot_blend = spot[1]
    ob = link(bpy.data.objects.new(name, ld))
    ob.location = loc
    if rot:
        ob.rotation_euler = rot
    if target is not None:
        look_at(ob, target)
    return ob


def key(ob, path, frame, value, interp=None, index=-1):
    """Set a value and keyframe it in one go."""
    if "." in path:
        holder, attr = path.rsplit(".", 1)
        tgt = ob.path_resolve(holder)
    else:
        tgt, attr = ob, path
    setattr(tgt, attr, value)
    ob.keyframe_insert(data_path=path, frame=frame, index=index)
    if interp:
        set_interp(ob, interp)


def set_interp(idblock, interp="LINEAR", easing=None):
    ad = idblock.animation_data
    if not ad or not ad.action:
        return
    for fc in fcurves(ad.action):
        for kp in fc.keyframe_points:
            kp.interpolation = interp
            if easing:
                kp.easing = easing


def fcurves(action):
    if hasattr(action, "fcurves") and len(action.fcurves):
        return list(action.fcurves)
    out = []
    for layer in getattr(action, "layers", []):
        for strip in layer.strips:
            for bag in strip.channelbags:
                out.extend(bag.fcurves)
    return out


def visible_between(ob, f0, f1):
    """Render-visible only on frames f0..f1 inclusive."""
    for f, v in ((f0 - 1, True), (f0, False), (f1, False), (f1 + 1, True)):
        ob.hide_render = v
        ob.hide_viewport = v
        ob.keyframe_insert("hide_render", frame=f)
        ob.keyframe_insert("hide_viewport", frame=f)
    set_interp(ob, "CONSTANT")


# ---------------------------------------------------------------- materials

def _nodes(mat):
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    return nt, nt.nodes, nt.links


def fog_group():
    """Shared node group: mixes a surface shader toward an emissive haze colour
    by camera distance and height. Values are driven from the scene's custom
    properties so each shot only sets fog_color / fog_density / fog_height."""
    if "Fog" in bpy.data.node_groups:
        return bpy.data.node_groups["Fog"]
    g = bpy.data.node_groups.new("Fog", "ShaderNodeTree")
    g.interface.new_socket("Shader", in_out="INPUT", socket_type="NodeSocketShader")
    g.interface.new_socket("Amount", in_out="INPUT", socket_type="NodeSocketFloat").default_value = 1.0
    g.interface.new_socket("Shader", in_out="OUTPUT", socket_type="NodeSocketShader")
    n, l = g.nodes, g.links
    gi = n.new("NodeGroupInput")
    go = n.new("NodeGroupOutput")
    cam = n.new("ShaderNodeCameraData")
    geo = n.new("ShaderNodeNewGeometry")
    attr_c = n.new("ShaderNodeAttribute"); attr_c.attribute_type = "VIEW_LAYER"; attr_c.attribute_name = "fog_color"
    attr_d = n.new("ShaderNodeAttribute"); attr_d.attribute_type = "VIEW_LAYER"; attr_d.attribute_name = "fog_density"
    attr_h = n.new("ShaderNodeAttribute"); attr_h.attribute_type = "VIEW_LAYER"; attr_h.attribute_name = "fog_height"
    attr_s = n.new("ShaderNodeAttribute"); attr_s.attribute_type = "VIEW_LAYER"; attr_s.attribute_name = "fog_strength"
    # 1 - exp(-d * density)
    mul = n.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
    l.new(cam.outputs["View Distance"], mul.inputs[0]); l.new(attr_d.outputs["Fac"], mul.inputs[1])
    neg = n.new("ShaderNodeMath"); neg.operation = "MULTIPLY"; neg.inputs[1].default_value = -1
    l.new(mul.outputs[0], neg.inputs[0])
    ex = n.new("ShaderNodeMath"); ex.operation = "EXPONENT"
    l.new(neg.outputs[0], ex.inputs[0])
    inv = n.new("ShaderNodeMath"); inv.operation = "SUBTRACT"; inv.inputs[0].default_value = 1
    l.new(ex.outputs[0], inv.inputs[1])
    # height falloff: denser near ground
    sep = n.new("ShaderNodeSeparateXYZ"); l.new(geo.outputs["Position"], sep.inputs[0])
    hdiv = n.new("ShaderNodeMath"); hdiv.operation = "DIVIDE"
    l.new(sep.outputs["Z"], hdiv.inputs[0]); l.new(attr_h.outputs["Fac"], hdiv.inputs[1])
    hneg = n.new("ShaderNodeMath"); hneg.operation = "MULTIPLY"; hneg.inputs[1].default_value = -1
    l.new(hdiv.outputs[0], hneg.inputs[0])
    hex_ = n.new("ShaderNodeMath"); hex_.operation = "EXPONENT"; l.new(hneg.outputs[0], hex_.inputs[0])
    hcl = n.new("ShaderNodeMath"); hcl.operation = "MINIMUM"; hcl.inputs[1].default_value = 1.0
    l.new(hex_.outputs[0], hcl.inputs[0])
    hmix = n.new("ShaderNodeMath"); hmix.operation = "MULTIPLY_ADD"
    hmix.inputs[1].default_value = 0.55; hmix.inputs[2].default_value = 0.45
    l.new(hcl.outputs[0], hmix.inputs[0])
    fac = n.new("ShaderNodeMath"); fac.operation = "MULTIPLY"; fac.use_clamp = True
    l.new(inv.outputs[0], fac.inputs[0]); l.new(hmix.outputs[0], fac.inputs[1])
    fac2 = n.new("ShaderNodeMath"); fac2.operation = "MULTIPLY"; fac2.use_clamp = True
    l.new(fac.outputs[0], fac2.inputs[0]); l.new(gi.outputs["Amount"], fac2.inputs[1])
    em = n.new("ShaderNodeEmission")
    l.new(attr_c.outputs["Color"], em.inputs["Color"]); l.new(attr_s.outputs["Fac"], em.inputs["Strength"])
    # only camera rays get fogged; reflections and GI see the clean surface
    lp = n.new("ShaderNodeLightPath")
    fac3 = n.new("ShaderNodeMath"); fac3.operation = "MULTIPLY"
    l.new(fac2.outputs[0], fac3.inputs[0]); l.new(lp.outputs["Is Camera Ray"], fac3.inputs[1])
    mix = n.new("ShaderNodeMixShader")
    l.new(fac3.outputs[0], mix.inputs[0]); l.new(gi.outputs["Shader"], mix.inputs[1]); l.new(em.outputs[0], mix.inputs[2])
    l.new(mix.outputs[0], go.inputs["Shader"])
    return g


def set_fog(scn, color, density, height=6.0, strength=1.0):
    vl = scn.view_layers[0]
    vl["fog_color"] = list(color)[:3]
    vl["fog_density"] = density
    vl["fog_height"] = height
    vl["fog_strength"] = strength
    # custom props on view layers need to be typed as colour for the Attribute node
    try:
        vl.id_properties_ui("fog_color").update(subtype="COLOR")
    except Exception:
        pass


def painted(name, base, dark=None, light=None, rough=0.7, metal=0.0, edge=None, edge_w=0.03,
            stroke=4.0, stretch=(1, 1, 6), fog=1.0, bump=0.25, emit=None, emit_strength=0.0, spec=0.35):
    """Hand-painted look: base colour broken by two layers of brush-like noise,
    a bevel-derived worn-edge highlight, and the scene fog on top."""
    mat = bpy.data.materials.new(name)
    nt, n, l = _nodes(mat)
    out = n.new("ShaderNodeOutputMaterial")
    bsdf = n.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Specular IOR Level"].default_value = spec
    tc = n.new("ShaderNodeTexCoord")
    mp = n.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = stretch
    l.new(tc.outputs["Object"], mp.inputs["Vector"])
    n1 = n.new("ShaderNodeTexNoise"); n1.inputs["Scale"].default_value = stroke
    n1.inputs["Detail"].default_value = 6; n1.inputs["Roughness"].default_value = 0.62
    n1.inputs["Distortion"].default_value = 0.6
    l.new(mp.outputs["Vector"], n1.inputs["Vector"])
    n2 = n.new("ShaderNodeTexNoise"); n2.inputs["Scale"].default_value = stroke * 0.25
    n2.inputs["Detail"].default_value = 3
    l.new(tc.outputs["Object"], n2.inputs["Vector"])
    dark = dark or tuple(c * 0.45 for c in base[:3])
    light = light or tuple(min(1, c * 1.5 + 0.03) for c in base[:3])
    ramp = n.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.interpolation = "CONSTANT"  # posterised bands read as paint dabs
    cr.elements[0].position = 0.0; cr.elements[0].color = (*dark, 1)
    cr.elements[1].position = 0.42; cr.elements[1].color = (*base[:3], 1)
    e = cr.elements.new(0.64); e.color = (*light, 1)
    mixv = n.new("ShaderNodeMix"); mixv.data_type = "FLOAT"; mixv.inputs[0].default_value = 0.5
    l.new(n1.outputs["Fac"], mixv.inputs[2]); l.new(n2.outputs["Fac"], mixv.inputs[3])
    l.new(mixv.outputs[0], ramp.inputs["Fac"])
    col = ramp.outputs["Color"]
    if edge is not None:
        # worn edges: where the bevel normal departs from the true normal
        bev = n.new("ShaderNodeBevel"); bev.samples = 6; bev.inputs["Radius"].default_value = edge_w
        geo = n.new("ShaderNodeNewGeometry")
        dot = n.new("ShaderNodeVectorMath"); dot.operation = "DOT_PRODUCT"
        l.new(bev.outputs["Normal"], dot.inputs[0]); l.new(geo.outputs["Normal"], dot.inputs[1])
        mr = n.new("ShaderNodeMapRange")
        mr.inputs["From Min"].default_value = 0.985; mr.inputs["From Max"].default_value = 0.9
        l.new(dot.outputs["Value"], mr.inputs["Value"])
        # break up the edge line with noise so it reads as a brushed highlight
        en = n.new("ShaderNodeTexNoise"); en.inputs["Scale"].default_value = 18
        l.new(tc.outputs["Object"], en.inputs["Vector"])
        em_ = n.new("ShaderNodeMath"); em_.operation = "MULTIPLY"; em_.use_clamp = True
        l.new(mr.outputs["Result"], em_.inputs[0])
        enr = n.new("ShaderNodeMapRange"); enr.inputs["From Min"].default_value = 0.35; enr.inputs["From Max"].default_value = 0.6
        l.new(en.outputs["Fac"], enr.inputs["Value"]); l.new(enr.outputs["Result"], em_.inputs[1])
        mixc = n.new("ShaderNodeMix"); mixc.data_type = "RGBA"
        l.new(em_.outputs[0], mixc.inputs[0]); l.new(col, mixc.inputs[6])
        mixc.inputs[7].default_value = (*edge[:3], 1)
        col = mixc.outputs[2]
        l.new(bev.outputs["Normal"], bsdf.inputs["Normal"])
    elif bump > 0:
        bp = n.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = bump
        l.new(n1.outputs["Fac"], bp.inputs["Height"])
        l.new(bp.outputs["Normal"], bsdf.inputs["Normal"])
    l.new(col, bsdf.inputs["Base Color"])
    if emit is not None:
        bsdf.inputs["Emission Color"].default_value = (*emit[:3], 1)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    shader = bsdf.outputs[0]
    if fog > 0:
        fg = n.new("ShaderNodeGroup"); fg.node_tree = fog_group()
        fg.inputs["Amount"].default_value = fog
        l.new(shader, fg.inputs["Shader"])
        shader = fg.outputs[0]
    l.new(shader, out.inputs["Surface"])
    return mat


def emissive(name, color, strength=5.0, fog=0.0, alpha=None):
    mat = bpy.data.materials.new(name)
    nt, n, l = _nodes(mat)
    out = n.new("ShaderNodeOutputMaterial")
    em = n.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color[:3], 1)
    em.inputs["Strength"].default_value = strength
    sh = em.outputs[0]
    if fog > 0:
        fg = n.new("ShaderNodeGroup"); fg.node_tree = fog_group(); fg.inputs["Amount"].default_value = fog
        l.new(sh, fg.inputs["Shader"]); sh = fg.outputs[0]
    l.new(sh, out.inputs["Surface"])
    return mat


def glass(name, color=(0.8, 0.9, 1.0), rough=0.02, ior=1.45):
    mat = bpy.data.materials.new(name)
    nt, n, l = _nodes(mat)
    out = n.new("ShaderNodeOutputMaterial")
    b = n.new("ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Transmission Weight"].default_value = 1.0
    b.inputs["IOR"].default_value = ior
    l.new(b.outputs[0], out.inputs["Surface"])
    return mat


def toon(name, lit, shade, rim=None, light_dir=(0.4, -0.5, 0.75), bands=(0.18, 0.55), strength=1.0,
         gradient=None, alpha_edge=False):
    """Cel-shaded emission for 2D-style FX (smoke, shards). Cycles has no
    Shader-to-RGB, so the light term is computed from N.L directly.
    gradient=(axis, lo, hi, color_lo, color_hi) tints along a world axis."""
    mat = bpy.data.materials.new(name)
    nt, n, l = _nodes(mat)
    out = n.new("ShaderNodeOutputMaterial")
    geo = n.new("ShaderNodeNewGeometry")
    ld = Vector(light_dir).normalized()
    dot = n.new("ShaderNodeVectorMath"); dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = ld
    l.new(geo.outputs["Normal"], dot.inputs[0])
    nz = n.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 2.5; nz.inputs["Detail"].default_value = 2
    l.new(geo.outputs["Position"], nz.inputs["Vector"])
    wob = n.new("ShaderNodeMath"); wob.operation = "MULTIPLY_ADD"
    wob.inputs[1].default_value = 0.35; wob.inputs[2].default_value = -0.17
    l.new(nz.outputs["Fac"], wob.inputs[0])
    add = n.new("ShaderNodeMath"); add.operation = "ADD"
    l.new(dot.outputs["Value"], add.inputs[0]); l.new(wob.outputs[0], add.inputs[1])
    ramp = n.new("ShaderNodeValToRGB"); cr = ramp.color_ramp; cr.interpolation = "CONSTANT"
    deep = tuple(c * 0.55 for c in shade[:3])
    cr.elements[0].position = 0.0; cr.elements[0].color = (*deep, 1)
    cr.elements[1].position = bands[0]; cr.elements[1].color = (*shade[:3], 1)
    e = cr.elements.new(bands[1]); e.color = (*lit[:3], 1)
    mr = n.new("ShaderNodeMapRange"); mr.inputs["From Min"].default_value = -1; mr.inputs["From Max"].default_value = 1
    l.new(add.outputs[0], mr.inputs["Value"]); l.new(mr.outputs["Result"], ramp.inputs["Fac"])
    col = ramp.outputs["Color"]
    if gradient:
        axis, lo, hi, c_lo, c_hi = gradient
        sep = n.new("ShaderNodeSeparateXYZ"); l.new(geo.outputs["Position"], sep.inputs[0])
        gmr = n.new("ShaderNodeMapRange"); gmr.inputs["From Min"].default_value = lo; gmr.inputs["From Max"].default_value = hi
        l.new(sep.outputs[axis], gmr.inputs["Value"])
        gmix = n.new("ShaderNodeMix"); gmix.data_type = "RGBA"
        gmix.inputs[6].default_value = (*c_lo, 1); gmix.inputs[7].default_value = (*c_hi, 1)
        l.new(gmr.outputs["Result"], gmix.inputs[0])
        mul = n.new("ShaderNodeMix"); mul.data_type = "RGBA"; mul.blend_type = "MULTIPLY"; mul.inputs[0].default_value = 1
        l.new(col, mul.inputs[6]); l.new(gmix.outputs[2], mul.inputs[7])
        col = mul.outputs[2]
    if rim:
        lw = n.new("ShaderNodeLayerWeight"); lw.inputs["Blend"].default_value = 0.25
        st = n.new("ShaderNodeMath"); st.operation = "GREATER_THAN"; st.inputs[1].default_value = 0.6
        l.new(lw.outputs["Facing"], st.inputs[0])
        rm = n.new("ShaderNodeMix"); rm.data_type = "RGBA"
        l.new(st.outputs[0], rm.inputs[0]); l.new(col, rm.inputs[6]); rm.inputs[7].default_value = (*rim[:3], 1)
        col = rm.outputs[2]
    em = n.new("ShaderNodeEmission"); em.inputs["Strength"].default_value = strength
    l.new(col, em.inputs["Color"])
    l.new(em.outputs[0], out.inputs["Surface"])
    return mat


def sky_world(scn, top, horizon, stars=0.0, strength=1.0, ground=None, star_color=(1, 0.85, 0.8)):
    w = bpy.data.worlds.new("Sky")
    scn.world = w
    nt, n, l = _nodes(w)
    out = n.new("ShaderNodeOutputWorld")
    bg = n.new("ShaderNodeBackground"); bg.inputs["Strength"].default_value = strength
    tc = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ"); l.new(tc.outputs["Generated"], sep.inputs[0])
    ramp = n.new("ShaderNodeValToRGB"); cr = ramp.color_ramp
    cr.elements[0].position = 0.5; cr.elements[0].color = (*(ground or horizon)[:3], 1)
    cr.elements[1].position = 0.75; cr.elements[1].color = (*top[:3], 1)
    e = cr.elements.new(0.52); e.color = (*horizon[:3], 1)
    l.new(sep.outputs["Z"], ramp.inputs["Fac"])
    col = ramp.outputs["Color"]
    if stars > 0:
        vor = n.new("ShaderNodeTexVoronoi"); vor.feature = "DISTANCE_TO_EDGE"
        vor = n.new("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = 420
        vor.inputs["Randomness"].default_value = 1.0
        l.new(tc.outputs["Generated"], vor.inputs["Vector"])
        thr = n.new("ShaderNodeMapRange"); thr.inputs["From Min"].default_value = 0.06; thr.inputs["From Max"].default_value = 0.0
        l.new(vor.outputs["Distance"], thr.inputs["Value"])
        # thin the field: only some cells carry a star
        sel = n.new("ShaderNodeMath"); sel.operation = "GREATER_THAN"; sel.inputs[1].default_value = 0.93
        l.new(vor.outputs["Color"], sel.inputs[0])
        m1 = n.new("ShaderNodeMath"); m1.operation = "MULTIPLY"
        l.new(thr.outputs["Result"], m1.inputs[0]); l.new(sel.outputs[0], m1.inputs[1])
        up = n.new("ShaderNodeMapRange"); up.inputs["From Min"].default_value = 0.52; up.inputs["From Max"].default_value = 0.62
        l.new(sep.outputs["Z"], up.inputs["Value"])
        m2 = n.new("ShaderNodeMath"); m2.operation = "MULTIPLY"
        l.new(m1.outputs[0], m2.inputs[0]); l.new(up.outputs["Result"], m2.inputs[1])
        m3 = n.new("ShaderNodeMath"); m3.operation = "MULTIPLY"; m3.inputs[1].default_value = stars
        l.new(m2.outputs[0], m3.inputs[0])
        addc = n.new("ShaderNodeMix"); addc.data_type = "RGBA"; addc.blend_type = "ADD"
        l.new(m3.outputs[0], addc.inputs[0]); l.new(col, addc.inputs[6]); addc.inputs[7].default_value = (*star_color, 1)
        col = addc.outputs[2]
    l.new(col, bg.inputs["Color"])
    l.new(bg.outputs[0], out.inputs["Surface"])
    return w


# ---------------------------------------------------------------- lightning

def bolt_points(a, b, rng, depth=6, jag=0.18):
    """Midpoint displacement between a and b."""
    a, b = Vector(a), Vector(b)
    pts = [a, b]
    span = (b - a).length
    d = (b - a).normalized()
    side = d.orthogonal().normalized()
    up = d.cross(side).normalized()
    off = span * jag
    for _ in range(depth):
        new = [pts[0]]
        for p, q in zip(pts[:-1], pts[1:]):
            m = (p + q) / 2 + side * rng.uniform(-off, off) + up * rng.uniform(-off, off)
            new += [m, q]
        pts = new
        off *= 0.52
    return pts


def bolt(name, a, b, rng, width=0.03, mat=None, coll=None, depth=6, jag=0.18, branches=3, branch_len=0.35):
    """Lightning as a bevelled poly curve with forked branches."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = width
    cu.bevel_resolution = 1
    cu.use_fill_caps = True

    def add_spline(pts, w0=1.0, w1=0.15):
        sp = cu.splines.new("POLY")
        sp.points.add(len(pts) - 1)
        for i, p in enumerate(pts):
            t = i / max(1, len(pts) - 1)
            sp.points[i].co = (*p, 1)
            sp.points[i].radius = w0 + (w1 - w0) * t
    main = bolt_points(a, b, rng, depth, jag)
    add_spline(main, 1.0, 0.35)
    span = (Vector(b) - Vector(a)).length
    for _ in range(branches):
        i = rng.randint(len(main) // 6, len(main) * 5 // 6)
        p = main[i]
        dirv = (Vector(b) - Vector(a)).normalized()
        rnd = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))).normalized()
        end = p + (dirv * 0.6 + rnd).normalized() * span * branch_len * rng.uniform(0.4, 1.0)
        add_spline(bolt_points(p, end, rng, depth - 2, jag * 1.2), 0.55, 0.05)
    ob = link(bpy.data.objects.new(name, cu), coll)
    if mat:
        cu.materials.append(mat)
    ob.visible_shadow = False
    no_blur(ob)  # one-frame bolts would smear into sheets
    return ob


def no_blur(ob):
    try:
        ob.cycles.use_motion_blur = False
    except AttributeError:
        pass


def flicker_bolts(prefix, frames, make, hold=1):
    """Make a fresh bolt every `hold` frames and show it only on its frames."""
    obs = []
    for i, f in enumerate(range(frames[0], frames[1] + 1, hold)):
        ob = make(f"{prefix}_{f}", random.Random(hash((prefix, f)) & 0xFFFF))
        if ob is None:
            continue
        visible_between(ob, f, min(frames[1], f + hold - 1))
        obs.append(ob)
    return obs


# --------------------------------------------------------------- compositor

def compositor(scn, kuwahara=4.0, bloom=0.6, bloom_threshold=0.9, bloom_size=0.55,
               lift=(1, 1, 1), gamma=(1, 1, 1), gain=(1, 1, 1), saturation=1.1,
               vignette=0.45, dispersion=0.006, streaks=0.0, contrast=0.0):
    scn.use_nodes = True
    nt = scn.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    n, l = nt.nodes, nt.links
    rl = n.new("CompositorNodeRLayers")
    comp = n.new("CompositorNodeComposite")
    img = rl.outputs["Image"]
    if kuwahara > 0:
        # anisotropic Kuwahara smears texture into directional brush strokes
        k = n.new("CompositorNodeKuwahara")
        k.variation = "ANISOTROPIC"
        k.inputs["Size"].default_value = kuwahara
        k.inputs["Uniformity"].default_value = 4
        k.inputs["Sharpness"].default_value = 0.6
        k.inputs["Eccentricity"].default_value = 1.2
        l.new(img, k.inputs["Image"]); img = k.outputs[0]
    if bloom > 0:
        g = n.new("CompositorNodeGlare")
        g.glare_type = "BLOOM"
        g.quality = "HIGH"
        g.inputs["Threshold"].default_value = bloom_threshold
        g.inputs["Strength"].default_value = bloom
        g.inputs["Size"].default_value = bloom_size
        l.new(img, g.inputs["Image"]); img = g.outputs[0]
    if streaks > 0:
        g2 = n.new("CompositorNodeGlare")
        g2.glare_type = "STREAKS"
        g2.inputs["Threshold"].default_value = 3.0
        g2.inputs["Strength"].default_value = streaks
        g2.inputs["Streaks"].default_value = 2
        g2.inputs["Fade"].default_value = 0.93
        l.new(img, g2.inputs["Image"]); img = g2.outputs[0]
    cb = n.new("CompositorNodeColorBalance")
    cb.correction_method = "LIFT_GAMMA_GAIN"
    cb.inputs[3].default_value = (*lift, 1)
    cb.inputs[5].default_value = (*gamma, 1)
    cb.inputs[7].default_value = (*gain, 1)
    l.new(img, cb.inputs["Image"]); img = cb.outputs[0]
    hs = n.new("CompositorNodeHueSat")
    hs.inputs["Saturation"].default_value = saturation
    l.new(img, hs.inputs["Image"]); img = hs.outputs[0]
    if contrast:
        bc = n.new("CompositorNodeBrightContrast")
        bc.inputs["Contrast"].default_value = contrast
        l.new(img, bc.inputs["Image"]); img = bc.outputs[0]
    if dispersion > 0:
        ld = n.new("CompositorNodeLensdist")
        ld.inputs["Dispersion"].default_value = dispersion
        ld.inputs["Distortion"].default_value = -0.01
        ld.inputs["Fit"].default_value = True
        l.new(img, ld.inputs["Image"]); img = ld.outputs[0]
    if vignette > 0:
        em = n.new("CompositorNodeEllipseMask")
        em.inputs["Size"].default_value = (0.95, 0.9)
        bl = n.new("CompositorNodeBlur"); bl.filter_type = "FAST_GAUSS"
        bl.use_relative = True; bl.factor_x = 30; bl.factor_y = 30
        bl.size_x = 400; bl.size_y = 400
        l.new(em.outputs["Mask"], bl.inputs["Image"])
        mr = n.new("CompositorNodeMapRange")
        mr.inputs["To Min"].default_value = 1 - vignette
        l.new(bl.outputs[0], mr.inputs["Value"])
        mul = n.new("CompositorNodeMixRGB"); mul.blend_type = "MULTIPLY"
        l.new(mr.outputs[0], mul.inputs[0])
        mul.inputs[0].default_value = 1
        l.new(img, mul.inputs[1])
        cmb = n.new("CompositorNodeCombineColor")
        l.new(mr.outputs[0], cmb.inputs[0]); l.new(mr.outputs[0], cmb.inputs[1]); l.new(mr.outputs[0], cmb.inputs[2])
        mul2 = n.new("CompositorNodeMixRGB"); mul2.blend_type = "MULTIPLY"; mul2.inputs[0].default_value = 1
        l.new(img, mul2.inputs[1]); l.new(cmb.outputs[0], mul2.inputs[2])
        nt.nodes.remove(mul)
        img = mul2.outputs[0]
    l.new(img, comp.inputs["Image"])
    return nt


# -------------------------------------------------------------------- misc

def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def ease_out(t, p=3):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** p


def lerp(a, b, t):
    return a + (b - a) * t


def shake(ob, frames, amp=0.02, rot_amp=0.004, freq=0.35, seed=0, base_loc=None, base_rot=None):
    """Hand-held camera noise, keyed per frame."""
    bl = Vector(base_loc or ob.location)
    br = Euler(base_rot or ob.rotation_euler)
    for f in range(frames[0], frames[1] + 1):
        t = f * freq
        nv = noise.noise_vector(Vector((t, seed, 0)))
        ob.location = bl + nv * amp
        ob.rotation_euler = (br.x + noise.noise(Vector((t, seed + 3, 1))) * rot_amp,
                             br.y + noise.noise(Vector((t, seed + 5, 2))) * rot_amp,
                             br.z + noise.noise(Vector((t, seed + 7, 3))) * rot_amp)
        ob.keyframe_insert("location", frame=f)
        ob.keyframe_insert("rotation_euler", frame=f)


def embers(name, count, bounds, size, mat, rng, frames, drift=(0.3, 0, 0.6), coll=None):
    """Floating motes: small quads that billow upward on noise currents."""
    obs = []
    lo, hi = Vector(bounds[0]), Vector(bounds[1])
    proto_bm = bmesh.new()
    bmesh.ops.create_icosphere(proto_bm, subdivisions=1, radius=1.0)
    me = bpy.data.meshes.new(name + "_me")
    proto_bm.to_mesh(me); proto_bm.free()
    me.materials.append(mat)
    for i in range(count):
        ob = link(bpy.data.objects.new(f"{name}_{i}", me), coll)
        s = size * rng.uniform(0.4, 1.3)
        ob.scale = (s, s, s)
        ob.visible_shadow = False
        p0 = Vector((rng.uniform(lo.x, hi.x), rng.uniform(lo.y, hi.y), rng.uniform(lo.z, hi.z)))
        sp = rng.uniform(0.6, 1.4)
        for f in range(frames[0], frames[1] + 1, 2):
            t = (f - frames[0]) / FPS
            w = noise.noise_vector(Vector((p0.x * 0.3, p0.y * 0.3, t * 0.4 + i)))
            ob.location = p0 + Vector(drift) * t * sp + w * 0.4
            ob.keyframe_insert("location", frame=f)
        obs.append(ob)
    return obs


# ----------------------------------------------------------- toon smoke

def smoke_puffs(name, puffs, mat, frames, resolution=0.06, threshold=0.6, coll=None):
    """Billowing cartoon smoke from metaballs. Each puff is a dict with
    p0 (start), vel, r0, r1 (radius grow), t0 (birth frame), life (frames),
    turb (noise wobble). Balls grow then shrink, drifting along vel."""
    mb = bpy.data.metaballs.new(name)
    mb.resolution = resolution
    mb.render_resolution = resolution
    mb.threshold = threshold
    ob = link(bpy.data.objects.new(name, mb), coll)
    ob.data.materials.append(mat)
    ob.visible_shadow = False
    els = []
    for pf in puffs:
        e = mb.elements.new()
        e.co = pf["p0"]
        e.radius = 0.0001
        e.stiffness = pf.get("stiff", 2.0)
        if pf.get("stretch"):  # teardrop lobes aligned with their flight
            e.type = "ELLIPSOID"
            e.size_x = e.size_y = 1.0
            e.size_z = pf["stretch"]
            e.rotation = Vector(pf["vel"]).to_track_quat("Z", "Y")
        els.append((e, pf))
    for f in range(frames[0], frames[1] + 1):
        for i, (e, pf) in enumerate(els):
            age = (f - pf["t0"]) / max(1, pf["life"])
            if age < 0:
                e.radius = 0.0001
                e.co = pf["p0"]
            else:
                grow = ease_out(min(1, age * 2.2), 2)
                fade = 1 - ease(max(0, (age - 0.75) / 0.25))
                e.radius = max(0.0001, lerp(pf["r0"], pf["r1"], grow) * fade)
                t = (f - pf["t0"]) / FPS
                drag = pf.get("drag", 1.2)
                travel = (1 - math.exp(-drag * t)) / drag
                w = noise.noise_vector(Vector((i * 1.7, t * 0.8, 0.3))) * pf.get("turb", 0.0)
                e.co = Vector(pf["p0"]) + Vector(pf["vel"]) * travel + Vector(pf.get("rise", (0, 0, 0))) * t + w
            e.keyframe_insert("co", frame=f)
            e.keyframe_insert("radius", frame=f)
    return ob


def surreal_grade(scn, look="AgX - Punchy"):
    """Bold, saturated colour handling for the vision sequence."""
    scn.view_settings.view_transform = "AgX"
    scn.view_settings.look = look
