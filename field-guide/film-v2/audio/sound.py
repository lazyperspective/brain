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
WARP = [[0,0],[3.2,2.6],[5.15,4.55],[6.3,5.7],[8.3,6.0],[9.0,6.7],[10.1,7.8],[11.6,8.9],[12.7,10.0],[14.6,11.9],[17.6,14.3],[19.6,16.3],[21.4,17.6],[21.8,18.0],[23.25,19.45],[24.6,19.8],[24.8,20.0]]
def unwarp(t):   # story time -> real time (v2 holds for reading)
    if t >= 20.0: return 24.8 + (t - 20.0)
    for (T0, t0), (T1, t1) in zip(WARP, WARP[1:]):
        if t <= t1: return T0 + (T1 - T0) * (t - t0) / (t1 - t0)
    return t
def add(sig, at, gain=1.0, pan=0.0):
    at = unwarp(at)
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

# ====================== PART 2 (10–20 s): the storm, the dial, the first plank ======================
if DUR > 12.7:
    # tension: plucked minor figure that speeds up as the thinking runs away
    at, step, k = 10.5, 0.42, 0
    fig = [62, 65, 69, 65, 62, 64, 65, 64]
    while at < 14.3:
        add(musicbox(fig[k % len(fig)] - 12, 0.6), at, 0.16, -0.3 + 0.6 * (k % 2)); k += 1; at += step; step = max(0.11, step * 0.93)
    add(pad([38, 45, 50], 4.2, 1.5, 0.6), 10.6, 0.16)
    # storm rumble (sub + filtered noise), growing, gone when it deflates
    d = 6.4; tt = t_(d); grow = np.clip((tt - 0.5) / 3.2, 0, 1) ** 1.5 * np.clip((5.9 - tt) / 0.6, 0, 1)
    rum = (lp(noise(d), 160) * 0.7 + np.sin(2 * np.pi * 46 * tt) * 0.25) * grow; add(rum, 10.4, 0.5)
    # gears ticking faster and faster
    at, gap = 11.4, 0.2
    while at < 16.3:
        add(bp(noise(0.015), 3000, 8000) * env(int(0.015 * SR), 0.0003, 0.004), at, 0.16, 0.4 * np.sin(at * 7)); at += gap; gap = max(0.055, gap * 0.96)
    # soft thunder with each lightning flicker
    for at in (12.7, 13.6, 14.15):
        d = 1.4; tt = t_(d); add(lp(noise(d), 300) * np.exp(-tt * 2.2) * np.minimum(1, tt / 0.02), at, 0.5, 0.2)
        add(bp(noise(0.08), 1500, 6000) * env(int(0.08 * SR), 0.0005, 0.02), at, 0.12)
    # question marks plinking
    for k, at in enumerate(np.arange(12.4, 16.2, 0.37)): add(bell(88 + (k * 5) % 7, 0.3, 0.3), at, 0.03, np.sin(k))
    # the hand descends out of the dark; suspense pad underneath
    add(whoosh(0.9, 180, 700, 1.0), 14.25, 0.25, -0.5); add(pad([41, 48, 53], 2.2, 0.4, 0.8), 14.4, 0.12)
    tt = t_(0.25); add(np.sin(2 * np.pi * np.cumsum(np.linspace(400, 900, len(tt))) / SR) * np.sin(np.pi * tt / 0.25), 14.6, 0.08)     # dial pops in
    # three detent clicks: HIGH -> MED
    for at in (15.55, 15.75, 15.95):
        add(bp(noise(0.02), 2000, 9000) * env(int(0.02 * SR), 0.0003, 0.006), at, 0.5, -0.5)
        tt = t_(0.06); add(np.sin(2 * np.pi * 120 * tt) * np.exp(-tt * 70), at, 0.4, -0.5)
    # the storm deflates like a balloon
    d = 0.75; tt = t_(d); f = np.linspace(950, 180, len(tt)) * (1 + 0.04 * np.sin(2 * np.pi * 22 * tt))
    add((np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.3 + np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.7) * np.sin(np.pi * tt / d) * 0.6, 16.3, 0.2, 0.3)
    add(lp(noise(0.7), 900) * np.sin(np.pi * t_(0.7) / 0.7), 16.35, 0.12, 0.3)
    # the moon comes back: warm major chord, sparkle; the idea: lightbulb ding
    add(pad([53, 60, 65, 69, 72], 3.2, 0.35, 1.2), 16.85, 0.17)
    for k, m in enumerate([84, 89, 93, 96, 101]): add(bell(m, 1.2, 0.6), 16.95 + k * 0.05, 0.05, -0.4 + k * 0.2)
    add(bell(93, 1.4, 1.0), 17.15, 0.2, 0.3); add(bell(105, 0.8, 0.4), 17.17, 0.07, 0.3)
    tt = t_(0.06); add(lp(noise(0.06), 3000) * np.exp(-tt * 60), 17.47, 0.25, 0.3)                                                    # the idea puff pops
    # bright, faster music-box: it knows what to do
    for k, (at, m) in enumerate([(17.3, 72), (17.5, 76), (17.7, 79), (17.9, 84), (18.2, 81), (18.4, 79), (18.6, 76), (18.8, 79), (19.0, 81), (19.25, 84)]): add(musicbox(m, 1.0), at, 0.15, 0.25 - 0.05 * k)
    add(pad([60, 64, 67, 72], 2.8, 0.4, 0.8), 17.4, 0.08)
    # idea hop, plank pick-up, three hops carrying it
    tt = t_(0.18); add(np.sin(2 * np.pi * np.cumsum(np.linspace(300, 640, len(tt))) / SR) * np.exp(-tt * 16), 17.3, 0.18)
    add(knock(), 17.62, 0.3, -0.2)
    for at in (18.0, 18.33, 18.66):
        tt = t_(0.16); add(np.sin(2 * np.pi * np.cumsum(np.linspace(240, 480, len(tt))) / SR) * np.exp(-tt * 18), at, 0.14, 0.2)
        add(lp(noise(0.06), 700) * env(int(0.06 * SR), 0.001, 0.025), at + 0.3, 0.2, 0.2)
    # PLANK ONE: a satisfying wooden thunk and a small reward chime
    tt = t_(0.3); add((np.sin(2 * np.pi * 150 * tt) + 0.6 * np.sin(2 * np.pi * 330 * tt) + 0.3 * np.sin(2 * np.pi * 610 * tt)) * np.exp(-tt * 22) + bp(noise(0.3), 400, 2500) * np.exp(-tt * 35) * 0.6, 19.22, 0.5, 0.35)
    for k, m in enumerate([79, 84, 88]): add(bell(m, 1.4, 0.6), 19.3 + k * 0.08, 0.09, 0.3)
    # chapter II card
    add(bell(84, 1.6, 0.3), 19.5, 0.035)

# ====================== PART 3 (story 20–34.5): dig, silence, updates, the bridge climbs ======================
if DUR > 24.8:
    for k, (at, m) in enumerate([(20.0, 72), (20.25, 76), (20.5, 79), (20.75, 76), (21.0, 74), (21.3, 72), (21.6, 74), (21.9, 76), (22.2, 74), (22.5, 72)]): add(musicbox(m, 0.9), at, 0.12, 0.2 * np.sin(k))
    for at in (20.4, 20.67, 20.94):
        tt = t_(0.16); add(np.sin(2 * np.pi * np.cumsum(np.linspace(240, 480, len(tt))) / SR) * np.exp(-tt * 18), at, 0.13, -0.2)
    tt = t_(0.3); add(np.sin(2 * np.pi * 2400 * tt) * np.exp(-tt * 12) * 0.5 + bp(noise(0.3), 3000, 9000) * np.exp(-tt * 25) * 0.4, 21.2, 0.12, -0.3)  # pickaxe "shing"
    for s0 in (21.4, 21.85, 22.3):   # swing whoosh + clink + dirt
        add(whoosh(0.3, 400, 1500), s0 + 0.1, 0.06, -0.3)
        tt = t_(0.25); add((np.sin(2 * np.pi * 1850 * tt) + 0.6 * np.sin(2 * np.pi * 2730 * tt)) * np.exp(-tt * 30), s0 + 0.42, 0.2, -0.3)
        add(lp(noise(0.35), 1800) * np.exp(-t_(0.35) * 12), s0 + 0.43, 0.22, -0.3)
    add(whoosh(0.25, 300, 1600), 22.8, 0.1); tt = t_(0.4); add(np.sin(2 * np.pi * np.cumsum(np.linspace(180, 70, len(tt))) / SR) * np.exp(-tt * 9) + lp(noise(0.4), 900) * np.exp(-tt * 10) * 0.5, 23.0, 0.45)  # plop
    # the silence: the music stops, only night insects (louder), wind, a tumbleweed, drumming fingers
    d = 6.2; amb2 = bp(noise(d), 4200, 5600, 4) * (0.5 + 0.5 * np.sin(2 * np.pi * 17 * t_(d)) ** 10) * np.sin(np.pi * t_(d) / d) ** 0.3; add(amb2, 23.05, 0.22, 0.4)
    add(lp(noise(2.1), 2500) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 2.4 * t_(2.1)))) * np.sin(np.pi * t_(2.1) / 2.1), 23.6, 0.08, -0.5)
    for k in range(5): add(lp(noise(0.05), 1200) * env(int(0.05 * SR), 0.001, 0.02), 23.6 + k * 0.42, 0.12, -0.5 + k * 0.25)
    n = 0                                 # the Handler's pencil tapping impatiently
    while True:
        T_hit = (np.pi + 2 * np.pi * n) / 13; n += 1
        if T_hit < 28.95: continue
        if T_hit > 31.35: break
        tt = t_(0.06); add(np.sin(2 * np.pi * 900 * tt) * np.exp(-tt * 90) + bp(noise(0.06), 1500, 6000) * np.exp(-tt * 120) * 0.6, T_hit - 4.8, 0.2, -0.7)
    add(bell(84, 1.2, 0.5), 26.45, 0.08, 0.0)   # tip card
    # the fix: each update pops up with a friendly notification blip; the work groove comes back
    for a in (29.2, 30.8, 32.3):
        tt = t_(0.12); add(np.sin(2 * np.pi * np.cumsum(np.linspace(500, 900, len(tt))) / SR) * np.exp(-tt * 14), a + 0.08, 0.14, -0.3)
        add(bell(88, 0.6, 0.4), a + 0.16, 0.11, -0.2); add(bell(95, 0.6, 0.4), a + 0.26, 0.09, -0.1)
    for k, (thr, land) in enumerate([(29.55, 30.05), (31.0, 31.5), (31.4, 31.9), (32.5, 33.0)]):
        add(whoosh(land - thr, 500, 1800), thr, 0.08, 0.4)
        tt = t_(0.3); add((np.sin(2 * np.pi * 330 * tt) + 0.5 * np.sin(2 * np.pi * 880 * tt)) * np.exp(-tt * 25) + bp(noise(0.3), 1500, 5000) * np.exp(-tt * 30) * 0.4, land, 0.32, 0.5)
        add(bell(79 + k * 2, 1.0, 0.5), land + 0.04, 0.08, 0.5)
    beat = 29.2
    while beat < 34.4:
        tt = t_(0.18); add(np.sin(2 * np.pi * np.cumsum(np.linspace(110, 50, len(tt))) / SR) * np.exp(-tt * 20), beat, 0.18); beat += 0.5
    for k, (at, m) in enumerate([(29.3, 72), (29.55, 74), (29.8, 76), (30.3, 79), (30.9, 76), (31.15, 79), (31.4, 81), (31.9, 84), (32.4, 81), (32.65, 84), (32.9, 86), (33.4, 88)]): add(musicbox(m, 0.9), at, 0.12, 0.3 - 0.05 * k)
    # climbs out, proud chord; chapter III
    tt = t_(0.2); add(np.sin(2 * np.pi * np.cumsum(np.linspace(260, 700, len(tt))) / SR) * np.exp(-tt * 14), 33.62, 0.17)
    add(pad([60, 64, 67, 72, 76], 2.4, 0.3, 1.0), 33.95, 0.14)
    add(bell(84, 1.6, 0.3), 34.2, 0.035)

# ====================== PART 4 (story 34.2–51.8): the rules pile up, the gust, the rewrite ======================
if DUR > 39.0:
    def thwap(g=1.0):
        tt = t_(0.12); return (bp(noise(0.12), 600, 4000) * np.exp(-tt * 45) + np.sin(2 * np.pi * 140 * tt) * np.exp(-tt * 40) * 0.6) * g
    def flutter(d):
        tt = t_(d); return bp(noise(d), 1500, 5500) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 13 * tt))) * np.sin(np.pi * tt / d)
    for land in (36.0, 36.8, 37.55): add(flutter(1.0), land - 1.05, 0.06, 0.4); add(thwap(1.2), land, 0.42, 0.1)
    for land in (37.7, 37.8, 37.9, 38.0, 38.1, 38.2, 38.3, 38.4, 38.48, 38.56, 38.64): add(thwap(0.8), land, 0.32, np.sin(land * 9) * 0.5)
    add(flutter(1.2), 37.4, 0.07, -0.2)
    at, step, k = 35.2, 0.36, 0           # comic plucks that speed up as the notes pile on
    while at < 38.7:
        add(musicbox([67, 71, 74, 77, 79, 77, 74, 71][k % 8], 0.45), at, 0.11, 0.3 * np.sin(k)); k += 1; at += step; step = max(0.1, step * 0.9)
    # the mummy: silence, then a muffled little "may I blink?"
    for k, (f0, f1) in enumerate([(380, 360), (420, 400), (360, 380), (440, 560)]):
        d = 0.16 if k < 3 else 0.26; tt = t_(d); f = np.linspace(f0, f1, len(tt)); add(lp(np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.4 + np.sin(2 * np.pi * np.cumsum(f) / SR), 1400) * np.sin(np.pi * tt / d), 39.68 + k * 0.2, 0.16, 0.25)
    d = 0.9; tt = t_(d); add(lp(np.sign(np.sin(2 * np.pi * np.cumsum(np.linspace(240, 150, len(tt)) * (1 + 0.03 * np.sin(2 * np.pi * 6 * tt))) / SR)), 900) * np.sin(np.pi * tt / d) ** 0.6, 41.45, 0.1)  # wah-wah
    # the Handler's sweep: whoosh, a gust of wind, a flurry of paper
    add(whoosh(0.4, 300, 1400, 1.0), 43.0, 0.2, -0.2)          # the pencil swings in, eraser first
    d = 1.45; tt = t_(d); rub = (0.5 + 0.5 * np.sin(2 * np.pi * 4.14 * tt)) ** 2
    add((bp(noise(d), 300, 2200) * rub + np.sin(2 * np.pi * np.cumsum(900 + 300 * np.sin(2 * np.pi * 4.14 * tt)) / SR) * rub * 0.15), 43.35, 0.3, 0.1)   # rubbing out the notes
    for k in range(12): add(bp(noise(0.05), 2000, 6000) * env(int(0.05 * SR), 0.001, 0.02), 43.5 + k * 0.1, 0.05, np.sin(k))       # crumbs
    add(bell(84, 1.2, 0.5), 44.8, 0.08)    # tip card
    # the rewrite: two strike-throughs, quick writing, a bright ding; two happy blinks
    for a in (48.62, 48.8): add(bp(noise(0.16), 2500, 9000) * np.sin(np.pi * t_(0.16) / 0.16), a, 0.14, 0.1)
    for k in range(10): add(bp(noise(0.03), 3000, 9000) * env(int(0.03 * SR), 0.001, 0.012), 49.05 + k * 0.045, 0.1, 0.1)
    add(bell(91, 1.4, 0.8), 49.1, 0.14); add(bell(98, 1.0, 0.5), 49.14, 0.06)
    for a in (49.33, 49.63): add(bell(100, 0.3, 0.3), a, 0.08, 0.2)
    add(pad([60, 64, 67, 72], 2.0, 0.4, 0.8), 49.1, 0.1)
    # racing up the bridge: rising hops on stone, a bright run
    for k in range(5):
        a = 50.3 + k * 0.3; tt = t_(0.16); add(np.sin(2 * np.pi * np.cumsum(np.linspace(260 + k * 60, 520 + k * 120, len(tt))) / SR) * np.exp(-tt * 18), a, 0.14)
        add((np.sin(2 * np.pi * 330 * t_(0.1)) * np.exp(-t_(0.1) * 40)), a + 0.28, 0.15, 0.4)
    for k, m in enumerate([72, 74, 76, 79, 81, 84, 86, 88]): add(musicbox(m, 0.6), 50.3 + k * 0.18, 0.11, 0.3)
    add(bell(84, 1.6, 0.3), 51.6, 0.035)

# ====================== PART 5 (story 51.6–66.6): the staircase to the moon, one slab short ======================
if DUR > 56.4:
    for k, land in enumerate([52.2, 52.6, 53.0, 53.4, 53.8, 54.2, 54.6]):     # each slab pops in with a rising chime, a hop onto it
        tt = t_(0.25); add((np.sin(2 * np.pi * 330 * tt) + 0.5 * np.sin(2 * np.pi * 880 * tt)) * np.exp(-tt * 25), land, 0.2, 0.4)
        add(bell(76 + k * 2, 1.0, 0.5), land + 0.02, 0.08, 0.3); add(musicbox(72 + k * 2, 0.8), land + 0.05, 0.1, 0.2)
        tt = t_(0.16); add(np.sin(2 * np.pi * np.cumsum(np.linspace(300 + k * 40, 600 + k * 80, len(tt))) / SR) * np.exp(-tt * 18), land + 0.2, 0.12)
    add(pad([65, 69, 72, 77], 3.4, 0.6, 0.8), 52.0, 0.1)                          # the moon approaching: a widening, airy chord
    # it stops; the sign goes up; crickets
    tt = t_(0.4); add(np.sin(2 * np.pi * np.cumsum(np.linspace(500, 300, len(tt))) / SR) * np.exp(-tt * 8), 54.85, 0.08)
    add(bp(noise(0.12), 2000, 6000) * np.exp(-t_(0.12) * 30), 55.45, 0.1)
    d = 4.6; add(bp(noise(d), 4200, 5600, 4) * (0.5 + 0.5 * np.sin(2 * np.pi * 17 * t_(d)) ** 10) * np.sin(np.pi * t_(d) / d) ** 0.4, 55.6, 0.2, 0.3)
    # the pencil taps it on the head twice, then the tip card
    for a in (60.95, 61.35): tt = t_(0.1); add(np.sin(2 * np.pi * 700 * tt) * np.exp(-tt * 60) + bp(noise(0.1), 800, 4000) * np.exp(-tt * 80) * 0.4, a, 0.3, -0.2)
    add(bell(84, 1.2, 0.5), 60.8, 0.07)
    # wind-up and the final slab: a big slam and the moon's flare
    tt = t_(0.5); add(np.sin(2 * np.pi * np.cumsum(np.linspace(200, 700, len(tt))) / SR) * np.sin(np.pi * tt / 0.5) * 0.6, 64.25, 0.12)
    tt = t_(0.9); add((np.sin(2 * np.pi * 110 * tt) + 0.6 * np.sin(2 * np.pi * 220 * tt) + 0.3 * np.sin(2 * np.pi * 523 * tt)) * np.exp(-tt * 5) + lp(noise(0.9), 1200) * np.exp(-tt * 8) * 0.6, 64.75, 0.55, 0.3)
    add(pad([53, 60, 65, 69, 72, 77], 4.0, 0.2, 1.6), 64.8, 0.2)
    for k, m in enumerate([84, 88, 91, 96, 100, 103]): add(bell(m, 1.8, 0.7), 64.85 + k * 0.06, 0.06, -0.5 + k * 0.2)
    add(bell(84, 1.6, 0.3), 66.4, 0.035)

# ====================== continuous score bed: one film, one evolving harmony ======================
# a soft chord progression under everything, faded out only in the two deliberate silences
CH = [[53, 60, 65, 69], [50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64]]
at, k = 0.0, 0
while unwarp(at) < DUR:
    seg = 3.2
    if not (19.8 < at < 29.0 or 35.5 < at < 39.5): add(pad(CH[k % 4], seg + 0.8, 0.9, 0.9), at, 0.045, 0.15 * np.sin(k))
    k += 1; at += seg

# ====================== EPILOGUE (story 66.6–84.8): the report, the check mark, the reveal ======================
if DUR > 71.4:
    tt = t_(0.2); add(np.sin(2 * np.pi * np.cumsum(np.linspace(280, 720, len(tt))) / SR) * np.exp(-tt * 14), 66.65, 0.16); add(bell(91, 1.4, 0.6), 67.55, 0.08)
    d = 1.9; tt = t_(d); add(bp(noise(d), 1500, 6000) * (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 9 * tt))) * np.sin(np.pi * tt / d), 67.8, 0.09, -0.2)   # the scroll unrolls
    at = 68.0                                                                                                  # jargon mumbling, faster and faster
    while at < 72.3:
        d = 0.06 + 0.05 * rng.random(); f0 = 260 + 220 * rng.random(); tt = t_(d); f = np.linspace(f0, f0 * (0.8 + 0.4 * rng.random()), len(tt))
        add(lp(np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.4 + np.sin(2 * np.pi * np.cumsum(f) / SR), 1600) * np.sin(np.pi * tt / d), at, 0.07 if at < 69.8 else 0.045, rng.uniform(-0.4, 0.4))
        at += d + 0.015 + 0.03 * max(0, 70 - at) / 2
    add(bell(84, 1.2, 0.5), 72.0, 0.07)                                                                        # tip card
    add(whoosh(0.9, 2400, 500), 72.45, 0.12, -0.2); add(bp(noise(0.9), 2000, 7000) * np.sin(np.pi * t_(0.9) / 0.9), 72.45, 0.06)   # zip back up
    tt = t_(0.2); add(np.sin(2 * np.pi * np.cumsum(np.linspace(400, 800, len(tt))) / SR) * np.exp(-tt * 12), 75.42, 0.12)          # the card
    for a in (76.4, 76.58): add(bp(noise(0.18), 2500, 9000) * np.sin(np.pi * t_(0.18) / 0.18), a, 0.13)                            # check mark
    add(pad([60, 64, 67, 72, 76], 2.2, 0.15, 1.0), 76.8, 0.14); add(bell(96, 1.4, 0.7), 76.8, 0.1); add(bell(100, 1.4, 0.5), 76.88, 0.07)
    # the reveal: the opening lullaby returns, warm and wide; a soft lamp hum
    for at2, m in [(77.9, 77), (78.3, 74), (78.7, 72), (79.1, 69), (79.5, 72), (79.9, 74), (80.3, 77), (80.9, 81), (81.6, 79), (82.3, 77)]: add(musicbox(m, 2.2), at2, 0.2, 0.2)
    for at2, m in [(77.9, 53), (78.7, 57), (79.5, 60), (80.3, 53), (81.6, 58), (82.3, 53)]: add(musicbox(m, 2.6), at2, 0.12, -0.2)
    add(pad([41, 53, 60, 65, 69, 72], 7.5, 1.5, 3.0), 77.9, 0.2)
    d = 7.0; tt = t_(d); add(np.sin(2 * np.pi * 60 * tt) * 0.6 + np.sin(2 * np.pi * 120 * tt) * 0.25, 78.2, 0.02 * 1.0)
    add(bell(89, 3.0, 0.5), 80.25, 0.07); add(bell(96, 3.0, 0.4), 80.3, 0.05)

mix = np.stack([L, R], 1)
fade = int(1.6 * SR)
if DUR > 85 and N > fade: mix[-fade:] = mix[-fade:] * np.linspace(1, 0, fade)[:, None]
mix = mix / (np.max(np.abs(mix)) + 1e-9) * 0.8
sf.write(OUT, mix, SR, subtype='PCM_24')
print('wrote', OUT, mix.shape)
