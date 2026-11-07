#!/usr/bin/env bash
# Full build: cue list -> synthesized audio -> parallel frame render (CDP PNG -> x264) -> concat -> mux.
#   bash build.sh                       final: 1080x1920 60 fps, CRF 16, preset slow
#   FPS=30 PRESET=veryfast OUTNAME=preview bash build.sh    quick preview
set -euo pipefail
cd "$(dirname "$0")"
OUT=/home/user/brain/phone-2030-video
JOBS=${JOBS:-3}
export FPS=${FPS:-60}
NAME=${OUTNAME:-phone-2030-9x16}
mkdir -p "$OUT"
node render.js cues "$OUT/cues.json"
python3 audio.py "$OUT/cues.json" "$OUT/phone-2030-audio.wav" > "$OUT/audio.log" 2>&1 &
APID=$!
N=$(python3 -c "import json; print(round(json.load(open('$OUT/cues.json'))['duration']*$FPS))")
STEP=$(( (N + JOBS - 1) / JOBS ))
PIDS=()
for ((j=0; j<JOBS; j++)); do
  F0=$(( j * STEP )); F1=$(( (j+1) * STEP )); [ $F1 -gt $N ] && F1=$N
  node render.js video "$OUT/part$j.mp4" $F0 $F1 > "$OUT/part$j.log" 2>&1 &
  PIDS+=($!)
done
for p in "${PIDS[@]}"; do wait $p; done
wait $APID
cat "$OUT/audio.log"
: > "$OUT/parts.txt"
for ((j=0; j<JOBS; j++)); do echo "file 'part$j.mp4'" >> "$OUT/parts.txt"; done
ffmpeg -loglevel error -y -f concat -safe 0 -i "$OUT/parts.txt" -i "$OUT/phone-2030-audio.wav" \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart "$OUT/$NAME.mp4"
for ((j=0; j<JOBS; j++)); do rm -f "$OUT/part$j.mp4" "$OUT/part$j.log"; done
rm -f "$OUT/parts.txt"
ffprobe -v error -show_entries format=duration:stream=codec_name,profile,width,height,pix_fmt,r_frame_rate -of compact "$OUT/$NAME.mp4"
