// Motion check: render every frame of the loop through the core (Node) with per-part pixel tracking on, and flag
// "pops": a part whose drawn-pixel count jumps between frames (appearing or vanishing at once, e.g. a time gate
// opening while it is on screen) instead of moving, entering from behind something, or fading.
//   node motioncheck.js [fps=30] [t0] [t1]
// Groups count the pixels each draws that show (birds: alpha > 0.3 and not lost in a hollow's shade; small sprites:
// alpha > 0.3; clouds: alpha > 0.06). leaver0..3 are the four who leave, flock the home tree's birds (with the nest,
// egg and chick inside the "tree" stage), far the blue tree's birds. A jump is flagged when the larger of two
// neighbouring counts is at least MIN pixels (default 40) and the smaller is under a quarter of it. The loop seam
// (last frame -> frame 0) is included. Note: a bird hidden behind leaves is still drawn (and counted); whether it
// shows is checked by seamcheck.js and the stills.
const fs = require('fs'), path = require('path');
global.window = { PIECES: [] };
eval(fs.readFileSync(path.join(__dirname, '../../js/pieces/08-migrating-birds.js'), 'utf8'));
const E = window.__birdsCore; E.build(); E.track(true); E.leak(true);
const fps = +(process.argv[2] || 30), T0 = +(process.argv[3] || 0), T1 = +(process.argv[4] || E.D), MIN = +(process.env.MIN || 40);
const n = Math.round((T1 - T0) * fps);
let prev = null, pops = 0, maxStep = {};
for (let k = 0; k <= n; k++) {
  const t = T0 + k / fps; E.render(t % E.D);
  const cur = Object.assign({}, E.TRK);
  for (let q = 0; q < 4; q++) cur['leaver' + q] = E.VISN[q];          // leavers: what shows (not what is drawn behind leaves)
  if (prev) for (const name of new Set([...Object.keys(prev), ...Object.keys(cur)])) {
    const a = prev[name] || 0, b = cur[name] || 0, hi = Math.max(a, b), lo = Math.min(a, b);
    if (!maxStep[name] || Math.abs(b - a) > maxStep[name][0]) maxStep[name] = [Math.abs(b - a), t];
    if (hi >= MIN && lo < hi / 4) { pops++; console.log(`t=${t.toFixed(3)}  ${name.padEnd(12)} ${a.toFixed(0)} -> ${b.toFixed(0)} px`); }
  }
  prev = cur;
}
console.log('largest frame-to-frame change per part (px, at t):', Object.entries(maxStep).map(([k, v]) => `${k} ${v[0].toFixed(0)}@${v[1].toFixed(2)}`).join(', '));
console.log(`${pops} jump(s) in ${T0}-${T1} s at ${fps} fps (MIN ${MIN} px)`);
