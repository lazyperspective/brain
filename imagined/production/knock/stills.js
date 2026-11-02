// Look-development stills of "The Knock": the standard contact sheet (one frame per beat) and a strip of the first
// two seconds, rendered through render.js (Playwright Chromium, the real composited 1080 × 1350 frames).
//   node stills.js [outDir]          -> contact-sheet.png (16 beats, 4 columns) and strip-0-2s.png (12 frames)
//   NOINK=1 node stills.js ...       the pixel world alone, without the imagination layer (for checking the reality)
const { execFileSync } = require('child_process'), path = require('path'), fs = require('fs');
const out = process.argv[2] || '/tmp/claude-0/-home-user-brain/f1f7475c-3827-5141-bc67-2671553b043a/scratchpad/imagined/knock';
fs.mkdirSync(out, { recursive: true });
const R = path.join(__dirname, 'render.js');
const BEATS = '0.1,1.9,3.8,6.2,8.8,10.85,13.4,16.6,18.3,19.8,21.0,23.9,25.6,27.6,30.3,35.0';
const STRIP = '0,0.067,0.133,0.2,0.43,0.5,0.83,0.9,1.1,1.3,1.6,1.95';
execFileSync('node', [R, 'sheet', path.join(out, 'contact-sheet.png'), BEATS, '4'], { stdio: 'inherit', env: { ...process.env, SCALE: process.env.SCALE || '0.3' } });
execFileSync('node', [R, 'sheet', path.join(out, 'strip-0-2s.png'), STRIP, '6'], { stdio: 'inherit', env: { ...process.env, SCALE: '0.32' } });
console.log('wrote', path.join(out, 'contact-sheet.png'), 'and', path.join(out, 'strip-0-2s.png'));
