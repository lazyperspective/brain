// node tools/deliver.js [step...]   steps: mux poster sheet stills strips flash srt verify (default: all)
// Builds the deliverables in field-guide-video/ from the render cache (cache/master.mkv), the silent master and
// the score. The poster is rendered natively at 2160x2700 (opts.scale = 2).
const L = require('./lib');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const OUT = L.OUT, ROOT = L.ROOT, TL = L.TL;
const CACHE = path.join(ROOT, 'cache', 'master.mkv');
const SILENT = path.join(OUT, 'field-guide-4x5-silent.mp4'), FINAL = path.join(OUT, 'field-guide-4x5.mp4');
const W = 1080, H = 1350, FB = W * H * 4;

function run(cmd, args) { return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 26 }); }
// decode the frames whose index is in 'want' (sorted) from the cache, calling fn(index, rgbaBuffer) for each
function decodeFrames(want, fn, w, h) {
  w = w || W; h = h || H;
  return new Promise((res, rej) => {
    const expr = want.map((n) => 'eq(n\\,' + n + ')').join('+');
    const args = ['-hide_banner', '-loglevel', 'error', '-i', CACHE, '-vf', "select='" + expr + "'" + (w !== W ? ',scale=' + w + ':' + h + ':flags=area' : ''), '-vsync', '0', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'];
    if (want.length > 400) { args[6] = (w !== W ? 'scale=' + w + ':' + h + ':flags=area' : 'null'); }
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'inherit'] });
    let acc = [], have = 0, k = 0, fbw = w * h * 4;
    p.stdout.on('data', (d) => {
      acc.push(d); have += d.length;
      while (have >= fbw) {
        const all = Buffer.concat(acc); const fr = all.subarray(0, fbw); const rest = all.subarray(fbw);
        acc = rest.length ? [Buffer.from(rest)] : []; have = rest.length;
        fn(want.length > 400 ? k : want[k], Buffer.from(fr)); k++;
      }
    });
    p.on('close', (c) => (c === 0 ? res(k) : rej(new Error('decode ' + c))));
  });
}

async function mux() {
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', SILENT, '-i', path.join(OUT, 'score.wav'), '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-ac', '2', '-shortest', '-movflags', '+faststart', FINAL]);
  console.log('muxed', FINAL);
}
async function poster() {
  const b = await L.chromium.launch();
  const pg = await L.openPage(b, { ss: 2, scale: 2 });
  const buf = await pg.frame(1199 / 30);
  await b.close();
  await L.png(buf, path.join(OUT, 'poster.png'), 2160, 2700);
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(OUT, 'poster.png'), '-q:v', '1', '-qmin', '1', '-qmax', '2', path.join(OUT, 'poster.jpg')]);
  // quality ~95 in libjpeg terms: verify by size; also write with PIL if available for an exact q=95
  try { run('python3', ['-c', "from PIL import Image; Image.open('" + path.join(OUT, 'poster.png') + "').convert('RGB').save('" + path.join(OUT, 'poster.jpg') + "', quality=95, subsampling=0)"]); } catch (e) { /* ffmpeg version stays */ }
  console.log('poster');
}
async function sheet() {
  const want = []; for (let n = 0; n < 1200; n += 15) want.push(n);
  const bufs = [];
  await decodeFrames(want, (n, b) => { L.stamp(b, W, (n / 30).toFixed(1), 9); bufs.push(b); });
  await L.tile(bufs, path.join(OUT, 'contact-sheet.png'), W, H, 10, 216);
  console.log('contact sheet', bufs.length, 'frames');
}
const STILLS = [
  ['01-hi-thud', 0.5], ['01b-thinker', 2.0], ['02-cloud-doubles', 4.45], ['02b-lower-the-effort', 5.45], ['03-one-plank-short', 8.75], ['04-thumbs-up', 11.85],
  ['04b-say-exactly', 12.95], ['05-you-own-this-codebase', 14.75], ['05b-tidies-everything', 16.95], ['06-goes-quiet', 19.85], ['06b-found-a-bug', 21.55],
  ['07-hires-reviewers', 24.6], ['07b-half-pop', 25.3], ['08-sticky-note-mummy', 29.3], ['08b-ask-before-deleting', 30.55], ['09-dense-report', 32.75],
  ['09b-clean-card', 34.25], ['10-the-whole-dial', 39.0]];
async function stills() {
  L.ensureDir(path.join(OUT, 'stills'));
  const want = STILLS.map((s) => Math.round(s[1] * 30)).sort((a, b) => a - b);
  const byN = {};
  await decodeFrames(want, (n, b) => { byN[n] = b; });
  for (const [name, t] of STILLS) { const n = Math.round(t * 30); await L.png(byN[n], path.join(OUT, 'stills', name + '-' + t.toFixed(2) + 's.png'), W, H); }
  console.log('stills', STILLS.length);
}
const HO = [['01-hi-to-effort', 2.6, 3.6], ['02-cloud-flythrough', 5.7, 7.3], ['03-bridge-to-clearing', 9.4, 11.2], ['04-sprint-to-village', 13.2, 14.6],
  ['05-village-to-mine', 17.6, 19.0], ['06-crane-up-the-cliff', 22.1, 23.7], ['07-clones-to-notes', 25.8, 27.4], ['08-notes-to-report', 30.4, 31.8], ['09-crane-to-reveal', 34.2, 38.6]];
async function strips() {
  L.ensureDir(path.join(OUT, 'strips'));
  for (const [name, a, b] of HO) {
    const want = []; for (let n = Math.round(a * 30); n <= Math.round(b * 30); n += 2) want.push(n);
    const bufs = [];
    await decodeFrames(want, (n, buf) => { L.stamp(buf, W, (n / 30).toFixed(2), 8); bufs.push(buf); });
    await L.tile(bufs, path.join(OUT, 'strips', name + '.png'), W, H, 8, 270);
  }
  console.log('strips', HO.length);
}
// flash check (after WCAG 2.x / Harding style): relative luminance per frame (linear), over the whole frame and over each
// quarter of it (25% of the area). A transition is a change of >= 0.1 where the darker side is below 0.8; a flash is a
// pair of opposing transitions. Fail if more than 3 flashes fall in any one-second window.
async function flash() {
  const w = 120, h = 150, want = []; for (let n = 0; n < 1200; n++) want.push(n);
  const lum = []; // [frame][region 0 = whole, 1..4 quarters]
  const lin = new Float64Array(256); for (let i = 0; i < 256; i++) { const v = i / 255; lin[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  await decodeFrames(want, (n, b) => {
    const s = [0, 0, 0, 0, 0], c = [0, 0, 0, 0, 0];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, L_ = 0.2126 * lin[b[o]] + 0.7152 * lin[b[o + 1]] + 0.0722 * lin[b[o + 2]];
      const q = 1 + (x >= w / 2 ? 1 : 0) + (y >= h / 2 ? 2 : 0);
      s[0] += L_; c[0]++; s[q] += L_; c[q]++;
    }
    lum[n] = s.map((v, i) => v / c[i]);
  }, w, h);
  const res = [];
  let worstAll = 0, worstAt = 0, maxStep = 0, maxStepAt = 0;
  for (let r = 0; r < 5; r++) {
    // collapse monotonic runs into transitions (a slow fade is one transition, not many)
    const tr = []; let start = 0, dir = 0;
    for (let n = 1; n < lum.length; n++) {
      const d = lum[n][r] - lum[n - 1][r];
      if (Math.abs(d) > maxStep) { maxStep = Math.abs(d); maxStepAt = n; }
      const sd = Math.sign(d);
      if (sd !== 0 && sd !== dir) { if (dir !== 0) tr.push([start, n - 1, dir]); start = n - 1; dir = sd; }
    }
    if (dir !== 0) tr.push([start, lum.length - 1, dir]);
    const big = tr.filter(([a, b]) => { const la = lum[a][r], lb = lum[b][r]; return Math.abs(lb - la) >= 0.1 && Math.min(la, lb) < 0.8 && (b - a) <= 15; });
    let worst = 0, at = 0;
    for (let i = 0; i < big.length; i++) {
      let n = 0; for (let j = i; j < big.length && big[j][0] - big[i][0] < 30; j++) n++;
      const flashes = Math.floor(n / 2);
      if (flashes > worst) { worst = flashes; at = big[i][0]; }
    }
    res.push({ region: r === 0 ? 'whole frame' : 'quarter ' + r, transitions: big.length, worstFlashesPerSecond: worst, at: (at / 30).toFixed(2) });
    if (worst > worstAll) { worstAll = worst; worstAt = at; }
  }
  const out = { frames: lum.length, maxFrameToFrameLuminanceChange: +maxStep.toFixed(3), at: (maxStepAt / 30).toFixed(2), regions: res, worstFlashesPerSecond: worstAll, verdict: worstAll <= 3 ? 'PASS' : 'FAIL' };
  fs.writeFileSync(path.join(ROOT, 'cache', 'flash.json'), JSON.stringify(out, null, 1));
  console.log('flash', out.verdict, worstAll, 'max step', out.maxFrameToFrameLuminanceChange);
}
function srtTime(t) { const ms = Math.round(t * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, r = ms % 1000; return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + ',' + String(r).padStart(3, '0'); }
async function srt() {
  const caps = TL.CAPS.slice().sort((a, b) => a.t0 - b.t0);
  const lines = []; let k = 1;
  for (const c of caps) {
    let text = c.text.replace('{thumb}', '👍');
    if (c.kind === 'tip') text = "HANDLER'S TIP: " + text.replace(/\n/g, ' ');
    if (c.kind === 'title') text = 'FABLE 5.2 — A FIELD GUIDE';
    lines.push(String(k++), srtTime(c.t0) + ' --> ' + srtTime(c.t1), text, '');
  }
  fs.writeFileSync(path.join(OUT, 'captions.srt'), lines.join('\n'));
  console.log('srt', k - 1, 'entries');
}
async function verify() {
  const probe = (f) => run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size,bit_rate:stream=index,codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_frames,color_space,color_primaries,color_transfer,color_range,sample_rate,channels,bit_rate', '-of', 'default=nw=1', f]);
  const count = (f) => run('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', f]).trim();
  const faststart = (f) => { const b = fs.readFileSync(f); const i = b.indexOf('moov'), j = b.indexOf('mdat'); return i >= 0 && j >= 0 && i < j ? 'yes (moov before mdat)' : 'NO'; };
  const er = spawnSyncStderr(['-hide_banner', '-nostats', '-i', FINAL, '-map', '0:a', '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const summ = er.slice(er.lastIndexOf('Summary:'));
  const rj = JSON.parse(fs.readFileSync(SILENT + '.render.json', 'utf8'));
  const fl = JSON.parse(fs.readFileSync(path.join(ROOT, 'cache', 'flash.json'), 'utf8'));
  const ar = fs.readFileSync(path.join(ROOT, 'audio', 'audio-report.txt'), 'utf8');
  const L_ = [];
  L_.push('FABLE 5.2: A FIELD GUIDE -- verification', '');
  L_.push('== ' + path.basename(FINAL), probe(FINAL).trim(), 'decoded video frames: ' + count(FINAL), 'faststart: ' + faststart(FINAL), '');
  L_.push('== ' + path.basename(SILENT), probe(SILENT).trim(), 'decoded video frames: ' + count(SILENT), 'faststart: ' + faststart(SILENT), '');
  L_.push('== poster', run('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height,pix_fmt', '-of', 'default=nw=1', path.join(OUT, 'poster.png')]).trim(), 'poster.jpg: ' + fs.statSync(path.join(OUT, 'poster.jpg')).size + ' bytes (quality 95)', '');
  L_.push('== render', `${rj.frames} frames, ${rj.workers} Playwright pages (Chromium, SwiftShader WebGL2), supersampling ${rj.ss}x, ${rj.wallSeconds} s wall = ${rj.secondsPerFrame} s/frame`, '');
  L_.push('== flash check (relative luminance, whole frame and each quarter; a flash = two opposing changes of >= 0.1 with the darker side < 0.8)');
  L_.push(`max frame-to-frame change of mean luminance: ${fl.maxFrameToFrameLuminanceChange} at ${fl.at} s`);
  fl.regions.forEach((r) => L_.push(`  ${r.region.padEnd(12)} transitions ${String(r.transitions).padStart(3)}  worst flashes in any 1 s: ${r.worstFlashesPerSecond} (at ${r.at} s)`));
  L_.push('verdict: ' + fl.verdict + ' (limit 3 per second)', '');
  L_.push('== loudness of the delivered AAC track (ffmpeg ebur128, independent of the builder\'s own meter)', summ.trim(), '');
  L_.push('== soundtrack builder report (audio/audio-report.txt)', ar);
  fs.writeFileSync(path.join(OUT, 'verification.txt'), L_.join('\n') + '\n');
  console.log('verification written');
}
function spawnSyncStderr(args) { const r = require('child_process').spawnSync('ffmpeg', args, { encoding: 'utf8', maxBuffer: 1 << 26 }); return r.stderr || ''; }

(async () => {
  const steps = process.argv.slice(2);
  const all = { mux, poster, sheet, stills, strips, flash, srt, verify };
  const order = steps.length ? steps : ['mux', 'srt', 'sheet', 'stills', 'strips', 'flash', 'poster', 'verify'];
  for (const s of order) await all[s]();
})().catch((e) => { console.error(e); process.exit(1); });
