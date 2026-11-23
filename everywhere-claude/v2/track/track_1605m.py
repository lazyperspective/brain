# IMG_1605 manhole: ground-plane homography (paving + guide strip), reference src 3.6 s, both directions
import sys; sys.path.insert(0, '/home/user/brain/everywhere-claude/v2/tools')
import plates, track2d, cv2, numpy as np
T0, N = 3.1, 55
REF = int(round((3.6 - T0) * 30))
fr = list(plates.frames('IMG_1605', T0, N, gray=True))
def mask(k, f):
    m = np.zeros_like(f); m[1000:1900, 10:-10] = 255; return m
Hf, sf = track2d.track(fr[REF:], mask, model='homography', maxc=700, scale=0.5, ransac=1.5)
Hb, sb = track2d.track(fr[:REF + 1][::-1], mask, model='homography', maxc=700, scale=0.5, ransac=1.5)
Hs = [None] * N
for i, H in enumerate(Hb): Hs[REF - i] = H
for i, H in enumerate(Hf): Hs[REF + i] = H
print('fwd', [(round(s['err'], 2), s['inl']) for s in sf[::6]]); print('bwd', [(round(s['err'], 2), s['inl']) for s in sb[::4]])
track2d.save('/home/user/brain/everywhere-claude/v2/track/1605m.json', T0=T0, N=N, REF=REF, H=Hs)
th = np.linspace(0, 2 * np.pi, 24, endpoint=False)
pts = [[479 + 165 * np.cos(a), 1200 + 62 * np.sin(a)] for a in th] + [[479, 1200]]
track2d.overlay_sheet('IMG_1605', T0, N, Hs, pts, [0, 3, 9, 15, 25, 35, 45, 54], '/tmp/claude-0/ov1605m.jpg', w=220, crop=(0, 900, 1080, 1700))
