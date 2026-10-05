"""Shot 2 — The Look (32 frames, 1.3s).

Close on the courier: hood, respirator, brass goggles over the real face of
the base mesh. The red moon sits in the lenses; she tips her head up, the
iris shutters snap closed and the gauntlet's teal glow climbs her face.
"""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Euler, noise
import common as C
import courier

F0, F1 = 1, 32
rng = random.Random(21)
scn = C.reset()
C.setup_render(scn, (F0, F1), samples=48)
C.set_fog(scn, (0.06, 0.015, 0.015), density=0.0, height=10, strength=1.0)
C.sky_world(scn, top=(0.01, 0.004, 0.006), horizon=(0.06, 0.012, 0.012), strength=1.0)

rig, parts = courier.build("close")
HC = Vector((0, -0.03, 1.46))  # head centre, eye height

# ------------------------------------------------------------ animation
# head tips up toward the sky with a small settle; breath in the chest
for f in range(F0, F1 + 1):
    up = C.ease_out(min(1, max(0, (f - 6) / 14)), 3)
    courier.pose(rig, f, {
        "neck": (0.05 - 0.12 * up, 0, -0.06 - 0.03 * up),
        "head": (0.04 - 0.14 * up + 0.01 * math.sin(f * 0.4), 0, -0.08 - 0.04 * up),
        "chest": (0.01 * math.sin(f * 0.25), 0, 0),
        "upperarm.R": (0.2, 0, 0), "forearm.R": (-1.2, 0, 0),  # gauntlet raised below frame
    })
for arm in parts["shutters"]:  # open, then snap shut with a small overshoot
    for f, ang in ((F0, 0.0), (17, 0.0), (21, 0.95), (23, 0.86), (F1, 0.88)):
        arm.rotation_euler = (0, 0, ang)
        arm.keyframe_insert("rotation_euler", frame=f)
iris_em = parts["iris_strength"]
for f, s in ((F0, 3.5), (14, 4.5), (18, 9.0), (20, 70.0), (24, 28.0), (F1, 34.0)):
    iris_em.default_value = s
    iris_em.keyframe_insert("default_value", frame=f)

# ------------------------------------------------------------- lighting
rim = C.light("AREA", "moon_rim", tuple(HC + Vector((-0.35, 0.45, 0.35))), 18, (1.0, 0.15, 0.1), size=0.6, target=HC)
rim2 = C.light("AREA", "moon_rim2", tuple(HC + Vector((0.4, 0.35, 0.2))), 8, (1.0, 0.2, 0.12), size=0.4, target=HC)
key = C.light("AREA", "key", tuple(HC + Vector((-0.5, -0.6, 0.45))), 4.0, (1.0, 0.45, 0.35), size=0.8, target=HC)
under = C.light("POINT", "gauntlet_glow", tuple(HC + Vector((0.12, -0.32, -0.32))), 0.0, (0.2, 0.65, 1.0), size=0.05)
for f, e in ((F0, 1.5), (16, 2.0), (20, 22.0), (24, 11.0), (F1, 13.0)):
    under.data.energy = e
    under.data.keyframe_insert("energy", frame=f)
parts["gauntlet_light"].data.energy = 0  # replaced by the staged under-light
moon_m = C.emissive("moon_refl", (1.0, 0.08, 0.06), 1.5)  # red moon behind camera, for the lenses
moon = C.sphere("moon_refl", 0.35, loc=tuple(HC + Vector((0.9, -4.0, 1.5))), mat=moon_m)
moon.visible_camera = False
moon.visible_shadow = False

bg_m = C.emissive("backdrop", (0.07, 0.014, 0.014), 1.0)
bg = C.box("backdrop", (6, 0.1, 4), loc=tuple(HC + Vector((0, 2.5, 0))), mat=bg_m)
bg.visible_shadow = False
ember_m = C.emissive("ember", (1.0, 0.3, 0.12), 25)
C.embers("ember", 26, (tuple(HC + Vector((-0.6, -0.3, -0.4))), tuple(HC + Vector((0.6, 1.2, 0.3)))), 0.004, ember_m, rng,
         (F0 - 2, F1 + 2), drift=(0.25, 0, 0.18))

# --------------------------------------------------------------- camera
cam = C.camera("cam", tuple(HC + Vector((-0.36, -0.74, 0.06))), lens=55, dof=(0.8, 2.2))
C.look_at(cam, HC + Vector((0.03, -0.05, -0.03)))
r0 = cam.rotation_euler.copy()
l0 = cam.location.copy()
C.shake(cam, (F0, F1), amp=0.0, rot_amp=0.003, freq=0.25, seed=3, base_rot=r0)
for f in range(F0, F1 + 1):  # slow push-in under the handheld rotation noise
    t = (f - F0) / (F1 - F0)
    cam.location = l0 + Vector((0.025, 0.06, 0.006)) * C.ease(t)
    cam.keyframe_insert("location", frame=f)
cam.data.dof.focus_object = bpy.data.objects["courier_eye1"]

C.compositor(scn, kuwahara=3.0, bloom=0.7, bloom_threshold=0.85, lift=(0.99, 0.98, 1.02),
             gamma=(1.0, 0.98, 1.0), gain=(1.06, 1.0, 0.98), saturation=1.0, vignette=0.55)
C.finish(scn, "shot02", C.args())
