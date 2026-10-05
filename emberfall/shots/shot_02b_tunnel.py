"""Shot 2b — Iris Tunnel (32 frames, 1.3s). Vision sequence, part 1.

The goggle shutter opens again, huge, and we dive through it into a
kaleidoscope: counter-rotating rings of stained glass, aperture blades and
brass gear teeth, accelerating toward a white-gold sun.
"""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Euler, noise
import common as C

F0, F1 = 1, 32
rng = random.Random(202)
scn = C.reset()
C.setup_render(scn, (F0, F1), samples=28, motion_blur=True, shutter=0.5)
C.surreal_grade(scn)
C.set_fog(scn, (0.25, 0.02, 0.2), density=0.012, height=1000, strength=1.0)
C.sky_world(scn, top=(0.03, 0.0, 0.05), horizon=(0.03, 0.0, 0.05), strength=1.0)

COLORS = [(1.0, 0.02, 0.45), (0.0, 0.75, 1.0), (1.0, 0.78, 0.0), (1.0, 0.28, 0.0), (0.45, 0.05, 1.0), (0.0, 1.0, 0.45)]


def stained(name, col, strength=1.5):
    """Emissive glass with darker 'leading' lines and mottled pigment."""
    m = bpy.data.materials.new(name)
    nt, n, l = C._nodes(m)
    out = n.new("ShaderNodeOutputMaterial")
    tc = n.new("ShaderNodeTexCoord")
    vor = n.new("ShaderNodeTexVoronoi"); vor.feature = "DISTANCE_TO_EDGE"; vor.inputs["Scale"].default_value = 3.0
    l.new(tc.outputs["Object"], vor.inputs["Vector"])
    lead = n.new("ShaderNodeMapRange"); lead.inputs["From Min"].default_value = 0.02; lead.inputs["From Max"].default_value = 0.06
    l.new(vor.outputs["Distance"], lead.inputs["Value"])
    nz = n.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 4
    l.new(tc.outputs["Object"], nz.inputs["Vector"])
    mot = n.new("ShaderNodeMapRange"); mot.inputs["To Min"].default_value = 0.55
    l.new(nz.outputs["Fac"], mot.inputs["Value"])
    mul = n.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
    l.new(lead.outputs["Result"], mul.inputs[0]); l.new(mot.outputs["Result"], mul.inputs[1])
    mix = n.new("ShaderNodeMix"); mix.data_type = "RGBA"
    mix.inputs[6].default_value = (0.01, 0.005, 0.01, 1); mix.inputs[7].default_value = (*col, 1)
    l.new(mul.outputs[0], mix.inputs[0])
    em = n.new("ShaderNodeEmission"); em.inputs["Strength"].default_value = strength
    l.new(mix.outputs[2], em.inputs["Color"])
    l.new(em.outputs[0], out.inputs["Surface"])
    return m


glass = [stained(f"glass{i}", c) for i, c in enumerate(COLORS)]
brass = C.painted("brass", (0.55, 0.32, 0.08), dark=(0.25, 0.1, 0.03), light=(0.95, 0.7, 0.3),
                  rough=0.25, metal=1.0, edge=(1.0, 0.9, 0.6), edge_w=0.03, stroke=3, fog=0.6)
iron = C.painted("iron", (0.08, 0.04, 0.09), rough=0.35, metal=0.8, edge=(0.9, 0.5, 0.8), edge_w=0.03, stroke=3, fog=0.6)
teal_iris = C.emissive("iris", (0.05, 0.85, 1.0), 6)


def wedge(name, r0, r1, a0, a1, depth, mat):
    bm = bmesh.new()
    seg = 6
    rings = []
    for y in (-depth / 2, depth / 2):
        ring = []
        for r in (r0, r1):
            ring.append([bm.verts.new((math.cos(a0 + (a1 - a0) * i / seg) * r, y, math.sin(a0 + (a1 - a0) * i / seg) * r)) for i in range(seg + 1)])
        rings.append(ring)
    for y in range(2):
        inner, outer = rings[y]
        for i in range(seg):
            bm.faces.new((inner[i], inner[i + 1], outer[i + 1], outer[i]))
    for r in range(2):
        for i in range(seg):
            bm.faces.new((rings[0][r][i], rings[0][r][i + 1], rings[1][r][i + 1], rings[1][r][i]))
    for y in range(2):
        pass
    return C.mesh_obj(name, bm, mat)


rings = []
SP = 2.2
for k in range(26):
    y = 6 + k * SP
    piv = C.empty(f"ring{k}", (0, y, 0))
    kind = k % 3
    R = 3.2 + 0.4 * math.sin(k * 0.7)
    if kind == 0:  # stained-glass rose
        n_w = rng.choice((8, 10, 12))
        for i in range(n_w):
            a0 = i * 2 * math.pi / n_w; a1 = (i + 1) * 2 * math.pi / n_w
            for band, (r0, r1) in enumerate(((R * 0.55, R * 0.78), (R * 0.8, R))):
                w = wedge(f"w{k}_{i}_{band}", r0, r1, a0 + 0.02, a1 - 0.02, 0.12, glass[(i + band + k) % len(glass)])
                w.parent = piv
            sp_ = C.box(f"spoke{k}_{i}", (0.06, 0.16, R * 0.5), loc=(math.cos(a0) * R * 0.77, 0, math.sin(a0) * R * 0.77),
                        rot=(0, -a0 + math.pi / 2, 0), mat=brass)
            sp_.parent = piv
        for rr in (R * 0.55, R * 0.79, R):
            t = C.torus(f"rim{k}_{rr:.2f}", rr, 0.06, rot=(math.pi / 2, 0, 0), mat=brass, major=64, minor=8)
            t.parent = piv
    elif kind == 1:  # aperture blades around a glowing iris rim
        t = C.torus(f"irisrim{k}", R, 0.12, rot=(math.pi / 2, 0, 0), mat=brass, major=64, minor=10)
        t.parent = piv
        t = C.torus(f"irisglow{k}", R * 0.96, 0.04, rot=(math.pi / 2, 0, 0), mat=glass[(k + 1) % len(glass)], major=64, minor=6)
        t.parent = piv
        for i in range(8):
            a = i * math.pi / 4
            arm = C.empty(f"bl{k}_{i}", (math.cos(a) * R * 0.95, 0, math.sin(a) * R * 0.95), parent=piv)
            arm.rotation_euler = (0, -a + 1.2, 0)
            b = C.box(f"blade{k}_{i}", (R * 0.9, 0.05, R * 0.35), loc=(-R * 0.4, 0, 0), mat=iron, bevel=0.03)
            b.parent = arm
    else:  # gear teeth ring
        t = C.torus(f"gear{k}", R, 0.18, rot=(math.pi / 2, 0, 0), mat=brass, major=64, minor=10)
        t.parent = piv
        for i in range(36):
            a = i * 2 * math.pi / 36
            tooth = C.box(f"tooth{k}_{i}", (0.18, 0.25, 0.35), loc=(math.cos(a) * (R - 0.25), 0, math.sin(a) * (R - 0.25)),
                          rot=(0, -a + math.pi / 2, 0), mat=brass)
            tooth.parent = piv
    rings.append((piv, (1 if k % 2 else -1) * rng.uniform(0.6, 1.4)))

for piv, spd in rings:
    for f in (F0, F1):
        piv.rotation_euler = (0, spd * (f - F0) / C.FPS, 0)
        piv.keyframe_insert("rotation_euler", frame=f)
    C.set_interp(piv, "LINEAR")

# the threshold: a giant teal iris whose six blades swing open as we arrive
gate = C.empty("gate", (0, 2.5, 0))
C.torus("gate_rim", 4.2, 0.2, loc=(0, 2.5, 0), rot=(math.pi / 2, 0, 0), mat=brass, major=96, minor=12)
C.torus("gate_glow", 3.95, 0.07, loc=(0, 2.45, 0), rot=(math.pi / 2, 0, 0), mat=teal_iris, major=96, minor=8)
gate_arms = []
for i in range(6):
    a = i * math.pi / 3
    piv = C.empty(f"gpiv{i}", (0, 0, 0), parent=gate)
    piv.rotation_euler = (0, -a, 0)
    arm = C.empty(f"garm{i}", (4.0, 0, 0), parent=piv)
    b = C.box(f"gblade{i}", (4.4, 0.06, 1.9), loc=(-2.0, 0, 0.7), mat=iron, bevel=0.04)
    b.parent = arm
    gate_arms.append(arm)
for arm in gate_arms:
    for f, ang in ((F0, 0.0), (5, 0.05), (12, -1.05), (F1, -1.1)):
        arm.rotation_euler = (0, ang, 0)
        arm.keyframe_insert("rotation_euler", frame=f)

# vanishing point: a white-gold sun at the end of the tunnel
sun = C.sphere("sun", 6, loc=(0, 6 + 26 * SP + 25, 0), mat=C.emissive("sun", (1.0, 0.85, 0.5), 25))
halo = C.emissive("halo", (1.0, 0.4, 0.7), 3)
C.torus("halo", 9, 0.4, loc=sun.location, rot=(math.pi / 2, 0, 0), mat=halo)

# drifting glass shards
for k in range(90):
    bm = bmesh.new()
    s = rng.uniform(0.06, 0.22)
    vs = [bm.verts.new((rng.uniform(-s, s), rng.uniform(-s, s) * 0.2, rng.uniform(-s, s))) for _ in range(3)]
    bm.faces.new(vs)
    ob = C.mesh_obj(f"shard{k}", bm, glass[k % len(glass)])
    a = rng.uniform(0, 2 * math.pi); r = rng.uniform(0.6, 2.8)
    p0 = Vector((math.cos(a) * r, rng.uniform(2, 60), math.sin(a) * r))
    spin = Vector((rng.uniform(-6, 6), rng.uniform(-6, 6), rng.uniform(-6, 6)))
    for f in (F0, F1):
        t = (f - F0) / C.FPS
        ob.location = p0 + Vector((math.cos(a) * 0.4 * t, -1.0 * t, math.sin(a) * 0.4 * t))
        ob.rotation_euler = spin * t
        ob.keyframe_insert("location", frame=f); ob.keyframe_insert("rotation_euler", frame=f)
    C.set_interp(ob, "LINEAR")

# --------------------------------------------------------------- camera
cam = C.camera("cam", (0, -4, 0), rot=(math.pi / 2, 0, 0), lens=22)
lights = []
for i, col in enumerate(((1.0, 0.2, 0.6), (0.1, 0.7, 1.0), (1.0, 0.8, 0.2))):
    a = i * 2 * math.pi / 3
    L = C.light("POINT", f"lamp{i}", (math.cos(a) * 1.5, 5, math.sin(a) * 1.5), 600, col, size=0.3)
    L.parent = cam
for f in range(F0, F1 + 1):
    t = (f - F0) / (F1 - F0)
    y = -4 + 52 * (t ** 2.2)  # accelerating dive
    cam.location = (0.15 * math.sin(t * 5), y, 0.1 * math.cos(t * 4))
    cam.rotation_euler = (math.pi / 2, math.radians(140) * C.ease(t), 0)
    cam.keyframe_insert("location", frame=f); cam.keyframe_insert("rotation_euler", frame=f)

C.compositor(scn, kuwahara=2.5, bloom=1.0, bloom_threshold=0.8, bloom_size=0.7, saturation=1.2, vignette=0.4,
             dispersion=0.015)
C.finish(scn, "shot02b", C.args())
