#!/usr/bin/env python3
"""score.py - original chiptune-meets-orchestral score + pixel-era sound design for the full
92.0 s Starship Catch film. Deterministic (seeded). Writes 48 kHz stereo 24-bit WAV, mixed to
-14 LUFS integrated with true peak below -1 dBTP (measured with ffmpeg ebur128).

usage: python3 score.py [out.wav]
"""
import sys, subprocess, re, json
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
DUR = 92.0
N = int(SR * DUR)
OUT = sys.argv[1] if len(sys.argv) > 1 else '/home/user/brain/starship-pixel-video/score.wav'
rng = np.random.default_rng(20240613)

# ------------------------------------------------------------------ cut list / tempo map
CUTS = [0.0, 4.338, 12.146, 15.115, 18.919, 30.1, 60.3, 65.8, 71.2, 78.6, 92.0]
# beats per section (each cut lands exactly on a beat; tempo 89-101 BPM, broadening at the catch)
BEATS = [7, 12, 5, 6, 18, 48, 9, 8, 12, 16]
def bt(sec, beat):
    """absolute time of beat `beat` (float ok) in section `sec`"""
    a, b = CUTS[sec], CUTS[sec + 1]
    if sec == 9:  # ending: gentle ritardando
        x = beat / BEATS[sec]
        return a + (b - a) * (0.8 * x + 0.2 * x * x)
    return a + (b - a) * beat / BEATS[sec]
def blen(sec): return (CUTS[sec + 1] - CUTS[sec]) / BEATS[sec]

# ------------------------------------------------------------------ buses
def bus(): return np.zeros((2, N))
MUS, VERB, SFX, SFXV = bus(), bus(), bus(), bus()

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
def n(s):
    m = re.match(r'([A-G][#b]?)(-?\d)', s); return 12 * (int(m.group(2)) + 1) + NOTE[m.group(1)]

def add(b, t0, x, pan=0.0, gain=1.0):
    i0 = int(round(t0 * SR));
    if i0 >= N: return
    if i0 < 0: x = x[-i0:]; i0 = 0
    x = x[:N - i0]
    l = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2) * gain; r = np.sin((pan + 1) * np.pi / 4) * np.sqrt(2) * gain
    b[0, i0:i0 + len(x)] += x * l; b[1, i0:i0 + len(x)] += x * r

def env(nsamp, a=0.005, d=0.1, s=0.7, r=0.1, hold=None):
    """ADSR; hold = gate length in s (default: until release)"""
    t = np.arange(nsamp) / SR; g = hold if hold is not None else max(0.0, nsamp / SR - r)
    e = np.where(t < a, t / max(a, 1e-6), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-6)))
    rel = np.clip(1 - (t - g) / max(r, 1e-6), 0, 1)
    return e * np.where(t > g, rel, 1.0)

# ------------------------------------------------------------------ oscillators
def blep(ph, dt):
    y = np.zeros_like(ph); m = ph < dt; x = ph[m] / dt[m] if np.ndim(dt) else ph[m] / dt; y[m] = x + x - x * x - 1
    m2 = ph > 1 - (dt if np.ndim(dt) == 0 else dt); x = (ph[m2] - 1) / (dt[m2] if np.ndim(dt) else dt); y[m2] = x * x + x + x + 1
    return y
def phase(freq, nsamp, ph0=0.0):
    f = np.broadcast_to(np.asarray(freq, dtype=float), (nsamp,)); return (ph0 + np.cumsum(f) / SR) % 1.0, f / SR
def pulse(freq, nsamp, duty=0.5):
    ph, dt = phase(freq, nsamp, rng.random()); y = np.where(ph < duty, 1.0, -1.0)
    return y + blep(ph, dt) - blep((ph - duty) % 1.0, dt)
def saw(freq, nsamp):
    ph, dt = phase(freq, nsamp, rng.random()); return 2 * ph - 1 - blep(ph, dt)
def tri4(freq, nsamp):  # NES-style 4-bit stepped triangle
    ph, _ = phase(freq, nsamp, 0.0); tr = 1 - 4 * np.abs(ph - 0.5); return np.round((tr + 1) * 7.5) / 7.5 - 1
def sine(freq, nsamp):
    ph, _ = phase(freq, nsamp, 0.0); return np.sin(2 * np.pi * ph)
_lfsr_long = None
def lfsr(short=False):
    global _lfsr_long
    if not short and _lfsr_long is not None: return _lfsr_long
    reg, out = 1, []
    period = 93 if short else 32767
    for _ in range(period):
        bit = (reg ^ (reg >> (6 if short else 1))) & 1; reg = (reg >> 1) | (bit << 14); out.append(1.0 if reg & 1 else -1.0)
    a = np.array(out)
    if not short: _lfsr_long = a
    return a
def chipnoise(nsamp, rate, short=False):
    seq = lfsr(short); r = np.broadcast_to(np.asarray(rate, dtype=float), (nsamp,))
    idx = (np.cumsum(r) / SR).astype(np.int64) + rng.integers(0, len(seq)); return seq[idx % len(seq)]
def lp(x, fc, order=2):
    sos = signal.butter(order, min(fc, SR * 0.45), 'low', fs=SR, output='sos'); return signal.sosfilt(sos, x)
def hp(x, fc, order=2):
    sos = signal.butter(order, fc, 'high', fs=SR, output='sos'); return signal.sosfilt(sos, x)
def bp(x, f1, f2, order=2):
    sos = signal.butter(order, [f1, f2], 'band', fs=SR, output='sos'); return signal.sosfilt(sos, x)
def crush(x, bits=6): q = 2 ** (bits - 1); return np.round(x * q) / q

# ------------------------------------------------------------------ instruments
def i_pulse(b, t, dur, m, vel=0.2, duty=0.25, pan=0.0, verb=0.25, a=0.004, d=0.12, s=0.55, r=0.08, vib=0.0):
    ns = int((dur + r) * SR); f = mtof(m) * (1 + vib * np.sin(2 * np.pi * 5.2 * np.arange(ns) / SR) * np.clip(np.arange(ns) / SR / 0.3 - 0.5, 0, 1))
    x = pulse(f, ns, duty) * env(ns, a, d, s, r, dur) * vel
    add(b, t, x, pan); add(VERB, t, x, pan, verb)
def i_tri(t, dur, m, vel=0.35, pan=0.0, r=0.05):
    ns = int((dur + r) * SR); x = tri4(mtof(m), ns) * env(ns, 0.002, 0.3, 0.85, r, dur) * vel
    add(MUS, t, x, pan); add(VERB, t, x, pan, 0.1)
def i_pad(t, dur, notes, vel=0.08, a=1.2, r=1.6, cut=1800, pan_spread=0.6, bright=0.0, verb=0.6):
    ns = int((dur + r) * SR)
    for k, m in enumerate(notes):
        for det, pan in ((-0.09, -pan_spread), (0.0, 0.0), (0.085, pan_spread)):
            f = mtof(m) * 2 ** (det / 12)
            x = (saw(f, ns) * 0.6 + tri4(f * 0.5, ns) * 0.25 + pulse(f, ns, 0.5) * 0.15 * bright)
            x = lp(x, cut + 500 * bright) * env(ns, a, 1.0, 1.0, r, dur) * vel / len(notes) ** 0.5
            add(MUS, t, x, pan + (k - len(notes) / 2) * 0.05); add(VERB, t, x, pan, verb)
def i_choir(t, dur, notes, vel=0.06, a=1.0, r=2.0):
    ns = int((dur + r) * SR)
    for m in notes:
        for det, pan in ((-0.07, -0.5), (0.07, 0.5)):
            vib = 1 + 0.004 * np.sin(2 * np.pi * 5.0 * np.arange(ns) / SR + rng.random() * 6)
            x = saw(mtof(m) * 2 ** (det / 12) * vib, ns)
            x = bp(x, 600, 900) * 1.2 + bp(x, 1050, 1400) * 0.8 + bp(x, 2300, 2900) * 0.3
            x = x * env(ns, a, 1.0, 1.0, r, dur) * vel / len(notes) ** 0.5
            add(MUS, t, x, pan); add(VERB, t, x, pan, 0.8)
def d_kick(t, vel=0.8, b=None):
    ns = int(0.4 * SR); tt = np.arange(ns) / SR; f = 45 + 110 * np.exp(-tt * 28)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9) * vel
    x += crush(chipnoise(ns, 9000) * np.exp(-tt * 120) * 0.15 * vel, 4)
    add(b if b is not None else MUS, t, x, 0, 1); add(VERB, t, x, 0, 0.05)
def d_snare(t, vel=0.4, pan=0.05):
    ns = int(0.3 * SR); tt = np.arange(ns) / SR
    x = bp(chipnoise(ns, 14000), 900, 7000) * np.exp(-tt * 16) + np.sin(2 * np.pi * 185 * tt) * np.exp(-tt * 30) * 0.6
    add(MUS, t, x * vel, pan); add(VERB, t, x * vel, pan, 0.35)
def d_hat(t, vel=0.12, pan=0.3, open_=False):
    ns = int((0.25 if open_ else 0.06) * SR); tt = np.arange(ns) / SR
    x = hp(chipnoise(ns, 30000), 6000) * np.exp(-tt * (12 if open_ else 70)) * vel; add(MUS, t, x, pan); add(VERB, t, x, pan, 0.15)
def d_timp(t, m, vel=0.5):
    ns = int(1.8 * SR); tt = np.arange(ns) / SR; f = mtof(m)
    x = (np.sin(2 * np.pi * f * tt * (1 + 0.02 * np.exp(-tt * 20))) + 0.5 * np.sin(2 * np.pi * f * 1.51 * tt) * np.exp(-tt * 3)) * np.exp(-tt * 2.2)
    x += lp(chipnoise(ns, 6000), 900) * np.exp(-tt * 40) * 0.5
    add(MUS, t, x * vel, -0.15); add(VERB, t, x * vel, -0.15, 0.5)
def d_tom(t, m, vel=0.4, pan=0):
    ns = int(0.5 * SR); tt = np.arange(ns) / SR; f = mtof(m) * (1 + 0.6 * np.exp(-tt * 25))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 7) + lp(chipnoise(ns, 8000), 2000) * np.exp(-tt * 40) * 0.3
    add(MUS, t, x * vel, pan); add(VERB, t, x * vel, pan, 0.4)
def cymbal_swell(t_end, length, vel=0.25, pan=0.0, b=None):
    ns = int(length * SR); tt = np.arange(ns) / SR
    x = hp(chipnoise(ns, 26000), 4000) * (tt / length) ** 2.5 * vel
    add(b if b is not None else MUS, t_end - length, x, pan); add(VERB, t_end - length, x, pan, 0.6)
def crash(t, vel=0.3, pan=0.0):
    ns = int(2.5 * SR); tt = np.arange(ns) / SR
    x = hp(chipnoise(ns, 24000) * 0.7 + chipnoise(ns, 17000) * 0.3, 3000) * np.exp(-tt * 1.6) * vel
    add(MUS, t, x, pan); add(VERB, t, x, pan, 0.5)

# ------------------------------------------------------------------ harmony helpers
def chord(root, kind):
    iv = {'maj': [0, 4, 7], 'min': [0, 3, 7], 'maj7': [0, 4, 7, 11], 'min7': [0, 3, 7, 10], 'sus2': [0, 2, 7], 'sus4': [0, 5, 7],
          'add9': [0, 4, 7, 14], 'madd9': [0, 3, 7, 14], 'maj9': [0, 4, 7, 11, 14], 'min9': [0, 3, 7, 10, 14], '7': [0, 4, 7, 10], '6': [0, 4, 7, 9]}[kind]
    return [root + i for i in iv]
def arp(sec, b0, nbeats, notes, step=0.25, vel=0.08, duty=0.125, pan=0.25, pattern=None, verb=0.3, oct_=0, gate=0.8):
    pat = pattern or [0, 1, 2, 3, 2, 1]
    k = 0; b = b0
    while b < b0 + nbeats - 1e-6:
        m = notes[pat[k % len(pat)] % len(notes)] + 12 * oct_ + 12 * (pat[k % len(pat)] // len(notes))
        t = bt(sec, b); d = (bt(sec, b + step) - t) * gate
        i_pulse(MUS, t, d, m, vel, duty, pan if k % 2 else -pan, verb, a=0.002, d=0.06, s=0.5, r=0.04)
        k += 1; b += step

def mel(sec, b0, seq, vel=0.13, duty=0.25, pan=0.0, vib=0.006, verb=0.35, octave_double=False, s=0.7):
    """seq: list of (note, beats) ; note None = rest"""
    b = b0
    for nt, ln in seq:
        if nt is not None:
            t = bt(sec, b); d = bt(sec, b + ln) - t
            i_pulse(MUS, t, d * 0.94, n(nt), vel, duty, pan, verb, a=0.01, d=0.25, s=s, r=0.12, vib=vib)
            if octave_double: i_tri(t, d * 0.94, n(nt) - 12, vel * 1.4, -pan)
        b += ln

# ================================================================== MUSIC
# --- A: 0-4.338 sky. soft Dmaj9 pad swell, high glints
i_pad(0.0, 4.6, [n('D3'), n('A3'), n('E4'), n('F#4'), n('C#5')], vel=0.07, a=2.5, r=1.8, cut=1400)
for k, nt in enumerate(['A5', 'E6', 'F#5', 'C#6', 'A5']):
    i_pulse(MUS, 0.6 + k * 0.72, 0.5, n(nt), 0.035, 0.125, 0.5 if k % 2 else -0.5, 0.7, a=0.002, d=0.3, s=0.0, r=0.3)
# --- B: 4.338-12.146 inside the structure: Bm9 - Gmaj7 - Asus/E ; 16th pulse arp, triangle bass
B_ch = [(0, chord(n('B2'), 'min9')), (4, chord(n('G2'), 'maj7') + [n('F#4')]), (8, chord(n('E2'), 'min9'))]
for b0, notes in B_ch:
    i_pad(bt(1, b0), blen(1) * 4, [x + 12 for x in notes[1:4]], vel=0.06, a=0.9, r=1.0, cut=1300)
    i_tri(bt(1, b0), blen(1) * 1.9, notes[0], 0.28); i_tri(bt(1, b0 + 2), blen(1) * 1.9, notes[0] + (7 if b0 != 8 else 5), 0.22)
    arp(1, b0, 4, [x + 24 for x in notes[1:]], step=0.5 if b0 == 0 else 0.25, vel=0.045 + 0.01 * b0 / 4, pan=0.35, pattern=[0, 2, 1, 3, 2, 4, 3, 1])
d_timp(bt(1, 0), n('B1'), 0.35)
# entering the structure: soft deep impact with a long metallic tail
def impact(t, vel=0.3):
    ns = int(3.0 * SR); tt = np.arange(ns) / SR
    x = np.sin(2 * np.pi * np.cumsum(38 + 50 * np.exp(-tt * 10)) / SR) * np.exp(-tt * 3) + lp(chipnoise(ns, 5000), 700) * np.exp(-tt * 18) * 0.4
    add(MUS, t, x * vel, 0); add(VERB, t, x * vel, 0, 0.9)
impact(CUTS[1], 0.32)
# --- C: 12.146-15.115 arms open: Em - F#sus4 - F#, driving 8ths, clank hits on beats
i_pad(bt(2, 0), blen(2) * 3, chord(n('E3'), 'min9')[1:], vel=0.07, a=0.4, r=0.6, cut=1700, bright=0.5)
i_pad(bt(2, 3), blen(2) * 2.1, [n('F#3'), n('B3'), n('C#4'), n('A#4')], vel=0.08, a=0.2, r=0.8, cut=2000, bright=0.6)
for k in range(10):
    i_tri(bt(2, k * 0.5), blen(2) * 0.42, n('E2') if k < 6 else n('F#2'), 0.3)
arp(2, 0, 5, [n('E5'), n('G5'), n('B5'), n('F#6')], step=0.25, vel=0.06, duty=0.25, pan=0.4, pattern=[0, 1, 2, 3, 2, 1, 0, 2])
for k in range(5): d_kick(bt(2, k), 0.45 if k % 2 == 0 else 0.3); d_hat(bt(2, k + 0.5), 0.08)
d_snare(bt(2, 4), 0.3); d_snare(bt(2, 4.5), 0.35); cymbal_swell(CUTS[3], 1.4, 0.16)
# --- D: 15.115-18.919 high over the marsh: Gmaj7#11 -> D/F#, first melodic phrase
i_pad(bt(3, 0), blen(3) * 3.2, [n('G3'), n('B3'), n('D4'), n('F#4'), n('C#5')], vel=0.08, a=0.3, r=1.2, cut=2200)
i_pad(bt(3, 3), blen(3) * 3.2, [n('F#3'), n('A3'), n('D4'), n('E4'), n('A4')], vel=0.08, a=0.6, r=1.4, cut=2200)
i_tri(bt(3, 0), blen(3) * 2.9, n('G2'), 0.3); i_tri(bt(3, 3), blen(3) * 2.9, n('F#2'), 0.3)
crash(bt(3, 0), 0.12, -0.3); d_timp(bt(3, 0), n('G1'), 0.4)
mel(3, 0, [('B4', 1), ('D5', 0.5), ('F#5', 1.5), ('E5', 1), ('C#5', 0.5), ('A4', 1.5)], vel=0.1, duty=0.5)
arp(3, 0, 6, [n('D5'), n('F#5'), n('A5'), n('C#6')], step=0.5, vel=0.035, duty=0.125, pan=0.5, pattern=[0, 2, 1, 3])
cymbal_swell(CUTS[4], 1.8, 0.14)
for k, m in enumerate([n('D4'), n('F#4'), n('A4'), n('D5'), n('E5'), n('F#5'), n('A5'), n('D6')]):  # harp-like glissando into the golden shot
    i_pulse(MUS, CUTS[4] - 0.42 + k * 0.06, 0.5, m, 0.04, 0.125, -0.5 + k / 7, 0.7, a=0.002, d=0.35, s=0.0, r=0.5)
# --- E: 18.919-30.1 golden hour theme (4 bars + 2 beat lift into the booms)
E = [(0, n('D3'), 'maj9'), (4, n('A2'), 'sus2'), (8, n('B2'), 'min7'), (12, n('G2'), 'maj7')]
for b0, r0, kd in E:
    notes = chord(r0, kd)
    i_pad(bt(4, b0), blen(4) * 4.1, [x + 12 for x in notes], vel=0.085, a=0.5, r=1.4, cut=2300, bright=0.3)
    i_tri(bt(4, b0), blen(4) * 1.9, r0 if b0 != 4 else n('C#3'), 0.32); i_tri(bt(4, b0 + 2), blen(4) * 1.9, r0 + 7 if b0 != 4 else n('A2'), 0.28)
    arp(4, b0, 4, [x + 24 for x in notes], step=0.25, vel=0.035 + 0.006 * b0 / 4, duty=0.125, pan=0.45, pattern=[0, 1, 2, 3, 1, 2, 3, 4])
mel(4, 0, [('F#4', 1.5), ('A4', 0.5), ('D5', 2), ('C#5', 1), ('E5', 1), ('A5', 1.5), ('G#5', 0.5),
           ('F#5', 2), ('E5', 1), ('D5', 1), ('B4', 1), ('D5', 1), ('E5', 2)], vel=0.12, duty=0.25, octave_double=False)
mel(4, 0.0, [(None, 8), ('A4', 2), ('B4', 2), ('D5', 4)], vel=0.05, duty=0.5, pan=-0.4)  # counter line
for k in range(16): d_hat(bt(4, k + 0.5), 0.05 + 0.03 * (k / 16), 0.4)
for k in (0, 4, 8, 12): d_kick(bt(4, k), 0.3)
d_snare(bt(4, 6), 0.15); d_snare(bt(4, 14), 0.2)
# lift: E7sus/A riser + snare roll into the cut at 30.1
i_pad(bt(4, 16), blen(4) * 2, [n('A3'), n('D4'), n('E4'), n('G4'), n('B4')], vel=0.1, a=0.3, r=0.3, cut=3000, bright=0.8)
for k in range(16): d_snare(bt(4, 16 + k / 8), 0.08 + 0.2 * k / 16, (k % 2) * 0.2 - 0.1)
cymbal_swell(CUTS[5], 2.5, 0.28)
for k in range(8): i_pulse(MUS, bt(4, 16 + k / 4), blen(4) / 4.5, n('A4') + [0, 2, 4, 7, 9, 12, 14, 16][k], 0.05, 0.125, 0.3 if k % 2 else -0.3, 0.4)

# --- F: 30.1-60.3 the descent (48 beats): B minor, driving, building; landing burn at 55
F_prog = [('B2', 'min'), ('G2', 'maj'), ('E2', 'min'), ('F#2', 'sus4'), ('B2', 'min'), ('G2', 'maj7'), ('D2', 'maj'), ('F#2', 'maj'),
          ('B2', 'min'), ('G2', 'maj'), ('A2', 'sus4'), ('A2', 'maj')]
for bar, (r0, kd) in enumerate(F_prog):
    b0 = bar * 4; root = n(r0); notes = chord(root, kd); inten = bar / 11
    i_pad(bt(5, b0), blen(5) * 4.05, [x + 12 for x in notes] + [root + 24], vel=0.06 + 0.05 * inten, a=0.25, r=0.6, cut=1500 + 2000 * inten, bright=inten)
    if bar < 6 or bar >= 6:
        for k in range(8):  # driving 8th bass
            i_tri(bt(5, b0 + k * 0.5), blen(5) * 0.42, root - (12 if k % 2 else 0) + 12, 0.26 + 0.06 * inten)
    if bar >= 2:
        arp(5, b0, 4, [x + 24 for x in notes] + [root + 36], step=0.25, vel=0.03 + 0.03 * inten, duty=0.125 if bar < 6 else 0.25, pan=0.45, pattern=[0, 2, 1, 3, 2, 1])
    if bar >= 1:
        d_kick(bt(5, b0), 0.35 + 0.25 * inten); d_kick(bt(5, b0 + 2.5), 0.25 + 0.2 * inten)
        d_snare(bt(5, b0 + 1), 0.12 + 0.18 * inten); d_snare(bt(5, b0 + 3), 0.12 + 0.18 * inten)
        for k in range(8): d_hat(bt(5, b0 + k * 0.5 + 0.25 * 0), 0.04 + 0.05 * inten, 0.35 if k % 2 else -0.2)
    if bar in (4, 8): crash(bt(5, b0), 0.18 + 0.1 * inten)
# descent theme (pulse lead, minor answer to the golden theme) bars 4-11
mel(5, 16, [('F#5', 1.5), ('D5', 0.5), ('B4', 2), ('D5', 1), ('E5', 1), ('G5', 2),
            ('F#5', 1.5), ('E5', 0.5), ('D5', 1), ('C#5', 1), ('C#5', 2), ('A#4', 2),
            ('B4', 1.5), ('C#5', 0.5), ('D5', 2), ('E5', 1), ('F#5', 1), ('G5', 2),
            ('A5', 3), ('G5', 0.5), ('F#5', 0.5), ('E5', 2), ('C#5', 2)], vel=0.11, duty=0.25, vib=0.008)
mel(5, 32, [('D4', 4), ('B3', 4), ('D4', 4), ('E4', 4)], vel=0.06, duty=0.5, pan=-0.35)
for k in range(8): d_timp(bt(5, 40 + k), n('A1'), 0.2 + 0.05 * k)  # timpani pulse as the burn begins
cymbal_swell(CUTS[6], 3.0, 0.22)
# --- G: 60.3-65.8 descending into the tower: A pedal, rising strings, tension
for k in range(9):
    d_timp(bt(6, k), n('A1'), 0.45 + 0.03 * k); i_tri(bt(6, k), blen(6) * 0.45, n('A2'), 0.3); i_tri(bt(6, k + 0.5), blen(6) * 0.45, n('A3'), 0.22)
G_ch = [[n('A3'), n('D4'), n('E4'), n('A4')], [n('A3'), n('C#4'), n('E4'), n('B4')], [n('A3'), n('D4'), n('F#4'), n('C5')]]
for k, ch in enumerate(G_ch): i_pad(bt(6, k * 3), blen(6) * 3.1, ch, vel=0.11 + 0.03 * k, a=0.3, r=0.4, cut=2500 + 800 * k, bright=0.8)
mel(6, 0, [('E5', 1.5), ('F#5', 1.5), ('G5', 1.5), ('A5', 1.5), ('B5', 1.5), ('C#6', 1.5)], vel=0.08, duty=0.5, vib=0.01)
for k in range(18): d_snare(bt(6, 5 + k * 4 / 18), 0.05 + 0.25 * (k / 18) ** 2)
cymbal_swell(CUTS[7], 2.0, 0.3)
# --- H: 65.8-71.2 the catch: broad swell, choir; clank at beat 4 (68.5 s), resolve begins
i_pad(bt(7, 0), blen(7) * 4, [n('G2'), n('D3'), n('B3'), n('F#4'), n('A4')], vel=0.15, a=0.15, r=0.4, cut=3200, bright=1)
i_choir(bt(7, 0), blen(7) * 4, [n('B3'), n('D4'), n('F#4')], vel=0.07, a=0.6)
i_pad(bt(7, 4), blen(7) * 4.2, [n('D3'), n('A3'), n('D4'), n('F#4'), n('A4'), n('E5')], vel=0.17, a=0.05, r=1.2, cut=3500, bright=1)
i_choir(bt(7, 4), blen(7) * 4.5, [n('A3'), n('D4'), n('F#4'), n('A4')], vel=0.09, a=0.2, r=2.0)
d_timp(bt(7, 0), n('G1'), 0.5); d_timp(bt(7, 4), n('D2'), 0.6); crash(bt(7, 4), 0.25); d_kick(bt(7, 4), 0.55)
mel(7, 0, [('D5', 1), ('E5', 1), ('F#5', 1), ('G5', 1), ('A5', 4)], vel=0.14, duty=0.25, octave_double=True, vib=0.01)
i_tri(bt(7, 0), blen(7) * 4, n('G1'), 0.35); i_tri(bt(7, 4), blen(7) * 4, n('D2'), 0.4)
arp(7, 4, 4, [n('D5'), n('F#5'), n('A5'), n('D6'), n('E6')], step=0.25, vel=0.05, duty=0.125, pan=0.5, pattern=[0, 1, 2, 3, 4, 3, 2, 1])
# --- I: 71.2-78.6 triumphant resolve (3 bars)
I_prog = [(0, [n('D3'), n('A3'), n('D4'), n('F#4'), n('A4')], n('D2')), (4, [n('G3'), n('B3'), n('D4'), n('G4'), n('E5')], n('G2')), (8, [n('A3'), n('D4'), n('E4'), n('A4'), n('C#5')], n('A2'))]
for b0, ch, bass in I_prog:
    i_pad(bt(8, b0), blen(8) * 4.1, ch, vel=0.15, a=0.05, r=0.9, cut=3600, bright=1)
    i_choir(bt(8, b0), blen(8) * 4.1, ch[2:], vel=0.06, a=0.2)
    for k in range(8): i_tri(bt(8, b0 + k * 0.5), blen(8) * 0.45, bass + (12 if k % 2 else 0), 0.34)
    d_kick(bt(8, b0), 0.7); d_kick(bt(8, b0 + 2.5), 0.45); d_snare(bt(8, b0 + 1), 0.32); d_snare(bt(8, b0 + 3), 0.34)
    for k in range(8): d_hat(bt(8, b0 + k * 0.5), 0.08, 0.35 if k % 2 else -0.25)
    arp(8, b0, 4, [x + 12 for x in ch[1:]], step=0.25, vel=0.045, duty=0.125, pan=0.5, pattern=[0, 1, 2, 3, 2, 1])
crash(bt(8, 0), 0.32); d_timp(bt(8, 0), n('D2'), 0.6); d_timp(bt(8, 8), n('A1'), 0.5)
mel(8, 0, [('A5', 1.5), ('F#5', 0.5), ('D5', 1), ('E5', 1), ('F#5', 1), ('G5', 1), ('B5', 1), ('A5', 1), ('A5', 1.5), ('E5', 0.5), ('F#5', 1), ('C#6', 1)],
    vel=0.15, duty=0.25, octave_double=True, vib=0.01)
mel(8, 0, [('F#4', 4), ('G4', 4), ('A4', 4)], vel=0.07, duty=0.5, pan=-0.4)
# --- J: 78.6-92 soft ending, fade to silence by ~90.5
i_pad(CUTS[9], 5.5, [n('D3'), n('A3'), n('D4'), n('F#4'), n('A4'), n('E5')], vel=0.12, a=0.02, r=2.5, cut=2600, bright=0.4)
i_tri(CUTS[9], 4.0, n('D2'), 0.32); d_timp(CUTS[9], n('D2'), 0.5); crash(CUTS[9], 0.2)
i_pad(83.6, 5.0, [n('G3'), n('B3'), n('D4'), n('F#4'), n('C#5')], vel=0.09, a=1.0, r=2.5, cut=1800)
i_pad(87.0, 3.0, [n('D3'), n('A3'), n('E4'), n('F#4'), n('C#5')], vel=0.07, a=1.0, r=1.8, cut=1300)
i_tri(83.6, 4.0, n('G2'), 0.22); i_tri(87.0, 3.0, n('D2'), 0.18)
for k, nt in enumerate(['A5', 'F#5', 'D5', 'E5', 'F#5', 'A5', 'E5', 'D5', 'A4', 'D5', 'F#5', 'E5']):
    t = 78.9 + k * 0.78 * (1 + k * 0.03); i_pulse(MUS, t, 0.45, n(nt), 0.05 * (1 - k / 14), 0.125, 0.45 if k % 2 else -0.45, 0.8, a=0.002, d=0.25, s=0.1, r=0.4)
mel(9, 0, [('F#5', 2), ('E5', 1), ('D5', 1), ('A4', 4)], vel=0.07, duty=0.5, vib=0.006)

# ================================================================== SOUND DESIGN
def smooth_noise_env(times, vals, nsamp, t0=0.0):
    tt = t0 + np.arange(nsamp) / SR; return np.interp(tt, times, vals)
def wind(t0, t1, level_pts, color=(250, 1100), pan_lfo=0.05, gust=0.5):
    ns = int((t1 - t0) * SR); tt = np.arange(ns) / SR
    for ch, ph in ((0, 0.0), (1, 2.1)):
        x = rng.standard_normal(ns); x = np.cumsum(x); x -= lp(x, 0.5, 1); x = x / (np.std(x) + 1e-9)  # brownish
        x = bp(x, color[0], color[1]) * 0.7 + bp(rng.standard_normal(ns), color[0] * 2, color[1] * 3) * 0.12
        g = 1 + gust * np.sin(2 * np.pi * 0.17 * tt + ph) * np.sin(2 * np.pi * 0.071 * tt + ph * 0.7)
        lv = np.interp(t0 + tt, [p[0] for p in level_pts], [p[1] for p in level_pts])
        y = x / (np.std(x) + 1e-9) * g * lv
        SFX[ch, int(t0 * SR):int(t0 * SR) + ns] += y[:N - int(t0 * SR)]
wind(0, 4.4, [(0, 0.0), (0.8, 0.035), (4.0, 0.04), (4.4, 0.0)], (300, 1400))
wind(4.3, 12.2, [(4.3, 0.0), (4.6, 0.014), (12.0, 0.016), (12.2, 0.0)], (120, 500), gust=0.3)        # inside: muffled
wind(12.1, 19.0, [(12.1, 0.0), (12.2, 0.05), (15.1, 0.055), (18.8, 0.065), (19.0, 0.0)], (350, 2200), gust=0.8)  # tower top
wind(18.9, 30.2, [(18.9, 0.0), (19.1, 0.04), (22.0, 0.04), (23.5, 0.07), (26, 0.04), (30.1, 0.03), (30.2, 0.0)], (250, 1600))
wind(30.1, 60.4, [(30.1, 0.02), (45, 0.03), (60.3, 0.03)], (300, 1500))
wind(60.3, 65.9, [(60.3, 0.05), (65.7, 0.05), (65.9, 0.0)], (400, 3000), gust=0.9)  # dune grass
wind(71.2, 92.0, [(71.2, 0.0), (78.6, 0.02), (86, 0.02), (90, 0.0)], (250, 1200))

# distant jet (shot 1): rumble + faint whine, panning right -> left
ns = int(6.5 * SR); tt = np.arange(ns) / SR
x = lp(rng.standard_normal(ns), 260, 2) * 3.0 + bp(rng.standard_normal(ns), 900, 1600) * 0.08
x *= np.clip(tt / 1.2, 0, 1) * np.clip((6.5 - tt) / 2.5, 0, 1) * 0.07
pan = np.clip(0.6 - tt / 4.3 * 1.0, -0.6, 0.6)
SFX[0, :ns] += x * np.cos((pan + 1) * np.pi / 4) * 1.41; SFX[1, :ns] += x * np.sin((pan + 1) * np.pi / 4) * 1.41

# shot 2: interior hum + metallic creak ping
ns = int(7.9 * SR); tt = np.arange(ns) / SR
x = (np.sin(2 * np.pi * 55 * tt) + 0.4 * np.sin(2 * np.pi * 110.3 * tt)) * 0.02 * np.clip(tt / 0.5, 0, 1) * np.clip((7.9 - tt) / 0.3, 0, 1)
add(SFX, 4.338, x, 0)
def ping(t, f0=420, vel=0.05, pan=0.3, decay=3.0):
    ns = int(2.5 * SR); tt = np.arange(ns) / SR; x = sum(np.sin(2 * np.pi * f0 * r * tt) * np.exp(-tt * decay * r ** 0.5) / (1 + i) for i, r in enumerate([1, 2.76, 5.4, 8.93]))
    add(SFX, t, x * vel, pan); add(SFXV, t, x * vel, pan, 0.8)
ping(7.4, 380, 0.03, -0.4); ping(10.2, 510, 0.025, 0.5)

# shot 3: hydraulic whine + chip clanks as the arms swing
ns = int(2.9 * SR); tt = np.arange(ns) / SR
x = pulse(140 + 25 * tt / 2.9, ns, 0.3); x = lp(x, 900) * np.clip(tt / 0.3, 0, 1) * np.clip((2.9 - tt) / 0.4, 0, 1) * 0.035
add(SFX, 12.2, x, -0.2); add(SFXV, 12.2, x, -0.2, 0.3)
def clank(t, vel=0.3, pan=0.0, big=False):
    ns = int((2.5 if big else 1.0) * SR); tt = np.arange(ns) / SR
    parts = [(213, 1.0), (561, 0.7), (903, 0.55), (1377, 0.4), (2019, 0.3), (2870, 0.2)]
    x = sum(a * np.sin(2 * np.pi * f * tt + rng.random() * 6) * np.exp(-tt * (6 + f / 300) / (2.2 if big else 1)) for f, a in parts)
    x = crush(x / 3, 5) + chipnoise(ns, 20000, short=True) * np.exp(-tt * 60) * 0.6
    if big:
        x += np.sin(2 * np.pi * np.cumsum(40 + 60 * np.exp(-tt * 12)) / SR) * np.exp(-tt * 4) * 1.4  # thud
    add(SFX, t, x * vel, pan); add(SFXV, t, x * vel, pan, 0.6 if big else 0.4)
for k, b in enumerate([0, 2, 4]): clank(bt(2, b), 0.08, -0.3 + 0.3 * k)
clank(16.4, 0.04, 0.5)
# shot 4/5: gull calls (chip pitch sweeps)
def gull(t, pan=0.3, vel=0.03):
    for k in range(3):
        ns = int(0.22 * SR); tt = np.arange(ns) / SR; f = 1500 + 700 * np.sin(np.pi * tt / 0.22) - 400 * tt / 0.22
        x = pulse(f, ns, 0.25) * np.sin(np.pi * tt / 0.22) ** 2 * vel; x = lp(x, 4000)
        add(SFX, t + k * 0.28, x, pan); add(SFXV, t + k * 0.28, x, pan, 0.5)
gull(16.9, 0.55); gull(20.4, -0.4, 0.02)
# shot 5: whoosh while tilting up past the sun
ns = int(4.5 * SR); tt = np.arange(ns) / SR; x = rng.standard_normal(ns)
x = np.concatenate([bp(x[i:i + 4800], 300 + 2500 * ((i / ns)), 600 + 4000 * (i / ns)) for i in range(0, ns, 4800)])[:ns]
x *= np.sin(np.pi * tt / 4.5) ** 2 * 0.05; add(SFX, 21.8, x, 0); add(SFXV, 21.8, x, 0, 0.5)

# sonic booms at ~30.1 (double): N-wave thump + chip crunch + long rumble
def boom(t, vel=1.0, pan=0.0):
    ns = int(3.5 * SR); tt = np.arange(ns) / SR
    nw = np.where(tt < 0.11, 1 - 2 * tt / 0.11, 0.0); nw = lp(nw, 900, 2)
    sub = np.sin(2 * np.pi * np.cumsum(32 + 30 * np.exp(-tt * 6)) / SR) * np.exp(-tt * 2.2)
    crunch = crush(lp(chipnoise(ns, 3200), 1800) * np.exp(-tt * 9), 4)
    rumble = lp(rng.standard_normal(ns), 140, 2) * np.exp(-tt * 1.1) * 4
    x = (nw * 1.4 + sub * 0.9 + crunch * 0.35 + rumble * 0.25) * vel
    add(SFX, t, x, pan); add(SFXV, t, x, pan, 0.45)
boom(30.10, 0.5, -0.1); boom(30.44, 0.4, 0.15)

# Raptor landing burn 55-66 s: chip-noise roar, crackle, sub; ignition burst at 55.0
t0, t1 = 54.9, 67.6; ns = int((t1 - t0) * SR); tt = np.arange(ns) / SR; at = t0 + tt
lev = np.interp(at, [54.9, 55.0, 55.25, 56.5, 60.2, 60.35, 64.5, 66.0, 67.0, 67.6], [0, 0.0, 1.0, 0.65, 0.75, 0.95, 1.0, 0.9, 0.2, 0.0])
roar = lp(chipnoise(ns, 2600 + 900 * lev), 1400, 2) * 0.8 + lp(chipnoise(ns, 700), 400, 2) * 0.9
crackle = np.zeros(ns); idx = rng.choice(ns, size=int((t1 - t0) * 70), replace=False); crackle[idx] = rng.choice([-1, 1], size=len(idx)) * rng.random(len(idx))
crackle = bp(np.convolve(crackle, np.exp(-np.arange(400) / 60), 'same'), 300, 3500) * 2.5
sub = np.sin(2 * np.pi * np.cumsum(38 + 4 * np.sin(2 * np.pi * 0.7 * tt)) / SR) * 0.6
flutter = 1 + 0.18 * np.sin(2 * np.pi * 13 * tt) * np.sin(2 * np.pi * 0.37 * tt)
x = (roar + crackle * 0.4 + sub) * lev * flutter * 0.16
for ch, pn in ((0, -0.08), (1, 0.08)):
    SFX[ch, int(t0 * SR):int(t0 * SR) + ns] += x * (1 + pn) ; SFXV[ch, int(t0 * SR):int(t0 * SR) + ns] += x * 0.3

# the catch: arms clamp at 68.5 s (beat 4 of the catch phrase) + rattles
clank(bt(7, 4), 0.55, 0.0, big=True); clank(bt(7, 4) + 0.21, 0.18, 0.4); clank(bt(7, 4) + 0.37, 0.1, -0.4)
clank(bt(7, 1.5), 0.06, -0.5)

# ================================================================== MIX
def reverb_ir(seconds, seed, damp=6000):
    r = np.random.default_rng(seed); ns = int(seconds * SR); tt = np.arange(ns) / SR
    ir = r.standard_normal((2, ns)) * np.exp(-tt * 6.9 / seconds)
    ir = np.stack([lp(ir[0], damp), lp(ir[1], damp)]); ir[:, :int(0.018 * SR)] = 0
    return ir / np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
def apply_verb(x, ir):
    return np.stack([signal.fftconvolve(x[c], ir[c])[:N] for c in range(2)])
ir_m = reverb_ir(2.6, 1, 5500); ir_s = reverb_ir(3.4, 2, 3000)
if '--buses' in sys.argv:
    for nm, b in (('MUS', MUS), ('VERB', VERB), ('SFX', SFX), ('SFXV', SFXV)):
        pk = np.abs(b).max(axis=0); i = int(pk.argmax()); print(nm, 'peak', round(float(pk.max()), 2), 'at', round(i / SR, 2), 'rms', round(float(np.sqrt((b ** 2).mean())), 4))
        for t0 in range(0, 92, 4): print('   %2d-%2d  pk %.2f' % (t0, t0 + 4, np.abs(b[:, t0 * SR:(t0 + 4) * SR]).max()), end='')
        print()
    sys.exit()
# music automation: calm sky -> tension -> catch -> resolve
tt = np.arange(N) / SR
auto = np.interp(tt, [0, 4.3, 12.1, 15.1, 18.9, 29.0, 30.1, 33.0, 45.0, 55.0, 60.3, 65.8, 68.5, 71.2, 78.6, 92],
                     [0.5, 0.55, 0.6, 0.66, 0.66, 0.72, 0.85, 0.75, 0.8, 0.9, 0.95, 1.0, 1.08, 1.05, 1.0, 0.9])
mix = (MUS + apply_verb(VERB, ir_m) * 0.55) * auto + SFX * 1.0 + apply_verb(SFXV, ir_s) * 0.5
# fade at the end: film fades to black ~88 s
tt = np.arange(N) / SR
mix *= np.clip((91.2 - tt) / 3.2, 0, 1) ** 1.5
mix = hp(mix, 25, 2)

def measure(x):
    tmp = OUT + '.tmp.wav'; wavfile.write(tmp, SR, (np.clip(x.T, -1, 1) * 32767).astype(np.int16) if False else x.T.astype(np.float32))
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', tmp, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    I = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', r)[-1]); TP = float(re.findall(r'Peak:\s+(-?[\d.inf]+) dBFS', r)[-1])
    import os; os.remove(tmp); return I, TP

def limiter(x, ceiling_db=-1.6, look=0.005, rel=0.15):
    """look-ahead peak limiter on 4x oversampled peaks (true-peak aware), smooth attack and release"""
    up = signal.resample_poly(x, 4, 1, axis=1)
    pk = np.max(np.abs(up), axis=0)[:x.shape[1] * 4].reshape(-1, 4).max(axis=1)
    ceil = 10 ** (ceiling_db / 20); g = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    la = int(look * SR)
    hold = np.lib.stride_tricks.sliding_window_view(np.concatenate([g, np.ones(la)]), la + 1).min(axis=1)[:len(g)]
    avg = np.convolve(np.concatenate([np.ones(la - 1), hold]), np.ones(la) / la, 'valid')[:len(g)]
    a = np.exp(-1 / (rel * SR)); slow = signal.lfilter([1 - a], [1, -a], avg - 1)[0:len(g)] + 1
    gr = np.minimum(avg, slow); grdb = -20 * np.log10(np.maximum(gr, 1e-6))
    print('  limiter: max GR %.1f dB, time >3dB %.2f s, >1dB %.2f s, worst at %.2f s' % (grdb.max(), (grdb > 3).sum() / SR, (grdb > 1).sum() / SR, grdb.argmax() / SR))
    return x * gr

target = -14.0
I, TP = measure(mix); print('raw', I, TP)
for it in range(6):
    mix *= 10 ** ((target - I) / 20)
    lim = limiter(mix)
    I, TP = measure(lim); print('iter', it, 'I', I, 'TP', TP)
    if abs(I - target) < 0.15 and TP < -1.0: break
mix = lim
I, TP = measure(mix)
wavfile.write(OUT, SR, (np.clip(mix.T, -1, 1) * (2 ** 31 - 1)).astype(np.int32))
info = {'integrated_LUFS': I, 'true_peak_dBTP': TP, 'duration_s': N / SR, 'sr': SR, 'cuts': CUTS, 'beats': BEATS}
print(json.dumps(info))
json.dump(info, open(OUT.replace('.wav', '_loudness.json'), 'w'), indent=1)
