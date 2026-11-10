#!/bin/bash
# build.sh — full build: sound, video (1 loop + 2 loops + silent), stills, contact sheet, verification.
# usage: build.sh [roundN]   (roundN => also saves snapshots/roundN.png)
set -e
cd "$(dirname "$0")"
export NODE_PATH=/opt/node-tools/node_modules
V=/home/user/brain/self-portrait-video
mkdir -p "$V/stills" "$V/snapshots"
STILL_T="1.0 10.9 19.65 29.4 44.25"      # best moment of each scene
POSTER_T=29.4

# 1. soundtrack, auto-gained to -16 LUFS (soft limiter inside sound.js keeps true peak down)
G=10
for i in 1 2 3 4 5; do
  node sound.js "$V/soundtrack.wav" $G > /dev/null
  I=$(ffmpeg -hide_banner -nostats -i "$V/soundtrack.wav" -af ebur128 -f null - 2>&1 | grep "I:" | tail -1 | awk '{print $2}')
  G=$(python3 -c "print(round($G + (-16.0 - ($I)), 2))")
done
node sound.js "$V/soundtrack.wav" $G
echo "sound gain $G dB"

# 2. picture: frames piped into ffmpeg (CRF 14, High, yuv420p, tune animation)
node render.js "$V/self-portrait-16x9-silent.mp4" --stats "$V/stats.json"
# determinism: second independent pass, hashes only
node render.js none --nostream --stats "$V/stats2.json"

# 3. mux: one loop, and two loops to check the seam
ffmpeg -y -loglevel error -i "$V/self-portrait-16x9-silent.mp4" -i "$V/soundtrack.wav" -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart "$V/self-portrait-16x9.mp4"
ffmpeg -y -loglevel error -stream_loop 1 -i "$V/self-portrait-16x9-silent.mp4" -stream_loop 1 -i "$V/soundtrack.wav" -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart "$V/self-portrait-16x9-2loops.mp4"

# 4. stills (3840x2160, x8 nearest) + poster + contact sheet
i=1
for t in $STILL_T; do node shot.js "$V/stills/scene$i.png" --t $t --s 8; i=$((i+1)); done
node shot.js "$V/poster.png" --t $POSTER_T --s 8
python3 -c "
from PIL import Image
Image.open('$V/poster.png').convert('RGB').save('$V/stills/poster.jpg', quality=95, subsampling=0)
"
rm -f "$V/poster.png"
TS=$(python3 -c "print(','.join(str(i+0.5) for i in range(46)))")
node shot.js "$V/contact-sheet.png" --t $TS --s 1 --cols 8
if [ -n "$1" ]; then cp "$V/contact-sheet.png" "$V/snapshots/$1.png"; fi

# 5. verification
node verify.js > verification.txt
cat verification.txt
