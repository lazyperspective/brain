// Render "Poplars at Noon" through its page (index.html?export, window.__piece) in the pre-installed Playwright
// Chromium (WebGL2 on SwiftShader), over file://.
//   node render.js stills <dir> 0,4.5,13 [half]   PNG frames: full master 2160x2700 (or 1080x1350 with "half")
//   node render.js video <master.mkv> [workers]   lossless RGB master, 1080x1350 30 fps, one loop; frames are rendered at
//                                                 2160x2700 and downscaled 2x in linear light on the GPU ([1 3 3 1] kernel)
//   node render.js encode <master.mkv> <out.mp4>  delivery: H.264 High yuv420p CRF 16, faststart, silent, seam zones
//   node render.js seam                           render-level seam check (exact frames, before video coding)
//   node render.js determinism                    the same t rendered twice (and after other frames) is identical
//   node render.js timing                         ms per frame
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PAGE = 'file://' + path.resolve(__dirname, '../index.html') + '?export';
const FPS = 30;

async function openPage(browser) {
  const page = await (await browser.newContext({ viewport: { width: 540, height: 675 }, deviceScaleFactor: 1 })).newPage();
  let err = null;
  page.on('pageerror', (e) => { console.error('[pageerror]', e.message); err = err || e; });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[console]', m.text()); });
  await page.goto(PAGE);
  const t0 = Date.now();
  while (!(await page.evaluate(() => !!(window.__piece && window.__piece.isReady())))) {
    if (err) throw new Error('page failed: ' + err.message);
    if (Date.now() - t0 > 600000) throw new Error('page not ready after 10 min');
    await new Promise((r) => setTimeout(r, 250));
  }
  return page;
}
const grab = async (page, t, half, scale, crop) => {
  const r = await page.evaluate(([t, half, scale, crop]) => window.__piece.renderAt(t, half, scale, crop), [t, !!half, scale || 1, crop || null]);
  return { w: r.w, h: r.h, px: Buffer.from(r.b64, 'base64'), ms: r.ms };
};
function writePng(file, r) {
  return new Promise((res, rej) => {
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${r.w}x${r.h}`, '-i', '-', '-frames:v', '1', '-pix_fmt', 'rgb24', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    ff.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res()));
    ff.stdin.end(r.px);
  });
}
// x264 zones (from ink-courtyard): frame 0 is the only keyframe; give it high fixed quality and ramp the last 40
// frames up to meet it, so the step from the last frame back to the first is an ordinary step
const ZONES = (n) => `zones=0,0,q=8/${n - 40},${n - 25},q=15/${n - 24},${n - 13},q=14/${n - 12},${n - 7},q=13/${n - 6},${n - 1},q=12`;
function encoder(out, nframes, w, h) {
  // the render writes a lossless RGB master (libx264rgb, qp 0, one GOP); `encode` makes the delivery file from it
  return spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264rgb', '-preset', 'ultrafast', '-qp', '0', '-pix_fmt', 'rgb24', '-r', String(FPS), '-an', '-frames:v', String(nframes), out], { stdio: ['pipe', 'inherit', 'inherit'] });
}
// delivery encode: H.264 High, yuv420p, CRF 16, one GOP (one keyframe, frame 0); x264 zones bring the last frames up
// to the keyframe's quality so the step from the last frame back to the first is an ordinary step
function deliver(master, out, extra) {
  const n = +require('child_process').execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', master]).toString().trim();
  const zones = process.env.ZONES || `zones=0,0,q=${process.env.Q0 || 8}/${n - 40},${n - 25},q=15/${n - 24},${n - 13},q=13/${n - 12},${n - 7},q=11/${n - 6},${n - 1},q=${process.env.QEND || 9}`;
  const args = ['-loglevel', 'error', '-y', '-i', master, '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-tune', 'grain', '-crf', String(process.env.CRF || 16),
    '-x264-params', `keyint=${n}:min-keyint=${n}:scenecut=0:${zones}${extra ? ':' + extra : ''}`,
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-r', String(FPS), '-movflags', '+faststart', '-an', out];
  require('child_process').execFileSync('ffmpeg', args, { stdio: 'inherit' });
  console.log('encoded', out, `(${n} frames, ${zones}${extra ? ', ' + extra : ''})`);
}
const stat = (a, b) => { let s = 0, n4 = 0; for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); s += d; if (d >= 4) n4++; } return [s / (a.length / 4), n4 / (a.length / 4)]; };

(async () => {
  const [mode, out, arg, arg2] = process.argv.slice(2);
  const browser = await chromium.launch();
  const t0 = Date.now();
  if (mode === 'stills') {
    const page = await openPage(browser);
    console.log('build', (await page.evaluate(() => window.__piece.buildMs)).toFixed(0), 'ms;', await page.evaluate(() => window.__piece.dabs), 'dabs', JSON.stringify(await page.evaluate(() => window.__piece.counts)));
    fs.mkdirSync(out, { recursive: true });
    for (const t of String(arg || '0').split(',').map(Number)) {
      const r = await grab(page, t, arg2 === 'half');
      const p = path.join(out, 'poplars-' + t.toFixed(2).padStart(5, '0') + '.png');
      await writePng(p, r);
      console.log(p, r.ms.toFixed(0) + ' ms');
    }
  } else if (mode === 'look') {
    // low-cost look: the whole picture at half scale (1080x1350) plus named 1:1 crops of the full-resolution render
    //   node render.js look <dir> <t> [name:x:y:w:h ...]
    const page = await openPage(browser);
    fs.mkdirSync(out, { recursive: true });
    const t = +(arg || 0), tag = t.toFixed(2).padStart(5, '0');
    await writePng(path.join(out, `whole-${tag}.png`), await grab(page, t, true));
    for (const spec of process.argv.slice(5)) {
      const [nm, x, y, w, h] = spec.split(':');
      await writePng(path.join(out, `${nm}-${tag}.png`), await grab(page, t, false, 1, [+x, +y, +w, +h]));
    }
    console.log('look', out, tag);
  } else if (mode === 'video' || mode === 'preview') {
    // preview: a quick look at the motion, drawn at half scale (no supersampling), 1080x1350
    const prev = mode === 'preview';
    const workers = Math.max(1, parseInt(arg || '2', 10));
    const pages = await Promise.all(Array.from({ length: workers }, () => openPage(browser)));
    const D = await pages[0].evaluate(() => window.__piece.duration);
    const N = Math.round(D * FPS);
    const ff = encoder(out, N, 1080, 1350);
    const done = new Promise((res) => ff.on('close', res));
    const ms = [];
    const next = new Array(workers).fill(null);
    const start = (w, f) => (next[w] = f < N ? (prev ? grab(pages[w], f / FPS, false, 0.5) : grab(pages[w], f / FPS, true)) : null);
    for (let w = 0; w < workers; w++) start(w, w);
    for (let f = 0; f < N; f++) {
      const w = f % workers;
      const r = await next[w];
      start(w, f + workers);
      ms.push(r.ms);
      if (!ff.stdin.write(r.px)) await new Promise((res) => ff.stdin.once('drain', res));
      if (f % 60 === 0) console.log(`frame ${f}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
    await done;
    const avg = ms.reduce((a, b) => a + b, 0) / ms.length;
    console.log(`${out}: ${N} frames, avg ${avg.toFixed(0)} ms/frame render, wall ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  } else if (mode === 'encode') {
    // node render.js encode <master.mkv> <out.mp4>   (env CRF, Q0, QEND, ZONES, X264EXTRA)
    deliver(out, arg, process.env.X264EXTRA);
  } else if (mode === 'seam') {
    const page = await openPage(browser);
    const D = await page.evaluate(() => window.__piece.duration);
    const N = Math.round(D * FPS), fr = {};
    for (const f of [N - 3, N - 2, N - 1, N, 0, 1, 2]) fr[f] = (await grab(page, f / FPS, true)).px;
    const ord = [[N - 3, N - 2], [N - 2, N - 1], [0, 1], [1, 2]].map(([a, b]) => stat(fr[a], fr[b])), seam = stat(fr[N - 1], fr[0]);
    const same = stat(fr[N], fr[0]);
    const mx = Math.max(...ord.map((o) => o[0]));
    const lines = [
      `render-level seam (1080x1350 frames): frame t=D vs t=0 mean |diff| ${same[0].toFixed(4)} (pixels differing by >= 4 levels: ${(same[1] * 100).toFixed(3)}%)`,
      `step ${N - 1} -> 0 (the loop seam): mean ${seam[0].toFixed(3)}; neighbouring steps ${ord.map((o) => o[0].toFixed(3)).join(' ')}`,
      seam[0] <= mx * 1.25 && same[0] === 0 ? 'PASS  the loop closes: frame D is frame 0 and the seam step is an ordinary step' : 'CHECK seam',
    ];
    console.log(lines.join('\n'));
  } else if (mode === 'determinism') {
    const page = await openPage(browser);
    const a = (await grab(page, 7.3, false)).px;
    await grab(page, 13.1, false); await grab(page, 2.0, true);
    const b = (await grab(page, 7.3, false)).px;
    const page2 = await openPage(browser);
    const c = (await grab(page2, 7.3, false)).px;
    const d1 = Buffer.compare(a, b) === 0, d2 = Buffer.compare(a, c) === 0;
    console.log(`determinism: t=7.3 rendered twice in one page (other frames between): ${d1 ? 'identical' : 'DIFFERENT'}; in a fresh page (scene rebuilt from the seed): ${d2 ? 'identical' : 'DIFFERENT'}`);
    console.log(d1 && d2 ? 'PASS' : 'FAIL');
  } else if (mode === 'timing') {
    const page = await openPage(browser);
    console.log('build', (await page.evaluate(() => window.__piece.buildMs)).toFixed(0), 'ms');
    for (const t of [0, 5, 10]) { const r = await grab(page, t, true); console.log('t', t, 'half', r.ms.toFixed(0), 'ms'); }
    const r = await grab(page, 0, false); console.log('full', r.ms.toFixed(0), 'ms');
  } else console.log('usage: node render.js stills <dir> <t,...> [half] | video <out.mp4> [workers] | seam | determinism | timing');
  await browser.close();
})();
