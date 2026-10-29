# mkbuild.sh : like build.sh, but leaves out any layer file (src/l*.js) that doesn't parse on its own — so one agent's
# half-written layer never breaks everyone else's build. OUT as in build.sh.
cd "$(dirname "$0")"; OUT=${OUT:-../../js/pieces/07-one-candle.js}
files=""
for f in $(ls src/[a-z]*.js | sort); do
  case "$(basename $f)" in l*) if ! node --check "$f" 2>/dev/null; then echo "skipping $f (does not parse)" >&2; continue; fi;; esac
  files="$files $f"
done
{ cat src/_head.js; for f in $files; do cat "$f"; echo; done; echo "})();"; } > "$OUT" && node --check "$OUT" && echo built "$OUT"
