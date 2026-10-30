#!/usr/bin/env python3
"""THE STILL POINT - the sound: a seamless 24.000 s ambient loop, synthesised from nothing.

The picture breathes three times in 24 s: in for 3.5 s, out for 4.5 s, the in-breaths starting at 0, 8 and 16 s.
On each in-breath a ring of light leaves him; here a singing bowl is struck at the same instant. Under it a warm
pad moves through three chords, one per breath, all over a D pedal; the pad swells a little on every in-breath.
Water laps faintly at the stone, and at 13.6 s a fish breaks the surface far off (one soft drop and its rings).

    t      picture                                   sound
    0.0    in-breath 1, ring 1 leaves him            bowl (D4), pad Dmaj9
    3.5    out-breath                                pad eases
    8.0    in-breath 2, ring 2                       bowl (A3), pad Gmaj9/D
   13.6    a fish rings the water far left           one soft drop
   16.0    in-breath 3, ring 3                       bowl (D4, softer), pad A6sus/D
   24.0    = 0.0

Seamless by construction: everything is rendered as events over three cycles (72 s) with every noise source
built from one 24 s noise tile repeated, then the middle cycle is cut out. Any event's tail (bowl, reverb) that
crosses the loop point is therefore already present at the start of the middle cycle, and the cut is exactly
periodic: sample N-1 runs into sample 0 as if the loop were endless.

    python score.py          (numpy, scipy, soundfile; ffmpeg for the loudness report)
Writes score.wav (48 kHz / 24-bit / stereo, exactly 24.000 s) and verification.txt.
"""
import os, subprocess
import numpy as np
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
D = 24.0
N = int(round(SR * D))
CYC = 3
NT = N * CYC
RNG = np.random.default_rng(2410)
TARGET_LUFS = -18.0
CEIL_DB = -2.0


def hz(note):
    names = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    n, o = note[:-1], int(note[-1])
    return 440.0 * 2 ** ((names[n] + 12 * (o + 1) - 69) / 12)


t_all = np.arange(NT) / SR


def place(buf, start, sig):
    """add sig into buf at start seconds, wrapping across the 3-cycle timeline"""
    i0 = int(round(start * SR)) % NT
    n = sig.shape[-1]
    end = i0 + n
    if end <= NT:
        buf[..., i0:end] += sig
    else:
        k = NT - i0
        buf[..., i0:] += sig[..., :k]
        buf[..., :end - NT] += sig[..., k:]


def tiled_noise(seed, ch=1):
    r = np.random.default_rng(seed)
    tile = r.standard_normal((ch, N))
    return np.tile(tile, (1, CYC))


# ------------------------------------------------------------------ the pad: three chords over a D pedal
CHORDS = [
    ['D2', 'A2', 'F#3', 'C#4', 'E4'],      # Dmaj9
    ['D2', 'A2', 'G3', 'B3', 'F#4'],       # Gmaj9/D (G B D F# over the pedal)
    ['D2', 'A2', 'E3', 'B3', 'F#4'],       # A6sus2/D, warm and open
]


def pad_voice(f, dur, amp, seed):
    """a soft analog-ish voice: three detuned saws, gently low-passed, slow attack and release"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    out = np.zeros((2, n))
    for k, det in enumerate((-0.11, 0.0, 0.13)):
        ph = r.uniform(0, 1)
        ff = f * 2 ** (det / 12) * (1 + 0.0012 * np.sin(2 * np.pi * 0.17 * t + r.uniform(0, 6.28)))
        phase = np.cumsum(ff) / SR + ph
        saw = 2 * (phase - np.floor(phase + 0.5))
        pan = (-0.45, 0.0, 0.45)[k]
        out[0] += saw * np.sqrt(0.5 * (1 - pan))
        out[1] += saw * np.sqrt(0.5 * (1 + pan))
    # warm: two-pole low-pass that opens a little in the middle of the note
    b, a = signal.butter(2, min(0.99, (1300 + f * 3.0) / (SR / 2)))
    out = signal.lfilter(b, a, out, axis=1)
    att, rel = 3.0, 4.2
    env = np.clip(t / att, 0, 1) ** 1.6 * np.clip((dur - t) / rel, 0, 1) ** 1.4
    return out * env * amp


pad = np.zeros((2, NT))
for c in range(CYC):
    for k, chord in enumerate(CHORDS):
        start = c * D + k * 8.0 - 1.6          # each chord blooms just before its in-breath
        for j, note in enumerate(chord):
            amp = [0.22, 0.13, 0.1, 0.075, 0.06][j]
            place(pad, start, pad_voice(hz(note), 12.6, amp, 100 * k + j))
# the pad breathes with him: a little fuller on each in-breath
u = np.mod(t_all, 8.0)
breath = np.where(u < 3.5, 0.5 - 0.5 * np.cos(np.pi * u / 3.5), 0.5 + 0.5 * np.cos(np.pi * (u - 3.5) / 4.5))
pad *= (0.8 + 0.2 * breath)
# a soft sub drone under it all (periodic: 36.75 Hz is 882 cycles in 24 s)
drone = 0.05 * np.sin(2 * np.pi * (882 / 24) * t_all) * (0.85 + 0.15 * np.cos(2 * np.pi * t_all / 24))
pad += np.vstack([drone, drone])

# ------------------------------------------------------------------ singing bowls
def bowl(f0, vel, dur=20.0, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    #         ratio  amp   decay(s) beat(Hz)
    modes = [(1.0, 1.0, 11.0, 0.9), (2.76, 0.48, 7.0, 1.7), (5.04, 0.22, 4.2, 2.6), (7.98, 0.11, 2.8, 3.4), (11.4, 0.05, 1.8, 4.1), (15.3, 0.02, 1.1, 5.2)]
    for ratio, amp, tau, beat in modes:
        f = f0 * ratio
        if f > 15000:
            continue
        p1, p2 = r.uniform(0, 6.28, 2)
        a = amp * np.exp(-t / tau)
        # each mode is a split pair; their beating is the bowl's slow wah
        s1 = np.sin(2 * np.pi * (f - beat / 2) * t + p1)
        s2 = np.sin(2 * np.pi * (f + beat / 2) * t + p2)
        out[0] += a * (0.6 * s1 + 0.4 * s2)
        out[1] += a * (0.4 * s1 + 0.6 * s2)
    # a felt mallet: soft attack over 12 ms, and a muffled knock
    atk = np.clip(t / 0.012, 0, 1)
    out *= atk
    knock = r.standard_normal(int(0.06 * SR)) * np.exp(-np.arange(int(0.06 * SR)) / (0.012 * SR))
    b, a = signal.butter(2, 600 / (SR / 2))
    knock = signal.lfilter(b, a, knock) * 0.5
    out[:, :len(knock)] += knock
    # fade the far tail to silence
    out *= np.clip((dur - t) / 3.0, 0, 1)
    return out * vel


bowls = np.zeros((2, NT))
for c in range(CYC):
    place(bowls, c * D + 0.0, bowl(hz('D4'), 0.23, seed=1))
    place(bowls, c * D + 8.0, bowl(hz('A3'), 0.22, seed=2))
    place(bowls, c * D + 16.0, bowl(hz('D4'), 0.18, seed=3))

# ------------------------------------------------------------------ water at the stone
wn = tiled_noise(77, 2)
b, a = signal.butter(2, [180 / (SR / 2), 1100 / (SR / 2)], btype='band')
water = signal.lfilter(b, a, wn, axis=1)
# lapping: irregular soft swells, periodic in 24 s (cycle counts 5, 7 and 11 per loop)
lap = (0.55 + 0.25 * np.sin(2 * np.pi * 5 * t_all / D + 0.4) + 0.12 * np.sin(2 * np.pi * 7 * t_all / D + 2.1)
       + 0.08 * np.sin(2 * np.pi * 11 * t_all / D + 4.0))
lap = np.clip(lap, 0, None) ** 2.2
water *= lap * 0.035
# a gentle airy top, very low
hn = tiled_noise(78, 2)
b, a = signal.butter(2, 5000 / (SR / 2), btype='high')
air = signal.lfilter(b, a, hn, axis=1) * 0.006
water += air
# the fish: one soft drop far off (a falling resonant blip), then a whisper of splash
drops = np.zeros((2, NT))
nd = int(0.35 * SR)
td = np.arange(nd) / SR
fdrop = 900 * np.exp(-td * 9) + 520
blip = np.sin(2 * np.pi * np.cumsum(fdrop) / SR) * np.exp(-td / 0.05) * np.clip(td / 0.002, 0, 1)
spl = RNG.standard_normal(nd) * np.exp(-td / 0.03)
b, a = signal.butter(2, [1500 / (SR / 2), 6000 / (SR / 2)], btype='band')
spl = signal.lfilter(b, a, spl)
fish = (0.05 * blip + 0.02 * spl)
for c in range(CYC):
    place(drops, c * D + 13.6, np.vstack([fish * 0.6, fish * 1.0]))       # it is on the left; the room hears it wide

# ------------------------------------------------------------------ a soft hall
def hall(x, seconds=4.5, seed=9):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = r.standard_normal((2, n)) * np.exp(-t / (seconds / 6.9))
    b, a = signal.butter(1, 3500 / (SR / 2))
    ir = signal.lfilter(b, a, ir, axis=1)
    ir[:, :int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
    ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
    y = np.zeros_like(x)
    for ch in range(2):
        full = signal.fftconvolve(np.concatenate([x[ch], x[ch]]), ir[ch])[:2 * NT]
        y[ch] = full[NT:2 * NT]             # circular: the tail wraps around, which keeps the loop exact
    return y


dry = pad * 1.0 + bowls * 1.0 + water + drops
wet = hall(pad * 0.7 + bowls * 1.0 + drops * 1.2 + water * 0.3)
mix = dry * 0.72 + wet * 0.55
# gentle low cut so the sub drone stays a feeling
b, a = signal.butter(2, 28 / (SR / 2), btype='high')
mix = signal.filtfilt(b, a, np.concatenate([mix, mix, mix], axis=1), axis=1)[:, NT:2 * NT]

# ------------------------------------------------------------------ cut the middle cycle, set the level
out = mix[:, N:2 * N].copy()


def k_weight(x):
    # BS.1770 K-weighting at 48 kHz
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    y = signal.lfilter(b1, a1, x, axis=1)
    return signal.lfilter(b2, a2, y, axis=1)


def lufs(x):
    xx = np.concatenate([x, x, x], axis=1)        # loop it so the filters are settled
    y = k_weight(xx)[:, N:2 * N]
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    ms = []
    for i in range(0, N - blk, hop):
        ms.append(np.sum(np.mean(y[:, i:i + blk] ** 2, axis=1)))
    ms = np.array(ms)
    l = -0.691 + 10 * np.log10(ms + 1e-20)
    g = ms[l > -70]
    rel = -0.691 + 10 * np.log10(np.mean(g)) - 10
    g2 = ms[(l > -70) & (l > rel)]
    return -0.691 + 10 * np.log10(np.mean(g2))


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
lines = ['THE STILL POINT - sound verification (measured on the written score.wav)', '']
lines.append(f'duration: {back.shape[1]} frames = {back.shape[1] / sr:.6f} s at {sr} Hz, {back.shape[0]} ch, PCM_24')
lines.append(f'integrated loudness (internal BS.1770 meter, looped): {L2:.2f} LUFS; true peak {tp2:.2f} dBTP (4x oversampled)')
# seam: the step from the last sample to the first, against ordinary sample-to-sample steps
d_all = np.abs(np.diff(back, axis=1))
seam = np.abs(back[:, 0] - back[:, -1])
lines.append(f'seam step |x[0] - x[N-1]|: L {seam[0]:.2e}, R {seam[1]:.2e}; ordinary steps: median {np.median(d_all):.2e}, 99.9th pct {np.percentile(d_all, 99.9):.2e}, max {d_all.max():.2e}')
# a click detector: high-passed energy in 5 ms windows; the window across the seam vs all windows
two = np.concatenate([back, back], axis=1)
b, a = signal.butter(4, 6000 / (sr / 2), btype='high')
hp = signal.lfilter(b, a, two, axis=1)[:, N // 2: N // 2 + N]        # a full loop with the seam in its middle
w = int(0.005 * sr)
e = np.array([np.sum(hp[:, i:i + w] ** 2) for i in range(0, N - w, w)])
mid = (N // 2) // w
seam_e = e[mid - 1:mid + 2].max()
lines.append(f'click test (>6 kHz energy, 5 ms windows): window at the seam {10 * np.log10(seam_e + 1e-30):.1f} dB; median {10 * np.log10(np.median(e) + 1e-30):.1f} dB; max anywhere {10 * np.log10(e.max() + 1e-30):.1f} dB; seam rank {int(np.sum(e > seam_e))} of {len(e)} windows louder')
ok_seam = seam_e <= np.percentile(e, 99) and seam.max() <= np.percentile(d_all, 99.9)
try:
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    summ = [l.strip() for l in r.stderr.splitlines() if l.strip().startswith(('I:', 'LRA:', 'Peak:'))]
    lines.append('ffmpeg ebur128 (single pass, not looped): ' + ' | '.join(summ[-3:]))
except Exception as ex:  # noqa
    lines.append('ffmpeg ebur128 unavailable: ' + str(ex))
lines.append('')
lines.append(('PASS' if ok_seam else 'CHECK') + '  seamless loop: no step or click at the seam beyond ordinary programme content')
lines.append(('PASS' if back.shape[1] == N else 'FAIL') + '  exactly 24.000 s')
txt = '\n'.join(lines)
print(txt)
open(os.path.join(HERE, 'verification.txt'), 'w').write(txt + '\n')
