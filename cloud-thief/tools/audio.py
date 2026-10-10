#!/usr/bin/env python3
"""THE CLOUD THIEF — original score + sound design, synthesized from scratch (numpy/scipy).
Writes audio/score.wav (music), audio/sfx.wav, audio/mix.wav — 30 s, 48 kHz stereo."""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
import wave, os

SR = 48000
DUR = 30.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
OUT = os.path.join(os.path.dirname(__file__), '..', 'audio')
os.makedirs(OUT, exist_ok=True)

music = np.zeros((N, 2)); sfx = np.zeros((N, 2)); amb = np.zeros((N, 2))
BEAT = 0.5  # 120 bpm

def midi(n): return 440.0 * 2 ** ((n - 69) / 12)
NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
def nm(s):  # 'C5' -> midi
    name = s[:-1]; octv = int(s[-1]); return 12 * (octv + 1) + NOTE[name]
def hz(s): return midi(nm(s))

def tt(d): return np.arange(int(d * SR)) / SR
def env_ad(n, a=0.005, d=0.3, curve=1.0):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / max(d, 1e-4) * curve)
    return e
def env_adsr(n, a, d, s, r, hold):
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), np.where(t < a + d, 1 - (1 - s) * (t - a) / max(d, 1e-4), s))
    rel = np.clip((t - hold) / max(r, 1e-4), 0, 1)
    return e * (1 - rel)
def lp(x, f, order=2): return sosfilt(butter(order, min(f, SR / 2 - 100) / (SR / 2), 'low', output='sos'), x)
def hp(x, f, order=2): return sosfilt(butter(order, f / (SR / 2), 'high', output='sos'), x)
def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo / (SR / 2), min(hi, SR / 2 - 100) / (SR / 2)], 'band', output='sos'), x)

def place(buf, sig, t0, gain=1.0, pan=0.0):
    i0 = int(t0 * SR)
    if i0 >= N: return
    if i0 < 0: sig = sig[-i0:]; i0 = 0
    sig = sig[:N - i0]
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    buf[i0:i0 + len(sig), 0] += sig * gain * l * 1.414
    buf[i0:i0 + len(sig), 1] += sig * gain * r * 1.414

def saw(f, t, detune=0.0):
    ph = (f * (1 + detune)) * t
    return 2 * (ph - np.floor(ph + 0.5))
def sq(f, t): return np.sign(np.sin(2 * np.pi * f * t))

# ---------------------------------------------------------------- instruments
def musicbox(f, d=1.6):
    t = tt(d)
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t * 2.5) + 0.5 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t * 4)
         + 0.25 * np.sin(2 * np.pi * f * 3.01 * t) * np.exp(-t * 7) + 0.18 * np.sin(2 * np.pi * f * 4.17 * t) * np.exp(-t * 10))
    return s * np.minimum(1, t / 0.002)
def bell(f, d=2.5, idx=3.0, ratio=3.5):
    t = tt(d); I = idx * np.exp(-t * 3)
    return np.sin(2 * np.pi * f * t + I * np.sin(2 * np.pi * f * ratio * t)) * np.exp(-t * 1.6) * np.minimum(1, t / 0.002)
def pluck(f, d=0.6, bright=0.5):
    n = int(d * SR); p = max(2, int(SR / f))
    buf = rng.uniform(-1, 1, p); buf = lp(buf, 2000 + bright * 8000, 1)
    out = np.zeros(n); b = buf.copy()
    reps = n // p + 1
    for k in range(reps):
        seg = b; i = k * p
        out[i:i + p] = seg[:max(0, min(p, n - i))]
        b = 0.5 * (b + np.roll(b, -1)) * 0.994
    return out * env_ad(n, 0.001, d * 0.5)
def pad(freqs, d, a=0.4, r=0.6, bright=2500, vib=0.0, detune=0.006):
    t = tt(d); s = np.zeros(len(t))
    for f in freqs:
        for dt in (-detune, 0, detune):
            fm = f * (1 + vib * 0.004 * np.sin(2 * np.pi * 5.2 * t))
            ph = np.cumsum(fm * (1 + dt)) / SR
            s += 2 * (ph - np.floor(ph + 0.5))
    s = lp(s / (3 * len(freqs)), bright, 2)
    return s * env_adsr(len(t), a, 0.2, 0.85, r, d - r)
def choir(freqs, d, a=0.5, r=0.7):
    t = tt(d); src = np.zeros(len(t))
    for f in freqs:
        fm = f * (1 + 0.005 * np.sin(2 * np.pi * 5.5 * t + f))
        ph = np.cumsum(fm) / SR; src += 2 * (ph - np.floor(ph + 0.5))
    v = bp(src, 650, 950) * 1.0 + bp(src, 1050, 1300) * 0.6 + bp(src, 2600, 3100) * 0.25
    return v / len(freqs) * env_adsr(len(t), a, 0.2, 0.9, r, d - r) * 2.5
def brass(f, d=0.25):
    t = tt(d); s = saw(f, t) + saw(f, t, 0.004)
    fe = 600 + 3500 * np.exp(-t * 12)
    out = np.zeros(len(t)); seg = 512
    for i in range(0, len(t), seg): out[i:i + seg] = lp(s[i:i + seg], fe[i], 2)  # coarse filter env
    return out * env_adsr(len(t), 0.01, 0.08, 0.6, 0.08, d - 0.08) * 0.6
def flute(f, d, vib=1.0):
    t = tt(d); fm = f * (1 + 0.006 * vib * np.sin(2 * np.pi * 5 * t) * np.minimum(1, t / 0.3))
    ph = np.cumsum(fm) / SR
    s = np.sin(2 * np.pi * ph) + 0.18 * np.sin(4 * np.pi * ph) + 0.05 * np.sin(6 * np.pi * ph)
    s += bp(rng.normal(0, 1, len(t)), f * 0.9, f * 1.6) * 0.08
    return s * env_adsr(len(t), 0.04, 0.1, 0.85, 0.12, d - 0.12)
def xylo(f, d=0.35):
    t = tt(d); return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t * 20)) * np.exp(-t * 11) * np.minimum(1, t / 0.001)
def kick(d=0.35):
    t = tt(d); f = 45 + 90 * np.exp(-t * 30); ph = np.cumsum(f) / SR
    return (np.sin(2 * np.pi * ph) * np.exp(-t * 9) + rng.normal(0, 1, len(t)) * np.exp(-t * 200) * 0.3)
def snare(d=0.22):
    t = tt(d); n = bp(rng.normal(0, 1, len(t)), 1500, 8000) * np.exp(-t * 18)
    return n * 0.9 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25) * 0.6
def hat(d=0.05, open_=False):
    t = tt(d if not open_ else 0.25); return hp(rng.normal(0, 1, len(t)), 7000) * np.exp(-t * (80 if not open_ else 14)) * 0.5
def timp(f, d=1.2):
    t = tt(d); ff = f * (1 + 0.15 * np.exp(-t * 20)); ph = np.cumsum(ff) / SR
    return (np.sin(2 * np.pi * ph) + 0.4 * np.sin(2 * np.pi * 1.5 * ph)) * np.exp(-t * 3) + lp(rng.normal(0, 1, len(t)), 400) * np.exp(-t * 30) * 0.5
def cymbal_swell(d):
    t = tt(d); return hp(rng.normal(0, 1, len(t)), 4000) * (t / d) ** 3 * 0.5
def crash(d=2.0):
    t = tt(d); return hp(rng.normal(0, 1, len(t)), 3000) * np.exp(-t * 2.2) * 0.6

# ---------------------------------------------------------------- SCORE
M = lambda s, t0, g=1.0, pan=0.0: place(music, s, t0, g, pan)
def chord(names): return [hz(n) for n in names]

# 0–3: lonely music box over a soft pad (A minor → F)
sad = [('E5', 0.15), ('C5', 0.65), ('A4', 1.15), ('B4', 1.65), ('C5', 1.9), ('B4', 2.15), ('A4', 2.4)]
for n, t0 in sad: M(musicbox(hz(n), 2.0), t0, 0.32, 0.25)
M(pad(chord(['A3', 'C4', 'E4']), 1.6, a=0.6, bright=1200), 0.0, 0.16, -0.2)
M(pad(chord(['F3', 'A3', 'C4']), 1.8, a=0.4, bright=1200), 1.5, 0.16, -0.2)
# 3–6: discovery — Dm, G, then the idea lifts to C with an arpeggio
M(pad(chord(['D3', 'F3', 'A3']), 1.2, a=0.3, bright=1500), 3.0, 0.15)
for i, n in enumerate(['D5', 'F5', 'A5', 'F5']): M(musicbox(hz(n), 1.2), 3.0 + i * 0.25, 0.22, 0.3)
M(pad(chord(['G3', 'B3', 'D4']), 1.2, a=0.2, bright=1600), 4.2, 0.15)
for i, n in enumerate(['G4', 'B4', 'D5']): M(musicbox(hz(n), 1.0), 4.3 + i * 0.22, 0.2, 0.3)
for i, n in enumerate(['C5', 'E5', 'G5', 'C6', 'E6']): M(bell(hz(n), 1.4, 2.0), 5.25 + i * 0.05, 0.16, -0.3 + i * 0.15)
M(pad(chord(['C4', 'E4', 'G4']), 0.8, a=0.05, bright=2500), 5.25, 0.18)
M(cymbal_swell(0.5), 5.5, 0.25)
# 6–8.5: sneaky pizzicato tiptoe (A minor), then the alarm
for i in range(10):
    t0 = 6.0 + i * 0.25
    if t0 >= 7.6: break
    M(pluck(hz(['A2', 'E3', 'A2', 'E3', 'C3', 'G3', 'C3', 'G3'][i % 8]), 0.3, 0.3), t0, 0.5, -0.2)
    if i % 2 == 0: M(pluck(hz(['E4', 'A4', 'C5', 'B4', 'A4', 'G4'][(i // 2) % 6]), 0.35, 0.7), t0 + 0.125, 0.35, 0.3)
M(brass(hz('E4'), 0.4), 7.92, 0.35); M(brass(hz('Bb3'), 0.4), 7.92, 0.3)
M(timp(hz('A2'), 0.8), 7.92, 0.5)
# 8.5–16.5: the chase — 120bpm driving, Am F C G ×2 (2 beats each)
prog = [('A2', ['A3', 'C4', 'E4']), ('F2', ['F3', 'A3', 'C4']), ('C3', ['C4', 'E4', 'G4']), ('G2', ['G3', 'B3', 'D4'])] * 2
lead = ['A5', 'C6', 'B5', 'A5', 'G5', 'A5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'D6', 'C6', 'B5', 'G5']
for ci, (root, ch) in enumerate(prog):
    t0 = 8.5 + ci * 1.0
    hang = 14.05 <= t0 < 15.7
    if not hang:
        for k in range(4): M(pluck(hz(root) * (1.5 if k % 2 else 1), 0.24, 0.6), t0 + k * 0.25, 0.55, -0.1)
        M(brass(hz(ch[2]), 0.18), t0 + 0.75, 0.22, 0.2); M(brass(hz(ch[0]), 0.18), t0 + 0.75, 0.2, -0.2)
    M(pad(chord(ch), 1.0, a=0.05, r=0.3, bright=2200 if not hang else 3200, vib=1), t0, 0.1 if not hang else 0.16)
for i, n in enumerate(lead):
    t0 = 8.5 + i * 0.5
    if 13.9 < t0 < 15.7: continue
    M(xylo(hz(n), 0.4), t0, 0.35, 0.35); M(xylo(hz(n), 0.4), t0 + 0.25, 0.18, 0.4)
for b in range(16):
    t0 = 8.5 + b * 0.5
    if 14.0 <= t0 < 15.7: continue
    M(kick(), t0, 0.7)
    if b % 2 == 1: M(snare(), t0, 0.45, 0.1)
    for h in range(2): M(hat(), t0 + h * 0.25 + 0.125, 0.25, -0.3)
for k in range(6): M(snare(0.12), 13.4 + k * 0.1, 0.22 + k * 0.05, 0.1)  # fill into the leap
# hang time: suspended, airy swell
M(pad(chord(['F3', 'A3', 'C4', 'E4', 'G4']), 1.8, a=0.4, r=0.5, bright=4000, vib=1), 14.05, 0.2)
M(choir(chord(['C5', 'E5', 'G5']), 1.7, a=0.5, r=0.6), 14.1, 0.18)
M(cymbal_swell(1.6), 14.1, 0.18)
M(crash(1.5), 15.72, 0.22); M(kick(), 15.72, 0.8); M(timp(hz('C3'), 1.0), 15.72, 0.6)
# 16.5–19: the failed miracle — soft and sad, then warmth with the hug
M(pad(chord(['F3', 'A3', 'C4']), 1.0, a=0.2, bright=1400), 16.5, 0.15)
for i, n in enumerate(['C5', 'F5', 'A5']): M(musicbox(hz(n), 1.2), 16.95 + i * 0.12, 0.22, 0.2)  # ta-da
M(pad(chord(['E3', 'G3', 'B3']), 1.0, a=0.3, bright=1200), 17.5, 0.14)
M(pad(chord(['D3', 'F3', 'A3']), 0.9, a=0.3, bright=1000), 18.2, 0.14)
for n, t0 in [('A4', 18.25), ('G4', 18.45), ('F4', 18.65)]: M(musicbox(hz(n), 1.5), t0, 0.22, 0.2)
M(pad(chord(['F3', 'A3', 'C4', 'E4']), 1.2, a=0.3, bright=1800), 18.75, 0.17)
M(musicbox(hz('E5'), 1.5), 18.8, 0.2); M(musicbox(hz('C5'), 1.5), 18.8, 0.14)
# 19–21.2: giggle & the big inhale — rising tremolo strings over a G pedal, timpani roll crescendo
t = tt(2.2); rise = np.zeros(len(t))
for f0 in (hz('G3'), hz('D4'), hz('G4'), hz('B4')):
    f = f0 * 2 ** (t / 2.2 * 7 / 12)
    ph = np.cumsum(f) / SR; rise += 2 * (ph - np.floor(ph + 0.5))
rise = lp(rise / 4, 3000) * (0.6 + 0.4 * np.sin(2 * np.pi * 12 * t)) * (t / 2.2) ** 1.5
M(rise, 19.0, 0.2)
for k in range(int(2.1 / 0.06)): M(timp(hz('G2'), 0.2), 19.1 + k * 0.06, 0.05 + 0.25 * (k * 0.06 / 2.1) ** 2)
M(cymbal_swell(1.8), 19.4, 0.22)
# 21.2–21.5: silence (nothing)
# 21.5: ACHOO — orchestral hit
hit = pad(chord(['C3', 'G3', 'C4', 'E4', 'G4', 'C5']), 1.4, a=0.005, r=1.0, bright=6000)
M(hit, 21.5, 0.6); M(crash(3.0), 21.5, 0.45); M(timp(hz('C2'), 2.0), 21.5, 1.0); M(kick(0.6), 21.5, 1.0)
# 22–26.5: the bloom — soaring theme
bloomprog = [(22.0, ['C3', 'C4', 'E4', 'G4']), (23.0, ['B2', 'B3', 'D4', 'G4']), (24.0, ['A2', 'A3', 'C4', 'E4']), (25.0, ['F2', 'F3', 'A3', 'C4']), (25.75, ['G2', 'G3', 'B3', 'D4'])]
for i, (t0, ch) in enumerate(bloomprog):
    d = (bloomprog[i + 1][0] if i + 1 < len(bloomprog) else 26.5) - t0 + 0.4
    M(pad(chord(ch[1:]), d, a=0.15, r=0.4, bright=3500, vib=1.5), t0, 0.2, -0.15)
    M(choir(chord(ch[1:]), d, a=0.2, r=0.4), t0, 0.14, 0.15)
    M(pad([hz(ch[0])], d, a=0.05, r=0.3, bright=500), t0, 0.35)
    M(timp(hz(ch[0]) * 2, 1.0), t0, 0.45)
theme = [('E5', 22.0, 0.5), ('G5', 22.5, 0.5), ('C6', 23.0, 0.75), ('B5', 23.75, 0.25), ('A5', 24.0, 0.5), ('G5', 24.5, 0.5), ('A5', 25.0, 0.5), ('C6', 25.5, 0.25), ('D6', 25.75, 0.75)]
for n, t0, d in theme: M(flute(hz(n), d + 0.1), t0, 0.32, 0.1)
for k in range(36):  # glittering bell arpeggios
    t0 = 22.0 + k * 0.125; ch = [c for tb, c in bloomprog if tb <= t0][-1]
    M(bell(hz(ch[1 + k % 3]) * 4, 0.8, 1.5), t0, 0.06, np.sin(k) * 0.6)
M(cymbal_swell(0.6), 25.9, 0.3)
# 26.5–30: the little reward — warm resolution, music box reprise in major
M(crash(2.0), 26.5, 0.18)
M(pad(chord(['F3', 'A3', 'C4', 'E4']), 1.3, a=0.2, bright=2200, vib=1), 26.5, 0.17)
M(pad(chord(['G3', 'B3', 'D4', 'F4']), 1.3, a=0.2, bright=2200, vib=1), 27.6, 0.17)
M(pad(chord(['C3', 'G3', 'C4', 'E4', 'G4']), 2.6, a=0.3, r=1.5, bright=2600, vib=1), 28.7, 0.2)
M(choir(chord(['E4', 'G4', 'C5']), 2.5, a=0.4, r=1.4), 28.7, 0.12)
rep = [('E5', 26.6), ('G5', 26.9), ('A5', 27.2), ('G5', 27.5), ('E5', 27.8), ('D5', 28.1), ('E5', 28.4), ('C5', 28.7), ('G5', 29.1), ('C6', 29.35)]
for n, t0 in rep: M(musicbox(hz(n), 2.0), t0, 0.3, 0.2)
for i, n in enumerate(['C6', 'E6', 'G6', 'C7']): M(bell(hz(n), 1.2, 1.2), 29.3 + i * 0.06, 0.07, -0.4 + i * 0.25)

# ---------------------------------------------------------------- SFX
S = lambda s, t0, g=1.0, pan=0.0: place(sfx, s, t0, g, pan)
def squeak(f0, f1, d, vib=0.0, bright=1.0):
    t = tt(d); f = f0 * (f1 / f0) ** (t / d) * (1 + vib * 0.03 * np.sin(2 * np.pi * 14 * t)); ph = np.cumsum(f) / SR
    s = np.sin(2 * np.pi * ph) + 0.3 * bright * np.sin(4 * np.pi * ph) + 0.1 * bright * np.sin(6 * np.pi * ph)
    return s * env_adsr(len(t), 0.01, 0.05, 0.8, d * 0.4, d * 0.6)
def beep(f, d=0.08, wave_='sq'):
    t = tt(d); s = (sq(f, t) * 0.4 if wave_ == 'sq' else np.sin(2 * np.pi * f * t)); return lp(s, 5000) * env_adsr(len(t), 0.003, 0.02, 0.8, 0.02, d - 0.02)
def whoosh(d, lo=300, hi=3000, peak=0.5):
    t = tt(d); n = rng.normal(0, 1, len(t)); e = np.exp(-((t / d - peak) ** 2) / 0.06)
    out = np.zeros(len(t)); seg = 1024
    for i in range(0, len(t), seg):
        k = i / len(t); fc = lo + (hi - lo) * np.sin(np.pi * k)
        out[i:i + seg] = bp(n[i:i + seg], fc * 0.7, fc * 1.3, 1)
    return out * e
def metal(f, d=0.4, partials=(1, 2.76, 5.4, 8.9), decay=8):
    t = tt(d); return sum(np.sin(2 * np.pi * f * p * t) * np.exp(-t * decay * (1 + i * 0.6)) / (i + 1) for i, p in enumerate(partials)) * np.minimum(1, t / 0.0005)
def thud(d=0.2, f=90):
    t = tt(d); return np.sin(2 * np.pi * f * t * (1 - t)) * np.exp(-t * 25) + lp(rng.normal(0, 1, len(t)), 600) * np.exp(-t * 40) * 0.5
def boing(f0=200, d=0.5):
    t = tt(d); f = f0 * (1 + 0.6 * np.exp(-t * 6) * np.sin(2 * np.pi * 9 * t)); ph = np.cumsum(f) / SR
    return np.sin(2 * np.pi * ph) * np.exp(-t * 5)
def pop(f=900, d=0.08):
    t = tt(d); fr = f * (1 + 2 * np.exp(-t * 80)); ph = np.cumsum(fr) / SR; return np.sin(2 * np.pi * ph) * np.exp(-t * 50)
def plip(f=1400):
    t = tt(0.12); fr = f * (1 + 1.2 * t / 0.12); ph = np.cumsum(fr) / SR; return np.sin(2 * np.pi * ph) * np.exp(-t * 40)
def footsteps(t0, t1, rate, g=0.2, f=2200, pan=0.0):
    k = 0; t = t0
    while t < t1: S(metal(f * (0.9 + 0.2 * (k % 2)), 0.05, decay=60) * 0.6 + thud(0.05, 180) * 0.4, t, g, pan); t += 1 / rate; k += 1
def giggle(t0, n=5, f=1300, g=0.25, pan=0.0):
    for i in range(n): S(squeak(f * (1.1 - 0.04 * i), f * (0.85 - 0.04 * i), 0.09, vib=1), t0 + i * 0.1, g * (1 - i * 0.08), pan)
def formant_voice(f0_curve, d, formants, noise=0.0):
    t = tt(d); f0 = f0_curve(t); ph = np.cumsum(f0) / SR; src = 2 * (ph - np.floor(ph + 0.5)) + rng.normal(0, 1, len(t)) * noise
    return sum(bp(src, f * 0.85, f * 1.15) * a for f, a in formants)

# S1
S(metal(2400, 0.5, decay=9), 1.0, 0.28, 0.2)  # pathetic clink
S(metal(5200, 0.08, decay=40), 1.12, 0.1, 0.1)
S(squeak(700, 520, 0.35, vib=0.5), 1.6, 0.08)  # Pip's tiny sad whirr
# S2
S(whoosh(0.8, 400, 1500), 3.0, 0.12, -0.3)
S(whoosh(0.45, 600, 5000, 0.4), 3.75, 0.35, 0.0)
S(squeak(900, 650, 0.4, vib=1), 4.45, 0.12, 0.2)  # Puff whimper
S(squeak(700, 1100, 0.18), 4.65, 0.12)  # Puff hopeful
S(beep(1760, 0.07), 5.24, 0.15); S(beep(2350, 0.12), 5.32, 0.15)  # idea!
S(whoosh(0.3, 800, 4000, 0.3), 5.65, 0.3); footsteps(5.65, 6.0, 18, 0.12)
# S3
footsteps(6.0, 6.22, 16, 0.12); S(whoosh(0.35, 300, 2000), 6.22, 0.25);
S(boing(500, 0.2), 6.68, 0.12); S(boing(620, 0.2), 6.9, 0.12)
S(metal(3000, 0.06, decay=60), 7.15, 0.25)  # latch click
S(pop(700, 0.12), 7.25, 0.5); S(squeak(900, 1700, 0.3, vib=1), 7.3, 0.25)  # pop! + Puff wheee
S(metal(3500, 0.6, decay=5) + metal(4700, 0.6, decay=6) * 0.7, 7.65, 0.22, 0.3)  # glass tinkle crash
for k in range(14): S(metal(1250, 0.5, (1, 2.4, 3.9, 5.3), decay=4), 7.66 + k * 0.065, 0.2 * np.exp(-k * 0.1), 0.4)  # alarm bell
S(formant_voice(lambda t: 160 + 120 * np.exp(-t * 6), 0.35, [(700, 1), (1200, 0.6)]), 7.92, 0.3, -0.1)  # vendor gasp
for k in range(5): S(beep(1300 if k % 2 else 980, 0.07), 8.24 + k * 0.08, 0.12, -0.3)  # guard siren beeps
t = tt(1.2); S(lp(rng.normal(0, 1, len(t)), 800) * (0.5 + 0.5 * np.sin(2 * np.pi * 60 * t)) * np.minimum(1, t / 0.2), 8.24, 0.1, -0.2)  # propellers
# S4 chase
footsteps(8.5, 10.0, 16, 0.1, pan=0.1); footsteps(10.4, 10.9, 16, 0.1)
footsteps(8.9, 10.3, 9, 0.08, f=900, pan=-0.3)  # guard clanks
S(whoosh(0.4, 300, 2500), 10.05, 0.3)
S(boing(140, 0.6) * 0.6 + metal(800, 0.6, decay=10) * 0.4, 10.3, 0.3, -0.2)  # guard into noodles
S(squeak(400, 300, 0.3, vib=2), 10.35, 0.08, -0.2)
S(boing(180, 0.8), 10.92, 0.4, 0.1)  # sprung awning
S(whoosh(0.5, 500, 3000), 11.12, 0.25)
t = tt(1.5); grind = bp(rng.normal(0, 1, len(t)), 2500, 7000) * (0.6 + 0.4 * np.sin(2 * np.pi * 37 * t)) * np.minimum(1, t / 0.05) * np.minimum(1, (1.5 - t) / 0.1)
S(grind, 11.6, 0.12, 0.1)
t = tt(2.0); horn = (saw(98, t) + saw(98.6, t) + 0.5 * saw(147, t)); S(lp(horn, 500) * env_adsr(len(t), 0.3, 0.2, 0.8, 0.6, 1.4) * 0.5, 11.7, 0.18, -0.3)  # airship
# S5
for k in range(6): S(beep(880, 0.15, 'sin') + beep(660, 0.15, 'sin'), 12.85 + k * 0.32, 0.08, 0.3)  # bridge klaxon
t = tt(3.2); S(lp(rng.normal(0, 1, len(t)), 220) * np.minimum(1, t / 0.3) * np.minimum(1, (3.2 - t) / 0.5) + metal(110, 3.2, decay=0.5) * 0.15, 12.9, 0.25)  # retracting rumble
footsteps(13.12, 14.05, 22, 0.1)
S(whoosh(0.5, 500, 4000), 14.05, 0.3)
t = tt(1.7); S(bp(rng.normal(0, 1, len(t)), 300, 1200) * np.sin(np.pi * t / 1.7), 14.05, 0.14)  # wind, hang time
S(formant_voice(lambda t: 500 + 300 * t, 0.35, [(900, 1), (1400, 0.5)], 0.3) * 0.5, 14.35, 0.18, 0.2)  # Puff poof inflate
S(thud(0.25, 80), 15.72, 0.5); S(metal(1800, 0.15, decay=30), 15.73, 0.12)
S(metal(600, 0.4, decay=8), 16.05, 0.25, -0.4); S(boing(110, 1.0), 16.42, 0.35, -0.4)  # guard + cable twang
# S6
for k, t0 in enumerate([16.55, 16.68, 16.8]): S(thud(0.15, 120 + k * 20), t0, 0.25)
S(squeak(1200, 1400, 0.12), 17.05, 0.08);
t = tt(0.5); S(squeak(300, 330, 0.5, vib=3) * (0.7 + 0.3 * np.sin(2 * np.pi * 30 * t)), 17.5, 0.12, -0.1)  # Puff straining hum
S(plip(1500), 18.17, 0.35, -0.1)  # the single drop
S(squeak(800, 450, 0.45, vib=1.5), 18.25, 0.15, -0.1)  # aww
for k in range(3): S(thud(0.06, 400) * 0.5, 18.52 + k * 0.08, 0.12)  # pats
S(squeak(600, 700, 0.3), 18.75, 0.06)
# S7
giggle(19.0, 6, 1350, 0.22, -0.1)
S(beep(1400, 0.05, 'sin'), 19.15, 0.06); S(beep(1700, 0.05, 'sin'), 19.25, 0.06)
for k, (a, b) in enumerate([(19.95, 20.2), (20.3, 20.55), (20.65, 20.95), (21.0, 21.35)]):
    S(formant_voice(lambda t, k=k: 300 + 200 * k + 400 * t, b - a, [(800 + k * 100, 1), (1300, 0.5)], 0.6) * 0.4, a, 0.12 + k * 0.05, -0.1)  # gulps "ah..ah..AH"
S(beep(2000, 0.06), 19.92, 0.1)
# ACHOO
achoo = formant_voice(lambda t: 520 - 180 * t, 0.22, [(500, 1), (900, 0.6), (2400, 0.3)], 0.8)
choo = bp(rng.normal(0, 1, int(0.5 * SR)), 1800, 7000) * env_ad(int(0.5 * SR), 0.004, 0.15)
S(achoo * 0.6, 21.48, 0.4); S(choo, 21.5, 0.8)
t = tt(2.5); S(lp(rng.normal(0, 1, len(t)), 150) * np.exp(-t * 2) + np.sin(2 * np.pi * 40 * t) * np.exp(-t * 3), 21.5, 0.6)  # boom
t = tt(3.5); shimmer = sum(np.sin(2 * np.pi * f * t) * (0.5 + 0.5 * np.sin(2 * np.pi * (3 + i) * t)) for i, f in enumerate([2093, 2637, 3136, 3951, 4186])) / 5
S(shimmer * np.exp(-t * 0.8) * np.minimum(1, t / 0.3), 21.6, 0.18)
# S8 bloom: rain hiss + hundreds of tiny blossom pops + chimes
t = tt(5.0); rain = hp(rng.normal(0, 1, len(t)), 3000) * np.minimum(1, t / 0.8) * np.minimum(1, (5.0 - t) / 1.2)
place(sfx, rain * 0.045, 22.3, 1.0, -0.3); place(sfx, hp(rng.normal(0, 1, len(t)), 3000) * np.minimum(1, t / 0.8) * np.minimum(1, (5.0 - t) / 1.2) * 0.045, 22.3, 1.0, 0.3)
for k in range(140):
    t0 = 22.3 + rng.uniform(0, 4.2) ** 1.1; S(pop(rng.uniform(900, 2600), 0.06), t0, rng.uniform(0.03, 0.09), rng.uniform(-0.9, 0.9))
S(formant_voice(lambda t: 220 + 200 * np.sin(np.pi * t / 0.5), 0.5, [(700, 1), (1150, 0.6)]), 24.3, 0.22, 0.2)  # vendor "whoo!"
giggle(24.4, 4, 900, 0.1, -0.4)
# S9
S(squeak(700, 1000, 0.25, vib=1), 27.0, 0.08)
t = tt(0.5); S(lp(rng.normal(0, 1, len(t)), 900) * np.sin(np.pi * t / 0.5) * 0.6, 28.05, 0.2)  # soft poof on head
S(boing(700, 0.3), 28.2, 0.06)
S(beep(1500, 0.06, 'sin'), 28.3, 0.05); S(beep(1200, 0.06, 'sin'), 28.38, 0.05)  # puzzled
for i, n in enumerate(['G6', 'C7']): S(bell(hz(n), 0.8, 1.0), 28.62 + i * 0.07, 0.08)  # proud sparkle
S(formant_voice(lambda t: 900, 0.08, [(1200, 1), (2500, 0.5)], 1.0) * 0.6 + bp(rng.normal(0, 1, int(0.08 * SR)), 3000, 8000) * 0.4, 29.02, 0.25, 0.1)  # tiny "tchoo"
S(plip(1800), 29.25, 0.3)
for i in range(5): S(beep([1500, 1800, 1600, 2000, 2400][i], 0.06, 'sin'), 29.32 + i * 0.09, 0.09)  # Pip's giggle bleeps
giggle(29.4, 4, 1500, 0.12, -0.2)

# ---------------------------------------------------------------- ambience: wind, distant machinery, gears, birds
t = tt(DUR)
wind = lp(rng.normal(0, 1, N), 500) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.13 * t))
hum = lp(saw(55, t) + saw(55.3, t), 200) * 0.3
amb[:, 0] += wind * 0.05 + hum * 0.03; amb[:, 1] += np.roll(wind, 1999) * 0.05 + hum * 0.03
for k in range(int(DUR / 0.5)):
    place(amb, metal(3000, 0.03, decay=80), k * 0.5 + 0.13, 0.025, -0.5)  # clockwork tick
for k in range(10):
    t0 = rng.uniform(0, 28); place(amb, squeak(2500, 3200, 0.07) + 0.0, t0, 0.02, rng.uniform(-1, 1)); place(amb, squeak(3000, 2600, 0.06), t0 + 0.09, 0.02, rng.uniform(-1, 1))
amb[int(21.2 * SR):int(21.5 * SR)] *= np.linspace(1, 0.1, int(0.3 * SR))[:, None]

# ---------------------------------------------------------------- reverb + master
def reverb(x, secs=2.2, wet=0.25, damp=3000):
    n = int(secs * SR); tt_ = np.arange(n) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = rng.normal(0, 1, n) * np.exp(-tt_ * 6.9 / secs); ir = lp(ir, damp); ir[:int(0.012 * SR)] = 0; ir /= np.sqrt(np.sum(ir ** 2))
        out[:, ch] = fftconvolve(x[:, ch], ir)[:len(x)]
    return x * (1 - wet) + out * wet
music = reverb(music, 2.6, 0.32)
sfx = reverb(sfx, 1.2, 0.15, 5000)
# silence beat before the sneeze (music + ambience duck)
gate = np.ones(N); i0, i1 = int(21.18 * SR), int(21.48 * SR); gate[i0:i1] = np.linspace(1, 0.04, i1 - i0) ** 0.5
music *= gate[:, None]
mix = music * 0.9 + sfx * 0.85 + amb
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix /= np.max(np.abs(mix)) / 0.89
def write(path, x):
    x16 = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(x16.tobytes())
write(os.path.join(OUT, 'mix.wav'), mix)
write(os.path.join(OUT, 'score.wav'), music / max(1e-9, np.max(np.abs(music))) * 0.89)
write(os.path.join(OUT, 'sfx.wav'), sfx / max(1e-9, np.max(np.abs(sfx))) * 0.89)
print('ok', mix.shape)
