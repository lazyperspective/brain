#!/usr/bin/env bash
# loudness.sh <file>  -> integrated loudness, LRA, true peak (ffmpeg ebur128 summary)
ffmpeg -hide_banner -nostats -i "$1" -af ebur128=peak=true -f null - 2>&1 | sed -n '/Summary:/,$p' | grep -E "I:|LRA:|Peak:|LRA low|LRA high"
