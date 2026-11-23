"""python crop.py frame x0 y0 w h out  -> crop of the 2x buffer (coords in 1x pixels)"""
import sys, cv2
from pp import render, scene, backdrop
fi, x0, y0, w, h = [int(a) for a in sys.argv[1:6]]
R = render.Renderer(scene.Scene(), backdrop.Backdrop())
buf = R.render(fi, post=False)
cv2.imwrite(sys.argv[6], buf[y0*2:(y0+h)*2, x0*2:(x0+w)*2, 2::-1])
