// sheet.js -- "The Tide Is Late"
// A sheet of cream sugar paper and a tin of dry things to draw with. Pure JavaScript: no canvas API,
// no libraries, no filters. Every mark on the sheet is a stroke dragged across a paper height-field;
// wax and pencil catch on the raised fibres first and only fill the hollows when you press or go over
// the place again. Light colours cover, dark pencils glaze (they multiply with what is underneath),
// and wax that is already down makes a pencil skid.
(function (G) {
  'use strict';
  const A = (G.ART = G.ART || {});

  // ------------------------------------------------------------------ chance
  A.rng = function (seed) {
    let a = (seed ^ 0x9e3779b9) >>> 0, b = 0x243f6a88, c = 0xb7e15162, d = 1;
    const f = function () { // sfc32
      a |= 0; b |= 0; c |= 0; d |= 0;
      const t = (((a + b) | 0) + d) | 0;
      d = (d + 1) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
    for (let i = 0; i < 12; i++) f();
    f.r = (lo, hi) => lo + (hi - lo) * f();
    f.i = (lo, hi) => Math.floor(lo + (hi - lo + 1) * f());
    f.g = () => (f() + f() + f() - 1.5) * 2;           // roughly normal, sd 1
    f.pick = arr => arr[Math.floor(f() * arr.length)];
    f.chance = p => f() < p;
    f.fork = () => A.rng(Math.floor(f() * 4294967296));
    return f;
  };
  function ih(x, y, s) {
    let h = (Math.imul(x | 0, 0x1b873593) + Math.imul(y | 0, 0x19d699a5)) ^ Math.imul(s | 0, 0x2545f491);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  A.ih = ih;
  const vn = A.vn = function (x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    let fx = x - xi, fy = y - yi;
    fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10); fy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const a = ih(xi, yi, s), b = ih(xi + 1, yi, s), c = ih(xi, yi + 1, s), d = ih(xi + 1, yi + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  A.fbm = function (x, y, oct, s) {
    let v = 0, amp = 0.5, tot = 0;
    for (let o = 0; o < oct; o++) { v += amp * vn(x, y, s + o * 23); tot += amp; x = x * 1.97 + 31.3; y = y * 1.97 + 17.9; amp *= 0.52; }
    return v / tot;
  };
  const clamp = A.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  A.mix = (a, b, t) => a + (b - a) * t;
  A.ss = (a, b, v) => { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  A.hex = function (s) {
    const n = parseInt(s.replace('#', ''), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  A.mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // ------------------------------------------------------------------ the sheet
  const TS = 32;
  A.Sheet = function (W, H, seed) {
    this.W = W; this.H = H; this.S = W / 1600;
    const N = W * H;
    this.rgb = new Float32Array(N * 3);   // what the eye sees
    this.wax = new Float32Array(N);       // how much has been laid down here (0..1)
    this.tooth = new Float32Array(N);     // paper height 0..1
    this.mask = new Float32Array(N);      // pressure of the stroke in progress
    this.tw = Math.ceil(W / TS); this.th = Math.ceil(H / TS);
    this.tflag = new Uint8Array(this.tw * this.th);
    this.tlist = new Int32Array(this.tw * this.th);
    this.tn = 0;
    this.seed = seed | 0;
    this.count = 0;
    this._st = new Float32Array(32);
    this._rs = A.rng(seed ^ 0x51ed27);
    this.makePaper();
  };
  const P = A.Sheet.prototype;
  A.PAPER = [0.935, 0.892, 0.782];

  // sugar paper: a felted, slightly streaky tooth, a mottled cream, and a few stray coloured fibres
  P.makePaper = function () {
    const W = this.W, H = this.H, S = this.S, t = this.tooth, rgb = this.rgb, sd = this.seed;
    const pr = A.PAPER[0], pg = A.PAPER[1], pb = A.PAPER[2];
    for (let y = 0; y < H; y++) {
      const v = y / S;
      for (let x = 0; x < W; x++) {
        const u = x / S;
        let n = 0.40 * vn(u / 1.15, v / 1.15, sd) + 0.32 * vn(u / 2.7, v / 2.3, sd + 5) + 0.28 * vn(u / 6.5, v / 7.5, sd + 9);
        // felt: short fibres lying every which way, standing a little proud of the sheet
        const f1 = vn((u * 0.83 + v * 0.56) / 1.3, (-u * 0.56 + v * 0.83) / 15, sd + 21);
        const f2 = vn((u * 0.31 - v * 0.95) / 1.4, (u * 0.95 + v * 0.31) / 19, sd + 27);
        const f3 = vn(u / 22, v / 1.5, sd + 33);
        let fib = 0;
        if (f1 > 0.74) fib += (f1 - 0.74) * 1.5; if (f2 > 0.76) fib += (f2 - 0.76) * 1.5; if (f3 > 0.80) fib += (f3 - 0.80) * 1.3;
        n = (n - 0.5) * 1.9 + 0.5 + fib;
        const i = y * W + x;
        t[i] = n < 0 ? 0 : n > 1 ? 1 : n;
        const mott = 1 + (A.fbm(u / 140, v / 140, 3, sd + 41) - 0.5) * 0.07 + (vn(u / 11, v / 11, sd + 47) - 0.5) * 0.03 + (t[i] - 0.5) * 0.05;
        const warm = (vn(u / 260, v / 200, sd + 53) - 0.5) * 0.03;
        rgb[i * 3] = pr * mott + warm; rgb[i * 3 + 1] = pg * mott; rgb[i * 3 + 2] = pb * mott - warm;
      }
    }
    // stray fibres and flecks pressed into the pulp
    const rs = A.rng(sd + 77), nf = Math.round(1600 * 900 / 900);
    const tints = [[0.55, 0.42, 0.30], [0.50, 0.55, 0.62], [0.70, 0.45, 0.35], [0.98, 0.97, 0.92], [0.45, 0.50, 0.40]];
    for (let k = 0; k < nf; k++) {
      let x = rs() * 1600, y = rs() * 900, ang = rs() * 6.283;
      const len = rs.r(1.5, 9), tint = rs.pick(tints), al = rs.r(0.10, 0.34), bend = rs.g() * 0.25;
      const steps = Math.ceil(len * S * 1.5);
      for (let q = 0; q < steps; q++) {
        const px = Math.round(x * S), py = Math.round(y * S);
        if (px >= 0 && py >= 0 && px < W && py < H) {
          const j = (py * W + px) * 3;
          rgb[j] += (tint[0] - rgb[j]) * al; rgb[j + 1] += (tint[1] - rgb[j + 1]) * al; rgb[j + 2] += (tint[2] - rgb[j + 2]) * al;
        }
        ang += bend / steps * 4; x += Math.cos(ang) / (S * 1.5); y += Math.sin(ang) / (S * 1.5);
      }
    }
  };

  // One stroke. pts = flat [x, y, pressure, widthScale, ...] in design units (1600 x 900).
  P.stroke = function (pts, T, col, wdu, press) {
    const S = this.S, W = this.W, H = this.H, mask = this.mask;
    const n = (pts.length / 4) | 0;
    if (n < 1) return;
    this.count++;
    const K = 20, st = this._st, rs = this._rs;
    if (T.stri > 0) {
      for (let k = 0; k < K; k++) { let v = 1 - T.stri * rs(); if (rs() < T.gap) v *= 0.25; st[k] = v; }
      let prev = st[0];
      for (let k = 0; k < K - 1; k++) { const cur = st[k]; st[k] = 0.22 * prev + 0.56 * cur + 0.22 * st[k + 1]; prev = cur; }
    } else for (let k = 0; k < K; k++) st[k] = 1;
    const edge = T.edge, round = T.round, tw = this.tw, tflag = this.tflag, tlist = this.tlist;
    const hw = 0.5 * wdu * S;
    const segs = n === 1 ? 1 : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = i * 4, b = (n === 1 ? i : i + 1) * 4;
      const ax = pts[a] * S, ay = pts[a + 1] * S, bx = pts[b] * S, by = pts[b + 1] * S;
      let ra = hw * pts[a + 3], rb = hw * pts[b + 3];
      if (ra < 0.45) ra = 0.45; if (rb < 0.45) rb = 0.45;
      const pa = press * pts[a + 2], pb = press * pts[b + 2];
      const rm = (ra > rb ? ra : rb) + 1;
      let x0 = Math.floor(Math.min(ax, bx) - rm), x1 = Math.ceil(Math.max(ax, bx) + rm);
      let y0 = Math.floor(Math.min(ay, by) - rm), y1 = Math.ceil(Math.max(ay, by) + rm);
      if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 > W - 1) x1 = W - 1; if (y1 > H - 1) y1 = H - 1;
      if (x0 > x1 || y0 > y1) continue;
      const ex = bx - ax, ey = by - ay, L2 = ex * ex + ey * ey;
      const iL2 = L2 > 1e-9 ? 1 / L2 : 0, iL = Math.sqrt(iL2);
      for (let py = y0; py <= y1; py++) {
        const dy = py + 0.5 - ay, row = py * W;
        for (let px = x0; px <= x1; px++) {
          const dx = px + 0.5 - ax;
          let t = (dx * ex + dy * ey) * iL2; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const cx = dx - ex * t, cy = dy - ey * t, d2 = cx * cx + cy * cy;
          const r = ra + (rb - ra) * t;
          if (d2 >= r * r) continue;
          const d = Math.sqrt(d2);
          let e = (r - d) / (edge * r + 0.75); if (e > 1) e = 1;
          let s = (dx * ey - dy * ex) * iL / r; s = s < -1 ? -1 : s > 1 ? 1 : s;
          let p = (pa + (pb - pa) * t) * e * st[((s * 0.5 + 0.5) * (K - 1) + 0.5) | 0];
          if (round > 0) p *= 1 - round + round * Math.sqrt(1 - d2 / (r * r));
          const idx = row + px;
          if (p > mask[idx]) mask[idx] = p;
        }
      }
      const tx0 = x0 >> 5, tx1 = x1 >> 5, ty0 = y0 >> 5, ty1 = y1 >> 5;
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        const ti = ty * tw + tx;
        if (!tflag[ti]) { tflag[ti] = 1; tlist[this.tn++] = ti; }
      }
    }
    this._lay(T, col[0], col[1], col[2]);
  };

  P._lay = function (T, cr, cg, cb) {
    const W = this.W, H = this.H, mask = this.mask, tooth = this.tooth, rgb = this.rgb, wax = this.wax;
    const tw = this.tw, tflag = this.tflag, tlist = this.tlist;
    const rough = T.rough, soft = T.soft, opac = T.opac, trans = T.trans, fill = T.fill, speck = T.speck, body = T.body, resist = T.resist || 0;
    const i2s = 1 / (2 * soft), sd = this.count * 7 + 3, cov = 1 - trans, GL = 1.05 * trans;
    for (let q = 0; q < this.tn; q++) {
      const ti = tlist[q]; tflag[ti] = 0;
      const tx = ti % tw, ty = (ti / tw) | 0;
      const x0 = tx * TS, y0 = ty * TS, x1 = Math.min(W, x0 + TS), y1 = Math.min(H, y0 + TS);
      for (let y = y0; y < y1; y++) {
        let i = y * W + x0;
        for (let x = x0; x < x1; x++, i++) {
          const m = mask[i];
          if (m <= 0) continue;
          mask[i] = 0;
          const w0 = wax[i];
          const thr = (1 - tooth[i]) * rough + (ih(x, y, sd) - 0.5) * speck;
          let a = (m * (1 + fill * w0) - thr + soft) * i2s;
          if (a <= 0) continue;
          a = a >= 1 ? 1 : a * a * (3 - 2 * a);
          a *= opac * (1 - resist * w0);
          if (a < 0.004) continue;
          const j = i * 3, ur = rgb[j], ug = rgb[j + 1], ub = rgb[j + 2];
          rgb[j] = ur + (cr * (cov + GL * ur) - ur) * a;
          rgb[j + 1] = ug + (cg * (cov + GL * ug) - ug) * a;
          rgb[j + 2] = ub + (cb * (cov + GL * ub) - ub) * a;
          wax[i] = w0 + (1 - w0) * a * body;
        }
      }
    }
    this.tn = 0;
  };

  // A fingertip dragged along a path: what is there gets carried a little way and pushed into the paper.
  P.smudge = function (xy, rdu, strength, carry) {
    const S = this.S, W = this.W, H = this.H, rgb = this.rgb, tooth = this.tooth;
    const r = Math.max(1.5, rdu * S), n = xy.length >> 1, r2 = r * r;
    const stride = Math.max(1, Math.floor(r / 7));
    carry = carry === undefined ? 0.6 : carry;
    let kr = 0, kg = 0, kb = 0, have = false, lx = -1e9, ly = -1e9;
    for (let i = 0; i < n; i++) {
      const cx = xy[i * 2] * S, cy = xy[i * 2 + 1] * S;
      if (Math.hypot(cx - lx, cy - ly) < r * 0.35 && i < n - 1) continue;
      lx = cx; ly = cy;
      let x0 = Math.floor(cx - r), x1 = Math.ceil(cx + r), y0 = Math.floor(cy - r), y1 = Math.ceil(cy + r);
      if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 > W - 1) x1 = W - 1; if (y1 > H - 1) y1 = H - 1;
      if (x0 > x1 || y0 > y1) continue;
      let sr = 0, sg = 0, sb = 0, sw = 0;
      for (let y = y0; y <= y1; y += stride) for (let x = x0; x <= x1; x += stride) {
        const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy > r2) continue;
        const j = (y * W + x) * 3; sr += rgb[j]; sg += rgb[j + 1]; sb += rgb[j + 2]; sw++;
      }
      if (!sw) continue;
      sr /= sw; sg /= sw; sb /= sw;
      if (!have) { kr = sr; kg = sg; kb = sb; have = true; }
      else { kr += (sr - kr) * (1 - carry); kg += (sg - kg) * (1 - carry); kb += (sb - kb) * (1 - carry); }
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy, d2 = (dx * dx + dy * dy) / r2; if (d2 >= 1) continue;
        const i2 = y * W + x, j = i2 * 3;
        let f = 1 - d2; f = f * f * strength * (0.55 + 0.45 * tooth[i2]);
        rgb[j] += (kr - rgb[j]) * f; rgb[j + 1] += (kg - rgb[j + 1]) * f; rgb[j + 2] += (kb - rgb[j + 2]) * f;
      }
    }
  };

  // Hold the sheet under a window: the tooth and the wax catch a little light. Returns RGB bytes.
  P.finish = function () {
    const W = this.W, H = this.H, rgb = this.rgb, tooth = this.tooth, wax = this.wax, sd = this.seed;
    const out = new Uint8Array(W * H * 3);
    for (let y = 0; y < H; y++) {
      const ym = y > 0 ? y - 1 : y, yp = y < H - 1 ? y + 1 : y;
      for (let x = 0; x < W; x++) {
        const xm = x > 0 ? x - 1 : x, xp = x < W - 1 ? x + 1 : x;
        const i = y * W + x, j = i * 3, w = wax[i];
        const kT = 0.085, kW = 0.10;
        const hl = tooth[y * W + xm] * (kT + kW * wax[y * W + xm]), hr = tooth[y * W + xp] * (kT + kW * wax[y * W + xp]);
        const hu = tooth[ym * W + x] * (kT + kW * wax[ym * W + x]), hd = tooth[yp * W + x] * (kT + kW * wax[yp * W + x]);
        let sh = 1 + ((hl - hr) * 0.6 + (hu - hd) * 0.8) * (0.55 + 0.45 * w);
        sh *= 1 + (ih(x, y, sd + 99) - 0.5) * 0.03;
        const r = rgb[j] * sh, g = rgb[j + 1] * sh, b = rgb[j + 2] * sh;
        out[j] = r <= 0 ? 0 : r >= 1 ? 255 : (r * 255 + 0.5) | 0;
        out[j + 1] = g <= 0 ? 0 : g >= 1 ? 255 : (g * 255 + 0.5) | 0;
        out[j + 2] = b <= 0 ? 0 : b >= 1 ? 255 : (b * 255 + 0.5) | 0;
      }
    }
    return out;
  };

  // ------------------------------------------------------------------ the tin
  // rough: how much the tooth resists; soft: softness of that threshold; opac: covering power per pass;
  // trans: 0 covers, 1 glazes (multiplies with what is underneath); fill: how much earlier wax helps the
  // next layer into the hollows; stri/gap: streaks from the worn face of the stick; round: point or flat;
  // body: how much wax a pass leaves behind; resist: how badly it skids on wax already there.
  A.TOOL = {
    crayon:  { rough: 0.84, soft: 0.20, opac: 0.90, trans: 0.30, fill: 0.55, stri: 0.55, gap: 0.14, edge: 0.35, round: 0.10, speck: 0.22, body: 0.50, resist: 0.00 },
    crayonTip: { rough: 0.80, soft: 0.20, opac: 0.92, trans: 0.25, fill: 0.55, stri: 0.30, gap: 0.05, edge: 0.40, round: 0.45, speck: 0.20, body: 0.55, resist: 0.00 },
    pencil:  { rough: 0.84, soft: 0.30, opac: 0.80, trans: 0.72, fill: 0.20, stri: 0.00, gap: 0.00, edge: 0.50, round: 0.80, speck: 0.30, body: 0.10, resist: 0.30 },
    graphite: { rough: 0.82, soft: 0.34, opac: 0.66, trans: 0.85, fill: 0.15, stri: 0.00, gap: 0.00, edge: 0.55, round: 0.80, speck: 0.32, body: 0.04, resist: 0.45 },
    chalk:   { rough: 0.90, soft: 0.26, opac: 0.92, trans: 0.00, fill: 0.30, stri: 0.45, gap: 0.10, edge: 0.50, round: 0.20, speck: 0.34, body: 0.12, resist: 0.12 },
    lumber:  { rough: 0.74, soft: 0.17, opac: 0.96, trans: 0.12, fill: 0.70, stri: 0.40, gap: 0.08, edge: 0.28, round: 0.20, speck: 0.14, body: 0.75, resist: 0.00 },
  };

  // ------------------------------------------------------------------ the hand
  // Catmull-Rom through control points -> dense polyline
  A.curve = function (xy, per) {
    const n = xy.length >> 1, out = [];
    per = per || 10;
    for (let i = 0; i < n - 1; i++) {
      const i0 = i > 0 ? i - 1 : 0, i3 = i + 2 < n ? i + 2 : n - 1;
      const x0 = xy[i0 * 2], y0 = xy[i0 * 2 + 1], x1 = xy[i * 2], y1 = xy[i * 2 + 1], x2 = xy[i * 2 + 2], y2 = xy[i * 2 + 3], x3 = xy[i3 * 2], y3 = xy[i3 * 2 + 1];
      for (let k = 0; k < per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t;
        out.push(0.5 * (2 * x1 + (x2 - x0) * t + (2 * x0 - 5 * x1 + 4 * x2 - x3) * t2 + (3 * x1 - x0 - 3 * x2 + x3) * t3),
          0.5 * (2 * y1 + (y2 - y0) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 + (3 * y1 - y0 - 3 * y2 + y3) * t3));
      }
    }
    out.push(xy[n * 2 - 2], xy[n * 2 - 1]);
    return out;
  };
  // A polyline as a hand would actually draw it: it drifts, trembles, presses and lets go.
  // o: step, wob (drift, du), wl (drift wavelength), trem (fine tremor), a0/a1 (attack/release fraction),
  // pe (pressure at the ends), pj (pressure wander), wj (width wander)
  A.hand = function (rng, xy, o) {
    o = o || {};
    const step = o.step || 4, wob = o.wob === undefined ? 0.8 : o.wob, wl = o.wl || 60, trem = o.trem === undefined ? 0.12 : o.trem;
    const a0 = o.a0 === undefined ? 0.12 : o.a0, a1 = o.a1 === undefined ? 0.16 : o.a1, pe = o.pe === undefined ? 0.4 : o.pe;
    const pj = o.pj === undefined ? 0.25 : o.pj, wj = o.wj === undefined ? 0.12 : o.wj;
    const n = xy.length >> 1, out = [];
    const s1 = Math.floor(rng() * 1e6), ph = rng() * 1000;
    let tot = 0;
    for (let i = 1; i < n; i++) tot += Math.hypot(xy[i * 2] - xy[i * 2 - 2], xy[i * 2 + 1] - xy[i * 2 - 1]);
    if (tot < 1e-6) { out.push(xy[0], xy[1], 1, 1); return out; }
    const m = Math.max(2, Math.ceil(tot / step) + 1);
    let seg = 1, acc = 0, sl = Math.hypot(xy[2] - xy[0], xy[3] - xy[1]);
    for (let k = 0; k < m; k++) {
      const s = tot * k / (m - 1);
      while (seg < n - 1 && s > acc + sl) { acc += sl; seg++; sl = Math.hypot(xy[seg * 2] - xy[seg * 2 - 2], xy[seg * 2 + 1] - xy[seg * 2 - 1]); }
      const f = sl > 1e-9 ? clamp((s - acc) / sl, 0, 1) : 0;
      const ax = xy[seg * 2 - 2], ay = xy[seg * 2 - 1], bx = xy[seg * 2], by = xy[seg * 2 + 1];
      let x = ax + (bx - ax) * f, y = ay + (by - ay) * f;
      const nx = -(by - ay) / (sl || 1), ny = (bx - ax) / (sl || 1);
      const w = wob * ((vn(s / wl + ph, 2.3, s1) - 0.5) * 2 + (vn(s / (wl * 0.27) + ph, 9.1, s1) - 0.5) * 0.6) + trem * (vn(s / 2.2 + ph, 4.4, s1) - 0.5) * 2;
      x += nx * w; y += ny * w;
      const u = k / (m - 1);
      let env = 1;
      if (u < a0) env = pe + (1 - pe) * (u / a0); else if (u > 1 - a1) env = pe + (1 - pe) * ((1 - u) / a1);
      const p = env * (1 + pj * (vn(s / 19 + ph, 1.7, s1) - 0.5) * 2);
      const ww = (0.72 + 0.28 * env) * (1 + wj * (vn(s / 27 + ph, 6.3, s1) - 0.5) * 2);
      out.push(x, y, p, ww);
    }
    return out;
  };
  // draw a polyline with a tool:  C.line(rng, tool, col, xy, width, press, handOpts)
  P.line = function (rng, T, col, xy, w, p, o) { this.stroke(A.hand(rng, xy, o), T, col, w, p); };
  // a single dab
  P.dab = function (T, col, x, y, w, p) { this.stroke([x, y, 1, 1], T, col, w, p); };

  // ------------------------------------------------------------------ shapes to colour in
  A.poly = function (pts) { // pts flat [x,y,...]
    const n = pts.length >> 1;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < n; i++) { const x = pts[i * 2], y = pts[i * 2 + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return {
      bbox: [x0, y0, x1, y1], pts,
      inside: function (x, y) {
        let c = false;
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const xi = pts[i * 2], yi = pts[i * 2 + 1], xj = pts[j * 2], yj = pts[j * 2 + 1];
          if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
        }
        return c;
      },
    };
  };
  A.region = (bbox, inside) => ({ bbox, inside });

  // Colour a shape in the way a child (or anybody, really) does: back and forth without lifting, turning
  // near the edge, missing it or going over it, lifting now and then, and losing interest in places.
  // o: tool, col | colAt(x,y) -> col|null, w, p, ang, gap, over, under, wob, run (rows before a lift), skip, ds
  A.scribble = function (C, rng, reg, o) {
    const T = o.tool || A.TOOL.crayon, ang = o.ang || 0, gap = o.gap || 6, w = o.w || 8, p = o.p === undefined ? 0.8 : o.p;
    const over = o.over === undefined ? 3 : o.over, under = o.under === undefined ? 3 : o.under;
    const ds = o.ds || Math.max(2, gap * 0.5), skip = o.skip || 0, runMax = o.run || 9;
    const ca = Math.cos(ang), sa = Math.sin(ang), b = reg.bbox;
    if (!(b[2] - b[0] >= 0) || !(b[3] - b[1] >= 0) || b[2] - b[0] > 5000) return;
    let tmin = 1e9, tmax = -1e9, smin = 1e9, smax = -1e9;
    for (let k = 0; k < 4; k++) {
      const x = k & 1 ? b[2] : b[0], y = k & 2 ? b[3] : b[1];
      const s = x * ca + y * sa, t = -x * sa + y * ca;
      if (s < smin) smin = s; if (s > smax) smax = s; if (t < tmin) tmin = t; if (t > tmax) tmax = t;
    }
    let cur = null, rows = 0, flip = rng() < 0.5, runLen = rng.i(3, runMax);
    const hopt = { step: o.step || 4, wob: o.wob === undefined ? 0.7 : o.wob, wl: 40, trem: o.trem === undefined ? 0.15 : o.trem, pe: 0.75, a0: 0.04, a1: 0.05, pj: o.pj === undefined ? 0.3 : o.pj, wj: 0.15 };
    const flush = () => {
      if (cur && cur.length >= 4) {
        let col = o.col;
        if (o.colAt) { const m = (cur.length >> 2) * 2; col = o.colAt(cur[m], cur[m + 1], rng); }
        if (col) C.stroke(A.hand(rng, cur, hopt), T, col, w * (0.85 + 0.3 * rng()), p * (0.8 + 0.4 * rng()));
      }
      cur = null; rows = 0; runLen = rng.i(3, runMax);
    };
    for (let t = tmin + rng() * gap; t < tmax; t += gap * (0.65 + 0.7 * rng())) {
      let s0 = null;
      const tilt = rng.g() * 0.05;
      for (let s = smin; s <= smax + ds; s += ds) {
        const tt = t + (s - (smin + smax) / 2) * tilt;
        const x = s * ca - tt * sa, y = s * sa + tt * ca;
        const inn = s <= smax && reg.inside(x, y);
        if (inn && s0 === null) s0 = s;
        else if (!inn && s0 !== null) {
          let e0 = s0 - rng.r(-under, over), e1 = s - ds + rng.r(-under, over);
          s0 = null;
          if (e1 - e0 < 1.5) continue;
          if (rng() < skip) { flush(); continue; }
          flip = !flip;
          const sa0 = flip ? e1 : e0, sb0 = flip ? e0 : e1;
          const ta = t + (sa0 - (smin + smax) / 2) * tilt, tb = t + (sb0 - (smin + smax) / 2) * tilt + rng.g() * gap * 0.18;
          const xa = sa0 * ca - ta * sa, ya = sa0 * sa + ta * ca, xb = sb0 * ca - tb * sa, yb = sb0 * sa + tb * ca;
          if (cur && rows < runLen && Math.hypot(cur[cur.length - 2] - xa, cur[cur.length - 1] - ya) < gap * 3.2) { cur.push(xa, ya, xb, yb); rows++; }
          else { flush(); cur = [xa, ya, xb, yb]; rows = 1; }
        }
      }
    }
    flush();
  };

  // separate, lifted strokes side by side (a grown-up's hatching)
  A.hatch = function (C, rng, reg, o) {
    const T = o.tool || A.TOOL.pencil, ang = o.ang || 0, gap = o.gap || 4, w = o.w || 1.6, p = o.p === undefined ? 0.7 : o.p;
    const ds = o.ds || 2, seg = o.seg || 0, skip = o.skip || 0, jit = o.jit === undefined ? 0.06 : o.jit;
    const ca0 = Math.cos(ang), sa0 = Math.sin(ang), b = reg.bbox;
    if (!(b[2] - b[0] >= 0) || !(b[3] - b[1] >= 0) || b[2] - b[0] > 5000) return;
    let tmin = 1e9, tmax = -1e9, smin = 1e9, smax = -1e9;
    for (let k = 0; k < 4; k++) {
      const x = k & 1 ? b[2] : b[0], y = k & 2 ? b[3] : b[1];
      const s = x * ca0 + y * sa0, t = -x * sa0 + y * ca0;
      if (s < smin) smin = s; if (s > smax) smax = s; if (t < tmin) tmin = t; if (t > tmax) tmax = t;
    }
    const hopt = { step: 3, wob: o.wob === undefined ? 0.4 : o.wob, wl: 30, trem: 0.1, pe: o.pe === undefined ? 0.25 : o.pe, a0: 0.2, a1: 0.3, pj: 0.3 };
    for (let t = tmin + rng() * gap; t < tmax; t += gap * (0.6 + 0.8 * rng())) {
      let s0 = null;
      const tilt = rng.g() * jit;
      for (let s = smin; s <= smax + ds; s += ds) {
        const tt = t + (s - (smin + smax) / 2) * tilt;
        const x = s * ca0 - tt * sa0, y = s * sa0 + tt * ca0;
        const inn = s <= smax && reg.inside(x, y);
        const cut = seg > 0 && s0 !== null && s - s0 > seg * (0.6 + 0.8 * rng());
        if (inn && s0 === null) s0 = s;
        else if ((!inn || cut) && s0 !== null) {
          const e0 = s0 + rng.r(-1.5, 1.5), e1 = s - ds + rng.r(-1.5, 1.5);
          s0 = inn ? s + rng.r(0, gap) : null;
          if (e1 - e0 < 1.2 || rng() < skip) continue;
          const ta = t + (e0 - (smin + smax) / 2) * tilt, tb = t + (e1 - (smin + smax) / 2) * tilt;
          const xa = e0 * ca0 - ta * sa0, ya = e0 * sa0 + ta * ca0, xb = e1 * ca0 - tb * sa0, yb = e1 * sa0 + tb * ca0;
          let col = o.col;
          if (o.colAt) col = o.colAt((xa + xb) / 2, (ya + yb) / 2, rng);
          if (!col) continue;
          const pts = rng() < 0.5 ? [xa, ya, xb, yb] : [xb, yb, xa, ya];
          C.stroke(A.hand(rng, pts, hopt), T, col, w * (0.8 + 0.4 * rng()), p * (0.75 + 0.5 * rng()));
        }
      }
    }
  };
})(typeof self !== 'undefined' ? self : globalThis);
