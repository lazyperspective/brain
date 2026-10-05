"""Shot 1 — The Crossing (frames 1-62, 2.6s).

A battle-scarred security robot stalks across a sagging plank bridge
toward a swollen crimson moon. Broken smokestacks and cranes stand in the haze
on either side; slow push-in from behind.
"""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Euler, noise
import common as C

F0, F1 = 1, 62
rng = random.Random(7)
scn = C.reset()
C.setup_render(scn, (F0, F1), samples=48)

FOG = (0.075, 0.022, 0.02)
C.set_fog(scn, FOG, density=0.012, height=8.0, strength=1.0)
C.sky_world(scn, top=(0.006, 0.005, 0.011), horizon=(0.11, 0.025, 0.022), stars=1.2,
            ground=FOG, strength=1.0)

# ---------------------------------------------------------------- materials
wood = C.painted("wood", (0.15, 0.07, 0.055), dark=(0.05, 0.022, 0.02), light=(0.26, 0.12, 0.09),
                 rough=0.85, edge=(0.55, 0.2, 0.15), edge_w=0.025, stroke=3, stretch=(1, 1, 9))
wood_far = C.painted("wood_far", (0.12, 0.05, 0.045), rough=0.9, bump=0.1)
iron = C.painted("iron", (0.07, 0.04, 0.045), rough=0.6, metal=0.6, edge=(0.4, 0.18, 0.16), edge_w=0.04)
ruin = C.painted("ruin", (0.09, 0.035, 0.035), dark=(0.03, 0.012, 0.014), rough=0.9, bump=0.15, stroke=1.2)
cloth = C.painted("cloth", (0.16, 0.05, 0.05), dark=(0.05, 0.015, 0.02), light=(0.3, 0.09, 0.08),
                  rough=0.9, stroke=6, stretch=(1, 1, 3), fog=0.6)
skin_dark = C.painted("leather", (0.06, 0.035, 0.03), rough=0.6, fog=0.6)
brass = C.painted("brass", (0.35, 0.16, 0.06), rough=0.35, metal=1.0, edge=(0.9, 0.55, 0.3), edge_w=0.01, fog=0.6)
teal = C.emissive("teal_glow", (0.1, 0.55, 1.0), 14)
hair_m = C.painted("hair", (0.5, 0.06, 0.05), rough=0.5, fog=0.6, stretch=(1, 1, 12))

ENV = C.collection("env")

# ------------------------------------------------------------------- bridge
L0, L1 = -8.0, 46.0
W = 2.2


def sag(y):
    """Bridge dips gently and lifts toward the far end."""
    return -0.25 * math.sin(math.pi * (y - L0) / (L1 - L0)) + 0.012 * (y - L0) * 0.4


y = L0
i = 0
plank_bm = bmesh.new()
while y < L1:
    if rng.random() > 0.05:  # a few missing boards
        w = rng.uniform(0.2, 0.28)
        length = W + rng.uniform(-0.15, 0.2)
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1)
        for v in bm.verts:
            v.co.x *= length; v.co.y *= w; v.co.z *= 0.06
        rot = Euler((rng.uniform(-0.03, 0.03), rng.uniform(-0.04, 0.04), rng.uniform(-0.06, 0.06)))
        mtx = rot.to_matrix().to_4x4()
        mtx.translation = (rng.uniform(-0.08, 0.08), y, sag(y) + rng.uniform(-0.015, 0.015))
        bmesh.ops.transform(bm, matrix=mtx, verts=bm.verts)
        me = bpy.data.meshes.new("tmp"); bm.to_mesh(me); bm.free()
        plank_bm.from_mesh(me); bpy.data.meshes.remove(me)
    y += rng.uniform(0.26, 0.34)
    i += 1
planks = C.mesh_obj("planks", plank_bm, wood, ENV)
m = planks.modifiers.new("bev", "BEVEL"); m.width = 0.012; m.segments = 1

# stringers under the planks
for sx in (-0.9, 0.9):
    for seg in range(int((L1 - L0) / 4)):
        ya = L0 + seg * 4
        C.box(f"stringer{sx}_{seg}", (0.14, 4.05, 0.22), loc=(sx, ya + 2, sag(ya + 2) - 0.14),
              rot=(math.atan2(sag(ya + 4) - sag(ya), 4), 0, rng.uniform(-0.01, 0.01)), mat=wood_far, coll=ENV)

# rails: posts, top rail, mid rail, cross braces
for side in (-1, 1):
    py = L0
    prev = None
    while py < L1:
        x = side * (W / 2 + 0.05)
        h = rng.uniform(1.0, 1.25)
        tilt = (rng.uniform(-0.05, 0.05), side * rng.uniform(-0.02, 0.09), 0)
        z0 = sag(py)
        post = C.box(f"post{side}_{py:.1f}", (0.13, 0.13, h + 0.6), loc=(x, py, z0 + (h - 0.6) / 2),
                     rot=tilt, mat=wood, coll=ENV, bevel=0.012)
        top = Vector((x + side * math.sin(tilt[1]) * h * 0.5, py, z0 + h))
        if prev is not None:
            a, b = prev, top
            mid = (a + b) / 2
            d = b - a
            for zoff, th in ((0.0, 0.1), (-0.48, 0.07)):
                C.box(f"rail{side}_{py:.1f}_{zoff}", (th * 1.2, d.length + 0.12, th),
                      loc=(mid.x, mid.y, mid.z + zoff), rot=(math.atan2(d.z, d.y), 0, rng.uniform(-0.02, 0.02)),
                      mat=wood, coll=ENV, bevel=0.01)
            if rng.random() < 0.6:  # diagonal brace
                ang = math.atan2(0.9, d.length) * rng.choice((-1, 1))
                C.box(f"brace{side}_{py:.1f}", (0.06, math.hypot(d.length, 0.9), 0.08),
                      loc=(mid.x + side * 0.03, mid.y, mid.z - 0.5), rot=(ang, 0, 0), mat=wood, coll=ENV)
        prev = top
        py += rng.uniform(1.5, 1.8)
    # rope lashings / iron straps every few posts and pilings down into the haze
    for py in range(int(L0), int(L1), 6):
        C.box(f"pile{side}_{py}", (0.22, 0.22, 16), loc=(side * 1.25, py + 0.5, sag(py) - 8.1),
              rot=(rng.uniform(-0.03, 0.03), side * 0.04, 0), mat=wood_far, coll=ENV)
        C.box(f"xbrace{side}_{py}", (0.08, 6.2, 0.14), loc=(side * 1.28, py + 3.5, sag(py) - 2.4),
              rot=(0.45, 0, 0), mat=wood_far, coll=ENV)

# lanterns: dead iron cages hanging from a couple of posts
for k, (lx, ly) in enumerate(((-1.25, 9.0), (1.25, 17.5), (-1.25, 28))):
    cage = C.cylinder(f"lantern{k}", 0.09, 0.22, loc=(lx * 1.05, ly, sag(ly) + 1.05), mat=iron, coll=ENV, verts=6)

# ------------------------------------------------------------- foreground
# broken beams leaning in from the top-left to frame the shot
for k in range(4):
    ang = rng.uniform(0.3, 0.7)
    C.box(f"fg_beam{k}", (0.22 + k * 0.03, 7, 0.28), loc=(-3.6 - k * 0.8, -1.5 + k * 1.6, 3.4 + k * 0.5),
          rot=(ang, rng.uniform(-0.2, 0.2), 0.9 + rng.uniform(-0.25, 0.25)), mat=wood, coll=ENV, bevel=0.02)
C.box("fg_post", (0.3, 0.3, 6), loc=(-3.0, -0.5, -0.5), rot=(0.05, 0.25, 0), mat=wood, coll=ENV, bevel=0.02)

# ---------------------------------------------------------------- ruins
RU = C.collection("ruins")


def building(x, y, w, d, h, name):
    taper = (rng.uniform(0.75, 1.0), rng.uniform(0.75, 1.0))
    b = C.box(name, (w, d, h), loc=(x, y, -6 + h / 2), mat=ruin, coll=RU, taper=taper)
    # broken crown: a few jagged blocks
    for j in range(rng.randint(2, 5)):
        bw = w * rng.uniform(0.15, 0.4)
        bh = rng.uniform(0.5, 3.0)
        C.box(f"{name}_c{j}", (bw, d * rng.uniform(0.2, 0.6), bh),
              loc=(x + rng.uniform(-w, w) * 0.35, y + rng.uniform(-d, d) * 0.3, -6 + h + bh / 2 - 0.2),
              rot=(0, rng.uniform(-0.3, 0.3), 0), mat=ruin, coll=RU)
    if rng.random() < 0.55:  # smokestack
        sh = rng.uniform(5, 14)
        C.cylinder(f"{name}_stack", rng.uniform(0.5, 1.0), sh,
                   loc=(x + rng.uniform(-w, w) * 0.3, y, -6 + h + sh / 2), r2=rng.uniform(0.4, 0.8),
                   mat=ruin, coll=RU, verts=12, rot=(0, rng.uniform(-0.12, 0.12), 0))
    if rng.random() < 0.6:  # scaffold lattice clinging to one face
        sx = x + rng.choice((-1, 1)) * w * 0.5
        lv = rng.randint(3, 7)
        for q in range(lv):
            zq = -6 + h * 0.3 + q * 2.2
            C.box(f"{name}_scH{q}", (0.18, d * 0.9, 0.18), loc=(sx, y, zq), rot=(rng.uniform(-0.06, 0.06), 0, 0), mat=ruin, coll=RU)
        for q in range(4):
            C.box(f"{name}_scV{q}", (0.15, 0.15, lv * 2.2 + 2), loc=(sx, y - d * 0.45 + q * d * 0.3, -6 + h * 0.3 + lv * 1.1 - 1),
                  rot=(0, rng.uniform(-0.05, 0.05), 0), mat=ruin, coll=RU)
    if rng.random() < 0.5:  # snapped girders poking out of the crown
        for q in range(rng.randint(1, 3)):
            C.box(f"{name}_gird{q}", (0.25, 0.25, rng.uniform(3, 8)),
                  loc=(x + rng.uniform(-w, w) * 0.4, y, -6 + h + rng.uniform(0.5, 2.5)),
                  rot=(rng.uniform(-0.8, 0.8), rng.uniform(-0.8, 0.8), 0), mat=ruin, coll=RU)
    if rng.random() < 0.3:  # crane boom
        bl = rng.uniform(10, 18)
        C.box(f"{name}_mast", (0.5, 0.5, h + 8), loc=(x, y, -6 + (h + 8) / 2), mat=ruin, coll=RU)
        C.box(f"{name}_boom", (0.35, bl, 0.5), loc=(x, y - bl * 0.3, -6 + h + 8),
              rot=(rng.uniform(-0.5, -0.15), 0, rng.uniform(-1.2, 1.2)), mat=ruin, coll=RU)


k = 0
for side in (-1, 1):
    for row, (y0, y1, x0, x1, hmax) in enumerate(((18, 45, 16, 30, 11), (35, 90, 22, 48, 22), (80, 200, 30, 90, 40))):
        n_b = (9, 12, 14)[row]
        for _ in range(n_b):
            building(side * rng.uniform(x0, x1), rng.uniform(y0, y1), rng.uniform(3, 9), rng.uniform(3, 9),
                     rng.uniform(hmax * 0.35, hmax), f"bld{k}")
            k += 1
# near-side shack stilts left/right of the bridge
for side in (-1, 1):
    for j in range(3):
        yy = 6 + j * 9 + rng.uniform(-2, 2)
        xx = side * rng.uniform(10, 14)
        C.box(f"shack{side}{j}", (rng.uniform(2.5, 4), rng.uniform(2.5, 4), rng.uniform(2, 3.2)),
              loc=(xx, yy, sag(yy) + 0.6), rot=(0, rng.uniform(-0.08, 0.08), rng.uniform(-0.3, 0.3)),
              mat=wood_far, coll=RU, taper=(0.9, 0.95))
        C.box(f"shack_roof{side}{j}", (4.6, 4.3, 0.15), loc=(xx, yy, sag(yy) + 2.3),
              rot=(rng.uniform(-0.2, 0.2), side * 0.25, 0), mat=wood_far, coll=RU)
        for q in range(4):
            C.box(f"shack_stilt{side}{j}{q}", (0.18, 0.18, 14), loc=(xx + rng.uniform(-1.4, 1.4), yy + rng.uniform(-1.4, 1.4), sag(yy) - 6.6),
                  mat=wood_far, coll=RU)

# abyss floor (only ever seen through fog)

# ------------------------------------------------------------------- moon
MOON = Vector((62, 330, 52))
moon_m = bpy.data.materials.new("moon")
nt, n, l = C._nodes(moon_m)
out = n.new("ShaderNodeOutputMaterial")
em = n.new("ShaderNodeEmission"); em.inputs["Strength"].default_value = 0.9
tc = n.new("ShaderNodeTexCoord")
nz = n.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 0.025; nz.inputs["Detail"].default_value = 10
nz.inputs["Roughness"].default_value = 0.7; nz.inputs["Distortion"].default_value = 0.4
l.new(tc.outputs["Object"], nz.inputs["Vector"])
ramp = n.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].position = 0.42; ramp.color_ramp.elements[0].color = (0.38, 0.02, 0.03, 1)
ramp.color_ramp.elements[1].position = 0.6; ramp.color_ramp.elements[1].color = (1.0, 0.09, 0.07, 1)
l.new(nz.outputs["Fac"], ramp.inputs["Fac"])
# limb darkening toward the rim
lw = n.new("ShaderNodeLayerWeight"); lw.inputs["Blend"].default_value = 0.35
mixd = n.new("ShaderNodeMix"); mixd.data_type = "RGBA"; mixd.blend_type = "MULTIPLY"
inv = n.new("ShaderNodeMath"); inv.operation = "SUBTRACT"; inv.inputs[0].default_value = 1
l.new(lw.outputs["Facing"], inv.inputs[1])
l.new(ramp.outputs["Color"], mixd.inputs[6])
cmb = n.new("ShaderNodeCombineColor")
for c in range(3):
    l.new(inv.outputs[0], cmb.inputs[c])
mixd.inputs[0].default_value = 0.65
l.new(cmb.outputs[0], mixd.inputs[7])
l.new(mixd.outputs[2], em.inputs["Color"])
l.new(em.outputs[0], out.inputs["Surface"])
moon = C.sphere("moon", 50, loc=MOON, mat=moon_m, coll=ENV, segs=64, rings=32)
moon.visible_shadow = False

# cloud wisps dragged across the moon: displaced emissive sheets with noise alpha
cloud_m = bpy.data.materials.new("cloud")
cloud_m.blend_method = "BLEND"
nt, n, l = C._nodes(cloud_m)
out = n.new("ShaderNodeOutputMaterial")
tc = n.new("ShaderNodeTexCoord")
mp = n.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (0.6, 1.8, 1)
l.new(tc.outputs["Object"], mp.inputs["Vector"])
nz = n.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 2.2; nz.inputs["Detail"].default_value = 7
nz.inputs["Distortion"].default_value = 1.2
l.new(mp.outputs["Vector"], nz.inputs["Vector"])
mr = n.new("ShaderNodeMapRange"); mr.inputs["From Min"].default_value = 0.5; mr.inputs["From Max"].default_value = 0.72
l.new(nz.outputs["Fac"], mr.inputs["Value"])
tr = n.new("ShaderNodeBsdfTransparent")
em = n.new("ShaderNodeEmission"); em.inputs["Color"].default_value = (0.16, 0.02, 0.025, 1)
em.inputs["Strength"].default_value = 1.0
mx = n.new("ShaderNodeMixShader")
l.new(mr.outputs["Result"], mx.inputs[0]); l.new(tr.outputs[0], mx.inputs[1]); l.new(em.outputs[0], mx.inputs[2])
l.new(mx.outputs[0], out.inputs["Surface"])
for j, (dx, dz, sx) in enumerate(((35, -14, 70), (55, 8, 60), (75, -30, 80))):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1)
    cl = C.mesh_obj(f"cloud{j}", bm, cloud_m, ENV)
    cl.location = MOON + Vector((dx, -70 - j * 8, dz))
    cl.rotation_euler = (math.pi / 2, 0, rng.uniform(-0.05, 0.05))
    cl.scale = (sx, 26 + j * 4, 1)
    cl.visible_shadow = False
    C.key(cl, "location", F0, cl.location.copy())
    C.key(cl, "location", F1, cl.location + Vector((6, 0, 0)))

# ------------------------------------------------------------- character
import robot
CH = C.collection("robot")
rig, parts = robot.build(coll=CH)
# walks away from camera (+Y): heading pi turns its -Y forward around
robot.walk(rig, (F0, F1), speed=1.05, start=Vector((0.0, 4.3, 0)), heading=math.pi,
           ground=lambda p: sag(p.y) + 0.03)  # plank top
# cool rim from up-bridge so the armour edges read against the haze
C.light("AREA", "robot_rim", (1.6, 9.5, 3.2), 900, (0.55, 0.75, 1.0), size=1.5, target=(0, 6, 1.4))
C.light("AREA", "robot_rim2", (-1.8, 9.0, 2.4), 600, (1.0, 0.35, 0.25), size=1.5, target=(0, 6, 1.3))
root = rig

# --------------------------------------------------------------- lighting
moon_sun = C.light("SUN", "moonlight", (0, 0, 0), 5.0, (1.0, 0.18, 0.12), size=math.radians(4))
moon_sun.rotation_euler = (Vector((0, 0, 0)) - MOON).to_track_quat("-Z", "Y").to_euler()
fill = C.light("SUN", "skyfill", (0, 0, 0), 0.6, (0.3, 0.32, 0.8), size=math.radians(30))
fill.rotation_euler = (math.radians(60), 0, math.radians(200))
# glow pooled on the boards ahead of the robot
C.light("POINT", "lantern_glow", (1.2, 17.5, 1.0), 25, (1.0, 0.35, 0.15), size=0.2)

# a few motes drifting through the haze
mote = C.emissive("mote", (1.0, 0.35, 0.2), 6)
C.embers("mote", 40, ((-6, 0, 0), (6, 26, 5)), 0.012, mote, rng, (F0 - 2, F1 + 2), drift=(0.4, 0.2, 0.3))

# ----------------------------------------------------------------- camera
cam = C.camera("cam", (0.15, -0.8, 1.95), lens=30, dof=(5.5, 2.8))
C.look_at(cam, (0.45, 30, 1.3))
r0 = cam.rotation_euler.copy()
for f in range(F0, F1 + 1):
    t = (f - F0) / (F1 - F0)
    cam.location = (0.15, -0.8 + 1.2 * C.ease(t), 1.95 - 0.04 * t)
    cam.rotation_euler = (r0.x + 0.012 * t, r0.y + 0.004 * math.sin(f * 0.11), r0.z)
    cam.keyframe_insert("location", frame=f); cam.keyframe_insert("rotation_euler", frame=f)
cam.data.dof.focus_object = root

C.compositor(scn, kuwahara=3.0, bloom=0.55, bloom_threshold=0.8, lift=(0.98, 0.98, 1.03),
             gamma=(1.0, 0.98, 1.02), gain=(1.08, 1.0, 0.96), saturation=0.92, vignette=0.5)

C.finish(scn, "shot01", C.args())
