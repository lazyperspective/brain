# Three 10-second looping motion prototypes for "Still Warm".   python3 motion.py <remember|gold|breathe> out.mp4 [frames]
import sys, json, subprocess, numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates, gaussian_filter, distance_transform_edt

W, H, FPS, DUR = 1920, 1080, 30, 10.0
mode, out = sys.argv[1], sys.argv[2]
NF = int(sys.argv[3]) if len(sys.argv) > 3 and not sys.argv[2].endswith('.jpg') else int(FPS * DUR)
base = np.asarray(Image.open('base.png').convert('RGB')).astype(np.float32) / 255
rem = np.asarray(Image.open('remember.png').convert('RGB')).astype(np.float32) / 255
ld = lambda n, dt=np.float32: np.fromfile(n + '.bin', dtype=dt).reshape(H, W)
sM, gone, dawn, sH = ld('sM'), ld('gone'), ld('dawn'), ld('sH')
sky = ld('sky', np.uint8).astype(np.float32)
G = json.load(open('geo.json'))
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
rng = np.random.default_rng(7)
ss = lambda a, b, x: np.clip((x - a) / (b - a), 0, 1) ** 2 * (3 - 2 * np.clip((x - a) / (b - a), 0, 1))
def sm1(a, b, x):  # scalar smoothstep
    t = min(1, max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
luma = base @ np.array([0.299, 0.587, 0.114], np.float32)
r, g, b = base[..., 0], base[..., 1], base[..., 2]
goldmask = ((r > 0.62) & (g > 0.45) & (b < 0.38) & (r - b > 0.32)).astype(np.float32)   # hearth-gold pixels
noise = gaussian_filter(rng.standard_normal((H, W)).astype(np.float32), 18); noise /= noise.std()
fine = gaussian_filter(rng.standard_normal((H, W)).astype(np.float32), 3); fine /= fine.std()

def glow(cx, cy, rad, strength, col):
    d2 = (xx - cx) ** 2 + (yy - cy) ** 2
    return np.exp(-d2 / (2 * rad * rad))[..., None] * strength * np.array(col, np.float32)

def screen(img, add): return 1 - (1 - img) * (1 - np.clip(add, 0, 1))

# sparkle sites on the gold, each with its own slow phase (periodic over the loop)
gy, gx = np.nonzero(goldmask)
pick = rng.choice(len(gx), size=min(520, len(gx)), replace=False)
SP = np.stack([gx[pick], gy[pick]], 1).astype(np.float32)
SPph = rng.random(len(SP)); SPk = rng.integers(1, 4, len(SP))
star_k = np.zeros((15, 15), np.float32); c = 7
for i in range(15):
    star_k[c, i] += np.exp(-abs(i - c) / 2.2); star_k[i, c] += np.exp(-abs(i - c) / 2.2)
star_k += np.exp(-((np.arange(15)[:, None] - c) ** 2 + (np.arange(15)[None] - c) ** 2) / 3.0)
star_k /= star_k.max()

def sparkles(img, t, amt):
    lay = np.zeros((H, W), np.float32)
    v = np.clip(np.sin(2 * np.pi * (SPk * t / DUR + SPph)), 0, 1) ** 8 * amt
    for (x, y), a in zip(SP.astype(int), v):
        if a < 0.03 or x < 8 or y < 8 or x > W - 8 or y > H - 8: continue
        lay[y - 7:y + 8, x - 7:x + 8] = np.maximum(lay[y - 7:y + 8, x - 7:x + 8], star_k * a)
    return screen(img, lay[..., None] * np.array([1.0, 0.92, 0.66], np.float32))

MT, HL = G['MT'], G['HL']

# ---------------- option 1: the ghost remembers ----------------
def f_remember(t):
    # memory comes back ring by ring from the warm heart, holds for a breath, then is rubbed out again
    u = t / DUR
    R = 0.28 + 0.78 * (sm1(0.12, 0.45, u) - sm1(0.58, 0.9, u))
    front = R + 0.07 * noise + 0.02 * fine
    a = ss(-0.035, 0.035, front - sM) * gone * (0.92 - 0.18 * ss(0.6, 1.0, sM))
    img = base * (1 - a[..., None]) + rem * a[..., None]
    # the leading edge glows faintly, like a coal being blown on
    edge = np.exp(-((sM - front) / 0.022) ** 2) * gone * (R > 0.32) * 0.22
    img = screen(img, edge[..., None] * np.array([1.0, 0.75, 0.45], np.float32))
    heart = 0.5 + 0.5 * np.sin(2 * np.pi * u * 2 - 1.2)
    img = screen(img, glow(MT[0], MT[1] - 18, 70, 0.10 + 0.10 * heart, [1.0, 0.7, 0.35]))
    return sparkles(img, t, 0.35 + 0.65 * (R - 0.28) / 0.78)

# ---------------- option 2: the gold travels ----------------
def path_arrays(P):
    P = np.array(P, np.float32).reshape(-1, 2)
    seg = np.hypot(*np.diff(P, axis=0).T); s = np.concatenate([[0], np.cumsum(seg)])
    return P, s
P1, L1 = path_arrays(G['T1']); P2, L2 = path_arrays(G['T2'])
def nearest_arc(P, L, maxd=16):
    # for pixels near the path: arc length of the nearest path point, else -1
    m = np.zeros((H, W), bool); idx = np.full((H, W), -1, np.int32)
    for i in range(0, len(P), 2):
        x, y = int(P[i, 0]), int(P[i, 1])
        x0, x1, y0, y1 = max(0, x - maxd), min(W, x + maxd), max(0, y - maxd), min(H, y + maxd)
        sub = (xx[y0:y1, x0:x1] - P[i, 0]) ** 2 + (yy[y0:y1, x0:x1] - P[i, 1]) ** 2
        cur = idx[y0:y1, x0:x1]
        old = np.where(cur >= 0, (xx[y0:y1, x0:x1] - P[np.maximum(cur, 0), 0]) ** 2 + (yy[y0:y1, x0:x1] - P[np.maximum(cur, 0), 1]) ** 2, 1e9)
        better = (sub < old) & (sub < maxd * maxd)
        cur[better] = i
    arc = np.where(idx >= 0, L[np.maximum(idx, 0)], -1).astype(np.float32)
    d = np.where(idx >= 0, np.hypot(xx - P[np.maximum(idx, 0), 0], yy - P[np.maximum(idx, 0), 1]), 99).astype(np.float32)
    return arc, d
A1, D1 = nearest_arc(P1, L1); A2, D2 = nearest_arc(P2, L2)
def ptat(P, L, s):
    i = int(np.clip(np.searchsorted(L, s), 1, len(L) - 1)); f = (s - L[i - 1]) / max(1e-6, L[i] - L[i - 1])
    return P[i - 1] + (P[i] - P[i - 1]) * f
def bead(img, P, L, A, D, p, amp, trail):
    s = p * L[-1]
    tr = np.where(A >= 0, np.exp(-np.maximum(0, s - A) / trail) * (A <= s + 4), 0) * np.exp(-(D / 5.5) ** 2) * amp
    img = screen(img, tr[..., None] * np.array([1.0, 0.82, 0.45], np.float32) * (0.5 + 0.5 * goldmask[..., None] + 0.3))
    x, y = ptat(P, L, s)
    img = screen(img, glow(x, y, 9, 0.85 * amp, [1.0, 0.95, 0.8]))
    return screen(img, glow(x, y, 34, 0.35 * amp, [1.0, 0.72, 0.35]))
hillmask = (sH < 1.0).astype(np.float32)
def f_gold(t):
    u = t / DUR; img = base.copy()
    p1 = sm1(0.06, 0.55, u)
    a1 = sm1(0.03, 0.08, u) * (1 - sm1(0.55, 0.62, u))
    if a1 > 0.01: img = bead(img, P1, L1, A1, D1, p1, a1, 160)
    p2 = sm1(0.30, 0.85, u); a2 = sm1(0.30, 0.36, u) * (1 - sm1(0.85, 0.92, u)) * 0.7
    if a2 > 0.01: img = bead(img, P2, L2, A2, D2, p2, a2, 220)
    # the hill answers each arrival: a warm ring travels out through its bands
    for arr in (0.57, 0.88):
        k = (u - arr) / 0.16
        if 0 < k < 1:
            ring = np.exp(-((sH - k * 1.05) / 0.07) ** 2) * hillmask * (1 - k) * 0.55
            img = screen(img, ring[..., None] * np.array([1.0, 0.9, 0.55], np.float32))
            img = screen(img, glow(HL[0], HL[1] - 10, 60, 0.35 * (1 - k), [1.0, 0.8, 0.45]))
    heart = 0.5 + 0.5 * np.cos(2 * np.pi * u)
    img = screen(img, glow(MT[0], MT[1] - 12, 40, 0.18 * heart, [1.0, 0.75, 0.4]))
    return sparkles(img, t, 0.9)

# ---------------- option 3: the sky breathes ----------------
feather = gaussian_filter(sky, 6) * ss(1.02, 1.25, sM)
star = ((luma > 0.78) & (sky > 0) & (dawn < 0.5)).astype(np.float32)
starph = gaussian_filter(rng.random((H, W)).astype(np.float32), 1.5); starph = (starph - starph.min()) / (np.ptp(starph) + 1e-6)
dx, dy = xx - MT[0], yy - MT[1]
def f_breathe(t):
    u = t / DUR
    k = 1 + 0.016 * np.sin(2 * np.pi * (u * 2) - (sM - 1) * 2.2) * ss(1.0, 1.4, sM)
    sx, sy = MT[0] + dx / k, MT[1] + dy / k
    warped = np.stack([map_coordinates(base[..., c], [sy, sx], order=1, mode='nearest') for c in range(3)], -1)
    img = base * (1 - feather[..., None]) + warped * feather[..., None]
    tw = 0.5 + 0.5 * np.sin(2 * np.pi * (u * 3 + starph * 4))
    img = screen(img, (star * tw * 0.55)[..., None])
    lift = (0.05 * np.sin(2 * np.pi * u) + 0.03) * dawn * sky
    img = screen(img, lift[..., None] * np.array([1.0, 0.85, 0.75], np.float32))
    return sparkles(img, t, 0.5)

F = {'remember': f_remember, 'gold': f_gold, 'breathe': f_breathe}[mode]

if out.endswith('.jpg'):
    ts=[float(x) for x in sys.argv[3].split(',')]
    ims=[Image.fromarray((np.clip(F(t),0,1)*255).astype(np.uint8)).resize((640,360)) for t in ts]
    sheet=Image.new('RGB',(640*len(ims),360))
    for i,im in enumerate(ims): sheet.paste(im,(640*i,0))
    sheet.save(out); sys.exit()
ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                       '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], stdin=subprocess.PIPE)
for i in range(NF):
    fr = F(i / FPS)
    ff.stdin.write((np.clip(fr, 0, 1) * 255 + 0.5).astype(np.uint8).tobytes())
    if mode == 'remember' or i % 30 == 0: pass
ff.stdin.close(); ff.wait()
print('done', mode, NF)
