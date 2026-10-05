"""Robot turnaround / walk check. blender -b -P shots/test_robot.py -- front|side|back [frame] [gun]"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
import common as C
import robot

argv = sys.argv[sys.argv.index("--") + 1:]
mode = argv[0]; frame = int(argv[1]) if len(argv) > 1 else 10; gun = len(argv) > 2
scn = C.reset()
C.setup_render(scn, (1, 40), samples=24)
C.set_fog(scn, (0.05, 0.02, 0.02), density=0.0, height=10)
C.sky_world(scn, top=(0.05, 0.03, 0.04), horizon=(0.12, 0.06, 0.06), strength=1.0)
rig, parts = robot.build(gun=gun)
robot.walk(rig, (1, 40), speed=0.9)
C.light("AREA", "key", (-2, -3, 3.5), 500, (1.0, 0.85, 0.75), size=2, target=(0, -0.5, 1))
C.light("AREA", "rim", (2, 3, 3), 600, (1.0, 0.3, 0.2), size=2, target=(0, -0.5, 1))
C.box("floor", (12, 12, 0.1), loc=(0, 0, -0.05), mat=C.painted("floor", (0.2, 0.15, 0.15), fog=0))
scn.frame_set(frame)
cy = rig.location.y
pos = {"front": (0, cy - 5, 1.1), "side": (5, cy, 1.1), "back": (0, cy + 5, 1.1), "three": (-3, cy - 4, 1.6)}[mode]
cam = C.camera("cam", pos, lens=45)
C.look_at(cam, (0, cy, 0.95))
scn.render.resolution_x, scn.render.resolution_y = 420, 600
C.compositor(scn, kuwahara=0, bloom=0.3, vignette=0)
scn.render.filepath = os.path.join(C.ROOT, "render", "stills", f"robot_{mode}_{frame}.png")
bpy.ops.render.render(write_still=True)
