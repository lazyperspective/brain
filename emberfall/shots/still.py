"""Render one frame of an already-built shot: blender -b render/blend/shotNN.blend -P shots/still.py -- FRAME SCALE"""
import bpy, sys, os
a = sys.argv[sys.argv.index("--") + 1:]
f, sc = int(a[0]), float(a[1]) if len(a) > 1 else 0.5
scn = bpy.context.scene
scn.render.resolution_percentage = int(sc * 100)
if len(a) > 2:
    scn.cycles.samples = int(a[2])
scn.frame_set(f)
name = os.path.splitext(os.path.basename(bpy.data.filepath))[0]
scn.render.filepath = os.path.join(os.path.dirname(os.path.dirname(bpy.data.filepath)), "stills", f"{name}_{f:04d}.png")
bpy.ops.render.render(write_still=True)
