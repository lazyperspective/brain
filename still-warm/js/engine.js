// engine.js -- a sheet of toothed paper and five dry tools, in plain JavaScript.
// No canvas API, no SVG, no image library: every mark is pigment caught (or not) on the grain
// of a height-field paper, one pixel at a time.
//
//   the tools:  soft pastel (side of the stick, streaky)   vine charcoal   coloured pencil
//               kaolin chalk   hearth-gold (an invented mica-and-bole pigment that glints)
//   and two things a hand does without a tool:  the rubbing finger, and the eraser.
(function (G) {
  'use strict';
  const ART = G.ART = G.ART || {};

  // ---------- chance ----------
  function rng(seed) {
    let a = seed >>> 0;
    const f = function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    f.r = (lo, hi) => lo + (hi - lo) * f();
    f.i = (lo, hi) => Math.floor(lo + (hi - lo + 1) * f());
    f.g = () => (f() + f() + f() + f() - 2) * 1.732;
    f.pick = arr => arr[Math.floor(f() * arr.length)];
    f.chance = p => f() < p;
    f.fork = () => rng(Math.floor(f() * 4294967296));
    return f;
  }
  function h2(x, y, s) { let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1440662683); n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
  function vn(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y); let fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function fbm(x, y, s, oct) { let v = 0, amp = 0.5, tot = 0; for (let o = 0; o < oct; o++) { v += amp * vn(x, y, s + o * 17); tot += amp; x *= 2.03; y *= 2.03; amp *= 0.5; } return v / tot; }
  function sstep(a, b, x) { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  // ---------- the tools ----------
  // g: how much the paper's tooth decides where pigment lands   soft: softness of that decision
  // op: covering power   opq: 1 = sits on top (pastel), 0 = stains through (pencil wax)
  // fill: how fast it clogs the tooth   fr: how much a clogged tooth stops mattering
  // streak: unevenness of the stick's face   edge: crispness of the stroke's shoulder
  const MED = {
    pastel:  { g: 0.86, soft: 0.14, op: 0.95, opq: 1.00, fill: 0.46, fr: 0.50, streak: 0.36, gr: 0.05, edge: 6, sfu: 1.25, sfv: 0.060, dust: 1.0 },
    conte:   { gr: 0.04, g: 0.95, soft: 0.12, op: 0.90, opq: 0.92, fill: 0.34, fr: 0.45, streak: 0.24, edge: 4, sfu: 1.60, sfv: 0.080, dust: 0.3 },
    char:    { gr: 0.03, g: 1.00, soft: 0.13, op: 0.90, opq: 0.90, fill: 0.30, fr: 0.45, streak: 0.26, edge: 4, sfu: 1.50, sfv: 0.090, dust: 0.6 },
    pencil:  { g: 1.05, soft: 0.20, op: 0.74, opq: 0.34, fill: 0.16, fr: 0.30, streak: 0.10, edge: 2, sfu: 2.00, sfv: 0.100, dust: 0 },
    chalk:   { gr: 0.03, g: 0.88, soft: 0.14, op: 0.92, opq: 1.00, fill: 0.42, fr: 0.50, streak: 0.28, edge: 4, sfu: 1.40, sfv: 0.070, dust: 0.8 },
    gold:    { g: 0.55, soft: 0.16, op: 0.97, opq: 1.00, fill: 0.80, fr: 0.80, streak: 0.14, edge: 4, sfu: 1.40, sfv: 0.080, dust: 0, sparkle: 1 },
    rubber:  { g: 0.70, soft: 0.22, op: 1.00, opq: 1.00, fill: 0.00, fr: 0.00, streak: 0.20, edge: 4, sfu: 0.90, sfv: 0.050, dust: 0 },
  };

  function Sheet(W, H, seed) {
    this.W = W; this.H = H; this.k = W / 1600; this.seed = seed | 0;
    const N = W * H;
    this.col = new Float32Array(N * 3);   // what the eye sees
    this.pap = new Uint8Array(N * 3);     // the bare sheet, kept so the eraser has something to go back to
    this.tooth = new Uint8Array(N);       // height of the paper
    this.load = new Float32Array(N);      // how much pigment already sits there
    this.mask = new Float32Array(N);      // scratch: one stroke's pressure footprint
    this.cap = 0; this._grow(4096);
    this.count = 0; this.sn = 1;
    this.R = rng(seed ^ 0x51ab);
    this._paper(); this._stick();
  }
  Sheet.prototype._grow = function (n) {
    if (n <= this.cap) return; n = Math.max(n, this.cap * 2);
    this.X = new Float32Array(n); this.Y = new Float32Array(n); this.WD = new Float32Array(n); this.PR = new Float32Array(n); this.LL = new Float32Array(n); this.cap = n;
  };

  // ---------- the paper: oat-coloured, laid, fibrous, a little foxed ----------
  Sheet.prototype._paper = function () {
    const W = this.W, H = this.H, k = this.k, s = this.seed, T = this.mask, N = W * H;
    let sum = 0, sum2 = 0;
    for (let y = 0; y < H; y++) {
      const uy = y / k;
      for (let x = 0; x < W; x++) {
        const ux = x / k;
        const grain = vn(ux * 0.80, uy * 0.80, s + 1);
        const grain2 = vn(ux * 2.1 + 11, uy * 2.1 + 5, s + 2);
        const med = vn(ux / 7, uy / 7, s + 3) * 0.65 + vn(ux / 19, uy / 19, s + 4) * 0.35;
        const laid = 0.5 + 0.5 * Math.sin((uy + 3.2 * vn(ux / 90, uy / 40, s + 5)) * 2.15);
        const t = 0.36 * grain + 0.20 * grain2 + 0.17 * med + 0.11 * laid + 0.16 * h2(x, y, s + 6);
        T[y * W + x] = t; sum += t; sum2 += t * t;
      }
    }
    const mean = sum / N, sd = Math.sqrt(sum2 / N - mean * mean), gain = 0.205 / sd;
    const R = rng(s + 99);
    // fibres: raised hairs pressed into the sheet
    const fib = new Float32Array(N), ftint = new Float32Array(N);
    const nf = 1900;
    for (let f = 0; f < nf; f++) {
      let x = R() * 1600, y = R() * 900, a = R() * 6.283; const len = 5 + R() * R() * 46, curl = (R() - 0.5) * 0.16, tint = R() < 0.6 ? -(0.02 + R() * 0.06) : (0.02 + R() * 0.04), hgt = 0.12 + R() * 0.2;
      for (let d = 0; d < len; d += 0.45 / Math.max(1, k * 0.7)) {
        x += Math.cos(a) * 0.45 / Math.max(1, k * 0.7); y += Math.sin(a) * 0.45 / Math.max(1, k * 0.7); a += curl * 0.3 + (R() - 0.5) * 0.12;
        const px = Math.round(x * k), py = Math.round(y * k); if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const i = py * W + px; fib[i] = Math.max(fib[i], hgt); ftint[i] = tint;
      }
    }
    // foxing: small rust blooms
    const fox = [];
    for (let i = 0; i < 70; i++) fox.push([R() * 1600, R() * 900, 1.2 + R() * R() * 7, 0.05 + R() * 0.16]);
    for (let i = 0; i < 26; i++) { const e = R() < 0.5; fox.push([e ? (R() < 0.5 ? R() * 60 : 1600 - R() * 60) : R() * 1600, e ? R() * 900 : (R() < 0.5 ? R() * 50 : 900 - R() * 50), 2 + R() * 9, 0.06 + R() * 0.14]); }
    const base = [0.806, 0.732, 0.640];
    const col = this.col, pap = this.pap, tooth = this.tooth;
    for (let y = 0; y < H; y++) {
      const uy = y / k;
      for (let x = 0; x < W; x++) {
        const ux = x / k, i = y * W + x;
        let t = (T[i] - mean) * gain + 0.5 + fib[i]; t = t < 0 ? 0 : t > 1 ? 1 : t;
        tooth[i] = Math.round(t * 255);
        const mott = fbm(ux / 170, uy / 170, s + 7, 4) - 0.5, mott2 = fbm(ux / 26 + 9, uy / 26, s + 8, 3) - 0.5, hue = fbm(ux / 240 + 3, uy / 240 + 8, s + 9, 3) - 0.5;
        const ed = Math.min(ux, 1600 - ux, uy, 900 - uy);
        const edge = sstep(70, 0, ed + 34 * (vn(ux / 45, uy / 45, s + 10) - 0.5));
        let v = 1 + 0.085 * mott + 0.04 * mott2 + 0.075 * (t - 0.5) + ftint[i] - 0.085 * edge;
        let r = base[0] * v + 0.022 * hue + 0.004 * edge, g = base[1] * v - 0.004 * edge, b = base[2] * v - 0.03 * hue - 0.028 * edge;
        T[i] = 0;
        const j = i * 3; col[j] = r; col[j + 1] = g; col[j + 2] = b;
      }
    }
    for (const f of fox) {
      const cx = f[0] * k, cy = f[1] * k, rr = f[2] * k, al = f[3];
      const x0 = Math.max(0, Math.floor(cx - rr * 1.6)), x1 = Math.min(W - 1, Math.ceil(cx + rr * 1.6)), y0 = Math.max(0, Math.floor(cy - rr * 1.6)), y1 = Math.min(H - 1, Math.ceil(cy + rr * 1.6));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy) / rr + 0.5 * (vn(x / k / 2.2, y / k / 2.2, s + 12) - 0.5);
        if (d >= 1.3) continue; const a = al * (1 - sstep(0.25, 1.3, d)) * (0.7 + 0.6 * h2(x, y, s + 13)); const j = (y * W + x) * 3;
        col[j] += (0.60 - col[j]) * a; col[j + 1] += (0.43 - col[j + 1]) * a; col[j + 2] += (0.27 - col[j + 2]) * a;
      }
    }
    for (let j = 0; j < N * 3; j++) { const c = col[j]; pap[j] = c <= 0 ? 0 : c >= 1 ? 255 : Math.round(c * 255); }
  };

  // the face of a stick: streaks that persist along a stroke
  Sheet.prototype._stick = function () {
    const s = this.seed, T0 = new Float32Array(65536), T = this.stick = new Float32Array(65536);
    for (let u = 0; u < 256; u++) {
      const amp = 0.45 + 0.55 * h2(u, 1, s + 31), off = h2(u, 2, s + 32) * 400, bias = (h2(u, 3, s + 33) - 0.5) * 0.75;
      for (let v = 0; v < 256; v++) T0[u + (v << 8)] = 0.5 + (vn(off + v / 5, u * 0.61, s + 34) - 0.5) * 1.5 * amp + bias + (vn(off + v * 1.3, u * 1.7, s + 35) - 0.5) * 0.4;
    }
    for (let v = 0; v < 256; v++) for (let u = 0; u < 256; u++) {
      const a = T0[((u + 255) & 255) + (v << 8)], b = T0[u + (v << 8)], c = T0[((u + 1) & 255) + (v << 8)];
      T[u + (v << 8)] = clamp(0.22 * a + 0.56 * b + 0.22 * c, 0, 1);
    }
  };

  // ---------- one stroke ----------
  // pts: [x,y, x,y, ...] in sheet units (1600 x 900).  o: { w, c:[r,g,b], m, p, ti, to, pv, wv, cj }
  Sheet.prototype.stroke = function (pts, o) {
    const n = pts.length >> 1; if (n < 2) return;
    this._grow(n);
    const k = this.k, m = o.m, X = this.X, Y = this.Y, WD = this.WD, PR = this.PR, LL = this.LL;
    let hw = (o.w || 1) * k * 0.5, p = o.p === undefined ? 0.6 : o.p;
    if (hw < 0.72) { p *= 0.55 + 0.45 * hw / 0.72; hw = 0.72; }
    let L = 0; X[0] = pts[0] * k; Y[0] = pts[1] * k; LL[0] = 0;
    for (let i = 1; i < n; i++) { X[i] = pts[i * 2] * k; Y[i] = pts[i * 2 + 1] * k; L += Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]); LL[i] = L; }
    if (L < 1e-4) return;
    const ti = o.ti === undefined ? 0.14 : o.ti, to = o.to === undefined ? 0.2 : o.to, pv = o.pv === undefined ? 0.13 : o.pv, wv = o.wv === undefined ? 0.12 : o.wv;
    const s1 = (this.sn++) * 7.77, Lu = 1 / k;
    let hwMax = 0;
    for (let i = 0; i < n; i++) {
      const t = LL[i] / L; let e = 1;
      if (ti > 0 && t < ti) e = 0.3 + 0.7 * (t / ti); if (to > 0 && t > 1 - to) { const e2 = 0.2 + 0.8 * Math.max(0, (1 - t) / to); if (e2 < e) e = e2; }
      PR[i] = p * e * (1 + pv * 2 * (vn(LL[i] * Lu * 0.05 + s1, s1 * 1.3, 91) - 0.5));
      WD[i] = hw * (0.82 + 0.18 * e) * (1 + wv * 2 * (vn(LL[i] * Lu * 0.03 + s1 + 50, 3.3, 92) - 0.5));
      if (WD[i] > hwMax) hwMax = WD[i];
    }
    const bb = this._rast(n, m, (this.R() * 251) | 0);
    if (bb[2] < bb[0]) return;
    let c = o.c;
    if (o.erase) { this._lift(bb, m, o.erase); }
    else {
      const cj = o.cj === undefined ? 0.018 : o.cj;
      if (cj > 0) { const R = this.R, d = (R() - 0.5) * 2 * cj; c = [c[0] + d + (R() - 0.5) * cj, c[1] + d + (R() - 0.5) * cj, c[2] + d + (R() - 0.5) * cj]; }
      this._lay(bb, c, m, o.k === undefined ? 1 : o.k);
      if (m.dust > 0 && hw > 2.2 * k && !o.nodust) this._dust(n, c, m, L);
    }
    this.count++;
  };

  // footprint of the stroke: per pixel, the best pressure any part of the stroke put on it
  Sheet.prototype._rast = function (n, m, sOff) {
    const W = this.W, H = this.H, mask = this.mask, T = this.stick, X = this.X, Y = this.Y, WD = this.WD, PR = this.PR, LL = this.LL;
    const streak = m.streak * 2, en = m.edge, sfu = m.sfu / this.k, sfv = m.sfv / this.k;
    let bx0 = W, by0 = H, bx1 = -1, by1 = -1;
    for (let i = 0; i < n - 1; i++) {
      const x0 = X[i], y0 = Y[i], x1 = X[i + 1], y1 = Y[i + 1], w0 = WD[i], w1 = WD[i + 1], p0 = PR[i], p1 = PR[i + 1];
      const wm = (w0 > w1 ? w0 : w1) + 1;
      let minx = Math.floor((x0 < x1 ? x0 : x1) - wm), maxx = Math.ceil((x0 > x1 ? x0 : x1) + wm), miny = Math.floor((y0 < y1 ? y0 : y1) - wm), maxy = Math.ceil((y0 > y1 ? y0 : y1) + wm);
      if (minx < 0) minx = 0; if (miny < 0) miny = 0; if (maxx >= W) maxx = W - 1; if (maxy >= H) maxy = H - 1;
      if (minx > maxx || miny > maxy) continue;
      if (minx < bx0) bx0 = minx; if (miny < by0) by0 = miny; if (maxx > bx1) bx1 = maxx; if (maxy > by1) by1 = maxy;
      const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy, inv = len2 > 1e-9 ? 1 / len2 : 0, len = Math.sqrt(len2), l0 = LL[i];
      for (let y = miny; y <= maxy; y++) {
        const py = y + 0.5 - y0, row = y * W;
        for (let x = minx; x <= maxx; x++) {
          const px = x + 0.5 - x0;
          let t = (px * dx + py * dy) * inv; if (t < 0) t = 0; else if (t > 1) t = 1;
          const cx = px - t * dx, cy = py - t * dy, d2 = cx * cx + cy * cy, w = w0 + (w1 - w0) * t;
          if (d2 >= w * w) continue;
          const d = Math.sqrt(d2), u = d / w, u2 = u * u;
          const ef = en === 2 ? 1 - u2 : en === 4 ? 1 - u2 * u2 : 1 - u2 * u2 * u2;
          let c = p0 + (p1 - p0) * t;
          if (streak > 0) {
            const sd = (dx * py - dy * px) >= 0 ? d : -d;
            const iu = ((sd * sfu + sOff + 4096) | 0) & 255, v = (l0 + t * len) * sfv, iv = v | 0, fv = v - iv;
            let s = T[iu + ((iv & 255) << 8)]; s += (T[iu + (((iv + 1) & 255) << 8)] - s) * fv;
            c += streak * (s - 0.5);
          }
          c *= ef;
          const idx = row + x; if (c > mask[idx]) mask[idx] = c;
        }
      }
    }
    return [bx0, by0, bx1, by1];
  };

  // pigment meets tooth
  Sheet.prototype._lay = function (bb, c, m, kk) {
    const W = this.W, mask = this.mask, tooth = this.tooth, load = this.load, col = this.col, seed = this.seed;
    const g = m.g, lo = 0.5 - m.soft, inv = 1 / (2 * m.soft), op = m.op * kk, opq = m.opq, fill = m.fill, fr = m.fr, sp = m.sparkle, gr = m.gr || 0;
    const cr = c[0], cg = c[1], cb = c[2];
    for (let y = bb[1]; y <= bb[3]; y++) {
      const row = y * W;
      for (let x = bb[0]; x <= bb[2]; x++) {
        const i = row + x, cv = mask[i]; if (cv <= 0) continue; mask[i] = 0;
        const ld = load[i]; let h = tooth[i] * 0.00392157; h += (0.5 - h) * (ld > 1 ? 1 : ld) * fr;
        let a = (cv + (h - 0.5) * g - lo) * inv; if (a <= 0) continue; if (a > 1) a = 1; a = a * a * (3 - 2 * a) * op;
        const j = i * 3; let r = cr, gg = cg, b = cb;
        if (sp) { // mica: some grains face the light, some turn away
          const hv = h2(x, y, seed + 777);
          if (hv < 0.13 + 0.10 * h) { r = 1.0; gg = 0.955; b = 0.74; } else if (hv > 0.86) { r = cr * 0.62; gg = cg * 0.56; b = cb * 0.45; } else { const q = (hv - 0.5) * 0.16; r += q; gg += q; b += q * 0.5; }
        }
        else if (gr > 0) { const q = (h2(x, y, seed + 555) - 0.5) * 2 * gr; r += q; gg += q; b += q; } // pigment is particles, not a flat film
        const dr = col[j], dg = col[j + 1], db = col[j + 2];
        if (opq >= 1) { col[j] = dr + (r - dr) * a; col[j + 1] = dg + (gg - dg) * a; col[j + 2] = db + (b - db) * a; }
        else {
          const mr = dr * (1 - a * (1 - r)), mg = dg * (1 - a * (1 - gg)), mb = db * (1 - a * (1 - b));
          col[j] = mr + (dr + (r - dr) * a - mr) * opq; col[j + 1] = mg + (dg + (gg - dg) * a - mg) * opq; col[j + 2] = mb + (db + (b - db) * a - mb) * opq;
        }
        load[i] = ld + a * fill;
      }
    }
  };

  // the eraser: takes pigment off the high grain first, leaves a ghost in the valleys
  Sheet.prototype._lift = function (bb, m, strength) {
    const W = this.W, mask = this.mask, tooth = this.tooth, load = this.load, col = this.col, pap = this.pap;
    const g = m.g, lo = 0.5 - m.soft, inv = 1 / (2 * m.soft);
    for (let y = bb[1]; y <= bb[3]; y++) {
      const row = y * W;
      for (let x = bb[0]; x <= bb[2]; x++) {
        const i = row + x, cv = mask[i]; if (cv <= 0) continue; mask[i] = 0;
        const h = tooth[i] * 0.00392157;
        let a = (cv + (h - 0.5) * g - lo) * inv; if (a <= 0) continue; if (a > 1) a = 1; a = a * a * (3 - 2 * a) * strength;
        const j = i * 3;
        col[j] += (pap[j] * 0.00392157 - col[j]) * a; col[j + 1] += (pap[j + 1] * 0.00392157 - col[j + 1]) * a; col[j + 2] += (pap[j + 2] * 0.00392157 - col[j + 2]) * a;
        load[i] *= 1 - a * 0.9;
      }
    }
  };

  // crumbs that fall off a soft stick
  Sheet.prototype._dust = function (n, c, m, L) {
    const R = this.R, k = this.k, W = this.W, H = this.H, col = this.col, X = this.X, Y = this.Y, WD = this.WD;
    const cnt = Math.round(L / k * 0.07 * m.dust * (0.4 + R()));
    for (let q = 0; q < cnt; q++) {
      const i = (R() * (n - 1)) | 0, ang = R() * 6.283, d = WD[i] * (0.9 + R() * R() * 1.6);
      const x = Math.round(X[i] + Math.cos(ang) * d), y = Math.round(Y[i] + Math.sin(ang) * d);
      if (x < 0 || y < 0 || x >= W - 1 || y >= H - 1) continue;
      const a = 0.25 + R() * 0.6, big = k > 1.8 && R() < 0.5 ? 2 : 1;
      for (let yy = 0; yy < big; yy++) for (let xx = 0; xx < big; xx++) { const j = ((y + yy) * W + x + xx) * 3; col[j] += (c[0] - col[j]) * a; col[j + 1] += (c[1] - col[j + 1]) * a; col[j + 2] += (c[2] - col[j + 2]) * a; }
    }
  };

  Sheet.prototype.erase = function (pts, o) { this.stroke(pts, { w: o.w, m: MED.rubber, p: o.p === undefined ? 0.7 : o.p, erase: o.s === undefined ? 0.7 : o.s, ti: o.ti === undefined ? 0.2 : o.ti, to: o.to === undefined ? 0.3 : o.to, pv: 0.25, wv: 0.2 }); };

  // a small firm touch
  Sheet.prototype.dab = function (x, y, r, c, m, p, o) {
    const a = this.R() * 6.283, d = r * 0.35;
    this.stroke([x - Math.cos(a) * d, y - Math.sin(a) * d, x + Math.cos(a) * d, y + Math.sin(a) * d], Object.assign({ w: r * 2, c, m, p: p === undefined ? 0.8 : p, ti: 0, to: 0, pv: 0.05, nodust: true }, o || {}));
  };

  // the finger: carries what it touches a little way along
  Sheet.prototype.smudge = function (pts, r, str, o) {
    const n = pts.length >> 1; if (n < 2) return; o = o || {};
    const k = this.k, W = this.W, H = this.H, col = this.col, tooth = this.tooth, R = this.R, rp = Math.max(1.5, r * k), step = Math.max(1, rp * 0.33), carryRate = o.carry === undefined ? 0.28 : o.carry;
    let tot = 0; for (let i = 1; i < n; i++) tot += Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]) * k;
    let cr = 0, cg = 0, cb = 0, have = false, acc = 0, done = 0;
    for (let i = 1; i < n; i++) {
      const x0 = pts[i * 2 - 2] * k, y0 = pts[i * 2 - 1] * k, x1 = pts[i * 2] * k, y1 = pts[i * 2 + 1] * k, sl = Math.hypot(x1 - x0, y1 - y0); if (sl < 1e-6) continue;
      while (acc <= sl) {
        const t = acc / sl, cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t, tt = (done + acc) / tot;
        let sr = 0, sg = 0, sb = 0, ns = 0;
        for (let q = 0; q < 9; q++) { const a = R() * 6.283, d = Math.sqrt(R()) * rp * 0.7, sx = Math.round(cx + Math.cos(a) * d), sy = Math.round(cy + Math.sin(a) * d); if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue; const j = (sy * W + sx) * 3; sr += col[j]; sg += col[j + 1]; sb += col[j + 2]; ns++; }
        if (ns) { sr /= ns; sg /= ns; sb /= ns; if (!have) { cr = sr; cg = sg; cb = sb; have = true; } else { cr += (sr - cr) * carryRate; cg += (sg - cg) * carryRate; cb += (sb - cb) * carryRate; } }
        if (have) {
          const env = str * Math.min(1, tt / 0.12 + 0.3) * Math.min(1, (1 - tt) / 0.3 + 0.1);
          const xa = Math.max(0, Math.floor(cx - rp)), xb = Math.min(W - 1, Math.ceil(cx + rp)), ya = Math.max(0, Math.floor(cy - rp)), yb = Math.min(H - 1, Math.ceil(cy + rp)), ir2 = 1 / (rp * rp);
          for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
            const d2 = ((x - cx) * (x - cx) + (y - cy) * (y - cy)) * ir2; if (d2 >= 1) continue;
            const i2 = y * W + x; let f = 1 - d2; f = f * f * env * (0.55 + 0.9 * tooth[i2] * 0.00392157); if (f > 1) f = 1;
            const j = i2 * 3; col[j] += (cr - col[j]) * f; col[j + 1] += (cg - col[j + 1]) * f; col[j + 2] += (cb - col[j + 2]) * f;
          }
        }
        acc += step;
      }
      acc -= sl; done += sl;
    }
  };

  Sheet.prototype.at = function (xu, yu) { const x = clamp(Math.round(xu * this.k), 0, this.W - 1), y = clamp(Math.round(yu * this.k), 0, this.H - 1), j = (y * this.W + x) * 3; return [this.col[j], this.col[j + 1], this.col[j + 2]]; };
  Sheet.prototype.lum = function (xu, yu, r) { // average lightness around a point
    const k = this.k, R = this.R; let s = 0, n = 0; r = (r || 3) * k;
    for (let q = 0; q < 7; q++) { const x = clamp(Math.round(xu * k + (R() - 0.5) * 2 * r), 0, this.W - 1), y = clamp(Math.round(yu * k + (R() - 0.5) * 2 * r), 0, this.H - 1), j = (y * this.W + x) * 3; s += 0.3 * this.col[j] + 0.59 * this.col[j + 1] + 0.11 * this.col[j + 2]; n++; }
    return s / n;
  };

  // The photograph of the sheet: raking light from the upper left picks out the tooth.
  Sheet.prototype.finish = function (out, channels) {
    const W = this.W, H = this.H, N = W * H, col = this.col, tooth = this.tooth, load = this.load, ch = channels || 3;
    out = out || new Uint8Array(N * ch);
    for (let y = 0; y < H; y++) {
      const ya = y > 0 ? y - 1 : y, yb = y < H - 1 ? y + 1 : y;
      for (let x = 0; x < W; x++) {
        const xa = x > 0 ? x - 1 : x, xb = x < W - 1 ? x + 1 : x, i = y * W + x;
        const rel = (tooth[ya * W + xa] - tooth[yb * W + xb]) * 0.00392157;
        const ld = load[i], sh = 1 + rel * (0.085 + 0.05 * (ld > 1 ? 1 : ld));
        const j = i * 3, o = i * ch;
        let r = col[j] * sh, g = col[j + 1] * sh, b = col[j + 2] * sh;
        out[o] = r <= 0 ? 0 : r >= 1 ? 255 : (r * 255 + 0.5) | 0; out[o + 1] = g <= 0 ? 0 : g >= 1 ? 255 : (g * 255 + 0.5) | 0; out[o + 2] = b <= 0 ? 0 : b >= 1 ? 255 : (b * 255 + 0.5) | 0;
        if (ch === 4) out[o + 3] = 255;
      }
    }
    return out;
  };

  // ---------- the hand: no line is straight, no curve is the same twice ----------
  const P = {
    line(R, x0, y0, x1, y1, wob, bow, step) {
      const len = Math.hypot(x1 - x0, y1 - y0); if (len < 0.05) return [x0, y0, x1 + 0.05, y1];
      step = step || 4; wob = wob === undefined ? 0.5 : wob; bow = bow === undefined ? 0.025 : bow;
      const n = Math.max(2, Math.ceil(len / step) + 1), nx = -(y1 - y0) / len, ny = (x1 - x0) / len, b = len * bow * R.g(), s = R() * 999, out = new Array(n * 2);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), off = b * Math.sin(Math.PI * t) + wob * ((vn(t * len / 26 + s, 0.5, 77) - 0.5) * 2 + 0.3 * (vn(t * len / 6 + s, 9.1, 78) - 0.5) * 2);
        out[i * 2] = x0 + (x1 - x0) * t + nx * off; out[i * 2 + 1] = y0 + (y1 - y0) * t + ny * off;
      }
      return out;
    },
    // smooth curve through control points [[x,y],...]
    spline(ctrl, step, closed) {
      const n = ctrl.length, out = []; step = step || 4;
      const get = i => closed ? ctrl[((i % n) + n) % n] : ctrl[i < 0 ? 0 : i >= n ? n - 1 : i];
      const segs = closed ? n : n - 1;
      for (let i = 0; i < segs; i++) {
        const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2), d = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), m = Math.max(1, Math.ceil(d / step));
        for (let q = 0; q < m; q++) {
          const t = q / m, t2 = t * t, t3 = t2 * t;
          out.push(0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
                   0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3));
        }
      }
      const e = get(closed ? 0 : n - 1); out.push(e[0], e[1]);
      return out;
    },
    // push a path sideways by a slow tremor
    wob(R, pts, amp, wave) {
      const n = pts.length >> 1, out = new Array(n * 2), s = R() * 999; wave = wave || 28; let L = 0;
      for (let i = 0; i < n; i++) {
        const a = i > 0 ? i - 1 : 0, b = i < n - 1 ? i + 1 : n - 1; let tx = pts[b * 2] - pts[a * 2], ty = pts[b * 2 + 1] - pts[a * 2 + 1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        if (i > 0) L += Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
        const off = amp * ((vn(L / wave + s, 0.5, 79) - 0.5) * 2 + 0.3 * (vn(L / (wave * 0.22) + s, 4.4, 80) - 0.5) * 2);
        out[i * 2] = pts[i * 2] - ty * off; out[i * 2 + 1] = pts[i * 2 + 1] + tx * off;
      }
      return out;
    },
    circle(R, cx, cy, r, turns, wobK, start) {
      turns = turns || 1.08; const a0 = start === undefined ? R() * 6.283 : start, n = Math.max(10, Math.ceil(r * 6.283 * turns / 2.2)), out = [], s = R() * 99, ex = 1 + (R() - 0.5) * 0.14, wk = wobK === undefined ? 0.06 : wobK;
      for (let i = 0; i <= n; i++) { const t = i / n, a = a0 + t * turns * 6.283, rr = r * (1 + wk * (vn(a * 1.1 + s, 2.2, 81) - 0.5) * 2 + 0.035 * t); out.push(cx + Math.cos(a) * rr * ex, cy + Math.sin(a) * rr / ex); }
      return out;
    },
    len(pts) { let L = 0; for (let i = 2; i < pts.length; i += 2) L += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]); return L; },
  };

  ART.rng = rng; ART.h2 = h2; ART.vn = vn; ART.fbm = fbm; ART.sstep = sstep; ART.clamp = clamp; ART.mix = mix;
  ART.MED = MED; ART.Sheet = Sheet; ART.P = P; ART.S = ART.S || {};
})(typeof self !== 'undefined' ? self : globalThis);
