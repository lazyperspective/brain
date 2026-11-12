#!/usr/bin/env bash
# final.sh : builds every deliverable of "Fable 5.2: A Field Guide" into ../field-guide-video
#   1. exports the timeline's cues and builds the soundtrack (fluidsynth + numpy), mastered to -14 LUFS
#   2. renders the 1200 frames (Playwright + SwiftShader WebGL2, 2x supersampled) into the silent H.264 master
#      and a near-lossless cache
#   3. muxes the AAC 320k soundtrack, renders the 2160x2700 poster natively, cuts the contact sheet, stills and
#      hand-over strips from the cache, runs the flash check, writes captions.srt and verification.txt
set -euo pipefail
cd "$(dirname "$0")"
OUT=../field-guide-video
mkdir -p "$OUT/stills" "$OUT/strips" "$OUT/snapshots" cache
node tools/cues.js audio/cues.json
python3 audio/score.py "$OUT/score.wav" audio/audio-report.txt
node tools/render.js "$OUT/field-guide-4x5-silent.mp4" cache/master.mkv 0 1199 "${WORKERS:-3}" 2
node tools/deliver.js
echo "done: $OUT"
