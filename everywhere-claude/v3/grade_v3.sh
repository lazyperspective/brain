#!/bin/bash
# The three grade looks (grade/looks.sh) applied to the v3 master, share-size encodes -> out/graded_v3/
# Usage: ./grade_v3.sh film|teal|alpine   (one x264 encode at a time)
set -e; cd "$(dirname "$0")"; . ../grade/looks.sh
L=$1; eval G=\$LOOK_$L; mkdir -p ../out/graded_v3
ffmpeg -v error -y -i ../out/everywhere_claude.mp4 -filter_complex "$G" -map "[v]" -map 0:a \
  -c:v libx264 -preset slow -crf 23 -maxrate 12M -bufsize 24M -pix_fmt yuv420p -threads 2 \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a copy -movflags +faststart \
  ../out/graded_v3/everywhere_claude_$L.mp4
