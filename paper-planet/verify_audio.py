"""Audio checks for the v3 film soundtrack.  python verify_audio.py out/paper_planet_audio.wav
EBU R128 integrated loudness and true peak, the loudness arc (short-term, per section), the tail, and the
harmony of the ending (pitch-class energy of the last bars)."""
import sys, wave, subprocess, re
import numpy as np
sys.path.insert(0, '.')
from pp import core
f = sys.argv[1]
w = wave.open(f)
sr, n = w.getframerate(), w.getnframes()
x = np.frombuffer(w.readframes(n), '<i2').reshape(-1, 2).astype(np.float64) / 32768.0
print('samples %d  sr %d  duration %.3f s (film %.3f s)' % (n, sr, n / sr, core.DUR))
r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
t = r[r.rindex('Summary:'):]
print('EBU R128: I %s LUFS, LRA %s LU, true peak %s dBFS' % (re.search(r'I:\s+(-?[\d.]+)', t).group(1), re.search(r'LRA:\s+(-?[\d.]+)', t).group(1), re.search(r'Peak:\s+(-?[\d.]+)', t).group(1)))
st = [(float(a), float(b)) for a, b in re.findall(r't:\s*([\d.]+)\s+TARGET.*?S:\s*(-?[\d.inf]+)', r)]
st = np.array([(a, b) for a, b in st if np.isfinite(b) and b > -70])
B = core.BAR
secs = [('plain opening', 0, 2 * B), ('push-in', 2 * B, 4 * B), ('montage I (Eu..NAm)', 4 * B, 16 * B), ('whale', 16 * B, 21 * B),
        ('montage II (Pac..SAs)', 21 * B, 32 * B), ('pull-back', 32 * B, 34 * B), ('final wide', 34 * B, 38 * B), ('fade', core.FADE_OUT[0], core.DUR)]
for nm, a, b in secs:
    m = (st[:, 0] > a + 0.5) & (st[:, 0] <= b)
    if m.any():
        print('  %-22s %5.1f-%5.1fs short-term loudness median %6.1f  max %6.1f LUFS' % (nm, a, b, np.median(st[m, 1]), st[m, 1].max()))
mono = x.mean(1)
for a in (core.DUR - 2.0, core.DUR - 0.5, core.DUR - 0.05):
    i = int(a * sr)
    print('  rms around %.2f s: %.1f dBFS' % (a, 20 * np.log10(np.sqrt((mono[i:i + 2400] ** 2).mean()) + 1e-12)))
print('  last sample |x| = %.5f' % np.abs(x[-1]).max())
def chroma(seg):
    X = np.abs(np.fft.rfft(seg * np.hanning(len(seg))))
    fr = np.fft.rfftfreq(len(seg), 1 / sr)
    m = (fr > 60) & (fr < 4000)
    pc = np.round(12 * np.log2(fr[m] / 440.0) + 69).astype(int) % 12
    c = np.bincount(pc, X[m] ** 2, 12)
    return c / c.sum()
names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
for nm, a, b in (('bar 33 (A7)', 33 * B, 34 * B), ('bar 34 (D, wide)', 34 * B, 35 * B), ('bars 36-37 (end)', 36 * B, 38 * B)):
    c = chroma(mono[int(a * sr):int(b * sr)])
    top = np.argsort(-c)[:4]
    print('  %-18s strongest pitch classes: %s' % (nm, ', '.join('%s %.0f%%' % (names[k], 100 * c[k]) for k in top)))
