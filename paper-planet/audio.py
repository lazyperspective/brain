"""Synthesise the 60 s looping soundtrack: music-box waltz + pad, paper foley driven by the same fold
timeline as the picture, and low regional ambience. Everything is written into a circular buffer so the
loop seam is sample-continuous.   python audio.py out/paper_planet_audio.wav"""
import sys, math, wave
import numpy as np

SR = 48000
DUR = 60.0
N = int(SR * DUR)
BPM = 96.0
BEAT = 60.0 / BPM          # 0.625 s
BAR = 3 * BEAT             # 1.875 s -> 32 bars in 60 s
rng = np.random.default_rng(2026)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def add(buf, t0, sig, gain=1.0, pan=0.0):
    """Add mono sig at time t0 (s) into stereo circular buffer with constant-power pan (-1..1)."""
    i0 = int(round(t0 * SR)) % N
    idx = (i0 + np.arange(len(sig))) % N
    a = (pan + 1) * math.pi / 4
    np.add.at(buf[:, 0], idx, sig * (gain * math.cos(a)))
    np.add.at(buf[:, 1], idx, sig * (gain * math.sin(a)))


def fft_filter(x, shape):
    """Circular (loop-safe) filtering: shape(freqs)->gain."""
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(x.shape[0], 1.0 / SR)
    g = shape(f)
    if X.ndim == 2:
        g = g[:, None]
    return np.fft.irfft(X * g, n=x.shape[0], axis=0)


def band(lo, hi, order=2):
    def sh(f):
        f = np.maximum(f, 1e-3)
        return 1.0 / np.sqrt(1 + (lo / f) ** (2 * order)) / np.sqrt(1 + (f / hi) ** (2 * order))
    return sh


def circ_noise(n=N):
    return rng.standard_normal(n)


def lfo(cycles, phase=0.0):
    t = np.arange(N) / SR
    return np.sin(2 * math.pi * (cycles * t / DUR + phase))


def bump(tc, width):
    """Circular smooth bump (0..1) centred on tc seconds."""
    t = np.arange(N) / SR
    d = (t - tc + DUR / 2) % DUR - DUR / 2
    return np.exp(-(d / width) ** 2)


# ----------------------------------------------------------------------------- instruments
def musicbox(freq, dur=2.6, vel=1.0):
    n = int(SR * dur)
    t = np.arange(n) / SR
    parts = [(1.0, 1.0, 1.25), (2.0, 0.42, 0.75), (3.01, 0.20, 0.45), (4.12, 0.12, 0.28), (5.43, 0.07, 0.18), (6.8, 0.035, 0.12)]
    s = np.zeros(n)
    for mult, amp, tau in parts:
        if freq * mult > 16000:
            continue
        s += amp * np.exp(-t / (tau * (0.6 + 0.4 * 440.0 / max(freq, 200)))) * np.sin(2 * math.pi * freq * mult * t)
    att = np.minimum(1.0, t / 0.0025)
    click = rng.standard_normal(n) * np.exp(-t / 0.004) * 0.10
    return (s * att + click) * vel * np.minimum(1.0, (dur - t) / 0.05)


def celesta(freq, dur=2.2, vel=1.0):
    n = int(SR * dur)
    t = np.arange(n) / SR
    s = np.exp(-t / 0.9) * np.sin(2 * math.pi * freq * t) + 0.30 * np.exp(-t / 0.5) * np.sin(2 * math.pi * 2 * freq * t) \
        + 0.10 * np.exp(-t / 0.2) * np.sin(2 * math.pi * 4.02 * freq * t)
    return s * np.minimum(1.0, t / 0.006) * vel * np.minimum(1.0, (dur - t) / 0.05)


def pad_note(freq, dur, detune=0.0):
    n = int(SR * (dur + 1.6))
    t = np.arange(n) / SR
    f = freq * 2 ** (detune / 1200.0)
    s = np.zeros(n)
    for h, a in ((1, 1.0), (2, 0.38), (3, 0.20), (4, 0.09), (5, 0.05)):
        s += a * np.sin(2 * math.pi * f * h * t + h * 0.7)
    env = np.minimum(1.0, t / 0.75) * np.clip((dur + 1.5 - t) / 1.5, 0, 1)
    env = env * env * (3 - 2 * env)
    return s * env


def bass_note(freq, dur=1.8):
    n = int(SR * dur)
    t = np.arange(n) / SR
    s = np.sin(2 * math.pi * freq * t) + 0.35 * np.sin(2 * math.pi * 2 * freq * t) * np.exp(-t / 0.5)
    return s * np.minimum(1.0, t / 0.05) ** 2 * np.exp(-t / 0.9) * np.minimum(1.0, (dur - t) / 0.1)


CH = {
    'D': ([50, 57, 62, 66], 38, [66, 69]), 'Bm': ([47, 54, 59, 62], 35, [62, 66]), 'G': ([43, 50, 55, 59], 43, [62, 67]),
    'A': ([45, 52, 57, 61], 45, [64, 69]), 'A7': ([45, 55, 61, 64], 45, [64, 67]), 'F#m': ([42, 49, 54, 57], 42, [61, 66]),
    'Em': ([40, 47, 52, 55], 40, [64, 67]),
}
PROG = ['D', 'Bm', 'G', 'A', 'D', 'F#m', 'G', 'A7',
        'D', 'Bm', 'G', 'A', 'Em', 'A7', 'D', 'D',
        'G', 'A', 'F#m', 'Bm', 'G', 'Em', 'A', 'A7',
        'D', 'Bm', 'G', 'A', 'Em', 'A7', 'D', 'A7']
MEL = [
    [(0, 78, 2), (2, 81, 1)], [(0, 83, 2), (2, 81, 1)], [(0, 79, 1), (1, 83, 1), (2, 86, 1)], [(0, 85, 2), (2, 81, 1)],
    [(0, 86, 2), (2, 81, 1)], [(0, 78, 1), (1, 81, 1), (2, 85, 1)], [(0, 83, 2), (2, 79, 1)], [(0, 81, 1.5), (1.5, 79, 0.5), (2, 76, 1)],
    [(0, 78, 2), (2, 81, 1)], [(0, 83, 2), (2, 86, 1)], [(0, 88, 1), (1, 86, 1), (2, 83, 1)], [(0, 81, 2), (2, 85, 1)],
    [(0, 83, 1), (1, 79, 1), (2, 76, 1)], [(0, 79, 1), (1, 76, 1), (2, 73, 1)], [(0, 74, 3)], [(1, 78, 1), (2, 81, 1)],
    [(0, 83, 2), (2, 86, 1)], [(0, 88, 2), (2, 85, 1)], [(0, 81, 1), (1, 85, 1), (2, 90, 1)], [(0, 86, 3)],
    [(0, 83, 1), (1, 79, 1), (2, 83, 1)], [(0, 79, 2), (2, 76, 1)], [(0, 81, 1), (1, 85, 1), (2, 88, 1)], [(0, 79, 2), (2, 76, 1)],
    [(0, 78, 2), (2, 81, 1)], [(0, 83, 2), (2, 81, 1)], [(0, 79, 1), (1, 83, 1), (2, 86, 1)], [(0, 85, 2), (2, 88, 1)],
    [(0, 86, 1), (1, 83, 1), (2, 79, 1)], [(0, 81, 1), (1, 79, 1), (2, 76, 1)], [(0, 74, 2), (2, 78, 1)], [(0, 69, 1), (1, 73, 1), (2, 76, 1)],
]


def music():
    dry = np.zeros((N, 2))
    pad = np.zeros((N, 2))
    for b, name in enumerate(PROG):
        t0 = b * BAR
        notes, bass, arp = CH[name]
        section = b // 8
        dyn = [1.0, 1.0, 0.82, 1.0][section]
        for k, m in enumerate(notes):
            for det, pan in ((-5, -0.6), (5, 0.6)):
                add(pad, t0 - 0.25, pad_note(mtof(m), BAR, det), gain=0.024 * (0.7 if k == 0 else 1.0), pan=pan)
        add(dry, t0, bass_note(mtof(bass + 12)), gain=0.085 * dyn, pan=0.0)
        v = 0.075 * dyn
        add(dry, t0 + BEAT + 0.006, celesta(mtof(arp[0])), gain=v, pan=-0.35)
        add(dry, t0 + 2 * BEAT + 0.004, celesta(mtof(arp[1])), gain=v * 0.9, pan=0.35)
        for i, (beat, m, d) in enumerate(MEL[b]):
            vel = (0.27 if beat == 0 else 0.22) * dyn * (1.0 + 0.06 * math.sin(b * 1.7 + i))
            add(dry, t0 + beat * BEAT + 0.004 * math.sin(b * 2.3 + i * 1.1), musicbox(mtof(m), vel=1.0), gain=vel, pan=0.18 * math.sin(b * 0.9 + i * 2.1))
            if section == 2 and beat == 0:      # octave shimmer in the middle phrase
                add(dry, t0 + beat * BEAT + 0.012, musicbox(mtof(m + 12), dur=1.6), gain=vel * 0.25, pan=-0.3)
    pad = fft_filter(pad, band(150, 1800, 2))
    trem = 1.0 + 0.10 * lfo(9, 0.1)
    pad *= trem[:, None]
    return dry, pad


# ----------------------------------------------------------------------------- foley
def rustle(dur, bright=1.0):
    n = int(SR * dur)
    x = rng.standard_normal(n)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1.0 / SR)
    X *= band(1400 * bright, 7500 * bright, 2)(f)
    x = np.fft.irfft(X, n=n)
    t = np.arange(n) / SR
    # crinkle: a handful of random short swells
    env = np.zeros(n)
    k = max(3, int(dur * 9))
    for _ in range(k):
        c = rng.uniform(0.05, 0.85) * dur
        w = rng.uniform(0.02, 0.09)
        env += rng.uniform(0.4, 1.0) * np.exp(-((t - c) / w) ** 2)
    env *= np.sin(math.pi * np.clip(t / dur, 0, 1)) ** 0.7
    return x * env / (np.abs(x * env).max() + 1e-9)


def snap(size):
    n = int(SR * 0.09)
    t = np.arange(n) / SR
    f0 = 1500.0 - 700.0 * min(1.0, size / 0.4)
    tick = rng.standard_normal(n) * np.exp(-t / 0.0035)
    tock = np.sin(2 * math.pi * f0 * t) * np.exp(-t / 0.012) * 0.7 + np.sin(2 * math.pi * f0 * 0.42 * t) * np.exp(-t / 0.022) * 0.5
    s = tick * 0.8 + tock
    return s / np.abs(s).max()


def foley():
    from pp import scene
    from pp.core import LON0
    from pp.mech import DEG_PER_S
    sc = scene.Scene()
    buf = np.zeros((N, 2))
    count = 0
    for p in sc.pieces:
        if getattr(p, 'quiet', False):
            continue
        t_open, t_lock, t_close, size, lat, lon = p.events()
        g = min(1.0, (size / 0.3)) ** 0.6
        d_in = p.dur_in / DEG_PER_S
        add(buf, t_open, rustle(d_in * 0.9 + 0.3), gain=0.12 * g, pan=-0.55 + 0.2 * math.sin(lat))
        add(buf, t_lock, snap(size), gain=0.14 * g, pan=-0.45 + 0.2 * math.sin(lat * 0.7))
        add(buf, t_close, rustle(p.dur_out / DEG_PER_S * 0.8, bright=0.7), gain=0.06 * g, pan=0.5)
        count += 1
    return buf, count


# ----------------------------------------------------------------------------- ambience
def tcen(lon):
    from pp.core import LON0
    return ((LON0 - lon) / 6.0) % DUR


def chirp(f0, f1, dur, wob=0.0):
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = f0 + (f1 - f0) * (t / dur) + wob * np.sin(2 * math.pi * 28 * t)
    ph = 2 * math.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.sin(math.pi * t / dur) ** 2


def ambience():
    buf = np.zeros((N, 2))
    # sea: slow swells, always present, deeper over the open oceans
    sea = np.stack([circ_noise(), circ_noise()], 1)
    sea = fft_filter(sea, band(180, 900, 2))
    swell = 0.55 + 0.45 * (0.5 + 0.5 * lfo(7, 0.2)) * (0.5 + 0.5 * lfo(11, 0.6))
    g_sea = 0.30 + 0.9 * (bump(tcen(-150), 6.0) + 0.7 * bump(tcen(-30), 3.5) + 0.6 * bump(tcen(75), 3.5) + 0.5 * bump(tcen(175), 3.0))
    buf += sea * (swell * g_sea)[:, None] * 0.030
    hiss = np.stack([circ_noise(), circ_noise()], 1)
    hiss = fft_filter(hiss, band(1800, 6000, 1))
    foam = np.clip(lfo(13, 0.3), 0, 1) ** 2 * (0.5 + 0.5 * lfo(5, 0.9))
    buf += hiss * (foam * g_sea)[:, None] * 0.006
    # wind for the poles and the high mountains
    wind = np.stack([circ_noise(), circ_noise()], 1)
    wind = fft_filter(wind, band(260, 1100, 2))
    g_wind = bump(tcen(-40) - 1.5, 3.5) + bump(tcen(-150) - 1.0, 4.5) + 0.7 * bump(tcen(85) - 1.0, 3.0) + 0.5 * bump(tcen(170), 4.0)
    gust = 0.55 + 0.45 * lfo(8, 0.4) * lfo(3, 0.1)
    buf += wind * (g_wind * gust)[:, None] * 0.030
    # aurora shimmer: a faint glassy cluster
    t = np.arange(N) / SR
    for tc, pan in ((tcen(-40) - 1.5, 0.2), (tcen(-150) - 1.0, 0.25)):
        env = bump(tc, 3.0)
        for k, m in enumerate((93, 98, 102, 105)):
            f = mtof(m)
            cyc = round(f * DUR) / DUR        # whole cycles per loop keeps it seamless
            s = np.sin(2 * math.pi * cyc * t) * (0.5 + 0.5 * lfo(20 + 7 * k, 0.13 * k))
            buf[:, 0] += s * env * 0.0030 * (1 - pan)
            buf[:, 1] += s * env * 0.0030 * (1 + pan)
    # birdsong where the land is alive
    def birds(tc, width, n, f_lo, f_hi, gain, kind=0):
        for i in range(n):
            tt = tc + rng.normal(0, width)
            f0 = rng.uniform(f_lo, f_hi)
            reps = rng.integers(2, 5)
            for r in range(reps):
                if kind == 0:
                    c = chirp(f0, f0 * rng.uniform(1.15, 1.5), rng.uniform(0.05, 0.11))
                elif kind == 1:
                    c = chirp(f0 * 1.3, f0 * 0.8, rng.uniform(0.08, 0.16), wob=120)
                else:
                    c = chirp(f0, f0 * 1.05, rng.uniform(0.12, 0.2), wob=220)
                add(buf, tt + r * rng.uniform(0.11, 0.2), c, gain=gain * rng.uniform(0.5, 1.0), pan=rng.uniform(-0.7, 0.7))
    birds(tcen(18), 2.6, 16, 2600, 4200, 0.010, 0)        # Europe / Africa
    birds(tcen(28) + 1.0, 2.2, 10, 1800, 2600, 0.008, 2)  # savanna
    birds(tcen(-62), 2.4, 22, 2400, 4800, 0.011, 1)       # Amazon
    birds(tcen(-95), 2.4, 10, 2800, 4000, 0.008, 0)       # North America
    birds(tcen(110), 2.6, 14, 3000, 4600, 0.009, 0)       # East Asia
    birds(tcen(135) + 1.5, 2.2, 10, 2000, 3200, 0.009, 1)  # Oceania
    # whale song over the Pacific
    for tt, f0, f1, d in ((28.9, 190, 300, 2.4), (31.6, 280, 210, 2.0), (33.8, 170, 250, 2.6), (5.0, 220, 300, 2.0), (49.5, 200, 270, 2.2)):
        n = int(SR * d)
        tq = np.arange(n) / SR
        f = f0 + (f1 - f0) * (tq / d) ** 1.5 + 6 * np.sin(2 * math.pi * 5.5 * tq)
        s = np.sin(2 * math.pi * np.cumsum(f) / SR) * np.sin(math.pi * tq / d) ** 1.5
        s += 0.3 * np.sin(4 * math.pi * np.cumsum(f) / SR) * np.sin(math.pi * tq / d) ** 2
        add(buf, tt, s, gain=0.020, pan=rng.uniform(-0.3, 0.3))
    return buf


def reverb(x, rt=2.3, wet=0.3, seed=3):
    r = np.random.default_rng(seed)
    n = int(SR * rt * 1.4)
    t = np.arange(n) / SR
    ir = r.standard_normal((n, 2)) * np.exp(-6.9 * t / rt)[:, None]
    ir[: int(0.012 * SR)] *= 0.2
    pad = np.zeros((N, 2))
    pad[:n] = ir
    pad = fft_filter(pad, band(250, 5200, 1))
    X = np.fft.rfft(x, axis=0)
    H = np.fft.rfft(pad, axis=0)
    y = np.fft.irfft(X * H, n=N, axis=0)
    y *= wet / (np.sqrt((ir ** 2).sum(0)).mean())
    return x + y


def main(out):
    dry, pad = music()
    fol, count = foley()
    amb = ambience()
    mus = reverb(dry, 2.4, 0.34) + reverb(pad, 2.8, 0.25, seed=5) * 1.0
    amb = amb * 1.8
    mix = mus + reverb(fol, 1.2, 0.16, seed=7) + reverb(amb, 2.0, 0.18, seed=9)
    mix = fft_filter(mix, band(45, 17000, 3))
    # gentle soft-knee saturation, then normalise to -1.5 dBFS (oversampled peak)
    pk = np.abs(mix).max()
    mix = mix / pk * 0.9
    mix = np.tanh(mix * 1.15) / np.tanh(1.15)
    X = np.fft.rfft(mix, axis=0)
    up = np.fft.irfft(np.concatenate([X, np.zeros((X.shape[0] * 3, 2), complex)], 0), n=N * 4, axis=0) * 4
    tp = np.abs(up).max()
    target = 10 ** (-1.5 / 20)
    mix *= target / tp
    print('events', count, 'true peak dBFS %.2f' % (20 * math.log10(np.abs(up).max() * target / tp)),
          'rms dBFS %.1f' % (20 * math.log10(np.sqrt((mix ** 2).mean()))))
    for name, part in (('music', mus), ('foley', fol), ('ambience', amb)):
        print(' stem %-9s rms %.1f dB rel. mix' % (name, 20 * math.log10(np.sqrt((part ** 2).mean()) / np.sqrt(((mus + fol + amb) ** 2).mean()))))
    print('seam: |x[0]-x[-1]| = %.5f, median |dx| = %.5f, max |dx| = %.5f' % (
        np.abs(mix[0] - mix[-1]).max(), np.median(np.abs(np.diff(mix, axis=0))), np.abs(np.diff(mix, axis=0)).max()))
    def write(m):
        pcm = (np.clip(m, -1, 1) * 32767.0).astype('<i2')
        with wave.open(out, 'wb') as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())

    def lufs():
        import subprocess, re
        r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', out, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                           capture_output=True, text=True).stderr
        tail = r[r.rindex('Summary:'):]
        return float(re.search(r'I:\s+(-?[\d.]+) LUFS', tail).group(1)), float(re.search(r'Peak:\s+(-?[\d.]+) dBFS', tail).group(1))

    write(mix)
    i0, p0 = lufs()
    target = -17.5
    g = min(10 ** ((target - i0) / 20), 10 ** ((-1.5 - p0) / 20))
    mix = mix * g
    write(mix)
    i1, p1 = lufs()
    print('loudness: %.1f LUFS integrated, true peak %.2f dBFS (before trim: %.1f LUFS, %.2f dBFS)' % (i1, p1, i0, p0))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'out/paper_planet_audio.wav')
