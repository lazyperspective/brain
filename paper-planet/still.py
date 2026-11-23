"""Render stills: python still.py out_prefix f1 f2 ...   (frame indices; add 'x2' to keep 2x)"""
import sys, time, cv2
from pp import render, scene
t = time.time()
sc = scene.Scene()
try:
    from pp import backdrop
    bd = backdrop.Backdrop()
except Exception as e:
    print('no backdrop', e); bd = None
R = render.Renderer(sc, bd)
print('init', round(time.time() - t, 2), 's;', len(sc.pieces), 'pieces')
pre = sys.argv[1]
for a in sys.argv[2:]:
    fi = int(a)
    t = time.time()
    img = R.render(fi)
    print(fi, round(time.time() - t, 2), 's')
    cv2.imwrite('%s_%04d.png' % (pre, fi), img[..., ::-1])
