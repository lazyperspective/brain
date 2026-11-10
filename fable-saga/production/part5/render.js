// node render.js out.png t1,t2,... [BUILT] [scale]  (stills; %t in the name)   |   node render.js out.mp4 t0:t1 [BUILT]  (30 fps video at 4×, CRF 14)
const fs = require('fs'), path = require('path'), { execFileSync, spawn } = require('child_process');
const [out, tArg, piece, scl] = process.argv.slice(2);
global.window = { PIECES: [] };
eval(fs.readFileSync(piece || path.join(__dirname, '../../js/pieces/08-the-hollow.js'), 'utf8'));
const E = window.__hollow_core, { W, H } = E, SC = +(scl || 4);
const frame = (t) => { E.render(t); return Buffer.from(E.RGB); };
if (String(tArg).includes(':')) {
  const [a, b] = tArg.split(':').map(Number);
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', '30', '-i', '-', '-vf', 'scale=iw*4:ih*4:flags=neighbor', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '14', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  (async () => { const t0 = Date.now(); let n = 0; for (let f = Math.round(a * 30); f < Math.round(b * 30); f++, n++) { if (!ff.stdin.write(frame(f / 30))) await new Promise((r) => ff.stdin.once('drain', r)); } const ms = (Date.now() - t0) / n; ff.stdin.end(); ff.on('close', () => console.log(out, n + ' frames', ms.toFixed(1) + ' ms/frame (render)')); })();
} else {
  for (const t of String(tArg || '0').split(',').map(Number)) {
    const t0 = Date.now(), rgb = frame(t), o = out.replace('%t', t.toFixed(2).padStart(6, '0')), raw = o + '.rgb';
    fs.writeFileSync(raw, rgb); execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-i', raw, '-vf', `scale=iw*${SC}:ih*${SC}:flags=neighbor`, o]); fs.unlinkSync(raw);
    console.log(o, Date.now() - t0 + 'ms');
  }
}
