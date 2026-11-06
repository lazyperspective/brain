#!/usr/bin/env bash
# Build the videos of "The Staircase".
#   1. check the choreography (choreocheck.js: lead, blueprint margins, spacing, one exact lap per loop)
#   2. the sound: events.json from the same choreography, then music/score.py -> music/score.wav (seamless 20.000 s)
#   3. render the silent loop through index.html?export with Playwright (render.js): 2160 x 2700 internally,
#      box-filtered to 1080 x 1350, 30 fps, 600 frames, H.264 CRF 17
#   4. mux: one loop (20.000 s) and two loops (40.000 s), H.264 yuv420p + AAC 192k, faststart
#   5. check: durations, frame counts, flashes, the loop seam (and the largest frame steps, to catch pops)
#   6. stills (key moments) and a contact sheet into the-staircase-video/stills/
# SKIP_RENDER=1 reuses an existing silent render; SCRATCH sets where intermediates go; CRF sets the video quality;
# JOBS=n renders in n parallel browser processes (default 1: SwiftShader already uses every core, so more jobs gain
# nothing, and each chunk boundary costs a keyframe) and concatenates losslessly.
set -euo pipefail
cd "$(dirname "$0")"
OUT=../../the-staircase-video
SCRATCH=${SCRATCH:-/tmp/claude-0/-home-user-brain/f1f7475c-3827-5141-bc67-2671553b043a/scratchpad/staircase/vid}
SILENT="$SCRATCH/staircase-silent.mp4"
JOBS=${JOBS:-1}
mkdir -p "$OUT/stills" "$SCRATCH"

node choreocheck.js | tee "$SCRATCH/choreocheck.txt" | tail -1 | grep -q PASS || { echo "choreography check failed"; cat "$SCRATCH/choreocheck.txt"; exit 1; }
node music/events.js > /dev/null
[ -f music/score.wav ] && [ "${FORCE_SCORE:-0}" != 1 ] || python3 music/score.py > /dev/null

if [ "${SKIP_RENDER:-0}" != 1 ] || [ ! -f "$SILENT" ]; then
  t0=$(date +%s)
  # parallel chunks: each process renders a contiguous frame range (every frame is a pure function of t), then the
  # chunks are concatenated without re-encoding (same encoder settings, each chunk starts on a keyframe)
  pids=(); list="$SCRATCH/chunks.txt"; : > "$list"
  for ((j = 0; j < JOBS; j++)); do
    f0=$(( 600 * j / JOBS )); f1=$(( 600 * (j + 1) / JOBS ))
    F0=$f0 F1=$f1 node render.js video "$SCRATCH/chunk$j.mp4" 1 > "$SCRATCH/chunk$j.log" 2>&1 &
    pids+=($!); echo "file 'chunk$j.mp4'" >> "$list"
  done
  for p in "${pids[@]}"; do wait "$p"; done
  ffmpeg -loglevel error -y -f concat -safe 0 -i "$list" -c copy "$SILENT"
  echo "render: $(( $(date +%s) - t0 )) s wall clock for 600 frames with $JOBS jobs" | tee "$SCRATCH/render-time.txt"
fi

ffmpeg -loglevel error -y -i "$SILENT" -i music/score.wav -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 192k -ar 48000 -t 20 -movflags +faststart "$OUT/the-staircase-4x5.mp4"
ffmpeg -loglevel error -y -stream_loop 1 -i "$SILENT" -stream_loop 1 -i music/score.wav -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 192k -ar 48000 -t 40 -movflags +faststart "$OUT/the-staircase-4x5-2loops.mp4"

for f in "$OUT/the-staircase-4x5.mp4" "$OUT/the-staircase-4x5-2loops.mp4"; do
  echo "== $f ($(du -h "$f" | cut -f1))"
  ffprobe -v error -count_frames -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_frames,duration,sample_rate,channels \
    -show_entries format=duration -of compact "$f"
done
node flashcheck.js "$OUT/the-staircase-4x5.mp4" | tee "$SCRATCH/flashcheck.txt"
node seamcheck.js "$SILENT" | tee "$SCRATCH/seamcheck.txt"

if [ "${SKIP_STILLS:-0}" != 1 ]; then
  SHEET="$OUT/stills/contact-sheet.png" COLS=4 SHEETDIV=3 node render.js stills "$OUT/stills" 0,1.2,2.2,2.6,4.2,5.6,6.1,6.75,9.5,12.2,15.6,17.6 > /dev/null
  echo "stills + contact sheet in $OUT/stills"
fi
