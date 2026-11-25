#!/bin/bash
# usage: ./encode.sh felt needle_felt   |   ./encode.sh clay claymation
set -e
cd "$(dirname "$0")"
ffmpeg -y -loglevel error -framerate 15 -i frames/$1/$1_%03d.png -vf "fps=30,format=yuv420p" \
  -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -movflags +faststart -threads 2 out/$2.mp4
