# IMG_1605 phone: ground homography, the stranger's legs/coat masked out (top-centre-right), ref src 0.8
import sys; sys.path.insert(0, '/home/user/brain/everywhere-claude/v2/tools')
import plates, track2d, cv2, numpy as np
T0, N = 0.1, 36
REF = int(round((0.8 - T0) * 30))
fr = list(plates.frames('IMG_1605', T0, N, gray=True))
def mask(k, f):
    m = np.zeros_like(f); m[10:-10, 10:-10] = 255
    # legs region drifts down as the camera tilts up: be generous
    y1 = int(200 + (k / 35.0) * 650); m[0:y1, 600:900] = 0; return m
Hf, sf = track2d.track(fr[REF:], mask, model='homography', maxc=600, scale=0.5, ransac=1.5)
Hb, sb = track2d.track(fr[:REF + 1][::-1], mask, model='homography', maxc=600, scale=0.5, ransac=1.5)
Hs = [None] * N
for i, H in enumerate(Hb): Hs[REF - i] = H
for i, H in enumerate(Hf): Hs[REF + i] = H
print('fwd', [(round(s['err'], 2), s['inl']) for s in sf[::3]]); print('bwd', [(round(s['err'], 2), s['inl']) for s in sb[::3]])
track2d.save('/home/user/brain/everywhere-claude/v2/track/1605p.json', T0=T0, N=N, REF=REF, H=Hs)
pts = [[x, y] for x in range(100, 1000, 180) for y in range(300, 1800, 300)]
track2d.overlay_sheet('IMG_1605', T0, N, Hs, pts, [1, 7, 14, 21, 28, 35], '/tmp/claude-0/ov1605p.jpg', w=220)
