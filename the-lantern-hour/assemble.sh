#!/bin/sh
# join the rendered shots and the soundtrack: a master and a lighter copy
set -e
cd "$(dirname "$0")"
: "${LH_WORK:=/tmp/lh-work}"
OUT=${1:-../the-lantern-hour-output}
mkdir -p "$OUT"
SHOTS=$(python3 -c "from timeline import ORDER; print(' '.join(n for n, d in ORDER))")
: > "$LH_WORK/list.txt"
for s in $SHOTS; do echo "file 'seg_$s.mp4'" >> "$LH_WORK/list.txt"; done
ffmpeg -y -loglevel error -f concat -safe 0 -i "$LH_WORK/list.txt" -i "$LH_WORK/soundtrack.wav" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 256k -movflags +faststart -shortest "$OUT/the-lantern-hour.mp4"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$LH_WORK/list.txt" -i "$LH_WORK/soundtrack.wav" \
  -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart -shortest "$OUT/the-lantern-hour-web.mp4"
echo "$OUT/the-lantern-hour.mp4"
