# motion.sh START STEP CROP OUT [PAGE] : 12 frames from START (seconds), STEP frames apart, cropped (w:h:x:y in 1920x1080), tiled 6x2
s=$1; st=$2; cr=$3; out=$4; pg=${5:-/home/user/brain/unforgotten/index.html}; d=$(mktemp -d -p .)
f0=$(python3 -c "print(int(round($s*30)))"); ts=$(python3 -c "print(','.join(str(round(($f0+k*$st)/30,4)) for k in range(12)))")
timeout 900 node capture.mjs --page $pg --id ep1 --hook __ep1 --w 1920 --h 1080 --times $ts --dir $d >/dev/null
files=($(ls $d/*.png | sort -V)); args=(); filt=""; k=0
IFS=: read cw ch cx cy <<< "$cr"; tw=$((cw*300/ch)); 
for f in "${files[@]}"; do args+=(-i $f); filt+="[$k:v]crop=$cr,scale=$tw:300:flags=neighbor[v$k];"; k=$((k+1)); done
lay=""; for k in $(seq 0 11); do x=$(( (k%6)*tw )); y=$(( (k/6)*300 )); lay+="${x}_${y}|"; done
ffmpeg -loglevel error -y "${args[@]}" -filter_complex "${filt}$(for k in $(seq 0 11); do printf "[v$k]"; done)xstack=inputs=12:layout=${lay%|}" -frames:v 1 $out && rm -rf $d && echo $out
