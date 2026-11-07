#!/usr/bin/env python3
"""Synthesise the whole soundtrack of "2030: My Phone Has AGI" from the timeline cue list.
Everything is generated here from oscillators, noise and filters: original chimes, keyboard clicks, swooshes,
ringtone, phone-line voice murmur (formant synthesis, no real speech), haptic thumps, the lock click.
It is what the phone itself plays (screen-recording app audio): dry, close, mostly centred.
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
TT = data.get('T', {})
N = int(DUR * SR) + SR
rng = np.random.default_rng(2030)


def t_(d):
    return np.arange(int(d * SR)) / SR


def env_exp(d, tau, attack=0.002):
    e = np.exp(-t_(d) / tau)
    a = int(attack * SR)
    if a > 0:
        e[:a] *= np.linspace(0, 1, a)
    return e


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo / (SR / 2), min(hi / (SR / 2), 0.99)], 'band', output='sos')
    return signal.sosfilt(sos, x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f / (SR / 2), 'low', output='sos'), x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f / (SR / 2), 'high', output='sos'), x)


def reson(x, f, q):
    b, a = signal.iirpeak(min(f, SR / 2 - 100) / (SR / 2), q)
    return signal.lfilter(b, a, x)


def noise(d, r=None):
    return (r or rng).standard_normal(int(d * SR))


def norm(x, peak=1.0):
    return x / (np.max(np.abs(x)) + 1e-12) * peak


def fade(x, a=0.002, b=0.01):
    x = x.copy(); na, nb = int(a * SR), int(b * SR)
    if na: x[:na] *= np.linspace(0, 1, na)
    if nb: x[-nb:] *= np.linspace(1, 0, nb)
    return x


L = np.zeros(N)
R = np.zeros(N)


def add(t, x, gain=1.0, pan=0.0, width=0.0):
    i = int(round(t * SR))
    if i >= N or i < 0:
        return
    x = x[: N - i]
    gl = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2) * gain
    gr = np.sin((pan + 1) * np.pi / 4) * np.sqrt(2) * gain
    L[i:i + len(x)] += x * gl
    if width:
        d = int(0.00045 * SR)
        y = np.concatenate([np.zeros(d), x])[: len(x)]
        R[i:i + len(x)] += (x * (1 - width) + y * width) * gr
    else:
        R[i:i + len(x)] += x * gr


def db(v):
    return 10 ** (v / 20)


# ------------------------------------------------------------ tonal building blocks
def glass(f, d, tau, bright=1.0, partials=((1, 1.0), (2.0, 0.22), (3.01, 0.12), (4.2, 0.05), (5.43, 0.03))):
    t = t_(d)
    x = np.zeros_like(t)
    for m, a in partials:
        x += a * bright ** (m - 1) * np.sin(2 * np.pi * f * m * t + 0.3 * m) * np.exp(-t / (tau / (1 + 0.7 * (m - 1))))
    return fade(x, 0.003, 0.02)


def marimba(f, d=0.5, tau=0.16):
    t = t_(d)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / tau) + 0.35 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t / (tau * 0.25))
    x += 0.2 * np.sin(2 * np.pi * f * 10.6 * t) * np.exp(-t / 0.006)
    return fade(x, 0.001, 0.02)


def seq(notes, total):
    """notes: list of (offset, wave, gain)"""
    out = np.zeros(int(total * SR))
    for off, w, g in notes:
        i = int(off * SR)
        w = w[: len(out) - i]
        out[i:i + len(w)] += w * g
    return out


def chime_agi():
    # soft, glassy, rising open fifth + ninth with a shimmer; the AGI's voice
    f0 = 659.25
    x = seq([(0.0, glass(f0, 1.6, 0.55), 1.0), (0.085, glass(f0 * 1.5, 1.6, 0.6), 0.8), (0.17, glass(f0 * 2.245, 1.5, 0.5, 0.8), 0.55)], 1.9)
    t = t_(1.9)
    x += 0.06 * np.sin(2 * np.pi * f0 * 3.0 * t + 2 * np.sin(2 * np.pi * 5.5 * t)) * np.exp(-t / 0.4) * np.minimum(1, t / 0.05)
    return norm(lp(x, 9000), 0.8)


def chime_chat():
    # two quick bright plucks (original): "bip-bup"
    return norm(seq([(0, marimba(1567.98, 0.4, 0.09), 0.9), (0.105, marimba(2093.0, 0.5, 0.12), 1.0)], 0.7), 0.75)


def chime_mail():
    x = seq([(0, glass(1174.66, 1.2, 0.35, 0.7), 1.0), (0.12, glass(880.0, 1.2, 0.45, 0.7), 0.8)], 1.4)
    return norm(x, 0.7)


def chime_note(i):
    sets = {0: [(0, 1318.5), (0.09, 1760.0)], 1: [(0, 987.77), (0.07, 1479.98)], 3: [(0, 1046.5), (0.06, 1318.5), (0.12, 1567.98)]}
    ns = sets.get(i, [(0, 1174.66), (0.08, 1567.98)])
    return norm(seq([(o, marimba(f, 0.6, 0.15), 1.0) for o, f in ns], 0.9), 0.7)


def haptic(v=1.0):
    # the Taptic engine: a short low thump with a gritty buzz texture
    d = 0.06
    t = t_(d)
    f = 165 + 30 * np.exp(-t / 0.01)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * np.minimum(1, t / d)) ** 1.5
    x += 0.15 * bp(noise(d), 180, 900) * np.sin(np.pi * t / d)
    return norm(x, 0.6 * v)


def click(f=2400, q=4, d=0.03, tau=0.0025, body=0.0, bodyf=300, seed=0):
    r = np.random.default_rng(seed)
    n = noise(d, r) * env_exp(d, tau, 0.0002)
    x = reson(n, f, q) + 0.25 * reson(n, f * 1.9, 6)
    if body:
        x += body * np.sin(2 * np.pi * bodyf * t_(d)) * env_exp(d, 0.006, 0.0005)
    return fade(x, 0.0003, 0.004)


def key_click(kind, seed):
    r = np.random.default_rng(seed)
    if kind == 'del':
        x = click(1300 + r.random() * 100, 3, 0.04, 0.003, 0.9, 210, seed)
    elif kind in ('space', 'mod'):
        x = click(1650 + r.random() * 120, 3, 0.035, 0.0028, 0.6, 240, seed)
    else:
        x = click(2300 + r.random() * 260, 4, 0.03, 0.0022, 0.35, 330, seed)
    return norm(x, 0.55)


def swoosh(d, f0, f1, q=1.6, seed=1, curve=1.0):
    r = np.random.default_rng(seed)
    n = r.standard_normal(int(d * SR))
    out = np.zeros_like(n)
    blk = 128
    zi = None
    for i in range(0, len(n), blk):
        u = (i / len(n)) ** curve
        fc = f0 * (f1 / f0) ** u
        sos = signal.butter(2, [fc / q / (SR / 2), min(fc * q / (SR / 2), 0.99)], 'band', output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        y, zi = signal.sosfilt(sos, n[i:i + blk], zi=zi)
        out[i:i + blk] = y
    t = t_(d)
    out *= np.sin(np.pi * np.minimum(1, t / d)) ** 2
    return norm(out, 1.0)


def snd_send(v=1.0):
    x = swoosh(0.32, 700, 5200, 1.5, 3, 0.8) * 0.8
    t = t_(0.2)
    s = np.sin(2 * np.pi * np.cumsum(500 * 2 ** (t * 9)) / SR) * np.sin(np.pi * t / 0.2) * 0.18
    out = np.zeros(int(0.4 * SR)); out[:len(x)] += x; out[int(0.05 * SR):int(0.05 * SR) + len(s)] += s
    return norm(out, 0.55 * v)


def snd_recv():
    return norm(seq([(0, marimba(1174.66, 0.4, 0.07), 0.8), (0.07, marimba(880.0, 0.5, 0.1), 1.0)], 0.6), 0.6)


def snd_agirecv():
    x = seq([(0, glass(987.77, 0.9, 0.3, 0.6), 1.0), (0.06, glass(1479.98, 0.9, 0.25, 0.6), 0.45)], 1.0)
    return norm(x, 0.55)


def snd_drop():
    t = t_(0.25)
    f = 900 * np.exp(-t / 0.03) + 420
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.06)
    return norm(fade(x, 0.001, 0.02), 0.6)


def snd_success():
    return norm(seq([(0, glass(1046.5, 0.6, 0.18, 0.6), 1.0), (0.09, glass(1567.98, 0.8, 0.25, 0.6), 1.0)], 0.9), 0.6)


def snd_build(i):
    x = swoosh(0.14, 1800, 5200, 1.4, 40 + i, 1.0) * 0.35
    c = click(3000 + i * 120, 5, 0.02, 0.002, 0.3, 500, 90 + i) * 0.7
    out = np.zeros(int(0.2 * SR)); out[:len(x)] += x; out[:len(c)] += c
    return norm(out, 0.45)


def snd_mailsend():
    x = swoosh(0.55, 4200, 500, 1.6, 7, 0.7)
    return norm(x, 0.6)


def snd_lock():
    # the lock click: sharp latch + short low body
    a = click(3200, 3, 0.03, 0.0016, 0, 0, 5)
    b = click(1200, 2.5, 0.05, 0.004, 1.2, 140, 6) * 0.9
    out = np.zeros(int(0.12 * SR)); out[:len(a)] += a; i = int(0.012 * SR); out[i:i + len(b)] += b
    return norm(lp(out, 9000), 0.8)


def snd_unlock():
    return norm(click(4200, 6, 0.02, 0.0015, 0, 0, 8) * 0.6, 0.25)


def snd_dnd():
    t = t_(1.2)
    x = glass(783.99, 1.2, 0.45, 0.5) * 0.8 + glass(587.33, 1.2, 0.55, 0.5) * np.concatenate([np.zeros(int(0.1 * SR)), np.ones(int(1.1 * SR))])[: len(t)] * 0.7
    x += 0.4 * np.sin(2 * np.pi * 98 * t) * np.exp(-t / 0.18) * np.minimum(1, t / 0.01)
    return norm(lp(x, 6000), 0.6)


def ringtone(d):
    # original marimba ringtone: a 4-bar syncopated figure, loops until answered
    bpm = 132
    beat = 60 / bpm / 2
    pat = [(0, 1046.5), (1, 1318.5), (2, 1567.98), (3, 1318.5), (4.5, 1760.0), (5.5, 1567.98), (6, 1318.5), (7, 1174.66),
           (8, 987.77), (9, 1174.66), (10, 1318.5), (11, 1174.66), (12.5, 1567.98), (13.5, 1318.5), (14, 1174.66)]
    out = np.zeros(int(d * SR))
    k = 0
    while True:
        base = k * 16 * beat
        if base > d:
            break
        for st, f in pat:
            ti = base + st * beat
            if ti >= d:
                continue
            w = marimba(f, 0.6, 0.2) + 0.5 * marimba(f / 2, 0.6, 0.25)
            i = int(ti * SR)
            w = w[: len(out) - i]
            out[i:i + len(w)] += w
        k += 1
    out *= np.minimum(1, (d - t_(d)) / 0.03)
    return norm(out, 0.7)


def count_ticks(d):
    out = np.zeros(int((d + 0.2) * SR))
    t = 0.0; k = 0
    while t < d:
        u = t / d
        c = click(3600 - 800 * u, 6, 0.015, 0.0012, 0, 0, 300 + k) * (0.9 - 0.4 * u)
        i = int(t * SR); out[i:i + len(c)] += c
        t += 0.018 + 0.16 * u ** 2.2; k += 1
    return norm(out, 0.4)


# ------------------------------------------------------------ voices on the phone line (formant murmur, no words)
VOW = {'a': (800, 1200, 2600), 'e': (450, 1900, 2600), 'i': (300, 2250, 2900), 'o': (480, 850, 2500), 'u': (330, 900, 2300), 'ə': (520, 1400, 2500)}


def voice(dur, who, seed):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    mom = who == 'mom'
    # syllables
    sy = []
    tt = 0.03
    while tt < dur - 0.08:
        L_ = (0.11 + r.random() * 0.12) * (1.0 if mom else 1.12)
        sy.append((tt, L_, r.choice(list(VOW.keys())), r.random()))
        tt += L_ + (0.015 + r.random() * 0.05) + (0.12 if r.random() < 0.12 else 0)
    # pitch contour: mom expressive & warm, the AGI flat and calm
    if mom:
        f0 = 205 + 35 * np.sin(2 * np.pi * 0.9 * t + r.random() * 6) + 25 * np.exp(-((t - dur * 0.15) / 0.2) ** 2) - 30 * (t / dur) ** 2
    else:
        f0 = 112 + 4 * np.sin(2 * np.pi * 0.5 * t) - 8 * (t / dur)
    f0 *= 1 + 0.01 * np.sin(2 * np.pi * 5.5 * t)
    ph = np.cumsum(f0) / SR
    src = (2 * (ph % 1) - 1)  # sawtooth glottal source
    src = lp(src, 3800)
    amp = np.zeros(n)
    F = np.zeros((3, n))
    cur = VOW['ə']
    for (s0, Ls, v, a) in sy:
        i0, i1 = int(s0 * SR), min(n, int((s0 + Ls) * SR))
        if i1 <= i0:
            continue
        k = np.linspace(0, 1, i1 - i0)
        amp[i0:i1] = np.maximum(amp[i0:i1], np.sin(np.pi * k) ** 0.7 * (0.6 + 0.4 * a))
        tgt = VOW[v]
        for j in range(3):
            F[j, i0:i1] = cur[j] + (tgt[j] - cur[j]) * np.minimum(1, k * 3)
        cur = tgt
    for j in range(3):  # fill gaps
        m = F[j] == 0
        F[j][m] = VOW['ə'][j]
    # time-varying formant filtering, block-wise
    out = np.zeros(n)
    blk = 240
    for i in range(0, n, blk):
        seg_ = src[max(0, i - 600):i + blk]
        y = np.zeros(len(seg_))
        for j, (bw, g) in enumerate(((80, 1.0), (110, 0.55), (160, 0.25))):
            fc = F[j, min(n - 1, i)] * (1.12 if mom else 0.92)
            b, a = signal.iirpeak(fc / (SR / 2), fc / bw)
            y += g * signal.lfilter(b, a, seg_)
        out[i:i + blk] = y[-min(blk, n - i):]
    out *= lp(amp, 30)
    # consonant noise bursts at syllable onsets
    for (s0, Ls, v, a) in sy:
        if r.random() < 0.55:
            d = 0.025 + r.random() * 0.03
            b_ = hp(noise(d, r), 2500) * env_exp(d, 0.012) * 0.25
            i0 = int(s0 * SR); out[i0:i0 + len(b_)] += b_[: n - i0]
    # phone line: band limit 300-3400, mild saturation, slight muffling
    out = bp(out, 300, 3400, 3)
    out = np.tanh(norm(out, 1.0) * 1.6) / 1.6
    out = lp(out, 2600, 2) * 0.8 + out * 0.2
    return norm(out, 0.5)


def netbed(d):
    # Agent Network app audio: a low, slowly breathing pad + sparse data pings that get denser
    t = t_(d)
    pad = np.zeros_like(t)
    for f, a in ((55.0, 1.0), (82.41, 0.6), (110.0, 0.45), (164.81, 0.25), (246.94, 0.12)):
        pad += a * np.sin(2 * np.pi * f * t + 2 * np.sin(2 * np.pi * 0.11 * t + f))
    pad = lp(pad, 900) * (0.55 + 0.45 * np.sin(2 * np.pi * 0.17 * t) ** 2)
    pad *= np.minimum(1, t / 1.2) * np.minimum(1, (d - t) / 0.6)
    out = norm(pad, 0.22)
    r = np.random.default_rng(77)
    tt = 0.3
    while tt < d - 0.3:
        u = tt / d
        f = r.choice([1760, 2093, 2349.3, 2637, 3136, 3520]) * (1 if r.random() < 0.7 else 0.5)
        w = glass(f, 0.25, 0.05 + r.random() * 0.05, 0.3) * (0.08 + 0.1 * r.random())
        i = int(tt * SR); out[i:i + len(w)] += w[: len(out) - i]
        tt += max(0.035, (0.28 - 0.22 * u) * (0.4 + r.random()))
    return out


def agibed(d, t0):
    # faint low hum, breathing at the orb's pulse rate (sin(3.1 t) in the UI = 0.493 Hz)
    t = t_(d)
    ta = t + t0
    x = np.zeros_like(t)
    for f, a in ((110.0, 1.0), (164.81, 0.7), (220.0, 0.35), (246.94, 0.25), (329.63, 0.12)):
        x += a * np.sin(2 * np.pi * f * t + 0.6 * np.sin(2 * np.pi * 0.07 * ta + f))
    br = 0.6 + 0.4 * (0.5 + 0.5 * np.sin(3.1 * ta))
    x = lp(x, 700) * br
    x *= np.minimum(1, t / 0.5) * np.minimum(1, (d - t) / 0.25)
    return norm(x, 1.0)


# ------------------------------------------------------------ render cues
for c in CUES:
    t, s = c['t'], c['s']
    v = c.get('v', 1.0)
    if s == 'agi':
        add(t, chime_agi(), 0.62 * v, width=0.25)
    elif s == 'chat':
        add(t, chime_chat(), 0.55 * v)
    elif s == 'mail':
        add(t, chime_mail(), 0.55 * v, width=0.2)
    elif s == 'note':
        add(t, chime_note(c.get('i', 0)), 0.52 * v)
    elif s == 'haptic':
        add(t + 0.005, haptic(v), 0.32)
    elif s == 'unlock':
        add(t, snd_unlock(), 0.5)
    elif s == 'drop':
        add(t, snd_drop(), 0.4)
    elif s == 'tap':
        add(t, click(2800, 4, 0.02, 0.002, 0.3, 400, 3) * 0.5, 0.35)
    elif s == 'success':
        add(t, snd_success(), 0.45)
    elif s == 'send':
        add(t, snd_send(v), 0.62)
    elif s == 'recv':
        add(t, snd_recv(), 0.5)
    elif s == 'agirecv':
        add(t, snd_agirecv(), 0.5)
    elif s == 'gather':
        for k in range(6):
            add(t + 0.1 + k * 0.12 + 0.12, click(3400 + k * 150, 6, 0.015, 0.0012, 0, 0, 50 + k) * 0.6, 0.35)
    elif s == 'build':
        add(t, snd_build(c.get('i', 0)), 0.4)
    elif s == 'mailsend':
        add(t, snd_mailsend(), 0.55)
    elif s == 'key':
        add(t, key_click(c.get('k', 'key'), c.get('seed', 0)), 0.42 * v, pan=0.0)
    elif s == 'rkey':
        add(t, key_click(c.get('k', 'key'), c.get('seed', 0)), 0.3 * v)
    elif s == 'ring':
        add(t, ringtone(c['dur'] + 0.02), 0.5, width=0.2)
    elif s == 'callconnect':
        add(t, click(1800, 3, 0.03, 0.003, 0.5, 300, 12), 0.25)
    elif s == 'voice':
        add(t, voice(c['dur'], c['who'], 400 + c.get('i', 0)), 0.62 if c['who'] == 'mom' else 0.58)
    elif s == 'callend':
        e = seq([(0, glass(659.25, 0.25, 0.08, 0.3), 1.0), (0.16, glass(523.25, 0.3, 0.1, 0.3), 1.0)], 0.5)
        add(t, norm(e, 0.5), 0.45)
    elif s == 'netbed':
        add(t, netbed(c['dur']), 0.9, width=0.4)
    elif s == 'count':
        add(t, count_ticks(c['dur']), 0.45)
    elif s == 'dnd':
        add(t, snd_dnd(), 0.6, width=0.2)
    elif s == 'agibed':
        add(t, agibed(c['dur'], c['t0']), 0.022, width=0.3)
    elif s == 'lock':
        add(t, snd_lock(), 0.75)

# phone-line hiss under the active call (very low), so the call has "air"
if 'CALL_ACTIVE' in TT:
    a, b = TT['CALL_ACTIVE'], TT['CALL_END']
    d = b - a
    h = bp(noise(d), 300, 3400) * 0.004
    h *= np.minimum(1, t_(d) / 0.2) * np.minimum(1, (d - t_(d)) / 0.1)
    add(a, h, 1.0)

n = int(DUR * SR)
st = np.stack([L[:n], R[:n]], 1)
fo = int(0.05 * SR)
st[-fo:] *= np.linspace(1, 0, fo)[:, None]


# ------------------------------------------------------------ master: BS.1770 loudness to -16 LUFS, true peak < -1 dBTP
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
    return -0.691 + 10 * np.log10(np.mean(p[(l > -70) & (l > rel)]))


def true_peak(st):
    return max(np.max(np.abs(signal.resample_poly(st[:, c], 4, 1))) for c in range(2))


def compress(st, thr_db=-30, ratio=3.2, att=0.003, rel=0.15):
    # gentle bus compression to keep the loudness range in check (sparse sounds, loud chimes)
    lvl = np.max(np.abs(st), 1)
    env = signal.lfilter([1 - np.exp(-1 / (rel * SR))], [1, -np.exp(-1 / (rel * SR))], lvl)
    env = np.maximum(env, lvl * 0.0)
    e_db = 20 * np.log10(env + 1e-9)
    over = np.maximum(0, e_db - thr_db)
    g = db(-over * (1 - 1 / ratio))
    g = signal.lfilter([1 - np.exp(-1 / (att * SR))], [1, -np.exp(-1 / (att * SR))], g)
    return st * g[:, None]


def limit(st, ceiling):
    from scipy.ndimage import minimum_filter1d
    os4 = np.stack([signal.resample_poly(st[:, c], 4, 1) for c in range(2)], 1)
    pk = np.max(np.abs(os4), 1).reshape(-1, 4).max(1)[: len(st)]
    pk = np.pad(pk, (0, len(st) - len(pk)))
    need = np.minimum(1.0, ceiling / np.maximum(pk, 1e-9))
    look = int(0.002 * SR)
    g = minimum_filter1d(need, size=2 * look + 1)
    relc = np.exp(-1 / (0.06 * SR))
    out = np.empty_like(g); cur = 1.0
    for i in range(len(g)):
        cur = g[i] if g[i] < cur else cur * relc + g[i] * (1 - relc)
        out[i] = cur
    out = np.convolve(out, np.ones(look) / look, mode='same')
    return st * np.minimum(out, need)[:, None] if False else st * out[:, None]


st = st * db(-16 - lufs(st))
st = compress(st)
for it in range(5):
    st = st * db(-16 - lufs(st))
    if true_peak(st) > db(-1.4):
        st = limit(st, db(-1.5))
    lv, tp = lufs(st), 20 * np.log10(true_peak(st))
    print(f'pass {it}: {lv:.2f} LUFS, true peak {tp:.2f} dBTP')
    if abs(lv + 16) < 0.15 and tp < -1.2:
        break
from scipy.io import wavfile
wavfile.write(out_path, SR, st.astype(np.float32))
print('written', out_path, len(st) / SR, 's')
