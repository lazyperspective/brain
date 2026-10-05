"""Shot 2 — The Look (32 frames, 1.3s).

Close on the courier: hood, respirator, brass goggles. The red moon sits in
the lenses; she tips her head up, the iris shutters snap closed and the
gauntlet's teal glow climbs her face from below.
"""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Euler, noise
import common as C

F0, F1 = 1, 32
rng = random.Random(21)
scn = C.reset()
C.setup_render(scn, (F0, F1), samples=48)
C.set_fog(scn, (0.06, 0.015, 0.015), density=0.0, height=10, strength=1.0)
C.sky_world(scn, top=(0.01, 0.004, 0.006), horizon=(0.06, 0.012, 0.012), strength=1.0)

cloth = C.painted("hood", (0.2, 0.045, 0.05), dark=(0.06, 0.012, 0.018), light=(0.36, 0.1, 0.09),
                  rough=0.92, stroke=9, stretch=(1, 1, 3), fog=0, bump=0.4)
skin = C.painted("skin", (0.52, 0.27, 0.23), dark=(0.3, 0.13, 0.12), light=(0.68, 0.42, 0.36),
                 rough=0.55, stroke=14, stretch=(1, 1, 1.5), fog=0, bump=0.05, spec=0.3)
# subsurface warmth on the skin
skin.node_tree.nodes["Principled BSDF"].inputs["Subsurface Weight"].default_value = 0.25
skin.node_tree.nodes["Principled BSDF"].inputs["Subsurface Radius"].default_value = (1.0, 0.25, 0.15)
skin.node_tree.nodes["Principled BSDF"].inputs["Subsurface Scale"].default_value = 0.01
leather = C.painted("leather", (0.075, 0.04, 0.035), dark=(0.025, 0.015, 0.015), light=(0.16, 0.09, 0.07),
                    rough=0.5, edge=(0.3, 0.16, 0.12), edge_w=0.004, stroke=20, fog=0)
brass = C.painted("brass", (0.42, 0.22, 0.08), dark=(0.2, 0.09, 0.03), light=(0.7, 0.45, 0.2),
                  rough=0.28, metal=1.0, edge=(1.0, 0.75, 0.45), edge_w=0.002, stroke=30, fog=0)
iron = C.painted("iron", (0.08, 0.06, 0.06), rough=0.45, metal=0.8, edge=(0.45, 0.3, 0.25), edge_w=0.002, stroke=30, fog=0)
lens = C.glass("lens", (0.85, 0.95, 0.95), rough=0.0, ior=1.3)
interior = C.painted("interior", (0.01, 0.01, 0.012), rough=0.4, fog=0, bump=0)
hair_m = C.painted("hair", (0.55, 0.05, 0.06), dark=(0.25, 0.015, 0.03), light=(0.85, 0.2, 0.15),
                   rough=0.4, stroke=40, stretch=(1, 1, 30), fog=0, bump=0)
iris_m = C.emissive("iris", (0.15, 0.75, 1.0), 0.0)
iris_em = iris_m.node_tree.nodes["Emission"].inputs["Strength"]

HEAD = C.empty("head", (0, 0, 0))

# ------------------------------------------------------------------ head
face = C.sphere("face", 0.1, mat=skin, segs=48, rings=24, scale=(0.82, 0.95, 1.12))
face.parent = HEAD
# brow ridge + nose bridge so the skin between hood and mask has form
brow = C.sphere("brow", 0.05, loc=(0, -0.072, 0.045), mat=skin, scale=(1.35, 0.5, 0.35))
brow.parent = HEAD

# hood: sphere shell with the face opening cut away, thickened, folded
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=0.15)
bm.normal_update()
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.y < -0.42 and -0.14 < f.calc_center_median().z < 0.062], context="FACES")
for v in bm.verts:
    v.co.x *= 1.02; v.co.y *= 1.12; v.co.z *= 1.18
    v.co.z += 0.015
    v.co.y += 0.012
    # gravity drape: the hood falls away below the jaw
    if v.co.z < -0.08:
        v.co.x *= 1 + (-0.08 - v.co.z) * 2.5
        v.co.y *= 1 + (-0.08 - v.co.z) * 1.5
hood = C.mesh_obj("hood", bm, cloth, smooth=True)
hood.parent = HEAD
sol = hood.modifiers.new("thick", "SOLIDIFY"); sol.thickness = 0.01
C.subsurf(hood, 2)
tex = bpy.data.textures.new("folds", "CLOUDS"); tex.noise_scale = 0.06; tex.noise_depth = 2
dsp = hood.modifiers.new("folds", "DISPLACE"); dsp.texture = tex; dsp.strength = 0.012; dsp.mid_level = 0.5

# respirator: leather shell, iron grille, twin brass filter canisters
mask = C.sphere("mask", 0.072, loc=(0, -0.05, -0.058), mat=leather, segs=40, rings=20, scale=(1.05, 0.95, 0.82))
mask.parent = HEAD
snout = C.cylinder("snout", 0.032, 0.05, loc=(0, -0.118, -0.068), rot=(math.pi / 2 + 0.25, 0, 0), r2=0.026, mat=iron, verts=24, bevel=0.002)
snout.parent = HEAD
for k in range(7):  # grille slats
    C.box(f"slat{k}", (0.044, 0.003, 0.004), loc=(0, -0.145, -0.083 + k * 0.0055), rot=(0.25, 0, 0), mat=brass).parent = HEAD
grill_rim = C.torus("grill_rim", 0.027, 0.004, loc=(0, -0.143, -0.066), rot=(math.pi / 2 + 0.25, 0, 0), mat=brass)
grill_rim.parent = HEAD
for sx in (-1, 1):
    can = C.cylinder(f"can{sx}", 0.022, 0.05, loc=(sx * 0.074, -0.09, -0.085), rot=(math.pi / 2 + 0.5, 0, sx * 0.7),
                     r2=0.02, mat=brass, verts=24, bevel=0.002)
    can.parent = HEAD
    for r in range(4):  # ridges
        t = C.torus(f"can_ridge{sx}{r}", 0.0225, 0.0025, mat=iron, major=32, minor=6)
        t.parent = can
        t.location = (0, 0, -0.018 + r * 0.011)
    cap = C.cylinder(f"cap{sx}", 0.016, 0.006, loc=(0, 0, 0.027), mat=iron, verts=16)
    cap.parent = can
    for b in range(6):  # rivets around the cap
        a = b * math.pi / 3
        rv = C.sphere(f"rivet{sx}{b}", 0.0022, loc=(math.cos(a) * 0.012, math.sin(a) * 0.012, 0.031), mat=brass, segs=8, rings=4)
        rv.parent = can

# goggle strap
strap = C.torus("strap", 0.104, 0.007, loc=(0, 0.004, 0.028), rot=(0.12, 0, 0), mat=leather, major=64, minor=8)
strap.scale = (0.86, 1.0, 0.55)
strap.parent = HEAD

# goggles
shutters = []
for sx in (-1, 1):
    eye = C.empty(f"eye{sx}", (sx * 0.037, -0.088, 0.026), parent=HEAD)
    eye.rotation_euler = (math.pi / 2, 0, sx * 0.22)
    cup = C.cylinder(f"cup{sx}", 0.026, 0.026, loc=(0, 0, -0.006), r2=0.024, mat=brass, verts=40, bevel=0.0015)
    cup.parent = eye
    C.torus(f"rim{sx}", 0.0245, 0.0042, loc=(0, 0, 0.018), mat=brass, major=48, minor=10).parent = eye
    C.torus(f"rim_in{sx}", 0.02, 0.0018, loc=(0, 0, 0.021), mat=iron, major=48, minor=8).parent = eye
    for b in range(8):  # rim screws
        a = b * math.pi / 4 + 0.2
        C.sphere(f"screw{sx}{b}", 0.0018, loc=(math.cos(a) * 0.0245, math.sin(a) * 0.0245, 0.022), mat=iron, segs=8, rings=4).parent = eye
    back = C.cylinder(f"back{sx}", 0.021, 0.002, loc=(0, 0, 0.0078), mat=interior, verts=32)
    back.parent = eye
    iris = C.torus(f"iris{sx}", 0.0085, 0.0018, loc=(0, 0, 0.0098), mat=iris_m, major=32, minor=6)
    iris.parent = eye
    pupil = C.cylinder(f"pupil{sx}", 0.0055, 0.001, loc=(0, 0, 0.0095), mat=iris_m, verts=24)
    pupil.parent = eye
    # aperture: six blades that swing inward to close the iris
    for b in range(6):
        pivot = C.empty(f"blade_pivot{sx}{b}", (0, 0, 0.012), parent=eye)
        pivot.rotation_euler = (0, 0, b * math.pi / 3)
        arm = C.empty(f"blade_arm{sx}{b}", (0.017, 0, 0), parent=pivot)
        blade = C.box(f"blade{sx}{b}", (0.006, 0.02, 0.0008), loc=(-0.003, 0.0, 0), mat=iron)
        blade.parent = arm
        shutters.append(arm)
    dome = C.sphere(f"lens{sx}", 0.0215, loc=(0, 0, 0.016), mat=lens, segs=32, rings=16, scale=(1, 1, 0.35))
    dome.parent = eye
    dome.visible_shadow = False

# hair: chunky painted clumps spilling from under the hood, swept by wind
HAIR = C.collection("hair")
strands = []
clumps = [  # (x at root, sideways sweep, fall length, thickness)
    (-0.03, -0.05, 0.12, 0.0062), (-0.012, -0.065, 0.15, 0.0072), (0.006, -0.06, 0.16, 0.0068),
    (0.022, -0.045, 0.13, 0.0058), (0.04, 0.012, 0.11, 0.0052), (0.055, 0.03, 0.14, 0.005),
    (-0.05, -0.02, 0.09, 0.0048), (0.0, -0.08, 0.1, 0.004), (0.03, -0.075, 0.12, 0.0036),
]
for k in range(len(clumps) + 10):
    if k < len(clumps):
        x0, sweep, fall, th = clumps[k]
    else:  # stray flyaways
        x0 = rng.uniform(-0.05, 0.06); sweep = rng.uniform(-0.1, 0.05); fall = rng.uniform(0.06, 0.15); th = rng.uniform(0.0012, 0.002)
    cu = bpy.data.curves.new(f"strand{k}", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = th
    cu.bevel_resolution = 2
    cu.use_fill_caps = True
    sp = cu.splines.new("NURBS")
    npt = 7
    sp.points.add(npt - 1)
    sp.order_u = 4
    sp.use_endpoint_u = True
    base = Vector((x0, -0.1 + abs(x0) * 0.35, 0.078))
    pts = []
    for i in range(npt):
        t = i / (npt - 1)
        # S-curve: out over the brow, then down and across the goggle
        p = base + Vector((sweep * (t ** 1.4), -0.036 * math.sin(t * math.pi * 0.7) - 0.01 * t, -fall * t))
        pts.append(p)
        sp.points[i].co = (*p, 1)
        sp.points[i].radius = 1.0 - 0.9 * t ** 1.5
    cu.materials.append(hair_m)
    ob = C.link(bpy.data.objects.new(f"strand{k}", cu), HAIR)
    ob.parent = HEAD
    strands.append((ob, pts, rng.uniform(0, 10)))

# wind: every control point keyed on a noise field, growing toward the tips
for ob, pts, seed in strands:
    sp = ob.data.splines[0]
    for f in range(F0, F1 + 1, 2):
        for i, p in enumerate(pts):
            t = i / (len(pts) - 1)
            w = noise.noise_vector(Vector((seed, t * 1.5, f * 0.07)))
            q = p + Vector((w.x * 0.018 + 0.01 * t, w.y * 0.008, w.z * 0.008)) * t * t
            sp.points[i].co = (*q, 1)
            sp.points[i].keyframe_insert("co", frame=f)

# ------------------------------------------------------------ animation
# head tips up toward the sky, small settle
for f in range(F0, F1 + 1):
    t = (f - F0) / (F1 - F0)
    up = C.ease_out(min(1, max(0, (f - 6) / 14)), 3)
    HEAD.rotation_euler = (0.06 - 0.16 * up + 0.01 * math.sin(f * 0.4), 0, -0.1 - 0.05 * up)
    HEAD.location = (0, 0, 0.01 * up)
    HEAD.keyframe_insert("rotation_euler", frame=f); HEAD.keyframe_insert("location", frame=f)
# shutters: open, then snap shut on frame 18-22 with a small overshoot
for arm in shutters:
    for f, ang in ((F0, 0.0), (17, 0.0), (21, 0.95), (23, 0.86), (F1, 0.88)):
        arm.rotation_euler = (0, 0, ang)
        arm.keyframe_insert("rotation_euler", frame=f)
for f, s in ((F0, 3.5), (14, 4.5), (18, 9.0), (20, 70.0), (24, 28.0), (F1, 34.0)):
    iris_em.default_value = s
    iris_em.keyframe_insert("default_value", frame=f)

# ------------------------------------------------------------- lighting
rim = C.light("AREA", "moon_rim", (-0.35, 0.45, 0.35), 18, (1.0, 0.15, 0.1), size=0.6, target=(0, 0, 0))
rim2 = C.light("AREA", "moon_rim2", (0.4, 0.35, 0.2), 8, (1.0, 0.2, 0.12), size=0.4, target=(0, 0, 0))
key = C.light("AREA", "key", (-0.5, -0.6, 0.45), 2.0, (1.0, 0.45, 0.35), size=0.8, target=(0, 0, 0))
under = C.light("POINT", "gauntlet_glow", (0.12, -0.32, -0.32), 0.0, (0.2, 0.65, 1.0), size=0.05)
for f, e in ((F0, 2.0), (16, 3.0), (20, 40.0), (24, 22.0), (F1, 26.0)):
    under.data.energy = e
    under.data.keyframe_insert("energy", frame=f)
# the red moon, out of frame behind camera, for the lens reflections
moon_m = C.emissive("moon_refl", (1.0, 0.08, 0.06), 1.5)
moon = C.sphere("moon_refl", 0.35, loc=(0.9, -4.0, 1.5), mat=moon_m)
moon.visible_camera = False
moon.visible_shadow = False

# backdrop: maroon haze with out-of-focus embers drifting across
bg_m = C.emissive("backdrop", (0.07, 0.014, 0.014), 1.0)
bg = C.box("backdrop", (6, 0.1, 4), loc=(0, 2.5, 0), mat=bg_m)
bg.visible_shadow = False
ember_m = C.emissive("ember", (1.0, 0.3, 0.12), 25)
C.embers("ember", 26, ((-0.6, -0.3, -0.4), (0.6, 1.2, 0.3)), 0.004, ember_m, rng, (F0 - 2, F1 + 2), drift=(0.25, 0, 0.18))

# --------------------------------------------------------------- camera
cam = C.camera("cam", (-0.5, -0.66, 0.07), lens=55, dof=(0.8, 2.2))
C.look_at(cam, (0.035, -0.06, -0.01))
r0 = cam.rotation_euler.copy()
l0 = cam.location.copy()
for f in range(F0, F1 + 1):
    t = (f - F0) / (F1 - F0)
    cam.location = l0 + Vector((0.025, 0.06, 0.006)) * C.ease(t)
    cam.keyframe_insert("location", frame=f)
C.shake(cam, (F0, F1), amp=0.0015, rot_amp=0.003, freq=0.25, seed=3, base_rot=r0)
for f in range(F0, F1 + 1):  # shake keyed rotation only; restore the dolly path
    t = (f - F0) / (F1 - F0)
    cam.location = l0 + Vector((0.025, 0.06, 0.006)) * C.ease(t)
    cam.keyframe_insert("location", frame=f)
cam.data.dof.focus_object = bpy.data.objects["eye1"]

C.compositor(scn, kuwahara=3.0, bloom=0.7, bloom_threshold=0.85, lift=(0.99, 0.98, 1.02),
             gamma=(1.0, 0.98, 1.0), gain=(1.06, 1.0, 0.98), saturation=1.0, vignette=0.55)
C.finish(scn, "shot02", C.args())
