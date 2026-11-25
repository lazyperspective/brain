#!/bin/bash
# Verify a finished shot and extract its cut frames: ./finish.sh <shotId> [goodFrameIndex]
set -e
cd "$(dirname "$0")/.."
ID=$1; GOOD=$2; F=shots/$ID.mp4; S=${ID:0:2}
N=$(python3 -c "import json;print([s for s in json.load(open('plan/shots.json'))['shots'] if s['id']=='$ID'][0]['render']['frames'])")
echo "expected $N frames"
ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames,width,height,r_frame_rate,pix_fmt,codec_name -of default=nw=1 "$F"
mkdir -p render_c/check
nice -n 5 ffmpeg -loglevel error -y -i "$F" -vf "select=eq(n\,6)" -frames:v 1 -q:v 2 render_c/check/${S}_in.jpg
nice -n 5 ffmpeg -loglevel error -y -i "$F" -vf "select=eq(n\,$((N-7)))" -frames:v 1 -q:v 2 render_c/check/${S}_out.jpg
if [ -n "$GOOD" ]; then nice -n 5 ffmpeg -loglevel error -y -i "$F" -vf "select=eq(n\,$GOOD)" -frames:v 1 -q:v 2 render_c/check/${S}_still.jpg; fi
ls -la render_c/check/${S}_*
