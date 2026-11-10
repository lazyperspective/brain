# build.sh : assemble the parts (sorted: a_core … e_world, f_kit, g_worlds, s*_shots, z_frame) into the gallery piece
cd "$(dirname "$0")"
OUT=${OUT:-../../js/pieces/08-the-hollow.js}
{ cat src/_head.js; for f in $(ls src/[a-z]*.js | sort); do cat "$f"; echo; done; echo "})();"; } > "$OUT" && node --check "$OUT" && echo built "$OUT"
