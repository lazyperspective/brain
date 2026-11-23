"""Card-card interpenetration among open pieces (no rendering): every 0.25 s, for each pair of opaque cards
whose boxes overlap, test whether an edge of one (inset to 80 % of the card) passes through the other's
inset rectangle. Interpenetrating cards have no correct paint order, so they can flicker in front/behind."""
import sys; sys.path.insert(0, '.')
import numpy as np
from pp import scene, core
from pp.core import Camera, globe_matrix
sc = scene.Scene()
SKIP = {'cloud', 'plane_wing', 'dash', 'moon', 'thread', 'glow', 'smoke', 'mist', 'strut', 'bird_w', 'bird_d', 'macaw_w', 'eagle_w',
        'drop', 'ring', 'spray', 'splash', 'spout'}
def quad(c, ins=0.1):
    a, b = ins, 1 - ins
    return [c.O + c.X * (c.w * u) + c.Y * (c.h * v) for u, v in ((a, a), (b, a), (b, b), (a, b))]
def seg_hits(p, q, c, ins=0.1):
    n = np.cross(c.X, c.Y)
    dp, dq = (p - c.O) @ n, (q - c.O) @ n
    if dp * dq > 0 or dp == dq:
        return False
    x = p + (q - p) * (dp / (dp - dq)) - c.O
    u, v = x @ c.X / c.w, x @ c.Y / c.h
    return ins < u < 1 - ins and ins < v < 1 - ins
hits = {}
step = float(sys.argv[1]) if len(sys.argv) > 1 else 0.25
for t in np.arange(0, core.DUR, step):
    cam = Camera(t, 1); G = globe_matrix(t)
    cards = [c for c in sc.cards(t, G, cam) if c.layers[0][0].name not in SKIP and not c.emis and c.alpha > 0.5]
    Q = [quad(c) for c in cards]
    lo = np.array([np.min(q, 0) for q in Q]); hi = np.array([np.max(q, 0) for q in Q])
    vis = [float(np.mean(q, 0) @ cam.chat) > cam.limb_k for q in Q]
    for i in range(len(cards)):
        for j in range(i + 1, len(cards)):
            if np.any(lo[i] > hi[j]) or np.any(lo[j] > hi[i]):
                continue
            a, b = cards[i], cards[j]
            na, nb = a.layers[0][0].name, b.layers[0][0].name
            if na == nb and na in ('pyr_face',):
                continue
            hit = any(seg_hits(Q[i][k], Q[i][(k + 1) % 4], b) for k in range(4)) or any(seg_hits(Q[j][k], Q[j][(k + 1) % 4], a) for k in range(4))
            if hit:
                key = tuple(sorted((na, nb)))
                hits.setdefault(key, []).append((round(float(t), 2), vis[i] or vis[j]))
print(len(hits), 'interpenetrating sprite pairs')
for k, v in sorted(hits.items(), key=lambda kv: -len(kv[1])):
    nv = [x for x, vv in v if vv]
    print('  %-30s %3d samples (%d on the near side)  e.g. %s' % (' x '.join(k), len(v), len(nv), nv[:6]))
