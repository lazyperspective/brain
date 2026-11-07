// Two Weathers: builds the painting as maps (surface height, albedo, gloss, field masks) by simulating the
// painter's layers on a linen weave: stained ground, scumbled underlayers, broad body strokes, glazes,
// palette-knife and loaded-brush impasto, dry-brush scumbles over the relief, glazes pooling in recesses, drips.
// All lengths are in design units (the 2160 px wide master); heights are in design px.
(function (root) {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  function sm(e0, e1, x) { let t = (x - e0) / (e1 - e0); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function lin(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  }
  const TAU0 = Math.PI * 2;
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // ---- noise ----------------------------------------------------------------------------------------------
  function Noise2(rng) { const T = new Float32Array(65536); for (let i = 0; i < 65536; i++) T[i] = rng() * 2 - 1; return T; }
  function vn(T, x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    let fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const x0 = xi & 255, y0 = (yi & 255) << 8, x1 = (x0 + 1) & 255, y1 = ((yi + 1) & 255) << 8;
    const a = T[y0 + x0], b = T[y0 + x1], c = T[y1 + x0], d = T[y1 + x1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  const VN = (T, x, y) => vn(T, x, y);
  function fbm(T, x, y, oct, lac, gain) {
    let s = 0, a = 1, n = 0, f = 1;
    for (let o = 0; o < oct; o++) {
      const c = Math.cos(o * 1.7), si = Math.sin(o * 1.7);
      s += a * vn(T, (x * c - y * si) * f + o * 31.7, (x * si + y * c) * f + o * 17.3);
      n += a; a *= gain; f *= lac;
    }
    return s / n;
  }
  // 1D tables
  const TL = 8192;
  function lineTable(rng, scales) { // smooth 1D noise in [-1,1]
    const T = new Float32Array(TL);
    for (const [period, amp] of scales) {
      const n = Math.max(2, Math.round(TL / period)), k = new Float32Array(n + 1);
      for (let i = 0; i < n; i++) k[i] = rng() * 2 - 1;
      k[n] = k[0];
      for (let i = 0; i < TL; i++) { const x = (i / TL) * n, j = Math.floor(x); let f = x - j; f = f * f * (3 - 2 * f); T[i] += amp * (k[j] + (k[j + 1] - k[j]) * f); }
    }
    let m = 0; for (let i = 0; i < TL; i++) m = Math.max(m, Math.abs(T[i]));
    for (let i = 0; i < TL; i++) T[i] /= m;
    return T;
  }
  function bristleTable(rng, spacing, gapP, clump) { // bristle load across a brush, in [0,1]; x unit = design px * bscale
    const T = new Float32Array(TL);
    const cl = lineTable(rng, [[spacing * 9, 1], [spacing * 4, 0.5]]);
    for (let c = 0; c < TL; c += spacing * (0.6 + 0.8 * rng())) {
      const load = rng() < gapP ? 0.15 * rng() : 0.35 + 0.65 * rng();
      const w = spacing * (0.3 + 0.45 * rng());
      for (let i = Math.floor(c - 3 * w); i <= Math.ceil(c + 3 * w); i++) { const d = (i - c) / w; T[(i + TL) % TL] += load * Math.exp(-d * d); }
    }
    let m = 0; for (let i = 0; i < TL; i++) { T[i] *= 1 + clump * cl[i]; m = Math.max(m, T[i]); }
    for (let i = 0; i < TL; i++) T[i] = clamp(T[i] / m, 0, 1);
    return T;
  }
  function tab(T, x) { x = x % TL; if (x < 0) x += TL; const i = x | 0, f = x - i; return T[i] + (T[(i + 1) & (TL - 1)] - T[i]) * f; }

  // ---- the painter ----------------------------------------------------------------------------------------
  function Painter(W, H, seed) {
    this.W = W; this.H = H; this.s = W / 2160; this.DH = H / this.s;
    this.rng = mulberry32(seed);
    const N = W * H;
    this.h = new Float32Array(N);
    this.col = new Float32Array(N * 3);
    this.gloss = new Float32Array(N);
    this.tooth = new Float32Array(N);
    this.grain = new Float32Array(N);
    this.wdev = new Float32Array(N);
    this.fieldW = [new Float32Array(N), new Float32Array(N), new Float32Array(N)]; // breath weights (red, blue, ember)
    this.N2 = [Noise2(this.rng), Noise2(this.rng), Noise2(this.rng), Noise2(this.rng)];
    this.lines = []; for (let i = 0; i < 24; i++) this.lines.push(lineTable(this.rng, [[900, 1], [260, 0.55], [70, 0.3], [18, 0.12]]));
    this.fine = []; for (let i = 0; i < 8; i++) this.fine.push(lineTable(this.rng, [[60, 1], [14, 0.6], [5, 0.4]]));
    this.bristles = [];
    for (let i = 0; i < 16; i++) this.bristles.push(bristleTable(this.rng, 6 + (i % 4) * 3, 0.12 + 0.05 * (i % 3), 0.5));
  }
  const P = Painter.prototype;
  P.r = function (a, b) { return a + (b - a) * this.rng(); };
  P.pick = function (arr) { return arr[Math.floor(this.rng() * arr.length) % arr.length]; };

  // quarter-res signed-distance maps for the fields (negative inside), sampled bilinearly
  P.makeField = function (sdf) {
    const qs = 4, QW = Math.ceil(this.W / qs) + 2, QH = Math.ceil(this.H / qs) + 2, A = new Float32Array(QW * QH);
    for (let j = 0; j < QH; j++) for (let i = 0; i < QW; i++) A[j * QW + i] = sdf((i * qs) / this.s, (j * qs) / this.s);
    return { A, QW, QH, qs };
  };
  P.fsd = function (F, px, py) {
    const x = px / F.qs, y = py / F.qs, i = x | 0, j = y | 0, fx = x - i, fy = y - j, o = j * F.QW + i, A = F.A;
    return A[o] + (A[o + 1] - A[o]) * fx + (A[o + F.QW] - A[o]) * fy + (A[o] - A[o + 1] - A[o + F.QW] + A[o + F.QW + 1]) * fx * fy;
  };

  // ---- canvas -------------------------------------------------------------------------------------------
  P.weave = function () {
    const { W, H, s } = this, T = this.N2[0], T2 = this.N2[1];
    const per = 5.4; // design px per thread
    const nT = 2048, thW = new Float32Array(nT), thF = new Float32Array(nT), thC = new Float32Array(nT), thD = new Float32Array(nT);
    for (let i = 0; i < nT; i++) { thW[i] = 0.72 + 0.28 * this.rng(); thF[i] = 0.7 + 0.3 * this.rng(); thC[i] = this.rng() * 2 - 1; thD[i] = this.rng() * 2 - 1; }
    const linen = lin('#a99777'), amp = 0.5;
    let sum = 0;
    for (let y = 0; y < H; y++) {
      const dy = y / s;
      for (let x = 0; x < W; x++) {
        const dx = x / s, k = y * W + x;
        // warp (vertical threads) with slow lateral wander, weft (horizontal) likewise
        const xw = dx + 1.6 * vn(T, dx / 300, dy / 90) + 0.6 * vn(T2, dx / 40, dy / 25) + 1.1 * vn(T2, dx / 13 + 300, dy / 160);
        const yw = dy + 1.6 * vn(T, dx / 90 + 50, dy / 300) + 0.6 * vn(T2, dx / 25 + 70, dy / 40) + 1.1 * vn(T2, dx / 160 + 600, dy / 13);
        const u = xw / per, v = yw / per, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
        const ii = i & (nT - 1), jj = (j + 997) & (nT - 1);
        // slubs: slow swelling along a thread
        const slA = 1 + 0.28 * vn(T2, i * 3.17, dy / 55) + 0.12 * vn(T, i * 1.3 + 9, dy / 12);
        const slB = 1 + 0.28 * vn(T2, dx / 55, j * 3.17 + 40) + 0.12 * vn(T, dx / 12, j * 1.3 + 9);
        const wa = thW[ii] * slA, wb = thW[jj] * slB;
        const ca = (2 * fu - 1) / wa, cb = (2 * fv - 1) / wb;
        const aa = ca * ca < 1 ? Math.sqrt(1 - ca * ca) : 0, ab = cb * cb < 1 ? Math.sqrt(1 - cb * cb) : 0;
        const za = 0.5 + 0.5 * Math.cos(Math.PI * (v - 0.5 + (i & 1))), zb = 0.5 - 0.5 * Math.cos(Math.PI * (u - 0.5 + (j & 1)));
        const ha = aa * (0.35 + 0.65 * za) * thF[ii] * Math.min(1.25, slA), hb = ab * (0.35 + 0.65 * zb) * thF[jj] * Math.min(1.25, slB);
        let hh, tc;
        if (ha >= hb) { hh = ha; tc = thC[ii] * 0.06 + 0.05 * vn(T, i * 5.1, dy / 6); } else { hh = hb; tc = thC[jj] * 0.06 + 0.05 * vn(T, dx / 6, j * 5.1); }
        hh = hh * amp;
        this.h[k] = hh; sum += hh;
        // linen colour: per-thread tone, darker in the interstices
        const shade = (0.8 + 0.2 * Math.min(1, hh / (0.55 * amp))) * (1 + tc);
        this.col[k * 3] = linen[0] * shade; this.col[k * 3 + 1] = linen[1] * shade; this.col[k * 3 + 2] = linen[2] * shade * 0.97;
      }
    }
    const mean = sum / (W * H);
    for (let k = 0; k < W * H; k++) { this.wdev[k] = (this.h[k] - mean) / amp; this.tooth[k] = clamp(this.wdev[k] * 1.6, -1, 1); }
    // pigment / film grain: lightly blurred white noise in [-1,1]
    const g = this.grain, r = this.rng;
    for (let k = 0; k < W * H; k++) g[k] = r() * 2 - 1;
    this.blur(g, 1, 1);
    let m = 0; for (let k = 0; k < W * H; k += 7) m += g[k] * g[k];
    m = Math.sqrt(m / (W * H / 7)); for (let k = 0; k < W * H; k++) g[k] = clamp(g[k] / (2.2 * m), -1, 1);
  };

  // separable box blur (passes x radius r, in place)
  P.blur = function (A, r, passes) {
    const { W, H } = this, tmp = new Float32Array(Math.max(W, H));
    for (let p = 0; p < passes; p++) {
      for (let y = 0; y < H; y++) {
        const o = y * W; let acc = 0;
        for (let x = -r; x <= r; x++) acc += A[o + clamp(x, 0, W - 1)];
        for (let x = 0; x < W; x++) { tmp[x] = acc / (2 * r + 1); acc += A[o + Math.min(W - 1, x + r + 1)] - A[o + Math.max(0, x - r)]; }
        for (let x = 0; x < W; x++) A[o + x] = tmp[x];
      }
      for (let x = 0; x < W; x++) {
        let acc = 0;
        for (let y = -r; y <= r; y++) acc += A[clamp(y, 0, H - 1) * W + x];
        for (let y = 0; y < H; y++) { tmp[y] = acc / (2 * r + 1); acc += A[Math.min(H - 1, y + r + 1) * W + x] - A[Math.max(0, y - r) * W + x]; }
        for (let y = 0; y < H; y++) A[y * W + x] = tmp[y];
      }
    }
  };

  // tooth: local relief of the current surface, normalised to about [-1, 1]
  P.retooth = function (r, scale) {
    const B = Float32Array.from(this.h);
    this.blur(B, Math.max(1, Math.round(r * this.s)), 2);
    for (let k = 0; k < B.length; k++) this.tooth[k] = clamp((this.h[k] - B[k]) / scale, -1, 1);
  };

  // ---- a brush stroke (thin to medium paint) --------------------------------------------------------------
  // o: cx, cy, ang, L, w, curve, col, col2, mix, mode ('over' | 'glaze'), op, thick, load, decay, dry, field
  //    {F, off, fi, fo}, gloss, gk, bt (bristle table index), bs (bristle scale), rim (tide line), lev
  P.brush = function (o) {
    const { W, H, s } = this, h = this.h, col = this.col, gl = this.gloss, tooth = this.tooth, grain = this.grain, wdev = this.wdev;
    const ca = Math.cos(o.ang), sa = Math.sin(o.ang), L = o.L, hw = o.w / 2;
    const bt = this.bristles[o.bt === undefined ? Math.floor(this.rng() * 16) : o.bt], bs = o.bs || 1, boff = this.rng() * TL;
    const e1 = this.lines[Math.floor(this.rng() * 24)], e2 = this.lines[Math.floor(this.rng() * 24)], eo = this.rng() * TL;
    const fl = this.fine[Math.floor(this.rng() * 8)], fb = this.bristles[Math.floor(this.rng() * 16)], fbo = this.rng() * TL;
    const curve = o.curve || 0, mixA = o.mix || 0, c1 = o.col, c2 = o.col2 || o.col, glaze = o.mode === 'glaze';
    const op = o.op === undefined ? 1 : o.op, thick = o.thick || 0, load0 = o.load === undefined ? 1 : o.load, decay = o.decay || 0;
    const dry = o.dry || 0, rim = o.rim || 0, lev = o.lev === undefined ? 0.3 : o.lev, gk = o.gk || 0, gv = o.gloss || 0;
    const F = o.field, foff = F ? F.off : 0, ffi = F ? F.fi : 1, ffo = F ? F.fo : 1;
    const soft = o.soft === undefined ? 0.3 : o.soft, edgeR = o.edgeR === undefined ? 0.12 : o.edgeR;
    const ex = (L / 2 + 10) , ey = hw * 1.25 + Math.abs(curve) + 10;
    const xs = [], ys = [];
    for (const [a, b] of [[-ex, -ey], [ex, -ey], [-ex, ey], [ex, ey]]) { xs.push(o.cx + a * ca - b * sa); ys.push(o.cy + a * sa + b * ca); }
    const X0 = clamp(Math.floor(Math.min(...xs) * s), 0, W - 1), X1 = clamp(Math.ceil(Math.max(...xs) * s), 0, W - 1);
    const Y0 = clamp(Math.floor(Math.min(...ys) * s), 0, H - 1), Y1 = clamp(Math.ceil(Math.max(...ys) * s), 0, H - 1);
    const sf = soft + 0.12 * dry, lo = 0.5 - sf * 0.5, hi = 0.5 + sf * 0.5;
    for (let y = Y0; y <= Y1; y++) {
      const dy = y / s - o.cy;
      for (let x = X0; x <= X1; x++) {
        const dx = x / s - o.cx;
        const u = dx * ca + dy * sa;
        const un = u / L + 0.5;
        if (un < -0.02 || un > 1.02) continue;
        let v = -dx * sa + dy * ca; const uc = 2 * un - 1; v -= curve * uc * uc;
        const hwl = hw * (1 + 0.1 * tab(e2, u * 0.35 + eo));
        const av = Math.abs(v) / hwl;
        if (av > 1.2) continue;
        const k = y * W + x;
        // ragged shoulders and ends
        const sh = 1 - sm(1 - edgeR - 0.25 * soft, 1 + 0.06 * tab(v > 0 ? e1 : e2, u * 1.3 + eo), av + 0.05 * tab(fl, u * 2 + eo));
        const endN = 0.03 * tab(e1, v * 0.9 + eo);
        const st = sm(-0.02, 0.07, un + endN - 0.03 * av * av), en = sm(1.02, 0.86, un - endN + 0.07 * av * av);
        const br = tab(bt, v * bs * 0.6 + boff + u * 0.004);
        const load = load0 * (1 - decay * un * un);
        let amt = load * sh * st * en * (0.5 + 0.62 * br);
        if (F) {
          const d = this.fsd(F.F, x, y) + foff + 3 * grain[k];
          amt *= 1 - sm(-ffi, ffo, d);
        }
        if (amt <= 0.004) continue;
        const fs = 2 * tab(fb, v * 2.1 + fbo + u * 0.01) - 1;
        const xx = amt + dry * (0.3 * tooth[k] + 0.3 * fs * sm(0.15, 0.6, sh * st * en)) + 0.05 * grain[k] - dry * 0.12;
        let cov = sm(lo, hi, xx);
        if (cov <= 0.002) continue;
        cov *= op;
        const k3 = k * 3;
        if (glaze) {
          const g = cov * (1 + rim * sm(0.55, 0.92, av) * (1 - sm(0.92, 1.05, av)));
          const t = mixA ? sm(0.25, 0.85, br) * mixA : 0;
          const cr = c1[0] + (c2[0] - c1[0]) * t, cg = c1[1] + (c2[1] - c1[1]) * t, cb = c1[2] + (c2[2] - c1[2]) * t;
          const gg = g > 1 ? 1 : g;
          col[k3] *= 1 + (cr - 1) * gg; col[k3 + 1] *= 1 + (cg - 1) * gg; col[k3 + 2] *= 1 + (cb - 1) * gg;
        } else {
          const t = mixA ? sm(0.2, 0.9, br) * mixA : 0;
          col[k3] += (c1[0] + (c2[0] - c1[0]) * t - col[k3]) * cov;
          col[k3 + 1] += (c1[1] + (c2[1] - c1[1]) * t - col[k3 + 1]) * cov;
          col[k3 + 2] += (c1[2] + (c2[2] - c1[2]) * t - col[k3 + 2]) * cov;
        }
        if (thick) h[k] += cov * thick * (0.45 + 0.55 * br - lev * wdev[k]);
        if (gk) gl[k] += (gv - gl[k]) * cov * gk;
      }
    }
  };

  // ---- palette knife drag ---------------------------------------------------------------------------------
  // A slab of paint laid by a blade dragged along u. The plateau is levelled by the blade (with slight flex and
  // fine drag scratches); the long sides are crisp, with paint squeezed out into a ridge on the lower side of the
  // tilted blade; the start is a ragged set-down, and the end breaks up in streaks where the paint gives out,
  // sometimes leaving a lift-off lip.
  // o: cx, cy, ang, L, w, thick, col, col2, mix, run (0..1), tilt (-1..1), ridge, lip, gloss, bend
  P.knife = function (o) {
    const { W, H, s } = this, h = this.h, col = this.col, gl = this.gloss, grain = this.grain, tooth = this.tooth;
    const ca = Math.cos(o.ang), sa = Math.sin(o.ang), L = o.L, hw = o.w / 2;
    const e1 = this.lines[Math.floor(this.rng() * 24)], e2 = this.lines[Math.floor(this.rng() * 24)], eo = this.rng() * TL;
    const ul = this.lines[Math.floor(this.rng() * 24)], uo = this.rng() * TL;
    const fl = this.fine[Math.floor(this.rng() * 8)], fl2 = this.fine[Math.floor(this.rng() * 8)], fo = this.rng() * TL;
    const sk = this.lines[Math.floor(this.rng() * 24)], so = this.rng() * TL;
    const mb = this.bristles[Math.floor(this.rng() * 16)], mo = this.rng() * TL;
    const thick = o.thick, run = o.run === undefined ? 0.7 : o.run, tilt = o.tilt || 0, ridge = o.ridge === undefined ? 0.8 : o.ridge;
    const lip = o.lip === undefined ? 0.6 : o.lip, gv = o.gloss === undefined ? 0.75 : o.gloss, mixA = o.mix || 0;
    const c1 = o.col, c2 = o.col2 || o.col, bend = o.bend || 0, rw = hw * 0.3 + 4;
    const skip = o.skip || 0, NT = this.N2[1], F = o.field;
    const slant0 = this.r(-0.05, 0.05), slant1 = this.r(-0.04, 0.04), chat = this.rng() < 0.4 ? this.r(0.03, 0.08) : 0;
    let base = 0, nb = 0;
    for (let a = -0.45; a <= 0.45; a += 0.05) for (let b = -0.8; b <= 0.8; b += 0.2) {
      const px = Math.round((o.cx + a * L * ca - b * hw * sa) * s), py = Math.round((o.cy + a * L * sa + b * hw * ca) * s);
      if (px >= 0 && py >= 0 && px < W && py < H) { base += h[py * W + px]; nb++; }
    }
    base = nb ? base / nb : 0;
    const ex = L / 2 + 14, ey = hw + rw + Math.abs(bend) + 10;
    const xs = [], ys = [];
    for (const [a, b] of [[-ex, -ey], [ex, -ey], [-ex, ey], [ex, ey]]) { xs.push(o.cx + a * ca - b * sa); ys.push(o.cy + a * sa + b * ca); }
    const X0 = clamp(Math.floor(Math.min(...xs) * s), 0, W - 1), X1 = clamp(Math.ceil(Math.max(...xs) * s), 0, W - 1);
    const Y0 = clamp(Math.floor(Math.min(...ys) * s), 0, H - 1), Y1 = clamp(Math.ceil(Math.max(...ys) * s), 0, H - 1);
    const aa = 0.9; // edge softness, design px
    for (let y = Y0; y <= Y1; y++) {
      const dy = y / s - o.cy;
      for (let x = X0; x <= X1; x++) {
        const dx = x / s - o.cx;
        const u = dx * ca + dy * sa, un = u / L + 0.5;
        if (un < -0.06 || un > 1.06) continue;
        let v = -dx * sa + dy * ca; const uc = 2 * un - 1; v -= bend * uc * uc;
        const side = v > 0 ? 1 : -1, vn = v / hw;
        // blade-width taper at the set-down, slightly ragged long edges
        const hwl = hw * (0.86 + 0.14 * sm(0, 0.12, un)) * (1 + 0.1 * tab(ul, u * 0.6 + uo + 2000)) + 1.6 * tab(side > 0 ? e1 : e2, u * 0.7 + eo) + 0.6 * tab(fl, u * 0.7 + eo);
        const av = Math.abs(v);
        if (av > hwl + rw) continue;
        const k = y * W + x, k3 = k * 3, h0 = h[k];
        // ragged start and end lines
        const st0 = 0.03 + slant0 * vn + 0.03 * (0.5 + 0.5 * tab(e2, v * 0.5 + eo + 900)) + 0.008 * tab(fl, v * 2.2 + eo + 400);
        const end0 = 0.95 + slant1 * vn + 0.04 * tab(e1, v * 0.6 + eo + 1700) + 0.01 * tab(fl, v * 3 + eo);
        const inStart = sm(st0 - 0.012, st0 + 0.012, un);
        if (inStart <= 0 || un > end0 + 0.05) continue;
        // the blade's level: flex along the drag, tilt across, fine scratches from pigment grit
        const zk = base + thick * (1.0 - 0.32 * un + 0.3 * tab(ul, u * 0.25 + uo) + chat * tab(fl, u * 0.4 + fo + 5000) + 0.12 * tab(ul, v * 0.2 + uo + 4000)) + tilt * thick * 0.4 * vn
          + 0.16 * tab(fl2, v * 1.6 + fo) + 0.05 * tab(fl, v * 7 + fo);
        // paint left on the blade: past `run` it gives out gradually, in streaks along the drag, staying longest
        // on the crests of the surface below (islands of paint on the tooth)
        const streak = 0.5 + 0.5 * (0.45 * tab(sk, v * 0.35 + so + u * 0.002) + 0.55 * tab(fl2, v * 0.9 + so + u * 0.004));
        const rem = sm(run - 0.3, run + 0.45, un);
        const fm = F ? 1 - sm(-F.fi, F.fo, this.fsd(F.F, x, y) + F.off) : 1;
        const q = 1 - 1.15 * rem - 0.55 * skip - 1.3 * (1 - fm) + (0.85 + 0.9 * skip) * (streak - 0.5) + 0.16 * VN(NT, u / 34 + so, v / 3.2) + 0.07 * VN(NT, u / 11 + 50, v / 1.6) + 0.02 * grain[k];
        const fill0 = sm(0.32, 0.58, q);
        const film = 0.4 * (1 - rem) * (1 - fill0) * fm; // a thin skin wiped on where the slab broke up
        const mcol = mixA ? sm(0.45, 0.8, tab(mb, v * 0.4 + mo + u * 0.006)) * mixA : 0;
        const cr = c1[0] + (c2[0] - c1[0]) * mcol, cg = c1[1] + (c2[1] - c1[1]) * mcol, cb = c1[2] + (c2[2] - c1[2]) * mcol;
        const lean = 0.5 + 0.5 * tilt * side;
        const rv = (0.35 + 0.65 * (0.5 + 0.5 * tab(e1, u * 0.45 + eo + side * 300))) * lean;
        let nh = h0, a = 0;
        const inside = sm(hwl + aa, hwl - aa, av) * inStart * sm(end0 + 0.008, end0 - 0.008, un);
        if (inside > 0) {
          const gap = zk - h0;
          let fill = fill0, ha;
          if (gap > 0) ha = h0 + gap * fill + 0.12 * thick * film;
          else { fill = Math.max(fill0, 0.3); ha = h0 + gap * 0.7 * (0.4 + 0.6 * fill0); } // scraped down, a thin smear left
          // the crest where paint banks against the long edge on the low side of the blade
          ha += sm(hwl - 4, hwl - 0.3, av) * ridge * thick * rv * fill;
          // lift-off lip: only where paint remained, broken along the blade
          if (lip > 0 && un > 0.8) ha += Math.exp(-(((un - end0 + 0.015) / 0.018) ** 2)) * lip * thick * sm(0.35, 0.75, 0.5 + 0.5 * tab(fl2, v * 0.5 + fo + 3000)) * fill;
          nh = h0 + (ha - h0) * inside; a = Math.min(1, fill + film) * inside;
        }
        if (av > hwl - aa) {
          // paint squeezed past the edge, slumping outward (only where the slab is whole)
          const rt = clamp((av - hwl) / rw, 0, 1);
          const rh = ridge * thick * 0.8 * rv * inStart * sm(end0, end0 - 0.1, un) * fill0;
          const top = h0 + Math.max(0, zk - h0) * fill0 + rh;
          const prof = Math.pow(1 - rt, 2.2) * sm(-0.5, 0.6, (av - hwl + aa));
          const tgt = h0 + (top - h0) * prof;
          if (tgt > nh) { nh = tgt; a = Math.max(a, sm(0.05, 0.45, prof) * sm(0.05, 0.5, rh)); }
        }
        if (a <= 0.001 && nh === h0) continue;
        h[k] = nh;
        col[k3] += (cr - col[k3]) * a; col[k3 + 1] += (cg - col[k3 + 1]) * a; col[k3 + 2] += (cb - col[k3 + 2]) * a;
        gl[k] += (gv - gl[k]) * a;
      }
    }
  };

  // ---- loaded brush impasto ------------------------------------------------------------------------------
  P.impasto = function (o) {
    const { W, H, s } = this, h = this.h, col = this.col, gl = this.gloss, grain = this.grain;
    const ca = Math.cos(o.ang), sa = Math.sin(o.ang), L = o.L, hw = o.w / 2;
    const bt = this.bristles[Math.floor(this.rng() * 16)], boff = this.rng() * TL;
    const e1 = this.lines[Math.floor(this.rng() * 24)], eo = this.rng() * TL;
    const fl = this.fine[Math.floor(this.rng() * 8)];
    const c1 = o.col, c2 = o.col2 || o.col, mixA = o.mix || 0, thick = o.thick, curve = o.curve || 0, gv = o.gloss === undefined ? 0.6 : o.gloss;
    const ex = L / 2 + 10, ey = hw + Math.abs(curve) + 10;
    const xs = [], ys = [];
    for (const [a, b] of [[-ex, -ey], [ex, -ey], [-ex, ey], [ex, ey]]) { xs.push(o.cx + a * ca - b * sa); ys.push(o.cy + a * sa + b * ca); }
    const X0 = clamp(Math.floor(Math.min(...xs) * s), 0, W - 1), X1 = clamp(Math.ceil(Math.max(...xs) * s), 0, W - 1);
    const Y0 = clamp(Math.floor(Math.min(...ys) * s), 0, H - 1), Y1 = clamp(Math.ceil(Math.max(...ys) * s), 0, H - 1);
    for (let y = Y0; y <= Y1; y++) {
      const dy = y / s - o.cy;
      for (let x = X0; x <= X1; x++) {
        const dx = x / s - o.cx;
        const u = dx * ca + dy * sa, un = u / L + 0.5;
        if (un < -0.02 || un > 1.02) continue;
        let v = -dx * sa + dy * ca; const uc = 2 * un - 1; v -= curve * uc * uc;
        const hwl = hw * (1 + 0.08 * tab(e1, u * 0.6 + eo)) * (0.85 + 0.15 * sm(0, 0.12, un));
        const vn2 = v / hwl, av = Math.abs(vn2);
        if (av >= 1) continue;
        const k = y * W + x, k3 = k * 3;
        const br = tab(bt, v * 0.55 + boff + u * 0.006);
        // load along the stroke: a loaded start, then the bristles run dry one by one
        const load = (1 - 0.55 * un) * sm(-0.02, 0.05, un);
        const dryEnd = sm(0.55, 1.0, un);
        const keep = sm(dryEnd * 0.9 - 0.1, dryEnd * 0.9 + 0.08, br + 0.12 * grain[k]);
        const cross = Math.sqrt(1 - av * av);
        const hgt = thick * load * Math.pow(cross, 0.6) * (0.3 + 0.7 * br) * keep;
        const blob = un < 0.12 ? thick * 0.6 * Math.exp(-(((un - 0.03) / 0.045) ** 2)) * cross : 0;
        const a = sm(0, 0.25, hgt + blob) * keep;
        if (a <= 0.002) continue;
        h[k] += hgt + blob;
        const t = mixA ? sm(0.3, 0.85, tab(bt, v * 0.55 + boff + 1700)) * mixA : 0;
        col[k3] += (c1[0] + (c2[0] - c1[0]) * t - col[k3]) * a;
        col[k3 + 1] += (c1[1] + (c2[1] - c1[1]) * t - col[k3 + 1]) * a;
        col[k3 + 2] += (c1[2] + (c2[2] - c1[2]) * t - col[k3 + 2]) * a;
        gl[k] += (gv - gl[k]) * a;
      }
    }
  };

  // ---- drips of thinned paint ----------------------------------------------------------------------------
  // a run of thinned paint: a sag where it leaves the band, a wandering tapering trickle that thins as it goes,
  // and a small swollen bead where it stopped
  P.drip = function (o) {
    const { W, H, s } = this, h = this.h, col = this.col, gl = this.gloss;
    const e = this.lines[Math.floor(this.rng() * 24)], eo = this.rng() * TL, f = this.fine[Math.floor(this.rng() * 8)];
    const L = o.L, w0 = o.w;
    const X0 = clamp(Math.floor((o.x - 40) * s), 0, W - 1), X1 = clamp(Math.ceil((o.x + 40) * s), 0, W - 1);
    const Y0 = clamp(Math.floor((o.y - 10) * s), 0, H - 1), Y1 = clamp(Math.ceil((o.y + L + w0 + 6) * s), 0, H - 1);
    const xc = (d) => o.x + 6 * tab(e, d * 0.5 + eo) * Math.min(1, d / 60) + 1.2 * tab(f, d * 1.5 + eo);
    for (let y = Y0; y <= Y1; y++) {
      const d = y / s - o.y;
      for (let x = X0; x <= X1; x++) {
        const dx = x / s;
        let a = 0, hh = 0;
        if (d >= -8 && d <= L) {
          const sag = Math.exp(-Math.max(0, d) / 14) * 1.6 + (d < 0 ? 0 : 0);
          const wl = (w0 * (1 - 0.6 * Math.max(0, d) / L) * (0.82 + 0.18 * tab(e, d * 1.8 + eo + 500)) * (1 + sag)) / 2;
          const q = (dx - xc(Math.max(0, d))) / wl;
          if (Math.abs(q) < 1) {
            const c = Math.sqrt(1 - q * q);
            hh = o.thick * c; a = sm(0, 0.5, c) * (0.85 - 0.45 * Math.max(0, d) / L) * sm(-8, 4, d);
          }
        }
        const rb = w0 * 0.42, bx = (dx - xc(L)) / (rb * 1.05), by = (d - L) / (rb * 1.25);
        const r2 = bx * bx + by * by;
        if (r2 < 1) { const c = Math.sqrt(1 - r2); hh = Math.max(hh, o.thick * 1.2 * c); a = Math.max(a, sm(0, 0.4, c) * 0.3); }
        if (a <= 0) continue;
        const k = y * W + x, k3 = k * 3;
        h[k] += hh;
        for (let c = 0; c < 3; c++) col[k3 + c] = col[k3 + c] * (1 + (o.glz[c] - 1) * a) * (1 - 0.22 * a) + o.col[c] * 0.22 * a;
        gl[k] += (0.75 - gl[k]) * a;
      }
    }
  };

  // ---- composition -----------------------------------------------------------------------------------------
  function rrect(x, y, x0, y0, x1, y1, r) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, qx = Math.abs(x - cx) - ((x1 - x0) / 2 - r), qy = Math.abs(y - cy) - ((y1 - y0) / 2 - r);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  }

  function buildPainting(W, H, seed, log) {
    const t0 = performance.now();
    const p = new Painter(W, H, seed || 20261107);
    const r = (a, b) => p.r(a, b), N1 = p.N2[2], N2 = p.N2[3];
    const L = (msg) => log && log(msg + ' ' + (performance.now() - t0).toFixed(0) + ' ms');
    p.weave(); L('weave');
    const DH = p.DH; // 2700

    // fields (design units) with irregular, softly wandering edges
    const wob = (x, y, a, sd) => a * (0.65 * fbm(N1, x / 380 + sd, y / 380, 2, 2.1, 0.5) + 0.35 * fbm(N2, x / 90, y / 90 + sd, 2, 2.2, 0.5)) + 2.2 * vn(N2, x / 22 + sd, y / 22);
    const RED = p.makeField((x, y) => rrect(x, y, 152, 150, 2010, 1290, 46) + wob(x, y, 22, 3.1));
    const EMB_Y = (x) => 1398 + 6 * Math.sin(clamp((x - 200) / 1760, 0, 1) * 3.1 + 0.4);
    const EMB_H = (x) => 57 * (0.6 + 0.4 * Math.pow(Math.sin(Math.PI * clamp((x - 200) / 1760, 0, 1)), 0.45));
    const EMB = p.makeField((x, y) => {
      const dx = Math.max(200 - x, x - 1962), dy = Math.abs(y - EMB_Y(x)) - EMB_H(x);
      return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) + wob(x, y, 13, 7.7);
    });
    const BLU = p.makeField((x, y) => rrect(x, y, 150, 1508, 2012, 2512, 46) + wob(x, y, 22, 11.3));
    // the ground glaze works in the margins: outside the fields (positive distance = inside the margin band)
    const CANV = p.makeField((x, y) => -Math.min(rrect(x, y, 152, 150, 2010, 1290, 46), rrect(x, y, 150, 1508, 2012, 2512, 46)) + 20);
    L('fields');

    // palette (linear)
    const C = {};
    for (const [k, v] of Object.entries({
      ground: '#3a0d10', groundW: '#45120f', groundD: '#24080b',
      cadRed: '#7c1c13', cadRedD: '#661610', scarlet: '#8c2514',
      oxA: '#5a1214', oxB: '#4a0f15', oxC: '#661611', oxD: '#360a0f', oxE: '#721a18', crimsonL: '#8e1c26', oxHi: '#82201a',
      alz: '#8a2a3c',
      emberA: '#c8461a', emberB: '#dc6220', emberC: '#a82e16', emberY: '#e3842c', emberR: '#7e1a14',
      violet: '#2e1236', violetR: '#3e1232', plum: '#1f0c26',
      inkA: '#101d42', inkB: '#0b142e', inkC: '#162660', inkD: '#080d22', ultra: '#1b2774', prus: '#0e1d48', bviolet: '#22184c', inkHi: '#22348a',
    })) C[k] = lin(v);
    // glaze transmittances
    const T = {
      stain: [0.4, 0.09, 0.085], stainD: [0.48, 0.16, 0.15],
      alz: [0.78, 0.33, 0.42], crim: [0.7, 0.22, 0.27], madder: [0.82, 0.42, 0.42], umber: [0.62, 0.5, 0.45],
      ultra: [0.42, 0.5, 0.92], prus: [0.34, 0.45, 0.8], indigo: [0.45, 0.5, 0.75], violet: [0.66, 0.42, 0.78],
      orange: [1.0, 0.62, 0.32], gold: [1.0, 0.82, 0.45],
    };
    const fld = (F, off, fi, fo) => ({ F, off, fi, fo });

    // 1. stained ground: broad washes soaked into the linen, with tide lines at their drying edges
    for (let i = 0; i < 18; i++) {
      p.brush({ cx: r(-100, 2260), cy: r(-100, DH + 100), ang: r(-0.5, 0.5) + (i % 3 === 0 ? 1.4 : 0), L: r(1300, 2600), w: r(600, 1100), col: T.stain, col2: T.stainD, mix: 0.5,
        mode: 'glaze', op: r(0.55, 0.85), load: 1, decay: 0.2, soft: 1.0, edgeR: 0.5, rim: 0.1, thick: 0.05, lev: 0.6, bs: 0.3 });
    }
    for (let k = 0; k < W * H; k++) { // complete the soak, deeper in the interstices
      const d = (1 + 0.3 * clamp(-p.wdev[k], 0, 1.5)) * 0.8, t3 = k * 3;
      p.col[t3] *= Math.pow(T.stain[0] * 0.55, d); p.col[t3 + 1] *= Math.pow(T.stain[1] * 0.4, d); p.col[t3 + 2] *= Math.pow(T.stain[2] * 0.42, d);
      p.gloss[k] = 0.04;
    }
    L('stain');
    // ground body: thin scumbled maroon passes, matte
    for (let i = 0; i < 80; i++) {
      p.brush({ cx: r(0, 2160), cy: r(0, DH), ang: r(-0.35, 0.35) + (p.rng() < 0.15 ? Math.PI / 2 : 0), L: r(500, 1300), w: r(200, 400), col: p.pick([C.ground, C.groundW, C.groundD]), col2: C.groundD, mix: 0.5,
        op: r(0.55, 0.85), load: r(0.9, 1.1), decay: 0.45, dry: 0.2, thick: 0.12, soft: 0.75, gloss: 0.08, gk: 0.5 });
    }
    L('ground');

    // 2. underlayers: warmer, lighter paint a little larger than the fields; it glows faintly at the edges
    for (let i = 0; i < 70; i++) {
      p.brush({ cx: r(150, 2010), cy: r(150, 1290), ang: r(-0.25, 0.25), L: r(500, 1100), w: r(160, 300), col: p.pick([C.cadRed, C.cadRedD, C.scarlet, C.oxE]), col2: C.cadRedD, mix: 0.6,
        op: r(0.55, 0.9), load: r(0.85, 1.1), decay: 0.5, dry: 0.6, thick: 0.25, field: fld(RED, -r(0, 14), 30, 40), gloss: 0.15, gk: 0.6 });
    }
    for (let i = 0; i < 70; i++) {
      p.brush({ cx: r(150, 2010), cy: r(1506, 2512), ang: r(-0.25, 0.25), L: r(500, 1100), w: r(160, 300), col: p.pick([C.violet, C.violetR, C.plum, C.violetR]), col2: C.plum, mix: 0.6,
        op: r(0.55, 0.9), load: r(0.85, 1.1), decay: 0.5, dry: 0.6, thick: 0.25, field: fld(BLU, -r(0, 14), 30, 40), gloss: 0.15, gk: 0.6 });
    }
    for (let i = 0; i < 50; i++) {
      const cx = r(220, 1940);
      p.brush({ cx, cy: EMB_Y(cx) + r(-28, 28), ang: r(-0.07, 0.07), L: r(220, 560), w: r(70, 130), soft: 0.7, col: p.pick([C.emberB, C.scarlet, C.emberA, C.emberC]), col2: C.emberY, mix: 0.5,
        op: r(0.6, 0.95), load: r(0.9, 1.1), decay: 0.4, dry: 0.5, thick: 0.25, field: fld(EMB, -r(0, 10), 18, 30), gloss: 0.2, gk: 0.6 });
    }
    L('underlayers');

    // 3. body: broad soft strokes, many hues of the one colour, crossing at low angles
    const redBody = [C.oxA, C.oxB, C.oxA, C.oxB, C.oxC, C.oxA];
    for (let i = 0; i < 210; i++) {
      const cy = r(160, 1280), dark = sm(700, 200, cy);
      p.brush({ cx: r(150, 2010), cy, ang: r(-0.2, 0.2) + (p.rng() < 0.15 ? r(-0.6, 0.6) : 0), L: r(450, 1100), w: r(160, 320), curve: r(-20, 20),
        col: p.rng() < dark * 0.6 ? C.oxD : p.pick(redBody), col2: p.pick(redBody), mix: 0.7,
        op: r(0.35, 0.65), load: r(0.85, 1.1), decay: 0.5, dry: r(0.0, 0.3), soft: 0.6, thick: r(0.2, 0.45), field: fld(RED, r(4, 22), r(36, 56), r(36, 64)), gloss: 0.3, gk: 0.5 });
    }
    const bluBody = [C.inkA, C.inkB, C.inkA, C.inkB, C.prus, C.inkA, C.bviolet];
    for (let i = 0; i < 210; i++) {
      const cy = r(1510, 2500);
      p.brush({ cx: r(150, 2010), cy, ang: r(-0.2, 0.2) + (p.rng() < 0.15 ? r(-0.6, 0.6) : 0), L: r(450, 1100), w: r(160, 320), curve: r(-20, 20),
        col: p.rng() < sm(1900, 2450, cy) * 0.6 ? C.inkD : p.pick(bluBody), col2: p.pick(bluBody), mix: 0.7,
        op: r(0.35, 0.65), load: r(0.85, 1.1), decay: 0.5, dry: r(0.0, 0.3), soft: 0.6, thick: r(0.2, 0.45), field: fld(BLU, r(4, 22), r(36, 56), r(36, 64)), gloss: 0.3, gk: 0.5 });
    }
    for (let i = 0; i < 64; i++) {
      const cx = r(240, 1920);
      p.brush({ cx, cy: EMB_Y(cx) + r(-24, 24), ang: r(-0.07, 0.07), L: r(200, 520), w: r(50, 100), soft: 0.7,
        col: p.pick([C.emberA, C.emberC, C.emberR, C.emberC]), col2: C.emberB, mix: 0.6,
        op: r(0.4, 0.8), load: r(0.8, 1.05), decay: 0.5, dry: r(0.3, 0.7), thick: r(0.25, 0.5), field: fld(EMB, r(0, 16), 26, 36), gloss: 0.35, gk: 0.5 });
    }
    L('body');

    // 4. glazes: transparent, inset from the field edges (the edges keep the warmer glow)
    for (let i = 0; i < 40; i++) {
      const cy = r(160, 1280);
      p.brush({ cx: r(200, 1960), cy, ang: r(-0.2, 0.2), L: r(700, 1500), w: r(250, 450), col: p.pick([T.alz, T.crim, T.madder, T.alz]), col2: T.umber, mix: 0.3,
        mode: 'glaze', op: r(0.25, 0.5) * (0.7 + 0.6 * sm(900, 250, cy)), load: 1, decay: 0.3, soft: 0.8, edgeR: 0.3, thick: 0.06, lev: 0.1, field: fld(RED, r(30, 90), 60, 60), gloss: 0.5, gk: 0.4 });
    }
    for (let i = 0; i < 40; i++) {
      const cy = r(1510, 2500);
      p.brush({ cx: r(200, 1960), cy, ang: r(-0.2, 0.2), L: r(700, 1500), w: r(250, 450), col: p.pick([T.ultra, T.prus, T.indigo]), col2: T.violet, mix: 0.4,
        mode: 'glaze', op: r(0.25, 0.5) * (0.7 + 0.5 * sm(1800, 2450, cy)), load: 1, decay: 0.3, soft: 0.8, edgeR: 0.3, thick: 0.06, lev: 0.1, field: fld(BLU, r(30, 90), 60, 60), gloss: 0.5, gk: 0.4 });
    }
    for (let i = 0; i < 16; i++) { // the margins: a madder glaze so the ground is not flat
      p.brush({ cx: r(0, 2160), cy: r(0, DH), ang: r(-0.3, 0.3) + (i % 2 ? Math.PI / 2 : 0), L: r(900, 2000), w: r(200, 400), col: [0.8, 0.4, 0.42], mode: 'glaze', op: r(0.4, 0.65), soft: 0.9, edgeR: 0.4, rim: 0.12, thick: 0.04, field: fld(CANV, 0, 60, 60) });
    }
    // and along the four margins, deliberately: deeper, cooler crimson where the stain shows
    for (let i = 0; i < 28; i++) {
      const side = i % 4, t = r(0, 1);
      const [cx, cy, ang] = side === 0 ? [r(-40, 120), t * DH, Math.PI / 2 + r(-0.06, 0.06)] : side === 1 ? [r(2040, 2200), t * DH, Math.PI / 2 + r(-0.06, 0.06)]
        : side === 2 ? [t * 2160, r(-40, 110), r(-0.05, 0.05)] : [t * 2160, r(2540, 2720), r(-0.05, 0.05)];
      p.brush({ cx, cy, ang, L: r(700, 1500), w: r(160, 300), col: p.pick([[0.72, 0.42, 0.48], [0.78, 0.5, 0.5], [0.66, 0.4, 0.46]]), mode: 'glaze', op: r(0.35, 0.6),
        soft: 0.9, edgeR: 0.45, rim: 0.1, thick: 0.03, field: fld(CANV, 0, 60, 60) });
    }
    // the band's edges deepen to crimson, so its core burns hotter
    for (let i = 0; i < 22; i++) {
      const cx = r(250, 1910), sd = p.rng() < 0.5 ? -1 : 1;
      p.brush({ cx, cy: EMB_Y(cx) + sd * EMB_H(cx) * r(0.45, 0.85), ang: r(-0.03, 0.03), L: r(300, 800), w: r(50, 84), col: p.pick([T.crim, T.alz, T.madder]),
        mode: 'glaze', op: r(0.25, 0.5), load: 1, decay: 0.3, soft: 0.85, edgeR: 0.4, thick: 0.03, lev: 0, gloss: 0.5, gk: 0.4 });
    }
    L('glazes');
    for (let k = 0; k < W * H; k++) {
      const x = k % W, y = (k / W) | 0;
      p.fieldW[0][k] = 1 - sm(-40, 30, p.fsd(RED, x, y));
      p.fieldW[1][k] = 1 - sm(-40, 30, p.fsd(BLU, x, y));
      p.fieldW[2][k] = 1 - sm(-14, 26, p.fsd(EMB, x, y));
    }

    // 5. impasto: passages of overlapping knife pulls and loaded brushes about the ember band; the outer parts of
    //    the fields stay thin. A pull drags a skin of paint that breaks into streaks; ridges bank at its edges.
    const passage = (n, cx, cy, rx, ry, dir, spread, mk) => {
      for (let i = 0; i < n; i++) {
        const a = p.rng() * TAU0, rr = Math.sqrt(p.rng());
        const x = cx + Math.cos(a) * rx * rr, y = cy + Math.sin(a) * ry * rr;
        mk(x, y, dir + r(-spread, spread) + (p.rng() < 0.5 ? Math.PI : 0), 1 - rr);
      }
    };
    const redK = [C.oxA, C.oxE, C.oxA, C.oxC, C.oxC], redK2 = [C.crimsonL, C.oxHi, C.oxD, C.oxE];
    const bluK = [C.inkA, C.inkB, C.inkA, C.inkC, C.inkA], bluK2 = [C.bviolet, C.inkC, C.ultra, C.inkB];
    // red field, right of centre above the band: knife pulls, mostly level
    passage(16, 1380, 1090, 480, 170, -0.03, 0.1, (x, y, ang, c) => p.knife({ cx: x, cy: y, ang, L: r(380, 900), w: r(70, 180), thick: r(0.7, 1.5) + 1.3 * c,
      col: p.pick(redK), col2: p.pick(redK2), mix: r(0.3, 0.7), run: r(0.5, 1.0), skip: r(0.15, 0.6), tilt: r(-0.9, 0.9), ridge: r(0.5, 1.1), lip: p.rng() < 0.4 ? r(0.3, 0.8) : 0, gloss: 0.72, bend: r(-6, 6), field: fld(RED, r(40, 90), 30, 30) }));
    // red field, left: loaded brush
    passage(16, 640, 1060, 330, 170, -0.12, 0.3, (x, y, ang, c) => p.impasto({ cx: x, cy: y, ang, L: r(220, 480), w: r(40, 76), curve: r(-14, 14), thick: r(1.4, 2.4) + 1.4 * c,
      col: p.pick(redK), col2: p.pick(redK2), mix: 0.6, gloss: 0.62 }));
    // the ember band: long pulls of hot colour with unmixed streaks
    for (let i = 0; i < 16; i++) {
      const cx = r(360, 1800), cy = EMB_Y(cx) + r(-0.4, 0.4) * EMB_H(cx);
      p.knife({ cx, cy, ang: r(-0.02, 0.02) + (p.rng() < 0.5 ? Math.PI : 0), L: r(260, 700), w: r(30, 60), thick: r(1.0, 2.4),
        col: p.pick([C.emberA, C.emberC, C.emberC, C.emberB, C.emberR]), col2: p.pick([C.emberY, C.emberR, C.emberR, C.oxE]), mix: r(0.35, 0.75),
        run: r(0.4, 0.9), skip: r(0.3, 0.75), tilt: r(-0.9, 0.9), ridge: r(0.5, 1.1), lip: p.rng() < 0.4 ? r(0.3, 0.8) : 0, gloss: 0.8, bend: r(-3, 3), field: fld(EMB, r(14, 34), 16, 30) });
    }
    // blue field, upper left: knife pulls; right of it, loaded brush
    passage(14, 660, 1700, 440, 160, 0.03, 0.1, (x, y, ang, c) => p.knife({ cx: x, cy: y, ang, L: r(380, 900), w: r(70, 170), thick: r(0.7, 1.4) + 1.2 * c,
      col: p.pick(bluK), col2: p.pick(bluK2), mix: r(0.2, 0.5), run: r(0.5, 1.0), skip: r(0.25, 0.65), tilt: r(-0.9, 0.9), ridge: r(0.5, 1.1), lip: p.rng() < 0.4 ? r(0.3, 0.8) : 0, gloss: 0.72, bend: r(-6, 6), field: fld(BLU, r(40, 90), 30, 30) }));
    passage(12, 1450, 1720, 330, 150, 0.04, 0.25, (x, y, ang, c) => p.impasto({ cx: x, cy: y, ang, L: r(240, 520), w: r(40, 76), curve: r(-14, 14), thick: r(1.2, 2.2) + 1.2 * c,
      col: p.pick(bluK), col2: p.pick(bluK2), mix: 0.6, gloss: 0.6 }));
    L('impasto');
    // a unifying glaze over each passage: the slabs take the field's depth
    for (let i = 0; i < 10; i++) p.brush({ cx: r(300, 1880), cy: r(820, 1260), ang: r(-0.15, 0.15), L: r(600, 1200), w: r(220, 380), col: p.pick([T.alz, T.crim, T.madder]),
      mode: 'glaze', op: r(0.25, 0.45), load: 1, decay: 0.3, soft: 0.85, edgeR: 0.3, thick: 0.04, lev: 0, field: fld(RED, r(30, 70), 50, 50), gloss: 0.55, gk: 0.4 });
    for (let i = 0; i < 10; i++) p.brush({ cx: r(220, 1850), cy: r(1540, 1950), ang: r(-0.15, 0.15), L: r(600, 1200), w: r(220, 380), col: p.pick([T.ultra, T.indigo, T.violet]),
      mode: 'glaze', op: r(0.3, 0.5), load: 1, decay: 0.3, soft: 0.85, edgeR: 0.3, thick: 0.04, lev: 0, field: fld(BLU, r(30, 70), 50, 50), gloss: 0.55, gk: 0.4 });

    // 6. scumbles over the relief: dry brush catches the crests
    p.retooth(5, 0.9);
    for (let i = 0; i < 22; i++) {
      p.brush({ cx: r(400, 1900), cy: r(700, 1280), ang: r(-0.25, 0.25), L: r(400, 900), w: r(140, 260), col: p.pick([C.crimsonL, C.cadRedD, C.oxE]), col2: C.scarlet, mix: 0.4,
        op: r(0.3, 0.6), load: r(0.4, 0.65), decay: 0.6, dry: 1.5, thick: 0.15, field: fld(RED, r(30, 70), 40, 40), gloss: 0.3, gk: 0.3 });
    }
    for (let i = 0; i < 16; i++) {
      p.brush({ cx: r(300, 1300), cy: r(1520, 2100), ang: r(-0.25, 0.25), L: r(400, 900), w: r(140, 260), col: p.pick([C.ultra, C.bviolet, C.inkC]), col2: C.violet, mix: 0.4,
        op: r(0.3, 0.6), load: r(0.4, 0.65), decay: 0.6, dry: 1.5, thick: 0.15, field: fld(BLU, r(30, 70), 40, 40), gloss: 0.3, gk: 0.3 });
    }
    for (let i = 0; i < 22; i++) {
      const cx = r(300, 1900);
      p.brush({ cx, cy: EMB_Y(cx) + r(-22, 22), ang: r(-0.06, 0.06), L: r(200, 500), w: r(50, 90), col: p.pick([C.emberB, C.emberA]), col2: C.emberY, mix: 0.3,
        op: r(0.4, 0.8), load: r(0.45, 0.7), decay: 0.6, dry: 1.5, thick: 0.1, field: fld(EMB, r(4, 16), 12, 16), gloss: 0.4, gk: 0.3 });
    }
    // 7. final glazes that pool in the hollows of the relief
    const poolGlaze = (cx, cy, ang, Lh, w, Tc, op, F) => {
      p.brush({ cx, cy, ang, L: Lh, w, col: Tc, mode: 'glaze', op, soft: 0.9, edgeR: 0.35, dry: -1.4, load: 1.15, thick: 0.03, lev: 0, field: F, gloss: 0.6, gk: 0.5 });
    };
    for (let i = 0; i < 14; i++) poolGlaze(r(900, 1900), r(800, 1260), r(-0.2, 0.2), r(500, 1000), r(200, 380), p.pick([T.alz, T.crim]), r(0.3, 0.55), fld(RED, r(20, 60), 40, 40));
    for (let i = 0; i < 10; i++) poolGlaze(r(250, 1000), r(800, 1260), r(-0.2, 0.2), r(500, 1000), r(200, 380), p.pick([T.alz, T.crim]), r(0.3, 0.55), fld(RED, r(20, 60), 40, 40));
    for (let i = 0; i < 14; i++) poolGlaze(r(250, 1800), r(1530, 2000), r(-0.2, 0.2), r(500, 1000), r(200, 380), p.pick([T.ultra, T.indigo]), r(0.3, 0.55), fld(BLU, r(20, 60), 40, 40));
    for (let i = 0; i < 10; i++) { const cx = r(250, 1900); poolGlaze(cx, EMB_Y(cx), r(-0.03, 0.03), r(400, 900), r(80, 120), p.pick([T.orange, T.crim]), r(0.2, 0.45), fld(EMB, r(0, 10), 14, 18)); }
    L('scumble+pool');

    // 8. drips: thinned ember paint run down from the band, and one dark red from the upper field
    const drips = [[560, 1448, 120, 11], [935, 1452, 250, 13], [1655, 1450, 330, 14], [1420, 1452, 70, 9]];
    for (const [x, y, len, w] of drips) p.drip({ x: x + r(-10, 10), y, L: len, w, thick: 0.5, col: C.emberC, glz: T.orange });
    p.drip({ x: 1240, y: 1286, L: 64, w: 7, thick: 0.45, col: C.oxA, glz: T.crim });
    L('drips');

    // 9. maps: albedo (with pigment grain), gloss, AO and slopes
    const out = { W, H, s: p.s };
    const albedo = new Uint8Array(W * H * 4), masks = new Uint8Array(W * H * 4), grad = new Float32Array(W * H * 4);
    const hb1 = Float32Array.from(p.h), hb2 = Float32Array.from(p.h);
    p.blur(hb1, Math.max(1, Math.round(3 * p.s)), 2); p.blur(hb2, Math.max(2, Math.round(14 * p.s)), 2);
    const enc = (c) => { c = c <= 0 ? 0 : c >= 1 ? 1 : c; return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)); };
    const mot = (x, y) => fbm(N2, x / 7, y / 7, 2, 2.3, 0.5);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x, k3 = k * 3, k4 = k * 4;
      const g = 1 + 0.05 * p.grain[k] + 0.035 * mot(x / p.s, y / p.s);
      albedo[k4] = enc(p.col[k3] * g); albedo[k4 + 1] = enc(p.col[k3 + 1] * g); albedo[k4 + 2] = enc(p.col[k3 + 2] * g); albedo[k4 + 3] = 255;
      const xm = Math.max(0, x - 1), xp = Math.min(W - 1, x + 1), ym = Math.max(0, y - 1), yp = Math.min(H - 1, y + 1);
      grad[k4] = (p.h[y * W + xp] - p.h[y * W + xm]) / ((xp - xm) / p.s);
      grad[k4 + 1] = (p.h[yp * W + x] - p.h[ym * W + x]) / ((yp - ym) / p.s);
      const cav = Math.max(0, hb1[k] - p.h[k]) * 0.55 + Math.max(0, hb2[k] - p.h[k]) * 0.18;
      grad[k4 + 2] = clamp(1 - cav, 0.35, 1);
      grad[k4 + 3] = clamp(p.gloss[k], 0, 1);
      masks[k4] = Math.round(255 * p.fieldW[0][k]); masks[k4 + 1] = Math.round(255 * p.fieldW[1][k]); masks[k4 + 2] = Math.round(255 * p.fieldW[2][k]);
      masks[k4 + 3] = 255;
    }
    out.height = p.h; out.albedo = albedo; out.masks = masks; out.grad = grad;
    L('maps');
    out.ms = performance.now() - t0;
    return out;
  }

  root.TwoWeathersBuild = { buildPainting, Painter };
})(typeof window !== 'undefined' ? window : globalThis);
