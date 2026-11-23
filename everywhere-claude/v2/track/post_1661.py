# Clean up the 1661 track: lamp anchor, "our" wire (the one nearest the lamp = largest angle), far-pole top (wire convergence + KLT).
import sys; sys.path.insert(0, '/home/user/brain/everywhere-claude/v2/tools')
import plates, cv2, numpy as np, json, math
from scipy.ndimage import gaussian_filter1d
R = json.load(open('/home/user/brain/everywhere-claude/v2/track/1661_raw.json'))
T0, N = R['T0'], R['N']; H, W = 1920, 1080


def curve_pts(w, n=60):
    p0, u, nr, c = np.array(w['p0']), np.array(w['u']), np.array(w['n']), w['coef']
    s = np.linspace(w['smin'], w['smax'], n)
    off = c[0] + c[1] * s + c[2] * s * s
    return p0[None] + s[:, None] * u[None] + off[:, None] * nr[None]


def line_of(w, frac=0.5):
    """line (point, dir) fitted to the UPPER part of the wire (the lower part can run onto the A-frame legs)"""
    P = curve_pts(w, 80)
    if P[0, 1] > P[-1, 1]: P = P[::-1]          # P[0] = top end
    seg = P[:int(len(P) * frac)]
    c = seg.mean(0); U, S, Vt = np.linalg.svd(seg - c); d = Vt[0]
    return c, d


ours, conv = [], []
for k in range(N):
    ws = [w for w in R['wires'][k] if 60 < w['ang'] < 170 and w['npts'] >= 25]
    # exclude the lamp pole (angle ~72-80 in early frames, and it is short / near the lamp)
    if k < 75: ws = [w for w in ws if w['ang'] > 100]
    ws.sort(key=lambda w: -w['ang'])
    ours.append(ws[0] if ws else None)
    # convergence point of all near-vertical wires (k >= 120)
    if k >= 110 and len(ws) >= 2:
        A, b = [], []
        for w in ws:
            p, d = line_of(w); nrm = np.array([-d[1], d[0]]); A.append(nrm); b.append(nrm @ p)
        A, b = np.array(A), np.array(b)
        x = np.linalg.lstsq(A, b, rcond=None)[0]
        conv.append(x.tolist() if len(ws) >= 3 else x.tolist())
    else:
        conv.append(None)

# KLT on the far pole top region for late frames, seeded from the convergence point at k=200
frames = None
seedk = 244
SEED = [446.0, 1143.0]   # far-pole tip at k=232, read off a full-res crop
fr = list(plates.frames('IMG_1661', T0 + seedk / 30, N - seedk, gray=True))
# backwards too (to ~k=165)
back_k0 = 172
frb = list(plates.frames('IMG_1661', T0 + back_k0 / 30, seedk - back_k0 + 1, gray=True))


def klt_track(seq, start_pt, box=(60, 40, 60, 90)):
    g0 = seq[0]; mask = np.zeros_like(g0); x, y = map(int, start_pt)
    cv2.rectangle(mask, (x - box[0], y - box[1]), (x + box[2], y + box[3]), 255, -1)
    p = cv2.goodFeaturesToTrack(g0, 120, 0.003, 4, mask=mask)
    T = np.eye(3); out = [start_pt]; prev = g0
    for g in seq[1:]:
        p1, st, _ = cv2.calcOpticalFlowPyrLK(prev, g, p, None, winSize=(31, 31), maxLevel=3)
        pb, st2, _ = cv2.calcOpticalFlowPyrLK(g, prev, p1, None, winSize=(31, 31), maxLevel=3)
        ok = (st.ravel() == 1) & (st2.ravel() == 1) & (np.linalg.norm(pb - p, axis=2).ravel() < 0.7)
        ok &= (p1[:, 0, 1] > 5) & (p1[:, 0, 1] < 1915)
        if ok.sum() < 4: out.append(None); continue
        M, inl = cv2.estimateAffinePartial2D(p[ok], p1[ok], method=cv2.RANSAC, ransacReprojThreshold=0.8)
        T = np.vstack([M, [0, 0, 1]]) @ T
        q = T @ np.array([start_pt[0], start_pt[1], 1.0]); out.append(q[:2].tolist() + [int(inl.sum())])
        p = p1[ok][inl.ravel() == 1]; prev = g
    return out


fwd = klt_track(fr, SEED)
bwd = klt_track(frb[::-1], SEED)[::-1]      # k = back_k0 .. seedk
klt = [None] * N
for i, q in enumerate(bwd): klt[back_k0 + i] = q
for i, q in enumerate(fwd): klt[seedk + i] = q
for k in range(back_k0, N, 10):
    print(k, f'{T0 + k / 30:.2f}', 'klt', klt[k])

json.dump(dict(T0=T0, N=N, lamp=R['lamp'], lamp_init=R['lamp_init'], ours=ours, conv=conv, klt=klt),
          open('/home/user/brain/everywhere-claude/v2/track/1661.json', 'w'))
