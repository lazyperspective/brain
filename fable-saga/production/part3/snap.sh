# snap.sh NAME t1,t2,... : build, render stills into $SNAP/NAME and contact sheets $SNAP/NAME_s_*.png (6 per sheet)
cd "$(dirname "$0")"; SNAP=${SNAP:-/tmp/claude-0/-home-user-brain/f1f7475c-3827-5141-bc67-2671553b043a/scratchpad/u3}
OUT=$SNAP/build.js bash build.sh > /dev/null || exit 1
D=$SNAP/$1; mkdir -p $D && node render.js "$D/t%t.png" $2 $SNAP/build.js > /dev/null || exit 1
files=($(ls $D/t*.png | sort)); n=${#files[@]}; k=0
while [ $k -lt $n ]; do
  args=(); filt=""; m=0
  for f in "${files[@]:$k:6}"; do args+=(-i "$f"); filt+="[$m:v]scale=640:360,drawtext=text='$(basename $f .png)':x=6:y=4:fontsize=18:fontcolor=yellow[v$m];"; m=$((m+1)); done
  while [ $m -lt 6 ]; do args+=(-f lavfi -i color=c=black:s=640x360); filt+="[$m:v]null[v$m];"; m=$((m+1)); done
  ffmpeg -loglevel error -y "${args[@]}" -filter_complex "${filt}[v0][v1][v2]hstack=3[a];[v3][v4][v5]hstack=3[b];[a][b]vstack" -frames:v 1 $SNAP/$1_s_$((k/6)).png
  echo $SNAP/$1_s_$((k/6)).png; k=$((k+6))
done
