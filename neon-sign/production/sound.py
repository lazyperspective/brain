# Sound track for the loop (16.000 s, 48 kHz stereo), built so the end runs straight into the start:
#   - the sign's electrical buzz: 120 Hz mains hum with transformer harmonics, its level following the same
#     per-source brightness values that drive the picture (dumpflicker.js), so it sags in the brownout and swells
#     in the surge;
#   - crackles: short bursts of filtered noise at every fast change of a source, sized by the change;
#   - rain: noise shaped by circular FFT filtering (periodic over the loop), plus drops on the roof;
#   - the city: a low, slow rumble (circular too).
# Writes music.wav at about -18 LUFS (scaled in a second pass from ffmpeg's ebur128 measurement).
import json, subprocess, sys, numpy as np, os, wave
here = os.path.dirname(os.path.abspath(__file__))
SR, D = 48000, 16.0
N = int(SR * D)
rng = np.random.default_rng(1109)
b = np.array(json.loads(subprocess.check_output(['node', os.path.join(here, 'dumpflicker.js')])))  # (16000, 8)
area = np.array([1.0, 1.0, 0.3, 1.0, 0.3, 1.0, 0.8, 0.5]); area /= area.sum()
tc = np.arange(len(b)) / 1000.0
t = np.arange(N) / SR
def ctl(x):  # control signal (1 kHz) to audio rate, periodic
    return np.interp(t, np.append(tc, D), np.append(x, x[0]))
B = ctl(b @ area)
def shaped(lo, hi, n=N, tilt=0.0):
    X = np.fft.rfft(rng.standard_normal(n)); f = np.fft.rfftfreq(n, 1 / SR)
    H = ((f > lo) & (f < hi)).astype(float) * np.where(f > 1, (np.maximum(f, 1.0) / 1000.0) ** tilt, 0)
    y = np.fft.irfft(X * H, n); return y / (np.abs(y).max() + 1e-9)
# buzz
buzz = np.zeros(N)
for h, a in [(1, 1.0), (2, 0.55), (3, 0.35), (4, 0.22), (5, 0.12), (7, 0.07), (9, 0.04)]:
    buzz += a * np.sin(2 * np.pi * 120 * h * t + h * 0.7)
buzz *= 0.22 * (B ** 1.3)
buzz += 0.012 * shaped(2000, 9000) * B          # ballast hiss
# crackles at fast changes
db = np.abs(np.diff(b, axis=0, append=b[:1])) @ (area * 8)
crk = np.zeros(N)
burst = shaped(800, 7000, 2400)
for i in np.where(db > 0.02)[0]:
    s = int(i / 1000 * SR); L = len(burst); env = np.exp(-np.arange(L) / (SR * 0.006))
    a = min(1.0, db[i] * 3.0) * 0.5
    idx = (s + np.arange(L)) % N
    crk[idx] += a * burst * env * (0.6 + 0.4 * rng.random())
# rain and drops
rain = 0.10 * shaped(600, 11000, tilt=-0.3)
drops = np.zeros(N); dk = shaped(1500, 6000, 600)
for s in rng.integers(0, N, 900):
    idx = (s + np.arange(600)) % N; drops[idx] += 0.05 * rng.random() * dk * np.exp(-np.arange(600) / (SR * 0.003))
# city rumble, slowly breathing (periodic)
city = 0.18 * shaped(25, 220, tilt=-1.0) * (0.8 + 0.2 * np.sin(2 * np.pi * 2 * t / D))
L = buzz + crk + rain * 0.9 + drops + city
R = buzz * 0.92 + crk * 0.85 + np.roll(rain, 4801) * 0.9 + np.roll(drops, 2203) + np.roll(city, 1201)
st = np.stack([L, R], 1)
def write(path, x):
    x = np.clip(x, -0.98, 0.98); w = wave.open(path, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((x * 32767).astype('<i2').tobytes()); w.close()
out = os.path.join(here, 'music.wav')
write(out, st / np.abs(st).max() * 0.5)
m = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', out, '-filter_complex', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
I = float([l for l in m.splitlines() if l.strip().startswith('I:')][-1].split()[1])
gain = 10 ** ((-18.0 - I) / 20)
write(out, st / np.abs(st).max() * 0.5 * gain)
print('measured %.1f LUFS, gain %.2f dB -> %s' % (I, 20 * np.log10(gain), out))
