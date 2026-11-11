'use strict';
// ---------------------------------------------------------------------------
// Assembly: the static painting is made once, as separate lighting layers
// (lit paint, a candle-response mask, and the lead-white lights for two flame
// positions).  Each frame re-mixes them with the flicker, paints the peel in
// its current pose into its own rectangle, adds the bubble, and applies the
// varnish and craquelure that sit on top of everything.
// ---------------------------------------------------------------------------
// candle: periodic irregular flicker built from integer harmonics of the loop
function loopNoise(seed, kmin, kmax, slope) {
  const r = mulberry32(seed), comps = [];
  let ss = 0;
  for (let k = kmin; k <= kmax; k++) { const a = Math.pow(k, -slope) * (0.6 + 0.8 * r()); comps.push([k, a, r() * Math.PI * 2]); ss += a * a * 0.5; }
  const norm = 1 / Math.sqrt(ss);
  return ph => { let s = 0; for (const c of comps) s += c[1] * Math.sin(2 * Math.PI * c[0] * ph + c[2]); return s * norm; };
}
const nA = loopNoise(11, 3, 24, 0.95), nB = loopNoise(23, 3, 28, 0.85), nM = loopNoise(37, 2, 9, 1.1);
function flame(t) {
  const ph = (((t / LOOP) % 1) + 1) % 1;
  const a = nA(ph), b = nB(ph), m = nM(ph);
  return { id: 1 + 0.035 * a, is: 1 + 0.13 * (0.78 * a + 0.62 * b), m: 0.5 + 0.5 * Math.tanh(1.1 * m) };
}

const PIECE = { ready: false };
function pieceInit(S, log) {
  log = log || (() => {});
  const t0 = Date.now();
  const T = makeTarget(Math.round(PW * S), Math.round(PH * S), S, false);
  setTarget(T);
  initCanvas(T, groundCol);
  log('canvas ' + (Date.now() - t0));
  paintScene(99);
  log('painted ' + (Date.now() - t0) + ' strokes ' + E.count);
  const N = T.N, W = T.W, H = T.H;
  RELIEF.S = S;
  const snap = { r: T.r.slice(), g: T.g.slice(), b: T.b.slice(), ht: T.ht.slice() };
  const lit0 = reliefTarget(T);
  // two flame positions for the lights
  const diffs = [];
  for (const hp of [{ dx: 0, dy: 0, k: 1 }, { dx: 2.2, dy: 1.3, k: 1.07 }]) {
    T.r.set(snap.r); T.g.set(snap.g); T.b.set(snap.b); T.ht.set(snap.ht);
    paintHighlights(hp);
    const lit = reliefTarget(T);
    const idx = [], val = [];
    for (let i = 0; i < N; i++) {
      const a = lit[3 * i] - lit0[3 * i], b = lit[3 * i + 1] - lit0[3 * i + 1], c = lit[3 * i + 2] - lit0[3 * i + 2];
      if (Math.abs(a) + Math.abs(b) + Math.abs(c) > 1e-4) { idx.push(i); val.push(a, b, c); }
    }
    diffs.push({ idx: Int32Array.from(idx), val: Float32Array.from(val) });
  }
  T.r.set(snap.r); T.g.set(snap.g); T.b.set(snap.b); T.ht.set(snap.ht);
  log('lights ' + (Date.now() - t0));
  // varnish (warm, slightly uneven) and craquelure: one multiplier per pixel
  const crk = craquelure(W, H, S);
  const CV = new Float32Array(N * 3), CA = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, fx = x / S, fy = y / S;
    const lum = 0.3 * lit0[3 * i] + 0.55 * lit0[3 * i + 1] + 0.15 * lit0[3 * i + 2];
    const mot = 1 + 0.035 * (fbm(fx * 0.002 + 4, fy * 0.002 + 9, 3) - 0.5);
    const vx = (fx / PW - 0.5) * 2, vy = (fy / PH - 0.5) * 2;
    const vig = 1 - 0.1 * Math.pow(Math.min(1, (vx * vx + vy * vy) * 0.5), 1.5);
    const c = crk[i];
    const k = mot * vig * (1 - c * (0.035 + 0.09 * lum));
    CV[3 * i] = k * 1.0; CV[3 * i + 1] = k * 0.968; CV[3 * i + 2] = k * 0.89;
    CA[i] = c * 0.004 * (1 - lum); // crack edges catching light in the darks
  }
  // candle response: lit, near-the-light paint breathes most
  const LM = new Float32Array(N), GX = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const lum = 0.3 * lit0[3 * i] + 0.55 * lit0[3 * i + 1] + 0.15 * lit0[3 * i + 2];
    LM[i] = sm(0.03, 0.55, lum) * (0.75 + 0.25 * (1 - x / W));
    GX[i] = 0.5 - x / W;
  }
  // final static layers
  const L0 = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { L0[3 * i] = lit0[3 * i] * CV[3 * i] + CA[i]; L0[3 * i + 1] = lit0[3 * i + 1] * CV[3 * i + 1] + CA[i]; L0[3 * i + 2] = lit0[3 * i + 2] * CV[3 * i + 2] + CA[i] * 0.85; }
  for (const d of diffs) for (let k = 0; k < d.idx.length; k++) { const i = d.idx[k]; d.val[3 * k] *= CV[3 * i]; d.val[3 * k + 1] *= CV[3 * i + 1]; d.val[3 * k + 2] *= CV[3 * i + 2]; }
  Object.assign(PIECE, { S, W, H, N, T, L0, LM, GX, CV, CA, diffs, snap });
  // the peel: painted surfaces and its rectangle on the canvas
  peelPaintTextures(S);
  const bb = PEEL.bounds();
  let rx0 = Math.max(0, Math.floor(bb[0] * S) & ~1), ry0 = Math.max(0, Math.floor(bb[1] * S) & ~1);
  let rx1 = Math.min(W, Math.ceil(bb[2] * S)), ry1 = Math.min(H, Math.ceil(bb[3] * S));
  if ((rx1 - rx0) & 1) rx1 = Math.min(W, rx1 + 1); if ((ry1 - ry0) & 1) ry1 = Math.min(H, ry1 + 1);
  const rect = [rx0, ry0, rx1 - rx0, ry1 - ry0];
  PEEL.prepareRaster(S, rect);
  PIECE.rect = rect;
  // dense lights inside the rect
  const rn = rect[2] * rect[3];
  PIECE.rHL = [new Float32Array(rn * 3), new Float32Array(rn * 3)];
  diffs.forEach((d, j) => {
    for (let k = 0; k < d.idx.length; k++) {
      const i = d.idx[k], x = i % W, y = (i / W) | 0;
      if (x >= rect[0] && x < rect[0] + rect[2] && y >= rect[1] && y < rect[1] + rect[3]) {
        const o = ((y - rect[1]) * rect[2] + x - rect[0]) * 3;
        PIECE.rHL[j][o] = d.val[3 * k]; PIECE.rHL[j][o + 1] = d.val[3 * k + 1]; PIECE.rHL[j][o + 2] = d.val[3 * k + 2];
      }
    }
  });
  // half-resolution layers for the video
  if (S === 1) buildHalf();
  PIECE.frame = new Float32Array(N * 3);
  PIECE.ready = true;
  log('ready ' + (Date.now() - t0));
}

function buildHalf() {
  const P = PIECE, W = P.W, H = P.H, w2 = W >> 1, h2 = H >> 1, n2 = w2 * h2;
  const A = new Float32Array(n2 * 3), B = new Float32Array(n2 * 3), Cc = new Float32Array(n2 * 3);
  for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
    const o = (y * w2 + x) * 3;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const i = (2 * y + dy) * W + 2 * x + dx;
      for (let c = 0; c < 3; c++) {
        const v = P.L0[3 * i + c];
        A[o + c] += v * 0.25; B[o + c] += v * P.LM[i] * 0.25; Cc[o + c] += v * P.LM[i] * P.GX[i] * 0.25;
      }
    }
  }
  const hd = P.diffs.map(d => {
    const acc = new Map();
    for (let k = 0; k < d.idx.length; k++) {
      const i = d.idx[k], x = (i % W) >> 1, y = ((i / W) | 0) >> 1, j = y * w2 + x;
      let a = acc.get(j); if (!a) { a = [0, 0, 0]; acc.set(j, a); }
      a[0] += d.val[3 * k] * 0.25; a[1] += d.val[3 * k + 1] * 0.25; a[2] += d.val[3 * k + 2] * 0.25;
    }
    const keys = Array.from(acc.keys()).sort((a, b) => a - b);
    const idx = Int32Array.from(keys), val = new Float32Array(keys.length * 3);
    keys.forEach((j, k) => { const a = acc.get(j); val[3 * k] = a[0]; val[3 * k + 1] = a[1]; val[3 * k + 2] = a[2]; });
    return { idx, val };
  });
  Object.assign(P, { w2, h2, A, B, Cc, hd, half: new Float32Array(n2 * 3) });
}

// the peel's rectangle at full internal resolution, composited and lit
function composeRect(t, f, c1, c2) {
  const P = PIECE, W = P.W, rect = P.rect, rw = rect[2], rh = rect[3];
  const pr = PEEL.raster(t, f);
  const m = 2; // margin for the relief filter
  const ew = rw + 2 * m, eh = rh + 2 * m;
  const sr = new Float32Array(ew * eh), sg = new Float32Array(ew * eh), sb = new Float32Array(ew * eh), shh = new Float32Array(ew * eh), swv = new Float32Array(ew * eh);
  const T = P.T, snap = P.snap;
  for (let y = 0; y < eh; y++) for (let x = 0; x < ew; x++) {
    const cx = clamp(rect[0] + x - m, 0, W - 1), cy = clamp(rect[1] + y - m, 0, P.H - 1), i = cy * W + cx, o = y * ew + x;
    let r = snap.r[i], g = snap.g[i], b = snap.b[i], h = snap.ht[i];
    const lx = rect[0] + x - m - rect[0], ly = rect[1] + y - m - rect[1];
    if (lx >= 0 && ly >= 0 && lx < rw && ly < rh) {
      const q = ly * rw + lx, a = pr.ca[q];
      if (a > 0) { r = r * (1 - a) + pr.cr[q]; g = g * (1 - a) + pr.cg[q]; b = b * (1 - a) + pr.cb[q]; h = h * (1 - a * 0.5) + pr.ch[q]; }
    }
    sr[o] = r; sg[o] = g; sb[o] = b; shh[o] = h; swv[o] = T.weave[i];
  }
  RELIEF.S = P.S;
  const lit = new Float32Array(ew * eh * 3);
  reliefRect(sr, sg, sb, shh, swv, ew, ew, eh, lit);
  const out = new Float32Array(rw * rh * 3);
  const hA = P.rHL[0], hB = P.rHL[1], wa = f.is * (1 - f.m), wb = f.is * f.m;
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
    const i = (rect[1] + y) * W + rect[0] + x, q = y * rw + x, o = ((y + m) * ew + x + m) * 3;
    const a = pr.ca[q];
    const fl = 1 + (1 - a) * P.LM[i] * (c1 + c2 * P.GX[i]);
    const ho = 1 - a;
    out[3 * q] = (lit[o] * P.CV[3 * i] + P.CA[i]) * fl + (hA[3 * q] * wa + hB[3 * q] * wb) * ho;
    out[3 * q + 1] = (lit[o + 1] * P.CV[3 * i + 1] + P.CA[i]) * fl + (hA[3 * q + 1] * wa + hB[3 * q + 1] * wb) * ho;
    out[3 * q + 2] = (lit[o + 2] * P.CV[3 * i + 2] + P.CA[i] * 0.85) * fl + (hA[3 * q + 2] * wa + hB[3 * q + 2] * wb) * ho;
  }
  return out;
}

// the bubble: clings inside the wine, grows, lets go once per loop and rises
const BUB = { tRel: 5.6, rmax: 10, x0: 0, y0: G.wine + 156 };
function bubbleState(t) {
  const L = LOOP, tau = (((t - BUB.tRel) % L) + L) % L;
  const list = [];
  const wallX = y => G.x + gR(y) * 0.86;
  const rg = BUB.rmax * Math.pow(tau / L, 0.5);
  if (rg > 0.6) list.push({ x: wallX(BUB.y0) - rg * 0.9, y: BUB.y0, r: rg, a: sm(0.6, 2.0, rg) });
  const riseT = 1.05;
  if (tau < riseT + 0.45) {
    const u = Math.min(tau / riseT, 1);
    const e = u * u * (3 - 2 * u) * 0.7 + u * 0.3;
    const y = BUB.y0 + (G.wine + 6 - BUB.y0) * e;
    const r = BUB.rmax * (1 + 0.05 * e);
    const pop = tau > riseT ? 1 - sm(riseT + 0.15, riseT + 0.42, tau) : 1;
    const x = wallX(y) - r * 0.95 - 3 * Math.sin(u * Math.PI);
    if (pop > 0.001) list.push({ x, y, r, a: pop, vy: (G.wine + 6 - BUB.y0) * (0.7 * 6 * u * (1 - u) + 0.3) / riseT });
  }
  return list;
}
// draw into a float RGB buffer of width bw at scale s (canvas px per scene px)
function drawBubble(buf, bw, bh, s, t, f) {
  for (const b of bubbleState(t)) {
    // a little motion blur while rising: a few sub-positions over 1/60 s
    const subs = b.vy ? 4 : 1;
    for (let k = 0; k < subs; k++) {
      const yy = b.y + (b.vy ? (k / (subs - 1) - 0.5) * b.vy / 60 : 0);
      const cx = b.x * s, cy = yy * s, R0 = Math.max(0.5, b.r * s), al = b.a / subs;
      const x0 = Math.max(0, Math.floor(cx - R0 - 3)), x1 = Math.min(bw - 1, Math.ceil(cx + R0 + 3));
      const y0 = Math.max(0, Math.floor(cy - R0 - 3)), y1 = Math.min(bh - 1, Math.ceil(cy + R0 + 3));
      const hx = cx - R0 * 0.36, hy = cy - R0 * 0.4;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
        const cov = clamp(R0 - d + 0.5, 0, 1) * al;
        const q = (y * bw + x) * 3;
        if (cov > 0) {
          const rr = d / R0;
          const rim = sm(0.55, 0.98, rr);
          const lo = sm(-0.2, 0.9, (dx * 0.5 + dy * 0.85) / R0) * (1 - rr * 0.5);
          for (let c = 0; c < 3; c++) {
            const base = buf[q + c];
            const tgt = base * (0.72 + 0.18 * rim) + [0.11, 0.09, 0.04][c] * lo * f.id + [0.06, 0.055, 0.04][c] * rim;
            buf[q + c] = base + (tgt - base) * cov;
          }
        }
        const hd = Math.hypot(x + 0.5 - hx, y + 0.5 - hy) / Math.max(R0 * 0.3, 0.7);
        const hs = Math.exp(-hd * hd * 1.4) * al * f.is * 0.85;
        buf[q] += hs * 0.98; buf[q + 1] += hs * 0.96; buf[q + 2] += hs * 0.88;
      }
    }
  }
}

// one frame; scale 1 = internal resolution, 0.5 = half (video, only when S=1)
function renderFrame(t, scale) {
  const P = PIECE, f = flame(t);
  const c1 = f.id - 1, c2 = (f.m - 0.5) * 0.05;
  const wa = f.is * (1 - f.m), wb = f.is * f.m;
  const rect = P.rect;
  if (scale === 0.5 && P.half) {
    const w2 = P.w2, h2 = P.h2, out = P.half, A = P.A, B = P.B, Cc = P.Cc;
    for (let i = 0, n = w2 * h2 * 3; i < n; i++) out[i] = A[i] + c1 * B[i] + c2 * Cc[i];
    P.hd.forEach((d, j) => { const w = j === 0 ? wa : wb; for (let k = 0; k < d.idx.length; k++) { const o = d.idx[k] * 3; out[o] += d.val[3 * k] * w; out[o + 1] += d.val[3 * k + 1] * w; out[o + 2] += d.val[3 * k + 2] * w; } });
    const rr = composeRect(t, f, c1, c2), rw = rect[2];
    for (let y = 0; y < rect[3] >> 1; y++) for (let x = 0; x < rw >> 1; x++) {
      const o = (((rect[1] >> 1) + y) * w2 + (rect[0] >> 1) + x) * 3;
      for (let c = 0; c < 3; c++) out[o + c] = (rr[((2 * y) * rw + 2 * x) * 3 + c] + rr[((2 * y) * rw + 2 * x + 1) * 3 + c] + rr[((2 * y + 1) * rw + 2 * x) * 3 + c] + rr[((2 * y + 1) * rw + 2 * x + 1) * 3 + c]) * 0.25;
    }
    drawBubble(out, w2, h2, P.S * 0.5, t, f);
    return toRGBA(out, w2, h2);
  }
  const W = P.W, H = P.H, out = P.frame, L0 = P.L0, LM = P.LM, GX = P.GX;
  for (let i = 0; i < P.N; i++) {
    const fl = 1 + LM[i] * (c1 + c2 * GX[i]);
    out[3 * i] = L0[3 * i] * fl; out[3 * i + 1] = L0[3 * i + 1] * fl; out[3 * i + 2] = L0[3 * i + 2] * fl;
  }
  P.diffs.forEach((d, j) => { const w = j === 0 ? wa : wb; for (let k = 0; k < d.idx.length; k++) { const o = d.idx[k] * 3; out[o] += d.val[3 * k] * w; out[o + 1] += d.val[3 * k + 1] * w; out[o + 2] += d.val[3 * k + 2] * w; } });
  const rr = composeRect(t, f, c1, c2), rw = rect[2];
  for (let y = 0; y < rect[3]; y++) { const o = ((rect[1] + y) * W + rect[0]) * 3; out.set(rr.subarray(y * rw * 3, (y + 1) * rw * 3), o); }
  drawBubble(out, W, H, P.S, t, f);
  return toRGBA(out, W, H);
}
function toRGBA(buf, w, h) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, d = (hash2(x * 7 + 13, y * 3 + 71) + hash2(x * 5 + 2, y * 11 + 9) - 1) / 255;
    rgba[4 * i] = (buf[3 * i] + d) * 255 + 0.5; rgba[4 * i + 1] = (buf[3 * i + 1] + d) * 255 + 0.5; rgba[4 * i + 2] = (buf[3 * i + 2] + d) * 255 + 0.5; rgba[4 * i + 3] = 255;
  }
  return { rgba, w, h };
}
