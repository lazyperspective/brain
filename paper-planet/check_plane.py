import sys; sys.path.insert(0, '.')
import numpy as np
from pp import scene
from pp.core import Camera, globe_matrix, center_lon
from pp.travellers import plane_pos
sc = scene.Scene()
hits = []
for fi in range(0, 1800, 3):
    t = fi / 30
    cam = Camera(t, 1); G = globe_matrix(t)
    cards = sc.cards(t, G, cam)
    P = plane_pos(t)
    for c in cards:
        nm = c.layers[0][0].name
        if nm in ('plane_wing', 'dash', 'moon', 'thread', 'cloud'):
            continue
        n = np.cross(c.X, c.Y); n /= np.linalg.norm(n)
        d = P - c.O
        u, v, w = d @ c.X, d @ c.Y, d @ n
        if -0.11 < u < c.w + 0.11 and -0.03 < v < c.h + 0.03 and abs(w) < 0.06:
            # check sprite coverage roughly: only count if within the drawn sprite box of first layer
            hits.append((fi, nm, round(u / c.w, 2), round(v / c.h, 2), round(w, 3)))
print(len(hits), 'near-hits')
for h in hits[:60]: print(h)
