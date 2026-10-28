// node run.js scene.js out.png [t] : render one frame of the v4 engine without a browser (for style frames and checks)
(function main() {
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const dir = __dirname, [scene, out, tArg] = process.argv.slice(2);
const parts = ['a_core.js', 'b_sprite.js', ...['c_cast.js', 'd_world.js', 'e_dlg.js', 'e_frame.js'].filter((f) => fs.existsSync(path.join(dir, f))), ...fs.readdirSync(dir).filter((f) => /^f_.*\.js$/.test(f)).sort()].map((f) => fs.readFileSync(path.join(dir, f), 'utf8'));
const src = '(function(){"use strict";\n' + parts.join('\n') + '\n' + fs.readFileSync(scene, 'utf8') + '\nreturn { BUF, PAL, W, H, draw };\n})()';
const E = eval(src);
if (String(tArg).includes(':')) {
  // video: t0:t1 rendered at 30 fps straight into an mp4 at 4×
  const [a, b] = String(tArg).split(':').map(Number), { spawn } = require('child_process'), { BUF, PAL, W, H } = E;
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', '30', '-i', '-', '-vf', 'scale=iw*4:ih*4:flags=neighbor', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  (async () => { const t0 = Date.now(); for (let f = Math.round(a * 30); f < Math.round(b * 30); f++) { E.draw(f / 30); const rgb = Buffer.alloc(W * H * 3); for (let i = 0; i < W * H; i++) { const p = PAL[BUF[i]]; rgb[i * 3] = p[0]; rgb[i * 3 + 1] = p[1]; rgb[i * 3 + 2] = p[2]; } if (!ff.stdin.write(rgb)) await new Promise((r) => ff.stdin.once('drain', r)); } ff.stdin.end(); ff.on('close', () => console.log(out, ((Date.now() - t0) / 1000).toFixed(1) + 's')); })();
  return;
}
const ts = tArg === undefined ? [0] : String(tArg).split(',').map(Number);
for (const t of ts) {
  const t0 = Date.now(); E.draw(t);
  const ms = Date.now() - t0, { BUF, PAL, W, H } = E, rgb = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) { const p = PAL[BUF[i]]; rgb[i * 3] = p[0]; rgb[i * 3 + 1] = p[1]; rgb[i * 3 + 2] = p[2]; }
  const o = ts.length > 1 ? out.replace('%t', t.toFixed(2).padStart(6, '0')) : out, raw = o + '.rgb'; fs.writeFileSync(raw, rgb);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-i', raw, '-vf', 'scale=iw*4:ih*4:flags=neighbor', o]);
  fs.unlinkSync(raw); console.log(o, ms + 'ms');
}

})();
