"""Timeline: when each piece of the world builds, the shot list, and the camera.

Structure (the reference film's grammar; one musical bar = 100 frames = 3.333 s at 72 BPM):

    bars 1-2    0.00 -  6.67 s   the map builds itself (to ~4 s) and holds, alive
    bars 3-15   6.67 - 50.00 s   thirteen hard-cut static close-ups, 100 frames each, clockwise
    bar 16+    50.00 - 55.00 s   cut back to the whole finished world
"""
import math

from . import ease

FPS = 30
BAR = 100                      # frames per bar / per close-up
BUILD_FRAMES = 2 * BAR         # build + hold
FINAL_FRAMES = 150

# ---- the build -------------------------------------------------------------
# The centre is finished before the film starts.  Then: the four inner slabs
# (clockwise), the outer ring, and the satellites last.
STARTS = {
    'pyramids': -10.0,
    'colosseum': 0.08, 'greatwall': 0.26, 'taj': 0.44, 'rio': 0.62,
    # two arms climb the sides of the map from the bottom and meet at the top,
    # where the Eiffel Tower - the saffron hero - is raised last, as the crown
    'reef': 0.80, 'halong': 0.99, 'machu': 1.18, 'fuji': 1.37,
    'chichen': 1.56, 'everest': 1.75, 'niagara': 1.94, 'eiffel': 2.13,
    'stonehenge': 2.72, 'aurora': 2.82, 'opera': 2.92, 'uluru': 3.02, 'moai': 3.12,
}
RATE = {'stonehenge': 1.55, 'aurora': 1.55, 'opera': 1.55, 'uluru': 1.55, 'moai': 1.55}
LEAD = 0.55                    # pencil placeholders are ruled this long before a piece starts building
FINALE = 3.72                  # glints ripple out from the centre once the map stands complete

CAM0 = (0.0, 47.0, 3.5)
WIDE = (0.0, 29.0, 2.2)
CLOSE = WIDE[2] * 2.5          # every close-up is a 2.5x crop of the same world

# ---- the tour: clockwise from the centre; each shot keeps a corner of the one before
SHOTS = [
    # name,                 centre x, y (map px)
    ('pyramids',             4.0,   46.0),     # the centre, where the film began
    ('eiffel_stonehenge',  -32.0,  -89.0),     # up to the crown of the map; the Pyramids' back corner stays at the foot of frame
    ('aurora_everest',     168.0, -104.0),     # the tower stays at the left edge
    ('greatwall',          118.0,   -8.0),     # Everest's base camp stays top right
    ('fuji',               232.0,   48.0),     # the Wall's end tower stays top left
    ('opera_halong',       254.0,  142.0),     # Fuji's tea rows stay at the top
    ('taj',                104.0,  100.0),     # Ha Long's karsts stay bottom right
    ('reef_uluru',          52.0,  176.0),     # the Taj's gate stays at the top
    ('rio',               -106.0,  102.0),     # the reef stays bottom right
    ('machu_moai',        -254.0,  136.0),     # Rio's favela stays at the right edge
    ('chichen',           -214.0,   50.0),     # Machu Picchu's peaks stay at the bottom
    ('niagara',           -192.0,  -58.0),     # Chichen's jungle stays at the bottom
    ('colosseum',          -98.0,   -8.0),     # Niagara stays at the left; the Pyramids return bottom right
]
CUTS = [BUILD_FRAMES + k * BAR for k in range(len(SHOTS) + 1)]     # frame numbers of the hard cuts
TOTAL_FRAMES = CUTS[-1] + FINAL_FRAMES
DURATION = TOTAL_FRAMES / FPS
FINALE2 = CUTS[-1] / FPS + 0.35


class Timeline:
    fps = FPS
    frames = TOTAL_FRAMES
    duration = DURATION

    def __init__(self, starts=None):
        self.starts = dict(STARTS if starts is None else starts)

    def apply(self, world):
        for name, t in world.tiles.items():
            t.start = self.starts.get(name, 0.0)
            t.rate = RATE.get(name, 1.0)
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
        frame = int(round(t * FPS))
        k, _ = self.shot(frame)
        if k == -1:
            # ease-out with a soft start: the frame opens quickly while the inner ring builds,
            # then coasts to rest as the last satellites land; perfectly still for the hold
            tt = max(0.0, t)
            x = (tt + 0.18 * (math.exp(-tt / 0.18) - 1.0)) / 4.3
            e = 1.0 - (1.0 - min(1.0, x)) ** 3.0
            z = CAM0[2] * (WIDE[2] / CAM0[2]) ** e       # exponential zoom reads as constant speed
            return (CAM0[0] + (WIDE[0] - CAM0[0]) * e, CAM0[1] + (WIDE[1] - CAM0[1]) * e, z)
        if k == len(SHOTS):
            return WIDE
        return (SHOTS[k][1], SHOTS[k][2], CLOSE)
