#!/usr/bin/env bash
# Build the video of a Keyframes film: FILM=red-gathers (default) or FILM=evening-walk.
#   1. synthesise the score (music/score.py or music/evening/score.py -> score.wav, 17.500 s)
#   2. render every frame through the page with Playwright (render.js video), silent H.264
#   3. mux: H.264 yuv420p + AAC, 1080 x 1920, 30 fps, 17.5 s
#   4. check: bookend pixel-diffs, flashes and the drain, durations and frame counts
# SKIP_RENDER=1 reuses an existing silent render; SCRATCH sets where intermediates go.
set -euo pipefail
cd "$(dirname "$0")"
export FILM=${FILM:-red-gathers}
OUT=../../keyframes-video
SCRATCH=${SCRATCH:-/tmp/claude-0/-home-user-brain/f1f7475c-3827-5141-bc67-2671553b043a/scratchpad/keyframes}/$FILM
if [ "$FILM" = evening-walk ]; then MUSIC=music/evening; NAME=the-evening-walk-9x16.mp4; else MUSIC=music; NAME=keyframes-9x16.mp4; fi
SILENT="$SCRATCH/silent.mp4"
mkdir -p "$OUT" "$SCRATCH"

[ -f "$MUSIC/score.wav" ] || python3 "$MUSIC/score.py"
[ "${SKIP_RENDER:-0}" = 1 ] && [ -f "$SILENT" ] || node render.js video "$SILENT"

ffmpeg -loglevel error -y -i "$SILENT" -i "$MUSIC/score.wav" -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 256k -ar 48000 -t 17.5 -movflags +faststart "$OUT/$NAME"

echo "== $OUT/$NAME"
ffprobe -v error -count_frames -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_frames,duration,sample_rate,channels \
  -show_entries format=duration -of compact "$OUT/$NAME"
node render.js check "$SCRATCH/bookends.txt"
node flashcheck.js "$OUT/$NAME" | tee "$SCRATCH/flash.txt"
