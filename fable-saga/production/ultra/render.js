// node render.js out.png t1,t2,...   (stills; %t in the name)   |   node render.js out.mp4 t0:t1   (30 fps video at 4×)
const fs = require('fs'), path = require('path'), { execFileSync, spawn } = require('child_process');
const [out, tArg, piece] = process.argv.slice(2);
global.window = { PIECES: [] };
eval(fs.readFileSync(piece || path.join(__dirname, '../../js/pieces/04-ultrathink.js'), 'utf8'));
const E = window.__ultra_core, { BUF, PAL, W, H } = E;
function frame(t) {
  E.render(t); const [sx, sy] = E.SHAKE(), rgb = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) { const yy = Math.min(H - 1, Math.max(0, y - sy)); for (let x = 0; x < W; x++) { const xx = Math.min(W - 1, Math.max(0, x - sx)), p = PAL[BUF[yy * W + xx]], i = (y * W + x) * 3; rgb[i] = p[0]; rgb[i + 1] = p[1]; rgb[i + 2] = p[2]; } }
  return rgb;
}
if (String(tArg).includes(':')) {
  const [a, b] = tArg.split(':').map(Number);
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', '30', '-i', '-', '-vf', 'scale=iw*4:ih*4:flags=neighbor', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  (async () => { const t0 = Date.now(); for (let f = Math.round(a * 30); f < Math.round(b * 30); f++) { if (!ff.stdin.write(frame(f / 30))) await new Promise((r) => ff.stdin.once('drain', r)); } ff.stdin.end(); ff.on('close', () => console.log(out, ((Date.now() - t0) / 1000).toFixed(1) + 's')); })();
} else {
  for (const t of String(tArg || '0').split(',').map(Number)) {
    const t0 = Date.now(), rgb = frame(t), o = out.replace('%t', t.toFixed(2).padStart(6, '0')), raw = o + '.rgb';
    fs.writeFileSync(raw, rgb); execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-i', raw, '-vf', 'scale=iw*4:ih*4:flags=neighbor', o]); fs.unlinkSync(raw);
    console.log(o, Date.now() - t0 + 'ms');
  }
}
