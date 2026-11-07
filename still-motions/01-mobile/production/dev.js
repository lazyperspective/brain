// Dev harness: render frames in Node straight from js/core.js (same code the page runs).
//   node dev.js <out.png> <t> [s=0.5] [down=1] [crop x,y,w,h in output px]
const path = require('path'), { spawnSync } = require('child_process');
const MobileCore = require(path.join(__dirname, '../js/core.js'));
const [out, tArg, sArg, dArg, crop] = process.argv.slice(2);
const core = MobileCore();
if (process.env.DESCRIBE) { console.log(core.describe()); console.log(JSON.stringify(core.layout(+tArg || 0).shapes)); }
const s = +(sArg || 0.5), down = +(dArg || 1);
let t0 = Date.now(); core.prepare(s); const tp = Date.now() - t0;
t0 = Date.now(); const r = core.render(+tArg || 0, s, down); const tr = Date.now() - t0;
const args = ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${r.w}x${r.h}`, '-i', '-'];
if (crop) { const [x, y, w, h] = crop.split(',').map(Number); args.push('-vf', `crop=${w}:${h}:${x}:${y}`); }
args.push('-frames:v', '1', out);
spawnSync('ffmpeg', args, { input: Buffer.from(r.data.buffer), stdio: ['pipe', 'inherit', 'inherit'] });
console.log(out, `${r.w}x${r.h}`, 'prepare', tp, 'ms render', tr, 'ms');
