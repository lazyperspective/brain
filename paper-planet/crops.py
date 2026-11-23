"""python crops.py out_prefix frame:x0:y0:w:h ...  (1x coords) -> 2x crops"""
import sys, cv2
from pp import render, scene, backdrop
R = render.Renderer(scene.Scene(), backdrop.Backdrop())
for a in sys.argv[2:]:
    fi, x0, y0, w, h = [int(v) for v in a.split(':')]
    buf = R.render(fi, post=False)
    cv2.imwrite('%s_%04d.jpg' % (sys.argv[1], fi), buf[y0*2:(y0+h)*2, x0*2:(x0+w)*2, 2::-1], [cv2.IMWRITE_JPEG_QUALITY, 92])
