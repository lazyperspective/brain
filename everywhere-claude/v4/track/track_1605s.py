# IMG_1605 square (src 4.9-6.6): ground-plane homography on the wet paving (y > 960), ref src 5.4 (k=15), both directions
import sys; sys.path.insert(0, '/home/user/brain/everywhere-claude/v4/tools')
import plates, track2d, cv2, numpy as np
T0, N = 4.9, 52
REF = 15
fr = list(plates.frames('IMG_1605', T0, N, gray=True))
def mask(k, f):
    m = np.zeros_like(f); y0 = 960 + int(3 * k); m[y0:1900, 10:-10] = 255; return m
Hf, sf = track2d.track(fr[REF:], mask, model='homography', maxc=700, scale=0.5, ransac=1.5)
Hb, sb = track2d.track(fr[:REF + 1][::-1], mask, model='homography', maxc=700, scale=0.5, ransac=1.5)
Hs = [None] * N
for i, H in enumerate(Hb): Hs[REF - i] = H
for i, H in enumerate(Hf): Hs[REF + i] = H
print('fwd', [(round(s['err'], 2), s['inl']) for s in sf[::5]]); print('bwd', [(round(s['err'], 2), s['inl']) for s in sb[::5]])
track2d.save('/home/user/brain/everywhere-claude/v4/track/1605s.json', T0=T0, N=N, REF=REF, H=Hs, stats=sf + sb)
pts = [[560, 1150], [420, 1060], [300, 1300], [800, 1300], [560, 1600], [250, 1000], [700, 1000]]
track2d.overlay_sheet('IMG_1605', T0, N, Hs, pts, [0, 8, 15, 25, 35, 45, 51], '/home/user/brain/everywhere-claude/v4/check/ov1605s.jpg', w=220, crop=(0, 800, 1080, 1920))
