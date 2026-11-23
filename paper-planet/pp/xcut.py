"""The X cut: a 23.4 s seamless social loop cut from the v3 film (python render.py --cut x --fmt x|sq|v).

v3's timeline (pp/core.py) is untouched. This module drives the same scene with its own clock: for each output
frame it picks the shot, sets the camera's eight channels (core.CAM_OVERRIDE), chooses the v3 film time the
scene is evaluated at (the "source" time) and re-times the blooms of the pieces in that shot. Montage time is
elastic: every close-up relives its own bloom, even though the whole globe burst open in the wide shot.

Music grid: 100 BPM, 3/4 (beat = 0.6 s = 18 frames, bar = 1.8 s); the first downbeat is at 0.8 s and the
loop is 13 bars (702 frames), so the grid wraps seamlessly.
"""
import math
import numpy as np
from . import core, travellers
from .core import ll_frame, spring, smooth, smoother, DEG_PER_S
from .mech import NEVER

FPS = 30
BPM = 100.0
BEAT = 60.0 / BPM          # 0.6 s, 18 frames
BAR = 3 * BEAT             # 1.8 s
G0 = 0.8                   # the first downbeat: the burst lands on it
LOOP = 13 * BAR            # 23.4 s
NF = int(round(LOOP * FPS))  # 702 frames


def beat(k):
    """Cut time of beat k counted from the first downbeat (k = 0, 3, 6 ... are downbeats)."""
    return G0 + k * BEAT


FMT = {'x': (1920, 1080), 'sq': (1080, 1080), 'v': (1080, 1920)}
# how much bigger (in px) than the 16:9 frame each format draws the wide globe / the close-ups
WIDE_PX = {'x': 1.0, 'sq': 1.04, 'v': 1.22}
CLOSE_PX = {'x': 1.0, 'sq': 1.0, 'v': 1.12}

# ---------------------------------------------------------------------------------------------- the wide shot
T_W = core.DUR             # source time at the loop seam: every piece crowned and settled, the moon at its wide spot
W_ELEV = -10.0
W_ZOOM = 0.50              # a little larger than v3's 0.47: the hook has to read at thumbnail size
W_SY = 0.515
W_L0 = 13.0                # globe facing longitude at the seam (the crown was staged for ~21)
W_SPIN = (2.5, 3.5, 1.0)   # deg/s: 2.5 in the crowned hold, +3.5 around the seam (the hook turns visibly from frame 0)
W_PUSH = 0.008             # a slow push-in, linear across the seam (so continuous at the loop point)
def wide_turn(w):
    """Degrees the globe has turned at wide-clock w (s from the loop seam): smooth, faster around the seam."""
    return W_SPIN[0] * w + W_SPIN[1] * W_SPIN[2] * math.sqrt(math.pi) / 2 * math.erf(w / W_SPIN[2])


BURST_SPREAD = 0.50        # s for the wave to reach the rim
PUNCH = (0.45, 1.5, 0.07)  # the camera punches in 7 % as the globe bursts (opening only; the cut comes before it matters)
FOLD_T = (beat(36), 0.36, 0.50)
GROW_WIDE = {'zebra': 1.7, 'lion': 1.4, 'flamingo': 1.4}   # fold: rim starts on the last downbeat, the centre 0.36 s later, each takes 0.5 s

# ---------------------------------------------------------------------------------------------- the shots
# Close-ups: (name, start beat, length in beats, stop (or 'africa'), hero (region, sprite, index),
#             fh (hero height as a fraction of the frame's short side), cy (where its centre sits, fraction of
#             height), push (log zoom /s), drift (dlat, dlon deg/s), spin deg/s, lead (s from the cut to the hero's
#             lift), bloom (s from lift to lock), extra: 'open'/'shut' sprite names among the stop's pieces, 'with'
#             pieces framed together with the hero, 'elev' / 'dlonc' camera tweaks)
# The camera is solved per format (_autoframe): zoom and offset so the hero, fully open, fills fh, and a roll
# that stands it upright. The 'stop' names the v3 stop whose staging (hinge angles, hero growth, camera
# elevation, globe turn) the shot borrows; 'africa' borrows the finale's.
SHOTS = [
    # name          beat  len  stop          hero                           fh    cy    push   drift(dlat,dlon) spin lead  bloom  extra
    ('eiffel',       3,   3,  'europe',     ('europe', 'eiffel', 0),       0.70, 0.50, 0.045, (0.0, 0.0),   2.0, 0.10, 0.50, {}),
    ('greatwave',    6,   3,  'pacific',    ('pacific', 'greatwave', 0),   0.48, 0.48, 0.035, (0.0, 1.2),   2.0, 0.10, 0.50, {}),
    ('aurora',       9,   3,  'arctic',     ('arctic', 'aurora', 0),       0.50, 0.48, -0.03, (0.0, -1.0),  2.0, -0.35, 0.95, {}),
    ('pyramids',    12,   2,  'africa',     ('africa', 'pyr_face', 0),     0.46, 0.52, 0.05, (0.0, 0.0),    2.5, 0.08, 0.52, {}),
    ('liberty',     14,   2,  'namerica',   ('namerica', 'liberty', 0),    0.64, 0.50, 0.06, (0.0, 0.0),    2.0, 0.08, 0.52, {}),
    ('taj',         16,   2,  'southasia',  ('southasia', 'taj', 0),       0.50, 0.52, 0.05, (0.0, 1.0),    2.0, 0.08, 0.52, {'open': ['himalaya_z']}),
    ('machu',       18,   1,  'samerica',   ('samerica', 'machu', 0),      0.40, 0.52, 0.08, (0.0, 0.0),    2.0, 0.03, 0.27, {}),
    ('bigben',      19,   1,  'europe',     ('europe', 'bigben', 0),       0.62, 0.50, 0.08, (0.0, 0.0),    2.0, 0.03, 0.27, {'shut': ['eiffel']}),
    ('kilimanjaro', 20,   1,  'africa',     ('africa', 'kili_z', 0),       0.45, 0.52, 0.08, (0.0, 0.0),    2.5, 0.00, 0.30, {}),
    ('opera',       21,   1,  'oceania',    ('oceania', 'opera', 0),       0.36, 0.55, 0.08, (0.0, 0.0),    2.0, -0.03, 0.33, {}),
    # the whale (its own entry below), beats 22-26, then the flurry: half-beat shots
    ('windmill',    26,  .5,  'europe',     ('europe', 'windmill', 0),     0.55, 0.50, 0.10, (0.0, 0.0),    2.0, 0.00, 0.15, {'shut': ['eiffel', 'bigben']}),
    ('christ',     26.5, .5,  'samerica',   ('samerica', 'christ', 0),     0.60, 0.50, 0.10, (0.0, 0.0),    2.0, 0.00, 0.15, {}),
    ('pagoda',      27,  .5,  'eastasia',   ('eastasia', 'pagoda', 0),     0.58, 0.50, 0.10, (0.0, 0.0),    2.0, 0.00, 0.15, {}),
    ('giraffe',    27.5, .5,  'africa',     ('africa', 'giraffe', 0),      0.55, 0.50, 0.10, (0.0, 0.0),    2.5, 0.00, 0.15, {'shut': ['pyr_face']}),
    ('penguins',    28,  .5,  'antarctica', ('antarctica', 'colony', 0),   0.40, 0.52, 0.10, (0.0, 0.0),    2.0, 0.00, 0.15, {'open': ['aurora_s', 'iceberg_z', 'penguin', 'seal']}),
    ('goldengate', 28.5, .5,  'namerica',   ('namerica', 'goldengate', 0), 0.40, 0.50, 0.10, (0.0, 0.0),    2.0, 0.00, 0.15, {}),
    ('kangaroo',    29,  .5,  'oceania',    ('oceania', 'kangaroo', 0),    0.50, 0.52, 0.10, (0.0, 0.0),    2.0, 0.00, 0.15, {'shut': ['opera', 'hbridge']}),
    ('torii',      29.5, .5,  'eastasia',   ('eastasia', 'torii', 0),      0.40, 0.52, 0.10, (0.0, 0.0),    2.0, 0.00, 0.15, {'with': [('eastasia', 'fuji_z', 0)]}),
]
ZMAX, ZMIN = 2.5, 0.9
MAX_DLON = 10.0            # deg: the hero sits at most this far from the facing meridian
PRE_GAP = 2.2              # members that bloom before the hero do so this much earlier (they are mid-air at the cut)
LEVEL = 0.85               # how much of the hero's on-screen lean the close-up camera rolls out      # close-up zoom limits (the map print softens beyond ~2.5)
WHALE = dict(beat=22, len=4, rate=1.6, peak_beat=24, push=0.03, sub=3, zoom=1.18, sy=0.86)
CROWN_BEAT = 30            # the slam back to the crowned globe (a downbeat)


class Shot:
    def __init__(self, **kw):
        self.__dict__.update(kw)


def _v3_keys(t):
    sv = core.CAM_OVERRIDE
    core.CAM_OVERRIDE = None
    try:
        return core.cam_keys(t)
    finally:
        core.CAM_OVERRIDE = sv


def _ang(a, b):
    return math.degrees(math.acos(max(-1.0, min(1.0, float(a @ b)))))


class XCut:
    def __init__(self, sc, fmt='x'):
        self.sc = sc
        self.fmt = fmt
        self.w, self.h = FMT[fmt]
        self.P = sc.pieces
        for p in self.P:
            p.t_fold = NEVER
        self.orig = [(p.t_open, p.tempo, p.t_shrink, p.t_crown) for p in self.P]
        self.pos = [ll_frame(p.lat, p.lon)[0] for p in self.P]
        self._masks = {}
        self._wide_plan()
        self._crown_fix()
        self._build_shots()

    # -------------------------------------------------------------------------------- framing per format
    def zf(self, wide):
        c = (WIDE_PX if wide else CLOSE_PX)[self.fmt]
        return c * 1080.0 / self.h

    def syf(self, sy, wide):
        return 0.5 + (sy - 0.5) * self.zf(wide)

    # -------------------------------------------------------------------------------- the wide shot
    def wide_keys(self, w):
        punch = 1.0 + PUNCH[2] * smoother((w - PUNCH[0]) / (PUNCH[1] - PUNCH[0])) if w > 0 else 1.0
        return [W_ELEV, W_ZOOM * self.zf(True) * (1.0 + W_PUSH * w) * punch, 0.0, 0.0, 0.5, self.syf(W_SY, True), 1.0, W_L0 - wide_turn(w)]

    def _front(self, w):
        """Globe-local unit vector of the point facing the lens in the wide shot."""
        core.CAM_OVERRIDE = self.wide_keys(w)
        cam = core.Camera(T_W + w, 1)
        G = core.globe_matrix(T_W + w)
        core.CAM_OVERRIDE = None
        v = G.T @ cam.chat
        return v / np.linalg.norm(v)

    def burst_time(self, r):
        """(lift, din) for something at globe-local r: the wave spreads from the front centre to the rim."""
        d = min(100.0, _ang(self.front, r))
        lock = G0 + BURST_SPREAD * (d / 90.0) ** 1.05
        return lock, d

    def fold_start(self, r):
        d = min(100.0, _ang(self.front, r))
        return FOLD_T[0] + FOLD_T[1] * (1.0 - d / 100.0)      # rim first, centre last: the burst reversed

    def _wide_plan(self):
        self.front = self._front(0.3)
        self.wplan = []
        for i, p in enumerate(self.P):
            lock, d = self.burst_time(self.pos[i])
            h = (i * 2654435761) % 1000 / 1000.0
            lock += 0.03 * p.order / 5.0 + 0.04 * (h - 0.5)
            base = p.dur_in / DEG_PER_S
            din = 0.55 * math.sqrt(base)
            self.wplan.append((lock - 0.46 * din, din, self.fold_start(self.pos[i])))

    def _crown_fix(self):
        """v3's finale left edge-on slivers at the rim (pieces whose neighbours kept them from turning, walkers)
        and small southern animals seen from above (the zebras read as stripes). For the crowned wide shot only:
        every flap near the rim turns about its own axis to face the lens, and the small animals grow."""
        from .mech import Flap, face_yaw
        core.CAM_OVERRIDE = self.wide_keys(-2.0)
        camc, Gc = core.Camera(T_W - 2.0, 1), core.globe_matrix(T_W - 2.0)
        core.CAM_OVERRIDE = None
        self.xyaw, self.xk = {}, {}
        for i, p in enumerate(self.P):
            d = _ang(self.front, self.pos[i])
            nm = getattr(getattr(p, 'spr', None), 'name', '')
            if nm in GROW_WIDE and p.region == 'africa':
                self.xk[i] = GROW_WIDE[nm]
            if not isinstance(p, Flap) or p.hang or abs(p.dyaw_crown) > 1.0 or not (68.0 < d < 135.0):
                continue
            fy, sa = face_yaw(camc, Gc, p.lat, p.lon)
            dy = (fy - p.yaw + 180.0) % 360.0 - 180.0
            if abs(dy) <= 100.0:
                self.xyaw[i] = dy * smooth((sa - 0.35) / 0.35)

    # -------------------------------------------------------------------------------- close-ups
    def _find(self, region, name, k):
        hits = [p for p in self.P if p.region == region and getattr(getattr(p, 'spr', None), 'name', '') == name]
        return hits[k]

    def _build_shots(self):
        self.shots = []
        S = self.shots
        S.append(Shot(name='snap', kind='wide', t0=0.0, t1=beat(3), sub=1))
        for (name, b, nb, stop, hero, fh, cy, push, drift, spin, lead, bloom, extra) in SHOTS:
            hp = self._find(*hero)
            la, lo = hp.lat, hp.lon
            if stop == 'africa':
                S0 = T_W - 3.0
                members = [i for i, p in enumerate(self.P) if p.stop is None and _ang(self.pos[i], ll_frame(hp.lat, hp.lon)[0]) < 40.0]
                lonc0 = 21.0 + (hp.lon - 24.0) * 0.6      # the finale's view of Africa, turned a little toward the hero
                elev = -10.0
            else:
                S0 = core.stop_face_time(stop) - 0.3
                members = [i for i, p in enumerate(self.P) if p.stop == stop]
                k3 = _v3_keys(S0)
                lonc0, elev = k3[7], k3[0]
                # turn the globe so the hero is at most MAX_DLON from the facing meridian (seen from the front, not
                # leaning out toward the limb); its hinge was staged for the stop's camera, a little to the side
                d = core.wrap180(hp.lon - lonc0)
                lonc0 = hp.lon - max(-MAX_DLON, min(MAX_DLON, d))
            hi = self.P.index(hp)
            t0, t1 = beat(b), beat(b + nb)
            S.append(Shot(name=name, kind='close', t0=t0, t1=t1, sub=1, stop=stop, hero=hi, members=members,
                          la=la, lo=lo, z=1.4, sx=0.5, sy=0.6, fh=fh, cy=cy, push=push, drift=drift, spin=spin, lead=lead,
                          bloom=bloom, S0=S0, lonc0=lonc0 + extra.get('dlonc', 0.0), elev=extra.get('elev', elev), rate=1.0,
                          extra=extra, frame=[hi] + [self.P.index(self._find(*q)) for q in extra.get('with', [])],
                          force_open=[i for i in members if getattr(getattr(self.P[i], 'spr', None), 'name', '') in extra.get('open', ())],
                          force_shut=[i for i in members if getattr(getattr(self.P[i], 'spr', None), 'name', '') in extra.get('shut', ())],
                          roll=core.ROLL))
        wb = WHALE
        S.append(Shot(name='whale', kind='whale', t0=beat(wb['beat']), t1=beat(wb['beat'] + wb['len']), sub=wb['sub'],
                      rate=wb['rate'], tpeak=beat(wb['peak_beat']), push=wb['push'], zm=wb['zoom'], sy=wb['sy']))
        S.append(Shot(name='crown', kind='wide', t0=beat(CROWN_BEAT), t1=LOOP, sub=1))
        S.sort(key=lambda s: s.t0)
        for a, b in zip(S[:-1], S[1:]):
            assert abs(a.t1 - b.t0) < 1e-6, (a.name, a.t1, b.name, b.t0)
        # per-shot bloom re-timing: an affine map of the stop's v3 schedule about the hero, so the relative order
        # (which keeps neighbours from passing through each other) is kept, but the hero lifts `lead` after the
        # cut and locks `bloom` later
        for s in S:
            if s.kind != 'close':
                continue
            hp = self.P[s.hero]
            h_open = self.orig[s.hero][0]
            din_h = hp.dur_in / DEG_PER_S * self.orig[s.hero][1]
            s.k = s.bloom * s.rate / (0.46 * din_h)
            s.H = s.S0 + s.rate * s.lead
            s.h_open = h_open
            self._autoframe(s)
        self.release()

    def bbox(self, s, tau, idx=None):
        """Screen bbox (px, this format) of the shot's framed pieces at cut time tau (non-emissive cards)."""
        from .mech import Ctx
        t = self.apply(tau, s)
        cam = core.Camera(t, 1, self.w, self.h)
        G = core.globe_matrix(t)
        ctx = Ctx(t, G, cam, core.center_lon(t))
        for i in (s.frame if idx is None else idx):
            self.P[i].emit(ctx)
        pts = []
        g = (np.arange(24) + 0.5) / 24
        GU, GV = [a.ravel() for a in np.meshgrid(g, g)]
        for c in ctx.out:
            if c.emis or c.alpha < 0.5:
                continue
            xl, yl = GU * c.w, GV * c.h
            op = np.zeros(len(GU), bool)
            for L in c.layers:
                spr, A = L[0], L[1]
                Mi = np.linalg.inv(np.array(A.get9()).reshape(3, 3))
                px = Mi[0, 0] * xl + Mi[0, 1] * yl + Mi[0, 2]
                py = Mi[1, 0] * xl + Mi[1, 1] * yl + Mi[1, 2]
                ok = (px >= 0) & (py >= 0) & (px < spr.pw) & (py < spr.ph)
                if len(L) > 3 and L[3] is not None:
                    ok &= (px >= L[3][0]) & (px < L[3][1])
                idx = np.nonzero(ok)[0]
                if spr.name not in self._masks:
                    self._masks[spr.name] = spr.rgba[..., 3] > 90
                op[idx] |= self._masks[spr.name][py[idx].astype(int), px[idx].astype(int)]
            if not op.any():
                continue
            Pw = c.O[None] + np.outer(xl[op], c.X) + np.outer(yl[op], c.Y)
            sc_, _ = cam.project(Pw)
            pts.append(sc_)
        if not pts:
            return None
        P = np.concatenate(pts)
        return P[:, 0].min(), P[:, 1].min(), P[:, 0].max(), P[:, 1].max()

    def lean(self, s, tau):
        """On-screen angle (deg, clockwise from up) of the hero card's own up axis at cut time tau."""
        from .mech import Ctx
        t = self.apply(tau, s)
        cam = core.Camera(t, 1, self.w, self.h)
        G = core.globe_matrix(t)
        ctx = Ctx(t, G, cam, core.center_lon(t))
        self.P[s.hero].emit(ctx)
        cs = [c for c in ctx.out if not c.emis]
        c = max(cs, key=lambda c: c.w * c.h)
        b0 = c.O + c.X * (c.w / 2)
        a, _ = cam.project(np.array([b0, b0 + c.Y * c.h]))
        v = a[1] - a[0]
        return math.degrees(math.atan2(v[0], -v[1]))

    def _autoframe(self, s):
        """Solve zoom and screen offset so the hero (and its 'with' pieces), fully open, fill fh of the frame's
        short side (a little more in the vertical format) centred at (0.5, cy)."""
        hp = self.P[s.hero]
        din = hp.dur_in / DEG_PER_S * self.orig[s.hero][1] * s.k / s.rate
        tref = min(s.t1 - 0.02, s.t0 + s.lead + din * 0.75)
        s.tref = tref
        target = (1.0 - LEVEL) * self.lean(s, tref)
        for it in range(4):
            a0 = self.lean(s, tref)
            s.roll += 1.0
            a1 = self.lean(s, tref)
            s.roll -= 1.0
            if abs(a1 - a0) > 0.2:
                s.roll -= max(-10.0, min(10.0, (a0 - target) / (a1 - a0)))
            s.roll = max(core.ROLL - 24.0, min(core.ROLL + 24.0, s.roll))
        short = min(self.w, self.h) * (1.12 if self.fmt == 'v' else 1.0)
        for it in range(6):
            bb = self.bbox(s, tref)
            x0, y0, x1, y1 = bb
            hh, ww = y1 - y0, x1 - x0
            k = min(s.fh * short / max(hh, 1.0), 0.86 * self.w / max(ww, 1.0))
            zs = 1080.0 / self.h * CLOSE_PX[self.fmt]
            zt = min(ZMAX * zs, max(ZMIN * zs, s.z * k))
            # the push is centred on the middle of the shot: solve for the zoom at tref
            s.z = zt
            bb = self.bbox(s, tref)
            x0, y0, x1, y1 = bb
            s.sx += 0.5 - 0.5 * (x0 + x1) / self.w
            s.sy += s.cy - 0.5 * (y0 + y1) / self.h

    def shot_at(self, tau):
        tau = tau % LOOP
        for s in self.shots:
            if s.t0 - 1e-9 <= tau < s.t1 - 1e-9:
                return s
        return self.shots[-1]

    # -------------------------------------------------------------------------------- per-frame state
    def _restore(self):
        for p, (to, te, ts, tc) in zip(self.P, self.orig):
            p.t_open, p.tempo, p.t_shrink, p.t_crown = to, te, ts, tc
            p.t_fold = NEVER
            p.xyaw, p.xk = 0.0, 1.0

    def src_time(self, s, tau):
        if s.kind == 'wide':
            return T_W + (tau if tau < LOOP / 2 else tau - LOOP)
        if s.kind == 'whale':
            return core.BREACH_PEAK + s.rate * (tau - s.tpeak)
        return s.S0 + s.rate * (tau - s.t0)

    def apply(self, tau, s=None):
        """Set the scene, travellers and camera for cut time tau; returns the source time to render at."""
        tau = tau % LOOP
        if s is None:
            s = self.shot_at(tau)
        self._restore()
        travellers.CUT = None
        t = self.src_time(s, tau)
        if s.kind == 'wide':
            w = t - T_W
            core.CAM_OVERRIDE = self.wide_keys(w)
            travellers.CUT = WideGate(self, w)
            opening = w >= 0.0
            for i, v in self.xyaw.items():
                self.P[i].xyaw = v
            for i, v in self.xk.items():
                self.P[i].xk = v
            for p, (lift, din, fold) in zip(self.P, self.wplan):
                p.tempo = din / (p.dur_in / DEG_PER_S)
                if opening:
                    p.t_open = T_W + lift
                else:
                    p.t_open = T_W - 100.0
                    p.t_fold = T_W + (fold - LOOP)
                    p.d_fold = FOLD_T[2]
        elif s.kind == 'whale':
            k = _v3_keys(t)
            u = tau - 0.5 * (s.t0 + s.t1)
            k[1] *= s.zm * math.exp(s.push * u) * self.zf(False)
            k[5] = self.syf(s.sy, False) if self.fmt != 'v' else 0.80
            core.CAM_OVERRIDE = k
        else:
            for i in s.members:
                p = self.P[i]
                to, te, ts, tc = self.orig[i]
                p.t_open = s.H + (to - s.h_open) * s.k * (PRE_GAP if to < s.h_open else 1.0)
                p.tempo = te * s.k
                p.t_shrink = NEVER
                p.t_crown = NEVER
            for i in s.force_open:
                self.P[i].t_open = s.S0 - 20.0
            for i in s.force_shut:
                self.P[i].t_open = NEVER
            u = tau - s.tref if hasattr(s, 'tref') else 0.0
            zoom = s.z * math.exp(s.push * u)
            lonc = s.lonc0 - s.spin * (tau - s.t0)
            core.CAM_OVERRIDE = [s.elev, zoom, s.la + s.drift[0] * u, s.lo + s.drift[1] * u, s.sx, s.sy, 0.0, lonc, s.roll]
        return t

    def release(self):
        self._restore()
        core.CAM_OVERRIDE = None
        travellers.CUT = None


class WideGate:
    """Travellers in the wide shot: clouds and ships rise with the burst and fold with the fold; whale spouts
    only play whole cycles inside the bloomed time; the paper plane stays away (it would pop at the seam)."""

    def __init__(self, xc, w):
        self.xc, self.w = xc, w

    def _times(self, lat, lon):
        r = ll_frame(lat, lon)[0]
        lock, _ = self.xc.burst_time(r)
        return lock, self.xc.fold_start(r) - LOOP

    def rise(self, ctx, lat, lon, dur, default):
        lock, fold = self._times(lat, lon)
        w = ctx.t - T_W
        if w >= 0.0:
            return spring((w - (lock - 0.3)) / 0.75)
        if w <= fold:
            return 1.0
        return spring(max(0.0, 1.0 - (w - fold) / FOLD_T[2]))

    def cycle_ok(self, ctx, lat, lon, c0, c1):
        lock, fold = self._times(lat, lon)
        if ctx.t - T_W >= 0.0:
            return c0 - T_W >= lock + 0.2
        return c1 - T_W <= fold

    def plane_ok(self, ctx):
        return False


# ---------------------------------------------------------------------------------------------- sound events
def events(xc):
    """Foley events for the soundtrack, from the same schedules the picture uses (cut seconds):
    [(kind, t_lift, t_lock, size, pan, gain)] with kind 'burst', 'close' or 'fold'."""
    out = []
    # the burst: everything on the near side
    for i, (p, (lift, din, fold)) in enumerate(zip(xc.P, xc.wplan)):
        if getattr(p, 'quiet', False):
            continue
        d = _ang(xc.front, xc.pos[i])
        if d > 110.0:
            continue
        core.CAM_OVERRIDE = xc.wide_keys(1.2)
        cam = core.Camera(T_W + 1.2, 1, xc.w, xc.h)
        P = core.globe_matrix(T_W + 1.2) @ xc.pos[i]
        x = cam.project(P[None])[0][0, 0] / xc.w
        g = min(1.0, p.size / 0.3) ** 0.6 * (1.0 if d < 92 else 0.35)
        out.append(('burst', lift, lift + 0.46 * din, p.size, (x - 0.5) * 1.3, g))
        out.append(('fold', fold, fold + FOLD_T[2], p.size, (x - 0.5) * 1.3, g))
    core.CAM_OVERRIDE = None
    for s in xc.shots:
        if s.kind != 'close':
            continue
        skip = set(s.force_open) | set(s.force_shut)
        for i in s.members:
            p = xc.P[i]
            if i in skip or getattr(p, 'quiet', False):
                continue
            to, te = xc.orig[i][0], xc.orig[i][1]
            to2 = s.H + (to - s.h_open) * s.k * (PRE_GAP if to < s.h_open else 1.0)
            din2 = p.dur_in / DEG_PER_S * te * s.k
            lift = s.t0 + (to2 - s.S0) / s.rate
            lock = lift + 0.46 * din2 / s.rate
            if not (s.t0 - 0.02 <= lock <= s.t1 - 0.02):
                continue
            t = xc.apply(lock, s)
            cam = core.Camera(t, 1, xc.w, xc.h)
            P = core.globe_matrix(t) @ xc.pos[i]
            sxy = cam.project(P[None])[0][0]
            vis = float(P @ cam.chat) > cam.limb_k - 0.05 and -0.05 < sxy[0] / xc.w < 1.05 and -0.1 < sxy[1] / xc.h < 1.1
            if not vis:
                continue
            g = min(1.0, p.size / 0.3) ** 0.6 * (1.25 if i == s.hero else 0.8)
            out.append(('close', max(lift, s.t0), lock, p.size, (sxy[0] / xc.w - 0.5) * 1.2, g))
    xc.release()
    return out
