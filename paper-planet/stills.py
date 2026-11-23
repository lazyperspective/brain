"""Hero stills: one per close-up in the camera's key list (1080p PNG + 4K JPEG from the 2x buffer)."""
import cv2, os, shutil
from pp import render, scene, backdrop, core
HERO = [(name, int(round(t * core.FPS)) % core.NF) for (t, name, *_) in core.HERO]
HERO = [('whale_breach' if n == 'whale' else n, f) for n, f in HERO]
if os.path.isdir('out/stills'):
    shutil.rmtree('out/stills')
os.makedirs('out/stills')
R = render.Renderer(scene.Scene(), backdrop.Backdrop())
for name, fi in HERO:
    img = R.render(fi)
    cv2.imwrite('out/stills/%s_f%04d.png' % (name, fi), img[..., ::-1])
    cv2.imwrite('out/stills/%s_f%04d_4k.jpg' % (name, fi), R.buf[..., 2::-1], [cv2.IMWRITE_JPEG_QUALITY, 95])
    print(name, fi, flush=True)
