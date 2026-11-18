const { Paper, T, hex, rng32 } = require('./engine');
const S = +process.argv[2] || 2;
const cv = new Paper(960, 540, S, hex('#dcae92'), 7);
const R = rng32(3);
const cols = ['#1b1f5e', '#2e7fc4', '#6fd0c0', '#ffc98a', '#f0508c', '#fff3c8'].map(hex);
let t0 = Date.now();
// pastel bands
for (let i = 0; i < 6; i++) for (let k = 0; k < 9; k++) {
  const y = 30 + i * 36 + R() * 8, x = 20 + k * 30 + R() * 20;
  cv.stroke([[x, y], [x + 160 + R() * 60, y - 6 + R() * 12]], { ...T.pastel, w: 30, col: cols[i], P: 0.55 + i * 0.07 });
}
cv.smudge([[40, 60], [300, 70], [60, 120], [300, 130]], { r: 26, str: 0.3 });
// pencil hatching
for (let i = 0; i < 6; i++) for (let k = 0; k < 40; k++) {
  const x = 520 + k * 4 + R() * 2, y = 30 + i * 60;
  cv.stroke([[x, y + 50], [x + 26, y]], { ...T.pencil, w: 1.5, col: cols[i], P: 0.5 + R() * 0.35 });
}
// oil pastel
for (let i = 0; i < 6; i++) cv.stroke([[720, 40 + i * 60], [800, 30 + i * 60], [900, 50 + i * 60]], { ...T.oil, w: 7, col: cols[i], P: 0.85 });
// conte
for (let i = 0; i < 6; i++) cv.stroke([[40, 300 + i * 30], [200, 296 + i * 30], [400, 306 + i * 30]], { ...T.conte, w: 4, col: cols[0], P: 0.4 + i * 0.12 });
cv.dust(700, 420, 30, cols[3], 0.8);
cv.stroke([[690, 420], [710, 420]], { ...T.oil, w: 8, col: cols[5], P: 1 });
console.log('ms', Date.now() - t0, cv.nstrokes);
cv.save('out/test1.png');
