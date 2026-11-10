// node verify.js built.js outdir : the checks for verification.txt
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process'), crypto = require('crypto');
const [piece, outd] = process.argv.slice(2);
global.window = { PIECES: [] }; eval(fs.readFileSync(piece, 'utf8'));
const E = window.__hollow_core, L = [];
const md = (t) => { E.render(t); return crypto.createHash('md5').update(Buffer.from(E.RGB)).digest('hex'); };
console.log('THE HOLLOW (Fable Saga part V): verification');
const mp4 = path.join(outd, 'the-hollow-silent.mp4');
if (fs.existsSync(mp4)) console.log('video: ' + execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=codec_name,profile,pix_fmt,width,height,r_frame_rate,nb_read_frames:format=duration', '-of', 'default=nw=1', mp4]).toString().trim().replace(/\n/g, ', '));
// determinism: the same t renders the same picture, in order, out of order, and after other frames
const ts = [0, 3, 7.5, 10.6, 14, 17.4, 23, 26.2, 29.4, 34, 38.8], a = ts.map(md); const b = ts.slice().reverse().map(md).reverse(); for (let f = 300; f < 330; f++) E.render(f / 30); const c = ts.map(md);
console.log('determinism: ' + ts.length + ' frames rendered in order, in reverse and after a seek: ' + (a.every((h, i) => h === b[i] && h === c[i]) ? 'identical' : 'DIFFER'));
// flashes and timing
const t0 = Date.now(); for (let f = 0; f < 1200; f++) { E.render(f / 30); let s = 0, n = 0; const R = E.RGB; for (let i = 0; i < R.length; i += 21) { s += R[i] * 0.3 + R[i + 1] * 0.59 + R[i + 2] * 0.11; n++; } L.push(s / n); }
console.log('render: ' + ((Date.now() - t0) / 1200).toFixed(1) + ' ms/frame average over 1200 frames (node, one core)');
const ev = []; for (let i = 1; i < L.length; i++) if (Math.abs(L[i] - L[i - 1]) > 60) ev.push([i, L[i] - L[i - 1]]);
const fl = []; for (let k = 0; k < ev.length; k++) { if (k + 1 < ev.length && ev[k + 1][0] - ev[k][0] <= 3 && Math.sign(ev[k + 1][1]) !== Math.sign(ev[k][1])) { fl.push([ev[k][0], ev[k + 1][0] - ev[k][0]]); k++; } else fl.push([ev[k][0], 0]); }
let worst = 0; for (let k = 0; k < fl.length; k++) { let n = 0; for (let j = k; j < fl.length && fl[j][0] - fl[k][0] < 30; j++) n++; worst = Math.max(worst, n); }
console.log('flash check 0-40 s (mean-luminance jump > 60/255 between frames): ' + fl.length + ' events; worst in any one second: ' + worst + ' (limit 3): ' + (worst <= 3 ? 'PASS' : 'FAIL'));
console.log('  ' + fl.map(([f, d]) => (f / 30).toFixed(2) + (d ? ' (flash, ' + d + ' frame' + (d > 1 ? 's' : '') + ')' : ' (cut)')).join(', '));
console.log('cue alignment (HIT time -> frame its impact lands on; the frame index is round(t*30)):');
for (const h of [3.0, 3.6, 4.0, 4.4, 4.8, 5.4, 7.5, 8.2, 8.8, 9.3, 9.7, 10.0, 10.6, 11.6, 12.6, 13.4, 14.0, 15.0, 16.2, 17.4, 18.4, 23.0, 25.0, 25.4, 25.7, 26.0, 26.2, 26.4, 27.0, 27.6, 28.2, 28.8, 29.4, 31.0, 32.0, 34.0]) { const f = Math.round(h * 30); console.log('  ' + h.toFixed(1).padStart(5) + ' s -> frame ' + String(f).padStart(4) + '  (luminance ' + L[f - 1].toFixed(0) + ' -> ' + L[f].toFixed(0) + ' -> ' + L[f + 1].toFixed(0) + ')'); }
console.log('captions: ' + E.CAPS.map((c) => c[0].toFixed(1) + ' ' + (c[3] && c[2] === 's' ? c[3] + ': ' : '') + c[4]).join(' | ') + ' | 37.5 title FABLE 5.5 / PART V · THE HOLLOW | 38.8 the shadow blinks');
