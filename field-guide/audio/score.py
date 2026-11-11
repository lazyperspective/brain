#!/usr/bin/env python3
"""Fable 5.2: A Field Guide -- the soundtrack.

A calm, warm documentary bed (strings, piano, clarinet, flute, pizzicato, harp, celesta; choir for the god-hand,
brass for the crown) written here as MIDI and rendered with fluidsynth + FluidR3_GM, which keeps getting interrupted
by comedy: every sound effect is synthesized in numpy/scipy (no samples) and placed on the exact frame of its cue
from js/timeline.js (exported to audio/cues.json by tools/cues.js). Musical jokes are part of the score: the plank
bridge climbs a scale that stops one note short of home and only resolves when the last plank slaps in.

Mastered to about -14 LUFS integrated (BS.1770-4 K-weighted, gated), true peak below -1 dBTP (4x oversampled).
  python3 audio/score.py [out.wav] [report.txt]
"""
import json, os, sys, struct, subprocess, shutil
import numpy as np
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
CUE = json.load(open(os.path.join(HERE, 'cues.json')))
DUR = float(CUE['dur'])
NS = int(round(SR * DUR))
E = CUE['E']
SF2 = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
RNG = np.random.default_rng(5205)


def fr(t):  # snap to the frame grid
    return round(t * 30) / 30.0


# =============================================================================================== MIDI writer
PPQ = 480
TEMPO_US = 500000                          # 120 bpm: one quarter = 0.5 s, so a tick = 1/960 s


def tick(t):
    return int(round(t * 960))


def vlq(n):
    out = [n & 0x7F]
    n >>= 7
    while n:
        out.append((n & 0x7F) | 0x80)
        n >>= 7
    return bytes(reversed(out))


class Score:
    def __init__(self):
        self.ev = {}                        # channel -> list of (tick, order, bytes)

    def _add(self, ch, t, data, order=1):
        self.ev.setdefault(ch, []).append((tick(max(0.0, t)), order, data))

    def prog(self, ch, p, t=0.0):
        self._add(ch, t, bytes([0xC0 | ch, p]), 0)

    def cc(self, ch, t, c, v):
        self._add(ch, t, bytes([0xB0 | ch, c, int(max(0, min(127, v)))]), 0)

    def bend(self, ch, t, v):              # v in -1..1
        b = int(8192 + max(-1, min(1, v)) * 8191)
        self._add(ch, t, bytes([0xE0 | ch, b & 0x7F, (b >> 7) & 0x7F]), 0)

    def note(self, ch, t, d, p, v=64):
        if isinstance(p, str):
            p = midi(p)
        self._add(ch, t, bytes([0x90 | ch, p, int(max(1, min(127, v)))]), 2)
        self._add(ch, t + max(0.02, d), bytes([0x80 | ch, p, 0]), 1)

    def chord(self, ch, t, d, ps, v=64):
        for p in ps:
            self.note(ch, t, d, p, v)

    def write(self, path):
        trk0 = b'\x00\xff\x51\x03' + TEMPO_US.to_bytes(3, 'big') + b'\x00\xff\x2f\x00'
        chunks = [b'MTrk' + struct.pack('>I', len(trk0)) + trk0]
        for ch in sorted(self.ev):
            ev = sorted(self.ev[ch], key=lambda e: (e[0], e[1]))
            tr = bytearray()
            last = 0
            for tk, _, data in ev:
                tr += vlq(tk - last) + data
                last = tk
            tr += b'\x00\xff\x2f\x00'
            chunks.append(b'MTrk' + struct.pack('>I', len(tr)) + bytes(tr))
        with open(path, 'wb') as f:
            f.write(b'MThd' + struct.pack('>IHHH', 6, 1, len(chunks), PPQ) + b''.join(chunks))


NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def midi(s):
    n = NOTE[s[0]]
    i = 1
    while i < len(s) and s[i] in '#b':
        n += 1 if s[i] == '#' else -1
        i += 1
    return 12 * (int(s[i:]) + 1) + n


# =============================================================================================== the score
STR, PNO, CLA, FLT, PIZZ, HARP, CEL, CHOIR, HORN, DRUM, TIMP, BSN, MAR, XYL, BRASS, OBOE = range(16)
PROGRAMS = {STR: 48, PNO: 0, CLA: 71, FLT: 73, PIZZ: 45, HARP: 46, CEL: 8, CHOIR: 52, HORN: 60, TIMP: 47, BSN: 70,
            MAR: 12, XYL: 13, BRASS: 61, OBOE: 68}
VOLUME = {STR: 92, PNO: 88, CLA: 96, FLT: 92, PIZZ: 104, HARP: 96, CEL: 100, CHOIR: 84, HORN: 92, DRUM: 80,
          TIMP: 96, BSN: 100, MAR: 108, XYL: 96, BRASS: 92, OBOE: 88}


def arp(S, ch, t0, t1, step, notes, v, dur=None):
    t, i = t0, 0
    while t < t1 - 1e-6:
        S.note(ch, t, dur or step * 1.6, notes[i % len(notes)], v)
        t += step
        i += 1


def compose():
    S = Score()
    for ch, p in PROGRAMS.items():
        S.prog(ch, p)
        S.cc(ch, 0, 7, VOLUME.get(ch, 90))
        S.cc(ch, 0, 91, 70 if ch not in (PIZZ, MAR, XYL) else 45)
        S.cc(ch, 0, 11, 110)
    # ---- 1: the thinking theme (F major), a beat of silence, "hi."
    S.chord(STR, 0.6, 1.68, ['F3', 'C4', 'A4'], 46)
    arp(S, PNO, 0.62, 2.25, 0.3, ['F3', 'C4', 'F4', 'A4', 'C5', 'A4', 'F4', 'C4'], 50)
    arp(S, PIZZ, 1.45, 2.28, 0.3, ['C5', 'G4'], 34, 0.1)                 # tick-tock (the gears)
    for t, n, d in [(1.45, 'A4', 0.28), (1.75, 'G4', 0.28), (2.05, 'F4', 0.22)]:
        S.note(CLA, t, d, n, 62)
    S.note(CEL, E['hiSay'], 0.2, 'C6', 56)
    # ---- 2: the sign, reading, the cloud doubles
    S.chord(STR, 2.6, 1.6, ['D3', 'A3', 'F4'], 44)
    arp(S, PNO, 2.6, 4.18, 0.3, ['D3', 'A3', 'D4', 'F4', 'A4', 'F4', 'D4', 'A3'], 46)
    arp(S, PIZZ, 2.6, 4.18, 0.3, ['A4', 'E4'], 30, 0.1)
    for t, n in zip(E['signHits'], ['D2', 'D2', 'A1']):
        S.note(BSN, t, 0.14, n, 92)
    for i, t in enumerate([3.78, 3.93, 4.08]):
        S.note(CLA, t, 0.1, ['E5', 'F5', 'G5'][i], 44)
    td = E['cloudDouble']
    S.prog(STR, 44, td - 0.01)
    S.chord(STR, td, 0.86, ['C3', 'G3', 'E4', 'C5'], 70)
    for k in range(32):
        S.cc(STR, td + k * 0.027, 11, 60 + k * 2)
    for k in range(17):
        S.note(TIMP, td + k * 0.05, 0.06, 'C2', 40 + k * 3)
    S.prog(STR, 48, 5.3)
    S.cc(STR, 5.3, 11, 110)
    # ---- 2b: "hi!" -- bright and instant; then the playful flight
    S.note(CEL, E['hiSay2'], 0.12, 'C6', 64)
    S.note(CEL, E['hiSay2'] + 0.07, 0.25, 'E6', 64)
    S.chord(STR, 5.4, 1.3, ['F3', 'A3', 'C4', 'F4'], 56)
    for t, n, d in [(5.45, 'C5', 0.14), (5.6, 'D5', 0.14), (5.75, 'E5', 0.14), (5.9, 'F5', 0.28), (6.2, 'A5', 0.28), (6.5, 'G5', 0.4)]:
        S.note(FLT, t, d, n, 70)
    arp(S, PIZZ, 5.4, 6.9, 0.3, ['F2', 'C3'], 70, 0.15)
    for k, n in enumerate(['C6', 'F6', 'A6', 'C7']):
        S.note(CEL, 6.38 + k * 0.05, 0.3, n, 40)                         # inside the cloud: a sparkle
    # ---- 3: the bridge climbs a scale ... and stops one note short of home
    S.chord(STR, 6.9, 1.2, ['F3', 'C4', 'A4'], 40)
    for t, n in zip(E['planks'], ['G4', 'A4', 'Bb4', 'C5', 'D5']):
        S.note(MAR, t, 0.25, n, 96)
        S.note(PIZZ, t, 0.12, midi(n) - 24, 70)
    S.note(MAR, E['stopShort'], 0.6, 'E5', 92)
    S.chord(STR, E['stopShort'], 0.3, ['C3', 'E3', 'Bb3', 'G4'], 58)        # the dominant, left hanging
    tl = E['lastPlank']                                                    # (the record scratch cuts the music)
    S.note(MAR, tl, 0.6, 'F5', 110)
    S.chord(STR, tl, 1.0, ['F3', 'C4', 'A4', 'F5'], 72)
    S.note(TIMP, tl, 0.4, 'F2', 90)
    for k, n in enumerate(['F4', 'A4', 'C5', 'F5', 'A5', 'C6', 'F6']):
        S.note(HARP, tl + k * 0.035, 0.6, n, 70)
    walk = ['F2', 'A2', 'C3', 'D3', 'F3', 'D3', 'C3', 'A2']
    arp(S, PIZZ, 9.8, 10.62, 0.15, walk, 74, 0.1)
    for t, n in [(9.8, 'C5'), (9.95, 'D5'), (10.1, 'F5'), (10.25, 'A5'), (10.4, 'G5')]:
        S.note(CLA, t, 0.13, n, 62)
    # ---- 4: the god-hand: choir, harp; two "huh?"s; the banner
    S.chord(CHOIR, E['thumbDown'], 1.3, ['F4', 'A4', 'C5', 'F5'], 70)
    S.chord(STR, E['thumbDown'], 1.3, ['F5', 'A5', 'C6'], 34)
    for k, n in enumerate(['C4', 'F4', 'A4', 'C5', 'F5', 'A5', 'C6', 'F6', 'A6']):
        S.note(HARP, E['thumbDown'] + k * 0.04, 0.8, n, 64)
    for t, (a, b) in zip(E['huh'], [('C3', 'F3'), ('D3', 'G3')]):
        S.note(BSN, t, 0.07, a, 80)
        S.note(BSN, t + 0.08, 0.14, b, 84)
    for k, n in enumerate(['F6', 'C6', 'A5', 'F5', 'C5', 'A4']):
        S.note(HARP, E['banner'] + k * 0.04, 0.5, n, 54)
    S.chord(STR, 12.4, 1.0, ['Bb3', 'D4', 'F4'], 40)
    for t, n in [(12.5, 'G4'), (12.7, 'A4'), (12.9, 'Bb4')]:
        S.note(CLA, t, 0.16, n, 52)
    S.note(FLT, 12.95, 0.22, 'C6', 60)
    S.chord(BRASS, E['salute'], 0.14, ['C4', 'E4', 'G4'], 78)
    S.chord(BRASS, E['salute'] + 0.15, 0.32, ['F4', 'A4', 'C5'], 86)
    for k in range(10):
        S.note(XYL, E['sprint'] + 0.03 + k * 0.03, 0.08, ['F4', 'G4', 'A4', 'C5', 'D5', 'F5', 'G5', 'A5', 'C6', 'F6'][k], 70)
    # ---- 5: the crown fanfare, the tidying frenzy
    tc = E['crown']
    for k, n in enumerate(['F4', 'A4', 'C5']):
        S.note(BRASS, tc + k * 0.08, 0.1, n, 92)
    S.chord(BRASS, tc + 0.24, 0.5, ['F4', 'A4', 'C5', 'F5'], 96)
    S.chord(STR, tc + 0.24, 0.5, ['F3', 'C4', 'A4'], 60)
    S.note(TIMP, tc + 0.24, 0.3, 'F2', 92)
    run_up = ['F5', 'G5', 'A5', 'Bb5', 'C6', 'D6', 'E6', 'F6']
    run_dn = list(reversed(run_up))
    t = 15.0
    k = 0
    while t < 17.3:
        pat = run_up if (k // 8) % 2 == 0 else run_dn
        S.note(XYL, t, 0.1, midi(pat[k % 8]) - 12, 64 + (k % 4 == 0) * 10)
        t += 0.12
        k += 1
    arp(S, PIZZ, 15.0, 17.3, 0.24, ['F2', 'C3', 'A2', 'C3'], 74, 0.12)
    arp(S, BSN, 15.12, 17.3, 0.48, ['C3', 'F3'], 58, 0.12)
    S.chord(STR, 15.0, 2.3, ['F3', 'C4'], 38)
    S.chord(BRASS, E['proud'], 0.45, ['F4', 'A4', 'C5'], 82)
    S.chord(STR, E['proud'], 0.5, ['F3', 'C4', 'A4', 'F5'], 66)
    # ---- 6: (silence) ... then a little step up with each update
    S.chord(STR, 20.3, 2.15, ['F3', 'C4', 'A4'], 38)
    for t, (a, b) in zip(E['pops'], [('C5', 'E5'), ('D5', 'F5'), ('E5', 'G5')]):
        S.note(MAR, t, 0.25, a, 84)
        S.note(MAR, t + 0.09, 0.3, b, 88)
        S.note(CEL, t + 0.09, 0.3, b, 46)
    # ---- 7: rise up the dial; the clone march grows with each wave
    for k, n in enumerate(['F3', 'A3', 'C4', 'F4', 'A4', 'C5', 'F5', 'A5']):
        S.note(STR, E['crane'] + k * 0.065, 0.55 - k * 0.04, n, 54 + k * 3)
        S.note(HARP, E['crane'] + k * 0.06, 0.4, n, 56)
    S.note(TIMP, E['burst'], 0.4, 'F2', 96)
    S.note(DRUM, E['burst'], 0.5, 49, 50)
    march = ['F3', 'F3', 'C3', 'F3', 'A3', 'G3', 'F3', 'C3']
    waves = [w[0] for w in E['cloneWaves']]
    t = 23.33
    k = 0
    while t < 24.82:
        n = march[k % 8]
        S.note(BSN, t, 0.12, n, 84)
        if t >= waves[1] - 0.05:
            S.note(CLA, t, 0.12, midi(n) + 12, 70)
        if t >= waves[2] - 0.05:
            S.note(FLT, t, 0.12, midi(n) + 24, 64)
            S.note(PIZZ, t, 0.12, midi(n) - 12, 70)
        if t >= waves[3] - 0.05:
            S.note(OBOE, t, 0.12, midi(n) + 19, 60)
            S.note(XYL, t, 0.1, midi(n) + 24, 56)
        t += 0.15
        k += 1
    S.chord(STR, 23.33, 1.5, ['F2', 'C3', 'F3'], 44)
    # ---- 7b: half of them pop: the band thins, then a warm settle
    for k, t in enumerate(E['bubblePops']):
        S.note(PIZZ, t, 0.08, ['C6', 'A5', 'G5', 'F5', 'D5', 'C5', 'A4'][k], 60)
    S.chord(STR, 25.68, 0.75, ['F3', 'A3', 'C4', 'F4'], 46)
    S.chord(PNO, 25.68, 0.75, ['F3', 'C4', 'A4'], 44)
    # ---- 8: the sticky-note snow; stiffening; "may I blink?"; the gust; relief
    r = np.random.default_rng(88)
    pent = ['F5', 'G5', 'A5', 'C6', 'D6', 'F6', 'G6', 'A6']
    t = 26.5
    while t < 28.9:
        S.note(CEL, t, 0.4, pent[int(r.integers(0, len(pent)))], 34 + int(r.integers(0, 12)))
        t += 0.18 + 0.08 * float(r.random())
    S.chord(STR, 26.5, 2.4, ['Bb3', 'D4', 'F4'], 38)
    S.prog(STR, 44, 28.9)
    S.note(STR, 28.95, 0.8, 'A4', 40)
    S.prog(STR, 48, 29.8)
    S.note(CLA, E['blinkAsk'], 0.15, 'G4', 44)
    S.note(CLA, E['blinkAsk'] + 0.17, 0.3, 'A4', 46)
    for k, n in enumerate(['A6', 'F6', 'C6', 'A5', 'F5', 'C5', 'A4', 'F4']):
        S.note(HARP, E['gust'] + k * 0.04, 0.5, n, 60)
    S.chord(STR, E['cleanNote'], 0.85, ['F3', 'C4', 'A4', 'F5'], 56)
    S.chord(PNO, E['cleanNote'], 0.85, ['F3', 'A3', 'C4'], 52)
    for t, n in [(30.32, 'C5'), (30.47, 'D5'), (30.62, 'F5')]:
        S.note(CLA, t, 0.14, n, 64)
    # ---- 9: the report: dense chatter, the viewer's eyes spin; then one clean phrase
    r = np.random.default_rng(91)
    chrom = list(range(midi('E4'), midi('E6')))
    for ch, base, off in [(FLT, 12, 0.0), (CLA, 0, 0.05), (OBOE, 7, 0.025)]:
        t = 31.6 + off
        while t < 33.32:
            S.note(ch, t, 0.09, int(chrom[int(r.integers(0, len(chrom)))] + (base - 6) // 2), 46 + int(r.integers(0, 14)))
            t += 0.1
    S.chord(STR, 31.6, 1.75, ['E3', 'Bb3', 'Eb4'], 34)
    for k in range(25):                                                   # the dizzy wobble: woodwinds go seasick
        v = 0.25 * np.sin(k * 0.9)
        for ch in (FLT, CLA, OBOE):
            S.bend(ch, E['spin'] + k * 0.032, v)
    for ch in (FLT, CLA, OBOE):
        S.bend(ch, E['spinEnd'], 0.0)
    for t, n in [(E['card'], 'F5'), (E['card'] + 0.22, 'C5'), (E['card'] + 0.44, 'A4'), (E['card'] + 0.66, 'F4')]:
        S.note(PNO, t, 0.3, n, 66)
    S.chord(STR, E['card'], 0.9, ['F3', 'C4', 'A4'], 42)
    # ---- 10: three hops up to the top, and the closing theme
    for t, n in zip(E['hops'], ['F3', 'A3', 'C4']):
        S.note(PIZZ, t, 0.12, n, 80)
    S.chord(STR, 35.45, 2.1, ['F2', 'C3', 'F3', 'A3', 'C4'], 60)
    for t, n, d in [(35.5, 'C4', 0.55), (36.05, 'F4', 0.55), (36.6, 'A4', 0.85), (37.45, 'G4', 0.3), (37.75, 'F4', 0.35), (38.1, 'E4', 0.4), (38.5, 'F4', 1.5)]:
        S.note(HORN, t, d, n, 76)
    arp(S, PNO, 35.5, 38.4, 0.3, ['F3', 'C4', 'F4', 'A4', 'C5', 'A4', 'F4', 'C4'], 52)
    arp(S, HARP, 35.5, 37.45, 0.15, ['F4', 'A4', 'C5', 'F5'], 44, 0.4)
    S.chord(STR, 37.55, 0.6, ['Bb2', 'F3', 'D4', 'Bb4'], 62)
    S.chord(STR, 38.15, 0.4, ['C3', 'G3', 'E4', 'Bb4'], 62)
    S.chord(STR, 38.55, 1.45, ['F2', 'C3', 'F3', 'A3', 'C4', 'F4'], 66)
    S.chord(PNO, 38.55, 1.45, ['F2', 'F3', 'A3', 'C4', 'F4'], 56)
    S.chord(CHOIR, 36.7, 3.3, ['F4', 'A4', 'C5'], 50)
    for k, n in enumerate(['C6', 'F6', 'A6']):
        S.note(CEL, E['title'] + k * 0.09, 0.8, n, 60)
    for t in [38.55 + 0.5 * k for k in range(3)]:
        S.note(HARP, t, 0.6, 'F5', 40)
    # the handler's tip: a little celesta signature each time a card lands
    for c in CUE['caps']:
        if c['kind'] == 'tip':
            for k, n in enumerate(['A5', 'C6', 'F6']):
                S.note(CEL, c['t0'] + 0.03 + k * 0.07, 0.35, n, 50)
    return S


# music gates: where the comedy interrupts the bed (start, end) with short ramps; the scratch is a hard stop
GATES = [(2.29, 2.52, 0.03), (E['deflate'] - 0.01, E['hiSay2'] - 0.03, 0.02), (E['scratch'] + 0.03, E['lastPlank'] - 0.004, 0.01),
         (E['dive'] - 0.02, 20.28, 0.08), (E['spinEnd'], E['collapse'] - 0.02, 0.05)]


def render_music():
    tmp = os.path.join(HERE, '_tmp')
    os.makedirs(tmp, exist_ok=True)
    mid, wav = os.path.join(tmp, 'score.mid'), os.path.join(tmp, 'score_fs.wav')
    S = compose()
    S.write(mid)
    shutil.copy(mid, os.path.join(HERE, 'score.mid'))
    subprocess.run(['fluidsynth', '-ni', '-q', '-R', '1', '-C', '0', '-r', str(SR), '-g', '0.42',
                    '-o', 'synth.reverb.room-size=0.62', '-o', 'synth.reverb.level=0.5', '-o', 'synth.reverb.width=0.9',
                    '-o', 'synth.polyphony=512', '-O', 'float', '-T', 'wav', '-F', wav, SF2, mid], check=True, capture_output=True)
    import soundfile as sf
    x, sr = sf.read(wav, dtype='float64', always_2d=True)
    assert sr == SR
    os.remove(wav)
    os.remove(mid)
    os.rmdir(tmp)
    y = np.zeros((NS, 2))
    n = min(NS, len(x))
    y[:n] = x[:n]
    return y


def gate_env():
    g = np.ones(NS)
    t = np.arange(NS) / SR
    for a, b, ramp in GATES:
        down = np.clip((t - a) / ramp, 0, 1)
        up = np.clip((t - b) / max(ramp, 0.01), 0, 1)
        g = np.minimum(g, 1 - down + up * (t >= b))
    g = np.clip(g, 0, 1)
    # the very end: ring out and fade
    g *= np.clip((DUR - t) / 1.1, 0, 1) ** 0.7
    return g


# =============================================================================================== sound effects
def T(d):
    return np.arange(int(d * SR)) / SR


def bp(x, f0, f1, order=2):
    nyq = SR / 2
    b, a = signal.butter(order, [max(20, f0) / nyq, min(f1, nyq * 0.98) / nyq], 'band')
    return signal.lfilter(b, a, x)


def lp(x, fc, order=2):
    b, a = signal.butter(order, min(fc, SR / 2 * 0.98) / (SR / 2), 'low')
    return signal.lfilter(b, a, x)


def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), 'high')
    return signal.lfilter(b, a, x)


def noise(d, seed):
    return np.random.default_rng(seed).standard_normal(int(d * SR))


def expd(d, tau):
    return np.exp(-T(d) / tau)


def att(x, a=0.002):
    n = max(1, int(a * SR))
    x = x.copy()
    x[:n] *= np.linspace(0, 1, n)
    return x


def fade_out(x, f=0.01):
    n = max(1, int(f * SR))
    x = x.copy()
    x[-n:] *= np.linspace(1, 0, n)
    return x


def sweep(d, f0, f1, curve=1.0, vib=0.0, vibf=6.0, shape='sine'):
    t = T(d)
    u = (t / d) ** curve
    f = f0 * (f1 / f0) ** u if f0 > 0 and f1 > 0 else f0 + (f1 - f0) * u
    f = f * (1 + vib * np.sin(2 * np.pi * vibf * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    if shape == 'saw':
        return 2 * ((ph / (2 * np.pi)) % 1) - 1
    if shape == 'tri':
        return 2 * np.abs(2 * ((ph / (2 * np.pi)) % 1) - 1) - 1
    return np.sin(ph)


def modal(d, parts, seed=0):
    """parts: (freq, amp, tau)"""
    t = T(d)
    y = np.zeros_like(t)
    for f, a, tau in parts:
        y += a * np.sin(2 * np.pi * f * t + seed) * np.exp(-t / tau)
    return y


def pad_to(x, d):
    n = int(d * SR)
    return np.pad(x, (0, max(0, n - len(x))))[:n] if len(x) < n else x


def mix(*xs):
    n = max(len(x) for x in xs)
    y = np.zeros(n)
    for x in xs:
        y[:len(x)] += x
    return y


def norm(x, peak=0.5):
    m = np.max(np.abs(x)) + 1e-12
    return x / m * peak


# each returns (mono or stereo array, pre-roll seconds: how far before the cue the sound starts)
def sfx_fallwhistle(p):
    x = sweep(0.46, 1700, 560, 1.0, 0.012, 7) * (0.3 + 0.7 * T(0.46) / 0.46)
    return norm(fade_out(att(x, 0.02), 0.02), 0.32), 0.0


def sfx_thud(p):
    d = 0.9
    boom = sweep(d, 95, 36, 0.5) * expd(d, 0.22)
    body = bp(noise(d, 11), 80, 400) * expd(d, 0.08)
    knock = modal(d, [(210, 1, 0.06), (470, 0.6, 0.04), (950, 0.3, 0.02)])
    crunch = bp(noise(d, 12), 1500, 6000) * expd(d, 0.03) * 0.4
    return norm(att(boom * 1.4 + body * 0.8 + knock * 0.5 + crunch, 0.001), 0.95), 0.0


def sfx_plop(p):
    x = sweep(0.12, 320, 110, 0.6) * expd(0.12, 0.04)
    return norm(att(x), 0.4), 0.0


def sfx_puff(p):
    x = bp(noise(0.16, 20 + int(p)), 900 + 300 * min(p, 3), 3500) * np.sin(np.pi * T(0.16) / 0.16) ** 2
    return norm(x, 0.25), 0.0


def sfx_inflate(p):
    d = 0.4
    x = bp(noise(d, 30), 400, 2500) * (T(d) / d) ** 1.5 * 0.6 + sweep(d, 180, 520, 1.2) * (T(d) / d) * 0.5
    x = mix(x, pad_to(np.zeros(1), 0.0))
    return norm(fade_out(x, 0.03), 0.45), 0.0


def sfx_inflate2(p):
    d = 0.55
    x = bp(noise(d, 31), 300, 3000) * (T(d) / d) ** 1.2 * 0.7 + sweep(d, 140, 700, 1.4) * (T(d) / d) * 0.6
    boing = sweep(0.35, 700, 520, 1, 0.08, 14) * expd(0.35, 0.12)
    y = np.concatenate([x, boing * 0.6])
    return norm(fade_out(y, 0.03), 0.6), 0.0


def sfx_tiny(p):
    x = sweep(0.07, 1500, 2100, 1) * np.sin(np.pi * T(0.07) / 0.07)
    return norm(x, 0.22), 0.0


def sfx_blip(p):
    a = sweep(0.06, 1046, 1100) * np.sin(np.pi * T(0.06) / 0.06)
    b = sweep(0.09, 1318, 1400) * np.sin(np.pi * T(0.09) / 0.09)
    return norm(np.concatenate([a, b]), 0.3), 0.0


def sfx_stake(p):
    d = 0.35
    x = modal(d, [(180 - p * 10, 1, 0.07), (420, 0.7, 0.05), (1100, 0.4, 0.03), (2300, 0.2, 0.015)])
    x += bp(noise(d, 40 + int(p)), 1000, 5000) * expd(d, 0.008) * 0.6
    return norm(att(x, 0.0005), 0.8), 0.0


def sfx_click(p):
    d = 0.06
    x = bp(noise(d, 50 + int(p)), 2000, 7000) * expd(d, 0.004) + modal(d, [(2600 + p * 150, 0.5, 0.012)])
    return norm(att(x, 0.0003), 0.5), 0.0


def sfx_squeak(p):
    d = 0.55
    t = T(d)
    f = 820 * (1 - 0.45 * t / d) * (1 + 0.06 * np.sin(2 * np.pi * 19 * t) + 0.03 * np.sin(2 * np.pi * 31 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = (np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph)) * (0.6 + 0.4 * np.sin(np.pi * t / d))
    x = bp(x, 300, 4000)
    return norm(fade_out(att(x, 0.01), 0.04), 0.55), 0.0


def sfx_pfft(p):
    d = 0.75
    t = T(d)
    x = hp(noise(d, 60), 900) * (0.55 + 0.45 * np.sin(2 * np.pi * 23 * t)) * np.exp(-t / 0.4)
    return norm(att(x, 0.02), 0.3), 0.0


def whoosh(d, f0, f1, f2, seed, peak_at=0.5):
    n = int(d * SR)
    x = noise(d, seed)
    out = np.zeros(n)
    seg = 1024
    for i in range(0, n, seg // 2):
        u = i / n
        fc = f0 * (f1 / f0) ** (u / peak_at) if u < peak_at else f1 * (f2 / f1) ** ((u - peak_at) / (1 - peak_at))
        w = np.hanning(seg)
        chunk = x[i:i + seg]
        if len(chunk) < seg:
            chunk = np.pad(chunk, (0, seg - len(chunk)))
        y = bp(chunk, fc * 0.6, fc * 1.6)
        end = min(n, i + seg)
        out[i:end] += (y * w)[:end - i]
    env = np.sin(np.pi * np.clip(np.arange(n) / n, 0, 1)) ** 1.1
    return out * env


def sfx_whoosh(p):
    return norm(whoosh(0.7, 250, 2200, 500, 70, 0.45), 0.55), 0.0


def sfx_whooshDown(p):
    return norm(whoosh(0.4, 2400, 900, 300, 71, 0.5), 0.35), 0.0


def sfx_whooshUp(p):
    return norm(whoosh(0.5, 300, 1200, 3000, 72, 0.6), 0.35), 0.0


def sfx_bonk(p):
    d = 0.3
    f = 230 + p * 18
    x = modal(d, [(f, 1, 0.06), (f * 2.4, 0.6, 0.035), (f * 5.1, 0.3, 0.015)])
    x += bp(noise(d, 80 + int(p)), 800, 4000) * expd(d, 0.006) * 0.5
    return norm(att(x, 0.0005), 0.6), 0.0


def sfx_bonkbig(p):
    d = 0.6
    x = modal(d, [(170, 1, 0.12), (410, 0.7, 0.07), (930, 0.4, 0.04), (1900, 0.2, 0.02)])
    x += bp(noise(d, 90), 500, 4000) * expd(d, 0.01) * 0.7 + sweep(d, 120, 60) * expd(d, 0.1) * 0.6
    return norm(att(x, 0.0005), 0.9), 0.0


def sfx_scratch(p):
    d = 0.42
    t = T(d)
    rate = 1 + 0.9 * np.sin(2 * np.pi * 4.2 * t + 0.4)
    x = noise(d, 100)
    out = np.zeros_like(x)
    seg = 512
    for i in range(0, len(x), seg // 2):
        fc = 600 + 2600 * abs(rate[min(i, len(rate) - 1)])
        chunk = x[i:i + seg]
        if len(chunk) < seg:
            chunk = np.pad(chunk, (0, seg - len(chunk)))
        y = bp(chunk, fc * 0.7, fc * 1.4) * np.hanning(seg)
        end = min(len(x), i + seg)
        out[i:end] += y[:end - i]
    tone = sweep(d, 300, 900, 1, 0.3, 4.2, 'saw') * 0.15
    y = (out + tone) * np.exp(-t / 0.3)
    return norm(att(y, 0.002), 0.7), 0.0


def sfx_swish(p):
    return norm(whoosh(0.22, 1500, 5000, 2000, 110 + int(p * 3), 0.4), 0.35), 0.05


def sfx_huh(p):
    x = sweep(0.22, 420 + 60 * p, 900 + 90 * p, 1.6, 0.02, 9) * np.sin(np.pi * T(0.22) / 0.22) ** 0.5
    return norm(fade_out(att(x, 0.01), 0.03), 0.3), 0.0


def sfx_unfurl(p):
    d = 0.42
    t = T(d)
    x = bp(noise(d, 120), 600, 4000) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * (40 - 60 * t) * t))) * np.sin(np.pi * t / d)
    snap = np.zeros_like(x)
    k = int(0.38 * SR)
    snap[k:k + int(0.03 * SR)] = bp(noise(0.03, 121), 800, 5000) * np.exp(-np.arange(int(0.03 * SR)) / SR / 0.005)
    return norm(x * 0.6 + snap, 0.4), 0.0


def sfx_ting(p):
    x = modal(0.9, [(2093, 1, 0.3), (5440, 0.4, 0.12), (8100, 0.15, 0.05)])
    return norm(att(x, 0.0005), 0.35), 0.0


def sfx_zip(p):
    a = whoosh(0.3, 600, 3500, 3000, 130 + int(p), 0.7)
    b = sweep(0.3, 500, 1800, 1.5) * np.linspace(0.2, 1, int(0.3 * SR)) * 0.3
    return norm(fade_out(a + b, 0.03), 0.5), 0.05


def sfx_crown(p):
    d = 1.1
    x = modal(d, [(523, 1, 0.4), (1388, 0.6, 0.25), (2604, 0.35, 0.15), (3950, 0.2, 0.08)])
    r = np.random.default_rng(140)
    for k in range(9):
        f = 2000 + 3000 * r.random()
        st = int((0.05 + 0.08 * k) * SR)
        s = modal(0.3, [(f, 0.25, 0.08)])
        x[st:st + len(s)] += s[:max(0, len(x) - st)]
    return norm(att(x, 0.0005), 0.55), 0.0


def sfx_squish(p):
    d = 0.4
    x = sweep(d, 160, 70, 0.7, 0.15, 11) * expd(d, 0.15) + lp(noise(d, 150), 900) * expd(d, 0.08) * 0.5
    return norm(att(x, 0.005), 0.5), 0.0


def sfx_poof(p):
    d = 0.4
    x = lp(noise(d, 160), 1800) * expd(d, 0.09) + bp(noise(d, 161), 2000, 6000) * expd(d, 0.03) * 0.3
    return norm(att(x, 0.002), 0.45), 0.0


def sfx_thwip(p):
    a = sweep(0.09, 600 + 80 * p, 2200 + 120 * p, 1.5) * np.sin(np.pi * T(0.09) / 0.09)
    b = bp(noise(0.05, 170 + int(p)), 2000, 7000) * expd(0.05, 0.008)
    return norm(mix(a * 0.5, b), 0.35), 0.0


def sfx_meter(p):
    d = 2.0
    y = np.zeros(int(d * SR))
    t = 0.0
    k = 0
    while t < d - 0.05:
        rate = 14 + 40 * (t / d) ** 1.3
        s = modal(0.03, [(2200 + 900 * t / d, 0.6, 0.006)]) + bp(noise(0.03, 180 + k), 3000, 8000) * expd(0.03, 0.002) * 0.4
        st = int(t * SR)
        y[st:st + len(s)] += s[:max(0, len(y) - st)]
        t += 1 / rate
        k += 1
    return norm(y, 0.22), 0.0


def sfx_ding(p):
    x = modal(1.2, [(1318.5, 1, 0.5), (2637, 0.35, 0.3), (3955, 0.15, 0.15)])
    return norm(att(x, 0.0005), 0.35), 0.0


def sfx_dive(p):
    w = whoosh(0.35, 2000, 600, 200, 190, 0.5) * 0.7
    plunk = sweep(0.25, 600, 150, 0.4) * expd(0.25, 0.06)
    dirt = bp(noise(0.3, 191), 600, 5000) * expd(0.3, 0.05) * 0.5
    y = np.zeros(int(0.7 * SR))
    y[:len(w)] += w
    st = int(0.3 * SR)
    y[st:st + len(plunk)] += plunk
    y[st:st + len(dirt)] += dirt
    return norm(y, 0.5), 0.3


def sfx_wind(p):
    d = 1.4
    t = T(d)
    x = lp(noise(d, 200), 700) * (0.4 + 0.6 * np.sin(np.pi * t / d) ** 2) + bp(noise(d, 201), 1500, 3000) * 0.08 * np.sin(np.pi * t / d)
    return norm(x, 0.22), 0.0


def sfx_cricket(p):
    y = np.zeros(int(0.3 * SR))
    for k in range(4):
        s = np.sin(2 * np.pi * 4600 * T(0.025)) * np.sin(np.pi * T(0.025) / 0.025)
        st = int(k * 0.034 * SR)
        y[st:st + len(s)] += s
    return norm(y, 0.25), 0.0


def sfx_tap(p):
    d = 0.4
    x = sweep(d, 85, 40, 0.5) * expd(d, 0.09) + lp(noise(d, 210 + int(p)), 600) * expd(d, 0.03) * 0.6
    return norm(att(x, 0.001), 0.8), 0.0


def sfx_popup(p):
    pop = bp(noise(0.03, 220 + int(p)), 800, 4000) * expd(0.03, 0.004)
    slide = sweep(0.14, 500 + 100 * p, 1400 + 200 * p, 1.2) * np.sin(np.pi * T(0.14) / 0.14) * 0.4
    return norm(mix(pop, np.concatenate([np.zeros(int(0.01 * SR)), slide])), 0.5), 0.0


def sfx_riser(p):
    d = 0.55
    x = whoosh(d, 200, 2500, 3500, 230, 0.9) + sweep(d, 220, 880, 1) * (T(d) / d) * 0.25
    return norm(fade_out(x, 0.02), 0.45), 0.0


def sfx_burst(p):
    d = 0.7
    x = lp(noise(d, 240), 900) * expd(d, 0.1) + sweep(d, 90, 45) * expd(d, 0.15) + bp(noise(d, 241), 2000, 7000) * expd(d, 0.04) * 0.4
    r = np.random.default_rng(242)
    for k in range(10):
        st = int((0.08 + 0.4 * r.random()) * SR)
        s = bp(noise(0.02, 243 + k), 1500, 6000) * expd(0.02, 0.003) * 0.3
        x[st:st + len(s)] += s
    return norm(att(x, 0.001), 0.8), 0.0


def sfx_clone(p):
    f = 380 * 2 ** (p / 7.0)
    x = sweep(0.09, f, f * 2.6, 0.6) * np.sin(np.pi * T(0.09) / 0.09) ** 0.6
    c = bp(noise(0.02, 250 + int(p)), 1500, 6000) * expd(0.02, 0.003)
    return norm(mix(x * 0.7, c * 0.5), 0.35), 0.0


def sfx_kaching(p):
    ka = bp(noise(0.06, 260 + int(p)), 1500, 6000) * expd(0.06, 0.01) + modal(0.06, [(900, 0.6, 0.015)])
    ching = modal(1.0, [(2093, 1, 0.35), (2794, 0.8, 0.3), (4186, 0.5, 0.2), (5588, 0.3, 0.12)])
    r = np.random.default_rng(261 + int(p))
    coins = np.zeros(int(0.6 * SR))
    for k in range(6):
        st = int((0.06 + 0.3 * r.random()) * SR)
        s = modal(0.12, [(4000 + 3000 * r.random(), 0.2, 0.03)])
        coins[st:st + len(s)] += s[:max(0, len(coins) - st)]
    y = np.zeros(int(1.1 * SR))
    y[:len(ka)] += ka
    st = int(0.07 * SR)
    y[st:st + len(ching)] += ching[:len(y) - st] * 0.8
    y[st:st + len(coins)] += coins
    return norm(y, 0.6), 0.0


def sfx_bubble(p):
    x = mix(sweep(0.03, 2400 + 200 * p, 3600, 1) * np.sin(np.pi * T(0.03) / 0.03), bp(noise(0.015, 270 + int(p)), 3000, 9000) * expd(0.015, 0.002) * 0.6)
    return norm(x, 0.35), 0.0


def sfx_flutter(p):
    d = 2.2
    t = T(d)
    x = bp(noise(d, 280), 1800, 5500) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 13 * t))) * np.sin(np.pi * t / d) ** 0.5
    return norm(x, 0.12), 0.0


def sfx_slap(p):
    d = 0.12
    x = lp(noise(d, 290 + int(p)), 3500) * expd(d, 0.015) + bp(noise(d, 291 + int(p)), 300, 900) * expd(d, 0.02) * 0.6
    return norm(att(x, 0.0004), 0.5), 0.0


def sfx_creak(p):
    d = 0.5
    t = T(d)
    f = 95 * (1 + 0.25 * (t / d)) * (1 + 0.04 * np.sin(2 * np.pi * 7 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = (2 * ((ph / (2 * np.pi)) % 1) - 1) * (0.5 + 0.5 * (np.sin(2 * np.pi * 23 * t) > 0.2)) * np.sin(np.pi * t / d)
    return norm(bp(x, 200, 3000), 0.28), 0.0


def sfx_gust(p):
    d = 1.0
    x = whoosh(d, 300, 1600, 500, 300, 0.35) + bp(noise(d, 301), 2000, 6000) * np.sin(np.pi * T(d) / d) * 0.15 * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 17 * T(d))))
    return norm(x, 0.6), 0.1


def sfx_blinks(p):
    y = np.zeros(int(0.45 * SR))
    for k in range(3):
        s = mix(modal(0.03, [(3200, 0.5, 0.004)]), bp(noise(0.015, 310 + k), 3000, 8000) * expd(0.015, 0.002) * 0.4)
        st = int(k * 0.14 * SR)
        y[st:st + len(s)] += s
    return norm(y, 0.25), 0.0


def sfx_rustle(p):
    d = 0.35
    x = bp(noise(d, 320), 2000, 7000) * (np.random.default_rng(321).random(int(d * SR)) > 0.85) * np.sin(np.pi * T(d) / d)
    return norm(x, 0.25), 0.0


def sfx_unroll(p):
    d = 0.5
    x = whoosh(d, 500, 3000, 1800, 330, 0.5) + bp(noise(d, 331), 1500, 5000) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 30 * T(d)))) * 0.2
    return norm(x, 0.45), 0.02


def sfx_babble(p):
    d = 1.6
    y = lp(noise(d, 340), 500) * 0.15
    r = np.random.default_rng(341)
    for k in range(45):
        st = int(r.random() * (d - 0.06) * SR)
        f = 500 + 900 * r.random()
        s = sweep(0.04, f, f * 1.9, 1) * np.sin(np.pi * T(0.04) / 0.04) * (0.3 + 0.4 * r.random())
        y[st:st + len(s)] += s
    y *= np.minimum(1, np.minimum(T(d) / 0.15, (d - T(d)) / 0.3))
    return norm(y, 0.25), 0.0


def sfx_dizzy(p):
    d = 0.8
    t = T(d)
    f = 900 + 350 * np.sin(2 * np.pi * 5.5 * t)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d)
    tw = np.zeros_like(x)
    for k in range(3):
        st = int((0.15 + 0.22 * k) * SR)
        s = sweep(0.06, 3000, 4200, 1) * np.sin(np.pi * T(0.06) / 0.06)
        tw[st:st + len(s)] += s * 0.4
    return norm(x * 0.5 + tw, 0.3), 0.0


def sfx_rewind(p):
    d = 0.32
    t = T(d)
    f = 3000 * (1 - 0.7 * t / d)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 45 * t))) * 0.3 + whoosh(d, 3000, 800, 400, 350, 0.3)
    return norm(x, 0.4), 0.0


def sfx_boing(p):
    d = 0.32
    f = 260 + 60 * p
    x = sweep(d, f, f * 1.3, 1, 0.12, 12) * expd(d, 0.12)
    return norm(att(x, 0.002), 0.3), 0.0


def sfx_chime(p):
    y = np.zeros(int(1.8 * SR))
    for k, f in enumerate([1046.5, 1318.5, 1568.0, 2093.0]):
        s = modal(1.4, [(f, 1, 0.5), (f * 2.76, 0.2, 0.15)])
        st = int(k * 0.08 * SR)
        y[st:st + len(s)] += s
    return norm(y, 0.3), 0.0


def sfx_tipcard(p):
    d = 0.18
    x = lp(noise(d, 360), 900) * expd(d, 0.03) + bp(noise(d, 361), 1500, 4000) * expd(d, 0.01) * 0.3
    return norm(att(x, 0.002), 0.35), 0.0


SFX = {k[4:]: v for k, v in globals().items() if k.startswith('sfx_')}
SWELL = {'fallwhistle', 'inflate', 'inflate2', 'whoosh', 'whooshDown', 'whooshUp', 'riser', 'flutter', 'babble', 'dizzy', 'wind',
         'meter', 'creak', 'gust', 'rustle', 'unroll', 'swish', 'zip', 'unfurl', 'squeak', 'pfft', 'choir', 'puff'}
PAN = {'thud': 0.25, 'stake': 0.3, 'click': 0.2, 'squeak': -0.1, 'pfft': -0.3, 'bonk': -0.15, 'crown': 0.0, 'tap': -0.45,
       'cricket': -0.35, 'kaching': 0.3, 'popup': 0.0, 'slap': 0.0, 'gust': -0.3, 'chime': 0.0}


def place_sfx():
    bus = np.zeros((NS, 2))
    report = []
    for i, c in enumerate(CUE['cues']):
        fn = SFX.get(c['name'])
        if fn is None:
            continue
        x, pre = fn(c.get('p', 0))
        x = np.asarray(x, dtype=np.float64)
        pan = PAN.get(c['name'], 0.0) + (0.12 * np.sin(i * 1.7) if c['name'] in ('clone', 'slap', 'bubble', 'bonk', 'thwip') else 0.0)
        gl, gr = np.cos((pan + 1) * np.pi / 4) * 1.414, np.sin((pan + 1) * np.pi / 4) * 1.414
        st = int(round((c['t'] - pre) * SR))
        a, b = max(0, st), min(NS, st + len(x))
        if b <= a:
            continue
        seg = x[a - st:b - st] * c['g']
        bus[a:b, 0] += seg * gl
        bus[a:b, 1] += seg * gr
        # sync check. Impacts: the transient (first sample above 20% of the peak after the sync point) must land on the
        # cue frame. Swells (whooshes, risers, wind): the sound must start where it was placed (first sample above 1%).
        env = np.abs(x)
        if c['name'] in SWELL:
            k = int(np.argmax(env > 0.01 * env.max()))
            onset = (st + k) / SR
            report.append((c['t'], c['name'], onset, (onset - (c['t'] - pre)) * 30.0, 'start'))
        else:
            k0 = max(0, int((pre - 0.02) * SR))
            seg = env[k0:]
            k = k0 + int(np.argmax(seg > 0.2 * seg.max()))
            onset = (st + k) / SR
            report.append((c['t'], c['name'], onset, (onset - c['t']) * 30.0, 'hit'))
    return bus, report


# =============================================================================================== loudness, limiting
def k_weight(x):
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)


def lufs(x):
    y = k_weight(x)
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    p = np.sum(y ** 2, 1)
    c = np.concatenate([[0], np.cumsum(p)])
    st = np.arange(0, len(p) - blk, hop)
    z = (c[st + blk] - c[st]) / blk
    l = -0.691 + 10 * np.log10(z + 1e-20)
    z1 = z[l > -70]
    rel = -0.691 + 10 * np.log10(np.mean(z1)) - 10
    z2 = z[(l > -70) & (l > rel)]
    return -0.691 + 10 * np.log10(np.mean(z2))


def short_term(x, t0, t1):
    y = k_weight(x[int(t0 * SR):int(t1 * SR)])
    return -0.691 + 10 * np.log10(np.mean(np.sum(y ** 2, 1)) + 1e-20)


def true_peak(x):
    up = signal.resample_poly(x, 4, 1, axis=0)
    return np.max(np.abs(up))


def limiter(x, ceil_db=-1.5, look=0.004, rel=0.06):
    ceil = 10 ** (ceil_db / 20)
    up = signal.resample_poly(x, 4, 1, axis=0)
    pk = np.abs(up).max(1).reshape(-1, 4).max(1)[:len(x)]
    pk = np.pad(pk, (0, len(x) - len(pk)), constant_values=0)
    req = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    la = int(look * SR)
    # look-ahead minimum, then a release that recovers smoothly
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    g = minimum_filter1d(req, size=2 * la + 1, origin=0)
    cr = np.exp(-1 / (rel * SR))
    out = np.empty_like(g)
    s = 1.0
    for i in range(len(g)):            # one-pole release, instant attack (attack handled by the look-ahead min)
        s = g[i] if g[i] < s else cr * s + (1 - cr) * g[i]
        out[i] = s
    out = uniform_filter1d(out, size=la)
    out = np.minimum(out, minimum_filter1d(req, size=la + 1))
    return x * out[:, None]


def master(bus, target=-14.0):
    bus = bus - bus.mean(0)
    sos = signal.butter(2, 25 / (SR / 2), 'high', output='sos')
    bus = signal.sosfilt(sos, bus, axis=0)
    g = 10 ** ((target - lufs(bus)) / 20)
    y = bus
    for it in range(6):
        y = limiter(bus * g)
        tp = true_peak(y)
        if tp > 10 ** (-1.2 / 20):
            y = limiter(y, -1.8)
        L = lufs(y)
        print(f'  master pass {it}: gain {20 * np.log10(g):+.2f} dB -> {L:.2f} LUFS, TP {20 * np.log10(true_peak(y)):.2f} dBTP')
        if abs(L - target) < 0.05:
            break
        g *= 10 ** ((target - L) / 20)
    return y, g


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..', 'field-guide-video', 'score.wav')
    rep_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'audio-report.txt')
    import soundfile as sf
    print('rendering music (fluidsynth + FluidR3_GM)...')
    music = render_music()
    music *= gate_env()[:, None]
    print('placing', len(CUE['cues']), 'sound cues...')
    sfx, rep = place_sfx()
    # balance: the bed sits under the comedy
    Lm, Ls = lufs(music), lufs(sfx)
    print(f'  music {Lm:.1f} LUFS, sfx {Ls:.1f} LUFS (unbalanced)')
    music *= 10 ** ((-20.5 - Lm) / 20)
    sfx *= 10 ** ((-18.0 - Ls) / 20)
    bus = music + sfx
    y, g = master(bus)
    sf.write(out, y.astype(np.float32), SR, subtype='PCM_24')
    L, tp = lufs(y), 20 * np.log10(true_peak(y))
    lines = ['Soundtrack: ' + os.path.abspath(out), f'Sample rate {SR} Hz, stereo, {len(y) / SR:.3f} s',
             f'Integrated loudness (BS.1770-4, K-weighted, gated): {L:.2f} LUFS', f'True peak (4x oversampled): {tp:.2f} dBTP',
             f'Music bed {Lm:.1f} LUFS raw; effects {Ls:.1f} LUFS raw; balanced to -20.5 / -18.0 before mastering',
             'Music gates (comedy interruptions): ' + ', '.join(f'{a:.2f}-{b:.2f}s' for a, b, _ in GATES),
             '', 'Cue alignment (each effect\'s transient vs its cue frame; pre-rolled whooshes peak at the cue):',
             '  cue_t   frame  name          onset_t   offset(frames)  (hit = transient on the cue; start = swell begins on its placement)']
    worst = 0.0
    for t, name, onset, fo, kind in rep:
        worst = max(worst, abs(fo))
        lines.append(f'  {t:6.3f}  {int(round(t * 30)):5d}  {name:12s}  {onset:7.3f}   {fo:+.2f}  ({kind})')
    lines.append(f'Worst offset: {worst:.2f} frames (limit 1.0) -> {"PASS" if worst <= 1.0 else "FAIL"}')
    lines.append('')
    lines.append('Loudness by beat (K-weighted, LUFS):')
    for bt in CUE['beats']:
        lines.append(f'  beat {bt["n"]:2d} {bt["name"]:8s} {bt["t0"]:5.1f}-{bt["t1"]:5.1f}s  {short_term(y, bt["t0"], bt["t1"]):6.1f}')
    open(rep_path, 'w').write('\n'.join(lines) + '\n')
    print('\n'.join(lines[:6]))
    print(lines[-12])


if __name__ == '__main__':
    main()
