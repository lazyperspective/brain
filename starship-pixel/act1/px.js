// px.js — tiny deterministic pixel engine (480x270 native, palette-locked)
'use strict';
const PX = (() => {
  const W = 480, H = 270;
  function hex(h) { const n = parseInt(h.slice(1), 16); return ((255 << 24) | ((n & 255) << 16) | (n & 0xff00) | ((n >> 16) & 255)) >>> 0; }
  const RAMPS_HEX = {
    sky: ['#0b1630', '#12234a', '#1a3566', '#24508a', '#3a6fa8', '#5b8fc4', '#86b0d8', '#b3cfe6', '#dbe8f2', '#f4f7fa'],
    warm: ['#fffbe8', '#fff0b8', '#ffd77a', '#f5b04a', '#e0823a', '#b85a2e', '#7a3524'],
    steel: ['#0e0f12', '#1c1f25', '#2d323b', '#434a55', '#5f6876', '#828c99', '#a9b2bd', '#cdd4db', '#eef1f4'],
    marsh: ['#1c2416', '#2c3a22', '#44542f', '#66733f', '#8c8a55', '#b3a571', '#d6c99a'],
    water: ['#163042', '#24506a', '#3b7894', '#6aa3bb', '#a9d0dd'],
    dark: ['#050608', '#0f1216', '#1a1e24'],
    // pass 2: shared surreal family (dusk violet -> rose -> peach, and teal)
    sur: ['#2b1b4a', '#4a2e6e', '#7a4b8f', '#b46a9a', '#e69bb0', '#ffd2c2'],
    teal: ['#1f6e78', '#3fb4b0', '#7fe0d0'],
  };
  const R = {};
  for (const k in RAMPS_HEX) R[k] = RAMPS_HEX[k].map(hex);
  // warm ramp is listed bright->dark; provide a dark->bright alias for gradients
  R.warmUp = R.warm.slice().reverse();
  const ALL = new Set(); for (const k in R) for (const c of R[k]) ALL.add(c);

  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const thr = (x, y) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
  // quantise a fraction to quarter steps so dithers are clean 25/50/75 % patterns
  const q4 = f => Math.round(f * 4) / 4;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;

  // pick colour from ramp at continuous index v; soft = width of dithered transition (0..1]
  function rampc(ramp, v, x, y, soft = 0.6) {
    const n = ramp.length - 1;
    if (v <= 0) return ramp[0]; if (v >= n) return ramp[n];
    const i = Math.floor(v); let f = v - i;
    f = clamp((f - 0.5) / soft + 0.5, 0, 1);
    return q4(f) > thr(x, y) ? ramp[i + 1] : ramp[i];
  }
  // dithered choice between two colours with coverage f
  const dith2 = (a, b, f, x, y) => q4(f) > thr(x, y) ? b : a;

  // ---------- PRNG / noise ----------
  function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hash(x, y, s) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, s, oct = 4, g = 0.5) { let t = 0, amp = 1, norm = 0; for (let i = 0; i < oct; i++) { t += amp * vnoise(x, y, s + i * 17); norm += amp; amp *= g; x *= 2.03; y *= 2.03; } return t / norm; }

  // ---------- targets ----------
  function surf(w, h) { return { w, h, d: new Uint32Array(w * h) }; }
  const screen = surf(W, H);
  function pset(T, x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < T.w && y < T.h) T.d[y * T.w + x] = c; }
  function pget(T, x, y) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < T.w && y < T.h) return T.d[y * T.w + x]; return 0; }
  function fill(T, c) { T.d.fill(c); }
  function rect(T, x, y, w, h, c) { for (let j = Math.max(0, y); j < Math.min(T.h, y + h); j++) for (let i = Math.max(0, x); i < Math.min(T.w, x + w); i++) T.d[j * T.w + i] = c; }
  function blit(T, S, dx, dy, mask) { // S transparent where 0
    dx = Math.round(dx); dy = Math.round(dy);
    const x0 = Math.max(0, dx), x1 = Math.min(T.w, dx + S.w), y0 = Math.max(0, dy), y1 = Math.min(T.h, dy + S.h);
    for (let y = y0; y < y1; y++) { const so = (y - dy) * S.w - dx, to = y * T.w; for (let x = x0; x < x1; x++) { const c = S.d[so + x]; if (c && (!mask || mask(x, y))) T.d[to + x] = c; } }
  }
  function line(T, x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
    for (;;) { pset(T, x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  // pixel-perfect line: Bresenham with L-shaped elbow pixels removed (cleaner diagonals, no doubled corners)
  function lineP(T, x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy; const P = [];
    for (;;) { P.push(x0, y0); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
    const n = P.length / 2; let skip = -1;
    for (let i = 0; i < n; i++) {
      if (i > 0 && i < n - 1 && i - 1 !== skip) { const ax = P[2 * i - 2], ay = P[2 * i - 1], bx = P[2 * i + 2], by = P[2 * i + 3], cx = P[2 * i], cy = P[2 * i + 1];
        if ((ax === cx || ay === cy) && (bx === cx || by === cy) && ax !== bx && ay !== by) { skip = i; continue; } }
      pset(T, P[2 * i], P[2 * i + 1], c);
    }
  }
  // line with per-pixel colour callback
  function linef(T, x0, y0, x1, y1, fn) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy, i = 0; const n = Math.max(dx, -dy);
    for (;;) { const c = fn(x0, y0, n ? i / n : 0); if (c) pset(T, x0, y0, c); i++; if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  // scanline polygon fill at pixel centres; colour may be fn(x,y)
  function poly(T, pts, c) {
    let ymin = Infinity, ymax = -Infinity; for (const p of pts) { ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]); }
    const y0 = Math.max(0, Math.floor(ymin)), y1 = Math.min(T.h - 1, Math.ceil(ymax)); const n = pts.length; const xs = [];
    for (let y = y0; y <= y1; y++) {
      const cy = y + 0.5; xs.length = 0;
      for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; if ((a[1] <= cy && b[1] > cy) || (b[1] <= cy && a[1] > cy)) xs.push(a[0] + (cy - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(T.w - 1, Math.floor(xs[k + 1] - 0.5));
        for (let x = xa; x <= xb; x++) { const col = typeof c === 'function' ? c(x, y) : c; if (col) T.d[y * T.w + x] = col; }
      }
    }
  }
  function disc(T, cx, cy, r, c) { const x0 = Math.floor(cx - r - 1), x1 = Math.ceil(cx + r + 1), y0 = Math.floor(cy - r - 1), y1 = Math.ceil(cy + r + 1); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy <= r * r) { const col = typeof c === 'function' ? c(x, y, Math.sqrt(dx * dx + dy * dy)) : c; if (col) pset(T, x, y, col); } } }
  // 1px ring (outline) of radius r around integer-ish centre
  function ring(T, cx, cy, r, c) { const x0 = Math.floor(cx - r - 2), x1 = Math.ceil(cx + r + 2), y0 = Math.floor(cy - r - 2), y1 = Math.ceil(cy + r + 2); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.sqrt(dx * dx + dy * dy); if (d <= r && d > r - 1) { const col = typeof c === 'function' ? c(x, y) : c; if (col) pset(T, x, y, col); } } }

  // remove orphan pixels in a surface (pixels differing from all 4 neighbours) using majority of 8-neighbourhood
  function deorphan(T, keep) {
    const out = T.d.slice(); const w = T.w, h = T.h;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, c = T.d[i]; if (keep && keep(c)) continue;
      if (T.d[i - 1] !== c && T.d[i + 1] !== c && T.d[i - w] !== c && T.d[i + w] !== c) {
        const cnt = new Map(); for (const j of [i - 1, i + 1, i - w, i + w, i - w - 1, i - w + 1, i + w - 1, i + w + 1]) cnt.set(T.d[j], (cnt.get(T.d[j]) || 0) + 1);
        let best = c, bn = 0; for (const [k, v] of cnt) if (v > bn) { bn = v; best = k; } out[i] = best;
      }
    }
    T.d.set(out);
  }

  // ---------- 3D ----------
  const v3 = (x, y, z) => [x, y, z];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  function camera(pos, target, f, cx, cy, roll = 0) {
    const fwd = norm(sub(target, pos)); let right = norm(cross(fwd, [0, 1, 0])); let up = cross(right, fwd);
    if (roll) { const c = Math.cos(roll), s = Math.sin(roll); const r2 = add(mul(right, c), mul(up, s)), u2 = add(mul(up, c), mul(right, -s)); right = r2; up = u2; }
    return { pos, fwd, right, up, f, cx, cy, proj(p) { const d = sub(p, pos); const z = dot(d, fwd); return [this.cx + f * dot(d, right) / z, this.cy - f * dot(d, up) / z, z]; } };
  }

  return { W, H, R, ALL, hex, thr, q4, clamp, sstep, lerp, rampc, dith2, mulberry, hash, vnoise, fbm, surf, screen, pset, pget, fill, rect, blit, line, lineP, linef, poly, disc, ring, deorphan, v3, add, sub, mul, dot, cross, norm, camera };
})();
if (typeof module !== 'undefined') module.exports = PX;
