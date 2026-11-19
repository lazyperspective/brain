#!/usr/bin/env python3
"""Original procedural soundtrack for the film - every sample is synthesised here (numpy only,
no recordings, no sample libraries).

One bar = one shot: 72 BPM in 4/4, so a bar lasts 3.3333 s = exactly 100 frames at 30 fps.

    bar  1      the world builds: a breath of pad, one soft pluck as each tile starts, pencil + water
    bar  2      the finished map holds: the pad swells, a pickup leads into the tour
    bars 3-6    tour, phrase A: the theme               D   | Bm | G   | A
    bars 7-10   tour, phrase B: the theme climbs        D/F#| G  | Em7 | A
    bars 11-14  tour, phrase C: full, in thirds         Bm  | G  | D/A | A
    bar  15     home again (the last close-up): held dominant
    bar  16+    the whole world: D major, resolved, ringing out to silence

Run:  python soundtrack.py            -> out/soundtrack.wav, out/soundtrack_analysis.png, printed level report
"""
import math
import os
import sys
import wave

import numpy as np
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from wonders import timeline as TL          # noqa: E402

SR = 48000
BPM = 72.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
assert abs(BAR - TL.BAR / TL.FPS) < 1e-9, 'a bar must equal one shot'
DUR = TL.DURATION
N = int(round(DUR * SR))
rng = np.random.default_rng(11)

L = np.zeros(N + SR * 4)
R = np.zeros(N + SR * 4)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def add(sig, t0, pan=0.0, gain=1.0):
    i = int(round(t0 * SR))
    if i < 0:
        sig = sig[-i:]
        i = 0
    n = min(len(sig), len(L) - i)
    a = math.sqrt(0.5 * (1 - pan))
    b = math.sqrt(0.5 * (1 + pan))
    L[i:i + n] += sig[:n] * gain * a * 1.4142
    R[i:i + n] += sig[:n] * gain * b * 1.4142


def env_adsr(n, a, d, s, r):
    e = np.ones(n) * s
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    na = max(1, min(na, n))
    e[:na] = np.linspace(0, 1, na) ** 0.7
    nd = max(1, min(nd, n - na))
    e[na:na + nd] = 1 + (s - 1) * (1 - np.exp(-4 * np.linspace(0, 1, nd))) / (1 - math.exp(-4))
    nr = max(1, min(nr, n))
    e[-nr:] *= np.cos(np.linspace(0, math.pi / 2, nr)) ** 2
    return e


# ------------------------------------------------------------- instruments ----
def pluck(m, dur=1.4, bright=1.0):
    """kalimba / marimba: fast attack, harmonics that die quicker than the fundamental"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = mtof(m)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 3.2)
    s += 0.42 * bright * np.sin(2 * np.pi * f * 2 * t + 0.3) * np.exp(-t * 6.5)
    s += 0.30 * bright * np.sin(2 * np.pi * f * 4.02 * t) * np.exp(-t * 14)
    s += 0.10 * bright * np.sin(2 * np.pi * f * 9.1 * t) * np.exp(-t * 40)
    s *= np.minimum(1.0, t / 0.003)
    return s


def bell(m, dur=2.6):
    """glockenspiel for the bar lines and the glints"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = mtof(m)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 2.4)
    s += 0.5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 5.0)
    s += 0.25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 9.0)
    return s * np.minimum(1.0, t / 0.002)


def flute(m, dur, vib=0.006, breath=0.05):
    """the melody voice: a warm whistle with delayed vibrato and a little air"""
    n = int((dur + 0.25) * SR)
    t = np.arange(n) / SR
    f = mtof(m)
    v = vib * np.minimum(1.0, np.maximum(0.0, (t - 0.18) / 0.3)) * np.sin(2 * np.pi * 5.1 * t)
    ph = 2 * np.pi * np.cumsum(f * (1 + v)) / SR
    s = np.sin(ph) + 0.36 * np.sin(2 * ph + 0.4) + 0.18 * np.sin(3 * ph) + 0.09 * np.sin(4 * ph) + 0.05 * np.sin(5 * ph)
    air = rng.standard_normal(n)
    b, a = signal.butter(2, [f * 1.5 / (SR / 2), min(0.95, f * 4 / (SR / 2))], 'band')
    s += breath * signal.lfilter(b, a, air) * 6
    return s * env_adsr(n, 0.045, 0.2, 0.82, 0.22)


def pad(ms, dur, bright=0.5):
    """slow strings-like pad: stacked, slightly detuned partials; returns (left, right)"""
    n = int((dur + 1.2) * SR)
    t = np.arange(n) / SR
    outL = np.zeros(n)
    outR = np.zeros(n)
    for m in ms:
        f = mtof(m)
        for det, pan in ((-0.004, -0.6), (0.0, 0.0), (0.0045, 0.6)):
            ph = rng.uniform(0, 6.28)
            s = np.zeros(n)
            for h, amp in ((1, 1.0), (2, 0.45 * bright), (3, 0.3 * bright), (4, 0.14 * bright), (5, 0.08 * bright), (6, 0.04 * bright)):
                s += amp * np.sin(2 * np.pi * f * (1 + det) * h * t + ph * h)
            s *= 1 + 0.06 * np.sin(2 * np.pi * 0.31 * t + ph)
            outL += s * (0.5 - 0.5 * pan)
            outR += s * (0.5 + 0.5 * pan)
    e = env_adsr(n, 0.9, 0.5, 0.9, 1.3)
    k = 1.0 / (len(ms) * 2.2)
    return outL * e * k, outR * e * k


def celesta(m, dur=1.6):
    """glassy and bright: the sparkle on top of the arpeggio"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = mtof(m)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 4.0)
    s += 0.55 * np.sin(2 * np.pi * f * 3.0 * t) * np.exp(-t * 7.0)
    s += 0.35 * np.sin(2 * np.pi * f * 5.04 * t) * np.exp(-t * 11.0)
    s += 0.22 * np.sin(2 * np.pi * f * 8.1 * t) * np.exp(-t * 18.0)
    return s * np.minimum(1.0, t / 0.0015)


def hat(open_=False):
    n = int((0.16 if open_ else 0.05) * SR)
    b, a = signal.butter(2, 6500 / (SR / 2), 'high')
    s = signal.lfilter(b, a, rng.standard_normal(n))
    t = np.arange(n) / SR
    return s * np.exp(-t * (22 if open_ else 80)) * np.minimum(1.0, t / 0.001)


def shimmer(ms, dur):
    """high strings: a bright, slowly trembling halo two octaves up; returns (left, right)"""
    n = int((dur + 1.0) * SR)
    t = np.arange(n) / SR
    outL = np.zeros(n)
    outR = np.zeros(n)
    for m in ms:
        f = mtof(m + 24)
        for det, pan in ((-0.003, -0.8), (0.003, 0.8)):
            ph = rng.uniform(0, 6.28)
            trem = 1 + 0.35 * np.sin(2 * np.pi * rng.uniform(5.0, 6.5) * t + ph)
            sg = np.zeros(n)
            for hh, amp in ((1, 1.0), (2, 0.6), (3, 0.45), (4, 0.3), (5, 0.2), (7, 0.1)):
                if f * hh < 15000:
                    sg += amp * np.sin(2 * np.pi * f * (1 + det) * hh * t + ph * hh)
            sg *= trem
            outL += sg * (0.5 - 0.5 * pan)
            outR += sg * (0.5 + 0.5 * pan)
    e = env_adsr(n, 0.7, 0.4, 0.9, 1.0)
    k = 1.0 / (len(ms) * 3.0)
    return outL * e * k, outR * e * k


def whoosh(dur, direction=1.0):
    """the camera's swoop: air that rises as it pulls out and flies, and closes as it lands; returns (L, R)"""
    n = int(dur * SR)
    x = np.linspace(0, 1, n)
    w = rng.standard_normal(n)
    layers = []
    for (lo, hi, centre, width, g) in ((250, 900, 0.30, 0.30, 0.9), (900, 2800, 0.50, 0.26, 1.0), (2800, 7000, 0.66, 0.2, 0.8), (7000, 13000, 0.76, 0.14, 0.5)):
        b, a = signal.butter(2, [lo / (SR / 2), hi / (SR / 2)], 'band')
        layers.append(signal.lfilter(b, a, w) * np.exp(-((x - centre) / width) ** 2) * g)
    sg = np.sum(layers, axis=0) * np.sin(np.pi * np.clip(x * 1.02, 0, 1)) ** 0.8
    pan = direction * (-0.7 + 1.4 * x)
    return sg * np.sqrt(0.5 * (1 - pan)), sg * np.sqrt(0.5 * (1 + pan))


def bass(m, dur):
    n = int((dur + 0.1) * SR)
    t = np.arange(n) / SR
    f = mtof(m)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 3) + 0.12 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 6)
    return s * env_adsr(n, 0.012, 0.25, 0.7, 0.12)


def kick():
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    f = 46 + 70 * np.exp(-t * 32)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 13)
    return s * np.minimum(1.0, t / 0.002)


def noise_band(dur, lo, hi):
    n = int(dur * SR)
    b, a = signal.butter(2, [lo / (SR / 2), hi / (SR / 2)], 'band')
    return signal.lfilter(b, a, rng.standard_normal(n))


def shaker(dur=0.09, acc=1.0):
    s = noise_band(dur, 4500, 11000)
    t = np.arange(len(s)) / SR
    return s * np.exp(-t * 55) * np.minimum(1.0, t / 0.004) * acc


def brush():
    s = noise_band(0.22, 1400, 6500)
    t = np.arange(len(s)) / SR
    return s * (np.exp(-t * 26) + 0.25 * np.exp(-t * 9)) * np.minimum(1.0, t / 0.002)


def swell(dur, lo=1500, hi=9000):
    """reverse-cymbal breath into a cut"""
    s = noise_band(dur, lo, hi)
    t = np.linspace(0, 1, len(s))
    return s * t ** 3


def pencil(dur=0.22):
    """a pencil stroke: scratchy band-passed noise with a little tooth"""
    s = noise_band(dur, 2200, 7000)
    t = np.arange(len(s)) / SR
    tooth = 0.6 + 0.4 * np.sin(2 * np.pi * 38 * t + rng.uniform(0, 6))
    return s * tooth * np.sin(np.pi * t / dur) ** 0.6


def water(dur):
    s = noise_band(dur, 350, 2600)
    t = np.linspace(0, 1, len(s))
    wob = 0.7 + 0.3 * np.sin(2 * np.pi * 2.3 * t * dur + rng.uniform(0, 6))
    return s * wob * np.sin(np.pi * t) ** 1.2


# ----------------------------------------------------------------- harmony ----
D2, E2, Fs2, G2, A2, B2 = 38, 40, 42, 43, 45, 47
CH = {
    'D':    (D2,  [50, 57, 62, 66, 69],     [62, 66, 69, 74, 78]),
    'Dadd9': (D2, [50, 57, 64, 66, 69],     [62, 64, 69, 74, 76]),
    'Bm':   (B2 - 12, [47, 54, 59, 62, 66], [59, 62, 66, 71, 74]),
    'G':    (G2,  [43, 50, 59, 62, 67],     [59, 62, 67, 71, 74]),
    'A':    (A2,  [45, 52, 57, 61, 64],     [57, 61, 64, 69, 73]),
    'D/F#': (Fs2, [42, 50, 57, 62, 66],     [62, 66, 69, 74, 78]),
    'Em7':  (E2,  [40, 47, 55, 59, 62],     [59, 62, 64, 67, 71]),
    'D/A':  (A2,  [45, 50, 57, 62, 66],     [62, 66, 69, 74, 78]),
    'Asus': (A2,  [45, 52, 57, 62, 64],     [57, 62, 64, 69, 74]),
    'A7':   (A2,  [45, 52, 55, 61, 64],     [57, 61, 64, 67, 73]),
}
# bar number (1-based) -> [(chord, beats)]
PROG = {1: [('Dadd9', 4)], 2: [('G', 2), ('Asus', 2)],
        3: [('D', 4)], 4: [('Bm', 4)], 5: [('G', 4)], 6: [('A', 4)],
        7: [('D/F#', 4)], 8: [('G', 4)], 9: [('Em7', 4)], 10: [('A', 4)],
        11: [('Bm', 4)], 12: [('G', 4)], 13: [('D/A', 4)], 14: [('A', 4)],
        15: [('Asus', 2), ('A7', 2)], 16: [('D', 6)]}
# how full each bar is (0..1): light during construction, swelling into the hold, carrying the tour
ENERGY = {1: 0.22, 2: 0.5, 3: 0.62, 4: 0.64, 5: 0.66, 6: 0.7, 7: 0.76, 8: 0.78, 9: 0.8, 10: 0.86,
          11: 0.96, 12: 1.0, 13: 1.0, 14: 0.96, 15: 0.7, 16: 0.9}

# melody: bar -> [(beat, beats, midi)]
Fs4, G4, A4, B4, Cs5, D5, E5, Fs5, G5, A5 = 66, 67, 69, 71, 73, 74, 76, 78, 79, 81
MEL = {
    2: [(3.0, 0.5, 62), (3.5, 0.5, 64)],
    3: [(0, 1, Fs4), (1, 0.5, A4), (1.5, 1.5, D5), (3, 1, B4)],
    4: [(0, 1.5, A4), (1.5, 0.5, B4), (2, 2, Fs4)],
    5: [(0, 1, G4), (1, 0.5, B4), (1.5, 1.5, D5), (3, 1, E5)],
    6: [(0, 2, Cs5), (2, 1, B4), (3, 1, A4)],
    7: [(0, 1, A4), (1, 0.5, D5), (1.5, 1.5, Fs5), (3, 1, E5)],
    8: [(0, 1.5, D5), (1.5, 0.5, E5), (2, 2, B4)],
    9: [(0, 1, G4), (1, 0.5, B4), (1.5, 1.5, E5), (3, 1, D5)],
    10: [(0, 1.5, Cs5), (1.5, 0.5, D5), (2, 1, E5), (3, 1, A5)],
    11: [(0, 1.5, Fs5), (1.5, 0.5, E5), (2, 1, D5), (3, 1, Fs5)],
    12: [(0, 1.5, G5), (1.5, 0.5, Fs5), (2, 2, D5)],
    13: [(0, 1, Fs5), (1, 1, A5), (2, 1.5, Fs5), (3.5, 0.5, E5)],
    14: [(0, 2, E5), (2, 1, Cs5), (3, 1, E5)],
    15: [(0, 2, D5), (2, 1.5, Cs5), (3.5, 0.5, E5)],
    16: [(0, 5.2, D5)],
}
HARM = {11: -3, 12: -4, 13: -3, 14: -3, 16: 4}      # a second voice in thirds through the climax; a third above at the end


def bar_t(b, beat=0.0):
    return (b - 1) * BAR + beat * BEAT


# ------------------------------------------------------------------- score ----
for b in range(1, 17):
    en = ENERGY[b]
    beat0 = 0.0
    for name, beats in PROG[b]:
        root, pad_ms, arp = CH[name]
        t0 = bar_t(b, beat0)
        dur = beats * BEAT
        # pad
        pl, pr_ = pad(pad_ms, dur + (0.5 if b == 1 else 0.0), bright=0.35 + 0.5 * en)
        g = 0.16 + 0.34 * en
        if b == 2:
            # the hold: the pad opens up under the finished map, a crescendo into the first cut
            ramp = np.linspace(0.0, 1.0, len(pl)) ** 1.5
            hl, hr = pad([m + 12 for m in pad_ms[1:]], dur, bright=0.9)
            pl = pl * (0.8 + 0.9 * ramp) + hl * ramp * (0.5 + 0.5 * beat0 / 2)
            pr_ = pr_ * (0.8 + 0.9 * ramp) + hr * ramp * (0.5 + 0.5 * beat0 / 2)
        i = int(round(max(0.0, t0 - 0.25) * SR))
        L[i:i + len(pl)] += pl * g
        R[i:i + len(pr_)] += pr_ * g
        # high strings: a halo that opens in the hold, returns as the theme climbs, and crowns the ending
        if b == 2 or b >= 7:
            hl, hr = shimmer(pad_ms[2:], dur)
            gs = (0.08 + 0.13 * en) * (1.4 if b == 16 else 1.0)
            if b == 2:
                rmp = np.linspace(0.0, 1.0, len(hl)) ** 1.5
                hl, hr = hl * rmp, hr * rmp
            L[i:i + len(hl)] += hl * gs
            R[i:i + len(hr)] += hr * gs
        # bass
        if b >= 2:
            gb = 0.12 + 0.18 * en
            if b == 2:
                add(bass(root, dur), t0, 0.0, gb * 0.7)
            elif b == 16:
                add(bass(root, 4.4), t0, 0.0, gb)
            else:
                for (bt, bd) in ((0, 1.45), (1.5, 0.45), (2, 1.2), (3.5, 0.45)):
                    if bt < beats:
                        m = root if bt != 3.5 else root + 7
                        add(bass(m if m < 52 else m - 12, bd * BEAT), t0 + bt * BEAT, 0.0, gb * (1.0 if bt in (0, 2) else 0.6))
        # arpeggio: 8ths, a rolling up-and-over pattern
        if 3 <= b <= 15:
            patt = [0, 2, 3, 2, 4, 3, 2, 1] if b < 11 else [0, 2, 3, 4, 3, 2, 4, 2]
            for k in range(int(beats * 2)):
                m = arp[patt[k % 8]]
                hum = rng.uniform(-0.006, 0.006)
                add(pluck(m, 1.2, 0.7 + 0.5 * en), t0 + k * BEAT / 2 + hum, pan=(-0.45 if k % 2 == 0 else 0.45),
                    gain=(0.10 + 0.10 * en) * (1.15 if k % 4 == 0 else 0.8))
            for k in range(int(beats * 2)):                # celesta doubles the arpeggio an octave up: the sparkle
                m = arp[patt[k % 8]] + 12
                add(celesta(m, 1.4), t0 + k * BEAT / 2 + rng.uniform(-0.004, 0.004), pan=(0.5 if k % 2 == 0 else -0.5), gain=(0.06 + 0.08 * en) * (1.1 if k % 4 == 0 else 0.8))
            if b >= 11 and b <= 14:                      # sixteenth shimmer an octave up in the climax
                for k in range(int(beats * 4)):
                    add(celesta(arp[(k * 3) % 5] + 24, 0.6), t0 + k * BEAT / 4, pan=0.7 * math.sin(k * 1.3), gain=0.04)
        beat0 += beats
    # melody
    for (bt, bd, m) in MEL.get(b, []):
        add(flute(m, bd * BEAT), bar_t(b, bt), pan=-0.12, gain=0.20 + 0.16 * en)
        if b in HARM:
            add(flute(m + HARM[b], bd * BEAT, breath=0.03), bar_t(b, bt), pan=0.3, gain=0.10 + 0.07 * en)
    # percussion
    if 3 <= b <= 14:
        for k in range(8):
            add(shaker(0.09, 1.0 if k % 2 == 0 else 0.6), bar_t(b, k * 0.5), pan=0.35, gain=0.08 + 0.07 * en)
        for bt in ((0, 2) if b < 7 else (0, 2, 3.5)):
            add(kick(), bar_t(b, bt), 0.0, 0.27 + 0.2 * en)
        if b >= 7:
            for bt in (1, 3):
                add(brush(), bar_t(b, bt), pan=-0.25, gain=0.07 + 0.07 * en)
        if b >= 11:
            for k in range(16):
                if k % 4 != 0:
                    add(shaker(0.05, 0.7), bar_t(b, k * 0.25), pan=-0.5, gain=0.035)
    if 3 <= b <= 15:                                   # gentle hi-hat: off-beat eighths, sixteenths as it fills out
        for k in range(16):
            if k % 4 == 2:
                add(hat(open_=(b >= 11 and k == 14)), bar_t(b, k * 0.25), pan=0.3, gain=0.075 + 0.07 * en)
            elif b >= 7 and k % 2 == 1:
                add(hat(), bar_t(b, k * 0.25) + rng.uniform(-0.004, 0.004), pan=0.3, gain=0.035 + 0.04 * en)
        # each close-up's event peaks on beat 3: a little answer from the celesta
        root_ = CH[PROG[b][0][0]][2]
        for j, m in enumerate((root_[2] + 12, root_[4] + 12, root_[2] + 24)):
            add(celesta(m, 1.8), bar_t(b, 2.0) + 0.07 * j, pan=-0.4 + 0.4 * j, gain=0.07)
    if b == 15:
        for bt in (0, 2):
            add(kick(), bar_t(b, bt), 0.0, 0.4)
        for k in range(8):
            add(shaker(0.09, 0.8), bar_t(b, k * 0.5), pan=0.35, gain=0.04 + 0.006 * k)

# ---- every hard cut lands on a bar line: a breath in, a bell on the cut
for k, cut in enumerate(TL.CUTS):
    tc = cut / TL.FPS
    b = int(round(tc / BAR)) + 1
    root = CH[PROG[b][0][0]][0]
    last = (k == len(TL.CUTS) - 1)
    sw = swell(1.6 if (last or k == 0) else 0.5)
    add(sw, tc - len(sw) / SR, pan=0.0, gain=0.10 if last else (0.085 if k == 0 else 0.045))
    add(bell(root + 48 if not last else 86), tc, pan=0.25 if k % 2 else -0.25, gain=0.11 if not last else 0.14)
    if last or k == 0:
        add(kick(), tc, 0.0, 0.5)

# ---- every swoop of the camera: a rising whoosh that lands on the bar line, with a soft thud of arrival
mv = TL.MOVE / TL.FPS
for k, cut in enumerate(TL.CUTS):
    tc = cut / TL.FPS
    if k == 0:
        direction = 1.0
    elif k == len(TL.SHOTS):
        direction = -1.0
    else:
        direction = 1.0 if TL.SHOTS[k][1] >= TL.SHOTS[k - 1][1] else -1.0
    wl, wr = whoosh(mv + 0.12, direction)
    g = 0.15 if k not in (0, len(TL.SHOTS)) else 0.19
    i = int(round((tc - mv - 0.02) * SR))
    L[i:i + len(wl)] += wl * g
    R[i:i + len(wr)] += wr * g
    add(kick(), tc, 0.0, 0.22)

# ---- bar 1: the build.  One pluck as each piece of the world starts (rising through the pentatonic),
#      pencil strokes under them, water when the rivers and seas pour in.
PENTA = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86]
order = sorted((t, n) for n, t in TL.STARTS.items() if t >= 0 and not n.startswith('sky'))
for k, (t, name) in enumerate(order):
    m = PENTA[min(len(PENTA) - 1, (k * 2) % 7 + k // 4)]
    add(pluck(m, 1.6, 0.9), t + 0.02, pan=0.6 * math.sin(k * 1.9), gain=0.16)
    add(celesta(m + 12, 1.4), t + 0.02, pan=-0.6 * math.sin(k * 1.9), gain=0.07)
    add(pluck(m - 12, 1.6, 0.5), t + 0.02, pan=-0.3 * math.sin(k * 1.9), gain=0.07)
    for j in range(3):
        add(pencil(rng.uniform(0.12, 0.26)), t + 0.02 + j * 0.16 + rng.uniform(0, 0.05), pan=0.5 * math.sin(k * 1.9), gain=0.022)
    if name in ('rio', 'reef', 'halong', 'niagara', 'colosseum', 'fuji', 'taj'):
        add(water(1.1), t + 0.25, pan=0.5 * math.sin(k * 1.9 + 1), gain=0.035)
# little pops as trees and people spring up
for k in range(46):
    t = (1.1 + 3.2 * (k / 46.0) ** 0.9) * TL.SLOW + rng.uniform(-0.03, 0.03)
    n = int(0.05 * SR)
    tt = np.arange(n) / SR
    f = rng.choice([880, 988, 1175, 1319, 1480, 1760])
    add(np.sin(2 * np.pi * f * tt * (1 + 2.5 * tt)) * np.exp(-tt * 70), t, pan=rng.uniform(-0.7, 0.7), gain=0.022)
# glints ripple out from the centre: an upward sweep of bells (again on the closing wide shot)
for t0, g in ((TL.FINALE, 0.055), (TL.FINALE2, 0.06)):
    for k, m in enumerate([74, 78, 81, 86, 90, 93, 98]):
        add(bell(m, 1.8), t0 + k * 0.085, pan=-0.6 + 0.2 * k, gain=g * (1 - 0.06 * k))
# the last word: a slow strum of the home chord, then one soft high D
tf = TL.CUTS[-1] / TL.FPS
for k, m in enumerate([50, 57, 62, 66, 69, 74, 78]):
    add(pluck(m, 4.0, 0.8), tf + 0.03 * k, pan=-0.5 + k * 0.16, gain=0.16)
add(pluck(86, 3.0, 0.6), tf + 3 * BEAT, pan=0.1, gain=0.10)
add(bell(86, 3.0), tf + 3 * BEAT, pan=0.1, gain=0.05)

# ------------------------------------------------------------------ master ----
mixL, mixR = L.copy(), R.copy()
# reverb: convolution with decaying coloured noise (a small warm hall)
ir_n = int(2.2 * SR)
tt = np.arange(ir_n) / SR
irs = []
for seed in (1, 2):
    g = np.random.default_rng(seed).standard_normal(ir_n) * np.exp(-tt * 3.0)
    b_, a_ = signal.butter(2, [220 / (SR / 2), 8500 / (SR / 2)], 'band')
    g = signal.lfilter(b_, a_, g)
    g[: int(0.012 * SR)] = 0
    irs.append(g / np.sqrt((g ** 2).sum()))
wetL = signal.fftconvolve(mixL, irs[0])[: len(mixL)]
wetR = signal.fftconvolve(mixR, irs[1])[: len(mixR)]
mixL = mixL + 0.30 * wetL
mixR = mixR + 0.30 * wetR
mixL, mixR = mixL[:N], mixR[:N]
# gentle high-pass (no rumble), then a soft-knee limiter
b_, a_ = signal.butter(2, 28 / (SR / 2), 'high')
mixL, mixR = signal.lfilter(b_, a_, mixL), signal.lfilter(b_, a_, mixR)
# 'air': a gentle high shelf, so it still sparkles on a phone speaker
b_, a_ = signal.butter(1, 2800 / (SR / 2), 'high')
mixL, mixR = mixL + 1.5 * signal.lfilter(b_, a_, mixL), mixR + 1.5 * signal.lfilter(b_, a_, mixR)
t = np.arange(N) / SR
fade_in = np.minimum(1.0, t / 0.06)
fade_out = np.where(t > DUR - 3.8, np.cos(np.clip((t - (DUR - 3.8)) / 3.8, 0, 1) * math.pi / 2) ** 1.6, 1.0)
mixL *= fade_in * fade_out
mixR *= fade_in * fade_out
pk = max(np.abs(mixL).max(), np.abs(mixR).max())
drive = 0.85 / pk
mixL, mixR = np.tanh(mixL * drive * 1.25) / 1.25, np.tanh(mixR * drive * 1.25) / 1.25


def true_peak(x):
    return np.abs(signal.resample_poly(x, 4, 1)).max()


tp = max(true_peak(mixL), true_peak(mixR))
target = 10 ** (-1.6 / 20)                 # leave headroom so the AAC encode stays under -1 dBFS too
mixL *= target / tp
mixR *= target / tp

os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
path = os.path.join(HERE, 'out', 'soundtrack.wav')
st = np.stack([mixL, mixR], 1)
dither = (rng.random(st.shape) - rng.random(st.shape)) / 32768.0
pcm = np.clip(np.round((st + dither) * 32767.0), -32768, 32767).astype('<i2')
with wave.open(path, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())


# ---------------------------------------------------------------- verify ----
def db(x):
    return 20 * math.log10(max(x, 1e-9))


def report(st, label):
    mono = st.mean(1)
    print('==', label)
    print('duration %.3f s   sample peak %.2f dBFS   true peak (4x) %.2f dBFS   overall RMS %.2f dBFS'
          % (len(st) / SR, db(np.abs(st).max()), db(max(true_peak(st[:, 0]), true_peak(st[:, 1]))), db(np.sqrt((st ** 2).mean()))))
    print('clipped samples (|x| >= 0.999): %d' % int((np.abs(st) >= 0.999).sum()))
    secs = int(math.ceil(len(st) / SR))
    rms = [db(np.sqrt((st[k * SR:(k + 1) * SR] ** 2).mean())) for k in range(secs)]
    print('RMS per second (dBFS):')
    for k in range(0, secs, 10):
        print('  %2d-%2ds: ' % (k, min(secs, k + 10)) + ' '.join('%6.1f' % v for v in rms[k:k + 10]))
    win = int(0.25 * SR)
    r25 = np.array([db(np.sqrt((st[k:k + win] ** 2).mean())) for k in range(0, len(st) - win, win)])
    body = r25[: int((DUR - 2.0) / 0.25)]
    print('quietest 250 ms window before the final fade: %.1f dBFS at %.2f s  (gaps below -50 dBFS: %d)'
          % (body.min(), body.argmin() * 0.25, int((body < -50).sum())))
    print('per bar RMS: ' + ' '.join('%d:%.1f' % (b + 1, db(np.sqrt((st[int(b * BAR * SR):int(min(len(st), (b + 1) * BAR * SR))] ** 2).mean())))
                                     for b in range(int(math.ceil(DUR / BAR)))))
    tail = [db(np.sqrt((st[int((DUR - s) * SR):int((DUR - s + 0.5) * SR)] ** 2).mean())) for s in (5.0, 4.0, 3.0, 2.0, 1.5, 1.0, 0.5)]
    print('ending, 0.5 s windows starting 5.0/4.0/3.0/2.0/1.5/1.0/0.5 s before the end: ' + ' '.join('%.1f' % v for v in tail))
    print('last 20 ms peak: %.1f dBFS' % db(np.abs(st[-int(0.02 * SR):]).max()))
    # spectral balance + tonic check on the final chord
    f, tt_, S = signal.spectrogram(mono, SR, nperseg=8192, noverlap=4096)
    bands = [(30, 120), (120, 400), (400, 1500), (1500, 5000), (5000, 16000)]
    print('energy above 1.5 kHz: %.1f%%' % (100 * S[f >= 1500].sum() / S.sum()))
    tot = S.sum()
    print('energy by band: ' + '  '.join('%d-%dHz %.1f%%' % (lo, hi, 100 * S[(f >= lo) & (f < hi)].sum() / tot) for lo, hi in bands))
    seg = mono[int((DUR - 4.2) * SR):int((DUR - 2.2) * SR)]
    sp = np.abs(np.fft.rfft(seg * np.hanning(len(seg))))
    fr = np.fft.rfftfreq(len(seg), 1 / SR)
    top = fr[np.argsort(sp)[-400:]]
    names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    pcs = {}
    for fq, a in zip(fr[1:], sp[1:]):
        if 60 < fq < 2000:
            pc = int(round(69 + 12 * math.log2(fq / 440.0))) % 12
            pcs[pc] = pcs.get(pc, 0) + a * a
    tot2 = sum(pcs.values())
    best = sorted(pcs.items(), key=lambda kv: -kv[1])[:4]
    print('final chord pitch classes by energy: ' + ', '.join('%s %.0f%%' % (names[k], 100 * v / tot2) for k, v in best))
    return f, tt_, S, rms


f, tt_, S, rms = report(st, 'soundtrack.wav (as written, before 16-bit)')

# picture of the whole thing: spectrogram + loudness + bar lines
import cv2  # noqa: E402
Wd, Hd = 1650, 560
fi = (f >= 40) & (f <= 14000)
Sd = 10 * np.log10(S[fi] + 1e-12)
Sd = np.clip((Sd - (Sd.max() - 80)) / 80, 0, 1)
# log-frequency rows
ff = f[fi]
rows = np.interp(np.geomspace(40, 14000, 380), ff, np.arange(len(ff))).astype(int)
img = cv2.resize(Sd[rows][::-1], (Wd, 380), interpolation=cv2.INTER_AREA)
img = cv2.applyColorMap((img * 255).astype(np.uint8), cv2.COLORMAP_MAGMA)
pic = np.full((Hd, Wd, 3), 20, np.uint8)
pic[:380] = img
win = int(0.1 * SR)
r = np.array([db(np.sqrt((st[k:k + win] ** 2).mean())) for k in range(0, len(st) - win, win)])
xs = (np.arange(len(r)) * 0.1 / DUR * Wd).astype(int)
ys = (380 + 170 - np.clip((r + 60) / 60, 0, 1) * 160).astype(int)
for k in range(1, len(r)):
    cv2.line(pic, (int(xs[k - 1]), int(ys[k - 1])), (int(xs[k]), int(ys[k])), (120, 220, 255), 1, cv2.LINE_AA)
for b in range(0, 17):
    x = int(b * BAR / DUR * Wd)
    cv2.line(pic, (x, 0), (x, Hd), (255, 255, 255) if (b * 100) in TL.CUTS else (110, 110, 110), 1)
    cv2.putText(pic, str(b + 1), (x + 4, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1, cv2.LINE_AA)
for dbv in (-6, -18, -30, -42):
    y = int(380 + 170 - (dbv + 60) / 60 * 160)
    cv2.line(pic, (0, y), (Wd, y), (60, 60, 60), 1)
    cv2.putText(pic, '%d dB' % dbv, (4, y - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.36, (170, 170, 170), 1, cv2.LINE_AA)
cv2.imwrite(os.path.join(HERE, 'out', 'soundtrack_analysis.png'), pic)
print('wrote', path)
