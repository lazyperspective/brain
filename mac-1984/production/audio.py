#!/usr/bin/env python3
"""Synthesise the whole soundtrack of the Macintosh 1984 film from the timeline cue list.
Everything is generated here (oscillators, noise, filters): no samples.
Two worlds: 'speaker' sounds are rendered at the Mac's 22,254 Hz / 8-bit rate, zero-order-held up to 48 kHz and
played through a small-speaker model; 'room' sounds (floppy drive, mouse, keyboard, power switch) are mechanical
noises captured by a mic in a quiet room. Mixed, levelled gently (narrow loudness range for phones) and mastered to
-16 LUFS integrated with true peak below -1 dBTP.
usage: python3 audio.py cues.json out.wav
"""
import json, sys
import numpy as np
from scipy import signal
from scipy.ndimage import minimum_filter1d, uniform_filter1d

SR = 48000
MAC_SR = 22254
cues_path, out_path = sys.argv[1], sys.argv[2]
data = json.load(open(cues_path))
DUR = float(data['duration'])
CUES = data['cues']
N = int(DUR * SR) + SR
rng = np.random.default_rng(1984)


def t_(d, sr=SR):
    return np.arange(int(d * sr)) / sr

def env_exp(d, tau, attack=0.001, sr=SR):
    t = t_(d, sr); e = np.exp(-t / tau); a = int(attack * sr)
    if a > 0: e[:a] *= np.linspace(0, 1, a)
    return e

def bp(x, lo, hi, order=2, sr=SR):
    return signal.sosfilt(signal.butter(order, [lo / (sr / 2), min(hi / (sr / 2), 0.99)], 'band', output='sos'), x)

def lp(x, f, order=2, sr=SR):
    return signal.sosfilt(signal.butter(order, min(f / (sr / 2), 0.99), 'low', output='sos'), x)

def hp(x, f, order=2, sr=SR):
    return signal.sosfilt(signal.butter(order, f / (sr / 2), 'high', output='sos'), x)

def reson(x, f, q, sr=SR):
    b, a = signal.iirpeak(f / (sr / 2), q); return signal.lfilter(b, a, x)

def noise(d, r=None, sr=SR):
    return (r or rng).standard_normal(int(d * sr))

def norm(x, peak=1.0):
    return x / (np.max(np.abs(x)) + 1e-12) * peak

def db(v):
    return 10 ** (v / 20)

L = np.zeros(N); Rr = np.zeros(N)
SPK = np.zeros(N)   # mono bus for the Mac's internal speaker

def add(t, x, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= N or i < 0: return
    x = x[: N - i]
    gl = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2) * gain
    gr = np.sin((pan + 1) * np.pi / 4) * np.sqrt(2) * gain
    L[i:i + len(x)] += x * gl; Rr[i:i + len(x)] += x * gr

def add_spk(t, x, gain=1.0):
    i = int(round(t * SR))
    if i >= N: return
    x = x[: N - i]; SPK[i:i + len(x)] += x * gain

# ------------------------------------------------------------------ the Mac speaker: 22 kHz, 8-bit, ZOH, tiny cone
def mac_dac(x22):
    """x22 at MAC_SR in [-1,1] -> 8-bit quantised, zero-order held to SR."""
    q = np.round(np.clip(x22, -1, 1) * 127) / 127
    idx = np.floor(np.arange(int(len(q) * SR / MAC_SR)) * MAC_SR / SR).astype(int)
    return q[np.minimum(idx, len(q) - 1)]

def speaker(x):
    y = hp(x, 230, 2)
    y = lp(y, 7500, 2)
    y = y + 0.35 * reson(y, 1750, 1.6) + 0.18 * reson(y, 3600, 2.5)
    y = np.tanh(y * 1.3) / 1.3
    return y

# ------------------------------------------------------------------ system sounds (original compositions)
def boot_tone():
    # a bright, square-ish two-voice "bong" (fifth), decaying; synthesised at the Mac rate
    d = 1.15; t = t_(d, MAC_SR)
    def sq(f, duty=0.5):
        ph = (f * t) % 1.0
        return np.where(ph < duty, 1.0, -1.0)
    v = 0.55 * sq(523.25) * np.exp(-t / 0.42) + 0.42 * sq(784.0, 0.4) * np.exp(-t / 0.36) + 0.18 * sq(1046.5, 0.3) * np.exp(-t / 0.2)
    v = lp(v, 3200, 2, MAC_SR)       # the sound chip's smoothing
    a = int(0.004 * MAC_SR); v[:a] *= np.linspace(0, 1, a)
    return mac_dac(norm(v, 0.9))

def alert_beep():
    d = 0.32; t = t_(d, MAC_SR)
    f = 880 * (1 + 0.012 * np.exp(-t / 0.02))
    ph = np.cumsum(f) / MAC_SR % 1.0
    v = np.where(ph < 0.5, 1.0, -1.0) * np.exp(-t / 0.11)
    v = lp(v, 3000, 2, MAC_SR); a = int(0.002 * MAC_SR); v[:a] *= np.linspace(0, 1, a)
    return mac_dac(norm(v, 0.9))

def crunch():
    # crumpling paper: dense crackles in clusters, a low "flump", through the 8-bit speaker
    d = 0.95; n = int(d * MAC_SR); v = np.zeros(n); r = np.random.default_rng(77)
    t = 0.0
    while t < d - 0.03:
        dens = np.exp(-t / 0.35)
        k = int(t * MAC_SR)
        ln = int((0.002 + r.random() * 0.012) * MAC_SR)
        burst = r.standard_normal(ln) * np.exp(-np.arange(ln) / (ln * 0.3))
        burst = bp(burst, 800 + r.random() * 1500, 3500 + r.random() * 4500, 2, MAC_SR)
        v[k:k + ln] += burst[: max(0, n - k)] * (0.4 + r.random()) * (0.3 + 0.7 * dens)
        t += (0.004 + r.random() * 0.03) / (0.4 + dens)
    tt = t_(0.18, MAC_SR)
    flump = np.sin(2 * np.pi * (70 + 60 * np.exp(-tt / 0.03)) * tt) * np.exp(-tt / 0.05)
    flump += lp(r.standard_normal(len(tt)), 400, 2, MAC_SR) * np.exp(-tt / 0.04) * 0.6
    v[:len(flump)] += flump * 0.9
    v *= np.minimum(1, (d - t_(d, MAC_SR)) / 0.15)
    return mac_dac(norm(v, 0.95))

# ------------------------------------------------------------------ room sounds
def mouse(down, seed):
    r = np.random.default_rng(seed)
    d = 0.06; nz = noise(d, r) * env_exp(d, 0.0018 if down else 0.0013, 0.0002)
    x = reson(nz, 2300 + r.random() * 300, 7) * 0.9 + reson(nz, 4800 + r.random() * 400, 10) * 0.5 + reson(nz, 900, 4) * 0.35
    x += np.sin(2 * np.pi * 260 * t_(d)) * env_exp(d, 0.006) * 0.25
    return norm(x, 0.5 if down else 0.32)

def key(kind, seed):
    """The 1984 keyboard: long travel, a deep thock, a plastic clack and a spring that pings."""
    r = np.random.default_rng(seed)
    d = 0.3; out = np.zeros(int(d * SR))
    g = {'space': 1.15, 'enter': 1.25, 'shift': 1.0}.get(kind, 0.85 + r.random() * 0.25)
    lowf = {'space': 135, 'enter': 160}.get(kind, 175 + r.random() * 50)
    nz = noise(0.06, r) * env_exp(0.06, 0.0045, 0.0003)
    clack = reson(nz, 1300 + r.random() * 700, 3.5) + 0.6 * reson(nz, 2900 + r.random() * 900, 5)
    tt = t_(0.09)
    thock = np.sin(2 * np.pi * lowf * (1 + 0.35 * np.exp(-tt / 0.008)) * tt) * env_exp(0.09, 0.016, 0.0008)
    ping = np.sin(2 * np.pi * (3300 + r.random() * 500) * t_(0.12)) * env_exp(0.12, 0.03, 0.0005) * 0.06
    press = np.zeros(int(0.12 * SR)); press[:len(clack)] += clack * 0.85; press[:len(thock)] += thock * 1.25; press[:len(ping)] += ping
    if kind == 'space':
        rat = reson(noise(0.07, r) * env_exp(0.07, 0.016), 800, 3) * 0.55; press[:len(rat)] += rat
    out[:len(press)] += press
    off = int((0.075 + r.random() * 0.04) * SR)
    nz2 = noise(0.04, r) * env_exp(0.04, 0.003, 0.0003)
    rel = reson(nz2, 1900 + r.random() * 600, 4) * 0.45 + np.sin(2 * np.pi * lowf * 1.3 * t_(0.04)) * env_exp(0.04, 0.008) * 0.3
    out[off:off + len(rel)] += rel
    if kind == 'shift':   # the shift key went down a moment before
        pre = np.zeros_like(out); s2 = key('key', seed + 9999) * 0.55; k2 = int(0.0 * SR); pre[:len(s2)] = s2[:len(pre)]
        out = np.roll(out, int(0.045 * SR)) + pre
    return norm(out, 0.5 * g)

def power_switch():
    nz = noise(0.12) * env_exp(0.12, 0.012, 0.0004)
    x = reson(nz, 420, 3) * 1.0 + reson(nz, 1400, 6) * 0.4
    tt = t_(0.25); thud = np.sin(2 * np.pi * (55 + 30 * np.exp(-tt / 0.03)) * tt) * env_exp(0.25, 0.07, 0.003)
    out = np.zeros(len(tt)); out[:len(x)] += x; out += thud * 0.8
    return norm(out, 0.6)

def crt_on():
    # the analog board energising: a soft thump and a brief rising buzz of the flyback settling
    d = 0.6; tt = t_(d)
    th = np.sin(2 * np.pi * 48 * tt) * env_exp(d, 0.09, 0.004) * 0.7
    bz = (np.sign(np.sin(2 * np.pi * 120 * tt)) * 0.3 + np.sin(2 * np.pi * 240 * tt) * 0.2)
    bz = lp(bz, 1500) * np.exp(-tt / 0.18) * 0.25
    return norm(th + bz, 0.5)

# ------------------------------------------------------------------ the 400K floppy drive
ZONES = [96.0, 104.0, 113.0, 123.0, 134.0]   # audible motor fundamental per speed zone (variable-speed drive)

def step_tick(r):
    d = 0.018; nz = noise(d, r) * env_exp(d, 0.0016, 0.0002)
    x = reson(nz, 2100 + r.random() * 500, 9) * 0.8 + reson(nz, 5200, 12) * 0.25
    x += np.sin(2 * np.pi * 380 * t_(d)) * env_exp(d, 0.004) * 0.35
    return x

def floppy(t0, dur, mode, seed):
    r = np.random.default_rng(seed)
    n = int(dur * SR); tt = np.arange(n) / SR
    # schedule seeks: (time, steps, new zone)
    seeks = []; zone = r.integers(0, 5)
    if mode == 'boot': rate, maxs = 3.2, 30
    elif mode == 'grind': rate, maxs = 5.5, 24
    elif mode == 'launch': rate, maxs = 2.8, 22
    elif mode == 'think': rate, maxs = 3.0, 10
    else: rate, maxs = 2.0, 8
    s = 0.12 + r.random() * 0.08
    while s < dur - 0.12:
        steps = int(2 + r.random() * maxs); seeks.append((s, steps, int(r.integers(0, 5))))
        s += steps * 0.0062 + (0.04 + r.random() * 0.5) / rate
    # motor frequency track with glides between zones (the drive changes speed as the head crosses zones)
    f = np.full(n, ZONES[zone])
    for (ts, steps, z) in seeks:
        i = int((ts + steps * 0.0062) * SR)
        if i < n: f[i:] = ZONES[z]
    f = uniform_filter1d(f, int(0.12 * SR), mode='nearest')
    up = np.clip(tt / 0.28, 0, 1) ** 0.7
    dn = np.clip((dur - tt) / 0.22, 0, 1)
    amp = up * dn
    ph = 2 * np.pi * np.cumsum(f * (0.6 + 0.4 * up)) / SR
    motor = np.zeros(n)
    for k, a in [(1, 1.0), (2, 0.7), (3, 0.45), (4, 0.35), (6, 0.22), (8, 0.18), (12, 0.08)]:
        motor += a * np.sin(k * ph + k * 0.7)
    motor = bp(motor, 80, 2400)
    hiss = bp(noise(dur, r), 1500, 6000) * 0.05 * (0.6 + 0.4 * np.sin(ph / 3) ** 2)
    rumble = lp(noise(dur, r), 160) * 0.35
    body = (motor * 0.32 + hiss + rumble * 0.4) * amp
    out = body.copy()
    # head-load clack at the start
    cl = noise(0.03, r) * env_exp(0.03, 0.003); cl = reson(cl, 1300, 5) * 0.8 + reson(cl, 600, 3) * 0.6
    out[:len(cl)] += cl * 0.9
    # stepper ratchets
    for (ts, steps, z) in seeks:
        for k in range(steps):
            i = int((ts + k * 0.0062) * SR); x = step_tick(r) * (0.55 + 0.45 * r.random())
            if i + len(x) < n: out[i:i + len(x)] += x
    return out

# ------------------------------------------------------------------ render cues
T_ON = T_BLACK = None
for c in CUES:
    t, s = c['t'], c['s']
    if s == 'power': add(t, power_switch(), 0.8, -0.1)
    elif s == 'boot': add_spk(t, boot_tone(), 0.85); T_ON = t
    elif s == 'crt': add(t, crt_on(), 0.5)
    elif s == 'beep': add_spk(t, alert_beep(), 0.8)
    elif s == 'crunch': add_spk(t, crunch(), 0.9); T_BLACK = t + 0.3
    elif s == 'mdown': add(t, mouse(True, int(t * 1000)), 0.95, 0.3)
    elif s == 'mup': add(t, mouse(False, int(t * 1000) + 1), 0.95, 0.3)
    elif s == 'key':
        k = c.get('k', 'key'); sd = c.get('seed', 0)
        add(t - (0.045 if k == 'shift' else 0), key(k, sd), 0.8, -0.12 + 0.18 * ((sd % 7) / 7 - 0.5))
    elif s == 'floppy':
        g = {'boot': 0.5, 'launch': 0.5, 'grind': 0.5, 'think': 0.42, 'seek': 0.32}.get(c.get('mode'), 0.45)
        add(t, floppy(t, c['dur'], c.get('mode', 'seek'), c.get('seed', 1)), g, 0.22)

# speaker bus -> cone -> room
def room_ir():
    d = 0.32; tt = t_(d)
    ir = rng.standard_normal(len(tt)) * np.exp(-tt / 0.055); ir = lp(ir, 4500); ir[0] = 0
    ir = ir / np.sqrt(np.sum(ir ** 2)) * 0.22; ir[0] = 1.0
    return ir
IR = room_ir()
spk = signal.fftconvolve(speaker(SPK), IR)[:N]
L += spk * 0.9; Rr += spk * 0.9
# the mechanical sounds also get a touch of room
Lr = signal.fftconvolve(L, IR * 0.5)[:N] * 0.35; Rrr = signal.fftconvolve(Rr, IR[::1] * 0.5)[:N] * 0.35
L += Lr; Rr += Rrr

# room tone: quiet room, the compact Mac's analog board buzz and the CRT's faint whine (no fan in a 128K)
tt = np.arange(N) / SR
room = lp(rng.standard_normal(N), 900, 2) * 0.012 + bp(rng.standard_normal(N), 2000, 7000) * 0.0025
on = np.clip((tt - (T_ON or 0.3)) / 0.4, 0, 1) * (tt < (T_BLACK or DUR)) if True else 1
hum = (np.sin(2 * np.pi * 60 * tt) * 0.5 + np.sin(2 * np.pi * 120 * tt) * 0.3 + np.sin(2 * np.pi * 180 * tt) * 0.25 + np.sin(2 * np.pi * 360 * tt) * 0.12) * 0.0035
whine = np.sin(2 * np.pi * 15570 * tt) * 0.0022
L += room + (hum + whine) * on; Rr += room * 0.97 + np.roll(room, 41) * 0.03 + (hum + whine) * on

st = np.stack([L, Rr], 1)[: int(DUR * SR)]
f = int(0.01 * SR); st[:f] *= np.linspace(0, 1, f)[:, None]
fo = int(0.9 * SR); st[-fo:] *= (np.linspace(1, 0, fo) ** 2)[:, None]

# ------------------------------------------------------------------ levelling (narrow LRA) + master
def kweight(x):
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x))

def lufs(st):
    k = np.stack([kweight(st[:, 0]), kweight(st[:, 1])], 1)
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    p = np.array([np.sum(np.mean(k[i:i + blk] ** 2, 0)) for i in range(0, len(k) - blk, hop)])
    l = -0.691 + 10 * np.log10(p + 1e-20); g = p[l > -70]
    rel = -0.691 + 10 * np.log10(np.mean(g)) - 10
    return -0.691 + 10 * np.log10(np.mean(p[(l > -70) & (l > rel)]))

# 1) fast compressor on the transient-heavy mechanical sounds (keys, clicks)
def compress(st, thr_db, ratio, att, rel, win=0.004):
    mono = np.max(np.abs(st), 1)
    env = np.sqrt(np.maximum(uniform_filter1d(mono ** 2, max(1, int(win * SR))), 0))
    lvl = 20 * np.log10(env + 1e-9)
    gr = np.minimum(0, (thr_db - lvl) * (1 - 1 / ratio))
    a = np.exp(-1 / (att * SR)); r_ = np.exp(-1 / (rel * SR))
    out = np.empty_like(gr); cur = 0.0
    for i in range(len(gr)):
        g = gr[i]; cur = a * cur + (1 - a) * g if g < cur else r_ * cur + (1 - r_) * g; out[i] = cur
    return st * db(out)[:, None]

# 2) slow leveller: lift quiet passages towards the programme level (like a recorder's gentle AGC)
def level(st, target_db, max_up, max_down, win=1.5):
    k = np.stack([kweight(st[:, 0]), kweight(st[:, 1])], 1)
    p = np.maximum(uniform_filter1d(np.sum(k ** 2, 1), int(win * SR)), 1e-12)
    lv = 10 * np.log10(p + 1e-12)
    g = np.clip(target_db - lv, -max_down, max_up) * 0.75
    g = uniform_filter1d(g, int(0.8 * SR))
    return st * db(g)[:, None]

st = st / (np.max(np.abs(st)) + 1e-9) * 0.5
L0 = lufs(st)
st = compress(st, L0 + 9, 3.0, 0.0008, 0.06)
L0 = lufs(st)
st = level(st, L0, 9.0, 4.0)

def true_peak(st):
    return max(np.max(np.abs(signal.resample_poly(st[:, c], 4, 1))) for c in range(2))

def limit(st, ceiling):
    os4 = np.stack([signal.resample_poly(st[:, c], 4, 1) for c in range(2)], 1)
    pk = np.max(np.abs(os4), 1).reshape(-1, 4).max(1)[: len(st)]
    pk = np.pad(pk, (0, len(st) - len(pk)))
    need = np.minimum(1.0, ceiling / np.maximum(pk, 1e-9))
    look = int(0.003 * SR)
    g = minimum_filter1d(need, size=2 * look + 1)
    rel = np.exp(-1 / (0.08 * SR)); out = np.empty_like(g); cur = 1.0
    for i in range(len(g)):
        cur = g[i] if g[i] < cur else cur * rel + g[i] * (1 - rel); out[i] = cur
    out = np.convolve(out, np.ones(look) / look, mode='same')
    return st * out[:, None]

target = -16.0
for it in range(5):
    st = st * db(target - lufs(st))
    if true_peak(st) > db(-1.6): st = limit(st, db(-1.8))
    lv, tp = lufs(st), 20 * np.log10(true_peak(st))
    print(f'pass {it}: {lv:.2f} LUFS, true peak {tp:.2f} dBTP')
    if abs(lv - target) < 0.1 and tp < -1.2: break
from scipy.io import wavfile
wavfile.write(out_path, SR, st.astype(np.float32))
print('written', out_path, len(st) / SR, 's')
