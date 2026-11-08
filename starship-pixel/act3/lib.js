// Act 3 pixel library: indexed 480x270 buffer, shared palette ramps, clean
// integer primitives (no anti-aliasing), Bayer 4x4 ordered dithering.
(function (G) {
  'use strict';
  const W = 480, H = 270;

  // ---- palette (style bible ramps, each ordered dark -> light) ----
  const RAMPS = {
    sky:   ['#0b1630', '#12234a', '#1a3566', '#24508a', '#3a6fa8', '#5b8fc4', '#86b0d8', '#b3cfe6', '#dbe8f2', '#f4f7fa'],
    warm:  ['#7a3524', '#b85a2e', '#e0823a', '#f5b04a', '#ffd77a', '#fff0b8', '#fffbe8'],
    steel: ['#0e0f12', '#1c1f25', '#2d323b', '#434a55', '#5f6876', '#828c99', '#a9b2bd', '#cdd4db', '#eef1f4'],
    marsh: ['#1c2416', '#2c3a22', '#44542f', '#66733f', '#8c8a55', '#b3a571', '#d6c99a'],
    sea:   ['#163042', '#24506a', '#3b7894', '#6aa3bb', '#a9d0dd'],
    dark:  ['#050608', '#0f1216', '#1a1e24'],
    black: ['#000000'], // extension (dark-structure family): pure black for the final fade
  };
  const PAL = [];
  const R = {};
  for (const k in RAMPS) { R[k] = RAMPS[k].map(h => { PAL.push(h); return PAL.length - 1; }); }
  const S = R.sky, Wm = R.warm, T = R.steel, M = R.marsh, A = R.sea, D = R.dark, K = R.black[0];
  const RGB = PAL.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  const LUM = RGB.map(([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b);

  // darker(c): the palette colour nearest to c's RGB scaled by 0.74 (hue-preserving),
  // restricted to colours that are strictly darker; ends in black.
  const DARKER = new Uint8Array(PAL.length);
  const FAM = [];
  for (const k in R) for (const i of R[k]) FAM[i] = k;
  const ALLOW = { sky: ['sky', 'sea', 'dark', 'black'], sea: ['sea', 'sky', 'dark', 'black'], steel: ['steel', 'dark', 'black'],
    marsh: ['marsh', 'dark', 'black'], warm: ['warm', 'steel', 'dark', 'black'], dark: ['dark', 'black'], black: ['black'] };
  for (let i = 0; i < PAL.length; i++) {
    const allow = (FAM[i] === 'warm' && R.warm.indexOf(i) >= 4) ? ['steel', 'dark', 'black'] : ALLOW[FAM[i]];
    const [r, g, b] = RGB[i], tr = r * 0.8, tg = g * 0.8, tb = b * 0.8;
    let best = -1, bd = Infinity;
    for (let j = 0; j < PAL.length; j++) {
      if (j === i || LUM[j] >= LUM[i] * 0.95 || allow.indexOf(FAM[j]) < 0) continue;
      const [r2, g2, b2] = RGB[j];
      const d = 0.3 * (r2 - tr) ** 2 + 0.59 * (g2 - tg) ** 2 + 0.11 * (b2 - tb) ** 2;
      if (d < bd) { bd = d; best = j; }
    }
    DARKER[i] = best < 0 ? i : best;
  }
  const buf = new Uint8Array(W * H);

  // ---- Bayer 4x4 ----
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bth = (x, y) => (BAY[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

  // ---- deterministic randomness ----
  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(i, j, s) {
    let h = (i * 374761393 + j * 668265263 + (s || 0) * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  // smooth value noise 1D
  function vnoise(x, s) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return hash(i, 7, s) * (1 - u) + hash(i + 1, 7, s) * u;
  }

  function vnoise2(x, y, s) {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = hash(i, j, s), b = hash(i + 1, j, s), c = hash(i, j + 1, s), d = hash(i + 1, j + 1, s);
    return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
  }
  function fbm2(x, y, s, oct) {
    let v = 0, a = 0.5, n = 0;
    for (let o = 0; o < (oct || 3); o++) { v += a * vnoise2(x, y, s + o * 17); n += a; x *= 2.03; y *= 2.03; a *= 0.5; }
    return v / n;
  }

  // ---- primitives (integer, clipped) ----
  const ri = Math.round;
  function P(x, y, c) { x |= 0; y |= 0; if (x >= 0 && x < W && y >= 0 && y < H) buf[y * W + x] = c; }
  function Pr(x, y, c) { P(ri(x), ri(y), c); }
  function get(x, y) { if (x < 0 || x >= W || y < 0 || y >= H) return -1; return buf[y * W + x]; }
  // dithered plot: draws only where bayer threshold < level (0..1); pattern anchored at (ax,ay)
  function Pd(x, y, c, level, ax, ay) { x |= 0; y |= 0; if (level > bth(x - (ax | 0), y - (ay | 0))) P(x, y, c); }
  function clear(c) { buf.fill(c); }
  function rect(x, y, w, h, c) {
    x = ri(x); y = ri(y); w = ri(w); h = ri(h);
    const x0 = Math.max(0, x), x1 = Math.min(W, x + w), y0 = Math.max(0, y), y1 = Math.min(H, y + h);
    for (let yy = y0; yy < y1; yy++) buf.fill(c, yy * W + x0, yy * W + x1 > yy * W + x0 ? yy * W + x1 : yy * W + x0);
  }
  function rectD(x, y, w, h, c, level, ax, ay) {
    for (let yy = ri(y); yy < ri(y) + ri(h); yy++) for (let xx = ri(x); xx < ri(x) + ri(w); xx++) Pd(xx, yy, c, level, ax || 0, ay || 0);
  }
  function hl(x0, x1, y, c) { if (x1 < x0) { const t = x0; x0 = x1; x1 = t; } for (let x = ri(x0); x <= ri(x1); x++) P(x, ri(y), c); }
  function vl(x, y0, y1, c) { if (y1 < y0) { const t = y0; y0 = y1; y1 = t; } for (let y = ri(y0); y <= ri(y1); y++) P(ri(x), y, c); }
  // Bresenham line; optional per-pixel callback for colour
  function line(x0, y0, x1, y1, c, fn) {
    x0 = ri(x0); y0 = ri(y0); x1 = ri(x1); y1 = ri(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, n = 0;
    for (;;) {
      if (fn) fn(x0, y0, n); else P(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
      n++;
    }
  }
  function lineD(x0, y0, x1, y1, c, level) { line(x0, y0, x1, y1, c, (x, y) => Pd(x, y, c, level, 0, 0)); }
  // polygon scanline fill (pixel centres), cb(x,y) optional
  function poly(pts, c, cb) {
    let ymin = Infinity, ymax = -Infinity;
    for (const p of pts) { if (p[1] < ymin) ymin = p[1]; if (p[1] > ymax) ymax = p[1]; }
    const y0 = Math.max(0, Math.ceil(ymin - 0.5)), y1 = Math.min(H - 1, Math.floor(ymax - 0.5));
    const xs = [];
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5; xs.length = 0;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a = pts[i], b = pts[j];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
        for (let x = xa; x <= xb; x++) { if (cb) cb(x, y); else buf[y * W + x] = c; }
      }
    }
  }
  function polyD(pts, c, level, ax, ay) { poly(pts, c, (x, y) => Pd(x, y, c, level, ax || 0, ay || 0)); }
  function disc(cx, cy, r, c, cb) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) { if (cb) cb(x, y, dx, dy); else P(x, y, c); }
      }
  }
  // midpoint circle outline (integer centre, integer radius)
  function ring(cx, cy, r, c, level) {
    cx = ri(cx); cy = ri(cy); r = ri(r);
    let x = r, y = 0, e = 1 - r;
    const put = (a, b) => level === undefined ? P(a, b, c) : Pd(a, b, c, level, 0, 0);
    while (x >= y) {
      put(cx + x, cy + y); put(cx + y, cy + x); put(cx - y, cy + x); put(cx - x, cy + y);
      put(cx - x, cy - y); put(cx - y, cy - x); put(cx + y, cy - x); put(cx + x, cy - y);
      y++;
      if (e < 0) e += 2 * y + 1; else { x--; e += 2 * (y - x) + 1; }
    }
  }
  // ordered-dither pick from a ramp (array of indices) at float position v
  function pick(ramp, v, x, y) {
    if (v <= 0) return ramp[0];
    const n = ramp.length - 1;
    if (v >= n) return ramp[n];
    const i = Math.floor(v), f = v - i;
    return f > bth(x, y) ? ramp[i + 1] : ramp[i];
  }
  // n steps darker
  function darkN(c, n) { for (let i = 0; i < n; i++) c = DARKER[c]; return c; }

  // dithered fade to black over the whole buffer (f in 0..1)
  function fadeBlack(f, steps) {
    if (f <= 0) return;
    steps = steps || 10;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = f * (steps + 1);
      let n = Math.floor(v); if (v - n > bth(x, y)) n++;
      if (n > 0) { const i = y * W + x; buf[i] = n > steps ? K : darkN(buf[i], n); }
    }
  }

  function toRGBA(out) {
    for (let i = 0, j = 0; i < W * H; i++, j += 4) { const c = RGB[buf[i]]; out[j] = c[0]; out[j + 1] = c[1]; out[j + 2] = c[2]; out[j + 3] = 255; }
  }
  function toRGB(out) {
    for (let i = 0, j = 0; i < W * H; i++, j += 3) { const c = RGB[buf[i]]; out[j] = c[0]; out[j + 1] = c[1]; out[j + 2] = c[2]; }
  }

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, f) => a + (b - a) * f;
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  // monotone cubic (Fritsch-Carlson) interpolation through keys [[t,v],...]
  function spline(keys) {
    const n = keys.length, xs = keys.map(k => k[0]), ys = keys.map(k => k[1]);
    const d = [], m = [];
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const tt = 3 / Math.sqrt(s); m[i] = tt * a * d[i]; m[i + 1] = tt * b * d[i]; }
    }
    return function (x) {
      if (x <= xs[0]) return ys[0];
      if (x >= xs[n - 1]) return ys[n - 1];
      let i = 0; while (x > xs[i + 1]) i++;
      const h = xs[i + 1] - xs[i], u = (x - xs[i]) / h, u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * m[i + 1];
    };
  }

  G.PX = {
    W, H, PAL, RGB, LUM, R, S, Wm, T, M, A, D, K, DARKER, buf, bth, BAY, mulberry, hash, vnoise, vnoise2, fbm2,
    P, Pr, Pd, get, clear, rect, rectD, hl, vl, line, lineD, poly, polyD, disc, ring, pick, darkN, fadeBlack,
    toRGBA, toRGB, clamp, lerp, smooth, spline, ri,
  };
})(typeof window !== 'undefined' ? window : globalThis);
