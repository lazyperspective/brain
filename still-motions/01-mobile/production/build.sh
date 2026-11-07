#!/usr/bin/env bash
# Build every deliverable of "Mobile" (01-mobile) and write production/verification.txt.
#   T=<seconds> sets the master-still moment (default 7.0). SKIP_VIDEO=1 reuses the existing one-loop video.
set -euo pipefail
cd "$(dirname "$0")"
OUT=../../../still-motions-output/01-mobile
T=${T:-7.0}
ONE="$OUT/01-mobile-4x5.mp4"; TWO="$OUT/01-mobile-4x5-2loops.mp4"
mkdir -p "$OUT/stills"
if [ "${SKIP_VIDEO:-0}" != 1 ] || [ ! -f "$ONE" ]; then node render.js video "$ONE" 3; fi
ffmpeg -loglevel error -y -stream_loop 1 -i "$ONE" -c copy -movflags +faststart "$TWO"
# master still: rendered at 4320x5400 and box-filtered in linear light to 2160x2700
node render.js stills "$OUT" "$T" 2
mv "$OUT/mobile-4k-t$(printf '%05.2f' "$T").png" "$OUT/01-mobile-4k.png"
python3 -c "from PIL import Image; Image.open('$OUT/01-mobile-4k.png').convert('RGB').save('$OUT/01-mobile-x.jpg', quality=94, subsampling=0, optimize=True)"
node stills.js "$OUT/stills" 6
{
  echo "Mobile (01-mobile) verification, $(date -u +%Y-%m-%dT%H:%MZ)"
  echo
  echo "== deliverables"
  for f in "$OUT/01-mobile-4k.png" "$OUT/01-mobile-x.jpg" "$ONE" "$TWO"; do echo "$(basename "$f")  $(du -k "$f" | cut -f1) KB"; done
  echo "x.jpg: $(ffprobe -v error -show_entries stream=width,height,pix_fmt -of csv=p=0 "$OUT/01-mobile-x.jpg") (yuvj444p = 4:4:4)"
  echo "4k.png: $(ffprobe -v error -show_entries stream=width,height,pix_fmt -of csv=p=0 "$OUT/01-mobile-4k.png")"
  for f in "$ONE" "$TWO"; do
    ffprobe -v error -count_frames -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_frames:format=duration -of compact "$f"
    ffprobe -v error -show_entries stream=codec_type -of csv=p=0 "$f" | tr '\n' ' '; echo "(streams)"
  done
  echo
  echo "== seam (render level, exact frames)"; node render.js seam
  echo "== seam (encoded one-loop video)"; node seamcheck.js "$ONE"
  echo "== seam (encoded two-loop video, decoded)"; node seamcheck.js "$TWO" | sed -n 2,4p
  echo "== flash (encoded video)"; node flashcheck.js "$ONE"
  echo "== pops (encoded video)"; node popcheck.js "$ONE"
  echo "== whole loop at render level (steps, pops, luminance)"; node render.js steps
  echo "== determinism"; node render.js determinism
} 2>&1 | tee verification.txt
