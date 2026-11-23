"""Frame renderer: light-space shadow map, shaded paper sphere, depth-sorted paper cards."""
import math
import heapq
import numpy as np
import cv2
import skia

from . import core, world, paper
from .core import LIGHT, RIM, KEY_COL, AMB_COL, RIM_COL, BOUNCE_COL

RGBA = skia.ColorType.kRGBA_8888_ColorType
F32 = skia.ColorType.kRGBA_F32_ColorType
PREMUL = skia.AlphaType.kPremul_AlphaType
OPAQUE = skia.AlphaType.kOpaque_AlphaType

LM = 1536           # light map size
LS = 3.1            # light map world extent
G = 20              # per-card shading grid
KF = 0.42           # gore flattening for facet shading
KF2 = 0.30
KB = 0.85           # emboss strength

SAMP = skia.SamplingOptions(skia.FilterMode.kLinear, skia.MipmapMode.kLinear)
SAMP_LIN = skia.SamplingOptions(skia.FilterMode.kLinear)
SAMP_NEAR = skia.SamplingOptions(skia.FilterMode.kNearest)
DECAL = skia.TileMode.kDecal
CLAMP = skia.TileMode.kClamp


class Card:
    __slots__ = ('O', 'X', 'Y', 'w', 'h', 'layers', 'clip', 'emis', 'cast', 'ao', 'tint', 'contact', 'sortz', 'noshade', 'alpha', 'both')

    def __init__(self, O, X, Y, w, h, layers, clip=False, emis=False, cast=True, ao=True, tint=1.0, contact=0.0,
                 sortz=0.0, noshade=False, alpha=1.0, both=False):
        self.O, self.X, self.Y, self.w, self.h = O, X, Y, w, h
        self.layers = layers
        self.clip = clip
        self.emis = emis
        self.cast = cast
        self.ao = ao
        self.tint = tint
        self.contact = contact      # strength of contact shadow line on the globe (0..1)
        self.sortz = sortz
        self.noshade = noshade
        self.alpha = alpha
        self.both = both


def place(spr, x, y, wR, rot=0.0, pivot=(0.5, 0.0), flip=False, sy=1.0):
    """Affine (as skia.Matrix) from sprite px to card-local units (y up).
    Sprite bottom-left lands at (x,y), width wR; rot (deg, CCW) about pivot (fraction of sprite box)."""
    s = wR / spr.pw
    hR = spr.ph * s * sy
    # px -> local unrotated
    fx = -1.0 if flip else 1.0
    a, b, tx = fx * s, 0.0, (wR if flip else 0.0)
    c, d, ty = 0.0, -s * sy, hR
    if rot:
        r = math.radians(rot)
        cr, sr = math.cos(r), math.sin(r)
        px_, py_ = pivot[0] * wR, pivot[1] * hR
        a2 = cr * a - sr * c
        b2 = cr * b - sr * d
        c2 = sr * a + cr * c
        d2 = sr * b + cr * d
        tx2 = cr * (tx - px_) - sr * (ty - py_) + px_
        ty2 = sr * (tx - px_) + cr * (ty - py_) + py_
        a, b, c, d, tx, ty = a2, b2, c2, d2, tx2, ty2
    return skia.Matrix.MakeAll(a, b, tx + x, c, d, ty + y, 0, 0, 1)


def _order(corners, normals, centers, depth, bbox, C):
    """Painter's order: plane-side tests between screen-overlapping cards + topological sort."""
    n = len(corners)
    if n <= 1:
        return list(range(n))
    camside = np.sign(np.einsum('id,id->i', normals, C[None, :] - centers))
    camside[camside == 0] = 1.0
    D = np.einsum('id,jkd->ijk', normals, corners) - np.einsum('id,id->i', normals, centers)[:, None, None]
    D *= camside[:, None, None]
    eps = 2e-4
    front = D.min(2) >= -eps    # j lies on camera side of plane i  -> j after i
    behind = D.max(2) <= eps    # j lies behind plane i             -> j before i
    r = np.where(front & ~behind, 1, np.where(behind & ~front, -1, 0)).astype(np.int8)
    rel = np.where(r != 0, r, -r.T)
    dz = depth[:, None] - depth[None, :]       # >0: i farther than j -> i first
    rel = np.where(rel != 0, rel, np.sign(dz).astype(np.int8))
    ov = (bbox[:, None, 0] < bbox[None, :, 2]) & (bbox[None, :, 0] < bbox[:, None, 2]) & \
         (bbox[:, None, 1] < bbox[None, :, 3]) & (bbox[None, :, 1] < bbox[:, None, 3])
    np.fill_diagonal(ov, False)
    E = ov & (rel == 1)          # edge i -> j : i drawn before j
    E &= ~E.T | (np.arange(n)[:, None] < np.arange(n)[None, :])   # break 2-cycles deterministically
    indeg = E.sum(0).astype(np.int32)
    heap = [(-depth[i], i) for i in range(n) if indeg[i] == 0]
    heapq.heapify(heap)
    done = np.zeros(n, bool)
    out = []
    succ = [np.nonzero(E[i])[0] for i in range(n)]
    while len(out) < n:
        if not heap:
            rest = np.nonzero(~done)[0]
            i = rest[np.argmax(depth[rest])]
            indeg[i] = 0
            heap = [(-depth[i], i)]
        _, i = heapq.heappop(heap)
        if done[i]:
            continue
        done[i] = True
        out.append(i)
        for j in succ[i]:
            if not done[j]:
                indeg[j] -= 1
                if indeg[j] <= 0:
                    heapq.heappush(heap, (-depth[j], j))
    return out


class Renderer:
    def __init__(self, scene, backdrop=None, ss=2, w=core.W, h=core.H):
        self.ss = ss
        self.w, self.h = w, h
        self.Wp, self.Hp = w * ss, h * ss
        wd = world.bake()
        alb = wd['albedo']
        self.PAD = 4
        self.alb = np.ascontiguousarray(np.concatenate([alb[:, -self.PAD:], alb, alb[:, :self.PAD]], 1))
        gr = wd['grad'].astype(np.float32)
        self.grad = np.ascontiguousarray(np.concatenate([gr[:, -self.PAD:], gr, gr[:, :self.PAD]], 1))
        self.fib = paper.fibre()
        self.scene = scene
        self.backdrop = backdrop
        self.buf = np.zeros((self.Hp, self.Wp, 4), np.uint8)
        self.surf = skia.Surface(self.buf)
        self.canvas = self.surf.getCanvas()
        self.lsurf = skia.Surface.MakeRaster(skia.ImageInfo.Make(LM, LM, F32, PREMUL))
        self.lcanvas = self.lsurf.getCanvas()
        info = skia.ImageInfo.Make(self.Wp // 2, self.Hp // 2, skia.ColorType.kAlpha_8_ColorType, PREMUL)
        self.aosurf = skia.Surface.MakeRaster(info)
        # light basis
        self._set_light(np.array([1.0, 0, 0]), np.array([0, 1.0, 0]), np.array([0, 0, 1.0]))
        gy, gx = np.meshgrid((np.arange(G) + 0.5) / G, (np.arange(G) + 0.5) / G, indexing='ij')
        self.ggx, self.ggy = gx, gy
        # vignette (1x)
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        rr = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
        self.vig = (1.0 - 0.20 * np.clip(rr - 0.55, 0, 1) ** 1.8)[..., None].astype(np.float32)

    def _set_light(self, right, up, back):
        """Key and rim lights live in camera space, so the paper is lit from the upper left front wherever the
        camera has drifted (it orbits far south for Antarctica); the light map follows."""
        L = LIGHT[0] * right + LIGHT[1] * up + LIGHT[2] * back
        self.L = L / np.linalg.norm(L)
        Rm = RIM[0] * right + RIM[1] * up + RIM[2] * back
        self.Rim = Rm / np.linalg.norm(Rm)
        self.U = np.asarray(up, float)
        lx = np.cross(self.U, self.L)
        lx /= np.linalg.norm(lx)
        ly = np.cross(self.L, lx)
        self.lx, self.ly = lx, ly

    # ------------------------------------------------------------------ light map
    def _lproj(self, P):
        u = (P @ self.lx) / LS * LM + LM / 2
        v = LM / 2 - (P @ self.ly) / LS * LM
        return np.stack([u, v], -1)

    def _draw_lightmap(self, cards, corners):
        c = self.lcanvas
        c.clear(skia.Color4f(0, 0, 0, 1))
        pt = self._lproj(corners)   # (N,4,2)
        paint = skia.Paint(AntiAlias=False)
        paint.setBlendMode(skia.BlendMode.kLighten)
        for i, cd in enumerate(cards):
            if not cd.cast:
                continue
            q = pt[i]
            m = skia.Matrix()
            w, h = cd.w, cd.h
            if not m.setPolyToPoly([skia.Point(0, 0), skia.Point(w, 0), skia.Point(w, h), skia.Point(0, h)],
                                   [skia.Point(*q[0]), skia.Point(*q[1]), skia.Point(*q[2]), skia.Point(*q[3])]):
                continue
            d0 = float(cd.O @ self.L) / LS + 0.5
            gxl = float(cd.X @ self.L) / LS
            gyl = float(cd.Y @ self.L) / LS
            gn = math.hypot(gxl, gyl)
            cx_, cy_ = w / 2, h / 2
            dc = d0 + gxl * cx_ + gyl * cy_
            if gn < 1e-6:
                v = min(1.0, max(0.0, dc))
                grad = skia.Shaders.Color(skia.Color4f(v, v, v, 1))
            else:
                T = 2.0 * (w + h)
                ux, uy = gxl / gn, gyl / gn
                v0 = dc - gn * T
                v1 = dc + gn * T
                grad = skia.GradientShader.MakeLinear(
                    [skia.Point(cx_ - ux * T, cy_ - uy * T), skia.Point(cx_ + ux * T, cy_ + uy * T)],
                    [skia.Color4f(v0, v0, v0, 1), skia.Color4f(v1, v1, v1, 1)])
            c.save()
            c.concat(m)
            if cd.clip:
                c.clipRect(skia.Rect(0, 0, w, h))
            for L in cd.layers:
                spr, A, al = L[0], L[1], L[2]
                if al < 0.5:
                    continue
                inv = skia.Matrix()
                if not A.invert(inv):
                    continue
                paint.setShader(grad.makeWithLocalMatrix(inv))
                c.save()
                c.concat(A)
                if len(L) > 3 and L[3] is not None:
                    r = skia.Rect(L[3][0], 0, L[3][1], spr.ph)
                    c.drawImageRect(spr.mask, r, r, SAMP_NEAR, paint)
                else:
                    c.drawImage(spr.mask, 0, 0, SAMP_NEAR, paint)
                c.restore()
            c.restore()
        return self.lsurf.toarray()[..., 0]

    # ------------------------------------------------------------------ card shading
    def _shade_cards(self, cards, O, X, Y, wh, nvis, lmap):
        N = len(cards)
        gx, gy = self.ggx, self.ggy
        P = (O[:, None, None, :] + X[:, None, None, :] * (gx[None, :, :, None] * wh[:, 0, None, None, None]) +
             Y[:, None, None, :] * (gy[None, :, :, None] * wh[:, 1, None, None, None]))     # (N,G,G,3)
        ndl = nvis @ self.L
        f = np.where(ndl > 0, 0.25 + 0.75 * np.clip(ndl, 0, 1) ** 0.7,
                     0.25 * (1.0 - 0.6 * np.clip(-ndl * 3.0, 0, 1)))
        Pb = P + nvis[:, None, None, :] * 0.006
        uv = self._lproj(Pb).astype(np.float32)
        dep = ((Pb @ self.L) / LS + 0.5).astype(np.float32)
        mu = uv[..., 0].reshape(N * G, G)
        mv = uv[..., 1].reshape(N * G, G)
        sh = np.zeros((N * G, G), np.float32)
        taps = ((0, 0), (1.6, 0.6), (-1.6, -0.6), (0.6, -1.6), (-0.6, 1.6))
        for du, dv in taps:
            D = cv2.remap(lmap, mu + du, mv + dv, cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
            sh += (D > dep.reshape(N * G, G) + 0.006)
        S = 1.0 - 0.80 * sh.reshape(N, G, G) / len(taps)
        # sphere occlusion (analytic)
        pl = P @ self.L
        m = np.sqrt(np.maximum((P * P).sum(-1) - pl * pl, 0)) - 1.0
        sph = np.where(pl < 0, np.clip((m + 0.012) / 0.05, 0, 1), 1.0)
        S = S * sph * sph * (3 - 2 * sph)
        nos = np.array([c.noshade for c in cards])
        if nos.any():
            S[nos] = 1.0
        key = (f[:, None, None] * S)[..., None] * KEY_COL
        tint = np.array([c.tint for c in cards])[:, None, None, None]
        bnc = (0.5 - 0.5 * (nvis @ self.U))[:, None, None, None] * BOUNCE_COL
        colr = (AMB_COL + bnc + key) * tint
        out = np.empty((N, G, G, 4), np.uint8)
        out[..., :3] = np.clip(colr * 255.0, 0, 255).astype(np.uint8)
        out[..., 3] = 255
        return out

    # ------------------------------------------------------------------ sphere
    def _sphere(self, cam, Gm, lmap, ao_small):
        f, cx, cy = cam.f, cam.cx, cam.cy
        (sx, sy), rs = cam.globe_disc()
        m = 4
        x0 = max(0, int(sx - rs - m)); x1 = min(self.Wp, int(sx + rs + m) + 1)
        y0 = max(0, int(sy - rs - m)); y1 = min(self.Hp, int(sy + rs + m) + 1)
        xs = ((np.arange(x0, x1, dtype=np.float32) + 0.5) - cx) / f
        ys = -((np.arange(y0, y1, dtype=np.float32) + 0.5) - cy) / f
        DX, DY = np.meshgrid(xs, ys)
        r_, u_, b_ = cam.right.astype(np.float32), cam.up.astype(np.float32), cam.back.astype(np.float32)
        dx = r_[0] * DX + u_[0] * DY - b_[0]
        dy = r_[1] * DX + u_[1] * DY - b_[1]
        dz = r_[2] * DX + u_[2] * DY - b_[2]
        C = cam.C.astype(np.float32)
        a = dx * dx + dy * dy + dz * dz
        bq = C[0] * dx + C[1] * dy + C[2] * dz
        cc = float(C @ C)
        q2 = cc - bq * bq / a
        q = np.sqrt(np.maximum(q2, 0))
        pxw = math.sqrt(cc - 1.0) / f
        alpha = np.clip((1.0 - q) / pxw + 0.5, 0, 1)
        disc = np.maximum(bq * bq - a * (cc - 1.0), 0)
        t = (-bq - np.sqrt(disc)) / a
        px = C[0] + t * dx; py = C[1] + t * dy; pz = C[2] + t * dz
        inv = 1.0 / np.sqrt(px * px + py * py + pz * pz)
        px *= inv; py *= inv; pz *= inv
        del dx, dy, dz, a, bq, q2, disc, t, inv
        GT = Gm.T.astype(np.float32)
        xl = GT[0, 0] * px + GT[0, 1] * py + GT[0, 2] * pz
        yl = GT[1, 0] * px + GT[1, 1] * py + GT[1, 2] * pz
        zl = np.clip(GT[2, 0] * px + GT[2, 1] * py + GT[2, 2] * pz, -1, 1)
        lon = np.degrees(np.arctan2(yl, xl))
        lat = np.degrees(np.arcsin(zl))
        mapx = (lon + 180.0) * (world.TW / 360.0) - 0.5 + self.PAD
        mapy = (90.0 - lat) * (world.TH / 180.0) - 0.5
        alb = cv2.remap(self.alb, mapx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE).astype(np.float32) * (1 / 255.0)
        gr = cv2.remap(self.grad, mapx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        # facet + emboss normal, in globe-local space
        cl = np.maximum(np.sqrt(1.0 - zl * zl), 1e-3)
        co = xl / cl; so = yl / cl
        gw = 360.0 / world.GORES
        gloc = np.mod(lon - world.SEAM0, gw) - gw / 2
        a_ = np.radians(KF * gloc)
        ca = 1.0 - 0.5 * a_ * a_
        cof = co * ca + so * a_
        sof = so * ca - co * a_
        floc = np.mod(lat + world.LATFOLD / 2, world.LATFOLD) - world.LATFOLD / 2
        b2 = np.radians(KF2 * floc)
        cb = 1.0 - 0.5 * b2 * b2
        slf = zl * cb - cl * b2
        clf = cl * cb + zl * b2
        gxm = gr[..., 0] * KB; gym = gr[..., 1] * KB
        nx = clf * cof - (gxm * (-so) + gym * (-zl * co))
        ny = clf * sof - (gxm * co + gym * (-zl * so))
        nz = slf - gym * cl
        inv = 1.0 / np.sqrt(nx * nx + ny * ny + nz * nz)
        Ll = (GT @ self.L).astype(np.float32)
        ndl = (nx * Ll[0] + ny * Ll[1] + nz * Ll[2]) * inv
        ndl_geo = xl * Ll[0] + yl * Ll[1] + zl * Ll[2]
        dif = np.clip((ndl + 0.28) / 1.28, 0, 1)
        dif = dif ** 1.25
        dif *= np.clip((ndl_geo + 0.22) / 0.30, 0, 1)        # soft terminator on the true sphere
        # cast shadows from the light map
        lx, ly = self.lx.astype(np.float32), self.ly.astype(np.float32)
        Lf = self.L.astype(np.float32)
        mu = (px * lx[0] + py * lx[1] + pz * lx[2]) * (LM / LS) + LM / 2
        mv = LM / 2 - (px * ly[0] + py * ly[1] + pz * ly[2]) * (LM / LS)
        dep = (px * Lf[0] + py * Lf[1] + pz * Lf[2]) * (1.0 / LS) + 0.5
        D = cv2.remap(lmap, mu, mv, cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
        diff = D - dep - 0.0028
        occ = (diff > 0).astype(np.float32)
        s = self.ss
        sharp = cv2.GaussianBlur(occ, (0, 0), 1.4 * s)
        soft = cv2.GaussianBlur(occ, (0, 0), 5.0 * s)
        hgt = cv2.GaussianBlur(np.maximum(diff, 0) * occ, (0, 0), 5.0 * s) / (soft + 1e-4) * LS
        far = (occ * (diff * LS > 0.10)).astype(np.float32)
        small = cv2.resize(far, None, fx=0.25, fy=0.25, interpolation=cv2.INTER_AREA)
        vsoft = cv2.resize(cv2.GaussianBlur(small, (0, 0), 4.5 * s), (far.shape[1], far.shape[0]), interpolation=cv2.INTER_LINEAR)
        wsoft = np.clip(hgt / 0.07, 0, 1)
        near = (sharp * (1 - wsoft) + soft * wsoft) * np.clip(1.25 - hgt / 0.12, 0, 1)
        shadow = 1.0 - np.clip(np.maximum(near * 0.86, vsoft * 0.62), 0, 1)
        key = dif * shadow
        # contact AO from cards
        hh, ww = alpha.shape
        aof = cv2.resize(ao_small[y0 // 2:(y1 + 1) // 2 + 1, x0 // 2:(x1 + 1) // 2 + 1], None, fx=2, fy=2,
                         interpolation=cv2.INTER_LINEAR)[(y0 % 2):(y0 % 2) + hh, (x0 % 2):(x0 % 2) + ww]
        aom = 1.0 - 0.55 * aof.astype(np.float32) * (1 / 255.0)
        # rim light
        Cl = (GT @ cam.C).astype(np.float32)
        vx = Cl[0] - xl; vy = Cl[1] - yl; vz = Cl[2] - zl
        vinv = 1.0 / np.sqrt(vx * vx + vy * vy + vz * vz)
        ndv = np.clip((xl * vx + yl * vy + zl * vz) * vinv, 0, 1)
        Rl = (GT @ self.Rim).astype(np.float32)
        rim = (1.0 - ndv) ** 2.6 * np.clip((xl * Rl[0] + yl * Rl[1] + zl * Rl[2]) * 0.7 + 0.45, 0, 1)
        # paper grain in gore-local (sinusoidal) coordinates so it never stretches at the poles
        K = 1500.0
        gi = np.floor(np.mod(lon - world.SEAM0, 360.0) / gw)
        fxm = np.radians(gloc) * cl * K + gi * 371.0 + 4000.0
        fym = np.radians(lat) * K + 4000.0 + gi * 113.0
        S_ = self.fib.shape[0]
        grain = cv2.remap(self.fib, np.mod(fxm, S_ - 1).astype(np.float32), np.mod(fym, S_ - 1).astype(np.float32), cv2.INTER_LINEAR)
        gmul = 1.0 + 0.30 * (grain - 0.5)
        U = self.U.astype(np.float32)
        up = px * U[0] + py * U[1] + pz * U[2]  # camera-up component for sky ambient
        amb = (0.82 + 0.18 * up) * aom
        colr = alb * (AMB_COL[None, None, :] * amb[..., None] + KEY_COL[None, None, :] * key[..., None] +
                      BOUNCE_COL[None, None, :] * ((0.5 - 0.5 * up) * aom)[..., None])
        colr *= gmul[..., None]
        colr += RIM_COL[None, None, :] * (rim * 0.42)[..., None] * (0.35 + 0.65 * alb)
        np.clip(colr, 0, 1, out=colr)
        region = self.buf[y0:y1, x0:x1, :3]
        a3 = alpha[..., None]
        region[:] = (region.astype(np.float32) * (1 - a3) + colr * (255.0 * a3) + 0.5).astype(np.uint8)

    # ------------------------------------------------------------------ cards
    def _draw_card(self, canvas, cd, pts, shade, front_face, clip_poly=None, ealpha=1.0):
        w, h = cd.w, cd.h
        m = skia.Matrix()
        if not m.setPolyToPoly([skia.Point(0, 0), skia.Point(w, 0), skia.Point(w, h), skia.Point(0, h)],
                               [skia.Point(*pts[0]), skia.Point(*pts[1]), skia.Point(*pts[2]), skia.Point(*pts[3])]):
            return
        use_front = front_face or cd.emis or cd.both
        paint = skia.Paint(AntiAlias=True)
        varying = False
        if cd.emis:
            paint.setBlendMode(skia.BlendMode.kPlus)
        else:
            sh = shade[..., :3]
            mn = sh.reshape(-1, 3).min(0).astype(np.int32)
            mx = sh.reshape(-1, 3).max(0).astype(np.int32)
            varying = int((mx - mn).max()) > 9
            if not varying:
                cm = sh.reshape(-1, 3).mean(0) / 255.0
                paint.setColorFilter(skia.ColorFilters.Blend(skia.Color4f(float(cm[0]), float(cm[1]), float(cm[2]), 1.0), None,
                                                             skia.BlendMode.kModulate))
        if varying:
            # device-space layer around everything this card draws
            x0 = y0 = 1e9
            x1 = y1 = -1e9
            lx0 = ly0 = 1e9
            lx1 = ly1 = -1e9
            for L in cd.layers:
                spr, A = L[0], L[1]
                rl = A.mapRect(skia.Rect(0, 0, spr.pw, spr.ph))
                if cd.clip:
                    rl.intersect(skia.Rect(0, 0, w, h))
                lx0 = min(lx0, rl.left()); ly0 = min(ly0, rl.top()); lx1 = max(lx1, rl.right()); ly1 = max(ly1, rl.bottom())
            rd = m.mapRect(skia.Rect(lx0, ly0, lx1, ly1))
            canvas.saveLayer(skia.Rect(rd.left() - 2, rd.top() - 2, rd.right() + 2, rd.bottom() + 2), None)
        else:
            canvas.save()
        canvas.concat(m)
        if clip_poly is not None:
            pa = skia.Path()
            pa.moveTo(*clip_poly[0])
            for p_ in clip_poly[1:]:
                pa.lineTo(*p_)
            pa.close()
            canvas.clipPath(pa, True)
        if cd.clip:
            canvas.clipRect(skia.Rect(0, 0, w, h), True)
        for L in cd.layers:
            spr, A, al = L[0], L[1], L[2]
            img = spr.img if use_front else spr.back
            paint.setAlphaf(min(1.0, al * cd.alpha * ealpha))
            canvas.save()
            canvas.concat(A)
            if len(L) > 3 and L[3] is not None:
                r = skia.Rect(L[3][0], 0, L[3][1], spr.ph)
                canvas.drawImageRect(img, r, r, SAMP, paint)
            else:
                canvas.drawImage(img, 0, 0, SAMP, paint)
            canvas.restore()
        if varying:
            simg = skia.Image.fromarray(shade, colorType=RGBA, alphaType=OPAQUE)
            p2 = skia.Paint()
            p2.setBlendMode(skia.BlendMode.kModulate)
            p2.setShader(simg.makeShader(CLAMP, CLAMP, SAMP_LIN, skia.Matrix.Scale(w / G, h / G)))
            canvas.drawRect(skia.Rect(lx0 - 0.01, ly0 - 0.01, lx1 + 0.01, ly1 + 0.01), p2)
        canvas.restore()

    @staticmethod
    def _clip_local(cd, a, b, c):
        """Clip an enlarged card rect by half-plane a*x+b*y+c>=0 (card-local coords)."""
        w, h = cd.w, cd.h
        poly = [(-w, -h), (2 * w, -h), (2 * w, 2 * h), (-w, 2 * h)]
        out = []
        n = len(poly)
        for i in range(n):
            p, q = poly[i], poly[(i + 1) % n]
            dp = a * p[0] + b * p[1] + c
            dq = a * q[0] + b * q[1] + c
            if dp >= 0:
                out.append(p)
            if (dp >= 0) != (dq >= 0):
                t = dp / (dp - dq)
                out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
        return out if len(out) >= 3 else None

    # ------------------------------------------------------------------ frame
    def render(self, fi, post=True):
        t = (fi % core.NF) / core.FPS
        cam = core.Camera(t, self.ss, self.w, self.h)
        self._set_light(cam.right, cam.up, cam.back)
        Gm = core.globe_matrix(t)
        cards = self.scene.cards(t, Gm, cam)
        N = len(cards)
        O = np.array([c.O for c in cards]); X = np.array([c.X for c in cards]); Y = np.array([c.Y for c in cards])
        wh = np.array([(c.w, c.h) for c in cards])
        P0 = O; P1 = O + X * wh[:, :1]; P3 = O + Y * wh[:, 1:]; P2 = P1 + Y * wh[:, 1:]
        corners = np.stack([P0, P1, P2, P3], 1)       # (N,4,3)
        centers = corners.mean(1)
        nrm = np.cross(X, Y)
        nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-12
        facing = np.einsum('id,id->i', nrm, cam.C[None, :] - centers)
        front_face = facing > 0
        nvis = nrm * np.where(front_face, 1.0, -1.0)[:, None]

        lmap = self._draw_lightmap(cards, corners)
        shades = self._shade_cards(cards, O, X, Y, wh, nvis, lmap)

        scr, z = cam.project(corners)                  # (N,4,2), (N,4)
        bbox = np.concatenate([scr.min(1), scr.max(1)], 1)
        depth = z.mean(1) + np.array([c.sortz for c in cards])
        sd = corners @ cam.chat - cam.limb_k           # signed distance to limb plane
        (gcx, gcy), grs = cam.globe_disc()
        rad = np.hypot(scr[..., 0] - gcx, scr[..., 1] - gcy)
        hidden = (sd.max(1) < 0) & (rad.max(1) < grs - 2)
        offscr = (bbox[:, 2] < -50) | (bbox[:, 0] > self.Wp + 50) | (bbox[:, 3] < -50) | (bbox[:, 1] > self.Hp + 50)
        area = 0.5 * np.abs((scr[:, 2, 0] - scr[:, 0, 0]) * (scr[:, 3, 1] - scr[:, 1, 1]) -
                            (scr[:, 3, 0] - scr[:, 1, 0]) * (scr[:, 2, 1] - scr[:, 0, 1]))
        ok = ~hidden & ~offscr & (area > 0.6)
        # a sheet of paper seen exactly edge-on is almost nothing: fade it instead of drawing a hairline
        vv = cam.C[None, :] - centers
        edge_on = np.abs(facing) / np.linalg.norm(vv, axis=1)
        self._edge_alpha = np.clip(edge_on / 0.045, 0.0, 1.0)
        ok &= self._edge_alpha > 0.02
        in_back = ok & (sd.min(1) < 0)
        in_front = ok & (sd.max(1) >= 0)

        c = self.canvas
        if self.backdrop is not None:
            self.backdrop.draw(c, self.buf, t, cam)
        else:
            c.clear(skia.Color4f(0.12, 0.09, 0.25, 1))

        def run(idx, clipped):
            if len(idx) == 0:
                return
            order = _order(corners[idx], nrm[idx], centers[idx], depth[idx], bbox[idx], cam.C)
            for k in order:
                i = idx[k]
                cd = cards[i]
                simg = shades[i]
                cp = None
                if clipped and sd[i].min() < 0:
                    cp = self._clip_local(cd, float(cd.X @ cam.chat), float(cd.Y @ cam.chat),
                                          float(cd.O @ cam.chat) - cam.limb_k)
                    if cp is None:
                        continue
                self._draw_card(c, cd, scr[i], simg, bool(front_face[i]), cp, float(self._edge_alpha[i]))

        run(np.nonzero(in_back)[0], False)

        # contact AO buffer (half res)
        ac = self.aosurf.getCanvas()
        ac.clear(skia.Color4f(0, 0, 0, 0))
        ap = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style)
        ap.setStrokeCap(skia.Paint.kRound_Cap)
        pxR = cam.f / core.CAM_D / 2.0     # half-res pixels per globe radius
        ap.setMaskFilter(skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, 0.011 * pxR))
        for i in np.nonzero(in_front)[0]:
            cd = cards[i]
            if cd.contact <= 0.01:
                continue
            ap.setColor4f(skia.Color4f(0, 0, 0, min(1.0, 0.85 * cd.contact)))
            ap.setStrokeWidth(max(1.0, 0.020 * pxR))
            ac.drawLine(scr[i, 0, 0] / 2, scr[i, 0, 1] / 2, scr[i, 1, 0] / 2, scr[i, 1, 1] / 2, ap)
        ao_small = self.aosurf.toarray().reshape(self.Hp // 2, self.Wp // 2)

        self._sphere(cam, Gm, lmap, ao_small)
        run(np.nonzero(in_front)[0], True)

        if not post:
            return self.buf
        out = cv2.resize(self.buf[..., :3], (self.w, self.h), interpolation=cv2.INTER_AREA).astype(np.float32)
        out *= self.vig
        return np.clip(out + 0.5, 0, 255).astype(np.uint8)   # RGB
