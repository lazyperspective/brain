// node timing.js built.js [t0 t1 step] : ms per frame (avg / max / slowest frames)
global.window = global; global.document = { createElement: () => ({ getContext: () => null }) };
require(require('path').resolve(process.argv[2]));
const c = window.__foxcore, a = +(process.argv[3] || 0), b = +(process.argv[4] || 36), st = +(process.argv[5] || 1 / 30);
let t0 = Date.now(); c.render(0); console.log('first frame (incl. build)', Date.now() - t0, 'ms');
const ms = [];
for (let t = a; t < b - 1e-6; t += st) { const q = process.hrtime.bigint(); c.render(t); ms.push([Number(process.hrtime.bigint() - q) / 1e6, t]); }
const avg = ms.reduce((s, m) => s + m[0], 0) / ms.length; ms.sort((x, y) => y[0] - x[0]);
console.log('frames', ms.length, 'avg', avg.toFixed(1), 'ms  max', ms[0][0].toFixed(1), 'ms at', ms[0][1].toFixed(2));
console.log('slowest', ms.slice(0, 8).map((m) => m[1].toFixed(2) + ':' + m[0].toFixed(0)).join(' '));
// per second
const per = {}; for (const [m, t] of ms) { const k = Math.floor(t); (per[k] = per[k] || []).push(m); }
console.log(Object.keys(per).map((k) => k + ':' + (per[k].reduce((s, v) => s + v, 0) / per[k].length).toFixed(0)).join(' '));
