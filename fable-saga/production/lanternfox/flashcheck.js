// node flashcheck.js built.js t0 t1 : lists frame-to-frame brightness jumps (flashes) > 60/255, and the largest jump
global.window = global; global.document = { createElement: () => ({ getContext: () => null }) };
require(require('path').resolve(process.argv[2]));
const c = window.__foxcore;
const out = [];
for (let f = Math.round(+process.argv[3] * 30); f < Math.round(+process.argv[4] * 30); f++) {
  const t = f / 30; c.render(t);
  let s = 0, n = 0; const B = c.BUF, P = c.PAL;
  for (let i = 26 * 480; i < B.length - 26 * 480; i += 7) { const p = P[B[i]]; s += (p[0] * .3 + p[1] * .59 + p[2] * .11); n++; }
  out.push([t.toFixed(2), s / n]);
}
let prev = null, worst = 0, wt = 0, nflash = 0;
for (const [t, l] of out) { if (prev !== null) { const d = Math.abs(l - prev); if (d > worst) { worst = d; wt = t; } if (d > 60) { nflash++; console.log('FLASH', t, prev.toFixed(0), '->', l.toFixed(0)); } } prev = l; }
console.log('frames', out.length, 'flashes', nflash, 'largest jump', worst.toFixed(1), 'at', wt);
