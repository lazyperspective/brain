#!/usr/bin/env bash
# Build all deliverables of "Phosphor" (04-phosphor) and run the checks.
#   1. master still at the hero moment (t = 9.5 s: the beam sweeping over the sea, the wave curling), 2160x2700
#   2. X still: JPEG q94, 4:4:4
#   3. one-loop video (18 s, 540 frames, 2160x2700 renders box-downsampled to 1080x1350, H.264 High CRF 16 with seam
#      zones, one GOP) and a two-loop copy
#   4. stills across the loop and a contact sheet
#   5. checks -> verification.txt
set -euo pipefail
cd "$(dirname "$0")"
OUT=../../../still-motions-output/04-phosphor
mkdir -p "$OUT/stills"
HERO=${HERO:-9.5}
node render.js stills "$OUT" "$HERO" master
mv "$OUT/master-$(printf '%05.2f' "$HERO").png" "$OUT/04-phosphor-4k.png"
python3 -c "from PIL import Image; Image.open('$OUT/04-phosphor-4k.png').convert('RGB').save('$OUT/04-phosphor-x.jpg', quality=94, subsampling=0, optimize=True)"
if [ "${SKIP_VIDEO:-0}" != 1 ]; then node render.js video "$OUT/04-phosphor-4x5.mp4" "${WORKERS:-3}"; fi
ffmpeg -loglevel error -y -stream_loop 1 -i "$OUT/04-phosphor-4x5.mp4" -c copy -movflags +faststart "$OUT/04-phosphor-4x5-2loops.mp4"
node stills.js "$OUT/stills" 6
{
  echo "Phosphor (04-phosphor) verification, $(date -u +%Y-%m-%d)"
  echo
  echo "== deliverables"
  for f in 04-phosphor-4k.png 04-phosphor-x.jpg 04-phosphor-4x5.mp4 04-phosphor-4x5-2loops.mp4; do echo "$f  $(du -h "$OUT/$f" | cut -f1)"; done
  python3 -c "from PIL import Image; im=Image.open('$OUT/04-phosphor-x.jpg'); print('x.jpg', im.size, 'subsampling', __import__('PIL.JpegImagePlugin',fromlist=['x']).get_sampling(im), '(0 = 4:4:4)')"
  for f in 04-phosphor-4x5.mp4 04-phosphor-4x5-2loops.mp4; do ffprobe -v error -count_frames -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_frames:format=duration,nb_streams -of compact "$OUT/$f"; done
  echo
  echo "== seam (render level: exact frames before coding)"; node render.js seam
  echo
  echo "== seam (encoded one-loop MP4)"; node seamcheck.js "$OUT/04-phosphor-4x5.mp4"
  echo
  echo "== flash"; node flashcheck.js "$OUT/04-phosphor-4x5.mp4"
  echo
  echo "== pop"; node popcheck.js "$OUT/04-phosphor-4x5.mp4"
  echo
  echo "== determinism"; node render.js determinism
} 2>&1 | tee verification.txt
