"""The world's pop-up pieces, region by region, plus the always-alive travellers (ships, whales, clouds, moon, plane)."""
import math
import numpy as np
from . import sprites
from .core import center_lon, ll_frame, DUR, smooth
from .mech import Ctx, Flap, Tent, Pyramid, Zigzag, Bird, walker, sway, spin, nod, ping
from .render import place


PX_PER_R = 1850.0     # sprite pixels per globe radius of on-globe width (the 4K buffer at a close-up)
HERO_GROW = 0.55      # extra scale for pieces at the centre of a close-up
HERO_RAD = 24.0       # deg: how far from the look point a piece still counts as part of the close-up


class Scene:
    def __init__(self):
        # pass 1 at nominal density to learn how large each sprite is drawn, pass 2 at the density it needs
        self.S = sprites.build()
        self._populate()
        need = {}
        for p in self.pieces:
            for name, w in p.sprite_widths() if hasattr(p, 'sprite_widths') else ():
                need[name] = max(need.get(name, 0.0), w * PX_PER_R)
        from .travellers import TRAVELLER_W
        for name, w in TRAVELLER_W.items():
            need[name] = max(need.get(name, 0.0), w * PX_PER_R)
        self.S = sprites.build(px=need)
        self._populate()

    def _populate(self):
        self.pieces = []
        self.extras = []
        from . import regions, travellers
        regions.build(self)
        travellers.build(self)
        self._order_south_to_north()
        self.assign_heroes()

    def assign_heroes(self):
        """Give each piece a hero moment: the close-up of its region (or the nearest close-up), then re-time
        its unfold to it, set its hinge so it faces the lens then, and grow it if it is at the centre of view."""
        from .core import HERO, Camera, globe_matrix, ll_frame, center_lon, cam_keys, wrap180
        from .mech import face_angle, DEG_PER_S
        keys = [(k[0], k[1]) for k in HERO]

        def tw(x):
            return (x + DUR / 2) % DUR - DUR / 2

        for p in self.pieces:
            t_c = ((center_lon(0.0) - p.lon) / DEG_PER_S) % DUR     # when the piece faces the camera
            reg = getattr(p, 'hero_region', None) or p.region
            mine = [k for k in keys if k[1] == reg and abs(tw(t_c - k[0])) <= 9.0]
            if p.region == 'ocean':
                mine = []
            if mine:
                Tk = mine[0][0]
                T = Tk + max(-2.5, min(2.5, tw(t_c - Tk)))
            else:
                T = t_c
            T = T % DUR
            p.hero_t = T
            p.d_hero = wrap180(p.lon - center_lon(T))
            cam = Camera(T, 1)
            G = globe_matrix(T)
            el, z, llat, ldlon, sx, sy = cam_keys(T)
            q, _, _ = ll_frame(llat, center_lon(T) + ldlon)
            r, _, _ = ll_frame(p.lat, p.lon)
            ang = math.degrees(math.acos(max(-1.0, min(1.0, float(q @ r)))))
            p.hero_w = math.exp(-(ang / HERO_RAD) ** 2) if mine else 0.0
            fa = face_angle(cam, G, p.lat, p.lon)
            p.face = fa
            if hasattr(p, 'stand') and not getattr(p, 'stand_fixed', True):
                p.stand = float(min(86.0, max(52.0, fa + 42.0)))
                if isinstance(p, Tent):
                    p.stand = float(min(80.0, max(44.0, fa + 34.0)))
            # small things grow most (people, animals), big set pieces only a little
            small = min(1.0, max(0.0, (0.32 - p.size) / 0.22))
            k = 1.0 + p.hero_w * (0.22 + (HERO_GROW - 0.22 + 0.15) * small)
            if k > 1.01:
                p.grow(k)

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
