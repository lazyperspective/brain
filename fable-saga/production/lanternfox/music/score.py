#!/usr/bin/env python3
"""THE LANTERN FOX - a Fable Saga Christmas short - the score: 36.000 s, one pass, a natural ending.

Built on the Snow Globe / Carry score machinery (fluidsynth + FluidR3_GM, one synth per MIDI channel, attack-
compensated note-ons, a synthesized fx layer, a hall, mastering to about -16 LUFS / -1.5 dBTP), but not looped: a
1 s pre-roll, the 36 s cue, and its hall tail faded out inside the 36 s.

Tempo: 120 bpm in 4/4, felt in two (a half-note pulse); bar b starts at 2(b - 1) s, so every scene change of the film
lands on a beat, and the beam blazes out on the downbeat of bar 17 (32.000 s). D major, a lullaby.

    t      picture                                   music
    0.0    the kit sniffs at the glow in the snow    solo celesta: the fox theme; harp, soft strings (D)
    1.8    it paws the snow away                     three soft crunches of snow
    3.0    the light blooms on its face              glockenspiel and a harp glissando, the strings open (Gmaj9)
    5.0    through the woods                         the flute takes the theme; pizzicato walks; harp arpeggios
    6.6    owls (and again at 9.0)                   two soft hoots each
   11.0    the frozen waterfall                      B minor: high tremolo strings, celesta glints, harp in fourths
   13.2    it slips on the ice                       a little pizzicato tumble
   17.0    the aurora meadow                         G major: choir oohs, horn takes the theme, an aurora shimmer
   21.4    it sees the dark lighthouse               the chord darkens (Em7 - Bm/F# - C)
   23.0    the storm on the cliff                    D minor: low brass ostinato, timpani, low tremolo, wind and sea
   25.5    the climb                                 the violins climb in eighths, a crescendo
   28.2    the lamp room: the keeper                 sudden quiet: a lone cello, celesta (B minor)
   29.0    he looks up                               a celesta note; hope (G - D/F#)
   30.0    he takes the lantern                      the strings gather; harp; a timpani roll
   32.0    THE BEAM                                  full orchestra: the theme in horns and violins, choir, timpani
   34.0    the kit curls up                          the lullaby: celesta and soft strings, the last phrase
   35.0    hold                                      the final D chord, the hall left to fade

    python score.py          (needs fluidsynth, ffmpeg, numpy, scipy, soundfile)
Writes score.mid, score.wav (48 kHz / 24-bit / stereo, exactly 36.000 s) and verification.txt.
"""
import os, struct, subprocess, tempfile, shutil
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import soundfile as sf
from scipy import signal
from scipy.ndimage import minimum_filter1d

HERE = os.path.dirname(os.path.abspath(__file__))
SF2 = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
SCRATCH = '/tmp/claude-0/-home-user-brain/f1f7475c-3827-5141-bc67-2671553b043a/scratchpad/fox/music'
SR = 48000
DUR = 36.0
NS = int(round(SR * DUR))
T0 = 1.0                                   # pre-roll
TAIL = 1.0
NR = int(round(SR * (T0 + DUR + TAIL)))
I1, I2 = int(round(SR * T0)), int(round(SR * T0)) + NS
LUFS_TARGET = -16.0
CEILING = -1.5
FADE0, FADE1 = 35.05, 36.0                 # the hall tail is faded out inside the 36 s
RNG = np.random.default_rng(2412)

# --------------------------------------------------------------------------- pitches and time
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


BEAT = 0.5                                 # 120 bpm


def T(m):
    """seconds of beat position m (beat 0 = 0.0 s)"""
    return m * BEAT


# --------------------------------------------------------------------------- channels
VLN, LOW, CB, PIZZ, HARP, CEL, MBOX, GLOCK, HORN, DR, OOH, AAH, TIMP, FLUTE, TREM, TBN = range(16)
NAMES = ['violins', 'violas+celli', 'contrabass', 'pizzicato', 'harp', 'celesta', 'music box', 'glockenspiel',
         'french horns', 'percussion', 'choir oohs', 'choir aahs', 'timpani', 'flute', 'tremolo strings',
         'low brass']
INIT_PROG = {VLN: 48, LOW: 42, CB: 43, PIZZ: 45, HARP: 46, CEL: 8, MBOX: 10, GLOCK: 9, HORN: 60, OOH: 53,
             AAH: 52, TIMP: 47, FLUTE: 73, TREM: 44, TBN: 57}
VOL = {VLN: 98, LOW: 100, CB: 100, PIZZ: 96, HARP: 106, CEL: 104, MBOX: 110, GLOCK: 86, HORN: 94, DR: 90,
       OOH: 100, AAH: 100, TIMP: 104, FLUTE: 100, TREM: 88, TBN: 92}
PAN = {VLN: 42, LOW: 82, CB: 90, PIZZ: 74, HARP: 36, CEL: 80, MBOX: 58, GLOCK: 72, HORN: 50, DR: 64, OOH: 54,
       AAH: 74, TIMP: 60, FLUTE: 52, TREM: 46, TBN: 84}
STEMS = {'strings': [VLN, LOW, CB, PIZZ, TREM], 'keys': [HARP, CEL, MBOX, GLOCK], 'winds': [FLUTE],
         'choir': [OOH, AAH], 'brass': [HORN, TBN], 'perc': [DR, TIMP]}
# attack compensation: note-ons are sent this much early (time-to-half-amplitude * ~0.7 per FluidR3 patch)
LAT = {48: .055, 42: .07, 44: .06, 45: .035, 43: .05, 60: .038, 52: .10, 53: .045, 46: 0., 8: 0., 9: .004,
       10: .01, 73: .04, 47: .006, 57: .04}

# expression (CC11) curves: (seconds, value)
ENV = {
    VLN: [(0, 0), (2.8, 0), (3.0, 60), (4.6, 52), (5.0, 40), (10.6, 46), (11.0, 0), (16.8, 0), (17.0, 70), (20.8, 78),
          (22.6, 54), (23.0, 0), (25.4, 0), (25.5, 46), (28.05, 112), (28.2, 0), (29.5, 0), (29.7, 40), (31.0, 70),
          (31.8, 100), (31.95, 100), (32.0, 118), (33.8, 112), (34.0, 60), (35.2, 50), (36, 40)],
    LOW: [(0, 64), (5.0, 70), (11.0, 62), (17.0, 82), (23.0, 92), (28.0, 112), (28.2, 74), (30.0, 80), (31.9, 104),
          (32.0, 118), (34.0, 72), (36, 60)],
    CB: [(0, 80), (28.1, 104), (28.2, 60), (31.9, 100), (32.0, 120), (34.0, 80), (36, 70)],
    TREM: [(0, 0), (10.8, 0), (11.0, 62), (16.6, 70), (17.0, 0), (22.9, 0), (23.0, 66), (28.0, 104), (28.2, 0),
           (36, 0)],
    OOH: [(0, 0), (16.8, 0), (17.0, 56), (19.0, 84), (22.4, 66), (23.0, 0), (31.0, 0), (32.0, 92), (34.0, 52),
          (36, 30)],
    AAH: [(0, 0), (18.8, 0), (19.0, 54), (22.4, 60), (23.0, 0), (31.9, 0), (32.0, 96), (33.9, 100), (34.2, 40),
          (36, 30)],
    HORN: [(0, 0), (16.8, 0), (17.0, 74), (22.6, 60), (23.0, 0), (31.8, 0), (32.0, 112), (34.0, 70), (36, 50)],
    TBN: [(0, 0), (22.8, 0), (23.0, 88), (28.0, 118), (28.2, 0), (31.8, 0), (32.0, 100), (34.0, 0), (36, 0)],
    FLUTE: [(0, 0), (4.8, 0), (5.0, 80), (10.6, 72), (11.0, 0), (36, 0)],
}
for _c in (PIZZ, HARP, CEL, MBOX, GLOCK, DR, TIMP):
    ENV[_c] = [(0, 112), (36, 112)]

NOTES, FX = [], []


def env_val(ch, t):
    ks = ENV[ch]
    return float(np.interp(t, [k[0] for k in ks], [k[1] for k in ks]))


def note(ch, p, t, d, v):
    NOTES.append((ch, P(p), float(t), float(d), int(np.clip(round(v), 1, 127))))


def nb(ch, p, m, d, v, jit=0.0, vj=0):
    """a note at beat m lasting d beats"""
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


# =========================================================================== THE SCORE
# the fox theme (beats, length, pitch), from its start
THEME_A = [(0, 1, 'A4'), (1, 1, 'D5'), (2, 1.5, 'F#5'), (3.5, 0.5, 'E5'), (4, 1, 'D5'), (5, 1, 'B4'), (6, 2, 'A4')]
THEME_B = [(0, 1, 'G4'), (1, 1, 'B4'), (2, 1.5, 'D5'), (3.5, 0.5, 'C#5'), (4, 1, 'B4'), (5, 1, 'C#5'), (6, 2, 'A4')]


def phrase(ch, ph, m0, v, oct_=0, dmin=0.0, scale=1.0):
    for o, d, p in ph:
        nb(ch, P(p) + 12 * oct_, m0 + o * scale, max(d * scale, dmin), v - (0 if o == 0 else 8) + RNG.integers(-3, 4))


def arp(ch, ps, m0, beats, v, step=0.5, up=True):
    """harp/celesta arpeggio across the chord in eighths"""
    seq = ps if up else ps[::-1]
    k = 0
    m = m0
    while m < m0 + beats - 1e-6:
        nb(ch, seq[k % len(seq)], m, step * 2.2, v - (k % 4 == 0 and -6 or 0), jit=0.004)
        k += 1
        m += step


def pad(chs, ps, m0, d, v):
    for ch in chs:
        cb(ch, ps, m0, d, v)


def compose():
    find()
    woods()
    ice()
    aurora()
    storm()
    lamproom()
    light()
    lullaby()


def find():
    """0-5: the kit and the glow. Celesta alone with the theme, harp under it, strings barely there"""
    phrase(CEL, THEME_A, 0, 88)                                  # 0.0 - 4.0
    nb(CEL, 'G4', 8, 1, 74)
    nb(CEL, 'A4', 9, 1, 78)                                      # 4.0, 4.5: leading into the flute at 5.0
    arp(HARP, ['D3', 'A3', 'D4', 'F#4'], 0, 4, 52)              # D
    arp(HARP, ['B2', 'F#3', 'B3', 'D4'], 4, 2, 50)              # Bm7 2.0
    arp(HARP, ['G2', 'D3', 'A3', 'B3', 'F#4'], 6, 2, 56)        # Gmaj9 3.0 (the light blooms)
    arp(HARP, ['A2', 'E3', 'G3', 'D4'], 8, 2, 52)               # A7sus4 4.0
    cb(LOW, ['D3', 'A3'], 0, 4, 52)
    cb(LOW, ['B2', 'F#3'], 4, 2, 50)
    cb(LOW, ['G2', 'D3'], 6, 2, 58)
    cb(LOW, ['A2', 'E3'], 8, 2, 56)
    nb(CB, 'D2', 0, 4, 60)
    nb(CB, 'G1', 6, 2, 66)
    nb(CB, 'A1', 8, 2, 66)
    cb(VLN, ['F#4', 'B4', 'D5'], 6, 2, 64)                       # the strings open as the light blooms
    cb(VLN, ['E4', 'G4', 'C#5'], 8, 2, 60)
    # the bloom at 3.0: a harp glissando up into it, the glockenspiel, a soft star
    for i, p in enumerate(['D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'F#6']):
        note(HARP, p, 2.72 + i * 0.04, 0.9, 34 + 5 * i)
    note(GLOCK, 'F#6', 3.0, 1.4, 72)
    note(GLOCK, 'A6', 3.004, 1.2, 60)
    fx('bloom', 3.0, 1.8, 0.9)
    for t in (1.92, 2.24, 2.56):                                  # the three scrapes in the snow
        fx('crunch', t, 0.7)
    fx('crunch', 4.62, 0.35)                                     # the bail taken
    note(MBOX, 'D6', 3.7, 0.5, 46)                               # the hop
    note(MBOX, 'A6', 3.9, 0.5, 42)


def woods():
    """5-11: through the woods. The flute has the theme, pizzicato walks, harp arpeggios, owls"""
    phrase(FLUTE, THEME_A, 10, 92)                               # 5.0 - 9.0
    phrase(FLUTE, [(0, 1, 'G5'), (1, 1, 'F#5'), (2, 1, 'E5'), (3, 1, 'C#5')], 18, 84)   # 9.0 - 11.0
    walk = ['D2', 'F#2', 'A2', 'F#2', 'D2', 'A1', 'B1', 'D2', 'G1', 'B1', 'D2', 'B1', 'E2', 'G2', 'A1', 'C#2']
    for k, p in enumerate(walk[:12]):
        nb(PIZZ, P(p) + 12, 10 + k, 0.5, (52 if k == 0 else 70) if k % 2 == 0 else 58)
    for k, p in enumerate(walk[12:]):
        nb(PIZZ, P(p) + 12, 18 + k, 0.5, 66)
    arp(HARP, ['D3', 'F#3', 'A3', 'D4', 'F#4', 'A4'], 10, 4, 50)        # D   5-7
    arp(HARP, ['B2', 'D3', 'F#3', 'B3', 'D4', 'F#4'], 14, 2, 48)        # Bm  7-8
    arp(HARP, ['G2', 'B2', 'D3', 'G3', 'B3', 'D4'], 16, 2, 50)          # G   8-9
    arp(HARP, ['E3', 'G3', 'B3', 'D4', 'E4', 'G4'], 18, 2, 48)          # Em7 9-10
    arp(HARP, ['A2', 'C#3', 'E3', 'G3', 'A3', 'C#4'], 20, 2, 50)        # A7  10-11
    for m, ps in [(10, ['D3', 'A3']), (14, ['B2', 'F#3']), (16, ['G2', 'D3']), (18, ['E3', 'B3']), (20, ['A2', 'E3'])]:
        cb(LOW, ps, m, 2 if m != 10 else 4, 56)
    cb(VLN, ['F#4', 'A4'], 10, 4, 48)
    cb(VLN, ['D4', 'F#4'], 14, 2, 46)
    cb(VLN, ['D4', 'G4'], 16, 2, 46)
    cb(VLN, ['E4', 'G4'], 18, 2, 46)
    cb(VLN, ['E4', 'G4', 'C#5'], 20, 2, 48)
    # celesta answers the flute at the phrase ends
    for m, p in [(13.5, 'F#6'), (17.5, 'D6'), (21.5, 'E6')]:
        nb(CEL, p, m, 1, 54)
    fx('owl', 6.6, 0.8, 0.3)
    fx('owl', 9.05, 0.7, 0.72)
    nb(TIMP, 'D2', 10, 1, 62)                                    # (the woods arrive on the beat)
    nb(HARP, 'D2', 10, 1.5, 112)
    nb(HARP, 'A2', 10, 1.5, 76)
    nb(CB, 'D2', 10, 1, 70)


def ice():
    """11-17: the frozen waterfall. Cold and glittering: B minor, high tremolo, celesta glints, harp fourths"""
    cb(TREM, ['B4', 'C#5', 'F#5'], 22, 4, 60)                    # Bm(add9) 11-13
    cb(TREM, ['B4', 'D5', 'G5'], 26, 4, 60)                      # G/B      13-15
    cb(TREM, ['B4', 'E5', 'F#5'], 30, 2, 62)                     # Em9      15-16
    cb(TREM, ['A#4', 'C#5', 'F#5'], 32, 2, 64)                   # F#7      16-17
    nb(CB, 'B1', 22, 8, 56)
    nb(CB, 'E2', 30, 2, 58)
    nb(CB, 'F#1', 32, 2, 62)
    cb(LOW, ['B2', 'F#3'], 22, 8, 50)
    cb(LOW, ['E3', 'B3'], 30, 2, 52)
    cb(LOW, ['F#2', 'C#3'], 32, 2, 54)
    for m, ps in [(22, ['B3', 'E4', 'A4']), (24, ['C#4', 'F#4', 'B4']), (26, ['D4', 'G4', 'C5']), (28, ['B3', 'E4', 'A4']),
                  (30, ['E4', 'A4', 'D5']), (32, ['C#4', 'F#4', 'B4'])]:
        for i, p in enumerate(ps):
            nb(HARP, p, m + i * 0.5, 1.2, 46 + 4 * i)
            nb(HARP, P(p) + 12, m + 1.5 + i * 0.16, 0.8, 36)
    # glints: high celesta and glockenspiel, B minor pentatonic, scattered, brightest where the light runs up the ice
    t = 11.15
    while t < 16.8:
        p = RNG.choice(['B6', 'D7', 'E7', 'F#7', 'A7', 'B7', 'F#6'])
        note(CEL if RNG.random() < 0.6 else GLOCK, p, t, 0.5, int(32 + 16 * np.sin((t - 11) / 6 * np.pi) + RNG.integers(0, 8)))
        t += RNG.uniform(0.16, 0.42)
    note(CEL, 'F#6', 11.0, 1.2, 66)                              # the arrival
    note(GLOCK, 'B6', 11.004, 1.0, 58)
    # the slip: a little pizzicato tumble down, and a catch
    for i, p in enumerate(['F#4', 'D4', 'B3', 'F#3']):
        note(PIZZ, p, 13.15 + i * 0.07, 0.2, 70 - i * 6)
    note(PIZZ, 'B3', 13.62, 0.25, 60)
    fx('crack', 13.2, 0.5)
    fx('shimmer', 11.0, 17.0, ['B5', 'F#6', 'C#7'], 0.6)


def aurora():
    """17-23: the meadow under the aurora. G major opens; choir, the horn has the theme, a shimmer; then it darkens"""
    chords = [(34, 4, 'G', ['G2'], ['G3', 'D4'], ['B3', 'D4', 'G4'], ['D4', 'G4', 'B4', 'F#5']),
              (38, 4, 'D/F#', ['F#2'], ['A3', 'D4'], ['A3', 'D4', 'F#4'], ['D4', 'F#4', 'A4', 'E5']),
              (42, 2, 'Em7', ['E2'], ['G3', 'D4'], ['G3', 'B3', 'E4'], ['E4', 'G4', 'B4', 'D5']),
              (44, 1, 'Bm/F#', ['F#2'], ['F#3', 'D4'], ['F#3', 'B3', 'D4'], ['B3', 'D4', 'F#4']),
              (45, 1, 'C', ['C2'], ['G3', 'E4'], ['G3', 'C4', 'E4'], ['C4', 'E4', 'G4'])]
    for m, d, _, root, low, ooh, harp in chords:
        nb(CB, root[0], m, d, 72)
        cb(LOW, low, m, d, 66)
        cb(OOH, ooh, m, d, 70)
        if m >= 38:
            cb(AAH, [P(p) + 12 for p in ooh[1:]], m, d, 56)
        arp(HARP, harp, m, d, 44)
    cb(VLN, ['B4', 'D5', 'G5'], 34, 4, 56)
    cb(VLN, ['A4', 'D5', 'F#5'], 38, 4, 56)
    cb(VLN, ['G4', 'B4', 'E5'], 42, 2, 52)
    cb(VLN, ['F#4', 'B4', 'D5'], 44, 1, 48)
    cb(VLN, ['E4', 'G4', 'C5'], 45, 1, 46)
    phrase(HORN, [(0, 1, 'D4'), (1, 1, 'G4'), (2, 1.5, 'B4'), (3.5, 0.5, 'A4'), (4, 1, 'G4'), (5, 1, 'E4'), (6, 2, 'D4')], 34, 84)
    phrase(HORN, [(0, 1, 'C4'), (1, 1, 'E4'), (2, 2, 'G4')], 42, 74)
    nb(TIMP, 'G2', 34, 1, 70)
    nb(HARP, 'G1', 34, 2, 100)
    nb(PIZZ, 'G2', 34, 0.5, 80)
    note(GLOCK, 'D7', 17.0, 1.2, 56)
    note(CEL, 'B6', 17.002, 1.2, 60)
    for i, p in enumerate(['G4', 'A4', 'B4', 'D5', 'E5', 'G5', 'B5']):
        note(HARP, p, 16.72 + i * 0.04, 0.9, 32 + 4 * i)
    fx('aurora', 17.0, 22.6, ['G5', 'D6', 'B6', 'D7'], 1.0)
    fx('swell', 17.0, 1.2, 0.35)


def storm():
    """23-28.2: the storm and the climb. D minor; low brass ostinato, timpani, low tremolo; the climb in eighths"""
    prog = [(46, 'D'), (48, 'D'), (50, 'Bb'), (52, 'G'), (54, 'A'), (56, 'A')]
    triad = {'D': ['D3', 'F3', 'A3'], 'Bb': ['D3', 'F3', 'Bb3'], 'G': ['D3', 'G3', 'Bb3'], 'A': ['C#3', 'E3', 'A3']}
    roots = {'D': 'D2', 'Bb': 'Bb1', 'G': 'G1', 'A': 'A1'}
    for m, c in prog:
        cb(TREM, triad[c], m, 2, 64)
        nb(CB, roots[c], m, 2, 86)
        cb(LOW, [triad[c][0], triad[c][2]], m, 2, 70)
        # the brass ostinato: root, root, fifth, sixth / flat-sixth
        r = P(roots[c]) + 12
        for k, iv in enumerate([0, 0, 7, 8 if c in ('D', 'G') else 7]):
            nb(TBN, r + iv, m + k * 0.5, 0.45, 76 + (8 if k == 0 else 0) + (m - 46) * 2)
        nb(TIMP, P(roots[c]) + 12 if c != 'Bb' else 'Bb1', m, 0.5, 76 + (m - 46) * 3)
    # timpani rolls into the storm and under the climb
    for k in range(8):
        nb(TIMP, 'D2', 45 + k * 0.1, 0.12, 40 + k * 3)              # (a roll that stops short of the downbeat)
    nb(HARP, 'D2', 46, 1, 100)
    nb(PIZZ, 'D2', 46, 0.5, 90)
    for k in range(16):
        nb(TIMP, 'A1', 55 + k * 0.0625, 0.08, 52 + k * 3)
    # the climb: the violins in eighths, up and up (25.5 - 28.2)
    climb = ['D4', 'E4', 'F4', 'G4', 'A4', 'Bb4', 'C#5', 'D5', 'E5', 'F5', 'G5', 'A5', 'Bb5', 'C#6', 'D6', 'E6', 'F6', 'G6', 'A6', 'A6']
    for k, p in enumerate(climb):
        nb(VLN, p, 51 + k * 0.25, 0.3, 64 + k * 2)
    note(GLOCK, 'D6', 23.0, 0.8, 40)
    fx('wind', 22.8, 28.25, 1.0)
    for t in (23.6, 24.9, 26.1, 27.4):
        fx('wave', t, 0.9)
    fx('door', 25.15, 0.6)


def lamproom():
    """28.2-30: the lamp room. Everything falls away to a lone cello and the celesta; he looks up; hope"""
    note(LOW, 'F#3', 28.25, 0.75, 70)
    note(LOW, 'E3', 29.0, 0.5, 64)
    note(LOW, 'D3', 29.5, 0.5, 66)
    nb(CB, 'B1', 56.5, 2.5, 50)
    note(CEL, 'B5', 28.25, 0.9, 52)
    note(CEL, 'D6', 29.0, 1.0, 60)                               # he looks up
    note(CEL, 'F#6', 29.5, 1.0, 62)                              # hope
    cb(HARP, ['G3', 'B3', 'D4'], 59, 1, 46)                      # G at 29.5
    cb(VLN, ['B3', 'D4', 'G4'], 59, 1, 40)
    cb(LOW, ['G2', 'D3'], 59, 1, 48)


def light():
    """30-32: he sets the lantern in the lens; the strings gather; a swell into the downbeat. 32-34: the beam"""
    for m, ps, low, root in [(60, ['B3', 'D4', 'G4'], ['G2', 'D3'], 'G1'), (61, ['C#4', 'E4', 'A4'], ['A2', 'E3'], 'A1'),
                             (62, ['D4', 'F#4', 'B4'], ['B2', 'F#3'], 'B1'), (63, ['D4', 'E4', 'A4'], ['A2', 'E3'], 'A1')]:
        d = 1 if m < 63 else 0.7                                 # (the last half-bar breaks off: a breath before the beam)
        cb(VLN, ps, m, d, 62 + (m - 60) * 8)
        cb(LOW, low, m, d, 62 + (m - 60) * 6)
        nb(CB, root, m, d, 70 + (m - 60) * 6)
        arp(HARP, ps + [P(ps[0]) + 12], m, d, 50 + (m - 60) * 4, step=0.25)
    note(CEL, 'A5', 30.0, 0.9, 64)
    note(CEL, 'D6', 30.5, 0.9, 62)
    for k in range(12):
        nb(TIMP, 'A1', 62.4 + k * 0.088, 0.1, 44 + k * 5)            # (stopping short of 32.0)
    for i, p in enumerate(['A4', 'B4', 'D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'E6', 'F#6', 'A6']):
        note(HARP, p, 31.42 + i * 0.035, 0.45, 40 + 5 * i)
    fx('swell', 31.86, 1.5, 1.0)
    # 32.0: THE BEAM - the theme, full: horns and violins in unison, choir, timpani, cymbal, the bass on D
    phrase(HORN, THEME_A[:4], 64, 108)
    phrase(VLN, THEME_A[:4], 64, 112)
    phrase(VLN, THEME_A[:4], 64, 96, oct_=1)
    nb(VLN, 'D5', 68, 1, 100)                                    # (into the lullaby: the theme's last notes)
    nb(VLN, 'B4', 69, 1, 92)
    for m, ps, root in [(64, ['D3', 'A3', 'F#4'], 'D1'), (66, ['G2', 'D3', 'B3'], 'G1')]:
        cb(LOW, ps, m, 2, 108)
        nb(CB, root, m, 2, 112)
        nb(CB, P(root) + 12, m, 2, 100)
        cb(TBN, [ps[0], ps[1]], m, 2, 96)
    cb(OOH, ['D4', 'F#4', 'A4'], 64, 2, 96)
    cb(AAH, ['A4', 'D5', 'F#5'], 64, 2, 100)
    cb(OOH, ['D4', 'G4', 'B4'], 66, 2, 92)
    cb(AAH, ['B4', 'D5', 'G5'], 66, 2, 96)
    arp(HARP, ['D3', 'F#3', 'A3', 'D4', 'F#4', 'A4', 'D5'], 64, 2, 72, step=0.25)
    arp(HARP, ['G3', 'B3', 'D4', 'G4', 'B4', 'D5'], 66, 2, 66, step=0.25)
    nb(TIMP, 'D2', 64, 1, 124)
    nb(HARP, 'D1', 64, 2, 110)
    nb(PIZZ, 'D2', 64, 0.5, 110)
    nb(TIMP, 'A1', 65, 0.5, 90)
    nb(TIMP, 'D2', 66, 1, 100)
    note(DR, 49, 32.0, 2.5, 110)                                 # crash cymbal
    note(DR, 57, 32.002, 2.0, 80)
    note(GLOCK, 'A6', 32.0, 1.4, 90)
    note(GLOCK, 'D7', 32.003, 1.2, 80)
    note(CEL, 'F#6', 32.0, 1.2, 80)
    fx('beam', 32.0, 2.0, 1.0)
    t = 32.1
    while t < 33.55:                                              # the snow in the beam: glints
        note(GLOCK if RNG.random() < 0.5 else CEL, RNG.choice(['A6', 'D7', 'F#7', 'A7', 'E7']), t, 0.4, int(40 + RNG.integers(0, 14)))
        t += RNG.uniform(0.12, 0.3)


def lullaby():
    """34-36: the kit curls up against his boots. The lullaby: celesta, soft strings, the last phrase, home"""
    nb(CEL, 'D5', 68, 1, 86)                                     # 34.0
    note(GLOCK, 'D6', 34.0, 1.0, 70)
    nb(CEL, 'B4', 69, 1, 70)                                     # 34.5
    nb(CEL, 'A4', 70, 2.2, 74)                                   # 35.0, held
    nb(MBOX, 'A5', 70, 2, 44)
    for m, ps, root in [(68, ['G3', 'B3', 'D4'], 'G2'), (69, ['A3', 'C#4', 'E4', 'G4'], 'A2'), (70, ['F#3', 'A3', 'D4'], 'D2')]:
        cb(LOW, ps[:2], m, 1 if m < 70 else 2.2, 62 if m < 70 else 58)
        cb(VLN, ps[1:], m, 1 if m < 70 else 2.2, 56 if m < 70 else 50)
        nb(CB, root, m, 1 if m < 70 else 2.2, 62)
    arp(HARP, ['D3', 'A3', 'D4', 'F#4', 'A4', 'D5'], 70, 1.6, 44, step=0.25)
    cb(OOH, ['D4', 'F#4', 'A4'], 70, 2.2, 50)
    note(GLOCK, 'F#6', 35.0, 1.0, 40)
    nb(HARP, 'D2', 68, 1, 58)
    nb(PIZZ, 'D3', 70, 0.5, 56)


# --------------------------------------------------------------------------- MIDI
PPQ = 960
TEMPO_US = 500000            # 120 bpm: 1 beat = 0.5 s; render ticks = seconds * 1920
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


def note_list(chs, off, lead=True):
    out = []
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
    """the cue after the pre-roll, constant tempo (ticks = seconds * 1920), attack lead applied; CC11 every 25 ms"""
    ev = setup_events(chs)
    for ch, p, t0, t1, v in note_list(chs, T0):
        ev.append((int(round(t1 * TPS)), 1, ch, bytes([0x80 | ch, p, 0])))
        ev.append((int(round(max(0, t0) * TPS)), 3, ch, bytes([0x90 | ch, p, v])))
    nstep = int(round((T0 + DUR + TAIL) / 0.025))
    for ch in chs:
        last = None
        for i in range(nstep):
            val = int(round(env_val(ch, max(0.0, i * 0.025 - T0))))
            if val != last:
                ev.append((i * 48, 2, ch, bytes([0xB0 | ch, 11, val])))
                last = val
    title = b'THE LANTERN FOX (render)'
    meta = [(0, b'\xff\x03' + vlq(len(title)) + title), (0, b'\xff\x51\x03' + TEMPO_US.to_bytes(3, 'big'))]
    with open(path, 'wb') as f:
        f.write(smf([(None, ev)], meta, int(round((T0 + DUR + TAIL) * TPS))))


CUES = [(0.0, 'the find: celesta theme', 'high'), (3.0, 'the light blooms: glockenspiel', 'high'),
        (5.0, 'the woods: flute, pizzicato', 'low'), (11.0, 'the frozen falls: B minor', 'high'),
        (17.0, 'the aurora: G major, choir, horn', 'low'), (23.0, 'the storm: D minor, brass', 'low'),
        (29.0, 'he looks up: celesta', 'high'), (32.0, 'THE BEAM: tutti', 'low'), (34.0, 'the lullaby', 'high')]


def write_score_midi(path):
    """score.mid: the cue as written (no attack lead), 120 bpm, 4/4, expression, cue markers"""
    tick = lambda t: int(round(t * 2 * PPQ))
    title = b'THE LANTERN FOX'
    meta = [(0, b'\xff\x03' + vlq(len(title)) + title), (0, b'\xff\x58\x04\x04\x02\x18\x08'),
            (0, b'\xff\x51\x03' + TEMPO_US.to_bytes(3, 'big'))]
    for t, lab, _ in CUES:
        txt = f'{t:.2f} {lab}'.encode()
        meta.append((tick(t), b'\xff\x06' + vlq(len(txt)) + txt))
    end_tick = tick(DUR)
    tracks = []
    for c in range(16):
        ns = note_list([c], 0.0, lead=False)
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


def bpf(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], 'bp', fs=SR, output='sos'), x, axis=0)


def bell(f, dur, bright=1.0, rng=None):
    rng = RNG if rng is None else rng
    n = int(dur * SR)
    t = tt(n)
    y = np.zeros(n)
    for r, a, d in [(1.0, 1.0, 1.0), (2.0, 0.30, 0.55), (2.76, 0.42, 0.40), (4.07, 0.20, 0.25),
                    (5.43, 0.13 * bright, 0.16), (8.93, 0.05 * bright, 0.08)]:
        if f * r < SR * 0.45:
            y += a * np.sin(2 * np.pi * f * r * t + rng.uniform(0, 6.28)) * np.exp(-t / (dur * d / 3.0))
    return y * np.minimum(1, t / 0.0012)


# --------------------------------------------------------------------------- the synthesized layer
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


def render_fx(tmp):
    """the synthesized layer, on the film's clock (pre-roll included in placement): (low, air)"""
    low, air = np.zeros((NR, 2)), np.zeros((NR, 2))
    rng = np.random.default_rng(77)
    crash = crash_sample(tmp)
    for a in FX:
        kind = a[0]
        if kind == 'crunch':                                    # a paw scraping snow: a short gritty burst
            _, t, amp = a
            m = int(0.16 * SR)
            x = tt(m)
            n = rng.standard_normal(m)
            grit = (rng.random(m) < 0.08) * rng.standard_normal(m) * 2
            y = bpf((n + grit)[:, None], 1800, 7000)[:, 0] * np.exp(-x / 0.05) * np.minimum(1, x / 0.004)
            place(air, T0 + t, panned(y * amp * 0.035, 0.45))
        elif kind == 'bloom':                                   # the light opening: a warm low swell and a glassy star
            _, t, dur, amp = a
            m = int((dur + 0.5) * SR)
            x = tt(m)
            env = (1 - np.exp(-x / 0.18)) * np.exp(-x / (dur * 0.5))
            y = (np.sin(2 * np.pi * hz('D3') * x) + 0.5 * np.sin(2 * np.pi * hz('A3') * x)) * env
            place(low, T0 + t - 0.02, panned(y * amp * 0.05, 0.5))
            for i, p in enumerate(['A6', 'D7', 'F#7']):
                place(air, T0 + t + 0.01 * i, panned(bell(hz(p), 1.6, 0.8, rng) * 0.02 * amp, 0.4 + 0.1 * i))
        elif kind == 'owl':                                     # two soft hoots, breathy, falling a little
            _, t, amp, pan = a
            for k, (dt_, f0, d) in enumerate([(0.0, 392, 0.34), (0.42, 370, 0.5)]):
                m = int((d + 0.1) * SR)
                x = tt(m)
                f = f0 * (1 - 0.06 * x / d)
                ph = 2 * np.pi * np.cumsum(f) / SR
                env = np.sin(np.pi * np.clip(x / d, 0, 1)) ** 1.4
                y = (np.sin(ph) + 0.25 * np.sin(2 * ph)) * env + bpf(rng.standard_normal((m, 1)), 300, 900)[:, 0] * env * 0.18
                place(air, T0 + t + dt_, panned(y * amp * 0.03, pan))
        elif kind == 'crack':                                   # ice creaking under a slipping paw
            _, t, amp = a
            m = int(0.3 * SR)
            x = tt(m)
            y = np.zeros(m)
            for j in range(6):
                d0 = rng.uniform(0, 0.15)
                f0 = rng.uniform(700, 2200)
                y += np.where(x > d0, np.sin(2 * np.pi * f0 * (x - d0)) * np.exp(-(x - d0) / 0.012), 0)
            place(air, T0 + t, panned(y * amp * 0.03, 0.55))
        elif kind in ('shimmer', 'aurora'):                     # detuned high sines beating slowly, drifting in pan
            _, t0, t1, ps, amp = a
            m = int((t1 - t0) * SR)
            x = tt(m)
            y = np.zeros((m, 2))
            for p in ps:
                for det in (-0.002, 0.0023):
                    tw = 0.6 + 0.4 * np.sin(2 * np.pi * rng.uniform(0.2, 0.8) * x + rng.uniform(0, 6.28))
                    pan = 0.5 + 0.38 * np.sin(2 * np.pi * rng.uniform(0.07, 0.2) * x + rng.uniform(0, 6.28))
                    s = np.sin(2 * np.pi * hz(p) * (1 + det) * x + rng.uniform(0, 6.28)) * tw
                    y[:, 0] += s * np.cos(pan * np.pi / 2)
                    y[:, 1] += s * np.sin(pan * np.pi / 2)
            fade = min(1.2, (t1 - t0) / 3)
            env = np.clip(x / fade, 0, 1) ** 1.5 * np.clip((x[-1] - x) / fade, 0, 1) ** 1.5
            breath = hpf(rng.standard_normal((m, 2)), 6500) * 0.05 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.31 * x))[:, None]
            place(air, T0 + t0, (y / (2 * len(ps)) + breath) * env[:, None] * amp * (0.03 if kind == 'aurora' else 0.018))
        elif kind == 'wind':                                    # the storm: gusting, howling band-limited noise
            _, t0, t1, amp = a
            m = int((t1 - t0 + 0.3) * SR)
            x = tt(m)
            nz = rng.standard_normal((m, 2))
            gust = 0.55 + 0.45 * np.sin(2 * np.pi * 0.23 * x + 1) * np.sin(2 * np.pi * 0.11 * x + 2)
            howl = np.zeros((m, 2))
            blk = 2400
            for s in range(0, m, blk):
                fc = 420 + 260 * np.sin(2 * np.pi * 0.17 * s / SR) + 120 * np.sin(2 * np.pi * 0.41 * s / SR)
                seg = nz[s:s + blk]
                howl[s:s + blk] = bpf(seg, fc * 0.8, fc * 1.25, 1)
            body = lpf(nz, 900) * 0.6 + howl * 1.4
            env = np.clip(x / 0.6, 0, 1) * np.clip((t1 - t0 - x) / 0.12 + 1, 0, 1) ** 2
            place(air, T0 + t0, body * (gust * env)[:, None] * amp * 0.05)
        elif kind == 'wave':                                    # a sea swell breaking on the rocks below
            _, t, amp = a
            m = int(2.2 * SR)
            x = tt(m)
            env = np.minimum(1, x / 0.35) ** 2 * np.exp(-np.maximum(0, x - 0.35) / 0.6)
            y = lpf(rng.standard_normal((m, 2)), 1400) * env[:, None]
            place(low, T0 + t, y * amp * 0.09)
        elif kind == 'door':                                    # the old door, pushed: a wooden creak
            _, t, amp = a
            m = int(0.5 * SR)
            x = tt(m)
            f = 180 + 120 * x / 0.5 + 30 * np.sin(2 * np.pi * 7 * x)
            ph = 2 * np.pi * np.cumsum(f) / SR
            saw = 2 * (ph / (2 * np.pi) % 1) - 1
            y = bpf(saw[:, None], 300, 2500)[:, 0] * np.sin(np.pi * x / 0.5) ** 2
            place(air, T0 + t, panned(y * amp * 0.03, 0.4))
        elif kind == 'swell':                                   # a reversed cymbal swelling into the downbeat
            _, tend, dur, amp = a
            m = int(dur * SR)
            r = crash[::-1][-m:] * (np.linspace(0, 1, m) ** 2.2)[:, None]
            r = lpf(r, 8000, 2)
            r[-int(0.012 * SR):] *= np.linspace(1, 0, int(0.012 * SR))[:, None]
            place(air, T0 + tend - m / SR - 0.012, r * amp * 0.2)
        elif kind == 'beam':                                    # the light going out over the sea: a broad warm whoosh
            _, t, dur, amp = a
            m = int((dur + 1.0) * SR)
            x = tt(m)
            env = np.minimum(1, x / 0.05) * np.exp(-x / (dur * 0.55))
            y = bpf(rng.standard_normal((m, 2)), 200, 3000) * env[:, None]
            pan = np.clip(0.2 + 0.6 * x / dur, 0, 1)
            y = np.stack([y[:, 0] * np.cos(pan * np.pi / 2), y[:, 1] * np.sin(pan * np.pi / 2)], 1)
            place(air, T0 + t, y * amp * 0.03)
            sub = np.sin(2 * np.pi * 36.7 * x) * np.exp(-x / 0.9) * np.minimum(1, x / 0.02)
            place(low, T0 + t, panned(sub * amp * 0.12, 0.5))
        else:
            raise ValueError(kind)
    return low, air


# --------------------------------------------------------------------------- hall reverb
def hall_ir(rt60=2.8, pre=0.022):
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
STEM_GAIN = {'strings': 1.0, 'keys': 1.0, 'winds': 1.0, 'choir': 0.9, 'brass': 0.95, 'perc': 1.0,
             'fxlow': 1.0, 'fxair': 1.0}
SEND = {'strings': 0.48, 'keys': 0.55, 'winds': 0.5, 'choir': 0.7, 'brass': 0.45, 'perc': 0.4, 'fxlow': 0.05,
        'fxair': 0.6}


def space(t_abs):
    """the hall: a little wider out in the open (the woods, the meadow, the beam), tighter in the tower"""
    t = t_abs - T0
    return 1.0 + 0.25 * np.interp(t, [0, 5, 11, 17, 23, 25.5, 28.2, 32, 34, 36], [0.3, 0.6, 0.7, 1.0, 0.5, 0.0, 0.1, 1.0, 0.6, 0.6])


def mix(dry):
    ir = hall_ir()
    sg = space(tt(NR))[:, None]
    stems, send_bus = {}, np.zeros((NR, 2))
    for name, x in dry.items():
        x = x * STEM_GAIN[name]
        if name not in ('fxlow', 'perc'):
            x = hpf(x, 32)
        if name in ('strings', 'choir', 'brass'):
            x = peq(x, 300, -2.0, 0.9)
        if name == 'strings':
            x = shelf(x, 6500, 1.2, True)
        if name == 'keys':
            x = peq(x, 3200, 1.0, 0.7)
        if name == 'fxlow':
            x = lpf(x, 900)
        send = hpf(x, 140 if name in ('fxlow', 'perc') else 70) * SEND[name] * sg
        send_bus += send
        stems[name] = x + reverb(send, ir)
    return stems, send_bus, ir


MASTER_STATS = {}


def master(bus):
    x = hpf(bus, 26, 2)
    x = peq(x, 240, -1.0, 0.7)
    x = shelf(x, 9500, 1.0, True)
    # the ending: the hall tail of the last chord faded out inside the 36 s (applied before loudness, so it is measured)
    fade = np.ones(len(x))
    i0, i1 = int((T0 + FADE0) * SR), int((T0 + FADE1) * SR)
    fade[i0:i1] = 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, i1 - i0))
    fade[i1:] = 0
    x = x * fade[:, None]
    pre = lufs(x[I1:I2])
    x = x * 10 ** ((-20 - pre) / 20)
    x = compressor(x, thr_db=-24, ratio=1.7, att=0.04, rel=0.45)
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


# --------------------------------------------------------------------------- verification
SECTIONS = [(0.0, 5.0, 'the find (celesta)'), (5.0, 11.0, 'the woods (flute)'), (11.0, 17.0, 'the frozen falls'),
            (17.0, 23.0, 'the aurora meadow'), (23.0, 28.2, 'the storm and the climb'), (28.2, 30.0, 'the lamp room'),
            (30.0, 32.0, 'the lantern into the lens'), (32.0, 34.0, 'THE BEAM'), (34.0, 36.0, 'the lullaby')]
BANDS = {'low': (None, 150), 'mid': (150, 2000), 'high': (3000, 10000)}


def onset_detect(x, band='low'):
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


def verify(y, stems_kept, gain, report_path):
    lines = ['THE LANTERN FOX - score verification (all values measured on the rendered score.wav)', '']
    Lm = lufs(y)
    tp = 20 * np.log10(true_peak_env(y).max())
    info = sf.info(os.path.join(HERE, 'score.wav'))
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', os.path.join(HERE, 'score.wav'),
                        '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    summ = r[r.rfind('Summary:'):]
    keep = [l.strip() for l in summ.splitlines() if any(k in l for k in ('I:', 'LRA:', 'Peak:'))]
    # cue onsets (the film starts with silence before it: pad 1 s of silence in front)
    z = np.concatenate([np.zeros((SR, 2)), y])
    ons = {b: [(t - 1.0, r_) for t, r_ in onset_detect(z, b)] for b in BANDS}
    cue_lines = ['Cue alignment (onset detection; tolerance +-33.3 ms = 1 frame at 30 fps)']
    worst, nbad = 0.0, 0
    for t, lab, band in CUES:
        cands = [o for o in ons[band] if abs(o[0] - t) < 0.12]
        if cands:
            o = max(cands, key=lambda o: o[1])
            d = (o[0] - t) * 1000
            worst = max(worst, abs(d))
            ok = abs(d) <= 33.3
            nbad += not ok
            cue_lines.append(f'  {"OK " if ok else "OFF"} cue {t:6.2f}  {lab:36s} {band:4s} measured {o[0]:6.3f}  delta {d:+6.1f} ms  rise {o[1]:5.1f} dB')
        else:
            worst, nbad = 999.0, nbad + 1
            cue_lines.append(f'  MISS cue {t:6.2f} {lab:36s} {band:4s} no onset within 120 ms')
    cue_lines.append(f'  {len(CUES)} cues, {len(CUES) - nbad} within one frame; worst |delta| = {worst:.1f} ms')
    end_rms = 20 * np.log10(np.sqrt(np.mean(y[-int(0.05 * SR):] ** 2)) + 1e-12)
    last = np.abs(y[-1]).max()
    head = [('duration exactly 36.000 s (1728000 frames)', info.frames == NS and info.samplerate == SR),
            ('48 kHz / stereo / 24-bit PCM', info.samplerate == 48000 and info.channels == 2 and info.subtype == 'PCM_24'),
            (f'integrated loudness about -16 LUFS ({Lm:.2f})', abs(Lm - LUFS_TARGET) <= 0.5),
            (f'true peak <= -1 dBTP ({tp:.2f})', tp <= -1.0),
            (f'a natural ending: the hall faded out inside the 36 s (last 50 ms {end_rms:.1f} dBFS, last sample {last:.2e})', end_rms < -70),
            (f'cues within +-33 ms ({len(CUES) - nbad}/{len(CUES)}, worst {worst:.1f} ms)', nbad == 0)]
    lines += ['Summary'] + [f'  {"PASS" if ok else "FAIL"}  {lab}' for lab, ok in head] + ['']
    lines.append(f'Integrated loudness (internal BS.1770 meter): {Lm:.2f} LUFS, true peak {tp:.2f} dBTP (4x oversampled)')
    lines.append('ffmpeg ebur128: ' + ' | '.join(keep))
    lines.append(f'score.wav: {info.frames} frames = {info.frames / info.samplerate:.3f} s, {info.samplerate} Hz, {info.channels} ch, {info.subtype}')
    lines.append(f'Render: 1 s pre-roll, the 36 s cue, one fluidsynth per MIDI channel; hall; compressor; true-peak limiter '
                 f'(ceiling {CEILING} dBTP, max gain reduction {max(0.0, MASTER_STATS["limit_max"]):.1f} dB, more than 1 dB for '
                 f'{MASTER_STATS["limit_ms"]:.0f} ms); fade {FADE0:.2f}-{FADE1:.2f} s')
    lines.append(f'{len(NOTES)} notes, {len(FX)} synthesized fx events')
    lines.append('')
    lines += cue_lines
    lines.append('')
    lines.append('Energy contour (K-weighted loudness of each section, LUFS)')
    for t0, t1, lab in SECTIONS:
        st = short_term(y, t0, t1)
        seg = y[int(t0 * SR):int(t1 * SR)]
        pk = 20 * np.log10(np.abs(seg).max() + 1e-12)
        lines.append(f'  {t0:6.2f}-{t1:6.2f}  {lab:28s} {st:7.1f} LUFS   peak {pk:7.1f} dBFS  ' + '#' * max(0, int((st + 60) / 1.5)))
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
    print(f'{len(NOTES)} notes, {len(FX)} fx events -> score.mid')
    os.makedirs(SCRATCH, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix='fox_', dir=SCRATCH)
    try:
        crash_sample(tmp)

        def run(c):
            mid, wav = os.path.join(tmp, f'ch{c}.mid'), os.path.join(tmp, f'ch{c}.wav')
            write_render_midi(mid, [c])
            return c, render_midi(mid, wav, NR)

        used = sorted({n[0] for n in NOTES})
        dry = {name: np.zeros((NR, 2)) for name in STEMS}
        with ThreadPoolExecutor(max_workers=4) as ex:
            for c, x in ex.map(run, used):
                dry[next(n for n, chs in STEMS.items() if c in chs)] += x
        lo_, air_ = render_fx(tmp)
        dry['fxlow'], dry['fxair'] = lo_, air_
        stems, send_bus, ir = mix(dry)
        bus = sum(stems.values())
        full = master(bus)
        y = full[I1:I2]
        sf.write(os.path.join(HERE, 'score.wav'), y, SR, subtype='PCM_24')
        gain = np.sqrt(np.mean(full[I1:I2] ** 2)) / max(1e-12, np.sqrt(np.mean(bus[I1:I2] ** 2)))
        verify(y, {n: s[I1:I2] for n, s in stems.items()}, gain, os.path.join(HERE, 'verification.txt'))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
