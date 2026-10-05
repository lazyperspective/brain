"""Shot 2d — Fall Upward (40 frames, 1.7s). Vision sequence, part 3.

Looking straight up: gravity has let go. The courier drifts skyward with
tumbling bridge planks, paper lanterns and petals, toward a city that hangs
upside-down from a lemon-and-turquoise sky.
"""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Euler, noise
import common as C

F0, F1 = 1, 40
rng = random.Random(204)
scn = C.reset()
C.setup_render(scn, (F0, F1), samples=24, motion_blur=True, shutter=0.4)
C.surreal_grade(scn)
C.set_fog(scn, (0.3, 0.85, 0.75), density=0.006, height=1000, strength=1.0)

# sky: lemon at the zenith, turquoise toward the horizon
w = bpy.data.worlds.new("Sky"); scn.world = w
nt, n, l = C._nodes(w)
out = n.new("ShaderNodeOutputWorld"); bg = n.new("ShaderNodeBackground")
tc = n.new("ShaderNodeTexCoord")
sep = n.new("ShaderNodeSeparateXYZ"); l.new(tc.outputs["Generated"], sep.inputs[0])
ramp = n.new("ShaderNodeValToRGB"); cr = ramp.color_ramp
cr.elements[0].position = 0.0; cr.elements[0].color = (0.0, 0.55, 0.6, 1)
cr.elements[1].position = 0.97; cr.elements[1].color = (1.4, 1.1, 0.25, 1)
e = cr.elements.new(0.7); e.color = (0.15, 0.95, 0.75, 1)
l.new(sep.outputs["Z"], ramp.inputs["Fac"])
l.new(ramp.outputs["Color"], bg.inputs["Color"]); l.new(bg.outputs[0], out.inputs["Surface"])

# ------------------------------------------------------ hanging city
cobalt = C.toon("cobalt", lit=(0.12, 0.35, 1.0), shade=(0.03, 0.08, 0.42), light_dir=(0.4, 0.3, -0.85),
                bands=(0.3, 0.6), strength=1.0, rim=(0.7, 0.95, 1.0))
coral = C.toon("coral", lit=(1.0, 0.42, 0.35), shade=(0.6, 0.08, 0.25), light_dir=(0.4, 0.3, -0.85),
               bands=(0.3, 0.6), strength=1.0, rim=(1.0, 0.85, 0.7))
violet = C.toon("violet", lit=(0.6, 0.25, 1.0), shade=(0.22, 0.05, 0.5), light_dir=(0.4, 0.3, -0.85),
                bands=(0.3, 0.6), strength=1.0)
win_m = C.emissive("window", (1.0, 0.85, 0.2), 4)
mats = [cobalt, coral, cobalt, violet]
CEIL = 85
k = 0
for gx in range(-6, 7):
    for gy in range(-6, 7):
        x = gx * 9 + rng.uniform(-2.5, 2.5)
        y = gy * 9 + rng.uniform(-2.5, 2.5)
        if math.hypot(x, y) < 21:
            continue  # leave the sky open overhead
        h = rng.uniform(12, 40) * (1.0 if math.hypot(x, y) < 45 else 0.6)
        wdt = rng.uniform(4, 7.5); dep = rng.uniform(4, 7.5)
        m = mats[k % len(mats)]
        C.box(f"tower{k}", (wdt, dep, h), loc=(x, y, CEIL - h / 2), mat=m, taper=None)
        # stepped tip pointing at the ground, plus a spire
        C.box(f"tip{k}", (wdt * 0.6, dep * 0.6, 3), loc=(x, y, CEIL - h - 1.5), mat=m)
        if rng.random() < 0.5:
            C.cylinder(f"spire{k}", 0.6, 9, loc=(x, y, CEIL - h - 7), r2=0.02, mat=coral if m is cobalt else cobalt, verts=8, rot=(math.pi, 0, 0))
        # lit window strips facing inward
        to_c = Vector((-x, -y, 0)).normalized()
        for j in range(rng.randint(2, 5)):
            zz = CEIL - rng.uniform(2, h - 2)
            off = (rng.uniform(-0.35, 0.35)) * wdt
            px = x + to_c.x * (wdt / 2 + 0.05) + -to_c.y * off
            py = y + to_c.y * (dep / 2 + 0.05) + to_c.x * off
            C.box(f"win{k}_{j}", (0.7, 0.7, rng.uniform(1.0, 3.5)), loc=(px, py, zz), mat=win_m)
        k += 1
# bridges strung between towers, also upside-down
for j in range(10):
    a = rng.uniform(0, 2 * math.pi); r = rng.uniform(20, 40)
    C.box(f"skybridge{j}", (rng.uniform(10, 22), 1.6, 1.0), loc=(math.cos(a) * r, math.sin(a) * r, CEIL - rng.uniform(10, 30)),
          rot=(0, 0, a + math.pi / 2), mat=coral)

# -------------------------------------------------------- rising world
import courier
rig, parts = courier.build("far")
rig.scale = (1.3, 1.3, 1.3)
dark = C.toon("darkcloth", lit=(0.18, 0.06, 0.15), shade=(0.05, 0.015, 0.05), light_dir=(0.4, 0.3, -0.85), bands=(0.3, 0.6), rim=(1.0, 0.7, 0.4))
for f in range(F0, F1 + 1):
    t = (f - F0) / (F1 - F0)
    rig.location = (0.2 + 0.3 * t, -2.4 + 0.3 * t, 6.0 + 6.0 * t ** 1.3)
    rig.rotation_euler = (math.radians(78 - 8 * t), math.radians(-10 + 10 * t), math.radians(-25 + 45 * t))
    rig.keyframe_insert("location", frame=f); rig.keyframe_insert("rotation_euler", frame=f)
    w = 0.08 * math.sin(f * 0.25)  # slow swimming drift of the limbs
    courier.pose(rig, f, {
        "upperarm.L": (0.1, 0, -1.25 - w), "forearm.L": (-0.25, 0, 0),
        "upperarm.R": (0.1, 0, 1.25 + w), "forearm.R": (-0.35, 0, 0),
        "thigh.L": (0.15, 0, -0.32 + w), "shin.L": (0.45, 0, 0),
        "thigh.R": (-0.1, 0, 0.3 - w), "shin.R": (0.3, 0, 0),
        "head": (-0.25, 0, 0), "neck": (-0.1, 0, 0), "chest": (-0.08, 0, 0),
    })
plank_m = C.toon("plank", lit=(0.95, 0.55, 0.3), shade=(0.45, 0.15, 0.12), light_dir=(0.4, 0.3, -0.85), bands=(0.3, 0.6), rim=(1.0, 0.9, 0.6))
lantern_cols = [(1.0, 0.5, 0.1), (1.0, 0.15, 0.45), (1.0, 0.85, 0.2), (0.2, 1.0, 0.8)]
petal_m = [C.emissive("petal_a", (1.0, 0.2, 0.6), 2.5), C.emissive("petal_b", (1.0, 1.0, 0.9), 2.0)]


def riser(ob, p0, speed, spin, frames=(F0, F1)):
    for f in frames:
        t = (f - F0) / C.FPS
        ob.location = Vector(p0) + Vector((0, 0, speed * t))
        ob.rotation_euler = Vector(spin) * t
        ob.keyframe_insert("location", frame=f); ob.keyframe_insert("rotation_euler", frame=f)
    C.set_interp(ob, "LINEAR")


for i in range(26):  # planks torn from the bridge
    p = C.box(f"plank{i}", (rng.uniform(1.6, 2.4), 0.26, 0.07), mat=plank_m)
    a = rng.uniform(0, 2 * math.pi); r = rng.uniform(1.5, 9)
    riser(p, (math.cos(a) * r, math.sin(a) * r, rng.uniform(-2, 22)), rng.uniform(3, 7),
          (rng.uniform(-2, 2), rng.uniform(-2, 2), rng.uniform(-2, 2)))
for i in range(44):  # paper lanterns: glowing boxes with dark caps
    col = lantern_cols[i % len(lantern_cols)]
    L = C.box(f"lantern{i}", (0.35, 0.35, 0.5), mat=C.emissive(f"lan{i}", col, 6), bevel=0.05)
    cap = C.box(f"lcap{i}", (0.42, 0.42, 0.06), loc=(0, 0, 0.27), mat=dark); cap.parent = L
    a = rng.uniform(0, 2 * math.pi); r = rng.uniform(2, 22)
    riser(L, (math.cos(a) * r, math.sin(a) * r, rng.uniform(0, 45)), rng.uniform(2, 5),
          (rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3), rng.uniform(-1, 1)))
for i in range(120):  # petals
    bm = bmesh.new()
    s = rng.uniform(0.05, 0.12)
    vs = [bm.verts.new((0, -s, 0)), bm.verts.new((s * 0.6, 0, 0)), bm.verts.new((0, s, 0)), bm.verts.new((-s * 0.6, 0, 0))]
    bm.faces.new(vs)
    pt = C.mesh_obj(f"petal{i}", bm, petal_m[i % 2])
    a = rng.uniform(0, 2 * math.pi); r = rng.uniform(0.5, 10)
    riser(pt, (math.cos(a) * r, math.sin(a) * r, rng.uniform(0, 25)), rng.uniform(4, 9),
          (rng.uniform(-8, 8), rng.uniform(-8, 8), rng.uniform(-8, 8)))

# ------------------------------------------------------------- lighting
C.light("SUN", "zenith", (0, 0, 0), 3.0, (1.0, 0.9, 0.6), rot=(math.radians(170), 0, 0), size=0.1)
C.light("SUN", "fill", (0, 0, 0), 1.2, (0.2, 0.9, 0.9), rot=(math.radians(60), 0, math.radians(30)), size=0.5)

# --------------------------------------------------------------- camera
cam = C.camera("cam", (0, -3.0, 0), lens=18)
for f in range(F0, F1 + 1):
    t = (f - F0) / (F1 - F0)
    cam.location = (0, -3.0, 2.0 * t)
    C.look_at(cam, (0.3, 1.5, 60))
    cam.rotation_euler.z += math.radians(35 * C.ease(t))  # slow spiral
    cam.keyframe_insert("location", frame=f); cam.keyframe_insert("rotation_euler", frame=f)

C.compositor(scn, kuwahara=3.0, bloom=0.7, bloom_threshold=1.0, saturation=1.15, vignette=0.45)
C.finish(scn, "shot02d", C.args())
