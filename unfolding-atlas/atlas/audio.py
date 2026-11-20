"""Soft synthesised foley: paper rustle, board whoosh, little lock-open snaps, biome ambience."""
import numpy as np
from scipy import signal
import wave

SR = 48000


def _bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype='band', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def _lp(x, hi, order=2):
    return signal.sosfilt(signal.butter(order, hi, btype='low', fs=SR, output='sos'), x)


def _hp(x, lo, order=2):
    return signal.sosfilt(signal.butter(order, lo, btype='high', fs=SR, output='sos'), x)


def _env(n, pts):
    """Piecewise-linear envelope from (time, value) points."""
    t = np.arange(n) / SR
    return np.interp(t, [p[0] for p in pts], [p[1] for p in pts])


def _place(buf, x, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= buf.shape[0] or i < 0:
        return
    n = min(len(x), buf.shape[0] - i)
    buf[i:i + n, 0] += x[:n] * gain * (1 - max(pan, 0) * 0.7)
    buf[i:i + n, 1] += x[:n] * gain * (1 + min(pan, 0) * 0.7)


def snap(rng, f=2600, dur=0.07, bright=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    click = rng.standard_normal(n) * np.exp(-t * 260)
    click = _bp(click, f * 0.6, min(f * 2.2, 15000))
    body = np.sin(2 * np.pi * f * 0.31 * t) * np.exp(-t * 90) * 0.5
    tick = np.zeros(n)
    tick[:6] = [0.0, 1.0, -0.8, 0.4, -0.2, 0.1]
    return (click * 1.5 + body + _lp(tick, 6000) * 1.2 * bright) * 0.6


def rustle(rng, dur, env_pts, lo=1800, hi=9000, crackle=18):
    n = int(dur * SR)
    e = _env(n, env_pts)
    base = _bp(rng.standard_normal(n), lo, hi) * e
    # slow flutter so it sounds like a moving sheet rather than hiss
    base *= 0.6 + 0.4 * np.abs(_lp(rng.standard_normal(n), 14)) / 0.02
    out = base * 0.13
    for _ in range(int(crackle * dur)):
        t0 = rng.uniform(0, dur)
        k = int(t0 * SR)
        a = e[min(k, n - 1)] * rng.uniform(0.3, 1.0)
        m = int(rng.uniform(0.004, 0.02) * SR)
        if k + m >= n:
            continue
        tt = np.arange(m) / SR
        out[k:k + m] += _hp(rng.standard_normal(m), 2500)[:m] * np.exp(-tt * rng.uniform(200, 600)) * a * 0.3
    return out


def thump(rng, f=85, dur=0.28, air=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * (f + 40 * np.exp(-t * 30)) * t) * np.exp(-t * 22)
    s += _lp(rng.standard_normal(n), 900) * np.exp(-t * 45) * air
    return s * 0.6


def chirp(rng, f0, f1, dur, vib=0.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f0 + (f1 - f0) * (t / dur) + vib * np.sin(2 * np.pi * 28 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.sin(np.pi * t / dur) ** 1.5


def ambience(rng, dur, kind='day'):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for ch in range(2):
        fall = _bp(rng.standard_normal(n), 350, 3800) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.23 * t + ch))
        hiss = _bp(rng.standard_normal(n), 4500, 9000) * 0.25
        out[:, ch] += (fall * 0.5 + hiss) * 0.2
    # river trickle: tiny bubbly blips
    for _ in range(int(dur * 22)):
        f = rng.uniform(900, 2800)
        d = rng.uniform(0.012, 0.035)
        _place(out, chirp(rng, f, f * rng.uniform(1.1, 1.5), d) * rng.uniform(0.02, 0.05), rng.uniform(0, dur - 0.05), 1.0, rng.uniform(-0.6, 0.6))
    if kind == 'night':
        cr = np.sin(2 * np.pi * 4300 * t) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 38 * t))) * (0.5 + 0.5 * np.sin(2 * np.pi * 1.9 * t) > 0.55)
        cr2 = np.sin(2 * np.pi * 5200 * t) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 31 * t))) * (0.5 + 0.5 * np.sin(2 * np.pi * 1.3 * t + 1) > 0.6)
        out[:, 0] += _lp(cr, 7000) * 0.012
        out[:, 1] += _lp(cr2, 7000) * 0.01
        for t0 in np.arange(0.6, dur - 0.5, 1.7):
            fr = chirp(rng, 420, 520, 0.11) * (1 + 0.6 * np.sin(2 * np.pi * 70 * np.arange(int(0.11 * SR)) / SR))
            _place(out, fr * 0.035, t0 + rng.uniform(0, 0.4), 1.0, rng.uniform(-0.5, 0.5))
    else:
        tb = 0.3
        while tb < dur - 0.6:
            pan = rng.uniform(-0.7, 0.7)
            style = rng.integers(0, 3)
            g = rng.uniform(0.035, 0.07)
            if style == 0:
                for k in range(rng.integers(2, 5)):
                    _place(out, chirp(rng, rng.uniform(3200, 4200), rng.uniform(2400, 3000), 0.07) * g, tb + k * 0.11, 1.0, pan)
            elif style == 1:
                _place(out, chirp(rng, 2200, 3600, 0.22, 180) * g, tb, 1.0, pan)
            else:
                for k in range(3):
                    _place(out, chirp(rng, 4800 - 300 * k, 5200 - 300 * k, 0.05) * g * 0.8, tb + k * 0.075, 1.0, pan)
            tb += rng.uniform(0.5, 1.3)
        ins = _bp(rng.standard_normal(n), 6500, 8500) * (0.5 + 0.5 * np.sin(2 * np.pi * 23 * t)) * 0.012
        out[:, 0] += ins
        out[:, 1] += np.roll(ins, 700)
    return out


def make_track(ev, path, kind='day', seed=1, snap_pitch=1.0, twos=False):
    rng = np.random.default_rng(seed)
    dur = ev['total']
    n = int(dur * SR)
    buf = np.zeros((n, 2))
    # room tone
    for ch in range(2):
        buf[:, ch] += _lp(rng.standard_normal(n), 400) * 0.006
    # thin leaf: lift rustle, swish, soft landing
    L = ev['leaf1'] - ev['leaf0']
    r = rustle(rng, L + 0.2, [(0, 0), (0.08, 0.7), (0.3 * L, 0.45), (0.55 * L, 1.0), (0.85 * L, 0.5), (L, 0.25), (L + 0.2, 0)], crackle=26)
    _place(buf, r, ev['leaf0'], 0.5, -0.1)
    sw = rustle(rng, L, [(0, 0), (0.45 * L, 0.1), (0.7 * L, 1.0), (L, 0)], 500, 3000, crackle=0)
    _place(buf, sw, ev['leaf0'], 0.35, 0.2)
    _place(buf, thump(rng, 120, 0.2, 0.9) * 0.25, ev['leaf1'] - 0.04, 1.0, 0.3)
    _place(buf, rustle(rng, 0.25, [(0, 0.8), (0.25, 0)], 2500, 9000, 30), ev['leaf1'] - 0.03, 0.25, 0.3)
    # board: lift creak, whoosh with unfolding ticks, landing
    O = ev['land'] - ev['open0']
    wh = rustle(rng, O, [(0, 0), (0.15 * O, 0.25), (0.5 * O, 1.0), (0.8 * O, 0.6), (O, 0.05)], 300, 2200, crackle=0)
    _place(buf, wh, ev['open0'], 0.45, 0.0)
    cr = rustle(rng, O, [(0, 0.0), (0.2 * O, 0.5), (0.6 * O, 1.0), (O, 0.3)], 1500, 8000, crackle=34)
    _place(buf, cr, ev['open0'], 0.3, 0.0)
    for k in range(9):
        tt = ev['open0'] + O * rng.uniform(0.25, 0.95)
        _place(buf, snap(rng, rng.uniform(1700, 3200) * snap_pitch, 0.05) * rng.uniform(0.1, 0.22), tt, 1.0, rng.uniform(-0.5, 0.5))
    _place(buf, thump(rng, 78, 0.3, 0.7) * 0.42, ev['land'] - 0.02, 1.0, -0.25)
    # locks: small snaps as the pieces pop upright
    for i, tl in enumerate(ev['locks']):
        _place(buf, snap(rng, rng.uniform(2000, 3800) * snap_pitch, 0.07) * rng.uniform(0.28, 0.42), tl + 0.02, 1.0, rng.uniform(-0.6, 0.6))
    # ambience swells in with life
    amb = ambience(rng, dur - ev['life'] + 0.6, kind)
    e = _env(len(amb), [(0, 0), (1.6, 1.0), (dur, 1.0)])[:, None]
    i0 = int((ev['life'] - 0.6) * SR)
    m = min(len(amb), n - i0)
    buf[i0:i0 + m] += (amb * e)[:m]
    # master: gentle fades, soft clip
    fade = np.ones(n)
    k = int(0.25 * SR)
    fade[:k] = np.linspace(0, 1, k)
    fade[-int(0.6 * SR):] = np.linspace(1, 0, int(0.6 * SR))
    buf *= fade[:, None]
    buf = np.tanh(buf * 2.2) / 2.2 * 2.0
    pk = np.abs(buf).max()
    if pk > 0.5:
        buf *= 0.5 / pk
    pcm = (np.clip(buf, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return path
