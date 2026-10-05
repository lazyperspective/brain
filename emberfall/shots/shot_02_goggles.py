"""Shot 2 — The Look (32 frames, 1.3s).

Close on the robot's head: scratched white shell, cracked visor, the eye a
dim teal slit. It tips its head up toward the sky; the eye stutters, then
flares to full burn and the teal light rakes across the visor.
"""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Euler, noise
import common as C
import robot

F0, F1 = 1, 32
rng = random.Random(21)
scn = C.reset()
C.setup_render(scn, (F0, F1), samples=48)
C.set_fog(scn, (0.06, 0.015, 0.015), density=0.0, height=10, strength=1.0)
C.sky_world(scn, top=(0.01, 0.004, 0.006), horizon=(0.06, 0.012, 0.012), strength=1.0)

rig, parts = robot.build(eye_strength=0.3)
HC = Vector((0, -0.08, 1.84))  # visor / eye

# ------------------------------------------------------------ animation
pb = parts["props"]
for f in range(F0, F1 + 1):
    up = C.ease_out(min(1, max(0, (f - 6) / 14)), 3)
    robot.pose(rig, f, rots={
        "Head": (0.1 - 0.32 * up + 0.01 * math.sin(f * 0.4), 0, -0.12 + 0.08 * up),
        "Chest": (0.04 - 0.05 * up + 0.006 * math.sin(f * 0.3), 0, 0),
    })
# the eye: idle flicker, a stutter as it locks on, then full burn
for f, v in ((F0, 0.35), (6, 0.3), (12, 0.45), (16, 0.15), (17, 0.9), (18, 0.2), (19, 1.6), (21, 4.5), (24, 3.0), (F1, 3.4)):
    pb["Eye Light"] = v
    pb.keyframe_insert('["Eye Light"]', frame=f)

# ------------------------------------------------------------- lighting
C.light("AREA", "moon_rim", tuple(HC + Vector((-0.45, 0.55, 0.4))), 40, (1.0, 0.15, 0.1), size=0.6, target=HC)
C.light("AREA", "moon_rim2", tuple(HC + Vector((0.5, 0.45, 0.25))), 22, (1.0, 0.2, 0.12), size=0.5, target=HC)
C.light("AREA", "key", tuple(HC + Vector((-0.6, -0.7, 0.5))), 6.0, (1.0, 0.5, 0.4), size=0.8, target=HC)
eye_l = C.light("POINT", "eye_glow", tuple(HC + Vector((0, -0.12, 0.03))), 0.0, (0.2, 0.75, 1.0), size=0.02)
for f, e in ((F0, 0.06), (16, 0.03), (17, 0.15), (18, 0.04), (19, 0.3), (21, 1.1), (24, 0.75), (F1, 0.85)):
    eye_l.data.energy = e
    eye_l.data.keyframe_insert("energy", frame=f)
moon_m = C.emissive("moon_refl", (1.0, 0.08, 0.06), 1.5)  # red moon behind camera, for the visor
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
cam = C.camera("cam", tuple(HC + Vector((-0.34, -0.78, -0.1))), lens=50, dof=(0.86, 2.4))
C.look_at(cam, HC + Vector((0.0, 0.0, -0.01)))
r0 = cam.rotation_euler.copy()
l0 = cam.location.copy()
C.shake(cam, (F0, F1), amp=0.0, rot_amp=0.003, freq=0.25, seed=3, base_rot=r0)
for f in range(F0, F1 + 1):  # slow push-in under the handheld rotation noise
    t = (f - F0) / (F1 - F0)
    cam.location = l0 + Vector((0.03, 0.08, 0.01)) * C.ease(t)
    cam.keyframe_insert("location", frame=f)
cam.data.dof.focus_object = bpy.data.objects["GEO-head_eyes"]

C.compositor(scn, kuwahara=3.0, bloom=0.8, bloom_threshold=0.85, lift=(0.99, 0.98, 1.02),
             gamma=(1.0, 0.98, 1.0), gain=(1.06, 1.0, 0.98), saturation=1.0, vignette=0.55)
C.finish(scn, "shot02", C.args())
