#!/usr/bin/env python3
"""
UNFORGOTTEN -- Episode 1, part 1 (0:00-5:00)
Score + sound effects + ambience generator (no dialogue).

Everything is synthesised from scratch with numpy + scipy: no samples.
Re-run from anywhere:
    <venv>/bin/python ep1/audio/make_audio.py
Outputs (next to this script):
    score_sfx.wav  -- full mix, 48 kHz / 16-bit / stereo / exactly 300.0 s
    music.wav, sfx.wav, amb.wav -- stems (same format, same gain; they sum to the mix)
    spectrogram.png, levels.json -- verification
"""
import os
import sys
import time
import zlib
import json
from functools import lru_cache

import numpy as np
import soundfile as sf
from scipy import signal
from scipy.ndimage import minimum_filter1d, uniform_filter1d

SR = 48000
DUR = 300.0
N = int(round(DUR * SR))
HERE = os.path.dirname(os.path.abspath(__file__))
_T0 = time.time()


def log(*a):
    print(f"[{time.time() - _T0:6.1f}s]", *a, flush=True)


# =====================================================================
#  basic helpers
# =====================================================================
def db(x):
    return float(10.0 ** (x / 20.0))


def ts(t):
    return int(round(t * SR))


def ns(d):
    return max(1, int(round(d * SR)))


def tv(n):
    return np.arange(n) / SR


def R(name):
    return np.random.default_rng(zlib.crc32(name.encode()))


_NI = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def mid(n):
    if not isinstance(n, str):
        return float(n)
    i, acc = 1, 0
    while n[i] in '#b':
        acc += 1 if n[i] == '#' else -1
        i += 1
    return 12 * (int(n[i:]) + 1) + _NI[n[0]] + acc


def mhz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def hz(n):
    if not isinstance(n, str):
        return float(n)
    return mhz(mid(n))


def ar(n, a=0.005, r=0.05):
    """raised-cosine attack / release envelope"""
    e = np.ones(n)
    na = min(n, int(a * SR)) if a > 0 else 0
    nr = min(n - na, int(r * SR)) if r > 0 else 0
    if na > 0:
        e[:na] = 0.5 - 0.5 * np.cos(np.pi * np.arange(na) / na)
    if nr > 0:
        e[n - nr:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(1, nr + 1) / nr)
    return e


def pts(n, points, dbs=False):
    """piecewise-linear envelope from (time, value) points; dbs -> values in dB"""
    x = [p[0] for p in points]
    y = [p[1] for p in points]
    v = np.interp(tv(n), x, y)
    return 10.0 ** (v / 20.0) if dbs else v


def rms(x):
    return float(np.sqrt(np.mean(np.square(x))) + 1e-12)


def normp(x, p=1.0):
    m = float(np.max(np.abs(x)))
    return x * (p / m) if m > 0 else x


def pan(x, p):
    th = (np.clip(p, -1, 1) + 1) * np.pi / 4
    return np.stack([x * np.cos(th), x * np.sin(th)])


def mixa(*xs):
    """sum mono/stereo arrays of different lengths (zero-padded; stereo if any input is)"""
    n = max(x.shape[-1] for x in xs)
    stereo = any(x.ndim == 2 for x in xs)
    out = np.zeros((2, n)) if stereo else np.zeros(n)
    for x in xs:
        if stereo and x.ndim == 1:
            x = pan(x, 0.0)
        out[..., :x.shape[-1]] += x
    return out


def lgauss(F, fc, w):
    return np.exp(-0.5 * (np.log2(np.maximum(F, 1.0) / fc) / w) ** 2)


def drift(n, rate, rng):
    """smooth random curve, ~unit variance, changing at `rate` Hz"""
    k = int(n / SR * rate) + 3
    p = rng.standard_normal(k)
    u = np.arange(n) / SR * rate
    i = u.astype(np.int64)
    fr = u - i
    w = (1 - np.cos(np.pi * fr)) / 2
    return p[i] * (1 - w) + p[i + 1] * w


# =====================================================================
#  filters
# =====================================================================
@lru_cache(maxsize=None)
def _sos(kind, a, b, order):
    ny = SR / 2
    if kind == 'low':
        return signal.butter(order, min(a, ny * 0.95), 'low', fs=SR, output='sos')
    if kind == 'high':
        return signal.butter(order, max(a, 5.0), 'high', fs=SR, output='sos')
    lo = max(a, 5.0)
    hi = min(b, ny * 0.95)
    if hi <= lo * 1.01:
        hi = lo * 1.02
    return signal.butter(order, [lo, hi], 'band', fs=SR, output='sos')


def lp(x, f, o=2):
    return signal.sosfilt(_sos('low', float(f), 0.0, o), x, axis=-1)


def hp(x, f, o=2):
    return signal.sosfilt(_sos('high', float(f), 0.0, o), x, axis=-1)


def bp(x, lo, hi, o=2):
    return signal.sosfilt(_sos('band', float(lo), float(hi), o), x, axis=-1)


@lru_cache(maxsize=None)
def _peak(f, q):
    return signal.iirpeak(min(f, SR * 0.45), q, fs=SR)


def reson(x, f, q):
    b, a = _peak(float(round(f, 1)), float(q))
    return signal.lfilter(b, a, x, axis=-1)


def _qf(f):
    return float(2 ** (np.round(np.log2(max(f, 10.0)) * 32) / 32))


def tvf(x, fc, kind='low', order=2, bw=1.0, block=128):
    """time-varying butterworth (block-wise coefficient update, state carried)"""
    x = np.asarray(x, float)
    n = len(x)
    fc = np.full(n, float(fc)) if np.ndim(fc) == 0 else np.asarray(fc, float)
    y = np.empty(n)
    zi = None
    for i in range(0, n, block):
        f = _qf(fc[min(i + block // 2, n - 1)])
        if kind == 'band':
            sos = _sos('band', _qf(f / 2 ** (bw / 2)), _qf(f * 2 ** (bw / 2)), order)
        else:
            sos = _sos(kind, f, 0.0, order)
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        y[i:i + block], zi = signal.sosfilt(sos, x[i:i + block], zi=zi)
    return y


def shaped_noise(dur, gfn, rng, nch=1, nper=2048):
    """noise with a time-frequency gain mask gfn(T[1,nt], F[nf,1]) (STFT domain)"""
    n = ns(dur)
    hop = nper // 4
    out = []
    for _ in range(nch):
        x = rng.standard_normal(n + nper)
        f, t, Z = signal.stft(x, fs=SR, nperseg=nper, noverlap=nper - hop)
        G = gfn(t[None, :], f[:, None])
        _, y = signal.istft(Z * G, fs=SR, nperseg=nper, noverlap=nper - hop)
        y = y[:n]
        if len(y) < n:
            y = np.pad(y, (0, n - len(y)))
        out.append(y)
    y = np.array(out)
    return y[0] if nch == 1 else y


# =====================================================================
#  oscillators
# =====================================================================
_TS = 4096
_NH = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256]


@lru_cache(maxsize=None)
def _table(kind, nh):
    ph = np.arange(_TS) / _TS
    w = np.zeros(_TS)
    for k in range(1, nh + 1):
        if kind == 'saw':
            w += np.sin(2 * np.pi * k * ph) / k
        elif kind == 'sq' and k % 2:
            w += np.sin(2 * np.pi * k * ph) / k
    if not np.any(w):
        w = np.sin(2 * np.pi * ph)
    w /= np.max(np.abs(w))
    return np.append(w, w[0])


def osc(kind, f, n, ph0=0.0):
    f = np.full(n, float(f)) if np.ndim(f) == 0 else np.asarray(f, float)
    lim = SR * 0.42 / max(float(np.max(f)), 1.0)
    nh = max([h for h in _NH if h <= lim] or [1])
    ph = (np.cumsum(f) / SR + ph0) % 1.0
    idx = ph * _TS
    i0 = idx.astype(np.int64)
    fr = idx - i0
    tb = _table(kind, nh)
    return tb[i0] * (1 - fr) + tb[i0 + 1] * fr


def sine(f, n, ph0=0.0):
    if np.ndim(f) == 0:
        return np.sin(2 * np.pi * f * tv(n) + ph0)
    return np.sin(2 * np.pi * np.cumsum(f) / SR + ph0)


# =====================================================================
#  musical instruments
# =====================================================================
def pluck(f, dur, vel=0.7, kind='koto', rng=None, bend=0.0):
    """additive plucked string: koto / felt piano / pizzicato / harp"""
    rng = rng or R('pluck')
    f = hz(f)
    n = ns(dur)
    t = tv(n)
    if kind == 'koto':
        B, tau0, K, pos, tilt = 3e-4, np.clip(1.4 * (220 / f) ** 0.45, 0.35, 3.0), int(min(14, 9000 / f)), 0.19, 0.20 - 0.12 * vel
    elif kind == 'piano':
        B, tau0, K, pos, tilt = 1.2e-4, np.clip(2.8 * (220 / f) ** 0.55, 0.6, 7.0), int(min(12, 6000 / f)), 0.12, 0.55 - 0.35 * vel
    elif kind == 'pizz':
        B, tau0, K, pos, tilt = 1e-4, np.clip(0.4 * (220 / f) ** 0.35, 0.12, 0.7), int(min(10, 5000 / f)), 0.3, 0.35 - 0.2 * vel
    else:  # harp
        B, tau0, K, pos, tilt = 2e-4, np.clip(2.0 * (220 / f) ** 0.5, 0.4, 4.0), int(min(12, 8000 / f)), 0.25, 0.3 - 0.15 * vel
    K = max(K, 1)
    if bend:
        fi = f * 2 ** (bend * np.exp(-t / 0.07) / 12)
        ph = 2 * np.pi * np.cumsum(fi) / SR
    else:
        ph = 2 * np.pi * f * t
    out = np.zeros(n)
    for k in range(1, K + 1):
        r = k * np.sqrt(1 + B * k * k)
        amp = (abs(np.sin(np.pi * k * pos)) + 0.05) / k * np.exp(-(k - 1) * tilt)
        tau = tau0 / (1 + 0.5 * (k - 1) * (f / 300) ** 0.3)
        m = min(n, int(tau * 7 * SR) + 1)
        p0 = rng.uniform(0, 2 * np.pi)
        if kind == 'piano':
            s = 0.5 * (np.sin(ph[:m] * r + p0) + np.sin(ph[:m] * r * 1.00035 + p0 + 0.7))
        else:
            s = np.sin(ph[:m] * r + p0)
        out[:m] += amp * np.exp(-t[:m] / tau) * s
    m = min(n, ns(0.03))
    nz = rng.standard_normal(m) * np.exp(-t[:m] / (0.008 if kind == 'piano' else 0.004))
    if kind == 'piano':
        out[:m] += 0.05 * lp(nz, 900) * vel
    else:
        out[:m] += 0.10 * bp(nz, 1500, 7000) * vel
    out *= ar(n, 0.004 if kind == 'piano' else 0.001, 0.04)
    if kind == 'piano':
        out = lp(out, 1800 + 3500 * vel)
    return out * vel


def ensemble(freqs, dur, att=0.8, rel=1.2, kind='strings', voices=3, det=7.0, vib=8.0,
             trem=0.0, cutoff=None, cut_env=None, width=0.7, rng=None, drive=0.0, vib_rate=5.2):
    """detuned-saw ensemble -> strings / pad / brass / choir.  Returns stereo, sustain RMS ~0.25"""
    rng = rng or R('ens')
    n = ns(dur)
    t = tv(n)
    L = np.zeros(n)
    Rr = np.zeros(n)
    nv = 0
    for f in freqs:
        f = hz(f)
        for v in range(voices):
            d = ((v - (voices - 1) / 2) / max(1, (voices - 1) / 2)) * det if voices > 1 else 0.0
            d += rng.uniform(-1.5, 1.5)
            cents = d + 3.0 * drift(n, 0.4, rng)
            if vib > 0:
                vr = vib_rate * rng.uniform(0.92, 1.08)
                vd = vib * np.clip((t - 0.35) / 0.8, 0, 1)
                cents = cents + vd * np.sin(2 * np.pi * vr * t + rng.uniform(0, 6.28))
            if kind == 'brass':
                cents = cents - 30 * np.exp(-t / 0.05)  # lip scoop
            fi = f * 2 ** (cents / 1200)
            w = osc('saw', fi, n, rng.random())
            if trem > 0:
                tr = rng.uniform(10.5, 13.0)
                w = w * (1 - trem * (0.5 + 0.5 * np.sin(2 * np.pi * tr * t + rng.uniform(0, 6.28))))
            p = (((v / (voices - 1)) * 2 - 1) * width if voices > 1 else 0.0) + rng.uniform(-0.15, 0.15)
            th = (np.clip(p, -1, 1) + 1) * np.pi / 4
            L += w * np.cos(th)
            Rr += w * np.sin(th)
            nv += 1
    x = np.stack([L, Rr]) / np.sqrt(nv)
    if kind == 'strings':
        x = lp(x, cutoff or 4200, 2)
        x = x + 0.5 * bp(x, 900, 3200)
        x = hp(x, 60)
    elif kind == 'pad':
        x = lp(x, cutoff or 1400, 2)
        x = hp(x, 45)
    elif kind == 'brass':
        if cut_env is None:
            c = cutoff or 2400
            cut_env = 250 + (c - 250) * (1 - np.exp(-t / max(att, 0.05)))
        x = np.stack([tvf(x[0], cut_env, 'low', 2), tvf(x[1], cut_env, 'low', 2)])
        x = np.tanh((1.5 + drive) * x / (np.max(np.abs(x)) + 1e-9)) * 0.5
        x = hp(x, 40)
    elif kind == 'choir':
        y = reson(x, 700, 5) + 0.6 * reson(x, 1150, 7) + 0.3 * reson(x, 2700, 9)
        x = lp(y, cutoff or 4000, 2) + 0.03 * x
        x = hp(x, 90)
    x *= 0.25 / rms(x)
    return x * ar(n, att, rel)


def taiko(rng, f0=55.0, vel=1.0, size=1.0, dur=None):
    n = ns(dur or 1.4 * size + 0.2)
    t = tv(n)
    fi = f0 * (1 + 1.4 * np.exp(-t / 0.022))
    ph = 2 * np.pi * np.cumsum(fi) / SR
    body = (np.sin(ph) * np.exp(-t / (0.36 * size))
            + 0.35 * np.sin(ph * 1.59 + 0.3) * np.exp(-t / (0.17 * size))
            + 0.18 * np.sin(ph * 2.14 + 1.0) * np.exp(-t / (0.09 * size)))
    nz = rng.standard_normal(n)
    slap = bp(nz, 120, 1500) * np.exp(-t / 0.018)
    slap = slap / (np.max(np.abs(slap)) + 1e-9) * 0.55
    click = hp(nz, 2500) * np.exp(-t / 0.003)
    click = click / (np.max(np.abs(click)) + 1e-9) * 0.25
    x = (body + slap * vel ** 0.5 + click * vel) * ar(n, 0.0012, 0.03)
    return np.tanh(1.3 * x) / np.tanh(1.3) * vel


BELL = [(0.5, 0.55, 1.0), (1.0, 0.75, 0.6), (1.183, 0.6, 0.42), (1.506, 0.32, 0.33), (2.0, 0.9, 0.28),
        (2.514, 0.32, 0.19), (2.662, 0.3, 0.17), (3.011, 0.26, 0.13), (4.166, 0.2, 0.09),
        (5.433, 0.15, 0.065), (6.796, 0.11, 0.05), (8.215, 0.08, 0.035)]


def bell(f, dur, rng, T=8.0, strike=1.0, bright=1.0, width=0.6):
    """bronze bell: inharmonic partials (hum, prime, minor tierce, quint, nominal...) as beating doublets"""
    f = hz(f)
    n = ns(dur)
    t = tv(n)
    L = np.zeros(n)
    Rr = np.zeros(n)
    for (r, a, s) in BELL:
        fr = f * r * (1 + rng.uniform(-0.002, 0.002))
        if fr > SR * 0.4:
            continue
        tau = T * s
        amp = a * (bright ** np.log2(r * 2))
        m = min(n, int(tau * 7 * SR) + 1)
        dd = 1 + rng.uniform(0.0007, 0.0025)
        e = np.exp(-t[:m] / tau)
        p1, p2 = rng.uniform(0, 6.28, 2)
        s1 = np.sin(2 * np.pi * fr * t[:m] + p1) * e
        s2 = np.sin(2 * np.pi * fr * dd * t[:m] + p2) * e
        L[:m] += amp * (0.5 + 0.5 * width * 0.5) * s1 + amp * (0.5 - 0.5 * width * 0.5) * s2
        Rr[:m] += amp * (0.5 - 0.5 * width * 0.5) * s1 + amp * (0.5 + 0.5 * width * 0.5) * s2
    for _ in range(10):  # strike clang
        fr = f * rng.uniform(9, 18)
        if fr > 15000:
            fr = rng.uniform(5000, 14000)
        tau = rng.uniform(0.015, 0.07) * (T / 8) ** 0.3
        m = min(n, int(tau * 7 * SR) + 1)
        s = np.sin(2 * np.pi * fr * t[:m] + rng.uniform(0, 6.28)) * np.exp(-t[:m] / tau) * strike * rng.uniform(0.04, 0.1)
        pp = rng.uniform(-1, 1) * width
        L[:m] += s * (1 - pp) / 2
        Rr[:m] += s * (1 + pp) / 2
    m = min(n, ns(0.08))
    nz = bp(rng.standard_normal(m), min(f * 3, 6000), 14000) * np.exp(-t[:m] / 0.005)
    nz = nz / (np.max(np.abs(nz)) + 1e-9) * 0.2 * strike
    x = np.stack([L, Rr])
    x[:, :m] += nz
    x *= ar(n, 0.0008, 0.05)
    return normp(x)


def bell_drone(f, dur, rng, env=None, ratios=(0.5, 1.0, 1.183, 1.506, 2.0, 2.662, 3.011, 4.166), swell=0.35):
    """sustained, slowly 'ringing' bell partials (no strike)"""
    f = hz(f)
    n = ns(dur)
    t = tv(n)
    L = np.zeros(n)
    Rr = np.zeros(n)
    amps = {r: a for (r, a, s) in BELL}
    for i, r in enumerate(ratios):
        a = amps.get(r, 0.2)
        fr = f * r
        dd = 1 + rng.uniform(0.0008, 0.003)
        am = np.clip(1 + swell * drift(n, 0.25 + 0.08 * i, rng), 0.1, 2)
        p1, p2 = rng.uniform(0, 6.28, 2)
        s1 = np.sin(2 * np.pi * fr * t + p1)
        s2 = np.sin(2 * np.pi * fr * dd * t + p2)
        L += a * am * (0.7 * s1 + 0.3 * s2)
        Rr += a * am * (0.3 * s1 + 0.7 * s2)
    x = np.stack([L, Rr])
    x = normp(x)
    if env is not None:
        x = x * env
    return x


def flute(f, dur, rng, vel=0.8, scoop=0.6, vib=1.0, breath=1.0):
    """shakuhachi-like: sine + weak harmonics, scoop into the note, late vibrato, breath noise"""
    f = hz(f)
    n = ns(dur)
    t = tv(n)
    sc = -scoop * np.exp(-t / 0.07)
    vs = min(0.35 * dur, 0.7)
    vd = vib * 0.22 * np.clip((t - vs) / 0.6, 0, 1)
    vb = vd * np.sin(2 * np.pi * (4.8 + 0.6 * rng.random()) * t + 0.3 * np.sin(2 * np.pi * 0.7 * t))
    tail = -0.35 * np.clip((t - (dur - 0.22)) / 0.22, 0, 1) ** 2
    fi = f * 2 ** ((sc + vb + tail + 0.04 * drift(n, 3, rng)) / 12)
    ph = 2 * np.pi * np.cumsum(fi) / SR
    tone = np.sin(ph) + 0.18 * np.sin(2 * ph + 0.4) + 0.06 * np.sin(3 * ph + 1.1) + 0.02 * np.sin(4 * ph + 2.0)
    amp = ar(n, 0.12, min(0.25, dur * 0.3)) * (0.72 + 0.28 * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.8)
    unsteady = 1 + 0.06 * drift(n, 9, rng)
    nz = rng.standard_normal(n)
    br = 0.6 * bp(nz, f * 0.9, min(f * 4.5, 12000)) + 0.4 * hp(nz, 2500)
    br = br / rms(br) * 0.10 * breath
    chiff = hp(rng.standard_normal(n), 900) * np.exp(-t / 0.05)
    chiff = chiff / (np.max(np.abs(chiff)) + 1e-9) * 0.3 * breath
    out = tone * amp * unsteady * vel + br * amp * (0.6 + 0.6 * vel) + chiff * vel
    return lp(out, 7000)


def whistle(notes, rng):
    """human whistle: pure sine with portamento, vibrato, breath. notes=[(t, pitch, dur)]"""
    total = max(a + d for a, _, d in notes) + 0.1
    n = ns(total)
    t = tv(n)
    f = np.zeros(n)
    amp = np.zeros(n)
    prev = None
    for (a, p, d) in notes:
        i0, i1 = ts(a), min(n, ts(a + d))
        fp = hz(p)
        seg = np.full(i1 - i0, fp)
        if prev is not None:
            g = min(i1 - i0, ns(0.035))
            seg[:g] = np.linspace(prev, fp, g)
        f[i0:i1] = seg
        amp[i0:i1] = ar(i1 - i0, 0.02, 0.04) * (0.85 + 0.15 * rng.random())
        prev = fp
    f[f == 0] = prev
    f = f * 2 ** ((12 * np.sin(2 * np.pi * 6.0 * t) * np.clip(t / 0.5, 0, 1)) / 1200)
    s = sine(f, n) + 0.04 * sine(2 * f, n)
    s *= amp
    br = hp(rng.standard_normal(n), 3500) * amp * 0.03
    return s + br


# =====================================================================
#  sound-effect primitives
# =====================================================================
def riser(dur, rng, f0=250.0, f1=9000.0, tone=(110.0, 880.0), curve=2.2):
    def g(T, F):
        u = np.clip(T / dur, 0, 1)
        fc = f0 * (f1 / f0) ** u
        return lgauss(F, fc, 0.55 + 0.3 * (1 - u)) * u ** curve
    x = shaped_noise(dur, g, rng, nch=2)
    n = x.shape[1]
    u = tv(n) / dur
    x = x / rms(x) * 0.25
    if tone:
        fi = tone[0] * (tone[1] / tone[0]) ** u
        s = 0.5 * osc('saw', fi, n) + 0.5 * osc('saw', fi * 1.007, n)
        s = lp(s, 3500) * u ** (curve + 0.5)
        x = x + pan(s / rms(s) * 0.12, 0.0)
    x *= ar(n, 0.01, 0.006)
    return normp(x)


def whoosh(dur, rng, peak=0.5, f_lo=250.0, f_hi=2500.0, sharp=1.0, pan0=-0.4, pan1=0.4, bw=1.2, ring=None):
    """time-domain whoosh: band-passed noise whose centre & level rise to `peak` then fall"""
    n = ns(dur)
    t = tv(n)
    pk = max(peak * dur, 1e-3)
    up = np.clip(t / pk, 0, 1)
    dn = np.clip((t - pk) / max(dur - pk, 1e-3), 0, 1)
    amp = np.where(t < pk, up ** (2.0 * sharp), (1 - dn) ** 1.5 * np.exp(-3 * dn * sharp))
    fc = np.where(t < pk, f_lo * (f_hi / f_lo) ** up, f_hi * (f_lo / f_hi) ** (dn * 0.7))
    a = tvf(rng.standard_normal(n), fc, 'band', 2, bw=bw)
    b = tvf(rng.standard_normal(n), fc * 1.06, 'band', 2, bw=bw)
    p = pan0 + (pan1 - pan0) * np.clip(t / dur, 0, 1)
    x = pan(a * amp, p - 0.15) + pan(b * amp, p + 0.15)
    x = normp(x)
    if ring:
        i = int(pk * SR)
        m = n - i
        tt = tv(m)
        s = sum(np.sin(2 * np.pi * fr * tt + k) / (k + 1) for k, fr in enumerate(ring)) * np.exp(-tt / 0.22)
        s = s * ar(m, 0.002, 0.05) * 0.22
        x[:, i:] += pan(s, pan1)
    return normp(x)


def impact(rng, size=1.0, f_hi=110.0, f_lo=38.0, crack=0.6, punch=0.7, dur=None, drive=1.5):
    n = ns(dur or (0.9 * size + 0.4))
    t = tv(n)
    fi = f_lo + (f_hi - f_lo) * np.exp(-t / 0.05)
    thump = np.sin(2 * np.pi * np.cumsum(fi) / SR) * np.exp(-t / (0.28 * size))
    nz = rng.standard_normal(n)
    pn = normp(lp(nz, 1800) * np.exp(-t / 0.04))
    ck = normp(hp(nz, 3500) * np.exp(-t / 0.005))
    x = thump + punch * pn + crack * ck
    x = np.tanh(drive * x) * ar(n, 0.0004, 0.05)
    return normp(x)


def metal(rng, f0=300.0, dur=0.8, ratios=(1.0, 2.76, 5.40, 8.93, 13.34), tau=0.3, click=0.5):
    n = ns(dur)
    t = tv(n)
    out = np.zeros(n)
    for i, r in enumerate(ratios):
        fr = f0 * r * (1 + rng.uniform(-0.01, 0.01))
        if fr > 18000:
            continue
        ta = tau / (1 + 0.5 * i)
        m = min(n, int(ta * 7 * SR) + 1)
        out[:m] += np.exp(-t[:m] / ta) * np.sin(2 * np.pi * fr * t[:m] + rng.uniform(0, 6.28)) / (1 + 0.5 * i)
    c = hp(rng.standard_normal(n), 2000) * np.exp(-t / 0.002)
    out += click * normp(c)
    return normp(out * ar(n, 0.0003, 0.02))


def wood(rng, f0=400.0, dur=0.35, tau=0.06, crack=0.8):
    n = ns(dur)
    t = tv(n)
    out = np.zeros(n)
    for i, r in enumerate((1.0, 2.31, 3.87, 5.6)):
        fr = f0 * r * (1 + rng.uniform(-0.03, 0.03))
        ta = tau / (1 + 0.7 * i)
        out += np.exp(-t / ta) * np.sin(2 * np.pi * fr * t + rng.uniform(0, 6.28)) / (1 + 0.4 * i)
    nz = rng.standard_normal(n)
    out = normp(out) + crack * normp(hp(nz, 1200) * np.exp(-t / 0.003)) + 0.4 * normp(lp(nz, 900) * np.exp(-t / 0.02))
    return normp(out * ar(n, 0.0003, 0.02))


_CB = []


def _cbank():
    if not _CB:
        for f in np.geomspace(250, 9000, 16):
            for q in (2.0, 5.0):
                _CB.append(signal.iirpeak(f, q, fs=SR))
    return _CB


def crackle(dur, rate, rng, kind='fire', rate_env=None, gain_env=None, width=0.8):
    """sparse transients: fire / ember / static / glitch. rate_env(t)->[0,1] thins events."""
    n = ns(dur)
    out = np.zeros((2, n))
    k = rng.poisson(rate * dur)
    times = np.sort(rng.uniform(0, dur, k))
    if rate_env is not None and k:
        times = times[rng.random(len(times)) < rate_env(times)]
    bank = _cbank()
    for tt in times:
        i = int(tt * SR)
        if kind in ('fire', 'ember'):
            L = int(rng.uniform(0.002, 0.012) * SR)
            a = rng.lognormal(0, 0.7) * (0.5 if kind == 'ember' else 1.0)
            if rng.random() < 0.08:
                L *= 3
                a *= 1.8
                b, aa = bank[rng.integers(0, 8)]
            else:
                b, aa = bank[rng.integers(10, len(bank))]
            seg = signal.lfilter(b, aa, rng.standard_normal(L) * np.exp(-np.arange(L) / (L / 4)))
        elif kind == 'static':
            L = int(rng.uniform(0.0003, 0.002) * SR) + 4
            seg = np.diff(rng.standard_normal(L + 1)) * np.exp(-np.arange(L) / (L / 3))
            a = rng.lognormal(0, 0.9)
        else:  # glitch
            L = int(rng.uniform(0.002, 0.02) * SR)
            hold = int(rng.integers(2, 40))
            seg = np.repeat(rng.choice([-1.0, 1.0], L // hold + 1), hold)[:L] * rng.uniform(0.3, 1.0)
            if rng.random() < 0.4:
                seg = np.sign(np.sin(2 * np.pi * rng.choice([220, 440, 880, 1760, 3520]) * np.arange(L) / SR)) * 0.6
            seg *= ar(L, 0.0003, 0.001)
            a = rng.lognormal(0, 0.5)
        m = min(len(seg), n - i)
        if m <= 0:
            continue
        p = rng.uniform(-width, width)
        g = gain_env(tt) if gain_env else 1.0
        out[0, i:i + m] += seg[:m] * a * g * np.cos((p + 1) * np.pi / 4)
        out[1, i:i + m] += seg[:m] * a * g * np.sin((p + 1) * np.pi / 4)
    return normp(out)


def glitch_burst(rng, dur=0.6, slam=1.0, decay=0.35):
    """digital erasure: sliced square tones, sample&hold noise, stutters, bitcrush + white-noise slam"""
    n = ns(dur)
    out = np.zeros((2, n))
    i = 0
    prev = None
    while i < n:
        L = min(int(rng.uniform(0.006, 0.045) * SR), n - i)
        typ = rng.choice(['sq', 'sh', 'gap', 'rep', 'sweep', 'crush'], p=[.25, .22, .08, .2, .12, .13])
        tt = np.arange(L) / SR
        if typ == 'rep' and prev is not None:
            seg = np.tile(prev, int(np.ceil(L / len(prev))))[:L]
        elif typ == 'sq':
            seg = np.sign(np.sin(2 * np.pi * rng.choice([110, 220, 440, 880, 1760, 3520]) * rng.uniform(0.9, 1.1) * tt)) * 0.6
        elif typ == 'sh':
            hold = int(rng.integers(2, 60))
            seg = np.repeat(rng.uniform(-1, 1, L // hold + 1), hold)[:L]
        elif typ == 'gap':
            seg = np.zeros(L)
        elif typ == 'sweep':
            seg = np.sin(2 * np.pi * np.cumsum(np.geomspace(rng.uniform(2000, 6000), rng.uniform(100, 400), L)) / SR)
        else:
            seg = rng.standard_normal(L)
            ds = int(rng.integers(4, 24))
            seg = np.repeat(seg[::ds], ds)[:L]
        q = rng.choice([2, 3, 4, 8])
        seg = np.round(seg * q) / q
        seg = seg * ar(L, 0.0004, 0.0015)
        p = rng.choice([-0.9, -0.5, 0.0, 0.5, 0.9])
        out[:, i:i + L] += pan(seg, p)
        if typ != 'gap':
            prev = seg[:max(32, L // int(rng.integers(1, 4)))]
        i += L
    t = tv(n)
    out *= np.exp(-t / decay)[None, :]
    if slam:
        m = min(n, ns(0.4))
        nz = np.stack([rng.standard_normal(m), rng.standard_normal(m)]) * np.exp(-tv(m) / 0.09) * ar(m, 0.0005, 0.01)
        out[:, :m] += slam * 1.3 * nz / np.max(np.abs(nz))
    return normp(out)


def splash(rng, size=1.0, dur=None):
    n = ns(dur or 0.9 + 0.9 * size)
    t = tv(n)
    out = np.zeros((2, n))
    for c in range(2):
        nz = rng.standard_normal(n)
        slap = normp(bp(nz, 300, 7000) * np.exp(-t / (0.03 * size ** 0.5)))
        body = hp(rng.standard_normal(n), 700) * np.exp(-t / (0.22 * size)) * np.clip(1 + 0.7 * drift(n, 30, rng), 0, 3)
        out[c] = slap + 0.8 * normp(body)
    th = np.sin(2 * np.pi * np.cumsum(45 + 50 * np.exp(-t / 0.05)) / SR) * np.exp(-t / 0.12) * min(1.0, 0.4 + 0.3 * size)
    out += th[None, :]
    k = int(30 * size)
    for _ in range(k):
        a = rng.exponential(0.25 * size) + 0.05
        i = int(a * SR)
        if i >= n:
            continue
        L = min(n - i, ns(rng.uniform(0.03, 0.09)))
        tt = tv(L)
        f0 = rng.uniform(600, 3000)
        s = np.sin(2 * np.pi * np.cumsum(f0 * (1 + 0.5 * tt / tt[-1])) / SR) * np.exp(-tt / 0.02) * rng.uniform(0.05, 0.2)
        out[:, i:i + L] += pan(s, rng.uniform(-0.9, 0.9))
    return normp(out * ar(n, 0.0005, 0.1))


def bubbles(dur, rate, rng, lo=250.0, hi=1400.0):
    n = ns(dur)
    out = np.zeros((2, n))
    for _ in range(rng.poisson(rate * dur)):
        i = int(rng.uniform(0, dur) * SR)
        L = min(n - i, ns(rng.uniform(0.015, 0.05)))
        if L < 8:
            continue
        tt = tv(L)
        f0 = rng.uniform(lo, hi)
        s = np.sin(2 * np.pi * np.cumsum(f0 * (1 + 1.2 * tt / tt[-1])) / SR) * ar(L, 0.002, 0.01) * np.exp(-tt / 0.02)
        out[:, i:i + L] += pan(s * rng.uniform(0.2, 1.0), rng.uniform(-0.8, 0.8))
    return normp(out)


def water_roar(dur, rng, f_lo=200.0, f_hi=4000.0, open_t=0.6, churn=0.4):
    def g(T, F):
        o = np.clip(T / open_t, 0, 1)
        fc = f_lo + (f_hi - f_lo) * o
        return (1 / np.sqrt(1 + (F / fc) ** 4)) * np.minimum(F / 70, 1.0)
    x = shaped_noise(dur, g, rng, nch=2)
    n = x.shape[1]
    for c in range(2):
        x[c] *= np.clip(1 + churn * drift(n, 4, rng), 0.1, 3)
    return normp(x)


def cloth_rip(rng, dur=0.4):
    n = ns(dur)
    t = tv(n)
    rate = 700
    imp = np.zeros(n)
    k = rng.poisson(rate * dur)
    idx = rng.integers(0, n, k)
    imp[idx] = rng.lognormal(0, 0.6, k)
    ker = np.exp(-np.arange(ns(0.002)) / (0.0005 * SR))
    gr = signal.fftconvolve(imp, ker)[:n]
    out = np.zeros((2, n))
    for c in range(2):
        out[c] = bp(rng.standard_normal(n), 700, 7500) * (0.15 + gr)
    env = pts(n, [(0, 0), (0.003, 1), (dur * 0.6, 0.8), (dur, 0)])
    body = lp(rng.standard_normal(n), 2500) * env * 0.3
    return normp(out * env + body)


def creak(rng, dur=1.0, rate=(20.0, 60.0), modes=(350.0, 720.0, 1150.0), q=12.0):
    n = ns(dur)
    t = tv(n)
    r = np.interp(t, [0, dur * 0.4, dur], [rate[0], rate[1], rate[0] * 0.8]) * (1 + 0.15 * drift(n, 3, rng))
    ph = np.cumsum(r) / SR
    k = np.floor(ph)
    imp = np.zeros(n)
    hit = np.nonzero(np.diff(k) > 0)[0]
    imp[hit] = rng.uniform(0.4, 1.0, len(hit))
    exc = imp + 0.01 * rng.standard_normal(n)
    y = sum(reson(exc, m, q) * (1 / (1 + 0.4 * i)) for i, m in enumerate(modes))
    return normp(y * ar(n, 0.06, 0.15) * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.5)


def chain(dur, rng, rate=40.0, lo=2000.0, hi=7000.0):
    n = ns(dur)
    out = np.zeros((2, n))
    t = 0.0
    env_t = lambda x: np.sin(np.pi * np.clip(x / dur, 0, 1)) ** 0.6
    while t < dur:
        i = int(t * SR)
        L = min(n - i, ns(0.06))
        tt = tv(L)
        f0 = rng.uniform(lo, hi)
        s = sum(np.sin(2 * np.pi * f0 * r * tt + rng.uniform(0, 6)) / (1 + j) for j, r in enumerate((1, rng.uniform(1.4, 1.6), rng.uniform(2.2, 2.9))))
        s = s * np.exp(-tt / rng.uniform(0.008, 0.03)) * rng.uniform(0.3, 1.0) * env_t(t)
        out[:, i:i + L] += pan(s, rng.uniform(-0.6, 0.6))
        t += rng.exponential(1 / rate) + 0.004
    return normp(out)


def zap(rng, dur=0.35, f=110.0):
    n = ns(dur)
    t = tv(n)
    fi = f * (1 + 0.3 * drift(n, 60, rng))
    buzz = np.sign(osc('saw', fi, n)) * 0.5 + 0.3 * osc('saw', fi * 2.01, n)
    buzz = bp(buzz, 300, 7000)
    gate = (drift(n, 80, rng) > -0.6).astype(float)
    sweep = sine(4500 * (300 / 4500) ** np.clip(t / 0.12, 0, 1), n) * np.exp(-t / 0.06)
    cr = crackle(dur, 700, rng, 'static').sum(0)
    x = normp(buzz) * gate * np.exp(-t / (dur / 3)) + 0.6 * sweep + 0.7 * cr * np.exp(-t / (dur / 2))
    return normp(x * ar(n, 0.001, 0.03))


def thunder(dur, rng):
    n = ns(dur)
    t = tv(n)
    out = np.zeros((2, n))
    env = np.zeros(n)
    for _ in range(rng.integers(3, 6)):
        c = rng.uniform(0.2, dur * 0.6)
        a = rng.uniform(0.3, 1.0)
        env += a * np.exp(-np.maximum(c - t, 0) / rng.uniform(0.2, 0.8)) * np.exp(-np.maximum(t - c, 0) / rng.uniform(0.8, 2.5))
    for c in range(2):
        br = np.cumsum(rng.standard_normal(n))
        br = lp(hp(br, 25), 160)
        out[c] = normp(br) + 0.2 * normp(lp(rng.standard_normal(n), 500))
    return normp(out * env * ar(n, 0.3, 0.8))


def gull(rng, dur=0.45):
    n = ns(dur)
    t = tv(n)
    u = t / dur
    s = rng.uniform(0.88, 1.15)
    fc = np.interp(u, [0, 0.22, 1], [1000 * s, 1750 * s, 950 * s])
    rough = 1 + 0.5 * np.sin(2 * np.pi * rng.uniform(35, 55) * t)
    w = osc('saw', fc, n) * rough
    w = bp(w, 700, 5000)
    return normp(w * ar(n, 0.02, 0.15) * (1 - 0.4 * u))


def chirps(rng, k=4):
    out = []
    for _ in range(k):
        L = ns(rng.uniform(0.03, 0.07))
        tt = tv(L)
        f0 = rng.uniform(2800, 4200)
        f1 = f0 * rng.uniform(1.15, 1.6)
        f = f0 + (f1 - f0) * tt / tt[-1]
        s = (sine(f, L) + 0.15 * sine(2 * f, L)) * ar(L, 0.005, 0.015)
        out.append(s)
        out.append(np.zeros(ns(rng.uniform(0.04, 0.11))))
    return np.concatenate(out)


def walla(dur, rng, voices=14):
    """unintelligible crowd babble (market) from formant-filtered glottal saws"""
    n = ns(dur)
    out = np.zeros((2, n))
    vowels = [(730, 1090), (270, 2290), (530, 1840), (570, 840), (440, 1020), (660, 1720)]
    for v in range(voices):
        f0 = rng.uniform(95, 260)
        mono = np.zeros(n)
        t = rng.uniform(0, 0.3)
        while t < dur:
            L = ns(rng.uniform(0.08, 0.24))
            i = int(t * SR)
            L = min(L, n - i)
            if L < 64:
                break
            fseq = f0 * (1 + 0.12 * rng.standard_normal()) * np.linspace(1.0, rng.uniform(0.9, 1.1), L)
            src = osc('saw', fseq, L)
            f1, f2 = vowels[rng.integers(0, len(vowels))]
            y = reson(src, f1, 4) + 0.7 * reson(src, f2, 6)
            mono[i:i + L] += y * ar(L, 0.02, 0.04) * rng.uniform(0.3, 1.0)
            t += L / SR + (rng.uniform(0.02, 0.3) if rng.random() < 0.3 else 0.01)
        out += pan(mono, rng.uniform(-0.8, 0.8))
    return normp(lp(hp(out, 180), 3500))


def step(rng, kind='stone', w=0.6):
    if kind == 'stone':   # child, wet stone
        n = ns(0.2)
        t = tv(n)
        heel = np.sin(2 * np.pi * 95 * t) * np.exp(-t / 0.018) * w
        nz = rng.standard_normal(n)
        contact = normp(bp(nz, 500, 3500) * np.exp(-t / 0.012)) * 0.7
        spl = hp(rng.standard_normal(n), 1800) * np.exp(-t / 0.05) * np.clip(1 + drift(n, 120, rng), 0, 3)
        x = heel + contact + 0.5 * normp(spl)
        return normp(x * ar(n, 0.0008, 0.03))
    if kind == 'tile':
        n = ns(0.16)
        t = tv(n)
        nz = rng.standard_normal(n)
        heel = np.sin(2 * np.pi * 120 * t) * np.exp(-t / 0.015) * w
        cl = reson(nz * np.exp(-t / 0.004), rng.uniform(1900, 2600), 8) + 0.6 * reson(nz * np.exp(-t / 0.003), rng.uniform(3200, 3800), 10)
        grit = hp(nz, 3000) * np.exp(-t / 0.02) * 0.3
        return normp((heel + normp(cl) * 0.8 + normp(grit) * 0.3) * ar(n, 0.0005, 0.02))
    if kind == 'wood':
        n = ns(0.25)
        x = 0.6 * wood(rng, rng.uniform(160, 240), 0.25, 0.05, 0.3)
        x += 0.5 * impact(rng, 0.3, 120, 60, 0.1, 0.3, dur=0.25)
        return normp(x)
    # armour
    n = ns(0.6)
    t = tv(n)
    th = impact(rng, 0.45 * w + 0.2, 95, 45, 0.15, 0.6, dur=0.6)
    cl = metal(rng, rng.uniform(380, 620), 0.6, tau=0.12, click=0.3)
    jing = chain(0.12, rng, rate=300, lo=4000, hi=9000)
    x = th + 0.45 * cl
    x[:jing.shape[1]] += 0.25 * jing.sum(0)
    return normp(x)


def glass(rng, dur=3.0, pitch=1.0, slow=1.0, shards=200, crack=1.0, spread=0.95):
    n = ns(dur)
    t = tv(n)
    out = np.zeros((2, n))
    if crack:
        for c in range(2):
            nz = rng.standard_normal(n)
            out[c] += crack * (normp(hp(nz, 1500) * np.exp(-t / 0.03)) + 0.5 * normp(bp(nz, 300, 2500) * np.exp(-t / 0.07)))
        out += crack * 0.5 * (np.sin(2 * np.pi * 70 * t) * np.exp(-t / 0.08))[None, :]
    for s in range(shards):
        if rng.random() < 0.55:
            on = rng.exponential(0.12 * slow)
        else:
            on = rng.uniform(0.03, dur * 0.7) * rng.random()
        i = int(on * SR)
        if i >= n:
            continue
        f0 = rng.uniform(2200, 9000) * pitch
        tau = rng.uniform(0.015, 0.12) * slow
        L = min(n - i, int(tau * 6 * SR) + 1)
        tt = tv(L)
        amps = (1, 0.6, 0.4, 0.25)
        rr = (1, rng.uniform(1.35, 1.6), rng.uniform(2.2, 2.9), rng.uniform(3.3, 4.6))
        seg = sum(a * np.sin(2 * np.pi * f0 * r * tt + rng.uniform(0, 6)) for a, r in zip(amps, rr) if f0 * r < 20000)
        a = rng.lognormal(0, 0.5) * np.exp(-on / (0.6 * slow)) * 0.35
        seg = seg * np.exp(-tt / tau) * ar(L, 0.0002 * slow, 0.003) * a
        p = rng.uniform(-spread, spread)
        out[:, i:i + L] += pan(seg, p)
        if rng.random() < 0.25:  # bounce
            gap = rng.uniform(0.05, 0.15) * slow
            j = i + int(gap * SR)
            if j + L < n:
                out[:, j:j + L] += pan(seg * 0.4, p)
    return normp(out)


def heart(rng, f=48.0, w=1.0):
    n = ns(0.45)
    t = tv(n)
    fi = f * (1 + 0.6 * np.exp(-t / 0.03))
    x = np.sin(2 * np.pi * np.cumsum(fi) / SR) * np.exp(-t / 0.08)
    x += 0.15 * normp(lp(rng.standard_normal(n), 300) * np.exp(-t / 0.03))
    return normp(x * ar(n, 0.004, 0.05)) * w


def warm_hum(dur, rng, bpm=78.0, env=None, unstable=0.0):
    n = ns(dur)
    t = tv(n)
    x = np.zeros(n)
    for i, p in enumerate(['D3', 'A3', 'D4', 'F#4', 'A4']):
        f = hz(p) * (1 + 0.002 * rng.standard_normal())
        x += (sine(f * (1 + 0.003 * drift(n, 0.5, rng)), n) + 0.2 * sine(2 * f, n)) / (1 + 0.3 * i)
    x = np.tanh(0.8 * x)
    x = lp(x, 2200)
    beat = 60 / bpm
    pulse = np.zeros(n)
    for k in range(int(dur / beat) + 1):
        for off, a in ((0.0, 1.0), (0.26, 0.6)):
            c = k * beat + off
            pulse += a * np.exp(-0.5 * ((t - c) / 0.06) ** 2)
    x = x * (0.55 + 0.6 * pulse)
    if unstable:
        x = x * np.clip(1 + unstable * 0.5 * drift(n, 14, rng), 0.2, 2)
    y = pan(normp(x), 0.0)
    y = y + 0.06 * np.stack([lp(rng.standard_normal(n), 3000), lp(rng.standard_normal(n), 3000)]) * (0.3 + pulse)
    if env is not None:
        y = y * env
    return y


def glyph_shimmer(dur, rng):
    """the glyph ring opening: rising glassy additive tones + rising air"""
    n = ns(dur)
    t = tv(n)
    out = np.zeros((2, n))
    tones = ['D6', 'A6', 'E7', 'F#7', 'A7', 'D8']
    for i, p in enumerate(tones):
        on = i * dur * 0.11
        f = hz(p) * 2 ** ((2.0 * np.clip((t - on) / (dur - on), 0, 1)) / 12)
        f = f * (1 + 0.004 * np.sin(2 * np.pi * (6 + i) * t))
        s = sine(f, n) + 0.25 * sine(f * 2.76, n) * (f[0] * 2.76 < 18000)
        a = np.clip((t - on) / (dur * 0.45), 0, 1) ** 1.5 * (0.75 + 0.25 * np.sin(2 * np.pi * (0.7 + 0.2 * i) * t))
        out += pan(s * a / (1 + 0.25 * i), (-1) ** i * (0.25 + 0.1 * i))
    air = shaped_noise(dur, lambda T, F: lgauss(F, 2500 * (4 ** np.clip(T / dur, 0, 1)), 0.5) * np.clip(T / dur, 0, 1) ** 2, rng, nch=2)
    out = normp(out) + 0.25 * normp(air)
    return normp(out * ar(n, 0.3, 0.6))


def hush_tone(dur):
    n = ns(dur)
    t = tv(n)
    return sine(3200.0, n) * (1 + 0.12 * np.sin(2 * np.pi * 0.31 * t)) * ar(n, 0.03, 1.0)


def sub_swell(dur, peak_t, f=34.0):
    n = ns(dur)
    t = tv(n)
    env = np.exp(-0.5 * ((t - peak_t) / (dur * 0.28)) ** 2)
    x = (sine(f, n) + 0.3 * sine(2 * f, n)) * env * ar(n, 0.3, 0.5)
    return normp(x)


def fire_bed(dur, rng):
    x = shaped_noise(dur, lambda T, F: lgauss(F, 280, 1.2) + 0.35 * lgauss(F, 1400, 1.0), rng, nch=2)
    n = x.shape[1]
    for c in range(2):
        x[c] *= np.clip(1 + 0.5 * drift(n, 6, rng), 0.1, 3)
    return normp(x)


def ignition(rng, dur=1.6):
    """'fwoomp' + low roar + crackle burst"""
    n = ns(dur)
    t = tv(n)
    fc = np.where(t < 0.18, 300 * (4000 / 300) ** (t / 0.18), 4000 * (1200 / 4000) ** np.clip((t - 0.18) / 1.0, 0, 1))
    amp = np.where(t < 0.12, (t / 0.12) ** 1.5, np.exp(-(t - 0.12) / 0.5))
    out = np.zeros((2, n))
    for c in range(2):
        out[c] = tvf(rng.standard_normal(n), fc, 'low', 2) * amp
    out = normp(out)
    roar = lp(rng.standard_normal(n), 350) * np.clip(t / 0.15, 0, 1) * np.exp(-t / 1.2)
    sub = np.sin(2 * np.pi * np.cumsum(40 + 60 * np.exp(-t / 0.06)) / SR) * np.exp(-t / 0.25)
    cr = crackle(dur, 120, rng, 'fire', rate_env=lambda x: np.exp(-x / 0.5))
    out = out + 0.5 * pan(normp(roar), 0) + 0.5 * pan(sub, 0) + 0.5 * cr
    return normp(out * ar(n, 0.002, 0.1))


# =====================================================================
#  mixer: scenes with hard cuts, reverb sends, post muffles
# =====================================================================
STEMS = ('music', 'sfx', 'amb')


class Scene:
    def __init__(self, name, t0, t1, fout_start=None, fin=0.002):
        self.name, self.t0, self.t1 = name, t0, t1
        self.i0, self.i1 = ts(t0), ts(t1)
        self.n = self.i1 - self.i0
        self.fout_start, self.fin = fout_start, fin
        self.dry, self.send, self.muffles = {}, {}, []

    def dry_buf(self, stem):
        if stem not in self.dry:
            self.dry[stem] = np.zeros((2, self.n))
        return self.dry[stem]

    def send_buf(self, stem, kind):
        k = (stem, kind)
        if k not in self.send:
            self.send[k] = np.zeros(self.n)
        return self.send[k]


SC = {}
CUES = []


def mkscene(name, t0, t1, **kw):
    SC[name] = Scene(name, t0, t1, **kw)


def place(stem, t, x, scene, gain=0.0, p=0.0, room=0.0, hall=0.0, label=None):
    sc = SC[scene]
    x = np.asarray(x, dtype=float)
    if x.ndim == 1:
        x = pan(x, p)
    g = db(gain)
    s = ts(t) - sc.i0
    if s < 0:
        log(f"  WARN: {label or stem} at {t:.2f} starts before scene {scene} ({sc.t0})")
    a = max(s, 0)
    e = min(s + x.shape[1], sc.n)
    if e <= a:
        return
    seg = x[:, a - s:e - s] * g
    sc.dry_buf(stem)[:, a:e] += seg
    if room > 0 or hall > 0:
        mono = seg.sum(0) * 0.7071
        if room > 0:
            sc.send_buf(stem, 'room')[a:e] += mono * room
        if hall > 0:
            sc.send_buf(stem, 'hall')[a:e] += mono * hall
    if label:
        CUES.append((round(t, 3), stem, label))


def make_ir(t60, pre, seed, lo_mult=1.15, hi_mult=0.45, damp=7000):
    rng = R(seed)
    n = ns(t60 * 1.1 + pre)
    t = tv(n)
    ir = np.zeros((2, n))
    for c in range(2):
        nz = rng.standard_normal(n)
        y = (lp(nz, 400) * np.exp(-6.91 * t / (t60 * lo_mult)) + bp(nz, 400, 3000) * np.exp(-6.91 * t / t60)
             + hp(nz, 3000) * np.exp(-6.91 * t / (t60 * hi_mult)))
        y = lp(y, damp, 1)
        for k in range(12):
            d = int(rng.uniform(0.004, 0.07) * SR)
            y[d] += rng.uniform(-1, 1) * 3.0 * np.exp(-d / SR / 0.05)
        y *= 1 - np.exp(-t / 0.004)
        pd = int(pre * SR)
        ir[c] = np.concatenate([np.zeros(pd), y])[:n]
    ir /= np.sqrt(np.sum(ir ** 2) / 2)
    return ir


IR = {}


def render_scene(sc, out):
    for stem in STEMS:
        has = stem in sc.dry or any(k[0] == stem for k in sc.send)
        if not has:
            continue
        y = sc.dry[stem].copy() if stem in sc.dry else np.zeros((2, sc.n))
        for kind in ('room', 'hall'):
            k = (stem, kind)
            if k in sc.send and np.any(sc.send[k]):
                for c in range(2):
                    y[c] += signal.oaconvolve(sc.send[k], IR[kind][c])[:sc.n]
        for (m0, m1, ramp, fc, depth, stems) in sc.muffles:
            if stem not in stems:
                continue
            a = max(0, ts(m0) - sc.i0 - ns(0.5))
            b = min(sc.n, ts(m1) - sc.i0 + ns(0.2))
            seg = y[:, a:b]
            low = lp(seg, fc, 4)
            m = pts(b - a, [(0, 0), (m0 - sc.t0 - a / SR, 0), (m0 - sc.t0 - a / SR + ramp, depth),
                            (m1 - sc.t0 - a / SR - ramp, depth), (m1 - sc.t0 - a / SR, 0), (99, 0)])
            y[:, a:b] = seg * (1 - m) + low * m
        env = np.ones(sc.n)
        nf = ns(sc.fin)
        env[:nf] = np.linspace(0, 1, nf)
        if sc.fout_start is not None:
            k0 = ts(sc.fout_start) - sc.i0
            L = sc.n - k0
            env[k0:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(L) / L)
        else:
            L = ns(0.004)
            env[-L:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(1, L + 1) / L)
        out[stem][:, sc.i0:sc.i1] += y * env


# =====================================================================
#  music material
# =====================================================================
# Main theme ("Unforgotten"): 1 - 5 - b6 - 5 - 3 | 4 - 3 - 2 - b7 - 1   (beats, semitones from tonic, length)
THEME = [(0.0, 0, 1.0), (1.0, 7, 1.5), (2.5, 8, 0.5), (3.0, 7, 1.0), (4.0, 3, 2.0),
         (6.0, 5, 1.0), (7.0, 3, 0.5), (7.5, 2, 0.5), (8.0, -2, 1.0), (9.0, 0, 3.0)]
THEME_MAJ = [(0.0, 0, 1.0), (1.0, 7, 1.5), (2.5, 9, 0.5), (3.0, 7, 1.0), (4.0, 4, 2.0),
             (6.0, 5, 1.0), (7.0, 4, 0.5), (7.5, 2, 0.5), (8.0, -1, 1.0), (9.0, 0, 3.0)]
THEME_HARM = [(0, 2.5, 'Dm'), (2.5, 1.5, 'Bbmaj7'), (4, 2, 'F'), (6, 2, 'Gm7'), (8, 1, 'C'), (9, 3, 'Dm9')]

CH = {
    'Dm': ['D2', 'A2', 'D3', 'F3', 'A3'],
    'Dm9': ['D2', 'A2', 'D3', 'F3', 'A3', 'E4'],
    'Bbmaj7': ['Bb1', 'F2', 'D3', 'F3', 'A3'],
    'Bb': ['Bb1', 'F2', 'D3', 'F3', 'Bb3'],
    'F': ['F2', 'C3', 'C3', 'F3', 'A3'],
    'F/A': ['A1', 'F2', 'C3', 'F3', 'A3'],
    'Gm7': ['G1', 'D2', 'D3', 'F3', 'Bb3'],
    'Gm': ['G1', 'D2', 'D3', 'G3', 'Bb3'],
    'C': ['C2', 'G2', 'C3', 'E3', 'G3'],
    'Csus2': ['C2', 'G2', 'C3', 'D3', 'G3'],
    'C/E': ['E2', 'G2', 'C3', 'E3', 'G3'],
    'A': ['A1', 'E2', 'C#3', 'E3', 'A3'],
    'Asus4': ['A1', 'E2', 'D3', 'E3', 'A3'],
    'A7': ['A1', 'E2', 'C#3', 'G3', 'A3'],
    'G': ['G1', 'D2', 'B2', 'D3', 'G3'],
    'D': ['D2', 'A2', 'D3', 'F#3', 'A3'],
    'Dadd9': ['D2', 'A2', 'E3', 'F#3', 'A3'],
    'Bm7': ['B1', 'F#2', 'D3', 'F#3', 'A3'],
    'Gmaj7': ['G1', 'D2', 'B2', 'F#3', 'A3'],
    'Em7': ['E2', 'B2', 'D3', 'G3', 'B3'],
    'Dm_dread': ['D1', 'D2', 'A2', 'Eb3'],
    'Bell': ['D2', 'A2', 'Eb3', 'Ab3'],
}


def chord(name, shift=0, drop=0):
    return [mhz(mid(x) + shift) for x in CH[name]][drop:]


class Clock:
    def __init__(self, t0, bpm, bpb=4):
        self.t0, self.b, self.bpb = t0, 60.0 / bpm, bpb

    def __call__(self, beat):
        return self.t0 + beat * self.b


def pad(scene, stem, t, dur, freqs, kind='pad', gain=-20.0, att=0.6, rel=1.0, hall=0.3, room=0.0, name='pad', **kw):
    x = ensemble(freqs, dur + rel, att=att, rel=rel, kind=kind, rng=R(f'{name}{t:.3f}{kind}'), **kw)
    place(stem, t, x, scene, gain, hall=hall, room=room)


def theme_notes(clk, start_beat, tonic, which=THEME, upto=10, stretch=1.0):
    return [(clk(start_beat + b * stretch), mhz(tonic + s), d * stretch * clk.b) for (b, s, d) in which[:upto]]


def ostinato_tones(name, lo=60):
    """chord tones (MIDI) placed in a register starting at `lo`"""
    pcs = sorted({int(mid(x)) % 12 for x in CH[name][1:]})
    root = int(mid(CH[name][0])) % 12
    out = []
    for o in range(lo, lo + 24):
        if o % 12 in pcs or o % 12 == root:
            out.append(o)
    return out


# =====================================================================
#  CUES
# =====================================================================
def cold_open_A():
    sc = 'A'
    # ---- rain: wide bed + taps on wood + roof drips, fades in over 0-2 s
    r = R('rain')
    d = 30.7
    n = ns(d)
    fade = pts(n, [(0, -60), (0.4, -30), (2.0, 0), (99, 0)], dbs=True)
    bed = shaped_noise(d, lambda T, F: lgauss(F, 5200, 1.3) + 0.6 * lgauss(F, 1400, 1.0) + 0.12 * lgauss(F, 300, 1.0), r, nch=2)
    place('amb', 0.0, bed / rms(bed) * fade, sc, -28, label='rain bed fade-in')
    taps = crackle(d, 90, r, 'fire', width=1.0)
    place('amb', 0.0, lp(taps, 5000) * fade, sc, -24)
    drips = np.zeros((2, n))
    for tt in np.cumsum(r.exponential(0.55, 80)):
        if tt > d - 0.2:
            break
        L = ns(0.12)
        x = tv(L)
        f0 = r.uniform(700, 2200)
        s = np.sin(2 * np.pi * np.cumsum(f0 * (1 + 0.25 * np.clip(x / 0.03, 0, 1))) / SR) * np.exp(-x / r.uniform(0.03, 0.07))
        s = s * ar(L, 0.0005, 0.01) * r.uniform(0.3, 1.0)
        i = int(tt * SR)
        drips[:, i:i + L] += pan(s, r.uniform(-0.9, 0.9))
    place('amb', 0.0, drips * fade, sc, -22, room=0.3)
    # ---- distant thunder (very soft)
    for t0 in (12.0, 24.5):
        place('amb', t0, thunder(6.0, R(f'thunder{t0}')), sc, -27, hall=0.25, label='distant thunder')
    # ---- bonfire audible from 17 s
    fb = fire_bed(14.0, R('bonfire'))
    nb = fb.shape[1]
    place('amb', 16.6, fb * pts(nb, [(0, -40), (1.6, 0), (99, 0)], dbs=True), sc, -32, p=0.0, label='bonfire')
    place('amb', 16.6, crackle(14.0, 14, R('bonfire_cr'), 'fire', rate_env=lambda x: np.clip((x - 0.3) / 1.5, 0, 1)), sc, -27, room=0.2)
    # ---- chalk on wet wood: M I R A + doodle
    strokes = {1.6: [(0.00, 0.20), (0.24, 0.20), (0.48, 0.18), (0.70, 0.22)],   # M
               2.7: [(0.00, 0.38), (0.50, 0.10), (0.66, 0.10)],                 # I
               3.8: [(0.00, 0.25), (0.30, 0.36), (0.70, 0.24)],                 # R
               4.9: [(0.00, 0.26), (0.30, 0.26), (0.66, 0.14)]}                 # A
    for t0, ss in strokes.items():
        for j, (o, dd) in enumerate(ss):
            place('sfx', t0 + o, chalk_stroke(dd, R(f'chalk{t0}{j}')), sc, -19 - 1.5 * j, p=-0.15, room=0.2,
                  label=f'chalk letter @{t0}' if j == 0 else None)
    place('sfx', 5.9, chalk_stroke(0.3, R('doodle'), scribble=True), sc, -21, p=-0.12, room=0.2, label='chalk doodle')
    # ---- child's running footsteps on wet stone 7.5-17 (crane up: recede)
    rs = R('childsteps')
    tt = 7.5
    k = 0
    while tt < 17.0:
        u = (tt - 7.5) / 9.5
        x = step(rs, 'stone', 0.6)
        if u > 0.3:
            x = lp(x, 7000 - 4500 * u)
        place('sfx', tt, x, sc, -21 - 12 * u, p=-0.35 + 0.7 * u + (0.08 if k % 2 else -0.08), room=0.25 + 0.2 * u,
              label='child footsteps start' if k == 0 else None)
        tt += 0.27 + rs.uniform(-0.03, 0.03)
        k += 1
    music_emberwick()


def chalk_stroke(dur, rng, scribble=False):
    n = ns(dur)
    t = tv(n)
    rate = rng.uniform(70, 130)
    gaps = rng.uniform(0.6, 1.4, int(dur * rate * 1.5) + 4) / rate
    times = np.cumsum(gaps)
    times = times[times < dur]
    imp = np.zeros(n)
    imp[(times * SR).astype(int)] = rng.lognormal(0, 0.5, len(times))
    ker = np.exp(-np.arange(ns(0.006)) / (0.0015 * SR))
    gr = signal.fftconvolve(imp, ker)[:n]
    nz = rng.standard_normal(n)
    x = bp(nz, 1800, 7500) * (0.35 + gr)
    x = x + 0.3 * reson(x, 2300, 3)
    press = 1 - 0.35 * t / dur
    if scribble:
        press = press * (0.55 + 0.45 * np.abs(np.sin(2 * np.pi * 9 * t)))
    x = lp(x, 6500) * press * ar(n, 0.008, 0.03)
    tap = normp(hp(rng.standard_normal(ns(0.01)), 1000) * np.exp(-tv(ns(0.01)) / 0.0015)) * 0.6
    x = normp(x)
    x[:len(tap)] += tap
    return normp(x)


def music_emberwick():
    """MUSIC A 'Emberwick' -- 70 bpm, D minor leaning F; theme at half-time on koto; felt-piano arpeggios; warm pad"""
    sc = 'A'
    c = Clock(5.0, 70)
    b = c.b
    prog = [(0, 5, 'Dm9'), (5, 3, 'Bbmaj7'), (8, 4, 'F/A'), (12, 4, 'Gm7'), (16, 2, 'C'), (18, 6, 'Dm9'), (24, 4, 'Bbmaj7'), (28, 6, 'Gm7')]

    def build(bt):  # crane-up build 7.5-17 s  (beats ~3 - 14)
        tt = c(bt)
        return 4.0 + float(np.interp(tt, [5, 7.5, 13, 17, 20, 31], [-4, -3, 0, 0.5, -1.5, -2]))
    for (bt, ln, ch) in prog:
        pad(sc, 'music', c(bt), ln * b + 0.25, chord(ch), 'pad', -21 + build(bt), att=1.8 if bt == 0 else 0.9, rel=1.4,
            hall=0.35, cutoff=1500, vib=0, name='emb')
    # strings join for the crane-up build
    for (bt, ln, ch) in prog[1:5]:
        pad(sc, 'music', c(bt), ln * b + 0.3, chord(ch, 12, drop=2), 'strings', -27 + 2 * build(bt), att=1.0, rel=1.2,
            hall=0.45, cutoff=3500, vib=7, name='embs')
    # felt piano arpeggios (eighths)
    rp = R('emb_piano')
    for (bt, ln, ch) in prog:
        tones = [m for m in ostinato_tones(ch, 57) if m <= 76]
        bass = int(mid(CH[ch][0])) + 12
        patt = [bass, tones[1], tones[2], tones[3], tones[4] if len(tones) > 4 else tones[3] + 12, tones[3], tones[2], tones[1]]
        for e in range(int(ln * 2)):
            bt2 = bt + e / 2
            if c(bt2) > 30.7:
                break
            v = 0.32 + 0.1 * (e % 4 == 0) + 0.05 * rp.random()
            place('music', c(bt2), pluck(mhz(patt[e % 8]), 2.2, v, 'piano', rp), sc, -16 + build(bt2) * 0.5,
                  p=-0.25 + 0.5 * ((patt[e % 8] - 50) / 30), hall=0.3)
    # koto: the main theme, half-time (1 theme beat = 2 beats)
    rk = R('emb_koto')
    mel = theme_notes(c, 0, 74, THEME, 10, 2.0)
    mel += [(c(24), hz('D5'), 1 * b), (c(25), hz('A5'), 1.5 * b), (c(26.5), hz('Bb5'), 0.5 * b), (c(27), hz('A5'), b),
            (c(28), hz('F5'), 2 * b), (c(30), hz('G5'), b), (c(31), hz('F5'), b)]
    for j, (tt, f, d) in enumerate(mel):
        bend = -1.0 if j in (1, 9, 12) else 0.0
        place('music', tt, pluck(f, max(d, 1.5) + 1.2, 0.72, 'koto', rk, bend=bend), sc, -10.0, p=0.18, hall=0.35, room=0.1)
        if 2 <= j <= 9:  # soft violin doubling of the melody during the build
            pad(sc, 'music', tt, d + 0.1, [f], 'strings', -27 + build(1 + j), att=0.25, rel=0.5, hall=0.5, voices=3,
                det=5, vib=10, cutoff=5000, name=f'embv{j}')


def cold_open_B():
    sc = 'B'
    # 30.6 the rain stops: near silence -- faint high sine + low sub swell
    place('sfx', 30.6, hush_tone(11.4), sc, -50, label='hush: 3.2 kHz tone')
    place('sfx', 30.6, sub_swell(7.0, 3.6, 34.0), sc, -30, label='sub swell')
    # 32.4-36 glyph ring opens: rising glassy shimmer + sub pressure
    place('sfx', 32.4, glyph_shimmer(4.4, R('glyph1')), sc, -27, hall=0.6, label='glyph ring shimmer')
    place('sfx', 32.4, sub_swell(5.0, 3.2, 29.0), sc, -30)
    # 36-41 the king: cold low bell drone, almost nothing under the whisper 38.4-39.2
    nn = ns(5.6)
    env = pts(nn, [(0, -40), (1.2, -3), (2.2, 0), (2.3, -6), (2.4, -11), (3.2, -11), (3.6, -4), (5.0, -6), (5.6, -40)], dbs=True)
    place('music', 36.0, bell_drone('D2', 5.6, R('kingdrone'), env), sc, -27, hall=0.5, label='cold bell drone')
    # 41.4-48 THE WAVE
    rw = R('wave1')
    place('sfx', 41.4, white_wave(rw, 7.3), sc, -11, hall=0.25, label='white wave (reverse swell -> airless roar)')
    for j in range(16):  # lanterns blink out
        tt = 42.2 + rw.uniform(0, 5.3)
        L = ns(0.05)
        x = tv(L)
        s = np.sin(2 * np.pi * rw.uniform(3000, 6000) * x) * np.exp(-x / 0.008) + 0.3 * hp(rw.standard_normal(L), 4000) * np.exp(-x / 0.002)
        place('sfx', tt, s, sc, -34 - 4 * (tt - 42.2) / 5.3, p=rw.uniform(-0.9, 0.9), room=0.3)
    # dissonant string cluster swelling
    cl = ['D3', 'Eb3', 'E3', 'F3', 'Ab3', 'A3', 'D5', 'Eb5', 'F5']
    x = ensemble(cl, 7.4, att=4.0, rel=0.8, kind='strings', trem=0.6, vib=4, rng=R('cluster'), cutoff=5000)
    x = x * pts(x.shape[1], [(0, -18), (5.8, 0), (6.6, -6), (7.4, -30)], dbs=True)
    place('music', 41.4, x, sc, -17, hall=0.4, label='dissonant cluster')
    SC[sc].muffles.append((43.6, 51.0, 2.5, 650.0, 0.85, ('music', 'amb')))
    # 48-51 chalk name dissolves: granular glitch crackle
    gd = crackle(3.0, 140, R('dissolve'), 'glitch', rate_env=lambda x: np.exp(-x / 1.4))
    gd = gd * pts(gd.shape[1], [(0, 0), (0.2, 1), (3.0, 0.1)])
    place('sfx', 48.0, lp(gd, 6000), sc, -29, room=0.3, label='name dissolves (granular crackle)')
    place('sfx', 48.0, lp(crackle(3.0, 260, R('dissolve2'), 'static', rate_env=lambda x: np.exp(-x / 1.0)), 9000), sc, -34)
    # 51-60 a single held low string note (cello D2)
    x = ensemble(['D2'], 7.3, att=1.2, rel=0.3, kind='strings', voices=3, det=4, vib=3, rng=R('heldnote'), cutoff=1800)
    place('music', 50.9, x, sc, -26, hall=0.35, label='held low string note')
    # 55-58.2 heartbeat pulses accelerating
    tt = 55.0
    k = 0
    while tt < 58.15:
        u = (tt - 55.0) / 3.2
        place('sfx', tt, heart(R(f'hb{k}'), 48, 1.0), sc, -21 + 6 * u)
        if tt + 0.22 * (1 - 0.4 * u) < 58.1:
            place('sfx', tt + 0.22 * (1 - 0.4 * u), heart(R(f'hb{k}b'), 44, 0.6), sc, -24 + 6 * u)
        tt += 60.0 / (72 + 90 * u ** 1.3)
        k += 1
    CUES.append((55.0, 'sfx', 'heartbeats accelerate'))
    place('sfx', 57.2, riser(1.0, R('prehit'), 400, 7000, tone=(200, 900), curve=3.0), sc, -22)
    # 58.2 IMPACT: glitch burst + white-noise slam, crackle fading to 59.2
    place('sfx', 58.2, glitch_burst(R('erase'), 0.7, slam=1.0, decay=0.3), sc, -1.5, room=0.2, label='IMPACT glitch burst + slam')
    place('sfx', 58.2, impact(R('erase_imp'), 1.2, 120, 34, 0.8, 0.8), sc, -4)
    gc = crackle(1.0, 220, R('erase_cr'), 'glitch', rate_env=lambda x: np.exp(-x / 0.35))
    place('sfx', 58.25, gc, sc, -15)


def white_wave(rng, dur):
    """reverse-cymbal swell into a band-limited, airless roar that closes down (muffles), + inharmonic shimmer"""
    n = ns(dur)
    t = tv(n)
    pk = 2.1

    def g(T, F):
        rise = np.clip(T / pk, 0, 1) ** 3
        after = T >= pk
        fc_hi = np.where(after, 2600 * (700 / 2600) ** np.clip((T - pk) / (dur - pk - 0.4), 0, 1), 9000)
        lo_cut = np.where(after, 180.0, 1500.0)
        shape = np.minimum(F / lo_cut, 1.0) ** 2 / np.sqrt(1 + (F / fc_hi) ** 6)
        amp = np.where(after, 0.85 - 0.2 * np.clip((T - pk) / (dur - pk), 0, 1), rise)
        return shape * amp
    x = shaped_noise(dur, g, rng, nch=2)
    x = x / np.max(np.abs(x))
    cym = np.zeros(n)
    for _ in range(14):
        f = rng.uniform(3000, 9500)
        cym += np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * rng.uniform(0.3, 1)
    cym = cym * np.clip(t / pk, 0, 1) ** 4 * (t < pk + 0.05)
    shim = np.zeros((2, n))
    for i in range(9):
        f = rng.uniform(1200, 5000)
        a = np.clip((t - pk + 0.5) / 1.5, 0, 1) * (0.6 + 0.4 * np.sin(2 * np.pi * rng.uniform(3, 8) * t))
        shim += pan(np.sin(2 * np.pi * f * t) * a, rng.uniform(-0.9, 0.9))
    y = x + 0.12 * pan(cym / (np.max(np.abs(cym)) + 1e-9), 0) + 0.08 * shim / 3
    return normp(y * ar(n, 0.05, 0.8))


def cold_open_C():
    sc = 'C'
    # tinnitus 60.0 -> fades by ~66
    n = ns(6.5)
    t = tv(n)
    tin = (sine(6800.0, n) + 0.5 * sine(6834.0, n)) * pts(n, [(0, -40), (0.03, 0), (1.5, -3), (2.5, -10), (3.0, -16), (5.0, -30), (6.5, -60)], dbs=True)
    place('sfx', 60.0, tin, sc, -24, label='tinnitus')
    place('amb', 62.5, lp(hp(R('white').standard_normal(ns(3.0)), 4000), 9000) * ar(ns(3.0), 0.8, 1.2), sc, -58)
    # 65-81.6 aftermath: cold hollow wind + embers
    d = 16.8
    w = shaped_noise(d, lambda T, F: lgauss(F, 520 * (1 + 0.25 * np.sin(2 * np.pi * 0.11 * T)), 0.55)
                     + 0.4 * lgauss(F, 1300 * (1 + 0.2 * np.sin(2 * np.pi * 0.07 * T + 1)), 0.25), R('coldwind'), nch=2)
    nw = w.shape[1]
    gust = np.clip(1 + 0.45 * drift(nw, 0.35, R('gust')), 0.2, 2.5)
    place('amb', 64.8, w / rms(w) * gust * pts(nw, [(0, -40), (1.5, 0), (99, 0)], dbs=True), sc, -37, label='cold hollow wind')
    place('amb', 65.0, crackle(4.2, 3.5, R('embers'), 'ember'), sc, -31, room=0.3, label='ember crackles')
    # 69.0 the sword ignites
    place('sfx', 69.0, ignition(R('ignite')), sc, -6, room=0.2, label='sword IGNITES')
    fr = fire_bed(12.6, R('swordfire'))
    place('sfx', 69.05, fr * pts(fr.shape[1], [(0, -30), (0.3, 0), (99, 0)], dbs=True), sc, -31)
    place('sfx', 69.1, crackle(12.5, 7, R('swordcr'), 'fire'), sc, -27, room=0.2)
    # 80.6-81.4 riser -> 81.4 SLASH -> 81.6 cut
    place('sfx', 80.6, riser(0.8, R('riser_slash'), 300, 9000, tone=(150, 1200), curve=2.5), sc, -10, label='riser into slash')
    sl = whoosh(0.5, R('slash'), peak=0.6, f_lo=600, f_hi=6000, sharp=2.5, pan0=-0.7, pan1=0.7, bw=1.0, ring=(2900, 4400, 6100))
    place('sfx', 81.4 - 0.3, sl, sc, -3, label='SLASH (peak 81.40)')
    music_oath()


def music_oath():
    """MUSIC B 'Oath' -- solo shakuhachi plays the theme, strings & taiko heartbeat join"""
    sc = 'C'
    rf = R('oath_fl')
    fl = [(65.4, 'D5', 2.2), (67.7, 'A5', 1.9), (69.7, 'Bb5', 0.6), (70.3, 'A5', 1.3), (71.7, 'F5', 2.3),
          (74.4, 'G5', 1.0), (75.4, 'F5', 0.5), (75.9, 'E5', 0.5), (76.4, 'C5', 1.0), (77.4, 'D5', 2.6), (80.1, 'A5', 1.4)]
    for j, (tt, p, d) in enumerate(fl):
        place('music', tt, flute(p, d + 0.1, rf, vel=0.75 + 0.05 * (j > 4), scoop=0.8 if j in (0, 1, 9) else 0.4), sc,
              -17, p=0.1, hall=0.45, label='shakuhachi theme' if j == 0 else None)
    # low drone under the flute
    x = ensemble(['D2', 'A2'], 9.5, att=3.0, rel=1.5, kind='pad', voices=2, det=4, vib=0, rng=R('oathdrone'), cutoff=600)
    place('music', 65.0, x, sc, -33, hall=0.3)
    # 74-81.6 strings join: Dm -> Bbmaj7 -> Gm -> Asus4/A
    prog = [(74.0, 2.0, 'Dm', -28), (76.0, 2.0, 'Bbmaj7', -25), (78.0, 2.0, 'Gm', -22), (80.0, 0.8, 'Asus4', -19), (80.8, 0.9, 'A', -17)]
    for (tt, d, ch, g) in prog:
        pad(sc, 'music', tt, d + 0.2, chord(ch, 12, drop=1), 'strings', g, att=0.5 if tt > 74 else 1.5, rel=0.6,
            hall=0.45, vib=8, cutoff=4500, name='oaths')
        pad(sc, 'music', tt, d + 0.2, chord(ch)[:2], 'strings', g - 2, att=0.5, rel=0.6, hall=0.3, vib=4, cutoff=1500, name='oathb')
    # brass swell under the end
    x = ensemble(['D2', 'A2', 'D3'], 3.6, att=2.8, rel=0.3, kind='brass', voices=3, det=6, vib=2, rng=R('oathbr'), cutoff=1800)
    place('music', 78.0, x, sc, -25, hall=0.3)
    # taiko heartbeats from 76
    tt = 76.0
    k = 0
    while tt < 81.3:
        u = (tt - 76) / 5.0
        place('music', tt, taiko(R(f'ohb{k}'), 52, 0.9, 1.1), sc, -15 + 4 * u, room=0.2, hall=0.25,
              label='taiko heartbeat begins' if k == 0 else None)
        if tt + 0.26 < 81.35:
            place('music', tt + 0.26, taiko(R(f'ohb{k}b'), 48, 0.6, 0.9), sc, -19 + 4 * u, room=0.2, hall=0.25)
        tt += 60 / (66 + 30 * u)
        k += 1


def title():
    sc = 'T'
    # 82.6 braam / boom
    n = ns(5.0)
    t = tv(n)
    cut = np.where(t < 0.25, 150 * (3200 / 150) ** (t / 0.25), 3200 * (420 / 3200) ** np.clip((t - 0.25) / 3.5, 0, 1))
    br = ensemble(['D1', 'D2', 'A2', 'D3', 'F3'], 5.0, att=0.01, rel=1.5, kind='brass', voices=3, det=14, vib=0,
                  rng=R('braam'), cut_env=cut, drive=1.0)
    place('music', 82.6, br, sc, -6, hall=0.4, label='TITLE braam')
    place('sfx', 82.6, impact(R('titleboom'), 2.5, 90, 30, 0.4, 0.8), sc, -3, hall=0.35, label='title boom')
    place('music', 82.6, taiko(R('titletaiko'), 45, 1.0, 1.8), sc, -6, hall=0.4)
    # 82.8-84.5 letters catch fire: crackling ignition sweeps L->R
    for j, tt in enumerate((82.8, 83.2, 83.6, 84.0)):
        w = whoosh(0.7, R(f'ign{j}'), 0.35, 500, 5000, 1.2, -0.8 + 0.4 * j, -0.5 + 0.4 * j, bw=1.4)
        cr = crackle(0.7, 160, R(f'ignc{j}'), 'fire', rate_env=lambda x: np.exp(-x / 0.3))
        place('sfx', tt, w + 0.8 * cr, sc, -16, room=0.2, label='letters ignite' if j == 0 else None)
    fb = fire_bed(9.8, R('titlefire'))
    place('sfx', 82.8, fb * pts(fb.shape[1], [(0, -30), (1.5, 0), (7.8, 0), (9.8, -40)], dbs=True), sc, -30)
    place('sfx', 82.9, crackle(9.7, 10, R('titlecr'), 'fire'), sc, -26, room=0.2)
    # 90.6-92.6 title burns away
    w = whoosh(2.0, R('burnaway'), 0.3, 300, 2500, 0.8, 0.3, -0.3, bw=1.5)
    place('sfx', 90.6, w, sc, -24, hall=0.3, label='title burns away')
    place('sfx', 90.6, crackle(2.0, 70, R('burncr'), 'fire', rate_env=lambda x: np.exp(-x / 0.6)), sc, -19)
    # theme statement 83.0 - 91.6 (84 bpm), full orchestra
    c = Clock(83.0, 84)
    b = c.b
    for (bt, ln, ch) in THEME_HARM:
        pad(sc, 'music', c(bt), ln * b + 0.15, chord(ch, 12, drop=1), 'strings', -18, att=0.25, rel=0.9 if bt < 9 else 2.0,
            hall=0.45, vib=8, cutoff=4500, name='tstr')
        pad(sc, 'music', c(bt), ln * b + 0.15, chord(ch)[:3], 'brass', -21, att=0.3, rel=0.8, hall=0.35, voices=2, det=5,
            vib=2, cutoff=1500, name='tbr')
        pad(sc, 'music', c(bt), ln * b + 0.15, chord(ch, 12, drop=1), 'choir', -27, att=0.4, rel=1.2, hall=0.6, vib=5, name='tch')
        rp = R(f'tpno{bt}')
        place('music', c(bt), pluck(chord(ch)[0], 3.0, 0.8, 'piano', rp) + pluck(chord(ch)[0] * 2, 3.0, 0.6, 'piano', rp),
              sc, -14, hall=0.3)
    for j, (tt, f, d) in enumerate(theme_notes(c, 0, 74, THEME)):
        pad(sc, 'music', tt, d + 0.05, [f, f / 2], 'strings', -14.5, att=0.08, rel=0.5 if j < 9 else 1.4, hall=0.5,
            voices=4, det=6, vib=12, cutoff=6000, name=f'tmel{j}')
        pad(sc, 'music', tt, d + 0.05, [f / 2], 'brass', -19, att=0.08, rel=0.5, hall=0.4, voices=2, det=4, vib=3,
            cutoff=2600, name=f'thorn{j}')
        if j == 0:
            CUES.append((tt, 'music', 'main theme statement'))
    for bt in (0, 4, 6, 8, 9):
        place('music', c(bt), taiko(R(f'tt{bt}'), 50, 0.8, 1.3), sc, -12, hall=0.3)


def halcyon():
    """93-104: dawn above the clouds. MUSIC C 'Halcyon' (80 bpm, D major pentatonic) + temple bells"""
    sc = 'HAL'
    # ambience: high wind + birds
    d = 11.2
    w = shaped_noise(d, lambda T, F: lgauss(F, 2600 * (1 + 0.2 * np.sin(2 * np.pi * 0.09 * T)), 0.9) + 0.5 * lgauss(F, 600, 0.8), R('highwind'), nch=2)
    place('amb', 93.0, w / rms(w) * pts(w.shape[1], [(0, -30), (1.0, 0), (99, 0)], dbs=True), 'D', -38, label='high wind')
    rb = R('birds')
    tt = 93.6
    while tt < 104.0:
        place('amb', tt, chirps(rb, int(rb.integers(2, 6))), 'D', -36 + rb.uniform(-4, 2), p=rb.uniform(-0.9, 0.9), hall=0.4)
        tt += rb.uniform(0.8, 2.2)
    CUES.append((93.6, 'amb', 'distant birds'))
    # temple bells
    for j, tt in enumerate((96.5, 99.5, 102.5)):
        place('sfx', tt, bell('D3', 8.0, R(f'temple{j}'), T=6.5, strike=1.0), 'D', -10, p=-0.3, hall=0.55,
              label='temple bell toll')
    c = Clock(93.5, 80)
    b = c.b
    prog = [(0, 4, 'Dadd9'), (4, 4, 'Bm7'), (8, 4, 'Gmaj7'), (12, 2, 'Asus4')]
    # airy strings + pad
    for (bt, ln, ch) in prog:
        pad(sc, 'music', c(bt), ln * b + 0.3, chord(ch, 12, drop=1), 'strings', -22, att=0.8 if bt else 1.2, rel=1.0,
            hall=0.6, vib=6, cutoff=5500, name='halstr')
        pad(sc, 'music', c(bt), ln * b + 0.3, chord(ch)[:2], 'pad', -25, att=0.8, rel=1.0, hall=0.4, cutoff=900, name='halb')
    # pluck ostinato (eighths)
    rp = R('hal_pl')
    for (bt, ln, ch) in prog:
        tones = [m for m in ostinato_tones(ch, 62) if m % 12 in (2, 4, 6, 9, 11)]
        patt = [tones[0], tones[2], tones[3], tones[4], tones[5] if len(tones) > 5 else tones[4] + 12, tones[4], tones[3], tones[2]]
        for e in range(int(ln * 2)):
            place('music', c(bt + e / 2), pluck(mhz(patt[e % 8]), 1.4, 0.5 + 0.1 * (e % 2 == 0), 'harp', rp), sc, -21,
                  p=-0.4 + 0.1 * (e % 8), hall=0.4)
    # flute: theme in major
    rf = R('hal_fl')
    for j, (tt, f, dd) in enumerate(theme_notes(c, 0, 74, THEME_MAJ)):
        place('music', tt, flute(f, dd + 0.08, rf, vel=0.7, scoop=0.4, vib=0.8), sc, -19, p=0.15, hall=0.5,
              label='Halcyon: theme in major (flute)' if j == 0 else None)
    place('music', c(12), flute('A5', 1.5, rf, vel=0.7, scoop=0.3), sc, -20, p=0.15, hall=0.5)
    place('music', 93.0, riser(0.5, R('halgliss'), 1500, 9000, tone=None, curve=1.5), sc, -32, hall=0.5)


def vault():
    """104-113: alarm bells, guards running in, tense low ostinato"""
    sc = 'V'
    # alarm bells: two small bells, rapid strikes, continuous
    ra = R('alarm')
    tt = 104.0
    k = 0
    while tt < 113.1:
        f = 1320 if k % 2 == 0 else 1568
        place('sfx', tt, bell(f / 2, 0.7, ra, T=0.8, strike=1.2, bright=1.4), sc, -27 + ra.uniform(-1.5, 1.5),
              p=-0.45 if k % 2 == 0 else 0.45, room=0.35, label='alarm bells' if k == 0 else None)
        tt += 1 / 7.0 + ra.uniform(-0.01, 0.01)
        k += 1
    tt = 104.07
    while tt < 113.1:
        place('sfx', tt, bell(990, 0.9, ra, T=1.0, strike=0.8), sc, -35, p=0.8, hall=0.4)
        tt += 0.24 + ra.uniform(-0.02, 0.02)
    # room tone
    rt = lp(R('vaultrt').standard_normal(ns(9.2)), 300)
    place('amb', 104.0, rt / rms(rt) * ar(ns(9.2), 0.3, 0.1) + 0.3 * sine(60.0, ns(9.2)), sc, -45, label='vault room tone')
    # guards running in (armoured)
    rg = R('guards')
    for g, (start, pp, lvl) in enumerate(((104.3, -0.6, -24), (104.55, 0.5, -26), (104.9, -0.2, -28))):
        tt = start
        while tt < 109.5:
            u = (tt - start) / 5
            place('sfx', tt, step(rg, 'armor', 0.7), sc, lvl + 4 * u, p=pp * (1 - 0.5 * u), room=0.4,
                  label='armoured footsteps run in' if (g == 0 and tt == start) else None)
            tt += 0.31 + rg.uniform(-0.03, 0.03)
    # music: tense low ostinato, 132 bpm, D pedal
    c = Clock(104.0, 132)
    b = c.b
    patt = ['D2', 'D2', 'D3', 'D2', 'Eb3', 'D2', 'C3', 'D2']
    uppers = [('Dm', 0), ('Bb', 8), ('Gm', 16), ('A', 24)]
    rp = R('vault_os')
    e = 0
    while c(e / 2) < 113.1:
        tt = c(e / 2)
        u = (tt - 104) / 9
        place('music', tt, pluck(patt[e % 8], 0.5, 0.75, 'koto', rp), sc, -17 + 3 * u, p=-0.1, room=0.2)
        x = ensemble([patt[e % 8]], 0.24, att=0.005, rel=0.08, kind='strings', voices=2, det=6, vib=0, rng=rp, cutoff=1400)
        place('music', tt, x, sc, -20 + 4 * u, room=0.2)
        e += 1
    for (ch, bt) in uppers:
        if c(bt) >= 113.1:
            break
        pad(sc, 'music', c(bt), 8 * b + 0.3, chord(ch, 12, drop=2), 'strings', -26, att=0.6, rel=0.4, hall=0.35, trem=0.7,
            vib=3, cutoff=3500, name='vaulttrem')
    for bt in range(0, 40, 4):
        if c(bt) < 113.0:
            place('music', c(bt), taiko(R(f'vt{bt}'), 60, 0.6, 0.8), sc, -18, room=0.2)
    place('music', 111.0, riser(2.1, R('vaultrise'), 300, 6000, tone=(110, 440), curve=2.0), sc, -22)


def glass_slowmo():
    # 113.0 stained-glass window explodes (real time, scene D)
    place('sfx', 113.0, glass(R('glass_big'), 3.0, 1.0, 1.0, 260, 1.0), 'D', -2.5, room=0.35, hall=0.2,
          label='GLASS SHATTER')
    place('sfx', 113.0, impact(R('glass_thump'), 1.0, 100, 40, 0.5, 0.5), 'D', -8)
    # slow motion 113.2-116: everything in D muffled; slowed, pitched-down tinkles + low drone in scene S
    SC['D'].muffles.append((113.2, 116.0, 0.12, 420.0, 0.9, ('music', 'sfx', 'amb')))
    sc = 'S'
    place('sfx', 113.2, lp(glass(R('glass_slow'), 2.9, 0.42, 4.0, 46, 0.0), 3500), sc, -17, hall=0.6, label='slowed glass tinkles')
    x = ensemble(['D1', 'A1', 'D2'], 3.0, att=0.3, rel=0.2, kind='pad', voices=3, det=10, vib=0, rng=R('slowdrone'), cutoff=380)
    place('music', 113.15, x, sc, -22, hall=0.4, label='slow-mo drone')
    place('music', 113.15, sub_swell(2.9, 1.2, 36.0), sc, -22)
    # 114.0 character-intro stinger: taiko + bright string stab
    place('music', 114.0, taiko(R('sting_taiko'), 55, 1.0, 1.4), sc, -5, hall=0.4, label='STINGER (taiko + string stab)')
    st_ = ensemble(['D4', 'A4', 'D5', 'F#5', 'A5', 'D6'], 1.4, att=0.004, rel=1.1, kind='strings', voices=3, det=8, vib=6,
                   rng=R('stab'), cutoff=7000)
    st_ = st_ * np.exp(-tv(st_.shape[1]) / 0.5)[None, :]
    place('music', 114.0, st_, sc, -6, hall=0.5)
    rk = R('stab_k')
    for p in ('D5', 'A5', 'D6'):
        place('music', 114.0, pluck(p, 1.5, 0.9, 'koto', rk), sc, -16, hall=0.4)
    # 116.0 snap back to real speed: whoosh peaking at 116.0
    place('sfx', 115.55, whoosh(0.75, R('snap'), 0.6, 300, 5000, 2.0, 0.6, -0.6), 'D', -9, label='snap-back whoosh (peak 116.0)')
    # 117.2 lands on a roof and rolls
    rl = R('roll')
    place('sfx', 117.2, impact(rl, 0.6, 130, 55, 0.4, 0.8), 'D', -9, room=0.3, label='roof landing + roll')
    place('sfx', 117.2, crackle(0.8, 400, rl, 'static', rate_env=lambda x: np.exp(-x / 0.3)), 'D', -24)
    place('sfx', 117.22, cloth_rip(rl, 0.7) * 0.5, 'D', -20)
    for j, tt in enumerate((117.45, 117.72)):
        place('sfx', tt, step(rl, 'tile', 1.0), 'D', -14 - 3 * j, room=0.3)
    # distant alarms continue, receding, as she escapes
    tt = 116.0
    k = 0
    while tt < 126.0:
        u = (tt - 116) / 10
        place('amb', tt, bell(660 if k % 2 else 784, 0.8, rl, T=0.8, strike=0.8), 'D', -36 - 14 * u, p=-0.5, hall=0.6)
        tt += 1 / 7.0
        k += 1


def chase():
    """118-148.3 CHASE. MUSIC D 'Courier' (150 bpm) + rooftop running, leaps, chain-spear, zap"""
    # ---------------- ambience: rushing wind
    d = 30.4
    w = shaped_noise(d, lambda T, F: lgauss(F, 900, 1.3) + 0.4 * lgauss(F, 3000, 0.8), R('chasewind'), nch=2)
    nw = w.shape[1]
    gust = np.clip(1 + 0.35 * drift(nw, 0.6, R('chg')), 0.3, 2)
    place('amb', 118.0, w / rms(w) * gust * pts(nw, [(0, -20), (0.8, 0), (30.0, 0), (30.4, -20)], dbs=True), 'D', -33,
          label='rooftop wind')
    # ---------------- her footsteps on tiles
    leaps = [120.6, 124.8, 129.0, 137.4, 142.0, 143.0]
    air = [(l, l + (0.9 if l == 143.0 else 0.55)) for l in leaps] + [(136.35, 136.55)]
    rs = R('tiles')
    tt = 118.0
    first = True
    while tt < 148.1:
        if not any(a - 0.05 <= tt < b for a, b in air):
            place('sfx', tt, step(rs, 'tile', 0.7), 'D', -24 + rs.uniform(-1.5, 1.0), p=rs.uniform(-0.15, 0.15), room=0.25,
                  label='running footsteps on tiles' if first else None)
            first = False
        tt += 0.205 + rs.uniform(-0.015, 0.015)
    # pursuers behind
    rq = R('pursuers')
    for g, (st0, pp) in enumerate(((119.5, -0.6), (121.0, 0.55), (140.0, -0.3), (141.0, 0.75))):
        tt = st0
        while tt < 148.0:
            place('sfx', tt, step(rq, 'armor', 0.5), 'D', -33, p=pp, room=0.3, hall=0.1)
            tt += 0.29 + rq.uniform(-0.03, 0.03)
    # ---------------- leaps
    for j, l in enumerate(leaps[:5]):
        rl = R(f'leap{j}')
        place('sfx', l - 0.02, step(rl, 'tile', 1.0), 'D', -18, room=0.2)
        place('sfx', l, whoosh(0.6, rl, 0.4, 300, 2800, 1.0, -0.4, 0.4), 'D', -13, label='leap (whoosh up, land +0.55)')
        place('sfx', l + 0.55, impact(rl, 0.35, 140, 70, 0.3, 0.6), 'D', -17, room=0.25)
        place('sfx', l + 0.56, step(rl, 'tile', 0.9), 'D', -17)
    # 143.0 big spinning leap
    rl = R('spinleap')
    n = ns(1.0)
    x = whoosh(1.0, rl, 0.5, 250, 3500, 0.8, -0.8, 0.8, bw=1.4)
    x = x * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 3.5 * tv(n))))[None, :]
    place('sfx', 143.0, x, 'D', -9, room=0.2, label='big spinning leap')
    place('sfx', 143.9, impact(rl, 0.5, 140, 60, 0.4, 0.7), 'D', -14, room=0.25)
    place('sfx', 143.9, step(rl, 'tile', 1.0), 'D', -16)
    # 133 chest glow (warm pulsing hum, heartbeat-synced, swells 133-136)
    n = ns(4.6)
    place('sfx', 133.0, warm_hum(4.6, R('glow1'), 80, pts(n, [(0, -30), (1.5, -6), (3.0, 0), (3.6, -3), (4.6, -40)], dbs=True)),
          'D', -17, hall=0.3, label='chest glow hum')
    # 136.0 chain-spear -> 136.4 dodge zap + afterimage -> 136.7 thunk
    rc = R('spear')
    sp = whoosh(0.45, rc, 0.7, 500, 4000, 1.5, -0.9, 0.3, ring=(3100, 4700, 6200))
    place('sfx', 136.0 - 0.3, sp, 'D', -9, label='chain-spear whoosh (peak 136.0)')
    place('sfx', 136.0, chain(0.45, rc, 55), 'D', -17, p=-0.2)
    place('sfx', 136.4, zap(rc, 0.3, 120), 'D', -8, label='dodge: electric zap')
    place('sfx', 136.42, whoosh(0.35, rc, 0.25, 1500, 7000, 2.0, 0.2, -0.6), 'D', -15)
    th = wood(rc, 260, 0.3, 0.05, 1.0) * 0.8
    n = ns(0.9)
    tt = tv(n)
    tw = np.sin(2 * np.pi * 155 * tt + 0.8 * np.sin(2 * np.pi * 11 * tt)) * np.exp(-tt / 0.25) * (0.7 + 0.3 * np.cos(2 * np.pi * 11 * tt))
    tw[:len(th)] += th
    place('sfx', 136.7, tw, 'D', -11, p=0.4, room=0.35, label='spear thunks into chimney')
    # 140-148 chains rattle, lightning crackle on blades
    for j, tt in enumerate((140.4, 141.3, 144.6, 146.2)):
        place('sfx', tt, chain(0.6, R(f'ch{j}'), 45), 'D', -21, p=(-0.6, 0.6, -0.4, 0.5)[j], room=0.3)
    place('sfx', 143.1, crackle(4.6, 30, R('bladecr'), 'static'), 'D', -21, room=0.2, label='lightning crackle on blades')
    for j, tt in enumerate((143.4, 145.1, 146.9)):
        place('sfx', tt, zap(R(f'bz{j}'), 0.18, 160), 'D', -21, p=0.2)
    music_courier()


def music_courier():
    sc = 'CH'
    c = Clock(118.0, 150)
    b = c.b
    bars = ['Dm', 'Dm'] + ['Dm', 'C', 'Bb', 'C'] * 2 + ['Dm', 'F', 'G', 'A'] + ['T', 'T', 'T', 'Bb', 'A']
    harm = []
    for i, ch in enumerate(bars):
        if ch == 'T':
            continue
        harm.append((i * 4, 4, ch))
    for (bt, ln, ch) in THEME_HARM:
        harm.append((56 + bt, ln, ch))
    harm.sort()
    rT = R('courier_taiko')
    rp = R('courier_pl')
    for i in range(len(bars)):
        t_bar = c(i * 4)
        if t_bar >= 148.3:
            break
        big = [0, 3, 6] if i >= 2 else [0, 3]
        for e in range(8):
            tt = c(i * 4 + e / 2)
            if e in big:
                place('music', tt, taiko(rT, 52, 0.95, 1.0), sc, -11, room=0.25, hall=0.15)
            elif i >= 2 and e in (2, 5, 7):
                place('music', tt, taiko(rT, 115, 0.6, 0.45), sc, -18, p=0.25, room=0.25)
            if i >= 1:
                place('music', tt, taiko(rT, 390, 0.4 + 0.25 * (e % 2 == 0), 0.12), sc, -24, p=-0.3, room=0.2)
            if i >= 14 and e in (6, 7):
                place('music', tt + b / 4, taiko(rT, 115, 0.5, 0.4), sc, -19, p=0.25)
    # bass strings eighths + koto ostinato + sustained pads
    for (bt, ln, ch) in harm:
        root = int(mid(CH[ch][0])) % 12
        r2 = 36 + (root - 36) % 12 if (root % 12) >= 2 else 48 + root
        r2 = 38 + ((root - 2) % 12)  # D2..C#3
        bl = [r2, r2, r2 + 12, r2, r2, r2 + 12, r2, r2 + 7]
        tones = ostinato_tones(ch, 62)
        kp = [tones[0], tones[2], tones[1] + 12 if tones[1] + 12 <= 86 else tones[1], tones[2], tones[0] + 12, tones[2], tones[1] + 12 if tones[1] + 12 <= 86 else tones[1], tones[3]]
        for e in range(int(ln * 2)):
            tt = c(bt + e / 2)
            if tt >= 148.3:
                break
            x = ensemble([mhz(bl[e % 8])], 0.22, att=0.004, rel=0.07, kind='strings', voices=2, det=7, vib=0, rng=rp, cutoff=1600)
            place('music', tt, x, sc, -16 + (1.5 if e % 2 == 0 else 0), room=0.15)
            if bt >= 8:
                place('music', tt, pluck(mhz(kp[e % 8]), 0.9, 0.55 + 0.15 * (e % 2 == 0), 'koto', rp), sc, -20, p=0.35, room=0.2)
        pad(sc, 'music', c(bt), ln * b + 0.1, chord(ch, 12, drop=2), 'strings', -27 if bt < 56 else -21, att=0.15, rel=0.3,
            hall=0.3, vib=5, cutoff=4000, trem=0.6 if 40 <= bt < 56 else 0.0, name='cpad')
    # hook (bars 2-3): theme diminution on flute + koto
    rf = R('courier_fl')
    for j, (tt, f, d) in enumerate(theme_notes(c, 8, 74, THEME, 5)):
        place('music', tt, flute(f, d + 0.05, rf, vel=0.85, scoop=0.3, vib=0.5), sc, -18, p=-0.1, hall=0.3,
              label='Courier hook (theme)' if j == 0 else None)
        place('music', tt, pluck(f, 1.0, 0.7, 'koto', rf), sc, -20, p=0.2, room=0.2)
    # bars 14-16 (140.4): full theme on brass + strings
    for j, (tt, f, d) in enumerate(theme_notes(c, 56, 62, THEME)):
        pad(sc, 'music', tt, d + 0.02, [f, f * 2], 'brass', -12, att=0.04, rel=0.25, hall=0.35, voices=3, det=6, vib=3,
            cutoff=3000, drive=0.5, name=f'cbr{j}')
        pad(sc, 'music', tt, d + 0.02, [f * 2, f * 4], 'strings', -16, att=0.04, rel=0.25, hall=0.4, voices=3, det=6, vib=10,
            cutoff=6500, name=f'cst{j}')
        if j == 0:
            CUES.append((tt, 'music', 'Courier: brass theme'))
    # bars 17-18: rising strings into the cut
    x = ensemble(['A2', 'E3', 'A3', 'C#4', 'E4'], 3.3, att=2.6, rel=0.05, kind='strings', voices=3, det=7, vib=4, trem=0.8,
                 rng=R('crise'), cutoff=5000)
    place('music', 145.2, x, sc, -14, hall=0.3)


def bridge():
    """148.3-166: dead end. held tense drone, howling wind, pursuers land, 164.5 she steps off"""
    sc = 'BR'
    x = ensemble(['D2', 'A2', 'Eb3'], 17.7, att=0.06, rel=0.1, kind='strings', voices=3, det=5, vib=2, rng=R('brdrone'), cutoff=1500)
    x = x * pts(x.shape[1], [(0, 0), (1.0, -3), (5.0, -6), (12.0, -6), (16.2, -2), (17.7, 0)], dbs=True)
    place('music', 148.3, x, sc, -20, hall=0.4, label='music cuts to held tense drone')
    place('music', 148.3, sub_swell(17.7, 9.0, 36.0), sc, -26)
    hi = ensemble(['D5', 'Eb5'], 17.7, att=4.0, rel=0.1, kind='strings', voices=2, det=3, vib=1, rng=R('brhi'), cutoff=6000)
    place('music', 148.3, hi, sc, -34, hall=0.6)
    # 164.5 sharp intake + riser into the fall
    rr = R('intake')
    m = ns(0.45)
    inh = bp(rr.standard_normal(m), 900, 4000) * np.clip(tv(m) / 0.4, 0, 1) ** 2 * ar(m, 0.01, 0.05)
    place('sfx', 164.5, inh, 'D', -18, label='sharp intake')
    place('sfx', 164.45, step(rr, 'tile', 0.7), 'D', -22)
    place('music', 164.5, riser(1.5, R('fallriser'), 250, 9000, tone=(110, 1100), curve=2.0), sc, -10, label='riser into fall')
    # howling wind (amb, scene D)
    d = 18.0
    w = shaped_noise(d, lambda T, F: lgauss(F, 1500 * (1 + 0.35 * np.sin(2 * np.pi * 0.08 * T)), 0.18)
                     + 0.6 * lgauss(F, 2300 * (1 + 0.25 * np.sin(2 * np.pi * 0.05 * T + 2)), 0.12)
                     + 0.5 * lgauss(F, 700, 1.0), R('howl'), nch=2)
    nw = w.shape[1]
    place('amb', 148.2, w / rms(w) * np.clip(1 + 0.4 * drift(nw, 0.3, R('howlg')), 0.2, 2) * pts(nw, [(0, -20), (0.5, 0), (99, 0)], dbs=True),
          'D', -30, label='howling wind')
    for j, tt in enumerate((149.0, 149.6, 150.3, 151.0)):
        rl = R(f'pland{j}')
        x = mixa(impact(rl, 0.8, 100, 40, 0.3, 0.7), 0.5 * metal(rl, rl.uniform(300, 500), 0.9, tau=0.2))
        place('sfx', tt, normp(x), 'D', -10, p=(-0.6, 0.5, -0.25, 0.7)[j], room=0.35, hall=0.15,
              label='pursuer lands' if j == 0 else None)


def fall():
    """166-176 THE FALL: loud rushing wind, MUSIC D variation (faster), awnings, market rushing past"""
    rw = R('fallwind')
    d = 10.2
    w = shaped_noise(d, lambda T, F: lgauss(F, 700 * (1 + 0.3 * np.sin(2 * np.pi * 0.4 * T)), 1.6) + 0.5 * lgauss(F, 3000, 0.9), rw, nch=2)
    nw = w.shape[1]
    env = pts(nw, [(0, -12), (0.15, 0), (3.40, 0), (3.48, -6), (3.8, 0), (4.90, 0), (4.98, -6), (5.3, 0), (6.40, 0), (6.48, -6),
                   (6.8, 0), (9.6, 0), (10.0, -20), (10.2, -40)], dbs=True) * np.clip(1 + 0.3 * drift(nw, 1.5, rw), 0.3, 2)
    place('sfx', 166.0, w / rms(w) * env, 'D', -18, label='fall: rushing wind')
    for j, tt in enumerate((167.2, 168.4, 170.2, 171.7, 173.4, 174.6)):
        place('sfx', tt, whoosh(0.7, R(f'fpass{j}'), 0.5, 300, 2000, 1.0, (-1) ** j * 0.8, -(-1) ** j * 0.8), 'D', -19)
    for j, tt in enumerate((169.5, 171.0, 172.5)):
        rc = R(f'awning{j}')
        place('sfx', tt, cloth_rip(rc, 0.45 - 0.08 * j), 'D', -6 - 3.5 * j, p=(-0.3, 0.3, 0.0)[j], room=0.2,
              label='awning: cloth rip + pole crack')
        place('sfx', tt, wood(rc, 320 + 60 * j, 0.4, 0.06, 1.2), 'D', -5 - 3.5 * j, p=(-0.3, 0.3, 0.0)[j], room=0.3)
        place('sfx', tt, impact(rc, 0.5, 120, 50, 0.2, 0.5), 'D', -12 - 3.5 * j)
    wl = walla(3.6, R('market'))
    n = wl.shape[1]
    t = tv(n)
    wl = np.stack([lp(wl[0], 2500), lp(wl[1], 2500)])
    pp = np.clip(-1 + 2 * t / 3.4, -1, 1)
    wl = (pan(wl[0], pp) + pan(wl[1], pp * 0.8)) * pts(n, [(0, -20), (1.0, 0), (2.8, 0), (3.6, -30)], dbs=True)[None, :]
    place('amb', 172.6, wl, 'D', -19, room=0.3, label='market noise rushing past')
    # music (scene FALL), 165 bpm
    sc = 'FALL'
    c = Clock(166.0, 165)
    b = c.b
    place('music', 166.0, taiko(R('fallhit'), 45, 1.0, 1.6), sc, -6, hall=0.3, label='music explodes back')
    cr = shaped_noise(2.5, lambda T, F: np.minimum(F / 3000, 1) ** 2 * np.exp(-T / 0.7), R('crash'), nch=2)
    place('music', 166.0, normp(cr), sc, -14, hall=0.3)
    prog = ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'C']
    rp = R('fall_os')
    for i, ch in enumerate(prog):
        bt = i * 4
        pad(sc, 'music', c(bt), 4 * b + 0.05, chord(ch)[:3], 'brass', -14, att=0.05, rel=0.2, hall=0.3, voices=3, det=7,
            vib=2, cutoff=2200, name='fbr')
        pad(sc, 'music', c(bt), 4 * b + 0.05, chord(ch, 12, drop=2), 'strings', -19, att=0.05, rel=0.2, hall=0.3, trem=0.7,
            vib=3, name='fst')
        for e in range(16):
            tt = c(bt + e / 4)
            if e % 4 == 0 or e in (6, 10, 14):
                place('music', tt, taiko(rp, 55 if e % 8 == 0 else 110, 0.9 if e % 4 == 0 else 0.55, 0.8 if e % 8 == 0 else 0.4), sc, -12 if e % 4 == 0 else -17, room=0.2)
            else:
                place('music', tt, taiko(rp, 400, 0.35, 0.1), sc, -25, p=-0.3)
        # descending high-string runs (falling)
        pcs = {2, 4, 5, 7, 9, 10, 1 if ch == 'A' else 0}
        m = max(x for x in ostinato_tones(ch, 70) if x <= 81)
        run = []
        while len(run) < 8:
            if m % 12 in pcs:
                run.append(m)
            m -= 1
        for e in range(8):
            tt = c(bt + e / 2)
            x = ensemble([mhz(run[e])], 0.2, att=0.005, rel=0.08, kind='strings', voices=3, det=6, vib=0, rng=rp, cutoff=6000)
            place('music', tt, x, sc, -21 + (2 if e == 0 else 0), p=0.3, hall=0.3)
    # theme fragment on horns over bars 4-5
    for j, (tt, f, dd) in enumerate(theme_notes(c, 16, 62, THEME, 5)):
        pad(sc, 'music', tt, dd, [f, f * 2], 'brass', -15, att=0.03, rel=0.2, hall=0.35, voices=3, det=6, vib=3, cutoff=3000, name=f'fth{j}')
    # final hit 174.73
    tt = c(28)
    pad(sc, 'music', tt, 1.2, chord('Dm'), 'brass', -9, att=0.01, rel=1.0, hall=0.4, voices=3, det=9, vib=0, cutoff=2600, name='fend')
    place('music', tt, taiko(R('fend'), 45, 1.0, 1.5), sc, -6, hall=0.4)


def harbour():
    """176-228.5 harbour ambience (cut abruptly at 228.5) + dock comedy, anchor and fight effects"""
    sc = 'H'
    d = 52.6
    rh = R('harbour')
    lap = shaped_noise(d, lambda T, F: lgauss(F, 450, 1.1) + 0.25 * lgauss(F, 2500, 0.8), rh, nch=2)
    n = lap.shape[1]
    t = tv(n)
    laps = np.zeros(n)
    tt = 0.0
    while tt < d:
        laps += rh.uniform(0.4, 1.0) * np.exp(-np.maximum(tt - t, 0) / 0.25) * np.exp(-np.maximum(t - tt, 0) / rh.uniform(0.4, 0.9))
        tt += rh.uniform(0.7, 1.6)
    place('amb', 176.0, lap / rms(lap) * (0.35 + laps)[None, :] * pts(n, [(0, -20), (0.6, 0), (99, 0)], dbs=True), sc, -33, label='harbour ambience')
    rg = R('gulls')
    tt = 176.4
    while tt < 228.5:
        k = int(rg.integers(1, 4))
        for j in range(k):
            place('amb', tt + j * 0.32, gull(rg, rg.uniform(0.3, 0.5)), sc, -33 + rg.uniform(-5, 2), p=rg.uniform(-0.9, 0.9), hall=0.35)
        tt += rg.uniform(2.5, 6.0)
    rc = R('creaks')
    tt = 177.0
    while tt < 228.5:
        if rc.random() < 0.5:
            x = creak(rc, rc.uniform(0.6, 1.4), (rc.uniform(60, 100), rc.uniform(140, 220)), (600, 1150, 1900), 18)
        else:
            x = creak(rc, rc.uniform(0.6, 1.5), (rc.uniform(15, 30), rc.uniform(35, 70)), (260, 520, 880), 10)
        place('amb', tt, x, sc, -35 + rc.uniform(-3, 2), p=rc.uniform(-0.8, 0.8), room=0.3)
        tt += rc.uniform(2.5, 5.0)
    # tension dip of the ambience 189-191 is handled by the dock silence (no music) -- fine
    # ---- boy whistles (the theme, major) 176.2-177.8
    rwh = R('whistle')
    notes = [(0.0, 'D6', 0.22), (0.25, 'A6', 0.36), (0.63, 'B6', 0.13), (0.78, 'A6', 0.24), (1.04, 'F#6', 0.52)]
    place('sfx', 176.2, whistle(notes, rwh), 'D', -21, p=0.25, room=0.3, label='boy whistles (theme)')
    # ---- 178.0 IMPACT: crate explodes, fish slaps, cartoon thump
    ri = R('crate')
    place('sfx', 178.0, splinter(ri, 1.3), 'D', -4, room=0.3, label='IMPACT: crate explodes')
    n2 = ns(0.5)
    t2 = tv(n2)
    bonk = np.sin(2 * np.pi * np.cumsum(55 + 160 * np.exp(-t2 / 0.06)) / SR) * np.exp(-t2 / 0.16)
    bonk = np.tanh(2.0 * bonk) + 0.25 * np.sin(2 * np.pi * np.cumsum(300 + 250 * np.clip(t2 / 0.3, 0, 1)) / SR) * np.exp(-t2 / 0.1) * (1 + 0.5 * np.sin(2 * np.pi * 18 * t2))
    place('sfx', 178.0, bonk, 'D', -5, label='cartoon thump')
    for j, tt in enumerate((178.08, 178.22, 178.41, 178.63)):
        place('sfx', tt, fish_slap(R(f'fish{j}')), 'D', -13 - 2 * j, p=ri.uniform(-0.6, 0.6), room=0.25)
    place('sfx', 180.5, fish_slap(R('fishlast')), 'D', -9, p=0.3, room=0.25, label='fish lands (wet slap)')
    # ---- 182.3 comedic pizzicato sting
    rp = R('pizz')
    for (tt, p, v) in ((182.30, 'A4', 0.8), (182.39, 'F4', 0.7), (182.48, 'D4', 0.75), (182.62, 'A2', 0.9)):
        place('music', tt, pluck(p, 0.8, v, 'pizz', rp), 'D', -12, p=0.1, room=0.3, label='comedic pizz sting' if p == 'A4' else None)
    # ---- 188.6 three thuds
    for j, tt in enumerate((188.6, 188.8, 189.0)):
        rl = R(f'three{j}')
        x = mixa(impact(rl, 1.0, 95, 38, 0.3, 0.8), 0.4 * metal(rl, rl.uniform(260, 420), 1.0, tau=0.25), 0.4 * wood(rl, 180, 0.4, 0.08, 0.5))
        place('sfx', tt, normp(x), 'D', -5, p=(-0.5, 0.0, 0.5)[j], room=0.35, hall=0.15, label='THREE THUDS' if j == 0 else None)
    # ---- low tension strings 191-200.5
    x = ensemble(['D2', 'A2', 'D3'], 9.8, att=3.0, rel=0.4, kind='strings', voices=3, det=5, vib=2, trem=0.5, rng=R('docktens'), cutoff=1500)
    place('music', 190.9, x * pts(x.shape[1], [(0, -12), (6, -6), (9.8, 0)], dbs=True), 'D', -24, hall=0.35)
    # ---- 199.5 hands grip iron
    place('sfx', 199.5, metal(R('grip'), 210, 1.2, tau=0.4, click=0.8), 'D', -12, p=0.15, room=0.4, label='hands grip iron (clank)')
    # ---- 200-205 dock groans, sea pulls back, rising rumble
    for j, (tt, dd) in enumerate(((200.0, 2.2), (201.6, 2.0), (203.2, 1.8))):
        place('sfx', tt, creak(R(f'groan{j}'), dd, (8, 22), (120, 260, 410, 640), 9), 'D', -12, p=(-0.4, 0.4, 0.0)[j], room=0.3,
              label='dock groans' if j == 0 else None)
    rs = R('suck')
    m = ns(3.0)
    tt_ = tv(m)
    crash = shaped_noise(3.0, lambda T, F: (1 / np.sqrt(1 + (F / (3000 * np.exp(-T / 1.5) + 300)) ** 4)) * np.exp(-T / 0.9), rs, nch=2)
    suck = crash[:, ::-1] * np.clip(tt_ / 0.4, 0, 1)
    place('sfx', 200.0, normp(suck), 'D', -9, hall=0.2, label='sea pulls back (reversed wave suck)')
    place('sfx', 200.6, bubbles(3.0, 30, rs, 200, 900) * pts(ns(3.0), [(0, 0), (1, 1), (3, 0.3)])[None, :], 'D', -22)
    rum = lp(np.cumsum(rs.standard_normal(ns(5.2))), 120)
    rum = hp(rum, 25)
    place('sfx', 200.0, normp(rum) * pts(len(rum), [(0, -30), (3.0, 0), (3.3, 0), (5.2, -30)], dbs=True), 'D', -12, label='rising low rumble')
    # ---- 203.0 anchor rips free: metal groan + water explosion
    ra = R('anchor')
    grn = creak(ra, 1.3, (25, 70), (180, 410, 690, 1130), 30)
    place('sfx', 202.6, grn, 'D', -13, room=0.3)
    place('sfx', 203.0, splash(ra, 3.5), 'D', -1.5, hall=0.25, label='ANCHOR rips free (water explosion)')
    place('sfx', 203.0, impact(ra, 1.6, 110, 32, 0.6, 0.9), 'D', -3)
    place('sfx', 203.0, metal(ra, 140, 2.0, tau=0.7, click=1.0), 'D', -10, room=0.3)
    wr = water_roar(3.0, ra, 300, 5000, 0.3, 0.5)
    place('sfx', 203.05, wr * pts(wr.shape[1], [(0, 0), (0.3, 1), (3.0, 0)])[None, :], 'D', -9)
    # ---- FIGHT 214-220.5
    rf = R('fight')
    place('sfx', 214.8 - 0.35, whoosh(0.8, rf, 0.45, 150, 1500, 0.8, -0.8, 0.8, bw=1.6), 'D', -5, label='anchor swing (huge whoosh)')
    place('sfx', 215.0, impact(rf, 0.7, 150, 60, 0.6, 0.9), 'D', -6, room=0.2)
    place('sfx', 215.2, splash(rf, 2.0), 'D', -4, p=0.3, hall=0.15, label='big splash')
    place('sfx', 216.8, chain(0.5, rf, 70), 'D', -10, p=-0.3, room=0.3, label='chain wraps the anchor')
    place('sfx', 217.2, metal(rf, 180, 0.6, tau=0.2), 'D', -12, room=0.2)
    place('sfx', 217.2, whoosh(0.6, rf, 0.5, 200, 2500, 1.2, 0.5, -0.5), 'D', -8, label='yank + whoosh')
    place('sfx', 218.0, mixa(splinter(rf, 1.0), 0.6 * pan(barrel(rf), 0.0)), 'D', -4, p=0.0, room=0.3, label='crash into barrels')
    place('sfx', 219.0 - 0.2, whoosh(0.4, rf, 0.5, 600, 5000, 1.6, 0.6, -0.4, ring=(3300, 5000)), 'D', -9, label='spear thrust')
    place('sfx', 219.6, zap(rf, 0.3, 140), 'D', -7, label='zap + kick')
    place('sfx', 219.62, impact(rf, 0.5, 160, 70, 0.5, 1.0), 'D', -7, room=0.2)
    place('sfx', 220.1, splash(rf, 1.3), 'D', -7, p=-0.4, hall=0.15, label='splash')
    place('sfx', 220.5, step(rf, 'wood', 1.0), 'D', -10, room=0.3, label='she lands beside him')
    place('sfx', 220.52, cloth_rip(rf, 0.25) * 0.4, 'D', -24)


def fish_slap(rng):
    n = ns(0.18)
    t = tv(n)
    nz = rng.standard_normal(n)
    x = lp(nz, 3000) * np.exp(-t / 0.018)
    x = normp(x) + 0.6 * normp(reson(nz * np.exp(-t / 0.01), rng.uniform(380, 650), 4))
    sq = bp(rng.standard_normal(n), 800, 3000) * np.exp(-t / 0.05) * np.clip(1 + drift(n, 60, rng), 0, 3)
    return normp((x + 0.35 * normp(sq)) * ar(n, 0.0004, 0.03))


def barrel(rng):
    n = ns(0.8)
    t = tv(n)
    x = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / tau) for f, tau in ((140, 0.18), (231, 0.12), (377, 0.07)))
    return normp(x * ar(n, 0.0005, 0.05))


def splinter(rng, size=1.0, dur=1.6):
    n = ns(dur)
    out = np.zeros((2, n))
    k = int(8 * size)
    times = np.concatenate([[0.0], np.sort(rng.exponential(0.05 * size, k - 1))])
    for j, tt in enumerate(times):
        i = int(tt * SR)
        w = wood(rng, rng.uniform(250, 900), 0.3, rng.uniform(0.02, 0.07), rng.uniform(0.6, 1.2)) * (1.0 if j == 0 else rng.uniform(0.3, 0.8))
        L = min(len(w), n - i)
        out[:, i:i + L] += pan(w[:L], rng.uniform(-0.7, 0.7))
    th = impact(rng, 0.6 * size, 120, 50, 0.3, 0.6, dur=min(dur, 1.0))
    out[:, :len(th)] += pan(th, 0.0)
    for _ in range(int(30 * size)):
        tt = rng.exponential(0.35) + 0.05
        i = int(tt * SR)
        if i >= n - 10:
            continue
        w = wood(rng, rng.uniform(800, 2500), 0.08, 0.01, 0.5) * rng.uniform(0.05, 0.25)
        L = min(len(w), n - i)
        out[:, i:i + L] += pan(w[:L], rng.uniform(-0.9, 0.9))
    return normp(out)


def tide_breaker():
    """MUSIC E 'Tide-Breaker' 200.5-221 (140 bpm): swell -> 203.0 hero hit + theme -> 207.5 hit -> fight drive"""
    sc = 'D'
    c = Clock(203.0, 140)
    b = c.b
    # 200.5-203 swell
    x = ensemble(['D3', 'F3', 'A3', 'D4'], 2.6, att=2.4, rel=0.05, kind='choir', voices=3, det=8, vib=5, rng=R('tbchoir'))
    place('music', 200.5, x, sc, -20, hall=0.6, label='Tide-Breaker swell')
    n = ns(2.6)
    tt = tv(n)
    x = ensemble(['D2', 'A2', 'D3'], 2.6, att=0.3, rel=0.03, kind='brass', voices=3, det=8, vib=0, rng=R('tbbr'),
                 cut_env=200 * (3000 / 200) ** (tt / 2.6))
    place('music', 200.5, x * pts(n, [(0, -20), (2.6, 0)], dbs=True)[None, :], sc, -14, hall=0.3)
    rt = R('tbroll')
    t0 = 201.2
    while t0 < 202.98:
        u = (t0 - 201.2) / 1.8
        place('music', t0, taiko(rt, 60 if int(t0 * 20) % 2 else 100, 0.4 + 0.5 * u, 0.5), sc, -20 + 10 * u, room=0.2)
        t0 += 0.16 - 0.08 * u
    place('music', 201.0, riser(2.0, R('tbriser'), 300, 8000, tone=(110, 880)), sc, -14)
    # 203.0 HIT: Bb major tutti, theme phrase 1 over Bb -> Gm -> F
    harm = [(0, 2.5, 'Bb'), (2.5, 1.5, 'Gm'), (4, 2.6, 'F')]
    for (bt, ln, ch) in harm:
        pad(sc, 'music', c(bt), ln * b + 0.1, chord(ch, 12, drop=1), 'strings', -14, att=0.03 if bt == 0 else 0.2, rel=0.6,
            hall=0.45, vib=8, cutoff=5000, name='tbs')
        pad(sc, 'music', c(bt), ln * b + 0.1, chord(ch)[:4], 'brass', -15, att=0.03 if bt == 0 else 0.2, rel=0.6, hall=0.35,
            voices=3, det=6, vib=2, cutoff=2400, name='tbb')
        pad(sc, 'music', c(bt), ln * b + 0.1, chord(ch, 12, drop=1), 'choir', -21, att=0.2, rel=1.0, hall=0.6, vib=5, name='tbc')
    place('music', 203.0, taiko(R('tbhit'), 42, 1.0, 1.8), sc, -4, hall=0.4, label='hero hit + theme (203.0)')
    for j, (t1, f, d) in enumerate(theme_notes(c, 0, 74, THEME, 5)):
        pad(sc, 'music', t1, d + 0.05, [f / 2, f], 'brass', -11, att=0.04, rel=0.4 if j < 4 else 1.2, hall=0.45, voices=3,
            det=6, vib=4, cutoff=3200, drive=0.4, name=f'tbt{j}')
        pad(sc, 'music', t1, d + 0.05, [f, f * 2], 'strings', -15, att=0.04, rel=0.4 if j < 4 else 1.2, hall=0.5, voices=3,
            det=6, vib=10, cutoff=6500, name=f'tbv{j}')
    # 205.6-207.5 sustain (under dialogue): F -> C/E, soft taiko pulse
    pad(sc, 'music', 205.5, 2.1, chord('F', 12, drop=1), 'strings', -22, att=0.3, rel=0.4, hall=0.5, vib=6, name='tbsus')
    pad(sc, 'music', 205.5, 2.1, chord('C/E')[:3], 'pad', -22, att=0.3, rel=0.4, hall=0.3, name='tbsusb')
    for k in range(3):
        place('music', 205.5 + k * 2 * b, taiko(R(f'tbp{k}'), 55, 0.6, 0.8), sc, -18, room=0.2)
    # 207.5 music hit -> fight drive
    c2 = Clock(207.5, 140)
    pad(sc, 'music', 207.5, 1.0, chord('Dm'), 'brass', -9, att=0.01, rel=0.8, hall=0.4, voices=3, det=9, vib=0, cutoff=2600, name='tbhit2')
    place('music', 207.5, taiko(R('tbhit2'), 45, 1.0, 1.5), sc, -5, hall=0.4, label='music hit 207.5')
    prog = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A']
    rp = R('tbfight')
    for i, ch in enumerate(prog):
        bt = i * 4
        full = c2(bt) >= 213.9
        if c2(bt) >= 221.0:
            break
        root = 38 + ((int(mid(CH[ch][0])) - 2) % 12)
        for e in range(8):
            tt = c2(bt + e / 2)
            if tt >= 221.0:
                break
            x = ensemble([mhz(root + (12 if e in (2, 5) else 0))], 0.24, att=0.004, rel=0.07, kind='strings', voices=2, det=7, vib=0, rng=rp, cutoff=1800)
            place('music', tt, x, sc, -15, room=0.15)
            if e in (0, 3, 6) or (full and e in (2, 5, 7)):
                place('music', tt, taiko(rp, 52 if e in (0, 3, 6) else 110, 0.9 if e in (0, 3, 6) else 0.6, 0.9 if e in (0, 3, 6) else 0.4), sc, -11 if e in (0, 3, 6) else -17, room=0.2)
            place('music', tt, taiko(rp, 400, 0.35, 0.1), sc, -25, p=-0.3)
        pad(sc, 'music', c2(bt), 4 * c2.b + 0.05, chord(ch)[:3], 'brass', -16 if full else -20, att=0.05, rel=0.2, hall=0.3,
            voices=3, det=7, vib=2, cutoff=2400 if full else 1500, name='tbfb')
        pad(sc, 'music', c2(bt), 4 * c2.b + 0.05, chord(ch, 12, drop=2), 'strings', -20, att=0.05, rel=0.2, hall=0.35,
            trem=0.7, vib=3, name='tbfs')
    for j, (t1, f, d) in enumerate(theme_notes(c2, 16, 62, THEME, 5)):
        pad(sc, 'music', t1, d + 0.03, [f, f / 2], 'brass', -13, att=0.03, rel=0.3, hall=0.4, voices=3, det=6, vib=3, cutoff=2800, name=f'tbft{j}')
        if j == 0:
            CUES.append((t1, 'music', 'fight theme (low brass)'))


def reprise():
    """221-228.4 Music C reprise: warm, light"""
    sc = 'REP'
    c = Clock(221.0, 80)
    b = c.b
    prog = [(0, 4, 'D'), (4, 4, 'Gmaj7'), (8, 2, 'Bm7')]
    rp = R('rep')
    for (bt, ln, ch) in prog:
        pad(sc, 'music', c(bt), ln * b + 0.3, chord(ch, 12, drop=1), 'strings', -22, att=0.6, rel=1.0, hall=0.5, vib=6, name='reps')
        pad(sc, 'music', c(bt), ln * b + 0.3, chord(ch)[:2], 'pad', -26, att=0.6, rel=1.0, hall=0.3, cutoff=900, name='repb')
        tones = [m for m in ostinato_tones(ch, 62) if m % 12 in (2, 4, 6, 9, 11, 7)]
        for e in range(int(ln * 2)):
            place('music', c(bt + e / 2), pluck(mhz(tones[[0, 2, 3, 4, 3, 2, 1, 2][e % 8] % len(tones)]), 1.3, 0.45, 'harp', rp),
                  sc, -19, p=-0.3 + 0.08 * (e % 8), hall=0.4, label='Halcyon reprise' if (bt == 0 and e == 0) else None)
    rf = R('repfl')
    for (tt, p, d) in ((226.6, 'F#5', 0.6), (227.2, 'A5', 0.9)):
        place('music', tt, flute(p, d, rf, vel=0.6, scoop=0.3), sc, -22, p=0.15, hall=0.5)


def hush2_and_attack():
    sc = 'D'
    # 228.5 THE HUSH RETURNS: same sounds as the cold open
    place('sfx', 228.5, hush_tone(17.5), sc, -50, label='hush returns: 3.2 kHz tone')
    place('sfx', 228.5, sub_swell(7.0, 3.6, 34.0), sc, -30)
    place('sfx', 231.0, glyph_shimmer(4.4, R('glyph1')), sc, -27, hall=0.6, label='glyph ring shimmer (reuse)')
    place('sfx', 231.0, sub_swell(5.0, 3.2, 29.0), sc, -30)
    x = ensemble(['D1', 'D2', 'Eb2', 'A2'], 11.2, att=3.5, rel=0.4, kind='pad', voices=3, det=6, vib=0, rng=R('dread'), cutoff=500)
    x = x * (1 + 0.25 * np.sin(2 * np.pi * 0.18 * tv(x.shape[1])))[None, :]
    place('music', 235.0, x, sc, -21, hall=0.4, label='low dread drone')
    # 246 HOLLOW ATTACK
    rw = R('wave2')
    wv = white_wave(rw, 5.0)
    place('sfx', 246.0, lp(wv, 1600), sc, -17, hall=0.5, label='white wave, far side of harbour')
    drops = [247.05, 247.4, 247.85, 248.2, 248.6, 249.05, 249.4, 249.8]
    for j, tt in enumerate(drops):
        rd = R(f'drop{j}')
        x = impact(rd, 0.55, 120, 45, 0.3, 0.6) * 0.8
        g = glitch_burst(rd, 0.16, slam=0.0, decay=0.06).sum(0) * 0.5
        x[:len(g)] += g
        place('sfx', tt, x, sc, -10 + rd.uniform(-2, 1), p=rd.uniform(-0.8, 0.8), room=0.3, hall=0.15,
              label='hollow drops/lands' if j == 0 else None)
    for j, tt in enumerate((250.2, 250.7, 251.1, 251.9, 252.2, 253.0, 253.4, 253.8)):
        rx = R(f'clash{j}')
        x = metal(rx, rx.uniform(700, 1100), 0.7, ratios=(1.0, 1.47, 2.09, 2.83, 3.71), tau=0.22, click=0.8)
        place('sfx', tt, x, sc, -11 + rx.uniform(-2, 1), p=rx.uniform(-0.7, 0.7), room=0.35, label='spear clashes' if j == 0 else None)
    place('sfx', 250.0, crackle(4.0, 30, R('combatgl'), 'glitch'), sc, -22, room=0.2)
    place('sfx', 252.5, glitch_burst(R('erase'), 0.5, slam=0.6, decay=0.22), sc, -7, room=0.2, label='guard erased (glitch burst)')
    gc = crackle(0.8, 200, R('erase_cr2'), 'glitch', rate_env=lambda x: np.exp(-x / 0.3))
    place('sfx', 252.55, gc, sc, -19)
    # 254-260 the bell lord descends: huge bell drone swelling, slowly ringing
    n = ns(6.4)
    env = pts(n, [(0, -40), (2.0, -14), (5.4, 0), (6.0, 0), (6.4, -6)], dbs=True)
    place('sfx', 254.0, bell_drone('D2', 6.4, R('lorddrone'), env), sc, -10, hall=0.5, label='bell lord descends (drone)')
    for j, tt in enumerate((254.6, 256.4, 257.9, 259.0)):
        place('sfx', tt, bell('D2', 3.0, R(f'ring{j}'), T=9, strike=0.4), sc, -24 + 3 * j, hall=0.5)
    dsc = whoosh(6.0, R('descend'), 0.92, 120, 900, 0.6, 0.0, 0.0, bw=1.8)
    place('sfx', 254.0, dsc, sc, -22, hall=0.3)
    # 260.0 TOLL: enormous bronze bell + sub boom + airy shockwave
    place('sfx', 260.0, bell('D2', 16.0, R('toll260'), T=14, strike=1.3, width=0.9), sc, -1.5, hall=0.45, label='BELL LORD lands & TOLLS')
    place('sfx', 260.0, impact(R('toll_boom'), 3.0, 80, 28, 0.3, 0.7), sc, -3)
    sw = shaped_noise(3.0, lambda T, F: (np.minimum(F / 200, 1) / np.sqrt(1 + (F / (6000 * np.exp(-T / 0.6) + 400)) ** 4)) * np.exp(-T / 0.7) * np.clip(T / 0.02, 0, 1), R('shock'), nch=2)
    place('sfx', 260.0, normp(sw), sc, -8, hall=0.3)
    # 262-276 low bell hum under dialogue
    n = ns(14.5)
    place('sfx', 261.5, bell_drone('D2', 14.5, R('hum262'), pts(n, [(0, -30), (1.5, 0), (13, 0), (14.5, -20)], dbs=True), ratios=(0.5, 1.0, 1.183, 2.0)),
          sc, -29, hall=0.4, label='low bell hum')
    music_bellwether()


def music_bellwether():
    sc = 'D'
    # low brass-like drones 246-262
    n = ns(14.0)
    t = tv(n)
    x = ensemble(['D1', 'A1', 'D2', 'Eb2'], 14.0, att=2.0, rel=0.3, kind='brass', voices=3, det=7, vib=0, rng=R('bwdrone'),
                 cut_env=200 + 900 * np.clip(t / 14, 0, 1) ** 2 + 150 * np.sin(2 * np.pi * 0.2 * t) ** 2)
    place('music', 246.0, x * pts(n, [(0, -10), (8, -5), (13.5, 0), (14.0, -4)], dbs=True)[None, :], sc, -15, hall=0.4,
          label="MUSIC F 'Bellwether' drones")
    # villain bell motif: D - Ab - G (tritone sigh)
    for k, t0 in enumerate((247.0, 250.5, 254.0)):
        for j, (o, p) in enumerate(((0.0, 'D4'), (0.75, 'Ab4'), (1.5, 'G4'))):
            place('music', t0 + o, bell(hz(p) / 2, 4.0, R(f'bm{k}{j}'), T=3.0, strike=0.7, bright=0.8), sc, -17 + 2 * k, p=-0.3 + 0.3 * j,
                  hall=0.55, label='villain bell motif' if (k == 0 and j == 0) else None)
    # combat pulse 250-254 (100 bpm eighths)
    c = Clock(250.0, 100)
    rp = R('bwpulse')
    for e in range(int(4.0 / (c.b / 2))):
        tt = c(e / 2)
        place('music', tt, taiko(rp, 50 if e % 4 == 0 else 80, 0.8 if e % 4 == 0 else 0.5, 0.9 if e % 4 == 0 else 0.5), sc, -13 if e % 4 == 0 else -19, room=0.2, hall=0.2)
    # 254-260 crescendo cluster
    x = ensemble(['D3', 'Eb3', 'Ab3', 'A3', 'D4'], 6.0, att=5.0, rel=0.05, kind='strings', voices=3, det=6, vib=3, trem=0.7, rng=R('bwcl'))
    place('music', 254.0, x, sc, -17, hall=0.4)
    place('music', 257.5, riser(2.5, R('bwriser'), 200, 7000, tone=(55, 440), curve=2.5), sc, -15)
    # 260 music hit
    pad(sc, 'music', 260.0, 3.0, chord('Bell') + [hz('D1')], 'brass', -7, att=0.01, rel=2.5, hall=0.5, voices=3, det=10, vib=0, cutoff=2400, drive=0.8, name='bwhit')
    place('music', 260.0, taiko(R('bwhit'), 40, 1.0, 2.0), sc, -4, hall=0.4)
    pad(sc, 'music', 260.0, 3.0, ['D3', 'F3', 'Ab3', 'D4'], 'choir', -16, att=0.05, rel=2.5, hall=0.7, vib=5, name='bwchoir')
    # 262-276 tense string tremolo under dialogue
    x = ensemble(['D3', 'F3', 'Ab3', 'B3'], 14.6, att=2.0, rel=0.5, kind='strings', voices=3, det=5, vib=0, trem=0.85, rng=R('bwtrem'), cutoff=3000)
    place('music', 261.8, x * pts(x.shape[1], [(0, 0), (10, -2), (14.6, 2)], dbs=True)[None, :], sc, -28, hall=0.4, label='string tremolo')


def the_toll():
    sc = 'D'
    # 276.5 the bell rings again
    place('sfx', 276.5, bell('D2', 12.0, R('toll276'), T=12, strike=1.2, width=0.9), sc, -3, hall=0.45, label='bell rings again (276.5)')
    place('sfx', 276.5, impact(R('toll276b'), 2.2, 80, 30, 0.2, 0.6), sc, -7)
    # white wave rushes along the dock, approaching L -> R
    n = ns(2.1)
    t = tv(n)
    wv = white_wave(R('wave3'), 2.6)[:, :n]
    mono = wv.sum(0)
    fc = 600 * (6000 / 600) ** (t / 2.1)
    mono = tvf(mono, fc, 'low', 2)
    x = pan(mono, -1 + 1.5 * t / 2.1) * pts(n, [(0, -24), (2.0, 0), (2.1, 0)], dbs=True)[None, :]
    place('sfx', 276.5, normp(x), sc, -8, label='white wave approaches L->R')
    # 277.5 plants the anchor: impact + water wall rises (sustained churning roar to 285.5)
    ra = R('plant')
    place('sfx', 277.5, mixa(impact(ra, 1.2, 100, 40, 0.5, 0.8), 0.4 * metal(ra, 150, 1.6, tau=0.5)), sc, -5, room=0.3, label='anchor planted')
    place('sfx', 277.5, splash(ra, 2.5), sc, -6)
    wr = water_roar(8.3, ra, 250, 4500, 0.9, 0.45)
    place('sfx', 277.5, wr * pts(wr.shape[1], [(0, -20), (0.8, 0), (7.9, -1), (8.3, -10)], dbs=True)[None, :], sc, -9,
          label='water wall rises (churning roar)')
    place('sfx', 277.7, bubbles(7.8, 40, ra, 250, 1200), sc, -24)
    # 278.5 the white wave hits the water wall: hiss + static + strain (to 285.5)
    rh = R('strain')
    place('sfx', 278.5, glitch_burst(rh, 0.35, slam=1.0, decay=0.12), sc, -2, label='wave hits water wall')
    place('sfx', 278.5, impact(rh, 1.4, 120, 35, 1.0, 0.9), sc, -4)
    d = 7.0
    n = ns(d)
    t = tv(n)
    hiss = np.stack([hp(rh.standard_normal(n), 3500), hp(rh.standard_normal(n), 3500)])
    hiss = hiss / rms(hiss) * np.clip(1 + 0.3 * drift(n, 5, rh), 0.2, 2)
    place('sfx', 278.5, hiss * pts(n, [(0, 0), (0.1, -2), (6.7, 0), (7.0, -20)], dbs=True)[None, :], sc, -27)
    place('sfx', 278.5, crackle(d, 160, rh, 'static'), sc, -22)
    place('sfx', 278.5, crackle(d, 12, rh, 'glitch'), sc, -24)
    fi = 52 * (1 + 0.05 * drift(n, 1.5, rh)) * (1 + 0.15 * t / d)
    sg = osc('saw', fi, n) + osc('saw', fi * 1.5 * 1.004, n) * 0.5
    sg = lp(sg, 500) * pts(n, [(0, 0), (0.5, 1), (6.8, 1), (7.0, 0)])
    place('sfx', 278.5, np.tanh(1.5 * normp(sg)), sc, -21, room=0.2, label='strain (sustained)')
    # 283.5 her chest blazes: warm hum, stronger, unstable crackle
    n = ns(2.2)
    place('sfx', 283.5, warm_hum(2.2, R('glow2'), 110, pts(n, [(0, -20), (0.3, 0), (2.0, 0), (2.2, -30)], dbs=True), unstable=1.0), sc, -12,
          hall=0.3, label='chest blazes (hum + crackle)')
    place('sfx', 283.5, crackle(2.0, 60, R('glowcr'), 'static'), sc, -18)
    # 285.5 water wall breaks: huge crash + splash
    rb = R('break')
    place('sfx', 285.5, splash(rb, 4.0, 3.0), sc, -1.5, hall=0.25, label='WATER WALL BREAKS')
    place('sfx', 285.5, impact(rb, 2.0, 100, 32, 0.7, 0.9), sc, -3)
    wr = water_roar(3.5, rb, 400, 6000, 0.05, 0.5)
    place('sfx', 285.5, wr * pts(wr.shape[1], [(0, 1), (3.5, 0)])[None, :], sc, -6)
    # 286.0 they're thrown: bodies hitting wood
    for j, (tt, s) in enumerate(((286.0, 1.0), (286.18, 0.8), (286.45, 0.6))):
        rj = R(f'thrown{j}')
        place('sfx', tt, normp(mixa(impact(rj, 0.6, 130, 55, 0.8, 0.9), 0.8 * wood(rj, 190, 0.5, 0.08, 1.2))), sc, -2 - 3 * j,
              p=(-0.4, 0.4, 0.1)[j], room=0.3, label='thrown onto wood' if j == 0 else None)
    place('sfx', 286.3, creak(R('thrown_cr'), 0.8, (20, 50), (200, 450, 800), 10), sc, -16)
    # 288-290.5 riser + bell swell toward a final toll that never comes
    place('sfx', 288.0, riser(2.8, R('final_riser'), 200, 9000, tone=(55, 880), curve=2.2), sc, -8, label='riser + bell swell')
    n = ns(2.8)
    place('sfx', 288.0, bell_drone('D2', 2.8, R('finalswell'), pts(n, [(0, -30), (2.8, 0)], dbs=True)), sc, -8, hall=0.3)
    music_toll()


def music_toll():
    sc = 'D'
    pad(sc, 'music', 276.5, 2.0, chord('Bell') + [hz('D1')], 'brass', -10, att=0.02, rel=1.2, hall=0.5, voices=3, det=10, vib=0,
        cutoff=2000, drive=0.6, name='tollhit')
    place('music', 276.5, taiko(R('tollt'), 42, 1.0, 1.8), sc, -6, hall=0.4)
    x = ensemble(['D2', 'A2', 'D3', 'F3', 'A3', 'D4'], 7.2, att=3.5, rel=0.3, kind='strings', voices=3, det=6, vib=2, trem=0.85, rng=R('tolltrem'))
    place('music', 278.3, x, sc, -19, hall=0.4)
    c = Clock(278.5, 100)
    for k in range(12):
        tt = c(k)
        if tt > 285.4:
            break
        place('music', tt, taiko(R(f'tollp{k}'), 50, 0.7 + 0.02 * k, 0.9), sc, -15 + 0.4 * k, room=0.2)
    # 283.5: hero theme fragment fighting back (high strings + horns)
    c2 = Clock(283.5, 120)
    for j, (tt, f, d) in enumerate(theme_notes(c2, 0, 74, THEME, 4)):
        pad(sc, 'music', tt, d + 0.05, [f, f * 2], 'strings', -16, att=0.04, rel=0.3, hall=0.5, voices=3, det=6, vib=12, cutoff=6500, name=f'tollth{j}')
        pad(sc, 'music', tt, d + 0.05, [f / 2], 'brass', -17, att=0.04, rel=0.3, hall=0.4, voices=3, det=6, vib=3, cutoff=2600, name=f'tollhb{j}')
        if j == 0:
            CUES.append((tt, 'music', 'hero theme fragment (283.5)'))
    pad(sc, 'music', 285.5, 2.0, chord('Bell') + [hz('D1')], 'brass', -9, att=0.01, rel=1.2, hall=0.5, voices=3, det=10, vib=0, cutoff=2400, name='tollbreak')
    x = ensemble(['D2', 'Eb2', 'A2', 'Ab3', 'D4', 'Eb4'], 2.9, att=2.6, rel=0.02, kind='brass', voices=3, det=10, vib=0, rng=R('finalcl'),
                 cut_env=200 * (3500 / 200) ** (tv(ns(2.9)) / 2.9))
    place('music', 288.0, x, sc, -10, hall=0.3)


def ending():
    sc = 'E'
    # 291.0 faint violet hum in the fog
    n = ns(7.5)
    t = tv(n)
    vh = sum(sine(f * (1 + 0.002 * np.sin(2 * np.pi * 0.3 * t + i)), n) / (1 + i) for i, f in enumerate((196.0, 293.7, 392.6, 587.0)))
    vh = vh * (0.8 + 0.2 * np.sin(2 * np.pi * 0.5 * t)) * ar(n, 1.2, 0.3)
    place('sfx', 291.0, vh / np.max(np.abs(vh)), sc, -36, p=0.3, hall=0.4, label='violet lantern hum')
    fog = lp(R('fog').standard_normal(n), 400)
    place('amb', 291.0, fog / rms(fog) * ar(n, 1.5, 0.3), sc, -56)
    # heavy armoured footsteps, slow, echoing
    for j, tt in enumerate((292.2, 293.4, 294.6, 295.8)):
        rf = R(f'heavy{j}')
        x = mixa(impact(rf, 0.9, 85, 35, 0.2, 0.7), 0.55 * metal(rf, rf.uniform(180, 240), 1.2, tau=0.35, click=0.6))
        jing = chain(0.2, rf, 200, 3500, 8000).sum(0)
        x[:len(jing)] += 0.3 * jing
        place('sfx', tt, normp(x), sc, -13 + 1.0 * j, p=0.2, room=0.2, hall=0.7, label='heavy armoured footsteps' if j == 0 else None)
    # 297.2 cliffhanger sting: deep piano + strings, unresolved (D minor-major 9)
    rp = R('sting')
    for p, v in (('D1', 0.9), ('D2', 0.9), ('A2', 0.8), ('F3', 0.7), ('C#4', 0.75), ('E4', 0.7)):
        place('music', 297.2, pluck(p, 1.4, v, 'piano', rp), sc, -9, hall=0.5, label='cliffhanger sting' if p == 'D1' else None)
    x = ensemble(['D2', 'A2', 'F3', 'C#4', 'E4'], 1.4, att=0.15, rel=0.05, kind='strings', voices=3, det=5, vib=4, rng=R('stingstr'))
    place('music', 297.2, x, sc, -18, hall=0.5)
    place('music', 297.2, sub_swell(1.4, 0.6, 36.7), sc, -22)


# =====================================================================
#  dialogue ducking / loudness / limiter
# =====================================================================
DIALOGUE = [(3.0, 4.1), (9.6, 12.1), (18.3, 22.3), (24.6, 28.8), (38.4, 39.2), (52.4, 52.8), (55.4, 59.0), (60.5, 61.7),
            (66.2, 67.6), (77.4, 78.6), (104.9, 106.5), (107.0, 111.1), (123.0, 127.5), (128.6, 131.0), (131.6, 132.4),
            (134.3, 136.1), (153.5, 159.9), (162.3, 163.6), (182.6, 184.2), (185.0, 186.8), (187.6, 188.1), (191.6, 193.7),
            (197.6, 200.3), (205.6, 207.5), (221.0, 222.2), (222.9, 226.5), (230.6, 231.2), (235.6, 239.7), (242.2, 244.7),
            (262.6, 265.6), (267.0, 268.8), (279.0, 283.3), (283.8, 285.1), (296.0, 296.8)]


def duck_curve(windows, depth_db, att=0.12, rel=0.35):
    g = np.zeros(N)
    for (a, b_) in windows:
        i0, i1 = ts(a - att), ts(b_ + rel)
        seg = np.ones(i1 - i0)
        na, nr = ts(att), ts(rel)
        seg[:na] = 0.5 - 0.5 * np.cos(np.pi * np.arange(na) / na)
        seg[-nr:] = np.minimum(seg[-nr:], 0.5 + 0.5 * np.cos(np.pi * np.arange(1, nr + 1) / nr))
        g[i0:i1] = np.maximum(g[i0:i1], seg)
    return 10 ** (-depth_db * g / 20)


def k_weight(x):
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=-1), axis=-1)


def block_loudness(x, blk=0.4, hop=0.1):
    y = k_weight(x)
    p = np.cumsum(np.concatenate([np.zeros((2, 1)), y ** 2], axis=1), axis=1)
    B, H = ns(blk), ns(hop)
    st_ = np.arange(0, x.shape[1] - B + 1, H)
    z = ((p[:, st_ + B] - p[:, st_]) / B).sum(0)
    return st_ / SR, z


def integrated_lufs(x):
    _, z = block_loudness(x)
    l = -0.691 + 10 * np.log10(z + 1e-20)
    z1 = z[l > -70]
    lr = -0.691 + 10 * np.log10(np.mean(z1)) - 10
    z2 = z[(l > -70) & (l > lr)]
    return -0.691 + 10 * np.log10(np.mean(z2))


def limiter_gain(x, ceil_db=-1.6, win=0.012):
    """look-ahead brickwall: per-sample required gain, min-held and box-smoothed (never exceeds ceiling)"""
    ceil = 10 ** (ceil_db / 20)
    a = np.max(np.abs(x), axis=0)
    g = np.minimum(1.0, ceil / np.maximum(a, 1e-9))
    W = ns(win)
    h = minimum_filter1d(g, size=2 * W + 1, mode='nearest')
    s = uniform_filter1d(h, size=2 * W + 1, mode='nearest')
    return np.minimum(s, g)


def write_wav(path, x, dither_rng):
    y = x.copy()
    active = uniform_filter1d((np.abs(y).max(0) > 1e-7).astype(float), ns(0.05)) > 0
    d = (dither_rng.random(y.shape) - dither_rng.random(y.shape)) / 32768.0
    y = y + d * active[None, :]
    y = np.clip(y, -1, 32767 / 32768)
    sf.write(path, y.T, SR, subtype='PCM_16')


# =====================================================================
#  main
# =====================================================================
def main():
    log('building scenes / reverbs')
    mkscene('A', 0.0, 30.6)
    mkscene('B', 30.6, 62.5, fout_start=60.15)
    mkscene('C', 60.0, 81.6)
    mkscene('T', 81.6, 92.6, fout_start=92.1)
    mkscene('HAL', 93.0, 104.05, fout_start=103.9)
    mkscene('D', 93.0, 290.8)
    mkscene('V', 104.0, 113.12)
    mkscene('S', 113.12, 116.03)
    mkscene('CH', 118.0, 148.3)
    mkscene('BR', 148.3, 166.0)
    mkscene('FALL', 166.0, 176.0, fout_start=175.4)
    mkscene('H', 176.0, 228.5)
    mkscene('REP', 220.9, 228.45, fout_start=227.6)
    mkscene('E', 290.8, 298.5)
    IR['room'] = make_ir(0.9, 0.008, 'ir_room', damp=8000)
    IR['hall'] = make_ir(3.4, 0.025, 'ir_hall', lo_mult=1.2, hi_mult=0.4, damp=6500)
    steps = [('cold open A (0-30.6)', cold_open_A), ('cold open B (30.6-62.5)', cold_open_B),
             ('cold open C (60-81.6)', cold_open_C), ('title (81.6-93)', title), ('halcyon (93-104)', halcyon),
             ('vault (104-113)', vault), ('glass + slow-mo (113-118)', glass_slowmo), ('chase (118-148.3)', chase),
             ('bridge (148.3-166)', bridge), ('fall (166-176)', fall), ('harbour/anchor/fight (176-221)', harbour),
             ('Tide-Breaker (200.5-221)', tide_breaker), ('reprise (221-228.5)', reprise),
             ('hush + hollow attack (228.5-276)', hush2_and_attack), ('the toll (276-290.8)', the_toll),
             ('ending (290.8-298.5)', ending)]
    for name, fn in steps:
        fn()
        log('  cue', name)
    out = {s: np.zeros((2, N)) for s in STEMS}
    for sc in SC.values():
        render_scene(sc, out)
    log('scenes rendered')
    # dialogue ducking: music & ambience -7 dB; the whisper at 38.4 gets -10; sustained sfx under dialogue -4 dB
    out['music'] *= duck_curve(DIALOGUE, 7.0)[None, :]
    out['amb'] *= duck_curve(DIALOGUE, 7.0)[None, :]
    out['music'] *= duck_curve([(38.4, 39.2)], 4.0)[None, :]
    out['sfx'] *= duck_curve([(38.4, 39.2), (262.6, 265.6), (267.0, 268.8), (279.0, 283.3), (283.8, 285.1)], 4.0)[None, :]
    # guarantee true silence where the sheet demands it
    for (a, b_) in ((81.6, 82.6), (92.6, 93.0), (298.5, 300.0)):
        for s in STEMS:
            out[s][:, ts(a):ts(b_)] = 0.0
    # loudness normalisation to -18 LUFS integrated, then a look-ahead limiter (same gain applied to every stem)
    for it in range(3):
        mix = out['music'] + out['sfx'] + out['amb']
        L = integrated_lufs(mix)
        gain = 10 ** ((-18.0 - L) / 20)
        for s in STEMS:
            out[s] *= gain
        mix *= gain
        g = limiter_gain(np.concatenate([mix] + [out[s] for s in STEMS]))
        for s in STEMS:
            out[s] *= g[None, :]
        log(f'  loudness pass {it}: measured {L:.2f} LUFS, gain {20 * np.log10(gain):+.2f} dB, limiter max GR {-20 * np.log10(g.min()):.2f} dB')
    mix = out['music'] + out['sfx'] + out['amb']
    # stems must stay below the ceiling individually too
    pk = max(np.max(np.abs(out[s])) for s in STEMS)
    if pk > 10 ** (-1.05 / 20):
        f = 10 ** (-1.05 / 20) / pk
        for s in STEMS:
            out[s] *= f
        mix *= f
    rng = R('dither')
    write_wav(os.path.join(HERE, 'score_sfx.wav'), mix, rng)
    for s in STEMS:
        write_wav(os.path.join(HERE, f'{s}.wav'), out[s], rng)
    log('wrote wavs')
    with open(os.path.join(HERE, 'cue_log.json'), 'w') as fh:
        json.dump(sorted(CUES), fh, indent=0)
    log('verifying (levels.json, spectrogram.png)')
    try:
        sys.path.insert(0, HERE)
        import verify_audio
        verify_audio.main()
    except Exception as e:  # verification is a convenience; the audio is already written
        log('verification skipped:', repr(e))
    log('done')


if __name__ == '__main__':
    main()
