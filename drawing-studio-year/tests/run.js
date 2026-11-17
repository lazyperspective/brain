// node tests/run.js            (about a minute)
// The promises the film makes, checked: the year closes on itself, the model stays in bounds,
// a frame is a pure function of its number, both sheets live through the same year.
'use strict';
const assert = require('assert'), crypto = require('crypto');
const { buildClock, F, FPS, ND, CAL } = require('../clock.js');
const { createFilm } = require('../film.js');
let n = 0; const ok = (name, fn) => { const t = Date.now(); fn(); n++; console.log('  ok  ' + name + '  (' + (Date.now() - t) + ' ms)'); };
const K = buildClock(), C = K.C;

console.log('the clock');
ok('time only runs forward, and the last frame hands over to the first', () => {
  for (let f = 1; f < F; f++) assert(C.d[f] > C.d[f - 1], 'd not increasing at ' + f);
  const step = C.d[1] - C.d[0], wrap = C.d[0] + ND - C.d[F - 1];
  assert(wrap > 0 && wrap < step * 3, 'loop seam in time: ' + wrap + ' vs ' + step);
  assert.strictEqual(F, FPS * K.DUR);
});
ok('twelve days: the sun rises and sets twelve times, and days are longest in June', () => {
  let rises = 0; for (let f = 0; f < F; f++) if (C.alt[(f - 1 + F) % F] < 0 && C.alt[f] >= 0) rises++;
  assert.strictEqual(rises, ND);
  let mx = 0, at = 0; for (let f = 0; f < F; f++) if (C.dayLen[f] > mx) { mx = C.dayLen[f]; at = C.cal[f]; }
  assert(mx > 14.5 && at > 5 && at < 6.2, 'solstice at cal ' + at);
});
ok('time is stretched at dawn and dusk and squeezed in the small hours, but smoothly: no lurch, no jump cut', () => {
  let mn = 1e9, mx = 0; for (let f = 0; f < F; f++) { mn = Math.min(mn, C.dSpeed[f]); mx = Math.max(mx, C.dSpeed[f]); }
  assert(mx / mn < 20, 'speed ratio ' + mx / mn);
  for (let f = 0; f < F; f++) { const a = C.dSpeed[f], b = C.dSpeed[(f + 1) % F]; assert(Math.abs(a - b) / a < 0.2, 'time lurches at ' + f); }
});

console.log('the ecosystem');
ok('every state stays in its bounds all year', () => {
  const lim = { ovc: [0, 1], rain: [0, 1], snowf: [0, 1], fog: [0, 1], M: [0, 1], wet: [0, 1], puddle: [0, 1.25], snow: [0, 3], snowB: [0, 1], SP: [0, 1.4], AP: [0, 1.5], G: [0, 1], Hg: [0, 1], dry: [0, 1], sen: [0, 1], frost: [0, 1], dew: [0, 1], glow: [0, 1.2], T: [-16, 34] };
  for (const k in lim) for (let f = 0; f < F; f++) { const v = C[k][f]; assert(Number.isFinite(v) && v >= lim[k][0] - 1e-6 && v <= lim[k][1] + 1e-6, k + ' out of bounds at ' + f + ': ' + v); }
});
ok('the year closes: every slow state at the last frame is where the first frame picks it up', () => {
  for (const k of ['M', 'wet', 'puddle', 'snow', 'snowB', 'SP', 'G', 'Hg', 'dry', 'sen', 'frost', 'dew', 'warm', 'glow', 'T', 'wind', 'ovc', 'fog']) {
    let mxStep = 0; for (let f = 1; f < F; f++) mxStep = Math.max(mxStep, Math.abs(C[k][f] - C[k][f - 1]));
    const seam = Math.abs(C[k][0] - C[k][F - 1]);
    assert(seam <= mxStep * 1.5 + 1e-4, k + ' jumps at the loop: ' + seam + ' (largest ordinary step ' + mxStep + ')');
  }
});
ok('causes come before effects: rain wets, warmth greens, short days turn the leaves, snow needs frost', () => {
  for (let f = 1; f < F; f++) {
    if (C.snow[f] > C.snow[f - 1] + 1e-6) assert(C.snowf[f] > 0 && C.T[f] < 2.3, 'snow deepened without cold snowfall at ' + f);
    if (C.wet[f] > C.wet[f - 1] + 1e-4) assert(C.rain[f] > 0 || C.melt[f] > 0, 'ground got wetter with nothing to wet it at ' + f);
  }
  const at = cal => Math.round(K.tauAtCal(cal) * FPS) % F;
  assert(C.G[at(4.5)] > C.G[at(1)] + 0.5, 'grass did not green through spring');
  assert(C.SP[at(4.5)] > 0.9 && C.SP[at(1.2)] < 0.12, 'leaf-out out of season');
  assert(C.AP[at(9)] < 0.05 && C.AP[at(12)] > 0.8, 'autumn out of season');
  assert(C.snow[at(8)] === 0 && C.snow[at(15.5)] > 0.8 && C.snow[at(3)] === 0, 'snow out of season');
  let rainSum = 0, greenAfter = 0; for (let f = 0; f < F; f++) rainSum += C.rain[f]; assert(rainSum > 0);
});
ok('the wind that bends the grass is the wind that moves everything else (one integral, closed over the year)', () => {
  let s = 0; for (let f = 0; f < F; f++) s += C.wind[f] / FPS;
  assert(Math.abs(s - C.Wint[F]) < 1e-6);
});

console.log('the film');
const film = createFilm('v', 0.2, {});
const hash = () => crypto.createHash('md5').update(film.E.toRGB()).digest('hex');
ok('a frame is a pure function of its number (drawn twice, and after other frames, it is the same picture)', () => {
  const frames = [0, 777, 1500, 2300];
  const a = frames.map(f => { film.renderFrame(f); return hash(); });
  film.renderFrame(1234); film.renderFrame(42);
  const b = frames.slice().reverse().map(f => { film.renderFrame(f); return hash(); }).reverse();
  assert.deepStrictEqual(a, b);
  film.renderFrame(0); const h0 = hash(); film.renderFrame(F); assert.strictEqual(hash(), h0, 'frame F is not frame 0');
});
ok('the loop: the last frame differs from the first no more than neighbours do', () => {
  const grab = f => { film.renderFrame(f); return Buffer.from(film.E.toRGB()); };
  const diff = (p, q) => { let s = 0; for (let i = 0; i < p.length; i++) s += Math.abs(p[i] - q[i]); return s / p.length; };
  const a = grab(F - 2), b = grab(F - 1), c = grab(0), d = grab(1);
  const seam = diff(b, c), near = Math.max(diff(a, b), diff(c, d));
  assert(seam < near * 1.6 + 0.4, 'seam ' + seam.toFixed(3) + ' vs neighbours ' + near.toFixed(3));
});
ok('nothing pops: over two stretches of the year no frame differs wildly from the one before', () => {
  for (const start of [980, 1680]) {
    let prev = null; const ds = [];
    for (let f = start; f < start + 24; f++) { film.renderFrame(f); const cur = Buffer.from(film.E.toRGB()); if (prev) { let s = 0; for (let i = 0; i < cur.length; i++) s += Math.abs(cur[i] - prev[i]); ds.push(s / cur.length); } prev = cur; }
    const sorted = ds.slice().sort((x, y) => x - y), med = sorted[ds.length >> 1];
    for (const v of ds) assert(v < med * 3 + 2, 'pop: ' + v.toFixed(2) + ' against a median of ' + med.toFixed(2));
  }
});
ok('both sheets live through the same year (same clock, same tree, same leaves\' calendars)', () => {
  const p = createFilm('p', 0.2, {});
  assert.strictEqual(p.F, film.F);
  for (const k of ['snow', 'SP', 'AP', 'D', 'wind', 'alt']) for (const f of [0, 500, 1500, 2500]) assert.strictEqual(p.K.C[k][f], film.K.C[k][f]);
  // the same twig opens and drops its leaves on the same frame in both formats
  const tv = film.mods.tree.TUFT, tp = p.mods.tree.TUFT;
  for (let i = 0; i < 200; i++) { assert.strictEqual(tv[i].x, tp[i].x); if (!tv[i].dead && !tp[i].dead) { assert.strictEqual(tv[i].bud, tp[i].bud); assert.strictEqual(tv[i].turn, tp[i].turn); } }
  p.renderFrame(900); assert(p.E.W / p.E.H > 0.79 && p.E.W / p.E.H < 0.81); assert(Math.abs(film.E.W / film.E.H - 9 / 16) < 0.01);
});
console.log(n + ' checks passed');
