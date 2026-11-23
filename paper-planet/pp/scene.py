"""The world's pop-up pieces, region by region, plus the always-alive travellers (ships, whales, clouds, moon, plane)."""
import math
import numpy as np
from . import sprites
from .core import center_lon, ll_frame, DUR, smooth
from .mech import Ctx, Flap, Tent, Pyramid, Zigzag, Bird, walker, sway, spin, nod, ping
from .render import place


PX_PER_R = 2350.0     # sprite pixels per globe radius of on-globe width (the 4K buffer at a close-up)
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
        self._order_south_to_north()
        self.assign_heroes()
        travellers.build(self)      # after the heroes: clouds need the pieces' final sizes

    # ------------------------------------------------------------------ the story's bloom schedule
    def _stop_index(self):
        from .core import STOPS
        return {s[0]: k for k, s in enumerate(STOPS)}

    def stop_for(self, lat, lon, region=None, own=55.0, near=38.0):
        """Which stop opens a piece at lat/lon: its own region's stop if the camera frames it there, else the
        nearest stop whose close-up frames it, else None (it opens in the final wave)."""
        from .core import STOPS, ll_frame
        r = ll_frame(lat, lon)[0]
        best, bd = None, 1e9
        for s in STOPS:
            q = ll_frame(s[5], s[6])[0]
            d = math.degrees(math.acos(max(-1.0, min(1.0, float(q @ r)))))
            if region == s[0] and d < own:
                return s[0], d
            if region is None and d < near and d < bd:
                best, bd = s[0], d
        return best, bd

    def wave_time(self, lat, lon):
        """Final-wave bloom time: a ripple spreading from the middle of the final wide view."""
        from .core import FINAL_WAVE, ll_frame
        c = ll_frame(*self.WAVE_C)[0]
        r = ll_frame(lat, lon)[0]
        d = math.degrees(math.acos(max(-1.0, min(1.0, float(c @ r)))))
        return FINAL_WAVE[0] + FINAL_WAVE[1] * (d / 180.0) ** 0.8, d

    WAVE_C = (8.0, 24.0)       # the point of the globe that faces the lens as the camera settles on the final wide

    def gate(self, lat, lon, region=None):
        """Bloom time for a traveller (ship, whale pod) near lat/lon."""
        from .core import STOP
        st, _ = self.stop_for(lat, lon, region, near=34.0)
        if st is not None:
            return STOP[st][1] - 0.4
        return self.wave_time(lat, lon)[0]

    def _crowded(self, p):
        """Would turning this card about its own axis sweep it through a neighbour?"""
        r = ll_frame(p.lat, p.lon)[0]
        for q in self.pieces:
            if q is p or isinstance(q, Bird):
                continue
            if isinstance(q, Flap) and q.mover is None and not q.hang:
                continue        # it turns with its neighbours, staying nearly parallel
            d = math.acos(max(-1.0, min(1.0, float(r @ ll_frame(q.lat, q.lon)[0]))))
            if d < 0.5 * p.size * 0.85 + 0.22 * q.size:
                return True
        return False

    def assign_heroes(self):
        """Each piece blooms when the camera lands on its place (or in the final wave), staged for that camera:
        its hinge set to face the lens, and grown if it is at the centre of the close-up. In the finale every
        piece on the near side settles to a crown angle for the wide shot."""
        from .core import STOPS, STOP, Camera, globe_matrix, ll_frame, stop_face_time, WIDE_IN, BEAT, cam_keys, FINAL_WAVE
        from .mech import face_angle, face_yaw, Bird, Flap, NEVER
        sidx = self._stop_index()
        tempo = [1.0, 1.0, 1.0, 0.95, 0.95, 0.88, 0.88, 0.76, 0.74, 0.72]
        step = [BEAT / 2] * 5 + [BEAT / 3] * 5
        Tc = WIDE_IN + 2.0                                  # the finale camera the crown is staged for
        camc, Gc = Camera(Tc, 1), globe_matrix(Tc)
        cams = {}
        for p in self.pieces:
            reg = getattr(p, 'hero_region', None) or p.region
            st, dist = self.stop_for(p.lat, p.lon, None if reg == 'ocean' else reg)
            r, _, _ = ll_frame(p.lat, p.lon)
            stand_set = hasattr(p, 'stand') and not getattr(p, 'stand_fixed', True)
            if st is not None:
                k = sidx[st]
                s = STOP[st]
                p.stop = st
                p.tempo = tempo[k]
                lock = s[1] + 0.12 + step[k] * p.order
                p.t_open = lock - 0.46 * p.din()
                T = stop_face_time(st)
                if T not in cams:
                    cams[T] = (Camera(T, 1), globe_matrix(T))
                cam, G = cams[T]
                q, _, _ = ll_frame(s[5], s[6])
                ang = math.degrees(math.acos(max(-1.0, min(1.0, float(q @ r)))))
                p.hero_w = math.exp(-(ang / HERO_RAD) ** 2) if reg in (st, 'ocean') or reg == p.region else 0.0
                fa = face_angle(cam, G, p.lat, p.lon, getattr(p, 'yaw', 0.0))
                p.face = fa
                p.t_shrink = s[2]
                if stand_set:
                    p.stand = float(min(86.0, max(52.0, fa + 42.0)))
            else:
                p.stop = None
                p.tempo = 0.85
                tw, d = self.wave_time(p.lat, p.lon)
                p.t_open = tw + 0.07 * p.order
                p.hero_w = 0.55 * math.exp(-(d / 34.0) ** 2) * (1.0 - smooth((p.size - 0.16) / 0.10))
            # the crown: pieces on the near side of the final wide shot turn to face the lens and stand up
            v = Gc @ r
            near_side = float(v @ camc.chat) > 1.0 / camc.dc - 0.35
            if p.stop is not None and p.lat < -30.0 and float(v @ camc.chat) < 1.0 / camc.dc and p.size / p.gk > 0.35:
                near_side = False          # a big set piece behind the limb stays small: it only peeks over the rim
            yaw0 = getattr(p, 'yaw', 0.0)
            dyaw = 0.0
            if near_side and isinstance(p, Flap) and p.mover is None and not p.hang and not self._crowded(p):
                fy, sa = face_yaw(camc, Gc, p.lat, p.lon)
                d = (fy - yaw0 + 180.0) % 360.0 - 180.0
                if abs(d) <= 100.0:
                    dyaw = d * smooth((sa - 0.35) / 0.35)
            if stand_set and near_side:
                fc = face_angle(camc, Gc, p.lat, p.lon, yaw0 + dyaw)
                crown = float(min(86.0, max(40.0, fc + 30.0)))
                tc = self.wave_time(p.lat, p.lon)[0] - 0.3
                if p.stop is None:
                    p.stand = crown
                    if isinstance(p, Flap):
                        p.yaw = yaw0 + dyaw
                else:
                    p.stand_crown = crown
                    p.dyaw_crown = dyaw
                    p.t_crown = tc
            elif p.stop is not None and near_side:
                p.t_crown = self.wave_time(p.lat, p.lon)[0] - 0.3      # restore its size for the wide shot
            # small things grow most (people, animals), big set pieces only a little
            small = min(1.0, max(0.0, (0.32 - p.size) / 0.22))
            kk = 1.0 + p.hero_w * (0.22 + (HERO_GROW - 0.22 + 0.15) * small)
            base = p.size
            if kk > 1.01:
                p.grow(kk)
                p.gk = kk
            # passing through other close-ups, the piece is back at its own size; very big set pieces a bit smaller
            p.s_post = (1.0 - 0.45 * smooth((base - 0.30) / 0.30)) / p.gk

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
