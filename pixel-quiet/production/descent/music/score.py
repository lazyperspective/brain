#!/usr/bin/env python3
"""THE DESCENT - the sound: a seamless 32.000 s underwater score, synthesised from nothing.

It follows the camera. The same Hermite keys that move the camera in the piece (05-the-descent.js) drive the
mix here: how far under the surface we are sets the balance of open air, muffled wash, pad brightness, drone
and reverb. Events are placed on the picture's own clock.

    t       picture                                        sound
    0.0     half under at the waterline, sun glitter       open air: swell and fizz on the surface; pad D (add9)
    1.3     the camera goes under                          a soft plunge: thump, hiss, a burst of bubbles
    2-9     reef, caustics, turtle, the silver bait ball   muffled wash; bright pad; a whoosh as the school parts (7.4)
    9-15    blue to indigo, jellies, siphonophore          the pad darkens (Bm9, Gmaj7); a low drone gathers
    14.6    comb jelly                                     rippling glass arpeggios, pentatonic, very soft
    15.5-19 lanternfish, blue sparks                       sparse high pings
    16.5-22 the anglerfish's lure drifts closer            a pure low tone breathing with the lure's pulse
    22-27   the seabed and the vent                        a warm low rumble, crackle, the vent's bubble stream; pad G
    27.2    bubbles let go; the ride up                    a rising shimmer, bubble pops, the pad climbs (A)
    31.6    breaking the surface                           the air comes back = 0.0

Seamless by construction: everything is rendered over three cycles (96 s) with every noise source built from one
32 s tile repeated, envelopes are periodic in 32 s, events wrap, the reverb is circular, and the middle cycle is cut.

    python3 score.py        (numpy, scipy, soundfile; ffmpeg for the loudness report)
Writes score.wav (48 kHz / 24-bit / stereo, exactly 32.000 s) and verification.txt.
"""
import os, subprocess
import numpy as np
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
D = 32.0
N = int(round(SR * D))
CYC = 3
NT = N * CYC
TARGET_LUFS = -18.0
CEIL_DB = -2.0
RNG = np.random.default_rng(3205)
t_all = np.arange(NT) / SR
tl = np.mod(t_all, D)                      # loop time of every sample

# ------------------------------------------------------------------ the camera path (same keys as the piece)
KEYS = [
    [0.0, -40, 0], [1.05, -24, 34], [2.15, 196, 300], [3.5, 480, 196], [5.4, 800, 150],
    [7.6, 1090, 92], [9.6, 1340, 170], [11.7, 1770, 205], [13.8, 2170, 160], [15.5, 2410, 108],
    [18.3, 2690, 86], [20.7, 2930, 125], [22.6, 3330, 185], [24.6, 3690, 66], [26.3, 3772, 0],
    [27.5, 3752, -60], [28.7, 3220, -980], [30.1, 1060, -1380], [31.15, 130, -500], [32.0, -40, 0],
]


def cam(t):
    t = np.asarray(t, float)
    out = np.zeros_like(t)
    for k in range(len(KEYS) - 1):
        a, b = KEYS[k], KEYS[k + 1]
        m = (t >= a[0]) & (t <= b[0])
        dt = b[0] - a[0]
        s = (t[m] - a[0]) / dt
        s2, s3 = s * s, s * s * s
        out[m] = (2 * s3 - 3 * s2 + 1) * a[1] + (s3 - 2 * s2 + s) * dt * a[2] + (-2 * s3 + 3 * s2) * b[1] + (s3 - s2) * dt * b[2]
    return out


# control signals at 1 kHz, then interpolated per sample
CR = 1000
tc = np.arange(int(D * CR)) / CR
hc = cam(tc)
depth = np.interp(tl, tc, hc, period=D)            # world y of the camera centre (px; 0 = surface)
d01 = np.clip(depth / 3800, 0, 1)                  # 0 surface .. 1 seabed
under = np.clip((depth + 6) / 24, 0, 1)            # 0 = eye above water, 1 = under
speed = np.interp(tl, tc, np.gradient(hc, 1 / CR), period=D)
cross_down = tc[np.argmax(hc > 0)]                 # the eye goes under
cross_up = tc[len(tc) - 1 - np.argmax(hc[::-1] > 0)]  # and comes back out
print(f'eye under at {cross_down:.3f} s, out at {cross_up:.3f} s')


def penv(points):
    """a periodic envelope from (t, value) points over the loop"""
    p = sorted(points)
    xs = np.array([q[0] for q in p] + [p[0][0] + D])
    ys = np.array([q[1] for q in p] + [p[0][1]])
    return np.interp(tl, xs, ys, period=D)


def smooth(x, sec):
    n = max(1, int(sec * SR))
    k = np.hanning(2 * n + 1); k /= k.sum()
    xx = np.concatenate([x[-NT // 3:], x, x[:NT // 3]])
    return signal.fftconvolve(xx, k, mode='same')[NT // 3: NT // 3 + NT]


def hz(note):
    names = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    n, o = note[:-1], int(note[-1])
    return 440.0 * 2 ** ((names[n] + 12 * (o + 1) - 69) / 12)


def place(buf, start, sig):
    i0 = int(round(start * SR)) % NT
    n = sig.shape[-1]
    end = i0 + n
    if end <= NT:
        buf[..., i0:end] += sig
    else:
        k = NT - i0
        buf[..., i0:] += sig[..., :k]
        buf[..., :end - NT] += sig[..., k:]


def tiled(seed, ch=2):
    r = np.random.default_rng(seed)
    return np.tile(r.standard_normal((ch, N)), (1, CYC))


def lp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2))
    return signal.lfilter(b, a, x, axis=-1)


def hp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), btype='high')
    return signal.lfilter(b, a, x, axis=-1)


def bp(x, f0, f1, order=2):
    b, a = signal.butter(order, [f0 / (SR / 2), f1 / (SR / 2)], btype='band')
    return signal.lfilter(b, a, x, axis=-1)


def periodic(x):
    """settle a filter on a looped signal: filter three copies, keep the middle (x is already NT long, periodic in N)"""
    return x


def pans(sig, pan):
    return np.vstack([sig * np.sqrt(0.5 * (1 - pan)), sig * np.sqrt(0.5 * (1 + pan))])


# ------------------------------------------------------------------ air: the surface heard from just above it
swell = 0.6 + 0.4 * np.sin(2 * np.pi * 4 * t_all / D + 0.4) ** 2 + 0.15 * np.sin(2 * np.pi * 9 * t_all / D)
air = bp(tiled(11), 250, 5200) * 0.05 * swell
fizz = hp(tiled(12), 4000) * 0.016 * (0.6 + 0.4 * np.sin(2 * np.pi * 13 * t_all / D) ** 2)
air_g = smooth(1 - under, 0.05)
air_mix = (air + fizz) * air_g

# ------------------------------------------------------------------ the muffled wash under the surface
wn = tiled(21)
wash = lp(wn, 380, 2) * 0.16 * (0.55 + 0.45 * np.sin(2 * np.pi * 4 * t_all / D + 1.0) ** 2)
wash_hi = bp(wn, 400, 1400) * 0.05
near_surface = np.exp(-np.maximum(depth, 0) / 650) * under
wash_mix = (wash + wash_hi * near_surface) * (0.15 + 0.85 * near_surface) * smooth(under, 0.08)

# ------------------------------------------------------------------ bubbles: short rising blips
def blip(f, dur, amp, seed):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    tt = np.arange(n) / SR
    ff = f * (1 + 0.6 * tt / dur)                 # a bubble's pitch rises as it rings
    ph = 2 * np.pi * np.cumsum(ff) / SR
    s = np.sin(ph + r.uniform(0, 6.28)) * np.exp(-tt / (dur * 0.3)) * np.clip(tt / 0.0015, 0, 1)
    return s * amp


bub = np.zeros((2, NT))
def bubbles(t0, t1, n, fmin, fmax, amp, seed, spread=0.8):
    r = np.random.default_rng(seed)
    for c in range(CYC):
        for k in range(n):
            t = t0 + (t1 - t0) * r.random() ** 1.3
            f = np.exp(r.uniform(np.log(fmin), np.log(fmax)))
            s = blip(f, 0.02 + 0.06 * (600 / f) ** 0.5, amp * r.uniform(0.4, 1), seed * 1000 + k)
            place(bub, c * D + t, pans(s, r.uniform(-spread, spread)))


bubbles(cross_down + 0.02, cross_down + 1.5, 140, 500, 2600, 0.05, 1)    # the plunge
bubbles(22.5, 27.2, 40, 700, 2000, 0.018, 2, 0.3)                          # the vent's thin stream
bubbles(27.15, cross_up, 90, 350, 1800, 0.03, 3, 0.5)                      # the ride up
bubbles(cross_up - 0.35, cross_up + 0.1, 30, 900, 3600, 0.035, 4)          # popping at the surface

# the plunge itself: a soft thump and a hiss of entrained air
spl = np.zeros((2, NT))
n = int(1.2 * SR); tt = np.arange(n) / SR
thump = lp(RNG.standard_normal(n), 180) * np.exp(-tt / 0.12) * 0.5
hiss = bp(RNG.standard_normal(n), 900, 6000) * np.exp(-tt / 0.22) * 0.12 * np.clip(tt / 0.01, 0, 1)
breach = bp(RNG.standard_normal(n), 600, 7000) * np.exp(-((tt - 0.25) / 0.18) ** 2) * 0.08
for c in range(CYC):
    place(spl, c * D + cross_down - 0.03, np.vstack([thump + hiss, thump * 0.9 + hiss * 1.1]))
    place(spl, c * D + cross_up - 0.25, np.vstack([breach, breach * 0.9]))

# the school parting: a soft swell of rushing water, left to right
whoosh = np.zeros((2, NT))
n = int(2.4 * SR); tt = np.arange(n) / SR
w = bp(RNG.standard_normal(n), 300, 2400) * np.sin(np.pi * tt / 2.4) ** 2 * 0.06
pan = np.linspace(-0.7, 0.7, n)
for c in range(CYC):
    place(whoosh, c * D + 6.3, np.vstack([w * np.sqrt(0.5 * (1 - pan)), w * np.sqrt(0.5 * (1 + pan))]))

# ------------------------------------------------------------------ the pad: one chord per zone
def pad_voice(f, dur, amp, seed, bright):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    r = np.random.default_rng(seed)
    out = np.zeros((2, n))
    for k, det in enumerate((-0.09, 0.0, 0.11)):
        ff = f * 2 ** (det / 12) * (1 + 0.001 * np.sin(2 * np.pi * 0.21 * tt + r.uniform(0, 6.28)))
        phase = np.cumsum(ff) / SR + r.uniform(0, 1)
        saw = 2 * (phase - np.floor(phase + 0.5))
        p = (-0.5, 0.0, 0.5)[k]
        out[0] += saw * np.sqrt(0.5 * (1 - p)); out[1] += saw * np.sqrt(0.5 * (1 + p))
    out = lp(out, min(SR * 0.45, bright + f * 2.0), 2)
    att, rel = 2.6, 3.6
    env = np.clip(tt / att, 0, 1) ** 1.6 * np.clip((dur - tt) / rel, 0, 1) ** 1.4
    return out * env * amp


CHORDS = [  # start, length, notes, brightness (Hz), level
    (-0.8, 9.6, ['D3', 'A3', 'E4', 'F#4', 'C#5'], 2600, 1.0),       # sunlit, Dmaj9
    (8.0, 6.0, ['B2', 'F#3', 'C#4', 'D4', 'A4'], 1500, 0.95),       # into the blue, Bm9
    (12.4, 6.0, ['G2', 'D3', 'F#3', 'B3', 'C#4'], 900, 0.85),      # twilight, Gmaj7#11
    (16.6, 7.4, ['D2', 'A2', 'E3'], 520, 0.55),                    # midnight: an open fifth
    (21.6, 7.0, ['G2', 'B2', 'D3', 'A3'], 700, 0.9),               # the vent: warm G (add9)
    (27.0, 5.8, ['A2', 'E3', 'C#4', 'E4', 'B4'], 1900, 0.95),      # rising: A (add9), into D at the top
]
pad = np.zeros((2, NT))
for c in range(CYC):
    for ci, (st, ln, notes, br, lv) in enumerate(CHORDS):
        for j, note in enumerate(notes):
            amp = [0.15, 0.1, 0.075, 0.06, 0.05][j] * lv
            place(pad, c * D + st, pad_voice(hz(note), ln + 3.0, amp, 100 * ci + j, br))

# ------------------------------------------------------------------ the deep drone (whole cycles per loop)
def tone(f_target, ph=0.0):
    f = round(f_target * D) / D
    return np.sin(2 * np.pi * f * t_all + ph)


deep = np.clip((depth - 1200) / 2000, 0, 1) ** 1.2
drone = (0.07 * tone(hz('D1')) + 0.05 * tone(hz('A1'), 1.0) + 0.025 * tone(hz('D2') * 1.003, 2.0)) * (1 + 0.25 * np.sin(2 * np.pi * 2 * t_all / D))
drone *= smooth(deep, 0.2) * (1 - 0.6 * np.clip((speed * -1 - 300) / 900, 0, 1))
drone = np.vstack([drone, drone])

# ------------------------------------------------------------------ crystalline tones for the living light
def bell(f0, amp, seed, dur=3.5):
    r = np.random.default_rng(seed)
    n = int(dur * SR); tt = np.arange(n) / SR
    out = np.zeros(n)
    for ratio, a, tau in [(1, 1, 1.4), (2.76, 0.4, 0.7), (5.4, 0.18, 0.35), (8.93, 0.08, 0.2)]:
        out += a * np.sin(2 * np.pi * f0 * ratio * tt + r.uniform(0, 6.28)) * np.exp(-tt / tau)
    return out * np.clip(tt / 0.004, 0, 1) * amp


glass = np.zeros((2, NT))
PENT = ['D6', 'E6', 'F#6', 'A6', 'B6', 'D7', 'E7']
r = np.random.default_rng(77)
for c in range(CYC):
    # the comb jelly: little ripples of three or four notes running up, like the waves down its rows
    for k, t in enumerate(np.arange(14.4, 17.6, 0.75)):
        base = r.integers(0, 3)
        for q in range(4):
            place(glass, c * D + t + q * 0.085, pans(bell(hz(PENT[base + q]), 0.018 * (1 - q * 0.15), 1000 + k * 10 + q, 2.2), 0.45))
    # lanternfish sparks: sparse pings, high, scattered
    for k in range(16):
        t = 15.6 + r.random() * 4.2
        place(glass, c * D + t, pans(bell(hz(PENT[r.integers(3, 7)]) * 2, 0.008, 2000 + k, 1.2), r.uniform(-0.8, 0.8)))
    # the twilight jellies: a low glass note at each of the big jelly's pulses
    for k, t in enumerate(np.arange(10.0, 15.0, 2.0)):
        place(glass, c * D + t + 0.05, pans(bell(hz(['F#5', 'D5', 'A4'][k % 3]), 0.016, 3000 + k, 3.0), -0.3))
# the lure: a pure tone that breathes with its pulse (six pulses a loop) and fades with the fish
lure_env = penv([(0, 0), (15.6, 0), (17.0, 0.6), (20.0, 1.0), (21.8, 0.8), (23.0, 0), (31.9, 0)])
lure = 0.03 * tone(hz('A4')) * (0.75 + 0.25 * np.sin(2 * np.pi * 6 * t_all / D)) * smooth(lure_env, 0.1)
lure += 0.012 * tone(hz('E5') * 1.001, 1.3) * smooth(lure_env, 0.1)
glass += np.vstack([lure * 0.8, lure])

# ------------------------------------------------------------------ the vent: a warm rumble with a pulse in it
vent_env = penv([(0, 0), (21.0, 0), (23.6, 0.8), (24.8, 1.0), (27.2, 1.0), (28.6, 0.35), (29.6, 0), (31.9, 0)])
vf = 1 + 0.1 * np.sin(2 * np.pi * 7 * t_all / D) + 0.05 * np.sin(2 * np.pi * 17 * t_all / D + 2)
rumble = lp(tiled(31), 110, 2) * 0.55 * vf
rumble2 = bp(tiled(32), 120, 420) * 0.1 * vf
crack = np.zeros((2, NT))
rr = np.random.default_rng(33)
for c in range(CYC):
    for k in range(70):
        t = 22.0 + rr.random() * 7.0
        n = int(0.012 * SR); tt = np.arange(n) / SR
        s = bp(rr.standard_normal(n), 1500, 5000) * np.exp(-tt / 0.002) * 0.03 * rr.random()
        place(crack, c * D + t, pans(s, rr.uniform(-0.7, 0.7)))
vent = (rumble + rumble2) * smooth(vent_env, 0.1) + crack * smooth(vent_env, 0.1)

# ------------------------------------------------------------------ the ride up: a rising shimmer
rise_env = penv([(0, 0), (27.0, 0), (28.2, 0.5), (30.6, 1.0), (31.5, 0.9), (31.95, 0)])
ru = np.clip((tl - 27.0) / (31.6 - 27.0), 0, 1)
shimmer = np.zeros(NT)
for k in range(6):
    f0 = 220 * 2 ** (k * 7 / 12)
    f = f0 * 2 ** (1.6 * ru)
    ph = 2 * np.pi * np.cumsum(f) / SR
    shimmer += np.sin(ph + k) * (0.5 + 0.5 * np.sin(np.pi * np.clip(ru * 1.2 - k * 0.05, 0, 1))) / (1 + k * 0.4)
shimmer *= 0.02 * smooth(rise_env, 0.05)
riser = hp(tiled(41), 1800) * 0.03 * smooth(rise_env * ru, 0.05)
rise = np.vstack([shimmer, shimmer * 0.95]) + riser * np.vstack([np.ones(NT), np.ones(NT)])
rise[1] = np.roll(rise[1], int(0.011 * SR))          # a little width

# ------------------------------------------------------------------ the water around us: a circular hall that grows with depth
def hall(x, seconds, seed, lpf):
    r = np.random.default_rng(seed)
    n = int(seconds * SR); tt = np.arange(n) / SR
    ir = r.standard_normal((2, n)) * np.exp(-tt / (seconds / 6.9))
    ir = lp(ir, lpf, 1)
    ir[:, :int(0.03 * SR)] *= np.linspace(0, 1, int(0.03 * SR))
    ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
    y = np.zeros_like(x)
    for ch in range(2):
        full = signal.fftconvolve(np.concatenate([x[ch], x[ch]]), ir[ch])[:2 * NT]
        y[ch] = full[NT:2 * NT]
    return y


dry = air_mix + wash_mix + bub + spl + whoosh + pad + drone + glass + vent + rise
wet_send = pad * 0.8 + glass * 1.2 + bub * 0.8 + spl * 0.5 + rise * 0.8 + whoosh * 0.5 + vent * 0.3
wet = hall(wet_send, 5.5, 9, 2400)
wet_amt = 0.25 + 0.45 * smooth(np.clip(depth / 2500, 0, 1), 0.2)
mix = dry * 0.8 + wet * wet_amt * 0.7
# under water the very top end goes: a gentle shelf that deepens with depth (cross-faded stems, periodic)
hi = hp(np.concatenate([mix, mix, mix], axis=1), 3500)[:, NT:2 * NT]
mix = mix - hi * (0.55 * smooth(under, 0.05) + 0.25 * smooth(d01, 0.2))
mix = hp(np.concatenate([mix, mix, mix], axis=1), 24)[:, NT:2 * NT]

# ------------------------------------------------------------------ cut the middle cycle, set the level
out = mix[:, N:2 * N].copy()


def k_weight(x):
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=1), axis=1)


def lufs(x):
    xx = np.concatenate([x, x, x], axis=1)
    y = k_weight(xx)[:, N:2 * N]
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    ms = np.array([np.sum(np.mean(y[:, i:i + blk] ** 2, axis=1)) for i in range(0, N - blk, hop)])
    l = -0.691 + 10 * np.log10(ms + 1e-20)
    g = ms[l > -70]
    rel = -0.691 + 10 * np.log10(np.mean(g)) - 10
    return -0.691 + 10 * np.log10(np.mean(ms[(l > -70) & (l > rel)]))


def true_peak_db(x):
    up = signal.resample_poly(np.concatenate([x[:, -2000:], x, x[:, :2000]], axis=1), 4, 1, axis=1)
    return 20 * np.log10(np.max(np.abs(up)) + 1e-20)


L = lufs(out)
out *= 10 ** ((TARGET_LUFS - L) / 20)
tp = true_peak_db(out)
if tp > CEIL_DB:
    out *= 10 ** ((CEIL_DB - tp) / 20)
L2, tp2 = lufs(out), true_peak_db(out)
path = os.path.join(HERE, 'score.wav')
sf.write(path, out.T, SR, subtype='PCM_24')

# ------------------------------------------------------------------ verification
back, sr = sf.read(path, always_2d=True)
back = back.T
lines = ['THE DESCENT - sound verification (measured on the written score.wav)', '']
lines.append(f'duration: {back.shape[1]} frames = {back.shape[1] / sr:.6f} s at {sr} Hz, {back.shape[0]} ch, PCM_24')
lines.append(f'eye goes under at {cross_down:.3f} s (plunge placed there); comes out at {cross_up:.3f} s (breach)')
lines.append(f'integrated loudness (internal BS.1770 meter, looped): {L2:.2f} LUFS; true peak {tp2:.2f} dBTP (4x oversampled)')
d_all = np.abs(np.diff(back, axis=1))
seam = np.abs(back[:, 0] - back[:, -1])
lines.append(f'seam step |x[0] - x[N-1]|: L {seam[0]:.2e}, R {seam[1]:.2e}; ordinary steps: median {np.median(d_all):.2e}, 99.9th pct {np.percentile(d_all, 99.9):.2e}, max {d_all.max():.2e}')
two = np.concatenate([back, back], axis=1)
b, a = signal.butter(4, 6000 / (sr / 2), btype='high')
hpx = signal.lfilter(b, a, two, axis=1)[:, N // 2: N // 2 + N]
w = int(0.005 * sr)
e = np.array([np.sum(hpx[:, i:i + w] ** 2) for i in range(0, N - w, w)])
mid = (N // 2) // w
seam_e = e[mid - 1:mid + 2].max()
lines.append(f'click test (>6 kHz energy, 5 ms windows): window at the seam {10 * np.log10(seam_e + 1e-30):.1f} dB; median {10 * np.log10(np.median(e) + 1e-30):.1f} dB; max anywhere {10 * np.log10(e.max() + 1e-30):.1f} dB; seam rank {int(np.sum(e > seam_e))} of {len(e)} windows louder')
ok_seam = seam_e <= np.percentile(e, 99) and seam.max() <= np.percentile(d_all, 99.9)
# and against its own neighbourhood (the seam sits in the open-air fizz, so compare like with like: +-0.5 s)
loc = np.array([np.sum(hpx[:, (N // 2) + k * w:(N // 2) + (k + 1) * w] ** 2) for k in range(-100, 100) if abs(k) > 2])
lines.append(f'local click test: seam window {10 * np.log10(seam_e + 1e-30):.1f} dB vs the surrounding 1 s: median {10 * np.log10(np.median(loc) + 1e-30):.1f} dB, max {10 * np.log10(loc.max() + 1e-30):.1f} dB')
ok_seam = ok_seam and seam_e <= loc.max()
try:
    rr2 = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    summ = [l.strip() for l in rr2.stderr.splitlines() if l.strip().startswith(('I:', 'LRA:', 'Peak:'))]
    lines.append('ffmpeg ebur128 (single pass, not looped): ' + ' | '.join(summ[-3:]))
except Exception as ex:  # noqa
    lines.append('ffmpeg ebur128 unavailable: ' + str(ex))
lines.append('')
lines.append(('PASS' if ok_seam else 'CHECK') + '  seamless loop: no step or click at the seam beyond ordinary programme content')
lines.append(('PASS' if back.shape[1] == N else 'FAIL') + '  exactly 32.000 s')
txt = '\n'.join(lines)
print(txt)
open(os.path.join(HERE, 'verification.txt'), 'w').write(txt + '\n')
