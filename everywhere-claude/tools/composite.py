# Composite a rendered character (RGBA + json anchors) into a plate with grading, contact shadow, light wrap, blur, grain.
# python3 composite.py spec.json   (spec: {plate, out, chars:[...], panel:{crop:[cx,cy], label}})
import cv2, numpy as np, json, sys

def load_rgba(p):
    im = cv2.imread(p, cv2.IMREAD_UNCHANGED).astype(np.float32) / 255.0
    return im[:, :, :3], im[:, :, 3]

def place(plate, c):
    H, W = plate.shape[:2]
    rgb, a = load_rgba(c['sprite']); meta = json.load(open(c['sprite'].replace('.png', '.json')))
    anchor = np.array(meta[c.get('anchor', 'foot')], np.float32)
    # scale: either px per unit (3D renders) or a plain factor (pixel sprites: integer, nearest)
    s = c['unitPx'] / meta['unitPx'] if 'unitPx' in c else c.get('scale', 1.0)
    interp = cv2.INTER_NEAREST if c.get('pixel') else cv2.INTER_AREA
    if c.get('flip'): rgb = rgb[:, ::-1]; a = a[:, ::-1]; anchor[0] = rgb.shape[1] - anchor[0]
    rgb = cv2.resize(rgb, None, fx=s, fy=s, interpolation=interp); a = cv2.resize(a, None, fx=s, fy=s, interpolation=interp); anchor *= s
    # rotate about the anchor (roll to match the plate's vertical)
    if c.get('roll'):
        pad = int(max(rgb.shape[:2]) * 0.5)
        rgb = cv2.copyMakeBorder(rgb, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0); a = cv2.copyMakeBorder(a, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0); anchor += pad
        M = cv2.getRotationMatrix2D((float(anchor[0]), float(anchor[1])), c['roll'], 1.0)
        fl = cv2.INTER_NEAREST if c.get('pixel') else cv2.INTER_LINEAR
        rgb = cv2.warpAffine(rgb, M, (rgb.shape[1], rgb.shape[0]), flags=fl); a = cv2.warpAffine(a, M, (a.shape[1], a.shape[0]), flags=fl)
    # full-frame layers
    ox, oy = int(round(c['at'][0] - anchor[0])), int(round(c['at'][1] - anchor[1]))
    L = np.zeros((H, W, 3), np.float32); A = np.zeros((H, W), np.float32)
    x0, y0 = max(0, ox), max(0, oy); x1, y1 = min(W, ox + rgb.shape[1]), min(H, oy + rgb.shape[0])
    L[y0:y1, x0:x1] = rgb[y0 - oy:y1 - oy, x0 - ox:x1 - ox]; A[y0:y1, x0:x1] = a[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
    return L, A

def comp(spec):
    plate = cv2.imread(spec['plate']).astype(np.float32) / 255.0; H, W = plate.shape[:2]; out = plate.copy()
    for c in spec['chars']:
        L, A = place(plate, c)
        ys, xs = np.nonzero(A > 0.05); bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max(); cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2
        r = int(max(bx1 - bx0, by1 - by0) * 1.5) + 40
        reg = plate[max(0, int(cy) - r):int(cy) + r, max(0, int(cx) - r):int(cx) + r].reshape(-1, 3)
        env = reg.mean(0); g = c.get('grade', {})
        # 1) contact shadow (soft ellipse under the feet, multiplied into the plate)
        sh = c.get('shadow')
        if sh:
            m = np.zeros((H, W), np.float32)
            cv2.ellipse(m, (int(sh['at'][0]), int(sh['at'][1])), (int(sh['rx']), int(sh['ry'])), sh.get('ang', 0), 0, 360, 1.0, -1)
            m = cv2.GaussianBlur(m, (0, 0), sh.get('soft', 8)) * sh.get('op', 0.5)
            core = np.zeros((H, W), np.float32)
            cv2.ellipse(core, (int(sh['at'][0]), int(sh['at'][1])), (int(sh['rx'] * 0.6), int(sh['ry'] * 0.45)), sh.get('ang', 0), 0, 360, 1.0, -1)
            m = np.clip(m + cv2.GaussianBlur(core, (0, 0), sh.get('soft', 8) * 0.4) * sh.get('op', 0.5) * 0.6, 0, 0.9)
            tint = np.array(sh.get('tint', [1.0, 0.95, 0.9]), np.float32)   # BGR multiplier for the shadowed colour (cool sky fill)
            out = out * (1 - m[..., None]) + out * tint * 0.35 * m[..., None]
        # 2) grade the character towards the plate
        Lg = L.copy()
        Lg = Lg * g.get('exposure', 1.0)
        wb = (env / env.mean()) ** g.get('wb', 0.35); Lg = Lg * wb
        lum = Lg.mean(2, keepdims=True); Lg = lum + (Lg - lum) * g.get('sat', 0.95)
        haze = np.array(g['hazeCol'], np.float32)[::-1] / 255 if 'hazeCol' in g else env
        Lg = Lg * (1 - g.get('haze', 0.0)) + haze * g.get('haze', 0.0)
        bl = np.minimum(np.percentile(plate.reshape(-1, 3), 0.5, axis=0), 0.12) * g.get('lift', 0.5); Lg = bl + Lg * (1 - bl)
        # 3) optics: blur (match plate softness), motion blur
        Ap = A.copy()
        if c.get('mblur'):
            ang, ln = c['mblur']; k = np.zeros((ln * 2 + 1, ln * 2 + 1), np.float32); cv2.line(k, (ln - int(np.cos(np.radians(ang)) * ln), ln - int(np.sin(np.radians(ang)) * ln)), (ln + int(np.cos(np.radians(ang)) * ln), ln + int(np.sin(np.radians(ang)) * ln)), 1, 1); k /= k.sum()
            Lg = cv2.filter2D(Lg * Ap[..., None], -1, k); Ap = cv2.filter2D(Ap, -1, k); Lg = Lg / np.maximum(Ap[..., None], 1e-4)
        if g.get('blur', 0) > 0:
            pm = cv2.GaussianBlur(Lg * Ap[..., None], (0, 0), g['blur']); Ap = cv2.GaussianBlur(Ap, (0, 0), g['blur']); Lg = pm / np.maximum(Ap[..., None], 1e-4)
        # 4) light wrap: the blurred plate bleeds onto the character's edges
        if g.get('wrap', 0.25) > 0:
            pb = cv2.GaussianBlur(plate, (0, 0), 14); edge = np.clip(Ap - cv2.GaussianBlur(cv2.erode(Ap, np.ones((9, 9))), (0, 0), 5), 0, 1)
            Lg = Lg * (1 - edge[..., None] * g.get('wrap', 0.25)) + pb * edge[..., None] * g.get('wrap', 0.25)
        # 5) grain matched to the plate (luma noise)
        rng = np.random.default_rng(1); nz = rng.normal(0, g.get('grain', 0.012), (H, W, 1)).astype(np.float32)
        nz = cv2.GaussianBlur(nz, (0, 0), 0.7)[..., None] * 1.6 if g.get('grain', 0.012) else 0
        Lg = Lg + nz
        out = out * (1 - Ap[..., None]) + np.clip(Lg, 0, 1) * Ap[..., None]
    return np.clip(out, 0, 1)

if __name__ == '__main__':
    spec = json.load(open(sys.argv[1])); res = comp(spec); res8 = (res * 255 + 0.5).astype(np.uint8)
    cv2.imwrite(spec['out'].replace('.png', '_full.png'), res8)
    # presentation: the whole frame at half size + a 1:1 crop around the character
    H, W = res8.shape[:2]; half = cv2.resize(res8, (W // 2, H // 2), interpolation=cv2.INTER_AREA)
    panels = [half]
    for cr in spec.get('crops', []):
        cx, cy = cr['at']; z = cr.get('zoom', 1.0); w, h = int(540 / z), int(960 / z)
        x0 = int(np.clip(cx - w / 2, 0, W - w)); y0 = int(np.clip(cy - h / 2, 0, H - h))
        crop = cv2.resize(res8[y0:y0 + h, x0:x0 + w], (540, 960), interpolation=cv2.INTER_NEAREST if z > 1 else cv2.INTER_AREA)
        cv2.rectangle(half, (x0 // 2, y0 // 2), ((x0 + w) // 2, (y0 + h) // 2), (255, 255, 255), 2)
        panels.append(crop)
    sheet = np.full((960, 540 * len(panels) + 12 * (len(panels) - 1), 3), 18, np.uint8)
    for i, p in enumerate(panels): sheet[:, i * 552:i * 552 + 540] = p
    cv2.imwrite(spec['out'], sheet); print(spec['out'], sheet.shape)
