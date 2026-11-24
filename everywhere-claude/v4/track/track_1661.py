# IMG_1661 tracking: lamp head (KLT similarity), wires (Hough + sub-pixel ridge refinement, quadratic curves),
# far-pole top = least-squares convergence of the wires. Source 0.4 -> 9.4 s (270 frames at 30 fps).
import sys; sys.path.insert(0, '/home/user/brain/everywhere-claude/v4/tools')
import plates, cv2, numpy as np, json, math

T0, N = 0.0, 282
frames = list(plates.frames('IMG_1661', T0, N, gray=True))
print('frames', len(frames))
H, W = frames[0].shape


def darkness(g):
    g = g.astype(np.float32)
    return cv2.GaussianBlur(g, (0, 0), 4) - cv2.GaussianBlur(g, (0, 0), 0.8)


# ---------------- lamp head ----------------
# initial box around the lamp head + upper pole in frame 0 (src 0.4): from the proxy survey, head ~ (690,1300) full res
g0 = frames[0]
d0 = darkness(g0)
# find the lamp head as the largest dark blob in the lower-middle region
m = (d0 > 12).astype(np.uint8)
ys, xs = np.nonzero(m[900:1700, 450:1000]); print('dark px', len(xs))
cx, cy = xs.mean() + 450, ys.mean() + 900
print('lamp blob centre approx', cx, cy)
lamp = []
mask = np.zeros_like(g0); cv2.rectangle(mask, (int(cx - 140), int(cy - 260)), (int(cx + 160), int(cy + 260)), 255, -1)
pts = cv2.goodFeaturesToTrack(g0, 300, 0.005, 5, mask=mask)
print('lamp features', len(pts))
T = np.eye(3)
lamp.append(T.copy())
prev = g0; p_prev = pts
for k in range(1, N):
    g = frames[k]
    if p_prev is None or len(p_prev) < 8:
        lamp.append(None); continue
    p1, st, err = cv2.calcOpticalFlowPyrLK(prev, g, p_prev, None, winSize=(41, 41), maxLevel=4,
                                         criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 40, 0.01))
    ok = (st.ravel() == 1)
    # back-check
    p0b, st2, _ = cv2.calcOpticalFlowPyrLK(g, prev, p1, None, winSize=(41, 41), maxLevel=4)
    fb = np.linalg.norm(p0b - p_prev, axis=2).ravel()
    ok &= (st2.ravel() == 1) & (fb < 0.6)
    inb = (p1[:, 0, 0] > 2) & (p1[:, 0, 0] < W - 2) & (p1[:, 0, 1] > 2) & (p1[:, 0, 1] < H - 2)
    ok &= inb
    if ok.sum() < 8:
        lamp.append(None); p_prev = None; continue
    M, inl = cv2.estimateAffinePartial2D(p_prev[ok], p1[ok], method=cv2.RANSAC, ransacReprojThreshold=1.0)
    M3 = np.vstack([M, [0, 0, 1]]); T = M3 @ T; lamp.append(T.copy())
    sel = np.nonzero(ok)[0][inl.ravel() == 1]
    p_prev = p1[sel]; prev = g
    if k % 10 == 0: print(f'lamp k{k} t{T0 + k / 30:.2f} feats {len(p_prev)}', np.round(T[:2, 2], 1))

# ---------------- wires ----------------
def refine_line(d, p0, p1, search=7, step=12):
    """sample along p0->p1 (full res), find ridge max along the normal, fit quadratic n(s). returns dict or None"""
    p0, p1 = np.array(p0, float), np.array(p1, float)
    L = np.linalg.norm(p1 - p0); u = (p1 - p0) / L; nrm = np.array([-u[1], u[0]])
    S, Nn = [], []
    for s in np.arange(0, L, step):
        c = p0 + u * s
        offs = np.arange(-search, search + 1)
        q = c[None, :] + offs[:, None] * nrm[None, :]
        if (q[:, 0] < 1).any() or (q[:, 0] > W - 2).any() or (q[:, 1] < 1).any() or (q[:, 1] > H - 2).any(): continue
        v = cv2.remap(d, q[:, 0:1].astype(np.float32), q[:, 1:2].astype(np.float32), cv2.INTER_LINEAR).ravel()
        i = int(np.argmax(v))
        if v[i] < 4 or i == 0 or i == len(v) - 1: continue
        a, b, cc = v[i - 1], v[i], v[i + 1]; den = a - 2 * b + cc
        sub = 0.5 * (a - cc) / den if abs(den) > 1e-6 else 0
        S.append(s); Nn.append(offs[i] + sub)
    if len(S) < 12: return None
    S, Nn = np.array(S), np.array(Nn)
    w = np.ones_like(S)
    for _ in range(5):
        A = np.stack([np.ones_like(S), S, S * S], 1)
        coef = np.linalg.lstsq(A * w[:, None], Nn * w, rcond=None)[0]
        r = Nn - A @ coef; sd = 1.4826 * np.median(np.abs(r)) + 0.05
        w = (np.abs(r) < 2.5 * sd).astype(float)
    return dict(p0=p0.tolist(), u=u.tolist(), n=nrm.tolist(), coef=coef.tolist(), smin=float(S[w > 0].min()), smax=float(S[w > 0].max()),
                rms=float(np.sqrt(np.mean(r[w > 0] ** 2))), npts=int(w.sum()))


wires = []
for k in range(N):
    g = frames[k]; d = darkness(g)
    small = cv2.resize(d, (W // 2, H // 2), interpolation=cv2.INTER_AREA)
    mm = (small > 4).astype(np.uint8) * 255
    Ls = cv2.HoughLinesP(mm, 1, np.pi / 720, 80, minLineLength=220, maxLineGap=20)
    cands = []
    if Ls is not None:
        for x1, y1, x2, y2 in Ls.reshape(-1, 4):
            ang = math.degrees(math.atan2(y2 - y1, x2 - x1)) % 180
            # normal form for de-dup (full res)
            th = math.radians(ang); nx, ny = -math.sin(th), math.cos(th); rho = (x1 * nx + y1 * ny) * 2
            cands.append((ang, rho, np.hypot(x2 - x1, y2 - y1), (x1 * 2, y1 * 2), (x2 * 2, y2 * 2)))
    cands.sort(key=lambda c: -c[2])
    keep = []
    for c in cands:
        if any(abs(c[0] - q[0]) < 2.0 and abs(c[1] - q[1]) < 14 for q in keep): continue
        keep.append(c)
    out = []
    for ang, rho, ln, a, b in keep[:8]:
        # extend the segment across the frame along its direction
        a, b = np.array(a, float), np.array(b, float); u = (b - a) / np.linalg.norm(b - a)
        ts = []
        for dim, lim in ((0, 0), (0, W - 1), (1, 0), (1, H - 1)):
            if abs(u[dim]) > 1e-6:
                t = (lim - a[dim]) / u[dim]; q = a + u * t
                if -1 <= q[0] <= W and -1 <= q[1] <= H: ts.append(t)
        if len(ts) < 2: continue
        P0, P1 = a + u * min(ts), a + u * max(ts)
        r = refine_line(d, P0, P1)
        if r is None or r['rms'] > 1.5: continue
        r['ang'] = ang; out.append(r)
    wires.append(out)
    if k % 15 == 0: print(f'wires k{k} t{T0 + k / 30:.2f}:', [(round(w['ang'], 1), w['npts'], round(w['rms'], 2)) for w in out])

json.dump(dict(T0=T0, N=N, lamp=[None if T is None else T.tolist() for T in lamp], lamp_init=[float(cx), float(cy)], wires=wires),
          open('/home/user/brain/everywhere-claude/v4/track/1661_raw.json', 'w'))
print('saved')
