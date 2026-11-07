#!/usr/bin/env bash
# loud.sh <file>   integrated loudness, LRA, true peak (ffmpeg ebur128)
ffmpeg -hide_banner -nostats -i "$1" -af ebur128=peak=true -f null - 2>&1 | sed -n '/Summary:/,$p' | grep -E "I:|LRA:|Peak:"
