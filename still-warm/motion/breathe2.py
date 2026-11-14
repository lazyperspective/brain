# "Still Warm — the sky breathes", refined.  20 s seamless loop.
#   python3 breathe2.py <datadir> <out.mp4> <frame_from> <frame_to>      (frames at 30 fps, 0..599)
#   python3 breathe2.py <datadir> <sheet.jpg> stills t1,t2,...
import sys, json, subprocess, numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates, gaussian_filter, distance_transform_edt, label

D = sys.argv[1]; out = sys.argv[2]
base = np.asarray(Image.open(D + '/base.png').convert('RGB')).astype(np.float32) / 255
H, W = base.shape[:2]; SC = W / 1920              # 1.0 at 1080p, 2.0 at 4K
FPS, L = 30, 20.0
ld = lambda n, dt=np.float32: np.fromfile(f'{D}/{n}.bin', dtype=dt).reshape(H, W)
sM, dawn, sH = ld('sM'), ld('dawn'), ld('sH')
sky = ld('sky', np.uint8)
G = json.load(open(D + '/geo.json')); MT, HL = G['MT'], G['HL']
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
rng = np.random.default_rng(11)
def ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def screen(img, add): return 1 - (1 - img) * (1 - np.clip(add, 0, 1))
def glow(cx, cy, rad, strength, col):
    return np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * rad * rad))[..., None] * strength * np.array(col, np.float32)

# ---- the breath: two breaths per loop, a long one and a smaller, shorter one; inhale quicker than exhale ----
def _curve(t):
    def one(t, t0, ti, th, te, amp):   # start, inhale end, hold end, exhale end
        if t < t0 or t > te: return 0.0
        if t < ti: x = (t - t0) / (ti - t0); return amp * (0.5 - 0.5 * np.cos(np.pi * x))
        if t < th: return amp
        x = (t - th) / (te - th); return amp * (0.5 + 0.5 * np.cos(np.pi * x)) ** 1.15
    return one(t, 0.0, 3.9, 4.7, 10.2, 1.0) + one(t, 10.2, 13.9, 14.5, 20.0, 0.78)
TAB_T = np.linspace(0, L, 4001); TAB_B = np.array([_curve(t) for t in TAB_T], np.float32)
def breath(t): return np.interp(np.mod(t, L), TAB_T, TAB_B).astype(np.float32)

# ---- where the sky may move: inside the sky, easing to stillness at every edge it touches ----
dist = distance_transform_edt(sky).astype(np.float32)
env = ss(0, 70 * SC, dist) * ss(1.0, 1.45, sM)
lag = np.clip((sM - 1.0) * 1.15, 0, 2.4).astype(np.float32)        # outer rings breathe later: the breath travels outward
dx, dy = xx - MT[0], yy - MT[1]
A_SWELL, A_SWAY = 0.021, 0.0055

# ---- stars, found in the drawing itself; each twinkles at its own whole-number rate so the loop closes ----
luma = base @ np.array([0.299, 0.587, 0.114], np.float32)
starm = ((luma - gaussian_filter(luma, 4 * SC)) > 0.16) & (sky > 0) & (dawn < 0.62)
lab, n = label(starm)
rate = rng.integers(2, 7, n + 1).astype(np.float32); ph = rng.random(n + 1).astype(np.float32)
STR = lab > 0; SR, SP = rate[lab][STR], ph[lab][STR]
starsoft = gaussian_filter(starm.astype(np.float32), 1.2 * SC)

# ---- gold glints on the hearth-gold ----
r, g, b = base[..., 0], base[..., 1], base[..., 2]
gold = (r > 0.62) & (g > 0.45) & (b < 0.38) & (r - b > 0.32)
gy, gx = np.nonzero(gold)
pick = rng.choice(len(gx), size=min(380, len(gx)), replace=False)
GL = np.stack([gx[pick], gy[pick]], 1); GLk = rng.integers(1, 4, len(GL)); GLp = rng.random(len(GL))
KS = int(9 * SC); kk = np.arange(-KS, KS + 1)
star_k = (np.exp(-np.abs(kk) / (2.4 * SC))[None, :] * (np.abs(kk)[:, None] < 1.2 * SC) + np.exp(-np.abs(kk) / (2.4 * SC))[:, None] * (np.abs(kk)[None, :] < 1.2 * SC))
star_k = np.maximum(star_k, np.exp(-(kk[:, None] ** 2 + kk[None, :] ** 2) / (3.5 * SC * SC))).astype(np.float32); star_k /= star_k.max()

# ---- chalk motes: specks of pastel dust lifting off the sky, outward with the breath ----
NM = 46
sy_, sx_ = np.nonzero((sky > 0) & (dist > 90 * SC) & (sM > 1.15) & (sM < 2.4))
mi = rng.choice(len(sx_), NM, replace=False)
M0 = np.stack([sx_[mi], sy_[mi]], 1).astype(np.float32)
Mdir = (M0 - np.array(MT, np.float32)); Mdir /= np.linalg.norm(Mdir, axis=1, keepdims=True)
Mph = rng.random(NM); Mcy = rng.integers(1, 3, NM); Msz = (1.6 + 2.2 * rng.random(NM)) * SC
Mcol = np.array([[1.0, 0.95, 0.85], [1.0, 0.86, 0.6], [0.88, 0.92, 1.0], [1.0, 0.82, 0.86]], np.float32)[rng.integers(0, 4, NM)]

def frame(t):
    u = t / L
    # stars and gold glints are painted onto the sheet first, so they ride the breath with the sky
    tw = 0.5 + 0.5 * np.sin(2 * np.pi * (SR * u + SP))
    stl = np.zeros((H, W), np.float32); stl[STR] = tw ** 2 * 0.7
    stl = np.maximum(stl, gaussian_filter(stl, 1.5 * SC) * 1.6) * (starsoft > 0.02)
    img = screen(base, stl[..., None] * np.array([1.0, 0.97, 0.9], np.float32))
    gl = np.zeros((H, W), np.float32)
    v = np.clip(np.sin(2 * np.pi * (GLk * u + GLp)), 0, 1) ** 10 * 0.55
    for (x, y), a in zip(GL, v):
        if a < 0.03 or x < KS or y < KS or x >= W - KS or y >= H - KS: continue
        gl[y - KS:y + KS + 1, x - KS:x + KS + 1] = np.maximum(gl[y - KS:y + KS + 1, x - KS:x + KS + 1], star_k * a)
    img = screen(img, gl[..., None] * np.array([1.0, 0.9, 0.62], np.float32))
    # the breath: every ring swells outward and turns a hair, the outer ones a moment later
    bb = breath(t - lag)
    k = 1 + A_SWELL * bb * env
    sw = A_SWAY * bb * env * np.clip(sM - 1, 0, 1.5)
    c, s = np.cos(sw), np.sin(sw)
    sx = MT[0] + (c * dx + s * dy) / k
    sy = MT[1] + (-s * dx + c * dy) / k
    img = np.stack([map_coordinates(img[..., ch], [sy, sx], order=1, mode='nearest') for ch in range(3)], -1)
    # morning answers a beat behind; the heart glows at the top of each inhale; the hill, at the end of each exhale
    b0, b1 = float(breath(t)), float(breath(t - 1.6))
    img = screen(img, (0.045 * b1 * dawn * (sky > 0))[..., None] * np.array([1.0, 0.86, 0.74], np.float32))
    img = screen(img, glow(MT[0], MT[1] - 16 * SC, 60 * SC, 0.13 * b0, [1.0, 0.72, 0.4]))
    b2 = float(breath(t - 3.2))
    img = screen(img, glow(HL[0], HL[1] - 14 * SC, 70 * SC, 0.1 * b2, [1.0, 0.86, 0.6]))
    # motes
    lay = np.zeros((H, W, 3), np.float32)
    for i in range(NM):
        q = (Mcy[i] * u + Mph[i]) % 1.0
        a = np.sin(np.pi * q) ** 2 * 0.5
        p = M0[i] + Mdir[i] * (q * 150 * SC + 26 * SC * b0) + np.array([0, -q * 40 * SC])
        x, y, rr = p[0], p[1], Msz[i]
        x0, x1, y0, y1 = int(max(0, x - 4 * rr)), int(min(W, x + 4 * rr)), int(max(0, y - 4 * rr)), int(min(H, y + 4 * rr))
        if x1 <= x0 or y1 <= y0: continue
        d2 = (xx[y0:y1, x0:x1] - x) ** 2 + (yy[y0:y1, x0:x1] - y) ** 2
        lay[y0:y1, x0:x1] = np.maximum(lay[y0:y1, x0:x1], (np.exp(-d2 / (2 * rr * rr)) * a)[..., None] * Mcol[i])
    return screen(img, lay)

if out.endswith('.jpg'):
    ts = [float(x) for x in sys.argv[4].split(',')]
    ims = [Image.fromarray((np.clip(frame(t), 0, 1) * 255 + .5).astype(np.uint8)).resize((960, 540), Image.LANCZOS) for t in ts]
    sh = Image.new('RGB', (960 * min(3, len(ims)), 540 * ((len(ims) + 2) // 3)))
    for i, im in enumerate(ims): sh.paste(im, (960 * (i % 3), 540 * (i // 3)))
    sh.save(out); sys.exit()
f0, f1 = int(sys.argv[3]), int(sys.argv[4])
ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                       '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-x264-params', 'rc-lookahead=20', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
for i in range(f0, f1):
    ff.stdin.write((np.clip(frame(i / FPS), 0, 1) * 255 + 0.5).astype(np.uint8).tobytes())
ff.stdin.close(); ff.wait(); print('done', out)
