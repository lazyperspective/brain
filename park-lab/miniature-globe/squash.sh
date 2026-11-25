#!/bin/bash
# convert finished PNG frames to max-quality JPEG to stay under the disk budget (keeps a few candidate stills as PNG)
cd "$(dirname "$0")"
for d in frames/tilt frames/globe; do
  for f in $(find $d -name 'f*.png' -mmin +0.5 | sort); do
    b=${f%.png}; n=$(basename $b)
    ffmpeg -loglevel error -y -i $f -q:v 1 -qmin 1 $b.jpg && { case $n in f072|f076|f080|f084) ;; *) rm $f;; esac; }
  done
done
