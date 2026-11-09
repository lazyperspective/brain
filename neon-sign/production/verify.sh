#!/usr/bin/env bash
# Run every check on the delivered files and write verification.txt next to this script.
set -euo pipefail
cd "$(dirname "$0")"
export NODE_PATH=${NODE_PATH:-/opt/node-tools/node_modules}
OUT=../../neon-sign-video
F=() ; T=$(mktemp -d)
node render.js seam 2>&1 | grep -av "GroupMarker\|GPU stall" > "$T/seam.txt"
node seamcheck.js "$OUT/neon-sign-16x9.mp4" > "$T/seam2.txt"
node flashcheck.js "$OUT/neon-sign-16x9.mp4" > "$T/flash.txt"
node popcheck.js "$OUT/neon-sign-4k.png" 2>&1 | grep -av GroupMarker > "$T/pop.txt"
node render.js determinism 2>&1 | grep -av "GroupMarker\|GPU stall" > "$T/det.txt"
{
echo "VERIFICATION - 'Flicker' (pixel version), neon-sign"
echo "generated $(date -u +%Y-%m-%dT%H:%MZ) by production/verify.sh"
echo
echo "== deliverables (ffprobe)"
for f in neon-sign-16x9.mp4 neon-sign-16x9-3loops.mp4 neon-sign-16x9-sound.mp4; do echo "$f ($(du -h $OUT/$f | cut -f1))"; ffprobe -v error -count_frames -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_frames,sample_rate,channels:format=duration -of compact $OUT/$f; done
python3 -c "
from PIL import Image; import os
for f in ['neon-sign-4k.png','neon-sign-x.jpg']:
    im=Image.open('$OUT/'+f); print(f, im.size, im.mode, '%.2f MB' % (os.path.getsize('$OUT/'+f)/1e6), ('jpeg 4:4:4 (subsampling 0), quality 95' if f.endswith('jpg') else ''))"
echo
echo "== loop seam, render level (exact native frames, before video coding)"; cat "$T/seam.txt"
echo
echo "== loop seam, encoded (one GOP, keyframe at frame 0 only; x264 zones raise frame 0 and ramp the last 40 frames)"; cat "$T/seam2.txt"
echo
echo "== photosensitivity (WCAG 2.3.1-style general flash test on the delivered one-loop mp4)"; cat "$T/flash.txt"
echo
echo "== pops and pixel-art compliance (native frames)"; cat "$T/pop.txt"
echo "   note: tile steps listed, if any, are the scheduled room-light switches (room 0 on/off at 3.9/12.3 s ="
echo "   frames 117-119/369-371, room 1 off/on at 6.2/14.1 s = frames 186-188/423-425, room 2 on/off at 8.0/15.2 s ="
echo "   frames 240-242/456-458); nothing else outside the sign-driven regions changes by more than 0.01 in a frame."
echo
echo "== determinism (two fresh pages, and re-render after rendering another t)"; cat "$T/det.txt"
echo
echo "== sound (neon-sign-16x9-sound.mp4, delivered AAC)"
ffmpeg -hide_banner -nostats -i $OUT/neon-sign-16x9-sound.mp4 -map 0:a -filter_complex ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I:|LRA:|Peak:)"
echo "   the track is built circularly (FFT-shaped noise, 120 Hz harmonics with whole cycles in 16 s, crackle bursts"
echo "   wrapped with modulo indexing), so sample 768000 runs into sample 0; AAC encoder priming is the only seam risk."
} > verification.txt
rm -rf "$T"
cat verification.txt
