"""Ink Bloom - fluid + particle-ink simulation and Beer-Lambert renderer.

One *cycle* = one picture (7 s = 8 beats).  Cycle-local time s=0 is the moment
the main drop hits the surface (4 frames before the bar line).

  python sim.py --cycle K --mode end      # simulate, save end-of-cycle ink state
  python sim.py --cycle K --mode render   # re-simulate (deterministic) + ghost of
                                          # cycle K-1, render clean frames to JPEG
"""
import os, sys, time, argparse
import numpy as np
import cv2
import numba as nb
import scipy.fft as sfft

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TMP = os.path.join(ROOT, "tmp")

W, H = 1440, 1920          # domain in "render pixels"
CELL = 4
NX, NY = W // CELL, H // CELL
FPS = 30
SUB = 2
DT = 1.0 / (FPS * SUB)
BEAT = 0.875
LEAD = 4.0 / 30.0
CYC = 7.0
NCYC = 4
FR_PER_CYC = 210
NFRAMES = NCYC * FR_PER_CYC

TA = LEAD + 2.0 * BEAT       # bloom (guided) starts
FORM_DUR = 1.25
FORM_DELAY = 0.65
T2 = 2 * BEAT                 # accent drop impact (LEAD before beat 2)
TA2 = T2 + 1.0
FORM2_DUR = 1.15
FORM2_DELAY = 0.28
REL = LEAD + 7 * BEAT         # control released
VZERO0, VZERO1 = 6.55, 6.93   # fluid brought to rest before next impact
GHOST_LIFE = 2.9

D_IND = 5.2                   # optical depth at picture density 1
D_VER = 2.4
K_IND = np.array([0.95, 1.00, 0.40], np.float32)
K_VER = np.array([0.07, 0.74, 1.16], np.float32)

ENTRY_X = [700.0, 742.0, 706.0, 722.0]
ENTRY2_X = [760.0, 560.0, 850.0, 690.0]
JET2_SCALE = [1.0, 1.0, 1.2, 1.5]


def srgb2lin(c):
    c = np.asarray(c, np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4).astype(np.float32)


def lin2srgb(c):
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(np.maximum(c, 1e-8), 1 / 2.4) - 0.055)


# ----------------------------------------------------------------------------
# numba kernels
@nb.njit(inline="always")
def _bil(a, gx, gy):
    ny, nx = a.shape
    if gx < 0.0:
        gx = 0.0
    elif gx > nx - 1.001:
        gx = nx - 1.001
    if gy < 0.0:
        gy = 0.0
    elif gy > ny - 1.001:
        gy = ny - 1.001
    ix = int(gx)
    iy = int(gy)
    fx = gx - ix
    fy = gy - iy
    return (a[iy, ix] * (1 - fx) + a[iy, ix + 1] * fx) * (1 - fy) + (a[iy + 1, ix] * (1 - fx) + a[iy + 1, ix + 1] * fx) * fy


@nb.njit(inline="always")
def _bilw(a, gx, gy):
    """bilinear, periodic."""
    ny, nx = a.shape
    ix = int(np.floor(gx))
    iy = int(np.floor(gy))
    fx = gx - ix
    fy = gy - iy
    ix0 = ix % nx
    iy0 = iy % ny
    ix1 = (ix0 + 1) % nx
    iy1 = (iy0 + 1) % ny
    return (a[iy0, ix0] * (1 - fx) + a[iy0, ix1] * fx) * (1 - fy) + (a[iy1, ix0] * (1 - fx) + a[iy1, ix1] * fx) * fy


@nb.njit(inline="always")
def _gain(z, dur, gmax, ghold):
    g = 0.0
    if z > 0.0:
        if z < 1.0:
            g = 30.0 * z * z / (dur * (1.0 - z) * (1.0 + 3.0 * z + 6.0 * z * z) + 1e-6)
            if g > gmax:
                g = gmax
        else:
            g = ghold
    return g


@nb.njit(parallel=True, fastmath=True, cache=True)
def k_advect(i0, i1, px, py, tx, ty, delay, loose, vsc, u, v, cu, cv_, n1x, n1y, n2x, n2y, dt, inv_cell, tloc, dur, gmax, ghold,
             ctrl_a, sink, a1, a2, o1x, o1y, o2x, o2y, sig, seed, w, h):
    """advect ink particles: fluid velocity (RK2) + procedural curl-noise turbulence
    + random walk (diffusion) + guiding relaxation toward the particle's target."""
    for i in nb.prange(i0, i1):
        x = px[i]
        y = py[i]
        gx = x * inv_cell - 0.5
        gy = y * inv_cell - 0.5
        ux = _bil(u, gx, gy)
        uy = _bil(v, gx, gy)
        mx = x + 0.5 * dt * ux
        my = y + 0.5 * dt * uy
        ux = _bil(u, mx * inv_cell - 0.5, my * inv_cell - 0.5)
        uy = _bil(v, mx * inv_cell - 0.5, my * inv_cell - 0.5)
        s = vsc[i]
        ux *= s
        uy *= s
        if a1 > 0.0 or a2 > 0.0:
            q1x = mx / 2.6 + o1x
            q1y = my / 2.6 + o1y
            q2x = mx / 0.9 + o2x
            q2y = my / 0.9 + o2y
            ux += a1 * _bilw(n1x, q1x, q1y) + a2 * _bilw(n2x, q2x, q2y)
            uy += a1 * _bilw(n1y, q1x, q1y) + a2 * _bilw(n2y, q2x, q2y)
        x += dt * ux
        y += dt * uy
        if sig > 0.0:
            hsh = np.uint32(i) * np.uint32(2654435761) + np.uint32(seed) * np.uint32(40503)
            acc_x = 0.0
            acc_y = 0.0
            for k in range(3):
                hsh ^= hsh >> np.uint32(15)
                hsh *= np.uint32(2246822519)
                hsh ^= hsh >> np.uint32(13)
                acc_x += (hsh & np.uint32(0xFFFF)) / 65535.0
                acc_y += ((hsh >> np.uint32(16)) & np.uint32(0xFFFF)) / 65535.0
                hsh *= np.uint32(3266489917)
            x += sig * (acc_x - 1.5) * 2.0
            y += sig * (acc_y - 1.5) * 2.0
        if ctrl_a > 0.0 and tx[i] > -1e5:
            lo = loose[i]
            z = (tloc - delay[i]) / dur
            # early in its flight a particle follows the smooth guide field (so real
            # small-scale mixing survives); late it condenses onto its own target
            be = (z - 0.30) / 0.55
            if be < 0.0:
                be = 0.0
            elif be > 1.0:
                be = 1.0
            be = be * be * (3.0 - 2.0 * be)
            if be < 1.0:
                x += dt * (1.0 - be) * _bil(cu, mx * inv_cell - 0.5, my * inv_cell - 0.5)
                y += dt * (1.0 - be) * _bil(cv_, mx * inv_cell - 0.5, my * inv_cell - 0.5)
            if z > 1.0:
                y += dt * sink * (1.0 - lo) * (1.0 - lo)     # loose ink is heavy: it weeps downward
            g = _gain(z, dur, gmax, ghold * lo) * ctrl_a * be
            if g > 0.0:
                k = 1.0 - np.exp(-g * dt)
                x += (tx[i] - x) * k
                y += (ty[i] - y) * k
        if x < 1.0:
            x = 1.0
        elif x > w - 2.0:
            x = w - 2.0
        if y < 1.0:
            y = 1.0
        elif y > h - 2.0:
            y = h - 2.0
        px[i] = x
        py[i] = y


@nb.njit(parallel=True, fastmath=True, cache=True)
def k_ctrl_splat(out, i0, i1, px, py, tx, ty, delay, loose, inv_cell, tloc, dur, gmax, ghold):
    """splat the guiding velocity (and weight) to the fluid grid. out: (nch, 3, NY, NX)."""
    nch = out.shape[0]
    ny = out.shape[2]
    nx = out.shape[3]
    n = i1 - i0
    for c in nb.prange(nch):
        a = i0 + (n * c) // nch
        b = i0 + (n * (c + 1)) // nch
        o = out[c]
        for i in range(a, b):
            if tx[i] < -1e5:
                continue
            gx = px[i] * inv_cell - 0.5
            gy = py[i] * inv_cell - 0.5
            if gx < 0.0 or gy < 0.0 or gx >= nx - 1.001 or gy >= ny - 1.001:
                continue
            lo = loose[i]
            g = _gain((tloc - delay[i]) / dur, dur, gmax, ghold * lo)
            cx = (tx[i] - px[i]) * g
            cy = (ty[i] - py[i]) * g
            ix = int(gx)
            iy = int(gy)
            fx = gx - ix
            fy = gy - iy
            w00 = (1 - fx) * (1 - fy)
            w10 = fx * (1 - fy)
            w01 = (1 - fx) * fy
            w11 = fx * fy
            o[0, iy, ix] += w00
            o[0, iy, ix + 1] += w10
            o[0, iy + 1, ix] += w01
            o[0, iy + 1, ix + 1] += w11
            o[1, iy, ix] += w00 * cx
            o[1, iy, ix + 1] += w10 * cx
            o[1, iy + 1, ix] += w01 * cx
            o[1, iy + 1, ix + 1] += w11 * cx
            o[2, iy, ix] += w00 * cy
            o[2, iy, ix + 1] += w10 * cy
            o[2, iy + 1, ix] += w01 * cy
            o[2, iy + 1, ix + 1] += w11 * cy


@nb.njit(parallel=True, fastmath=True, cache=True)
def k_splat_grid(out, i0, i1, px, py, inv_cell, wgt):
    """deterministic chunked splat of particle counts to the fluid grid. out: (4, NY, NX)."""
    nch = out.shape[0]
    ny = out.shape[1]
    nx = out.shape[2]
    n = i1 - i0
    for c in nb.prange(nch):
        a = i0 + (n * c) // nch
        b = i0 + (n * (c + 1)) // nch
        o = out[c]
        for i in range(a, b):
            gx = px[i] * inv_cell - 0.5
            gy = py[i] * inv_cell - 0.5
            if gx < 0.0 or gy < 0.0 or gx >= nx - 1.001 or gy >= ny - 1.001:
                continue
            ix = int(gx)
            iy = int(gy)
            fx = gx - ix
            fy = gy - iy
            o[iy, ix] += (1 - fx) * (1 - fy) * wgt
            o[iy, ix + 1] += fx * (1 - fy) * wgt
            o[iy + 1, ix] += (1 - fx) * fy * wgt
            o[iy + 1, ix + 1] += fx * fy * wgt


@nb.njit(parallel=True, fastmath=True, cache=True)
def k_splat_render(out, i0, i1, px, py, chan, mass, mscale, rs):
    """out: (nch, C, h, w). bilinear mass splat at render scale rs."""
    nch = out.shape[0]
    hh = out.shape[2]
    ww = out.shape[3]
    n = i1 - i0
    for c in nb.prange(nch):
        a = i0 + (n * c) // nch
        b = i0 + (n * (c + 1)) // nch
        o = out[c]
        for i in range(a, b):
            gx = px[i] * rs - 0.5
            gy = py[i] * rs - 0.5
            if gx < 0.0 or gy < 0.0 or gx >= ww - 1.001 or gy >= hh - 1.001:
                continue
            ix = int(gx)
            iy = int(gy)
            fx = gx - ix
            fy = gy - iy
            m = mass[i] * mscale
            oc = o[chan[i]]
            oc[iy, ix] += (1 - fx) * (1 - fy) * m
            oc[iy, ix + 1] += fx * (1 - fy) * m
            oc[iy + 1, ix] += (1 - fx) * fy * m
            oc[iy + 1, ix + 1] += fx * fy * m


# ----------------------------------------------------------------------------
class Fluid:
    """2-D incompressible solver, collocated grid, free-slip box, exact spectral
    (sine/cosine) projection, bicubic semi-Lagrangian advection, vorticity confinement."""

    def __init__(self):
        self.u = np.zeros((NY, NX), np.float32)   # px/s
        self.v = np.zeros((NY, NX), np.float32)
        p = np.arange(NX + 1, dtype=np.float64)
        q = np.arange(NY + 1, dtype=np.float64)
        self.kx = (np.pi * p / NX)[None, :]
        self.ky = (np.pi * q / NY)[:, None]
        k2 = self.kx ** 2 + self.ky ** 2
        k2[0, 0] = 1.0
        self.k2 = k2
        gx, gy = np.meshgrid(np.arange(NX, dtype=np.float32), np.arange(NY, dtype=np.float32))
        self.gx, self.gy = gx, gy

    def project(self, visc=0.0):
        a = sfft.dct(sfft.dst(self.u.astype(np.float64), type=2, axis=1), type=2, axis=0)
        b = sfft.dst(sfft.dct(self.v.astype(np.float64), type=2, axis=1), type=2, axis=0)
        A = np.zeros((NY + 1, NX + 1))
        B = np.zeros((NY + 1, NX + 1))
        A[:NY, 1:] = a
        B[1:, :NX] = b
        D = (self.kx * A + self.ky * B) / self.k2
        A -= self.kx * D
        B -= self.ky * D
        if visc > 0:
            f = np.exp(-visc * self.k2)
            A *= f
            B *= f
        self.u = sfft.idst(sfft.idct(A[:NY, 1:], type=2, axis=0), type=2, axis=1).astype(np.float32)
        self.v = sfft.idct(sfft.idst(B[1:, :NX], type=2, axis=0), type=2, axis=1).astype(np.float32)

    def advect(self, dt):
        """MacCormack (BFECC-style) semi-Lagrangian advection with a min/max limiter:
        far less numerical viscosity than plain SL, so vortices keep spinning."""
        k = dt / CELL
        R = lambda a, x, y, m=cv2.INTER_LINEAR: cv2.remap(a, x, y, m, borderMode=cv2.BORDER_REPLICATE)
        # RK2 backtrace
        hx = self.gx - self.u * (0.5 * k)
        hy = self.gy - self.v * (0.5 * k)
        um = R(self.u, hx, hy)
        vm = R(self.v, hx, hy)
        bx = self.gx - um * k
        by = self.gy - vm * k
        fx = self.gx + um * k
        fy = self.gy + vm * k
        ker = np.ones((3, 3), np.uint8)
        out = []
        for a in (self.u, self.v):
            a1 = R(a, bx, by)
            a2 = R(a1, fx, fy)
            an = a1 + 0.5 * (a - a2)
            lo = R(cv2.erode(a, ker), bx, by, cv2.INTER_NEAREST)
            hi = R(cv2.dilate(a, ker), bx, by, cv2.INTER_NEAREST)
            out.append(np.clip(an, lo, hi))
        self.u, self.v = out

    def confine(self, eps, dt):
        if eps <= 0:
            return
        w = np.gradient(self.v, axis=1) - np.gradient(self.u, axis=0)   # per cell
        aw = cv2.GaussianBlur(np.abs(w), (0, 0), 1.0)
        nx_ = np.gradient(aw, axis=1)
        ny_ = np.gradient(aw, axis=0)
        mag = np.sqrt(nx_ * nx_ + ny_ * ny_) + 1e-4
        nx_ /= mag
        ny_ /= mag
        self.u += eps * dt * (ny_ * w)
        self.v += eps * dt * (-nx_ * w)


def periodic_noise(n, seed, lo, hi):
    """tileable band-limited noise potential -> curl velocity (vx, vy), unit rms."""
    rng = np.random.default_rng(seed)
    f = np.fft.fftfreq(n) * n
    fx, fy = np.meshgrid(f, f)
    k = np.sqrt(fx ** 2 + fy ** 2)
    spec = (rng.standard_normal((n, n)) + 1j * rng.standard_normal((n, n))) * ((k >= lo) & (k <= hi)) / np.maximum(k, 1) ** 1.2
    psi = np.real(np.fft.ifft2(spec))
    vx = np.gradient(psi, axis=0)
    vy = -np.gradient(psi, axis=1)
    s = np.sqrt(np.mean(vx ** 2 + vy ** 2))
    return (vx / s).astype(np.float32), (vy / s).astype(np.float32)


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


# ----------------------------------------------------------------------------
def assign_targets(x, y, P, rng, c0, c1, nbins=2400):
    """Polar Knothe-Rosenblatt transport of the ink cloud onto density P.

    Angle-quantiles of the cloud (about its centroid c0) are matched to
    angle-quantiles of the picture (about c1), and inside each thin angular
    sector the radial order is preserved.  The map is monotone (ink streams never
    cross inside a sector), so the cloud opens outward like a bloom; the branch
    cut points straight up, along the stem."""
    n = len(x)
    ys, xs = np.nonzero(P > 1e-4)
    w = P[ys, xs].astype(np.float64)
    th = np.arctan2(xs + 0.5 - c1[0], -(ys + 0.5 - c1[1]))        # 0 = up, +-pi = down
    rr = np.hypot(xs + 0.5 - c1[0], ys + 0.5 - c1[1])
    tb = np.minimum(((th + np.pi) / (2 * np.pi) * nbins).astype(np.int64), nbins - 1)
    order_p = np.lexsort((rr, tb))
    cdf = np.cumsum(w[order_p])
    cdf /= cdf[-1]
    uq = (np.arange(n) + rng.random(n)) / n
    idx = order_p[np.searchsorted(cdf, uq).clip(0, len(cdf) - 1)]
    tcol = tb[idx]
    tpx = xs[idx]
    tpy = ys[idx]
    # dithered sort keys: breaks the lattice / moire of an exact monotone map
    pth = np.arctan2(x - c0[0], -(y - c0[1])) + rng.normal(0, 3.0 * 2 * np.pi / nbins, n)
    prr = np.hypot(x - c0[0], y - c0[1]) * (1 + 0.05 * rng.standard_normal(n)) + 2.5 * rng.standard_normal(n)
    perm = np.argsort(pth, kind="stable")
    idx2 = np.lexsort((prr[perm], tcol))
    order = perm[idx2]
    tx = np.empty(n, np.float32)
    ty = np.empty(n, np.float32)
    tx[order] = tpx + rng.random(n).astype(np.float32)
    ty[order] = tpy + rng.random(n).astype(np.float32)
    return tx, ty


# ----------------------------------------------------------------------------
class Renderer:
    def __init__(self, rs):
        self.rs = rs
        self.w = int(W * rs)
        self.h = int(H * rs)
        yy, xx = np.mgrid[0:self.h, 0:self.w].astype(np.float32)
        xx = (xx + 0.5) / rs
        yy = (yy + 0.5) / rs
        r = np.sqrt(((xx - 720) / 1250.0) ** 2 + ((yy - 830) / 1500.0) ** 2)
        t = smooth(0.0, 1.0, r)[..., None]
        c0 = srgb2lin(np.array([255, 245, 226]) / 255.0)
        c1 = srgb2lin(np.array([246, 226, 194]) / 255.0)
        self.bg = (c0 * (1 - t) + c1 * t).astype(np.float32)
        self.nch = nb.get_num_threads()
        self.buf = np.zeros((self.nch, 6, self.h, self.w), np.float32)

    def clear(self):
        self.buf[:] = 0

    def splat(self, i0, i1, px, py, chan, mass, mscale):
        if i1 > i0 and mscale > 0:
            k_splat_render(self.buf, i0, i1, px, py, chan, mass, np.float32(mscale * self.rs * self.rs), np.float32(self.rs))

    def image(self):
        rs = self.rs
        b = self.buf.sum(0) if self.nch > 1 else self.buf[0]
        od = []
        for c in range(2):
            sh = b[0 + c]
            s0 = cv2.GaussianBlur(sh, (0, 0), PRM["RBLUR"] * rs + 0.25)
            s1 = cv2.GaussianBlur(sh, (0, 0), 2.6 * rs)
            wgt = np.clip(1.0 - s1 / 0.35, 0.0, 1.0) ** 2
            s = s0 + (s1 - s0) * wgt
            s += cv2.GaussianBlur(b[2 + c], (0, 0), 4.5 * rs)
            # far layer blurred at reduced resolution
            sm = cv2.resize(b[4 + c], (self.w // 4, self.h // 4), interpolation=cv2.INTER_AREA)
            sm = cv2.GaussianBlur(sm, (0, 0), 13.0 * rs / 4)
            s += cv2.resize(sm, (self.w, self.h), interpolation=cv2.INTER_LINEAR)
            od.append(s)
        tau = od[0][..., None] * K_IND + od[1][..., None] * K_VER
        T = np.exp(-tau)
        # soft volumetric shadow: light dims a little around dense ink
        tot = cv2.resize(od[0] + od[1], (self.w // 8, self.h // 8), interpolation=cv2.INTER_AREA)
        tot = cv2.GaussianBlur(np.minimum(tot, 4.0), (0, 0), 46.0 * rs / 8)
        shade = np.exp(-0.05 * cv2.resize(tot, (self.w, self.h), interpolation=cv2.INTER_LINEAR))[..., None]
        img = self.bg * shade * T
        # halation / lens bloom: bright backlight bleeds over ink edges
        sm = cv2.resize(img, (self.w // 4, self.h // 4), interpolation=cv2.INTER_AREA)
        g1 = cv2.resize(cv2.GaussianBlur(sm, (0, 0), 9.0 * rs / 4), (self.w, self.h), interpolation=cv2.INTER_LINEAR)
        g2 = cv2.resize(cv2.GaussianBlur(sm, (0, 0), 40.0 * rs / 4), (self.w, self.h), interpolation=cv2.INTER_LINEAR)
        img = img * 0.80 + g1 * 0.13 + g2 * 0.07
        out = lin2srgb(np.clip(img, 0, 1))
        return (out * 255.0 + 0.5).astype(np.uint8)


# ----------------------------------------------------------------------------
PRM = dict(
    R1=34.0, G1=800.0, JET1=26000.0, JSIG1=40.0, JDUR1=0.20,
    R2=22.0, G2=800.0, JET2=16000.0, JSIG2=28.0, JDUR2=0.18,
    FEED=0.38, BURST=260.0, CSIG=9.0, SINK=20.0, A2H=0.10,
    VISC=0.002, CONF=2.2, DRAG0=0.10, DRAG1=1.4, DRAGR=0.8,
    KAPPA=3.0, STIR_H=26.0, STIR_R=60.0,
    TURB_FALL=7.0, TURB_FORM=60.0, TURB_HOLD=24.0, TURB_REL=26.0, TURB_GHOST=38.0,
    GMAX=14.0, GHOLD=3.4, LOOSE_FRAC=0.26, STEM_Q=0.035, STEM_FADE=1.0,
    IMPULSE=110.0, MARBLE=0.0, BSIG=2.0, RBLUR=1.4,
)


def marble_field(seed):
    from pictures import fbm
    ph = (fbm(seed, 240, 3) * 5.0 + fbm(seed + 1, 70, 3) * 1.3) * 2 * np.pi
    return (0.5 + 0.5 * np.sin(ph)).astype(np.float32)


def run(cycle, mode, rs=1.0, n1=5_000_000, n2=1_000_000, f0=0, f1=FR_PER_CYC, tag="", pic_override=None, save_every=1):
    from pictures import PICTURES, NAMES
    Q = PRM
    t_start = time.time()
    rng = np.random.default_rng(1000 + cycle)
    pic = pic_override if pic_override is not None else cycle
    P = PICTURES[pic]().astype(np.float32)
    P_ind, P_ver = P[0], P[1]
    P_ind = P_ind * (1.0 - Q["MARBLE"] * marble_field(300 + pic) ** 1.5)
    N = n1 + n2
    px = np.zeros(N, np.float32)
    py = np.zeros(N, np.float32)
    tx = np.full(N, -1e6, np.float32)
    ty = np.full(N, -1e6, np.float32)
    delay = np.zeros(N, np.float32)
    lay = rng.choice(3, size=N, p=[0.74, 0.20, 0.06]).astype(np.uint8)
    col = np.zeros(N, np.uint8)
    col[n1:] = 1
    chan = (lay * 2 + col).astype(np.uint8)
    vsc = np.ones(N, np.float32)
    vsc[lay == 1] = 0.95 + 0.05 * rng.random((lay == 1).sum())
    vsc[lay == 2] = 0.88 + 0.10 * rng.random((lay == 2).sum())
    loose = (0.7 + 0.6 * rng.random(N)).astype(np.float32)
    lm = rng.random(N) < Q["LOOSE_FRAC"]
    loose[lm] = 0.05 + 0.5 * rng.random(int(lm.sum())).astype(np.float32)
    mass = np.empty(N, np.float32)
    mass[:n1] = D_IND * P_ind.sum() / n1
    mass[n1:] = D_VER * P_ver.sum() / n2
    free1 = None
    free2 = None

    def spawn(i0, i1, x0, rx, ry):
        """main blob (first 62%) + a trailing feed released over the next 0.45 s
        (index order = release order) which becomes the stem / wake thread."""
        n = i1 - i0
        nb0 = int(n * (1.0 - Q["FEED"]))
        r = np.sqrt(rng.random(n))
        a = rng.random(n) * 2 * np.pi
        px[i0:i1] = x0 + rx * r * np.cos(a)
        py[i0:i1] = np.maximum(4 + ry + ry * r * np.sin(a), 2.0)
        px[i0 + nb0:i1] = x0 + 0.45 * rx * r[nb0:] * np.cos(a[nb0:])
        py[i0 + nb0:i1] = 3.0 + 0.5 * ry * (1 + r[nb0:] * np.sin(a[nb0:]))

    def released(n, t):
        nb0 = int(n * (1.0 - Q["FEED"]))
        return int(nb0 + (n - nb0) * min(1.0, max(0.0, t / 0.45)))

    x0a = ENTRY_X[cycle]
    x0b = ENTRY2_X[cycle]
    spawn(0, n1, x0a, Q["R1"], Q["R1"])
    na1 = released(n1, 0.0)
    na2 = 0
    fl = Fluid()
    grid = np.zeros((4, NY, NX), np.float32)
    cgrid = np.zeros((4, 3, NY, NX), np.float32)
    gcu = np.zeros((NY, NX), np.float32)
    gcv = np.zeros((NY, NX), np.float32)
    ghost = None
    if mode == "render":
        gp = os.path.join(TMP, "state", f"end_c{(cycle - 1) % NCYC}{tag}.npz")
        if os.path.exists(gp):
            z = np.load(gp)
            ghost = dict(px=z["px"].copy(), py=z["py"].copy(), chan=z["chan"], mass=z["mass"], vsc=z["vsc"])
            print("ghost loaded", len(ghost["px"]), flush=True)
        ren = Renderer(rs)
        fdir = os.path.join(TMP, "frames" + tag)
        vdir = os.path.join(TMP, "vel" + tag)
        os.makedirs(fdir, exist_ok=True)
        os.makedirs(vdir, exist_ok=True)
    n1x, n1y = periodic_noise(256, 5, 2, 6)
    n2x, n2y = periodic_noise(256, 6, 3, 10)
    gxs = (fl.gx + 0.5)
    gys = (fl.gy + 0.5)
    # slow "breathing" eddies of the water during hold / release
    srng = np.random.default_rng(77 + cycle)
    modes = [(srng.uniform(1.0, 3.0) * np.pi / NX * srng.choice([-1, 1]), srng.uniform(1.2, 4.0) * np.pi / NY * srng.choice([-1, 1]),
              srng.uniform(0, 6.28), srng.uniform(0.5, 1.2) * srng.choice([-1, 1])) for _ in range(7)]

    def stir(s):
        psi = np.zeros((NY, NX), np.float32)
        for kx, ky, ph, om in modes:
            psi += np.sin(kx * gxs + ky * gys + ph + om * s)
        sx = np.gradient(psi, axis=0)
        sy = -np.gradient(psi, axis=1)
        nrm = np.sqrt(np.mean(sx * sx + sy * sy)) + 1e-9
        return sx / nrm, sy / nrm

    def jet(xc, yc, sig, amp):
        return amp * np.exp(-(((gxs * CELL - xc) ** 2 + (gys * CELL - yc) ** 2) / (2 * sig * sig)))

    def dissolve_impulse():
        drng = np.random.default_rng(500 + cycle)
        psi = np.zeros((NY, NX), np.float32)
        for k in range(18):
            xc = drng.uniform(300, 1140)
            yc = drng.uniform(640, 1520)
            sg = drng.uniform(45, 110)
            amp = drng.choice([-1, 1]) * drng.uniform(0.6, 1.0) * sg
            psi += amp * np.exp(-(((gxs * CELL - xc) ** 2 + (gys * CELL - yc) ** 2) / (2 * sg * sg)))
        fl.u += np.gradient(psi, axis=0) / CELL * Q["IMPULSE"]
        fl.v += -np.gradient(psi, axis=1) / CELL * Q["IMPULSE"]

    def burst(xc0, yc0, rad, amp, seed):
        """the ring goes unstable: a puff of small random vortices where the ink is."""
        if amp <= 0:
            return
        drng = np.random.default_rng(seed)
        psi = np.zeros((NY, NX), np.float32)
        for k in range(14):
            ang = drng.uniform(0, 6.283)
            rr = rad * np.sqrt(drng.random())
            xc = xc0 + rr * np.cos(ang)
            yc = yc0 + rr * np.sin(ang)
            sg = drng.uniform(22, 60)
            a_ = drng.choice([-1, 1]) * drng.uniform(0.6, 1.0) * sg
            psi += a_ * np.exp(-(((gxs * CELL - xc) ** 2 + (gys * CELL - yc) ** 2) / (2 * sg * sg)))
        fl.u += np.gradient(psi, axis=0) / CELL * amp
        fl.v += -np.gradient(psi, axis=1) / CELL * amp

    def do_assign(i0, i1, Pt, t_a, form_delay, dens, seed):
        x = px[i0:i1]
        y = py[i0:i1]
        thr = np.quantile(y[::50], Q["STEM_Q"])
        selm = y > thr
        sel = np.nonzero(selm)[0]
        mcx, mcy = float(np.mean(x[sel][::20])), float(np.mean(y[sel][::20]))
        yy_, xx_ = np.nonzero(Pt > 0.05)
        ww_ = Pt[yy_, xx_]
        c1 = (float((xx_ * ww_).sum() / ww_.sum()), float((yy_ * ww_).sum() / ww_.sum()))
        txs, tys = assign_targets(x[sel], y[sel], Pt, rng, (mcx, mcy), c1)
        d = np.hypot(txs - mcx, tys - mcy)
        d /= np.quantile(d[::50], 0.98)
        nz = cv2.GaussianBlur(np.random.default_rng(seed).random((H // 8, W // 8)).astype(np.float32), (0, 0), 9)
        nz = (nz - nz.min()) / (nz.max() - nz.min())
        nzv = nz[(tys / 8).astype(np.int32).clip(0, H // 8 - 1), (txs / 8).astype(np.int32).clip(0, W // 8 - 1)]
        g = sel + i0
        dl = form_delay * np.clip(0.45 * d + 0.75 * (nzv - 0.15) , 0, 1)
        dl += (lay[g] == 1) * 0.05 + (lay[g] == 2) * 0.10
        delay[g] = t_a + dl
        jit = np.where(lay[g] == 0, 1.3, np.where(lay[g] == 1, 5.0, 12.0)).astype(np.float32)
        jit *= (1.0 + 2.0 * (loose[g] < 0.6))
        tx[g] = txs + jit * rng.standard_normal(len(sel)).astype(np.float32)
        ty[g] = tys + jit * rng.standard_normal(len(sel)).astype(np.float32)
        mass[i0:i1] = dens * Pt.sum() / len(sel)
        print(f"c{cycle} assigned [{i0}:{i1}] head centre ({mcx:.0f},{mcy:.0f}) "
              f"y-range {np.quantile(y[::50], 0.05):.0f}..{np.quantile(y[::50], 0.99):.0f} "
              f"x-range {np.quantile(x[::50], 0.01):.0f}..{np.quantile(x[::50], 0.99):.0f}  {time.time() - t_start:.1f}s", flush=True)
        return np.nonzero(~selm)[0] + i0

    assigned1 = assigned2 = spawned2 = impulse_done = False
    nstep = FR_PER_CYC * SUB
    inv_cell = np.float32(1.0 / CELL)
    f32 = np.float32
    tl = time.time()
    for step in range(nstep + 1):
        s = step * DT
        fi = step // SUB
        # ------------------------------------------------ render at frame boundaries
        if step % SUB == 0 and fi < FR_PER_CYC and mode == "render" and f0 <= fi < f1 and (fi % save_every == 0):
            gframe = (cycle * FR_PER_CYC - 4 + fi) % NFRAMES
            ren.clear()
            ren.splat(0, na1, px, py, chan, mass, 1.0)
            ren.splat(n1, n1 + na2, px, py, chan, mass, 1.0)
            if ghost is not None and s < GHOST_LIFE:
                gf = (1.0 - smooth(0.2, GHOST_LIFE, s)) ** 1.6
                ren.splat(0, len(ghost["px"]), ghost["px"], ghost["py"], ghost["chan"], ghost["mass"], gf)
            img = ren.image()
            cv2.imwrite(os.path.join(fdir, f"{gframe:04d}.jpg"), img[:, :, ::-1],
                        [cv2.IMWRITE_JPEG_QUALITY, 96, cv2.IMWRITE_JPEG_SAMPLING_FACTOR, cv2.IMWRITE_JPEG_SAMPLING_FACTOR_444])
            np.save(os.path.join(vdir, f"{gframe:04d}.npy"),
                    np.stack([cv2.resize(fl.u, (NX // 2, NY // 2), interpolation=cv2.INTER_AREA),
                              cv2.resize(fl.v, (NX // 2, NY // 2), interpolation=cv2.INTER_AREA)]).astype(np.float16))
            if fi % 15 == 0:
                print(f"c{cycle} frame {fi} (g{gframe}) s={s:.2f} vmax={np.abs(fl.v).max():.0f} vrms_mid={np.sqrt(np.mean(fl.u[150:380, 60:300] ** 2 + fl.v[150:380, 60:300] ** 2)):.1f} {time.time() - tl:.1f}s", flush=True)
                tl = time.time()
        if step == nstep or (mode == "render" and fi >= f1):
            break
        # ------------------------------------------------ events
        if not spawned2 and s >= T2 - 1e-6:
            spawn(n1, N, x0b, Q["R2"], Q["R2"])
            spawned2 = True
        na1 = released(n1, s)
        na2 = released(n2, s - T2) if spawned2 else 0
        if not impulse_done and s >= LEAD - 1e-6:
            dissolve_impulse()
            impulse_done = True
        if not assigned1 and s >= TA - 1e-6:
            free1 = do_assign(0, n1, P_ind, TA, FORM_DELAY, D_IND, 900 + cycle)
            assigned1 = True
            burst(float(np.mean(px[:n1:50])), float(np.mean(py[:n1:50])), 170.0, Q["BURST"], 600 + cycle)
        if not assigned2 and s >= TA2 - 1e-6:
            free2 = do_assign(n1, N, P_ver, TA2, FORM2_DELAY, D_VER, 950 + cycle)
            assigned2 = True
            burst(float(np.mean(px[n1::50])), float(np.mean(py[n1::50])), 90.0, Q["BURST"] * 0.6, 650 + cycle)
        if step % SUB == 0 and Q["STEM_FADE"] > 0:
            if free1 is not None:
                mass[free1] *= np.exp(-Q["STEM_FADE"] / FPS)
            if free2 is not None:
                mass[free2] *= np.exp(-Q["STEM_FADE"] / FPS)
        # ------------------------------------------------ fluid forces
        g1 = Q["G1"] * (1.0 - smooth(TA - 0.3, TA + 0.3, s))
        g2 = Q["G2"] * (1.0 - smooth(TA2 - 0.25, TA2 + 0.25, s)) if spawned2 else 0.0
        if g1 > 1.0:
            grid[:] = 0
            k_splat_grid(grid, 0, na1, px, py, inv_cell, f32(1.0 / n1 * (np.pi * Q["R1"] ** 2 / CELL ** 2)))
            fl.v += DT * g1 * cv2.GaussianBlur(grid.sum(0), (0, 0), Q["BSIG"])
        if g2 > 1.0:
            grid[:] = 0
            k_splat_grid(grid, n1, n1 + na2, px, py, inv_cell, f32(1.0 / n2 * (np.pi * Q["R2"] ** 2 / CELL ** 2)))
            fl.v += DT * g2 * cv2.GaussianBlur(grid.sum(0), (0, 0), Q["BSIG"] * 0.7)
        if s < Q["JDUR1"]:
            fl.v += DT * jet(x0a, 10.0 + Q["R1"], Q["JSIG1"], Q["JET1"])
        if T2 <= s < T2 + Q["JDUR2"]:
            fl.v += DT * jet(x0b, 10.0 + Q["R2"], Q["JSIG2"], Q["JET2"] * JET2_SCALE[cycle])
        # drag schedule (momentum attenuation while the picture forms / holds)
        lam = Q["DRAG0"] + (Q["DRAG1"] - Q["DRAG0"]) * smooth(TA + 0.1, TA + 1.2, s) + (Q["DRAGR"] - Q["DRAG1"]) * smooth(REL - 0.2, REL + 0.3, s)
        # slow breathing eddies during hold / release
        st_amp = Q["STIR_H"] * smooth(TA + 0.5, TA + 1.7, s) + (Q["STIR_R"] - Q["STIR_H"]) * smooth(REL - 0.3, REL + 0.3, s)
        if st_amp > 0:
            sx, sy = stir(s)
            fl.u += DT * lam * st_amp * sx
            fl.v += DT * lam * st_amp * sy
        # the guided ink drags the water with it (two-way coupling of the guide)
        ghold = Q["GHOLD"] * (1.0 - smooth(REL - 0.25, REL + 0.35, s))
        gcu[:] = 0
        gcv[:] = 0
        if assigned1 and s < TA2 + FORM2_DELAY + FORM_DUR + 0.3:
            cgrid[:] = 0
            k_ctrl_splat(cgrid, 0, n1 + na2, px, py, tx, ty, delay, loose, inv_cell, f32(s), f32(FORM_DUR), f32(Q["GMAX"]), f32(ghold))
            cg = cgrid.sum(0)
            wsum = cv2.GaussianBlur(cg[0], (0, 0), 2.0)
            ucx = cv2.GaussianBlur(cg[1], (0, 0), 2.0) / (wsum + 1e-3)
            ucy = cv2.GaussianBlur(cg[2], (0, 0), 2.0) / (wsum + 1e-3)
            wgt = wsum / (wsum + 0.02 * n1 / 60000.0)
            kk = (1.0 - np.exp(-Q["KAPPA"] * DT)) * wgt
            fl.u += kk * ucx
            fl.v += kk * ucy
            wsb = cv2.GaussianBlur(cg[0], (0, 0), Q["CSIG"])
            gcu[:] = cv2.GaussianBlur(cg[1], (0, 0), Q["CSIG"]) / (wsb + 1e-3 * n1 / 1.5e6)
            gcv[:] = cv2.GaussianBlur(cg[2], (0, 0), Q["CSIG"]) / (wsb + 1e-3 * n1 / 1.5e6)
        fl.confine(Q["CONF"] * (1.0 - 0.6 * smooth(TA, TA + 1.5, s)), DT)
        fl.advect(DT)
        damp = np.exp(-lam * DT)
        if s >= VZERO0:
            damp *= max(0.0, 1.0 - DT / max(VZERO1 - s, DT))
        fl.u *= damp
        fl.v *= damp
        fl.project(visc=Q["VISC"])
        # ------------------------------------------------ particles
        tb = Q["TURB_FALL"] + (Q["TURB_FORM"] - Q["TURB_FALL"]) * smooth(TA - 0.1, TA + 0.3, s) \
            + (Q["TURB_HOLD"] - Q["TURB_FORM"]) * smooth(TA + 0.5, TA + 1.7, s) \
            + (Q["TURB_REL"] - Q["TURB_HOLD"]) * smooth(REL - 0.2, REL + 0.5, s)
        sig = 0.25 * smooth(REL, REL + 0.5, s)
        for (i0_, i1_) in ((0, na1), (n1, n1 + na2)):
            if i1_ > i0_:
                k_advect(i0_, i1_, px, py, tx, ty, delay, loose, vsc, fl.u, fl.v, gcu, gcv, n1x, n1y, n2x, n2y, f32(DT), inv_cell,
                         f32(s), f32(FORM_DUR), f32(Q["GMAX"]), f32(ghold), f32(1.0), f32(Q["SINK"]),
                         f32(tb), f32(tb * (0.6 - (0.6 - Q["A2H"]) * smooth(TA + 0.5, TA + 1.7, s) + (0.6 - Q["A2H"]) * smooth(REL - 0.2, REL + 0.5, s))), f32(s * 9.0), f32(s * 5.0), f32(-s * 14.0), f32(s * 11.0), f32(sig), step, W, H)
        if ghost is not None and s < GHOST_LIFE:
            tg = Q["TURB_REL"] + (Q["TURB_GHOST"] - Q["TURB_REL"]) * smooth(LEAD, LEAD + 0.6, s)
            sg = s + CYC
            sigg = 0.25 + 0.55 * smooth(LEAD, LEAD + 1.5, s)
            gpx = ghost["px"]
            k_advect(0, len(gpx), gpx, ghost["py"], gpx, gpx, gpx, gpx, ghost["vsc"], fl.u, fl.v, gcu, gcv, n1x, n1y, n2x, n2y, f32(DT), inv_cell,
                     f32(s), f32(1.0), f32(0.0), f32(0.0), f32(0.0), f32(0.0),
                     f32(tg), f32(tg * 0.38), f32(sg * 9.0), f32(sg * 5.0), f32(-sg * 14.0), f32(sg * 11.0), f32(sigg), step + 7777, W, H)
    if mode == "end":
        os.makedirs(os.path.join(TMP, "state"), exist_ok=True)
        np.savez(os.path.join(TMP, "state", f"end_c{cycle}{tag}.npz"), px=px, py=py, chan=chan, mass=mass, vsc=vsc)
    print(f"cycle {cycle} {mode} done in {time.time() - t_start:.1f}s", flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--cycle", type=int, default=0)
    ap.add_argument("--mode", default="render")
    ap.add_argument("--rs", type=float, default=1.0)
    ap.add_argument("--n1", type=float, default=5e6)
    ap.add_argument("--n2", type=float, default=1e6)
    ap.add_argument("--f0", type=int, default=0)
    ap.add_argument("--f1", type=int, default=FR_PER_CYC)
    ap.add_argument("--every", type=int, default=1)
    ap.add_argument("--tag", default="")
    ap.add_argument("--pic", type=int, default=None)
    ap.add_argument("--set", nargs="*", default=[])
    a = ap.parse_args()
    for kv in a.set:
        k, v = kv.split("=")
        PRM[k] = float(v)
    sys.path.insert(0, HERE)
    run(a.cycle, a.mode, a.rs, int(a.n1), int(a.n2), a.f0, a.f1, a.tag, a.pic, a.every)
