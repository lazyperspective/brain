#!/usr/bin/env bash
# Build all deliverables of "Poplars at Noon" (03-poplars-at-noon) and run the checks.
#   1. stills across the loop, contact sheet, 4K master PNG and X JPEG (stills.js)
#   2. the loop as a lossless RGB master (2160x2700 frames downscaled 2x on the GPU -> 1080x1350, 30 fps, 600 frames)
#   3. delivery: H.264 High yuv420p CRF 16 with the seam ramp (render.js encode), and the same looped twice (stream copy)
#   4. checks -> verification.txt: determinism, render-level seam, encoded seam, flashes, pops, stream properties
# MASTER_T: moment for the master still. SKIP_RENDER=1 reuses an existing master. MASTER: where the master goes.
set -euo pipefail
cd "$(dirname "$0")"
OUT=../../../still-motions-output/03-poplars-at-noon
MASTER=${MASTER:-/tmp/claude-0/-home-user-brain/f1f7475c-3827-5141-bc67-2671553b043a/scratchpad/p03/master.mkv}
ONE="$OUT/03-poplars-at-noon-4x5.mp4"
TWO="$OUT/03-poplars-at-noon-4x5-2loops.mp4"
V=verification.txt
Q() { grep -v -i "gpu stall\|swiftshader" || true; }
mkdir -p "$OUT"
if [ "${SKIP_STILLS:-0}" != 1 ]; then node stills.js "$OUT" "${MASTER_T:-0}" 2>&1 | Q; fi
if [ "${SKIP_RENDER:-0}" != 1 ] || [ ! -f "$MASTER" ]; then node render.js video "$MASTER" "${WORKERS:-2}" 2>&1 | Q; fi
node render.js encode "$MASTER" "$ONE" | tee /tmp/claude-0/-home-user-brain/f1f7475c-3827-5141-bc67-2671553b043a/scratchpad/p03/encode.log
ffmpeg -loglevel error -y -stream_loop 1 -i "$ONE" -c copy -frames:v 1200 -movflags +faststart "$TWO"
{
  echo "Poplars at Noon (03-poplars-at-noon) - verification, $(date -u +%Y-%m-%d)"
  echo "loop: 20.000 s, 600 frames at 30 fps; frames rendered at 2160x2700 and downscaled 2x in linear light"
  echo
  for f in "$ONE" "$TWO"; do
    echo "== $(basename "$f") ($(du -h "$f" | cut -f1))"
    ffprobe -v error -count_frames -show_entries stream=codec_type,codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_frames,duration -show_entries format=duration -of compact "$f"
  done
  echo "   encode: $(cat /tmp/claude-0/-home-user-brain/f1f7475c-3827-5141-bc67-2671553b043a/scratchpad/p03/encode.log | sed 's/.*(//; s/)$//')"
  echo "   faststart: $(python3 -c "
d=open('$ONE','rb').read(1<<20); print('moov before mdat' if 0 <= d.find(b'moov') < (d.find(b'mdat') if d.find(b'mdat')>=0 else 1<<30) else 'NO')")"
  echo "== stills"
  python3 -c "
import os
from PIL import Image, JpegImagePlugin
o='$OUT'
for f in ['03-poplars-at-noon-4k.png','03-poplars-at-noon-x.jpg']:
    im=Image.open(os.path.join(o,f)); s=os.path.getsize(os.path.join(o,f))
    extra = ('  chroma subsampling ' + {0:'4:4:4',1:'4:2:2',2:'4:2:0'}[JpegImagePlugin.get_sampling(im)] + ', quality 94') if f.endswith('jpg') else ''
    print('  ', f, im.size, im.mode, '%.2f MB' % (s/1e6) + extra)
"
  echo
  echo "== determinism"; node render.js determinism 2>&1 | Q
  echo; echo "== seam, render level"; node render.js seam 2>&1 | Q
  echo; echo "== seam, lossless master"; node seamcheck.js "$MASTER" | tail -3
  echo; echo "== seam, delivered MP4"; node seamcheck.js "$ONE"
  echo; echo "== seam, 2-loop MP4 (frame 1199 -> 0; the inner loop point 599 -> 600 is counted with the ordinary steps)"; node seamcheck.js "$TWO" | tail -3
  echo; echo "== flash"; node flashcheck.js "$ONE"
  echo; echo "== pops"; node popcheck.js "$ONE"
} | tee "$V"
