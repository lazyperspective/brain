// Core: deterministic PRNG, easing, 1-bit pixel primitives (black/white only, integer coordinates, no anti-aliasing),
// 8x8 QuickDraw-style patterns, and a tiny 1-bit bitmap class used for icons, cursors and the MacPaint document.
(function (G) {
  // ---------- determinism ----------
  function hash(n) {
    let x = Math.floor(n * 7919 + 0.5) | 0;
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b); x = Math.imul(x ^ (x >>> 16), 0x45d9f3b); x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }
  function rng(seed) { let a = (seed >>> 0) || 1; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const sat = (v) => clamp(v, 0, 1);
  const E = {
    lin: (k) => k,
    inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    inOut2: (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2),
    out: (k) => 1 - Math.pow(1 - k, 3),
    out2: (k) => 1 - (1 - k) * (1 - k),
    in: (k) => k * k * k,
    smooth: (k) => k * k * (3 - 2 * k),
    smoother: (k) => k * k * k * (k * (k * 6 - 15) + 10),
    outQuint: (k) => 1 - Math.pow(1 - k, 5),
  };
  const seg = (t, a, b) => sat((t - a) / (b - a));

  const B = '#000000', W = '#ffffff';

  // ---------- patterns (8 rows of 8 bits, MSB = leftmost pixel; aligned to screen/document origin) ----------
  const PAT = {
    white: [0, 0, 0, 0, 0, 0, 0, 0],
    black: [255, 255, 255, 255, 255, 255, 255, 255],
    gray: [0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55],
    ltgray: [0x88, 0x22, 0x88, 0x22, 0x88, 0x22, 0x88, 0x22],
    dkgray: [0x77, 0xdd, 0x77, 0xdd, 0x77, 0xdd, 0x77, 0xdd],
    dots: [0x80, 0x00, 0x08, 0x00, 0x80, 0x00, 0x08, 0x00],
    sparse: [0x80, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00],
    diag: [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80],
    diag2: [0x80, 0x40, 0x20, 0x10, 0x08, 0x04, 0x02, 0x01],
    hlines: [0xff, 0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00],
    hlines2: [0xff, 0x00, 0xff, 0x00, 0xff, 0x00, 0xff, 0x00],
    vlines: [0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88],
    bricks: [0xff, 0x80, 0x80, 0x80, 0xff, 0x08, 0x08, 0x08],
    grid: [0xff, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80],
    weave: [0x88, 0x14, 0x22, 0x41, 0x88, 0x00, 0xaa, 0x00],
    scales: [0x80, 0x80, 0x41, 0x3e, 0x08, 0x08, 0x14, 0xe3],
    diamond: [0x10, 0x28, 0x44, 0x82, 0x44, 0x28, 0x10, 0x00],
    checker: [0xf0, 0xf0, 0xf0, 0xf0, 0x0f, 0x0f, 0x0f, 0x0f],
    hatch: [0x11, 0x22, 0x44, 0x88, 0x11, 0x22, 0x44, 0x88],
    hatch2: [0x88, 0x44, 0x22, 0x11, 0x88, 0x44, 0x22, 0x11],
    dkhatch: [0x77, 0xbb, 0xdd, 0xee, 0x77, 0xbb, 0xdd, 0xee],
    shingle: [0xbf, 0x00, 0xbf, 0xbf, 0xb0, 0xb0, 0xb0, 0xb0],
    wave: [0x00, 0x00, 0x60, 0x92, 0x0c, 0x00, 0x00, 0x00],
    tiles: [0xfe, 0x82, 0x82, 0x82, 0x82, 0x82, 0xfe, 0x00],
    crosses: [0x00, 0x10, 0x10, 0x7c, 0x10, 0x10, 0x00, 0x00],
    circles: [0x38, 0x44, 0x82, 0x82, 0x82, 0x44, 0x38, 0x00],
    dkdots: [0xff, 0x77, 0xff, 0xdd, 0xff, 0x77, 0xff, 0xdd],
    zig: [0x81, 0x42, 0x24, 0x18, 0x81, 0x42, 0x24, 0x18],
    stars: [0x00, 0x22, 0x14, 0x08, 0x14, 0x22, 0x00, 0x00],
    lt2: [0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    vlines2: [0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa],
    basket: [0x8f, 0x8f, 0x8f, 0x8f, 0xf8, 0xf8, 0xf8, 0xf8],
    rain: [0x80, 0x10, 0x02, 0x20, 0x01, 0x08, 0x40, 0x04],
    thatch: [0x01, 0x82, 0x44, 0x38, 0x10, 0x28, 0x44, 0x82],
    ring: [0x00, 0x3c, 0x42, 0x42, 0x42, 0x42, 0x3c, 0x00],
    lt3: [0x88, 0x00, 0x22, 0x00, 0x88, 0x00, 0x22, 0x00],
    plaid: [0xff, 0x88, 0x88, 0x88, 0xff, 0x88, 0x88, 0x88],
    dash: [0xf0, 0x00, 0x00, 0x00, 0x0f, 0x00, 0x00, 0x00],
  };
  const pbit = (p, x, y) => (p[y & 7] >> (7 - (x & 7))) & 1;
  const fillCache = {};
  // pattern as a canvas fillStyle: black where the bit is set; `inkOnly` leaves 0-bits transparent
  function patStyle(ctx, name, inkOnly, inv) {
    const key = name + (inkOnly ? 'i' : '') + (inv ? 'v' : '');
    if (!fillCache[key]) {
      const c = document.createElement('canvas'); c.width = c.height = 8; const g = c.getContext('2d');
      const p = PAT[name];
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const b = pbit(p, x, y) ^ (inv ? 1 : 0);
        if (b) { g.fillStyle = B; g.fillRect(x, y, 1, 1); } else if (!inkOnly) { g.fillStyle = W; g.fillRect(x, y, 1, 1); }
      }
      fillCache[key] = c;
    }
    return ctx.createPattern(fillCache[key], 'repeat');
  }
  // white-only pattern (used to "gray out" ink: OR white through the 50% mask)
  let grayMask = null;
  function grayOut(ctx, x, y, w, h) {
    if (!grayMask) { const c = document.createElement('canvas'); c.width = c.height = 2; const g = c.getContext('2d'); g.fillStyle = W; g.fillRect(0, 0, 1, 1); g.fillRect(1, 1, 1, 1); grayMask = c; }
    ctx.fillStyle = ctx.createPattern(grayMask, 'repeat'); ctx.fillRect(x, y, w, h);
  }

  // ---------- primitives ----------
  function R(ctx, x, y, w, h, c) { if (w <= 0 || h <= 0) return; ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function H(ctx, x, y, w, c = B) { R(ctx, x, y, w, 1, c); }
  function V(ctx, x, y, h, c = B) { R(ctx, x, y, 1, h, c); }
  function frame(ctx, x, y, w, h, c = B) { H(ctx, x, y, w, c); H(ctx, x, y + h - 1, w, c); V(ctx, x, y, h, c); V(ctx, x + w - 1, y, h, c); }
  function P(ctx, x, y, w, h, name) { if (w <= 0 || h <= 0) return; ctx.fillStyle = patStyle(ctx, name); ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  // gray (pattern) outline, e.g. zoom rects and drag outlines
  function patFrame(ctx, x, y, w, h, name = 'gray') { ctx.fillStyle = patStyle(ctx, name, true); ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h); }
  // rounded rect rows (QuickDraw-like, integer, no AA) — returns per-row inset
  function rrInset(j, h, r) {
    const d = j < r ? r - j - 0.5 : j >= h - r ? j - (h - r) + 0.5 : 0;
    return d > 0 ? Math.round(r - Math.sqrt(Math.max(0, r * r - d * d))) : 0;
  }
  function rrFill(ctx, x, y, w, h, r, c) { for (let j = 0; j < h; j++) { const i = rrInset(j, h, r); R(ctx, x + i, y + j, w - 2 * i, 1, c); } }
  function rrFrame(ctx, x, y, w, h, r, c = B, fill = W, th = 1) {
    rrFill(ctx, x, y, w, h, r, c);
    if (fill !== null) rrFill(ctx, x + th, y + th, w - 2 * th, h - 2 * th, Math.max(0, r - th), fill);
  }

  // ---------- 1-bit bitmap ----------
  class Bm {
    constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8Array(w * h); this.m = null; }
    get(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : 0; }
    set(x, y, v = 1) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = v; }
    hl(x0, x1, y, v = 1) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, v); }
    vl(x, y0, y1, v = 1) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, v); }
    rect(x0, y0, x1, y1, v = 1) { this.hl(x0, x1, y0, v); this.hl(x0, x1, y1, v); this.vl(x0, y0, y1, v); this.vl(x1, y0, y1, v); }
    frect(x0, y0, x1, y1, v = 1) { for (let y = y0; y <= y1; y++) this.hl(x0, x1, y, v); }
    line(x0, y0, x1, y1, v = 1) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
      for (;;) { this.set(x0, y0, v); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
    }
    // rows of strings: '#' ink, '.' white-inside, ' ' transparent (if any ' ' is used the mask is explicit)
    static from(rows) {
      const h = rows.length, w = Math.max(...rows.map((r) => r.length)); const b = new Bm(w, h);
      let explicit = rows.some((r) => r.includes(' ')) ; b.m = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const ch = rows[y][x] || ' '; if (ch === '#') b.d[y * w + x] = 1; if (ch === '#' || ch === '.') b.m[y * w + x] = 1; }
      if (!explicit) b.m = null;
      return b;
    }
    // mask = everything not reachable from the border through white pixels
    autoMask() {
      const { w, h } = this, out = new Uint8Array(w * h).fill(1), st = [];
      for (let x = 0; x < w; x++) { st.push(x, 0, x, h - 1); }
      for (let y = 0; y < h; y++) { st.push(0, y, w - 1, y); }
      while (st.length) { const y = st.pop(), x = st.pop(); if (x < 0 || y < 0 || x >= w || y >= h) continue; const i = y * w + x; if (!out[i] || this.d[i]) continue; out[i] = 0; st.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1); }
      this.m = out; return this;
    }
    // draw onto a canvas: ink black, masked-white white; inv swaps
    draw(ctx, x, y, o = {}) {
      x = Math.round(x); y = Math.round(y);
      const ink = o.inv ? W : B, paper = o.inv ? B : W;
      for (let j = 0; j < this.h; j++) {
        let i = 0;
        while (i < this.w) {
          const k = j * this.w + i, v = this.d[k], m = this.m ? this.m[k] : 1;
          if (!v && !m) { i++; continue; }
          let n = 1; while (i + n < this.w) { const k2 = k + n; const v2 = this.d[k2], m2 = this.m ? this.m[k2] : 1; if (v2 !== v || (!v2 && !m2)) break; n++; }
          if (v) { ctx.fillStyle = ink; ctx.fillRect(x + i, y + j, n, 1); } else if (!o.inkOnly) { ctx.fillStyle = paper; ctx.fillRect(x + i, y + j, n, 1); }
          i += n;
        }
      }
    }
  }

  G.K = { hash, rng, clamp, lerp, sat, E, seg, B, W, PAT, pbit, patStyle, grayOut, R, H, V, frame, P, patFrame, rrInset, rrFill, rrFrame, Bm };
})(window);
