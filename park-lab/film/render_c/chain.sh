#!/bin/bash
cd /home/user/brain/park-lab/film
while pgrep -f "render.cjs 10_pov" > /dev/null; do sleep 10; done
nice -n 5 node render_c/render.cjs 14_pov_corkscrew_tin --video > render_c/logs/full14.txt 2>&1
nice -n 5 node render_c/render.cjs 06_tin_toybox --video > render_c/logs/full06.txt 2>&1
echo CHAIN_DONE >> render_c/logs/chain.txt
