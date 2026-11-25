#!/bin/bash
cd /home/user/brain/park-lab/film
until grep -q CHAIN_DONE render_c/logs/chain.txt 2>/dev/null; do sleep 15; done
nice -n 5 node render_c/render.cjs 01_paper_ticket --video --out shots/01_paper_ticket.new.mp4 > render_c/logs/full01b.txt 2>&1
echo CHAIN2_DONE >> render_c/logs/chain.txt
