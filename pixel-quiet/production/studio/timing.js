// node timing.js [t0 t1 step] : ms per frame of the core in Node (look-dev profiling; render.js timing gives Chromium)
global.window = { PIECES: [] };
eval(require('fs').readFileSync(require('path').join(__dirname, '../../js/pieces/07-the-little-studio.js'), 'utf8'));
const E = window.__studioCore, a = +(process.argv[2] || 0), b = +(process.argv[3] || E.D), st = +(process.argv[4] || 0.25);
E.build(); for (let t = 0; t < E.D; t += 1) E.render(t);   // warm up
let n = 0, worst = 0; const t0 = performance.now();
for (let t = a; t < b - 1e-6; t += st) { const q = performance.now(); E.render(t); worst = Math.max(worst, performance.now() - q); n++; }
console.log(`frames ${n}, avg ${((performance.now() - t0) / n).toFixed(1)} ms, worst ${worst.toFixed(1)} ms (Node)`);
