#!/bin/bash
# Render the film in independent 2-second segments; skip segments that exist. Safe to re-run after a restart.
# usage: tools/segments.sh <outdir> <workers> [w h] [extra-query]
OUT=${1:?outdir}; WORKERS=${2:-2}; W=${3:-1920}; H=${4:-1080}; EXTRA=${5:-}
DUR=52; SEG=${SEG:-2}; cd "$(dirname "$0")/.." || exit 1; mkdir -p "$OUT/seg" "$OUT/lock"
worker() {
  for ((s = 0; s < DUR; s += SEG)); do
    f=$(printf "%s/seg/s%03d.mp4" "$OUT" "$s"); e=$((s + SEG)); [ $e -gt $DUR ] && e=$DUR
    [ -f "$f" ] && continue
    mkdir "$OUT/lock/$s" 2>/dev/null || continue           # atomic claim
    echo "$(date +%T) worker $1 → $s-$e"
    if node tools/render.js video $s $e "$f" $W $H $EXTRA >> "$OUT/render.log" 2>&1; then echo "$(date +%T) done $s"; else echo "$(date +%T) FAIL $s"; rm -f "$f"; fi
    rmdir "$OUT/lock/$s"
  done
}
rm -rf "$OUT/lock"; mkdir -p "$OUT/lock"
for ((w = 0; w < WORKERS; w++)); do worker $w & sleep 3; done; wait
echo ALLDONE
