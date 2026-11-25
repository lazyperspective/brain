#!/bin/bash
cd "$(dirname "$0")"
LAST=$(ls frames_tin | tail -1 | sed 's/f0*\([0-9]*\).png/\1/'); START=$((LAST+1))
node render.cjs tin frames_tin $START 89 1 2>&1 | grep -v THREE
ffmpeg -loglevel error -y -framerate 30 -pattern_type glob -i "frames_tin/f*.png" -frames:v 90 \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart out/tin_toys.mp4 && echo encoded
