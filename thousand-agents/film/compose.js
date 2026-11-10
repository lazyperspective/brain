// The compositor: for every film frame it takes the active section's frame (and, during a transition, the incoming
// section's frame), grades each to the film's common exposure, blends them through the agent-wave mask, draws the wave of
// agents that carries the front, and draws the single HUD on top. Every frame is a pure function of T.
//   node compose.js video [out.mp4]                 the whole film (also writes stats.json for verification)
//   node compose.js review <round> [--live a,b]     contact sheet, transition strips, section stills, snapshot
//   node compose.js frames f1,f2,... <outdir>       chosen frames as PNGs
//   --live slot,slot   render those sections live (Playwright) instead of from their cache video
const path = require('path');
const fs = require('fs');
const L = require('./tools/lib');
const F = L.F, W = L.W, H = L.H;

/* ------------------------------------------------------------------ grading: per section gain/lift (from grade.json) */
const GRADE_FILE = path.join(L.FILM_DIR, 'grade.json');
const GRADE = fs.existsSync(GRADE_FILE) ? JSON.parse(fs.readFileSync(GRADE_FILE, 'utf8')) : {};
function gradeLUT(slot) {                       // a per-channel LUT: c' = c*gain + lift (sRGB), gently
  const g = GRADE[slot] || { gain: [1, 1, 1], lift: [0, 0, 0] };
  const lut = [new Uint8ClampedArray(256), new Uint8ClampedArray(256), new Uint8ClampedArray(256)];
  for (let c = 0; c < 3; c++) for (let v = 0; v < 256; v++) {
    // lift fades out toward the highlights so whites stay white
    const k = 1 - v / 255;
    lut[c][v] = Math.round(v * g.gain[c] + g.lift[c] * k);
  }
  return lut;
}
const LUTS = {};
const lutFor = (slot) => LUTS[slot] || (LUTS[slot] = gradeLUT(slot));
function applyLUT(buf, lut) {
  const r = lut[0], g = lut[1], b = lut[2];
  for (let i = 0; i < buf.length; i += 4) { buf[i] = r[buf[i]]; buf[i + 1] = g[buf[i + 1]]; buf[i + 2] = b[buf[i + 2]]; buf[i + 3] = 255; }
}

/* ------------------------------------------------------------------ frame sources */
function cacheSource(slot) {
  const file = path.join(L.CACHE_DIR, slot + '.mkv'), f0 = F.frameSpan(slot)[0];
  if (!fs.existsSync(file)) throw new Error('no cache for ' + slot + ' (run tools/cache.js ' + slot + ')');
  let dec = null, pos = -1;
  return {
    async get(f) {
      const i = f - f0;
      if (!dec || i < pos || i > pos + 90) { if (dec) dec.close(); dec = L.decoder(file, i); pos = i; }
      let buf = null;
      while (pos <= i) { buf = await dec.next(); pos++; if (!buf) throw new Error('cache ' + slot + ' ended at ' + (pos + f0)); }
      return buf;
    },
    close() { if (dec) dec.close(); dec = null; },
  };
}
function liveSource(slot) {
  let sec = null;
  return {
    async get(f) { if (!sec) sec = await L.openSection(slot); return sec.frame(f / 30); },
    close() { if (sec) sec.close(); sec = null; },
  };
}

/* ------------------------------------------------------------------ the mask (quarter resolution, bilinear) */
const MW = W / 4, MH = H / 4, MASK = new Float32Array(MW * MH);
function buildMask(k, p) { for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) MASK[y * MW + x] = F.mask(k, p, x * 4 + 2, y * 4 + 2); }
function blendMasked(a, b) {                   // a <- mix(a, b, mask); plus a faint warm glow along the front
  const cor = F.C.coral;
  for (let y = 0; y < H; y++) {
    const fy = Math.min(MH - 1.001, Math.max(0, (y - 1.5) / 4)), y0 = Math.floor(fy), ty = fy - y0, r0 = y0 * MW, r1 = r0 + MW;
    for (let x = 0; x < W; x++) {
      const fx = Math.min(MW - 1.001, Math.max(0, (x - 1.5) / 4)), x0 = Math.floor(fx), tx = fx - x0;
      const m = (MASK[r0 + x0] * (1 - tx) + MASK[r0 + x0 + 1] * tx) * (1 - ty) + (MASK[r1 + x0] * (1 - tx) + MASK[r1 + x0 + 1] * tx) * ty;
      const i = (y * W + x) * 4;
      if (m <= 0.002) continue;
      if (m >= 0.998) { a[i] = b[i]; a[i + 1] = b[i + 1]; a[i + 2] = b[i + 2]; continue; }
      const e = m * (1 - m) * 4 * 0.07;
      a[i] = a[i] + (b[i] - a[i]) * m + cor[0] * e; a[i + 1] = a[i + 1] + (b[i + 1] - a[i + 1]) * m + cor[1] * e; a[i + 2] = a[i + 2] + (b[i + 2] - a[i + 2]) * m + cor[2] * e;
    }
  }
}

/* ------------------------------------------------------------------ the wave's agents: small warm lights, additive */
function addLight(buf, cx, cy, r, a, col) {
  const R = r * 4.2, x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(W - 1, Math.ceil(cx + R)), y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(H - 1, Math.ceil(cy + R));
  const ir = 1 / r;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) * ir;
    const k = (d < 1 ? 1 : 0) * 0 + Math.max(0, 1 - d) * 0.9 + Math.exp(-d * d * 0.18) * 0.16;
    if (k < 0.004) continue;
    const i = (y * W + x) * 4, kk = k * a;
    buf[i] = Math.min(255, buf[i] + col[0] * kk); buf[i + 1] = Math.min(255, buf[i + 1] + col[1] * kk); buf[i + 2] = Math.min(255, buf[i + 2] + col[2] * kk);
  }
}
function drawWave(buf, k, p) {
  const list = F.waveAgents(k, p), C = F.C;
  for (const g of list) {
    if (g.a <= 0.01 || g.x < -60 || g.y < -60 || g.x > W + 60 || g.y > H + 60) continue;
    const core = [lerp(C.light[0], C.cream[0], g.hot), lerp(C.light[1], C.cream[1], g.hot), lerp(C.light[2], C.cream[2], g.hot)];
    // a short trail behind it, so the lights read as moving with purpose
    const tl = g.r * 7;
    for (let s = 4; s >= 1; s--) addLight(buf, g.x - g.vx * tl * s / 4, g.y - g.vy * tl * s / 4, g.r * (1 - s * 0.12), g.a * 0.22 * (1 - s / 5), C.coral);
    addLight(buf, g.x, g.y, g.r, g.a * 0.85, core);
  }
}
const lerp = (a, b, u) => a + (b - a) * u;

/* ------------------------------------------------------------------ the HUD */
function drawHUD(buf, T) {
  F.hud(T, (x, y, w, h, rgb, a) => {
    if (a <= 0) return;
    const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y)), x1 = Math.min(W, Math.round(x + w)), y1 = Math.min(H, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 4;
      buf[i] += (rgb[0] - buf[i]) * a; buf[i + 1] += (rgb[1] - buf[i + 1]) * a; buf[i + 2] += (rgb[2] - buf[i + 2]) * a;
    }
  });
}

/* ------------------------------------------------------------------ one frame */
const SRC = {};
let LIVE = new Set();
function source(slot) { return SRC[slot] || (SRC[slot] = LIVE.has(slot) ? liveSource(slot) : cacheSource(slot)); }
function closeSources(keep) { for (const s of Object.keys(SRC)) if (!keep || !keep.includes(s)) { SRC[s].close(); delete SRC[s]; } }
async function composeFrame(f) {
  const T = f / 30, at = F.at(T);
  const a = Buffer.from(await source(at.from).get(f)); applyLUT(a, lutFor(at.from));
  if (at.to) {
    const b = Buffer.from(await source(at.to).get(f)); applyLUT(b, lutFor(at.to));
    buildMask(at.k, at.p); blendMasked(a, b);
    drawWave(a, at.k, at.p);
  }
  drawHUD(a, T);
  return a;
}

/* ------------------------------------------------------------------ stats for verification: luminance, flashes */
const lin = new Float32Array(256); for (let v = 0; v < 256; v++) { const c = v / 255; lin[v] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function frameStats(buf) {
  // relative luminance on a 96x54 grid of 20x20 cells, plus the frame mean and mean colour
  const GW = 96, GH = 54, g = new Float32Array(GW * GH); let sr = 0, sg = 0, sb = 0, sl = 0;
  for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
    let s = 0;
    for (let y = cy * 20; y < cy * 20 + 20; y += 2) for (let x = cx * 20; x < cx * 20 + 20; x += 2) {
      const i = (y * W + x) * 4, l = 0.2126 * lin[buf[i]] + 0.7152 * lin[buf[i + 1]] + 0.0722 * lin[buf[i + 2]];
      s += l; sr += buf[i]; sg += buf[i + 1]; sb += buf[i + 2];
    }
    g[cy * GW + cx] = s / 100; sl += s / 100;
  }
  const n = GW * GH * 100;
  return { grid: g, mean: sl / (GW * GH), rgb: [sr / n, sg / n, sb / n] };
}

/* ------------------------------------------------------------------ modes */
async function video(out) {
  L.ensureDir(L.OUT_DIR);
  const enc = L.finalEncoder(out);
  const stats = { mean: [], rgb: [], flashArea: [] };
  let prev = null; const t0 = Date.now();
  for (let f = 0; f < F.FRAMES; f++) {
    const buf = await composeFrame(f);
    await enc.write(buf);
    const st = frameStats(buf);
    stats.mean.push(+st.mean.toFixed(5)); stats.rgb.push(st.rgb.map((v) => +v.toFixed(2)));
    // a "large-area flash" candidate: share of the screen whose luminance changed by >= 0.1 with the darker state < 0.8
    let up = 0, down = 0;
    if (prev) for (let i = 0; i < st.grid.length; i++) { const d = st.grid[i] - prev[i]; if (Math.min(st.grid[i], prev[i]) < 0.8) { if (d >= 0.1) up++; else if (d <= -0.1) down++; } }
    stats.flashArea.push([+(up / st.grid.length).toFixed(4), +(down / st.grid.length).toFixed(4)]);
    prev = st.grid;
    // drop decoders of sections no longer needed
    if (f % 30 === 0) { const at = F.at(f / 30); closeSources([at.from, at.to].concat(F.at((f + 31) / 30).to ? [F.at((f + 31) / 30).to] : [])); }
    if (f % 60 === 0) console.log('frame', f, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  await enc.end(); closeSources();
  fs.writeFileSync(path.join(L.FILM_DIR, 'stats.json'), JSON.stringify(stats));
  console.log('wrote', out, ((Date.now() - t0) / 1000).toFixed(0) + 's');
}

const BEST = { '07-ink-sketch': 3.4, '01-iso-pixel': 8.1, '02-paper-cut': 14.2, '05-vector-wireframe': 20.0, '04-voxel': 24.9, '03-low-poly-3d': 30.2, '06-clay-3d': 40.0 };
async function review(round) {
  const OUT = L.OUT_DIR, frames = new Map();
  const want = [];
  for (let f = 0; f < F.FRAMES; f += 15) want.push(f);                                   // 2 per second
  const strips = F.X.map((x) => { const a = []; for (let f = Math.round((x.t - 0.5) * 30); f <= Math.round((x.t + 0.5) * 30); f += 2) a.push(f); return a; });
  for (const s of strips) want.push(...s);
  const stills = Object.entries(BEST).map(([slot, t]) => [slot, Math.min(F.FRAMES - 1, Math.round(t * 30))]);
  for (const s of stills) want.push(s[1]);
  const uniq = [...new Set(want)].sort((a, b) => a - b);
  const t0 = Date.now();
  for (const f of uniq) { frames.set(f, await composeFrame(f)); }
  closeSources();
  console.log('composed', uniq.length, 'frames', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  for (const d of ['stills', 'strips', 'snapshots']) L.ensureDir(path.join(OUT, d));
  const sheet = []; for (let f = 0; f < F.FRAMES; f += 15) sheet.push(frames.get(f));
  await L.tile(sheet, path.join(OUT, 'stills', 'contact-sheet.png'), 8, 400);
  fs.copyFileSync(path.join(OUT, 'stills', 'contact-sheet.png'), path.join(OUT, 'snapshots', 'round' + round + '.png'));
  for (let k = 0; k < strips.length; k++) await L.tile(strips[k].map((f) => frames.get(f)), path.join(OUT, 'strips', 'transition-' + (k + 1) + '-' + F.X[k].from.slice(3) + '-to-' + F.X[k].to.slice(3) + '.png'), 4, 640);
  for (const [slot, f] of stills) await L.png(frames.get(f), path.join(OUT, 'stills', slot + '.png'));
}
async function frameList(list, dir) {
  L.ensureDir(dir);
  for (const f of list) { const b = await composeFrame(f); await L.png(b, path.join(dir, 'f' + String(f).padStart(4, '0') + '.png')); }
  closeSources();
}

async function main() {
  const a = process.argv.slice(2), li = a.indexOf('--live');
  if (li >= 0) { LIVE = new Set(a[li + 1].split(',')); a.splice(li, 2); }
  if (a[0] === 'video') await video(a[1] || path.join(L.OUT_DIR, 'thousand-agents-16x9.mp4'));
  else if (a[0] === 'review') await review(a[1] || '0');
  else if (a[0] === 'frames') await frameList(a[1].split(',').map(Number), a[2]);
  await L.closeBrowser();
}
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { composeFrame, frameStats, closeSources, setLive: (s) => { LIVE = new Set(s); } };
