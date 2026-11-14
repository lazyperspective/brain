#!/bin/sh
# WHAT THE PAPER KEPT -- render the whole film.
# Needs: python3 with numpy, scipy, opencv-python-headless; ffmpeg. No browser, no GPU.
# Roughly 20 minutes on four cores, about 2 GB of memory.
set -e
cd "$(dirname "$0")"
: "${WPK_WORK:=/tmp/wpk-work}"
export WPK_WORK
mkdir -p "$WPK_WORK" ../what-the-paper-kept-output
python3 film.py a          # the small sheet, and the big one arriving over it
python3 film.py b          # the big sheet
python3 film.py c          # the rubbing
python3 film.py events     # every mark, as a sound event
python3 sound.py
printf "file 'seg_a.mp4'\nfile 'seg_b.mp4'\nfile 'seg_c.mp4'\n" > "$WPK_WORK/list.txt"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$WPK_WORK/list.txt" -i "$WPK_WORK/soundtrack.wav" \
  -c:v copy -c:a aac -b:a 256k -movflags +faststart -shortest \
  ../what-the-paper-kept-output/what-the-paper-kept.mp4
echo "done: ../what-the-paper-kept-output/what-the-paper-kept.mp4"
