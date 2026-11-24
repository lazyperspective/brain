# v3: extended and re-cut for the v3 edit (11 shots), new SFX for the new gags (log thud, camera shutter + flash, zap,
# sparks crackle, wire twang, flag plant, snow), a soft "magic shimmer" under each hand-drawn pattern landing on the beat.
# Original score + sound design for "Everywhere I look, I see Claude". 120 BPM "tiny spy caper" in A minor:
# plucked (Karplus-Strong) bass, brushed funk kit, marimba hook, chiptune accents. Every cut is on a beat; the music stops
# dead at the summit; one stinger after the cut to black. Writes music.wav, sfx.wav, mix_raw.wav (48 kHz stereo).
import numpy as np, scipy.io.wavfile as wavf, scipy.signal as sg, sys
sys.path.insert(0, '/home/user/brain/everywhere-claude/v3')
import edit
SR = 48000; BPM = 120; BEAT = 60 / BPM
ST, NFR = edit.starts(); DUR = (NFR + edit.BLACK_TAIL) / 30.0
N = int(DUR * SR)
rng = np.random.default_rng(7)
MUSIC_END = ST['summit']                     # music stops dead here
T_STING = NFR / 30.0                          # cut to black

def buf(): return np.zeros((N, 2), np.float32)
def place(dst, x, t, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= N or i + len(x) <= 0: return
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l, x * r], 1) * 1.414
    a, b = max(0, i), min(N, i + len(x))
    dst[a:b] += x[a - i:b - i] * gain
def env(n, a=0.002, d=0.2, s=0.0, curve=4.0):
    t = np.arange(n) / SR; e = np.minimum(1, t / max(a, 1e-4)) * (s + (1 - s) * np.exp(-np.maximum(0, t - a) / d * curve / 4))
    return e.astype(np.float32)
def hz(note):   # 'A4' etc
    names = {'C': -9, 'C#': -8, 'Db': -8, 'D': -7, 'D#': -6, 'Eb': -6, 'E': -5, 'F': -4, 'F#': -3, 'Gb': -3, 'G': -2, 'G#': -1, 'Ab': -1, 'A': 0, 'A#': 1, 'Bb': 1, 'B': 2}
    n, o = note[:-1], int(note[-1]); return 440.0 * 2 ** ((names[n] + 12 * (o - 4)) / 12)
def lp(x, f, o=2): b, a = sg.butter(o, f / (SR / 2)); return sg.lfilter(b, a, x).astype(np.float32)
def hp(x, f, o=2): b, a = sg.butter(o, f / (SR / 2), 'high'); return sg.lfilter(b, a, x).astype(np.float32)
def bp(x, f1, f2, o=2): b, a = sg.butter(o, [f1 / (SR / 2), f2 / (SR / 2)], 'band'); return sg.lfilter(b, a, x).astype(np.float32)

# ---------------- instruments ----------------
def pluck_bass(f, dur=0.45, bright=0.55):
    n = int(dur * SR); p = max(2, int(SR / f)); x = np.zeros(n, np.float32)
    x[:p] = (rng.random(p) * 2 - 1) * np.hanning(p) ; y = np.zeros(n, np.float32)
    for i in range(n):
        y[i] = x[i] + (0.5 * (y[i - p] + y[i - p - 1]) * (0.996 if bright > 0.5 else 0.993) if i > p else 0)
    y = lp(y, 900 + 1800 * bright)
    sub = np.sin(2 * np.pi * f * np.arange(n) / SR) * env(n, 0.004, dur * 0.6) * 0.5
    return (y / (np.abs(y).max() + 1e-6) * 0.7 + sub) * env(n, 0.001, dur * 0.9, curve=3)
def marimba(f, dur=0.35):
    n = int(dur * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 9) + 0.35 * np.sin(2 * np.pi * f * 4.0 * t) * np.exp(-t * 30) + 0.12 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t * 60)
    x[:int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    return x.astype(np.float32) * 0.6
def square(f, dur, duty=0.25, vib=0.0):
    t = np.arange(int(dur * SR)) / SR; ph = (f * t + vib * np.sin(2 * np.pi * 6 * t) * 0.02) % 1
    return ((ph < duty) * 2 - 1).astype(np.float32) * 0.18
def saw_chord(fs, dur):
    t = np.arange(int(dur * SR)) / SR; x = sum(2 * ((f * t * (1 + d)) % 1) - 1 for f in fs for d in (-0.004, 0.004))
    return lp(x.astype(np.float32), 2400) * env(len(t), 0.005, dur * 0.5, curve=3) * 0.08
def kick(g=1.0):
    n = int(0.32 * SR); t = np.arange(n) / SR; f = 48 + 110 * np.exp(-t * 32)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) + 0.25 * (rng.random(n) * 2 - 1) * np.exp(-t * 300)
    return x.astype(np.float32) * 0.9 * g
def snare(g=1.0, brush=True):
    n = int(0.25 * SR); t = np.arange(n) / SR; nz = rng.random(n) * 2 - 1
    x = bp(nz.astype(np.float32), 1500, 7500) * np.exp(-t * (14 if brush else 24)) * 0.7 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.35
    return x.astype(np.float32) * g
def hat(g=1.0, open_=False):
    n = int((0.25 if open_ else 0.06) * SR); t = np.arange(n) / SR
    x = hp((rng.random(n) * 2 - 1).astype(np.float32), 7000) * np.exp(-t * (12 if open_ else 70))
    return x * 0.35 * g
def tom(f, g=1.0):
    n = int(0.3 * SR); t = np.arange(n) / SR; ff = f * (1 + 0.6 * np.exp(-t * 20))
    return (np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-t * 10)).astype(np.float32) * 0.6 * g

music = buf(); sfx = buf()
def mt(t): return t < MUSIC_END - 0.01
# 1-beat drop-outs on the big "caught" moments
FREEZE = [(ST['logpile'] + 1.0, ST['logpile'] + 1.5), (ST['pole'] + 1.0, ST['pole'] + 1.5)]
def frozen(t): return any(a <= t < b for a, b in FREEZE)

# ---------------- score ----------------
CHORDS = ['A', 'A', 'F', 'E']
ROOT = {'A': 'A1', 'F': 'F1', 'E': 'E1', 'D': 'D2'}
bass_pat = [(0, 0, 0.4), (0.75, 12, 0.2), (1.0, 7, 0.3), (1.5, 0, 0.25), (1.75, 10, 0.2), (2.5, 0, 0.3), (3.0, 12, 0.25), (3.5, 7, 0.3)]
nbars = int(np.ceil(MUSIC_END / (4 * BEAT)))
pole0, pole1 = ST['pole'], ST['whip']
ACT2 = ST['bales']
for b in range(nbars):
    t0 = b * 4 * BEAT; ch = CHORDS[b % 4]; rf = hz(ROOT[ch])
    intense = 1.0 if t0 < ACT2 else (1.15 if t0 < pole0 else 1.3)
    for be, semi, d in bass_pat:
        t = t0 + be * BEAT
        if not mt(t) or frozen(t) or t >= pole1: continue
        place(music, pluck_bass(rf * 2 ** (semi / 12), d + 0.1, 0.6 if t > pole0 else 0.45), t, 0.55, -0.05)
    for s16 in range(16):
        t = t0 + s16 * BEAT / 4 + (0.035 if s16 % 2 else 0)
        if not mt(t) or frozen(t) or t >= pole1: continue
        if t < 0.5 and s16 % 4: continue                     # cold open: sparse first beat
        if s16 in (0, 6, 10) or (t > pole0 + 2.5 and s16 in (0, 4, 8, 10, 12)): place(music, kick(0.9), t, 0.6)
        if s16 in (4, 12): place(music, snare(1.0), t, 0.45, 0.1)
        if s16 in (7, 15) and intense > 1.1: place(music, snare(0.25), t, 0.45, 0.1)
        place(music, hat(0.55 if s16 % 4 else 0.85, open_=(s16 == 14 and t > pole0)), t, 0.35 * intense, 0.35)
HOOK = [(0, 'A4', .3), (0.5, 'C5', .3), (1, 'E5', .3), (1.5, 'D#5', .25), (1.75, 'E5', .3), (2.5, 'C5', .3), (3, 'A4', .5),
        (4, 'E5', .3), (4.5, 'G5', .3), (5, 'F5', .3), (5.5, 'E5', .3), (6, 'D5', .3), (6.5, 'B4', .3), (7, 'G#4', .4), (7.5, 'B4', .3)]
ZIP0, ZIP1 = pole0 + 2.3, pole0 + 5.48
for rep in range(int(np.ceil(MUSIC_END / (8 * BEAT)))):
    for be, nt, d in HOOK:
        t = rep * 8 * BEAT + be * BEAT
        if not mt(t) or frozen(t) or ZIP0 <= t < ZIP1 + 0.1 or t >= pole1: continue
        place(music, marimba(hz(nt), d + 0.2), t, 0.33, -0.25)
        if pole0 <= t < pole1:
            place(music, square(hz(nt) * 2, d * 0.8) * env(int(d * 0.8 * SR), 0.003, d * 0.6), t, 0.22, 0.3)
for b in range(nbars):
    t0 = b * 4 * BEAT
    if not (ACT2 <= t0 < pole0): continue
    ch = CHORDS[b % 4]; tones = {'A': ['A5', 'C6', 'E6'], 'F': ['F5', 'A5', 'C6'], 'E': ['E5', 'G#5', 'B5']}[ch]
    for i in range(16):
        t = t0 + i * BEAT / 4
        if mt(t) and not frozen(t): place(music, square(hz(tones[i % 3]), 0.09, 0.5) * env(int(0.09 * SR), 0.001, 0.05), t, 0.08, 0.4)
# zip-line: driving 8ths + riser into the landing; saw stabs on the landing and the two fist pumps
for i in range(int((ZIP1 - ZIP0) / (BEAT / 2))):
    t = ZIP0 + i * BEAT / 2
    place(music, pluck_bass(hz('A1') * (2 if i % 2 else 1), 0.25, 0.7), t, 0.45)
rn = int((ZIP1 - ZIP0) * SR); tt = np.arange(rn) / SR
place(music, bp((rng.random(rn) * 2 - 1).astype(np.float32), 400, 6000) * (tt / tt[-1]) ** 2 * 0.25, ZIP0, 0.6)
for t in (pole0 + 5.48, pole0 + 6.06, pole0 + 6.46):
    place(music, saw_chord([hz('A3'), hz('C#4'), hz('E4'), hz('A4')], 0.5), t, 1.0); place(music, kick(1.0), t, 0.7)
# whip chase: drum fill (toms + snare roll crescendo) into the dead stop
f0 = ST['whip']
for i in range(int((MUSIC_END - f0) / (BEAT / 4))):
    t = f0 + i * BEAT / 4; u = i / ((MUSIC_END - f0) / (BEAT / 4))
    place(music, tom([196, 165, 131, 110][(i // 2) % 4], 0.6 + 0.6 * u) if i % 2 == 0 else snare(0.4 + 0.8 * u, brush=False), t, 0.5)
    if i % 4 == 0: place(music, kick(0.8), t, 0.6)
i0 = int(MUSIC_END * SR); music[i0:] = 0; music[i0 - 480:i0] *= np.linspace(1, 0, 480)[:, None]
# stinger after the cut to black
st = T_STING + 0.12
for j, nt in enumerate(['A5', 'C#6', 'E6']): place(music, square(hz(nt), 0.08, 0.5), st + j * 0.06, 0.22)
place(music, square(hz('A6'), 0.9, 0.5, vib=1) * env(int(0.9 * SR), 0.002, 0.5), st + 0.2, 0.22)
place(music, marimba(hz('A5'), 1.2) + marimba(hz('E5'), 1.2), st + 0.2, 0.5)
place(music, kick(1.0), st + 0.2, 0.7)
cn = int(1.2 * SR); ct = np.arange(cn) / SR
place(music, hp((rng.random(cn) * 2 - 1).astype(np.float32), 5000) * np.exp(-ct * 3.5) * 0.35, st + 0.2, 0.6)

# ---------------- SFX ----------------
def bip(t, g=1.0):
    for k, f in enumerate((2093, 2637)):
        n = int(0.05 * SR); tt = np.arange(n) / SR
        place(sfx, (np.sin(2 * np.pi * f * tt) * env(n, 0.001, 0.03)).astype(np.float32) * 0.22 * g, t + k * 0.055, 1.0, 0.15)
def boing(t, f0=180, f1=520, d=0.35, g=1.0):
    n = int(d * SR); tt = np.arange(n) / SR; f = f0 + (f1 - f0) * (1 - np.exp(-tt * 14)) + 25 * np.sin(2 * np.pi * 14 * tt)
    place(sfx, (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 7)).astype(np.float32) * 0.3 * g, t)
def step(t, g=1.0, pan=0.0):
    n = int(0.03 * SR); tt = np.arange(n) / SR
    x = bp((rng.random(n) * 2 - 1).astype(np.float32), 1800, 6000) * np.exp(-tt * 180) + np.sin(2 * np.pi * 900 * tt) * np.exp(-tt * 200) * 0.4
    place(sfx, x * 0.35 * g, t, 1.0, pan)
def crunch(t, g=1.0, pan=0.0):      # snow footstep
    n = int(0.06 * SR); tt = np.arange(n) / SR
    x = bp((rng.random(n) * 2 - 1).astype(np.float32), 700, 5000) * np.exp(-tt * 70) * (0.6 + 0.4 * (rng.random(n) > 0.7))
    place(sfx, x.astype(np.float32) * 0.3 * g, t, 1.0, pan)
def whoosh(t, d=0.35, f0=500, f1=3000, g=1.0, pan=0.0):
    n = int(d * SR); tt = np.arange(n) / SR; nz = (rng.random(n) * 2 - 1).astype(np.float32)
    out = np.zeros(n, np.float32); seg = 256
    for a in range(0, n, seg):
        u = a / n; fc = f0 + (f1 - f0) * u
        out[a:a + seg] = bp(nz[max(0, a - 512):a + seg], max(80, fc * 0.6), min(20000, fc * 1.6), 1)[-len(out[a:a + seg]):]
    place(sfx, out * np.sin(np.pi * tt / d) ** 1.5 * 0.5 * g, t, 1.0, pan)
def clank(t, g=1.0, f=1.0):
    n = int(0.9 * SR); tt = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * fr * f * tt) * np.exp(-tt * k) * a for fr, k, a in ((310, 6, 1), (742, 9, 0.7), (1187, 12, 0.5), (1931, 16, 0.35), (2870, 22, 0.2)))
    x += lp((rng.random(n) * 2 - 1).astype(np.float32), 3000) * np.exp(-tt * 40) * 0.8
    place(sfx, x.astype(np.float32) * 0.32 * g, t)
def tick(t, f=4200, g=1.0):
    n = int(0.015 * SR); tt = np.arange(n) / SR; place(sfx, np.sin(2 * np.pi * f * tt) * np.exp(-tt * 300) * 0.25 * g, t)
def chime(t, f=1568, g=1.0, pan=0.3):
    n = int(0.8 * SR); tt = np.arange(n) / SR
    place(sfx, ((np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(2 * np.pi * f * 2.76 * tt)) * np.exp(-tt * 6)).astype(np.float32) * 0.13 * g, t, 1.0, pan)
def chirp(t, g=1.0, f0=900, df=700):
    n = int(0.22 * SR); tt = np.arange(n) / SR; f = f0 + df * np.sin(np.pi * tt / 0.22)
    place(sfx, (np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.005, 0.15)).astype(np.float32) * 0.18 * g, t, 1.0, -0.1)
def yip(t, g=1.0):                   # pained little "ow!"
    n = int(0.16 * SR); tt = np.arange(n) / SR; f = 1300 - 600 * tt / 0.16 + 60 * np.sin(2 * np.pi * 30 * tt)
    place(sfx, (np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.3 + np.sin(2 * np.pi * np.cumsum(f) / SR)).astype(np.float32) * env(n, 0.004, 0.1) * 0.1 * g, t, 1.0, -0.05)
def creak(t, d=0.4, g=1.0):
    n = int(d * SR); tt = np.arange(n) / SR; f = 140 + 60 * np.sin(2 * np.pi * 3 * tt)
    x = (np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-((tt - d / 2) / (d / 3)) ** 2)).astype(np.float32)
    place(sfx, bp(x, 300, 2500) * 0.05 * g, t)
def thud(t, g=1.0):                  # a log landing: low body + woody knock
    n = int(0.45 * SR); tt = np.arange(n) / SR; f = 70 + 60 * np.exp(-tt * 25)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9) + sum(np.sin(2 * np.pi * fr * tt) * np.exp(-tt * 40) * a for fr, a in ((410, 0.5), (980, 0.3)))
    x += lp((rng.random(n) * 2 - 1).astype(np.float32), 1500) * np.exp(-tt * 30) * 0.6
    place(sfx, x.astype(np.float32) * 0.5 * g, t)
def shutter(t, g=1.0):               # tiny camera: click-clack + a whirr
    for dt, f in ((0.0, 3200), (0.045, 2400)):
        n = int(0.02 * SR); tt = np.arange(n) / SR
        place(sfx, (bp((rng.random(n) * 2 - 1).astype(np.float32), 1500, 8000) * np.exp(-tt * 250) + np.sin(2 * np.pi * f * tt) * np.exp(-tt * 300) * 0.5) * 0.4 * g, t + dt, 1.0, 0.1)
    n = int(0.18 * SR); tt = np.arange(n) / SR
    place(sfx, (np.sign(np.sin(2 * np.pi * (600 + 300 * tt / 0.18) * tt)) * env(n, 0.01, 0.12) * 0.03 * g).astype(np.float32), t + 0.07, 1.0, 0.1)
def flash_whine(t, d=0.22, g=1.0):   # flash charging whine
    n = int(d * SR); tt = np.arange(n) / SR; f = 3000 + 6000 * (tt / d) ** 1.5
    place(sfx, (np.sin(2 * np.pi * np.cumsum(f) / SR) * (tt / d) ** 2 * 0.06 * g).astype(np.float32), t, 1.0, 0.1)
def zap(t, d=0.2, g=1.0):            # electric zap: buzzy saw + crushed noise
    n = int(d * SR); tt = np.arange(n) / SR
    x = 2 * ((120 * tt + 0.3 * np.sin(2 * np.pi * 37 * tt)) % 1) - 1
    nz = (rng.random(n) * 2 - 1); nz = np.repeat(nz[::30], 30)[:n]
    x = (x * 0.6 + nz * 0.5) * (rng.random(n) > 0.25) * env(n, 0.002, d * 0.7, curve=2)
    x = np.round(x * 5) / 5
    place(sfx, bp(x.astype(np.float32), 200, 7000) * 0.35 * g, t)
def crackle(t, d, g=1.0, dens=60):   # sparks: random tiny clicks
    n = int(d * SR); x = np.zeros(n, np.float32); m = int(dens * d)
    for _ in range(m):
        i = int(rng.integers(0, max(1, n - 300))); L = int(rng.integers(30, 160)); tt = np.arange(L) / SR
        x[i:i + L] += (rng.random(L) * 2 - 1) * np.exp(-tt * 900) * rng.uniform(0.3, 1.0)
    place(sfx, hp(x, 2500) * 0.22 * g, t, 1.0, 0.25)
def twang(t, f=95, g=1.0):           # a wire taking the weight: low twang with wobble
    n = int(0.8 * SR); tt = np.arange(n) / SR; ff = f * (1 + 0.04 * np.exp(-tt * 6) * np.sin(2 * np.pi * 6 * tt))
    x = sum(np.sin(2 * np.pi * np.cumsum(ff * h) / SR) / h for h in (1, 2, 3, 5)) * np.exp(-tt * 4)
    place(sfx, x.astype(np.float32) * 0.12 * g, t)
def slide_whistle(t, d, f0, f1, g=1.0):
    n = int(d * SR); tt = np.arange(n) / SR; f = f0 * (f1 / f0) ** (tt / d) * (1 + 0.01 * np.sin(2 * np.pi * 6 * tt))
    place(sfx, (np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.02, d, s=0.8) * 0.07 * g).astype(np.float32), t)
def shimmer(t0, t1, root=1318.5, g=1.0, pan=0.0):
    """a soft upward glass arpeggio while a hand-drawn pattern draws on, a bell when it completes (on the beat at t1)"""
    notes = [1, 1.25, 1.5, 2, 2.5, 3, 4]
    nn = max(4, int((t1 - t0) / 0.07))
    for i in range(nn):
        f = root * notes[i % len(notes)] * (2 if i >= len(notes) else 1) ** 0
        n = int(0.5 * SR); tt = np.arange(n) / SR
        x = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * f * 2.01 * tt)) * np.exp(-tt * 9)
        place(sfx, x.astype(np.float32) * 0.035 * g * (0.5 + 0.5 * i / nn), t0 + i * (t1 - t0) / nn, 1.0, pan + 0.4 * math.sin(i))
    chime(t1, root * 1.5, 0.9 * g, pan)
import math

# roof (cold open, as v2) + cloud streamlines
R = ST['roof']
for i in range(int(1.5 * 7.6)): step(R + i / 7.6, 0.6, 0.1)
whoosh(R + 0.55, 0.3, 600, 2200, 0.5)
shimmer(R + 0.1, R + 0.5, 1046.5, 0.8, -0.2)
bip(R + 1.42); whoosh(R + 1.5, 0.25, 3000, 900, 0.7)
boing(R + 1.72, 300, 120, 0.25, 0.7)
# spruce: boings up from behind the crown, lands on the tip; the pattern lands on the beat
Sp = ST['spruce']
boing(Sp + 0.12, 160, 700, 0.35, 0.8); whoosh(Sp + 0.12, 0.35, 700, 2600, 0.5)
boing(Sp + 0.6, 420, 260, 0.2, 0.6); creak(Sp + 0.62, 0.35, 0.5)
shimmer(Sp + 0.55, Sp + 1.0, 1318.5, 1.0, 0.1)
tick(Sp + 1.12, 3200, 0.7); chirp(Sp + 1.14, 0.5, 1200, 400)
# log pile: strain, press, caught (drop-out), slip, THUD on the beat, ouch hops
L = ST['logpile']
n = int(0.28 * SR); tt = np.arange(n) / SR
place(sfx, (np.sin(2 * np.pi * np.cumsum(180 + 25 * np.sin(2 * np.pi * 11 * tt)) / SR) * env(n, 0.03, 0.25, s=0.6) * 0.05).astype(np.float32), L + 0.02)   # nnngh
whoosh(L + 0.26, 0.15, 400, 1600, 0.4)
bip(L + 0.9); whoosh(L + 1.32, 0.18, 2000, 600, 0.5); thud(L + 1.5, 1.0)
for j in range(5): yip(L + 1.64 + 0.32 * j, 0.9 - 0.12 * j); step(L + 1.62 + 0.32 * j + 0.2, 0.5)
# manhole (as v2)
M = ST['manhole']
for i in range(5): tick(M + 0.05 + i * 0.035, 1400 + 300 * (i % 2), 0.9)
creak(M + 0.22, 0.3); bip(M + 0.74); whoosh(M + 1.0, 0.12, 2500, 500, 0.5); clank(M + 1.10)
# photo: shooting the sights, notices us, aims... flash on the beat
Ph = ST['photo']
shutter(Ph + 0.15, 0.6); bip(Ph + 0.3, 0.7); whoosh(Ph + 0.42, 0.18, 900, 2200, 0.4)
flash_whine(Ph + 0.78, 0.22, 1.0); shutter(Ph + 1.0, 1.2)
n = int(0.5 * SR); tt = np.arange(n) / SR
place(sfx, (hp((rng.random(n) * 2 - 1).astype(np.float32), 3000) * np.exp(-tt * 9) * 0.12).astype(np.float32), Ph + 1.0)    # flash "pfff"
chirp(Ph + 1.36, 0.7, 1100, 500)
# bales: wink, caught, bolt (hay rustle), off left
B = ST['bales']; tick(B + 0.92, 2400, 0.7); bip(B + 1.12); boing(B + 1.25, 200, 700, 0.18, 0.6)
whoosh(B + 1.33, 0.3, 800, 4000, 0.9, -0.4)
n = int(0.4 * SR); tt = np.arange(n) / SR
place(sfx, bp((rng.random(n) * 2 - 1).astype(np.float32), 2500, 9000) * np.exp(-tt * 8) * (rng.random(n) > 0.6) * 0.25, B + 1.33, 1.0, -0.2)
for i in range(6): step(B + 1.33 + i * 0.045, 0.7, -0.4)
# shoes: runs in from the right (fast patter), falls into step, waves
S0 = ST['shoes']
for i in range(7): step(S0 + 0.02 + i * 0.06, 0.6, 0.5 - i * 0.08)
for i in range(5): step(S0 + 0.5 + i * 0.22, 0.5, -0.1)
chirp(S0 + 0.98)
# garland: monkey bars, ZAP + flicker, ornament twinkles, peek, slip... falling whistle into the pole shot
G = ST['garland']; crowd_at = G
for j in range(3): whoosh(G + 0.1 + j * 0.37, 0.2, 500, 1400, 0.35); tick(G + 0.28 + j * 0.37, 1800, 0.6)
zap(G + 1.12, 0.2, 1.0); crackle(G + 1.12, 0.35, 0.8, 90)
for j, fl in enumerate([0.25, 1.25, 0.45, 1.05, 0.3]): tick(G + 1.12 + 0.05 * j, 900 + 400 * fl, 0.5)
chime(G + 1.75, 1568); chime(G + 2.0, 2093); bip(G + 2.08, 0.5)
slide_whistle(G + 2.36, 0.64 + 0.36, 1500, 500, 1.0)
# pole: grab (clang + creak), caught (drop-out), pump, release, catch (twang), zip with sparks, car, landing, windmill, pumps
Pp = ST['pole']
clank(Pp + 0.36, 0.45, 1.6); creak(Pp + 0.4, 0.5, 0.7); creak(Pp + 0.9, 0.4, 0.4)
bip(Pp + 0.98)
for k in range(3): whoosh(Pp + 1.48 + k * 0.18, 0.18, 400, 1200, 0.35)
boing(Pp + 2.0, 160, 640, 0.35, 0.9); whoosh(Pp + 2.0, 0.3, 800, 3000, 0.8)
boing(Pp + 2.3, 420, 220, 0.25, 0.7); twang(Pp + 2.3, 92, 1.0)
zn = int(3.18 * SR); zt = np.arange(zn) / SR
zf = 700 + 900 * np.clip(zt / 1.6, 0, 1) - 500 * np.clip((zt - 1.6) / 1.58, 0, 1)
zw = np.sin(2 * np.pi * np.cumsum(zf) / SR) * (0.6 + 0.4 * np.sin(2 * np.pi * 37 * zt)) + 0.5 * bp((rng.random(zn) * 2 - 1).astype(np.float32), 2000, 7000)
zw = zw * np.minimum(1, zt / 0.05) * np.clip((3.18 - zt) / 0.4, 0, 1) * (1 - 0.5 * np.clip((zt - 1.6) / 1.58, 0, 1))
place(sfx, zw.astype(np.float32) * 0.07, Pp + 2.3, 1.0, 0.2)
crackle(Pp + 2.4, 2.75, 0.9, 70)
shimmer(Pp + 4.1, Pp + 5.0, 1174.7, 0.9, 0.0)
boing(Pp + 5.48, 300, 110, 0.3, 0.9); chime(Pp + 5.48, 2349, 0.8, 0.0)
slide_whistle(Pp + 5.56, 0.38, 900, 1400, 0.8); slide_whistle(Pp + 5.75, 0.2, 1400, 800, 0.6)
for t in (6.06, 6.46): whoosh(Pp + t - 0.05, 0.15, 600, 2500, 0.5)
# whip: sprint patter on the snow, the whip pan's swoosh
W = ST['whip']
for i in range(12): crunch(W + 0.03 + i * 0.105, 0.5, 0.2)
whoosh(W + 0.55, 0.85, 2500, 400, 1.4, 0.3)
# summit: wind bed + rising tone through the zoom, crunch steps, skid, flag plant, the ghost mountain shimmer, binoculars, wave, boop
Su = ST['summit']
wn = int((T_STING - Su) * SR); wt = np.arange(wn) / SR
wind = lp((rng.random(wn) * 2 - 1).astype(np.float32), 500) * (0.5 + 0.3 * np.sin(2 * np.pi * 0.3 * wt)) * 0.22
place(sfx, wind, Su, 1.0)
tn = int(3.2 * SR); tt = np.arange(tn) / SR
tone = (np.sin(2 * np.pi * (220 + 110 * tt / 3.2) * tt) * 0.5 + np.sin(2 * np.pi * (330 + 165 * tt / 3.2) * tt) * 0.3) * (tt / 3.2) ** 2 * 0.05
place(sfx, tone.astype(np.float32), Su, 1.0)
for i in range(10): crunch(Su + 1.2 + i * 0.125, 0.25 + 0.05 * i, -0.2)
crunch(Su + 2.45, 1.0); whoosh(Su + 2.42, 0.2, 2000, 700, 0.4)
whoosh(Su + 2.62, 0.15, 500, 1500, 0.3); thud(Su + 2.95, 0.45); crunch(Su + 2.95, 1.2)
n = int(0.5 * SR); tt = np.arange(n) / SR
place(sfx, (bp((rng.random(n) * 2 - 1).astype(np.float32), 600, 3000) * (0.5 + 0.5 * np.sin(2 * np.pi * 14 * tt)) * np.exp(-tt * 4) * 0.06).astype(np.float32), Su + 3.0)  # flag flap
shimmer(Su + 3.25, Su + 4.0, 987.8, 1.1, 0.0)
bip(Su + 4.42, 0.7)
whoosh(Su + 5.05, 0.3, 1500, 600, 0.35)
chirp(Su + 5.35, 1.0); chirp(Su + 5.75, 0.7)
n = int(0.18 * SR); tt = np.arange(n) / SR
boop = np.sin(2 * np.pi * np.cumsum(330 + 330 * np.exp(-tt * 30)) / SR) * env(n, 0.003, 0.1)
place(sfx, boop.astype(np.float32) * 0.35, Su + 6.05); boing(Su + 6.1, 260, 520, 0.22, 0.4); crunch(Su + 6.36, 0.5)

# ---------------- real sounds ----------------
def load(p):
    sr, x = wavf.read(p); x = x.astype(np.float32) / 32768.0; return x
car = load('/home/user/brain/everywhere-claude/v3/audio/car_1661.wav')
car = np.stack([hp(car[:, c], 160, 4) for c in range(2)], 1)
cs = int((6.6 - 5.5) * SR); car = car[cs:]; cn = len(car); car *= np.minimum(1, np.arange(cn) / (0.25 * SR))[:, None]
cend = int((MUSIC_END - (Pp + 4.2)) * SR)
if cend < len(car): car = car[:cend]; car[-int(0.2 * SR):] *= np.linspace(1, 0, int(0.2 * SR))[:, None]
place(sfx, car * 3.2, Pp + (6.6 - 2.4))
crowd = load('/home/user/brain/everywhere-claude/v3/audio/crowd_1623.wav')
crowd = np.stack([hp(crowd[:, c], 200, 4) for c in range(2)], 1)
seg = crowd[int(1.6 * SR):int(4.6 * SR)]; fd = np.minimum(1, np.minimum(np.arange(len(seg)), len(seg) - np.arange(len(seg))) / (0.15 * SR))[:, None]
place(sfx, seg * fd * 2.0, ST['garland'])

mix = music * 0.85 + sfx * 1.5
for name, x in (('music', music), ('sfx', sfx), ('mix_raw', mix)):
    y = x / max(1.0, np.abs(mix).max() * 1.05)
    wavf.write(f'/home/user/brain/everywhere-claude/v3/audio/{name}.wav', SR, (y * 32767).astype(np.int16))
print('duration', DUR, 'peak', np.abs(mix).max())
