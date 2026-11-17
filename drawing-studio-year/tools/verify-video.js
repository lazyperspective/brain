// node tools/verify-video.js out/a-year-still-warm-9x16.mp4 [sheet.png]
// Looks at the finished film the way a player would: container facts, how dark the darkest
// frame is, whether any frame jumps away from its neighbours, and whether the last frame
// hands over to the first as gently as any two neighbours do.
'use strict';
const { spawnSync } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const file = process.argv[2], sheet = process.argv[3];
const run = (cmd, args, enc) => { const r = spawnSync(cmd, args, { maxBuffer: 1 << 30, encoding: enc === undefined ? 'utf8' : enc }); if (r.status !== 0) { console.error(r.stderr.toString()); process.exit(1); } return r.stdout; };
const info = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,r_frame_rate,nb_frames,pix_fmt:format=duration,bit_rate,size', '-of', 'json', file]));
const s = info.streams[0], n = +s.nb_frames;
console.log(`${path.basename(file)}: ${s.codec_name} ${s.width}x${s.height} ${s.pix_fmt} ${s.r_frame_rate} fps, ${n} frames, ${(+info.format.duration).toFixed(2)} s, ${(info.format.bit_rate / 1e6).toFixed(1)} Mbit/s, ${(info.format.size / 1e6).toFixed(1)} MB`);
// small grey copy of every frame
const w = 96, h = Math.round(96 * s.height / s.width / 2) * 2, raw = run('ffmpeg', ['-v', 'error', '-i', file, '-vf', `scale=${w}:${h}:flags=area,format=gray`, '-f', 'rawvideo', '-'], 'buffer');
const fsz = w * h, got = raw.length / fsz; if (got !== n) console.log('  note: decoded ' + got + ' frames');
const mean = new Float64Array(got), diff = new Float64Array(got);
for (let f = 0; f < got; f++) { let m = 0, d = 0; const a = f * fsz, b = ((f + 1) % got) * fsz; for (let i = 0; i < fsz; i++) { m += raw[a + i]; d += Math.abs(raw[a + i] - raw[b + i]); } mean[f] = m / fsz; diff[f] = d / fsz; }
let dk = 0; for (let f = 1; f < got; f++) if (mean[f] < mean[dk]) dk = f;
console.log(`  darkest frame: ${dk} (${(dk / 30).toFixed(1)} s) mean luma ${mean[dk].toFixed(1)}/255; brightest ${Math.max(...mean).toFixed(1)}`);
const sorted = Array.from(diff).sort((a, b) => a - b), med = sorted[got >> 1];
const seam = diff[got - 1], near = Math.max(diff[got - 2], diff[0]);
console.log(`  frame-to-frame change: median ${med.toFixed(2)}, 99th percentile ${sorted[Math.floor(got * 0.99)].toFixed(2)}, max ${sorted[got - 1].toFixed(2)}`);
const spikes = []; for (let f = 0; f < got; f++) { const lo = Math.max(0, f - 6), win = Array.from(diff.subarray(lo, Math.min(got, f + 7))).sort((a, b) => a - b), lm = win[win.length >> 1]; if (diff[f] > 2.5 * lm + 1.0) spikes.push(`${f}(${diff[f].toFixed(1)} vs ${lm.toFixed(1)})`); }
console.log(`  frames that jump away from their neighbours: ${spikes.length ? spikes.join(' ') : 'none'}`);
console.log(`  the loop: last->first changes ${seam.toFixed(2)}; its neighbours change ${diff[got - 2].toFixed(2)} and ${diff[0].toFixed(2)}  ${seam <= near * 1.6 + 0.3 ? 'SEAMLESS' : 'SEAM VISIBLE'}`);
if (sheet) { const step = Math.round(got / 24); run('ffmpeg', ['-v', 'error', '-y', '-i', file, '-vf', `select='not(mod(n,${step}))',scale=${Math.round(2400 / 12 / 2) * 2}:-2,tile=12x2:padding=3`, '-frames:v', '1', sheet]); console.log('  contact sheet -> ' + sheet); }
