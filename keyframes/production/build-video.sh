#!/usr/bin/env bash
# Build the video of "The Red Gathers" (keyframes experiment).
#   1. synthesise the score (music/score.py -> music/score.wav, 17.500 s)
#   2. render every frame through the page with Playwright (render.js video), silent H.264
#   3. mux: H.264 yuv420p + AAC, 1080 x 1920, 30 fps, 17.5 s
#   4. check: bookend pixel-diffs, flashes and the drain, durations and frame counts
# SKIP_RENDER=1 reuses an existing silent render; SCRATCH sets where intermediates go.
set -euo pipefail
cd "$(dirname "$0")"
OUT=../../keyframes-video
SCRATCH=${SCRATCH:-/tmp/claude-0/-home-user-brain/f1f7475c-3827-5141-bc67-2671553b043a/scratchpad/keyframes}
SILENT="$SCRATCH/keyframes-silent.mp4"
mkdir -p "$OUT" "$SCRATCH"

[ -f music/score.wav ] || python3 music/score.py
[ "${SKIP_RENDER:-0}" = 1 ] && [ -f "$SILENT" ] || node render.js video "$SILENT"

ffmpeg -loglevel error -y -i "$SILENT" -i music/score.wav -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 256k -ar 48000 -t 17.5 -movflags +faststart "$OUT/keyframes-9x16.mp4"

echo "== $OUT/keyframes-9x16.mp4"
ffprobe -v error -count_frames -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_frames,duration,sample_rate,channels \
  -show_entries format=duration -of compact "$OUT/keyframes-9x16.mp4"
node render.js check "$SCRATCH/bookends.txt"
node flashcheck.js "$OUT/keyframes-9x16.mp4" | tee "$SCRATCH/flash.txt"
