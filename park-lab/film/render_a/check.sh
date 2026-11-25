#!/bin/sh
# usage: sh check.sh <shot_id>  -> ffprobe frame count/size + extract cut frames (6 and frames-7) to check/
id=$1; f=/home/user/brain/park-lab/film/shots/$id.mp4; d=/home/user/brain/park-lab/film/render_a/check
mkdir -p $d
n=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames,width,height,r_frame_rate,pix_fmt -of csv=p=0 $f)
echo "$id: $n"
total=$(echo $n | awk -F, '{print $NF}')
short=$(echo $id | cut -c1-2)
ffmpeg -v error -y -i $f -vf "select=eq(n\,6)" -frames:v 1 -q:v 2 $d/${short}_in.jpg
ffmpeg -v error -y -i $f -vf "select=eq(n\,$((total-7)))" -frames:v 1 -q:v 2 $d/${short}_out.jpg
