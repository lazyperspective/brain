"""Shot 7 — Aftermath (36 frames, 1.5s).

Wide on the ruins: from the crater a cel-shaded plume of spent charge rolls
out on the wind, cyan at the source cooling to violet, while the city stands
in maroon silhouette.
"""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Euler, noise
import common as C

F0, F1 = 1, 36
rng = random.Random(77)
scn = C.reset()
C.setup_render(scn, (F0, F1), samples=32)
FOG = (0.07, 0.022, 0.022)
C.set_fog(scn, FOG, density=0.012, height=14, strength=1.0)
C.sky_world(scn, top=(0.012, 0.006, 0.01), horizon=(0.085, 0.025, 0.025), ground=FOG, stars=0.4)

ruin = C.painted("ruin", (0.1, 0.035, 0.035), dark=(0.035, 0.012, 0.014), light=(0.17, 0.06, 0.055),
                 rough=0.9, edge=(0.3, 0.1, 0.09), edge_w=0.1, stroke=0.6, stretch=(1, 1, 3))
ruin_far = C.painted("ruin_far", (0.08, 0.03, 0.03), rough=0.95, bump=0.15, stroke=0.4)
ground_m = C.painted("ground", (0.09, 0.03, 0.028), dark=(0.03, 0.01, 0.01), rough=0.95, stroke=0.3, bump=0.3)
iron = C.painted("iron", (0.05, 0.03, 0.035), rough=0.6, metal=0.6, edge=(0.3, 0.12, 0.1), edge_w=0.05)

SRC = Vector((-9, 0, 0.5))

# ------------------------------------------------------------- terrain
bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=120, y_segments=80, size=1)
for v in bm.verts:
    v.co.x *= 140; v.co.y *= 100
    v.co.y += 60
    d = (Vector((v.co.x, v.co.y)) - SRC.xy).length
    v.co.z = noise.fractal(Vector((v.co.x * 0.05, v.co.y * 0.05, 0)), 0.5, 2.0, 4) * 1.5 - 0.5
    v.co.z -= 1.8 * math.exp(-(d / 3.5) ** 2)       # crater
    v.co.z += 0.8 * math.exp(-((d - 4.5) / 1.2) ** 2)  # thrown lip
C.mesh_obj("terrain", bm, ground_m, smooth=True)

# ruined skyline in three depth bands
k = 0
for (y0, y1, hmin, hmax, n) in ((25, 45, 4, 14, 14), (50, 90, 8, 24, 18), (100, 160, 12, 40, 22)):
    for _ in range(n):
        x = rng.uniform(-80, 80)
        y = rng.uniform(y0, y1)
        w = rng.uniform(3, 9)
        h = rng.uniform(hmin, hmax)
        mat = ruin if y < 50 else ruin_far
        C.box(f"b{k}", (w, rng.uniform(3, 8), h), loc=(x, y, h / 2 - 1), mat=mat, taper=(rng.uniform(0.6, 1), 1))
        for j in range(rng.randint(1, 4)):  # broken crown
            bh = rng.uniform(0.5, 4)
            C.box(f"b{k}c{j}", (w * rng.uniform(0.15, 0.35), 2, bh), loc=(x + rng.uniform(-w, w) * 0.35, y, h - 1 + bh / 2 - 0.2),
                  rot=(0, rng.uniform(-0.3, 0.3), 0), mat=mat)
        if rng.random() < 0.4:
            sh = rng.uniform(6, 16)
            C.cylinder(f"b{k}s", rng.uniform(0.5, 1.1), sh, loc=(x, y, h + sh / 2 - 1.5), r2=rng.uniform(0.4, 0.8), mat=mat, verts=10)
        if rng.random() < 0.25:
            C.box(f"b{k}crane", (0.4, rng.uniform(10, 18), 0.5), loc=(x, y - 4, h + 4), rot=(rng.uniform(-0.4, -0.1), 0, rng.uniform(-1, 1)), mat=mat)
        k += 1

# near wreckage: a toppled gantry and pipes framing the left of frame
for j in range(5):
    C.box(f"gantry{j}", (0.35, 0.35, 9), loc=(-16 + j * 1.8, -6 + j * 0.4, 2.5), rot=(0.2, 0.55 + j * 0.05, 0.1), mat=iron)
C.box("gantry_top", (10, 0.4, 0.5), loc=(-12, -5, 6.2), rot=(0, 0.3, 0.2), mat=iron)
cu = bpy.data.curves.new("pipe", "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 0.5; cu.bevel_resolution = 4
spl = cu.splines.new("BEZIER"); spl.bezier_points.add(2)
for i, p in enumerate(((-24, -9, -0.5), (-17, -8, 1.2), (-12, -12, -0.3))):
    bp = spl.bezier_points[i]; bp.co = p; bp.handle_left_type = bp.handle_right_type = "AUTO"
cu.materials.append(iron)
C.link(bpy.data.objects.new("pipe", cu))
for j in range(14):  # rubble
    s = rng.uniform(0.4, 2.0)
    C.box(f"rub{j}", (s, s, s * 0.7), loc=(rng.uniform(-22, 18), rng.uniform(-8, 10), 0),
          rot=(rng.uniform(0, 3), rng.uniform(0, 3), rng.uniform(0, 3)), mat=ruin, bevel=0.06)

# the spent round, half-buried, still glowing
shell_m = C.painted("shell", (0.32, 0.03, 0.035), rough=0.4, metal=0.3, edge=(1.0, 0.55, 0.4), edge_w=0.03, fog=0.4)
glow_m = C.emissive("shellglow", (0.2, 0.9, 1.0), 25)
sh = C.cylinder("shell", 0.3, 1.1, loc=SRC + Vector((0, 0, -0.1)), rot=(0.9, 0.3, 0), mat=shell_m, verts=24)
C.cylinder("shell_core", 0.24, 0.25, loc=SRC + Vector((0.05, -0.15, 0.25)), rot=(0.9, 0.3, 0), mat=glow_m, verts=24)

# ---------------------------------------------------------------- plume
plume_m = C.toon("plume", lit=(1.0, 1.0, 1.0), shade=(0.55, 0.55, 0.62), light_dir=(-0.3, -0.5, 0.8),
                 bands=(0.3, 0.6), strength=0.75, rim=(0.75, 0.95, 1.0),
                 gradient=("X", SRC.x, SRC.x + 30, (0.05, 0.5, 1.0), (0.45, 0.08, 1.0)))
puffs = []
N = 110
for i in range(N):
    t0 = -40 + i * (F1 + 40) / N + rng.uniform(-0.3, 0.3)
    spread = rng.uniform(-1, 1)
    puffs.append(dict(
        p0=tuple(SRC + Vector((0.3, rng.uniform(-0.3, 0.3), 0.6))),
        vel=(rng.uniform(13, 19), rng.uniform(-2, 2), rng.uniform(3.5, 6.5) + spread * 1.5),
        rise=(3.2, 0, 0.9),
        r0=0.7, r1=rng.uniform(2.6, 4.4), t0=t0, life=rng.uniform(70, 90), turb=1.0, drag=0.5))
C.smoke_puffs("plume", puffs, plume_m, (F0, F1), resolution=0.22, threshold=0.6)
# a tight, bright jet right at the source
jet_m = C.toon("jet", lit=(0.6, 0.95, 1.0), shade=(0.15, 0.6, 1.0), light_dir=(-0.3, -0.5, 0.8), bands=(0.3, 0.6), strength=1.6)
puffs = []
for i in range(40):
    t0 = -10 + i * (F1 + 10) / 40
    puffs.append(dict(p0=tuple(SRC + Vector((0.3, 0, 0.6))), vel=(rng.uniform(7, 10), rng.uniform(-0.5, 0.5), rng.uniform(1.8, 3.0)),
                      r0=0.25, r1=rng.uniform(0.7, 1.2), t0=t0, life=18, turb=0.15, drag=1.5))
C.smoke_puffs("jet", puffs, jet_m, (F0, F1), resolution=0.08)

# sparks drifting off the plume
spark_m = C.emissive("spark", (0.4, 0.95, 1.0), 20)
C.embers("spark", 40, ((-8, -3, 0), (8, 3, 6)), 0.06, spark_m, rng, (F0 - 2, F1 + 2), drift=(5, 0, 2.5))

# ------------------------------------------------------------- lighting
C.light("SUN", "moon", (0, 0, 0), 1.5, (1.0, 0.22, 0.16), rot=(math.radians(80), 0, math.radians(170)), size=0.05)
C.light("SUN", "fill", (0, 0, 0), 0.2, (0.4, 0.4, 0.9), rot=(math.radians(55), 0, math.radians(-30)), size=0.4)
C.light("POINT", "crater", SRC + Vector((0, -1, 1.5)), 1800, (0.2, 0.7, 1.0), size=0.8)
C.light("AREA", "plume_spill", (2, -2, 9), 1200, (0.4, 0.3, 1.0), size=12, target=(2, 0, 0))

# --------------------------------------------------------------- camera
cam = C.camera("cam", (-6, -38, 4.0), lens=30)
for f in range(F0, F1 + 1):
    t = (f - F0) / (F1 - F0)
    cam.location = (-6 + 2.0 * C.ease(t), -38 + 2.5 * C.ease(t), 4.0)
    C.look_at(cam, (1.0 + 2.5 * C.ease(t), 0, 5.0))
    cam.keyframe_insert("location", frame=f); cam.keyframe_insert("rotation_euler", frame=f)

C.compositor(scn, kuwahara=3.5, bloom=0.7, bloom_threshold=0.9, lift=(1.0, 0.98, 1.0), gain=(1.04, 1.0, 1.0),
             saturation=1.08, vignette=0.55)
C.finish(scn, "shot07", C.args())
