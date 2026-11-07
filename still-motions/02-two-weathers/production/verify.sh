#!/bin/sh
# Runs every required check and writes production/verification.txt
#   sh verify.sh <one-loop.mp4> <two-loop.mp4>
set -e
cd "$(dirname "$0")"
OUT=verification.txt
V1="$1"; V2="$2"
{
  echo "Two Weathers (02-two-weathers): verification, $(date -u +%Y-%m-%dT%H:%MZ)"
  echo
  echo "== Video format =="
  ffprobe -v error -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_frames -show_entries format=duration,size -of default=nw=1 "$V1" | tr '\n' ' '; echo
  ffprobe -v error -show_entries stream=nb_frames -show_entries format=duration -of default=nw=1 "$V2" | tr '\n' ' '; echo
  echo
  echo "== Seam, raw renders (exact frames before encoding) =="
  node render.js seam 2>/dev/null | grep -v -e GroupMarker -e "GPU stall" -e "^\[console\]"
  echo
  echo "== Seam, decoded MP4 =="
  node seamcheck.js "$V1"
  echo
  echo "== Flash (WCAG 2.3.1-style, whole frame and 9 quarter-frame windows) =="
  node flashcheck.js "$V1"
  echo
  echo "== Pop (single-frame jumps; block steps vs neighbours, and global frame steps; seam included) =="
  node popcheck.js "$V1"
  echo
  echo "== Determinism (same t twice in one page, and in a second page with its own build) =="
  node render.js determinism 2>/dev/null | grep -v -e GroupMarker -e "GPU stall" -e "^\[console\]"
} > $OUT 2>&1
cat $OUT
