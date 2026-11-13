#!/bin/bash
# Assemble deliverables: concat chunks + mux the mastered score, contact sheet, hero stills.
set -e; cd "$(dirname "$0")/.."; O=/home/user/brain/field-guide-video/phone-ad-pulse
python3 audio/pulse_score.py $O/kiln-pulse-score.wav
tools/concat.sh $O/chunks1080 $O/kiln-pulse-full.mp4 $O/kiln-pulse-score.wav
ffmpeg -y -loglevel error -i $O/kiln-pulse-full.mp4 -vf "fps=1/2,scale=480:-1,drawtext=text='%{pts\:hms}':x=8:y=8:fontsize=16:fontcolor=white@0.8,tile=6x5:padding=4:color=black" -frames:v 1 -q:v 3 $O/contact-sheet.jpg
node tools/render.js stills 12.9,23.7,27.4,41.2,47.6,14.8 $O/hero 1920 1080
echo done
