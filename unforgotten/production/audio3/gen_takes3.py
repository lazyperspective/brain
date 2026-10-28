"""Generate the audio3 takes from plan3.PLAN into ep1/takes3/<id>_<v>_<k>.wav (+ .json sidecar with the settings).
usage: gen_takes3.py ENGINE [--threads N] [--only L01,L02] [--extra K]   (run from the scratch root, cbx venv)
Deterministic seeds (crc32 of the take name). Existing takes are skipped, so it can be resumed."""
import json, os, sys, zlib, time
sys.path.insert(0, 'ep1/audio3')
import torch, torchaudio as ta
from plan3 import PLAN
eng = sys.argv[1]
opt = dict(a[2:].split('=') for a in sys.argv[2:] if a.startswith('--'))
torch.set_num_threads(int(opt.get('threads', 2)))
only = opt.get('only', '').split(',') if opt.get('only') else None
extra = int(opt.get('extra', 0))
S = json.load(open('ep1/script.json')); WHO = {l['id']: l['who'] for l in S['lines']}
OUT = 'ep1/takes3'; os.makedirs(OUT, exist_ok=True)
if eng == 'cb':
    from chatterbox.tts import ChatterboxTTS; m = ChatterboxTTS.from_pretrained(device='cpu')
else:
    from chatterbox.tts_turbo import ChatterboxTurboTTS; m = ChatterboxTurboTTS.from_pretrained(device='cpu')
print('loaded', eng, flush=True)
for lid, p in PLAN.items():
    if only and lid not in only: continue
    ref = 'refs/%s.wav' % S['voices'][WHO[lid]]['ref']
    for v, (e, text, prm, n) in enumerate(p['vars']):
        if e != eng: continue
        for k in range(n + extra):
            name = f'{lid}_{v}_{k}'
            if os.path.exists(f'{OUT}/{name}.wav'): continue
            torch.manual_seed(zlib.crc32(f'takes3/{name}'.encode()) % 1000003)
            t = time.time()
            w = m.generate(text, audio_prompt_path=ref, **prm)
            ta.save(f'{OUT}/{name}.wav', w, m.sr)
            json.dump(dict(id=lid, engine=e, text=text, ref=ref, **prm), open(f'{OUT}/{name}.json', 'w'))
            print(name, e, prm, round(w.shape[-1] / m.sr, 2), 's in', round(time.time() - t, 1), flush=True)
print('ALL DONE', eng, flush=True)
