/* First Snow, Orchard — oil paint raster engine.
 * Float RGB canvas with per-stroke bristle simulation, impasto height field,
 * paint-coverage map (for canvas weave in thin passages) and a final
 * relief-lighting / weave / dither pass. Fully deterministic (no Math.random, no Date). */
(function (root) {
  'use strict';
  const W = 2160, H = 2700, N = W * H;

  const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N);
  const HT = new Float32Array(N);   // impasto height
  const CV = new Float32Array(N);   // accumulated paint coverage 0..1
  const sA = new Float32Array(N);   // per-stroke max alpha (scratch)
  const sH = new Float32Array(N);   // per-stroke max height (scratch)
  const touched = new Int32Array(N);
  let nt = 0;
  let strokeCount = 0;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  function hash(n) {
    n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
    n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  }
  function h2(ix, iy, s) {
    return hash((Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(s, 2246822519)) | 0);
  }
  function vn1(x, s) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return lerp(h2(i, 0, s), h2(i + 1, 0, s), u);
  }
  function vn2(x, y, s) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = h2(ix, iy, s), b = h2(ix + 1, iy, s), c = h2(ix, iy + 1, s), d = h2(ix + 1, iy + 1, s);
    return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
  }
  function fbm(x, y, s, oct) {
    let v = 0, a = 0.5, f = 1, n = 0;
    for (let k = 0; k < oct; k++) {
      v += a * vn2(x * f, y * f, s + k * 31);
      n += a; a *= 0.5; f *= 2.03;
    }
    return v / n;
  }
  function mulberry32(a) {
    a = a | 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Blend one pixel. a = paint opacity, (r,g,b) = paint colour, h = impasto height.
  // Within one stroke a pixel only gets the *max* opacity (no double-darkening on overlap).
  function apply(i, a, r, g, b, h) {
    const e0 = sA[i];
    if (a > e0) {
      if (e0 === 0) touched[nt++] = i;
      const k = (a - e0) / (1 - e0 + 1e-6);
      R[i] += (r - R[i]) * k;
      G[i] += (g - G[i]) * k;
      B[i] += (b - B[i]) * k;
      sA[i] = a;
    }
    if (h > sH[i]) sH[i] = h;
  }

  function flush() {
    for (let m = 0; m < nt; m++) {
      const i = touched[m], a = sA[i];
      CV[i] = 1 - (1 - CV[i]) * (1 - a);
      HT[i] = HT[i] * (1 - 0.35 * a) + sH[i];
      sA[i] = 0;
      sH[i] = 0;
    }
    nt = 0;
  }

  /* Brush stroke along a polyline.
   * o: c [r,g,b 0..1], w0/w1 width at start/end (px), op opacity, soft edge softness (0 hard..1 soft),
   *    dry 0..1 dry-brush breakup toward the end, imp impasto height, bv bristle colour variation,
   *    wj width jitter, taperIn/taperOut, step, seed (int) */
  function stroke(pts, o) {
    const n = pts.length;
    if (n < 2) return;
    const cum = new Float64Array(n);
    for (let k = 1; k < n; k++) cum[k] = cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    const L = cum[n - 1];
    if (L < 0.5) return;
    strokeCount++;
    const step = o.step || 0.6;
    const nS = Math.max(2, Math.ceil(L / step));
    const w0 = o.w0, w1 = o.w1 == null ? o.w0 : o.w1;
    const op = o.op == null ? 1 : o.op;
    const soft = o.soft == null ? 0.12 : o.soft;
    const dry = o.dry || 0, imp = o.imp || 0;
    const bv = o.bv == null ? 0.07 : o.bv;
    const wj = o.wj == null ? 0.18 : o.wj;
    const tIn = o.taperIn == null ? 0.03 : o.taperIn;
    const tOut = o.taperOut == null ? 0.06 : o.taperOut;
    const sd = o.seed | 0;
    const sx = hash(sd * 7 + 1) * 500, sy = hash(sd * 13 + 5) * 500;
    const cr = o.c[0], cg = o.c[1], cb = o.c[2];
    let j = 0;
    for (let k = 0; k <= nS; k++) {
      const u = k / nS, s = u * L;
      while (j < n - 2 && cum[j + 1] < s) j++;
      const sl = cum[j + 1] - cum[j] || 1e-9;
      const f = clamp((s - cum[j]) / sl, 0, 1);
      const ax = pts[j][0], ay = pts[j][1], bx = pts[j + 1][0], by = pts[j + 1][1];
      const px = ax + (bx - ax) * f, py = ay + (by - ay) * f;
      let tx = bx - ax, ty = by - ay;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      const tp = clamp(Math.min(1, u / tIn, (1 - u) / tOut), 0.08, 1);
      const width = (w0 + (w1 - w0) * u) * tp * (1 + wj * (vn1(u * L * 0.03 + sx, sd + 3) * 2 - 1));
      const hw = Math.max(0.35, width * 0.5);
      const nx = -ty, ny = tx;
      const ext = Math.ceil(hw);
      const dA = dry * smooth(0.1, 1.0, u);
      for (let t = -ext; t <= ext; t++) {
        const d = Math.abs(t) / hw;
        if (d > 1) continue;
        const x = Math.round(px + nx * t), y = Math.round(py + ny * t);
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = y * W + x;
        const streak = vn2(t * 0.42 + sx, u * L * 0.035 + sy, sd);
        const e = 1 - smooth(1 - soft, 1, d);
        const bc = dry > 0 ? smooth(dA - 0.1, dA + 0.25, streak) : 1;
        const a = op * e * bc * (0.8 + 0.2 * streak);
        if (a <= 0.0005) continue;
        const v = 1 + bv * (streak - 0.5) * 2;
        apply(i, a, cr * v, cg * v, cb * v,
          imp > 0 ? imp * bc * e * Math.sqrt(1 - d * d) * (0.55 + 0.45 * streak) : 0);
      }
    }
    flush();
  }

  /* Filled soft ellipse (blobs, dabs, snow mounds, flakes, apples). */
  function dab(cx, cy, rx, ry, o) {
    if (rx < 0.3 || ry < 0.3) return;
    const x0 = Math.max(0, Math.floor(cx - rx) - 1), x1 = Math.min(W - 1, Math.ceil(cx + rx) + 1);
    const y0 = Math.max(0, Math.floor(cy - ry) - 1), y1 = Math.min(H - 1, Math.ceil(cy + ry) + 1);
    if (x0 > x1 || y0 > y1) return;
    strokeCount++;
    const op = o.op == null ? 1 : o.op;
    const soft = o.soft == null ? 0.2 : o.soft;
    const imp = o.imp || 0;
    const bv = o.bv == null ? 0.07 : o.bv;
    const sd = o.seed | 0;
    const sx = hash(sd * 7 + 1) * 500, sy = hash(sd * 13 + 5) * 500;
    const cr = o.c[0], cg = o.c[1], cb = o.c[2];
    for (let y = y0; y <= y1; y++) {
      const dy = (y - cy) / ry;
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) / rx;
        const d2 = dx * dx + dy * dy;
        if (d2 > 1) continue;
        const d = Math.sqrt(d2);
        const streak = vn2(x * 0.35 + sx, y * 0.35 + sy, sd);
        const e = 1 - smooth(1 - soft, 1, d);
        const a = op * e * (0.82 + 0.18 * streak);
        if (a <= 0.0005) continue;
        const v = 1 + bv * (streak - 0.5) * 2;
        apply(y * W + x, a, cr * v, cg * v, cb * v,
          imp > 0 ? imp * Math.sqrt(1 - d2) * (0.55 + 0.45 * streak) : 0);
      }
    }
    flush();
  }

  /* Light pass over a region: 'mul' tints existing paint (warm light on snow and bark),
   * 'add' adds radiance (window halo). */
  function light(cx, cy, sig, col, str, reach, mode) {
    const r = reach || sig * 3;
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
    const inv = 1 / (2 * sig * sig), r2 = r * r;
    const add = mode === 'add';
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const f = Math.exp(-d2 * inv) * str;
        const i = y * W + x;
        if (add) {
          R[i] += col[0] * f; G[i] += col[1] * f; B[i] += col[2] * f;
        } else {
          R[i] *= 1 + (col[0] - 1) * f;
          G[i] *= 1 + (col[1] - 1) * f;
          B[i] *= 1 + (col[2] - 1) * f;
        }
      }
    }
  }

  function base(r, g, b) {
    R.fill(r); G.fill(g); B.fill(b);
  }

  /* Final pass: impasto relief lighting from the height field, canvas weave where paint is thin,
   * gentle vignette, and dithering to avoid 8-bit banding. Writes into ctx (W x H). */
  function finish(ctx, opt) {
    opt = opt || {};
    const SH = opt.shade == null ? 1.0 : opt.shade;
    const K = opt.relief == null ? 2.2 : opt.relief;
    const WA = opt.weave == null ? 0.05 : opt.weave;
    const img = ctx.createImageData(W, H);
    const out = img.data;
    const lx = -0.5, ly = -0.6, lz = 0.62;
    const ll = Math.hypot(lx, ly, lz);
    const LX = lx / ll, LY = ly / ll, LZ = lz / ll;
    for (let y = 0; y < H; y++) {
      const yu = y > 0 ? -W : 0, yd = y < H - 1 ? W : 0;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const xl = x > 0 ? -1 : 0, xr = x < W - 1 ? 1 : 0;
        const dhx = (HT[i + xr] - HT[i + xl]) * 0.5 * K;
        const dhy = (HT[i + yd] - HT[i + yu]) * 0.5 * K;
        const nl = Math.sqrt(dhx * dhx + dhy * dhy + 1);
        const ndl = (-dhx * LX - dhy * LY + LZ) / nl;
        const shade = (ndl - LZ) * SH;

        const cellX = x >> 2, cellY = y >> 2;
        const checker = (cellX + cellY) & 1;
        const fx = ((x & 3) + 0.5) / 4 - 0.5, fy = ((y & 3) + 0.5) / 4 - 0.5;
        const thrH = Math.exp(-(fy * fy) / 0.06), thrV = Math.exp(-(fx * fx) / 0.06);
        const pat = checker ? thrH : thrV;
        const irr = 0.6 + 0.8 * h2(cellX, cellY, 17);
        const weave = 1 + WA * (pat - 0.5) * 2 * irr * (1 - CV[i]);

        const vx = (x - W * 0.5) / (W * 0.62), vy = (y - H * 0.5) / (H * 0.62);
        const vig = 1 - 0.26 * smooth(0.35, 1.6, vx * vx + vy * vy);

        const m = (1 + shade) * weave * vig;
        const dith = hash(i ^ 0x5bd1e995) - 0.5;
        const o = i * 4;
        out[o] = clamp(Math.round(clamp(R[i] * m, 0, 1) * 255 + dith), 0, 255);
        out[o + 1] = clamp(Math.round(clamp(G[i] * m, 0, 1) * 255 + dith), 0, 255);
        out[o + 2] = clamp(Math.round(clamp(B[i] * m, 0, 1) * 255 + dith), 0, 255);
        out[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  root.ENGINE = {
    W, H, N, R, G, B, HT, CV,
    clamp, lerp, smooth, hash, vn1, vn2, fbm, mulberry32,
    stroke, dab, light, base, finish,
    strokes: () => strokeCount,
  };
})(window);
