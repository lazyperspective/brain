#!/bin/bash
# usage: encode.sh <framesdir> <name> <bestframe-index>
set -e
cd "$(dirname "$0")"
ffmpeg -y -loglevel error -framerate 30 -i "$1/f%04d.png" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart -threads 2 "out/$2.mp4"
ffmpeg -y -loglevel error -i "$1/f$(printf %04d $3).png" -q:v 2 "out/$2.jpg"
ffprobe -v error -show_entries stream=width,height,r_frame_rate,nb_frames,pix_fmt -of compact "out/$2.mp4"
