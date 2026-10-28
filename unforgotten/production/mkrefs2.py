import soundfile as sf, subprocess
from kokoro_onnx import Kokoro
k = Kokoro('models/kokoro-v1.0.onnx', 'models/voices-v1.0.bin')
REF = {
 'mira':       ('af_sky', 1.05, "Look, look! I can write all the letters now. The big ones and the small ones. Tomorrow I'm going to write the whole village on the wall, every single house!"),
 'oren':       ('am_michael', 0.95, "Hold the line. Nobody leaves the spire until the vault is sealed and every courier is accounted for. That is an order, not a request."),
 'warden':     ('am_echo', 1.0, "Captain, the east bridge is clear. The bells are ringing in the lower rings. Something is wrong down there, I can feel it."),
 'docker':     ('am_santa', 0.95, "Thirty years I've worked these docks, and I've seen everything wash up. Boots, bottles, a whole piano once. Nothing surprises me anymore, kid."),
 'bellwether': ('bm_lewis', 0.85, "Listen. Every bell is a promise that someone will answer. I am the last bell. When I ring, nobody answers ever again."),
}
for n, (v, sp, t) in REF.items():
    a, sr = k.create(t, voice=v, speed=sp, lang='en-gb' if v.startswith('b') else 'en-us')
    sf.write(f'refs/{n}.wav', a, sr)
# a child's voice: lift the pitch and the formants a little
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', 'refs/mira.wav', '-af', 'rubberband=pitch=1.22:formant=shifted', 'refs/mira_c.wav'], check=True)
subprocess.run(['mv', 'refs/mira_c.wav', 'refs/mira.wav'], check=True)
print('refs ok')
