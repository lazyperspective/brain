#!/usr/bin/env bash
# Cut the rendered shots together: fades, letterbox to 16:9, film grain.
# Usage: ./assemble.sh [tag]   -> out/emberfall_<tag>.mp4
set -euo pipefail
cd "$(dirname "$0")"
TAG=${1:-final}
R=render/$TAG
OUT=out/emberfall_$TAG.mp4
mkdir -p out
W=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$R/shot01/0001.png")
H=$(( W * 9 / 16 ))
# per-shot fades in frames: name fade_in fade_out
SHOTS="shot01:8:10 shot02:4:0 shot02b:0:0 shot02c:3:3 shot02d:3:0 shot03:0:0 shot04:0:0 shot05:0:0 shot06:0:0 shot07:0:7 shot08:6:8"
inputs=(); filters=""; i=0
for spec in $SHOTS; do
  IFS=: read -r name fin fout <<<"$spec"
  [ -f "$R/$name/0001.png" ] || { echo "skip $name (not rendered)"; continue; }
  n=$(ls "$R/$name" | wc -l)
  inputs+=(-framerate 24 -i "$R/$name/%04d.png")
  f="[$i:v]format=rgb24"
  [ "$fin" -gt 0 ] && f="$f,fade=t=in:s=0:n=$fin"
  [ "$fout" -gt 0 ] && f="$f,fade=t=out:s=$((n - fout)):n=$fout"
  filters="$filters$f[v$i];"
  i=$((i + 1))
done
concat=""; for j in $(seq 0 $((i - 1))); do concat="$concat[v$j]"; done
filters="${filters}${concat}concat=n=$i:v=1:a=0,pad=$W:$H:(ow-iw)/2:(oh-ih)/2:black,noise=alls=7:allf=t,format=yuv420p[out]"
ffmpeg -v error -y "${inputs[@]}" -filter_complex "$filters" -map "[out]" -c:v libx264 -crf 17 -preset slow -movflags +faststart "$OUT"
echo "wrote $OUT ($(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")s)"
