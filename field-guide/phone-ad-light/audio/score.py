# Four music beds for the KILN concept ad prototypes, each cued to its picture.  python3 score.py <light|made|pulse|dawn> out.wav
import sys, numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile
SR = 48000; rng = np.random.default_rng(5)
def t_(d): return np.arange(int(SR * d)) / SR
def filt(x, k, f, o=2): return sosfilt(butter(o, f, k, fs=SR, output='sos'), x)
def env(n, a, d): e = np.ones(n); ai = max(1, int(a * SR)); e[:ai] = np.linspace(0, 1, ai); e *= np.exp(-np.arange(n) / SR / d); return e
def adsr(n, a, r): e = np.ones(n); ai, ri = max(1, int(a * SR)), max(1, int(r * SR)); e[:ai] = np.linspace(0, 1, ai) ** 2; e[-ri:] *= np.linspace(1, 0, ri) ** 2; return e
def saw(f, d, det=0): t = t_(d); return 2 * ((t * f * (1 + det)) % 1) - 1
N2F = lambda n: 440 * 2 ** ((n - 69) / 12)
class Mix:
    def __init__(s, dur): s.N = int(SR * dur); s.L = np.zeros(s.N); s.R = np.zeros(s.N)
    def add(s, x, at, g=1.0, pan=0.0):
        i = int(at * SR); n = min(len(x), s.N - i)
        if n <= 0: return
        s.L[i:i + n] += x[:n] * g * np.sqrt(0.5 * (1 - pan)) * 1.414; s.R[i:i + n] += x[:n] * g * np.sqrt(0.5 * (1 + pan)) * 1.414
    def out(s, path, fade=0.6):
        f = np.ones(s.N); fi = int(fade * SR); f[-fi:] = np.linspace(1, 0, fi) ** 1.5
        for d, g in [(0.031, 0.18), (0.047, 0.14), (0.089, 0.1), (0.137, 0.07)]:   # a little stereo room
            k = int(d * SR); s.L[k:] += s.R[:-k] * g; s.R[k:] += s.L[:-k] * g * 0.9
        L, R = s.L * f, s.R * f; m = max(np.abs(L).max(), np.abs(R).max()); wavfile.write(path, SR, (np.stack([L, R], 1) / m * 0.9 * 32767).astype(np.int16))
def pad(notes, d, cut=1600, a=1.2, r=1.5):
    x = sum(saw(N2F(n), d, dt) for n in notes for dt in (-0.004, 0.0, 0.005)); return filt(x, 'lowpass', cut) * adsr(len(x), a, r) / (3 * len(notes))
def piano(n, d=2.5, g=1.0):
    f = N2F(n); t = t_(d); x = sum(a * np.sin(2 * np.pi * f * k * t + k) * np.exp(-t * (1.6 + k * 1.1)) for k, a in [(1, 1), (2, 0.45), (3, 0.22), (4, 0.1), (5, 0.05)])
    return x * np.minimum(1, t / 0.004) * g
def marimba(n, g=1.0):
    f = N2F(n); t = t_(0.7); return (np.sin(2 * np.pi * f * t) * np.exp(-t * 7) + 0.3 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 22) + filt(rng.standard_normal(len(t)), 'bandpass', [2000, 6000]) * np.exp(-t * 200) * 0.2) * g
def bell(n, d=3.0, g=1.0):
    f = N2F(n); t = t_(d); return sum(a * np.sin(2 * np.pi * f * k * t) * np.exp(-t * dk) for k, a, dk in [(1, 1, 0.9), (2.76, 0.4, 1.8), (5.4, 0.2, 3.2), (8.9, 0.08, 5)]) * g
def whoosh(d, lo=300, hi=2500, g=1.0): n = int(d * SR); return filt(rng.standard_normal(n), 'bandpass', [lo, hi]) * np.sin(np.linspace(0, np.pi, n)) ** 2 * g
def kick(g=1.0): t = t_(0.5); return np.sin(2 * np.pi * np.cumsum(42 + 120 * np.exp(-t * 28)) / SR) * np.exp(-t * 7) * g
def snare(g=1.0): n = int(0.3 * SR); return (filt(rng.standard_normal(n), 'bandpass', [1500, 7000]) * env(n, 0.001, 0.08) + np.sin(2 * np.pi * 200 * t_(0.3)) * env(n, 0.001, 0.05) * 0.5) * g
def snap(g=1.0): n = int(0.4 * SR); t = t_(0.4); return (filt(rng.standard_normal(n), 'highpass', 2500) * env(n, 0.0005, 0.012) * 0.8 + np.sin(2 * np.pi * np.cumsum(70 + 160 * np.exp(-t * 40)) / SR) * env(n, 0.001, 0.09)) * g
def sub(d=2.0, f0=55, g=1.0): t = t_(d); return np.sin(2 * np.pi * np.cumsum(f0 * (1 - 0.35 * t / d)) / SR) * adsr(len(t), 0.01, d * 0.7) * g
def tick(g=1.0): t = t_(0.08); return np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 90) * g
def riser(d, f0=200, f1=1800, g=1.0): t = t_(d); return (np.sin(2 * np.pi * np.cumsum(f0 * (f1 / f0) ** (t / d)) / SR) * 0.3 + filt(rng.standard_normal(len(t)), 'highpass', 3000) * 0.3) * (t / d) ** 2 * g

def light():
    M = Mix(11.5)
    M.add(pad([50, 57, 64, 66], 6.5, 1200, 2.5, 2), 0.0, 0.9); M.add(pad([47, 54, 62, 66], 6.5, 1400, 2, 2.5), 5.2, 0.9)
    for i, n in enumerate([74, 76, 78, 81, 78, 76, 74, 69]): M.add(piano(n, 3, 0.35), 1.2 + i * 0.55, pan=(i % 2 - 0.5) * 0.6)
    M.add(whoosh(2.4, 200, 1500, 0.25), 1.2); M.add(whoosh(2.0, 400, 3000, 0.18), 3.6)
    M.add(bell(86, 3, 0.4), 6.0, pan=0.2); M.add(bell(81, 3, 0.25), 6.12, pan=-0.2)
    M.add(whoosh(0.7, 800, 5000, 0.25), 7.9)
    for i, n in enumerate([62, 66, 69, 74, 78]): M.add(piano(n, 4, 0.3), 9.5 + i * 0.07)
    M.add(pad([50, 57, 62, 66, 69], 2.5, 1800, 0.3, 1.8), 9.5, 0.7); return M
def made():
    M = Mix(11.5); b = 60 / 100; seq = [69, 72, 76, 72, 74, 77, 81, 77]
    for k in range(int(11 / (b / 2))):
        at = 0.3 + k * b / 2
        if 4.4 < at < 5.95: continue
        M.add(marimba(seq[k % 8] + (0 if (k // 16) % 2 == 0 else -2), 0.35 if k % 2 == 0 else 0.22), at, pan=(k % 3 - 1) * 0.4)
    M.add(pad([45, 52, 57, 60], 11.2, 900, 2, 2), 0.0, 0.5)
    for a in [1.0, 1.6, 2.2, 2.8]: M.add(tick(0.3), a, pan=0.3)
    M.add(riser(1.5, 150, 900, 0.5), 4.4); M.add(snap(1.2), 5.9); M.add(sub(1.2, 50, 0.6), 5.9)
    M.add(bell(88, 2.5, 0.35), 7.4); M.add(whoosh(0.7, 800, 5000, 0.22), 9.0)
    for i, n in enumerate([57, 64, 69, 72, 76]): M.add(piano(n, 3.5, 0.3), 10.2 + i * 0.05)
    return M
def pulse():
    M = Mix(9.5); cuts = [0.0, 0.9, 1.8, 2.7, 4.0, 5.4, 6.8]
    chords = [[45, 52, 57], [43, 50, 55], [41, 48, 53], [45, 52, 57], [48, 55, 60], [43, 50, 55], [45, 52, 57, 64]]
    for i, c in enumerate(cuts): M.add(kick(1.0), c); M.add(snare(0.5), c, pan=0.1); M.add(pad(chords[i], 0.85 if i < 6 else 2.6, 2500, 0.005, 0.3), c, 0.9)
    for k in range(int(9.5 / 0.225)):
        at = k * 0.225
        if 4.15 < at < 5.4: continue
        M.add(filt(saw(N2F(33 if (k // 8) % 2 == 0 else 31), 0.18), 'lowpass', 500) * env(int(0.18 * SR), 0.003, 0.08), at, 0.45)
        M.add(filt(rng.standard_normal(int(0.04 * SR)), 'highpass', 8000) * env(int(0.04 * SR), 0.001, 0.012), at + 0.1125, 0.18, pan=0.3)
    M.add(riser(1.2, 300, 2400, 0.45), 4.15); M.add(bell(81, 2, 0.4), 2.8)
    M.add(sub(2.5, 55, 1.0), 6.8); M.add(whoosh(0.5, 1000, 6000, 0.3), 5.5)
    for i, n in enumerate([69, 76, 81, 84]): M.add(piano(n, 2.5, 0.35), 7.8 + i * 0.12)
    return M
def dawn():
    M = Mix(11.5); t = t_(11.5)
    drone = (np.sin(2 * np.pi * N2F(38) * t) + 0.5 * np.sin(2 * np.pi * N2F(45) * t * 1.001)) * (0.35 + 0.65 * np.clip((t - 2) / 7, 0, 1)); M.add(filt(drone, 'lowpass', 400) * adsr(len(t), 1.5, 1.5), 0, 0.6)
    M.add(whoosh(2.6, 600, 4000, 0.3), 0.0, pan=-0.3); M.add(whoosh(2.0, 800, 5000, 0.3), 2.6, pan=0.3)
    M.add(pad([50, 57, 62, 66], 5.5, 700, 3, 1.5), 4.4, 0.8); M.add(pad([50, 57, 62, 66, 69, 74], 3.0, 2200, 1.5, 1.5), 8.4, 0.7)
    M.add(bell(81, 3, 0.4), 7.1); M.add(bell(86, 3, 0.25), 7.25, pan=0.3); M.add(whoosh(0.7, 800, 5000, 0.2), 8.6)
    for i, n in enumerate([62, 69, 74, 78]): M.add(piano(n, 4, 0.35), 9.9 + i * 0.35, pan=(i % 2 - 0.5) * 0.5)
    return M
{'light': light, 'made': made, 'pulse': pulse, 'dawn': dawn}[sys.argv[1]]().out(sys.argv[2])
