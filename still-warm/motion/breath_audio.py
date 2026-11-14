# Seamless 20 s loop of sound for "the sky breathes": a slow pad that opens with each inhale, air, a glass note at the top of each breath.
import sys, numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile
SR, L = 48000, 20.0
rng = np.random.default_rng(3)
N2F = lambda n: 440 * 2 ** ((n - 69) / 12)
T = 60.0; n = int(SR * T); t = np.arange(n) / SR
def bcurve(x):
    x = np.mod(x, L); out = np.zeros_like(x)
    for t0, ti, th, te, amp in [(0.0, 3.9, 4.7, 10.2, 1.0), (10.2, 13.9, 14.5, 20.0, 0.78)]:
        m = (x >= t0) & (x < ti); out[m] = amp * (0.5 - 0.5 * np.cos(np.pi * (x[m] - t0) / (ti - t0)))
        m = (x >= ti) & (x < th); out[m] = amp
        m = (x >= th) & (x < te); out[m] = amp * (0.5 + 0.5 * np.cos(np.pi * (x[m] - th) / (te - th))) ** 1.15
    return out
B = bcurve(t)
def lp_var(x, cut):  # block-wise lowpass following a cutoff curve
    y = np.zeros_like(x); blk = 2400; zi = None
    for i in range(0, len(x), blk):
        c = float(np.clip(cut[i], 120, 9000)); sos = butter(2, c, 'lowpass', fs=SR, output='sos')
        if zi is None: zi = np.zeros((sos.shape[0], 2))
        y[i:i + blk], zi = sosfilt(sos, x[i:i + blk], zi=zi)
    return y
# pad: Dmaj9 for the long breath, Bm11 for the short one; detuned saws, filter opens with the breath
chA, chB = [50, 57, 61, 64, 66], [47, 54, 57, 62, 64]
sec = np.mod(t, L)
padL = np.zeros(n); padR = np.zeros(n)
for chord, lo, hi in [(chA, 0.0, 10.2), (chB, 10.2, 20.0)]:
    gate = ((sec >= lo) & (sec < hi)).astype(float)
    gate = np.convolve(gate, np.hanning(int(SR * 1.2)) / np.hanning(int(SR * 1.2)).sum(), 'same')   # soft chord changes
    for k, m in enumerate(chord):
        f = N2F(m)
        for det, pan in [(-0.0035, -0.6), (0.0, 0.0), (0.004, 0.6)]:
            w = 2 * ((t * f * (1 + det) + rng.random()) % 1) - 1
            padL += w * gate * (0.5 - 0.5 * pan); padR += w * gate * (0.5 + 0.5 * pan)
cut = 380 + 2600 * B ** 1.3
padL, padR = lp_var(padL, cut) * 0.05, lp_var(padR, cut) * 0.05
padL *= 0.55 + 0.45 * B; padR *= 0.55 + 0.45 * B
# air: breath-shaped noise, brighter on the inhale
air = rng.standard_normal((2, n))
airL = sosfilt(butter(2, [500, 3800], 'bandpass', fs=SR, output='sos'), air[0])
airR = sosfilt(butter(2, [550, 4200], 'bandpass', fs=SR, output='sos'), air[1])
dB = np.gradient(B) * SR
inh = np.clip(dB, 0, None) / (np.abs(dB).max() + 1e-9)
envA = 0.35 * B + 0.65 * inh
airL *= envA * 0.035; airR *= envA * 0.035
# low drone, steady
drone = (np.sin(2 * np.pi * N2F(38) * t) * 0.6 + np.sin(2 * np.pi * N2F(45) * t * 1.0007) * 0.3) * 0.05 * (0.8 + 0.2 * B)
drone = sosfilt(butter(2, 300, 'lowpass', fs=SR, output='sos'), drone)
# glass notes at the top of each inhale, and a softer one as each breath ends
def bell(m, dur=6.0, g=1.0):
    tt = np.arange(int(SR * dur)) / SR; f = N2F(m)
    return sum(a * np.sin(2 * np.pi * f * k * tt) * np.exp(-tt * d) for k, a, d in [(1, 1, 0.55), (2.76, 0.35, 1.3), (5.4, 0.16, 2.6), (8.9, 0.06, 4.0)]) * g * np.minimum(1, tt / 0.003)
outL, outR = padL + airL + drone, padR + airR + drone
for rep in range(3):
    for at, m, g, pan in [(3.9, 81, 0.07, -0.3), (4.05, 88, 0.035, 0.35), (13.9, 78, 0.06, 0.3), (14.05, 85, 0.03, -0.35), (9.6, 74, 0.03, 0.0), (19.4, 71, 0.028, 0.0)]:
        s = int((rep * L + at) * SR); x = bell(m, 6.5, g); e = min(n, s + len(x)); x = x[:e - s]
        outL[s:e] += x * (0.5 - 0.5 * pan) * 1.4; outR[s:e] += x * (0.5 + 0.5 * pan) * 1.4
# a little room
for d, gg in [(0.043, 0.22), (0.071, 0.17), (0.113, 0.12), (0.167, 0.08), (0.241, 0.05)]:
    k = int(d * SR); outL[k:] += outR[:-k] * gg; outR[k:] += outL[:-k] * gg * 0.9
# cut one loop out of the middle and make its end flow into its start
a0, a1, xf = int(L * SR), int(2 * L * SR), int(0.6 * SR)
segL, segR = outL[a0:a1].copy(), outR[a0:a1].copy()
w = np.linspace(0, 1, xf)
segL[-xf:] = segL[-xf:] * (1 - w) + outL[a0 - xf:a0] * w
segR[-xf:] = segR[-xf:] * (1 - w) + outR[a0 - xf:a0] * w
st = np.stack([segL, segR], 1); st = st / np.abs(st).max() * 0.85
wavfile.write(sys.argv[1], SR, (st * 32767).astype(np.int16))
print('ok')
