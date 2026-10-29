// node flashcheck.js built.js t0 t1 : lists frame-to-frame brightness jumps (flashes); several within a second = strobing
global.window = global; global.document = { createElement: () => ({ getContext: () => null }) };
require(require('path').resolve(process.argv[2]));
const c = window.__ultra_core;
const out = [];
for (let f = Math.round(+process.argv[3]*30); f < Math.round(+process.argv[4]*30); f++) {
  const t = f / 30; c.render(t);
  let s = 0, n = 0; const B = c.BUF, P = c.PAL;
  for (let i = 0; i < B.length; i += 7) { const p = P[B[i]]; s += (p[0]*.3+p[1]*.59+p[2]*.11); n++; }
  out.push([t.toFixed(2), (s/n).toFixed(0)]);
}
let prev = null;
for (const [t, l] of out) { if (prev !== null && Math.abs(l - prev) > 60) console.log(t, prev, '->', l); prev = +l; }
