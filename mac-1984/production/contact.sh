#!/usr/bin/env bash
# contact.sh <video> <out.png> [fps]   dense contact sheet with timestamps (default 1 frame per second)
set -e
ffmpeg -loglevel error -y -i "$1" -vf "fps=${3:-1},scale=320:240:flags=area,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='%{pts\:hms}':x=4:y=4:fontsize=14:fontcolor=yellow:box=1:boxcolor=black@0.6,tile=8x11:padding=4:margin=4" -frames:v 1 "$2"
