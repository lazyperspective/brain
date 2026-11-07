#!/usr/bin/env bash
# Build all deliverables of "Poplars at Noon" (03-poplars-at-noon) and run the checks.
#   1. stills across the loop, contact sheet, 4K master PNG and X JPEG (stills.js)
#   2. the one-loop video: 2160x2700 frames downscaled 2x on the GPU, H.264 High yuv420p CRF 16, 1080x1350, 30 fps
#   3. the two-loop video (stream copy of the same encode, looped)
#   4. checks -> verification.txt: determinism, render-level seam, encoded seam, flashes, pops, stream properties
# MASTER_T sets the moment for the master still; SKIP_RENDER=1 reuses the existing one-loop video.
set -euo pipefail
cd "$(dirname "$0")"
OUT=../../../still-motions-output/03-poplars-at-noon
ONE="$OUT/03-poplars-at-noon-4x5.mp4"
TWO="$OUT/03-poplars-at-noon-4x5-2loops.mp4"
V=verification.txt
mkdir -p "$OUT"
node stills.js "$OUT" "${MASTER_T:-0}" 2>&1 | grep -v -i "gpu stall\|swiftshader"
if [ "${SKIP_RENDER:-0}" != 1 ] || [ ! -f "$ONE" ]; then node render.js video "$ONE" "${WORKERS:-2}" 2>&1 | grep -v -i "gpu stall\|swiftshader"; fi
ffmpeg -loglevel error -y -stream_loop 1 -i "$ONE" -c copy -t 40 -movflags +faststart "$TWO"
{
  echo "Poplars at Noon - verification ($(date -u +%Y-%m-%d))"
  echo
  for f in "$ONE" "$TWO"; do
    echo "== $(basename "$f") ($(du -h "$f" | cut -f1))"
    ffprobe -v error -count_frames -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_frames,duration -show_entries format=duration -of compact "$f"
    ffprobe -v error -show_entries stream=codec_type -of csv=p=0 "$f" | sort | uniq -c | sed 's/^/   streams: /'
  done
  echo "== X still: $(python3 -c "from PIL import Image; im=Image.open('$OUT/03-poplars-at-noon-x.jpg'); print(im.size, im.mode)") $(du -h "$OUT/03-poplars-at-noon-x.jpg" | cut -f1)"
  python3 -c "
from PIL import JpegImagePlugin, Image
im = Image.open('$OUT/03-poplars-at-noon-x.jpg'); print('   chroma subsampling:', {0:'4:4:4',1:'4:2:2',2:'4:2:0'}.get(JpegImagePlugin.get_sampling(im)), ' bytes:', __import__('os').path.getsize('$OUT/03-poplars-at-noon-x.jpg'))"
  echo
  echo "== determinism"; node render.js determinism 2>&1 | grep -v -i "gpu stall\|swiftshader"
  echo; echo "== seam (render level)"; node render.js seam 2>&1 | grep -v -i "gpu stall\|swiftshader"
  echo; echo "== seam (encoded)"; node seamcheck.js "$ONE"
  echo; echo "== flash"; node flashcheck.js "$ONE"
  echo; echo "== pops"; node popcheck.js "$ONE"
} | tee "$V"
