#!/usr/bin/env python3
"""
The sound of WHAT THE PAPER KEPT.

Nothing here is recorded. Every stroke on screen makes its own noise (the film
exports each mark as an event), and under the strokes three kinds of air:

    small   the close, dry, low-voiced air of the small sheet: two reed-like
            tones that swell and settle at their own pace, a fifth apart
    big     the wide, bright, floorless air of the good sheet
    ghost   the small air again, heard through paper

One four-note figure runs through it: three damped touches, then a note that rings.
"""
import os, json, math
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 48000
WORK = os.environ.get('WPK_WORK', '/tmp/claude-0/-home-user-brain/f1f7475c-3827-5141-bc67-2671553b043a/scratchpad/wk')
TM = json.load(open(os.path.join(WORK, 'times.json')))
T_SHEET, T_COVER, T_RUB, T_CUT, T_END = TM['T_SHEET'], TM['T_COVER'], TM['T_RUB'], TM['T_CUT'], TM['T_END']
T_YEARS, YEAR = TM['T_YEARS'], TM['YEAR']
PER_A, PER_B = TM['PER_A'], TM['PER_B']
N = int(T_END * SR)
rng = np.random.default_rng(1234)

G2, D3, B4 = 98.0, 146.83, 493.88
TAP_F = [659.26, 587.33, 440.0]            # E5 D5 A4 : three wrong places
_sos = {}


def bp(x, lo, hi, order=2):
    key = ('bp', lo, hi, order)
    if key not in _sos:
        _sos[key] = butter(order, [lo, hi], btype='band', fs=SR, output='sos')
    return sosfilt(_sos[key], x)


def lp(x, fc, order=2):
    key = ('lp', fc, order)
    if key not in _sos:
        _sos[key] = butter(order, fc, btype='low', fs=SR, output='sos')
    return sosfilt(_sos[key], x, axis=0)


def hp(x, fc, order=2):
    key = ('hp', fc, order)
    if key not in _sos:
        _sos[key] = butter(order, fc, btype='high', fs=SR, output='sos')
    return sosfilt(_sos[key], x, axis=0)


def ease(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def slow_noise(n, rate, depth=1.0):
    """smooth random modulation around 1"""
    k = max(4, int(n / SR * rate) + 4)
    c = rng.standard_normal(k)
    x = np.linspace(0, k - 1.001, n)
    i = x.astype(int); f = x - i
    f = f * f * (3 - 2 * f)
    return 1 + depth * (c[i] * (1 - f) + c[np.minimum(i + 1, k - 1)] * f)


def bell(n, a=0.12, r=0.3):
    t = np.linspace(0, 1, n)
    e = np.minimum(1, t / max(a, 1e-4)) * np.minimum(1, (1 - t) / max(r, 1e-4))
    return np.clip(e, 0, 1) ** 1.2


def add(bus, t, x, pan0=0.0, pan1=None, gain=1.0):
    i0 = int(t * SR)
    if i0 >= N or i0 + len(x) <= 0:
        return
    if i0 < 0:
        x = x[-i0:]; i0 = 0
    n = min(len(x), N - i0)
    x = x[:n] * gain
    if pan1 is None:
        pan1 = pan0
    p = np.linspace(pan0, pan1, n)
    th = (np.clip(p, -1, 1) + 1) * math.pi / 4
    bus[i0:i0 + n, 0] += x * np.cos(th)
    bus[i0:i0 + n, 1] += x * np.sin(th)


# ------------------------------------------------------------------ instruments
def friction(dur, lo, hi, chatter=45, depth=0.35, a=0.12, r=0.3):
    n = max(64, int(dur * SR))
    x = bp(rng.standard_normal(n + 400), lo, hi)[400:]
    return x * bell(n, a, r) * np.clip(slow_noise(n, chatter, depth), 0.1, 2)


def s_pastel(e):
    w = e.get('width', 16)
    broad = w > 30
    dur = max(0.08, e['dur'])
    x = friction(dur, 700 if broad else 1300, 3200 if broad else 5200, chatter=38)
    x += 0.5 * friction(dur, 250, 700, chatter=20) * (1.0 if broad else 0.4)
    return x * 0.085 * e['amp']


def s_arc(e):
    dur = max(0.1, e['dur'])
    x = friction(dur, 1500, 6000, chatter=30, depth=0.25, a=0.2, r=0.4)
    return x * 0.06 * e['amp']


def s_pencil(e):
    dur = max(0.05, e['dur'])
    n = int(dur * SR)
    x = friction(dur, 2600, 7500, chatter=70, depth=0.3, a=0.04, r=0.1)
    x += 0.35 * friction(dur, 900, 1800, chatter=40, a=0.04, r=0.1)
    rate = e.get('rate', 0) or 0
    if rate > 0:
        t = np.arange(n) / SR
        m = np.abs(np.sin(math.pi * rate * t * np.clip(slow_noise(n, 3, 0.15), 0.6, 1.5))) ** 0.6
        x[:n] *= 0.35 + 0.65 * m
    if e.get('fade'):
        x[:n] *= np.linspace(1, 0.12, n) ** 1.4
    return x * 0.075 * e['amp']


def s_slash(e):
    dur = max(0.1, e['dur'])
    n = int((dur + 0.25) * SR)
    t = np.arange(n) / SR
    x = bp(rng.standard_normal(n), 500, 6500) * np.exp(-t / (dur * 0.7)) * np.minimum(1, t / 0.004)
    cr = (rng.uniform(0, 1, n) < 0.004) * rng.standard_normal(n) * 6          # charcoal breaking
    x += bp(cr, 1500, 9000) * np.exp(-t / dur)
    x += 0.9 * np.sin(2 * math.pi * 105 * t) * np.exp(-t / 0.05)                # the table
    return x * 0.16 * e['amp']


def s_bursts(e, lo, hi, each=0.04, level=0.1):
    rate = e.get('rate', 16)
    dur = e['dur']
    n = int((dur + 0.1) * SR)
    x = np.zeros(n)
    k = max(1, int(dur * rate))
    for i in range(k):
        t0 = i / rate + rng.normal(0, 0.004)
        m = int(each * SR)
        b = bp(rng.standard_normal(m + 200), lo, hi)[200:] * bell(m, 0.15, 0.5) * rng.uniform(0.6, 1.1)
        i0 = max(0, int(t0 * SR))
        x[i0:i0 + m] += b[:max(0, min(m, n - i0))]
    return x * level * e['amp']


def s_smudge(e):
    dur = max(0.2, e['dur'])
    x = friction(dur, 120, 650, chatter=8, depth=0.25, a=0.3, r=0.4)
    return x * 0.16 * e['amp']


def s_erase(e):
    dur = max(0.15, e['dur'])
    n = int(dur * SR)
    x = friction(dur, 500, 1700, chatter=14, depth=0.2, a=0.1, r=0.2)
    t = np.arange(n) / SR
    x[:n] *= 0.4 + 0.6 * np.abs(np.sin(math.pi * 9 * t))
    return x * 0.07 * e['amp']


def s_rub(e, k):
    dur = max(0.12, e['dur'])
    lo, hi = (500, 2600) if k % 2 == 0 else (650, 3300)
    x = friction(dur, lo, hi, chatter=55, depth=0.3, a=0.22, r=0.3)
    x += 0.6 * friction(dur, 140, 500, chatter=20, a=0.25, r=0.35)
    return x * 0.085 * e['amp']


def s_tap(f, amp=1.0):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * math.pi * f * t) * np.exp(-t / 0.06)
    x += 0.45 * np.sin(2 * math.pi * 2.01 * f * t) * np.exp(-t / 0.028)
    x += 0.7 * np.sin(2 * math.pi * 132 * t) * np.exp(-t / 0.04)
    c = bp(rng.standard_normal(n), 1500, 6000) * np.exp(-t / 0.004)
    return (x * (1 - np.exp(-t / 0.0015)) + 0.5 * c) * 0.11 * amp


def s_note(f, amp=1.0, bright=1.0, dur=3.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for k, a, d in [(1, 1.0, 1.25), (2, 0.34, 0.75), (3.01, 0.15 * bright, 0.42), (4.21, 0.07 * bright, 0.2), (6.3, 0.05 * bright, 0.09)]:
        x += a * np.sin(2 * math.pi * f * k * t) * np.exp(-t / d)
    x *= (1 - np.exp(-t / 0.002))
    c = bp(rng.standard_normal(n), 2000, 7000) * np.exp(-t / 0.006)
    x += 0.25 * c
    x += 0.5 * np.sin(2 * math.pi * 120 * t) * np.exp(-t / 0.05)
    return x * 0.15 * amp


def reed_breath(f, per, level=1.0, air=0.10, thin=False):
    """one swell of a reed-like tone: in, and out"""
    n = int(per * SR)
    t = np.arange(n) / SR
    ph = t / per
    e = np.where(ph < 0.42, (ph / 0.42) ** 1.4, np.clip((1 - ph) / 0.58, 0, 1) ** 1.7)
    x = np.zeros(n)
    ks = range(1, 4) if thin else range(1, 9)
    for k in ks:
        a = 1.0 / k ** (1.9 if thin else 1.25)
        x += a * np.sin(2 * math.pi * f * k * t + rng.uniform(0, 6.28))
        x += 0.5 * a * np.sin(2 * math.pi * f * 1.0035 * k * t + rng.uniform(0, 6.28))
    x = lp(x, 1500 if not thin else 2500)
    x *= np.clip(slow_noise(n, 5, 0.05), 0.7, 1.3)
    x = x * e * (0.6 + 0.4 * e)
    if air > 0:
        x += air * 6 * bp(rng.standard_normal(n), 350, 1500) * e ** 1.6
    return x * 0.05 * level


def exp_ir(dur, decay, lpf, predelay=0.0, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    ir = np.stack([r.standard_normal(n), r.standard_normal(n)], 1) * np.exp(-t / decay)[:, None]
    ir = lp(ir, lpf)
    pd = int(predelay * SR)
    if pd:
        ir = np.vstack([np.zeros((pd, 2)), ir])
    ir /= np.sqrt((ir ** 2).sum(0)).max()
    return ir


def reverb(x, ir):
    out = np.zeros_like(x)
    for c in range(2):
        out[:, c] = fftconvolve(x[:, c], ir[:, c])[:len(x)]
    return out


# ------------------------------------------------------------------ assemble
def main():
    ev = json.load(open(os.path.join(WORK, 'snd_a.json'))) + json.load(open(os.path.join(WORK, 'snd_b.json')))
    small = np.zeros((N, 2)); small_note = np.zeros((N, 2))
    big = np.zeros((N, 2)); big_wet = np.zeros((N, 2)); close = np.zeros((N, 2))
    ghost = np.zeros((N, 2))
    tt = np.arange(N) / SR

    nlaid = lambda t: min(1.0, 0.25 + 0.75 * sum(1 for x in TM['A_T'] + TM['B_T'] if x < t) / 11.0)
    krub = 0
    for e in ev:
        k = e['kind']; t = e['t']
        p0, p1 = e.get('pan0', e.get('pan', 0)), e.get('pan1', e.get('pan', 0))
        in_small = t < T_COVER + 1.5 and k not in ('arc', 'veil')
        bus = small if in_small else big
        if k == 'pastel':
            add(bus, t, s_pastel(e), p0, p1)
        elif k in ('arc', 'veil'):
            add(big, t, s_arc(e), p0, p1)
        elif k == 'pencil':
            add(bus, t, s_pencil(e), p0, p1, gain=1.0 if in_small else 0.8)
        elif k == 'slash':
            add(bus, t, s_slash(e), p0, p1, gain=1.0 if in_small else 0.5)
        elif k == 'charhatch':
            add(bus, t, s_bursts(e, 700, 6000, 0.05, 0.11), p0, p1)
        elif k == 'hatch':
            add(bus, t, s_bursts(e, 1200, 5000, 0.035, 0.07), p0, p1)
        elif k == 'neat':
            add(bus, t, s_bursts(e, 3000, 8000, 0.014, 0.06), p0, p1)
        elif k == 'dots':
            e2 = dict(e, rate=1 / 0.07)
            add(bus, t, s_bursts(e2, 2000, 6000, 0.02, 0.07), p0, p1)
        elif k == 'smudge':
            add(bus, t, s_smudge(e), p0, p1)
        elif k == 'erase':
            add(big, t, s_erase(e), p0, p1)
        elif k == 'rub':
            add(close, t, s_rub(e, krub), p0, p1); krub += 1
        elif k == 'tap':
            rit = e.get('rit', 0)
            if rit <= 4:
                add(small_note, t, s_tap(TAP_F[e['idx']], e['amp']), p0)
            elif rit == 6:                       # on the good sheet: the same touches, in all that room
                x = s_tap(TAP_F[e['idx']], e['amp'])
                add(big, t, x, p0); add(big_wet, t, x * 0.8, p0)
            elif rit == 7:
                pass
            else:                                # the last time
                add(close, t, s_tap(TAP_F[e['idx']], e['amp'] * 0.95), p0)
        elif k == 'tick':
            rit = e.get('rit', 0)
            x = s_note(B4, e['amp'])
            st = friction(0.16, 900, 4500, a=0.05, r=0.5) * 0.12
            if rit <= 4:
                add(small_note, t, x, p0); add(small, t, st, p0)
            else:
                add(close, t, s_note(B4, 0.85, bright=0.7), p0); add(close, t, st * 0.7, p0)
        elif k == 'tick2':                       # late, twice, too hard, and not quite in tune with itself
            f = B4 * (1.0 if e['idx'] == 0 else 2 ** (42 / 1200))
            x = s_note(f, 0.62, bright=2.2)
            add(big, t, x, p0); add(big_wet, t, x * 0.45, p0)
            add(big, t, friction(0.14, 900, 6000, a=0.03, r=0.5) * 0.25, p0)
        elif k == 'ghostnote':
            add(ghost, t, s_note(B4, 0.5, bright=0.4, dur=2.2), -0.25)
        elif k == 'breathA' and t < T_COVER + 6:
            add(small, t, reed_breath(G2, e['dur'], nlaid(t)), -0.28)
        elif k == 'breathB' and t < T_COVER + 6:
            add(small, t, reed_breath(D3, e['dur'], nlaid(t) * 0.85), 0.28)
        elif k == 'arcA':
            add(big_wet, t, reed_breath(G2 * 2, e['dur'], 0.42 * (1 - 1.2 * e['pale']), air=0.05, thin=True), -0.75)
        elif k == 'arcB':
            add(big_wet, t, reed_breath(D3 * 2, e['dur'], 0.36 * (1 - 1.2 * e['pale']), air=0.05, thin=True), 0.75)
        elif k == 'flicker':
            tr = np.array(e['track'])
            lv = np.interp(tt, np.arange(len(tr)) / 12.0, tr, right=0)
            lv = lp(lv, 60)
            f = 1568.0 * (1 + 0.004 * (1 - np.clip(lv, 0, 1)) * np.sin(2 * math.pi * 31 * tt))
            tone = np.sin(2 * math.pi * np.cumsum(f) / SR) + 0.3 * np.sin(2 * math.pi * 2.005 * np.cumsum(f) / SR)
            d = np.diff(np.clip(lv, 0, 1), prepend=0)
            cr = bp((np.abs(d) > 0.0004) * rng.standard_normal(N), 2500, 9000)
            x = tone * np.clip(lv, 0, 1.6) * 0.0075 + cr * 0.012
            small[:, 0] += x * 0.85; small[:, 1] += x * 0.5
            flick = x

    # ---- the big sheet arriving: three pushes of paper over paper
    n = int(3.6 * SR)
    t = np.arange(n) / SR
    s = 0.40 * ease(t / 0.95) + 0.37 * ease((t - 1.08) / 0.85) + 0.23 * ease((t - 2.05) / 0.95)
    sp = np.gradient(s) * SR
    sp = np.maximum(lp(np.maximum(sp, 0), 12), 0)
    x = bp(rng.standard_normal(n), 250, 5500) * sp * np.clip(slow_noise(n, 30, 0.3), 0.2, 2)
    x += 0.8 * bp(rng.standard_normal(n), 60, 250) * sp
    x += 0.25 * hp(rng.standard_normal(n), 5000) * sp ** 1.5
    add(big, T_SHEET, x * 0.17, 0.8, -0.5)
    th = np.arange(int(0.4 * SR)) / SR
    add(big, T_SHEET + 3.0, np.sin(2 * math.pi * 70 * th) * np.exp(-th / 0.07) * 0.2, -0.2)      # it settles

    # ---- the good sheet's own air: bright, wide, with no floor to it
    pad = np.zeros((N, 2))
    master = (ease((tt - T_COVER - 0.2) / 3.9) * (1 - 0.48 * ease((tt - 34.0) / 5.0))
              * (1 - 0.62 * ease((tt - T_YEARS) / 8.5)) * (1 - ease((tt - T_RUB + 1.5) / 7.0)))
    voices = [(196.0, -0.2, 0.09, 49.0, 0.5), (392.0, -0.5, 0.11, T_YEARS + 4.6, 1.0), (587.33, 0.45, 0.083, T_YEARS + 6.6, 0.9),
              (739.99, 0.1, 0.13, T_YEARS + 2.6, 0.55), (880.0, -0.75, 0.071, T_RUB + 2.0, 0.6), (987.77, 0.7, 0.097, T_YEARS + 1.4, 0.4),
              (1108.73, 0.85, 0.061, T_YEARS + 8.0, 0.33), (1318.51, -0.3, 0.052, T_RUB + 6.0, 0.3)]
    for f, pan, r, t_out, a in voices:
        vib = 1 + 0.0012 * np.sin(2 * math.pi * (4.2 + r * 3) * tt + f)
        ph = 2 * math.pi * np.cumsum(f * vib) / SR
        x = np.sin(ph) + 0.12 * np.sin(2 * ph + 1.0)
        am = master * (0.55 + 0.45 * np.sin(2 * math.pi * r * tt + f * 0.01)) * (1 - ease((tt - t_out) / 3.0)) * a
        th_ = (pan + 1) * math.pi / 4
        pad[:, 0] += x * am * math.cos(th_); pad[:, 1] += x * am * math.sin(th_)
    pad *= 0.020

    # ---- the small air, heard again through the sheet
    t_catch, t_rub_end = TM['t_catch'], TM['t_rub_end']
    tA = T_CUT - 1.5
    while tA > t_catch - PER_A:
        add(ghost, tA, reed_breath(G2, PER_A, 1.0), -0.28); tA -= PER_A
    tB = T_CUT - 3.4
    while tB > t_catch - PER_B:
        add(ghost, tB, reed_breath(D3, PER_B, 0.85), 0.28); tB -= PER_B
    ghost[:, 0] += flick * 1.7; ghost[:, 1] += flick * 1.0
    g_env = (0.30 * ease((tt - t_catch + 0.9) / 0.9) * (1 - 0.45 * ease((tt - t_catch - 0.2) / 1.2))
             + 0.75 * ease((tt - t_catch - 1.3) / (t_rub_end - t_catch - 1.3)))
    g_env = np.clip(g_env, 0, 1.05) * (1 + 0.5 * ease((tt - (T_CUT - 1.5)) / 1.3))
    g_lo = lp(ghost, 520, order=2)
    g_mid = lp(ghost, 1300, order=2)
    openw = (0.25 * ease((tt - t_catch - 1.3) / (t_rub_end - t_catch)) + 0.5 * ease((tt - (T_CUT - 1.5)) / 1.4))[:, None]
    ghost_out = (g_lo * (1 - openw) + g_mid * openw) * g_env[:, None] * 1.5

    # ---- the small bus goes under the sheet
    cov = 0.40 * ease((tt - T_SHEET) / 0.95) + 0.37 * ease((tt - T_SHEET - 1.08) / 0.85) + 0.23 * ease((tt - T_SHEET - 2.05) / 0.95)
    room = exp_ir(0.32, 0.07, 5000, seed=1)
    sm = small + 0.9 * small_note
    sm = sm + 0.22 * reverb(sm, room)
    sm_lp = lp(sm, 430, order=2) * 1.5
    w = cov[:, None]
    fade = (1 - ease((tt - T_COVER - 0.6) / 5.4))[:, None]
    small_out = (sm * (1 - w) + sm_lp * w) * (1 - 0.58 * w) * fade

    hall = exp_ir(3.4, 0.62, 5200, predelay=0.028, seed=2)
    big_all = big + 0.5 * reverb(big * 0.5 + big_wet + pad * 1.3, hall) + big_wet * 0.6 + pad
    close_out = close + 0.10 * reverb(close, room)

    # room tone, so that the silences are a room and the cut is not
    tone = lp(np.stack([rng.standard_normal(N), rng.standard_normal(N)], 1), 500) * 0.0045
    tone += lp(np.stack([rng.standard_normal(N), rng.standard_normal(N)], 1), 5000) * 0.0007

    mix = small_out + big_all + close_out + ghost_out + tone
    mix = hp(mix, 28)
    peak = np.abs(mix).max()
    print('peak before', peak)
    # a slow, transparent limiter: the quiet things come up, the struck notes keep their shape
    from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d
    y = mix / peak * 10 ** (4.5 / 20)
    thr = 0.84
    env = maximum_filter1d(np.abs(y).max(1), size=int(0.008 * SR))
    gain = np.minimum(1.0, thr / np.maximum(env, 1e-9))
    gain = minimum_filter1d(gain, int(0.03 * SR))
    gain = uniform_filter1d(gain, int(0.03 * SR))
    mix = np.clip(y * gain[:, None], -0.97, 0.97)
    icut = int(T_CUT * SR)
    mix[icut:] = 0.0                              # the cut is absolute
    mix[:int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))[:, None]
    out = os.path.join(WORK, 'soundtrack.wav')
    wavfile.write(out, SR, (mix * 32767).astype(np.int16))
    # loudness report in a few windows
    for a, b in [(0, 10), (10, 26), (26, 34), (34, 53), (53, 64), (64, 82), (82, T_CUT)]:
        seg = mix[int(a * SR):int(b * SR)]
        print(f'{a:5.1f}-{b:5.1f}  rms {20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-9):6.1f} dB   peak {20 * np.log10(np.abs(seg).max() + 1e-9):6.1f} dB')
    print('wrote', out)


if __name__ == '__main__':
    main()
