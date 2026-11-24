# Independent track check: features picked on the anchored surface in the reference frame are followed with plain chained
# KLT (forward-backward checked, no motion model), and compared with where the shot's track (homography/similarity) puts
# them. Reports median / 90th-percentile residual (px, full res) over the frames each shot actually uses.
import sys, json, numpy as np, cv2
sys.path.insert(0, '/home/user/brain/everywhere-claude/v4/tools')
import plates, track2d

R = '/home/user/brain/everywhere-claude/v4/track'
# name, clip, json, film-used source index range (k0, k1), feature box in the ref frame (x0, y0, x1, y1)
import sys as _s
CASES = [
    ('roof (ridge homography)', 'IMG_1584', '1584.json', (3, 78), (0, 1600, 1080, 1900)),
    ('spruce (tree homography)', 'IMG_1584s', '1584s.json', (9, 54), (380, 480, 760, 1100)),
    ('log pile (similarity)', 'IMG_1596', '1596a.json', (9, 99), (250, 1300, 750, 1480)),
    ('manhole (ground homography)', 'IMG_1605', '1605m.json', (3, 48), (200, 1050, 900, 1500)),
    ('photo square (ground homography)', 'IMG_1605', '1605s.json', (3, 48), (250, 1000, 850, 1400)),
    ('bales (similarity)', 'IMG_1596', '1596b.json', (3, 63), (500, 1100, 1000, 1250)),
    ('shoes (ground homography)', 'IMG_1606', '1606.json', (3, 48), (100, 700, 600, 1100)),
    ('garland (similarity)', 'IMG_1623', '1623.json', (6, 96), (150, 120, 950, 470)),
    ('garland similarity band', 'IMG_1623', '1623.json', (6, 96), (150, 300, 950, 760)),
    ('summit (similarity)', 'IMG_1631', '1631.json', (9, 238), (300, 1000, 850, 1300)),
]


def run(case):
    name, clip, js, (k0, k1), box = case
    T = json.load(open(f'{R}/{js}')); H = [np.array(h) if h is not None else None for h in T['H']]
    ref = T.get('REF') if T.get('REF') is not None else 0
    clip = clip.replace('s', '') if clip.endswith('s') else clip
    fr = list(plates.frames(clip, T['T0'], T['N'], gray=True))
    g = fr[ref]; m = np.zeros_like(g); x0, y0, x1, y1 = box; m[y0:y1, x0:x1] = 255
    p_ref = cv2.goodFeaturesToTrack(g, 80, 0.01, 12, mask=m)
    if p_ref is None: return name, None
    p_ref = p_ref.reshape(-1, 2)
    res = {}
    for direction in (1, -1):
        pts = p_ref.copy(); alive = np.ones(len(pts), bool); k = ref
        while True:
            k2 = k + direction
            if k2 < min(k0, ref) or k2 > min(max(k1, ref), len(fr) - 1): break
            a, b = fr[k], fr[k2]
            p1, st, _ = cv2.calcOpticalFlowPyrLK(a, b, pts.reshape(-1, 1, 2).astype(np.float32), None, winSize=(31, 31), maxLevel=4)
            pb, st2, _ = cv2.calcOpticalFlowPyrLK(b, a, p1, None, winSize=(31, 31), maxLevel=4)
            ok = (st.ravel() == 1) & (st2.ravel() == 1) & (np.linalg.norm(pb.reshape(-1, 2) - pts, axis=1) < 0.5)
            alive &= ok; pts = p1.reshape(-1, 2); k = k2
            if alive.sum() < 6: break
            if k0 <= k <= k1:
                pred = track2d.apply(H[k], p_ref[alive])
                res[k] = np.linalg.norm(pred - pts[alive], axis=1)
    allr = np.concatenate(list(res.values())) if res else np.array([np.nan])
    worst = max(res.items(), key=lambda kv: np.median(kv[1]))[0] if res else None
    return name, dict(frames=len(res), median=float(np.median(allr)), p90=float(np.percentile(allr, 90)),
                      worst_frame=worst, worst_median=float(np.median(res[worst])) if worst is not None else None)


if __name__ == '__main__':
    out = {}
    sel = _s.argv[1:]
    for c in CASES:
        if sel and not any(x in c[0] for x in sel): continue
        n, r = run(c); out[n] = r; print(n, r, flush=True)
    json.dump(out, open('/home/user/brain/everywhere-claude/v4/check/track_residuals.json', 'w'), indent=1)
