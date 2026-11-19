"""Self-checks: cuts on bar lines, audio phrase onsets on the same lines, loop continuity."""
import math
import sys
import numpy as np
import soundfile as sf
import film

FPS, BAR = film.FPS, film.BAR
ok = True


def cam_speed(f):
    a, b = film.camera(f - .5), film.camera(f + .5)
    return math.hypot(b[0] - a[0], b[1] - a[1]) * b[2] + abs(math.log(b[2] / a[2])) * 960


print('--- structure (frames @30fps, bar = %d frames = %.4f s) ---' % (BAR, BAR / FPS))
assert abs(BAR / FPS - 4 * 60 / 90.) < 1e-9
bounds = [film.F_HOLD] + [s[0] for s in film.SHOTS] + [film.F_OUT]
for b in bounds:
    assert b % BAR == 0, b
print('boundaries', bounds, 'all multiples of', BAR)
print('--- every tour shot: camera lands exactly on the bar line ---')
for i, s in enumerate(film.SHOTS):
    f0 = s[0]
    land = film.camera(f0)
    want = film.clamp_cam(film.shot_pose(i, f0))
    err = max(abs(land[k] - want[k]) for k in range(3))
    before = max(cam_speed(f0 - k) for k in range(1, film.GLIDE))
    after = max(cam_speed(f0 + k) for k in range(1, 40))
    quiet = max(cam_speed(f0 - k) for k in range(film.GLIDE + 2, 40)) if i else 0
    good = err < 1e-6 and before > 40 and after < 3 and quiet < 3
    ok &= good
    print('%-42s start f=%3d (%.3fs)  pose err %.1e  glide peak %5.0f px/f  in-shot drift <= %.2f px/f  %s'
          % (s[7], f0, f0 / FPS, err, before, after, 'OK' if good else 'FAIL'))
print('--- soundtrack: strongest onset near each bar line ---')
x, sr = sf.read('out/soundtrack.wav')
assert abs(len(x) / sr - film.F_END / FPS) < 1e-3, len(x) / sr
from scipy.signal import butter, sosfilt
m = np.abs(sosfilt(butter(2, 1500, 'highpass', fs=sr, output='sos'), x.sum(1)))   # transients only (bass ripple would fool a 5 ms window)
hop = sr // 200
env = np.array([m[i:i + hop].mean() for i in range(0, len(m) - hop, hop)])
flux = np.maximum(0, np.diff(env))      # linear energy rise per 5 ms
for b in range(3, 11):
    t = (b - 1) * BAR / FPS
    i = int(t * 200)
    w = flux[i - 20:i + 20]
    j = int(np.argmax(w)) - 20
    good = abs(j) <= 3
    ok &= good
    print('bar %2d at %6.3fs: onset offset %+4.0f ms  %s' % (b, t, j * 5, 'OK' if good else 'FAIL'))
print('--- loop: last frame -> first frame ---')
a = film.render_frame(film.F_END - 1, .5).astype(np.float32)
b0 = film.render_frame(0, .5).astype(np.float32)
b1 = film.render_frame(1, .5).astype(np.float32)
c = film.render_frame(film.F_END - 2, .5).astype(np.float32)
d_loop, d_fwd, d_back = np.abs(a - b0).mean(), np.abs(b1 - b0).mean(), np.abs(a - c).mean()
good = d_loop < 1.6 * max(d_fwd, d_back) + .3
ok &= good
print('mean abs diff  838->839: %.3f   839->0 (seam): %.3f   0->1: %.3f   %s' % (d_back, d_loop, d_fwd, 'OK' if good else 'FAIL'))
s0, s1 = x[:64], x[-64:]
print('audio seam step %.4f (typical step %.4f)' % (np.abs(x[0] - x[-1]).max(), np.abs(np.diff(x[-2000:], axis=0)).max()))
print('ALL OK' if ok else 'SOME CHECKS FAILED')
sys.exit(0 if ok else 1)
