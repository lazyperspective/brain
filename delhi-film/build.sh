#!/bin/bash
# Renders 'Dilli, Inlaid' in resumable 40-frame chunks, then concatenates, muxes and makes the share copy + contact sheet.
#   ./build.sh            final (1920x1080, 2x supersampled geometry)
#   PREVIEW=1 ./build.sh  quick half-res preview into out/preview.mp4
# Re-running skips chunks that already exist (delete chunks/cNNN.mp4 to redo one).
set -e
cd "$(dirname "$0")"
mkdir -p out
if [ -n "$PREVIEW" ]; then export SS=1 SCALE=0.5 CHUNKDIR=chunks_preview; OUT=out/preview.mp4; else export SS=${SS:-2} SCALE=1 CHUNKDIR=chunks; OUT=out/dilli_inlaid_1080p.mp4; fi
J=${JOBS:-3}
[ -f out/soundtrack.wav ] || python3 music.py
for k in $(seq 0 $((J-1))); do python3 film.py all $k $J & done
wait
N=$(python3 -c "import film;print((film.F_END+film.CHUNK-1)//film.CHUNK)")
: > $CHUNKDIR/list.txt
for i in $(seq 0 $((N-1))); do f=$(printf "c%03d.mp4" $i); [ -f $CHUNKDIR/$f ] || { echo "missing $f"; exit 1; }; echo "file '$f'" >> $CHUNKDIR/list.txt; done
# one encoder at a time from here on
ffmpeg -y -loglevel error -f concat -safe 0 -i $CHUNKDIR/list.txt -i out/soundtrack.wav -c:v copy -c:a aac -b:a 256k -movflags +faststart -shortest $OUT
echo "wrote $OUT"
if [ -z "$PREVIEW" ]; then
  ffmpeg -y -loglevel error -i $OUT -c:v libx264 -preset medium -crf 20 -maxrate 12M -bufsize 24M -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart out/dilli_inlaid_share.mp4
  python3 sheet.py $OUT out/contact_sheet.jpg
fi
