"""Finishing pass: clean simulation frames -> suspended motes, bubbles, light shimmer,
lens softness, chromatic fringe, vignette, grain -> raw RGB to ffmpeg.

  python finish.py vertical OUT.mp4 --crf 16 [--audio a.wav] [--maxrate 12M --bufsize 24M]
  python finish.py square   OUT.mp4 ...
  python finish.py vertical --still 131 out.png      (single finished frame)
"""
import os, sys, argparse, subprocess
import numpy as np
import cv2

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TMP = os.path.join(ROOT, "tmp")
sys.path.insert(0, HERE)
from events import *

W, H = 1440, 1920
SQ_Y0 = 250          # square framing: 1440x1440 window of the tank, scaled to 1080


# ---------------------------------------------------------------- motes
def simulate_motes(n=300, seed=11, fdir="frames"):
    """suspended particles: born/die on a 28 s periodic schedule, advected by the saved
    fluid velocity (time wraps), so the field of motes loops exactly."""
    cache = os.path.join(TMP, "motes.npz")
    if os.path.exists(cache):
        z = np.load(cache)
        return z["pos"], z["alpha"], z["rad"], z["sign"]
    rng = np.random.default_rng(seed)
    birth = rng.uniform(0, T, n)
    life = rng.uniform(7.0, 13.0, n)
    p0 = np.stack([rng.uniform(120, W - 120, n), rng.uniform(40, H - 40, n)], 1)
    drift = np.stack([rng.normal(0, 3.0, n), rng.normal(-1.5, 3.5, n)], 1)
    rad = np.where(rng.random(n) < 0.7, rng.uniform(1.0, 2.2, n), rng.uniform(3.0, 9.0, n))
    sign = np.where(rng.random(n) < 0.55, 1.0, -1.0)
    vel = []
    for f in range(NFRAMES):
        vel.append(np.load(os.path.join(TMP, "vel", f"{f:04d}.npy")).astype(np.float32))
    pos = np.full((NFRAMES, n, 2), np.nan, np.float32)
    alpha = np.zeros((NFRAMES, n), np.float32)
    gh, gw = vel[0].shape[1:]
    for i in range(n):
        f0 = int(np.ceil(birth[i] * FPS))
        nf = int(life[i] * FPS)
        p = p0[i].copy()
        for j in range(nf):
            f = (f0 + j) % NFRAMES
            a = j / FPS
            pos[f, i] = p
            alpha[f, i] = min(1.0, a / 1.5, (life[i] - a) / 1.5) * (0.75 + 0.25 * np.sin(1.7 * a + i))
            gx = np.clip(p[0] / 8 - 0.5, 0, gw - 1.01)
            gy = np.clip(p[1] / 8 - 0.5, 0, gh - 1.01)
            ix, iy = int(gx), int(gy)
            fx, fy = gx - ix, gy - iy
            v = vel[f][:, iy:iy + 2, ix:ix + 2]
            u = (v[:, 0, 0] * (1 - fx) + v[:, 0, 1] * fx) * (1 - fy) + (v[:, 1, 0] * (1 - fx) + v[:, 1, 1] * fx) * fy
            p = p + (u * 0.92 + drift[i]) / FPS
            p[0] = np.clip(p[0], 4, W - 4)
            p[1] = np.clip(p[1], 4, H - 4)
    np.savez(cache, pos=pos, alpha=alpha, rad=rad, sign=sign)
    return pos, alpha, rad, sign


def stamp(layer, x, y, ker, amp):
    k = ker.shape[0] // 2
    ix, iy = int(round(x)), int(round(y))
    x0, x1 = ix - k, ix + k + 1
    y0, y1 = iy - k, iy + k + 1
    if x0 < 0 or y0 < 0 or x1 > layer.shape[1] or y1 > layer.shape[0]:
        return
    layer[y0:y1, x0:x1] += amp * ker


def disc_kernel(r, soft):
    k = int(r + 3 * soft + 2)
    yy, xx = np.mgrid[-k:k + 1, -k:k + 1].astype(np.float32)
    d = np.sqrt(xx * xx + yy * yy)
    return np.clip((r - d) / soft + 0.5, 0, 1).astype(np.float32)


class Finisher:
    def __init__(self, framing, fdir="frames"):
        self.framing = framing
        self.fdir = os.path.join(TMP, fdir)
        self.pos, self.alpha, self.rad, self.sign = simulate_motes(fdir=fdir)
        self.kers = [disc_kernel(r, 0.9 if r < 2.5 else 1.6) for r in self.rad]
        self.kers = [k / k.max() for k in self.kers]
        if framing == "vertical":
            self.ow, self.oh = 1080, 1920
        else:
            self.ow, self.oh = 1080, 1080
        yy, xx = np.mgrid[0:self.oh, 0:self.ow].astype(np.float32)
        nx = (xx - self.ow / 2) / (self.ow / 2)
        ny = (yy - self.oh * (0.46 if framing == "vertical" else 0.5)) / (self.oh / 2)
        r2 = (nx * nx * (0.80 if framing == "vertical" else 0.72) + ny * ny * 0.72)
        vig = 1.0 - 0.17 * np.clip(r2, 0, 2.2) ** 1.3
        self.vig = np.stack([vig, vig * (1 - 0.02 * np.clip(r2, 0, 2)), vig * (1 - 0.06 * np.clip(r2, 0, 2))], -1).astype(np.float32)
        # domain coordinates of every output pixel (for the shimmer)
        if framing == "vertical":
            self.dx = xx + 180.0
            self.dy = yy
        else:
            self.dx = xx * (1440.0 / 1080.0)
            self.dy = yy * (1440.0 / 1080.0) + SQ_Y0
        rng = np.random.default_rng(5)
        self.sh = [(rng.uniform(0.004, 0.011) * rng.choice([-1, 1]), rng.uniform(0.002, 0.007), int(rng.integers(1, 4)) * rng.choice([-1, 1]),
                    rng.uniform(0, 6.28)) for _ in range(6)]
        # chromatic fringe maps
        self.cmaps = []
        for sc in (1.0012, 0.9988):
            mx = ((xx - self.ow / 2) * sc + self.ow / 2).astype(np.float32)
            my = ((yy - self.oh / 2) * sc + self.oh / 2).astype(np.float32)
            self.cmaps.append((mx, my))

    def overlay(self, f):
        """motes + bubbles in domain space: returns (add, mul) float layers."""
        t = f / FPS
        add = np.zeros((H, W), np.float32)
        dark = np.zeros((H, W), np.float32)
        for i in np.nonzero(self.alpha[f] > 0)[0]:
            x, y = self.pos[f, i]
            a = self.alpha[f, i]
            big = self.rad[i] > 2.5
            amp = (0.085 if not big else 0.030) * a
            if self.sign[i] > 0:
                stamp(add, x, y, self.kers[i], amp)
            else:
                stamp(dark, x, y, self.kers[i], amp * 1.25)
        hi = np.zeros((H, W), np.uint8)
        rim = np.zeros((H, W), np.uint8)
        any_b = False
        for b in BUBBLES:
            a = (t - b["t0"]) % T
            if a >= b["life"] or a < 0:
                continue
            x = float(bubble_x(b, a))
            y = float(bubble_y(b, a))
            r = b["r"] * (1.0 + 0.06 * np.sin(31 * a + b["ph"]))
            if y < -r - 2 or y > H + 12:
                continue
            any_b = True
            fade = min(1.0, a / 0.05)
            sub = 8
            c = (int(round(x * sub)), int(round(y * sub)))
            cv2.circle(rim, c, int(round(r * sub)), int(255 * 0.34 * fade), max(1, int(round(r * 0.34))), cv2.LINE_AA, 3)
            cv2.circle(hi, (int(round((x - r * 0.33) * sub)), int(round((y - r * 0.36) * sub))), int(round(max(r * 0.24, 0.8) * sub)), int(255 * 0.5 * fade), -1, cv2.LINE_AA, 3)
            cv2.circle(hi, (int(round((x + r * 0.2) * sub)), int(round((y + r * 0.52) * sub))), int(round(max(r * 0.14, 0.6) * sub)), int(255 * 0.22 * fade), -1, cv2.LINE_AA, 3)
        if any_b:
            add += cv2.GaussianBlur(hi, (0, 0), 0.8).astype(np.float32) / 255.0
            dark += cv2.GaussianBlur(rim, (0, 0), 0.7).astype(np.float32) / 255.0
        return add, dark

    def shimmer(self, f):
        t = f / FPS
        s = np.zeros((self.oh, self.ow), np.float32)
        for kx, ky, n, ph in self.sh:
            s += np.sin(kx * self.dx + ky * self.dy + 2 * np.pi * n * t / T + ph + 1.3 * np.sin(0.004 * self.dy + 2 * np.pi * t / T))
        depth = np.exp(-self.dy / 900.0)
        out = 1.0 + (0.010 + 0.022 * depth) * s / 2.4
        # ripples of light from each impact at the surface
        for k in range(4):
            for (ti, xi, amp) in ((k * CYC - LEAD, ENTRY_X[k], 0.085), (k * CYC - LEAD + 2 * BEAT, ENTRY2_X[k], 0.05)):
                a = (t - ti) % T
                if a < 2.2:
                    r = np.sqrt((self.dx - xi) ** 2 + (self.dy * 2.2) ** 2)
                    out += amp * np.exp(-a / 0.55) * np.exp(-self.dy / 190.0) * np.cos(0.045 * (r - 520 * a)) * np.clip(1 - np.abs(r - 520 * a) / 420.0, 0, 1)
        return out

    def frame(self, f):
        im = cv2.imread(os.path.join(self.fdir, f"{f:04d}.jpg"))
        im = im[:, :, ::-1].astype(np.float32) / 255.0
        add, dark = self.overlay(f)
        im = im * (1.0 - dark)[..., None] + add[..., None] * np.array([1.0, 0.97, 0.90], np.float32)
        if self.framing == "vertical":
            im = im[:, 180:1260]
        else:
            im = cv2.resize(im[SQ_Y0:SQ_Y0 + 1440], (1080, 1080), interpolation=cv2.INTER_AREA)
        im = np.ascontiguousarray(im)
        # lens: slight softness + faint chromatic fringe toward the edges
        soft = cv2.GaussianBlur(im, (0, 0), 2.0)
        im = im * 0.84 + soft * 0.16
        r = cv2.remap(im[:, :, 0], self.cmaps[0][0], self.cmaps[0][1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        b = cv2.remap(im[:, :, 2], self.cmaps[1][0], self.cmaps[1][1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        im = np.stack([r, im[:, :, 1], b], -1)
        im = im * self.shimmer(f)[..., None] * self.vig
        # gentle filmic contrast
        im = np.clip(im, 0, 1)
        im = im * im * (3 - 2 * im) * 0.16 + im * 0.84
        im = 1.0 - (1.0 - im) ** 1.14          # lift: the backlight stays luminous
        # grain (deterministic per frame), a touch stronger in the mid-tones
        rng = np.random.default_rng(9000 + f)
        g = rng.standard_normal((self.oh, self.ow), dtype=np.float32)
        g = g * 0.45 + cv2.GaussianBlur(g, (0, 0), 1.1) * 1.3
        lum = im.mean(-1)
        im = im + (g * (0.0042 + 0.0045 * lum * (1 - lum) * 4))[..., None]
        return (np.clip(im, 0, 1) * 255.0 + 0.5).astype(np.uint8)


_FIN = None


def _init(framing, fdir):
    global _FIN
    cv2.setNumThreads(1)
    _FIN = Finisher(framing, fdir)


def _work(f):
    return _FIN.frame(f).tobytes()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("framing")
    ap.add_argument("out", nargs="?")
    ap.add_argument("--crf", default="16")
    ap.add_argument("--preset", default="slow")
    ap.add_argument("--audio", default=None)
    ap.add_argument("--maxrate", default=None)
    ap.add_argument("--bufsize", default=None)
    ap.add_argument("--still", nargs=2, default=None)
    ap.add_argument("--fdir", default="frames")
    ap.add_argument("--n", type=int, default=NFRAMES)
    a = ap.parse_args()
    fin = Finisher(a.framing, a.fdir)
    if a.still:
        cv2.imwrite(a.still[1], fin.frame(int(a.still[0]))[:, :, ::-1])
        sys.exit(0)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{fin.ow}x{fin.oh}", "-r", str(FPS), "-i", "-"]
    if a.audio:
        cmd += ["-i", a.audio]
    cmd += ["-c:v", "libx264", "-preset", a.preset, "-crf", a.crf, "-pix_fmt", "yuv420p", "-profile:v", "high",
            "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
            "-vf", "scale=out_color_matrix=bt709:out_range=tv"]
    if a.maxrate:
        cmd += ["-maxrate", a.maxrate, "-bufsize", a.bufsize]
    if a.audio:
        cmd += ["-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-shortest"]
    cmd += ["-movflags", "+faststart", a.out]
    import multiprocessing as mp
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    with mp.Pool(3, initializer=_init, initargs=(a.framing, a.fdir)) as pool:
        for f, buf in enumerate(pool.imap(_work, range(a.n), chunksize=2)):
            p.stdin.write(buf)
            if f % 60 == 0:
                print("frame", f, flush=True)
    p.stdin.close()
    p.wait()
    print("done", a.out)
