"""Soundtrack for the X cut (pp/xcut.py): a 23.4 s loop that is sample-continuous at the seam.
The v3 music box, celesta, pad and bass in D major, still a waltz but at 100 BPM (beat 0.6 s = 18 frames), 13
bars on a grid whose first downbeat is the burst (0.8 s). Every voice, every reverb and every filter is built
circularly on the loop's own length, so the end runs straight into the start.
    python audio_x.py [out/paper_planet_x_audio.wav]"""
import sys, math, wave, subprocess, re
import numpy as np
sys.path.insert(0, '.')
import audio as A                 # the v3 instruments (music box, celesta, pad, bass, paper rustle and snap)
from audio import musicbox, celesta, pad_note, bass_note, rustle, snap, band, mtof, CH
from pp import xcut

SR = A.SR
L = xcut.LOOP
N = int(round(L * SR))            # 1,123,200 samples
BEAT, BAR = xcut.BEAT, xcut.BAR
rng = np.random.default_rng(77)


def bar_t(b):
    return xcut.G0 + b * BAR


def add(buf, t0, sig, gain=1.0, pan=0.0):
    """Add mono sig at t0 (s) with constant-power pan, wrapping round the loop."""
    sig = np.asarray(sig, float)
    i0 = int(round(t0 * SR))
    idx = (i0 + np.arange(len(sig))) % N
    pan = max(-1.0, min(1.0, pan))
    a = (pan + 1) * math.pi / 4
    np.add.at(buf[:, 0], idx, sig * gain * math.cos(a))
    np.add.at(buf[:, 1], idx, sig * gain * math.sin(a))


def cfilt(x, shape):
    X = np.fft.rfft(x, axis=0)
    g = shape(np.fft.rfftfreq(x.shape[0], 1.0 / SR))
    return np.fft.irfft(X * (g[:, None] if X.ndim == 2 else g), n=x.shape[0], axis=0)


def creverb(x, rt=2.2, wet=0.3, seed=3):
    """Circular convolution reverb: the tail of the last bar rings on into the first."""
    r = np.random.default_rng(seed)
    n = int(SR * rt * 1.4)
    t = np.arange(n) / SR
    ir = r.standard_normal((n, 2)) * np.exp(-6.9 * t / rt)[:, None]
    ir[: int(0.012 * SR)] *= 0.2
    pad = np.zeros((N, 2))
    pad[:n] = ir
    pad = cfilt(pad, band(250, 5200, 1))
    y = np.fft.irfft(np.fft.rfft(x, axis=0) * np.fft.rfft(pad, axis=0), n=N, axis=0)
    return x + y * wet / np.sqrt((ir ** 2).sum(0)).mean()


def noise(dur, lo, hi):
    n = int(SR * dur)
    x = rng.standard_normal(n)
    x = np.fft.irfft(np.fft.rfft(x) * band(lo, hi, 2)(np.fft.rfftfreq(n, 1.0 / SR)), n=n)
    return x / (np.abs(x).max() + 1e-9)


# ----------------------------------------------------------------------------- the score (13 bars of 3/4)
# Picture: 0 the burst (crowned by bar 1) | 1-3 one bar per close-up (Eiffel, great wave, aurora) | 4-5 a
# hemiola, three 2-beat shots across two bars (pyramids, Liberty, Taj) | 6-7 one shot a beat (Machu Picchu,
# Big Ben, Kilimanjaro, Opera House) and the whale leaving the water | 8 the top of the leap on the downbeat |
# 8 beat 3 - 9 the flurry, half-beat cuts, a climbing run | 10 the crowned globe on the tonic | 11 plagal, the
# globe turning | 12 the dominant under the fold, leading back to the burst.
SCORE = [
    ('D',   [(0, 86, 2), (2, 81, 1)],                                     1.00, 'pbcr'),
    ('Bm',  [(0, 83, 2), (2, 81, 1)],                                     0.84, 'pbc'),
    ('G',   [(0, 79, 1), (1, 83, 1), (2, 86, 1)],                          0.86, 'pbc'),
    ('A',   [(0, 85, 2), (2, 81, 1)],                                     0.88, 'pbc'),
    ('D',   [(0, 81, 2), (2, 83, 2)],                                     0.90, 'pbch'),   # hemiola: 2+2+2 beats
    ('F#m', [(1, 85, 2)],                                                 0.92, 'pbch'),
    ('G',   [(0, 88, 1), (1, 86, 1), (2, 83, 1)],                          0.95, 'pbce'),
    ('A7',  [(0, 85, 1), (1, 88, 1), (2, 91, 1)],                          0.98, 'pbce'),
    ('D',   [(0, 86, 2), (2, 81, 0.5), (2.5, 85, 0.5)],                    1.06, 'pbco'),   # the whale tops out
    ('A7',  [(0, 86, .5), (.5, 88, .5), (1, 89, .5), (1.5, 91, .5), (2, 93, .5), (2.5, 95, .5)], 1.12, 'pbe'),
    ('D',   [(0, 98, 3)],                                                 1.25, 'pbcro'),  # crowned: the tonic
    ('G',   [(0, 83, 2), (2, 79, 1)],                                     0.92, 'pbc'),
    ('A7',  [(0, 85, 1), (1, 79, 1), (2, 81, 1)],                          0.86, 'pb'),     # the fold, back to the burst
]


def music():
    dry = np.zeros((N, 2))
    pad = np.zeros((N, 2))
    for b, (name, mel, dyn, fl) in enumerate(SCORE):
        t0 = bar_t(b)
        notes, bass, arp = CH[name]
        if 'p' in fl:
            for k, m in enumerate(notes):
                for det, pan in ((-5, -0.6), (5, 0.6)):
                    add(pad, t0 - 0.2, pad_note(mtof(m), BAR, det), gain=0.024 * (0.7 if k == 0 else 1.0) * min(1.2, dyn), pan=pan)
        if 'b' in fl:
            if 'h' in fl:      # hemiola: the bass walks in 2-beat steps across the two bars
                offs = (0, 2) if b == 4 else (1,)
                for o in offs:
                    add(dry, t0 + o * BEAT, bass_note(mtof(bass + 12), dur=1.4), gain=0.085 * dyn)
            else:
                add(dry, t0, bass_note(mtof(bass + 12), dur=3.0 if b == 10 else 1.8), gain=0.088 * min(1.15, dyn))
                if b == 10:
                    add(dry, t0, bass_note(mtof(bass), dur=3.0), gain=0.06)
        if 'c' in fl:
            v = 0.075 * min(1.15, dyn)
            add(dry, t0 + BEAT + 0.006, celesta(mtof(arp[0])), gain=v, pan=-0.35)
            add(dry, t0 + 2 * BEAT + 0.004, celesta(mtof(arp[1])), gain=v * 0.9, pan=0.35)
        if 'e' in fl:
            tones = [notes[1] + 24, notes[2] + 24, notes[3] + 12, notes[2] + 24]
            for q, off in enumerate((0.5, 1.5, 2.5)):
                add(dry, t0 + off * BEAT, celesta(mtof(tones[(b + q) % 4]), dur=1.0), gain=0.032 * dyn, pan=0.5 * math.sin(b + q * 2.0))
        if 'r' in fl:
            roll = [n + 12 for n in notes] + [n + 24 for n in notes[1:]]
            for q, m in enumerate(sorted(roll)):
                add(dry, t0 - 0.02 + 0.035 * q, musicbox(mtof(m), dur=3.0), gain=0.10 * dyn, pan=-0.6 + 1.2 * q / len(roll))
        for i, (bt, m, d) in enumerate(mel):
            vel = (0.27 if bt == 0 else 0.22) * dyn * (1.0 + 0.06 * math.sin(b * 1.7 + i))
            if b == 9:
                vel *= 0.8 + 0.08 * i          # the flurry's run climbs and swells
            add(dry, t0 + bt * BEAT + 0.003 * math.sin(b * 2.3 + i * 1.1), musicbox(mtof(m), dur=2.4), gain=vel,
                pan=0.18 * math.sin(b * 0.9 + i * 2.1))
            if 'o' in fl and bt == 0:
                add(dry, t0 + 0.012, musicbox(mtof(m + 12), dur=1.6), gain=vel * 0.3, pan=-0.3)
    pad = cfilt(pad, band(150, 1800, 2))
    return dry, pad


# ----------------------------------------------------------------------------- picture-synced sound
def thump(f0=60.0, f1=95.0, dur=0.6, tau=0.16):
    n = int(SR * dur)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * np.cumsum(f0 + (f1 - f0) * np.exp(-t / 0.05)) / SR) * np.exp(-t / tau) * np.minimum(1, t / 0.003)


def flutter(dur, rate=22.0):
    """Many paper flaps: band noise amplitude-modulated at a wobbling flap rate."""
    n = int(SR * dur)
    t = np.arange(n) / SR
    x = noise(dur, 700, 6500)
    ph = 2 * np.pi * np.cumsum(rate * (1 + 0.3 * np.sin(2 * np.pi * 1.7 * t))) / SR
    return x * (0.45 + 0.55 * np.abs(np.sin(ph))) * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.8


def foley(ev):
    buf = np.zeros((N, 2))
    # the burst: an in-breath of air, a paper whump on the downbeat and a flutter as the wave spreads
    n = int(SR * 0.6); t = np.arange(n) / SR
    add(buf, 0.22, noise(0.6, 400, 5000) * (t / 0.6) ** 2.5, gain=0.10)
    add(buf, xcut.G0 - 0.004, thump(55, 110, 0.7, 0.18), gain=0.30)
    add(buf, xcut.G0, noise(0.5, 120, 1800) * np.exp(-np.arange(int(SR * 0.5)) / SR / 0.09), gain=0.14)
    add(buf, 0.45, flutter(1.5, 24.0), gain=0.11, pan=-0.25)
    add(buf, 0.55, flutter(1.4, 19.0), gain=0.11, pan=0.25)
    # every piece: a rustle as it lifts, a snap as it locks; the fold ticks each one flat again
    for kind, lift, lock, size, pan, g in ev:
        if kind == 'burst':
            add(buf, lock, snap(size), gain=0.055 * g, pan=pan)
        elif kind == 'close':
            d = max(0.12, min(0.7, lock - lift + 0.15))
            add(buf, lift, rustle(d, 1.05), gain=0.10 * g, pan=pan)
            add(buf, lock, snap(size), gain=0.17 * g, pan=pan)
        elif kind == 'fold':
            add(buf, lock - 0.01, snap(size * 1.5), gain=0.035 * g, pan=pan)
    # the fold: a reversed rustle swelling into the moment the map lies flat, and a soft settle
    t_flat = max(e[2] for e in ev if e[0] == 'fold')
    r = rustle(1.0, 0.9)[::-1] * np.linspace(0.2, 1.0, int(SR * 1.0)) ** 2
    add(buf, t_flat - 1.0, r, gain=0.16, pan=-0.15)
    r2 = flutter(0.9, 20.0)[::-1] * np.linspace(0.1, 1.0, int(SR * 0.9)) ** 1.5
    add(buf, t_flat - 0.9, r2, gain=0.09, pan=0.2)
    add(buf, t_flat, thump(70, 90, 0.35, 0.07), gain=0.07)
    # the flurry: an air riser climbing into the slam on the crowned globe
    t0, t1 = xcut.beat(26), xcut.beat(xcut.CROWN_BEAT)
    d = t1 - t0
    n = int(SR * d); t = np.arange(n) / SR
    x = rng.standard_normal(n)
    from scipy.signal import stft, istft
    f, tt, Z = stft(x, SR, nperseg=2048, noverlap=1536)
    fc = 500 * (6.0 ** (tt / d))
    Z *= np.exp(-0.5 * (np.log(np.maximum(f, 20)[:, None] / fc[None, :]) / 0.5) ** 2)
    _, y = istft(Z, SR, nperseg=2048, noverlap=1536)
    y = y[:n] / (np.abs(y[:n]).max() + 1e-9) * (t / d) ** 2.2
    add(buf, t0, y, gain=0.16)
    # the slam back to the crowned globe: a broad paper whoomp under the resolving roll
    add(buf, t1 - 0.003, thump(48, 80, 0.9, 0.25), gain=0.22)
    add(buf, t1, noise(1.2, 300, 4000) * np.exp(-np.arange(int(SR * 1.2)) / SR / 0.25), gain=0.06)
    return buf


def whale_fx():
    """The breach, on the whale shot's elastic clock: rush out of the water, a call, the splash and drops."""
    sh = xcut.WHALE
    tpk = xcut.beat(sh['peak_beat'])

    def cut(t_src):
        return tpk + (t_src - xcut.core.BREACH_PEAK) / sh['rate']
    from pp.travellers import breach_times
    _, t_up, t_down = breach_times()
    up, down = cut(t_up), cut(t_down)
    buf = np.zeros((N, 2))
    n = int(SR * 1.0); t = np.arange(n) / SR
    add(buf, up - 0.05, noise(1.0, 250, 4000) * np.minimum(1, t / 0.04) * np.exp(-t / 0.3), gain=0.13, pan=-0.15)
    add(buf, up, rustle(0.7, 0.9), gain=0.08, pan=-0.2)
    dd = down - up - 0.3; n = int(SR * dd); t = np.arange(n) / SR
    fq = 140 + 80 * np.sin(np.pi * t / dd) + 4 * np.sin(2 * np.pi * 4.5 * t)
    ph = 2 * np.pi * np.cumsum(fq) / SR
    add(buf, up + 0.25, (np.sin(ph) + 0.35 * np.sin(2 * ph)) * np.sin(np.pi * t / dd) ** 1.4, gain=0.04)
    add(buf, down, thump(55, 85, 1.2, 0.22), gain=0.26, pan=0.1)
    n = int(SR * 1.6); t = np.arange(n) / SR
    add(buf, down, noise(1.6, 200, 5500) * np.minimum(1, t / 0.008) * (0.7 * np.exp(-t / 0.16) + 0.3 * np.exp(-t / 0.6)), gain=0.17, pan=0.2)
    add(buf, down + 0.03, rustle(1.0, 1.0), gain=0.10, pan=0.25)
    for k in range(12):
        add(buf, down + 0.18 + rng.uniform(0, 0.5), snap(0.04) * 0.6, gain=0.03 * rng.uniform(0.4, 1.0), pan=rng.uniform(-0.2, 0.6))
    return buf


def ambience():
    t = np.arange(N) / SR
    buf = np.zeros((N, 2))
    sea = cfilt(rng.standard_normal((N, 2)), band(180, 900, 2))
    swell = 0.6 + 0.4 * np.sin(2 * np.pi * t / (L / 4)) ** 2           # whole cycles per loop: seamless
    buf += sea * swell[:, None] * 0.012
    # aurora shimmer under the aurora shot
    a0, a1 = xcut.beat(9), xcut.beat(12)
    env = np.exp(-((t - 0.5 * (a0 + a1)) / 0.9) ** 2)
    for k, m in enumerate((93, 98, 102, 105)):
        s = np.sin(2 * np.pi * mtof(m) * t) * (0.5 + 0.5 * np.sin(2 * np.pi * t / (0.9 + 0.3 * k) + k))
        buf += (s * env * 0.003)[:, None]
    # birds over the crowned globe
    for i in range(10):
        tt = xcut.beat(30) + rng.uniform(0.3, 3.2)
        f0 = rng.uniform(2400, 4200)
        for rr in range(rng.integers(2, 4)):
            n = int(SR * rng.uniform(0.05, 0.1)); tq = np.arange(n) / SR
            c = np.sin(2 * np.pi * np.cumsum(np.linspace(f0, f0 * 1.3, n)) / SR) * np.sin(np.pi * tq / tq[-1]) ** 2
            add(buf, tt + rr * 0.14, c, gain=0.007, pan=rng.uniform(-0.7, 0.7))
    return buf


def lufs(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    tail = r[r.rindex('Summary:'):]
    return float(re.search(r'I:\s+(-?[\d.]+) LUFS', tail).group(1)), float(re.search(r'Peak:\s+(-?[\d.]+) dBFS', tail).group(1))


def limit(x, ceiling, os_=4):
    """Circular look-ahead peak limiter on the 4x oversampled signal (so it bounds true peak)."""
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    X = np.fft.rfft(x, axis=0)
    up = np.fft.irfft(np.concatenate([X, np.zeros((X.shape[0] * (os_ - 1), 2), complex)], 0), n=len(x) * os_, axis=0) * os_
    a = np.abs(up).max(1)
    g = np.minimum(1.0, ceiling / np.maximum(a, 1e-9))
    w = int(0.003 * SR * os_)            # 3 ms look-ahead: the moving average of a min-held gain never exceeds
    g = uniform_filter1d(-maximum_filter1d(-g, 2 * w + 1, mode='wrap'), w, mode='wrap')   # what each sample needs
    R = int(0.025 * SR * os_)            # and a slower, smoother layer so it does not flutter
    g2 = uniform_filter1d(-maximum_filter1d(-g, 2 * R + 1, mode='wrap'), R, mode='wrap')
    g = np.minimum(g, 0.5 * (g + g2))
    g = g.reshape(-1, os_).min(1)
    return x * g[:, None]


def write(path, m):
    pcm = (np.clip(m, -1, 1) * 32767.0).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main(out):
    from pp import scene
    xc = xcut.XCut(scene.Scene(), 'x')
    ev = xcut.events(xc)
    dry, pad = music()
    fol = foley(ev) + whale_fx()
    amb = ambience()
    mus = creverb(dry, 2.2, 0.32) + creverb(pad, 2.6, 0.25, seed=5)
    mix = mus + creverb(fol, 1.0, 0.14, seed=7) + creverb(amb, 1.8, 0.15, seed=9)
    mix = cfilt(mix, band(40, 17000, 3))
    for name, part in (('music', mus), ('foley', fol), ('ambience', amb)):
        print(' stem %-9s rms %.1f dB rel. mix' % (name, 20 * math.log10(np.sqrt((part ** 2).mean()) / np.sqrt((mix ** 2).mean()))))
    mix *= 0.25 / np.sqrt((mix ** 2).mean())
    target = -14.8
    for it in range(4):
        m = limit(mix, 10 ** (-1.25 / 20))
        write(out, m)
        i0, p0 = lufs(out)
        print('  pass %d: %.2f LUFS, true peak %.2f dBFS' % (it, i0, p0))
        if abs(i0 - target) < 0.15 and p0 <= -1.0:
            break
        mix *= 10 ** ((target - i0) / 20)
    print('events: %d burst, %d close-up, %d fold' % tuple(sum(1 for e in ev if e[0] == k) for k in ('burst', 'close', 'fold')))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'out/paper_planet_x_audio.wav')
