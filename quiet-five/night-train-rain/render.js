// Render the loop and all deliverables.
// usage: node render.js [outDir] [--w 1080 --h 1350] [--frames 360] [--still 6.9] [--skip-video]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = args[0] && !args[0].startsWith('--') ? args[0] : '/home/user/brain/quiet-five-output/night-train-rain';
const W = +opt('w', 1080), H = +opt('h', 1350), FPS = 30, L = 12;
const NF = +opt('frames', L * FPS);
const STILL_T = +opt('still', 6.9);
const SKIPV = args.includes('--skip-video');
const SKIPS = args.includes('--skip-still');
fs.mkdirSync(path.join(OUT, 'crops'), { recursive: true });

function run(cmd, a, input) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, a, { stdio: ['pipe', 'inherit', 'inherit'] });
    p.on('close', c => c === 0 ? res() : rej(new Error(cmd + ' exited ' + c)));
    if (input) p.stdin.end(input); else p.stdin.end();
  });
}
const png = (buf, w, h, out, vf) => run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-i', '-', ...(vf ? ['-vf', vf] : []), '-frames:v', '1', out], buf);
const luma = (b, i) => 0.2126 * b[i] + 0.7152 * b[i + 1] + 0.0722 * b[i + 2];

async function page(browser, w, h) {
  const p = await browser.newPage({ viewport: { width: 900, height: 1100 } });
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  p.on('console', m => { const t = m.text(); if (!/GPU stall/.test(t)) console.log('[page]', t); });
  await p.goto('file://' + path.join(__dirname, 'index.html') + `?export&w=${w}&h=${h}`);
  await p.waitForFunction(() => window.__piece && window.__piece.ready, null, { timeout: 600000 });
  return p;
}
async function grab(p, t) { return Buffer.from(await p.evaluate(t => __piece.frame(t), t), 'base64'); }

(async () => {
  const browser = await chromium.launch();
  const log = [];
  const T0 = Date.now();
  if (!SKIPV) {
    const p = await page(browser, W, H);
    const mp4 = path.join(OUT, 'loop-4x5.mp4');
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-framerate', String(FPS), '-i', '-',
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-profile:v', 'high', '-x264-params', 'aq-mode=3:aq-strength=0.9:deblock=-1,-1',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
      '-movflags', '+faststart', '-an', mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
    const ffDone = new Promise(r => ff.on('close', r));
    const keep = new Map();
    const sheetIdx = Array.from({ length: 12 }, (_, i) => Math.round(i * NF / 12));
    const seamIdx = [NF - 3, NF - 2, NF - 1, 0, 1, 2];
    let prev = null, first = null, diffs = [];
    const tv0 = Date.now();
    for (let i = 0; i < NF; i++) {
      const buf = await grab(p, i / FPS);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (sheetIdx.includes(i) || seamIdx.includes(i)) keep.set(i, buf);
      if (i === 0) first = buf;
      if (prev) { let s = 0; for (let k = 0; k < buf.length; k += 4) s += Math.abs(buf[k] - prev[k]) + Math.abs(buf[k + 1] - prev[k + 1]) + Math.abs(buf[k + 2] - prev[k + 2]); diffs.push(s / (buf.length / 4 * 3)); }
      prev = buf;
      if (i % 30 === 0) console.log('frame', i, ((Date.now() - tv0) / 1000).toFixed(0) + 's');
    }
    let s = 0; for (let k = 0; k < first.length; k += 4) s += Math.abs(first[k] - prev[k]) + Math.abs(first[k + 1] - prev[k + 1]) + Math.abs(first[k + 2] - prev[k + 2]);
    const seamDiff = s / (first.length / 4 * 3);
    ff.stdin.end(); await ffDone;
    const renderSec = (Date.now() - tv0) / 1000;
    const sorted = diffs.slice().sort((a, b) => a - b);
    log.push(`video frames: ${NF} at ${FPS} fps = ${(NF / FPS).toFixed(3)} s loop; render+encode time ${renderSec.toFixed(0)} s (${(renderSec / NF).toFixed(2)} s/frame)`);
    log.push(`seam check: mean |diff| last->first frame = ${seamDiff.toFixed(4)} (8-bit levels); frame->frame mean ${(diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(4)}, median ${sorted[sorted.length >> 1].toFixed(4)}, min ${sorted[0].toFixed(4)}, max ${sorted[sorted.length - 1].toFixed(4)}`);
    // contact sheet and seam strip
    const tmp = path.join(OUT, '.tmp'); fs.mkdirSync(tmp, { recursive: true });
    for (const [i, b] of keep) await png(b, W, H, path.join(tmp, `f${String(i).padStart(4, '0')}.png`));
    const sheetIn = []; sheetIdx.forEach(i => sheetIn.push('-i', path.join(tmp, `f${String(i).padStart(4, '0')}.png`)));
    const fc = sheetIdx.map((_, k) => `[${k}]scale=360:450[s${k}]`).join(';') + ';' + sheetIdx.map((_, k) => `[s${k}]`).join('') + 'xstack=inputs=12:layout=' +
      Array.from({ length: 12 }, (_, k) => `${(k % 4) * 360}_${Math.floor(k / 4) * 450}`).join('|');
    await run('ffmpeg', ['-y', '-loglevel', 'error', ...sheetIn, '-filter_complex', fc, '-frames:v', '1', path.join(OUT, 'contact-sheet.png')]);
    const seamIn = []; seamIdx.forEach(i => seamIn.push('-i', path.join(tmp, `f${String(i).padStart(4, '0')}.png`)));
    await run('ffmpeg', ['-y', '-loglevel', 'error', ...seamIn, '-filter_complex', seamIdx.map((_, k) => `[${k}]scale=540:675[s${k}]`).join(';') + ';' + seamIdx.map((_, k) => `[s${k}]`).join('') + 'hstack=inputs=6', '-frames:v', '1', path.join(OUT, 'seam.png')]);
    // darks before / after encode (frame 0)
    const bw = 48; let best = 1e9, bx = 0, by = 0;
    for (let y = 0; y + bw <= H; y += bw / 2) for (let x = Math.round(W * 0.12); x + bw <= W; x += bw / 2) {
      let s2 = 0; for (let j = 0; j < bw; j++) for (let i = 0; i < bw; i++) s2 += luma(first, ((y + j) * W + x + i) * 4);
      s2 /= bw * bw; if (s2 < best) { best = s2; bx = x; by = y; }
    }
    let fbest = 1e9, fx = 0, fy = 0; // darkest block anywhere (incl. the window frame)
    for (let y = 0; y + bw <= H; y += bw / 2) for (let x = 0; x + bw <= W; x += bw / 2) {
      let s2 = 0; for (let j = 0; j < bw; j++) for (let i = 0; i < bw; i++) s2 += luma(first, ((y + j) * W + x + i) * 4);
      s2 /= bw * bw; if (s2 < fbest) { fbest = s2; fx = x; fy = y; }
    }
    const dec = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', mp4, '-frames:v', '1', '-vf', 'scale=in_color_matrix=bt709:in_range=tv:out_range=pc:flags=accurate_rnd+full_chroma_int,format=rgba', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 30 });
    const blk = (b, x, y) => { let s2 = 0; for (let j = 0; j < bw; j++) for (let i = 0; i < bw; i++) s2 += luma(b, ((y + j) * W + x + i) * 4); return s2 / (bw * bw); };
    log.push(`darkest ${bw}x${bw} region on the glass (frame 0) at (${bx},${by}): luma ${best.toFixed(2)} before encode, ${blk(dec, bx, by).toFixed(2)} after (8-bit full-range Rec.709 luma)`);
    log.push(`darkest ${bw}x${bw} region overall (window frame) at (${fx},${fy}): luma ${fbest.toFixed(2)} before encode, ${blk(dec, fx, fy).toFixed(2)} after`);
    let mad = 0; for (let k = 0; k < first.length; k += 4) mad += Math.abs(first[k] - dec[k]) + Math.abs(first[k + 1] - dec[k + 1]) + Math.abs(first[k + 2] - dec[k + 2]);
    log.push(`encode fidelity frame 0: mean |diff| ${(mad / (first.length / 4 * 3)).toFixed(3)} levels`);
    // x3
    const list = path.join(tmp, 'list.txt'); fs.writeFileSync(list, [1, 2, 3].map(() => `file '${mp4}'`).join('\n'));
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', path.join(OUT, 'loop-4x5-x3.mp4')]);
    for (const f of fs.readdirSync(tmp)) fs.unlinkSync(path.join(tmp, f));
    fs.rmdirSync(tmp);
    await p.close();
    for (const f of ['loop-4x5.mp4', 'loop-4x5-x3.mp4']) {
      const pr = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_frames,color_space,color_transfer,color_primaries,color_range:format=duration,size', '-of', 'default=nw=1', path.join(OUT, f)]).toString();
      log.push(`ffprobe ${f}:\n` + pr.trim().split('\n').map(l => '  ' + l).join('\n'));
    }
  }
  if (!SKIPS) {
    const ts = Date.now();
    const p = await page(browser, 2160, 2700);
    const b = await grab(p, STILL_T);
    await png(b, 2160, 2700, path.join(OUT, 'still-4k.png'));
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(OUT, 'still-4k.png'), '-q:v', '2', '-frames:v', '1', path.join(OUT, 'still-x.jpg')]);
    const crops = { focal: [1000, 860, 900, 900], darkest: [180, 2060, 900, 560], texture: [700, 1000, 900, 900], corner: [0, 2160, 900, 540] };
    if (process.env.CROPS) Object.assign(crops, JSON.parse(process.env.CROPS));
    for (const [k, [x, y, w, h]] of Object.entries(crops)) await png(b, 2160, 2700, path.join(OUT, 'crops', `${k}.png`), `crop=${w}:${h}:${x}:${y}`);
    log.push(`still-4k.png: t = ${STILL_T} s rendered natively at 2160x2700 in ${((Date.now() - ts) / 1000).toFixed(0)} s; still-x.jpg ${(fs.statSync(path.join(OUT, 'still-x.jpg')).size / 1e6).toFixed(2)} MB`);
    await p.close();
  }
  await browser.close();
  log.push(`total ${((Date.now() - T0) / 1000).toFixed(0)} s`);
  const txt = log.join('\n');
  console.log(txt);
  fs.writeFileSync(path.join(OUT, SKIPV ? 'verification-still.txt' : 'verification.txt'), txt + '\n');
})();
