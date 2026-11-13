# KILN — PULSE · full track + sound design, locked to the picture's beat grid (120 BPM, 1 beat = 0.5 s, 1 bar = 2 s).
#   python3 pulse_score.py out.wav            → mastered to about -14 LUFS (measured with ffmpeg ebur128), -1 dBTP ceiling
import sys, subprocess, re, numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000; DUR = 51.5; BEAT = 0.5; BAR = 2.0
rng = np.random.default_rng(7)
def t_(d): return np.arange(int(SR * d)) / SR
def filt(x, k, f, o=2): return sosfilt(butter(o, f, k, fs=SR, output='sos'), x)
def ex(n, d): return np.exp(-np.arange(n) / SR / d)
def lin_env(n, a, r): e = np.ones(n); ai, ri = max(1, int(a * SR)), max(1, int(r * SR)); e[:ai] = np.linspace(0, 1, ai); e[-ri:] *= np.linspace(1, 0, ri); return e
N2F = lambda n: 440 * 2 ** ((n - 69) / 12)
def noise(d): return rng.standard_normal(int(SR * d))
def saw(f, d, ph=0.0):
    t = t_(d); f = np.broadcast_to(f, t.shape); p = (np.cumsum(f) / SR + ph) % 1.0
    # polyBLEP-ish soft saw: band-limit by smoothing the discontinuity
    return filt(2 * p - 1, 'lowpass', min(16000, SR * 0.45))

class Bus:
    def __init__(s, dur=DUR): s.N = int(SR * dur); s.L = np.zeros(s.N); s.R = np.zeros(s.N)
    def add(s, x, at, g=1.0, pan=0.0):
        if x.ndim == 2: xl, xr = x[0], x[1]
        else: xl = xr = x
        i = int(round(at * SR));
        if i < 0: xl, xr, i = xl[-i:], xr[-i:], 0
        n = min(len(xl), s.N - i)
        if n <= 0: return
        gl, gr = g * np.sqrt(0.5 * (1 - pan)) * 1.414, g * np.sqrt(0.5 * (1 + pan)) * 1.414
        s.L[i:i + n] += xl[:n] * gl; s.R[i:i + n] += xr[:n] * gr
    def st(s): return np.stack([s.L, s.R])

# ---------------------------------------------------------------- instruments
def kick(g=1.0, d=0.42):
    t = t_(d); f = 44 + 120 * np.exp(-t * 32) + 300 * np.exp(-t * 250)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6.0)
    x = np.tanh(1.8 * x) / np.tanh(1.8); x += filt(noise(d), 'highpass', 3000) * np.exp(-t * 500) * 0.35
    return x * g
def clap(g=1.0):
    d = 0.5; n = int(SR * d); x = np.zeros(n); src = filt(noise(d), 'bandpass', [900, 6000])
    for k, o in enumerate([0, 0.011, 0.022, 0.031]):
        i = int(o * SR); e = ex(n - i, 0.007 if k < 3 else 0.13); x[i:] += src[:n - i] * e * (0.8 if k < 3 else 1.0)
    return x * g
def snare(g=1.0, d=0.3):
    t = t_(d); return (filt(noise(d), 'bandpass', [1500, 8000]) * np.exp(-t * 18) + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.6) * g
def hat(g=1.0, open_=False):
    d = 0.32 if open_ else 0.06; t = t_(d); m = sum(np.sign(np.sin(2 * np.pi * f * t)) for f in (3135, 4519, 5827, 7411, 8963))
    x = filt(noise(d) * 0.7 + m * 0.18, 'highpass', 7000) * np.exp(-t * (9 if open_ else 70)); return x * g
def bass(n, d, g=1.0, cut=520):
    f = N2F(n); t = t_(d); x = 0.6 * saw(f, d) + 0.25 * saw(f * 1.004, d) + 0.9 * np.sin(2 * np.pi * f * t)
    x = filt(x, 'lowpass', cut, 3); x = np.tanh(1.4 * x); return x * lin_env(len(t), 0.004, min(0.05, d * 0.3)) * g
def supersaw(notes, d, cut=3000, g=1.0, a=0.003, r=0.2, dec=None):
    t = t_(d); L = np.zeros(len(t)); R = np.zeros(len(t))
    for n in notes:
        for k, dt in enumerate((-0.011, -0.006, -0.002, 0.0, 0.003, 0.007, 0.012)):
            v = saw(N2F(n) * (1 + dt), d, ph=rng.random()); p = (k / 6) * 2 - 1; L += v * (1 - p) * 0.5; R += v * (1 + p) * 0.5
    e = lin_env(len(t), a, r) * (np.exp(-t / dec) if dec else 1); s = len(notes) * 4.0
    return np.stack([filt(L, 'lowpass', cut, 2) * e / s, filt(R, 'lowpass', cut, 2) * e / s]) * g
def pad(notes, d, cut=1400, g=1.0, a=0.8, r=1.0): return supersaw(notes, d, cut, g, a, r)
def pluck(n, d=0.3, g=1.0, bright=1.0):
    f = N2F(n); t = t_(d); x = sum((1 / k) * np.sin(2 * np.pi * f * k * t + k) * np.exp(-t * (6 + k * 9 / bright)) for k in range(1, 9))
    return x * np.minimum(1, t / 0.002) * g * 0.6
def bell(n, d=1.5, g=1.0):
    f = N2F(n); t = t_(d); return sum(a * np.sin(2 * np.pi * f * k * t) * np.exp(-t * dk) for k, a, dk in [(1, 1, 1.5), (2.76, 0.45, 3), (5.4, 0.22, 5), (8.93, 0.1, 8)]) * g
def glass(g=1.0, d=1.6):
    t = t_(d); x = sum(a * np.sin(2 * np.pi * f * t + rng.random() * 6) * np.exp(-t * dk) for f, a, dk in [(2093, 1, 2.2), (3170, 0.7, 3.1), (4889, 0.5, 4.5), (6620, 0.35, 6), (8203, 0.2, 9)])
    x += filt(noise(d), 'highpass', 4000) * np.exp(-t * 80) * 1.2; return x * g * 0.5
def click(g=1.0, f=3400):
    d = 0.06; t = t_(d); x = np.sin(2 * np.pi * f * t) * np.exp(-t * 260) + filt(noise(d), 'highpass', 2000) * np.exp(-t * 900) * 0.6 + np.sin(2 * np.pi * 180 * t) * np.exp(-t * 90) * 0.5
    return x * g
def tick(g=1.0, f=2600): d = 0.03; t = t_(d); return np.sin(2 * np.pi * f * t) * np.exp(-t * 220) * g
def bleep(f, d=0.08, g=1.0): t = t_(d); return np.sin(2 * np.pi * f * t + 0.6 * np.sin(2 * np.pi * f * 2 * t)) * lin_env(len(t), 0.002, d * 0.6) * g
def sweep_noise(d, f0, f1, g=1.0, q=0.6, shape=None):
    n = int(SR * d); src = noise(d); out = np.zeros(n); seg = 24; L = n // seg
    for k in range(seg):
        u = (k + 0.5) / seg; fc = f0 * (f1 / f0) ** u; lo, hi = max(40, fc * (1 - q / 2)), min(SR * 0.45, fc * (1 + q / 2))
        y = filt(src, 'bandpass', [lo, hi]); w = np.zeros(n); a, b = max(0, k * L - L // 2), min(n, (k + 1) * L + L // 2); w[a:b] = np.hanning(b - a); out += y * w
    env = np.sin(np.linspace(0, np.pi, n)) ** 2 if shape is None else shape(np.linspace(0, 1, n)); return out * env * g
def whoosh(d=0.5, f0=400, f1=4000, g=1.0): return sweep_noise(d, f0, f1, g, 1.0)
def riser(d, g=1.0):
    t = t_(d); u = t / d; x = sweep_noise(d, 300, 9000, 1.0, 0.8, shape=lambda v: v ** 2.2)
    x += saw(220 * 2 ** (2.2 * u), d) * 0.15 * u ** 2; return x * g
def impact(g=1.0, d=2.5):
    t = t_(d); boom = np.sin(2 * np.pi * np.cumsum(30 + 60 * np.exp(-t * 7)) / SR) * np.exp(-t * 1.6)
    crack = filt(noise(d), 'lowpass', 5000) * np.exp(-t * 14) * 0.8; return (np.tanh(1.5 * boom) + crack) * g
def revcym(d=1.5, g=1.0): t = t_(d); x = filt(noise(d), 'highpass', 5000) * (t / d) ** 3; return x * g
def ask_tone(g=1.0, d=2.6):
    # the signature: a warm two-note FM chime rising a fifth (E5 → B5), over a soft sub swell
    t = t_(d); out = np.zeros(len(t))
    for i, (n, o) in enumerate([(76, 0.0), (83, 0.11)]):
        k = int(o * SR); tt = t[:len(t) - k]; f = N2F(n); idx = 2.2 * np.exp(-tt * 5)
        out[k:] += np.sin(2 * np.pi * f * tt + idx * np.sin(2 * np.pi * f * 2.0 * tt)) * np.exp(-tt * (1.4 + i * 0.4)) * (0.8 if i == 0 else 1.0)
    out += np.sin(2 * np.pi * N2F(40) * t) * np.sin(np.pi * np.minimum(1, t / 1.2)) ** 2 * np.exp(-t * 0.8) * 0.5
    return out * g
def shutter(g=1.0):
    d = 0.25; t = t_(d); x = np.zeros(len(t))
    for o in (0.0, 0.07): k = int(o * SR); c = click(1, 2400); x[k:k + len(c)] += c[:len(t) - k]
    x += sweep_noise(d, 1500, 6000, 0.5, 0.8); return x * g
def voice(d, g=1.0, f0=170, seed=0):
    # a breathy vocal-like synth that follows the same syllable envelope as the on-screen wave (no words)
    t = t_(d); a = np.abs(np.sin(t * 11.3 + seed)) * (0.55 + 0.45 * np.sin(t * 3.7 + seed * 2)); b = np.abs(np.sin(t * 17.1 + 1.3 + seed))
    e = np.clip(0.25 + 0.75 * a * (0.6 + 0.4 * b), 0, 1) - 0.25; e = np.clip(e, 0, 1) ** 1.5
    f = f0 * (1 + 0.06 * np.sin(t * 2.3 + seed) + 0.03 * np.sin(t * 7.1)); src = saw(f, d) * 0.7 + noise(d) * 0.12
    form = [(700, 1200, 2600), (500, 1700, 2500), (400, 900, 2400)]; out = np.zeros(len(t)); seg = int(SR * 0.14)
    for k in range(0, len(t), seg):
        F = form[(k // seg + seed) % 3]; y = sum(filt(src, 'bandpass', [fc * 0.85, fc * 1.15]) * w for fc, w in zip(F, (1, 0.6, 0.25)))
        w = np.zeros(len(t)); a0, b0 = max(0, k - seg // 2), min(len(t), k + seg + seg // 2); w[a0:b0] = np.hanning(b0 - a0); out += y * w
    return filt(out * e, 'highpass', 150) * g

def reverb_ir(d=2.2, lp=6000, seed=3):
    r = np.random.default_rng(seed); n = int(SR * d); t = np.arange(n) / SR; e = np.exp(-t * 3.2) * np.minimum(1, t / 0.01)
    L = filt(r.standard_normal(n), 'lowpass', lp) * e; R = filt(r.standard_normal(n), 'lowpass', lp) * e; s = np.sqrt(np.sum(L ** 2)); return L / s, R / s

# ---------------------------------------------------------------- arrangement
CH = {'Am': (33, [57, 60, 64, 69]), 'F': (29, [53, 57, 60, 65]), 'C': (36, [55, 60, 64, 67]), 'G': (31, [55, 59, 62, 67]), 'E': (28, [52, 56, 59, 64])}
BARS = ['Am', 'Am', 'F', 'F',  'Am', 'F', 'C', 'G',  'Am', 'F',  'Am', 'F', 'C', 'G',  'Am', 'F', 'C', 'G', 'Am', 'E',  'Am', 'F',  'F', 'C', 'Am', 'Am', 'Am']
def chord_at(t): return BARS[min(len(BARS) - 1, int(t // BAR))]
# energy sections: (from, to, kind)
SEC = [(0, 4, 'intro1'), (4, 6, 'intro2'), (6, 7.875, 'build1'), (8, 16, 'dropA'), (16, 18, 'wake'), (18, 20, 'askbreak'), (20, 21, 'justask'),
       (21, 28, 'askgroove'), (28, 38, 'groove'), (38, 39.75, 'build2'), (40, 44, 'dropB'), (44, 48, 'title'), (48, 51.5, 'tail')]
def sec_at(t):
    for a, b, k in SEC:
        if a <= t < b: return k
    return None

def build():
    D = Bus(); B = Bus(); M = Bus(); FX = Bus(); UI = Bus(); REV = Bus()   # drums, bass, music, fx, ui, reverb send
    kick_times = []
    # ---- drums + bass on the grid (16ths)
    for s16 in range(int(DUR / 0.125)):
        t = s16 * 0.125; k = sec_at(t); b16 = s16 % 4; beat = (s16 // 4) % 4; bar_ch = CH[chord_at(t)]
        if k is None: continue
        if k == 'intro1' and b16 == 0: D.add(filt(kick(0.55), 'lowpass', 300), t); kick_times.append(t)
        if k in ('intro2', 'build1') and b16 == 0: D.add(kick(0.75), t); kick_times.append(t)
        if k in ('intro2',) and b16 in (1, 3): D.add(hat(0.25), t, pan=0.2)
        if k == 'build1':
            if b16 == 2: D.add(hat(0.3, True), t, pan=-0.2)
            # snare roll: 8ths then 16ths then 32nds
            if t < 7.0 and b16 % 2 == 0: D.add(snare(0.25 + 0.25 * (t - 6)), t, pan=0.1)
            if 7.0 <= t < 7.75: D.add(snare(0.45 + 0.3 * (t - 7)), t, pan=0.1); D.add(snare(0.4 + 0.3 * (t - 7)), t + 0.0625, pan=-0.1)
        if k in ('dropA', 'groove', 'dropB', 'title'):
            if b16 == 0: D.add(kick(1.0), t); kick_times.append(t)
            if b16 == 0 and beat in (1, 3): D.add(clap(0.55), t, pan=0.05); REV.add(clap(0.25), t)
            if b16 == 2: D.add(hat(0.42, True), t, pan=-0.15)
            if b16 in (1, 3): D.add(hat(0.22), t, pan=0.25)
            # bass: offbeat-driven 16th pattern, octave pops
            pat = [0, 1, 1, 0] if k != 'groove' else [1, 1, 0, 1]
            if pat[b16] or (k == 'dropB' and b16 == 3):
                n = bar_ch[0] + (12 if (b16 == 3 and beat % 2 == 1) else 0); B.add(bass(n, 0.12, 0.85, 600 if k == 'dropB' else 480), t)
        if k in ('wake',):
            if b16 == 0: D.add(kick(0.85), t); kick_times.append(t)
            if b16 == 2: D.add(hat(0.25, True), t)
        if k in ('askgroove',):
            if b16 == 0: D.add(kick(0.8), t); kick_times.append(t)
            if b16 in (1, 3): D.add(hat(0.16), t, pan=0.3)
            if b16 == 2: D.add(hat(0.22, True), t, pan=-0.2)
            if b16 == 0 and beat in (1, 3) and t >= 24: D.add(clap(0.35), t); REV.add(clap(0.2), t)
            if b16 == 2: B.add(bass(bar_ch[0], 0.2, 0.7, 380), t)
        if k == 'justask' and b16 == 0: D.add(kick(1.0), t); kick_times.append(t)
        if k == 'build2':
            if b16 == 0: D.add(kick(0.95), t); kick_times.append(t)
            u = (t - 38) / 1.75; D.add(snare(0.3 + 0.4 * u), t, pan=0.1)
            if t >= 39.0: D.add(snare(0.35 + 0.4 * u), t + 0.0625, pan=-0.1)
            B.add(bass(CH['E'][0] + (12 if b16 % 2 else 0), 0.11, 0.6 + 0.3 * u, 500 + 1500 * u), t)
        if k == 'tail' and t < 48.01 and b16 == 0 and t == 48.0: D.add(kick(1.0), t); kick_times.append(t)
    # ---- music: pads, stabs, arps
    for bi, nm in enumerate(BARS):
        t = bi * BAR; k = sec_at(t + 0.01); root, ch = CH[nm]
        if k in ('intro1', 'intro2', 'build1'): M.add(pad(ch, 2.05, 700 + 300 * bi, 0.55, 0.6, 0.6), t);
        if k in ('wake', 'askbreak'): M.add(pad(ch, 2.05, 1200, 0.6, 0.3, 0.5), t)
        if k in ('askgroove', 'justask'): M.add(pad([n - 12 for n in ch[:3]] + [ch[3]], 2.05, 1500, 0.4, 0.2, 0.4), t)
        if k in ('dropA', 'groove'): M.add(pad(ch, 2.05, 2200, 0.35, 0.05, 0.3), t)
        if k in ('dropB', 'title'): M.add(pad(ch + [ch[0] + 12], 2.05, 3500, 0.5, 0.02, 0.3), t); M.add(pad([n + 12 for n in ch], 2.05, 5000, 0.18, 0.4, 0.4), t)
    # intro drone + stutter stabs
    M.add(filt(np.sin(2 * np.pi * N2F(33) * t_(8)) * 0.4 + saw(N2F(45), 8) * 0.12, 'lowpass', 220) * lin_env(int(8 * SR), 1.0, 0.3), 0, 0.3)
    for i, tt in enumerate([5.0, 5.25, 5.5, 5.75]): M.add(supersaw(CH['F'][1], 0.22, 4000, 1.2, dec=0.09), tt); REV.add(supersaw(CH['F'][1], 0.22, 4000, 0.5, dec=0.09), tt)
    # stabs on statement cuts
    for tt, nm in [(8.0, 'Am'), (10.0, 'F'), (12.0, 'C'), (14.0, 'G'), (20.0, 'Am'), (20.5, 'Am'), (26.0, 'G'), (38.0, 'E'), (38.5, 'E'), (39.0, 'E'), (40.0, 'Am'), (44.0, 'F')]:
        M.add(supersaw(CH[nm][1] + [CH[nm][1][0] + 12], 0.4, 5000, 1.4, dec=0.14), tt); REV.add(supersaw(CH[nm][1], 0.4, 5000, 0.6, dec=0.14), tt)
    # arps (16ths) under the Ask and montage
    for s16 in range(int(21 / 0.125), int(38 / 0.125)):
        t = s16 * 0.125; nm = chord_at(t); ch = CH[nm][1]; seq = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 12, ch[1] + 12, ch[3] + 12, ch[0] + 24]
        g = 0.22 if t < 28 else 0.28; M.add(pluck(seq[s16 % 8], 0.25, g, 1.2 if t >= 28 else 0.8), t, pan=0.35 * np.sin(s16 * 0.7));
        if s16 % 2 == 0: REV.add(pluck(seq[s16 % 8], 0.25, g * 0.4), t)
    # drop B: lead hook on 8ths
    hook = [81, 79, 76, 79, 81, 84, 83, 79]
    for i in range(16): t = 40 + i * 0.25; M.add(pluck(hook[i % 8], 0.3, 0.35, 2.0), t, pan=0.15); REV.add(pluck(hook[i % 8], 0.3, 0.2, 2.0), t)
    # title: final chord + bells
    M.add(pad(CH['Am'][1] + [76, 81], 3.5, 2600, 0.6, 0.05, 2.8), 48.0); REV.add(pad(CH['Am'][1], 3.0, 2000, 0.5, 0.05, 2.5), 48.0)
    for i, n in enumerate([69, 76, 81, 88]): M.add(bell(n, 2.5, 0.25), 46.0 + i * 0.125, pan=(i - 1.5) * 0.3); REV.add(bell(n, 2.5, 0.2), 46.0 + i * 0.125)

    # ---- sound design locked to picture
    for i in range(8): FX.add(click(0.5, 3600 + (i % 2) * 400), i * 0.25, pan=0.4)                    # crown detents
    FX.add(glass(0.35), 2.0, pan=-0.2); FX.add(bell(93, 1.2, 0.12), 2.5, pan=0.3); REV.add(bell(93, 1.2, 0.1), 2.5)
    FX.add(whoosh(1.0, 300, 2500, 0.35), 3.0, pan=-0.3)
    FX.add(filt(ask_tone(0.35), 'lowpass', 2500), 4.0); REV.add(ask_tone(0.2), 4.0)
    for i, tt in enumerate([5.0, 5.25, 5.5, 5.75]): FX.add(glass(0.25), tt, pan=(i - 1.5) * 0.4)
    FX.add(riser(1.75, 0.55), 6.0); FX.add(revcym(1.0, 0.5), 6.75); FX.add(whoosh(0.5, 600, 6000, 0.35), 7.25)
    FX.add(glass(0.5), 7.75); FX.add(impact(0.9), 8.0); REV.add(impact(0.3), 8.0)
    # drop A whips
    FX.add(whoosh(0.6, 200, 3500, 0.55), 7.95, pan=0.5); FX.add(whoosh(0.3, 500, 5000, 0.45), 9.72, pan=-0.6)
    FX.add(whoosh(0.55, 300, 4000, 0.5), 10.0); FX.add(click(0.6, 1800), 10.2); FX.add(whoosh(0.3, 600, 6000, 0.4), 11.75)
    for i in range(4): FX.add(glass(0.28), 12.0 + i * 0.5, pan=(i % 2 - 0.5) * 0.6); FX.add(whoosh(0.2, 800, 5000, 0.25), 12.0 + i * 0.5)
    FX.add(impact(0.8, 2.0), 14.0); REV.add(impact(0.25), 14.0)
    for i in range(10): FX.add(click(0.25, 2000 + 400 * i), 14.02 + i * 0.012 + rng.random() * 0.01, pan=rng.uniform(-0.8, 0.8))   # metallic scatter
    FX.add(whoosh(0.45, 4000, 400, 0.4), 15.1); FX.add(click(1.0, 1500), 15.5); FX.add(impact(0.35, 0.8), 15.5); FX.add(whoosh(0.3, 500, 6000, 0.45), 15.72)
    # wake
    FX.add(glass(0.6), 16.0); FX.add(impact(0.35, 1.0), 16.0)
    for i in range(6): UI.add(tick(0.35, 2400 + 200 * i), 16.08 + i * 0.06)
    for i in range(4): UI.add(tick(0.2, 3000), 17.0 + i * 0.25, pan=-0.4)
    # ask
    FX.add(click(0.9, 2200), 18.0); FX.add(ask_tone(0.75), 18.03); REV.add(ask_tone(0.4), 18.03)
    FX.add(shutter(0.4), 18.5); FX.add(sweep_noise(1.0, 300, 3000, 0.25, 0.5), 19.0); FX.add(bell(88, 1.5, 0.15), 19.0)
    FX.add(whoosh(0.25, 800, 5000, 0.3), 19.95); FX.add(whoosh(0.25, 800, 5000, 0.3), 20.45)
    FX.add(voice(2.3, 0.45, 175, 0), 21.0)
    for tt in [0.0, 0.25, 0.5, 0.625, 1.0, 1.5, 2.0]: UI.add(bleep(N2F(88 if tt in (0.625, 1.5, 2.0) else 84), 0.06, 0.18), 21.0 + tt, pan=0.2)
    for i in range(5): UI.add(tick(0.18, 3200), 23.3 + i * 0.125)
    for i, tt in enumerate([24.0, 24.25, 24.5, 24.75, 25.0, 25.25]): UI.add(click(0.35, 2600 + i * 150), tt, pan=(i % 2 - 0.5) * 0.5)
    FX.add(click(0.7, 1200), 25.75); UI.add(bleep(N2F(91), 0.1, 0.25), 25.75)
    FX.add(whoosh(0.3, 2000, 300, 0.35), 25.9)
    for i in range(7): UI.add(tick(0.2, 2200 + 120 * i), 26.05 + i * 0.0625)
    for i in range(3): UI.add(bleep(N2F(84 + i * 3), 0.07, 0.25), 27.1 + i * 0.125, pan=(i - 1) * 0.5)
    FX.add(riser(0.5, 0.25), 27.5)
    # montage
    for i in range(4): FX.add(click(0.75, 3000), 28.0 + i * 0.25, pan=0.3)
    FX.add(whoosh(0.4, 3000, 400, 0.4), 29.0)
    tt = 29.25
    while tt < 30.5: UI.add(tick(0.16, 2800), tt); tt += 0.02 + 0.08 * ((tt - 29.25) / 1.25) ** 2
    FX.add(impact(0.4, 0.8), 30.5); UI.add(bleep(N2F(81), 0.12, 0.25), 30.5)
    for i in range(3): UI.add(click(0.3, 2400), 30.5 + i * 0.1)
    FX.add(whoosh(0.35, 300, 4000, 0.35), 31.95)
    FX.add(voice(1.4, 0.3, 175, 1), 32.0, pan=-0.35); FX.add(voice(1.4, 0.3, 140, 2), 33.5, pan=0.35)
    for i in range(6): UI.add(bleep(N2F(83 + (i % 3) * 2), 0.05, 0.12), 32.1 + i * 0.22, pan=-0.4); UI.add(bleep(N2F(76 + (i % 3) * 2), 0.05, 0.12), 33.6 + i * 0.22, pan=0.4)
    FX.add(shutter(0.7), 35.0); FX.add(glass(0.25), 35.15)
    FX.add(sweep_noise(0.9, 800, 5000, 0.18, 0.5), 35.85)
    for i in range(6): UI.add(click(0.22, 3000 + i * 100), 35.95 + i * 0.125, pan=0.3)
    FX.add(whoosh(0.35, 300, 3000, 0.35), 37.0); UI.add(bleep(N2F(88), 0.1, 0.2), 37.05)
    # build 2 + drop B
    FX.add(riser(1.75, 0.65), 38.0); FX.add(revcym(1.2, 0.5), 38.55)
    FX.add(whoosh(0.3, 400, 7000, 0.6), 39.48); FX.add(glass(0.6), 39.75)
    FX.add(impact(1.1), 40.0); REV.add(impact(0.35), 40.0); FX.add(whoosh(0.8, 300, 5000, 0.4), 40.0, pan=-0.3)
    FX.add(whoosh(0.7, 200, 3000, 0.5), 41.95, pan=0.4)
    # title
    for i in range(4): FX.add(impact(0.55 if i else 1.1, 1.5 if i else 3.0), 44.0 + i * 0.25); FX.add(glass(0.3), 44.0 + i * 0.25, pan=(i - 1.5) * 0.5)
    REV.add(impact(0.4), 44.0); FX.add(whoosh(0.8, 200, 2500, 0.4), 45.5)
    for i in range(7): UI.add(tick(0.15, 2600), 46.0 + i * 0.03)
    FX.add(ask_tone(0.8), 48.0); REV.add(ask_tone(0.5), 48.0)
    return D, B, M, FX, UI, REV, kick_times

def master(path):
    D, B, M, FX, UI, REV, kt = build(); N = D.N
    # sidechain: duck bass + music under each kick
    sc = np.ones(N)
    for t in kt:
        i = int(t * SR); n = min(int(0.32 * SR), N - i)
        if n > 0: sc[i:i + n] = np.minimum(sc[i:i + n], 1 - 0.65 * np.exp(-np.arange(n) / SR / 0.09))
    Bs, Ms = B.st() * sc, M.st() * (0.55 + 0.45 * sc)
    irL, irR = reverb_ir(2.4); R = REV.st() + 0.25 * M.st() + 0.15 * FX.st()
    wet = np.stack([fftconvolve(R[0], irL)[:N], fftconvolve(R[1], irR)[:N]]) * 0.35
    mix = D.st() * 0.9 + Bs * 0.8 + Ms * 2.2 + FX.st() * 0.85 + UI.st() * 0.7 + wet
    mix[0] = filt(mix[0], 'highpass', 28); mix[1] = filt(mix[1], 'highpass', 28)
    # gentle glue compression (RMS, slow) then a peak limiter
    def limiter(x, ceil):
        from scipy.ndimage import minimum_filter1d, uniform_filter1d
        pk = np.max(np.abs(x), axis=0); la = int(0.003 * SR); g = np.minimum(1, ceil / np.maximum(pk, 1e-9))
        gm = minimum_filter1d(g, la * 2 + 1); out = np.empty(N); r = np.exp(-32 / (0.12 * SR)); y = 1.0
        for i in range(0, N, 32):
            m = gm[i:i + 32].min(); y = m if m < y else 1 - (1 - y) * r; out[i:i + 32] = y
        out = np.minimum(uniform_filter1d(out, la), gm * 1.02); return x * out
    rms = np.sqrt(filt(np.mean(mix ** 2, axis=0), 'lowpass', 3)); rms = np.maximum(rms, 1e-6)
    th = np.percentile(rms, 90) * 0.8; comp = np.where(rms > th, (th / rms) ** (1 - 1 / 2.0), 1.0); mix = mix * comp
    mix /= np.max(np.abs(mix)) + 1e-9
    fade = np.ones(N); fi = int(1.2 * SR); fade[-fi:] = np.linspace(1, 0, fi) ** 2; mix *= fade
    gain = 1.0
    for it in range(4):
        y = limiter(mix * gain, 10 ** (-1.9 / 20)); tmp = path + '.tmp.wav'; write(tmp, y)
        o = subprocess.run(['ffmpeg', '-nostats', '-i', tmp, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
        I = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', o)[-1]); TP = float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', o)[-1]); print(f'pass {it}: I={I} LUFS, TP={TP} dBFS, gain={gain:.3f}')
        if abs(I + 14) < 0.3: break
        gain *= 10 ** ((-14 - I) / 20)
    write(path, y); import os; os.remove(tmp)
def write(path, y):
    from scipy.io import wavfile; wavfile.write(path, SR, (np.clip(y.T, -1, 1) * 32767).astype(np.int16))

if __name__ == '__main__': master(sys.argv[1])
