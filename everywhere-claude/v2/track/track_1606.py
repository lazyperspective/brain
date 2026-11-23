# IMG_1606 shoes: ground-plane homography (asphalt, white line, tactile paving), excluding the user's jeans + shoes. Ref src 1.4 s
import sys; sys.path.insert(0, '/home/user/brain/everywhere-claude/v2/tools')
import plates, track2d, cv2, numpy as np
T0, N = 0.7, 54
REF = int(round((1.4 - T0) * 30))
fr = list(plates.frames('IMG_1606', T0, N, gray=True))
def mask(k, f):
    m = np.zeros_like(f); m[30:1120, 20:-20] = 255; m[1120:1880, 20:330] = 255; return m
Hf, sf = track2d.track(fr[REF:], mask, model='homography', maxc=700, scale=0.5, ransac=1.5)
Hb, sb = track2d.track(fr[:REF + 1][::-1], mask, model='homography', maxc=700, scale=0.5, ransac=1.5)
Hs = [None] * N
for i, H in enumerate(Hb): Hs[REF - i] = H
for i, H in enumerate(Hf): Hs[REF + i] = H
print('fwd', [(round(s['err'], 2), s['inl']) for s in sf[::5]]); print('bwd', [(round(s['err'], 2), s['inl']) for s in sb[::5]])
track2d.save('/home/user/brain/everywhere-claude/v2/track/1606.json', T0=T0, N=N, REF=REF, H=Hs)
pts = [[x, y] for x in range(120, 1000, 160) for y in range(300, 1300, 250)]
track2d.overlay_sheet('IMG_1606', T0, N, Hs, pts, [0, 6, 12, 21, 30, 40, 53], '/tmp/claude-0/ov1606.jpg', w=220)
