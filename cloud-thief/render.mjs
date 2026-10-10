// Headless frame renderer: drives index.html in Chromium (SwiftShader WebGL2) and pipes raw frames to ffmpeg.
// Usage:
//   node render.mjs --stills 1.5,4.2,10 [--w 1920 --h 1080] [--out stills]
//   node render.mjs --from 0 --to 719 [--out frames]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? a.push([v.slice(2), arr[i + 1]?.startsWith('--') || arr[i + 1] === undefined ? '1' : arr[i + 1]]) : 0, a), []));
const W = +(args.w || 1920), H = +(args.h || 1080);
const root = path.dirname(new URL(import.meta.url).pathname);

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--disable-renderer-backgrounding'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text().slice(0, 400)); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
const t0 = Date.now();
await page.goto(`http://localhost:${port}/index.html?w=${W}&h=${H}${args.q ? '&' + args.q : ''}`);
await page.waitForFunction('window.__ready === true', null, { timeout: 600000 });
console.log(`world built in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

function ffmpegPng(outPattern, startNumber) {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', '24', '-i', '-', '-vf', 'vflip', '-start_number', String(startNumber), outPattern], { stdio: ['pipe', 'inherit', 'inherit'] });
  return ff;
}
async function grab() { const b64 = await page.evaluate(() => window.grabFrame()); return Buffer.from(b64, 'base64'); }

if (args.stills) {
  const out = args.out || 'stills'; fs.mkdirSync(path.join(root, out), { recursive: true });
  for (const ts of args.stills.split(',')) {
    const t = +ts; const s = Date.now();
    await page.evaluate((t) => window.renderTime(t), t);
    const buf = await grab();
    const name = path.join(root, out, `${args.prefix || 'still'}_${t.toFixed(2).padStart(5, '0')}.png`);
    await new Promise(res => { const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', '-', '-vf', 'vflip', '-frames:v', '1', name]); ff.on('close', res); ff.stdin.end(buf); });
    console.log(`t=${t} -> ${name} (${((Date.now() - s) / 1000).toFixed(2)}s)`);
  }
} else {
  const from = +(args.from || 0), to = +(args.to || 719);
  const out = args.out || 'frames'; fs.mkdirSync(path.join(root, out), { recursive: true });
  const ff = ffmpegPng(path.join(root, out, 'f%04d.png'), from);
  let last = Date.now();
  for (let f = from; f <= to; f++) {
    await page.evaluate((f) => window.renderFrame(f), f);
    const buf = await grab();
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 12 === 0) { const now = Date.now(); console.log(`frame ${f} (${((now - last) / 1000 / (f === from ? 1 : 12)).toFixed(2)}s/f)`); last = now; }
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  console.log(`done ${from}-${to} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await browser.close(); server.close();
