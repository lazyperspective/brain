# Original score + sound design for "Everywhere I look, I see Claude". 120 BPM "tiny spy caper" in A minor:
# plucked (Karplus-Strong) bass, brushed funk kit, marimba hook, chiptune accents. Every cut is on a beat; the music stops
# dead at the summit; one stinger after the cut to black. Writes music.wav, sfx.wav, mix_raw.wav (48 kHz stereo).
import numpy as np, scipy.io.wavfile as wavf, scipy.signal as sg, sys
sys.path.insert(0, '/home/user/brain/everywhere-claude/v2')
import edit
SR = 48000; BPM = 120; BEAT = 60 / BPM
ST, NFR = edit.starts(); DUR = (NFR + edit.BLACK_TAIL) / 30.0
N = int(DUR * SR)
rng = np.random.default_rng(7)
MUSIC_END = ST['summit']                     # music stops dead here
T_STING = NFR / 30.0                          # cut to black

def buf(): return np.zeros((N, 2), np.float32)
def place(dst, x, t, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= N or i + len(x) <= 0: return
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l, x * r], 1) * 1.414
    a, b = max(0, i), min(N, i + len(x))
    dst[a:b] += x[a - i:b - i] * gain
def env(n, a=0.002, d=0.2, s=0.0, curve=4.0):
    t = np.arange(n) / SR; e = np.minimum(1, t / max(a, 1e-4)) * (s + (1 - s) * np.exp(-np.maximum(0, t - a) / d * curve / 4))
    return e.astype(np.float32)
def hz(note):   # 'A4' etc
    names = {'C': -9, 'C#': -8, 'Db': -8, 'D': -7, 'D#': -6, 'Eb': -6, 'E': -5, 'F': -4, 'F#': -3, 'Gb': -3, 'G': -2, 'G#': -1, 'Ab': -1, 'A': 0, 'A#': 1, 'Bb': 1, 'B': 2}
    n, o = note[:-1], int(note[-1]); return 440.0 * 2 ** ((names[n] + 12 * (o - 4)) / 12)
def lp(x, f, o=2): b, a = sg.butter(o, f / (SR / 2)); return sg.lfilter(b, a, x).astype(np.float32)
def hp(x, f, o=2): b, a = sg.butter(o, f / (SR / 2), 'high'); return sg.lfilter(b, a, x).astype(np.float32)
def bp(x, f1, f2, o=2): b, a = sg.butter(o, [f1 / (SR / 2), f2 / (SR / 2)], 'band'); return sg.lfilter(b, a, x).astype(np.float32)

# ---------------- instruments ----------------
def pluck_bass(f, dur=0.45, bright=0.55):
    n = int(dur * SR); p = max(2, int(SR / f)); x = np.zeros(n, np.float32)
    x[:p] = (rng.random(p) * 2 - 1) * np.hanning(p) ; y = np.zeros(n, np.float32)
    for i in range(n):
        y[i] = x[i] + (0.5 * (y[i - p] + y[i - p - 1]) * (0.996 if bright > 0.5 else 0.993) if i > p else 0)
    y = lp(y, 900 + 1800 * bright)
    sub = np.sin(2 * np.pi * f * np.arange(n) / SR) * env(n, 0.004, dur * 0.6) * 0.5
    return (y / (np.abs(y).max() + 1e-6) * 0.7 + sub) * env(n, 0.001, dur * 0.9, curve=3)
def marimba(f, dur=0.35):
    n = int(dur * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 9) + 0.35 * np.sin(2 * np.pi * f * 4.0 * t) * np.exp(-t * 30) + 0.12 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t * 60)
    x[:int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    return x.astype(np.float32) * 0.6
def square(f, dur, duty=0.25, vib=0.0):
    t = np.arange(int(dur * SR)) / SR; ph = (f * t + vib * np.sin(2 * np.pi * 6 * t) * 0.02) % 1
    return ((ph < duty) * 2 - 1).astype(np.float32) * 0.18
def saw_chord(fs, dur):
    t = np.arange(int(dur * SR)) / SR; x = sum(2 * ((f * t * (1 + d)) % 1) - 1 for f in fs for d in (-0.004, 0.004))
    return lp(x.astype(np.float32), 2400) * env(len(t), 0.005, dur * 0.5, curve=3) * 0.08
def kick(g=1.0):
    n = int(0.32 * SR); t = np.arange(n) / SR; f = 48 + 110 * np.exp(-t * 32)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) + 0.25 * (rng.random(n) * 2 - 1) * np.exp(-t * 300)
    return x.astype(np.float32) * 0.9 * g
def snare(g=1.0, brush=True):
    n = int(0.25 * SR); t = np.arange(n) / SR; nz = rng.random(n) * 2 - 1
    x = bp(nz.astype(np.float32), 1500, 7500) * np.exp(-t * (14 if brush else 24)) * 0.7 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.35
    return x.astype(np.float32) * g
def hat(g=1.0, open_=False):
    n = int((0.25 if open_ else 0.06) * SR); t = np.arange(n) / SR
    x = hp((rng.random(n) * 2 - 1).astype(np.float32), 7000) * np.exp(-t * (12 if open_ else 70))
    return x * 0.35 * g
def tom(f, g=1.0):
    n = int(0.3 * SR); t = np.arange(n) / SR; ff = f * (1 + 0.6 * np.exp(-t * 20))
    return (np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-t * 10)).astype(np.float32) * 0.6 * g

music = buf(); sfx = buf()
def mt(t): return t < MUSIC_END - 0.01
# freeze drop-outs (1 beat): the music holds its breath on the big "caught" moments
FREEZE = [(ST['logpile'] + 1.5, ST['logpile'] + 2.0), (ST['pole'] + 1.0, ST['pole'] + 1.5)]
def frozen(t): return any(a <= t < b for a, b in FREEZE)

# ---------------- score ----------------
CHORDS = ['A', 'A', 'F', 'E']          # per bar (2 s), cycling
ROOT = {'A': 'A1', 'F': 'F1', 'E': 'E1', 'D': 'D2'}
bass_pat = [(0, 0, 0.4), (0.75, 12, 0.2), (1.0, 7, 0.3), (1.5, 0, 0.25), (1.75, 10, 0.2), (2.5, 0, 0.3), (3.0, 12, 0.25), (3.5, 7, 0.3)]   # (beat, semitones, dur)
nbars = int(np.ceil(MUSIC_END / (4 * BEAT)))
pole0, pole1 = ST['pole'], ST['fl1']
for b in range(nbars):
    t0 = b * 4 * BEAT; ch = CHORDS[b % 4]; rf = hz(ROOT[ch])
    intense = 1.0 if t0 < ST['bales'] else (1.15 if t0 < pole0 else 1.3)
    for be, semi, d in bass_pat:
        t = t0 + be * BEAT
        if not mt(t) or frozen(t): continue
        if t >= pole1: continue
        place(music, pluck_bass(rf * 2 ** (semi / 12), d + 0.1, 0.6 if t > pole0 else 0.45), t, 0.55, -0.05)
    # drums: funk pattern with swing on the 16ths
    for s16 in range(16):
        t = t0 + s16 * BEAT / 4 + (0.035 if s16 % 2 else 0)
        if not mt(t) or frozen(t) or t >= pole1: continue
        if s16 in (0, 6, 10) or (t > pole0 + 2.5 and s16 in (0, 4, 8, 10, 12)): place(music, kick(0.9), t, 0.6)
        if s16 in (4, 12): place(music, snare(1.0), t, 0.45, 0.1)
        if s16 in (7, 15) and intense > 1.1: place(music, snare(0.25), t, 0.45, 0.1)
        place(music, hat(0.55 if s16 % 4 else 0.85, open_=(s16 == 14 and t > pole0)), t, 0.35 * intense, 0.35)
# marimba hook (2-bar call, 2-bar answer), spy-ish chromatic line
HOOK = [(0, 'A4', .3), (0.5, 'C5', .3), (1, 'E5', .3), (1.5, 'D#5', .25), (1.75, 'E5', .3), (2.5, 'C5', .3), (3, 'A4', .5),
        (4, 'E5', .3), (4.5, 'G5', .3), (5, 'F5', .3), (5.5, 'E5', .3), (6, 'D5', .3), (6.5, 'B4', .3), (7, 'G#4', .4), (7.5, 'B4', .3)]
for rep in range(int(np.ceil(MUSIC_END / (8 * BEAT)))):
    for be, nt, d in HOOK:
        t = rep * 8 * BEAT + be * BEAT
        if not mt(t) or frozen(t) or pole0 + 2.3 <= t < pole0 + 5.6 or t >= pole1: continue
        place(music, marimba(hz(nt), d + 0.2), t, 0.33, -0.25)
        if pole0 <= t < pole1:       # chip lead doubles the hook in the set piece
            place(music, square(hz(nt) * 2, d * 0.8) * env(int(d * 0.8 * SR), 0.003, d * 0.6), t, 0.22, 0.3)
# chiptune arps under Act 2
for b in range(nbars):
    t0 = b * 4 * BEAT
    if not (ST['bales'] <= t0 < pole0): continue
    ch = CHORDS[b % 4]; tones = {'A': ['A5', 'C6', 'E6'], 'F': ['F5', 'A5', 'C6'], 'E': ['E5', 'G#5', 'B5']}[ch]
    for i in range(16):
        t = t0 + i * BEAT / 4
        if mt(t) and not frozen(t): place(music, square(hz(tones[i % 3]), 0.09, 0.5) * env(int(0.09 * SR), 0.001, 0.05), t, 0.08, 0.4)
# zip-line section: driving 8th bass + noise riser into the car pass, saw stabs on the landing + fist pumps
zip0, zip1 = pole0 + 2.3, pole0 + 5.6
for i in range(int((zip1 - zip0) / (BEAT / 2))):
    t = zip0 + i * BEAT / 2
    place(music, pluck_bass(hz('A1') * (2 if i % 2 else 1), 0.25, 0.7), t, 0.45)
rn = int((zip1 - zip0) * SR); tt = np.arange(rn) / SR
riser = bp((rng.random(rn) * 2 - 1).astype(np.float32), 400, 6000) * (tt / tt[-1]) ** 2 * 0.25
place(music, riser, zip0, 0.6)
for t, g in ((pole0 + 5.58, 1.0), (pole0 + 6.0, 0.9), (pole0 + 6.4, 1.0)):
    place(music, saw_chord([hz('A3'), hz('C#4'), hz('E4'), hz('A4')], 0.5), t, 1.0); place(music, kick(1.0), t, 0.7)
# flurry: drum fill (toms + snare roll crescendo) on 16ths, chip blips on each glimpse
f0 = ST['fl1']
for i in range(int((MUSIC_END - f0) / (BEAT / 4))):
    t = f0 + i * BEAT / 4; u = i / ((MUSIC_END - f0) / (BEAT / 4))
    place(music, tom([196, 165, 131, 110][(i // 2) % 4], 0.6 + 0.6 * u) if i % 2 == 0 else snare(0.4 + 0.8 * u, brush=False), t, 0.5)
    if i % 4 == 0: place(music, kick(0.8), t, 0.6)
for n in ('fl1', 'fl2', 'fl3', 'fl4'):
    place(music, square(hz('E6'), 0.07, 0.5), ST[n], 0.18); place(music, square(hz('A6'), 0.07, 0.5), ST[n] + 0.07, 0.18)
# hard stop at the summit (no tail): 10 ms fade to avoid a click
i0 = int(MUSIC_END * SR); music[i0:] = 0; music[i0 - 480:i0] *= np.linspace(1, 0, 480)[:, None]
# stinger after the cut to black: chiptune "ta-da" (A major) + kick + crash
st = T_STING + 0.12
for j, nt in enumerate(['A5', 'C#6', 'E6']):
    place(music, square(hz(nt), 0.08, 0.5), st + j * 0.06, 0.22)
place(music, square(hz('A6'), 0.9, 0.5, vib=1) * env(int(0.9 * SR), 0.002, 0.5), st + 0.2, 0.22)
place(music, marimba(hz('A5'), 1.2) + marimba(hz('E5'), 1.2), st + 0.2, 0.5)
place(music, kick(1.0), st + 0.2, 0.7)
cn = int(1.2 * SR); ct = np.arange(cn) / SR
place(music, hp((rng.random(cn) * 2 - 1).astype(np.float32), 5000) * np.exp(-ct * 3.5) * 0.35, st + 0.2, 0.6)

# ---------------- SFX ----------------
def bip(t, g=1.0):          # phone-camera focus "bip": two quick tones
    for k, f in enumerate((2093, 2637)):
        n = int(0.05 * SR); tt = np.arange(n) / SR
        place(sfx, (np.sin(2 * np.pi * f * tt) * env(n, 0.001, 0.03)).astype(np.float32) * 0.22 * g, t + k * 0.055, 1.0, 0.15)
def boing(t, f0=180, f1=520, d=0.35, g=1.0):
    n = int(d * SR); tt = np.arange(n) / SR; f = f0 + (f1 - f0) * (1 - np.exp(-tt * 14)) + 25 * np.sin(2 * np.pi * 14 * tt)
    place(sfx, (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 7)).astype(np.float32) * 0.3 * g, t)
def step(t, g=1.0, pan=0.0):
    n = int(0.03 * SR); tt = np.arange(n) / SR
    x = bp((rng.random(n) * 2 - 1).astype(np.float32), 1800, 6000) * np.exp(-tt * 180) + np.sin(2 * np.pi * 900 * tt) * np.exp(-tt * 200) * 0.4
    place(sfx, x * 0.35 * g, t, 1.0, pan)
def whoosh(t, d=0.35, f0=500, f1=3000, g=1.0, pan=0.0):
    n = int(d * SR); tt = np.arange(n) / SR; nz = (rng.random(n) * 2 - 1).astype(np.float32)
    out = np.zeros(n, np.float32); seg = 256
    for a in range(0, n, seg):
        u = a / n; fc = f0 + (f1 - f0) * u
        out[a:a + seg] = bp(nz[max(0, a - 512):a + seg], max(80, fc * 0.6), min(20000, fc * 1.6), 1)[-len(out[a:a + seg]):]
    place(sfx, out * np.sin(np.pi * tt / d) ** 1.5 * 0.5 * g, t, 1.0, pan)
def clank(t, g=1.0):
    n = int(0.9 * SR); tt = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt * k) * a for f, k, a in ((310, 6, 1), (742, 9, 0.7), (1187, 12, 0.5), (1931, 16, 0.35), (2870, 22, 0.2)))
    x += lp((rng.random(n) * 2 - 1).astype(np.float32), 3000) * np.exp(-tt * 40) * 0.8
    place(sfx, x.astype(np.float32) * 0.32 * g, t)
def tick(t, f=4200, g=1.0):
    n = int(0.015 * SR); tt = np.arange(n) / SR; place(sfx, np.sin(2 * np.pi * f * tt) * np.exp(-tt * 300) * 0.25 * g, t)
def chime(t, f=1568, g=1.0):
    n = int(0.8 * SR); tt = np.arange(n) / SR
    place(sfx, ((np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(2 * np.pi * f * 2.76 * tt)) * np.exp(-tt * 6)).astype(np.float32) * 0.13 * g, t, 1.0, 0.3)
def glitch(t, d=0.12, g=1.0):
    n = int(d * SR); x = (rng.random(n) * 2 - 1).astype(np.float32)
    x = np.repeat(x[::40], 40)[:n] * (np.sign(np.sin(np.arange(n) / SR * 2 * np.pi * 220))) ; x = np.round(x * 4) / 4
    place(sfx, x * 0.18 * g, t)
def chirp(t, g=1.0):   # cheery "hi!" chirp
    n = int(0.22 * SR); tt = np.arange(n) / SR; f = 900 + 700 * np.sin(np.pi * tt / 0.22)
    place(sfx, (np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.005, 0.15)).astype(np.float32) * 0.18 * g, t, 1.0, -0.1)
def creak(t, d=0.4, g=1.0):
    n = int(d * SR); tt = np.arange(n) / SR; f = 140 + 60 * np.sin(2 * np.pi * 3 * tt)
    x = (np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-((tt - d / 2) / (d / 3)) ** 2)).astype(np.float32)
    place(sfx, bp(x, 300, 2500) * 0.05 * g, t)

R = ST['roof']
for i in range(int(1.5 * 7.6)): step(R + i / 7.6, 0.6, 0.1)                  # sprint patter
whoosh(R + 0.55, 0.3, 600, 2200, 0.5)                                       # chimney hop
bip(R + 1.42); whoosh(R + 1.5, 0.25, 3000, 900, 0.7)                        # caught, skid
boing(R + 1.72, 300, 120, 0.25, 0.7)                                         # drop behind the ridge
L = ST['logpile']; bip(L + 1.38); boing(L + 1.45, 520, 260, 0.3, 0.5)
P = ST['phone']
for i in range(5): tick(P + 0.05 + i * 0.09, 3600, 0.6)                    # thumbing the phone
bip(P + 0.55); whoosh(P + 0.72, 0.2, 2000, 4000, 0.4)
M = ST['manhole']
for i in range(5): tick(M + 0.05 + i * 0.035, 1400 + 300 * (i % 2), 0.9)  # lid rattle
creak(M + 0.22, 0.3); bip(M + 0.74); whoosh(M + 1.0, 0.12, 2500, 500, 0.5); clank(M + 1.10)
B = ST['bales']; tick(B + 0.92, 2400, 0.7); bip(B + 1.12); boing(B + 1.25, 200, 700, 0.18, 0.6)
whoosh(B + 1.33, 0.3, 800, 4000, 0.9, -0.4)
for i in range(4): step(B + 1.33 + i * 0.045, 0.7, -0.3)
glitch(B + 1.50, 0.1)
S = ST['shoes']
for i in range(6): step(S + 0.05 + i * 0.24, 0.5, -0.2)
chirp(S + 0.84)
G = ST['garland']; chime(G + 1.0, 1568); chime(G + 1.25, 2093); bip(G + 1.36, 0.5)
Pp = ST['pole']
creak(Pp + 0.2, 0.5, 0.6); creak(Pp + 0.8, 0.5, 0.5)
bip(Pp + 0.98)
for k in range(3): whoosh(Pp + 1.48 + k * 0.18, 0.18, 400, 1200, 0.35)      # pumping the swing
boing(Pp + 2.0, 160, 640, 0.35, 0.9); whoosh(Pp + 2.0, 0.3, 800, 3000, 0.8)  # release leap
boing(Pp + 2.3, 420, 220, 0.25, 0.7)                                          # strap catches the wire
zn = int(3.3 * SR); zt = np.arange(zn) / SR
zf = 700 + 900 * np.clip(zt / 1.6, 0, 1) - 500 * np.clip((zt - 1.6) / 1.7, 0, 1)
zw = np.sin(2 * np.pi * np.cumsum(zf) / SR) * (0.6 + 0.4 * np.sin(2 * np.pi * 37 * zt)) + 0.5 * bp((rng.random(zn) * 2 - 1).astype(np.float32), 2000, 7000)
zw = zw * np.minimum(1, zt / 0.05) * np.clip((3.3 - zt) / 0.4, 0, 1) * (1 - 0.5 * np.clip((zt - 1.6) / 1.7, 0, 1))
place(sfx, zw.astype(np.float32) * 0.07, Pp + 2.3, 1.0, 0.2)                 # zzzip
boing(Pp + 5.58, 300, 110, 0.3, 0.9)                                          # lands on the pole
for t in (6.0, 6.4): whoosh(Pp + t - 0.05, 0.15, 600, 2500, 0.5)
Fl = [ST[n] for n in ('fl1', 'fl2', 'fl3', 'fl4')]
chime(Fl[0] + 0.05, 2637, 0.7); tick(Fl[1] + 0.27, 3000)
for i in range(3): step(Fl[2] + i * 0.08, 0.6)
glitch(Fl[3] + 0.13, 0.11)
Su = ST['summit']
wn = int((T_STING - Su) * SR); wt = np.arange(wn) / SR                       # summit wind bed + rising tension tone
wind = lp((rng.random(wn) * 2 - 1).astype(np.float32), 500) * (0.5 + 0.3 * np.sin(2 * np.pi * 0.3 * wt)) * 0.22
place(sfx, wind, Su, 1.0)
tn = int(2.8 * SR); tt = np.arange(tn) / SR
tone = (np.sin(2 * np.pi * (220 + 110 * tt / 2.8) * tt) * 0.5 + np.sin(2 * np.pi * (330 + 165 * tt / 2.8) * tt) * 0.3) * (tt / 2.8) ** 2 * 0.05
place(sfx, tone.astype(np.float32), Su, 1.0)
bip(Su + 2.8, 0.7)
whoosh(Su + 3.45, 0.3, 1500, 600, 0.35)
chirp(Su + 3.95, 1.0); chirp(Su + 4.35, 0.7)
n = int(0.18 * SR); tt = np.arange(n) / SR                                    # the final "boop"
boop = np.sin(2 * np.pi * np.cumsum(330 + 330 * np.exp(-tt * 30)) / SR) * env(n, 0.003, 0.1)
place(sfx, boop.astype(np.float32) * 0.35, Su + 5.15); boing(Su + 5.2, 260, 520, 0.22, 0.4)

# ---------------- real sounds ----------------
def load(p):
    sr, x = wavf.read(p); x = x.astype(np.float32) / 32768.0; return x
car = load('/home/user/brain/everywhere-claude/v2/audio/car_1661.wav')
car = np.stack([hp(car[:, c], 160, 4) for c in range(2)], 1)
# film time = pole start + (src - 2.4) for src >= 6.7 ; the file starts at src 5.5
cs = int((6.6 - 5.5) * SR); car = car[cs:] ; cn = len(car); car *= np.minimum(1, np.arange(cn) / (0.25 * SR))[:, None]
place(sfx, car * 3.2, Pp + (6.6 - 2.4))
crowd = load('/home/user/brain/everywhere-claude/v2/audio/crowd_1623.wav')
crowd = np.stack([hp(crowd[:, c], 200, 4) for c in range(2)], 1)
seg = crowd[int(1.6 * SR):int(3.1 * SR)]; fd = np.minimum(1, np.minimum(np.arange(len(seg)), len(seg) - np.arange(len(seg))) / (0.15 * SR))[:, None]
place(sfx, seg * fd * 2.0, ST['garland'])
seg2 = crowd[int(4.3 * SR):int(4.3 * SR) + int(0.3 * SR)]; fd2 = np.minimum(1, np.minimum(np.arange(len(seg2)), len(seg2) - np.arange(len(seg2))) / (0.03 * SR))[:, None]
place(sfx, seg2 * fd2 * 2.0, ST['fl3'])

mix = music * 0.85 + sfx * 1.5
for name, x in (('music', music), ('sfx', sfx), ('mix_raw', mix)):
    y = x / max(1.0, np.abs(mix).max() * 1.05)
    wavf.write(f'/home/user/brain/everywhere-claude/v2/audio/{name}.wav', SR, (y * 32767).astype(np.int16))
print('duration', DUR, 'peak', np.abs(mix).max())
