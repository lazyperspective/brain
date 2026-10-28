"""Pick the best take of every line, treat it, trim it, and measure a 30 fps mouth envelope for lip sync.
Writes ep1/lines/<id>.wav (24 kHz mono) and ep1/lines.json [{id, who, text, dur, env}]."""
import json, os, re, glob, subprocess, difflib, numpy as np, soundfile as sf
from faster_whisper import WhisperModel

S = json.load(open('ep1/script.json')); OUT = 'ep1/lines'; os.makedirs(OUT, exist_ok=True)
SR = 24000
FX = {
    'none': 'anull',
    'sable': 'aecho=0.85:0.5:40:0.08',
    'vo': 'equalizer=f=160:t=q:w=1:g=2,aecho=0.8:0.55:55:0.12',
    'king': 'rubberband=pitch=0.84:formant=preserved,aecho=0.85:0.8:70|140|260:0.35|0.25|0.18,lowpass=f=5200',
    'bell': 'rubberband=pitch=0.8:formant=preserved,aecho=0.9:0.85:9|17|23:0.45|0.35|0.3,aecho=0.8:0.7:90|180:0.3|0.2,equalizer=f=700:t=q:w=1:g=4',
    'vesper': 'rubberband=pitch=0.88:formant=preserved,aecho=0.8:0.7:14|29:0.4|0.28,chorus=0.6:0.8:40|55:0.3|0.25:0.25|0.4:2|1.3,equalizer=f=900:t=q:w=1.2:g=3',
}
asr = WhisperModel('base.en', device='cpu', compute_type='int8')
norm = lambda s: re.sub(r"[^a-z0-9' ]", ' ', re.sub(r'\[[a-z]+\]', '', s.lower())).split()

def pcm(f, af='anull', sr=SR, trim=True):
    tr = ',silenceremove=start_periods=1:start_threshold=-42dB,areverse,silenceremove=start_periods=1:start_threshold=-42dB,areverse' if trim else ''
    b = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f, '-af', af + tr, '-f', 's16le', '-ac', '1', '-ar', str(sr), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(b, np.int16).astype(np.float32) / 32768

out = []
for l in S['lines']:
    takes = sorted(glob.glob(f"ep1/takes/{l['id']}_*.wav"))
    best = None
    for f in takes:
        a16 = pcm(f, sr=16000)
        segs, _ = asr.transcribe(a16, beam_size=5, word_timestamps=True)
        segs = list(segs); hyp = ' '.join(s.text for s in segs)
        r = difflib.SequenceMatcher(None, norm(hyp), norm(l['text'])).ratio()
        dur = len(a16) / 16000; expect = len(l['text']) / 13
        score = round(r, 2) - 0.05 * max(0, dur / expect - 1.6)
        if best is None or score > best[0]: best = (score, f, hyp, segs, r)
    score, f, hyp, segs, r = best
    a = pcm(f, FX[S['voices'][l['who']]['fx']])
    if l.get('cut'):   # cut the line off a moment into its last word
        words = [w for s in segs for w in s.words]
        wi = [w for w in words if 'what' in w.word.lower()]
        if wi: a = a[: int((wi[0].start + 0.2) * SR)]
        a[-600:] *= np.linspace(1, 0, 600)
    a = a / max(1e-3, np.abs(a).max()) * 0.89
    sf.write(f"{OUT}/{l['id']}.wav", a, SR)
    # mouth envelope: RMS per 1/30 s, mapped to 0..9 with a little smoothing
    hop = SR // 30; n = int(np.ceil(len(a) / hop))
    rms = np.array([np.sqrt(np.mean(a[i * hop:(i + 1) * hop] ** 2) + 1e-12) for i in range(n)])
    db = 20 * np.log10(rms + 1e-9); v = np.clip((db + 42) / 30, 0, 1)
    v = np.convolve(v, [0.25, 0.5, 0.25], mode='same')
    env = ''.join(chr(48 + int(round(x * 9))) for x in v)
    out.append({'id': l['id'], 'who': l['who'], 'text': l['text'] if not l.get('cut') else 'Run from wh-', 'dur': round(len(a) / SR, 3), 'env': env})
    print(f"{l['id']} {l['who']:10s} {os.path.basename(f)} match {r:.2f} {len(a) / SR:4.1f}s  heard: {hyp.strip()}")
json.dump(out, open('ep1/lines.json', 'w'))
print('total speech', round(sum(o['dur'] for o in out), 1), 's')
