import sys; sys.path.insert(0, '.')
import numpy as np
from pp import scene
from pp.core import NF as scene_NF
from pp.core import Camera, globe_matrix
sc = scene.Scene()
hits = {}
for fi in range(0, scene_NF, 6):
    t = fi / 30
    cam = Camera(t, 1); G = globe_matrix(t)
    cards = sc.cards(t, G, cam)
    movers = [c for c in cards if c.layers[0][0].name in ('cloud', 'plane_wing', 'bird_w', 'bird_d', 'macaw_w', 'eagle_w')]
    solid = [c for c in cards if c.layers[0][0].name not in ('cloud', 'plane_wing', 'dash', 'moon', 'thread', 'bird_w', 'bird_d', 'macaw_w', 'eagle_w', 'glow', 'smoke', 'mist')]
    for m in movers:
        # sample points across the mover card
        pts = [m.O + m.X * (m.w * a) + m.Y * (m.h * b) for a in (0.1, 0.5, 0.9) for b in (0.2, 0.8)]
        for c in solid:
            n = np.cross(c.X, c.Y); n /= np.linalg.norm(n)
            ws = []
            ins = False
            for P in pts:
                d = P - c.O
                u, v, w = d @ c.X / c.w, d @ c.Y / c.h, d @ n
                ws.append(w)
                if 0.15 < u < 0.85 and 0.1 < v < 0.85:
                    ins = True
            if ins and min(ws) < 0 < max(ws):
                key = (m.layers[0][0].name, c.layers[0][0].name)
                hits.setdefault(key, []).append(fi)
for k, v in hits.items(): print(k, len(v), v[:12])
