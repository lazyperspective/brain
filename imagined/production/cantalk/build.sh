#!/usr/bin/env bash
# Build the videos of "Can we talk later?" (In Imagination, piece 01).
#   1. synthesise the score (music/score.py -> music/score.wav, seamless 37.000 s)
#   2. render the silent loop through the gallery page with Playwright (render.js): the composited 1080 × 1350 canvas
#   3. mux: one loop (37 s) and two loops (74 s), H.264 yuv420p (-tune animation) + AAC 192k, 30 fps
#   4. check: streams, durations, flashes, the loop seam, pops; loudness of the muxed audio
# SKIP_RENDER=1 reuses an existing silent render; SKIP_SCORE=1 reuses score.wav; SCRATCH sets where intermediates go;
# CRF sets the final video quality (default 21).
set -euo pipefail
cd "$(dirname "$0")"
OUT=../../../imagined-video
SCRATCH=${SCRATCH:-/tmp/claude-0/-home-user-brain/f1f7475c-3827-5141-bc67-2671553b043a/scratchpad/imagined/cantalk/vid}
SILENT="$SCRATCH/cantalk-silent.mp4"
NAME=01-can-we-talk-4x5
CRF=${CRF:-21}
mkdir -p "$OUT" "$SCRATCH"

if [ "${SKIP_SCORE:-0}" != 1 ] || [ ! -f music/score.wav ]; then python3 music/score.py; fi
if [ "${SKIP_RENDER:-0}" != 1 ] || [ ! -f "$SILENT" ]; then CRF=12 node render.js video "$SILENT" 1; fi

# one loop, then two loops by concatenating the encoded loop (the picture is a pure function of t, so loop 2 = loop 1)
ffmpeg -loglevel error -y -i "$SILENT" -i music/score.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -tune animation -crf "$CRF" -pix_fmt yuv420p -r 30 -threads 2 \
  -c:a aac -b:a 192k -ar 48000 -t 37 -movflags +faststart "$OUT/$NAME.mp4"
ffmpeg -loglevel error -y -stream_loop 1 -i "$SILENT" -stream_loop 1 -i music/score.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -tune animation -crf "$CRF" -pix_fmt yuv420p -r 30 -threads 2 \
  -c:a aac -b:a 192k -ar 48000 -t 74 -movflags +faststart "$OUT/$NAME-2loops.mp4"

for f in "$OUT/$NAME.mp4" "$OUT/$NAME-2loops.mp4"; do
  echo "== $f ($(du -h "$f" | cut -f1))"
  ffprobe -v error -count_frames -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_frames,duration,sample_rate,channels,bit_rate \
    -show_entries format=duration -of compact "$f"
done
echo "== loudness of the muxed AAC (two loops, so the seam is measured inside the programme)"
ffmpeg -hide_banner -nostats -i "$OUT/$NAME-2loops.mp4" -map 0:a -filter_complex ebur128=peak=true -f null - 2>&1 | grep -E '^\s+(I:|LRA:|Peak:)' | tail -3
node flashcheck.js "$OUT/$NAME.mp4"
node seamcheck.js "$OUT/$NAME.mp4"
node motioncheck.js "$OUT/$NAME.mp4"
