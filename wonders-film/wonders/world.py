"""The world model: which wonder sits where, and the assembled, finalized map.

Layout (screen view).  Thirteen slabs on an isometric grid, forming a wide
"brick-bond" rectangle like a world map, plus five satellite islands that sit
in the notches of its edge:

        [stonehenge]        [aurora]
   NIAGARA        EIFFEL         EVEREST
          COLOSSEUM     GREAT WALL
   CHICHEN        PYRAMIDS       FUJI
          RIO           TAJ MAHAL
   MACHU PICCHU   REEF           HA LONG
 [moai]                 [uluru]      [opera]
"""
import numpy as np

from .core import Tile, W, PITCH, iso
from . import pal

LAYOUT = {
    # name: (i, j)
    'pyramids': (0, 0),
    'colosseum': (-1, 0), 'greatwall': (0, -1), 'taj': (1, 0), 'rio': (0, 1),
    'eiffel': (-1, -1), 'everest': (0, -2), 'fuji': (1, -1), 'halong': (2, 0),
    'reef': (1, 1), 'machu': (0, 2), 'chichen': (-1, 1), 'niagara': (-2, 0),
}
SATELLITES = {
    'stonehenge': (-2.02, -1.02), 'aurora': (-1.0, -2.04), 'moai': (-1.04, 2.0),
    'opera': (2.02, -1.02), 'uluru': (2.10, 1.08),
}
WORLD_CENTER = (0.0, 50.0)


class World:
    def __init__(self):
        self.tiles = {}
        self.order = []
        self.under = []

    def add(self, tile):
        self.tiles[tile.name] = tile

    def finalize(self):
        for t in self.tiles.values():
            t.finalize(WORLD_CENTER)
            t.ground_shapes = [s for s in t.shapes if not s.sky]
            t.sky_shapes = [s for s in t.shapes if s.sky]
            _placeholder(t)
        self.order = sorted(self.tiles.values(), key=lambda t: (t.i + t.j, t.i))
        return self

    def bounds(self):
        xs, ys = [], []
        for t in self.tiles.values():
            for s in t.shapes:
                xs += [s.bbox[0], s.bbox[2]]
                ys += [s.bbox[1], s.bbox[3]]
        return min(xs), min(ys), max(xs), max(ys)


def _placeholder(t):
    """The pencil promise of a tile: its footprint, ruled and ticked."""
    keep = t.shapes
    t.shapes = []
    t.cur_group = None
    if t.kind == 'tile':
        e = [[(0, 0), (1, 0)], [(1, 0), (1, 1)], [(1, 1), (0, 1)], [(0, 1), (0, 0)]]
        a = t.guide(e[1:3], ticks=10, over=0.06)
        b = t.guide(e[:1] + e[3:], over=0.06)
        c = t.guide([[(0, 0), (1, 1)], [(1, 0), (0, 1)]], over=0.0, w=0.3)
        d = t.guide([[(1, 1, 0), (1, 1, -0.11)], [(0, 1, 0), (0, 1, -0.11)], [(1, 0, 0), (1, 0, -0.11)]], over=0.2)
        shapes = [a, b, c, d]
        x = t.guide([[(0.44, 0.5), (0.56, 0.5)], [(0.5, 0.44), (0.5, 0.56)], t.ring(0.5, 0.5, 0.035, n=14)], over=0.0, w=0.36)
        x.stage = 'cross'
        shapes.append(x)
    else:
        cu, cv, ru, rv = getattr(t, 'foot', (0.5, 0.5, 0.3, 0.3))
        a = t.guide([t.ring(cu, cv, ru, rv=rv, n=36)])
        b = t.guide([[(cu - ru * 1.2, cv), (cu + ru * 1.2, cv)], [(cu, cv - rv * 1.2), (cu, cv + rv * 1.2)]], ticks=4, over=0.05)
        x = t.guide([[(cu - 0.05, cv), (cu + 0.05, cv)], [(cu, cv - 0.05), (cu, cv + 0.05)]], over=0.0, w=0.36)
        x.stage = 'cross'
        shapes = [a, b, x]
    for k, s in enumerate(shapes):
        s.tp = -1.0 + 0.07 * k       # rewritten by the timeline
        s.dp = 0.26
        s.te = 0.16 + 0.05 * k
        s.de = 0.3
    t.placeholder = shapes
    t.shapes = keep


def build_world(only=None):
    from . import tiles_a, tiles_b, tiles_c, tiles_d
    builders = {}
    for m in (tiles_a, tiles_b, tiles_c, tiles_d):
        builders.update(m.BUILDERS)
    w = World()
    for name, (i, j) in list(LAYOUT.items()) + list(SATELLITES.items()):
        if only and name not in only:
            continue
        if name not in builders:
            continue
        kind = 'tile' if name in LAYOUT else 'sat'
        t = Tile(name, i, j, kind, seed=sum(map(ord, name)))
        builders[name](t)
        w.add(t)
    return w.finalize()
