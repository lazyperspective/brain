// Motion check: render every frame of the loop through the core (Node) with per-creature pixel tracking on,
// and flag "pops": a creature whose drawn-pixel count jumps between frames (appearing or vanishing at once,
// e.g. a time gate opening while it is on screen) instead of moving, entering from an edge or fading.
//   node motioncheck.js [fps=30] [t0] [t1]
// A jump is flagged when the larger of two neighbouring counts is at least MIN pixels (default 120) and the
// smaller is under a quarter of it. Creatures crossing the frame at speed (the ride up) can trip it too, so read
// the list rather than treating it as pass/fail.
const fs = require('fs'), path = require('path');
global.window = { PIECES: [] };
eval(fs.readFileSync(path.join(__dirname, '../../js/pieces/05-the-descent.js'), 'utf8'));
const E = window.__descentCore; E.build(); E.track(true);
const fps = +(process.argv[2] || 30), T0 = +(process.argv[3] || 0), T1 = +(process.argv[4] || E.D), MIN = +(process.env.MIN || 120);
const n = Math.round((T1 - T0) * fps);
let prev = null, pops = 0;
for (let k = -1; k <= n; k++) {
  const t = T0 + k / fps; E.render(t);
  const cur = Object.assign({}, E.TRK);
  if (prev) for (const name of new Set([...Object.keys(prev), ...Object.keys(cur)])) {
    const a = prev[name] || 0, b = cur[name] || 0, hi = Math.max(a, b), lo = Math.min(a, b);
    if (hi >= MIN && lo < hi / 4) { pops++; console.log(`t=${t.toFixed(3)}  ${name.padEnd(14)} ${a} -> ${b} px`); }
  }
  prev = cur;
}
console.log(`${pops} jump(s) in ${T0}-${T1} s`);
