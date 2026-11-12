# 5 s synthwave fight cue: driving beat + bass, whooshes on dashes, punches on hits, glitch crackle on the split, boom on the burst.
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile
SR = 48000; DUR = 5.0; N = int(SR * DUR); L = np.zeros(N); R = np.zeros(N); rng = np.random.default_rng(7)
def t_(d): return np.arange(int(SR * d)) / SR
def add(x, at, gain=1.0, pan=0.0):
    i = int(at * SR); n = min(len(x), N - i)
    if n <= 0: return
    L[i:i + n] += x[:n] * gain * np.sqrt(0.5 * (1 - pan)) * 1.414; R[i:i + n] += x[:n] * gain * np.sqrt(0.5 * (1 + pan)) * 1.414
def filt(x, kind, f, order=2): return sosfilt(butter(order, f, kind, fs=SR, output='sos'), x)
def env(n, a, d): e = np.ones(n); ai = max(1, int(a * SR)); e[:ai] = np.linspace(0, 1, ai); e *= np.exp(-np.arange(n) / SR / d); return e
def saw(f, d): t = t_(d); return 2 * ((t * f) % 1) - 1
def kick(g=1.0):
    t = t_(0.35); f = 45 + 110 * np.exp(-t * 30); x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9); return x * g
def hat(): x = filt(rng.standard_normal(int(0.06 * SR)), 'highpass', 7000) * env(int(0.06 * SR), 0.001, 0.02); return x
def snare(): n = int(0.25 * SR); x = filt(rng.standard_normal(n), 'bandpass', [1200, 6000]) * env(n, 0.001, 0.07) + np.sin(2 * np.pi * 190 * t_(0.25)) * env(n, 0.001, 0.05) * 0.6; return x
def whoosh(d, up=True):
    n = int(d * SR); x = rng.standard_normal(n); e = np.sin(np.linspace(0, np.pi, n)) ** 2; lo = filt(x, 'bandpass', [600, 3000] if up else [300, 1800]); return lo * e
def punch(g=1.0, d=0.5):
    n = int(d * SR); t = t_(d); body = np.sin(2 * np.pi * np.cumsum(60 + 220 * np.exp(-t * 40)) / SR) * env(n, 0.001, 0.12)
    crack = filt(rng.standard_normal(n), 'bandpass', [1500, 9000]) * env(n, 0.0005, 0.03); return (body + crack * 0.8) * g
def glitch(d):
    n = int(d * SR); x = np.zeros(n); i = 0
    while i < n:
        seg = int(rng.uniform(0.008, 0.04) * SR); f = rng.choice([220, 440, 880, 1320, 1760, 3520]); s = np.sign(np.sin(2 * np.pi * f * np.arange(seg) / SR)) * (rng.random() > 0.3); m = min(seg, n - i)
        x[i:i + m] = s[:m]; i += seg
    return filt(x, 'lowpass', 6000) * 0.5
def boom():
    n = int(1.4 * SR); t = t_(1.4); sub = np.sin(2 * np.pi * np.cumsum(32 + 90 * np.exp(-t * 6)) / SR) * env(n, 0.002, 0.5)
    noise = filt(rng.standard_normal(n), 'lowpass', 900) * env(n, 0.002, 0.35); return sub + noise * 0.6
# real-time hit moments (hit-stop shifts later hits): 0.85, 1.41, 3.71
HIT = [0.85, 1.41, 3.71]
# ---- the beat (128 bpm), ducked around hits; full drop-out during the burst freeze
bpm = 128; b = 60 / bpm
music_L = np.zeros(N); music_R = np.zeros(N)
L0, R0 = L, R; L, R = music_L, music_R
for q in range(int(DUR / b) + 1):
    at = 0.62 + q * b
    if at < DUR: add(kick(0.9), at)
    if q % 2 == 1 and at < DUR: add(snare(), at, 0.35)
    for h in (0, 0.5): 
        if at + h * b < DUR: add(hat(), at + h * b, 0.18, 0.3 if h else -0.3)
# bass: driving 8ths on a minor progression
notes = [41.2, 41.2, 49.0, 36.7]   # E1 E1 G1 D1 (x2 octave)
for q in range(int(DUR / (b / 2)) + 1):
    at = 0.62 + q * b / 2
    if at >= DUR: break
    f = notes[(q // 8) % 4] * 2; d = b / 2 * 0.9; x = filt(saw(f, d) + 0.5 * saw(f * 1.005, d), 'lowpass', 900) * env(int(d * SR), 0.003, 0.12)
    add(x, at, 0.32)
# pad swell under the intro
d = 0.7; t = t_(d); pad = sum(filt(saw(f, d), 'lowpass', 1800) for f in (164.8, 196.0, 246.9)) * np.sin(np.linspace(0, np.pi / 2, len(t))) * 0.25; add(pad, 0.0, 0.5)
duck = np.ones(N)
for h in HIT: i = int(h * SR); w = int(0.35 * SR); duck[i:i + w] = np.minimum(duck[i:i + w], np.linspace(0.25, 1, w))
i0, i1 = int(3.71 * SR), int(3.86 * SR); duck[i0:i1] = 0.05
music_L *= duck; music_R *= duck
L, R = L0 + music_L, R0 + music_R
# ---- SFX
add(punch(0.7) + filt(rng.standard_normal(int(0.5 * SR)), 'bandpass', [3000, 9000]) * env(int(0.5 * SR), 0.001, 0.1) * 0.3, 0.06, 0.9)   # ROUND 1 slam
add(whoosh(0.32), 0.55, 0.7, 0.3)                   # alter ego dash (right -> left)
add(punch(1.0), HIT[0], 1.0, -0.2)
add(whoosh(0.22), 1.18, 0.8, -0.3)                  # hero counter-dash
add(punch(1.25), HIT[1], 1.0, 0.2); add(glitch(0.35), HIT[1] + 0.05, 0.25, 0.4)
add(glitch(0.45), 2.25, 0.35, 0.5)                  # the split into three
for k, (at, pn) in enumerate([(2.3, -0.6), (2.36, 0.0), (2.42, 0.6)]): add(np.sin(2 * np.pi * (600 + 300 * k) * t_(0.12)) * env(int(0.12 * SR), 0.002, 0.04), at, 0.25, pn)
d = 0.65; t = t_(d); charge = np.sin(2 * np.pi * np.cumsum(180 + 900 * (t / d) ** 2) / SR) * (t / d) ** 1.5 * 0.35; add(filt(charge, 'lowpass', 4000), 3.0, 0.6)   # aura charge riser
add(whoosh(0.25), 3.46, 0.8)                        # copies dash in
add(punch(1.4), HIT[2], 1.0); add(boom(), HIT[2], 1.0)
add(glitch(0.3), 4.25, 0.25, 0.5)                   # recombine, stunned
# title sting: bright arpeggio
for k, f in enumerate([659.3, 783.99, 987.8, 1318.5]):
    d = 0.6; x = (np.sign(np.sin(2 * np.pi * f * t_(d))) * 0.3 + np.sin(2 * np.pi * f * t_(d))) * env(int(d * SR), 0.003, 0.25); add(filt(x, 'lowpass', 5000), 4.05 + k * 0.07, 0.16, -0.4 + k * 0.27)
fade = np.ones(N); fade[-int(0.25 * SR):] = np.linspace(1, 0, int(0.25 * SR)); L *= fade; R *= fade
m = max(np.abs(L).max(), np.abs(R).max()); out = np.stack([L, R], 1) / m * 0.9
wavfile.write('fight-raw.wav', SR, (out * 32767).astype(np.int16)); print('ok')
