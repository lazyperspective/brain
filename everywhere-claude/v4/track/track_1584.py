# IMG_1584 roof ridge: KLT homography of the corrugated roof + ridge line (detected in frame 0, propagated by the roof homography)
import sys; sys.path.insert(0, '/home/user/brain/everywhere-claude/v4/tools')
import plates, track2d, cv2, numpy as np
T0, N = 3.9, 105
fr = list(plates.frames('IMG_1584', T0, N, gray=True))
# ridge in frame 0: per column, strongest vertical intensity edge in 1450..1700 (background above / roof below)
g = cv2.GaussianBlur(fr[0].astype(np.float32), (0, 0), 2.0)
gy = np.abs(cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=5))
xs = np.arange(20, 1060, 10); ys = []
for x in xs:
    col = gy[1450:1700, x - 3:x + 4].mean(1); ys.append(1450 + int(np.argmax(col)))
ys = np.array(ys, float)
# robust line fit
A = np.stack([xs, np.ones_like(xs)], 1); w = np.ones_like(ys)
for _ in range(6):
    c = np.linalg.lstsq(A * w[:, None], ys * w, rcond=None)[0]; r = ys - A @ c; s = 1.4826 * np.median(np.abs(r)) + 0.5; w = (np.abs(r) < 2.5 * s).astype(float)
print('ridge frame0: y = %.4f x + %.1f   inliers %d/%d  rms %.2f' % (c[0], c[1], w.sum(), len(w), np.sqrt(np.mean(r[w > 0] ** 2))))
ridge0 = np.array([0.0019, 1573.0])   # read off full-res crops (ridge-cap top edge), frame 0
def mask(k, f):
    m = np.zeros_like(f); m[1625:1915, :] = 255; return m
Hs, st = track2d.track(fr, mask, model='homography', verbose=True)
print('err', np.round([s['err'] for s in st[::10]], 2))
track2d.save('/home/user/brain/everywhere-claude/v4/track/1584.json', T0=T0, N=N, H=Hs, ridge0=ridge0, stats=st)
# overlay: crosses on the ridge and on the roof (frame-0 coords)
pts = [[x, ridge0[0] * x + ridge0[1]] for x in range(60, 1080, 120)] + [[x, 1750] for x in range(100, 1080, 160)] + [[x, 1880] for x in range(40, 1080, 160)]
pts = [[x, ridge0[0] * x + ridge0[1]] for x in range(60, 1080, 60)] + [[917, 1573], [1010, 1573], [960, 1505]]
track2d.overlay_sheet('IMG_1584', T0, N, Hs, pts, [0, 10, 20, 30], '/home/user/brain/everywhere-claude/v4/check/ov1584.jpg', crop=(0, 1400, 1080, 1700), w=540)
