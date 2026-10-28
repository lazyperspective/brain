import soundfile as sf, numpy as np
from kokoro_onnx import Kokoro
k = Kokoro('models/kokoro-v1.0.onnx', 'models/voices-v1.0.bin')
REF = {  # ~10 s of neutral-to-warm speech in each cast voice
 'sable':   ('bf_isabella', 0.95, "I have walked a long way to get here. I don't remember all of it anymore, and that's all right. The road remembers for me. Keep up, and keep quiet."),
 'tamo':    ('am_puck', 1.0, "Hey! You came all the way out to the docks? Nobody comes out here. Here, sit down, I'll show you how we tie the big ropes. It's easier than it looks, I promise!"),
 'vesper':  ('am_onyx', 0.92, "I was made to keep watch. Long after the walls fell and the bells went quiet, I kept watch. There is nothing left to guard now, except the people walking beside me."),
 'kaira':   ('af_nova', 1.08, "Look, I deliver things. That's the job. Fast, quiet, no questions. So when someone tells me to slow down and explain myself, you can guess how that usually goes."),
 'king':    ('bm_george', 0.88, "Every one of you has lost something. A face, a voice, a home. You carry it like a stone. I am not your enemy. I am the one offering to set the stone down."),
 'narrator':('bm_fable', 0.95, "Long ago, four powers held the world together. A fire that remembered, a tide that endured, a light that kept watch, and a storm that carried every message home."),
}
for name, (v, sp, text) in REF.items():
    a, sr = k.create(text, voice=v, speed=sp, lang='en-gb' if v.startswith('b') else 'en-us')
    sf.write(f'refs/{name}.wav', a, sr); print(name, round(len(a) / sr, 1), 's')
