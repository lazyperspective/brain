"""Per-take analysis cache for audio3 (ep1/audio3/take_info3.json), incremental. Run from the scratch root.
  tts venv : analyze3.py --asr   -> faster-whisper base.en transcript + word timings, match ratio, artefact metrics
  cbx venv : analyze3.py --pros  -> pyin prosody (f0 median/range/sd/movement), energy dynamics, pauses, speech rate
Covers ep1/takes3 plus the older ep1/takes and ep1/takes2 (old ASR reused from audio2/take_info.json)."""
import json, os, re, sys, glob, difflib, subprocess, time, fcntl, numpy as np
INFO = 'ep1/audio3/take_info3.json'
S = json.load(open('ep1/script.json')); TXT = {l['id']: l['text'] for l in S['lines']}
NUM = {'3': 'three', '100': 'a hundred', '2': 'two', '4': 'four', '5': 'five'}


def norm(s):
    s = re.sub(r'\[[a-z]+\]', '', s.lower())
    s = re.sub(r'\b(\d+)\b', lambda m: NUM.get(m.group(1), m.group(1)), s)
    return re.sub(r"[^a-z0-9' ]", ' ', s.replace('’', "'")).split()


def pcm(f, sr):
    b = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f, '-f', 's16le', '-ac', '1', '-ar', str(sr), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(b, np.int16).astype(np.float32) / 32768


def load():
    return json.load(open(INFO)) if os.path.exists(INFO) else {}


def save_merge(upd):
    """merge-save under a lock (the two passes may run concurrently)"""
    with open(INFO + '.lock', 'w') as lk:
        fcntl.flock(lk, fcntl.LOCK_EX)
        cur = load()
        for f, d in upd.items():
            cur.setdefault(f, {}).update(d)
        json.dump(cur, open(INFO + '.tmp', 'w'), indent=0)
        os.replace(INFO + '.tmp', INFO)


def frames_db(a, sr, hop_s=0.01):
    h = int(hop_s * sr); n = len(a) // h
    return 10 * np.log10(np.mean(a[:n * h].reshape(n, h) ** 2, axis=1) + 1e-12)


def artefacts(a, sr, words):
    """speech span, internal long silences, energy after the last recognised word (trailing mumble/noise),
    clicks (isolated HF spikes), HF buzz ratio"""
    fr = frames_db(a, sr)
    pk = fr.max()
    act = np.where(fr > pk - 35)[0]
    s0, s1 = act[0] * 0.01, (act[-1] + 1) * 0.01
    # longest silence inside the speech
    inside = fr[act[0]:act[-1] + 1] > pk - 40
    run = best = 0
    for v in inside:
        run = 0 if v else run + 1
        best = max(best, run)
    lw_end = words[-1][2] if words else s1
    tail_after = max(0.0, s1 - lw_end)
    # energy (within 25 dB of peak) after the last word: mumble
    loud_after = fr[int((lw_end + 0.25) / 0.01):] if words else np.array([])
    mumble = float(np.sum(loud_after > pk - 25) * 0.01) if len(loud_after) else 0.0
    from scipy import signal
    hp = signal.sosfilt(signal.butter(4, 6000, 'high', fs=sr, output='sos'), a)
    e = np.abs(hp)
    w = int(0.004 * sr)
    loc = np.sqrt(np.convolve(hp ** 2, np.ones(w * 10) / (w * 10), mode='same')) + 1e-6
    clicks = int(np.sum((e > 8 * loc) & (e > 0.05 * np.abs(a).max())))
    full = np.mean(a[int(s0 * sr):int(s1 * sr)] ** 2) + 1e-12
    hf = 10 * np.log10(np.mean(hp[int(s0 * sr):int(s1 * sr)] ** 2) + 1e-12) - 10 * np.log10(full)
    return dict(s0=round(s0, 3), s1=round(s1, 3), max_sil=round(best * 0.01, 2), tail_after_word=round(tail_after, 2),
                mumble=round(mumble, 2), clicks=clicks, hf_db=round(float(hf), 1))


def takes():
    fs = sorted(glob.glob('ep1/takes3/L*.wav') + glob.glob('ep1/takes/L*.wav') + glob.glob('ep1/takes2/L*.wav'))
    return [f for f in fs if time.time() - os.path.getmtime(f) > 5]


def run_asr(loop=False):
    from faster_whisper import WhisperModel
    asr = WhisperModel('base.en', device='cpu', compute_type='int8', cpu_threads=1)
    old = json.load(open('ep1/audio2/take_info.json'))
    while True:
        info = load(); upd = {}
        todo = [f for f in takes() if 'hyp' not in info.get(f, {})]
        for f in todo:
            lid = os.path.basename(f).split('_')[0]
            a16 = pcm(f, 16000)
            if f in old and 'words' in old[f]:
                hyp, words = old[f]['hyp'], old[f]['words']
            else:
                segs, _ = asr.transcribe(a16, beam_size=5, word_timestamps=True)
                segs = list(segs); hyp = ' '.join(s.text for s in segs).strip()
                words = [(w.word.strip(), round(w.start, 2), round(w.end, 2), round(w.probability, 2)) for s in segs for w in s.words]
            r = difflib.SequenceMatcher(None, norm(hyp), norm(TXT[lid])).ratio()
            d = dict(id=lid, dur=round(len(a16) / 16000, 3), hyp=hyp, match=round(r, 3), words=words,
                     minp=round(min([w[3] for w in words] or [0]), 2), **artefacts(pcm(f, 24000), 24000, words))
            mf = f.replace('.wav', '.json')
            if os.path.exists(mf):
                d['gen'] = json.load(open(mf))
            upd[f] = d
            print(f, round(r, 2), d['max_sil'], d['mumble'], d['clicks'], hyp, flush=True)
            if len(upd) >= 10:
                save_merge(upd); upd = {}
        if upd: save_merge(upd)
        if not loop or (not todo and all_done()): break
        if not todo: time.sleep(20)


def all_done():
    return all('ALL DONE' in open(f).read() for f in ('ep1/audio3/gen_cb.log', 'ep1/audio3/gen_tu.log') if os.path.exists(f))


def run_pros(loop=False):
    sys.path.insert(0, 'ep1/audio3')
    from prosody_stats import stats
    while True:
        info = load(); upd = {}
        todo = [f for f in takes() if 'rng' not in info.get(f, {})]
        for f in todo:
            lid = os.path.basename(f).split('_')[0]
            try:
                r = stats(f, TXT[lid]); r.pop('f')
            except Exception as e:
                r = dict(rng=0.0, err=str(e))
            upd[f] = r
            print(f, r.get('rng'), r.get('wps'), flush=True)
            if len(upd) >= 10:
                save_merge(upd); upd = {}
        if upd: save_merge(upd)
        if not loop or (not todo and all_done()): break
        if not todo: time.sleep(20)


if __name__ == '__main__':
    if '--asr' in sys.argv: run_asr('--loop' in sys.argv)
    if '--pros' in sys.argv: run_pros('--loop' in sys.argv)
