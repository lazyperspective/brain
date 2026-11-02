#!/usr/bin/env python3
"""CAN WE TALK LATER? - the sound: a seamless 37.000 s score, synthesised (numpy/scipy) with a few sampled instruments
rendered by FluidSynth (FluidR3_GM) from a MIDI file this script writes itself.

It follows the picture's clock (imagined/js/pieces/01-can-we-talk.js):

    t (s)        picture                                         sound
    36.45-1.05   the phone buzzes on the table, twice; the       a soft two-note chime; the motor buzz rattling on the
                 notification drops in; the camera whips in      wood (two pulses); a whoosh into the close-up
    2.3-3.6      Noor reads it                                   the calm piano tails away; room tone
    3.95, 5.75   the typing dots appear                          a small bubble blip each time
    5.05, 6.7    they vanish; ink drops are left, then eyes      silence, three ink drips; a low swell when the eyes open
    7.3-19.4     the spiral                                      heartbeats, accelerating (the same beat list as the
                                                                 picture's pulse); a beating low drone and tremolo
                                                                 strings, rising; whispers; a pen scratching every
                                                                 time a word is written on; the clock ticking faster;
                                                                 the floor cracking; a stab and a paper slap for each
                                                                 imagined scene (13.5, 15.0, 16.5); a rumble as the
                                                                 phone rises and the chime, slowed and sour, when its
                                                                 eyes open (16.6); tinnitus at the peak
    19.4-21.6    the breath                                      everything drops away but the ringing; an inhale,
                                                                 a held moment, an exhale
    21.6-22.1    "what's up?" typed and sent                     key taps, a send swish
    22.6-23.75   the reply, the cake                             warm marimba pops; a D major swell; the ink burning
                                                                 back (a soft fire crackle) until 27.3
    25.6-27.6    Noor laughs                                     a light pizzicato figure
    27.8-36.4    the quote (the ink word written at 30.95)       a slow piano phrase in D, a celesta glint and a pen
                                                                 scratch for "IMAGINATION"; the last chord is still
                                                                 ringing when the phone buzzes again

Seamless by construction: everything is rendered over three cycles (111 s) with every noise source built from one
37 s tile repeated, envelopes periodic, events placed in every cycle, the reverb circular, and the middle cycle cut.
FluidSynth renders the same three-cycle MIDI (its own reverb and chorus off), so note tails cross the seam naturally.

    python3 score.py        (numpy, scipy, soundfile; fluidsynth + /usr/share/sounds/sf2/FluidR3_GM.sf2; ffmpeg)
Writes score.wav (48 kHz / 24-bit / stereo, exactly 37.000 s) and verification.txt.
"""
import os
import struct
import subprocess
import tempfile

import numpy as np
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
SF2 = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
SR = 48000
D = 37.0
N = int(round(SR * D))
CYC = 3
NT = N * CYC
TARGET_LUFS = -20.0
CEIL_DB = -1.6
t_all = np.arange(NT) / SR
tl = np.mod(t_all, D)
RNG = np.random.default_rng(1)


def sstep(a, b, x):
    u = np.clip((x - a) / (b - a), 0, 1)
    return u * u * (3 - 2 * u)


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


def every(buf, t0, sig):
    for c in range(CYC):
        place(buf, c * D + t0, sig)


def tiled(seed, ch=2):
    r = np.random.default_rng(seed)
    return np.tile(r.standard_normal((ch, N)), (1, CYC))


def circ(fn, x):
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
    """a periodic envelope from (loop time, value) points"""
    p = sorted(points)
    xs = np.array([q[0] for q in p] + [p[0][0] + D])
    ys = np.array([q[1] for q in p] + [p[0][1]])
    return np.interp(tl, xs, ys, period=D)


def tone(f_target, ph0=0.0):
    f = round(f_target * D) / D
    return np.sin(2 * np.pi * f * t_all + ph0)


def env_ad(n, att, dec):
    tt = np.arange(n) / SR
    return np.clip(tt / max(att, 1e-4), 0, 1) * np.exp(-np.maximum(tt - att, 0) / dec)


def noise(n, seed):
    return np.random.default_rng(seed).standard_normal(n)


def click(dur, f0, f1, decay, amp, seed, thump=0.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    s = bp(noise(n, seed), f0, f1, 2) * np.exp(-tt / decay)
    if thump:
        s += thump * lp(noise(n, seed + 1), 220, 2) * np.exp(-tt / 0.03)
    s[:16] *= np.linspace(0, 1, 16)
    return s * amp


def hz(note):
    names = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
    n, o = note[:-1], int(note[-1])
    return 440.0 * 2 ** ((names[n] + 12 * (o + 1) - 69) / 12)


def midi(note):
    return int(round(69 + 12 * np.log2(hz(note) / 440.0)))


# ------------------------------------------------------------------ the picture's clock (kept in step with the piece)
BEATS = []
x, iv = 7.3, 0.95
while x < 19.6:
    BEATS.append((x, iv))
    x += iv
    iv = max(0.42, iv * 0.955)
WH_FACE = [('LATER??', 7.5), ('WHAT DID I DO', 8.1), ('IS IT BAD', 8.7), ("THEY'RE", 9.2), ('ANGRY', 9.45), ('I KNEW IT', 9.9)]
WH_ROOM = [('LATER', 11.0), ('TALK ABOUT WHAT', 11.8), ('YOU MESSED UP', 12.6), ('THEY KNOW', 13.3), ('IT IS BAD', 14.2), ('LATER', 15.0),
           ('LATER', 16.0), ('WHAT DID I DO', 16.8), ('TOO LATE', 17.6)]
PANELS = [13.5, 15.0, 16.5]
GIANT_EYES = 16.6
FOUND = []

# ------------------------------------------------------------------ room tone: always there, so the seam sits in it
air = circ(lambda x: lp(x, 900, 2), tiled(11)) * 0.010 + circ(lambda x: bp(x, 60, 160, 2), tiled(12)) * 0.012
calm = penv([(0, 1), (4.5, 1), (6.5, 0.35), (19.3, 0.2), (21.6, 0.7), (25.6, 1.0)])
air *= calm

fx = np.zeros((2, NT))
mus = np.zeros((2, NT))   # synthesised musical/ambient layers

# ------------------------------------------------------------------ the phone: chime, buzz, whoosh


def bell(f, dur, amp, seed=0, detune=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    s = np.zeros(n)
    for r, a, tau in [(1, 1.0, 0.9), (2.0, 0.35, 0.5), (2.76, 0.25, 0.35), (5.4, 0.12, 0.18), (8.9, 0.05, 0.08)]:
        s += a * np.sin(2 * np.pi * f * r * detune * tt) * np.exp(-tt / tau)
    s *= np.clip(tt / 0.002, 0, 1)
    return s * amp


def buzz(dur, amp, seed):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = 172 + 3 * np.sin(2 * np.pi * 7 * tt)
    ph = 2 * np.pi * np.cumsum(f) / SR
    motor = np.tanh(3 * np.sin(ph)) * 0.6 + 0.25 * np.sin(2 * ph)
    rattle = bp(noise(n, seed), 900, 4200, 2) * (0.5 + 0.5 * np.sign(np.sin(ph))) * 0.5
    s = lp(motor, 1600, 2) + rattle
    e = np.clip(tt / 0.012, 0, 1) * np.clip((dur - tt) / 0.03, 0, 1)
    return s * e * amp


T_CHIME = D - 0.53
every(fx, T_CHIME, pans(bell(hz('E6'), 1.6, 0.11), 0.15))
every(fx, T_CHIME + 0.13, pans(bell(hz('B6'), 1.8, 0.09), 0.2))
for (b0, b1) in [(D - 0.55, D + 0.15), (0.55, 1.05)]:
    every(fx, b0, pans(buzz(b1 - b0, 0.11, 21), 0.2))
FOUND.append(f'chime {T_CHIME:.2f}; buzz {D - 0.55:.2f}-{0.15:.2f} and 0.55-1.05')
n = int(1.4 * SR)
tt = np.arange(n) / SR
wh = bp(noise(n, 31), 300, 3000, 2) * np.sin(np.pi * np.clip(tt / 1.4, 0, 1)) ** 2 * 0.05
every(fx, D - 0.35, pans(wh, 0.0))

# ------------------------------------------------------------------ the typing dots, the drops


def blip(f0, f1, dur, amp):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = f0 + (f1 - f0) * (tt / dur)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / dur) ** 2 * amp


def plip(amp, seed, f0=1500, f1=420):
    n = int(0.12 * SR)
    tt = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-tt / 0.012)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.045)
    s += bp(noise(n, seed), 2000, 6000, 2) * np.exp(-tt / 0.004) * 0.3
    return s * amp


for t0 in (3.95, 5.75, 22.2):
    every(fx, t0, pans(blip(820, 1180, 0.07, 0.05), -0.1))
    every(fx, t0 + 0.09, pans(blip(1000, 1400, 0.06, 0.035), -0.1))
for k, t0 in enumerate([5.08, 5.15, 5.23]):
    every(fx, t0, pans(plip(0.09, 40 + k), -0.3 + k * 0.3))
for k, t0 in enumerate([6.72, 6.79, 6.87]):
    every(fx, t0, pans(plip(0.1, 50 + k, 900, 160), -0.3 + k * 0.3))

# ------------------------------------------------------------------ dread: drone, heartbeat, whispers, ticks, cracks
dread = penv([(0, 0), (4.6, 0), (5.1, 0.12), (7.2, 0.3), (10.6, 0.5), (16.0, 0.8), (19.3, 1.0), (19.45, 0.22), (21.6, 0.06), (22.6, 0), (36.9, 0)])
drone = (tone(36.7) + 0.9 * tone(38.9, 1.0) + 0.5 * tone(73.4, 2.0) + 0.35 * tone(77.8, 0.5)) * 0.05
drone = np.vstack([drone, drone]) + circ(lambda x: lp(x, 110, 2), tiled(61)) * 0.25
mus += drone * dread * (0.85 + 0.15 * tone(0.75))
# a sour pad that thickens through the spiral
pad = np.zeros(NT)
for f, a in [(hz('D3'), 1.0), (hz('Eb3'), 0.8), (hz('A3'), 0.5), (hz('Bb3'), 0.4), (hz('D4'), 0.3)]:
    for h in range(1, 6):
        pad += a / h * tone(f * h * (1 + 0.0015 * h), h * 0.7)
pad = circ(lambda x: lp(x, 1400, 2), pad[None, :])[0]
padenv = penv([(0, 0), (10.0, 0), (12.0, 0.25), (17.5, 0.9), (19.35, 1.0), (19.5, 0), (36.9, 0)])
mus += np.vstack([pad, pad]) * padenv * 0.022


def heart(amp, seed):
    n = int(0.35 * SR)
    tt = np.arange(n) / SR
    lub = (np.sin(2 * np.pi * 52 * tt) + 0.4 * np.sin(2 * np.pi * 104 * tt)) * np.clip(tt / 0.006, 0, 1) * np.exp(-tt / 0.07)
    lub += lp(noise(n, seed), 180, 2) * np.exp(-tt / 0.03) * 2.0
    return lub * amp


for k, (b, iv) in enumerate(BEATS):
    lvl = 0.13 + 0.15 * min(1, (b - 7.3) / 11)
    if b > 19.4:
        lvl *= 0.4
    every(fx, b, pans(heart(lvl, 70 + k), 0.0))
    every(fx, b + min(0.24, iv * 0.36), pans(heart(lvl * 0.7, 170 + k), 0.0))
FOUND.append(f'{len(BEATS)} heartbeats {BEATS[0][0]:.2f}..{BEATS[-1][0]:.2f}')


def whisper_voice(seed, dur, rate):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    r = np.random.default_rng(seed)
    src = noise(n, seed)
    v = bp(src, 500, 1100, 2) * 0.8 + bp(src, 1500, 2600, 2) * 0.6 + bp(src, 4000, 8000, 2) * 0.35
    syl = np.clip(np.sin(2 * np.pi * rate * tt + r.uniform(0, 6)), 0, 1) ** 2
    phrase = np.clip(np.sin(2 * np.pi * r.uniform(0.3, 0.6) * tt + r.uniform(0, 6)) + 0.3, 0, 1)
    return v * syl * phrase * np.sin(np.pi * tt / dur) ** 0.5


wh_env = penv([(0, 0), (7.4, 0), (9.5, 0.4), (11.2, 0.5), (14.0, 0.75), (19.3, 1.0), (19.42, 0.0), (36.9, 0)])
whisp = np.zeros((2, NT))
for k in range(14):
    r = np.random.default_rng(300 + k)
    t0 = 7.4 + r.uniform(0, 10.5)
    dur = min(19.4 - t0 + 0.1, r.uniform(1.6, 4.0))
    if dur < 0.6:
        continue
    every(whisp, t0, pans(whisper_voice(310 + k, dur, r.uniform(3.5, 6.5)) * 0.05, r.uniform(-0.9, 0.9)))
fx += whisp * np.maximum(wh_env, 0.0)


def scratch(dur, amp, seed):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    r = np.random.default_rng(seed)
    e = np.zeros(n)
    x0 = 0
    while x0 < n:
        L = int(r.uniform(0.04, 0.09) * SR)
        e[x0:x0 + L] = np.sin(np.pi * np.arange(min(L, n - x0)) / L) ** 0.6
        x0 += L + int(r.uniform(0.01, 0.04) * SR)
    s = bp(noise(n, seed), 1800, 7000, 2) * (0.7 + 0.3 * np.sin(2 * np.pi * 37 * tt))
    return s * e * amp


for k, (w, t0) in enumerate(WH_FACE + WH_ROOM):
    dur = 0.08 * len(w) + 0.15
    every(fx, t0, pans(scratch(dur, 0.045, 400 + k), ((k * 0.37) % 1.4) - 0.7))
every(fx, 30.95, pans(scratch(0.95, 0.03, 499), 0.1))
FOUND.append('pen scratches at ' + ' '.join(f'{t0:.1f}' for _, t0 in WH_FACE + WH_ROOM) + ' and 30.95')

# the clock: ticks at every quarter turn of its racing hands (the picture's turn = 0.25 tt + 0.11 tt^2)
tt_ = np.linspace(0, 19.4 - 10.8, 20000)
turn = 0.25 * tt_ + 0.11 * tt_ ** 2
ticks = [10.8 + tt_[i] for i in range(1, len(tt_)) if np.floor(turn[i] * 4) > np.floor(turn[i - 1] * 4)]
for k, t0 in enumerate(ticks):
    every(fx, t0, pans(click(0.03, 2200, 6500, 0.003, 0.07, 500 + k % 50, thump=0.15), -0.55))
FOUND.append(f'{len(ticks)} clock ticks from 10.8, last interval {ticks[-1] - ticks[-2]:.3f}s')

# the floor cracking: sparse snaps then a crackle
r = np.random.default_rng(600)
for k in range(140):
    t0 = 12.0 + 5.2 * r.uniform() ** 0.7
    every(fx, t0, pans(click(0.04, 700, 5000, 0.004 + 0.006 * r.uniform(), 0.02 + 0.05 * r.uniform(), 610 + k, thump=0.3 * r.uniform()), r.uniform(-0.6, 0.6)))
for t0 in (12.1, 13.0, 14.2, 15.6):
    every(fx, t0, pans(click(0.4, 300, 5000, 0.03, 0.12, 700 + int(t0 * 10), thump=0.7), 0.0))

# imagined scenes: a stab and a paper slap
for k, t0 in enumerate(PANELS):
    n = int(0.25 * SR)
    sl = bp(noise(n, 800 + k), 250, 2500, 2) * env_ad(n, 0.003, 0.05) * 0.16
    every(fx, t0, pans(sl, [-0.4, -0.3, 0.4][k]))

# the phone rises: rumble; its eyes open: the chime, slowed and sour
rum = circ(lambda x: lp(x, 140, 2), tiled(90)) * penv([(0, 0), (15.3, 0), (17.4, 1.0), (19.35, 1.2), (19.5, 0), (36.9, 0)]) * 0.075
fx += rum
every(fx, GIANT_EYES, pans(bell(hz('E6') / 2.83, 3.0, 0.09, detune=1.0) + bell(hz('F6') / 2.83, 3.0, 0.07), 0.25))

# tinnitus at the peak, ringing on into the breath
tin = tone(6810) * penv([(0, 0), (17.2, 0), (19.3, 0.016), (20.2, 0.012), (21.2, 0.0), (36.9, 0)])
fx += np.vstack([tin, tin * 0.9])

# ------------------------------------------------------------------ the breath, the reply


def breath(dur, f0, f1, amp, seed, rising):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    e = np.sin(np.pi * tt / dur) ** 1.5 * ((tt / dur) ** 0.6 if rising else (1 - tt / dur) ** 0.4 + 0.2)
    return bp(noise(n, seed), f0, f1, 2) * e * amp


every(fx, 19.72, pans(breath(0.86, 500, 3200, 0.10, 901, True), 0))
every(fx, 20.72, pans(breath(0.7, 250, 1500, 0.12, 902, False), 0))
for k in range(10):
    every(fx, 21.6 + k * 0.045, pans(click(0.02, 2500, 8000, 0.0025, 0.05, 950 + k, thump=0.1), 0.25))
n = int(0.25 * SR)
tt = np.arange(n) / SR
every(fx, 22.06, pans(bp(noise(n, 960), 1200, 6000, 2) * np.sin(np.pi * tt / 0.25) ** 2 * 0.05, 0.3))

# the burn: a soft fire crackle from the reply until the room is clear
burn_env = penv([(0, 0), (22.55, 0), (23.0, 1.0), (25.6, 0.8), (27.3, 0.0), (36.9, 0)])
r = np.random.default_rng(1000)
for k in range(220):
    t0 = 22.6 + 4.6 * r.uniform()
    a = float(np.interp(t0 % D, tl[:N][::480], burn_env[:N][::480]))
    every(fx, t0, pans(click(0.03, 600, 4000, 0.003 + 0.004 * r.uniform(), (0.02 + 0.05 * r.uniform()) * a, 1010 + k), r.uniform(-0.8, 0.8)))
fx += circ(lambda x: bp(x, 200, 1200, 2), tiled(1100)) * burn_env * 0.02

# ------------------------------------------------------------------ the music (FluidSynth)
PIANO, STR, CEL, MAR, PIZZ, TREM, HARP = 0, 1, 2, 3, 4, 5, 6
PROGS = {PIANO: 0, STR: 48, CEL: 8, MAR: 12, PIZZ: 45, TREM: 44, HARP: 46}
NOTES = []   # (t, ch, note, vel, len)
# the calm: the quote's phrase in D, the last chord still ringing at the buzz
Q = [(27.8, ['D3', 'A3', 'C#4', 'F#4'], 'F#5'), (29.8, ['B2', 'F#3', 'A3', 'D4'], 'D5'), (31.8, ['G2', 'D3', 'F#3', 'B3'], 'B4'), (33.8, ['A2', 'D3', 'E3', 'A3'], 'A4')]
for (t0, ch, mel) in Q:
    for k, nn in enumerate(ch):
        NOTES.append((t0 + k * 0.09, PIANO, nn, 62 - k * 3, 2.2))
    NOTES.append((t0 + 0.5, PIANO, mel, 74, 1.6))
NOTES += [(30.8, PIANO, 'E5', 66, 1.0), (32.8, PIANO, 'C#5', 64, 1.0), (34.8, PIANO, 'C#4', 58, 1.0)]
NOTES += [(35.8, PIANO, 'D3', 60, 3.2), (35.9, PIANO, 'A3', 56, 3.0), (36.0, PIANO, 'F#4', 56, 3.0), (36.15, PIANO, 'D5', 60, 2.8)]
for (t0, ch, mel) in Q:
    NOTES.append((t0, STR, ch[0], 48, 2.1))
    NOTES.append((t0, STR, ch[-1], 42, 2.1))
# after the buzz the calm hesitates: two unresolved chords, then nothing
NOTES += [(1.35 + k * 0.1, PIANO, nn, 52 - k * 3, 1.8) for k, nn in enumerate(['G2', 'D3', 'F#3', 'B3'])]
NOTES += [(1.85, PIANO, 'A4', 54, 1.2)]
NOTES += [(3.1 + k * 0.1, PIANO, nn, 44 - k * 3, 2.4) for k, nn in enumerate(['E3', 'B3', 'D4', 'G4'])]
NOTES += [(1.35, STR, 'G3', 36, 2.0), (3.1, STR, 'E3', 30, 2.4)]
NOTES += [(30.95, CEL, 'A6', 34, 1.2), (31.15, CEL, 'F#6', 30, 1.2), (31.35, CEL, 'D6', 28, 1.4)]
# the dread: tremolo strings, a slow crescendo in repeated attacks
for k, t0 in enumerate(np.arange(10.6, 19.3, 1.45)):
    v = int(34 + 7 * k)
    NOTES += [(t0, TREM, 'D3', v, 1.5), (t0, TREM, 'D#3', v - 6, 1.5)]
    if t0 > 15.0:
        NOTES += [(t0, TREM, 'A5', v - 18, 1.5), (t0, TREM, 'A#5', v - 22, 1.5)]
for k, t0 in enumerate(PANELS):   # stabs
    for nn in (['C#4', 'D4', 'G#4', 'A4'], ['D4', 'D#4', 'A4', 'A#4'], ['C4', 'C#4', 'F#4', 'G4'])[k]:
        NOTES.append((t0, STR, nn, 64, 0.35))
NOTES.append((6.7, TREM, 'D2', 54, 0.6))
# the reply: pops, a D major swell, the cake's sparkle
NOTES += [(22.6, MAR, 'A5', 70, 0.4), (22.68, MAR, 'D6', 74, 0.5), (23.3, MAR, 'B5', 70, 0.4), (23.38, MAR, 'E6', 74, 0.5),
          (23.75, MAR, 'D6', 72, 0.4), (23.82, MAR, 'F#6', 74, 0.4), (23.9, MAR, 'A6', 78, 0.6)]
for k, nn in enumerate(['D3', 'A3', 'F#4', 'A4', 'D5']):
    NOTES.append((22.62 + k * 0.12, STR, nn, 50, 3.4))
for k, nn in enumerate(['D4', 'F#4', 'A4', 'D5', 'F#5']):
    NOTES.append((22.65 + k * 0.1, HARP, nn, 58, 2.5))
NOTES += [(23.8 + k * 0.07, CEL, nn, 46, 1.2) for k, nn in enumerate(['A5', 'D6', 'F#6', 'A6', 'D7'])]
# the laugh: a little pizzicato giggle, then home
for k, nn in enumerate(['A4', 'D5', 'F#5', 'E5', 'F#5', 'A5', 'D6']):
    NOTES.append((25.65 + k * 0.16 + (0.1 if k > 3 else 0), PIZZ, nn, 64 - k * 2, 0.3))
NOTES += [(26.9, STR, 'D4', 34, 1.4), (26.9, STR, 'F#4', 30, 1.4)]


def write_midi(path, notes, cycles):
    tpq, tempo = 480, 500000
    tps = tpq * 1e6 / tempo
    ev = []
    for ch, prg in PROGS.items():
        ev.append((0, bytes([0xC0 | ch, prg])))
        ev.append((0, bytes([0xB0 | ch, 7, 100])))
        ev.append((0, bytes([0xB0 | ch, 91, 0])))
        ev.append((0, bytes([0xB0 | ch, 93, 0])))
    for c in range(cycles):
        for (t, ch, nt, vel, ln) in notes:
            on = int(round((c * D + t) * tps))
            ev.append((on, bytes([0x90 | ch, midi(nt), int(vel)])))
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
    data += vlq(int((cycles * D + 5) * tps) - last) + b'\xff\x2f\x00'
    with open(path, 'wb') as f:
        f.write(b'MThd' + struct.pack('>IHHH', 6, 0, 1, tpq) + b'MTrk' + struct.pack('>I', len(data)) + data)


with tempfile.TemporaryDirectory() as td:
    mp, wp = os.path.join(td, 'score.mid'), os.path.join(td, 'score.wav')
    write_midi(mp, NOTES, CYC)
    subprocess.run(['fluidsynth', '-ni', '-q', '-R', '0', '-C', '0', '-g', '0.6', '-r', str(SR), '-F', wp, SF2, mp], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    m, msr = sf.read(wp, always_2d=True)
    assert msr == SR
m = m.T
inst = np.zeros((2, NT))
k = min(NT, m.shape[1])
inst[:, :k] = m[:, :k]
if m.shape[1] > NT:
    inst[:, :m.shape[1] - NT] += m[:, NT:]


# ------------------------------------------------------------------ space and mix
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


dry = air * 1.6 + fx + mus + inst * 1.1
wet = hall(inst * 0.8 + fx * 0.35 + mus * 0.4, 2.6, 9, 3800)
mix = dry * 0.85 + wet * 0.38
mix = circ(lambda x: hp(x, 30, 2), mix)
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


def soft_limit(x, ceil_db):
    """gentle peak control (periodic, so the seam is untouched): a smoothed gain that dips only where peaks exceed the ceiling"""
    c = 10 ** (ceil_db / 20)
    a = np.max(np.abs(x), axis=0)
    need = np.minimum(1.0, c / np.maximum(a, 1e-9))
    w = int(0.004 * SR)
    g = -signal.lfilter(np.ones(w) / w, [1], -np.concatenate([need, need, need]))[N:2 * N]
    g = np.minimum(g, need)
    k = np.hanning(2 * w + 1)
    k /= k.sum()
    gg = np.convolve(np.concatenate([g, g, g]), k, mode='same')[N:2 * N]
    return x * np.minimum(gg, 1.0)


for it in range(3):
    L = lufs(out)
    out *= 10 ** ((TARGET_LUFS - L) / 20)
    out = soft_limit(out, CEIL_DB - 0.3)
tp = true_peak_db(out)
if tp > CEIL_DB:
    out *= 10 ** ((CEIL_DB - tp) / 20)
L2, tp2 = lufs(out), true_peak_db(out)
path = os.path.join(HERE, 'score.wav')
sf.write(path, out.T, SR, subtype='PCM_24')

# ------------------------------------------------------------------ verification
back_, sr = sf.read(path, always_2d=True)
back_ = back_.T
lines = ['CAN WE TALK LATER? - sound verification (measured on the written score.wav)', '']
lines.append(f'duration: {back_.shape[1]} frames = {back_.shape[1] / sr:.6f} s at {sr} Hz, {back_.shape[0]} ch, PCM_24')
lines += ['cues: ' + f for f in FOUND]
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
loc = np.array([np.sum(hpx[:, (N // 2) + k * w:(N // 2) + (k + 1) * w] ** 2) for k in range(-100, 100) if abs(k) > 2])
lines.append(f'click test (>6 kHz energy, 5 ms windows): seam window {10 * np.log10(seam_e + 1e-30):.1f} dB vs the surrounding 1 s: median {10 * np.log10(np.median(loc) + 1e-30):.1f} dB, max {10 * np.log10(loc.max() + 1e-30):.1f} dB')
ok_seam = seam.max() <= np.percentile(d_all, 99.9) and seam_e <= max(loc.max(), np.percentile(e, 99))
try:
    rr2 = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-stream_loop', '1', '-i', path, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    summ = [l.strip() for l in rr2.stderr.splitlines() if l.strip().startswith(('I:', 'LRA:', 'Peak:'))]
    lines.append('ffmpeg ebur128 (two loops): ' + ' | '.join(summ[-3:]))
except Exception as ex:  # noqa
    lines.append('ffmpeg ebur128 unavailable: ' + str(ex))
lines.append('')
lines.append(('PASS' if ok_seam else 'CHECK') + '  seamless loop: no step or click at the seam beyond ordinary programme content')
lines.append(('PASS' if back_.shape[1] == N else 'FAIL') + '  exactly 37.000 s')
lines.append(('PASS' if abs(L2 - TARGET_LUFS) < 0.5 and tp2 < -1.0 else 'CHECK') + f'  loudness {L2:.2f} LUFS (target {TARGET_LUFS}), true peak {tp2:.2f} dBTP (< -1)')
txt = '\n'.join(lines)
print(txt)
open(os.path.join(HERE, 'verification.txt'), 'w').write(txt + '\n')
