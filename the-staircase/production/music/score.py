#!/usr/bin/env python3
"""THE STAIRCASE v2 - the sound: a seamless 20.000 s loop. A playful clockwork score that climbs forever, plus foley
synced to the picture (events.json, written by events.js from the same choreography the renderer uses).

The music is a Shepard construction: every note is sounded in several octaves at once under a fixed bell-shaped
loudness curve over pitch, so a line can keep stepping UP while the sound stays in place. Over one loop the clockwork
melody climbs two full octaves and arrives exactly where it started - the ear's version of a climb that never ends,
which now matches a real ascent (Claude rises one staircase module per loop). Instruments (FluidSynth, FluidR3_GM):
marimba plucks on eighths, pizzicato bass, a music-box glint each bar, a soft string pad; synthesised clock ticks and a
very quiet Shepard-Risset glissando underneath. When the rope is cut the plucks hiccup (a beat of rest).

    t (s)        picture                                         sound
    always       a block materialises out of nothing            a rising crystalline shimmer with an electric buzz
                 ... and slams into place                       a heavy stone slam: sub thump, crack, dust
                 old blocks below crack and fall away           a stony crack, then a rumble and clatter falling away
                 footsteps, dragged heels, the taut rope        soft steps, scuffs, rope creaks
    4.6-6.2      the helper turns, hops back, snip-snip-SNIP    bip, boing, two shicks, the snip and the rope's twang
    6.55-6.75    the humans sit down hard                       three thuds
    7.2-8.45     antenna module out, new one in, two cranks     pop, sparkle, click, two ratchet zaps, a rising chime
    9.0          Claude surges                                  a whoosh up
    13.0-13.97   the beam fizzles; the block rises under the    a sputter; then the slam lands exactly on Claude's
                 foot on the very last frame                    footfall, with a little relief chime
    12.9-14.55   the lasso spins, flies, catches                whoosh-whoosh, a whoosh up, a thwip and a ding
    14.75-15.07  the rope snaps taut, one stretch after another three low twangs

Seamless by construction: everything is rendered over three cycles (60 s) with events placed in every cycle, the
Shepard pitches identical every cycle, the reverb circular, noise tiled, and the middle cycle cut.

    python3 score.py     (numpy, scipy, soundfile; fluidsynth + /usr/share/sounds/sf2/FluidR3_GM.sf2; ffmpeg)
Writes score.wav (48 kHz / 24-bit / stereo, exactly 20.000 s) and verification.txt.
"""
import os, json, struct, subprocess, tempfile
import numpy as np
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
SF2 = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
SR = 48000
D = 20.0
N = int(round(SR * D))
CYC = 3
NT = N * CYC
TARGET_LUFS = -20.0
CEIL_DB = -1.5
BPM = 120.0
BEAT = 60.0 / BPM               # 0.5 s; 40 beats = 10 bars of 4/4 per loop
t_all = np.arange(NT) / SR

EV = json.load(open(os.path.join(HERE, 'events.json')))
assert abs(EV['D'] - D) < 1e-9
events = EV['events']
SNIPS = [e['t'] for e in events if e['type'] == 'snip']


def rng(seed):
    return np.random.default_rng(seed)


def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], btype='band')
    return signal.lfilter(b, a, x)


def lp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), btype='low')
    return signal.lfilter(b, a, x, axis=-1)


def hp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), btype='high')
    return signal.lfilter(b, a, x, axis=-1)


def circ(fn, x):
    """apply a (causal) filter circularly over the three-cycle buffer: warm up on the last cycle"""
    y = fn(np.concatenate([x[..., -N:], x], axis=-1))
    return y[..., N:]


def pan2(x, p):
    p = float(np.clip(p, -1, 1))
    return np.vstack([x * np.sqrt(0.5 * (1 - p)), x * np.sqrt(0.5 * (1 + p))])


def place(buf, t0, snd):
    """add stereo snd at loop time t0 in every cycle (wrapping the tail of the last cycle to the start)"""
    for c in range(CYC):
        i0 = int(round((t0 + c * D) * SR))
        n = snd.shape[1]
        for k0 in range(0, n, NT):
            seg = snd[:, k0:k0 + NT]
            a = (i0 + k0) % NT
            m = min(seg.shape[1], NT - a)
            buf[:, a:a + m] += seg[:, :m]
            if m < seg.shape[1]:
                buf[:, :seg.shape[1] - m] += seg[:, m:]


def env(n, a, d):
    """attack a seconds, exponential decay time-constant d seconds"""
    tt = np.arange(n) / SR
    return np.minimum(1, tt / max(a, 1e-4)) * np.exp(-tt / d)


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ------------------------------------------------------------------ foley
def clonk(seed, gain=1.0, pitch=1.0):
    n = int(0.45 * SR); tt = np.arange(n) / SR
    x = (0.9 * np.sin(2 * np.pi * 70 * pitch * tt) * env(n, 0.002, 0.06)
         + 0.5 * np.sin(2 * np.pi * 182 * pitch * tt) * env(n, 0.001, 0.09)
         + 0.32 * np.sin(2 * np.pi * 291 * pitch * tt) * env(n, 0.001, 0.07)
         + 0.18 * np.sin(2 * np.pi * 437 * pitch * tt) * env(n, 0.001, 0.05))
    x += bp(rng(seed).standard_normal(n), 900, 4200) * env(n, 0.0005, 0.012) * 0.5
    return x * gain


def bloop(seed, gain, warm):
    n = int(0.22 * SR); tt = np.arange(n) / SR
    f = 520 * 2 ** (1.1 * np.clip(tt / 0.16, 0, 1))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + (0.3 * np.sin(2 * ph) if warm else 0.12 * np.sin(3 * ph))
    return x * np.sin(np.pi * np.clip(tt / 0.22, 0, 1)) ** 2 * gain


def step_tap(seed, gain, crisp):
    n = int(0.12 * SR); tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * (95 if not crisp else 120) * tt) * env(n, 0.002, 0.03)
    x += bp(rng(seed).standard_normal(n), 1500 if crisp else 700, 5000 if crisp else 2500) * env(n, 0.0005, 0.008) * (0.6 if crisp else 0.35)
    return x * gain


def scuff(seed, gain):
    n = int(0.16 * SR); tt = np.arange(n) / SR
    x = bp(rng(seed).standard_normal(n), 900, 3500) * np.sin(np.pi * np.clip(tt / 0.1, 0, 1)) ** 2 * (tt < 0.1)
    # rope creak: a train of tiny resonant clicks
    cr = np.zeros(n)
    k = 0.0
    r = rng(seed + 1)
    while k < 0.14:
        i = int(k * SR)
        if i < n: cr[i] = 1.0
        k += 0.012 + 0.01 * r.random()
    cr = bp(cr, 350, 900, 2) * 6
    return (x * 0.6 + cr * np.exp(-tt / 0.08)) * gain


def shimmer(seed, gain):
    n = int(0.9 * SR); tt = np.arange(n) / SR
    r = rng(seed)
    x = sum(np.sin(2 * np.pi * f * tt + r.random() * 6) for f in (2093, 2637, 3136, 3951)) / 4
    return x * np.sin(np.pi * np.clip(tt / 0.9, 0, 1)) ** 3 * gain


def bip(seed, gain):
    n = int(0.08 * SR); tt = np.arange(n) / SR
    return np.sin(2 * np.pi * 1320 * tt) * env(n, 0.002, 0.03) * gain


def boing(seed, gain, up=True):
    n = int(0.26 * SR); tt = np.arange(n) / SR
    f = (280 + 520 * np.clip(tt / 0.2, 0, 1) ** 0.7) if up else (700 - 400 * np.clip(tt / 0.2, 0, 1))
    f = f * (1 + 0.06 * np.sin(2 * np.pi * 22 * tt))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.004, 0.09) * gain


def shick(seed, gain):
    n = int(0.12 * SR); tt = np.arange(n) / SR
    x = hp(rng(seed).standard_normal(n), 3500) * env(n, 0.001, 0.025)
    x += (np.sin(2 * np.pi * 3150 * tt) + 0.7 * np.sin(2 * np.pi * 4730 * tt)) * env(n, 0.001, 0.04) * 0.35
    return x * gain


def twang(seed, gain, f0=98.0, dur=0.9):
    """Karplus-Strong pluck with a downward bend: the rope letting go"""
    n = int(dur * SR)
    p = int(SR / f0)
    buf = rng(seed).standard_normal(p) * 0.8
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.996 * 0.5 * (buf[i % p] + buf[(i + 1) % p])
    tt = np.arange(n) / SR
    # bend down by resampling progressively
    warp = np.cumsum(1 - 0.18 * np.clip(tt / 0.4, 0, 1)) - 1
    out = np.interp(warp, np.arange(n), out)
    return lp(out, 2500) * env(n, 0.001, 0.25) * gain


def whoosh(seed, dur, f0, f1, gain):
    n = int(dur * SR); tt = np.arange(n) / SR
    x = rng(seed).standard_normal(n)
    # sweeping band: process in blocks
    y = np.zeros(n); blk = 480
    for k in range(0, n, blk):
        u = k / n
        fc = f0 * (f1 / f0) ** u
        seg = x[max(0, k - 2048):k + blk]
        yy = bp(seg, fc * 0.7, min(fc * 1.4, SR / 2 - 100))
        y[k:k + blk] = yy[-len(x[k:k + blk]):]
    return y * np.sin(np.pi * np.clip(tt / dur, 0, 1)) ** 1.5 * gain


def thud(seed, gain):
    n = int(0.4 * SR); tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * (58 + 30 * np.exp(-tt / 0.03)) * tt) * env(n, 0.002, 0.09)
    x += lp(rng(seed).standard_normal(n), 900) * env(n, 0.001, 0.05) * 0.8
    x += bp(rng(seed + 3).standard_normal(n), 1200, 5000) * env(n, 0.01, 0.12) * 0.12   # dust
    return x * gain


def spin_whoosh(seed, dur, rate, gain):
    n = int(dur * SR); tt = np.arange(n) / SR
    x = bp(rng(seed).standard_normal(n), 700, 2600)
    am = (0.5 + 0.5 * np.cos(2 * np.pi * rate * tt)) ** 3
    return x * am * np.sin(np.pi * np.clip(tt / dur, 0, 1)) ** 0.5 * gain


def ding(seed, gain):
    n = int(0.8 * SR); tt = np.arange(n) / SR
    x = (np.sin(2 * np.pi * 1760 * tt) + 0.5 * np.sin(2 * np.pi * 2640 * tt) + 0.25 * np.sin(2 * np.pi * 4400 * tt)) * env(n, 0.002, 0.18)
    return x * gain


def slam(seed, gain, big=1.0):
    """a heavy stone block landing: a sub thump with a pitch drop, a woody-stony body, a crack, and a dust tail"""
    n = int(0.9 * SR); tt = np.arange(n) / SR
    f = 48 + 70 * np.exp(-tt / 0.025)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.16) * 1.1
    x += (0.55 * np.sin(2 * np.pi * 131 * tt) + 0.35 * np.sin(2 * np.pi * 207 * tt) + 0.2 * np.sin(2 * np.pi * 349 * tt)) * env(n, 0.001, 0.07)
    x += bp(rng(seed).standard_normal(n), 1200, 6000) * env(n, 0.0003, 0.01) * 0.9          # the crack
    x += lp(rng(seed + 1).standard_normal(n), 2500) * env(n, 0.004, 0.09) * 0.45           # thud body
    x += bp(rng(seed + 2).standard_normal(n), 2500, 9000) * np.minimum(1, tt / 0.03) * np.exp(-tt / 0.25) * 0.12  # dust
    # a little bounce (the squash-bounce of the block)
    k = int(0.11 * SR)
    x[k:] += 0.25 * x[:n - k] * np.exp(-tt[:n - k] / 0.05)
    return x * gain * big


def form(seed, gain, dur):
    """materialising: a shimmer that rises in pitch and density into the slam, over an electric buzz"""
    n = int((dur + 0.05) * SR); tt = np.arange(n) / SR
    u = np.clip(tt / dur, 0, 1)
    r = rng(seed)
    x = np.zeros(n)
    for k, f0 in enumerate((1318.5, 1760.0, 2217.5, 2637.0, 3520.0)):
        f = f0 * 2 ** (0.5 * u)
        x += np.sin(2 * np.pi * np.cumsum(f) / SR + r.random() * 6) * (0.5 + 0.5 * np.sin(2 * np.pi * (9 + 3 * k) * tt)) / 5
    buzz = np.sign(np.sin(2 * np.pi * 110 * 2 ** (0.4 * u) * tt)) * 0.15
    x = x * 0.8 + lp(buzz, 1800) * 0.6
    sh = np.sin(np.pi / 2 * u) ** 2 * (1 - np.clip((tt - dur) / 0.05, 0, 1))
    return x * sh * gain


def crack(seed, gain):
    n = int(0.25 * SR); tt = np.arange(n) / SR
    x = bp(rng(seed).standard_normal(n), 800, 5000) * env(n, 0.0005, 0.015)
    x += bp(rng(seed + 1).standard_normal(n), 300, 1500) * env(n, 0.002, 0.05) * 0.5
    return x * gain


def crumble(seed, gain):
    """the block breaks and its pieces fall away into the clouds: a rumble and a clatter that recede and darken"""
    n = int(1.6 * SR); tt = np.arange(n) / SR
    r = rng(seed)
    x = lp(r.standard_normal(n), 400) * env(n, 0.01, 0.35) * 1.2
    cl = np.zeros(n)
    k = 0.0
    while k < 1.2:
        i = int(k * SR)
        if i < n: cl[i] = (0.4 + 0.6 * r.random()) * np.exp(-k / 0.5)
        k += 0.03 + 0.08 * r.random()
    cl = bp(cl, 600, 3000, 2) * 8
    out = x + cl
    # recede: a darkening low-pass sweep
    y = np.zeros(n); blk = 2400
    for i in range(0, n, blk):
        fc = 5000 * 2 ** (-4 * i / n)
        seg = out[max(0, i - 4096):i + blk]
        yy = lp(seg, max(fc, 200))
        y[i:i + blk] = yy[-len(out[i:i + blk]):]
    return y * gain


def chime_up(seed, gain, notes=(76, 81, 85, 88, 93), step=0.065):
    n = int(1.6 * SR); tt = np.arange(n) / SR
    x = np.zeros(n)
    for j, m in enumerate(notes):
        i0 = int(j * step * SR); f = midi_hz(m); t2 = tt[:n - i0]
        x[i0:] += (np.sin(2 * np.pi * f * t2) + 0.4 * np.sin(2 * np.pi * 2.01 * f * t2) + 0.15 * np.sin(2 * np.pi * 3.0 * f * t2)) * env(n - i0, 0.002, 0.35 + 0.1 * j)
    return x * gain / len(notes) * 2


def ratchet(seed, gain):
    n = int(0.3 * SR); tt = np.arange(n) / SR
    cl = np.zeros(n)
    for j in range(6):
        i = int((0.02 + j * 0.032) * SR)
        cl[i] = 1.0
    x = bp(cl, 2500, 7000, 2) * 10 + bp(rng(seed).standard_normal(n), 3000, 9000) * env(n, 0.001, 0.02) * 0.4
    zap = np.sin(2 * np.pi * np.cumsum(2400 + 1800 * np.exp(-tt / 0.03)) / SR) * env(n, 0.001, 0.05) * 0.35
    return (x + zap) * gain


def pop(seed, gain):
    n = int(0.2 * SR); tt = np.arange(n) / SR
    f = 900 * np.exp(-tt / 0.03) + 300
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.04) * gain


def sparkle(seed, gain):
    n = int(0.7 * SR); tt = np.arange(n) / SR
    r = rng(seed); x = np.zeros(n)
    for j in range(9):
        i0 = int(r.random() * 0.4 * SR); f = 2600 + 2400 * r.random(); t2 = tt[:n - i0]
        x[i0:] += np.sin(2 * np.pi * f * t2) * env(n - i0, 0.001, 0.06)
    return x * gain / 3


def click(seed, gain):
    n = int(0.08 * SR); tt = np.arange(n) / SR
    return (bp(rng(seed).standard_normal(n), 1500, 6000) * env(n, 0.0003, 0.006) + np.sin(2 * np.pi * 1800 * tt) * env(n, 0.0005, 0.015) * 0.5) * gain


def fizzle(seed, gain, dur):
    n = int(dur * SR); tt = np.arange(n) / SR
    r = rng(seed)
    gate = (np.sin(2 * np.pi * 9 * tt + 3 * np.sin(2 * np.pi * 2.3 * tt)) > 0.2).astype(float)
    gate = lp(gate, 200)
    x = hp(r.standard_normal(n), 2000) * 0.5 + np.sign(np.sin(2 * np.pi * 150 * tt)) * 0.25
    return x * gate * np.sin(np.pi * np.clip(tt / dur, 0, 1)) ** 0.5 * gain


def creak(seed, gain):
    n = int(0.35 * SR); tt = np.arange(n) / SR
    r = rng(seed); cr = np.zeros(n); k = 0.0
    while k < 0.3:
        i = int(k * SR)
        if i < n: cr[i] = 1.0
        k += 0.009 + 0.006 * r.random() + 0.01 * k
    cr = bp(cr, 280, 800, 2) * 7
    return cr * np.sin(np.pi * np.clip(tt / 0.32, 0, 1)) * gain


fx = np.zeros((2, NT))
for k, e in enumerate(events):
    ty, t0, pn = e['type'], e['t'], 0.75 * e['pan']
    sd = 1000 + k
    if ty == 'slam':
        place(fx, t0, pan2(slam(sd, 0.62, 1.0 + 0.05 * ((e['step'] * 7) % 5 - 2) * 0), pn))
    elif ty == 'jitSlam':
        place(fx, t0, pan2(slam(sd, 0.85), pn))
        place(fx, t0 + 0.06, pan2(chime_up(sd, 0.10, (81, 88)), pn))
    elif ty == 'form':
        place(fx, t0, pan2(form(sd, 0.10, e['dur']), pn))
    elif ty == 'miniHop':
        place(fx, t0, pan2(boing(sd, 0.035, True), pn))
    elif ty == 'crack':
        place(fx, t0, pan2(crack(sd, 0.22), pn))
    elif ty == 'crumble':
        place(fx, t0, pan2(crumble(sd, 0.32), pn))
    elif ty == 'climbStep':
        place(fx, t0, pan2(step_tap(sd, 0.11 if e.get('heavy') else 0.08, False), pn))
    elif ty == 'dragHop':
        place(fx, t0, pan2(scuff(sd, 0.07), pn))
    elif ty == 'creak':
        place(fx, t0, pan2(creak(sd, 0.05), pn))
    elif ty == 'runStep':
        place(fx, t0, pan2(step_tap(sd, 0.05, True), pn))
    elif ty == 'turn':
        place(fx, t0, pan2(bip(sd, 0.08), pn))
    elif ty == 'hopUp':
        place(fx, t0, pan2(boing(sd, 0.10, True), pn))
    elif ty == 'hopLand':
        place(fx, t0, pan2(step_tap(sd, 0.12, True), pn))
    elif ty in ('snipOpen', 'snipHalf'):
        place(fx, t0, pan2(shick(sd, 0.18), pn))
    elif ty == 'snip':
        place(fx, t0, pan2(shick(sd, 0.34), pn))
        place(fx, t0 + 0.01, pan2(twang(sd, 0.8), pn))
    elif ty == 'whip':
        place(fx, t0 + 0.02, pan2(whoosh(sd, 0.42, 3200, 700, 0.22), pn - 0.1))
    elif ty == 'fall':
        place(fx, t0, pan2(thud(sd, [0.6, 0.5, 0.55][e.get('who', 0)]), pn))
    elif ty == 'getup':
        place(fx, t0, pan2(scuff(sd, 0.05), pn))
    elif ty == 'pop':
        place(fx, t0, pan2(pop(sd, 0.16), pn))
        place(fx, t0 + 0.03, pan2(whoosh(sd, 0.5, 1800, 500, 0.08), pn + 0.2))
    elif ty == 'show':
        place(fx, t0, pan2(sparkle(sd, 0.10), pn))
    elif ty == 'insert':
        place(fx, t0, pan2(click(sd, 0.22), pn))
    elif ty == 'crank':
        place(fx, t0 - 0.18, pan2(ratchet(sd, 0.16), pn))
    elif ty == 'upgrade':
        place(fx, t0, pan2(chime_up(sd, 0.22), pn))
        place(fx, t0, pan2(whoosh(sd, 0.7, 400, 3000, 0.06), pn))
    elif ty == 'surge':
        place(fx, t0, pan2(whoosh(sd, 0.55, 500, 2600, 0.16), pn))
    elif ty == 'fizzle':
        place(fx, t0, pan2(fizzle(sd, 0.05, e['dur']), pn))
    elif ty == 'spin':
        place(fx, t0, pan2(spin_whoosh(sd, e['dur'], 2.2, 0.10), pn))
    elif ty == 'throw':
        place(fx, t0, pan2(whoosh(sd, 0.45, 600, 2400, 0.14), pn))
    elif ty == 'catch':
        place(fx, t0, pan2(shick(sd, 0.10), pn))
        place(fx, t0 + 0.02, pan2(ding(sd, 0.06), pn))
    elif ty == 'taut':
        w = e.get('who', 0)
        place(fx, t0, pan2(twang(sd, [0.4, 0.3, 0.25][w], [73.4, 82.4, 98.0][w], 0.8), pn))
        place(fx, t0, pan2(scuff(sd + 7, 0.1), pn))

# ------------------------------------------------------------------ clock ticks (synth), quarter notes, tick-tock
ticks = np.zeros((2, NT))
for b in range(int(D / BEAT)):
    tb = b * BEAT
    if any(-0.05 < tb - s < 0.45 for s in SNIPS):
        continue                                  # the hiccup
    n = int(0.06 * SR); tt = np.arange(n) / SR
    f = 2350 if b % 2 == 0 else 1760
    x = (np.sin(2 * np.pi * f * tt) * env(n, 0.0005, 0.012) + hp(rng(b).standard_normal(n), 3000) * env(n, 0.0003, 0.004) * 0.6)
    place(ticks, tb, pan2(x * (0.06 if b % 4 == 0 else 0.042), -0.25 if b % 2 == 0 else 0.25))

# ------------------------------------------------------------------ the Shepard-Risset glissando (very quiet)
def shepard_gliss():
    """an exactly periodic Shepard-Risset glissando: 8 octave-spaced partials rise one octave per loop under a fixed bell.
    Partial k ends the loop where partial k+1 began, so each starts with the phase the one below it ends with; the base
    frequency is nudged so the chain of 8 closes on a whole number of cycles. One cycle is synthesised and tiled."""
    tt = np.arange(N) / SR
    lf = [np.mod(k + tt / D, 8.0) for k in range(8)]
    base = 55.0
    cyc = sum(np.sum(base * 2 ** l) / SR for l in lf)          # total cycles of all partials over one loop
    alpha = np.round(cyc) / cyc
    out = np.zeros(N)
    ph0 = 0.0
    for k in range(8):
        f = base * alpha * 2 ** lf[k]
        ph = ph0 + 2 * np.pi * np.concatenate([[0.0], np.cumsum(f)[:-1]]) / SR
        w = np.exp(-0.5 * ((lf[k] - 4.0) / 1.15) ** 2)
        out += np.sin(ph) * w
        ph0 = ph0 + 2 * np.pi * np.sum(f) / SR                  # where partial k ends = where partial k+1 starts
    return np.tile(out, CYC) * 0.012


gl = shepard_gliss() * 0.6
gl = np.vstack([gl, np.roll(gl, int(0.013 * SR))])

# ------------------------------------------------------------------ the Shepard melody (FluidSynth)
SCALE = [0, 2, 4, 5, 7, 9, 11]                    # D major degrees -> semitones above D
TONIC = 62                                        # D4
RISES = [1, 1, 1, 2, 1, 1, 1, 2, 2, 2]            # bar-root climbs, 14 degrees = 2 octaves per loop
ARP = [0, 2, 4, 2, 5, 4, 7, 4]                    # eighth-note figure on each bar's root
assert sum(RISES) == 14


def deg_midi(d):
    o, r = divmod(d, 7)
    return TONIC + 12 * o + SCALE[r]


def shep(m, centre, width=11.0, vmax=96, floor=10):
    """octave copies of note m with velocities from a bell over pitch (centre, width in semitones)"""
    out = []
    for k in range(-5, 6):
        mm = m + 12 * k
        if mm < 24 or mm > 108:
            continue
        w = np.exp(-0.5 * ((mm - centre) / width) ** 2)
        v = int(round(vmax * w))
        if v >= floor:
            out.append((mm, v))
    return out


MAR, PIZ, CEL, STR = 0, 1, 2, 3
NOTES = []                                        # (t, ch, midi, vel, len)
roots = np.cumsum([0] + RISES[:-1])
for bar in range(10):
    r = roots[bar]
    t_bar = bar * 4 * BEAT
    for i, a in enumerate(ARP):
        t = t_bar + i * BEAT / 2
        if any(-0.08 < t - s < 0.48 for s in SNIPS):
            continue                              # the hiccup: a rest where the rope snaps
        acc = 1.0 if i % 2 == 0 else 0.78
        for mm, v in shep(deg_midi(r + a), 74, 10.5, int(84 * acc)):
            NOTES.append((t, MAR, mm, v, 0.22))
    # pizzicato bass on beats 1 and 3: root and fifth
    for bt, d in ((0, 0), (2, 4)):
        t = t_bar + bt * BEAT
        if any(-0.08 < t - s < 0.48 for s in SNIPS):
            continue
        for mm, v in shep(deg_midi(r + d) - 12, 50, 9.0, 92):
            NOTES.append((t, PIZ, mm, v, 0.4))
    # a music-box glint on the 'and' of 4
    for mm, v in shep(deg_midi(r + 7 + 2), 88, 8.0, 60):
        NOTES.append((t_bar + 3.5 * BEAT, CEL, mm, v, 0.5))
    # a soft string pad: the bar's triad
    for d in (0, 2, 4):
        for mm, v in shep(deg_midi(r + d), 64, 9.0, 40, 8):
            NOTES.append((t_bar, STR, mm, v, 4 * BEAT * 1.02))
# the catch: a little celesta arpeggio up
for e in events:
    if e['type'] == 'catch':
        for j, d in enumerate((0, 2, 4, 7)):
            bar = int(e['t'] // (4 * BEAT)); r = roots[min(bar, 9)]
            for mm, v in shep(deg_midi(r + d + 7), 86, 7.0, 64):
                NOTES.append((e['t'] + 0.05 + j * 0.07, CEL, mm, v, 0.4))


def midi_file(path, notes, cycles):
    tpq, tempo = 480, 500000
    tps = tpq * 1e6 / tempo
    ev = []
    progs = {MAR: 12, PIZ: 45, CEL: 8, STR: 49}
    vols = {MAR: 100, PIZ: 95, CEL: 80, STR: 60}
    for ch, prg in progs.items():
        ev.append((0, bytes([0xC0 | ch, prg])))
        ev.append((0, bytes([0xB0 | ch, 7, vols[ch]])))
        ev.append((0, bytes([0xB0 | ch, 91, 0])))
        ev.append((0, bytes([0xB0 | ch, 93, 0])))
    for c in range(cycles):
        for (t, ch, nt, vel, ln) in notes:
            on = int(round((c * D + t) * tps))
            ev.append((on, bytes([0x90 | ch, nt, vel])))
            ev.append((on + int(round(ln * tps)), bytes([0x80 | ch, nt, 0])))
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
    data += vlq(int((cycles * D + 4) * tps) - last) + b'\xff\x2f\x00'
    with open(path, 'wb') as f:
        f.write(b'MThd' + struct.pack('>IHHH', 6, 0, 1, tpq) + b'MTrk' + struct.pack('>I', len(data)) + data)


with tempfile.TemporaryDirectory() as td:
    mp, wp = os.path.join(td, 'score.mid'), os.path.join(td, 'score.wav')
    midi_file(mp, NOTES, CYC)
    subprocess.run(['fluidsynth', '-ni', '-q', '-R', '0', '-C', '0', '-g', '0.5', '-r', str(SR), '-F', wp, SF2, mp], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    m, msr = sf.read(wp, always_2d=True)
    assert msr == SR
m = m.T
music = np.zeros((2, NT))
k = min(NT, m.shape[1])
music[:, :k] = m[:, :k]
if m.shape[1] > NT:
    music[:, :m.shape[1] - NT] += m[:, NT:]


# ------------------------------------------------------------------ space and mix
def hall(x, seconds, seed, lpf):
    r = rng(seed)
    n = int(seconds * SR)
    tt = np.arange(n) / SR
    ir = r.standard_normal((2, n)) * np.exp(-tt / (seconds / 6.9))
    ir = lp(ir, lpf, 1)
    ir[:, :int(0.015 * SR)] *= np.linspace(0, 1, int(0.015 * SR))
    ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
    y = np.zeros_like(x)
    for ch in range(2):
        full = signal.fftconvolve(np.concatenate([x[ch], x[ch]]), ir[ch])[:2 * NT]
        y[ch] = full[NT:2 * NT]
    return y


fx *= 0.3                                         # foley sits under the score
ticks *= 3.0
dry = music * 0.75 + ticks + fx + gl
wet = hall(music * 0.6 + fx * 0.35 + ticks * 0.3 + gl * 0.8, 2.2, 9, 4200)
mix = dry * 0.9 + wet * 0.3
mix = circ(lambda x: hp(x, 30, 2), mix)


def limiter(x, ceil, la=0.004):
    """a smooth, circular look-ahead peak limiter (stereo-linked): the gain each sample needs, min-filtered over
    +-la (so the gain is already down when a peak arrives) and then box-smoothed over la; transients only"""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    a = np.max(np.abs(x), axis=0)
    g = np.minimum(1.0, ceil / np.maximum(a, 1e-9))
    w = int(la * SR)
    g = minimum_filter1d(g, size=2 * w + 1, mode='wrap')
    g = uniform_filter1d(g, size=w, mode='wrap')
    return x * g


# level the peaky one-shots against the bed: limit 9 dB under the current peak before loudness normalisation
pk = np.max(np.abs(mix))
mix = limiter(mix, pk * 10 ** (-7 / 20))
out = mix[:, N:2 * N].copy()
if os.environ.get('STEMDBG'):
    for nm, v in (('music', music), ('ticks', ticks), ('fx', fx), ('gl', gl), ('wet', wet), ('dry', dry), ('mix', mix)):
        dd = np.max(np.abs(v[:, N:2 * N] - v[:, 2 * N:3 * N])) / (np.max(np.abs(v)) + 1e-12)
        print('periodicity', nm, f'{dd:.2e}')
K = int(0.25 * SR)
CONT = np.max(np.abs(mix[:, 2 * N - K:2 * N + K] - np.concatenate([out[:, -K:], out[:, :K]], axis=1))) / (np.max(np.abs(out)) + 1e-12)
STEMS = {'music': music * 0.75 * 0.9, 'ticks': ticks * 0.9, 'fx': fx * 0.9, 'gliss': gl * 0.9}


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
lines = ['THE STAIRCASE v2 - sound verification (measured on the written score.wav)', '']
lines.append(f'duration: {back_.shape[1]} frames = {back_.shape[1] / sr:.6f} s at {sr} Hz, {back_.shape[0]} ch, PCM_24')
cnt = {}
for e in events:
    cnt[e['type']] = cnt.get(e['type'], 0) + 1
lines.append('events placed (loop time): ' + ', '.join(f'{k} {v}' for k, v in sorted(cnt.items())))
lines.append('story beats: ' + ', '.join(f"{e['type']} {e['t']:.2f}" for e in events if e['type'] in ('snip', 'fall', 'pop', 'crank', 'upgrade', 'surge', 'jitSlam', 'throw', 'catch', 'taut')))
lines.append(f'music: Shepard clockwork, {BPM:.0f} bpm, 10 bars per loop, climbs 2 octaves per loop and returns to the identical sound; {len(NOTES)} note copies per cycle')
lines.append(f'integrated loudness (internal BS.1770 meter, looped): {L2:.2f} LUFS; true peak {tp2:.2f} dBTP (4x oversampled)')
lines.append('stem balance (dry, before limiting; LUFS of each stem alone, relative to the mix): ' + ', '.join(f'{k} {lufs(v[:, N:2 * N]) - L:+.1f} LU' for k, v in STEMS.items()))
d_all = np.abs(np.diff(back_, axis=1))
seam = np.abs(back_[:, 0] - back_[:, -1])
lines.append(f'seam step |x[0] - x[N-1]|: L {seam[0]:.2e}, R {seam[1]:.2e}; ordinary steps: median {np.median(d_all):.2e}, 99.9th pct {np.percentile(d_all, 99.9):.2e}, max {d_all.max():.2e}')
two = np.concatenate([back_, back_], axis=1)
b, a = signal.butter(4, 6000 / (sr / 2), btype='high')
hpx = signal.lfilter(b, a, two, axis=1)[:, N // 2: N // 2 + N]
w = int(0.005 * sr)
e_ = np.array([np.sum(hpx[:, i:i + w] ** 2) for i in range(0, N - w, w)])
mid = (N // 2) // w
seam_e = e_[mid - 1:mid + 2].max()
lines.append(f'click test (>6 kHz energy, 5 ms windows): window at the seam {10 * np.log10(seam_e + 1e-30):.1f} dB; median {10 * np.log10(np.median(e_) + 1e-30):.1f} dB; max anywhere {10 * np.log10(e_.max() + 1e-30):.1f} dB; seam rank {int(np.sum(e_ > seam_e))} of {len(e_)} windows louder')
loc = np.array([np.sum(hpx[:, (N // 2) + k * w:(N // 2) + (k + 1) * w] ** 2) for k in range(-100, 100) if abs(k) > 2])
lines.append(f'local click test: seam window {10 * np.log10(seam_e + 1e-30):.1f} dB vs the surrounding 1 s: median {10 * np.log10(np.median(loc) + 1e-30):.1f} dB, max {10 * np.log10(loc.max() + 1e-30):.1f} dB')
lines.append(f'continuity test: the looped seam (last 0.25 s + first 0.25 s) vs the same instant inside the continuous three-cycle render: max difference {CONT:.2e} of full scale')
ok_seam = CONT < 1e-6 and seam.max() <= np.percentile(d_all, 99.9)
try:
    rr2 = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    summ = [l.strip() for l in rr2.stderr.splitlines() if l.strip().startswith(('I:', 'LRA:', 'Peak:'))]
    lines.append('ffmpeg ebur128 (single pass, not looped): ' + ' | '.join(summ[-3:]))
except Exception as ex:  # noqa
    lines.append('ffmpeg ebur128 unavailable: ' + str(ex))
lines.append('')
lines.append(('PASS' if ok_seam else 'CHECK') + '  seamless loop: the seam is sample-identical to the continuous render, and its step is ordinary (the HF energy there is the downbeat tick)')
lines.append(('PASS' if back_.shape[1] == N else 'FAIL') + '  exactly 20.000 s')
lines.append(('PASS' if abs(L2 - TARGET_LUFS) < 0.1 else 'CHECK') + f'  loudness {L2:.2f} LUFS (target {TARGET_LUFS})')
txt = '\n'.join(lines)
print(txt)
open(os.path.join(HERE, 'verification.txt'), 'w').write(txt + '\n')
