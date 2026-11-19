"""Feel 6 - RUBBER HOSE.  An elastic cartoon: everything is made of rubber, and it all moves on the beat.

Build: each slab is dropped in on an eighth-note, stretched long as it falls, splats flat and jiggles like a
jelly; the buildings shoot up out of it far too tall, snap back and wobble; trees boing up with a wiggle;
people pop like corks.  Overshoot is the point - nothing arrives without going too far first.  Once a thing
has landed it keeps bouncing to the music: a little squash on every beat (72 BPM), like a 1930s cartoon.
Life: the balloon gathers itself into a huge squash, launches stretched and wobbles as it climbs.
Transition: anticipation (the camera backs off), a whip with smear frames, an overshoot and a springy settle.
"""
import math
import random

from .. import ease
from ..core import ZS
from . import base as B

ORDER = ['colosseum', 'greatwall', 'taj', 'rio', 'reef', 'halong', 'machu', 'fuji', 'chichen', 'everest', 'niagara', 'eiffel']
EXTRA = ['stonehenge', 'aurora', 'opera', 'uluru', 'moai', 'islet_a', 'islet_b', 'islet_c', 'islet_d', 'islet_e', 'sky_lo', 'sky_mid', 'sky_hi']
BEAT = 60.0 / 72.0
EIGHTH = BEAT / 2
WHIP = 9               # frames of whip
ANTIC = 9              # frames of anticipation before it


def jelly(x, amp=0.32, freq=3.2, damp=4.2):
    """squash/stretch oscillation after an impact at x=0: (sx, sy)"""
    if x <= 0:
        return 1.0, 1.0
    s = amp * math.exp(-damp * x) * math.cos(2 * math.pi * freq * x)
    return 1.0 + 0.75 * s, 1.0 - s


def beat_bounce(t, ph=0.0, amp=0.028):
    """a squash on every beat, quick recovery"""
    x = ((t - ph) / BEAT) % 1.0
    k = math.exp(-x * 9.0) * (1 - math.exp(-x * 60.0))
    return 1.0 + 0.6 * amp * k, 1.0 - amp * k


class Rubber(B.Prebuilt):
    name = 'rubber'
    title = 'Rubber hose'
    pitch = 'an elastic cartoon: huge squash and stretch, overshoot, and everything bounces on the beat'
    transition_frames = WHIP

    def plan(self):
        r = random.Random(4)
        self.balloon = B.find_balloon(self.w)
        tiles = self.w.tiles
        t = EIGHTH
        for name in ORDER:
            tiles[name].t_in = t
            t += EIGHTH * 0.75
        t += EIGHTH * 0.5
        for name in EXTRA:
            if name in tiles:
                tiles[name].t_in = t
                t += EIGHTH * 0.34
        tiles['pyramids'].t_in = -99.0
        for name, tile in tiles.items():
            if not hasattr(tile, 't_in'):
                tile.t_in = -99.0
            big = sorted([g for g in tile.pieces if g.role == 'struct'], key=lambda g: g.fx['base'][1])
            for k, g in enumerate(big):
                g.fx['t0'] = tile.t_in + 0.30 + 0.05 * k + r.uniform(0, 0.04)
                g.fx['kind'] = 'shoot'
            for g in tile.pieces:
                fx = g.fx
                fx['ph'] = r.uniform(0, 0.12)
                if g.role in ('board', 'keel'):
                    fx['t0'] = tile.t_in
                    fx['kind'] = 'tile'
                elif 'kind' not in fx:
                    fx['t0'] = tile.t_in + 0.55 + r.uniform(0, 0.5) + (0.15 if g.role == 'fig' else 0.0)
                    fx['kind'] = 'boing'

    def ready(self, name):
        t = self.w.tiles.get(name)
        return max(0.0, t.t_in + 0.5) if t is not None else None

    # ---- slabs: fall stretched, splat, jelly
    def tile_begin(self, c, tile, t, tl, tau, sky, R):
        if t < tile.t_in:
            return False
        R.nocull = t < 6.6
        x = t - tile.t_in
        if x < 2.0:
            F = 0.16
            bx, by = tile.center
            by += 45.0 if tile.kind == 'tile' else 10.0
            if x < F:
                u = x / F
                dy = -220.0 * (1 - u * u)
                sx, sy = 0.72, 1.45
            else:
                dy = 0.0
                sx, sy = jelly(x - F, 0.34, 2.6, 4.0)
                # the first frame of contact is a splat
                if x - F < 0.05:
                    sx, sy = 1.32, 0.62
            c.translate(bx, by + dy)
            c.scale(sx, sy)
            c.translate(-bx, -by)
        return None

    def arrive(self, g, tile, x, t, tl):
        fx = g.fx
        if g is self.balloon:
            return self._balloon(g, tl)
        kind = fx.get('kind')
        if tile.name == 'pyramids' or kind is None:
            return self._idle(g, tl)
        if kind == 'tile':
            return 'done'
        if x <= 0:
            return None
        bx, by = fx['base']
        if kind == 'shoot':
            # shoots up far too tall and thin, snaps back, wobbles
            if x < 0.11:
                u = x / 0.11
                sy = 1.55 * ease.out_cubic(u)
                sx = 0.62
                rot = 0.0
            else:
                y = x - 0.11
                sy = 1.0 + 0.55 * math.exp(-5.0 * y) * math.cos(2 * math.pi * 2.6 * y)
                sx = 1.0 - 0.38 * math.exp(-5.0 * y) * math.cos(2 * math.pi * 2.6 * y)
                rot = 7.0 * math.exp(-4.0 * y) * math.sin(2 * math.pi * 1.9 * y + fx['ph'] * 20)
                if y > 1.4:
                    return self._idle(g, tl)
            return (bx, by, 0.0, 0.0, rot, sx, max(0.01, sy), 0.0, None, 1.0)
        # boing: pop from nothing with a big overshoot and a wiggle
        if x > 1.3:
            return self._idle(g, tl)
        e = B.spring01(x, 2.4, 5.0)
        sx = max(0.0, e) ** 0.7
        sy = max(0.0, e) * (1 + 0.25 * math.exp(-6 * x) * math.sin(2 * math.pi * 3.3 * x))
        rot = 14.0 * math.exp(-5.0 * x) * math.sin(2 * math.pi * 2.8 * x)
        if sy < 0.01:
            return None
        return (bx, by, 0.0, 0.0, rot, sx, sy, 0.0, None, 1.0)

    def _idle(self, g, tl):
        if g.role in ('tree', 'struct') and g.fx is not None and 'base' in g.fx:
            bx, by = g.fx['base']
            sx, sy = beat_bounce(tl, g.fx.get('ph', 0.0), 0.035 if g.role == 'tree' else 0.018)
            return (bx, by, 0.0, 0.0, 0.0, sx, sy, 0.0, None, 1.0)
        return 'done'

    def _balloon(self, g, tl):
        ev = B.EVF / B.FPS
        x = tl - (ev - 1.75)
        px, py = g.pivot
        by = py + 10.0
        if x <= 0:
            return self._idle(g, tl)
        if x < 0.45:
            # gather: a long, slow squash (anticipation)
            k = ease.in_out(x / 0.45, 2.0)
            return (px, by, 0.0, 0.0, 0.0, 1 + 0.30 * k, 1 - 0.30 * k, 0.0, None, 1.0)
        y = x - 0.45
        if y < 0.12:
            # launch: snap to a stretch
            k = ease.out_cubic(y / 0.12)
            return (px, by, 0.0, -4.0 * k, 0.0, 1.30 - 0.52 * k, 0.70 + 0.70 * k, 0.0, None, 1.0)
        z = y - 0.12
        s = 0.40 * math.exp(-3.2 * z) * math.cos(2 * math.pi * 1.7 * z)
        rot = 6.0 * math.exp(-1.6 * z) * math.sin(2 * math.pi * 0.9 * z)
        return (px, by, 0.0, -4.0 * math.exp(-4 * z), rot, 1 - 0.55 * s, 1 + s, 0.0, None, 1.0)

    # ---- camera
    def cam(self, f):
        C = B.close_cam(max(f, B.CUT))
        if f >= B.CUT:
            x = (f - B.CUT) / B.FPS
            # overshoot the landing and spring back
            k = 0.10 * math.exp(-5.5 * x) * math.cos(2 * math.pi * 1.9 * x)
            rot = 0.0
            return (C[0] - 10.0 * k, C[1] + 6.0 * k, C[2] * (1 + 0.5 * k))
        t = f / B.FPS
        # the pull-back springs past the wide and settles
        x = t / 4.2
        e = B.spring01(x * 1.6, 0.55, 3.2) if x > 0 else 0.0
        Wd = B.lerp_cam(B.CAM0, B.WIDE, e)
        n1 = B.CUT - WHIP
        n0 = n1 - ANTIC
        if f > n0:
            W0 = B.lerp_cam(B.CAM0, B.WIDE, B.spring01(n0 / B.FPS / 4.2 * 1.6, 0.55, 3.2))
            if f <= n1:
                # anticipation: back off a touch, leaning away
                k = ease.in_out((f - n0) / ANTIC, 2.0)
                return (W0[0] - 6.0 * k, W0[1] + 4.0 * k, W0[2] * (1 - 0.07 * k))
            Wa = (W0[0] - 6.0, W0[1] + 4.0, W0[2] * 0.93)
            u = (f - n1) / WHIP
            return B.lerp_cam(Wa, C, ease.in_out(u, 4.0))
        return Wd

    def render(self, n):
        if B.CUT - WHIP < n < B.CUT:
            return self.blurred(n, shutter=1.5, subs=6, warps=5)
        return self.plain(n)
