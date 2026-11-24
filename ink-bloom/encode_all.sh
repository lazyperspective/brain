#!/bin/bash
# finishing + encodes, strictly one x264 encode at a time
cd "$(dirname "$0")"
export TMPDIR=$PWD/tmp
A=tmp/ink_bloom.wav
python3 src/finish.py vertical out/ink_bloom.mp4 --crf 16 --preset slow --audio $A > tmp/logs/enc_master.log 2>&1
python3 src/finish.py vertical out/ink_bloom_share.mp4 --crf 23 --preset slow --maxrate 12M --bufsize 24M --audio $A > tmp/logs/enc_share.log 2>&1
python3 src/finish.py square out/ink_bloom_square.mp4 --crf 18 --preset slow --audio $A > tmp/logs/enc_square.log 2>&1
echo ALL_DONE
