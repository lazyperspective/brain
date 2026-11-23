# IMG_1631 summit: full-frame similarity (pure zoom/rotation of distant mountains), reference src 6.0 s, both directions
import sys; sys.path.insert(0, '/home/user/brain/everywhere-claude/v2/tools')
import plates, track2d, cv2, numpy as np
T0, N = 0.7, 239
REF = int(round((6.0 - T0) * 30))
fr = list(plates.frames('IMG_1631', T0, N, gray=True))
# soft plate: boost local contrast for features
cl = cv2.createCLAHE(3.0, (8, 8)); fr = [cl.apply(f) for f in fr]
def mask(k, f):
    m = np.full_like(f, 255); m[:, :12] = 0; m[:, -12:] = 0; return m
Hf, sf = track2d.track(fr[REF:], mask, model='similarity', maxc=500, scale=0.5, quality=0.002, win=41)
Hb, sb = track2d.track(fr[:REF + 1][::-1], mask, model='similarity', maxc=500, scale=0.5, quality=0.002, win=41)
Hs = [None] * N
for i, H in enumerate(Hb): Hs[REF - i] = H
for i, H in enumerate(Hf): Hs[REF + i] = H
print('fwd', [(round(s['err'], 2), s['inl']) for s in sf[::10]]); print('bwd', [(round(s['err'], 2), s['inl']) for s in sb[::15]])
track2d.save('/home/user/brain/everywhere-claude/v2/track/1631.json', T0=T0, N=N, REF=REF, H=Hs)
pts = [[560, 1047], [400, 1090], [720, 1120], [150, 1060], [560, 1300]]
track2d.overlay_sheet('IMG_1631', T0, N, Hs, pts, [0, 20, 45, 70, 100, 130, 159, 200, 238], '/tmp/claude-0/ov1631.jpg', w=200)
