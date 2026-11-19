"""Timeline: when each piece of the world starts to build, and the camera."""
import math

from . import ease

FPS = 30
DURATION = 5.0

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
# pencil placeholders are ruled this long before a piece starts building
LEAD = 0.55
FINALE = 3.72

CAM0 = (0.0, 47.0, 3.5)
CAM1 = (0.0, 29.0, 2.2)


class Timeline:
    fps = FPS
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
            # finale: glints ripple outward from the centre once the map stands complete
            for g in t.finale:
                d = math.hypot(g.pivot[0] - 0.0, (g.pivot[1] - 50.0) * 1.6)
                g.t0 = (FINALE + 0.0009 * d - t.start) * t.rate
        return world

    def camera(self, t):
        # ease-out with a soft start: the frame opens quickly while the inner ring builds,
        # then coasts to rest as the last satellites land
        tt = max(0.0, t)
        x = (tt + 0.18 * (math.exp(-tt / 0.18) - 1.0)) / 4.3
        e = 1.0 - (1.0 - min(1.0, x)) ** 3.0
        z = CAM0[2] * (CAM1[2] / CAM0[2]) ** e       # exponential zoom reads as constant speed
        return (CAM0[0] + (CAM1[0] - CAM0[0]) * e, CAM0[1] + (CAM1[1] - CAM0[1]) * e, z)
