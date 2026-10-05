"""Shot 3 — The Strike (26 frames, 1.1s).

White-out. As the flash decays, a teal-violet beam is revealed punching into
an old clocktower on a rubble spur; the clock face bursts outward, the
tower's cracks glow from inside, sparks rain.
"""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Euler, noise
import common as C

F0, F1 = 1, 26
rng = random.Random(33)
scn = C.reset()
C.setup_render(scn, (F0, F1), samples=40, motion_blur=True, shutter=0.4)
FOG = (0.05, 0.02, 0.025)
C.set_fog(scn, FOG, density=0.006, height=20, strength=1.0)
C.sky_world(scn, top=(0.008, 0.006, 0.012), horizon=(0.07, 0.025, 0.03), ground=FOG, stars=0.6)

stone = C.painted("stone", (0.09, 0.05, 0.055), dark=(0.025, 0.015, 0.02), light=(0.17, 0.1, 0.1),
                  rough=0.9, edge=(0.35, 0.25, 0.3), edge_w=0.08, stroke=0.8, stretch=(1, 1, 3))
stone_far = C.painted("stone_far", (0.06, 0.035, 0.04), rough=0.95, bump=0.2, stroke=0.5)
iron = C.painted("iron", (0.05, 0.035, 0.04), rough=0.5, metal=0.7, edge=(0.3, 0.25, 0.3), edge_w=0.04)
clock_m = C.painted("clockface", (0.3, 0.24, 0.18), dark=(0.12, 0.08, 0.06), rough=0.6, stroke=2, emit=(0.2, 0.8, 1.0), emit_strength=0.0)
crack_m = C.emissive("crack", (0.15, 0.7, 1.0), 0.0)
crack_em = crack_m.node_tree.nodes["Emission"].inputs["Strength"]
TOWER = Vector((3.0, 0.0, 0.0))
IMPACT = TOWER + Vector((-0.2, -2.15, 15.0))

# ------------------------------------------------------------- terrain
bm = bmesh.new()
bmesh.ops.create_icosphere(bm, subdivisions=5, radius=1.0)
for v in bm.verts:
    n = noise.fractal(v.co * 2.2, 0.6, 2.0, 5)
    v.co *= 1 + 0.35 * n
    v.co.x *= 16; v.co.y *= 11; v.co.z *= 7
mound = C.mesh_obj("mound", bm, stone_far, smooth=True)
mound.location = TOWER + Vector((0, 2, -4.5))
# rubble chunks spilling down the slope
for k in range(60):
    a = rng.uniform(0, 2 * math.pi)
    r = rng.uniform(3, 14)
    s = rng.uniform(0.3, 1.4)
    p = TOWER + Vector((math.cos(a) * r, math.sin(a) * r * 0.7 - 1, 0))
    p.z = max(-3, 2.2 - r * 0.45 + rng.uniform(-0.5, 0.5))
    C.box(f"rubble{k}", (s, s * rng.uniform(0.5, 1.2), s * rng.uniform(0.4, 0.9)), loc=p,
          rot=(rng.uniform(0, 3), rng.uniform(0, 3), rng.uniform(0, 3)), mat=stone, bevel=0.05)

# --------------------------------------------------------------- tower
T = C.collection("tower")


def tb(name, size, loc, rot=(0, 0, 0), mat=stone, taper=None, bevel=0.06):
    return C.box(name, size, loc=TOWER + Vector(loc), rot=rot, mat=mat, coll=T, taper=taper, bevel=bevel)


tb("base", (5.4, 5.4, 4), (0, 0, 2))
tb("plinth", (6.0, 6.0, 0.6), (0, 0, 4.1))
tb("shaft", (4.2, 4.2, 10), (0, 0, 9.3), taper=(0.92, 0.92))
for z in (6.5, 10.0, 13.0):
    tb(f"ledge{z}", (4.8, 4.8, 0.35), (0, 0, z))
for sx in (-1, 1):  # corner buttresses
    for sy in (-1, 1):
        tb(f"butt{sx}{sy}", (0.8, 0.8, 9), (sx * 2.15, sy * 2.15, 8.5), taper=(0.7, 0.7))
tb("clock_block", (4.6, 4.6, 3.6), (0, 0, 15.2))
tb("crown_l", (1.2, 4.0, 3.2), (-1.6, 0, 18.4), rot=(0, 0.08, 0), taper=(0.6, 0.8))
tb("crown_r", (1.0, 3.6, 2.0), (1.8, 0.2, 17.8), rot=(0, -0.2, 0.1), taper=(0.5, 0.7))
tb("crown_back", (4.0, 1.0, 2.6), (0, 1.7, 18.0), rot=(0.1, 0, 0), taper=(0.75, 0.6))
# leaning spire, snapped
sp = C.cylinder("spire", 0.9, 6.5, loc=TOWER + Vector((-1.2, 0.7, 22.0)), rot=(0.25, -0.35, 0), r2=0.05,
                mat=stone, coll=T, verts=8, smooth=False)
# exposed iron beams through the broken crown
for k in range(6):
    C.box(f"beam{k}", (0.18, 0.18, rng.uniform(2.5, 5)), loc=TOWER + Vector((rng.uniform(-1.5, 1.5), rng.uniform(-1.2, 1.2), 18.5)),
          rot=(rng.uniform(-0.7, 0.7), rng.uniform(-0.7, 0.7), 0), mat=iron, coll=T)
# windows: dark recesses with a teal ember glow appearing once struck
for z in (8.0, 11.5):
    for x in (-0.9, 0.9):
        tb(f"win{z}{x}", (0.7, 0.3, 1.6), (x, -2.02, z), mat=crack_m, bevel=0.0)
        tb(f"arch{z}{x}", (0.95, 0.35, 0.25), (x, -2.1, z + 0.9), bevel=0.02)
# glowing fracture lines down the shaft (thin emissive zig-zags)
for k in range(5):
    pts = C.bolt_points(TOWER + Vector((rng.uniform(-1.6, 1.6), -2.13, 14.2)),
                        TOWER + Vector((rng.uniform(-1.8, 1.8), -2.13, rng.uniform(6, 11))), rng, depth=5, jag=0.12)
    for p in pts:
        p.y = TOWER.y - 2.14
    cu = bpy.data.curves.new(f"frac{k}", "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 0.03
    spl = cu.splines.new("POLY"); spl.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        spl.points[i].co = (*p, 1)
        spl.points[i].radius = 1 - 0.8 * i / len(pts)
    cu.materials.append(crack_m)
    C.link(bpy.data.objects.new(f"frac{k}", cu), T)

# clock: rim, numerals, hands — face split into wedges that burst outward
CLK = TOWER + Vector((0, -2.32, 15.2))
rim = C.torus("clock_rim", 1.55, 0.12, loc=CLK, rot=(math.pi / 2, 0, 0), mat=iron, coll=T)
for k in range(12):
    a = k * math.pi / 6
    C.box(f"tick{k}", (0.08, 0.06, 0.28), loc=CLK + Vector((math.sin(a) * 1.3, -0.05, math.cos(a) * 1.3)),
          rot=(0, a, 0), mat=iron, coll=T)
wedges = []
for k in range(14):
    a0 = k * 2 * math.pi / 14
    a1 = (k + 1) * 2 * math.pi / 14
    bm = bmesh.new()
    vs = []
    for r in (0.15, 1.45):
        for a in (a0, a1):
            for y in (0.0, 0.12):
                vs.append(bm.verts.new((math.sin(a) * r, y, math.cos(a) * r)))
    bmesh.ops.convex_hull(bm, input=vs)
    w = C.mesh_obj(f"wedge{k}", bm, clock_m, T)
    w.location = CLK
    mid = (a0 + a1) / 2
    wedges.append((w, Vector((math.sin(mid), 0, math.cos(mid)))))
for k, (w, d) in enumerate(wedges):
    vel = (d * rng.uniform(4, 9) + Vector((rng.uniform(-2, 2), -rng.uniform(6, 14), rng.uniform(0, 4))))
    spin = Vector((rng.uniform(-9, 9), rng.uniform(-9, 9), rng.uniform(-9, 9)))
    for f in range(F0, F1 + 1):
        t = max(0, (f - 2) / C.FPS)
        w.location = CLK + vel * t + Vector((0, 0, -4.9 * t * t))
        w.rotation_euler = spin * t
        w.keyframe_insert("location", frame=f); w.keyframe_insert("rotation_euler", frame=f)
hands = []
for k, (L, wdt) in enumerate(((1.1, 0.1), (0.75, 0.14))):
    h = C.box(f"hand{k}", (wdt, 0.05, L), loc=CLK + Vector((0, -0.2, L / 2)), mat=iron, coll=T)
    h.rotation_euler = (0, 0.6 + k * 2.1, 0)
    vel = Vector((rng.uniform(-3, 3), -10, rng.uniform(2, 5)))
    for f in range(F0, F1 + 1):
        t = max(0, (f - 2) / C.FPS)
        h.location = CLK + Vector((0, -0.2, L / 2)) + vel * t + Vector((0, 0, -4.9 * t * t))
        h.rotation_euler = (t * 6, 0.6 + k * 2.1 + t * 12, 0)
        h.keyframe_insert("location", frame=f); h.keyframe_insert("rotation_euler", frame=f)

# --------------------------------------------------------- ruins behind
for k in range(26):
    x = rng.uniform(-70, 70)
    y = rng.uniform(70, 170)
    h = rng.uniform(5, 22)
    C.box(f"far{k}", (rng.uniform(4, 10), 6, h), loc=(x, y, -5 + h / 2), mat=stone_far, taper=(rng.uniform(0.5, 1), 1))
    if rng.random() < 0.4:
        C.cylinder(f"stack{k}", 0.8, h * 0.8, loc=(x + 2, y, -5 + h + h * 0.4 - 1), r2=0.6, mat=stone_far, verts=10)

# ----------------------------------------------------------------- beam
BEAM_FROM = Vector((-60, -30, 55))
beam_dir = (IMPACT - BEAM_FROM)
beam_len = beam_dir.length
beam_rot = beam_dir.to_track_quat("Z", "Y").to_euler()
mid = (BEAM_FROM + IMPACT) / 2

core_m = C.emissive("beam_core", (0.75, 0.95, 1.0), 60)
glow_m = bpy.data.materials.new("beam_glow")
nt, n, l = C._nodes(glow_m)
out = n.new("ShaderNodeOutputMaterial")
lw = n.new("ShaderNodeLayerWeight"); lw.inputs["Blend"].default_value = 0.5
ramp = n.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].position = 0.0; ramp.color_ramp.elements[0].color = (0.25, 0.6, 1.0, 1)
ramp.color_ramp.elements[1].position = 1.0; ramp.color_ramp.elements[1].color = (0.0, 0.0, 0.0, 1)
l.new(lw.outputs["Facing"], ramp.inputs["Fac"])
em = n.new("ShaderNodeEmission"); em.inputs["Strength"].default_value = 18
l.new(ramp.outputs["Color"], em.inputs["Color"])
tr = n.new("ShaderNodeBsdfTransparent")
add = n.new("ShaderNodeAddShader")
l.new(em.outputs[0], add.inputs[0]); l.new(tr.outputs[0], add.inputs[1])
l.new(add.outputs[0], out.inputs["Surface"])
outer_m = C.emissive("beam_outer", (0.35, 0.15, 1.0), 6)

core = C.cylinder("beam_core", 0.09, beam_len, loc=mid, rot=beam_rot, mat=core_m, verts=12)
glow = C.cylinder("beam_glow", 0.45, beam_len, loc=mid, rot=beam_rot, mat=glow_m, verts=24)
for ob in (core, glow):
    ob.visible_shadow = False
for f in range(F0, F1 + 1):  # beam pulses and thins as it spends itself
    t = (f - F0) / (F1 - F0)
    w = (1.0 - 0.55 * t) * (1 + 0.15 * math.sin(f * 2.3))
    core.scale = (w, w, 1); glow.scale = (w * 1.2, w * 1.2, 1)
    core.keyframe_insert("scale", frame=f); glow.keyframe_insert("scale", frame=f)

bolt_m = C.emissive("bolt", (0.55, 0.85, 1.0), 40)
bolt_v = C.emissive("bolt_violet", (0.5, 0.25, 1.0), 25)


def beam_bolts(name, r):
    obs = []
    for j in range(3):
        a = BEAM_FROM + beam_dir * r.uniform(0.35, 0.8)
        b = IMPACT + Vector((r.uniform(-1, 1), r.uniform(-1, 0.5), r.uniform(-1, 1)))
        obs.append(C.bolt(f"{name}_{j}", a, b, r, width=0.05, mat=bolt_m if j else bolt_v, depth=6, jag=0.06, branches=2, branch_len=0.08))
    # arcs crawling over the tower face from the impact
    for j in range(3):
        b = IMPACT + Vector((r.uniform(-2.5, 2.5), r.uniform(-0.3, 0.2), r.uniform(-5, 2)))
        obs.append(C.bolt(f"{name}_t{j}", IMPACT, b, r, width=0.035, mat=bolt_m, depth=5, jag=0.25, branches=2))
    return obs


for f in range(F0, F1 + 1):
    for ob in beam_bolts(f"bolt{f}", random.Random(f * 13)):
        C.visible_between(ob, f, f)

# impact: white-hot ball that starts as a frame-filling flash and shrinks
flash_m = C.emissive("flash", (0.8, 0.95, 1.0), 200)
flash_em = flash_m.node_tree.nodes["Emission"].inputs["Strength"]
flash = C.sphere("flash", 1.0, loc=IMPACT, mat=flash_m, segs=32, rings=16)
flash.visible_shadow = False
for f, s, e in ((F0, 22, 400), (2, 14, 200), (3, 6, 90), (5, 1.8, 60), (8, 1.0, 50), (14, 0.8, 40), (F1, 0.6, 30)):
    flash.scale = (s, s, s); flash_em.default_value = e
    flash.keyframe_insert("scale", frame=f); flash_em.keyframe_insert("default_value", frame=f)
halo_m = glow_m.copy()
halo_m.node_tree.nodes["Emission"].inputs["Strength"].default_value = 3.5
_r = halo_m.node_tree.nodes["Color Ramp"].color_ramp
_r.elements[0].color = (0.3, 0.55, 1.0, 1); _r.elements[1].position = 0.55
halo = C.sphere("halo", 1.0, loc=IMPACT, mat=halo_m, segs=32, rings=16)
halo.visible_shadow = False
for f, s in ((F0, 30), (3, 8), (8, 3.2), (F1, 2.4)):
    halo.scale = (s, s, s); halo.keyframe_insert("scale", frame=f)

# sparks: streaks thrown from the impact, motion-blurred
spark_m = C.emissive("spark", (0.6, 0.9, 1.0), 30)
for k in range(70):
    sp_ = C.box(f"spark{k}", (0.04, 0.04, 0.4), mat=spark_m)
    sp_.visible_shadow = False
    v = Vector((rng.uniform(-1, 1), rng.uniform(-1.4, 0.2), rng.uniform(-0.4, 1.2))).normalized() * rng.uniform(8, 22)
    t0 = rng.uniform(1, 6)
    for f in range(F0, F1 + 1):
        t = max(0, (f - t0) / C.FPS)
        p = IMPACT + v * t + Vector((0, 0, -9.8 * t * t * 0.5))
        sp_.location = p
        sp_.rotation_euler = (v + Vector((0, 0, -9.8 * t))).to_track_quat("Z", "Y").to_euler()
        s = 0.0 if f < t0 else max(0.0, 1 - t * 1.2)
        sp_.scale = (s, s, s)
        sp_.keyframe_insert("location", frame=f); sp_.keyframe_insert("rotation_euler", frame=f); sp_.keyframe_insert("scale", frame=f)

for f, s in ((F0, 0.0), (3, 0.0), (5, 25.0), (12, 12.0), (F1, 8.0)):
    crack_em.default_value = s
    crack_em.keyframe_insert("default_value", frame=f)

# ------------------------------------------------------------- lighting
hit = C.light("POINT", "impact", IMPACT + Vector((0, -1.5, 0)), 0, (0.3, 0.75, 1.0), size=1.0)
for f, e in ((F0, 1.5e5), (3, 4e4), (6, 9e3), (12, 5e3), (F1, 3.5e3)):
    hit.data.energy = e; hit.data.keyframe_insert("energy", frame=f)
C.light("AREA", "rim_back", TOWER + Vector((4, 14, 18)), 9000, (0.35, 0.6, 1.0), size=6, target=TOWER + Vector((0, 0, 12)))
C.light("SUN", "skyred", (0, 0, 0), 0.8, (1.0, 0.25, 0.2), rot=(math.radians(75), 0, math.radians(160)), size=0.1)
C.light("SUN", "fill", (0, 0, 0), 0.15, (0.4, 0.4, 0.9), rot=(math.radians(50), 0, math.radians(-30)), size=0.5)

# --------------------------------------------------------------- camera
cam = C.camera("cam", (-5, -40, 3.0), lens=30)
C.look_at(cam, TOWER + Vector((-8.0, 0, 13.5)))
C.shake(cam, (F0, F1), amp=0.0, rot_amp=0.0)  # base keys
r0 = cam.rotation_euler.copy(); l0 = cam.location.copy()
for f in range(F0, F1 + 1):  # impact jolt decaying
    t = (f - F0) / C.FPS
    amp = 0.012 * math.exp(-t * 4)
    nv = noise.noise_vector(Vector((f * 0.7, 1, 0)))
    cam.rotation_euler = (r0.x + nv.x * amp, r0.y + nv.y * amp, r0.z + nv.z * amp)
    cam.location = l0 + Vector((0, 0.9 * t, 0))
    cam.keyframe_insert("rotation_euler", frame=f); cam.keyframe_insert("location", frame=f)

C.compositor(scn, kuwahara=3.0, bloom=0.9, bloom_threshold=1.0, bloom_size=0.7, lift=(0.99, 0.98, 1.03),
             gamma=(1.0, 0.98, 1.02), gain=(1.0, 1.0, 1.04), saturation=1.05, vignette=0.5, streaks=0.0)
C.finish(scn, "shot03", C.args())
