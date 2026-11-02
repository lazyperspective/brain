#!/usr/bin/env python3
"""THE SEED AND THE STONE - the sound: a seamless 24.000 s score, synthesised (numpy/scipy) with a few
sampled instruments rendered by FluidSynth (FluidR3_GM) from a MIDI file this script writes itself.

It follows the picture's own clock (06-the-seed-and-the-stone.js):

    t        picture                                         sound
    0-0.5    the seed's last bounce and roll; it drops in     taps as it lands; a soft breeze
    0.45     first light finds it; a flock crosses            a glint of celesta; wingbeats and a distant call
    0.6-1.1  it swells in pulses; the coat splits             a tiny dry tick
    1.1-2.5  root down, a hooked shoot breaks out             the low open fifth
    2.5-3.7  the shoot pushes the flake: strain, tremble      a held tone that tightens and trembles
    3.7-4.0  the pause before it breaks                       the tone drops away: held breath
    4.05     the flake breaks off, chips spring, dust         a stone crack, little ticks as the chips land
    4.1-11.4 the shoot rises, leaves unfold one by one        a sparse warm motif (harp, piano), one note per leaf
    11.9-15.3 three poppies open in turn; the words come      a harp note for each; strings swell softly to D major
    15.4-18.1 a hoverfly visits                               a small buzz that comes, stops while it lands, goes
    16.7-20.6 the petals fall, flower by flower               falling notes
    20.6-24  the wind flicks the seed along the stone         a gust; a tick at release; taps as it bounces
    22-24    back toward dawn                                 the breeze settles; the first bird; the last bounce = 0.0

Seamless by construction: everything is rendered over three cycles (72 s) with every noise source built from one
24 s tile repeated, envelopes periodic, events placed in every cycle, the reverb circular, and the middle cycle cut.
FluidSynth renders the same three-cycle MIDI (its reverb and chorus off), so note tails cross the seam naturally.

    python3 score.py        (numpy, scipy, soundfile; fluidsynth + /usr/share/sounds/sf2/FluidR3_GM.sf2; ffmpeg)
Writes score.wav (48 kHz / 24-bit / stereo, exactly 24.000 s) and verification.txt.
"""
import os, struct, subprocess, tempfile
import numpy as np
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
SF2 = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
SR = 48000
D = 24.0
N = int(round(SR * D))
CYC = 3
NT = N * CYC
TARGET_LUFS = -20.0
CEIL_DB = -2.0
t_all = np.arange(NT) / SR
tl = np.mod(t_all, D)


def s5(u):
    u = np.clip(u, 0, 1)
    return u * u * u * (u * (u * 6 - 15) + 10)


def ph(t, a, b):
    return np.clip((t - a) / (b - a), 0, 1)


def back(u, c):
    u = np.clip(u, 0, 1)
    v = u - 1
    return 1 + (c + 1) * v ** 3 + c * v ** 2


def sstep(a, b, x):
    u = np.clip((x - a) / (b - a), 0, 1)
    return u * u * (3 - 2 * u)


# ------------------------------------------------------------------ the picture's clock
T_BREAK0 = 7.25
T_REL0 = 21.05
TD0 = [19.25, 19.6, 19.95, 20.3]              # the hero's petals, story time (the side flowers' are below)


def stem_len(tau):
    return (19 * s5(ph(tau, 3.4, 5.6)) + 2.5 * sstep(5.6, T_BREAK0, tau) + 18 * back(ph(tau, T_BREAK0, 8.0), 1.4)
            + 145 * s5(ph(tau, 8.0, 13.2)) ** 1.2 + 22 * s5(ph(tau, 13.2, 14.6)))


LEAF_T = []
for node in (46, 74, 104, 136):
    a, b = 7.0, 15.0
    for _ in range(40):
        m = (a + b) / 2
        if stem_len(m) < node + 3:
            a = m
        else:
            b = m
    LEAF_T.append((a + b) / 2)

# ------------------------------------------------------------------ story time (the same warp as the picture)
# The plant keeps its own clock; loop time maps onto it through a smooth monotone curve, periodic in D (see storyAt in
# the piece). Plant events below are written in story time and placed at nt(story) in loop time.
STK = [[0, -0.85], [0.4, -0.38], [0.56, 0.02], [0.66, 1.2], [0.98, 3.0], [1.12, 3.5], [1.75, 5.6], [2.5, 5.9],
       [3.7, 6.85], [4.0, 7.25], [4.2, 7.45], [6.4, 9.4], [11.4, 13.4], [13.4, 15.0], [18.6, 19.25], [20.6, 21.05]]


def _key(i):
    n = len(STK)
    q, w = i % n, i // n
    return STK[q][0] + w * D, STK[q][1] + w * D


_STM = []
for i in range(len(STK)):
    a, b, c = _key(i - 1), _key(i), _key(i + 1)
    d0, d1 = (b[1] - a[1]) / (b[0] - a[0]), (c[1] - b[1]) / (c[0] - b[0])
    _STM.append(0.0 if d0 * d1 <= 0 else 3 * (b[0] - a[0] + c[0] - b[0]) / ((2 * (c[0] - b[0]) + (b[0] - a[0])) / d0 + ((c[0] - b[0]) + 2 * (b[0] - a[0])) / d1))


def story(t):
    t = np.asarray(t, float)
    w = np.floor(t / D)
    x = t - w * D
    xs = np.array([k[0] for k in STK])
    i = np.searchsorted(xs, x, side='right') - 1
    n = len(STK)
    j = (i + 1) % n
    x0 = xs[i]
    x1 = np.where(j == 0, D, xs[j])
    y0 = np.array([k[1] for k in STK])[i]
    y1 = np.where(j == 0, STK[0][1] + D, np.array([k[1] for k in STK])[j])
    m0, m1 = np.array(_STM)[i], np.array(_STM)[j]
    h = x1 - x0
    u = (x - x0) / h
    u2, u3 = u * u, u * u * u
    return w * D + (2 * u3 - 3 * u2 + 1) * y0 + (u3 - 2 * u2 + u) * h * m0 + (-2 * u3 + 3 * u2) * y1 + (u3 - u2) * h * m1


_NG = np.linspace(-2.0, 26.0, 28 * 4000 + 1)
_OG = story(_NG)


def nt(x):
    """loop time at which story time x happens"""
    return float(np.interp(x, _OG, _NG))


TSA = story(t_all)                         # story time of every sample
TSL = np.mod(TSA, D)


def senv(points):
    """an envelope from (story time, value) points"""
    p = sorted(points)
    xs = np.array([q[0] for q in p] + [p[0][0] + D])
    ys = np.array([q[1] for q in p] + [p[0][1]])
    return np.interp(TSL, xs, ys, period=D)

LEAF_T = [nt(x) for x in LEAF_T]
T_BREAK, T_REL, TD = nt(T_BREAK0), nt(T_REL0), [nt(x) for x in TD0]
print('leaves begin to unfold at', ', '.join(f'{x:.2f}' for x in LEAF_T))
# the evening gust (same shape as the picture's) and the seed's bounces
gust = np.exp(5 * (np.cos(2 * np.pi * (TSA - 21.2) / D) - 1))
BOUNCES = [(nt(22.6), 1.0), (nt(23.0), 0.55), (nt(23.28), 0.3)]
T_DROP = nt(23.62)


def hz(note):
    names = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    n, o = note[:-1], int(note[-1])
    return 440.0 * 2 ** ((names[n] + 12 * (o + 1) - 69) / 12)


def midi(note):
    names = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    n, o = note[:-1], int(note[-1])
    return names[n] + 12 * (o + 1)


def place(buf, start, sig):
    i0 = int(round(start * SR)) % NT
    n = sig.shape[-1]
    end = i0 + n
    if end <= NT:
        buf[..., i0:end] += sig
    else:
        k = NT - i0
        buf[..., i0:] += sig[..., :k]
        buf[..., :end - NT] += sig[..., k:]


def tiled(seed, ch=2):
    r = np.random.default_rng(seed)
    return np.tile(r.standard_normal((ch, N)), (1, CYC))


def circ(fn, x):
    """apply a causal filter to a looped signal: filter three copies, keep the middle"""
    xx = np.concatenate([x, x, x], axis=-1)
    return fn(xx)[..., NT:2 * NT]


def lp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2))
    return signal.lfilter(b, a, x, axis=-1)


def hp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), btype='high')
    return signal.lfilter(b, a, x, axis=-1)


def bp(x, f0, f1, order=2):
    b, a = signal.butter(order, [f0 / (SR / 2), f1 / (SR / 2)], btype='band')
    return signal.lfilter(b, a, x, axis=-1)


def pans(sig, pan):
    return np.vstack([sig * np.sqrt(0.5 * (1 - pan)), sig * np.sqrt(0.5 * (1 + pan))])


def penv(points):
    p = sorted(points)
    xs = np.array([q[0] for q in p] + [p[0][0] + D])
    ys = np.array([q[1] for q in p] + [p[0][1]])
    return np.interp(tl, xs, ys, period=D)


def tone(f_target, ph0=0.0):
    f = round(f_target * D) / D                     # whole cycles per loop
    return np.sin(2 * np.pi * f * t_all + ph0)


# ------------------------------------------------------------------ the breeze: always there, so the seam sits in it
wn = tiled(11)
sway = 0.75 + 0.25 * np.sin(2 * np.pi * 3 * t_all / D + 0.4) + 0.12 * np.sin(2 * np.pi * 7 * t_all / D + 1.1)
breeze = circ(lambda x: bp(x, 180, 1400, 2), wn) * 0.03 * sway
rustle = circ(lambda x: bp(x, 2500, 7000, 2), tiled(12)) * 0.006 * (0.4 + 0.6 * sway)
breeze += circ(lambda x: bp(x, 250, 2600, 2), tiled(13)) * 0.11 * gust            # the gust that takes the seed
rustle += circ(lambda x: bp(x, 2400, 8000, 2), tiled(14)) * 0.03 * gust * (0.7 + 0.3 * np.sin(2 * np.pi * 40 * t_all / D))
air = breeze + rustle

# ------------------------------------------------------------------ distant birds at dawn
birds = np.zeros((2, NT))


def chirp(f0, f1, dur, amp, seed, vib=0.0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = f0 + (f1 - f0) * (tt / dur) ** 0.7 + vib * np.sin(2 * np.pi * 38 * tt + r.uniform(0, 6))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.25 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    return s * np.sin(np.pi * tt / dur) ** 1.5 * amp


def warble(t0, amp, seed, pan):
    r = np.random.default_rng(seed)
    t = t0
    for k in range(r.integers(4, 7)):
        f0 = r.uniform(2600, 3600)
        place(birds, t, pans(chirp(f0, f0 * r.uniform(0.8, 1.25), r.uniform(0.05, 0.11), amp * r.uniform(0.6, 1), seed * 10 + k, 120), pan))
        t += r.uniform(0.08, 0.16)


def call(t0, amp, seed, pan):
    place(birds, t0, pans(chirp(3100, 2500, 0.22, amp, seed), pan))
    place(birds, t0 + 0.3, pans(chirp(2700, 2200, 0.28, amp * 0.85, seed + 1), pan))


for c in range(CYC):
    o = c * D
    warble(o + 0.7, 0.022, 1, -0.55)
    call(o + 2.6, 0.016, 2, 0.6)
    warble(o + 4.1, 0.017, 3, -0.5)
    call(o + 23.3, 0.012, 4, 0.55)                   # the first bird of the next dawn
    call(o + 0.35, 0.010, 5, 0.75)                   # a distant call from the flock as it comes over
birds = circ(lambda x: lp(x, 6500, 2), birds)
# the flock's wingbeats: a soft, fast flutter that passes overhead right to left (t = 23.3 .. 4.9, wrapping)
fu = np.mod(t_all - 23.3, D)
flock_env = np.clip(np.sin(np.pi * np.clip(fu / 5.6, 0, 1)), 0, 1) ** 2 * (fu < 5.6)
flut = (0.5 + 0.5 * np.sin(2 * np.pi * 13.0 * t_all)) ** 3 * (0.6 + 0.4 * np.sin(2 * np.pi * 9.7 * t_all + 1))
wings = circ(lambda x: bp(x, 500, 3200, 2), tiled(15)[0]) * flut * flock_env * 0.022
fpan = np.clip(0.8 - fu / 3.0, -0.8, 0.8)
birds += np.vstack([wings * np.sqrt(0.5 * (1 - fpan)), wings * np.sqrt(0.5 * (1 + fpan))])

# ------------------------------------------------------------------ the stone: a tick, the crack, chips, taps
fx = np.zeros((2, NT))


def click(dur, f0, f1, decay, amp, seed, thump=0.0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    tt = np.arange(n) / SR
    s = bp(r.standard_normal(n), f0, f1, 2) * np.exp(-tt / decay)
    if thump:
        s += thump * lp(r.standard_normal(n), 220, 2) * np.exp(-tt / 0.03)
    s[:16] *= np.linspace(0, 1, 16)
    return s * amp


for c in range(CYC):
    o = c * D
    place(fx, o + nt(3.0), pans(click(0.05, 2500, 7000, 0.004, 0.07, 31), 0.1))                     # the coat splits
    place(fx, o + T_BREAK, pans(click(0.25, 1500, 6500, 0.012, 0.32, 32, thump=0.6), 0.05))      # the flake breaks
    place(fx, o + T_BREAK + 0.004, pans(click(0.18, 3000, 9000, 0.006, 0.12, 33), -0.2))
    for k, dt in enumerate([0.22, 0.28, 0.31, 0.37, 0.42, 0.47, 0.53]):                          # chips land
        place(fx, o + nt(T_BREAK0 + dt), pans(click(0.03, 3000, 9000, 0.0025, 0.05 * (1 - k * 0.08), 40 + k), (k % 3 - 1) * 0.3))
    n = int(1.4 * SR)
    tt = np.arange(n) / SR
    dust = bp(np.random.default_rng(34).standard_normal(n), 2500, 9000, 2) * np.exp(-tt / 0.4) * np.clip(tt / 0.02, 0, 1) * 0.02
    place(fx, o + T_BREAK + 0.02, pans(dust, 0.1))
    for k in range(9):                                                                            # grit trickling in
        place(fx, o + nt(6.0 + k * 0.55 + 0.17 * np.sin(k * 3.1)), pans(click(0.02, 4000, 10000, 0.0015, 0.012, 50 + k), 0.15))
    place(fx, o + T_REL, pans(click(0.04, 2000, 6000, 0.003, 0.04, 60), -0.4))                  # the pod lets go
    for k, (bt, a) in enumerate(BOUNCES):
        place(fx, o + bt, pans(click(0.05, 1800, 5000, 0.004, 0.06 * a, 61 + k, thump=0.15), 0.25))
    n = int(0.34 * SR)                                                                            # rolling on grit
    roll = bp(np.random.default_rng(65).standard_normal(n), 2000, 7000, 2) * np.sin(np.pi * np.arange(n) / n) * 0.012
    roll *= (np.random.default_rng(66).random(n) < 0.05) * 3 + 0.3
    place(fx, o + nt(23.28), pans(roll, 0.3))
    place(fx, o + T_DROP, pans(click(0.05, 1500, 4500, 0.005, 0.05, 67, thump=0.2), 0.3))       # into the crack

# ------------------------------------------------------------------ the strain, and the held breath
strain_env = senv([(0, 0), (5.8, 0), (6.4, 0.55), (6.82, 1.0), (6.95, 0.0), (23.9, 0)])
trem = 1 + 0.35 * np.sin(2 * np.pi * 9.0 * t_all) * np.clip((TSL - 6.2) / 0.3, 0, 1) * (TSL < 6.85)
strain = (0.05 * tone(hz('A3')) + 0.035 * tone(hz('E4') * 1.004, 1.0) + 0.02 * tone(hz('B4') * 0.997, 2.0)) * strain_env * trem
strain = circ(lambda x: lp(x, 2400, 1), strain)
strain = np.vstack([strain, strain])

# a low open fifth breathing under dawn and day, thinning toward evening
drone_env = senv([(0, 0.55), (3.0, 0.8), (6.8, 0.9), (6.95, 0.25), (7.3, 0.7), (14.0, 1.0), (17.0, 1.0), (20.5, 0.5), (23.0, 0.45)])
drone = (0.05 * tone(hz('D2')) + 0.035 * tone(hz('A2'), 1.3) + 0.012 * tone(hz('D3') * 1.002, 0.4)) * drone_env
drone *= 1 + 0.15 * np.sin(2 * np.pi * 2 * t_all / D)
drone = np.vstack([drone, drone * 0.96])

# ------------------------------------------------------------------ the hoverfly
fly_env = penv([(0, 0), (15.4, 0), (16.0, 0.55), (16.3, 1.0), (16.62, 0.9), (16.7, 0), (17.13, 0), (17.22, 1.0), (17.5, 0.6), (18.1, 0), (23.9, 0)])
fly_pan = penv([(0, 0.7), (15.4, 0.9), (16.3, 0.1), (17.2, 0.1), (18.1, 0.9)])
fph = 2 * np.pi * np.cumsum(205 + 12 * np.sin(2 * np.pi * 3 * t_all)) / SR
buzz = (2 * ((fph / (2 * np.pi)) % 1) - 1) * (0.7 + 0.3 * np.sin(fph * 0.5))
buzz = circ(lambda x: bp(x, 180, 1600, 2), buzz) * 0.03 * fly_env
fly = np.vstack([buzz * np.sqrt(0.5 * (1 - fly_pan)), buzz * np.sqrt(0.5 * (1 + fly_pan))])

# ------------------------------------------------------------------ the motif (FluidSynth): harp, piano, strings
# (time, channel, note, velocity, length)
NOTES = []
HARP, PIANO, STR, CEL = 0, 1, 2, 3
NOTES += [(T_BREAK0 + 0.06, HARP, 'A4', 60, 2.0), (T_BREAK0 + 0.06, PIANO, 'D3', 38, 3.0)]                 # it breaks through
NOTES += [(7.9, HARP, 'D5', 52, 2.0), (8.6, HARP, 'E5', 48, 2.0), (9.5, HARP, 'F#5', 50, 2.4)]         # rising with the shoot
NOTES += [(9.5, PIANO, 'A3', 30, 3.0)]
NOTES_LOOP = []                                   # notes already in loop time
for k, (lt, nn) in enumerate(zip(LEAF_T, ['A5', 'F#5', 'B5', 'D6'])):                                     # one note per leaf
    NOTES_LOOP += [(lt + 0.4, HARP, nn, 46 - k * 2, 2.5), (lt + 0.4, PIANO, ['D4', 'B3', 'G3', 'A3'][k], 30, 3.0)]
NOTES += [(12.3, PIANO, 'E5', 34, 2.0), (13.6, PIANO, 'F#5', 36, 2.0)]                                   # the bud lifts
# the bloom: strings swell IV - V - I under the opening and the words
for nn in ['G2', 'D3', 'B3', 'D4']:
    NOTES += [(13.9, STR, nn, 44, 2.1)]
for nn in ['A2', 'E3', 'C#4', 'E4']:
    NOTES += [(15.0, STR, nn, 50, 1.5)]
for nn in ['D2', 'A2', 'F#3', 'D4', 'A4']:
    NOTES += [(16.3, STR, nn, 56, 3.6)]
NOTES += [(14.8, HARP, 'A4', 50, 2.0), (15.15, HARP, 'D5', 52, 2.0), (15.5, HARP, 'E5', 54, 2.0), (16.3, HARP, 'F#5', 62, 3.0),
          (16.3, PIANO, 'D4', 44, 3.5), (16.3, PIANO, 'A4', 40, 3.5), (17.3, CEL, 'A6', 34, 1.5), (18.2, PIANO, 'E5', 34, 2.4),
          (18.9, PIANO, 'D5', 32, 2.6)]
for k, td in enumerate(TD0):                                                                               # petals fall
    NOTES += [(td + 0.05, CEL, ['D6', 'B5', 'A5', 'F#5'][k], 40 - k * 3, 1.6)]
# the side flowers: one opens just before the hero, one just after; their petals fall too
NOTES += [(13.95, HARP, 'B5', 44, 2.2), (13.95, PIANO, 'G3', 26, 2.6), (16.65, HARP, 'C#6', 46, 2.4), (16.65, PIANO, 'A3', 28, 2.6)]
for k, td in enumerate([17.7, 18.1, 18.5, 18.9]):
    NOTES += [(td + 0.05, CEL, ['A6', 'F#6', 'E6', 'D6'][k], 26 - k * 2, 1.2)]
for k, td in enumerate([20.05, 20.4, 20.7, 21.0]):
    NOTES += [(td + 0.08, CEL, ['E6', 'C#6', 'B5', 'A5'][k], 24 - k * 2, 1.2)]
# first light finds the seed: a small glint of sound
NOTES_LOOP += [(0.45, CEL, 'F#6', 30, 1.4), (0.75, CEL, 'A6', 26, 1.4), (0.45, HARP, 'D4', 30, 2.4)]
NOTES += [(20.9, STR, 'D3', 30, 2.4), (20.9, STR, 'A3', 26, 2.4), (T_REL0 + 0.02, CEL, 'A6', 28, 1.2), (23.64, HARP, 'D5', 34, 2.5)]


def write_midi(path, notes, cycles):
    tpq, tempo = 480, 500000                   # 120 bpm: 960 ticks per second
    tps = tpq * 1e6 / tempo
    ev = []
    progs = {HARP: 46, PIANO: 0, STR: 49, CEL: 8}
    for ch, prg in progs.items():
        ev.append((0, bytes([0xC0 | ch, prg])))
        ev.append((0, bytes([0xB0 | ch, 7, 100])))
        ev.append((0, bytes([0xB0 | ch, 91, 0])))   # no reverb send (ours is circular)
        ev.append((0, bytes([0xB0 | ch, 93, 0])))
    for c in range(cycles):
        for (t, ch, nt, vel, ln) in notes:
            on = int(round((c * D + t) * tps))
            ev.append((on, bytes([0x90 | ch, midi(nt), vel])))
            ev.append((on + int(round(ln * tps)), bytes([0x80 | ch, midi(nt), 0])))
    ev.sort(key=lambda e: (e[0], e[1][0] & 0xF0 == 0x90))
    data, last = b'', 0

    def vlq(v):
        out = [v & 0x7F]
        v >>= 7
        while v:
            out.insert(0, (v & 0x7F) | 0x80)
            v >>= 7
        return bytes(out)
    data += vlq(0) + b'\xff\x51\x03' + tempo.to_bytes(3, 'big')
    for tick, msg in ev:
        data += vlq(tick - last) + msg
        last = tick
    data += vlq(int((cycles * D + 4) * tps) - last) + b'\xff\x2f\x00'
    with open(path, 'wb') as f:
        f.write(b'MThd' + struct.pack('>IHHH', 6, 0, 1, tpq) + b'MTrk' + struct.pack('>I', len(data)) + data)


with tempfile.TemporaryDirectory() as td:
    mp, wp = os.path.join(td, 'motif.mid'), os.path.join(td, 'motif.wav')
    write_midi(mp, [(nt(n[0]),) + n[1:] for n in NOTES] + NOTES_LOOP, CYC)
    subprocess.run(['fluidsynth', '-ni', '-q', '-R', '0', '-C', '0', '-g', '0.6', '-r', str(SR), '-F', wp, SF2, mp], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    m, msr = sf.read(wp, always_2d=True)
    assert msr == SR
m = m.T
motif = np.zeros((2, NT))
k = min(NT, m.shape[1])
motif[:, :k] = m[:, :k]
# tails from the third cycle that ran past 72 s fold back to the start (they belong to the next first cycle)
if m.shape[1] > NT:
    motif[:, :m.shape[1] - NT] += m[:, NT:]


# ------------------------------------------------------------------ space: a soft circular room, and the mix
def hall(x, seconds, seed, lpf):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    tt = np.arange(n) / SR
    ir = r.standard_normal((2, n)) * np.exp(-tt / (seconds / 6.9))
    ir = lp(ir, lpf, 1)
    ir[:, :int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
    ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
    y = np.zeros_like(x)
    for ch in range(2):
        full = signal.fftconvolve(np.concatenate([x[ch], x[ch]]), ir[ch])[:2 * NT]
        y[ch] = full[NT:2 * NT]
    return y


dry = air + birds * 0.9 + fx + strain + drone + fly + motif * 0.55
wet = hall(birds * 1.6 + motif * 0.7 + fx * 0.4 + strain * 0.6 + drone * 0.3, 3.8, 9, 3200)
mix = dry * 0.85 + wet * 0.42
mix = circ(lambda x: hp(x, 28, 2), mix)
out = mix[:, N:2 * N].copy()


def k_weight(x):
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=1), axis=1)


def lufs(x):
    xx = np.concatenate([x, x, x], axis=1)
    y = k_weight(xx)[:, N:2 * N]
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    ms = np.array([np.sum(np.mean(y[:, i:i + blk] ** 2, axis=1)) for i in range(0, N - blk, hop)])
    l = -0.691 + 10 * np.log10(ms + 1e-20)
    g = ms[l > -70]
    rel = -0.691 + 10 * np.log10(np.mean(g)) - 10
    return -0.691 + 10 * np.log10(np.mean(ms[(l > -70) & (l > rel)]))


def true_peak_db(x):
    up = signal.resample_poly(np.concatenate([x[:, -2000:], x, x[:, :2000]], axis=1), 4, 1, axis=1)
    return 20 * np.log10(np.max(np.abs(up)) + 1e-20)


L = lufs(out)
out *= 10 ** ((TARGET_LUFS - L) / 20)
tp = true_peak_db(out)
if tp > CEIL_DB:
    out *= 10 ** ((CEIL_DB - tp) / 20)
L2, tp2 = lufs(out), true_peak_db(out)
path = os.path.join(HERE, 'score.wav')
sf.write(path, out.T, SR, subtype='PCM_24')

# ------------------------------------------------------------------ verification
back_, sr = sf.read(path, always_2d=True)
back_ = back_.T
lines = ['THE SEED AND THE STONE - sound verification (measured on the written score.wav)', '']
lines.append(f'duration: {back_.shape[1]} frames = {back_.shape[1] / sr:.6f} s at {sr} Hz, {back_.shape[0]} ch, PCM_24')
lines.append('events (loop time): split %.2f, break %.2f, leaves %s, hero petals %s, release %.2f, bounces %s, drop %.2f (mod 24)' % (
    nt(3.0), T_BREAK, ' '.join(f'{x:.2f}' for x in LEAF_T), ' '.join(f'{x:.2f}' for x in TD), T_REL, ' '.join(f'{b[0]:.2f}' for b in BOUNCES), T_DROP))
lines.append(f'integrated loudness (internal BS.1770 meter, looped): {L2:.2f} LUFS; true peak {tp2:.2f} dBTP (4x oversampled)')
d_all = np.abs(np.diff(back_, axis=1))
seam = np.abs(back_[:, 0] - back_[:, -1])
lines.append(f'seam step |x[0] - x[N-1]|: L {seam[0]:.2e}, R {seam[1]:.2e}; ordinary steps: median {np.median(d_all):.2e}, 99.9th pct {np.percentile(d_all, 99.9):.2e}, max {d_all.max():.2e}')
two = np.concatenate([back_, back_], axis=1)
b, a = signal.butter(4, 6000 / (sr / 2), btype='high')
hpx = signal.lfilter(b, a, two, axis=1)[:, N // 2: N // 2 + N]
w = int(0.005 * sr)
e = np.array([np.sum(hpx[:, i:i + w] ** 2) for i in range(0, N - w, w)])
mid = (N // 2) // w
seam_e = e[mid - 1:mid + 2].max()
lines.append(f'click test (>6 kHz energy, 5 ms windows): window at the seam {10 * np.log10(seam_e + 1e-30):.1f} dB; median {10 * np.log10(np.median(e) + 1e-30):.1f} dB; max anywhere {10 * np.log10(e.max() + 1e-30):.1f} dB; seam rank {int(np.sum(e > seam_e))} of {len(e)} windows louder')
loc = np.array([np.sum(hpx[:, (N // 2) + k * w:(N // 2) + (k + 1) * w] ** 2) for k in range(-100, 100) if abs(k) > 2])
lines.append(f'local click test: seam window {10 * np.log10(seam_e + 1e-30):.1f} dB vs the surrounding 1 s: median {10 * np.log10(np.median(loc) + 1e-30):.1f} dB, max {10 * np.log10(loc.max() + 1e-30):.1f} dB')
ok_seam = seam.max() <= np.percentile(d_all, 99.9) and seam_e <= max(loc.max(), np.percentile(e, 99))
try:
    rr2 = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    summ = [l.strip() for l in rr2.stderr.splitlines() if l.strip().startswith(('I:', 'LRA:', 'Peak:'))]
    lines.append('ffmpeg ebur128 (single pass, not looped): ' + ' | '.join(summ[-3:]))
except Exception as ex:  # noqa
    lines.append('ffmpeg ebur128 unavailable: ' + str(ex))
lines.append('')
lines.append(('PASS' if ok_seam else 'CHECK') + '  seamless loop: no step or click at the seam beyond ordinary programme content')
lines.append(('PASS' if back_.shape[1] == N else 'FAIL') + '  exactly 24.000 s')
txt = '\n'.join(lines)
print(txt)
open(os.path.join(HERE, 'verification.txt'), 'w').write(txt + '\n')
