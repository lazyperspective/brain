#!/bin/bash
# usage: run_all.sh RS N1 N2 TAG EVERY [cycles...]   -- stage 1 (end states) then stage 2 (render) in parallel
cd "$(dirname "$0")"
export TMPDIR=$PWD/tmp NUMBA_CACHE_DIR=$PWD/tmp/nbcache NUMBA_NUM_THREADS=1 OMP_NUM_THREADS=1 OPENCV_FOR_THREADS_NUM=1
RS=$1; N1=$2; N2=$3; TAG=$4; EVERY=$5; shift 5
CYC="${@:-0 1 2 3}"
mkdir -p tmp/logs
if [ -z "$SKIP_END" ]; then
for c in $CYC; do
  python3 src/sim.py --cycle $c --mode end --rs $RS --n1 $N1 --n2 $N2 --tag "$TAG" $EXTRA > tmp/logs/end_$c$TAG.log 2>&1 &
done
wait
fi
for c in $CYC; do
  python3 src/sim.py --cycle $c --mode render --rs $RS --n1 $N1 --n2 $N2 --tag "$TAG" --every $EVERY $EXTRA > tmp/logs/render_$c$TAG.log 2>&1 &
done
wait
tail -n 2 tmp/logs/render_*$TAG.log
