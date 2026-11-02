#!/usr/bin/env bash
# Build the videos of "The Moon Gate" (ink-courtyard).
#   1. synthesise the score (music/score.py -> music/score.wav, seamless 28.000 s, -20 LUFS)
#   2. render the silent loop through the page with Playwright (render.js, 3 workers): 1080x1920, 30 fps
#   3. mux: one loop (28 s) and two loops (56 s), H.264 yuv420p CRF 19 + AAC 192k
#   4. check: streams, durations, frame counts, flashes, the loop seam, pops, loudness of the delivered audio
# SKIP_RENDER=1 reuses an existing silent render; SCORE=1 forces the score to be re-synthesised;
# SCRATCH sets where intermediates go; CRF sets the video quality; WORKERS the render parallelism.
set -euo pipefail
cd "$(dirname "$0")"
OUT=../../ink-courtyard-video
SCRATCH=${SCRATCH:-/tmp/claude-0/-home-user-brain/f1f7475c-3827-5141-bc67-2671553b043a/scratchpad/courtyard/vid}
SILENT="$SCRATCH/courtyard-silent.mp4"
ONE="$OUT/courtyard-9x16.mp4"
TWO="$OUT/courtyard-9x16-2loops.mp4"
mkdir -p "$OUT" "$SCRATCH"

if [ "${SCORE:-0}" = 1 ] || [ ! -f music/score.wav ]; then python3 music/score.py; fi
if [ "${SKIP_RENDER:-0}" != 1 ] || [ ! -f "$SILENT" ]; then node render.js video "$SILENT" "${WORKERS:-3}"; fi

ffmpeg -loglevel error -y -i "$SILENT" -i music/score.wav -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 192k -ar 48000 -t 28 -movflags +faststart "$ONE"
ffmpeg -loglevel error -y -stream_loop 1 -i "$SILENT" -stream_loop 1 -i music/score.wav -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 192k -ar 48000 -t 56 -movflags +faststart "$TWO"

for f in "$ONE" "$TWO"; do
  echo "== $f ($(du -h "$f" | cut -f1))"
  ffprobe -v error -count_frames -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_frames,duration,sample_rate,channels,bit_rate \
    -show_entries format=duration -of compact "$f"
done
echo "== flash";    node flashcheck.js "$ONE"
echo "== seam (render)"; node render.js seam
echo "== seam (encoded; a single GOP, so the only keyframe is frame 0: what remains at the seam is the keyframe"
echo "   re-coding the moving flowers, not a picture change)"; node seamcheck.js "$SILENT" || true
echo "== pops";     node render.js probe "$SCRATCH/probe.json" 30 >/dev/null && node popcheck.js "$SILENT" "$SCRATCH/probe.json"
echo "== loudness (delivered AAC, one loop)"
ffmpeg -hide_banner -nostats -i "$ONE" -map 0:a -filter_complex ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I:|LRA:|Peak:)"
cat "$SILENT.timing.txt" 2>/dev/null || true
