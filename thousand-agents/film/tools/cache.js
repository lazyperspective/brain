// Renders one section over its whole film span into a near-lossless cache video: film/cache/<slot>.mkv
//   node tools/cache.js <slot> [workers] [ss]
// Workers are separate processes (each its own browser), each rendering a contiguous chunk; the parts are joined losslessly.
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const L = require('./lib');

async function worker(slot, f0, f1, file, ss) {
  const sec = await L.openSection(slot, { ss });
  const enc = L.cacheEncoder(file);
  const t0 = Date.now();
  for (let f = f0; f <= f1; f++) {
    const buf = await sec.frame(f / 30);
    await enc.write(buf);
    if ((f - f0) % 10 === 0) console.log(slot, 'frame', f, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  await enc.end();
  await L.closeBrowser();
  fs.writeFileSync(file + '.time', String((Date.now() - t0) / 1000 / (f1 - f0 + 1)));
}

async function main() {
  const a = process.argv.slice(2);
  if (a[0] === '--worker') { await worker(a[1], +a[2], +a[3], a[4], a[5] === 'null' ? null : a[5]); return; }
  const slot = a[0], nw = +(a[1] || 1), ss = a[2] || null;
  L.ensureDir(L.CACHE_DIR);
  const [f0, f1] = L.F.frameSpan(slot), n = f1 - f0 + 1;
  const parts = [];
  const t0 = Date.now();
  await Promise.all(Array.from({ length: nw }, (_, k) => {
    const a0 = f0 + Math.floor(n * k / nw), a1 = f0 + Math.floor(n * (k + 1) / nw) - 1;
    const file = path.join(L.CACHE_DIR, slot + '.part' + k + '.mkv'); parts.push(file);
    return new Promise((res, rej) => {
      const p = spawn(process.execPath, [__filename, '--worker', slot, String(a0), String(a1), file, String(ss)], { stdio: 'inherit' });
      p.on('close', (c) => (c === 0 ? res() : rej(new Error('worker ' + k + ' exit ' + c))));
    });
  }));
  const out = path.join(L.CACHE_DIR, slot + '.mkv');
  if (parts.length === 1) fs.renameSync(parts[0], out);
  else {
    const list = path.join(L.CACHE_DIR, slot + '.list.txt');
    fs.writeFileSync(list, parts.map((p) => "file '" + p + "'").join('\n'));
    await new Promise((res, rej) => { const p = L.ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out]); p.on('close', (c) => (c === 0 ? res() : rej(new Error('concat ' + c)))); });
    for (const p of parts) fs.unlinkSync(p);
    fs.unlinkSync(list);
  }
  let per = 0; for (const p of parts) { if (fs.existsSync(p + '.time')) { per += +fs.readFileSync(p + '.time', 'utf8'); fs.unlinkSync(p + '.time'); } }
  const wall = (Date.now() - t0) / 1000;
  const logf = path.join(L.CACHE_DIR, 'times.json');
  const log = fs.existsSync(logf) ? JSON.parse(fs.readFileSync(logf, 'utf8')) : {};
  log[slot] = { frames: n, workers: nw, ss, wallSeconds: Math.round(wall), secondsPerFramePerWorker: +(per / parts.length).toFixed(2) };
  fs.writeFileSync(logf, JSON.stringify(log, null, 1));
  console.log('cached', slot, n, 'frames in', wall.toFixed(0) + 's');
}
main().catch((e) => { console.error(e); process.exit(1); });
