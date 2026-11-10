'use strict';
// Oil-paint simulation: canvas weave, bristle brush strokes with load / dry-brush / pickup,
// a paint-thickness (impasto) field, and a final raking-light pass.

function makeWeave(W, H, S, seed) {
  const wv = new Float32Array(W * H);
  const p = Math.max(2.4, 5.6 * S);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const xx = x + (vnoise(x / (50 * S), y / (50 * S), seed + 1) - 0.5) * 2.2 * S;
      const yy = y + (vnoise(x / (50 * S), y / (50 * S), seed + 2) - 0.5) * 2.2 * S;
      const gx = xx / p, gy = yy / p;
      const i = Math.floor(gx), j = Math.floor(gy);
      const fx = gx - i - 0.5, fy = gy - j - 0.5;
      const slubH = 0.8 + 0.4 * vnoise(gx * 0.35, j * 3.7, seed + 3);
      const slubV = 0.8 + 0.4 * vnoise(i * 3.7, gy * 0.35, seed + 4);
      const ph = Math.sqrt(Math.max(0, 1 - 4 * fy * fy)) * slubH;
      const pv = Math.sqrt(Math.max(0, 1 - 4 * fx * fx)) * slubV;
      const hH = 0.5 + 0.5 * Math.cos(Math.PI * (gx - 0.5) + Math.PI * j);
      const hV = 0.5 + 0.5 * Math.cos(Math.PI * (gy - 0.5) + Math.PI * i + Math.PI);
      const h = Math.max(ph * (0.45 + 0.55 * hH), pv * (0.45 + 0.55 * hV));
      wv[y * W + x] = h * 2 - 1 + (hash2(x, y, seed) - 0.5) * 0.25;
    }
  }
  return wv;
}

class Painter {
  constructor(W, H, S, seed) {
    this.W = W; this.H = H; this.S = S;
    const N = W * H;
    this.col = new Float32Array(N * 3);
    this.hgt = new Float32Array(N);
    this.weave = makeWeave(W, H, S, seed + 7);
    this.rng = PRNG(seed ^ 0x5bd1e995);
    this.bA = new Float32Array(80); this.bE = new Float32Array(80); this.bC = new Float32Array(80);
    this.count = 0;
  }
  ground(c) {
    const { col, weave } = this;
    for (let i = 0; i < this.W * this.H; i++) {
      const k = 1 + weave[i] * 0.06;
      col[i * 3] = c[0] * k; col[i * 3 + 1] = c[1] * k; col[i * 3 + 2] = c[2] * k;
    }
  }
  bristles(NB, dry, rag, bj, full) {
    const rng = this.rng, bA = this.bA, bE = this.bE, bC = this.bC;
    let clump = rng() * 6;
    for (let k = 0; k <= NB + 1; k++) {
      const edgeF = Math.abs(k / NB - 0.5) * 2;
      clump += 0.6 + rng() * 0.8;
      bA[k] = (0.55 + 0.45 * rng()) * (0.78 + 0.22 * Math.sin(clump)) * (1 - rag * 0.5 * edgeF * edgeF * rng());
      bE[k] = full ? 2 : 1 - dry * 0.55 * rng() - rag * 0.12 * edgeF * rng() - 0.04 * rng();
      bC[k] = (rng() - 0.5) * bj + 0.3 * bj * Math.sin(clump * 1.7);
    }
  }
  // polyline brush: one continuous stroke following pts [{x,y,w}]
  strokePath(pts, s) {
    const n = pts.length;
    if (n < 2) return;
    const W = this.W, H = this.H, col = this.col, hgt = this.hgt, wv = this.weave;
    const Lc = new Float32Array(n);
    let maxw = 0;
    for (let i = 1; i < n; i++) Lc[i] = Lc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    const total = Lc[n - 1];
    if (total < 0.3) return;
    let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
    for (const p of pts) { const w = Math.max(p.w, 1.7); if (w > maxw) maxw = w; bx0 = Math.min(bx0, p.x - w); by0 = Math.min(by0, p.y - w); bx1 = Math.max(bx1, p.x + w); by1 = Math.max(by1, p.y + w); }
    bx0 = Math.max(0, Math.floor(bx0)); by0 = Math.max(0, Math.floor(by0)); bx1 = Math.min(W - 1, Math.ceil(bx1)); by1 = Math.min(H - 1, Math.ceil(by1));
    if (bx0 > bx1 || by0 > by1) return;
    this.count++;
    const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
    const A = new Float32Array(bw * bh), U = new Float32Array(bw * bh), V = new Float32Array(bw * bh);
    const edgeIn = s.edge || 0;
    for (let i = 0; i < n - 1; i++) {
      const p = pts[i], q = pts[i + 1];
      const dx = q.x - p.x, dy = q.y - p.y, len2 = dx * dx + dy * dy + 1e-9, len = Math.sqrt(len2);
      const mw = Math.max(p.w, q.w, 1.7) * 0.5 + 1.5;
      const sx0 = Math.max(bx0, Math.floor(Math.min(p.x, q.x) - mw)), sx1 = Math.min(bx1, Math.ceil(Math.max(p.x, q.x) + mw));
      const sy0 = Math.max(by0, Math.floor(Math.min(p.y, q.y) - mw)), sy1 = Math.min(by1, Math.ceil(Math.max(p.y, q.y) + mw));
      for (let y = sy0; y <= sy1; y++) {
        for (let x = sx0; x <= sx1; x++) {
          let t = ((x - p.x) * dx + (y - p.y) * dy) / len2;
          if (t < 0) { if (i === 0 && !s.capStart) continue; t = 0; }
          else if (t > 1) { if (i === n - 2 && !s.capEnd) continue; t = 1; }
          const cx = p.x + dx * t, cy = p.y + dy * t;
          const ex = x - cx, ey = y - cy;
          let hw = (p.w + (q.w - p.w) * t) * 0.5;
          let thin = 1;
          if (hw < 0.85) { thin = Math.max(0, hw / 0.85); hw = 0.85; }
          if (thin <= 0.02) continue;
          const dist = Math.sqrt(ex * ex + ey * ey);
          const d = dist / hw;
          if (d >= 1) continue;
          const es = Math.min(0.95, Math.max(1.3 / hw, edgeIn));
          const cov = (d > 1 - es ? (1 - d) / es : 1) * thin;
          const k = (y - by0) * bw + (x - bx0);
          if (cov > A[k]) { A[k] = cov; U[k] = (Lc[i] + t * len) / total; V[k] = (dx * ey - dy * ex) >= 0 ? d : -d; }
        }
      }
    }
    const NB = Math.min(70, Math.max(5, Math.round(maxw * 0.7)));
    const dry = s.dry || 0, bj = s.bj == null ? 0.1 : s.bj, rag = s.rag == null ? 0.4 : s.rag;
    this.bristles(NB, dry, rag, bj, s.full);
    const bA = this.bA, bE = this.bE, bC = this.bC;
    const cr = s.r, cg = s.g, cb = s.b, alpha = s.alpha, thick = s.thick || 0, lev = Math.min(0.7, thick * 0.9);
    let mr = cr, mg = cg, mb = cb;
    const smear = s.smear || 0;
    if (smear > 0) { const sx = Math.round(clamp(pts[0].x, 0, W - 1)), sy = Math.round(clamp(pts[0].y, 0, H - 1)); const j = (sy * W + sx) * 3; mr = col[j]; mg = col[j + 1]; mb = col[j + 2]; }
    const c2 = s.c2;
    for (let yy = 0; yy < bh; yy++) {
      for (let xx = 0; xx < bw; xx++) {
        const k = yy * bw + xx;
        const cov = A[k];
        if (cov <= 0) continue;
        const u = U[k], d = V[k] < 0 ? -V[k] : V[k];
        const v = V[k] * 0.5 + 0.5;
        const fb = v * NB; const i0 = fb | 0; const fr = fb - i0;
        const ba = bA[i0] + (bA[i0 + 1] - bA[i0]) * fr;
        const be = bE[i0] + (bE[i0 + 1] - bE[i0]) * fr;
        const along = u < be ? 1 : u > be + 0.1 ? 0 : 1 - (u - be) * 10;
        if (along <= 0) continue;
        let a = alpha * cov * ba * along;
        const idx = (yy + by0) * W + xx + bx0;
        if (dry > 0) {
          const load = 1 - dry * u;
          const th = 1 - load * 1.7;
          const tooth = wv[idx] * 0.5 + 0.5;
          let q = (tooth - th) / 0.35 + 0.5; q = q < 0 ? 0 : q > 1 ? 1 : q;
          a *= q;
        }
        if (a <= 0.003) continue;
        const j = idx * 3;
        const sm = smear * u;
        const bc = 1 + bC[i0] + (bC[i0 + 1] - bC[i0]) * fr;
        let r = cr, g = cg, b = cb;
        if (c2) { r += (c2[0] - cr) * u; g += (c2[1] - cg) * u; b += (c2[2] - cb) * u; }
        col[j] += ((r + (mr - r) * sm) * bc - col[j]) * a;
        col[j + 1] += ((g + (mg - g) * sm) * bc - col[j + 1]) * a;
        col[j + 2] += ((b + (mb - b) * sm) * bc - col[j + 2]) * a;
        if (thick > 0) {
          const d4 = d * d * d * d;
          const hh = thick * (0.3 + 0.7 * ba) * (1 + 0.25 * d4) * (1.15 - 0.3 * u);
          hgt[idx] = hgt[idx] * (1 - a * lev) + a * hh;
        }
      }
    }
  }
  // s: {x,y,a,L,w,r,g,b,alpha,thick,dry,smear,mask,tgt,m0,m1,bend,taper,edge,bj,rag,full}
  stroke(s) {
    const W = this.W, H = this.H, col = this.col, hgt = this.hgt, wv = this.weave, rng = this.rng;
    let w = s.w, alpha = s.alpha;
    if (w < 1.7) { alpha *= Math.max(0.15, w / 1.7); w = 1.7; }
    const ca = Math.cos(s.a), sa = Math.sin(s.a);
    const hl = Math.max(0.5, s.L * 0.5), hw = w * 0.5;
    const bend = s.bend || 0;
    const ext = hl + hw + Math.abs(bend) * hl + 2;
    const x0 = Math.max(0, Math.floor(s.x - ext)), x1 = Math.min(W - 1, Math.ceil(s.x + ext));
    const y0 = Math.max(0, Math.floor(s.y - ext)), y1 = Math.min(H - 1, Math.ceil(s.y + ext));
    if (x0 > x1 || y0 > y1) return;
    this.count++;
    const NB = Math.min(70, Math.max(5, Math.round(w * 0.7)));
    const bA = this.bA, bE = this.bE, bC = this.bC;
    const dry = s.dry || 0, bj = s.bj == null ? 0.1 : s.bj, rag = s.rag == null ? 0.5 : s.rag;
    this.bristles(NB, dry, rag, bj, s.full);
    const cr = s.r, cg = s.g, cb = s.b;
    let mr = cr, mg = cg, mb = cb;
    const smear = s.smear || 0;
    if (smear > 0) {
      const sx = Math.round(clamp(s.x - ca * hl, 0, W - 1)), sy = Math.round(clamp(s.y - sa * hl, 0, H - 1));
      const j = (sy * W + sx) * 3; mr = col[j]; mg = col[j + 1]; mb = col[j + 2];
    }
    const thick = s.thick || 0, mask = s.mask || 0, tgt = s.tgt, m0 = s.m0 || 0.12, m1 = s.m1 || 0.3;
    const lev = Math.min(0.7, thick * 0.9);
    const edgeSoft = Math.min(0.95, Math.max(1.3 / hw, s.edge || 0));
    const invHl = 1 / hl, invHw = 1 / hw;
    const taper = s.taper == null ? 0.35 : s.taper;
    const bendK = bend * hl;
    for (let y = y0; y <= y1; y++) {
      const dy = y - s.y;
      for (let x = x0; x <= x1; x++) {
        const dx = x - s.x;
        const xr = dx * ca + dy * sa;
        let yr = -dx * sa + dy * ca;
        const t = xr * invHl;
        yr -= bendK * (t > 1 ? 1 : t < -1 ? 1 : t * t);
        let u = (t + 1) * 0.5;
        let wp = 1;
        if (u > 0.55) { const q = ((u > 1 ? 1 : u) - 0.55) / 0.45; wp = 1 - taper * q * q * (3 - 2 * q); }
        let d, ay = yr * invHw / wp;
        if (t < -1) { const ex = (xr + hl) * invHw; d = Math.sqrt(ex * ex + ay * ay); u = 0; }
        else if (t > 1) { const ex = (xr - hl) * invHw / wp; d = Math.sqrt(ex * ex + ay * ay); u = 1; }
        else d = ay < 0 ? -ay : ay;
        if (d >= 1) continue;
        const cov = d > 1 - edgeSoft ? (1 - d) / edgeSoft : 1;
        let v = ay * 0.5 + 0.5; v = v < 0 ? 0 : v > 1 ? 1 : v;
        const fb = v * NB; const i0 = fb | 0; const fr = fb - i0;
        const ba = bA[i0] + (bA[i0 + 1] - bA[i0]) * fr;
        const be = bE[i0] + (bE[i0 + 1] - bE[i0]) * fr;
        let along = u < be ? 1 : u > be + 0.1 ? 0 : 1 - (u - be) * 10;
        if (along <= 0) continue;
        let a = alpha * cov * ba * along;
        const idx = y * W + x;
        if (dry > 0) {
          const load = 1 - dry * u;
          const th = 1 - load * 1.7;
          const tooth = wv[idx] * 0.5 + 0.5;
          let q = (tooth - th) / 0.35 + 0.5; q = q < 0 ? 0 : q > 1 ? 1 : q;
          a *= q;
        }
        const j = idx * 3;
        if (mask > 0) {
          const dd = Math.abs(tgt[j] - cr) + Math.abs(tgt[j + 1] - cg) + Math.abs(tgt[j + 2] - cb);
          if (dd > m0) { const q = (dd - m0) / (m1 - m0); a *= 1 - mask * (q > 1 ? 1 : q); }
        }
        if (a <= 0.003) continue;
        const sm = smear * u;
        const bc = 1 + bC[i0] + (bC[i0 + 1] - bC[i0]) * fr;
        col[j] += ((cr + (mr - cr) * sm) * bc - col[j]) * a;
        col[j + 1] += ((cg + (mg - cg) * sm) * bc - col[j + 1]) * a;
        col[j + 2] += ((cb + (mb - cb) * sm) * bc - col[j + 2]) * a;
        if (thick > 0) {
          const d4 = d * d * d * d;
          const hh = thick * (0.3 + 0.7 * ba) * (1 + 0.25 * d4) * (1.15 - 0.3 * u);
          hgt[idx] = hgt[idx] * (1 - a * lev) + a * hh;
        }
      }
    }
  }
}

// Paint one pass of strokes guided by a blurred target and orientation map.
function paintLayer(P, scene, tgtB, auxB, o) {
  const W = P.W, H = P.H, S = P.S, rng = PRNG(o.seed);
  const col = P.col, tgt = scene.tgt;
  const sp = Math.max(1, o.w * o.spacing);
  const cands = [];
  for (let y = sp * 0.5; y < H; y += sp) for (let x = sp * 0.5; x < W; x += sp) cands.push(x + (rng() - 0.5) * sp, y + (rng() - 0.5) * sp);
  const n = cands.length / 2;
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
  let placed = 0;
  const wx = scene.window.x, wy = scene.window.y;
  for (let oi = 0; oi < n; oi++) {
    const k = order[oi];
    const x = clamp(cands[k * 2], 0, W - 1), y = clamp(cands[k * 2 + 1], 0, H - 1);
    const ix = x | 0, iy = y | 0, idx = iy * W + ix, j = idx * 3;
    if (o.region && !o.region(x, y)) continue;
    let tr = tgtB[j], tg = tgtB[j + 1], tb = tgtB[j + 2];
    if (o.err > 0) {
      const focus = Math.exp(-((x - wx) ** 2 + (y - wy) ** 2) / (2 * (o.focusR || 400 * S) ** 2));
      const thr = o.err * (1 - 0.5 * focus);
      const e = Math.abs(col[j] - tr) + Math.abs(col[j + 1] - tg) + Math.abs(col[j + 2] - tb);
      if (e < thr && rng() > (o.pAlways || 0)) continue;
    }
    // orientation from doubled-angle field
    let a = 0.5 * Math.atan2(auxB[j + 1], auxB[j]) + (rng() - 0.5) * 2 * (o.angJ || 0.15);
    if (rng() < (o.cross || 0)) a += (rng() < 0.5 ? 1 : -1) * (0.5 + 0.5 * rng());
    const imp = auxB[j + 2];
    // colour: broken colour jitter in value and temperature
    const vj = 1 + (rng() - 0.5) * (o.vj || 0.06);
    const tj = (rng() - 0.5) * (o.tj || 0.03);
    let r = tr * vj + tj, g = tg * vj, b = tb * vj - tj * 0.8;
    const lum = 0.3 * r + 0.59 * g + 0.11 * b;
    const w = o.w * (1 + (rng() - 0.5) * (o.wv || 0.4));
    // stroke length, clipped where the motif changes colour
    const Lmax = w * (o.lmin + (o.lmax - o.lmin) * rng());
    const ca = Math.cos(a), sa = Math.sin(a), stepL = Math.max(1, w * 0.4);
    const clip = o.clip || 0.2;
    let fwd = 0, back = 0;
    for (let dir = -1; dir <= 1; dir += 2) {
      let dist = 0;
      while (dist < Lmax * 0.5) {
        const px = Math.round(x + ca * (dist + stepL) * dir), py = Math.round(y + sa * (dist + stepL) * dir);
        if (px < 0 || py < 0 || px >= W || py >= H) break;
        const q = (py * W + px) * 3;
        const dd = Math.abs(tgtB[q] - tr) + Math.abs(tgtB[q + 1] - tg) + Math.abs(tgtB[q + 2] - tb);
        if (dd > clip) break;
        dist += stepL;
      }
      if (dir < 0) back = dist; else fwd = dist;
    }
    const L = Math.max(w * 0.6, fwd + back);
    const cx = x + ca * (fwd - back) * 0.5, cy = y + sa * (fwd - back) * 0.5;
    const thick = (o.thick || 0) * (0.25 + 0.9 * lum * lum) + (o.imp || 0) * imp * smooth(0.35, 0.7, lum);
    P.stroke({
      x: cx, y: cy, a, L, w, r, g, b,
      alpha: o.alpha * (0.85 + 0.15 * rng()), thick, dry: o.dry, smear: o.smear, mask: o.mask, tgt: o.maskTgt || tgtB,
      m0: o.m0, m1: o.m1, bend: (rng() - 0.5) * (o.bend || 0.3), taper: o.taper, bj: o.bj, rag: o.rag, edge: o.edge,
    });
    placed++;
  }
  return placed;
}

function finishPainting(P, outCtx, opt) {
  const W = P.W, H = P.H, S = P.S, N = W * H;
  const col = P.col, hgt = P.hgt, wv = P.weave;
  const T = new Float32Array(N);
  const wA = opt.weaveAmp, hA = opt.heightAmp;
  const hs = gaussBlur(hgt, W, H, 1, 0.7 * S);
  for (let i = 0; i < N; i++) T[i] = hs[i] * hA + wv[i] * wA * Math.exp(-hgt[i] * 1.6);
  const L = [-0.5, -0.62, 0.6]; const ll = Math.hypot(...L); L[0] /= ll; L[1] /= ll; L[2] /= ll;
  const Hh = [L[0], L[1], L[2] + 1]; const hl = Math.hypot(...Hh); Hh[0] /= hl; Hh[1] /= hl; Hh[2] /= hl;
  const base = Math.pow(Hh[2], opt.specPow);
  const img = outCtx.createImageData(W, H), D = img.data;
  const g = 1 / S;
  const drng = PRNG(99);
  const cx = W * 0.6, cy = H * 0.42, vr = Math.hypot(W, H) * 0.62;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const xl = x > 0 ? i - 1 : i, xr = x < W - 1 ? i + 1 : i, yu = y > 0 ? i - W : i, yd = y < H - 1 ? i + W : i;
      const gx = (T[xr] - T[xl]) * 0.5 * g, gy = (T[yd] - T[yu]) * 0.5 * g;
      let nx = -gx, ny = -gy, nz = 1; const nl = Math.sqrt(nx * nx + ny * ny + 1); nx /= nl; ny /= nl; nz /= nl;
      const dif = nx * L[0] + ny * L[1] + nz * L[2];
      const shade = 1 + opt.diffuse * (dif - L[2]) / L[2];
      const nh = nx * Hh[0] + ny * Hh[1] + nz * Hh[2];
      let sp = Math.pow(Math.max(0, nh), opt.specPow) - base;
      sp = sp > 0 ? sp * opt.spec * Math.min(1, hgt[i] * 0.8) : 0;
      let r = col[i * 3], gg = col[i * 3 + 1], b = col[i * 3 + 2];
      r = r * shade + sp * 0.9; gg = gg * shade + sp * 0.92; b = b * shade + sp;
      // gentle vignette
      const vd = Math.hypot(x - cx, (y - cy) * 0.9) / vr;
      const vg = 1 - opt.vignette * vd * vd;
      r *= vg; gg *= vg; b *= vg;
      const dn = (drng() - 0.5) / 255;
      D[i * 4] = clamp(Math.pow(clamp(r, 0, 1), opt.gamma) + dn, 0, 1) * 255 + 0.5;
      D[i * 4 + 1] = clamp(Math.pow(clamp(gg, 0, 1), opt.gamma) + dn, 0, 1) * 255 + 0.5;
      D[i * 4 + 2] = clamp(Math.pow(clamp(b, 0, 1), opt.gamma) + dn, 0, 1) * 255 + 0.5;
      D[i * 4 + 3] = 255;
    }
  }
  outCtx.putImageData(img, 0, 0);
}
