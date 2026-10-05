"""Face look-dev: a reference-framed close-up of the courier, for side by side
comparison. blender -b -P shots/lookdev_face.py -- [tag] [samples]"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
import common as C
import courier, face

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
tag = argv[0] if argv else "a"
view = argv[2] if len(argv) > 2 else "portrait"
spp = int(argv[1]) if len(argv) > 1 else 32
scn = C.reset()
C.setup_render(scn, (1, 1), samples=spp)
C.set_fog(scn, (0.05, 0.015, 0.02), density=0.0, height=10)
C.sky_world(scn, top=(0.01, 0.005, 0.008), horizon=(0.03, 0.01, 0.015), strength=1.0)
rig, parts = courier.build("close")
HC = Vector((0, -0.03, 1.46))
courier.pose(rig, 1, {"neck": (-0.06, 0, 0.05), "head": (-0.1, 0, 0.12)})
neutral = view.endswith("neutral")
face.set_expression(parts["body"], parts["jaw"], 1, **({} if neutral else dict(worry=1.0, wide=0.0, open_=0.6, snarl=1.0, lids=0.5)))
# light like the reference: warm soft key camera-left, hot red rim camera-right, dim violet fill
C.light("AREA", "key", tuple(HC + Vector((-0.75, -0.45, 0.3))), 11, (1.0, 0.74, 0.72), size=0.45, target=HC)
C.light("AREA", "rim", tuple(HC + Vector((0.5, 0.25, 0.15))), 12, (1.0, 0.12, 0.14), size=0.5, target=HC)
C.light("AREA", "fill", tuple(HC + Vector((0.3, -0.6, -0.3))), 2.5, (0.5, 0.35, 0.8), size=0.8, target=HC)
bg = C.box("bg", (4, 0.1, 3), loc=tuple(HC + Vector((0, 1.5, 0))), mat=C.emissive("bgm", (0.05, 0.012, 0.02), 1.0))
dist = {"portrait": 1.25, "close": 0.6, "closeneutral": 0.6}[view]
cam = C.camera("cam", tuple(HC + Vector((-0.14, -1.25, -0.01)) * (dist / 1.25)), lens=60, dof=(dist, 4.0))
C.look_at(cam, HC + Vector((0.0, -0.06, -0.01 if view == "portrait" else -0.04)))
scn.render.resolution_x, scn.render.resolution_y = 1280, 536
C.compositor(scn, kuwahara=2.0, bloom=0.4, vignette=0.5, saturation=1.05)
scn.render.filepath = os.path.join(C.ROOT, "render", "stills", f"face_{tag}_{view}.png")
bpy.ops.render.render(write_still=True)
