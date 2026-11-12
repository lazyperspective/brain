# RGB FIGHT part 1 (15 s): synthwave bed + foley for every beat. Event times are given in ACTION time and mapped
# to real time through the same hit-stop table as fight.js.
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile
SR = 48000; DUR = 15.0; N = int(SR * DUR); L = np.zeros(N); R = np.zeros(N); rng = np.random.default_rng(11)
HITS = [(2.55, 0.06), (3.25, 0.1), (7.05, 0.12), (9.4, 0.12), (10.35, 0.15), (12.4, 0.1)]
def rt(a): return a + sum(d for h, d in HITS if h < a)
def t_(d): return np.arange(int(SR * d)) / SR
def add(x, at, gain=1.0, pan=0.0, real=False, bus=None):
    at = at if real else rt(at); i = int(at * SR); n = min(len(x), N - i)
    if n <= 0 or i < 0: return
    l, r = (L, R) if bus is None else bus
    l[i:i + n] += x[:n] * gain * np.sqrt(0.5 * (1 - pan)) * 1.414; r[i:i + n] += x[:n] * gain * np.sqrt(0.5 * (1 + pan)) * 1.414
def M(*xs):
    o = np.zeros(max(len(x) for x in xs))
    for x in xs: o[:len(x)] += x
    return o
def filt(x, kind, f, order=2): return sosfilt(butter(order, f, kind, fs=SR, output='sos'), x)
def env(n, a, d): e = np.ones(n); ai = max(1, int(a * SR)); e[:ai] = np.linspace(0, 1, ai); e *= np.exp(-np.arange(n) / SR / d); return e
def saw(f, d): t = t_(d); return 2 * ((t * f) % 1) - 1
def sq(f, d): return np.sign(np.sin(2 * np.pi * f * t_(d)))
def noise(d): return rng.standard_normal(int(d * SR))
def sweep(f0, f1, d): t = t_(d); f = f0 * (f1 / f0) ** (t / d); return np.sin(2 * np.pi * np.cumsum(f) / SR)
# ---- instruments / foley
def kick(g=1.0): t = t_(0.35); return np.sin(2 * np.pi * np.cumsum(45 + 110 * np.exp(-t * 30)) / SR) * np.exp(-t * 9) * g
def hat(): n = int(0.06 * SR); return filt(noise(0.06), 'highpass', 7000) * env(n, 0.001, 0.02)
def snare(): n = int(0.25 * SR); return filt(noise(0.25), 'bandpass', [1200, 6000]) * env(n, 0.001, 0.07) + np.sin(2 * np.pi * 190 * t_(0.25)) * env(n, 0.001, 0.05) * 0.6
def whoosh(d, lo=600, hi=3000): n = int(d * SR); return filt(noise(d), 'bandpass', [lo, hi]) * np.sin(np.linspace(0, np.pi, n)) ** 2
def swish(d=0.2): n = int(d * SR); e = np.sin(np.linspace(0, np.pi, n)) ** 3; return (filt(noise(d), 'bandpass', [1500, 7000]) * 0.7 + sweep(900, 2600, d) * 0.15) * e
def punch(g=1.0, d=0.5):
    n = int(d * SR); t = t_(d); body = np.sin(2 * np.pi * np.cumsum(60 + 220 * np.exp(-t * 40)) / SR) * env(n, 0.001, 0.12)
    return (body + filt(noise(d), 'bandpass', [1500, 9000]) * env(n, 0.0005, 0.03) * 0.8) * g
def clang(f0=520, d=1.4, g=1.0):
    n = int(d * SR); x = sum(np.sin(2 * np.pi * f0 * r * t_(d)) * env(n, 0.0005, d * dk) * a for r, a, dk in [(1, 1, .5), (2.67, .6, .35), (4.25, .45, .25), (6.1, .3, .18), (8.4, .2, .12)])
    return (x * 0.5 + filt(noise(d), 'highpass', 3000) * env(n, 0.0005, 0.02)) * g
def glitch(d, seed=0):
    r = np.random.default_rng(seed); n = int(d * SR); x = np.zeros(n); i = 0
    while i < n:
        seg = int(r.uniform(0.008, 0.04) * SR); f = r.choice([220, 440, 880, 1320, 1760, 3520]); s = np.sign(np.sin(2 * np.pi * f * np.arange(seg) / SR)) * (r.random() > 0.3); m = min(seg, n - i); x[i:i + m] = s[:m]; i += seg
    return filt(x, 'lowpass', 6000) * 0.5
def boom(d=1.4, f=32):
    n = int(d * SR); t = t_(d); return np.sin(2 * np.pi * np.cumsum(f + 90 * np.exp(-t * 6)) / SR) * env(n, 0.002, d * 0.36) + filt(noise(d), 'lowpass', 900) * env(n, 0.002, d * 0.25) * 0.6
def crackle(d):
    n = int(d * SR); x = np.zeros(n); idx = rng.integers(0, n, int(d * 900)); x[idx] = rng.uniform(-1, 1, len(idx)); x = filt(x, 'bandpass', [1800, 9000]) * 6
    buzz = filt(saw(110, d) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 7 * t_(d)))), 'lowpass', 1600) * 0.25; return x + buzz
def shimmer(d, f0=880): n = int(d * SR); return sum(np.sin(2 * np.pi * f0 * m * t_(d) + m) for m in (1, 1.5, 2, 3)) * 0.2 * np.sin(np.linspace(0, np.pi, n))
def arp(freqs, step, d=0.25, g=0.2, at=0.0, pan=0.0):
    for k, f in enumerate(freqs): x = (sq(f, d) * 0.3 + np.sin(2 * np.pi * f * t_(d))) * env(int(d * SR), 0.003, 0.12); add(filt(x, 'lowpass', 5000), at + k * step, g, pan + (k % 2 - 0.5) * 0.5)
def thud(g=0.6): return punch(g * 0.7, 0.3)
def clatter(n=8, at=0.0, span=0.5):
    for k in range(n): add(np.sin(2 * np.pi * rng.uniform(900, 2400) * t_(0.06)) * env(int(0.06 * SR), 0.001, 0.015) + filt(noise(0.06), 'bandpass', [2000, 6000]) * env(int(0.06 * SR), 0.001, 0.01), at + rng.uniform(0, span), 0.25, rng.uniform(-0.6, 0.6), real=True)
# ---- music bus (120 bpm), from FIGHT! to the hook; ducked on hits
mL, mR = np.zeros(N), np.zeros(N); MB = (mL, mR)
b = 0.5; m0 = rt(1.85); m1 = rt(13.6)
q = 0
while m0 + q * b / 2 < m1:
    at = m0 + q * b / 2
    if q % 2 == 0: add(kick(0.95), at, real=True, bus=MB)
    if q % 4 == 2: add(snare(), at, 0.35, real=True, bus=MB)
    add(hat(), at, 0.15 if q % 2 else 0.1, 0.3 if q % 2 else -0.3, real=True, bus=MB)
    root = [41.2, 41.2, 49.0, 36.7][(q // 16) % 4] * 2; d = b / 2 * 0.9
    add(filt(saw(root, d) + 0.5 * saw(root * 1.005, d), 'lowpass', 900) * env(int(d * SR), 0.003, 0.12), at, 0.3, real=True, bus=MB)
    if at > rt(5.3) and q % 2 == 0:   # after the sword: a lead arpeggio for lift
        f = [329.6, 392.0, 493.9, 587.3, 493.9, 392.0, 329.6, 246.9][(q // 2) % 8] * (1 if (q // 16) % 4 != 2 else 1.19); dd = 0.22
        add(filt(sq(f, dd) * 0.4 + saw(f * 2, dd) * 0.2, 'lowpass', 3500) * env(int(dd * SR), 0.003, 0.1), at, 0.09, 0.25, real=True, bus=MB)
    q += 1
duck = np.ones(N)
for h, d in HITS: i = int(rt(h) * SR); w = int((0.4 + d) * SR); duck[i:i + w] = np.minimum(duck[i:i + w], np.linspace(0.2, 1, w))
i0, i1 = int(rt(10.36) * SR), int(rt(11.25) * SR); duck[i0:i1] = np.minimum(duck[i0:i1], 0.45)
mL *= duck; mR *= duck; L += mL; R += mR
# ---- A: entrance
d = 2.2; add(sum(filt(saw(f, d), 'lowpass', 1400) for f in (82.4, 123.5, 164.8)) * np.sin(np.linspace(0, np.pi / 2, int(d * SR))) * 0.18, 0.0, 0.6)
add(glitch(0.8, 1), 0.45, 0.35, 0.5); add(sweep(200, 2400, 0.75) * env(int(0.75 * SR), 0.6, 0.3) * 0.3, 0.45, 0.4, 0.5); add(punch(0.6), 1.22, 0.6, 0.4)
add(punch(0.8) + filt(noise(0.5), 'bandpass', [3000, 9000]) * env(int(0.5 * SR), 0.001, 0.1) * 0.3, 1.28, 0.9); add(boom(0.9, 40), 1.88, 0.7); add(punch(1.0), 1.88, 0.9)
# ---- B: fists
add(whoosh(0.28), 2.28, 0.6, 0.4); add(M(clang(700, 0.7, 0.8), punch(0.8)), 2.55, 0.9, -0.3)
add(whoosh(0.2), 3.07, 0.6, -0.3); add(punch(1.2), 3.25, 1.0, 0.1); add(glitch(0.3, 2), 3.3, 0.22, 0.5); add(thud(), 3.6, 0.6, 0.5)
# ---- C: the orb, the race, the sword
add(sweep(2600, 600, 0.6) * env(int(0.6 * SR), 0.05, 0.4) * 0.3 + shimmer(0.6, 1320), 3.9, 0.45, -0.2); add(np.sin(2 * np.pi * 1760 * t_(0.6)) * env(int(0.6 * SR), 0.001, 0.2), 4.5, 0.25, -0.2)
add(shimmer(0.75, 660) * 0.6, 4.5, 0.3, -0.2); add(whoosh(0.4, 400, 2000), 4.8, 0.5); arp([523.3, 659.3, 784.0, 1046.5, 1318.5], 0.045, 0.3, 0.22, 5.25, -0.2)
add(M(sweep(1200, 5200, 0.35) * env(int(0.35 * SR), 0.01, 0.2) * 0.25, clang(1800, 0.6, 0.35)), 5.3, 0.6, -0.2)
# ---- D: sword
add(swish(0.22), 6.28, 0.8, -0.1); add(glitch(0.12, 3) + sweep(3000, 300, 0.12) * 0.3, 6.31, 0.45, 0.4); add(swish(0.24), 6.84, 0.85, 0.1)
add(punch(1.1) + clang(900, 0.5, 0.5), 7.05, 1.0, 0.3); add(thud(0.5), 7.3, 0.6, 0.6); add(thud(0.4), 7.5, 0.5, 0.6)
# ---- E: glitch axe + slam
add(M(boom(1.0, 28) * 0.6, glitch(0.6, 4) * 0.5), 8.0, 0.6, 0.6); add(sweep(150, 900, 0.4) * env(int(0.4 * SR), 0.2, 0.3) * 0.4, 8.1, 0.5, 0.6)
add(whoosh(0.18, 800, 4000), 8.4, 0.5, 0.5); add(clang(400, 0.6, 0.6), 8.56, 0.55, 0.5); add(whoosh(0.4, 300, 1500), 9.0, 0.6, 0.3); add(swish(0.12), 9.29, 0.7, 0.1)
add(boom(1.8, 26), 9.4, 1.1); add(punch(1.5), 9.4, 1.0); add(filt(noise(0.6), 'bandpass', [400, 3000]) * env(int(0.6 * SR), 0.001, 0.15), 9.42, 0.5); clatter(10, rt(9.85), 0.5)
add(filt(saw(70, 0.4), 'lowpass', 500) * np.sin(np.linspace(0, np.pi, int(0.4 * SR))) * 0.5, 9.6, 0.4, 0.3)
# ---- F: clash + lock
add(whoosh(0.3), 10.05, 0.55, -0.4); add(whoosh(0.3), 10.05, 0.55, 0.4); add(M(clang(620, 1.6, 1.3), boom(1.0, 40) * 0.6), 10.35, 1.0)
add(crackle(0.95), 10.4, 0.28); add(filt(noise(0.9), 'bandpass', [2500, 5000]) * (0.5 + 0.5 * np.sin(2 * np.pi * 14 * t_(0.9))) * 0.4, 10.4, 0.25)
add(M(boom(1.0, 45), punch(1.0)), 11.25, 0.8)
# ---- G: spin + shatter
d = 0.55; t = t_(d); add(np.sin(2 * np.pi * np.cumsum(200 + 1000 * (t / d) ** 2) / SR) * (t / d) ** 1.5 * 0.35 + shimmer(d, 880) * 0.5 * (t / d), 11.6, 0.5, -0.3)
d = 0.75; t = t_(d); add(filt(noise(d), 'bandpass', [900, 5000]) * (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 5.3 * t))) * np.sin(np.linspace(0, np.pi, int(d * SR))), 12.1, 0.7, -0.2)
add(M(clang(1100, 0.8, 0.8), glitch(0.4, 5) * 0.8, boom(0.8, 50) * 0.5), 12.4, 1.0, 0.2); clatter(14, rt(12.5), 0.6); add(thud(0.6), 12.9, 0.6, 0.5)
add(clang(1500, 0.3, 0.4), 13.72, 0.4, 0.5)
# ---- H: the hook
add(glitch(0.5, 6), 13.6, 0.35); add(boom(1.6, 24), 13.75, 0.9); add(sweep(80, 400, 0.6) * env(int(0.6 * SR), 0.5, 0.5) * 0.4 + glitch(0.6, 7) * 0.3, 13.8, 0.6, 0.5)
d = 0.65; dr = filt(saw(41.2, d) + saw(41.6, d), 'lowpass', 300) * np.linspace(0.2, 1, int(d * SR)) * 0.5; add(dr, 13.75, 0.8)
for k in range(3): add(np.sin(2 * np.pi * [220, 233, 247][k] * 2 * t_(0.3)) * env(int(0.3 * SR), 0.01, 0.1) * 0.3, 14.0 + k * 0.1, 0.4, -0.5 + k * 0.5)
fade = np.ones(N); fade[-int(0.06 * SR):] = np.linspace(1, 0, int(0.06 * SR)); L *= fade; R *= fade
m = max(np.abs(L).max(), np.abs(R).max()); out = np.stack([L, R], 1) / m * 0.9
wavfile.write('part1-raw.wav', SR, (out * 32767).astype(np.int16)); print('ok', round(rt(14.35), 3))
