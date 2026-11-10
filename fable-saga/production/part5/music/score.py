#!/usr/bin/env python3
"""THE HOLLOW - Fable Saga part V - score and sound design (40.000 s).

Self-contained: numpy only (no scipy, no soundfont, no samples). Everything is synthesized here:
wavetable string/brass/choir ensembles, additive piano/celesta/harp/bells, NES-style chip voices
(band-limited pulse and 4-bit triangle, LFSR noise, 60 Hz stepped envelopes), orchestral percussion,
hybrid layer (sub booms, sub drops, braams, risers, reverse cymbals) and the sound design (glass sky,
light/void blades, whooshes, worlds, wing, pin, snap, catch, the horizon). Then FFT hall reverb,
segmented hard cuts, bus glue, true-peak limiting to -14 LUFS, and a measured verification report.

Writes /home/user/brain/fable-saga-video/part5/score.wav (48 kHz / 24-bit / stereo, exactly 40.000 s)
and verification.txt next to this file.

Themes (carried over from parts III-IV)
  hero      1-5-6-5-8 head and its full 20-note melody (part III/IV THEME table)
  Unmaker   D-Eb-D-Ab (long-short-mid-long)
  Sunderer  Eb3 -> D2, a falling minor ninth, the low note hammered
  Hollow    the two twisted together: the Unmaker's line on top, the Sunderer's ninth answering under every
            note of it; at 14.0 the hero theme INVERTED (which lands in D Phrygian: the Sunderer's Eb is
            built into the mirror image) in low brass, dragged down through the HITs to the pin at 18.4.
Keys: Hollow D minor/Phrygian; hero defiance 7.5 D major; DAWNBREAK 23.0 Eb major (the Sunderer's Eb
becomes the hero's new home: a key the theme has never been played in); FURTHER 33.0 E major; end E major.

    python3 score.py
"""
import os, sys, wave, subprocess, time, struct, shutil
from concurrent.futures import ThreadPoolExecutor
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = '/home/user/brain/fable-saga-video/part5/score.wav'
REPORT = os.path.join(HERE, 'verification.txt')
SR = 48000
DUR = 40.0
NS = int(round(SR * DUR))
RNG = np.random.default_rng(5150)
# render segments: each one is cut at its boundary. (time, fade, mode): 'end' = the fade is complete at the
# boundary (breaths, the silence after the Horizon Cut); 'start' = the fade starts at the boundary (the new HIT
# lands while everything before it is cut away: the snap, the catch)
CUTS = [(6.85, 0.35, 'end'), (19.15, 0.45, 'end'), (31.0, 0.015, 'end'), (32.0, 0.02, 'start'),
        (34.1, 0.012, 'end')]
SEGB = [0.0] + [c[0] for c in CUTS] + [DUR]
SILENT = [(34.1, 34.6)]                      # digital silence after the Horizon Cut
END_FADE = (39.15, 39.75)                    # ring out, silence by 39.75
CAPTIONS = [2.2, 6.6, 19.2, 21.6, 35.4]

# =========================================================================== pitch helpers
_PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def P(s):
    if isinstance(s, (int, np.integer, float)):
        return int(s)
    n, i = _PC[s[0]], 1
    while i < len(s) and s[i] in '#b':
        n += 1 if s[i] == '#' else -1
        i += 1
    return n + 12 * (int(s[i:]) + 1)


def pc(name):
    return P(name + '0') % 12


def hz(p):
    return 440.0 * 2 ** ((p - 69) / 12)


QUAL = {'M': [0, 4, 7], 'm': [0, 3, 7], '5': [0, 7], 'mb9': [0, 3, 7, 13], 'sus4': [0, 5, 7],
        'add9': [0, 4, 7, 14], 'madd9': [0, 3, 7, 14], 'M7': [0, 4, 7, 11]}


def tones(root, q):
    r = pc(root) if isinstance(root, str) else int(root) % 12
    return r, QUAL[q]


def at(r, octave):
    return r + 12 * (octave + 1)


def timp_pitch(r):
    p = at(r, 2)
    return p if p >= 40 else p + 12


def tt(n):
    return np.arange(n) / SR


# =========================================================================== DSP helpers (numpy only)
def fastlen(n):
    best = 1 << int(np.ceil(np.log2(n)))
    a = 1
    while a < best:
        b = a
        while b < best:
            c = b
            while c < best:
                if c >= n:
                    best = c
                    break
                c *= 5
            b *= 3
        a *= 2
    return best


def g_lp(f, fc, o=2):
    return 1 / np.sqrt(1 + (f / fc) ** (2 * o))


def g_hp(f, fc, o=2):
    return 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * o))


def bell(f, f0, s):
    """gaussian bump in log-frequency, s = sigma in octaves"""
    return np.exp(-0.5 * (np.log2(np.maximum(f, 1e-3) / f0) / s) ** 2)


def g_bell(f, f0, gdb, s=0.5):
    return 10 ** (gdb * bell(f, f0, s) / 20)


def g_shelf(f, f0, gdb, high=True):
    f = np.maximum(f, 1e-3)
    s = 1 / (1 + (f0 / f) ** 2) if high else 1 / (1 + (f / f0) ** 2)
    return 10 ** (gdb * s / 20)


def ffilt(x, G, pad=16384):
    """zero-phase FFT filter; G(freqs) -> magnitude"""
    n = len(x)
    N = fastlen(n + pad)
    X = np.fft.rfft(x, N, axis=0)
    g = G(np.fft.rfftfreq(N, 1 / SR))
    if x.ndim == 2:
        g = g[:, None]
    return np.fft.irfft(X * g, N, axis=0)[:n]


def tvf(x, Gfn, nfft=1024, hop=256):
    """time-varying STFT filter: Gfn(frame_times[:,None], freqs[None,:]) -> gain"""
    n = len(x)
    win = np.hanning(nfft + 1)[:-1]
    xp = np.concatenate([np.zeros(nfft), x, np.zeros(nfft + hop)])
    nfr = (len(xp) - nfft) // hop + 1
    idx = hop * np.arange(nfr)[:, None] + np.arange(nfft)[None, :]
    F = np.fft.rfft(xp[idx] * win, axis=1)
    tf = (hop * np.arange(nfr) + nfft / 2 - nfft) / SR
    f = np.fft.rfftfreq(nfft, 1 / SR)
    F *= Gfn(tf[:, None], f[None, :])
    y = np.fft.irfft(F, nfft, axis=1) * win
    out = np.bincount(idx.ravel(), weights=y.ravel(), minlength=len(xp))
    return out[nfft:nfft + n] / 1.5


def panlr(p):
    th = (np.clip(p, -1, 1) + 1) * np.pi / 4
    return np.cos(th), np.sin(th)


def st(y, p=0.0):
    l, r = panlr(p)
    return np.stack([y * l, y * r], 1)


def noise(n, rng=None):
    return (rng or RNG).standard_normal(n)


def ramp_env(n, a, rel=0.004):
    """attack a seconds, short release at the end (anti-click)"""
    t = tt(n)
    e = np.clip(t / max(a, 1e-4), 0, 1)
    k = int(rel * SR)
    if k > 0 and n > k:
        e[-k:] *= np.linspace(1, 0, k)
    return e


def sines(t, parts, rng):
    """sum of decaying sines: parts = [(f, amp, decay)]"""
    y = np.zeros(len(t))
    for f, a, d in parts:
        if f >= 0.45 * SR or a == 0:
            continue
        y += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * np.exp(-t / d)
    return y


# =========================================================================== wavetables
L = 4096
_TAB = {}


def table_amps(amps, phases=None):
    K = len(amps)
    spec = np.zeros(L // 2 + 1, complex)
    ph = np.zeros(K) if phases is None else phases
    spec[1:K + 1] = amps * np.exp(1j * (ph - np.pi / 2)) * (L / 2)
    tab = np.fft.irfft(spec, L)
    return tab / (np.sqrt(np.mean(tab ** 2)) + 1e-12) * 0.5


def table_wave(w, K):
    S = np.fft.rfft(w)
    S[0] = 0
    S[K + 1:] = 0
    return np.fft.irfft(S, L)


def kmax(fmax, lim=17500.0):
    return max(1, int(min(lim, 0.46 * SR) / fmax))


def osc2(tA, tB, f, m=None, ph0=None):
    ph = np.cumsum(f) / SR + (RNG.random() if ph0 is None else ph0)
    pos = (ph - np.floor(ph)) * L
    i = pos.astype(np.int64)
    fr = pos - i
    j = (i + 1) & (L - 1)
    a = tA[i] + fr * (tA[j] - tA[i])
    if tB is None:
        return a
    b = tB[i] + fr * (tB[j] - tB[i])
    return a + m * (b - a)


def bend_cents(t, bend):
    if not bend:
        return 0.0
    bt = [b[0] for b in bend]
    bv = [b[1] * 100 for b in bend]
    return np.interp(t, bt, bv)


def max_bend(bend):
    return max([0] + [b[1] for b in bend]) if bend else 0


# =========================================================================== instruments
INST = {
    'vln': dict(fam='str', stem='str', pan=-0.55, width=0.35, nv=5, gain=0.55),
    'vla': dict(fam='str', stem='str', pan=-0.1, width=0.3, nv=4, gain=0.5),
    'vc': dict(fam='str', stem='str', pan=0.35, width=0.3, nv=4, gain=0.6),
    'cb': dict(fam='str', stem='str', pan=0.5, width=0.2, nv=3, gain=0.7),
    'hn': dict(fam='brass', stem='brass', pan=-0.3, width=0.3, nv=4, gain=0.55),
    'tpt': dict(fam='brass', stem='brass', pan=0.25, width=0.25, nv=3, gain=0.45),
    'tbn': dict(fam='brass', stem='brass', pan=0.45, width=0.25, nv=3, gain=0.55),
    'tuba': dict(fam='brass', stem='brass', pan=0.15, width=0.1, nv=2, gain=0.6),
    'shn': dict(fam='brass', stem='solo', pan=-0.12, width=0.0, nv=1, gain=0.6),
    'choir': dict(fam='choir', stem='choir', pan=0.0, width=0.85, nv=8, gain=0.5),
    'piano': dict(fam='piano', stem='keys', pan=0.15, gain=0.6),
    'celesta': dict(fam='bell', stem='keys', pan=0.35, gain=0.4),
    'glock': dict(fam='bell', stem='keys', pan=-0.3, gain=0.3),
    'mbox': dict(fam='bell', stem='keys', pan=0.25, gain=0.3),
    'harp': dict(fam='pluck', stem='keys', pan=-0.6, gain=0.5),
    'pizz': dict(fam='pluck', stem='str', pan=0.3, gain=0.45),
    'chip12': dict(fam='chip', stem='chip', pan=-0.3, gain=0.22, wave='sq12'),
    'chip25': dict(fam='chip', stem='chip', pan=0.25, gain=0.22, wave='sq25'),
    'chip50': dict(fam='chip', stem='chip', pan=0.0, gain=0.2, wave='sq50'),
    'chiptri': dict(fam='chip', stem='chip', pan=0.0, gain=0.4, wave='tri'),
    'chipnz': dict(fam='chipnz', stem='chip', pan=0.2, gain=0.16),
    'cold': dict(fam='cold', stem='keys', pan=0.0, gain=0.25),
}

STR_FORM = {'vln': (300, 1000, 2900, 1.0), 'vla': (240, 760, 2300, 0.8), 'vc': (190, 520, 1500, 0.6),
            'cb': (110, 380, 1000, 0.45)}


def str_tables(sect, p, top=0.0):
    key = ('str', sect, p, round(top))
    if key not in _TAB:
        f0 = hz(p)
        K = kmax(f0 * 2 ** ((top + 0.5) / 12))
        k = np.arange(1, K + 1)
        f = k * f0
        r1, r2, r3, sc = STR_FORM[sect]
        body = 1 + 1.4 * bell(f, r1, .45) + 1.0 * bell(f, r2, .55) + 1.3 * bell(f, r3, .45)
        rng = np.random.default_rng(p * 7 + len(sect))
        jit = 1 + 0.18 * rng.standard_normal(K).clip(-2, 2)
        ph = rng.uniform(0, 2 * np.pi, K)
        out = []
        for b in (0.0, 1.0):
            fc = (1400 + 5600 * b) * sc
            a = k ** -(0.9 + 0.7 * (1 - b)) * body * jit / (1 + (f / fc) ** 4) / (1 + (f / 15000) ** 8)
            out.append(table_amps(a, ph))
        _TAB[key] = out
    return _TAB[key]


def ensemble(tA, tB, f0, n, nv, det_c, vib_rate, vib_c, vib_delay, mix, bend, pan, width, env,
             trem=None, stagger=0.0, drift=3.0):
    t = tt(n)
    out = np.zeros((n, 2))
    bc = bend_cents(t, bend)
    for v in range(nv):
        d = RNG.normal(0, det_c) if nv > 1 else 0.0
        vr = vib_rate * (1 + RNG.uniform(-.1, .1))
        ve = np.clip((t - vib_delay) / 0.35, 0, 1) if vib_c else 0.0
        cents = d + bc + vib_c * ve * np.sin(2 * np.pi * vr * t + RNG.uniform(0, 6.28)) \
            + drift * np.sin(2 * np.pi * RNG.uniform(.2, .5) * t + RNG.uniform(0, 6.28))
        f = f0 * 2 ** (cents / 1200)
        y = osc2(tA, tB, f, mix)
        e = env
        if stagger:
            k = int(RNG.uniform(0, stagger) * SR)
            if k:
                e = np.concatenate([np.zeros(k), env[:-k]])
        if trem is not None:
            rate = RNG.uniform(7.2, 8.8)
            tm = 0.45 + 0.55 * np.abs(np.sin(np.pi * rate * t + RNG.uniform(0, 3))) ** 0.6
            e = e * (1 - trem + trem * tm)
        pp = pan + (width * (2 * v / (nv - 1) - 1) if nv > 1 else 0.0)
        gl, gr = panlr(pp)
        ye = y * e
        out[:, 0] += ye * gl
        out[:, 1] += ye * gr
    return out / np.sqrt(nv)


def envelope(n, dur, A, R, art, t=None):
    t = tt(n) if t is None else t
    if art == 'swell':
        att = np.clip(t / max(A, 1e-3), 0, 1) ** 2.2
    else:
        att = np.sin(np.pi / 2 * np.clip(t / max(A, 1e-4), 0, 1)) ** 2
    rel = np.where(t < dur, 1.0, np.exp(-(t - dur) / R))
    e = att * rel
    if art == 'sfz':
        e *= 0.4 + 0.6 * np.exp(-t / 0.22)
    elif art == 'marc':
        e *= 0.72 + 0.28 * np.exp(-t / 0.1)
    elif art == 'short':
        e *= np.exp(-t / 0.22)
    k = min(n, int(0.004 * SR))
    e[-k:] *= np.linspace(1, 0, k)
    return e


ATT = {'sus': .1, 'marc': .025, 'short': .006, 'sfz': .006, 'swell': None}
REL = {'sus': .32, 'marc': .22, 'short': .05, 'sfz': .4, 'swell': .25}


def r_str(inst, p, dur, vel, art='sus', trem=False, bend=None, harm=False, **kw):
    cfg = INST[inst]
    v = vel / 127
    A = ATT[art] if art != 'swell' else dur * 0.92
    R = REL[art] * (1.6 if inst in ('vc', 'cb') else 1.0)
    n = int((dur + R * 4 + 0.02) * SR)
    t = tt(n)
    env = envelope(n, dur, A, R, art, t)
    tA, tB = str_tables(inst, p, max_bend(bend))
    if harm:
        m = np.full(n, -0.6)       # flautando / harmonic: darker than the dark table
        tB = tA
        tA = table_amps(np.array([1.0, 0.08, 0.02]))
    elif art == 'swell':
        m = (0.15 + 0.75 * v) * np.clip(t / A, 0, 1) ** 1.5
    else:
        m = np.full(n, 0.2 + 0.65 * v)
        if art in ('sfz', 'marc', 'short'):
            m = m + (1 - m) * 0.75 * np.exp(-t / 0.07)
    if harm:
        m = np.clip(m, 0, 1)
    nv = cfg['nv'] if art != 'short' else max(2, cfg['nv'] - 2)
    y = ensemble(tA, tB, hz(p), n, nv, 6.0, 5.4, 0 if art == 'short' else 13, 0.22, m, bend,
                 cfg['pan'], cfg['width'], env, trem=0.8 if trem else None,
                 stagger=0.012 if art in ('sus', 'swell') else 0.0)
    if art in ('sfz', 'marc', 'short') and not harm:     # bow bite
        k = int(0.02 * SR)
        b = NOISE['bite'][RNG.integers(0, 4)][:k] * np.exp(-tt(k) / 0.006)
        y[:k] += st(b * 0.25 * v, cfg['pan'])
    return y * cfg['gain'] * v ** 1.3


BRASS = {'hn': (240, 1700, 420, 0.25, 12), 'tpt': (450, 4500, 1350, 0.05, 22), 'tbn': (290, 2700, 560, 0.15, 18),
         'tuba': (130, 650, 240, 0.25, 10), 'shn': (220, 1050, 420, 0.25, 12)}


def brass_tables(kind, p, top=0.0):
    key = ('br', kind, p, round(top))
    if key not in _TAB:
        f0 = hz(p)
        K = kmax(f0 * 2 ** ((top + 0.5) / 12), 15000)
        k = np.arange(1, K + 1)
        f = k * f0
        fc0, fc1, form, tilt, _ = BRASS[kind]
        out = []
        for fc in (fc0, fc1):
            a = k ** -tilt * (1 + 0.9 * bell(f, form, .6)) / (1 + (f / fc) ** 2.4) / (1 + (f / 13000) ** 8)
            out.append(table_amps(a, np.full(K, np.pi / 2)))
        _TAB[key] = out
    return _TAB[key]


def r_brass(inst, p, dur, vel, art='sus', bend=None, **kw):
    cfg = INST[inst]
    v = vel / 127
    A = {'sus': .05, 'marc': .018, 'short': .006, 'sfz': .006, 'swell': dur * 0.9}[art]
    if inst == 'shn':
        A = 0.09
    R = {'sus': .2, 'marc': .16, 'short': .05, 'sfz': .32, 'swell': .2}[art]
    n = int((dur + R * 4 + 0.02) * SR)
    t = tt(n)
    env = envelope(n, dur, A, R, art, t)
    base = v ** 1.5
    if art == 'swell':
        m = base * np.clip(t / A, 0, 1) ** 1.3
    else:
        m = np.full(n, base)
        if art in ('sfz', 'marc', 'short'):
            m = m + (1 - m) * (0.85 if art == 'sfz' else 0.6) * np.exp(-t / 0.09)
        else:
            m = m * (0.6 + 0.4 * np.clip(t / 0.08, 0, 1))
    scoop = BRASS[inst][4] * (0.4 + 0.6 * v)
    bnd = list(bend) if bend else [(0, 0)]
    tA, tB = brass_tables(inst, p, max_bend(bend))
    vib = 9 if inst == 'shn' else 0
    y = ensemble(tA, tB, hz(p), n, cfg['nv'], 5.0, 5.0, vib, 0.3, np.clip(m, 0, 1), bnd,
                 cfg['pan'], cfg['width'], env, drift=2.0)
    # attack scoop: re-render would be costly; approximate by a short pitch-blip via amplitude/brightness
    if scoop and art != 'swell':
        k = int(0.03 * SR)
        y[:k] *= np.linspace(0.6, 1, k)[:, None]
    if inst in ('tbn', 'tuba') and v > 0.85 and art in ('sfz', 'marc', 'short'):
        y = np.tanh(1.8 * y) / 1.2      # low brass blat
    return y * cfg['gain'] * v ** 1.2


VOW = {'a': [(800, 1.0, 110), (1150, .55, 120), (2900, .22, 170), (3900, .1, 220)],
       'o': [(450, 1.0, 90), (800, .5, 100), (2830, .08, 160)],
       'u': [(325, 1.0, 80), (700, .22, 90), (2530, .04, 150)]}


def choir_tables(p, vowel):
    key = ('ch', p, vowel)
    if key not in _TAB:
        f0 = hz(p)
        K = kmax(f0 * 1.05, 9000)
        k = np.arange(1, K + 1)
        f = k * f0
        form = 0.012 + sum(A * np.exp(-0.5 * ((f - F) / (B + 0.04 * F)) ** 2) for F, A, B in VOW[vowel])
        rng = np.random.default_rng(p * 13)
        ph = rng.uniform(0, 2 * np.pi, K)
        out = [table_amps(form * k ** -0.9, ph), table_amps(form * k ** -0.2, ph)]
        _TAB[key] = out
    return _TAB[key]


def r_choir(inst, p, dur, vel, art='sus', vowel='a', breath=0.15, bend=None, **kw):
    cfg = INST[inst]
    v = vel / 127
    A = {'sus': .16, 'marc': .05, 'short': .03, 'sfz': .03, 'swell': dur * .9}[art]
    R = .4
    n = int((dur + R * 4 + 0.02) * SR)
    t = tt(n)
    env = envelope(n, dur, A, R, art if art != 'short' else 'marc', t)
    tA, tB = choir_tables(p, vowel)
    m = np.full(n, 0.25 + 0.7 * v) if art != 'swell' else (0.2 + 0.7 * v) * np.clip(t / A, 0, 1)
    y = ensemble(tA, tB, hz(p), n, cfg['nv'], 9.0, 5.3, 18, 0.2, m, bend, cfg['pan'], cfg['width'], env,
                 stagger=0.02)
    if breath:
        bn = NOISE['breath_' + vowel]
        i0 = RNG.integers(0, len(bn) - n - 1) if len(bn) > n + 1 else 0
        b = bn[i0:i0 + n]
        if len(b) < n:
            b = np.pad(b, ((0, n - len(b)), (0, 0)))
        y += b * env[:, None] * breath * 0.5
    return y * cfg['gain'] * v ** 1.3


def r_piano(inst, p, dur, vel, **kw):
    v = vel / 127
    f0 = hz(p)
    T = min(max(dur + 0.6, 1.0), 4.5)
    n = int(T * SR)
    t = tt(n)
    B = 0.00035 * (1 + max(0, p - 60) / 30)
    K = min(28, kmax(f0 * 1.2, 12000))
    tau0 = 3.2 * (261.0 / f0) ** 0.45
    rng = np.random.default_rng(int(p * 31 + vel))
    y = np.zeros(n)
    for k in range(1, K + 1):
        fk = k * f0 * np.sqrt(1 + B * k * k)
        a = k ** -1.15 * np.exp(-k / (3 + 9 * v)) * (1 + 0.5 * np.sin(np.pi * k * 0.13))
        tk = tau0 / (1 + 0.35 * k)
        e = 0.65 * np.exp(-t / (tk * 0.35)) + 0.35 * np.exp(-t / tk)
        for det in (-0.4, 0.0, 0.45):
            y += a / 3 * np.sin(2 * np.pi * (fk + det * k * 0.25) * t + rng.uniform(0, 6.28)) * e
    ham = ffilt(rng.standard_normal(int(0.03 * SR)) * np.exp(-tt(int(0.03 * SR)) / 0.004),
                lambda f: g_lp(f, 2500 + 3000 * v, 2), pad=2048)
    y[:len(ham)] += ham * 0.25 * v
    off = np.where(t < dur + 0.25, 1.0, np.exp(-(t - dur - 0.25) / 0.25))
    y *= off * ramp_env(n, 0.0015)
    return st(y, INST['piano']['pan']) * INST['piano']['gain'] * v ** 1.4


BELLS = {'celesta': [(1, 1, 1.1), (2, .07, .5), (3.98, .22, .22), (10.1, .05, .05)],
         'glock': [(1, 1, 1.4), (2.76, .35, .45), (5.4, .18, .2), (8.93, .08, .1)],
         'mbox': [(1, 1, .9), (3.9, .3, .25), (7.8, .1, .08)]}


def r_bell(inst, p, dur, vel, **kw):
    v = vel / 127
    f0 = hz(p)
    n = int(max(1.2, min(dur + 1.2, 3.0)) * SR)
    t = tt(n)
    rng = np.random.default_rng(int(p * 17 + vel))
    y = sines(t, [(f0 * r, a, d) for r, a, d in BELLS[inst]], rng)
    y += ffilt(rng.standard_normal(n) * np.exp(-t / 0.002), lambda f: g_hp(f, 3000, 2), pad=0) * 0.05
    y *= ramp_env(n, 0.001)
    return st(y, INST[inst]['pan']) * INST[inst]['gain'] * v ** 1.3


def r_pluck(inst, p, dur, vel, **kw):
    v = vel / 127
    f0 = hz(p)
    harp = inst == 'harp'
    n = int((2.2 if harp else 0.6) * SR)
    t = tt(n)
    K = min(20, kmax(f0, 9000))
    rng = np.random.default_rng(int(p * 7 + vel + harp))
    pos = 0.18 if harp else 0.3
    parts = []
    for k in range(1, K + 1):
        a = abs(np.sin(np.pi * k * pos)) / k ** 1.3 * np.exp(-k / (4 + 8 * v))
        d = (1.8 if harp else 0.32) * (220 / f0) ** 0.35 / (1 + 0.35 * k)
        parts.append((k * f0 * (1 + 0.0004 * k), a, d))
    y = sines(t, parts, rng)
    if not harp:
        y += sines(t, [(180, .3, .03), (420, .2, .02)], rng)   # body knock
    y *= ramp_env(n, 0.0008)
    return st(y, INST[inst]['pan']) * INST[inst]['gain'] * v ** 1.3


def _chip_wave(kind):
    x = (np.arange(L) + 0.5) / L
    if kind.startswith('sq'):
        d = {'sq12': .125, 'sq25': .25, 'sq50': .5}[kind]
        w = np.where(x < d, 1.0, -1.0)
    else:      # NES 4-bit triangle
        tri = 1 - 4 * np.abs(x - 0.5)
        w = np.round((tri + 1) * 7.5) / 7.5 - 1
    return w - w.mean()


def r_chip(inst, p, dur, vel, bend=None, arp=None, arp_rate=0.03, **kw):
    cfg = INST[inst]
    v = vel / 127
    n = int((dur + 0.04) * SR)
    t = tt(n)
    frames = np.floor(t * 60) / 60          # 60 Hz frame clock
    semis = bend_cents(frames, bend) / 100 if bend else np.zeros(n)
    if arp:
        semis = semis + np.array(arp)[(np.floor(t / arp_rate).astype(int)) % len(arp)]
    top = p + (np.max(semis) if np.ndim(semis) else 0) + 0.5
    key = ('chip', cfg['wave'], int(np.ceil(top)))
    if key not in _TAB:
        _TAB[key] = table_wave(_chip_wave(cfg['wave']), kmax(hz(top), 16000))
    f = hz(p) * 2 ** (semis / 12)
    y = osc2(_TAB[key], None, f)
    e = np.where(frames < dur, 1.0 - 0.35 * np.clip(frames / 0.2, 0, 1), 0.0)
    if cfg['wave'] != 'tri':
        e = np.floor(e * 15 * v + 0.5) / 15     # 4-bit volume
    else:
        e = e * v
    k = int(0.0015 * SR)
    e = np.convolve(e, np.ones(k) / k, mode='same')
    return st(y * e, cfg['pan'] + kw.get('pan', 0.0)) * cfg['gain'] * v ** 0.6


_LFSR = {}


def lfsr(short=False):
    if short in _LFSR:
        return _LFSR[short]
    reg, out = 1, []
    tap = 6 if short else 1
    for _ in range(93 if short else 32767):
        b = (reg & 1) ^ ((reg >> tap) & 1)
        reg = (reg >> 1) | (b << 14)
        out.append(1.0 if reg & 1 else -1.0)
    _LFSR[short] = np.array(out)
    return _LFSR[short]


def r_chipnz(inst, p, dur, vel, clock=18000.0, short=False, **kw):
    v = vel / 127
    n = int((dur + 0.01) * SR)
    t = tt(n)
    seq = lfsr(short)
    y = seq[(np.floor(t * clock).astype(int)) % len(seq)]
    frames = np.floor(t * 60) / 60
    e = np.floor(np.exp(-frames / max(dur * 0.4, 0.01)) * 15 * v + 0.5) / 15 * (t < dur)
    k = int(0.001 * SR)
    e = np.convolve(e, np.ones(k) / k, mode='same')
    return st(y * e, INST[inst]['pan'] + kw.get('pan', 0.0)) * INST[inst]['gain']


def r_cold(inst, p, dur, vel, **kw):
    """cold glass-harmonica note: two slightly beating sines + faint octave"""
    v = vel / 127
    f0 = hz(p)
    n = int((dur + 1.0) * SR)
    t = tt(n)
    e = np.clip(t / 0.25, 0, 1) * np.where(t < dur, 1, np.exp(-(t - dur) / 0.3))
    y = np.zeros((n, 2))
    y[:, 0] = np.sin(2 * np.pi * f0 * t) + 0.12 * np.sin(2 * np.pi * 2 * f0 * t + 1)
    y[:, 1] = np.sin(2 * np.pi * (f0 + 1.3) * t + .5) + 0.12 * np.sin(2 * np.pi * 2 * (f0 + 1.3) * t)
    return y * e[:, None] * INST[inst]['gain'] * v


RENDER_FAM = {'str': r_str, 'brass': r_brass, 'choir': r_choir, 'piano': r_piano, 'bell': r_bell,
              'pluck': r_pluck, 'chip': r_chip, 'chipnz': r_chipnz, 'cold': r_cold}


def render_note(inst, p, dur, vel, **kw):
    return RENDER_FAM[INST[inst]['fam']](inst, P(p), dur, vel, **kw)


# =========================================================================== noise banks / sample-like caches
NOISE = {}
CACHE = {}


def build_banks():
    rng = np.random.default_rng(77)
    NOISE['bite'] = [ffilt(rng.standard_normal(int(0.03 * SR)), lambda f: g_hp(f, 1800, 2) * g_lp(f, 7000, 2),
                           pad=2048) for _ in range(4)]
    for vw in VOW:
        x = rng.standard_normal((int(5 * SR), 2))
        G = lambda f, vw=vw: 0.02 + sum(A * np.exp(-0.5 * ((f - F) / (B * 2 + 0.06 * F)) ** 2)
                                        for F, A, B in VOW[vw]) * g_hp(f, 250, 2)
        y = ffilt(x, G)
        NOISE['breath_' + vw] = y / np.sqrt(np.mean(y ** 2)) * 0.3
    for k in range(4):     # crash cymbals
        CACHE[('crash', k)] = make_crash(np.random.default_rng(100 + k))
    CACHE['tamtam'] = make_tamtam(np.random.default_rng(9))


def make_crash(rng, dur=3.6):
    n = int(dur * SR)
    t = tt(n)
    x = rng.standard_normal((n, 2))
    x = ffilt(x, lambda f: g_hp(f, 450, 2) * g_bell(f, 5200, 5, .8) * g_lp(f, 15000, 2))
    env = np.exp(-t / 1.2) * (0.55 + 0.45 * np.exp(-t / 0.07))
    y = x * env[:, None]
    br = np.zeros((n, 2))
    for _ in range(50):
        f = rng.uniform(380, 3200)
        d = rng.uniform(0.3, 1.6)
        c = rng.integers(0, 2)
        br[:, c] += np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t / d) / np.sqrt(f / 400)
    y = y / np.sqrt(np.mean(y[:SR] ** 2)) * 0.25 + br * 0.012
    y *= np.clip(t / 0.0012, 0, 1)[:, None]
    return y


def make_tamtam(rng, dur=5.0):
    n = int(dur * SR)
    t = tt(n)
    y = np.zeros((n, 2))
    for _ in range(70):
        f = rng.uniform(70, 1400)
        d = rng.uniform(1.5, 4.0)
        y[:, rng.integers(0, 2)] += np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t / d) / (f / 100) ** .4
    sw = np.clip(t / 0.35, 0, 1) ** 1.5
    nz = ffilt(rng.standard_normal((n, 2)), lambda f: g_bell(f, 900, 0, 1) * g_lp(f, 4000, 2)) * np.exp(-t / 1.5)[:, None]
    y = (y / 12 + nz * 0.15) * sw[:, None]
    return y


# =========================================================================== percussion
def r_timp(p, vel=1.0, pan=-0.2, choke=None):
    f0 = hz(P(p))
    n = int(2.6 * SR)
    t = tt(n)
    rng = np.random.default_rng(int(f0))
    gl = 1 + 0.02 * np.exp(-t / 0.05)
    ph = 2 * np.pi * np.cumsum(f0 * gl) / SR
    y = np.zeros(n)
    sc = (110 / f0) ** 0.3
    for r, a, d in [(1, 1, 1.9), (1.504, .5, 1.0), (1.742, .36, .8), (2.0, .27, .65), (2.245, .18, .5),
                    (2.494, .13, .4), (2.8, .08, .3)]:
        y += a * (0.5 + 0.5 * vel) ** (r * 2) * np.sin(r * ph + rng.uniform(0, 6)) * np.exp(-t / (d * sc))
    m = int(0.02 * SR)
    y[:m] += ffilt(rng.standard_normal(m) * np.exp(-tt(m) / 0.003), lambda f: g_lp(f, 900, 2), pad=1024) * 0.9
    y *= np.clip(t / 0.0008, 0, 1)
    if choke:
        y *= np.exp(-t / choke)
    return st(y * 0.42 * vel ** 1.2, pan)


def r_taiko(size=1.0, big=True, pan=0.0):
    n = int(1.4 * SR)
    t = tt(n)
    rng = np.random.default_rng(int(size * 100) + big)
    f0 = 50 if big else 82
    f = f0 * (1 + 0.8 * np.exp(-t / 0.028))
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / (0.42 if big else 0.22)) + 0.35 * np.sin(1.58 * ph) * np.exp(-t / 0.1)
    m = int(0.08 * SR)
    sk = np.zeros((n, 2))
    sk[:m] = ffilt(rng.standard_normal((m, 2)) * np.exp(-tt(m) / 0.018)[:, None],
                   lambda f: g_bell(f, 300, 6, .8) * g_lp(f, 1500, 2), pad=2048) * 0.5
    y = st(body, pan) + sk
    y *= np.clip(t / 0.0006, 0, 1)[:, None]
    return y * 0.7 * size


def r_bd(size=1.0):
    n = int(1.2 * SR)
    t = tt(n)
    f = 44 + 30 * np.exp(-t / 0.04)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.55)
    y *= np.clip(t / 0.0008, 0, 1)
    return st(y * 0.6 * size)


def r_snare(vel=1.0, pan=0.1):
    n = int(0.4 * SR)
    t = tt(n)
    rng = np.random.default_rng(int(vel * 1000) % 97)
    nz = ffilt(rng.standard_normal(n), lambda f: g_hp(f, 1200, 2) * g_lp(f, 9000, 2), pad=2048) * np.exp(-t / 0.1)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.04) + 0.5 * np.sin(2 * np.pi * 330 * t) * np.exp(-t / 0.03)
    y = (nz * 0.6 + tone * 0.4) * np.clip(t / 0.0005, 0, 1)
    return st(y * 0.35 * vel, pan)


def r_crash(size=1.0, k=0):
    return CACHE[('crash', k % 4)] * size


def r_tamtam(size=1.0):
    return CACHE['tamtam'] * size


def r_rcym(dur, size=1.0, k=1):
    c = CACHE[('crash', k % 4)][::-1]
    m = int(dur * SR)
    y = c[-m:].copy() if m <= len(c) else np.pad(c, ((m - len(c), 0), (0, 0)))
    y *= np.linspace(0.2, 1, m)[:, None] ** 2
    y[-int(0.003 * SR):] *= np.linspace(1, 0, int(0.003 * SR))[:, None]
    return y * size * 1.2


_PULSE = {}


def r_pulse(p, dur, amp, bright=1.0):
    key = (P(p), round(dur, 3), round(amp, 2), round(bright, 2))
    if key in _PULSE:
        return _PULSE[key]
    f = hz(P(p))
    n = int((dur + 0.12) * SR)
    t = tt(n)
    y = np.zeros(n)
    K = int(min(40, 3500 / f))
    for k in range(1, K + 1):
        y += np.sin(2 * np.pi * f * k * t + 0.3 * k) / k * np.exp(-t * (6 + 9 * k ** 0.8 / bright))
    env = np.minimum(1, t / 0.003) * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.03))
    y = y * env * np.exp(-t * 2.5)
    y += 0.3 * np.sin(2 * np.pi * f * t) * env * np.exp(-t * 4)
    _PULSE[key] = st(y * amp * 0.3, 0.0)
    return _PULSE[key]


def r_braam(p, dur, size=1.0, attack=0.008):
    f = hz(P(p))
    n = int((dur + 0.9) * SR)
    t = tt(n)
    K = kmax(f * 3, 5000)
    saw = table_amps(1.0 / np.arange(1, K + 1))
    y = np.zeros((n, 2))
    for c, sgn in ((0, -1), (1, 1)):
        s = np.zeros(n)
        for mult, det, a in [(1, 0.0, 1.0), (1, 0.0045, 0.8), (2, -0.003, 0.5), (3, 0.002, 0.22)]:
            s += a * osc2(saw, None, np.full(n, f * mult * (1 + sgn * det)))
        s += 0.9 * np.sin(2 * np.pi * f * 0.5 * t) if f > 45 else 0.0
        op_ = np.minimum(1, (t) / (attack + 0.06))
        cut = 120 + 2400 * op_ * (0.3 + 0.7 * np.exp(-np.maximum(0, t - attack) / 0.55))
        y[:, c] = tvf(s, lambda tf, ff: 1 / np.sqrt(1 + (ff / np.interp(tf, t[::256], cut[::256])) ** 4))
    env = np.minimum(1, t / max(attack, 0.002)) ** 1.5
    env *= np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.35))
    env *= 0.7 + 0.3 * np.exp(-np.maximum(0, t - attack) / 0.5)
    y = np.tanh(1.8 * y * env[:, None])
    return y / (np.abs(y).max() + 1e-9) * 0.5 * size


# =========================================================================== hybrid layer + sound design
def s_boom(size=1.0, f_hi=62, f_lo=30, tau=None):
    n = int(3.0 * SR)
    t = tt(n)
    f = f_lo + (f_hi - f_lo) * np.exp(-t / 0.16)
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.minimum(1, t / 0.0012) * np.exp(-t / (tau or (0.42 + 0.45 * min(size, 1.6))))
    y = np.sin(ph) * env + 0.25 * np.sin(2 * ph) * env * np.exp(-t / 0.2)
    m = int(0.1 * SR)
    y[:m] += ffilt(RNG.standard_normal(m) * np.exp(-tt(m) / 0.008), lambda f: g_lp(f, 1600, 2), pad=2048) * 0.7
    y += np.sin(2 * np.pi * 88 * t) * np.exp(-t / 0.05) * np.minimum(1, t / 0.001) * 0.5
    return st(y * size * 0.8)


def s_punch(size=1.0):
    """tight kick: 120->48 Hz in 25 ms, 0.1 s decay + click: a sharp low attack that never smears"""
    n = int(0.5 * SR)
    t = tt(n)
    f = 48 + 72 * np.exp(-t / 0.025)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.1)
    m = int(0.01 * SR)
    y[:m] += RNG.standard_normal(m) * np.exp(-tt(m) / 0.0015) * 0.3
    y *= np.clip(t / 0.0004, 0, 1)
    return st(y * size * 0.8)


def s_subdrop(dur=1.2, size=1.0, f0=70, f1=26):
    n = int((dur + 0.3) * SR)
    t = tt(n)
    u = np.clip(t / dur, 0, 1)
    f = f0 * (f1 / f0) ** u
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.minimum(1, t / 0.004) * (1 - u) ** 0.6 * np.where(t < dur, 1, 0)
    y = (np.sin(ph) + 0.15 * np.sin(2 * ph)) * env
    return st(y * size * 0.75)


def s_impact(size=1.0, seed=None):
    rng = np.random.default_rng(seed)
    n = int(1.0 * SR)
    t = tt(n)
    f = 44 + 30 * np.exp(-t / 0.05)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22)
    m = int(0.12 * SR)
    pn = ffilt(rng.standard_normal(m) * np.exp(-tt(m) / 0.025), lambda f: g_lp(f, 1100, 2), pad=2048)
    cr = ffilt(rng.standard_normal(m) * np.exp(-tt(m) / 0.012), lambda f: g_bell(f, 1800, 0, 1) * g_hp(f, 700, 2)
               * g_lp(f, 4000, 2), pad=2048)
    y[:m] += pn * 0.8 + cr * 0.5
    y *= np.clip(t / 0.0006, 0, 1)
    return st(y * size * 0.8)


def s_whoosh(dur=0.3, size=1.0, pan0=-0.6, pan1=0.6, f0=300.0, f1=2600.0, seed=None):
    rng = np.random.default_rng(seed)
    n = int((dur + 0.12) * SR)
    t = tt(n)
    x = rng.standard_normal(n)

    def G(tf, f):
        u = np.clip(tf / dur, 0, 1)
        fc = f0 * (f1 / f0) ** (u ** 1.4)
        return bell(f, fc, 0.75)
    y = tvf(x, G, 512, 128)
    u = t / dur
    a = np.where(u < 1, np.clip(u, 0, 1) ** 2.4, np.exp(-(t - dur) / 0.04))
    y = y * a
    p = pan0 + (pan1 - pan0) * np.clip(u, 0, 1)
    l, r = panlr(p)
    out = np.stack([y * l, y * r], 1)
    return out / (np.abs(out).max() + 1e-9) * 0.5 * size


def s_whip(size=1.0, seed=None):
    rng = np.random.default_rng(seed)
    w = s_whoosh(0.11, 0.6 * size, -0.3, 0.3, 900, 5000, seed)
    n = len(w)
    k0 = int(0.11 * SR)
    m = int(0.02 * SR)
    c = ffilt(rng.standard_normal((m, 2)) * np.exp(-tt(m) / 0.0012)[:, None], lambda f: g_hp(f, 1200, 2), pad=1024)
    w[k0:k0 + m] += c * 1.4 * size
    return w      # lead 0.11


def s_glass_crack(size=1.0, seed=None):
    rng = np.random.default_rng(seed)
    n = int(1.3 * SR)
    t = tt(n)
    y = np.zeros((n, 2))
    m = int(0.012 * SR)
    y[:m] += rng.standard_normal((m, 2)) * np.exp(-tt(m) / 0.0018)[:, None] * 1.2
    tc, k = 0.004, 0
    while tc < 0.55 and k < 70:
        amp = 0.7 * np.exp(-tc / 0.2) * rng.uniform(.4, 1)
        Lc = int(rng.uniform(0.0004, 0.0016) * SR)
        i0 = int(tc * SR)
        cl = rng.standard_normal((Lc, 2)) * np.exp(-np.arange(Lc) / (Lc / 4))[:, None]
        y[i0:i0 + Lc] += cl * amp * rng.uniform(.3, 1, 2)
        tc += rng.exponential(0.011) * (1 + tc * 6)
        k += 1
    y = ffilt(y, lambda f: g_hp(f, 1700, 2) * g_bell(f, 4500, 4, 1.2))
    for _ in range(9):
        f = rng.uniform(2200, 9500)
        d = rng.uniform(0.04, 0.3)
        t0 = rng.uniform(0, 0.3)
        i0 = int(t0 * SR)
        ln = min(n - i0, int(d * 6 * SR))
        s = np.sin(2 * np.pi * f * tt(ln)) * np.exp(-tt(ln) / d) * rng.uniform(.05, .16)
        p = rng.uniform(-0.8, 0.8)
        y[i0:i0 + ln] += st(s, p)
    cm = int(0.08 * SR)
    cr = ffilt(rng.standard_normal(cm) * np.exp(-tt(cm) / 0.02), lambda f: g_bell(f, 1000, 0, 1) * g_hp(f, 450, 2)
               * g_lp(f, 2200, 2), pad=2048)
    y[:cm] += st(cr * 0.35)
    return y * size * 0.55


def s_glass_shatter(size=1.0, dur=1.8, density=1.0, spread=1.0, seed=None):
    rng = np.random.default_rng(seed)
    n = int((dur + 0.6) * SR)
    t = tt(n)
    y = np.zeros((n, 2))
    c = s_glass_crack(1.3, seed)
    y[:len(c)] += c[:n]
    nb = ffilt(rng.standard_normal((n, 2)), lambda f: g_hp(f, 1500, 2) * g_bell(f, 6500, 5, .8) * g_lp(f, 15000, 2))
    y += nb * (np.exp(-t / 0.11) * 0.55 + 0.1 * np.exp(-t / (0.35 * dur)))[:, None] * np.clip(t / 0.001, 0, 1)[:, None]
    N = int(280 * size * density)
    for j in range(N):
        t0 = rng.exponential(min(0.13, dur * 0.5)) if rng.random() < 0.6 else rng.uniform(min(0.2, dur * 0.5), dur)
        if t0 > dur:
            continue
        f1 = rng.uniform(1800, 10500)
        d = rng.uniform(0.008, 0.08)
        a = rng.uniform(0.08, 1) * np.exp(-t0 / (0.55 * dur)) * 0.22
        ln = int(d * 6 * SR)
        i0 = int(t0 * SR)
        ln = min(ln, n - i0)
        tl = tt(ln)
        s = sum(w * np.sin(2 * np.pi * f1 * r * tl + rng.uniform(0, 6)) for r, w in ((1, 1), (2.32, .5), (4.25, .25))
                if f1 * r < 21000) * np.exp(-tl / d)
        y[i0:i0 + ln] += st(s * a, rng.uniform(-1, 1) * spread)
    y[:, :] += st(np.sin(2 * np.pi * 68 * t) * np.exp(-t / 0.08) * 0.4 * np.clip(t / .001, 0, 1))
    return y * size * 0.7


def s_tinkles(dur=1.5, size=0.4, rate=14, seed=None, reverse=False):
    rng = np.random.default_rng(seed)
    n = int((dur + 0.4) * SR)
    y = np.zeros((n, 2))
    k = int(dur * rate)
    for _ in range(k):
        t0 = rng.uniform(0, dur)
        f1 = rng.uniform(2500, 9000)
        d = rng.uniform(0.02, 0.12)
        ln = int(d * 6 * SR)
        i0 = int(t0 * SR)
        ln = min(ln, n - i0)
        tl = tt(ln)
        s = (np.sin(2 * np.pi * f1 * tl) + 0.4 * np.sin(2 * np.pi * 2.32 * f1 * tl)) * np.exp(-tl / d)
        y[i0:i0 + ln] += st(s * rng.uniform(.2, 1), rng.uniform(-.9, .9))
    if reverse:
        y = y[::-1].copy()
    return y * size * 0.3


def bar_parts(f0, decays, amps=(1, .6, .35, .15)):
    return [(f0 * r, a, d) for r, a, d in zip((1, 2.756, 5.404, 8.933), amps, decays)]


def s_blade_light(size=1.0, seed=None, f0=None):
    rng = np.random.default_rng(seed)
    n = int(1.6 * SR)
    t = tt(n)
    f0 = f0 or rng.uniform(1150, 1380)
    y = np.zeros((n, 2))
    for f, a, d in bar_parts(f0, (.9, .55, .3, .16)):
        if f > 19000:
            continue
        for c, det in ((0, -0.8), (1, 0.8)):
            y[:, c] += a * np.sin(2 * np.pi * (f + det) * t + rng.uniform(0, 6)) * np.exp(-t / (d * size ** .3))
    for r in (2, 2.5, 3):
        ch = 0.5 + 0.5 * np.sin(2 * np.pi * 3.1 * t * r)
        y += st(np.sin(2 * np.pi * f0 * r * t) * np.exp(-t / 0.55) * 0.09 * ch, rng.uniform(-.6, .6))
    m = int(0.05 * SR)
    tr = ffilt(rng.standard_normal((m, 2)), lambda f: g_hp(f, 4000, 2)) * np.exp(-tt(m) / 0.004)[:, None]
    y[:m] += tr * 0.9
    y *= np.clip(t / 0.0005, 0, 1)[:, None]
    return y * size * 0.32


def s_blade_void(size=1.0, seed=None, lead=0.12):
    """void blade: ring-modulated low bar + growl + a sucked-in reverse breath before the strike (lead)"""
    rng = np.random.default_rng(seed)
    k0 = int(lead * SR)
    n = int(1.3 * SR)
    t = tt(n)
    f0 = rng.uniform(440, 520)
    y = np.zeros((n, 2))
    rm = np.sin(2 * np.pi * 61 * t)
    for f, a, d in bar_parts(f0, (.55, .32, .18, .1)):
        for c, det in ((0, -1.2), (1, 1.2)):
            y[:, c] += a * np.sin(2 * np.pi * (f + det) * t * (1 - 0.01 * t)) * rm * np.exp(-t / (d * size ** .3))
    K = 14
    saw = sum(np.sin(2 * np.pi * 73 * k * t) / k for k in range(1, K))
    y += st(saw * np.exp(-t / 0.13) * 0.5)
    m = int(0.04 * SR)
    y[:m] += ffilt(rng.standard_normal((m, 2)), lambda f: g_bell(f, 2500, 0, 1) * g_hp(f, 1200, 2)) * \
        np.exp(-tt(m) / 0.005)[:, None] * 0.7
    y = np.tanh(1.6 * y) * np.clip(t / 0.0005, 0, 1)[:, None]
    sk = s_whoosh(lead, 0.35, 0.5, -0.2, 6000, 600, seed)[:k0]
    out = np.zeros((k0 + n, 2))
    out[:len(sk)] += sk
    out[k0:] += y * size * 0.3
    return out


def s_clash(size=1.0, lead='light', seed=None):
    """blade on blade: both timbres + sparks + clang. returned with 0.12 s lead (the void blade's breath)"""
    rng = np.random.default_rng(seed)
    gl, gv = (1.0, 0.65) if lead == 'light' else (0.65, 1.0)
    v = s_blade_void(size * gv, seed)
    k0 = int(0.12 * SR)
    li = s_blade_light(size * gl, seed)
    out = v.copy()
    out[k0:k0 + len(li)] += li[:len(out) - k0]
    n = len(out) - k0
    t = tt(n)
    sp = np.zeros((n, 2))
    for _ in range(26):
        i0 = int(rng.exponential(0.025) * SR)
        if i0 >= n - 200:
            continue
        ln = int(rng.uniform(0.0003, 0.001) * SR)
        sp[i0:i0 + ln] += rng.standard_normal((ln, 2)) * rng.uniform(.2, .7)
    sp = ffilt(sp, lambda f: g_hp(f, 5000, 2))
    cl = sines(t, [(620, .5, .12), (943, .35, .09), (1490, .2, .06)], rng)
    out[k0:] += sp * 0.6 * size + st(cl * 0.3 * size)
    return out


def s_ignite(kind='zenith', size=1.0, seed=None):
    """power-up ignition. lead: zenith 0, nova/dawn 0.5 s (a reversed shimmer sucked into the hit)"""
    rng = np.random.default_rng(seed)
    lead = 0.0 if kind == 'zenith' else 0.5
    k0 = int(lead * SR)
    n = int(3.0 * SR)
    t = tt(n)
    x = rng.standard_normal(n)

    def G(tf, f):
        fc = np.where(tf < 0.12, 150 * (4000 / 150) ** np.clip(tf / 0.12, 0, 1),
                      1200 + 2800 * np.exp(-np.maximum(tf - 0.12, 0) / 0.6))
        return 1 / np.sqrt(1 + (f / fc) ** 4) * g_hp(f, 80, 2)
    fw = tvf(x, G) * (0.6 * np.exp(-t / 0.25) + 0.4 * np.exp(-t / 1.1)) * np.clip(t / 0.002, 0, 1)
    y = st(fw * 0.5)
    y[:, 1] = np.roll(y[:, 1], 240)
    wf = 45 + 50 * np.clip(t / 0.2, 0, 1)
    y += st(np.sin(2 * np.pi * np.cumsum(wf) / SR) * np.exp(-t / 0.45) * 0.55 * np.clip(t / .002, 0, 1))
    roots = {'zenith': 'D6', 'nova': 'D5', 'dawn': 'Eb6'}
    r0 = P(roots[kind])
    if kind in ('zenith', 'dawn'):
        sh = np.zeros(n)
        for iv in (0, 4, 7, 12, 16, 19):
            sh += np.sin(2 * np.pi * hz(r0 + iv) * t + rng.uniform(0, 6)) * (0.6 + 0.4 * np.sin(2 * np.pi * 11 * t + iv))
        sh *= np.exp(-t / 1.4) * 0.07
        y += st(sh, 0.0)
        for j in range(10):       # rising sparkle arpeggio
            tj = 0.035 * j
            i0 = int(tj * SR)
            ln = int(0.25 * SR)
            ff = hz(r0 + [0, 4, 7, 12, 16, 19, 24, 28, 31, 36][j])
            if ff > 18000:
                continue
            s = np.sin(2 * np.pi * ff * tt(ln)) * np.exp(-tt(ln) / 0.08) * 0.08
            y[i0:i0 + ln] += st(s, -0.7 + 0.14 * j)
    if kind in ('nova', 'dawn'):
        g = sum(np.sin(2 * np.pi * 36.7 * k * t) / k for k in range(1, 40)) * (0.7 + 0.3 * np.sin(2 * np.pi * 9 * t))
        g = np.tanh(1.5 * g) * np.exp(-t / 1.2) * 0.35 * np.clip(t / 0.003, 0, 1)
        y += st(ffilt(g, lambda f: g_lp(f, 1800, 2)))
        hs = ffilt(rng.standard_normal((n, 2)), lambda f: g_hp(f, 3000, 2)) * (np.exp(-t / 0.7) * 0.25)[:, None]
        y += hs
    cr = np.zeros((n, 2))
    for _ in range(int(180 * size)):
        i0 = int(rng.exponential(0.5) * SR)
        if i0 >= n - 100:
            continue
        cr[i0:i0 + 40] += rng.standard_normal((40, 2)) * rng.uniform(.1, .5)
    y += ffilt(cr, lambda f: g_hp(f, 2000, 2) * g_lp(f, 7000, 2)) * 0.5
    out = np.zeros((k0 + n, 2))
    out[k0:] = y
    if lead:
        rs = np.zeros(k0)
        tl = tt(k0)
        for iv in (0, 7, 12, 19, 24):
            rs += np.sin(2 * np.pi * hz(r0 + iv) * tl + iv)
        rs *= (tl / lead) ** 3 * 0.08
        out[:k0] += st(rs)
        out[:k0] += s_whoosh(lead - 0.12, 0.4, -0.5, 0.5, 6000, 500, seed)[:k0]
    return out * size


def s_riser(dur=1.0, size=1.0, seed=None):
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    t = tt(n)
    u = t / dur

    def G(tf, f):
        uu = np.clip(tf / dur, 0, 1)
        return bell(f, 250 * (9000 / 250) ** (uu ** 1.3), 0.6)
    y = np.stack([tvf(rng.standard_normal(n), G), tvf(rng.standard_normal(n), G)], 1)
    y = y / (np.abs(y).max() + 1e-9) * (u ** 2.2)[:, None] * 0.45
    tn = np.zeros(n)
    for b in (110, 220, 440):
        f = b * 4 ** (u ** 1.5)
        tn += np.sin(2 * np.pi * np.cumsum(f) / SR) * (1 if b < 400 else 0.5)
    y += st(tn * u ** 2 * 0.07)
    k = int(0.003 * SR)
    y[-k:] *= np.linspace(1, 0, k)[:, None]
    return y * size


def s_braam_sfx(p, dur, size=1.0):
    return r_braam(p, dur, size)


def s_breach(world, size=1.0, key='C', seed=None):
    rng = np.random.default_rng(seed)
    n = int(1.8 * SR)
    t = tt(n)
    y = np.zeros((n, 2))
    if world == 'ink':     # paper rip + a pure high ting + an ink drop
        m = int(0.4 * SR)
        g = (rng.random(m // 120 + 1) > 0.35).repeat(120)[:m].astype(float)
        g = np.convolve(g, np.ones(48) / 48, 'same')
        rip = ffilt(rng.standard_normal((m, 2)), lambda f: g_hp(f, 1000, 2) * g_lp(f, 6500, 2)) * \
            (g * np.exp(-tt(m) / 0.15))[:, None]
        y[:m] += rip * 0.6
        y += st(sines(t, [(2637, .3, 1.0), (5274, .06, .4)], rng), 0.3)
        y += st(np.sin(2 * np.pi * np.cumsum(180 * np.exp(-t / 0.08) + 70) / SR) * np.exp(-t / 0.1) * 0.4, -0.2)
    elif world == 'city':  # clockwork + glittering music box arpeggio (the lit windows)
        for j in range(10):
            i0 = int(j / 12 * SR)
            m = int(0.012 * SR)
            y[i0:i0 + m] += st(np.sin(2 * np.pi * 3100 * tt(m)) * np.exp(-tt(m) / 0.003) * 0.4, -0.4 + 0.08 * j)
        r = pc(key)
        for j, iv in enumerate([0, 7, 12, 15, 19, 24, 27, 31]):
            p = at(r, 5) + iv
            b = r_bell('mbox', p, 0.4, 90)
            i0 = int(0.05 * j * SR)
            ln = min(len(b), n - i0)
            y[i0:i0 + ln] += b[:ln] * 1.3
    elif world == 'sun':   # the dead black sun: dark fire roar + deep whoom
        sm = np.convolve(rng.standard_normal(n), np.ones(2400) / 49, 'same')
        roar = ffilt(rng.standard_normal((n, 2)), lambda f: g_lp(f, 420, 2) * g_hp(f, 40, 2))
        roar *= ((0.6 + 0.4 * np.tanh(sm)) * np.clip(t / 0.03, 0, 1) * np.exp(-t / 0.9))[:, None]
        y += roar * 1.2
        y += st(np.sin(2 * np.pi * 41 * t) * np.exp(-t / 0.6) * 0.5 * np.clip(t / .004, 0, 1))
    elif world == 'ocean':  # hanging ocean: water rush + bubbles + deep wave
        rush = ffilt(rng.standard_normal((n, 2)), lambda f: g_hp(f, 250, 2) * g_lp(f, 1800, 2))
        rush *= ((0.6 + 0.4 * np.sin(2 * np.pi * 2.2 * t)) * np.exp(-t / 0.6) * np.clip(t / 0.02, 0, 1))[:, None]
        y += rush * 0.8
        for _ in range(70):
            i0 = int(rng.uniform(0, 1.0) * SR)
            ln = int(rng.uniform(0.012, 0.03) * SR)
            f = rng.uniform(350, 1100) * (1 + 1.5 * tt(ln) / (ln / SR))
            b = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt(ln) / (ln / SR / 3)) * rng.uniform(.05, .2)
            y[i0:i0 + ln] += st(b, rng.uniform(-.8, .8))
        y += st(np.sin(2 * np.pi * 34 * t) * np.sin(np.pi * np.clip(t / 1.4, 0, 1)) * 0.4)
    return y * size


def s_lock(dur=1.0, size=1.0, seed=None, rise=0.0, cracks=0.0):
    """blades locked / grinding: two beating inharmonic rings + scrape with rough AM, crescendo; cracks"""
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    t = tt(n)
    u = t / dur
    y = np.zeros((n, 2))
    for f0, c in ((1210, 0), (1238, 1)):
        fr = f0 * 2 ** (rise * u / 12)
        ph = 2 * np.pi * np.cumsum(fr) / SR
        for r, a in ((1, 1), (2.756, .5), (5.404, .25)):
            y[:, c] += a * np.sin(r * ph)
    rough = 0.55 + 0.45 * np.sign(np.sin(2 * np.pi * 27 * t + 3 * np.sin(2 * np.pi * 3 * t)))
    rough = np.convolve(rough, np.ones(96) / 96, 'same')
    sc = ffilt(rng.standard_normal((n, 2)), lambda f: g_hp(f, 1800, 2) * g_lp(f, 7000, 2))
    y = y * 0.08 + sc * 0.25
    y *= (rough * (0.35 + 0.65 * u ** 1.5))[:, None]
    gr = np.sin(2 * np.pi * np.cumsum(70 + 10 * u) / SR) * rough * 0.25 * (0.4 + 0.6 * u)
    y += st(np.tanh(2 * gr))
    if cracks:
        k = int(cracks * 60)
        for _ in range(k):
            tc = dur * (1 - rng.random() ** 2)
            c = s_glass_crack(rng.uniform(.15, .45), int(rng.integers(1e6)))
            i0 = int(tc * SR)
            ln = min(len(c), n - i0)
            y[i0:i0 + ln] += c[:ln]
    y *= np.clip(t / 0.01, 0, 1)[:, None]
    k = int(0.004 * SR)
    y[-k:] *= np.linspace(1, 0, k)[:, None]
    return y * size


def s_world_cut(size=1.0, seed=None):
    rng = np.random.default_rng(seed)
    n = int(1.8 * SR)
    t = tt(n)
    m = int(0.1 * SR)
    y = np.zeros((n, 2))
    y[:m] += ffilt(rng.standard_normal((m, 2)), lambda f: g_hp(f, 2000, 2)) * np.exp(-tt(m) / 0.02)[:, None] * 0.9
    g = (rng.random(n // 300 + 1) > 0.4).repeat(300)[:n].astype(float)
    g = np.convolve(g, np.ones(96) / 96, 'same')
    rip = ffilt(rng.standard_normal((n, 2)), lambda f: g_lp(f, 900, 2) * g_hp(f, 160, 3))
    y += rip * (g * np.exp(-t / 0.5) * 0.9)[:, None]
    bv = s_blade_void(0.8, seed, lead=0.001)[:n]
    y[:len(bv)] += bv * 0.8
    return y * size


def s_moon(size=1.0, seed=None):
    rng = np.random.default_rng(seed)
    n = int(1.8 * SR)
    t = tt(n)
    y = np.zeros((n, 2))
    m = int(0.15 * SR)
    y[:m] += st(ffilt(rng.standard_normal(m) * np.exp(-tt(m) / 0.03), lambda f: g_lp(f, 600, 2), pad=2048) * 1.0)
    for _ in range(160):
        t0 = rng.exponential(0.35)
        if t0 > 1.4:
            continue
        ln = int(rng.uniform(0.02, 0.08) * SR)
        i0 = int(t0 * SR)
        ln = min(ln, n - i0)
        fc = rng.uniform(180, 1400)
        gr = rng.standard_normal(ln) * np.exp(-tt(ln) / (ln / SR / 4))
        gr = ffilt(gr, lambda f, fc=fc: bell(f, fc, .5), pad=512)
        y[i0:i0 + ln] += st(gr * rng.uniform(.2, 1) * np.exp(-t0 / .5), rng.uniform(-.9, .9))
    return y * size * 0.8


def s_wing(size=1.0, seed=None):
    rng = np.random.default_rng(seed)
    n = int(1.8 * SR)
    t = tt(n)
    y = s_blade_light(0.8, seed, f0=1600)[:n].copy()
    y = np.pad(y, ((0, n - len(y)), (0, 0)))

    def G(tf, f):
        fc = 5000 * (700 / 5000) ** np.clip(tf / 1.3, 0, 1)
        return bell(f, fc, 0.7)
    b = np.stack([tvf(rng.standard_normal(n), G), tvf(rng.standard_normal(n), G)], 1)
    b = b / (np.abs(b).max() + 1e-9) * (np.exp(-t / 0.7) * np.clip(t / 0.02, 0, 1))[:, None] * 0.5
    y += b
    f = 900 * (0.5 ** np.clip(t / 1.3, 0, 1))
    sp = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.5 + 0.5 * np.sin(2 * np.pi * 7 * t)) * np.exp(-t / 0.6) * 0.18
    l, r = panlr(np.clip(-0.2 + t, -1, 1))
    y += np.stack([sp * l, sp * r], 1)
    cr = np.zeros((n, 2))
    for _ in range(150):
        i0 = int(rng.exponential(0.4) * SR)
        if i0 < n - 50:
            cr[i0:i0 + 30] += rng.standard_normal((30, 2)) * rng.uniform(.1, .5)
    y += ffilt(cr, lambda f: g_hp(f, 2500, 2)) * 0.4
    return y * size


def s_pin(size=1.0, seed=None):
    rng = np.random.default_rng(seed)
    n = int(2.2 * SR)
    t = tt(n)
    y = st(sines(t, bar_parts(210, (1.1, .6, .3, .15)), rng) * 0.35)
    m = int(0.15 * SR)
    y[:m] += st(ffilt(rng.standard_normal(m) * np.exp(-tt(m) / 0.035), lambda f: g_hp(f, 300, 2) * g_lp(f, 2200, 2),
                      pad=2048) * 0.8)
    gro = np.sin(2 * np.pi * (110 * t + 0.6 * np.sin(2 * np.pi * 0.7 * t))) * np.exp(-t / 1.0) * 0.15
    y += st(gro, 0.2)
    y *= np.clip(t / 0.0005, 0, 1)[:, None]
    return y * size


def s_snap(size=1.0, seed=None):
    rng = np.random.default_rng(seed)
    n = int(1.6 * SR)
    t = tt(n)
    y = np.zeros((n, 2))
    m = int(0.015 * SR)
    y[:m] += ffilt(rng.standard_normal((m, 2)), lambda f: g_hp(f, 1500, 2)) * np.exp(-tt(m) / 0.002)[:, None] * 1.4
    wob = 1 + 0.004 * np.sin(2 * np.pi * 11 * t)
    for f, a, d in bar_parts(2600, (.5, .25, .12, .06)):
        if f < 19000:
            y += st(a * np.sin(2 * np.pi * f * np.cumsum(wob) / SR) * np.exp(-t / d) * 0.3, 0.1)
    fsp = 3000 * (0.6 ** np.clip(t / 0.9, 0, 1))
    sp = np.sin(2 * np.pi * np.cumsum(fsp) / SR) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * t)) * np.exp(-t / 0.4) * 0.12
    l, r = panlr(np.clip(t * 1.2, 0, 0.9))
    y += np.stack([sp * l, sp * r], 1)
    for tb, a in ((0.42, .5), (0.68, .3), (0.84, .18)):
        i0 = int(tb * SR)
        ln = int(0.25 * SR)
        y[i0:i0 + ln] += st(sines(tt(ln), [(4100, a, .05), (7300, a * .4, .03)], rng) * 0.25, 0.7)
    return y * size


def s_catch(size=1.0, seed=None):
    rng = np.random.default_rng(seed)
    n = int(1.2 * SR)
    t = tt(n)
    th = np.sin(2 * np.pi * np.cumsum(58 + 25 * np.exp(-t / 0.03)) / SR) * np.exp(-t / 0.18)
    m = int(0.05 * SR)
    sl = ffilt(rng.standard_normal(m) * np.exp(-tt(m) / 0.006), lambda f: g_hp(f, 400, 2) * g_lp(f, 3500, 2), pad=1024)
    y = st(th * 0.9)
    y[:m] += st(sl * 1.1)
    sh = sines(t, bar_parts(520, (.7, .4, .2, .1)), rng) * (0.5 + 0.5 * np.sin(2 * np.pi * 24 * t)) * 0.3
    y += st(np.tanh(2 * sh) * 0.5, -0.15)
    y *= np.clip(t / 0.0005, 0, 1)[:, None]
    return y * size


def s_horizon_draw(dur=1.0, size=1.0, seed=None):
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    t = tt(n)
    u = t / dur
    f0 = 520 * 3.0 ** (u ** 1.2)
    y = np.zeros((n, 2))
    for r, a in ((1, 1), (2.756, .45), (5.404, .2), (2, .3)):
        for c, det in ((0, -1.1), (1, 1.1)):
            y[:, c] += a * np.sin(2 * np.pi * np.cumsum(f0 * r + det) / SR)
    y *= (0.15 + 0.85 * u ** 1.6)[:, None] * 0.14
    m = int(0.35 * SR)

    def G(tf, f):
        return bell(f, 3000 + 6000 * np.clip(tf / 0.35, 0, 1), 0.5)
    sc = tvf(rng.standard_normal(m), G) * np.exp(-tt(m) / 0.15)
    y[:m] += st(sc / (np.abs(sc).max() + 1e-9) * 0.25)
    k = int(0.003 * SR)
    y[-k:] *= np.linspace(1, 0, k)[:, None]
    return y * size


def s_horizon_cut(size=1.0, seed=None):
    rng = np.random.default_rng(seed)
    n = int(0.6 * SR)
    t = tt(n)
    y = ffilt(rng.standard_normal((n, 2)), lambda f: g_hp(f, 2500, 2) * g_bell(f, 7000, 4, 1)) * \
        (np.exp(-t / 0.05) * 1.1)[:, None]
    y += st(sines(t, bar_parts(1660, (2, 1, .5, .25)), rng) * 0.3)
    g = s_glass_shatter(1.4, dur=0.12, density=1.6, seed=seed)
    y += g[:n] if len(g) >= n else np.pad(g, ((0, n - len(g)), (0, 0)))
    y *= np.clip(t / 0.0004, 0, 1)[:, None]
    return y * size


def s_ash(dur=3.5, size=1.0, seed=None):
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    t = tt(n)
    out = np.zeros((n, 2))
    for c in range(2):
        ph = rng.uniform(0, 6)

        def G(tf, f, ph=ph):
            fc = 800 * 2 ** (0.9 * np.sin(2 * np.pi * 0.23 * tf + ph))
            return bell(f, fc, 0.8)
        w = tvf(rng.standard_normal(n), G)
        sm = np.convolve(rng.standard_normal(n), np.ones(9600) / 98, 'same')
        out[:, c] = w * (0.45 + 0.55 * np.clip(0.5 + sm, 0, 1.4))
    out /= np.abs(out).max() + 1e-9
    gr = np.zeros((n, 2))
    for _ in range(int(dur * 40)):
        i0 = rng.integers(0, n - 60)
        gr[i0:i0 + 25] += rng.standard_normal((25, 2)) * rng.uniform(.05, .3)
    out = out * 0.35 + ffilt(gr, lambda f: g_hp(f, 2500, 2)) * 0.4
    e = np.clip(t / 0.9, 0, 1) * np.clip((dur - t) / 1.3, 0, 1)
    return out * e[:, None] * size


def s_orb(size=1.0, seed=None):
    rng = np.random.default_rng(seed)
    n = int(1.4 * SR)
    t = tt(n)
    f = rng.uniform(3000, 3600)
    y = sines(t, [(f, .5, .5), (f * 1.5, .3, .35), (f * 2.01, .2, .25)], rng)
    y *= np.clip(t / 0.002, 0, 1)
    return st(y * 0.08 * size, rng.uniform(-.4, .4))


def s_eyes(size=1.0, seed=None):
    rng = np.random.default_rng(seed)
    n = int(2.0 * SR)
    t = tt(n)
    mag = sines(t, [(hz(P('Ab6')) * r, a, d) for r, a, d in ((1, 1, 1.0), (2.76, .4, .4), (5.4, .2, .2))], rng)
    cri = sines(t, [(hz(P('D5')) * r, a, d) for r, a, d in ((1, 1, .9), (2.76, .4, .35))], rng) * \
        np.sin(2 * np.pi * 47 * t)
    y = st(mag * 0.12, 0.55) + st(cri * 0.14, -0.55)
    m = int(0.03 * SR)
    y[:m] += ffilt(rng.standard_normal((m, 2)), lambda f: g_hp(f, 5000, 2)) * np.exp(-tt(m) / 0.004)[:, None] * 0.4
    return y * size


def s_dark_stinger(size=1.0, seed=None, lead=0.3):
    rng = np.random.default_rng(seed)
    k0 = int(lead * SR)
    n = int(1.6 * SR)
    t = tt(n)
    tl = tt(k0)
    rb = sines(tl, [(hz(P('Ab6')), .5, .25), (hz(P('Ab6')) * 2.76, .2, .1)], rng)[::-1] * (tl / lead) ** 2
    y = np.zeros((k0 + n, 2))
    y[:k0] += st(rb * 0.12, 0.5)
    dum = (np.sin(2 * np.pi * 73.4 * t) + 0.35 * np.sin(2 * np.pi * 146.8 * t)) * np.exp(-t / 0.35)
    dum *= np.clip(t / 0.002, 0, 1)
    tick = sines(t, [(1661, .4, .08)], rng) * np.sin(2 * np.pi * 67 * t)
    y[k0:] += st(dum * 0.5 + tick * 0.15, -0.1)
    return y * size


SFX = {'boom': s_boom, 'punch': s_punch, 'subdrop': s_subdrop, 'impact': s_impact, 'whoosh': s_whoosh, 'whip': s_whip,
       'glass_crack': s_glass_crack, 'glass_shatter': s_glass_shatter, 'tinkles': s_tinkles,
       'blade_light': s_blade_light, 'blade_void': s_blade_void, 'clash': s_clash, 'ignite': s_ignite,
       'riser': s_riser, 'breach': s_breach, 'lock': s_lock, 'world_cut': s_world_cut, 'moon': s_moon,
       'wing': s_wing, 'pin': s_pin, 'snap': s_snap, 'catch': s_catch, 'horizon_draw': s_horizon_draw,
       'horizon_cut': s_horizon_cut, 'ash': s_ash, 'orb': s_orb, 'eyes': s_eyes, 'dark_stinger': s_dark_stinger,
       'braam': s_braam_sfx,
       'timp': r_timp, 'taiko': r_taiko, 'bd': r_bd, 'snare': r_snare, 'crash': r_crash, 'tamtam': r_tamtam,
       'rcym': r_rcym, 'pulse': r_pulse}

# =========================================================================== event list
EV = []          # (anchor time, start time, stem, kind, args, kwargs)
_SEED = [1000]
GCTX = [1.0]     # level context: beds/builds sit under the HITs
PRE_GAP = 0.012
PRE_GAP_KINDS = ('riser', 'rcym', 'rev', 'horizon_draw')


class level:
    def __init__(self, g):
        self.g = g

    def __enter__(self):
        GCTX.append(GCTX[-1] * self.g)

    def __exit__(self, *a):
        GCTX.pop()


def E(stem, t, kind, *a, lead=0.0, anchor=None, **kw):
    if kind in ('glass_crack', 'glass_shatter', 'clash', 'blade_light', 'blade_void', 'whoosh', 'whip', 'impact',
                'tinkles', 'ignite', 'riser', 'breach', 'lock', 'world_cut', 'moon', 'wing', 'pin', 'snap', 'catch',
                'horizon_draw', 'horizon_cut', 'ash', 'orb', 'eyes', 'dark_stinger') and 'seed' not in kw:
        _SEED[0] += 1
        kw['seed'] = _SEED[0]
    if GCTX[-1] != 1.0:
        kw['g'] = GCTX[-1]
    if kind in PRE_GAP_KINDS and lead > 0:
        t -= PRE_GAP          # builds stop 12 ms before the impact they lead into: the hit lands on a breath
    EV.append((t if anchor is None else anchor, t - lead, stem, kind, a, kw))


def n(inst, p, t, d, v, **kw):
    v = int(np.clip(round(v), 1, 127))
    E(INST[inst]['stem'], t, 'note', inst, p, d, v, **kw)


def ch(inst, ps, t, d, v, **kw):
    for p in dict.fromkeys(P(q) for q in ps):
        n(inst, p, t, d, v, **kw)


def perc(kind, t, *a, **kw):
    E('perc', t, kind, *a, **kw)


def sfx(kind, t, *a, lead=0.0, stem='sfx', **kw):
    E(stem, t, kind, *a, lead=lead, **kw)


def lim(p, top):
    p = P(p)
    while p > top:
        p -= 12
    return p


# =========================================================================== orchestral devices
def hit(*a, lev=0.82, **kw):
    """ordinary HITs sit 1.7 dB under the two climaxes (23.0 DAWNBREAK, 34.0 HORIZON CUT: lev=1)"""
    with level(lev):
        _hit(*a, **kw)


def _hit(t, root, q='m', size=1.0, hold=1.0, choir=True, braam=None, cym=True, tpt=True, extra=(), big=False,
         crash_k=0, strings=True, boom=1.0):
    """full impact: low brass sfz + strings + choir + timpani + taiko + gran cassa + cymbal + sub boom"""
    r, iv = tones(root, q)
    th = iv[1] if len(iv) > 2 else 7
    v = int(np.clip(92 + 30 * size, 1, 127))
    b1, b2, b3 = at(r, 1), at(r, 2), at(r, 3)
    if b1 < 28:
        b1 += 12
    n('tuba', b1, t, hold, v, art='sfz')
    ch('tbn', [b2, b2 + 7, b3, b3 + th], t, hold, v, art='sfz')
    ch('hn', [b3, b3 + 7, b3 + 12 + th, b3 + 12], t, hold, v, art='sfz')
    if tpt:
        ch('tpt', [lim(b3 + 12 + th, 82), lim(b3 + 19, 82), lim(b3 + 24, 84)], t, hold * 0.7, v, art='sfz')
    if strings:
        n('cb', b1 if b1 >= 28 else b1 + 12, t, hold + 0.3, v, art='sfz')
        ch('vc', [b2, b3, b3 + 7], t, hold + 0.3, v, art='sfz')
        ch('vla', [b3 + 12, b3 + 12 + th], t, hold + 0.3, v, art='sfz')
        ch('vln', [lim(b3 + 12 + th, 92), lim(b3 + 19, 93), lim(b3 + 24, 96), lim(b3 + 24 + th, 98)], t, hold + 0.3,
           v - 4, art='sfz')
    for p in extra:
        n('tbn', lim(p, 70), t, hold, v, art='sfz')
        n('hn', lim(P(p) + 12, 79), t, hold, v - 6, art='sfz')
        if choir:
            n('choir', lim(P(p) + 12, 79), t, hold + 0.4, v - 6, art='sfz')
    if choir:
        ch('choir', [b3, b3 + 7, b3 + 12 + th, b3 + 12], t, hold + 0.5, v - 4, art='sfz', vowel='a')
    tp = timp_pitch(r)
    perc('timp', t, tp, 1.0)
    perc('timp', t, tp - 12 if tp - 12 >= 36 else tp + 7, 0.7, 0.2)
    perc('taiko', t, 1.0 * min(size, 1.3), True, 0.0)
    perc('taiko', t, 0.7 * min(size, 1.3), False, 0.3)
    perc('bd', t, min(size, 1.4))
    if cym:
        perc('crash', t, 0.45 + 0.35 * min(size, 1.5), crash_k)
        if size >= 1.1:
            perc('crash', t, 0.4, crash_k + 1)
    sfx('boom', t, size * boom, 62, 30, 0.3 + 0.25 * min(size, 1.6), stem='sub')
    if big:
        sfx('boom', t, 0.5 * size * boom, 48, 26, 0.5, stem='sub')
        perc('taiko', t, 0.9, True, -0.4)
        perc('taiko', t, 0.9, True, 0.4)
    if braam is not None:
        sfx('braam', t, braam, hold + 0.3, 0.8 * size, stem='synth')


def stab(t, root, q, size, dur=0.24, high=True, cym=None, oct_=3, tight=False):
    r, iv = tones(root, q)
    b = at(r, oct_)
    v = int(np.clip(96 + 28 * size, 1, 127))
    ps = [b + i for i in iv if i < 12] + [b + 12]
    if high:
        ch('tpt', [lim(p + 12, 84) for p in ps[1:]], t, dur, v, art='short')
        ch('vln', [lim(p + 12, 96) for p in ps], t, dur, v - 6, art='short')
    ch('hn', ps, t, dur + 0.05, v, art='short')
    ch('tbn', [b - 12, b - 12 + 7, b], t, dur + 0.05, v, art='short')
    n('tuba', b - 24 if b - 24 >= 28 else b - 12, t, dur + 0.1, v, art='short')
    n('cb', b - 24 if b - 24 >= 28 else b - 12, t, dur + 0.1, v, art='short')
    ch('vc', [b - 12, b], t, dur, v, art='short')
    perc('taiko', t, 0.9 * min(1.0, 0.5 + size * 0.6), not tight, 0.0)
    perc('taiko', t, 0.55, False, -0.3)
    perc('timp', t, timp_pitch(r), 0.6 + 0.4 * min(size, 1), -0.2, 0.18 if tight else 0.4)
    sfx('punch', t, 0.6 + 0.5 * size, stem='sub')
    if cym is not None:
        perc('crash', t, cym, 2)
    if not tight:
        sfx('boom', t, 0.6 * size, 66, 40, 0.16, stem='sub')


def pulse(t, p, dur, amp, bright=1.0):
    E('synth', t, 'pulse', P(p), dur, round(amp, 2), bright)


THEME = [(0, .5, 0), (.5, 1.0, 7), (1.5, .25, 9), (1.75, .25, 7), (2.0, 1.5, 12), (3.5, .25, 11), (3.75, .25, 9),
         (4.0, .5, 5), (4.5, .75, 9), (5.25, .25, 14), (5.5, .5, 12), (6.0, .5, 11), (6.5, .25, 12),
         (6.75, 1.25, 14), (8.0, .5, 12), (8.5, 1.5, 19), (10.0, .75, 17), (10.75, .25, 16), (11.0, .5, 14),
         (11.5, .5, 11)]


def theme(*a, lev=0.8, **kw):
    with level(lev):
        _theme(*a, **kw)


def _theme(tonic, t0, k, i0, i1, layers, vel, legato=0.95, art='marc', invert=False, times=None):
    T0 = THEME[i0][0]
    for i in range(i0, i1):
        u, d, deg = THEME[i]
        if invert:
            deg = -deg
        t = t0 + (u - T0) * k if times is None else times[i - i0]
        dur = d * k * legato
        if times is not None and i - i0 + 1 < len(times):
            dur = min(dur, (times[i - i0 + 1] - t) * legato) if i + 1 < i1 else dur
        m = P(tonic) + deg
        for inst, sh, dv, *lo in layers:
            p = m + sh
            if lo and p < lo[0]:
                p += 12
            n(inst, p, t, dur, vel + dv + (6 if d >= 0.5 else 0), art=art)


def _ostinato(t0, t1, root, q='5', amp=1.0, amp1=None, duck=(), chip=True, vln=True, taiko=True, b2=False,
             hats=True, strings=True):
    """150 bpm action ostinato (16th = 0.1 s), 3+3+2 accents: synth pulse, celli/basses spiccato, pizz,
    violins, chip arpeggio + LFSR hats, taiko, timpani.  b2: Phrygian flat-2 (the Sunderer's Eb)."""
    r, iv = tones(root, q)
    third = iv[1] if len(iv) > 2 else 7
    acc = {0, 3, 6, 8, 11, 14}
    nst = int(round((t1 - t0) / 0.1))
    for k in range(nst):
        t = round(t0 + k * 0.1, 4)
        x = k / max(1, nst - 1)
        a_ = amp + ((amp1 if amp1 is not None else amp) - amp) * x
        i = k % 16
        a = i in acc
        if any(-0.2 < t - s < 0.12 for s in duck):
            continue
        m = min(1.25, a_)
        flat2 = 1 if (b2 and i == 14) else 0
        pulse(t, at(r, 1) + (12 if i in (6, 14) else 0) + flat2, 0.15, (0.9 if a else 0.42) * m, 1.0 if a else 0.6)
        if strings:
            if a:
                n('vc', at(r, 2) + flat2, t, .14, 96 * m + 8, art='short')
                n('cb', at(r, 1) if at(r, 1) >= 28 else at(r, 2), t, .16, 100 * m, art='short')
                n('pizz', at(r, 3), t, .2, 88 * m)
            else:
                n('vc', at(r, 2), t, .1, 64 * m, art='short')
            if vln and i % 2 == 0:
                hi = at(r, 5) + [0, 7, third, 7][(i // 2) % 4]
                n('vln', lim(hi, 91), t, .1, 74 * m + 8, art='short')
        if chip:
            ap = at(r, 5) + [0, 7, 12, third + 12, 12, 7, third, 7][i % 8]
            n('chip12', ap, t, .08, 62 * m)
        if hats:
            n('chipnz', 0, t, .04, (72 if i % 2 else 48) * m, clock=24000.0)
        if taiko and i in (0, 6, 8, 14):
            perc('taiko', t, (0.75 if i == 0 else 0.55) * m, i in (0, 8), 0.0)
        if taiko and i in (10, 12, 13):
            perc('taiko', t, 0.35 * m, False, 0.4)
        if i in (0, 8):
            perc('timp', t, timp_pitch(r), 0.6 * m, -0.2, 0.3)


def ostinato(*a, **kw):
    with level(0.55):
        _ostinato(*a, **kw)


def roll(kind, t0, t1, a0, a1, rate=18.0, p=None):
    with level(0.7):
        _roll(kind, t0, t1, a0, a1, rate, p)


def _roll(kind, t0, t1, a0, a1, rate=18.0, p=None):
    k = int((t1 - t0) * rate)
    for j in range(k):
        t = t0 + j / rate
        if t > t1 - 0.08:
            break
        a = a0 + (a1 - a0) * (j / max(1, k - 1)) ** 1.5
        if kind == 'snare':
            perc('snare', t, a, 0.1 + 0.1 * (j % 2))
        else:
            perc('timp', t, p, a, -0.2 + 0.08 * (j % 2))


def run(inst, scale_root, mode, p0, p1, t0, dur, v0, v1, art='short'):
    """scale run from p0 to p1 (midi), evenly spaced"""
    r = pc(scale_root)
    steps = [p for p in range(P(p0), P(p1) + 1) if (p - r) % 12 in mode]
    k = len(steps)
    for j, p in enumerate(steps):
        t = t0 + dur * j / k
        n(inst, p, t, dur / k * 1.3, v0 + (v1 - v0) * j / max(1, k - 1), art=art)


MAJ = {0, 2, 4, 5, 7, 9, 11}
MIN = {0, 2, 3, 5, 7, 8, 10}


def revchord(t_end, inst, ps, dur, vel, **kw):
    """reversed swell: an sfz chord rendered, reversed, ending exactly at t_end"""
    E(INST[inst]['stem'], t_end, 'rev', inst, [P(p) for p in ps], dur, vel, lead=dur, kw=kw)


# =========================================================================== THE SCORE
def act1():
    """the shadow stands up (0-7.5): D minor; pulse + reversed swell from frame 0; the twisted motifs"""
    sfx('boom', 0.0, 0.55, stem='sub')
    perc('taiko', 0.0, 0.7, True, 0.0)
    perc('timp', 0.0, 'D2', 0.8)
    for k in range(15):                       # the low pulse (8ths)
        t = k * 0.2
        a = 0.55 + 0.4 * k / 14
        pulse(t, 'D1' if k % 2 == 0 else 'D2', 0.17, a * (1 if k % 2 == 0 else .55), 0.7 + 0.3 * k / 14)
    for t in (0.8, 2.4):
        perc('taiko', t, 0.45, True, 0.0)
    n('cb', 'D2', 0.0, 3.0, 78)
    n('vc', 'D2', 0.0, 3.0, 70)
    n('vc', 'A2', 0.0, 1.55, 60)
    perc('rcym', 1.6, 1.6, 0.55, 1, lead=1.6)
    revchord(1.6, 'choir', ['D4', 'A4', 'Eb5', 'Ab4'], 1.6, 92, vowel='o')
    revchord(1.6, 'vln', ['D5', 'Eb5', 'A5'], 1.6, 96)
    # the Hollow motif: Unmaker's D-Eb-D-Ab on top (whispered), Sunderer's falling ninth under it
    top = [('D5', 0.0, .58), ('Eb5', 0.6, .19), ('D5', 0.8, .38), ('Ab4', 1.2, .4)]
    for p, t, d in top:
        n('celesta', p, t, d, 84)
        n('choir', P(p) - 12, t, d + 0.05, 70, vowel='u', breath=1.2)
        n('chip12', P(p) + 12, t, min(d, .2), 54)
    n('vc', 'Eb3', 0.6, 0.19, 84, art='marc')
    n('tbn', 'Eb3', 0.6, 0.19, 70, art='marc')
    for t in (0.8, 1.0, 1.2):
        n('cb', 'D2', t, 0.16, 92, art='short')
        n('tbn', 'D2', t, 0.16, 74, art='short')
    # 1.6 stinger: the eyes open (magenta, crimson)
    ch('tbn', ['D3', 'Ab3'], 1.6, 0.5, 108, art='sfz')
    ch('hn', ['Eb4', 'Ab4'], 1.6, 0.5, 104, art='sfz')
    n('tuba', 'D2', 1.6, 0.5, 104, art='sfz')
    n('cb', 'D2', 1.6, 1.4, 96, art='sfz')
    perc('taiko', 1.6, 0.85, True, 0.0)
    perc('timp', 1.6, 'D2', 0.9)
    sfx('boom', 1.6, 0.6, stem='sub')
    sfx('eyes', 1.6, 1.0)
    ch('vln', ['D5', 'Eb5'], 1.62, 1.36, 70, art='swell', trem=True)
    ch('vla', ['Ab4'], 1.62, 1.36, 66, art='swell', trem=True)
    # 1.6-3.0: twisted motif again, an octave lower, louder, in canon
    top2 = [('D4', 1.6, .58), ('Eb4', 2.2, .19), ('D4', 2.4, .38), ('Ab3', 2.8, .2)]
    for p, t, d in top2:
        n('hn', p, t, d, 78 if t >= 2.0 else 84, art='marc')
        n('celesta', P(p) + 12, t, d, 70)
        n('chip12', P(p) + 24, t, min(d, .18), 50)
    n('vc', 'Eb3', 2.2, 0.19, 92, art='marc')
    for t in (2.4, 2.6, 2.8):
        n('cb', 'D2', t, 0.16, 100, art='short')
        n('tbn', 'D2', t, 0.16, 86, art='short')
    for k in range(7):
        pulse(1.6 + k * 0.2, 'D1', 0.15, 0.7 + 0.04 * k)
    roll('snare', 2.6, 2.98, 0.2, 0.7)
    sfx('riser', 3.0, 0.75, 0.8, lead=0.75)
    perc('rcym', 3.0, 0.9, 0.9, 2, lead=0.9)
    sfx('whoosh', 3.0, 0.3, 0.9, 0.7, -0.2, lead=0.3)
    # 3.0 HIT: the void blade through the hero; the sky cracks
    hit(3.0, 'D', 'mb9', 1.0, hold=0.55, braam='D1')
    sfx('blade_void', 3.0, 1.3, lead=0.12)
    sfx('glass_crack', 3.0, 1.3)
    sfx('impact', 3.0, 0.8)
    # the blitz: four rising stabs, each from a different side, each cracking the sky further
    ostinato(3.2, 5.3, 'D', '5', amp=0.8, amp1=1.05, duck=[3.6, 4.0, 4.4, 4.8], chip=True)
    for t, rt, s, pn in [(3.6, 'D', .62, -.7), (4.0, 'Eb', .7, .7), (4.4, 'E', .8, -.4), (4.8, 'F', .92, .5)]:
        stab(t, rt, 'm', s, cym=0.3 + 0.2 * s)
        sfx('whoosh', t, 0.26, 0.5 + 0.3 * s, -pn, pn * 0.3, lead=0.26)
        sfx('blade_void', t, 0.6 + 0.4 * s, lead=0.12)
        sfx('glass_crack', t, 0.55 + 0.4 * s)
    roll('snare', 4.95, 5.38, 0.4, 1.0, rate=22)
    sfx('riser', 5.4, 0.8, 0.8, lead=0.8)
    perc('rcym', 5.4, 0.9, 1.0, 3, lead=0.9)
    sfx('whoosh', 5.4, 0.36, 1.1, 0.0, 0.0, 200, 1800, lead=0.36)
    # 5.4 HIT: the slam through the cloud floor: glass shatters, plunging glissando
    hit(5.4, 'D', 'm', 1.05, hold=0.45, braam='D1', big=True, crash_k=1)
    sfx('glass_shatter', 5.4, 1.35, 2.2)
    sfx('impact', 5.4, 1.1)
    sfx('subdrop', 5.4, 1.4, 1.0, stem='sub')
    ch('vln', ['D6', 'A5'], 5.45, 0.95, 104, art='marc', bend=[(0, 0), (0.05, 0), (0.95, -24)])
    ch('vla', ['D5', 'F5'], 5.45, 0.95, 100, art='marc', bend=[(0, 0), (0.05, 0), (0.95, -24)])
    n('tbn', 'D4', 5.45, 0.8, 110, art='marc', bend=[(0, 0), (0.1, 0), (0.8, -19)])
    n('hn', 'A4', 5.45, 0.8, 104, art='marc', bend=[(0, 0), (0.1, 0), (0.8, -19)])
    n('chip25', 'D7', 5.45, 0.95, 92, bend=[(0, 0), (0.95, -40)])
    # tumbling among the shards
    for j, p in enumerate(['D7', 'A6', 'F6', 'D6', 'A5', 'F5', 'D5', 'A4', 'F4', 'D4', 'A3', 'F3']):
        n('harp', p, 5.6 + j * 0.045, 0.5, 92 - 3 * j)
    rng = np.random.default_rng(11)
    for j in range(9):
        p = 86 - j * 2 - int(rng.integers(0, 3))
        n('celesta', p, 5.85 + j * 0.11 + rng.uniform(-.02, .02), 0.3, 70 - 3 * j)
    sfx('tinkles', 5.8, 1.3, 0.6, 10)
    n('cb', 'D2', 5.9, 1.0, 64)
    n('tuba', 'D2', 5.9, 1.0, 56)
    ch('vc', ['D3', 'Eb3'], 5.9, 0.9, 58, trem=True)
    # held breath 6.8-7.5
    n('vln', 'A5', 6.85, 0.6, 46, harm=True)
    sfx('riser', 7.5, 0.7, 0.9, lead=0.7)
    perc('rcym', 7.5, 0.8, 1.0, 0, lead=0.8)
    for j in range(8):          # chip power-up arpeggio into the ignition
        n('chip25', P('D5') + [0, 4, 7, 12, 16, 19, 24, 28][j], 7.1 + j * 0.05, 0.05, 70 + 4 * j)


LAY_DEFIANT = [('tpt', 0, 0), ('hn', 0, -4), ('hn', -12, -8), ('vln', 12, -4), ('vln', 0, -8), ('chip25', 24, -34)]


def act2():
    """the duel through the worlds (7.5-14)"""
    hit(7.5, 'D', 'M', 1.0, hold=0.45, braam=None, crash_k=2)
    sfx('ignite', 7.5, 'zenith', 1.0)
    theme('D4', 7.5, 0.4, 0, 5, LAY_DEFIANT, 116)          # one defiant bar: D A B A D'
    ch('choir', ['D4', 'F#4', 'A4'], 7.5, 1.5, 96, vowel='a')
    n('cb', 'D2', 7.5, 1.6, 90)
    ostinato(7.9, 10.6, 'D', '5', amp=0.85, amp1=1.1, duck=[8.2, 8.8, 9.3, 9.7, 10.0])
    clashes = [(8.2, 'D', '5', .55, 'light', .24), (8.8, 'F', 'M', .62, 'void', .24), (9.3, 'G', 'm', .68, 'light', .22),
               (9.7, 'Ab', 'M', .74, 'void', .2), (10.0, 'A', 'M', .82, 'light', .17)]
    for j, (t, rt, q, s, who, wl) in enumerate(clashes):
        stab(t, rt, q, s, dur=0.2, high=t > 9.0, cym=0.25 if j % 2 else None, tight=t > 9.2)
        sfx('whoosh', t, wl, 0.55 + 0.3 * s, -0.7 if j % 2 else 0.7, 0.0, lead=wl)
        sfx('clash', t, 0.75 + 0.35 * s, who, lead=0.12)
    ch('hn', ['D4', 'A4'], 9.1, 0.9, 92, art='swell')
    roll('snare', 10.15, 10.58, 0.4, 1.0, rate=22)
    sfx('riser', 10.6, 0.8, 0.8, lead=0.8)
    perc('rcym', 10.6, 0.8, 0.9, 3, lead=0.8)
    # 10.6 HIT: blade lock; every shard shatters; strings strain to 11.6
    hit(10.6, 'Bb', 'M', 1.05, hold=0.9, braam='Bb1', crash_k=0, lev=0.75)
    sfx('glass_shatter', 10.6, 1.15, 1.6)
    sfx('clash', 10.6, 1.2, 'light', lead=0.12)
    sfx('lock', 10.6, 0.98, 0.9)
    with level(0.75):
        ch('vln', ['Bb5', 'F6'], 10.75, 0.83, 96, trem=True, bend=[(0, 0), (0.83, 8)])
        ch('vla', ['D5'], 10.75, 0.83, 92, trem=True, bend=[(0, 0), (0.83, 8)])
        ch('vc', ['Bb2', 'F3'], 10.75, 0.83, 96, trem=True, bend=[(0, 0), (0.83, 4)])
        ch('hn', ['Bb3', 'C4', 'F4'], 10.8, 0.78, 104, art='swell')
        roll('timp', 10.8, 11.56, 0.3, 0.95, p='Bb2')
    for t, rt, world, wk in [(11.6, 'F#', 'ink', 'F#'), (12.6, 'C', 'city', 'C'), (13.4, 'Ab', 'sun', 'Ab')]:
        stab(t, rt, 'm', 0.9, dur=0.32, cym=0.5)
        sfx('whip', t, 1.0, lead=0.11)
        sfx('breach', t, world, 1.0, wk)
        sfx('glass_shatter', t, 0.55, 0.9, 0.6)
    # world 1: ink void (F#m): dry, sparse - pizz and chip only, one high harmonic
    for k in range(9):
        t = 11.75 + k * 0.1
        if k % 3 == 0:
            n('pizz', 'F#3', t, 0.2, 96)
            pulse(t, 'F#1', 0.15, 0.7)
        n('chip50', P('F#5') + [0, 7, 12, 9][k % 4], t, 0.06, 58)
    n('vln', 'C#7', 11.7, 0.8, 52, harm=True)
    # world 2: the staircase city (Cm): full ostinato, music-box windows
    ostinato(12.75, 13.35, 'C', 'm', amp=1.0, duck=[13.4])
    for j in range(6):
        n('glock', P('C6') + [0, 3, 7, 12, 15, 19][j], 12.8 + j * 0.09, 0.2, 70)
    # world 3: the dead black sun (Abm): low choir, tam-tam, tuba
    ch('choir', ['Ab2', 'Eb3', 'Ab3'], 13.45, 0.52, 100, vowel='o', art='swell')
    n('tuba', 'Ab1', 13.45, 0.52, 104, art='swell')
    perc('tamtam', 13.4, 0.8)
    roll('timp', 13.5, 13.97, 0.3, 0.9, p='D2')
    sfx('riser', 14.0, 0.55, 0.9, lead=0.55)
    perc('rcym', 14.0, 0.6, 1.0, 1, lead=0.6)


INV_TIMES = [14.0, 14.25, 14.75, 14.875, 15.0, 15.4, 15.6, 15.8, 16.0, 16.2, 16.6, 16.8, 17.0, 17.2, 17.4]


def act3():
    """everything you spent (14-23): the Hollow's NOVA, the inverted hero theme, the pin, the low point"""
    hit(14.0, 'D', 'mb9', 1.1, hold=0.9, braam='D1', tpt=False, crash_k=2)
    sfx('ignite', 14.0, 'nova', 1.0, lead=0.5)
    # the hero theme INVERTED in low brass (D Phrygian falls out of the mirror), dragged through the HITs
    lay = [('tbn', 0, 0), ('tuba', -12, 0, 28), ('hn', 12, -6), ('cb', -12, -4, 28), ('vc', 0, -6)]
    theme('D3', 14.0, 0.5, 0, 15, lay, 112, times=INV_TIMES, art='marc', invert=True, lev=0.7)
    ostinato(14.3, 18.3, 'D', '5', amp=0.9, amp1=1.1, b2=True, chip=False,
             duck=[15.0, 16.2, 17.4, 18.4])
    for t, rt, q, kind, s in [(15.0, 'D', 'm', 'world_cut', 1.0), (16.2, 'C', 'm', 'moon', 0.95),
                              (17.4, 'Eb', 'M', 'wing', 0.92)]:
        hit(t, rt, q, s, hold=0.7, braam=None, crash_k=int(t))
        sfx('whoosh', t, 0.36, 1.0, 0.6, -0.6, 250, 2200, lead=0.36)
        sfx(kind, t, 1.0)
        sfx('impact', t, 0.9)
    sfx('subdrop', 15.0, 1.0, 0.9, stem='sub')
    sfx('clash', 16.2, 1.0, 'void', lead=0.12)
    # the Sunderer's falling ninth into the pin
    ch('hn', ['Eb4'], 17.8, 0.55, 100, art='marc')
    ch('tbn', ['Eb3'], 17.8, 0.55, 100, art='marc')
    roll('snare', 17.9, 18.38, 0.4, 1.0, rate=22)
    perc('rcym', 18.4, 0.7, 0.9, 0, lead=0.7)
    sfx('whoosh', 18.4, 0.4, 1.0, -0.5, 0.2, 200, 2000, lead=0.4)
    hit(18.4, 'D', 'mb9', 1.15, hold=0.6, braam='D1', big=True, crash_k=1)
    sfx('pin', 18.4, 1.0)
    sfx('impact', 18.4, 1.1)
    sfx('subdrop', 18.4, 1.3, 0.9, stem='sub')
    # collapse to near silence
    ch('vln', ['D5', 'A5'], 18.6, 0.6, 62, bend=[(0, 0), (0.6, -12)])
    n('vc', 'D3', 18.6, 0.6, 56, bend=[(0, 0), (0.6, -5)])
    # 19.2 a cold held note
    n('cold', 'Ab5', 19.2, 0.95, 56)
    n('vln', 'Ab5', 19.25, 0.95, 40, harm=True)
    n('cb', 'D2', 19.2, 2.6, 34)
    # 20.0-23.0: the four orb sparks, one piano note each (1-5-6-5 of the hero theme in Eb)
    for t, p in [(20.4, 'Eb5'), (20.9, 'Bb5'), (21.4, 'C6'), (21.9, 'Bb5')]:
        n('piano', p, t, 1.4, 52)
        n('piano', P(p) - 24, t, 1.4, 28)
        sfx('orb', t, 1.0)
    # 22.0 rising tremolo into DAWNBREAK
    with level(0.6):
        ch('vln', ['Bb4', 'F5'], 22.0, 0.97, 96, art='swell', trem=True, bend=[(0, 0), (0.5, 0), (0.97, 5)])
        ch('vla', ['D4'], 22.0, 0.97, 92, art='swell', trem=True, bend=[(0, 0), (0.5, 0), (0.97, 5)])
        ch('vc', ['Bb2', 'F3'], 22.0, 0.97, 96, art='swell', trem=True)
        n('cb', 'Bb1', 22.2, 0.77, 96, art='swell')
        ch('choir', ['Bb3', 'F4', 'Bb4'], 22.25, 0.72, 104, art='swell', vowel='a')
        ch('hn', ['Bb3', 'F4'], 22.4, 0.57, 100, art='swell')
        roll('timp', 22.3, 22.97, 0.15, 0.9, p='Bb2')
        roll('snare', 22.55, 22.97, 0.2, 0.9, rate=22)
        sfx('riser', 23.0, 1.0, 0.7, lead=1.0)
        perc('rcym', 23.0, 1.1, 0.8, 2, lead=1.1)
    for j in range(12):
        n('chip25', P('Bb4') + [0, 4, 7, 12, 16, 19, 24, 28, 31, 36, 40, 43][j], 22.4 + j * 0.05, 0.05, 60 + 4 * j)


LAY_DAWN = [('tpt', 0, 0), ('hn', 0, -4), ('hn', -12, -8), ('vln', 12, -2), ('vla', 0, -6), ('choir', -12, -10),
            ('chip25', 24, -36)]


def act4():
    """dawnbreak (23-34)"""
    hit(23.0, 'Eb', 'M', 1.4, hold=1.1, braam='Eb1', big=True, crash_k=0, lev=1.0, boom=0.8)
    sfx('ignite', 23.0, 'dawn', 1.3, lead=0.5)
    sfx('glass_shatter', 23.0, 0.8, 1.4, 0.8)
    perc('crash', 23.0, 0.6, 3)
    ch('tpt', ['Eb5', 'G5', 'Bb5'], 23.0, 0.5, 127, art='sfz')
    ch('choir', ['Eb4', 'G4', 'Bb4', 'Eb5'], 23.0, 1.0, 124, art='sfz', vowel='a')
    theme('Eb4', 23.0, 0.4, 0, 20, LAY_DAWN, 118)                  # the full theme in Eb (new key)
    # bed: chords under the theme (harp arps, pizz, pulse, taiko 8ths); breathes around the six stabs
    stabs = [(25.0, 'Ab', 'M'), (25.4, 'Bb', 'M'), (25.7, 'Bb', 'sus4'), (26.0, 'Bb', 'M'), (26.2, 'C', 'm'),
             (26.4, 'C', 'm')]
    chords = [(23.2, 1.4, 'Eb', 'M'), (24.6, 0.8, 'Ab', 'M'), (25.4, 0.8, 'Bb', 'M'), (26.2, 0.8, 'C', 'm')]
    with level(0.6):
        for t0, d, rt, q in chords:
            r, iv = tones(rt, q)
            b1, b2, b3 = at(r, 1), at(r, 2), at(r, 3)
            n('cb', b1 if b1 >= 28 else b2, t0, d, 104)
            ch('vc', [b2, b2 + 7], t0, d, 98)
            ch('tbn', [b2, b2 + 7, b3 + iv[1]], t0, d, 96)
            ch('vla', [b3 + i for i in iv], t0, d, 80, trem=True)
            for k in range(int(round(d / 0.2))):
                t = round(t0 + k * 0.2, 3)
                if any(-0.15 < t - s[0] < 0.1 for s in stabs):
                    continue
                n('harp', [b3, b3 + 7, b3 + 12, b3 + 12 + iv[1], b3 + 19, b3 + 12 + iv[1], b3 + 12, b3 + 7][k % 8], t, .4, 88)
                n('pizz', b2 if k % 2 == 0 else b2 + 7, t, .2, 92)
                pulse(t, b1 if b1 >= 28 else b2, 0.18, 0.6 if k % 2 == 0 else 0.4, 0.7)
                perc('taiko', t, 0.5 if k % 2 == 0 else 0.3, k % 2 == 0, 0.0)
                n('chipnz', 0, t, .04, 60, clock=24000.0)
                n('chip12', b3 + 24 + [0, 7, 12, iv[1] + 12][k % 4], t, .08, 56)
                n('chip12', b3 + 24 + [7, 12, iv[1] + 12, 7][k % 4], t + 0.1, .08, 50)
    # the counter-attack: six stabs, accelerating, each breaking a piece of the Hollow
    pieces = ['porcelain', 'void', 'wing', 'porcelain', 'void', 'eye']
    for j, (t, rt, q) in enumerate(stabs):
        s = 0.62 + 0.06 * j
        stab(t, rt, q, s, dur=0.16, high=False, oct_=2 if j < 3 else 3, tight=True)
        prev = stabs[j - 1][0] if j else 24.6
        wl = round(min(0.22, (t - prev) * 0.8), 3)
        sfx('whoosh', t, wl, 0.5 + 0.1 * j, 0.7 if j % 2 else -0.7, 0.0, lead=wl)
        sfx('blade_light', t, 0.75)
        sfx('blade_void', t, 0.5, lead=0.12)
        sfx('glass_crack', t, 0.45 if pieces[j] != 'eye' else 0.8)
        if pieces[j] == 'wing':
            sfx('tinkles', t, 0.5, 0.5, 30)
        if pieces[j] == 'eye':
            sfx('eyes', t, 0.6)
    roll('snare', 26.55, 26.98, 0.4, 1.0, rate=22)
    sfx('whoosh', 27.0, 0.3, 1.0, 0.0, 0.0, 200, 2500, lead=0.3)
    # 27.0 HIT: the uppercut
    hit(27.0, 'Ab', 'M', 1.1, hold=0.5, crash_k=3)
    sfx('impact', 27.0, 1.1)
    sfx('whoosh', 27.6, 0.55, 0.8, -0.4, 0.4, 300, 4500, lead=0.55)
    # the chase upward through three stacked worlds: rising stabs (Bb, C, D)
    for t, rt, world, s in [(27.6, 'Bb', 'city', .82), (28.2, 'C', 'ink', .9), (28.8, 'D', 'ocean', 1.0)]:
        stab(t, rt, 'M', s, dur=0.3, cym=0.5)
        sfx('whip', t, 1.0, lead=0.11)
        sfx('breach', t, world, 0.9, rt)
        sfx('impact', t, 0.6)
        ch('choir', [at(pc(rt), 4), at(pc(rt), 4) + 4, at(pc(rt), 4) + 7], t, 0.5, 92, art='marc', vowel='a')
    for j in range(36):
        t = 27.7 + j * 0.045
        if any(-0.1 < t - s < 0.06 for s in (28.2, 28.8, 29.4)):
            continue
        n('chip25', P('Bb4') + j + [0, 4, 7][j % 3], t, 0.04, 60 + j)
    run('vln', 'Bb', MAJ, 'Bb4', 'Bb6', 28.85, 0.5, 70, 110)
    roll('snare', 28.95, 29.38, 0.4, 1.0, rate=24)
    sfx('riser', 29.4, 1.0, 1.0, lead=1.0)
    perc('rcym', 29.4, 1.0, 1.1, 1, lead=1.0)
    # 29.4 HIT: two world-length swords cross: Eb major (hero) over D minor (Hollow)
    hit(29.4, 'D', 'm', 1.0, hold=0.7, braam='D1', extra=['Eb4', 'G4', 'Bb4'], crash_k=2, lev=0.7)
    sfx('glass_shatter', 29.4, 0.65, 2.0, 1.3, 1.0)
    sfx('clash', 29.4, 0.85, 'light', lead=0.12)
    # grinding crescendo to 31.0
    with level(0.55):
        sfx('lock', 29.5, 1.5, 1.1, rise=3.0, cracks=1.0)
        ch('vln', ['Eb5', 'G5', 'Bb5'], 29.5, 1.5, 100, art='swell', trem=True, bend=[(0, 0), (1.5, 2)])
        ch('vc', ['D3', 'A3'], 29.5, 1.5, 104, art='swell', trem=True)
        ch('choir', ['D4', 'Eb4', 'Bb4'], 29.5, 1.5, 110, art='swell', vowel='a')
        for k, (p, dl) in enumerate([('D3', .38), ('Eb3', .18), ('D3', .38), ('Ab2', .4)]):       # the Hollow pushes
            t = 29.8 + [0, 0.6, 0.8, 1.2][k] * 0.5 + (0 if k < 2 else 0)
            n('tbn', p, t, dl, 112, art='marc')
            n('tuba', P(p) - 12 if P(p) - 12 >= 28 else p, t, dl, 110, art='marc')
        hero_t = [29.9, 30.1, 30.3, 30.4, 30.5]
        for t, iv in zip(hero_t, [0, 7, 9, 7, 12]):                                              # the hero answers
            n('tpt', P('Eb4') + iv, t, 0.12 if iv != 12 else 0.45, 112, art='marc')
            n('hn', P('Eb4') + iv, t, 0.12 if iv != 12 else 0.45, 104, art='marc')
        roll('timp', 29.6, 30.98, 0.3, 1.0, p='D2')
        roll('snare', 30.2, 30.98, 0.3, 1.0, rate=24)
        for k in range(8):
            perc('taiko', 29.8 + k * 0.15, 0.45 + 0.07 * k, k % 2 == 0, 0.0)
    perc('rcym', 31.0, 1.0, 1.0, 3, lead=1.0)
    # ---- 31.0: the blade SNAPS, then the bottom drops out (segment cut at 31.0)
    hit(31.0, 'D', 'mb9', 1.1, hold=0.22, choir=False, crash_k=0)
    sfx('snap', 31.0, 1.2)
    n('vln', 'Eb6', 31.15, 0.8, 54, harm=True)
    sfx('tinkles', 31.15, 0.7, 0.5, 12)
    sfx('whoosh', 32.0, 0.35, 0.8, 0.5, -0.3, 2500, 300, lead=0.35)
    # ---- 32.0: the bare-hand catch. it stops dead (segment cut at 32.0)
    hit(32.0, 'D', 'm', 1.0, hold=0.3, choir=False, cym=False, crash_k=1)
    sfx('catch', 32.0, 1.2)
    n('cb', 'D2', 32.2, 0.8, 64, trem=True)
    n('vc', 'D3', 32.2, 0.8, 56, trem=True)
    # ---- 33.0 FURTHER: key change up to E major; rising run to 34
    r = pc('E')
    ch('vln', ['E5', 'G#5', 'B5'], 33.0, 0.98, 104, art='marc')
    ch('vla', ['B4', 'E5'], 33.0, 0.98, 100, art='marc')
    ch('vc', ['E3', 'B3'], 33.0, 0.98, 104, art='marc')
    n('cb', 'E2', 33.0, 0.98, 108, art='marc')
    perc('timp', 33.0, 'E2', 0.9)
    perc('taiko', 33.0, 0.7, True, 0.0)
    sfx('boom', 33.0, 0.5, stem='sub')
    theme('E4', 33.0, 0.4, 0, 5, [('tpt', 0, 0), ('hn', 0, -4), ('hn', -12, -8), ('chip25', 24, -34)], 120,
          legato=0.9)
    with level(0.7):
        run('vln', 'E', MAJ, 'E4', 'E7', 33.05, 0.9, 80, 120)
        run('vla', 'E', MAJ, 'E3', 'E5', 33.1, 0.85, 80, 116)
        run('harp', 'E', MAJ, 'E3', 'E6', 33.3, 0.65, 80, 110)
        ch('choir', ['E4', 'G#4', 'B4'], 33.15, 0.83, 112, art='swell', vowel='a')
        ch('tbn', ['E3', 'B3'], 33.2, 0.78, 110, art='swell')
        n('tuba', 'E2', 33.2, 0.78, 110, art='swell')
        roll('timp', 33.25, 33.9, 0.3, 1.0, p='E2')
        for k in range(7):          # the build leaves the low band clear for the last 0.1 s: the cut lands on a breath
            perc('taiko', 33.5 + k * 0.055, 0.35 + 0.08 * k, k % 2 == 0, 0.0)
        for j in range(16):
            n('chip25', P('E5') + [0, 4, 7, 12][j % 4] + 12 * (j // 8), 33.2 + j * 0.048, 0.045, 64 + 3 * j)
        sfx('horizon_draw', 34.0, 1.0, 1.0, lead=1.0)
        sfx('riser', 34.0, 1.0, 1.1, lead=1.0)
        perc('rcym', 34.0, 1.0, 1.2, 0, lead=1.0)
        sfx('whoosh', 34.0 - PRE_GAP, 0.18, 0.6, -0.9, 0.9, 1500, 9000, lead=0.18, anchor=34.0)
    # ---- 34.0 THE HORIZON CUT: the biggest HIT, then silence (segment cut at 34.1)
    hit(34.0, 'E', 'M', 1.6, hold=0.15, braam='E1', big=True, crash_k=1, lev=1.0, boom=0.75)
    sfx('horizon_cut', 34.0, 1.6)
    perc('crash', 34.0, 0.7, 2)
    perc('crash', 34.0, 0.6, 3)
    ch('choir', ['E4', 'G#4', 'B4', 'E5'], 34.0, 0.15, 127, art='sfz', vowel='a')
    ch('tpt', ['E5', 'G#5', 'B5'], 34.0, 0.15, 127, art='sfz')
    sfx('impact', 34.0, 1.3)
    sfx('boom', 34.0, 0.9, 40, 24, stem='sub')


def act5():
    """only a shadow (34.6-40): ash, low strings fading in, dawn, the solo horn, the eye"""
    sfx('ash', 34.6, 4.2, 1.0)
    rng = np.random.default_rng(55)
    for t in (35.1, 35.7, 36.2, 36.9):          # the sky heals shard by shard (reversed tinkles)
        sfx('tinkles', t, 0.45, 0.35, 16, reverse=True, lead=0.0)
    ch('vc', ['C#3', 'G#3'], 34.65, 1.2, 70, art='swell')
    n('cb', 'C#2', 34.65, 1.2, 66, art='swell')
    ch('vla', ['E4'], 34.9, 0.95, 56, art='swell')
    n('vc', 'E3', 35.85, 0.5, 60)
    ch('vla', ['C#4', 'E4'], 35.85, 0.65, 54)
    ch('vln', ['B4'], 35.95, 0.55, 46)
    # 36.5 final warm chord, E major; the hero theme on solo horn
    n('piano', 'E2', 36.5, 2.5, 80)
    n('piano', 'E3', 36.5, 2.5, 60)
    n('harp', 'E2', 36.5, 2.0, 100)
    perc('timp', 36.5, 'E2', 0.6)
    n('cb', 'E2', 36.5, 2.95, 70)
    ch('vc', ['E2', 'B2'], 36.5, 2.95, 66)
    ch('vla', ['G#3', 'B3'], 36.5, 2.95, 54)
    ch('vln', ['E4', 'G#4', 'B4'], 36.5, 2.95, 50)
    ch('choir', ['E3', 'B3', 'G#4'], 36.55, 2.9, 50, vowel='o')
    for j, p in enumerate(['E3', 'B3', 'E4', 'G#4', 'B4', 'E5', 'G#5']):
        n('harp', p, 36.5 + j * 0.06, 1.5, 78 - 2 * j)
    times = [36.5, 36.75, 37.25, 37.375, 37.5]
    for t, iv, d in zip(times, [0, 7, 9, 7, 12], [0.25, 0.5, 0.125, 0.125, 1.15]):
        n('shn', P('E4') + iv, t, d * 0.95, 92 if iv != 12 else 98)
    # 38.8 the shadow's eye blinks once: a tiny dark stinger
    sfx('dark_stinger', 38.8, 1.0, lead=0.3)
    n('piano', 'D2', 38.8, 0.9, 58)
    n('piano', 'Ab2', 38.8, 0.9, 50)
    n('pizz', 'D2', 38.8, 0.3, 80)
    sfx('boom', 38.8, 0.18, stem='sub')
    n('vc', 'C3', 38.85, 0.7, 44)


def compose():
    act1()
    act2()
    act3()
    act4()
    act5()


# =========================================================================== rendering
STEMS = ['str', 'brass', 'solo', 'choir', 'keys', 'chip', 'perc', 'synth', 'sfx', 'sub']
MUSIC = ['str', 'brass', 'solo', 'choir', 'keys', 'chip', 'synth']


def seg_of(t):
    for k in range(len(SEGB) - 1):
        if t < SEGB[k + 1] - 1e-9:
            return k
    return len(SEGB) - 2


def render_event(kind, a, kw):
    if kind == 'note':
        return render_note(*a, **kw)
    if kind == 'rev':
        inst, ps, dur, vel = a
        y = None
        for p in ps:
            z = render_note(inst, p, dur + 0.5, vel, art='sfz', **kw.get('kw', {}))
            y = z if y is None else (y[:len(z)] + z[:len(y)]) if len(z) != len(y) else y + z
        y = y[::-1]
        m = int(dur * SR)
        y = y[-m:].copy()
        k = int(0.004 * SR)
        y[-k:] *= np.linspace(1, 0, k)[:, None]
        return y
    return SFX[kind](*a, **kw)


def render_all():
    bufs = {}
    t0 = time.time()
    midi = {}
    for anchor, start, stem, kind, a, kw in EV:
        kw = dict(kw)
        g = kw.pop('g', 1.0)
        if FLUID and to_midi(kind, a, kw, g, start, seg_of(anchor), stem, midi):
            continue
        y = render_event(kind, a, kw)
        if g != 1.0 and y is not None:
            y = y * g
        if y is None or len(y) == 0:
            continue
        k = seg_of(anchor)
        key = (k, stem)
        if key not in bufs:
            bufs[key] = np.zeros((NS, 2))
        i0 = int(round(start * SR))
        j0 = 0
        if i0 < 0:
            j0, i0 = -i0, 0
        ln = min(len(y) - j0, NS - i0)
        if ln > 0:
            bufs[key][i0:i0 + ln] += y[j0:j0 + ln]
    print(f'synthesized hybrid layer ({len(EV)} events) in {time.time() - t0:.1f} s')
    if FLUID:
        render_fluid(midi, bufs)
        write_score_mid(os.path.join(HERE, 'score.mid'))
        print(f'fluidsynth orchestra: {sum(len(v) for v in midi.values())} notes in {len(midi)} stem renders; '
              f'{time.time() - t0:.1f} s')
    return bufs


# =========================================================================== FluidSynth orchestra (part IV's pipeline)
SF2 = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
FLUID = os.path.exists(SF2) and shutil.which('fluidsynth') is not None and not os.environ.get('HOLLOW_SYNTH_ONLY')
TMP = os.path.join(HERE, '_render_tmp')
MIDI_INST = {'vln', 'vla', 'vc', 'cb', 'pizz', 'harp', 'hn', 'tpt', 'tbn', 'tuba', 'shn', 'choir', 'piano', 'celesta',
             'glock'}
# attack compensation (part IV): time-to-half-amplitude of each FluidR3 patch * ~0.7; note-ons go this much early
LAT = {48: .055, 49: .10, 44: .06, 45: .035, 43: .05, 60: .038, 56: .008, 57: .034, 58: .037, 52: .15, 53: .055,
       47: 0., 46: 0., 8: 0., 9: 0., 0: 0.}
MIDI_NAMES = {48: 'strings', 49: 'slow strings (flautando)', 44: 'tremolo strings', 45: 'pizzicato', 43: 'contrabass',
              46: 'harp', 60: 'horns', 56: 'trumpets', 57: 'trombones', 58: 'tuba', 52: 'choir aahs', 53: 'voice oohs',
              0: 'piano', 8: 'celesta', 9: 'glockenspiel', 47: 'timpani'}
# FluidR3 stems are matched to the loudness of the synthesized stems they replace (measured once, see NOTES)
FLUID_GAIN = {'str': 2.77, 'brass': 2.47, 'solo': 4.49, 'choir': 2.67, 'keys': 5.38, 'perc': 7.63}


def midi_prog(inst, kw):
    if inst in ('vln', 'vla', 'vc', 'cb'):
        if kw.get('harm'):
            return 49
        if kw.get('trem'):
            return 44
        return 43 if inst == 'cb' else 48
    if inst == 'choir':
        return 52 if kw.get('vowel', 'a') == 'a' else 53
    return {'pizz': 45, 'harp': 46, 'hn': 60, 'shn': 60, 'tpt': 56, 'tbn': 57, 'tuba': 58, 'piano': 0,
            'celesta': 8, 'glock': 9}[inst]


def to_midi(kind, a, kw, g, start, seg, stem, midi):
    """route orchestral notes and timpani to the MIDI orchestra; returns True if taken"""
    if kind == 'note' and a[0] in MIDI_INST:
        inst, p, d, v = a
        prog = midi_prog(inst, kw)
        art = kw.get('art', 'sus')
        swell = art == 'swell'
        vel = int(np.clip(round(v * np.sqrt(g) * (1.08 if art == 'sfz' else 1.0)), 1, 127))
        if art == 'short':
            d = min(d, 0.12)
        nolat = swell or (inst == 'shn')
        bend = kw.get('bend')
        n_ = dict(prog=prog, p=P(p), t=start, d=d, v=vel, pan=INST[inst]['pan'], lat=0.0 if nolat else LAT[prog],
                  bend=bend, swell=swell, inst=inst)
        midi.setdefault((seg, stem), []).append(n_)
        return True
    if kind == 'timp':
        p = P(a[0])
        vel = a[1] if len(a) > 1 else 1.0
        pan = a[2] if len(a) > 2 else -0.2
        choke = a[3] if len(a) > 3 else None
        v = int(np.clip(round((30 + 97 * vel) * np.sqrt(g)), 1, 127))
        midi.setdefault((seg, 'perc'), []).append(dict(prog=47, p=p, t=start, d=(choke * 2.5 if choke else 1.6), v=v,
                                                       pan=pan, lat=0.0, bend=None, swell=False, inst='timp'))
        return True
    return False


PPQ = 960
TEMPO_US = 400000            # 150 bpm, 1 tick = 0.4 / 960 s


def sec2tick(t):
    return int(round(max(0.0, t) / (TEMPO_US / 1e6) * PPQ))


def vlq(n):
    b = [n & 0x7f]
    n >>= 7
    while n:
        b.append((n & 0x7f) | 0x80)
        n >>= 7
    return bytes(reversed(b))


def midi_events(notes):
    """(time, order, bytes) for one stem render. Each (program, pan) gets a channel; every swell or
    glissando chord gets its own channel (CC11 / pitch-bend are per channel) which is recycled after it rings out."""
    ev = []
    chans = [c for c in range(16) if c != 9]
    base, groups, busy = {}, {}, {}

    def setup(ch, prog, pan, t):
        t = max(0.0, t)
        for b in ([0xC0 | ch, prog], [0xB0 | ch, 7, 100], [0xB0 | ch, 10, int(np.clip(64 + 63 * pan, 0, 127))],
                  [0xB0 | ch, 11, 127], [0xB0 | ch, 101, 0], [0xB0 | ch, 100, 0], [0xB0 | ch, 6, 24],
                  [0xB0 | ch, 38, 0], [0xB0 | ch, 101, 127], [0xB0 | ch, 100, 127], [0xE0 | ch, 0, 64]):
            ev.append((t, 0, bytes(b)))

    def alloc(t, until):
        for c in chans:
            if busy.get(c, -1.0) < t - 0.1:
                busy[c] = until
                return c
        raise RuntimeError('out of MIDI channels at %.2f' % t)

    shifted = []
    for n_ in sorted(notes, key=lambda n_: n_['t']):
        t0 = max(0.0, n_['t'] - n_['lat'])
        t1 = n_['t'] + max(0.03, n_['d'])
        special = n_['swell'] or bool(n_['bend'])
        if not special:
            key = (n_['prog'], n_['pan'])
            if key not in base:
                base[key] = alloc(t0, 1e9)
                setup(base[key], n_['prog'], n_['pan'], 0.0)
            ch = base[key]
        else:
            key = (n_['prog'], n_['pan'], round(n_['t'], 3), round(n_['d'], 3), n_['swell'],
                   tuple(map(tuple, n_['bend'] or ())))
            if key not in groups:
                ch = alloc(t0, t1 + 2.5)
                groups[key] = ch
                setup(ch, n_['prog'], n_['pan'], t0 - 0.03)
                if n_['swell']:
                    for j in range(25):
                        u = j / 24
                        ev.append((t0 + u * n_['d'], 2, bytes([0xB0 | ch, 11, int(18 + 109 * u ** 1.6)])))
                    ev.append((t1 + 2.4, 2, bytes([0xB0 | ch, 11, 127])))
                if n_['bend']:
                    bt = [b[0] for b in n_['bend']]
                    bv = [b[1] for b in n_['bend']]
                    for tb in np.arange(0, max(bt) + 0.011, 0.01):
                        val = int(np.clip(8192 + np.interp(tb, bt, bv) / 24 * 8192, 0, 16383))
                        ev.append((n_['t'] + tb, 2, bytes([0xE0 | ch, val & 0x7f, val >> 7])))
            ch = groups[key]
        shifted.append([ch, n_['p'], t0, t1, n_['v']])
    shifted.sort(key=lambda n_: (n_[0], n_[1], n_[2]))
    for i in range(len(shifted) - 1):     # same pitch on one channel: end the earlier note before the next
        a_, b_ = shifted[i], shifted[i + 1]
        if a_[0] == b_[0] and a_[1] == b_[1] and a_[3] > b_[2] - 0.002:
            a_[3] = max(a_[2] + 0.01, b_[2] - 0.002)
    for ch, p, t0, t1, v in shifted:
        if 0 <= p <= 127:
            ev.append((t1, 1, bytes([0x80 | ch, p, 0])))
            ev.append((t0, 3, bytes([0x90 | ch, p, v])))
    return ev


def write_midi_track(path, ev, t_end, name=b'The Hollow'):
    ev = sorted(ev, key=lambda e: (sec2tick(e[0]), e[1]))
    tr = bytearray(b'\x00\xff\x03' + vlq(len(name)) + name)
    tr += b'\x00\xff\x51\x03' + TEMPO_US.to_bytes(3, 'big') + b'\x00\xff\x58\x04\x04\x02\x18\x08'
    last = 0
    end_tick = sec2tick(t_end)
    for t, _, data in ev:
        tk = min(sec2tick(t), end_tick)
        tr += vlq(tk - last) + data
        last = tk
    tr += vlq(max(0, end_tick - last)) + b'\xff\x2f\x00'
    with open(path, 'wb') as f:
        f.write(b'MThd' + struct.pack('>IHHH', 6, 0, 1, PPQ) + b'MTrk' + struct.pack('>I', len(tr)) + bytes(tr))


def render_midi(mid, wav):
    import soundfile as sf
    subprocess.run(['fluidsynth', '-ni', '-q', '-R', '0', '-C', '0', '-r', str(SR), '-g', '0.35',
                    '-o', 'synth.polyphony=1024', '-O', 'float', '-T', 'wav', '-F', wav, SF2, mid],
                   check=True, capture_output=True)
    x, sr = sf.read(wav, dtype='float64', always_2d=True)
    assert sr == SR
    os.remove(wav)
    os.remove(mid)
    y = np.zeros((NS, 2))
    m = min(NS, len(x))
    y[:m] = x[:m]
    return y


def render_fluid(midi, bufs):
    os.makedirs(TMP, exist_ok=True)

    def job(item):
        (seg, stem), notes = item
        ev = midi_events(notes)
        t_end = min(DUR, max(n_['t'] + n_['d'] for n_ in notes) + 3.0)
        mid = os.path.join(TMP, f'{stem}{seg}.mid')
        write_midi_track(mid, ev, t_end)
        return (seg, stem), render_midi(mid, os.path.join(TMP, f'{stem}{seg}.wav'))
    try:
        with ThreadPoolExecutor(max_workers=4) as ex:
            for key, y in ex.map(job, sorted(midi.items())):
                y = y * FLUID_GAIN.get(key[1], 1.0)
                bufs[key] = bufs[key] + y if key in bufs else y
    finally:
        if os.path.isdir(TMP) and not os.listdir(TMP):
            os.rmdir(TMP)


EXPORT_CH = {48: 0, 49: 1, 44: 2, 45: 3, 43: 4, 46: 5, 60: 6, 56: 7, 57: 8, 58: 10, 52: 11, 53: 12, 0: 13, 47: 14,
             8: 15, 9: 15}


def write_score_mid(path):
    """score.mid: the orchestral score as composed (cue-exact note-on times, no attack compensation),
    one track per instrument family; celesta and glockenspiel share channel 16 by program change."""
    tracks = {}
    for anchor, start, stem, kind, a, kw in EV:
        if kind == 'note' and a[0] in MIDI_INST:
            inst, p, d, v = a
            prog = midi_prog(inst, kw)
            vel = int(np.clip(round(v * np.sqrt(kw.get('g', 1.0))), 1, 127))
            tracks.setdefault(prog, []).append((start, P(p), d, vel))
        elif kind == 'timp':
            vel = int(np.clip(round((30 + 97 * (a[1] if len(a) > 1 else 1.0)) * np.sqrt(kw.get('g', 1.0))), 1, 127))
            tracks.setdefault(47, []).append((start, P(a[0]), 1.0, vel))
    chunks = []
    t0 = bytearray(b'\x00\xff\x03' + vlq(10) + b'The Hollow')
    t0 += b'\x00\xff\x51\x03' + TEMPO_US.to_bytes(3, 'big') + b'\x00\xff\x58\x04\x04\x02\x18\x08'
    t0 += vlq(sec2tick(DUR)) + b'\xff\x2f\x00'
    chunks.append(t0)
    for prog in sorted(tracks):
        ch = EXPORT_CH[prog]
        ev = [(0.0, 0, bytes([0xC0 | ch, prog]))]
        for t, p, d, v in tracks[prog]:
            if prog in (8, 9):
                ev.append((t, 0, bytes([0xC0 | ch, prog])))
            ev.append((t, 3, bytes([0x90 | ch, p, v])))
            ev.append((t + max(0.03, d), 1, bytes([0x80 | ch, p, 0])))
        ev.sort(key=lambda e: (sec2tick(e[0]), e[1]))
        nm = MIDI_NAMES[prog].encode()
        tr = bytearray(b'\x00\xff\x03' + vlq(len(nm)) + nm)
        last = 0
        for t, _, data in ev:
            tk = sec2tick(t)
            tr += vlq(tk - last) + data
            last = tk
        tr += b'\x00\xff\x2f\x00'
        chunks.append(tr)
    with open(path, 'wb') as f:
        f.write(b'MThd' + struct.pack('>IHHH', 6, 1, len(chunks), PPQ))
        for tr in chunks:
            f.write(b'MTrk' + struct.pack('>I', len(tr)) + bytes(tr))


# =========================================================================== reverb, mix, master
def hall_ir(rt60=2.3, pre=0.02, seed=3):
    rng = np.random.default_rng(seed)
    n = int((rt60 * 1.15 + pre) * SR)
    ir = np.zeros((n, 2))
    for c in range(2):
        def G(tf, f):
            rt = rt60 * (1.1 * g_lp(f, 2500, 1) + 0.25)
            return np.exp(-6.91 * np.maximum(tf, 0) / rt) * g_hp(f, 60, 1)
        ir[:, c] = tvf(rng.standard_normal(n), G, 2048, 512)
    t = tt(n)
    ir *= np.minimum(1, t / 0.05)[:, None] ** 1.5
    for _ in range(14):
        d = rng.uniform(0.008, 0.07)
        ir[int(d * SR), rng.integers(0, 2)] += rng.uniform(0.3, 0.8) * (1 - d * 8) * 30 * np.sqrt(np.mean(ir ** 2))
    k0 = int(pre * SR)
    ir = np.concatenate([np.zeros((k0, 2)), ir])[:n]
    ir /= np.sqrt(np.sum(ir ** 2) / 2)
    return ir


def convolve(x, ir):
    N = fastlen(len(x) + len(ir))
    X = np.fft.rfft(x, N, axis=0)
    H = np.fft.rfft(ir, N, axis=0)
    return np.fft.irfft(X * H, N, axis=0)[:len(x)]


STEM_EQ = {
    'str': lambda f: g_hp(f, 38, 2) * g_bell(f, 300, -2.0, .6) * g_shelf(f, 7000, 1.0),
    'brass': lambda f: g_hp(f, 40, 2) * g_bell(f, 260, -2.0, .6) * g_bell(f, 1800, 1.5, .8),
    'solo': lambda f: g_hp(f, 80, 2) * g_bell(f, 300, -1.5, .6),
    'choir': lambda f: g_hp(f, 110, 2) * g_bell(f, 320, -2.5, .6) * g_shelf(f, 6000, 1.5),
    'keys': lambda f: g_hp(f, 60, 2),
    'chip': lambda f: g_hp(f, 150, 2) * g_lp(f, 12000, 1),
    'perc': lambda f: g_hp(f, 28, 2),
    'synth': lambda f: g_hp(f, 28, 2) * g_bell(f, 250, -3, .7),
    'sfx': lambda f: g_hp(f, 45, 2),
    'sub': lambda f: g_hp(f, 22, 2) * g_lp(f, 200, 2),
}
STEM_GAIN = {'str': 1.0, 'brass': 1.0, 'solo': 1.7, 'choir': 0.9, 'keys': 1.0, 'chip': 1.8, 'perc': 0.8,
             'synth': 0.55, 'sfx': 1.0, 'sub': 0.65}
SEND = {'str': 0.32, 'brass': 0.28, 'solo': 0.5, 'choir': 0.42, 'keys': 0.45, 'chip': 0.18, 'perc': 0.2,
        'synth': 0.08, 'sfx': 0.25, 'sub': 0.0}
REVERB_GAIN = 0.5


def gain_curve(points, n=NS):
    """points [(t, dB)] -> linear gain per sample"""
    ts = np.array([p[0] for p in points])
    gs = np.array([p[1] for p in points])
    return 10 ** (np.interp(np.arange(n) / SR, ts, gs) / 20)


def caption_duck():
    pts = [(0, 0)]
    for c in CAPTIONS:
        pts += [(c - 0.12, 0), (c - 0.04, -3.5), (c + 1.25, -3.5), (c + 1.4, 0)]
    pts.append((DUR, 0))
    return gain_curve(pts)


def mix(bufs):
    ir = hall_ir()
    duck = caption_duck()[:, None]
    stems_out = {s: np.zeros((NS, 2)) for s in STEMS}
    total = np.zeros((NS, 2))
    for k in range(len(SEGB) - 1):
        dry = np.zeros((NS, 2))
        send = np.zeros((NS, 2))
        segx = {}
        for s in STEMS:
            if (k, s) not in bufs:
                continue
            x = ffilt(bufs[(k, s)], STEM_EQ[s]) * STEM_GAIN[s]
            if s in MUSIC:
                x = x * duck
            dry += x
            send += x * SEND[s]
            segx[s] = x
        wet = convolve(send, ir) * REVERB_GAIN
        seg = dry + wet
        g = np.ones(NS)
        if k < len(CUTS):              # cut at the end of the segment
            e, fl, mode = CUTS[k]
            i0 = int(round(e * SR))
            m = int(fl * SR)
            if mode == 'end':
                i0 -= m
            g[i0:i0 + m] = np.cos(np.linspace(0, np.pi / 2, m)) ** 2
            g[i0 + m:] = 0
            seg *= g[:, None]
        for s_, x in segx.items():
            stems_out[s_] += x * g[:, None]
        total += seg
    return total, stems_out


def k_weight(x):
    N = fastlen(len(x) + 4096)
    f = np.fft.rfftfreq(N, 1 / SR)
    z = np.exp(-1j * 2 * np.pi * f / SR)

    def H(b, a):
        return (b[0] + b[1] * z + b[2] * z * z) / (a[0] + a[1] * z + a[2] * z * z)
    g = np.abs(H([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]) *
               H([1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621]))
    X = np.fft.rfft(x, N, axis=0)
    return np.fft.irfft(X * g[:, None], N, axis=0)[:len(x)]


def lufs(x, kw=None):
    y = k_weight(x) if kw is None else kw
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    p = np.sum(y ** 2, 1)
    c = np.concatenate([[0], np.cumsum(p)])
    starts = np.arange(0, len(p) - blk, hop)
    z = (c[starts + blk] - c[starts]) / blk
    l = -0.691 + 10 * np.log10(z + 1e-20)
    z1 = z[l > -70]
    rel = -0.691 + 10 * np.log10(np.mean(z1)) - 10
    z2 = z[(l > -70) & (l > rel)]
    return -0.691 + 10 * np.log10(np.mean(z2))


def loud(kw, t0, t1):
    seg = kw[int(t0 * SR):int(t1 * SR)]
    return -0.691 + 10 * np.log10(np.mean(np.sum(seg ** 2, 1)) + 1e-20)


def oversample(x, os_=4):
    n = len(x)
    N = fastlen(n)
    X = np.fft.rfft(x, N, axis=0)
    Y = np.zeros((N * os_ // 2 + 1, x.shape[1]), complex)
    Y[:len(X)] = X
    return np.fft.irfft(Y, N * os_, axis=0)[:n * os_] * os_


def true_peak_env(x, os_=4):
    up = oversample(x, os_)
    a = np.abs(up).max(1)
    return a[:len(a) // os_ * os_].reshape(-1, os_).max(1)


def compressor(x, thr_db, ratio, att=0.015, rel=0.2, knee=6.0):
    blk = 48
    nb = len(x) // blk + 1
    pw = np.mean(np.pad(x, ((0, nb * blk - len(x)), (0, 0))) ** 2, 1).reshape(nb, blk).mean(1)
    lev = 10 * np.log10(pw + 1e-12)
    over = lev - thr_db
    gr = np.where(over <= -knee / 2, 0.0, np.where(over >= knee / 2, over * (1 - 1 / ratio),
                                                   (1 - 1 / ratio) * (over + knee / 2) ** 2 / (2 * knee)))
    g = np.zeros(nb)
    ca, cr = np.exp(-1e-3 / att), np.exp(-1e-3 / rel)
    s = 0.0
    for i in range(nb):
        c = ca if gr[i] > s else cr
        s = c * s + (1 - c) * gr[i]
        g[i] = s
    gl = 10 ** (-np.interp(np.arange(len(x)) / blk, np.arange(nb), g) / 20)
    return x * gl[:, None]


def limiter(x, ceiling_db=-1.4, look=0.003, rel=0.1):
    ceil = 10 ** (ceiling_db / 20)
    pk = true_peak_env(x)
    req = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    blk = 48
    nb = len(x) // blk + 1
    reqb = np.pad(req, (0, nb * blk - len(req)), constant_values=1).reshape(nb, blk).min(1)
    la = max(1, int(look * 1000))
    padded = np.pad(reqb, (la + 1, la + 1), constant_values=1)
    win = np.lib.stride_tricks.sliding_window_view(padded, 2 * la + 3)
    reqb = win.min(1)[:nb]
    g = reqb.copy()
    cr = np.exp(-1e-3 / rel)
    for i in range(1, nb):
        g[i] = min(g[i], cr * g[i - 1] + (1 - cr))
    gl = np.interp(np.arange(len(x)) / blk, np.arange(nb), g)
    gl = np.convolve(gl, np.ones(96) / 96, 'same')
    gl = np.minimum(gl, np.interp(np.arange(len(x)) / blk, np.arange(nb), reqb))
    return x * gl[:, None]


def master(bus, target=-14.0):
    bus = ffilt(bus, lambda f: g_hp(f, 24, 2) * g_bell(f, 240, -1.5, .7) * g_bell(f, 3000, 2.0, .9) *
                g_shelf(f, 9000, 1.8))
    bus = bus - bus.mean(0)
    x = compressor(bus, -17.0, 1.6, att=0.03, rel=0.25)
    g = 10 ** ((target - lufs(x)) / 20)
    for it in range(5):
        y = limiter(x * g)
        for _ in range(2):              # second pass catches inter-sample overs from the gain smoothing
            tp = true_peak_env(y).max()
            if tp > 10 ** (-1.2 / 20):
                y = limiter(y, -1.6)
        L_ = lufs(y)
        print(f'  master pass {it}: gain {20 * np.log10(g):+.2f} dB -> {L_:.2f} LUFS')
        if abs(L_ - target) < 0.04:
            break
        g *= 10 ** ((target - L_) / 20)
    for a, b in SILENT:
        y[int(round(a * SR)):int(round(b * SR))] = 0.0
    a, b = END_FADE
    i0, i1 = int(a * SR), int(b * SR)
    y[i0:i1] *= (np.cos(np.linspace(0, np.pi / 2, i1 - i0)) ** 2)[:, None]
    y[i1:] = 0.0
    return y, g


def write_wav24(path, y):
    q = np.clip(np.round(y * 8388607), -8388608, 8388607).astype('<i4')
    b = q.reshape(-1).view(np.uint8).reshape(-1, 4)[:, :3].tobytes()
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(3)
        w.setframerate(SR)
        w.writeframes(b)


def read_wav24(path):
    with wave.open(path, 'rb') as w:
        info = (w.getnframes(), w.getframerate(), w.getnchannels(), w.getsampwidth())
        raw = np.frombuffer(w.readframes(w.getnframes()), np.uint8).reshape(-1, 3)
    v = (raw[:, 0].astype(np.int32) | (raw[:, 1].astype(np.int32) << 8) | (raw[:, 2].astype(np.int32) << 16))
    v = np.where(v >= 1 << 23, v - (1 << 24), v)
    return (v / 8388608.0).reshape(-1, 2), info


# =========================================================================== verification
CUES = [(0.0, 'start (frame 0)', 'multi'), (1.6, 'stinger eyes', 'multi'), (3.0, 'HIT impale', 'multi'),
        (3.6, 'stab blitz 1', 'multi'), (4.0, 'stab blitz 2', 'multi'), (4.4, 'stab blitz 3', 'multi'),
        (4.8, 'stab blitz 4', 'multi'), (5.4, 'HIT slam/shatter', 'multi'), (7.5, 'HIT ZENITH NOVA', 'multi'),
        (8.2, 'stab clash 1', 'multi'), (8.8, 'stab clash 2', 'multi'), (9.3, 'stab clash 3', 'multi'),
        (9.7, 'stab clash 4', 'multi'), (10.0, 'stab clash 5', 'multi'), (10.6, 'HIT blade lock', 'multi'),
        (11.6, 'stab breach ink', 'multi'), (12.6, 'stab breach city', 'multi'), (13.4, 'stab breach sun', 'multi'),
        (14.0, 'HIT Hollow NOVA', 'multi'), (15.0, 'HIT world cut', 'multi'), (16.2, 'HIT moon', 'multi'),
        (17.4, 'HIT wing', 'multi'), (18.4, 'HIT pin', 'multi'), (20.4, 'piano spark 1', 'full'),
        (20.9, 'piano spark 2', 'full'), (21.4, 'piano spark 3', 'full'), (21.9, 'piano spark 4', 'full'),
        (23.0, 'HIT DAWNBREAK', 'multi'), (25.0, 'stab counter 1', 'multi'), (25.4, 'stab counter 2', 'multi'),
        (25.7, 'stab counter 3', 'multi'), (26.0, 'stab counter 4', 'multi'), (26.2, 'stab counter 5', 'multi'),
        (26.4, 'stab counter 6', 'multi'), (27.0, 'HIT uppercut', 'multi'), (27.6, 'stab chase 1', 'multi'),
        (28.2, 'stab chase 2', 'multi'), (28.8, 'stab chase 3', 'multi'), (29.4, 'HIT swords cross', 'multi'),
        (31.0, 'HIT blade snap', 'multi'), (32.0, 'HIT bare-hand catch', 'multi'), (33.0, 'FURTHER key change', 'multi'),
        (34.0, 'HIT HORIZON CUT', 'multi'), (36.5, 'warm chord + horn', 'low'), (38.8, 'dark stinger', 'multi')]
HITS = [3.0, 5.4, 7.5, 10.6, 14.0, 15.0, 16.2, 17.4, 18.4, 23.0, 27.0, 29.4, 31.0, 32.0, 34.0]
SECTIONS = [(0, 1.6, 'I   hook: pulse+motif'), (1.6, 3.0, 'I   eyes, build'), (3.0, 5.4, 'I   impale + blitz'),
            (5.4, 6.8, 'I   shatter, fall'), (6.8, 7.5, 'I   held breath'), (7.5, 10.6, 'II  duel ostinato'),
            (10.6, 11.6, 'II  blade lock'), (11.6, 14.0, 'II  three worlds'), (14.0, 18.4, 'III NOVA + 4 HITs'),
            (18.4, 20.0, 'III pin, collapse'), (20.0, 22.0, 'III QUIET: sparks'), (22.0, 23.0, 'III rising tremolo'),
            (23.0, 25.0, 'IV  DAWNBREAK theme'), (25.0, 27.0, 'IV  counter-attack'), (27.0, 29.4, 'IV  chase up'),
            (29.4, 31.0, 'IV  swords cross'), (31.0, 32.0, 'IV  snap, drop'), (32.0, 33.0, 'IV  catch'),
            (33.0, 34.0, 'IV  FURTHER run'), (34.0, 34.1, 'IV  HORIZON CUT'), (34.6, 36.5, 'V   ash, low strings'),
            (36.5, 38.8, 'V   dawn, solo horn'), (38.8, 39.8, 'V   stinger, ring out')]


BANDS = {'low': [lambda f: g_lp(f, 150, 4)],
         'full': [lambda f: g_hp(f, 150, 4) * g_lp(f, 5000, 4)],
         'multi': [lambda f: g_lp(f, 150, 4), lambda f: g_hp(f, 150, 4) * g_lp(f, 2000, 4),
                   lambda f: g_hp(f, 2000, 4) * g_lp(f, 10000, 4)]}


def minphase_filter(x, G):
    """causal minimum-phase filter with magnitude G (cepstral method): no pre-echo before transients"""
    N = fastlen(len(x) + 65536)
    f = np.abs(np.fft.fftfreq(N, 1 / SR))
    logm = np.log(np.maximum(G(f), 1e-6))
    c = np.fft.ifft(logm).real
    w = np.zeros(N)
    w[0] = 1
    w[1:N // 2] = 2
    w[N // 2] = 1
    H = np.exp(np.fft.fft(c * w))
    return np.fft.ifft(np.fft.fft(x, N) * H).real[:len(x)]


def band_db(x, G, hop=48, win=480):
    lo = minphase_filter(x.mean(1), G)
    N = fastlen(len(lo))
    X = np.fft.fft(lo, N)
    h = np.zeros(N)
    h[0] = 1
    h[1:N // 2] = 2
    h[N // 2] = 1
    env = np.abs(np.fft.ifft(X * h))[:len(lo)]      # analytic envelope: no ripple on 30 Hz tails
    c = np.concatenate([[0], np.cumsum(env ** 2)])
    idx = np.arange(win, len(lo), hop)
    e = np.sqrt((c[idx] - c[idx - win]) / win)
    return 20 * np.log10(e + 1e-7), (idx - win) / SR


def onset_detect(x, band='multi'):
    """band-wise rise detection: detection function = sum over bands of the positive 15 ms rise (dB)"""
    win = 480
    dbs = []
    for G in BANDS[band]:
        db, tframe = band_db(x, G)
        dbs.append(db)
    lag = 15
    rises = []
    for db in dbs:
        r_ = np.zeros(len(db))
        r_[lag:] = db[lag:] - db[:-lag]
        rises.append(r_)
    rise = sum(np.maximum(r_, 0) for r_ in rises) if len(dbs) > 1 else rises[0]
    db = dbs[0]
    thr = {'low': 4.0, 'full': 3.0, 'multi': 9.0}[band]
    cand = np.where((rise[1:-1] > thr) & (rise[1:-1] >= rise[:-2]) & (rise[1:-1] > rise[2:]))[0] + 1
    order = cand[np.argsort(-rise[cand])]
    peaks = []
    for pk in order:
        if all(abs(pk - q) >= 80 for q in peaks):
            peaks.append(pk)
    out = []
    for pk in sorted(peaks):
        b = int(np.argmax([r_[pk] for r_ in rises]))     # time the onset in the band that rose most
        dbb = dbs[b]
        base = dbb[max(0, pk - lag)]
        j = max(0, pk - lag)
        while j < pk and dbb[j] < base + 3:
            j += 1
        out.append((tframe[j] + win / SR, rise[pk]))
    return out


NOTES = """
I cannot listen. Every judgment above is measured, not heard; the numbers stand in for ears:
  section loudness curve (is the quiet really quiet, are 23.0 / 34.0 the peaks), HIT power and jump, spectrum
  balance per band (mud 150-400 Hz, presence), stem balance, DC, clipping, true peak, silence windows, caption room.

Critique-and-improve rounds (all measured on the master)
  1  first render: 33/45 cues in tolerance, LRA 5.3 LU, quiet beat -20 LUFS, held breath -16.8 LUFS, 48 % of energy
     below 150 Hz, 8 % presence. -> beds/builds put under the HITs (level contexts), segment cuts for the held
     breath (6.85) and the collapse (19.15), sub/pulse stems down, presence/air EQ, gentler bus glue.
  2  39/45. The early onsets were ripple of a 15 ms RMS on 30 Hz boom tails -> analytic envelope. The late ones
     were real low attacks just after HITs (lock growl, gated rip, roll strokes) -> lock starts on the HIT, rip
     high-passed, rolls stop 80 ms before the HIT, stabs get a tight kick and choked timpani.
  3  41/45: beat nulls between overlapping low tones -> low end cleaned (shorter braams and boom tails, choked
     ostinato timpani) and a multi-band onset function. HIT hierarchy: ordinary HITs -1.7 dB, 23.0 / 34.0 full
     with less sub (headroom to mids) -> 34.0 loudest in 100 ms, 23.0 loudest in 400 ms.
  4  chip layer was 15-25 dB under the strings -> +7 dB; solo horn under the strings at 36.5 -> horn leads;
     stem table now honours the cuts; builds stop 12 ms before their HIT; caption at 2.2 given room.
  5  zero-phase analysis filters pre-echoed the giant 34.0 transient (-27 ms) -> causal minimum-phase filters;
     bass cleared before 36.5 and the last 0.1 s before 34.0 -> 45/45, worst 11 ms.

Honest limitations
  - Everything is synthesized in numpy (fluidsynth, the FluidR3 soundfont, scipy and soundfile are not installed
    here and no samples were downloaded), so the orchestra is wavetable/additive modelling: it will sound more
    synthetic than part IV's soundfont render. Continuity with part IV is in the themes, keys and orchestration.
  - Brass attack scoop is approximated in amplitude, not pitch; strings have no legato transitions.
  - 2.2 caption sits inside the crescendo to the 3.0 HIT: music is ducked 3.5 dB, but total level still rises
    about 1 LU across the caption.
  - 15.0 and 18.4 jump only +0.9 / +1.7 LU over the previous second because a HIT landed ~1 s before each.
  - LRA 6 LU: dense trailer-style dynamics outside the quiet beat and Act V.
  - The onset detector is this script's own (numpy) implementation; no MIDI file is exported.
"""


def verify(y, info, g_master, stems):
    lines = ['THE HOLLOW - Fable Saga part V - score verification (measured on the written 24-bit master)', '']
    frames, sr, chn, sw = info
    lines.append(f'File: {OUT}')
    lines.append(f'  {frames} frames = {frames / sr:.3f} s, {sr} Hz, {chn} ch, {sw * 8}-bit PCM')
    kw = k_weight(y)
    L_ = lufs(y, kw)
    tp = 20 * np.log10(true_peak_env(y).max())
    lines.append(f'Loudness (internal BS.1770-4 meter): {L_:.2f} LUFS integrated, true peak {tp:.2f} dBTP (4x)')
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', OUT, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    summ = r[r.rfind('Summary:'):]
    keep = [l.strip() for l in summ.splitlines() if any(k in l for k in ('I:', 'LRA:', 'Peak:'))]
    lines.append('ffmpeg ebur128: ' + ' | '.join(keep))
    sp = 20 * np.log10(np.abs(y).max())
    nclip = int(np.sum(np.abs(y) >= 0.999))
    dc = y.mean(0)
    lines.append(f'Sample peak {sp:.2f} dBFS; samples at/above -0.01 dBFS: {nclip}; DC offset L {dc[0]:+.2e} '
                 f'R {dc[1]:+.2e}')
    corr = np.sum(y[:, 0] * y[:, 1]) / np.sqrt(np.sum(y[:, 0] ** 2) * np.sum(y[:, 1] ** 2))
    lines.append(f'Stereo L/R correlation (whole file): {corr:+.2f}')
    lines.append('')
    lines.append('Hit alignment (onset detection on the master; tolerance +-33.3 ms = 1 frame at 30 fps)')
    lines.append('  detector: causal minimum-phase band filters (no pre-echo), analytic (Hilbert) envelope,')
    lines.append('  10 ms energy, 1 ms hop, 15 ms rise.')
    lines.append('  multi (HITs, stabs, stingers) = sum of positive rises in <150 Hz, 150 Hz-2 kHz and 2-10 kHz (>= 9 dB):')
    lines.append('  a real impact rises in all three at once, a beat null between low tones only in one. The onset is')
    lines.append('  timed in the band that rose most (first 1 ms frame clearing its pre-rise level by 3 dB).')
    lines.append('  full = 150 Hz-5 kHz band, rise >= 3 dB (soft pitched entries: the piano sparks);')
    lines.append('  low = <150 Hz band, rise >= 4 dB (the soft 36.5 chord: piano, harp and timpani E2).')
    lines.append('  The strongest onset within 80 ms of the cue is taken.')
    ons = {b: onset_detect(y, b) for b in ('multi', 'full', 'low')}
    worst, nbad = 0.0, 0
    res = []
    for t, lab, det in CUES:
        cands = [o for o in ons[det] if abs(o[0] - t) < 0.08]
        if t == 0.0:
            cands = [o for o in ons[det] if o[0] < 0.05] or [(0.0 + np.argmax(np.abs(y[:, 0]) > 1e-4) / SR, 99.0)]
        if cands:
            o = max(cands, key=lambda o: o[1])
            d = (o[0] - t) * 1000
            worst = max(worst, abs(d))
            ok = abs(d) <= 33.3
            nbad += not ok
            res.append((t, d))
            lines.append(f'  {"OK " if ok else "OFF"} cue {t:6.2f}  {lab:22s} {det:4s} measured {o[0]:7.3f}  '
                         f'delta {d:+6.1f} ms  rise {o[1]:5.1f} dB')
        else:
            nbad += 1
            worst = 999
            lines.append(f'  MISS cue {t:6.2f} {lab:22s} {det:4s} no onset within 80 ms')
    lines.append(f'  {len(CUES)} cues, {len(CUES) - nbad} within one frame; worst |delta| = {worst:.1f} ms')
    lines.append('')
    lines.append('Loudness curve (K-weighted loudness of each section, LUFS; peak dBFS)')
    for t0, t1, lab in SECTIONS:
        st_ = loud(kw, t0, t1)
        pk = 20 * np.log10(np.abs(y[int(t0 * SR):int(t1 * SR)]).max() + 1e-12)
        lines.append(f'  {t0:5.1f}-{t1:5.1f}  {lab:24s} {st_:7.1f}   {pk:6.1f}  ' + '#' * max(0, int((st_ + 50) / 1.2)))
    lines.append('')
    lines.append('HIT power: loudness of the first 100 ms and 400 ms (momentary) after each HIT, vs the 1 s before')
    rows = []
    for t in HITS:
        a100, a400, pre = loud(kw, t, t + 0.1), loud(kw, t, t + 0.4), loud(kw, t - 1.0, t - 0.05)
        rows.append((t, a100, a400, pre))
        lines.append(f'  {t:5.1f}  100 ms {a100:6.1f}   400 ms {a400:6.1f}   before {pre:6.1f}   jump {a100 - pre:+5.1f} LU')
    r100 = sorted(rows, key=lambda r: -r[1])
    lines.append('  ranking by 100 ms loudness: ' + ', '.join(f'{r[0]:.1f}' for r in r100[:6]))
    ann = sorted(rows, key=lambda r: -r[2])
    lines.append('  ranking by 400 ms loudness: ' + ', '.join(f'{r[0]:.1f}' for r in ann[:6]))
    mom = np.array([loud(kw, a, a + 0.4) for a in np.arange(0, DUR - 0.4, 0.05)])
    tops = np.argsort(-mom)[:12] * 0.05
    lines.append('  loudest 400 ms windows anywhere start at: ' + ', '.join(f'{t:.2f}' for t in sorted(tops)))
    lines.append('')
    lines.append('Spectrum balance (share of energy per band, whole file / HIT windows 0-0.4 s)')
    bands = [(20, 60, 'sub'), (60, 150, 'multi'), (150, 400, 'low-mid (mud)'), (400, 1500, 'mid'),
             (1500, 5000, 'presence'), (5000, 20000, 'air')]
    X = np.abs(np.fft.rfft(y.mean(1))) ** 2
    fr = np.fft.rfftfreq(len(y), 1 / SR)
    hw = np.concatenate([y[int(t * SR):int((t + 0.4) * SR)].mean(1) for t in HITS])
    XH = np.abs(np.fft.rfft(hw)) ** 2
    fh = np.fft.rfftfreq(len(hw), 1 / SR)
    for lo, hi, lab in bands:
        a = X[(fr >= lo) & (fr < hi)].sum() / X.sum() * 100
        b = XH[(fh >= lo) & (fh < hi)].sum() / XH.sum() * 100
        lines.append(f'  {lo:5d}-{hi:5d} Hz {lab:14s} {a:5.1f} %   {b:5.1f} %')
    lines.append('')
    for a, b, lab in [(34.1, 34.6, 'after the Horizon Cut'), (39.8, 40.0, 'end')]:
        seg = y[int(a * SR):int(b * SR)]
        pk = np.abs(seg).max()
        lines.append(f'Silence check {a:.2f}-{b:.2f} ({lab}): peak '
                     f'{"-inf (digital zero)" if pk == 0 else f"{20 * np.log10(pk):.1f}"} dBFS')
    for a, b, lab in [(18.9, 20.3, 'collapse/cold note'), (20.3, 22.0, 'the quiet: piano sparks'),
                      (6.85, 7.2, 'held breath')]:
        seg = y[int(a * SR):int(b * SR)]
        lines.append(f'Quiet check {a:.2f}-{b:.2f} ({lab}): {loud(kw, a, b):.1f} LUFS, peak '
                     f'{20 * np.log10(np.abs(seg).max() + 1e-12):.1f} dBFS ({loud(kw, a, b) - L_:+.1f} LU vs integrated)')
    lines.append('')
    lines.append('Caption room (K-weighted loudness 0-1.2 s after caption vs 1 s before; music stems ducked -3.5 dB)')
    for c in CAPTIONS:
        lines.append(f'  {c:5.1f}  during {loud(kw, c, c + 1.2):6.1f}   before {loud(kw, c - 1.0, c):6.1f}')
    lines.append('')
    lines.append('Stem balance (K-weighted LUFS of each dry stem per section, after the segment cuts, at master gain, pre-limiter)')
    names = [s for s in STEMS if np.abs(stems[s]).max() > 0]
    lines.append('  section                   ' + ''.join(f'{s:>7s}' for s in names))
    skw = {s: k_weight(stems[s] * g_master) for s in names}
    for t0, t1, lab in SECTIONS:
        if t1 - t0 < 1.0:
            continue
        lines.append(f'  {lab:25s} ' + ''.join(f'{loud(skw[s], t0, t1):7.1f}' for s in names))
    lines += NOTES.splitlines()
    return lines, res, nbad


def main():
    t0 = time.time()
    build_banks()
    compose()
    print(f'{len(EV)} events composed')
    bufs = render_all()
    bus, stems = mix(bufs)
    del bufs
    print(f'mixed in {time.time() - t0:.1f} s; bus peak {np.abs(bus).max():.2f}')
    y, g = master(bus)
    y = y[:NS]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    write_wav24(OUT, y)
    yr, info = read_wav24(OUT)
    lines, res, nbad = verify(yr, info, g, stems)
    extra = sys.argv[1] if len(sys.argv) > 1 and os.path.isfile(sys.argv[1]) else None
    with open(REPORT, 'w') as f:
        f.write('\n'.join(lines) + '\n')
        if extra:
            f.write('\n' + open(extra).read())
    print('\n'.join(lines))
    print(f'done in {time.time() - t0:.1f} s')


if __name__ == '__main__':
    main()
