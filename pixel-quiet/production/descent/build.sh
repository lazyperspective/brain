#!/usr/bin/env bash
# Build the videos of "The Descent" (Quiet Hours, piece 5).
#   1. synthesise the score (music/score.py -> music/score.wav, seamless 32.000 s)
#   2. render the silent loop through the gallery page with Playwright (render.js): 360 x 450 frames, x3 nearest
#   3. mux: one loop (32.000 s) and two loops (64.000 s), H.264 yuv420p + AAC, 1080 x 1350, 30 fps
#   4. check: durations, frame counts, flashes, the loop seam
# SKIP_RENDER=1 reuses an existing silent render; SCRATCH sets where intermediates go.
set -euo pipefail
cd "$(dirname "$0")"
OUT=../../../pixel-quiet-video
SCRATCH=${SCRATCH:-/tmp/claude-0/-home-user-brain/f1f7475c-3827-5141-bc67-2671553b043a/scratchpad/descent}
SILENT="$SCRATCH/descent-silent.mp4"
mkdir -p "$OUT" "$SCRATCH"

[ -f music/score.wav ] || python3 music/score.py
if [ "${SKIP_RENDER:-0}" != 1 ] || [ ! -f "$SILENT" ]; then node render.js video "$SILENT" 1; fi

ffmpeg -loglevel error -y -i "$SILENT" -i music/score.wav -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 256k -ar 48000 -t 32 -movflags +faststart "$OUT/05-the-descent-4x5.mp4"
ffmpeg -loglevel error -y -stream_loop 1 -i "$SILENT" -stream_loop 1 -i music/score.wav -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 256k -ar 48000 -t 64 -movflags +faststart "$OUT/05-the-descent-4x5-2loops.mp4"

for f in "$OUT/05-the-descent-4x5.mp4" "$OUT/05-the-descent-4x5-2loops.mp4"; do
  echo "== $f"
  ffprobe -v error -count_frames -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_frames,duration,sample_rate,channels \
    -show_entries format=duration -of compact "$f"
done
node flashcheck.js "$OUT/05-the-descent-4x5.mp4"
node seamcheck.js "$SILENT"
