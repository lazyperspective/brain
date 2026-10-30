#!/usr/bin/env python3
"""THE SOWER - the score: 17.500 s, cued to the picture, resolving as the last keyframe settles.

Warm and earthy, slightly eerie turning gentle. D, from a minor-ninth rub over a low drone (the reaper on bare
ground) through open fifths (the earth lifting) to D major (the flowers). Cello, a warm pad, harp, kalimba and an
alto flute from FluidR3_GM through FluidSynth (each instrument on its own synth), with synthesised dry wind, the
earth's low rumble as the ground hinges up, the swing of the scythe, soft seed-ticks as the seeds land and small
rising "growth" chirps as the flowers open. Mastered to about -16 LUFS / -1.5 dBTP.

    t      picture                                         sound
    0.0    first keyframe, held                            low D drone, a dry breath of wind
    1.0    the flecks drift; the sky begins to warm        cello D2 with an Eb rub above it: the eerie colour
    2.2    the ground hinges up into the slope             the earth's rumble swells; strings open to D-A
    2.6    he lifts the scythe and swings it over          a long filtered whoosh following the blade
    4.3    the flecks burst into seed                      celesta grace notes
    6.0    seeds land on the slope, flowers grow           a soft tick per landing; kalimba blooms climb the
                                                           D major pentatonic; small rising growth chirps
    8.5    the navy cloak, the hood's shadow               alto flute: a gentle line (A B D E F#)
   10.4    the staff grows up into his hand                cello glides up D3 -> A3
   12.4    the bindings wind round him                     a harp glissando up
   13.8    two flecks have become birds; they settle       two short flute calls
   16.0    the last keyframe settles                       the resolution: harp + kalimba roll on D major,
                                                           pad and cello under it
   17.5    end                                             (tail, faded over the last 0.35 s)

    python3 score.py      (needs fluidsynth, numpy, scipy, soundfile; FluidR3_GM at /usr/share/sounds/sf2)
Writes score.wav (48 kHz / 24-bit / stereo, exactly 17.500 s), score.mid and verification.txt.
"""
import os, struct, subprocess, tempfile
import numpy as np
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
SF2 = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
SR = 48000
D = 17.5
N = int(round(SR * D))
PRE = 1.0                      # pre-roll so early-sent attacks have room
NR = N + int(PRE * SR) + SR * 4
RNG = np.random.default_rng(2207)
LUFS_TARGET = -16.0
CEIL_DB = -1.5

# GM programs and attack leads (s)
CELLO, PAD, HARP, KAL, FLUTE, CELE = 0, 1, 2, 3, 4, 5
PROG = {CELLO: 42, PAD: 89, HARP: 46, KAL: 108, FLUTE: 73, CELE: 8}
LEAD = {CELLO: 0.07, PAD: 0.25, HARP: 0.006, KAL: 0.004, FLUTE: 0.06, CELE: 0.004}
PAN = {CELLO: 54, PAD: 64, HARP: 44, KAL: 80, FLUTE: 70, CELE: 86}
VOL = {CELLO: 100, PAD: 90, HARP: 104, KAL: 100, FLUTE: 92, CELE: 80}
NAMES = {CELLO: 'cello', PAD: 'warm pad', HARP: 'harp', KAL: 'kalimba', FLUTE: 'flute', CELE: 'celesta'}

NOTES = []                      # (ch, pitch, t, dur, vel)
CC = {c: [] for c in PROG}      # (t, cc, value)


def note(ch, p, t, d, v):
    NOTES.append((ch, p, t, d, int(max(1, min(127, v)))))


D2, A2, D3, Eb3, E3, Fs3, G3, A3, B3 = 38, 45, 50, 51, 52, 54, 55, 57, 59
D4, E4, Fs4, G4, A4, B4, Cs5, D5, E5, Fs5, A5, B5, D6, E6, Fs6 = 62, 64, 66, 67, 69, 71, 73, 74, 76, 78, 81, 83, 86, 88, 90
PENTA = [D4, E4, Fs4, A4, B4, D5, E5, Fs5, A5, B5, D6]
BLOOMS = []                     # times of the growth chirps


def compose():
    # --- the drone and the eerie rub (0 - 4.5), opening into fifths as the earth lifts
    note(CELLO, D2, 0.0, 6.2, 70)
    note(CELLO, Eb3, 1.0, 3.4, 46)          # the minor-ninth rub over the reaper on bare ground
    note(CELLO, A2, 2.3, 4.6, 58)           # the fifth arrives with the lifting earth
    note(CELLO, D3, 4.4, 4.2, 52)
    CC[CELLO] += [(0, 11, 50), (1.0, 11, 80), (3.0, 11, 100), (6.0, 11, 84), (8.6, 11, 70), (10.4, 11, 90), (12.8, 11, 80),
                  (15.6, 11, 96), (17.5, 11, 70)]
    # pad: D5th -> Dsus2 -> Bm7/D -> G/D -> A/D -> D
    for p, v in [(D3, 46), (A3, 40)]:
        note(PAD, p, 0.0, 4.4, v)
    for p, v in [(D3, 52), (A3, 48), (E4, 44)]:
        note(PAD, p, 4.3, 3.9, v)
    for p, v in [(D3, 54), (Fs3, 48), (B3, 50), (A4, 40)]:
        note(PAD, p, 8.1, 2.5, v)
    for p, v in [(D3, 54), (G3, 50), (B3, 48), (D4, 44)]:
        note(PAD, p, 10.5, 2.4, v)
    for p, v in [(D3, 56), (A3, 52), (Cs5 - 12, 48), (E4, 46)]:
        note(PAD, p, 12.8, 3.0, v)
    for p, v in [(D3, 66), (A3, 62), (D4, 58), (Fs4, 56), (A4, 50)]:
        note(PAD, p, 15.75, 1.75, v)
    CC[PAD] += [(0, 11, 50), (1.5, 11, 66), (4.0, 11, 74), (8.0, 11, 86), (12.0, 11, 90), (15.2, 11, 82), (15.95, 11, 104),
                (17.5, 11, 88)]
    # --- seeds burst: celesta grace notes
    for t0, p, v in [(4.35, A5, 48), (4.52, Fs5, 44), (4.71, D6, 42), (4.95, B5, 40), (5.22, E6, 36), (5.45, A5, 34)]:
        note(CELE, p, t0, 0.5, v)
    # --- the flowers: kalimba blooms climbing the pentatonic, right to left as the seeds land
    t, k = 6.35, 0
    while t < 13.6:
        u = (t - 6.35) / 7.25
        p = PENTA[min(len(PENTA) - 1, int(2 + u * 7 + (k % 3) - 1))]
        note(KAL, p, t, 0.9, 52 + 22 * np.sin(np.pi * u) - 6 * (k % 2))
        BLOOMS.append(t + 0.05)
        t += 0.24 + 0.16 * ((k * 7) % 5) / 4
        k += 1
    # --- the flute's line
    for t0, p, d, v in [(8.6, A4, 0.9, 64), (9.55, B4, 0.55, 60), (10.15, D5, 1.3, 70), (11.6, E5, 0.5, 62),
                        (12.15, Fs5, 1.5, 72), (13.8, A5, 0.25, 50), (14.1, Fs5, 0.25, 46), (14.55, A5, 0.25, 44),
                        (14.85, Fs5, 0.6, 42), (15.95, Fs5, 1.5, 58)]:
        note(FLUTE, p, t0, d, v)
    CC[FLUTE] += [(0, 11, 0), (8.4, 11, 70), (9.2, 11, 92), (10.8, 11, 100), (12.6, 11, 104), (13.6, 11, 76), (15.9, 11, 90),
                  (17.5, 11, 70)]
    # --- the staff grows: cello glides (stepwise) up
    for j, p in enumerate([D3, E3, Fs3, G3, A3]):
        note(CELLO, p, 10.4 + 0.5 * j, 0.62 if j < 4 else 2.2, 54 + 3 * j)
    # --- the bindings: a harp glissando up
    for j, p in enumerate([D3, E3, Fs3, A3, B3, D4, E4, Fs4, A4, B4, D5, E5, Fs5, A5]):
        note(HARP, p, 12.4 + 0.11 * j, 1.6, 40 + 2 * j)
    # --- the resolution: harp and kalimba roll, cello root, landing on 16.0
    for j, p in enumerate([D3, A3, D4, Fs4, A4, D5]):
        note(HARP, p, 15.86 + j * 0.028, 1.6, 82 - 4 * j)
    for j, p in enumerate([D5, Fs5, A5]):
        note(KAL, p, 15.94 + j * 0.03, 1.2, 60 - 4 * j)
    note(CELLO, D2, 15.97, 1.6, 74)


# --------------------------------------------------------------------------- MIDI
TPS = 1920                     # ticks per second at 120 bpm, PPQ 960


def vlq(n):
    b = [n & 0x7f]
    n >>= 7
    while n:
        b.append((n & 0x7f) | 0x80)
        n >>= 7
    return bytes(reversed(b))


def smf(events, end_t, title=b'THE SOWER'):
    """events: [(t_seconds, order, bytes)] -> type-0 SMF at 120 bpm"""
    ev = sorted(events, key=lambda e: (e[0], e[1]))
    tr, last = bytearray(), 0
    tr += b'\x00\xff\x03' + vlq(len(title)) + title
    tr += b'\x00\xff\x51\x03' + (500000).to_bytes(3, 'big')
    for t, _, data in ev:
        tk = max(0, int(round(t * TPS)))
        tr += vlq(tk - last) + data
        last = tk
    tr += vlq(max(0, int(end_t * TPS) - last)) + b'\xff\x2f\x00'
    return b'MThd' + struct.pack('>IHHH', 6, 0, 1, 960) + b'MTrk' + struct.pack('>I', len(tr)) + bytes(tr)


def channel_events(ch, offset, lead=True):
    ev = [(0, 0, bytes([0xC0 | ch, PROG[ch]])), (0, 0, bytes([0xB0 | ch, 7, VOL[ch]])),
          (0, 0, bytes([0xB0 | ch, 10, PAN[ch]])), (0, 0, bytes([0xB0 | ch, 91, 0])), (0, 0, bytes([0xB0 | ch, 93, 0]))]
    # same-key overlaps: cut the earlier note
    ns = sorted([n for n in NOTES if n[0] == ch], key=lambda n: (n[1], n[2]))
    for i, (c, p, t, d, v) in enumerate(ns):
        t0 = offset + t - (LEAD[ch] if lead else 0)
        t1 = offset + t + d
        if i + 1 < len(ns) and ns[i + 1][1] == p:
            t1 = min(t1, offset + ns[i + 1][2] - (LEAD[ch] if lead else 0) - 0.003)
        ev.append((t0, 3, bytes([0x90 | ch, p, max(1, min(127, v))])))
        ev.append((t1, 1, bytes([0x80 | ch, p, 0])))
    pts = sorted(CC[ch]) or [(0, 11, 100)]
    tt = np.arange(0, D + 1e-9, 0.02)
    vals = np.interp(tt, [p[0] for p in pts], [p[2] for p in pts]) if len(pts) > 1 else np.full(len(tt), pts[0][2])
    last = None
    for t, v in zip(tt, vals):
        v = int(round(v))
        if v != last:
            ev.append((offset + t, 2, bytes([0xB0 | ch, 11, v])))
            last = v
    return ev


def render_channel(ch, tmp):
    mid, wav = os.path.join(tmp, f'c{ch}.mid'), os.path.join(tmp, f'c{ch}.wav')
    with open(mid, 'wb') as f:
        f.write(smf(channel_events(ch, PRE), PRE + D + 3.5))
    subprocess.run(['fluidsynth', '-ni', '-q', '-R', '0', '-C', '0', '-r', str(SR), '-g', '0.5', '-o', 'synth.polyphony=256',
                    '-O', 'float', '-T', 'wav', '-F', wav, SF2, mid], check=True, capture_output=True)
    x, sr = sf.read(wav, dtype='float64', always_2d=True)
    assert sr == SR
    y = np.zeros((NR, 2))
    m = min(NR, len(x))
    y[:m] = x[:m]
    return y


def write_score_mid(path):
    ev = []
    for ch in PROG:
        ev += channel_events(ch, 0.0, lead=False)
    with open(path, 'wb') as f:
        f.write(smf(ev, D))


# --------------------------------------------------------------------------- synthesised layers
def tt(n):
    return np.arange(n) / SR


def env(points, n=NR, offset=PRE):
    t = tt(n) - offset
    return np.interp(t, [p[0] for p in points], [p[1] for p in points])


def bandnoise(lo, hi, n, seed, order=2):
    r = np.random.default_rng(seed)
    x = r.standard_normal((n, 2))
    sos = signal.butter(order, [lo, hi], 'bp', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=0)


def place(buf, t, sig):
    i0 = int(round((t + PRE) * SR))
    m = min(len(sig), len(buf) - i0)
    if m > 0:
        buf[i0:i0 + m] += sig[:m]


def wind():
    """a dry, thin wind over the bare ground; it warms and thins out as the hill fills with grass"""
    t = tt(NR) - PRE
    x = bandnoise(500, 2400, NR, 61) * 0.7 + bandnoise(2400, 6000, NR, 62) * 0.25
    a = env([(-1, 0.3), (0.0, 0.35), (1.0, 0.55), (3.0, 0.6), (7.0, 0.45), (11.0, 0.25), (15.0, 0.15), (17.5, 0.1)])
    a = a * (1 + 0.3 * np.sin(2 * np.pi * 0.23 * t) + 0.2 * np.sin(2 * np.pi * 0.61 * t + 1))
    return x * a[:, None] * 0.12


def earth():
    """the ground hinging up: a low rumble with a rising sub tone (2.5 - 7.2)"""
    t = tt(NR) - PRE
    r = bandnoise(30, 160, NR, 63, 2)
    a = env([(-1, 0), (2.0, 0), (3.2, 0.7), (5.8, 1.0), (7.2, 0.3), (8.3, 0)])
    f = 38 + 14 * np.clip((t - 2.2) / 4.8, 0, 1)
    ph = 2 * np.pi * np.cumsum(f) / SR
    sub = np.sin(ph) * env([(-1, 0), (2.2, 0), (3.7, 0.5), (6.6, 0.6), (7.4, 0)])
    return (r * a[:, None] * 0.8 + sub[:, None] * 0.25) * 0.5


def whoosh():
    """the scythe's long swing: band noise whose centre follows the blade up and over (3.1 - 9.2)"""
    t = tt(NR) - PRE
    out = np.zeros((NR, 2))
    u = np.clip((t - 2.6) / 6.4, 0, 1)
    centre = 300 + 2600 * np.sin(np.pi * u) ** 1.5
    bands = [(200, 600), (500, 1400), (1200, 3200), (2800, 7000)]
    for k, (lo, hi) in enumerate(bands):
        b = bandnoise(lo, hi, NR, 70 + k)
        c = np.sqrt(lo * hi)
        w = np.exp(-0.5 * (np.log(centre / c) / 0.5) ** 2)
        out += b * w[:, None]
    a = env([(-1, 0), (2.5, 0), (3.5, 0.5), (5.8, 1.0), (8.4, 0.5), (9.4, 0)])
    pan = 0.25 + 0.5 * u
    out[:, 0] *= a * np.sqrt(1 - pan)
    out[:, 1] *= a * np.sqrt(pan)
    return out * 0.16


def seedticks():
    """a soft tick as each seed lands (6.0 - 11.6), and a small rising chirp as each flower opens"""
    buf = np.zeros((NR, 2))
    r = np.random.default_rng(5)
    n = 82
    for j in range(n):
        tl = 6.0 + 5.2 * j / (n - 1) + 0.4 * r.random()
        m = int(0.025 * SR)
        tk = r.standard_normal(m) * np.exp(-np.arange(m) / (0.004 * SR))
        tk = signal.sosfilt(signal.butter(2, [1800, 6000], 'bp', fs=SR, output='sos'), tk)
        pan = 0.85 - 0.7 * j / n
        place(buf, tl, np.stack([tk * np.sqrt(1 - pan), tk * np.sqrt(pan)], 1) * 0.10)
    for k, tb in enumerate(BLOOMS):
        m = int(0.22 * SR)
        tt_ = np.arange(m) / SR
        f0 = 900 + 120 * (k % 5)
        f = f0 * (1 + 1.4 * tt_ / 0.22)
        y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt_ / 0.22) ** 2
        pan = 0.8 - 0.6 * k / max(1, len(BLOOMS))
        place(buf, tb + 0.12, np.stack([y * np.sqrt(1 - pan), y * np.sqrt(pan)], 1) * 0.035)
    return buf


def hall_ir(rt60=2.6, pre=0.02):
    r = np.random.default_rng(7)
    n = int((rt60 * 1.2 + pre) * SR)
    t = tt(n)
    ir = np.zeros((n, 2))
    for lo, hi, rt in [(None, 300, rt60 * 1.1), (300, 3000, rt60), (3000, None, rt60 * 0.55)]:
        z = r.standard_normal((n, 2))
        if lo and hi:
            z = signal.sosfilt(signal.butter(2, [lo, hi], 'bp', fs=SR, output='sos'), z, axis=0)
        elif hi:
            z = signal.sosfilt(signal.butter(2, hi, 'lp', fs=SR, output='sos'), z, axis=0)
        else:
            z = signal.sosfilt(signal.butter(2, lo, 'hp', fs=SR, output='sos'), z, axis=0)
        ir += z * np.exp(-6.91 * t / rt)[:, None]
    ir *= np.minimum(1, t / 0.05)[:, None] ** 1.5
    k0 = int(pre * SR)
    ir = np.concatenate([np.zeros((k0, 2)), ir])[:n]
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


def reverb(x, ir):
    return np.stack([signal.fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in range(2)], 1)


# --------------------------------------------------------------------------- loudness
def k_weight(x):
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)


def lufs(x):
    y = k_weight(x)
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    p = np.sum(y ** 2, 1)
    c = np.concatenate([[0], np.cumsum(p)])
    st = np.arange(0, len(p) - blk + 1, hop)
    z = (c[st + blk] - c[st]) / blk
    l = -0.691 + 10 * np.log10(z + 1e-20)
    z1 = z[l > -70]
    rel = -0.691 + 10 * np.log10(np.mean(z1)) - 10
    return -0.691 + 10 * np.log10(np.mean(z[(l > -70) & (l > rel)]))


def short_term(x, t0, t1):
    y = k_weight(x[int(t0 * SR):int(t1 * SR)])
    return -0.691 + 10 * np.log10(np.mean(np.sum(y ** 2, 1)) + 1e-20)


def true_peak(x):
    return np.abs(signal.resample_poly(x, 4, 1, axis=0)).max()


def limiter(x, ceil_db, rel=0.12):
    ceil = 10 ** (ceil_db / 20)
    up = np.abs(signal.resample_poly(x, 4, 1, axis=0)).max(1)
    pk = up[:len(up) // 4 * 4].reshape(-1, 4).max(1)
    pk = np.pad(pk, (0, max(0, len(x) - len(pk))), constant_values=0)[:len(x)]
    req = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    look = int(0.003 * SR)
    req = np.minimum.reduce([np.roll(req, -k) for k in range(0, look, 8)] + [req])
    g = req.copy()
    cr = np.exp(-1 / (rel * SR))
    for i in range(1, len(g)):
        g[i] = min(req[i], cr * g[i - 1] + (1 - cr))
    return x * g[:, None]


STEMLV = {}
CUEW = [(0, 1), (1, 2.5), (2.5, 6), (6, 9), (9, 12), (12, 15.8), (16, 17.5)]


def main():
    compose()
    with tempfile.TemporaryDirectory() as tmp:
        stems = {NAMES[c]: render_channel(c, tmp) for c in PROG}
    write_score_mid(os.path.join(HERE, 'score.mid'))
    synth = {'wind': wind(), 'earth': earth(), 'whoosh': whoosh(), 'seeds': seedticks()}
    gain = {'cello': 2.2, 'warm pad': 1.7, 'harp': 2.4, 'kalimba': 3.2, 'flute': 2.3, 'celesta': 5.0,
            'wind': 0.5, 'earth': 0.42, 'whoosh': 0.6, 'seeds': 1.1}
    send = {'cello': 0.35, 'warm pad': 0.4, 'harp': 0.45, 'kalimba': 0.4, 'flute': 0.5, 'celesta': 0.55,
            'wind': 0.12, 'earth': 0.05, 'whoosh': 0.2, 'seeds': 0.3}
    ir = hall_ir()
    bus = np.zeros((NR, 2))
    sends = np.zeros((NR, 2))
    for name, x in list(stems.items()) + list(synth.items()):
        x = x * gain[name]
        x = signal.sosfilt(signal.butter(2, 35, 'hp', fs=SR, output='sos'), x, axis=0)
        bus += x
        sends += x * send[name]
    bus += reverb(sends, ir) * 0.55
    STEMLV.clear()
    for name, x in list(stems.items()) + list(synth.items()):
        xx = x[int(PRE * SR):int(PRE * SR) + N] * gain[name]
        STEMLV[name] = [20 * np.log10(np.sqrt(np.mean(xx[int(a * SR):int(b * SR)] ** 2)) + 1e-9) for a, b in CUEW]
    # cut the 17.5 s out of the pre-rolled render
    y = bus[int(PRE * SR):int(PRE * SR) + N]
    # fade the last 0.35 s (the film ends on the held frame; no click)
    nf = int(0.35 * SR)
    y[-nf:] *= (np.cos(np.linspace(0, np.pi / 2, nf)) ** 2)[:, None]
    y *= np.minimum(1, np.arange(N) / (0.01 * SR))[:, None]
    g = 0.0
    for _ in range(12):
        z = limiter(y * 10 ** (g / 20), CEIL_DB)
        L = lufs(z)
        if abs(L - LUFS_TARGET) < 0.05:
            break
        g += LUFS_TARGET - L
    out = z
    sf.write(os.path.join(HERE, 'score.wav'), out.astype(np.float32), SR, subtype='PCM_24')
    rep = [f'score.wav: {len(out) / SR:.3f} s, {SR} Hz, stereo, 24-bit',
           f'integrated loudness {lufs(out):.2f} LUFS (target {LUFS_TARGET}), true peak {20 * np.log10(true_peak(out)):.2f} dBTP (ceiling {CEIL_DB})',
           'short-term loudness at the cues (K-weighted, 400 ms):']
    for t, lab in [(0.3, 'first frame held'), (1.5, 'the eerie rub'), (4.5, 'earth lifts, scythe swings'),
                   (8.0, 'seeds land, flowers open'), (10.5, 'flute; the staff grows'), (12.8, 'bindings (harp)'),
                   (16.05, 'resolution'), (17.0, 'held last frame')]:
        rep.append(f'  {t:5.2f} s  {short_term(out, t, t + 0.4):6.1f} LUFS  {lab}')
    rep.append(f'resolution chord lands at 16.000 s (harp roll 15.860-16.000, kalimba, pad, cello and flute F#5 under it)')
    rep.append('stem RMS (dBFS, pre-master) in windows ' + ' | '.join(f'{a}-{b}' for a, b in CUEW))
    for k, v in STEMLV.items():
        rep.append(f'  {k:11s} ' + ' '.join(f'{x:6.1f}' for x in v))
    rep.append(f'notes: {len(NOTES)}; instruments: ' + ', '.join(f'{NAMES[c]} (GM {PROG[c]})' for c in PROG))
    open(os.path.join(HERE, 'verification.txt'), 'w').write('\n'.join(rep) + '\n')
    print('\n'.join(rep))


if __name__ == '__main__':
    main()
