"""Painted glass: oil paint on stacked, backlit glass planes. Each frame is a repaint:
the previous paint is smeared along a flow field, then new strokes are laid toward the next shape.
Rendered as light transmitted through paint (thin = glowing, thick = dark), with per-layer parallax
and depth of field.  usage: python glass.py stills 0.5,2.0  |  python glass.py video out.mp4"""
import sys, os, subprocess
import numpy as np
from scipy import ndimage as ndi
from PIL import Image, ImageDraw

OUT = 1080
M = 48
N = OUT + 2 * M
rng = np.random.default_rng(7)
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
U, V = xx / N, yy / N
HOR = 0.585

def sm(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

def lin(c): return np.power(np.asarray(c, np.float32), 2.2)

def fnoise(scale, seed, octaves=3):
    r = np.random.default_rng(seed); out = np.zeros((N, N), np.float32); amp = 1.0; tot = 0
    for o in range(octaves):
        s = max(1, int(N / (scale / 2 ** o)))
        g = r.standard_normal((s + 3, s + 3)).astype(np.float32)
        z = ndi.zoom(g, (N + 2) / s, order=3)[:N, :N]
        out += amp * z; tot += amp; amp *= 0.5
    out /= tot; return (out - out.mean()) / (out.std() + 1e-6)

def polymask(pts, blur=1.5):
    im = Image.new('L', (N, N), 0); ImageDraw.Draw(im).polygon([(p[0] * N, p[1] * N) for p in pts], fill=255)
    a = np.asarray(im, np.float32) / 255
    return ndi.gaussian_filter(a, blur) if blur else a

def advect(arrs, vx, vy, steps=1.0):
    cy, cx = yy - vy * steps, xx - vx * steps
    return [ndi.map_coordinates(a, [cy, cx], order=1, mode='nearest') for a in arrs]

def lic(noise, dx, dy, L, n=14):
    acc = np.zeros_like(noise); wsum = 0
    for i in range(-n, n + 1):
        s = L * i / n; w = np.cos(0.5 * np.pi * i / (n + 1))
        acc += w * ndi.map_coordinates(noise, [yy + dy * s, xx + dx * s], order=1, mode='wrap'); wsum += w
    return acc / wsum

# ------------------------------------------------------------------ flow fields (curl of a stream function)
def stream(t, waves):
    psi = np.zeros((N, N), np.float32)
    for (kx, ky, w, ph, a) in waves:
        psi += a * np.sin(kx * U * 2 * np.pi + ky * V * 2 * np.pi + w * t + ph)
    return psi

SKY_W = [(1.3, 2.1, 0.7, 0.3, 1.0), (2.7, -1.6, -0.9, 1.7, 0.6), (0.6, 3.3, 0.5, 2.9, 0.7), (4.1, 0.9, 1.2, 0.4, 0.3)]
SEA_W = [(2.0, 3.6, 1.6, 0.0, 1.0), (3.5, -2.5, -1.3, 2.0, 0.7), (1.1, 5.2, 2.1, 1.0, 0.6), (6.0, 1.5, 2.5, 3.0, 0.35)]
MID_W = [(0.8, 1.7, 0.4, 0.0, 1.0), (2.2, 0.7, -0.5, 1.0, 0.5)]
MOON = (0.235, 0.235, 0.058)

def flow(kind, t):
    if kind == 'sky':
        psi = stream(t, SKY_W) * 26.0
        gy, gx = np.gradient(psi); vx, vy = gy, -gx
        vx = vx * 0.6 + 0.9  # drift right
        dxm, dym = U - MOON[0], V - MOON[1]; r2 = dxm ** 2 + dym ** 2
        swirl = 1.2 * np.exp(-r2 / 0.02)
        vx += -dym / np.sqrt(r2 + 1e-4) * swirl; vy += dxm / np.sqrt(r2 + 1e-4) * swirl
        return vx, vy
    if kind == 'sea':
        psi = stream(t, SEA_W) * 34.0
        gy, gx = np.gradient(psi); vx, vy = gy * 1.0, -gx * 0.55
        vx += 1.4
        return vx, vy
    psi = stream(t, MID_W) * 10.0
    gy, gx = np.gradient(psi); return gy * 0.3, -gx * 0.3

def unit(vx, vy):
    m = np.sqrt(vx * vx + vy * vy) + 1e-4; return vx / m, vy / m

# ------------------------------------------------------------------ precomputed stroke textures
print('precompute', flush=True)
TEX = {}
for kind, L in (('sky', 26), ('sea', 30), ('mid', 16)):
    vx, vy = flow(kind, 0.0)
    if kind == 'mid': vx, vy = np.zeros_like(vx) + 0.15, np.ones_like(vy)  # vertical strokes on rock / tower
    dx, dy = unit(vx, vy)
    bristle, masks = [], []
    for k in range(3):
        wn = ndi.gaussian_filter(rng.standard_normal((N, N)).astype(np.float32), 1.9)
        b = lic(wn, dx, dy, L * 0.5, 10); b = (b - b.mean()) / (b.std() + 1e-6)
        bristle.append(b)
        blobs = (ndi.gaussian_filter(rng.standard_normal((N, N)).astype(np.float32), 5) > 0.06).astype(np.float32)
        m = lic(blobs, dx, dy, L * 1.6, 12); m = sm(0.25, 0.6, m)
        masks.append(m)
    hue = [fnoise(160, 100 + k, 2) for k in range(3)]
    TEX[kind] = (bristle, masks, hue)

# ------------------------------------------------------------------ static shapes
cliff = polymask([(0.555, 0.70), (0.585, 0.60), (0.625, 0.52), (0.67, 0.475), (0.74, 0.455), (0.86, 0.448), (1.06, 0.452), (1.06, 0.84), (0.54, 0.84)], 2.0)
tx, tb, tt = 0.80, 0.455, 0.215
tower = polymask([(tx - 0.026, tb), (tx - 0.017, tt), (tx + 0.017, tt), (tx + 0.026, tb)], 1.2)
bands = tower * (sm(0.004, 0.0, np.abs(V - 0.39) - 0.016) + sm(0.004, 0.0, np.abs(V - 0.31) - 0.014))
lantern = polymask([(tx - 0.015, tt - 0.002), (tx - 0.015, tt - 0.036), (tx + 0.015, tt - 0.036), (tx + 0.015, tt - 0.002)], 1.5)
roof = polymask([(tx - 0.024, tt - 0.034), (tx, tt - 0.07), (tx + 0.024, tt - 0.034)], 1.2) + polymask([(tx - 0.026, tt + 0.002), (tx + 0.026, tt + 0.002), (tx + 0.026, tt - 0.006), (tx - 0.026, tt - 0.006)], 0.8)
LAMP = (tx, tt - 0.019)
moon_d = np.sqrt((U - MOON[0]) ** 2 + (V - MOON[1]) ** 2)
moon = sm(MOON[2] + 0.004, MOON[2] - 0.004, moon_d)
halo = np.exp(-np.maximum(moon_d - MOON[2], 0) / 0.05)
seaM = sm(HOR - 0.003, HOR + 0.006, V)
WX, WY = fnoise(60, 11, 2) * 3.0, fnoise(60, 12, 2) * 3.0
def warp(m): return ndi.map_coordinates(m, [yy + WY, xx + WX], order=1, mode='nearest')
cliff = warp(cliff); tower = warp(tower); bands = warp(bands); lantern = warp(lantern); roof = warp(roof)
cliffW = cliff
topedge = np.clip(cliff - ndi.gaussian_filter(cliff, 6) * 1.1, 0, 1) * sm(0.56, 0.48, V) * 2.0
topedge = np.clip(topedge, 0, 1)
CLIFFHUE = fnoise(90, 21, 3); SEAHUE = fnoise(220, 22, 2)

def sky_target():
    stops = [(0.0, (0.14, 0.16, 0.40)), (0.22, (0.30, 0.25, 0.52)), (0.40, (0.70, 0.40, 0.52)), (0.52, (0.98, 0.60, 0.36)), (0.60, (1.0, 0.80, 0.50))]
    col = np.zeros((N, N, 3), np.float32)
    for i in range(3):
        col[..., i] = np.interp(V, [s[0] for s in stops], [s[1][i] for s in stops])
    T = 1.25 - 0.55 * sm(0.25, 0.58, V)
    return col, T

def beam_mask(t):
    ph = (0.80 + 0.16 * t) * np.pi  # beam rotates: long sideways -> swinging toward viewer
    ang = np.pi + 0.09 - 0.05 * np.sin(ph)
    length = abs(np.cos(ph)) * 0.9 + 0.12
    half = 0.03 + 0.16 * abs(np.sin(ph)) ** 1.5
    dx, dy = U - LAMP[0], V - LAMP[1]
    r = np.sqrt(dx * dx + dy * dy) + 1e-5
    a = np.arctan2(dy, dx); da = np.angle(np.exp(1j * (a - ang)))
    m = sm(half, half * 0.35, np.abs(da)) * sm(length, length * 0.55, r) * sm(0.0, 0.03, r)
    return m, ang

def whale_shapes(t):
    rise = float(sm(0.25, 2.6, np.float32(t)))
    x0, x1, wl, H = 0.05, 0.50, 0.81, rise * 0.15
    s = np.linspace(0, 1, 80)
    sh = np.sin(np.pi * s ** 0.8) ** 0.7
    top = [(x0 + (x1 - x0) * si, wl - H * hi + 0.006) for si, hi in zip(s, sh)]
    body = polymask(top + [(x1, wl + 0.02), (x0, wl + 0.02)], 1.8) if H > 0.002 else np.zeros((N, N), np.float32)
    fin = polymask([(x0 + (x1 - x0) * 0.62, wl - H * 0.9), (x0 + (x1 - x0) * 0.73, wl - H * 1.45 - 0.012 * rise), (x0 + (x1 - x0) * 0.735, wl - H * 1.40 - 0.012 * rise), (x0 + (x1 - x0) * 0.79, wl - H * 0.68)], 1.5) if H > 0.01 else 0
    body = np.clip(body + fin, 0, 1) * sm(wl + 0.012, wl - 0.004, V)
    # rim of light along the wet back: band just under the top edge
    inner = ndi.gaussian_filter(body, 9)
    rim = np.clip(body - inner * 1.1, 0, 1) * sm(wl - 0.01, wl - 0.04, V) * 3.0
    return body, np.clip(rim, 0, 1), rise, (x0, x1, wl, H)

# ------------------------------------------------------------------ layer states
class Layer:
    def __init__(self, kind):
        self.kind = kind; self.P = np.zeros((N, N, 3), np.float32) + 1; self.T = np.zeros((N, N), np.float32)
    def step(self, t, f, Pt, Tt, region, rate, flowscale=1.0, extra=None, init=False):
        vx, vy = flow(self.kind, t)
        if extra is not None: vx, vy = vx + extra[0], vy + extra[1]
        out = advect([self.P[..., 0], self.P[..., 1], self.P[..., 2], self.T], vx * flowscale, vy * flowscale)
        self.P = np.stack(out[:3], -1); self.T = out[3]
        bristle, masks, hue = TEX[self.kind]
        k = f % 3; sx, sy = rng.integers(-60, 60, 2)
        mk = np.roll(masks[k], (sy, sx), (0, 1)); br = np.roll(bristle[(f + 1) % 3], (sx, sy), (0, 1))
        a = np.clip(rate * mk * region, 0, 1)
        jit = 0.10 * np.stack([hue[k], hue[(k + 1) % 3], hue[(k + 2) % 3]], -1)  # colour mixes per stroke
        Pn = np.clip(Pt * (1 + jit), 0, 1)
        if init:
            self.P = Pn.copy(); self.T = Tt * (1 + 0.28 * br); return
        self.P += (Pn - self.P) * a[..., None]
        self.T += (Tt * (1 + (0.14 if self.kind == 'mid' else 0.28) * br) - self.T) * a
        self.T = np.maximum(self.T, 0)

sky, mid, sea = Layer('sky'), Layer('mid'), Layer('sea')

def camp(t):
    e = float(sm(0, 3, np.float32(max(t, 0)))); e = 0.5 * e + 0.5 * e * e * (3 - 2 * e)
    return np.array([-64 * e, -22 * e]), e

def mid_in_sea(m, t):
    # where a mid-plane mask lands on the front plane for this frame's camera (so the front paint can be wiped there)
    cam, e = camp(t); c = N / 2
    sm_, ss = 1.0 + 0.03 * e, 1.0 + 0.06 * e
    shm, shs = cam * 0.55, cam * 1.0
    py = (yy - c + shs[1]) * ss / sm_ + c - shm[1]; px = (xx - c + shs[0]) * ss / sm_ + c - shm[0]
    return ndi.map_coordinates(m, [py, px], order=1, mode='nearest')

def paint_frame(t, f, warm=False):
    rate = 1.0 if warm else None
    # --- sky (back glass)
    col, T = sky_target()
    bm, ang = beam_mask(t)
    Tt = T * (1 - 0.93 * moon) * (1 - 0.45 * halo * (1 - moon))
    Pt = col * (1 - moon[..., None]) + np.array([1.0, 0.95, 0.82], np.float32) * moon[..., None]
    sky.step(t, f, Pt, Tt, np.ones((N, N), np.float32), rate or 0.42, init=warm)
    sky.T *= (1 - 0.82 * moon)                                   # keep the moon wiped clean
    sky.T *= (1 - 0.55 * bm)                                     # beam: paint wiped away with a rag
    sky.P = sky.P + (np.array([1.0, 0.92, 0.7], np.float32) - sky.P) * (0.25 * bm)[..., None]
    # --- mid glass: cliff + lighthouse
    Pt = np.zeros((N, N, 3), np.float32) + 1; Tt = np.zeros((N, N), np.float32)
    cz = sm(-0.8, 0.8, CLIFFHUE)[..., None]
    cl_col = np.array([0.34, 0.18, 0.24], np.float32) * (1 - cz) + np.array([0.50, 0.30, 0.18], np.float32) * cz
    Pt = Pt * (1 - cliffW[..., None]) + cl_col * cliffW[..., None]
    Pt = Pt + (np.array([0.98, 0.62, 0.35], np.float32) - Pt) * (0.8 * topedge)[..., None]
    Tt += cliffW * (1.9 + 0.4 * CLIFFHUE - 1.3 * topedge).clip(0.5, 3)
    outl = np.clip(ndi.gaussian_filter(ndi.maximum_filter(tower, 9), 2) - tower, 0, 1) * 0.6
    Pt = Pt * (1 - outl[..., None]) + np.array([0.3, 0.18, 0.2], np.float32) * outl[..., None]; Tt += outl * 1.6
    shade = tower * sm(tx - 0.004, tx + 0.02, U)
    tw = np.clip(tower - bands, 0, 1)
    Pt = Pt * (1 - tower[..., None]) + (np.array([0.96, 0.88, 0.74], np.float32) * tw[..., None] + np.array([0.75, 0.16, 0.12], np.float32) * bands[..., None])
    Tt = Tt * (1 - tower) + tw * (0.85 + 0.9 * shade) + bands * (1.4 + 0.6 * shade)
    roofm = np.clip(roof, 0, 1)
    Pt = Pt * (1 - roofm[..., None]) + np.array([0.18, 0.12, 0.12], np.float32) * roofm[..., None]
    Tt = Tt * (1 - roofm) + roofm * 3.0
    Tt *= (1 - lantern)
    region = np.clip(cliffW + tower + roofm + lantern + outl + 0.6, 0, 1)
    mid.step(t, f, Pt, Tt, region, rate or 0.35, 0.5, init=warm)
    mid.T *= (1 - 0.95 * lantern)
    # --- front glass: sea, whale, boat
    body, rim, rise, (x0, x1, wl, H) = whale_shapes(t)
    deep = np.array([0.15, 0.33, 0.46], np.float32); hz = np.array([0.72, 0.50, 0.52], np.float32)
    k = sm(HOR, HOR + 0.14, V)[..., None]
    Pt = hz * (1 - k) + deep * k
    tz = sm(0.3, 1.2, SEAHUE)[..., None]
    Pt = Pt * (1 - 0.6 * tz) + np.array([0.22, 0.48, 0.46], np.float32) * (0.6 * tz)
    Tt = (0.75 + 0.55 * sm(HOR, 1.0, V)) * seaM
    # crest strokes catch the sky light: thinner, warmer
    crest = sm(0.55, 0.9, np.roll(TEX['sea'][1][(f + 2) % 3], (int(t * 9), 0), (0, 1))) * seaM * sm(HOR + 0.02, HOR + 0.08, V)
    Pt = Pt + (np.array([0.95, 0.66, 0.45], np.float32) - Pt) * (0.7 * crest)[..., None]
    Tt = Tt * (1 - 0.55 * crest)
    # moon path on the water: wiped horizontal dabs
    path = np.exp(-((U - MOON[0]) / (0.028 + 0.07 * (V - HOR))) ** 2) * seaM * (TEX['sea'][1][f % 3] > 0.5)
    Tt *= (1 - 0.8 * path)
    Pt = Pt + (np.array([1.0, 0.9, 0.7], np.float32) - Pt) * (0.6 * path)[..., None]
    # whale paints itself up: dark thick paint with a thin glowing rim along the wet back
    wc = np.array([0.10, 0.11, 0.17], np.float32)
    Pt = Pt * (1 - body[..., None]) + wc * body[..., None]
    Tt = Tt * (1 - body) + body * 2.9
    Pt = Pt + (np.array([0.95, 0.80, 0.70], np.float32) - Pt) * (0.9 * rim)[..., None]
    Tt = Tt * (1 - 0.88 * rim)
    # foam churned around the waterline
    foam = np.exp(-((V - wl - 0.004) / 0.012) ** 2) * (sm(x0 - 0.10, x0 + 0.03, U) * sm(x1 + 0.12, x1 - 0.02, U)) * rise
    foam *= (TEX['sea'][0][f % 3] > 0.2)
    Tt *= (1 - 0.7 * foam); Pt = Pt + (np.array([0.95, 0.9, 0.85], np.float32) - Pt) * (0.6 * foam)[..., None]
    # boat
    bx, by = 0.40 + 0.012 * t, HOR + 0.012 + 0.003 * np.sin(t * 2.5)
    hull = polymask([(bx - 0.045, by - 0.012), (bx + 0.045, by - 0.012), (bx + 0.032, by + 0.008), (bx - 0.034, by + 0.008)], 1.0)
    sail = polymask([(bx - 0.004, by - 0.095), (bx - 0.04, by - 0.016), (bx - 0.004, by - 0.016)], 1.0) + polymask([(bx + 0.003, by - 0.09), (bx + 0.033, by - 0.016), (bx + 0.003, by - 0.016)], 1.0)
    mast = polymask([(bx - 0.0012, by - 0.1), (bx + 0.0012, by - 0.1), (bx + 0.0012, by - 0.012), (bx - 0.0012, by - 0.012)], 0.6)
    hull, sail, mast = warp(hull), warp(sail), warp(mast)
    Pt = Pt * (1 - hull[..., None]) + np.array([0.2, 0.1, 0.08], np.float32) * hull[..., None]; Tt = Tt * (1 - hull) + 3.2 * hull
    Pt = Pt * (1 - sail[..., None]) + np.array([1.0, 0.86, 0.62], np.float32) * sail[..., None]; Tt = Tt * (1 - sail) + 0.5 * sail
    Tt = Tt + 2.5 * mast
    cis = np.clip(mid_in_sea(cliffW, t) * 1.05, 0, 1) * (1 - np.clip(ndi.maximum_filter(body, 9), 0, 1))
    ring = np.clip(ndi.gaussian_filter(ndi.maximum_filter(cis, 15), 3) - cis, 0, 1) * seaM * (TEX['sea'][0][(f + 1) % 3] > -0.3)
    Tt = Tt * (1 - cis) * (1 - 0.75 * ring)
    Pt = Pt + (np.array([0.95, 0.85, 0.78], np.float32) - Pt) * (0.7 * ring)[..., None]
    region = np.clip(seaM + sail + mast + body, 0, 1)
    # paint near the whale is dragged upward as it rises
    lift = np.exp(-((U - (x0 + x1) / 2) / 0.22) ** 2) * np.exp(-((V - wl + H * 0.5) / 0.08) ** 2) * (2.5 * (rise > 0) * (1 - rise * 0.6))
    wr = 0.55 if not warm else 1.0
    sea.step(t, f, Pt, Tt, region, wr, 1.0, extra=(0, -lift), init=warm)
    # protect the boat / sail / whale rim from smearing away completely
    hold = np.clip(np.clip(hull + sail + mast, 0, 1) * 0.7 + body * 0.32 + rim * 0.4, 0, 0.8)
    sea.P += (Pt - sea.P) * hold[..., None]; sea.T += (Tt - sea.T) * hold
    keep = np.clip(sm(HOR - 0.012, HOR + 0.002, V) + ndi.maximum_filter(np.clip(hull + sail + mast, 0, 1), 5), 0, 1) * (1 - 0.97 * cis)
    sea.T *= keep
    sea.T *= (1 - 0.7 * path)
    return bm, ang

# ------------------------------------------------------------------ render
backlight = None
def light_table():
    r2 = (U - 0.5) ** 2 + (V - 0.45) ** 2
    b = (1.0 - 0.55 * r2 / 0.5) * (1 + 0.04 * fnoise(300, 3, 2))
    return lin([1.0, 0.93, 0.80]) * b[..., None]
backlight = light_table().astype(np.float32)
dust = (rng.random((N, N)) > 0.99985).astype(np.float32); dust = ndi.gaussian_filter(dust, 0.9) * 6
fibers = ndi.gaussian_filter((rng.random((N, N)) > 0.99996).astype(np.float32), (0.6, 8)) * 20

def transmit(layer):
    Pl = np.clip(lin(layer.P), 0.004, 1)
    return np.exp(np.log(Pl) * layer.T[..., None] * 1.15)

def view(img, shift, scale, blur):
    # parallax: each glass plane is offset/scaled by its distance from the camera; DOF by blur
    out = np.empty((OUT, OUT, img.shape[2]), np.float32)
    c = N / 2
    oy, ox = np.mgrid[0:OUT, 0:OUT].astype(np.float32)
    sy = (oy + M - c) / scale + c - shift[1]; sx = (ox + M - c) / scale + c - shift[0]
    for i in range(img.shape[2]):
        ch = ndi.gaussian_filter(img[..., i], blur) if blur > 0 else img[..., i]
        out[..., i] = ndi.map_coordinates(ch, [sy, sx], order=1, mode='nearest')
    return out

def sheen(T, shift, scale, strength):
    gy, gx = np.gradient(ndi.gaussian_filter(T, 1.0))
    s = np.clip(-gx * 0.6 - gy * 0.8, 0, None) * strength
    return view(s[..., None], shift, scale, 0)

def render(t, bm, ang):
    cam, e = camp(t)
    T0 = view(transmit(sky), cam * 0.25, 1.0 + 0.012 * e, 3.2)
    T1 = view(transmit(mid), cam * 0.55, 1.0 + 0.03 * e, 1.1)
    T2 = view(transmit(sea), cam * 1.0, 1.0 + 0.06 * e, 0.0)
    bl = view(backlight, cam * 0.1, 1.0, 0)
    img = bl * T0 * T1 * T2
    # beam: smeared streak of light (scattered glow) aligned with the lamp
    streak = view(np.stack([bm * (0.6 + 0.4 * sm(-1, 1.5, TEX['sky'][0][0]))], -1), cam * 0.55, 1.0 + 0.03 * e, 6)[..., 0]
    img += streak[..., None] * lin([1.0, 0.85, 0.55]) * 0.35 * T2
    # impasto sheen from a soft top light on the nearest glass
    img += sheen(sea.T, cam, 1.0 + 0.06 * e, 0.9)[..., :1] * lin([1.0, 0.85, 0.65]) * 0.25
    img += sheen(mid.T, cam * 0.55, 1.0 + 0.03 * e, 0.6)[..., :1] * lin([1.0, 0.85, 0.65]) * 0.15
    # dust and lint on the front glass
    img *= (1 - 0.6 * view(np.stack([np.clip(dust + fibers, 0, 1)], -1), cam * 1.25, 1.07, 0.6))
    # bloom / halation
    br = np.clip(img - 0.55, 0, None)
    img += ndi.gaussian_filter(br, (18, 18, 0)) * 0.55 + ndi.gaussian_filter(br, (60, 60, 0)) * 0.35
    lamp = np.exp(-(((np.arange(OUT)[None, :] - (LAMP[0] * N - M + cam[0] * 0.55)) ** 2 + (np.arange(OUT)[:, None] - (LAMP[1] * N - M + cam[1] * 0.55)) ** 2) / (2 * 14 ** 2)))
    img += lamp[..., None] * lin([1.0, 0.9, 0.6]) * (0.9 + 0.2 * np.sin(t * 9))
    # vignette, tone, grain
    oy, ox = np.mgrid[0:OUT, 0:OUT] / OUT
    img *= (1 - 0.55 * ((ox - 0.5) ** 2 + (oy - 0.48) ** 2))[..., None]
    img = img * 1.25
    img = img / (1 + img * 0.35)
    out = np.power(np.clip(img, 0, 1), 1 / 2.2)
    out += (rng.standard_normal((OUT, OUT, 1)) * 0.012).astype(np.float32)
    return (np.clip(out, 0, 1) * 255).astype(np.uint8)

def main():
    mode, arg = sys.argv[1], sys.argv[2]
    # warm-up: paint the plates and let the strokes settle before the clip starts
    for w in range(10):
        paint_frame(-0.3 + w * 0.03, 100 + w, warm=(w < 1))
    print('warm', flush=True)
    os.makedirs('../frames', exist_ok=True)
    if mode == 'stills':
        want = [float(x) for x in arg.split(',')]
        for f in range(90):
            t = f / 30
            bm, ang = paint_frame(t, f)
            if any(abs(t - w) < 1e-3 for w in want):
                Image.fromarray(render(t, bm, ang)).save(f'../frames/glass_{t:.2f}.png'); print('saved', t, flush=True)
            if t > max(want): break
    elif mode == 'pngs':
        for f in range(90):
            t = f / 30
            bm, ang = paint_frame(t, f)
            Image.fromarray(render(t, bm, ang)).save(f'../frames/g_{f:03d}.png', compress_level=3)
            if f % 10 == 0: print('frame', f, flush=True)
    else:
        keep = [int(k) for k in os.environ.get('KEEP', '').split(',') if k]
        ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{OUT}x{OUT}', '-r', '30', '-i', '-',
                               '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-threads', '2', arg], stdin=subprocess.PIPE)
        for f in range(90):
            t = f / 30
            bm, ang = paint_frame(t, f)
            fr = render(t, bm, ang)
            ff.stdin.write(fr.tobytes())
            if f in keep: Image.fromarray(fr).save(f'../frames/gkeep_{f}.png')
            if f % 10 == 0: print('frame', f, flush=True)
        ff.stdin.close(); ff.wait()

if __name__ == '__main__':
    main()
