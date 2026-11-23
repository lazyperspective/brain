# Planar KLT tracking: chained frame-to-frame homographies / similarities of a masked surface, with feature refresh,
# forward-backward checking and RANSAC. Returns H_k mapping frame-0 coords -> frame-k coords. Plus overlay verification.
import numpy as np, cv2, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
import plates


def track(frames, mask_fn, model='homography', maxc=500, quality=0.004, mind=7, win=31, fb=0.8, ransac=1.2, scale=1.0, verbose=False):
    """frames: list of gray uint8 (full res); mask_fn(k, frame) -> uint8 mask (255 = surface) in frame-k coords.
    scale: process at reduced resolution for speed (positions reported at full res)."""
    def S(g): return g if scale == 1.0 else cv2.resize(g, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    Hs = [np.eye(3)]; stats = [dict(n=0, inl=0, err=0)]
    prev = S(frames[0]); pts = None
    for k in range(1, len(frames)):
        g = S(frames[k])
        m = mask_fn(k - 1, frames[k - 1])
        if scale != 1.0: m = cv2.resize(m, (prev.shape[1], prev.shape[0]), interpolation=cv2.INTER_NEAREST)
        p0 = cv2.goodFeaturesToTrack(prev, maxc, quality, mind, mask=m, blockSize=7)
        if p0 is None or len(p0) < 8:
            Hs.append(Hs[-1].copy()); stats.append(dict(n=0, inl=0, err=-1)); prev = g; continue
        p1, st, _ = cv2.calcOpticalFlowPyrLK(prev, g, p0, None, winSize=(win, win), maxLevel=4,
                                             criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 40, 0.01))
        pb, st2, _ = cv2.calcOpticalFlowPyrLK(g, prev, p1, None, winSize=(win, win), maxLevel=4)
        ok = (st.ravel() == 1) & (st2.ravel() == 1) & (np.linalg.norm(pb - p0, axis=2).ravel() < fb)
        a, b = p0[ok].reshape(-1, 2) / scale, p1[ok].reshape(-1, 2) / scale
        if len(a) < 8:
            Hs.append(Hs[-1].copy()); stats.append(dict(n=int(len(a)), inl=0, err=-1)); prev = g; continue
        if model == 'homography':
            M, inl = cv2.findHomography(a, b, cv2.RANSAC, ransac)
        elif model == 'similarity':
            M2, inl = cv2.estimateAffinePartial2D(a, b, method=cv2.RANSAC, ransacReprojThreshold=ransac); M = np.vstack([M2, [0, 0, 1]])
        elif model == 'affine':
            M2, inl = cv2.estimateAffine2D(a, b, method=cv2.RANSAC, ransacReprojThreshold=ransac); M = np.vstack([M2, [0, 0, 1]])
        else:  # translation
            d = np.median(b - a, 0); M = np.array([[1, 0, d[0]], [0, 1, d[1]], [0, 0, 1.0]]); inl = (np.linalg.norm(b - a - d, axis=1) < ransac).astype(np.uint8)
        inl = inl.ravel().astype(bool)
        pr = cv2.perspectiveTransform(a[inl].reshape(-1, 1, 2), M).reshape(-1, 2)
        err = float(np.sqrt(np.mean(np.sum((pr - b[inl]) ** 2, 1)))) if inl.sum() else -1
        Hs.append(M @ Hs[-1]); stats.append(dict(n=int(len(a)), inl=int(inl.sum()), err=err))
        if verbose and k % 10 == 0: print(f'  k{k} feats {len(a)} inl {inl.sum()} err {err:.2f}')
        prev = g
    return Hs, stats


def apply(H, pts):
    pts = np.asarray(pts, float).reshape(-1, 1, 2)
    return cv2.perspectiveTransform(pts, np.asarray(H, float)).reshape(-1, 2)


def local_scale(H, p):
    """linear scale of H around point p (frame-0 coords)"""
    p = np.asarray(p, float); q = apply(H, [p, p + [10, 0], p + [0, 10]])
    a, b = q[1] - q[0], q[2] - q[0]
    return float(np.sqrt(abs(a[0] * b[1] - a[1] * b[0])) / 10)


def local_rot(H, p):
    p = np.asarray(p, float); q = apply(H, [p, p + [20, 0]]); d = q[1] - q[0]
    return float(np.degrees(np.arctan2(d[1], d[0])))


def overlay_sheet(clip, t0, n, Hs, grid_pts, idxs, out, extra=None, w=300, crop=None):
    """draw frame-0 grid points transformed into frame k on the plate -> visual check that the track sticks"""
    tiles = []
    gen = plates.frames(clip, t0, n)
    want = set(idxs)
    for k, f in enumerate(gen):
        if k not in want: continue
        im = f.copy()
        P = apply(Hs[k], grid_pts)
        for x, y in P:
            if 0 <= x < im.shape[1] and 0 <= y < im.shape[0]:
                cv2.drawMarker(im, (int(round(x)), int(round(y))), (0, 255, 255), cv2.MARKER_CROSS, 22, 3)
        if extra: extra(im, k)
        if crop: x0, y0, x1, y1 = crop; im = im[y0:y1, x0:x1]
        im = cv2.resize(im, (w, int(w * im.shape[0] / im.shape[1])), interpolation=cv2.INTER_AREA)
        cv2.putText(im, str(k), (5, 24), 0, 0.8, (0, 0, 0), 3); cv2.putText(im, str(k), (5, 24), 0, 0.8, (255, 255, 255), 1)
        tiles.append(im)
    cv2.imwrite(out, np.hstack(tiles), [cv2.IMWRITE_JPEG_QUALITY, 88])


def save(path, **kw):
    def conv(o):
        if isinstance(o, np.ndarray): return o.tolist()
        if isinstance(o, list): return [conv(x) for x in o]
        if isinstance(o, dict): return {k: conv(v) for k, v in o.items()}
        return o
    json.dump(conv(kw), open(path, 'w'))
