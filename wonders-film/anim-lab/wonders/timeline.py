"""Timeline: when each piece of the world builds, the shot list, and the camera.

One musical bar = 100 frames = 3.333 s (72 BPM, 4/4).  Every shot is one bar:

    bars 1-2    0.00 -  6.67 s   the map builds itself (to ~4 s) and holds, alive
    bars 3-15   6.67 - 50.00 s   thirteen close-ups, clockwise.  Each holds for 80 frames (drifting very
                                 slightly), then the camera swoops - pull out a little, fly, push in -
                                 for 20 frames, landing on the next landmark exactly on the bar line
    bar 16+    50.00 - 55.00 s   the last swoop opens out to the whole finished world
"""
import math

from . import ease

FPS = 30
BAR = 100                      # frames per bar / per close-up
BUILD_FRAMES = 225             # anim-lab: the comparison clips land on the Pyramids at 7.5 s (the film: 3 bars = 300)
FINAL_FRAMES = 150

HOLD = 80                      # frames each close-up rests
MOVE = BAR - HOLD              # frames of swoop that carry the camera to the next shot

# ---- the build -------------------------------------------------------------
# The centre is finished before the film starts.  Then: the four inner slabs
# (clockwise), the outer ring, the satellites, and last the dream: islets, sky creatures.
STARTS = {
    'pyramids': -10.0,
    'colosseum': 0.08, 'greatwall': 0.26, 'taj': 0.44, 'rio': 0.62,
    # two arms climb the sides of the map from the bottom and meet at the top,
    # where the Eiffel Tower - the saffron hero - is raised last, as the crown
    'reef': 0.80, 'halong': 0.99, 'machu': 1.18, 'fuji': 1.37,
    'chichen': 1.56, 'everest': 1.75, 'niagara': 1.94, 'eiffel': 2.13,
    'stonehenge': 2.72, 'aurora': 2.82, 'opera': 2.92, 'uluru': 3.02, 'moai': 3.12,
    'sky_lo': 1.95, 'sky_mid': 2.7, 'sky_hi': 3.2,
    'islet_a': 3.22, 'islet_b': 3.30, 'islet_c': 3.38, 'islet_d': 3.46, 'islet_e': 3.54,
}
# the whole build runs on a slightly slower clock (pieces start later and each one takes a little longer);
# the bounces keep their shape, they just breathe a touch more.  1.0 = the earlier, brisker build.
SLOW = 1.36         # anim-lab baseline: the film's 1.6, compressed 15% so the build fits the 7.5 s comparison clip
PIECE = 1.23        # anim-lab baseline: the film's 1.4, compressed 12%
STARTS = {k: (v * SLOW if v > 0 else v) for k, v in STARTS.items()}
RATE = {'stonehenge': 1.55, 'aurora': 1.55, 'opera': 1.55, 'uluru': 1.55, 'moai': 1.55,
        'islet_a': 1.7, 'islet_b': 1.7, 'islet_c': 1.7, 'islet_d': 1.7, 'islet_e': 1.7}
LEAD = 0.55                    # pencil placeholders are ruled this long before a piece starts building
FINALE = 3.72 * SLOW                  # glints ripple out from the centre once the map stands complete

CAM0 = (0.0, 47.0, 3.5)
WIDE = (0.0, 33.0, 2.2)
CLOSE = WIDE[2] * 2.5          # every close-up is a 2.5x crop of the same world

# ---- the tour: clockwise from the centre; each shot keeps a corner of the one before
SHOTS = [
    # name,                 centre x, y (map px)
    ('pyramids',             4.0,   46.0),     # the centre, where the film began
    ('eiffel_stonehenge',  -32.0,  -89.0),     # up to the crown of the map
    ('aurora_everest',     172.0, -106.0),     # the tower stays at the left edge; the great sun behind the summit
    ('greatwall',          118.0,   -8.0),     # Everest's base camp stays top right
    ('fuji',               236.0,   46.0),     # the Wall arcs in from the left; a lantern islet floats to the right
    ('opera_halong',       262.0,  148.0),     # Fuji's tea rows stay at the top; a lighthouse islet and a paper crane fill the corner
    ('taj',                104.0,  100.0),     # Ha Long's karsts stay bottom right
    ('reef_uluru',          40.0,  180.0),     # the Taj's gate stays at the top; a cherry islet drifts below
    ('rio',               -106.0,  102.0),     # the reef stays bottom right
    ('machu_moai',        -262.0,  140.0),     # Rio's favela stays at the right; a shepherd's islet at the left
    ('chichen',           -214.0,   50.0),     # Machu Picchu's peaks stay at the bottom
    ('niagara',           -236.0,  -24.0),     # Chichen's jungle stays at the bottom; the sky whale passes on the left
    ('colosseum',          -98.0,    6.0),     # Niagara stays at the left; the Pyramids return bottom right
]
CUTS = [BUILD_FRAMES + k * BAR for k in range(len(SHOTS) + 1)]     # the bar lines: frame on which each shot is reached
TOTAL_FRAMES = CUTS[-1] + FINAL_FRAMES
DURATION = TOTAL_FRAMES / FPS
FINALE2 = CUTS[-1] / FPS + 0.35
# each close-up's signature event peaks on the half-bar (beat 3), well inside its hold
EV_FRAME = 50
EV = {name: (CUTS[k] + EV_FRAME) / FPS for k, (name, _, _) in enumerate(SHOTS)}


def _quint(x):
    x = min(1.0, max(0.0, x))
    return x * x * x * (x * (6 * x - 15) + 10)


def _smooth(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def _build_cam(t):
    """ease-out with a soft start; while the inner ring builds the camera leans toward whichever slab is
    under construction (clockwise), then lets go; a very slow push through the hold"""
    t0 = max(0.0, t)
    tt = t0 / SLOW                 # the ease-out and the lean follow the slower build
    x = (tt + 0.18 * (math.exp(-tt / 0.18) - 1.0)) / 4.3
    e = 1.0 - (1.0 - min(1.0, x)) ** 3.0
    z = CAM0[2] * (WIDE[2] / CAM0[2]) ** e
    cx = CAM0[0] + (WIDE[0] - CAM0[0]) * e
    cy = CAM0[1] + (WIDE[1] - CAM0[1]) * e
    env = math.sin(math.pi * min(1.0, tt / 1.9)) ** 2
    phi = math.radians(206.0 + 300.0 * _smooth(tt / 1.7))
    cx += 15.0 * env * math.cos(phi)
    cy += 8.0 * env * math.sin(phi)
    t_end = (BUILD_FRAMES - MOVE) / FPS
    z *= 1.0 + 0.025 * _smooth((t0 - 4.3 * SLOW) / (t_end - 4.3 * SLOW))
    return (cx, cy, z)


def _hold_cam(k, s):
    """a close-up at rest still breathes: a slight push in and a few pixels of slide"""
    _, x, y = SHOTS[k]
    sg = 1.0 if k % 2 == 0 else -1.0
    return (x + sg * 3.0 * (s - 0.5), y - sg * 1.5 * (s - 0.5), CLOSE * (1.0 + 0.035 * s))


def _swoop(a, b, u):
    """a -> b: position and log-zoom on one quintic ease, with a pull-out in the middle of the flight"""
    e = _quint(u)
    dist = math.hypot(b[0] - a[0], b[1] - a[1])
    both_close = min(a[2], b[2]) > WIDE[2] * 1.8
    dip = math.log(2.5 / 1.72) * min(1.0, dist / 150.0) if both_close else 0.0
    lz = math.log(a[2]) + (math.log(b[2]) - math.log(a[2])) * e - dip * math.sin(math.pi * e) ** 2
    return (a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, math.exp(lz))


def camera_at(f):
    """camera for a (fractional) frame number"""
    n = len(SHOTS)
    if f <= CUTS[0] - MOVE:
        return _build_cam(f / FPS)
    k = int((f + MOVE - CUTS[0]) // BAR)            # which shot this frame is travelling to / resting on
    if k >= n:
        a = _hold_cam(n - 1, 1.0)
        wide_in = (WIDE[0], WIDE[1], WIDE[2] * 1.03)
        if f < CUTS[n]:
            return _swoop(a, wide_in, (f - (CUTS[n] - MOVE)) / MOVE)
        s = _smooth((f - CUTS[n]) / float(FINAL_FRAMES))
        return (WIDE[0], WIDE[1], WIDE[2] * (1.03 - 0.03 * s))
    if f < CUTS[k]:
        a = _build_cam((CUTS[0] - MOVE) / FPS) if k == 0 else _hold_cam(k - 1, 1.0)
        return _swoop(a, _hold_cam(k, 0.0), (f - (CUTS[k] - MOVE)) / MOVE)
    return _hold_cam(k, _smooth((f - CUTS[k]) / float(HOLD)))


def is_move(frame):
    """frames in fast flight get motion blur"""
    if frame <= CUTS[0] - MOVE:
        return False
    r = (frame + MOVE - CUTS[0]) % BAR
    k = (frame + MOVE - CUTS[0]) // BAR
    return k <= len(SHOTS) and 0 < r < MOVE


class Timeline:
    fps = FPS
    frames = TOTAL_FRAMES
    duration = DURATION

    def __init__(self, starts=None):
        self.starts = dict(STARTS if starts is None else starts)

    def apply(self, world):
        for name, t in world.tiles.items():
            t.start = self.starts.get(name, 0.0)
            t.rate = RATE.get(name, 1.0) / PIECE
            lead = LEAD if t.kind == 'tile' else 0.4
            inner = name in ('colosseum', 'greatwall', 'taj', 'rio')
            for k, s in enumerate(t.placeholder):
                if s.stage == 'cross':
                    # a surveyor's mark where each future piece will stand: there from frame 1
                    s.tp = 99.0 if inner else -99.0
                    s.te = -lead * t.rate - 0.1
                    s.de = 0.25
                    continue
                # inner four are already pencilled at frame 1: the promise
                s.tp = (-5.0 if inner else -lead * t.rate) + 0.06 * k
            for g in t.finale:
                d = math.hypot(g.pivot[0] - 0.0, (g.pivot[1] - 50.0) * 1.6)
                g.t0 = (FINALE + 0.0009 * d - t.start) * t.rate
            for g in t.finale2:
                d = math.hypot(g.pivot[0] - 0.0, (g.pivot[1] - 50.0) * 1.6)
                g.t0 = (FINALE2 + 0.0016 * d - t.start) * t.rate
                g.dur *= t.rate            # satellites run on a faster clock; keep their sparkle the same length
        return world

    def shot(self, frame):
        """-> (index, name); index -1 = build/hold, len(SHOTS) = final wide."""
        if frame < CUTS[0]:
            return -1, 'build'
        if frame >= CUTS[-1]:
            return len(SHOTS), 'final_wide'
        k = (frame - CUTS[0]) // BAR
        return k, SHOTS[k][0]

    def camera(self, t):
        return camera_at(t * FPS)
