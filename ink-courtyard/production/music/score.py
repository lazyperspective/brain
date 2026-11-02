#!/usr/bin/env python3
"""THE MOON GATE - the sound: a seamless 28.000 s score, synthesised with numpy/scipy, plus koto and shakuhachi
rendered by FluidSynth (FluidR3_GM) from a MIDI file this script writes itself.

It follows the picture's own clock (js/anim.js):

    t (s)       picture                                         sound
    always      breeze in the vine, petals falling             air in leaves; a low D drone, very soft
    0-28        koto in D major pentatonic, one figure per bar  (bars of 3.5 s)
    4.3-6.0     a sparrow flies in and lands on the ridge       a whirr of wings, then two cheeps
    7.0-13.6    the sparrow looks about, hops (10.6), pecks     shakuhachi, first phrase; a cheep at 9.7 and 13.9
    16.5-21     a gust (peak 18.6): the vine tosses, petals     the breeze swells; wind-chime tinkles; the lantern
                shower down, the lantern swings                 creaks twice
    19.0-20.8   the sparrow flies off                           wings
    19.3-27.7   the petals settle                               shakuhachi, second phrase, home to D at the seam

Seamless by construction: everything is rendered over three cycles (84 s) with every noise source built from one
28 s tile repeated, envelopes periodic, events placed in every cycle, the reverb circular, and the middle cycle cut.
FluidSynth renders the same three-cycle MIDI (its reverb and chorus off), so note tails cross the seam naturally.

    python3 score.py        (numpy, scipy, soundfile; fluidsynth + /usr/share/sounds/sf2/FluidR3_GM.sf2; ffmpeg)
Writes score.wav (48 kHz / 24-bit / stereo, exactly 28.000 s) and verification.txt.
"""
import os, struct, subprocess, tempfile
import numpy as np
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
SF2 = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
SR = 48000
D = 28.0
N = int(round(SR * D))
CYC = 3
NT = N * CYC
TARGET_LUFS = -20.0
CEIL_DB = -1.5
t_all = np.arange(NT) / SR
tl = np.mod(t_all, D)
BEAT = D / 32                                   # 0.875 s; 8 bars of 4

# ------------------------------------------------------------------ the picture's clock (js/anim.js)
GUST_T, GUST_S = 18.6, 1.7
SP_ARRIVE, SP_LAND, SP_LEAVE, SP_GONE = 4.3, 6.0, 19.0, 20.8
SP_HOP, SP_PECKS = 10.6, (12.6, 13.25)


def wrapd(t, c):
    d = np.mod(t - c, D)
    return np.where(d > D / 2, d - D, d)


gust = np.exp(-wrapd(tl, GUST_T) ** 2 / (2 * GUST_S ** 2))


# ------------------------------------------------------------------ helpers
def midi(note):
    names = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    n, o = note[:-1], int(note[-1])
    return names[n] + 12 * (o + 1)


def hz(note):
    return 440.0 * 2 ** ((midi(note) - 69) / 12)


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


def circ(fn, x):
    xx = np.concatenate([x, x, x], axis=-1)
    return fn(xx)[..., NT:2 * NT]


def lp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2))
    return signal.lfilter(b, a, x, axis=-1)


def hp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), btype='high')
    return signal.lfilter(b, a, x, axis=-1)


def bp(x, f0, f1, order=2):
    b, a = signal.butter(order, [f0 / (SR / 2), f1 / (SR / 2)], btype='band')
    return signal.lfilter(b, a, x, axis=-1)


def pans(sig, pan):
    return np.vstack([sig * np.sqrt(0.5 * (1 - pan)), sig * np.sqrt(0.5 * (1 + pan))])


def tone(f_target, ph0=0.0):
    f = round(f_target * D) / D                     # whole cycles per loop
    return np.sin(2 * np.pi * f * t_all + ph0)


def every_cycle(fn):
    for c in range(CYC):
        fn(c * D)


# ------------------------------------------------------------------ air: the breeze in the vine, always there
sway = 0.72 + 0.2 * np.sin(2 * np.pi * 3 * t_all / D + 0.4) + 0.1 * np.sin(2 * np.pi * 7 * t_all / D + 1.1)
breeze = circ(lambda x: bp(x, 160, 1200, 2), tiled(11)) * 0.026 * (sway + 1.6 * gust)
leaves = circ(lambda x: bp(x, 2200, 7500, 2), tiled(12)) * 0.006 * (0.5 + 0.5 * sway + 2.2 * gust)
# the leaves' rustle comes in little flurries
flurry = 0.6 + 0.4 * np.sin(2 * np.pi * 23 * t_all / D) * np.sin(2 * np.pi * 9 * t_all / D + 0.7)
air = breeze + leaves * flurry

# ------------------------------------------------------------------ birds: distant warblers, and the sparrow
birds = np.zeros((2, NT))


def chirp(f0, f1, dur, amp, seed, vib=0.0, harm=0.25):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = f0 + (f1 - f0) * (tt / dur) ** 0.7 + vib * np.sin(2 * np.pi * 38 * tt + r.uniform(0, 6))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) + harm * np.sin(2 * ph)
    return s * np.sin(np.pi * tt / dur) ** 1.5 * amp


def warble(t0, amp, seed, pan):
    r = np.random.default_rng(seed)
    t = t0
    for k in range(r.integers(4, 7)):
        f0 = r.uniform(2600, 3600)
        place(birds, t, pans(chirp(f0, f0 * r.uniform(0.8, 1.25), r.uniform(0.05, 0.11), amp * r.uniform(0.6, 1), seed * 10 + k, 120), pan))
        t += r.uniform(0.08, 0.16)


def cheep(t0, amp, seed, pan):
    """a house sparrow's short, slightly buzzy 'chirrup'"""
    r = np.random.default_rng(seed)
    for k, (f0, f1, d) in enumerate([(3800, 4600, 0.045), (4500, 3300, 0.07)]):
        s = chirp(f0 * r.uniform(0.95, 1.05), f1, d, amp, seed * 3 + k, vib=260, harm=0.45)
        place(birds, t0 + k * 0.055, pans(s, pan))


def wings(t0, t1, amp, seed, pan0, pan1, rate=17.0):
    n = int((t1 - t0) * SR)
    tt = np.arange(n) / SR
    r = np.random.default_rng(seed)
    nz = bp(r.standard_normal(n), 250, 2600, 2)
    beat = np.maximum(0, np.sin(2 * np.pi * rate * tt)) ** 3
    env = np.sin(np.pi * tt / (t1 - t0)) ** 0.6
    s = nz * beat * env * amp
    pan = np.linspace(pan0, pan1, n)
    place(birds, t0, np.vstack([s * np.sqrt(0.5 * (1 - pan)), s * np.sqrt(0.5 * (1 + pan))]))


def birds_cycle(o):
    warble(o + 1.6, 0.010, 41, -0.6)
    warble(o + 23.4, 0.008, 42, -0.3)
    warble(o + 15.8, 0.006, 43, -0.75)
    wings(o + SP_ARRIVE + 0.1, o + SP_LAND + 0.05, 0.05, 44, 0.85, 0.55)
    wings(o + SP_LEAVE - 0.02, o + SP_LEAVE + 1.1, 0.06, 45, 0.55, 0.9)
    for k, tt in enumerate([6.35, 6.62, 9.7, 13.9, 16.5]):
        cheep(o + tt, 0.05 if tt < 7 else 0.04, 50 + k, 0.5)
    cheep(o + SP_HOP - 0.05, 0.025, 58, 0.48)


every_cycle(birds_cycle)

# ------------------------------------------------------------------ a wind chime somewhere to the right, and the lantern
fx = np.zeros((2, NT))
CHIME = [hz(n) for n in ['D6', 'E6', 'F#6', 'A6', 'B6', 'D7']]


def chime(t0, f, amp, seed, pan):
    n = int(3.2 * SR)
    tt = np.arange(n) / SR
    r = np.random.default_rng(seed)
    s = np.zeros(n)
    for ratio, dec, a in [(1.0, 1.4, 1.0), (2.76, 0.6, 0.45), (5.4, 0.25, 0.25), (8.93, 0.12, 0.12)]:
        s += a * np.sin(2 * np.pi * f * ratio * tt * r.uniform(0.998, 1.002) + r.uniform(0, 6)) * np.exp(-tt / dec)
    s *= np.minimum(1, tt / 0.002) * amp
    place(fx, t0, pans(s, pan))


def creak(t0, amp, seed):
    """a soft wooden creak: a rubbed resonance, slowly rising"""
    n = int(0.42 * SR)
    tt = np.arange(n) / SR
    r = np.random.default_rng(seed)
    f = 210 + 60 * tt / 0.42
    pulses = (np.sin(2 * np.pi * np.cumsum(f) / SR) > 0.93).astype(float)
    s = signal.lfilter(*signal.iirpeak(780 / (SR / 2), 7), pulses) + 0.4 * signal.lfilter(*signal.iirpeak(1450 / (SR / 2), 9), pulses)
    s *= np.sin(np.pi * tt / 0.42) ** 1.2 * amp * (0.85 + 0.15 * r.standard_normal(n).clip(-1, 1))
    place(fx, t0, pans(s, -0.25))


def fx_cycle(o):
    r = np.random.default_rng(int(o) + 70)
    for k, tt in enumerate([2.9, 8.8, 13.4, 24.6]):                      # now and then, a single note
        chime(o + tt, CHIME[r.integers(0, 4)], 0.012, 71 + k, 0.55)
    for k in range(9):                                                  # the gust sets them all going
        tt = GUST_T - 1.8 + k * 0.42 + r.uniform(-0.12, 0.12)
        chime(o + tt, CHIME[r.integers(0, len(CHIME))], 0.016 * np.exp(-((tt - GUST_T) / 1.6) ** 2) + 0.004, 80 + k, 0.45 + r.uniform(-0.1, 0.15))
    creak(o + GUST_T - 0.35, 0.016, 91)
    creak(o + GUST_T + 1.05, 0.011, 92)


every_cycle(fx_cycle)

# ------------------------------------------------------------------ a low drone (whole cycles per loop: no seam)
drone_env = 0.85 + 0.15 * np.sin(2 * np.pi * 1 * t_all / D + 2.0)
drone = (0.010 * tone(hz('D2')) + 0.007 * tone(hz('A2'), 1.0) + 0.0045 * tone(hz('D3'), 2.1) + 0.002 * tone(hz('F#3'), 0.6)) * drone_env
drone = np.vstack([drone * 0.95, drone])

# ------------------------------------------------------------------ the music: koto and shakuhachi
KOTO, FLUTE = 0, 1
B = BEAT
# (beat, channel, note, velocity, length in beats)
KOTO_NOTES = [
    (0, 'D3', 52, 4), (0, 'A3', 44, 3), (0.5, 'D4', 50, 2), (1, 'F#4', 48, 2), (1.5, 'A4', 52, 2), (3, 'B4', 44, 2),
    (4, 'B2', 48, 4), (4, 'F#3', 42, 3), (4.5, 'B3', 46, 2), (5, 'D4', 48, 2), (5.5, 'F#4', 46, 2), (7, 'E4', 42, 2),
    (8, 'E3', 46, 4), (8, 'B3', 40, 3), (8.5, 'E4', 44, 2), (9, 'A4', 44, 2), (11, 'B4', 40, 2),
    (12, 'A2', 48, 4), (12, 'E3', 42, 3), (12.5, 'A3', 44, 2), (13, 'E4', 44, 2), (13.5, 'A4', 40, 2), (15, 'F#4', 38, 2),
    (16, 'D3', 50, 4), (16, 'A3', 42, 3), (16.5, 'F#4', 44, 2), (17, 'A4', 46, 2), (17.5, 'D5', 48, 2), (19, 'E5', 40, 2),
    (20, 'B2', 46, 4), (20, 'F#3', 40, 3), (20.5, 'D4', 42, 2), (21, 'B4', 40, 2), (22.5, 'D5', 34, 2),
    (24, 'E3', 44, 4), (24, 'B3', 38, 3), (24.5, 'E4', 40, 2), (25, 'B4', 38, 2), (26.5, 'A4', 36, 2),
    (28, 'A2', 44, 4), (28, 'A3', 38, 3), (28.5, 'E4', 40, 2), (29, 'F#4', 38, 2), (30, 'A4', 36, 2), (31, 'E4', 34, 2),
]
FLUTE_NOTES = [
    (8, 'A4', 58, 2.2), (10.2, 'B4', 54, 0.9), (11.1, 'A4', 56, 1.0), (12.1, 'F#4', 58, 2.6), (14.7, 'E4', 50, 1.3),
    (22, 'D5', 56, 1.8), (23.8, 'B4', 52, 1.0), (24.8, 'A4', 54, 1.2), (26.0, 'F#4', 56, 1.8), (27.8, 'E4', 50, 1.1), (28.9, 'D4', 54, 2.8),
]
NOTES = [(b * B, KOTO, n, v, l * B) for (b, n, v, l) in KOTO_NOTES] + [(b * B, FLUTE, n, v, l * B) for (b, n, v, l) in FLUTE_NOTES]


def write_midi(path, notes, cycles):
    tpq, tempo = 480, 500000                   # 120 bpm: 960 ticks per second
    tps = tpq * 1e6 / tempo
    ev = []
    for ch, prg, vol in [(KOTO, 107, 104), (FLUTE, 77, 92)]:
        ev.append((0, bytes([0xC0 | ch, prg])))
        ev.append((0, bytes([0xB0 | ch, 7, vol])))
        ev.append((0, bytes([0xB0 | ch, 91, 0])))   # no reverb send (ours is circular)
        ev.append((0, bytes([0xB0 | ch, 93, 0])))
    ev.append((0, bytes([0xB0 | FLUTE, 10, 50])))   # flute a little left of centre
    ev.append((0, bytes([0xB0 | KOTO, 10, 72])))    # koto a little right
    for c in range(cycles):
        for (t, ch, nt, vel, ln) in notes:
            on = int(round((c * D + t) * tps))
            ev.append((on, bytes([0x90 | ch, midi(nt), vel])))
            ev.append((on + int(round(ln * tps)), bytes([0x80 | ch, midi(nt), 0])))
    ev.sort(key=lambda e: (e[0], e[1][0] & 0xF0 == 0x90))
    data, last = b'', 0

    def vlq(v):
        out = [v & 0x7F]
        v >>= 7
        while v:
            out.insert(0, (v & 0x7F) | 0x80)
            v >>= 7
        return bytes(out)
    data += vlq(0) + b'\xff\x51\x03' + tempo.to_bytes(3, 'big')
    for tick, msg in ev:
        data += vlq(tick - last) + msg
        last = tick
    data += vlq(int((cycles * D + 5) * tps) - last) + b'\xff\x2f\x00'
    with open(path, 'wb') as f:
        f.write(b'MThd' + struct.pack('>IHHH', 6, 0, 1, tpq) + b'MTrk' + struct.pack('>I', len(data)) + data)


with tempfile.TemporaryDirectory() as td:
    mp, wp = os.path.join(td, 'music.mid'), os.path.join(td, 'music.wav')
    write_midi(mp, NOTES, CYC)
    subprocess.run(['fluidsynth', '-ni', '-q', '-R', '0', '-C', '0', '-g', '0.6', '-r', str(SR), '-F', wp, SF2, mp], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    m, msr = sf.read(wp, always_2d=True)
    assert msr == SR
m = m.T
music = np.zeros((2, NT))
k = min(NT, m.shape[1])
music[:, :k] = m[:, :k]
if m.shape[1] > NT:                             # tails past 84 s fold back to the start
    music[:, :m.shape[1] - NT] += m[:, NT:]


# ------------------------------------------------------------------ space: a soft circular courtyard reverb, and the mix
def hall(x, seconds, seed, lpf):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    tt = np.arange(n) / SR
    ir = r.standard_normal((2, n)) * np.exp(-tt / (seconds / 6.9))
    ir = lp(ir, lpf, 1)
    ir[:, :int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
    ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
    y = np.zeros_like(x)
    for ch in range(2):
        full = signal.fftconvolve(np.concatenate([x[ch], x[ch]]), ir[ch])[:2 * NT]
        y[ch] = full[NT:2 * NT]
    return y


dry = air * 0.8 + birds + fx * 0.9 + drone * 0.55 + music * 0.9
wet = hall(music * 1.1 + birds * 1.2 + fx * 0.8 + drone * 0.15, 3.4, 9, 3600)
mix = dry * 0.85 + wet * 0.4
mix = circ(lambda x: hp(x, 30, 2), mix)
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
back_, sr = sf.read(path, always_2d=True)
back_ = back_.T
lines = ['THE MOON GATE - sound verification (measured on the written score.wav)', '']
lines.append(f'duration: {back_.shape[1]} frames = {back_.shape[1] / sr:.6f} s at {sr} Hz, {back_.shape[0]} ch, PCM_24')
lines.append(f'events (loop time): sparrow wings {SP_ARRIVE + 0.1:.2f}-{SP_LAND:.2f} and {SP_LEAVE:.2f}-{SP_LEAVE + 1.1:.2f}, cheeps 6.35 6.62 9.70 {SP_HOP - 0.05:.2f} 13.90 16.50, gust peak {GUST_T:.2f}, creaks {GUST_T - 0.35:.2f} {GUST_T + 1.05:.2f}')
gain = 10 ** ((TARGET_LUFS - L) / 20) * min(1, 10 ** ((CEIL_DB - tp) / 20))
rms = lambda x: 20 * np.log10(np.sqrt(np.mean(x[:, N:2 * N] ** 2)) * 0.85 * gain + 1e-12)
lines.append('component levels (RMS dBFS, dry, after the final gain): music %.1f | breeze+leaves %.1f | birds+sparrow %.1f | chimes+creaks %.1f | drone %.1f' % (rms(music * 0.9), rms(air * 0.8), rms(birds), rms(fx * 0.9), rms(drone * 0.55)))
lines.append(f'integrated loudness (internal BS.1770 meter, looped): {L2:.2f} LUFS; true peak {tp2:.2f} dBTP (4x oversampled)')
d_all = np.abs(np.diff(back_, axis=1))
seam = np.abs(back_[:, 0] - back_[:, -1])
lines.append(f'seam step |x[0] - x[N-1]|: L {seam[0]:.2e}, R {seam[1]:.2e}; ordinary steps: median {np.median(d_all):.2e}, 99.9th pct {np.percentile(d_all, 99.9):.2e}, max {d_all.max():.2e}')
two = np.concatenate([back_, back_], axis=1)
b, a = signal.butter(4, 6000 / (sr / 2), btype='high')
hpx = signal.lfilter(b, a, two, axis=1)[:, N // 2: N // 2 + N]
w = int(0.005 * sr)
e = np.array([np.sum(hpx[:, i:i + w] ** 2) for i in range(0, N - w, w)])
mid = (N // 2) // w
seam_e = e[mid - 1:mid + 2].max()
lines.append(f'click test (>6 kHz energy, 5 ms windows): window at the seam {10 * np.log10(seam_e + 1e-30):.1f} dB; median {10 * np.log10(np.median(e) + 1e-30):.1f} dB; max anywhere {10 * np.log10(e.max() + 1e-30):.1f} dB; seam rank {int(np.sum(e > seam_e))} of {len(e)} windows louder')
loc = np.array([np.sum(hpx[:, (N // 2) + k * w:(N // 2) + (k + 1) * w] ** 2) for k in range(-100, 100) if abs(k) > 2])
lines.append(f'local click test: seam window {10 * np.log10(seam_e + 1e-30):.1f} dB vs the surrounding 1 s: median {10 * np.log10(np.median(loc) + 1e-30):.1f} dB, max {10 * np.log10(loc.max() + 1e-30):.1f} dB')
ok_seam = seam.max() <= np.percentile(d_all, 99.9) and seam_e <= max(loc.max(), np.percentile(e, 99))
try:
    rr2 = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    summ = [l.strip() for l in rr2.stderr.splitlines() if l.strip().startswith(('I:', 'LRA:', 'Peak:'))]
    lines.append('ffmpeg ebur128 (single pass, not looped): ' + ' | '.join(summ[-3:]))
except Exception as ex:  # noqa
    lines.append('ffmpeg ebur128 unavailable: ' + str(ex))
lines.append('')
lines.append(('PASS' if ok_seam else 'CHECK') + '  seamless loop: no step or click at the seam beyond ordinary programme content')
lines.append(('PASS' if abs(L2 - TARGET_LUFS) < 0.5 else 'CHECK') + f'  loudness {L2:.2f} LUFS (target {TARGET_LUFS:.0f})')
lines.append(('PASS' if tp2 < -1.0 else 'FAIL') + f'  true peak {tp2:.2f} dBTP (< -1)')
lines.append(('PASS' if back_.shape[1] == N else 'FAIL') + '  exactly 28.000 s')
txt = '\n'.join(lines)
print(txt)
open(os.path.join(HERE, 'verification.txt'), 'w').write(txt + '\n')
