#!/bin/sh
# X cut deliverables from the three rendered formats + the loop soundtrack. One encoder at a time.
#   python render.py --cut x --fmt x  --crf 16 --out tmp/x/video_x.mp4    (and --fmt sq / v, --crf 17)
#   python audio_x.py out/paper_planet_x_audio.wav
#   ./finish_x.sh
set -e
cd "$(dirname "$0")"
A=out/paper_planet_x_audio.wav
mux() { ffmpeg -y -loglevel error -i "$1" -i $A -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -movflags +faststart "$2"; }
mux tmp/x/video_x.mp4  out/paper_planet_x.mp4
mux tmp/x/video_sq.mp4 out/paper_planet_x_square.mp4
mux tmp/x/video_v.mp4  out/paper_planet_x_vertical.mp4
ffmpeg -y -loglevel error -i out/paper_planet_x.mp4 -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a aac -b:a 160k -movflags +faststart out/paper_planet_x_share.mp4
mkdir -p out/stills_x
.venv/bin/python sheet_x.py out/paper_planet_x.mp4 out/contact_sheet_x.jpg out/stills_x/hook_strip_x.jpg
.venv/bin/python sheet_x.py out/paper_planet_x_vertical.mp4 out/stills_x/contact_sheet_vertical.jpg out/stills_x/hook_strip_vertical.jpg
.venv/bin/python sheet_x.py out/paper_planet_x_square.mp4 out/stills_x/contact_sheet_square.jpg out/stills_x/hook_strip_square.jpg
ls -la out
