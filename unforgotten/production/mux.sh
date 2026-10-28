# mux.sh FRAMES OUT.mp4 [crf] : picture + dialogue (+ score if present), loudness-normalised
F=$1; O=$2; Q=${3:-20}
ffmpeg -loglevel error -y -framerate 30 -i $F/f%04d.jpg -c:v libx264 -preset slow -tune animation -crf $Q -pix_fmt yuv420p -an video_only.mp4 || exit 1
if [ -f audio/score_sfx.wav ]; then
  ffmpeg -loglevel error -y -i dialogue.wav -i audio/score_sfx.wav -filter_complex "[0]volume=1.0[d];[1]volume=0.85[m];[d][m]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=14" -ar 48000 mix.wav
else
  ffmpeg -loglevel error -y -i dialogue.wav -af "loudnorm=I=-16:TP=-1.5" -ar 48000 mix.wav
fi
ffmpeg -loglevel error -y -i video_only.mp4 -i mix.wav -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart $O && ls -la $O
