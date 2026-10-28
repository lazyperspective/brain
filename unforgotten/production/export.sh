# export.sh DIR : all 9000 frames in 4 parallel chunks
d=$1; mkdir -p $d; date +%s > $d/start
for c in 0 1 2 3; do a=$((c*2250)); b=$((a+2249)); node capture.mjs --id ep1 --hook __ep1 --w 1920 --h 1080 --from $a --to $b --dir $d > $d/log$c.txt 2>&1 & done
wait; date +%s > $d/end
