// Motion check: render every frame of the loop through the core (Node) with per-group pixel tracking on, and flag
// "pops": a group whose drawn-pixel count jumps between frames (appearing or vanishing at once) instead of moving,
// entering from an edge, emerging from behind something or fading. Pixels drawn inside the studio count only as
// much as the studio is lit (what cannot be seen cannot pop).
//   node motioncheck.js [fps=30] [t0] [t1]        MIN=60 (pixels)
// Groups: person:<who> (with what they carry), cat, desk (things on desks and walls), steam, sky (stars, moon,
// smoke, birds), hammock, zs, bubble. Hand-offs (a prop lifted off a wall or a desk into someone's hands) show as
// a matched pair: one group drops and another rises by the same amount in the same frame; they are labelled.
const fs = require('fs'), path = require('path');
global.window = { PIECES: [] };
eval(fs.readFileSync(path.join(__dirname, '../../js/pieces/07-the-little-studio.js'), 'utf8'));
const E = window.__studioCore; E.build(); E.track(true);
const fps = +(process.argv[2] || 30), T0 = +(process.argv[3] || 0), T1 = +(process.argv[4] || E.D), MIN = +(process.env.MIN || 60);
const n = Math.round((T1 - T0) * fps);
let prev = null, pops = 0, hand = 0;
const maxStep = {};
for (let k = 0; k <= n; k++) {
  const t = T0 + k / fps; E.render(t % E.D);
  const cur = Object.assign({}, E.TRK);
  if (prev) {
    const names = [...new Set([...Object.keys(prev), ...Object.keys(cur)])];
    const d = {}; for (const nm of names) d[nm] = (cur[nm] || 0) - (prev[nm] || 0);
    for (const nm of names) {
      const a = prev[nm] || 0, b = cur[nm] || 0, hi = Math.max(a, b), lo = Math.min(a, b);
      if (!maxStep[nm] || Math.abs(b - a) > maxStep[nm][0]) maxStep[nm] = [Math.abs(b - a), t];
      if (hi >= MIN && lo < hi / 4) {
        const partner = names.find((o) => o !== nm && Math.abs(d[o] + d[nm]) < Math.max(12, Math.abs(d[nm]) * 0.25) && Math.abs(d[o]) > 8);
        if (partner) { hand++; console.log(`t=${t.toFixed(3)}  ${nm.padEnd(12)} ${a} -> ${b} px   hand-off with ${partner} (${d[partner] > 0 ? '+' : ''}${d[partner]})`); }
        else { pops++; console.log(`t=${t.toFixed(3)}  ${nm.padEnd(12)} ${a} -> ${b} px   POP`); }
      }
    }
  }
  prev = cur;
}
console.log('largest frame-to-frame change per group (px, at t):', Object.entries(maxStep).map(([k, v]) => `${k} ${v[0]}@${v[1].toFixed(2)}`).join(', '));
console.log(`${pops} pop(s), ${hand} hand-off(s) in ${T0}-${T1} s at ${fps} fps (MIN ${MIN} px)`);
