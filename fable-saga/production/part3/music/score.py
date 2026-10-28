#!/usr/bin/env python3
"""The Unmaker - Fable Saga part III - cinematic orchestral score (120.000 s).

Re-runnable: composes the score in code, writes score.mid, renders stems with
fluidsynth + FluidR3_GM, adds synthesized hybrid elements (sub booms, risers,
reverse cymbals, synth pulses, glass shatter, drone), applies the REWIND gag,
hall reverb, bus glue and mastering, writes score.wav (48 kHz / 24-bit / stereo,
exactly 120.000 s), stems/*.flac, and a measured verification report.

    python score.py            # everything
    python score.py --no-stems # skip writing stems/
Needs: fluidsynth, ffmpeg, numpy, scipy, soundfile.
"""
import os, sys, struct, subprocess, tempfile, shutil, math
import numpy as np
import soundfile as sf
from scipy import signal
from scipy.ndimage import minimum_filter1d, maximum_filter1d

HERE = os.path.dirname(os.path.abspath(__file__))
SF2 = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
SR = 48000
DUR = 120.0
NS = int(round(SR * DUR))
CUT = 57.0            # hard cut to silence (sword shatters at 56.5)
REW0, REW1 = 31.5, 33.0   # REWIND gag window
RNG = np.random.default_rng(1977)

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


QUAL = {'M': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'm7': [0, 3, 7, 10],
        'sus4': [0, 5, 7], 'sus2': [0, 2, 7], 'dim': [0, 3, 6], '7b9': [0, 4, 7, 10, 13],
        '5': [0, 7], 'mb9': [0, 3, 7, 13], 'mb5': [0, 3, 6]}

# --------------------------------------------------------------------------- channels
VLN, LOW, CB, TREM, PIZZ, SOLO, HORN, TPT, TBN, DR, TUBA, CHOIR, TIMP, TAIKO, KEYS, HARP = range(16)
NAMES = ['violins', 'violas+celli', 'contrabass', 'tremolo strings', 'pizzicato', 'solo violin',
         'french horns', 'trumpets', 'trombones', 'percussion kit', 'tuba', 'choir', 'timpani',
         'taiko', 'celesta/piano', 'harp']
INIT_PROG = {VLN: 48, LOW: 48, CB: 43, TREM: 44, PIZZ: 45, SOLO: 40, HORN: 60, TPT: 56, TBN: 57,
             TUBA: 58, CHOIR: 53, TIMP: 47, TAIKO: 116, KEYS: 8, HARP: 46}
VOL = {VLN: 108, LOW: 104, CB: 112, TREM: 96, PIZZ: 100, SOLO: 104, HORN: 112, TPT: 100, TBN: 104,
       DR: 104, TUBA: 106, CHOIR: 127, TIMP: 120, TAIKO: 112, KEYS: 104, HARP: 100}
PAN = {VLN: 38, LOW: 82, CB: 92, TREM: 52, PIZZ: 72, SOLO: 58, HORN: 46, TPT: 76, TBN: 84,
       DR: 64, TUBA: 74, CHOIR: 64, TIMP: 54, TAIKO: 64, KEYS: 80, HARP: 34}
BEND_RANGE = {VLN: 12, LOW: 12, TREM: 12, TBN: 12, SOLO: 12, CB: 12}
STEMS = {'strings': [VLN, LOW, CB, TREM, PIZZ, SOLO], 'brass': [HORN, TPT, TBN, TUBA],
         'choir': [CHOIR], 'keys': [KEYS, HARP], 'perc': [DR, TIMP, TAIKO]}
ALLMEL = [c for c in range(16) if c != DR]
# Attack compensation: measured time-to-half-amplitude of each FluidR3 patch (s) * ~0.7,
# note-ons are sent this much early so the audible attack lands on the cue.
LAT = {48: .055, 49: .10, 44: .06, 45: .035, 43: .05, 40: .045, 42: .12, 60: .038, 56: .008,
       57: .034, 58: .037, 61: .04, 52: .15, 53: .055, 47: 0., 116: 0., 46: 0., 8: 0., 0: 0.}

NOTES, CCS, BENDS, PROGS, FX = [], [], [], [], []


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


def ramp(chs, t0, t1, v0, v1, shape=1.0, step=0.04, num=11):
    n = max(2, int((t1 - t0) / step) + 1)
    for i in range(n):
        x = i / (n - 1)
        for c in chs:
            cc(c, num, t0 + x * (t1 - t0), v0 + (v1 - v0) * x ** shape)


def bend(ch, t0, t1, s0, s1, shape=1.0, step=0.01):
    rngs = BEND_RANGE[ch]
    n = max(2, int((t1 - t0) / step) + 1)
    for i in range(n):
        x = i / (n - 1)
        s = s0 + (s1 - s0) * x ** shape
        BENDS.append((t0 + x * (t1 - t0), ch, int(np.clip(8192 + s / rngs * 8191, 0, 16383))))


def prog(ch, t, p):
    PROGS.append((float(t), ch, p))


def roll(ch, p, t0, t1, v0, v1, rate=17.0, shape=1.0):
    t, k = t0, 0
    while t < t1:
        x = (t - t0) / max(1e-6, (t1 - t0))
        note(ch, p, t, 0.14, v0 + (v1 - v0) * x ** shape + RNG.integers(-5, 6))
        t += 1.0 / rate * RNG.uniform(0.9, 1.1)
        k += 1


def scale_run(ch, p0, p1, t0, dur, v, steps, nd=0.35, v1=None):
    """quick scale run (harp gliss / string run) from p0 to p1 using interval set `steps` (pitch classes rel. to p0)"""
    a, b = P(p0), P(p1)
    ps = [p for p in range(min(a, b), max(a, b) + 1) if (p - a) % 12 in steps]
    if b < a:
        ps = ps[::-1]
    for i, p in enumerate(ps):
        vv = v if v1 is None else v + (v1 - v) * i / max(1, len(ps) - 1)
        note(ch, p, t0 + dur * i / len(ps), nd, vv)


WHOLE = {0, 2, 4, 6, 8, 10}
DIM = {0, 1, 3, 4, 6, 7, 9, 10}
MAJ = {0, 2, 4, 5, 7, 9, 11}
MIN = {0, 2, 3, 5, 7, 8, 10}


def fx(*a):
    FX.append(a)


# --------------------------------------------------------------------------- orchestral devices
def tones(root, q):
    r = pc(root) if isinstance(root, str) else root % 12
    return r, QUAL[q]


def at(r, octave):
    return r + 12 * (octave + 1)


def timp_pitch(r):
    p = at(r, 2)
    return p if p >= 38 else p + 12


def hit(t, size, root, q='m', hold=1.0, choir=True, cym=True, extra=(), taiko=True, boom=True,
        strings=True, tpt=True):
    """Full orchestral impact: low brass sfz + strings + choir + timpani + taiko + cymbal + sub boom."""
    r, iv = tones(root, q)
    th = iv[1] if len(iv) > 1 else 7
    fi = 7
    v = int(np.clip(96 + 31 * size, 1, 127))
    b1, b2, b3 = at(r, 1), at(r, 2), at(r, 3)
    if b1 < 26:
        b1 += 12
    note(TUBA, b1, t, hold, v)
    note(TUBA, b2, t, hold, v - 6)
    chord(TBN, [b2, b2 + fi, b3, b3 + th], t, hold, v)
    chord(HORN, [b3, b3 + fi, b3 + 12 + th, b3 + 12], t, hold, v)
    if tpt:
        top = [b3 + 12 + th, b3 + 12 + fi, b3 + 24]
        top = [p if p <= 84 else p - 12 for p in top]
        chord(TPT, top, t, hold * 0.7, v)
    note(CB, b1, t, hold + 0.4, v)
    if strings:
        chord(LOW, [b2, b3, b3 + fi], t, hold + 0.3, v)
        vt = [b3 + 12 + th, b3 + 12 + fi, b3 + 24, b3 + 24 + th]
        chord(VLN, [p if p <= 93 else p - 12 for p in vt], t, hold + 0.3, v - 4)
    for p in extra:
        note(TBN, p, t, hold, v)
        note(HORN, p + 12 if p < 48 else p, t, hold, v - 6)
        if choir:
            note(CHOIR, p + 12 if p < 48 else p, t, hold + 0.4, v)
    if choir:
        chord(CHOIR, [b3, b3 + fi, b3 + 12 + th, b3 + 12], t, hold + 0.5, v)
    tp = timp_pitch(r)
    note(TIMP, tp, t, 1.5, 127)
    note(TIMP, tp - 12 if tp - 12 >= 36 else tp + 7, t + 0.004, 1.5, int(110 * min(1, size) + 10))
    if taiko:
        note(TAIKO, 38, t, 1.0, 127)
        note(TAIKO, 45, t + 0.003, 1.0, int(100 + 27 * min(size, 1)))
    note(DR, 36, t, 0.5, 127)
    note(DR, 35, t, 0.5, int(90 + 37 * min(size, 1)))
    if cym:
        note(DR, 49, t, 2.0, int(np.clip(95 + 32 * size, 1, 127)))
        if size >= 0.8:
            note(DR, 57, t + 0.006, 2.0, 120)
        if size >= 1.15:
            note(DR, 52, t + 0.01, 2.0, 110)
    if boom:
        fx('boom', t, size)


def stab(t, root, q, size, oct_=3, dur=0.24, cym=None, low=True):
    """Short brass/string stab + taiko/timp + small sub boom."""
    r, iv = tones(root, q)
    b = at(r, oct_)
    v = int(np.clip(98 + 29 * size, 1, 127))
    ps = [b + i for i in iv] + [b + 12]
    chord(TPT, [p + 12 if p + 12 <= 84 else p for p in ps[1:]], t, dur, v)
    chord(HORN, ps, t, dur + 0.05, v)
    chord(TBN, [b - 12, b - 12 + 7, b], t, dur + 0.05, v)
    if low:
        note(TUBA, b - 24 if b - 24 >= 26 else b - 12, t, dur + 0.1, v)
        note(CB, b - 24 if b - 24 >= 26 else b - 12, t, dur + 0.1, v)
    chord(LOW, [b - 12, b], t, dur, v)
    chord(VLN, [p + 12 for p in ps], t, dur, v - 6)
    note(TAIKO, 38, t, 0.6, 127)
    note(TAIKO, 45, t + 0.004, 0.6, 115)
    note(TIMP, timp_pitch(r), t, 0.8, int(100 + 27 * min(size, 1)))
    note(DR, 36, t, 0.3, 120)
    if cym:
        note(DR, cym, t, 1.2, int(90 + 30 * size))
    fx('boom', t, 0.55 * size)


def villain(t0, beat, oct_, vel, chs=(TBN, TUBA, HORN, CB, LOW), root='D', tail=True):
    """Villain motif: D - Eb - D - Ab (tritone), low brass in octaves."""
    r = pc(root)
    motif = [(0, 0, 1.5), (1.5, 1, .5), (2, 0, 1), (3, 6, 2)]
    if tail:
        motif += [(5, 5, 1), (6, 1, 1)]
    for b, iv, d in motif:
        t = t0 + b * beat
        dd = d * beat * 0.95
        vv = vel + (8 if iv == 6 else 0)
        base = at(r, oct_) + iv
        if iv == 6:
            base -= 12   # tritone below: Ab under D, more menacing
        for ch in chs:
            if ch == TBN:
                chord(TBN, [base, base + 12], t, dd, vv)
            elif ch == TUBA:
                note(TUBA, base - 12 if base - 12 >= 26 else base, t, dd, vv)
            elif ch == HORN:
                chord(HORN, [base + 12, base + 24 if base + 24 <= 74 else base + 12], t, dd, vv - 4)
            elif ch == CB:
                note(CB, base - 12 if base - 12 >= 24 else base, t, dd, vv)
            elif ch == LOW:
                chord(LOW, [base, base + 12], t, dd, vv - 6)
            elif ch == CHOIR:
                chord(CHOIR, [base + 12, base + 24], t, dd + 0.1, vv)
            elif ch == TPT:
                note(TPT, base + 24, t, dd, vv)
        if iv in (0, 6) and b in (0, 3):
            note(TIMP, timp_pitch((r + iv) % 12), t, 1.0, min(127, vel))


def hero_frag(chs, tonic, t0, durs, vel, octs=(0,)):
    """Hero motif fragment: 1 - 5 - 6 - 5 - 8 (rising, major)."""
    ivs = [0, 7, 9, 7, 12]
    t = t0
    for iv, d in zip(ivs, durs):
        for ch in chs:
            for o in octs:
                note(ch, P(tonic) + iv + 12 * o, t, d * 0.97, vel + (6 if iv == 12 else 0))
        t += d
    return t


def pulse(t, p, dur, amp, bright=1.0):
    fx('pulse', t, P(p), dur, amp, bright)


def action_ostinato(t0, t1, root, q='m', amp=1.0, vln=True, taiko=True, start_bar=0, duck=()):
    """150 bpm action ostinato (16th = 0.1 s): 3+3+2 accents, synth pulse, pizz, celli/basses, taiko, timp."""
    r, iv = tones(root, q)
    acc = {0, 3, 6, 8, 11, 14}
    n = int(round((t1 - t0) / 0.1))
    for k in range(n):
        t = t0 + k * 0.1
        i = (k + start_bar * 16) % 16
        a = i in acc
        if any(-0.21 < t - s < -0.05 or 0.05 < t - s < 0.11 for s in duck):
            continue          # breathe around the stabs so they punch through
        pulse(t, at(r, 1) + (12 if i in (6, 14) else 0), 0.16, (0.9 if a else 0.42) * amp, 1.0 if a else 0.6)
        if a:
            note(PIZZ, at(r, 2), t, 0.2, 100 * min(1, amp) + 10, 0.004)
            note(PIZZ, at(r, 3), t, 0.2, 90 * min(1, amp) + 10, 0.004)
            note(LOW, at(r, 2) + (iv[1] if i == 14 else 0), t, 0.16, 104 * min(1, amp), 0.004)
            note(LOW, at(r, 3), t, 0.16, 96 * min(1, amp), 0.004)
            note(CB, at(r, 1) if at(r, 1) >= 26 else at(r, 2), t, 0.18, 110 * min(1, amp))
        if vln and i % 2 == 0:
            hi = at(r, 5) + ([0, 7, iv[1], 7][(i // 2) % 4])
            note(VLN, hi if hi <= 91 else hi - 12, t, 0.12, 82 * min(1, amp) + 10, 0.004)
        if taiko and i in (0, 6, 8, 14):
            note(TAIKO, 38 if i in (0, 8) else 45, t, 0.4, (118 if i == 0 else 96) * min(1, amp))
        if taiko and i in (10, 12, 13):
            note(TAIKO, 50, t, 0.3, 70 * min(1, amp))
        if i in (0, 8):
            note(TIMP, timp_pitch(r), t, 0.4, 100 * min(1, amp))


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

    # ---------------------------------------------------------------- 0-4 dawn: warm, a little uneasy
    ramp([VLN, LOW, CB], 0.0, 1.8, 28, 92, shape=0.7)
    ramp([CHOIR], 0.0, 2.2, 30, 96, shape=0.7)
    note(CB, 'D2', 0.0, 4.35, 62)
    chord(LOW, ['A2', 'F#3'], 0.0, 4.35, 72)
    chord(VLN, ['D4', 'A4'], 0.0, 2.95, 68)
    chord(VLN, ['D4', 'Bb4'], 2.95, 1.4, 66)          # b6 colour: unease
    chord(CHOIR, ['D4', 'F#4', 'A4'], 0.15, 2.8, 52)
    chord(CHOIR, ['D4', 'G4', 'Bb4'], 2.95, 1.35, 50)
    hero_frag([HORN], 'D4', 0.45, [0.72, 0.85, 0.3, 0.6, 1.35], 84)   # hero motif fragment
    for i, p in enumerate(['D3', 'A3', 'D4', 'F#4', 'A4', 'D5']):
        note(HARP, p, 0.05 + i * 0.14, 2.6, 56 - i * 2)
    note(KEYS, 'A6', 1.95, 1.0, 34)
    note(KEYS, 'F#6', 3.0, 1.0, 30)
    # the music falters at 4.0
    ramp([VLN, LOW, CB, CHOIR, HORN], 3.95, 4.4, 92, 8, step=0.03)

    # ---------------------------------------------------------------- 4-7 dread
    prog(CHOIR, 5.0, 52)
    expr([TREM], 4.3, 18)
    chord(TREM, ['D2', 'Eb2', 'Ab2', 'A2'], 4.35, 2.62, 76)       # low cluster
    ramp([TREM], 4.35, 6.9, 18, 122, shape=2.0)
    expr([VLN], 4.45, 40)
    chord(VLN, ['A6', 'Bb6'], 4.5, 2.4, 46)                      # high harmonics rub
    ramp([VLN], 4.5, 6.7, 40, 92)
    scale_run(HARP, 'D3', 'D6', 4.02, 0.85, 58, WHOLE, nd=0.6, v1=82)  # ashes sucked up
    scale_run(KEYS, 'D5', 'D7', 4.3, 0.7, 40, WHOLE, nd=0.4, v1=60)
    roll(TIMP, 'D2', 5.3, 6.88, 26, 112, shape=1.6)
    expr([CB, LOW], 4.45, 30)
    note(CB, 'D1', 4.5, 2.45, 70)
    ramp([CB, LOW], 4.5, 6.9, 30, 110, shape=1.5)
    note(LOW, 'Eb2', 4.5, 2.45, 64)
    fx('rcym', 7.0, 2.6, 1.0)
    fx('riser', 7.0, 3.2, 0.8)

    # ---------------------------------------------------------------- 7.0 HIT: the sky tears + ostinato
    expr([VLN, LOW, CB, HORN, TPT, TBN, TUBA, CHOIR], 6.78, 118)
    hit(7.0, 0.85, 'D', 'm', hold=1.1)
    fx('rcym', 10.5, 2.0, 0.9)
    fx('riser', 10.5, 2.8, 0.7)
    chord(TREM, ['D5', 'Eb5'], 7.3, 3.15, 64)
    expr([TREM], 7.2, 50); ramp([TREM], 7.3, 10.4, 50, 115)
    for k in range(14):                                       # pulsing ostinato, 120 bpm 8ths
        t = 7.0 + k * 0.25
        x = k / 13
        p = 'Eb2' if k % 8 == 7 else 'D2'
        pulse(t, P(p) - 12, 0.22, 0.55 + 0.45 * x + (0.25 if k % 2 == 0 else 0), 0.8)
        if k > 0:
            note(PIZZ, p, t, 0.2, 70 + 40 * x, 0.004)
            note(LOW, p, t, 0.18, 66 + 44 * x, 0.004)
            note(LOW, P(p) + 12, t, 0.18, 60 + 40 * x, 0.004)
        if k % 2 == 0 and k > 0:
            note(TAIKO, 38, t, 0.4, 60 + 50 * x)
        if k in (4, 8, 12):
            note(TIMP, 'D2', t, 0.5, 80 + 30 * x)
    note(TAIKO, 45, 10.25, 0.3, 105); note(TAIKO, 45, 10.375, 0.3, 112)

    # ---------------------------------------------------------------- 10.5 HIT reveal + VILLAIN MOTIF
    expr([TBN, TUBA, HORN, CB, LOW, CHOIR, VLN, TREM], 10.3, 124)
    hit(10.5, 0.95, 'D', 'm', hold=0.7, choir=False)
    villain(10.5, 0.5, 2, 120)
    chord(CHOIR, ['D3', 'A3', 'D4', 'F4'], 10.5, 1.45, 110)
    chord(CHOIR, ['Ab3', 'C4', 'Eb4'], 12.0, 0.98, 116)
    chord(CHOIR, ['G3', 'Bb3', 'D4'], 13.0, 0.5, 106)
    chord(CHOIR, ['Eb3', 'G3', 'Bb3'], 13.5, 0.55, 100)
    chord(TREM, ['D5', 'F5', 'A5'], 10.5, 1.45, 96)
    chord(TREM, ['Eb5', 'Ab5', 'C6'], 12.0, 0.98, 104)
    chord(TREM, ['D5', 'G5', 'Bb5'], 13.0, 0.5, 96)
    chord(TREM, ['Eb5', 'G5', 'Bb5'], 13.5, 0.5, 90)
    note(DR, 57, 12.0, 1.5, 96)
    note(TAIKO, 38, 12.0, 0.6, 120); fx('boom', 12.0, 0.45)
    for k in range(14):
        t = 10.5 + k * 0.25
        pulse(t, 'D1', 0.22, 0.85 if k % 2 == 0 else 0.5, 0.9)
        if k % 2 == 0 and k not in (0, 6):
            note(TAIKO, 38, t, 0.4, 92)
    ramp([TBN, TUBA, HORN, CB, LOW, CHOIR, TREM, VLN], 13.0, 13.98, 124, 92)

    # ---------------------------------------------------------------- 14-30 dialogue: restrained
    expr([LOW, CB, VLN, TREM, CHOIR, TBN, TUBA, HORN], 13.99, 72)
    def drone_low(t0, t1):
        chord(LOW, ['D2', 'A2'], t0, t1 - t0, 58)
        note(CB, 'D2', t0, t1 - t0, 56)
    drone_low(14.0, 23.9)
    drone_low(27.0, 28.45)
    note(VLN, 'D6', 14.4, 9.4, 30)
    ramp([VLN], 14.4, 19.0, 40, 70); ramp([VLN], 19.0, 23.8, 70, 45)
    for k in range(15):                                     # heartbeat pulses
        t = 14.0 + k * 1.0
        if 23.8 < t < 27.0 or t > 28.3:
            continue
        pulse(t, 'D1', 0.3, 0.5, 0.45)
        pulse(t + 0.24, 'D1', 0.26, 0.3, 0.35)
        if k % 2 == 1:
            note(TIMP, 'D2', t, 0.6, 46)
    # 14.0 UNMAKER stinger (dark)
    chord(TBN, ['D2', 'A2', 'Eb3'], 14.0, 1.2, 92)
    note(TUBA, 'D1', 14.0, 1.3, 96)
    chord(CHOIR, ['D3', 'Eb3', 'A3'], 14.0, 1.6, 92)
    note(TIMP, 'D2', 14.0, 1.0, 104); note(TAIKO, 38, 14.0, 0.8, 104)
    fx('boom', 14.0, 0.45)
    # 17.5 HERO stinger (light question)
    chord(HARP, ['D3', 'A3', 'E4', 'A4'], 17.5, 2.0, 84)
    chord(PIZZ, ['D2', 'A2', 'E3'], 17.5, 0.4, 104)
    chord(TREM, ['A5', 'E6'], 17.5, 1.9, 70)
    note(KEYS, 'E6', 17.52, 1.2, 60)
    note(TIMP, 'A2', 17.5, 0.8, 84); note(TAIKO, 45, 17.5, 0.5, 80)
    fx('boom', 17.5, 0.42)
    # 20.0 UNMAKER stinger (tritone)
    fx('rcym', 20.0, 1.2, 0.45)
    chord(TBN, ['Eb2', 'A2', 'Eb3'], 20.0, 1.3, 98)
    note(TUBA, 'Eb1', 20.0, 1.4, 100)
    chord(CHOIR, ['Eb3', 'A3', 'D4'], 20.0, 1.8, 96)
    note(TIMP, 'Eb2', 20.0, 1.0, 108); note(TAIKO, 38, 20.0, 0.8, 108)
    note(DR, 52, 20.0, 1.0, 70)
    fx('boom', 20.0, 0.5)
    # 24.0 HERO: hopeful horn answer (Bb major, aura ignites gold)
    expr([LOW, VLN, HORN, CB], 23.85, 55)
    ramp([LOW, VLN, CB], 24.0, 26.4, 55, 98)
    note(CB, 'Bb1', 24.0, 2.85, 64)
    chord(LOW, ['Bb2', 'F3', 'D4'], 24.0, 2.85, 66)
    chord(VLN, ['F4', 'Bb4', 'D5', 'F5'], 24.05, 2.8, 62)
    expr([HORN], 23.9, 96)
    hero_frag([HORN], 'Bb3', 24.05, [0.5, 0.75, 0.25, 0.45, 1.3], 88)
    for i, p in enumerate(['Bb2', 'F3', 'Bb3', 'D4', 'F4', 'Bb4', 'D5']):
        note(HARP, p, 24.0 + i * 0.1, 2.0, 66 + i * 2)
    for i, p in enumerate(['F6', 'Bb6', 'D7']):
        note(KEYS, p, 25.2 + i * 0.18, 0.8, 52)
    ramp([LOW, VLN, CB, HORN], 26.55, 26.92, 98, 10)
    # 27.0 UNMAKER: "EVERYTHING ENDS." dark stinger, then build to the title slam
    expr([LOW, CB, VLN, HORN], 26.95, 90)
    chord(TBN, ['D2', 'Ab2', 'D3'], 27.0, 1.0, 110)
    note(TUBA, 'D1', 27.0, 1.1, 112)
    chord(CHOIR, ['D3', 'Ab3'], 27.0, 1.3, 104)
    note(TIMP, 'D2', 27.0, 1.0, 116); note(TAIKO, 38, 27.0, 0.8, 116)
    note(DR, 57, 27.0, 1.0, 84)
    fx('boom', 27.0, 0.6)
    expr([TREM], 27.1, 30)
    chord(TREM, ['D4', 'Eb4', 'Ab4', 'A4'], 27.15, 1.3, 90)
    ramp([TREM], 27.15, 28.42, 30, 124, shape=1.8)
    roll(TIMP, 'A2', 27.7, 28.38, 50, 118)
    fx('rcym', 28.5, 1.4, 1.0); fx('riser', 28.5, 1.5, 0.9)

    # ---------------------------------------------------------------- 28.5 TITLE SLAM
    expr([VLN, LOW, CB, HORN, TPT, TBN, TUBA, CHOIR], 28.3, 125)
    hit(28.5, 1.05, 'D', 'm', hold=1.3, extra=[P('A2')])
    for i, t in enumerate([29.6, 29.7, 29.8, 29.9]):      # taiko pickup into the charge
        note(TAIKO, 45 if i % 2 else 38, t, 0.3, 80 + i * 12)
    ramp([VLN, LOW, CB, HORN, TPT, TBN, TUBA, CHOIR], 29.0, 29.9, 125, 112)

    # ---------------------------------------------------------------- 30-36.5 ROUND 1 (150 bpm)
    expr(ALLMEL, 29.85, 112)
    stab(30.0, 'D', 'M', 0.55, cym=57)                       # gold charge
    t = hero_frag([TPT, HORN], 'D4', 30.0, [0.3, 0.3, 0.1, 0.2, 0.55], 112)
    chord(TBN, ['D3', 'F#3', 'A3'], 30.9, 0.55, 104)
    action_ostinato(30.0, 31.8, 'D', 'm', amp=1.0, duck=(30.0,))
    chord(TREM, ['D5', 'A5'], 30.0, 1.75, 84)
    # (31.5-33.0 the music itself rewinds: done on the rendered audio, see rewind())
    fx('rewind', REW0, REW1)
    stab(33.0, 'D', 'm', 0.45)
    action_ostinato(33.0, 35.6, 'D', 'm', amp=1.05, duck=(33.6, 34.2, 34.8, 35.6))
    chord(TREM, ['F5', 'A5'], 33.0, 2.55, 90)
    stab(33.6, 'D', 'm', 0.7, oct_=4, cym=52)
    stab(34.2, 'Bb', 'M', 0.75, oct_=3, cym=52)
    stab(34.8, 'C', 'M', 0.8, oct_=4, cym=52)
    fx('rcym', 35.6, 0.75, 0.6)
    hit(35.6, 0.9, 'D', 'm', hold=0.85)
    bend(TBN, 35.7, 36.45, 0, -12, shape=2.0)                # swatted down: trombone smear
    bend(TBN, 36.47, 36.48, 0, 0)
    fx('suck', 35.75, 0.7, 0.6)

    # ---------------------------------------------------------------- 36.5-40 gravity inverts
    expr([TREM, LOW, CB, CHOIR, HARP], 36.4, 70)
    ramp([TREM, LOW, CB, CHOIR], 36.5, 39.95, 70, 118)
    for w, base in enumerate(['D4', 'E4', 'F#4', 'G#4']):
        t0 = 36.5 + w * 0.875
        b = P(base)
        chord(TREM, [b, b + 1, b + 6], t0, 0.86, 92 + w * 6)
        bend(TREM, t0, t0 + 0.84, 0, 12, shape=1.5)
        bend(TREM, t0 + 0.855, t0 + 0.865, 0, 0)
        scale_run(HARP, base[:-1] + '3', base[:-1] + '6', t0, 0.8, 60 + w * 6, WHOLE, nd=0.5)
        note(LOW, b - 24 + w, t0, 0.86, 90)
        note(CB, b - 36 + w if b - 36 + w >= 26 else b - 24 + w, t0, 0.86, 92)
        chord(CHOIR, [b - 12 + 2 * w, b - 12 + 2 * w + 1], t0, 0.86, 90 + w * 6)
        fx('whoosh', t0, 0.85, 0.35 + 0.1 * w)
    for k in range(17):
        t = 36.6 + k * 0.2
        pulse(t, 'D1', 0.18, 0.35 + 0.02 * k, 0.5)

    # ---------------------------------------------------------------- 40-42 build (dominant of E)
    expr([TREM, HORN, TBN, TUBA, CHOIR, LOW, CB, VLN], 39.97, 40)
    ramp([TREM, HORN, TBN, TUBA, CHOIR, LOW, CB, VLN], 40.0, 41.9, 40, 124, shape=1.4)
    chord(TREM, ['B3', 'D#4', 'F#4', 'A4', 'B4'], 40.0, 1.92, 100)
    chord(VLN, ['F#5', 'B5'], 40.0, 1.92, 96)
    chord(HORN, ['B2', 'F#3', 'B3', 'D#4'], 40.0, 1.92, 100)
    chord(TBN, ['B1', 'F#2', 'A2'], 40.0, 1.92, 100)
    note(TUBA, 'B1', 40.0, 1.92, 100)
    chord(LOW, ['B2', 'F#3'], 40.0, 1.92, 100); note(CB, 'B1', 40.0, 1.92, 100)
    chord(CHOIR, ['B3', 'D#4', 'F#4', 'A4'], 40.0, 1.92, 104)
    roll(TIMP, 'B2', 40.0, 41.86, 34, 126, rate=19, shape=1.5)
    for k in range(10):
        pulse(40.0 + k * 0.2, 'B0', 0.18, 0.4 + 0.07 * k, 0.6)
    fx('rcym', 42.0, 1.8, 1.0); fx('riser', 42.0, 2.0, 1.0)

    # ---------------------------------------------------------------- 42.0 HIT: STORM FORM (E major)
    expr(ALLMEL, 41.96, 124)
    hit(42.0, 1.05, 'E', 'M', hold=0.75)
    hero_frag([TPT, HORN], 'E4', 42.0, [0.4, 0.6, 0.2, 0.4, 0.42], 124)
    note(HORN, 'E3', 42.0, 0.4, 112); note(HORN, 'B3', 42.4, 0.6, 112)
    chord(TBN, ['E2', 'B2', 'G#3'], 42.75, 0.25, 108); chord(TBN, ['A2', 'E3', 'C#4'], 43.0, 0.6, 112)
    chord(TBN, ['E2', 'B2', 'E3', 'G#3'], 43.6, 0.4, 116)
    chord(TREM, ['E5', 'G#5', 'B5', 'E6'], 42.0, 2.0, 106)
    chord(CHOIR, ['E4', 'G#4', 'B4'], 42.0, 1.0, 112); chord(CHOIR, ['E4', 'A4', 'C#5'], 43.0, 1.0, 112)
    action_ostinato(42.0, 44.0, 'E', 'M', amp=0.8, vln=False, duck=(42.0,))
    note(DR, 52, 43.6, 1.0, 100)

    # ---------------------------------------------------------------- 44-48 storm blitz (fastest, brightest)
    action_ostinato(44.0, 47.5, 'E', 'M', amp=1.1, vln=False, duck=(44.5, 45.2, 45.9, 46.6, 47.3, 47.6))
    arp = [[0, 7, 4, 7], [12, 7, 4, 7]]
    for k in range(36):
        t = 44.0 + k * 0.1
        bar = (k // 8) % 2
        p = P('E5') + arp[bar][k % 4] + (2 if 18 <= k < 26 else 0)
        note(VLN, p, t, 0.1, 96, 0.003)
        note(HARP, p - 12, t, 0.2, 76, 0.003)
    chord(TREM, ['E6', 'B6'], 44.0, 3.55, 84)
    for t, (rt, q) in zip([44.5, 45.2, 45.9, 46.6, 47.3],
                          [('E', 'M'), ('G', 'M'), ('A', 'M'), ('C', 'M'), ('D', 'M')]):
        stab(t, rt, q, 0.8, oct_=3 if rt in ('G', 'A', 'C', 'D') else 4, cym=52 if rt in ('G', 'C') else 57)
        fx('zap', t, 0.5)
    fx('rcym', 47.6, 0.7, 0.8)
    hit(47.6, 1.0, 'E', 'M', hold=0.38)                       # the mask CRACKS
    fx('crack', 47.6, 0.7)

    # ---------------------------------------------------------------- 48-51 sinister: laugh, kaleidoscope
    expr([CHOIR, TBN, TREM, KEYS, HARP, CB, LOW], 47.95, 100)
    chant = [(48.0, 0, .4), (48.4, 0, .2), (48.6, 1, .2), (48.8, 0, .4), (49.2, -6, .8),
             (50.0, 5, .2), (50.2, 1, .2), (50.4, 0, .58)]
    for t, iv, d in chant:
        chord(CHOIR, [P('D3') + iv, P('D4') + iv], t, d, 104)
        chord(TBN, [P('D2') + iv, P('D3') + iv], t, d, 84)
        note(CB, P('D2') + iv, t, d, 90)
        pulse(t, P('D1') + iv, d, 0.55, 0.5)
    chord(TREM, ['A5', 'Bb5', 'Eb6', 'E6'], 48.0, 2.95, 70)
    ramp([TREM], 48.0, 50.9, 60, 105)
    dim = [p for p in range(P('D5'), P('D7') + 1) if (p - P('D5')) % 12 in DIM]
    seq = dim + dim[::-1][1:-1]
    for k in range(58):
        note(KEYS, seq[k % len(seq)], 48.0 + k * 0.05, 0.2, 52 + 18 * math.sin(k / 6))
    for i, t in enumerate([48.0, 48.75, 49.5, 50.25]):
        if i % 2 == 0:
            scale_run(HARP, 'D3', 'C6', t, 0.7, 70, WHOLE, nd=0.5)
        else:
            scale_run(HARP, 'C6', 'D3', t, 0.7, 70, WHOLE, nd=0.5)
    fx('drone', 48.0, 51.0, P('D1'), 0.25)

    # ---------------------------------------------------------------- 51-55 UNWRITE: four rising cluster stabs
    expr([TREM, VLN, LOW, CB, HORN, TBN, TPT, CHOIR, TUBA], 50.95, 105)
    chord(TREM, ['D7', 'Eb7'], 51.0, 1.0, 70)
    chord(LOW, ['D2', 'Eb2'], 51.0, 1.0, 80); note(CB, 'D1', 51.0, 1.0, 84)
    fx('drone', 51.0, 56.5, P('D1'), 0.35)
    fx('riser', 52.0, 1.0, 0.45)
    for i, (t, base) in enumerate(zip([52.0, 52.8, 53.6, 54.4], ['D3', 'F#3', 'Bb3', 'D4'])):
        b = P(base)
        cl = [b, b + 1, b + 5, b + 6]
        v = 108 + i * 6
        chord(HORN, cl, t, 0.3, v)
        chord(TBN, [b - 12, b - 11, b - 6], t, 0.3, v)
        if i >= 1:
            chord(TPT, [p + 12 for p in cl[:3]], t, 0.22, v)
        chord(VLN, [p + 12 for p in cl], t, 0.25, v - 4)
        chord(LOW, [b - 12, b - 11], t, 0.25, v)
        note(TUBA, b - 24, t, 0.3, v); note(CB, b - 24, t, 0.3, v)
        chord(CHOIR, cl, t, 0.6, v)
        nt = 0.78 if i < 3 else 1.06
        chord(TREM, [p + 12 for p in cl], t + 0.05, nt - 0.07, 80 + 8 * i)   # staircase
        note(TIMP, timp_pitch(b % 12), t, 0.6, 112 + 4 * i)
        note(TAIKO, 38, t, 0.5, 120); note(TAIKO, 45, t + 0.003, 0.5, 112)
        note(DR, 52, t, 0.8, 92 + 8 * i); note(DR, 36, t, 0.3, 120)
        fx('boom', t, 0.5 + 0.08 * i)
        fx('suck', t + 0.16, 0.42, 0.35 + 0.08 * i)
    # 55-56.5 the giant hand crushes
    expr([LOW, CB, TBN, TUBA, CHOIR, TREM, HORN], 54.9, 40)
    ramp([LOW, CB, TBN, TUBA, CHOIR, TREM, HORN], 55.0, 56.42, 40, 124, shape=1.6)
    chord(LOW, ['D2', 'Eb2', 'A2'], 55.0, 1.45, 110); note(CB, 'D1', 55.0, 1.45, 110)
    chord(TBN, ['D2', 'Eb2', 'Ab2'], 55.0, 1.45, 110); note(TUBA, 'D1', 55.0, 1.45, 110)
    chord(HORN, ['D3', 'Eb3', 'Ab3'], 55.0, 1.45, 104)
    chord(CHOIR, ['D3', 'Eb3', 'Ab3', 'A3'], 55.0, 1.45, 110)
    chord(TREM, ['D5', 'Eb5', 'Ab5', 'A5'], 55.0, 1.45, 104)
    roll(TIMP, 'D2', 55.0, 56.38, 40, 126, rate=19, shape=1.4)
    fx('rcym', 56.5, 1.4, 1.0); fx('riser', 56.5, 1.5, 0.9)
    expr(ALLMEL, 56.44, 126)
    hit(56.5, 1.15, 'D', 'm', hold=0.5, extra=[P('Eb3'), P('Ab2')])   # the sword SHATTERS
    fx('shatter', 56.5, 1.0)
    for c in range(16):                                       # CUT to silence at 57.0
        cc(c, 120, CUT, 0)
        cc(c, 123, CUT, 0)

    # ---------------------------------------------------------------- 57-66 ALL HOPE LOST
    prog(KEYS, 57.5, 0)
    fx('drone', 58.7, 66.5, P('D1'), 0.075)
    expr(ALLMEL, 57.6, 100)
    for t, p, d, v in [(59.5, 'D5', 1.0, 58), (60.45, 'A5', 0.8, 62), (61.25, 'B5', 0.38, 55),
                       (61.63, 'A5', 1.4, 52), (62.6, 'D4', 1.6, 42)]:   # hero motif, unfinished
        note(KEYS, p, t, d, v)
    prog(KEYS, 62.9, 8)
    note(KEYS, 'A6', 63.5, 1.0, 54)                           # tiny coral light
    note(KEYS, 'D7', 63.58, 1.0, 40)
    note(HARP, 'A5', 63.5, 1.2, 30)
    expr([SOLO], 64.7, 25)
    note(SOLO, 'A4', 64.8, 2.2, 88)                           # "...NOT... YET."
    ramp([SOLO], 64.8, 66.2, 25, 112, shape=1.3)
    bend(SOLO, 65.75, 66.15, 0, 5, shape=0.6)                 # rising to D5
    ramp([SOLO], 66.4, 67.0, 112, 40)
    bend(SOLO, 67.05, 67.06, 0, 0)

    # ---------------------------------------------------------------- 66-68 the eye opens: swell
    prog(CHOIR, 65.6, 53)
    expr([TREM, LOW, CB, CHOIR, VLN], 65.9, 22)
    ramp([TREM, LOW, CB, CHOIR, VLN], 66.0, 67.95, 22, 108, shape=1.3)
    note(CB, 'A1', 66.0, 2.0, 96)
    chord(LOW, ['A2', 'E3'], 66.0, 2.0, 96)
    chord(TREM, ['A3', 'D4', 'E4', 'A4'], 66.0, 2.0, 96)
    chord(VLN, ['E5', 'A5'], 66.0, 2.0, 86)
    chord(CHOIR, ['A3', 'D4', 'E4'], 66.0, 2.0, 92)
    roll(TIMP, 'A2', 66.0, 67.95, 26, 96, shape=1.4)
    fx('drone', 66.0, 68.0, P('A1'), 0.25)

    # ---------------------------------------------------------------- 68-72 rebuild: rising, faster and faster
    prog(CHOIR, 67.7, 52)
    allb = [TREM, LOW, CB, CHOIR, VLN, TBN, TUBA, HORN, TPT, PIZZ]
    expr(allb, 67.96, 66)
    ramp(allb, 68.0, 71.9, 66, 127, shape=1.2)
    prg = [(68.0, 1.0, 'B', 'm'), (69.0, 1.0, 'G', 'M'), (70.0, 1.0, 'E', 'm7'), (71.0, 0.5, 'A', 'sus4'),
           (71.5, 0.43, 'A', '7')]
    tops = {68.0: 'F#5', 69.0: 'G5', 70.0: 'B5', 71.0: 'D6', 71.5: 'C#6'}
    for t, d, rt, q in prg:
        r, iv = tones(rt, q)
        b2 = at(r, 2)
        note(CB, at(r, 1) if at(r, 1) >= 26 else b2, t, d, 104)
        note(TUBA, at(r, 1) if at(r, 1) >= 26 else b2, t, d, 92)
        chord(TBN, [b2, b2 + 7, b2 + 12 + iv[1]], t, d, 96)
        chord(LOW, [b2 + 12, b2 + 19], t, d, 96)
        chord(CHOIR, [b2 + 12 + i for i in iv[1:]] + [b2 + 24], t, d, 108)
        chord(TREM, [b2 + 24 + i for i in iv], t, d, 96)
        note(VLN, tops[t], t, d, 100)
        note(VLN, P(tops[t]) - 12, t, d, 96)
    for t, lo in [(68.0, 'B3'), (69.0, 'G3'), (70.0, 'E4'), (71.0, 'A4')]:   # elements return
        chs = [HORN] if t < 70 else [HORN, TPT]
        for ch in chs:
            note(ch, lo, t, 0.3, 112); note(ch, P(lo) + 7, t + 0.3, 0.62, 118)
        note(TAIKO, 38, t, 0.5, 112); note(TIMP, timp_pitch(pc(lo[:-1])), t, 0.6, 108)
        fx('boom', t, 0.32 + 0.04 * (t - 68))
        scale_run(KEYS, 'D5', 'D7', t + 0.05, 0.5, 50, MAJ, nd=0.3, v1=74)
        scale_run(HARP, lo[:-1] + '3', lo[:-1] + '6', t + 0.05, 0.6, 70, MAJ, nd=0.4)
    t, rate = 68.0, 2.0
    while t < 71.9:                                           # accelerating ostinato 2 -> 12 per s
        x = (t - 68.0) / 4.0
        rt = [r for (tt, d, r, q) in prg if tt <= t + 1e-6][-1]
        r = pc(rt)
        pulse(t, at(r, 1), min(0.25, 1.0 / rate), 0.5 + 0.5 * x, 0.6 + 0.4 * x)
        note(PIZZ, at(r, 2), t, 0.15, 84 + 30 * x)
        note(PIZZ, at(r, 3), t, 0.15, 76 + 30 * x)
        if rate < 7:
            note(TAIKO, 45, t, 0.3, 70 + 40 * x)
        rate = 2.0 * 6.0 ** x
        t += 1.0 / rate
    roll(TIMP, 'A2', 71.0, 71.86, 80, 127, rate=20)
    for t in np.arange(71.0, 71.8, 0.125):
        note(TAIKO, 38, t, 0.2, 96 + (t - 71) * 30)
    fx('rcym', 72.0, 2.0, 1.15); fx('riser', 72.0, 2.6, 1.1)

    # ---------------------------------------------------------------- 72-84 THE FULL HERO THEME (D major)
    expr(ALLMEL, 71.94, 127)
    hit(72.0, 1.2, 'D', 'M', hold=0.9, tpt=False)
    note(DR, 52, 72.0, 2.0, 96)
    mel = [('D4', 72.0, .5), ('A4', 72.5, 1.0), ('B4', 73.5, .25), ('A4', 73.75, .25),
           ('D5', 74.0, 1.5), ('C#5', 75.5, .25), ('B4', 75.75, .25),
           ('G4', 76.0, .5), ('B4', 76.5, .75), ('E5', 77.25, .25), ('D5', 77.5, .5),
           ('C#5', 78.0, .5), ('D5', 78.5, .25), ('E5', 78.75, 1.25),
           ('D5', 80.0, .5), ('A5', 80.5, 1.5),
           ('G5', 82.0, .75), ('F5', 82.75, .25), ('E5', 83.0, .5), ('C#5', 83.5, .45)]
    for p, t, d in mel:
        m = P(p)
        v = 122 if d >= 0.5 else 112
        note(TPT, m, t, d * 0.96, v)
        if m <= P('F5'):
            note(HORN, m, t, d * 0.98, v)
        note(HORN, m - 12, t, d * 0.98, v - 6)
        note(VLN, m + 12, t, d * 0.98, v - 4)
        note(VLN, m, t, d * 0.98, v - 10)
    chords = [(72.0, 2.0, 'D', 'M'), (74.0, 1.0, 'B', 'm'), (75.0, 1.0, 'G', 'M'), (76.0, 1.0, 'E', 'm'),
              (77.0, 1.0, 'C', 'M'), (78.0, 1.0, 'A', 'M'), (79.0, 1.0, 'A', '7'),
              (80.0, 2.0, 'Bb', 'M'), (82.0, 1.0, 'G', 'm'), (83.0, 0.95, 'A', '7b9')]
    for i, (t, d, rt, q) in enumerate(chords):
        r, iv = tones(rt, q)
        b1, b2, b3 = at(r, 1), at(r, 2), at(r, 3)
        if b1 < 26:
            b1 += 12
        menace = t >= 80.0
        note(CB, b1, t, d, 116)
        if not menace:
            note(TUBA, b1, t, d, 108)
            chord(TBN, [b2, b2 + 7, b3 + iv[1]], t, d, 104)
        chord(CHOIR, [b3 + i for i in iv[:3]] + [b3 + 12], t, d, 112)
        chord(TREM, [b3 + 12 + i for i in iv[:3]], t, d, 84)
        chord(LOW, [b2, b3 + iv[1]], t, d, 100)
        tp = timp_pitch(r)
        note(TIMP, tp, t, 0.8, 120 if t in (72.0, 76.0, 80.0) else 104)
        for k in range(int(round(d / 0.25))):                 # harp + celli 8th motion
            tt = t + k * 0.25
            arpp = [b3, b3 + 7, b3 + 12, b3 + 12 + iv[1], b3 + 19, b3 + 12 + iv[1], b3 + 12, b3 + 7][k % 8]
            note(HARP, arpp, tt, 0.4, 82)
            note(PIZZ, b2 if k % 2 == 0 else b2 + 7, tt, 0.2, 96)
            pulse(tt, b1, 0.22, 0.55 if k % 2 == 0 else 0.35, 0.6)
            if k % 2 == 0:
                note(TAIKO, 38 if k % 4 == 0 else 45, tt, 0.4, 104 if k % 4 == 0 else 86)
    for t in (73.5, 77.5):
        roll(TIMP, 'A2', t, t + 0.48, 60, 112)
    note(DR, 57, 76.0, 1.5, 100); fx('rcym', 76.0, 1.0, 0.5)
    fx('rcym', 80.0, 1.2, 0.7); note(DR, 49, 80.0, 1.5, 104)
    villain(80.0, 0.5, 2, 116, chs=(TBN, TUBA), tail=True)    # menace returns underneath
    fx('boom', 80.0, 0.5); fx('boom', 81.5, 0.45)
    roll(TIMP, 'A2', 83.0, 83.86, 60, 127, rate=20)
    fx('rcym', 84.0, 1.6, 1.1); fx('riser', 84.0, 1.8, 1.0)

    # ---------------------------------------------------------------- 84 HIT: the mask breaks; darkest
    expr(ALLMEL, 83.96, 127)
    hit(84.0, 1.2, 'D', 'm', hold=0.5, extra=[P('Ab2'), P('Eb3')])
    villain(84.0, 0.5, 2, 124, chs=(TBN, TUBA, HORN, CB, LOW, CHOIR), tail=False)
    for t, iv, d in [(86.5, 5, 0.5), (87.0, 1, 0.5), (87.5, 0, 0.45)]:
        chord(TBN, [P('D2') + iv, P('D3') + iv], t, d, 120)
        note(TUBA, P('D1') + iv, t, d, 120)
        chord(CHOIR, [P('D3') + iv, P('D4') + iv], t, d, 116)
        chord(HORN, [P('D3') + iv, P('D4') + iv], t, d, 112)
        note(CB, P('D1') + iv, t, d, 116)
    chord(TREM, ['D3', 'Eb3', 'Ab3'], 84.0, 3.95, 100)
    fx('boom', 86.0, 0.8); fx('drone', 84.0, 88.0, P('D1'), 0.45)
    for t in np.arange(84.5, 88.0, 0.5):
        pulse(t, 'D1', 0.4, 0.7, 0.5)
    fx('suck', 85.0, 0.8, 0.5); fx('suck', 86.6, 0.8, 0.5)
    note(DR, 52, 86.0, 1.5, 100)

    # ---------------------------------------------------------------- 88-92 relentless rising tension
    expr([TREM, CHOIR, HORN, TBN, VLN, LOW, CB, TUBA], 87.97, 70)
    ramp([TREM, CHOIR, HORN, TBN, VLN], 88.0, 91.9, 70, 127, shape=1.3)
    action_ostinato(88.0, 91.8, 'D', 'm', amp=0.9, vln=False, duck=(92.0,))
    for i in range(4):
        t = 88.0 + i
        tri = [P('D4') + i, P('F4') + i, P('Ab4') + i]
        chord(TREM, tri + [p + 12 for p in tri], t, 1.0, 96 + 6 * i)
        chord(CHOIR, tri, t, 1.0, 100 + 6 * i)
        chord(HORN, [p - 12 for p in tri], t, 1.0, 96 + 6 * i)
        chord(VLN, [p + 24 for p in tri[:2]], t, 1.0, 90 + 6 * i)
    roll(TIMP, 'D2', 91.0, 91.86, 70, 127, rate=20)
    fx('rcym', 92.0, 1.5, 1.0); fx('riser', 92.0, 2.0, 0.9)

    # ---------------------------------------------------------------- 92-96 final battle: hero vs villain
    expr(ALLMEL, 91.97, 120)
    action_ostinato(92.0, 96.0, 'D', 'm', amp=1.15, vln=True, duck=(92.8, 93.6, 94.4, 95.2))
    hero_frag([TPT, HORN], 'D4', 92.0, [0.2, 0.2, 0.1, 0.1, 0.18], 120)
    stab(92.8, 'D', 'm', 0.85, cym=57)
    for t, iv, d in [(93.0, 0, .2), (93.2, 1, .1), (93.3, 0, .1), (93.4, -6, .18)]:
        chord(TBN, [P('D2') + iv, P('D3') + iv], t, d, 124); note(TUBA, P('D1') + iv, t, d, 124)
    stab(93.6, 'Bb', 'M', 0.9, cym=52)
    hero_frag([TPT, HORN], 'G4', 93.6, [0.2, 0.2, 0.1, 0.1, 0.18], 122)
    stab(94.4, 'C', 'M', 0.95, oct_=4, cym=57)
    for t, iv, d in [(94.6, 0, .2), (94.8, 1, .1), (94.9, 0, .1), (95.0, -6, .18)]:
        chord(TBN, [P('D2') + iv, P('D3') + iv], t, d, 126); note(TUBA, P('D1') + iv, t, d, 126)
    stab(95.2, 'D', 'M', 1.0, cym=49)
    hero_frag([TPT, HORN], 'D5', 95.2, [0.2, 0.2, 0.1, 0.1, 0.18], 124)

    # ---------------------------------------------------------------- 96-100 beam clash
    expr([CHOIR, TREM, VLN, HORN, TBN, TUBA, LOW, CB, TPT], 95.97, 80)
    ramp([CHOIR, TREM, VLN, HORN, TBN, TUBA, LOW, CB, TPT], 96.0, 100.4, 80, 127, shape=1.2)
    clash = [(96.0, 0.8, 'D', 'M'), (96.8, 0.8, 'Ab', 'M'), (97.6, 0.4, 'D', 'M'), (98.0, 0.5, 'Ab', 'M'),
             (98.5, 0.8, 'F', 'M'), (99.3, 1.12, 'G', 'sus4')]
    for t, d, rt, q in clash:
        r, iv = tones(rt, q)
        b2, b3 = at(r, 2), at(r, 3)
        chord(CHOIR, [b3 + i for i in iv] + [b3 + 12], t, d, 116)
        chord(TREM, [b3 + 12 + i for i in iv], t, d, 104)
        chord(VLN, [b3 + 24 + i for i in iv[:2]], t, d, 104)
        chord(HORN, [b3 + i for i in iv], t, d, 112)
        chord(TBN, [b2, b2 + 7, b2 + 12], t, d, 112)
        note(TUBA, b2 - 12 if b2 - 12 >= 26 else b2, t, d, 112)
        note(CB, b2 - 12 if b2 - 12 >= 26 else b2, t, d, 112)
        chord(LOW, [b2, b3], t, d, 104)
        note(TIMP, timp_pitch(r), t, 0.6, 112)
        note(TAIKO, 38, t, 0.5, 116)
    chord(TPT, ['F4', 'A4', 'C5'], 98.5, 0.78, 124)          # "FOR EVERY STORY!"
    note(DR, 57, 98.5, 1.0, 104); fx('boom', 98.5, 0.45)
    for t in np.arange(96.0, 100.3, 0.2):
        pulse(t, 'D1', 0.18, 0.55 + 0.1 * (t - 96), 0.7)
        note(PIZZ, 'D2', t, 0.15, 100)
    roll(TIMP, 'D2', 99.3, 100.36, 70, 127, rate=21)
    for t in np.arange(99.6, 100.35, 0.1):
        note(TAIKO, 45, t, 0.2, 90 + (t - 99.6) * 40)
    fx('rcym', 100.5, 2.2, 1.3); fx('riser', 100.5, 2.6, 1.3)

    # ---------------------------------------------------------------- 100.5 THE STRIKE: the biggest hit
    expr(ALLMEL, 100.44, 127)
    hit(100.5, 1.35, 'Bb', 'M', hold=2.0, extra=[P('F2')])
    note(TAIKO, 38, 100.53, 1.0, 120); note(TAIKO, 50, 100.56, 1.0, 110)
    fx('boom', 100.5, 0.6)          # double-layered sub
    fx('crack', 100.5, 1.0)
    # 101-104 held chord, rising
    ramp([CHOIR, TREM, VLN, HORN, TBN, TUBA, LOW, CB], 101.0, 101.4, 127, 80)
    ramp([CHOIR, TREM, VLN, HORN, TBN, TUBA, LOW, CB], 101.4, 103.94, 80, 127, shape=1.3)
    chord(TREM, ['Bb4', 'D5', 'F5', 'Bb5'], 100.5, 2.0, 100)
    chord(CHOIR, ['C4', 'E4', 'G4', 'C5'], 102.5, 1.44, 120)
    chord(TREM, ['C5', 'E5', 'G5', 'C6'], 102.5, 1.44, 110)
    chord(HORN, ['C3', 'G3', 'C4', 'E4'], 102.5, 1.44, 116)
    chord(TBN, ['C2', 'G2', 'C3'], 102.5, 1.44, 116)
    note(TUBA, 'C1', 102.5, 1.44, 116); note(CB, 'C1', 102.5, 1.44, 116)
    chord(LOW, ['C2', 'G2', 'E3'], 102.5, 1.44, 110)
    scale_run(VLN, 'F5', 'C7', 101.0, 2.9, 90, MAJ, nd=0.3, v1=118)
    roll(TIMP, 'C3', 102.9, 103.86, 70, 127, rate=20)
    fx('rcym', 104.0, 1.6, 1.2); fx('riser', 104.0, 2.2, 1.0)

    # ---------------------------------------------------------------- 104 HIT: the Unmaker shatters
    expr(ALLMEL, 103.96, 127)
    hit(104.0, 1.1, 'D', 'M', hold=1.2)
    fx('shatter', 104.0, 0.8)
    roll(TIMP, 'D2', 104.15, 106.0, 112, 30, rate=17)
    ramp([TBN, TUBA, HORN, TPT, CHOIR, VLN, LOW, CB, TREM], 104.6, 105.4, 127, 80)

    # ---------------------------------------------------------------- 104-111 warm resolution
    prog(CHOIR, 104.4, 53)
    expr([HORN, HARP, KEYS], 104.9, 100)
    b = 0.6
    res = [('D4', 0, 1), ('A4', 1, 2), ('B4', 3, .5), ('A4', 3.5, .5), ('D5', 4, 3), ('C#5', 7, .5),
           ('B4', 7.5, .5), ('A4', 8, 2.6)]
    for p, bb, d in res:
        note(HORN, p, 105.0 + bb * b, d * b * 0.97, 92)
        note(HORN, P(p) - 12, 105.0 + bb * b, d * b * 0.97, 74)
    rchords = [(105.0, 1.2, 'D', 'M'), (106.2, 1.2, 'B', 'm'), (107.4, 1.2, 'G', 'M'),
               (108.6, 1.2, 'E', 'm7'), (109.8, 1.6, 'A', 'sus4'), (111.4, 2.55, 'G', 'M')]
    for t, d, rt, q in rchords:
        r, iv = tones(rt, q)
        b1, b2, b3 = at(r, 1), at(r, 2), at(r, 3)
        if b1 < 26:
            b1 += 12
        note(CB, b1 + 12 if t < 111 else b1, t, d, 84)
        chord(LOW, [b2, b3, b3 + iv[1]], t, d, 82)
        chord(VLN, [b3 + 12 + i for i in iv[:3]], t, d, 76)
        chord(CHOIR, [b3 + i for i in iv[:3]], t, d, 70)
        for k in range(int(d / 0.3)):
            arpp = [b3, b3 + 7, b3 + 12, b3 + 12 + iv[1], b3 + 19, b3 + 12 + iv[1]][k % 6]
            note(HARP, arpp, t + k * 0.3, 0.6, 62)
    note(VLN, 'A5', 109.8, 1.6, 74); note(VLN, 'B5', 111.4, 2.5, 70)
    ramp([VLN, LOW, CB, CHOIR], 105.4, 106.0, 80, 100)
    note(KEYS, 'A6', 106.2, 1.0, 44); note(KEYS, 'D7', 108.6, 1.0, 40)
    # 111.5 an eye opens in the shard: ominous
    prog(CHOIR, 111.25, 52)
    note(TUBA, 'Ab1', 111.5, 1.8, 104); note(CB, 'Ab1', 111.5, 1.8, 108)
    chord(TBN, ['Ab1', 'D2'], 111.5, 1.5, 96)
    expr([CHOIR], 111.3, 110)
    chord(CHOIR, ['Ab2', 'D3', 'Eb3'], 111.5, 1.2, 100)
    note(TIMP, 'Ab2', 111.5, 1.0, 96); note(TAIKO, 38, 111.5, 0.6, 96)
    note(DR, 52, 111.5, 1.0, 60)
    fx('boom', 111.5, 0.55)
    # build into the final chord
    expr([TREM], 112.5, 30)
    chord(TREM, ['A3', 'D4', 'E4', 'A4'], 112.6, 1.35, 100)
    ramp([TREM, VLN, LOW], 112.6, 113.94, 40, 120, shape=1.5)
    roll(TIMP, 'A2', 112.6, 113.86, 40, 124, shape=1.5)
    fx('rcym', 114.0, 1.6, 1.0); fx('riser', 114.0, 1.3, 0.5)

    # ---------------------------------------------------------------- 114 final hero chord, ring out
    expr(ALLMEL, 113.96, 127)
    hit(114.0, 1.05, 'D', 'M', hold=4.8)
    chord(TPT, ['D5', 'F#5', 'A5'], 114.0, 3.5, 118)
    chord(TREM, ['D5', 'F#5', 'A5', 'D6'], 114.0, 5.0, 100)
    chord(VLN, ['F#5', 'A5', 'D6'], 114.0, 5.2, 104)
    chord(HARP, ['D3', 'A3', 'D4', 'F#4', 'A4', 'D5'], 114.0, 4.0, 90)
    roll(TIMP, 'D2', 114.3, 116.5, 104, 40, rate=17)
    ramp(ALLMEL, 114.8, 119.1, 127, 0, shape=0.6)
    for c in range(16):
        cc(c, 123, 119.3, 0)


# --------------------------------------------------------------------------- MIDI writing
PPQ = 960
TEMPO_US = 400000            # 150 bpm, 1 tick = 0.4 / 960 s


def sec2tick(t):
    return int(round(max(0.0, t) / (TEMPO_US / 1e6) * PPQ))


def vlq(n):
    b = [n & 0x7f]
    n >>= 7
    while n:
        b.append((n & 0x7f) | 0x80)
        n >>= 7
    return bytes(reversed(b))


def build_events(chs=None, part=None):
    """List of (tick, order, channel, bytes). Applies attack compensation and same-pitch overlap fixes.
    part 'A' keeps notes scored before the 57.0 cut, 'B' those after (None = all)."""
    chs = set(range(16)) if chs is None else set(chs)
    progs = sorted(PROGS)

    def prog_at(ch, t):
        p = INIT_PROG.get(ch, 0)
        for tt, c, pp in progs:
            if c == ch and tt <= t + 1e-9:
                p = pp
        return p

    ev = []
    # notes: anticipation, then per (ch, pitch) overlap trimming
    shifted = []
    for ch, p, t, d, v in NOTES:
        if ch not in chs or (part == 'A' and t >= CUT) or (part == 'B' and t < CUT):
            continue
        lat = 0.0 if ch == DR else LAT.get(prog_at(ch, t), 0.0)
        t0 = max(0.0, t - lat)
        t1 = t0 + max(0.03, d)
        if t < CUT <= t1:            # nothing pre-cut rings through the cut
            t1 = CUT - 0.001
        shifted.append([ch, p, t0, t1, v])
    shifted.sort(key=lambda n: (n[0], n[1], n[2]))
    for i in range(len(shifted) - 1):
        a, b = shifted[i], shifted[i + 1]
        if a[0] == b[0] and a[1] == b[1] and a[3] > b[2] - 0.002:
            a[3] = max(a[2] + 0.01, b[2] - 0.002)
    for ch, p, t0, t1, v in shifted:
        if not 0 <= p <= 127:
            continue
        ev.append((sec2tick(t1), 1, ch, bytes([0x80 | ch, p, 0])))
        ev.append((sec2tick(t0), 3, ch, bytes([0x90 | ch, p, v])))
    for t, ch, num, val in CCS:
        if ch in chs:
            ev.append((sec2tick(t), 0 if num in (120, 123) else 2, ch, bytes([0xB0 | ch, num, val])))
    for t, ch, val in BENDS:
        if ch in chs:
            ev.append((sec2tick(t), 2, ch, bytes([0xE0 | ch, val & 0x7f, (val >> 7) & 0x7f])))
    for t, ch, p in PROGS:
        if ch in chs:
            ev.append((sec2tick(t), 0, ch, bytes([0xC0 | ch, p])))
    ev.sort(key=lambda e: (e[0], e[1]))
    return ev


def write_midi(path, chs=None, per_track=True, part=None):
    ev = build_events(chs, part)
    tracks = []
    t0 = bytearray(b'\x00\xff\x03' + vlq(len(b'The Unmaker')) + b'The Unmaker')
    t0 += b'\x00\xff\x51\x03' + TEMPO_US.to_bytes(3, 'big') + b'\x00\xff\x58\x04\x04\x02\x18\x08'
    end_tick = sec2tick(DUR + 0.5)
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
            tr += vlq(tk - last) + data
            last = tk
        tr += vlq(max(0, end_tick - last)) + b'\xff\x2f\x00'
        tracks.append(tr)
    out = b'MThd' + struct.pack('>IHHH', 6, 1, len(tracks), PPQ)
    for tr in tracks:
        out += b'MTrk' + struct.pack('>I', len(tr)) + bytes(tr)
    with open(path, 'wb') as f:
        f.write(out)


def render_midi(mid, wav):
    subprocess.run(['fluidsynth', '-ni', '-q', '-R', '0', '-C', '0', '-r', str(SR), '-g', '0.35',
                    '-o', 'synth.polyphony=1024', '-O', 'float', '-T', 'wav', '-F', wav, SF2, mid],
                   check=True, capture_output=True)
    x, sr = sf.read(wav, dtype='float64', always_2d=True)
    assert sr == SR
    y = np.zeros((NS, 2))
    n = min(NS, len(x))
    y[:n] = x[:n]
    return y


# --------------------------------------------------------------------------- DSP helpers
def tt(n):
    return np.arange(n) / SR


def place(buf, t, sig):
    i0 = int(round(t * SR))
    if i0 >= NS:
        return
    if i0 < 0:
        sig = sig[-i0:]
        i0 = 0
    n = min(len(sig), NS - i0)
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


_PULSE_CACHE = {}


def synth_pulse(p, dur, bright):
    key = (p, round(dur, 3), round(bright, 2))
    if key in _PULSE_CACHE:
        return _PULSE_CACHE[key]
    f = 440.0 * 2 ** ((p - 69) / 12)
    n = int((dur + 0.12) * SR)
    t = tt(n)
    y = np.zeros(n)
    K = int(min(40, 3500 / f))
    for k in range(1, K + 1):
        y += np.sin(2 * np.pi * f * k * t + 0.3 * k) / k * np.exp(-t * (6 + 9 * k ** 0.8 / bright))
    env = np.minimum(1, t / 0.003) * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.03))
    y = y * env * np.exp(-t * 2.5)
    y += 0.25 * np.sin(2 * np.pi * f * t) * env * np.exp(-t * 4)  # sub reinforcement
    _PULSE_CACHE[key] = y
    return y


def sub_boom(size):
    n = int(3.2 * SR)
    t = tt(n)
    f = 30 + 32 * np.exp(-t / 0.16)
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.minimum(1, t / 0.0015) * np.exp(-t / (0.45 + 0.55 * min(size, 1.3)))
    y = np.sin(ph) * env + 0.25 * np.sin(2 * ph) * env * np.exp(-t / 0.2)
    click = lpf(RNG.standard_normal(n) * np.exp(-t / 0.012), 1800, 2) * 0.9
    thump = np.sin(2 * np.pi * 85 * t) * np.exp(-t / 0.06) * np.minimum(1, t / 0.001) * 0.6
    return (y + click + thump) * size


_CRASH = {}


def crash_sample(tmp):
    if 'x' not in _CRASH:
        mid, wav = os.path.join(tmp, 'crash.mid'), os.path.join(tmp, 'crash.wav')
        saveN, saveC, saveB, saveP = NOTES[:], CCS[:], BENDS[:], PROGS[:]
        NOTES.clear(); CCS.clear(); BENDS.clear(); PROGS.clear()
        cc(DR, 7, 0, 127); note(DR, 49, 0.0, 3.0, 120); note(DR, 57, 0.0, 3.0, 120)
        write_midi(mid, chs=[DR])
        x = render_midi(mid, wav)[:int(4.0 * SR)]
        NOTES[:], CCS[:], BENDS[:], PROGS[:] = saveN, saveC, saveB, saveP
        _CRASH['x'] = x / np.abs(x).max()
    return _CRASH['x']


def render_fx(tmp, part):
    """Synthesized hybrid layer: subs, risers, reverse cymbals, synth pulses, glass, drones.
    part 'A' = events before the 57.0 cut, 'B' = after."""
    low = np.zeros((NS, 2))      # sub / pulse (mostly dry)
    air = np.zeros((NS, 2))      # risers, cymbals, glass (into the hall)
    crash = crash_sample(tmp)
    for a in FX:
        if a[0] == 'rewind' or ((a[1] < CUT) != (part == 'A')):
            continue
        kind = a[0]
        if kind == 'boom':
            place(low, a[1], sub_boom(a[2]) * 0.55)
        elif kind == 'pulse':
            _, t, p, dur, amp, br = a
            place(low, t, synth_pulse(p, dur, br) * amp * 0.13)
        elif kind == 'rcym':
            _, tend, dur, amp = a
            n = int(dur * SR)
            r = crash[::-1][-n:] * (np.linspace(0, 1, n) ** 1.5)[:, None]
            place(air, tend - n / SR, r * amp * 0.5)
        elif kind == 'riser':
            _, tend, dur, amp = a
            n = int(dur * SR)
            y = sweep_noise(n, 250, 7000, q=1.5) * (np.linspace(0, 1, n) ** 2.2)[:, None]
            tone = np.sin(2 * np.pi * np.cumsum(110 * 4 ** (np.arange(n) / n)) / SR) * np.linspace(0, 1, n) ** 3
            y = y * 0.09 + tone[:, None] * 0.05
            y[-int(0.004 * SR):] *= np.linspace(1, 0, int(0.004 * SR))[:, None]
            place(air, tend - n / SR, y * amp)
        elif kind == 'whoosh':
            _, t, dur, amp = a
            n = int(dur * SR)
            env = np.sin(np.pi * np.linspace(0, 1, n)) ** 2
            place(air, t, sweep_noise(n, 400, 5000, q=2) * env[:, None] * amp * 0.06)
        elif kind == 'suck':
            _, t, dur, amp = a
            n = int(dur * SR)
            env = np.linspace(0, 1, n) ** 2 * np.minimum(1, (n - np.arange(n)) / (0.02 * SR))
            place(air, t, sweep_noise(n, 5000, 450, q=2) * env[:, None] * amp * 0.07)
        elif kind == 'zap':
            _, t, amp = a
            n = int(0.25 * SR)
            x = tt(n)
            y = sweep_noise(n, 9000, 2500, q=3) * np.exp(-x / 0.05)[:, None]
            place(air, t, y * amp * 0.08)
        elif kind in ('shatter', 'crack'):
            _, t, amp = a
            n = int(1.6 * SR)
            x = tt(n)
            y = np.zeros((n, 2))
            npart = 70 if kind == 'shatter' else 30
            for _ in range(npart):
                f = RNG.uniform(1800, 9500)
                t0 = RNG.exponential(0.05 if kind == 'shatter' else 0.02)
                dec = RNG.uniform(0.02, 0.25)
                pan = RNG.uniform(0, 1)
                s = np.sin(2 * np.pi * f * x) * np.exp(-np.maximum(0, x - t0) / dec) * (x >= t0)
                y[:, 0] += s * (1 - pan); y[:, 1] += s * pan
            y = y / npart * 6
            burst = hpf(RNG.standard_normal((n, 2)) * np.exp(-x / 0.03)[:, None], 3000) * 0.5
            place(air, t, (y + burst) * amp * 0.12)
        elif kind == 'drone':
            _, t0, t1, p, amp = a
            n = int((t1 - t0) * SR)
            x = tt(n)
            f = 440.0 * 2 ** ((p - 69) / 12)
            env = np.minimum(1, x / 1.2) * np.minimum(1, (x[-1] - x) / 0.8)
            y = (np.sin(2 * np.pi * f * x) + 0.5 * np.sin(2 * np.pi * (2 * f + 0.25) * x)
                 + 0.18 * np.sin(2 * np.pi * (3 * f - 0.2) * x)) * env
            nz = lpf(RNG.standard_normal(n), 300, 2) * 0.05 * env
            place(low, t0, (y + nz) * amp * 0.12)
    return low, air


# --------------------------------------------------------------------------- the REWIND gag
def rewind_map():
    """Read-position (s) for output times in [REW0, REW1): tape-stop, then a fast VHS rewind."""
    n = int(round((REW1 - REW0) * SR))
    t = REW0 + np.arange(n) / SR
    v = np.empty(n)
    a_end = REW0 + 0.25
    ta = t < a_end
    v[ta] = 1.0 - (t[ta] - REW0) / 0.25                       # pitch-drop / tape stop
    tb = ~ta
    tau = t[tb] - a_end
    vmax = 2.45
    v[tb] = -vmax * np.minimum(1, tau / 0.35) ** 1.5
    v *= 1 + 0.035 * np.sin(2 * np.pi * 7.5 * (t - REW0))     # VHS wow
    pos = REW0 + np.cumsum(v) / SR
    return pos


def apply_rewind(x):
    pos = rewind_map()
    i0, n = int(round(REW0 * SR)), len(pos)
    src = x.copy()
    idx = pos * SR
    seg = np.stack([np.interp(idx, np.arange(len(src)), src[:, c]) for c in range(2)], 1)
    # VHS colour: lose some top end while rewinding
    w = np.linspace(0, 1, n) ** 0.5
    seg = seg * (1 - 0.5 * w[:, None]) + lpf(seg, 3500) * (0.5 * w[:, None])
    fade = int(0.012 * SR)
    seg[-fade:] *= np.linspace(1, 0, fade)[:, None]
    out = x.copy()
    out[i0:i0 + n] = seg
    out[i0 + n:i0 + n + fade] *= np.linspace(0, 1, fade)[:, None]
    return out


# --------------------------------------------------------------------------- hall reverb
def hall_ir(rt60=2.8, pre=0.022):
    n = int((rt60 * 1.1 + pre) * SR)
    t = tt(n)
    ir = np.zeros((n, 2))
    bands = [(None, 250, rt60 * 1.15), (250, 2500, rt60), (2500, 7000, rt60 * 0.6), (7000, None, rt60 * 0.35)]
    for lo, hi, rt in bands:
        nz = RNG.standard_normal((n, 2))
        if lo and hi:
            nz = signal.sosfilt(signal.butter(2, [lo, hi], 'bp', fs=SR, output='sos'), nz, axis=0)
        elif hi:
            nz = lpf(nz, hi, 2)
        else:
            nz = hpf(nz, lo, 2)
        ir += nz * np.exp(-6.91 * t / rt)[:, None]
    ir *= np.minimum(1, t / 0.06)[:, None] ** 1.5           # soft onset of the diffuse tail
    for _ in range(14):                                     # early reflections
        d = RNG.uniform(0.008, 0.075)
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
    starts = np.arange(0, len(p) - blk, hop)
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
    for i in range(nb - 2, -1, -1):                        # attack ramp (backwards in time)
        g[i] = min(g[i], ca * g[i + 1] + (1 - ca) * 1.0 if g[i + 1] < g[i] else g[i])
    cr = np.exp(-1e-3 / rel)
    for i in range(1, nb):                                  # release
        g[i] = min(g[i], cr * g[i - 1] + (1 - cr) * 1.0)
    gl = np.interp(np.arange(len(x)) / blk, np.arange(nb), g)
    return x * gl[:, None]


# --------------------------------------------------------------------------- mixing
STEM_GAIN = {'strings': 1.0, 'brass': 1.0, 'choir': 1.1, 'keys': 0.9, 'perc': 1.0, 'fxlow': 0.6, 'fxair': 1.0}
SEND = {'strings': 0.55, 'brass': 0.42, 'choir': 0.6, 'keys': 0.6, 'perc': 0.32, 'fxlow': 0.08, 'fxair': 0.45}


def mix(dry):
    """dry[name] = (xa, xb): xa = everything scored before the 57.0 cut, xb = after.
    Part A (dry + its hall tail) is hard-cut at 57.0; part B gets its own hall."""
    ir = hall_ir()
    icut = int(round(CUT * SR))
    fade = int(0.008 * SR)
    cutm = np.zeros((NS, 1))
    cutm[:icut] = 1
    cutm[icut - fade:icut, 0] = np.linspace(1, 0, fade)
    stems = {}
    for name, (xa, xb) in dry.items():
        outs = []
        for part, x in (('A', xa), ('B', xb)):
            x = x * STEM_GAIN[name]
            if name not in ('fxlow', 'perc'):
                x = hpf(x, 35)
            if name in ('strings', 'brass', 'choir'):
                x = peq(x, 280, -2.0, 0.9)                 # clean the low-mids
            if name == 'brass':
                x = peq(x, 2800, 1.5, 0.8)                 # bite
            if name == 'strings':
                x = shelf(x, 6000, 1.5, True)              # air
            if name == 'fxlow':
                x = lpf(x, 900)
            if part == 'A':
                x = apply_rewind(x)
            send = hpf(x, 140 if name in ('fxlow', 'perc') else 60) * SEND[name]
            dryg = 1.0
            if name == 'keys' and part == 'B':             # the despair piano is distant
                dryg = np.ones((NS, 1))
                dryg[:int(66 * SR)] = 3.2
                send = send * 4.5
            outs.append(x * dryg + reverb(send, ir))
        stems[name] = outs[0] * cutm + outs[1]
    return stems


# bus automation (dB): keep the first act a notch under the 72.0 theme and the 100.5 strike
AUTOMATION = [(0, 0), (4.0, 0), (6.9, -2), (56.99, -2), (57.0, 0), (71.0, 0), (71.95, 1.2), (84.0, 1.2),
              (86.0, 0), (99.0, 0), (100.45, 1.0), (104.5, 1.0), (107.0, 0), (120.0, 0)]


def master(bus):
    ta, ga = zip(*AUTOMATION)
    bus = bus * (10 ** (np.interp(tt(NS), ta, ga) / 20))[:, None]
    x = hpf(bus, 24, 2)
    x = peq(x, 220, -1.0, 0.7)
    x = shelf(x, 9000, 1.0, True)
    pre = lufs(x)
    x *= 10 ** ((-20 - pre) / 20)
    x = compressor(x, thr_db=-24, ratio=2.0, att=0.03, rel=0.3)
    g = 0.0
    y = None
    for it in range(6):
        y = limiter(x * 10 ** (g / 20), ceiling_db=-1.25)
        L = lufs(y)
        if abs(L + 14.0) < 0.05:
            break
        g += (-14.0 - L)
    # end: silence by 120.0 (fade from 117.5, digital zero from 119.6)
    t = tt(NS)
    fade = np.clip((119.6 - t) / 2.1, 0, 1) ** 2
    y = y * fade[:, None]
    # re-apply the 57.0 cut after the master filters (their ringing would smear the step);
    # nothing is scored between 57.0 and the drone's entry at 58.7
    icut = int(round(CUT * SR))
    f = int(0.008 * SR)
    y[icut - f:icut] *= np.linspace(1, 0, f)[:, None]
    y[icut:int(58.65 * SR)] = 0
    return y


# --------------------------------------------------------------------------- verification
CUES = [(7.0, 'HIT tear'), (10.5, 'HIT reveal'), (14.0, 'sting'), (17.5, 'sting'), (20.0, 'sting'),
        (27.0, 'dark sting'), (28.5, 'HIT title'), (30.0, 'charge'), (33.6, 'stab'), (34.2, 'stab'),
        (34.8, 'stab'), (35.6, 'HIT swat'), (42.0, 'HIT storm'), (44.5, 'stab'), (45.2, 'stab'),
        (45.9, 'stab'), (46.6, 'stab'), (47.3, 'stab'), (47.6, 'HIT crack'), (52.0, 'cluster 1'),
        (52.8, 'cluster 2'), (53.6, 'cluster 3'), (54.4, 'cluster 4'), (56.5, 'HIT shatter'),
        (72.0, 'HIT ZENITH'), (84.0, 'HIT mask'), (92.8, 'stab'), (93.6, 'stab'), (94.4, 'stab'),
        (95.2, 'stab'), (100.5, 'HIT STRIKE'), (104.0, 'HIT shatter'), (111.5, 'ominous'),
        (114.0, 'final chord')]
SECTIONS = [(0, 4, 'dawn'), (4, 7, 'dread'), (7, 10.5, 'tear/ostinato'), (10.5, 14, 'reveal/villain'),
            (14, 28.5, 'dialogue'), (28.5, 30, 'title slam'), (30, 36.5, 'round 1'), (36.5, 42, 'gravity/build'),
            (42, 48, 'storm form/blitz'), (48, 51, 'kaleidoscope'), (51, 57, 'unwrite/crush'),
            (57, 58.5, 'CUT (silence)'), (58.5, 66, 'despair'), (66, 72, 'rebuild'), (72, 80, 'HERO THEME'),
            (80, 84, 'theme+menace'), (84, 92, 'black hole'), (92, 100.5, 'final battle/clash'),
            (100.5, 104, 'strike/held'), (104, 111.5, 'resolution'), (111.5, 114, 'ominous/build'),
            (114, 118, 'final chord'), (118, 120, 'tail')]


def onset_detect(x):
    """Low-band (<150 Hz) onsets: causal 15 ms RMS on a 1 ms hop, 15 ms rise detector, peak picking.
    The onset time is the first frame of the rise that clears the pre-rise level by 3 dB."""
    lo = signal.sosfiltfilt(signal.butter(4, 150, 'lp', fs=SR, output='sos'), x.mean(1))
    hop, win = 48, 720
    c = np.concatenate([[0], np.cumsum(lo ** 2)])
    idx = np.arange(win, len(lo), hop)
    e = np.sqrt((c[idx] - c[idx - win]) / win)               # trailing window ending at idx
    tframe = (idx - win) / SR                                # window start = earliest sample that can raise it
    db = 20 * np.log10(e + 1e-7)
    lag = 15
    rise = np.zeros(len(db))
    rise[lag:] = db[lag:] - db[:-lag]
    peaks, _ = signal.find_peaks(rise, height=4.0, distance=80)
    out = []
    for pk in peaks:
        base = db[max(0, pk - lag)]
        j = max(0, pk - lag)
        while j < pk and db[j] < base + 3:
            j += 1
        out.append((tframe[j] + win / SR, rise[pk]))
    return out


def verify(y, path_png, report_path, extra=()):
    lines = []
    L = lufs(y)
    tp = 20 * np.log10(true_peak_env(y).max())
    lines.append(f'Integrated loudness (internal BS.1770 meter): {L:.2f} LUFS, true peak {tp:.2f} dBTP')
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', os.path.join(HERE, 'score.wav'),
                        '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    summ = r[r.rfind('Summary:'):]
    keep = [l.strip() for l in summ.splitlines() if any(k in l for k in ('I:', 'LRA:', 'Peak:'))]
    lines.append('ffmpeg ebur128: ' + ' | '.join(keep))
    info = sf.info(os.path.join(HERE, 'score.wav'))
    lines.append(f'score.wav: {info.frames} frames = {info.frames / info.samplerate:.3f} s, {info.samplerate} Hz, '
                 f'{info.channels} ch, {info.subtype}')
    lines.append('')
    lines.append('Hit alignment (low band <150 Hz onset detection on the master; tolerance +-33.3 ms = 1 frame)')
    ons = onset_detect(y)
    worst = 0
    for t, lab in CUES:
        cands = [o for o in ons if abs(o[0] - t) < 0.12]
        if cands:
            o = max(cands, key=lambda o: o[1])
            d = (o[0] - t) * 1000
            worst = max(worst, abs(d))
            ok = 'OK ' if abs(d) <= 33.3 else 'OFF'
            lines.append(f'  {ok} cue {t:7.3f}  {lab:13s} measured {o[0]:7.3f}  delta {d:+6.1f} ms  rise {o[1]:5.1f} dB')
        else:
            worst = 999
            lines.append(f'  MISS cue {t:7.3f} {lab:13s} no low-band onset within 120 ms')
    lines.append(f'  worst |delta| = {worst:.1f} ms')
    lines.append('')
    lines.append('Energy contour (short-term K-weighted loudness of each section, LUFS)')
    for t0, t1, lab in SECTIONS:
        st = short_term(y, t0, t1)
        seg = y[int(t0 * SR):int(t1 * SR)]
        rms = 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-12)
        lines.append(f'  {t0:6.1f}-{t1:6.1f}  {lab:20s} {st:7.1f} LUFS   RMS {rms:7.1f} dBFS  ' +
                     '#' * max(0, int((st + 60) / 1.5)))
    seg = y[int(57.0 * SR):int(58.5 * SR)]
    lines.append('')
    lines.append(f'Silence check 57.000-58.500: peak {20 * np.log10(np.abs(seg).max() + 1e-12):.1f} dBFS, '
                 f'RMS {20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-12):.1f} dBFS')
    seg = y[int(119.6 * SR):]
    lines.append(f'End check 119.6-120.0: peak {20 * np.log10(np.abs(seg).max() + 1e-12):.1f} dBFS')
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', os.path.join(HERE, 'score.wav'),
                    '-lavfi', 'showspectrumpic=s=2400x900:legend=1:scale=log:fscale=log:color=intensity',
                    path_png], check=True)
    lines += list(extra)
    txt = '\n'.join(lines)
    with open(report_path, 'w') as f:
        f.write(txt + '\n')
    print(txt)


# --------------------------------------------------------------------------- main
def main():
    write_stems = '--no-stems' not in sys.argv
    compose()
    write_midi(os.path.join(HERE, 'score.mid'))
    print(f'{len(NOTES)} notes, {len(CCS)} CCs, {len(FX)} fx events -> score.mid')
    tmp = tempfile.mkdtemp(prefix='unmaker_', dir=os.environ.get('UNMAKER_TMP'))
    try:
        dry = {}
        icut = int(round(CUT * SR))
        for name, chs in STEMS.items():
            parts = []
            for part in 'AB':     # separate passes: nothing before the cut can ring past it
                mid, wav = os.path.join(tmp, name + part + '.mid'), os.path.join(tmp, name + part + '.wav')
                write_midi(mid, chs=chs, part=part)
                parts.append(render_midi(mid, wav))
            parts[0][icut:] = 0
            dry[name] = tuple(parts)
            print(f'rendered {name}: peak {max(np.abs(p).max() for p in parts):.3f}')
        la, aa = render_fx(tmp, 'A')
        lb, ab = render_fx(tmp, 'B')
        dry['fxlow'], dry['fxair'] = (la, lb), (aa, ab)
        stems = mix(dry)
        bus = sum(stems.values())
        y = master(bus)
        y = y[:NS]
        sf.write(os.path.join(HERE, 'score.wav'), y, SR, subtype='PCM_24')
        if write_stems:
            os.makedirs(os.path.join(HERE, 'stems'), exist_ok=True)
            g = np.abs(y).max() / max(1e-9, np.abs(bus).max())
            for name, x in stems.items():
                sf.write(os.path.join(HERE, 'stems', name + '.flac'), np.clip(x * g, -1, 1), SR, subtype='PCM_24')
        g = np.abs(y).max() / max(1e-9, np.abs(bus).max())
        bal = ['', 'Stem balance (K-weighted loudness of each stem in the section, LUFS, at master gain)',
               '  section                ' + ''.join(f'{n:>9s}' for n in stems)]
        for t0, t1, lab in SECTIONS:
            if t1 - t0 < 2.5:
                continue
            bal.append(f'  {lab:22s} ' + ''.join(f'{short_term(stems[n] * g, t0, t1):9.1f}' for n in stems))
        bal += ['', 'Band balance of the master per section (dB relative to the full-band energy)',
                '  section                    <90Hz  90-300 300-1k   1k-4k   4k-16k']
        bands = [(20, 90), (90, 300), (300, 1000), (1000, 4000), (4000, 16000)]
        for t0, t1, lab in SECTIONS:
            if t1 - t0 < 2.5:
                continue
            seg = y[int(t0 * SR):int(t1 * SR)].mean(1)
            F = np.abs(np.fft.rfft(seg)) ** 2
            fr = np.fft.rfftfreq(len(seg), 1 / SR)
            tot = F.sum() + 1e-20
            bal.append(f'  {lab:22s} ' + ''.join(f'{10 * np.log10(F[(fr >= lo) & (fr < hi)].sum() / tot + 1e-12):8.1f}'
                                                 for lo, hi in bands))
        verify(y, os.path.join(HERE, 'spectrogram.png'), os.path.join(HERE, 'verification.txt'), extra=bal)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
