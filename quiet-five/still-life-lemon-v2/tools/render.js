// Export: renders the piece in headless Chromium (Playwright) and encodes with ffmpeg.
// usage: node tools/render.js [all|still|video|strip] [stillT] [snapshotName]
//   still: still-4k.png, still-x.jpg, crops/  (and snapshots/<snapshotName>.png if given)
//   video: loop-4x5.mp4, loop-4x5-x3.mp4, contact-sheet.png, seam.png, verification.txt
//   strip: _work/strip-*.png (consecutive frames around the release of the bubble and a peel crop)
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '..', '..', 'quiet-five-output', 'still-life-lemon-v2');
const FPS = 30, LOOP = 10, NF = FPS * LOOP;
const mode = process.argv[2] || 'all';
const STILL_T = parseFloat(process.argv[3] || '5.3');
const SNAP = process.argv[4] || '';

function ff(args, input) { return execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { input, maxBuffer: 1 << 30 }); }
function savePng(buf, w, h, file) { ff(['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-i', '-', '-frames:v', '1', file], buf); }
function meanAbs(a, b) { let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return s / ((a.length / 4) * 3); }
function lumaRegion(buf, w, x0, y0, rw, rh, ch = 4) {
  let s = 0;
  for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) { const i = (y * w + x) * ch; s += 0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2]; }
  return s / (rw * rh);
}

(async () => {
  fs.mkdirSync(path.join(OUT, 'crops'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'snapshots'), { recursive: true });
  const work = path.join(OUT, '_work');
  fs.mkdirSync(work, { recursive: true });
  const t0 = Date.now();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.log('[error]', e.message));
  await page.goto('file://' + path.join(ROOT, 'index.html') + '?export&s=1');
  await page.waitForFunction(() => !!window.__piece);
  console.log('init (paints the canvas at 2160x2700)...');
  await page.evaluate(() => window.__piece.init());
  const tInit = (Date.now() - t0) / 1000;
  console.log('init done', tInit.toFixed(1), 's');
  const grab = async (t, scale) => {
    const b64 = await page.evaluate(([t, s]) => { window.__piece.renderAt(t, { scale: s }); return window.__piece.rgbaBase64(); }, [t, scale]);
    return Buffer.from(b64, 'base64');
  };
  const log = [];
  if (mode === 'all' || mode === 'still') {
    const ts = Date.now();
    const still = await grab(STILL_T, 1);
    savePng(still, 2160, 2700, path.join(OUT, 'still-4k.png'));
    execFileSync('python3', ['-c', 'import sys; from PIL import Image; Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2], "JPEG", quality=94, subsampling=0, optimize=True)', path.join(OUT, 'still-4k.png'), path.join(OUT, 'still-x.jpg')]);
    console.log('still', ((Date.now() - ts) / 1000).toFixed(1), 's');
    const crops = { 'focal-lemon': [880, 1420, 900, 760], 'darkest-apron': [1200, 2180, 900, 520], 'busiest-roemer-prunts': [430, 1250, 600, 600], 'corner-top-left': [0, 0, 800, 800] };
    for (const [name, [x, y, w, h]] of Object.entries(crops)) ff(['-i', path.join(OUT, 'still-4k.png'), '-vf', `crop=${w}:${h}:${x}:${y}`, path.join(OUT, 'crops', name + '.png')]);
    if (SNAP) ff(['-i', path.join(OUT, 'still-4k.png'), '-vf', 'scale=1080:1350:flags=lanczos', path.join(OUT, 'snapshots', SNAP + '.png')]);
    log.push(`still: t=${STILL_T}s rendered natively at 2160x2700`);
  }
  if (mode === 'strip') {
    // consecutive frames at video resolution: bubble release + peel motion
    const tA = parseFloat(process.argv[3] || '5.5');
    const frames = [];
    for (let k = 0; k < 8; k++) frames.push(await grab(tA + k * 4 / FPS, 0.5));
    for (let k = 0; k < 8; k++) savePng(frames[k], 1080, 1350, path.join(work, `s${k}.png`));
    const inp = []; for (let k = 0; k < 8; k++) inp.push('-i', path.join(work, `s${k}.png`));
    const fcB = Array.from({ length: 8 }, (_, k) => `[${k}]crop=150:220:330:490,scale=300:440:flags=neighbor[b${k}]`).join(';') + ';' + Array.from({ length: 8 }, (_, k) => `[b${k}]`).join('') + 'hstack=inputs=8[o]';
    ff([...inp, '-filter_complex', fcB, '-map', '[o]', path.join(work, 'strip-bubble.png')]);
    const fcP = Array.from({ length: 8 }, (_, k) => `[${k}]crop=240:380:340:960[p${k}]`).join(';') + ';' + Array.from({ length: 8 }, (_, k) => `[p${k}]`).join('') + 'hstack=inputs=8[o]';
    ff([...inp, '-filter_complex', fcP, '-map', '[o]', path.join(work, 'strip-peel.png')]);
    // peel over the whole loop (every 1.25 s)
    const fr2 = [];
    for (let k = 0; k < 8; k++) fr2.push(await grab(k * 1.25, 0.5));
    for (let k = 0; k < 8; k++) savePng(fr2[k], 1080, 1350, path.join(work, `l${k}.png`));
    const inp2 = []; for (let k = 0; k < 8; k++) inp2.push('-i', path.join(work, `l${k}.png`));
    ff([...inp2, '-filter_complex', fcP, '-map', '[o]', path.join(work, 'strip-peel-loop.png')]);
    for (let k = 0; k < 8; k++) { fs.unlinkSync(path.join(work, `s${k}.png`)); fs.unlinkSync(path.join(work, `l${k}.png`)); }
  }
  if (mode === 'all' || mode === 'video') {
    const tv = Date.now();
    const enc = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', '1080x1350', '-r', String(FPS), '-i', '-',
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int+bitexact,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-profile:v', 'high', '-tune', 'film', '-x264-params', 'aq-mode=3',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-movflags', '+faststart', '-an', path.join(OUT, 'loop-4x5.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((r) => enc.on('close', r));
    let prev = null, first = null, sumD = 0, nD = 0, maxD = 0;
    const keep = new Set([...Array.from({ length: 12 }, (_, k) => k * (NF / 12)), NF - 3, NF - 2, NF - 1, 0, 1, 2]);
    for (let i = 0; i < NF; i++) {
      const buf = await grab(i / FPS, 0.5);
      if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once('drain', r));
      if (prev) { const d = meanAbs(prev, buf); sumD += d; nD++; maxD = Math.max(maxD, d); }
      if (i === 0) first = buf;
      if (keep.has(i)) savePng(buf, 1080, 1350, path.join(work, `f${String(i).padStart(3, '0')}.png`));
      prev = buf;
      if (i % 30 === 0) console.log('frame', i, ((Date.now() - tv) / 1000).toFixed(1), 's');
    }
    enc.stdin.end();
    await done;
    const seamD = meanAbs(prev, first);
    const tVid = (Date.now() - tv) / 1000;
    const lst = path.join(work, 'x3.txt');
    fs.writeFileSync(lst, ['loop-4x5.mp4', 'loop-4x5.mp4', 'loop-4x5.mp4'].map((f) => `file '${path.join(OUT, f)}'`).join('\n') + '\n');
    ff(['-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', '-movflags', '+faststart', path.join(OUT, 'loop-4x5-x3.mp4')]);
    const sheetIn = []; for (let k = 0; k < 12; k++) sheetIn.push('-i', path.join(work, `f${String(k * (NF / 12)).padStart(3, '0')}.png`));
    const fc = Array.from({ length: 12 }, (_, k) => `[${k}]scale=360:450[s${k}]`).join(';') + ';' + Array.from({ length: 12 }, (_, k) => `[s${k}]`).join('') + 'xstack=inputs=12:layout=' +
      Array.from({ length: 12 }, (_, k) => `${(k % 4) * 360}_${Math.floor(k / 4) * 450}`).join('|') + '[o]';
    ff([...sheetIn, '-filter_complex', fc, '-map', '[o]', path.join(OUT, 'contact-sheet.png')]);
    const seamIn = [NF - 3, NF - 2, NF - 1, 0, 1, 2].flatMap((i) => ['-i', path.join(work, `f${String(i).padStart(3, '0')}.png`)]);
    ff([...seamIn, '-filter_complex', '[0][1][2][3][4][5]hstack=inputs=6[o]', '-map', '[o]', path.join(OUT, 'seam.png')]);
    let best = { v: 1e9, x: 0, y: 0 };
    for (let y = 0; y + 64 <= 1350; y += 16) for (let x = 0; x + 64 <= 1080; x += 16) { const v = lumaRegion(first, 1080, x, y, 64, 64); if (v < best.v) best = { v, x, y }; }
    const dec = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', path.join(OUT, 'loop-4x5.mp4'), '-frames:v', '1', '-vf', 'scale=in_color_matrix=bt709:in_range=tv:flags=accurate_rnd+full_chroma_int,format=rgb24', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 30 });
    const after = lumaRegion(dec, 1080, best.x, best.y, 64, 64, 3);
    const wallB = lumaRegion(first, 1080, 760, 60, 128, 128), wallA = lumaRegion(dec, 1080, 760, 60, 128, 128, 3);
    const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_frames,color_space,color_primaries,color_transfer,color_range,bit_rate:format=duration,size', '-of', 'default=noprint_wrappers=1', path.join(OUT, 'loop-4x5.mp4')]).toString();
    const probe3 = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=nb_frames,width,height:format=duration', '-of', 'default=noprint_wrappers=1', path.join(OUT, 'loop-4x5-x3.mp4')]).toString();
    log.push('loop-4x5.mp4 ffprobe:\n' + probe.trim());
    log.push('loop-4x5-x3.mp4 ffprobe:\n' + probe3.trim());
    log.push(`loop length: ${LOOP} s = ${NF} frames at ${FPS} fps (frames t = i/30, i = 0..${NF - 1}; frame ${NF} == frame 0 by construction: every motion is periodic in ${LOOP} s)`);
    log.push(`render time: static painting ${tInit.toFixed(1)} s, ${NF} frames ${tVid.toFixed(1)} s (${(tVid / NF).toFixed(2)} s/frame incl. transfer + encode)`);
    log.push(`seam check (8-bit RGB mean abs diff): last->first = ${seamD.toFixed(4)}; typical frame->frame mean = ${(sumD / nD).toFixed(4)}, max = ${maxD.toFixed(4)}`);
    log.push(`darkest 64x64 region at (${best.x},${best.y}) in 1080x1350: luma before encode ${best.v.toFixed(2)}, after encode/decode ${after.toFixed(2)} (0-255 full range)`);
    log.push(`dark wall region (760,60 128x128): luma before ${wallB.toFixed(2)}, after ${wallA.toFixed(2)}`);
    for (const i of keep) { const f = path.join(work, `f${String(i).padStart(3, '0')}.png`); if (fs.existsSync(f)) fs.unlinkSync(f); }
    fs.unlinkSync(lst);
  }
  await browser.close();
  const total = (Date.now() - t0) / 1000;
  log.push(`total wall time: ${total.toFixed(1)} s`);
  if (mode === 'all') fs.writeFileSync(path.join(OUT, 'verification.txt'), log.join('\n\n') + '\n');
  console.log(log.join('\n'));
})().catch((e) => { console.error(e); process.exit(1); });
