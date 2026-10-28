#!/usr/bin/env python3
"""The Sunderer - Fable Saga part IV - cinematic orchestral score (180.000 s).

Built on part III's score.py (the Unmaker). Re-runnable: composes the score in code, writes score.mid,
renders stems with fluidsynth + FluidR3_GM, adds the synthesized hybrid layer (sub booms, braams, anvils,
quakes, sub drops, the SUNDER tear, heartbeats, risers, reverse cymbals, glass, drones), plays the REWIND
(the music itself rewinds, 58-60 s), hall reverb, bus glue and mastering, and writes score.wav
(48 kHz / 24-bit / stereo, exactly 180.000 s), stems/*.flac and a measured verification report.

The film is rendered in four segments so nothing before a hard cut rings across it:
  A 0-41.2 (hard cut to silence), B 41.2-60.0 (ends in the REWIND), C 60.0-104.0 (collapses to silence),
  D 104.0-180.0.

Themes
  hero      D-A-B-A-D' (1-5-6-5-8), carried over from part III
  Unmaker   D-Eb-D-Ab, carried over from part III
  Sunderer  Eb3 -> D2, a falling minor ninth hammered three times in tutti low brass + taiko + anvil
  fused     (55.6 on) the Unmaker's line sung on top while the low brass hammers the falling ninth under it

    python score.py            # everything
    python score.py --no-stems # skip writing stems/
Needs: fluidsynth, ffmpeg, numpy, scipy, soundfile.
"""
import os, sys, struct, subprocess, tempfile, shutil, math
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import soundfile as sf
from scipy import signal
from scipy.ndimage import minimum_filter1d

HERE = os.path.dirname(os.path.abspath(__file__))
SF2 = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
SCRATCH = '/tmp/claude-0/-home-user-brain/f1f7475c-3827-5141-bc67-2671553b043a/scratchpad/music4'
SR = 48000
DUR = 180.0
NS = int(round(SR * DUR))
# render segments: (start, end, how the segment ends)
SEGS = [(0.0, 41.2, 'cut'), (41.2, 60.0, 'cut'), (60.0, 104.0, 'fade'), (104.0, DUR, 'ring')]
REW0, REW1 = 58.0, 60.0          # the REWIND (inside segment B)
SILENT = [(41.2, 41.75), (103.95, 104.5)]   # digital silence re-applied after mastering
RNG = np.random.default_rng(4444)

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
        '5': [0, 7], 'mb9': [0, 3, 7, 13], 'mb5': [0, 3, 6], 'add9': [0, 4, 7, 14]}

# --------------------------------------------------------------------------- channels
VLN, LOW, CB, TREM, PIZZ, SOLO, HORN, TPT, TBN, DR, TUBA, CHOIR, TIMP, TAIKO, KEYS, HARP = range(16)
NAMES = ['violins', 'violas+celli', 'contrabass', 'tremolo strings', 'pizzicato', 'solo (oboe/violin/cello)',
         'french horns', 'trumpets', 'trombones', 'percussion kit', 'tuba', 'choir', 'timpani',
         'taiko', 'celesta/piano/organ', 'harp']
INIT_PROG = {VLN: 48, LOW: 48, CB: 43, TREM: 44, PIZZ: 45, SOLO: 68, HORN: 60, TPT: 56, TBN: 57,
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
       57: .034, 58: .037, 61: .04, 52: .15, 53: .055, 47: 0., 116: 0., 46: 0., 8: 0., 0: 0.,
       68: .022, 73: .029, 19: .01}

NOTES, CCS, BENDS, PROGS, FX = [], [], [], [], []
# soft entries whose *start* is the cue (no attack lead): (channel, t0, t1)
NOLAT = [(SOLO, 86.4, 86.6)]


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


def unbend(chs, t):
    for c in chs:
        BENDS.append((float(t), c, 8192))


def prog(ch, t, p):
    PROGS.append((float(t), ch, p))


def roll(ch, p, t0, t1, v0, v1, rate=17.0, shape=1.0):
    t = t0
    while t < t1:
        x = (t - t0) / max(1e-6, (t1 - t0))
        note(ch, p, t, 0.14, v0 + (v1 - v0) * x ** shape + RNG.integers(-5, 6))
        t += 1.0 / rate * RNG.uniform(0.9, 1.1)


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
HMIN = {0, 2, 3, 5, 7, 8, 11}
MIXO = {0, 2, 4, 5, 7, 9, 10}


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
        strings=True, tpt=True, braam=None, big=False, anvil=0.0):
    """Full orchestral impact: low brass sfz + strings + choir + timpani + taiko + cymbal + sub boom.
    braam: midi root of a synth braam layer; big: second sub + china/splash stack; anvil: metal strike."""
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
    if big:
        fx('boom', t + 0.004, 0.45 * size)
        note(DR, 55, t + 0.008, 1.5, 110)
        note(TAIKO, 50, t + 0.02, 1.0, 120)
    if braam is not None:
        fx('braam', t, P(braam), hold + 0.9, 0.55 * size, 0.008, 1.0)
    if anvil:
        fx('anvil', t, anvil)


def stab(t, root, q, size, oct_=3, dur=0.24, cym=None, low=True, anvil=0.0):
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
    chord(VLN, [p + 12 if p + 12 <= 96 else p for p in ps], t, dur, v - 6)
    note(TAIKO, 38, t, 0.6, 127)
    note(TAIKO, 45, t + 0.004, 0.6, 115)
    note(TIMP, timp_pitch(r), t, 0.8, int(100 + 27 * min(size, 1)))
    note(DR, 36, t, 0.3, 120)
    if cym:
        note(DR, cym, t, 1.2, int(90 + 30 * size))
    fx('boom', t, 0.75 * size)
    if anvil:
        fx('anvil', t, anvil)


def brutal(t, root, size, windup=True, cym=None):
    """The Sunderer's blow: a low brass cluster (root, b2, 5th) + taiko + anvil + sub; short and crushing."""
    r = pc(root)
    b = at(r, 2)
    v = int(np.clip(100 + 27 * size, 1, 127))
    chord(TBN, [b, b + 1, b + 7, b + 12], t, 0.3, v)
    note(TUBA, b - 12 if b - 12 >= 26 else b, t, 0.35, v)
    note(TUBA, b, t, 0.35, v - 6)
    note(CB, b - 12 if b - 12 >= 26 else b, t, 0.35, v)
    chord(HORN, [b + 12, b + 13, b + 19], t, 0.28, v - 2)
    chord(LOW, [b, b + 12, b + 13], t, 0.25, v)
    chord(VLN, [b + 36, b + 37], t, 0.18, v - 12)
    chord(CHOIR, [b + 12, b + 13], t, 0.35, v - 10)
    note(TAIKO, 38, t, 0.6, 127)
    note(TAIKO, 45, t + 0.003, 0.6, 120)
    note(TAIKO, 50, t + 0.012, 0.6, 110)
    note(TIMP, timp_pitch(r), t, 0.8, 120)
    note(DR, 36, t, 0.3, 127)
    note(DR, 35, t, 0.3, 120)
    if cym:
        note(DR, cym, t, 1.0, 100)
    fx('boom', t, 1.0 * size)
    fx('anvil', t, 0.55 * size)
    if windup:
        fx('whoosh', t - 0.32, 0.32, 0.5 * size)


def sunder(t0, beat, vel, root='D', size=0.7, hi=True, last=1.5, choir=False):
    """The Sunderer's motif: Eb3 -> D2, a falling minor ninth, the low note hammered three times (tutti low brass)."""
    r = pc(root)
    lo = at(r, 2)            # D2
    h = lo + 13              # Eb3
    seq = []
    if hi:
        seq.append((0.0, h, 0.9))
    seq += [(1.0, lo, 0.45), (1.5, lo, 0.45), (2.0, lo, last)]
    for k, (b, p, d) in enumerate(seq):
        t = t0 + b * beat
        dd = d * beat * 0.95
        is_lo = p == lo
        vv = vel + (6 if is_lo else 0)
        chord(TBN, [p, p + 12] if is_lo else [p - 12, p], t, dd, vv)
        note(TUBA, p - 12 if p - 12 >= 26 else p, t, dd, vv)
        note(CB, p - 12 if p - 12 >= 26 else p, t, dd, vv)
        chord(HORN, [p + 12] if is_lo else [p, p + 12], t, dd, vv - 4)
        chord(LOW, [p, p + 12] if is_lo else [p - 12, p], t, dd, vv - 4)
        if choir:
            chord(CHOIR, [p + 12, p + 24] if is_lo else [p, p + 12], t, dd + 0.1, vv - 6)
        note(TIMP, timp_pitch(p % 12), t, 0.9, min(127, vv + 4))
        if is_lo:
            note(TAIKO, 38, t, 0.6, min(127, vv + 8))
            note(TAIKO, 45, t + 0.003, 0.6, min(127, vv))
            note(DR, 36, t, 0.3, min(127, vv + 6))
            fx('boom', t, 0.8 * size)
            fx('anvil', t, 0.45 * size)
        else:
            fx('boom', t, 0.6 * size)


THEME = [(0, .5, 0), (.5, 1.0, 7), (1.5, .25, 9), (1.75, .25, 7), (2.0, 1.5, 12), (3.5, .25, 11), (3.75, .25, 9),
         (4.0, .5, 5), (4.5, .75, 9), (5.25, .25, 14), (5.5, .5, 12), (6.0, .5, 11), (6.5, .25, 12),
         (6.75, 1.25, 14), (8.0, .5, 12), (8.5, 1.5, 19), (10.0, .75, 17), (10.75, .25, 16), (11.0, .5, 14),
         (11.5, .5, 11)]
MINOR = {4: 3, 9: 8, 16: 15, 21: 20}


def theme(tonic, t0, k, i0, i1, layers, vel, minor=False, cut=None, legato=0.97):
    """The hero theme (part III's full melody; 1-5-6-5-8 head) from note i0 to i1-1, time-scaled by k.
    layers: [(channel, semitone shift, velocity delta)]."""
    T0 = THEME[i0][0]
    for i in range(i0, i1):
        u, d, deg = THEME[i]
        if minor:
            deg = MINOR.get(deg, deg)
        t = t0 + (u - T0) * k
        dur = d * k * legato
        if cut is not None:
            if t >= cut - 0.03:
                break
            dur = min(dur, cut - 0.03 - t)
        m = P(tonic) + deg
        for ch, sh, dv in layers:
            p = m + sh
            lim = {TPT: 84, HORN: 77, VLN: 96, TREM: 96, CHOIR: 79}.get(ch, 127)
            while p > lim:
                p -= 12
            note(ch, p, t, dur, vel + dv + (6 if d >= 0.5 else 0))


def hero_frag(chs, tonic, t0, durs, vel, octs=(0,), minor=False):
    """Hero motif fragment: 1 - 5 - 6 - 5 - 8 (rising)."""
    ivs = [0, 7, 8 if minor else 9, 7, 12]
    t = t0
    for iv, d in zip(ivs, durs):
        for ch in chs:
            for o in octs:
                note(ch, P(tonic) + iv + 12 * o, t, d * 0.97, vel + (6 if iv == 12 else 0))
        t += d
    return t


def pulse(t, p, dur, amp, bright=1.0):
    fx('pulse', t, P(p), dur, amp, bright)


def action_ostinato(t0, t1, root, q='m', amp=1.0, vln=True, taiko=True, start_bar=0, duck=(), amp1=None,
                    b2=False):
    """150 bpm action ostinato (16th = 0.1 s): 3+3+2 accents, synth pulse, pizz, celli/basses, taiko, timp.
    amp1: crescendo target; b2: Phrygian flat-2 colour on the last accent (the Sunderer's Eb)."""
    r, iv = tones(root, q)
    acc = {0, 3, 6, 8, 11, 14}
    n = int(round((t1 - t0) / 0.1))
    for k in range(n):
        t = t0 + k * 0.1
        x = k / max(1, n - 1)
        a_ = amp if amp1 is None else amp + (amp1 - amp) * x
        i = (k + start_bar * 16) % 16
        a = i in acc
        if any(-0.21 < t - s < -0.05 or -0.02 < t - s < 0.11 for s in duck):
            continue          # breathe around the hits so they punch through
        col = 1 if (b2 and i == 14) else (iv[1] if i == 14 else 0)
        pulse(t, at(r, 1) + (12 if i in (6, 14) else 0) + (1 if b2 and i == 14 else 0), 0.16,
              (0.9 if a else 0.42) * a_, 1.0 if a else 0.6)
        m = min(1, a_)
        if a:
            note(PIZZ, at(r, 2), t, 0.2, 100 * m + 10, 0.004)
            note(PIZZ, at(r, 3), t, 0.2, 90 * m + 10, 0.004)
            note(LOW, at(r, 2) + col, t, 0.16, 104 * m, 0.004)
            note(LOW, at(r, 3), t, 0.16, 96 * m, 0.004)
            note(CB, at(r, 1) if at(r, 1) >= 26 else at(r, 2), t, 0.18, 110 * m)
        if vln and i % 2 == 0:
            hi = at(r, 5) + ([0, 7, iv[1], 7][(i // 2) % 4])
            note(VLN, hi if hi <= 91 else hi - 12, t, 0.12, 82 * m + 10, 0.004)
        if taiko and i in (0, 6, 8, 14):
            note(TAIKO, 38 if i in (0, 8) else 45, t, 0.4, (118 if i == 0 else 96) * m)
        if taiko and i in (10, 12, 13):
            note(TAIKO, 50, t, 0.3, 70 * m)
        if i in (0, 8):
            note(TIMP, timp_pitch(r), t, 0.4, 100 * m)


def bed(chords, vel=104, step=0.25, arps=True, taiko=True, tuba=True, choir_v=112, trem_v=84):
    """Theme accompaniment (part III's 72-84 texture): low brass/strings/choir per chord + 8th motion."""
    for t, d, rt, q in chords:
        r, iv = tones(rt, q)
        b1, b2, b3 = at(r, 1), at(r, 2), at(r, 3)
        if b1 < 26:
            b1 += 12
        note(CB, b1, t, d, vel + 12)
        if tuba:
            note(TUBA, b1, t, d, vel + 4)
            chord(TBN, [b2, b2 + 7, b3 + iv[1]], t, d, vel)
        chord(CHOIR, [b3 + i for i in iv[:3]] + [b3 + 12], t, d, choir_v)
        chord(TREM, [b3 + 12 + i for i in iv[:3]], t, d, trem_v)
        chord(LOW, [b2, b3 + iv[1]], t, d, vel - 4)
        note(TIMP, timp_pitch(r), t, 0.8, 110)
        if not arps:
            continue
        for k in range(int(round(d / step))):
            tt_ = t + k * step
            arpp = [b3, b3 + 7, b3 + 12, b3 + 12 + iv[1], b3 + 19, b3 + 12 + iv[1], b3 + 12, b3 + 7][k % 8]
            note(HARP, arpp, tt_, 0.4, 82)
            note(PIZZ, b2 if k % 2 == 0 else b2 + 7, tt_, 0.2, 96)
            pulse(tt_, b1, 0.22, 0.55 if k % 2 == 0 else 0.35, 0.6)
            if taiko and k % 2 == 0:
                note(TAIKO, 38 if k % 4 == 0 else 45, tt_, 0.4, 104 if k % 4 == 0 else 86)


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
    act1()
    act2()
    act3()
    act4()
    act5()
    act6()


# --------------------------------------------------------------------------- ACT I - the brother (0-20)
def act1():
    # 0-4: the shard in the cloud. Drone, a heartbeat that slows, the Unmaker's motif whispered low.
    fx('drone', 0.0, 7.4, P('D1'), 0.20)
    expr([CB, LOW], 0.0, 70)
    note(CB, 'D2', 0.0, 3.95, 64)
    for p, t, d in [('D3', 0.5, 0.9), ('Eb3', 1.45, 0.42), ('D3', 1.9, 0.6), ('Ab2', 2.55, 1.4)]:
        note(LOW, p, t, d, 78)
        note(LOW, P(p) + 12, t, d, 58)
    for t, p in [(0.9, 'Ab6'), (1.7, 'D7'), (2.85, 'Eb7')]:          # the eye, darting
        note(KEYS, p, t, 0.5, 40)
    for t, a in [(0.25, .85), (1.15, .8), (2.15, .75), (3.3, .7)]:   # heartbeat, slowing
        fx('heart', t, a)
    expr([CHOIR, TREM], 2.6, 30)
    ramp([CHOIR, TREM], 2.6, 3.95, 30, 104, shape=1.5)
    chord(CHOIR, ['D3', 'A3'], 2.6, 1.38, 84)                         # the cloud glows crimson
    chord(TREM, ['D3', 'Eb3', 'A3'], 2.6, 1.38, 84)
    roll(TIMP, 'D2', 3.0, 3.93, 20, 110, shape=1.8)
    fx('rcym', 4.0, 1.6, 0.8); fx('riser', 4.0, 1.4, 0.5)

    # 4.0 HIT: the gauntlet bursts up through the cloud
    prog(CHOIR, 3.7, 52)
    expr(ALLMEL, 3.97, 118)
    hit(4.0, 0.9, 'D', 'm', hold=0.7, extra=[P('Eb3')], braam='D1')
    fx('quake', 4.0, 7.0, 0.8)
    # 4.6-7.0 the rising wall: low brass + choir climbing, sub drops, the ground shaking
    wall = [TBN, TUBA, HORN, CHOIR, CB, LOW, TREM]
    expr(wall, 4.58, 64)
    ramp(wall, 4.6, 6.95, 64, 126, shape=1.3)
    for i, (t, rt) in enumerate([(4.6, 'D'), (5.2, 'Eb'), (5.8, 'E'), (6.4, 'F')]):
        b = at(pc(rt), 2)
        d = 0.6 if i < 3 else 0.55
        chord(TBN, [b, b + 7, b + 12], t, d, 100 + 5 * i)
        note(TUBA, b - 12, t, d, 104)
        note(CB, b - 12, t, d, 104)
        chord(HORN, [b + 12, b + 19], t, d, 96 + 5 * i)
        chord(CHOIR, [b + 12, b + 19, b + 24], t, d, 100 + 5 * i)
        chord(LOW, [b, b + 12], t, d, 96)
        chord(TREM, [b + 24, b + 25], t, d, 84)
        fx('subdrop', t, 0.9, 0.45 + 0.1 * i, 75, 22)
    roll(TIMP, 'A2', 6.2, 6.95, 60, 124, rate=19)
    fx('rcym', 7.0, 2.2, 1.0); fx('riser', 7.0, 2.4, 0.8)

    # 7.0 HIT: his eyes ignite -> the Sunderer's motif (Eb3 -> D2 hammered: 7.5, 7.75, 8.0)
    expr(ALLMEL, 6.97, 124)
    hit(7.0, 1.0, 'Eb', 'm', hold=0.45, braam='Eb1')
    sunder(7.0, 0.5, 118, size=0.85, last=1.6, choir=True)
    # 8.0 the last hammer is the stinger under "YOU BROKE MY BROTHER." -> then quiet for the words
    fx('braam', 8.0, P('D1'), 0.8, 0.35, 0.006, 0.7)
    ramp([c for c in ALLMEL if c not in (TIMP, TAIKO)], 8.15, 8.9, 124, 70)
    prog(CHOIR, 8.6, 53)

    # 8.9-20 dialogue bed: quiet under the words
    quiet = [CB, LOW, TREM, CHOIR, VLN]
    expr(quiet, 8.92, 62)
    note(CB, 'D2', 8.95, 10.9, 58)
    chord(LOW, ['D2', 'A2'], 8.95, 7.3, 54)
    chord(TREM, ['A5', 'Bb5'], 9.2, 7.1, 46)                       # high rub
    fx('drone', 8.6, 19.9, P('D1'), 0.13)
    for t in [9.4, 11.6, 12.6, 14.6, 15.6, 17.6]:                 # slow pulse of dread
        pulse(t, 'D1', 0.3, 0.42, 0.45)
        pulse(t + 0.24, 'D1', 0.26, 0.26, 0.35)
    # 10.8 HERO "HE WAS ERASING EVERYTHING." - a light, hard answer
    expr([HARP, PIZZ, TIMP, TAIKO, KEYS], 10.7, 100)
    chord(HARP, ['D3', 'A3', 'E4', 'A4'], 10.8, 1.6, 88)
    chord(PIZZ, ['D2', 'A2', 'E3'], 10.8, 0.4, 108)
    note(KEYS, 'E6', 10.82, 1.0, 58)
    note(TIMP, 'D2', 10.8, 0.8, 96); note(TAIKO, 45, 10.8, 0.5, 84)
    fx('boom', 10.8, 0.4)
    # 13.4 SUNDERER "HE ERASED. I BREAK." - a heavy dark stinger
    expr([TBN, TUBA, HORN], 13.3, 96)
    chord(TBN, ['D2', 'Eb2', 'A2'], 13.4, 1.1, 104)
    note(TUBA, 'D1', 13.4, 1.2, 108)
    note(CB, 'D1', 13.4, 1.2, 100)
    chord(CHOIR, ['D3', 'Eb3'], 13.4, 1.4, 92)
    note(TIMP, 'D2', 13.4, 1.0, 110); note(TAIKO, 38, 13.4, 0.8, 112)
    fx('boom', 13.4, 0.5); fx('anvil', 13.4, 0.35)
    # 16.4 HERO "THEN TRY." - ZENITH re-ignites: the hero theme flares, brief and defiant
    expr([TPT, HORN, TBN, VLN, LOW, TREM, CHOIR], 16.3, 112)
    prog(CHOIR, 16.0, 52)
    stab(16.4, 'D', 'M', 0.6, oct_=3, cym=57)
    hero_frag([TPT, HORN], 'D4', 16.4, [0.25, 0.3, 0.12, 0.13, 0.8], 114)
    scale_run(HARP, 'D3', 'D6', 16.4, 0.5, 80, MAJ, nd=0.6, v1=96)
    for i, p in enumerate(['A6', 'D7', 'F#7']):
        note(KEYS, p, 16.55 + i * 0.12, 0.6, 62)
    chord(TREM, ['D5', 'A5', 'F#6'], 16.4, 1.45, 96)
    chord(CHOIR, ['D4', 'F#4', 'A4'], 16.4, 1.4, 100)
    ramp([TPT, HORN, TREM, CHOIR, VLN, LOW], 17.2, 17.95, 112, 60)
    prog(CHOIR, 18.0, 52)
    # 18.2 SUNDERER "YOU WILL BEG TO BE ERASED." - the dark answer: his motif, then the build to the title
    expr([TBN, TUBA, HORN, CB, LOW, CHOIR, TIMP, TAIKO], 18.12, 108)
    sunder(18.2, 0.4, 108, size=0.6, last=2.2)
    expr([TREM, VLN], 19.0, 40)
    chord(TREM, ['D4', 'Eb4', 'A4'], 19.0, 0.95, 96)
    chord(VLN, ['Eb6', 'D6'], 19.0, 0.95, 90)
    ramp([TREM, VLN, CHOIR, TBN, TUBA, HORN, CB, LOW], 19.0, 19.95, 50, 126, shape=1.5)
    chord(CHOIR, ['D3', 'A3', 'Eb4'], 19.0, 0.95, 104)
    roll(TIMP, 'D2', 19.1, 19.93, 50, 124, rate=19)
    for i, t in enumerate([19.6, 19.7, 19.8, 19.9]):
        note(TAIKO, 45 if i % 2 else 38, t, 0.3, 84 + i * 12)
    fx('braam', 19.0, P('D1'), 0.95, 0.35, 0.8, 0.8)
    fx('rcym', 20.0, 1.5, 1.1); fx('riser', 20.0, 1.6, 0.9)

    # 20.0 HIT: title slam - THE SUNDERER
    expr(ALLMEL, 19.97, 126)
    hit(20.0, 1.1, 'D', 'm', hold=0.8, extra=[P('Eb3'), P('A2')], braam='D1', big=True)
    fx('quake', 20.0, 21.2, 0.6)
    for i, t in enumerate([20.6, 20.7, 20.8, 20.9]):     # taiko pickup into the blitz
        note(TAIKO, 45 if i % 2 else 38, t, 0.3, 84 + i * 12)
    ramp([VLN, LOW, CB, HORN, TPT, TBN, TUBA, CHOIR], 20.4, 20.95, 126, 112)


# --------------------------------------------------------------------------- ACT II - the wall (20-41.2)
def act2():
    expr(ALLMEL, 20.98, 114)
    hits = [22.5, 22.9, 23.3, 23.7, 24.0]
    action_ostinato(21.0, 23.95, 'D', 'm', amp=0.95, amp1=1.1, duck=hits, b2=True)
    chord(TREM, ['D5', 'A5'], 21.0, 2.95, 88)
    # the zenith blitz: the hero motif in the trumpets, then 4 rising stabs that skid off porcelain
    hero_frag([TPT, HORN], 'D4', 21.0, [0.2, 0.2, 0.1, 0.1, 0.3], 112)
    hero_frag([TPT, HORN], 'F4', 21.7, [0.2, 0.2, 0.1, 0.1, 0.25], 116)
    for i, (t, rt) in enumerate(zip([22.5, 22.9, 23.3, 23.7], ['D', 'E', 'F', 'G'])):
        stab(t, rt, 'M', 0.55 + 0.07 * i, oct_=4, cym=57 if i % 2 == 0 else 52, low=False, anvil=0.4)
        fx('zap', t, 0.4)
    # 24.0 HIT: he catches the blade between two fingers
    fx('rcym', 24.0, 0.5, 0.6)
    hit(24.0, 1.0, 'D', 'm', hold=0.4, extra=[P('Eb3')], anvil=0.8)
    # 24.4-25.4 strings straining: the hero can't pull it free
    strain = [TREM, VLN, LOW, HORN, CB]
    expr(strain, 24.38, 64)
    ramp(strain, 24.4, 25.36, 64, 124, shape=1.2)
    chord(TREM, ['D5', 'Eb5', 'A5'], 24.4, 0.98, 104)
    bend(TREM, 24.4, 25.35, 0, 1.2)
    chord(VLN, ['D6', 'Eb6'], 24.4, 0.98, 100)
    bend(VLN, 24.4, 25.35, 0, 1.0)
    chord(HORN, ['A3', 'Bb3'], 24.45, 0.93, 108)
    chord(LOW, ['D2', 'A2'], 24.4, 0.98, 104)
    unbend([TREM, VLN], 25.385)
    for k in range(10):
        pulse(24.4 + k * 0.1, 'D1', 0.09, 0.3 + 0.03 * k, 0.6)
    # 25.4 HIT: a flick of one finger -> a plunging glissando
    expr(ALLMEL, 25.38, 122)
    hit(25.4, 0.95, 'D', 'm', hold=0.3)
    chord(VLN, ['D6', 'A6'], 25.47, 1.05, 112)
    bend(VLN, 25.52, 26.5, 0, -12, shape=1.6)
    chord(TBN, ['D3', 'A3'], 25.5, 1.0, 112)
    bend(TBN, 25.55, 26.5, 0, -12, shape=1.6)
    scale_run(HARP, 'D7', 'D3', 25.45, 0.95, 92, MIN, nd=0.4)
    fx('fall', 25.45, 1.15, 0.9)
    unbend([VLN, TBN], 26.56)
    fx('rcym', 26.6, 0.9, 0.9)
    # 26.6 HIT: it hits the sea - a crater, a wall of water
    hit(26.6, 1.1, 'D', 'm', hold=0.5, extra=[P('Eb3')], braam='D1', big=True)
    fx('quake', 26.6, 28.0, 0.9); fx('tear', 26.62, 0.45)

    # 27.2-31 the combo: brutal stabs, no rest
    combo = [27.6, 28.3, 28.8, 29.3, 29.9]
    drags = [31.6, 32.1, 32.6, 33.0]
    expr(ALLMEL, 27.0, 118)
    action_ostinato(27.1, 32.95, 'D', 'm', amp=1.05, amp1=1.2, duck=combo + drags, b2=True, start_bar=0)
    chord(TREM, ['D4', 'Eb4'], 27.2, 3.75, 92)
    for t, rt, s in zip(combo, ['D', 'Eb', 'C', 'Db', 'D'], [0.9, 0.92, 0.95, 0.97, 1.05]):
        brutal(t, rt, s, cym=57 if rt == 'D' else None)
    # 31.0-33.0 dragged through three spires
    chord(TREM, ['Eb5', 'E5', 'A5'], 31.0, 1.95, 96)
    for t, rt in zip([31.6, 32.1, 32.6], ['Bb', 'B', 'C']):
        hit(t, 0.82, rt, 'm', hold=0.3, choir=False, tpt=False)
        fx('crack', t, 0.5)
    fx('rcym', 33.0, 0.6, 0.8)
    # 33.0 HIT: slammed onto a spire base; the spire explodes
    hit(33.0, 1.1, 'D', 'm', hold=0.45, extra=[P('Eb3')], braam='D1', big=True)
    fx('crack', 33.0, 0.8); fx('shatter', 33.05, 0.35); fx('quake', 33.0, 34.0, 0.7)

    # 33.5-36.0 thin, desperate: tremolo and two weak stabs
    ramp([c for c in ALLMEL if c not in (TIMP, TAIKO)], 33.5, 33.9, 118, 70)
    expr([TREM], 33.6, 52)
    chord(TREM, ['A5', 'Bb5'], 33.7, 2.25, 84)
    ramp([TREM], 33.7, 35.9, 52, 92)
    expr([CB], 33.6, 70)
    note(CB, 'D1', 33.7, 2.25, 70)
    expr([TPT, HORN, TBN, LOW, VLN, TUBA], 34.0, 84)
    stab(34.4, 'D', 'M', 0.32, oct_=4, low=False)
    stab(35.2, 'E', 'm', 0.34, oct_=4, low=False)
    fx('boom', 34.4, 0.35); fx('boom', 35.2, 0.3)

    # 36.0-38.2 WEIGHT: the palm presses down - crushing low cluster, rising pressure
    prog(CHOIR, 35.7, 52)
    w = [TBN, TUBA, CB, LOW, CHOIR, HORN, TREM, VLN]
    expr(w, 35.97, 48)
    ramp(w, 36.0, 38.15, 48, 127, shape=1.6)
    chord(TBN, ['D2', 'Eb2', 'E2', 'F2'], 36.0, 2.15, 112)
    note(TUBA, 'D1', 36.0, 2.15, 112)
    chord(CB, ['D1', 'Eb1'], 36.0, 2.15, 112)
    chord(LOW, ['D2', 'Eb2', 'E2'], 36.0, 2.15, 108)
    chord(CHOIR, ['D3', 'Eb3', 'E3', 'F3'], 36.0, 2.15, 110)
    chord(HORN, ['D3', 'Eb3', 'F3'], 36.0, 2.15, 104)
    chord(TREM, ['D5', 'Eb5', 'E5', 'F5'], 36.0, 2.15, 100)
    bend(TREM, 36.05, 38.1, 0, 3, shape=1.3)
    chord(VLN, ['Eb6', 'E6'], 36.3, 1.85, 96)
    bend(VLN, 36.3, 38.1, 0, 2, shape=1.3)
    unbend([TREM, VLN], 38.17)
    note(TIMP, 'D2', 36.0, 1.0, 116); note(TAIKO, 38, 36.0, 0.8, 120); note(DR, 36, 36.0, 0.4, 120)
    fx('boom', 36.0, 0.7)
    fx('braam', 36.0, P('D1'), 2.15, 0.65, 1.4, 0.9)
    fx('quake', 36.0, 38.25, 1.0)
    roll(TIMP, 'D2', 36.8, 38.13, 40, 127, rate=19, shape=1.5)
    for k in range(11):
        pulse(36.0 + k * 0.2, 'D1', 0.18, 0.3 + 0.05 * k, 0.5)
    fx('rcym', 38.2, 1.4, 1.0); fx('riser', 38.2, 1.6, 0.8)
    # 38.2 HIT: Zenith shatters -> the floor drops out
    expr(ALLMEL, 38.17, 126)
    hit(38.2, 1.1, 'D', 'm', hold=0.4, extra=[P('Eb3')])
    fx('shatter', 38.2, 1.2)
    fx('subdrop', 38.35, 1.8, 1.0, 62, 16)

    # 39.0-41.0 held, terrible chord ("IS THAT ALL?" 39.2), then the crescendo into the punch
    held = [TBN, TUBA, CB, LOW, HORN, CHOIR, TREM]
    expr(held, 38.96, 50)
    ramp(held, 39.0, 39.95, 50, 62)
    ramp(held, 40.0, 40.95, 62, 127, shape=1.5)
    chord(TBN, ['D2', 'Ab2', 'Eb3'], 39.0, 1.88, 104)
    note(TUBA, 'D1', 39.0, 1.88, 104); note(CB, 'D1', 39.0, 1.86, 104)
    chord(LOW, ['D2', 'Ab2'], 39.0, 1.86, 100)
    chord(HORN, ['Eb3', 'A3', 'D4'], 39.0, 1.88, 100)
    chord(CHOIR, ['D3', 'Ab3', 'Eb4', 'A4'], 39.0, 1.8, 104)
    chord(TREM, ['Eb5', 'D6'], 39.0, 1.88, 94)
    fx('drone', 39.0, 40.92, P('D1'), 0.25)
    roll(TIMP, 'D2', 40.1, 40.86, 40, 127, rate=20, shape=1.4)
    fx('rcym', 41.0, 1.1, 1.1); fx('riser', 41.0, 1.3, 0.9); fx('suck', 40.7, 0.28, 0.5)
    # 41.0 HIT: the punch lands, the frame cracks - CUT to silence at 41.2 (segment A ends)
    expr(ALLMEL, 40.97, 127)
    hit(41.0, 1.25, 'D', 'm', hold=0.3, extra=[P('Eb3'), P('Ab2')], braam='D1', big=True)
    fx('crack', 41.0, 1.0)


# --------------------------------------------------------------------------- ACT III - beyond (41.2-58)
def act3():
    expr(ALLMEL, 41.3, 100)
    prog(CHOIR, 41.3, 53)
    # 41.2-44.5: near silence. One low drone; a fragile oboe plays the hero motif, unfinished (no octave)
    fx('drone', 41.8, 46.0, P('D1'), 0.14)
    expr([LOW, CB], 41.3, 56)
    note(LOW, 'D2', 41.9, 2.6, 50)
    note(LOW, 'A2', 41.9, 2.6, 40)
    expr([SOLO], 41.3, 92)
    for p, t, d, v in [('D5', 41.9, 0.6, 74), ('A5', 42.55, 0.9, 80), ('B5', 43.5, 0.35, 70), ('A5', 43.9, 0.62, 76)]:
        note(SOLO, p, t, d, v)
    # 44.5-46.0 the orbs flare and dive in: a swell, timpani roll, choir rising (dominant of E)
    prog(CHOIR, 44.2, 52)
    sw = [TREM, VLN, LOW, CB, CHOIR, HORN, TBN, TUBA]
    expr(sw, 44.45, 30)
    ramp(sw, 44.5, 45.95, 30, 127, shape=1.4)
    chord(TREM, ['B3', 'E4', 'F#4', 'B4'], 44.5, 0.75, 100)
    chord(TREM, ['B3', 'D#4', 'F#4', 'A4'], 45.25, 0.7, 104)
    scale_run(CHOIR, 'B3', 'B4', 44.5, 1.4, 96, MIXO, nd=0.32)
    chord(CHOIR, ['B3', 'D#4', 'F#4'], 45.6, 0.36, 110)
    note(CB, 'B1', 44.5, 1.45, 100)
    chord(LOW, ['B2', 'F#3'], 44.5, 1.45, 100)
    chord(TBN, ['B2', 'F#3', 'A3'], 45.0, 0.95, 104); note(TUBA, 'B1', 45.0, 0.95, 104)
    chord(HORN, ['F#3', 'B3', 'D#4'], 45.2, 0.75, 104)
    chord(VLN, ['F#5', 'B5'], 45.2, 0.75, 96)
    roll(TIMP, 'B2', 44.5, 45.94, 26, 127, rate=19, shape=1.5)
    expr([HARP, KEYS], 45.0, 100)
    scale_run(HARP, 'B2', 'B5', 45.2, 0.7, 80, MIXO, nd=0.5)
    note(KEYS, 'B6', 45.4, 0.5, 60); note(KEYS, 'E7', 45.6, 0.5, 64)
    fx('rcym', 46.0, 1.5, 1.1); fx('riser', 46.0, 1.5, 1.0)

    # 46.0 HIT: "ZENITH... NOVA!" - the hero theme in a new, higher key (E major), full force
    expr(ALLMEL, 45.96, 127)
    nova_hits = [46.0, 47.6, 48.6, 49.2, 49.8, 50.6, 51.6, 53.2]
    hit(46.0, 1.2, 'E', 'M', hold=0.75, tpt=False, big=True)
    LAY = [(TPT, 0, 0), (HORN, 0, 0), (HORN, -12, -6), (VLN, 12, -4), (VLN, 0, -10)]
    theme('E4', 46.0, 0.8, 0, 5, LAY, 120, cut=48.55)       # 46.0 E 46.4 B 47.2 C# 47.4 B 47.6 E' (on the HIT)
    chord(CHOIR, ['E4', 'G#4', 'B4'], 46.0, 1.55, 112)
    chord(TREM, ['E5', 'G#5', 'B5'], 46.0, 1.55, 100)
    scale_run(VLN, 'E5', 'E7', 46.25, 1.0, 96, MAJ, nd=0.25, v1=120)     # the sword grows
    scale_run(HARP, 'E3', 'E6', 46.05, 0.6, 84, MAJ, nd=0.5)
    action_ostinato(46.4, 53.2, 'E', 'M', amp=0.95, amp1=1.15, vln=False, duck=nova_hits)
    fx('riser', 47.6, 1.4, 0.8)
    # 47.6 HIT: the giant blade comes down, cleaving the sea
    hit(47.6, 1.15, 'E', 'M', hold=0.6, tpt=False)
    fx('tear', 47.62, 0.5); fx('quake', 47.6, 48.6, 0.6)
    # 48.6 / 49.2 / 49.8: giant-blade combo stabs, rising
    stab(48.6, 'C#', 'm', 0.75, oct_=3, cym=57)
    stab(49.2, 'A', 'M', 0.8, oct_=3, cym=52)
    stab(49.8, 'B', 'M', 0.85, oct_=3, cym=57)
    for t, p in [(48.6, 'G#5'), (49.2, 'A5'), (49.8, 'B5')]:
        note(TPT, p, t, 0.5, 120); note(VLN, P(p) + 12, t, 0.55, 112)
    # 50.6 / 51.6 / 53.2 HITs - the wound, the crown, the pin
    hit(50.6, 1.05, 'C', 'M', hold=0.45, anvil=0.4)
    fx('crack', 50.6, 0.5)
    hit(51.6, 1.08, 'D', 'M', hold=0.45)
    fx('shatter', 51.6, 0.55)
    for t, p, d in [(50.6, 'G5', .48), (51.1, 'E5', .45), (51.6, 'F#5', .48), (52.1, 'A5', .38),
                    (52.5, 'G#5', .28), (52.8, 'F#5', .35)]:
        note(TPT, p, t, d, 118); note(HORN, P(p) - 12, t, d, 112); note(VLN, P(p) + 12, t, d, 110)
    fx('rcym', 53.2, 0.8, 0.8)
    hit(53.2, 1.15, 'E', 'M', hold=0.7, big=True, anvil=0.6)
    note(TPT, 'E5', 53.2, 0.7, 124); note(VLN, 'E6', 53.2, 0.8, 116)
    fx('crack', 53.2, 0.6)

    # 54.0-55.6: he laughs, low, and pulls the blade out: his motif, slow and enormous (back to D)
    prog(CHOIR, 53.7, 52)
    vm = [TBN, TUBA, HORN, CB, LOW, CHOIR, TREM]
    expr(vm, 53.98, 124)
    sunder(54.0, 0.5, 120, size=1.0, last=1.0, choir=True)
    chord(TREM, ['D3', 'Eb3', 'A3'], 54.0, 1.55, 96)
    fx('braam', 54.5, P('D1'), 0.8, 0.5, 0.01, 0.8)
    fx('drone', 54.0, 55.5, P('D1'), 0.3)
    roll(TIMP, 'D2', 55.1, 55.48, 70, 124, rate=20)
    fx('rcym', 55.6, 1.0, 1.0)
    # 55.6 HIT: his brother's shard - the spiral eye opens: the two villain motifs FUSE
    expr(ALLMEL, 55.57, 127)
    hit(55.6, 1.2, 'Eb', 'm', hold=0.38, extra=[P('Ab2')], braam='Eb1', big=True)
    for t, p, d in [(55.6, 'D4', 0.4), (56.0, 'Eb4', 0.2), (56.2, 'D4', 0.2), (56.4, 'Ab3', 1.55)]:   # Unmaker on top
        chord(CHOIR, [P(p), P(p) + 12 if P(p) + 12 <= 76 else P(p)], t, d, 120)
        chord(HORN, [P(p), P(p) - 12], t, d, 120)
        note(TPT, P(p) + 12 if P(p) + 12 <= 76 else P(p), t, d, 110)
    sunder(55.6, 0.4, 122, size=1.0, hi=False, last=4.0)    # hammers under it: 56.0, 56.2, 56.4 -> D held
    dim = [p for p in range(P('D5'), P('D7') + 1) if (p - P('D5')) % 12 in DIM]
    seq = dim + dim[::-1][1:-1]
    expr([KEYS, HARP], 55.5, 96)
    for k in range(30):                                       # the spiral eye (part III's kaleidoscope)
        note(KEYS, seq[k % len(seq)], 55.65 + k * 0.05, 0.2, 60 + 14 * math.sin(k / 5))
    scale_run(HARP, 'D3', 'C6', 55.7, 0.8, 78, WHOLE, nd=0.5)
    # 56.4-58.0 held ("BROTHER. SEE THIS."), then the crescendo into the REWIND
    hold = [CHOIR, TREM, TBN, TUBA, CB, LOW, HORN]
    ramp(hold, 56.5, 57.2, 127, 72)
    ramp(hold, 57.2, 57.96, 72, 127, shape=1.5)
    chord(TREM, ['D5', 'Eb5', 'Ab5'], 56.4, 1.55, 100)
    chord(TBN, ['D2', 'Ab2'], 56.4, 1.55, 104)
    chord(CHOIR, ['D3', 'Eb4'], 56.4, 1.55, 104)
    fx('drone', 56.4, 58.0, P('D1'), 0.35)
    roll(TIMP, 'D2', 57.2, 57.95, 50, 127, rate=20, shape=1.3)
    fx('rcym', 58.0, 1.2, 1.1); fx('riser', 58.0, 1.0, 0.8)
    # 58.0 HIT: REWIND - then the music itself rewinds (tape reverses, a reversed swell, a pitch drop)
    expr(ALLMEL, 57.97, 127)
    hit(58.0, 1.1, 'D', 'm', hold=0.6, extra=[P('Eb3'), P('Ab2')], braam='D1')
    fx('shatter', 58.0, 0.35)


# --------------------------------------------------------------------------- ACT IV - the stranger power (58-104)
def act4():
    expr(ALLMEL, 60.0, 100)
    prog(CHOIR, 60.0, 53)
    prog(SOLO, 79.0, 40)
    # 60-62 horror beat: silence but for a high string
    expr([VLN], 60.0, 60)
    note(VLN, 'A6', 60.06, 1.88, 86)
    ramp([VLN], 60.06, 61.9, 60, 92)
    fx('suck', 61.5, 0.48, 0.6)
    # 62.0 SUNDER: the biggest HIT so far - the world splits
    prog(CHOIR, 61.6, 52)
    expr(ALLMEL, 61.97, 127)
    hit(62.0, 1.35, 'D', 'm', hold=1.0, extra=[P('Eb3'), P('Ab2')], braam='D1', big=True, anvil=0.5)
    fx('tear', 62.0, 1.3); fx('boom', 62.006, 0.6); fx('shatter', 62.0, 0.5)
    fx('quake', 62.0, 64.0, 1.0)
    note(DR, 52, 62.0, 2.0, 120)
    chord(TREM, ['D2', 'Eb2', 'A2'], 62.4, 1.15, 96)                # the molten chasm
    chord(CHOIR, ['D3', 'Ab3'], 62.6, 0.95, 96)
    ramp([TREM, CHOIR, TBN, TUBA, CB, LOW, HORN, VLN], 62.9, 63.55, 127, 76)
    # 63.6 STORM FORM flares: the storm theme fragment (E major, part III) - cut off at 64.6
    expr([TPT, HORN, TBN, VLN, LOW, PIZZ, CB, TUBA], 63.55, 116)
    stab(63.6, 'E', 'M', 0.62, oct_=4, cym=57, low=False)
    hero_frag([TPT, HORN], 'E4', 63.6, [0.15, 0.2, 0.08, 0.08, 0.45], 120)
    action_ostinato(63.7, 64.55, 'E', 'M', amp=0.85, vln=False, duck=(64.6,))
    fx('zap', 63.6, 0.6)
    fx('zap', 64.2, 0.9); fx('whoosh', 64.2, 0.38, 0.8)                   # the lightning dash
    scale_run(VLN, 'E5', 'E7', 64.2, 0.35, 104, MAJ, nd=0.12)
    # 64.6 HIT: caught like a fly. 65.2 HIT: smashed into the chasm wall
    hit(64.6, 1.0, 'D', 'm', hold=0.35, extra=[P('Eb3')], anvil=0.7)
    hit(65.2, 1.1, 'D', 'm', hold=0.5, braam='D1', big=True)
    fx('crack', 65.2, 0.8); fx('quake', 65.2, 66.2, 0.7)

    # 66-72 THE BEATING: every blow a hit; between them the hero motif tries to start and is cut off
    blows = [66.6, 67.4, 68.1, 68.7, 69.3, 70.0, 71.4]
    expr(ALLMEL, 65.9, 116)
    note(CB, 'D1', 66.0, 5.95, 80)
    expr([TREM], 65.9, 70)
    chord(TREM, ['D3', 'Eb3'], 66.0, 5.95, 76)
    t = 66.05
    while t < 71.95:                                                    # a dread pulse under it all
        if all(abs(t - b) > 0.15 for b in blows):
            pulse(t, 'D1', 0.16, 0.38, 0.5)
        t += 0.2
    brutal(66.6, 'D', 0.92)                                             # a punch; the guard holds
    hit(67.4, 1.02, 'D', 'm', hold=0.32, choir=False, extra=[P('Eb3')], anvil=0.6)   # the guard breaks
    fx('crack', 67.4, 0.5); fx('whoosh', 67.08, 0.32, 0.5)
    brutal(68.1, 'Eb', 0.92)                                            # body blows
    brutal(68.7, 'C', 0.95)
    brutal(69.3, 'Db', 0.98)
    hit(70.0, 1.05, 'D', 'm', hold=0.4, choir=False)                    # it falls
    fx('whoosh', 69.68, 0.32, 0.5); fx('quake', 70.0, 70.9, 0.5)
    fx('whoosh', 71.06, 0.34, 0.7)
    hit(71.4, 1.12, 'D', 'm', hold=0.55, extra=[P('Eb3')], braam='D1', big=True)   # he steps on it
    fx('quake', 71.4, 72.6, 0.9); fx('crack', 71.4, 0.6)
    attempts = [(66.82, 67.4, [('D4', .26), ('A4', .4)]),
                (67.66, 68.1, [('D4', .2), ('A4', .3)]),
                (68.3, 68.7, [('D4', .18), ('A4', .25)]),
                (68.9, 69.3, [('D4', .18), ('A4', .25)]),
                (69.5, 70.0, [('D4', .18), ('A4', .2), ('B4', .15)]),
                (70.35, 71.4, [('D4', .35), ('A4', .38), ('B4', .3), ('A4', .3)])]   # never reaches the octave
    expr([SOLO], 66.0, 110)
    prog(SOLO, 66.0, 56)                                                # a lone trumpet (solo channel)
    for t0, tc, ns in attempts:
        t = t0
        for p, d in ns:
            if t >= tc - 0.04:
                break
            dd = min(d * 0.97, tc - 0.035 - t)
            note(SOLO, p, t, dd, 92 if t0 < 70 else 98)
            note(HORN, p, t, dd, 78)
            t += d
    prog(SOLO, 72.0, 40)

    # 72-77 THE ORBS: plucked and crushed one at a time - four descending crushing chords
    expr(ALLMEL, 72.0, 100)
    note(CB, 'D1', 72.0, 1.0, 70)
    chord(TREM, ['D6', 'Eb6'], 72.0, 0.95, 60)
    orbs = [(73.0, 'D', ['D6', 'F#6', 'A6', 'D7']), (74.0, 'C', ['G5', 'B5', 'D6', 'G6']),
            (75.0, 'Bb', ['E6', 'G#6', 'B6', 'E7']), (76.0, 'Ab', ['A6', 'C#7', 'E7', 'A7'])]
    for i, (t, rt, sp) in enumerate(orbs):
        for j, p in enumerate(sp):                                      # the element's colour flares
            note(KEYS, p, t - 0.42 + j * 0.08, 0.35, 66)
            note(HARP, P(p) - 12, t - 0.42 + j * 0.08, 0.4, 76)
        fx('zap', t - 0.42, 0.25)
        r = pc(rt)
        b = [38, 36, 34, 32][i]                                       # D2, C2, Bb1, Ab1: descending
        v = 112 + 4 * i
        ex = [TBN, TUBA, HORN, CB, LOW, CHOIR, VLN, TREM]
        expr(ex, t - 0.05, 120)
        chord(TBN, [b, b + 3, b + 7, b + 13], t, 0.8, v)
        note(TUBA, b - 12 if b - 12 >= 26 else b, t, 0.85, v)
        note(CB, b - 12 if b - 12 >= 24 else b, t, 0.85, v)
        chord(HORN, [b + 12, b + 13, b + 15, b + 19], t, 0.8, v - 2)
        chord(CHOIR, [b + 12, b + 13, b + 19], t, 0.9, v)
        chord(LOW, [b, b + 12, b + 13], t, 0.8, v)
        chord(VLN, [b + 24, b + 25, b + 31], t, 0.75, v - 6)
        chord(TREM, [b + 27, b + 31], t, 0.8, v - 10)
        bend(VLN, t + 0.15, t + 0.82, 0, -2, shape=1.5)
        bend(TREM, t + 0.15, t + 0.82, 0, -2, shape=1.5)
        unbend([VLN, TREM], t + 0.9)
        note(TIMP, timp_pitch(r), t, 0.9, 124)
        note(TAIKO, 38, t, 0.8, 127); note(TAIKO, 45, t + 0.003, 0.8, 118)
        note(DR, 36, t, 0.3, 127); note(DR, 35, t, 0.3, 120)
        note(DR, 52 if i % 2 else 57, t, 1.2, 96 + 6 * i)
        fx('boom', t, 0.8 + 0.08 * i)
        fx('anvil', t, 0.35)
        fx('suck', t + 0.12, 0.6, 0.45 + 0.1 * i)                       # the colour dies
        ramp(ex, t + 0.35, t + 0.92, 120, 70)
    # 77-80 the long drop into the dark of the chasm: falling, fading
    fl = [TREM, LOW, CB, CHOIR, VLN]
    expr(fl, 76.98, 96)
    ramp(fl, 77.4, 79.9, 96, 6, shape=0.8)
    chord(TREM, ['D5', 'F5', 'Ab5'], 77.0, 2.9, 96)
    bend(TREM, 77.05, 79.9, 0, -12, shape=1.3)
    chord(LOW, ['D3', 'A3'], 77.0, 2.9, 92)
    bend(LOW, 77.05, 79.9, 0, -12, shape=1.3)
    chord(CHOIR, ['D4', 'Ab4'], 77.0, 2.5, 84)
    unbend([TREM, LOW], 79.97)
    scale_run(HARP, 'C7', 'D3', 77.0, 2.6, 70, WHOLE, nd=0.6, v1=30)
    roll(TIMP, 'D2', 77.0, 79.0, 84, 14, rate=15)
    fx('fall', 77.0, 2.9, 0.75); fx('subdrop', 77.0, 3.0, 0.6, 50, 16)

    # 80-88 ALL HOPE LOST: near silence; a heartbeat; "STAY DOWN." (81.0); a solo violin at 86.5
    prog(CHOIR, 80.0, 53)
    expr(ALLMEL, 80.0, 100)
    fx('drone', 80.0, 88.0, P('D1'), 0.085)
    expr([TREM], 80.0, 52)
    chord(TREM, ['D6', 'A6'], 80.2, 6.2, 50)                            # the molten light far above
    for t, a in [(80.45, .75), (81.6, .7), (82.75, .72), (83.7, .8), (84.6, .78), (85.65, .66), (86.85, .6),
                 (87.55, .55)]:
        fx('heart', t, a)
    expr([CB, TBN], 80.9, 64)
    note(CB, 'Eb2', 81.0, 0.32, 68); note(TBN, 'Eb2', 81.0, 0.32, 58)   # "STAY DOWN." - the ninth, distant
    note(CB, 'D1', 81.35, 1.4, 74); note(TBN, 'D2', 81.35, 1.2, 60)
    expr([SOLO], 86.4, 98)
    note(SOLO, 'F#4', 86.5, 0.68, 104)
    note(SOLO, 'C#5', 87.2, 0.8, 108)
    ramp([SOLO], 86.5, 87.97, 98, 124)
    # 87.2-88.0 swell into LAST LIGHT (dominant of F# minor)
    prog(CHOIR, 87.0, 52)
    sw = [TREM, CHOIR, LOW, CB, HORN, TBN, VLN]
    expr(sw, 87.15, 30)
    ramp(sw, 87.2, 87.96, 30, 127, shape=1.5)
    chord(TREM, ['C#4', 'F4', 'G#4', 'B4'], 87.2, 0.76, 104)
    chord(CHOIR, ['C#4', 'F4', 'G#4'], 87.2, 0.76, 108)
    note(CB, 'C#2', 87.2, 0.76, 104); chord(LOW, ['C#3', 'G#3'], 87.2, 0.76, 104)
    chord(TBN, ['C#2', 'G#2'], 87.35, 0.6, 104)
    roll(TIMP, 'C#3', 87.3, 87.95, 40, 127, rate=20)
    fx('rcym', 88.0, 1.3, 1.1); fx('riser', 88.0, 1.0, 0.9)

    # 88.0 HIT: "LAST LIGHT!" - the hero theme in a burning minor key (F# minor)
    expr(ALLMEL, 87.97, 127)
    ll_hits = [88.0, 90.6, 91.4, 92.0, 92.6, 93.2, 94.2, 95.4, 96.6, 97.4, 100.0]
    hit(88.0, 1.2, 'F#', 'm', hold=0.8, tpt=False, braam='F#1', big=True)
    theme('F#4', 88.0, 0.8, 0, 5, LAY_B, 122, minor=True, cut=90.6)
    note(SOLO, 'F#5', 88.0, 1.5, 110)
    chord(CHOIR, ['F#3', 'C#4', 'F#4', 'A4'], 88.0, 1.15, 118)
    chord(CHOIR, ['D4', 'F#4', 'A4'], 89.2, 1.35, 118)
    chord(TREM, ['F#5', 'A5', 'C#6'], 88.0, 2.5, 104)
    scale_run(VLN, 'F#5', 'F#7', 88.5, 1.4, 96, HMIN, nd=0.25, v1=122)     # the blade erupts, miles long
    fx('quake', 88.0, 90.0, 0.6); fx('riser', 90.6, 1.6, 0.8)
    action_ostinato(88.8, 99.95, 'F#', 'm', amp=1.0, amp1=1.2, vln=False, duck=ll_hits)
    hit(90.6, 1.1, 'D', 'M', hold=0.45)                                   # out of the chasm into him
    for t, rt, q, s in [(91.4, 'F#', 'm', .9), (92.0, 'D', 'M', .93), (92.6, 'B', 'm', .96), (93.2, 'C#', 'M', 1.0)]:
        hit(t, s, rt, q, hold=0.3, cym=True)                              # trades at full power
    for t, p, d in [(90.6, 'F#5', .75), (91.4, 'A5', .55), (92.0, 'F#5', .55), (92.6, 'D5', .55), (93.2, 'E#5', .9)]:
        note(TPT, p, t, d, 122); note(VLN, P(p) + 12, t, d, 112)
    hit(94.2, 1.08, 'F#', 'm', hold=0.45)                                # severs the lower-left arm
    fx('tear', 94.2, 0.45)
    hit(95.4, 1.1, 'D', 'M', hold=0.45)                                  # the lower-right; he roars
    fx('braam', 95.5, P('D1'), 1.0, 0.5, 0.25, 0.9)
    hit(96.6, 1.1, 'B', 'm', hold=0.45)                                  # across his mask
    fx('crack', 96.6, 0.6)
    for t, p, d in [(94.2, 'F#5', .3), (94.5, 'C#5', .38), (94.9, 'D5', .45), (95.4, 'F#5', .3), (95.7, 'E5', .38),
                    (96.1, 'F#5', .45), (96.6, 'B5', .3), (96.9, 'G#5', .45)]:
        note(TPT, p, t, d, 120); note(HORN, P(p) - 12, t, d, 114); note(VLN, P(p) + 12, t, d, 112)
    # 97.4 HIT: he catches the colossal blade - it stops dead. Then the straining crescendo to 100
    hit(97.4, 1.15, 'D', 'm', hold=0.45, extra=[P('Eb3')], braam='D1', anvil=0.8)
    st = [TREM, CHOIR, HORN, TPT, TBN, TUBA, VLN, LOW, CB]
    expr(st, 97.88, 84)
    ramp(st, 97.9, 99.95, 84, 127, shape=1.2)
    chord(TREM, ['F#5', 'G5', 'C#6'], 97.9, 2.05, 104)
    bend(TREM, 97.9, 99.9, 0, 2, shape=1.2)
    unbend([TREM], 99.97)
    chord(CHOIR, ['F#3', 'C#4', 'F#4', 'A4'], 97.9, 2.05, 112)
    for t, p, d in [(97.9, 'C#5', 0.78), (98.7, 'D5', 0.68), (99.4, 'E5', 0.55)]:   # the hero pushing
        note(TPT, p, t, d, 120); note(HORN, P(p) - 12, t, d, 116); note(VLN, P(p) + 12, t, d, 112)
    chord(TBN, ['D2', 'Eb2'], 97.9, 2.05, 112); note(TUBA, 'D1', 97.9, 2.05, 112)
    note(CB, 'D1', 97.9, 2.05, 110)
    roll(TIMP, 'F#2', 98.8, 99.95, 60, 127, rate=20)
    for k, t in enumerate(np.arange(99.2, 99.9, 0.1)):
        note(TAIKO, 45, t, 0.2, 90 + 5 * k)
    fx('rcym', 100.0, 1.6, 1.2); fx('riser', 100.0, 2.0, 1.0)
    # 100.0 HIT: he SNAPS the giant blade. 100.8 HIT: point-blank, third eye blazing - driven down
    expr(ALLMEL, 99.97, 127)
    hit(100.0, 1.2, 'D', 'm', hold=0.32, extra=[P('Eb3'), P('Ab2')], big=True)
    fx('shatter', 100.0, 1.2); fx('crack', 100.0, 0.8)
    fx('suck', 100.5, 0.28, 0.5)
    hit(100.8, 1.25, 'Eb', 'm', hold=0.45, extra=[P('Ab2'), P('D3')], braam='Eb1', big=True)
    fx('subdrop', 100.85, 2.6, 1.0, 70, 15); fx('fall', 101.0, 2.8, 0.85)
    # 101-104 the fall into the dark: collapse into silence
    co = [TREM, LOW, CB, CHOIR, TBN, VLN]
    expr(co, 101.25, 112)
    ramp(co, 101.3, 103.7, 112, 0, shape=0.7)
    chord(TREM, ['D4', 'Eb4', 'Ab4'], 101.25, 2.5, 104)
    bend(TREM, 101.3, 103.7, 0, -12, shape=1.2)
    chord(LOW, ['D3', 'Ab3'], 101.25, 2.5, 100)
    bend(LOW, 101.3, 103.7, 0, -12, shape=1.2)
    chord(CHOIR, ['D3', 'Eb4'], 101.25, 2.0, 100)
    note(CB, 'D1', 101.25, 2.4, 100)
    roll(TIMP, 'D2', 101.2, 103.0, 96, 10, rate=16)
    unbend([TREM, LOW], 103.98)


LAY_B = [(TPT, 0, 0), (HORN, 0, 0), (HORN, -12, -6), (VLN, 12, -4), (VLN, 0, -10)]


# --------------------------------------------------------------------------- ACT V - infinite (104-150)
def act5():
    expr(ALLMEL, 104.0, 100)
    prog(KEYS, 103.5, 0)
    prog(CHOIR, 104.0, 53)
    # 104-110.5 rock bottom: a single piano note per ember (1-5-6-5: the theme without its octave)
    for t, p in [(104.6, 'D5'), (105.4, 'A5'), (106.2, 'B5'), (107.0, 'A5')]:
        note(KEYS, p, t, 1.8, 86)
    fx('drone', 107.6, 110.6, P('D1'), 0.10)
    expr([LOW], 108.0, 56)
    note(LOW, 'D2', 108.0, 2.45, 52)
    for t, a in [(108.7, .55), (109.75, .65), (110.3, .75)]:          # a heartbeat returns
        fx('heart', t, a)
    # 110.5-113 every form flashes through, faster and faster: accelerating ostinato, choir building
    prog(KEYS, 110.2, 8)
    prog(CHOIR, 110.2, 52)
    cas = [TREM, LOW, CB, CHOIR, VLN, TBN, TUBA, HORN, PIZZ, TPT]
    expr(cas, 110.47, 52)
    ramp(cas, 110.5, 112.95, 52, 127, shape=1.2)
    forms = [(110.5, 0.6, 'D', 'M', 'F#5'), (111.1, 0.5, 'E', 'M', 'G#5'), (111.6, 0.4, 'F#', 'm', 'A5'),
             (112.0, 0.35, 'E', 'M', 'B5'), (112.35, 0.25, 'F#', 'm', 'C#6'), (112.6, 0.38, 'D', '7', 'C6')]
    for t, d, rt, q, top in forms:                                    # gold, storm, zenith, nova, last light, ...
        r, iv = tones(rt, q)
        b2 = at(r, 2)
        note(CB, at(r, 1) if at(r, 1) >= 26 else b2, t, d, 104)
        note(TUBA, at(r, 1) if at(r, 1) >= 26 else b2, t, d, 92)
        chord(TBN, [b2, b2 + 7, b2 + 12 + iv[1]], t, d, 96)
        chord(LOW, [b2 + 12, b2 + 19], t, d, 96)
        chord(CHOIR, [b2 + 12 + i for i in iv[1:3]] + [b2 + 24], t, d, 110)
        chord(TREM, [b2 + 24 + i for i in iv[:3]], t, d, 96)
        note(VLN, top, t, d, 104); note(VLN, P(top) - 12, t, d, 98)
        fx('zap', t, 0.35)
        scale_run(KEYS, 'D6', 'D7', t + 0.02, min(0.3, d * 0.8), 58, MAJ, nd=0.25, v1=78)
        note(HORN, b2 + 12, t, d * 0.9, 100); note(HORN, b2 + 19, t, d * 0.9, 100)
    t, rate = 110.5, 3.0
    while t < 112.92:                                                 # accelerating 3 -> 16 per s
        x = (t - 110.5) / 2.45
        rt = [f[2] for f in forms if f[0] <= t + 1e-6][-1]
        r = pc(rt)
        pulse(t, at(r, 1), min(0.22, 1.0 / rate), 0.5 + 0.5 * x, 0.6 + 0.4 * x)
        note(PIZZ, at(r, 2), t, 0.15, 84 + 30 * x)
        note(PIZZ, at(r, 3), t, 0.15, 76 + 30 * x)
        if rate < 8:
            note(TAIKO, 45, t, 0.3, 74 + 40 * x)
        rate = 3.0 * (16 / 3) ** x
        t += 1.0 / rate
    roll(TIMP, 'A2', 112.1, 112.93, 70, 127, rate=21)
    for t in np.arange(112.2, 112.9, 0.1):
        note(TAIKO, 38, t, 0.2, 100 + (t - 112.2) * 35)
    fx('rcym', 113.0, 2.4, 1.25); fx('riser', 113.0, 2.5, 1.2)

    # 113.0 HIT: "FABLE... INFINITE!" - the biggest hero hit yet; the full theme in G major
    expr(ALLMEL, 112.96, 127)
    hit(113.0, 1.35, 'G', 'M', hold=1.0, tpt=False, big=True)
    note(DR, 52, 113.0, 2.0, 104)
    k = 0.952
    LAYI = [(TPT, 0, 0), (HORN, 0, 0), (HORN, -12, -6), (VLN, 12, -4), (VLN, 0, -10), (CHOIR, 0, -8)]
    theme('G4', 113.0, k, 0, 9, LAYI, 122)                            # G D E D G' F# E C E -> A at 118.0
    bed([(113.0, 1.9, 'G', 'M'), (114.9, 0.96, 'E', 'm'), (115.86, 0.95, 'C', 'M'), (116.81, 0.95, 'A', 'm'),
         (117.76, 0.22, 'D', 'M')], vel=106, choir_v=110)
    note(DR, 57, 114.9, 1.4, 100); fx('rcym', 114.9, 0.9, 0.5)
    for t0 in (113.3, 114.3, 115.3, 116.3, 117.3):                    # the ascent: one continuous rise
        scale_run(HARP, 'G3', 'G6', t0, 0.6, 80, MAJ, nd=0.4)
        scale_run(KEYS, 'G5', 'G7', t0 + 0.1, 0.5, 60, MAJ, nd=0.25)
    roll(TIMP, 'D2', 117.3, 117.95, 80, 127, rate=21)
    fx('riser', 118.0, 1.8, 1.1); fx('rcym', 118.0, 1.2, 1.2)

    # 118.0 HIT: THE WORLDBLADE - an enormous sustained chord (G add9, organ + everything), 118-122
    prog(KEYS, 117.6, 19)
    expr(ALLMEL, 117.97, 127)
    hit(118.0, 1.3, 'G', 'M', hold=3.8, extra=[P('A2')], tpt=False, big=True)
    chord(TPT, ['D5', 'G5', 'A5'], 118.0, 3.7, 120)
    chord(KEYS, ['G2', 'D3', 'G3', 'B3', 'D4', 'A4', 'D5'], 118.0, 3.9, 104)
    chord(CHOIR, ['G3', 'B3', 'D4', 'A4', 'B4', 'D5'], 118.0, 3.9, 118)
    chord(TREM, ['G5', 'B5', 'D6', 'A6'], 118.0, 3.9, 104)
    chord(VLN, ['D6', 'G6', 'A6'], 118.0, 3.9, 108)
    note(VLN, 'C#6', 120.0, 1.9, 92)                                  # a lydian shimmer: the world's curve
    scale_run(HARP, 'G2', 'G6', 118.05, 0.9, 92, MAJ, nd=0.8)
    scale_run(HARP, 'D3', 'D7', 120.0, 0.9, 84, {0, 2, 4, 6, 7, 9, 11}, nd=0.8)
    big = [CHOIR, TREM, VLN, HORN, TBN, TUBA, LOW, CB, TPT, KEYS]
    ramp(big, 118.6, 119.1, 127, 100)
    ramp(big, 119.1, 121.85, 100, 127, shape=1.2)
    roll(TIMP, 'G2', 119.2, 121.9, 50, 120, rate=17, shape=1.4)
    fx('drone', 118.0, 122.0, P('G1'), 0.32)
    fx('suck', 121.35, 0.62, 0.9); fx('rcym', 122.0, 1.3, 1.1)

    # 122.0 HIT: he tears the sun out of the sky - the BLACK SUN. Darkness; his motif (fused)
    prog(KEYS, 122.3, 8)
    expr(ALLMEL, 121.97, 127)
    hit(122.0, 1.25, 'Eb', 'm', hold=0.45, extra=[P('Ab2')], braam='Eb1', big=True)
    sunder(122.0, 0.5, 120, size=1.0, hi=True, last=1.2, choir=False)  # Eb -> D 122.5, 122.75, 123.0
    fx('subdrop', 122.05, 2.4, 0.9, 60, 15)
    prog(CHOIR, 122.6, 53)
    dk = [TREM, CHOIR, CB, TBN, TUBA, LOW, HORN]
    ramp(dk, 123.0, 123.6, 127, 84)
    fx('drone', 122.4, 127.0, P('D1'), 0.3)
    chord(TREM, ['D2', 'Eb2', 'Ab2'], 123.2, 3.75, 92)
    for t in np.arange(123.5, 126.9, 0.5):                           # the black sun pulses
        pulse(t, 'D1', 0.4, 0.62, 0.45)
    for p, t, d in [('D4', 123.2, 0.75), ('Eb4', 124.0, 0.3), ('D4', 124.3, 0.4), ('Ab3', 124.7, 2.25)]:
        chord(CHOIR, [P(p), P(p) - 12], t, d, 112)                     # the Unmaker's line, sung in the dark
        note(HORN, P(p) - 12, t, d, 96)
    note(CB, 'D1', 123.2, 3.75, 100); note(TUBA, 'D1', 123.6, 3.35, 90)
    # 125.0 "THEN WE BOTH END." held -> crescendo into the CLASH
    prog(CHOIR, 125.4, 52)
    cl = [TREM, CHOIR, TBN, TUBA, CB, LOW, HORN, VLN]
    ramp(cl, 125.6, 126.96, 84, 127, shape=1.4)
    chord(TBN, ['D2', 'Ab2', 'Eb3'], 125.6, 1.38, 108)
    chord(VLN, ['Eb6', 'D6'], 125.6, 1.38, 96)
    chord(CHOIR, ['D3', 'Ab3', 'Eb4'], 125.6, 1.38, 112)
    roll(TIMP, 'D2', 126.0, 126.95, 50, 127, rate=20)
    fx('rcym', 127.0, 1.5, 1.2); fx('riser', 127.0, 1.6, 1.1)
    fx('braam', 125.6, P('D1'), 1.4, 0.45, 1.0, 0.8)

    # 127.0 HIT: the CLASH - black sun vs Worldblade (G major against his Ab/Eb)
    expr(ALLMEL, 126.97, 127)
    hit(127.0, 1.25, 'G', 'M', hold=0.6, extra=[P('Ab2'), P('Eb3')], braam='D1', big=True)
    fx('tear', 127.0, 0.8); fx('quake', 127.0, 129.0, 0.8)
    # 127.6-134 grinding, desperate crescendo: the hero's chords climb chromatically over his D/Eb grind
    gr_hits = [130.0, 132.0, 134.0]
    gall = [TREM, HORN, TPT, VLN, CHOIR, TBN, TUBA, CB, LOW]
    expr(gall, 127.58, 86)
    ramp(gall, 127.6, 133.95, 86, 127, shape=1.1)
    action_ostinato(127.6, 133.9, 'G', 'm', amp=0.95, amp1=1.25, vln=False, duck=gr_hits, b2=True)
    climb = [(127.6, 0.98, 'G'), (128.6, 0.78, 'Ab'), (129.4, 0.58, 'A'), (130.6, 0.78, 'B'), (131.4, 0.58, 'C'),
             (132.6, 0.68, 'D'), (133.3, 0.66, 'E')]
    for t, d, rt in climb:
        r = pc(rt)
        b4 = at(r, 4) if r < 7 else at(r, 3)
        q = [0, 4, 7] if rt != 'E' else [0, 4, 7, 10]
        chord(TREM, [b4 + i for i in q], t, d, 104)
        chord(HORN, [b4 - 12 + i for i in q[:3]], t, d, 108)
        chord(VLN, [b4 + 12 + q[1], b4 + 12 + q[2]], t, d, 104)
        chord(CHOIR, [b4 - 12 + i for i in q], t, d, 112)
    chord(TBN, ['D2', 'Eb2'], 127.6, 2.35, 110); chord(TBN, ['D2', 'Eb2'], 130.5, 1.45, 114)
    chord(TBN, ['D2', 'Eb2', 'Ab2'], 132.5, 0.75, 118)
    chord(TBN, ['E2', 'B2', 'D3'], 133.3, 0.66, 120)
    note(TUBA, 'D1', 127.6, 2.35, 110); note(TUBA, 'D1', 130.5, 1.45, 114); note(TUBA, 'E1', 133.3, 0.66, 120)
    for t0, tn in [(128.2, 'G4'), (129.0, 'A4'), (130.75, 'B4'), (132.65, 'D5')]:   # the motif, fighting upward
        hero_frag([TPT], tn, t0, [0.2, 0.25, 0.1, 0.1, 0.2], 118)
    hit(130.0, 1.12, 'Bb', 'M', hold=0.4, extra=[P('A2')])                # the blade cracks
    fx('crack', 130.0, 0.8)
    hit(132.0, 1.15, 'C', 'm', hold=0.4, extra=[P('Db3')])                # the tip breaks
    fx('shatter', 132.0, 0.7)
    roll(TIMP, 'E2', 133.3, 133.95, 70, 127, rate=21)
    fx('rcym', 134.0, 1.2, 1.1); fx('riser', 134.0, 1.4, 1.0)

    # 134.0 "FURTHER!!" - a key change up (A major), everything louder. The full theme, k=0.5:
    # D on the 136 HIT, A' on the 138 HIT
    expr(ALLMEL, 133.97, 127)
    fu_hits = [134.0, 136.0, 138.0, 140.0, 140.6, 141.2, 141.8, 142.4, 143.4]
    stab(134.0, 'A', 'M', 0.95, oct_=3, cym=49)
    fx('boom', 134.004, 0.45)
    prog(CHOIR, 133.8, 52)
    LAYF = [(TPT, 0, 0), (HORN, 0, 0), (HORN, -12, -6), (VLN, 12, -2), (VLN, 0, -8), (CHOIR, 0, -6)]
    theme('A4', 134.0, 0.5, 0, 20, LAYF, 122)
    bed([(134.0, 1.0, 'A', 'M'), (135.0, 0.5, 'F#', 'm'), (135.5, 0.5, 'D', 'M'), (136.0, 0.5, 'B', 'm'),
         (136.5, 0.5, 'G', 'M'), (137.0, 0.5, 'E', 'M'), (137.5, 0.5, 'E', '7'), (138.0, 1.0, 'A', 'M'),
         (139.0, 0.5, 'D', 'M'), (139.5, 0.5, 'E', '7')], vel=110, choir_v=116, arps=False)
    action_ostinato(134.1, 143.3, 'A', 'M', amp=1.15, amp1=1.3, vln=False, duck=fu_hits)
    for t0 in (134.2, 135.2, 136.2, 137.2, 138.2, 139.2):
        scale_run(HARP, 'A3', 'A6', t0, 0.5, 84, MAJ, nd=0.35)
    hit(136.0, 1.25, 'B', 'm', hold=0.45, tpt=False, big=True)            # the blade cuts into the black sun
    fx('tear', 136.0, 0.6)
    fx('rcym', 138.0, 0.9, 0.9)
    hit(138.0, 1.3, 'A', 'M', hold=0.8, tpt=False, big=True)              # it splits; light floods; major
    fx('shatter', 138.0, 0.8)
    chord(CHOIR, ['A4', 'C#5', 'E5'], 138.0, 1.0, 120)
    # 140.0-142.4: the fastest stabs of the film - the final combo
    for i, (t, rt, q) in enumerate([(140.0, 'A', 'M'), (140.6, 'B', 'm'), (141.2, 'C#', 'm'), (141.8, 'D', 'M'),
                                    (142.4, 'E', 'M')]):
        stab(t, rt, q, 1.0 + 0.04 * i, oct_=3, cym=[57, 52, 57, 52, 49][i], anvil=0.45)
        fx('zap', t, 0.6)
        if i < 4:
            scale_run(VLN, rt + '5', rt + '6', t + 0.25, 0.3, 104, MAJ, nd=0.08)
    for t, p in [(140.0, 'A5'), (140.6, 'B5'), (141.2, 'C#6'), (141.8, 'D6'), (142.4, 'E6')]:
        note(VLN, p, t, 0.25, 120)
    fx('rcym', 143.4, 0.8, 0.9)
    # 143.4 HIT: his last fist meets the blade head on; the frame cracks
    hit(143.4, 1.25, 'D', 'm', hold=0.42, extra=[P('Eb3'), P('Ab2')], braam='D1', big=True)
    fx('crack', 143.4, 1.0)
    # 143.9-144.85 the last breath before the cut (E7, the dominant), then a gap
    bb = [TREM, CHOIR, HORN, TBN, TUBA, CB, LOW, VLN, TPT]
    expr(bb, 143.88, 70)
    ramp(bb, 143.9, 144.8, 70, 127, shape=1.3)
    chord(TREM, ['E4', 'G#4', 'B4', 'D5'], 143.9, 0.93, 108)
    chord(CHOIR, ['E3', 'B3', 'D4', 'G#4'], 143.9, 0.93, 116)
    chord(HORN, ['E3', 'B3', 'E4'], 143.9, 0.93, 112)
    chord(TBN, ['E2', 'B2', 'D3'], 143.9, 0.93, 112)
    note(TUBA, 'E1', 143.9, 0.93, 112); note(CB, 'E1', 143.9, 0.93, 112)
    chord(VLN, ['G#5', 'B5', 'E6'], 143.9, 0.93, 108)
    roll(TIMP, 'E2', 143.95, 144.8, 60, 127, rate=21)
    fx('suck', 144.45, 0.4, 0.8)
    fx('rcym', 144.86, 1.2, 1.25); fx('riser', 144.86, 1.2, 1.1)

    # 145.0 HIT: THE FINAL CUT - the biggest HIT of the film (A major, everything)
    expr(ALLMEL, 144.97, 127)
    hit(145.0, 1.45, 'A', 'M', hold=2.2, extra=[P('E2'), P('A2'), P('C#4')], braam='A1', big=True)
    fx('boom', 145.008, 0.7); fx('tear', 145.0, 1.4); fx('shatter', 145.0, 0.9)
    fx('quake', 145.0, 148.0, 1.0)
    note(DR, 52, 145.0, 2.0, 124)
    chord(TPT, ['A4', 'C#5', 'E5', 'A5'], 145.0, 1.6, 124)
    chord(CHOIR, ['A3', 'C#4', 'E4', 'A4', 'C#5'], 145.0, 4.2, 120)
    chord(TREM, ['A4', 'C#5', 'E5', 'A5'], 145.0, 4.3, 104)
    chord(VLN, ['E6', 'A6'], 145.0, 4.0, 108)
    note(CB, 'A1', 145.0, 4.3, 110); chord(LOW, ['A2', 'E3'], 145.0, 4.3, 104)
    chord(HORN, ['A3', 'E4'], 145.0, 3.5, 104)
    scale_run(HARP, 'A2', 'A6', 145.05, 0.8, 92, MAJ, nd=0.8)
    roll(TIMP, 'A2', 145.4, 147.6, 110, 30, rate=17)
    # 145-150 held, fading; 147.0 "...BROTHER..." - the Unmaker's motif one last time, unfinished (solo cello)
    fa = [CHOIR, TREM, VLN, LOW, CB, HORN, TPT, TBN, TUBA]
    ramp(fa, 146.8, 149.0, 127, 40, shape=0.7)
    prog(SOLO, 146.0, 42)
    expr([SOLO], 146.5, 88)
    for p, t, d in [('D3', 147.15, 0.68), ('Eb3', 147.85, 0.45), ('D3', 148.33, 1.0)]:
        note(SOLO, p, t, d, 88)
    fx('drone', 147.0, 150.0, P('A1'), 0.18)
    expr([CHOIR, TREM, LOW, CB], 149.0, 60)
    chord(TREM, ['A3', 'E4', 'A4'], 149.3, 0.67, 92)
    ramp([TREM], 149.3, 149.95, 60, 120, shape=1.5)
    roll(TIMP, 'A2', 149.4, 149.95, 50, 120, rate=20)
    fx('rcym', 150.0, 0.9, 0.9); fx('riser', 150.0, 0.7, 0.6)
    # 150.0 HIT: he bursts into ash; a shockwave of light (V -> I: home, D major)
    expr(ALLMEL, 149.97, 124)
    hit(150.0, 1.1, 'D', 'M', hold=0.5)
    fx('shatter', 150.0, 0.8)
    chord(CHOIR, ['D4', 'F#4', 'A4', 'D5'], 150.0, 1.1, 116)
    ramp([c for c in ALLMEL if c not in (TIMP, TAIKO)], 150.6, 151.6, 124, 50)


# --------------------------------------------------------------------------- ACT VI - the cost (150-180)
def act6():
    prog(CHOIR, 151.0, 53)
    prog(KEYS, 151.0, 8)
    # 150-158: silence, ash falling; then low strings
    lo = [LOW, CB]
    expr(lo, 152.9, 76)
    ramp(lo, 153.0, 157.9, 76, 100)
    for t, d, rt, q in [(153.0, 1.5, 'D', 'm'), (154.5, 1.5, 'Bb', 'M'), (156.0, 1.0, 'G', 'm'), (157.0, 0.98, 'A', 'sus4')]:
        r, iv = tones(rt, q)
        b1, b2, b3 = at(r, 1), at(r, 2), at(r, 3)
        note(CB, b1 if b1 >= 26 else b2, t, d, 84)
        chord(LOW, [b2, b2 + 7, b3 + iv[1], b3 + 7], t, d, 88)
    # 158.0 the sun is reborn: warm swell (D major)
    sw = [VLN, LOW, CB, CHOIR, TREM, HARP]
    expr(sw, 157.96, 40)
    ramp(sw, 158.0, 159.3, 40, 96, shape=0.8)
    expr([HORN], 158.0, 92)
    scale_run(HARP, 'D3', 'D6', 158.0, 1.0, 72, MAJ, nd=1.0)
    note(KEYS, 'A6', 158.6, 1.0, 48); note(KEYS, 'D7', 159.0, 1.0, 44)
    note(TIMP, 'D2', 158.0, 0.8, 64)
    fx('boom', 158.0, 0.22)
    # 158.4-165.6 the hero theme, tender, solo horn
    theme('D4', 158.4, 0.9, 0, 14, [(HORN, 0, 0)], 84)
    tender = [(158.0, 2.2, 'D', 'M'), (160.2, 0.9, 'B', 'm'), (161.1, 0.9, 'G', 'M'), (162.0, 0.9, 'E', 'm'),
              (162.9, 0.9, 'C', 'M'), (163.8, 0.9, 'A', 'M'), (164.7, 0.9, 'A', '7'), (165.6, 1.6, 'D', 'M'),
              (167.2, 1.6, 'B', 'm'), (168.8, 0.75, 'G', 'M'), (169.55, 0.75, 'E', 'm7'), (170.3, 0.7, 'A', '7')]
    for t, d, rt, q in tender:
        r, iv = tones(rt, q)
        b1, b2, b3 = at(r, 1), at(r, 2), at(r, 3)
        if b1 < 26:
            b1 += 12
        note(CB, b1 + 12 if t < 170 else b1, t, d, 78)
        chord(LOW, [b2, b3, b3 + iv[1]], t, d, 76)
        chord(VLN, [b3 + 12 + i for i in iv[:3]], t, d, 68 if t < 167 else 62)
        chord(CHOIR, [b3 + i for i in iv[:3]], t, d, 64)
        for k in range(int(d / 0.3)):
            arpp = [b3, b3 + 7, b3 + 12, b3 + 12 + iv[1], b3 + 19, b3 + 12 + iv[1]][k % 6]
            note(HARP, arpp, t + k * 0.3, 0.6, 60)
    ramp([VLN, LOW, CB, CHOIR], 165.6, 166.2, 96, 78)                    # "...STILL... HERE." (166.0)
    ramp([VLN, LOW, CB, CHOIR], 167.2, 168.4, 78, 100)
    # 167.2-171 the strings take the theme
    for p, t, d in [('D5', 167.2, .4), ('A5', 167.6, 1.18), ('G5', 168.8, .48), ('F#5', 169.3, .24),
                    ('E5', 169.55, .48), ('F#5', 170.05, .24), ('E5', 170.3, .66)]:
        note(VLN, p, t, d, 100); note(VLN, P(p) - 12, t, d, 88)
        note(LOW, P(p) - 24, t, d, 74)
    roll(TIMP, 'A2', 170.4, 170.95, 30, 80, rate=16)
    # 171.0 the final chord (D major, with an open 9th), ringing out to silence by 180
    fin = ALLMEL
    expr(fin, 170.96, 112)
    note(TIMP, 'D2', 171.0, 1.5, 104); note(TIMP, 'A2', 171.004, 1.5, 80)
    note(TAIKO, 38, 171.0, 0.8, 84)
    note(DR, 49, 171.0, 3.0, 84); note(DR, 36, 171.0, 0.4, 96)
    fx('boom', 171.0, 0.42)
    note(CB, 'D1', 171.0, 7.5, 96); note(TUBA, 'D1', 171.0, 6.0, 86)
    chord(TBN, ['D2', 'A2', 'F#3'], 171.0, 6.0, 90)
    chord(HORN, ['D3', 'A3', 'D4', 'F#4'], 171.0, 6.5, 96)
    chord(LOW, ['D2', 'A2', 'F#3', 'D4'], 171.0, 7.5, 92)
    chord(VLN, ['A4', 'D5', 'F#5', 'A5'], 171.0, 7.5, 92)
    chord(TREM, ['D6', 'E6'], 171.4, 7.0, 56)
    chord(CHOIR, ['D3', 'A3', 'D4', 'F#4', 'A4'], 171.0, 7.5, 92)
    for i, p in enumerate(['D2', 'A2', 'D3', 'F#3', 'A3', 'D4', 'E4', 'F#4', 'A4', 'D5']):
        note(HARP, p, 171.0 + i * 0.09, 4.0, 70 + i)
    note(KEYS, 'A6', 171.6, 1.5, 44); note(KEYS, 'E7', 172.4, 1.5, 36)
    roll(TIMP, 'D2', 171.3, 173.5, 60, 14, rate=15)
    ramp(fin, 172.0, 178.6, 112, 0, shape=0.6)
    for c in range(16):
        cc(c, 123, 179.0, 0)


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


def build_events(chs=None, seg=None):
    """List of (tick, order, channel, bytes). Applies attack compensation and same-pitch overlap fixes.
    seg=None: the whole score; seg=k: only notes that start in segment k, all times shifted by the
    segment offset; controller/program/bend state from before the offset collapses to tick 0."""
    chs = set(range(16)) if chs is None else set(chs)
    progs = sorted(PROGS)
    off = 0.0 if seg is None else seg_window(seg)[0]

    def prog_at(ch, t):
        p = INIT_PROG.get(ch, 0)
        for tt_, c, pp in progs:
            if c == ch and tt_ <= t + 1e-9:
                p = pp
        return p

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
    # collapsed state first (RPN setup before bends: keep CC insertion order, programs first)
    pre = [(0, -1, -1.0, k[1], b) for k, b in state.items() if k[0] == 'pg']
    pre += [(0, -1, -0.5, k[1], b) for k, b in state.items() if k[0] == 'cc']
    pre += [(0, -1, -0.1, k[1], b) for k, b in state.items() if k[0] == 'pb']
    ev = pre + ev
    ev.sort(key=lambda e: (e[0], e[1], e[2]))
    return [(e[0], e[1], e[3], e[4]) for e in ev]


def write_midi(path, chs=None, seg=None, per_track=True, t_end=None):
    ev = build_events(chs, seg)
    tracks = []
    t0 = bytearray(b'\x00\xff\x03' + vlq(len(b'The Sunderer')) + b'The Sunderer')
    t0 += b'\x00\xff\x51\x03' + TEMPO_US.to_bytes(3, 'big') + b'\x00\xff\x58\x04\x04\x02\x18\x08'
    if t_end is None:
        if seg is None:
            t_end = DUR + 0.5
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


def braam_sig(p, dur, attack, bright):
    """Hybrid 'braam': detuned saw stack (root, octave, 12th) through an opening/closing low-pass, driven."""
    f = 440.0 * 2 ** ((p - 69) / 12)
    n = int((dur + 0.9) * SR)
    t = tt(n)
    y = np.zeros((n, 2))
    for c, sgn in ((0, -1), (1, 1)):
        s = np.zeros(n)
        for mult, det, a in [(1, 0.0, 1.0), (1, 0.0045, 0.8), (2, -0.003, 0.55), (3, 0.002, 0.25)]:
            ff = f * mult * (1 + sgn * det)
            s += a * signal.sawtooth(2 * np.pi * ff * t + RNG.uniform(0, 6.28))
        s += 0.9 * np.sin(2 * np.pi * f * 0.5 * t)                       # sub octave
        y[:, c] = s
    env = np.minimum(1, t / max(attack, 0.002)) ** 1.5
    env *= np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.35))
    env *= 0.7 + 0.3 * np.exp(-np.maximum(0, t - attack) / 0.5)
    op = np.minimum(1, t / (attack + 0.06))
    cut = 140 + bright * 2400 * op * (0.3 + 0.7 * np.exp(-np.maximum(0, t - attack) / 0.55))
    out = np.zeros_like(y)
    blk = 256
    zi = np.zeros((1, 2, 2))
    for s in range(0, n, blk):
        sos = signal.butter(2, min(cut[s], SR * 0.4), 'lp', fs=SR, output='sos')
        out[s:s + blk], zi = signal.sosfilt(sos, y[s:s + blk], axis=0, zi=zi)
    out = np.tanh(2.2 * out * env[:, None]) / np.tanh(2.2)
    return out / (np.abs(out).max() + 1e-9)


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


def heart_sig(amp):
    """lub-dub: a low thump with a 150-500 Hz knock so it reads on phone speakers."""
    n = int(0.9 * SR)
    t = tt(n)
    y = np.zeros(n)
    for t0, a in ((0.0, 1.0), (0.27, 0.7)):
        x = np.maximum(0, t - t0)
        on = (t >= t0)
        f = 48 + 60 * np.exp(-x / 0.035)
        ph = 2 * np.pi * np.cumsum(f * on) / SR
        y += a * np.sin(ph) * np.exp(-x / 0.09) * on * np.minimum(1, x / 0.003)
        knock = signal.sosfilt(signal.butter(2, [140, 520], 'bp', fs=SR, output='sos'),
                               RNG.standard_normal(n) * np.exp(-x / 0.03) * on)
        y += a * 3.2 * knock
    return y * amp


def render_fx(tmp, k):
    """Synthesized hybrid layer for segment k: returns (low, air, mid) slices starting at the segment offset."""
    off, end = seg_window(k)
    i_off = int(round(off * SR))
    n = int(round(end * SR)) - i_off
    low = np.zeros((n, 2))      # sub / pulse / quake / heart (mostly dry)
    air = np.zeros((n, 2))      # risers, cymbals, glass, anvils, tears (into the hall)
    mid = np.zeros((n, 2))      # braams
    crash = crash_sample(tmp)
    booms = sorted(a[1] for a in FX if a[0] == 'boom' and a[2] >= 0.3)
    for a in FX:
        if seg_index(a[1]) != k:
            continue
        kind = a[0]
        if kind == 'boom':
            y = sub_boom(a[2]) * 0.55
            nxt = [b for b in booms if b > a[1] + 0.02]
            if nxt and nxt[0] - a[1] < 3.2:            # the tail clears out of the way of the next impact
                gap = nxt[0] - a[1]
                x = tt(len(y))
                y = y * np.clip((gap - 0.012 - x) / 0.07, 0, 1)
            place(low, a[1], y, i_off)
        elif kind == 'pulse':
            _, t, p, dur, amp, br = a
            place(low, t, synth_pulse(p, dur, br) * amp * 0.13, i_off)
        elif kind == 'rcym':
            _, tend, dur, amp = a
            m = int(dur * SR)
            r = crash[::-1][-m:] * (np.linspace(0, 1, m) ** 1.5)[:, None]
            place(air, tend - m / SR, r * amp * 0.5, i_off)
        elif kind == 'riser':
            _, tend, dur, amp = a
            m = int(dur * SR)
            y = sweep_noise(m, 250, 7000, q=1.5) * (np.linspace(0, 1, m) ** 2.2)[:, None]
            tone = np.sin(2 * np.pi * np.cumsum(110 * 4 ** (np.arange(m) / m)) / SR) * np.linspace(0, 1, m) ** 3
            y = y * 0.09 + tone[:, None] * 0.05
            y[-int(0.004 * SR):] *= np.linspace(1, 0, int(0.004 * SR))[:, None]
            place(air, tend - m / SR, y * amp, i_off)
        elif kind == 'whoosh':
            _, t, dur, amp = a
            m = int(dur * SR)
            env = np.sin(np.pi * np.linspace(0, 1, m) ** 0.7) ** 2
            place(air, t, sweep_noise(m, 400, 5000, q=2) * env[:, None] * amp * 0.06, i_off)
        elif kind == 'suck':
            _, t, dur, amp = a
            m = int(dur * SR)
            env = np.linspace(0, 1, m) ** 2 * np.minimum(1, (m - np.arange(m)) / (0.02 * SR))
            place(air, t, sweep_noise(m, 5000, 450, q=2) * env[:, None] * amp * 0.07, i_off)
        elif kind == 'zap':
            _, t, amp = a
            m = int(0.25 * SR)
            x = tt(m)
            y = sweep_noise(m, 9000, 2500, q=3) * np.exp(-x / 0.05)[:, None]
            place(air, t, y * amp * 0.08, i_off)
        elif kind in ('shatter', 'crack'):
            _, t, amp = a
            m = int(1.6 * SR)
            x = tt(m)
            y = np.zeros((m, 2))
            npart = 70 if kind == 'shatter' else 30
            for _ in range(npart):
                f = RNG.uniform(1800, 9500)
                t0 = RNG.exponential(0.05 if kind == 'shatter' else 0.02)
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
            env = np.minimum(1, x / 1.2) * np.minimum(1, (x[-1] - x) / 0.8)
            y = (np.sin(2 * np.pi * f * x) + 0.5 * np.sin(2 * np.pi * (2 * f + 0.25) * x)
                 + 0.18 * np.sin(2 * np.pi * (3 * f - 0.2) * x) + 0.1 * np.sin(2 * np.pi * (5 * f + 0.3) * x)
                 + 0.06 * np.sin(2 * np.pi * (7 * f - 0.4) * x)) * env
            nz = lpf(RNG.standard_normal(m), 300, 2) * 0.05 * env
            place(low, t0, (y + nz) * amp * 0.12, i_off)
        elif kind == 'braam':
            _, t, p, dur, amp, attack, bright = a
            place(mid, t, braam_sig(p, dur, attack, bright) * amp * 0.16, i_off)
        elif kind == 'anvil':
            _, t, amp = a
            place(air, t, anvil_sig() * amp * 0.11, i_off)
        elif kind == 'quake':
            _, t0, t1, amp = a
            m = int((t1 - t0) * SR)
            x = tt(m)
            nz = lpf(RNG.standard_normal((m, 2)), 70, 4)
            nz /= np.sqrt(np.mean(nz ** 2)) + 1e-12
            am = lpf(RNG.standard_normal(m), 4, 2)
            am = 0.65 + 0.35 * am / (np.abs(am).max() + 1e-9)
            env = np.minimum(1, x / 0.08) * np.minimum(1, (x[-1] - x) / 0.7) * np.exp(-x / (t1 - t0))
            place(low, t0, nz * (am * env)[:, None] * amp * 0.09, i_off)
        elif kind == 'subdrop':
            _, t, dur, amp, f0, f1 = a
            m = int((dur + 0.3) * SR)
            x = tt(m)
            f = f0 * (f1 / f0) ** np.minimum(1, x / dur)
            ph = 2 * np.pi * np.cumsum(f) / SR
            env = np.minimum(1, x / 0.012) * np.exp(-x / (dur * 0.55))
            y = np.sin(ph) * env + 0.2 * np.sin(2 * ph) * env
            place(low, t, y * amp * 0.5, i_off)
        elif kind == 'tear':
            _, t, amp = a
            m = int(2.0 * SR)
            x = tt(m)
            env = np.minimum(1, x / 0.003) * np.exp(-x / 0.55)
            y = sweep_noise(m, 6500, 160, q=0.9) * env[:, None] * 0.11
            crk = (RNG.random((m, 2)) < 0.004 * np.exp(-x / 0.4)[:, None]) * RNG.standard_normal((m, 2))
            y += hpf(crk, 1500) * 0.35
            rip = np.tanh(3 * lpf(RNG.standard_normal((m, 2)), 320, 2) * 6) * np.exp(-x / 0.3)[:, None] * 0.08
            place(air, t, (y + rip) * amp, i_off)
        elif kind == 'heart':
            _, t, amp = a
            place(low, t, heart_sig(amp) * 0.5, i_off)
        elif kind == 'fall':
            _, t, dur, amp = a
            m = int(dur * SR)
            x = np.linspace(0, 1, m)
            env = np.minimum(1, x / 0.25) * (1 - x) ** 1.2
            y = sweep_noise(m, 3500, 140, q=1.4) * env[:, None] * 0.07
            f = 600 * (60 / 600) ** x
            y += (np.sin(2 * np.pi * np.cumsum(f) / SR) * env * 0.03)[:, None]
            place(air, t, y * amp, i_off)
    return low, air, mid


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


# --------------------------------------------------------------------------- the REWIND
def rewind_map():
    """Read-position (s) for output times in [REW0, REW1): the HIT plays, the tape stops and reverses,
    accelerates backwards (a reversed swell back through the fusion), then winds down (pitch drop) to 60.0."""
    n = int(round((REW1 - REW0) * SR))
    t = REW0 + np.arange(n) / SR
    v = np.empty(n)
    a, b, c = REW0 + 0.28, REW0 + 0.55, REW0 + 1.35
    m = t < a
    v[m] = 1.0
    m = (t >= a) & (t < b)
    v[m] = 1.0 - 3.5 * (t[m] - a) / (b - a)                    # tape stop and reverse
    m = (t >= b) & (t < c)
    v[m] = -2.5 - 1.5 * (t[m] - b) / (c - b)                    # rewinding faster
    m = t >= c
    v[m] = -4.0 * (1 - (t[m] - c) / (REW1 - c)) ** 1.3          # winds down: the pitch drops away
    v *= 1 + 0.035 * np.sin(2 * np.pi * 7.5 * (t - REW0))     # VHS wow
    return REW0 + np.cumsum(v) / SR


def apply_rewind(x, i_off):
    pos = rewind_map()
    i0, n = int(round(REW0 * SR)) - i_off, len(pos)
    idx = pos * SR - i_off
    seg = np.stack([np.interp(idx, np.arange(len(x)), x[:, c]) for c in range(2)], 1)
    w = np.linspace(0, 1, n) ** 0.5
    seg = seg * (1 - 0.5 * w[:, None]) + lpf(seg, 3500) * (0.5 * w[:, None])
    fade = int(0.03 * SR)
    seg[-fade:] *= np.linspace(1, 0, fade)[:, None]
    out = x.copy()
    out[i0:i0 + n] = seg
    out[i0 + n:] = 0
    return out


# --------------------------------------------------------------------------- hall reverb
def hall_ir(rt60=2.9, pre=0.022):
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
    ir *= np.minimum(1, t / 0.06)[:, None] ** 1.5
    for _ in range(14):
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
    for i in range(nb - 2, -1, -1):
        g[i] = min(g[i], ca * g[i + 1] + (1 - ca) * 1.0 if g[i + 1] < g[i] else g[i])
    cr = np.exp(-1e-3 / rel)
    for i in range(1, nb):
        g[i] = min(g[i], cr * g[i - 1] + (1 - cr) * 1.0)
    gl = np.interp(np.arange(len(x)) / blk, np.arange(nb), g)
    return x * gl[:, None]


# --------------------------------------------------------------------------- mixing
STEM_GAIN = {'strings': 1.0, 'brass': 1.0, 'choir': 1.1, 'keys': 0.9, 'perc': 1.0, 'fxlow': 0.6, 'fxair': 1.0,
             'fxmid': 1.0}
SEND = {'strings': 0.55, 'brass': 0.42, 'choir': 0.6, 'keys': 0.6, 'perc': 0.32, 'fxlow': 0.08, 'fxair': 0.45,
        'fxmid': 0.3}
# (stem, t0, t1, dry gain, send gain): distant, lonely passages
DISTANT = [('keys', 104.0, 110.4, 2.2, 3.5), ('strings', 41.2, 44.5, 1.3, 2.2), ('strings', 86.4, 87.9, 1.2, 2.0)]


def mix(dry):
    """dry[name][k] = segment k's slice (starting at the segment offset). Each segment gets its own hall;
    'cut' segments (dry + their hall tail) end hard at their end time, 'fade' ones fade over the last 0.75 s."""
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
            if name == 'fxlow':
                x = lpf(x, 900)
            if name == 'fxmid':
                x = peq(x, 300, -2.0, 0.8)
            if s0 <= REW0 < s1:
                x = apply_rewind(x, i_off)
            send = hpf(x, 140 if name in ('fxlow', 'perc') else 60) * SEND[name]
            dg, sg = np.ones((n, 1)), np.ones((n, 1))
            for nm, a, b, gd, gs in DISTANT:
                if nm == name:
                    ia, ib = max(0, int(a * SR) - i_off), max(0, int(b * SR) - i_off)
                    dg[ia:ib], sg[ia:ib] = gd, gs
            y = x * dg + reverb(send * sg, ir)
            t = (i_off + np.arange(n)) / SR
            if mode == 'cut':
                msk = np.clip((s1 - t) / 0.008, 0, 1)
            elif mode == 'fade':
                msk = np.clip((s1 - 0.05 - t) / 0.75, 0, 1) ** 2
            else:
                msk = np.ones(n)
            stems[name][i_off:i_off + n] += y * msk[:, None]
    return stems


# bus automation (dB): shapes the long-form contour; the quiet sections are quiet by composition
AUTOMATION = [(0, -2.0), (3.9, -2.0), (4.0, -1.5), (8.5, -1.5), (9.0, -2.5), (18.9, -2.5), (19.0, -1.5),
              (21.0, -1.5), (21.1, -2.0), (41.2, -2.0), (41.25, 0.0), (45.9, 0.0), (46.0, -1.0), (53.9, -1.0),
              (54.0, -1.5), (58.25, -1.5), (58.5, -3.0), (60.0, -3.0), (60.05, 0.0), (61.9, 0.0),
              (62.0, 0.4), (63.4, 0.4), (63.6, -1.0), (77.0, -1.0), (78.0, 0.0), (87.9, 0.0), (88.0, -0.3),
              (101.0, -0.3), (101.5, 0.0), (104.0, 1.0), (110.5, 1.0), (111.5, 0.5), (112.9, 1.2),
              (113.0, 3.2), (117.9, 3.2), (118.0, 1.4), (121.9, 1.4), (122.0, 0.8), (126.9, 0.8),
              (127.0, 0.8), (133.9, 1.4), (134.0, 2.3), (139.9, 2.3), (140.0, 2.8), (144.9, 2.8),
              (145.0, 5.4), (147.0, 5.4), (149.5, 1.5), (150.5, 0.5),
              (152.5, 2.5), (170.9, 2.5), (171.0, 1.5), (180.0, 1.5)]


def prehit_duck(n, depth_db=-5.0):
    """Trailer-style micro-duck: the whole bus dips ~90 ms before every HIT/stab and snaps back on the
    impact, so each one lands out of a breath instead of out of a wall of sound."""
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
    for it in range(8):
        y = limiter(x * 10 ** (g / 20), ceiling_db=-1.25)
        L = lufs(y)
        if abs(L + 14.0) < 0.03:
            break
        g += (-14.0 - L)
    t = tt(NS)
    fade = np.clip((179.6 - t) / 3.6, 0, 1) ** 2         # silence by 180 (digital zero from 179.6)
    y = y * fade[:, None]
    f = int(0.008 * SR)
    for a, b in SILENT:                                   # re-apply the cuts after the master filters
        ia, ib = int(round(a * SR)), int(round(b * SR))
        y[ia - f:ia] *= np.linspace(1, 0, f)[:, None]
        y[ia:ib] = 0
    return y


# --------------------------------------------------------------------------- verification
# (time, label, detector): 'low' = <150 Hz onset (every HIT/stab has a sub/taiko/timpani attack),
# 'full' = 150 Hz-5 kHz onset for soft, pitched cue entries
CUES = [(4.0, 'HIT gauntlet', 'low'), (7.0, 'HIT eyes+motif', 'low'), (8.0, 'stinger line', 'low'),
        (10.8, 'stinger hero', 'low'), (13.4, 'stinger dark', 'low'), (16.4, 'stinger ZENITH', 'low'),
        (18.2, 'dark answer', 'low'), (20.0, 'HIT title', 'low'),
        (22.5, 'stab', 'low'), (22.9, 'stab', 'low'), (23.3, 'stab', 'low'), (23.7, 'stab', 'low'),
        (24.0, 'HIT catch', 'low'), (25.4, 'HIT flick', 'low'), (26.6, 'HIT sea', 'low'),
        (27.6, 'stab hammer', 'low'), (28.3, 'stab uppercut', 'low'), (28.8, 'stab hook', 'low'),
        (29.3, 'stab hook', 'low'), (29.9, 'stab backhand', 'low'),
        (31.6, 'HIT spire', 'low'), (32.1, 'HIT spire', 'low'), (32.6, 'HIT spire', 'low'), (33.0, 'HIT slam', 'low'),
        (34.4, 'weak stab', 'low'), (35.2, 'weak stab', 'low'), (36.0, 'WEIGHT cluster', 'low'),
        (38.2, 'HIT shatter', 'low'), (41.0, 'HIT punch', 'low'),
        (46.0, 'HIT NOVA', 'low'), (47.6, 'HIT cleave', 'low'),
        (48.6, 'stab', 'low'), (49.2, 'stab', 'low'), (49.8, 'stab', 'low'),
        (50.6, 'HIT wound', 'low'), (51.6, 'HIT crown', 'low'), (53.2, 'HIT pin', 'low'), (54.0, 'his motif', 'low'),
        (55.6, 'HIT fusion', 'low'), (56.4, 'held (hammer)', 'low'), (58.0, 'HIT REWIND', 'low'),
        (62.0, 'HIT SUNDER', 'low'), (63.6, 'storm flare', 'low'), (64.6, 'HIT catch', 'low'),
        (65.2, 'HIT smash', 'low'),
        (66.6, 'blow punch', 'low'), (67.4, 'blow guard', 'low'), (68.1, 'blow body', 'low'),
        (68.7, 'blow body', 'low'), (69.3, 'blow body', 'low'), (70.0, 'blow falls', 'low'), (71.4, 'stomp', 'low'),
        (73.0, 'orb crush 1', 'low'), (74.0, 'orb crush 2', 'low'), (75.0, 'orb crush 3', 'low'),
        (76.0, 'orb crush 4', 'low'), (86.5, 'solo violin', 'full'),
        (88.0, 'HIT LAST LIGHT', 'low'), (90.6, 'HIT', 'low'), (91.4, 'HIT trade', 'low'), (92.0, 'HIT trade', 'low'),
        (92.6, 'HIT trade', 'low'), (93.2, 'HIT trade', 'low'), (94.2, 'HIT arm', 'low'), (95.4, 'HIT arm', 'low'),
        (96.6, 'HIT mask', 'low'), (97.4, 'HIT catch', 'low'), (100.0, 'HIT snap', 'low'),
        (100.8, 'HIT point-blank', 'low'),
        (104.6, 'ember 1 piano', 'full'), (105.4, 'ember 2 piano', 'full'), (106.2, 'ember 3 piano', 'full'),
        (107.0, 'ember 4 piano', 'full'), (113.0, 'HIT INFINITE', 'low'), (118.0, 'HIT WORLDBLADE', 'low'),
        (122.0, 'HIT BLACK SUN', 'low'), (127.0, 'HIT CLASH', 'low'), (130.0, 'HIT crack', 'low'),
        (132.0, 'HIT tip', 'low'), (134.0, 'FURTHER key change', 'low'), (136.0, 'HIT cut in', 'low'),
        (138.0, 'HIT split', 'low'),
        (140.0, 'stab', 'low'), (140.6, 'stab', 'low'), (141.2, 'stab', 'low'), (141.8, 'stab', 'low'),
        (142.4, 'stab', 'low'), (143.4, 'HIT fist', 'low'), (145.0, 'HIT FINAL CUT', 'low'),
        (150.0, 'HIT ash', 'low'), (158.0, 'dawn swell', 'low'), (171.0, 'final chord', 'low')]
SECTIONS = [(0, 4, 'I   dread/narration'), (4, 7, 'I   gauntlet/rising'), (7, 8.6, 'I   eyes+motif'),
            (8.6, 19.0, 'I   dialogue'), (19.0, 20.0, 'I   build'), (20, 21, 'I   title slam'),
            (21, 24, 'II  blitz'), (24, 27.2, 'II  catch/flick/sea'), (27.2, 33.5, 'II  combo/spires'),
            (33.5, 36, 'II  thin, desperate'), (36, 38.2, 'II  WEIGHT'), (38.2, 41.2, 'II  shatter/held/punch'),
            (41.2, 44.5, 'III near silence/solo'), (44.5, 46, 'III swell'), (46, 53.9, 'III ZENITH NOVA'),
            (54, 58, 'III villain/fusion'), (58, 60, 'IV  REWIND'), (60, 62, 'IV  high string'),
            (62, 66, 'IV  SUNDER/storm'), (66, 72, 'IV  the beating'), (72, 77, 'IV  the orbs'),
            (77, 80, 'IV  the drop'), (80, 87.2, 'IV  all hope lost'), (87.2, 88, 'IV  swell'),
            (88, 97.4, 'IV  LAST LIGHT'), (97.4, 101, 'IV  strain/snap'), (101, 104, 'IV  collapse'),
            (104, 110.5, 'V   embers'), (110.5, 113, 'V   cascade'), (113, 118, 'V   INFINITE theme'),
            (118, 122, 'V   WORLDBLADE'), (122, 127, 'V   black sun'), (127, 134, 'V   clash/grind'),
            (134, 140, 'V   FURTHER (A major)'), (140, 145, 'V   final combo'), (145, 150, 'V   FINAL CUT/held'),
            (150, 153, 'VI  ash'), (153, 158, 'VI  low strings'), (158, 166, 'VI  dawn/horn'),
            (166, 171, 'VI  strings'), (171, 176, 'VI  final chord'), (176, 180, 'VI  ring out')]


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
    lines.append('Hit alignment (onset detection on the master; tolerance +-33.3 ms = 1 frame at 30 fps)')
    lines.append('  detector low = <150 Hz band (HITs, stabs, stingers); full = 150 Hz-5 kHz (soft pitched entries)')
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
            lines.append(f'  {ok} cue {t:7.3f}  {lab:19s} {det:4s} measured {o[0]:7.3f}  delta {d:+6.1f} ms  '
                         f'rise {o[1]:5.1f} dB')
        else:
            worst, nbad = 999, nbad + 1
            lines.append(f'  MISS cue {t:7.3f} {lab:19s} {det:4s} no onset within 120 ms')
    lines.append(f'  {len(CUES)} cues, {len(CUES) - nbad} within one frame; worst |delta| = {worst:.1f} ms')
    lines.append('')
    lines.append('Energy contour (K-weighted loudness of each section, LUFS)')
    for t0, t1, lab in SECTIONS:
        st = short_term(y, t0, t1)
        seg = y[int(t0 * SR):int(t1 * SR)]
        pk = 20 * np.log10(np.abs(seg).max() + 1e-12)
        lines.append(f'  {t0:6.1f}-{t1:6.1f}  {lab:24s} {st:7.1f} LUFS   peak {pk:6.1f} dBFS  ' +
                     '#' * max(0, int((st + 60) / 1.5)))
    lines.append('')
    lines.append('Hit power: momentary loudness (K-weighted, 400 ms from the hit) and 3 s short-term after it')
    for t in [4.0, 7.0, 20.0, 26.6, 33.0, 41.0, 46.0, 53.2, 55.6, 58.0, 62.0, 65.2, 71.4, 88.0, 100.0, 100.8,
              113.0, 118.0, 122.0, 127.0, 136.0, 138.0, 143.4, 145.0, 150.0, 171.0]:
        lines.append(f'  {t:7.1f}  momentary {short_term(y, t, t + 0.4):6.1f} LUFS   3 s {short_term(y, t, t + 3.0):6.1f} LUFS')
    lines.append('')
    lines.append('Loudest 3-second windows (short-term, K-weighted):')
    sts = [(short_term(y, a, a + 3.0), a) for a in np.arange(0, DUR - 3.0, 0.5)]
    for st, a in sorted(sts, reverse=True)[:8]:
        lines.append(f'  {a:6.1f}-{a + 3:6.1f}  {st:6.1f} LUFS')
    lines.append('')
    for a, b, lab in [(41.2, 41.75, 'silence at 41.2'), (103.95, 104.5, 'silence by 104'),
                      (179.6, 180.0, 'end')]:
        seg = y[int(a * SR):int(b * SR)]
        lines.append(f'Silence check {a:.2f}-{b:.2f} ({lab}): peak {20 * np.log10(np.abs(seg).max() + 1e-12):.1f} dBFS')
    for a, b, lab in [(60.3, 61.9, 'high string only'), (80.0, 86.4, 'all hope lost'), (104.5, 108.0, 'embers'),
                      (151.5, 153.0, 'ash'), (176.0, 179.0, 'ring out')]:
        seg = y[int(a * SR):int(b * SR)]
        mids = signal.sosfilt(signal.butter(4, [300, 4000], 'bp', fs=SR, output='sos'), seg, axis=0)
        lines.append(f'Quiet check {a:.1f}-{b:.1f} ({lab}): {short_term(y, a, b):.1f} LUFS, peak '
                     f'{20 * np.log10(np.abs(seg).max() + 1e-12):.1f} dBFS, 300 Hz-4 kHz (phone band) RMS '
                     f'{20 * np.log10(np.sqrt(np.mean(mids ** 2)) + 1e-12):.1f} dBFS')
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', os.path.join(HERE, 'score.wav'),
                    '-lavfi', 'showspectrumpic=s=3000x900:legend=1:scale=log:fscale=log:color=intensity',
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
    base = os.environ.get('SUNDERER_TMP', SCRATCH if os.path.isdir(SCRATCH) else None)
    tmp = tempfile.mkdtemp(prefix='sunderer_', dir=base)
    try:
        crash_sample(tmp)
        jobs = []
        for name, chs in STEMS.items():
            for k in range(len(SEGS)):
                jobs.append((name, chs, k))

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
        dry['fxlow'], dry['fxair'], dry['fxmid'] = [], [], []
        for k in range(len(SEGS)):
            lo_, air_, mid_ = render_fx(tmp, k)
            dry['fxlow'].append(lo_); dry['fxair'].append(air_); dry['fxmid'].append(mid_)
        stems = mix(dry)
        bus = sum(stems.values())
        y = master(bus)
        y = y[:NS]
        sf.write(os.path.join(HERE, 'score.wav'), y, SR, subtype='PCM_24')
        g = np.abs(y).max() / max(1e-9, np.abs(bus).max())
        if write_stems:
            os.makedirs(os.path.join(HERE, 'stems'), exist_ok=True)
            for name, x in stems.items():
                sf.write(os.path.join(HERE, 'stems', name + '.flac'), np.clip(x * g, -1, 1), SR, subtype='PCM_24')
        bal = ['', 'Stem balance (K-weighted loudness of each stem in the section, LUFS, at master gain)',
               '  section                  ' + ''.join(f'{n:>9s}' for n in stems)]
        for t0, t1, lab in SECTIONS:
            if t1 - t0 < 2.5:
                continue
            bal.append(f'  {lab:24s} ' + ''.join(f'{short_term(stems[n] * g, t0, t1):9.1f}' for n in stems))
        verify(y, os.path.join(HERE, 'spectrogram.png'), os.path.join(HERE, 'verification.txt'), extra=bal)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
