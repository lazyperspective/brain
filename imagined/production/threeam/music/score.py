#!/usr/bin/env python3
"""3 a.m. (In Imagination, piece 02) - the sound: a seamless 38.000 s score, synthesised with numpy/scipy, with a few
sampled instruments rendered by FluidSynth (FluidR3_GM) from a MIDI file this script writes itself.

It follows the picture's own clock (cues.json, dumped from the piece by ../cues.js):

    t          picture                                       sound
    0.00       THUD downstairs; eyes snap open                a deep thump and a muffled pan clatter, bouncing
    0-38       the night                                      room tone; a clock ticking every second
    1.30       creak; the quilt goes up                       a long floorboard creak
    2.5-17.1   the ink takes the house                        a low dissonant drone swelling, a charcoal scratch that
                                                               follows the ink, whispers, a heartbeat from 3.9 quickening
    3.45/10.9  more creaks; she freezes on the landing        creaks
    6.6-13     tiptoe                                         soft pizzicato on each footfall (a comic, held-breath walk)
    16.55      click... nothing; 16.85 whack; 17.1 ON         click, thwack, click + a warm swell; the drone is cut dead
    17.1-21.4  the beam burns the ink; down the stairs        sizzle and crackle; a creak and a footfall per tread
    21.15      the beam finds... the pan                      a small copper clank, then nothing
    21.85      mrrp                                           a synthesised trill-meow; a purr; a pizzicato blink
    24-34.4    the ink goes up as ash; the light; the words   the light switch; a warm resolve: strings, piano, celesta
    34.4-38    back in bed; the cat curls up, then slips off   music box, the purr; a soft thump as the cat lands... loop

Seamless by construction: three cycles rendered, noise beds tiled, every event placed in every cycle, the reverb
circular, the middle cycle kept. Loudness normalised to -20 LUFS (BS.1770, looped) with a true-peak ceiling of -1.5 dBTP.

    python3 score.py      (numpy, scipy, soundfile; fluidsynth + /usr/share/sounds/sf2/FluidR3_GM.sf2; ffmpeg)
Writes score.wav (48 kHz / 24-bit / stereo, exactly 38.000 s) and verification.txt.
"""
import os, json, struct, subprocess, tempfile
import numpy as np
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
CUES = json.load(open(os.path.join(HERE, 'cues.json')))
T = CUES['T']
SF2 = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
SR = 48000
D = float(CUES['D'])
N = int(round(SR * D))
CYC = 3
NT = N * CYC
TARGET_LUFS = -20.0
CEIL_DB = -1.5
t_all = np.arange(NT) / SR
tl = np.mod(t_all, D)
rng = np.random.default_rng(3)


def sstep(a, b, x):
    u = np.clip((x - a) / (b - a), 0, 1)
    return u * u * (3 - 2 * u)


def place(buf, start, sig):
    """add sig at loop time `start` in every cycle"""
    for c in range(CYC):
        i0 = int(round((start + c * D) * SR)) % NT
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


def reson(x, f, q):
    b, a = signal.iirpeak(f / (SR / 2), q)
    return signal.lfilter(b, a, x, axis=-1)


def pans(sig, pan):
    return np.vstack([sig * np.sqrt(0.5 * (1 - pan)), sig * np.sqrt(0.5 * (1 + pan))])


def penv(points):
    """a periodic envelope over loop time from (t, v) points"""
    p = sorted(points)
    xs = np.array([q[0] for q in p] + [p[0][0] + D])
    ys = np.array([q[1] for q in p] + [p[0][1]])
    return np.interp(tl, xs, ys, period=D)


def tone(f_target, ph0=0.0):
    f = round(f_target * D) / D
    return np.sin(2 * np.pi * f * t_all + ph0)


def env(n, a, d):
    tt = np.arange(n) / SR
    return np.minimum(1, tt / max(a, 1e-4)) * np.exp(-tt / d)


mix_dry = np.zeros((2, NT))
mix_wet = np.zeros((2, NT))   # sent to the room

# ------------------------------------------------------------------ room tone and the clock
room = circ(lambda x: lp(x, 220, 2), tiled(1)) * 0.012 + circ(lambda x: bp(x, 2000, 7000, 1), tiled(2)) * 0.0012
fear = penv([(0, 0), (1.2, 0.05), (2.5, 0.3), (6, 0.45), (10, 0.65), (14, 0.9), (17.05, 1.0), (17.12, 0.35), (20.5, 0.25), (21.3, 0.1),
             (24.0, 0.1), (25.5, 0.0), (37.99, 0.0)])
mix_dry += room * (1 - 0.4 * fear)
for k in range(int(D)):
    n = int(0.03 * SR)
    tt = np.arange(n) / SR
    f = 3100 if k % 2 == 0 else 2650
    tick = np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.004) + 0.4 * np.sin(2 * np.pi * f * 1.51 * tt) * np.exp(-tt / 0.003)
    amp = 0.022 * (1 - 0.85 * float(np.interp(k + 0.5, [0, 1.2, 2.5, 4, 17, 17.3, 24, 25, 38], [1, 1, 0.6, 0.3, 0.1, 0.4, 0.4, 0.7, 1])))
    place(mix_dry, k + 0.5, pans(tick * amp, -0.5))

# ------------------------------------------------------------------ the THUD (and the pan clattering, downstairs)
def thud(at, amp):
    n = int(1.4 * SR)
    tt = np.arange(n) / SR
    f = 38 + 34 * np.exp(-tt / 0.06)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.32) * np.minimum(1, tt / 0.002)
    knock = lp(rng.standard_normal(n), 380, 2) * np.exp(-tt / 0.05) * 1.6
    sig = (body * 0.9 + knock) * amp
    place(mix_dry, at, pans(sig, 0.0))
    place(mix_wet, at, pans(sig * 0.4, 0.0))
    # the saucepan: inharmonic copper partials, muffled by the floor, bouncing and settling
    parts = [(587, 1.0), (1381, 0.6), (2316, 0.42), (3209, 0.25), (897, 0.4)]
    for j, (dt, g) in enumerate([(0.0, 0.7), (0.21, 0.45), (0.36, 0.3), (0.47, 0.2), (0.545, 0.13), (0.6, 0.09), (0.64, 0.07)]):
        m = int(0.9 * SR)
        tm = np.arange(m) / SR
        s = sum(a * np.sin(2 * np.pi * fr * (1 + 0.002 * j) * tm + j) * np.exp(-tm / (0.5 / (1 + i * 0.6))) for i, (fr, a) in enumerate(parts))
        s = lp(s * np.minimum(1, tm / 0.001), 1500, 2) * g * amp * 0.34
        place(mix_dry, at + dt + 0.03, pans(s, 0.2))
        place(mix_wet, at + dt + 0.03, pans(s * 0.8, 0.2))


thud(0.004, 0.5)

# ------------------------------------------------------------------ creaks: friction pulses through wood resonances
def creak(at, dur, f0, f1, amp, pan, seed):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = f0 + (f1 - f0) * (0.5 - 0.5 * np.cos(np.pi * tt / dur)) + 8 * np.sin(2 * np.pi * 3.1 * tt)
    ph = np.cumsum(f * (1 + 0.25 * r.standard_normal(n).cumsum() / np.sqrt(np.arange(1, n + 1)) * 0.2)) / SR
    pulses = (np.diff(np.floor(ph), prepend=0) > 0).astype(float) * (0.6 + 0.4 * r.random(n))
    x = sum(reson(pulses, fr, q) * g for fr, q, g in [(410, 18, 1.0), (730, 22, 0.7), (1240, 25, 0.5), (2150, 30, 0.25)])
    e = np.sin(np.pi * np.clip(tt / dur, 0, 1)) ** 0.6
    sig = x * e * amp
    place(mix_dry, at, pans(sig, pan))
    place(mix_wet, at, pans(sig * 0.7, pan))


creak(T['creak1'], 0.9, 46, 95, 0.55, -0.2, 11)
creak(T['creak2'], 0.7, 60, 38, 0.5, 0.3, 12)
creak(10.85, 0.55, 52, 80, 0.5, 0.0, 13)
for k, t in enumerate(CUES['down']):
    creak(t - 0.02, 0.22 + 0.1 * ((k * 7) % 3) / 2, 70 + 15 * (k % 4), 50 + 10 * (k % 3), 0.18 + 0.06 * (k % 2), 0.3, 40 + k)
for k, t in enumerate(CUES['up']):
    creak(t - 0.02, 0.18, 65 + 10 * (k % 3), 55, 0.08, 0.2, 80 + k)

# footfalls: soft pads
def pad(at, amp, pan, f=140):
    n = int(0.12 * SR)
    tt = np.arange(n) / SR
    s = lp(rng.standard_normal(n), 500, 2) * np.exp(-tt / 0.025) + np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.03) * 0.5
    place(mix_dry, at, pans(s * amp, pan))


for t in CUES['tiptoe']:
    pad(t, 0.05, 0.0)
for t in CUES['down']:
    pad(t, 0.09, 0.3)
for t in CUES['kitchen']:
    pad(t, 0.06, 0.2)
for t in CUES['up']:
    pad(t, 0.05, 0.1)
pad(T['catGone'] - 0.05, 0.12, 0.6, f=110)          # the cat lands on the floor, off the bed

# ------------------------------------------------------------------ the fear: drone, scratch, whispers, heart
on = T['on']
drone_env = penv([(0, 0), (2.4, 0), (4.0, 0.25), (8, 0.45), (12, 0.7), (15.4, 1.0), (on - 0.002, 1.0), (on + 0.03, 0.0), (37.9, 0)])
cut = np.ones(NT)
drone = np.zeros(NT)
for f, a in [(55.0, 1.0), (58.27, 0.8), (82.41, 0.55), (87.31, 0.45), (110.0, 0.3), (116.5, 0.3)]:
    ff = round(f * D) / D
    saw = 2 * ((ff * t_all) % 1.0) - 1
    drone += saw * a
bright = penv([(0, 0.2), (4, 0.2), (15.5, 1.0), (on, 1.0), (on + 0.1, 0.2), (37.9, 0.2)])
drone = circ(lambda x: lp(x, 180, 2), drone) * (1 - bright) + circ(lambda x: lp(x, 900, 2), drone) * bright
drone *= drone_env * 0.05
glass = (tone(1760) + tone(1864.66) * 0.8 + tone(2489.0) * 0.4) * penv([(0, 0), (9, 0), (15.4, 1), (on - 0.01, 1), (on + 0.02, 0), (37.9, 0)]) * 0.004
mix_dry += np.vstack([drone * 0.9 + glass, drone + glass * 0.8])
mix_wet += np.vstack([drone * 0.4, drone * 0.4])

# charcoal scratch: the ink is heard as it is drawn, re-scratched ten times a second (it boils at 10 fps)
scr = circ(lambda x: bp(x, 1800, 6500, 2), tiled(21))
gate = 0.55 + 0.45 * np.abs(np.sin(np.pi * 10 * tl)) ** 0.5
ink_amt = penv([(0, 0), (0.02, 0.9), (0.7, 0.1), (1.3, 0.1), (1.5, 0.5), (2.5, 0.4), (8, 0.55), (14, 0.8), (17.05, 1.0), (17.2, 0.6), (21.3, 0.5), (24, 0.5),
                (25.6, 0.0), (37.9, 0.0)])
mix_dry += scr * gate * ink_amt * 0.022

# whispers: breathy formant noise, sss and hhh, wandering in the stereo field, thicker as the ink thickens
wh = np.zeros((2, NT))
r = np.random.default_rng(31)
t = 4.6
while t < on - 0.4:
    dur = 0.25 + 0.45 * r.random()
    n = int(dur * SR)
    tt = np.arange(n) / SR
    nz = r.standard_normal(n)
    kind = r.random()
    if kind < 0.4:
        s = bp(nz, 4500, 9000, 2)
    else:
        f1, f2 = r.choice([(700, 1200), (400, 2000), (550, 1700), (300, 2300)])
        s = reson(nz, f1, 6) * 0.6 + reson(nz, f2, 8) * 0.5 + bp(nz, 3000, 6000, 1) * 0.3
    e = np.sin(np.pi * tt / dur) ** 2 * (1 + 0.5 * np.sin(2 * np.pi * (4 + 6 * r.random()) * tt))
    lvl = float(np.interp(t, [4.6, 9, 14, on], [0.05, 0.08, 0.12, 0.14]))
    place(wh, t, pans(s * e * lvl, float(r.uniform(-0.9, 0.9))))
    t += float(np.interp(t, [4.6, 10, on], [1.2, 0.6, 0.25])) * (0.6 + 0.8 * r.random())
mix_dry += wh
mix_wet += wh * 1.2

# the heart: lub-dub, felt more than heard
for k, b in enumerate(CUES['beats']):
    u = k / max(1, len(CUES['beats']) - 1)
    for dt, f, g in [(0, 48, 1.0), (0.19, 58, 0.6)]:
        n = int(0.35 * SR)
        tt = np.arange(n) / SR
        s = np.sin(2 * np.pi * f * tt * (1 - 0.15 * tt)) * np.minimum(1, tt / 0.004) * np.exp(-tt / 0.07) + lp(rng.standard_normal(n), 150, 2) * np.exp(-tt / 0.02) * 0.5
        place(mix_dry, b + dt, pans(s * g * (0.22 + 0.2 * u), 0.0))

# ------------------------------------------------------------------ the torch: click, nothing; whack; click, light
def click(at, amp, pan, f=4200):
    n = int(0.05 * SR)
    tt = np.arange(n) / SR
    s = (bp(rng.standard_normal(n), 2000, 8000, 2) * np.exp(-tt / 0.003) + np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.006) * 0.4)
    s2 = np.zeros(int(0.09 * SR)); s2[int(0.035 * SR):int(0.035 * SR) + n] += s * 0.6
    s2[:n] += s
    place(mix_dry, at, pans(s2 * amp, pan))


click(T['click'], 0.4, 0.2)
n = int(0.4 * SR); tt = np.arange(n) / SR
whack = lp(rng.standard_normal(n), 900, 2) * np.exp(-tt / 0.03) * 1.2 + np.sin(2 * np.pi * 180 * tt) * np.exp(-tt / 0.05) * 0.6
rattle = sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.06) for f in (2900, 3700, 4400)) * 0.08 * (tt > 0.02)
place(mix_dry, T['smack'], pans((whack + rattle) * 0.5, 0.15))
click(on - 0.01, 0.45, 0.2, 4600)
n = int(2.2 * SR); tt = np.arange(n) / SR
swell = sum(np.sin(2 * np.pi * f * tt) for f in (293.66, 369.99, 440.0, 587.33)) * (1 - np.exp(-tt / 0.15)) * np.exp(-tt / 0.8) * 0.03
air = bp(rng.standard_normal(n), 3000, 9000, 2) * np.exp(-tt / 0.25) * 0.03
place(mix_dry, on, pans(swell + air, 0.0))
place(mix_wet, on, pans(swell * 2, 0.0))

# the beam burning the ink: sizzle and crackle
burn = penv([(0, 0), (on, 0), (on + 0.15, 1.0), (19, 0.8), (21.2, 0.6), (21.4, 0.9), (23, 0.3), (24.0, 0.7), (25.6, 0), (37.9, 0)])
sizzle = circ(lambda x: bp(x, 5000, 12000, 2), tiled(41)) * 0.02
cr = np.zeros((2, NT))
rr = np.random.default_rng(42)
for i in range(1400):
    at = rr.random() * D
    if burn[int(at * SR)] < 0.05:
        continue
    m = int(0.012 * SR)
    tm = np.arange(m) / SR
    s = rr.standard_normal(m) * np.exp(-tm / (0.0015 + 0.003 * rr.random()))
    place(cr, at, pans(hp(s, 1500, 1) * 0.12 * rr.random(), float(rr.uniform(-0.7, 0.7))))
mix_dry += (sizzle + cr) * burn

# ------------------------------------------------------------------ the pan: a copper clank when the cat shifts
def clank(at, amp, pan):
    m = int(1.6 * SR)
    tm = np.arange(m) / SR
    s = sum(a * np.sin(2 * np.pi * f * tm) * np.exp(-tm / dcy) for f, a, dcy in [(587, 1.0, 0.6), (1381, 0.6, 0.45), (2316, 0.4, 0.3), (3209, 0.25, 0.2), (4870, 0.12, 0.12)])
    s = s * np.minimum(1, tm / 0.0007) + bp(rng.standard_normal(m), 1500, 6000, 1) * np.exp(-tm / 0.01) * 0.5
    place(mix_dry, at, pans(s * amp, pan))
    place(mix_wet, at, pans(s * amp * 0.7, pan))


clank(T['found'] + 0.03, 0.12, -0.2)
clank(T['lift'] + 0.05, 0.06, -0.1)

# ------------------------------------------------------------------ the cat: a trill-meow ("mrrp") and the purr
def mrrp(at, amp, pitch=1.0, dur=0.55):
    m = int(dur * SR)
    tm = np.arange(m) / SR
    u = tm / dur
    f0 = pitch * (430 + 260 * np.sin(np.pi * np.clip(u * 1.2, 0, 1)) - 60 * u)
    ph = 2 * np.pi * np.cumsum(f0) / SR
    src = sum(np.sin(k * ph) / k ** 1.1 for k in range(1, 14))
    trill = 1 - 0.6 * (u < 0.35) * (0.5 + 0.5 * np.sin(2 * np.pi * 27 * tm))           # the rolled r
    f1 = 500 + 500 * np.clip((u - 0.25) * 2, 0, 1) - 300 * np.clip((u - 0.75) * 4, 0, 1)
    out = np.zeros(m)
    for a, b in [(0, m // 3), (m // 3, 2 * m // 3), (2 * m // 3, m)]:
        fm = float(np.mean(f1[a:b]))
        seg = reson(src, fm, 4) * 0.8 + reson(src, fm * 2.4, 5) * 0.5 + reson(src, 3200, 6) * 0.2
        out[a:b] = seg[a:b]
    e = np.minimum(1, tm / 0.03) * np.minimum(1, (dur - tm) / 0.08) * (0.4 + 0.6 * np.sin(np.pi * u) ** 0.5)
    sig = out * e * trill * amp
    place(mix_dry, at, pans(sig, -0.1))
    place(mix_wet, at, pans(sig * 0.5, -0.1))


mrrp(T['mrrp'], 0.28)
mrrp(T['lift'] + 0.1, 0.14, pitch=1.2, dur=0.32)


def purr(t0, t1, amp, pan):
    m = int((t1 - t0) * SR)
    tm = np.arange(m) / SR
    pulse = (0.5 + 0.5 * np.cos(2 * np.pi * 26 * tm)) ** 4
    breath = 0.65 + 0.35 * np.sign(np.sin(2 * np.pi * tm / 1.5)) * 0.6
    s = lp(rng.standard_normal(m), 320, 2) * pulse * breath + np.sin(2 * np.pi * 52 * tm) * pulse * 0.4
    e = np.minimum(1, tm / 0.4) * np.minimum(1, (t1 - t0 - tm) / 0.5)
    place(mix_dry, t0, pans(s * e * amp, pan))


purr(T['mrrp'] + 0.6, T['cut3'] + 0.2, 0.16, -0.1)
purr(T['hold'] - 0.2, T['walk3'] + 0.5, 0.12, -0.2)
purr(T['cut4'], T['catUp'] + 0.1, 0.18, 0.2)

# the light switch
click(T['light'] - 0.02, 0.3, 0.5, 2600)

# ------------------------------------------------------------------ music (FluidSynth): tiptoe pizz, the blink, the resolve, the lullaby
PIZZ, STR, PIANO, CEL, MBOX, CELLO = 0, 1, 2, 3, 4, 5
NOTES = []
scale = ['D3', 'F3', 'A2', 'E3', 'D3', 'C3', 'A2', 'Bb2']
for k, t in enumerate(CUES['tiptoe']):
    NOTES.append((t, PIZZ, scale[k % len(scale)], 52 + (k % 2) * 8, 0.3))
NOTES += [(T['blink'] + 0.15, PIZZ, 'A4', 70, 0.3), (T['blink'] + 0.32, PIZZ, 'D5', 66, 0.3)]
NOTES += [(on + 0.05, CELLO, 'D3', 60, 3.2), (on + 0.05, CELLO, 'A3', 50, 3.2), (on + 1.6, CELLO, 'F3', 54, 2.0)]
# the warm resolve: D major, the quote's two halves on two phrases
R0 = T['cut3'] + 0.4
chords = [(R0, ['D3', 'A3', 'F#4']), (R0 + 2.6, ['B2', 'F#3', 'D4']), (R0 + 5.2, ['G2', 'D3', 'B3']), (R0 + 7.6, ['A2', 'E3', 'C#4']),
          (R0 + 9.6, ['D3', 'A3', 'F#4'])]
for t, ch in chords:
    for nn in ch:
        NOTES.append((t, STR, nn, 46, 2.9))
mel = [(0.4, 'F#5'), (0.9, 'E5'), (1.4, 'D5'), (2.0, 'A5'), (3.0, 'F#5'), (3.5, 'D5'), (4.1, 'E5'), (5.6, 'D5'), (6.1, 'B4'), (6.6, 'D5'),
       (7.2, 'G5'), (8.0, 'E5'), (8.6, 'C#5'), (9.1, 'E5'), (9.9, 'D5')]
for dt, nn in mel:
    NOTES.append((R0 + dt, PIANO, nn, 50, 1.4))
for dt, nn in [(0.2, 'A6'), (2.8, 'F#6'), (5.4, 'D6'), (7.8, 'E6'), (9.9, 'F#6')]:
    NOTES.append((R0 + dt, CEL, nn, 40, 1.6))
lull = [(0.3, 'A5'), (0.8, 'F#5'), (1.3, 'D5'), (2.0, 'E5'), (2.5, 'F#5'), (3.0, 'D5')]
for dt, nn in lull:
    NOTES.append((T['cut4'] + dt, MBOX, nn, 36, 1.2))


def midi(note):
    names = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
    n, o = note[:-1], int(note[-1])
    return names[n] + 12 * (o + 1)


def write_midi(path, notes, cycles):
    tpq, tempo = 480, 500000
    tps = tpq * 1e6 / tempo
    ev = []
    progs = {PIZZ: 45, STR: 49, PIANO: 0, CEL: 8, MBOX: 10, CELLO: 42}
    for ch, prg in progs.items():
        ev.append((0, bytes([0xC0 | ch, prg])))
        ev.append((0, bytes([0xB0 | ch, 7, 100])))
        ev.append((0, bytes([0xB0 | ch, 91, 0])))
        ev.append((0, bytes([0xB0 | ch, 93, 0])))
    for c in range(cycles):
        for (t, ch, nn, vel, ln) in notes:
            onn = int(round((c * D + t) * tps))
            ev.append((onn, bytes([0x90 | ch, midi(nn), vel])))
            ev.append((onn + int(round(ln * tps)), bytes([0x80 | ch, midi(nn), 0])))
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
music = np.zeros((2, NT))
k = min(NT, m.shape[1])
music[:, :k] = m[:, :k]
if m.shape[1] > NT:
    music[:, :m.shape[1] - NT] += m[:, NT:]
resolve = penv([(0, 1.0), (T['cut3'], 1.0), (T['cut3'] + 0.3, 1.8), (T['cut4'] + 3.4, 1.8), (37.9, 1.0)])
mix_dry += music * 0.8 * resolve
mix_wet += music * 0.6 * resolve


# ------------------------------------------------------------------ space, limiting, loudness
def hall(x, seconds, seed, lpf):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    tt = np.arange(n) / SR
    ir = r.standard_normal((2, n)) * np.exp(-tt / (seconds / 6.9))
    ir = lp(ir, lpf, 1)
    ir[:, :int(0.015 * SR)] *= np.linspace(0, 1, int(0.015 * SR))
    ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
    y = np.zeros_like(x)
    for ch in range(2):
        full = signal.fftconvolve(np.concatenate([x[ch], x[ch]]), ir[ch])[:2 * NT]
        y[ch] = full[NT:2 * NT]
    return y


mix = mix_dry + hall(mix_wet, 1.6, 9, 4000) * 0.35
mix = circ(lambda x: hp(x, 25, 2), mix)


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


out = mix[:, N:2 * N].copy()
for it in range(6):
    L = lufs(out)
    out *= 10 ** ((TARGET_LUFS - L) / 20)
    tp = true_peak_db(out)
    if tp <= CEIL_DB:
        break
    # limit the middle cycle in context (circular), then re-measure
    full = np.concatenate([out, out, out], axis=1)
    lim = 10 ** ((CEIL_DB - 0.6) / 20)
    a = np.max(np.abs(full), axis=0)
    need = np.minimum(1, lim / np.maximum(a, 1e-9))
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    g = minimum_filter1d(need, size=int(0.006 * SR) * 2 + 1)
    g = uniform_filter1d(g, size=int(0.004 * SR))
    g = minimum_filter1d(g, size=3)
    out = (full * g)[:, N:2 * N]
L2, tp2 = lufs(out), true_peak_db(out)
path = os.path.join(HERE, 'score.wav')
sf.write(path, out.T, SR, subtype='PCM_24')

# ------------------------------------------------------------------ verification
back_, sr = sf.read(path, always_2d=True)
back_ = back_.T
lines = ['3 A.M. - sound verification (measured on the written score.wav)', '']
lines.append(f'duration: {back_.shape[1]} frames = {back_.shape[1] / sr:.6f} s at {sr} Hz, {back_.shape[0]} ch, PCM_24')
lines.append('events (loop time): thud 0.00, creaks %.2f %.2f 10.85, heartbeats %d from %.2f to %.2f, click %.2f, whack %.2f, torch on %.2f, clank %.2f, mrrp %.2f, light %.2f' % (
    T['creak1'], T['creak2'], len(CUES['beats']), CUES['beats'][0], CUES['beats'][-1], T['click'], T['smack'], on, T['found'] + 0.03, T['mrrp'], T['light']))
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
lines.append(f'click test (>6 kHz energy, 5 ms windows): seam window {10 * np.log10(seam_e + 1e-30):.1f} dB; median {10 * np.log10(np.median(e) + 1e-30):.1f} dB; surrounding 1 s max {10 * np.log10(loc.max() + 1e-30):.1f} dB')
ok_seam = seam.max() <= np.percentile(d_all, 99.9) and seam_e <= max(loc.max(), np.percentile(e, 99))
try:
    rr2 = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    summ = [l.strip() for l in rr2.stderr.splitlines() if l.strip().startswith(('I:', 'LRA:', 'Peak:'))]
    lines.append('ffmpeg ebur128 (single pass, not looped): ' + ' | '.join(summ[-3:]))
except Exception as ex:  # noqa
    lines.append('ffmpeg ebur128 unavailable: ' + str(ex))
lines.append('')
lines.append(('PASS' if ok_seam else 'CHECK') + '  seamless loop: no step or click at the seam beyond ordinary programme content')
lines.append(('PASS' if abs(L2 - TARGET_LUFS) < 0.5 and tp2 < -1.0 else 'CHECK') + f'  loudness {L2:.1f} LUFS, true peak {tp2:.1f} dBTP (target -20 LUFS, < -1 dBTP)')
lines.append(('PASS' if back_.shape[1] == N else 'FAIL') + f'  exactly {D:.3f} s')
txt = '\n'.join(lines)
print(txt)
open(os.path.join(HERE, 'verification.txt'), 'w').write(txt + '\n')
