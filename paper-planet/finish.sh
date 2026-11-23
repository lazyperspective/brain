#!/bin/sh
# Mux and derive the deliverables from the rendered video + synthesised audio. One encoder at a time.
set -e
cd "$(dirname "$0")"
ffmpeg -y -loglevel error -i out/paper_planet_video.mp4 -i out/paper_planet_audio.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -t 60 -movflags +faststart out/paper_planet_60s.mp4
ffmpeg -y -loglevel error -i out/paper_planet_60s.mp4 -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart out/paper_planet_share.mp4
# Square: a 1080 window that pans slowly (one swing per loop, so it still loops) to keep the hanging moon in
# shot; the camera's look point stays at frame centre, so the hero of each moment is always inside the window.
# The swing follows pp/travellers.py moon_screen(): x = 0.5 + 0.375 sin(2 pi (t - 10) / 60).
ffmpeg -y -loglevel error -i out/paper_planet_60s.mp4 -vf "crop=1080:1080:'420+324*sin(2*PI*(t-10)/60)':0" -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart out/paper_planet_square.mp4
ffmpeg -y -loglevel error -i out/paper_planet_60s.mp4 -vf "select='not(mod(n\,75))',scale=640:-1,tile=6x4" -frames:v 1 -q:v 2 out/contact_sheet.jpg
ls -la out
