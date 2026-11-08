/* Pixel engine: an indexed-colour framebuffer with hand-pixel primitives.
 *
 * Everything is drawn in palette indices into a W x H Uint8Array. Colours computed in RGB
 * (light, haze) are snapped to the palette through a 32^3 LUT with a weighted metric, so
 * the image never contains a colour outside the palette. Gradients are made with explicit
 * ramps and narrow, ordered-dither seams, never with free error diffusion.
 * Deterministic: seeded mulberry32 + integer hashing. No Math.random, no Date.
 */
(function (root) {
  'use strict';
  const fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function vn2(x, y, s) {
    const xi = fl(x), yi = fl(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = ih(xi, yi, s), b = ih(xi + 1, yi, s), c = ih(xi, yi + 1, s), d = ih(xi + 1, yi + 1, s);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  function fbm(x, y, oct, s) {
    let sum = 0, amp = 0.5, norm = 0;
    for (let o = 0; o < oct; o++) { sum += amp * vn2(x, y, s + o * 131); norm += amp; x *= 2.03; y *= 2.03; amp *= 0.5; }
    return sum / norm;
  }
  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER4[(y & 3) * 4 + (x & 3)];

  function hex(h) { return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }

  function Palette(defs) {
    const C = {}, P = [];
    defs.forEach(([k, h], i) => { C[k] = i; P.push(hex(h)); });
    const N = P.length;
    const lut = new Uint8Array(32768);
    function nearest(r, g, b) {
      let best = 0, bd = 1e18;
      for (let k = 0; k < N; k++) {
        const p = P[k], dr = r - p[0], dg = g - p[1], db = b - p[2];
        const rm = (r + p[0]) * 0.5;
        const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
        if (d < bd) { bd = d; best = k; }
      }
      return best;
    }
    for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 32; b++)
      lut[(r << 10) | (g << 5) | b] = nearest(r * 8 + 4, g * 8 + 4, b * 8 + 4);
    function snap(r, g, b) {
      r = clamp(r | 0, 0, 255); g = clamp(g | 0, 0, 255); b = clamp(b | 0, 0, 255);
      return lut[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)];
    }
    return { C, P, N, snap, nearest };
  }

  function Surface(W, H, pal) {
    const buf = new Uint8Array(W * H);
    const tag = new Uint16Array(W * H); // what drew each pixel (for outline / cleanup passes)
    let curTag = 0;
    const S = { W, H, buf, tag, pal };
    S.setTag = (t) => { curTag = t; };
    S.px = (x, y, c) => {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= W || y >= H || c < 0) return;
      const i = y * W + x; buf[i] = c; tag[i] = curTag;
    };
    S.get = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : buf[(y | 0) * W + (x | 0)]);
    S.getTag = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : tag[(y | 0) * W + (x | 0)]);
    S.rgb = (x, y, r, g, b) => S.px(x, y, pal.snap(r, g, b));
    S.rect = (x, y, w, h, c) => {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) S.px(x + i, y + j, typeof c === 'function' ? c(x + i, y + j) : c);
    };
    S.hline = (x0, x1, y, c) => { if (x1 < x0) { const t = x0; x0 = x1; x1 = t; } for (let x = x0; x <= x1; x++) S.px(x, y, typeof c === 'function' ? c(x, y) : c); };
    S.vline = (x, y0, y1, c) => { if (y1 < y0) { const t = y0; y0 = y1; y1 = t; } for (let y = y0; y <= y1; y++) S.px(x, y, typeof c === 'function' ? c(x, y) : c); };
    // Bresenham; c may be a function (x, y, step) -> index
    S.line = (x0, y0, x1, y1, c) => {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy, n = 0;
      for (;;) {
        S.px(x0, y0, typeof c === 'function' ? c(x0, y0, n) : c); n++;
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    };
    // scanline polygon fill at pixel centres; c is an index or fn(x, y)
    S.poly = (pts, c) => {
      let y0 = Infinity, y1 = -Infinity;
      for (const p of pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
      y0 = Math.max(0, Math.ceil(y0 - 0.5)); y1 = Math.min(H - 1, Math.floor(y1 - 0.5));
      const n = pts.length;
      for (let y = y0; y <= y1; y++) {
        const yc = y + 0.5, xs = [];
        for (let i = 0; i < n; i++) {
          const a = pts[i], b = pts[(i + 1) % n];
          if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
          for (let x = xa; x <= xb; x++) S.px(x, y, typeof c === 'function' ? c(x, y) : c);
        }
      }
    };
    S.ellipse = (cx, cy, rx, ry, c) => {
      const y0 = Math.ceil(cy - ry - 0.5), y1 = Math.floor(cy + ry - 0.5);
      for (let y = y0; y <= y1; y++) {
        const dy = (y + 0.5 - cy) / ry;
        if (Math.abs(dy) > 1) continue;
        const hw = rx * Math.sqrt(1 - dy * dy);
        const xa = Math.ceil(cx - hw - 0.5), xb = Math.floor(cx + hw - 0.5);
        for (let x = xa; x <= xb; x++) S.px(x, y, typeof c === 'function' ? c(x, y) : c);
      }
    };
    // stamp a small sprite given as array of strings and a key->index map
    S.sprite = (x, y, rows, map, flip) => {
      for (let j = 0; j < rows.length; j++) {
        const r = rows[j];
        for (let i = 0; i < r.length; i++) {
          const ch = r[flip ? r.length - 1 - i : i];
          if (ch === '.' || ch === ' ') continue;
          const c = map[ch];
          if (c === undefined) continue;
          S.px(x + i, y + j, typeof c === 'function' ? c(x + i, y + j) : c);
        }
      }
    };
    S.toRGBA = () => {
      const out = new Uint8ClampedArray(W * H * 4);
      for (let i = 0; i < W * H; i++) { const p = pal.P[buf[i]]; out[i * 4] = p[0]; out[i * 4 + 1] = p[1]; out[i * 4 + 2] = p[2]; out[i * 4 + 3] = 255; }
      return out;
    };
    return S;
  }

  // ramp picker with narrow ordered-dither seams; sharp >= 1 (higher = harder bands, 99 = none)
  function rampPick(ramp, v, x, y, sharp) {
    const n = ramp.length - 1;
    const s = clamp(v, 0, 1) * n;
    let i = fl(s); if (i >= n) return ramp[n];
    const fr = s - i;
    const fs = clamp((fr - 0.5) * sharp + 0.5, 0, 1);
    return ramp[fs > bayer(x, y) ? i + 1 : i];
  }

  // remove orphan pixels inside a masked region: a pixel whose colour no 4-neighbour shares,
  // while 3+ neighbours agree on another colour, takes that colour.
  function despeckle(S, mask, passes) {
    const { W, H, buf } = S;
    for (let p = 0; p < (passes || 1); p++) {
      const src = buf.slice();
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (mask && !mask(x, y)) continue;
        const c = src[i], n = [src[i - 1], src[i + 1], src[i - W], src[i + W]];
        if (n[0] === c || n[1] === c || n[2] === c || n[3] === c) continue;
        const cnt = {};
        let best = -1, bc = 0;
        for (const v of n) { cnt[v] = (cnt[v] || 0) + 1; if (cnt[v] > bc) { bc = cnt[v]; best = v; } }
        if (bc >= 3) buf[i] = best;
      }
    }
  }

  root.PX = { fl, clamp, lerp, sstep, mulberry32, ih, vn2, fbm, bayer, BAYER4, hex, Palette, Surface, rampPick, despeckle };
})(typeof window !== 'undefined' ? window : globalThis);
