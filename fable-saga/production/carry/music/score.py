#!/usr/bin/env python3
"""CARRY - a Fable Saga short - the score for a 15.000 s endless zoom that LOOPS SEAMLESSLY.

Built on the Fable part IV / ultrathink score.py machinery: the score is composed in code, written to MIDI,
rendered with fluidsynth + FluidR3_GM (note-ons sent early by each patch's measured attack time, so the audible
attack lands on the beat), joined by a synthesized hybrid layer (the shooting-star chime, fireflies, aurora and
galaxy shimmer, a soft sub bloom, reverse swells), put in a hall and mastered to about -16 LUFS / -1.5 dBTP.

The loop.  The whole chain (instruments, hall, compressor, limiter) runs on THREE back-to-back copies of the
cycle (after a 1 s pre-roll) and only the middle one is kept: the last bar's notes and the hall's tail ring under
the first bar, the attack-lead notes of bar 1 are already sounding at the end of bar 9, and every follower in the
master has settled into the periodic steady state - so the last sample of score.wav flows into its first exactly
as the 30.000 s point of the continuous three-cycle render does. Every controller curve (sampled on an integer
25 ms grid), send level and synthesized layer is periodic with period 15 s; the synthesized layer is rendered once
and laid down three times. Each MIDI channel is rendered by its own fluidsynth instance: alone, a channel comes out
bit-identical in every cycle, while channels sharing one synth pick up a little voice-slot state from note to note
(measured -60 dBFS cycle-to-cycle). No note re-strikes a key whose previous voice is still ringing across the seam.

Time.  The music breathes with the zoom: 9 bars of 3/4 whose bar lines ARE the layer arrivals (0 | 2.19 | 4.14 |
5.68 | 6.92 | 8.08 | 9.32 | 10.86 | 12.81 | 15 = 0). Beat times come from a periodic cubic spline through those
bar lines, so the tempo glides from 81 bpm at the snail (the seam) to 156 bpm in deep space and back - the music box
winds up as the universe opens out and winds down again into the snail's shell.

The motif.  A rising four-note arpeggio and a lean onto the note below the octave (D5 F#5 A5 D6 - C#6): the snail
looking up. It is the same shape at every scale, like the zoom: each layer arrival plays it again in that layer's
chord, a fourth higher or a world wider, in a bigger instrument.

   bar  time   picture                  chord        music
   1    0.00   the snail looks up       D (I)        music box motif + harp lullaby over a warm string chord
                0.6-1.3 shooting star                 harp glissando up into a chime at 0.90 (glock + bell)
   2    2.19                            Bm7          the music box answers (B . A F#); a firefly passes
   3    4.14   L1 the meadow            Gmaj9        new chord; celesta takes the motif; pizzicato fireflies
   4    5.68   L2 the valley, aurora    Em9          violins enter and begin to rise (G/B); aurora shimmer
   5    6.92   L3 the curve of the world  F(add9)    choir (oohs) enters softly; the music opens out
   6    8.08   L4 the planet            Bb(add9)     the widest chord: low Bb, aahs, warm horns, sub bloom
   7    9.32   L5 the sun and planets   C(add9)      horns swell bright; the motif in the low strings
   8   10.86   L6 the galaxy            D(add9)      the peak: choir, strings, horns, harp sweep, glock stars;
                                                     the music box motif returns inside it
   9   12.81   the shell -> the snail   Gm6 (iv)     settles; the music box sighs Bb . A G E -> D5 on the seam
   (1) 15.00 = 0.00                     D (I)        the very chord the loop begins on

    python score.py          (needs fluidsynth, ffmpeg, numpy, scipy, soundfile)
Writes score.mid (one cycle as written, tempo-mapped 3/4, bar lines on the cues), score.wav (48 kHz / 24-bit /
stereo, exactly 15.000 s) and verification.txt (all values measured).
"""
import os, struct, subprocess, tempfile, shutil
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import soundfile as sf
from scipy import signal
from scipy.interpolate import CubicSpline
from scipy.ndimage import minimum_filter1d

HERE = os.path.dirname(os.path.abspath(__file__))
SF2 = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
SCRATCH = '/tmp/claude-0/-home-user-brain/f1f7475c-3827-5141-bc67-2671553b043a/scratchpad/cz/music'
SR = 48000
DUR = 15.0
NS = int(round(SR * DUR))
T0 = 1.0                                   # pre-roll before the first of the three rendered cycles
NCYC = 3
KEEP = 1                                   # the middle cycle is the one that is kept
TAIL = 5.0
NR = int(round(SR * (T0 + NCYC * DUR + TAIL)))
I1 = int(round(SR * (T0 + KEEP * DUR)))
I2 = I1 + NS
LUFS_TARGET = -16.0
CEILING = -1.5
RNG = np.random.default_rng(1507)

# --------------------------------------------------------------------------- pitches
_PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
NAMES12 = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']


def P(s):
    if isinstance(s, (int, np.integer)):
        return int(s)
    n, i = _PC[s[0]], 1
    while i < len(s) and s[i] in '#b':
        n += 1 if s[i] == '#' else -1
        i += 1
    return n + 12 * (int(s[i:]) + 1)


def hz(p):
    return 440.0 * 2 ** ((P(p) - 69) / 12)


# --------------------------------------------------------------------------- the tempo map (bar lines = cues)
BAR_M = [0, 6, 9, 12, 15, 18, 21, 27]                 # beats (3/4: bar b starts at beat 3(b-1))
BAR_T = [0.0, 4.14, 5.68, 6.92, 8.08, 9.32, 10.86, 15.0]
BEATS = 27
_G = CubicSpline(BAR_M, np.array(BAR_T) - DUR / BEATS * np.array(BAR_M), bc_type='periodic')


def T(m):
    """seconds (cycle-relative) of beat position m; periodic: T(m + 27) = T(m) + 15"""
    k = np.floor(m / BEATS)
    r = m - k * BEATS
    return float(_G(r) + DUR / BEATS * r + DUR * k)


def bar(b):
    return 3 * (b - 1)


# --------------------------------------------------------------------------- channels
VLN, LOW, CB, PIZZ, HARP, CEL, MBOX, GLOCK, HORN, DR, OOH, AAH, TIMP, PAD, TREM, SLOW = range(16)
NAMES = ['violins', 'violas+celli', 'contrabass', 'pizzicato', 'harp', 'celesta', 'music box', 'glockenspiel',
         'french horns', 'percussion', 'choir oohs', 'choir aahs', 'timpani', 'warm pad', 'tremolo strings',
         'slow strings']
INIT_PROG = {VLN: 48, LOW: 48, CB: 43, PIZZ: 45, HARP: 46, CEL: 8, MBOX: 10, GLOCK: 9, HORN: 60, OOH: 53,
             AAH: 52, TIMP: 47, PAD: 89, TREM: 44, SLOW: 49}
VOL = {VLN: 100, LOW: 100, CB: 104, PIZZ: 100, HARP: 108, CEL: 104, MBOX: 118, GLOCK: 92, HORN: 100, DR: 90,
       OOH: 104, AAH: 104, TIMP: 104, PAD: 80, TREM: 88, SLOW: 96}
PAN = {VLN: 40, LOW: 80, CB: 90, PIZZ: 74, HARP: 36, CEL: 84, MBOX: 60, GLOCK: 74, HORN: 50, DR: 70, OOH: 56,
       AAH: 72, TIMP: 56, PAD: 64, TREM: 44, SLOW: 86}
STEMS = {'strings': [VLN, LOW, CB, PIZZ, TREM, SLOW], 'keys': [HARP, CEL, MBOX, GLOCK], 'choir': [OOH, AAH],
         'brass': [HORN], 'perc': [DR, TIMP], 'pad': [PAD]}
# Attack compensation: time-to-half-amplitude of each FluidR3 patch (s) * ~0.7, measured as in part IV
# (music box 10 and warm pad 89 measured for this score). Note-ons are sent this much early.
LAT = {48: .055, 49: .10, 44: .06, 45: .035, 43: .05, 60: .038, 52: .10, 53: .045, 47: 0., 46: 0., 8: 0.,
       9: .004, 10: .01, 89: .25}

# expression (CC11) curves: periodic knots (cycle-relative seconds, value); first and last values are equal
ENV = {
    VLN: [(0, 0), (5.5, 0), (5.66, 40), (6.92, 58), (8.08, 76), (9.32, 88), (10.5, 100), (10.86, 108),
          (11.7, 90), (12.6, 54), (13.4, 0), (15, 0)],
    LOW: [(0, 78), (4.14, 78), (5.68, 80), (8.08, 92), (9.32, 104), (10.86, 110), (11.9, 92), (12.81, 78), (15, 78)],
    CB: [(0, 0), (4.1, 0), (4.24, 72), (6.92, 82), (8.08, 98), (10.86, 108), (12.0, 76), (12.75, 40), (13.2, 0),
         (15, 0)],
    SLOW: [(0, 78), (4.14, 78), (8.08, 90), (10.86, 104), (12.2, 86), (12.81, 78), (15, 78)],
    TREM: [(0, 0), (9.2, 0), (9.32, 36), (10.86, 84), (11.9, 56), (12.8, 0), (15, 0)],
    PAD: [(0, 76), (7.5, 92), (10.86, 98), (13.0, 80), (15, 76)],
    OOH: [(0, 0), (6.8, 0), (6.88, 44), (8.08, 70), (9.32, 82), (10.86, 98), (11.9, 76), (13.0, 30), (13.7, 0),
          (15, 0)],
    AAH: [(0, 0), (7.95, 0), (8.04, 48), (9.32, 68), (10.86, 102), (11.9, 72), (13.0, 24), (13.5, 0), (15, 0)],
    HORN: [(0, 0), (7.95, 0), (8.04, 50), (9.2, 50), (9.3, 56), (10.4, 98), (10.86, 108), (11.8, 78), (12.7, 30),
           (13.3, 0), (15, 0)],
}
for _c in (PIZZ, HARP, CEL, MBOX, GLOCK, DR, TIMP):
    ENV[_c] = [(0, 110), (15, 110)]

NOTES, FX = [], []


def env_val(ch, t):
    ks = ENV[ch]
    return float(np.interp(t % DUR, [k[0] for k in ks], [k[1] for k in ks]))


def note(ch, p, t, d, v):
    NOTES.append((ch, P(p), float(t), float(d), int(np.clip(round(v), 1, 127))))


def nb(ch, p, m, d, v, jit=0.0, vj=0):
    """a note at beat m lasting d beats (seconds follow the tempo map)"""
    t0, t1 = T(m), T(m + d)
    if jit:
        t0 += RNG.uniform(-jit, jit)
    if vj:
        v += RNG.integers(-vj, vj + 1)
    note(ch, p, t0, t1 - t0, v)


def cb(ch, ps, m, d, v, **k):
    for p in ps:
        nb(ch, p, m, d, v, **k)


def fx(*a):
    FX.append(a)


MOTIF = [(0.0, 0.5), (0.5, 0.5), (1.0, 0.5), (1.5, 0.5), (2.0, 1.0)]     # 4 rising eighths and a quarter
MOTIF_DV = [0, -4, -5, 5, 2]


def motif(ch, m0, ps, vel, ring=1.7, shift=0, dvs=MOTIF_DV):
    for (o, d), p, dv in zip(MOTIF, ps, dvs):
        nb(ch, P(p) + shift, m0 + o, max(d, ring), vel + dv)


def arp(ch, m0, ps, step, vel, n=None, v_shape=None, jit=0.004, ring=1.5):
    """broken chord: ps cycled in steps of `step` beats over n notes"""
    n = len(ps) if n is None else n
    for i in range(n):
        v = vel if v_shape is None else v_shape(i, n)
        nb(ch, ps[i % len(ps)], m0 + i * step, ring, v, jit=jit if i else 0.0, vj=3)


# =========================================================================== THE SCORE
# per bar: (chord name, harp/pizz root marker, low strings, slow strings (upper), warm pad)
CHORDS = {
    1: ('D', ['D2'], ['D2', 'A2', 'F#3'], ['A3', 'D4', 'E4'], ['D3', 'A3', 'F#4']),
    2: ('Bm7', ['B1'], ['B2', 'F#3', 'A3'], ['A3', 'D4', 'F#4'], ['B2', 'F#3', 'D4']),
    3: ('Gmaj9', ['G1', 'G2'], ['G2', 'D3', 'B3'], ['B3', 'D4', 'F#4', 'A4'], ['G2', 'D3', 'B3']),
    4: ('Em9', ['E2', 'E1'], ['E2', 'B2', 'G3'], ['D4', 'F#4', 'G4', 'B4'], ['E3', 'B3', 'G4']),
    5: ('F(add9)', ['F1', 'F2'], ['F2', 'C3', 'A3'], ['G4', 'A4', 'C5'], ['F3', 'C4', 'A4']),
    6: ('Bb(add9)', ['Bb1', 'Bb2'], ['Bb1', 'F2', 'D3', 'F3'], ['C5', 'D5', 'F5'], ['Bb2', 'F3', 'D4']),
    7: ('C(add9)', ['C2', 'C3'], ['C2', 'G2'], ['D5', 'E5', 'G5'], ['G3', 'C4', 'E4']),
    8: ('D(add9)', ['D2', 'D1'], ['D2', 'A2', 'D3', 'F#3', 'A3'], ['E5', 'F#5', 'A5'], ['D3', 'A3', 'F#4']),
    9: ('Gm6', ['G1'], ['G2', 'D3', 'Bb3'], ['Bb3', 'D4', 'E4', 'G4'], ['G2', 'D3', 'Bb3', 'E4']),
}
CUE_BARS = {0.0: 1, 4.14: 3, 5.68: 4, 6.92: 5, 8.08: 6, 9.32: 7, 10.86: 8}


def compose():
    bed()
    snail()
    zoom_out()
    galaxy()
    shell()
    damp()


def damp():
    """plucked/struck notes that start in bars 3-8 are released at the next bar line, so a lean note never rings
    on into the next layer's chord (the hall carries the tail)"""
    lines = [T(bar(b)) for b in range(3, 10)]
    for i, (ch, p, t, d, v) in enumerate(NOTES):
        if ch in (HARP, CEL, MBOX, GLOCK, PIZZ) and lines[0] - 0.005 <= t < lines[-1] - 0.005:
            nxt = min(x for x in lines if x > t + 0.005)
            if t + d > nxt + 0.03:
                NOTES[i] = (ch, p, t, nxt + 0.03 - t, v)


def bed():
    """the warm string/pad chord under everything (legato; low notes end a hair early so each new root speaks)"""
    for b, (_, _, low, slow, pad) in CHORDS.items():
        m0 = bar(b)
        if b != 7:                                         # in the zoom the low strings lift before each arrival
            cb(LOW, low, m0, 2.78 if b in (1, 2, 9) else 2.62, 84 if b in (1, 2, 9) else 92)
        cb(SLOW, slow, m0, 3.0, 76 if b in (1, 2, 9) else 88)
        cb(PAD, pad, m0, 3.0, 70)
    nb(LOW, 'C2', bar(7), 2.62, 96)                       # bar 7: the low strings carry the motif over C/G
    nb(LOW, 'G2', bar(7), 2.62, 90)


def snail():
    """bars 1-2: the snail looks up. Music box motif + harp lullaby; the shooting star (0.6-1.3) and its chime."""
    motif(MBOX, bar(1), ['D5', 'F#5', 'A5', 'D6', 'C#6'], 90, dvs=[0, -4, -11, 5, 2])   # A5 under the star
    motif(CEL, bar(1), ['D5', 'F#5', 'A5', 'D6', 'C#6'], 46)
    for (m, d), p, v in zip([(3, 1.5), (4.5, 0.5), (5.0, 1.0)], ['B5', 'A5', 'F#5'], [88, 80, 82]):
        nb(MBOX, p, m, max(d, 1.6), v)
        nb(CEL, p, m, max(d, 1.6), v - 42)
    # harp lullaby (eighths, up-down) with a low root on each downbeat
    cb(HARP, ['D1', 'D2'], bar(1), 3.0, 80)
    arp(HARP, bar(1), ['D3', 'A3', 'D4', 'F#4', 'D4', 'A3'], 0.5, 52, v_shape=lambda i, n: [60, 48, 50, 54, 46, 44][i])
    nb(PIZZ, 'D2', bar(1), 0.5, 64)
    nb(HARP, 'B1', bar(2), 3.0, 64)
    arp(HARP, bar(2), ['B2', 'F#3', 'D4', 'A4', 'D4', 'F#3'], 0.5, 50, v_shape=lambda i, n: [56, 46, 48, 52, 44, 42][i])
    # the shooting star: a harp glissando up the D pentatonic into a chime at 0.90 (glock + celesta + bell)
    gl = ['A5', 'B5', 'D6', 'E6', 'F#6', 'A6', 'B6', 'D7', 'E7', 'F#7']
    for i, p in enumerate(gl):
        note(HARP, p, 0.58 + i * 0.027, 0.25, 24 + 2.4 * i)
    note(GLOCK, 'A6', 0.90, 1.2, 98)
    note(GLOCK, 'E7', 0.902, 1.2, 88)
    note(GLOCK, 'A7', 0.904, 1.0, 84)
    note(CEL, 'A6', 0.90, 1.0, 56)
    note(CEL, 'E7', 0.90, 1.0, 50)
    fx('star', 0.55, 0.90, 1.45)
    # stars twinkling over the snail (glock, very soft) and a firefly drifting past the head (~2 s)
    for m, p, v in [(2.5, 'A6', 30), (4.0, 'F#7', 26), (5.25, 'D7', 26)]:
        nb(GLOCK, p, m, 1.0, v)
    fx('firefly', 1.96, 'A6', 0.55, 0.72)
    fx('firefly', 2.14, 'E7', 0.38, 0.80)
    fx('firefly', 2.42, 'B6', 0.26, 0.86)


def zoom_out():
    """bars 3-7: each layer arrival is a new chord, a new entry and the motif again, a world wider."""
    # --- bar 3 (4.14) the meadow: Gmaj9; celesta takes the motif; pizzicato fireflies
    m = bar(3)
    cb(HARP, CHORDS[3][1], m, 3.0, 90)
    cb(PIZZ, ['G1', 'G2'], m, 0.5, 88)
    nb(CB, 'G1', m, 2.6, 86)
    motif(CEL, m, ['G5', 'B5', 'D6', 'G6', 'F#6'], 82)
    motif(HARP, m, ['G4', 'B4', 'D5', 'G5', 'F#5'], 52)
    motif(MBOX, m, ['G5', 'B5', 'D6', 'G6', 'F#6'], 54)
    arp(HARP, m, ['G2', 'D3', 'B3', 'F#4', 'A4', 'F#4'], 0.5, 52, v_shape=lambda i, n: [0, 50, 52, 54, 50, 48][i] or 40)
    for t, p, v in [(4.31, 'D6', 56), (4.52, 'A5', 50), (4.66, 'F#6', 60), (4.93, 'B5', 52), (5.12, 'D6', 62),
                    (5.30, 'A5', 48), (5.47, 'E6', 56), (5.86, 'B5', 54), (6.03, 'F#6', 58), (6.22, 'E6', 50),
                    (6.46, 'G6', 56), (6.70, 'D6', 46)]:
        note(PIZZ, p, t, 0.25, v)
    for i, (t, p, a, pan) in enumerate([(4.24, 'B6', 0.45, 0.2), (4.40, 'F#7', 0.35, 0.85), (4.58, 'D7', 0.5, 0.35),
                                        (4.79, 'A6', 0.4, 0.65), (4.97, 'E7', 0.32, 0.1), (5.18, 'B6', 0.45, 0.9),
                                        (5.36, 'D7', 0.36, 0.5), (5.55, 'F#7', 0.3, 0.25), (5.92, 'G7', 0.34, 0.75),
                                        (6.10, 'B6', 0.4, 0.15), (6.33, 'E7', 0.3, 0.6), (6.58, 'D7', 0.26, 0.9)]):
        fx('firefly', t, p, a, pan)
    # --- bar 4 (5.68) the valley, the aurora: Em9; violins enter and begin to rise; triplet ripples
    m = bar(4)
    cb(HARP, CHORDS[4][1], m, 3.0, 80)
    cb(PIZZ, ['E1', 'E2'], m, 0.5, 80)
    nb(CB, 'E1', m, 2.6, 88)
    cb(VLN, ['G5', 'B5'], m, 2.95, 84)
    motif(CEL, m, ['E5', 'G5', 'B5', 'E6', 'F#6'], 78)
    motif(HARP, m, ['E4', 'G4', 'B4', 'E5', 'F#5'], 50)
    arp(HARP, m + 1 / 3, ['B3', 'E4', 'F#4', 'G4', 'B4', 'G4', 'F#4', 'E4'], 1 / 3, 48, jit=0.003,
        v_shape=lambda i, n: 46 + 2 * (i % 3 == 2))
    fx('aurora', 5.25, 10.6, ['A6', 'G6', 'D7', 'A7'], 0.7)
    # --- bar 5 (6.92) the curve of the world: F(add9); the choir enters softly; 16th ripples open out
    m = bar(5)
    cb(HARP, CHORDS[5][1], m, 3.0, 80)
    cb(PIZZ, ['F1', 'F2'], m, 0.5, 80)
    nb(CB, 'F1', m, 2.6, 88)
    cb(VLN, ['A5', 'C6'], m, 2.95, 86)
    cb(OOH, ['F3', 'C4', 'F4', 'A4'], m, 3.0, 76)
    motif(CEL, m, ['F5', 'A5', 'C6', 'F6', 'E6'], 78)
    motif(HARP, m, ['F4', 'A4', 'C5', 'F5', 'E5'], 50)
    ripple(m, ['F3', 'C4', 'F4', 'G4', 'A4', 'C5', 'F5', 'C5', 'A4', 'G4', 'F4', 'C4'], 44)
    # --- bar 6 (8.08) the planet: Bb(add9), the widest chord - low Bb, aahs, warm horns, timpani, sub bloom
    m = bar(6)
    cb(HARP, CHORDS[6][1], m, 3.0, 86)
    cb(PIZZ, ['Bb1', 'Bb2'], m, 0.5, 84)
    nb(CB, 'Bb1', m, 2.6, 92)
    cb(VLN, ['Bb5', 'D6'], m, 2.95, 88)
    cb(OOH, ['Bb3', 'D4', 'F4', 'C5'], m, 3.0, 80)
    cb(AAH, ['Bb3', 'F4', 'D5'], m, 3.0, 80)
    cb(HORN, ['Bb2', 'F3', 'D4'], m, 2.85, 76)
    nb(TIMP, 'Bb2', m, 2.0, 62)
    nb(TIMP, 'F2', m + 0.01, 2.0, 48)
    motif(CEL, m, ['Bb5', 'D6', 'F6', 'Bb6', 'A6'], 80)
    motif(HARP, m, ['Bb4', 'D5', 'F5', 'Bb5', 'A5'], 52)
    ripple(m, ['Bb2', 'F3', 'Bb3', 'C4', 'D4', 'F4', 'Bb4', 'C5', 'D5', 'F5', 'D5', 'C5'], 46)
    fx('swell', 8.08, 1.0, 0.30)
    fx('bloom', 8.08, 'Bb1', 0.22, 3.0)
    # --- bar 7 (9.32) the sun and its planets: C(add9); the horns swell bright; the motif in the low strings
    m = bar(7)
    cb(HARP, CHORDS[7][1], m, 3.0, 96)
    cb(PIZZ, ['C2', 'C3'], m, 0.5, 92)
    nb(CB, 'C2', m, 2.6, 94)
    cb(VLN, ['C6', 'E6'], m, 2.95, 90)
    cb(TREM, ['E6', 'G6'], m, 2.95, 70)
    cb(OOH, ['G3', 'E4', 'G4', 'D5'], m, 3.0, 82)
    cb(AAH, ['E4', 'G4', 'E5'], m, 3.0, 84)
    cb(HORN, ['G3', 'E4', 'G4'], m, 2.95, 96)
    nb(HORN, 'C3', m, 2.85, 84)
    nb(TIMP, 'G2', m, 1.5, 86)
    nb(TIMP, 'C3', m + 0.01, 1.5, 52)
    motif(LOW, m, ['C3', 'E3', 'G3', 'C4', 'B3'], 108, ring=0.0)
    motif(HARP, m, ['C3', 'E3', 'G3', 'C4', 'B3'], 64)
    ripple(m, ['E4', 'G4', 'D5', 'E5', 'G5', 'D6', 'E6', 'D6', 'G5', 'E5', 'D5', 'G4'], 48, cel_oct=True)
    # the breath in: a soft timpani roll and a reverse swell into the galaxy
    roll(TIMP, 'A2', T(bar(7) + 2.0), T(bar(8)) - 0.03, 22, 84, rate=16, shape=1.6)
    fx('swell', 10.86, 1.5, 0.48)


def ripple(m0, ps, vel, cel_oct=False):
    """a bar of 16ths: harp and celesta trade notes (celesta an octave up on its turns when cel_oct)"""
    for i in range(12):
        p = ps[i % len(ps)]
        ch = HARP if i % 2 == 0 else CEL
        pp = P(p) + (12 if (ch == CEL and cel_oct) else 0)
        nb(ch, pp, m0 + 0.25 * i, 0.8, vel + (6 if i % 4 == 0 else 0) - (8 if ch == CEL else 0),
           jit=0.003 if i else 0.0, vj=3)


def roll(ch, p, t0, t1, v0, v1, rate=16.0, shape=1.0):
    t = t0
    while t < t1:
        x = (t - t0) / max(1e-6, t1 - t0)
        note(ch, p, t, 0.12, v0 + (v1 - v0) * x ** shape + RNG.integers(-3, 4))
        t += 1.0 / rate * RNG.uniform(0.92, 1.08)


STAR_ALL = ['D', 'E', 'F#', 'A', 'B']
STAR_LATE = ['D', 'E', 'A']                    # over the Gm6 (bar 9) only D E A


def galaxy():
    """bar 8 (10.86): the peak - full, shimmering, vast (not loud). The music box motif returns inside it."""
    m = bar(8)
    cb(HARP, CHORDS[8][1], m, 3.0, 92)
    cb(PIZZ, ['D1', 'D2'], m, 0.5, 86)
    cb(CB, ['D1', 'D2'], m, 2.6, 96)
    cb(VLN, ['A5', 'F#6'], m, 2.4, 92)
    cb(TREM, ['F#6', 'A6', 'D7'], m, 2.5, 74)
    cb(OOH, ['D4', 'F#4', 'A4', 'E5'], m, 3.0, 86)
    cb(AAH, ['D4', 'A4', 'D5', 'F#5'], m, 3.0, 88)
    cb(HORN, ['A3', 'D4', 'F#4', 'A4'], m, 2.6, 98)
    nb(TIMP, 'D2', m, 2.0, 86)
    nb(TIMP, 'A2', m + 0.01, 1.6, 58)
    roll(TIMP, 'D2', T(m + 0.6), T(m + 2.2), 40, 12, rate=14)
    note(DR, 81, T(m), 2.5, 52)
    # the harp sweeps up the galaxy (D major, D3 -> D7) and ripples on high
    sc = [p for p in range(P('D3'), P('D7') + 1) if (p - 2) % 12 in (0, 2, 4, 7, 9)]
    for i, p in enumerate(sc):
        note(HARP, p, T(m) + 0.004 + i * 0.019, 1.2, 62 + 30 * i / len(sc))
    for i, p in enumerate(['A5', 'D6', 'E6', 'F#6', 'A6', 'D7', 'A6', 'F#6', 'E6', 'D6']):
        nb(CEL if i % 2 else HARP, p, m + 1.0 + 0.25 * i, 0.8, 52 - 2 * i, jit=0.003, vj=3)
    # the motif returns: music box at home, celesta + glockenspiel an octave up (the stars)
    motif(MBOX, m, ['D5', 'F#5', 'A5', 'D6', 'C#6'], 92)
    motif(CEL, m, ['D6', 'F#6', 'A6', 'D7', 'C#7'], 64)
    motif(GLOCK, m, ['D6', 'F#6', 'A6', 'D7', 'C#7'], 52)
    # glockenspiel stars: dense at the arrival, thinning out as the galaxy becomes the shell
    t, rng = 10.92, np.random.default_rng(1086)
    while t < 13.9:
        x = (t - 10.92) / 3.0
        pcs = STAR_ALL if t < 12.0 else STAR_LATE
        p = rng.choice([q for q in range(P('D6'), P('B7') + 1) if NAMES12[q % 12] in pcs])
        note(GLOCK, int(p), t, 0.8, 50 - 26 * x + rng.integers(-4, 5))
        t += 1.0 / (9.0 * (1 - x) ** 1.6 + 1.2) * rng.uniform(0.7, 1.3)
    fx('bloom', 10.86, 'D2', 0.26, 4.0)
    fx('bloom', 10.86, 'D1', 0.18, 4.2)
    fx('stars', 10.86, 13.9, 0.55)
    fx('aurora', 10.6, 13.8, ['D6', 'A6', 'E7', 'A7'], 0.55)


def shell():
    """bar 9 (12.81): the galaxy is the shell; the snail again. The music box sighs (B . A F# of bar 2 turned to
    Bb . A G E over the Gm6) and the E5 steps down onto D5, the loop's first note."""
    m = bar(9)
    nb(HARP, 'G1', m, 2.6, 60)
    nb(PIZZ, 'G1', m, 0.5, 50)
    arp(HARP, m, ['G2', 'D3', 'Bb3', 'E4', 'Bb3', 'D3'], 0.5, 48, v_shape=lambda i, n: [0, 48, 48, 50, 44, 42][i] or 54)
    for (o, d), p, v in zip([(0, 1.5), (1.5, 0.5), (2.0, 0.5), (2.5, 0.5)], ['Bb5', 'A5', 'G5', 'E5'],
                            [88, 80, 78, 76]):
        nb(MBOX, p, m + o, max(d, 1.6), v)
        nb(CEL, p, m + o, max(d, 1.6), v - 44)
    for mm, p, v in [(bar(9) + 0.75, 'D7', 28), (bar(9) + 2.25, 'A6', 24)]:
        nb(GLOCK, p, mm, 1.0, v)
    fx('firefly', 13.42, 'D7', 0.45, 0.70)
    fx('firefly', 13.60, 'A6', 0.32, 0.78)
    fx('aurora', 12.9, 19.2, ['A6', 'D7', 'A7'], 0.22)     # the faint aurora over the snail, across the seam


# --------------------------------------------------------------------------- MIDI
PPQ = 960
TEMPO_US = 500000            # render MIDI: 120 bpm, 1 tick = 1/1920 s
TPS = 1920


def vlq(n):
    b = [n & 0x7f]
    n >>= 7
    while n:
        b.append((n & 0x7f) | 0x80)
        n >>= 7
    return bytes(reversed(b))


def lat_of(ch):
    return 0.0 if ch == DR else LAT.get(INIT_PROG.get(ch, 0), 0.0)


def note_list(chs, cycles, lead=True):
    """[ch, pitch, t_on, t_off, vel] for the given cycle offsets (s), attack-lead applied, unison doublings merged,
    same-key overlaps cut (a note-off would release every voice on that key)"""
    out = []
    for off in cycles:
        for ch, p, t, d, v in NOTES:
            if ch not in chs:
                continue
            t0 = off + t - (lat_of(ch) if lead else 0.0)
            out.append([ch, p, t0, t0 + max(0.03, d), v])
    out.sort(key=lambda n: (n[0], n[1], n[2]))
    merged = []
    for nt in out:
        a = merged[-1] if merged else None
        if a and a[0] == nt[0] and a[1] == nt[1] and nt[2] - a[2] < 0.005:
            a[3], a[4] = max(a[3], nt[3]), max(a[4], nt[4])
        else:
            merged.append(nt)
    for i in range(len(merged) - 1):
        a, b = merged[i], merged[i + 1]
        if a[0] == b[0] and a[1] == b[1] and a[3] > b[2] - 0.002:
            a[3] = max(a[2] + 0.01, b[2] - 0.002)
    return [n for n in merged if 0 <= n[1] <= 127]


def setup_events(chs):
    ev = []
    for c in sorted(chs):
        if c in INIT_PROG:
            ev.append((0, 0, c, bytes([0xC0 | c, INIT_PROG[c]])))
        for num, val in [(7, VOL[c]), (10, PAN[c]), (91, 0), (93, 0)]:
            ev.append((0, 0, c, bytes([0xB0 | c, num, val])))
    return ev


def smf(tracks_ev, meta_ev, end_tick):
    """tracks_ev: list of (name, [(tick, order, ch, bytes)]); meta_ev: [(tick, bytes)] for the conductor track"""
    tr0, last = bytearray(), 0
    for tk, data in sorted(meta_ev, key=lambda e: e[0]):
        tr0 += vlq(tk - last) + data
        last = tk
    tracks = [tr0 + vlq(max(0, end_tick - last)) + b'\xff\x2f\x00']
    for name, ev in tracks_ev:
        ev = sorted(ev, key=lambda e: (e[0], e[1]))
        tr = bytearray()
        if name:
            nm = name.encode()
            tr += b'\x00\xff\x03' + vlq(len(nm)) + nm
        last = 0
        for tk, _, _, data in ev:
            tk = min(tk, end_tick)
            tr += vlq(tk - last) + data
            last = tk
        tr += vlq(max(0, end_tick - last)) + b'\xff\x2f\x00'
        tracks.append(tr)
    out = b'MThd' + struct.pack('>IHHH', 6, 1, len(tracks), PPQ)
    for tr in tracks:
        out += b'MTrk' + struct.pack('>I', len(tr)) + bytes(tr)
    return out


def write_render_midi(path, chs):
    """three cycles after the pre-roll, constant tempo (ticks = seconds * 1920), attack lead applied; controller
    curves sampled every 25 ms (= 48 ticks) from the periodic ENV, so every cycle gets identical events"""
    ev = setup_events(chs)
    for ch, p, t0, t1, v in note_list(chs, [T0 + k * DUR for k in range(NCYC)]):
        ev.append((int(round(t1 * TPS)), 1, ch, bytes([0x80 | ch, p, 0])))
        ev.append((int(round(t0 * TPS)), 3, ch, bytes([0x90 | ch, p, v])))
    nstep = int(round((T0 + NCYC * DUR + TAIL) / 0.025))
    per, i0 = int(round(DUR / 0.025)), int(round(T0 / 0.025))
    for ch in chs:
        last = None
        for i in range(nstep):
            val = int(round(env_val(ch, ((i - i0) % per) * 0.025)))     # exactly periodic (integer index)
            if val != last:
                ev.append((i * 48, 2, ch, bytes([0xB0 | ch, 11, val])))
                last = val
    title = b'CARRY (render: 3 cycles)'
    meta = [(0, b'\xff\x03' + vlq(len(title)) + title), (0, b'\xff\x51\x03' + TEMPO_US.to_bytes(3, 'big'))]
    with open(path, 'wb') as f:
        f.write(smf([(None, ev)], meta, int(round((T0 + NCYC * DUR + TAIL) * TPS))))


CUES = [(0.0, 'seam: home chord D, music box motif', 'low'), (0.90, 'shooting-star chime', 'high'),
        (4.14, 'L1 meadow: Gmaj9, pizz fireflies', 'low'), (5.68, 'L2 valley: Em9, violins rise', 'low'),
        (6.92, 'L3 curve: F(add9), choir enters', 'low'), (8.08, 'L4 planet: Bb(add9) swell', 'low'),
        (9.32, 'L5 sun: C(add9) horns, low motif', 'low'), (10.86, 'L6 galaxy: D(add9) the peak', 'low')]


def write_score_midi(path):
    """score.mid: ONE cycle as written (no attack lead), tempo-mapped so that the 9 bars of 3/4 land on the cues
    (a tempo event every 16th from the spline), expression curves, cue markers; note-offs end by 15.000 s"""
    q = 0.25
    mj = np.arange(0, BEATS + 1e-9, q)
    tj = np.array([T(m) for m in mj])
    kj = (mj * PPQ).astype(int)

    def tick(t):
        return int(round(np.interp(min(max(t, 0.0), DUR), tj, kj)))

    title = b'CARRY'
    meta = [(0, b'\xff\x03' + vlq(len(title)) + title), (0, b'\xff\x58\x04\x03\x02\x18\x08')]
    for j in range(len(mj) - 1):
        us = int(round((tj[j + 1] - tj[j]) / q * 1e6))
        meta.append((int(kj[j]), b'\xff\x51\x03' + us.to_bytes(3, 'big')))
    for t, lab, _ in CUES:
        txt = f'{t:.2f} {lab}'.encode()
        meta.append((tick(t), b'\xff\x06' + vlq(len(txt)) + txt))
    end_tick = BEATS * PPQ
    tracks = []
    for c in range(16):
        ns = note_list([c], [0.0], lead=False)
        if not ns:
            continue
        ev = setup_events([c])
        for ch, p, t0, t1, v in ns:
            ev.append((tick(min(t1, DUR - 1e-4)), 1, ch, bytes([0x80 | ch, p, 0])))
            ev.append((tick(t0), 3, ch, bytes([0x90 | ch, p, v])))
        lastv = None
        for i in range(int(round(DUR / 0.025))):
            val = int(round(env_val(c, i * 0.025)))
            if val != lastv:
                ev.append((tick(i * 0.025), 2, c, bytes([0xB0 | c, 11, val])))
                lastv = val
        tracks.append((NAMES[c], ev))
    with open(path, 'wb') as f:
        f.write(smf(tracks, meta, end_tick))


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


def place(buf, t, sig):
    i0 = int(round(t * SR))
    if i0 >= len(buf):
        return
    if i0 < 0:
        sig = sig[-i0:]
        i0 = 0
    n = min(len(sig), len(buf) - i0)
    if n <= 0:
        return
    buf[i0:i0 + n] += sig[:n, None] if sig.ndim == 1 else sig[:n]


def panned(y, pan):
    return np.stack([y * np.cos(pan * np.pi / 2), y * np.sin(pan * np.pi / 2)], 1)


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


def sweep_noise(n, f0, f1, q=1.2, stereo=True, rng=None):
    rng = RNG if rng is None else rng
    ch = 2 if stereo else 1
    x = rng.standard_normal((n, ch))
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


def bell(f, dur, bright=1.0, rng=None):
    """a soft glassy bell (inharmonic partials, each decaying faster the higher it is)"""
    rng = RNG if rng is None else rng
    n = int(dur * SR)
    t = tt(n)
    y = np.zeros(n)
    for r, a, d in [(1.0, 1.0, 1.0), (2.0, 0.30, 0.55), (2.76, 0.42, 0.40), (4.07, 0.20, 0.25),
                    (5.43, 0.13 * bright, 0.16), (8.93, 0.05 * bright, 0.08)]:
        if f * r < SR * 0.45:
            y += a * np.sin(2 * np.pi * f * r * t + rng.uniform(0, 6.28)) * np.exp(-t / (dur * d / 3.0))
    return y * np.minimum(1, t / 0.0012)


# --------------------------------------------------------------------------- the hybrid layer
_CRASH = {}


def crash_sample(tmp):
    if 'x' not in _CRASH:
        mid, wav = os.path.join(tmp, 'crash.mid'), os.path.join(tmp, 'crash.wav')
        ev = [(0, 0, DR, bytes([0xB9, 7, 127])), (0, 3, DR, bytes([0x99, 49, 110])),
              (int(3.0 * TPS), 1, DR, bytes([0x89, 49, 0])), (2, 3, DR, bytes([0x99, 57, 100])),
              (int(3.0 * TPS), 1, DR, bytes([0x89, 57, 0]))]
        with open(mid, 'wb') as f:
            f.write(smf([(None, ev)], [(0, b'\xff\x51\x03' + TEMPO_US.to_bytes(3, 'big'))], int(4.5 * TPS)))
        x = render_midi(mid, wav, int(4.0 * SR))
        _CRASH['x'] = x / np.abs(x).max()
    return _CRASH['x']


FXLEN = DUR + 6.0


def render_fx(tmp):
    """the synthesized layer for ONE cycle (cycle-relative, tails up to 6 s past the end): (low, air)"""
    n = int(FXLEN * SR)
    low, air = np.zeros((n, 2)), np.zeros((n, 2))
    rng = np.random.default_rng(42)
    crash = crash_sample(tmp)
    for a in FX:
        kind = a[0]
        if kind == 'star':
            # a shooting star crossing top-left -> right: a sparkle-whoosh panned L->R, a rising run of glass
            # pings, the chime at t_ping, a shimmering tail
            _, t0, tp, t1 = a
            m = int((t1 - t0 + 1.2) * SR)
            x = tt(m)
            pos = np.clip(x / (t1 - t0), 0, 1)
            env = np.clip(x / (tp - t0), 0, 1) ** 2 * np.exp(-np.maximum(0, x - (tp - t0)) / 0.32)
            wh = sweep_noise(m, 5200, 9000, q=1.4, rng=rng)[:, 0] * env * 0.016
            air_ = np.stack([wh * np.cos(pos * np.pi / 2 * 0.9 + 0.08), wh * np.sin(pos * np.pi / 2 * 0.9 + 0.08)], 1)
            place(air, t0, air_)
            run = ['E6', 'F#6', 'A6', 'B6', 'D7', 'E7']
            for i, p in enumerate(run):
                tt_ = t0 + 0.04 + (tp - t0 - 0.16) * i / (len(run) - 1)
                place(air, tt_, panned(bell(hz(p), 0.4, 0.5, rng) * (0.003 + 0.001 * i), 0.15 + 0.1 * i))
            place(air, tp, panned(bell(hz('A6'), 1.5, 1.0, rng) * 0.046, 0.5))
            place(air, tp + 0.003, panned(bell(hz('E7'), 1.2, 1.0, rng) * 0.032, 0.62))
            place(air, tp + 0.001, panned(bell(hz('A7'), 0.8, 1.0, rng) * 0.026, 0.7))
            for i in range(14):
                p = ['D7', 'E7', 'F#7', 'A7', 'B7', 'D8'][rng.integers(0, 6)]
                tt_ = tp + 0.04 + rng.exponential(0.22)
                place(air, tt_, panned(bell(hz(p), 0.4, 0.5, rng) * 0.004, np.clip(0.55 + 0.35 * (tt_ - tp), 0, 1)))
        elif kind == 'firefly':
            _, t, p, amp, pan = a
            m = int(0.5 * SR)
            x = tt(m)
            f = hz(p) * (1 + 0.012 * np.minimum(1, x / 0.05))
            ph = 2 * np.pi * np.cumsum(f) / SR
            y = (np.sin(ph) + 0.12 * np.sin(2 * ph)) * np.minimum(1, x / 0.004) * np.exp(-x / 0.12)
            y *= 1 + 0.25 * np.sin(2 * np.pi * 9 * x)
            place(air, t, panned(y * amp * 0.018, pan))
        elif kind == 'aurora':
            # detuned high sines on open fifths, each slowly beating and drifting in pan; a breath of air
            _, t0, t1, ps, amp = a
            m = int((t1 - t0) * SR)
            x = tt(m)
            y = np.zeros((m, 2))
            for p in ps:
                for det in (-0.0018, 0.0021):
                    tw = 0.6 + 0.4 * np.sin(2 * np.pi * rng.uniform(0.25, 0.9) * x + rng.uniform(0, 6.28))
                    pan = 0.5 + 0.38 * np.sin(2 * np.pi * rng.uniform(0.08, 0.2) * x + rng.uniform(0, 6.28))
                    s = np.sin(2 * np.pi * hz(p) * (1 + det) * x + rng.uniform(0, 6.28)) * tw
                    y[:, 0] += s * np.cos(pan * np.pi / 2)
                    y[:, 1] += s * np.sin(pan * np.pi / 2)
            fade = min(1.2, (t1 - t0) / 3)
            env = np.clip(x / fade, 0, 1) ** 1.5 * np.clip((x[-1] - x) / fade, 0, 1) ** 1.5
            breath = hpf(rng.standard_normal((m, 2)), 6500) * 0.05 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.31 * x))[:, None]
            place(air, t0, (y / (2 * len(ps)) + breath) * env[:, None] * amp * 0.030)
        elif kind == 'bloom':
            _, t, p, amp, dur = a
            m = int((dur + 0.5) * SR)
            x = tt(m)
            f = hz(p)
            env = (1 - np.exp(-x / 0.12)) * np.exp(-x / (dur * 0.45))
            y = (np.sin(2 * np.pi * f * x) + 0.18 * np.sin(2 * np.pi * 2 * f * x)) * env
            place(low, t - 0.01, y * amp * 0.11)
        elif kind == 'swell':
            _, tend, dur, amp = a
            m = int(dur * SR)
            r = crash[::-1][-m:] * (np.linspace(0, 1, m) ** 2.2)[:, None]
            r = lpf(r, 7000, 2)
            r[-int(0.012 * SR):] *= np.linspace(1, 0, int(0.012 * SR))[:, None]
            place(air, tend - m / SR - 0.012, r * amp * 0.16)
        elif kind == 'stars':
            # the galaxy: a cloud of tiny glass pings (D pentatonic, high), dense at the arrival, thinning out
            _, t0, t1, amp = a
            t = t0
            while t < t1:
                x = (t - t0) / (t1 - t0)
                pcs = STAR_ALL if t < 12.0 else STAR_LATE
                cands = [q for q in range(P('A6'), P('D9') + 1) if NAMES12[q % 12] in pcs]
                p = int(rng.choice(cands))
                y = bell(440 * 2 ** ((p - 69) / 12), rng.uniform(0.25, 0.7), 0.4, rng)
                place(air, t, panned(y * amp * 0.0065 * (1 - 0.7 * x) * rng.uniform(0.5, 1.0), rng.uniform(0.05, 0.95)))
                t += 1.0 / (40 * (1 - x) ** 2 + 3)
        else:
            raise ValueError(kind)
    return low, air


def lay_cycles(sig):
    """place a cycle-relative signal at every rendered cycle (tails cross into the next cycle)"""
    out = np.zeros((NR, 2))
    for k in range(NCYC):
        place(out, T0 + k * DUR, sig)
    return out


# --------------------------------------------------------------------------- hall reverb
def hall_ir(rt60=3.1, pre=0.024):
    rng = np.random.default_rng(31)
    n = int((rt60 * 1.15 + pre) * SR)
    t = tt(n)
    ir = np.zeros((n, 2))
    for lo, hi, rt in [(None, 250, rt60 * 1.1), (250, 2500, rt60), (2500, 7000, rt60 * 0.7), (7000, None, rt60 * 0.45)]:
        nz = rng.standard_normal((n, 2))
        if lo and hi:
            nz = signal.sosfilt(signal.butter(2, [lo, hi], 'bp', fs=SR, output='sos'), nz, axis=0)
        elif hi:
            nz = lpf(nz, hi, 2)
        else:
            nz = hpf(nz, lo, 2)
        ir += nz * np.exp(-6.91 * t / rt)[:, None]
    ir *= np.minimum(1, t / 0.06)[:, None] ** 1.5
    for _ in range(14):
        d = rng.uniform(0.008, 0.07)
        ir[int(d * SR), rng.integers(0, 2)] += rng.uniform(0.3, 0.9) * (1 - d * 8)
    k0 = int(pre * SR)
    ir = np.concatenate([np.zeros((k0, 2)), ir])[:n]
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


def reverb(x, ir):
    return np.stack([signal.fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in range(2)], 1)


# --------------------------------------------------------------------------- loudness / dynamics
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
    blk = 48
    nb_ = len(x) // blk + 1
    pw = np.mean(np.pad(x, ((0, nb_ * blk - len(x)), (0, 0))) ** 2, 1).reshape(nb_, blk).mean(1)
    lev = 10 * np.log10(pw + 1e-12)
    over = lev - thr_db
    gr = np.where(over <= -knee / 2, 0.0,
                  np.where(over >= knee / 2, over * (1 - 1 / ratio),
                           (1 - 1 / ratio) * (over + knee / 2) ** 2 / (2 * knee)))
    g = np.zeros(nb_)
    ca, cr = np.exp(-1e-3 / att), np.exp(-1e-3 / rel)
    s = 0.0
    for i in range(nb_):
        c = ca if gr[i] > s else cr
        s = c * s + (1 - c) * gr[i]
        g[i] = s
    gl = 10 ** (-np.interp(np.arange(len(x)) / blk, np.arange(nb_), g) / 20)
    return x * gl[:, None]


def limiter(x, ceiling_db=-1.5, look=0.004, rel=0.15):
    ceil = 10 ** (ceiling_db / 20)
    pk = true_peak_env(x)
    req = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    blk = 48
    nb_ = len(x) // blk + 1
    reqb = np.pad(req, (0, nb_ * blk - len(req)), constant_values=1).reshape(nb_, blk).min(1)
    la = int(look * 1000)
    reqb = minimum_filter1d(reqb, size=2 * la + 3, origin=0)
    g = reqb.copy()
    ca = np.exp(-1e-3 / 0.0015)
    for i in range(nb_ - 2, -1, -1):
        g[i] = min(g[i], ca * g[i + 1] + (1 - ca) * 1.0 if g[i + 1] < g[i] else g[i])
    cr = np.exp(-1e-3 / rel)
    for i in range(1, nb_):
        g[i] = min(g[i], cr * g[i - 1] + (1 - cr) * 1.0)
    gl = np.interp(np.arange(len(x)) / blk, np.arange(nb_), g)
    return x * gl[:, None]


# --------------------------------------------------------------------------- mixing
STEM_GAIN = {'strings': 1.0, 'keys': 1.0, 'choir': 0.9, 'brass': 0.9, 'perc': 1.0, 'pad': 0.55,
             'fxlow': 1.0, 'fxair': 1.0}
SEND = {'strings': 0.50, 'keys': 0.55, 'choir': 0.70, 'brass': 0.48, 'perc': 0.42, 'pad': 0.5, 'fxlow': 0.05,
        'fxair': 0.65}


def space(t_abs):
    """periodic send multiplier: the hall opens as we travel out (1.0 at the snail, ~1.55 at the galaxy)"""
    tr = (t_abs - T0) % DUR
    return 1.0 + 0.55 * ((1 + np.cos(2 * np.pi * (tr - 10.4) / DUR)) / 2) ** 1.6


def mix(dry):
    ir = hall_ir()
    sg = space(tt(NR))[:, None]
    stems, send_bus = {}, np.zeros((NR, 2))
    for name, x in dry.items():
        x = x * STEM_GAIN[name]
        if name not in ('fxlow', 'perc'):
            x = hpf(x, 32)
        if name in ('strings', 'choir', 'brass', 'pad'):
            x = peq(x, 300, -2.0, 0.9)
        if name == 'strings':
            x = shelf(x, 6500, 1.2, True)
        if name == 'keys':
            x = peq(x, 3200, 1.0, 0.7)
        if name == 'pad':
            x = lpf(x, 3500, 2)
        if name == 'fxlow':
            x = lpf(x, 600)
        send = hpf(x, 140 if name in ('fxlow', 'perc') else 70) * SEND[name] * sg
        send_bus += send
        stems[name] = x + reverb(send, ir)
    return stems, send_bus, ir


def master(bus):
    x = hpf(bus, 26, 2)
    x = peq(x, 240, -1.0, 0.7)
    x = shelf(x, 9500, 1.0, True)
    pre = lufs(x[I1:I2])
    x = x * 10 ** ((-20 - pre) / 20)
    x = compressor(x, thr_db=-25, ratio=1.6, att=0.04, rel=0.45)
    g, y = 0.0, None
    for _ in range(14):
        xin = x * 10 ** (g / 20)
        y = limiter(xin, ceiling_db=CEILING)
        L = lufs(y[I1:I2])
        if abs(L - LUFS_TARGET) < 0.01:
            break
        g += LUFS_TARGET - L
    a, b = np.abs(xin[I1:I2]).max(1), np.abs(y[I1:I2]).max(1)
    m = a > 1e-4
    gr = 20 * np.log10(np.maximum(b[m], 1e-12) / a[m])
    MASTER_STATS.update(limit_max=-gr.min(), limit_ms=1000 * np.sum(gr < -1.0) / SR)
    return y


MASTER_STATS = {}


# --------------------------------------------------------------------------- verification
SECTIONS = [(0.0, 0.55, 'snail: music box motif'), (0.55, 1.45, 'shooting star + chime'),
            (1.45, 4.14, 'snail: the answer, firefly'), (4.14, 5.68, 'L1 meadow (fireflies)'),
            (5.68, 6.92, 'L2 valley (violins rise)'), (6.92, 8.08, 'L3 curve (choir)'),
            (8.08, 9.32, 'L4 planet (widest)'), (9.32, 10.86, 'L5 sun (horns, low motif)'),
            (10.86, 12.81, 'L6 galaxy (the peak)'), (12.81, 15.0, 'the shell -> the snail')]
BANDS = {'low': (None, 150), 'mid': (150, 2000), 'high': (3000, 10000)}


def onset_detect(x, band='low'):
    """causal 15 ms RMS on a 1 ms hop, 15 ms rise detector, peak picking; the onset time is the first frame of the
    rise that clears the pre-rise level by 3 dB"""
    lo_, hi_ = BANDS[band]
    sos = (signal.butter(4, hi_, 'lp', fs=SR, output='sos') if lo_ is None else
           signal.butter(4, [lo_, hi_], 'bp', fs=SR, output='sos'))
    s = signal.sosfiltfilt(sos, x.mean(1))
    hop, win = 48, 720
    c = np.concatenate([[0], np.cumsum(s ** 2)])
    idx = np.arange(win, len(s), hop)
    e = np.sqrt((c[idx] - c[idx - win]) / win)
    tframe = (idx - win) / SR
    db = 20 * np.log10(e + 1e-7)
    lag = 15
    rise = np.zeros(len(db))
    rise[lag:] = db[lag:] - db[:-lag]
    peaks, _ = signal.find_peaks(rise, height=3.0, distance=60)
    out = []
    for pk in peaks:
        base = db[max(0, pk - lag)]
        j = max(0, pk - lag)
        while j < pk and db[j] < base + 3:
            j += 1
        out.append((tframe[j] + win / SR, rise[pk]))
    return out


def lsd(a, b):
    return np.sqrt(np.mean((a - b) ** 2))


def seam_report(full, y):
    """the loop seam, measured: the last sample of score.wav against its first, and the looped signal against the
    continuous three-cycle render at the same musical moment (the 30.000 s point)"""
    L = []
    w = np.concatenate([y, y])                                  # the loop played twice
    # 1. cycle identity: the kept cycle vs the next one in the continuous render
    n3 = 3 * SR
    d_head = np.abs(full[I1:I1 + n3] - full[I2:I2 + n3]).max()
    d_body = np.abs(full[I1:I2 - SR // 2] - full[I2:I2 + NS - SR // 2]).max()
    # 2. the sample step across the seam
    step_seam = y[0] - y[-1]
    step_true = full[I2] - full[I2 - 1]
    steps = np.abs(np.diff(y, axis=0))
    rank = [100.0 * np.mean(steps[:, c] < abs(step_seam[c])) for c in range(2)]
    # 3. looped vs continuous, +-1 s around the seam
    z = w[NS - SR:NS + SR]
    zc = full[I2 - SR:I2 + SR]
    d_loop = np.abs(z - zc).max()
    db = lambda v: 20 * np.log10(max(v, 1e-12))
    L.append('Loop seam (the last sample of score.wav -> its first)')
    L.append(f'  first sample  L {y[0, 0]:+.6f}  R {y[0, 1]:+.6f}   last sample  L {y[-1, 0]:+.6f}  R {y[-1, 1]:+.6f}')
    L.append(f'  step across the seam (first - last)   L {step_seam[0]:+.6f}  R {step_seam[1]:+.6f}  '
             f'(|step| sits at percentile {rank[0]:.0f} (L) / {rank[1]:.0f} (R) of all sample steps in the file; '
             f'median {np.median(steps):.6f}, max {steps.max():.6f})')
    L.append(f'  the same step in the continuous render at 30.000 s      L {step_true[0]:+.6f}  R {step_true[1]:+.6f}  '
             f'(difference {db(np.abs(step_seam - step_true).max()):.1f} dBFS)')
    L.append(f'  looped signal vs continuous render, +-1 s around the seam: max |difference| {db(d_loop):.1f} dBFS')
    L.append(f'  cycle identity (kept cycle vs the next): first 3 s {db(d_head):.1f} dBFS, whole cycle '
             f'(to 0.5 s before its end, where the 4th cycle would begin) {db(d_body):.1f} dBFS')
    # 4. high-frequency click test: >12 kHz energy in 1 ms windows
    h = hpf(w, 12000, 4).mean(1)
    win = 48
    e = np.sqrt(np.convolve(h ** 2, np.ones(win) / win, 'same'))
    seam_e = e[NS - win:NS + win].max()
    ref = e[SR // 2:NS + NS // 2]
    hc = hpf(full[I2 - SR:I2 + SR], 12000, 4).mean(1)
    ec = np.sqrt(np.convolve(hc ** 2, np.ones(win) / win, 'same'))[SR - win:SR + win].max()
    L.append(f'  click test (>12 kHz, 1 ms RMS): at the seam {db(seam_e):.1f} dBFS, continuous render there '
             f'{db(ec):.1f} dBFS; file median {db(np.median(ref)):.1f}, 99th pct {db(np.percentile(ref, 99)):.1f} dBFS')
    # 5. spectral continuity: log-spectral distance between successive 2048-sample frames (5 ms hop)
    nfft, hop = 2048, 240

    def frames(sig, i0, i1):
        out, pos = [], []
        win_ = np.hanning(nfft)
        for s in range(i0, i1 - nfft, hop):
            X = np.abs(np.fft.rfft(sig[s:s + nfft].mean(1) * win_))
            out.append(20 * np.log10(X[9:690] + 1e-9))            # ~210 Hz .. 16 kHz
            pos.append(s + nfft // 2)
        return np.array(out), np.array(pos)

    F, pos = frames(w, 0, 2 * NS)
    dist = np.array([lsd(F[i], F[i + 1]) for i in range(len(F) - 1)])

    def step_at(i_c):
        return dist[[i for i in range(len(F) - 1) if abs(pos[i] - i_c) < nfft // 2 + hop]].max()

    seam_d = step_at(NS)
    pct = 100.0 * np.mean(dist < seam_d)
    others = [(t, step_at(int(round(t * SR)) + NS)) for t, _, _ in CUES[1:]]
    Fc, posc = frames(full, I2 - SR, I2 + SR)
    Fw, posw = frames(w, NS - SR, NS + SR)
    spec_diff = np.abs(Fc - Fw).max()
    L.append(f'  spectral continuity (2048-pt frames, 5 ms hop, 210 Hz-16 kHz): the largest frame-to-frame log-spectral '
             f'distance across the seam is {seam_d:.2f} dB ({pct:.0f}th percentile of the whole loop; median '
             f'{np.median(dist):.2f}, 99th pct {np.percentile(dist, 99):.2f} dB)')
    L.append('  for comparison, the same measure at the other cues: ' +
             ', '.join(f'{t:.2f} s {d:.2f}' for t, d in others) + ' dB')
    L.append(f'  the frames around the seam vs the same frames of the continuous render: max difference '
             f'{spec_diff:.4f} dB')
    a, b = w[NS - SR // 4:NS], w[NS:NS + SR // 4]
    L.append(f'  level either side of the seam (K-weighted, 250 ms): before {short_term(a, 0, 0.25):.1f} LUFS, '
             f'after {short_term(b, 0, 0.25):.1f} LUFS (the seam is the D chord arriving from the Gm6)')
    return L, (d_loop, seam_d, pct, max(d for _, d in others))


def tail_report(send_bus, ir, gain):
    """how much of the start of score.wav is the hall tail of the cycle before it"""
    m = np.zeros((NR, 1))
    m[:I1] = 1.0
    wet_prev = reverb(send_bus * m, ir)[I1:I1 + 3 * SR] * gain
    out = []
    for a, b in [(0.0, 0.25), (0.25, 0.5), (0.5, 1.0), (1.0, 2.0), (2.0, 3.0)]:
        seg = wet_prev[int(a * SR):int(b * SR)]
        out.append(f'{a:.2f}-{b:.2f} s {20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-12):6.1f} dBFS')
    return ['Hall tail of the previous cycle under the start of the loop (RMS, at master gain):', '  ' + ' | '.join(out)]


def cue_marks():
    """what the score does at each cue, read from the notes as written"""
    lines = ['Music at each cue (from the notes as written): sounding chord after the cue, and the entries on it']
    names = {c: NAMES[c] for c in range(16)}
    for t, lab, _ in CUES:
        def sounding(tq):
            return sorted({n[1] % 12 for n in NOTES if n[0] not in (DR, GLOCK, PIZZ) and n[2] <= tq < n[2] + n[3]})
        after = sounding(t + 0.05)
        ent = sorted({names[n[0]] for n in NOTES if abs(n[2] - t) < 0.012})
        lines.append(f'  {t:6.2f}  {lab:36s} pcs {"-".join(NAMES12[p] for p in after):24s} entries: {", ".join(ent)}')
    first = {}
    for n in sorted(NOTES, key=lambda n: n[2]):
        first.setdefault(n[0], n[2])
    lines.append('  first note in the cycle: ' + ', '.join(f'{NAMES[c]} {first[c]:.2f}' for c in
                                                             (VLN, CB, OOH, AAH, HORN, TREM) if c in first))
    return lines


def tempo_lines():
    out = ['Tempo map (3/4; bar lines on the cues; periodic spline):']
    row = []
    for b in range(1, 10):
        m = bar(b)
        bpm = 60.0 / (T(m + 0.5) - T(m - 0.5))
        row.append(f'bar {b} {T(m):6.3f} s {bpm:5.1f} bpm')
    out += ['  ' + ' | '.join(row[:5]), '  ' + ' | '.join(row[5:])]
    return out


def verify(y, full, send_bus, ir, gain, stems_kept, report_path, dry_id=()):
    lines = ['CARRY - score verification (all values measured on the rendered score.wav)', '']
    Lm = lufs(y)
    tp = 20 * np.log10(true_peak_env(y).max())
    yy = np.concatenate([y, y, y])
    tp_loop = 20 * np.log10(true_peak_env(yy).max())
    info = sf.info(os.path.join(HERE, 'score.wav'))
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', os.path.join(HERE, 'score.wav'),
                        '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    summ = r[r.rfind('Summary:'):]
    keep = [l.strip() for l in summ.splitlines() if any(k in l for k in ('I:', 'LRA:', 'Peak:'))]
    seam_lines, (d_loop, seam_d, pct, bar_max) = seam_report(full, y)
    # cue onsets on the looped signal (2 s of the end before, 2 s of the start after)
    pad = 2 * SR
    z = np.concatenate([y[-pad:], y, y[:pad]])
    ons = {b: [(t - 2.0, r_) for t, r_ in onset_detect(z, b)] for b in BANDS}
    cue_lines = ['Cue alignment (onset detection on the looped signal; tolerance +-33.3 ms = 1 frame at 30 fps)',
                 '  bands: low < 150 Hz (each arrival has a harp + pizzicato root, timpani from 8.08), '
                 'high 3-10 kHz (the chime)']
    worst, nbad = 0.0, 0
    for t, lab, band in CUES:
        cands = [o for o in ons[band] if abs(o[0] - t) < 0.12]
        if cands:
            o = max(cands, key=lambda o: o[1])
            d = (o[0] - t) * 1000
            worst = max(worst, abs(d))
            ok = abs(d) <= 33.3
            nbad += not ok
            rest = [c for c in cands if c is not o]
            r2 = max(rest, key=lambda c: c[1]) if rest else None
            cue_lines.append(f'  {"OK " if ok else "OFF"} cue {t:6.2f}  {lab:36s} {band:4s} measured {o[0]:6.3f}  '
                             f'delta {d:+6.1f} ms  rise {o[1]:5.1f} dB' +
                             (f'   (next within 120 ms: {r2[0]:.3f}, {r2[1]:.1f} dB)' if r2 else ''))
        else:
            worst, nbad = 999.0, nbad + 1
            cue_lines.append(f'  MISS cue {t:6.2f} {lab:36s} {band:4s} no onset within 120 ms')
    cue_lines.append(f'  {len(CUES)} cues, {len(CUES) - nbad} within one frame; worst |delta| = {worst:.1f} ms')
    head = [('duration exactly 15.000 s (720000 frames)', info.frames == NS and info.samplerate == SR),
            ('48 kHz / stereo / 24-bit PCM', info.samplerate == 48000 and info.channels == 2 and info.subtype == 'PCM_24'),
            (f'integrated loudness about -16 LUFS ({Lm:.2f})', abs(Lm - LUFS_TARGET) <= 0.5),
            (f'true peak <= -1 dBTP ({tp:.2f}; looped x3: {tp_loop:.2f})', max(tp, tp_loop) <= -1.0),
            (f'seamless: loop == continuous render around the seam ({20 * np.log10(max(d_loop, 1e-12)):.1f} dBFS)',
             d_loop < 10 ** (-60 / 20)),
            (f'no click: spectral step at the seam {seam_d:.2f} dB, no larger than at the other cues (max '
             f'{bar_max:.2f} dB)', seam_d <= bar_max),
            (f'all {len(CUES)} cues marked within +-33 ms (worst {worst:.1f} ms)', nbad == 0)]
    lines += ['Summary'] + [f'  {"PASS" if ok else "FAIL"}  {lab}' for lab, ok in head] + ['']
    lines.append(f'Integrated loudness (internal BS.1770 meter): {Lm:.2f} LUFS, true peak {tp:.2f} dBTP (4x oversampled)')
    lines.append('ffmpeg ebur128: ' + ' | '.join(keep))
    lines.append(f'score.wav: {info.frames} frames = {info.frames / info.samplerate:.3f} s, {info.samplerate} Hz, '
                 f'{info.channels} ch, {info.subtype}')
    lines.append('Render: 1 s pre-roll + three cycles through fluidsynth (one instance per channel), hall, '
                 'compressor and limiter; score.wav = the middle cycle (render 16.000-31.000 s)')
    lines.append(f'Limiter (true-peak, ceiling {CEILING} dBTP): max gain reduction {max(0.0, MASTER_STATS["limit_max"]):.1f} dB, '
                 f'more than 1 dB for {MASTER_STATS["limit_ms"]:.0f} ms of the 15 s')
    lines.append('')
    lines += seam_lines
    lines.append('  dry stems, kept cycle vs the next (first 14 s), max |difference|: ' +
                 ', '.join(f'{n} {d:.0f}' for n, d in dry_id) + ' dBFS')
    lines += tail_report(send_bus, ir, gain)
    lines.append('')
    lines += cue_lines
    lines.append('')
    lines += cue_marks()
    lines.append('')
    lines += tempo_lines()
    lines.append('')
    lines.append('Momentary loudness (K-weighted, 400 ms from the cue; looped signal): ' +
                 ', '.join(f'{t:.2f} {short_term(z, t + 2.0, t + 2.4):.1f}' for t, _, _ in CUES) + ' LUFS')
    lines.append('')
    lines.append('Energy contour (K-weighted loudness of each section, LUFS)')
    for t0, t1, lab in SECTIONS:
        st = short_term(y, t0, t1)
        seg = y[int(t0 * SR):int(t1 * SR)]
        pk = 20 * np.log10(np.abs(seg).max() + 1e-12)
        lines.append(f'  {t0:6.2f}-{t1:6.2f}  {lab:28s} {st:7.1f} LUFS   peak {pk:7.1f} dBFS  ' +
                     '#' * max(0, int((st + 60) / 1.5)))
    lines.append('')
    lines.append('Stem balance (K-weighted loudness of each stem in the section, LUFS, approx. master gain)')
    lines.append('  section                     ' + ''.join(f'{n:>9s}' for n in stems_kept))
    for t0, t1, lab in SECTIONS:
        lines.append(f'  {lab:28s}' + ''.join(f'{short_term(stems_kept[n] * gain, t0, t1):9.1f}' for n in stems_kept))
    txt = '\n'.join(lines)
    with open(report_path, 'w') as f:
        f.write(txt + '\n')
    print(txt)


# --------------------------------------------------------------------------- main
def main():
    compose()
    write_score_midi(os.path.join(HERE, 'score.mid'))
    print(f'{len(NOTES)} notes per cycle, {len(FX)} fx events -> score.mid')
    os.makedirs(SCRATCH, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix='carry_', dir=SCRATCH)
    try:
        write_render_midi(os.path.join(SCRATCH, 'render_3cycles.mid'), list(range(16)))
        crash_sample(tmp)

        # Each MIDI channel gets its own fluidsynth instance. Alone, every channel renders bit-identically in each
        # cycle; sharing one synth, fluidsynth's voice-slot reuse carries a little state from one note to the
        # next (measured: -60 dBFS cycle-to-cycle differences), which would leave a tiny step at the seam.
        def run(c):
            mid, wav = os.path.join(tmp, f'ch{c}.mid'), os.path.join(tmp, f'ch{c}.wav')
            write_render_midi(mid, [c])
            return c, render_midi(mid, wav, NR)

        used = sorted({n[0] for n in NOTES})
        dry = {name: np.zeros((NR, 2)) for name in STEMS}
        ch_id = []
        with ThreadPoolExecutor(max_workers=4) as ex:
            for c, x in ex.map(run, used):
                dry[next(n for n, chs in STEMS.items() if c in chs)] += x
                ch_id.append((c, np.abs(x[I1:I1 + 14 * SR] - x[I2:I2 + 14 * SR]).max()))
                del x
        worst = max(ch_id, key=lambda e: e[1])
        print(f'rendered {len(used)} channels; worst cycle difference {NAMES[worst[0]]} {worst[1]:.2e}')
        lo_, air_ = render_fx(tmp)
        dry['fxlow'], dry['fxair'] = lay_cycles(lo_), lay_cycles(air_)
        dry_id = [(n, 20 * np.log10(max(1e-15, np.abs(x[I1:I1 + 14 * SR] - x[I2:I2 + 14 * SR]).max())))
                  for n, x in dry.items()]
        stems, send_bus, ir = mix(dry)
        bus = sum(stems.values())
        full = master(bus)
        y = full[I1:I2]
        sf.write(os.path.join(HERE, 'score.wav'), y, SR, subtype='PCM_24')
        gain = np.sqrt(np.mean(full[I1:I2] ** 2)) / max(1e-12, np.sqrt(np.mean(bus[I1:I2] ** 2)))
        verify(y, full, send_bus, ir, gain, {n: s[I1:I2] for n, s in stems.items()},
               os.path.join(HERE, 'verification.txt'), dry_id)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
