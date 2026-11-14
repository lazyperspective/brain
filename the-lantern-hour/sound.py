#!/usr/bin/env python3
"""
The sound of THE LANTERN HOUR: everything synthesised, nothing sampled.
A drip on a shell and a knock on a shell are the same sound; that is the score.
"""
import os, sys, math
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt
from scipy.io import wavfile
from timeline import *

SR = 48000
TAIL = 0.0
N = int((TOTAL + TAIL) * SR)
rng = np.random.default_rng(1234)
WORK = os.environ.get('LH_WORK', '/tmp/lh-work')


def T(name, t=0.0):
    return START[name] + t


def bp(x, lo, hi, order=2):
    sos = butter(order, [lo / (SR / 2), min(0.99, hi / (SR / 2))], btype='band', output='sos')
    return sosfilt(sos, x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f / (SR / 2), btype='low', output='sos'), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f / (SR / 2), btype='high', output='sos'), x)


def env_seg(n, a=0.01, r=0.1):
    e = np.ones(n)
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    na = min(na, n // 2); nr = min(nr, n // 2)
    e[:na] = np.linspace(0, 1, na) ** 2
    e[-nr:] = np.linspace(1, 0, nr) ** 2
    return e


class Bus:
    def __init__(self):
        self.L = np.zeros(N); self.R = np.zeros(N)

    def add(self, t, x, gain=1.0, pan=0.0):
        i = int(t * SR)
        if i >= N or i + len(x) <= 0:
            return
        if i < 0:
            x = x[-i:]; i = 0
        x = x[: N - i]
        gl = math.cos((pan + 1) * math.pi / 4) * 1.414; gr = math.sin((pan + 1) * math.pi / 4) * 1.414
        self.L[i:i + len(x)] += x * gain * gl; self.R[i:i + len(x)] += x * gain * gr


dry = Bus(); wet = Bus(); mus = Bus(); amb = Bus()


# ------------------------------------------------------------------ voices
def tok(f, dur=0.35, hollow=1.0, bright=1.0):
    """something small striking a shell"""
    n = int(dur * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / (0.045 * hollow))
    x += 0.5 * np.sin(2 * np.pi * f * 2.31 * t + 0.4) * np.exp(-t / (0.022 * hollow))
    x += 0.28 * bright * np.sin(2 * np.pi * f * 3.87 * t + 1.1) * np.exp(-t / 0.012)
    x += 0.6 * np.sin(2 * np.pi * f * 0.5 * t) * np.exp(-t / (0.07 * hollow)) * (hollow - 0.5)
    click = rng.standard_normal(n) * np.exp(-t / 0.0025) * 0.5 * bright
    return (x + hp(click, 1500)) * env_seg(n, 0.0008, 0.05)


def plip(f=900):
    """a drop finding leaf-litter"""
    n = int(0.22 * SR); t = np.arange(n) / SR
    fr = f * (1 + 0.5 * np.exp(-t / 0.02))
    x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / 0.035)
    x += 0.3 * bp(rng.standard_normal(n), 2500, 7000) * np.exp(-t / 0.02)
    return x * env_seg(n, 0.001, 0.05)


def step(heavy=1.0):
    n = int(0.16 * SR); t = np.arange(n) / SR
    x = lp(rng.standard_normal(n), 380 / heavy + 200) * np.exp(-t / (0.03 * heavy))
    x += 0.5 * bp(rng.standard_normal(n), 1800, 6000) * np.exp(-t / 0.018) * rng.uniform(0.3, 1.0)
    x += 0.7 * heavy * np.sin(2 * np.pi * 70 * t) * np.exp(-t / 0.04)
    return x * env_seg(n, 0.002, 0.04)


def rustle(dur=0.3, lo=2000, hi=7000):
    n = int(dur * SR); t = np.arange(n) / SR
    g = np.abs(lp(rng.standard_normal(n), 30)) * 14
    return bp(rng.standard_normal(n), lo, hi) * g * env_seg(n, 0.02, dur * 0.5)


def crunch(dur=1.6, rate=7.0):
    n = int(dur * SR)
    x = np.zeros(n)
    tt = 0.05
    while tt < dur - 0.1:
        m = int(rng.uniform(0.02, 0.05) * SR)
        b = hp(rng.standard_normal(m), rng.uniform(1500, 3500)) * np.exp(-np.arange(m) / (0.008 * SR)) * rng.uniform(0.4, 1.0)
        i = int(tt * SR); x[i:i + m] += b[: n - i]
        tt += rng.exponential(1.0 / rate) + 0.05
    return x


def sigh(dur=1.0, low=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    e = np.sin(np.pi * t / dur) ** 1.5
    x = bp(rng.standard_normal(n), 180 * low, 800 * low) * e
    fr = 62 * low * (1 + 0.1 * np.sin(2 * np.pi * 3 * t))
    creak = np.sign(np.sin(2 * np.pi * np.cumsum(fr) / SR)) * (np.sin(2 * np.pi * 9 * t) > 0.2)
    x += 0.10 * lp(creak, 500) * e
    return x


def creak_up(dur=1.2, f0=180, f1=420):
    n = int(dur * SR); t = np.arange(n) / SR
    fr = f0 + (f1 - f0) * (t / dur) ** 1.5
    ph = np.cumsum(fr) / SR
    stick = (np.sin(2 * np.pi * 23 * t * (1 + t)) > 0.3).astype(float)
    x = np.sin(2 * np.pi * ph) * stick + 0.5 * np.sin(2 * np.pi * 2.7 * ph) * stick
    return lp(x, 2400) * env_seg(n, 0.05, 0.2) * 0.5


def thump(f=55, dur=0.3):
    n = int(dur * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * (1 + 0.6 * np.exp(-t / 0.03)) * t) * np.exp(-t / 0.07) + 0.3 * lp(rng.standard_normal(n), 300) * np.exp(-t / 0.03)) * env_seg(n, 0.002, 0.1)


NOTE = {'D3': 146.83, 'E3': 164.81, 'F#3': 185.0, 'G3': 196.0, 'A3': 220.0, 'B3': 246.94, 'C#4': 277.18, 'D4': 293.66, 'E4': 329.63, 'F#4': 369.99, 'G4': 392.0,
        'A4': 440.0, 'B4': 493.88, 'C#5': 554.37, 'D5': 587.33, 'E5': 659.25, 'F#5': 739.99, 'A5': 880.0, 'B5': 987.77, 'D6': 1174.66, 'D2': 73.42, 'G2': 98.0, 'A2': 110.0, 'B2': 123.47}


def tine(f, dur=3.2, soft=1.0):
    """a struck tine: thumb-piano, music box, something from a drawer"""
    n = int(dur * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / (0.9 * soft))
    x += 0.35 * np.sin(2 * np.pi * f * 2.0 * t + 0.3) * np.exp(-t / 0.35)
    x += 0.22 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / 0.06)
    x += 0.12 * np.sin(2 * np.pi * f * 1.003 * t) * np.exp(-t / 1.4)
    x += 0.15 * hp(rng.standard_normal(n), 3000) * np.exp(-t / 0.004)
    return x * env_seg(n, 0.002, 0.3)


def pad(freqs, dur, bright=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    x = np.zeros(n)
    for f in freqs:
        for k, a in ((1, 1.0), (2, 0.35 * bright), (3, 0.14 * bright), (4, 0.05 * bright)):
            det = 1 + rng.uniform(-0.002, 0.002)
            x += a * np.sin(2 * np.pi * f * k * det * t + rng.uniform(0, 6.28)) * (1 + 0.15 * np.sin(2 * np.pi * rng.uniform(0.1, 0.4) * t + rng.uniform(0, 6)))
    return x / len(freqs) * env_seg(n, min(dur * 0.35, 1.8), min(dur * 0.45, 2.5))


def play(t, name, gain=0.2, soft=1.0, pan=0.0, rev=0.5, dur=3.2):
    x = tine(NOTE[name], dur, soft)
    mus.add(t, x, gain, pan)
    wet.add(t, x, gain * rev, pan)


def phrase(t0, notes, step_=0.5, gain=0.2, soft=1.0, rev=0.5, octave=1.0):
    for i, (nm, dt) in enumerate(notes):
        if nm is None:
            continue
        x = tine(NOTE[nm] * octave, 3.2, soft)
        pan = 0.25 * math.sin(i * 1.7)
        mus.add(t0 + dt * step_, x, gain, pan); wet.add(t0 + dt * step_, x, gain * rev, pan)


CALL = [('F#4', 0.0), ('A4', 1.0), ('D5', 2.0), ('B4', 3.3)]            # the hour
ANSWER = [('A4', 0.0), ('F#4', 1.0), ('E4', 2.0)]                        # ...and what it leaves hanging
HOME_ = [('A4', 0.0), ('F#4', 1.0), ('E4', 2.0), ('D4', 3.3)]            # only once, in the root-house

# ------------------------------------------------------------------ ambiences
def noise_bed(t0, t1, lo, hi, gain, lfo=0.13, fade=1.0, bus=amb, depth=0.5):
    n = int((t1 - t0) * SR)
    if n <= 0:
        return
    t = np.arange(n) / SR
    for ch, pan in ((0, -0.7), (1, 0.7)):
        x = bp(rng.standard_normal(n), lo, hi)
        m = 1 - depth + depth * (0.5 + 0.5 * np.sin(2 * np.pi * lfo * t + rng.uniform(0, 6.28))) * (0.6 + 0.4 * np.sin(2 * np.pi * lfo * 2.7 * t + rng.uniform(0, 6.28)))
        bus.add(t0, x * m * env_seg(n, fade, fade), gain, pan)


def chirps(t0, t1, rate, flo, fhi, gain, bus=wet):
    t = t0
    while t < t1:
        t += rng.exponential(1.0 / rate)
        if t >= t1:
            break
        k = rng.integers(2, 7)
        f = rng.uniform(flo, fhi); pan = rng.uniform(-0.8, 0.8)
        for j in range(k):
            m = int(rng.uniform(0.04, 0.09) * SR); tt = np.arange(m) / SR
            fr = f * (1 + rng.uniform(-0.25, 0.3) * tt / (m / SR))
            x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.sin(np.pi * tt / (m / SR)) ** 2
            bus.add(t + j * rng.uniform(0.07, 0.13), x, gain * rng.uniform(0.4, 1.0), pan)


def crickets(t0, t1, gain):
    n = int((t1 - t0) * SR); t = np.arange(n) / SR
    for f, rate, pan, ph in ((4300, 2.1, -0.6, 0.0), (4750, 1.7, 0.5, 1.3), (3900, 2.6, 0.1, 2.2)):
        gate = (np.sin(2 * np.pi * rate * t + ph) > 0.2) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 31 * t)))
        gate = lp(gate.astype(float), 400)
        x = np.sin(2 * np.pi * f * t) * gate
        amb.add(t0, x * env_seg(n, 1.0, 0.6), gain * rng.uniform(0.6, 1.0), pan)


def steps(t0, t1, cadence, heavy, gain, pan0=0.0, pan1=0.0, bus=dry):
    t = t0
    while t < t1:
        u = (t - t0) / max(1e-6, t1 - t0)
        bus.add(t, step(heavy), gain * rng.uniform(0.7, 1.0), pan0 + (pan1 - pan0) * u)
        t += cadence * rng.uniform(0.92, 1.08)


# ============================================================================== THE FILM
OLD_F, YNG_F = 392.0, 880.0           # the two shells (G4-ish hollow, A5 bright)
GROWN_F = 466.0

# ---- 1. forest
f0 = T('forest')
noise_bed(f0, T('edge') + 2.5, 90, 700, 0.020, lfo=0.07, fade=2.0)
noise_bed(f0, T('edge') + 2.0, 2500, 9000, 0.006, lfo=0.21, fade=2.0)
chirps(f0 + 2, T('night') - 1, 0.22, 2800, 5200, 0.012)
for td in F_DRIPS:
    dry.add(f0 + td + 0.26, plip(820 + rng.uniform(-60, 60)), 0.20, -0.45); wet.add(f0 + td + 0.26, plip(820), 0.12, -0.45)
phrase(f0 + F_IGNITE - 0.1, CALL, 0.62, 0.17, rev=0.7)
mus.add(f0 + F_IGNITE - 0.6, pad([NOTE['D3'], NOTE['A3'], NOTE['F#4']], 6.5, 0.6), 0.035)
steps(f0 + F_RUN[0], f0 + F_RUN[1], 0.11, 0.5, 0.10, -0.5, 0.1)
for th in F_HOPS:
    dry.add(f0 + th + 0.2, step(0.6), 0.14, 0.1)
dry.add(f0 + 8.2, rustle(0.5), 0.06, 0.1)
dry.add(f0 + F_TIP[1] - 0.02, thump(90, 0.25), 0.30, 0.05); dry.add(f0 + F_TIP[1], tok(YNG_F * 0.8, 0.2, 0.8), 0.10, 0.05)
for i in range(7):
    dry.add(f0 + F_TIP[1] + 0.3 + i * 0.3, rustle(0.12, 1500, 5000), 0.035, 0.05)
dry.add(f0 + F_OLD_OUT + 0.1, sigh(1.2), 0.13, -0.5)
steps(f0 + F_OLD_WALK1[0] + 0.2, f0 + F_OLD_WALK1[1], 0.42, 1.6, 0.20, -0.5, -0.15)
dry.add(f0 + F_NUDGE[0] + 0.25, sigh(0.5, 1.3), 0.09, -0.1)
dry.add(f0 + F_NUDGE[1] - 0.05, thump(100, 0.2), 0.22, 0.05)
steps(f0 + F_SCOOT[0], f0 + F_SCOOT[1], 0.10, 0.5, 0.09, 0.05, 0.3)
steps(f0 + F_OLD_WALK2[0] + 0.1, f0 + F_OLD_WALK2[1], 0.42, 1.6, 0.20, -0.15, 0.0)
dry.add(f0 + 13.75, creak_up(1.1), 0.10, 0.1)
dry.add(f0 + 14.0, rustle(0.9, 2500, 8000), 0.07, 0.15)
phrase(f0 + 13.6, CALL, 0.36, 0.13, rev=0.6)
dry.add(f0 + F_BITE, crunch(2.2), 0.085, 0.25)
phrase(f0 + F_BITE + 0.15, ANSWER, 0.42, 0.14, rev=0.6)
steps(f0 + F_BACK[0], f0 + F_BACK[1], 0.3, 1.6, 0.16)
dry.add(f0 + F_SPRING, rustle(1.4, 2500, 9000), 0.10, 0.1)
for i in range(5):
    dry.add(f0 + F_SPRING + 0.08 + i * 0.24, rustle(0.1, 3000, 9000), 0.05 * (1 - i * 0.15), 0.1)
dry.add(f0 + F_TUCK[0], sigh(0.9), 0.10, -0.05)
dry.add(f0 + F_THUMP, thump(60, 0.35), 0.35, -0.05)
steps(f0 + F_GO_KNOCK[0], f0 + F_GO_KNOCK[1], 0.11, 0.5, 0.08, 0.3, 0.1)
for tk in F_KNOCK1 + F_KNOCK2:
    x = tok(OLD_F, 0.4, 1.5)
    dry.add(f0 + tk, x, 0.42, 0.05); wet.add(f0 + tk, x, 0.16, 0.05)
dry.add(f0 + F_HEAD_OUT[0] + 0.1, sigh(1.1, 0.9), 0.12, -0.05)

# ---- 2. night
n0 = T('night')
mus.add(n0 - 0.5, pad([NOTE['D2'], NOTE['A2'], NOTE['D3'], NOTE['F#3']], DUR['night'] + 1.5, 0.4), 0.032)
phrase(n0 + 0.2, CALL, 0.60, 0.10, soft=1.4, rev=0.9, octave=0.5)
phrase(n0 + 3.0, HOME_, 0.60, 0.10, soft=1.4, rev=0.9, octave=0.5)
for td in N_DRIPS_YOUNG:
    x = tok(YNG_F, 0.3, 0.8); dry.add(n0 + td + 0.26, x, 0.34, 0.1); wet.add(n0 + td + 0.26, x, 0.2, 0.1)
for i in range(4):
    dry.add(n0 + N_SHUFFLE[0] + 0.1 + i * 0.27, rustle(0.22, 400, 2500), 0.10, -0.1)
    dry.add(n0 + N_SHUFFLE[0] + 0.22 + i * 0.27, thump(70, 0.15), 0.12, -0.1)
dry.add(n0 + N_SHUFFLE[1] - 0.1, tok(OLD_F * 1.2, 0.2, 1.0, 0.5), 0.12, 0.0)
for td in N_DRIPS_OLD:
    x = tok(OLD_F, 0.45, 1.6); dry.add(n0 + td + 0.26, x, 0.36, 0.0); wet.add(n0 + td + 0.26, x, 0.22, 0.0)
dry.add(n0 + N_KICK, tok(OLD_F * 1.5, 0.2, 1.0), 0.20, 0.1)
dry.add(n0 + N_KICK + 0.35, sigh(1.3, 0.8), 0.11, -0.1)
noise_bed(n0 + 0.3, n0 + DUR['night'], 150, 420, 0.016, lfo=0.2, fade=1.5, depth=0.9)      # two breaths, more or less together

# ---- 3. edge
e0 = T('edge')
steps(e0, e0 + DUR['edge'], 0.42, 1.6, 0.16, -0.2, 0.3)
steps(e0, e0 + E_TURN[0], 0.11, 0.5, 0.07, -0.6, -0.4)
steps(e0 + E_TURN[1] + 0.2, e0 + DUR['edge'], 0.10, 0.5, 0.07, -0.4, 0.2)
mus.add(e0 + 0.5, pad([NOTE['D3'], NOTE['A3'], NOTE['E4'], NOTE['A4']], 6.0, 1.0), 0.07)
noise_bed(e0 + 1.5, e0 + DUR['edge'] + 1.2, 500, 6000, 0.05, lfo=0.3, fade=1.6)

# ---- 4. reveal / 5. plenty
r0 = T('reveal')
noise_bed(r0, T('stars') + 1.0, 300, 2400, 0.030, lfo=0.11, fade=1.5)
noise_bed(r0, T('stars') + 1.0, 3000, 9000, 0.010, lfo=0.33, fade=1.5)
chirps(r0 + 1.0, T('late') + 2.0, 0.9, 3000, 6200, 0.012)
mus.add(r0 + 0.1, pad([NOTE['D3'], NOTE['A3'], NOTE['D4'], NOTE['F#4'], NOTE['E4']], 7.5, 1.3), 0.10)
arp = ['D4', 'A4', 'D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'A5', 'F#5', 'E5', 'D5', 'A4', 'F#4']
for i, nm in enumerate(arp):
    play(r0 + R_DRAWN[0] + 0.1 + i * 0.155, nm, 0.11 * (0.6 + 0.4 * math.sin(math.pi * i / len(arp))), pan=0.5 * math.sin(i), rev=0.8)
phrase(r0 + 3.0, CALL, 0.42, 0.16, rev=0.7, octave=2.0)
phrase(r0 + 4.9, [('A4', 0), ('F#4', 1), ('A4', 2), ('D5', 3)], 0.3, 0.12, rev=0.7, octave=2.0)
p0 = T('plenty')
mus.add(p0 - 0.3, pad([NOTE['G3'], NOTE['D4'], NOTE['B4']], 3.6, 1.0), 0.06)
mus.add(p0 + 3.0, pad([NOTE['A3'], NOTE['E4'], NOTE['C#5']], 3.6, 1.0), 0.05)
hop = ['D5', 'F#5', 'A5', 'F#5', 'B5', 'A5', 'F#5', 'D5', 'E5', 'F#5', 'A5', 'D6']
for i, nm in enumerate(hop):
    play(p0 + 0.15 + i * 0.2, nm, 0.09, soft=0.5, pan=-0.4 + 0.07 * i, rev=0.5, dur=1.2)
steps(p0, p0 + 2.5, 0.10, 0.45, 0.07, -0.7, 0.0)
for i in range(9):
    dry.add(p0 + 0.2 + i * 0.26, rustle(0.2, 2500, 8000), 0.035, -0.6 + i * 0.07)
dry.add(p0 + P_BITE, crunch(1.8), 0.07, 0.0)
phrase(p0 + 4.9, [('B4', 0), ('A4', 1.4)], 0.5, 0.10, rev=0.8)

# ---- 6. late
l0 = T('late')
mus.add(l0, pad([NOTE['B2'], NOTE['F#3'], NOTE['D4']], 4.5, 0.8), 0.05)
phrase(l0 + 0.5, [('F#4', 0), ('A4', 1), ('D5', 2)], 0.62, 0.12, rev=0.8)                 # the hour, with no one to finish it
mus.add(l0 + 3.6, pad([NOTE['G2'], NOTE['D3'], NOTE['B3'], NOTE['E4']], 5.5, 0.6), 0.05)
crickets(l0 + L_DUSK[0] + 0.8, T('years') + 0.3, 0.008)
steps(l0 + 3.6, l0 + DUR['late'], 0.33, 1.6, 0.05, 0.9, -0.5)
for i in range(12):
    dry.add(l0 + 5.0 + i * 0.3, step(1.6), 0.10 + 0.012 * min(i, 6), 0.4 - 0.08 * i)
dry.add(l0 + L_CONTACT - 0.1, creak_up(0.8, 200, 380), 0.10, 0.1)
dry.add(l0 + L_CONTACT + 0.2, rustle(1.0, 2000, 8000), 0.09, 0.1)
dry.add(l0 + L_RELEASE, rustle(1.3, 2500, 9000), 0.11, 0.1)
for i in range(2):
    dry.add(l0 + L_RELEASE + 0.24 + i * 0.13, plip(500 - 60 * i), 0.14, -0.05)
phrase(l0 + L_RELEASE + 0.5, [('A4', 0), ('F#4', 1)], 0.55, 0.10, rev=0.9)                 # two notes, where there used to be three

# ---- 7. stars / unknock
s0 = T('stars')
noise_bed(s0, T('years') + 0.2, 200, 1200, 0.012, lfo=0.09, fade=1.2)
play(s0 + 0.9, 'B4', 0.05, soft=1.5, rev=1.2)
u0 = T('unknock')
steps(u0 + U_WALK[0], u0 + U_WALK[1], 0.13, 0.5, 0.07, 0.3, 0.0)
dry.add(u0 + U_PAW[0], rustle(0.25, 1500, 5000), 0.03)
play(u0 + U_PAW[3] + 0.2, 'E4', 0.07, soft=1.6, rev=1.2)
mus.add(u0 + U_PAW[3], pad([NOTE['A2'], NOTE['E3']], 3.2, 0.3), 0.045)

# ---- 8. years
y0 = T('years')
noise_bed(y0, y0 + DUR['years'] + 1, 300, 2400, 0.028, lfo=0.5, fade=1.0)
chords = [['D3', 'A3', 'F#4'], ['B2', 'F#3', 'D4'], ['G2', 'D3', 'B3'], ['A2', 'E3', 'C#4'], ['B2', 'F#3', 'D4'], ['G2', 'D3', 'B3'], ['A2', 'E3', 'A3']]
cd = DUR['years'] / len(chords)
for i, ch in enumerate(chords):
    mus.add(y0 + i * cd - 0.4, pad([NOTE[c] for c in ch], cd + 1.6, 1.0), 0.06)
pat = ['F#4', 'A4', 'D5', 'B4', 'A4', 'F#4', 'E4', None]
tt = 0.15; i = 0
while tt < DUR['years'] - 0.8:
    u = tt / DUR['years']
    nm = pat[i % len(pat)]
    keep = rng.random() > u * 0.95                      # the tune loses its notes as the years go
    if nm is not None and keep:
        play(y0 + tt, nm, 0.12 * (1 - 0.5 * u), soft=0.8, pan=0.4 * math.sin(i * 0.9), rev=0.6 + u, dur=2.5)
    tt += 0.36
    i += 1
# seasons going over
import numpy as _np
for k in range(1, 60):
    ts = (DUR['years'] - 1.0) * math.sqrt(k / 4.0 / YEARS)
    if ts > DUR['years'] - 1.0:
        break
    amb.add(y0 + ts - 0.15, rustle(0.35, 800, 5000), 0.035 * (1.0 if k < 14 else 0.6), 0.6 * math.sin(k * 1.3))

# ---- 9. husk  10. carry
h0 = T('husk')
noise_bed(h0, T('flash'), 300, 2200, 0.020, lfo=0.1, fade=1.2)
noise_bed(h0, T('flash'), 3000, 9000, 0.008, lfo=0.3, fade=1.2)
chirps(h0 + 0.5, T('flash') - 0.5, 0.5, 3000, 6000, 0.010)
steps(h0 + 0.1, h0 + 1.4, 0.5, 1.8, 0.14, -0.6, -0.5)
dry.add(h0 + 0.5, sigh(1.0, 0.85), 0.08, -0.4)
for i in range(4):
    dry.add(h0 + H_NUDGE[0] + 0.05 + i * 0.2, rustle(0.3, 1200, 6000), 0.10, -0.1 + 0.1 * i)
play(h0 + H_GLOW[0] + 0.3, 'F#4', 0.08, soft=1.6, rev=1.3)
play(h0 + H_GLOW[0] + 1.6, 'A4', 0.07, soft=1.6, rev=1.3)
c0 = T('carry')
steps(c0, c0 + DUR['carry'], 0.5, 1.8, 0.09, -0.3, -0.15)
mus.add(c0 - 0.3, pad([NOTE['G2'], NOTE['D3'], NOTE['B3']], 5.5, 0.5), 0.05)

# ---- 11. knock
k0 = T('knock')
steps(k0, k0 + 2.4, 0.5, 1.8, 0.16, -0.7, -0.25)
dry.add(k0 + K_SET, rustle(0.2, 2500, 8000), 0.05, -0.1)
steps(k0 + 3.5, k0 + 4.3, 0.4, 1.8, 0.15, -0.2, -0.1)
for tk in K_TAPS:
    x = tok(GROWN_F, 0.45, 1.5)
    dry.add(k0 + tk, x, 0.44, 0.05); wet.add(k0 + tk, x, 0.2, 0.05)
steps(k0 + K_TAPS[1] + 0.9, k0 + K_TAPS[1] + 2.0, 0.42, 1.8, 0.13, -0.1, -0.25)
dry.add(k0 + K_WAKE[0] + 0.1, sigh(1.1, 1.0), 0.10, 0.2)

# ---- 12. flash: the dark sheet comes back whole, sound and all, and cannot be held
fl0 = T('flash')
fl = Bus()
nfl = int(DUR['flash'] * SR)
x = bp(rng.standard_normal(nfl), 90, 700) * 0.05 * env_seg(nfl, 0.03, 0.5)
fl.add(fl0, x, 1.0, -0.5); fl.add(fl0, bp(rng.standard_normal(nfl), 90, 700) * 0.05 * env_seg(nfl, 0.03, 0.5), 1.0, 0.5)
for i, (nm, dt) in enumerate(CALL + [('A4', 4.6), ('F#4', 5.6)]):
    xx = tine(NOTE[nm], 1.6, 0.9)
    fl.add(fl0 + 0.05 + dt * 0.36, xx, 0.15, 0.2 * math.sin(i)); wet.add(fl0 + 0.05 + dt * 0.36, xx[: int(0.5 * SR)], 0.12, 0)
for td in (0.25, 1.15, 2.0):
    fl.add(fl0 + td, tok(YNG_F, 0.3, 0.8), 0.22, -0.3)
fl.add(fl0 + 0.5, crunch(1.4), 0.05, 0.2)
i0, i1 = int(fl0 * SR), int((fl0 + DUR['flash']) * SR)
for arr in (fl.L, fl.R):
    arr[i1:] = 0
    seg = arr[i0:i1]
    arr[i0:i1] = lp(seg, 3200) * env_seg(len(seg), 0.02, 0.012)
dry.L += fl.L; dry.R += fl.R

# ---- 13. end
x0 = T('end')
noise_bed(x0, x0 + DUR['end'], 300, 2200, 0.022, lfo=0.1, fade=0.3)
noise_bed(x0, x0 + DUR['end'], 3000, 9000, 0.009, lfo=0.3, fade=0.3)
noise_bed(x0 + 4.6, x0 + DUR['end'], 600, 5000, 0.02, lfo=0.2, fade=1.3)
chirps(x0 + 0.5, x0 + DUR['end'] - 1.5, 0.4, 3000, 6000, 0.009)
dry.add(x0 + X_BITE, crunch(1.7, 6.0), 0.075, 0.2)
mus.add(x0 + 2.2, pad([NOTE['D3'], NOTE['A3']], 5.3, 0.4), 0.04)
for nm, dt in (('F#4', 2.75), ('A4', 3.65), ('D5', 4.55), ('B4', 5.6), ('A4', 6.55)):
    play(x0 + dt, nm, 0.10, soft=1.5, rev=0.9)
dry.add(x0 + X_DOZE[0] + 0.3, sigh(1.3, 0.8), 0.07, -0.3)
dry.add(x0 + X_DOZE[1] - 0.15, thump(58, 0.3), 0.16, -0.3)

# ------------------------------------------------------------------ mix
def reverb(bus, dur=2.4, seed=5):
    r = np.random.default_rng(seed)
    n = int(dur * SR); t = np.arange(n) / SR
    out = []
    for ch in (bus.L, bus.R):
        ir = r.standard_normal(n) * np.exp(-t / 0.55) * (t > 0.012)
        ir = lp(ir, 5200); ir /= np.sqrt((ir ** 2).sum())
        out.append(fftconvolve(ch, ir)[:N])
    return out


wl, wr = reverb(wet)
ml, mr = reverb(mus, 2.0, 9)
Lm = dry.L + amb.L + mus.L + 0.9 * wl + 0.25 * ml
Rm = dry.R + amb.R + mus.R + 0.9 * wr + 0.25 * mr
# the cut: everything stops when the picture does
cut = int(T('end', DUR['end']) * SR)
ramp = int(0.006 * SR)
for a in (Lm, Rm):
    a[cut - ramp:cut] *= np.linspace(1, 0, ramp)
    a[cut:] = 0
# open
fi = int(1.2 * SR)
Lm[:fi] *= np.linspace(0, 1, fi) ** 1.5; Rm[:fi] *= np.linspace(0, 1, fi) ** 1.5
st = np.stack([Lm, Rm], 1)
st = hp(st.T, 28).T
peak = np.abs(st).max()
st = np.tanh(st / peak * 1.05) / np.tanh(1.05) * 0.84
print('peak before', peak, 'rms', np.sqrt((st ** 2).mean()))
wavfile.write(f'{WORK}/soundtrack.wav', SR, (st * 32767).astype(np.int16))
print('wrote', f'{WORK}/soundtrack.wav', N / SR)
