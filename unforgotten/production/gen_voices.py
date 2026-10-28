"""Two takes of every line of the episode: Turbo by default, full Chatterbox (with an emotion setting) where a line says so."""
import json, os, sys, time, torch, torchaudio as ta
torch.set_num_threads(4)
from chatterbox.tts import ChatterboxTTS
from chatterbox.tts_turbo import ChatterboxTurboTTS
S = json.load(open('ep1/script.json')); OUT = 'ep1/takes'; os.makedirs(OUT, exist_ok=True)
for engine in ('turbo', 'cb'):
    todo = [l for l in S['lines'] if l.get('engine', 'turbo') == engine]
    if not todo: continue
    m = ChatterboxTurboTTS.from_pretrained(device='cpu') if engine == 'turbo' else ChatterboxTTS.from_pretrained(device='cpu')
    for l in todo:
        ref = 'refs/%s.wav' % S['voices'][l['who']]['ref']
        text = l['text']
        for k in range(2):
            p = f"{OUT}/{l['id']}_{k}.wav"
            if os.path.exists(p): continue
            torch.manual_seed(hash((l['id'], k)) % 100000)
            if engine == 'turbo': w = m.generate(text, audio_prompt_path=ref, temperature=0.8)
            else: w = m.generate(text, audio_prompt_path=ref, exaggeration=l.get('exaggeration', 0.6), cfg_weight=l.get('cfg', 0.4), temperature=0.8)
            ta.save(p, w, m.sr)
        print(l['id'], 'done', flush=True)
    del m
print('ALL DONE', flush=True)
