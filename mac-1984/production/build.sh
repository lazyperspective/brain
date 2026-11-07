#!/usr/bin/env bash
# Full build: cue list -> synthesized audio -> parallel frame render (piped to x264) -> concat -> mux.
#   bash build.sh             (writes /home/user/brain/mac-1984-video/mac-1984-4x3.mp4)
#   JOBS=4 CRF=15 bash build.sh
set -euo pipefail
cd "$(dirname "$0")"
OUT=/home/user/brain/mac-1984-video
JOBS=${JOBS:-4}
mkdir -p "$OUT"
node render.js cues "$OUT/cues.json"
python3 audio.py "$OUT/cues.json" "$OUT/mac-1984-audio.wav" > "$OUT/audio.log" 2>&1 &
APID=$!
N=$(node -e "const d=require('$OUT/cues.json').duration; console.log(Math.round(d*30))")
STEP=$(( (N + JOBS - 1) / JOBS ))
PIDS=()
for ((j=0; j<JOBS; j++)); do
  F0=$(( j * STEP )); F1=$(( (j+1) * STEP )); [ $F1 -gt $N ] && F1=$N
  node render.js video "$OUT/part$j.mp4" $F0 $F1 > "$OUT/part$j.log" 2>&1 &
  PIDS+=($!)
done
for p in "${PIDS[@]}"; do wait $p; done
wait $APID
: > "$OUT/parts.txt"
for ((j=0; j<JOBS; j++)); do echo "file 'part$j.mp4'" >> "$OUT/parts.txt"; done
ffmpeg -loglevel error -y -f concat -safe 0 -i "$OUT/parts.txt" -i "$OUT/mac-1984-audio.wav" \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart "$OUT/mac-1984-4x3.mp4"
for ((j=0; j<JOBS; j++)); do rm -f "$OUT/part$j.mp4" "$OUT/part$j.log"; done
rm -f "$OUT/parts.txt"
ffprobe -v error -show_entries format=duration:stream=codec_name,profile,width,height,pix_fmt,r_frame_rate -of compact "$OUT/mac-1984-4x3.mp4"
