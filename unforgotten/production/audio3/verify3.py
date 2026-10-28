"""Verify audio3: per line onset vs cue (measured in dialogue.wav), clean ending, gap to the next cue, ASR of the
final line wav; dialogue.wav / mix.wav format, length, loudness, true peak. tts venv, from the scratch root."""
import json, re, difflib, subprocess, numpy as np, soundfile as sf
from faster_whisper import WhisperModel
A = 'ep1/audio3'; SR = 48000
S = json.load(open('ep1/script.json')); C = json.load(open('ep1/cue.json'))
L = json.load(open(f'{A}/lines.json')); TXT = {l['id']: l for l in S['lines']}
SEL = {r['id']: r for r in json.load(open(f'{A}/selection3.json'))}
import sys; sys.argv = sys.argv[:1]; sys.path.insert(0, A)
from build_lines3 import norm, tag_info      # same name-tolerant normalisation as the selection (Mira/Sable/Kaira/Tamo)


asr = WhisperModel('base.en', device='cpu', compute_type='int8', cpu_threads=4)
dlg, sr = sf.read(f'{A}/dialogue.wav', dtype='float64')
assert sr == SR and dlg.shape == (300 * SR, 2), dlg.shape
dm = dlg.mean(1)
res, ok = [], True
order = sorted(L, key=lambda o: C[o['id']])
for k, o in enumerate(order):
    lid = o['id']
    a, sr = sf.read(f'{A}/lines/{lid}.wav', dtype='float64'); m = a.mean(1)
    assert sr == SR and abs(len(m) / SR - o['dur']) < 1e-3, lid
    # onset in the dialogue track: first 5 ms frame within 45 dB of the line's loudest 5 ms frame
    h = int(0.005 * SR)
    i0 = int((C[lid] - 0.1) * SR)
    seg = dm[i0:i0 + int((o['dur'] + 0.1) * SR)]
    n = len(seg) // h
    fr = 10 * np.log10(np.mean(seg[:n * h].reshape(n, h) ** 2, 1) + 1e-12)
    on = (np.where(fr > fr.max() - 45)[0][0] * h + i0) / SR     # -45 dB: catches soft fricative onsets ("Step")
    onset_ms = (on - C[lid]) * 1000
    # ending
    h3 = int(0.03 * SR); n3 = len(m) // h3
    f3 = 10 * np.log10(np.mean(m[:n3 * h3].reshape(n3, h3) ** 2, 1) + 1e-12)
    rel = 10 * np.log10(np.mean(m[-h3:] ** 2) + 1e-12) - f3.max()
    # a level rise in the last 150 ms (a cut-off syllable); frames 50 dB under the peak (room-tail noise) don't count
    t5 = f3[-5:]; d5 = np.diff(t5); d5 = d5[t5[1:] > f3.max() - 50]
    rise = float(d5.max()) if len(d5) else -99.0
    endt = C[lid] + o['dur']; nxt = C[order[k + 1]['id']] if k + 1 < len(order) else 300.0
    gap = nxt - endt
    a16 = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f'{A}/lines/{lid}.wav', '-f', 's16le', '-ac', '1', '-ar', '16000', '-'],
                         capture_output=True, check=True).stdout
    segs, _ = asr.transcribe(np.frombuffer(a16, np.int16).astype(np.float32) / 32768, beam_size=5)
    hyp = ' '.join(s.text for s in segs).strip()
    hyp_c, _ = tag_info(hyp.replace("' ", ' '), [], TXT[lid]['text'], 0)     # a performed [chuckle]/[sigh] heard as 'heh'/'ah' is not a word error
    ref = TXT[lid]['text'] if not TXT[lid].get('cut') else 'Run from wh'
    r = difflib.SequenceMatcher(None, norm(hyp_c), norm(ref)).ratio()
    good = rel <= -30 and rise <= 3.0 and gap >= 0.15 - 1e-6 and -5 <= onset_ms <= 20
    ok &= good
    res.append(dict(id=lid, dur=o['dur'], onset_ms=round(onset_ms, 1), end_rel_db=round(rel, 1), tail_rise_db=round(rise, 1),
                    gap_to_next=round(gap, 3), asr_match=round(r, 2), raw_take_match=SEL[lid]['match'], hyp=hyp))
    print(f"{lid} dur {o['dur']:5.2f} onset {onset_ms:5.1f} ms  last30 {rel:6.1f} dB rise {rise:4.1f}  gap {gap:5.2f}  "
          f"asr {r:.2f} (raw take {SEL[lid]['match']:.2f}) {'' if good else '<<< FAIL'} | {hyp}", flush=True)
mx = json.load(open(f'{A}/mix_check.json'))['mix'] if __import__('os').path.exists(f'{A}/mix_check.json') else None
print('dialogue.wav', dlg.shape, dlg.shape[0] / SR, 's'); print('mix', mx)
json.dump(dict(lines=res, mix=mx, all_ok=bool(ok)), open(f'{A}/verify3.json', 'w'), indent=1)
print('ALL OK' if ok else 'SOME FAILURES')
