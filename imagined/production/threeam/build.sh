#!/usr/bin/env bash
# Build the videos of "3 a.m." (In Imagination, piece 02).
#   1. dump the picture's clock (cues.js -> music/cues.json) and synthesise the score (music/score.py -> music/score.wav, 38.000 s)
#   2. render the silent loop through the gallery page with Playwright (render.js): 1080 x 1350, 30 fps, -tune animation
#   3. mux: one loop (38 s) and two loops (76 s), H.264 yuv420p + AAC 192k
#   4. check: durations and frame counts, flashes, the loop seam, pops
# SKIP_RENDER=1 reuses an existing silent render; SCRATCH sets where intermediates go; CRF sets the video quality.
set -euo pipefail
cd "$(dirname "$0")"
OUT=../../../imagined-video
SCRATCH=${SCRATCH:-/tmp/claude-0/-home-user-brain/f1f7475c-3827-5141-bc67-2671553b043a/scratchpad/imagined/threeam/vid}
SILENT="$SCRATCH/threeam-silent.mp4"
mkdir -p "$OUT" "$SCRATCH"
D=38
CUTS=$(node -e "global.window={PIECES:[]};eval(require('fs').readFileSync('../../js/pieces/02-three-am.js','utf8'));console.log(window.__threeamCore.CUTS.join(','))")

node cues.js > music/cues.json
python3 music/score.py
if [ "${SKIP_RENDER:-0}" != 1 ] || [ ! -f "$SILENT" ]; then CRF=${CRF:-21} node render.js video "$SILENT" 1; fi

ffmpeg -loglevel error -y -i "$SILENT" -i music/score.wav -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 192k -ar 48000 -t $D -movflags +faststart "$OUT/02-three-am-4x5.mp4"
ffmpeg -loglevel error -y -stream_loop 1 -i "$SILENT" -stream_loop 1 -i music/score.wav -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 192k -ar 48000 -t $((2 * D)) -movflags +faststart "$OUT/02-three-am-4x5-2loops.mp4"

for f in "$OUT/02-three-am-4x5.mp4" "$OUT/02-three-am-4x5-2loops.mp4"; do
  echo "== $f ($(du -h "$f" | cut -f1))"
  ffprobe -v error -count_frames -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_frames,duration,sample_rate,channels \
    -show_entries format=duration -of compact "$f"
done
echo "== loudness of the muxed AAC (one loop)"
ffmpeg -hide_banner -nostats -i "$OUT/02-three-am-4x5.mp4" -filter_complex ebur128=peak=true -f null - 2>&1 | grep -E '^\s+(I:|Peak:|LRA:)' | tail -3
echo "== flashes";  node flashcheck.js "$OUT/02-three-am-4x5.mp4"
echo "== seam";     CUTS="0,$CUTS" node seamcheck.js "$SILENT"
echo "== pops";     CUTS="0,$CUTS" node motioncheck.js "$SILENT"
