# Per-frame global camera motion from LK-tracked features -> similarity transform (dx, dy, zoom, rot) + sharpness.
import cv2, numpy as np, sys, json
src, out = sys.argv[1], sys.argv[2]
cap = cv2.VideoCapture(src); fps = cap.get(cv2.CAP_PROP_FPS)
prev = None; rows = []; i = 0
while True:
    ok, f = cap.read()
    if not ok: break
    g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY); sharp = cv2.Laplacian(g, cv2.CV_64F).var()
    r = dict(t=i / fps, dx=0, dy=0, s=1, rot=0, n=0, inl=0, sharp=sharp, lum=float(g.mean()))
    if prev is not None:
        p0 = cv2.goodFeaturesToTrack(prev, 600, 0.01, 8)
        if p0 is not None and len(p0) > 10:
            p1, st, _ = cv2.calcOpticalFlowPyrLK(prev, g, p0, None, winSize=(31, 31), maxLevel=4)
            m = st.ravel() == 1
            if m.sum() > 8:
                M, inl = cv2.estimateAffinePartial2D(p0[m], p1[m], method=cv2.RANSAC, ransacReprojThreshold=2.0)
                if M is not None:
                    s = float(np.hypot(M[0, 0], M[1, 0])); rot = float(np.degrees(np.arctan2(M[1, 0], M[0, 0])))
                    # translation of the frame centre
                    c = np.array([270, 480, 1.0]); cc = M @ c
                    r.update(dx=float(cc[0] - 270), dy=float(cc[1] - 480), s=s, rot=rot, n=int(m.sum()), inl=int(inl.sum()))
    rows.append(r); prev = g; i += 1
json.dump(rows, open(out, 'w'))
