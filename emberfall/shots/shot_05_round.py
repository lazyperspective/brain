"""Shot 5 — The Round (16 frames, 0.7s).

Tracking alongside the fired capacitor round: crimson enamel, brass bands, a
teal core window and hot exhaust vents. Lightning crawls the hull while the
ground and debris smear past.
"""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Euler, noise
import common as C

F0, F1 = 1, 16
rng = random.Random(55)
scn = C.reset()
C.setup_render(scn, (F0, F1), samples=40, motion_blur=True, shutter=0.6)
FOG = (0.06, 0.015, 0.016)
C.set_fog(scn, FOG, density=0.03, height=12, strength=1.0)
C.sky_world(scn, top=(0.01, 0.004, 0.008), horizon=(0.06, 0.015, 0.016), ground=FOG)

enamel = C.painted("enamel", (0.34, 0.03, 0.035), dark=(0.12, 0.01, 0.015), light=(0.55, 0.09, 0.07),
                   rough=0.35, metal=0.3, edge=(1.0, 0.55, 0.4), edge_w=0.012, stroke=8, stretch=(4, 1, 1), fog=0)
brass = C.painted("brass", (0.45, 0.25, 0.08), dark=(0.18, 0.08, 0.03), light=(0.8, 0.55, 0.25),
                  rough=0.25, metal=1.0, edge=(1.0, 0.85, 0.55), edge_w=0.008, stroke=12, fog=0)
iron = C.painted("iron", (0.06, 0.045, 0.05), rough=0.4, metal=0.8, edge=(0.5, 0.35, 0.3), edge_w=0.008, stroke=12, fog=0)
glass = C.glass("window", (0.7, 1.0, 0.9), rough=0.05, ior=1.3)
core_m = C.emissive("core", (0.15, 1.0, 0.7), 6)
vent_m = C.emissive("vent", (1.0, 0.55, 0.12), 18)
ground = C.painted("ground", (0.12, 0.025, 0.025), dark=(0.04, 0.01, 0.012), light=(0.2, 0.05, 0.045),
                   rough=0.95, stroke=0.4, stretch=(0.3, 1, 1), bump=0.3)
debris = C.painted("debris", (0.07, 0.025, 0.03), rough=0.9, bump=0.2, stroke=1)

SPEED = 38.0
SH = C.empty("shell", (0, 0, 0))
WORLD = C.empty("world_mover", (0, 0, 0))  # the world streams past a still round
SPIN = C.empty("spin", (0, 0, 0), parent=SH)


def part(ob):
    ob.parent = SPIN
    return ob


ax = (0, math.pi / 2, 0)  # cylinders along local X
part(C.cylinder("body", 0.25, 0.9, rot=ax, mat=enamel, verts=48, bevel=0.01))
part(C.cylinder("nose", 0.25, 0.42, loc=(0.66, 0, 0), rot=ax, r2=0.06, mat=iron, verts=48, bevel=0.01))
part(C.sphere("tip", 0.065, loc=(0.87, 0, 0), mat=brass, segs=16, rings=8))
part(C.cylinder("window", 0.256, 0.2, loc=(0.18, 0, 0), rot=ax, mat=core_m, verts=48))
part(C.cylinder("core", 0.19, 0.18, loc=(0.18, 0, 0), rot=ax, mat=core_m, verts=24))
for k in range(8):  # window mullions
    a = k * math.pi / 4
    part(C.box(f"mull{k}", (0.2, 0.025, 0.03), loc=(0.18, math.cos(a) * 0.255, math.sin(a) * 0.255), rot=(a, 0, 0), mat=brass))
for x in (0.07, 0.29, -0.3, 0.46):
    part(C.torus(f"band{x}", 0.258, 0.022, loc=(x, 0, 0), rot=ax, mat=brass, major=48, minor=8))
for k in range(12):  # rivet row
    a = k * math.pi / 6
    part(C.sphere(f"rv{k}", 0.014, loc=(-0.12, math.cos(a) * 0.252, math.sin(a) * 0.252), mat=brass, segs=8, rings=4))
# rear: exhaust collar, four fins, glowing vents
part(C.cylinder("collar", 0.23, 0.22, loc=(-0.55, 0, 0), rot=ax, r2=0.26, mat=brass, verts=48, bevel=0.01))
part(C.cylinder("nozzle", 0.17, 0.1, loc=(-0.7, 0, 0), rot=ax, r2=0.2, mat=iron, verts=32))
part(C.cylinder("burn", 0.15, 0.02, loc=(-0.755, 0, 0), rot=ax, mat=vent_m, verts=32))
for k in range(4):
    a = k * math.pi / 2 + math.pi / 4
    f = part(C.box(f"fin{k}", (0.36, 0.025, 0.2), loc=(-0.55, math.cos(a) * 0.32, math.sin(a) * 0.32), rot=(a - math.pi / 2, 0, 0), mat=brass, bevel=0.008, taper=(0.5, 1)))
    for j in range(3):
        part(C.box(f"vent{k}{j}", (0.07, 0.03, 0.02), loc=(-0.48 - j * 0.09, math.cos(a + 0.4) * 0.258, math.sin(a + 0.4) * 0.258),
                   rot=(a + 0.4, 0, 0), mat=vent_m))

# flight + roll
for f in range(F0 - 1, F1 + 2):
    t = (f - F0) / C.FPS
    SH.location = (0, 0, 0.12 * math.sin(t * 9))
    WORLD.location = (-SPEED * t, 0, 0)
    WORLD.keyframe_insert("location", frame=f)
    SH.rotation_euler = (0, 0.04 * math.sin(t * 7), 0.03 * math.sin(t * 5))
    SH.keyframe_insert("location", frame=f); SH.keyframe_insert("rotation_euler", frame=f)
    SPIN.rotation_euler = (t * 7, 0, 0)
    SPIN.keyframe_insert("rotation_euler", frame=f)
C.set_interp(SPIN, "LINEAR")
C.set_interp(WORLD, "LINEAR")

# lightning crawling the hull, fresh every frame, riding with the shell
bolt_m = C.emissive("bolt", (0.55, 0.9, 1.0), 45)


def hull_point(r, x0, x1):
    a = r.uniform(0, 2 * math.pi)
    return Vector((r.uniform(x0, x1), math.cos(a) * 0.3, math.sin(a) * 0.3))


for f in range(F0, F1 + 1):
    r = random.Random(f * 7 + 1)
    for j in range(4):
        a = hull_point(r, -0.6, 0.6)
        b = a + Vector((r.uniform(-1.6, -0.3), r.uniform(-0.6, 0.6), r.uniform(-0.6, 0.6)))
        ob = C.bolt(f"arc{f}_{j}", a, b, r, width=0.012, mat=bolt_m, depth=5, jag=0.22, branches=2, branch_len=0.4)
        ob.parent = SH
        C.visible_between(ob, f, f)

# trail: teal-to-violet energy smoke shed behind the round
trail_m = C.toon("trail", lit=(0.45, 0.85, 1.0), shade=(0.25, 0.3, 0.9), light_dir=(0.2, -0.6, 0.8),
                 bands=(0.3, 0.62), strength=0.6, rim=(0.5, 0.9, 1.0))
puffs = []
for k in range(40):
    tb = -6 + k * 0.55
    x = SPEED * tb / C.FPS - 1.3
    puffs.append(dict(p0=(x, rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05)), vel=(-2.0, rng.uniform(-0.5, 0.5), rng.uniform(-0.3, 0.5)),
                      r0=0.06, r1=rng.uniform(0.22, 0.42), t0=tb, life=26, turb=0.12, drag=2.0))
C.smoke_puffs("trail", puffs, trail_m, (F0, F1), resolution=0.05).parent = WORLD

# --------------------------------------------------------------- world
C.box("ground", (400, 80, 0.5), loc=(60, 0, -4.2), mat=ground)
for k in range(90):  # debris, stakes and wreckage whipping by
    x = rng.uniform(-15, 50)
    y = rng.choice((-1, 1)) * rng.uniform(1.5, 14)
    h = rng.uniform(0.5, 6)
    C.box(f"deb{k}", (rng.uniform(0.2, 1.5), rng.uniform(0.2, 1.5), h), loc=(x, y, -4 + h / 2),
          rot=(rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3), rng.uniform(0, 3)), mat=debris)
# speed streaks
streak_m = C.emissive("streak", (1.0, 0.35, 0.25), 2.5, fog=0.5)
for k in range(26):
    s = C.box(f"streak{k}", (rng.uniform(1.5, 5), 0.008, 0.008),
              loc=(rng.uniform(-5, 35), rng.uniform(-3, 4), rng.uniform(-1.5, 1.5)), mat=streak_m)
    s.visible_shadow = False

for ob in list(scn.objects):
    if ob.name.startswith(("ground", "deb", "streak")):
        ob.parent = WORLD

# ------------------------------------------------------------- lighting
C.light("SUN", "moon", (0, 0, 0), 3.0, (1.0, 0.2, 0.15), rot=(math.radians(60), 0, math.radians(120)), size=0.05)
C.light("SUN", "fill", (0, 0, 0), 0.3, (0.4, 0.4, 0.9), rot=(math.radians(50), 0, math.radians(-60)), size=0.3)
cg = C.light("POINT", "core_glow", (0.18, 0, 0), 30, (0.2, 1.0, 0.8), size=0.15); cg.parent = SH
vg = C.light("POINT", "vent_glow", (-0.9, 0, 0), 25, (1.0, 0.5, 0.15), size=0.1); vg.parent = SH

# --------------------------------------------------------------- camera
cam = C.camera("cam", (0, 0, 0), lens=35)
for f in range(F0, F1 + 1):
    t = (f - F0) / C.FPS
    sx = 0.0
    # starts ahead and drifts back as the round overtakes it slightly
    off = Vector((1.4 - 1.6 * (f - F0) / (F1 - F0), -3.9, 0.9))
    cam.location = Vector((sx, 0, 0)) + off + noise.noise_vector(Vector((f * 0.5, 0, 0))) * 0.02
    C.look_at(cam, (sx - 0.2, 0, -0.1))
    cam.rotation_euler.y += math.radians(-12)  # dutch tilt
    cam.keyframe_insert("location", frame=f); cam.keyframe_insert("rotation_euler", frame=f)

C.compositor(scn, kuwahara=3.0, bloom=0.9, bloom_threshold=0.9, lift=(1.0, 0.98, 1.0), gain=(1.05, 1.0, 1.0),
             saturation=1.08, vignette=0.55)
C.finish(scn, "shot05", C.args())
