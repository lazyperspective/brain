/* Branchlight — core: namespace, seeded randomness, noise, the pixel surface.
 *
 * Every slide paints into a 360×640 Surface. A surface pixel holds a float RGB
 * colour and a mode flag:
 *   MODE_SOFT  (0) — continuous tone (haze, light falloff, path shading).
 *                    Quantised with ordered 4×4 Bayer dithering between two palette colours.
 *   MODE_CRISP (1) — a drawn mark (strand, crack, fleck, figure).
 *                    Snapped to the single nearest palette colour, never dithered.
 * palette.js turns the surface into indexed pixels and scales it ×3 with nearest-neighbour.
 */
(function () {
  'use strict';
  const BL = (window.BL = window.BL || {});

  BL.W = 360;
  BL.H = 640;
  BL.SCALE = 3;
  BL.MODE_SOFT = 0;
  BL.MODE_CRISP = 1;

  /* ------------------------------------------------------------- random */
  BL.rng = function (seed) {
    let a = seed >>> 0;
    const next = function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.range = (lo, hi) => lo + (hi - lo) * next();
    next.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * next());
    next.pick = (arr) => arr[Math.floor(next() * arr.length)];
    next.chance = (p) => next() < p;
    next.gauss = () => {
      let u = 0, v = 0;
      while (u === 0) u = next();
      v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    // weighted pick from [[item, weight], ...]
    next.weighted = (list) => {
      let tot = 0;
      for (const e of list) tot += e[1];
      let r = next() * tot;
      for (const e of list) { r -= e[1]; if (r <= 0) return e[0]; }
      return list[list.length - 1][0];
    };
    return next;
  };

  /* -------------------------------------------------------------- noise */
  // Seeded 2D value noise with quintic smoothing, plus fbm.
  BL.noise = function (seed) {
    const r = BL.rng(seed);
    const P = new Uint8Array(512);
    const V = new Float32Array(256);
    const perm = [];
    for (let i = 0; i < 256; i++) { perm.push(i); V[i] = r(); }
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    const n2 = function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const X = xi & 255, Y = yi & 255;
      const a = V[P[P[X] + Y]], b = V[P[P[X + 1] + Y]];
      const c = V[P[P[X] + Y + 1]], d = V[P[P[X + 1] + Y + 1]];
      const u = fade(xf), v = fade(yf);
      return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
    };
    n2.fbm = function (x, y, oct) {
      let s = 0, amp = 0.5, f = 1, norm = 0;
      for (let i = 0; i < (oct || 4); i++) { s += amp * n2(x * f, y * f); norm += amp; amp *= 0.5; f *= 2.03; }
      return s / norm;
    };
    return n2;
  };

  /* --------------------------------------------------------------- math */
  BL.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  BL.lerp = (a, b, t) => a + (b - a) * t;
  BL.smooth = (a, b, v) => { const t = BL.clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  BL.angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  BL.hex = function (h) {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  BL.mix = (c1, c2, t) => [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t];

  // 4×4 Bayer thresholds in (0,1)
  const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  BL.bayer = (x, y) => (B4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

  /* ------------------------------------------------------------ surface */
  BL.Surface = function (seed) {
    const W = BL.W, H = BL.H;
    this.W = W; this.H = H;
    this.rgb = new Float32Array(W * H * 3);
    this.mode = new Uint8Array(W * H);
    this.bg = null;        // snapshot of the background, used for atmospheric fade
    this.seed = seed;
    this.marks = [];       // sampled strand points, for splatter placement
  };
  const S = BL.Surface.prototype;

  // Paint every pixel from fn(x, y) -> [r,g,b] in soft mode.
  S.fill = function (fn) {
    const W = this.W, H = this.H, d = this.rgb;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = fn(x, y), i = (y * W + x) * 3;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
      this.mode[y * W + x] = 0;
    }
  };
  S.snapshot = function () { this.bg = new Float32Array(this.rgb); };
  S.bgAt = function (x, y) {
    x = BL.clamp(x | 0, 0, this.W - 1); y = BL.clamp(y | 0, 0, this.H - 1);
    const i = (y * this.W + x) * 3, b = this.bg || this.rgb;
    return [b[i], b[i + 1], b[i + 2]];
  };
  S.get = function (x, y) {
    const i = (y * this.W + x) * 3;
    return [this.rgb[i], this.rgb[i + 1], this.rgb[i + 2]];
  };
  // Crisp pixel.
  S.px = function (x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    const k = y * this.W + x, i = k * 3;
    this.rgb[i] = c[0]; this.rgb[i + 1] = c[1]; this.rgb[i + 2] = c[2];
    this.mode[k] = 1;
  };
  // Soft pixel (dithered later).
  S.soft = function (x, y, c) {
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    const k = y * this.W + x, i = k * 3;
    this.rgb[i] = c[0]; this.rgb[i + 1] = c[1]; this.rgb[i + 2] = c[2];
    this.mode[k] = 0;
  };
  S.rect = function (x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  };

  // Pixel-perfect polyline: points sampled densely along a curve are rounded,
  // gaps bridged, and L-shaped corners removed so 1-px lines stay clean.
  BL.pixelPath = function (pts) {
    const out = [];
    let lx = null, ly = null;
    const push = (x, y) => {
      if (lx === x && ly === y) return;
      if (lx !== null && (Math.abs(x - lx) > 1 || Math.abs(y - ly) > 1)) {
        // bridge with Bresenham
        let x0 = lx, y0 = ly;
        const dx = Math.abs(x - x0), dy = -Math.abs(y - y0);
        const sx = x0 < x ? 1 : -1, sy = y0 < y ? 1 : -1;
        let err = dx + dy;
        for (;;) {
          if (x0 === x && y0 === y) break;
          const e2 = 2 * err;
          if (e2 >= dy) { err += dy; x0 += sx; }
          if (e2 <= dx) { err += dx; y0 += sy; }
          if (x0 === x && y0 === y) break;
          out.push(x0, y0);
        }
      }
      out.push(x, y); lx = x; ly = y;
    };
    for (let i = 0; i < pts.length; i += 2) push(Math.round(pts[i]), Math.round(pts[i + 1]));
    // remove L corners
    const res = [];
    const n = out.length / 2;
    for (let i = 0; i < n; i++) {
      const x = out[i * 2], y = out[i * 2 + 1];
      if (i > 0 && i < n - 1 && res.length >= 2) {
        const ax = res[res.length - 2], ay = res[res.length - 1];
        const cx = out[i * 2 + 2], cy = out[i * 2 + 3];
        if (Math.abs(ax - cx) === 1 && Math.abs(ay - cy) === 1 && (x === ax || y === ay) && (x === cx || y === cy)) continue;
      }
      res.push(x, y);
    }
    return res;
  };

  // Draw a crisp 1-px polyline; colour may be a function (x, y, t) -> rgb or null (skip).
  S.polyline = function (pts, col) {
    const p = BL.pixelPath(pts);
    const n = p.length / 2;
    const fn = typeof col === 'function';
    for (let i = 0; i < n; i++) {
      const c = fn ? col(p[i * 2], p[i * 2 + 1], n > 1 ? i / (n - 1) : 0) : col;
      if (c) this.px(p[i * 2], p[i * 2 + 1], c);
    }
    return n;
  };

  // Blend towards the background at this pixel (atmospheric depth).
  S.fade = function (c, x, y, amt) {
    if (amt <= 0) return c;
    return BL.mix(c, this.bgAt(x, y), BL.clamp(amt, 0, 1));
  };

  // Light bloom: soft pixels are blended toward `col`; crisp pixels are swallowed by
  // the light through an ordered-dither mask, so marks dissolve in clean patterns.
  S.bloom = function (cx, cy, r0, r1, col, strength, opts) {
    opts = opts || {};
    const sy = opts.squash || 1;
    const crispK = opts.crisp == null ? 1 : opts.crisp;
    const W = this.W, H = this.H;
    const y0 = Math.max(0, Math.floor(cy - r1 / sy)), y1 = Math.min(H - 1, Math.ceil(cy + r1 / sy));
    const x0 = Math.max(0, Math.floor(cx - r1)), x1 = Math.min(W - 1, Math.ceil(cx + r1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, (y - cy) * sy);
      if (d >= r1) continue;
      let f = d <= r0 ? 1 : 1 - (d - r0) / (r1 - r0);
      f = Math.pow(f, opts.pow || 1.6) * strength;
      if (f <= 0) continue;
      const k = y * W + x, i = k * 3;
      if (this.mode[k] === 1) {
        // marks first pale toward the light, then dissolve through an ordered mask
        const fk = f * crispK;
        if (BL.bayer(x, y) < (fk - 0.45) * 1.8) { this.rgb[i] = col[0]; this.rgb[i + 1] = col[1]; this.rgb[i + 2] = col[2]; }
        else {
          const t = Math.min(1, fk) * 0.75;
          this.rgb[i] += (col[0] - this.rgb[i]) * t;
          this.rgb[i + 1] += (col[1] - this.rgb[i + 1]) * t;
          this.rgb[i + 2] += (col[2] - this.rgb[i + 2]) * t;
        }
      } else {
        const t = Math.min(1, f);
        this.rgb[i] += (col[0] - this.rgb[i]) * t;
        this.rgb[i + 1] += (col[1] - this.rgb[i + 1]) * t;
        this.rgb[i + 2] += (col[2] - this.rgb[i + 2]) * t;
      }
    }
  };

  // Filled disc (crisp).
  S.disc = function (cx, cy, r, c) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) this.px(x, y, c);
  };

  BL.slides = BL.slides || [];
})();

/* Monotone-ish Catmull–Rom through control points (xs ascending). */
(function () {
  'use strict';
  const BL = window.BL;
  BL.spline = function (xs, ys) {
    return function (x) {
      if (x <= xs[0]) return ys[0];
      if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
      let i = 0;
      while (x > xs[i + 1]) i++;
      const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
      const p0 = ys[Math.max(i - 1, 0)], p1 = ys[i], p2 = ys[i + 1], p3 = ys[Math.min(i + 2, ys.length - 1)];
      return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
    };
  };
  // Heading that circles a point: dir=+1 clockwise on screen (up the left side, over the top),
  // dir=-1 anticlockwise; `out` adds an outward spiral, `up` an upward bias.
  // Heading that orbits a point on a preferred ring of radius R (squashed vertically by sq):
  // outside the ring it spirals in, inside it spirals out.
  BL.ring = function (cx, cy, R, dir, k, sq) {
    sq = sq || 1;
    return function (x, y) {
      const dx = x - cx, dy = (y - cy) / sq, r = Math.hypot(dx, dy) || 1;
      let vx = dir > 0 ? -dy / r : dy / r, vy = dir > 0 ? dx / r : -dx / r;
      const e = BL.clamp((r - R) / R, -1, 1) * k;
      vx -= (dx / r) * e; vy -= (dy / r) * e;
      return Math.atan2(vy * sq, vx);
    };
  };
  // Heading pointing away from a point (a crown fanning out from below its trunk).
  BL.fan = function (cx, cy) { return (x, y) => Math.atan2(y - cy, x - cx); };
  BL.swirl = function (cx, cy, dir, out, up) {
    return function (x, y) {
      const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy) || 1;
      let vx = dir > 0 ? -dy / r : dy / r, vy = dir > 0 ? dx / r : -dx / r;
      vx += (dx / r) * out; vy += (dy / r) * out - (up || 0);
      return Math.atan2(vy, vx);
    };
  };
})();

/* Blend several heading fields as weighted unit vectors: [[field, weight|fn(x,y)], ...]. */
(function () {
  'use strict';
  window.BL.blend = function (list) {
    return function (x, y, n) {
      let vx = 0, vy = 0;
      for (const [f, w] of list) {
        const a = f(x, y, n), k = typeof w === 'function' ? w(x, y, n) : w;
        vx += Math.cos(a) * k; vy += Math.sin(a) * k;
      }
      return Math.atan2(vy, vx);
    };
  };
})();
