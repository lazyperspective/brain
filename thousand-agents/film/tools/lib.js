// Shared plumbing for the film's tools: Playwright section pages, ffmpeg encoders and decoders, raw frame helpers.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const FILM_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.resolve(FILM_DIR, '..', '..', 'thousand-agents-video', 'film');
const CACHE_DIR = path.join(FILM_DIR, 'cache');
const F = require(path.join(FILM_DIR, 'shared.js'));
const W = 1920, H = 1080, FB = W * H * 4;

let browserP = null;
async function browser() { if (!browserP) browserP = chromium.launch(); return browserP; }
async function closeBrowser() { if (browserP) { const b = await browserP; browserP = null; await b.close(); } }

async function openSection(slot, opts) {
  opts = opts || {};
  const b = await browser();
  const page = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(0);
  page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && !/GPU stall|GL Driver/.test(m.text()))) console.error('[' + slot + ']', m.text()); });
  page.on('pageerror', (e) => console.error('[' + slot + ' pageerror]', e.message));
  let url = 'file://' + path.join(FILM_DIR, 'section.html') + '?s=' + slot + '&export';
  if (opts.ss) url += '&ss=' + opts.ss;
  if (opts.w) url += '&w=' + opts.w;
  await page.goto(url, { timeout: 0 });
  await page.waitForFunction(() => window.__piece && window.__piece.isReady(), null, { timeout: 0, polling: 200 });
  return {
    page,
    async frame(T) {
      const b64 = await page.evaluate((t) => { window.__piece.renderAt(t); return window.__piece.grab(); }, T);
      return Buffer.from(b64, 'base64');
    },
    async close() { await page.close(); },
  };
}

function ff(args, stdio) {
  return spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: stdio || ['pipe', 'inherit', 'inherit'] });
}
const RAW_IN = ['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', W + 'x' + H, '-r', '30', '-i', '-'];

// a cache video: near-lossless RGB H.264
function cacheEncoder(file) {
  const p = ff([...RAW_IN, '-an', '-c:v', 'libx264rgb', '-preset', 'faster', '-crf', '7', file]);
  return writer(p);
}
function finalEncoder(file) {
  const p = ff([...RAW_IN, '-an', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '14', '-preset', 'slow',
    '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', file]);
  return writer(p);
}
function writer(p) {
  const done = new Promise((res, rej) => p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
  return {
    async write(buf) { if (!p.stdin.write(buf)) await new Promise((r) => p.stdin.once('drain', r)); },
    async end() { p.stdin.end(); await done; },
  };
}
// sequential reader of raw RGBA frames from a video, starting at frame index `start` (of that video)
function decoder(file, start) {
  const args = [];
  if (start > 0) args.push('-ss', (start / 30).toFixed(5));
  args.push('-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-');
  const p = ff(args, ['ignore', 'pipe', 'inherit']);
  let chunks = [], have = 0, waiting = null, ended = false;
  p.stdout.on('data', (d) => { chunks.push(d); have += d.length; if (have > FB * 3) p.stdout.pause(); if (waiting) { const w = waiting; waiting = null; w(); } });
  p.stdout.on('end', () => { ended = true; if (waiting) { const w = waiting; waiting = null; w(); } });
  return {
    async next() {
      while (have < FB) { if (ended) return null; p.stdout.resume(); await new Promise((r) => { waiting = r; }); }
      const all = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);
      const out = Buffer.from(all.subarray(0, FB));
      const rest = all.subarray(FB); chunks = rest.length ? [rest] : []; have = rest.length;
      if (have < FB * 3) p.stdout.resume();
      return out;
    },
    close() { try { p.kill('SIGKILL'); } catch (e) { /* gone */ } },
  };
}
// write a single RGBA buffer (or a list, tiled) as PNG
function png(buf, file, w, h) {
  return new Promise((res, rej) => {
    const p = ff(['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', (w || W) + 'x' + (h || H), '-i', '-', '-frames:v', '1', file]);
    p.on('close', (c) => (c === 0 ? res() : rej(new Error('png ' + c)))); p.stdin.end(buf);
  });
}
// tile many RGBA 1920x1080 buffers into one PNG (cols x rows), each scaled to tw wide
async function tile(bufs, file, cols, tw, label) {
  const rows = Math.ceil(bufs.length / cols);
  const p = ff(['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', W + 'x' + H, '-r', '30', '-i', '-',
    '-vf', 'scale=' + tw + ':-1:flags=lanczos,tile=' + cols + 'x' + rows + ':padding=4:color=0x22222e', '-frames:v', '1', file]);
  const done = new Promise((res, rej) => p.on('close', (c) => (c === 0 ? res() : rej(new Error('tile ' + c)))));
  for (const b of bufs) if (!p.stdin.write(b)) await new Promise((r) => p.stdin.once('drain', r));
  const blank = Buffer.alloc(FB); for (let i = bufs.length; i < cols * rows; i++) p.stdin.write(blank);
  p.stdin.end(); await done;
}

function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }

module.exports = { F, W, H, FB, FILM_DIR, OUT_DIR, CACHE_DIR, browser, closeBrowser, openSection, cacheEncoder, finalEncoder, decoder, png, tile, ensureDir, ff };
