#!/usr/bin/env bash
# Look-development stills of "Can we talk later?" through the real page (render.js), plus two review sheets:
#   contact.png   twelve frames across the loop (one per beat of the story), labelled with their times
#   strip-0-2s.png the first two seconds, every 4th frame, at full width per tile (the hook: is the trigger instant?)
#   ./stills.sh [outdir]          (default: the scratchpad)   TIMES="0,1.5,..." overrides the contact-sheet times
set -euo pipefail
cd "$(dirname "$0")"
OUTD=${1:-/tmp/claude-0/-home-user-brain/f1f7475c-3827-5141-bc67-2671553b043a/scratchpad/imagined/cantalk/stills}
TIMES=${TIMES:-0,1.4,3.0,5.5,6.95,8.8,12.6,15.2,17.6,18.9,20.4,23.5,25.9,29.5,33.0,36.7}
mkdir -p "$OUTD/contact" "$OUTD/strip"
node render.js stills "$OUTD/contact" "$TIMES"
python3 sheet.py "$OUTD/contact.png" 4 0.3 $(ls "$OUTD"/contact/cantalk-*.png | sort)
node render.js frames "$OUTD/strip" 0 2 7.5
python3 sheet.py "$OUTD/strip-0-2s.png" 5 0.36 $(ls "$OUTD"/strip/f-*.png | sort)
echo "$OUTD/contact.png  $OUTD/strip-0-2s.png"
