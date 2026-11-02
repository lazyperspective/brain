// The look-development set for "3 a.m.": key stills (full 1080 x 1350 PNGs), a 12-frame contact sheet and a strip of
// the first two seconds, all rendered through the gallery page (render.js).
//   node stills.js [outdir]     (default: the session scratchpad, imagined/threeam/final)
const path = require('path'), { execFileSync } = require('child_process');
const out = process.argv[2] || '/tmp/claude-0/-home-user-brain/f1f7475c-3827-5141-bc67-2671553b043a/scratchpad/imagined/threeam/final';
const R = (args, env) => execFileSync('node', [path.join(__dirname, 'render.js'), ...args], { stdio: 'inherit', env: Object.assign({}, process.env, env || {}) });
const KEY = [0.13, 1.5, 4.6, 10.4, 15.9, 16.9, 18.4, 21.1, 22.2, 26.0, 31.0, 36.6];
R(['stills', path.join(out, 'stills'), KEY.join(',')]);
R(['sheet', path.join(out, 'contact-sheet.png'), [0.2, 1.6, 3.8, 6.0, 9.8, 11.6, 14.6, 15.9, 17.9, 21.8, 27.5, 36.3].join(',')], { COLS: '4', SCALE: '0.3' });
R(['sheet', path.join(out, 'strip-first-2s.png'), [0, 0.067, 0.133, 0.2, 0.3, 0.45, 0.6, 0.8, 1.0, 1.2, 1.33, 1.4, 1.5, 1.65, 1.8, 2.0].join(',')], { COLS: '8', SCALE: '0.2' });
