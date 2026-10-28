"""Pick the best take of every line (closest transcript to the script), give each character its voice treatment,
and assemble the scene with timing, a room tone bed and loudness normalisation."""
import os, re, sys, glob, subprocess, difflib, numpy as np, soundfile as sf
from faster_whisper import WhisperModel

TAKES, OUT = sys.argv[1], sys.argv[2]
SR = 24000
SCRIPT = ["Day one. Four days left on the Seed.", "Okay. Okay! Nobody touch the glowing girl.", "You're glowing?! Is that... is that normal?!",
          "Nothing about today is normal, kid.", "Step away from her. The Hollow are coming back... more of them.", "Let them come.",
          "Who even are you people?!", "Someone who forgets things. Don't take it personally.", "Four keys... walking together. How thoughtful of you.",
          "That voice... I know that voice.", "Great. Fantastic! We run, right? Tell me we run!", "No. We hold the line. Together."]
PAUSE = [0.9, 0.25, 0.3, 0.7, 0.5, 0.5, 0.35, 1.0, 0.9, 0.35, 0.4, 0.2]
FX = {'vesper': 'rubberband=pitch=0.88:formant=preserved,aecho=0.8:0.7:14|29:0.4|0.28,chorus=0.6:0.8:40|55:0.3|0.25:0.25|0.4:2|1.3,equalizer=f=900:t=q:w=1.2:g=3',
      'king': 'rubberband=pitch=0.84:formant=preserved,aecho=0.85:0.8:70|140|260:0.35|0.25|0.18,lowpass=f=5200',
      'sable': 'aecho=0.85:0.5:40:0.1'}
asr = WhisperModel('base.en', device='cpu', compute_type='int8')
norm = lambda s: re.sub(r"[^a-z0-9' ]", ' ', s.lower()).split()

def load(f, af='anull', sr=SR):
    pcm = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f, '-af', af + ',silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse',
                          '-f', 's16le', '-ac', '1', '-ar', str(sr), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(pcm, np.int16).astype(np.float32) / 32768

def score(wav, text):
    a16 = load(wav, sr=16000)
    hyp = ' '.join(s.text for s in asr.transcribe(a16, beam_size=5)[0])
    r = difflib.SequenceMatcher(None, norm(hyp), norm(text)).ratio()
    return r, hyp, len(a16) / 16000

for engine in sorted(os.listdir(TAKES)):
    parts, report = [np.zeros(int(SR * 0.6), np.float32)], []
    for i, text in enumerate(SCRIPT):
        cands = sorted(glob.glob(f'{TAKES}/{engine}/{i:02d}_*.wav'))
        if not cands: continue
        who = cands[0].split('_')[-2]
        scored = [(score(c, text), c) for c in cands]
        # the most accurate take; between equally accurate takes, the one that isn't oddly long
        best = max(scored, key=lambda x: (round(x[0][0], 2), -abs(x[0][2] - len(text) / 14)))
        (r, hyp, dur), path = best
        report.append(f'{i:02d} {who:8s} take {path[-5]}  match {r:.2f}  {dur:4.1f}s  heard: {hyp.strip()}')
        parts.append(load(path, FX.get(who, 'anull'))); parts.append(np.zeros(int(SR * PAUSE[i]), np.float32))
    parts.append(np.zeros(int(SR * 1.0), np.float32))
    x = np.concatenate(parts); dry = f'{OUT}/scene-{engine}_dry.wav'; sf.write(dry, x, SR)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', dry, '-f', 'lavfi', '-t', str(len(x) / SR), '-i', 'anoisesrc=color=brown:amplitude=0.05:r=24000',
                    '-filter_complex', '[1]lowpass=f=400,volume=0.5[b];[0][b]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5', '-b:a', '160k', f'{OUT}/scene-{engine}.mp3'], check=True)
    print(f'== {engine}  ({len(x) / SR:.1f}s)'); print('\n'.join(report))
