// The studio settles back to frame 0's state in the dark at t = SWAP (about 4 a.m., lights out): the four who left are
// back at their desks, the cat on the worktop, the chart, the painting and the terminal in their places, the
// whiteboard wiped. This check renders frames just after SWAP with the reset at SWAP and with it postponed, and
// counts output pixels that differ anywhere. It must be zero: nobody can see the reset happen.
//   node swapcheck.js
const fs = require('fs'), path = require('path');
global.window = { PIECES: [] };
eval(fs.readFileSync(path.join(__dirname, '../../js/pieces/07-the-little-studio.js'), 'utf8'));
const E = window.__studioCore; E.build();
const S0 = E.SWAP;
const grab = (t, sw) => { E.setSwap(sw); E.render(t); const o = Uint8Array.from(E.OUT); E.setSwap(S0); return o; };
// Render the same instant twice: once with the reset at S0, once with it postponed by 0.5 s. Any pixel that differs is
// the reset showing.
let bad = 0;
for (const dt of [1 / 60, 1 / 30, 0.1, 0.2, 0.3]) {
  const t = S0 + dt, a = grab(t, S0), b = grab(t, S0 + 0.5);
  let n = 0, where = null;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { n++; if (!where) where = [i % E.W, Math.floor(i / E.W)]; }
  console.log(`t = ${t.toFixed(3)}: ${n} px differ between "reset at ${S0}" and "reset at ${S0 + 0.5}"` + (where ? ` (first at ${where})` : ''));
  bad += n;
}
console.log(bad === 0 ? 'PASS  the reset is invisible: nothing on screen changes when it happens' : 'FAIL  the reset shows');
