"""Audio loop-seam and level checks.  python verify_audio.py out/paper_planet_audio.wav"""
import sys, wave, subprocess, re
import numpy as np
f = sys.argv[1]
w = wave.open(f)
sr, n = w.getframerate(), w.getnframes()
x = np.frombuffer(w.readframes(n), '<i2').reshape(-1, 2).astype(np.float64) / 32768.0
print('samples %d  sr %d  duration %.4f s' % (n, sr, n / sr))
dx = np.abs(np.diff(x, axis=0)).max(1)
seam = np.abs(x[0] - x[-1]).max()
print('seam step |x[0]-x[-1]| = %.5f ; |dx| median %.5f, p99 %.5f, max %.5f  -> seam is at percentile %.1f of ordinary sample steps'
      % (seam, np.median(dx), np.percentile(dx, 99), dx.max(), (dx < seam).mean() * 100))
# click detector: second difference (curvature) across the wrap vs everywhere else
y = np.concatenate([x[-2000:], x[:2000]])
d2 = np.abs(np.diff(y, 2, axis=0)).max(1)
all2 = np.abs(np.diff(x, 2, axis=0)).max(1)
print('curvature at seam (max over +-8 samples) %.5f ; whole-file p99 %.5f, max %.5f' % (d2[1990:2008].max(), np.percentile(all2, 99), all2.max()))
# high-band energy in 5 ms around the seam vs the distribution of 5 ms windows
X = np.fft.rfft(np.concatenate([x[-sr // 2:], x[:sr // 2]]).mean(1))
fr = np.fft.rfftfreq(sr, 1 / sr)
X[fr < 6000] = 0
hb = np.fft.irfft(X, n=sr)
win = int(0.005 * sr)
e = np.convolve(hb ** 2, np.ones(win) / win, 'same')
c = sr // 2
print('6k+ band energy at seam %.3e ; median of the surrounding second %.3e, max %.3e' % (e[c - win:c + win].max(), np.median(e), e.max()))
r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
t = r[r.rindex('Summary:'):]
print('EBU R128: I %s LUFS, LRA %s LU, true peak %s dBFS' % (re.search(r'I:\s+(-?[\d.]+)', t).group(1), re.search(r'LRA:\s+(-?[\d.]+)', t).group(1), re.search(r'Peak:\s+(-?[\d.]+)', t).group(1)))
print('sample peak %.2f dBFS' % (20 * np.log10(np.abs(x).max())))
