"""Turnaround of the courier: front / side / back, mid-stride. Look-dev only."""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
import common as C
import courier

scn = C.reset()
C.setup_render(scn, (1, 1), samples=24)
C.set_fog(scn, (0.05, 0.02, 0.02), density=0.0, height=10)
C.sky_world(scn, top=(0.05, 0.03, 0.04), horizon=(0.12, 0.06, 0.06), strength=1.0)
rig, parts = courier.build("far")
courier.pose(rig, 1, courier.walk_pose(math.pi / 2))
C.light("AREA", "key", (-2, -3, 3), 300, (1.0, 0.85, 0.75), size=2, target=(0, 0, 1))
C.light("AREA", "rim", (2, 3, 2.5), 300, (1.0, 0.3, 0.2), size=2, target=(0, 0, 1))
C.box("floor", (10, 10, 0.1), loc=(0, 0, -0.05), mat=C.painted("floor", (0.2, 0.15, 0.15), fog=0))
mode = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "front"
pos = {"front": (0, -4.2, 1.0), "side": (4.2, 0, 1.0), "back": (0, 4.2, 1.0)}[mode]
cam = C.camera("cam", pos, lens=50)
C.look_at(cam, (0, 0, 0.85))
scn.render.resolution_x, scn.render.resolution_y = 400, 600
C.compositor(scn, kuwahara=0, bloom=0.3, vignette=0)
scn.render.filepath = os.path.join(C.ROOT, "render", "stills", f"courier_{mode}.png")
bpy.ops.render.render(write_still=True)
