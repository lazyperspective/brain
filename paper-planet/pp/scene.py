"""The world's pop-up pieces, region by region, plus the always-alive travellers (ships, whales, clouds, moon, plane)."""
import math
import numpy as np
from . import sprites
from .core import center_lon, ll_frame, DUR, smooth
from .mech import Ctx, Flap, Tent, Pyramid, Zigzag, Bird, walker, sway, spin, nod, ping
from .render import place


class Scene:
    def __init__(self):
        self.S = sprites.build()
        self.pieces = []
        self.extras = []
        from . import regions, travellers
        regions.build(self)
        travellers.build(self)
        self._order_south_to_north()

    def _order_south_to_north(self):
        """Folded cards lie back away from the equator-side hinge, so within a region the piece nearer the
        camera's side must stand up first (and fold away last) or it would have to pass through its neighbour."""
        from .mech import Bird
        groups = {}
        for p in self.pieces:
            groups.setdefault(p.region, []).append(p)
        for reg, ps in groups.items():
            if reg == 'ocean':
                continue
            keys = sorted(set(round(-p.lat if getattr(p, 'hang', False) else p.lat, 1) for p in ps))
            n = max(1, len(keys) - 1)
            for p in ps:
                if isinstance(p, Bird):
                    p.order = 5
                    continue
                k = round(-p.lat if getattr(p, 'hang', False) else p.lat, 1)
                p.order = int(round(5.0 * keys.index(k) / n))

    # ---- helpers used by regions.py
    def flap(self, region, lat, lon, name, w, order=1, **kw):
        parts = kw.pop('parts', None)
        if parts:
            for p in parts:
                if isinstance(p['spr'], str):
                    p['spr'] = self.S[p['spr']]
        ep = kw.pop('emis_parts', None)
        if ep:
            for p in ep:
                if isinstance(p['spr'], str):
                    p['spr'] = self.S[p['spr']]
        f = Flap(lat, lon, self.S[name], w, order=order, region=region, parts=parts, emis_parts=ep, strut_spr=self.S['strut'], **kw)
        self.pieces.append(f)
        return f

    def tent(self, region, lat, lon, name, w, order=0, **kw):
        t = Tent(lat, lon, self.S[name], w, order=order, region=region, **kw)
        self.pieces.append(t)
        return t

    def pyramid(self, region, lat, lon, name, base, order=1, **kw):
        p = Pyramid(lat, lon, self.S[name], base, order=order, region=region, **kw)
        self.pieces.append(p)
        return p

    def zigzag(self, region, lat, lon, name, n, total_w, order=1, **kw):
        z = Zigzag(lat, lon, self.S[name], n, total_w, order=order, region=region, **kw)
        self.pieces.append(z)
        return z

    def bird(self, region, lat, lon, name, span, **kw):
        b = Bird(lat, lon, self.S[name], span, region=region, **kw)
        self.pieces.append(b)
        return b

    def walk(self, region, name, w, lat0, lon0, lat1, lon1, order=4, period=14.0, phase=0.0, hop=0.0, face=1, **kw):
        mv = walker(lat0, lon0, lat1, lon1, period=period, phase=phase, hop=hop, face=face)
        return self.flap(region, (lat0 + lat1) / 2, (lon0 + lon1) / 2, name, w, order=order, mover=mv, quiet=True, **kw)

    def cards(self, t, G, cam):
        ctx = Ctx(t, G, cam, center_lon(t))
        for p in self.pieces:
            p.emit(ctx)
        for e in self.extras:
            e(ctx)
        return ctx.out
