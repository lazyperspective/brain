#!/bin/sh
# THE LANTERN HOUR -- render the whole film.
# Needs: python3 with numpy, scipy, opencv-python-headless; ffmpeg. No browser, no GPU.
# About 15 minutes on four cores, under 2 GB of memory per process.
set -e
cd "$(dirname "$0")"
: "${LH_WORK:=/tmp/lh-work}"
export LH_WORK
mkdir -p "$LH_WORK"
# plates that several shots share are built once, before the shots run side by side
python3 -c "from rig import *; import shots; shots.final_paths(); shots.fin_plate(); shots.two_shot_setup()"
python3 -c "from timeline import ORDER; print('\n'.join(n for n, d in ORDER))" | xargs -P 4 -I{} python3 film.py shot {}
python3 sound.py
./assemble.sh
