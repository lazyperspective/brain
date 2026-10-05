"""Shot 2c — Mirror Sea (48 frames, 2.0s). Vision sequence, part 2.

The robot stands alone on an endless mirror under a burning magenta sky.
The moon has been cut into slabs that drift apart, their cut faces blazing
cyan; colossal teal gear-rings hang in the air, one half-sunk in the sea;
black monoliths hover over their own reflections.
"""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Euler, noise
import common as C

F0, F1 = 1, 48
rng = random.Random(203)
scn = C.reset()
C.setup_render(scn, (F0, F1), samples=28)
C.surreal_grade(scn)
C.set_fog(scn, (0.9, 0.15, 0.25), density=0.0035, height=60, strength=1.0)

# sky: violet zenith -> magenta -> molten orange horizon, mirrored below
w = bpy.data.worlds.new("Sky"); scn.world = w
nt, n, l = C._nodes(w)
out = n.new("ShaderNodeOutputWorld")
bg = n.new("ShaderNodeBackground")
tc = n.new("ShaderNodeTexCoord")
sep = n.new("ShaderNodeSeparateXYZ"); l.new(tc.outputs["Generated"], sep.inputs[0])
fold = n.new("ShaderNodeMath"); fold.operation = "SUBTRACT"; fold.inputs[1].default_value = 0.0
l.new(sep.outputs["Z"], fold.inputs[0])
ab = n.new("ShaderNodeMath"); ab.operation = "ABSOLUTE"; l.new(fold.outputs[0], ab.inputs[0])
ramp = n.new("ShaderNodeValToRGB"); cr = ramp.color_ramp
cr.elements[0].position = 0.0; cr.elements[0].color = (1.6, 0.42, 0.04, 1)
cr.elements[1].position = 0.6; cr.elements[1].color = (0.08, 0.006, 0.28, 1)
e = cr.elements.new(0.07); e.color = (1.3, 0.14, 0.18, 1)
e = cr.elements.new(0.25); e.color = (0.7, 0.02, 0.4, 1)
l.new(ab.outputs[0], ramp.inputs["Fac"])
l.new(ramp.outputs["Color"], bg.inputs["Color"])
l.new(bg.outputs[0], out.inputs["Surface"])

# ------------------------------------------------------------------ sea
sea = bpy.data.materials.new("mirror")
nt, n, l = C._nodes(sea)
o = n.new("ShaderNodeOutputMaterial")
b = n.new("ShaderNodeBsdfPrincipled")
b.inputs["Base Color"].default_value = (0.02, 0.0, 0.03, 1)
b.inputs["Metallic"].default_value = 1.0
b.inputs["Roughness"].default_value = 0.035
tc = n.new("ShaderNodeTexCoord")
mp = n.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (0.5, 1.6, 1)
l.new(tc.outputs["Object"], mp.inputs["Vector"])
nz = n.new("ShaderNodeTexNoise"); nz.noise_dimensions = "4D"; nz.inputs["Scale"].default_value = 1.4; nz.inputs["Detail"].default_value = 3
l.new(mp.outputs["Vector"], nz.inputs["Vector"])
bp = n.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.06
l.new(nz.outputs["Fac"], bp.inputs["Height"]); l.new(bp.outputs["Normal"], b.inputs["Normal"])
l.new(b.outputs[0], o.inputs["Surface"])
for f, wv in ((F0, 0.0), (F1, 1.2)):
    nz.inputs["W"].default_value = wv
    nz.inputs["W"].keyframe_insert("default_value", frame=f)
C.set_interp(sea, "LINEAR")
plane = C.box("sea", (4000, 4000, 0.01), loc=(0, 0, -0.005), mat=sea)

# ---------------------------------------------------------- sliced moon
moon_skin = C.painted("moon_skin", (1.0, 0.72, 0.18), dark=(0.9, 0.42, 0.06), light=(1.0, 0.88, 0.45),
                      rough=0.9, stroke=0.06, stretch=(1, 1, 1), fog=0, bump=0.0,
                      emit=(1.0, 0.7, 0.15), emit_strength=0.55)
moon_cut = C.emissive("moon_cut", (0.0, 0.85, 1.0), 5.0)
MOON = Vector((22, 260, 58))
R = 46
edges = [-R - 1, -27, -13, -2, 9, 21, 33, R + 1]
slabs = []
for i in range(len(edges) - 1):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=72, v_segments=36, radius=R)
    for x, keep_pos in ((edges[i], True), (edges[i + 1], False)):
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        res = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(x, 0, 0), plane_no=(1, 0, 0),
                                     clear_inner=keep_pos, clear_outer=not keep_pos)
        cut_edges = [e for e in res["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
        if cut_edges:
            filled = bmesh.ops.holes_fill(bm, edges=cut_edges, sides=0)
            for f in filled["faces"]:
                f.material_index = 1
    ob = C.mesh_obj(f"slab{i}", bm)
    ob.data.materials.append(moon_skin); ob.data.materials.append(moon_cut)
    for p in ob.data.polygons:
        p.use_smooth = p.material_index == 0
    ob.location = MOON
    ob.visible_shadow = False
    slabs.append(ob)
mid = (len(slabs) - 1) / 2
for i, ob in enumerate(slabs):
    k = i - mid
    for f in range(F0, F1 + 1, 4):
        t = (f - F0) / (F1 - F0)
        gap = 2.0 + 5.0 * C.ease(t)
        ob.location = MOON + Vector((k * gap, k * 1.5 * t, 3.0 * math.sin(k * 1.3) * t))
        ob.rotation_euler = (0.06 * k * t, 0, -0.03 * k * t)
        ob.keyframe_insert("location", frame=f); ob.keyframe_insert("rotation_euler", frame=f)

# ---------------------------------------------------------- gear rings
gear_m = C.toon("gear", lit=(0.05, 0.95, 0.85), shade=(0.0, 0.35, 0.55), light_dir=(0.3, 0.6, 0.75),
                bands=(0.28, 0.58), strength=1.0, rim=(1.0, 0.85, 0.3))
gold_m = C.toon("gold", lit=(1.0, 0.8, 0.2), shade=(0.7, 0.3, 0.05), light_dir=(0.3, 0.6, 0.75), bands=(0.28, 0.58), strength=1.1)


def gear_ring(name, loc, rot, Rr, spin):
    piv = C.empty(name, loc)
    piv.rotation_euler = rot
    body = C.torus(f"{name}_body", Rr, Rr * 0.07, mat=gear_m, major=128, minor=12)
    body.parent = piv
    inner = C.torus(f"{name}_inner", Rr * 0.86, Rr * 0.025, mat=gold_m, major=128, minor=8)
    inner.parent = piv
    n_t = 48
    for i in range(n_t):
        a = i * 2 * math.pi / n_t
        tooth = C.box(f"{name}_t{i}", (Rr * 0.07, Rr * 0.12, Rr * 0.09),
                      loc=(math.cos(a) * Rr * 1.08, math.sin(a) * Rr * 1.08, 0), rot=(0, 0, a), mat=gear_m)
        tooth.parent = piv
    for i in range(6):  # spokes
        a = i * math.pi / 3
        sp_ = C.box(f"{name}_s{i}", (Rr * 1.7, Rr * 0.03, Rr * 0.03), rot=(0, 0, a), mat=gold_m)
        sp_.parent = piv
    hub = C.cylinder(f"{name}_hub", Rr * 0.12, Rr * 0.08, mat=gold_m, verts=32)
    hub.parent = piv
    spinner = C.empty(f"{name}_spin", (0, 0, 0))
    for ob in list(piv.children):
        ob.parent = spinner
    spinner.parent = piv
    for f in (F0, F1):
        spinner.rotation_euler = (0, 0, spin * (f - F0) / C.FPS)
        spinner.keyframe_insert("rotation_euler", frame=f)
    C.set_interp(spinner, "LINEAR")
    for ob in spinner.children:
        ob.visible_shadow = False


gear_ring("ring_sunk", (-38, 150, 0), (math.pi / 2, 0, 0.35), 34, 0.05)          # half-sunk in the sea
gear_ring("ring_high", (34, 110, 62), (math.pi / 2 + 0.5, 0.3, -0.4), 15, -0.12)
gear_ring("ring_far", (-70, 260, 90), (math.pi / 2 - 0.3, 0.2, 0.6), 24, 0.08)

# ----------------------------------------------------------- monoliths
obsidian = C.painted("obsidian", (0.015, 0.008, 0.02), dark=(0.0, 0.0, 0.0), light=(0.04, 0.02, 0.05),
                     rough=0.15, metal=0.0, edge=(1.0, 0.75, 0.25), edge_w=0.08, stroke=1, fog=0.7, spec=0.8)
for k, (x, y, h, z0) in enumerate(((-9, 30, 6, 2.0), (12, 48, 9, 3.5), (-22, 80, 12, 5.0), (5, 18, 3.2, 1.2), (28, 70, 7, 6))):
    m = C.box(f"mono{k}", (h * 0.28, h * 0.12, h), loc=(x, y, z0 + h / 2), rot=(0, 0, rng.uniform(-0.5, 0.5)), mat=obsidian, bevel=0.04)
    for f in range(F0, F1 + 1, 4):
        m.location.z = z0 + h / 2 + 0.3 * math.sin(f * 0.13 + k)
        m.keyframe_insert("location", frame=f)

# ---------------------------------------------------------- toon clouds
cloud_m = C.toon("cloud", lit=(1.0, 0.62, 0.75), shade=(0.55, 0.12, 0.5), light_dir=(0.5, 0.7, 0.5),
                 bands=(0.3, 0.6), strength=1.0, rim=(1.0, 0.9, 0.6))
puffs = []
for k in range(60):
    cx = rng.uniform(-260, 260); cy = rng.uniform(330, 430); cz = rng.uniform(15, 60)
    puffs.append(dict(p0=(cx, cy, cz), vel=(rng.uniform(-2, 2), 0, 0), rise=(3, 0, 0), r0=rng.uniform(12, 26), r1=rng.uniform(14, 28),
                      t0=-200, life=10000, turb=0.0, drag=1.0))
C.smoke_puffs("clouds", puffs, cloud_m, (F0, F1), resolution=2.0, threshold=0.6).scale = (1, 1, 0.4)

# --------------------------------------------------------------- robot
import robot
rig, parts = robot.build()
rig.location = (0.6, 0, 0)
rig.rotation_euler = (0, 0, math.radians(190))  # back to camera, facing the moon
W = lambda bn, d: robot.world_offset(rig, bn, d)
for f in range(F0, F1 + 1):
    t = (f - F0) / (F1 - F0)
    b = 0.006 * math.sin(f * 0.2)  # idle servo hum
    robot.pose(rig, f,
               rots={"Head": (-0.3 - 0.12 * C.ease(t), 0, 0.05), "Chest": (-0.05 + b, 0, 0), "Torso": (0.0, 0, 0)},
               locs={"Torso": W("Torso", (0, 0, -0.03)),
                     "IK-Foot.L": W("IK-Foot.L", (0.08, 0, 0)), "IK-Foot.R": W("IK-Foot.R", (-0.08, 0.05, 0)),
                     "IK-Wrist.L": W("IK-Wrist.L", (0.05, 0.02, 0)), "IK-Wrist.R": W("IK-Wrist.R", (-0.05, 0.02, 0))})
# ripples spreading from her feet
ring_m = C.emissive("ripple", (0.0, 0.9, 1.0), 2)
for k in range(3):
    r = C.torus(f"ripple{k}", 1.0, 0.008, loc=(0.6, 0, 0.01), mat=ring_m, major=96, minor=6)
    for f, s in ((F0, 0.2 + k * 2.2), (F1, 0.2 + k * 2.2 + 4.5)):
        r.scale = (s, s, 1); r.keyframe_insert("scale", frame=f)
    C.set_interp(r, "LINEAR")

# gold motes rising off the water
mote = C.emissive("mote", (1.0, 0.75, 0.3), 10)
C.embers("mote", 50, ((-8, -4, 0), (10, 30, 4)), 0.05, mote, rng, (F0 - 2, F1 + 2), drift=(0.2, 0, 0.7))

# ------------------------------------------------------------- lighting
moon_sun = C.light("SUN", "moonlight", (0, 0, 0), 2.5, (1.0, 0.75, 0.45), size=math.radians(3))
moon_sun.rotation_euler = (Vector((0, 0, 0)) - MOON).to_track_quat("-Z", "Y").to_euler()
C.light("SUN", "skyfill", (0, 0, 0), 0.8, (0.9, 0.2, 0.7), rot=(math.radians(50), 0, math.radians(200)), size=0.5)

# --------------------------------------------------------------- camera
cam = C.camera("cam", (0, 0, 0), lens=24)
for f in range(F0, F1 + 1):
    t = (f - F0) / (F1 - F0)
    cam.location = (-2.0 + 3.0 * C.ease(t), -13.5 + 1.5 * C.ease(t), 0.55 + 0.25 * t)
    C.look_at(cam, (2.0 + 1.0 * t, 60, 13.5))
    cam.keyframe_insert("location", frame=f); cam.keyframe_insert("rotation_euler", frame=f)

C.compositor(scn, kuwahara=3.0, bloom=0.8, bloom_threshold=1.0, bloom_size=0.65, saturation=1.15, vignette=0.4)
C.finish(scn, "shot02c", C.args())
