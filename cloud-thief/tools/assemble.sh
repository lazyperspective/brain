#!/bin/bash
# Encode rendered frames + soundtrack into the final film.
cd "$(dirname "$0")/.."
ffmpeg -y -loglevel error -framerate 24 -i frames/f%04d.png -i audio/mix.wav \
  -filter_complex "[1:a]loudnorm=I=-15:TP=-1.0:LRA=11[a]" -map 0:v -map "[a]" \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -profile:v high -movflags +faststart \
  -c:a aac -b:a 256k -ar 48000 -t 30 The_Cloud_Thief_FINAL.mp4
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,nb_frames -of compact The_Cloud_Thief_FINAL.mp4
