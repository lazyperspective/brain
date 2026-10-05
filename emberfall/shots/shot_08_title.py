"""Shot 8 — Title (32 frames, 1.3s).

Out of black: EMBERFALL in heavy riveted iron, lit from below by the dying
teal charge, its bevels catching the red moon. Embers drift through.
"""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Euler, noise
import common as C

F0, F1 = 1, 32
rng = random.Random(88)
scn = C.reset()
C.setup_render(scn, (F0, F1), samples=32)
C.set_fog(scn, (0.02, 0.005, 0.006), density=0.0, height=10, strength=1.0)
C.sky_world(scn, top=(0.0, 0.0, 0.0), horizon=(0.004, 0.001, 0.001), strength=1.0)

iron = C.painted("title_iron", (0.07, 0.04, 0.04), dark=(0.02, 0.012, 0.012), light=(0.14, 0.08, 0.07),
                 rough=0.45, metal=0.85, edge=(1.0, 0.4, 0.25), edge_w=0.02, stroke=6, stretch=(1, 1, 1), fog=0)

cu = bpy.data.curves.new("title", "FONT")
cu.body = "EMBERFALL"
cu.align_x = "CENTER"
cu.align_y = "CENTER"
cu.size = 0.52
cu.space_character = 1.12
cu.extrude = 0.08
cu.bevel_depth = 0.018
cu.bevel_resolution = 2
cu.materials.append(iron)
title = C.link(bpy.data.objects.new("title", cu))
title.rotation_euler = (math.pi / 2, 0, 0)
title.scale = (1.0, 1.25, 1.0)

# a thin seam of teal charge under the letters
seam_m = C.emissive("seam", (0.15, 0.75, 1.0), 0.0)
seam = C.box("seam", (3.9, 0.01, 0.008), loc=(0, -0.05, -0.38), mat=seam_m)
seam_em = seam_m.node_tree.nodes["Emission"].inputs["Strength"]
for f, v in ((F0, 0), (8, 0), (14, 40), (22, 18), (F1, 10)):
    seam_em.default_value = v; seam_em.keyframe_insert("default_value", frame=f)
for f, sx in ((F0, 0.0), (8, 0.0), (16, 1.0), (F1, 1.0)):
    seam.scale = (max(sx, 0.001), 1, 1); seam.keyframe_insert("scale", frame=f)

rim = C.light("AREA", "rim", (0, 2.0, 2.4), 0, (1.0, 0.18, 0.12), size=6, target=(0, 0, 0))
under = C.light("AREA", "under", (0, -1.4, -1.6), 0, (0.2, 0.65, 1.0), size=6, target=(0, 0, 0))
for f, a, b in ((F0, 0, 0), (6, 0, 0), (14, 900, 260), (F1, 760, 220)):
    rim.data.energy = a; under.data.energy = b
    rim.data.keyframe_insert("energy", frame=f); under.data.keyframe_insert("energy", frame=f)

ember_m = C.emissive("ember", (1.0, 0.35, 0.12), 14)
C.embers("ember", 50, ((-4, -1.5, -1.6), (4, 1.5, 0.5)), 0.012, ember_m, rng, (F0 - 2, F1 + 2), drift=(0.5, 0, 0.9))

cam = C.camera("cam", (0, -7.5, 0.1), lens=50)
for f in range(F0, F1 + 1):
    t = (f - F0) / (F1 - F0)
    cam.location = (0, -7.5 + 0.5 * C.ease(t), 0.1)
    C.look_at(cam, (0, 0, -0.05))
    cam.keyframe_insert("location", frame=f); cam.keyframe_insert("rotation_euler", frame=f)


C.compositor(scn, kuwahara=0, bloom=0.8, bloom_threshold=0.8, saturation=1.05, vignette=0.6)
C.finish(scn, "shot08", C.args())
