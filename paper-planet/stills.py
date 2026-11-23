"""Hero stills: one per region at its fully open moment (1080p PNG + 4K JPEG from the 2x buffer)."""
import cv2, os
from pp import render, scene, backdrop
HERO = [('europe', 45), ('africa', 1770), ('arctic_greenland', 300), ('south_america', 400), ('north_america', 590),
        ('pacific', 939), ('antarctica', 1010), ('oceania', 1225), ('east_asia', 1300), ('south_asia', 1500)]
os.makedirs('out/stills', exist_ok=True)
R = render.Renderer(scene.Scene(), backdrop.Backdrop())
for name, fi in HERO:
    img = R.render(fi)
    cv2.imwrite('out/stills/%s_f%04d.png' % (name, fi), img[..., ::-1])
    cv2.imwrite('out/stills/%s_f%04d_4k.jpg' % (name, fi), R.buf[..., 2::-1], [cv2.IMWRITE_JPEG_QUALITY, 95])
    print(name, fi)
