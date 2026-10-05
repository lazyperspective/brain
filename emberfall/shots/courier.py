"""The courier: Blender Studio's CC0 stylized female base mesh, rigged and
costumed procedurally.

    rig, parts = courier.build(detail="far" | "close")
    courier.pose(rig, frame, {"thigh.L": (x, y, z), ...})
    courier.walk(rig, frames, ...)

Run ./fetch_assets.sh first to download the base mesh bundle.
The mesh faces -Y; her left is +X. Feet at z=0, 1.61 m tall.
"""
import bpy
import bmesh
import math
import os
from mathutils import Vector, Matrix, Euler
import common as C

BUNDLE = os.path.join(C.ROOT, "assets", "hbm", "human_base_meshes_bundle.blend")
BODY = "GEO-body_female_stylized"

# joint layout measured from the mesh (A-pose). name: (head, tail, parent)
BONES = {
    "hips":       ((0, 0.0, 0.86), (0, 0.0, 0.98), None),
    "spine":      ((0, 0.0, 0.98), (0, 0.0, 1.12), "hips"),
    "chest":      ((0, 0.0, 1.12), (0, 0.0, 1.30), "spine"),
    "neck":       ((0, -0.01, 1.30), (0, -0.015, 1.40), "chest"),
    "head":       ((0, -0.015, 1.40), (0, -0.015, 1.62), "neck"),
    "thigh.L":    ((0.085, 0.0, 0.83), (0.08, 0.0, 0.46), "hips"),
    "shin.L":     ((0.08, 0.0, 0.46), (0.067, 0.02, 0.085), "thigh.L"),
    "foot.L":     ((0.067, 0.02, 0.085), (0.067, -0.13, 0.02), "shin.L"),
    "shoulder.L": ((0.03, 0.0, 1.27), (0.15, 0.0, 1.27), "chest"),
    "upperarm.L": ((0.155, 0.0, 1.26), (0.25, -0.01, 1.04), "shoulder.L"),
    "forearm.L":  ((0.25, -0.01, 1.04), (0.32, -0.02, 0.865), "upperarm.L"),
    "hand.L":     ((0.32, -0.02, 0.865), (0.345, -0.025, 0.74), "forearm.L"),
}
for n in list(BONES):  # mirror the left side
    if n.endswith(".L"):
        h, t, p = BONES[n]
        BONES[n[:-2] + ".R"] = ((-h[0], h[1], h[2]), (-t[0], t[1], t[2]), p[:-2] + ".R" if p and p.endswith(".L") else p)


# ------------------------------------------------------------- materials

def materials():
    m = {}
    m["skin"] = C.painted("c_skin", (0.34, 0.13, 0.09), dark=(0.17, 0.055, 0.045), light=(0.52, 0.24, 0.16),
                          rough=0.55, stroke=14, stretch=(1, 1, 1.5), fog=0.4, bump=0.04, spec=0.3)
    b = m["skin"].node_tree.nodes["Principled BSDF"]
    b.inputs["Subsurface Weight"].default_value = 0.08
    b.inputs["Subsurface Radius"].default_value = (1.0, 0.25, 0.15)
    b.inputs["Subsurface Scale"].default_value = 0.01
    m["suit"] = C.painted("c_suit", (0.035, 0.026, 0.055), dark=(0.012, 0.008, 0.02), light=(0.07, 0.05, 0.1),
                          rough=0.75, stroke=10, stretch=(1, 1, 3), fog=0.5, bump=0.2)
    m["leather"] = C.painted("c_leather", (0.09, 0.045, 0.035), dark=(0.03, 0.015, 0.012), light=(0.18, 0.1, 0.07),
                             rough=0.5, stroke=18, fog=0.5, bump=0.15, edge=(0.35, 0.2, 0.15), edge_w=0.006)
    m["boot"] = C.painted("c_boot", (0.03, 0.02, 0.02), dark=(0.008, 0.005, 0.005), light=(0.08, 0.05, 0.045),
                          rough=0.35, stroke=18, fog=0.5, bump=0.1, edge=(0.4, 0.25, 0.2), edge_w=0.008, spec=0.6)
    m["coat"] = C.painted("c_coat", (0.22, 0.045, 0.05), dark=(0.07, 0.012, 0.02), light=(0.38, 0.1, 0.09),
                          rough=0.9, stroke=7, stretch=(1, 1, 3), fog=0.5, bump=0.35)
    m["brass"] = C.painted("c_brass", (0.42, 0.22, 0.08), dark=(0.18, 0.08, 0.03), light=(0.75, 0.5, 0.22),
                           rough=0.3, metal=1.0, edge=(1.0, 0.8, 0.5), edge_w=0.004, stroke=25, fog=0.5)
    m["iron"] = C.painted("c_iron", (0.07, 0.05, 0.055), rough=0.45, metal=0.8, edge=(0.45, 0.3, 0.25), edge_w=0.004, stroke=25, fog=0.5)
    m["hair"] = C.painted("c_hair", (0.55, 0.05, 0.06), dark=(0.25, 0.015, 0.03), light=(0.85, 0.2, 0.15),
                          rough=0.4, stroke=40, stretch=(1, 1, 30), fog=0.4, bump=0)
    m["glow"] = C.emissive("c_glow", (0.1, 0.65, 1.0), 12)
    m["glass"] = C.glass("c_lens", (0.85, 0.95, 0.95), rough=0.0, ior=1.3)
    m["dark"] = C.painted("c_interior", (0.01, 0.01, 0.012), rough=0.4, fog=0, bump=0)
    return m


# ---------------------------------------------------------------- helpers

def _active(ob):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def bone_parent(ob, rig, bone):
    """Parent ob to a bone while keeping its current world transform."""
    bpy.context.view_layer.update()
    mw = ob.matrix_world.copy()
    ob.parent = rig
    ob.parent_type = "BONE"
    ob.parent_bone = bone
    b = rig.data.bones[bone]
    ob.matrix_parent_inverse = (rig.matrix_world @ b.matrix_local @ Matrix.Translation((0, b.length, 0))).inverted()
    ob.matrix_world = mw
    return ob


def _keep_verts(ob, keep):
    """Delete every vertex of ob's mesh where keep(co, normal) is False."""
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bm.normal_update()
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not keep(v.co, v.normal)], context="VERTS")
    bm.to_mesh(ob.data); bm.free()


def _inflate(ob, amount_fn):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * amount_fn(v.co)
    bm.to_mesh(ob.data); bm.free()


def _dup(ob, name, mat):
    d = ob.copy(); d.data = ob.data.copy(); d.name = name
    for c in ob.users_collection:
        c.objects.link(d)
    d.data.materials.clear(); d.data.materials.append(mat)
    for p in d.data.polygons:
        p.material_index = 0
    return d


# ------------------------------------------------------------------ build

def build(detail="far", coll=None, name="courier"):
    if not os.path.exists(BUNDLE):
        raise FileNotFoundError(f"{BUNDLE} missing: run ./fetch_assets.sh")
    M = materials()
    with bpy.data.libraries.load(BUNDLE, link=False) as (src, dst):
        dst.objects = [n for n in src.objects if n.startswith(BODY)]
    coll = coll or bpy.context.scene.collection
    body = eyes = None
    eyes = []
    for ob in dst.objects:
        coll.objects.link(ob)
        if ob.name.startswith(BODY + ".eye"):
            eyes.append(ob)
        elif ob.name.startswith(BODY):
            body = ob
    body.name = f"{name}_body"
    body.location = (0, 0, 0)
    bpy.context.view_layer.update()
    # press the ears flat to the skull so the hood can cover them
    bm = bmesh.new(); bm.from_mesh(body.data)
    for v in bm.verts:
        if abs(v.co.x) > 0.064 and 1.35 < v.co.z < 1.55 and -0.07 < v.co.y < 0.08:
            v.co.x = math.copysign(0.064 + (abs(v.co.x) - 0.064) * 0.1, v.co.x)
    bm.to_mesh(body.data); bm.free()

    # body materials: skin face/neck, gloves, boots, suit elsewhere
    body.data.materials.clear()
    for k in ("suit", "skin", "leather", "boot"):
        body.data.materials.append(M[k])
    for p in body.data.polygons:
        c = p.center
        if c.z > 1.31:
            p.material_index = 1
        elif abs(c.x) > 0.235 and c.z < 1.05:
            p.material_index = 2  # gauntlet-length gloves
        elif c.z < 0.42:
            p.material_index = 3  # boots
        else:
            p.material_index = 0
    for p in body.data.polygons:
        p.use_smooth = True
    eye_m = C.painted("c_eye", (0.85, 0.82, 0.78), rough=0.2, fog=0.3, bump=0)
    for e in eyes:
        e.data.materials.clear(); e.data.materials.append(eye_m)

    # armature
    arm = bpy.data.armatures.new(f"{name}_rig")
    rig = bpy.data.objects.new(f"{name}_rig", arm)
    coll.objects.link(rig)
    _active(rig)
    bpy.ops.object.mode_set(mode="EDIT")
    for bn, (h, t, p) in BONES.items():
        eb = arm.edit_bones.new(bn)
        eb.head = h; eb.tail = t; eb.roll = 0.0
    for bn, (h, t, p) in BONES.items():
        if p:
            eb = arm.edit_bones[bn]
            eb.parent = arm.edit_bones[p]
            eb.use_connect = (Vector(arm.edit_bones[p].tail) - Vector(h)).length < 1e-4
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in rig.pose.bones:
        pb.rotation_mode = "XYZ"

    # bind the body with automatic (heat) weights
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    body.select_set(True); rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    for e in eyes:
        bone_parent(e, rig, "head")

    parts = {"body": body, "rig": rig, "eyes": eyes}

    # coat: inflated copy of the torso and upper arms, deforms with the rig
    coat = _dup(body, f"{name}_coat", M["coat"])
    _keep_verts(coat, lambda co, n: 0.8 < co.z < 1.345 and not (abs(co.x) > 0.21 and co.z < 1.06))
    _inflate(coat, lambda co: 0.013 + 0.01 * max(0, 1.0 - co.z) * 3)
    s = coat.modifiers.new("thick", "SOLIDIFY"); s.thickness = 0.006; s.offset = 1
    C.subsurf(coat, 1)
    parts["coat"] = coat

    # hood: inflated copy of head and neck with the face cut away
    hood = _dup(body, f"{name}_hood", M["coat"])
    _keep_verts(hood, lambda co, n: co.z > 1.29 and not (n.y < -0.35 and 1.33 < co.z < 1.535 and abs(co.x) < 0.075))
    bm = bmesh.new(); bm.from_mesh(hood.data)  # press the ears flat so the cloth doesn't follow them
    for v in bm.verts:
        if abs(v.co.x) > 0.064 and 1.35 < v.co.z < 1.55 and -0.07 < v.co.y < 0.08:
            v.co.x = math.copysign(0.064 + (abs(v.co.x) - 0.064) * 0.1, v.co.x)
    bm.to_mesh(hood.data); bm.free()
    _inflate(hood, lambda co: 0.024 + 0.012 * max(0, co.z - 1.45) * 6)
    sm = hood.modifiers.new("soften", "SMOOTH"); sm.factor = 1.0; sm.iterations = 12  # melts the ears into cloth
    s = hood.modifiers.new("thick", "SOLIDIFY"); s.thickness = 0.01; s.offset = 1
    C.subsurf(hood, 1)
    parts["hood"] = hood

    # coat skirt: open at the front, rigid to the hips, rippling
    bm = bmesh.new()
    rows, cols = 10, 26
    grid = []
    for r in range(rows + 1):
        t = r / rows
        z = 0.92 - 0.55 * t
        rx = 0.165 + 0.12 * t; ry = 0.125 + 0.1 * t
        row = []
        for c in range(cols + 1):
            a = math.radians(-90 + 32 + (360 - 64) * c / cols)  # gap centred on -Y (front)
            row.append(bm.verts.new((math.cos(a) * rx, math.sin(a) * ry, z)))
        grid.append(row)
    for r in range(rows):
        for c in range(cols):
            bm.faces.new((grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c]))
    skirt = C.mesh_obj(f"{name}_skirt", bm, M["coat"], coll, smooth=True)
    s = skirt.modifiers.new("thick", "SOLIDIFY"); s.thickness = 0.008
    w = skirt.modifiers.new("ripple", "WAVE"); w.height = 0.012; w.width = 0.18; w.speed = 0.1
    w.use_normal = True; w.falloff_radius = 0
    C.subsurf(skirt, 1)
    bone_parent(skirt, rig, "hips")
    parts["skirt"] = skirt

    # belt and pouches
    belt = C.torus(f"{name}_belt", 1.0, 0.02, loc=(0, 0.005, 0.93), mat=M["leather"], coll=coll, major=48, minor=6)
    belt.scale = (0.155, 0.12, 1.0)
    bone_parent(belt, rig, "hips")
    for k, x in enumerate((-0.12, 0.13)):
        pch = C.box(f"{name}_pouch{k}", (0.06, 0.04, 0.07), loc=(x, -0.06, 0.9), mat=M["leather"], coll=coll, bevel=0.01)
        bone_parent(pch, rig, "hips")

    # gauntlet on the right forearm, aligned to the bone
    h, t, _ = BONES["forearm.R"]
    h, t = Vector(h), Vector(t)
    axis = (t - h).normalized()
    q = axis.to_track_quat("Z", "Y")
    mid = (h + t) / 2

    def along(name_, ob, offset=0.0):
        ob.location = mid + axis * offset
        ob.rotation_euler = q.to_euler()
        bone_parent(ob, rig, "forearm.R")
        return ob
    along("sleeve", C.cylinder(f"{name}_g_sleeve", 0.06, 0.2, r2=0.05, mat=M["brass"], coll=coll, verts=20, bevel=0.004))
    along("drum", C.cylinder(f"{name}_g_drum", 0.045, 0.1, mat=M["iron"], coll=coll, verts=12), -0.02)
    for k in range(3):
        rr = C.torus(f"{name}_g_ring{k}", 0.062, 0.006, mat=M["iron"], coll=coll, major=24, minor=6)
        along("ring", rr, -0.08 + k * 0.08)
    vent = C.box(f"{name}_g_vent", (0.02, 0.012, 0.12), mat=M["glow"], coll=coll)
    vent.location = mid + Vector((0.0, -0.06, 0)) ; vent.rotation_euler = q.to_euler()
    bone_parent(vent, rig, "forearm.R")
    fist = C.box(f"{name}_g_fist", (0.09, 0.08, 0.11), loc=Vector(BONES["hand.R"][0]) + Vector((0, -0.005, -0.05)),
                 mat=M["iron"], coll=coll, bevel=0.015)
    bone_parent(fist, rig, "hand.R")
    gl = C.light("POINT", f"{name}_g_light", tuple(mid + Vector((0, -0.12, 0))), 4 if detail == "far" else 1.5,
                 (0.2, 0.6, 1.0), size=0.04)
    bone_parent(gl, rig, "forearm.R")
    parts["gauntlet_light"] = gl

    # backpack capacitor
    pack = C.box(f"{name}_pack", (0.22, 0.1, 0.26), loc=(0, 0.16, 1.12), mat=M["leather"], coll=coll, bevel=0.02)
    bone_parent(pack, rig, "chest")
    cell = C.cylinder(f"{name}_cell", 0.045, 0.3, loc=(0.06, 0.225, 1.14), mat=M["brass"], coll=coll, verts=16, bevel=0.004)
    bone_parent(cell, rig, "chest")
    win = C.box(f"{name}_cellwin", (0.025, 0.01, 0.18), loc=(0.06, 0.271, 1.14), mat=M["glow"], coll=coll)
    bone_parent(win, rig, "chest")
    for k in range(5):
        tr = C.torus(f"{name}_coil{k}", 0.038, 0.007, loc=(-0.065, 0.225, 1.05 + k * 0.03), mat=M["brass"], coll=coll, major=16, minor=6)
        bone_parent(tr, rig, "chest")
    for sx in (-1, 1):  # straps over the shoulders
        st = C.box(f"{name}_strap{sx}", (0.035, 0.012, 0.32), loc=(sx * 0.085, -0.095, 1.18), rot=(0.1, 0, 0), mat=M["leather"], coll=coll)
        bone_parent(st, rig, "chest")

    # hair: a heavy red braid down the back and locks spilling over the brow
    def strand(nm, pts, th, parent_bone):
        cu = bpy.data.curves.new(nm, "CURVE"); cu.dimensions = "3D"
        cu.bevel_depth = th; cu.bevel_resolution = 2; cu.use_fill_caps = True
        sp = cu.splines.new("NURBS"); sp.points.add(len(pts) - 1); sp.order_u = 4; sp.use_endpoint_u = True
        for i, p in enumerate(pts):
            sp.points[i].co = (*p, 1)
            sp.points[i].radius = 1.0 - 0.85 * (i / (len(pts) - 1)) ** 1.5
        cu.materials.append(M["hair"])
        ob = C.link(bpy.data.objects.new(nm, cu), coll)
        bone_parent(ob, rig, parent_bone)
        return ob
    braid = [(0, 0.105, 1.42), (0.012, 0.13, 1.34), (0.03, 0.15, 1.26), (0.06, 0.17, 1.17), (0.075, 0.19, 1.08)]
    strand(f"{name}_braid", braid, 0.019, "head")
    locks = [(-0.035, -0.06, 0.13), (-0.015, -0.075, 0.15), (0.005, -0.07, 0.16), (0.022, -0.05, 0.13), (0.045, 0.02, 0.1)]
    for k, (x0, sweep, fall) in enumerate(locks):
        base = Vector((x0, -0.112 + abs(x0) * 0.4, 1.565))
        pts = [base + Vector((sweep * (i / 5) ** 1.4, -0.03 * math.sin(i / 5 * math.pi * 0.7) - 0.008 * i / 5, -fall * i / 5)) for i in range(6)]
        strand(f"{name}_lock{k}", pts, 0.006 if detail == "close" else 0.008, "head")

    # goggles + respirator
    eye_c = {1: Vector((0.047, -0.08, 1.463)), -1: Vector((-0.047, -0.08, 1.463))}
    strap = C.torus(f"{name}_gstrap", 1.0, 0.007, loc=(0, 0.0, 1.475), rot=(0.08, 0, 0), mat=M["leather"], coll=coll, major=64, minor=8)
    strap.scale = (0.098, 0.115, 1.0)
    bone_parent(strap, rig, "head")
    parts["iris"] = []
    parts["shutters"] = []
    iris_m = C.emissive("c_iris", (0.15, 0.75, 1.0), 4.0)
    parts["iris_strength"] = iris_m.node_tree.nodes["Emission"].inputs["Strength"]
    for sx, c in eye_c.items():
        g = C.empty(f"{name}_eye{sx}", tuple(c + Vector((0, -0.032, 0))), coll=coll)
        g.rotation_euler = (math.pi / 2, 0, sx * 0.2)
        bone_parent(g, rig, "head")
        def gp(ob):
            ob.parent = g
            return ob
        gp(C.cylinder(f"{name}_cup{sx}", 0.026, 0.026, loc=(0, 0, -0.006), r2=0.024, mat=M["brass"], coll=coll, verts=40, bevel=0.0015))
        gp(C.torus(f"{name}_rim{sx}", 0.0245, 0.0042, loc=(0, 0, 0.018), mat=M["brass"], coll=coll, major=48, minor=10))
        gp(C.cylinder(f"{name}_back{sx}", 0.021, 0.002, loc=(0, 0, 0.0078), mat=M["dark"], coll=coll, verts=32))
        gp(C.torus(f"{name}_iris{sx}", 0.0085, 0.0018, loc=(0, 0, 0.0098), mat=iris_m, coll=coll, major=32, minor=6))
        gp(C.cylinder(f"{name}_pupil{sx}", 0.0055, 0.001, loc=(0, 0, 0.0095), mat=iris_m, coll=coll, verts=24))
        if detail == "close":
            for b in range(8):
                a = b * math.pi / 4 + 0.2
                gp(C.sphere(f"{name}_screw{sx}{b}", 0.0018, loc=(math.cos(a) * 0.0245, math.sin(a) * 0.0245, 0.022), mat=M["iron"], coll=coll, segs=8, rings=4))
            for b in range(6):
                piv = C.empty(f"{name}_bpiv{sx}{b}", (0, 0, 0.012), coll=coll); piv.parent = g
                piv.rotation_euler = (0, 0, b * math.pi / 3)
                arm_ = C.empty(f"{name}_barm{sx}{b}", (0.017, 0, 0), coll=coll); arm_.parent = piv
                bl = C.box(f"{name}_blade{sx}{b}", (0.006, 0.02, 0.0008), loc=(-0.003, 0, 0), mat=M["iron"], coll=coll)
                bl.parent = arm_
                parts["shutters"].append(arm_)
        lens = gp(C.sphere(f"{name}_lens{sx}", 0.0215, loc=(0, 0, 0.016), mat=M["glass"], coll=coll, segs=32, rings=16, scale=(1, 1, 0.35)))
        lens.visible_shadow = False
    # respirator over nose and mouth
    mask = C.sphere(f"{name}_mask", 0.062, loc=(0, -0.085, 1.395), mat=M["leather"], coll=coll, segs=40, rings=20, scale=(1.05, 0.95, 0.85))
    bone_parent(mask, rig, "head")
    snout = C.cylinder(f"{name}_snout", 0.028, 0.045, loc=(0, -0.145, 1.385), rot=(math.pi / 2 + 0.25, 0, 0), r2=0.023, mat=M["iron"], coll=coll, verts=24, bevel=0.002)
    bone_parent(snout, rig, "head")
    grill = C.torus(f"{name}_grill", 0.024, 0.0035, loc=(0, -0.168, 1.38), rot=(math.pi / 2 + 0.25, 0, 0), mat=M["brass"], coll=coll)
    bone_parent(grill, rig, "head")
    for k in range(6):
        sl = C.box(f"{name}_slat{k}", (0.038, 0.003, 0.0035), loc=(0, -0.17, 1.367 + k * 0.005), rot=(0.25, 0, 0), mat=M["brass"], coll=coll)
        bone_parent(sl, rig, "head")
    for sx in (-1, 1):
        can = C.cylinder(f"{name}_can{sx}", 0.019, 0.045, loc=(sx * 0.066, -0.115, 1.37), rot=(math.pi / 2 + 0.5, 0, sx * 0.7),
                         r2=0.017, mat=M["brass"], coll=coll, verts=24, bevel=0.002)
        bone_parent(can, rig, "head")
        if detail == "close":
            for r in range(4):
                tt = C.torus(f"{name}_canr{sx}{r}", 0.0195, 0.0022, mat=M["iron"], coll=coll, major=32, minor=6)
                tt.parent = can; tt.location = (0, 0, -0.016 + r * 0.01)
    parts["materials"] = M
    return rig, parts


# ---------------------------------------------------------------- posing

def pose(rig, frame, rots, loc=None):
    for bn, r in rots.items():
        pb = rig.pose.bones[bn]
        pb.rotation_euler = r
        pb.keyframe_insert("rotation_euler", frame=frame)
    if loc is not None:
        pb = rig.pose.bones["hips"]
        pb.location = loc
        pb.keyframe_insert("location", frame=frame)


def walk_pose(ph):
    """Bone rotations for walk phase ph (radians). Leg bones point down, so a
    rotation about local X swings them fore/aft (negative = forward, -Y)."""
    r = {}
    for side, p in (("L", ph), ("R", ph + math.pi)):
        s = math.sin(p)
        r[f"thigh.{side}"] = (-0.42 * s, 0, 0)
        r[f"shin.{side}"] = (0.75 * max(0.0, math.sin(p - 1.2)) + 0.06, 0, 0)
        r[f"foot.{side}"] = (-0.25 * max(0.0, -math.sin(p + 0.4)), 0, 0)
    r["upperarm.L"] = (0.32 * math.sin(ph), 0, 0)
    r["forearm.L"] = (-0.3 - 0.15 * max(0, math.sin(ph)), 0, 0)
    r["upperarm.R"] = (-0.1 * math.sin(ph), 0, 0)  # the heavy gauntlet barely swings
    r["forearm.R"] = (-0.25, 0, 0)
    r["spine"] = (0.04, 0, 0.06 * math.sin(ph))
    r["chest"] = (0.04, 0, -0.1 * math.sin(ph))
    r["neck"] = (-0.04, 0, 0.04 * math.sin(ph))
    r["hips"] = (0, 0, -0.05 * math.sin(ph))
    return r
