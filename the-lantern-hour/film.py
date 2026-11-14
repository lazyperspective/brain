#!/usr/bin/env python3
"""
THE LANTERN HOUR
an animated short in soft pastel, charcoal, wax pencil, a fingertip,
and one stick of vermilion kept for a single purpose.

usage:
    film.py list
    film.py shot <name>            render one shot to $LH_WORK/seg_<name>.mp4
    film.py sheet <name> [n]       contact sheet of n drawings from a shot
    film.py still <name> <t>       one full frame at local time t
"""
import sys
from rig import *
import shots   # noqa: registers the shots

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'list':
        tt = 0
        for k_, (fn, dur) in SHOTS.items():
            print(f'{k_:14s} {tt:7.2f} .. {tt + dur:7.2f}  ({dur:.2f}s)')
            tt += dur
    elif cmd == 'shot':
        run_shot(sys.argv[2], 'video')
    elif cmd == 'sheet':
        run_shot(sys.argv[2], 'sheet', sys.argv[3] if len(sys.argv) > 3 else None)
    elif cmd == 'still':
        run_shot(sys.argv[2], 'still', sys.argv[3])
