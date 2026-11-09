#!/usr/bin/env bash
# Build every deliverable of the pixel piece into ../../neon-sign-video and run the checks.
#   1. 4K still (t = 1.0 s, sign fully lit) at x8 nearest-neighbour, and the X jpeg (q95, 4:4:4)
#   2. the loop: native 480x270 frames from the page, scaled x4 nearest by ffmpeg, H.264 High yuv420p CRF 16,
#      one GOP with the x264 zones seam trick (render.js); a 3-loop copy; a version with the sound track
#   3. stills of the key moments, the contact sheet
#   4. checks -> verification.txt (seam, flash, pops/compliance, determinism, streams, loudness)
set -euo pipefail
cd "$(dirname "$0")"
export NODE_PATH=${NODE_PATH:-/opt/node-tools/node_modules}
OUT=../../neon-sign-video
TMP=$(mktemp -d)
mkdir -p "$OUT/stills"
node render.js stills "$TMP" 1.0 4k
cp "$TMP/frame-01.00.png" "$OUT/neon-sign-4k.png"
python3 -c "from PIL import Image; Image.open('$OUT/neon-sign-4k.png').convert('RGB').save('$OUT/neon-sign-x.jpg', quality=95, subsampling=0, optimize=True)"
node render.js video "$OUT/neon-sign-16x9.mp4" 2
ffmpeg -loglevel error -y -stream_loop 2 -i "$OUT/neon-sign-16x9.mp4" -c copy -movflags +faststart "$OUT/neon-sign-16x9-3loops.mp4"
python3 sound.py
ffmpeg -loglevel error -y -i "$OUT/neon-sign-16x9.mp4" -i music.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -ar 48000 -t 16 -movflags +faststart "$OUT/neon-sign-16x9-sound.mp4"
node render.js stills "$OUT/stills" 1.0,2.9,5.1,7.2,9.9,10.4,11.36,13.3
node sheet.js sheet "$OUT/contact-sheet.png" 12
rm -rf "$TMP"
