// node tools/sheet.js out.png "t1,t2,..."|t0:t1:step [cols] [tileW] [ss] [scale] [workers]
//   renders the given film times (labelled) and tiles them into one image
const L = require('./lib');
(async () => {
  const [out, spec, colsS, twS, ssS, scS, wS] = process.argv.slice(2);
  let times;
  if (spec.includes(':')) { const [a, b, s] = spec.split(':').map(Number); times = []; for (let t = a; t <= b + 1e-9; t += s) times.push(Math.round(t * 30) / 30); }
  else times = spec.split(',').map(Number);
  const r = await L.renderTimes(times, { ss: +(ssS || 1), scale: +(scS || 0.5), workers: +(wS || 3), label: true, verbose: true });
  await L.tile(r.bufs, out, r.W, r.H, +(colsS || 6), +(twS || 270));
  console.log(out, JSON.stringify(r.info));
})().catch((e) => { console.error(e); process.exit(1); });
