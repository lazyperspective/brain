"""anim-lab: the Feel base class, the piece decomposition every feel shares, and the clip's clock + camera.

A *feel* re-times and re-moves the existing world without redrawing it.  It gets these hooks from the
renderer (wonders/render.py):

    tile_tau(tile, t, tau)                 -> the tile's local clock (60+t = "finished", the feel moves pieces itself)
    tile_begin(c, tile, t, tl, tau, sky, R) -> canvas transform for a whole slab; False = don't draw it
    gstate(g, tile, tau, t, tl)            -> a group's (dx, dy, rot, sx, sy, alpha, wipe[, pre]) - pre is an
                                              outer arrival transform (px, py, dx, dy, rot, sx, sy, kx[, clip])
    overlay(c, t, tl, R)                   -> extra marks in map space (dust, rings, nozzle, hand shadow ...)
    pre_paper(img, t, cam, R)              -> image-space pass before the paper grain (line boil ...)

and from the clip driver (film.py clip):  clocks(f) -> (build clock, life clock), cam(f), render(n).

The comparison clip:  frames 0..CUT build + hold + transition, landing on the Pyramids close-up exactly
at CUT (7.5 s); the balloon lifts off around CUT+50 (beat 3 of that bar, as in the film); END = CUT+100.
"""
import math

import numpy as np
import skia

from .. import ease
from .. import timeline as TL
from ..core import Group

FPS = 30
CUT = TL.CUTS[0]                 # 225: the frame the Pyramids close-up is reached
END = CUT + 100                  # 325 frames = 10.83 s
EVF = CUT + TL.EV_FRAME          # the balloon's signature moment
AUDIO_OFFSET = 10.0 - CUT / FPS  # soundtrack slice start: the film's own cut into the Pyramids lands on our cut
CAM0 = TL.CAM0
WIDE = TL.WIDE

# the order the film builds in (the outward spiral)
SPIRAL = [k for k, _ in sorted(TL.STARTS.items(), key=lambda kv: kv[1]) if k != 'pyramids']


def close_cam(f):
    """the Pyramids close-up, breathing in slowly (the film's _hold_cam, stretched over the clip's last bar)"""
    return TL._hold_cam(0, ease.smooth((f - CUT) / 100.0))


def lerp_cam(a, b, e):
    """position linear, zoom in log space"""
    return (a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, math.exp(math.log(a[2]) + (math.log(b[2]) - math.log(a[2])) * e))


def quint(x):
    return TL._quint(x)


def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def damped(x, freq, damp):
    """0 at x=0, decaying oscillation: sin * exp - for wobble / shake (x in seconds)"""
    if x <= 0:
        return 0.0
    return math.exp(-damp * x) * math.sin(2 * math.pi * freq * x)


def spring01(x, freq=1.6, damp=4.0):
    """0 -> 1 with overshoot (x in seconds), exact 0 slope at start"""
    if x <= 0:
        return 0.0
    return 1.0 - math.exp(-damp * x) * (math.cos(2 * math.pi * freq * x) + damp / (2 * math.pi * freq) * math.sin(2 * math.pi * freq * x))


# ------------------------------------------------------------------ pieces ----
def _ov(a, b, m=0.0):
    return not (a[2] + m < b[0] or b[2] + m < a[0] or a[3] + m < b[1] or b[3] + m < a[1])


def make_pieces(world, struct_merge=1.0):
    """Give every drawable shape a piece (a Group) so a feel can move it:
         board  - the slab and everything printed on its ground (strata, keel, terrain, water, tufts)
         struct - each cluster of loose architecture (union of overlapping 'struct' shapes, + their detail)
         fig    - each person (a custom-drawn figure)
         misc   - other loose life / sky marks
       Existing groups keep their arrival kind and get a role from their stage: struct / tree / life / sky / fx."""
    for tile in world.tiles.values():
        tile.pieces = []
        keel = Group(None, None, 0.3, tuple(tile.center), stage='slab')
        keel.role = 'keel'
        for s in getattr(tile, 'keel', []):
            s.group = keel
        for g in getattr(tile, 'keel_groups', []):
            g.role = 'keel'
        loose = [s for s in tile.shapes if s.group is None and s.layer != 'pencil']
        board = Group(None, None, 0.3, tuple(tile.center), stage='slab')
        board.role = 'board'
        structs = [s for s in loose if s.stage == 'struct' and s.draw is None]
        # union-find of overlapping architecture
        par = list(range(len(structs)))

        def find(i):
            while par[i] != i:
                par[i] = par[par[i]]
                i = par[i]
            return i
        for i in range(len(structs)):
            for j in range(i):
                if _ov(structs[i].bbox, structs[j].bbox, struct_merge):
                    par[find(i)] = find(j)
        clusters = {}
        for i, s in enumerate(structs):
            clusters.setdefault(find(i), []).append(s)
        groups = []
        for k, members in clusters.items():
            g = Group(None, None, 0.3, (0, 0), stage='struct')
            g.role = 'struct'
            for s in members:
                s.group = g
            bb = (min(s.bbox[0] for s in members), min(s.bbox[1] for s in members),
                  max(s.bbox[2] for s in members), max(s.bbox[3] for s in members))
            g.bbox = bb
            groups.append(g)
        for s in loose:
            if s.group is not None:
                continue
            if s.draw is not None and type(getattr(s.draw, '__self__', None)).__name__ == 'Fig':
                fig = s.draw.__self__
                g = Group(None, None, 0.3, (float(fig.P[0]), float(fig.P[1])), stage='life')
                g.role = 'fig'
                g.bbox = s.bbox
                s.group = g
                tile.pieces.append(g)
                continue
            if s.stage == 'detail' and s.draw is None and groups:
                # architectural detail joins the building it sits on
                cx, cy = s.cx, s.cy
                best, bd = None, 1e9
                for g in groups:
                    b = g.bbox
                    if b[0] - 1 <= cx <= b[2] + 1 and b[1] - 1 <= cy <= b[3] + 1:
                        a = (b[2] - b[0]) * (b[3] - b[1])
                        if a < bd:
                            best, bd = g, a
                if best is not None:
                    s.group = best
                    continue
            if s.stage in ('life', 'sky', 'flora') or s.sky:
                g = Group(None, None, 0.3, (s.cx, s.cy), stage=s.stage)
                g.role = 'misc'
                g.bbox = s.bbox
                s.group = g
                tile.pieces.append(g)
                continue
            s.group = board
        for g in groups:
            xs = [s for s in tile.shapes if s.group is g]
            g.bbox = (min(s.bbox[0] for s in xs), min(s.bbox[1] for s in xs), max(s.bbox[2] for s in xs), max(s.bbox[3] for s in xs))
            g.pivot = ((g.bbox[0] + g.bbox[2]) / 2, g.bbox[3])
        bs = [s for s in tile.shapes if s.group is board]
        if bs:
            board.bbox = (min(s.bbox[0] for s in bs), min(s.bbox[1] for s in bs), max(s.bbox[2] for s in bs), max(s.bbox[3] for s in bs))
        tile.board = board
        ks = [s for s in tile.shapes if s.group is keel]
        if ks:
            keel.bbox = (min(s.bbox[0] for s in ks), min(s.bbox[1] for s in ks), max(s.bbox[2] for s in ks), max(s.bbox[3] for s in ks))
            groups.insert(0, keel)
        tile.keel_piece = keel if ks else None
        for g in tile.groups:
            if g.role is None:
                if g.kind == 'halo' or g in tile.finale or g in tile.finale2:
                    g.role = 'fx'
                elif g.stage in ('struct', 'detail', 'slab', 'ground'):
                    g.role = 'struct'
                elif g.stage == 'flora':
                    g.role = 'tree'
                elif g.stage == 'sky':
                    g.role = 'sky'
                else:
                    g.role = 'life'
            if g.bbox is None:
                xs = [s for s in tile.shapes if s.group is g]
                if xs:
                    g.bbox = (min(s.bbox[0] for s in xs), min(s.bbox[1] for s in xs), max(s.bbox[2] for s in xs), max(s.bbox[3] for s in xs))
        tile.pieces = [board] + groups + tile.pieces + [g for g in tile.groups if g.role != 'fx']
        # every group now drawn by a piece also needs a base point (ground contact) for hinges / squash
        for g in tile.pieces:
            b = g.bbox if g.bbox is not None else (g.pivot[0], g.pivot[1], g.pivot[0], g.pivot[1])
            g.fx = {'base': ((b[0] + b[2]) / 2.0, b[3]), 'top': ((b[0] + b[2]) / 2.0, b[1]), 'h': b[3] - b[1], 'w': b[2] - b[0]}
        tile.groups = tile.groups + [g for g in tile.pieces if g not in tile.groups]


def build_cam(t, dur=5.6, p=3.0, soft=0.25):
    """the shared framing: from the Pyramids (CAM0) out to the whole map (WIDE), easing out over `dur` s"""
    x = clamp((t + soft * (math.exp(-max(0.0, t) / soft) - 1.0)) / dur)
    e = 1.0 - (1.0 - x) ** p
    return lerp_cam(CAM0, WIDE, e)


def find_balloon(world):
    """the Pyramids' signature event: the balloon that lifts off (its motion function is detail.py's `lift`)"""
    for g in world.tiles['pyramids'].groups:
        if g.motion is not None and getattr(g.motion, '__name__', '') == 'lift':
            return g
    return None


def tile_dist(tile, origin=(0.0, 50.0), sq=1.7):
    c = tile.center
    return math.hypot(c[0] - origin[0], (c[1] - origin[1]) * sq)


def shadow(c, R, x, y, rx, ry, a):
    """a soft contact shadow (map space)"""
    if a <= 0.003:
        return
    p = skia.Paint(AntiAlias=True, Color=skia.ColorSetARGB(int(255 * min(1.0, a)), 60, 48, 36),
                   MaskFilter=skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, max(0.6, ry * 0.45)))
    c.drawOval(skia.Rect.MakeLTRB(x - rx, y - ry, x + rx, y + ry), p)


# -------------------------------------------------------------------- feel ----
class Feel:
    name = 'current'
    title = 'Current'
    pitch = 'the film as it is today'
    transition_frames = TL.MOVE

    def __init__(self, world):
        self.w = world
        self.R = None        # supersampled renderer
        self.RB = None       # 1x renderer for blur sub-frames
        self.setup()
        from .. import detail
        detail.ON['fn'] = self._on

    def ready(self, name):
        """when slab `name` stands complete in this feel (None = the film's own timing)"""
        return None

    def _on(self, a, b, dt):
        ra, rb = self.ready(a), self.ready(b)
        if ra is None or rb is None:
            return None
        return max(ra, rb) + 0.35 * dt

    def setup(self):
        pass

    # ---- clocks & camera
    def clocks(self, f):
        return f / FPS, f / FPS

    def cam(self, f):
        if f >= CUT:
            return close_cam(f)
        return TL.camera_at(f)

    def in_flight(self, f):
        return CUT - self.transition_frames < f < CUT

    # ---- render hooks
    def tile_tau(self, tile, t, tau):
        return tau

    def tile_order(self, t, order):
        return None

    def tile_begin(self, c, tile, t, tl, tau, sky, R):
        return None

    def tile_end(self, c, tile, t, tl, tau, sky, R):
        pass

    def gstate(self, g, tile, tau, t, tl):
        return g.state(tau, tl)

    def overlay(self, c, t, tl, R):
        pass

    def pre_paper(self, img, t, cam, R):
        return img

    # ---- frames
    def plain(self, f, cam=None, R=None, paper=True):
        R = R or self.R
        t, tl = self.clocks(f)
        return R.frame(t, cam if cam is not None else self.cam(f), tl, paper=paper)

    def render(self, n):
        if self.in_flight(n):
            return self.blurred(n)
        return self.plain(n)

    def blurred(self, n, shutter=0.62, subs=5, warps=4, cam_fn=None):
        """the film's motion blur: sub-frame renders, each re-projected along the camera's travel"""
        import cv2
        cam_fn = cam_fn or self.cam
        w, h = self.R.size
        acc = np.zeros((h, w, 3), np.float32)
        step = shutter / subs
        for j in range(subs):
            f = n + (j + 0.5) * step - shutter / 2
            cj = cam_fn(f)
            t, tl = self.clocks(f)
            img = self.RB.frame(t, cj, tl)
            for m in range(warps):
                fm = f + ((m + 0.5) / warps - 0.5) * step
                cm = cam_fn(fm)
                sc = cm[2] / cj[2]
                M = np.array([[sc, 0, w / 2 * (1 - sc) + (cj[0] - cm[0]) * cm[2]], [0, sc, h / 2 * (1 - sc) + (cj[1] - cm[1]) * cm[2]]], np.float32)
                acc += cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        img = np.clip(acc / (subs * warps) + 0.5, 0, 255).astype(np.uint8)
        cam = cam_fn(n)
        self.R.set_grain(cam[2])
        return np.ascontiguousarray(self.R.paper.apply(img, cam, (w, h)))


class Prebuilt(Feel):
    """Base for feels where pieces arrive finished (printed, cut out, toy): every tile renders complete
    (tau = 60 + t) and the feel moves whole pieces.  arrive(g, tile, x, t, tl) -> pre-transform tuple,
    None (hidden) or 'done'."""
    def setup(self):
        make_pieces(self.w)
        for tile in self.w.tiles.values():
            tile.placeholder = []
            tile.t_in = 0.0
            for g in tile.pieces:
                g.fx['t0'] = -99.0
        self.plan()

    def plan(self):
        pass

    def tile_tau(self, tile, t, tau):
        return 60.0 + t

    def gstate(self, g, tile, tau, t, tl):
        base = g.state(tau, tl)
        if base is None:
            return None
        fx = g.fx
        if not fx or 't0' not in fx:
            return base
        pre = self.arrive(g, tile, t - fx['t0'], t, tl)
        if pre is None:
            return None
        if pre == 'done':
            return base
        a = pre[9] if len(pre) > 9 else 1.0
        if a <= 0.003:
            return None
        return (base[0], base[1], base[2], base[3], base[4], base[5] * a, base[6], pre)

    def arrive(self, g, tile, x, t, tl):
        return 'done' if x >= 0 else None
