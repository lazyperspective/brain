"""Ink Bloom - fully synthesised score + sound design (numpy only).

28.0 s loop, 68.57 BPM (beat 0.875 s), 8 bars of 4/4 in D major.  Everything is
written into a circular buffer and the reverb is a circular (FFT) convolution, so
the last sample flows into the first with no seam.
"""
import os, sys, subprocess, re
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TMP = os.path.join(ROOT, "tmp")
sys.path.insert(0, HERE)
from events import BUBBLES, BEAT, BAR, CYC, T, LEAD, ENTRY_X, ENTRY2_X

SR = 48000
N = int(T * SR)
rng = np.random.default_rng(1234)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def add(buf, t0, sig, pan=0.0, gain=1.0):
    """add mono sig at time t0 (s) with wrap-around, constant-power pan (-1..1)."""
    i0 = int(round(t0 * SR)) % N
    n = len(sig)
    idx = (i0 + np.arange(n)) % N
    th = (pan + 1) * np.pi / 4
    np.add.at(buf[:, 0], idx, sig * np.cos(th) * gain)
    np.add.at(buf[:, 1], idx, sig * np.sin(th) * gain)


def env_ar(n, a, r):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    e[:na] = 0.5 - 0.5 * np.cos(np.pi * np.arange(na) / max(na, 1))
    e[n - nr:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(nr) / max(nr, 1))
    return e


def loop_noise(color=1.0, lo=20.0, hi=20000.0, seed=0):
    """perfectly loopable coloured noise of length N (spectral synthesis)."""
    r = np.random.default_rng(seed)
    f = np.fft.rfftfreq(N, 1 / SR)
    mag = np.zeros_like(f)
    m = (f >= lo) & (f <= hi)
    mag[m] = 1.0 / np.maximum(f[m], 1.0) ** (color / 2.0)
    spec = mag * np.exp(1j * r.uniform(0, 2 * np.pi, len(f)))
    x = np.fft.irfft(spec, N)
    return x / np.sqrt(np.mean(x ** 2))


def shape_spec(x, fn):
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(np.fft.rfft(x) * fn(f), len(x))


# ------------------------------------------------------------------ instruments
def felt_piano(m, dur=4.5, vel=0.7):
    f0 = mtof(m)
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    B = 0.00035
    bright = 0.95 + 0.6 * vel
    for k in range(1, 9):
        fk = k * f0 * np.sqrt(1 + B * k * k)
        if fk > 7000:
            break
        amp = (1.0 / k ** (2.1 - 0.5 * bright)) * (0.6 if k % 2 == 0 else 1.0)
        dec = (1.9 / (1 + 0.45 * (k - 1))) * (1.0 + 60.0 / f0 * 0.4)
        out += amp * np.exp(-t / dec) * np.sin(2 * np.pi * fk * t + rng.uniform(0, 0.4))
    # two-stage decay + soft felt attack
    out *= (0.72 * np.exp(-t / 0.9) + 0.28)
    att = int(0.012 * SR)
    out[:att] *= np.sin(0.5 * np.pi * np.arange(att) / att) ** 2
    # hammer thump
    nt = int(0.05 * SR)
    th = rng.standard_normal(nt) * np.exp(-np.arange(nt) / (0.008 * SR))
    th = shape_spec(th, lambda f: 1 / (1 + (f / 500.0) ** 2))
    out[:nt] += 0.12 * vel * th / (np.abs(th).max() + 1e-9)
    out *= env_ar(n, 0.0, 0.5)
    return out * vel


def kalimba(m, dur=3.2, vel=0.7):
    f0 = mtof(m)
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.sin(2 * np.pi * f0 * t) * np.exp(-t / 1.1)
    out += 0.22 * np.sin(2 * np.pi * 2.0 * f0 * t) * np.exp(-t / 0.5)
    out += 0.16 * np.sin(2 * np.pi * 5.42 * f0 * t) * np.exp(-t / 0.06)
    out += 0.07 * np.sin(2 * np.pi * 8.9 * f0 * t) * np.exp(-t / 0.03)
    att = int(0.004 * SR)
    out[:att] *= np.arange(att) / att
    out *= env_ar(n, 0.0, 0.4)
    return out * vel


def pad_note(m, dur, cents=0.0, seed=0):
    r = np.random.default_rng(seed)
    f0 = mtof(m) * 2 ** (cents / 1200.0)
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    vib = 1 + 0.0016 * np.sin(2 * np.pi * r.uniform(0.15, 0.3) * t + r.uniform(0, 6.28))
    ph = 2 * np.pi * np.cumsum(f0 * vib) / SR
    for k in range(1, 9):
        if k * f0 > 2400:
            break
        out += (1.0 / k ** 1.5) * np.exp(-k * f0 / 1500.0) * np.sin(k * ph + r.uniform(0, 6.28))
    return out


def plink(f0=1100.0, f1=2500.0, dur=0.26, tau=0.05):
    """water-drop plink: the pinched-off bubble rings up in pitch while it decays."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f0 + (f1 - f0) * (1 - np.exp(-t / 0.035))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t / tau)
    att = int(0.002 * SR)
    x[:att] *= np.arange(att) / att
    return x


def thup(f0=150.0, f1=62.0, dur=0.32, tau=0.09):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.04)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / tau)
    x[:96] *= np.arange(96) / 96
    return x


def noise_burst(dur, lo, hi, tau, seed):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    x = r.standard_normal(n)
    x = shape_spec(x, lambda f: ((f > lo) & (f < hi)) * 1.0)
    t = np.arange(n) / SR
    x *= np.exp(-t / tau)
    x[:48] *= np.arange(48) / 48
    return x / (np.abs(x).max() + 1e-9)


def blip(f, dur=0.03, up=1.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    fr = f * (1 + (up - 1) * t / dur)
    x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.sin(np.pi * t / dur) ** 2
    return x


def swept_noise(dur, f_start, f_end, q, seed, rise=True):
    """band-passed noise whose centre frequency glides (state-variable filter)."""
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    x = r.standard_normal(n)
    fc = f_start * (f_end / f_start) ** (np.arange(n) / n)
    out = np.zeros(n)
    lp = bp = 0.0
    g = 2 * np.sin(np.pi * fc / SR)
    for i in range(n):
        hp = x[i] - lp - q * bp
        bp += g[i] * hp
        lp += g[i] * bp
        out[i] = bp
    return out / (np.abs(out).max() + 1e-9)


# ------------------------------------------------------------------ composition
def build():
    dry = np.zeros((N, 2))      # goes straight to the mix
    rev = np.zeros((N, 2))      # reverb send
    # chords: (bass, pad notes, arp notes)
    #            bar: 1 Gmaj7      2 Dmaj9        3 Em9          4 Bm7(11)      5 Gmaj9        6 A6sus        7 Em9          8 Dmaj9(6)
    bass = [43, 38, 40, 35, 43, 45, 40, 38]
    pads = [[55, 59, 62, 66], [50, 57, 61, 64, 66], [52, 59, 62, 66, 67], [47, 54, 57, 62, 64],
            [55, 59, 62, 66, 69], [57, 62, 64, 66, 71], [52, 55, 59, 62, 66], [50, 57, 59, 61, 64, 66]]
    arps = [[59, 62, 66, 71, 74], [57, 62, 64, 66, 73], [59, 62, 64, 67, 71], [59, 62, 64, 66, 69],
            [59, 62, 66, 69, 74], [57, 61, 64, 66, 71], [55, 59, 62, 66, 67], [57, 61, 64, 66, 69]]
    # melody (kalimba), (bar, beat, midi, vel)
    mel = [(0, 0, 78, .62), (0, 3, 74, .5),
           (1, 0, 76, .8), (1, 2, 69, .5), (1, 3.5, 73, .42),
           (2, 0, 79, .6), (2, 3, 76, .5),
           (3, 0, 78, .8), (3, 2, 74, .5), (3, 3.5, 71, .42),
           (4, 0, 83, .6), (4, 2.5, 81, .45), (4, 3, 78, .5),
           (5, 0, 76, .8), (5, 2, 78, .5), (5, 3.5, 76, .42),
           (6, 0, 79, .62), (6, 2, 83, .5), (6, 3, 79, .45),
           (7, 0, 81, .9), (7, 1, 78, .45), (7, 2, 86, .55), (7, 3, 81, .4), (7, 3.5, 78, .36)]
    arp_pat = [(0, 0, .62), (1, 2, .46), (1.5, 1, .40), (2, 3, .50), (3, 2, .42), (3.5, 4, .36)]
    for b in range(8):
        t0 = b * BAR
        land = (b % 2 == 1)
        # ---- pad (overlapping swells)
        dur = BAR + 2.2
        for j, m in enumerate(pads[b]):
            for d, pan in ((-7, -0.6), (6, 0.6), (0, 0.0)):
                x = pad_note(m, dur, d, seed=b * 100 + j * 7 + int(d) + 50) * env_ar(int(dur * SR), 1.5, 2.0)
                add(dry, t0 - 0.9, x, pan, 0.021 * (1.15 if land else 1.0))
                add(rev, t0 - 0.9, x, -pan, 0.012)
        # ---- bass (soft, two partials so it survives small speakers)
        n = int((BAR + 0.6) * SR)
        tt = np.arange(n) / SR
        f0 = mtof(bass[b])
        bx = (np.sin(2 * np.pi * f0 * tt) + 0.34 * np.sin(2 * np.pi * 2 * f0 * tt) + 0.12 * np.sin(2 * np.pi * 3 * f0 * tt)) * env_ar(n, 0.25, 0.9)
        add(dry, t0, bx, 0.0, 0.068)
        # ---- felt piano arpeggio
        for beat, k, vel in arp_pat:
            if land and beat == 0:
                # the picture lands: softly rolled chord
                for q, m in enumerate(arps[b][:4]):
                    x = felt_piano(m, 5.0, 0.58 + 0.05 * q)
                    add(dry, t0 + q * 0.035, x, -0.3 + 0.2 * q, 0.14)
                    add(rev, t0 + q * 0.035, x, 0.3 - 0.2 * q, 0.09)
                continue
            m = arps[b][k]
            x = felt_piano(m, 4.0, vel)
            hum = rng.uniform(-0.008, 0.012)
            add(dry, t0 + beat * BEAT + hum, x, (k - 2) * 0.22, 0.14)
            add(rev, t0 + beat * BEAT + hum, x, -(k - 2) * 0.22, 0.08)
        # low piano root on the downbeat
        x = felt_piano(bass[b] + 12, 5.0, 0.5)
        add(dry, t0, x, -0.1, 0.085)
        add(rev, t0, x, 0.1, 0.04)
    for b, beat, m, vel in mel:
        x = kalimba(m, 3.4, vel)
        tt = b * BAR + beat * BEAT + rng.uniform(-0.004, 0.01)
        add(dry, tt, x, 0.25 * np.sin(b * 1.7 + beat), 0.125)
        add(rev, tt, x, -0.25 * np.sin(b * 1.7 + beat), 0.12)

    # ---- low hum (D pedal) with slow breathing
    t = np.arange(N) / SR
    hum = 0.50 * np.sin(2 * np.pi * mtof(26) * t) + 0.36 * np.sin(2 * np.pi * mtof(38) * t + 0.4) + 0.10 * np.sin(2 * np.pi * mtof(45) * t)
    # N*f/SR must be an integer for a seamless wrap: nudge each partial to the nearest loop harmonic
    hum = np.zeros(N)
    for m, a in ((26, 0.50), (38, 0.36), (45, 0.10), (50, 0.05)):
        f = round(mtof(m) * T) / T
        hum += a * np.sin(2 * np.pi * f * t + m)
    breath = 0.78 + 0.22 * np.sin(2 * np.pi * 4 * t / T - 1.2)       # one breath per picture
    dry[:, 0] += 0.036 * hum * breath
    dry[:, 1] += 0.036 * hum * breath

    # ---- underwater hush (loopable spectral noise, slowly moving)
    for ch, sd in ((0, 31), (1, 32)):
        deep = loop_noise(2.0, 30, 700, sd)
        mid = loop_noise(1.2, 300, 2600, sd + 10)
        air = loop_noise(0.6, 2500, 9000, sd + 20)
        lfo1 = 0.75 + 0.25 * np.sin(2 * np.pi * 3 * t / T + ch * 1.3)
        lfo2 = 0.6 + 0.4 * np.sin(2 * np.pi * 5 * t / T + 2.0 + ch * 0.7)
        dry[:, ch] += 0.036 * deep * lfo1 + 0.017 * mid * lfo2 + 0.0055 * air * lfo1

    # ---- per-picture sound design
    for k in range(4):
        tc = k * CYC
        root = bass[2 * k + 1]
        # main drop: plink on the bar line (the drop itself touches the surface 4 frames earlier)
        pan = (ENTRY_X[k] - 720) / 700.0
        fpl = mtof(86 + [0, -2, 2, -5][k])
        for (tt, f, g, pn) in ((tc, fpl, 1.0, pan), (tc + 2 * BEAT, fpl * 1.335, 0.62, (ENTRY2_X[k] - 720) / 600.0)):
            p = plink(f * 0.55, f, 0.30, 0.055)
            add(dry, tt, p, pn, 0.21 * g)
            add(rev, tt, p, -pn, 0.16 * g)
            add(dry, tt - 0.012, thup(), pn * 0.5, 0.20 * g)
            sp = noise_burst(0.22, 1800, 7500, 0.045, 400 + k)
            add(dry, tt - LEAD * 0.8, sp, pn, 0.05 * g)       # the splash itself, at the visual impact
            add(rev, tt - LEAD * 0.8, sp, -pn, 0.030 * g)
            # gurgle of entrained bubbles
            for i in range(9):
                bl = blip(rng.uniform(700, 2100), rng.uniform(0.018, 0.04), rng.uniform(1.2, 1.9))
                add(dry, tt + 0.02 + rng.uniform(0, 0.30), bl, pn + rng.uniform(-0.2, 0.2), 0.034 * g)
        # the picture forms: low swell rising to the landing (beat 4)
        dur = 2 * BEAT + 0.15
        n = int(dur * SR)
        tt_ = np.arange(n) / SR
        rise = (tt_ / dur) ** 2.4
        sw = swept_noise(dur, 140, 720, 0.9, 70 + k) * rise
        sw[-int(0.15 * SR):] *= np.linspace(1, 0, int(0.15 * SR))
        add(dry, tc + 2 * BEAT - 0.0, sw, 0.0, 0.050)
        add(rev, tc + 2 * BEAT - 0.0, sw, 0.0, 0.06)
        f = mtof(root)
        sub = (np.sin(2 * np.pi * f * tt_) + 0.5 * np.sin(2 * np.pi * 2 * f * tt_) + 0.25 * np.sin(2 * np.pi * 3 * f * tt_)) * rise
        sub[-int(0.15 * SR):] *= np.linspace(1, 0, int(0.15 * SR))
        add(dry, tc + 2 * BEAT, sub, 0.0, 0.085)
        air = swept_noise(dur, 2500, 6500, 1.2, 90 + k) * rise
        air[-int(0.15 * SR):] *= np.linspace(1, 0, int(0.15 * SR))
        add(rev, tc + 2 * BEAT, air, 0.0, 0.020)
        # landing: soft deep bloom + airy shimmer tail
        tl = tc + 4 * BEAT
        add(dry, tl, thup(95, 48, 0.9, 0.28), 0.0, 0.26 if k < 3 else 0.32)
        sh = noise_burst(1.6, 3000, 9000, 0.45, 600 + k)
        add(rev, tl, sh, 0.0, 0.035 if k < 3 else 0.05)
        # dissolve on the next bar line: soft falling whoosh
        wh = swept_noise(1.5, 1500, 260, 1.1, 120 + k) * np.sin(np.pi * np.linspace(0, 1, int(1.5 * SR)) ** 0.6) ** 2
        add(dry, tc + CYC - 0.10, wh, 0.0, 0.030)
        add(rev, tc + CYC - 0.10, wh, 0.0, 0.045)
    # ---- bubble pops at the surface
    for b in BUBBLES:
        tp = b["t0"] + b["life"]
        f = 5200.0 / b["r"] ** 0.75
        pn = np.clip((b["x0"] - 720) / 600.0, -0.9, 0.9)
        g = 0.046 * (b["r"] / 5.0) ** 0.7 * (0.7 if b["chain"] else 1.0)
        bl = blip(f, 0.022 + 0.004 * b["r"], 1.6)
        add(dry, tp, bl, pn, g)
        add(rev, tp, bl, -pn, g * 1.2)

    # ---- reverb: circular convolution with a synthetic, damped stereo impulse response
    ir_len = int(4.0 * SR)
    ti = np.arange(ir_len) / SR
    wet = np.zeros((N, 2))
    for ch in range(2):
        r = np.random.default_rng(900 + ch)
        ir = np.zeros(ir_len)
        for lo, hi, rt in ((60, 400, 3.4), (400, 1500, 2.8), (1500, 4000, 1.9), (4000, 12000, 1.0)):
            nb = r.standard_normal(ir_len)
            nb = shape_spec(nb, lambda f: ((f >= lo) & (f < hi)) * 1.0)
            ir += nb * np.exp(-6.91 * ti / rt)
        pre = int(0.028 * SR)
        ir = np.concatenate([np.zeros(pre), ir[:-pre]])
        ir[pre:pre + 480] *= np.linspace(0, 1, 480)
        ir /= np.sqrt(np.sum(ir ** 2))
        IR = np.fft.rfft(np.concatenate([ir, np.zeros(N - ir_len)]))
        wet[:, ch] = np.fft.irfft(np.fft.rfft(rev[:, ch]) * IR, N)
        cross = np.fft.irfft(np.fft.rfft(rev[:, 1 - ch]) * IR, N)
        wet[:, ch] += 0.35 * cross
    mix = dry + 0.95 * wet
    # gentle "underwater" tilt + rumble filter
    for ch in range(2):
        mix[:, ch] = shape_spec(mix[:, ch], lambda f: (f / np.sqrt(f ** 2 + 24.0 ** 2)) ** 2 * (1.0 / np.sqrt(1 + (f / 11500.0) ** 4)) * (1.0 + 0.55 * f ** 2 / (f ** 2 + 2600.0 ** 2)))
    return mix


def soft_limit(x, ceil):
    """transparent soft clip toward `ceil` (linear)."""
    a = np.abs(x)
    knee = 0.6 * ceil
    over = a > knee
    y = x.copy()
    y[over] = np.sign(x[over]) * (knee + (ceil - knee) * np.tanh((a[over] - knee) / (ceil - knee)))
    return y


def measure(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    tail = r[r.rfind("Summary:"):]
    I = float(re.search(r"I:\s+(-?[\d.]+) LUFS", tail).group(1))
    LRA = float(re.search(r"LRA:\s+(-?[\d.]+) LU", tail).group(1))
    TP = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", tail).group(1))
    return I, LRA, TP


if __name__ == "__main__":
    out = os.path.join(TMP, "ink_bloom.wav")
    cache = os.path.join(TMP, "mix_raw.npy")
    if os.path.exists(cache) and "--remix" not in sys.argv:
        mix = np.load(cache)
    else:
        mix = build()
        np.save(cache, mix)
    target = float(os.environ.get("LUFS", "-14.0"))
    ceil_db = float(os.environ.get("CEIL", "-2.2"))
    gain = 0.5 / np.abs(mix).max()
    for it in range(6):
        y = soft_limit(mix * gain, 10 ** (ceil_db / 20))
        sf.write(out, y.astype(np.float32), SR, subtype="PCM_24")
        I, LRA, TP = measure(out)
        print(f"iter {it}: gain {20 * np.log10(gain):+.2f} dB -> I {I:.2f} LUFS, LRA {LRA:.1f}, TP {TP:.2f} dBTP", flush=True)
        if abs(I - target) < 0.05:
            break
        gain *= 10 ** ((target - I) / 20)
    # loop-seam check: sample continuity across the wrap
    d_seam = np.abs(y[0] - y[-1]).max()
    d_typ = np.abs(np.diff(y, axis=0)).max()
    print(f"seam step {d_seam:.5f} vs max in-loop step {d_typ:.5f}")
