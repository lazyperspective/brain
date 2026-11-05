// Look-development sheet of the birds: every colour set in a row of poses, on a flat backdrop, at 6×.
//   node birdsheet.js <out.png> [t for the light, default 2]
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
global.window = { PIECES: [] };
eval(fs.readFileSync(path.join(__dirname, '../../js/pieces/08-migrating-birds.js'), 'utf8'));
const E = window.__birdsCore, X = E._test;
E.build();
const out = process.argv[2], t = +(process.argv[3] || 2);
X.setLight(t);
const cols = [X.YEL, X.BLD, X.LAV, X.TEA, ...X.RES_COL];
const poses = [
  {}, { tilt: 0.42 }, { tilt: -0.45, beak: 1, puff: 0.3 }, { tilt: 0.9, headDx: -1.3, headDy: 1, wingOut: 0.3 }, { blink: 1 }, { crouch: 1 },
  { mode: 'sleep', puff: 0.4 }, { mode: 'fly', flap: 0 }, { mode: 'fly', flap: 0.25 }, { mode: 'fly', flap: 0.5 }, { mode: 'fly', flap: -1 }, { face: -1 },
];
const CW = 30, CH = 26;
for (let i = 0; i < E.W * E.H * 3; i += 3) { E.C[i] = 200; E.C[i + 1] = 214; E.C[i + 2] = 222; }
E.DM.fill(0);
cols.forEach((c, r) => poses.forEach((p, k) => {
  const o = X.pose0({}); o.face = 1; o.r = r === 2 ? 5.2 : 4.6; if (r === 0) o.sleek = 1; if (r === 1) { o.crest = 1; o.twig = 1; } if (r === 3) o.longTail = 1; if (r === 7) o.cocked = 1;
  Object.assign(o, p);
  o.x = 6 + k * CW + 12; o.y = 4 + r * CH + 18; if (o.mode === 'fly') o.y -= 6;
  X.drawBird(c, o);
}));
X.quantise();
const raw = out + '.rgb', buf = Buffer.alloc(E.W * E.H * 3);
for (let i = 0; i < E.W * E.H; i++) { const p = E.PAL[E.OUT[i]]; buf[i * 3] = p[0]; buf[i * 3 + 1] = p[1]; buf[i * 3 + 2] = p[2]; }
fs.writeFileSync(raw, buf);
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${E.W}x${E.H}`, '-i', raw, '-vf', `crop=360:${Math.min(450, cols.length * CH + 10)}:0:0,scale=iw*4:ih*4:flags=neighbor`, out]);
fs.unlinkSync(raw);
console.log(out);
