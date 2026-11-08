#!/bin/bash
# Builds the X-ready JPEG and the four 100% crops from the 4K master.
set -e
OUT=/home/user/brain/eight-paintings-output/07-pears-dissolving
M=$OUT/07-pears-dissolving-4k.png
mkdir -p $OUT/crops
convert $M -strip -sampling-factor 4:4:4 -quality 94 $OUT/07-pears-dissolving-x.jpg
convert $M -crop 1000x1000+820+950 +repage $OUT/crops/01-focal-pear-into-planes.png
convert $M -crop 1000x1000+1160+0 +repage $OUT/crops/02-darkest-knifed-field.png
convert $M -crop 1000x1000+1160+1700 +repage $OUT/crops/03-busiest-gesture-field.png
convert $M -crop 1000x1000+0+1700 +repage $OUT/crops/04-corner-linen-and-ledge.png
identify $OUT/07-pears-dissolving-x.jpg $M
ls -la $OUT/07-pears-dissolving-x.jpg
