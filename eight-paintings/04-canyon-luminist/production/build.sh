#!/bin/sh
# Renders the master and the derived files. Run from anywhere.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
OUT=${1:-$HERE/../../../eight-paintings-output/04-canyon-luminist}
mkdir -p "$OUT"
node "$HERE/render.js" "$OUT/04-canyon-luminist-4k.png"
python3 "$HERE/finish.py" "$OUT" 04-canyon-luminist
