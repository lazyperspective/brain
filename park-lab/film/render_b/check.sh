#!/bin/bash
# usage: ./check.sh <shotId> <still_frame>  -> verify + extract cut frames and one good still
cd "$(dirname "$0")"; id=$1; f=../shots/$id.mp4; s=${id:0:2}
n=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames,width,height,r_frame_rate,pix_fmt -of csv=p=0 $f)
echo "$id: $n"
last=$(( $(echo $n | cut -d, -f5 2>/dev/null || echo 0) ))
nf=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 $f)
ffmpeg -y -loglevel error -i $f -vf "select=eq(n\,6)" -frames:v 1 -q:v 2 check/${id}_in.jpg
ffmpeg -y -loglevel error -i $f -vf "select=eq(n\,$((nf-7)))" -frames:v 1 -q:v 2 check/${id}_out.jpg
[ -n "$2" ] && ffmpeg -y -loglevel error -i $f -vf "select=eq(n\,$2)" -frames:v 1 -q:v 2 check/${id}_still.jpg
ls -la check | grep $s
