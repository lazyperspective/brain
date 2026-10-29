// node render.js out.png t1,t2,...   (stills; %t in the name)   |   node render.js out.mp4 t0:t1   (30 fps video at 4×)
// optional third arg: the built piece; optional env CROP=x,y,w,h (in 480×270 px) for stills, scaled 4× (or SCALE=n)
const fs = require('fs'), path = require('path'), { execFileSync, spawn } = require('child_process');
const [out, tArg, piece] = process.argv.slice(2);
global.window = { PIECES: [] };
eval(fs.readFileSync(piece || path.join(__dirname, '../../js/pieces/07-the-lantern-fox.js'), 'utf8'));
const E = window.__foxcore, { BUF, PAL, W, H } = E;
function frame(t) {
  E.render(t); const rgb = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) { const p = PAL[BUF[i]]; rgb[i * 3] = p[0]; rgb[i * 3 + 1] = p[1]; rgb[i * 3 + 2] = p[2]; }
  return rgb;
}
if (String(tArg).includes(':')) {
  const [a, b] = tArg.split(':').map(Number);
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', '30', '-i', '-', '-vf', 'scale=iw*4:ih*4:flags=neighbor', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  (async () => { const t0 = Date.now(); for (let f = Math.round(a * 30); f < Math.round(b * 30); f++) { if (!ff.stdin.write(frame(f / 30))) await new Promise((r) => ff.stdin.once('drain', r)); } ff.stdin.end(); ff.on('close', () => console.log(out, ((Date.now() - t0) / 1000).toFixed(1) + 's')); })();
} else {
  const crop = process.env.CROP ? process.env.CROP.split(',').map(Number) : null, sc = +(process.env.SCALE || 4);
  for (const t of String(tArg || '0').split(',').map(Number)) {
    const t0 = Date.now(), rgb = frame(t), o = out.replace('%t', t.toFixed(2).padStart(6, '0')), raw = o + '.rgb';
    const ms = Date.now() - t0;
    fs.writeFileSync(raw, rgb);
    const vf = (crop ? `crop=${crop[2]}:${crop[3]}:${crop[0]}:${crop[1]},` : '') + `scale=iw*${sc}:ih*${sc}:flags=neighbor`;
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-i', raw, '-vf', vf, o]); fs.unlinkSync(raw);
    console.log(o, ms + 'ms');
  }
}
