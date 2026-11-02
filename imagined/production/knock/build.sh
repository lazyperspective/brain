#!/usr/bin/env bash
# Build the videos of "The Knock" (In Imagination, piece 03).
#   1. dump the picture's clock (timeline.js -> music/timeline.json) and synthesise the score (music/score.py -> score.wav, 39.000 s)
#   2. render the silent loop through the gallery page with Playwright (render.js): the 1080 x 1350 canvas, 30 fps
#   3. mux: one loop (39 s) and two loops (78 s), H.264 yuv420p -tune animation + AAC 192k
#   4. check: durations and frame counts, flashes, the loop seam, pops, loudness of the muxed audio
# SKIP_RENDER=1 reuses an existing silent render; SKIP_SCORE=1 reuses score.wav; SCRATCH sets where intermediates go; CRF the quality.
set -euo pipefail
cd "$(dirname "$0")"
OUT=../../../imagined-video
SCRATCH=${SCRATCH:-/tmp/claude-0/-home-user-brain/f1f7475c-3827-5141-bc67-2671553b043a/scratchpad/imagined/knock/vid}
SILENT="$SCRATCH/knock-silent.mp4"
V1="$OUT/03-the-knock-4x5.mp4"
V2="$OUT/03-the-knock-4x5-2loops.mp4"
export CRF=${CRF:-21}
mkdir -p "$OUT" "$SCRATCH"

node timeline.js
if [ "${SKIP_SCORE:-0}" != 1 ] || [ ! -f music/score.wav ]; then python3 music/score.py > /dev/null; fi
if [ "${SKIP_RENDER:-0}" != 1 ] || [ ! -f "$SILENT" ]; then node render.js video "$SILENT" 1; fi

ffmpeg -loglevel error -y -i "$SILENT" -i music/score.wav -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 192k -ar 48000 -t 39 -movflags +faststart "$V1"
ffmpeg -loglevel error -y -stream_loop 1 -i "$SILENT" -stream_loop 1 -i music/score.wav -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 192k -ar 48000 -t 78 -movflags +faststart "$V2"

{
for f in "$V1" "$V2"; do
  echo "== $f ($(du -h "$f" | cut -f1))"
  ffprobe -v error -count_frames -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_frames,duration,sample_rate,channels,bit_rate \
    -show_entries format=duration -of compact "$f"
done
echo; node flashcheck.js "$V1"
echo; node seamcheck.js "$SILENT"
echo; node motioncheck.js "$SILENT"
echo; echo "muxed AAC loudness (ffmpeg ebur128, true peak):"
ffmpeg -hide_banner -nostats -i "$V1" -filter_complex ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|LRA|Peak):" | tail -3
echo; cat "$SILENT.timing.txt"
} | tee checks.txt
