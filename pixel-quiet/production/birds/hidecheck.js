// Hide check: the loop closes with the four leavers out of sight (tucked in the home tree's leaves before they hop out;
// roosting inside the blue tree's leaves at the end). For every frame in which a leaver is meant to be hidden behind
// leaves, draw it into a mask and count the pixels NOT covered by a front cluster: they must all be 0.
//   node hidecheck.js [fps=30]
const fs = require('fs'), path = require('path');
global.window = { PIECES: [] };
eval(fs.readFileSync(path.join(__dirname, '../../js/pieces/08-migrating-birds.js'), 'utf8'));
const E = window.__birdsCore; E.build(); const L = E.leak(true);
const fps = +(process.argv[2] || 30), n = Math.round(E.D * fps);
const worst = [0, 0, 0, 0], at = [0, 0, 0, 0], frames = [0, 0, 0, 0];
for (let f = 0; f < n; f++) {
  const t = f / fps; E.render(t);
  for (let k = 0; k < 4; k++) { if (L[k] > 0) frames[k]++; if (L[k] > worst[k]) { worst[k] = L[k]; at[k] = t; } }
}
for (let k = 0; k < 4; k++) console.log(`leaver ${k}: ${frames[k]} frame(s) with uncovered pixels; worst ${worst[k]} px` + (worst[k] ? ` at t=${at[k].toFixed(2)}` : ''));
console.log(worst.every((w) => w === 0) ? 'PASS  every hidden bird is fully covered' : 'FAIL  a hidden bird shows');
