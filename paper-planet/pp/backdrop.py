"""Backdrop: a paper dusk made of hanging layered sheets, with cut-paper stars and the globe's soft shadow."""
import math
import numpy as np
import cv2
import skia
from . import core, paper
from .paper import hexrgb, col, make_surface

LAYERS = [  # (edge y as fraction of height, colour) from the warm back sheet up to the nearest indigo sheet
    (None, '#FFC57A'),
    (0.905, '#FF9E66'),
    (0.805, '#F4736F'),
    (0.690, '#D0508C'),
    (0.555, '#9A3D97'),
    (0.440, '#6A2F92'),
    (0.320, '#44277F'),
    (0.195, '#2B1E63'),
    (0.085, '#1C1646'),
]


class Backdrop:
    def __init__(self, ss=2, w=core.W, h=core.H, margin=1.10):
        self.ss = ss
        self.W, self.H = int(w * ss * margin), int(h * ss * margin)
        self.Wp, self.Hp = w * ss, h * ss
        W, H = self.W, self.H
        rng = np.random.default_rng(5)
        surf = make_surface(W, H)
        c = surf.getCanvas()
        c.clear(col(LAYERS[0][1]))
        edges = []
        for i, (ey, colr) in enumerate(LAYERS[1:]):
            ph = rng.uniform(0, 6.28, 4)
            amp = H * (0.016 + 0.012 * rng.random())
            scallop = i in (1, 3, 6)
            pts = []
            n = 90
            for k in range(n + 1):
                x = -40 + (W + 80) * k / n
                u = k / n
                y = ey * H + amp * (math.sin(u * 5.3 + ph[0]) + 0.55 * math.sin(u * 11.7 + ph[1]) + 0.25 * math.sin(u * 23.0 + ph[2]))
                y += H * 0.035 * math.sin(u * math.pi * 1.0 + ph[3] * 0.2) * (1 if i % 2 else -1)
                if scallop:
                    y += amp * 1.3 * abs(math.sin(u * 21.0 + ph[2]))
                pts.append((x, y))
            path = skia.Path()
            path.moveTo(-40, -40)
            path.lineTo(pts[0][0], pts[0][1])
            for (x, y) in pts[1:]:
                path.lineTo(x, y)
            path.lineTo(W + 40, -40)
            path.close()
            sp = skia.Paint(AntiAlias=True)
            sp.setColor4f(skia.Color4f(0.10, 0.03, 0.20, 0.42))
            sp.setMaskFilter(skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, 16 * ss))
            c.save()
            c.translate(7 * ss, 15 * ss)
            c.drawPath(path, sp)
            c.restore()
            p = skia.Paint(AntiAlias=True)
            p.setColor4f(col(colr))
            p.setPathEffect(skia.CornerPathEffect.Make(30 * ss))
            c.drawPath(path, p)
            # light paper edge
            ep = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style)
            ep.setStrokeWidth(1.6 * ss)
            lc = paper.lighten(colr, 0.22)
            ep.setColor4f(skia.Color4f(float(lc[0]), float(lc[1]), float(lc[2]), 0.7))
            ep.setPathEffect(skia.CornerPathEffect.Make(30 * ss))
            c.drawPath(path, ep)
            edges.append(pts)
        # stars: cut paper, each with a small shadow
        def star(cx, cy, r, npt, rot, colr, a=1.0):
            pa = skia.Path()
            for k in range(npt * 2):
                rr = r if k % 2 == 0 else r * (0.42 if npt == 5 else 0.32)
                an = rot + k * math.pi / npt
                x, y = cx + rr * math.sin(an), cy - rr * math.cos(an)
                if k == 0:
                    pa.moveTo(x, y)
                else:
                    pa.lineTo(x, y)
            pa.close()
            sp = skia.Paint(AntiAlias=True)
            sp.setColor4f(skia.Color4f(0.05, 0.02, 0.15, 0.45))
            sp.setMaskFilter(skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, 2.2 * ss))
            c.save(); c.translate(2 * ss, 3.5 * ss); c.drawPath(pa, sp); c.restore()
            p = skia.Paint(AntiAlias=True)
            cc = hexrgb(colr)
            p.setColor4f(skia.Color4f(float(cc[0]), float(cc[1]), float(cc[2]), a))
            c.drawPath(pa, p)
        placed = []
        self.stars = []
        tries = 0
        while len(placed) < 46 and tries < 4000:
            tries += 1
            x = rng.uniform(0.02, 0.98) * W
            y = rng.uniform(0.02, 0.60) ** 1.25 * H
            # keep the area behind the globe calm
            if math.hypot(x - W / 2, y - H / 2) < H * 0.40:
                continue
            if any(math.hypot(x - px, y - py) < H * 0.065 for px, py in placed):
                continue
            placed.append((x, y))
            r = ss * rng.choice([5, 6, 7, 9, 12, 15], p=[0.25, 0.25, 0.2, 0.15, 0.1, 0.05])
            self.stars.append((x, y, r))
            star(x, y, r, 5 if rng.random() < 0.45 else 4, rng.uniform(-0.4, 0.4), '#FFF1C4' if rng.random() < 0.7 else '#FFD98A')
        for _ in range(110):
            x = rng.uniform(0, W)
            y = rng.uniform(0, 0.62) ** 1.3 * H
            if math.hypot(x - W / 2, y - H / 2) < H * 0.36:
                continue
            p = skia.Paint(AntiAlias=True)
            p.setColor4f(skia.Color4f(1.0, 0.93, 0.78, float(rng.uniform(0.45, 0.9))))
            rd = ss * rng.uniform(0.9, 1.9)
            c.drawCircle(x, y, rd, p)
            self.stars.append((x, y, rd * 2.2))
        arr = surf.toarray().astype(np.float32) / 255.0
        f = paper.fibre()
        S = f.shape[0]
        ys = (np.arange(H) // 1) % S
        xs = (np.arange(W) // 1) % S
        tex = f[np.ix_(ys, xs)]
        big = cv2.resize(cv2.resize(tex, (W // 2, H // 2)), (W, H))   # two scales of grain
        arr[..., :3] *= (1.0 + 0.16 * (tex - 0.5) + 0.20 * (big - 0.5))[..., None]
        arr = np.clip(arr, 0, 1)
        arr[..., 3] = 1
        self.img = skia.Image.fromarray((arr * 255 + 0.5).astype(np.uint8), colorType=paper.RGBA, alphaType=skia.AlphaType.kOpaque_AlphaType)
        # soft shadow blob
        b = 256
        yy, xx = np.mgrid[0:b, 0:b].astype(np.float32)
        d = np.hypot(xx - b / 2, yy - b / 2) / (b / 2)
        a = np.clip(1.0 - d, 0, 1)
        a = a * a * (3 - 2 * a)
        blob = np.zeros((b, b, 4), np.uint8)
        al = a * 0.50
        blob[..., 0] = (0.08 * al * 255).astype(np.uint8)
        blob[..., 1] = (0.02 * al * 255).astype(np.uint8)
        blob[..., 2] = (0.18 * al * 255).astype(np.uint8)
        blob[..., 3] = (al * 255).astype(np.uint8)
        self.blob = skia.Image.fromarray(blob, colorType=paper.RGBA, alphaType=paper.PREMUL)
        # twinkle: each star gets a soft additive glint on its own slow rhythm, a whole number of cycles per loop
        g = 64
        yy, xx = np.mgrid[0:g, 0:g].astype(np.float32)
        d = np.hypot(xx - g / 2 + 0.5, yy - g / 2 + 0.5) / (g / 2)
        core_ = np.clip(1.0 - d, 0, 1) ** 2.2
        cross = (np.exp(-((xx - g / 2 + 0.5) / 1.6) ** 2) + np.exp(-((yy - g / 2 + 0.5) / 1.6) ** 2)) * np.clip(1.0 - d, 0, 1) ** 1.5
        a = np.clip(0.75 * core_ + 0.45 * cross, 0, 1)
        gl = np.zeros((g, g, 4), np.uint8)
        gl[..., 0] = (a * 1.00 * 255).astype(np.uint8)
        gl[..., 1] = (a * 0.94 * 255).astype(np.uint8)
        gl[..., 2] = (a * 0.80 * 255).astype(np.uint8)
        gl[..., 3] = (a * 255).astype(np.uint8)
        self.glint = skia.Image.fromarray(gl, colorType=paper.RGBA, alphaType=paper.PREMUL)
        tr = np.random.default_rng(77)
        self.tw = [(x, y, r, int(tr.integers(4, 13)), float(tr.uniform(0, 6.283)), float(tr.uniform(0.55, 1.0))) for (x, y, r) in self.stars]

    def draw(self, canvas, buf, t, cam):
        # gentle parallax: the hanging sheets slide a little with the globe and with the camera's latitude
        z = 1.0 + 0.10 * (cam.zoom - 1.0)
        (gx, gy), gr = cam.globe_disc()
        mx = (self.W - self.Wp) / 2.0
        my = (self.H - self.Hp) / 2.0
        ox = mx * math.tanh(0.05 * (gx - cam.cx) / mx)
        oy = my * math.tanh((0.05 * (gy - cam.cy) + 0.020 * self.Hp * cam.elev / 60.0) / my)
        w, h = self.W * z, self.H * z
        x0 = (self.Wp - w) / 2 + ox
        y0 = (self.Hp - h) / 2 + oy
        canvas.drawImageRect(self.img, skia.Rect(0, 0, self.W, self.H), skia.Rect(x0, y0, x0 + w, y0 + h),
                             skia.SamplingOptions(skia.FilterMode.kLinear), skia.Paint())
        gp = skia.Paint()
        gp.setBlendMode(skia.BlendMode.kPlus)
        smp = skia.SamplingOptions(skia.FilterMode.kLinear)
        for (sx, sy, sr, k, ph, amp) in self.tw:
            v = 0.5 + 0.5 * math.sin(2 * math.pi * k * t / core.DUR + ph)
            v = v ** 3 * amp
            if v < 0.02:
                continue
            cx_, cy_ = x0 + sx * z, y0 + sy * z
            rr = sr * z * (1.6 + 1.2 * v)
            gp.setAlphaf(min(1.0, 0.85 * v))
            canvas.drawImageRect(self.glint, skia.Rect(0, 0, 64, 64), skia.Rect(cx_ - rr, cy_ - rr, cx_ + rr, cy_ + rr), smp, gp)
        r = gr * 1.75
        cx, cy = gx + gr * 0.22, gy + gr * 0.30
        canvas.drawImageRect(self.blob, skia.Rect(0, 0, 256, 256), skia.Rect(cx - r, cy - r, cx + r, cy + r),
                             skia.SamplingOptions(skia.FilterMode.kLinear), skia.Paint())
