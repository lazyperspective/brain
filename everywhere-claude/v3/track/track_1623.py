import sys; sys.path.insert(0, '/home/user/brain/everywhere-claude/v3/tools')
import plates, track2d, cv2, numpy as np
T0, N = 6.4, 108    # v3: src 6.4 .. 10.0
REF = int(round((7.7 - T0) * 30))
fr = list(plates.frames('IMG_1623', T0, N, gray=True))
def mask(k, f):   # facades + garland band, exclude the crowd (moving people) below y~1050
    m = np.zeros_like(f); m[20:1000, 20:-20] = 255; return m
Hf, sf = track2d.track(fr[REF:], mask, model='similarity', maxc=600, scale=0.5)
Hb, sb = track2d.track(fr[:REF + 1][::-1], mask, model='similarity', maxc=600, scale=0.5)
Hs = [None] * N
for i, H in enumerate(Hb): Hs[REF - i] = H
for i, H in enumerate(Hf): Hs[REF + i] = H
print('fwd', [(round(s['err'], 2), s['inl']) for s in sf[::5]]); print('bwd', [(round(s['err'], 2), s['inl']) for s in sb[::5]])
track2d.save('/home/user/brain/everywhere-claude/v3/track/1623.json', T0=T0, N=N, REF=REF, H=Hs)
pts = [[x, y] for x in range(150, 1000, 170) for y in range(450, 1000, 180)]
track2d.overlay_sheet('IMG_1623', T0, N, Hs, pts, [0, 8, 16, 24, 39, 50, 70, 90, 107], '/home/user/brain/everywhere-claude/v3/check/ov1623.jpg', w=200)
