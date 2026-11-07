#!/usr/bin/env python3
"""Synthesise the full sound design for "Clippy Achieves AGI" from the timeline cue list.
Every sound is generated here from oscillators, noise and filters (no samples).
usage: python3 audio.py cues.json out.wav
"""
import json, sys
import numpy as np
from scipy import signal

SR = 48000
cues_path, out_path = sys.argv[1], sys.argv[2]
data = json.load(open(cues_path))
DUR = float(data['duration'])
CUES = data['cues']
N = int(DUR * SR) + SR
rng = np.random.default_rng(1998)

# ---------------------------------------------------------------- helpers
def t_(d):
    return np.arange(int(d * SR)) / SR

def env_exp(d, tau, attack=0.002):
    t = t_(d)
    e = np.exp(-t / tau)
    a = int(attack * SR)
    if a > 0:
        e[:a] *= np.linspace(0, 1, a)
    return e

def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo / (SR / 2), min(hi / (SR / 2), 0.99)], 'band', output='sos')
    return signal.sosfilt(sos, x)

def lp(x, f, order=2):
    sos = signal.butter(order, f / (SR / 2), 'low', output='sos')
    return signal.sosfilt(sos, x)

def hp(x, f, order=2):
    sos = signal.butter(order, f / (SR / 2), 'high', output='sos')
    return signal.sosfilt(sos, x)

def reson(x, f, q):
    b, a = signal.iirpeak(f / (SR / 2), q)
    return signal.lfilter(b, a, x)

def noise(d, r=None):
    r = r or rng
    return r.standard_normal(int(d * SR))

def norm(x, peak=1.0):
    m = np.max(np.abs(x)) + 1e-12
    return x / m * peak

def sine(f, d, ph=0):
    t = t_(d)
    if np.ndim(f) == 0:
        return np.sin(2 * np.pi * f * t + ph)
    return np.sin(2 * np.pi * np.cumsum(f) / SR + ph)

mixL = np.zeros(N)
mixR = np.zeros(N)
sysL = np.zeros(N)   # sounds that come out of the PC speakers (get speaker EQ + room)
sysR = np.zeros(N)

def add(buf, t, x, gain=1.0, pan=0.0, sysbus=False):
    i = int(round(t * SR))
    if i >= N:
        return
    x = x[: N - i]
    gl = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2) * gain
    gr = np.sin((pan + 1) * np.pi / 4) * np.sqrt(2) * gain
    if sysbus:
        sysL[i:i + len(x)] += x * gl
        sysR[i:i + len(x)] += x * gr
    else:
        mixL[i:i + len(x)] += x * gl
        mixR[i:i + len(x)] += x * gr

def db(v):
    return 10 ** (v / 20)

# ---------------------------------------------------------------- physical sounds (room mic)
def mouse_click(seed):
    r = np.random.default_rng(seed)
    out = np.zeros(int(0.16 * SR))
    for k, (off, g) in enumerate([(0.0, 1.0), (0.055 + r.random() * 0.02, 0.6)]):
        n = noise(0.03, r) * env_exp(0.03, 0.0016, 0.0002)
        body = reson(n, 1800 + r.random() * 300, 6) * 0.8 + reson(n, 4200 + r.random() * 500, 9) * 0.6 + hp(n, 6000) * 0.25
        body += sine(320 + r.random() * 40, 0.03) * env_exp(0.03, 0.004) * 0.25
        i = int(off * SR)
        out[i:i + len(body)] += body * g
    return norm(out, 0.55)

def key_sound(kind, seed):
    r = np.random.default_rng(seed)
    d = 0.22
    out = np.zeros(int(d * SR))
    low_f = {'space': 150, 'enter': 190, 'back': 230}.get(kind, 210 + r.random() * 60)
    g = {'space': 1.1, 'enter': 1.25}.get(kind, 0.85 + r.random() * 0.25)
    # press: plastic clack + dome thump
    n = noise(0.05, r) * env_exp(0.05, 0.004, 0.0003)
    clack = reson(n, 1500 + r.random() * 900, 4) + 0.5 * reson(n, 3200 + r.random() * 1200, 6)
    thump = sine(low_f * (1 + 0.3 * np.exp(-t_(0.06) / 0.01)), 0.06) * env_exp(0.06, 0.012, 0.001)
    press = np.zeros(max(len(clack), len(thump)))
    press[:len(clack)] += clack * 0.9
    press[:len(thump)] += thump * 1.2
    if kind == 'space':
        rattle = reson(noise(0.06, r) * env_exp(0.06, 0.015), 900, 3) * 0.6
        press[:len(rattle)] += rattle
    out[:len(press)] += press
    # release, quieter, 70-110 ms later
    off = int((0.07 + r.random() * 0.04) * SR)
    n2 = noise(0.03, r) * env_exp(0.03, 0.003, 0.0003)
    rel = reson(n2, 2200 + r.random() * 800, 5) * 0.45
    out[off:off + len(rel)] += rel
    return norm(out, 0.5 * g)

def hdd_seek(seed, strength=1.0):
    r = np.random.default_rng(seed)
    d = 0.02 + r.random() * 0.05
    n = noise(d, r)
    tick = reson(n * env_exp(d, 0.0025, 0.0002), 2600 + r.random() * 1500, 8) * 1.0
    buzz = reson(n * env_exp(d, d * 0.4), 700 + r.random() * 600, 5) * 0.35 * r.random()
    return (tick + buzz) * strength

def hdd(t0, dur, dens, gain=1.0, seed=0):
    r = np.random.default_rng(int(t0 * 1000) + seed)
    t = t0
    while t < t0 + dur:
        add(mixL, t, hdd_seek(int(t * 10000) % 100000, 0.5 + r.random() * 0.5), gain * 0.24, pan=0.35)
        t += (0.012 + r.random() * 0.09) / max(0.2, dens)

# ---------------------------------------------------------------- system sounds (own compositions; out of the PC speakers)
def bell(f, d, tau, partials=((1, 1.0), (2.76, 0.35), (5.4, 0.12), (8.93, 0.05))):
    t = t_(d)
    x = np.zeros_like(t)
    for m, a in partials:
        x += a * np.sin(2 * np.pi * f * m * t) * np.exp(-t / (tau / (1 + 0.6 * (m - 1))))
    a = int(0.002 * SR)
    x[:a] *= np.linspace(0, 1, a)
    return x

def ding(pitch=1.0):
    x = bell(1318 * pitch, 1.0, 0.32) + 0.5 * bell(1975 * pitch, 1.0, 0.22)
    return norm(x, 0.7)

def chord(pitch=1.0):
    # bright soft-synth chord, quick strum (own voicing: D maj9 over A)
    notes = [220.0, 293.66, 369.99, 440.0, 554.37, 659.25]
    d = 1.3
    x = np.zeros(int(d * SR))
    for k, f in enumerate(notes):
        f *= pitch
        t = t_(d - k * 0.012)
        mod = np.sin(2 * np.pi * f * 2 * t) * 1.4 * np.exp(-t / 0.15)
        v = np.sin(2 * np.pi * f * t + mod) * np.exp(-t / 0.55)
        v[:96] *= np.linspace(0, 1, 96)
        i = int(k * 0.012 * SR)
        x[i:i + len(v)] += v * (0.9 if k else 1.1)
    return norm(x, 0.75)

def mail_chime():
    x = np.zeros(int(0.9 * SR))
    for k, f in enumerate([1046.5, 1568.0]):
        v = bell(f, 0.7, 0.25, ((1, 1), (3.0, 0.2), (4.2, 0.08)))
        i = int(k * 0.11 * SR)
        x[i:i + len(v)] += v
    return norm(x, 0.6)

def tada():
    x = np.zeros(int(1.1 * SR))
    for k, f in enumerate([784.0, 987.8, 1174.7, 1568.0]):
        v = bell(f, 0.8, 0.3, ((1, 1), (2, 0.3), (3, 0.15)))
        i = int(k * 0.07 * SR)
        x[i:i + len(v)] += v * (1.3 if k == 3 else 1)
    return norm(x, 0.6)

def pop():
    d = 0.09
    t = t_(d)
    f = 1100 * np.exp(-t / 0.012) + 280
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.025)
    x[:48] *= np.linspace(0, 1, 48)
    return norm(x, 0.7)

def balloon_pop():
    x = pop() * 0.7
    y = bell(1760, 0.3, 0.07, ((1, 1), (2, 0.2))) * 0.3
    out = np.zeros(int(0.3 * SR)); out[:len(x)] += x; out[:len(y)] += y
    return norm(out, 0.55)

def boing(d=0.55):
    t = t_(d)
    f = 260 + 180 * np.exp(-t / 0.05) + 40 * np.sin(2 * np.pi * 17 * t) * np.exp(-t / 0.2)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.18)
    x += 0.3 * np.sin(2 * np.pi * np.cumsum(f * 2.01) / SR) * np.exp(-t / 0.1)
    x[:48] *= np.linspace(0, 1, 48)
    return norm(x, 0.7)

def arrive():
    # paper flutter, wire bending into shape (rising springy plucks), a rising "bwoop"
    d = 1.3
    out = np.zeros(int(d * SR))
    fl = bp(noise(0.3), 1500, 7000) * env_exp(0.3, 0.08, 0.02) * 0.25
    out[:len(fl)] += fl
    for k in range(9):
        f = 500 * 2 ** (k / 7)
        tt = t_(0.12)
        v = np.sin(2 * np.pi * f * tt + 2.0 * np.sin(2 * np.pi * f * 1.5 * tt)) * np.exp(-tt / 0.03) * 0.45
        i = int((0.18 + k * 0.075) * SR)
        out[i:i + len(v)] += v
    tt = t_(0.5)
    f = 180 * 2 ** (tt * 4.2) + 15 * np.sin(2 * np.pi * 9 * tt)
    sw = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / 0.5) ** 1.5 * 0.5
    i = int(0.42 * SR)
    out[i:i + len(sw)] += sw
    return norm(out, 0.65)

def tick(seed, f0=5500, d=0.012):
    r = np.random.default_rng(seed)
    n = noise(d, r) * env_exp(d, 0.0012, 0.0001)
    return reson(n, f0 * (0.9 + 0.2 * r.random()), 7)

def whoosh(d=0.32, up=True):
    n = noise(d)
    t = t_(d)
    out = np.zeros_like(n)
    # time-varying band-pass via short blocks
    blk = 256
    zi = None
    for i in range(0, len(n), blk):
        u = i / len(n)
        fc = 500 + 3500 * (np.sin(np.pi * u) if up else 1 - u)
        sos = signal.butter(2, [fc * 0.6 / (SR / 2), min(fc * 1.6 / (SR / 2), 0.99)], 'band', output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        y, zi = signal.sosfilt(sos, n[i:i + blk], zi=zi)
        out[i:i + blk] = y
    out *= np.sin(np.pi * t / d) ** 2
    return norm(out, 0.6)

def snap():
    d = 0.12
    t = t_(d)
    th = np.sin(2 * np.pi * (90 + 120 * np.exp(-t / 0.01)) * t) * np.exp(-t / 0.03)
    cl = tick(7, 3000, 0.02) * 0.6
    out = th * 0.8
    out[:len(cl)] += cl
    return norm(out, 0.6)

def send():
    w = whoosh(0.55, True)
    t = t_(0.35)
    f = 400 * 2 ** (t * 6)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.35) * 0.25
    out = np.zeros(int(0.6 * SR)); out[:len(w)] += w; out[int(0.1 * SR):int(0.1 * SR) + len(s)] += s
    return norm(out, 0.6)

def chartgrow():
    out = np.zeros(int(0.9 * SR))
    for k in range(9):
        v = bell(700 * 2 ** (k / 9), 0.15, 0.04, ((1, 1), (2, 0.3)))
        i = int(k * 0.08 * SR)
        out[i:i + len(v)] += v * 0.5
    return norm(out, 0.4)

def redeye():
    d = 1.6
    t = t_(d)
    f = 8000 + 6000 * (t / d) ** 2
    wh = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.08 * np.minimum(1, t / 0.3)
    hum = (np.sin(2 * np.pi * 60 * t) + 0.6 * np.sin(2 * np.pi * 120 * t) + 0.4 * np.sign(np.sin(2 * np.pi * 60 * t)) * 0.3) * 0.5
    sw = hum * np.minimum(1, t / 0.4) * (0.6 + 0.4 * np.sin(2 * np.pi * 3 * t) ** 2)
    out = lp(sw, 900) + wh
    out *= np.minimum(1, (d - t) / 0.1)
    return norm(out, 0.7)

def shutdown():
    # own composition: warm pad (Eb maj9) under a slow descending bell figure, long tail
    d = 5.5
    t = t_(d)
    out = np.zeros(len(t))
    pad_notes = [155.56, 233.08, 311.13, 392.0, 466.16, 587.33]
    for k, f in enumerate(pad_notes):
        ph = rng.random() * 6
        v = np.zeros(len(t))
        for det in (-0.25, 0.0, 0.25):
            v += np.sin(2 * np.pi * (f * (1 + det / 100)) * t + ph + det)
        v *= (np.minimum(1, t / 0.5) * np.exp(-np.maximum(0, t - 1.0) / 1.6)) * 0.22
        out += v
    for k, (f, at) in enumerate([(1174.66, 0.05), (932.33, 0.42), (783.99, 0.79), (622.25, 1.16), (466.16, 1.7)]):
        v = bell(f, d - at, 0.9 if k < 4 else 1.8, ((1, 1), (2.0, 0.25), (3.0, 0.1), (4.1, 0.05)))
        i = int(at * SR)
        out[i:i + len(v)] += v * (0.55 if k < 4 else 0.7)
    out = lp(out, 7000)
    return norm(out, 0.8)

# ---------------------------------------------------------------- room tone (fan + CRT whine + HDD spin)
def room_tone(n, end_t):
    t = np.arange(n) / SR
    fan = lp(rng.standard_normal(n), 420, 2) * 0.9 + bp(rng.standard_normal(n), 900, 3000) * 0.08
    fan *= 1 + 0.05 * np.sin(2 * np.pi * 0.31 * t)
    spin = 0.15 * np.sin(2 * np.pi * 119.7 * t) + 0.06 * np.sin(2 * np.pi * 239.4 * t)
    whine = 0.05 * np.sin(2 * np.pi * 15734 * t)
    # power-down: whine stops at the cut, fan and spindle wind down over ~3 s
    k = np.clip((t - end_t) / 3.0, 0, 1)
    wind = np.where(t < end_t, 1.0, np.clip(1 - k, 0, 1) ** 1.5)
    spin_f = np.where(t < end_t, 1.0, 1 - 0.7 * k)
    spin2 = 0.15 * np.sin(2 * np.pi * np.cumsum(119.7 * spin_f) / SR)
    spin = np.where(t < end_t, spin, spin2)
    whine = np.where(t < end_t, whine, 0)
    return fan * 0.03 * wind + spin * 0.014 * wind + whine * 0.024

# ---------------------------------------------------------------- render cues
T_FREEZE = T_VANISH = None
grind_events = []
for c in CUES:
    t, s = c['t'], c['s']
    v = c.get('v', 1.0)
    pan = c.get('pan', 0.0)
    if s == 'click':
        add(mixL, t, mouse_click(int(t * 1000)), 0.9 * v, pan=0.25)
    elif s == 'key':
        add(mixL, t, key_sound(c.get('k', 'key'), c.get('seed', 0)), 0.75, pan=-0.1 + 0.2 * ((c.get('seed', 0) % 7) / 7 - 0.5))
    elif s == 'hdd':
        hdd(t, c.get('dur', 1), c.get('dens', 1))
    elif s == 'grind':
        grind_events.append(c)
    elif s == 'ding':
        add(sysL, t, ding(c.get('pitch', 1.0)), 0.55 * v, sysbus=True, pan=(c.get('pitch', 1) - 1.05) * 1.5)
    elif s == 'chord':
        add(sysL, t, chord(c.get('pitch', 1.0)), 0.6 * v, sysbus=True)
    elif s == 'mail':
        add(sysL, t, mail_chime(), 0.42 * v, sysbus=True)
    elif s == 'tada':
        add(sysL, t, tada(), 0.5 * v, sysbus=True)
    elif s == 'pop':
        add(sysL, t, pop(), 0.5 * v, sysbus=True)
    elif s == 'balloon':
        add(sysL, t, balloon_pop(), 0.5 * v, sysbus=True)
    elif s == 'boing':
        add(sysL, t, boing(), 0.45 * v, sysbus=True)
    elif s == 'arrive':
        add(sysL, t, arrive(), 0.55 * v, sysbus=True)
    elif s == 'ctick':
        add(sysL, t, tick(int(t * 1e4), 5200), 0.24 * v, sysbus=True, pan=-0.2)
    elif s == 'xtick':
        add(sysL, t, tick(c.get('seed', 0) + 500, 2600, 0.02), 0.36 * v, sysbus=True)
    elif s == 'uiclick':
        add(sysL, t, tick(int(t * 1e3), 3200, 0.02), 0.42 * v, sysbus=True)
    elif s == 'shuffle':
        for k in range(10):
            add(sysL, t + k * 0.022, tick(900 + k, 2000 + k * 250, 0.015), 0.16, sysbus=True)
    elif s == 'chartgrow':
        add(sysL, t, chartgrow(), 0.5, sysbus=True)
    elif s == 'whoosh':
        add(sysL, t, whoosh(), 0.42 * v, sysbus=True, pan=pan)
    elif s == 'snap':
        add(sysL, t, snap(), 0.55 * v, sysbus=True)
    elif s == 'send':
        add(sysL, t, send(), 0.55 * v, sysbus=True)
    elif s == 'redeye':
        add(sysL, t, redeye(), 0.4, sysbus=True)
    elif s == 'stutter':
        pass
    elif s == 'buzz':
        T_FREEZE, T_VANISH = t, t + c['dur']
    elif s == 'shutdown':
        add(sysL, t + 0.15, shutdown(), 0.75, sysbus=True)
        T_BLACK = t

# haywire HDD grind: dense, accelerating seeks
for g in grind_events:
    t0, d = g['t'], g['dur']
    r = np.random.default_rng(42)
    t = t0
    while t < t0 + d:
        u = (t - t0) / d
        dens = g['a'] + (g['b'] - g['a']) * u
        add(mixL, t, hdd_seek(int(t * 1e5) % 99999, 0.6 + 0.4 * r.random()), (0.12 + 0.12 * u), pan=0.35)
        t += (0.008 + r.random() * 0.05) / (0.5 + 3 * dens)
    # low rumble of the drive working hard
    tt = t_(d)
    rum = lp(rng.standard_normal(len(tt)), 300) * (0.2 + 0.8 * (tt / d)) * 0.25
    add(mixL, t0, rum, 0.5, pan=0.35)

# ---------------------------------------------------------------- PC-speaker colour for system sounds + small room
def speaker(x):
    y = hp(x, 180, 2)
    y = lp(y, 9000, 2)
    y = reson(y, 2400, 1.2) * 0.25 + y
    y = np.tanh(y * 1.4) / 1.4
    return y

def room_ir():
    d = 0.35
    t = t_(d)
    ir = rng.standard_normal(len(t)) * np.exp(-t / 0.07)
    ir = lp(ir, 5000)
    ir[0] = 0
    ir = ir / np.sqrt(np.sum(ir ** 2)) * 0.25
    ir[0] = 1.0
    return ir

IR = room_ir()
sysL = signal.fftconvolve(speaker(sysL), IR)[:N]
sysR = signal.fftconvolve(speaker(sysR), IR)[:N]
L = mixL + sysL * 0.95
R = mixR + sysR * 0.95

# ---------------------------------------------------------------- the hang: sound card loops its last buffer
if T_FREEZE is not None:
    i0, i1 = int(T_FREEZE * SR), int(T_VANISH * SR)
    loop = int(0.046 * SR)
    segL, segR = L[i0 - loop:i0].copy(), R[i0 - loop:i0].copy()
    reps = (i1 - i0) // loop + 1
    bl = np.tile(segL, reps)[: i1 - i0]
    br = np.tile(segR, reps)[: i1 - i0]
    gain = np.linspace(1.0, 0.85, i1 - i0)
    L[i0:i1] = bl * gain
    R[i0:i1] = br * gain
    # after the hang, the machine is quiet; everything that was still ringing is gone
    tail_end = i1 + int(0.02 * SR)
    # remove sounds started before the freeze that would ring past the vanish point
    keep = np.zeros(N)
    # rebuild post-vanish audio only from cues after T_VANISH
    L[i1:] = 0
    R[i1:] = 0
    post = [c for c in CUES if c['t'] >= T_VANISH - 1e-6]
    pL = np.zeros(N); pR = np.zeros(N)
    for c in post:
        t, s, v = c['t'], c['s'], c.get('v', 1.0)
        x = None; g = 0.5
        if s == 'click': x, g, sysb = mouse_click(int(t * 1000)), 0.9, False
        elif s == 'pop': x, g, sysb = pop(), 0.5 * v, True
        elif s == 'boing': x, g, sysb = boing(), 0.45 * v, True
        elif s == 'balloon': x, g, sysb = balloon_pop(), 0.5, True
        elif s == 'shutdown': x, g, sysb = shutdown(), 0.75, True; t += 0.15
        if x is None: continue
        if sysb:
            x = np.convolve(speaker(x), IR)[: len(x) + len(IR) - 1]
        i = int(t * SR); x = x[: N - i]
        pL[i:i + len(x)] += x * g; pR[i:i + len(x)] += x * g
    L[i1:] += pL[i1:]
    R[i1:] += pR[i1:]
    # tiny click at the cut-out of the stuck buffer
    c = tick(5, 1500, 0.01) * 0.2
    L[i1:i1 + len(c)] += c; R[i1:i1 + len(c)] += c

# room tone everywhere (continues through the hang), power-down at the black cut
T_BLACK = [c['t'] for c in CUES if c['s'] == 'shutdown'][0]
rt = room_tone(N, T_BLACK)
L += rt
R += rt * 0.97 + np.roll(rt, 37) * 0.03
# CRT power-off thunk at the cut
th = lp(noise(0.25) * env_exp(0.25, 0.05), 200) * 0.6 + sine(55, 0.25) * env_exp(0.25, 0.06) * 0.5
i = int(T_BLACK * SR)
L[i:i + len(th)] += th * 0.5; R[i:i + len(th)] += th * 0.5

# trim to film length, fades
n = int(DUR * SR)
L, R = L[:n], R[:n]
f = int(0.03 * SR)
L[:f] *= np.linspace(0, 1, f); R[:f] *= np.linspace(0, 1, f)
fo = int(0.5 * SR)
L[-fo:] *= np.linspace(1, 0, fo) ** 2; R[-fo:] *= np.linspace(1, 0, fo) ** 2
st = np.stack([L, R], 1)

# ---------------------------------------------------------------- master: BS.1770 loudness to -16 LUFS, true peak < -1 dBTP
def kweight(x):
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x))

def lufs(st):
    k = np.stack([kweight(st[:, 0]), kweight(st[:, 1])], 1)
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    p = np.array([np.sum(np.mean(k[i:i + blk] ** 2, 0)) for i in range(0, len(k) - blk, hop)])
    l = -0.691 + 10 * np.log10(p + 1e-20)
    g = p[l > -70]
    rel = -0.691 + 10 * np.log10(np.mean(g)) - 10
    g2 = p[(l > -70) & (l > rel)]
    return -0.691 + 10 * np.log10(np.mean(g2))

def true_peak(st):
    return max(np.max(np.abs(signal.resample_poly(st[:, c], 4, 1))) for c in range(2))

def limit(st, ceiling):
    os4 = np.stack([signal.resample_poly(st[:, c], 4, 1) for c in range(2)], 1)
    pk = np.max(np.abs(os4), 1).reshape(-1, 4).max(1)[: len(st)]
    pk = np.pad(pk, (0, len(st) - len(pk)))
    need = np.minimum(1.0, ceiling / np.maximum(pk, 1e-9))
    look = int(0.003 * SR)
    from scipy.ndimage import minimum_filter1d
    g = minimum_filter1d(need, size=2 * look + 1)
    # smooth: fast attack (already ahead via the min filter), ~80 ms release
    rel = np.exp(-1 / (0.08 * SR))
    out = np.empty_like(g); cur = 1.0
    for i in range(len(g)):
        cur = g[i] if g[i] < cur else cur * rel + g[i] * (1 - rel)
        out[i] = cur
    out = np.convolve(out, np.ones(look) / look, mode='same')
    return st * np.minimum(out, need * 1.0 + 0 * out)[:, None] if False else st * out[:, None]

target = -16.0
for it in range(4):
    L0 = lufs(st)
    st = st * db(target - L0)
    tp = true_peak(st)
    if tp > db(-1.5):
        st = limit(st, db(-1.6))
    print(f'pass {it}: loudness {lufs(st):.2f} LUFS, true peak {20*np.log10(true_peak(st)):.2f} dBTP')
    if abs(lufs(st) - target) < 0.1 and true_peak(st) < db(-1.2):
        break
from scipy.io import wavfile
wavfile.write(out_path, SR, st.astype(np.float32))
print('written', out_path, len(st) / SR, 's')
