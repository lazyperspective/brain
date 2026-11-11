// Measures every transition from the section caches (raw, before grading): mean luminance and mean colour of the outgoing
// and incoming styles over the overlap, and the hero's box in each at the transition's midpoint.
//   node tools/measure.js            -> prints a table, writes film/measure.json
//   node tools/measure.js --grade    -> also solves per-section gains so both sides of every cut match, writes film/grade.json
const path = require('path');
const fs = require('fs');
const L = require('./lib');
const { heroBox } = require('./peek');
const F = L.F;

const lin = new Float32Array(256); for (let v = 0; v < 256; v++) { const c = v / 255; lin[v] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function stats(buf) {
  // mean luminance and colour, plus the background colour: the mean of the darker half of the frame
  const n0 = Math.ceil(L.H / 3) * Math.ceil(L.W / 3), ls = new Float32Array(n0), cs = new Uint8Array(n0 * 3);
  let sl = 0, sr = 0, sg = 0, sb = 0, n = 0;
  for (let y = 0; y < L.H; y += 3) for (let x = 0; x < L.W; x += 3) {
    const i = (y * L.W + x) * 4, r = buf[i], g = buf[i + 1], b = buf[i + 2];
    const l = 0.2126 * lin[r] + 0.7152 * lin[g] + 0.0722 * lin[b];
    ls[n] = l; cs[n * 3] = r; cs[n * 3 + 1] = g; cs[n * 3 + 2] = b; n++;
    sl += l; sr += r; sg += g; sb += b;
  }
  const med = Float32Array.from(ls.subarray(0, n)).sort()[n >> 1];
  let br = 0, bg = 0, bb = 0, bn = 0;
  for (let k = 0; k < n; k++) if (ls[k] <= med) { br += cs[k * 3]; bg += cs[k * 3 + 1]; bb += cs[k * 3 + 2]; bn++; }
  return { lum: sl / n, rgb: [sr / n, sg / n, sb / n], bg: [br / bn, bg / bn, bb / bn] };
}
async function framesOf(slot, fs0, fs1, step) {
  const file = path.join(L.CACHE_DIR, slot + '.mkv'), f0 = F.frameSpan(slot)[0];
  const dec = L.decoder(file, fs0 - f0), out = new Map();
  for (let f = fs0; f <= fs1; f++) { const b = await dec.next(); if (!b) break; if ((f - fs0) % step === 0 || f === Math.round((fs0 + fs1) / 2)) out.set(f, b); }
  dec.close();
  return out;
}
async function main() {
  const res = [];
  for (let k = 0; k < F.X.length; k++) {
    const x = F.X[k], a = Math.round((x.t - F.XW / 2) * 30), b = Math.round((x.t + F.XW / 2) * 30) - 1, mid = Math.round(x.t * 30);
    const A = await framesOf(x.from, a, b, 3), B = await framesOf(x.to, a, b, 3);
    const sa = [], sb = [];
    for (const [f, buf] of A) if (B.has(f)) { sa.push(stats(buf)); sb.push(stats(B.get(f))); }
    const avg = (s) => ({ lum: s.reduce((q, v) => q + v.lum, 0) / s.length, rgb: [0, 1, 2].map((c) => s.reduce((q, v) => q + v.rgb[c], 0) / s.length), bg: [0, 1, 2].map((c) => s.reduce((q, v) => q + v.bg[c], 0) / s.length) });
    const r = { k: k + 1, t: x.t, from: x.from, to: x.to, out: avg(sa), in: avg(sb), heroOut: heroBox(A.get(mid) || [...A.values()][0]), heroIn: heroBox(B.get(mid) || [...B.values()][0]) };
    res.push(r);
    console.log('T' + (k + 1), x.from, '->', x.to, 'lum', r.out.lum.toFixed(4), r.in.lum.toFixed(4), 'rgb', r.out.rgb.map((v) => v.toFixed(1)).join('/'), r.in.rgb.map((v) => v.toFixed(1)).join('/'),
      '\n   hero out', JSON.stringify(r.heroOut), '\n   hero in ', JSON.stringify(r.heroIn));
  }
  fs.writeFileSync(path.join(L.FILM_DIR, 'measure.json'), JSON.stringify(res, null, 1));
  if (process.argv.includes('--grade')) {
    // one luminance gain per section (log space, pulled toward 1 so each style stays itself), then a shadow-only colour lift
    // per section and channel that matches the background colour across every cut; highlights (the hero's coral) are untouched
    const slots = F.SECTIONS.map((s) => s.slot), g = {}, lf = {};
    for (const s of slots) { g[s] = 0; lf[s] = [0, 0, 0]; }
    const lam = 0.25;
    for (let it = 0; it < 400; it++) for (const s of slots) {
      let num = 0, den = lam;
      for (const r of res) {
        if (r.from === s) { num += (Math.log(r.in.lum) + g[r.to]) - Math.log(r.out.lum); den += 1; }
        if (r.to === s) { num += (Math.log(r.out.lum) + g[r.from]) - Math.log(r.in.lum); den += 1; }
      }
      g[s] = Math.max(Math.log(0.8), Math.min(Math.log(1.2), num / den));
    }
    const G = (s) => Math.exp(g[s]) / 2.2 + 1 - 1 / 2.2;    // the lum gain, as an sRGB-value gain (roughly gamma-corrected)
    for (let it = 0; it < 400; it++) for (const s of slots) for (let c = 0; c < 3; c++) {
      let num = 0, den = 0.6;
      for (const r of res) {
        const a = r.out.bg[c] * G(r.from), b = r.in.bg[c] * G(r.to);
        if (r.from === s) { num += (b + lf[r.to][c] * (1 - b / 255)) - a; den += 1; }
        if (r.to === s) { num += (a + lf[r.from][c] * (1 - a / 255)) - b; den += 1; }
      }
      lf[s][c] = Math.max(-6, Math.min(5, num / den));
    }
    const out = {};
    for (const s of slots) { const k = +G(s).toFixed(3); out[s] = { gain: [k, k, k], lift: lf[s].map((v) => +v.toFixed(2)) }; }
    fs.writeFileSync(path.join(L.FILM_DIR, 'grade.json'), JSON.stringify(out, null, 1));
    console.log(JSON.stringify(out));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
