#!/usr/bin/env python3
"""Programmatic listen-check for score_sfx.wav + stems (run after make_audio.py)."""
import os
import sys
import json
import numpy as np
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from make_audio import integrated_lufs, k_weight, DIALOGUE  # noqa: E402

SR = 48000


def load(name):
    info = sf.info(os.path.join(HERE, name))
    x, sr = sf.read(os.path.join(HERE, name), dtype='float64', always_2d=True)
    return info, x.T


def dbfs(v):
    return 20 * np.log10(max(v, 1e-10))


def seg(x, a, b):
    return x[:, int(round(a * SR)):int(round(b * SR))]


def rms_db(x, a, b):
    s = seg(x, a, b)
    return dbfs(np.sqrt(np.mean(s ** 2)))


def peak_db(x, a, b):
    return dbfs(np.max(np.abs(seg(x, a, b))))


def mom_lufs(xk, t):
    """momentary loudness (400 ms) ending ~ at t+0.2, from pre-K-weighted signal"""
    s = seg(xk, t - 0.2, t + 0.2)
    return -0.691 + 10 * np.log10(np.sum(np.mean(s ** 2, axis=1)) + 1e-20)


def onset(x, t, win=0.08, min_jump_db=4.0, hpf=True):
    """time of the largest level jump (2 ms frame vs. max of the previous 10 ms) within +-win of t.
    Works with overlapping material (a bell still ringing, music underneath). None = no transient (designed swell)."""
    a, b = int((t - win - 0.02) * SR), int((t + win + 0.004) * SR)
    sos = signal.butter(2, 1500 if hpf else 20, 'high', fs=SR, output='sos')
    m = np.zeros(x.shape[1])
    m[a - 4800:b] = np.max(np.abs(signal.sosfilt(sos, x[:, a - 4800:b], axis=1)), axis=0)
    hop = int(0.002 * SR)
    fr = m[a:b][: (b - a) // hop * hop].reshape(-1, hop)
    env = np.maximum(20 * np.log10(np.sqrt(np.mean(fr ** 2, axis=1)) + 1e-9), -90.0)  # floor: ignore dither switching on
    tt = (t - win - 0.02) + np.arange(len(env)) * hop / SR
    jump = np.full(len(env), -99.0)
    for i in range(5, len(env)):
        jump[i] = env[i] - env[i - 5:i].max()
    i = int(np.argmax(jump))
    return (tt[i] - t) if jump[i] >= min_jump_db else None


def env_peak(x, t, win=0.25):
    """time of the 20 ms-RMS maximum near t (for whooshes whose cue is their peak)"""
    s = seg(x, t - win, t + win)
    e = np.sqrt(signal.convolve(np.mean(s ** 2, axis=0), np.ones(960) / 960, mode='same'))
    return (np.argmax(e) / SR) - win


def main():
    rep = {}
    info, mix = load('score_sfx.wav')
    stems = {}
    for s in ('music', 'sfx', 'amb'):
        i2, stems[s] = load(f'{s}.wav')
        rep[f'{s}.wav'] = dict(sr=i2.samplerate, ch=i2.channels, dur=i2.frames / i2.samplerate, subtype=i2.subtype,
                               peak_dbfs=round(dbfs(np.max(np.abs(stems[s]))), 2))
    up = signal.resample_poly(mix, 4, 1, axis=1)
    rep['score_sfx.wav'] = dict(sr=info.samplerate, ch=info.channels, frames=info.frames, dur=info.frames / info.samplerate,
                                subtype=info.subtype, peak_dbfs=round(dbfs(np.max(np.abs(mix))), 2),
                                true_peak_dbtp_4x=round(dbfs(np.max(np.abs(up))), 2),
                                integrated_lufs=round(integrated_lufs(mix), 2))
    resid = mix - (stems['music'] + stems['sfx'] + stems['amb'])
    rep['stems_sum_residual_dbfs'] = round(dbfs(np.max(np.abs(resid))), 1)
    xk = k_weight(mix)

    # key moments: momentary loudness (LUFS, 400 ms) and peak (dBFS) in a short window
    moments = [('0.5 rain fading in', 0.5, 0.4), ('10.0 Emberwick + rain', 10.0, 1.0), ('29.0 music+rain+fire (pre-cut)', 29.5, 1.0),
               ('30.6-32.3 rain-stop silence', 31.45, 1.7), ('34.5 glyph shimmer', 34.5, 1.0), ('38.8 under whisper', 38.8, 0.8),
               ('46.0 white wave', 46.0, 1.0), ('58.2 IMPACT', 58.3, 0.2), ('63.5 near silence (white)', 63.5, 1.5),
               ('69.1 sword ignites', 69.15, 0.3), ('81.4 SLASH', 81.4, 0.2), ('81.6-82.6 hard-cut silence', 82.1, 0.95),
               ('82.6 braam', 82.75, 0.3), ('87.0 title theme', 87.0, 1.0), ('92.6-93.0 silence', 92.8, 0.38),
               ('96.5 temple bell', 96.6, 0.3), ('108 vault (under dlg)', 108.0, 1.0), ('113.0 GLASS', 113.1, 0.2),
               ('115.0 slow-mo', 115.0, 0.8), ('120 chase', 120.0, 1.0), ('125 chase under dialogue', 125.0, 1.0),
               ('145 chase climax', 145.0, 1.0), ('156 bridge (dialogue)', 156.0, 1.0), ('170 the fall', 170.0, 1.0),
               ('178.0 crate IMPACT', 178.1, 0.2), ('190.0 tense silence', 190.0, 1.0), ('203.0 ANCHOR', 203.1, 0.2),
               ('204.2 hero hold', 204.2, 1.0), ('215.2 splash', 215.3, 0.2), ('229.5 hush returns', 229.5, 1.5),
               ('260.0 BELL TOLL', 260.1, 0.2), ('265 bell lord dialogue bed', 265.0, 1.0), ('282 strain under dialogue', 282.0, 1.0),
               ('285.5 wall breaks', 285.6, 0.2), ('290.0 riser peak', 290.4, 0.6), ('290.85-291.9 drop to near silence', 291.4, 1.0),
               ('292.2 armoured step', 292.3, 0.2), ('297.2 sting', 297.4, 0.4), ('298.5-300 silence', 299.25, 1.45)]
    rows = []
    for name, t, w in moments:
        rows.append(dict(moment=name, rms_dbfs=round(rms_db(mix, t - w / 2, t + w / 2), 1),
                         peak_dbfs=round(peak_db(mix, t - w / 2, t + w / 2), 1),
                         momentary_lufs=round(mom_lufs(xk, t), 1)))
    rep['moments'] = rows

    # sections (whole-mix RMS)
    secs = [(0, 30.6), (30.6, 41.4), (41.4, 48), (48, 55), (55, 60), (60, 65), (65, 74), (74, 81.6), (82.6, 92.6), (93, 104),
            (104, 113), (113, 118), (118, 148.3), (148.3, 166), (166, 176), (176, 182), (182, 197), (197, 214), (214, 221),
            (221, 228.5), (228.5, 246), (246, 262), (262, 276), (276, 290.8), (290.8, 298.5), (298.5, 300)]
    rep['sections_rms_dbfs'] = {f'{a}-{b}': round(rms_db(mix, a, b), 1) for a, b in secs}

    # ducking: music RMS inside dialogue windows vs. 1 s before each window
    d_in, d_out = [], []
    for a, b in DIALOGUE:
        if a < 1.5:
            continue
        mi = rms_db(stems['music'], a + 0.15, b - 0.05) if b - a > 0.3 else None
        mo = rms_db(stems['music'], a - 1.2, a - 0.25)
        if mi is not None and mi > -80 and mo > -80:
            d_in.append(mi)
            d_out.append(mo)
    rep['music_rms_in_dialogue_vs_before_db'] = round(float(np.mean(np.array(d_in) - np.array(d_out))), 1)

    # sync: onsets (transient cues) and envelope peaks (whoosh cues), measured on the relevant stem
    onset_cues = [('chalk M', 'sfx', 1.6), ('chalk I', 'sfx', 2.7), ('chalk R', 'sfx', 3.8), ('chalk A', 'sfx', 4.9),
                  ('chalk doodle', 'sfx', 5.9), ('hush tone/cut', 'sfx', 30.6), ('glyph', 'sfx', 32.4), ('impact', 'sfx', 58.2),
                  ('tinnitus', 'sfx', 60.0), ('ignite', 'sfx', 69.0), ('braam', 'music', 82.6), ('temple bell', 'sfx', 96.5),
                  ('temple bell', 'sfx', 99.5), ('temple bell', 'sfx', 102.5), ('alarm', 'sfx', 104.0), ('glass', 'sfx', 113.0),
                  ('stinger', 'music', 114.0), ('roof land', 'sfx', 117.2), ('zap', 'sfx', 136.4), ('thunk', 'sfx', 136.7),
                  ('drone cut', 'music', 148.3), ('land', 'sfx', 149.0), ('land', 'sfx', 149.6), ('land', 'sfx', 150.3),
                  ('land', 'sfx', 151.0), ('music back', 'music', 166.0), ('awning', 'sfx', 169.5), ('awning', 'sfx', 171.0),
                  ('awning', 'sfx', 172.5), ('crate', 'sfx', 178.0), ('fish', 'sfx', 180.5), ('pizz', 'music', 182.3),
                  ('thud', 'sfx', 188.6), ('thud', 'sfx', 188.8), ('thud', 'sfx', 189.0), ('grip', 'sfx', 199.5),
                  ('anchor', 'sfx', 203.0), ('hero hit', 'music', 203.0), ('music hit', 'music', 207.5), ('splash', 'sfx', 215.2),
                  ('barrels', 'sfx', 218.0), ('zap/kick', 'sfx', 219.6), ('splash', 'sfx', 220.1), ('hush2', 'sfx', 228.5),
                  ('erase', 'sfx', 252.5), ('TOLL', 'sfx', 260.0), ('toll 2', 'sfx', 276.5), ('anchor plant', 'sfx', 277.5),
                  ('wave hits wall', 'sfx', 278.5), ('wall breaks', 'sfx', 285.5), ('thrown', 'sfx', 286.0),
                  ('step', 'sfx', 292.2), ('step', 'sfx', 293.4), ('step', 'sfx', 294.6), ('step', 'sfx', 295.8),
                  ('sting', 'music', 297.2)]
    sync = []
    for name, st, t in onset_cues:
        d = onset(stems[st], t, hpf=(st != 'music'))
        sync.append(dict(cue=name, t=t, stem=st, onset_err_ms=None if d is None else round(d * 1000, 1)))
    for name, st, t in [('slash peak', 'sfx', 81.4), ('snap-back peak', 'sfx', 116.0), ('spear whoosh peak', 'sfx', 136.0)]:
        sync.append(dict(cue=name, t=t, stem=st, env_peak_err_ms=round(env_peak(stems[st], t, 0.2) * 1000, 1)))
    rep['sync'] = sync
    bad = [s for s in sync if (s.get('onset_err_ms') is None and 'env_peak_err_ms' not in s)
           or abs(s.get('onset_err_ms') or 0) > 33 or abs(s.get('env_peak_err_ms') or 0) > 33]
    rep['sync_outside_1_frame'] = bad
    with open(os.path.join(HERE, 'levels.json'), 'w') as fh:
        json.dump(rep, fh, indent=1)

    # spectrogram
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        mono = signal.resample_poly(mix.mean(0), 1, 2)
        fig, ax = plt.subplots(2, 1, figsize=(30, 9), gridspec_kw=dict(height_ratios=[3, 1]), sharex=True)
        ax[0].specgram(mono, NFFT=2048, Fs=24000, noverlap=1024, cmap='magma', vmin=-150, vmax=-40, scale='dB')
        ax[0].set_yscale('symlog', linthresh=500)
        ax[0].set_ylim(20, 12000)
        ax[0].set_ylabel('Hz')
        hop = 2400
        e = mix[:, : mix.shape[1] // hop * hop].reshape(2, -1, hop)
        r = 20 * np.log10(np.sqrt(np.mean(e ** 2, axis=(0, 2))) + 1e-9)
        ax[1].plot(np.arange(len(r)) * hop / SR, r, lw=0.7, color='k')
        ax[1].set_ylim(-90, 0)
        ax[1].set_ylabel('RMS dBFS (50 ms)')
        for a, b in DIALOGUE:
            ax[1].axvspan(a, b, color='tab:blue', alpha=0.15)
        for t, lab in [(30.6, 'rain stops'), (41.4, 'wave'), (58.2, 'impact'), (69, 'ignite'), (81.6, 'cut'), (82.6, 'title'),
                       (93, 'Halcyon'), (113, 'glass'), (118, 'chase'), (148.3, 'bridge'), (166, 'fall'), (178, 'crate'),
                       (203, 'anchor'), (214, 'fight'), (228.5, 'hush'), (246, 'attack'), (260, 'TOLL'), (276.5, 'toll'),
                       (285.5, 'break'), (290.8, 'drop'), (297.2, 'sting')]:
            for a_ in ax:
                a_.axvline(t, color='c', lw=0.6, alpha=0.7)
            ax[0].text(t + 0.3, 9000, lab, color='w', fontsize=8, rotation=90, va='top')
        ax[1].set_xlim(0, 300)
        ax[1].set_xticks(np.arange(0, 301, 10))
        ax[1].set_xlabel('seconds (blue = dialogue windows)')
        fig.suptitle('UNFORGOTTEN ep1 pt1 -- score + sfx + ambience (no dialogue)')
        fig.tight_layout()
        fig.savefig(os.path.join(HERE, 'spectrogram.png'), dpi=70)
        rep['spectrogram'] = 'spectrogram.png'
    except ImportError:
        rep['spectrogram'] = 'skipped (no matplotlib)'
    print(json.dumps({k: v for k, v in rep.items() if k != 'sync'}, indent=1))
    print('sync (ms):', [(s['cue'], s['t'], s.get('onset_err_ms', s.get('env_peak_err_ms'))) for s in sync])


if __name__ == '__main__':
    main()
