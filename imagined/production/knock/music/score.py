#!/usr/bin/env python3
"""THE KNOCK - the sound: a seamless 39.000 s score, synthesised (numpy/scipy) with a few sampled instruments rendered
by FluidSynth (FluidR3_GM) from a MIDI file this script writes itself. Every time comes from the picture's own clock
(timeline.json, dumped from 03-the-knock.js by ../timeline.js).

    t          picture                                           sound
    0.0-0.8    KNOCK KNOCK KNOCK; she flinches, tea slops         three knuckle-raps on wood, the glass rattles; rain; a clock
    1.3-5.4    her face; the shape in the frosted glass grows     a low drone creeps in; two harder knocks at 4.30, 4.60
    5.4-7.0    her breath fogs                                    a heartbeat starts (72 bpm, rising)
    7.0-10.2   arms, fingers drag down the glass                  three scratches on glass; tremolo strings, a cluster
    10.8/11.3  lightning in the garden / thunder                  one rumble (no flash in the sound either)
    12.4-14.4  the handle turns by itself                         a dry metal squeak and rattle
    14.4-17.6  the hall becomes a tunnel                          drone and strings swell to the peak; heart at 120
    17.85      she shuts her eyes                                 everything drops away but the rain and her heart
    18.0-19.4  a breath in, a breath out                          a long breath; the heart slows
    19.4       eyes open                                          one warm low note: D
    20.3-22.1  five steps to the door                             soft sock-steps on boards, a pizzicato pulse, rising
    22.6-23.7  the latch, the door opens                          click; a long creak; the rain comes in loud
    23.8/24.25 the dog                                            two happy barks; the strings resolve to D major
    26.4-29.3  she laughs, the dog licks                          celesta and harp, a little tune; panting; a bark at 28.4
    30.05-30.8 the door closes                                    a soft thud, the latch; the rain is outside again
    31.6-37.8  the words                                          a warm piano melody over strings; the clock again
    37.95      the dog slips out of its flap                      the flap clacks and swings
    37.8-38.8  the neighbour comes back up the path               wellies on wet flags, outside
    39.0 = 0   KNOCK

Seamless by construction: rendered over three cycles with every noise source built from one 39 s tile, events placed
in every cycle, the reverb circular, and the middle cycle cut. FluidSynth renders the same three-cycle MIDI.

    python3 score.py   ->  score.wav (48 kHz / 24-bit / stereo, exactly 39.000 s) and verification.txt
"""
import os, json, struct, subprocess, tempfile
import numpy as np
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
SF2 = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
EV = json.load(open(os.path.join(HERE, 'timeline.json')))
SR = 48000
D = float(EV['D'])
N = int(round(SR * D))
CYC = 3
NT = N * CYC
TARGET_LUFS = -20.0
CEIL_DB = -1.6
rng0 = np.random.default_rng(3)
t_all = np.arange(NT) / SR
tl = np.mod(t_all, D)


def s5(u):
    u = np.clip(u, 0, 1)
    return u * u * u * (u * (u * 6 - 15) + 10)


def ph(t, a, b):
    return np.clip((t - a) / (b - a), 0, 1)


def env(t, a, b, c, d):
    return s5(ph(t, a, b)) * (1 - s5(ph(t, c, d)))


def lp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), 'low')
    return signal.lfilter(b, a, x, axis=-1)


def hp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), 'high')
    return signal.lfilter(b, a, x, axis=-1)


def bp(x, f0, f1, order=2):
    b, a = signal.butter(order, [f0 / (SR / 2), f1 / (SR / 2)], 'band')
    return signal.lfilter(b, a, x, axis=-1)


def circ(fn, x):
    # apply a causal filter as if the signal were periodic (warm it up on the last cycle)
    y = fn(np.concatenate([x[..., -N:], x], axis=-1))
    return y[..., N:]


def tiled(seed, ch=2):
    r = np.random.default_rng(seed)
    tile = r.standard_normal((ch, N))
    return np.tile(tile, (1, CYC))


def place(buf, start, sig, pan=0.0, gain=1.0):
    """add a mono or stereo signal at `start` seconds (loop time) in every cycle"""
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l * 1.414, sig * r * 1.414])
    n = sig.shape[1]
    for c in range(CYC + 1):
        s0 = int(round((c * D + start) * SR))
        a, b = max(0, s0), min(NT, s0 + n)
        if a < b:
            buf[:, a:b] += gain * sig[:, a - s0:b - s0]
    # anything before 0 (negative start) wraps from the end
    s0 = int(round((start - D + CYC * D) * SR))
    return buf


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def adsr(n, a, d, sus, r):
    e = np.ones(n) * sus
    A, Dd, R = int(a * SR), int(d * SR), int(r * SR)
    A = min(A, n)
    e[:A] = np.linspace(0, 1, A, endpoint=False)
    if A + Dd < n:
        e[A:A + Dd] = np.linspace(1, sus, Dd)
    if R > 0 and R < n:
        e[-R:] *= np.linspace(1, 0, R)
    return e


rnd = np.random.default_rng(11)
OUT = {k: np.zeros((2, NT)) for k in ['rain', 'fx', 'drone', 'heart', 'music', 'dog', 'clock']}

# ------------------------------------------------------------------ rain: always there, so the seam sits inside it
noise = tiled(21)
rain = bp(noise, 300, 9000, 2) * 0.5 + lp(noise[::-1].copy(), 900, 2) * 0.25
# open door: louder and brighter; closed: muffled by the house
o0, o1 = EV['open']
c0, c1 = EV['close']
door_open = env(tl, o0, o1, c0 + 0.2, c1)
bright = hp(noise * 0.6, 2500, 2)
rain_g = 0.30 + 0.16 * door_open
OUT['rain'] += rain * rain_g + bright * door_open * 0.1
# drops on the glass: little ticks, scattered (Poisson, from a fixed seed, placed every cycle)
r = np.random.default_rng(31)
for k in range(260):
    t0 = r.uniform(0, D)
    dur = 0.012
    x = tt(dur)
    f = r.uniform(2500, 6500)
    sig = np.sin(2 * np.pi * f * x) * np.exp(-x / 0.0025) * r.uniform(0.02, 0.07)
    place(OUT['rain'], t0, sig, pan=r.uniform(-0.8, 0.8))
# gutter drips (a slow, irregular plink)
for k in range(30):
    t0 = r.uniform(0, D)
    x = tt(0.09)
    f = r.uniform(700, 1100)
    sig = np.sin(2 * np.pi * f * x * (1 + 0.6 * np.exp(-x / 0.01))) * np.exp(-x / 0.02) * 0.05
    place(OUT['rain'], t0, sig, pan=0.6)

# ------------------------------------------------------------------ the clock in the hall (one tick per second, 39 per loop)
calm = 1 - env(tl, 3.0, 6.0, 30.0, 32.5)
tick = np.zeros((2, NT))
for k in range(int(D)):
    x = tt(0.03)
    sig = (np.sin(2 * np.pi * 3200 * x) * 0.6 + np.sin(2 * np.pi * 1900 * x) * 0.4) * np.exp(-x / 0.004) * (0.05 if k % 2 else 0.04)
    place(tick, k + 0.5, sig, pan=-0.3)
OUT['clock'] += tick * (0.25 + 0.75 * calm)


# ------------------------------------------------------------------ knocks: knuckles on a painted wooden door, and its glass
def knock(hard):
    x = tt(0.6)
    modes = [(92, 0.20, 1.0), (151, 0.16, 0.8), (233, 0.12, 0.6), (402, 0.07, 0.4), (688, 0.04, 0.25)]
    body = sum(a * np.sin(2 * np.pi * f * x) * np.exp(-x / dcy) for f, dcy, a in modes)
    click = bp(rnd.standard_normal(len(x)), 1200, 4500) * np.exp(-x / 0.004) * 0.8
    rattle = bp(rnd.standard_normal(len(x)), 2500, 6500) * np.exp(-x / 0.09) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 37 * x))) * 0.18
    s = body * 0.9 + click + rattle
    s *= np.minimum(1, x / 0.0015)
    return s * (1.35 if hard else 1.0)


for k, t0 in enumerate(EV['knocks']):
    place(OUT['fx'], t0 + 0.004, knock(t0 > 4), pan=-0.1, gain=0.55)
# the neighbour's knocks are the loop: nothing else needs to bridge the seam


# ------------------------------------------------------------------ the drone: creeping in, swelling to the tunnel, cut at the shut eyes
def saw(f, ph0=0.0):
    p = np.cumsum(f / SR) + ph0
    return 2 * (p - np.floor(p)) - 1


shut = EV['eyesShut']
grow = (0.12 * env(tl, 1.6, 5.4, shut - 0.05, shut + 0.04) + 0.3 * env(tl, 5.4, 10.2, shut - 0.05, shut + 0.04)
        + 0.3 * env(tl, 10.2, 14.4, shut - 0.05, shut + 0.04) + 0.45 * env(tl, 14.4, 17.2, shut - 0.05, shut + 0.04))
walk_tension = 0.22 * env(tl, EV['steps'][0] - 0.3, EV['grip'], o0 - 0.05, o0 + 0.25)
dr = np.zeros((2, NT))
for (f, pan) in [(55.0, -0.4), (58.27, 0.4), (82.4, -0.2), (87.3, 0.2), (110 * 1.0595 ** 1, 0.0)]:
    v = saw(f * (1 + 0.002 * np.sin(2 * np.pi * tl / D * 3)))
    l, rr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    dr[0] += v * l
    dr[1] += v * rr
# a cutoff that opens with the fear: filter in blocks
cut = 150 + 1600 * (grow + walk_tension) ** 1.4
blk = 2400
y = np.zeros_like(dr)
zi = None
for i in range(0, NT, blk):
    fc = float(np.clip(cut[min(NT - 1, i + blk // 2)], 60, 9000))
    b, a = signal.butter(2, fc / (SR / 2), 'low')
    if zi is None:
        zi = np.zeros((2, max(len(a), len(b)) - 1))
    y[:, i:i + blk], zi = signal.lfilter(b, a, dr[:, i:i + blk], axis=-1, zi=zi)
OUT['drone'] += y * (grow + walk_tension) * 0.32
# glassy, bowed overtones high above it, beating
gl = np.zeros((2, NT))
for (f, pan) in [(1244.5, -0.6), (1318.5, 0.6), (1864.7, -0.2), (1975.5, 0.3)]:
    v = np.sin(2 * np.pi * f * t_all + 2 * np.sin(2 * np.pi * 0.31 * t_all))
    gl[0] += v * np.cos((pan + 1) * np.pi / 4)
    gl[1] += v * np.sin((pan + 1) * np.pi / 4)
OUT['drone'] += gl * (np.clip(grow - 0.2, 0, 1) ** 1.5) * 0.02

# ------------------------------------------------------------------ the heart: 72 bpm rising to 120 at the tunnel, slowing in the breath
bpm = np.where(tl < 5.4, 72, 72 + 48 * s5(ph(tl, 5.4, 17.2)))
bpm = np.where(tl > shut, 120 - 52 * s5(ph(tl, shut, EV['eyesOpen'] + 0.6)), bpm)
bpm = np.where(tl > EV['eyesOpen'] + 0.6, 68 + 30 * s5(ph(tl, 20.0, 22.4)), bpm)
beat_ph = np.cumsum(bpm / 60 / SR)
heart_on = env(tl, 5.2, 5.6, o0 - 0.1, o0 + 0.15)
beats = np.flatnonzero(np.diff(np.floor(beat_ph)) > 0)
hb = np.zeros((2, NT))
x = tt(0.35)
lub = np.sin(2 * np.pi * (52 + 30 * np.exp(-x / 0.02)) * x) * np.exp(-x / 0.06)
dub = np.sin(2 * np.pi * (60 + 30 * np.exp(-x / 0.02)) * x) * np.exp(-x / 0.05) * 0.7
for i in beats:
    for sig, off in [(lub, 0), (dub, int(0.17 * SR))]:
        a, b = i + off, min(NT, i + off + len(sig))
        if a < NT:
            hb[0, a:b] += sig[:b - a]
            hb[1, a:b] += sig[:b - a]
OUT['heart'] += lp(hb, 160, 2) * heart_on * (0.6 + 0.6 * s5(ph(tl, 5.4, 17.2))) * 0.55

# ------------------------------------------------------------------ the scratching (the dog's claws on the glass; to her, fingers)
for (a, b) in EV['scratch']:
    dur = b - a + 0.25
    x = tt(dur)
    n = rnd.standard_normal(len(x))
    stick = (np.sin(2 * np.pi * (35 + 25 * np.sin(2 * np.pi * 3.4 * x)) * x) > 0.2).astype(float)
    sq = bp(n, 1800, 5500) * (0.3 + 0.7 * stick)
    squeal = np.sin(2 * np.pi * np.cumsum(2600 - 900 * x / dur + 200 * np.sin(2 * np.pi * 7 * x)) / SR) * 0.25
    e = adsr(len(x), 0.04, 0.1, 0.8, 0.12) * (0.7 + 0.3 * np.sin(2 * np.pi * 3.4 * x))
    place(OUT['fx'], a, (sq * 0.6 + squeal * 0.5) * e * 0.22, pan=-0.15)

# ------------------------------------------------------------------ thunder: one long rumble after the single soft flash
x = tt(5.0)
th = lp(np.cumsum(rnd.standard_normal(len(x))) * 0.02, 140, 2)
th = th / (np.max(np.abs(th)) + 1e-9)
crack = bp(rnd.standard_normal(len(x)), 300, 2400) * np.exp(-x / 0.25) * 0.35
the = np.minimum(1, x / 0.08) * np.exp(-x / 1.6) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.9 * x) ** 2)
place(OUT['fx'], EV['thunder'], np.stack([(th * 0.9 + crack) * the, (th * 0.9 + crack * 0.7) * the * 0.95]) * 1.5)


# ------------------------------------------------------------------ the handle that turns by itself; the real latch; the door
def squeak(dur, f0, f1, amp):
    x = tt(dur)
    f = f0 + (f1 - f0) * x / dur
    stick = 0.5 + 0.5 * np.sign(np.sin(2 * np.pi * np.cumsum(f / 6) / SR))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * stick + 0.3 * bp(rnd.standard_normal(len(x)), 1500, 6000)
    return s * adsr(len(x), 0.02, 0.05, 0.8, 0.06) * amp


def click(amp, f=2400, dcy=0.006):
    x = tt(0.08)
    return (bp(rnd.standard_normal(len(x)), f * 0.6, f * 1.6) * np.exp(-x / dcy) + 0.4 * np.sin(2 * np.pi * 180 * x) * np.exp(-x / 0.02)) * amp


for k, h in enumerate(EV['handle']):
    place(OUT['fx'], h, squeak(0.28, 900 + 250 * k, 1400 + 250 * k, 0.07), pan=0.25)
    place(OUT['fx'], h + 0.24, click(0.12, 3000), pan=0.25)
place(OUT['fx'], EV['grip'], click(0.1, 2600), pan=0.1)
place(OUT['fx'], EV['latch'], click(0.22, 2000, 0.01), pan=0.1)
# the creak: a slow stick-slip through two wooden formants
x = tt(1.1)
rate = 18 + 60 * x / 1.1 + 15 * np.sin(2 * np.pi * 1.3 * x)
pulses = (np.diff(np.floor(np.cumsum(rate) / SR), prepend=0) > 0).astype(float)
cr = signal.lfilter(*signal.butter(2, [380 / (SR / 2), 700 / (SR / 2)], 'band'), pulses) * 3 + signal.lfilter(*signal.butter(2, [1100 / (SR / 2), 1900 / (SR / 2)], 'band'), pulses) * 2
place(OUT['fx'], o0 + 0.02, cr * adsr(len(x), 0.05, 0.1, 0.9, 0.3) * 0.5, pan=-0.2)
# closing: a soft thud and the latch
x = tt(0.5)
thud = (np.sin(2 * np.pi * 70 * x) * np.exp(-x / 0.08) + 0.3 * lp(rnd.standard_normal(len(x)), 400) * np.exp(-x / 0.04))
place(OUT['fx'], c1 - 0.02, thud * 0.5, pan=-0.1)
place(OUT['fx'], c1 + 0.03, click(0.18, 2200, 0.01), pan=-0.1)
place(OUT['fx'], c0 + 0.05, squeak(0.5, 600, 450, 0.035), pan=-0.2)
# the dog flap: a plastic clack and two smaller ones as it swings
for k, (dt, a) in enumerate([(0.0, 0.16), (0.5, 0.1), (0.95, 0.06), (1.35, 0.035)]):
    place(OUT['fx'], EV['flap'][0] + 0.2 + dt, click(a, 1400, 0.012), pan=-0.05)

# ------------------------------------------------------------------ feet: socks on boards; wellies on wet flags
for k, s0 in enumerate(EV['steps']):
    x = tt(0.25)
    st = lp(rnd.standard_normal(len(x)), 300) * np.exp(-x / 0.03) * 0.5 + np.sin(2 * np.pi * 85 * x) * np.exp(-x / 0.04) * 0.4
    if k == 2:
        sq_ = squeak(0.22, 380, 330, 0.03)
        st[:len(sq_)] += sq_
    place(OUT['fx'], s0, st * 0.35, pan=0.05 * (k - 2))
a0, a1 = EV['arrive']
for k in range(5):
    x = tt(0.2)
    sq = (bp(rnd.standard_normal(len(x)), 300, 1500) * np.exp(-x / 0.05)) * 0.2
    place(OUT['fx'], a0 + 0.15 + k * 0.2, lp(sq, 900) * (0.4 + 0.15 * k), pan=0.3 - 0.1 * k)


# ------------------------------------------------------------------ the dog: happy barks, panting
def bark(f0=560, dur=0.16, amp=0.3):
    x = tt(dur)
    f = f0 * (1 + 0.25 * np.sin(np.pi * x / dur)) * (1 - 0.15 * x / dur)
    ph_ = np.cumsum(f) / SR
    glott = (np.mod(ph_, 1.0) < 0.35).astype(float) - 0.35
    v = glott + 0.25 * rnd.standard_normal(len(x))
    form = (signal.lfilter(*signal.butter(2, [700 / (SR / 2), 1300 / (SR / 2)], 'band'), v) * 1.0
            + signal.lfilter(*signal.butter(2, [1900 / (SR / 2), 2800 / (SR / 2)], 'band'), v) * 0.6
            + signal.lfilter(*signal.butter(2, [3200 / (SR / 2), 4200 / (SR / 2)], 'band'), v) * 0.25)
    e = np.minimum(1, x / 0.008) * np.exp(-np.maximum(0, x - 0.03) / 0.05)
    return form * e * amp


for k, b0 in enumerate(EV['barks']):
    place(OUT['dog'], b0, bark(560 + 40 * k, 0.15, 0.4), pan=-0.1)
    place(OUT['dog'], b0 + 0.17, bark(620 + 30 * k, 0.12, 0.3), pan=-0.1)
for k in range(14):
    x = tt(0.14)
    p = bp(rnd.standard_normal(len(x)), 900, 3500) * np.sin(np.pi * x / 0.14) ** 2 * 0.04
    place(OUT['dog'], 26.5 + k / 3.1, p, pan=0.2)
# a happy whine as she takes him
x = tt(0.5)
wh = np.sin(2 * np.pi * np.cumsum(900 + 400 * np.sin(np.pi * x / 0.5)) / SR) * np.sin(np.pi * x / 0.5) * 0.05
place(OUT['dog'], 25.9, wh, pan=0.2)

# ------------------------------------------------------------------ the music (FluidSynth): strings, piano, celesta, harp, pizzicato
STR, TREM, PNO, CEL, HARP, PIZZ = 0, 1, 2, 3, 4, 5
PROGS = {STR: 49, TREM: 44, PNO: 0, CEL: 8, HARP: 46, PIZZ: 45}
names = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def midi(note):
    n, o = note[:-1], int(note[-1])
    return names[n] + 12 * (o + 1)


NOTES = []   # (t, ch, note, vel, len)
# the spiral: tremolo strings, a cluster that thickens
for (t0, notes, vel, ln) in [(5.4, ['D2', 'A2'], 38, 4.8), (7.2, ['Eb3'], 34, 3.0), (10.2, ['D2', 'Ab2', 'Eb3'], 46, 4.2),
                             (14.4, ['D2', 'Ab2', 'Eb3', 'A3', 'Bb3'], 62, 3.4)]:
    for nn in notes:
        NOTES.append((t0, TREM, nn, vel, ln))
# a crooked music-box figure in the dark (celesta, detuned by the cluster around it)
for k, nn in enumerate(['Bb5', 'A5', 'Eb5', 'D5', 'Ab4']):
    NOTES.append((8.6 + k * 0.55, CEL, nn, 34, 0.5))
for k, nn in enumerate(['Bb5', 'A5', 'Eb5', 'D5', 'Ab4', 'G4']):
    NOTES.append((14.6 + k * 0.42, CEL, nn, 40, 0.4))
# eyes open: one low warm D
NOTES.append((EV['eyesOpen'], PNO, 'D2', 70, 2.4))
NOTES.append((EV['eyesOpen'], STR, 'D3', 36, 2.8))
NOTES.append((EV['eyesOpen'] + 0.4, STR, 'A3', 30, 2.4))
# the walk: a pizzicato pulse on her steps, rising
for k, s0 in enumerate(EV['steps']):
    for nn in [['D3'], ['E3'], ['F#3'], ['G3'], ['A3']][k]:
        NOTES.append((s0, PIZZ, nn, 54 + 4 * k, 0.4))
NOTES.append((EV['grip'], STR, 'A3', 44, 0.5))
NOTES.append((EV['grip'], STR, 'C#4', 40, 0.5))
# the door opens: D major, warm and wide
for nn, v in [('D2', 60), ('A2', 56), ('D3', 58), ('F#3', 54), ('A3', 52), ('E4', 40)]:
    NOTES.append((o0 + 0.15, STR, nn, v, 6.5))
for k, nn in enumerate(['A4', 'D5', 'F#5', 'A5', 'D6']):
    NOTES.append((o0 + 0.3 + k * 0.09, HARP, nn, 58 - k * 3, 1.6))
# the little tune with the dog (celesta and harp), G major turn, back to D
tune = [(23.95, 'F#5'), (24.2, 'A5'), (24.45, 'B5'), (24.7, 'A5'), (25.2, 'F#5'), (25.45, 'E5'), (25.7, 'D5'),
        (26.5, 'D5'), (26.75, 'E5'), (27.0, 'F#5'), (27.25, 'A5'), (27.75, 'G5'), (28.0, 'F#5'), (28.25, 'E5'), (28.75, 'D5')]
for (t0, nn) in tune:
    NOTES.append((t0, CEL, nn, 56, 0.55))
for (t0, chord) in [(26.4, ['G2', 'D3', 'B3']), (27.6, ['A2', 'E3', 'C#4']), (28.7, ['D2', 'A2', 'F#3'])]:
    for nn in chord:
        NOTES.append((t0, STR, nn, 44, 1.4))
NOTES.append((c1, STR, 'D3', 40, 1.5))
NOTES.append((c1, STR, 'A3', 36, 1.5))
# the words: a warm piano melody over soft strings
mel = [(31.7, 'A4', 0.9), (32.6, 'F#4', 0.6), (33.2, 'G4', 0.6), (33.8, 'A4', 1.2), (35.1, 'D5', 0.7), (35.8, 'C#5', 0.6),
       (36.4, 'B4', 0.6), (37.0, 'A4', 1.6)]
for (t0, nn, ln) in mel:
    NOTES.append((t0, PNO, nn, 74, ln))
for (t0, chord, ln) in [(31.6, ['D3', 'A3', 'F#4'], 2.4), (34.0, ['G2', 'D3', 'B3'], 1.6), (35.6, ['A2', 'E3', 'C#4'], 1.4), (37.0, ['D3', 'A3', 'F#4'], 1.6)]:
    for nn in chord:
        NOTES.append((t0, PNO, nn, 50, ln))
for (t0, chord, ln) in [(31.6, ['D3', 'A3'], 2.5), (34.0, ['G3', 'B3'], 1.7), (35.6, ['A3', 'C#4'], 1.5), (37.0, ['D3', 'F#3', 'A3'], 1.8)]:
    for nn in chord:
        NOTES.append((t0, STR, nn, 44, ln))


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
        for (t0, ch, nn, vel, ln) in notes:
            on = int(round((c * D + t0) * tps))
            ev.append((on, bytes([0x90 | ch, midi(nn), vel])))
            ev.append((on + int(round(ln * tps)), bytes([0x80 | ch, midi(nn), 0])))
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
    mp, wp = os.path.join(td, 'm.mid'), os.path.join(td, 'm.wav')
    write_midi(mp, NOTES, CYC)
    subprocess.run(['fluidsynth', '-ni', '-q', '-R', '0', '-C', '0', '-g', '0.6', '-r', str(SR), '-F', wp, SF2, mp], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    m, msr = sf.read(wp, always_2d=True)
    assert msr == SR
m = m.T
k = min(NT, m.shape[1])
OUT['music'][:, :k] += m[:, :k]
if m.shape[1] > NT:
    OUT['music'][:, :m.shape[1] - NT] += m[:, NT:]


# per-stem levels in a few windows (dB RMS, middle cycle), for the mix notes in verification.txt
STEMS = []
for name in OUT:
    row = []
    for (a_, b_) in [(0, 1), (8, 10), (15, 17.5), (18, 19.4), (23.5, 26), (26.5, 29), (32, 37.5)]:
        seg = OUT[name][:, N + int(a_ * SR):N + int(b_ * SR)]
        row.append(f'{10 * np.log10(np.mean(seg ** 2) + 1e-12):6.1f}')
    STEMS.append(f'{name:6s} ' + ' '.join(row))


# ------------------------------------------------------------------ space: a small hall (circular), and the mix
def hall(x, seconds, seed, lpf):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t_ = np.arange(n) / SR
    ir = r.standard_normal((2, n)) * np.exp(-t_ / (seconds / 6.9))
    ir = lp(ir, lpf, 1)
    ir[:, :int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))
    ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
    y = np.zeros_like(x)
    for ch in range(2):
        full = signal.fftconvolve(np.concatenate([x[ch], x[ch]]), ir[ch])[:2 * NT]
        y[ch] = full[NT:2 * NT]
    return y


# in the silence of the shut eyes, the rain is all there is (and her heart)
hush = 1 - 0.75 * env(tl, shut - 0.02, shut + 0.06, EV['eyesOpen'] - 0.1, EV['eyesOpen'] + 0.5)
# the music ducks under the fx at the barks and knocks a little (it is a small house)
dry = (OUT['rain'] * 0.42 + OUT['clock'] * 3.5 + OUT['fx'] * 1.0 + OUT['drone'] * hush + OUT['heart'] + OUT['dog'] * 2.2
       + OUT['music'] * 3.4 * np.maximum(hush, 0.6))
wet = hall(OUT['fx'] * 0.6 + OUT['music'] * 3.0 + OUT['drone'] * 0.4 + OUT['dog'] * 0.8 + OUT['clock'] * 2.0, 1.8, 9, 3000)
mix = dry + wet * 0.32
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
    l_ = -0.691 + 10 * np.log10(ms + 1e-20)
    g = ms[l_ > -70]
    rel = -0.691 + 10 * np.log10(np.mean(g)) - 10
    return -0.691 + 10 * np.log10(np.mean(ms[(l_ > -70) & (l_ > rel)]))


def true_peak_db(x):
    up = signal.resample_poly(np.concatenate([x[:, -2000:], x, x[:, :2000]], axis=1), 4, 1, axis=1)
    return 20 * np.log10(np.max(np.abs(up)) + 1e-20)


# a gentle peak limiter for the loud moments (knocks, thunder), periodic so the seam is untouched
def limit(x, ceil_db):
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    c = 10 ** (ceil_db / 20)
    g = np.minimum(1, c / np.maximum(np.max(np.abs(x), axis=0), 1e-9))
    w = int(0.004 * SR)
    g3 = np.concatenate([g, g, g])
    sm = uniform_filter1d(minimum_filter1d(g3, 2 * w + 1), w)
    return x * sm[len(g):2 * len(g)]


L = lufs(out)
out *= 10 ** ((TARGET_LUFS - L) / 20)
for _ in range(3):
    tp = true_peak_db(out)
    if tp <= CEIL_DB:
        break
    out = limit(out, CEIL_DB - 0.4)
    out *= 10 ** ((TARGET_LUFS - lufs(out)) / 20)
tp = true_peak_db(out)
if tp > CEIL_DB:
    out *= 10 ** ((CEIL_DB - tp) / 20)
L2, tp2 = lufs(out), true_peak_db(out)
path = os.path.join(HERE, 'score.wav')
sf.write(path, out.T, SR, subtype='PCM_24')

# ------------------------------------------------------------------ verification
back_, sr = sf.read(path, always_2d=True)
back_ = back_.T
lines = ['THE KNOCK - sound verification (measured on the written score.wav)', '']
lines.append(f'duration: {back_.shape[1]} frames = {back_.shape[1] / sr:.6f} s at {sr} Hz, {back_.shape[0]} ch, PCM_24')
lines.append('events (loop time, from timeline.json): knocks %s; scratch %s; thunder %.2f; eyes shut %.2f / open %.2f; latch %.2f; open %.2f; barks %s; close %.2f; flap %.2f'
             % (' '.join(f'{x:.2f}' for x in EV['knocks']), ' '.join(f'{a:.2f}-{b:.2f}' for a, b in EV['scratch']), EV['thunder'], shut, EV['eyesOpen'],
                EV['latch'], o0, ' '.join(f'{x:.2f}' for x in EV['barks']), c1, EV['flap'][0]))
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
loc = np.array([np.sum(hpx[:, (N // 2) + k_ * w:(N // 2) + (k_ + 1) * w] ** 2) for k_ in range(-100, 100) if abs(k_) > 2])
lines.append(f'click test (>6 kHz energy, 5 ms windows): seam window {10 * np.log10(seam_e + 1e-30):.1f} dB; surrounding 1 s median {10 * np.log10(np.median(loc) + 1e-30):.1f} dB, max {10 * np.log10(loc.max() + 1e-30):.1f} dB')
ok_seam = seam.max() <= np.percentile(d_all, 99.9) and seam_e <= max(loc.max(), np.percentile(e, 99))
try:
    rr2 = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    summ = [l_.strip() for l_ in rr2.stderr.splitlines() if l_.strip().startswith(('I:', 'LRA:', 'Peak:'))]
    lines.append('ffmpeg ebur128 (single pass, not looped): ' + ' | '.join(summ[-3:]))
except Exception as ex:  # noqa
    lines.append('ffmpeg ebur128 unavailable: ' + str(ex))
lines.append('stem levels before the mix, dB RMS in windows 0-1 | 8-10 | 15-17.5 | 18-19.4 | 23.5-26 | 26.5-29 | 32-37.5 s:')
lines += ['  ' + r for r in STEMS]
lines.append('')
lines.append(('PASS' if ok_seam else 'CHECK') + '  seamless loop: no step or click at the seam beyond ordinary programme content')
lines.append(('PASS' if back_.shape[1] == N else 'FAIL') + f'  exactly {D:.3f} s')
lines.append(('PASS' if tp2 < -1.0 else 'FAIL') + f'  true peak below -1 dBTP ({tp2:.2f})')
txt = '\n'.join(lines)
print(txt)
open(os.path.join(HERE, 'verification.txt'), 'w').write(txt + '\n')
