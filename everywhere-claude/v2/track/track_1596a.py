# IMG_1596 log pile: full-frame similarity (telephoto ~ pure rotation + zoom), reference frame = src 4.4 s, tracked both ways
import sys; sys.path.insert(0, '/home/user/brain/everywhere-claude/v2/tools')
import plates, track2d, cv2, numpy as np
T0, N = 2.9, 87          # src 2.9 .. 5.8
REF = int(round((4.4 - T0) * 30))   # 45
fr = list(plates.frames('IMG_1596', T0, N, gray=True))
def mask(k, f):
    m = np.full_like(f, 255); m[:40] = 0; m[-40:] = 0; m[:, :30] = 0; m[:, -30:] = 0; return m
Hf, sf = track2d.track(fr[REF:], mask, model='similarity', maxc=600, scale=0.5)
Hb, sb = track2d.track(fr[:REF + 1][::-1], mask, model='similarity', maxc=600, scale=0.5)
Hs = [None] * N
for i, H in enumerate(Hb): Hs[REF - i] = H
for i, H in enumerate(Hf): Hs[REF + i] = H
print('fwd err', [round(s['err'], 2) for s in sf[::6]]); print('bwd err', [round(s['err'], 2) for s in sb[::6]], 'inl', [s['inl'] for s in sb[::6]])
track2d.save('/home/user/brain/everywhere-claude/v2/track/1596a.json', T0=T0, N=N, REF=REF, H=Hs)
pts = [[480, 1409], [200, 1407], [575, 1405], [330, 1380], [700, 1392], [250, 1300], [600, 1250]]
track2d.overlay_sheet('IMG_1596', T0, N, Hs, pts, [2, 8, 14, 22, 30, 45, 60, 75, 86], '/tmp/claude-0/ov1596a.jpg', w=200)
