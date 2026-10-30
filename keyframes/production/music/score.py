#!/usr/bin/env python3
"""THE RED GATHERS - the score: 17.500 s, cued to the picture, resolving as the last keyframe settles.

D yo-scale (D E G A B), koto, shakuhachi and a warm pad from FluidR3_GM through FluidSynth (each instrument rendered
by its own synth, note-ons sent early by the patch's attack time so the audible attack lands on the cue), joined by
synthesised wind, sea and a singing bowl, put in a hall and mastered to about -16 LUFS / -1.5 dBTP.

    t      picture                                         sound
    0.0    first keyframe, held                            a low D drone breathes in, very soft
    1.0    the wind rises; the first petals leave          wind swells; koto: a falling petal motif (A G E D)
    2.4    he turns back and walks out through the gate    koto walks with him: soft open fifths, one per stride
    4.2    the journey; colour drains                      shakuhachi: a long breathing line over the walking koto
    9.3    the red begins to gather                        the koto climbs and quickens in a spiral; pad swells;
                                                           the wind turns into a whirl
   11.0    the cliff has risen; the ink climbs             sea comes up under everything
   12.55   the wind takes his hat                          a last gust
   12.8    the sun is whole                                singing bowl + koto D/A, the swell lets go
   13.4    birds lift off the cliff, past the sun          high koto harmonics, like calls
   14.0    he sits                                         low koto D, the sea quietens
   16.0    the last keyframe settles                       the resolution: rolled koto D major + pad + low bowl
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
RNG = np.random.default_rng(1729)
LUFS_TARGET = -16.0
CEIL_DB = -1.5

# GM programs and measured-ish attack leads (s)
KOTO, SHAKU, PAD, CELLO = 0, 1, 2, 3
PROG = {KOTO: 107, SHAKU: 77, PAD: 89, CELLO: 42}
LEAD = {KOTO: 0.008, SHAKU: 0.09, PAD: 0.25, CELLO: 0.06}
PAN = {KOTO: 52, SHAKU: 78, PAD: 64, CELLO: 58}
VOL = {KOTO: 110, SHAKU: 96, PAD: 88, CELLO: 80}
NAMES = {KOTO: 'koto', SHAKU: 'shakuhachi', PAD: 'warm pad', CELLO: 'cello'}

NOTES = []                      # (ch, pitch, t, dur, vel)
CC = {c: [] for c in PROG}      # (t, cc, value)


def note(ch, p, t, d, v):
    NOTES.append((ch, p, t, d, int(v)))


def D_(o):
    return 2 + 12 * (o + 1)


# yo scale degrees around D
D3, E3, G3, A3, B3 = 50, 52, 55, 57, 59
D4, E4, Fs4, G4, A4, B4 = 62, 64, 66, 67, 69, 71
D5, E5, G5, A5, B5 = 74, 76, 79, 81, 83
D6, E6 = 86, 88
D2, A2 = 38, 45


def compose():
    # --- drone: a soft open fifth from the first frame on, swelling with the gathering, resolving at 16
    note(PAD, D2 + 12, 0.0, 9.3, 62)
    note(PAD, A2 + 12, 0.0, 9.3, 56)
    # gather: the pad opens to Dadd9 / Esus colour (tension)
    for p, v in [(D3, 52), (A3, 50), (E4, 46), (B4, 40)]:
        note(PAD, p, 9.3, 6.4, v)
    # resolution at 16.0
    for p, v in [(D3, 70), (A3, 66), (D4, 62), (Fs4, 58), (A4, 52)]:
        note(PAD, p, 15.75, 1.75, v)
    # pad expression: breathe in at the start, dip in the journey, swell in the gather, let go at the sun, bloom at 16
    for t, v in [(0, 40), (0.9, 72), (3.0, 76), (6.0, 70), (9.0, 66), (10.5, 84), (12.6, 98), (13.2, 74), (15.2, 66),
                 (15.9, 96), (16.6, 92), (17.5, 70)]:
        CC[PAD].append((t, 11, v))

    # --- the petal motif (the first petals leave the tree)
    for t, p, v in [(1.30, A5, 70), (1.62, G5, 62), (1.92, E5, 66), (2.30, D5, 72)]:
        note(KOTO, p, t, 1.6, v)
    # --- walking: open fifths, one per stride (his gait is ~1.96 steps/s; a pluck every two steps)
    t = 2.42
    k = 0
    pat = [(D3, A3), (D3, A3), (G3, D4), (D3, A3), (E3, B3), (D3, A3), (G3, D4), (A3, E4)]
    while t < 9.2:
        lo, hi = pat[k % len(pat)]
        v = 64 + 8 * np.sin(k * 0.9) - 10 * max(0, (t - 7.5) / 1.7)
        note(KOTO, lo, t, 1.2, v)
        note(KOTO, hi, t + 0.035, 1.0, v - 8)
        if k % 4 == 3:
            note(KOTO, [E4, G4, A4, B4][(k // 4) % 4], t + 0.51, 0.8, v - 14)
        t += 1.02
        k += 1
    # --- shakuhachi: the journey
    phrase = [(4.20, A4, 1.30, 68), (5.55, B4, 0.42, 62), (6.00, D5, 1.45, 74), (7.55, E5, 0.45, 66), (8.05, D5, 0.55, 62),
              (8.62, B4, 0.85, 58)]
    for t0, p, d, v in phrase:
        note(SHAKU, p, t0, d, v)
    for t, v in [(0, 0), (4.0, 54), (4.6, 92), (5.4, 70), (6.2, 96), (7.3, 80), (8.0, 88), (9.4, 40), (9.6, 0),
                 (13.3, 0), (13.4, 70), (15.6, 50), (17.5, 30)]:
        CC[SHAKU].append((t, 11, v))
    # --- the gathering: a rising, quickening koto spiral (9.3 -> 12.8)
    scale = [D4, E4, G4, A4, B4, D5, E5, G5, A5, B5]
    t = 9.3
    i = 0
    while t < 12.72:
        u = (t - 9.3) / 3.42
        ioi = 0.27 * (1 - u) + 0.075 * u
        p = scale[(i * 3) % len(scale)] if u < 0.5 else scale[min(len(scale) - 1, 3 + (i % 7))]
        note(KOTO, p, t, 0.7, 50 + 28 * u)
        if i % 3 == 0:
            note(KOTO, scale[i % 5] - 12, t + 0.01, 0.9, 34 + 30 * u)
        t += ioi
        i += 1
    # the sun is whole
    note(KOTO, D4, 12.80, 2.4, 72)
    note(KOTO, A4, 12.82, 2.4, 66)
    note(KOTO, D5, 12.84, 2.4, 62)
    note(CELLO, D2 + 12, 12.80, 3.2, 52)
    CC[CELLO] += [(0, 11, 90), (12.8, 11, 96), (14.0, 11, 70), (16.0, 11, 100), (17.5, 11, 70)]
    # birds: high, sparse calls
    for t0, p, v in [(13.45, E6, 44), (13.70, D6, 38), (14.05, B5, 40), (14.55, E6, 34), (14.80, D6, 32), (15.25, B5, 28)]:
        note(KOTO, p, t0, 0.6, v)
    note(SHAKU, A5, 13.4, 0.9, 50)
    note(SHAKU, B5, 14.25, 0.5, 40)
    # he sits
    note(KOTO, D3, 14.05, 1.8, 48)
    # the resolution: rolled koto D major, landing on 16.0
    for j, p in enumerate([D3, A3, D4, Fs4, A4, D5]):
        note(KOTO, p, 15.88 + j * 0.024, 1.6, 88 - 4 * j)
    note(CELLO, D2 + 12, 15.98, 1.55, 72)
    note(CELLO, D2, 15.98, 1.55, 62)


# --------------------------------------------------------------------------- MIDI
TPS = 1920                     # ticks per second at 120 bpm, PPQ 960


def vlq(n):
    b = [n & 0x7f]
    n >>= 7
    while n:
        b.append((n & 0x7f) | 0x80)
        n >>= 7
    return bytes(reversed(b))


def smf(events, end_t, title=b'THE RED GATHERS'):
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


def wind():
    """filtered noise whose band wanders; gusts; a whirl during the gathering; a last gust at 12.55"""
    n = NR
    t = tt(n) - PRE
    out = np.zeros((n, 2))
    # three bands, crossfaded by a slowly wandering centre
    bands = [bandnoise(f * 0.6, f * 1.6, n, 10 + k) for k, f in enumerate([260, 520, 1050, 2100])]
    centre = 0.9 + 0.8 * np.sin(2 * np.pi * 0.17 * t) * np.sin(2 * np.pi * 0.05 * t + 1) + 0.6 * np.clip((t - 1) / 2, 0, 1)
    whirl = np.clip((t - 9.3) / 3.4, 0, 1) * (t < 12.9)
    centre = centre + 1.3 * whirl * (0.5 + 0.5 * np.sin(2 * np.pi * (1.2 + 2.5 * whirl) * t))
    for k, b in enumerate(bands):
        w = np.exp(-0.5 * ((centre - k) / 0.8) ** 2)
        out += b * w[:, None]
    gust = 1 + 0.35 * np.sin(2 * np.pi * 0.31 * t) + 0.25 * np.sin(2 * np.pi * 0.73 * t + 2)
    a = env([(-1, 0), (1.0, 0), (2.2, 0.75), (3.2, 1.0), (6.0, 0.8), (9.0, 0.6), (11.0, 0.9), (12.7, 0.8), (13.4, 0.35),
             (15.0, 0.12), (16.0, 0.04), (17.5, 0.02)])
    a = a * gust
    # the hat: a short gust
    a = a + 0.55 * np.exp(-0.5 * ((t - 12.6) / 0.22) ** 2)
    # slow stereo drift
    pan = 0.5 + 0.3 * np.sin(2 * np.pi * 0.11 * t)
    out[:, 0] *= a * np.sqrt(1 - pan)
    out[:, 1] *= a * np.sqrt(pan)
    return out * 0.20


def sea():
    """low wash, with waves every ~3.4 s; up under the arrival; quiet as the sea stills"""
    n = NR
    t = tt(n) - PRE
    x = bandnoise(80, 900, n, 31, 2) * 0.8 + bandnoise(900, 4500, n, 32, 2) * 0.25
    wave = 0.55 + 0.45 * np.sin(2 * np.pi * (t / 3.4)) ** 2
    a = env([(-1, 0), (4.5, 0), (7.0, 0.35), (10.5, 0.55), (12.5, 0.85), (14.0, 0.6), (15.5, 0.28), (16.2, 0.15),
             (17.5, 0.1)])
    return x * (a * wave)[:, None] * 0.22


def bowl(f0, dur, amp):
    n = int(dur * SR)
    t = tt(n)
    y = np.zeros(n)
    for k, (m, dec, a) in enumerate([(1.0, 3.0, 1.0), (2.76, 1.8, 0.45), (5.40, 1.1, 0.22), (8.93, 0.7, 0.1)]):
        beat = 1 + 0.08 * np.sin(2 * np.pi * (1.3 + k) * t)
        y += a * np.sin(2 * np.pi * f0 * m * t + 0.3 * k) * np.exp(-t / dec) * beat
    y *= np.minimum(1, t / 0.004)
    return np.stack([y, y * 0.96], 1) * amp


def place(buf, t, sig):
    i0 = int(round((t + PRE) * SR))
    m = min(len(sig), len(buf) - i0)
    if m > 0:
        buf[i0:i0 + m] += sig[:m]


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
CUEW = [(0, 1), (1.2, 2.4), (3, 9), (9.3, 12.7), (12.8, 13.8), (13.8, 15.8), (16, 17.5)]


def main():
    compose()
    with tempfile.TemporaryDirectory() as tmp:
        stems = {NAMES[c]: render_channel(c, tmp) for c in PROG}
    write_score_mid(os.path.join(HERE, 'score.mid'))
    synth = {'wind': wind(), 'sea': sea()}
    b = np.zeros((NR, 2))
    place(b, 12.80, bowl(146.83, 5.0, 0.10))      # D3: the sun is whole
    place(b, 15.99, bowl(73.42, 4.0, 0.14))       # D2: the last frame settles
    synth['bowl'] = b
    gain = {'koto': 2.6, 'shakuhachi': 2.4, 'warm pad': 1.6, 'cello': 1.5, 'wind': 0.4, 'sea': 0.55, 'bowl': 0.2}
    send = {'koto': 0.45, 'shakuhachi': 0.55, 'warm pad': 0.4, 'cello': 0.35, 'wind': 0.15, 'sea': 0.1, 'bowl': 0.5}
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
    for t, lab in [(0.3, 'first frame held'), (1.6, 'wind + petal motif'), (5.0, 'journey'), (11.5, 'the gathering'),
                   (12.9, 'the sun is whole'), (14.2, 'he sits'), (16.05, 'resolution'), (17.0, 'held last frame')]:
        rep.append(f'  {t:5.2f} s  {short_term(out, t, t + 0.4):6.1f} LUFS  {lab}')
    rep.append(f'resolution chord lands at 16.000 s (koto roll 15.880-16.000, pad and cello under it, low bowl at 15.990)')
    rep.append('stem RMS (dBFS, pre-master) in windows ' + ' | '.join(f'{a}-{b}' for a, b in CUEW))
    for k, v in STEMLV.items():
        rep.append(f'  {k:11s} ' + ' '.join(f'{x:6.1f}' for x in v))
    rep.append(f'notes: {len(NOTES)}; instruments: ' + ', '.join(f'{NAMES[c]} (GM {PROG[c]})' for c in PROG))
    open(os.path.join(HERE, 'verification.txt'), 'w').write('\n'.join(rep) + '\n')
    print('\n'.join(rep))


if __name__ == '__main__':
    main()
