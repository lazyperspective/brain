// node timing.js [t0 t1 step] : per-stage ms per frame of the core in Node (look-dev profiling; render.js timing gives Chromium)
global.window = { PIECES: [] };
eval(require('fs').readFileSync(require('path').join(__dirname, '../../js/pieces/06-the-seed-and-the-stone.js'), 'utf8'));
const E = window.__seedCore, a = +(process.argv[2] || 0), b = +(process.argv[3] || 24), st = +(process.argv[4] || 0.25);
E.build(); for (let t = 0; t < 24; t += 1) E.render(t);   // warm up
const P = E.prof(true); let n = 0; const t0 = performance.now();
for (let t = a; t < b - 1e-6; t += st) { E.render(t); n++; }
const tot = (performance.now() - t0) / n;
console.log(`frames ${n}, avg ${tot.toFixed(1)} ms`);
console.log(Object.entries(P).sort((x, y) => y[1] - x[1]).map(([k, v]) => k + ' ' + (v / n).toFixed(2)).join(' | '));
