# IMG_1584 spruce (src 10.6-12.8): homography on the tree + houses (sky masked: the clouds drift), ref src 11.6 (k=30), both ways
import sys; sys.path.insert(0, '/home/user/brain/everywhere-claude/v4/tools')
import plates, track2d, cv2, numpy as np
T0, N = 10.6, 66
REF = 30
fr = list(plates.frames('IMG_1584', T0, N, gray=True))
def mask(k, f):
    m = np.zeros_like(f); m[380:1880, 20:-20] = 255
    sky = (cv2.GaussianBlur(f, (0, 0), 3) > 150).astype(np.uint8)     # bright sky / cloud -> out
    m[sky > 0] = 0; return m
Hf, sf = track2d.track(fr[REF:], mask, model='homography', maxc=700, scale=0.5, ransac=1.5)
Hb, sb = track2d.track(fr[:REF + 1][::-1], mask, model='homography', maxc=700, scale=0.5, ransac=1.5)
Hs = [None] * N
for i, H in enumerate(Hb): Hs[REF - i] = H
for i, H in enumerate(Hf): Hs[REF + i] = H
print('fwd', [(round(s['err'], 2), s['inl']) for s in sf[::5]]); print('bwd', [(round(s['err'], 2), s['inl']) for s in sb[::5]])
track2d.save('/home/user/brain/everywhere-claude/v4/track/1584s.json', T0=T0, N=N, REF=REF, H=Hs, tip=[553, 513], bot=1900, stats=sf + sb)
pts = [[553, 513], [553, 700], [400, 900], [700, 900], [553, 1200], [300, 1400], [800, 1400]]
track2d.overlay_sheet('IMG_1584', T0, N, Hs, pts, [0, 10, 20, 30, 40, 50, 65], '/home/user/brain/everywhere-claude/v4/check/ov1584s.jpg', w=220)
