"""Synthesise the soundtrack for the v3 story: a music-box waltz (D major, 3/4, 96 BPM) restructured over the
film's arc (sparse opening, building montage, full resolving ending), paper foley driven by the same bloom
schedule as the picture, whooshes driven by the camera's own speed, and ambience keyed to the stops.
    python audio.py out/paper_planet_audio.wav"""
import sys, math, wave
import numpy as np

import sys as _sys
_sys.path.insert(0, '.')
from pp import core as _core

SR = 48000
FILM = _core.DUR           # 72.5 s
PADT = 5.0                 # silent tail so circular reverbs never wrap the ending onto the opening
DUR = FILM + PADT
N = int(SR * DUR)
NFILM = int(round(SR * FILM))
BPM = _core.BPM
BEAT = _core.BEAT          # 0.625 s
BAR = _core.BAR            # 1.875 s
rng = np.random.default_rng(2026)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def add(buf, t0, sig, gain=1.0, pan=0.0):
    """Add mono sig at time t0 (s) into the stereo buffer with constant-power pan (-1..1)."""
    i0 = int(round(t0 * SR))
    idx = i0 + np.arange(len(sig))
    keep = (idx >= 0) & (idx < N)
    idx, sig = idx[keep], np.asarray(sig)[keep]
    pan = max(-1.0, min(1.0, pan))
    a = (pan + 1) * math.pi / 4
    np.add.at(buf[:, 0], idx, sig * (gain * math.cos(a)))
    np.add.at(buf[:, 1], idx, sig * (gain * math.sin(a)))


def fft_filter(x, shape):
    """Circular (loop-safe) filtering: shape(freqs)->gain."""
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(x.shape[0], 1.0 / SR)
    g = shape(f)
    if X.ndim == 2:
        g = g[:, None]
    return np.fft.irfft(X * g, n=x.shape[0], axis=0)


def band(lo, hi, order=2):
    def sh(f):
        f = np.maximum(f, 1e-3)
        return 1.0 / np.sqrt(1 + (lo / f) ** (2 * order)) / np.sqrt(1 + (f / hi) ** (2 * order))
    return sh


def circ_noise(n=N):
    return rng.standard_normal(n)


def lfo(cycles, phase=0.0):
    t = np.arange(N) / SR
    return np.sin(2 * math.pi * (cycles * t / DUR + phase))


def bump(tc, width):
    """Smooth bump (0..1) centred on tc seconds."""
    t = np.arange(N) / SR
    return np.exp(-((t - tc) / width) ** 2)


def ramp(t0, t1):
    """0 before t0, 1 after t1, smooth in between."""
    t = np.arange(N) / SR
    u = np.clip((t - t0) / max(1e-3, t1 - t0), 0, 1)
    return u * u * (3 - 2 * u)


# ----------------------------------------------------------------------------- instruments
def musicbox(freq, dur=2.6, vel=1.0):
    n = int(SR * dur)
    t = np.arange(n) / SR
    parts = [(1.0, 1.0, 1.25), (2.0, 0.42, 0.75), (3.01, 0.20, 0.45), (4.12, 0.12, 0.28), (5.43, 0.07, 0.18), (6.8, 0.035, 0.12)]
    s = np.zeros(n)
    for mult, amp, tau in parts:
        if freq * mult > 16000:
            continue
        s += amp * np.exp(-t / (tau * (0.6 + 0.4 * 440.0 / max(freq, 200)))) * np.sin(2 * math.pi * freq * mult * t)
    att = np.minimum(1.0, t / 0.0025)
    click = rng.standard_normal(n) * np.exp(-t / 0.004) * 0.10
    return (s * att + click) * vel * np.minimum(1.0, (dur - t) / 0.05)


def celesta(freq, dur=2.2, vel=1.0):
    n = int(SR * dur)
    t = np.arange(n) / SR
    s = np.exp(-t / 0.9) * np.sin(2 * math.pi * freq * t) + 0.30 * np.exp(-t / 0.5) * np.sin(2 * math.pi * 2 * freq * t) \
        + 0.10 * np.exp(-t / 0.2) * np.sin(2 * math.pi * 4.02 * freq * t)
    return s * np.minimum(1.0, t / 0.006) * vel * np.minimum(1.0, (dur - t) / 0.05)


def pad_note(freq, dur, detune=0.0):
    n = int(SR * (dur + 1.6))
    t = np.arange(n) / SR
    f = freq * 2 ** (detune / 1200.0)
    s = np.zeros(n)
    for h, a in ((1, 1.0), (2, 0.38), (3, 0.20), (4, 0.09), (5, 0.05)):
        s += a * np.sin(2 * math.pi * f * h * t + h * 0.7)
    env = np.minimum(1.0, t / 0.75) * np.clip((dur + 1.5 - t) / 1.5, 0, 1)
    env = env * env * (3 - 2 * env)
    return s * env


def bass_note(freq, dur=1.8):
    n = int(SR * dur)
    t = np.arange(n) / SR
    s = np.sin(2 * math.pi * freq * t) + 0.35 * np.sin(2 * math.pi * 2 * freq * t) * np.exp(-t / 0.5)
    return s * np.minimum(1.0, t / 0.05) ** 2 * np.exp(-t / 0.9) * np.minimum(1.0, (dur - t) / 0.1)


CH = {
    'D': ([50, 57, 62, 66], 38, [66, 69]), 'Bm': ([47, 54, 59, 62], 35, [62, 66]), 'G': ([43, 50, 55, 59], 43, [62, 67]),
    'A': ([45, 52, 57, 61], 45, [64, 69]), 'A7': ([45, 55, 61, 64], 45, [64, 67]), 'F#m': ([42, 49, 54, 57], 42, [61, 66]),
    'Em': ([40, 47, 52, 55], 40, [64, 67]),
}
# v2's 32-bar waltz, the material the new arc is cut from
MEL = [
    [(0, 78, 2), (2, 81, 1)], [(0, 83, 2), (2, 81, 1)], [(0, 79, 1), (1, 83, 1), (2, 86, 1)], [(0, 85, 2), (2, 81, 1)],
    [(0, 86, 2), (2, 81, 1)], [(0, 78, 1), (1, 81, 1), (2, 85, 1)], [(0, 83, 2), (2, 79, 1)], [(0, 81, 1.5), (1.5, 79, 0.5), (2, 76, 1)],
    [(0, 78, 2), (2, 81, 1)], [(0, 83, 2), (2, 86, 1)], [(0, 88, 1), (1, 86, 1), (2, 83, 1)], [(0, 81, 2), (2, 85, 1)],
    [(0, 83, 1), (1, 79, 1), (2, 76, 1)], [(0, 79, 1), (1, 76, 1), (2, 73, 1)], [(0, 74, 3)], [(1, 78, 1), (2, 81, 1)],
    [(0, 83, 2), (2, 86, 1)], [(0, 88, 2), (2, 85, 1)], [(0, 81, 1), (1, 85, 1), (2, 90, 1)], [(0, 86, 3)],
    [(0, 83, 1), (1, 79, 1), (2, 83, 1)], [(0, 79, 2), (2, 76, 1)], [(0, 81, 1), (1, 85, 1), (2, 88, 1)], [(0, 79, 2), (2, 76, 1)],
    [(0, 78, 2), (2, 81, 1)], [(0, 83, 2), (2, 81, 1)], [(0, 79, 1), (1, 83, 1), (2, 86, 1)], [(0, 85, 2), (2, 88, 1)],
    [(0, 86, 1), (1, 83, 1), (2, 79, 1)], [(0, 81, 1), (1, 79, 1), (2, 76, 1)], [(0, 74, 2), (2, 78, 1)], [(0, 69, 1), (1, 73, 1), (2, 76, 1)],
]
# The v3 arc, bar by bar: (chord, melody, dynamic, flags). Flags: p pad, b bass, c celesta arps, o octave shimmer,
# e running eighths, r chord roll. Picture landmarks: plain globe 0-1, push-in 2-3, Europe 4, Arctic 7,
# S America 10, N America 13, whale 16 (leap tops out on bar 18), Pacific 21, Antarctica 24, Oceania 27,
# East Asia 29, South Asia 31, pull-back 32-33, final wide on the tonic at 34, hold and resolve to the end.
SCORE = [
    ('D', MEL[0], 0.55, ''),                               # 0  the plain globe: a music box, alone
    ('Bm', MEL[1], 0.58, ''),                              # 1
    ('G', MEL[2], 0.52, 'p'),                              # 2  the first push-in: the pad breathes in
    ('A', MEL[3], 0.60, 'pc'),                             # 3
    ('D', MEL[0], 0.74, 'pbc'),                            # 4  Europe
    ('Bm', MEL[1], 0.76, 'pbc'),
    ('G', MEL[2], 0.78, 'pbc'),
    ('A', MEL[3], 0.80, 'pbc'),                            # 7  Arctic
    ('D', MEL[4], 0.82, 'pbc'),
    ('F#m', MEL[5], 0.82, 'pbc'),
    ('G', MEL[6], 0.84, 'pbc'),                            # 10 South America
    ('A7', MEL[7], 0.84, 'pbc'),
    ('D', MEL[8], 0.86, 'pbc'),
    ('Bm', MEL[9], 0.88, 'pbc'),                           # 13 North America
    ('G', MEL[10], 0.90, 'pbc'),
    ('A', MEL[11], 0.90, 'pbc'),
    ('Em', MEL[12], 0.80, 'pbc'),                          # 16 the whale: a breath
    ('A7', MEL[13], 0.84, 'pbc'),
    ('D', [(0, 86, 3)], 1.00, 'pbco'),                     # 18 the leap tops out
    ('D', MEL[15], 0.86, 'pbc'),                           # 19 splash-down
    ('A', [(0, 85, 1), (1, 81, 1), (2, 79, 1)], 0.88, 'pbc'),
    ('G', MEL[16], 0.94, 'pbco'),                          # 21 Pacific
    ('A', MEL[17], 0.96, 'pbco'),
    ('F#m', MEL[18], 0.98, 'pbco'),
    ('Bm', MEL[19], 0.98, 'pbco'),                         # 24 Antarctica
    ('G', MEL[20], 1.00, 'pbcoe'),
    ('Em', MEL[21], 1.00, 'pbcoe'),
    ('A', MEL[22], 1.02, 'pbcoe'),                         # 27 Oceania
    ('A7', MEL[23], 1.02, 'pbcoe'),
    ('D', MEL[24], 1.04, 'pbcoe'),                         # 29 East Asia
    ('Bm', MEL[25], 1.06, 'pbcoe'),
    ('G', MEL[26], 1.08, 'pbcoe'),                         # 31 South Asia
    ('Em', MEL[28], 1.10, 'pbcoe'),                        # 32 the pull-back
    ('A7', [(0, 81, 1), (1, 85, 1), (2, 88, 1)], 1.14, 'pbcoe'),
    ('D', [(0, 86, 3)], 1.22, 'pbcor'),                    # 34 the final wide shot, on the tonic
    ('G', [(0, 83, 2), (2, 79, 1)], 0.98, 'pbc'),          # 35 plagal, settling
    ('D', [(0, 81, 1.5), (1.5, 78, 1.5)], 0.84, 'pbc'),    # 36
    ('D', [(0, 74, 3)], 0.72, 'pbr'),                      # 37 home
]
NBARS = len(SCORE)


def music():
    dry = np.zeros((N, 2))
    pad = np.zeros((N, 2))
    for b, (name, mel, dyn, fl) in enumerate(SCORE):
        t0 = b * BAR
        notes, bass, arp = CH[name]
        if 'p' in fl:
            pg = 0.024 * (0.55 if b == 2 else 0.8 if b == 3 else 1.0) * (1.25 if b >= 32 else 1.0)
            last = b == NBARS - 1
            for k, m in enumerate(notes):
                for det, pan in ((-5, -0.6), (5, 0.6)):
                    add(pad, t0 - 0.25, pad_note(mtof(m), BAR * (2.2 if last else 1.0), det), gain=pg * (0.7 if k == 0 else 1.0), pan=pan)
        if 'b' in fl:
            add(dry, t0, bass_note(mtof(bass + 12), dur=3.5 if b >= 34 else 1.8), gain=0.085 * min(1.1, dyn), pan=0.0)
            if b >= 34:
                add(dry, t0, bass_note(mtof(bass), dur=3.5), gain=0.05, pan=0.0)
        if 'c' in fl:
            v = 0.075 * min(1.1, dyn) * (0.6 if b == 3 else 1.0)
            add(dry, t0 + BEAT + 0.006, celesta(mtof(arp[0])), gain=v, pan=-0.35)
            add(dry, t0 + 2 * BEAT + 0.004, celesta(mtof(arp[1])), gain=v * 0.9, pan=0.35)
        if 'e' in fl:
            # running eighths on the off-beats: momentum for the quick stops
            tones = [notes[1] + 24, notes[2] + 24, notes[3] + 12, notes[2] + 24]
            for q, off in enumerate((0.5, 1.5, 2.5)):
                add(dry, t0 + off * BEAT, celesta(mtof(tones[(b + q) % 4]), dur=1.2), gain=0.030 * dyn, pan=0.5 * math.sin(b + q * 2.0))
        if 'r' in fl:
            # a rolled chord across the music box's range
            roll = [n + 12 for n in notes] + [n + 24 for n in notes[1:]]
            for q, m in enumerate(sorted(roll)):
                add(dry, t0 - 0.02 + 0.045 * q, musicbox(mtof(m), dur=4.0), gain=0.10 * dyn, pan=-0.6 + 1.2 * q / len(roll))
        for i, (beat, m, d) in enumerate(mel):
            vel = (0.27 if beat == 0 else 0.22) * dyn * (1.0 + 0.06 * math.sin(b * 1.7 + i))
            dur = 2.6 if b < NBARS - 2 else 5.0
            add(dry, t0 + beat * BEAT + 0.004 * math.sin(b * 2.3 + i * 1.1), musicbox(mtof(m), dur=dur, vel=1.0), gain=vel,
                pan=0.18 * math.sin(b * 0.9 + i * 2.1))
            if 'o' in fl and beat == 0:      # octave shimmer
                add(dry, t0 + beat * BEAT + 0.012, musicbox(mtof(m + 12), dur=1.6), gain=vel * 0.25, pan=-0.3)
    # a last high tinkle as the tonic rings out
    add(dry, (NBARS - 1) * BAR + 2 * BEAT, musicbox(mtof(98), dur=3.0), gain=0.06, pan=0.3)
    pad = fft_filter(pad, band(150, 1800, 2))
    trem = 1.0 + 0.10 * np.sin(2 * math.pi * np.arange(N) / SR / 6.67)
    pad *= trem[:, None]
    return dry, pad


# ----------------------------------------------------------------------------- foley
def rustle(dur, bright=1.0):
    n = int(SR * dur)
    x = rng.standard_normal(n)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1.0 / SR)
    X *= band(1400 * bright, 7500 * bright, 2)(f)
    x = np.fft.irfft(X, n=n)
    t = np.arange(n) / SR
    # crinkle: a handful of random short swells
    env = np.zeros(n)
    k = max(3, int(dur * 9))
    for _ in range(k):
        c = rng.uniform(0.05, 0.85) * dur
        w = rng.uniform(0.02, 0.09)
        env += rng.uniform(0.4, 1.0) * np.exp(-((t - c) / w) ** 2)
    env *= np.sin(math.pi * np.clip(t / dur, 0, 1)) ** 0.7
    return x * env / (np.abs(x * env).max() + 1e-9)


def snap(size):
    n = int(SR * 0.09)
    t = np.arange(n) / SR
    f0 = 1500.0 - 700.0 * min(1.0, size / 0.4)
    tick = rng.standard_normal(n) * np.exp(-t / 0.0035)
    tock = np.sin(2 * math.pi * f0 * t) * np.exp(-t / 0.012) * 0.7 + np.sin(2 * math.pi * f0 * 0.42 * t) * np.exp(-t / 0.022) * 0.5
    s = tick * 0.8 + tock
    return s / np.abs(s).max()


def _screen(t, lat, lon):
    """(screen x 0..1, visible?) of a globe point at film time t."""
    from pp.core import Camera, globe_matrix, ll_frame, W, H
    cam = Camera(t, 1)
    P = globe_matrix(t) @ ll_frame(lat, lon)[0]
    s, z = cam.project(P[None, :])
    x, y = s[0]
    vis = float(P @ cam.chat) > 1.0 / cam.dc - 0.08 and -0.1 * W < x < 1.1 * W and -0.2 * H < y < 1.1 * H
    return x / W, vis


def foley():
    """Every bloom in the picture gets a rustle as it lifts and a snap as it locks, panned to where it is on
    screen and quieter when it opens out of shot (the final wave's far side)."""
    from pp import scene
    sc = scene.Scene()
    buf = np.zeros((N, 2))
    count = 0
    for p in sc.pieces:
        if getattr(p, 'quiet', False):
            continue
        t_open, t_lock, size, lat, lon = p.events()
        if t_open > FILM:
            continue
        x, vis = _screen(t_lock, lat, lon)
        pan = (x - 0.5) * 1.4
        g = min(1.0, (size / 0.3)) ** 0.6 * (1.0 if vis else 0.25)
        if p.stop is None:
            g *= 0.7
        d_in = p.din()
        add(buf, t_open, rustle(d_in * 0.8 + 0.3), gain=0.12 * g, pan=pan)
        add(buf, t_lock, snap(size), gain=0.14 * g, pan=pan)
        count += 1
    # the finale's crown: everything already open turns and settles with one broad paper sigh
    tc = [p.t_crown for p in sc.pieces if p.t_crown < FILM]
    if tc:
        t0 = min(tc)
        add(buf, t0, rustle(2.6, 0.8), gain=0.05, pan=-0.3)
        add(buf, t0 + 0.4, rustle(2.4, 0.9), gain=0.05, pan=0.3)
    return buf, count


def camera_speed():
    """Per-frame on-screen speed of the globe around frame centre (1080p px/frame), and the horizontal
    direction of that motion, from the same camera the picture uses."""
    from pp.core import Camera, globe_matrix, NF, FPS, W, H
    r = np.random.default_rng(1)
    la = np.radians(r.uniform(-89, 89, 1500)); lo = r.uniform(-np.pi, np.pi, 1500)
    Pl = np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], 1)
    sp = np.zeros(NF); dx = np.zeros(NF)
    prev = None
    for fi in range(NF + 1):
        t = fi / FPS
        cam = Camera(t, 1)
        P = Pl @ globe_matrix(t).T
        s, _ = cam.project(P)
        vis = P @ cam.chat > 1 / cam.dc + 0.05
        if prev is not None:
            s0, v0 = prev
            m = v0 & vis & (np.abs(s0[:, 0] - W / 2) < 600) & (np.abs(s0[:, 1] - H / 2) < 400)
            if m.sum() > 5:
                d = s - s0
                sp[fi - 1] = np.median(np.linalg.norm(d[m], axis=1))
                dx[fi - 1] = np.median(d[m, 0])
        prev = (s, vis)
    return sp, dx


def whooshes():
    """Air for the swoops: band-passed noise whose level and brightness follow the camera's speed."""
    from scipy.signal import stft, istft
    from pp.core import FPS
    sp, dx = camera_speed()
    tf = (np.arange(len(sp)) + 0.5) / FPS
    nper, hop = 2048, 512
    out = np.zeros((N, 2))
    for c in range(2):
        x = rng.standard_normal(N)
        f, tt, Z = stft(x, SR, nperseg=nper, noverlap=nper - hop)
        v = np.interp(tt, tf, sp, left=0, right=0)
        h = np.interp(tt, tf, dx, left=0, right=0)
        e = np.clip((v - 3.0) / 22.0, 0, 1.4) ** 1.6
        fc = 260.0 + 900.0 * np.clip(v / 28.0, 0, 1.3)
        shape = np.exp(-0.5 * (np.log(np.maximum(f, 20.0)[:, None] / fc[None, :]) / 0.75) ** 2)
        pan = np.clip(h / 25.0, -0.8, 0.8)
        side = (1 - pan) if c == 0 else (1 + pan)
        Z *= shape * (e * side * 0.5)[None, :]
        _, y = istft(Z, SR, nperseg=nper, noverlap=nper - hop)
        out[:, c] = y[:N] if len(y) >= N else np.pad(y, (0, N - len(y)))
    out *= 0.045 / (np.abs(out).max() + 1e-9) * 6.0
    return out, sp


def breach_fx():
    """The blue whale: a breathy blow, the rush of leaving the water, a low call in the air, a big paper
    splash-down and a patter of falling drops. Times come from the same function the picture uses."""
    from pp.travellers import breach_times
    t_blow, t_up, t_down = breach_times()
    buf = np.zeros((N, 2))

    def noise(dur, lo, hi):
        n = int(SR * dur)
        x = rng.standard_normal(n)
        X = np.fft.rfft(x)
        X *= band(lo, hi, 2)(np.fft.rfftfreq(n, 1.0 / SR))
        x = np.fft.irfft(X, n=n)
        return x / (np.abs(x).max() + 1e-9)

    # blow
    n = int(SR * 1.6); t = np.arange(n) / SR
    add(buf, t_blow + 0.2, noise(1.6, 300, 2400) * np.minimum(1, t / 0.12) * np.exp(-t / 0.55), gain=0.05, pan=-0.05)
    # leaving the water: a rising rush with a paper crinkle on top
    n = int(SR * 1.2); t = np.arange(n) / SR
    rush = noise(1.2, 250, 4000) * np.minimum(1, t / 0.05) * np.exp(-t / 0.35)
    add(buf, t_up - 0.05, rush, gain=0.10, pan=-0.15)
    add(buf, t_up, rustle(0.9, 0.9), gain=0.07, pan=-0.2)
    # the call while it hangs in the air
    d = 2.4; n = int(SR * d); t = np.arange(n) / SR
    f = 130 + 70 * np.sin(np.pi * t / d) + 4 * np.sin(2 * np.pi * 4.5 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    call = (np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)) * np.sin(np.pi * t / d) ** 1.4
    add(buf, t_up + 0.5, call, gain=0.035, pan=0.0)
    # splash-down: a thump, a broad wash and a big paper crumple
    n = int(SR * 2.2); t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * (62 + 30 * np.exp(-t / 0.08)) * t) * np.exp(-t / 0.22) * np.minimum(1, t / 0.004)
    wash = noise(2.2, 200, 5000) * np.minimum(1, t / 0.01) * (0.65 * np.exp(-t / 0.18) + 0.35 * np.exp(-t / 0.9))
    add(buf, t_down, thump, gain=0.16, pan=0.15)
    add(buf, t_down, wash, gain=0.13, pan=0.2)
    add(buf, t_down + 0.05, rustle(1.4, 1.0), gain=0.10, pan=0.25)
    # drops
    for k in range(14):
        tt = t_down + 0.35 + rng.uniform(0, 1.4)
        add(buf, tt, snap(0.04) * 0.6, gain=0.03 * rng.uniform(0.4, 1.0), pan=rng.uniform(-0.2, 0.6))
    return buf


# ----------------------------------------------------------------------------- ambience
def hero(region):
    """Time the camera lands on a stop (the bloom and the ambience are keyed to it)."""
    from pp.core import HERO_T
    return HERO_T[region]


def chirp(f0, f1, dur, wob=0.0):
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = f0 + (f1 - f0) * (t / dur) + wob * np.sin(2 * math.pi * 28 * t)
    ph = 2 * math.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.sin(math.pi * t / dur) ** 2


def ambience():
    from pp.core import STOP, WIDE_IN
    def mid(name):
        s = STOP[name]
        return 0.5 * (s[1] + s[2])
    buf = np.zeros((N, 2))
    t = np.arange(N) / SR
    # sea: soft under the plain opening, swells for the whale and the Pacific, wide and calm at the end
    sea = np.stack([circ_noise(), circ_noise()], 1)
    sea = fft_filter(sea, band(180, 900, 2))
    swell = 0.55 + 0.45 * (0.5 + 0.5 * np.sin(2 * math.pi * t / 8.6 + 0.2)) * (0.5 + 0.5 * np.sin(2 * math.pi * t / 5.5 + 0.6))
    g_sea = 0.30 + 0.9 * (bump(mid('whale'), 4.5) + 0.8 * bump(mid('pacific'), 2.5) + 0.5 * bump(mid('arctic'), 2.5)) + 0.25 * ramp(WIDE_IN - 3, WIDE_IN)
    buf += sea * (swell * g_sea)[:, None] * 0.030
    hiss = np.stack([circ_noise(), circ_noise()], 1)
    hiss = fft_filter(hiss, band(1800, 6000, 1))
    foam = np.clip(np.sin(2 * math.pi * t / 4.6 + 0.3), 0, 1) ** 2
    buf += hiss * (foam * g_sea)[:, None] * 0.006
    # wind for the poles and the high mountains
    wind = np.stack([circ_noise(), circ_noise()], 1)
    wind = fft_filter(wind, band(260, 1100, 2))
    g_wind = bump(mid('arctic'), 2.5) + 0.6 * bump(mid('namerica'), 2.0) + 0.7 * bump(mid('southasia'), 1.5) + bump(mid('antarctica'), 2.5)
    gust = 0.55 + 0.45 * np.sin(2 * math.pi * t / 7.5 + 0.4) * np.sin(2 * math.pi * t / 20.0 + 0.1)
    buf += wind * (g_wind * gust)[:, None] * 0.030
    # aurora shimmer: a faint glassy cluster
    for tc, pan in ((mid('arctic'), 0.2), (mid('namerica'), -0.25), (mid('antarctica'), 0.1)):
        env = bump(tc, 2.4)
        for k, m in enumerate((93, 98, 102, 105)):
            s = np.sin(2 * math.pi * mtof(m) * t) * (0.5 + 0.5 * np.sin(2 * math.pi * t / (2.2 + 0.7 * k) + 0.8 * k))
            buf[:, 0] += s * env * 0.0030 * (1 - pan)
            buf[:, 1] += s * env * 0.0030 * (1 + pan)
    # birdsong where the land comes alive (and stays alive: a sprinkle over the finale)
    def birds(tc, width, n, f_lo, f_hi, gain, kind=0):
        for i in range(n):
            tt = tc + abs(rng.normal(0, width))
            f0 = rng.uniform(f_lo, f_hi)
            reps = rng.integers(2, 5)
            for r in range(reps):
                if kind == 0:
                    c = chirp(f0, f0 * rng.uniform(1.15, 1.5), rng.uniform(0.05, 0.11))
                elif kind == 1:
                    c = chirp(f0 * 1.3, f0 * 0.8, rng.uniform(0.08, 0.16), wob=120)
                else:
                    c = chirp(f0, f0 * 1.05, rng.uniform(0.12, 0.2), wob=220)
                add(buf, tt + r * rng.uniform(0.11, 0.2), c, gain=gain * rng.uniform(0.5, 1.0), pan=rng.uniform(-0.7, 0.7))
    birds(hero('europe'), 1.8, 14, 2600, 4200, 0.010, 0)
    birds(hero('samerica'), 1.8, 18, 2400, 4800, 0.011, 1)
    birds(hero('namerica'), 1.6, 9, 2800, 4000, 0.008, 0)
    birds(hero('oceania'), 1.0, 8, 2000, 3200, 0.009, 1)
    birds(hero('eastasia'), 1.0, 10, 3000, 4600, 0.009, 0)
    birds(hero('southasia'), 0.8, 6, 2600, 3800, 0.008, 0)
    birds(WIDE_IN - 2.0, 2.2, 14, 1800, 2600, 0.008, 2)        # Africa blooming in the final wave
    birds(WIDE_IN, 3.0, 10, 2400, 4200, 0.006, 0)
    # whale song leading into the breach
    hw = hero('whale')
    for tt, f0, f1, d in ((hw - 4.6, 190, 300, 2.4), (hw - 2.2, 280, 210, 2.0), (hw + 4.0, 170, 250, 2.6)):
        n = int(SR * d)
        tq = np.arange(n) / SR
        f = f0 + (f1 - f0) * (tq / d) ** 1.5 + 6 * np.sin(2 * math.pi * 5.5 * tq)
        s = np.sin(2 * math.pi * np.cumsum(f) / SR) * np.sin(math.pi * tq / d) ** 1.5
        s += 0.3 * np.sin(4 * math.pi * np.cumsum(f) / SR) * np.sin(math.pi * tq / d) ** 2
        add(buf, tt, s, gain=0.020, pan=rng.uniform(-0.3, 0.3))
    return buf


def reverb(x, rt=2.3, wet=0.3, seed=3):
    r = np.random.default_rng(seed)
    n = int(SR * rt * 1.4)
    t = np.arange(n) / SR
    ir = r.standard_normal((n, 2)) * np.exp(-6.9 * t / rt)[:, None]
    ir[: int(0.012 * SR)] *= 0.2
    pad = np.zeros((N, 2))
    pad[:n] = ir
    pad = fft_filter(pad, band(250, 5200, 1))
    X = np.fft.rfft(x, axis=0)
    H = np.fft.rfft(pad, axis=0)
    y = np.fft.irfft(X * H, n=N, axis=0)
    y *= wet / (np.sqrt((ir ** 2).sum(0)).mean())
    return x + y


def main(out):
    dry, pad = music()
    fol, count = foley()
    fol = fol + breach_fx()
    amb = ambience()
    wh, sp = whooshes()
    mus = reverb(dry, 2.4, 0.34) + reverb(pad, 2.8, 0.25, seed=5) * 1.0
    amb = amb * 1.8
    mix = mus + reverb(fol, 1.2, 0.16, seed=7) + reverb(amb, 2.0, 0.18, seed=9) + reverb(wh, 0.8, 0.12, seed=11)
    mix = fft_filter(mix, band(45, 17000, 3))
    # the film: fade in over the first half second, out with the picture's fade, then cut the silent pad
    t = np.arange(N) / SR
    from pp.core import FADE_OUT, FADE_IN
    fade = np.clip(t / 0.4, 0, 1) * (1.0 - np.clip((t - FADE_OUT[0]) / (FADE_OUT[1] - FADE_OUT[0]), 0, 1)) ** 1.5
    mix = (mix * fade[:, None])[:NFILM]
    # gentle soft-knee saturation, then normalise (oversampled peak)
    pk = np.abs(mix).max()
    mix = mix / pk * 0.9
    mix = np.tanh(mix * 1.15) / np.tanh(1.15)
    X = np.fft.rfft(mix, axis=0)
    up = np.fft.irfft(np.concatenate([X, np.zeros((X.shape[0] * 3, 2), complex)], 0), n=len(mix) * 4, axis=0) * 4
    tp = np.abs(up).max()
    target = 10 ** (-1.5 / 20)
    mix *= target / tp
    print('events', count, 'rms dBFS %.1f' % (20 * math.log10(np.sqrt((mix ** 2).mean()))))
    L = NFILM
    for name, part in (('music', mus), ('foley', fol), ('ambience', amb), ('whoosh', wh)):
        print(' stem %-9s rms %.1f dB rel. mix' % (name, 20 * math.log10(np.sqrt((part[:L] ** 2).mean()) / np.sqrt(((mus + fol + amb + wh)[:L] ** 2).mean()))))

    def write(m):
        pcm = (np.clip(m, -1, 1) * 32767.0).astype('<i2')
        with wave.open(out, 'wb') as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())

    def lufs():
        import subprocess, re
        r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', out, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                           capture_output=True, text=True).stderr
        tail = r[r.rindex('Summary:'):]
        return float(re.search(r'I:\s+(-?[\d.]+) LUFS', tail).group(1)), float(re.search(r'Peak:\s+(-?[\d.]+) dBFS', tail).group(1))

    write(mix)
    i0, p0 = lufs()
    target = -17.5
    g = 10 ** ((target - i0) / 20)
    if p0 + 20 * math.log10(g) > -1.5:
        # too peaky for the target: a soft limiter on the loud moments, then try again
        lim = 10 ** ((-1.6 - (p0 + 20 * math.log10(g))) / 20)
        m2 = mix * g
        thr = 10 ** (-3.0 / 20)
        a = np.abs(m2).max(1, keepdims=True)
        over = a > thr
        m2 = np.where(over, m2 / a * (thr + (1 - thr) * np.tanh((a - thr) / (1 - thr))), m2)
        mix = m2 / g
    mix = mix * g
    write(mix)
    i1, p1 = lufs()
    print('loudness: %.1f LUFS integrated, true peak %.2f dBFS (before trim: %.1f LUFS, %.2f dBFS)' % (i1, p1, i0, p0))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'out/paper_planet_audio.wav')
