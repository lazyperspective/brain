#!/usr/bin/env python3
"""MIGRATING BIRDS - the sound: a seamless 40.000 s score, synthesised (numpy/scipy) with sampled woodwinds, harp,
celesta, strings and a pad rendered by FluidSynth (FluidR3_GM) from a MIDI file this script writes itself.

Twelve bars of 4/4 at 72 bpm are exactly 40 s, one turn of the light. It follows the picture's clock
(08-migrating-birds.js, T and the light keys):

    t          picture                                           sound
    0-2.9      golden afternoon; four birds hop out of the leaves the theme on flute over harp; a soft pluck per hop
    3.9-8.3    the yellow one flies to the blue tree             a rising flute figure; a harp note as it lands; a greeting
    9.9-14.7   the builder flies there too, with its twig        the oboe takes the figure (a warmer voice); harp on landing
    10.5-14    sunset                                            strings swell a little
    16.4-19.3  the lavender one glides down to the stump         the flute falls, slowly
    19.3-37    it sleeps in the hollow                           a celesta lullaby; later a soft note now and then
    18-31      dusk, fireflies, night, stars                     the harp rests; a warm pad; crickets; birdsong stops
    23.0-25.5  the teal one flies to the signpost                the flute rises and stops on an open note
    26.6-32    it looks left, tries the left arrow, the right    plucks panned left, then right, then the middle
    32.9       it looks up at the sky                            a long, high flute note, a question
    33.7-37.4  it flies away over the hills                      the flute rises and thins into the distance
    31-39      dawn: the flock wakes and sings                   a dawn chorus of synthesised birdsong
    33.8-36.1  an egg hatches; the chick cheeps                  celesta; tiny cheeps
    37-40      gold again                                        the theme's last phrase, resolving onto its first note

Seamless by construction: everything is rendered over three cycles (120 s) with every noise source built from one
40 s tile repeated, envelopes periodic, events placed in every cycle, the reverb circular, and the middle cycle cut.
FluidSynth renders the same three-cycle MIDI (its own reverb and chorus off), so note tails cross the seam naturally.

    python3 score.py        (numpy, scipy, soundfile; fluidsynth + /usr/share/sounds/sf2/FluidR3_GM.sf2; ffmpeg)
Writes score.wav (48 kHz / 24-bit / stereo, exactly 40.000 s) and verification.txt.
"""
import os, struct, subprocess, tempfile
import numpy as np
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
SF2 = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
SR = 48000
D = 40.0
N = int(round(SR * D))
CYC = 3
NT = N * CYC
TARGET_LUFS = -20.0
CEIL_DB = -2.0
t_all = np.arange(NT) / SR
tl = np.mod(t_all, D)
BAR = D / 12                                     # 3.333 s: a bar of 4/4 at 72 bpm
BEAT = BAR / 4

# ------------------------------------------------------------------ the picture's clock (loop time)
T_OUT = [0.35, 1.0, 1.7, 2.4]
T_L1 = (3.9, 8.3)
T_L2 = (9.9, 14.7)
T_L3 = (16.4, 19.3)
T_L4 = (23.0, 25.5)
T_L4GO = (33.7, 37.4)
T_HATCH = 33.8


def sstep(a, b, x):
    u = np.clip((x - a) / (b - a), 0, 1)
    return u * u * (3 - 2 * u)


def penv(points):
    """a periodic envelope from (loop time, value) points"""
    p = sorted(points)
    xs = np.array([q[0] for q in p] + [p[0][0] + D])
    ys = np.array([q[1] for q in p] + [p[0][1]])
    return np.interp(tl, xs, ys, period=D)


NAMES = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}


def midi(note):
    n, o = note[:-1], int(note[-1])
    return NAMES[n] + 12 * (o + 1)


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


# light: 1 by day, 0 at night (the same turn as the picture's keys)
day = penv([(0, 1), (10.5, 0.85), (14, 0.5), (18, 0.12), (22, 0), (28.5, 0), (31.5, 0.25), (34.5, 0.8), (37.5, 1)])
night = 1 - day

# ------------------------------------------------------------------ air: a breeze, always there, so the seam sits in it
sway = 0.75 + 0.25 * np.sin(2 * np.pi * 3 * t_all / D + 0.4) + 0.12 * np.sin(2 * np.pi * 7 * t_all / D + 1.1)
breeze = circ(lambda x: bp(x, 160, 1200, 2), tiled(11)) * 0.026 * sway * (0.6 + 0.4 * day)
leaves = circ(lambda x: bp(x, 2400, 7000, 2), tiled(12)) * 0.006 * (0.4 + 0.6 * sway) * (0.5 + 0.5 * day)
air = breeze + leaves

# ------------------------------------------------------------------ crickets at night: pulsed chirps, two of them
cr = np.zeros((2, NT))
for k, (f0, rate, pan, ph0) in enumerate([(4300, 3.0, -0.5, 0.0), (4700, 2.4, 0.55, 0.37)]):
    rate = round(rate * D) / D                         # whole cycles per loop
    gate = (np.mod(t_all * rate + ph0, 1.0) < 0.22).astype(float)
    trill = 0.5 + 0.5 * np.sin(2 * np.pi * 52 * t_all)
    sig = np.sin(2 * np.pi * f0 * t_all) * gate * trill
    sig = circ(lambda x: lp(x, 9000, 2), sig)
    cr += pans(sig * 0.0065, pan)
cr *= np.vstack([night, night]) ** 1.5

# ------------------------------------------------------------------ birdsong: the flock by day, a dawn chorus, cheeps
birds = np.zeros((2, NT))


def chirp(f0, f1, dur, amp, seed, vib=0.0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = f0 + (f1 - f0) * (tt / dur) ** 0.7 + vib * np.sin(2 * np.pi * 38 * tt + r.uniform(0, 6))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.22 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    return s * np.sin(np.pi * tt / dur) ** 1.5 * amp


def warble(t0, amp, seed, pan, lo=2600, hi=3800, nmin=3, nmax=6):
    r = np.random.default_rng(seed)
    t = t0
    for k in range(r.integers(nmin, nmax + 1)):
        f0 = r.uniform(lo, hi)
        place(birds, t, pans(chirp(f0, f0 * r.uniform(0.8, 1.25), r.uniform(0.05, 0.11), amp * r.uniform(0.6, 1), seed * 10 + k, 110), pan))
        t += r.uniform(0.08, 0.16)


def call(t0, amp, seed, pan, f0=3100, f1=2500):
    place(birds, t0, pans(chirp(f0, f1, 0.2, amp, seed), pan))
    place(birds, t0 + 0.26, pans(chirp(f0 * 0.88, f1 * 0.9, 0.24, amp * 0.85, seed + 1), pan))


rng = np.random.default_rng(5)
SONGS = []
# by day: now and then; at dusk fewer; none in the night; the dawn chorus thick and bright
for t in np.arange(0.6, D, 0.55):
    d = float(np.interp(t, [0, 10, 14, 17, 19, 30.6, 31.5, 33, 37, 40], [0.5, 0.45, 0.3, 0.15, 0, 0, 0.35, 0.9, 0.6, 0.5]))
    if rng.random() < d:
        SONGS.append((t + rng.uniform(0, 0.3), rng.integers(0, 3), rng.uniform(-0.8, 0.0), int(rng.integers(100, 10000))))
# the blue tree greets the newcomers (far off, to the right)
GREET = [(T_L1[1] + 0.45, 0.6), (T_L2[1] + 0.45, 0.62)]
for c in range(CYC):
    o = c * D
    for (t, kind, pan, sd) in SONGS:
        if kind == 0:
            warble(o + t, 0.016, sd, pan)
        elif kind == 1:
            call(o + t, 0.012, sd, pan)
        else:
            warble(o + t, 0.012, sd, pan, 3400, 4600, 2, 4)
    for (t, pan) in GREET:
        warble(o + t, 0.007, int(t * 100), pan, 3600, 4800, 3, 4)
    # the chick: tiny high cheeps while its beak opens
    for k in range(6):
        t = 34.3 + k * 0.625
        place(birds, o + t, pans(chirp(5200, 6100, 0.07, 0.009, 900 + k), -0.45))
        place(birds, o + t + 0.13, pans(chirp(5400, 6000, 0.06, 0.007, 950 + k), -0.45))
birds = circ(lambda x: lp(x, 8000, 2), birds)

# wingbeats: a soft flutter for each flight, panned along its path
wings = np.zeros((2, NT))
FLIGHTS = [(T_L1[0], 1.6, -0.3, 0.6, 1.0), (T_L2[0], 1.6, -0.1, 0.6, 1.0), (T_L3[0], 1.2, -0.2, 0.4, 0.8),
           (T_L4[0], 1.4, -0.1, 0.1, 0.9), (T_L4GO[0], 1.8, 0.1, 0.4, 0.6)]
for c in range(CYC):
    o = c * D
    for (t0, dur, p0, p1, a) in FLIGHTS:
        n = int(dur * SR)
        tt = np.arange(n) / SR
        flut = (0.5 + 0.5 * np.sin(2 * np.pi * 7.0 * tt)) ** 3
        env = np.sin(np.pi * np.clip(tt / dur, 0, 1)) ** 1.5 * np.exp(-tt / (dur * 0.8))
        nz = bp(np.random.default_rng(int(t0 * 10)).standard_normal(n), 400, 2600, 2) * flut * env * 0.03 * a
        pan = np.linspace(p0, p1, n)
        place(wings, o + t0, np.vstack([nz * np.sqrt(0.5 * (1 - pan)), nz * np.sqrt(0.5 * (1 + pan))]))

# ------------------------------------------------------------------ the music (FluidSynth)
FLUTE, OBOE, HARP, CEL, STR, PAD, PLUCK = 0, 1, 2, 3, 4, 5, 6
PROGS = {FLUTE: 73, OBOE: 68, HARP: 46, CEL: 8, STR: 49, PAD: 89, PLUCK: 108}
PANS = {FLUTE: 64, OBOE: 56, HARP: 50, CEL: 76, STR: 64, PAD: 64, PLUCK: 64}
NOTES = []        # (time, channel, note, velocity, length[, pan 0..127])

# chords, one a bar: the light's own harmony
CHORDS = [
    ['D3', 'A3', 'E4', 'F#4'],          # 1  golden: Dadd9
    ['G2', 'D3', 'B3', 'F#4'],          # 2  Gmaj7 - the yellow one leaves
    ['E3', 'B3', 'D4', 'F#4'],          # 3  Em9
    ['A2', 'E3', 'G3', 'D4'],           # 4  A7sus4 - the builder leaves; sunset
    ['B2', 'F#3', 'A3', 'D4'],          # 5  Bm7
    ['G2', 'D3', 'B3', 'F#4'],          # 6  Gmaj7 - the glide down
    ['E3', 'B3', 'D4', 'G4'],           # 7  Em7 - night
    ['F#2', 'C#3', 'A3', 'E4'],         # 8  F#m7 - to the signpost
    ['G2', 'D3', 'B3', 'F#4'],          # 9  Gmaj7 - this way, that way
    ['E3', 'B3', 'D4', 'G4'],           # 10 Em7 - first light
    ['G2', 'D3', 'A3', 'F#4'],          # 11 Gmaj9 - away; the egg hatches
    ['A2', 'E3', 'G3', 'D4'],           # 12 A7sus4 - gold again, turning home to D
]
for b, ch in enumerate(CHORDS):
    t0 = b * BAR
    lt = (b + 0.5) * BAR
    dl = float(np.interp(lt, [0, 10.5, 14, 18, 22, 28.5, 31.5, 34.5, 37.5, 40], [1, 0.85, 0.5, 0.12, 0, 0, 0.25, 0.8, 1, 1]))
    # strings by day (a little swell at sunset), the warm pad by night
    sv = int(26 + 18 * dl + (8 if b in (3, 4) else 0))
    for nn in ch:
        NOTES.append((t0 + 0.02, STR, nn, sv, BAR + 0.25))
    pv = int(18 + 30 * (1 - dl))
    for nn in ch[1:]:
        NOTES.append((t0 + 0.05, PAD, nn, pv, BAR + 0.35))
    # the harp arpeggiates by day and rests at night
    if dl > 0.2:
        arp = [ch[0], ch[1], ch[2], ch[3], ch[2], ch[1], ch[3], ch[2]]
        up = [n[:-1] + str(int(n[-1]) + 1) for n in ch]
        arp = arp[:4] + [up[1], up[2], ch[3], ch[2]]
        for k, nn in enumerate(arp):
            NOTES.append((t0 + k * BEAT / 2 + 0.01, HARP, nn, int(20 + 20 * dl - (6 if k % 2 else 0)), 1.6))

# the theme, at the start
NOTES += [(0.15, FLUTE, 'F#5', 56, 0.6), (0.8, FLUTE, 'A5', 58, 0.5), (1.3, FLUTE, 'B5', 60, 0.45), (1.75, FLUTE, 'A5', 56, 1.3)]
# soft plucks as the four hop out of the leaves
for k, t in enumerate(T_OUT):
    NOTES.append((t + 0.15, PLUCK, ['A5', 'D6', 'F#5', 'E6'][k], 34, 0.5))
# the yellow one: a rising figure, a held note in flight, a harp note as it lands
NOTES += [(3.9, FLUTE, 'D5', 50, 0.3), (4.15, FLUTE, 'E5', 54, 0.3), (4.4, FLUTE, 'F#5', 58, 0.3), (4.65, FLUTE, 'A5', 60, 0.5),
          (5.2, FLUTE, 'B5', 62, 1.4), (7.0, FLUTE, 'A5', 52, 0.6), (7.6, FLUTE, 'F#5', 48, 0.9), (T_L1[1], HARP, 'E6', 52, 2.0), (T_L1[1], CEL, 'B6', 30, 1.2)]
# the builder: the oboe takes the figure; the flute answers; harp as it lands
NOTES += [(9.9, OBOE, 'A4', 50, 0.3), (10.15, OBOE, 'B4', 54, 0.3), (10.4, OBOE, 'D5', 56, 0.3), (10.65, OBOE, 'E5', 58, 1.6),
          (12.4, FLUTE, 'F#5', 46, 0.35), (12.7, FLUTE, 'G5', 48, 0.35), (13.0, FLUTE, 'A5', 50, 0.9),
          (13.6, OBOE, 'D5', 50, 0.8), (14.3, OBOE, 'C#5', 46, 0.6), (T_L2[1], HARP, 'B5', 52, 2.0), (T_L2[1], CEL, 'F#6', 30, 1.2)]
# the lavender one: the flute falls slowly with its glide; a lullaby on the celesta as it tucks in
NOTES += [(16.4, FLUTE, 'A5', 52, 0.55), (16.95, FLUTE, 'G5', 50, 0.55), (17.5, FLUTE, 'F#5', 48, 0.6), (18.1, FLUTE, 'E5', 46, 0.75),
          (18.9, FLUTE, 'D5', 44, 1.6), (19.6, CEL, 'B5', 34, 1.0), (20.2, CEL, 'A5', 32, 1.0), (20.8, CEL, 'F#5', 32, 1.4),
          (21.6, CEL, 'D5', 28, 2.0), (25.0, CEL, 'G5', 22, 1.6), (29.6, CEL, 'E5', 20, 1.6)]
# the teal one: the flute rises and stops on an open note at the signpost
NOTES += [(23.0, FLUTE, 'C#5', 46, 0.3), (23.25, FLUTE, 'E5', 50, 0.3), (23.5, FLUTE, 'F#5', 52, 0.3), (23.75, FLUTE, 'A5', 54, 0.9),
          (25.5, FLUTE, 'E5', 44, 1.8)]
# this way, that way: plucks that sit where it looks
NOTES += [(26.6, PLUCK, 'B5', 36, 0.6, 30), (27.85, PLUCK, 'D6', 38, 0.6, 18), (29.0, PLUCK, 'A5', 32, 0.6, 50), (29.55, PLUCK, 'F#5', 30, 0.5, 64),
          (29.95, PLUCK, 'E6', 38, 0.6, 110), (31.2, PLUCK, 'B5', 32, 0.6, 80), (31.65, PLUCK, 'F#5', 30, 0.5, 64), (32.5, PLUCK, 'D6', 28, 0.4, 40),
          (32.9, FLUTE, 'A5', 48, 0.8)]
# away over the hills: the flute rises and thins
NOTES += [(33.7, FLUTE, 'B5', 46, 0.35), (34.0, FLUTE, 'D6', 42, 0.35), (34.3, FLUTE, 'E6', 38, 0.8), (35.2, FLUTE, 'F#6', 30, 1.4)]
# the egg hatches: celesta
NOTES += [(T_HATCH, CEL, 'D6', 40, 1.2), (T_HATCH + 0.3, CEL, 'F#6', 36, 1.2), (T_HATCH + 0.6, CEL, 'A6', 34, 1.4), (35.7, CEL, 'B6', 26, 1.2)]
# gold again: the theme's last phrase, landing on its first note at the top of the loop
NOTES += [(37.2, FLUTE, 'A5', 50, 0.6), (37.9, FLUTE, 'G5', 50, 0.6), (38.6, FLUTE, 'F#5', 52, 0.55), (39.2, FLUTE, 'E5', 52, 0.9)]


def write_midi(path, notes, cycles):
    tpq, tempo = 480, 500000                   # 120 bpm: 960 ticks per second
    tps = tpq * 1e6 / tempo
    ev = []
    for ch, prg in PROGS.items():
        ev.append((0, 0, bytes([0xC0 | ch, prg])))
        ev.append((0, 0, bytes([0xB0 | ch, 7, 100])))
        ev.append((0, 0, bytes([0xB0 | ch, 10, PANS[ch]])))
        ev.append((0, 0, bytes([0xB0 | ch, 91, 0])))   # no reverb send (ours is circular)
        ev.append((0, 0, bytes([0xB0 | ch, 93, 0])))
    for c in range(cycles):
        for n in notes:
            t, ch, nn, vel, ln = n[:5]
            on = int(round((c * D + t) * tps))
            if len(n) > 5:
                ev.append((on, 0, bytes([0xB0 | ch, 10, n[5]])))
            ev.append((on, 1, bytes([0x90 | ch, midi(nn), vel])))
            ev.append((on + int(round(ln * tps)), -1, bytes([0x80 | ch, midi(nn), 0])))
            if len(n) > 5:
                ev.append((on + int(round(ln * tps)) + 1, 0, bytes([0xB0 | ch, 10, PANS[ch]])))
    ev.sort(key=lambda e: (e[0], e[1]))
    data, last = b'', 0

    def vlq(v):
        out = [v & 0x7F]
        v >>= 7
        while v:
            out.insert(0, (v & 0x7F) | 0x80)
            v >>= 7
        return bytes(out)
    data += vlq(0) + b'\xff\x51\x03' + tempo.to_bytes(3, 'big')
    for tick, _, msg in ev:
        data += vlq(tick - last) + msg
        last = tick
    data += vlq(int((cycles * D + 4) * tps) - last) + b'\xff\x2f\x00'
    with open(path, 'wb') as f:
        f.write(b'MThd' + struct.pack('>IHHH', 6, 0, 1, tpq) + b'MTrk' + struct.pack('>I', len(data)) + data)


with tempfile.TemporaryDirectory() as td:
    mp, wp = os.path.join(td, 'music.mid'), os.path.join(td, 'music.wav')
    write_midi(mp, NOTES, CYC)
    subprocess.run(['fluidsynth', '-ni', '-q', '-R', '0', '-C', '0', '-g', '0.6', '-r', str(SR), '-F', wp, SF2, mp], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    m, msr = sf.read(wp, always_2d=True)
    assert msr == SR
m = m.T
music = np.zeros((2, NT))
k = min(NT, m.shape[1])
music[:, :k] = m[:, :k]
# tails from the third cycle that ran past 120 s fold back to the start (they belong to the next first cycle)
if m.shape[1] > NT:
    music[:, :m.shape[1] - NT] += m[:, NT:]


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


dry = air + birds * 0.9 + wings + cr + music * 0.6
wet = hall(birds * 1.4 + music * 0.75 + wings * 0.5 + cr * 0.4, 3.6, 9, 3600)
mix = dry * 0.85 + wet * 0.4
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


for _ in range(3):                       # loudness, then a ceiling (a peak trim would change the loudness: repeat)
    L = lufs(out)
    out *= 10 ** ((TARGET_LUFS - L) / 20)
    tp = true_peak_db(out)
    if tp > CEIL_DB:
        # a gentle soft clip above the ceiling keeps the loudness on target
        c = 10 ** (CEIL_DB / 20) * 0.98
        out = np.where(np.abs(out) > c * 0.7, np.sign(out) * (c * 0.7 + (c * 0.3) * np.tanh((np.abs(out) - c * 0.7) / (c * 0.3))), out)
L2, tp2 = lufs(out), true_peak_db(out)
path = os.path.join(HERE, 'score.wav')
sf.write(path, out.T, SR, subtype='PCM_24')

# ------------------------------------------------------------------ verification
back_, sr = sf.read(path, always_2d=True)
back_ = back_.T
lines = ['MIGRATING BIRDS - sound verification (measured on the written score.wav)', '']
lines.append(f'duration: {back_.shape[1]} frames = {back_.shape[1] / sr:.6f} s at {sr} Hz, {back_.shape[0]} ch, PCM_24')
lines.append('events (loop time): hops out %s; yellow %.1f-%.1f; builder %.1f-%.1f; glide %.1f-%.1f; signpost %.1f-%.1f; away %.1f-%.1f; hatch %.1f' % (
    ' '.join(f'{x:.2f}' for x in T_OUT), *T_L1, *T_L2, *T_L3, *T_L4, *T_L4GO, T_HATCH))
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
lines.append(('PASS' if back_.shape[1] == N else 'FAIL') + '  exactly 40.000 s')
lines.append(('PASS' if abs(L2 - TARGET_LUFS) < 0.3 else 'CHECK') + f'  loudness {L2:.2f} LUFS (target {TARGET_LUFS})')
txt = '\n'.join(lines)
print(txt)
open(os.path.join(HERE, 'verification.txt'), 'w').write(txt + '\n')
