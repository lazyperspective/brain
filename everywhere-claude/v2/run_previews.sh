#!/bin/bash
cd /home/user/brain/everywhere-claude/v2/shots
for s in s_roof s_logpile s_phone s_manhole s_bales s_shoes s_garland s_pole s_summit; do
  n=$(python3 -c "import $s; print($s.NAME)")
  rm -rf ../preview/$n ../render/$n
  echo "== $s"; python3 $s.py preview 2>&1 | grep -v -i "pipe\|muxing\|trailer\|closing"
done
echo ALLDONE
