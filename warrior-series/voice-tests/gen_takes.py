"""Generate directed takes of the Day One scene with Chatterbox (emotion intensity per line) and Chatterbox-Turbo (acting tags)."""
import os, sys, time, torch, torchaudio as ta
torch.set_num_threads(4)
from chatterbox.tts import ChatterboxTTS
from chatterbox.tts_turbo import ChatterboxTurboTTS

# who, line for Chatterbox, line for Turbo (with tags), exaggeration, cfg_weight
SCENE = [
    ('narrator', "Day one. Four days left on the Seed.", "Day one. Four days left on the Seed.", 0.4, 0.5),
    ('kaira', "Okay. Okay! Nobody touch the glowing girl.", "[gasp] Okay. Okay! Nobody touch the glowing girl.", 0.75, 0.35),
    ('tamo', "You're GLOWING?! Is that... is that normal?!", "Wait, you're glowing?! [gasp] Is that... is that normal?!", 0.95, 0.3),
    ('kaira', "Nothing about today is normal, kid.", "[sigh] Nothing about today is normal, kid.", 0.6, 0.4),
    ('vesper', "Step away from her. The Hollow are coming back... more of them.", "Step away from her. The Hollow are coming back... more of them.", 0.5, 0.5),
    ('sable', "Let them come.", "Let them come.", 0.35, 0.6),
    ('tamo', "Who even ARE you people?!", "Who even ARE you people?!", 0.85, 0.3),
    ('sable', "Someone who forgets things. Don't take it personally.", "[chuckle] Someone who forgets things. Don't take it personally.", 0.45, 0.5),
    ('king', "Four keys... walking together. How thoughtful of you.", "[chuckle] Four keys... walking together. How thoughtful of you.", 0.6, 0.4),
    ('vesper', "That voice... I KNOW that voice.", "That voice... I KNOW that voice.", 0.7, 0.4),
    ('kaira', "Great. Fantastic! We run, right? Tell me we run!", "Great. [laugh] Fantastic! We run, right? Tell me we run!", 0.9, 0.3),
    ('tamo', "No. We hold the line. Together.", "No. We hold the line. Together.", 0.75, 0.4),
]
TAKES = 2
out = sys.argv[1]
for engine in ('turbo', 'cb'):
    os.makedirs(f'{out}/{engine}', exist_ok=True)
    t0 = time.time()
    m = ChatterboxTurboTTS.from_pretrained(device='cpu') if engine == 'turbo' else ChatterboxTTS.from_pretrained(device='cpu')
    print(engine, 'loaded', round(time.time() - t0, 1), flush=True)
    tot_a = tot_t = 0
    for i, (who, line, tline, exg, cfg) in enumerate(SCENE):
        for k in range(TAKES):
            torch.manual_seed(1000 * i + k)
            t1 = time.time()
            if engine == 'turbo': w = m.generate(tline, audio_prompt_path=f'refs/{who}.wav', temperature=0.8)
            else: w = m.generate(line, audio_prompt_path=f'refs/{who}.wav', exaggeration=exg, cfg_weight=cfg, temperature=0.8)
            ta.save(f'{out}/{engine}/{i:02d}_{who}_{k}.wav', w, m.sr)
            tot_a += w.shape[-1] / m.sr; tot_t += time.time() - t1
        print(engine, i, who, 'done', flush=True)
    print(engine, 'total audio', round(tot_a, 1), 's in', round(tot_t, 1), 's ->', round(tot_a / tot_t, 2), 'x realtime', flush=True)
    del m
print('ALL DONE', flush=True)
