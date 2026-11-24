#!/bin/bash
# Usage: ./render.sh film|teal|alpine  -> ../out/graded/everywhere_claude_<look>.mp4
set -e; cd "$(dirname "$0")"; . ./looks.sh
L=$1; eval G=\$LOOK_$L; mkdir -p ../out/graded
ffmpeg -v error -y -i ../out/everywhere_claude.mp4 -filter_complex "$G" -map "[v]" -map 0:a \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a copy -movflags +faststart \
  ../out/graded/everywhere_claude_$L.mp4
