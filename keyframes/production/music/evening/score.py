#!/usr/bin/env python3
"""THE EVENING WALK - the score: 17.500 s, cued to the picture, resolving as the last keyframe settles.

D dorian walking toward D major. Pizzicato basses take his footsteps, a harp marks the staff, a cello sings the walk,
strings and a choir swell under the scythe's arc and open into the resolution - all from FluidR3_GM through FluidSynth
(each instrument rendered by its own synth, note-ons sent early by the patch's attack time so the audible attack lands
on the cue). Synthesised on top: wind, footsteps in dry grass, the staff's knock, whooshes for the turn and the swing,
two birds, a low drum under the blow; then a hall, mastered to about -16 LUFS / -1.5 dBTP.

    t      picture                                         sound
    0.0    first keyframe, held                            a low D breathes in, very soft
    1.0    the wind rises; tatters stream; ink flecks       wind swells; harp: a falling figure as he lifts his head
    2.5    anticipation, he lifts the scythe                low pizzicato pickup; a dull scrape and a puff
    3.4    he turns to profile                             a short whoosh; the cloth snaps
    3.5    he walks                                        pizzicato D / A on every footstep, dry-grass crunch
    5.0    the camera tracks; the sky warms                cello: a slow line in D dorian over the walk
    6.05   he takes the staff from the brink               harp glissando; a wooden pull and the first knocks
    7.0    descending into the flowers, sun low            strings and warm pad enter; the wind rises with the field
    9.4    he draws the scythe back                        an inhaled swell (reversed whoosh), strings crescendo
    9.95   the swing: the blade sweeps across the sky       a long whoosh, low drum + choir on Bb, cymbal-like air
   10.4    it settles on his shoulder                      the swell lets go to Gm/D; cello resumes, falling
   11.1    birds cross; the sun sets                       two small birds; harp harmonics
   14.55   he stops                                        the last footstep; pizzicato stops; pad holds A
   16.0    the last keyframe settles                       resolution: D major - choir, strings, harp roll, low D
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
PRE = 1.0
NR = N + int(PRE * SR) + SR * 4
RNG = np.random.default_rng(2026)
LUFS_TARGET = -16.0
CEIL_DB = -1.5

# the picture's cues (from the film's own timeline: EVENING.info())
STEPS = [4.785, 5.525, 6.265, 7.006, 7.746, 8.486, 9.226, 10.139, 11.139, 11.895, 12.65, 14.55]
PLANTS = [7.746, 9.226, 11.139, 12.65]
GRAB = 6.05
SW0, SW1 = 9.86, 10.40
WALK0 = 3.52

PIZZ, HARP, CELLO, STR, CHOIR, PAD = 0, 1, 2, 3, 4, 5
PROG = {PIZZ: 45, HARP: 46, CELLO: 42, STR: 48, CHOIR: 52, PAD: 89}
LEAD = {PIZZ: 0.01, HARP: 0.006, CELLO: 0.07, STR: 0.12, CHOIR: 0.14, PAD: 0.25}
PAN = {PIZZ: 54, HARP: 76, CELLO: 50, STR: 64, CHOIR: 66, PAD: 64}
VOL = {PIZZ: 112, HARP: 104, CELLO: 100, STR: 96, CHOIR: 92, PAD: 84}
NAMES = {PIZZ: 'pizzicato', HARP: 'harp', CELLO: 'cello', STR: 'strings', CHOIR: 'choir', PAD: 'warm pad'}

NOTES = []
CC = {c: [] for c in PROG}


def note(ch, p, t, d, v):
    NOTES.append((ch, p, t, d, int(v)))


D1, A1, D2, E2, F2, G2, A2, Bb2, C3 = 26, 33, 38, 40, 41, 43, 45, 46, 48
D3, E3, F3, Fs3, G3, A3, B3, C4 = 50, 52, 53, 54, 55, 57, 59, 60
D4, E4, F4, Fs4, G4, A4, B4, C5, D5, E5, Fs5, A5, D6 = 62, 64, 65, 66, 67, 69, 71, 72, 74, 76, 78, 81, 86


def compose():
    # --- the breath: a low D from the first frame, opening as the wind rises
    note(PAD, D2 + 12, 0.0, 7.0, 54)
    note(PAD, A2 + 12, 1.0, 6.0, 46)
    for t, v in [(0, 30), (0.9, 60), (2.5, 74), (5.0, 70), (7.0, 80), (9.4, 92), (10.1, 104), (11.0, 80), (13.5, 74),
                 (15.6, 70), (16.0, 100), (17.5, 76)]:
        CC[PAD].append((t, 11, v))
    # --- he lifts his head: a falling harp figure on the wind
    for t, p, v in [(1.38, A5, 64), (1.58, Fs5 - 1, 56), (1.78, D5, 60), (2.02, A4, 64)]:
        note(HARP, p, t, 1.4, v)
    # --- the scythe leaves the ground: a low pickup
    note(PIZZ, A1 + 12, 2.56, 0.8, 74)
    note(PIZZ, D2, 2.86, 1.0, 84)
    # --- the walk: pizzicato on every footstep, alternating, a fifth on the stronger beats
    lo = [D2, A1 + 12, D2, C3 - 12, D2, A1 + 12, Bb2 - 12, A1 + 12, D2, G2 - 12, A1 + 12, D2]
    for k, t in enumerate(STEPS):
        v = 78 + 6 * np.sin(k * 0.8) - (14 if k == len(STEPS) - 1 else 0)
        note(PIZZ, lo[k], t, 0.9, v)
        if k % 2 == 0 and k < len(STEPS) - 1:
            note(PIZZ, lo[k] + 12, t + 0.012, 0.7, v - 16)
    # the first lifting step
    note(PIZZ, D2, WALK0 + 0.05, 0.9, 70)
    # --- the cello: a slow line in D dorian as the camera picks him up
    line = [(4.95, A3, 1.20, 70), (6.10, C4, 0.55, 66), (6.62, D4, 1.30, 74), (7.95, E4, 0.70, 70), (8.62, F4, 0.55, 68),
            (9.20, E4, 0.70, 72), (10.40, D4, 1.10, 78), (11.50, C4, 0.62, 70), (12.10, A3, 1.10, 68), (13.25, G3, 0.65, 62),
            (13.90, A3, 1.70, 66)]
    for t0, p, d, v in line:
        note(CELLO, p, t0, d, v)
    for t, v in [(0, 0), (4.8, 60), (5.6, 84), (6.6, 92), (8.5, 86), (9.4, 70), (10.4, 96), (12.0, 84), (14.0, 70),
                 (15.5, 56), (16.0, 90), (17.5, 70)]:
        CC[CELLO].append((t, 11, v))
    # --- the grab: a harp glissando up out of the low D
    for j, p in enumerate([D3, E3, G3, A3, C4, D4, E4, G4, A4]):
        note(HARP, p, GRAB - 0.16 + j * 0.022, 0.9, 38 + 3 * j)
    # harp marks each staff plant
    for k, t in enumerate(PLANTS):
        for j, p in enumerate([[D4, A4], [C4, G4], [D4, A4], [A3, E4]][k]):
            note(HARP, p, t + j * 0.03, 1.2, 62)
    # --- strings: enter with the descent, swell into the swing, open after it
    for p, v in [(D3, 56), (A3, 52), (F4, 46)]:
        note(STR, p, 6.9, 2.5, v)
    for p, v in [(Bb2, 62), (F3, 60), (D4, 58), (F4, 52)]:
        note(STR, p, 9.4, 1.05, v)
    for p, v in [(G2 + 12, 64), (D3, 62), (Bb2 + 12, 58), (G4, 54), (D4, 50)]:
        note(STR, p, 10.45, 2.9, v)
    for p, v in [(A2, 56), (E3, 54), (A3, 50), (61, 46)]:
        note(STR, p, 13.35, 2.4, v)
    for p, v in [(D3, 72), (A3, 68), (D4, 64), (Fs4, 60), (A4, 56)]:
        note(STR, p, 15.85, 1.65, v)
    for t, v in [(0, 40), (6.9, 50), (8.4, 70), (9.4, 66), (9.9, 112), (10.3, 96), (11.0, 74), (13.3, 70), (15.4, 64),
                 (16.0, 110), (17.5, 84)]:
        CC[STR].append((t, 11, v))
    # --- the choir: the blow (Bb), and the resolution (D major)
    for p, v in [(Bb2 + 12, 76), (F3, 72), (D4, 70), (F4, 64)]:
        note(CHOIR, p, 10.02, 1.0, v)
    for p, v in [(D3, 78), (A3, 74), (D4, 70), (Fs4, 66), (A4, 60)]:
        note(CHOIR, p, 15.9, 1.6, v)
    for t, v in [(0, 60), (9.9, 70), (10.1, 108), (10.9, 60), (15.7, 74), (16.1, 110), (17.5, 86)]:
        CC[CHOIR].append((t, 11, v))
    # --- birds: harp harmonics as they cross
    for t0, p, v in [(11.25, A5, 46), (11.55, Fs5, 40), (12.1, D6, 38), (12.6, A5, 34)]:
        note(HARP, p, t0, 0.7, v)
    # --- he stops; the pad holds on A, then the resolution
    note(PAD, A2 + 12, 13.4, 2.4, 50)
    note(PAD, E3, 13.4, 2.4, 44)
    for p, v in [(D3, 66), (A3, 60), (Fs4, 54), (D4, 58)]:
        note(PAD, p, 15.75, 1.75, v)
    for j, p in enumerate([D3, A3, D4, Fs4, A4, D5]):
        note(HARP, p, 15.88 + j * 0.024, 1.6, 84 - 4 * j)
    note(CELLO, D2 + 12, 15.97, 1.55, 78)
    note(PIZZ, D2, 15.99, 1.4, 86)
    note(PIZZ, D1 + 12, 15.99, 1.4, 70)


# --------------------------------------------------------------------------- MIDI
TPS = 1920                     # ticks per second at 120 bpm, PPQ 960


def vlq(n):
    b = [n & 0x7f]
    n >>= 7
    while n:
        b.append((n & 0x7f) | 0x80)
        n >>= 7
    return bytes(reversed(b))


def smf(events, end_t, title=b'THE EVENING WALK'):
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
    """filtered noise with a wandering band: still at first, rising from 1.0, strongest in the open field and the
    flowers, calm as he stops"""
    n = NR
    t = tt(n) - PRE
    out = np.zeros((n, 2))
    bands = [bandnoise(f * 0.6, f * 1.6, n, 40 + k) for k, f in enumerate([240, 480, 960, 1900])]
    centre = 0.8 + 0.7 * np.sin(2 * np.pi * 0.19 * t) * np.sin(2 * np.pi * 0.06 * t + 1) + 0.7 * np.clip((t - 1) / 1.5, 0, 1)
    for k, b in enumerate(bands):
        w = np.exp(-0.5 * ((centre - k) / 0.8) ** 2)
        out += b * w[:, None]
    gust = 1 + 0.4 * np.sin(2 * np.pi * 0.37 * t) + 0.25 * np.sin(2 * np.pi * 0.83 * t + 2)
    a = env([(-1, 0), (1.0, 0), (1.8, 0.8), (2.4, 1.0), (3.5, 0.7), (6.0, 0.7), (7.5, 0.95), (11.5, 0.9), (12.8, 0.55),
             (14.5, 0.2), (16.0, 0.08), (17.5, 0.04)])
    a = a * gust
    pan = 0.5 + 0.3 * np.sin(2 * np.pi * 0.09 * t)
    out[:, 0] *= a * np.sqrt(1 - pan)
    out[:, 1] *= a * np.sqrt(pan)
    return out * 0.2


def crunch(dur, seed, amp, bright=1.0):
    """a footstep in dry grass: a short burst of crackles in a high band over a soft low thud"""
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = tt(n)
    # crackle: sparse impulses, each a tiny decaying click, densest at the start
    x = np.zeros(n)
    k = int(140 * dur)
    pos = (np.sort(r.random(k)) ** 1.8 * n * 0.85).astype(int)
    for p in pos:
        L = int(SR * (0.0015 + 0.003 * r.random()))
        if p + L < n:
            x[p:p + L] += (r.random() * 2 - 1) * np.exp(-np.arange(L) / (L * 0.3))
    x = signal.sosfilt(signal.butter(2, [1600 * bright, 7500], 'bp', fs=SR, output='sos'), x)
    hiss = signal.sosfilt(signal.butter(2, [900, 5000], 'bp', fs=SR, output='sos'), r.standard_normal(n)) * np.exp(-t / 0.05) * 0.35
    thud = np.sin(2 * np.pi * (70 + 40 * np.exp(-t / 0.02)) * t) * np.exp(-t / 0.045) * 0.7
    y = (x * 1.6 + hiss + thud) * amp
    y *= np.minimum(1, t / 0.002)
    return np.stack([y, y * (0.85 + 0.1 * r.random())], 1)


def knock(amp):
    """the staff's foot on the ground: a woody knock"""
    n = int(0.35 * SR)
    t = tt(n)
    y = (np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.03) + 0.5 * np.sin(2 * np.pi * 420 * t) * np.exp(-t / 0.012)
         + 0.3 * RNG.standard_normal(n) * np.exp(-t / 0.006))
    y = signal.sosfilt(signal.butter(2, [90, 3000], 'bp', fs=SR, output='sos'), y) * amp
    return np.stack([y * 0.9, y], 1)


def whoosh(dur, f0, f1, amp, seed, shape=1.0, reverse=False):
    """band-passed noise whose centre sweeps f0 -> f1, swelling and passing (a blade through air)"""
    n = int(dur * SR)
    t = tt(n) / dur
    r = np.random.default_rng(seed)
    z = r.standard_normal((n, 2))
    out = np.zeros((n, 2))
    seg = 1024
    fc = f0 * (f1 / f0) ** (t ** shape)
    for i in range(0, n, seg):
        f = fc[min(n - 1, i + seg // 2)]
        sos = signal.butter(2, [max(60, f * 0.55), min(SR / 2 - 100, f * 1.8)], 'bp', fs=SR, output='sos')
        out[i:i + seg] = signal.sosfilt(sos, z[i:i + seg + 0], axis=0)[:len(out[i:i + seg])]
    e = np.sin(np.pi * np.clip(t, 0, 1)) ** 2 * (0.4 + 0.6 * t)
    if reverse:
        e = np.clip(t, 0, 1) ** 2.2
    out *= e[:, None] * amp
    pan = 0.3 + 0.4 * t
    out[:, 0] *= np.sqrt(1 - pan)
    out[:, 1] *= np.sqrt(pan)
    return out


def drum(amp):
    """a low drum under the blow"""
    n = int(1.6 * SR)
    t = tt(n)
    f = 52 + 50 * np.exp(-t / 0.05)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.45) + 0.2 * RNG.standard_normal(n) * np.exp(-t / 0.02)
    y = signal.sosfilt(signal.butter(2, 900, 'lp', fs=SR, output='sos'), y) * amp
    return np.stack([y, y], 1)


def bird(dur, amp, seed, pan):
    """a small bird: quick falling chirps"""
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    y = np.zeros(n)
    t0 = 0.0
    while t0 < dur - 0.12:
        L = int(SR * (0.05 + 0.05 * r.random()))
        tl = np.arange(L) / SR
        f = (4200 + 1500 * r.random()) * np.exp(-tl / 0.06) + 2400
        ch = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tl / tl[-1]) ** 2
        i0 = int(t0 * SR)
        y[i0:i0 + L] += ch[:max(0, min(L, n - i0))]
        t0 += 0.09 + 0.22 * r.random()
    y *= amp
    return np.stack([y * np.sqrt(1 - pan), y * np.sqrt(pan)], 1)


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
CUEW = [(0, 1), (1, 3.4), (3.5, 6), (6, 9.4), (9.4, 10.6), (10.6, 14.6), (14.6, 16), (16, 17.5)]


def main():
    compose()
    with tempfile.TemporaryDirectory() as tmp:
        stems = {NAMES[c]: render_channel(c, tmp) for c in PROG}
    write_score_mid(os.path.join(HERE, 'score.mid'))
    synth = {'wind': wind()}
    steps = np.zeros((NR, 2))
    # the scythe's blade leaves the ground: a dull scrape
    place(steps, 2.62, crunch(0.35, 3, 0.5, bright=0.6))
    # the first step out of the stand, then every footfall; quieter as the camera pulls away, louder as it closes in
    for k, t in enumerate([WALK0 + 0.08] + STEPS):
        a = 0.62 * (1.0 - 0.35 * np.clip((t - 6.5) / 2.0, 0, 1) + 0.25 * np.clip((t - 11.0) / 2.0, 0, 1))
        place(steps, t - 0.012, crunch(0.24 + 0.06 * (k % 2), 100 + k, a, bright=1.1 if t < 6.3 else 0.85))
    synth['footsteps'] = steps
    st = np.zeros((NR, 2))
    place(st, GRAB + 0.04, crunch(0.4, 77, 0.22, bright=0.5))           # the staff pulled from the earth
    for t in PLANTS:
        place(st, t - 0.005, knock(0.55))
    synth['staff'] = st
    wh = np.zeros((NR, 2))
    place(wh, 3.34, whoosh(0.42, 300, 1400, 0.5, 5))                     # the turn: the cloth swings round
    place(wh, 9.40, whoosh(0.5, 900, 260, 0.35, 6, reverse=True))        # the wind-up: an inhaled swell
    place(wh, SW0 - 0.02, whoosh(0.72, 260, 2600, 1.15, 7, shape=0.7))  # the swing
    place(wh, SW0 + 0.2, whoosh(0.9, 2400, 500, 0.45, 8))                # the air settling behind the blade
    synth['whoosh'] = wh
    dr = np.zeros((NR, 2))
    place(dr, 10.06, drum(0.75))
    synth['drum'] = dr
    bd = np.zeros((NR, 2))
    place(bd, 11.15, bird(0.9, 0.05, 1, 0.75))
    place(bd, 11.6, bird(0.8, 0.04, 2, 0.6))
    place(bd, 12.5, bird(0.6, 0.03, 3, 0.45))
    synth['birds'] = bd
    gain = {'pizzicato': 2.4, 'harp': 2.2, 'cello': 2.4, 'strings': 2.0, 'choir': 1.9, 'warm pad': 1.4,
            'wind': 0.45, 'footsteps': 0.5, 'staff': 0.55, 'whoosh': 0.5, 'drum': 0.38, 'birds': 1.0}
    send = {'pizzicato': 0.3, 'harp': 0.5, 'cello': 0.45, 'strings': 0.5, 'choir': 0.6, 'warm pad': 0.4,
            'wind': 0.12, 'footsteps': 0.12, 'staff': 0.2, 'whoosh': 0.25, 'drum': 0.35, 'birds': 0.3}
    ir = hall_ir()
    bus = np.zeros((NR, 2))
    sends = np.zeros((NR, 2))
    for name, x in list(stems.items()) + list(synth.items()):
        x = x * gain[name]
        x = signal.sosfilt(signal.butter(2, 32, 'hp', fs=SR, output='sos'), x, axis=0)
        bus += x
        sends += x * send[name]
    bus += reverb(sends, ir) * 0.5
    STEMLV.clear()
    for name, x in list(stems.items()) + list(synth.items()):
        xx = x[int(PRE * SR):int(PRE * SR) + N] * gain[name]
        STEMLV[name] = [20 * np.log10(np.sqrt(np.mean(xx[int(a * SR):int(b * SR)] ** 2)) + 1e-9) for a, b in CUEW]
    y = bus[int(PRE * SR):int(PRE * SR) + N]
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
    for t, lab in [(0.3, 'first frame held'), (1.6, 'wind rises, head lifts'), (4.9, 'the walk'), (6.05, 'the staff'),
                   (8.0, 'descending, strings'), (10.0, 'the swing'), (12.0, 'birds, sunset'), (14.6, 'he stops'),
                   (16.05, 'resolution'), (17.0, 'held last frame')]:
        rep.append(f'  {t:5.2f} s  {short_term(out, t, t + 0.4):6.1f} LUFS  {lab}')
    rep.append('footsteps at ' + ', '.join(f'{t:.2f}' for t in [WALK0 + 0.08] + STEPS) + ' s; staff knocks at ' + ', '.join(f'{t:.2f}' for t in PLANTS))
    rep.append(f'swing whoosh {SW0 - 0.02:.2f}-{SW0 + 0.70:.2f} s, drum + choir at 10.02-10.06 s; resolution D major lands at 16.000 s (harp roll 15.880-16.000)')
    rep.append('stem RMS (dBFS, pre-master) in windows ' + ' | '.join(f'{a}-{b}' for a, b in CUEW))
    for k, v in STEMLV.items():
        rep.append(f'  {k:11s} ' + ' '.join(f'{x:6.1f}' for x in v))
    rep.append(f'notes: {len(NOTES)}; instruments: ' + ', '.join(f'{NAMES[c]} (GM {PROG[c]})' for c in PROG))
    open(os.path.join(HERE, 'verification.txt'), 'w').write('\n'.join(rep) + '\n')
    print('\n'.join(rep))


if __name__ == '__main__':
    main()
