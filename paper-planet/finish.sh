#!/bin/sh
# Mux and derive the deliverables from the rendered video + synthesised audio. One encoder at a time.
set -e
cd "$(dirname "$0")"
ffmpeg -y -loglevel error -i out/paper_planet_video.mp4 -i out/paper_planet_audio.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart out/paper_planet.mp4
ffmpeg -y -loglevel error -i out/paper_planet.mp4 -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart out/paper_planet_share.mp4
# Square: the camera always lands each place's look point at the frame's horizontal centre, the wide shots
# centre the globe, and the hanging moon swings inside x 0.31..0.69, so a centred 1080 window follows the action.
ffmpeg -y -loglevel error -i out/paper_planet.mp4 -vf "crop=1080:1080:420:0" -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart out/paper_planet_square.mp4
# contact sheet: 24 frames evenly across the film
ffmpeg -y -loglevel error -i out/paper_planet.mp4 -vf "select='not(mod(n+45\,90))',scale=640:-1,tile=6x4" -frames:v 1 -q:v 2 out/contact_sheet.jpg
ls -la out
