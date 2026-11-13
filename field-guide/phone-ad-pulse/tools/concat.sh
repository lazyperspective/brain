#!/bin/bash
# tools/concat.sh <chunkdir> <out.mp4> [audio.wav]
set -e; D=$1; O=$2; A=$3; L=$D/list.txt; rm -f $L; for f in $(ls $D/c_*.mp4 | sort); do echo "file '$(realpath $f)'" >> $L; done
if [ -n "$A" ]; then ffmpeg -y -loglevel error -f concat -safe 0 -i $L -i $A -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart $O
else ffmpeg -y -loglevel error -f concat -safe 0 -i $L -c copy -movflags +faststart $O; fi
echo wrote $O
