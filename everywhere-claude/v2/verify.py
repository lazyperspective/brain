# Verification + deliverables from the final mp4: contact sheet, stills, cut/beat table, scene-change detection, loudness.
import sys, subprocess, json, numpy as np, cv2, os
V2 = '/home/user/brain/everywhere-claude/v2'; OUT = '/home/user/brain/everywhere-claude/out'
sys.path.insert(0, V2)
import edit
MP4 = f'{OUT}/everywhere_claude.mp4'

def frames_at(idx):
    cap = cv2.VideoCapture(MP4); out = {}
    for i in sorted(idx):
        cap.set(cv2.CAP_PROP_POS_FRAMES, i); ok, f = cap.read()
        if ok: out[i] = f
    return out

ST, NF = edit.starts()
# 1) cuts vs beats (planned) + detected scene changes (luma histogram distance)
print('== cuts (s) and beat index (0.5 s grid)')
for n, t in ST.items(): print(f'  {n:8s} {t:6.3f}s  beat {t / 0.5:6.2f}')
cap = cv2.VideoCapture(MP4); prev = None; cuts = []; i = 0
while True:
    ok, f = cap.read()
    if not ok: break
    h = cv2.calcHist([cv2.resize(f, (135, 240))], [0, 1, 2], None, [8, 8, 8], [0, 256] * 3).ravel(); h /= h.sum() + 1e-9
    if prev is not None:
        d = 0.5 * np.abs(h - prev).sum()
        if d > 0.45: cuts.append((i, round(i / 30, 3), round(d, 2)))
    prev = h; i += 1
print('== detected scene changes (frame, s, dist):', cuts, ' total frames', i)
# 2) loudness
r = subprocess.run(['ffmpeg', '-hide_banner', '-i', MP4, '-map', '0:a', '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
print('== loudness'); print('\n'.join(l for l in r[r.rindex('Summary'):].splitlines() if any(k in l for k in ('I:', 'LRA:', 'Peak:'))))
# 3) audio pops: largest sample-to-sample jump vs local RMS
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', MP4, '-map', '0:a', '-ac', '1', '-ar', '48000', '/tmp/claude-0/chk.wav'], check=True)
import scipy.io.wavfile as w
sr, x = w.read('/tmp/claude-0/chk.wav'); x = x.astype(np.float32) / 32768
d = np.abs(np.diff(x)); k = np.argsort(d)[-5:]
print('== biggest sample jumps (s, jump, local rms):', [(round(i / sr, 3), round(float(d[i]), 3), round(float(np.sqrt(np.mean(x[max(0, i - 480):i + 480] ** 2))), 3)) for i in k])
# 4) contact sheet (24 frames) + stills
idx = [int(t * 30) for t in np.linspace(0.4, NF / 30 - 0.2, 24)]
F = frames_at(idx)
tiles = []
for i in idx:
    im = cv2.resize(F[i], (270, 480), interpolation=cv2.INTER_AREA)
    tiles.append(im)
rows = [np.hstack(tiles[r:r + 8]) for r in range(0, 24, 8)]
cv2.imwrite(f'{OUT}/contact_sheet.jpg', np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 90])
STILLS = dict(s01_roof_sprint=ST['roof'] + 1.0, s02_logpile_yawn=ST['logpile'] + 1.1, s02b_logpile_caught=ST['logpile'] + 1.7,
              s03_phone_mimic=ST['phone'] + 0.35, s04_manhole_peek=ST['manhole'] + 0.8, s05_bale_wink=ST['bales'] + 1.05,
              s05b_bale_caught=ST['bales'] + 1.2, s06_shoes_wave=ST['shoes'] + 1.2, s07_garland_ornament=ST['garland'] + 1.3,
              s08_pole_hang_caught=ST['pole'] + 1.2, s08b_pole_zip=ST['pole'] + 3.3, s08c_over_the_car=ST['pole'] + 4.6,
              s08d_pole_fistpump=ST['pole'] + 6.1, s09_flurry_treetop=ST['fl1'] + 0.3, s09b_flurry_lamp=ST['fl2'] + 0.3,
              s10_summit_binoculars=ST['summit'] + 3.0, s10b_summit_wave=ST['summit'] + 4.3, s10c_summit_fistpump=ST['summit'] + 5.3)
os.makedirs(f'{OUT}/stills', exist_ok=True)
F = frames_at([int(round(t * 30)) for t in STILLS.values()])
for n, t in STILLS.items():
    f = F.get(int(round(t * 30)))
    if f is not None: cv2.imwrite(f'{OUT}/stills/{n}.jpg', f, [cv2.IMWRITE_JPEG_QUALITY, 92])
print('stills', len(os.listdir(f'{OUT}/stills')))
