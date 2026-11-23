#!/bin/sh
# X cut deliverables from the three rendered formats + the loop soundtrack. One encoder at a time.
#   python render.py --cut x --fmt x  --crf 16 --out tmp/x/video_x.mp4    (and --fmt sq / v, --crf 17)
#   python audio_x.py out/paper_planet_x_audio.wav
#   ./finish_x.sh
# AAC starts cold: encoded on its own, the first frame of the loop carries a faint click at the seam. So the
# soundtrack is encoded with one second of the loop's own end before it and its start after it, and the mux
# stream-copies the middle 23.4 s (ffmpeg writes an edit list), so the encoder is already warm at frame 0.
set -e
cd "$(dirname "$0")"
A=out/paper_planet_x_audio.wav
.venv/bin/python -c "
import wave, numpy as np
w = wave.open('$A'); x = np.frombuffer(w.readframes(w.getnframes()), '<i2').reshape(-1, 2)
o = wave.open('tmp/x/padded.wav', 'wb'); o.setnchannels(2); o.setsampwidth(2); o.setframerate(48000)
o.writeframes(np.concatenate([x[-48000:], x, x[:48000]]).tobytes()); o.close()"
ffmpeg -y -loglevel error -i tmp/x/padded.wav -c:a aac -b:a 256k tmp/x/padded_256.m4a
ffmpeg -y -loglevel error -i tmp/x/padded.wav -c:a aac -b:a 160k tmp/x/padded_160.m4a
mux() { ffmpeg -y -loglevel error -i "$1" -ss 1.0 -t 23.4 -i "$2" -map 0:v -map 1:a -c copy -movflags +faststart "$3"; }
mux tmp/x/video_x.mp4  tmp/x/padded_256.m4a out/paper_planet_x.mp4
mux tmp/x/video_sq.mp4 tmp/x/padded_256.m4a out/paper_planet_x_square.mp4
mux tmp/x/video_v.mp4  tmp/x/padded_256.m4a out/paper_planet_x_vertical.mp4
ffmpeg -y -loglevel error -i tmp/x/video_x.mp4 -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -an tmp/x/share_v.mp4
mux tmp/x/share_v.mp4 tmp/x/padded_160.m4a out/paper_planet_x_share.mp4
rm -f tmp/x/share_v.mp4
mkdir -p out/stills_x
.venv/bin/python sheet_x.py out/paper_planet_x.mp4 out/contact_sheet_x.jpg out/stills_x/hook_strip_x.jpg
.venv/bin/python sheet_x.py out/paper_planet_x_vertical.mp4 out/stills_x/contact_sheet_vertical.jpg out/stills_x/hook_strip_vertical.jpg
.venv/bin/python sheet_x.py out/paper_planet_x_square.mp4 out/stills_x/contact_sheet_square.jpg out/stills_x/hook_strip_square.jpg
ffmpeg -y -loglevel error -i $A -lavfi showspectrumpic=s=1600x600:legend=1:scale=log out/stills_x/audio_spectrogram_x.png
ls -la out | grep _x
