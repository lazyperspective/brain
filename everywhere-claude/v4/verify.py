# Verification + deliverables from the final mp4: contact sheet, stills, cut/beat table, scene-change detection, loudness.
import sys, subprocess, json, numpy as np, cv2, os
V2 = '/home/user/brain/everywhere-claude/v4'; OUT = '/home/user/brain/everywhere-claude/out'
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
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', MP4, '-map', '0:a', '-ac', '1', '-ar', '48000', '/home/user/brain/everywhere-claude/v4/tmp/chk.wav'], check=True)
import scipy.io.wavfile as w
sr, x = w.read('/home/user/brain/everywhere-claude/v4/tmp/chk.wav'); x = x.astype(np.float32) / 32768
d = np.abs(np.diff(x)); k = np.argsort(d)[-5:]
print('== biggest sample jumps (s, jump, local rms):', [(round(i / sr, 3), round(float(d[i]), 3), round(float(np.sqrt(np.mean(x[max(0, i - 480):i + 480] ** 2))), 3)) for i in k])
# 4) contact sheet (24 frames) + stills
idx = [int(t * 30) for t in np.linspace(0.1, NF / 30 - 0.1, 24)]
F = frames_at(idx)
tiles = []
for i in idx:
    im = cv2.resize(F[i], (270, 480), interpolation=cv2.INTER_AREA)
    tiles.append(im)
rows = [np.hstack(tiles[r:r + 8]) for r in range(0, 24, 8)]
cv2.imwrite(f'{OUT}/contact_sheet.jpg', np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 90])
STILLS = dict(s01_cold_open_aim=0.07, s02_cold_open_flash=0.2, s03_roof_sprint_clouds=0.8, s04_roof_double_take=1.5, s05_spruce_treetopper=3.55,
              s06_logpile_weightlifter=4.6, s07_logpile_caught=5.1, s08_log_on_the_foot=5.55, s09_logpile_ouch_hops=5.95, s10_manhole_peek=7.8,
              s11_bales_bolt_hay=9.43, s12_shoes_wave=11.25, s13_garland_monkey_bars=11.62, s14_garland_zap=12.17, s15_garland_ornament=12.8,
              s16_pole_drop_in_grab=14.42, s17_pole_zip_sparks=16.45, s18_pole_string_art=17.7, s19_pole_starburst_windmill=18.15,
              s20_pole_fist_pump=18.65, s21_whip_chase=19.9, s22_summit_flag_high=22.2, s23_summit_flag_plant=23.05, s24_summit_ghost_mountain=23.75,
              s25_summit_binoculars=24.25, s26_summit_fist_pump=25.12, s27_camera_aim_loop=25.9)
os.makedirs(f'{OUT}/stills', exist_ok=True)
F = frames_at([int(round(t * 30)) for t in STILLS.values()])
for n, t in STILLS.items():
    f = F.get(int(round(t * 30)))
    if f is not None: cv2.imwrite(f'{OUT}/stills/{n}.jpg', f, [cv2.IMWRITE_JPEG_QUALITY, 92])
print('stills', len(os.listdir(f'{OUT}/stills')))
