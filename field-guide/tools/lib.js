// Shared plumbing for the tools: Playwright pages running index.html?export, ffmpeg helpers.
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(ROOT, '..', 'field-guide-video');
const TL = require(path.join(ROOT, 'js', 'timeline.js'));

async function openPage(browser, opts) {
  opts = opts || {};
  const scale = opts.scale || 1, W = Math.round(1080 * scale), H = Math.round(1350 * scale);
  const page = await browser.newPage({ viewport: { width: Math.min(W, 1600), height: Math.min(H, 1600) } });
  page.setDefaultTimeout(0);
  page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && !/GPU stall|GL Driver|ReadPixels/.test(m.text()))) console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto('file://' + path.join(ROOT, 'index.html') + '?export&ss=' + (opts.ss || 2) + '&scale=' + scale, { timeout: 0 });
  await page.waitForFunction(() => window.__piece && window.__piece.ready, null, { timeout: 0, polling: 200 });
  return {
    page, W, H,
    async frame(t) {
      const b64 = await page.evaluate((tt) => { window.__piece.renderAt(tt); return window.__piece.grab(); }, t);
      return Buffer.from(b64, 'base64');
    },
    async info() { return page.evaluate(() => window.__piece.info); },
  };
}
function ff(args, stdio) { return spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: stdio || ['pipe', 'inherit', 'inherit'] }); }
function png(buf, file, w, h) {
  return new Promise((res, rej) => {
    const p = ff(['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', w + 'x' + h, '-i', '-', '-frames:v', '1', file]);
    p.on('close', (c) => (c === 0 ? res() : rej(new Error('png ' + c)))); p.stdin.end(buf);
  });
}
// tile RGBA buffers (w x h each) into one image, each scaled to tw wide, with optional labels
async function tile(bufs, file, w, h, cols, tw, labels) {
  const rows = Math.ceil(bufs.length / cols);
  const th = Math.round(tw * h / w);
  let vf = 'scale=' + tw + ':' + th + ':flags=lanczos';
  if (labels) vf += ",drawtext=text='%{metadata\\:lbl}':x=6:y=6:fontsize=" + Math.max(12, Math.round(tw / 16)) + ':fontcolor=yellow:box=1:boxcolor=black@0.5';
  vf += ',tile=' + cols + 'x' + rows + ':padding=4:color=0x1a1426';
  // labels via a sendcmd-free path: burn per frame using a concat of drawtext is awkward; instead we pre-label in JS
  const p = ff(['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', w + 'x' + h, '-r', '30', '-i', '-', '-vf', vf.replace(/,drawtext=[^,]*boxcolor=black@0.5/, ''), '-frames:v', '1', file]);
  const done = new Promise((res, rej) => p.on('close', (c) => (c === 0 ? res() : rej(new Error('tile ' + c)))));
  for (const b of bufs) if (!p.stdin.write(b)) await new Promise((r) => p.stdin.once('drain', r));
  const blank = Buffer.alloc(w * h * 4); for (let i = bufs.length; i < cols * rows; i++) p.stdin.write(blank);
  p.stdin.end(); await done;
}
// stamp a small time label into the top-left of an RGBA buffer (5x7 digits, so no font is needed)
const DIG = { '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'], '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'], '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '001', '001', '001'], '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'], '.': ['000', '000', '000', '000', '010'], 'f': ['111', '100', '110', '100', '100'] };
function stamp(buf, w, txt, px) {
  px = px || 6; let x0 = 8;
  for (let yy = 0; yy < 7 * px + 8; yy++) for (let xx = 0; xx < (txt.length * 4 * px) + 10; xx++) { const o = ((yy) * w + xx) * 4; buf[o] = buf[o] * 0.3; buf[o + 1] = buf[o + 1] * 0.3; buf[o + 2] = buf[o + 2] * 0.3; }
  for (const ch of txt) {
    const g = DIG[ch]; if (!g) { x0 += 4 * px; continue; }
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r][c] === '1') {
      for (let yy = 0; yy < px; yy++) for (let xx = 0; xx < px; xx++) { const o = ((4 + r * px + yy) * w + (x0 + c * px + xx)) * 4; buf[o] = 255; buf[o + 1] = 230; buf[o + 2] = 60; }
    }
    x0 += 4 * px;
  }
}
// render a list of times across N pages in parallel; returns buffers in order
async function renderTimes(times, opts) {
  opts = opts || {};
  const nw = opts.workers || 3;
  const browser = await chromium.launch();
  const pages = [];
  for (let i = 0; i < Math.min(nw, times.length); i++) pages.push(await openPage(browser, opts));
  const out = new Array(times.length);
  let next = 0;
  const t0 = Date.now();
  await Promise.all(pages.map(async (pg) => {
    while (next < times.length) {
      const i = next++;
      out[i] = await pg.frame(times[i]);
      if (opts.label) stamp(out[i], pg.W, times[i].toFixed(2), Math.max(4, Math.round(pg.W / 140)));
    }
  }));
  const info = await pages[0].info();
  await browser.close();
  if (opts.verbose) console.log('rendered', times.length, 'frames in', ((Date.now() - t0) / 1000).toFixed(1), 's');
  return { bufs: out, W: pages[0].W, H: pages[0].H, info };
}
function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }
module.exports = { ROOT, OUT, TL, openPage, ff, png, tile, stamp, renderTimes, ensureDir, chromium };
