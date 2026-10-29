#!/usr/bin/env python3
"""ultrathink - a Fable Saga short - playful hybrid orchestral score (15.000 s).

Built on the Fable part III / part IV score.py machinery: composes the score in code, writes score.mid,
renders it with fluidsynth + FluidR3_GM (attack-lead compensated per patch), adds a synthesized hybrid layer
(sub booms, anvil/pan clanks, a blade "boing", the mustard "plip", a time-freeze shimmer, risers, reverse
cymbals, a chiptune "item get" wink, shatter), hall reverb, bus glue and mastering, and writes score.wav
(48 kHz / 24-bit / stereo, exactly 15.000 s) plus a measured verification report.

Two render segments so nothing rings across the breath before the dash:
  A 0-10.8 (hard stop: silence 10.80-10.93), B 10.8-15.0 (final chord rings out to silence by 15.0).

Shape (D major, tick-tock ~120 bpm, beat grid 0.1 + 0.5 n)
  0.0-1.6   curious: pizzicato + celesta, woodblock tick-tock
  1.6 2.6   CLANK stabs (low pizz, muted trumpets, woodblock, pan/anvil, small sub) - the second bigger
  2.6-4.0   the blade sticks ("boing"), yank ("pop"), a deflated bassoon falling figure (A G# G F#~)
  4.0-6.0   a held high violin A6; 5.3 the drop whistles down, 5.6 "plip" (celesta + glock + bloop)
  6.0       time stops: soft whoosh-boom into a D Lydian shimmer (tremolo, choir, synth shimmer)
  6.35-10   the search: an accelerating celesta/harp arpeggio over a climbing bass D E F# G G# A
  10.0      "found it": bright D major sting (glock, triangle, trumpets, chiptune item-get)
  11.0      HIT: the hero theme D-A-B-A-D' (1-5-6-5-8) on brass, D held through the dash
  11.8      the biggest HIT on the theme's A (F major, bIII), cymbals + timpani, blocks tumble (xylophone)
  12.1 12.25 B (G) - A (A7) pickups, 12.4 D' on the final D major chord, ringing to silence by 15.0

    python score.py
Needs: fluidsynth, ffmpeg, numpy, scipy, soundfile.
"""
import os, sys, struct, subprocess, tempfile, shutil
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import soundfile as sf
from scipy import signal
from scipy.ndimage import minimum_filter1d

HERE = os.path.dirname(os.path.abspath(__file__))
SF2 = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
SCRATCH = '/tmp/claude-0/-home-user-brain/f1f7475c-3827-5141-bc67-2671553b043a/scratchpad/music5'
SR = 48000
DUR = 15.0
NS = int(round(SR * DUR))
SEGS = [(0.0, 10.8, 'cut'), (10.8, DUR, 'ring')]
SILENT = [(10.80, 10.93)]          # digital silence re-applied after mastering (the breath)
END_ZERO = 14.86                   # digital zero from here to the end
RNG = np.random.default_rng(1515)

# --------------------------------------------------------------------------- pitches
_PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def P(s):
    if isinstance(s, (int, np.integer)):
        return int(s)
    n, i = _PC[s[0]], 1
    while i < len(s) and s[i] in '#b':
        n += 1 if s[i] == '#' else -1
        i += 1
    return n + 12 * (int(s[i:]) + 1)


def pc(name):
    return P(name + '0') % 12


QUAL = {'M': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'm7': [0, 3, 7, 10], 'sus4': [0, 5, 7]}

# --------------------------------------------------------------------------- channels
VLN, LOW, CB, TREM, PIZZ, WIND, HORN, TPT, TBN, DR, TUBA, CHOIR, TIMP, GLOCK, KEYS, HARP = range(16)
NAMES = ['violins', 'violas+celli', 'contrabass', 'tremolo strings', 'pizzicato', 'bassoon',
         'french horns', 'trumpets (muted -> open)', 'trombones', 'percussion kit', 'tuba', 'choir', 'timpani',
         'glockenspiel/xylophone', 'celesta', 'harp']
INIT_PROG = {VLN: 48, LOW: 48, CB: 43, TREM: 44, PIZZ: 45, WIND: 70, HORN: 60, TPT: 59, TBN: 57,
             TUBA: 58, CHOIR: 53, TIMP: 47, GLOCK: 9, KEYS: 8, HARP: 46}
VOL = {VLN: 106, LOW: 104, CB: 110, TREM: 96, PIZZ: 108, WIND: 110, HORN: 110, TPT: 100, TBN: 104,
       DR: 104, TUBA: 106, CHOIR: 116, TIMP: 118, GLOCK: 92, KEYS: 112, HARP: 106}
PAN = {VLN: 38, LOW: 82, CB: 92, TREM: 52, PIZZ: 74, WIND: 58, HORN: 46, TPT: 76, TBN: 84,
       DR: 64, TUBA: 74, CHOIR: 64, TIMP: 54, GLOCK: 70, KEYS: 86, HARP: 34}
BEND_RANGE = {VLN: 12, LOW: 12, TREM: 12, TBN: 12, WIND: 12}
STEMS = {'strings': [VLN, LOW, CB, TREM, PIZZ], 'winds': [WIND], 'brass': [HORN, TPT, TBN, TUBA],
         'choir': [CHOIR], 'keys': [KEYS, HARP, GLOCK], 'perc': [DR, TIMP]}
ALLMEL = [c for c in range(16) if c != DR]
# Attack compensation: time-to-half-amplitude of each FluidR3 patch (s) * ~0.7 (part IV table + the new
# patches measured the same way: celesta 8, glock 9, xylophone 13, bassoon 70, muted trumpet 59).
# Note-ons are sent this much early so the audible attack lands on the cue.
LAT = {48: .055, 49: .10, 44: .06, 45: .035, 43: .05, 40: .045, 42: .12, 60: .038, 56: .008,
       57: .034, 58: .037, 61: .04, 52: .15, 53: .055, 47: 0., 116: 0., 46: 0., 8: 0., 0: 0.,
       68: .022, 73: .029, 19: .01, 9: .004, 13: 0., 70: .016, 59: .008, 71: .03}

NOTES, CCS, BENDS, PROGS, FX = [], [], [], [], []
# notes whose *start* is the point (no attack lead): (ch, t0, t1) - the soft A6 entry, and the 11.0 HIT, which
# comes out of digital silence (a lead there would sound before the hit and pull the onset early)
NOLAT = [(VLN, 3.8, 4.0)] + [(c, 10.9, 11.05) for c in range(16)]


def note(ch, p, t, d, v, jit=0.0):
    if jit:
        t += RNG.uniform(-jit, jit)
        v += RNG.integers(-4, 5)
    NOTES.append((ch, P(p), float(t), float(d), int(np.clip(v, 1, 127))))


def chord(ch, ps, t, d, v, jit=0.0):
    for p in dict.fromkeys(P(q) for q in ps):
        note(ch, p, t, d, v, jit)


def cc(ch, num, t, val):
    CCS.append((float(t), ch, num, int(np.clip(round(val), 0, 127))))


def expr(chs, t, v):
    for c in chs:
        cc(c, 11, t, v)


def ramp(chs, t0, t1, v0, v1, shape=1.0, step=0.03, num=11):
    n = max(2, int((t1 - t0) / step) + 1)
    for i in range(n):
        x = i / (n - 1)
        for c in chs:
            cc(c, num, t0 + x * (t1 - t0), v0 + (v1 - v0) * x ** shape)


def bend_curve(ch, t0, t1, fn, step=0.008):
    rng_ = BEND_RANGE[ch]
    n = max(2, int((t1 - t0) / step) + 1)
    for i in range(n):
        t = t0 + (t1 - t0) * i / (n - 1)
        BENDS.append((t, ch, int(np.clip(8192 + fn(t) / rng_ * 8191, 0, 16383))))


def unbend(chs, t):
    for c in chs:
        BENDS.append((float(t), c, 8192))


def prog(ch, t, p):
    PROGS.append((float(t), ch, p))


def roll(ch, p, t0, t1, v0, v1, rate=17.0, shape=1.0):
    t = t0
    while t < t1:
        x = (t - t0) / max(1e-6, (t1 - t0))
        note(ch, p, t, 0.12, v0 + (v1 - v0) * x ** shape + RNG.integers(-5, 6))
        t += 1.0 / rate * RNG.uniform(0.9, 1.1)


def scale_run(ch, p0, p1, t0, dur, v, steps, nd=0.35, v1=None):
    a, b = P(p0), P(p1)
    ps = [p for p in range(min(a, b), max(a, b) + 1) if (p - a) % 12 in steps]
    if b < a:
        ps = ps[::-1]
    for i, p in enumerate(ps):
        vv = v if v1 is None else v + (v1 - v) * i / max(1, len(ps) - 1)
        note(ch, p, t0 + dur * i / len(ps), nd, vv)


MAJ = {0, 2, 4, 5, 7, 9, 11}
LYD = {0, 2, 4, 6, 7, 9, 11}


def fx(*a):
    FX.append(a)


def tones(root, q):
    r = pc(root) if isinstance(root, str) else root % 12
    return r, QUAL[q]


def at(r, octave):
    return r + 12 * (octave + 1)


def timp_pitch(r):
    p = at(r, 2)
    return p if p >= 38 else p + 12


# --------------------------------------------------------------------------- devices
def clank(t, size):
    """A comic stab for the sword bouncing off the wall: low pizz + woodblock + muted-trumpet 'ouch' cluster
    + pan/anvil clank + sparks + a small sub (gives the onset its low-band edge)."""
    v = int(np.clip(96 + 28 * size, 1, 127))
    chord(PIZZ, ['D2', 'D3'] + (['A2'] if size > 0.6 else []), t, 0.3, v)
    note(LOW, 'D2', t, 0.12, v - 6)
    note(CB, 'D2', t, 0.14, v)
    chord(TPT, ['C5', 'D5'] + (['E5', 'G#4'] if size > 0.6 else []), t, 0.11 + 0.05 * size, v - 4)
    if size > 0.6:
        chord(HORN, ['D3', 'Eb3'], t, 0.16, v - 10)
        chord(TBN, ['D2', 'Ab2'], t, 0.16, v - 10)
        note(TUBA, 'D1', t, 0.18, v - 8)
    note(TIMP, 'D2', t, 0.4, int(84 + 34 * size))
    note(DR, 76, t, 0.2, 127)
    note(DR, 77, t + 0.002, 0.2, 110)
    note(DR, 36, t, 0.2, int(80 + 40 * size))
    if size > 0.6:
        note(DR, 55, t + 0.004, 0.8, 92)
    for i, p in enumerate(['F#7', 'C8', 'A7'][:2 + (size > 0.6)]):
        note(GLOCK, p, t + 0.02 + 0.03 * i, 0.2, 48 + 10 * size)
    fx('bonk', t, 0.55 + 0.35 * size)
    fx('anvil', t, 0.30 + 0.35 * size)
    fx('crack', t + 0.005, 0.18 + 0.2 * size)
    fx('boom', t, 0.22 + 0.25 * size)


def hit(t, size, root, q='M', hold=0.8, top=None, choir=True, cym=(49,), toms=True, tpt=True, strings=True,
        timp2=True, boom=True, bsize=None):
    """Orchestral impact: low brass + strings + choir + timpani + kick/toms + cymbal + sub boom.
    top: a melody pitch doubled on top (trumpet, horns an octave down, violins an octave up)."""
    r, iv = tones(root, q)
    th = iv[1]
    v = int(np.clip(92 + 30 * size, 1, 127))
    b1, b2, b3 = at(r, 1), at(r, 2), at(r, 3)
    if b1 < 26:
        b1 += 12
    note(TUBA, b1, t, hold, v)
    note(TUBA, b2, t, hold, v - 8)
    chord(TBN, [b2, b2 + 7, b3, b3 + th], t, hold, v)
    chord(HORN, [b3, b3 + 7, b3 + 12, b3 + 12 + th], t, hold, v)
    if tpt:
        chord(TPT, [p if p <= 84 else p - 12 for p in [b3 + 12 + th, b3 + 19, b3 + 24]], t, hold * 0.8, v - 4)
    note(CB, b1, t, hold + 0.25, v)
    if strings:
        chord(LOW, [b2, b3, b3 + 7], t, hold + 0.2, v)
        chord(VLN, [p if p <= 93 else p - 12 for p in [b3 + 12 + th, b3 + 19, b3 + 24, b3 + 24 + th]],
              t, hold + 0.2, v - 6)
    if top is not None:
        tp = P(top)
        note(TPT, tp, t, hold, min(127, v + 6))
        note(HORN, tp - 12, t, hold, v)
        if tp + 12 <= 98:
            note(VLN, tp + 12, t, hold + 0.1, v)
    if choir:
        chord(CHOIR, [b3, b3 + 7, b3 + 12, b3 + 12 + th], t, hold + 0.3, v - 6)
    tpp = timp_pitch(r)
    note(TIMP, tpp, t, 1.4, 127)
    if timp2:
        note(TIMP, tpp + 7 if tpp + 7 <= 55 else tpp - 5, t + 0.004, 1.4, int(96 + 24 * min(1, size)))
    note(DR, 36, t, 0.4, 127)
    note(DR, 35, t, 0.4, int(90 + 30 * min(size, 1)))
    if toms:
        note(DR, 41, t + 0.002, 0.5, int(100 + 25 * min(size, 1)))
        note(DR, 43, t + 0.005, 0.5, int(90 + 25 * min(size, 1)))
    for i, cy in enumerate(cym):
        note(DR, cy, t + 0.004 * i, 2.5, int(np.clip(96 + 28 * size, 1, 127)))
    if boom:
        fx('boom', t, size if bsize is None else bsize)


def theme_note(t, p, d, v, layers):
    """one note of the hero theme quote, doubled per layer [(channel, shift, vel delta)]"""
    for ch, sh, dv in layers:
        note(ch, P(p) + sh, t, d, v + dv)


# =========================================================================== THE SCORE
def compose():
    for c in range(16):
        if c in INIT_PROG:
            prog(c, 0.0, INIT_PROG[c])
        cc(c, 7, 0.0, VOL[c]); cc(c, 10, 0.0, PAN[c]); cc(c, 11, 0.0, 100)
        cc(c, 91, 0.0, 0); cc(c, 93, 0.0, 0)
        if c in BEND_RANGE:
            for num, val in [(101, 0), (100, 0), (6, BEND_RANGE[c]), (38, 0), (101, 127), (100, 127)]:
                cc(c, num, 0.0, val)
    curious()
    freeze()
    search()
    payoff()


# --------------------------------------------------------------------------- 0-6: curious / clanks / plip
def curious():
    # 0.0-1.6 light, curious: pizzicato + celesta, a woodblock tick-tock (beats at 0.1 + 0.5 n = 120 bpm)
    expr([PIZZ], 0.0, 84); expr([KEYS], 0.0, 96); expr([HARP], 0.0, 70)
    for t, wb in [(0.1, 76), (0.6, 77), (1.1, 76), (2.1, 77)]:
        note(DR, wb, t, 0.1, 82 if t < 0.5 else 94)
    for t in [0.35, 0.85, 1.35, 1.85, 2.35]:
        note(DR, 75, t, 0.05, 50)                                       # claves, the offbeat 'tick'
    # pizz: bass on the beat, a tip-toe chord on the "and"
    for t, b, up in [(0.1, 'D2', ['F#3', 'A3']), (0.6, 'A1', ['E3', 'G3']), (1.1, 'D2', ['F#3', 'A3'])]:
        note(PIZZ, b if P(b) >= 28 else P(b) + 12, t, 0.25, 82)
        chord(PIZZ, up, t + 0.25, 0.2, 66)
    # celesta: a curious little question, with a chromatic lean
    for t, p, d, v in [(0.1, 'A5', .2, 74), (0.35, 'D6', .2, 78), (0.6, 'C#6', .11, 72), (0.725, 'D6', .11, 74),
                       (0.85, 'F#6', .22, 82), (1.1, 'E6', .11, 76), (1.225, 'F6', .11, 74), (1.35, 'F#6', .1, 80)]:
        note(KEYS, p, t, d, v)
        note(HARP, P(p) - 12, t, d, 58)
    # the wind-up: a quick pizz scoop up into the first swing
    for i, p in enumerate(['A3', 'D4', 'F#4', 'A4']):
        note(PIZZ, p, 1.4 + i * 0.045, 0.12, 70 + 6 * i)

    # 1.6 CLANK (small)
    clank(1.6, 0.4)
    # 1.6-2.6 dazed: a descending celesta "huh?", the tick-tock carries on
    for t, p, d, v in [(1.85, 'B6', .1, 64), (1.975, 'A6', .1, 60), (2.1, 'F#6', .2, 62)]:
        note(KEYS, p, t, d, v)
    note(PIZZ, 'D2', 2.1, 0.25, 76); chord(PIZZ, ['F#3', 'A3'], 2.35, 0.15, 60)
    for i, p in enumerate(['D4', 'F#4', 'A4', 'D5']):                    # a bigger wind-up
        note(PIZZ, p, 2.38 + i * 0.045, 0.12, 76 + 6 * i)
    note(WIND, 'D3', 2.36, 0.2, 70); note(WIND, 'A3', 2.45, 0.08, 78)

    # 2.6 CLANK (bigger); the sword sticks: the blade wobbles (boing), the hero yanks it free (pop)
    clank(2.6, 0.68)
    fx('boing', 2.64, 0.5, 0.75, 310.0)
    fx('pop', 3.0, 0.6)
    note(DR, 77, 3.0, 0.1, 70)
    # 3.05-4.3 deflated: bassoon (doubled by low pizz) falls A G# G F#, the last note droops and wobbles
    expr([WIND], 2.9, 104)
    for t, p, d in [(3.05, 'A3', .2), (3.3, 'G#3', .2), (3.55, 'G3', .2), (3.8, 'F#3', .55)]:
        note(WIND, p, t, d, 92)
        note(PIZZ, P(p) - 12, t, 0.25, 72)
        note(LOW, P(p) - 12, t, d, 52)
    bend_curve(WIND, 3.86, 4.33, lambda t: -1.0 * ((t - 3.86) / 0.47) ** 1.6 + 0.28 * np.sin(2 * np.pi * 6.0 * (t - 3.86)))
    ramp([WIND], 4.0, 4.33, 104, 50)
    unbend([WIND], 4.42)
    note(TIMP, 'A1' if P('A1') >= 38 else 'A2', 3.8, 0.3, 40)

    # 4.0-6.0 eyes closed: the music drops to a held high note (violins A6, very soft), a faint low D
    expr([VLN], 3.8, 30)
    ramp([VLN], 3.8, 4.6, 30, 64, shape=0.8)
    note(VLN, 'A6', 3.8, 2.17, 70)
    chord(TREM, ['A5'], 4.2, 1.75, 44)
    expr([TREM], 4.1, 30); ramp([TREM], 4.2, 5.5, 30, 56)
    fx('drone', 4.0, 6.05, P('D2'), 0.10)
    note(HARP, 'D5', 4.0, 1.0, 48)
    # 5.3 the drop falls (a tiny whistle), 5.6 it lands: "plip" - celesta + glock + a bloop
    fx('dropfall', 5.28, 0.3, 0.6)
    note(KEYS, 'D7', 5.6, 0.5, 116)
    note(KEYS, 'A6', 5.6, 0.5, 96)
    note(GLOCK, 'D7', 5.6, 0.5, 104)
    note(HARP, 'D6', 5.6, 0.6, 84)
    fx('plip', 5.6, 1.0)
    # 5.7-6.0 the blade glows gold: a harp gliss up (Lydian), a sparkle, a reverse swell into the freeze
    expr([HARP], 5.65, 84)
    scale_run(HARP, 'A4', 'A6', 5.72, 0.26, 60, LYD, nd=0.5, v1=86)
    for i, p in enumerate(['E7', 'G#7', 'A7']):
        note(KEYS, p, 5.74 + 0.07 * i, 0.3, 54 + 6 * i)
    fx('sparkle', 5.7, 0.3, 0.35)
    fx('rcym', 6.0, 0.55, 0.55)
    fx('suck', 5.62, 0.38, 0.8)


# --------------------------------------------------------------------------- 6.0: time stops
FREEZE = ['D6', 'A6', 'E7', 'G#7', 'D7', 'F#7', 'A5']


def freeze():
    # 6.0 HIT (soft): whoosh-boom; the world desaturates -> a sustained shimmering D Lydian pad
    soft = [TBN, TUBA, HORN, CB, LOW]
    expr(soft, 5.9, 92)
    chord(TBN, ['D2', 'A2'], 6.0, 1.2, 92)
    note(TUBA, 'D1', 6.0, 1.3, 98)
    note(CB, 'D1', 6.0, 1.18, 96)
    chord(HORN, ['D3', 'A3', 'E4'], 6.0, 1.0, 88)
    chord(LOW, ['D2', 'A2', 'E3'], 6.0, 1.2, 90)
    ramp(soft, 6.3, 7.1, 92, 54)
    note(TIMP, 'D2', 6.0, 1.4, 110); note(TIMP, 'A2', 6.004, 1.2, 80)
    note(DR, 36, 6.0, 0.4, 112)
    note(DR, 57, 6.004, 2.5, 74)
    note(GLOCK, 'D7', 6.0, 1.0, 70); note(GLOCK, 'G#7', 6.0, 1.0, 56)
    fx('boom', 6.0, 0.85)
    fx('subdrop', 6.0, 1.6, 0.35, 58, 24)
    fx('shimmer', 6.0, 8.6, [P(p) for p in FREEZE], 1.0)
    # the frozen pad: tremolo strings + choir (oohs), Lydian (G#), swelling in after the boom
    expr([TREM, CHOIR], 6.0, 40)
    ramp([TREM, CHOIR], 6.05, 7.0, 40, 78, shape=0.8)
    chord(TREM, ['D5', 'A5', 'E6', 'G#6'], 6.0, 1.2, 84)
    chord(CHOIR, ['D4', 'A4', 'E5'], 6.0, 1.2, 84)
    for i, p in enumerate(['D5', 'A5', 'E6', 'G#6', 'D7']):          # a slow, glassy celesta spread
        note(KEYS, p, 6.05 + 0.09 * i, 0.9, 56 - 3 * i)


# --------------------------------------------------------------------------- 6.35-10.0: the search
BUILD = [(6.0, 'D', ['D', 'F#', 'A', 'E', 'G#'], 'D5'),
         (7.2, 'E', ['E', 'G#', 'B', 'F#'], 'B5'),
         (8.0, 'F#', ['F#', 'A', 'C#', 'E'], 'C#6'),
         (8.6, 'G', ['G', 'B', 'D', 'F#'], 'D6'),
         (9.0, 'G#', ['G#', 'B', 'D', 'F#'], 'F#6'),
         (9.4, 'A', ['A', 'D', 'E'], 'E6'),
         (9.7, 'A', ['A', 'C#', 'E', 'G'], 'G6')]
INNER = {7.2: 'G#5', 8.0: 'A5', 8.6: 'B5', 9.0: 'D6', 9.4: 'D6', 9.7: 'E6'}
HORNS = {8.6: ['B3', 'D4'], 9.0: ['B3', 'D4'], 9.4: ['A3', 'D4'], 9.7: ['A3', 'C#4']}
A0, A1 = 6.35, 9.93


def search():
    # chord changes: climbing bass, sustained strings/choir, violins rising line
    for i, (t, bass, pcs, topn) in enumerate(BUILD):
        t1 = BUILD[i + 1][0] if i + 1 < len(BUILD) else 9.97
        d = t1 - t - 0.02
        if t > 6.0:
            b2 = at(pc(bass), 2)
            note(CB, b2 if b2 <= 45 else b2 - 12, t, d, 92)
            note(LOW, b2 + 12 if b2 + 12 <= 57 else b2, t, d, 86)
            note(LOW, at(pc(pcs[1]), 3), t, d, 78)
            trem = sorted({at(pc(p), 5) if at(pc(p), 5) <= at(pc(bass), 5) + 12 else at(pc(p), 4) for p in pcs})
            chord(TREM, [p for p in trem if 64 <= p <= 90], t, d, 84)
            chord(CHOIR, [at(pc(p), 4) for p in pcs[:3]], t, d, 82)
            note(VLN, topn, t, d, 92)
            note(VLN, INNER[t], t, d, 84)
            if t in HORNS:
                chord(HORN, HORNS[t], t, d, 92)
            note(PIZZ, at(pc(bass), 2), t, 0.3, 96)
    expr([CB, LOW], 7.15, 70)
    expr([VLN], 7.1, 50)
    expr([HORN], 8.55, 60)
    ramp([VLN, LOW, CB, HORN], 7.2, 9.95, 60, 112, shape=1.25)
    ramp([TREM, CHOIR], 7.2, 9.95, 78, 108, shape=1.25)
    # the accelerating arpeggio: celesta and harp ping-pong, a rising 19-semitone window, zig-zag search
    expr([KEYS, HARP, PIZZ], A0 - 0.05, 92)
    ramp([KEYS, HARP, PIZZ], 7.0, 9.95, 92, 114)
    t, k = A0, 0
    while t < A1:
        x = (t - A0) / (A1 - A0)
        dt = 0.25 * (0.052 / 0.25) ** (x ** 0.85)
        pcs = [b[2] for b in BUILD if b[0] <= t + 1e-9][-1]
        pset = {pc(p) for p in pcs}
        lo = int(round(62 + 20 * x))
        ps = [p for p in range(lo, lo + 20) if p % 12 in pset]
        m = len(ps)
        per = 2 * (m - 1)
        j = k % per
        p = ps[j if j < m else per - j]
        v = 66 + 36 * x
        a, b = (KEYS, HARP) if k % 2 == 0 else (HARP, KEYS)
        note(a, p, t, max(0.14, 1.6 * dt), v)
        if x > 0.5:
            note(b, p - 12, t, max(0.12, 1.4 * dt), v - 14)                # thickens as the search spreads
        if k % 4 == 0 and t > 6.6:
            note(PIZZ, p - 24 if p - 24 >= 45 else p - 12, t, 0.18, 70 + 30 * x)
        t += dt
        k += 1
    # dead ends dim: little glock blips here and there
    for t, p in [(6.85, 'E7'), (7.45, 'B6'), (7.9, 'G#7'), (8.3, 'C#7'), (8.75, 'F#7'), (9.15, 'B7')]:
        note(GLOCK, p, t, 0.15, 44)
    # build-up: timpani roll on A, riser + reverse cymbal into the "found it" at 10.0
    roll(TIMP, 'A2', 9.4, 9.9, 34, 118, rate=18, shape=1.4)
    fx('riser', 10.0, 1.7, 0.6)
    fx('rcym', 10.0, 1.1, 0.7)
    prog(TPT, 9.0, 56)                                                    # mutes out for the payoff
    prog(CHOIR, 9.5, 52)

    # 10.0 "FOUND IT": bright D major sting - glock, triangle, celesta, trumpets, harp, a chiptune item-get
    st = [TPT, HORN, TBN, TUBA, VLN, LOW, CB, CHOIR, TREM, KEYS, HARP, GLOCK]
    expr(st, 9.96, 112)
    chord(TPT, ['D5', 'F#5', 'A5'], 10.0, 0.34, 112)
    chord(HORN, ['D4', 'F#4', 'A4', 'D5'], 10.0, 0.4, 108)
    chord(TBN, ['D3', 'A3', 'F#3'], 10.0, 0.36, 100)
    note(TUBA, 'D2', 10.0, 0.36, 100)
    note(CB, 'D2', 10.0, 0.45, 104)
    chord(LOW, ['D3', 'A3'], 10.0, 0.45, 100)
    chord(VLN, ['D6', 'F#6', 'A6'], 10.0, 0.62, 106)
    chord(TREM, ['A6', 'D7'], 10.0, 0.7, 84)
    chord(CHOIR, ['D4', 'F#4', 'A4', 'D5'], 10.0, 0.55, 96)
    chord(KEYS, ['D6', 'F#6', 'A6', 'D7'], 10.0, 0.7, 104)
    chord(GLOCK, ['D7', 'F#7', 'A7'], 10.0, 0.7, 104)
    scale_run(HARP, 'D4', 'D7', 10.0, 0.28, 84, MAJ, nd=0.7, v1=100)
    note(TIMP, 'D2', 10.0, 0.8, 116)
    note(DR, 36, 10.0, 0.3, 112)
    note(DR, 81, 10.0, 1.2, 122)                                          # open triangle: ding!
    note(DR, 49, 10.004, 1.2, 84)
    fx('boom', 10.0, 0.5)
    fx('chip', 10.02, [74, 78, 81, 86, 90, 93, 98], 0.038, 1.0)
    fx('sparkle', 10.05, 0.6, 0.6)
    ramp(st, 10.3, 10.75, 112, 70)


# --------------------------------------------------------------------------- 11.0-15.0: the payoff
LAY = [(TPT, 0, 0), (HORN, -12, -4), (VLN, 12, -6)]


def payoff():
    # (10.8-10.93 is digital silence: a breath)
    for c in ALLMEL:
        cc(c, 11, 10.82, 118)
    prog(GLOCK, 10.85, 13)                                                 # xylophone for the falling blocks
    # 11.0 HIT: time restarts, the dash - the hero theme's D held on trumpets/horns through the cut
    hit(11.0, 0.95, 'D', 'M', hold=0.55, choir=False, cym=(49,))
    note(TPT, 'D5', 11.0, 0.77, 116); note(HORN, 'D4', 11.0, 0.77, 112); note(HORN, 'D5', 11.0, 0.77, 100)
    ramp([TPT, HORN], 11.15, 11.75, 112, 127)
    scale_run(VLN, 'D5', 'D7', 11.06, 0.62, 96, MAJ, nd=0.18, v1=122)      # the dash along the path
    scale_run(HARP, 'D4', 'D7', 11.05, 0.55, 84, MAJ, nd=0.4, v1=104)
    for k in range(6):                                                    # driving celli/pizz 8ths
        t = 11.2 + 0.1 * k
        note(LOW, 'D3', t, 0.08, 96 + 4 * k); note(PIZZ, 'D2', t, 0.15, 96 + 4 * k)
    for i, (t, d) in enumerate([(11.4, 45), (11.5, 43), (11.6, 41)]):        # tom fill (ends 0.2 s early)
        note(DR, d, t, 0.2, 90 + 10 * i)
    roll(DR, 38, 11.35, 11.68, 40, 96, rate=22)                             # snare
    fx('whoosh', 11.04, 0.45, 0.9)
    fx('zap', 11.0, 0.5)
    fx('rcym', 11.8, 0.6, 0.9)

    # 11.8 the BIGGEST HIT: the wall shatters - on the theme's A (F major), crash + china + timpani
    prog(CHOIR, 11.0, 52)
    expr(ALLMEL, 11.77, 127)
    hit(11.8, 1.25, 'F', 'M', hold=0.28, top='A5', cym=(49, 57, 52), bsize=0.95)
    note(DR, 55, 11.81, 1.5, 110)
    fx('shatter', 11.8, 0.9)
    fx('crack', 11.8, 0.6)
    fx('quake', 11.8, 12.9, 0.45)
    # the blocks tumble: xylophone cascade + woodblocks, falling and thinning out (playful, not dread)
    t = 11.86
    cascade = [96, 93, 91, 88, 86, 84, 81, 79, 76, 74, 72, 69, 67]
    for i, p in enumerate(cascade):
        note(GLOCK, p, t, 0.12, 104 - 4 * i)
        if i % 2 == 0:
            note(DR, 76 if i % 4 == 0 else 77, t + 0.015, 0.1, 80 - 3 * i)
        t += 0.042 + 0.004 * i
    # 12.1 B (G major) - 12.25 A (A7): the theme's turn, light so the final chord lands clean
    theme_note(12.1, 'B5', 0.14, 116, LAY)
    theme_note(12.25, 'A5', 0.13, 114, LAY)
    for tt_, rt, q in [(12.1, 'G', 'M'), (12.25, 'A', '7')]:
        r, iv = tones(rt, q)
        b2, b3 = at(r, 2), at(r, 3)
        chord(TBN, [b2, b3 + iv[1] - 12 if b3 + iv[1] - 12 > b2 else b3 + iv[1], b2 + 7], tt_, 0.13, 104)
        note(TUBA, at(r, 1), tt_, 0.13, 96)
        chord(LOW, [b2, b2 + 7], tt_, 0.13, 100)
        chord(HORN, [b3 + iv[1], b3 + 7], tt_, 0.13, 100)
        chord(VLN, [b3 + 12 + i for i in iv[1:]], tt_, 0.13, 96)
    note(TIMP, 'G2', 12.1, 0.2, 84)
    roll(TIMP, 'A2', 12.25, 12.33, 70, 90, rate=26)

    # 12.4 D' - the final chord (D major) on the title, ringing out to silence by 15.0
    fin = ALLMEL
    hit(12.4, 1.1, 'D', 'M', hold=2.1, top='D6', cym=(49,), timp2=True)
    note(TPT, 'A5', 12.4, 2.0, 112)
    note(DR, 81, 12.4, 2.0, 100)
    chord(CHOIR, ['D4', 'F#4', 'A4', 'D5'], 12.4, 2.2, 104)
    chord(TREM, ['D6', 'F#6', 'A6'], 12.45, 2.1, 70)
    for i, p in enumerate(['D3', 'A3', 'D4', 'F#4', 'A4', 'D5', 'F#5', 'A5', 'D6']):
        note(HARP, p, 12.4 + i * 0.05, 2.0, 84 + i)
    roll(TIMP, 'D2', 12.9, 13.8, 64, 20, rate=15)
    # a small mustard-drop glint on the title: celesta + chip sparkle
    for i, p in enumerate(['A6', 'D7', 'F#7', 'A7']):
        note(KEYS, p, 12.9 + 0.06 * i, 0.9, 74 - 4 * i)
    fx('sparkle', 12.9, 0.5, 0.35)
    fx('chip', 12.92, [86, 93, 98], 0.05, 0.45)
    ramp(fin, 12.75, 14.6, 127, 0, shape=0.55)
    for c in range(16):
        cc(c, 123, 14.75, 0)


# --------------------------------------------------------------------------- MIDI writing
PPQ = 960
TEMPO_US = 500000            # 120 bpm, 1 tick = 0.5 / 960 s


def sec2tick(t):
    return int(round(max(0.0, t) / (TEMPO_US / 1e6) * PPQ))


def vlq(n):
    b = [n & 0x7f]
    n >>= 7
    while n:
        b.append((n & 0x7f) | 0x80)
        n >>= 7
    return bytes(reversed(b))


def seg_index(t):
    for k, (s0, s1, _) in enumerate(SEGS):
        if s0 <= t < s1:
            return k
    return len(SEGS) - 1


def seg_window(k):
    """(offset, render end) of segment k in seconds: the MIDI for a segment starts 0.6 s before it."""
    s0, s1, mode = SEGS[k]
    off = max(0.0, s0 - 0.6)
    end = DUR if mode == 'ring' else s1
    return off, end


def prog_at(ch, t):
    p = INIT_PROG.get(ch, 0)
    for tt_, c, pp in sorted(PROGS):
        if c == ch and tt_ <= t + 1e-9:
            p = pp
    return p


def build_events(chs=None, seg=None):
    """List of (tick, order, channel, bytes). Applies attack compensation and same-pitch overlap fixes.
    seg=None: the whole score; seg=k: only notes that start in segment k, all times shifted by the
    segment offset; controller/program/bend state from before the offset collapses to tick 0."""
    chs = set(range(16)) if chs is None else set(chs)
    progs = sorted(PROGS)
    off = 0.0 if seg is None else seg_window(seg)[0]
    ev = []
    shifted = []
    for ch, p, t, d, v in NOTES:
        if ch not in chs or (seg is not None and seg_index(t) != seg):
            continue
        lat = 0.0 if ch == DR or any(c == ch and a <= t < b for c, a, b in NOLAT) else LAT.get(prog_at(ch, t), 0.0)
        t0 = max(0.0, t - lat)
        t1 = t0 + max(0.03, d)
        shifted.append([ch, p, t0, t1, v])
    shifted.sort(key=lambda n: (n[0], n[1], n[2]))
    merged = []                                  # unison doublings (same channel+pitch, onsets < 5 ms apart)
    for nt in shifted:                           # become one note: a note-off releases every voice on a key
        a = merged[-1] if merged else None
        if a and a[0] == nt[0] and a[1] == nt[1] and nt[2] - a[2] < 0.005:
            a[3], a[4] = max(a[3], nt[3]), max(a[4], nt[4])
        else:
            merged.append(nt)
    shifted = merged
    for i in range(len(shifted) - 1):
        a, b = shifted[i], shifted[i + 1]
        if a[0] == b[0] and a[1] == b[1] and a[3] > b[2] - 0.002:
            a[3] = max(a[2] + 0.01, b[2] - 0.002)
    for ch, p, t0, t1, v in shifted:
        if not 0 <= p <= 127:
            continue
        ev.append((sec2tick(t1 - off), 1, t1, ch, bytes([0x80 | ch, p, 0])))
        ev.append((sec2tick(t0 - off), 3, t0, ch, bytes([0x90 | ch, p, v])))
    state = {}
    for t, ch, num, val in sorted(CCS, key=lambda e: e[0]):
        if ch not in chs:
            continue
        if t < off:
            if num not in (120, 123):
                state[('cc', ch, num)] = bytes([0xB0 | ch, num, val])
            continue
        ev.append((sec2tick(t - off), 0 if num in (120, 123) else 2, t, ch, bytes([0xB0 | ch, num, val])))
    for t, ch, val in sorted(BENDS, key=lambda e: e[0]):
        if ch not in chs:
            continue
        b = bytes([0xE0 | ch, val & 0x7f, (val >> 7) & 0x7f])
        if t < off:
            state[('pb', ch)] = b
            continue
        ev.append((sec2tick(t - off), 2, t, ch, b))
    for t, ch, p in progs:
        if ch not in chs:
            continue
        b = bytes([0xC0 | ch, p])
        if t < off:
            state[('pg', ch)] = b
            continue
        ev.append((sec2tick(t - off), 0, t, ch, b))
    pre = [(0, -1, -1.0, k[1], b) for k, b in state.items() if k[0] == 'pg']
    pre += [(0, -1, -0.5, k[1], b) for k, b in state.items() if k[0] == 'cc']
    pre += [(0, -1, -0.1, k[1], b) for k, b in state.items() if k[0] == 'pb']
    ev = pre + ev
    ev.sort(key=lambda e: (e[0], e[1], e[2]))
    return [(e[0], e[1], e[3], e[4]) for e in ev]


def write_midi(path, chs=None, seg=None, per_track=True, t_end=None):
    ev = build_events(chs, seg)
    tracks = []
    title = b'ultrathink'
    t0 = bytearray(b'\x00\xff\x03' + vlq(len(title)) + title)
    t0 += b'\x00\xff\x51\x03' + TEMPO_US.to_bytes(3, 'big') + b'\x00\xff\x58\x04\x04\x02\x18\x08'
    if t_end is None:
        if seg is None:
            t_end = DUR
        else:
            off, end = seg_window(seg)
            t_end = end - off + 0.2
    end_tick = sec2tick(t_end)
    t0 += vlq(end_tick) + b'\xff\x2f\x00'
    tracks.append(t0)
    groups = sorted(set(e[2] for e in ev)) if per_track else [None]
    for ch in groups:
        tr = bytearray()
        if ch is not None:
            nm = NAMES[ch].encode()
            tr += b'\x00\xff\x03' + vlq(len(nm)) + nm
        last = 0
        for tk, _, c, data in ev:
            if ch is not None and c != ch:
                continue
            tk = min(tk, end_tick)
            tr += vlq(tk - last) + data
            last = tk
        tr += vlq(max(0, end_tick - last)) + b'\xff\x2f\x00'
        tracks.append(tr)
    out = b'MThd' + struct.pack('>IHHH', 6, 1, len(tracks), PPQ)
    for tr in tracks:
        out += b'MTrk' + struct.pack('>I', len(tr)) + bytes(tr)
    with open(path, 'wb') as f:
        f.write(out)


def render_midi(mid, wav, n):
    subprocess.run(['fluidsynth', '-ni', '-q', '-R', '0', '-C', '0', '-r', str(SR), '-g', '0.35',
                    '-o', 'synth.polyphony=1024', '-O', 'float', '-T', 'wav', '-F', wav, SF2, mid],
                   check=True, capture_output=True)
    x, sr = sf.read(wav, dtype='float64', always_2d=True)
    assert sr == SR
    os.remove(wav)
    y = np.zeros((n, 2))
    m = min(n, len(x))
    y[:m] = x[:m]
    return y


# --------------------------------------------------------------------------- DSP helpers
def tt(n):
    return np.arange(n) / SR


def place(buf, t, sig, i_off=0):
    """add sig into buf at absolute time t; buf starts at absolute sample i_off"""
    i0 = int(round(t * SR)) - i_off
    if i0 >= len(buf):
        return
    if i0 < 0:
        sig = sig[-i0:]
        i0 = 0
    n = min(len(sig), len(buf) - i0)
    if n <= 0:
        return
    if sig.ndim == 1:
        buf[i0:i0 + n] += sig[:n, None]
    else:
        buf[i0:i0 + n] += sig[:n]


def bq_peak(f, g_db, q):
    A = 10 ** (g_db / 40)
    w = 2 * np.pi * f / SR
    al = np.sin(w) / (2 * q)
    b = [1 + al * A, -2 * np.cos(w), 1 - al * A]
    a = [1 + al / A, -2 * np.cos(w), 1 - al / A]
    return np.array(b) / a[0], np.array(a) / a[0]


def peq(x, f, g, q=0.8):
    b, a = bq_peak(f, g, q)
    return signal.lfilter(b, a, x, axis=0)


def shelf(x, f, g_db, high=True):
    A = 10 ** (g_db / 40)
    w = 2 * np.pi * f / SR
    cw, sw = np.cos(w), np.sin(w)
    al = sw / 2 * np.sqrt(2)
    s = 1 if high else -1
    b0 = A * ((A + 1) + s * (A - 1) * cw + 2 * np.sqrt(A) * al)
    b1 = -2 * s * A * ((A - 1) + s * (A + 1) * cw)
    b2 = A * ((A + 1) + s * (A - 1) * cw - 2 * np.sqrt(A) * al)
    a0 = (A + 1) - s * (A - 1) * cw + 2 * np.sqrt(A) * al
    a1 = 2 * s * ((A - 1) - s * (A + 1) * cw)
    a2 = (A + 1) - s * (A - 1) * cw - 2 * np.sqrt(A) * al
    return signal.lfilter(np.array([b0, b1, b2]) / a0, np.array([1, a1 / a0, a2 / a0]), x, axis=0)


def hpf(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, 'hp', fs=SR, output='sos'), x, axis=0)


def lpf(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, 'lp', fs=SR, output='sos'), x, axis=0)


def sweep_noise(n, f0, f1, q=1.2, stereo=True):
    """noise through a band-pass whose centre glides exponentially f0 -> f1 (block-wise)."""
    ch = 2 if stereo else 1
    x = RNG.standard_normal((n, ch))
    y = np.zeros_like(x)
    blk = 256
    zi = None
    for s in range(0, n, blk):
        fr = f0 * (f1 / f0) ** (s / max(1, n - 1))
        lo, hi = fr / (1 + 0.5 / q), min(fr * (1 + 0.5 / q), SR * 0.45)
        sos = signal.butter(1, [lo, hi], 'bp', fs=SR, output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2, ch))
        y[s:s + blk], zi = signal.sosfilt(sos, x[s:s + blk], axis=0, zi=zi)
    return y / (np.sqrt(np.mean(y ** 2)) + 1e-12)


def glide(f0, f1, n, curve=1.0):
    """phase of a sine gliding exponentially f0 -> f1 over n samples"""
    x = (np.arange(n) / max(1, n - 1)) ** curve
    f = f0 * (f1 / f0) ** x
    return 2 * np.pi * np.cumsum(f) / SR


def sub_boom(size):
    n = int(2.6 * SR)
    t = tt(n)
    f = 32 + 34 * np.exp(-t / 0.14)
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.minimum(1, t / 0.0015) * np.exp(-t / (0.35 + 0.45 * min(size, 1.3)))
    y = np.sin(ph) * env + 0.25 * np.sin(2 * ph) * env * np.exp(-t / 0.2)
    click = lpf(RNG.standard_normal(n) * np.exp(-t / 0.012), 1800, 2) * 0.9
    thump = np.sin(2 * np.pi * 85 * t) * np.exp(-t / 0.06) * np.minimum(1, t / 0.001) * 0.6
    return (y + click + thump) * size


def anvil_sig():
    n = int(1.2 * SR)
    t = tt(n)
    y = np.zeros((n, 2))
    for f, d, a in [(1130, 0.55, 1.0), (1725, 0.4, 0.8), (2650, 0.3, 0.7), (3480, 0.22, 0.5), (4910, 0.15, 0.35),
                    (6230, 0.1, 0.25)]:
        for c in range(2):
            ff = f * (1 + RNG.uniform(-0.004, 0.004))
            y[:, c] += a * np.sin(2 * np.pi * ff * t + RNG.uniform(0, 6)) * np.exp(-t / d)
    click = hpf(RNG.standard_normal((n, 2)) * np.exp(-t / 0.004)[:, None], 2000) * 0.8
    body = (np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.03))[:, None] * 0.8
    return (y / 3.6 + click + body) * np.minimum(1, t / 0.0005)[:, None]


def bonk_sig():
    """a comic frying-pan / tin 'bonk': inharmonic mid partials, short, with a knock"""
    n = int(0.7 * SR)
    t = tt(n)
    y = np.zeros((n, 2))
    for f, d, a in [(412, 0.22, 1.0), (663, 0.16, 0.8), (1019, 0.11, 0.6), (1541, 0.08, 0.45), (2297, 0.05, 0.3)]:
        for c in range(2):
            y[:, c] += a * np.sin(2 * np.pi * f * (1 + RNG.uniform(-0.003, 0.003)) * t) * np.exp(-t / d)
    knock = signal.sosfilt(signal.butter(2, [300, 2500], 'bp', fs=SR, output='sos'),
                           RNG.standard_normal((n, 2)) * np.exp(-t / 0.006)[:, None], axis=0) * 2.0
    return (y / 2.5 + knock) * np.minimum(1, t / 0.0004)[:, None]


def chip_sig(pitches, step):
    """chiptune pulse-wave arpeggio (25% duty, band-limited), the 'item get' wink"""
    seg = int(step * SR)
    n = seg * len(pitches) + int(0.25 * SR)
    y = np.zeros(n)
    for i, p in enumerate(pitches):
        f = 440.0 * 2 ** ((p - 69) / 12)
        m = n - i * seg
        t = tt(m)
        last = i == len(pitches) - 1
        env = np.minimum(1, t / 0.001) * np.where(t < step * (1 if not last else 3), 1.0, 0.0)
        env *= np.exp(-t / (0.08 if not last else 0.12))
        s = np.zeros(m)
        for k in range(1, int(11000 / f) + 1):
            s += np.sin(np.pi * k * 0.25) / k * np.sin(2 * np.pi * f * k * t)
        y[i * seg:] += s * env
    return y / (np.abs(y).max() + 1e-9)


def render_fx(tmp, k):
    """Synthesized hybrid layer for segment k: returns (low, air) slices starting at the segment offset."""
    off, end = seg_window(k)
    i_off = int(round(off * SR))
    n = int(round(end * SR)) - i_off
    low = np.zeros((n, 2))      # sub / drone / quake (mostly dry)
    air = np.zeros((n, 2))      # risers, cymbals, glass, clanks, plip, shimmer (into the hall)
    crash = crash_sample(tmp)
    booms = sorted(a[1] for a in FX if a[0] == 'boom' and a[2] >= 0.3)
    for a in FX:
        if seg_index(a[1]) != k:
            continue
        kind = a[0]
        if kind == 'boom':
            y = sub_boom(a[2]) * 0.55
            nxt = [b for b in booms if b > a[1] + 0.02]
            if nxt and nxt[0] - a[1] < 2.6:            # the tail clears out of the way of the next impact
                gap = nxt[0] - a[1]
                x = tt(len(y))
                y = y * np.clip((gap - 0.012 - x) / 0.07, 0, 1)
            place(low, a[1], y, i_off)
        elif kind == 'rcym':
            _, tend, dur, amp = a
            m = int(dur * SR)
            r = crash[::-1][-m:] * (np.linspace(0, 1, m) ** 1.5)[:, None]
            place(air, tend - m / SR, r * amp * 0.5, i_off)
        elif kind == 'riser':
            _, tend, dur, amp = a
            m = int(dur * SR)
            y = sweep_noise(m, 300, 8000, q=1.5) * (np.linspace(0, 1, m) ** 2.2)[:, None]
            tone = np.sin(glide(220, 1760, m)) * np.linspace(0, 1, m) ** 3
            y = y * 0.08 + tone[:, None] * 0.04
            y[-int(0.004 * SR):] *= np.linspace(1, 0, int(0.004 * SR))[:, None]
            place(air, tend - m / SR, y * amp, i_off)
        elif kind == 'whoosh':
            _, t, dur, amp = a
            m = int(dur * SR)
            env = np.sin(np.pi * np.linspace(0, 1, m) ** 0.5) ** 2
            place(air, t, sweep_noise(m, 4000, 600, q=2) * env[:, None] * amp * 0.06, i_off)
        elif kind == 'suck':
            _, t, dur, amp = a
            m = int(dur * SR)
            env = np.linspace(0, 1, m) ** 2.5 * np.minimum(1, (m - np.arange(m)) / (0.006 * SR))
            place(air, t, sweep_noise(m, 6000, 350, q=1.6) * env[:, None] * amp * 0.07, i_off)
        elif kind == 'zap':
            _, t, amp = a
            m = int(0.35 * SR)
            x = tt(m)
            y = sweep_noise(m, 9000, 3000, q=3) * np.exp(-x / 0.07)[:, None]
            ring = np.sin(2 * np.pi * 3400 * x) * np.exp(-x / 0.15) * 0.5
            place(air, t, (y + ring[:, None]) * amp * 0.07, i_off)
        elif kind in ('shatter', 'crack'):
            _, t, amp = a
            m = int(1.6 * SR)
            x = tt(m)
            y = np.zeros((m, 2))
            npart = 70 if kind == 'shatter' else 30
            for _ in range(npart):
                f = RNG.uniform(1800, 9500)
                t0 = RNG.exponential(0.06 if kind == 'shatter' else 0.02)
                dec = RNG.uniform(0.02, 0.25)
                pan = RNG.uniform(0, 1)
                s = np.sin(2 * np.pi * f * x) * np.exp(-np.maximum(0, x - t0) / dec) * (x >= t0)
                y[:, 0] += s * (1 - pan); y[:, 1] += s * pan
            y = y / npart * 6
            burst = hpf(RNG.standard_normal((m, 2)) * np.exp(-x / 0.03)[:, None], 3000) * 0.5
            place(air, t, (y + burst) * amp * 0.12, i_off)
        elif kind == 'drone':
            _, t0, t1, p, amp = a
            m = int((t1 - t0) * SR)
            x = tt(m)
            f = 440.0 * 2 ** ((p - 69) / 12)
            env = np.minimum(1, x / 0.8) * np.minimum(1, (x[-1] - x) / 0.15)
            y = (np.sin(2 * np.pi * f * x) + 0.4 * np.sin(2 * np.pi * (2 * f + 0.25) * x)
                 + 0.12 * np.sin(2 * np.pi * (3 * f - 0.2) * x)) * env
            place(low, t0, y * amp * 0.12, i_off)
        elif kind == 'anvil':
            _, t, amp = a
            place(air, t, anvil_sig() * amp * 0.11, i_off)
        elif kind == 'bonk':
            _, t, amp = a
            place(air, t, bonk_sig() * amp * 0.16, i_off)
        elif kind == 'boing':
            _, t, dur, amp, f0 = a
            m = int((dur + 0.2) * SR)
            x = tt(m)
            wob = np.exp(-x / 0.28)
            f = f0 * (1 + 0.05 * np.sin(2 * np.pi * 13 * x) * wob) * (1 - 0.06 * np.minimum(1, x / dur))
            ph = 2 * np.pi * np.cumsum(f) / SR
            s = np.sin(ph) + 0.45 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph) + 0.1 * np.sin(5 * ph)
            am = 1 + 0.55 * np.sin(2 * np.pi * 21 * x) * wob
            env = np.minimum(1, x / 0.004) * np.exp(-x / (dur * 0.5))
            y = lpf(s * am * env, 2400)
            place(air, t, np.stack([y * 0.9, y], 1) * amp * 0.06, i_off)
        elif kind == 'pop':
            _, t, amp = a
            m = int(0.12 * SR)
            x = tt(m)
            y = np.sin(glide(950, 210, m, 0.5)) * np.minimum(1, x / 0.0008) * np.exp(-x / 0.025)
            place(air, t, y * amp * 0.12, i_off)
        elif kind == 'plip':
            _, t, amp = a
            m = int(0.4 * SR)
            x = tt(m)
            m1 = int(0.035 * SR)
            ph = np.concatenate([glide(650, 2300, m1, 0.7), 0.0 * np.zeros(m - m1)])
            ph[m1:] = ph[m1 - 1] + 2 * np.pi * 2300 * np.arange(1, m - m1 + 1) / SR
            y = np.sin(ph) * np.minimum(1, x / 0.0008) * np.exp(-x / 0.06)
            y += 0.35 * np.sin(2 * np.pi * 1420 * x) * np.exp(-x / 0.12) * np.minimum(1, x / 0.002)
            place(air, t, np.stack([y, y * 0.85], 1) * amp * 0.09, i_off)
        elif kind == 'dropfall':
            _, t, dur, amp = a
            m = int(dur * SR)
            x = np.linspace(0, 1, m)
            y = np.sin(glide(2600, 1250, m, 1.3)) * np.sin(np.pi * x) ** 2 * (0.4 + 0.6 * x)
            place(air, t, y * amp * 0.035, i_off)
        elif kind == 'sparkle':
            _, t, dur, amp = a
            m = int((dur + 0.8) * SR)
            x = tt(m)
            y = np.zeros((m, 2))
            pent = [74, 78, 81, 83, 86, 90, 93, 95, 98, 102, 105]
            for _ in range(int(dur * 40)):
                p = pent[RNG.integers(0, len(pent))]
                f = 440.0 * 2 ** ((p - 69) / 12)
                t0 = RNG.uniform(0, dur)
                pan = RNG.uniform(0.1, 0.9)
                s = np.sin(2 * np.pi * f * x) * np.exp(-np.maximum(0, x - t0) / RNG.uniform(0.08, 0.3)) * (x >= t0)
                y[:, 0] += s * (1 - pan); y[:, 1] += s * pan
            place(air, t, y / max(1, dur * 40) ** 0.5 * amp * 0.05, i_off)
        elif kind == 'shimmer':
            _, t0, t1, ps, amp = a
            m = int((t1 - t0) * SR)
            x = tt(m)
            y = np.zeros((m, 2))
            for p in ps:
                f = 440.0 * 2 ** ((p - 69) / 12)
                for det in (-0.0025, 0.0025):
                    tw = 0.55 + 0.45 * np.sin(2 * np.pi * RNG.uniform(3, 8) * x + RNG.uniform(0, 6.28))
                    pan = RNG.uniform(0.15, 0.85)
                    s = np.sin(2 * np.pi * f * (1 + det) * x + RNG.uniform(0, 6.28)) * tw
                    y[:, 0] += s * (1 - pan); y[:, 1] += s * pan
            env = np.minimum(1, x / 0.5) ** 1.5 * np.minimum(1, (x[-1] - x) / 1.4)
            air_ = hpf(RNG.standard_normal((m, 2)), 7000) * 0.15 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.7 * x))[:, None]
            place(air, t0, (y / len(ps) + air_) * env[:, None] * amp * 0.05, i_off)
        elif kind == 'chip':
            _, t, ps, step, amp = a
            y = chip_sig(ps, step)
            place(air, t, np.stack([y * 0.8, y], 1) * amp * 0.035, i_off)
        elif kind == 'quake':
            _, t0, t1, amp = a
            m = int((t1 - t0) * SR)
            x = tt(m)
            nz = lpf(RNG.standard_normal((m, 2)), 70, 4)
            nz /= np.sqrt(np.mean(nz ** 2)) + 1e-12
            env = np.minimum(1, x / 0.08) * np.minimum(1, (x[-1] - x) / 0.5) * np.exp(-x / (t1 - t0))
            place(low, t0, nz * env[:, None] * amp * 0.09, i_off)
        elif kind == 'subdrop':
            _, t, dur, amp, f0, f1 = a
            m = int((dur + 0.3) * SR)
            x = tt(m)
            f = f0 * (f1 / f0) ** np.minimum(1, x / dur)
            ph = 2 * np.pi * np.cumsum(f) / SR
            env = np.minimum(1, x / 0.02) * np.exp(-x / (dur * 0.55))
            place(low, t, (np.sin(ph) + 0.2 * np.sin(2 * ph)) * env * amp * 0.5, i_off)
        else:
            raise ValueError(kind)
    return low, air


_CRASH = {}


def crash_sample(tmp):
    if 'x' not in _CRASH:
        mid, wav = os.path.join(tmp, 'crash.mid'), os.path.join(tmp, 'crash.wav')
        saveN, saveC, saveB, saveP = NOTES[:], CCS[:], BENDS[:], PROGS[:]
        NOTES.clear(); CCS.clear(); BENDS.clear(); PROGS.clear()
        cc(DR, 7, 0, 127); note(DR, 49, 0.0, 3.0, 120); note(DR, 57, 0.0, 3.0, 120)
        write_midi(mid, chs=[DR], t_end=4.5)
        x = render_midi(mid, wav, int(4.0 * SR))
        NOTES[:], CCS[:], BENDS[:], PROGS[:] = saveN, saveC, saveB, saveP
        _CRASH['x'] = x / np.abs(x).max()
    return _CRASH['x']


# --------------------------------------------------------------------------- hall reverb
def hall_ir(rt60=2.3, pre=0.02):
    n = int((rt60 * 1.1 + pre) * SR)
    t = tt(n)
    ir = np.zeros((n, 2))
    bands = [(None, 250, rt60 * 1.1), (250, 2500, rt60), (2500, 7000, rt60 * 0.65), (7000, None, rt60 * 0.4)]
    for lo, hi, rt in bands:
        nz = RNG.standard_normal((n, 2))
        if lo and hi:
            nz = signal.sosfilt(signal.butter(2, [lo, hi], 'bp', fs=SR, output='sos'), nz, axis=0)
        elif hi:
            nz = lpf(nz, hi, 2)
        else:
            nz = hpf(nz, lo, 2)
        ir += nz * np.exp(-6.91 * t / rt)[:, None]
    ir *= np.minimum(1, t / 0.05)[:, None] ** 1.5
    for _ in range(14):
        d = RNG.uniform(0.008, 0.07)
        k = int(d * SR)
        ir[k, RNG.integers(0, 2)] += RNG.uniform(0.3, 0.9) * (1 - d * 8)
    k0 = int(pre * SR)
    ir = np.concatenate([np.zeros((k0, 2)), ir])[:n]
    ir /= np.sqrt(np.sum(ir ** 2) / 2)
    return ir


def reverb(x, ir):
    return np.stack([signal.fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in range(2)], 1)


# --------------------------------------------------------------------------- loudness / limiting
def k_weight(x):
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)


def lufs(x):
    y = k_weight(x)
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    p = np.sum(y ** 2, 1)
    c = np.concatenate([[0], np.cumsum(p)])
    starts = np.arange(0, len(p) - blk + 1, hop)
    z = (c[starts + blk] - c[starts]) / blk
    l = -0.691 + 10 * np.log10(z + 1e-20)
    z1 = z[l > -70]
    rel = -0.691 + 10 * np.log10(np.mean(z1)) - 10
    z2 = z[(l > -70) & (l > rel)]
    return -0.691 + 10 * np.log10(np.mean(z2))


def short_term(x, t0, t1):
    y = k_weight(x[int(t0 * SR):int(t1 * SR)])
    return -0.691 + 10 * np.log10(np.mean(np.sum(y ** 2, 1)) + 1e-20)


def true_peak_env(x, os_=4):
    up = signal.resample_poly(x, os_, 1, axis=0)
    a = np.abs(up).max(1)
    return a[:len(a) // os_ * os_].reshape(-1, os_).max(1)


def compressor(x, thr_db, ratio, att=0.02, rel=0.25, knee=6.0):
    """RMS bus compressor computed on 1-ms blocks (feed-forward, soft knee)."""
    blk = 48
    nb = len(x) // blk + 1
    pw = np.mean(np.pad(x, ((0, nb * blk - len(x)), (0, 0))) ** 2, 1).reshape(nb, blk).mean(1)
    lev = 10 * np.log10(pw + 1e-12)
    over = lev - thr_db
    gr = np.where(over <= -knee / 2, 0.0,
                  np.where(over >= knee / 2, over * (1 - 1 / ratio),
                           (1 - 1 / ratio) * (over + knee / 2) ** 2 / (2 * knee)))
    g = np.zeros(nb)
    ca, cr = np.exp(-1e-3 / att), np.exp(-1e-3 / rel)
    s = 0.0
    for i in range(nb):
        c = ca if gr[i] > s else cr
        s = c * s + (1 - c) * gr[i]
        g[i] = s
    gl = 10 ** (-np.interp(np.arange(len(x)) / blk, np.arange(nb), g) / 20)
    return x * gl[:, None]


def limiter(x, ceiling_db=-1.3, look=0.004, rel=0.12):
    ceil = 10 ** (ceiling_db / 20)
    pk = true_peak_env(x)
    req = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    blk = 48
    nb = len(x) // blk + 1
    reqb = np.pad(req, (0, nb * blk - len(req)), constant_values=1).reshape(nb, blk).min(1)
    la = int(look * 1000)
    reqb = minimum_filter1d(reqb, size=2 * la + 3, origin=0)
    g = reqb.copy()
    ca = np.exp(-1e-3 / 0.0015)
    for i in range(nb - 2, -1, -1):
        g[i] = min(g[i], ca * g[i + 1] + (1 - ca) * 1.0 if g[i + 1] < g[i] else g[i])
    cr = np.exp(-1e-3 / rel)
    for i in range(1, nb):
        g[i] = min(g[i], cr * g[i - 1] + (1 - cr) * 1.0)
    gl = np.interp(np.arange(len(x)) / blk, np.arange(nb), g)
    return x * gl[:, None]


# --------------------------------------------------------------------------- mixing
STEM_GAIN = {'strings': 1.0, 'winds': 1.0, 'brass': 1.0, 'choir': 0.9, 'keys': 1.0, 'perc': 1.0,
             'fxlow': 0.6, 'fxair': 1.0}
SEND = {'strings': 0.5, 'winds': 0.4, 'brass': 0.4, 'choir': 0.6, 'keys': 0.55, 'perc': 0.3, 'fxlow': 0.08,
        'fxair': 0.45}
# (stem, t0, t1, dry gain, send gain): the eyes-closed hush and the frozen-time pad sit further back, bigger hall
DISTANT = [('strings', 3.8, 6.0, 1.0, 1.8), ('fxair', 6.0, 8.6, 1.0, 1.7), ('choir', 6.0, 9.4, 1.0, 1.5)]


def mix(dry):
    """dry[name][k] = segment k's slice (starting at the segment offset). Each segment gets its own hall;
    the 'cut' segment (dry + its hall tail) stops at its end time with a 30 ms fade."""
    ir = hall_ir()
    stems = {name: np.zeros((NS, 2)) for name in dry}
    for k, (s0, s1, mode) in enumerate(SEGS):
        off, end = seg_window(k)
        i_off = int(round(off * SR))
        for name in dry:
            x = dry[name][k] * STEM_GAIN[name]
            n = len(x)
            if name not in ('fxlow', 'perc'):
                x = hpf(x, 35)
            if name in ('strings', 'brass', 'choir'):
                x = peq(x, 280, -2.0, 0.9)
            if name == 'brass':
                x = peq(x, 2800, 1.5, 0.8)
            if name == 'strings':
                x = shelf(x, 6000, 1.5, True)
            if name == 'winds':
                x = peq(x, 1200, 1.5, 0.9)
            if name == 'fxlow':
                x = lpf(x, 900)
            send = hpf(x, 140 if name in ('fxlow', 'perc') else 60) * SEND[name]
            dg, sg = np.ones((n, 1)), np.ones((n, 1))
            for nm, a, b, gd, gs in DISTANT:
                if nm == name:
                    ia, ib = max(0, int(a * SR) - i_off), max(0, int(b * SR) - i_off)
                    dg[ia:ib], sg[ia:ib] = gd, gs
            y = x * dg + reverb(send * sg, ir)
            t = (i_off + np.arange(n)) / SR
            if mode == 'cut':
                msk = np.clip((s1 - t) / 0.03, 0, 1)
            else:
                msk = np.ones(n)
            stems[name][i_off:i_off + n] += y * msk[:, None]
    return stems


# bus automation (dB): the light opening sits a touch forward; the payoff is loud by orchestration
AUTOMATION = [(0, 0.5), (2.5, 0.5), (2.55, -0.5), (3.2, -0.5), (3.6, 0.5), (5.9, 0.5), (6.0, -1.0), (8.6, -1.5),
              (9.98, -2.5), (10.0, -3.0), (10.8, -3.0), (10.9, -2.5), (11.74, -2.5), (11.79, 0.5), (12.3, 0.5),
              (12.37, -1.0), (15.0, -1.0)]


def prehit_duck(n, depth_db=-4.0):
    """micro-duck: the bus dips ~90 ms before every HIT/stab and snaps back on the impact."""
    g = np.zeros(n)
    t = tt(n)
    for c, _, det in CUES:
        if det != 'low':
            continue
        i0, i1 = int((c - 0.11) * SR), int((c + 0.004) * SR)
        x = t[i0:i1] - c
        w = np.where(x < -0.07, 0.5 - 0.5 * np.cos(np.pi * (x + 0.11) / 0.04),
                     np.where(x < -0.006, 1.0, np.clip(-(x) / 0.010, 0, 1)))
        g[i0:i1] = np.maximum(g[i0:i1], w)
    return 10 ** (depth_db * g / 20)


def softclip(x, thr):
    """memoryless tanh knee above thr (x normalised to the ceiling): shaves only the attack spikes of the
    biggest tutti hits so they read as bigger than the rest instead of all being flattened to one level"""
    a = np.abs(x)
    o = a.copy()
    m = a > thr
    o[m] = thr + (1 - thr) * np.tanh((a[m] - thr) / (1 - thr))
    return np.sign(x) * o


def master(bus):
    ta, ga = zip(*AUTOMATION)
    bus = bus * (10 ** (np.interp(tt(NS), ta, ga) / 20))[:, None]
    bus = bus * prehit_duck(NS)[:, None]
    x = hpf(bus, 24, 2)
    x = peq(x, 220, -1.0, 0.7)
    x = shelf(x, 9000, 1.0, True)
    pre = lufs(x)
    x *= 10 ** ((-20 - pre) / 20)
    x = compressor(x, thr_db=-24, ratio=2.0, att=0.03, rel=0.3)
    g = 0.0
    y = None
    c = 10 ** (-1.3 / 20)
    t = tt(NS)
    fade = np.clip((END_ZERO - t) / 1.6, 0, 1) ** 1.5          # ring-out to digital zero by 14.86
    for it in range(12):
        y = limiter(softclip(x * 10 ** (g / 20) / c, 0.85) * c, ceiling_db=-1.3) * fade[:, None]
        L = lufs(y)
        if abs(L + 14.0) < 0.02:
            break
        g += (-14.0 - L)
    f = int(0.008 * SR)
    for a, b in SILENT:                                        # re-apply the breath after the master filters
        ia, ib = int(round(a * SR)), int(round(b * SR))
        y[ia - f:ia] *= np.linspace(1, 0, f)[:, None]
        y[ia:ib] = 0
        fi = int(0.002 * SR)
        y[ib:ib + fi] *= np.linspace(0, 1, fi)[:, None]
    return y


# --------------------------------------------------------------------------- verification
# (time, label, detector): 'low' = <150 Hz onset (every stab/HIT has a sub/timpani/kick attack),
# 'full' = 150 Hz-5 kHz onset for the soft, pitched 'plip'
CUES = [(1.6, 'CLANK 1 (small stab)', 'low'), (2.6, 'CLANK 2 (bigger stab)', 'low'),
        (5.6, 'plip (celesta+glock)', 'full'), (6.0, 'time stops: whoosh-boom', 'low'),
        (10.0, 'found it: D major sting', 'low'), (11.0, 'HIT time restarts (D)', 'low'),
        (11.8, 'BIGGEST HIT shatter (A)', 'low'), (12.4, 'final chord / title (D\')', 'low')]
SECTIONS = [(0, 1.6, 'curious (pizz/celesta)'), (1.6, 2.6, 'clank 1'), (2.6, 3.0, 'clank 2 / boing'),
            (3.0, 4.0, 'deflated bassoon'), (4.0, 5.6, 'held high note'), (5.6, 6.0, 'plip / gold glow'),
            (6.0, 7.2, 'time frozen'), (7.2, 8.6, 'search (accelerating)'), (8.6, 10.0, 'search (building)'),
            (10.0, 10.8, 'found it'), (10.8, 10.93, 'breath (silence)'), (11.0, 11.8, 'HIT / dash'),
            (11.8, 12.4, 'BIGGEST HIT / blocks fall'), (12.4, 13.4, 'final chord'), (13.4, 15.0, 'ring out')]


def onset_detect(x, band='low'):
    """Onsets: causal 15 ms RMS on a 1 ms hop, 15 ms rise detector, peak picking. The onset time is the first
    frame of the rise that clears the pre-rise level by 3 dB. band 'low' = <150 Hz, 'full' = 150 Hz-5 kHz."""
    if band == 'low':
        sos = signal.butter(4, 150, 'lp', fs=SR, output='sos')
    else:
        sos = signal.butter(4, [150, 5000], 'bp', fs=SR, output='sos')
    lo = signal.sosfiltfilt(sos, x.mean(1))
    hop, win = 48, 720
    c = np.concatenate([[0], np.cumsum(lo ** 2)])
    idx = np.arange(win, len(lo), hop)
    e = np.sqrt((c[idx] - c[idx - win]) / win)
    tframe = (idx - win) / SR
    db = 20 * np.log10(e + 1e-7)
    lag = 15
    rise = np.zeros(len(db))
    rise[lag:] = db[lag:] - db[:-lag]
    peaks, _ = signal.find_peaks(rise, height=4.0 if band == 'low' else 3.0, distance=80)
    out = []
    for pk in peaks:
        base = db[max(0, pk - lag)]
        j = max(0, pk - lag)
        while j < pk and db[j] < base + 3:
            j += 1
        out.append((tframe[j] + win / SR, rise[pk]))
    return out


def theme_report():
    """the hero theme quote as written to score.mid (trumpet melody line, nominal times)"""
    want = [(11.0, 'D5'), (11.8, 'A5'), (12.1, 'B5'), (12.25, 'A5'), (12.4, 'D6')]
    names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']
    out = ['Hero theme quote D-A-B-A-D\' (1-5-6-5-8), trumpets, as written in score.mid:']
    for t, p in want:
        hitn = [n for n in NOTES if n[0] == TPT and abs(n[2] - t) < 1e-6 and n[1] == P(p)]
        nm = names[P(p) % 12] + str(P(p) // 12 - 1)
        out.append(f'  {t:6.2f} s  {nm:4s} {"present" if hitn else "MISSING"} (vel {hitn[0][4] if hitn else 0})')
    return out


def verify(y, report_path, extra=()):
    lines = ['ultrathink - score verification (all values measured on the rendered score.wav)', '']
    L = lufs(y)
    tp = 20 * np.log10(true_peak_env(y).max())
    lines.append(f'Integrated loudness (internal BS.1770 meter): {L:.2f} LUFS, true peak {tp:.2f} dBTP (4x oversampled)')
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', os.path.join(HERE, 'score.wav'),
                        '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    summ = r[r.rfind('Summary:'):]
    keep = [l.strip() for l in summ.splitlines() if any(k in l for k in ('I:', 'LRA:', 'Peak:'))]
    lines.append('ffmpeg ebur128: ' + ' | '.join(keep))
    info = sf.info(os.path.join(HERE, 'score.wav'))
    lines.append(f'score.wav: {info.frames} frames = {info.frames / info.samplerate:.3f} s, {info.samplerate} Hz, '
                 f'{info.channels} ch, {info.subtype}')
    lines.append('')
    lines.append('Cue alignment (onset detection on the master; tolerance +-33.3 ms = 1 frame at 30 fps)')
    lines.append('  detector low = <150 Hz band (stabs, HITs, sting, chord); full = 150 Hz-5 kHz (the plip)')
    ons = {'low': onset_detect(y, 'low'), 'full': onset_detect(y, 'full')}
    worst, nbad = 0, 0
    for t, lab, det in CUES:
        cands = [o for o in ons[det] if abs(o[0] - t) < 0.12]
        if cands:
            o = max(cands, key=lambda o: o[1])
            d = (o[0] - t) * 1000
            worst = max(worst, abs(d))
            ok = 'OK ' if abs(d) <= 33.3 else 'OFF'
            nbad += ok == 'OFF'
            lines.append(f'  {ok} cue {t:6.3f}  {lab:26s} {det:4s} measured {o[0]:6.3f}  delta {d:+6.1f} ms  '
                         f'rise {o[1]:5.1f} dB')
        else:
            worst, nbad = 999, nbad + 1
            lines.append(f'  MISS cue {t:6.3f} {lab:26s} {det:4s} no onset within 120 ms')
    lines.append(f'  {len(CUES)} cues, {len(CUES) - nbad} within one frame; worst |delta| = {worst:.1f} ms')
    end = y[int(round(END_ZERO * SR)):]
    summ = [('duration exactly 15.000 s', info.frames == NS and info.samplerate == SR),
            ('48 kHz / stereo / 24-bit PCM', info.samplerate == 48000 and info.channels == 2 and info.subtype == 'PCM_24'),
            (f'integrated loudness about -14 LUFS ({L:.2f})', abs(L + 14) <= 0.5),
            (f'true peak <= -1 dBTP ({tp:.2f})', tp <= -1.0),
            ('silent by the end (digital zero from %.2f s)' % END_ZERO, np.abs(end).max() == 0),
            (f'all {len(CUES)} timed cues within +-33 ms (worst {worst:.1f} ms)', nbad == 0)]
    lines[2:2] = ['Summary'] + [f'  {"PASS" if ok else "FAIL"}  {lab}' for lab, ok in summ] + ['']
    lines.append('')
    lines += theme_report()
    lines.append('')
    lines.append('Energy contour (K-weighted loudness of each section, LUFS)')
    for t0, t1, lab in SECTIONS:
        st = short_term(y, t0, t1)
        seg = y[int(t0 * SR):int(t1 * SR)]
        pk = 20 * np.log10(np.abs(seg).max() + 1e-12)
        lines.append(f'  {t0:6.2f}-{t1:6.2f}  {lab:26s} {st:7.1f} LUFS   peak {pk:7.1f} dBFS  ' +
                     '#' * max(0, int((st + 60) / 1.5)))
    lines.append('')
    lines.append('Hit power: momentary loudness (K-weighted, 400 ms from the cue)')
    for t, lab, _ in CUES:
        lines.append(f'  {t:6.2f}  {lab:26s} {short_term(y, t, t + 0.4):6.1f} LUFS')
    lines.append('')
    for a, b, lab in [(10.80, 10.93, 'the breath before the dash'), (END_ZERO, DUR, 'digital zero to the end'),
                      (14.5, DUR, 'last 0.5 s')]:
        seg = y[int(round(a * SR)):int(round(b * SR))]
        pk = np.abs(seg).max()
        lines.append(f'Silence check {a:.2f}-{b:.2f} ({lab}): peak '
                     f'{"-inf (digital zero)" if pk == 0 else f"{20 * np.log10(pk):.1f} dBFS"}')
    lines.append(f'Last sample: L {y[-1, 0]:.1e}, R {y[-1, 1]:.1e}')
    lines += list(extra)
    txt = '\n'.join(lines)
    with open(report_path, 'w') as f:
        f.write(txt + '\n')
    print(txt)


# --------------------------------------------------------------------------- main
def main():
    compose()
    write_midi(os.path.join(HERE, 'score.mid'))
    print(f'{len(NOTES)} notes, {len(CCS)} CCs, {len(FX)} fx events -> score.mid')
    base = os.environ.get('ULTRA_TMP', SCRATCH if os.path.isdir(SCRATCH) else None)
    tmp = tempfile.mkdtemp(prefix='ultra_', dir=base)
    try:
        crash_sample(tmp)
        jobs = [(name, chs, k) for name, chs in STEMS.items() for k in range(len(SEGS))]

        def run(job):
            name, chs, k = job
            off, end = seg_window(k)
            n = int(round(end * SR)) - int(round(off * SR))
            mid, wav = os.path.join(tmp, f'{name}{k}.mid'), os.path.join(tmp, f'{name}{k}.wav')
            write_midi(mid, chs=chs, seg=k)
            return job, render_midi(mid, wav, n)

        dry = {name: [None] * len(SEGS) for name in STEMS}
        with ThreadPoolExecutor(max_workers=4) as ex:
            for (name, chs, k), x in ex.map(run, jobs):
                dry[name][k] = x
        for name in STEMS:
            print(f'rendered {name}: peak {max(np.abs(p).max() for p in dry[name]):.3f}')
        dry['fxlow'], dry['fxair'] = [], []
        for k in range(len(SEGS)):
            lo_, air_ = render_fx(tmp, k)
            dry['fxlow'].append(lo_); dry['fxair'].append(air_)
        stems = mix(dry)
        bus = sum(stems.values())
        y = master(bus)[:NS]
        sf.write(os.path.join(HERE, 'score.wav'), y, SR, subtype='PCM_24')
        g = np.abs(y).max() / max(1e-9, np.abs(bus).max())
        bal = ['', 'Stem balance (K-weighted loudness of each stem in the section, LUFS, approx. master gain)',
               '  section                    ' + ''.join(f'{n:>9s}' for n in stems)]
        for t0, t1, lab in SECTIONS:
            if t1 - t0 < 0.35:
                continue
            bal.append(f'  {lab:26s} ' + ''.join(f'{short_term(stems[n] * g, t0, t1):9.1f}' for n in stems))
        verify(y, os.path.join(HERE, 'verification.txt'), extra=bal)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
