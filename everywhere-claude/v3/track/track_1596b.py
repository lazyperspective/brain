# IMG_1596 bales: similarity of the mid band (field/bales), reference src 9.6 s, both directions
import sys; sys.path.insert(0, '/home/user/brain/everywhere-claude/v3/tools')
import plates, track2d, cv2, numpy as np
T0, N = 8.5, 68
REF = int(round((9.6 - T0) * 30))
fr = list(plates.frames('IMG_1596', T0, N, gray=True))
def mask(k, f):
    m = np.zeros_like(f); m[700:1500, 20:-20] = 255; return m
Hf, sf = track2d.track(fr[REF:], mask, model='similarity', maxc=500, scale=0.5, win=41)
Hb, sb = track2d.track(fr[:REF + 1][::-1], mask, model='similarity', maxc=500, scale=0.5, win=41)
Hs = [None] * N
for i, H in enumerate(Hb): Hs[REF - i] = H
for i, H in enumerate(Hf): Hs[REF + i] = H
print('fwd err', [round(s['err'], 2) for s in sf[::5]], [s['inl'] for s in sf[::5]]); print('bwd err', [round(s['err'], 2) for s in sb[::5]], [s['inl'] for s in sb[::5]])
track2d.save('/home/user/brain/everywhere-claude/v3/track/1596b.json', T0=T0, N=N, REF=REF, H=Hs)
pts = [[279, 1174], [741, 1172], [787, 1174], [500, 1100], [700, 1100]]
track2d.overlay_sheet('IMG_1596', T0, N, Hs, pts, [5, 15, 25, 33, 40, 50, 60, 67], '/home/user/brain/everywhere-claude/v3/check/ov1596b.jpg', w=220, crop=(0, 800, 1080, 1500))
