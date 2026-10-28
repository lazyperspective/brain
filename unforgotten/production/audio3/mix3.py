"""audio3 final mix: a copy of ep1/audio2/mix_v3.py with the paths changed (recipe unchanged): dialogue +9 dB; score sidechain-ducked by the (boosted) dialogue
(sidechaincompress threshold=0.05 ratio=3 attack=20 release=400 makeup=1); amix normalize=0; alimiter limit=0.89;
loudnorm I=-16 TP=-1.5 LRA=16 (two-pass: measured, then applied); 48 kHz stereo, exactly 300 s.
Also writes ducked_score.wav (the score exactly as it sits under the dialogue) and checks dialogue vs ducked score
in every line window. With --fit it writes line_gain3.json trims for lines outside 5-15 dB (then rebuild + rerun)."""
import json, sys, subprocess, numpy as np, soundfile as sf
from scipy import signal

A = 'ep1/audio3'
SR = 48000
N = int(300 * SR)
DLG, SCORE = f'{A}/dialogue.wav', 'ep1/audio2/score_nobricks.wav'
SC = 'sidechaincompress=threshold=0.05:ratio=3:attack=20:release=400:makeup=1'
PRE = f'[0:a]volume=9dB,asplit=2[d][k];[1:a][k]{SC}[s];[d][s]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.89'


def ff(args):
    return subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-y'] + args, capture_output=True, text=True, check=True)


def mix():
    r = ff(['-i', DLG, '-i', SCORE, '-filter_complex', PRE + ',loudnorm=I=-16:TP=-1.5:LRA=16:print_format=json', '-f', 'null', '-'])
    js = r.stderr[r.stderr.rindex('{'):r.stderr.rindex('}') + 1]
    m = json.loads(js)
    ln = (f"loudnorm=I=-16:TP=-1.5:LRA=16:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
          f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true:print_format=json")
    r = ff(['-i', DLG, '-i', SCORE, '-filter_complex', PRE + ',' + ln + f',aresample=48000,apad=whole_len={N},atrim=end_sample={N}',
            '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', f'{A}/mix.wav'])
    js2 = json.loads(r.stderr[r.stderr.rindex('{'):r.stderr.rindex('}') + 1])
    print('loudnorm pass 1:', {k: m[k] for k in ('input_i', 'input_tp', 'input_lra')}, '-> pass 2 type:', js2.get('normalization_type'))
    tp = final_check()['true_peak_dbtp']
    if tp > -1.5:   # safety only: a true-peak catch (4x oversampled brickwall) after loudnorm, 0.3 dB under the target
        lim = 10 ** (-1.8 / 20)
        ff(['-i', DLG, '-i', SCORE, '-filter_complex', PRE + ',' + ln + f',aresample=192000,alimiter=limit={lim:.4f}:level=disabled:attack=1:release=40,'
            f'aresample=48000,apad=whole_len={N},atrim=end_sample={N}', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', f'{A}/mix.wav'])
        print(f'true peak was {tp} dBTP after loudnorm: added the oversampled safety limiter at -1.8 dBFS')
    # the ducked score on its own (same graph up to the compressor)
    ff(['-i', DLG, '-i', SCORE, '-filter_complex', f'[0:a]volume=9dB[k];[1:a][k]{SC}[s]', '-map', '[s]', '-c:a', 'pcm_f32le', f'{A}/ducked_score.wav'])


def kw(x):
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)


def windows():
    d = sf.read(DLG, dtype='float64')[0] * 10 ** (9 / 20)
    s = sf.read(f'{A}/ducked_score.wav', dtype='float64')[0]
    C = json.load(open('ep1/cue.json'))
    L = json.load(open(f'{A}/lines.json'))
    dk, sk = kw(d), kw(s)
    B = int(0.1 * SR)
    out = []
    for l in sorted(L, key=lambda o: C[o['id']]):
        i0, i1 = int(C[l['id']] * SR), int((C[l['id']] + l['dur']) * SR)
        n = (i1 - i0) // B
        pd = np.mean(dk[i0:i0 + n * B].reshape(n, B, 2) ** 2, axis=(1, 2)) * 2
        ps = np.mean(sk[i0:i0 + n * B].reshape(n, B, 2) ** 2, axis=(1, 2)) * 2
        act = 10 * np.log10(pd + 1e-12) > 10 * np.log10(pd.max() + 1e-12) - 20     # blocks where the line is speaking
        Ld = -0.691 + 10 * np.log10(np.mean(pd[act]))
        Ls = -0.691 + 10 * np.log10(np.mean(ps[act]) + 1e-12)
        out.append(dict(id=l['id'], t0=C[l['id']], t1=round(C[l['id']] + l['dur'], 2), dlg_lufs=round(Ld, 1), score_lufs=round(Ls, 1), diff=round(Ld - Ls, 1)))
    return out


def final_check():
    x, sr = sf.read(f'{A}/mix.wav')
    r = ff(['-i', f'{A}/mix.wav', '-af', 'ebur128=peak=true', '-f', 'null', '-'])
    tail = r.stderr[r.stderr.rindex('Summary:'):]
    I = float(tail.split('I:')[1].split('LUFS')[0])
    LRA = float(tail.split('LRA:')[1].split('LU')[0])
    TP = float(tail.split('True peak:')[1].split('Peak:')[1].split('dBFS')[0])
    return dict(sr=sr, channels=x.shape[1], samples=x.shape[0], seconds=x.shape[0] / sr, integrated_lufs=I, lra=LRA, true_peak_dbtp=TP)


if __name__ == '__main__':
    mix()
    w = windows()
    bad = [r for r in w if not 5 <= r['diff'] <= 15]
    for r in w:
        print(f"{r['id']} {r['t0']:6.1f}-{r['t1']:6.1f}  dialogue {r['dlg_lufs']:6.1f}  ducked score {r['score_lufs']:6.1f}  diff {r['diff']:5.1f} dB{'  <<<' if r in bad else ''}")
    fc = final_check()
    print('mix:', fc)
    json.dump(dict(windows=w, mix=fc), open(f'{A}/mix_check.json', 'w'), indent=1)
    if '--fit' in sys.argv:
        g = json.load(open(f'{A}/line_gain3.json')) if __import__('os').path.exists(f'{A}/line_gain3.json') else {}
        for r in bad:
            tgt = 13.5 if r['diff'] > 15 else 6.5
            g[r['id']] = round(float(np.clip(g.get(r['id'], 0.0) + (tgt - r['diff']), -6.0, 6.0)), 1)
        json.dump(g, open(f'{A}/line_gain3.json', 'w'), indent=1)
        print('line_gain3.json:', g)
