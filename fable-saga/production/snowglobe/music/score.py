#!/usr/bin/env python3
"""SNOW GLOBE - a Fable Saga Christmas short - the score for a 15.000 s endless push-in that LOOPS SEAMLESSLY.

Built on the Carry score machinery (fluidsynth + FluidR3_GM, attack-compensated note-ons, a synthesized layer,
a hall, mastering to about -16 LUFS / -1.5 dBTP, three cycles rendered and the middle one kept, so the last sample
flows into the first exactly as the continuous render does).

A Christmas waltz in D at a steady 96 bpm: 8 bars of 3/4, two to each layer, so every layer arrives on a downbeat.

   bar  time    picture                       chord      music
   1-2   0.00   the cabin (fire, cat, tree)   D  Bm7     music box tune, harp oom-pah-pah, pizzicato, the fire's crackle
   3-4   3.75   the village in the globe      G  Em7     sleigh bells, celesta doubling, violins, warm horns, snow glitter
   5-6   7.50   the toy workshop              Bm F#m7    a tubular-bell chime, wood-block toy ticks, the flute takes the tune
   7-8  11.25   the cabin in the woods        Em9 A7sus4-A7  choir under the aurora, sleigh bells soft; A7 turns home
   (1)  15.00 = 0.00                          D          the chord the loop begins on
   Each arrival: a soft reverse swell through the glass, a harp glissando up, a celesta-and-glockenspiel star.

    python score.py          (needs fluidsynth, ffmpeg, numpy, scipy, soundfile)
Writes score.mid, score.wav (48 kHz / 24-bit / stereo, exactly 15.000 s) and verification.txt.
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
SCRATCH = '/tmp/claude-0/-home-user-brain/f1f7475c-3827-5141-bc67-2671553b043a/scratchpad/sg/music'
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
BAR_M = [0, 6, 12, 18, 24]                         # beats (3/4: bar b starts at beat 3(b-1)); two bars to a layer
BAR_T = [0.0, 3.75, 7.5, 11.25, 15.0]
BEATS = 24
_G = CubicSpline(BAR_M, np.array(BAR_T) - DUR / BEATS * np.array(BAR_M), bc_type='periodic')


def T(m):
    """seconds (cycle-relative) of beat position m; periodic: T(m + 24) = T(m) + 15 (a steady 96 bpm waltz)"""
    k = np.floor(m / BEATS)
    r = m - k * BEATS
    return float(_G(r) + DUR / BEATS * r + DUR * k)


def bar(b):
    return 3 * (b - 1)


# --------------------------------------------------------------------------- channels
VLN, LOW, CB, PIZZ, HARP, CEL, MBOX, GLOCK, HORN, DR, OOH, AAH, TIMP, PAD, TREM, SLOW = range(16)
NAMES = ['violins', 'violas+celli', 'contrabass', 'pizzicato', 'harp', 'celesta', 'music box', 'glockenspiel',
         'french horns', 'percussion', 'choir oohs', 'choir aahs', 'tubular bells', 'warm pad', 'flute',
         'slow strings']
INIT_PROG = {VLN: 48, LOW: 48, CB: 43, PIZZ: 45, HARP: 46, CEL: 8, MBOX: 10, GLOCK: 9, HORN: 60, OOH: 53,
             AAH: 52, TIMP: 14, PAD: 89, TREM: 73, SLOW: 49}
VOL = {VLN: 96, LOW: 98, CB: 100, PIZZ: 96, HARP: 108, CEL: 100, MBOX: 118, GLOCK: 88, HORN: 92, DR: 84,
       OOH: 100, AAH: 100, TIMP: 84, PAD: 76, TREM: 90, SLOW: 96}
PAN = {VLN: 40, LOW: 80, CB: 90, PIZZ: 74, HARP: 36, CEL: 84, MBOX: 60, GLOCK: 74, HORN: 50, DR: 70, OOH: 56,
       AAH: 72, TIMP: 56, PAD: 64, TREM: 48, SLOW: 86}
STEMS = {'strings': [VLN, LOW, CB, PIZZ, SLOW], 'keys': [HARP, CEL, MBOX, GLOCK, TIMP], 'choir': [OOH, AAH],
         'brass': [HORN, TREM], 'perc': [DR], 'pad': [PAD]}
# Attack compensation (time-to-half-amplitude * ~0.7 per FluidR3 patch, from Carry/part IV; flute 73 and tubular
# bells 14 estimated). Note-ons are sent this much early.
LAT = {48: .055, 49: .10, 44: .06, 45: .035, 43: .05, 60: .038, 52: .10, 53: .045, 47: 0., 46: 0., 8: 0.,
       9: .004, 10: .01, 89: .25, 73: .04, 14: .004}

# expression (CC11): periodic knots (cycle-relative seconds, value); first and last values equal.
# warm and close in the two rooms (0-3.75, 7.5-11.25), wider and higher out in the snow (3.75-7.5, 11.25-15)
ENV = {
    VLN: [(0, 0), (3.6, 0), (3.75, 70), (5.6, 84), (7.3, 50), (7.5, 0), (11.1, 0), (11.25, 66), (13.2, 88),
          (14.7, 40), (15, 0)],
    LOW: [(0, 82), (3.75, 90), (7.5, 80), (11.25, 92), (14.6, 86), (15, 82)],
    CB: [(0, 84), (15, 84)],
    SLOW: [(0, 74), (3.75, 86), (7.5, 74), (11.25, 90), (14.5, 82), (15, 74)],
    TREM: [(0, 0), (7.4, 0), (7.5, 70), (11.0, 74), (11.25, 30), (11.6, 0), (15, 0)],
    PAD: [(0, 70), (3.75, 84), (7.5, 72), (11.25, 90), (15, 70)],
    OOH: [(0, 0), (11.1, 0), (11.25, 60), (13.1, 86), (14.6, 50), (15, 0)],
    AAH: [(0, 0), (12.9, 0), (13.125, 60), (14.7, 30), (15, 0)],
    HORN: [(0, 0), (3.6, 0), (3.75, 56), (5.4, 60), (7.3, 20), (7.5, 0), (15, 0)],
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


# =========================================================================== THE SCORE
# per bar: (chord, bass root(s), low strings, upper strings, pad, the waltz's off-beat chord tones (harp))
CHORDS = {
    1: ('D', ['D2'], ['D3', 'A3'], ['F#4', 'A4', 'D5'], ['D3', 'A3', 'F#4'], ['A3', 'D4', 'F#4']),
    2: ('Bm7', ['B1'], ['B2', 'F#3'], ['D4', 'F#4', 'A4'], ['B2', 'F#3', 'D4'], ['F#3', 'B3', 'D4', 'A4']),
    3: ('G', ['G1'], ['G2', 'D3'], ['B4', 'D5', 'G5'], ['G2', 'D3', 'B3'], ['D4', 'G4', 'B4']),
    4: ('Em7', ['E2'], ['E2', 'B2'], ['G4', 'B4', 'D5'], ['E3', 'B3', 'G4'], ['B3', 'D4', 'G4']),
    5: ('Bm', ['B1'], ['B2', 'F#3'], ['D4', 'F#4', 'B4'], ['B2', 'F#3', 'D4'], ['F#3', 'B3', 'D4']),
    6: ('F#m7', ['F#2'], ['F#2', 'C#3'], ['C#4', 'E4', 'A4'], ['F#2', 'C#3', 'A3'], ['C#4', 'E4', 'A4']),
    7: ('Em9', ['E2'], ['E2', 'B2'], ['G4', 'B4', 'F#5'], ['E3', 'B3', 'G4'], ['B3', 'D4', 'F#4', 'G4']),
    8: ('A7sus4-A7', ['A1'], ['A2', 'E3'], ['D5', 'E5', 'G5'], ['A2', 'E3', 'G3'], ['E4', 'G4', 'C#5']),
}
# the waltz tune (music box): per bar [(beat, length, pitch)]
TUNE = {
    1: [(0, 2, 'A5'), (2, 1, 'F#5')], 2: [(0, 2, 'D6'), (2, 1, 'B5')],
    3: [(0, 1, 'B5'), (1, 1, 'A5'), (2, 1, 'G5')], 4: [(0, 2, 'F#5'), (2, 1, 'E5')],
    5: [(0, 1, 'D5'), (1, 1, 'F#5'), (2, 1, 'B5')], 6: [(0, 2, 'A5'), (2, 1, 'C#6')],
    7: [(0, 1.5, 'B5'), (1.5, 0.5, 'A5'), (2, 1, 'G5')], 8: [(0, 1, 'G5'), (1, 1, 'E5'), (2, 0.5, 'C#5'), (2.5, 0.5, 'E5')],
}
CUE_BARS = {0.0: 1, 3.75: 3, 7.5: 5, 11.25: 7}


def compose():
    bed()
    waltz()
    tune()
    rooms()
    snow()
    arrivals()
    damp()


def damp():
    """plucked/struck notes are released at the next layer's bar line, so no note rings into the next scene's chord"""
    lines = [T(bar(b)) for b in (1, 3, 5, 7, 9)]
    for i, (ch, p, t, d, v) in enumerate(NOTES):
        if ch in (HARP, CEL, MBOX, GLOCK, PIZZ, TIMP):
            nxt = min(x for x in lines if x > t + 0.005)
            if t + d > nxt + 0.03:
                NOTES[i] = (ch, p, t, nxt + 0.03 - t, v)


def bed():
    """the strings' and pad's chord under each bar, the bass on each downbeat"""
    for b, (_, root, low, up, pad, _) in CHORDS.items():
        m0 = bar(b)
        out = b in (3, 4, 7, 8)                        # out in the snow: fuller
        cb(LOW, low, m0, 2.9, 86 if out else 78)
        cb(SLOW, up, m0, 3.0, 84 if out else 72)
        cb(PAD, pad, m0, 3.0, 66)
        cb(CB, root, m0, 2.6, 88)
    # bar 8: the suspension resolves (D5 -> C#5 in the upper strings) on beat 2
    for i, (ch, p, t, d, v) in enumerate(NOTES):
        if ch == SLOW and p == P('D5') and abs(t - T(bar(8))) < 0.2:
            NOTES[i] = (ch, p, t, T(bar(8) + 1) - t, v)
    nb(SLOW, 'C#5', bar(8) + 1, 2.0, 80)


def waltz():
    """oom-pah-pah: the harp's low root on 1, the chord on 2 and 3; pizzicato doubles the bass in the rooms"""
    for b, (_, root, _, _, _, off) in CHORDS.items():
        m0 = bar(b)
        cb(HARP, [r.replace('1', '2') if r[-1] == '1' else r for r in root], m0, 1.0, 78)
        for k, beat in enumerate((1, 2)):
            cb(HARP, off, m0 + beat, 0.9, 54 - 4 * k, jit=0.006)
        if b in (1, 2, 5, 6):
            nb(PIZZ, root[0].replace('1', '2'), m0, 0.5, 74)
            cb(PIZZ, off[:2], m0 + 1, 0.4, 50)
            cb(PIZZ, off[:2], m0 + 2, 0.4, 46)


def tune():
    """the music box carries the tune; the celesta doubles it an octave up out in the snow; the flute sings it in
    the workshop; the glockenspiel answers"""
    for b, ns in TUNE.items():
        m0 = bar(b)
        for o, d, p in ns:
            v = 92 if o == 0 else 80
            nb(MBOX, p, m0 + o, max(d, 1.4), v)
            if b in (3, 4, 7, 8):
                nb(CEL, P(p) + 12, m0 + o, max(d, 1.2), v - 26)
            if b in (5, 6):
                nb(TREM, P(p) - 12, m0 + o, d * 0.96, v - 18)
    # a little answer in the glockenspiel at the end of each room's second bar
    for m, p, v in [(bar(2) + 2.5, 'F#6', 54), (bar(6) + 2.5, 'E6', 54)]:
        nb(GLOCK, p, m, 1.0, v)


def rooms():
    """inside: the fire's crackle (cabin), the toys ticking and a cuckoo-ish pair of bells (workshop)"""
    for t in np.arange(0.12, 3.7, 0.41):
        fx('crackle', float(t + RNG.uniform(-0.12, 0.12)), float(RNG.uniform(0.4, 1.0)))
    for k in range(12):                               # the workshop clock and the toys: wood block ticks on the beat
        m = bar(5) + k * 0.5
        note(DR, 76 if k % 2 == 0 else 77, T(m), 0.1, 52 if k % 6 == 0 else 38)
    note(TIMP, 'B5', T(bar(5)), 1.6, 70)                # a chime as the workshop arrives (tubular bell)
    note(TIMP, 'F#5', T(bar(6)), 1.6, 58)


def snow():
    """outside: sleigh bells (a shaken 8th-note pattern, accented on 1) and a glitter of glockenspiel snow"""
    for b0, amp in ((3, 1.0), (7, 0.7)):
        for k in range(12):
            m = bar(b0) + k * 0.5
            fx('jingle', T(m), amp * (1.0 if k % 6 == 0 else 0.62 if k % 2 == 0 else 0.42), 0.18 + 0.64 * ((k % 4) / 3))
    flakes = ['D7', 'F#7', 'A7', 'B6', 'E7', 'A6', 'D7', 'G7']
    for b0 in (3, 7):
        for k in range(9):
            t = T(bar(b0)) + 0.18 + k * 0.4 + RNG.uniform(-0.06, 0.06)
            note(GLOCK, flakes[(k + b0) % len(flakes)], t, 0.6, 26 + RNG.integers(0, 10))
    # the forest's aurora: choir oohs on the chord, aahs swelling into the turn home
    cb(OOH, ['E4', 'B4', 'G5'], bar(7), 3.0, 70)
    cb(OOH, ['E4', 'A4', 'D5'], bar(8), 3.0, 72)
    cb(AAH, ['A3', 'E4', 'C#5'], bar(8), 3.0, 64)
    # the village: warm horns under the second bar
    cb(HORN, ['B3', 'D4'], bar(3), 3.0, 60)
    cb(HORN, ['G3', 'B3'], bar(4), 3.0, 58)


def arrivals():
    """through the glass: each layer arrives on a soft reverse swell, a harp glissando and a celesta star"""
    gls = {1: ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6'], 3: ['G4', 'A4', 'B4', 'D5', 'E5', 'G5'],
           5: ['B4', 'C#5', 'D5', 'F#5', 'A5', 'B5'], 7: ['E5', 'F#5', 'G5', 'B5', 'D6', 'E6']}
    for b, gl in gls.items():
        t1 = T(bar(b))
        tg = t1 - 0.30 if b != 1 else DUR - 0.30          # (bar 1's glissando ends the cycle, ringing into the seam)
        for i, p in enumerate(gl):
            note(HARP, p, tg + i * 0.045, 0.6, 30 + 4 * i)
        fx('swell', t1 if b != 1 else DUR, 1.6, 0.55)
        note(CEL, gl[-1], t1, 1.2, 60)
        note(GLOCK, P(gl[-1]) + 12, t1 + 0.002, 1.0, 52)


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
    title = b'SNOW GLOBE (render: 3 cycles)'
    meta = [(0, b'\xff\x03' + vlq(len(title)) + title), (0, b'\xff\x51\x03' + TEMPO_US.to_bytes(3, 'big'))]
    with open(path, 'wb') as f:
        f.write(smf([(None, ev)], meta, int(round((T0 + NCYC * DUR + TAIL) * TPS))))


CUES = [(0.0, 'seam: the cabin, D waltz', 'low'), (3.75, 'the village: G, sleigh bells', 'low'),
        (7.5, 'the workshop: Bm, tubular bell', 'low'), (11.25, 'the forest: Em9, choir', 'low')]


def write_score_midi(path):
    """score.mid: ONE cycle as written (no attack lead), tempo-mapped so that the 9 bars of 3/4 land on the cues
    (a tempo event every 16th from the spline), expression curves, cue markers; note-offs end by 15.000 s"""
    q = 0.25
    mj = np.arange(0, BEATS + 1e-9, q)
    tj = np.array([T(m) for m in mj])
    kj = (mj * PPQ).astype(int)

    def tick(t):
        return int(round(np.interp(min(max(t, 0.0), DUR), tj, kj)))

    title = b'SNOW GLOBE'
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
        elif kind == 'jingle':
            # a shake of sleigh bells: a few tiny bells struck within 30 ms, inharmonic and bright, and a breath of noise
            _, t, amp, pan = a
            m = int(0.35 * SR)
            x = tt(m)
            y = np.zeros(m)
            for j in range(5):
                dt_ = rng.uniform(0, 0.03)
                f0 = rng.uniform(3200, 7600)
                env = np.where(x >= dt_, np.exp(-np.maximum(0, x - dt_) / rng.uniform(0.05, 0.11)), 0.0)
                y += env * (np.sin(2 * np.pi * f0 * x) + 0.6 * np.sin(2 * np.pi * f0 * 1.47 * x) + 0.35 * np.sin(2 * np.pi * f0 * 2.09 * x))
            y += hpf(rng.standard_normal((m, 1)), 6000)[:, 0] * np.exp(-x / 0.03) * 0.6
            place(air, t - 0.005, panned(y * amp * 0.010, pan))
        elif kind == 'crackle':
            # the fire: a little pop of band-limited noise, now and then with a soft thump
            _, t, amp = a
            m = int(0.06 * SR)
            x = tt(m)
            n = rng.standard_normal((m, 1))
            y = signal.sosfilt(signal.butter(2, [900, 5200], 'bp', fs=SR, output='sos'), n[:, 0]) * np.exp(-x / rng.uniform(0.003, 0.012))
            place(air, t, panned(y * amp * 0.05, rng.uniform(0.15, 0.4)))
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
    """periodic send multiplier: the hall opens a little out in the snow (mid-village, mid-forest), closes in the rooms"""
    tr = (t_abs - T0) % DUR
    return 1.0 + 0.25 * (0.5 - 0.5 * np.cos(4 * np.pi * (tr - 1.875) / DUR))


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
SECTIONS = [(0.0, 3.75, 'the cabin (music box, harp, fire)'), (3.75, 7.5, 'the village (sleigh bells)'),
            (7.5, 11.25, 'the workshop (ticks, flute)'), (11.25, 15.0, 'the forest cabin (choir)')]
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
    lines = ['SNOW GLOBE - score verification (all values measured on the rendered score.wav)', '']
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
    tmp = tempfile.mkdtemp(prefix='globe_', dir=SCRATCH)
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
