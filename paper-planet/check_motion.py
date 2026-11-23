"""Camera motion check (no rendering): on-screen speed (1080p px/frame) of globe-surface points near frame
centre, its frame-to-frame change (judder), and overshoot of every camera channel past its keyed targets."""
import sys, numpy as np, math
sys.path.insert(0, '.')
from pp import core
from pp.core import Camera, globe_matrix, NF, FPS, W, H, STOPS, cam_keys
rng = np.random.default_rng(0)
la = np.radians(rng.uniform(-89, 89, 6000)); lo = rng.uniform(-np.pi, np.pi, 6000)
Pl = np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], 1)
sp, gc = [], []
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
    c0 = Camera(fi / FPS, 1).globe_disc(); c1 = Camera((fi + 1) / FPS, 1).globe_disc()
    gc.append(np.linalg.norm(c1[0] - c0[0]) + abs(c1[1] - c0[1]))
sp = np.array(sp); gc = np.array(gc)
np.save('tmp/speed.npy', sp)
print('surface speed px/frame: median %.2f p95 %.2f max %.2f at t=%.2f' % (np.median(sp), np.percentile(sp, 95), sp.max(), sp.argmax() / FPS))
print('globe centre+radius change px/frame: median %.2f max %.2f at t=%.2f' % (np.median(gc), gc.max(), gc.argmax() / FPS))
a = np.abs(np.diff(sp))
print('speed change per frame (acceleration): median %.3f p99 %.3f max %.3f at t=%.2f' % (np.median(a), np.percentile(a, 99), a.max(), a.argmax() / FPS))
j = np.abs(np.diff(sp, 2))
print('second difference of speed (judder): p99 %.3f max %.3f at t=%.2f' % (np.percentile(j, 99), j.max(), (j.argmax() + 1) / FPS))
# overshoot: within each move, each channel must stay between its start and end values (plus the zoom dip)
ts = np.arange(0, core.DUR, 1 / FPS)
ch = np.array([cam_keys(t) for t in ts])
names = core.CH_NAMES
worst = {}
moves = [(core.OPEN_END, STOPS[0][1])] + [(STOPS[i][2], STOPS[i + 1][1]) for i in range(len(STOPS) - 1)] + [(STOPS[-1][2], core.WIDE_IN)]
for (a0, a1) in moves:
    m = (ts >= a0 - 0.3) & (ts <= a1 + 0.3)
    for c, nm in enumerate(names):
        if nm == 'zoom':
            continue
        seg = ch[m, c]
        lo_, hi_ = min(seg[0], seg[-1]), max(seg[0], seg[-1])
        ov = max(seg.max() - hi_, lo_ - seg.min())
        worst[nm] = max(worst.get(nm, 0.0), ov)
print('largest excursion past a move\'s end values:', {k: round(v, 3) for k, v in worst.items()})
z = ch[:, 1]
print('zoom range %.3f .. %.3f' % (z.min(), z.max()))
for t0 in range(0, int(core.DUR), 3):
    k = slice(t0 * 30, (t0 + 3) * 30)
    print('%2d-%2ds  speed max %5.1f  accel max %.2f' % (t0, t0 + 3, sp[k].max(), a[k].max() if len(a[k]) else 0))
