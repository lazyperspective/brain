#!/bin/bash
# sequential renders (one ffmpeg at a time)
cd "$(dirname "$0")"
while pgrep -f "render.js 04_lowpoly_blueprint video" > /dev/null; do sleep 20; done
for job in "15_tiltshift_dusk 1600 900" "16_globe_shake 1600 900" "08_pov_lift_lowpoly 1920 1080" "13_pov_loop_lowpoly 1920 1080"; do
  set -- $job
  nice -n 5 node render.js $1 video $2 $3 > logs/${1:0:2}.log 2>&1
done
