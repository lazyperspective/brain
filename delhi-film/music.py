"""Original soundtrack for 'Dilli, Inlaid' — synthesised from scratch (numpy/scipy only, no samples).
D Lydian (Yaman colour), 90 BPM, 10.5 bars = 28.000 s. One melodic phrase per bar; every shot
change of the film is a bar line. The tail is folded back onto the head so the file loops.
usage: python3 music.py  ->  out/soundtrack.wav"""
import math
import os
import numpy as np
from scipy.signal import lfilter, fftconvolve, butter, sosfilt
import soundfile as sf

SR = 48000
BPM = 90.
BEAT = 60. / BPM
BAR = 4 * BEAT
STEP = BEAT / 4
T = 28.0
N = int(T * SR)
TAIL = 6 * SR
rng = np.random.default_rng(2026)

dry = np.zeros((N + TAIL, 2))
wet = np.zeros((N + TAIL, 2))


def mf(m):
    return 440. * 2 ** ((m - 69) / 12.)


def put(sig, t, gain=1., pan=0., send=.25):
    i = int(round(t * SR))
    if i < 0:
        sig = sig[-i:]
        i = 0
    n = min(len(sig), N + TAIL - i)
    if n <= 0:
        return
    l, r = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
    s = sig[:n] * gain
    dry[i:i + n, 0] += s * l
    dry[i:i + n, 1] += s * r
    if send:
        wet[i:i + n, 0] += s * l * send
        wet[i:i + n, 1] += s * r * send


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, 'lowpass', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, 'highpass', fs=SR, output='sos'), x)


# ----------------------------------------------------------------------------- instruments
def ks(f, dur, bright=.5, w=.5, seed=0):
    """Karplus-Strong string via an IIR comb (santoor / plucked-string voice)."""
    n = int(dur * SR)
    D = SR / f - (1 - w)
    Ni = int(D)
    d = D - Ni
    g = .996 ** (220. / f * .25 + .75)
    taps = np.convolve([1 - d, d], [w, 1 - w]) * g
    a = np.zeros(Ni + 3)
    a[0] = 1
    a[Ni:Ni + 3] -= taps
    r = np.random.default_rng(seed)
    ex = r.uniform(-1, 1, Ni + 2)
    ex = lfilter([1 - bright * .0 + 0, 0], [1], ex)
    ex = lp(np.concatenate([ex, np.zeros(64)]), 1200 + 9000 * bright, 1)[:Ni + 2]
    x = np.zeros(n)
    x[:len(ex)] = ex
    y = lfilter([1], a, x)
    return y / (np.abs(y).max() + 1e-9)


def lead(f0, dur, vel=1., glide=None, vib=.004):
    """plucked lead with meend (pitch glide): additive, slightly inharmonic, sarod-like."""
    n = int((dur + 1.4) * SR)
    t = np.arange(n) / SR
    f = np.full(n, f0)
    if glide:
        f = f0 + (glide - f0) * np.exp(-t / .05)
    f = f * (1 + vib * np.sin(2 * np.pi * 5.1 * t) * np.clip((t - .22) / .3, 0, 1))
    ph = 2 * np.pi * np.cumsum(f) / SR
    out = np.zeros(n)
    for k in range(1, 15):
        if k * f0 > 9000:
            break
        amp = (1. / k ** 1.05) * (1.5 if k in (2, 3) else 1.) * np.exp(-t * (1.3 + .5 * k)) * (1 + .5 * vel * (k > 4))
        out += amp * np.sin(k * math.sqrt(1 + .00035 * k * k) * ph + .3 * k)
    att = bp(rng.normal(size=n), 1500, 6000) * np.exp(-t / .006) * .5
    out = (out + att) * np.minimum(1, t / .002)
    rel = np.where(t > dur, np.exp(-(t - dur) / .22), 1.)
    return out * rel * vel


def tanpura(f0, dur=5.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    c = 3. + 12. * np.exp(-t / .8)                 # jawari: energy slides down the harmonics
    for k in range(1, 26):
        amp = k ** -.7 * np.exp(-t * (.32 + .025 * k)) * (.22 + np.exp(-((k - c) / 2.8) ** 2)) * (.45 if k == 1 else 1.)
        out += amp * np.sin(2 * np.pi * k * f0 * (1 + .0003 * k) * t + k * 1.7)
    return out * np.minimum(1, t / .04)


def pad(freqs, dur, att=.5, rel=1.6, bright=1.5):
    n = int((dur + rel) * SR)
    t = np.arange(n) / SR
    L = np.zeros(n)
    R = np.zeros(n)
    for f0 in freqs:
        for j, cents in enumerate((-7, 0, 8)):
            f = f0 * 2 ** (cents / 1200.)
            v = np.zeros(n)
            for k in range(1, 9):
                if k * f > 5000:
                    break
                v += np.sin(2 * np.pi * k * f * t + rng.random() * 6.28) / k ** bright
            if j == 0:
                L += v
            elif j == 2:
                R += v
            else:
                L += v * .7
                R += v * .7
    env = np.minimum(1, t / att) ** 1.5 * np.where(t > dur, np.exp(-(t - dur) / (rel / 3)), 1.)
    trem = 1 + .08 * np.sin(2 * np.pi * .75 * t)
    return np.stack([L, R], 1) * (env * trem)[:, None] / (3 * len(freqs))


def put2(sig2, t, gain=1., send=.3):
    i = int(round(t * SR))
    n = min(len(sig2), N + TAIL - i)
    dry[i:i + n] += sig2[:n] * gain
    wet[i:i + n] += sig2[:n] * gain * send


def bass(f0, dur, vel=1.):
    n = int((dur + .25) * SR)
    t = np.arange(n) / SR
    env = np.minimum(1, t / .008) * np.exp(-t / (dur * .9)) * np.where(t > dur, np.exp(-(t - dur) / .06), 1.)
    x = np.sin(2 * np.pi * f0 * t) + .35 * np.sin(4 * np.pi * f0 * t) * np.exp(-t / .2) + .12 * np.sin(6 * np.pi * f0 * t) * np.exp(-t / .1)
    return np.tanh(x * 1.3) * env * vel


def ge(vel=1., bend=0.):
    """bayan-like bass stroke; bend>0 gives the rising 'whoop'."""
    n = int(.5 * SR)
    t = np.arange(n) / SR
    if bend:
        f = 62 + bend * 60 * np.minimum(1, t / .22) ** 1.5
    else:
        f = 54 + 60 * np.exp(-t / .03)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t / (.16 if not bend else .2)) + bp(rng.normal(size=n), 300, 1800) * np.exp(-t / .006) * .25
    return x * vel


def na(vel=1., ring=.07, f0=587.33):
    """dayan-like rim stroke tuned to Sa: near-harmonic ringing modes."""
    n = int((ring * 6 + .05) * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for k, a in ((1, .5), (2, 1.), (3, .7), (4, .28), (5, .16)):
        x += a * np.sin(2 * np.pi * f0 * k * 1.002 ** k * t) * np.exp(-t / (ring * (1.3 if k == 2 else 1) / (1 + .25 * k)))
    x += bp(rng.normal(size=n), 2000, 7000) * np.exp(-t / .003) * .6
    return x * vel * np.minimum(1, t / .0005)


def shaker(vel=1., dec=.022):
    n = int(.12 * SR)
    t = np.arange(n) / SR
    return hp(rng.normal(size=n), 6000) * np.exp(-t / dec) * np.minimum(1, t / .004) * vel


def bell(f0=2093., dur=2.2, vel=1.):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for r_, a, d in ((1., 1., .9), (1.007, .8, .9), (2.76, .5, .5), (5.4, .25, .25), (8.93, .12, .12)):
        x += a * np.sin(2 * np.pi * f0 * r_ * t) * np.exp(-t / d)
    return x * vel * np.minimum(1, t / .001)


def click(pitch, seed):
    """a stone seating in its socket."""
    n = int(.09 * SR)
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    x = bp(r.normal(size=n), 2200, 7500) * np.exp(-t / .0035) * .9
    x += np.sin(2 * np.pi * pitch * t) * np.exp(-t / .018) * .55 + np.sin(2 * np.pi * pitch * 2.76 * t) * np.exp(-t / .008) * .2
    return x


def noise_sweep(dur, f_a, f_b, q=.5, shape=None):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = rng.normal(size=n)
    out = np.zeros(n)
    nb = 24
    for b in range(nb):              # piecewise band-pass sweep
        a, c = b * n // nb, (b + 1) * n // nb
        fc = f_a * (f_b / f_a) ** ((b + .5) / nb)
        seg = bp(x[max(0, a - 2000):c], fc * (1 - q * .5), fc * (1 + q * .5), 1)[-(c - a):]
        w = np.hanning(2 * (c - a))
        out[a:c] += seg
    env = shape(t / dur) if shape else np.sin(np.pi * t / dur) ** 2
    return out * env


# ----------------------------------------------------------------------------- score
D2, A2, D3 = mf(38), mf(45), mf(50)
SC = [62, 64, 66, 68, 69, 71, 73]     # D E F# G# A B C#  (D Lydian)


def bar_t(b):          # b = 1-based bar number
    return (b - 1) * BAR


def score():
    # ---- film timing data: when stones land / lift
    try:
        import city
        sc = city.build_city().finalize()
        TL, CX, TLIFT = sc.TL, sc.cen[:, 0], sc.TLIFT
    except Exception as e:  # pragma: no cover
        print('scene unavailable, using synthetic stone timings', e)
        TL = rng.uniform(5, 153, 8000)
        CX = rng.uniform(0, 1920, 8000)
        TLIFT = rng.uniform(748, 804, 8000)

    # ---- tanpura drone: Pa Sa' Sa' Sa, one string per beat, the whole way through
    nbeats = int(T / BEAT)
    for i in range(0, nbeats):
        f = (A2, D3, D3 * 1.003, D2)[i % 4]
        t = i * BEAT
        tt = t % T
        lvl = .115
        if tt < 2 * BAR:
            lvl = .05 + .05 * tt / (2 * BAR)
        elif tt < 3 * BAR:
            lvl = .10
        elif tt > 24.6:
            lvl = .115 - .065 * (tt - 24.6) / 3.4
        s = tanpura(f)
        put(s, t, lvl * (.8 if i % 4 == 3 else .62), pan=(-.35, .3, -.15, .1)[i % 4], send=.35)

    # ---- THE BUILD (bars 1-2): stones clicking home + santoor shimmer that thickens
    pent = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86]
    sel = np.arange(0, len(TL), 3)
    for j, i in enumerate(sel):
        t = TL[i] / 30.
        pitch = mf(pent[int(np.clip(CX[i] / 1920. * len(pent), 0, len(pent) - 1))] + 12)
        g = .03 + .06 * min(1., t / 5.)
        put(click(pitch, int(i)), t, g * (.6 + .8 * rng.random()), pan=float(np.clip(CX[i] / 960. - 1, -1, 1)) * .8, send=.5)
    arp = [62, 66, 69, 73, 74, 69, 76, 73, 78, 74, 81, 78]
    for stp in range(8, 32):       # second half of bar 1 and all of bar 2, 16ths
        t = stp * STEP
        m = arp[(stp - 8) % len(arp)] + (12 if stp >= 24 else 0)
        v = .05 + .16 * ((stp - 8) / 24.) ** 1.6
        for dt_, det in ((0, 1.), (.012, 1.004)):
            put(ks(mf(m) * det, 1.4, bright=.55 + .3 * (stp - 8) / 24., seed=stp), t + dt_, v, pan=math.sin(stp * 1.9) * .6, send=.6)
    for stp in range(48, 64):      # tremolo run into the hold
        for h in range(2):
            t = bar_t(2) + (stp - 32 - 16 + h * .5) * STEP
            if t < bar_t(2) + 2 * BEAT:
                continue
            m = [74, 76, 78, 81, 78, 81, 83, 86][(stp - 48) // 2 % 8]
            put(ks(mf(m), .8, bright=.8, seed=stp * 2 + h), t, .07 + .09 * (stp - 48) / 16., pan=math.sin(stp) * .7, send=.6)
    put(noise_sweep(2.4, 400, 6000, .7, lambda u: u ** 3), bar_t(3) - 2.4, .16, send=.5)
    put2(pad([mf(50), mf(57), mf(64)], 2 * BAR - .3, att=4.8, rel=1.2), .2, .12)
    for b in (1, 2):
        put(bass(D2, 2.2, .5 + .25 * b), bar_t(b), .05 + .07 * b, send=.1)
    for i in range(8):             # heartbeat frame-drum under the build
        put(ge(.5 + .06 * i), i * BEAT, .035 + .022 * i, send=.2)
        put(shaker(.5), i * BEAT + BEAT / 2, .03 + .012 * i, pan=.4)

    # ---- THE HOLD (bar 3): the bloom
    t3 = bar_t(3)
    put(bass(D2 / 2 * 2, 2.4, 1.), t3, .7, send=.1)
    put(ge(1.), t3, .5, send=.25)
    put(bell(mf(86), 3., 1.), t3, .10, pan=-.3, send=.8)
    put(bell(mf(93), 2.6, 1.), t3 + .02, .06, pan=.4, send=.8)
    put2(pad([mf(50), mf(57), mf(62), mf(66), mf(68), mf(76)], BAR - .2, att=.25, rel=1.5, bright=1.25), t3, .5)
    for i, m in enumerate([62, 66, 69, 74, 78, 81, 86, 81, 78, 74, 69, 66, 69, 74, 78, 81]):
        put(ks(mf(m), 1.6, bright=.75, seed=100 + i), t3 + i * STEP, .16 - .004 * i, pan=math.sin(i * 1.3) * .7, send=.6)
    for (st, du, m, v, gl) in ((0, 4, 78, .8, 76), (4, 2, 80, .7, None), (6, 6, 81, .9, 80), (12, 4, 83, .75, 81)):
        put(lead(mf(m - 12), du * STEP, v, mf(gl - 12) if gl else None), t3 + st * STEP, .40, pan=.05, send=.4)
        put(lead(mf(m), du * STEP, v * .6, mf(gl) if gl else None), t3 + st * STEP, .10, pan=.25, send=.45)
    for i in range(4):
        put(shaker(.7), t3 + i * BEAT + BEAT / 2, .07, pan=.4)
        if i:
            put(ge(.6), t3 + i * BEAT, .22, send=.2)
    # tabla run-up into the tour (last beat and a half)
    fill = [(10, 'na', .5), (11, 'na', .55), (12, 'ge', .7), (12.5, 'na', .5), (13, 'na', .6), (13.5, 'na', .55), (14, 'tin', .8),
            (14.5, 'na', .6), (15, 'na', .75), (15.25, 'na', .6), (15.5, 'na', .85), (15.75, 'na', .7)]
    for st, kind, v in fill:
        t = t3 + st * STEP
        if kind == 'ge':
            put(ge(v, bend=1.), t, .5, send=.2)
        elif kind == 'tin':
            put(na(v, ring=.2, f0=293.66), t, .22, pan=.2, send=.4)
        else:
            put(na(v, ring=.05), t, .2, pan=.2 + .1 * math.sin(st * 9), send=.3)

    # ---- THE TOUR (bars 4-9): one phrase per shot
    chords = {4: ([50, 57, 62, 66, 69, 76], 38), 5: ([50, 56, 59, 64, 68, 71], 38), 6: ([47, 54, 62, 66, 69, 73], 35),
              7: ([45, 57, 61, 64, 66, 73], 33), 8: ([47, 54, 59, 62, 66, 73], 35), 9: ([45, 52, 57, 61, 64, 71], 33)}
    #           (step, dur, midi, vel, glide_from)
    phrases = {4: [(0, 3, 81, 1., 78), (3, 1, 83, .6, None), (4, 2, 81, .8, None), (6, 2, 78, .75, None), (8, 3, 76, .85, 78), (11, 1, 78, .6, None), (12, 4, 81, .8, 80)],
               5: [(0, 3, 83, 1., 81), (3, 1, 85, .6, None), (4, 2, 83, .8, None), (6, 2, 80, .75, None), (8, 2, 81, .85, None), (10, 2, 83, .7, None), (12, 4, 80, .8, 81)],
               6: [(0, 3, 86, 1., 83), (3, 1, 85, .65, None), (4, 2, 83, .8, None), (6, 2, 81, .75, None), (8, 3, 78, .85, 81), (11, 1, 81, .6, None), (12, 4, 85, .85, 83)],
               7: [(0, 3, 88, 1., 85), (3, 1, 86, .65, None), (4, 2, 85, .8, None), (6, 2, 83, .75, None), (8, 2, 81, .8, None), (10, 2, 83, .7, None), (12, 4, 85, .8, 86)],
               8: [(0, 2, 90, 1., 88), (2, 2, 88, .75, None), (4, 2, 86, .8, None), (6, 2, 85, .75, None), (8, 3, 83, .85, 85), (11, 1, 81, .6, None), (12, 4, 78, .8, 81)],
               9: [(0, 3, 80, .9, 78), (3, 1, 81, .6, None), (4, 2, 83, .8, None), (6, 2, 85, .8, None), (8, 2, 86, .9, 85), (10, 2, 85, .75, None), (12, 2, 83, .8, None), (14, 2, 81, .85, 83)]}
    GE = [0, 6, 10]
    NA = [2, 5, 7, 11, 13, 14]
    TIN = [4, 12]
    for b in range(4, 10):
        t0 = bar_t(b)
        ch, root = chords[b]
        put2(pad([mf(m) for m in ch], BAR - .15, att=.12, rel=1.0, bright=1.25), t0, .27)
        for st in GE:
            put(bass(mf(root), (5 if st == 0 else 3) * STEP, 1. if st == 0 else .75), t0 + st * STEP, .52, send=.05)
            put(ge(1. if st == 0 else .7), t0 + st * STEP, .46, send=.15)
        for st in NA:
            put(na(.5 + .3 * ((st * 7) % 3) / 2, ring=.05), t0 + st * STEP, .21, pan=.25, send=.3)
        for st in TIN:
            put(na(.8, ring=.16, f0=293.66), t0 + st * STEP, .22, pan=-.2, send=.4)
            put(shaker(1., .05), t0 + st * STEP, .09, pan=-.3, send=.3)
        if b in (5, 7, 9):
            put(ge(.8, bend=.8), t0 + 14 * STEP, .4, send=.2)
        for st in range(16):
            put(shaker(.5 + .5 * (st % 4 == 2) + .2 * (st % 2 == 0), .016 + .012 * (st % 4 == 2)), t0 + st * STEP + (.012 if st % 2 else 0), .10, pan=.45, send=.15)
        for st in range(16):       # santoor counter-line on chord tones
            if st in (0, 4, 8, 12):
                continue
            m = ch[2 + (st * 5 + b) % 4] + 12
            put(ks(mf(m), .9, bright=.7, seed=b * 100 + st), t0 + st * STEP, .085, pan=math.sin(st * 2.1 + b) * .75, send=.6)
        for (st, du, m, v, gl) in phrases[b]:
            put(lead(mf(m - 12), du * STEP, v, mf(gl - 12) if gl else None), t0 + st * STEP, .50, pan=.04 * (-1) ** st, send=.38)
            put(lead(mf(m), du * STEP, v * .6, mf(gl) if gl else None), t0 + st * STEP, .13, pan=.25, send=.45)
        # the downbeat that lands each shot + the whoosh of the glide into it
        put(bell(mf(86 if b % 2 == 0 else 81), 2.2, 1.), t0, .075, pan=(-1) ** b * .35, send=.8)
        put(noise_sweep(.42, 900, 5200, .9, lambda u: u ** 2.2 * (1 - u) ** .3 * 2.2), t0 - .40, .10, pan=0, send=.4)

    # ---- THE ENDING (bars 10-11.5): tonic, the wind that lifts the stones, back to the bare drone
    t10 = bar_t(10)
    put(noise_sweep(.42, 900, 5200, .9, lambda u: u ** 2.2 * (1 - u) ** .3 * 2.2), t10 - .40, .10, send=.4)
    put(bass(D2, 3.2, 1.), t10, .62, send=.1)
    put(ge(1.), t10, .45, send=.25)
    put(na(.9, ring=.2, f0=293.66), t10, .22, pan=-.2, send=.5)
    put(shaker(1., .05), t10, .1, pan=.4, send=.3)
    put(bell(mf(86), 3.4, 1.), t10, .10, pan=-.3, send=.9)
    put(bell(mf(81), 3.0, 1.), t10 + STEP, .05, pan=.4, send=.9)
    put2(pad([mf(50), mf(57), mf(62), mf(66), mf(69), mf(76)], 3.0, att=.15, rel=2.4, bright=1.4), t10, .36)
    put(lead(mf(74), 8 * STEP, 1., mf(73)), t10, .46, send=.5)
    put(lead(mf(86), 8 * STEP, .6, mf(85)), t10, .13, pan=.25, send=.5)
    for i, m in enumerate([86, 81, 78, 74, 69, 66, 62, 57, 62, 66, 69, 74]):
        put(ks(mf(m), 1.8, bright=.6, seed=900 + i), t10 + (2 + i) * STEP, .13 * (1 - i / 16.), pan=math.sin(i * 1.3) * .7, send=.7)
    for st in (4, 8, 12):
        put(na(.6, ring=.16, f0=293.66), t10 + st * STEP, .10 * (1 - st / 20.), pan=-.2, send=.5)
    for st in range(0, 16, 2):
        put(shaker(.6), t10 + st * STEP, .05 * (1 - st / 16.), pan=.45)
    # wind: follows the lift-off (film frames ~748-830 = 24.9-27.7 s)
    put(noise_sweep(3.3, 500, 2600, 1.1, lambda u: np.sin(np.pi * np.clip(u, 0, 1) ** .8) ** 1.5), 24.6, .16, pan=0, send=.5)
    put(hp(noise_sweep(3.0, 1800, 7000, 1.0, lambda u: np.sin(np.pi * u) ** 2), 1500), 24.9, .05, pan=.3, send=.5)
    sel = np.arange(1, len(TLIFT), 5)
    for i in sel:
        t = TLIFT[i] / 30.
        pitch = mf(pent[int(np.clip(CX[i] / 1920. * len(pent), 0, len(pent) - 1))] + 12)
        put(click(pitch, int(i) + 7) * .8, t, .03 * (.5 + rng.random()), pan=float(np.clip(CX[i] / 960. - 1, -1, 1)) * .8, send=.6)


def reverb_ir(dur=2.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    for c in range(2):
        x = np.random.default_rng(40 + c).normal(size=n)
        lo = lp(x, 1400)
        ir[:, c] = (x * np.exp(-t / .28) * .55 + lo * np.exp(-t / .62) * 1.6) * np.minimum(1, t / .012)
        ir[:int(.004 * SR), c] = 0
    return ir / np.sqrt((ir ** 2).sum(0)).max()


def k_weight(x):
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, -1.99004745483398, 0.99007225036621]
    return lfilter(b2, a2, lfilter(b1, a1, x, axis=0), axis=0)


def lufs(x):
    y = k_weight(x)
    blk, hop = int(.4 * SR), int(.1 * SR)
    ms = np.array([(y[i:i + blk] ** 2).mean(0).sum() for i in range(0, len(y) - blk + 1, hop)])
    L = -0.691 + 10 * np.log10(ms + 1e-12)
    ms = ms[L > -70]
    g = -0.691 + 10 * np.log10(ms.mean()) - 10
    L2 = -0.691 + 10 * np.log10(ms + 1e-12)
    return -0.691 + 10 * np.log10(ms[L2 > g].mean())


def main():
    score()
    ir = reverb_ir()
    w = np.stack([fftconvolve(wet[:, c], ir[:, c])[:N + TAIL] for c in range(2)], 1)
    mix = dry + w * .9
    out = mix[:N].copy()
    out[:TAIL] += mix[N:N + TAIL]            # fold the tail onto the head: seamless loop
    out = hp(np.concatenate([out, out], 0).T, 28).T[N:]     # circular steady state keeps the loop seam clean
    air = hp(np.concatenate([out, out], 0).T, 4500, 1).T[N:]
    out = out + .45 * air                                    # a little air on top
    # master: gentle glue, then loudness
    pk = np.abs(out).max()
    out = np.tanh(out / pk * 1.15) / np.tanh(1.15)
    target = -16.0
    for _ in range(6):
        l = lufs(out)
        out *= 10 ** ((target - l) / 20.)
        peak = np.abs(out).max()
        lim = 10 ** (-1.2 / 20.)
        if peak <= lim:
            break
        out = np.tanh(out / lim * .9) * lim / np.tanh(.9 * peak / lim) * (peak / lim) / (peak / lim)   # soft clip to ceiling
        out = np.clip(out, -lim, lim)
    print('integrated loudness %.2f LUFS, peak %.2f dBFS' % (lufs(out), 20 * np.log10(np.abs(out).max())))
    os.makedirs('out', exist_ok=True)
    sf.write('out/soundtrack.wav', out, SR, subtype='PCM_24')


if __name__ == '__main__':
    main()
