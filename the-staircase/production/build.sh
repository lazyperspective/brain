#!/usr/bin/env bash
# Build the videos of "The Staircase" (v2).
#   1. check the choreography (choreocheck.js: build always in time, nobody on air, one exact module per loop)
#   2. the sound: events.json from the same choreography, then music/score.py -> music/score.wav (seamless 20.000 s)
#   3. render the silent loop through index.html?export with Playwright (render.js): 2160 x 2700 internally,
#      box-filtered to 1080 x 1350, 30 fps, 600 frames, H.264 CRF 17
#   4. mux: one loop (20.000 s) and two loops (40.000 s), H.264 High yuv420p + AAC 256k (192k let the encoder overshoot
#      a transient by ~3 dB), faststart
#   5. check: streams, durations, frame counts, flashes, the video loop seam, loudness / true peak of the muxed audio
#   6. stills (key moments) and a contact sheet into the-staircase-video/stills/
#   7. production/verification.txt: everything above in one place
# SKIP_RENDER=1 reuses an existing silent render; SKIP_STILLS=1 skips step 6; SCRATCH sets where intermediates go;
# CRF sets the video quality; JOBS=n renders in n parallel browser processes (default 1: SwiftShader already uses every
# core) and concatenates losslessly.
set -euo pipefail
cd "$(dirname "$0")"
OUT=../../the-staircase-video
SCRATCH=${SCRATCH:-/tmp/claude-0/-home-user-brain/f1f7475c-3827-5141-bc67-2671553b043a/scratchpad/staircase/vid2}
SILENT="$SCRATCH/staircase-silent.mp4"
JOBS=${JOBS:-1}
mkdir -p "$OUT/stills" "$SCRATCH"

node choreocheck.js > "$SCRATCH/choreocheck.txt"; tail -1 "$SCRATCH/choreocheck.txt" | grep -q PASS || { echo "choreography check failed"; cat "$SCRATCH/choreocheck.txt"; exit 1; }
node music/events.js > "$SCRATCH/events.txt"
python3 music/score.py > /dev/null

if [ "${SKIP_RENDER:-0}" != 1 ] || [ ! -f "$SILENT" ]; then
  t0=$(date +%s)
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
  -c:a aac -b:a 256k -ar 48000 -t 20 -movflags +faststart "$OUT/the-staircase-4x5.mp4"
ffmpeg -loglevel error -y -stream_loop 1 -i "$SILENT" -stream_loop 1 -i music/score.wav -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 256k -ar 48000 -t 40 -movflags +faststart "$OUT/the-staircase-4x5-2loops.mp4"

{
  for f in "$OUT/the-staircase-4x5.mp4" "$OUT/the-staircase-4x5-2loops.mp4"; do
    echo "== $(basename "$f") ($(du -h "$f" | cut -f1))"
    ffprobe -v error -count_frames -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_frames,duration,sample_rate,channels \
      -show_entries format=duration -of compact "$f"
    echo "faststart (moov before mdat): $(python3 -c "
import sys; b=open(sys.argv[1],'rb').read(1<<20); m=b.find(b'moov'); d=b.find(b'mdat'); print('yes' if 0<=m<d or (m>=0 and d<0) else 'NO')" "$f")"
    echo "loudness of the muxed AAC (ffmpeg ebur128, true peak):"
    ffmpeg -hide_banner -nostats -i "$f" -filter_complex ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I:|LRA:|Peak:)" | sed 's/^ */  /'
  done
} | tee "$SCRATCH/streams.txt"
node flashcheck.js "$OUT/the-staircase-4x5.mp4" | tee "$SCRATCH/flashcheck.txt"
node seamcheck.js "$SILENT" | tee "$SCRATCH/seamcheck.txt"

STILLS=0,1.2,4.2,5.4,6.25,7.55,8.5,9.25,11.3,13.6,13.97,14.5
if [ "${SKIP_STILLS:-0}" != 1 ]; then
  # clear the previous stills by name (no globs)
  for t in 00.00 01.20 02.20 02.60 04.20 05.60 06.10 06.75 09.50 12.20 15.60 17.60 05.40 06.25 07.55 08.50 09.25 11.30 13.60 13.97 14.50; do
    rm -f "$OUT/stills/staircase-$t.png"
  done
  rm -f "$OUT/stills/contact-sheet.png"
  SHEET="$OUT/stills/contact-sheet.png" COLS=4 SHEETDIV=3 node render.js stills "$OUT/stills" "$STILLS" > /dev/null
  echo "stills + contact sheet in $OUT/stills"
fi

# ---- production/verification.txt
{
  echo "THE STAIRCASE v2 (polish pass: zoom-out, shading, clean block fill) - verification (written by production/build.sh)"
  echo
  echo "### choreography (choreocheck.js)"; cat "$SCRATCH/choreocheck.txt"; echo
  echo "### video streams, durations, loudness of the deliverables"; cat "$SCRATCH/streams.txt"; echo
  echo "### video loop seam (seamcheck.js on the silent master)"; cat "$SCRATCH/seamcheck.txt"; echo
  echo "### photosensitivity (flashcheck.js)"; cat "$SCRATCH/flashcheck.txt"; echo
  echo "### sound (music/score.py, measured on score.wav)"; cat music/verification.txt; echo
  echo "### render time"; cat "$SCRATCH/render-time.txt" 2>/dev/null || true
  for j in $(seq 0 $((JOBS - 1))); do cat "$SCRATCH/chunk$j.mp4.timing.txt" 2>/dev/null || true; done
} > verification.txt
echo "wrote production/verification.txt"
