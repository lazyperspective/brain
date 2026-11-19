"""Rasteriser + stone shader for 'Dilli, Inlaid'. numpy + OpenCV drawing primitives only."""
import math
import numpy as np
import cv2
from scene import MATS, MAT, NMAT, WW, WH

SH = 4
SHM = float(1 << SH)
AA, L8 = cv2.LINE_AA, cv2.LINE_8
F_END = 840
F_UNB = 744          # un-build phase starts (states switch to lift-off timeline)
LIGHT = (18.0, 26.0)  # shadow offset per unit height (world units)


def fnoise(h, w, beta, seed, lo=0., hi=.5):
    """periodic fractal noise via FFT; band-limited to [lo, hi] cycles/px. zero mean, unit std."""
    rng = np.random.default_rng(seed)
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.rfftfreq(w)[None, :]
    fr = np.sqrt(fx * fx + fy * fy)
    fr[0, 0] = 1
    amp = fr ** (-beta)
    amp[0, 0] = 0
    amp[(fr < lo) | (fr > hi)] = 0
    spec = amp * np.exp(2j * np.pi * rng.random(amp.shape))
    x = np.fft.irfft2(spec, s=(h, w)).astype(np.float32)
    x -= x.mean()
    x /= x.std()
    return x


def make_ground():
    h, w = 1620, 2880
    n = fnoise(h, w, 1.9, 1, hi=.05)
    n2 = fnoise(h, w, 1.5, 2, hi=.12)
    n3 = fnoise(h, w, 2.0, 3, hi=.02)
    n4 = fnoise(h, w, 1.2, 4, lo=.02, hi=.3)
    f = n + .22 * n2
    veins = np.zeros_like(f)
    for c, wd, a in [(-1.1, .020, .7), (-.2, .012, 1.), (.55, .016, .8), (1.3, .010, .6)]:
        veins += a * np.exp(-((f - c) / wd) ** 2)
    veins *= np.clip(.5 + .6 * n3, 0, 1)
    veins2 = np.exp(-((n2 - .3 * n) / .05) ** 2) * np.clip(-.2 + .5 * n3, 0, 1) * .5
    cloud = .5 + .5 * np.tanh(.9 * n3 + .3 * n)
    base = np.array([18, 14, 13], np.float32)  # BGR
    g = base[None, None] * (.72 + .55 * cloud[..., None]) + n4[..., None] * 1.2
    g += veins[..., None] * np.array([46, 58, 66], np.float32) * .8
    g += veins2[..., None] * np.array([70, 66, 62], np.float32) * .5
    return np.clip(g, 0, 255).astype(np.float32)


class Renderer:
    def __init__(self, sc, RW=1920, RH=1080):
        self.sc = sc
        self.RW, self.RH = RW, RH
        self.px = RW / WW
        self.ground = make_ground()
        self.GS = self.ground.shape[1] / WW
        self.N1 = fnoise(1024, 1024, .4, 11, lo=.02, hi=.22)     # grain
        self.N2 = fnoise(1024, 1024, 1.7, 12, hi=.08)            # blotch / banding driver
        self.lA = np.array([m['a'] for m in MATS], np.float32)
        self.lB = np.array([m['b'] for m in MATS], np.float32)
        self.lC = np.array([m['c'] for m in MATS], np.float32)
        self.lJ = np.array([m['jd'] for m in MATS], np.float32)
        self.lV = np.array([m['bev'] for m in MATS], np.float32)
        self.lS = np.array([m['spec'] for m in MATS], np.float32)
        self.lS[2:] = np.maximum(self.lS[2:], .07)
        self.lS[0] = .05
        yy, xx = np.mgrid[0:RH, 0:RW].astype(np.float32)
        self.xx, self.yy = xx / RW, yy / RH
        r2 = ((xx / RW - .5) * 1.25) ** 2 + ((yy / RH - .5) * 1.0) ** 2
        self.vig = (1 - .55 * np.clip(r2 - .08, 0, 1) ** 1.1).astype(np.float32)
        self.grain = None
        self.sock = MATS[MAT['SOCKET']]['cols'][0]

    # ------------------------------------------------------------------ helpers
    def _warp(self, tex, cam, ts, border=cv2.BORDER_WRAP):
        cx, cy, z = cam
        z = z * self.px
        M = np.float32([[ts / z, 0, (cx - self.RW / (2 * z)) * ts], [0, ts / z, (cy - self.RH / (2 * z)) * ts]])
        return cv2.warpAffine(tex, M, (self.RW, self.RH), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderMode=border)

    def _states(self, f):
        sc = self.sc
        if f < F_UNB:
            p = (f - (sc.TL - sc.DUR)) / sc.DUR
            build = True
        else:
            p = 1 - (f - sc.TLIFT) / sc.DUR2
            build = False
        return p, build

    def _pose(self, i, p, build, OFF):
        """world-space polygon + height for an in-flight piece."""
        sc = self.sc
        pts = sc.V[sc.off[i]:sc.off[i + 1]]
        sty = sc.STY[i]
        if sty == 0:
            k = (1 - p) ** 3 if build else (1 - p) ** 2
            c = sc.cen[i]
            th = sc.ROT[i] * k
            s = 1 + .9 * k
            ca, sa = math.cos(th) * s, math.sin(th) * s
            d = pts - c
            out = np.empty_like(d)
            out[:, 0] = c[0] + d[:, 0] * ca - d[:, 1] * sa + OFF[i, 0] * k
            out[:, 1] = c[1] + d[:, 0] * sa + d[:, 1] * ca + OFF[i, 1] * k
            arc = math.sin(math.pi * min(1., p)) * 40 * (1 if i % 2 else -1) if build else 0
            if arc:
                ln = math.hypot(OFF[i, 0], OFF[i, 1]) + 1e-6
                out[:, 0] += -OFF[i, 1] / ln * arc
                out[:, 1] += OFF[i, 0] / ln * arc
            return out, k ** .6
        if sty == 1:
            if build:
                q = p - 1
                s = 1 + 2.2 * q ** 3 + 1.2 * q ** 2     # ease-out-back
            else:
                s = p
            a = sc.ANC[i]
            return a + (pts - a) * max(s, .02), 0.
        # trim
        n = sc.NR[i]
        e = p * p * (3 - 2 * p)
        k = int(2 + e * (n - 2))
        k = max(2, min(n, k))
        return np.concatenate([pts[:k], pts[2 * n - k:]], 0), 0.

    # ------------------------------------------------------------------ main
    def render(self, f, cam, life=(), steam=(), sweep=None, glow=0.):
        """f: frame time (float). cam=(cx,cy,zoom). life: [(pts, mid, colBGR, h)]. returns float32 BGR image."""
        sc = self.sc
        RW, RH = self.RW, self.RH
        cx, cy, zc = cam
        z = zc * self.px
        img = self._warp(self.ground, cam, self.GS, cv2.BORDER_REFLECT)
        img = np.clip(img, 0, 255).astype(np.uint8)
        aux = np.zeros((RH, RW, 3), np.uint8)
        shadow = np.zeros((RH, RW), np.uint8)

        def toS(P):
            return np.round(((P - (cx, cy)) * z + (RW / 2, RH / 2)) * SHM).astype(np.int32)

        S = toS(sc.V)
        off = sc.off
        vis = ((sc.bb[:, 2] - cx) * z > -RW / 2 - 4) & ((sc.bb[:, 0] - cx) * z < RW / 2 + 4) & \
              ((sc.bb[:, 3] - cy) * z > -RH / 2 - 4) & ((sc.bb[:, 1] - cy) * z < RH / 2 + 4)
        p, build = self._states(f)
        landed = p >= 1
        active = (p > 0) & (p < 1)
        # sockets
        sk = self.sock
        for i in np.nonzero(vis & ~landed)[0]:
            q = [S[off[i]:off[i + 1]]]
            cv2.fillPoly(img, q, sk, AA, SH)
            cv2.fillPoly(aux, q, (1, 1, 0), L8, SH)
        # landed stones
        C = sc.col
        if build:
            dt = f - sc.TL
            fl = np.where((dt >= 0) & (dt < 30), np.exp(-np.maximum(dt, 0) / 4.5), 0).astype(np.float32)
            C = np.minimum(C * (1 + 1.1 * fl[:, None]) + 40 * fl[:, None], 255)
        if hasattr(sc, 'dyn_color'):
            C = sc.dyn_color(f, C)
        Cl = C.tolist()
        mids = sc.mid.tolist()
        rids = sc.rid.tolist()
        for i in np.nonzero(vis & landed)[0]:
            q = [S[off[i]:off[i + 1]]]
            cv2.fillPoly(img, q, Cl[i], AA, SH)
            cv2.fillPoly(aux, q, (mids[i], rids[i], 0), L8, SH)
        # in-flight stones
        passes = [(p, build, sc.OFF if build else sc.OFF2, active)]
        if f > F_END - 60:      # the next loop's first stones are already arriving
            pb = ((f - F_END) - (sc.TL - sc.DUR)) / sc.DUR
            passes.append((pb, True, sc.OFF, (pb > 0) & (pb < 1)))
        lx, ly = LIGHT
        for pp, bld, OFF, act in passes:
            for i in np.nonzero(act)[0]:
                P, h = self._pose(i, float(pp[i]), bld, OFF)
                q = [toS(P)]
                if h > 0.02:
                    cv2.fillPoly(shadow, [toS(P + (lx * h * 3.2, ly * h * 3.2))], int(255 * (1 - .55 * h)), L8, SH)
                cv2.fillPoly(img, q, Cl[i], AA, SH)
                cv2.fillPoly(aux, q, (mids[i], rids[i], 255 if h > .02 else 0), L8, SH)
        # life
        for j, it in enumerate(life):
            P, m, col, h = it[:4]
            rid = it[4] if len(it) > 4 else 2 + (j * 37) % 250
            q = [toS(P)]
            if h > 0:
                cv2.fillPoly(shadow, [toS(P + (lx * h, ly * h))], 235, L8, SH)
            cv2.fillPoly(img, q, col, AA, SH)
            cv2.fillPoly(aux, q, (m, rid, 255 if h > 0 else 0), L8, SH)
        stm = None
        if steam:
            stm = np.zeros((RH, RW), np.uint8)
            for P, a in steam:
                cv2.fillPoly(stm, [toS(P)], int(255 * a), AA, SH)
        return self._shade(img, aux, shadow, stm, cam, f, sweep, glow)

    def _shade(self, img, aux, shadow, stm, cam, f, sweep, glow):
        RW, RH = self.RW, self.RH
        z = cam[2] * self.px
        mid = aux[:, :, 0]
        key = (mid.astype(np.uint16) << 8) | aux[:, :, 1]
        e = np.zeros((RH, RW), np.uint8)
        e[:, 1:] = key[:, 1:] != key[:, :-1]
        e[1:, :] |= key[1:, :] != key[:-1, :]
        sig = .45 + .30 * z
        J = cv2.GaussianBlur(e * np.uint8(255), (0, 0), sig).astype(np.float32) * (sig * 2.2 / 255.)
        np.clip(J, 0, 1, out=J)
        gx = cv2.Sobel(J, cv2.CV_32F, 1, 0, ksize=3)
        gy = cv2.Sobel(J, cv2.CV_32F, 0, 1, ksize=3)
        bev = -(gx + gy) * self.lV[mid] * (.16 * sig)
        # stone texture
        n1 = self._warp(self.N1, cam, 1.15) * .6
        n2 = self._warp(self.N2, cam, .42)
        wf = min(1., max(0., (z - 1.3) / 1.2))
        if wf > 0:
            n1 = n1 * (1 - .4 * wf) + self._warp(self.N1, cam, 3.1) * (.35 * wf)
        gain = 1 + self.lA[mid] * n1 + self.lB[mid] * n2
        cc = self.lC[mid]
        if cc.any():
            gain += cc * np.sin(n2 * 7. + n1 * .5)
        jd = self.lJ[mid] * min(1., .45 + .28 * z)
        gain *= (1 - jd * J)
        gain += np.minimum(bev, 0) * 1.2
        out = img.astype(np.float32)
        out *= gain[..., None]
        out += (np.maximum(bev, 0) * 95)[..., None]
        # lapis: pyrite flecks
        lap = (mid == MAT['LAP']) & (n1 > 1.0)
        if lap.any():
            out[lap] = out[lap] * .35 + np.array([70, 170, 225], np.float32) * .65
        # raking light band + per-stone twinkle
        spec = self.lS[mid]
        if sweep is not None:
            pos, amp, ang = sweep
            d = (self.xx * math.cos(ang) + self.yy * math.sin(ang) * (RH / RW) - pos) / .11
            band = np.exp(-d * d) * amp
        else:
            band = 0
        tw = np.cos((aux[:, :, 1].astype(np.float32) * (7.0 * 2 * math.pi / 255.)) + f * (2 * math.pi / 75.))
        tw = np.clip(tw - .93, 0, 1) * (14.0 * .16)
        light = spec * (band * .55 + .10) + tw * (mid > 1) * (.35 + spec)
        out += light[..., None] * np.array([150, 215, 250], np.float32)
        # mother-of-pearl iridescence
        prl = mid == MAT['PRL']
        if prl.any():
            ph = 2.4 * n2[prl] + 1.2 * n1[prl] + f * .035 + self.xx[prl] * 9
            o = out[prl]
            o[:, 0] += 15 * np.cos(ph)
            o[:, 1] += 13 * np.cos(ph + 2.1)
            o[:, 2] += 15 * np.cos(ph + 4.2)
            out[prl] = o
        # shadows of stones in the air
        if shadow.any():
            sh = cv2.GaussianBlur(shadow, (0, 0), 2.2 + 1.6 * z).astype(np.float32) * (1 / 255.)
            sh *= (aux[:, :, 2] == 0)
            out *= (1 - .62 * sh)[..., None]
        if stm is not None:
            a = cv2.GaussianBlur(stm, (0, 0), 1. + 1.5 * z).astype(np.float32) * (.8 / 255.)
            out = out * (1 - a[..., None]) + np.array([232, 226, 220], np.float32) * a[..., None]
        # bloom
        small = cv2.resize(out, (RW // 4, RH // 4), interpolation=cv2.INTER_AREA)
        br = np.clip(small - 165, 0, None)
        br = cv2.GaussianBlur(br, (0, 0), 5 * self.px * 1.0) + .6 * cv2.GaussianBlur(br, (0, 0), 16 * self.px)
        out += cv2.resize(br, (RW, RH), interpolation=cv2.INTER_LINEAR) * (.55 + glow)
        out *= self.vig[..., None]
        return out

    def finish(self, out, f):
        if self.grain is None or self.grain[0].shape[:2] != out.shape[:2]:
            rg = np.random.default_rng(3)
            self.grain = [(rg.normal(0, 1.1, out.shape[:2] + (1,))).astype(np.float32) for _ in range(6)]
        out = out + self.grain[int(f) % len(self.grain)]
        # gentle filmic shoulder
        x = np.clip(out, 0, None) / 255.
        x = x * (1.06 + .0 * x) / (1 + .06 * x * x * 1.0)
        return np.clip(x * 255 + .5, 0, 255).astype(np.uint8)
