# final.sh : build the gallery piece, render the film and every deliverable into fable-saga-video/part5, write verification.txt
cd "$(dirname "$0")"; set -e
OUTD=/home/user/brain/fable-saga-video/part5; B=../../js/pieces/08-the-hollow.js
bash build.sh
mkdir -p $OUTD/stills $OUTD/snapshots $OUTD/strips
node render.js $OUTD/the-hollow-silent.mp4 0:40 $B | tee /tmp/h5_render.log
node sheet.js $B $OUTD/contact-sheet.png 0 40 2 10 0.5
cp snapshots/*.png $OUTD/snapshots/ 2>/dev/null || true
# strips of the key sequences (consecutive frames)
node strip.js $B $OUTD/strips/01-shadow-2.6-3.8.png 2.6 36 1 6 1
node strip.js $B $OUTD/strips/02-zenith-nova-7.4-8.4.png 7.4 30 1 6 1
node strip.js $B $OUTD/strips/03-duel-8.1-10.7.png 8.1 78 1 6 1
node strip.js $B $OUTD/strips/04-worlds-11.5-14.1.png 11.5 78 1 6 1
node strip.js $B $OUTD/strips/05-hollow-nova-cut-14.0-16.4.png 14.0 72 1 6 1
node strip.js $B $OUTD/strips/06-wing-pin-17.2-18.6.png 17.2 42 1 6 1
node strip.js $B $OUTD/strips/07-dawnbreak-22.8-24.4.png 22.8 48 1 6 1
node strip.js $B $OUTD/strips/08-counter-24.9-27.2.png 24.9 69 1 6 1
node strip.js $B $OUTD/strips/09-horizon-cut-32.9-34.6.png 32.9 51 1 6 1
# stills at ×8 and the poster
ST="2.4 7.8 12.12 13.0 14.4 19.6 24.1 33.8"
for t in $ST; do node render.js $OUTD/stills/hollow-%t.png $t $B 8 > /dev/null; done
node render.js $OUTD/stills/poster-%t.png 24.1 $B 8 > /dev/null
ffmpeg -loglevel error -y -i $OUTD/stills/poster-024.10.png -q:v 1 -qmin 1 -pix_fmt yuvj444p $OUTD/poster.jpg; rm $OUTD/stills/poster-024.10.png
if [ -f $OUTD/score.wav ]; then ffmpeg -loglevel error -y -i $OUTD/the-hollow-silent.mp4 -i $OUTD/score.wav -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart $OUTD/the-hollow.mp4; echo muxed; else echo "score.wav not there yet"; fi
node verify.js $B $OUTD > verification.txt; cat verification.txt
