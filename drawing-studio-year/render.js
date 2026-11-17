/* A YEAR, STILL WARM — the camera left running.
 *
 *   node render.js --fmt v            # the 9:16 film  -> out/a-year-still-warm-9x16.mp4
 *   node render.js --fmt p            # the 4:5 film   -> out/a-year-still-warm-4x5.mp4
 *   options: --workers 4  --chunk 96  --crf 16  --preset slow  --scale 1  --from 0 --to 2880  --tag name
 *
 * The film is drawn in chunks of frames; each chunk is encoded on its own and only
 * renamed into place when it is complete, so the job can be stopped and started
 * again and loses at most the chunks that were in flight. Any frame can be drawn
 * on its own (film.js), so the chunks can be drawn in any order on any core.
 * The chunks are near-lossless working copies; when every one exists the film is
 * encoded once, in a single pass, with its few keyframes placed at sunrises.
 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { spawn, fork, spawnSync } = require('child_process');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };

if (process.env.YEAR_WORKER) {
  // ------------------------------------------------------------ a worker: draws chunks it is handed
  const { createFilm } = require('./film.js');
  const o = JSON.parse(process.env.YEAR_WORKER);
  const film = createFilm(o.fmt, o.scale, { log: () => {} });
  process.on('message', job => {
    const { start, n, file } = job, tmp = file + '.part';
    const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', film.W + 'x' + film.H, '-r', String(film.FPS), '-i', '-',
      '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '10', '-g', String(n), '-threads', '2',          // a near-lossless working copy of the chunk
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-f', 'mp4', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
    let i = 0; const buf = Buffer.alloc(film.W * film.H * 3);
    const next = () => {
      if (i >= n) { ff.stdin.end(); return; }
      film.renderFrame((start + i) % film.F); film.E.toRGB(buf); i++;
      process.send({ type: 'frame' });
      if (ff.stdin.write(buf)) setImmediate(next); else ff.stdin.once('drain', next);
    };
    ff.on('close', code => { if (code === 0) { fs.renameSync(tmp, file); process.send({ type: 'done', start }); } else { process.send({ type: 'fail', start, code }); } });
    next();
  });
  process.send({ type: 'ready' });
} else {
  // ------------------------------------------------------------ the master: hands out chunks, joins them
  const fmt = arg('fmt', 'v'), scale = +arg('scale', 1), workers = +arg('workers', 4), CH = +arg('chunk', 96), crf = +arg('crf', 16), preset = arg('preset', 'slow');
  const { F, FPS } = require('./clock.js'), { FORMATS } = require('./world.js');
  const from = +arg('from', 0), to = +arg('to', F);
  // chunks are only reused by the very same film: a change to any source file starts a new set
  const srcs = ['clock.js', 'engine.js', 'world.js', 'look.js', 'patient.js', 'tree.js', 'meadow.js', 'sky.js', 'clouds.js', 'weather.js', 'life.js', 'hand.js', 'film.js'];
  const h = crypto.createHash('md5'); for (const s of srcs) h.update(fs.readFileSync(path.join(__dirname, s))); h.update(String(scale));
  const tag = arg('tag', h.digest('hex').slice(0, 10));
  const dir = path.join(__dirname, 'chunks', `${fmt}-${tag}`); fs.mkdirSync(dir, { recursive: true });
  const outDir = path.join(__dirname, 'out'); fs.mkdirSync(outDir, { recursive: true });
  const name = arg('out', path.join(outDir, `a-year-still-warm-${FORMATS[fmt].name}${scale !== 1 ? '-x' + scale : ''}${from !== 0 || to !== F ? `-${from}-${to}` : ''}.mp4`));
  const chunks = []; for (let s = from; s < to; s += CH) chunks.push({ start: s, n: Math.min(CH, to - s), file: path.join(dir, `c${String(s).padStart(5, '0')}_${Math.min(CH, to - s)}.mp4`) });
  const todo = chunks.filter(c => !fs.existsSync(c.file));
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.part')) fs.unlinkSync(path.join(dir, f));
  console.log(`${FORMATS[fmt].name}: ${chunks.length} chunks of ${CH} frames in ${dir}; ${chunks.length - todo.length} already drawn, ${todo.length} to draw`);
  const t0 = Date.now(); let framesDone = 0, alive = 0, failed = false; const total = todo.reduce((a, c) => a + c.n, 0);
  const finish = () => {
    if (failed) { console.error('some chunks failed; run again to retry'); process.exit(1); }
    const list = path.join(dir, 'list.txt'); fs.writeFileSync(list, chunks.map(c => `file '${c.file}'`).join('\n') + '\n');
    // One encode for the whole film. On still, grainy paper every keyframe re-settles the grain for a
    // frame, so keyframes are few and are put where the picture is changing anyway: at sunrises.
    const { buildClock } = require('./clock.js'), C = buildClock().C, keys = [];
    for (let f = from; f < to; f++) { const p = (f - 1 + F) % F; if ((f === from) || (C.alt[p] < 0.3 && C.alt[f] >= 0.3 && (f - from) - (keys.length ? keys[keys.length - 1] : -1e9) > 12 * FPS)) keys.push(f - from); }
    const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list,
      '-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-tune', 'film', '-bf', '2', '-threads', '4',
      '-x264-params', `keyint=${to - from + 1}:min-keyint=${to - from + 1}:scenecut=0`, '-force_key_frames', keys.map(f => (f / FPS).toFixed(4)).join(','),
      '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', name], { stdio: 'inherit' });
    if (r.status !== 0) process.exit(1);
    console.log(`joined -> ${name} (${(fs.statSync(name).size / 1e6).toFixed(1)} MB, keyframes at ${keys.map(f => (f / FPS).toFixed(1) + 's').join(' ')}) in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  };
  if (!todo.length) finish();
  else {
    let last = 0;
    for (let w = 0; w < Math.min(workers, todo.length); w++) {
      const ch = fork(__filename, [], { env: Object.assign({}, process.env, { YEAR_WORKER: JSON.stringify({ fmt, scale, crf, preset }) }) }); alive++;
      const give = () => { const job = todo.shift(); if (job) ch.send(job); else { ch.kill(); } };
      ch.on('message', m => {
        if (m.type === 'ready') give();
        else if (m.type === 'frame') { framesDone++; const now = Date.now(); if (now - last > 30000) { last = now; const el = (now - t0) / 1000; console.log(`  ${framesDone}/${total} frames, ${(el / framesDone * 1).toFixed(2)} s/frame overall, about ${((total - framesDone) * el / framesDone / 60).toFixed(1)} min left`); } }
        else if (m.type === 'done') give();
        else if (m.type === 'fail') { failed = true; console.error('chunk failed', m.start); give(); }
      });
      ch.on('exit', () => { if (--alive === 0) finish(); });
    }
  }
}
