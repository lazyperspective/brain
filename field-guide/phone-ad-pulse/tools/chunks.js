// node tools/chunks.js <from> <to> <chunkSec> <W> <H> <outdir> <workers> [crf]
// Renders [from,to) as independent chunk files (skips chunks that already exist), N worker processes in parallel.
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const [from, to, cs, W, H, out, workers = 2, crf = '14'] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const jobs = []; for (let t = +from; t < +to - 1e-6; t += +cs) { const a = +t.toFixed(3), b = +Math.min(+to, t + +cs).toFixed(3), f = path.join(out, `c_${String(Math.round(a * 30)).padStart(5, '0')}.mp4`); if (!fs.existsSync(f)) jobs.push([a, b, f]); }
console.log('chunks to render:', jobs.length); let active = 0, done = 0;
function next() { if (!jobs.length) { if (!active) console.log('ALL DONE'); return; } const [a, b, f] = jobs.shift(); active++; const t0 = Date.now();
  const p = spawn('node', [path.join(__dirname, 'render.js'), 'video', a, b, f, W, H, crf], { stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', d => process.stdout.write(d)); p.stderr.on('data', d => process.stderr.write(d));
  p.on('close', code => { active--; done++; console.log(`[${done}] ${f} code=${code} ${((Date.now() - t0) / 1000).toFixed(0)}s`); if (code !== 0) jobs.push([a, b, f]); next(); }); }
for (let i = 0; i < +workers; i++) next();
