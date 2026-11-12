"""Field Guide film: synthesized score + sound design (no samples). python3 sound.py <seconds> <out.wav>
All cues are in film seconds and match js/film.js. Mastered afterwards with ffmpeg loudnorm."""
import sys, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt

SR = 48000
DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 10.0
OUT = sys.argv[2] if len(sys.argv) > 2 else 'part.wav'
N = int(DUR * SR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)

def t_(d): return np.arange(int(d * SR)) / SR
def add(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N: return
    sig = sig[: max(0, N - i)]
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(sig)] += sig * gain * gl * 1.414; R[i:i + len(sig)] += sig * gain * gr * 1.414
def env(n, a=0.005, d=0.3, curve=4.0):
    tt = np.arange(n) / SR; e = np.minimum(1, tt / max(a, 1e-4)) * np.exp(-tt / max(d, 1e-4) * (curve / 4)); return e
def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], btype='band', fs=SR, output='sos'), x)
def lp(x, f, order=2): return sosfilt(butter(order, f, btype='low', fs=SR, output='sos'), x)
def hp(x, f, order=2): return sosfilt(butter(order, f, btype='high', fs=SR, output='sos'), x)
def noise(d): return rng.standard_normal(int(d * SR))
def mtof(m): return 440 * 2 ** ((m - 69) / 12)

# ---------- instruments ----------
def musicbox(m, d=1.6):
    f = mtof(m); tt = t_(d)
    s = sum(a * np.sin(2 * np.pi * f * h * tt + p) * np.exp(-tt * (2.2 + h * 1.6)) for h, a, p in [(1, 1, 0), (2.0, 0.32, 0.3), (3.01, 0.12, 0.7), (4.2, 0.08, 1.1), (5.4, 0.04, 0.2)])
    return s * np.minimum(1, tt / 0.002)
def pad(ms, d, a=0.6, r=1.2):
    tt = t_(d); s = np.zeros_like(tt)
    for m in ms:
        f = mtof(m)
        for det in (-0.12, 0.0, 0.11): s += np.sin(2 * np.pi * f * (1 + det / 100) * tt + rng.uniform(0, 6)) * 0.33
    e = np.minimum(1, tt / a) * np.minimum(1, (d - tt) / r).clip(0, 1)
    return lp(s * e, 2400) / len(ms)
def bell(m, d=2.0, bright=1.0):
    f = mtof(m); tt = t_(d)
    s = sum(a * np.sin(2 * np.pi * f * h * tt) * np.exp(-tt * k) for h, a, k in [(1, 1, 1.4), (2.76, 0.5 * bright, 2.8), (5.4, 0.25 * bright, 5), (8.9, 0.12 * bright, 8)])
    return s * np.minimum(1, tt / 0.001)

# ---------- score: a music-box lullaby in F, interrupted by the bonk, warming at the look-up ----------
mel = [(0.0, 77), (0.4, 74), (0.8, 72), (1.2, 69), (1.6, 72), (2.0, 74), (2.4, 77)]           # lullaby phrase (asleep)
for at, m in mel: add(musicbox(m), at, 0.22, 0.25)
for at, m in [(0.0, 53), (0.8, 57), (1.6, 60)]: add(musicbox(m, 2.2), at, 0.14, -0.2)
add(pad([53, 60, 65, 69], 2.8, 0.6, 0.6), 0.0, 0.10)
# after the bonk the box restarts, a little curious (3.6 ->)
for at, m in [(3.7, 72), (3.95, 74), (4.2, 77), (4.6, 76), (5.0, 74), (5.4, 72), (5.8, 74), (6.2, 76)]: add(musicbox(m, 1.2), at, 0.15, 0.3)
add(pad([57, 64, 69], 3.0, 0.8, 0.8), 3.6, 0.07)
# look-up at the moon: warm swell and a high sparkle
add(pad([53, 60, 65, 69, 72], 2.4, 0.5, 1.0), 6.75, 0.16)
for k, m in enumerate([84, 88, 91, 96]): add(bell(m, 1.6, 0.7), 6.9 + k * 0.07, 0.07, 0.4 - k * 0.1)
# comedy: the gulp + measuring
add(pad([48, 55], 1.4, 0.2, 0.5), 7.5, 0.08)
# thinking: a gentle low pedal and ticking that becomes chapter I's storm
add(pad([41, 48], 1.4, 0.6, 0.2), 8.8, 0.10)
for k in range(5): add(bp(noise(0.02), 2500, 6000) * env(int(0.02 * SR), 0.0005, 0.006), 9.2 + k * 0.22, 0.22, 0.2)
add(bell(74, 2.0, 0.4), 9.35, 0.08); add(bell(81, 2.0, 0.4), 9.38, 0.05, 0.3)

# ---------- ambience: night insects, the waterfall, a little wind ----------
amb = bp(noise(DUR), 3800, 5200, 4) * (0.5 + 0.5 * np.sin(2 * np.pi * 14 * t_(DUR)) ** 8) * 0.05            # crickets
amb += lp(noise(DUR), 900) * 0.05 + bp(noise(DUR), 1200, 4000) * 0.015                                          # waterfall hiss
add(amb, 0, 0.7, -0.35)
wind = lp(noise(DUR), 400) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.18 * t_(DUR))); add(wind, 0, 0.08, 0.2)

# ---------- foley / sfx ----------
def whoosh(d, f0, f1, g=1.0):
    n = noise(d); tt = t_(d); out = np.zeros_like(n); seg = int(0.01 * SR)
    for i in range(0, len(n), seg):
        f = f0 + (f1 - f0) * (i / len(n)); out[i:i + seg] = bp(n[max(0, i - 200):i + seg], max(80, f * 0.7), f * 1.3)[-len(n[i:i + seg]):]
    return out * np.sin(np.pi * tt / d) ** 1.5 * g
# snores while asleep
for at in (0.15, 1.55):
    d = 0.9; s = lp(noise(d), 500) * np.sin(np.pi * t_(d) / d) ** 2 * (0.6 + 0.4 * np.sin(2 * np.pi * 28 * t_(d))); add(s, at, 0.10, -0.1)
# the paper plane: passes and loops across the moon (pan follows), then dives
add(whoosh(0.7, 500, 1400), 0.15, 0.10, -0.6)
add(whoosh(0.9, 900, 2200), 1.0, 0.13, 0.5)
add(whoosh(0.4, 600, 3000), 2.2, 0.18, 0.1)
# BONK + "!" ding
tt = t_(0.35); bonk = np.sin(2 * np.pi * np.cumsum(np.linspace(820, 180, len(tt))) / SR) * np.exp(-tt * 12)
add(bonk, 2.6, 0.55); add(lp(noise(0.03), 3000) * env(int(0.03 * SR), 0.0005, 0.01), 2.6, 0.5)
add(bell(88, 1.0), 2.68, 0.16, 0.25)
# the leaf blanket flutters off
d = 1.1; fl = bp(noise(d), 1500, 5000) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 11 * t_(d)))) * np.sin(np.pi * t_(d) / d); add(fl, 2.65, 0.05, -0.3)
# plane lands, hops, landing puffs
add(bp(noise(0.05), 1500, 6000) * env(int(0.05 * SR), 0.001, 0.02), 3.12, 0.15, 0.3)
for at in (3.6, 3.9):
    tt = t_(0.18); add(np.sin(2 * np.pi * np.cumsum(np.linspace(260, 520, len(tt))) / SR) * np.exp(-tt * 18), at, 0.18)
for at in (2.98, 3.88, 4.18): add(lp(noise(0.08), 700) * env(int(0.08 * SR), 0.001, 0.03), at, 0.25)
# pick up + unfold the paper
for k in range(6): add(bp(noise(0.05), 2000, 7000) * env(int(0.05 * SR), 0.002, 0.02), 4.25 + k * 0.07 + rng.uniform(0, 0.02), 0.12, 0.2)
# handwriting: a pencil scratch per letter (22 letters over 0.7 s), then the signature swish
for k in range(22): add(bp(noise(0.03), 3000, 9000) * env(int(0.03 * SR), 0.001, 0.012), 4.7 + k * 0.7 / 22, 0.09, 0.05)
add(whoosh(0.25, 2500, 6000), 5.45, 0.06)
for k in range(4): add(bp(noise(0.04), 2000, 7000) * env(int(0.04 * SR), 0.002, 0.015), 6.45 + k * 0.06, 0.09)
# the gulp
tt = t_(0.16); add(np.sin(2 * np.pi * np.cumsum(np.linspace(300, 140, len(tt))) / SR) * np.sin(np.pi * tt / 0.16), 7.55, 0.3)
# plank: wooden knock lifting it, a "plink" when it measures, knock putting it down
def knock(): tt = t_(0.12); return (np.sin(2 * np.pi * 210 * tt) + 0.5 * np.sin(2 * np.pi * 470 * tt)) * np.exp(-tt * 40) + bp(noise(0.12), 800, 3000) * np.exp(-tt * 60) * 0.5
add(knock(), 7.82, 0.35); add(bell(96, 0.6, 0.3), 8.15, 0.12, 0.4); add(knock(), 8.86, 0.3)
tt = t_(0.25); add(np.sin(2 * np.pi * np.cumsum(np.linspace(900, 1300, len(tt))) / SR) * np.sin(np.pi * tt / 0.25) * 0.5, 8.45, 0.06, 0.3)
# the thought cloud puffs into being
add(lp(noise(0.3), 1200) * np.sin(np.pi * t_(0.3) / 0.3), 9.0, 0.12, 0.2)

mix = np.stack([L, R], 1)
mix = mix / (np.max(np.abs(mix)) + 1e-9) * 0.8
sf.write(OUT, mix, SR, subtype='PCM_24')
print('wrote', OUT, mix.shape)
