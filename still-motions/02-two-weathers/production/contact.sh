#!/bin/sh
# contact sheet of the stills in <dir> (frame-*.png): 3 x 2 grid, each tile 540 x 675
# usage: sh contact.sh <dir>
cd "$1" && ffmpeg -loglevel error -y -pattern_type glob -i 'frame-*.png' -vf "scale=540:675:flags=area,tile=3x2:padding=12:margin=12:color=0x0b0908" -frames:v 1 contact-sheet.png
