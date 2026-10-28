"""Voice tests for UNFORGOTTEN: a casting reel (three candidates per character, each slated by the narrator)
and a short dramatised scene with per-character voice treatment, all generated on CPU with Kokoro."""
import os, subprocess, sys, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

OUT = sys.argv[1]
TMP = os.path.join(OUT, 'lines'); os.makedirs(TMP, exist_ok=True)
K = Kokoro('models/kokoro-v1.0.onnx', 'models/voices-v1.0.bin')
SR = 24000

# per-character treatment (ffmpeg filter chains)
FX = {
    'clean': 'anull',
    'sable': 'equalizer=f=180:t=q:w=1:g=2,aecho=0.85:0.5:40:0.12',
    'vesper': 'rubberband=pitch=0.86:formant=preserved,aecho=0.8:0.7:14|29:0.45|0.3,chorus=0.6:0.8:40|55:0.35|0.3:0.25|0.4:2|1.3,equalizer=f=900:t=q:w=1.2:g=4',
    'king': 'rubberband=pitch=0.8:formant=preserved,aecho=0.85:0.8:70|140|260:0.4|0.3|0.2,flanger=delay=2:depth=2:speed=0.3,lowpass=f=5200',
    'kaira': 'highpass=f=120',
    'tamo': 'highpass=f=100',
    'narrator': 'equalizer=f=120:t=q:w=1:g=2',
}

def say(text, voice, speed=1.0, fx='clean', lang=None, name=None):
    lang = lang or ('en-gb' if voice.startswith('b') else 'en-us')
    a, sr = K.create(text, voice=voice, speed=speed, lang=lang)
    raw = os.path.join(TMP, (name or 'x') + '_raw.wav'); out = os.path.join(TMP, (name or 'x') + '.wav')
    sf.write(raw, a, sr)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', raw, '-af', FX[fx] + ',aresample=24000', '-ac', '1', out], check=True)
    d, _ = sf.read(out)
    return d.astype(np.float32)

def gap(s): return np.zeros(int(SR * s), np.float32)

def master(parts, path, bed=None):
    x = np.concatenate(parts)
    wav = path.replace('.mp3', '_dry.wav'); sf.write(wav, x, SR)
    if bed:   # a low wind-and-rumble bed under the scene
        dur = len(x) / SR
        cmd = ['ffmpeg', '-loglevel', 'error', '-y', '-i', wav, '-f', 'lavfi', '-t', str(dur), '-i', 'anoisesrc=color=brown:amplitude=0.05:r=24000',
               '-filter_complex', '[1]lowpass=f=400,volume=0.5[b];[0][b]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5', '-b:a', '160k', path]
    else:
        cmd = ['ffmpeg', '-loglevel', 'error', '-y', '-i', wav, '-af', 'loudnorm=I=-16:TP=-1.5', '-b:a', '160k', path]
    subprocess.run(cmd, check=True)

# ---------------------------------------------------------------- casting reel
CAST = [
    ('Sable', 'sable', "Names are power. They burned my village's names away. So I'll burn whatever I have left to take them back.", [('bf_isabella', 0.92), ('af_kore', 0.92), ('bf_emma', 0.9)]),
    ('Tamo', 'tamo', "You want the anchor? Come and take it! I've been lifting heavier things than you since I was six!", [('am_puck', 1.05), ('af_sky', 1.05), ('am_echo', 1.05)]),
    ('Vesper', 'vesper', "There is no one inside this armour. Only the light of everyone who ever loved my kingdom. And it is not going out tonight.", [('am_onyx', 0.88), ('am_fenrir', 0.88), ('bm_lewis', 0.88)]),
    ('Kaira', 'kaira', "Five days. One letter. Zero help. Great. Love that for me. Move!", [('af_nova', 1.12), ('af_jessica', 1.12), ('af_heart', 1.12)]),
    ('The Hollow King', 'king', "Grief is a wound that remembers. I am only offering the world a way to stop bleeding.", [('bm_george', 0.82), ('bm_daniel', 0.82), ('am_michael', 0.82)]),
]
reel = []
reel.append(say("Unforgotten. Voice auditions.", 'bm_fable', 0.95, 'narrator', name='slate0')); reel.append(gap(0.8))
for ch, fx, line, opts in CAST:
    for i, (v, sp) in enumerate(opts):
        reel.append(say(f"{ch}, option {'ABC'[i]}.", 'bm_fable', 1.0, 'narrator', name=f'slate_{fx}{i}')); reel.append(gap(0.35))
        reel.append(say(line, v, sp, fx, name=f'aud_{fx}{i}')); reel.append(gap(0.9))
master(reel, os.path.join(OUT, 'voice-auditions.mp3'))

# ---------------------------------------------------------------- a scene (first choices)
V = {'NARRATOR': ('bm_fable', 0.95, 'narrator'), 'SABLE': ('bf_isabella', 0.92, 'sable'), 'TAMO': ('am_puck', 1.05, 'tamo'),
     'VESPER': ('am_onyx', 0.88, 'vesper'), 'KAIRA': ('af_nova', 1.12, 'kaira'), 'KING': ('bm_george', 0.8, 'king')}
SCENE = [
    ('NARRATOR', "Day one. Four days left on the Seed.", 0.9),
    ('KAIRA', "Okay. Okay. Nobody touch the glowing girl.", 0.35),
    ('TAMO', "You're glowing?! Is that, is that normal?", 0.3),
    ('KAIRA', "Nothing about today is normal, kid.", 0.7),
    ('VESPER', "Step away from her. The Hollow are coming back. More of them.", 0.6),
    ('SABLE', "Let them come.", 0.5),
    ('TAMO', "Who even are you people?", 0.4),
    ('SABLE', "Someone who forgets things. Don't take it personally.", 1.1),
    ('KING', "Four keys... walking together. How thoughtful of you.", 1.0),
    ('VESPER', "That voice. I know that voice.", 0.4),
    ('KAIRA', "Great. Fantastic. We run, right? Tell me we run.", 0.5),
    ('TAMO', "No. We hold the line. Together.", 0.2),
]
parts = [gap(0.6)]
for i, (who, line, pause) in enumerate(SCENE):
    v, sp, fx = V[who]
    parts.append(say(line, v, sp, fx, name=f'scene{i:02d}_{who.lower()}')); parts.append(gap(pause))
parts.append(gap(1.0))
master(parts, os.path.join(OUT, 'scene-day-one.mp3'), bed=True)
print('ok')
