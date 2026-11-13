#!/bin/bash
# Concatenate segments, master + mux audio, make contact sheet.  usage: tools/finalize.sh <outdir>
OUT=${1:?outdir}; cd "$(dirname "$0")/.." || exit 1
ls "$OUT"/seg/s*.mp4 | sort | sed "s|^|file '|; s|$|'|" > "$OUT/concat.txt"
n=$(wc -l < "$OUT/concat.txt"); echo "segments: $n"
python3 audio/score_light.py "$OUT/score-raw.wav"
# two-pass loudnorm to -16 LUFS / -1.5 dBTP
J=$(ffmpeg -hide_banner -i "$OUT/score-raw.wav" -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
mi=$(echo "$J" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['input_i'], d['input_tp'], d['input_lra'], d['input_thresh'], d['target_offset'])")
read II TP LRA TH OFF <<< "$mi"
ffmpeg -loglevel error -y -i "$OUT/score-raw.wav" -af "loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=$II:measured_TP=$TP:measured_LRA=$LRA:measured_thresh=$TH:offset=$OFF:linear=true,aresample=48000" "$OUT/score-master.wav"
ffmpeg -loglevel error -y -f concat -safe 0 -i "$OUT/concat.txt" -i "$OUT/score-master.wav" -map 0:v -map 1:a -c:v libx264 -preset slow -crf 14 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart "$OUT/kiln-light-full.mp4"
ffmpeg -hide_banner -i "$OUT/kiln-light-full.mp4" -af ebur128 -f null - 2>&1 | grep -A2 "Integrated loudness" | head -3
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,pix_fmt,r_frame_rate -of compact "$OUT/kiln-light-full.mp4"
ffmpeg -loglevel error -y -i "$OUT/kiln-light-full.mp4" -vf "fps=1/2,scale=480:-1,tile=6x5:padding=6:color=0x1a1a1a" -frames:v 1 -q:v 2 "$OUT/contact-sheet.jpg"
echo FINALIZED
