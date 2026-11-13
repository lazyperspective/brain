# KILN — LIGHT · score + sound design, synthesized and cued to picture (52 s).
#   python3 score_light.py out.wav
# Music: D major. Evolving pads (additive, slow-breathing), felt piano, soft pulses from the Ask press onward,
# building to a resolved D add9 on the title. Sound design: air, light swells, iris whir, dial ticks,
# glass chimes on wake, the ember tone, UI taps and plucks, whooshes on camera moves, rain, the condense sweep.
import sys, numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 48000; DUR = 52.0; N = int(SR * DUR); rng = np.random.default_rng(7)
def t_(d): return np.arange(int(SR * d)) / SR
def filt(x, kind, f, o=2): return sosfilt(butter(o, f, kind, fs=SR, output='sos'), x)
def N2F(n): return 440.0 * 2 ** ((n - 69) / 12)
def adsr(n, a, r, curve=2):
    e = np.ones(n); ai, ri = max(1, int(a * SR)), max(1, int(r * SR)); ai = min(ai, n); ri = min(ri, n)
    e[:ai] = np.linspace(0, 1, ai) ** curve; e[-ri:] *= np.linspace(1, 0, ri) ** curve; return e
def pan2(x, p): return np.stack([x * np.sqrt(0.5 * (1 - p)), x * np.sqrt(0.5 * (1 + p))]) * 1.414

class Bus:
    def __init__(s): s.x = np.zeros((2, N))
    def add(s, sig, at, g=1.0, pan=0.0):
        i = int(at * SR)
        if i < 0: sig = sig[-i:] if sig.ndim == 1 else sig[:, -i:]; i = 0
        st = pan2(sig, pan) if sig.ndim == 1 else sig
        n = min(st.shape[1], N - i)
        if n > 0: s.x[:, i:i + n] += st[:, :n] * g

music, sfx, amb = Bus(), Bus(), Bus()

# ------------------------------------------------------------------ instruments
def pad(notes, d, a=2.0, r=2.5, bright=1.0, g=1.0):
    t = t_(d); out = np.zeros((2, len(t)))
    for k, n in enumerate(notes):
        f = N2F(n)
        for side, det in ((0, -0.0035), (1, 0.0035)):
            vib = 1 + 0.0018 * np.sin(2 * np.pi * (0.13 + 0.05 * k) * t + k + side)
            ph = 2 * np.pi * np.cumsum(f * (1 + det) * vib) / SR
            sig = sum((1 / h ** (1.6 / bright)) * np.sin(h * ph + h * k) for h in range(1, 7))
            sig *= 0.8 + 0.2 * np.sin(2 * np.pi * (0.07 + 0.03 * k) * t + k * 1.3)   # slow breathing
            out[side] += sig
    out *= adsr(len(t), a, r) / (len(notes) * 2.4) * g
    return out
def felt(n, d=4.0, g=1.0, bright=1.0):
    f = N2F(n); t = t_(d); B = 0.0004
    x = sum(a * np.sin(2 * np.pi * f * h * np.sqrt(1 + B * h * h) * t + h * 0.7) * np.exp(-t * (0.9 + h * 0.9 / bright))
            for h, a in [(1, 1.0), (2, 0.42), (3, 0.2), (4, 0.11), (5, 0.06), (6, 0.03)])
    thump = filt(rng.standard_normal(len(t)), 'lowpass', 900) * np.exp(-t * 60) * 0.25
    x = (x + thump) * np.minimum(1, t / 0.006)
    return filt(x, 'lowpass', 3200 * bright) * g
def bell(n, d=4.0, g=1.0, glassy=1.0):
    f = N2F(n); t = t_(d)
    x = sum(a * np.sin(2 * np.pi * f * k * t + k) * np.exp(-t * dk) for k, a, dk in [(1, 1, 0.8), (2.0, 0.35, 1.2), (2.76, 0.4 * glassy, 1.8), (5.4, 0.2 * glassy, 3.0), (8.93, 0.1 * glassy, 5.0)])
    return x * np.minimum(1, t / 0.002) * g
def ember_tone(d=3.0, g=1.0, f0=N2F(69)):
    t = t_(d); mod = np.sin(2 * np.pi * f0 * 2 * t) * 0.6 * np.exp(-t * 0.8)
    x = np.sin(2 * np.pi * f0 * t + mod) + 0.35 * np.sin(2 * np.pi * f0 * 1.5 * t) + 0.25 * np.sin(2 * np.pi * f0 * 2 * t + 0.4) + 0.12 * np.sin(2 * np.pi * f0 * 3.01 * t)
    x *= 1 + 0.15 * np.sin(2 * np.pi * 4.2 * t)
    return x * adsr(len(t), 0.35, 1.6) * g
def noise(d): return rng.standard_normal(int(SR * d))
def whoosh(d, lo=250, hi=3000, g=1.0, shape=2.0):
    n = int(d * SR); x = noise(d); u = np.linspace(0, 1, n); env = np.sin(np.pi * u) ** shape
    # sweep: blend a low band into a high band
    a = filt(x, 'bandpass', [lo, lo * 3]); b = filt(x, 'bandpass', [hi / 3, hi]); y = a * (1 - u) + b * u
    return np.stack([y * env, np.roll(y, 240) * env]) * g
def swell(d, g=1.0, f=N2F(74)):   # a light swell: airy noise + a soft rising shimmer
    t = t_(d); u = t / d; env = u ** 2 * (1 - u) ** 0.4 * 2.2
    air = filt(noise(d), 'bandpass', [2500, 9000]) * 0.3
    sh = sum(np.sin(2 * np.pi * f * k * (1 + 0.02 * u) * t + k) / k for k in (1, 2, 3)) * 0.25
    return (air + sh) * env * g
def tick(g=1.0, f=3200, d=0.06):
    t = t_(d); return (np.sin(2 * np.pi * f * t) * np.exp(-t * 120) + filt(noise(d), 'highpass', 5000) * np.exp(-t * 300) * 0.5) * g
def detent(g=1.0):   # dial click: two micro transients + a tiny metallic ring
    t = t_(0.12); x = filt(noise(0.12), 'bandpass', [2500, 9000]) * np.exp(-t * 400)
    x += 0.6 * np.roll(filt(noise(0.12), 'bandpass', [1500, 6000]) * np.exp(-t * 500), int(0.009 * SR))
    x += 0.25 * np.sin(2 * np.pi * 5100 * t) * np.exp(-t * 60)
    return x * g
def tap(g=1.0):
    t = t_(0.25); return (np.sin(2 * np.pi * np.cumsum(220 + 500 * np.exp(-t * 60)) / SR) * np.exp(-t * 28) * 0.7 + filt(noise(0.25), 'bandpass', [1500, 5000]) * np.exp(-t * 200) * 0.3) * g
def pluck(n, g=1.0):
    t = t_(1.2); f = N2F(n); return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) * np.exp(-t * 6)) * np.exp(-t * 4.5) * np.minimum(1, t / 0.003) * g
def pulse(g=1.0, f=N2F(38)):   # a soft felt "heartbeat" — sub thump with a little body
    t = t_(0.7); x = np.sin(2 * np.pi * np.cumsum(f * (1 + 1.2 * np.exp(-t * 30))) / SR) * np.exp(-t * 6) + filt(noise(0.7), 'lowpass', 300) * np.exp(-t * 40) * 0.3
    return x * np.minimum(1, t / 0.004) * g
def iris_whir(d, g=1.0):
    t = t_(d); u = t / d; clicks = (np.sin(2 * np.pi * (35 + 25 * u) * t) > 0.6).astype(float)
    x = filt(noise(d), 'bandpass', [1800, 7000]) * (0.4 + 0.6 * clicks) * np.sin(np.pi * u) ** 0.7
    x += 0.15 * np.sin(2 * np.pi * np.cumsum(900 + 500 * u) / SR) * np.sin(np.pi * u)
    return x * g
def riser(d, f0=200, f1=1600, g=1.0, inv=False):
    t = t_(d); u = t / d; u2 = 1 - u if inv else u
    x = np.sin(2 * np.pi * np.cumsum(f0 * (f1 / f0) ** u2) / SR) * 0.3 + filt(noise(d), 'bandpass', [1500, 8000]) * 0.25
    return x * (u2 ** 2 if not inv else (1 - u) ** 0.5 * u ** 2 * 3) * g

# ------------------------------------------------------------------ MUSIC
D = 50  # D3
# pads (chord, start, dur, attack, release, brightness, gain)
for ch, at, d, a, r, b, g in [
    ([38, 45, 52, 57, 64, 66], 0.3, 7.0, 3.5, 2.5, 0.8, 0.9),        # Dmaj9 — the field
    ([35, 47, 54, 57, 61, 66], 6.4, 5.0, 1.6, 2.2, 0.7, 0.75),       # Bm(add9) — macro
    ([31, 43, 50, 54, 59, 62], 10.6, 4.9, 1.8, 2.0, 0.75, 0.75),     # Gmaj7 — crown/ask
    ([33, 45, 52, 57, 59, 64], 14.6, 3.4, 1.4, 1.2, 0.8, 0.8),       # A sus2 — the turn
    ([38, 50, 54, 57, 62, 66, 69], 17.4, 5.6, 0.25, 2.2, 1.0, 0.95),   # D — wake
    ([35, 47, 54, 57, 62, 66], 22.2, 4.6, 1.2, 2.0, 0.9, 0.8),       # Bm7 — home
    ([31, 43, 50, 55, 59, 62, 66], 26.4, 3.4, 0.4, 1.2, 1.0, 0.85),  # G — press
    ([33, 45, 52, 57, 61, 64], 29.3, 3.0, 0.6, 1.2, 1.0, 0.8),       # A — listen
    ([35, 47, 54, 59, 62, 66], 31.9, 2.8, 0.4, 1.0, 1.1, 0.85),      # Bm — build
    ([30, 42, 49, 54, 57, 61], 34.2, 2.2, 0.4, 0.9, 1.1, 0.8),       # F#m
    ([31, 43, 50, 55, 59, 62, 69], 35.9, 2.0, 0.2, 1.2, 1.2, 0.9),   # G — confirm
    ([33, 45, 52, 57, 61, 64, 69], 36.4, 1.6, 0.05, 1.0, 1.2, 0.8),  # A — set
    ([28, 40, 47, 54, 55, 59, 62], 37.3, 4.4, 1.0, 1.6, 0.8, 0.7),   # Em9 — rain
    ([31, 43, 50, 54, 57, 62, 66], 39.9, 2.0, 0.08, 1.2, 1.0, 0.75), # Gmaj7 — summary
    ([31, 43, 50, 55, 59, 62, 66, 71], 41.3, 4.2, 0.3, 1.6, 1.1, 0.9),  # G — top-down opens
    ([33, 45, 52, 57, 61, 64, 69, 73], 45.1, 4.3, 0.6, 1.4, 1.15, 0.95),  # A — rise
    ([26, 38, 45, 52, 57, 62, 64, 66, 69], 49.2, 2.8, 0.06, 1.2, 1.2, 1.1),  # D add9 — title
    ([38, 45, 52, 57, 64, 66, 69, 74], 51.0, 1.0, 0.2, 0.9, 1.0, 0.7),
]:
    music.add(pad(ch, d, a, r, b, g), at, 0.5)

# felt piano: the motif (D major pentatonic), placed on picture beats
motif = [(3.6, 78), (4.15, 76), (4.7, 74), (5.6, 69), (6.15, 71), (8.0, 74), (9.1, 76), (11.0, 73), (12.0, 71), (14.2, 81), (15.4, 78), (16.3, 76)]
for at, n in motif: music.add(felt(n, 4, 0.32), at, pan=0.25 if n > 75 else -0.2)
# wake chord + home arpeggios
for i, n in enumerate([62, 66, 69, 74, 78]): music.add(felt(n, 4, 0.26), 17.55 + i * 0.07, pan=(i - 2) * 0.15)
for i, n in enumerate([74, 78, 81, 78, 76, 74, 71, 74]): music.add(felt(n, 3, 0.22), 19.3 + i * 0.42, pan=(i % 2 - 0.5) * 0.5)
for i, n in enumerate([71, 74, 78, 81, 79]): music.add(felt(n, 3, 0.22), 23.0 + i * 0.6, pan=(i % 2 - 0.5) * 0.5)
# from the Ask press: soft pulses on a 72 bpm grid, and 8th-note piano arpeggios that build
BEAT = 60 / 72; P0 = 26.95
prog = [(26.4, [55, 59, 62, 67]), (29.3, [57, 61, 64, 69]), (31.9, [59, 62, 66, 71]), (34.2, [54, 57, 61, 66]), (35.9, [55, 59, 62, 67]), (36.4, [57, 61, 64, 69]),
        (37.3, [52, 55, 59, 62]), (39.9, [55, 59, 62, 66]), (41.3, [55, 59, 62, 67]), (45.1, [57, 61, 64, 69])]
def chord_at(t): c = prog[0][1]; [c := ch for (a, ch) in prog if t >= a]; return c
k = 0; t = P0
while t < 49.0:
    lvl = np.interp(t, [26.95, 31.9, 35.9, 36.6, 37.3, 41.0, 41.4, 45.2, 48.6, 49.0], [0.55, 0.75, 1.0, 0.6, 0.45, 0.5, 0.6, 0.85, 1.0, 0.0])
    if k % 2 == 0: sfx.add(pulse(0.5 * lvl, N2F(38 if t < 37.3 or t > 41.3 else 40)), t)
    if t > 28.4:
        ch = chord_at(t); n = ch[(k * 3) % len(ch)] + (12 if (k // 4) % 2 and t > 31.9 else 0)
        music.add(felt(n + 12, 1.8, 0.13 * lvl, bright=1.2), t + 0.005, pan=((k % 4) - 1.5) * 0.3)
    k += 1; t += BEAT / 2
# title: the resolved chord on piano, then a final high D
for i, n in enumerate([38, 50, 57, 62, 66, 69, 76]): music.add(felt(n, 5.5, 0.32 if n > 45 else 0.4), 49.25 + i * 0.045, pan=(i - 3) * 0.12)
music.add(felt(86, 3, 0.18), 50.6, pan=0.3); music.add(felt(81, 3, 0.14), 51.1, pan=-0.3)

# ------------------------------------------------------------------ SOUND DESIGN
# air / room tone through the whole film, opening a little at the start
air = filt(noise(DUR), 'bandpass', [180, 5000]) * 0.022; air *= np.interp(np.arange(N) / SR, [0, 1.5, 3, 37, 41.4, 49, 52], [0.4, 1.0, 0.8, 0.6, 0.7, 0.9, 0.4])
amb.add(np.stack([air, np.roll(air, 3000)]), 0)
sub = np.sin(2 * np.pi * N2F(26) * t_(3.6)) * adsr(int(3.6 * SR), 2.4, 1.0) * 0.5; sfx.add(sub, 0.2)
# act I
sfx.add(swell(3.0, 0.5), 0.6, 0.0)
sfx.add(whoosh(2.4, 160, 1600, 0.35, 1.5), 3.0)             # rise
sfx.add(swell(2.0, 0.3, N2F(81)), 4.2, 0.2)                  # light across the glaze
sfx.add(bell(93, 3, 0.12), 6.62, pan=0.3)                     # glass ting on the cut
sfx.add(iris_whir(0.6, 0.3), 7.55, -0.1); sfx.add(iris_whir(0.65, 0.26), 8.6, 0.1)
sfx.add(tick(0.25, 6000, 0.05), 9.6)                          # flash cut
for d in [10.15, 10.55, 10.95, 11.35, 11.75]: sfx.add(detent(0.55), d, 0.35)
sfx.add(whoosh(0.85, 600, 7000, 0.4, 2.5), 12.0, 0.0)        # light-run wipe
sfx.add(ember_tone(3.4, 0.22), 13.0, -0.25)                   # the ember: first statement
sfx.add(riser(1.0, 300, 1200, 0.18), 13.05, -0.2)
sfx.add(whoosh(1.8, 200, 2500, 0.42, 1.8), 15.45)             # turn
for i, n in enumerate([86, 90, 93, 98]): sfx.add(bell(n, 4, 0.13 - i * 0.02), 17.55 + i * 0.06, pan=(i - 1.5) * 0.3)   # wake chime
sfx.add(swell(1.2, 0.35, N2F(86)), 17.0)
# act II — the OS
for i in range(6): sfx.add(pluck(86 + [0, 2, 4, 7, 9, 12][i], 0.06), 19.55 + i * 0.16, pan=(i - 2.5) * 0.15)
sfx.add(tick(0.12, 4200), 21.0, 0.2)                          # minute turns over
sfx.add(whoosh(0.7, 500, 6000, 0.3, 2), 22.25)                # swipe
for i in range(5): sfx.add(pluck(81 + [0, 2, 4, 7, 9][i], 0.07), 22.9 + i * 0.09, pan=(i - 2) * 0.2)
sfx.add(tap(0.5), 26.93, -0.4)                                # the press
sfx.add(ember_tone(4.0, 0.26), 26.97, -0.3)
sfx.add(whoosh(1.6, 200, 2200, 0.25, 2), 27.8)                # swing to front
# listening: voice-shaped shimmer + a buried formant hum
WT = [28.85, 29.08, 29.3, 29.82, 30.04, 30.25]
tt = np.arange(N) / SR; vamp = np.zeros(N)
for i, w in enumerate(WT):
    d = tt - w + 0.05; m = d > 0; vamp[m] += np.exp(-d[m] * 9) * (1.0 if i in (2, 5) else 0.75) * np.where(d[m] < 0.3, 1, 0.6)
vamp *= (tt > 28.75) & (tt < 30.9)
shim = filt(rng.standard_normal(N), 'bandpass', [1800, 6500]) * vamp * 0.12
glott = np.sign(np.sin(2 * np.pi * np.cumsum(185 + 25 * np.sin(2 * np.pi * 3 * tt)) / SR)) * vamp
form = (filt(glott, 'bandpass', [450, 900]) + 0.6 * filt(glott, 'bandpass', [1100, 1700]) + 0.3 * filt(glott, 'bandpass', [2300, 3000])) * 0.035
sfx.add(np.stack([shim + form, np.roll(shim, 400) + form]), 0)
for i, n in enumerate([81, 85, 88, 93, 97]): sfx.add(pluck(n, 0.05), 30.85 + i * 0.2, pan=(i - 2) * 0.3)   # thinking sparkle
for at, n in [(32.25, 86), (32.75, 90), (33.3, 93)]: sfx.add(bell(n, 2.5, 0.08), at); sfx.add(swell(0.6, 0.15, N2F(n)), at - 0.3)
sfx.add(whoosh(0.7, 800, 4000, 0.12), 33.05)                  # calendar slide
sfx.add(riser(1.3, 400, 900, 0.07), 33.3)                     # route draws
for i in range(22): sfx.add(tick(0.03 + 0.02 * rng.random(), 5000 + 1500 * rng.random(), 0.03), 33.9 + i * 0.052 + rng.random() * 0.01, pan=0.2)
sfx.add(pluck(86, 0.08), 34.95)
sfx.add(tap(0.55), 35.68); sfx.add(swell(0.9, 0.25, N2F(93)), 35.6)
sfx.add(whoosh(0.7, 2000, 300, 0.25, 2), 35.95)               # fold
for i, n in enumerate([74, 78, 81, 86]): sfx.add(bell(n, 3.5, 0.11), 36.35 + i * 0.05, pan=(i - 1.5) * 0.25)   # set
# rain (the afternoon)
rain = filt(rng.standard_normal(N), 'lowpass', 7000) * 0.05
drops = np.zeros(N); idx = rng.integers(0, N, 4000); drops[idx] = rng.random(4000) * 0.6; drops = filt(drops, 'bandpass', [1500, 6000])
renv = np.interp(tt, [36.7, 37.5, 41.0, 41.6, 42.5], [0, 1, 1, 0.3, 0]); rain = (rain + drops * 0.25) * renv
amb.add(np.stack([rain, np.roll(rain, 2000)]), 0)
for i in range(14): sfx.add(tick(0.07 * (1 - i * 0.04), 2500 + 2200 * rng.random(), 0.05), 37.45 + i * 0.115, pan=rng.uniform(-0.5, 0.5))
sfx.add(riser(0.75, 1800, 300, 0.3), 39.15)                    # the condense sweep
sfx.add(np.stack([filt(noise(0.7), 'bandpass', [300, 3000]) * np.linspace(0, 1, int(0.7 * SR)) ** 2 * 0.2] * 2), 39.2)
for i, n in enumerate([67, 71, 74, 78]): sfx.add(bell(n, 3.5, 0.09), 39.95 + i * 0.04)
# act III
sfx.add(swell(1.2, 0.5, N2F(86)), 40.4); sfx.add(whoosh(1.2, 300, 5000, 0.35), 40.9)   # wash
sfx.add(whoosh(2.4, 160, 2400, 0.45, 1.6), 45.2)               # rise & turn
sfx.add(swell(2.5, 0.3, N2F(81)), 46.5)
sfx.add(np.sin(2 * np.pi * N2F(26) * t_(3.0)) * adsr(int(3.0 * SR), 0.05, 2.6) * 0.45, 49.25)
sfx.add(swell(1.5, 0.35, N2F(93)), 48.0)

# ------------------------------------------------------------------ space + master
def ir(d=3.2, pre=0.02, damp=2400):
    n = int(d * SR); t = np.arange(n) / SR; e = np.exp(-t * 6.9 / d) * (1 - np.exp(-t * 80))
    L = filt(rng.standard_normal(n) * e, 'lowpass', damp); R = filt(rng.standard_normal(n) * e, 'lowpass', damp)
    p = int(pre * SR); return np.pad(L, (p, 0))[:n], np.pad(R, (p, 0))[:n]
def verb(x, d, mix, damp=2600):
    l, r = ir(d, damp=damp); y = np.stack([fftconvolve(x[0], l)[:N], fftconvolve(x[1], r)[:N]]); y /= np.abs(y).max() + 1e-9; y *= np.abs(x).max()
    return x * (1 - mix) + y * mix * 1.6
M = verb(music.x, 3.6, 0.42) + verb(sfx.x, 2.4, 0.3, 4000) + amb.x * 0.9
M = filt(M, 'highpass', 28)
# gentle glue compression (RMS, soft knee) then a peak ceiling
env = np.sqrt(filt(np.mean(M ** 2, 0), 'lowpass', 6)) + 1e-6; thr = np.percentile(env, 92)
gain = np.where(env > thr, (thr / env) ** 0.35, 1.0); M = M * gain
fade = np.ones(N); fi = int(1.0 * SR); fade[-fi:] = np.linspace(1, 0, fi) ** 2; fade[:int(0.05 * SR)] = np.linspace(0, 1, int(0.05 * SR))
M = M * fade; M = M / np.abs(M).max()
# lookahead peak limiter (5 ms): shave ~5 dB of transient peaks so loudness normalisation stays linear
from scipy.ndimage import minimum_filter1d, uniform_filter1d
thr = 10 ** (-5 / 20); pk = np.abs(M).max(0); g = np.minimum(1.0, thr / np.maximum(pk, 1e-9))
g = uniform_filter1d(minimum_filter1d(g, 480), 240); M = M * g
M = M / np.abs(M).max() * 0.89
wavfile.write(sys.argv[1], SR, (M.T * 32767).astype(np.int16))
print('ok', M.shape)
