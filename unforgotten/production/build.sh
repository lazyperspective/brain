# build.sh [shot files...] : assemble the episode script
S=${S:-src}; OUT=${OUT:-/home/user/brain/unforgotten/js/pieces/ep1.js}
cat $S/p0_core.js $S/p1_world.js $S/p2_cast.js $S/p3_fx.js $S/p8_frame.js $S/p4_sets.js $S/p4b_sets.js $S/p7_dlg.js "$@" $S/p9_mount.js > $OUT && node --check $OUT && echo built
