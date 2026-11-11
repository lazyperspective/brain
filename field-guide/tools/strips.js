// node tools/strips.js outdir [ss] [scale] [only]: every 2nd frame across each beat hand-over, tiled (time-labelled)
const L = require('./lib');
const path = require('path');
const HO = [
  ['01-hi-to-effort', 2.6, 3.6], ['02-cloud-flythrough', 5.7, 7.3], ['03-bridge-to-clearing', 9.4, 11.2], ['04-sprint-to-village', 13.2, 14.6],
  ['05-village-to-mine', 17.6, 19.0], ['06-crane-up-the-cliff', 22.1, 23.7], ['07-clones-to-notes', 25.8, 27.4], ['08-notes-to-report', 30.4, 31.8],
  ['09-crane-to-reveal', 34.2, 38.6]];
(async () => {
  const [out, ssS, scS, only] = process.argv.slice(2);
  L.ensureDir(out);
  for (const [name, a, b] of HO) {
    if (only && !name.startsWith(only)) continue;
    const times = []; for (let f = Math.round(a * 30); f <= Math.round(b * 30); f += 2) times.push(f / 30);
    const r = await L.renderTimes(times, { ss: +(ssS || 1), scale: +(scS || 0.4), workers: 3, label: true });
    await L.tile(r.bufs, path.join(out, name + '.png'), r.W, r.H, 8, 216);
    console.log(name, times.length, 'frames');
  }
})();
