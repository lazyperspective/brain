#!/bin/sh
cd /home/user/brain/park-lab/film/render_a
for s in 09 07; do nice -n 5 node run.js --shot $s --out /home/user/brain/park-lab/film/render_a/tmp$s.mp4 > logs/$s.log 2>&1 && grep -q wrote logs/$s.log && mv tmp$s.mp4 ../shots/$(ls ../plan >/dev/null; node -e "const s=require('../plan/shots.json').shots.find(x=>x.id.startsWith('$s'));console.log(s.id)").mp4; done
nice -n 5 node run.js --shot 05 --out /home/user/brain/park-lab/film/render_a/tmp05.mp4 > logs/05b.log 2>&1 && grep -q wrote logs/05b.log && mv tmp05.mp4 ../shots/05_pixel_build.mp4
echo done > logs/queue.done
