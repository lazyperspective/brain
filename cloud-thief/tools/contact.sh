#!/bin/bash
# Render a set of key times at reduced res and tile them into a labelled contact sheet.
# usage: tools/contact.sh "0.5,2.9,4.6" out.png [w h]
cd "$(dirname "$0")/.."
W=${3:-640}; H=${4:-360}
rm -rf stills/cs && mkdir -p stills/cs
node render.mjs --stills "$1" --w $W --h $H --out stills/cs --prefix cs 2>&1 | grep -vE "Driver|GPU stall"
files=$(ls stills/cs/*.png | sort)
args=""; for f in $files; do t=$(basename $f .png | sed 's/cs_//'); args="$args -label t=$t $f"; done
montage $args -tile 4x -geometry +4+4 -pointsize 16 -background '#111' -fill white "$2"
