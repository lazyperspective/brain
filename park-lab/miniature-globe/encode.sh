#!/bin/bash
# usage: ./encode.sh <frames_dir> <out_name> <best_frame_index>
set -e
cd "$(dirname "$0")"
ffmpeg -loglevel error -y -framerate 30 -i "$1/f%03d.png" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart "out/$2.mp4"
ffmpeg -loglevel error -y -i "$1/f$(printf %03d $3).png" -q:v 2 "out/$2.jpg"
