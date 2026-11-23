"""On-screen speed (1080p px/frame) of globe-surface points around frame centre, and of the globe centre."""
import sys, numpy as np, math
sys.path.insert(0, '.')
from pp.core import Camera, globe_matrix, NF, FPS, W, H
rng = np.random.default_rng(0)
la = np.radians(rng.uniform(-89, 89, 6000)); lo = rng.uniform(-np.pi, np.pi, 6000)
Pl = np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], 1)
sp, acc, gc = [], [], []
prev = None
for fi in range(NF):
    vs = []
    for dt in (0, 1):
        t = (fi + dt) / FPS
        cam = Camera(t, 1); G = globe_matrix(t)
        P = Pl @ G.T
        s, z = cam.project(P)
        vs.append((s, P @ cam.chat > 1 / cam.dc + 0.05))
    (s0, v0), (s1, v1) = vs
    m = v0 & v1 & (np.abs(s0[:, 0] - W / 2) < 500) & (np.abs(s0[:, 1] - H / 2) < 350)
    d = np.linalg.norm(s1 - s0, axis=1)[m]
    sp.append(np.median(d) if len(d) else 0)
    c0 = Camera(fi / FPS, 1).globe_disc()[0]; c1 = Camera((fi + 1) / FPS, 1).globe_disc()[0]
    gc.append(np.linalg.norm(c1 - c0))
sp = np.array(sp); gc = np.array(gc)
print('surface speed px/frame: median %.2f p95 %.2f max %.2f at t=%.1f' % (np.median(sp), np.percentile(sp, 95), sp.max(), sp.argmax() / FPS))
print('globe centre speed px/frame: median %.2f max %.2f at t=%.1f' % (np.median(gc), gc.max(), gc.argmax() / FPS))
a = np.abs(np.diff(sp, append=sp[:1]))
print('surface speed change per frame: max %.3f at t=%.1f' % (a.max(), a.argmax() / FPS))
for t0 in range(0, 60, 2):
    print('%2d-%2ds  speed %.1f  centre %.1f' % (t0, t0 + 2, sp[t0 * 30:(t0 + 2) * 30].max(), gc[t0 * 30:(t0 + 2) * 30].max()))
