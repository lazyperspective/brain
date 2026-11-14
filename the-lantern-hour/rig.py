"""The rostrum: keyframes, seeds, plate cache, stroke-by-stroke wipes, and the camera loop."""
import sys, os, math, time, subprocess, hashlib
import numpy as np
import cv2
from engine import *
from creatures import *
from flora import *
import forest as FO
import meadow as ME

FPS = 24
WORK = os.environ.get('LH_WORK', '/tmp/lh-work')
os.makedirs(WORK + '/plates', exist_ok=True)


# ------------------------------------------------------------------ small machinery
def K(t, keys):
    """keyframes [(t, v[, ease])] -> value"""
    if t <= keys[0][0]:
        return keys[0][1]
    for i in range(1, len(keys)):
        if t <= keys[i][0]:
            a, b = keys[i - 1], keys[i]
            u = (t - a[0]) / (b[0] - a[0] + 1e-9)
            e = b[2] if len(b) > 2 else 'ease'
            if e == 'ease':
                u = ease(u)
            elif e == 'in':
                u = ease_in(u)
            elif e == 'out':
                u = ease_out(u)
            elif e == 'hold':
                u = 0.0
            return a[1] + (b[1] - a[1]) * u
    return keys[-1][1]


def R(*key):
    h = hashlib.md5(repr(key).encode()).digest()
    return np.random.default_rng(int.from_bytes(h[:8], 'little'))


def cached(name, fn):
    p = f'{WORK}/plates/{name}.npy'
    if os.path.exists(p):
        return np.load(p)
    a = fn()
    np.save(p, a)
    return a


def cached_layer(paper, name, fn):
    p = f'{WORK}/plates/{name}.npz'
    L = Layer(paper)
    if os.path.exists(p):
        z = np.load(p)
        L.C = z['C']; L.A = z['A']
    else:
        L2 = fn()
        L.C, L.A = L2.C, L2.A
        np.savez(p, C=L.C, A=L.A)
    L.d = [0, 0, paper.w, paper.h]
    return L


def walk_of(xfn, t, s):
    v = abs(xfn(t + 0.05) - xfn(t - 0.05)) / 0.1
    return clamp(v / (0.12 * s))


def blink_of(t, seed, rate=0.28):
    """blinks now and then: returns 1 while the eye is shut"""
    k = int(t / 0.125)
    for j in (k, k - 1):
        if R('blink', seed, j).random() < rate * 0.125:
            return 1.0
    return 0.0


def stroke_order(paper, seed, ang=0.0, ln=90, wd=26, n=2600, bias=None):
    """a map of 'when would a hand get to this part of the sheet': each pixel 0..1.
    used to let one drawing replace another stroke by stroke."""
    rng = np.random.default_rng(seed)
    M = np.full((paper.h, paper.w), 1.0, F32)
    order = np.sort(rng.random(n))[::-1]
    xs = rng.uniform(-50, paper.w + 50, n); ys = rng.uniform(-30, paper.h + 30, n)
    for i in range(n):
        a = ang + rng.normal(0, 0.25)
        l = ln * rng.uniform(0.5, 1.6)
        v = float(order[i])
        if bias is not None:
            v = clamp(v * 0.55 + 0.45 * bias(xs[i], ys[i]) + rng.normal(0, 0.03))
        p0 = (int(xs[i] - math.cos(a) * l), int(ys[i] - math.sin(a) * l)); p1 = (int(xs[i] + math.cos(a) * l), int(ys[i] + math.sin(a) * l))
        cv2.line(M, p0, p1, v, int(wd * rng.uniform(0.6, 1.4)))
    M = M + (paper.T - 0.5) * 0.10
    return M


def wipe(A, B, M, u, soft=0.05):
    """B is drawn over A as u goes 0 -> 1"""
    if u <= 0:
        return A
    if u >= 1:
        return B
    a = np.clip((u * (1 + 2 * soft) - soft - M) / soft, 0, 1)[..., None]
    return A + (B - A) * a


class Writer:
    def __init__(self, path, crf=13):
        self.p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                                   '-c:v', 'libx264', '-preset', 'slow', '-crf', str(crf), '-pix_fmt', 'yuv420p', path], stdin=subprocess.PIPE)

    def write(self, im):
        self.p.stdin.write(im.tobytes())

    def close(self):
        self.p.stdin.close(); self.p.wait()


SHOTS = {}


def shot(name, dur):
    def deco(fn):
        SHOTS[name] = (fn, dur)
        return fn
    return deco


def run_shot(name, mode='video', arg=None):
    fn, dur = SHOTS[name]
    gen = fn()
    drawf = next(gen)         # shots are generators: first yield hands back draw(t, d) -> (C, shoot_kwargs)
    nfr = int(round(dur * FPS))
    if mode == 'video':
        wr = Writer(f'{WORK}/seg_{name}.mp4')
        last = None; cur = None
        t0 = time.time()
        for f in range(nfr):
            d = f // 2
            if d != last:
                cur = drawf(d / 12.0, d)
                last = d
            C, kw = cur
            kw = dict(kw)
            zf = kw.pop('zoomf', None)
            if zf is not None:
                z, cx, cy = zf(f / FPS)
                kw.update(zoom=z, cx=cx, cy=cy)
            ef = kw.pop('expof', None)
            if ef is not None:
                kw['expo'] = ef(f / FPS)
            wseed = kw.pop('wseed', d)
            rng = R('shoot', name, wseed)
            im = shoot(C, rng, **kw)
            # fresh photographic grain on every exposure
            if kw.get('grain', 1) > 0:
                g = R('grain', name, f).standard_normal((H // 2, W // 2), dtype=F32) * 1.2
                g = cv2.resize(g, (W, H), interpolation=cv2.INTER_LINEAR)
                im = np.clip(im.astype(F32) + g[..., None], 0, 255).astype(np.uint8)
            wr.write(im)
            if f % 48 == 0:
                print(f'{name}: {f}/{nfr}  {time.time() - t0:.0f}s', flush=True)
        wr.close()
    elif mode == 'sheet':
        n = int(arg or 12)
        ts = [dur * (i + 0.5) / n for i in range(n)]
        ims = []
        for t in ts:
            d = int(t * 12)
            C, kw = drawf(d / 12.0, d)
            kw = dict(kw); zf = kw.pop('zoomf', None); ef = kw.pop('expof', None); kw.pop('wseed', None)
            if zf is not None:
                z, cx, cy = zf(t); kw.update(zoom=z, cx=cx, cy=cy)
            if ef is not None:
                kw['expo'] = ef(t)
            im = shoot(C, R('s', d), **kw)
            im = cv2.resize(im, (640, 360), interpolation=cv2.INTER_AREA)
            cv2.putText(im, f'{t:.1f}', (8, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            ims.append(im)
        cols = 3
        while len(ims) % cols:
            ims.append(np.zeros_like(ims[0]))
        rows = [np.hstack(ims[i:i + cols]) for i in range(0, len(ims), cols)]
        save(f'{WORK}/sheet_{name}.png', np.vstack(rows))
    elif mode == 'still':
        t = float(arg)
        d = int(t * 12)
        C, kw = drawf(d / 12.0, d)
        kw = dict(kw); zf = kw.pop('zoomf', None); ef = kw.pop('expof', None); kw.pop('wseed', None)
        if zf is not None:
            z, cx, cy = zf(t); kw.update(zoom=z, cx=cx, cy=cy)
        if ef is not None:
            kw['expo'] = ef(t)
        save(f'{WORK}/still_{name}_{t:.2f}.png', shoot(C, R('s', d), **kw))


