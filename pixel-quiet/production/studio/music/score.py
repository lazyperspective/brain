#!/usr/bin/env python3
"""THE LITTLE STUDIO - the sound: a seamless 40.000 s score, synthesised (numpy/scipy) with the instruments rendered by
FluidSynth (FluidR3_GM) from a MIDI file this script writes itself.

Twelve bars of 4/4 at 72 bpm are exactly 40 s, so the music turns over with the picture. Cosy and gently wistful in F
major: a music box carries the tune, a nylon guitar plucks the arpeggios, soft electric piano and a quiet string pad
hold the chords, a soft bass on the downbeats. It thins out through the night, holds one chord in the dark hour, and
rises with a little arpeggio as the studio's lamps come back on one by one. Under it, the street and the studio, on the
picture's own clock (07-the-little-studio.js):

    t (s)        picture                                         sound
    0-1.6, 38.4- coffee is poured                                the machine's hiss and gurgle
    39.25        the studio door opens: the terminal leaves      the shop bell over the door
    3.0-5.5      birds leave the wire at sunset                  wingbeats and a call
    8.0, 29.7    the other building's glass doors slide          a soft pneumatic whoosh, a closing thud
    9.0, 16.0, 23.75  the door again (hammock, app window, chart)  the bell each time
    17.8-19.2    the hammock unfurls; a hop in                   a flutter of cloth, a rope creak
    19.15-19.75  three dots appear in the speech bubble          three music-box blips
    21.6-27.4    zig-zags rise from the sleeper                  a soft vibraphone note for each
    20.5-25.8    the cat hops down, crosses, hops up             two soft paw thumps
    23.2         a seedling is set on the empty desk             a celesta sparkle
    26-33        the cat sleeps in the chair                     a faint purr
    26-33.1      lamps switch off one by one                     small switch clicks
    34.0-34.8    the lamps come back on                          clicks, and the rising arpeggio
    12-34        night                                           crickets; the traffic hum sinks
    35-39.5      dawn                                            birdsong; the birds come back to the wire

Seamless by construction: everything is rendered over three cycles (120 s) with every noise built from one 40 s tile
repeated, envelopes periodic, events placed in every cycle, the reverb circular, and the middle cycle cut. FluidSynth
renders the same three-cycle MIDI (its own reverb and chorus off), so note tails cross the seam naturally.

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
BEAT = 60 / 72


def sstep(a, b, x):
    u = np.clip((x - a) / (b - a), 0, 1)
    return u * u * (3 - 2 * u)


def bumpc(x, a, b, c, d):
    """a periodic 0..1..0 envelope on loop time (handles ranges that cross the seam)"""
    out = np.zeros_like(x)
    for k in (-1, 0, 1):
        xx = x + k * D
        out = np.maximum(out, sstep(a, b, xx) * (1 - sstep(c, d, xx)))
    return out


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


NAMES = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def midi(note):
    n, o = note[:-1], int(note[-1])
    return NAMES[n] + 12 * (o + 1)


def hz(note):
    return 440.0 * 2 ** ((midi(note) - 69) / 12)


# the picture's events (loop time)
DOORS = [39.25, 9.0, 16.0, 23.75]
BDOORS = [8.0, 29.7]
DOTS = [19.15, 19.45, 19.75]
ZS = [21.6 + 1.15 * k for k in range(6)]
SEEDLING = 23.2
OFFS = [26.4, 26.8, 27.0, 28.2, 31.4, 32.4, 32.5, 32.55, 32.6]
ONS = [25.8, 26.2, 27.4, 34.0, 34.2, 34.3, 34.5, 34.6, 34.8]
night = np.clip(bumpc(tl, 11.0, 15.0, 32.0, 35.5), 0, 1)
day = 1 - night

# ------------------------------------------------------------------ the street: a distant hum, birds, crickets
fx = np.zeros((2, NT))
hum = circ(lambda x: lp(bp(x, 50, 420, 2), 300, 1), tiled(11)) * 0.05 * (0.35 + 0.65 * day)
swell = 0.75 + 0.25 * np.sin(2 * np.pi * 3 * t_all / D + 0.3) + 0.15 * np.sin(2 * np.pi * 7 * t_all / D + 1.2)
air = circ(lambda x: bp(x, 300, 2400, 2), tiled(12)) * 0.006 * swell
street = hum * swell + air


def chirp(f0, f1, dur, amp, seed, vib=0.0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = f0 + (f1 - f0) * (tt / dur) ** 0.7 + vib * np.sin(2 * np.pi * 38 * tt + r.uniform(0, 6))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.25 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    return s * np.sin(np.pi * tt / dur) ** 1.5 * amp


birds = np.zeros((2, NT))


def warble(t0, amp, seed, pan):
    r = np.random.default_rng(seed)
    t = t0
    for k in range(r.integers(4, 7)):
        f0 = r.uniform(2700, 3700)
        place(birds, t, pans(chirp(f0, f0 * r.uniform(0.8, 1.25), r.uniform(0.05, 0.11), amp * r.uniform(0.6, 1), seed * 10 + k, 120), pan))
        t += r.uniform(0.08, 0.16)


def call(t0, amp, seed, pan):
    place(birds, t0, pans(chirp(3200, 2600, 0.2, amp, seed), pan))
    place(birds, t0 + 0.28, pans(chirp(2800, 2300, 0.26, amp * 0.85, seed + 1), pan))


for c in range(CYC):
    o = c * D
    call(o + 2.6, 0.016, 2, 0.5)            # the birds on the wire, just before they go
    warble(o + 3.3, 0.014, 3, 0.4)
    call(o + 35.4, 0.010, 4, -0.6)          # the first bird of the morning
    warble(o + 36.4, 0.016, 5, 0.5)         # coming back to the wire
    warble(o + 37.6, 0.018, 6, 0.45)
    call(o + 38.6, 0.013, 7, -0.4)
    warble(o + 39.3, 0.012, 8, -0.5)
    warble(o + 0.9, 0.010, 9, 0.6)
birds = circ(lambda x: lp(x, 7000, 2), birds)
# wingbeats as they leave (3.0-5.5) and come back (36.2-38.6)
fu = bumpc(tl, 3.0, 3.3, 4.6, 5.6) + bumpc(tl, 36.2, 36.6, 38.0, 38.7) * 0.8
flut = (0.5 + 0.5 * np.sin(2 * np.pi * 12.0 * t_all)) ** 3
wings = circ(lambda x: bp(x, 500, 3000, 2), tiled(15)[0]) * flut * fu * 0.02
birds += pans(wings, 0.45)
# crickets: little three-pulse chirps, a pair of them answering each other
cr = np.zeros(NT)
for c in range(CYC):
    for k in range(int(D / 0.62)):
        t0 = c * D + k * 0.62 + 0.05 * np.sin(k * 1.7)
        n = int(0.075 * SR)
        tt = np.arange(n) / SR
        pulse = (np.sin(2 * np.pi * 40 * tt) > 0.2) * np.sin(np.pi * tt / 0.075)
        sig = np.sin(2 * np.pi * 4600 * tt) * pulse
        i0 = int(t0 * SR) % NT
        e = min(NT, i0 + n)
        cr[i0:e] += sig[:e - i0]
cr2 = np.roll(cr, int(0.31 * SR)) * 0.7
crickets = np.vstack([cr * 0.006 + cr2 * 0.002, cr * 0.002 + cr2 * 0.006]) * night

# ------------------------------------------------------------------ the studio: bell, doors, clicks, coffee, cat, hammock
def bell(amp, seed):
    n = int(1.4 * SR)
    tt = np.arange(n) / SR
    out = np.zeros(n)
    r = np.random.default_rng(seed)
    for k, (dt, a) in enumerate([(0, 1.0), (0.085, 0.6), (0.2, 0.38), (0.34, 0.2)]):
        f = 2350 * r.uniform(0.985, 1.015)
        tk = tt - dt
        m = tk >= 0
        tone = (np.sin(2 * np.pi * f * tk) + 0.5 * np.sin(2 * np.pi * f * 2.71 * tk) * np.exp(-tk / 0.12) + 0.25 * np.sin(2 * np.pi * f * 5.2 * tk) * np.exp(-tk / 0.05))
        out += np.where(m, tone * np.exp(-np.maximum(tk, 0) / 0.42) * a, 0)
    out[:24] *= np.linspace(0, 1, 24)
    return out * amp


def click(dur, f0, f1, decay, amp, seed, thump=0.0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    tt = np.arange(n) / SR
    s = bp(r.standard_normal(n), f0, f1, 2) * np.exp(-tt / decay)
    if thump:
        s += thump * lp(r.standard_normal(n), 200, 2) * np.exp(-tt / 0.03)
    s[:16] *= np.linspace(0, 1, 16)
    return s * amp


def whoosh(dur, amp, seed):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    tt = np.arange(n) / SR
    env = np.sin(np.pi * np.clip(tt / dur, 0, 1)) ** 2
    return bp(r.standard_normal(n), 600, 3800, 2) * env * amp


for c in range(CYC):
    o = c * D
    for k, e in enumerate(DOORS):
        place(fx, o + e + 0.12, pans(bell(0.05, 20 + k), 0.25))
        place(fx, o + e + 1.62, pans(click(0.12, 200, 1800, 0.02, 0.06, 30 + k, thump=0.5), 0.25))      # it closes
    for k, e in enumerate(BDOORS):
        place(fx, o + e, pans(whoosh(0.6, 0.02, 40 + k), 0.7))
        place(fx, o + e + 1.0, pans(whoosh(0.5, 0.015, 42 + k), 0.7))
        place(fx, o + e + 1.38, pans(click(0.1, 150, 900, 0.02, 0.03, 44 + k, thump=0.4), 0.7))
    for k, e in enumerate(OFFS + ONS):
        place(fx, o + e, pans(click(0.03, 1500, 6000, 0.003, 0.03, 50 + k), -0.3 + 0.08 * (k % 7)))
    # paws
    place(fx, o + 21.05, pans(click(0.08, 120, 900, 0.015, 0.035, 70, thump=0.6), -0.6))
    place(fx, o + 25.75, pans(click(0.08, 120, 900, 0.015, 0.03, 71, thump=0.6), -0.1))
    # the hammock: a flutter of cloth unfurling, a creak as they hop in, creaks while it sways, one more on the way out
    n = int(1.0 * SR)
    tt = np.arange(n) / SR
    flap = bp(np.random.default_rng(72).standard_normal(n), 700, 4500, 2) * np.sin(np.pi * tt / 1.0) * (0.6 + 0.4 * np.sin(2 * np.pi * 17 * tt)) * 0.02
    place(fx, o + 17.8, pans(flap, 0.55))
    for k, (e, a) in enumerate([(19.2, 1.0), (22.1, 0.45), (26.1, 0.4), (29.6, 0.8)]):
        n = int(0.32 * SR)
        tt = np.arange(n) / SR
        f = 540 - 80 * tt / 0.32 + 18 * np.sin(2 * np.pi * 31 * tt)
        sq = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / 0.32) ** 2
        sq += 0.4 * bp(np.random.default_rng(73 + k).standard_normal(n), 800, 2500, 2) * np.sin(np.pi * tt / 0.32)
        place(fx, o + e, pans(sq * 0.012 * a, 0.55))

# coffee: a hiss, a gurgle as it pours
pour = bumpc(tl, 38.4, 38.9, 41.0, 41.8)
hiss = circ(lambda x: bp(x, 2500, 9000, 2), tiled(80)[0]) * 0.012 * pour
gb = np.zeros(NT)
r = np.random.default_rng(81)
for c in range(CYC):
    for k in range(40):
        t0 = c * D + 38.5 + r.uniform(0, 3.0)
        n = int(0.05 * SR)
        tt = np.arange(n) / SR
        f = r.uniform(180, 420)
        i0 = int(t0 * SR) % NT
        e = min(NT, i0 + n)
        gb[i0:e] += (np.sin(2 * np.pi * f * (1 + 2 * tt) * tt) * np.exp(-tt / 0.012))[:e - i0]
gurgle = lp(gb, 1500, 2) * 0.03 * pour
coffee = pans(hiss + gurgle, -0.75)

# the cat purrs in the chair
purr_env = bumpc(tl, 27.0, 28.0, 32.4, 33.2) * (0.6 + 0.4 * np.sin(2 * np.pi * t_all / (D / 18)) ** 2)
pulses = (0.5 + 0.5 * np.sin(2 * np.pi * 26 * t_all)) ** 4
purr = circ(lambda x: lp(x, 320, 2), tiled(90)[0]) * pulses * purr_env * 0.05
studio = fx + coffee + pans(purr, -0.1)

# ------------------------------------------------------------------ the music (FluidSynth)
BOX, GTR, EP, PAD, BASS, VIB, CEL = 0, 1, 2, 3, 4, 5, 6
PROGS = {BOX: 10, GTR: 24, EP: 4, PAD: 49, BASS: 32, VIB: 11, CEL: 8}
NOTES = []   # (time s, channel, note, velocity, length s)


def at(bar, beat):
    return (bar - 1) * 4 * BEAT + (beat - 1) * BEAT


CHORDS = [  # bar: (bass, voicing, arpeggio)
    ('F2', ['A3', 'C4', 'E4'], ['F3', 'C4', 'E4', 'A4', 'C5', 'A4', 'E4', 'C4']),         # 1 Fmaj7     golden
    ('A2', ['G3', 'C4', 'E4'], ['A3', 'E4', 'G4', 'C5', 'E5', 'C5', 'G4', 'E4']),         # 2 Am7
    ('Bb2', ['A3', 'D4', 'F4'], ['Bb3', 'F4', 'A4', 'D5', 'F5', 'D5', 'A4', 'F4']),       # 3 Bbmaj7    the wave back
    ('C3', ['G3', 'C4', 'F4'], ['C4', 'G4', 'C5', 'F5', 'G5', 'F5', 'C5', 'G4']),         # 4 Csus4
    ('D2', ['F3', 'C4', 'E4'], ['D3', 'A3', 'C4', 'F4', 'A4', 'F4', 'C4', 'A3']),         # 5 Dm9
    ('A2', ['G3', 'C4', 'E4'], ['A3', 'E4', 'G4', 'C5', 'E5', 'C5', 'G4', 'E4']),         # 6 Am7       the three dots
    ('Bb2', ['A3', 'D4', 'F4'], ['Bb3', 'F4', 'A4', 'D5', 'F5', 'D5', 'A4', 'F4']),       # 7 Bbmaj7
    ('G2', ['F3', 'Bb3', 'D4'], ['G3', 'D4', 'F4', 'Bb4', 'C5', 'Bb4', 'E4', 'C4']),      # 8 Gm7 / C7  the seedling
    ('F2', ['A3', 'C4', 'E4'], ['F3', 'C4', 'E4', 'A4', 'C5', 'A4', 'E4', 'C4']),         # 9 Fmaj7     the long night
    ('D2', ['F3', 'A3', 'E4'], ['D3', 'A3', 'E4', 'F4', 'A4', 'F4', 'E4', 'A3']),         # 10 Dm9      the dark hour
    ('Bb2', ['A3', 'D4', 'F4'], ['Bb3', 'F4', 'A4', 'D5', 'F5', 'D5', 'A4', 'F4']),       # 11 Bbmaj7   lights come up
    ('C3', ['G3', 'Bb3', 'E4'], ['C4', 'G4', 'Bb4', 'E5', 'G5', 'E5', 'Bb4', 'G4']),      # 12 C7sus → C7
]
DYN = [1.0, 1.0, 0.95, 0.9, 0.88, 0.85, 0.82, 0.8, 0.66, 0.42, 0.62, 0.9]   # thinning through the night
for b, (bass, voic, arp) in enumerate(CHORDS, start=1):
    d = DYN[b - 1]
    NOTES.append((at(b, 1), BASS, bass, int(52 * d), 4 * BEAT * 0.95))
    if b != 10:
        NOTES.append((at(b, 3), BASS, bass, int(38 * d), 2 * BEAT * 0.9))
    for nn in voic:
        NOTES.append((at(b, 1) + 0.02, EP, nn, int(40 * d), 4 * BEAT * 0.98))
        NOTES.append((at(b, 1), PAD, nn, int(30 * (0.7 + 0.6 * (1 - d))), 4 * BEAT * 1.02))
    if b == 10:
        continue                                            # the dark hour: just the chord, held
    for k, nn in enumerate(arp):
        v = int((36 if k % 2 == 0 else 28) * d * (1.1 if k == 0 else 1))
        NOTES.append((at(b, 1) + k * BEAT / 2 + (0.012 if k % 2 else 0), GTR, nn, v, BEAT * 0.9))
# the tune on the music box: (bar, beat, note, beats)
TUNE = [
    (1, 1, 'C6', 1.5), (1, 2.5, 'A5', 0.5), (1, 3, 'G5', 1), (1, 4, 'A5', 1),
    (2, 1, 'E5', 2), (2, 3, 'G5', 1), (2, 4, 'C6', 1),
    (3, 1, 'D6', 1.5), (3, 2.5, 'C6', 0.5), (3, 3, 'A5', 2),
    (4, 1, 'G5', 2.5), (4, 3.5, 'F5', 0.5), (4, 4, 'G5', 1),
    (5, 1, 'F5', 1), (5, 2, 'A5', 1), (5, 3, 'C6', 1.5), (5, 4.5, 'D6', 0.5),
    (6, 1, 'C6', 1.5), (6, 2.5, 'A5', 1.5),                       # beat 4 is left for the three dots
    (7, 1, 'F5', 1.5), (7, 2.5, 'G5', 0.5), (7, 3, 'A5', 1), (7, 4, 'D5', 1),
    (8, 1, 'E5', 2), (8, 3, 'F5', 1), (8, 4, 'G5', 1),
    (9, 1, 'A5', 2), (9, 3, 'C6', 2),
    (11, 3, 'F5', 0.5), (11, 3.5, 'A5', 0.5), (11, 4, 'C6', 0.5), (11, 4.5, 'F6', 1.5),
    (12, 2, 'E6', 1), (12, 3, 'D6', 1), (12, 4, 'Bb5', 1),
]
for bar, beat, nn, ln in TUNE:
    v = int(58 * DYN[bar - 1] + 8)
    NOTES.append((at(bar, beat), BOX, nn, v, ln * BEAT * 1.4))
# the three dots, the zig-zags, the seedling
for k, td in enumerate(DOTS):
    NOTES.append((td + 0.02, BOX, ['E6', 'E6', 'G6'][k], 40, 0.5))
for k, tz in enumerate(ZS):
    NOTES.append((tz + 0.05, VIB, ['C5', 'A4', 'F4', 'A4', 'C5', 'A4'][k], 34 - 2 * k, 1.6))
for k, nn in enumerate(['C6', 'E6', 'G6', 'C7']):
    NOTES.append((SEEDLING + 0.05 + k * 0.11, CEL, nn, 34 - 3 * k, 1.2))
# the lamps coming back on: a small rising sparkle with the clicks
for k, (tt, nn) in enumerate(zip([34.0, 34.3, 34.6, 34.9], ['F5', 'A5', 'C6', 'F6'])):
    NOTES.append((tt + 0.03, CEL, nn, 30 + 2 * k, 1.4))


def write_midi(path, notes, cycles):
    tpq, tempo = 480, 500000
    tps = tpq * 1e6 / tempo
    ev = []
    for ch, prg in PROGS.items():
        ev.append((0, bytes([0xC0 | ch, prg])))
        ev.append((0, bytes([0xB0 | ch, 7, 100])))
        ev.append((0, bytes([0xB0 | ch, 91, 0])))
        ev.append((0, bytes([0xB0 | ch, 93, 0])))
        ev.append((0, bytes([0xB0 | ch, 10, {BOX: 72, GTR: 44, EP: 60, PAD: 64, BASS: 64, VIB: 96, CEL: 80}[ch]])))
    for c in range(cycles):
        for (t, ch, nt_, vel, ln) in notes:
            on = int(round((c * D + t) * tps))
            ev.append((on, bytes([0x90 | ch, midi(nt_), max(1, min(127, vel))])))
            ev.append((on + int(round(ln * tps)), bytes([0x80 | ch, midi(nt_), 0])))
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
    mp, wp = os.path.join(td, 'music.mid'), os.path.join(td, 'music.wav')
    write_midi(mp, NOTES, CYC)
    subprocess.run(['fluidsynth', '-ni', '-q', '-R', '0', '-C', '0', '-g', '0.55', '-r', str(SR), '-F', wp, SF2, mp], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    m, msr = sf.read(wp, always_2d=True)
    assert msr == SR
m = m.T
music = np.zeros((2, NT))
k = min(NT, m.shape[1])
music[:, :k] = m[:, :k]
if m.shape[1] > NT:
    music[:, :m.shape[1] - NT] += m[:, NT:]


# ------------------------------------------------------------------ space and the mix
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


amb = street + birds * 0.9 + crickets
dry = amb + studio * 0.9 + music * 0.75
wet = hall(music * 0.8 + studio * 0.5 + birds * 1.2, 2.6, 9, 3600)
mix = dry * 0.85 + wet * 0.36
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
lines = ['THE LITTLE STUDIO - sound verification (measured on the written score.wav)', '']
lines.append(f'duration: {back_.shape[1]} frames = {back_.shape[1] / sr:.6f} s at {sr} Hz, {back_.shape[0]} ch, PCM_24')
lines.append('events (loop time): door bell ' + ' '.join(f'{x:.2f}' for x in DOORS) + '; glass doors ' + ' '.join(f'{x:.2f}' for x in BDOORS)
             + '; three dots ' + ' '.join(f'{x:.2f}' for x in DOTS) + '; zig-zags ' + ' '.join(f'{x:.2f}' for x in ZS) + f'; seedling {SEEDLING:.2f}'
             + '; lamps off ' + ' '.join(f'{x:.2f}' for x in OFFS) + '; lamps on ' + ' '.join(f'{x:.2f}' for x in ONS))
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
txt = '\n'.join(lines)
print(txt)
open(os.path.join(HERE, 'verification.txt'), 'w').write(txt + '\n')
