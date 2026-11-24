# Verification + deliverables from the final mp4: contact sheet, stills, cut/beat table, scene-change detection, loudness.
import sys, subprocess, json, numpy as np, cv2, os
V2 = '/home/user/brain/everywhere-claude/v3'; OUT = '/home/user/brain/everywhere-claude/out'
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
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', MP4, '-map', '0:a', '-ac', '1', '-ar', '48000', '/home/user/brain/everywhere-claude/v3/tmp/chk.wav'], check=True)
import scipy.io.wavfile as w
sr, x = w.read('/home/user/brain/everywhere-claude/v3/tmp/chk.wav'); x = x.astype(np.float32) / 32768
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
STILLS = dict(s01_roof_sprint_clouds=ST['roof'] + 0.7, s02_roof_double_take=ST['roof'] + 1.5, s03_spruce_treetopper_pattern=ST['spruce'] + 1.05,
              s04_logpile_weightlifter=ST['logpile'] + 0.6, s05_logpile_caught=ST['logpile'] + 1.1, s06_logpile_ouch_hops=ST['logpile'] + 1.9,
              s07_manhole_peek=ST['manhole'] + 0.8, s08_photo_aims_at_us=ST['photo'] + 0.9, s09_photo_flash=ST['photo'] + 1.0,
              s10_bales_bolt_hay=ST['bales'] + 1.43, s11_shoes_wave=ST['shoes'] + 1.25, s12_garland_monkey_bars=ST['garland'] + 0.6,
              s13_garland_zap=ST['garland'] + 1.17, s14_garland_ornament=ST['garland'] + 1.8, s15_pole_drop_in_grab=ST['pole'] + 0.42,
              s16_pole_zip_sparks=ST['pole'] + 3.0, s17_pole_string_art=ST['pole'] + 5.2, s18_pole_starburst_windmill=ST['pole'] + 5.65,
              s19_pole_fist_pump=ST['pole'] + 6.15, s20_whip_chase=ST['whip'] + 0.9, s21_summit_flag=ST['summit'] + 3.05,
              s22_summit_ghost_mountain=ST['summit'] + 3.95, s23_summit_binoculars=ST['summit'] + 4.75, s24_summit_fist_pump=ST['summit'] + 6.12)
os.makedirs(f'{OUT}/stills', exist_ok=True)
F = frames_at([int(round(t * 30)) for t in STILLS.values()])
for n, t in STILLS.items():
    f = F.get(int(round(t * 30)))
    if f is not None: cv2.imwrite(f'{OUT}/stills/{n}.jpg', f, [cv2.IMWRITE_JPEG_QUALITY, 92])
print('stills', len(os.listdir(f'{OUT}/stills')))
