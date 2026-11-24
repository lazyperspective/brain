#!/bin/bash
# render low-res previews (540x960 jpgs + mp4) for the given shots (default: all in the edit)
cd /home/user/brain/everywhere-claude/v3/shots
L=${@:-s_roof s_spruce s_logpile s_manhole s_photo s_bales s_shoes s_garland s_pole s_whip s_summit}
for s in $L; do
  n=$(python3 -c "import $s; print($s.NAME)")
  rm -rf ../preview/$n ../render/$n
  echo "== $s"; python3 $s.py preview 2>&1 | grep -v -i "pipe\|muxing\|trailer\|closing\|^$"
done
echo ALLDONE
