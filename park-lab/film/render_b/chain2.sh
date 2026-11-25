#!/bin/bash
cd "$(dirname "$0")"
while pgrep -f chain.sh > /dev/null; do sleep 20; done
nice -n 5 node render.js 04_lowpoly_blueprint video > logs/04b.log 2>&1
