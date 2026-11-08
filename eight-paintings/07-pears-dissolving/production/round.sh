#!/bin/bash
# usage: round.sh N  -> renders the master and stores snapshots/roundN.png + review crops in scratch
set -e
N=$1
OUT=/home/user/brain/eight-paintings-output/07-pears-dissolving
SP=${SP:-/tmp/claude-0/-home-user-brain/f1f7475c-3827-5141-bc67-2671553b043a/scratchpad}
cd "$(dirname "$0")"
node render.js $OUT/07-pears-dissolving-4k.png 1 paint | grep -E "ERR|wrote"
mkdir -p $OUT/snapshots
cp $OUT/07-pears-dissolving-4k.png $OUT/snapshots/round$N.png
convert $OUT/07-pears-dissolving-4k.png -resize 1080x1350 $SP/r${N}_small.png
