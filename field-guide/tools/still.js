// node tools/still.js out_prefix t1,t2 [ss] [scale] : full-quality stills (PNG)
const L = require('./lib');
(async () => {
  const [pre, ts, ssS, scS] = process.argv.slice(2);
  const times = ts.split(',').map(Number);
  const r = await L.renderTimes(times, { ss: +(ssS || 2), scale: +(scS || 1), workers: Math.min(3, times.length), verbose: true });
  for (let i = 0; i < times.length; i++) await L.png(r.bufs[i], pre + times[i].toFixed(2).padStart(5, '0') + '.png', r.W, r.H);
})();
