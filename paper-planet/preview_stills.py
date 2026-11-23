"""Preview stills: python preview_stills.py out_prefix [--ss 1 --w 960] f1 f2 ...  (writes a tiled jpg too)"""
import sys, time, argparse, cv2, numpy as np
sys.path.insert(0, '.')
from pp import render, scene, backdrop
ap = argparse.ArgumentParser()
ap.add_argument('pre'); ap.add_argument('frames', nargs='+', type=int)
ap.add_argument('--ss', type=int, default=1); ap.add_argument('--w', type=int, default=960)
ap.add_argument('--cols', type=int, default=3)
a = ap.parse_args()
h = a.w * 9 // 16
t = time.time()
R = render.Renderer(scene.Scene(), backdrop.Backdrop(ss=a.ss, w=a.w, h=h), ss=a.ss, w=a.w, h=h)
print('init %.1fs' % (time.time() - t))
imgs = []
for fi in a.frames:
    t = time.time()
    img = R.render(fi)[..., ::-1].copy()
    cv2.putText(img, '%d  t=%.1f' % (fi, fi / 30), (8, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA)
    imgs.append(img)
    print(fi, '%.2fs' % (time.time() - t), flush=True)
if len(imgs) == 1:
    cv2.imwrite(a.pre + '.jpg', imgs[0], [cv2.IMWRITE_JPEG_QUALITY, 90])
else:
    c = a.cols
    while len(imgs) % c: imgs.append(np.zeros_like(imgs[0]))
    rows = [np.concatenate(imgs[i:i + c], 1) for i in range(0, len(imgs), c)]
    cv2.imwrite(a.pre + '.jpg', np.concatenate(rows, 0), [cv2.IMWRITE_JPEG_QUALITY, 88])
