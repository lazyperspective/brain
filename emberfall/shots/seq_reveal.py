"""One-shot segments set in the storm above the ruined city.

  reveal (64f): pitch black. Lightning shows the robot standing on a broken
      spire against the red moon; black; a second flash and its head has
      snapped to camera; the eye ignites; it crouches and leaps at the lens
      and the camera falls with it, pushing into the eye.
  fire (30f): out of white, still mid-fall. It whips the gauntlet arm up
      past camera at the clocktower; the drum cells charge; the camera
      rushes onto the gauntlet.

blender -b -P shots/seq_reveal.py -- reveal|fire [--render|--still N ...]
"""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Euler, noise
import common as C
import robot

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
MODE = argv[0] if argv and not argv[0].startswith("--") else "reveal"
F0, F1 = (1, 64) if MODE == "reveal" else (1, 30)
rng = random.Random(101)
scn = C.reset()
C.setup_render(scn, (F0, F1), samples=32, motion_blur=True, shutter=0.45)
FOG = (0.035, 0.008, 0.012)
C.set_fog(scn, FOG, density=0.004, height=60, strength=0.5)
sky = C.sky_world(scn, top=(0.002, 0.001, 0.003), horizon=(0.02, 0.005, 0.008), ground=FOG, stars=0.0)
sky_bg = sky.node_tree.nodes["Background"].inputs["Strength"]

SPIRE = Vector((0, 0, 30.0))

# ------------------------------------------------------------------- moon
MOON = Vector((-6, 300, 118))
moon_m = bpy.data.materials.new("moon")
nt, n, l = C._nodes(moon_m)
out = n.new("ShaderNodeOutputMaterial")
em = n.new("ShaderNodeEmission")
moon_strength = em.inputs["Strength"]
tc = n.new("ShaderNodeTexCoord")
nz = n.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 0.025; nz.inputs["Detail"].default_value = 10
nz.inputs["Roughness"].default_value = 0.7; nz.inputs["Distortion"].default_value = 0.4
l.new(tc.outputs["Object"], nz.inputs["Vector"])
ramp = n.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].position = 0.42; ramp.color_ramp.elements[0].color = (0.38, 0.02, 0.03, 1)
ramp.color_ramp.elements[1].position = 0.6; ramp.color_ramp.elements[1].color = (1.0, 0.09, 0.07, 1)
l.new(nz.outputs["Fac"], ramp.inputs["Fac"])
l.new(ramp.outputs["Color"], em.inputs["Color"])
l.new(em.outputs[0], out.inputs["Surface"])
moon = C.sphere("moon", 52, loc=MOON, mat=moon_m, segs=64, rings=32)
moon.visible_shadow = False

# ------------------------------------------------------------ the spire
stone = C.painted("stone", (0.08, 0.04, 0.045), dark=(0.02, 0.012, 0.015), light=(0.15, 0.08, 0.08),
                  rough=0.9, edge=(0.35, 0.2, 0.22), edge_w=0.05, stroke=0.8, stretch=(1, 1, 3))
iron = C.painted("iron", (0.05, 0.035, 0.04), rough=0.5, metal=0.7, edge=(0.4, 0.25, 0.25), edge_w=0.03)
C.cylinder("spire", 1.1, 34, loc=SPIRE + Vector((0, 0, -17.15)), r2=0.75, mat=stone, verts=8, smooth=False)
C.cylinder("cap", 1.35, 0.35, loc=SPIRE + Vector((0, 0, -0.18)), mat=stone, verts=8, smooth=False, bevel=0.03)
for k in range(5):  # snapped iron ribs around the top
    a = k * 2 * math.pi / 5 + 0.3
    C.box(f"rib{k}", (0.09, 0.09, rng.uniform(1.0, 2.2)), loc=SPIRE + Vector((math.cos(a) * 1.15, math.sin(a) * 1.15, 0.3)),
          rot=(math.cos(a) * 0.35, -math.sin(a) * 0.35, 0), mat=iron)
for k in range(8):  # gargoyle-ish broken blocks down the shaft
    a = rng.uniform(0, 2 * math.pi); z = rng.uniform(-14, -2)
    C.box(f"blk{k}", (0.6, 0.6, 0.9), loc=SPIRE + Vector((math.cos(a) * 1.0, math.sin(a) * 1.0, z)),
          rot=(0, 0, a), mat=stone, bevel=0.03)

# the clocktower across the gulf (the target), and the skyline
tower = Vector((-46, 80, 0))
C.box("clocktower", (8, 8, 52), loc=tower + Vector((0, 0, 26)), mat=stone, taper=(0.9, 0.9))
C.cylinder("clockface", 3.2, 0.4, loc=tower + Vector((0, -4.2, 44)), rot=(math.pi / 2, 0, 0),
           mat=iron, verts=32)
far = C.painted("far", (0.05, 0.02, 0.025), rough=0.95, bump=0.1, stroke=0.4)
for k in range(46):
    x = rng.uniform(-120, 120); y = rng.uniform(25, 220)
    if abs(x) < 8 and y < 60:
        continue
    h = rng.uniform(12, 55)
    C.box(f"bld{k}", (rng.uniform(4, 12), rng.uniform(4, 10), h), loc=(x, y, h / 2 - 2), mat=far, taper=(rng.uniform(0.6, 1), 1))
    if rng.random() < 0.35:
        C.cylinder(f"stk{k}", 0.9, h * 0.6, loc=(x + 1.5, y, h + h * 0.3 - 3), r2=0.6, mat=far, verts=10)
    if rng.random() < 0.5:  # a few lit windows
        C.box(f"win{k}", (0.6, 0.1, 0.9), loc=(x + rng.uniform(-1.5, 1.5), y - 3, rng.uniform(4, h - 2)),
              mat=C.emissive(f"winm{k}", (1.0, 0.45, 0.15), 3))
for k in range(30):  # near buildings the robot falls past
    x = rng.choice((-1, 1)) * rng.uniform(9, 30); y = rng.uniform(-30, 20)
    h = rng.uniform(8, 26)
    C.box(f"nb{k}", (rng.uniform(5, 9), rng.uniform(5, 9), h), loc=(x, y, h / 2 - 2), mat=stone, taper=(0.85, 1))

# rain: thin streaks falling through the scene, motion-blurred
rain_m = C.emissive("rain", (0.5, 0.45, 0.55), 0.6, fog=0.5)
rain = []
for k in range(260):
    p0 = Vector((rng.uniform(-12, 12), rng.uniform(-14, 10), rng.uniform(5, 40)))
    r = C.box(f"rain{k}", (0.004, 0.004, 0.35), mat=rain_m)
    r.visible_shadow = False
    for f in (F0, F1):
        t = (f - F0) / C.FPS
        z = p0.z - 22 * t
        r.location = (p0.x - 1.5 * t, p0.y, z)
        r.keyframe_insert("location", frame=f)
    C.set_interp(r, "LINEAR")

# ---------------------------------------------------------- lightning
bolt_m = C.emissive("bolt", (0.75, 0.85, 1.0), 40)
flash = C.light("SUN", "flash_back", tuple(SPIRE + Vector((6, 40, 22))), 0.0, (0.75, 0.8, 1.0), size=0.02, target=SPIRE)
front = C.light("SUN", "flash_front", tuple(SPIRE + Vector((-8, -30, 18))), 0.0, (0.8, 0.85, 1.0), size=0.05, target=SPIRE)
FLASHES = []


def flash_at(f, back, fr, sky=3.0, n_bolts=2):
    FLASHES.append(f)
    for ff, k in ((f - 1, 0.0), (f, 1.0), (f + 1, 0.55), (f + 2, 0.85), (f + 4, 0.0)):
        flash.data.energy = back * k
        front.data.energy = fr * k
        sky_bg.default_value = 0.2 + sky * k
        flash.data.keyframe_insert("energy", frame=ff)
        front.data.keyframe_insert("energy", frame=ff)
        sky_bg.keyframe_insert("default_value", frame=ff)
    r = random.Random(f)
    for j in range(n_bolts):
        top = Vector((r.uniform(-60, 60), r.uniform(90, 200), 110))
        bot = Vector((top.x + r.uniform(-25, 25), top.y + r.uniform(-20, 20), r.uniform(10, 40)))
        b = C.bolt(f"bolt{f}_{j}", top, bot, r, width=0.35, mat=bolt_m, depth=7, jag=0.12, branches=4, branch_len=0.3)
        C.visible_between(b, f, f + 2)


# --------------------------------------------------------------- robot
rig, parts = robot.build(eye_strength=0.0)
pb = parts["props"]
g_obs, g_cell = robot.gauntlet(rig)
W = lambda bn, d: robot.world_offset(rig, bn, d)
eyes = bpy.data.objects["GEO-head_eyes"]
eye_light = C.light("POINT", "eye_light", (0, 0, 0), 0.0, (0.2, 0.75, 1.0), size=0.02)
robot.bone_parent(eye_light, rig, "Head") if False else None


def key_eye(f, v, light):
    pb["Eye Light"] = v
    pb.keyframe_insert('["Eye Light"]', frame=f)
    eye_light.data.energy = light
    eye_light.data.keyframe_insert("energy", frame=f)


def eye_pos():
    dg = bpy.context.evaluated_depsgraph_get()
    ev = eyes.evaluated_get(dg)
    return sum((ev.matrix_world @ Vector(c) for c in ev.bound_box), Vector()) / 8


cam = C.camera("cam", (0, -6, 31), lens=32)

if MODE == "reveal":
    for ff, s in ((F0, 0.06), (26, 0.06), (34, 0.25), (F1, 0.32)):
        moon_strength.default_value = s
        moon_strength.keyframe_insert("default_value", frame=ff)
    flash_at(5, back=12.0, fr=0.0, sky=1.2, n_bolts=3)    # silhouette, rim only
    flash_at(19, back=8.0, fr=2.5, sky=0.8, n_bolts=2)    # head has snapped round
    flash_at(37, back=6.0, fr=6.0, sky=1.0, n_bolts=3)    # it launches on the thunder
    flash_at(52, back=4.0, fr=5.0, sky=0.6, n_bolts=1)
    moonlight = C.light("SUN", "moonlight", tuple(MOON), 0.0, (1.0, 0.18, 0.12), size=0.04, target=SPIRE)
    for ff, e in ((F0, 0.0), (26, 0.0), (32, 2.5), (F1, 3.0)):
        moonlight.data.energy = e
        moonlight.data.keyframe_insert("energy", frame=ff)
    under = C.light("AREA", "city_glow", tuple(SPIRE + Vector((0, -8, -20))), 0.0, (1.0, 0.4, 0.15), size=20, target=SPIRE + Vector((0, -6, 0)))
    for ff, e in ((F0, 0.0), (36, 0.0), (48, 9000.0), (F1, 14000.0)):
        under.data.energy = e
        under.data.keyframe_insert("energy", frame=ff)
    for f, v, e in ((F0, 0, 0), (21, 0, 0), (23, 0.6, 0.3), (24, 0.1, 0.05), (25, 3.5, 2.0), (28, 2.4, 1.2), (56, 3.0, 2.0), (60, 4.0, 2.5), (F1, 16.0, 6.0)):
        key_eye(f, v, e)
    for ff, v in ((F0, 0.0), (24, 0.0), (26, 1.5), (F1, 2.0)):
        g_cell.default_value = v
        g_cell.keyframe_insert("default_value", frame=ff)
    # body: idle -> head snap -> crouch -> leap -> dive
    rig.location = SPIRE.copy()
    for f in range(F0, F1 + 1):
        snap = C.ease_out(min(1, max(0, (f - 9) / 3)), 4)          # whip between the flashes
        crouch = C.ease(min(1, max(0, (f - 29) / 7)))
        launch = max(0.0, (f - 36) / C.FPS)
        rig.rotation_euler = (0, 0, 0.9 * (1 - snap)) if f < 37 else rig.rotation_euler  # body half-turned away, then whips round
        rots = {"Head": (0.05, 0.6 * (1 - snap), 0), "ROBO-Y-Neck": (0, 0, -0.3 * (1 - snap)),
                "Torso": (0.5 * crouch * (1 - min(1, launch * 3)), 0, 0),
                "Chest": (0.25 * crouch, 0, 0)}
        locs = {"Torso": W("Torso", (0, -0.05 * crouch, -0.45 * crouch * (1 - min(1, launch * 3)))),
                "IK-Wrist.L": W("IK-Wrist.L", (0.12 * crouch, 0.35 * crouch, -0.1 * crouch)),
                "IK-Wrist.R": W("IK-Wrist.R", (-0.12 * crouch, 0.35 * crouch, -0.1 * crouch))}
        if launch > 0:  # airborne: tuck the feet, arms swept back, body pitched into the dive
            tuck = min(1, launch * 4)
            locs["IK-Foot.L"] = W("IK-Foot.L", (0.05, 0.35 * tuck, 0.45 * tuck))
            locs["IK-Foot.R"] = W("IK-Foot.R", (-0.08, 0.2 * tuck, 0.3 * tuck))
            rig.location = SPIRE + Vector((0, -7.5 * launch, 2.6 * launch - 9.0 * launch * launch))
            rig.rotation_euler = (0.9 * min(1, launch * 2.2), 0, 0)
        else:
            rig.location = SPIRE.copy()
            rig.rotation_euler = (0, 0, 0.9 * (1 - snap))
        rig.keyframe_insert("location", frame=f)
        rig.keyframe_insert("rotation_euler", frame=f)
        robot.pose(rig, f, rots=rots, locs=locs)
    # camera: held, flinching with the flashes; pulls back and falls with the leap; ends in the eye
    base = Vector((0.55, -3.4, 30.35))
    for f in range(F0, F1 + 1):
        scn.frame_set(f)
        e = eye_pos()
        jolt = sum(0.03 * math.exp(-(f - ff) * 0.5) for ff in FLASHES if f >= ff)
        if f < 37:
            p = base + Vector((0, -0.04 * (f - F0) / 36, 0)) + noise.noise_vector(Vector((f * 0.6, 1, 0))) * jolt
            tgt = SPIRE + Vector((0, 0, 1.45))
            lens = 22 + 6 * C.ease((f - F0) / 36)
        else:
            t = C.ease((f - 37) / (F1 - 37))
            hb = rig.pose.bones["Head"]
            face = ((rig.matrix_world @ hb.matrix).to_3x3() @ Vector((0, 0, -1))).normalized()
            face_alt = (rig.matrix_world.to_3x3() @ Vector((0, -1, 0))).normalized()
            fwd = face if face.dot(face_alt) > 0.3 else face_alt
            follow = e + Vector((0.6, -3.6, 0.5))
            close = e + fwd * 0.17
            p = follow.lerp(close, t ** 1.6)
            tgt = e
            lens = 38 - 8 * t
        cam.location = p
        C.look_at(cam, tgt)
        cam.rotation_euler.y += 0.05 * math.sin(f * 0.17) if f > 37 else 0.0
        cam.data.lens = lens
        cam.keyframe_insert("location", frame=f); cam.keyframe_insert("rotation_euler", frame=f)
        cam.data.keyframe_insert("lens", frame=f)
        eye_light.location = e + Vector((0, -0.06, 0)); eye_light.keyframe_insert("location", frame=f)

else:  # fire
    moon_strength.default_value = 0.3
    key_eye(F0, 3.0, 1.5)
    flash_at(2, back=6.0, fr=3.0, sky=2.0, n_bolts=2)
    flash_at(15, back=5.0, fr=4.0, sky=0.8, n_bolts=2)   # lights the aim
    moonlight = C.light("SUN", "moonlight", tuple(MOON), 3.0, (1.0, 0.18, 0.12), size=0.04, target=SPIRE)
    C.light("AREA", "city_glow", tuple(SPIRE + Vector((0, -14, -30))), 16000.0, (1.0, 0.4, 0.15), size=24,
            target=SPIRE + Vector((0, -12, -8)))
    C.light("AREA", "cam_fill", tuple(SPIRE + Vector((3, -20, -8))), 1200.0, (0.4, 0.5, 1.0), size=6,
            target=SPIRE + Vector((0, -12, -8)))
    for f, v in ((F0, 0.3), (10, 0.5), (18, 6.0), (24, 12.0), (F1, 20.0)):
        g_cell.default_value = v
        g_cell.keyframe_insert("default_value", frame=f)
    start = SPIRE + Vector((0, -10, -6))
    for f in range(F0, F1 + 1):
        t = (f - F0) / C.FPS
        rig.location = start + Vector((0, -3.0 * t, -9.0 * t * t - 4 * t))
        twist = C.ease(min(1, (f - F0) / 12))
        rig.rotation_euler = (0.5 - 0.3 * twist, 0.25 * twist, math.radians(180) * twist)  # spins to face the tower
        rig.keyframe_insert("location", frame=f); rig.keyframe_insert("rotation_euler", frame=f)
        aim = C.ease_out(min(1, max(0, (f - 6) / 8)), 3)
        robot.pose(rig, f, rots={"Head": (-0.1, 0, 0), "Chest": (-0.1 * aim, 0, 0)},
                   locs={"IK-Wrist.R": W("IK-Wrist.R", (-0.15 * aim, -0.55 * aim, 0.42 * aim)),
                         "IK-Wrist.L": W("IK-Wrist.L", (0.2, 0.25, 0.1)),
                         "IK-Foot.L": W("IK-Foot.L", (0.05, 0.25, 0.3)), "IK-Foot.R": W("IK-Foot.R", (-0.1, -0.1, 0.15))})
    muzzle = bpy.data.objects["g_muzzle"]
    for f in range(F0, F1 + 1):
        scn.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        m = muzzle.evaluated_get(dg).matrix_world.translation.copy()
        e = eye_pos()
        t = C.ease((f - F0) / (F1 - F0))
        wide = e + Vector((1.6, -2.6, 0.4))
        tight = m + Vector((0.05, -0.35, 0.05))
        cam.location = wide.lerp(tight, t ** 1.8)
        C.look_at(cam, e.lerp(m, min(1, t * 1.5)))
        cam.data.lens = 28 + 10 * t
        cam.keyframe_insert("location", frame=f); cam.keyframe_insert("rotation_euler", frame=f)
        cam.data.keyframe_insert("lens", frame=f)
        eye_light.location = e + Vector((0, -0.06, 0)); eye_light.keyframe_insert("location", frame=f)

C.compositor(scn, kuwahara=2.5, bloom=0.9, bloom_threshold=0.9, bloom_size=0.65, lift=(0.99, 0.98, 1.02),
             gain=(1.04, 1.0, 1.0), saturation=1.05, vignette=0.55)
C.finish(scn, f"seq_{MODE}", C.args())
