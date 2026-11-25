"""Fully synthesised score + SFX for the park film -> score.wav (48 kHz, 24-bit, seamless 44.0 s loop).

120 BPM, 4/4, 22 bars. Beat grid and event times come from ../plan/shots.json (beats lists) and the
cue list below. Run:  python3 score.py   (needs numpy, scipy, soundfile, pyloudnorm)
"""
import json, math, sys
import numpy as np
from scipy import signal
import soundfile as sf
import pyloudnorm as pyln

SR = 48000
BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT
DUR = 44.0
N = int(DUR * SR)
TAIL = int(4 * SR)
rng = np.random.default_rng(1234)

L = np.zeros(N + TAIL)
Rr = np.zeros(N + TAIL)
VERB_L = np.zeros(N + TAIL)
VERB_R = np.zeros(N + TAIL)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def place(sig, t, pan=0.0, gain=1.0, verb=0.15):
    """mix mono sig at time t (s). pan -1..1 (equal power)."""
    i0 = int(round(t * SR))
    if i0 < 0:
        sig = sig[-i0:]
        i0 = 0
    n = min(len(sig), len(L) - i0)
    if n <= 0:
        return
    a = (pan + 1) * math.pi / 4
    gl, gr = math.cos(a) * gain, math.sin(a) * gain
    L[i0:i0 + n] += sig[:n] * gl
    Rr[i0:i0 + n] += sig[:n] * gr
    if verb:
        VERB_L[i0:i0 + n] += sig[:n] * gl * verb
        VERB_R[i0:i0 + n] += sig[:n] * gr * verb


def tt(d):
    return np.arange(int(d * SR)) / SR


def env_ad(d, a=0.005, dec=None, curve=4.0):
    t = tt(d)
    e = np.minimum(1, t / max(a, 1e-4))
    dec = dec or d
    e *= np.exp(-curve * np.maximum(t - a, 0) / dec)
    # tiny fade out to avoid clicks
    f = min(len(t), int(0.004 * SR))
    if f:
        e[-f:] *= np.linspace(1, 0, f)
    return e


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo / (SR / 2), min(hi / (SR / 2), 0.99)], 'band', output='sos')
    return signal.sosfilt(sos, x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, min(f / (SR / 2), 0.99), 'low', output='sos'), x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f / (SR / 2), 'high', output='sos'), x)


def noise(d):
    return rng.standard_normal(int(d * SR))


def saw(f, d, phase=0):
    t = tt(d)
    if np.ndim(f):
        ph = np.cumsum(f) / SR + phase
    else:
        ph = f * t + phase
    return 2 * (ph % 1.0) - 1


def sine(f, d, phase=0):
    t = tt(d)
    if np.ndim(f):
        return np.sin(2 * np.pi * (np.cumsum(f) / SR) + phase)
    return np.sin(2 * np.pi * f * t + phase)


def square(f, d, duty=0.5):
    t = tt(d)
    ph = (np.cumsum(f) / SR) if np.ndim(f) else f * t
    return np.where((ph % 1.0) < duty, 1.0, -1.0)


# ===================================================================== instruments
def kick(gain=1.0):
    d = 0.45
    t = tt(d)
    f = 45 + 95 * np.exp(-t * 28)
    s = sine(f, d) * env_ad(d, 0.001, 0.32, 3.2)
    click = np.zeros_like(s)
    click[:240] = lp(noise(0.005), 4000)[:240] * np.linspace(1, 0, 240) * 0.6
    return np.tanh((s + click) * 1.4) * gain


def snare(gain=1.0):
    d = 0.28
    n = bp(noise(d), 1200, 9000) * env_ad(d, 0.001, 0.12, 4)
    tone = sine(190, d) * env_ad(d, 0.001, 0.07, 4) * 0.6
    return (n * 0.9 + tone) * gain


def clap(gain=1.0):
    d = 0.25
    s = np.zeros(int(d * SR))
    for k, off in enumerate([0, 0.011, 0.022, 0.034]):
        b = bp(noise(0.2), 900, 5000) * env_ad(0.2, 0.001, 0.05 if k < 3 else 0.12, 4)
        i = int(off * SR)
        s[i:i + len(b)] += b[:len(s) - i]
    return s * gain


def hat(open_=False, gain=1.0):
    d = 0.25 if open_ else 0.06
    return hp(noise(d), 7000, 3) * env_ad(d, 0.001, d * 0.7, 5) * gain


def crash(gain=1.0):
    d = 2.2
    return hp(noise(d), 4000, 2) * env_ad(d, 0.002, 1.5, 4) * gain


def woodblock(f=900, gain=1.0):
    d = 0.12
    return (sine(f, d) + 0.4 * sine(f * 2.7, d)) * env_ad(d, 0.0005, 0.05, 5) * gain


def tuba(m, d, gain=1.0):
    f = mtof(m)
    x = saw(f, d) * 0.6 + sine(f, d)
    x = lp(x, 900)
    e = env_ad(d, 0.02, d * 0.9, 2.5)
    return x * e * gain


def organ_note(m, d, gain=1.0, bright=1.0, vib=True):
    """band-organ / calliope pipe: harmonics + breath + vibrato"""
    f0 = mtof(m)
    t = tt(d)
    f = f0 * (1 + (0.006 * np.sin(2 * np.pi * 6.2 * t) if vib else 0))
    x = sine(f, d) + 0.5 * sine(f * 2, d) + 0.28 * bright * sine(f * 3, d) + 0.15 * bright * sine(f * 4, d) + 0.08 * bright * sine(f * 6, d)
    br = bp(noise(d), f0 * 0.8, min(f0 * 6, 16000)) * 0.08
    a = 0.012
    e = np.minimum(1, t / a) * np.where(t > d - 0.03, np.maximum(0, (d - t) / 0.03), 1)
    return (x + br) * e * 0.35 * gain


def accordion_chord(ms, d, gain=1.0):
    out = np.zeros(int(d * SR))
    for m in ms:
        f = mtof(m)
        x = square(f * 1.003, d, 0.35) * 0.5 + square(f * 0.997, d, 0.4) * 0.5
        out += x
    out = lp(out, 2200)
    t = tt(d)
    e = np.minimum(1, t / 0.008) * np.exp(-2.5 * t) * np.where(t > d - 0.02, np.maximum(0, (d - t) / 0.02), 1)
    return out * e * 0.12 * gain


def glock(m, d=0.9, gain=1.0):
    f = mtof(m)
    x = sine(f, d) + 0.35 * sine(f * 2.76, d) + 0.12 * sine(f * 5.4, d)
    return x * env_ad(d, 0.001, 0.6, 5) * 0.35 * gain


def musicbox(m, d=0.8, gain=1.0):
    f = mtof(m)
    x = sine(f, d) + 0.25 * sine(f * 4.0, d) + 0.1 * sine(f * 6.9, d)
    return x * env_ad(d, 0.0008, 0.5, 6) * 0.3 * gain


def chip(m, d, gain=1.0):
    f = mtof(m)
    x = square(f, d, 0.25)
    e = np.where(tt(d) < d - 0.01, 1.0, 0.0) * np.exp(-1.2 * tt(d))
    return x * e * 0.12 * gain


def pad(ms, d, gain=1.0, cutoff=1800):
    out = np.zeros(int(d * SR))
    for m in ms:
        for det in (-0.08, 0.0, 0.08):
            out += saw(mtof(m + det), d, rng.uniform())
    out = lp(out, cutoff, 2)
    t = tt(d)
    e = np.minimum(1, t / 0.35) * np.minimum(1, np.maximum(0, (d - t) / 0.4))
    return out * e * 0.05 * gain


def subbass(m, d, gain=1.0):
    f = mtof(m)
    x = sine(f, d) + 0.3 * np.tanh(3 * sine(f, d))
    t = tt(d)
    e = np.minimum(1, t / 0.01) * np.minimum(1, np.maximum(0, (d - t) / 0.05))
    return x * e * 0.5 * gain


def pluck(m, d=0.4, gain=1.0):
    f = mtof(m)
    x = saw(f, d)
    x = lp(x, 3000) * env_ad(d, 0.001, 0.15, 5)
    return x * 0.25 * gain


def whoosh(d, f0, f1, gain=1.0, q=1.5):
    """bandpassed noise sweep f0->f1 (Hz) with swell envelope (time-varying via chunks)"""
    n = noise(d)
    out = np.zeros_like(n)
    chunks = 24
    L_ = len(n) // chunks
    for c in range(chunks):
        fc = f0 * (f1 / f0) ** (c / (chunks - 1))
        lo, hi = fc / q, min(fc * q, 20000)
        seg = bp(n[max(0, c * L_ - 2000):(c + 1) * L_], lo, hi)
        out[c * L_:(c + 1) * L_] = seg[-L_:]
    t = tt(d)
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
    return out * e * gain


def riser(d, gain=1.0):
    t = tt(d)
    f = 200 * (8 ** (t / d))
    x = saw(f, d) * 0.3 + whoosh(d, 400, 9000, 1.0) * 0.8
    return lp(x, 12000) * (t / d) ** 2 * gain


def bell(m, d=2.5, gain=1.0):
    f = mtof(m)
    parts = [(1, 1), (2.0, 0.5), (2.76, 0.4), (5.4, 0.25), (8.9, 0.1)]
    x = sum(a * sine(f * p, d) * np.exp(-tt(d) * (2 + p)) for p, a in parts)
    return x * 0.3 * gain


def boing(gain=1.0):
    d = 0.5
    t = tt(d)
    f = 180 + 260 * np.exp(-t * 6) * (1 + 0.3 * np.sin(2 * np.pi * 18 * t))
    return sine(f, d) * env_ad(d, 0.002, 0.4, 4) * 0.5 * gain


def paper_thwack(gain=1.0):
    d = 0.35
    n = noise(d)
    crinkle = np.zeros_like(n)
    for _ in range(40):
        i = rng.integers(0, int(0.25 * SR))
        crinkle[i:i + 60] += rng.standard_normal(60) * rng.uniform(0.2, 1)
    s = lp(n, 2500) * env_ad(d, 0.002, 0.08, 5) * 1.2 + hp(crinkle, 2000) * 0.25
    thump = sine(90, d) * env_ad(d, 0.001, 0.05, 5) * 0.6
    return (s + thump) * gain


def felt_puff(gain=1.0, size=1.0):
    d = 0.45 * size
    s = lp(noise(d), 1200 / size) * env_ad(d, 0.03, 0.25 * size, 3)
    t = tt(d)
    thump = sine(70 + 40 * np.exp(-t * 20), d) * env_ad(d, 0.005, 0.12, 4) * 0.8
    return (s * 0.8 + thump) * gain


def blip(m, d=0.07, gain=1.0):
    return chip(m, d, 2.0) * gain


def coin(gain=1.0):
    return np.concatenate([chip(83, 0.06, 2.5), chip(88, 0.22, 2.5)]) * gain


def ratchet_click(gain=1.0):
    d = 0.05
    return (hp(noise(d), 2500) * env_ad(d, 0.0005, 0.008, 6) * 1.2 + sine(3200, d) * env_ad(d, 0.0005, 0.01, 6) * 0.4) * gain


def clatter(d=0.6, gain=1.0):
    out = np.zeros(int(d * SR))
    for _ in range(26):
        w = woodblock(rng.uniform(500, 1800), rng.uniform(0.2, 0.7))
        i = int(rng.uniform(0, d - 0.12) * SR * (rng.uniform() ** 1.5))
        out[i:i + len(w)] += w[:len(out) - i]
    return out * gain


def glass_shake(d=1.4, gain=1.0):
    out = np.zeros(int(d * SR))
    for _ in range(60):
        f = rng.uniform(2500, 7000)
        dd = rng.uniform(0.1, 0.5)
        x = sine(f, dd) * env_ad(dd, 0.0005, dd * 0.4, 6)
        i = int(rng.uniform(0, d - dd) * SR)
        out[i:i + len(x)] += x * rng.uniform(0.1, 0.4)
    thump = sine(60, 0.4) * env_ad(0.4, 0.002, 0.2, 4)
    out[:len(thump)] += thump
    return (out + whoosh(d, 300, 3000, 0.6)) * gain


def whoop(gain=1.0, up=1.0):
    """synthesised 'scream as whoop': glide + vibrato through two formants"""
    d = 1.1
    t = tt(d)
    f = (420 + 520 * np.sin(np.pi * np.clip(t / 0.9, 0, 1)) ** 0.7 * up) * (1 + 0.025 * np.sin(2 * np.pi * 7 * t))
    x = saw(f, d) * 0.6 + sine(f, d) * 0.4
    y = bp(x, 650, 1100) * 1.4 + bp(x, 1700, 2600) * 0.6
    e = np.minimum(1, t / 0.05) * np.minimum(1, np.maximum(0, (d - t) / 0.3))
    return y * e * gain


def clack(gain=1.0):
    d = 0.06
    return (bp(noise(d), 800, 5000) * env_ad(d, 0.0005, 0.012, 6) + sine(1450, d) * env_ad(d, 0.0005, 0.02, 6) * 0.4) * gain


def roar(d, gain=1.0):
    n = noise(d)
    x = lp(n, 380, 2) * 3 + bp(n, 900, 2500) * 0.4
    t = tt(d)
    am = 1 + 0.35 * np.sin(2 * np.pi * 22 * t)
    e = np.minimum(1, t / 0.15) * np.minimum(1, np.maximum(0, (d - t) / 0.5))
    return x * am * e * gain


def powerup(gain=1.0):
    d = 0.55
    t = tt(d)
    f = 220 * 2 ** (3 * t / d)
    x = saw(f, d) * 0.5 + square(f * 1.5, d, 0.3) * 0.3
    return lp(x, 6000) * env_ad(d, 0.01, 0.4, 2) * 0.35 * gain


def shimmer(d, gain=1.0, base=84):
    out = np.zeros(int(d * SR))
    for k in range(24):
        m = base + rng.choice([0, 4, 7, 12, 16, 19])
        x = glock(m, 0.8, 0.5)
        i = int(rng.uniform(0, d - 0.8) * SR)
        out[i:i + len(x)] += x
    return out * gain


def crowd(d, gain=1.0):
    n = noise(d)
    babble = bp(n, 250, 2800)
    t = tt(d)
    am = np.ones_like(t)
    for k in range(6):
        am += 0.25 * np.sin(2 * np.pi * rng.uniform(0.3, 2.5) * t + rng.uniform(0, 6))
    out = babble * am * 0.08
    # chatter blips (formant bursts)
    for _ in range(int(d * 9)):
        dd = rng.uniform(0.08, 0.25)
        f = rng.uniform(140, 320)
        x = bp(saw(f * (1 + 0.1 * np.sin(np.linspace(0, 6, int(dd * SR)))), dd), rng.uniform(500, 900), rng.uniform(1200, 2400))
        x *= env_ad(dd, 0.02, dd, 2)
        i = int(rng.uniform(0, d - dd) * SR)
        out[i:i + len(x)] += x * 0.05
    return out * gain


# ===================================================================== arrangement
CH = {  # chord tones (midi) per bar, bar index 1..22
    1: 'C', 2: 'G', 3: 'C', 4: 'G', 5: 'Am', 6: 'F', 7: 'C', 8: 'G', 9: 'Am', 10: 'F', 11: 'C', 12: 'G',
    13: 'Am', 14: 'F', 15: 'Dm', 16: 'G', 17: 'C', 18: 'G', 19: 'Am', 20: 'F', 21: 'C', 22: 'G'}
CHORDS = {'C': [48, 52, 55], 'G': [43, 47, 50], 'Am': [45, 48, 52], 'F': [41, 45, 48], 'Dm': [38, 41, 45], 'Em': [40, 43, 47]}
HOOK = [(0, .5, 67), (.5, .5, 72), (1, .5, 76), (1.5, 1, 79), (2.5, .5, 76), (3, 1, 72),
        (4, .5, 74), (4.5, .5, 76), (5, .5, 77), (5.5, .5, 74), (6, 1, 71), (7, 1, 67)]
MEL_A = [(0, .5, 76), (.5, .5, 79), (1, 1, 84), (2, .5, 83), (2.5, .5, 81), (3, 1, 79),
         (4, .5, 74), (4.5, .5, 79), (5, 1, 83), (6, .5, 81), (6.5, .5, 79), (7, 1, 77),
         (8, .5, 76), (8.5, .5, 81), (9, 1, 84), (10, .5, 83), (10.5, .5, 81), (11, 1, 76),
         (12, .5, 77), (12.5, .5, 81), (13, .5, 84), (13.5, .5, 81), (14, 2, 79)]
MEL_B = [(0, 1.5, 84), (1.5, .5, 83), (2, 1, 84), (3, 1, 88),  # climax over C G Am F
         (4, 1.5, 86), (5.5, .5, 84), (6, 1, 83), (7, 1, 79),
         (8, 1.5, 84), (9.5, .5, 83), (10, 1, 81), (11, 1, 76),
         (12, 1, 77), (13, 1, 81), (14, 1, 84), (15, 1, 86)]


def bar_t(b):
    return (b - 1) * BAR


def drums(b, style='full'):
    t0 = bar_t(b)
    for k in range(4):
        t = t0 + k * BEAT
        if style in ('full', 'drop', 'half'):
            if style != 'half' or k in (0, 2):
                place(kick(), t, 0, 0.95 if style != 'drop' else 1.1, 0.02)
            if k in (1, 3):
                place(clap(), t, 0.1, 0.45, 0.25)
                place(snare(), t, -0.1, 0.35 if style != 'drop' else 0.55, 0.2)
            place(hat(True), t + BEAT / 2, 0.35, 0.18)
            place(hat(), t + BEAT / 4, -0.3, 0.08)
            place(hat(), t + 3 * BEAT / 4, -0.3, 0.08)
        elif style == 'clock':
            place(woodblock(1200), t, -0.4, 0.5)
            place(woodblock(800), t + BEAT / 2, 0.4, 0.4)
            place(kick(), t, 0, 0.6, 0.02) if k in (0, 2) else None
        elif style == 'soft':
            place(kick(), t, 0, 0.55, 0.02) if k in (0, 2) else None
            place(hat(), t + BEAT / 2, 0.3, 0.07)


def oompah(b, gain=1.0):
    ch = CHORDS[CH[b]]
    t0 = bar_t(b)
    root = ch[0] - 12 if ch[0] > 44 else ch[0]
    for k in range(4):
        if k in (0, 2):
            place(tuba(root if k == 0 else root + 7, 0.42), t0 + k * BEAT, 0, 0.55 * gain, 0.05)
        else:
            place(accordion_chord([m + 12 for m in ch], 0.25), t0 + k * BEAT, 0.15, 0.9 * gain, 0.15)


def melody(notes, b0, inst=organ_note, gain=1.0, transpose=0, pan=-0.05, verb=0.2):
    for (beat, dur, m) in notes:
        d = dur * BEAT
        place(inst(m + transpose, d * 0.95, gain), bar_t(b0) + beat * BEAT, pan, 1.0, verb)


def main():
    shots = json.load(open('../plan/shots.json'))
    assert shots['music']['bpm'] == BPM and abs(shots['duration'] - DUR) < 1e-6

    # ------------------------------------------------ rhythm section per bar
    styles = {1: 'full', 2: 'full', 3: 'full', 4: 'full', 5: 'soft', 6: 'soft', 7: 'full', 8: 'full', 9: 'full', 10: 'full',
              11: 'clock', 12: 'clock', 13: None, 14: 'half', 15: 'half', 16: None, 17: 'drop', 18: 'drop', 19: 'full', 20: 'full',
              21: 'soft', 22: 'soft'}
    for b, st in styles.items():
        if st:
            drums(b, st)
    for b in [1, 2, 3, 4, 7, 8, 9, 10, 14, 15, 17, 18, 19, 20]:
        oompah(b, 1.0 if b not in (14, 15) else 0.7)
    for b in [5, 6, 21, 22]:
        oompah(b, 0.55)
    # sub bass on the drop
    for b in [17, 18, 19, 20]:
        root = CHORDS[CH[b]][0] - 12
        for k in range(8):
            place(subbass(root, BEAT / 2 * 0.9), bar_t(b) + k * BEAT / 2, 0, 0.55, 0)
    # ------------------------------------------------ melodies
    melody(HOOK, 1, organ_note, 1.0)                       # hook 0-4
    melody(MEL_A, 3, organ_note, 0.9)                      # arrival 4-12 (bars 3-6)
    melody([(b, d, m + 12) for b, d, m in MEL_A[12:]], 5, glock, 0.7, pan=0.25)    # felt: glock doubles bars 5-6
    melody(MEL_A, 7, organ_note, 0.8)                      # bars 7-10
    for k in range(16 * 2):                                # blueprint arps 12-16 (16ths)
        b = 7 + k // 16
        ch = CHORDS[CH[b]]
        m = ch[k % 3] + 24 + (12 if (k // 3) % 2 else 0)
        place(pluck(m, 0.2, 0.8), bar_t(7) + k * BEAT / 4, 0.4 * (1 if k % 2 else -1), 0.6, 0.25)
    melody(MEL_A[12:], 9, chip, 1.0, transpose=0, pan=0.0)  # pixel lead bars 9-10 (MEL_A second half)
    melody(MEL_A[:12], 9, chip, 0.6, transpose=-12, pan=0.2)
    melody(HOOK, 11, musicbox, 1.0, transpose=12, pan=0.1)  # toy box: music box hook
    # gouache 24-28: filtered pad then bloom
    place(pad([57, 60, 64, 69], 2 * BAR, 0.8, 700), bar_t(13), 0, 1.0, 0.4)
    place(pad([53, 57, 60, 65], BAR, 1.2, 3000), bar_t(14), 0, 1.0, 0.4)
    melody([(b, d, m) for b, d, m in MEL_A[:6]], 14, organ_note, 0.7, transpose=-12)
    # lift: Dm G pad + riser
    place(pad([50, 53, 57, 62], BAR, 0.9, 1500), bar_t(15), 0, 1.0, 0.3)
    place(riser(3.0, 0.9), 28.0, 0, 1.0, 0.1)
    # climax melody bars 17-20 (organ + chip double)
    melody(MEL_B, 17, organ_note, 1.1)
    melody(MEL_B, 17, chip, 0.5, transpose=12, pan=0.3)
    for b in [17, 18, 19, 20]:
        place(pad([m + 12 for m in CHORDS[CH[b]]], BAR, 0.8, 2500), bar_t(b), 0, 1.0, 0.3)
    # globe: music box + celesta + sleigh bells
    melody([(b, d, m) for b, d, m in HOOK], 21, musicbox, 1.0, transpose=12, pan=-0.2)
    for k in range(16):
        if 41.5 + k * BEAT / 2 < 44:
            sb = hp(noise(0.12), 6000) * env_ad(0.12, 0.002, 0.05, 5)
            place(sb * 0.5, 41.5 + k * BEAT / 2, 0.5, 1.0, 0.2)
    # pickup fill into the loop point (43.5-44.0)
    for k in range(4):
        place(snare(0.25 + 0.12 * k), 43.5 + k * BEAT / 4, 0, 1.0, 0.1)

    # ------------------------------------------------ crowd ambience (whole film, ducked in the silence)
    cr = crowd(DUR + 1, 1.0)
    t = np.arange(len(cr)) / SR
    duck = np.ones_like(t)
    duck = np.where((t > 31.0) & (t < 32.0), 0.25, duck)
    duck = np.where((t > 40) & (t < 44), 0.4, duck)
    place(cr * duck, 0, 0, 0.9, 0.1)

    # ------------------------------------------------ SFX cues (times in film seconds)
    for t_ in [0.0, 0.5]:
        place(paper_thwack(), t_ + 0.02, -0.2 if t_ == 0 else 0.2, 0.9)
    for t_ in [1.0, 1.5]:
        place(paper_thwack(0.7), t_, 0, 0.8)
        place(paper_thwack(0.5), t_ + 0.06, 0, 0.6)
    for k in range(16):                                   # pop-up ripple plinks 2.0-3.0
        place(pluck(72 + [0, 4, 7, 12][k % 4] + 12 * (k // 8), 0.25, 0.7), 2.0 + k * 0.0625, rng.uniform(-0.6, 0.6), 0.7, 0.3)
    place(boing(1.2), 3.0, 0.2, 1.0)
    place(whoosh(1.2, 300, 4000, 0.6), 3.6, 0.0)          # dive
    place(whoosh(0.4, 3000, 600, 0.5), 6.0, 0.3)          # under the arch
    place(roar(1.0, 0.25), 6.8, 0.0)                       # under the bridge / train rumble
    place(whoosh(0.35, 800, 6000, 0.8), 7.82, -0.6)       # whip left
    for k, t_ in enumerate([8.5, 9.0, 9.5, 9.75, 10.0, 10.25]):
        place(felt_puff(0.8), t_, rng.uniform(-0.5, 0.5), 1.0)
    place(felt_puff(1.2, 1.8), 10.5, 0, 1.0)
    place(whoosh(0.35, 800, 6000, 0.8), 11.84, 0.6)       # whip right
    place(whoosh(2.2, 200, 8000, 0.7, 2.0), 12.4, -0.3)    # blueprint wave
    place(shimmer(2.0, 0.5, 88), 12.6, 0.3)
    place(powerup(0.7), 14.5, 0)
    for k in range(20):                                   # pixel build blips 16-18.5
        place(blip(72 + (k * 2) % 24, 0.06, 0.8), 16.0 + k * 0.125, rng.uniform(-0.4, 0.4), 0.9, 0.05)
    for t_ in [16.5, 16.75, 17.0, 17.25]:
        place(coin(0.9), t_, 0.2, 1.0, 0.05)
    for t_ in [17.5, 19.0, 19.5]:                          # snap zooms
        place(np.concatenate([chip(60, 0.04), chip(72, 0.04), chip(84, 0.06)]), t_ - 0.06, 0, 1.2, 0.05)
    for t_ in [20.0, 20.25]:
        place(clatter(0.3, 0.7), t_, -0.1, 1.0)
    place(kick(0.9) + 0, 20.5, 0, 1.0)                     # lid bang
    place(woodblock(400, 1.0), 20.5, 0, 1.0)
    place(clatter(0.7, 1.0), 21.0, 0, 1.0)
    for k, t_ in enumerate(np.arange(21.0, 22.5, 0.25)):
        place(boing(0.6), t_, rng.uniform(-0.6, 0.6), 0.8)
    for k in range(6):
        place(ratchet_click(1.2), 22.5 + k * 0.125, 0.3, 1.0, 0.1)
    place(bell(96, 1.5, 0.6), 23.25, 0.2)
    place(whoosh(0.6, 400, 5000, 0.6), 23.5, 0)           # tilt up
    place(shimmer(3.0, 0.7, 84), 24.5, 0)                 # gouache colour bloom
    place(pad([64, 69, 72, 76], 3.0, 1.0, 5000), 24.5, 0, 1.0, 0.5)
    for k in range(8):                                    # snare roll 27-28
        place(snare(0.15 + 0.08 * k), 27.0 + k * BEAT / 4, 0, 1.0, 0.1)
    place(whoosh(0.4, 800, 7000, 0.8), 27.72, 0.5)
    # lift clacks: 8ths 28-30, 16ths 30-31, slowing ticks 31-31.75
    for k in range(8):
        place(clack(0.9), 28.0 + k * 0.25, 0, 1.0, 0.05)
    for k in range(8):
        place(clack(1.0), 30.0 + k * 0.125, 0, 1.0, 0.05)
    for t_ in [31.1, 31.35, 31.62]:
        place(clack(0.6), t_, 0, 1.0, 0.1)
    place(hp(noise(1.0), 300) * env_ad(1.0, 0.3, 0.8, 1.5) * 0.08, 31.0, 0)   # wind
    # THE DROP
    place(crash(1.0), 32.0, 0, 0.9, 0.3)
    place(kick(1.3), 32.0, 0, 1.0)
    place(roar(4.0, 0.6), 32.0, 0)
    place(whoop(0.5), 32.05, -0.4, 1.0, 0.25)
    place(whoop(0.45, 1.2), 32.15, 0.4, 1.0, 0.25)
    place(whoop(0.35, 0.8), 32.3, 0.1, 1.0, 0.25)
    place(whoosh(0.5, 500, 5000, 0.6), 33.0, 0.5)
    place(whoop(0.4, 1.1), 34.3, -0.3, 1.0, 0.25)
    place(whoop(0.35), 34.45, 0.3, 1.0, 0.25)
    place(whoosh(0.9, 300, 6000, 0.7), 35.0, -0.5)        # corkscrew
    place(whoop(0.3, 0.9), 35.2, 0.5, 1.0, 0.25)
    for k in range(16):
        place(clack(0.35), 32.0 + k * 0.25 + 0.06, rng.uniform(-0.3, 0.3), 1.0, 0.05)
    # dusk: power-ups on each lights-on beat
    for k, t_ in enumerate([37.5, 38.0, 38.5, 39.0, 39.5]):
        place(powerup(0.6), t_ - 0.05, (k - 2) * 0.3, 1.0, 0.2)
        place(bell([72, 76, 79, 84, 88][k], 1.8, 0.6), t_, (k - 2) * 0.3, 1.0, 0.4)
    place(crowd(2.5, 2.5) * np.linspace(0, 1, int(2.5 * SR)) ** 2, 38.0, 0, 1.0, 0.1)  # cheer swell
    # globe
    place(shimmer(1.5, 0.8, 91), 40.0, 0)
    place(glass_shake(1.4, 1.0), 41.0, 0)
    place(whoosh(1.4, 200, 4000, 0.6, 2.5), 41.05, 0)
    place(bell(84, 3.0, 0.8), 43.0, 0, 1.0, 0.5)
    place(bell(91, 3.0, 0.4), 43.0, 0.2, 1.0, 0.5)

    # ------------------------------------------------ mixdown: loop-wrap, reverb, master
    for buf in (L, Rr, VERB_L, VERB_R):
        buf[:TAIL] += buf[N:N + TAIL]
    l, r = L[:N].copy(), Rr[:N].copy()
    vl, vr = VERB_L[:N], VERB_R[:N]
    # circular convolution reverb (seamless at the loop point)
    ir_len = int(1.8 * SR)
    tir = np.arange(ir_len) / SR
    irl = rng.standard_normal(ir_len) * np.exp(-tir * 3.2)
    irr = rng.standard_normal(ir_len) * np.exp(-tir * 3.2)
    irl, irr = lp(irl, 6000), lp(irr, 6000)
    irl[:int(0.012 * SR)] = 0; irr[:int(0.017 * SR)] = 0
    def circ(x, h):
        H = np.fft.rfft(np.concatenate([h, np.zeros(N - len(h))]))
        return np.fft.irfft(np.fft.rfft(x) * H, N)
    l += circ(vl, irl) * 0.12
    r += circ(vr, irr) * 0.12
    st = np.stack([l, r], 1)
    # glue: gentle bus compression via soft clip + high-pass DC
    st = signal.sosfiltfilt(signal.butter(2, 25 / (SR / 2), 'high', output='sos'), st, axis=0)
    meter = pyln.Meter(SR)
    for it in range(4):
        lufs = meter.integrated_loudness(st)
        st *= 10 ** ((-14.0 - lufs) / 20)
        st = limiter(st, -1.5)
    tp = true_peak(st)
    lufs3 = meter.integrated_loudness(st)
    sf.write('score.wav', st, SR, subtype='PCM_24')
    print('score.wav  %.2f s  integrated %.2f LUFS  true peak %.2f dBTP' % (len(st) / SR, lufs3, tp))
    # loop seam check
    seam = np.abs(st[0] - st[-1]).max()
    print('loop seam step %.4f' % seam)


def true_peak(x):
    up = signal.resample_poly(x, 4, 1, axis=0)
    return 20 * np.log10(np.abs(up).max() + 1e-12)


def limiter(x, ceiling_db=-1.3, release=0.08, look=0.004):
    """look-ahead peak limiter on 4x oversampled detection (keeps true peak under the ceiling)."""
    ceil = 10 ** (ceiling_db / 20)
    up = np.abs(signal.resample_poly(x, 4, 1, axis=0)).max(axis=1)
    pk = np.maximum.reduceat(up, np.arange(0, len(up), 4))[:len(x)]
    pk = np.concatenate([pk, np.zeros(len(x) - len(pk))])
    need = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    la = int(look * SR)
    # min over look-ahead window
    from scipy.ndimage import minimum_filter1d
    g = minimum_filter1d(need, size=2 * la + 1, mode='wrap')
    # smooth release (attack instant)
    a = math.exp(-1 / (release * SR))
    out = np.empty_like(g)
    cur = 1.0
    for _ in range(2):    # two passes so the loop start inherits the end state
        for i in range(len(g)):
            cur = g[i] if g[i] < cur else a * cur + (1 - a) * g[i]
            out[i] = cur
    return x * out[:, None]


if __name__ == '__main__':
    main()
