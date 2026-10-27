/* The Lantern Library — Quiet Hours, piece 3.
 *
 * An endless well of books, rising forever. Three layers are painted once, at mount, into vertically
 * wrapping strips of palette indices: the near galleries (288 px period), the middle galleries and their
 * staircase (216 px) and the far stepped helix of shelves (144 px). Each is drawn natively at its own
 * scale (1, 3/4, 1/2) so a single world module of rise maps to a whole number of pixels on every layer,
 * and the camera climbs exactly one module in D = 24 s: the frame at t = D is the frame at t = 0.
 * Every frame copies the strips, draws the moving things (swaying lanterns, turning pages, a turning
 * globe, candle flames, a clock, a sleeping cat), lights each layer with stepped, Bayer-dithered warm
 * pools, adds the skylight shafts and their dust, and quantises to a 45-colour palette at 360 × 450.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 360, H = 450, NP = W * H, D = 24;
  const TAU = Math.PI * 2;
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
  const SEED = 7;
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(((c | 0) + SEED * 7919) | 0, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function vn1(x, s) { const i = fl(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(ih(i, 17, s), ih(i + 1, 17, s), u); }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  // stepped light: n levels, with the dithered seam between two levels squeezed to a narrow band
  function band(v, n, b, sh) { const s = v * n, f0 = fl(s), fr = s - f0, fs = (fr - 0.5) * sh + 0.5; return (f0 + (fs > b ? 1 : 0)) / n; }

  /* ================================================================ palette (45) */
  const PAL_DEF = [
    ['n0', '05060e'], ['n1', '0a0d1d'], ['n2', '10152b'], ['n3', '171e3c'], ['n4', '1f294f'], ['n5', '2a3663'],
    ['n6', '374579'], ['n7', '4a5a92'], ['n8', '6271aa'], ['n9', '8796c6'], ['n10', 'b2bee0'], ['n11', 'e2e8f6'],
    ['p0', '1d1226'], ['p1', '2c1a31'], ['p2', '42273e'],
    ['u0', '150c0a'], ['u1', '22130e'], ['u2', '331c13'], ['u3', '482919'], ['u4', '603720'], ['u5', '7a4929'], ['u6', '955d33'],
    ['a0', 'b27a3c'], ['a1', 'cd9747'], ['a2', 'e3b35a'], ['a3', 'f2cf7c'], ['a4', 'fce8a8'], ['a5', 'fff8e2'],
    ['r0', '3c1320'], ['r1', '5c1e2b'], ['r2', '80303a'], ['r3', 'a44a44'],
    ['g0', '12291f'], ['g1', '1d4132'], ['g2', '2d5b40'], ['g3', '467950'], ['g4', '78a667'],
    ['t0', '162f42'], ['t1', '234758'], ['t2', '386873'],
    ['o0', '564c26'], ['o1', '7a6c34'], ['o2', 'a09147'],
    ['q0', 'c8b38a'], ['q1', 'e6d6b0'],
  ];
  const C = {};
  const PAL = PAL_DEF.map(([k, h], i) => { C[k] = i; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; });
  const NPAL = PAL.length;
  const LUT = new Uint8Array(32768);
  function nearest(r, g, b) {
    let best = 0, bd = 1e18;
    for (let k = 0; k < NPAL; k++) {
      const p = PAL[k], dr = r - p[0], dg = g - p[1], db = b - p[2];
      const rm = (r + p[0]) * 0.5;
      const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  function buildLUT() {
    for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 32; b++)
      LUT[(r << 10) | (g << 5) | b] = nearest(r * 8 + 4, g * 8 + 4, b * 8 + 4);
  }

  // book families, dark to light
  const FAM = [
    [C.r0, C.r1, C.r2, C.r3], [C.g0, C.g1, C.g2, C.g3], [C.t0, C.t1, C.t2], [C.u3, C.u4, C.u5, C.u6],
    [C.o0, C.o1, C.o2], [C.n4, C.n5, C.n6, C.n7], [C.p1, C.p2, C.r1], [C.u5, C.u6, C.a0, C.a1], [C.o1, C.q0, C.q1],
  ];
  const FAMW = [3.2, 2.2, 1.5, 3, 1.4, 2, 1, 1.4, 0.9];
  const FAMWS = FAMW.reduce((a, b) => a + b, 0);
  function pickFam(rnd) { let r = rnd() * FAMWS; for (let k = 0; k < FAM.length; k++) { r -= FAMW[k]; if (r <= 0) return k; } return 0; }

  /* ================================================================ layers & pens */
  function mkLayer(P, li) {
    const n = W * P;
    return { P, li, c: new Uint8Array(n), m: new Uint8Array(n), wc: new Uint8Array(n), wm: new Uint8Array(n), lights: [], lanterns: [], flames: [], pages: [], motes: [], dyn: [] };
  }
  const NEAR = mkLayer(288, 0), MID = mkLayer(216, 1), FAR = mkLayer(144, 2);
  const LAYERS = [NEAR, MID, FAR];
  const LIT = 1, EMI = 2;
  let TL = NEAR, TC = NEAR.c, TM = NEAR.m, MODE = LIT;
  function target(L, work) { TL = L; TC = work ? L.wc : L.c; TM = work ? L.wm : L.m; }
  function put(x, y, col) {
    x = fl(x); if (x < 0 || x >= W) return;
    const P = TL.P; y = fl(y) % P; if (y < 0) y += P;
    const i = y * W + x; TC[i] = col + 1; TM[i] = MODE;
  }
  function get(x, y) { x = fl(x); if (x < 0 || x >= W) return -1; const P = TL.P; y = fl(y) % P; if (y < 0) y += P; return TC[y * W + x] - 1; }
  function clear(x, y) { x = fl(x); if (x < 0 || x >= W) return; const P = TL.P; y = fl(y) % P; if (y < 0) y += P; TC[y * W + x] = 0; }
  function rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c); }
  function hl(x0, x1, y, c) { for (let x = x0; x <= x1; x++) put(x, y, c); }
  function vl(x, y0, y1, c) { for (let y = y0; y <= y1; y++) put(x, y, c); }
  function line(x0, y0, x1, y1, c, every) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy, n = 0;
    for (;;) {
      if (!every || n % every === 0) put(x0, y0, c);
      n++;
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  function ell(cx, cy, rx, ry, c, fn) {
    for (let y = fl(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = fl(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry;
        if (u * u + v * v <= 1) { const k = fn ? fn(x, y, u, v) : c; if (k >= 0) put(x, y, k); }
      }
  }
  function poly(pts, c) {
    let y0 = 1e9, y1 = -1e9;
    for (const p of pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    for (let y = fl(y0); y <= Math.ceil(y1); y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) put(x, y, c);
    }
  }
  function spr(rows, map, x, y, flip) {
    for (let j = 0; j < rows.length; j++) {
      const r = rows[j], w = r.length;
      for (let i = 0; i < w; i++) {
        const ch = r[i]; if (ch === '.' || ch === ' ') continue;
        const m = map[ch]; if (m === undefined) continue;
        put(x + (flip ? w - 1 - i : i), y + j, m);
      }
    }
  }
  // lights: x, y in strip coords; rx, ry radii; I intensity; y0..y1 vertical clip (strip coords); n1/n2 flicker cycles per loop
  function light(L, x, y, rx, ry, I, y0, y1, o) {
    const q = Object.assign({ x, y, rx, ry, I, y0: y0 === undefined ? -1e6 : y0, y1: y1 === undefined ? 1e6 : y1, n1: 0, n2: 0, a1: 0, a2: 0, p1: 0, p2: 0, glow: 0, gr: 0 }, o || {});
    L.lights.push(q); return q;
  }

  /* ================================================================ books */
  let NOFLAME = false;
  function spine(x, yb, w, h, f, sh, st) {
    const R = FAM[f], n = R.length;
    const md = R[clamp(sh, 0, n - 1)], lt = R[clamp(sh + 1, 0, n - 1)], dk = R[clamp(sh - 1, 0, n - 1)];
    const top = yb - h;
    for (let i = 0; i < w; i++) vl(x + i, top, yb - 1, w === 1 ? md : i === 0 ? lt : i === w - 1 ? dk : md);
    if ((st & 1) && h >= 5) {
      const gc = (f === 3 || f === 7 || f === 0) ? C.a1 : C.a0;
      for (let i = 0; i < w; i++) { if (w >= 3 && i === w - 1) continue; put(x + i, top + 1, gc); put(x + i, yb - 2, gc); }
    }
    if ((st & 2) && w >= 2 && h >= 7) { const lx = x + (w >= 3 ? 1 : 0), ly = top + 3; put(lx, ly, C.q0); put(lx, ly + 1, C.q0); }
    if ((st & 4) && h >= 6) for (let k = 1; k <= 2; k++) { const y = top + Math.round(h * k / 3); for (let i = 0; i < w; i++) put(x + i, y, dk === md ? C.u1 : dk); }
    if ((st & 8) && h >= 6 && w >= 2) put(x, top + 2 + ((h - 4) >> 1), C.a2);
  }
  function leanBook(x, yb, w, h, f, sh, dir, s) {
    const R = FAM[f], n = R.length;
    const md = R[clamp(sh, 0, n - 1)], lt = R[clamp(sh + 1, 0, n - 1)], dk = R[clamp(sh - 1, 0, n - 1)];
    for (let k = 0; k < h; k++) {
      const y = yb - 1 - k, o = Math.round(s * k / (h - 1)) * dir;
      for (let i = 0; i < w; i++) put(x + i + o, y, w === 1 ? md : i === 0 ? lt : i === w - 1 ? dk : md);
    }
    const tx = x + s * dir;
    if (h >= 6) put(tx + (dir < 0 ? 0 : w - 1), yb - h + 1, C.a0);
  }
  function pile(x, yb, pw, clr, rnd, th) {
    let y = yb - 1;
    const n = 2 + fl(rnd() * 3);
    for (let j = 0; j < n && (yb - 1 - y) + th <= clr - 1; j++) {
      const f = pickFam(rnd), bw = pw - fl(rnd() * 3), dx = fl(rnd() * (pw - bw + 1));
      const R = FAM[f], md = R[1 % R.length], lt = R[Math.min(2, R.length - 1)], dk = R[0];
      const edge = rnd() < 0.25;
      for (let t = 0; t < th; t++) hl(x + dx, x + dx + bw - 1, y - t, edge ? (t === th - 1 ? C.q1 : C.q0) : (t === th - 1 ? lt : md));
      put(x + dx, y, dk); put(x + dx + bw - 1, y, dk);
      if (!edge && bw >= 5) { put(x + dx + 1, y - th + 1, C.a0); put(x + dx + bw - 2, y - th + 1, C.a0); }
      y -= th;
    }
    return yb - 1 - y; // height used
  }
  // small objects on a near shelf; returns width used
  function shelfObject(x, yb, clr, room, rnd, L) {
    const k = fl(rnd() * 8);
    if (k === 0 && room >= 4) { // glass jar
      const h = Math.min(5, clr - 2);
      for (let y = yb - h; y < yb; y++) { put(x, y, C.t1); put(x + 1, y, C.t2); put(x + 2, y, C.t1); }
      put(x + 1, yb - h + 1, C.n10); hl(x, x + 2, yb - h - 1, C.u4); hl(x, x + 2, yb - 2, C.a0);
      return 4;
    }
    if (k === 1 && room >= 4) { // hourglass
      hl(x, x + 2, yb - 1, C.u5); hl(x, x + 2, yb - 6, C.u5);
      put(x, yb - 5, C.u3); put(x + 2, yb - 5, C.u3); put(x, yb - 2, C.u3); put(x + 2, yb - 2, C.u3);
      put(x + 1, yb - 5, C.q0); put(x + 1, yb - 4, C.a1); put(x + 1, yb - 3, C.q0); put(x + 1, yb - 2, C.a1);
      return 4;
    }
    if (k === 2 && room >= 5) { // skull
      hl(x + 1, x + 3, yb - 5, C.q0); hl(x, x + 4, yb - 4, C.q1); hl(x, x + 4, yb - 3, C.q1); hl(x + 1, x + 3, yb - 2, C.q0); hl(x + 1, x + 3, yb - 1, C.q0);
      put(x + 1, yb - 3, C.u1); put(x + 3, yb - 3, C.u1); put(x + 2, yb - 1, C.u2);
      return 6;
    }
    if (k === 3 && room >= 4) { // potted plant
      hl(x, x + 2, yb - 1, C.u5); hl(x, x + 2, yb - 2, C.u6); hl(x - 0, x + 2, yb - 3, C.u4);
      put(x + 1, yb - 4, C.g3); put(x, yb - 5, C.g2); put(x + 2, yb - 5, C.g3); put(x + 1, yb - 6, C.g4); put(x - 1, yb - 6, C.g2); put(x + 3, yb - 7, C.g2);
      return 5;
    }
    if (k === 4 && room >= 3 && !NOFLAME) { // candle stub, lit
      vl(x + 1, yb - 3, yb - 1, C.q1); put(x, yb - 1, C.a0); put(x + 2, yb - 1, C.a0);
      L.flames.push({ x: x + 1, y: yb - 4, ph: rnd() * TAU });
      light(L, x + 1, yb - 6, 13, 10, 0.45, undefined, undefined, { n1: 19, a1: 0.08, p1: rnd() * TAU, n2: 31, a2: 0.05, p2: rnd() * TAU });
      return 3;
    }
    if (k === 5 && room >= 4) { // brass astrolabe on a foot
      ell(x + 1.5, yb - 4.5, 1.9, 1.9, C.a1, (px, py, u, v) => (u * u + v * v > 0.35 ? C.a1 : C.u2));
      put(x + 1, yb - 1, C.u5); put(x + 2, yb - 1, C.u5);
      return 4;
    }
    if (k === 6 && room >= 5) { // scroll pile
      for (const [dx, dy] of [[0, 0], [2, 0], [1, 2]]) { put(x + dx, yb - 2 - dy, C.q0); put(x + dx + 1, yb - 2 - dy, C.q1); put(x + dx, yb - 1 - dy, C.q0); put(x + dx + 1, yb - 1 - dy, C.u5); }
      return 5;
    }
    if (room >= 4) { // bookend
      vl(x, yb - 6, yb - 1, C.u5); vl(x + 1, yb - 5, yb - 1, C.u4); put(x, yb - 7, C.a1);
      return 2;
    }
    return 1;
  }
  // fill one shelf segment [x0, x1] standing on yb (the board), clearance clr
  function bookRun(x0, x1, yb, clr, rnd, sc, L) {
    let x = x0;
    const wmax = sc === 0 ? 3 : 2;
    while (x <= x1) {
      const r = rnd(), room = x1 - x + 1;
      if (r < 0.45) { // a matched set
        const n = 3 + fl(rnd() * 7), f = pickFam(rnd), sh = 1 + fl(rnd() * 2);
        const w = sc === 0 ? (rnd() < 0.62 ? 2 : rnd() < 0.5 ? 1 : 3) : (rnd() < 0.55 ? 1 : 2);
        const h = clr - fl(rnd() * (sc === 0 ? 3 : 2));
        const st = rnd() < 0.62 ? (1 | (rnd() < 0.45 ? 2 : 0)) : (rnd() < 0.4 ? 4 : rnd() < 0.5 ? 8 : 0);
        for (let k = 0; k < n && x + w - 1 <= x1; k++) {
          if (k > 0 && rnd() < 0.04 && x + w + 1 <= x1) { x += w; continue; } // one missing from the set
          spine(x, yb, w, h, f, sh, st); x += w;
        }
      } else if (r < 0.77) { // odd volumes
        const n = 1 + fl(rnd() * 4);
        for (let k = 0; k < n && x <= x1; k++) {
          const w = Math.min(x1 - x + 1, 1 + fl(rnd() * wmax));
          const h = clr - fl(rnd() * clr * 0.42);
          const f = pickFam(rnd);
          spine(x, yb, w, h, f, fl(rnd() * 3), rnd() < 0.5 ? 1 : rnd() < 0.5 ? 2 : 4);
          x += w;
        }
      } else if (r < 0.85 && room >= (sc === 0 ? 7 : 5)) { // a pile lying flat, maybe something on top
        const pw = Math.min(room - 1, (sc === 0 ? 6 : 4) + fl(rnd() * 4));
        const hu = pile(x, yb, pw, clr, rnd, sc === 0 ? 2 : 1);
        if (sc === 0 && rnd() < 0.35 && clr - hu >= 4 && !NOFLAME) { vl(x + (pw >> 1), yb - hu - 3, yb - hu - 1, C.q1); L.flames.push({ x: x + (pw >> 1), y: yb - hu - 4, ph: rnd() * TAU }); light(L, x + (pw >> 1), yb - hu - 6, 12, 9, 0.4, undefined, undefined, { n1: 23, a1: 0.08, p1: rnd() * TAU }); }
        x += pw + 1;
      } else if (r < 0.92 && room >= 6) { // a gap with a leaning book
        const w = sc === 0 ? 2 : 1, s = sc === 0 ? 3 : 2, h = clr - 1 - fl(rnd() * 2);
        leanBook(x + s, yb, w, h, pickFam(rnd), 1 + fl(rnd() * 2), -1, s);
        x += s + w;
      } else if (r < 0.965 && sc === 0 && room >= 4) {
        x += shelfObject(x, yb, clr, room, rnd, L) + (rnd() < 0.5 ? 1 : 0);
      } else {
        x += 1 + fl(rnd() * 3);
      }
    }
  }

  /* ================================================================ far wall: a stepped helix of shelves */
  function buildFar() {
    target(FAR, false); MODE = LIT;
    const P = FAR.P, rnd = mulberry32(9101);
    rect(0, 0, W, P, C.u1);
    const R = 236, cx = 180, dth = 11.5 / R;
    for (let k = -18; k <= 18; k++) {
      const xa = Math.round(cx + R * Math.sin((k - 0.5) * dth)), xb = Math.round(cx + R * Math.sin((k + 0.5) * dth)) - 1;
      if (xb < -2 || xa > W + 1) continue;
      const o = (((-k * 5) % 48) + 48) % 48;
      vl(xa, 0, P - 1, C.u3);
      for (let lev = 0; lev < 3; lev++) {
        const Ly = o + lev * 48;
        // shelves
        const door = rnd() < 0.11 && xb - xa >= 7;
        for (let r = 0; r < 6; r++) {
          const by = Ly - 5 - 6 * r;
          hl(xa + 1, xb, by, C.u3);
          if (door && r < 3) continue;
          let x = xa + 1;
          while (x <= xb) {
            const q = rnd();
            if (q < 0.85) {
              const n = 2 + fl(rnd() * 6), f = pickFam(rnd), sh = 1 + fl(rnd() * 2), h = 5 - (rnd() < 0.3 ? 1 : 0) - (rnd() < 0.15 ? 1 : 0);
              for (let j = 0; j < n && x <= xb; j++) { const Rm = FAM[f]; vl(x, by - h, by - 1, Rm[clamp(sh + ((j & 1) ? 0 : 0), 0, Rm.length - 1)]); if (rnd() < 0.5) put(x, by - h + 1, C.a0); x++; }
            } else if (q < 0.93) {
              const f = pickFam(rnd), Rm = FAM[f]; vl(x, by - 3 - fl(rnd() * 3), by - 1, Rm[fl(rnd() * Rm.length)]); x++;
            } else x++;
          }
        }
        if (door) { // a little arched doorway, some with a lamp burning inside
          const dw = xb - xa - 2, dx0 = xa + 2, dtop = Ly - 19, lit = rnd() < 0.6;
          for (let y = dtop; y <= Ly - 1; y++) for (let x = dx0; x < dx0 + dw; x++) {
            const u = (x + 0.5 - (dx0 + dw / 2)) / (dw / 2), v = (y - dtop - dw / 2) / (dw / 2);
            if (y - dtop < dw / 2 && u * u + v * v > 1) continue;
            put(x, y, Math.abs(u) > 0.7 ? C.u3 : C.n1);
          }
          if (lit) { MODE = EMI; put(fl(dx0 + dw / 2), Ly - 3, C.a1); put(fl(dx0 + dw / 2), Ly - 4, C.a3); MODE = LIT; light(FAR, dx0 + dw / 2, Ly - 5, 9, 9, 0.6); }
        }
        // walkway ledge and railing
        hl(xa, xb, Ly, C.u5); hl(xa, xb, Ly + 1, C.u3); hl(xa, xb, Ly + 2, C.u1); hl(xa, xb, Ly + 3, C.u0);
        hl(xa + 1, xb, Ly - 4, C.u4);
        for (let x = xa + 1; x <= xb; x++) if (((x - xa) & 1) === 0) vl(x, Ly - 3, Ly - 1, C.u3); else vl(x, Ly - 3, Ly - 1, C.u1);
        // cornice under the next ledge
        hl(xa + 1, xb, Ly - 44, C.u2); hl(xa + 1, xb, Ly - 43, C.u4);
        for (let x = xa + 1; x <= xb; x += 2) put(x, Ly - 42, C.u3);
        if (rnd() < 0.5) {
          const lx = xa + 2 + fl(rnd() * Math.max(1, xb - xa - 3));
          MODE = EMI; put(lx, Ly - 7, C.a3); put(lx, Ly - 6, C.a1); MODE = LIT; put(lx, Ly - 8, C.u4); put(lx, Ly - 5, C.u4);
          light(FAR, lx + 0.5, Ly - 4, 19, 9, 0.85, undefined, Ly + 2, { n1: 7 + fl(rnd() * 9), a1: 0.08, p1: rnd() * TAU, glow: 0.18, gr: 5 });
        }
      }
    }
  }

  /* ================================================================ middle galleries and their staircase */
  function midGallery(side, Fy, rnd) {
    const x0 = side === 0 ? 0 : 244, x1 = side === 0 ? 116 : 359;
    const top = Fy - 66;
    rect(x0, top, x1 - x0 + 1, 66, C.u1);
    // cornice
    hl(x0, x1, top, C.u2); hl(x0, x1, top + 1, C.u4); for (let x = x0; x <= x1; x += 2) put(x, top + 2, C.u3);
    // bays
    const edges = [];
    if (side === 0) { for (let e = 116; e > -14; e -= 14) edges.push(e); edges.reverse(); }
    else { for (let e = 244; e < 374; e += 14) edges.push(e); }
    for (let b = 0; b < edges.length - 1; b++) {
      const ba = edges[b] + 1, bb = edges[b + 1] - 1;
      for (let r = 0; r < 7; r++) {
        const by = top + 3 + 8 * r + 7;
        hl(ba, bb, by, C.u4);
        bookRun(ba, bb, by, 7, rnd, 1, MID);
      }
    }
    for (const e of edges) { vl(e, top + 2, Fy - 1, C.u3); if (e + 1 <= x1) vl(e + 1, top + 2, Fy - 1, C.u2); }
    // plinth
    rect(x0, Fy - 6, x1 - x0 + 1, 6, C.u3); hl(x0, x1, Fy - 6, C.u4); hl(x0, x1, Fy - 1, C.u2);
    // pillar at the void edge
    const px = side === 0 ? 117 : 238;
    const shade = [C.u2, C.u4, C.u5, C.u3, C.u1];
    for (let i = 0; i < 5; i++) vl(px + i, top, Fy - 1, shade[side === 0 ? i : 4 - i]);
    hl(px - 1, px + 5, top + 1, C.u4); hl(px - 1, px + 5, Fy - 2, C.u4);
  }
  function midSlab(Fy) {
    for (const [a, b] of [[0, 126], [234, 359]]) {
      hl(a, b, Fy, C.u5); hl(a, b, Fy + 1, C.u3); hl(a, b, Fy + 2, C.a0); hl(a, b, Fy + 3, C.u3); hl(a, b, Fy + 4, C.u2); hl(a, b, Fy + 5, C.u1);
      for (let x = a + 6; x < b - 2; x += 18) { hl(x, x + 2, Fy + 6, C.u3); put(x + 1, Fy + 7, C.u2); }
    }
  }
  function buildMid() {
    target(MID, false); MODE = LIT;
    const rnd = mulberry32(5501);
    for (const Fy of [72, 144, 216]) { midGallery(0, Fy, rnd); midGallery(1, Fy, rnd); }
    midSlab(0); midSlab(72); midSlab(144);
    MID.lanterns.push({ px: 128, py: 216 - 54, arm: [122, 128], len: 5, sz: 1, n: 3, ph: 0.8, amp: 0.12, I: 0.85, rx: 40, ry: 32, y0: 216 - 66, y1: 222 });
    // arm lanterns at the void edge
    MID.lanterns.push({ px: 128, py: 72 - 52, arm: [122, 128], len: 4, sz: 1, n: 5, ph: 0.3, amp: 0.12, I: 0.9, rx: 40, ry: 32, y0: 72 - 66, y1: 78 });
    MID.lanterns.push({ px: 232, py: 144 - 50, arm: [237, 232], len: 6, sz: 1, n: 4, ph: 1.7, amp: 0.12, I: 0.9, rx: 40, ry: 32, y0: 144 - 66, y1: 150 });
    MID.lanterns.push({ px: 232, py: 72 - 54, arm: [237, 232], len: 3, sz: 1, n: 6, ph: 2.9, amp: 0.1, I: 0.7, rx: 34, ry: 28, y0: 72 - 66, y1: 78 });
    // the staircase: from the left floor at 72 up to the right floor at 0; a little bridge under it at 72
    stair(127, 72, 233, 0, 18, { rail: 9, th: 5, inv: true, post: 12 });
    // a lamp standing on the stair, and its twin standing upside down on the stair beneath
    vl(180, 28, 35, C.u4); put(181, 35, C.u3); drawLantern(180, 19, 1);
    vl(180, 44, 50, C.u4); put(181, 44, C.u3); drawLanternFlip(180, 59);
    light(MID, 180.5, 24, 30, 20, 0.8, undefined, undefined, { n1: 5, a1: 0.05, glow: 0.4, gr: 8 });
    light(MID, 180.5, 55, 30, 20, 0.8, undefined, undefined, { n1: 5, a1: 0.05, p1: 1, glow: 0.4, gr: 8 });
    midBridge(144);
    MID.lanterns.push({ px: 180, py: 144 + 10, arm: null, len: 4, sz: 1, n: 5, ph: 2.2, amp: 0.1, I: 0.85, rx: 36, ry: 26, glow: 0.45 });
  }
  function midBridge(Fy) {
    const a = 127, b = 233;
    hl(a, b, Fy, C.u5); hl(a, b, Fy + 1, C.u3); hl(a, b, Fy + 2, C.u2); hl(a, b, Fy + 3, C.u1);
    for (let x = a; x <= b; x++) { const u = (x - 180) / 54, ya = Fy + 4 + Math.round(5 * (1 - u * u)); put(x, ya, C.u3); if ((x - a) % 6 === 3) vl(x, Fy + 4, ya - 1, C.u2); }
    hl(a, b, Fy - 6, C.u4);
    for (let x = a + 2; x < b; x += 3) vl(x, Fy - 5, Fy - 1, C.u2);
  }
  // a straight flight between floor yl at xl and floor yr at xr (either may be the higher one)
  function stair(xl, yl, xr, yr, n, o) {
    const up = yr < yl ? 1 : -1;               // 1: rises to the right
    const yLow = Math.max(yl, yr), span = xr - xl + 1, run = span / n, rise = Math.abs(yl - yr) / n;
    const sOf = (x) => (up > 0 ? x - xl : xr - x);
    const nose = (x) => yLow - sOf(x) * (rise * n) / span;
    const tread = (x) => yLow - rise * (fl(sOf(x) / run) + 1);
    const th = o.th;
    for (let x = xl; x <= xr; x++) {
      const t = Math.round(tread(x)), bot = Math.round(nose(x)) + th;
      put(x, t, C.u6);
      for (let y = t + 1; y <= bot; y++) put(x, y, y === bot ? C.u1 : y === t + 1 ? C.u4 : y === bot - 2 ? C.u5 : C.u3);
      if (o.inv) { // the Escher bit: a second flight hangs upside down beneath the first
        const bt = Math.round(2 * (nose(x) + th / 2) - tread(x)) + 1;
        for (let y = bot + 1; y <= bt; y++) put(x, y, y === bt ? C.u4 : C.u2);
        put(x, Math.round(nose(x)) + th + o.rail + 10, C.u4);
      }
      put(x, Math.round(nose(x)) - o.rail, C.u5);
    }
    for (let k = 0; k < n; k++) {
      const s0 = Math.round(k * run), x = up > 0 ? xl + s0 : xr - s0;
      const t = Math.round(tread(x));
      vl(x, t, t + Math.round(rise) - 1, C.u2);
      const xm = up > 0 ? Math.round(xl + (k + 0.5) * run) : Math.round(xr - (k + 0.5) * run);
      vl(xm, Math.round(nose(xm)) - o.rail + 1, Math.round(tread(xm)) - 1, C.u3);
      if (o.inv) { const bt = Math.round(2 * (nose(xm) + th / 2) - tread(xm)) + 1; vl(xm, bt + 1, Math.round(nose(xm)) + th + o.rail + 9, C.u2); }
    }
    for (const [x, y] of [[xl, yl], [xr - 1, yr]]) { rect(x, y - o.post, 2, o.post, C.u4); vl(x, y - o.post, y - 1, C.u5); put(x, y - o.post - 1, C.a1); put(x + 1, y - o.post - 1, C.a0); }
  }

  /* ================================================================ near galleries */
  const NL = 96; // near level height
  const BAYS = {
    L4: [[0, 16], [19, 36], [39, 56], [59, 76]], L3: [[0, 22], [25, 49], [52, 76]],
    R4: [[343, 359], [323, 340], [303, 320], [283, 300]], R3: [[337, 359], [310, 334], [283, 307]],
  };
  function nearGallery(side, Fy, rnd, opt) {
    const top = Fy - NL + 8;
    const x0 = side === 0 ? 0 : 282, x1 = side === 0 ? 77 : 359;
    rect(x0, top, x1 - x0 + 1, NL - 8, C.u1);
    // cornice
    hl(x0, x1, top, C.u2); hl(x0, x1, top + 1, C.u4); hl(x0, x1, top + 2, C.u5);
    for (let x = x0; x <= x1; x++) put(x, top + 3, (x & 1) ? C.u3 : C.u1);
    hl(x0, x1, top + 4, C.u2);
    const bays = BAYS[opt.bays || (side === 0 ? 'L4' : 'R4')];
    const sp = opt.special || {};
    const drawArch = (ba, bb) => { // a doorway out of the gallery, into the dark
        const ya = top + 5 + 22, mx = (ba + bb) / 2, hw = (bb - ba + 1) / 2;
        for (let y = ya; y <= Fy - 1; y++) for (let x = ba; x <= bb; x++) {
          const u = (x + 0.5 - mx) / hw, v = (y + 0.5 - (ya + hw)) / hw;
          if (y < ya + hw && u * u + v * v > 1) { put(x, y, C.u2); continue; }
          const edge = Math.abs(u) > 0.8 || (y < ya + hw && u * u + v * v > 0.66);
          put(x, y, edge ? (u < 0 ? C.u5 : C.u3) : y > Fy - 4 ? C.n3 : C.n1);
        }
        // three steps going down into the dark beyond
        for (let k = 0; k < 3; k++) hl(fl(mx - hw * 0.55) + k, Math.ceil(mx + hw * 0.55) - k, Fy - 6 - k * 3, k === 0 ? C.n4 : C.n3);
        MODE = EMI; put(Math.round(mx + 1), Fy - 17, C.u5); MODE = LIT;
        hl(ba, bb, ya - 1, C.u5);
          };
    bays.forEach(([ba, bb], bi) => {
      const skip = opt.skipRows && opt.skipRows[bi];
      for (let r = 0; r < 7; r++) {
        const by = top + 5 + 11 * r + 10;
        hl(ba, bb, by, C.u5); hl(ba, bb, by - 11 + 1, C.u0);
        if (skip && skip.indexOf(r) >= 0) continue;
        if (sp[bi] === 'arch' && r >= 2) continue;
        if (opt.cat && opt.cat[0] === bi && opt.cat[1] === r) { // a cat asleep in a gap on the shelf
          NEAR.dyn.push({ kind: 'cat', x: ba, y: by - 10 });
          NOFLAME = true; bookRun(ba + 18, bb, by, 10, rnd, 0, NEAR); NOFLAME = false;
          continue;
        }
        if (sp[bi] === 'folios' && r >= 4) { let x = ba; while (x < bb - 4) { const pw = Math.min(bb - x + 1, 7 + fl(rnd() * 5)); pile(x, by, pw, 10, rnd, 2); x += pw + 1; } continue; }
        if (sp[bi] === 'bust' && r === 1) {
          const cx = (ba + bb) >> 1;
          bookRun(ba, cx - 5, by, 10, rnd, 0, NEAR); bookRun(cx + 5, bb, by, 10, rnd, 0, NEAR);
          // a small marble bust on a plinth
          hl(cx - 2, cx + 2, by - 1, C.q0); hl(cx - 1, cx + 1, by - 2, C.q0);
          hl(cx - 3, cx + 3, by - 3, C.q0); hl(cx - 3, cx + 3, by - 4, C.q1); hl(cx - 2, cx + 2, by - 5, C.q1);
          hl(cx - 1, cx + 1, by - 6, C.q1); hl(cx - 1, cx + 2, by - 7, C.q1); hl(cx - 1, cx + 1, by - 8, C.q1); hl(cx - 1, cx + 1, by - 9, C.q0);
          put(cx + 2, by - 7, C.q0); put(cx - 1, by - 7, C.q0); put(cx + 1, by - 4, C.q0); put(cx + 2, by - 5, C.q0);
          continue;
        }
        NOFLAME = !!(opt.cat && opt.cat[0] === bi);
        bookRun(ba, bb, by, 10, rnd, 0, NEAR);
        NOFLAME = false;
      }
      if (sp[bi] === 'glass') { // glazed doors over the upper shelves
        const yA = top + 5, yB = top + 5 + 33, mx = (ba + bb) >> 1;
        for (const x of [ba, mx, bb]) vl(x, yA, yB, C.u5);
        hl(ba, bb, yA, C.u5); hl(ba, bb, yB, C.u5);
        for (let r = 1; r < 3; r++) hl(ba, bb, yA + 11 * r, C.u5);
        for (const [pa, pb] of [[ba + 1, mx - 1], [mx + 1, bb - 1]]) for (let r = 0; r < 3; r++) {
          const y0 = yA + 11 * r + 2; put(pa + 1, y0, C.n9); put(pa, y0 + 1, C.n8); put(pa + 2, y0, C.n8); put(pb - 1, y0 + 6, C.n7);
        }
        put(mx - 1, yA + 18, C.a1); put(mx + 1, yA + 18, C.a1);
      }
    });
    // uprights between the bays
    const sorted = bays.slice().sort((p, q) => p[0] - q[0]);
    for (let k = 0; k + 1 < sorted.length; k++) {
      const u = sorted[k][1] + 1;
      vl(u, top + 4, Fy - 1, C.u4); vl(u + 1, top + 4, Fy - 1, C.u2); put(u, top + 5, C.u5);
    }
    vl(side === 0 ? 77 : 282, top + 4, Fy - 1, C.u2);
    // plinth with panels
    const py = top + 5 + 77 + 1;
    rect(x0, py, x1 - x0 + 1, Fy - py, C.u3);
    hl(x0, x1, py, C.u5); hl(x0, x1, Fy - 1, C.u2);
    bays.forEach(([ba, bb], bi) => {
      if (sp[bi] === 'arch') return;
      const a = Math.max(ba + 1, x0), b = Math.min(bb - 1, x1);
      hl(a, b, py + 2, C.u2); hl(a, b, Fy - 3, C.u4); vl(a, py + 2, Fy - 3, C.u2); vl(b, py + 2, Fy - 3, C.u4);
      put((a + b) >> 1, py + 3 + ((Fy - py - 5) >> 1), C.a1);
    });
    bays.forEach(([ba, bb], bi) => { if (sp[bi] === 'arch') drawArch(ba, bb); });
    // pillar at the void edge
    const px = side === 0 ? 78 : 276;
    const shade = [C.u2, C.u4, C.u5, C.u6, C.u4, C.u2];
    for (let i = 0; i < 6; i++) vl(px + i, top, Fy - 1, shade[side === 0 ? i : 5 - i]);
    hl(px - 1, px + 6, top + 1, C.u4); hl(px - 1, px + 6, top + 2, C.u5); hl(px - 1, px + 6, top + 3, C.u3);
    hl(px - 1, px + 6, Fy - 3, C.u5); hl(px - 1, px + 6, Fy - 2, C.u4); hl(px - 1, px + 6, Fy - 1, C.u3);
    for (const fy of [0.33, 0.66]) { const y = Math.round(top + (Fy - top) * fy); hl(px, px + 5, y, C.a0); }
  }
  function nearSlab(side, Fy) {
    const [a, b] = side === 0 ? [0, 87] : [272, 359];
    hl(a, b, Fy, C.u6); hl(a, b, Fy + 1, C.u4); hl(a, b, Fy + 2, C.a0);
    for (let x = a; x <= b; x++) {
      const k = (x - a) % 8;
      put(x, Fy + 3, k === 0 || k === 4 ? C.u2 : C.u4);
      put(x, Fy + 4, k === 2 ? C.a1 : (k === 0 || k === 4 ? C.u2 : C.u3));
      put(x, Fy + 5, k === 0 || k === 4 ? C.u2 : C.u3);
    }
    hl(a, b, Fy + 6, C.u2); hl(a, b, Fy + 7, C.u1);
    for (let x = a + 5; x < b - 2; x += 20) { hl(x, x + 3, Fy + 8, C.u3); hl(x + 1, x + 2, Fy + 9, C.u3); put(x + 1, Fy + 10, C.u2); }
    vl(side === 0 ? 87 : 272, Fy, Fy + 7, C.u2);
    const x0 = side === 0 ? 84 : 275, d = side === 0 ? 1 : -1;
    for (let j = 0; j < 6; j++) { const w = 4 - (j >> 1); for (let i = 0; i < w; i++) put(x0 + d * i, Fy + 8 + j, j === 5 ? C.u2 : C.u3); }
  }
  function nearStair() {
    // from the right floor at 144 up to the left floor at 96, across the void
    stair(88, 96, 271, 144, 16, { rail: 10, th: 5, inv: false, post: 12 });
    // a lamp post on the newel at the half landing
    const lx = 180, ly = Math.round(144 - (271 - lx) * 48 / 184) - 3;
    vl(lx, ly - 16, ly, C.u4); vl(lx + 1, ly - 16, ly, C.u2); hl(lx - 1, lx + 2, ly - 16, C.a0); put(lx, ly - 8, C.a0);
    NEAR.lanterns.push({ px: lx, py: ly - 30, arm: null, len: 0, sz: 2, n: 1, ph: 0, amp: 0, I: 1.0, rx: 48, ry: 34, glow: 0.65, post: true });
  }

  // furniture ---------------------------------------------------------
  function ladder(x, top, Fy) {
    hl(x - 6, x + 12, top + 6, C.a0);
    vl(x, top + 5, Fy - 1, C.u5); vl(x + 6, top + 5, Fy - 1, C.u4);
    for (let y = top + 10; y < Fy - 2; y += 5) { hl(x + 1, x + 5, y, C.u5); hl(x + 1, x + 5, y + 1, C.u2); }
    put(x, top + 5, C.a2); put(x + 6, top + 5, C.a2); put(x, Fy - 1, C.u2); put(x + 6, Fy - 1, C.u2);
  }
  function desk(x0, x1, Fy) {
    const ty = Fy - 14;
    hl(x0, x1, ty, C.u6); hl(x0, x1, ty + 1, C.u4);
    rect(x0 + 1, ty + 2, x1 - x0 - 1, 3, C.u3); hl(x0 + 1, x1 - 1, ty + 5, C.u2);
    const mx = (x0 + x1) >> 1;
    hl(mx - 4, mx + 4, ty + 2, C.u4); put(mx, ty + 3, C.a2);
    for (const lx of [x0 + 1, x1 - 2]) { vl(lx, ty + 5, Fy - 1, C.u4); vl(lx + 1, ty + 5, Fy - 1, C.u2); put(lx, ty + 9, C.u5); put(lx, Fy - 1, C.u5); }
    return ty;
  }
  function bankersLamp(x, ty) {
    hl(x - 2, x + 2, ty - 1, C.a0); hl(x - 1, x + 1, ty - 2, C.a1);
    vl(x, ty - 6, ty - 3, C.a1);
    hl(x - 4, x + 4, ty - 7, C.a2);
    hl(x - 4, x + 4, ty - 8, C.g2); put(x - 3, ty - 8, C.g4); put(x - 2, ty - 8, C.g3);
    hl(x - 3, x + 3, ty - 9, C.g3); put(x - 2, ty - 9, C.g4);
    hl(x - 2, x + 2, ty - 10, C.g2); put(x, ty - 11, C.a1);
    put(x + 3, ty - 6, C.a0); put(x + 3, ty - 5, C.a1);
    MODE = EMI; hl(x - 2, x + 2, ty - 6, C.a4); put(x, ty - 6, C.a5); MODE = LIT;
    light(NEAR, x, ty - 3, 22, 11, 1.0, undefined, ty + 4, { n1: 3, a1: 0.03 });
    light(NEAR, x, ty - 2, 40, 22, 0.32, undefined, ty + 16);
  }
  function openBook(cx, by, L, n, ph) {
    // lying open; by is the row the book rests on (desk top)
    hl(cx - 7, cx + 7, by - 1, C.r1);
    hl(cx - 6, cx - 1, by - 3, C.q1); hl(cx + 1, cx + 6, by - 3, C.q1);
    hl(cx - 6, cx - 1, by - 2, C.q0); hl(cx + 1, cx + 6, by - 2, C.q0);
    put(cx, by - 3, C.u4); put(cx, by - 2, C.u3);
    for (let x = cx - 5; x <= cx + 5; x += 2) if (x !== cx) put(x, by - 3, C.u5);
    NEAR.pages.push({ x: cx, y: by - 3, len: 6, dp: 2, n, ph, tilt: 0 });
  }
  function chair(x, Fy, dir) {
    const bx = dir > 0 ? x : x + 6;
    vl(bx, Fy - 24, Fy - 1, C.u4); put(bx, Fy - 25, C.a0);
    vl(bx + dir, Fy - 21, Fy - 12, C.r2); vl(bx + dir, Fy - 20, Fy - 13, C.r3);
    for (let i = 0; i <= 6; i++) { put(bx + dir * i, Fy - 11, C.r3); put(bx + dir * i, Fy - 10, C.r2); }
    for (let i = 0; i <= 6; i++) put(bx + dir * i, Fy - 9, C.u3);
    vl(bx + dir * 6, Fy - 8, Fy - 1, C.u4);
    vl(bx + dir * 1, Fy - 8, Fy - 1, C.u3);
  }
  function floorStack(x, Fy, n, rnd, w) {
    let y = Fy - 1;
    for (let j = 0; j < n; j++) {
      const f = pickFam(rnd), R = FAM[f], bw = w - fl(rnd() * 3), dx = fl(rnd() * 3) - 1, th = 2 + (rnd() < 0.3 ? 1 : 0);
      for (let t = 0; t < th; t++) hl(x + dx, x + dx + bw - 1, y - t, t === th - 1 ? R[Math.min(2, R.length - 1)] : R[1]);
      put(x + dx, y, R[0]); put(x + dx + bw - 1, y, R[0]);
      if (bw >= 6) { put(x + dx + 1, y - th + 1, C.a1); put(x + dx + bw - 2, y - th + 1, C.a1); }
      y -= th;
    }
    return y;
  }
  function lectern(x, Fy) {
    // feet and column
    hl(x - 6, x + 6, Fy - 1, C.u3); hl(x - 4, x + 4, Fy - 2, C.u4); hl(x - 2, x + 2, Fy - 3, C.u5);
    for (let y = Fy - 20; y <= Fy - 4; y++) { put(x - 1, y, C.u5); put(x, y, C.u4); put(x + 1, y, C.u2); }
    hl(x - 2, x + 2, Fy - 12, C.u6);
    // slanted desk
    for (let i = -9; i <= 9; i++) { const y = Fy - 22 - Math.round((i + 9) * 0.18); put(x + i, y, C.u5); put(x + i, y + 1, C.u3); put(x + i, y + 2, C.u2); }
    put(x - 9, Fy - 20, C.u4); put(x - 9, Fy - 19, C.u3);
    // great open book on it
    for (let i = -8; i <= 8; i++) {
      const y = Fy - 23 - Math.round((i + 9) * 0.18);
      const s = Math.abs(i);
      const hh = i === 0 ? 4 : 5 + (s < 3 ? 1 : 0) - (s > 6 ? 1 : 0);
      for (let k = 0; k < hh; k++) put(x + i, y - k, i === 0 ? C.u4 : k === 0 ? C.q0 : C.q1);
      if (i !== 0 && s >= 2 && s <= 7 && (s & 1)) for (let k = 2; k < hh - 1; k += 1) if ((k + s) % 2 === 0) put(x + i, y - k, C.u5);
      put(x + i, y + 1 - 0, i === 0 ? C.u2 : C.r1);
    }
    put(x + 1, Fy - 23 - 2, C.r3); vl(x + 1, Fy - 24, Fy - 22, C.r2); // ribbon marker
    NEAR.pages.push({ x, y: Fy - 28, len: 7, dp: 4, n: 2, ph: 0.55, tilt: 0.18 });
  }
  function candlestick(x, Fy, h, L) {
    hl(x - 2, x + 2, Fy - 1, C.a0); hl(x - 1, x + 1, Fy - 2, C.a1);
    vl(x, Fy - h, Fy - 3, C.a1); hl(x - 1, x + 1, Fy - h - 1, C.a2);
    vl(x, Fy - h - 5, Fy - h - 2, C.q1);
    L.flames.push({ x, y: Fy - h - 6, ph: x * 0.7 });
    light(L, x, Fy - h - 8, 24, 18, 0.75, undefined, Fy + 4, { n1: 17, a1: 0.07, p1: x, n2: 29, a2: 0.05, p2: x * 1.3 });
  }
  function candelabra(x, by) {
    hl(x - 2, x + 2, by - 1, C.a0); vl(x, by - 9, by - 2, C.a1); hl(x - 5, x + 5, by - 9, C.a1);
    put(x - 5, by - 10, C.a0); put(x + 5, by - 10, C.a0); put(x, by - 10, C.a0);
    for (const dx of [-5, 0, 5]) { const hh = dx === 0 ? 5 : 4; vl(x + dx, by - 10 - hh, by - 11, C.q1); NEAR.flames.push({ x: x + dx, y: by - 11 - hh, ph: dx * 1.1 + x }); }
    light(NEAR, x, by - 16, 30, 22, 0.85, undefined, by + 20, { n1: 13, a1: 0.06, p1: 0.4, n2: 27, a2: 0.04, p2: 1.1 });
  }
  function sideTable(x, Fy) {
    ell(x, Fy - 16, 6, 1.4, C.u5, (px, py, u, v) => (v < 0 ? C.u6 : C.u4));
    vl(x, Fy - 14, Fy - 3, C.u4); hl(x - 3, x + 3, Fy - 2, C.u4); put(x - 4, Fy - 1, C.u3); put(x + 4, Fy - 1, C.u3); put(x, Fy - 1, C.u3);
    return Fy - 17;
  }
  function armchair(x, Fy) {
    // wingback, facing left, x = left edge
    for (let y = Fy - 26; y <= Fy - 9; y++) { const r = y < Fy - 24 ? 1 : 0; for (let i = 8 + r; i <= 15 - r; i++) put(x + i, y, i === 8 + r ? C.r3 : i >= 14 ? C.r1 : C.r2); }
    for (let y = Fy - 22; y <= Fy - 14; y++) { put(x + 9, y, C.r1); }
    rect(x + 1, Fy - 11, 14, 3, C.r2); hl(x + 1, x + 13, Fy - 11, C.r3);
    for (let y = Fy - 16; y <= Fy - 8; y++) { put(x, y, C.r2); put(x + 1, y, C.r3); put(x + 2, y, C.r2); }
    put(x + 1, Fy - 17, C.r3); put(x, Fy - 16, C.r3);
    hl(x, x + 15, Fy - 8, C.r1); hl(x, x + 15, Fy - 7, C.r0);
    for (let i = 1; i < 15; i += 3) put(x + i, Fy - 7, C.a0);
    vl(x + 1, Fy - 6, Fy - 1, C.u4); vl(x + 14, Fy - 6, Fy - 1, C.u3); put(x + 1, Fy - 1, C.a0);
  }
  function tallClock(x, Fy, L) {
    // x = left edge, 11 wide
    rect(x + 1, Fy - 6, 9, 6, C.u4); hl(x, x + 10, Fy - 6, C.u5); hl(x, x + 10, Fy - 1, C.u3);
    rect(x + 2, Fy - 36, 7, 30, C.u3); vl(x + 2, Fy - 36, Fy - 7, C.u5); vl(x + 8, Fy - 36, Fy - 7, C.u2);
    rect(x + 3, Fy - 33, 5, 22, C.n2); hl(x + 3, x + 7, Fy - 34, C.a0); hl(x + 3, x + 7, Fy - 10, C.a0);
    rect(x + 1, Fy - 47, 9, 11, C.u4); hl(x, x + 10, Fy - 37, C.u5); hl(x + 1, x + 9, Fy - 48, C.u5); hl(x + 3, x + 7, Fy - 49, C.u5); put(x + 5, Fy - 50, C.a1);
    ell(x + 5.5, Fy - 42.5, 3.2, 3.2, C.q1, (px, py, u, v) => (u * u + v * v > 0.62 ? C.a0 : C.q1));
    L.dyn.push({ kind: 'clock', x: x + 5, y: Fy - 33, fy: Fy - 43 });
  }
  function mapChest(x, Fy) {
    // a low chest of wide, shallow drawers
    rect(x, Fy - 16, 26, 16, C.u4); hl(x - 1, x + 26, Fy - 17, C.u6); hl(x - 1, x + 26, Fy - 16, C.u5);
    for (let k = 0; k < 4; k++) { const y = Fy - 14 + k * 3; hl(x + 1, x + 24, y + 2, C.u2); put(x + 7, y + 1, C.a1); put(x + 18, y + 1, C.a1); }
    vl(x, Fy - 16, Fy - 1, C.u5); vl(x + 25, Fy - 16, Fy - 1, C.u3);
    hl(x, x + 25, Fy - 1, C.u2);
    // a rolled map and a brass telescope on top
    hl(x + 2, x + 12, Fy - 18, C.q0); hl(x + 2, x + 12, Fy - 19, C.q1); put(x + 1, Fy - 19, C.q0); put(x + 1, Fy - 18, C.u5);
    for (let i = 0; i < 10; i++) put(x + 14 + i, Fy - 18 - (i >> 2), i < 4 ? C.a0 : C.a1);
    put(x + 24, Fy - 21, C.a2);
  }
  function cardCatalogue(x, Fy) {
    // x = left edge; 25 wide, 36 tall, five columns of tiny drawers
    rect(x, Fy - 6, 25, 6, C.u3); hl(x, x + 24, Fy - 6, C.u5); vl(x + 1, Fy - 5, Fy - 1, C.u4); vl(x + 23, Fy - 5, Fy - 1, C.u2);
    rect(x, Fy - 36, 25, 30, C.u3); hl(x - 1, x + 25, Fy - 37, C.u6); hl(x - 1, x + 25, Fy - 36, C.u4);
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) {
      const dx = x + 1 + c * 5, dy = Fy - 35 + r * 4;
      hl(dx, dx + 3, dy, C.u5); put(dx, dy + 1, C.u4); put(dx + 1, dy + 1, C.q0); put(dx + 2, dy + 1, C.q0); put(dx + 3, dy + 1, C.u4);
      hl(dx, dx + 3, dy + 2, C.u4); put(dx + 1 + ((r + c) & 1), dy + 2, C.a1); hl(dx, dx + 3, dy + 3, C.u2);
    }
    // oil lamp on top
    const lx = x + 18, ly = Fy - 38;
    hl(lx - 2, lx + 2, ly, C.a0); hl(lx - 2, lx + 2, ly - 1, C.a1); hl(lx - 1, lx + 1, ly - 2, C.a2);
    hl(lx - 1, lx + 1, ly - 3, C.n8); put(lx - 1, ly - 4, C.n9); put(lx + 1, ly - 4, C.n8); put(lx - 1, ly - 5, C.n9); put(lx + 1, ly - 5, C.n8);
    MODE = EMI; put(lx, ly - 4, C.a4); put(lx, ly - 5, C.a5); MODE = LIT; put(lx, ly - 6, C.n10); put(lx, ly - 7, C.n9);
    light(NEAR, lx, ly - 4, 44, 34, 1.0, undefined, Fy + 8, { n1: 5, a1: 0.04, p1: 1 });
    // a few books lying on top
    hl(x + 2, x + 11, ly, C.r2); hl(x + 2, x + 11, ly - 1, C.r3); hl(x + 3, x + 10, ly - 2, C.g2); hl(x + 3, x + 10, ly - 3, C.g3);
  }
  function stepStool(x, Fy) {
    hl(x, x + 9, Fy - 10, C.u6); hl(x, x + 9, Fy - 9, C.u4); hl(x + 4, x + 9, Fy - 5, C.u6); hl(x + 4, x + 9, Fy - 4, C.u4);
    vl(x + 1, Fy - 8, Fy - 1, C.u4); vl(x + 8, Fy - 8, Fy - 1, C.u3);
  }
  function catCushion(cx, Fy) {
    ell(cx, Fy - 2.5, 9, 2.6, C.r2, (px, py, u, v) => (v < -0.4 ? C.r3 : v > 0.5 ? C.r1 : C.r2));
    put(cx - 9, Fy - 2, C.a1); put(cx + 9, Fy - 2, C.a1); put(cx - 10, Fy - 1, C.a0); put(cx + 9, Fy - 1, C.a0);
    NEAR.dyn.push({ kind: 'cat', x: cx, y: Fy - 8 });
  }
  function floorGlobe(cx, Fy) {
    // tripod stand
    line(cx, Fy - 12, cx - 6, Fy - 1, C.u4); line(cx, Fy - 12, cx + 6, Fy - 1, C.u3); vl(cx, Fy - 12, Fy - 2, C.u5);
    hl(cx - 5, cx + 5, Fy - 6, C.u3);
    NEAR.dyn.push({ kind: 'globe', x: cx, y: Fy - 21, r: 7 });
  }
  function pushArmLantern(side, Fy, len, n, ph, I) {
    const top = Fy - NL + 8, ay = top + 9;
    const px = side === 0 ? 92 : 267;
    NEAR.lanterns.push({ px, py: ay + 1, arm: side === 0 ? [84, 93] : [275, 266], armY: ay, len, sz: 2, n, ph, amp: 0.09, I, rx: 42, ry: 44, drop: 10, y0: top - 2, y1: Fy + 10, glow: 0.65 });
  }
  function pushCeilLantern(Fy, x, len, n, ph, I) {
    const top = Fy - NL + 8;
    put(x - 1, top + 5, C.a0); put(x + 1, top + 5, C.a0); put(x, top + 5, C.a1);
    NEAR.lanterns.push({ px: x, py: top + 6, arm: null, len, sz: 2, n, ph, amp: 0.07, I, rx: 52, ry: 54, drop: 14, y0: top - 2, y1: Fy + 10, glow: 0.55 });
  }

  function buildNear() {
    target(NEAR, false); MODE = LIT;
    // ---- left, level A (floor 96): desk, lamp, chair, ladder
    let rnd = mulberry32(3101);
    nearGallery(0, 96, rnd, { skipRows: { 2: [6], 3: [6] }, special: { 1: 'glass' } });
    ladder(5, 96 - NL + 8, 96);
    let ty = desk(41, 69, 96);
    bankersLamp(63, ty);
    openBook(52, ty, NEAR, 3, 0.1);
    floorStack(44, ty, 3, rnd, 7);
    chair(32, 96, 1);
    floorStack(71, 96, 4, rnd, 6);
    pushArmLantern(0, 96, 4, 4, 0.2, 0.8);
    pushCeilLantern(96, 30, 14, 3, 1.1, 1.0);

    // ---- left, level B (floor 192): cat, globe, candelabra on a table, leaning pile
    rnd = mulberry32(3202);
    nearGallery(0, 192, rnd, { bays: 'L3', skipRows: { 1: [6] }, special: { 0: 'folios' }, cat: [2, 4] });
    floorStack(64, 192, 3, rnd, 9);
    floorGlobe(44, 192);
    ty = sideTable(24, 192);
    candelabra(24, ty + 1);
    { const y = floorStack(5, 192, 5, rnd, 8); floorStack(6, y + 1, 2, rnd, 6); }
    pushArmLantern(0, 192, 5, 3, 1.3, 0.75);
    pushCeilLantern(192, 39, 28, 3, 0.7, 1.15);

    // ---- right, level A (floor 144): lectern, candle, armchair, ladder
    rnd = mulberry32(3303);
    nearGallery(1, 144, rnd, { bays: 'R3', special: { 2: 'bust' } });
    lectern(299, 144);
    candlestick(312, 144, 14, NEAR);
    armchair(320, 144);
    ladder(346, 144 - NL + 8, 144);
    pushArmLantern(1, 144, 8, 5, 2.1, 0.8);
    pushCeilLantern(144, 330, 20, 4, 0.4, 1.0);

    // ---- right, level B (floor 48): desk with lamp, clock, stacks
    rnd = mulberry32(3404);
    nearGallery(1, 48, rnd, { skipRows: { 1: [6], 2: [6] }, special: { 3: 'glass' } });
    ty = desk(286, 316, 48);
    bankersLamp(291, ty);
    openBook(305, ty, NEAR, 2, 0.6);
    { const y = floorStack(311, ty, 2, rnd, 6); hl(312, 314, y, C.q1); put(315, y + 1, C.q1); put(313, y - 1, C.q0); } // teacup on the books
    tallClock(330, 48, NEAR);
    floorStack(347, 48, 6, rnd, 9);
    pushArmLantern(1, 48, 5, 6, 0.6, 0.85);
    pushCeilLantern(48, 318, 10, 5, 2.6, 0.9);

    // ---- left, level C (floor 288): an orrery on a round table, a ladder, a chest of map drawers
    rnd = mulberry32(3505);
    nearGallery(0, 288, rnd, { skipRows: { 0: [6], 1: [6] }, special: { 2: 'arch' } });
    ty = sideTable(38, 288);
    NEAR.dyn.push({ kind: 'orrery', x: 38, y: ty });
    light(NEAR, 38, ty - 12, 26, 16, 0.7, undefined, 296, { n1: 4, a1: 0.05 });
    mapChest(4, 288);
    ladder(64, 288 - NL + 8, 288);
    floorStack(52, 288, 3, rnd, 7);
    pushArmLantern(0, 288, 10, 5, 2.4, 0.85);
    pushCeilLantern(288, 14, 22, 4, 1.9, 1.0);

    // ---- right, level C (floor 240): the card catalogue with an oil lamp, a step stool, a reading chair
    rnd = mulberry32(3606);
    nearGallery(1, 240, rnd, { bays: 'R3', special: { 0: 'arch' } });
    cardCatalogue(287, 240);
    stepStool(318, 240);
    chair(334, 240, -1);
    floorStack(345, 240, 4, rnd, 8);
    pushArmLantern(1, 240, 18, 4, 1.0, 0.95);

    nearSlab(0, 0); nearSlab(0, 96); nearSlab(0, 192); nearSlab(1, 48); nearSlab(1, 144); nearSlab(1, 240);
    nearStair();
  }

  /* ================================================================ shafts */
  const SH = [new Float32Array(NP), new Float32Array(NP)];
  const SLOPE = 0.34;
  function buildShafts() {
    const beams = [[52, 15, 0.6, 0], [96, 5, 0.38, 1], [124, 10, 0.5, 0], [150, 3, 0.25, 1]];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      for (const [x0, w, I, g] of beams) {
        const u = x + 0.5 - (x0 + SLOPE * y);
        if (Math.abs(u) > w + 3) continue;
        const e = clamp(1 - Math.abs(u) / (w + 3), 0, 1);
        const prof = e * e * (3 - 2 * e);
        const stri = 0.9 + 0.1 * vn1((x - SLOPE * y) * 0.25 + x0, 41);
        const fade = 1 - 0.35 * (y / H);
        SH[g][i] += I * prof * stri * fade;
      }
    }
  }

  /* ================================================================ motes */
  function buildMotes() {
    const rnd = mulberry32(777);
    const counts = [30, 60, 90];
    LAYERS.forEach((L, li) => {
      for (let k = 0; k < counts[li]; k++) L.motes.push({ x: 84 + rnd() * 192, y: rnd() * L.P, ax: 1 + rnd() * 3, ay: 1 + rnd() * 3, nx: 1 + fl(rnd() * 3), ny: 1 + fl(rnd() * 3), px: rnd() * TAU, py: rnd() * TAU, b: 0.6 + rnd() * 0.6, tw: fl(rnd() * 5) + 2 });
    });
  }

  /* ================================================================ globe texture */
  const GLON = 48, GLAT = 16, GLAND = new Uint8Array(GLON * GLAT);
  function buildGlobe() {
    const nz = (i, j, s) => ih(((i % 12) + 12) % 12, j, s);
    for (let j = 0; j < GLAT; j++) for (let i = 0; i < GLON; i++) {
      const x = i / 4, y = j / 4, xi = fl(x), yi = fl(y), fx = x - xi, fy = y - yi;
      const a = nz(xi, yi, 5), b = nz(xi + 1, yi, 5), c = nz(xi, yi + 1, 5), d = nz(xi + 1, yi + 1, 5);
      let v = lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
      v += 0.35 * ih(i, j, 9) - 0.17;
      GLAND[j * GLON + i] = v > 0.56 ? 1 : 0;
    }
  }

  /* ================================================================ dynamic drawing */
  function drawLantern(cx, ty, sz) {
    if (sz === 2) {
      put(cx, ty, C.a1);
      hl(cx - 1, cx + 1, ty + 1, C.u4); hl(cx - 2, cx + 2, ty + 2, C.a0); hl(cx - 3, cx + 3, ty + 3, C.u4);
      for (let y = ty + 4; y <= ty + 8; y++) { put(cx - 3, y, C.u3); put(cx + 3, y, C.u3); put(cx - 2, y, C.u4); put(cx + 2, y, C.u4); }
      MODE = EMI;
      for (let y = ty + 4; y <= ty + 8; y++) { put(cx - 1, y, C.a3); put(cx, y, (y === ty + 6 || y === ty + 5) ? C.a5 : C.a4); put(cx + 1, y, C.a3); }
      put(cx - 2, ty + 5, C.a2); put(cx + 2, ty + 6, C.a2);
      MODE = LIT;
      hl(cx - 3, cx + 3, ty + 9, C.u4); hl(cx - 2, cx + 2, ty + 10, C.a0); put(cx, ty + 11, C.a1); put(cx, ty + 12, C.a0);
      return ty + 6;
    }
    put(cx, ty, C.a0);
    hl(cx - 1, cx + 1, ty + 1, C.u4); hl(cx - 2, cx + 2, ty + 2, C.a0);
    for (let y = ty + 3; y <= ty + 6; y++) { put(cx - 2, y, C.u3); put(cx + 2, y, C.u3); }
    MODE = EMI; for (let y = ty + 3; y <= ty + 6; y++) { put(cx - 1, y, C.a3); put(cx, y, y === ty + 4 ? C.a5 : C.a4); put(cx + 1, y, C.a3); } MODE = LIT;
    hl(cx - 2, cx + 2, ty + 7, C.u4); put(cx, ty + 8, C.a0);
    return ty + 4.5;
  }
  function drawLanternFlip(cx, by) { // the small lantern, mirrored top to bottom; by is its finial
    put(cx, by, C.a0);
    hl(cx - 1, cx + 1, by - 1, C.u4); hl(cx - 2, cx + 2, by - 2, C.a0);
    for (let y = by - 6; y <= by - 3; y++) { put(cx - 2, y, C.u3); put(cx + 2, y, C.u3); }
    MODE = EMI; for (let y = by - 6; y <= by - 3; y++) { put(cx - 1, y, C.a3); put(cx, y, y === by - 4 ? C.a5 : C.a4); put(cx + 1, y, C.a3); } MODE = LIT;
    hl(cx - 2, cx + 2, by - 7, C.u4); put(cx, by - 8, C.a0);
  }
  function drawFlame(x, y, ph, t) {
    const a = Math.sin(TAU * 37 * t / D + ph) + 0.6 * Math.sin(TAU * 23 * t / D + ph * 1.7);
    MODE = EMI;
    put(x, y, C.a2); put(x, y - 1, a < -0.9 ? C.a3 : C.a4);
    if (a > -0.2) put(x + (a > 1.25 ? 1 : 0), y - 2, a > 0.9 ? C.a3 : C.a4);
    MODE = LIT;
  }
  function drawPage(p, t) {
    const per = D / p.n, lt = ((t + p.ph * per) % per + per) % per, dur = 2.2;
    if (lt > dur) return;
    const e = lt / dur, th = Math.PI * (e * e * (3 - 2 * e));
    const c = Math.cos(th), s = Math.sin(th);
    const lift = p.len * s * 0.95;
    const tx = p.x + p.len * c, ty = p.y - lift - (p.tilt ? Math.round(p.len * c * p.tilt) : 0);
    // the page: a sheet from the spine to its outer edge, p.dp rows deep
    const ex = Math.round(tx), steps = Math.max(1, Math.abs(ex - p.x));
    for (let k = 0; k <= steps; k++) {
      const f = k / steps, x = Math.round(lerp(p.x, tx, f)), y0 = Math.round(lerp(p.y, ty, f) - 0.4 * Math.sin(Math.PI * f) * (1 - Math.abs(c)) * 2);
      for (let d = 0; d < p.dp; d++) put(x, y0 + d, d === 0 ? C.q1 : C.q0);
    }
    if (steps < 2) for (let y = Math.round(ty); y <= p.y + p.dp - 1; y++) put(p.x, y, C.q1);
  }
  function drawGlobe(g, t) {
    const rot = TAU * t / D, r = g.r, tilt = 0.4, ct = Math.cos(tilt), st = Math.sin(tilt);
    for (let y = -r; y < r; y++) for (let x = -r; x < r; x++) {
      const nx = (x + 0.5) / r, ny = (y + 0.5) / r, q = nx * nx + ny * ny;
      if (q > 1) continue;
      const nzz = Math.sqrt(1 - q);
      const ax = nx * ct + ny * st, ay = -nx * st + ny * ct;
      const lat = Math.asin(clamp(ay, -1, 1)), lon = Math.atan2(ax, nzz) + rot;
      const li = ((fl((lon / TAU) * GLON) % GLON) + GLON) % GLON, la = clamp(fl((lat / Math.PI + 0.5) * GLAT), 0, GLAT - 1);
      const land = GLAND[la * GLON + li];
      const lum = 0.55 * nx + -0.45 * ny + 0.7 * nzz;
      let col;
      if (land) col = lum > 0.75 ? C.o2 : lum > 0.35 ? C.o1 : C.o0;
      else col = lum > 0.75 ? C.t2 : lum > 0.3 ? C.t1 : C.t0;
      if (Math.abs(lat) > 1.25) col = lum > 0.5 ? C.q1 : C.q0;
      put(g.x + x, g.y + y, col);
    }
    // brass meridian
    for (let a = -1.9; a <= 1.9; a += 0.08) { const x = Math.round(g.x - 0.5 + (r + 1) * Math.sin(a + 0.4) * 0.98), y = Math.round(g.y - 0.5 - (r + 1) * Math.cos(a + 0.4)); put(x, y, C.a0); }
    put(g.x, g.y - r - 2, C.a1);
    hl(g.x - 2, g.x + 2, g.y + r + 1, C.a0); put(g.x, g.y + r, C.a1);
  }
  const CGW = 17, CGH = 10, CATM = new Int8Array(CGW * CGH);
  function drawCat(c, t) {
    const br = Math.sin(TAU * 6 * t / D) > 0.1 ? 1 : 0; // a slow breath every four seconds
    const ox = c.x, oy = c.y; // grid row 9 rests on the shelf board at oy + 10
    CATM.fill(0);
    const bcx = 10.2, bby = 9.6, brx = 6.6, bry = 5.0 + br * 0.75;
    for (let y = 0; y < CGH; y++) for (let x = 0; x < CGW; x++) {
      const u = (x + 0.5 - bcx) / brx, v = (y + 0.5 - bby) / bry;
      if (u * u + v * v <= 1) CATM[y * CGW + x] = 1;
    }
    const hcx = 4.3, hcy = 7.3;
    for (let y = 0; y < CGH; y++) for (let x = 0; x < CGW; x++) {
      const u = (x + 0.5 - hcx) / 3.0, v = (y + 0.5 - hcy) / 2.55;
      if (u * u + v * v <= 1) CATM[y * CGW + x] = 2;
    }
    for (const [x, y] of [[2, 3], [2, 4], [3, 4], [6, 3], [6, 4], [5, 4]]) CATM[y * CGW + x] = 3;
    for (let x = 4; x <= 15; x++) CATM[9 * CGW + x] = 4;
    CATM[8 * CGW + 16] = 4; CATM[9 * CGW + 16] = 0;
    const at = (x, y) => (x < 0 || y < 0 || x >= CGW || y >= CGH ? 0 : CATM[y * CGW + x]);
    for (let y = 0; y < CGH; y++) for (let x = 0; x < CGW; x++) {
      const k = at(x, y); if (!k) continue;
      const up = at(x, y - 1), lf = at(x - 1, y), rt = at(x + 1, y);
      let col;
      if (k === 1) {
        const v = (y + 0.5 - bby) / bry;
        col = !up ? C.a3 : v < -0.7 ? C.a2 : v < -0.35 ? C.a1 : C.a0;
        if (!rt) col = C.u5;
        if (lf === 2 || lf === 3) col = C.u5; // where the head meets the body
      } else if (k === 2) {
        col = !up ? C.a3 : y < 7 ? C.a2 : C.a1;
        if (!lf) col = C.a1;
      } else if (k === 3) col = up ? C.a1 : C.a2;
      else col = x <= 5 ? C.q1 : x <= 6 ? C.q0 : C.a1;
      put(ox + x, oy + y, col);
    }
    // a few tabby stripes over the back
    for (const [x, y] of [[10, 6], [10, 7], [13, 6], [13, 7], [16 - 1, 7], [8, 7]]) if (at(x, y) === 1) put(ox + x, oy + y, C.u6);
    // face: closed eye, pink nose, white muzzle and paw
    put(ox + 3, oy + 7, C.u2); put(ox + 4, oy + 7, C.u2);
    put(ox + 1, oy + 8, C.r3); put(ox + 2, oy + 8, C.q1); put(ox + 3, oy + 8, C.q0);
    put(ox + 2, oy + 9, C.q1); put(ox + 3, oy + 9, C.q1);
    put(ox + 3, oy + 3, C.r3); // inside of an ear
    // the tail tip lifts once a loop
    if (Math.sin(TAU * t / D + 0.5) > 0.96) { put(ox + 4, oy + 9, C.a1); put(ox + 4, oy + 8, C.q1); }
  }
  function drawOrrery(o, t) {
    const cx = o.x, by = o.y, cy = by - 12;
    // stand and base
    hl(cx - 4, cx + 4, by, C.u5); hl(cx - 3, cx + 3, by - 1, C.a0); hl(cx - 1, cx + 1, by - 2, C.a1); vl(cx, cy + 2, by - 3, C.a1);
    const pl = [[6, 3, 0.4, C.t2, 1], [10, 2, 2.1, C.r3, 1], [15, 1, 4.0, C.o2, 2]];
    // the orbits, as faint brass rings
    for (const [R] of pl) for (let k = 0; k < 64; k++) {
      const a = TAU * k / 64, x = Math.round(cx + R * Math.cos(a)), y = Math.round(cy + R * 0.32 * Math.sin(a));
      if (((x + y) & 1) === 0 || Math.sin(a) > 0.2) put(x, y, Math.sin(a) > 0 ? C.a0 : C.u5);
    }
    const pts = pl.map(([R, n, ph, col, sz]) => { const a = TAU * n * t / D + ph; return { x: Math.round(cx + R * Math.cos(a)), y: Math.round(cy + R * 0.32 * Math.sin(a)) - 1, z: Math.sin(a), col, sz, R }; });
    const drawP = (p) => {
      put(p.x, p.y + 1, C.a0);
      put(p.x, p.y, p.col); put(p.x + 1, p.y, p.col); put(p.x, p.y - 1, p.col === C.o2 ? C.q0 : C.n10); put(p.x + 1, p.y - 1, p.col);
      if (p.sz > 1) { put(p.x - 1, p.y, C.a2); put(p.x + 2, p.y, C.a2); put(p.x - 2, p.y, C.a1); put(p.x + 3, p.y, C.a1); }
      if (p.R === 10) { const ma = TAU * 6 * t / D; put(p.x + Math.round(2.5 * Math.cos(ma)), p.y - 1 + Math.round(1.2 * Math.sin(ma)), C.q1); }
    };
    for (const p of pts) if (p.z < 0) drawP(p);
    MODE = EMI;
    hl(cx - 1, cx + 1, cy - 2, C.a3); hl(cx - 2, cx + 2, cy - 1, C.a4); hl(cx - 2, cx + 2, cy, C.a4); hl(cx - 1, cx + 1, cy + 1, C.a3);
    put(cx - 1, cy - 1, C.a5); put(cx, cy - 1, C.a5);
    MODE = LIT;
    for (const p of pts) if (p.z >= 0) drawP(p);
  }
  function drawClock(k, t) {
    const a = 0.32 * Math.sin(TAU * 12 * t / D);
    const len = 15, bx = k.x + Math.sin(a) * len, by = k.y + Math.cos(a) * len;
    line(k.x, k.y, bx, by, C.a0);
    ell(bx + 0.5, by + 0.5, 1.6, 1.6, C.a2, (px, py, u, v) => (u + v < -0.4 ? C.a3 : C.a1));
    // hands: ten past ten, forever
    put(k.x - 1, k.fy - 1, C.u1); put(k.x - 2, k.fy - 2, C.u1); put(k.x + 1, k.fy - 1, C.u1); put(k.x + 2, k.fy - 1, C.u1); put(k.x, k.fy, C.u2);
  }

  function drawDynamic(t) {
    for (const L of LAYERS) {
      target(L, true); MODE = LIT;
      L.dynLights = [];
      for (const ln of L.lanterns) {
        const a = ln.amp * Math.sin(TAU * ln.n * t / D + ln.ph);
        if (ln.arm) {
          const [ax0, ax1] = ln.arm, ay = ln.armY !== undefined ? ln.armY : ln.py - 1, d = ax1 > ax0 ? 1 : -1;
          for (let x = ax0; x !== ax1 + d; x += d) put(x, ay, C.a0);
          put(ax0 + d * 2, ay + 1, C.a0); put(ax0 + d * 3, ay + 2, C.a0); put(ax0 + d * 4, ay + 2, C.a0); put(ax0 + d * 5, ay + 1, C.a0);
          put(ax1, ay - 1, C.a1);
        }
        const len = ln.len + (ln.sz === 2 ? 0 : 0);
        const bx = ln.px + Math.round(Math.sin(a) * (len + 6));
        line(ln.px, ln.py, bx, ln.py + len, C.u4, 1);
        for (let k = 0; k <= len; k += 2) { const x = Math.round(lerp(ln.px, bx, k / Math.max(1, len))); put(x, ln.py + k, C.a0); }
        const gy = drawLantern(bx, ln.py + len + 1, ln.sz);
        const fk = 1 + 0.05 * Math.sin(TAU * 9 * t / D + ln.ph * 3) + 0.03 * Math.sin(TAU * 17 * t / D + ln.ph);
        L.dynLights.push({ x: bx + 0.5, y: gy + (ln.drop || 0), gyo: -(ln.drop || 0), rx: ln.rx, ry: ln.ry, I: ln.I * fk, y0: ln.y0 === undefined ? -1e6 : ln.y0, y1: ln.y1 === undefined ? 1e6 : ln.y1, glow: ln.glow || 0.5, gr: ln.sz === 2 ? 15 : 9 });
      }
      for (const f of L.flames) drawFlame(f.x, f.y, f.ph, t);
      for (const p of L.pages) drawPage(p, t);
      for (const d of L.dyn) {
        if (d.kind === 'orrery') drawOrrery(d, t);
        else if (d.kind === 'globe') drawGlobe(d, t);
        else if (d.kind === 'cat') drawCat(d, t);
        else if (d.kind === 'clock') drawClock(d, t);
      }
    }
  }

  /* ================================================================ frame */
  const LID = new Uint8Array(NP), COL = new Uint8Array(NP), MOD = new Uint8Array(NP);
  const WB = new Float32Array(NP), GB = new Float32Array(NP), OUT = new Uint8Array(NP);
  const AMB = [[0.12, 0.14, 0.33], [0.12, 0.14, 0.33], [0.13, 0.16, 0.36]];
  const FOGK = [0, 0.12, 0.3], FOG = [16, 21, 43];
  const WR = 1.32, WG = 0.86, WBL = 0.5;
  let OFFS = [0, 0, 0];

  function accLight(li, L, q, I, glowOnly) {
    const off = OFFS[li], P = L.P;
    for (let k = -2; k <= 4; k++) {
      const sy = q.y + off + k * P;
      const R = Math.max(q.ry, q.gr || 0) + Math.abs(q.gyo || 0);
      if (sy + R < 0 || sy - R >= H) continue;
      const c0 = q.y0 + off + k * P, c1 = q.y1 + off + k * P;
      if (!glowOnly) {
        const xa = Math.max(0, Math.ceil(q.x - q.rx)), xb = Math.min(W - 1, fl(q.x + q.rx));
        const ya = Math.max(0, Math.ceil(sy - q.ry)), yb = Math.min(H - 1, fl(sy + q.ry));
        for (let y = ya; y <= yb; y++) {
          const dy = (y + 0.5 - sy) / q.ry, dy2 = dy * dy;
          if (dy2 >= 1) continue;
          let cf = 1;
          if (y < c0) cf = 1 - (c0 - y) / 5; else if (y > c1) cf = 1 - (y - c1) / 5;
          if (cf <= 0) continue;
          const row = y * W;
          for (let x = xa; x <= xb; x++) {
            const i = row + x;
            if (LID[i] !== li) continue;
            const dx = (x + 0.5 - q.x) / q.rx, d = dx * dx + dy2;
            if (d < 1) { const f = 1 - d; WB[i] += I * f * f * cf; }
          }
        }
      }
      if (q.glow > 0) {
        const gr = q.gr, sy2 = sy + (q.gyo || 0);
        const xa = Math.max(0, Math.ceil(q.x - gr)), xb = Math.min(W - 1, fl(q.x + gr));
        const ya = Math.max(0, Math.ceil(sy2 - gr)), yb = Math.min(H - 1, fl(sy2 + gr));
        for (let y = ya; y <= yb; y++) {
          const dy = (y + 0.5 - sy2) / gr, row = y * W;
          for (let x = xa; x <= xb; x++) {
            const i = row + x;
            if (LID[i] < li) continue;
            const dx = (x + 0.5 - q.x) / gr, d = dx * dx + dy * dy;
            if (d < 1) { const f = 1 - d; GB[i] += q.glow * f * f * f; }
          }
        }
      }
    }
  }

  function drawFrame(t) {
    t = ((t % D) + D) % D;
    const ph = t / D;
    for (let li = 0; li < 3; li++) OFFS[li] = fl(ph * LAYERS[li].P + 1e-6) % LAYERS[li].P;
    for (const L of LAYERS) { L.wc.set(L.c); L.wm.set(L.m); }
    drawDynamic(t);
    // composite
    for (let y = 0; y < H; y++) {
      const PN = NEAR.P, PM = MID.P, PF = FAR.P;
      const rn = (((y - OFFS[0]) % PN) + PN) % PN * W, rm = (((y - OFFS[1]) % PM) + PM) % PM * W, rf = (((y - OFFS[2]) % PF) + PF) % PF * W;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let c = NEAR.wc[rn + x];
        if (c) { LID[i] = 0; COL[i] = c - 1; MOD[i] = NEAR.wm[rn + x]; continue; }
        c = MID.wc[rm + x];
        if (c) { LID[i] = 1; COL[i] = c - 1; MOD[i] = MID.wm[rm + x]; continue; }
        c = FAR.wc[rf + x];
        LID[i] = 2; COL[i] = c ? c - 1 : C.n1; MOD[i] = c ? FAR.wm[rf + x] : LIT;
      }
    }
    // light
    WB.fill(0); GB.fill(0);
    for (let li = 0; li < 3; li++) {
      const L = LAYERS[li];
      for (const q of L.lights) {
        let I = q.I;
        if (q.n1) I *= 1 + q.a1 * Math.sin(TAU * q.n1 * ph + q.p1);
        if (q.n2) I *= 1 + q.a2 * Math.sin(TAU * q.n2 * ph + q.p2);
        accLight(li, L, q, I, false);
      }
      for (const q of L.dynLights) accLight(li, L, q, q.I, false);
    }
    const breathA = 0.86 + 0.14 * Math.sin(TAU * ph), breathB = 0.86 + 0.14 * Math.sin(TAU * ph + 2.1);
    const SA = SH[0], SB = SH[1];
    for (let y = 0; y < H; y++) {
      const brow = (y & 3) << 2;
      for (let x = 0; x < W; x++) {
        const i = y * W + x, c = COL[i];
        if (MOD[i] === EMI) { OUT[i] = c; continue; }
        const li = LID[i], b = BAYER[brow | (x & 3)];
        const p = PAL[c], A = AMB[li];
        const wv = band(WB[i], 5, b, 2.4);
        let r = p[0] * (A[0] + wv * WR), g = p[1] * (A[1] + wv * WG), bl = p[2] * (A[2] + wv * WBL);
        if (li > 0) {
          const fk = FOGK[li];
          r = r * (1 - fk) + FOG[0] * fk; g = g * (1 - fk) + FOG[1] * fk; bl = bl * (1 - fk) + FOG[2] * fk;
          const s = (SA[i] * breathA + SB[i] * breathB) * (li === 1 ? 0.55 : 1);
          if (s > 0.01) { const sv = band(s, 5, b, 1.7); const sk = li === 2 ? 0.2 : 0.45; r += sv * (72 + p[0] * sk); g += sv * (86 + p[1] * sk * 1.1); bl += sv * (138 + p[2] * sk * 1.4); }
        }
        const gg = GB[i];
        if (gg > 0.01) { const gv = band(gg, 4, b, 2); r += gv * 150; g += gv * 92; bl += gv * 38; }
        r = r > 255 ? 255 : r; g = g > 255 ? 255 : g; bl = bl > 255 ? 255 : bl;
        OUT[i] = LUT[((r >> 3) << 10) | ((g >> 3) << 5) | (bl >> 3)];
      }
    }
    drawMotes(t, ph);
  }

  function drawMotes(t, ph) {
    const SA = SH[0], SB = SH[1];
    for (let li = 2; li >= 0; li--) {
      const L = LAYERS[li], off = OFFS[li], P = L.P;
      for (const m of L.motes) {
        const mx = Math.round(m.x + m.ax * Math.sin(TAU * m.nx * ph + m.px));
        const my0 = m.y + m.ay * Math.sin(TAU * m.ny * ph + m.py);
        for (let k = -1; k <= 4; k++) {
          const sy = Math.round(my0 + off + k * P);
          if (sy < 0 || sy >= H || mx < 0 || mx >= W) continue;
          const i = sy * W + mx;
          if (LID[i] < li) continue;
          const s = (SA[i] + SB[i]) * m.b * (0.75 + 0.25 * Math.sin(TAU * m.tw * ph + m.px)) * (li === 2 ? 0.7 : 1);
          const gw = GB[i];
          if (s > 0.2) OUT[i] = s > 0.5 ? C.n11 : s > 0.34 ? C.n10 : C.n9;
          else if (gw > 0.25) OUT[i] = gw > 0.5 ? C.a4 : C.a2;
        }
      }
    }
  }

  /* ================================================================ present */
  let IMG = null, SMALL = null, SG = null, PIX = null, PAL32 = null;
  function present(g, cw, ch, k) {
    if (!SMALL) {
      SMALL = document.createElement('canvas'); SMALL.width = W; SMALL.height = H;
      SG = SMALL.getContext('2d'); IMG = SG.createImageData(W, H); PIX = new Uint32Array(IMG.data.buffer);
      PAL32 = new Uint32Array(NPAL);
      for (let i = 0; i < NPAL; i++) { const p = PAL[i]; PAL32[i] = (255 << 24) | (p[2] << 16) | (p[1] << 8) | p[0]; }
    }
    for (let i = 0; i < NP; i++) PIX[i] = PAL32[OUT[i]];
    SG.putImageData(IMG, 0, 0);
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#05060e'; g.fillRect(0, 0, cw, ch);
    g.drawImage(SMALL, 0, 0, W * k, H * k);
  }

  let BUILT = false;
  function buildAll() {
    if (BUILT) return;
    buildLUT(); buildGlobe();
    for (const L of LAYERS) { L.c.fill(0); L.m.fill(0); L.lights.length = 0; L.lanterns.length = 0; L.flames.length = 0; L.pages.length = 0; L.motes.length = 0; L.dyn.length = 0; }
    buildFar(); buildMid(); buildNear(); buildShafts(); buildMotes();
    BUILT = true;
  }

  /* ================================================================ mount */
  (window.PIECES = window.PIECES || []).push({
    id: 'lantern-library',
    title: 'The Lantern Library',
    medium: 'Pixel art in 45 colours, 360 × 450 · 24 s loop',
    note: 'It goes up forever · tap to pause',
    about: 'A well of bookshelves with no top and no bottom. The camera climbs past galleries lit by brass lanterns, a sleeping cat, a globe turning on its own and books that turn their own pages, while a staircase with steps on both sides crosses the dark and moonlight falls through the middle from a skylight nobody has seen. Three layers of shelves, drawn at three scales, climb at three speeds and meet themselves again every twenty-four seconds.',
    tone: 'dark',
    room: '#05060e',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0, built = false;
      el.style.background = '#05060e';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;image-rendering:pixelated;image-rendering:crisp-edges;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(242,246,255,.8)"/><rect x="19" y="9" width="5" height="16" fill="rgba(242,246,255,.8)"/></svg>';
      el.appendChild(pauseMark);
      let K = 3, CW = W * 3, CH = H * 3;
      function layout() {
        const dpr = Math.min(3, window.devicePixelRatio || 1);
        let left = 0, top = 0, cssW, cssH;
        if (EXPORT) {
          cssW = 1080; cssH = 1350; cv.style.position = 'fixed';
          K = Math.max(1, Math.round(3 * dpr)); CW = W * K; CH = H * K;
        } else {
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          const fit = Math.min(w * dpr / W, h * dpr / H) * 0.97;
          K = Math.max(1, Math.floor(fit));
          let show = K;
          if (K < fit * 0.88) { K = Math.max(1, Math.ceil(fit)); show = fit; }
          CW = W * K; CH = H * K;
          cssW = W * show / dpr; cssH = H * show / dpr;
          left = Math.round((w - cssW) / 2); top = Math.round((h - cssH) / 2);
        }
        if (cv.width !== CW || cv.height !== CH) { cv.width = CW; cv.height = CH; }
        cv.style.left = left + 'px'; cv.style.top = top + 'px'; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
        pauseMark.style.left = (left + cssW - 48) + 'px'; pauseMark.style.top = (top + 14) + 'px';
      }
      const draw = (t) => { drawFrame(t); present(g, CW, CH, K); };
      layout();
      buildAll();
      built = true;
      draw(0);
      if (EXPORT) {
        const faded = () => { const st = el.parentElement; return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999; };
        window.__lanternlibrary = {
          duration: D,
          isReady: () => built && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); draw(t); window.__lanternlibrary.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'lantern-library';
        api.ready();
      } else {
        window.__lanternlibrary = { duration: D, isReady: () => built, renderAt(t) { return new Promise((res) => { playing = false; clock = t; draw(t); requestAnimationFrame(() => res()); }); } };
        api.ready();
      }
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        raf = requestAnimationFrame(frame);
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
        if (!playing) return;
        clock = (clock + dt) % D;
        draw(clock);
      }
      if (!EXPORT) raf = requestAnimationFrame(frame);
      const onDown = () => { if (EXPORT) return; playing = !playing; last = 0; pauseMark.style.opacity = playing ? '0' : '1'; };
      cv.addEventListener('pointerdown', onDown);
      let rt = 0;
      const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (!alive) return; layout(); draw(clock); }, 120); });
      ro.observe(el);
      return {
        destroy() {
          alive = false; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(rt);
          cv.removeEventListener('pointerdown', onDown);
          if (window.__lanternlibrary) delete window.__lanternlibrary;
        },
      };
    },
  });
})();
