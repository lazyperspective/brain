# build.sh : assemble the parts (sorted: a_core, b_boss, s*_shots, z_frame) into the gallery piece
cd "$(dirname "$0")"
OUT=${OUT:-../../js/pieces/06-snow-globe.js}
{ cat src/_head.js; for f in $(ls src/[a-z]*.js | sort); do cat "$f"; echo; done; echo "})();"; } > "$OUT" && node --check "$OUT" && echo built "$OUT"
