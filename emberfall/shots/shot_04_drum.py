"""Shot 4 — Load (24 frames, 1.0s).

Straight down onto the gauntlet's capacitor drum. It ratchets one chamber,
the cells ignite in sequence, and pressure vents in two plumes of soot.
"""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Euler, noise
import common as C

F0, F1 = 1, 24
rng = random.Random(44)
scn = C.reset()
C.setup_render(scn, (F0, F1), samples=40, motion_blur=True, shutter=0.35)
C.set_fog(scn, (0.05, 0.01, 0.01), density=0.0, height=10, strength=1.0)
C.sky_world(scn, top=(0.02, 0.005, 0.005), horizon=(0.02, 0.005, 0.005), strength=1.0)

enamel = C.painted("enamel", (0.32, 0.03, 0.035), dark=(0.11, 0.008, 0.015), light=(0.5, 0.08, 0.06),
                   rough=0.42, metal=0.3, edge=(0.95, 0.55, 0.4), edge_w=0.025, stroke=3, stretch=(1, 1, 1), fog=0)
brass = C.painted("brass", (0.4, 0.22, 0.08), dark=(0.15, 0.07, 0.03), light=(0.7, 0.45, 0.2),
                  rough=0.3, metal=1.0, edge=(1.0, 0.8, 0.5), edge_w=0.015, stroke=5, fog=0)
iron = C.painted("iron", (0.06, 0.045, 0.05), dark=(0.02, 0.015, 0.02), rough=0.45, metal=0.8,
                 edge=(0.5, 0.35, 0.3), edge_w=0.015, stroke=5, fog=0)
leather = C.painted("leather", (0.09, 0.04, 0.035), rough=0.6, stroke=8, fog=0)
ground = C.painted("ground", (0.3, 0.05, 0.04), dark=(0.12, 0.02, 0.02), light=(0.45, 0.1, 0.07),
                   rough=0.95, stroke=0.6, stretch=(1, 1, 1), fog=0, bump=0.3)
glass = C.glass("cellglass", (0.9, 0.95, 1.0), rough=0.05, ior=1.4)

# ------------------------------------------------------------- housing
# arm plate the drum sits on: a long brass-trimmed iron cradle
C.box("cradle", (1.9, 3.6, 0.3), loc=(0, 0.3, -0.45), mat=iron, bevel=0.06)
C.box("cradle_trim", (2.05, 3.7, 0.08), loc=(0, 0.3, -0.28), mat=brass, bevel=0.02)
for sx in (-1, 1):
    C.box(f"rail{sx}", (0.18, 3.8, 0.2), loc=(sx * 1.08, 0.3, -0.2), mat=brass, bevel=0.03)
    for k in range(9):  # rivets
        C.sphere(f"riv{sx}{k}", 0.035, loc=(sx * 1.08, -1.4 + k * 0.42, -0.09), mat=iron, segs=10, rings=5)
    # feed pipes curling off frame
    cu = bpy.data.curves.new(f"pipe{sx}", "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 0.07; cu.bevel_resolution = 3
    spl = cu.splines.new("BEZIER"); spl.bezier_points.add(2)
    for i, p in enumerate(((sx * 0.7, -1.3, -0.1), (sx * 1.5, -1.9, -0.15), (sx * 1.7, -3.2, -0.3))):
        bp = spl.bezier_points[i]; bp.co = p; bp.handle_left_type = bp.handle_right_type = "AUTO"
    cu.materials.append(brass)
    C.link(bpy.data.objects.new(f"pipe{sx}", cu))
# leather sleeve/forearm continuing below the cradle
C.cylinder("forearm", 1.15, 6, loc=(0, 3.5, -1.3), rot=(math.pi / 2, 0, 0), mat=leather, verts=32)
for k in range(3):
    C.torus(f"strap{k}", 1.18, 0.06, loc=(0, 1.6 + k * 0.9, -1.3), rot=(math.pi / 2, 0, 0), mat=brass)
# the ground far below, blurred by depth of field
C.box("ground", (60, 60, 0.5), loc=(0, 0, -14), mat=ground)
for k in range(30):  # cobbles and debris for texture in the blur
    s = rng.uniform(0.4, 1.6)
    C.box(f"cob{k}", (s, s * 0.8, 0.3), loc=(rng.uniform(-12, 12), rng.uniform(-7, 7), -13.6),
          rot=(0, 0, rng.uniform(0, 3)), mat=ground)

# ---------------------------------------------------------------- drum
DR = C.empty("drum_pivot", (0, 0, 0))
drum = C.cylinder("drum", 1.0, 0.55, loc=(0, 0, 0), mat=enamel, verts=96, bevel=0.03)
drum.parent = DR
# six chamber bores (one boolean against a merged cutter)
cut_bm = bmesh.new()
for k in range(6):
    a = k * math.pi / 3
    tmp = bmesh.new()
    bmesh.ops.create_cone(tmp, cap_ends=True, segments=40, radius1=0.21, radius2=0.21, depth=0.5)
    bmesh.ops.translate(tmp, verts=tmp.verts, vec=(math.cos(a) * 0.6, math.sin(a) * 0.6, 0.2))
    me = bpy.data.meshes.new("t"); tmp.to_mesh(me); tmp.free(); cut_bm.from_mesh(me); bpy.data.meshes.remove(me)
cutter = C.mesh_obj("cutter", cut_bm)
cutter.hide_render = True; cutter.hide_viewport = True
bo = drum.modifiers.new("bores", "BOOLEAN"); bo.object = cutter; bo.solver = "EXACT"
drum.modifiers.move(1, 0)
# outer ratchet teeth
for k in range(36):
    a = k * 2 * math.pi / 36
    t = C.box(f"tooth{k}", (0.09, 0.12, 0.42), loc=(math.cos(a) * 1.03, math.sin(a) * 1.03, 0), rot=(0, 0, a), mat=iron, bevel=0.01)
    t.parent = DR
# hub, hex nut, rivet ring, engraved rings
C.cylinder("hub", 0.3, 0.2, loc=(0, 0, 0.33), mat=enamel, verts=48, bevel=0.02).parent = DR
C.cylinder("nut", 0.15, 0.12, loc=(0, 0, 0.47), mat=brass, verts=6, smooth=False, bevel=0.01).parent = DR
C.torus("ring_in", 0.38, 0.018, loc=(0, 0, 0.28), mat=brass).parent = DR
C.torus("ring_out", 0.88, 0.02, loc=(0, 0, 0.28), mat=brass).parent = DR
for k in range(18):
    a = k * 2 * math.pi / 18 + 0.17
    C.sphere(f"drv{k}", 0.025, loc=(math.cos(a) * 0.93, math.sin(a) * 0.93, 0.28), mat=brass, segs=10, rings=5).parent = DR
# cells: glass capsules with a hot core, each with a brass collar
cores = []
for k in range(6):
    a = k * math.pi / 3
    c = Vector((math.cos(a) * 0.6, math.sin(a) * 0.6, 0))
    C.torus(f"collar{k}", 0.215, 0.025, loc=c + Vector((0, 0, 0.28)), mat=brass).parent = DR
    cap = C.sphere(f"cell{k}", 0.17, loc=c + Vector((0, 0, 0.12)), mat=glass, segs=24, rings=12, scale=(1, 1, 0.9))
    cap.parent = DR
    cm = C.emissive(f"core{k}", (0.15, 0.7, 1.0), 0.0)
    core = C.sphere(f"core{k}", 0.09, loc=c + Vector((0, 0, 0.12)), mat=cm, segs=16, rings=8)
    core.parent = DR
    # filament cross
    for j in range(2):
        C.box(f"fil{k}{j}", (0.16, 0.012, 0.012), loc=c + Vector((0, 0, 0.12)), rot=(0, 0, a + j * math.pi / 2), mat=cm).parent = DR
    cores.append(cm.node_tree.nodes["Emission"].inputs["Strength"])

# pawl / latch that kicks as the drum indexes
pawl = C.box("pawl", (0.16, 0.5, 0.14), loc=(1.22, -0.25, 0.1), rot=(0, 0, 0.5), mat=brass, bevel=0.02)

# ratchet: rotate 60 degrees with overshoot, frames 3-9
for f, ang in ((F0, 0.0), (3, 0.0), (6, math.radians(66)), (8, math.radians(57)), (10, math.radians(60.5)), (F1, math.radians(60))):
    DR.rotation_euler = (0, 0, ang)
    DR.keyframe_insert("rotation_euler", frame=f)
for f, ang in ((F0, 0.5), (3, 0.5), (5, 0.85), (8, 0.5), (F1, 0.5)):
    pawl.rotation_euler = (0, 0, ang); pawl.keyframe_insert("rotation_euler", frame=f)
# cells ignite one after another after the click
order = [0, 1, 2, 3, 4, 5]
for i, k in enumerate(order):
    s = cores[k]
    t0 = 7 + i * 2
    for f, v in ((F0, 0.0), (t0, 0.0), (t0 + 1, 30.0), (t0 + 3, 8.0), (F1, 9.0)):
        s.default_value = v
        s.keyframe_insert("default_value", frame=f)

# ----------------------------------------------------------- vent soot
soot = C.toon("soot", lit=(0.03, 0.022, 0.026), shade=(0.01, 0.007, 0.009), light_dir=(-0.3, 0.4, 0.85), bands=(0.25, 0.6))
for sx in (-1, 1):
    puffs = []
    for k in range(18):
        t0 = 5 + k * 0.9 + rng.uniform(0, 1)
        puffs.append(dict(p0=(sx * 1.3, rng.uniform(-0.25, 0.25), 0.1 + rng.uniform(-0.1, 0.1)),
                          vel=(sx * rng.uniform(4, 6.5), rng.uniform(-1.2, 1.2), rng.uniform(-0.2, 0.6)),
                          r0=0.15, r1=rng.uniform(0.45, 0.85), t0=t0, life=rng.uniform(14, 22), turb=0.25, drag=1.6))
    C.smoke_puffs(f"soot{sx}", puffs, soot, (F0, F1), resolution=0.05)
    C.box(f"vent{sx}", (0.25, 0.5, 0.18), loc=(sx * 1.25, 0, 0.0), mat=iron, bevel=0.02)

# ------------------------------------------------------------- lighting
C.light("AREA", "key", (-3, -2, 6), 110, (1.0, 0.55, 0.45), size=2.5, target=(0, 0, 0))
C.light("AREA", "rim", (3, 3, 2), 120, (1.0, 0.2, 0.15), size=2, target=(0, 0, 0))
glow = C.light("POINT", "cellglow", (0, 0, 0.8), 0, (0.35, 0.8, 1.0), size=0.3)
for f, e in ((F0, 0), (7, 0), (9, 15), (19, 60), (F1, 65)):
    glow.data.energy = e; glow.data.keyframe_insert("energy", frame=f)
C.light("SUN", "groundlight", (0, 0, 0), 0.9, (1.0, 0.25, 0.18), rot=(math.radians(20), 0, 0), size=0.2)

# --------------------------------------------------------------- camera
cam = C.camera("cam", (0, 0, 7.6), rot=(0, 0, 0), lens=40, dof=(6.0, 1.6))
for f in range(F0, F1 + 1):
    t = (f - F0) / (F1 - F0)
    kick = 0.04 * math.exp(-max(0, f - 6) * 0.6) * (1 if f >= 6 else 0)
    cam.location = (0.0 + kick * math.sin(f * 3), -0.05 + kick * math.cos(f * 2.1), 7.6 - 0.7 * C.ease(t))
    cam.rotation_euler = (0, 0, math.radians(-8 + 6 * t))
    cam.keyframe_insert("location", frame=f); cam.keyframe_insert("rotation_euler", frame=f)
cam.data.dof.focus_object = DR

C.compositor(scn, kuwahara=3.0, bloom=0.8, bloom_threshold=0.9, lift=(1.0, 0.98, 1.0), gain=(1.05, 1.0, 0.98),
             saturation=1.05, vignette=0.6)
C.finish(scn, "shot04", C.args())
