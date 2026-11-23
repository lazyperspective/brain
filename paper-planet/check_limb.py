"""Limb / surface occlusion check (no rendering): for sampled frames, every card that the renderer draws after
the sphere is sampled where its sprites are opaque; a sample counts as a violation if it is drawn (not clipped
at the limb plane) but lies inside the globe, i.e. paper that should be hidden by the globe would show."""
import sys; sys.path.insert(0, '.')
import numpy as np
from pp import scene, core
from pp.core import Camera, globe_matrix
sc = scene.Scene()
masks = {}
def mask(spr):
    if spr.name not in masks:
        masks[spr.name] = (spr.rgba[..., 3] > 90)
    return masks[spr.name]
g = (np.arange(16) + 0.5) / 16
GU, GV = np.meshgrid(g, g)
GU, GV = GU.ravel(), GV.ravel()
tot = bad = 0
worst = {}
step = int(sys.argv[1]) if len(sys.argv) > 1 else 10
for fi in range(0, 1800, step):
    t = fi / 30
    cam = Camera(t, 1); G = globe_matrix(t)
    for c in sc.cards(t, G, cam):
        if c.emis:
            continue
        P = c.O[None] + np.outer(GU * c.w, c.X) + np.outer(GV * c.h, c.Y)
        sd = P @ cam.chat - cam.limb_k
        if sd.max() < 0:
            continue                       # whole card drawn before the sphere: the opaque disc covers it
        # opaque where any layer's sprite is opaque
        op = np.zeros(len(P), bool)
        for L in c.layers:
            spr, A = L[0], L[1]
            M = np.array(A.get9()).reshape(3, 3)
            Mi = np.linalg.inv(M)
            xl, yl = GU * c.w, GV * c.h
            px = Mi[0, 0] * xl + Mi[0, 1] * yl + Mi[0, 2]
            py = Mi[1, 0] * xl + Mi[1, 1] * yl + Mi[1, 2]
            m = mask(spr)
            ok = (px >= 0) & (py >= 0) & (px < spr.pw) & (py < spr.ph)
            if len(L) > 3 and L[3] is not None:
                ok &= (px >= L[3][0]) & (px < L[3][1])
            idx = np.nonzero(ok)[0]
            op[idx] |= m[py[idx].astype(int), px[idx].astype(int)]
        if c.clip:
            op &= (GV * c.h >= 0) & (GU * c.w >= 0)
        drawn = op & (sd >= 0)
        r = np.linalg.norm(P, axis=1)
        v = drawn & (r < 0.997)
        tot += drawn.sum(); bad += v.sum()
        if v.any():
            nm = c.layers[0][0].name
            worst.setdefault(nm, []).append((fi, int(v.sum()), round(float(r[v].min()), 3)))
print('sampled opaque card points drawn over the globe: %d ; inside the globe: %d (%.4f%%)' % (tot, bad, 100.0 * bad / max(1, tot)))
for nm, l in sorted(worst.items(), key=lambda kv: -sum(x[1] for x in kv[1]))[:20]:
    print('  %-14s frames %d  points %d  deepest r=%.3f  e.g. %s' % (nm, len(l), sum(x[1] for x in l), min(x[2] for x in l), l[:4]))
