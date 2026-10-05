"""Shot 6 — Impact (12 frames, 0.5s).

The round detonates against the ground: a white-hot core, knife-edged light
shards, cel-shaded tongues of cyan energy, a shock ring, radiating arcs and
dark debris thrown at the lens.
"""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Euler, noise
import common as C

F0, F1 = 1, 12
rng = random.Random(66)
scn = C.reset()
C.setup_render(scn, (F0, F1), samples=32, motion_blur=True, shutter=0.5)
FOG = (0.05, 0.012, 0.014)
C.set_fog(scn, FOG, density=0.02, height=10, strength=1.0)
C.sky_world(scn, top=(0.012, 0.005, 0.01), horizon=(0.05, 0.012, 0.014), ground=FOG)

ground_m = C.painted("ground", (0.1, 0.02, 0.02), dark=(0.05, 0.01, 0.012), light=(0.26, 0.06, 0.05),
                     rough=0.95, stroke=0.5, bump=0.3)
debris_m = C.painted("debris", (0.05, 0.02, 0.025), rough=0.9, bump=0.2, fog=0.3)
C.box("ground", (200, 200, 1), loc=(0, 0, -0.5), mat=ground_m)
for k in range(40):
    s = rng.uniform(0.2, 1.2)
    C.box(f"rock{k}", (s, s, s * 0.6), loc=(rng.uniform(-14, 14), rng.uniform(-2, 20), s * 0.2),
          rot=(rng.uniform(0, 3), rng.uniform(0, 3), rng.uniform(0, 3)), mat=debris_m)

O = Vector((0, 0, 0.4))

# core
core_m = C.emissive("core", (0.8, 1.0, 1.0), 40)
core = C.sphere("core", 1.0, loc=O, mat=core_m, segs=32, rings=16)
core.visible_shadow = False
for f, s in ((F0, 3.5), (2, 2.4), (4, 1.6), (8, 1.1), (F1, 0.7)):
    core.scale = (s, s, s); core.keyframe_insert("scale", frame=f)

# shards: flat triangular blades radiating outward
shard_w = C.emissive("shard_white", (0.6, 0.92, 1.0), 9)
shard_c = C.emissive("shard_cyan", (0.05, 0.55, 1.0), 6)
for k in range(46):
    d = Vector((rng.uniform(-1, 1), rng.uniform(-1, 0.3), rng.uniform(-0.1, 1))).normalized()
    L = rng.uniform(3, 11)
    bm = bmesh.new()
    w = rng.uniform(0.08, 0.35)
    v0 = bm.verts.new((0, -w, 0)); v1 = bm.verts.new((0, w, 0)); v2 = bm.verts.new((0, 0, 1))
    v3 = bm.verts.new((w * 0.6, 0, 0.2))
    bm.faces.new((v0, v1, v2)); bm.faces.new((v0, v3, v2)); bm.faces.new((v1, v3, v2))
    sh = C.mesh_obj(f"shard{k}", bm, shard_c if k % 3 else shard_w)
    sh.location = O
    sh.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    sh.visible_shadow = False
    t0 = rng.uniform(0, 2.5)
    for f in range(F0, F1 + 1):
        a = (f - F0 - t0) / 6
        grow = C.ease_out(max(0, min(1, a * 2.5)), 3)
        thin = max(0.0, 1 - max(0, a - 0.3) * 1.3)
        sh.scale = (thin, thin, L * grow + 0.001)
        sh.keyframe_insert("scale", frame=f)

# cel-shaded energy tongues: a burst of metaballs flung outward
energy = C.toon("energy", lit=(0.25, 0.85, 1.0), shade=(0.02, 0.28, 0.95), light_dir=(0.3, -0.7, 0.6),
                bands=(0.32, 0.6), strength=0.9, rim=(0.7, 1.0, 1.0))
puffs = []
for k in range(55):
    d = Vector((rng.uniform(-1, 1), rng.uniform(-0.8, 0.5), rng.uniform(0.0, 1))).normalized()
    puffs.append(dict(p0=tuple(O + d * 0.3), vel=tuple(d * rng.uniform(9, 18)), r0=0.3, r1=rng.uniform(0.5, 1.1),
                      t0=rng.uniform(0, 3), life=rng.uniform(7, 10), turb=0.3, drag=1.6, stretch=2.2))
C.smoke_puffs("energy", puffs, energy, (F0, F1), resolution=0.12, threshold=0.5)
# violet outer flame lobes
violet = C.toon("violet", lit=(0.45, 0.25, 1.0), shade=(0.12, 0.04, 0.5), light_dir=(0.3, -0.7, 0.6),
                bands=(0.3, 0.62), strength=0.7)
puffs = []
for k in range(30):
    d = Vector((rng.uniform(-1, 1), rng.uniform(-0.5, 0.6), rng.uniform(0.05, 0.8))).normalized()
    puffs.append(dict(p0=tuple(O + d * 0.6), vel=tuple(d * rng.uniform(10, 16)), r0=0.4, r1=rng.uniform(0.8, 1.4),
                      t0=rng.uniform(1, 4), life=rng.uniform(8, 11), turb=0.5, drag=1.5, stretch=2.0))
C.smoke_puffs("violet", puffs, violet, (F0, F1), resolution=0.15, threshold=0.5)

# shock ring hugging the ground
ring_m = C.emissive("ring", (0.2, 0.7, 1.0), 5)
ring = C.torus("ring", 1.0, 0.012, loc=(0, 0, 0.15), mat=ring_m, major=96, minor=8)
ring.visible_shadow = False
for f, R, th in ((F0, 0.5, 2.0), (4, 5, 1.2), (8, 10, 0.6), (F1, 13, 0.2)):
    ring.scale = (R, R, th); ring.keyframe_insert("scale", frame=f)

# arcs radiating every frame
bolt_m = C.emissive("bolt", (0.45, 0.85, 1.0), 16)
for f in range(F0, F1 + 1):
    r = random.Random(f * 31)
    for j in range(6):
        d = Vector((r.uniform(-1, 1), r.uniform(-1, 0.4), r.uniform(-0.2, 1))).normalized()
        ob = C.bolt(f"arc{f}_{j}", O, O + d * r.uniform(4, 9), r, width=0.04, mat=bolt_m, depth=6, jag=0.15, branches=3)
        C.visible_between(ob, f, f)

# debris hurled toward the camera
for k in range(36):
    s = rng.uniform(0.1, 0.5)
    ob = C.box(f"chunk{k}", (s, s * 0.7, s * 0.5), mat=debris_m, bevel=0.02)
    v = Vector((rng.uniform(-1, 1), rng.uniform(-1.6, -0.2), rng.uniform(0.2, 1.2))).normalized() * rng.uniform(10, 22)
    spin = Vector((rng.uniform(-15, 15), rng.uniform(-15, 15), rng.uniform(-15, 15)))
    for f in range(F0, F1 + 1):
        t = (f - F0 + 0.5) / C.FPS
        ob.location = O + v * t + Vector((0, 0, -4.9 * t * t))
        ob.rotation_euler = spin * t
        ob.keyframe_insert("location", frame=f); ob.keyframe_insert("rotation_euler", frame=f)

# light
L = C.light("POINT", "blast", O + Vector((0, -0.5, 0.8)), 0, (0.35, 0.8, 1.0), size=1.0)
for f, e in ((F0, 1.5e4), (3, 5e3), (7, 1.8e3), (F1, 1e3)):
    L.data.energy = e; L.data.keyframe_insert("energy", frame=f)
C.light("SUN", "red", (0, 0, 0), 1.0, (1.0, 0.25, 0.2), rot=(math.radians(70), 0, math.radians(140)), size=0.1)

# camera: low, slightly off-axis, hammered by the blast
cam = C.camera("cam", (-3.5, -11, 1.4), lens=24)
C.look_at(cam, O + Vector((1.2, 0, 1.6)))
r0 = cam.rotation_euler.copy(); l0 = cam.location.copy()
for f in range(F0, F1 + 1):
    t = (f - F0) / C.FPS
    amp = 0.035 * math.exp(-t * 3)
    nv = noise.noise_vector(Vector((f * 0.9, 4, 0)))
    cam.rotation_euler = (r0.x + nv.x * amp, r0.y + nv.y * amp * 2, r0.z + nv.z * amp)
    cam.location = l0 + Vector((0, -1.2 * t, 0))
    cam.keyframe_insert("rotation_euler", frame=f); cam.keyframe_insert("location", frame=f)

C.compositor(scn, kuwahara=3.0, bloom=0.9, bloom_threshold=1.2, bloom_size=0.7, lift=(1.0, 0.99, 1.02),
             gain=(1.0, 1.0, 1.04), saturation=1.1, vignette=0.45)
C.finish(scn, "shot06", C.args())
