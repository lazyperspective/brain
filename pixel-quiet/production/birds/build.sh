#!/usr/bin/env bash
# Build the videos of "Migrating Birds" (Quiet Hours, piece 8).
#   1. synthesise the score (music/score.py -> music/score.wav, seamless 40.000 s)
#   2. render the silent loop through the gallery page with Playwright (render.js): 360 x 450 frames, x3 nearest
#   3. mux: one loop (40.000 s) and two loops (80.000 s), H.264 yuv420p + AAC, 1080 x 1350, 30 fps
#   4. check: durations, frame counts, flashes, the loop seam (video), hidden birds and pops (core)
#   5. stills and a contact sheet in pixel-quiet-video/stills-08
# SKIP_RENDER=1 reuses an existing silent render; SCRATCH sets where intermediates go; CRF sets the video quality.
set -euo pipefail
cd "$(dirname "$0")"
OUT=../../../pixel-quiet-video
SCRATCH=${SCRATCH:-/tmp/claude-0/-home-user-brain/f1f7475c-3827-5141-bc67-2671553b043a/scratchpad/birds/vid}
SILENT="$SCRATCH/birds-silent.mp4"
STILLS="$OUT/stills-08"
mkdir -p "$OUT" "$SCRATCH" "$STILLS"

[ -f music/score.wav ] || python3 music/score.py
if [ "${SKIP_RENDER:-0}" != 1 ] || [ ! -f "$SILENT" ]; then node render.js video "$SILENT" 1; fi

ffmpeg -loglevel error -y -i "$SILENT" -i music/score.wav -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 192k -ar 48000 -t 40 -movflags +faststart "$OUT/08-migrating-birds-4x5.mp4"
ffmpeg -loglevel error -y -stream_loop 1 -i "$SILENT" -stream_loop 1 -i music/score.wav -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 192k -ar 48000 -t 80 -movflags +faststart "$OUT/08-migrating-birds-4x5-2loops.mp4"

for f in "$OUT/08-migrating-birds-4x5.mp4" "$OUT/08-migrating-birds-4x5-2loops.mp4"; do
  echo "== $f ($(du -h "$f" | cut -f1))"
  ffprobe -v error -count_frames -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_frames,duration,sample_rate,channels \
    -show_entries format=duration -of compact "$f"
done
node flashcheck.js "$OUT/08-migrating-birds-4x5.mp4"
node seamcheck.js "$SILENT"
node hidecheck.js 30
node motioncheck.js 30 | tail -2

# stills of the story beats, and a contact sheet
TIMES=0,2.8,6,11.5,15,18,21,26,28.6,30.6,34.6,38.5
node render.js stills "$STILLS" "$TIMES"
python3 - "$STILLS" "$TIMES" <<'PY'
import sys, os
from PIL import Image
d, ts = sys.argv[1], [float(x) for x in sys.argv[2].split(',')]
ims = [Image.open(os.path.join(d, 'birds-%s.png' % ('%.2f' % t).rjust(5, '0'))).convert('RGB') for t in ts]
w, h = ims[0].size; cols = 4; rows = (len(ims) + cols - 1) // cols; s = 3
tw, th = w // s, h // s
sheet = Image.new('RGB', (cols * tw + (cols + 1) * 8, rows * th + (rows + 1) * 8), (20, 20, 31))
for k, im in enumerate(ims): sheet.paste(im.resize((tw, th), Image.LANCZOS), (8 + (k % cols) * (tw + 8), 8 + (k // cols) * (th + 8)))
sheet.save(os.path.join(d, 'contact-sheet.png')); print('contact sheet', os.path.join(d, 'contact-sheet.png'))
PY
