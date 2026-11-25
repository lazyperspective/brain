#!/bin/bash
# Usage: ./make.sh tin|felt   -> renders frames, encodes out/<name>.mp4, deletes frames
set -e
cd "$(dirname "$0")"
STYLE=$1
if [ "$STYLE" = tin ]; then NAME=tin_toys; STEP=1; FR=30; else NAME=needle_felt; STEP=2; FR=15; fi
DIR=frames_$STYLE
rm -rf $DIR
node render.cjs $STYLE $DIR 0 89 $STEP 2>&1 | grep -v THREE
ffmpeg -loglevel error -y -framerate $FR -pattern_type glob -i "$DIR/f*.png" -r 30 -frames:v 90 \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart out/$NAME.mp4
echo "encoded out/$NAME.mp4"
