# Shot runner: per-film-frame specs -> character renders -> composites (preview 540x960 or final 1080x1920 frames)
import numpy as np, cv2, os, json, math, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
import plates, rig, comp

ROOT = '/home/user/brain/everywhere-claude/v2'


class PlateStream:
    """sequential access to source frames k (0-based from t0) of a clip; supports fractional/blended requests in increasing order"""
    def __init__(self, clip, t0, nsrc):
        self.gen = plates.frames(clip, t0, nsrc); self.cache = {}; self.next = 0; self.n = nsrc

    def get(self, k):
        k = int(min(max(k, 0), self.n - 1))
        while self.next <= k:
            f = next(self.gen, None)
            if f is None: self.n = self.next; break
            self.cache[self.next] = f.astype(np.float32) / 255.0; self.next += 1
            for old in [c for c in self.cache if c < self.next - 8]: del self.cache[old]
        k = min(k, self.next - 1)
        return self.cache[k]

    def blend(self, ws):
        """ws: [(k, weight)]"""
        out = None
        for k, w in ws:
            f = self.get(k) * w
            out = f if out is None else out + f
        return out


def src_weights(kf, n_blend=1):
    """fractional source index -> weights. n_blend>1 averages that many consecutive frames (speed-up motion blur)"""
    if n_blend <= 1.01:
        k0 = int(math.floor(kf)); a = kf - k0
        return [(k0, 1 - a), (k0 + 1, a)] if a > 0.02 else [(k0, 1.0)]
    ks = np.linspace(kf - (n_blend - 1) / 2, kf + (n_blend - 1) / 2, int(round(n_blend * 2)) + 1)
    ws = {}
    for k in ks:
        k0 = int(math.floor(k)); a = k - k0
        ws[k0] = ws.get(k0, 0) + (1 - a); ws[k0 + 1] = ws.get(k0 + 1, 0) + a
    s = sum(ws.values()); return sorted([(k, w / s) for k, w in ws.items() if w > 1e-3])


def reframe(img, z=1.0, c=(540, 960), rot=0.0, out_size=(1080, 1920)):
    """digital push-in: scale z about plate point c (which lands at the frame centre-ish), keeping the frame filled"""
    W, H = 1080, 1920
    if abs(z - 1) < 1e-4 and abs(rot) < 1e-4 and out_size == (W, H): return img
    cx = np.clip(c[0], W / 2 / z, W - W / 2 / z); cy = np.clip(c[1], H / 2 / z, H - H / 2 / z)
    M = cv2.getRotationMatrix2D((float(cx), float(cy)), rot, z)
    M[0, 2] += W / 2 - cx; M[1, 2] += H / 2 - cy
    s = out_size[0] / W; M *= s
    return cv2.warpAffine(img, M, out_size, flags=cv2.INTER_CUBIC if z > 1 else cv2.INTER_AREA, borderMode=cv2.BORDER_REFLECT)


def motion_vectors(pts, shutter):
    """pts: list of (x,y) or None per frame -> per-frame blur vectors (px)"""
    out = []
    for i in range(len(pts)):
        a = pts[max(0, i - 1)]; b = pts[min(len(pts) - 1, i + 1)]
        if a is None or b is None or pts[i] is None: out.append((0.0, 0.0)); continue
        d = (np.array(b) - np.array(a)) / max(1, min(len(pts) - 1, i + 1) - max(0, i - 1))
        s = shutter[i] if hasattr(shutter, '__len__') else shutter
        out.append((float(d[0] * s), float(d[1] * s)))
    return out


def render_jobs(name, jobs, workers=None):
    d = f'{ROOT}/render/{name}'; os.makedirs(d, exist_ok=True)
    if workers is None: workers = pick_workers()
    rig.render(jobs, f'{d}/jobs.jsonl', workers=workers)


def pick_workers():
    try:
        mem = {l.split(':')[0]: int(l.split()[1]) for l in open('/proc/meminfo')}
        avail_gb = mem['MemAvailable'] / 1e6
        load = os.getloadavg()[0]
    except Exception:
        return 2
    w = 3 if avail_gb > 5 and load < 5 else 2
    return max(1, min(w, int(avail_gb // 1.2)))


def comp_shot(name, clip, t0, nsrc, frames, size='preview', sink=None, label=None):
    """frames: list of dict(src=[(k,w)], layers=[(out_prefix, grade, matte_fn)], reframe=(z,cx,cy,rot), post=fn(img)->img)
    size 'preview' -> writes jpgs to preview/<name>/ ; 'final' -> calls sink(frame_uint8_bgr) for each frame"""
    ps = PlateStream(clip, t0, nsrc)
    od = f'{ROOT}/preview/{name}'
    if size == 'preview': os.makedirs(od, exist_ok=True)
    for i, F in enumerate(frames):
        img = ps.blend(F['src']).copy()
        if F.get('pre'): img = F['pre'](img, i)
        for out, grade, matte in F.get('layers', []):
            if isinstance(out, dict): comp.composite(img, out, grade, matte=matte); continue
            if not os.path.exists(out + '.json'): continue
            L = rig.load_layer(out)
            comp.composite(img, L, grade, matte=matte)
        if F.get('post'): img = F['post'](img, i)
        z = F.get('reframe', (1.0, 540, 960, 0.0))
        if size == 'preview':
            o = reframe(img, z[0], (z[1], z[2]), z[3], out_size=(540, 960))
            cv2.imwrite(f'{od}/{i:04d}.jpg', (np.clip(o, 0, 1) * 255 + 0.5).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 90])
        else:
            o = reframe(img, z[0], (z[1], z[2]), z[3])
            sink((np.clip(o, 0, 1) * 255 + 0.5).astype(np.uint8))
    return len(frames)


def preview_mp4(name, fps=30):
    od = f'{ROOT}/preview/{name}'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(fps), '-i', f'{od}/%04d.jpg', '-c:v', 'libx264', '-crf', '23', '-preset', 'veryfast',
                    '-pix_fmt', 'yuv420p', f'{ROOT}/preview/{name}.mp4'], check=True)


def strip(name, idx, out, w=270):
    od = f'{ROOT}/preview/{name}'
    ims = []
    for i in idx:
        im = cv2.imread(f'{od}/{i:04d}.jpg')
        if im is None: continue
        im = cv2.resize(im, (w, int(w * 16 / 9)))
        cv2.putText(im, str(i), (5, 20), 0, 0.6, (0, 0, 0), 3); cv2.putText(im, str(i), (5, 20), 0, 0.6, (255, 255, 255), 1)
        ims.append(im)
    cv2.imwrite(out, np.hstack(ims), [cv2.IMWRITE_JPEG_QUALITY, 88])


def crop_png(name, i, box, out, scale=1.0):
    """full-res check crop: re-run would be needed; here we just crop the preview (half res) """
    im = cv2.imread(f'{ROOT}/preview/{name}/{i:04d}.jpg'); x0, y0, x1, y1 = [v // 2 for v in box]
    c = im[y0:y1, x0:x1]; cv2.imwrite(out, cv2.resize(c, None, fx=scale, fy=scale, interpolation=cv2.INTER_NEAREST))


def check_frames(clip, t0, frames, idxs, out, crop_half=(220, 300), centers=None, scale=1.0, full_w=270):
    """full-res composite of selected film frames; writes a sheet: per frame a reduced full view + a 1:1 crop around the character"""
    tiles = []
    for n, i in enumerate(idxs):
        F = frames[i]
        acc = None
        for k, w in F['src']:
            f = next(plates.frames(clip, t0 + k / 30.0, 1)).astype(np.float32) / 255.0
            acc = f * w if acc is None else acc + f * w
        img = acc
        if F.get('pre'): img = F['pre'](img, i)
        cxy = None
        for o, grade, matte in F.get('layers', []):
            if isinstance(o, dict): comp.composite(img, o, grade, matte=matte); continue
            if not os.path.exists(o + '.json'): continue
            L = rig.load_layer(o); comp.composite(img, L, grade, matte=matte)
            x0, y0, w, h = L['crop']; a = L['pm'][..., 3]
            ys, xs = np.nonzero(a > 0.1)
            if len(xs): cxy = (x0 + xs.mean(), y0 + ys.mean())
        if F.get('post'): img = F['post'](img, i)
        if centers and centers[n] is not None: cxy = centers[n]
        if cxy is None: cxy = (540, 960)
        z = F.get('reframe', (1.0, 540, 960, 0.0))
        full = reframe(img, z[0], (z[1], z[2]), z[3], out_size=(full_w, int(full_w * 16 / 9)))
        cw, ch = crop_half
        x0 = int(np.clip(cxy[0] - cw, 0, 1080 - 2 * cw)); y0 = int(np.clip(cxy[1] - ch, 0, 1920 - 2 * ch))
        c = img[y0:y0 + 2 * ch, x0:x0 + 2 * cw]
        if scale != 1.0: c = cv2.resize(c, None, fx=scale, fy=scale, interpolation=cv2.INTER_NEAREST if scale > 1 else cv2.INTER_AREA)
        c = cv2.resize(c, (int(c.shape[1] * full.shape[0] / c.shape[0]), full.shape[0]), interpolation=cv2.INTER_NEAREST) if c.shape[0] > full.shape[0] * 1.01 or c.shape[0] < full.shape[0] * 0.99 else c
        t = np.hstack([full, c]); t = (np.clip(t, 0, 1) * 255).astype(np.uint8)
        cv2.putText(t, str(i), (5, 22), 0, 0.7, (0, 0, 0), 3); cv2.putText(t, str(i), (5, 22), 0, 0.7, (255, 255, 255), 1)
        tiles.append(t)
    # grid: 2 per row
    rows = []
    for r in range(0, len(tiles), 2):
        row = tiles[r:r + 2]
        if len(row) < 2: row.append(np.zeros_like(row[0]))
        wmax = max(x.shape[1] for x in row)
        row = [np.pad(x, ((0, 0), (0, wmax - x.shape[1]), (0, 0))) for x in row]
        rows.append(np.hstack(row))
    cv2.imwrite(out, np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 90])


PIX = f'{ROOT}/render/pixel'


def make_pixel_sprites(name, face='y', k=0.6, scale=3, mouth='o', eyes='open', st=None):
    """render 3 glitch frames (growing fringe/tear) of the ORIGINAL pixel fighter -> paths"""
    os.makedirs(PIX, exist_ok=True)
    jobs = []
    for i, (fr, tear, T) in enumerate([(2, 0.5, 0.3), (3, 1.0, 0.42), (5, 1.7, 0.55)]):
        s = dict(eyes=eyes if i < 2 else 'x', mouth=mouth, wind=0.9); s.update(st or {})
        jobs.append(dict(out=f'{PIX}/{name}_{i}.png', opts=dict(k=k, face=face, scale=scale, T=T, st=s, fringe=fr, tear=tear)))
    p = f'{PIX}/{name}_jobs.json'; json.dump(jobs, open(p, 'w'))
    subprocess.run(['node', '/home/user/brain/everywhere-claude/char/render_pixel.js', p], check=True, stdout=subprocess.DEVNULL)
    return [j['out'] for j in jobs]


def pixel_layer(png, at, extra_scale=1, opacity=1.0):
    """layer dict (like rig.load_layer) for a pixel sprite placed with its foot point at plate point `at`"""
    im = cv2.imread(png, cv2.IMREAD_UNCHANGED).astype(np.float32) / 255.0
    meta = json.load(open(png.replace('.png', '.json')))
    if extra_scale != 1:
        im = cv2.resize(im, None, fx=extra_scale, fy=extra_scale, interpolation=cv2.INTER_NEAREST)
    fx, fy = meta['foot'][0] * extra_scale, meta['foot'][1] * extra_scale
    x0, y0 = int(round(at[0] - fx)), int(round(at[1] - fy))
    a = im[..., 3:4] * opacity
    return dict(crop=[x0, y0, im.shape[1], im.shape[0]], pm=np.concatenate([im[..., :3] * a, a], 2), shadow=None, pts={})


PIX_GRADE = dict(blur=0.0, wrap=0.0, grain=0.006, haze=0.0, sat=1.0, exposure=1.0, mblur=(0, 0))
