'use strict';
// ---------- paint buffers + bristle brush engine ----------
const P = {
  W: 0, H: 0, N: 0,
  CR: null, CG: null, CB: null, HT: null,
  rng: null,
};
function initPaint(W, H, seed) {
  P.W = W; P.H = H; P.N = W * H;
  P.CR = new Float32Array(P.N); P.CG = new Float32Array(P.N); P.CB = new Float32Array(P.N);
  P.HT = new Float32Array(P.N);
  P.rng = new RNG(seed);
}

// scratch for densified path
let PX = new Float32Array(8192), PY = new Float32Array(8192), PU = new Float32Array(8192);
const MAXB = 160;
const bOff = new Float32Array(MAXB), bLoad = new Float32Array(MAXB), bDry = new Float32Array(MAXB);
const bR = new Float32Array(MAXB), bG = new Float32Array(MAXB), bB = new Float32Array(MAXB);
const bHt = new Float32Array(MAXB);

function densify(pts, step) {
  // pts: flat [x0,y0,x1,y1,...]; returns count; fills PX,PY
  const n = pts.length / 2;
  let cnt = 0;
  if (n === 1) { PX[0] = pts[0]; PY[0] = pts[1]; return 1; }
  const ensure = (c) => { if (c >= PX.length) { const a = new Float32Array(PX.length * 2); a.set(PX); PX = a; const b = new Float32Array(PY.length * 2); b.set(PY); PY = b; const u = new Float32Array(PU.length * 2); u.set(PU); PU = u; } };
  for (let i = 0; i < n - 1; i++) {
    const p0x = pts[2 * Math.max(i - 1, 0)], p0y = pts[2 * Math.max(i - 1, 0) + 1];
    const p1x = pts[2 * i], p1y = pts[2 * i + 1];
    const p2x = pts[2 * (i + 1)], p2y = pts[2 * (i + 1) + 1];
    const p3x = pts[2 * Math.min(i + 2, n - 1)], p3y = pts[2 * Math.min(i + 2, n - 1) + 1];
    const len = Math.hypot(p2x - p1x, p2y - p1y);
    const m = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < m; k++) {
      const t = k / m, t2 = t * t, t3 = t2 * t;
      ensure(cnt);
      PX[cnt] = 0.5 * ((2 * p1x) + (-p0x + p2x) * t + (2 * p0x - 5 * p1x + 4 * p2x - p3x) * t2 + (-p0x + 3 * p1x - 3 * p2x + p3x) * t3);
      PY[cnt] = 0.5 * ((2 * p1y) + (-p0y + p2y) * t + (2 * p0y - 5 * p1y + 4 * p2y - p3y) * t2 + (-p0y + 3 * p1y - 3 * p2y + p3y) * t3);
      PU[cnt] = i + t;
      cnt++;
    }
  }
  ensure(cnt);
  PX[cnt] = pts[2 * (n - 1)]; PY[cnt] = pts[2 * (n - 1) + 1]; PU[cnt] = n - 1; cnt++;
  return cnt;
}

// opt: color[3], color2[3], mix (0..1), w | (w0,w1), alpha, streak, dry, thick, pick, cj (colour jitter), knife, clip{map,allow}, noProfile, seed
function stroke(pts, o) {
  const W = P.W, H = P.H, CR = P.CR, CG = P.CG, CB = P.CB, HT = P.HT;
  const rng = o.rng || P.rng;
  const cnt = densify(pts, 0.8);
  if (cnt < 2) return;
  // arc length
  let L = 0;
  for (let i = 1; i < cnt; i++) L += Math.hypot(PX[i] - PX[i - 1], PY[i] - PY[i - 1]);
  const w0 = o.w0 !== undefined ? o.w0 : o.w, w1 = o.w1 !== undefined ? o.w1 : o.w;
  let wmax = Math.max(w0, w1);
  const WA = o.widths; if (WA) { wmax = 0; for (let i = 0; i < WA.length; i++) if (WA[i] > wmax) wmax = WA[i]; }
  const nb = clamp(Math.round(wmax * 1.05) + 1, 2, MAXB);
  const knife = !!o.knife;
  const streak = o.streak !== undefined ? o.streak : 0.5;
  const dry = o.dry !== undefined ? o.dry : 0.3;
  const baseAlpha = o.alpha !== undefined ? o.alpha : 0.95;
  const thick = o.thick !== undefined ? o.thick : 0.3;
  const pick = o.pick !== undefined ? o.pick : 0.03;
  const cj = o.cj !== undefined ? o.cj : 0.03;
  const col = o.color, col2 = o.color2, mixAmt = o.mix !== undefined ? o.mix : 0.35;
  const clip = o.clip;
  const noProfile = !!o.noProfile;
  // bristle setup: two-scale clumps (coarse hair bundles + finer groups) so marks read as bristle tracks, not a comb
  const thickK = thick * (0.72 + 0.7 * rng.next());
  const spacing = wmax / Math.max(1, nb - 1);
  const cl1 = Math.max(1, Math.round(rng.range(9, 26) / Math.max(0.6, spacing)));
  const cl2 = Math.max(1, Math.round(rng.range(3.5, 8) / Math.max(0.6, spacing)));
  let cv1 = rng.next(), cv2 = rng.next(), c1 = 0, c2 = 0;
  for (let i = 0; i < nb; i++) {
    const u = nb > 1 ? i / (nb - 1) : 0.5;
    bOff[i] = (u - 0.5) + (rng.next() - 0.5) * 0.3 / nb;
    const r = rng.next();
    if (c1-- <= 0) { cv1 = rng.next(); c1 = cl1 + rng.int(0, cl1); }
    if (c2-- <= 0) { cv2 = rng.next(); c2 = cl2 + rng.int(0, cl2); }
    let ld = knife ? 1 : 1 - streak * (0.5 * (1 - cv1) + 0.38 * (1 - cv2) + 0.12 * (1 - r));
    const e = Math.abs(u - 0.5) * 2;
    if (!knife) ld *= 1 - 0.18 * smooth(0.8, 1.0, e);
    bLoad[i] = ld;
    bDry[i] = knife ? 0 : (0.5 * cv2 + 0.5 * r) * dry;
    let m = 0;
    if (col2 && !knife) m = clamp((cv1 - (1 - mixAmt)) * 4 + 0.6 * (cv2 - 0.5), 0, 1);
    const j = (cv2 - 0.5) * 2 * cj + (r - 0.5) * cj * 0.5;
    const cr = col[0], cg = col[1], cb = col[2];
    if (col2) { bR[i] = lerp(cr, col2[0], m) + j; bG[i] = lerp(cg, col2[1], m) + j * 0.95; bB[i] = lerp(cb, col2[2], m) + j * 0.9; }
    else { bR[i] = cr + j; bG[i] = cg + j * 0.95; bB[i] = cb + j * 0.9; }
    bHt[i] = thickK * (0.35 + 0.65 * ld) * ((i === 0 || i === nb - 1) ? 1.4 : 1);
  }
  const phase = rng.next() * 6.28;
  let tx = 1, ty = 0;
  let s = 0;
  const invL = 1 / Math.max(L, 1);
  for (let k = 0; k < cnt; k++) {
    const x = PX[k], y = PY[k];
    if (k > 0) s += Math.hypot(x - PX[k - 1], y - PY[k - 1]);
    const t = s * invL;
    // tangent (smoothed over window)
    const ka = Math.max(0, k - 2), kb = Math.min(cnt - 1, k + 2);
    let dx = PX[kb] - PX[ka], dy = PY[kb] - PY[ka];
    const dl = Math.hypot(dx, dy);
    if (dl > 1e-5) { tx = dx / dl; ty = dy / dl; }
    const nx = -ty, ny = tx;
    let wd = w0 + (w1 - w0) * t;
    if (WA) { const u = PU[k]; const ui = Math.min(WA.length - 2, Math.floor(u)); const uf = u - ui; wd = WA[ui] + (WA[ui + 1] - WA[ui]) * uf; }
    let press = 1;
    if (!noProfile) {
      const land = smooth(0, 0.07, t);
      const lift = smooth(0.78, 1.0, t);
      wd *= (0.62 + 0.38 * land) * (1 - 0.35 * lift);
      press = (0.55 + 0.45 * land) * (1 - 0.5 * lift);
    }
    const wob = 0.9 + 0.1 * Math.sin(s * 0.043 + phase);
    press *= wob;
    const tt = smooth(0.2, 1, t);
    let prevIdx = -1;
    for (let i = 0; i < nb; i++) {
      const px = Math.round(x + nx * bOff[i] * wd), py = Math.round(y + ny * bOff[i] * wd);
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      const idx = py * W + px;
      if (idx === prevIdx) continue;
      prevIdx = idx;
      if (clip && !(clip.allow & (1 << clip.map[idx]))) continue;
      const a = bLoad[i] * (1 - bDry[i] * tt) * press * baseAlpha;
      if (a < 0.02) continue;
      const ur = CR[idx], ug = CG[idx], ub = CB[idx];
      let cr = bR[i], cg = bG[i], cb = bB[i];
      // pickup: brush carries some of the underlying paint
      const pk = pick * a;
      cr += (ur - cr) * pk; cg += (ug - cg) * pk; cb += (ub - cb) * pk;
      bR[i] = cr; bG[i] = cg; bB[i] = cb;
      CR[idx] = ur + (cr - ur) * a; CG[idx] = ug + (cg - ug) * a; CB[idx] = ub + (cb - ub) * a;
      const tgt = bHt[i] * (0.3 + 0.7 * press);
      const h = HT[idx];
      if (tgt > h) HT[idx] = h + (tgt - h) * a * 0.75; else HT[idx] = h + (tgt - h) * a * 0.2;
    }
    if (knife) {
      // ridges just outside the blade edges
      for (let sgn = -1; sgn <= 1; sgn += 2) {
        const px = Math.round(x + nx * sgn * (0.5 * wd + 0.8)), py = Math.round(y + ny * sgn * (0.5 * wd + 0.8));
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const idx = py * W + px;
        if (clip && !(clip.allow & (1 << clip.map[idx]))) continue;
        const tgt = thick * 1.5 * press;
        if (tgt > HT[idx]) HT[idx] += (tgt - HT[idx]) * 0.6;
        const kk = (sgn > 0 ? i0(nb - 1) : 0);
        CR[idx] += (bR[kk] - CR[idx]) * 0.3; CG[idx] += (bG[kk] - CG[idx]) * 0.3; CB[idx] += (bB[kk] - CB[idx]) * 0.3;
      }
    }
  }
}
function i0(v) { return v; }

// soft round dab (flakes, apple highlights, lichen); r in px. Paints a roundish blob of bristle-ish granularity
function dab(x, y, r, col, o) {
  o = o || {};
  const W = P.W, H = P.H, CR = P.CR, CG = P.CG, CB = P.CB, HT = P.HT;
  const rng = o.rng || P.rng;
  const alpha = o.alpha !== undefined ? o.alpha : 1;
  const thick = o.thick !== undefined ? o.thick : 0.3;
  const hard = o.hard !== undefined ? o.hard : 0.6; // fraction of radius at full strength
  const ex = o.ex !== undefined ? o.ex : 1; // elongation along angle
  const ang = o.ang || 0;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const R = r * Math.max(1, ex) + 1.5;
  const x0 = Math.max(0, Math.floor(x - R)), x1 = Math.min(W - 1, Math.ceil(x + R));
  const y0 = Math.max(0, Math.floor(y - R)), y1 = Math.min(H - 1, Math.ceil(y + R));
  const clip = o.clip;
  const gr = o.grain !== undefined ? o.grain : 0.25;
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const dx = px - x, dy = py - y;
      const u = (dx * ca + dy * sa) / (r * ex), v = (-dx * sa + dy * ca) / r;
      const d = Math.sqrt(u * u + v * v);
      if (d >= 1) continue;
      const idx = py * W + px;
      if (clip && !(clip.allow & (1 << clip.map[idx]))) continue;
      let f = d <= hard ? 1 : 1 - (d - hard) / (1 - hard);
      f = f * f * (3 - 2 * f);
      f *= 1 - gr * rng.next();
      const a = f * alpha;
      if (a < 0.01) continue;
      CR[idx] += (col[0] - CR[idx]) * a; CG[idx] += (col[1] - CG[idx]) * a; CB[idx] += (col[2] - CB[idx]) * a;
      const tgt = thick * f;
      if (tgt > HT[idx]) HT[idx] += (tgt - HT[idx]) * a;
    }
  }
}

// ---------- blur helpers (box x3 approximating gaussian) ----------
function boxBlurH(src, dst, W, H, r) {
  const inv = 1 / (2 * r + 1);
  for (let y = 0; y < H; y++) {
    const o = y * W;
    let acc = src[o] * (r + 1);
    for (let i = 1; i <= r; i++) acc += src[o + Math.min(i, W - 1)];
    for (let x = 0; x < W; x++) {
      dst[o + x] = acc * inv;
      acc += src[o + Math.min(x + r + 1, W - 1)] - src[o + Math.max(x - r, 0)];
    }
  }
}
function boxBlurV(src, dst, W, H, r) {
  const inv = 1 / (2 * r + 1);
  const acc = new Float32Array(W);
  for (let x = 0; x < W; x++) acc[x] = src[x] * (r + 1);
  for (let i = 1; i <= r; i++) { const o = Math.min(i, H - 1) * W; for (let x = 0; x < W; x++) acc[x] += src[o + x]; }
  for (let y = 0; y < H; y++) {
    const o = y * W, oa = Math.min(y + r + 1, H - 1) * W, os = Math.max(y - r, 0) * W;
    for (let x = 0; x < W; x++) { dst[o + x] = acc[x] * inv; acc[x] += src[oa + x] - src[os + x]; }
  }
}
function blurInto(src, dst, tmp, W, H, sigma) {
  // sigma -> box radius for 3 passes
  const r = Math.max(1, Math.round(Math.sqrt(sigma * sigma * 4 / 12 + 0.25) * 0.9));
  boxBlurH(src, tmp, W, H, r); boxBlurV(tmp, dst, W, H, r);
  boxBlurH(dst, tmp, W, H, r); boxBlurV(tmp, dst, W, H, r);
}
