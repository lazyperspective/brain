#!/usr/bin/env bash
# Render every shot, then assemble. Usage: ./render_all.sh [tag] [scale] [samples] [shots...]
#   ./render_all.sh preview 0.25 8        # fast animatic
#   ./render_all.sh final 0.6667 28       # 1280x536 delivery
set -euo pipefail
cd "$(dirname "$0")"
TAG=${1:-final}; SCALE=${2:-0.6667}; SAMPLES=${3:-28}; shift 3 || true
SHOTS=${*:-"01_bridge 02_goggles 03_strike 04_drum 05_round 06_impact 07_plume 08_title"}
for s in $SHOTS; do
  echo "== shot $s ($TAG, scale $SCALE, $SAMPLES spp) $(date +%T)"
  blender -b --factory-startup -P "shots/shot_$s.py" -- --render --tag "$TAG" --scale "$SCALE" --samples "$SAMPLES" \
    2>&1 | grep -E "^(Saved|Error)" | tail -n 1
done
./assemble.sh "$TAG"
