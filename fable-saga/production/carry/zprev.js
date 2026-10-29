// node zprev.js BUILT out.png k u t   : one layer alone (layer k at scale u, time t), 4×, with its window outlined
// node zprev.js BUILT out.png film t1,t2,...   : the real film at those times (%t in the name)
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const [piece, out, a, b, c] = process.argv.slice(2);
global.window = { PIECES: [] }; eval(fs.readFileSync(path.resolve(piece), 'utf8'));
const E = window.__carry_core, Z = window.__carry, { BUF, PAL, W, H } = E;
function save(o) { const rgb = Buffer.alloc(W * H * 3); for (let i = 0; i < W * H; i++) { const p = PAL[BUF[i]]; rgb[i * 3] = p[0]; rgb[i * 3 + 1] = p[1]; rgb[i * 3 + 2] = p[2]; } fs.writeFileSync(o + '.rgb', rgb); execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-i', o + '.rgb', '-vf', 'scale=iw*4:ih*4:flags=neighbor', o]); fs.unlinkSync(o + '.rgb'); }
if (a === 'film') { for (const t of b.split(',').map(Number)) { E.render(t); save(out.replace('%t', t.toFixed(2).padStart(6, '0'))); } }
else { const k = +a, u = +b, t = +(c || 0); BUF.fill(0); const V = Z.zDraw(k, u, t); const L = Z.ZL[k]; const mb = (L && L.maskBox) || [-36, -22, 36, 22];
  const r = [V.X(mb[0]), V.Y(mb[1]), V.X(mb[2]), V.Y(mb[3])]; for (let X = Math.max(0, Math.round(r[0])); X <= Math.min(W - 1, Math.round(r[2])); X += 2) { for (const Y of [Math.round(r[1]), Math.round(r[3])]) if (Y >= 0 && Y < H) BUF[Y * W + X] = 73; } for (let Y = Math.max(0, Math.round(r[1])); Y <= Math.min(H - 1, Math.round(r[3])); Y += 2) for (const X of [Math.round(r[0]), Math.round(r[2])]) if (X >= 0 && X < W) BUF[Y * W + X] = 73;
  save(out); }
