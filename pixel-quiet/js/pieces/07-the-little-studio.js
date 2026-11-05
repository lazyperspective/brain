/* The Little Studio — Quiet Hours, piece 7.
 *
 * A warm terracotta studio on a street corner, opened like a doll's house: an attic under the tiles, two floors of
 * desks, plants, glowing screens, a coffee machine and a ginger cat. Across the side street stands a cooler,
 * blue-grey building. In one 40-second loop the late gold of the day goes down through sunset and night to a pink
 * dawn and back to gold, and four people leave the studio, one after another, each carrying the thing they made:
 *
 *   a small glowing terminal       crosses to the blue building, turns, waves back, goes in   (t 37.1 .. 9.4)
 *   a hammock and a laptop         crosses the road, slings the hammock between two lampposts
 *                                  and sleeps under the stars; at dawn rolls it up and wanders off  (4.5 .. 33.6)
 *   a framed little app window     pauses on the doorstep, looks both ways, scratches their head;
 *                                  a speech bubble of three dots floats up; walks off down the road (10.6 .. 32.3)
 *   a potted up-and-to-the-right chart   crosses to the blue building; the first one waves from
 *                                  the window there                                          (17.0 .. 32.0)
 *
 * Life goes on inside: someone makes coffee, someone draws boxes and arrows on a whiteboard, someone types with
 * headphones on; the empty chairs swivel to rest, the cat climbs into one and curls up, and a seedling is set
 * down where the chart stood. At about four in the morning the lights go out on their timer; in that dark the
 * studio settles back to how it was, and the lights coming up again are the next day, with the first of the four
 * reaching for the terminal (frame 0 is them at the door).
 *
 * Every frame is a pure function of t. The architecture is painted once at mount into albedo / region / emissive
 * buffers (a background, the desk fronts, and the cut sections and front bay that people pass behind); everything
 * that moves is drawn on top each frame, the whole is lit by region (sky, outdoors, indoors, windows, attic, the
 * other building) with pools from pendants, desk lamps, screens and street lamps, and quantised with a 4 × 4 Bayer
 * dither to a 66-colour palette; 360 × 450, shown at 3×. No words anywhere: meaning is carried by props and actions.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 360, H = 450, NP = W * H, D = 40;
  const TAU = Math.PI * 2, fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const ph = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const sstep = (a, b, x) => { const u = ph(x, a, b); return u * u * (3 - 2 * u); };
  const s5 = (u) => { u = clamp(u, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };
  const mod = (a, n) => ((a % n) + n) % n;
  const fr = (v) => v - fl(v);
  const per = (k, t) => TAU * k * t / D;        // a phase that turns k whole times per loop
  let SEED = 7;
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(((c | 0) + SEED * 7919) | 0, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hx = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  const sc = (c, k) => [clamp(c[0] * k, 0, 255), clamp(c[1] * k, 0, 255), clamp(c[2] * k, 0, 255)];
  const mixc = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
  // a smooth 0..1..0 bump: up over [a, b], held, down over [c, d]
  const bump = (t, a, b, c, d) => sstep(a, b, t) * (1 - sstep(c, d, t));

  /* ================================================================ palette (66) */
  const PAL_HEX = [
    '17111f', '231a2e', '2e2440', '3b3256', '4b4670', '62628c', '8285aa', 'a9adc8',  // 0-7   ink, night violets
    '4d5a72', '66778f', '8797ad', 'b3bfcd', 'd9e0e8', 'f2f4f6',                      // 8-13  the other building: blue-greys
    '22505e', '3a8597', '74c4d2', 'c4eef2',                                          // 14-17 screen glow
    '35211e', '4f3026', '6c4331', '8e5b3e', 'b47b52', 'd6a273',                      // 18-23 wood, warm browns
    '7e332c', 'a2463a', 'c45c45', 'df7856', 'ef9a74', 'f6bd9a',                      // 24-29 terracotta, coral
    'fbdcb4', 'fff2d8', 'ffd67e', 'f5ae4a', 'd9842e',                                // 30-34 warm light, lamps, ginger
    '6a3550', '965070', 'c7718a', 'e99ba2', 'f6c6c0',                                // 35-39 rose, dusk
    '503a78', '7458aa', 'a08ad0',                                                    // 40-42 purple
    '1c3529', '2a5236', '3d7442', '5c9b4c', '8dc45c', 'c4e48a',                      // 43-48 greens
    '1f5856', '2d807c', '55b2a2',                                                    // 49-51 teal
    '93661e', 'c8962e', 'eac54e',                                                    // 52-54 mustard
    '7c2027', 'b03530',                                                              // 55-56 red
    'f7d6ba', 'e6ad8a', 'b97a58', '7e4b33',                                          // 57-60 skin
    '4a4049', '6c6270', '928891', 'bcb2b2', 'e3dbd5',                                // 61-65 warm greys
  ];
  const PAL = PAL_HEX.map(hx), NPAL = PAL.length;
  // named albedo colours (palette entries, so a surface in plain light lands on its own colour)
  const K = {};
  [['ink', 0], ['n1', 1], ['n2', 2], ['n3', 3], ['n4', 4], ['n5', 5], ['n6', 6], ['n7', 7],
    ['b0', 8], ['b1', 9], ['b2', 10], ['b3', 11], ['b4', 12], ['b5', 13], ['s0', 14], ['s1', 15], ['s2', 16], ['s3', 17],
    ['w0', 18], ['w1', 19], ['w2', 20], ['w3', 21], ['w4', 22], ['w5', 23], ['t0', 24], ['t1', 25], ['t2', 26], ['t3', 27], ['t4', 28], ['t5', 29],
    ['cr', 30], ['cw', 31], ['lamp', 32], ['amb', 33], ['gin', 34], ['r0', 35], ['r1', 36], ['r2', 37], ['r3', 38], ['r4', 39],
    ['p0', 40], ['p1', 41], ['p2', 42], ['g0', 43], ['g1', 44], ['g2', 45], ['g3', 46], ['g4', 47], ['g5', 48],
    ['q0', 49], ['q1', 50], ['q2', 51], ['m0', 52], ['m1', 53], ['m2', 54], ['red0', 55], ['red1', 56],
    ['k0', 57], ['k1', 58], ['k2', 59], ['k3', 60], ['e0', 61], ['e1', 62], ['e2', 63], ['e3', 64], ['e4', 65]].forEach(([n, i]) => { K[n] = PAL[i]; });

  const QN = 64, LUT = new Uint8Array(QN * QN * QN);
  function nearest(r, g, b) {
    let best = 0, bd = 1e18;
    for (let k = 0; k < NPAL; k++) {
      const p = PAL[k], dr = r - p[0], dg = g - p[1], db = b - p[2], rm = (r + p[0]) * 0.5;
      const s = 1 / (14 + (r + g + b + p[0] + p[1] + p[2]) / 6);
      const d = ((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db) * s;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  function buildLUT() {
    const dec = new Float32Array(QN);
    for (let q = 0; q < QN; q++) { const u = q / (QN - 1); dec[q] = 255 * u * u; }
    for (let r = 0; r < QN; r++) for (let g = 0; g < QN; g++) for (let b = 0; b < QN; b++)
      LUT[(r << 12) | (g << 6) | b] = nearest(dec[r], dec[g], dec[b]);
  }
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);
  const BAY01 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const stip = (x, y, a) => a > BAY01[((y & 3) << 2) | (x & 3)];     // ordered-dither coverage for fades

  /* ================================================================ buffers & regions */
  // regions decide how a pixel is lit: SKY and WIN show the sky, EXT the outdoor light, INT the studio's lamps,
  // ATT the attic's fairy lights, BLU the other building's cool interior, EMI glows by itself, GLS reflects the sky
  const SKY = 0, EXT = 1, INT = 2, WIN = 3, ATT = 4, BLU = 5, EMI = 6, GLS = 7, CHX = 8;
  const M_EXT = (1 << EXT) | (1 << GLS) | (1 << CHX), M_INT = 1 << INT, M_ATT = 1 << ATT, M_BLU = 1 << BLU;
  function mkT(mask) { return { A: new Uint8Array(NP * 3), E: new Uint8Array(NP * 3), R: new Uint8Array(NP), Q: new Uint8Array(NP), M: mask ? new Uint8Array(NP) : null, L: null }; }
  const BG = mkT(false), OV1 = mkT(true), OV2 = mkT(true), WK = mkT(false);
  const LP = new Float32Array(NP * 3);          // light pools, this frame
  const OUT = new Uint8Array(NP);               // palette indices
  let T = WK, CR = EXT, CQ = 2;                 // current target, region, dither class
  let CX0 = 0, CY0 = 0, CX1 = W, CY1 = H;       // clip rectangle
  let PXN = 0;                                  // pixels drawn by tracked groups (motion check)
  const clipAll = () => { CX0 = 0; CY0 = 0; CX1 = W; CY1 = H; };
  const clip = (x0, y0, x1, y1) => { CX0 = Math.max(0, x0); CY0 = Math.max(0, y0); CX1 = Math.min(W, x1); CY1 = Math.min(H, y1); };

  function px(x, y, c) {
    x = fl(x); y = fl(y);
    if (x < CX0 || y < CY0 || x >= CX1 || y >= CY1) return;
    const i = y * W + x, j = i * 3, A = T.A, E = T.E;
    A[j] = c[0]; A[j + 1] = c[1]; A[j + 2] = c[2]; E[j] = 0; E[j + 1] = 0; E[j + 2] = 0;
    T.R[i] = CR; T.Q[i] = CQ; if (T.M) T.M[i] = 1;
    PXN++;
  }
  function epx(x, y, c, k) {                    // a pixel that glows by itself
    x = fl(x); y = fl(y);
    if (x < CX0 || y < CY0 || x >= CX1 || y >= CY1) return;
    if (k === undefined) k = 1;
    const i = y * W + x, j = i * 3, A = T.A, E = T.E;
    A[j] = 0; A[j + 1] = 0; A[j + 2] = 0;
    E[j] = clamp(c[0] * k, 0, 255); E[j + 1] = clamp(c[1] * k, 0, 255); E[j + 2] = clamp(c[2] * k, 0, 255);
    T.R[i] = EMI; T.Q[i] = CQ; if (T.M) T.M[i] = 1;
    PXN++;
  }
  function eadd(x, y, r, g, b) {                // add glow on top of whatever is there
    x = fl(x); y = fl(y);
    if (x < CX0 || y < CY0 || x >= CX1 || y >= CY1) return;
    const j = (y * W + x) * 3, E = T.E;
    E[j] = Math.min(255, E[j] + r); E[j + 1] = Math.min(255, E[j + 1] + g); E[j + 2] = Math.min(255, E[j + 2] + b);
  }
  function getA(x, y) { const j = (y * W + x) * 3; return [T.A[j], T.A[j + 1], T.A[j + 2]]; }
  function shadeA(x, y, k) { x = fl(x); y = fl(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const j = (y * W + x) * 3; T.A[j] = clamp(T.A[j] * k, 0, 255); T.A[j + 1] = clamp(T.A[j + 1] * k, 0, 255); T.A[j + 2] = clamp(T.A[j + 2] * k, 0, 255); }
  function rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); }
  function erect(x, y, w, h, c, k) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) epx(x + i, y + j, c, k); }
  function hl(x0, x1, y, c) { for (let x = x0; x <= x1; x++) px(x, y, c); }
  function vl(x, y0, y1, c) { for (let y = y0; y <= y1; y++) px(x, y, c); }
  function line(x0, y0, x1, y1, c, fn) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      if (fn) fn(x0, y0); else px(x0, y0, c);
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
        if (u * u + v * v <= 1) { if (fn) fn(x, y, u, v); else px(x, y, c); }
      }
  }
  function poly(pts, c, fn) {
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
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) { if (fn) fn(x, y); else px(x, y, c); }
    }
  }
  function spr(rows, map, x, y, flip) {
    for (let j = 0; j < rows.length; j++) {
      const r = rows[j], w = r.length;
      for (let i = 0; i < w; i++) {
        const ch = r[i]; if (ch === '.' || ch === ' ') continue;
        const m = map[ch]; if (m === undefined) continue;
        px(x + (flip ? w - 1 - i : i), y + j, m);
      }
    }
  }

  /* ================================================================ the plan */
  // studio
  const RX = 134, RY = 30;                                         // roof ridge
  const roofY = (x) => RY + Math.abs(x - RX) * (58 / 134);         // top of the tiles
  const UF_CEIL = 96, UF_WALL1 = 168, UF_FEET = 176, SLAB0 = 182, SLAB1 = 192;
  const GF_CEIL = 192, GF_WALL1 = 264, GF_FEET = 273, PL0 = 278, PL1 = 288;
  const BAYX = 210;                                                 // the front bay (door) begins here
  const DOOR = { x0: 228, x1: 246, y0: 242, y1: 278, cx: 237 };
  const FAR_FEET = 296, NEAR_FEET = 386;
  const BLUEX = 280;
  const BDOOR = { x0: 314, x1: 332, y0: 252, y1: 288, cx: 323 };
  const BWIN = { x0: 308, x1: 352, y0: 190, y1: 228 };
  const POSTS = [62, 270, 334];                                     // lampposts on the near pavement
  const POST_BASE = 390, LANT_Y = 306;
  const HAM = { a: 270, b: 334, cx: 302, hook: 352 };
  // furniture (x of the chair = where the sitter sits; desks to their right)
  const SEATS = {
    w1: { x: 20, feet: UF_FEET }, p4: { x: 112, feet: UF_FEET }, p2: { x: 158, feet: UF_FEET },
    w2: { x: 98, feet: GF_FEET }, p3: { x: 142, feet: GF_FEET }, p1: { x: 186, feet: GF_FEET },
  };
  const DESKS = [[26, 54, UF_FEET], [118, 146, UF_FEET], [164, 192, UF_FEET], [104, 132, GF_FEET], [148, 176, GF_FEET], [192, 209, GF_FEET]];
  const PAINT = { x: 172, y: 137 };                                 // the framed app window on the wall above desk 3
  const CHART = { x: 121, y: UF_FEET - 11 };                        // the potted chart on desk 2 (pot base)
  const TERM = { x: 194, y: GF_FEET - 11 };                         // the terminal on the last desk (base)
  let SWAP = 33.5;                                                  // the dark moment the studio settles back

  /* ================================================================ time of day */
  // cyclic Catmull–Rom through keys [t, v...]
  function cyc(keys, period, x, out) {
    const n = keys.length, m = keys[0].length - 1;
    x = mod(x, period);
    let i = n - 1;
    for (let k = 0; k < n; k++) if (keys[k][0] <= x) i = k;
    const tk = (j) => keys[mod(j, n)][0] + Math.floor(j / n) * period;
    const t0 = tk(i - 1), t1 = tk(i), t2 = tk(i + 1), t3 = tk(i + 2);
    const k0 = keys[mod(i - 1, n)], k1 = keys[mod(i, n)], k2 = keys[mod(i + 1, n)], k3 = keys[mod(i + 2, n)];
    let xx = x; if (xx < t1) xx += period;
    const h = t2 - t1, s = (xx - t1) / h, s2 = s * s, s3 = s2 * s;
    for (let c = 0; c < m; c++) {
      const v0 = k0[c + 1], v1 = k1[c + 1], v2 = k2[c + 1], v3 = k3[c + 1];
      const m1 = (v2 - v0) / (t2 - t0) * h * 0.85, m2 = (v3 - v1) / (t3 - t1) * h * 0.85;
      out[c] = (2 * s3 - 3 * s2 + 1) * v1 + (s3 - 2 * s2 + s) * m1 + (-2 * s3 + 3 * s2) * v2 + (s3 - s2) * m2;
    }
    return out;
  }
  // sky top, middle, horizon (rgb), outdoor light (rgb, ~1 = plain), night (stars)
  const SKEYS = [
    [0.0, 132, 160, 204, 236, 196, 170, 250, 206, 140, 1.04, 0.93, 0.80, 0],
    [4.5, 104, 120, 182, 230, 160, 146, 246, 154, 96, 0.98, 0.80, 0.70, 0],
    [9.0, 62, 70, 128, 140, 98, 144, 212, 124, 120, 0.68, 0.58, 0.70, 0.12],
    [14.0, 34, 42, 88, 62, 62, 120, 106, 90, 138, 0.44, 0.44, 0.64, 0.62],
    [19.0, 20, 24, 52, 31, 37, 72, 46, 51, 96, 0.34, 0.37, 0.56, 1],
    [30.0, 20, 24, 52, 31, 37, 72, 46, 51, 96, 0.34, 0.37, 0.56, 1],
    [33.6, 22, 27, 58, 38, 44, 85, 76, 66, 114, 0.34, 0.36, 0.54, 0.9],
    [35.7, 80, 94, 154, 184, 138, 168, 242, 168, 142, 0.76, 0.67, 0.73, 0.25],
    [37.9, 134, 166, 214, 230, 203, 184, 248, 217, 162, 1.02, 0.95, 0.85, 0],
  ];
  const SK = new Float64Array(13);
  const SKYROW = new Float32Array(H * 3), WINROW = new Float32Array(H * 3), GLSROW = new Float32Array(H * 3);
  const AMB = [];
  for (let r = 0; r < 9; r++) AMB.push([0, 0, 0]);
  const LV = {};                                                    // this frame's light levels
  // the studio's lamps: [x, y (shade), floor, off at, on at] (off/on over half a second)
  const PEND = [[40, 108, 0, 32.4, 34.0], [130, 108, 0, 26.4, 34.3], [182, 108, 0, 27.0, 34.6],
    [70, 204, 1, 28.2, 34.2], [120, 204, 1, 26.8, 34.5], [166, 204, 1, 32.5, 34.8]];
  const pendLevel = (p, t) => {
    const on = sstep(p[4], p[4] + 0.5, t), off = 1 - sstep(p[3], p[3] + 0.5, t);
    return t < p[4] ? off : on;
  };
  function setTime(t) {
    cyc(SKEYS, D, t, SK);
    for (let y = 0; y < H; y++) {
      const j = y * 3;
      let a, b, u;
      if (y < 110) { a = 0; b = 3; u = y / 110; } else { a = 3; b = 6; u = clamp((y - 110) / 150, 0, 1); }
      for (let c = 0; c < 3; c++) SKYROW[j + c] = lerp(SK[a + c], SK[b + c], u);
    }
    for (let y = 0; y < H; y++) {
      const j = y * 3, k = clamp(fl((y - 96) * 0.45), 0, H - 1) * 3, k2 = Math.min(H - 1, fl(y * 0.55) + 20) * 3;
      for (let c = 0; c < 3; c++) { WINROW[j + c] = SKYROW[k + c] * 0.9; GLSROW[j + c] = SKYROW[k2 + c] * 0.62; }
    }
    LV.night = clamp(SK[12], 0, 1);
    const ar = SK[9], ag = SK[10], ab = SK[11];
    LV.sun = clamp((ar - 0.5) / 0.5, 0, 1);
    // street lamps come on in the dusk and go off in the morning
    LV.street = sstep(6.5, 8.0, t) * (1 - sstep(36.3, 37.6, t));
    // the studio: pendants, the desk lamps of the night, and the dark at four in the morning
    let main = 0;
    LV.pend = PEND.map((p) => { const v = pendLevel(p, t); main += v; return v; });
    main /= PEND.length;
    LV.main = main;
    LV.lampA = bump(t, 25.8, 26.4, 32.5, 33.0);                   // desk lamp over the seedling (upstairs)
    LV.lampB = bump(t, 26.2, 26.8, 32.6, 33.1);                   // desk lamp by the cat's chair
    LV.lampW = bump(t, 27.4, 28.0, 31.4, 31.9);                   // the all-nighter's lamp
    LV.dark = bump(t, 32.6, 33.15, 33.85, 34.6);                  // 1 = the window light is gone too
    LV.morning = sstep(34.0, 36.4, t) * (1 - sstep(39.0, 40.0, t)) + (t < 4 ? 1 - sstep(0, 4, t) : 0);
    const warm = [1.0, 0.9, 0.76];
    const base = (0.2 + 0.8 * main) * (1 - LV.dark);
    const leak = (0.1 + 0.2 * LV.sun) * (1 - LV.dark);
    AMB[INT][0] = base * warm[0] + leak * ar * 0.9; AMB[INT][1] = base * warm[1] + leak * ag * 0.9; AMB[INT][2] = base * warm[2] + leak * ab;
    AMB[EXT][0] = ar; AMB[EXT][1] = ag; AMB[EXT][2] = ab;
    // people outdoors keep a little fill light, so they stay readable in the night
    AMB[CHX][0] = Math.max(ar, 0.62); AMB[CHX][1] = Math.max(ag, 0.58); AMB[CHX][2] = Math.max(ab, 0.68);
    AMB[GLS][0] = ar * 0.5; AMB[GLS][1] = ag * 0.5; AMB[GLS][2] = ab * 0.5;
    AMB[ATT][0] = 0.3 + 0.32 * ar; AMB[ATT][1] = 0.24 + 0.28 * ag; AMB[ATT][2] = 0.18 + 0.26 * ab;
    LV.blue = 1 - bump(t, 32.55, 33.25, 38.0, 39.5);
    LV.bdoor = Math.max(...BDOORS.map((e) => bump(t, e, e + 0.4, e + 1.0, e + 1.4)));                // the other building's window light
    const bl = 0.95 * LV.blue;
    AMB[BLU][0] = bl * (0.8 + 0.1 * ar); AMB[BLU][1] = bl * (0.88 + 0.1 * ag); AMB[BLU][2] = bl * (1.0 + 0.12 * ab);
    // how visible the studio's insides are (for the motion check: what can't be seen can't pop)
    LV.intVis = Math.max(AMB[INT][0], LV.lampA, LV.lampB, LV.lampW);
  }

  /* ================================================================ painting the architecture (once) */
  let RNG = mulberry32(7);
  const rr = () => RNG();
  function bricks(x0, y0, x1, y1, base, mortar, seed) {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const row = fl((y - y0) / 3), ry = (y - y0) % 3, off = (row & 1) ? 4 : 0;
      const bx = fl((x - x0 + off) / 8), rx = (x - x0 + off) % 8;
      if (ry === 2 || rx === 7) { px(x, y, mortar); continue; }
      const h = ih(bx, row, seed), k = 0.86 + 0.2 * h + (ry === 0 ? 0.05 : 0) + (ih(x, y, seed + 1) - 0.5) * 0.06;
      px(x, y, sc(h < 0.12 ? K.t1 : h > 0.9 ? K.t3 : base, k));
    }
  }
  function section(x0, y0, x1, y1, seed) {      // a cut face: flat light terracotta with a faint hatch
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const h = ((x + y) % 5 === 0) ? 0.93 : 1;
      px(x, y, sc(K.t4, h * (0.97 + 0.05 * ih(x, y, seed))));
    }
  }
  function plaster(x0, y0, x1, y1, c, seed) {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const n = (ih(fl(x / 3), fl(y / 3), seed) - 0.5) * 0.04 + (ih(x, y, seed + 9) - 0.5) * 0.03;
      px(x, y, sc(c, 1 + n));
    }
  }
  function planks(x0, y0, x1, y1, c, seed) {
    for (let y = y0; y < y1; y++) {
      const row = fl((y - y0) / 3), ry = (y - y0) % 3;
      for (let x = x0; x < x1; x++) {
        const seg = fl((x + row * 23) / (18 + 6 * ih(row, 0, seed)));
        const joint = (x + row * 23) % 26 === 0;
        let k = 0.9 + 0.16 * ih(seg, row, seed) + (ry === 0 ? 0.08 : ry === 2 ? -0.08 : 0) + (ih(x, y, seed + 3) - 0.5) * 0.05;
        if (joint) k *= 0.72;
        k *= 0.84 + 0.16 * ((y - y0) / (y1 - y0));             // the back of the floor sits in a little shadow
        px(x, y, sc(c, k));
      }
    }
  }
  function sideTiles(x0, y0, x1, y1, tw, th, c, j, seed) {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const row = fl((y - y0) / th), off = (row & 1) ? tw >> 1 : 0;
      const jx = (x + off) % tw === 0, jy = (y - y0) % th === 0;
      if (jx || jy) px(x, y, j);
      else px(x, y, sc(c, 0.95 + 0.08 * ih(fl((x + off) / tw), row, seed) + (ih(x, y, seed + 2) - 0.5) * 0.04));
    }
  }
  function windowBack(x0, y0, w, h, arch) {      // a back-wall window looking out at the sky
    const x1 = x0 + w, y1 = y0 + h, r = w / 2, cx = x0 + r;
    const inside = (x, y) => {
      if (x < x0 || x >= x1 || y >= y1) return false;
      if (!arch || y >= y0 + r) return y >= y0;
      const dx = x + 0.5 - cx, dy = y + 0.5 - (y0 + r);
      return dx * dx + dy * dy <= r * r;
    };
    for (let y = y0 - 2; y <= y1 + 1; y++) for (let x = x0 - 2; x <= x1 + 1; x++) {
      const inn = inside(x, y), near = inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1) || inside(x - 2, y) || inside(x + 2, y) || inside(x, y - 2);
      if (inn) {
        const mull = x === fl(cx) || y === y0 + fl(h * 0.55) || (arch && y === fl(y0 + r) && false);
        if (mull) { CR = INT; px(x, y, K.cw); }
        else {
          CR = WIN; px(x, y, K.ink);
          const dd = (x - x0) + (y - y0) * 0.6;                 // a soft diagonal sheen on the glass
          if ((dd > w * 0.25 && dd < w * 0.25 + 3) || (dd > w * 0.25 + 5 && dd < w * 0.25 + 6)) { const j = (y * W + x) * 3; T.E[j] = 22; T.E[j + 1] = 22; T.E[j + 2] = 26; }
        }
      } else if (near) { CR = INT; px(x, y, (y > y1) ? K.w3 : K.cw); }
    }
    CR = INT;
    rect(x0 - 3, y1 + 1, w + 6, 2, K.w4); hl(x0 - 3, x1 + 2, y1 + 3, K.w2);   // sill
  }
  function books(x0, x1, yb, hmax, seed) {
    let x = x0;
    const fam = [K.t1, K.q1, K.m1, K.p1, K.g2, K.r2, K.b1, K.t3, K.w4, K.q2];
    while (x < x1) {
      const w = 1 + (ih(x, 1, seed) < 0.6 ? 1 : 0), h = hmax - fl(ih(x, 2, seed) * 4);
      const c = fam[fl(ih(x, 3, seed) * fam.length)];
      for (let i = 0; i < w && x + i < x1; i++) vl(x + i, yb - h, yb - 1, sc(c, i === 0 ? 1.08 : 0.92));
      x += w;
      if (ih(x, 4, seed) < 0.12 && x < x1 - 3) { line(x, yb - 1, x + 2, yb - h + 1, K.r1); x += 3; }  // one leaning
    }
  }
  function plant(cx, yb, size, potc, seed) {     // a potted plant: pot + a mound of leaves
    const pw = Math.max(3, fl(size * 0.6));
    rect(cx - (pw >> 1), yb - 4, pw, 4, potc); hl(cx - (pw >> 1) - 1, cx - (pw >> 1) + pw, yb - 5, sc(potc, 1.15));
    const R = mulberry32(seed);
    for (let k = 0; k < size * 3; k++) {
      const a = -Math.PI * (0.1 + 0.8 * R()), l = size * (0.5 + 0.6 * R());
      const ex = cx + Math.cos(a) * l * 0.9, ey = yb - 5 + Math.sin(a) * l;
      line(cx, yb - 5, ex, ey, K.g1);
      ell(ex, ey, 1.6, 1.1, null, (x, y, u, v) => px(x, y, v < 0 ? K.g4 : K.g3));
    }
  }
  function pendantShade(x, y) {
    vl(x, y - 12, y - 1, K.n3);
    rect(x - 4, y, 9, 1, K.t2); rect(x - 5, y + 1, 11, 2, K.t2); hl(x - 5, x + 5, y + 3, K.t1);
    px(x - 3, y, K.t3); px(x - 4, y + 1, K.t3);
  }
  function deskBG(x0, x1, feet) {                // the top board (behind the sitter's arms)
    const ty = feet - 11;
    hl(x0, x1, ty, K.w5); hl(x0, x1, ty + 1, K.w4); px(x0, ty + 1, K.w3); px(x1, ty + 1, K.w3);
  }
  function deskFG(x0, x1, feet) {                // legs and the front panel (in front of the knees)
    const ty = feet - 11;
    T = OV1; CR = INT; CQ = 2;
    hl(x0, x1, ty + 2, K.w2);
    for (let y = ty + 2; y <= feet; y++) { px(x0, y, K.w3); px(x0 + 1, y, K.w2); px(x1, y, K.w2); px(x1 - 1, y, K.w3); }
    for (let y = ty + 3; y <= ty + 6; y++) for (let x = x0 + 2; x <= x1 - 2; x++) px(x, y, sc(K.w3, 0.86 + 0.04 * ((x + y) & 1)));
    hl(x0 + 2, x1 - 2, ty + 7, K.w2);
    T = BG;
  }
  function monitorBG(x0, w, feet, h) {           // bezel and stand; the screen is drawn each frame
    const ty = feet - 11, y0 = ty - h - 2;
    rect(x0, y0, w, h + 1, K.n2); hl(x0, x0 + w - 1, y0, K.n3);
    const cx = x0 + (w >> 1);
    vl(cx, y0 + h + 1, ty - 1, K.n3); hl(cx - 2, cx + 2, ty - 1, K.n2);
    return { x: x0 + 1, y: y0 + 1, w: w - 2, h: h - 1 };
  }
  const SCR = {};                               // screen rectangles

  function paintSky() {
    T = BG; CR = SKY; CQ = 2;
    for (let i = 0; i < NP; i++) BG.R[i] = SKY;
  }
  function paintFarStreet() {                    // the side street running away between the buildings
    T = BG; CR = EXT; CQ = 2;
    const x0 = 264, x1 = BLUEX;
    // distant buildings: blocks of hazy violet with a few windows that light at night
    let x = x0;
    while (x < x1) {
      const w = 5 + fl(rr() * 8), top = 150 + fl(rr() * 52), c = mixc(K.n5, K.n6, rr());
      for (let xx = x; xx < Math.min(x1, x + w); xx++) for (let y = top; y < 238; y++) px(xx, y, sc(c, 0.86 + 0.14 * ((y - top) / 90) * 0 + (xx === x ? 1.08 : 1) - 0.1));
      if (rr() < 0.5) { hl(x, Math.min(x1, x + w) - 1, top, sc(c, 1.15)); }
      for (let k = 0; k < 3; k++) {
        const wx = x + 1 + fl(rr() * Math.max(1, w - 2)), wy = top + 4 + fl(rr() * (230 - top - 6));
        if (wx < x1 && wy < 234) DISTWIN.push([wx, wy, rr()]);
      }
      x += w;
    }
    // the street running away: a road and its pavements, softly narrowing, fading into the haze
    for (let y = 236; y < 289; y++) {
      const u = (y - 236) / 52, xl = lerp(268, 265, u), xr = lerp(275, 279, u);
      for (let xx = x0; xx < x1; xx++) {
        let c;
        if (xx >= xl && xx < xr) {
          c = sc(K.e1, 0.92 + 0.06 * ih(xx, y, 41));
          if (Math.abs(xx + 0.5 - (xl + xr) / 2) < 0.6 && fr((y - 236) / (2 + u * 6)) < 0.5) c = K.e3;
        } else c = sc(K.e3, 0.9 + 0.08 * u + 0.03 * ih(xx, y, 42));
        px(xx, y, mixc(c, K.n6, (1 - u) * 0.55));
      }
    }
    // a few far street trees and a far lamp
    for (const [tx, ty, r] of [[267, 232, 4], [276, 226, 3.5]]) {
      vl(tx, ty, ty + r + 6, mixc(K.w1, K.n5, 0.5));
      ell(tx, ty, r, r * 0.9, null, (xx, yy, u, v) => px(xx, yy, mixc(v < -0.2 ? K.g2 : K.g1, K.n5, 0.45)));
    }
    vl(272, 246, 262, K.n3); px(271, 245, K.n3); px(272, 245, K.n3); FARLAMP.push([271, 246]);
  }
  const DISTWIN = [], FARLAMP = [];
  function paintBlue() {                         // the other building: cool, tidy, no marks of any kind
    T = BG; CR = EXT; CQ = 2;
    const x0 = BLUEX, x1 = W;
    for (let y = 0; y < PL1; y++) for (let x = x0; x < x1; x++) px(x, y, sc(K.b2, 0.97 + 0.04 * ih(fl(x / 6), fl(y / 23), 51)));
    // pilaster on the corner
    for (let y = 0; y < PL1; y++) { px(x0, y, K.b3); px(x0 + 1, y, K.b3); px(x0 + 2, y, K.b2); px(x0 + 3, y, K.b1); }
    // floors: spandrels and strip windows (glass reflects the sky)
    const rows = [[8, 40], [54, 86], [100, 132], [146, 178]];
    for (const [ya, yb] of rows) {
      hl(x0 + 4, x1 - 1, ya - 2, K.b3); hl(x0 + 4, x1 - 1, yb + 1, K.b1); hl(x0 + 4, x1 - 1, yb + 2, K.b0);
      for (let y = ya; y <= yb; y++) for (let x = x0 + 6; x < x1; x++) {
        if ((x - (x0 + 6)) % 22 === 0) { px(x, y, K.b0); continue; }
        CR = GLS; px(x, y, sc(K.b0, 0.9 + 0.1 * ((y - ya) / (yb - ya)))); CR = EXT;
      }
      // a diagonal sheen
      for (let k = 0; k < 3; k++) for (let y = ya; y <= yb; y++) { const xx = x0 + 10 + k * 22 + fl((yb - y) * 0.5); if (xx < x1 - 1 && (xx - (x0 + 6)) % 22 !== 0) { T.E[(y * W + xx) * 3] = 26; T.E[(y * W + xx) * 3 + 1] = 30; T.E[(y * W + xx) * 3 + 2] = 36; } }
    }
    // the lit window where they will sit (BLU interior)
    hl(x0 + 4, x1 - 1, BWIN.y0 - 3, K.b3); hl(x0 + 4, x1 - 1, BWIN.y1 + 1, K.b1); hl(x0 + 4, x1 - 1, BWIN.y1 + 2, K.b0);
    CR = BLU;
    for (let y = BWIN.y0; y < BWIN.y1; y++) for (let x = BWIN.x0; x < BWIN.x1; x++) px(x, y, y < 214 ? sc(K.b4, 0.96 + 0.04 * ((x >> 2) & 1)) : K.b2);
    // inside: a long desk on the left, a monitor, a shelf, a plant
    hl(BWIN.x0, 330, 214, K.e4); hl(BWIN.x0, 330, 215, K.e3); vl(311, 216, 227, K.e2); vl(328, 216, 227, K.e2);
    rect(313, 204, 10, 8, K.n2); vl(318, 212, 213, K.n3);
    SCR.blue = { x: 314, y: 205, w: 8, h: 6 };
    hl(334, 350, 198, K.b1); rect(336, 194, 3, 4, K.q1); rect(341, 195, 2, 3, K.m1); rect(345, 193, 4, 5, K.b0);
    T = BG; CR = BLU; plant(348, 228, 4, K.b4, 77); CR = EXT;
    // frame
    for (let y = BWIN.y0 - 2; y <= BWIN.y1; y++) { px(BWIN.x0 - 1, y, K.b0); px(BWIN.x1, y, K.b0); }
    hl(BWIN.x0 - 1, BWIN.x1, BWIN.y0 - 1, K.b0); hl(BWIN.x0 - 1, BWIN.x1, BWIN.y1, K.b1);
    // ground floor: a canopy and a glass lobby with a sliding door
    rect(x0 + 2, 238, x1 - x0 - 2, 5, K.b0); hl(x0 + 2, x1 - 1, 238, K.b1); hl(x0 + 2, x1 - 1, 243, K.n3);
    for (let y = 244; y < PL1 - 2; y++) for (let x = x0 + 4; x < x1; x++) {
      CR = BLU;
      px(x, y, y > 276 ? K.b2 : sc(K.b4, 0.93 + 0.05 * ((y >> 3) & 1)));
    }
    CR = BLU; T = BG; plant(348, 286, 5, K.b1, 78); rect(338, 272, 8, 2, K.e3); vl(339, 274, 284, K.e2); vl(344, 274, 284, K.e2);
    CR = EXT;
    for (let y = 244; y < PL1 - 2; y++) { px(x0 + 4, y, K.b0); px(x0 + 5, y, K.b1); px(BDOOR.x0 - 1, y, K.b0); px(BDOOR.x1, y, K.b0); px(345 + 6, y, K.b0); }
    rect(x0, PL1 - 2, x1 - x0, 2, K.b0);
    // a tidy box hedge
  }

  /* ================================================================ lettering: a 5 x 9 pixel font (with descenders) */
  const GLY = {
    A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
    I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
    c: ['.....', '.....', '.###.', '#....', '#....', '#...#', '.###.'],
    e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
    h: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'],
    i: ['..#..', '.....', '.##..', '..#..', '..#..', '..#..', '.###.'],
    n: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'],
    o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
    p: ['.....', '.....', '####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    q: ['.....', '.....', '.####', '#...#', '#...#', '.####', '....#', '....#', '....#'],
    r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
    s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
    t: ['.#...', '.#...', '####.', '.#...', '.#...', '.#..#', '..##.'],
    u: ['.....', '.....', '#...#', '#...#', '#...#', '#..##', '.##.#'],
    y: ['.....', '.....', '#...#', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  };
  const textW = (str, k) => (str.length * 6 - 1) * k;
  function text(str, x, y, c, k, glow) {         // top-left at (x, y), scale k; glow: drawn as a lit pixel
    let cx = x;
    for (const ch of str) {
      const g = GLY[ch];
      if (g) g.forEach((row, ry) => { for (let rx = 0; rx < 5; rx++) if (row[rx] === '#') for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) (glow ? epx(cx + rx * k + b, y + ry * k + a, c, glow) : px(cx + rx * k + b, y + ry * k + a, c)); });
      cx += 6 * k;
    }
  }
  // the name signs: a lit board on posts on the studio's roof, a lit band at the top of the tower
  function paintSigns() {
    T = BG; CQ = 1;
    {
      const str = 'Anthropic', k = 2, tw = textW(str, k), x0 = RX - (tw >> 1) - 5, x1 = RX + (tw >> 1) + 5, y0 = 3, y1 = 27;
      CR = EXT;
      for (const px0 of [x0 + 12, x1 - 12]) { for (let y = y1; y < fl(roofY(px0)) + 2; y++) { px(px0, y, K.w0); px(px0 + 1, y, K.w1); } }
      rect(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2, K.w0);
      rect(x0, y0, x1 - x0, y1 - y0, K.t0); hl(x0, x1 - 1, y0, K.t1); hl(x0, x1 - 1, y1 - 1, K.w0);
      text(str, x0 + 5, y0 + 4, K.cw, k, 1);
    }
    {
      const str = 'OpenAI', k = 2, tw = textW(str, k), x0 = BLUEX + 4, x1 = W, cx = (x0 + x1) >> 1, y0 = 10, y1 = 36;
      CR = EXT;
      rect(x0, y0, x1 - x0, y1 - y0, K.n1); hl(x0, x1 - 1, y0, K.b3); hl(x0, x1 - 1, y1 - 1, K.b0);
      text(str, cx - (tw >> 1), y0 + 6, K.b5, k, 1);
      // and the same, small, over the lobby canopy
      const s2 = 'OpenAI', tw2 = textW(s2, 1);
      text(s2, BDOOR.cx - (tw2 >> 1) + 12, 239 - 8, K.b5, 1, 0.95);
    }
    CQ = 2;
  }
  function paintStudioShell() {
    T = BG; CQ = 2;
    // a sliver of the neighbour on the far left
    CR = EXT;
    for (let y = 0; y < PL1; y++) for (let x = 0; x < 4; x++) if (y > roofY(x) + 6) px(x, y, sc(K.e1, 0.9 + 0.08 * ((y >> 2) & 1)));
    // roof tiles over the attic
    for (let x = 0; x <= 268; x++) {
      const yt = roofY(x);
      for (let y = fl(yt); y < fl(yt) + 9; y++) {
        const d = y - yt;
        if (d < 0) continue;
        let c;
        if (d >= 7.5) c = K.w1;                                 // fascia
        else {
          const course = fl(d / 2.5), cd = d - course * 2.5, gap = ((x + course * 3) % 6) === 0;
          c = cd > 1.7 ? K.t0 : gap ? K.t1 : (ih(fl((x + course * 3) / 6), course, 5) > 0.75 ? K.t3 : K.t2);
          if (cd < 0.6 && !gap) c = sc(c, 1.1);
        }
        px(x, y, c);
      }
    }
    // the ridge cap
    for (let x = RX - 3; x <= RX + 3; x++) { px(x, RY - 1, K.t1); px(x, RY - 2, K.t2); }
    // chimney
    bricks(190, 30, 201, fl(roofY(190)) + 1, K.t2, K.t5, 13);
    rect(188, 27, 15, 3, K.e2); hl(188, 202, 27, K.e3);
    // attic (cut open): rafters, a round window at the gable, boxes; lit by fairy lights
    CR = ATT;
    for (let x = 10; x < 259; x++) {
      const yt = fl(roofY(x)) + 9;
      for (let y = yt; y < 88; y++) {
        const raft = (x % 22 === 0);
        px(x, y, raft ? K.w1 : sc(K.w2, 0.85 + 0.1 * ((y - yt) / 50) + 0.03 * ih(x, y, 61)));
      }
    }
    for (let x = 30; x < 240; x += 22) for (let y = fl(roofY(x)) + 9; y < 88; y++) px(x, y, K.w1);
    // round window
    ell(RX, 62, 7.5, 7.5, null, (x, y, u, v) => { const d = u * u + v * v; if (d > 0.62) { CR = ATT; px(x, y, K.w4); } else { CR = WIN; px(x, y, K.ink); } });
    CR = ATT; vl(RX, 55, 69, K.w4); hl(RX - 7, RX + 7, 62, K.w4);
    // boxes, a rolled rug, a little lamp-less stool
    const box = (x, y, w, h) => { rect(x, y, w, h, K.w4); hl(x, x + w - 1, y, K.w5); vl(x + (w >> 1), y, y + 2, K.w3); vl(x + w - 1, y + 1, y + h - 1, K.w3); };
    box(34, 76, 12, 12); box(46, 80, 9, 8); box(38, 69, 8, 7); box(200, 78, 11, 10); box(212, 82, 8, 6);
    for (let x = 64; x < 82; x++) { px(x, 85, K.r1); px(x, 86, K.r2); px(x, 87, K.r1); } ell(64, 86, 1.6, 1.6, K.r3);
    rect(170, 82, 9, 2, K.q1); vl(171, 84, 87, K.q0); vl(177, 84, 87, K.q0); box(166, 74, 7, 6);
    CR = EXT;
    // attic floor (cut)
    section(4, 88, 264, 96, 71); hl(4, 263, 88, K.t3); hl(4, 263, 95, K.t2);
    // walls cut open: left, and the right wall of the upper floor
    section(4, 96, 10, PL0, 72); vl(10, 96, PL0 - 1, K.t3); vl(4, 96, PL0 - 1, K.t2);
    section(258, 96, 264, SLAB0, 73); vl(257, 96, SLAB0 - 1, K.t3);
    // plinth
    for (let y = PL0; y < PL1; y++) for (let x = 4; x < BAYX; x++) px(x, y, y === PL0 ? K.e4 : sc(K.e3, (x % 14 === 0) ? 0.85 : 0.94 + 0.05 * ih(fl(x / 14), y, 74)));
  }
  function paintUpper() {
    T = BG; CR = INT; CQ = 2;
    const UFC = hx('f4d3b4');
    plaster(10, UF_CEIL, 258, UF_WALL1 - 12, UFC, 81);
    // wainscot
    for (let y = UF_WALL1 - 12; y < UF_WALL1; y++) for (let x = 10; x < 258; x++) px(x, y, y === UF_WALL1 - 12 ? K.w3 : (x % 9 === 0 ? K.w3 : sc(K.w5, 0.95 + 0.04 * ((y + 1) & 1))));
    hl(10, 257, UF_WALL1 - 13, K.w4);
    // ceiling beam and its shadow
    rect(10, UF_CEIL, 248, 3, K.w2); hl(10, 257, UF_CEIL + 3, sc(UFC, 0.86));
    planks(10, UF_WALL1, 258, SLAB0, K.w3, 82);
    // windows
    windowBack(26, 104, 26, 30, true); windowBack(116, 104, 26, 30, true); windowBack(218, 104, 30, 46, true);
    plant(32, 134, 3, K.t2, 11); plant(46, 134, 2, K.q1, 12); plant(232, 150, 4, K.t1, 13);
    // whiteboard on the wall (its drawing comes and goes)
    rect(58, 127, 36, 26, K.e3); rect(59, 128, 34, 24, K.b5); hl(58, 93, 153, K.e2); hl(60, 91, 154, K.e3);
    SCR.board = { x: 59, y: 128, w: 34, h: 24 };
    // a little shelf of seedlings in pots beside it
    hl(96, 108, 146, K.w3); hl(96, 108, 147, K.w2); px(97, 148, K.w2); px(107, 148, K.w2);
    rect(97, 143, 3, 3, K.t2); rect(101, 143, 3, 3, K.t2); rect(105, 143, 3, 3, K.t1);
    px(98, 142, K.g3); px(98, 141, K.g4); px(102, 142, K.g3); px(103, 141, K.g4); px(106, 142, K.g2);
    // posters: abstract shapes only
    rect(150, 106, 14, 18, K.w2); rect(151, 107, 12, 16, K.cr); ell(157, 112, 3, 3, K.t3); for (let x = 152; x < 163; x++) { const y = 121 - fl(2 + 2 * Math.sin(x * 0.7)); vl(x, y, 121, K.q1); }
    rect(186, 104, 12, 14, K.n3); rect(187, 105, 10, 12, K.q2); poly([[188, 115], [192, 107], [196, 115]], K.m2); rect(190, 110, 3, 3, K.t3);
    // tall narrow bookshelf by the stairs
    rect(198, 112, 12, 56, K.w2); for (const yb of [124, 136, 148, 160]) { books(199, 209, yb, 10, yb); hl(198, 209, yb, K.w4); } rect(199, 113, 10, 1, K.w1);
    // pendant lamps
    for (const p of PEND) if (p[2] === 0) pendantShade(p[0], p[1]);
    // desks and monitors
    for (const d of DESKS) if (d[2] === UF_FEET) { deskBG(d[0], d[1], d[2]); deskFG(d[0], d[1], d[2]); }
    SCR.w1a = monitorBG(28, 12, UF_FEET, 9); SCR.w1b = monitorBG(41, 12, UF_FEET, 9);
    SCR.p4 = monitorBG(131, 13, UF_FEET, 10); SCR.p2 = monitorBG(176, 14, UF_FEET, 10);
    // desk things: a mug, a cactus, a pen cup, the tablet, a desk lamp
    const ty = UF_FEET - 11;
    rect(50, ty - 3, 2, 3, K.t3); px(52, ty - 2, K.t3);
    plant(116 + 26, ty, 2, K.t2, 21);
    rect(166, ty - 1, 7, 1, K.n2); hl(166, 172, ty - 1, K.n3);           // drawing tablet
    rect(190, ty - 4, 2, 4, K.q1); px(190, ty - 5, K.m2); px(191, ty - 6, K.t3);
    // the lamp on the chart's desk (lit at night)
    vl(145, ty - 7, ty - 1, K.n3); hl(143, 146, ty - 1, K.n2); line(145, ty - 7, 142, ty - 10, K.n3); rect(140, ty - 11, 4, 2, K.m1);
    // the lamp at the all-nighter's desk
    vl(27, ty - 7, ty - 1, K.n3); hl(25, 28, ty - 1, K.n2); line(27, ty - 7, 30, ty - 10, K.n3); rect(29, ty - 11, 4, 2, K.t2);
    // beanbag under the whiteboard
    ell(76, UF_FEET - 4, 10, 5.5, null, (x, y, u, v) => px(x, y, v < -0.4 ? K.m2 : v < 0.3 ? K.m1 : K.m0));
    // the stairwell: a hole in the floor with steps going down to the right; a rail along its back edge
    for (let y = UF_WALL1 + 1; y < SLAB0; y++) for (let x = 214; x < 257; x++) {
      const ys = UF_WALL1 + 2 + fl((x - 214) / 5) * 3;
      if (y < ys) px(x, y, sc(K.w0, 0.9 + 0.25 * ((y - UF_WALL1) / 14)));
      else if (y === ys) px(x, y, (x - 214) % 5 === 4 ? K.w3 : K.w5);
      else px(x, y, (x - 214) % 5 === 4 ? K.w1 : K.w2);
    }
    hl(214, 256, UF_WALL1 + 1, K.w2);
    hl(212, 257, UF_WALL1 - 4, K.w4); for (let x = 214; x < 257; x += 5) vl(x, UF_WALL1 - 3, UF_WALL1, K.w3);
    vl(211, UF_WALL1 - 9, UF_FEET, K.w3); vl(212, UF_WALL1 - 9, UF_FEET, K.w4); px(211, UF_WALL1 - 10, K.w5); px(212, UF_WALL1 - 10, K.w5);
    // a hanging plant
    vl(100, UF_CEIL + 4, 110, K.n3); ell(100, 112, 4, 2.5, K.t2); for (let k = 0; k < 6; k++) { const xx = 96 + k * 1.6; vl(fl(xx), 113, 114 + fl(ih(k, 0, 5) * 8), K.g2); px(fl(xx), 115 + fl(ih(k, 1, 5) * 8), K.g3); }
  }
  function paintGround() {
    T = BG; CR = INT; CQ = 2;
    const GFC = hx('f2c9a2');
    plaster(10, GF_CEIL, BAYX, GF_WALL1 - 14, GFC, 91);
    for (let y = GF_WALL1 - 14; y < GF_WALL1; y++) for (let x = 10; x < BAYX; x++) px(x, y, y === GF_WALL1 - 14 ? K.w3 : (x % 9 === 4 ? K.w3 : sc(K.w4, 0.95 + 0.04 * ((y + 1) & 1))));
    hl(10, BAYX - 1, GF_WALL1 - 15, K.w5);
    rect(10, GF_CEIL, BAYX - 10, 3, K.w2); hl(10, BAYX - 1, GF_CEIL + 3, sc(GFC, 0.86));
    planks(10, GF_WALL1, BAYX, PL0, K.w3, 92);
    // rug
    for (let y = GF_WALL1 + 4; y < PL0 - 2; y++) for (let x = 48; x < 136; x++) {
      const e = x === 48 || x === 135 || y === GF_WALL1 + 4 || y === PL0 - 3;
      const pat = ((x - 48) >> 2) + ((y - GF_WALL1) >> 1);
      px(x, y, e ? K.t5 : (pat % 3 === 0 ? K.t3 : K.t2));
    }
    windowBack(58, 200, 28, 32, true); windowBack(104, 200, 26, 30, false); windowBack(150, 200, 24, 30, false);
    plant(64, 232, 2, K.t2, 31); plant(124, 230, 2, K.q1, 32); plant(168, 230, 3, K.t1, 33);
    // kitchen: cabinet, worktop, coffee machine, a rack of mugs, a cupboard
    const ty = GF_FEET - 11;
    for (let y = 250; y < GF_FEET + 1; y++) for (let x = 10; x < 47; x++) {
      const door = (x === 10 || x === 28 || x === 46 || y === 250 || y === GF_FEET);
      px(x, y, door ? K.w2 : sc(K.q1, 0.92 + 0.05 * ((x >> 1) & 1)));
    }
    px(26, 258, K.m2); px(30, 258, K.m2);
    rect(9, 247, 39, 3, K.e4); hl(9, 47, 247, K.cw); hl(9, 47, 249, K.e3);
    // the espresso machine: red with chrome, a little gauge, a cup on the drip tray
    rect(25, 230, 14, 11, K.red1); hl(25, 38, 230, K.e4); hl(25, 38, 231, K.e3); hl(25, 38, 240, K.e3);
    vl(25, 231, 240, K.red0); vl(38, 231, 240, sc(K.red1, 1.15));
    ell(29.5, 235.5, 2.2, 2.2, null, (x, y, u, v) => px(x, y, (u * u + v * v > 0.5) ? K.e3 : K.cw)); px(30, 235, K.ink);
    rect(33, 233, 4, 2, K.e4);
    rect(26, 241, 12, 5, K.e2); rect(31, 241, 4, 2, K.n2); hl(34, 37, 242, K.n1);
    rect(31, 244, 3, 2, K.cw); px(34, 244, K.cw);
    hl(25, 38, 246, K.e3); vl(39, 236, 243, K.e3); px(39, 244, K.e2);
    rect(27, 227, 3, 3, K.cw); rect(34, 227, 3, 3, K.t4);
    // mug rack
    hl(11, 45, 222, K.w3); hl(11, 45, 223, K.w2);
    const mugs = [K.t3, K.q2, K.m2, K.cw, K.r3];
    mugs.forEach((c, k) => { const x = 14 + k * 6; rect(x, 218, 3, 4, c); px(x + 3, 219, c); px(x + 3, 220, c); });
    // cupboard above
    for (let y = 199; y < 214; y++) for (let x = 11; x < 46; x++) px(x, y, (x === 11 || x === 28 || x === 45 || y === 199 || y === 213) ? K.w2 : sc(K.q1, 0.92));
    px(26, 208, K.m2); px(30, 208, K.m2);
    // a jar and a plant on the worktop
    rect(41, 241, 3, 6, K.b3); hl(41, 43, 240, K.w3); plant(46, 247, 2, K.t2, 34);
    // the couch
    const cy0 = GF_FEET - 12;
    for (let y = cy0 - 10; y < GF_FEET - 1; y++) for (let x = 50; x < 92; x++) {
      const arm = (x < 54 || x > 87) && y >= cy0 - 5, back = y < cy0 && x >= 52 && x <= 89, seat = y >= cy0 && y < cy0 + 6;
      if (!(arm || back || seat || y >= cy0 + 6)) continue;
      let c = K.q1;
      if (arm) c = (y === cy0 - 5) ? K.q2 : K.q1;
      else if (back) c = (y === cy0 - 10 ? K.q2 : (x - 52) % 13 === 0 ? K.q0 : K.q1);
      else if (seat) c = y === cy0 ? K.q2 : K.q1;
      else c = y > GF_FEET - 3 ? K.w1 : K.q0;
      if (y >= GF_FEET - 3 && x > 54 && x < 87) continue;
      px(x, y, c);
    }
    rect(56, cy0 - 7, 7, 5, K.m1); hl(56, 62, cy0 - 7, K.m2);          // a cushion
    // desks
    for (const d of DESKS) if (d[2] === GF_FEET) { deskBG(d[0], d[1], d[2]); deskFG(d[0], d[1], d[2]); }
    SCR.w2 = monitorBG(111, 14, GF_FEET, 10);
    rect(130, ty - 4, 1, 4, K.e2);                                       // a pot of pens
    // a small arm lamp on the hammock-coder's desk
    vl(174, ty - 7, ty - 1, K.n3); hl(172, 175, ty - 1, K.n2); line(174, ty - 7, 171, ty - 10, K.n3); rect(169, ty - 11, 4, 2, K.t3);
    // a cactus and a mug on the last desk
    rect(206, ty - 3, 2, 3, K.m1); px(208, ty - 2, K.m1);
    // shelf over the last desk, a poster between the windows, hooks with a scarf
    hl(184, 208, 212, K.w4); hl(184, 208, 213, K.w2); books(186, 198, 212, 8, 9); plant(203, 212, 2, K.t2, 35);
    rect(135, 204, 12, 15, K.w2); rect(136, 205, 10, 13, K.q2); ell(141, 210, 2.5, 2.5, K.cw); hl(137, 144, 215, K.t3);
    // pendants
    for (const p of PEND) if (p[2] === 1) pendantShade(p[0], p[1]);
  }
  function paintBay() {                          // the corner bay with the front door: people pass behind it
    T = OV2; CR = EXT; CQ = 2;
    bricks(BAYX + 3, GF_CEIL, 264, PL0, K.t2, K.t5, 101);
    // the cut edge of its wall
    for (let y = GF_CEIL; y < PL0; y++) { CR = EXT; px(BAYX, y, K.t3); px(BAYX + 1, y, K.t4); px(BAYX + 2, y, K.t4); }
    // a window over the stairs with a flower box
    const wx0 = 222, wx1 = 252, wy0 = 198, wy1 = 222;
    for (let y = wy0 - 1; y <= wy1 + 1; y++) for (let x = wx0 - 1; x <= wx1 + 1; x++) {
      const frame = x === wx0 - 1 || x === wx1 + 1 || y === wy0 - 1 || y === wy1 + 1 || x === 237 || y === 210;
      if (frame) { CR = EXT; px(x, y, K.cw); } else { CR = INT; px(x, y, (y > 214 && x > 240) ? K.w2 : sc(hx('f2c9a2'), 0.6 + 0.3 * ((y - wy0) / 24))); }
    }
    CR = INT; for (let x = 238; x <= wx1; x++) px(x, 216 + fl((x - 238) * 0.4), K.w1);   // the stair rail seen inside
    CR = EXT;
    rect(wx0 - 3, wy1 + 2, wx1 - wx0 + 7, 4, K.w2); hl(wx0 - 3, wx1 + 3, wy1 + 2, K.w4);
    for (let k = 0; k < 14; k++) { const x = wx0 - 2 + k * 2.3; ell(x, wy1 + 1, 1.4, 1.2, null, (xx, yy) => px(xx, yy, K.g3)); }
    [[224, K.r3], [229, K.m2], [235, K.cw], [241, K.r3], [247, K.t3], [251, K.m2]].forEach(([x, c]) => { px(x, wy1, c); px(x + 1, wy1 - 1, c); });
    // awning over the door
    for (let y = 230; y < 238; y++) for (let x = 222; x < 253; x++) {
      const stripe = fl((x - 222) / 4) & 1, scal = y === 237 && ((x - 222) % 4 === 0);
      if (scal) continue;
      px(x, y, y === 230 ? K.w2 : (stripe ? K.cw : K.t3));
    }
    hl(222, 252, 238, K.t1);
    // the door frame (the door itself is drawn each frame)
    for (let y = DOOR.y0 - 2; y < DOOR.y1; y++) { px(DOOR.x0 - 2, y, K.w2); px(DOOR.x0 - 1, y, K.w4); px(DOOR.x1, y, K.w4); px(DOOR.x1 + 1, y, K.w2); }
    hl(DOOR.x0 - 2, DOOR.x1 + 1, DOOR.y0 - 2, K.w2); hl(DOOR.x0 - 1, DOOR.x1, DOOR.y0 - 1, K.w4);
    for (let y = DOOR.y0; y < DOOR.y1; y++) for (let x = DOOR.x0; x < DOOR.x1; x++) OV2.M[y * W + x] = 0;
    // doorstep, and the plinth under the bay
    for (let y = PL0; y < PL1; y++) for (let x = BAYX; x < 264; x++) px(x, y, y === PL0 ? K.e4 : sc(K.e3, (x % 14 === 0) ? 0.85 : 0.95));
    rect(DOOR.x0 - 3, PL0, DOOR.x1 - DOOR.x0 + 6, 3, K.e4); hl(DOOR.x0 - 3, DOOR.x1 + 2, PL0 + 3, K.e2);
    // a wall lamp beside the door
    rect(250, 244, 3, 1, K.n3); rect(249, 245, 5, 5, K.n2); rect(250, 246, 3, 3, K.amb);
    // a tall plant in a pot by the door
    T = OV2; CR = EXT; plant(218, 288, 6, K.t1, 41);
    // the slab between the floors, cut
    section(4, SLAB0, 264, SLAB1, 102);
    for (let x = 4; x < 264; x++) { px(x, SLAB0, K.t3); px(x, SLAB1 - 1, K.t2); if (x % 16 === 8) { px(x, SLAB0 + 3, K.w2); px(x, SLAB0 + 4, K.w2); px(x, SLAB0 + 5, K.w2); px(x, SLAB0 + 6, K.w2); } }
    // the near edge of the stairwell hole is the floor's front lip
    for (let x = 212; x < 258; x++) px(x, SLAB0 - 1, K.w4);
    T = BG;
  }
  function paintStreet() {
    T = BG; CR = EXT; CQ = 2;
    // far pavement (with the zebra across the side street)
    sideTiles(0, PL1, W, 303, 9, 5, K.e3, K.e2, 111);
    for (let y = PL1; y < 303; y++) for (let x = 264; x < 282; x++) {
      const bar = ((x - 264) % 6) < 3;
      px(x, y, bar ? sc(K.e4, 0.96 + 0.05 * ih(x, y, 112)) : sc(K.e0, 0.96 + 0.06 * ih(x, y, 113)));
    }
    // curbs and the road
    for (let x = 0; x < W; x++) { px(x, 303, K.e4); px(x, 304, K.e2); px(x, 305, K.e1); }
    for (let y = 306; y < 354; y++) for (let x = 0; x < W; x++) {
      let c = sc(K.e0, 0.92 + 0.08 * ih(x >> 1, y >> 1, 114) + (ih(x, y, 115) < 0.05 ? 0.2 : 0));
      if (y >= 329 && y <= 330 && (x % 26) < 13 && (x < 222 || x > 252)) c = K.e4;
      if (x >= 225 && x <= 249 && ((y - 308) % 6) < 3) c = ih(x, y, 116) < 0.06 ? K.e3 : K.e4;
      px(x, y, c);
    }
    for (let y = 306; y < 309; y++) for (let x = 0; x < W; x++) shadeA(x, y, 0.85);
    for (let x = 0; x < W; x++) { px(x, 354, K.e1); px(x, 355, K.e2); px(x, 356, K.e4); px(x, 357, K.e3); }
    // near pavement
    for (let y = 358; y < 412; y++) for (let x = 0; x < W; x++) {
      const row = fl((y - 358) / 13), col = fl(x / 26);
      const jx = x % 26 === 0, jy = (y - 358) % 13 === 0;
      const base = sc(mixc(K.e3, K.e4, 0.35), 0.95 + 0.05 * ih(col, row, 117) + (ih(x, y, 118) - 0.5) * 0.04 - 0.05 * ((y - 358) / 54));
      px(x, y, (jx || jy) ? sc(base, 0.9) : base);
    }
    // a street tree in a grate on the left
    for (let y = 386; y < 393; y++) for (let x = 14; x < 40; x++) px(x, y, ((x + y) & 1) ? K.n2 : K.e1);
    for (let y = 330; y < 390; y++) { px(26, y, K.w1); px(27, y, K.w2); px(28, y, K.w1); }
    line(27, 352, 19, 338, K.w1); line(27, 346, 35, 334, K.w1);
    const RT = mulberry32(119);
    for (let k = 0; k < 48; k++) {
      const a = RT() * TAU, r = Math.sqrt(RT()) * 1, x = 27 + Math.cos(a) * 19 * r, y = 334 + Math.sin(a) * 18 * r - 4;
      const rad = 4 + RT() * 3;
      ell(x, y, rad, rad * 0.85, null, (xx, yy, u, v) => px(xx, yy, v < -0.35 ? K.g4 : v < 0.25 ? K.g3 : K.g2));
    }
    for (let k = 0; k < 22; k++) { const a = RT() * TAU, x = fl(27 + Math.cos(a) * 16 * RT()), y = fl(328 + Math.sin(a) * 12 * RT()); px(x, y, K.g5); }
    // a red post box by the crossing
    rect(205, 372, 8, 18, K.red1); for (let y = 372; y < 390; y++) { px(205, y, K.red0); px(212, y, sc(K.red1, 1.15)); }
    ell(209, 371, 4.5, 2.5, null, (xx, yy, u, v) => px(xx, yy, v < 0 ? sc(K.red1, 1.2) : K.red1)); hl(206, 211, 376, K.ink); hl(204, 213, 390, K.n2); hl(205, 212, 384, K.red0);
    // bench
    for (const y of [372, 375]) hl(98, 138, y, K.w4), hl(98, 138, y + 1, K.w3);
    for (const y of [379]) hl(97, 139, y, K.w5), hl(97, 139, y + 1, K.w3);
    for (const x of [100, 136]) { vl(x, 372, 390, K.n2); vl(x + 1, 380, 390, K.n2); }
    hl(99, 102, 390, K.n1); hl(135, 138, 390, K.n1);
    // bicycle, leaning on its stand
    const bike = (cx, cy) => ell(cx, cy, 6, 6, null, (x, y, u, v) => { const d = u * u + v * v; if (d > 0.7) px(x, y, K.n1); else if (d < 0.05) px(x, y, K.e3); });
    bike(160, 384); bike(182, 384);
    line(160, 384, 168, 375, K.q1); line(168, 375, 178, 375, K.q1); line(178, 375, 182, 384, K.q1); line(168, 375, 171, 384, K.q1); line(171, 384, 160, 384, K.q1);
    line(171, 384, 178, 375, K.q1); vl(167, 372, 375, K.n2); hl(165, 169, 371, K.n1); line(178, 375, 179, 370, K.n2); hl(177, 181, 369, K.n2);
    rect(179, 371, 4, 3, K.w3);                                           // a little basket
    // lampposts
    for (const x of POSTS) {
      for (let y = LANT_Y + 13; y < POST_BASE; y++) { px(x, y, K.n2); px(x + 1, y, K.n3); }
      rect(x - 2, POST_BASE - 3, 6, 3, K.n2); hl(x - 3, x + 4, POST_BASE, K.n1); hl(x - 1, x + 2, POST_BASE - 4, K.n3);
      rect(x - 1, LANT_Y + 13, 4, 2, K.n2);
      // lantern head
      rect(x - 3, LANT_Y + 2, 8, 10, K.n2); hl(x - 4, x + 5, LANT_Y + 1, K.n2); hl(x - 2, x + 3, LANT_Y, K.n3); px(x, LANT_Y - 1, K.n3); px(x + 1, LANT_Y - 1, K.n3);
      hl(x - 3, x + 4, LANT_Y + 12, K.n1);
    }
    // the near curb's shadow, and the flower bed along the bottom
    for (let x = 0; x < W; x++) { px(x, 412, K.w2); px(x, 413, K.w1); }
    for (let y = 414; y < H; y++) for (let x = 0; x < W; x++) px(x, y, sc(K.w0, 0.9 + 0.15 * ih(x >> 1, y >> 1, 121)));
    const R = mulberry32(122);
    for (let k = 0; k < 70; k++) {
      const x = R() * W, y = 426 + R() * 26, r = 4 + R() * 5;
      ell(x, y, r * 1.4, r, null, (xx, yy, u, v) => px(xx, yy, v < -0.5 ? K.g4 : v < -0.1 ? K.g3 : v < 0.5 ? K.g2 : K.g1));
    }
    for (let k = 0; k < 40; k++) {                     // tall stalks: lavender and foxgloves
      const x = fl(R() * W), y0 = fl(416 + R() * 8), h = 6 + fl(R() * 6), c = R() < 0.5 ? K.p2 : K.r3;
      vl(x, y0, y0 + h + 4, K.g2);
      for (let y = y0; y < y0 + h; y += 2) { px(x - 1, y, c); px(x + 1, y + 1, sc(c, 0.85)); }
    }
    for (let k = 0; k < 70; k++) {                      // round flower heads
      const x = fl(R() * W), y = fl(420 + R() * 28), c = [K.r3, K.m2, K.cw, K.t4, K.t3][fl(R() * 5)];
      px(x, y - 1, c); px(x - 1, y, c); px(x + 1, y, c); px(x, y + 1, sc(c, 0.85)); px(x, y, K.m2);
    }
  }
  // fairy lights in the attic and stars in the sky (positions chosen once)
  const FAIRY = [], STARS = [];
  function buildLights() {
    for (let k = 0; k < 26; k++) {
      const x = 18 + k * 9, sag = 4 * Math.sin(Math.PI * ((k % 6) / 6));
      const y = Math.max(fl(roofY(x)) + 12, 52) + sag;
      if (y < 84) FAIRY.push([x, fl(y), k % 4, 1 + (k % 5), ih(k, 7, 9) * TAU]);
    }
    const R = mulberry32(131);
    for (let k = 0; k < 400 && STARS.length < 46; k++) {
      const x = fl(R() * W), y = fl(R() * 230);
      const i = y * W + x;
      if (BG.R[i] !== SKY) continue;
      STARS.push([x, y, 0.4 + 0.6 * R(), 1 + fl(R() * 4), R() * TAU, R() < 0.15]);
    }
  }
  function finishOverlay(O) {
    const idx = [];
    for (let i = 0; i < NP; i++) if (O.M[i]) idx.push(i);
    O.L = Int32Array.from(idx);
  }
  function paintAll() {
    RNG = mulberry32(7);
    for (const O of [BG, OV1, OV2]) { O.A.fill(0); O.E.fill(0); O.R.fill(0); O.Q.fill(2); if (O.M) O.M.fill(0); }
    paintSky(); paintFarStreet(); paintBlue(); paintStudioShell(); paintUpper(); paintGround(); paintStreet(); paintBay(); paintSigns();
    finishOverlay(OV1); finishOverlay(OV2);
    buildLights();
  }
  function blitOverlay(O) {
    const L = O.L, A = WK.A, E = WK.E, R = WK.R, Q = WK.Q, OA = O.A, OE = O.E, OR = O.R, OQ = O.Q;
    for (let n = 0; n < L.length; n++) {
      const i = L[n], j = i * 3;
      A[j] = OA[j]; A[j + 1] = OA[j + 1]; A[j + 2] = OA[j + 2]; E[j] = OE[j]; E[j + 1] = OE[j + 1]; E[j + 2] = OE[j + 2];
      R[i] = OR[i]; Q[i] = OQ[i];
    }
  }

  /* ================================================================ people */
  const P = {
    // the four who leave
    p1: { skin: K.k1, skinD: K.k2, hair: K.n1, hairL: K.n3, style: 'quiff', top: K.m1, topD: K.m0, low: K.n3, shoe: K.ink, glasses: true, kind: 'sweater' },
    p2: { skin: K.k0, skinD: K.k1, hair: K.t2, hairL: K.t3, style: 'pony', tie: K.cw, top: K.red1, topD: K.red0, under: K.cw, low: K.n4, shoe: K.w1, kind: 'cardigan' },
    p3: { skin: K.k3, skinD: K.w1, hair: K.ink, hairL: K.n2, style: 'afro', top: K.g2, topD: K.g1, low: K.e1, shoe: K.e4, kind: 'hoodie' },
    p4: { skin: K.k0, skinD: K.k1, hair: K.m2, hairL: K.cr, style: 'bob', clip: K.r3, top: K.q1, topD: K.q0, under: K.cw, low: K.q1, shoe: K.t1, kind: 'overalls' },
    // the ones who stay
    w1: { skin: K.k2, skinD: K.w3, hair: K.w1, style: 'bald', phones: K.t3, top: K.e2, topD: K.e1, low: K.n2, shoe: K.ink, kind: 'tee' },
    w2: { skin: K.k0, skinD: K.k1, hair: K.e2, hairL: K.e3, style: 'bun', top: K.r3, topD: K.r2, low: K.p0, shoe: K.w1, kind: 'cardi2', glasses: true },
    w3: { skin: K.k1, skinD: K.k2, hair: K.p1, hairL: K.p2, style: 'crop', top: K.n3, topD: K.n2, low: K.ink, shoe: K.e4, kind: 'stripes' },
  };
  const LW = 56, LH = 56, LOX = 28, LOY = 46;
  const LCOL = new Uint8Array(LW * LH * 3), LMK = new Uint8Array(LW * LH), LTMP = new Uint8Array(LW * LH * 3), LTMK = new Uint8Array(LW * LH);
  let LMODE = 1;
  function lclr() { LMK.fill(0); }
  function lp(x, y, c, m) {
    x = fl(x) + LOX; y = fl(y) + LOY;
    if (x < 0 || y < 0 || x >= LW || y >= LH) return;
    const i = y * LW + x;
    LCOL[i * 3] = c[0]; LCOL[i * 3 + 1] = c[1]; LCOL[i * 3 + 2] = c[2]; LMK[i] = m || LMODE;
  }
  function lr(x, y, w, h, c, m) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) lp(x + i, y + j, c, m); }
  function ll(x0, y0, x1, y1, c, th) {
    line(x0, y0, x1, y1, null, (x, y) => { lp(x, y, c); if (th) lp(x + 1, y, c); });
  }
  const lget = (x, y) => { x = fl(x) + LOX; y = fl(y) + LOY; return (x < 0 || y < 0 || x >= LW || y >= LH) ? 0 : LMK[y * LW + x]; };
  function lflip() {
    LTMP.set(LCOL); LTMK.set(LMK);
    for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
      const sx = 2 * LOX - 1 - x, i = y * LW + x;
      if (sx < 0 || sx >= LW) { LMK[i] = 0; continue; }
      const s = y * LW + sx;
      LMK[i] = LTMK[s]; LCOL[i * 3] = LTMP[s * 3]; LCOL[i * 3 + 1] = LTMP[s * 3 + 1]; LCOL[i * 3 + 2] = LTMP[s * 3 + 2];
    }
  }
  function lrot(dir) {                           // a quarter turn about the feet: dir 1 = head to the left, face up
    LTMP.set(LCOL); LTMK.set(LMK); LMK.fill(0);
    for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
      const s = y * LW + x; if (!LTMK[s]) continue;
      const lx = x - LOX, ly = y - LOY;
      const nx = dir > 0 ? ly : -ly, ny = dir > 0 ? -lx : lx;
      const X = nx + LOX, Y = ny + LOY;
      if (X < 0 || Y < 0 || X >= LW || Y >= LH) continue;
      const d = Y * LW + X;
      LMK[d] = LTMK[s]; LCOL[d * 3] = LTMP[s * 3]; LCOL[d * 3 + 1] = LTMP[s * 3 + 1]; LCOL[d * 3 + 2] = LTMP[s * 3 + 2];
    }
  }
  const OUTL = hx('2a1d2c');
  function loutline() {
    LTMK.set(LMK);
    for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
      const i = y * LW + x; if (LTMK[i]) continue;
      if ((x > 0 && LTMK[i - 1] && LTMK[i - 1] !== 3) || (x < LW - 1 && LTMK[i + 1] && LTMK[i + 1] !== 3) ||
        (y > 0 && LTMK[i - LW] && LTMK[i - LW] !== 3) || (y < LH - 1 && LTMK[i + LW] && LTMK[i + LW] !== 3)) {
        LMK[i] = 4; LCOL[i * 3] = OUTL[0]; LCOL[i * 3 + 1] = OUTL[1]; LCOL[i * 3 + 2] = OUTL[2];
      }
    }
  }
  // put the local sprite into the frame; m: 1 lit, 2 glowing, 3 lit but not outlined, 4 outline
  function lblit(X, Y, reg, vis) {
    X = fl(X); Y = fl(Y);
    const n0 = PXN;
    for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
      const i = y * LW + x, m = LMK[i]; if (!m) continue;
      const c = [LCOL[i * 3], LCOL[i * 3 + 1], LCOL[i * 3 + 2]];
      const sx = X + x - LOX, sy = Y + y - LOY;
      if (m === 2) { CQ = 1; epx(sx, sy, c, 1); }
      else { CR = reg; CQ = 1; px(sx, sy, c); }
    }
    CQ = 2;
    if (vis !== undefined) PXN = n0 + Math.round((PXN - n0) * vis);
  }

  // the head: 10 × 10, local rows y -22..-13 (plus dy); hx 0..9 → x = hx - 5
  const HEADW = [6, 8, 10, 10, 10, 10, 10, 10, 8, 6];
  const inHead = (hx, hy) => hy >= 0 && hy <= 9 && Math.abs(hx - 4.5) < HEADW[hy] / 2;
  function hairAt(st, f, hx, hy) {             // f: 'R' (facing right), 'F', 'B'; returns 0, 1 hair, 2 highlight, 3 accent
    const ih_ = inHead(hx, hy);
    if (f === 'B') {
      if (st === 'bald') return 0;
      if (st === 'afro') { const u = (hx - 4.5) / 6.3, v = (hy - 3.2) / 5.6; return u * u + v * v <= 1 ? 1 : 0; }
      if (st === 'pony' && hx >= 3 && hx <= 6 && hy >= 8 && hy <= 12) return hy === 8 ? 3 : 1;
      if (st === 'bun' && ((hy >= -3 && hy <= -1 && hx >= 3 && hx <= 6) || (hy === -4 && hx >= 4 && hx <= 5))) return 1;
      if (st === 'quiff' && hy === -1 && hx >= 3 && hx <= 6) return 1;
      if (st === 'crop' && hy === -1 && (hx === 2 || hx === 4 || hx === 6)) return 1;
      return ih_ && hy <= (st === 'bob' ? 9 : st === 'crop' ? 7 : 7) ? (hy === 1 && hx >= 3 && hx <= 5 ? 2 : 1) : 0;
    }
    switch (st) {
      case 'quiff':
        if (hy < 0) return f === 'R' ? ((hy === -1 && hx >= 4 && hx <= 8) || (hy === -2 && hx >= 6 && hx <= 7) ? 1 : 0) : ((hy === -1 && hx >= 3 && hx <= 7) || (hy === -2 && hx >= 5 && hx <= 6) ? 1 : 0);
        if (!ih_) return 0;
        if (hy <= 2) return hy === 0 && hx >= 5 && hx <= 7 ? 2 : 1;
        if (f === 'R') return (hy === 3 && hx <= 6) || (hy <= 6 && hx <= 2) ? 1 : 0;
        return (hy === 3 && (hx <= 2 || hx >= 7)) || (hy <= 5 && (hx <= 0 || hx >= 9)) ? 1 : 0;
      case 'pony':
        if (f === 'R' && hx < 0 && hx >= -3 && hy >= 3 && hy <= 9 && !(hx === -3 && (hy < 5 || hy > 8))) return (hx === -1 && hy === 4) ? 3 : 1;
        if (!ih_) return (f === 'F' && (hx === -1 || hx === 10) && hy >= 5 && hy <= 8) ? 1 : 0;
        if (hy <= 2) return hy === 1 && hx >= 4 && hx <= 6 ? 2 : 1;
        if (f === 'R') return (hy === 3 && (hx <= 5 || hx === 8)) || (hy <= 7 && hx <= 2) ? 1 : 0;
        return (hy === 3 && (hx <= 3 || hx >= 6)) || (hy <= 7 && (hx <= 1 || hx >= 8)) ? 1 : 0;
      case 'afro': {
        const cx = f === 'R' ? 3.8 : 4.5, u = (hx - cx) / 6.4, v = (hy - 2.6) / 5.4;
        if (u * u + v * v > 1) return 0;
        if (f === 'R' && hx >= 4 && hy >= 4) return 0;
        if (f !== 'R' && hx >= 2 && hx <= 7 && hy >= 4) return 0;
        return (hy === -1 && hx >= 2 && hx <= 5) ? 2 : 1;
      }
      case 'bob':
        if (!ih_) return (f === 'R' && hx === -1 && hy >= 3 && hy <= 8) || (f === 'F' && (hx === -1 || hx === 10) && hy >= 4 && hy <= 8) ? 1 : 0;
        if (hy <= 3) return (hx === 7 || hx === 6) && hy === 2 && f === 'R' ? 3 : (hy === 1 && hx >= 3 && hx <= 5 ? 2 : 1);
        if (f === 'R') return (hx <= 3 && hy <= 9) || (hx === 9 && hy <= 6) ? 1 : 0;
        return (hx <= 1 || hx >= 8) && hy <= 8 ? 1 : 0;
      case 'bun':
        if (hy < 0) return f === 'R' ? ((hy === -1 && hx >= 0 && hx <= 4) || (hy === -2 && hx >= 1 && hx <= 3) ? (hy === -2 ? 2 : 1) : 0) : ((hy === -1 && hx >= 2 && hx <= 7) || (hy === -2 && hx >= 3 && hx <= 6) ? (hy === -2 && hx === 4 ? 2 : 1) : 0);
        if (!ih_) return 0;
        if (hy <= 1) return hy === 0 && hx >= 4 && hx <= 6 ? 2 : 1;
        if (f === 'R') return (hy === 2 && hx <= 6) || (hy <= 5 && hx <= 2) ? 1 : 0;
        return (hy === 2 && (hx <= 3 || hx >= 6)) || (hy <= 4 && (hx <= 0 || hx >= 9)) ? 1 : 0;
      case 'crop':
        if (hy < 0) return f === 'R' ? (hy === -1 && (hx === 3 || hx === 5 || hx === 7) ? 1 : 0) : (hy === -1 && (hx === 2 || hx === 4 || hx === 6) ? 1 : 0);
        if (!ih_) return 0;
        if (hy <= 2) return hy === 0 && hx >= 4 && hx <= 6 ? 2 : 1;
        if (f === 'R') return (hy === 3 && hx <= 4) || (hy <= 5 && hx <= 1) ? 1 : 0;
        return (hy === 3 && (hx <= 1 || hx >= 8)) || (hy <= 4 && (hx <= 0 || hx >= 9)) ? 1 : 0;
      default: return 0;
    }
  }
  function drawHead(Pp, S, hfIn, dy, dx) {
    // hfIn: 'R','L','F','B' in canonical body space
    const mir = hfIn === 'L', f = hfIn === 'L' ? 'R' : hfIn;
    const X = (hxx) => (mir ? 9 - hxx : hxx) - 5 + dx;
    const Yh = (hy) => hy - 22 + dy;
    const sk = Pp.skin, skD = Pp.skinD;
    // skin
    for (let hy = 0; hy < 10; hy++) for (let hxx = 0; hxx < 10; hxx++) {
      if (!inHead(hxx, hy)) continue;
      let c = sk;
      if (f === 'R' && hxx <= 1) c = skD;
      if (hy === 9 || (hy === 8 && (hxx <= 1 || hxx >= 8))) c = skD;
      lp(X(hxx), Yh(hy), c);
    }
    // an ear on the side
    if (f === 'R' && Pp.style !== 'afro') lp(X(2), Yh(6), skD);
    // hair
    for (let hy = -4; hy < 13; hy++) for (let hxx = -4; hxx < 13; hxx++) {
      const h = hairAt(Pp.style, f, hxx, hy); if (!h) continue;
      const c = h === 2 ? (Pp.hairL || Pp.hair) : h === 3 ? (Pp.tie || Pp.clip || Pp.hairL) : Pp.hair;
      lp(X(hxx), Yh(hy), c);
    }
    if (Pp.style === 'bald') {                       // headphones and a beard
      const ph_ = Pp.phones;
      if (f === 'R') { for (let k = 2; k <= 7; k++) lp(X(k), Yh(-1), ph_); lp(X(1), Yh(0), ph_); lp(X(8), Yh(0), ph_); lr(X(3), Yh(4), 2, 3, ph_); }
      else if (f === 'F') { for (let k = 1; k <= 8; k++) lp(X(k), Yh(-1), ph_); lp(X(0), Yh(0), ph_); lp(X(9), Yh(0), ph_); lr(X(-1), Yh(4), 2, 3, ph_); lr(X(9), Yh(4), 2, 3, ph_); }
      else { for (let k = 1; k <= 8; k++) lp(X(k), Yh(-1), ph_); lr(X(-1), Yh(4), 2, 3, ph_); lr(X(9), Yh(4), 2, 3, ph_); }
      if (f !== 'B') for (let hy = 7; hy <= 9; hy++) for (let hxx = 0; hxx < 10; hxx++) {
        if (!inHead(hxx, hy)) continue;
        if (f === 'R' ? hxx >= 4 : (hxx >= 1 && hxx <= 8)) lp(X(hxx), Yh(hy), Pp.hair);
      }
    }
    if (f === 'B') return;
    // face
    const ex = f === 'R' ? [5, 8] : [3, 6];
    const eyes = S.eyes;
    const eyeC = K.ink;
    if (eyes === 'closed') { lp(X(ex[0]), Yh(6), eyeC); lp(X(ex[1]), Yh(6), eyeC); if (f === 'F') { lp(X(ex[0] - 1), Yh(6), skD); lp(X(ex[1] + 1), Yh(6), skD); } }
    else if (eyes === 'happy') { lp(X(ex[0]), Yh(5), eyeC); lp(X(ex[1]), Yh(5), eyeC); }
    else { lp(X(ex[0]), Yh(5), eyeC); lp(X(ex[0]), Yh(6), eyeC); lp(X(ex[1]), Yh(5), eyeC); lp(X(ex[1]), Yh(6), eyeC); }
    if (Pp.glasses && eyes !== 'closed') {
      const gc = K.e3;
      if (f === 'R') { lp(X(4), Yh(5), gc); lp(X(6), Yh(5), gc); lp(X(7), Yh(5), gc); lp(X(9), Yh(5), gc); lp(X(3), Yh(5), gc); }
      else { lp(X(2), Yh(5), gc); lp(X(4), Yh(5), gc); lp(X(5), Yh(5), gc); lp(X(7), Yh(5), gc); }
    }
    // blush
    const bl = K.r3;
    if (f === 'R') { lp(X(4), Yh(7), bl); } else { lp(X(2), Yh(7), bl); lp(X(7), Yh(7), bl); }
    // mouth
    const mx = f === 'R' ? 7 : 4;
    if (S.mouth === 'o') { lp(X(mx), Yh(7), K.red0); lp(X(mx), Yh(8), K.red0); if (f === 'F') { lp(X(mx + 1), Yh(7), K.red0); lp(X(mx + 1), Yh(8), K.red0); } }
    else if (S.mouth === 'smile') { lp(X(mx), Yh(8), sc(skD, 0.75)); if (f === 'F') lp(X(mx + 1), Yh(8), sc(skD, 0.75)); }
    else if (S.mouth === 'grin') { lp(X(mx), Yh(8), K.red0); if (f === 'F') { lp(X(mx + 1), Yh(8), K.red0); lp(X(mx - 1), Yh(7), sc(skD, 0.75)); lp(X(mx + 2), Yh(7), sc(skD, 0.75)); } }
  }
  function drawTorso(Pp, f, dy) {
    const top = Pp.top, topD = Pp.topD;
    for (let y = -12; y <= -6; y++) for (let x = -4; x <= 3; x++) {
      let c = top;
      if (f === 'R' && x === -4) c = topD;
      if (f === 'F' && (x === -4 || x === 3)) c = topD;
      if (y === -6) c = topD;
      switch (Pp.kind) {
        case 'cardigan': if (f === 'R' && x >= 2 && y <= -8) c = Pp.under; if (f === 'F' && (x === -1 || x === 0) && y <= -8) c = Pp.under; break;
        case 'overalls': if (y <= -11) c = Pp.under; if (f === 'F' && y === -10 && (x === -3 || x === 2)) c = Pp.under; if (f !== 'B' && y === -9 && x >= -1 && x <= 0 && f === 'F') c = K.m2; break;
        case 'hoodie': if (f === 'F' && (x === -1 || x === 0) && (y === -11 || y === -10)) c = K.cw; if (f === 'R' && x === 1 && (y === -11 || y === -10)) c = K.cw; break;
        case 'stripes': if (((y + 12) % 2) === 1 && y < -6) c = K.e4; break;
        case 'cardi2': if (f === 'F' && (x === -1 || x === 0) && y <= -9) c = K.cw; if (f === 'R' && x === 2 && y <= -9) c = K.cw; break;
        case 'sweater': if (y === -12 && f !== 'B' && x >= -2 && x <= 1) c = topD; break;
        default: break;
      }
      lp(x, y + dy, c);
    }
    if (Pp.kind === 'hoodie') { lp(-4, -13 + dy, Pp.topD); lp(-3, -13 + dy, Pp.topD); if (f === 'B') lr(-3, -13 + dy, 6, 2, Pp.topD); }
  }
  function arm(Pp, sx, sy, hxv, hyv, front) {      // shoulder to hand
    const raised = hyv < -2;
    const c = raised ? (front ? Pp.top : Pp.topD) : (front ? Pp.topD : sc(Pp.topD, 0.86));
    const ex = sx + hxv, ey = sy + hyv;
    line(sx, sy, ex, ey, null, (x, y) => { lp(x, y, c); });
    lp(ex, ey, Pp.skin);
    if (raised) { lp(ex, ey - 1, Pp.skin); lp(ex + (hxv >= 0 ? 1 : -1), ey - 1, Pp.skin); lp(ex + (hxv >= 0 ? 1 : -1), ey, Pp.skin); }
  }
  function legs(Pp, S, f) {
    const low = Pp.low, lowD = sc(Pp.low, 0.78), sh = Pp.shoe;
    if (S.mode === 'sit') {
      // thighs forward, shins down
      for (let x = -2; x <= 4; x++) { lp(x, -5, low); lp(x, -4, x < 3 ? low : low); }
      for (let y = -3; y <= -2; y++) { lp(3, y, lowD); lp(4, y, low); }
      lp(3, -1, sh); lp(4, -1, sh); lp(5, -1, sh);
      return;
    }
    if (S.mode === 'sitlow') {
      for (let x = -2; x <= 5; x++) { lp(x, -2, low); lp(x, -1, lowD); }
      lp(6, -2, sh); lp(6, -1, sh);
      return;
    }
    const fr4 = S.mode === 'walk' ? (fl(S.wph) & 3) : -1;
    if (f === 'R') {
      if (fr4 === 0 || fr4 === 2) {
        const bk = fr4 === 0 ? lowD : low, fw = fr4 === 0 ? low : lowD;
        ll(-1, -5, -3, -2, bk); lp(-4, -1, sh); lp(-3, -1, sh);
        ll(0, -5, 2, -2, fw); lp(2, -1, sh); lp(3, -1, sh);
        lp(-2, -5, bk); lp(1, -5, fw);
      } else {
        for (let y = -5; y <= -2; y++) { lp(-2, y, lowD); lp(-1, y, lowD); lp(0, y, low); lp(1, y, low); }
        lp(-2, -1, sh); lp(-1, -1, sh); lp(0, -1, sh); lp(1, -1, sh); lp(2, -1, sh);
      }
    } else {
      // front or back: two legs, one lifts in turn
      const liftL = fr4 === 0 ? 1 : 0, liftR = fr4 === 2 ? 1 : 0;
      for (let y = -5; y <= -2 - liftL; y++) { lp(-3, y, low); lp(-2, y, low); }
      for (let y = -5; y <= -2 - liftR; y++) { lp(1, y, low); lp(2, y, low); }
      lp(-1, -5, low); lp(0, -5, low);
      lp(-3, -1 - liftL, sh); lp(-2, -1 - liftL, sh); lp(1, -1 - liftR, sh); lp(2, -1 - liftR, sh);
    }
  }
  // props, drawn in the sprite's own space (+x is forward for a sprite facing right)
  function propTerminal(x, y, t) {             // a small dark window: a few coloured bars and a blinking cursor
    lr(x, y, 10, 7, K.n2, 1); lr(x, y, 10, 1, K.n3, 1);
    lp(x + 1, y, K.t3, 2); lp(x + 2, y, K.m2, 2);
    lr(x + 1, y + 1, 8, 5, K.ink, 2);
    lr(x + 1, y + 2, 2, 1, K.g4, 2); lr(x + 4, y + 2, 3, 1, K.s2, 2);
    lr(x + 1, y + 3, 4, 1, K.s1, 2); lr(x + 6, y + 3, 2, 1, K.m2, 2);
    lr(x + 1, y + 4, 1, 1, K.g4, 2);
    if (fr(t * 1.25) < 0.55) lp(x + 3, y + 4, K.g5, 2);
  }
  function propPainting(x, y) {                // a little desktop-app window, framed like a painting
    lr(x, y, 12, 10, K.w4, 1); lr(x, y, 12, 1, K.w5, 1); lr(x + 11, y, 1, 10, K.w3, 1); lr(x, y + 9, 12, 1, K.w3, 1);
    lr(x + 1, y + 1, 10, 2, K.cw, 1); lp(x + 2, y + 1, K.t3, 1); lp(x + 4, y + 1, K.m2, 1); lp(x + 6, y + 1, K.g4, 1);
    lr(x + 1, y + 3, 3, 6, K.q2, 1); lr(x + 4, y + 3, 7, 6, K.t5, 1);
    lr(x + 5, y + 4, 5, 2, K.t3, 1); lr(x + 5, y + 7, 2, 1, K.p1, 1); lr(x + 8, y + 7, 2, 1, K.p1, 1); lp(x + 2, y + 4, K.cw, 1); lp(x + 2, y + 6, K.cw, 1);
  }
  function propChart(x, y, g) {                // a growth chart in a pot: x, y = bottom-left of the pot
    lr(x, y - 4, 7, 4, K.t2, 1); lr(x - 1, y - 5, 9, 1, K.t3, 1); lr(x + 5, y - 4, 2, 4, K.t1, 1);
    lp(x + 1, y - 6, K.g3, 1); lp(x + 5, y - 6, K.g4, 1); lp(x + 6, y - 7, K.g3, 1);
    lr(x + 3, y - 9, 1, 4, K.w2, 1);
    lr(x - 1, y - 17, 9, 8, K.cw, 1); lr(x - 1, y - 17, 9, 1, K.e3, 1); lr(x - 1, y - 10, 9, 1, K.e3, 1); lr(x - 1, y - 17, 1, 8, K.e3, 1); lr(x + 7, y - 17, 1, 8, K.e3, 1);
    // up and to the right
    const pts = [[0, 13], [2, 12], [3, 13], [5, 11], [6, 9]];
    for (let k = 0; k + 1 < pts.length; k++) line(x + pts[k][0], y - pts[k][1], x + pts[k + 1][0], y - pts[k + 1][1], null, (xx, yy) => lp(xx, yy, K.g2, 1));
    lp(x + 6, y - 16, K.g3, 1); lp(x + 5, y - 15, K.g3, 1); lp(x + 6, y - 15, K.g2, 1);
  }
  function propLaptop(x, y) { lr(x, y, 8, 5, K.e3, 1); lr(x, y, 8, 1, K.e4, 1); lr(x, y + 4, 8, 1, K.e2, 1); }
  function propBundle(x0, y0, x1, y1) {        // the rolled hammock, slung over a shoulder
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) {
      const u = k / n, x = lerp(x0, x1, u), y = lerp(y0, y1, u);
      const c = (fl(k / 2) & 1) ? K.cw : K.t3;
      lp(x, y, c); lp(x, y + 1, sc(c, 0.85)); lp(x + 1, y, c);
    }
  }
  function propMug(x, y) { lr(x, y, 2, 3, K.t3, 1); lp(x + 2, y + 1, K.t3, 1); lp(x, y, K.t4, 1); }
  function propBook(x, y) { lr(x, y, 6, 4, K.q1, 1); lr(x, y, 6, 1, K.cw, 1); lp(x + 3, y + 1, K.cw, 1); }
  function propPot(x, y) { lr(x, y, 4, 3, K.t2, 1); lr(x - 1, y - 1, 6, 1, K.t3, 1); lp(x + 1, y - 2, K.g3, 1); lp(x + 2, y - 3, K.g4, 1); }

  // a person's pose: everything a frame needs to know
  function pose() {
    return { vis: false, layer: 'int', x: 0, y: 0, face: 'R', head: null, mode: 'stand', wph: 0, aF: null, aB: null,
      eyes: 'open', mouth: 'smile', prop: null, pp: null, dy: 0, clip: null, lie: 0, reg: INT, vis2: 1, hdx: 0, hdy: 0, t: 0, blanket: false };
  }
  function blinkAt(t, k) { return Math.sin(per(11, t) + k * 1.7) > 0.985 || Math.sin(per(7, t) + k * 2.9) > 0.992; }
  function drawPerson(Pp, S) {
    lclr(); LMODE = 1;
    const f = S.face, cf = f === 'L' ? 'R' : f;
    let hf = S.head || f;
    if (f === 'L') hf = hf === 'L' ? 'R' : hf === 'R' ? 'L' : hf;
    let dy = S.dy;
    if (S.mode === 'walk' && (fl(S.wph) & 1) === 1) dy -= 1;
    if (S.mode === 'sit') dy += 1;
    if (S.mode === 'sitlow') dy += 3;
    const back = cf === 'B', frontish = cf === 'F';
    // arms behind the body first
    const shY = -11 + dy;
    const aF = S.aF || (S.mode === 'walk' ? [Math.round(1.6 * Math.sin(S.wph * Math.PI / 2)), 5] : [0, 5]);
    const aB = S.aB || (S.mode === 'walk' ? [-Math.round(1.6 * Math.sin(S.wph * Math.PI / 2)), 5] : [0, 5]);
    if (cf === 'R') arm(Pp, -2, shY, aB[0], aB[1], false);
    // the prop if it is carried behind
    if (S.prop === 'bundle') { if (cf === 'R') propBundle(-6, -17 + dy, 3, -9 + dy); else if (cf === 'B') propBundle(-6, -18 + dy, 5, -10 + dy); }
    legs(Pp, S, cf);
    drawTorso(Pp, cf, dy);
    drawHead(Pp, S, hf, dy + S.hdy, S.hdx);
    if (S.prop === 'bundle' && cf === 'F') propBundle(-6, -16 + dy, 5, -9 + dy);
    // carried things in front
    if (S.prop === 'terminal') { if (cf === 'R') propTerminal(-1, -11 + dy, S.t); else if (cf === 'F') propTerminal(-1, -10 + dy, S.t); else if (cf === 'B') propTerminal(-7, -10 + dy, S.t); }
    if (S.prop === 'painting') { if (cf === 'R') propPainting(1, -13 + dy); else if (cf === 'F') { if (S.pp === 'side') propPainting(3, -12 + dy); else propPainting(-6, -12 + dy); } }
    if (S.prop === 'chart') { if (cf === 'R') propChart(5, -2 + dy); else if (cf === 'F') propChart(4, -2 + dy); else if (cf === 'B') propChart(-11, -2 + dy); }
    if (S.prop === 'laptop' || S.prop === 'bundle') { if (cf === 'R') { lr(-3, -8 + dy, 8, 2, K.e3, 1); lr(-3, -8 + dy, 8, 1, K.e4, 1); } else if (cf === 'F') { lr(-8, -9 + dy, 3, 6, K.e3, 1); lr(-8, -9 + dy, 1, 6, K.e4, 1); } }
    if (S.prop === 'bundleup') { for (let x = -6; x <= 5; x++) { const c = (((x + 6) >> 1) & 1) ? K.cw : K.t3; lp(x, -21 + dy, c); lp(x, -22 + dy, c); lp(x, -23 + dy, sc(c, 1.1)); } }
    if (S.prop === 'lapflat' && cf === 'R') { lr(4, -12, 2, 8, K.e3, 1); lr(5, -12, 1, 8, K.e4, 1); }
    if (S.prop === 'mug') propMug(cf === 'R' ? 3 + (S.aF ? S.aF[0] - 1 : 0) : 4, shY + (S.aF ? S.aF[1] : 4) - 2);
    if (S.prop === 'book') propBook(1, -10 + dy);
    if (S.prop === 'pot') propPot(3 + (S.aF ? S.aF[0] - 2 : 0), shY + (S.aF ? S.aF[1] : 3) - 2);
    if (S.prop === 'marker') {}
    // front arm(s)
    if (cf === 'R') arm(Pp, 1, shY, aF[0], aF[1], true);
    else if (frontish || back) { arm(Pp, -5, shY, -(aB[0]) * 0 + (S.aB ? S.aB[0] : 0), aB[1], true); arm(Pp, 4, shY, S.aF ? S.aF[0] : 0, aF[1], true); }
    if (f === 'L') lflip();
    if (S.lie) lrot(S.lie);
    loutline();
  }
  // the cat: ginger, white socks
  const CAT = { o: K.gin, O: K.amb, d: K.t1, w: K.cw, p: K.r3, e: K.ink };
  function drawCat(pose_, t) {
    lclr(); LMODE = 1;
    const { mode } = pose_;
    const o = CAT.o, O = CAT.O, d = CAT.d, w = CAT.w;
    const map = { o, O, d, w, p: CAT.p, e: CAT.e, k: d };
    const put = (rows, ox, oy) => { for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const ch = rows[j][i]; if (ch !== '.') lp(ox + i, oy + j, map[ch]); } };
    if (mode === 'sit' || mode === 'groom' || mode === 'look') {
      const closed = mode === 'groom' || blinkAt(t, 9);
      const sw = Math.sin(per(9, t));
      const rows = [
        '.......o...o.',
        '.......oo.oo.',
        '.......ooooo.',
        '......oOOOOOo',
        closed ? '......oOOOOOo' : '......oeOOeOo',
        closed ? '......okOOkOo' : '......oOwpwOo',
        closed ? '.......owpwo.' : '.......owwwo.',
        '....ooooowOo.',
        '...oOdOOOwOo.',
        '..oOOdOOOwOo.',
        '..oOOOOOOwwo.',
        '..ooooooowww.',
      ];
      if (mode === 'look') rows.splice(0, 7, '.......o...o.', '.......oo.oo.', '......oooooo.', '......oOOOOOo', '......oeOOeOo', '......oOwpwOo', '.......owwwo.');
      put(rows, -7, -12);
      if (mode === 'groom') { lp(4, -7, w); lp(5, -8, w); lp(5, -7, w); }
      // the tail curls round the front, its tip lifting now and then
      lp(-6, -1, o); lp(-7, -1, o); lp(-8, -2, o); lp(-8, -3 - (sw > 0.6 ? 1 : 0), O); if (sw > 0.6) lp(-8, -3, o);
    } else if (mode === 'curl') {
      const br = Math.sin(per(10, t)) > 0.2 ? 1 : 0;
      const rows = [
        '.........o.o..',
        '...ooooo.oooo.',
        '.ooOOdOdOoOOOo',
        'oOOOOOOOOokOko',
        'oOOOOOOOOoOwpo',
        '.oooooooowwwo.',
      ];
      put(rows, -7, -6 + (br ? 0 : 0));
      if (br) { for (let x = -4; x <= 0; x++) lp(x, -7, o); }
      if (Math.sin(per(5, t) + 1) > 0.9) lp(-8, -2, O);
    } else if (mode === 'walk' || mode === 'hop') {
      const st = fl(pose_.wph) & 3, up = mode === 'hop' ? -1 : 0;
      ell(0, -4.5 + up, 5.2, 2.6, null, (x, y, u, v) => lp(x, y, v < -0.3 ? O : o));
      lp(-2, -6 + up, d); lp(1, -6 + up, d); lp(-4, -5 + up, d);
      const lg = mode === 'hop' ? [[-4, 1], [-3, 1], [3, 0], [4, 0]] : [[-4, st === 0 ? 1 : 0], [-2, st === 2 ? 1 : 0], [2, st === 2 ? 1 : 0], [4, st === 0 ? 1 : 0]];
      for (const [x, lift] of lg) { lp(x, -3 + up, o); lp(x, -2 + up - lift, o); lp(x, -1 + up - lift, w); }
      ell(5.5, -7 + up, 2.8, 2.4, null, (x, y, u, v) => lp(x, y, v < -0.2 ? O : o));
      lp(4, -10 + up, o); lp(4, -9 + up, o); lp(7, -10 + up, o); lp(7, -9 + up, o);
      lp(6, -7 + up, CAT.e); lp(8, -7 + up, CAT.e); lp(8, -6 + up, CAT.p); lp(7, -5 + up, w);
      const sw = Math.round(Math.sin(pose_.wph * 0.8) * 1);
      ll(-5, -5 + up, -7, -8 + up + sw, o); lp(-7, -9 + up + sw, O); lp(-8, -9 + up + sw, O);
    }
    if (pose_.face === 'L') lflip();
    loutline();
  }

  /* ================================================================ the timeline */
  // walking from (x0, y0) at ta to (x1, y1) at tb, legs keyed to distance so feet don't slide
  function walk(S, t, ta, tb, x0, y0, x1, y1) {
    const u = ph(t, ta, tb);
    S.x = lerp(x0, x1, u); S.y = lerp(y0, y1, u);
    S.wph = Math.hypot(x1 - x0, y1 - y0) * u / 3.4;
    S.mode = 'walk';
  }
  const typing = (t, k) => ((fl(t * 6 + k) & 1) ? 1 : 0);
  const wave = (t) => Math.round(1.2 * Math.sin(TAU * 2.5 * t));
  const waveL = (t) => [-5 - wave(t), -6 - (wave(t) > 0 ? 1 : 0)];
  const waveArm = (t) => [5 + wave(t), -6 - (wave(t) > 0 ? 1 : 0)];
  function sitAt(S, seat, t, k) {
    S.x = seat.x; S.y = seat.feet; S.mode = 'sit'; S.face = 'R';
    S.aF = [4, 3 + typing(t, k)]; S.aB = [3, 3 + (1 - typing(t, k))];
    S.eyes = blinkAt(t, k) ? 'closed' : 'open';
  }
  const DOORS = [-0.75, 9.0, 16.0, 23.75];          // the studio door opens (one per departure)
  const BDOORS = [8.0, 29.7];                     // (open 0.4 s, stay, close by +1.4)                     // the other building's sliding door
  // hidden behind the bay: x past the cut edge is not drawn
  const BAYCLIP = [0, 0, BAYX, H];
  function inDoorway(S, t, e, fromLeft) {          // e: door event time; returns true if it handled the pose
    if (t < e + 0.1) { S.vis = false; return true; }
    if (t < e + 0.6) {                               // from the hall into the open doorway, sideways
      S.vis = true; S.layer = 'door';
      walk(S, t, e + 0.1, e + 0.6, fromLeft ? DOOR.x0 - 8 : DOOR.x1 + 18, GF_FEET, DOOR.cx, GF_FEET); S.face = fromLeft ? 'R' : 'L'; S.reg = EXT;
      S.clip = [DOOR.x0, 0, DOOR.x1, DOOR.y1]; return true;
    }
    if (t < e + 1.2) { S.vis = true; S.layer = 'door'; walk(S, t, e + 0.6, e + 1.2, DOOR.cx, GF_FEET, DOOR.cx, FAR_FEET); S.face = 'F'; S.reg = EXT; return true; }
    return false;
  }

  function p1Pose(t, S) {                          // the terminal: across to the blue building
    const u = t >= SWAP ? t - D : t;
    S.vis = true; S.t = t; S.prop = null;
    if (u < -3.4) { sitAt(S, SEATS.p1, t, 1); S.layer = 'seat'; if (u > -4.6 && u < -4.0) S.head = 'F'; return S; }
    if (u < -2.9) { S.layer = 'int'; S.x = SEATS.p1.x + 1; S.y = GF_FEET; S.face = 'R'; S.mode = 'stand'; S.aF = [3, 2]; return S; }
    if (u < -2.3) {
      S.layer = 'int'; S.x = SEATS.p1.x + 1; S.y = GF_FEET; S.face = 'R'; S.mode = 'stand';
      S.aF = u < -2.55 ? [5, 1] : [2, 3]; if (u >= -2.55) S.prop = 'terminal';
      S.head = u > -2.5 ? 'F' : null; S.eyes = u > -2.5 ? 'happy' : 'open';
      return S;
    }
    S.prop = 'terminal';
    if (u < -0.6) { S.layer = 'int'; walk(S, u, -2.3, -0.6, SEATS.p1.x + 1, GF_FEET, 226, GF_FEET); S.clip = BAYCLIP; S.aF = [1, 2]; return S; }
    if (inDoorway(S, u, DOORS[0], true)) { S.aF = [1, 2]; return S; }
    S.layer = 'ext'; S.reg = EXT; S.y = FAR_FEET; S.aF = [1, 2];
    if (u < 1.4) { S.x = DOOR.cx; S.face = 'F'; S.head = 'L'; S.eyes = 'happy'; S.mode = 'stand'; return S; }
    if (u < 2.6) { walk(S, u, 1.4, 2.6, DOOR.cx, FAR_FEET, 262, FAR_FEET); S.face = 'R'; return S; }
    if (u < 3.4) { S.x = 262; S.face = 'R'; S.mode = 'stand'; S.head = u < 3.0 ? 'L' : 'R'; if (u < 3.0) { S.face = 'F'; S.head = 'R'; } else { S.face = 'F'; S.head = 'L'; } S.head = u < 3.0 ? 'R' : 'L'; return S; }
    if (u < 5.2) { walk(S, u, 3.4, 5.2, 262, FAR_FEET, 304, FAR_FEET); S.face = 'R'; return S; }
    if (u < 5.9) { walk(S, u, 5.2, 5.9, 304, FAR_FEET, BDOOR.cx, FAR_FEET); S.face = 'R'; return S; }
    if (u < 7.9) { S.x = BDOOR.cx; S.face = 'F'; S.head = 'L'; S.mode = 'stand'; S.aB = waveL(u); S.aF = [1, 2]; S.mouth = 'grin'; S.eyes = 'happy'; S.prop = 'terminal'; return S; }
    if (u < 8.25) { S.x = BDOOR.cx; S.face = 'B'; S.mode = 'stand'; return S; }
    if (u < 9.5) { walk(S, u, 8.25, 9.1, BDOOR.cx, FAR_FEET, BDOOR.cx, FAR_FEET - 10); if (u >= 9.1) S.mode = 'stand'; S.face = 'B'; S.layer = S.y < 290.5 ? 'bdoor' : 'ext'; return S; }
    if (u < 9.7) { S.vis = false; return S; }   // behind the closed glass
    // at a desk in the other building's window
    S.layer = 'blue'; S.reg = BLU; S.prop = null;
    if (u < 10.7) { walk(S, u, 9.7, 10.7, 360, BWIN.y1, 336, BWIN.y1); S.face = 'L'; S.prop = 'terminal'; return S; }
    S.x = 336; S.y = BWIN.y1; S.mode = 'sit'; S.face = 'L'; S.aF = [4, 3 + typing(t, 3)]; S.aB = [3, 4 - typing(t, 3)];
    S.eyes = blinkAt(t, 2) ? 'closed' : 'open';
    if (u > 25.9 && u < 27.6) { S.head = 'F'; }
    if (u > 28.4 && u < 30.2) { S.head = 'F'; S.aF = waveArm(u); S.eyes = 'happy'; S.mouth = 'grin'; }
    if (u > 31.3) { S.head = 'F'; S.eyes = 'happy'; S.mouth = 'grin'; }
    return S;
  }
  function p3Pose(t, S) {                          // the hammock: a long nap under the lamps
    S.vis = true; S.t = t; S.prop = null;
    if (t >= SWAP || t < 4.5) { sitAt(S, SEATS.p3, t, 3); S.layer = 'seat'; S.aF = [4, 2 + typing(t, 4)]; return S; }
    if (t < 5.2) { sitAt(S, SEATS.p3, t, 3); S.layer = 'seat'; S.aF = [2, -8]; S.aB = [1, -8]; S.eyes = 'closed'; S.mouth = 'o'; return S; }
    if (t < 5.6) { sitAt(S, SEATS.p3, t, 3); S.layer = 'seat'; S.aF = [5, 1]; return S; }
    if (t < 6.0) { S.layer = 'int'; S.x = SEATS.p3.x + 1; S.y = GF_FEET; S.mode = 'stand'; S.face = 'R'; return S; }
    if (t < 6.6) { S.layer = 'int'; S.x = SEATS.p3.x + 1; S.y = GF_FEET; S.mode = 'stand'; S.face = 'R'; S.aF = [5, 4]; if (t > 6.3) S.prop = 'bundle'; return S; }
    S.prop = 'bundle';
    if (t < 9.0) { S.layer = 'int'; walk(S, t, 6.6, 9.0, SEATS.p3.x + 1, GF_FEET, 226, GF_FEET); S.clip = BAYCLIP; return S; }
    if (inDoorway(S, t, DOORS[1], true)) return S;
    S.layer = 'ext'; S.reg = EXT;
    if (t < 14.4) { walk(S, t, 10.2, 14.4, DOOR.cx, FAR_FEET, DOOR.cx, NEAR_FEET); S.face = 'F'; return S; }
    if (t < 17.2) { walk(S, t, 14.4, 17.2, DOOR.cx, NEAR_FEET, HAM.cx, NEAR_FEET); S.face = 'R'; return S; }
    if (t < 17.8) { S.x = HAM.cx; S.y = NEAR_FEET; S.face = 'F'; S.mode = 'stand'; S.prop = 'bundleup'; S.aF = [1, -8]; S.aB = [-1, -8]; S.mouth = 'grin'; return S; }
    if (t < 18.8) { S.x = HAM.cx; S.y = NEAR_FEET; S.face = 'F'; S.mode = 'stand'; S.prop = 'laptop'; S.aF = [3, -4]; S.aB = [-3, -4]; S.eyes = 'happy'; S.mouth = 'grin'; return S; }
    if (t < 19.5) {                                 // a hop up into the hammock
      const u = ph(t, 18.8, 19.5);
      S.x = HAM.cx - 2 * u; S.y = NEAR_FEET - 12 * Math.sin(Math.PI * u) - 8 * s5(u); S.face = 'F'; S.mode = 'stand'; S.prop = 'laptop';
      S.aF = [2, -6]; S.aB = [-2, -6]; S.eyes = 'happy';
      if (u > 0.55) { S.lie = 1; S.layer = 'ham'; S.x = HAM.cx + 9; S.y = 374; }
      return S;
    }
    S.layer = 'ham'; S.lie = 1; S.x = HAM.cx + 11; S.y = 374; S.face = 'R'; S.mode = 'stand'; S.prop = 'lapflat'; S.aF = [3, 2]; S.aB = [3, 3];
    if (t < 20.3) { S.eyes = 'open'; S.mouth = 'smile'; return S; }
    if (t < 21.3) { S.eyes = 'closed'; S.mouth = 'o'; S.prop = 'laptop'; S.aF = [1, -9]; S.aB = [0, -9]; return S; }
    if (t < 28.6) { S.eyes = 'closed'; S.mouth = 'smile'; return S; }
    if (t < 29.4) { S.eyes = t < 28.9 ? 'closed' : 'open'; S.mouth = 'o'; S.prop = 'laptop'; S.aF = [1, -9]; S.aB = [0, -9]; return S; }
    S.lie = 0; S.layer = 'ext'; S.prop = 'laptop';
    if (t < 30.0) { const u = ph(t, 29.4, 30.0); S.x = HAM.cx + 9 * (1 - u); S.y = lerp(374, NEAR_FEET, s5(u)) - 6 * Math.sin(Math.PI * u); S.face = 'F'; S.mode = 'stand'; S.eyes = 'happy'; return S; }
    if (t < 30.8) { S.x = HAM.cx; S.y = NEAR_FEET; S.face = 'F'; S.mode = 'stand'; S.aF = [3, -2]; S.aB = [-3, -2]; return S; }
    S.prop = 'bundle';
    if (t < 33.6) { walk(S, t, 30.8, 33.6, HAM.cx, NEAR_FEET, 376, NEAR_FEET); S.face = 'R'; return S; }
    S.vis = false; return S;
  }
  function p2Pose(t, S) {                          // the app window: the pause on the doorstep
    S.vis = true; S.t = t; S.prop = null;
    if (t >= SWAP || t < 10.6) { sitAt(S, SEATS.p2, t, 5); S.layer = 'seat'; S.aF = [5, 2 + typing(t * 0.5, 2)]; return S; }
    if (t < 11.2) { S.layer = 'int'; S.x = SEATS.p2.x + 1; S.y = UF_FEET; S.mode = 'stand'; S.face = 'R'; return S; }
    if (t < 12.2) { S.layer = 'int'; S.x = SEATS.p2.x + 8; S.y = UF_FEET; S.mode = 'stand'; S.face = 'R'; S.aF = [2, -9]; S.aB = [1, -9]; S.head = 'R';
      if (t > 11.7) { S.prop = 'painting'; S.aF = [3, 0]; S.aB = [3, 0]; S.head = null; S.eyes = 'happy'; } return S; }
    S.prop = 'painting'; S.aF = [3, 0]; S.aB = [3, 0];
    if (t < 14.4) { S.layer = 'int'; walk(S, t, 12.2, 14.4, SEATS.p2.x + 8, UF_FEET, 216, UF_FEET); S.aF = [3, 0]; S.aB = [3, 0]; return S; }
    if (t < 15.8) { S.layer = 'int'; walk(S, t, 14.4, 15.8, 216, UF_FEET, 236, UF_FEET + 28); S.clip = [0, 0, W, SLAB0 - 1]; S.aF = [3, 0]; S.aB = [3, 0]; return S; }
    S.aF = null; S.aB = null; S.pp = 'side';
    if (inDoorway(S, t, DOORS[2], false)) { S.aF = [1, 1]; return S; }
    S.layer = 'ext'; S.reg = EXT; S.y = FAR_FEET; S.x = DOOR.cx; S.mode = 'stand'; S.face = 'F'; S.aF = [1, 1];
    if (t < 17.8) { S.head = 'R'; return S; }
    if (t < 18.4) { S.head = 'L'; return S; }
    if (t < 19.8) { S.aB = [-2, -8 - (fr(t * 3) < 0.5 ? 0 : 1)]; S.eyes = 'closed'; S.mouth = 'none'; S.head = fr(t * 0.7) < 0.5 ? 'F' : 'F'; return S; }
    if (t < 20.3) { S.aB = [-2, 1]; S.aF = [2, 1]; S.eyes = 'happy'; S.mouth = 'smile'; S.dy = -(t < 20.05 ? 1 : 0); return S; }
    S.pp = 'side';
    if (t < 32.3) { walk(S, t, 20.3, 32.3, DOOR.cx, FAR_FEET, -14, FAR_FEET); S.face = 'L'; S.prop = 'painting'; S.aF = [3, 0]; S.aB = [3, 0]; return S; }
    S.vis = false; return S;
  }
  function p4Pose(t, S) {                          // the chart: across to the blue building, a wave from the window
    S.vis = true; S.t = t; S.prop = null;
    if (t >= SWAP || t < 5.8 || (t >= 8.0 && t < 17.0)) { sitAt(S, SEATS.p4, t, 7); S.layer = 'seat'; return S; }
    if (t < 8.0) { sitAt(S, SEATS.p4, t, 7); S.layer = 'seat'; S.head = 'F'; S.aF = waveArm(t); S.eyes = 'happy'; S.mouth = 'grin'; return S; }
    if (t < 17.5) { S.layer = 'int'; S.x = SEATS.p4.x + 1; S.y = UF_FEET; S.mode = 'stand'; S.face = 'R'; return S; }
    if (t < 18.1) { S.layer = 'int'; S.x = SEATS.p4.x + 1; S.y = UF_FEET; S.mode = 'stand'; S.face = 'R'; S.aF = [5, 2]; if (t > 17.8) { S.prop = 'chart'; S.aF = [3, 3]; S.eyes = 'happy'; } return S; }
    S.prop = 'chart'; S.aF = [5, 3]; S.aB = [5, 3];
    if (t < 22.4) { S.layer = 'int'; walk(S, t, 18.1, 22.4, SEATS.p4.x + 1, UF_FEET, 216, UF_FEET); S.aF = [5, 3]; S.aB = [5, 3]; return S; }
    if (t < 23.8) { S.layer = 'int'; walk(S, t, 22.4, 23.8, 216, UF_FEET, 236, UF_FEET + 28); S.clip = [0, 0, W, SLAB0 - 1]; S.aF = [3, 3]; S.aB = [3, 3]; return S; }
    if (inDoorway(S, t, DOORS[3], false)) { S.aF = [5, 3]; S.aB = [5, 3]; return S; }
    S.layer = 'ext'; S.reg = EXT; S.y = FAR_FEET;
    if (t < 26.0) { walk(S, t, 24.95, 26.0, DOOR.cx, FAR_FEET, 262, FAR_FEET); S.face = 'R'; S.aF = [3, 3]; S.aB = [3, 3]; return S; }
    if (t < 27.8) { walk(S, t, 26.0, 27.8, 262, FAR_FEET, 304, FAR_FEET); S.face = 'R'; S.aF = [3, 3]; S.aB = [3, 3]; if (t < 26.25) S.dy = -1; return S; }
    if (t < 28.5) { walk(S, t, 27.8, 28.5, 304, FAR_FEET, BDOOR.cx, FAR_FEET); S.face = 'R'; S.aF = [3, 3]; S.aB = [3, 3]; return S; }
    if (t < 29.7) { S.x = BDOOR.cx; S.face = 'F'; S.head = 'L'; S.mode = 'stand'; S.aB = waveL(t); S.aF = [2, 3]; S.eyes = 'happy'; S.mouth = 'grin'; return S; }
    if (t < 30.0) { S.x = BDOOR.cx; S.face = 'B'; S.mode = 'stand'; return S; }
    if (t < 31.15) { walk(S, t, 30.0, 30.85, BDOOR.cx, FAR_FEET, BDOOR.cx, FAR_FEET - 10); if (t >= 30.85) S.mode = 'stand'; S.face = 'B'; S.layer = S.y < 290.5 ? 'bdoor' : 'ext'; return S; }
    if (t < 31.2) { S.vis = false; return S; }
    S.layer = 'blue'; S.reg = BLU;
    if (t < 31.75) { walk(S, t, 31.2, 31.75, 374, BWIN.y1, 348, BWIN.y1); S.face = 'L'; S.aF = [3, 3]; S.aB = [3, 3]; return S; }
    S.x = 348; S.y = BWIN.y1; S.face = 'F'; S.mode = 'stand'; S.eyes = 'happy'; S.mouth = 'grin'; S.aF = [3, 3]; S.aB = [-3, 3];
    return S;
  }
  function w1Pose(t, S) {                          // headphones on, all night
    S.vis = true; S.t = t;
    sitAt(S, SEATS.w1, t, 11); S.layer = 'seat';
    S.hdy = Math.sin(TAU * 1.2 * t) > 0.35 ? 1 : 0;   // nodding along at 72 bpm
    if (t > 24.5 && t < 25.5) { S.aF = [1, -8]; S.aB = [0, -8]; S.eyes = 'closed'; S.mouth = 'o'; S.hdy = 0; }
    if (t > 30.2 && t < 31.0) { S.mouth = 'o'; S.eyes = 'closed'; S.hdy = 0; }
    if (t >= 31.0 && t < 35.6) { S.hdx = 2; S.hdy = 3; S.eyes = 'closed'; S.mouth = 'none'; S.aF = [4, 2]; S.aB = [4, 2]; }
    if (t >= 35.6 && t < 36.5) { S.aF = [1, -8]; S.aB = [0, -8]; S.eyes = 'closed'; S.mouth = 'o'; S.hdy = 0; }
    return S;
  }
  function w2Pose(t, S) {                          // the coffee, the wave, the nap on the couch
    S.vis = true; S.t = t; S.layer = 'int'; S.prop = null;
    const atMachine = (tt) => { S.x = 43; S.y = GF_FEET; S.face = 'L'; S.mode = 'stand'; S.aF = [4, 1]; S.prop = 'mug'; S.head = tt < 1.0 || tt > 39.4 ? 'L' : 'L'; };
    if (t < 1.6 || t >= 38.8) { atMachine(t); return S; }
    if (t < 2.0) { S.x = 43; S.y = GF_FEET; S.face = 'R'; S.mode = 'stand'; S.aF = [3, 2]; S.prop = 'mug'; return S; }
    if (t < 4.4) { walk(S, t, 2.0, 4.4, 43, GF_FEET, SEATS.w2.x, GF_FEET); S.face = 'R'; S.aF = [3, 2]; S.prop = 'mug'; return S; }
    if (t < 26.0) {
      sitAt(S, SEATS.w2, t, 13); S.layer = 'seat';
      if (t < 5.9) { S.aF = [2, -4]; S.prop = 'mug'; S.eyes = 'closed'; }
      else if (t < 7.9) { S.head = 'F'; S.aF = waveArm(t); S.eyes = 'happy'; S.mouth = 'grin'; }
      else if (t > 22.6 && t < 24.6) { S.head = 'F'; S.eyes = 'happy'; S.aF = [3, 3]; }
      return S;
    }
    if (t < 26.5) { S.x = SEATS.w2.x - 1; S.y = GF_FEET; S.face = 'L'; S.mode = 'stand'; return S; }
    if (t < 27.8) { walk(S, t, 26.5, 27.8, SEATS.w2.x - 1, GF_FEET, 72, GF_FEET); S.face = 'L'; return S; }
    if (t < 28.3) { S.x = 72; S.y = GF_FEET - 2; S.face = 'F'; S.mode = 'stand'; S.eyes = 'closed'; S.mouth = 'o'; S.aF = [1, -8]; S.aB = [-1, -8]; return S; }
    if (t < 35.4) { S.lie = 1; S.layer = 'couch'; S.x = 80; S.y = GF_FEET - 12; S.face = 'F'; S.mode = 'stand'; S.eyes = 'closed'; S.mouth = 'smile'; S.blanket = true; return S; }
    if (t < 36.2) { S.x = 72; S.y = GF_FEET - 2; S.face = 'F'; S.mode = 'stand'; S.aF = [1, -8]; S.aB = [-1, -8]; S.eyes = 'closed'; S.mouth = 'o'; return S; }
    if (t < 36.6) { S.x = 72; S.y = GF_FEET; S.face = 'L'; S.mode = 'stand'; return S; }
    if (t < 38.2) { walk(S, t, 36.6, 38.2, 72, GF_FEET, 43, GF_FEET); S.face = 'L'; return S; }
    S.x = 43; S.y = GF_FEET; S.face = 'L'; S.mode = 'stand'; S.aF = [4, -1]; S.prop = t > 38.5 ? 'mug' : null;
    return S;
  }
  function w3Pose(t, S) {                          // the whiteboard, the seedling, the beanbag
    S.vis = true; S.t = t; S.layer = 'int'; S.prop = null;
    const board = () => { S.x = 98; S.y = UF_FEET; S.face = 'L'; S.mode = 'stand'; S.aF = [4 + Math.round(Math.sin(per(20, t)) * 1.5), -7 + Math.round(Math.sin(per(27, t)) * 2)]; };
    if (t < 21.4 || t >= 36.6) {
      board();
      if ((t > 12.0 && t < 13.2) || (t > 3.0 && t < 3.8)) { S.aF = [1, 4]; S.x = 100; S.head = 'L'; S.eyes = 'happy'; }
      return S;
    }
    if (t < 22.0) { S.x = 98; S.y = UF_FEET; S.face = 'R'; S.mode = 'stand'; S.aF = [3, -6]; if (t > 21.75) { S.prop = 'pot'; S.aF = [3, 1]; } return S; }
    if (t < 22.8) { walk(S, t, 22.0, 22.8, 98, UF_FEET, 109, UF_FEET); S.face = 'R'; S.prop = 'pot'; S.aF = [3, 1]; return S; }
    if (t < 23.6) { S.x = 109; S.y = UF_FEET; S.face = 'R'; S.mode = 'stand'; S.aF = [8, 0]; if (t < 23.2) S.prop = 'pot'; S.head = 'R'; return S; }
    if (t < 24.4) { S.x = 109; S.y = UF_FEET; S.face = 'F'; S.mode = 'stand'; S.eyes = 'happy'; S.mouth = 'grin'; S.dy = -Math.round(Math.abs(Math.sin((t - 23.6) * TAU * 1.25)) * 2); S.aF = [2, -3]; S.aB = [-2, -3]; return S; }
    if (t < 26.2) { walk(S, t, 24.4, 26.2, 109, UF_FEET, 78, UF_FEET); S.face = 'L'; return S; }
    if (t < 26.8) { S.x = 78; S.y = UF_FEET - 2; S.face = 'R'; S.mode = 'sitlow'; S.dy = -Math.round(3 * (1 - ph(t, 26.2, 26.8))); return S; }
    if (t < 35.0) {
      S.x = 74; S.y = UF_FEET - 2; S.face = 'R'; S.mode = 'sitlow'; S.prop = 'book'; S.aF = [3, 2]; S.aB = [3, 2];
      if (t > 30.6) { S.eyes = 'closed'; S.hdx = 1; S.hdy = 1; S.mouth = 'none'; } else S.eyes = blinkAt(t, 4) ? 'closed' : 'open';
      return S;
    }
    if (t < 35.6) { S.x = 76; S.y = UF_FEET; S.face = 'F'; S.mode = 'stand'; S.aF = [1, -8]; S.aB = [-1, -8]; S.eyes = 'closed'; S.mouth = 'o'; return S; }
    walk(S, t, 35.6, 36.6, 76, UF_FEET, 98, UF_FEET); S.face = 'R'; return S;
  }
  function catPose(t, S) {
    S.vis = true; S.face = 'R'; S.wph = 0;
    if (t >= SWAP || t < 20.5) {
      S.x = 19; S.y = 247; S.mode = 'sit';
      if (t > 9.0 && t < 11.0) S.mode = 'groom';
      if (t < 1.6 || t > 38.6) S.mode = 'look';
      return S;
    }
    if (t < 21.1) { const u = ph(t, 20.5, 21.1); S.x = lerp(19, 32, u); S.y = lerp(247, GF_FEET, u * u) - 7 * Math.sin(Math.PI * u); S.mode = 'hop'; return S; }
    if (t < 25.2) { S.mode = 'walk'; const u = ph(t, 21.1, 25.2); S.x = lerp(32, 134, u); S.y = GF_FEET; S.wph = (S.x - 32) / 2.6; return S; }
    if (t < 25.8) { const u = ph(t, 25.2, 25.8); S.x = lerp(134, SEATS.p3.x - 1, u); S.y = lerp(GF_FEET, GF_FEET - 4, u) - 6 * Math.sin(Math.PI * u); S.mode = 'hop'; return S; }
    if (t < 27.0) { S.x = SEATS.p3.x - 1; S.y = GF_FEET - 4; S.mode = 'sit'; S.face = (fl((t - 25.8) / 0.4) & 1) ? 'L' : 'R'; return S; }
    S.x = SEATS.p3.x - 1; S.y = GF_FEET - 4; S.mode = 'curl'; return S;
  }

  /* ================================================================ things that move */
  function chair(x, feet, spin, push, c) {
    const xx = x - push;
    const bx = Math.round(-4 * Math.cos(spin));
    // back rest
    for (let y = feet - 15; y <= feet - 6; y++) { px(xx + bx, y, c); px(xx + bx + (bx <= 0 ? -1 : 1), y, sc(c, 0.8)); }
    hl(xx - 3, xx + 3, feet - 5, sc(c, 1.15)); hl(xx - 3, xx + 3, feet - 4, c);
    vl(xx, feet - 3, feet - 2, K.n2);
    hl(xx - 3, xx + 3, feet - 1, K.n2); px(xx - 3, feet, K.ink); px(xx + 3, feet, K.ink); px(xx, feet, K.ink);
  }
  // when someone stands up, their chair rolls back a little and swivels to rest
  function chairSpin(t, tv) { const d = t - tv; if (d < 0) return [0, 0]; return [1.6 * Math.exp(-d * 1.6) * Math.sin(d * 6), 2 * s5(d / 0.5)]; }
  function screenCode(R_, t, k, dim) {           // lines of coloured bars that scroll; a blinking cursor
    const step = fl(t * 2) + k * 7;                 // 80 steps a loop; the text repeats with them
    for (let y = 0; y < R_.h; y++) for (let x = 0; x < R_.w; x++) epx(R_.x + x, R_.y + y, K.n1, dim);
    for (let r = 0; r < R_.h; r += 2) {
      const line_ = mod(step + (r >> 1), 80), ind = fl(ih(line_, 1, k) * 3), len = 2 + fl(ih(line_, 2, k) * (R_.w - 3));
      const c = [K.s2, K.g4, K.m2, K.t4, K.p2][fl(ih(line_, 3, k) * 5)];
      for (let x = ind; x < Math.min(R_.w, ind + len); x++) epx(R_.x + x, R_.y + r, c, dim * (x === ind + len - 1 ? 0.7 : 1));
    }
    if (fr(t + k * 0.3) < 0.5) epx(R_.x + 1, R_.y + R_.h - 1, K.cw, dim);
  }
  function screenDesign(R_, t, dim) {
    for (let y = 0; y < R_.h; y++) for (let x = 0; x < R_.w; x++) epx(R_.x + x, R_.y + y, y === 0 ? K.e4 : K.cw, dim);
    for (let y = 1; y < R_.h; y++) epx(R_.x, R_.y + y, K.q2, dim), epx(R_.x + 1, R_.y + y, K.q2, dim);
    erect(R_.x + 3, R_.y + 2, 5, 3, K.t3, dim); erect(R_.x + 9, R_.y + 2, 3, 3, K.p2, dim); erect(R_.x + 3, R_.y + 6, 9, 1, K.e3, dim);
    const cx = R_.x + 4 + Math.round(3 + 3 * Math.sin(per(5, t))), cy = R_.y + 3 + Math.round(2 * Math.sin(per(3, t)));
    epx(cx, cy, K.ink, dim);
  }
  function screenDash(R_, t, dim) {
    for (let y = 0; y < R_.h; y++) for (let x = 0; x < R_.w; x++) epx(R_.x + x, R_.y + y, K.n2, dim);
    for (let k = 0; k < 5; k++) { const h = 2 + Math.round((k + 1) * 0.9 + Math.sin(per(4, t) + k) * 0.6); for (let y = 0; y < h; y++) epx(R_.x + 1 + k * 2, R_.y + R_.h - 1 - y, k === 4 ? K.g4 : K.s2, dim); }
  }
  function screenDoc(R_, t, dim) {
    for (let y = 0; y < R_.h; y++) for (let x = 0; x < R_.w; x++) epx(R_.x + x, R_.y + y, K.cw, dim);
    for (let r = 1; r < R_.h; r += 2) { const len = 4 + fl(ih(r, fl(t / 3), 5) * (R_.w - 6)); for (let x = 1; x < len; x++) epx(R_.x + x, R_.y + r, K.e3, dim); }
  }
  function screenWave(R_, t, dim) {
    for (let y = 0; y < R_.h; y++) for (let x = 0; x < R_.w; x++) epx(R_.x + x, R_.y + y, K.ink, dim);
    for (let x = 0; x < R_.w; x++) { const y = Math.round(R_.h / 2 + Math.sin(x * 0.9 + TAU * 1.2 * t) * (R_.h / 2 - 1) * (0.5 + 0.5 * Math.sin(x * 0.4))); epx(R_.x + x, R_.y + clamp(y, 0, R_.h - 1), K.r3, dim); }
  }
  function screenSaver(R_, t, k, dim) {
    for (let y = 0; y < R_.h; y++) for (let x = 0; x < R_.w; x++) epx(R_.x + x, R_.y + y, K.ink, dim);
    const x = R_.x + Math.round((R_.w - 1) * (0.5 + 0.45 * Math.sin(per(3, t) + k))), y = R_.y + Math.round((R_.h - 1) * (0.5 + 0.45 * Math.sin(per(4, t) + k * 2)));
    epx(x, y, K.s1, dim);
  }
  function screenOff(R_) { for (let y = 0; y < R_.h; y++) for (let x = 0; x < R_.w; x++) { CR = INT; px(R_.x + x, R_.y + y, K.n1); } }
  const scrOn = (t) => 1 - bump(t, 32.4, 32.7, 34.4, 34.8);   // every screen sleeps through the dark hour

  function drawScreens(t) {
    const on = scrOn(t), dimN = 0.85;
    CQ = 2;
    // the all-nighter
    if (on > 0.5 && !(t > 31.6 && t < 35.7)) { screenCode(SCR.w1a, t, 1, dimN); screenWave(SCR.w1b, t, dimN); }
    else { screenOff(SCR.w1a); screenOff(SCR.w1b); }
    // the chart's desk
    if (on < 0.5) screenOff(SCR.p4); else if (t >= SWAP || t < 17.6) screenDash(SCR.p4, t, dimN); else screenSaver(SCR.p4, t, 2, 0.7);
    // the app window's desk
    if (on < 0.5) screenOff(SCR.p2); else if (t >= SWAP || t < 11.2) screenDesign(SCR.p2, t, dimN); else screenSaver(SCR.p2, t, 3, 0.7);
    // the coffee desk
    if (on < 0.5) screenOff(SCR.w2); else if (t >= 4.4 && t < 26.0) screenDoc(SCR.w2, t, dimN); else screenSaver(SCR.w2, t, 4, 0.7);
    // the other building's screen
    if (LV.blue > 0.4) screenCode(SCR.blue, t, 9, 0.6 * LV.blue + 0.2); else screenOff(SCR.blue);
  }
  // things on desks
  function drawDeskThings(t) {
    CR = INT; CQ = 2;
    const ty = GF_FEET - 11, tyU = UF_FEET - 11;
    // the laptop on the coder's desk: open and glowing, then shut, then gone
    const lx = 154;
    if (t >= SWAP || t < 5.2) {
      const glow = scrOn(t) > 0.5;
      rect(lx, ty - 1, 9, 1, K.e3); hl(lx, lx + 8, ty - 1, K.e4);
      for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) { const X = lx + 1 + x - fl(y / 3), Y = ty - 2 - y; if (glow) epx(X, Y, (y === 5 || x === 0 || x === 7) ? K.e2 : (((x + fl(t * 2) + y * 3) % 5) < 3 && y % 2 === 0 ? K.s2 : K.n1), 0.9); else px(X, Y, K.n2); }
    } else if (t < 5.6) {
      const u = ph(t, 5.2, 5.6), hgt = Math.round(6 * (1 - u));
      rect(lx, ty - 1, 9, 1, K.e3);
      for (let y = 0; y < hgt; y++) for (let x = 0; x < 8; x++) px(lx + 1 + x - fl(y / 3), ty - 2 - y, K.e2);
    } else if (t < 6.3) { rect(lx, ty - 2, 9, 2, K.e3); hl(lx, lx + 8, ty - 2, K.e4); }
    // the hammock bundle leaning by that desk
    if (t >= SWAP || t < 6.3) { T = WK; for (let y = 0; y < 13; y++) { const x = 178 + fl(y / 6); px(x, GF_FEET - y, (fl(y / 2) & 1) ? K.cw : K.t3); px(x + 1, GF_FEET - y, (fl(y / 2) & 1) ? K.e4 : K.t2); } }
    // the terminal on the last desk
    if (t >= SWAP && t < 37.45) { lclr(); propTerminal(0, 0, t); if (scrOn(t) < 0.5) for (let i = 0; i < LMK.length; i++) if (LMK[i] === 2) { LMK[i] = 1; LCOL[i * 3] = K.n1[0]; LCOL[i * 3 + 1] = K.n1[1]; LCOL[i * 3 + 2] = K.n1[2]; } loutline(); lblit(TERM.x + 0, TERM.y - 7, INT); }
    // the framed app window on the wall, or the nail and the paler patch where it hung
    if (t >= SWAP || t < 11.7) { lclr(); propPainting(0, 0); lblit(PAINT.x, PAINT.y, INT); }
    else { for (let y = 0; y < 10; y++) for (let x = 0; x < 12; x++) { const j = ((PAINT.y + y) * W + PAINT.x + x) * 3; WK.A[j] = Math.min(255, WK.A[j] * 1.06); WK.A[j + 1] = Math.min(255, WK.A[j + 1] * 1.06); WK.A[j + 2] = Math.min(255, WK.A[j + 2] * 1.07); } px(PAINT.x + 6, PAINT.y - 1, K.n3); px(PAINT.x + 5, PAINT.y, sc(K.n3, 1.4)); px(PAINT.x + 7, PAINT.y, sc(K.n3, 1.4)); }
    // the potted chart on its desk; later, a seedling in its place
    if (t >= SWAP || t < 17.8) { lclr(); propChart(0, 0); lblit(CHART.x, CHART.y + 0, INT); }
    else if (t >= 23.2) {
      const g = s5(ph(t, 23.4, 30.4));
      lclr(); LMODE = 1;
      lr(0, -3, 5, 3, K.t2); lr(-1, -4, 7, 1, K.t3); lr(4, -3, 1, 3, K.t1); lr(0, -4, 5, 1, K.w1);
      const sh = 1 + Math.round(5 * g);
      for (let y = 0; y < sh; y++) lp(2, -5 - y, K.g3);
      lp(1, -5 - sh, K.g4); lp(3, -5 - sh, K.g4);
      if (g > 0.3) { lp(0, -5 - sh, K.g3); lp(4, -6 - sh, K.g3); }
      if (g > 0.65) { lp(1, -3 - sh, K.g4); lp(0, -2 - sh, K.g3); lp(3, -2 - sh, K.g4); lp(4, -1 - sh, K.g3); }
      if (g > 0.9) { lp(2, -6 - sh, K.g5); }
      loutline(); lblit(CHART.x + 1, CHART.y, INT);
    }
    // the coffee mug on the coffee desk
    if (t >= 5.9 && t < SWAP) { lclr(); propMug(0, 0); loutline(); lblit(106, ty - 3, INT); }
    // the whiteboard drawing: boxes, arrows, a circle, a few sticky squares; wiped clean in the dark
    drawBoard(t);
    void tyU;
  }
  const BOARD = [];
  function buildBoard() {
    // strokes in board coordinates, each revealed over its time window (story time u = t or t - D)
    const B = (pts, c, t0, t1) => BOARD.push({ pts, c, t0, t1 });
    B([[3, 3], [11, 3], [11, 8], [3, 8], [3, 3]], K.q0, -3.2, -2.2);
    B([[12, 5], [17, 5], [16, 4], [17, 5], [16, 6]], K.n3, -2.0, -1.5);
    B([[18, 2], [28, 2], [28, 9], [18, 9], [18, 2]], K.t1, -1.3, -0.1);
    B([[22, 10], [22, 14], [21, 13], [22, 14], [23, 13]], K.n3, 0.2, 0.9);
    B([[16, 15], [29, 15], [29, 20], [16, 20], [16, 15]], K.g1, 1.2, 2.8);
    for (let k = 0; k < 3; k++) B([[19 + k * 3, 17], [20 + k * 3, 17]], K.g2, 3.0 + k * 0.4, 3.3 + k * 0.4);
    B([[7, 9], [7, 17], [15, 17]], K.n3, 4.2, 5.4);
    B([[2, 13], [6, 13], [6, 18], [2, 18], [2, 13]], K.p0, 6.0, 7.0);
    B([[30, 4], [32, 6], [30, 8], [28, 6], [30, 4]], K.red1, 8.2, 9.0);
    B([[2, 21], [12, 21]], K.q0, 13.6, 14.4);
    B([[14, 21], [20, 21]], K.t1, 14.6, 15.2);
    B([[30, 12], [30, 21]], K.n3, 16.0, 16.8);
    B([[24, 22], [32, 22]], K.g1, 18.0, 19.4);
  }
  function drawBoard(t) {
    const u = t >= SWAP ? t - D : t, X = SCR.board.x, Y = SCR.board.y;
    CR = INT; CQ = 1;
    // sticky squares, there all along
    rect(X + 26, Y + 11, 3, 3, K.m2); rect(X + 31, Y + 13, 2, 2, K.r3);
    for (const s of BOARD) {
      if (u < s.t0) continue;
      const f = ph(u, s.t0, s.t1);
      let total = 0; const segs = [];
      for (let k = 0; k + 1 < s.pts.length; k++) { const l = Math.hypot(s.pts[k + 1][0] - s.pts[k][0], s.pts[k + 1][1] - s.pts[k][1]); segs.push(l); total += l; }
      let left = total * f;
      for (let k = 0; k + 1 < s.pts.length && left > 0; k++) {
        const a = s.pts[k], b = s.pts[k + 1], g = Math.min(1, left / segs[k]);
        line(X + a[0], Y + a[1], X + lerp(a[0], b[0], g), Y + lerp(a[1], b[1], g), s.c);
        left -= segs[k];
      }
    }
    CQ = 2;
  }
  function drawDoorBacks() {
    const B = BDOOR; CR = BLU; CQ = 2;
    for (let y = B.y0; y < B.y1; y++) for (let x = B.x0; x < B.x1; x++) px(x, y, y > B.y1 - 10 ? K.b2 : sc(K.b4, 0.95));
  }
  function drawDoors(t) {
    // the studio door: a coral door with a little round window, swinging in
    let open = 0;
    for (const e of DOORS) { const tt = e < 0 && t > 20 ? t - D : t; open = Math.max(open, bump(tt, e, e + 0.35, e + 1.3, e + 1.7)); }
    LV.door = open;
    const { x0, x1, y0, y1 } = DOOR, w = x1 - x0;
    CR = INT; CQ = 2;
    // the hallway behind (dark, warm), with the foot of the stairs
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px(x, y, (x - x0 + (y - y0)) % 6 === 0 && y > y0 + 8 ? K.w2 : sc(K.w1, 0.9 + 0.1 * ((y - y0) / 36)));
    const pw = Math.max(2, Math.round(w * (1 - 0.85 * s5(open))));
    CR = EXT;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x0 + pw; x++) {
      const u = (x - x0) / Math.max(1, pw - 1);
      let c = K.t3;
      if (x === x0 || x === x0 + pw - 1 || y === y0) c = K.t1;
      if (y === y0 + 20 || (y > y0 + 22 && y < y1 - 2 && (x === x0 + 2 || x === x0 + pw - 3) && pw > 8)) c = K.t2;
      px(x, y, c);
      void u;
    }
    if (pw > 8) {
      // round window in the door, warm when the studio is lit
      const cx = x0 + pw / 2, cy = y0 + 9;
      ell(cx, cy, Math.min(4.5, pw / 2 - 2), 4.5, null, (x, y, uu, vv) => { if (uu * uu + vv * vv > 0.55) px(x, y, K.w4); else epx(x, y, K.amb, 0.12 + 0.75 * LV.main * (1 - LV.dark)); });
      px(x0 + pw - 4, y0 + 22, K.m2); px(x0 + pw - 4, y0 + 23, K.m0);
    }
    // the transom glow
    // the other building's glass doors: two panels that slide apart
    let bo = 0;
    for (const e of BDOORS) bo = Math.max(bo, bump(t, e, e + 0.4, e + 1.0, e + 1.4));
    LV.bdoor = bo;
    const B = BDOOR, half = (B.x1 - B.x0) >> 1, sh = Math.round(half * s5(bo) * 0.9);
    CR = GLS;
    for (let y = B.y0; y < B.y1; y++) {
      for (let x = B.x0 - sh; x < B.x0 + half - sh; x++) if (x >= B.x0 - 1) px(x, y, (x === B.x0 + half - sh - 1) ? K.b0 : K.b1);
      for (let x = B.x0 + half + sh; x < B.x1 + sh; x++) if (x <= B.x1) px(x, y, (x === B.x0 + half + sh) ? K.b0 : K.b1);
    }
    CR = EXT;
  }

  /* ================================================================ outdoors */
  function drawSky(t) {
    const n = LV.night;
    if (n > 0.01) {
      for (const s of STARS) {
        const tw = 0.65 + 0.35 * Math.sin(per(s[3], t) + s[4]);
        const k = n * s[2] * tw;
        const i = s[1] * W + s[0];
        if (WK.R[i] !== SKY) continue;
        const v = 150 * k;
        eadd(s[0], s[1], v, v * 0.95, v * 0.85);
        if (s[5] && k > 0.5) { const v2 = 50 * k; eadd(s[0] - 1, s[1], v2, v2, v2); eadd(s[0] + 1, s[1], v2, v2, v2); eadd(s[0], s[1] - 1, v2, v2, v2); eadd(s[0], s[1] + 1, v2, v2, v2); }
      }
      // a crescent moon over the left of the roof
      const mx = 38 - 6 * Math.cos(per(1, t - 25)), my = 22 + 3 * Math.cos(per(1, t - 25));
      const a = n;
      ell(mx, my, 6, 6, null, (x, y, u, v) => {
        const u2 = u + 0.55, v2 = v + 0.25;
        if (u2 * u2 + v2 * v2 < 1.0) return;
        const i = y * W + x; if (x < 0 || y < 0 || x >= W || WK.R[i] !== SKY) return;
        eadd(x, y, 230 * a, 222 * a, 190 * a);
      });
      // the distant windows down the side street
      for (const d of DISTWIN) { const k = sstep(d[2] * 0.5 + 0.2, d[2] * 0.5 + 0.4, n); if (k > 0.02) eadd(d[0], d[1], 220 * k, 160 * k, 80 * k); }
    }
    // the chimney's smoke
    for (let k = 0; k < 16; k++) {
      const age = mod(t - k * 2.5, D) ;
      if (age > 7) continue;
      const u = age / 7, x = 195 + u * 16 + Math.sin(age * 1.3 + k) * 1.5, y = 24 - u * 26, r = 1 + u * 2.6;
      const a = (1 - u) * (u < 0.1 ? u / 0.1 : 1) * 0.75;
      CR = EXT; CQ = 2;
      ell(x, y, r, r * 0.8, null, (xx, yy) => { if (yy < 0 || !stip(xx, yy, a)) return; px(xx, yy, K.e4); });
    }
    // birds on the wire between the roofs: gone at sunset, back in the morning
    const wire = (x) => 93 + 6 * ((x - 266) / 36) + 2.5 * Math.sin(Math.PI * (x - 266) / 36);
    CR = EXT; CQ = 2;
    for (let x = 266; x < BLUEX; x++) px(x, fl(wire(x)), K.n2);
    const BIRDS = [[274, 0], [281, 0.35], [292, 0.7]];
    BIRDS.forEach(([bx, dl], k) => {
      let x, y, fly = false, fh = 0;
      const tt = mod(t, D);
      const off = 3.0 + dl, back = 36.2 + dl;
      if (tt >= off && tt < off + 3.2) { const u = (tt - off) / 3.2; x = bx - 120 * u * u - 20 * u; y = wire(bx) - 3 - 70 * u; fly = true; fh = tt; }
      else if (tt >= back && tt < back + 2.2) { const u = 1 - (tt - back) / 2.2; x = bx - 120 * u * u - 20 * u; y = wire(bx) - 3 - 70 * u; fly = true; fh = tt; }
      else if (tt >= off + 3.2 && tt < back) return;
      else { x = bx; y = wire(bx) - 3; }
      x = fl(x); y = fl(y);
      const c = K.n1;
      if (!fly) { px(x, y, c); px(x + 1, y, c); px(x - 1, y + 1, c); px(x, y + 1, c); px(x + 1, y + 1, c); px(x + 2, y - 1, c); px(x, y + 2, K.n3); }
      else {
        const up = (fl(fh * 9 + k) & 1) === 0;
        px(x, y, c); px(x + 1, y, c);
        if (up) { px(x - 1, y - 1, c); px(x - 2, y - 2, c); px(x + 2, y - 1, c); px(x + 3, y - 2, c); }
        else { px(x - 1, y + 1, c); px(x - 2, y + 1, c); px(x + 2, y + 1, c); px(x + 3, y + 1, c); }
      }
    });
  }
  function drawLampsAndGlow(t) {
    // lamp glass: emissive when lit
    const k = LV.street;
    for (const x of POSTS) {
      for (let y = LANT_Y + 3; y < LANT_Y + 12; y++) for (let xx = x - 2; xx <= x + 3; xx++) {
        if (k > 0.05) epx(xx, y, (xx === x || xx === x + 1) && y > LANT_Y + 4 ? K.cw : K.lamp, 0.25 + 0.75 * k);
        else { CR = EXT; px(xx, y, K.e3); }
      }
      CR = EXT; vl(x - 3, LANT_Y + 2, LANT_Y + 11, K.n2); vl(x + 4, LANT_Y + 2, LANT_Y + 11, K.n2);
    }
    // the door lamp, and the far lamp down the side street
    if (k > 0.05) erect(250, 246, 3, 3, K.lamp, 0.3 + 0.7 * k);
    for (const f of FARLAMP) { if (k > 0.05) { epx(f[0], f[1], K.lamp, 0.4 + 0.6 * k); epx(f[0] + 1, f[1], K.lamp, 0.4 + 0.6 * k); } }
    // fairy lights in the attic
    for (const f of FAIRY) {
      const b = 0.55 + 0.45 * Math.sin(per(f[3], t) + f[4]);
      const c = [K.lamp, K.r4, K.cw, K.t4][f[2]];
      epx(f[0], f[1], c, 0.5 + 0.5 * b);
    }
    for (let i = 0; i + 1 < FAIRY.length; i++) { const a = FAIRY[i], b = FAIRY[i + 1]; if (b[0] - a[0] > 12) continue; CR = ATT; line(a[0] + 1, a[1], b[0] - 1, b[1], K.w1); }
    // pendant bulbs
    PEND.forEach((p, i) => { const v = LV.pend[i]; if (v > 0.03) { erect(p[0] - 2, p[1] + 4, 5, 1, K.lamp, 0.4 + 0.6 * v); epx(p[0], p[1] + 5, K.cw, 0.3 + 0.7 * v); } else { CR = INT; hl(p[0] - 2, p[0] + 2, p[1] + 4, K.e3); } });
    // desk lamps
    const dl = (x, y, v) => { if (v > 0.03) { erect(x, y, 4, 1, K.lamp, 0.4 + 0.6 * v); } };
    dl(140, UF_FEET - 20, LV.lampA); dl(169, GF_FEET - 20, LV.lampB); dl(29, UF_FEET - 20, LV.lampW);

  }
  function addPools(t) {
    LP.fill(0);
    const k = LV.street;
    // street lamps on the pavements and road
    if (k > 0.01) for (const x of POSTS) {
      pool(x + 0.5, POST_BASE - 2, 34, 12, 0.85 * k, 0.66 * k, 0.36 * k, M_EXT);
      pool(x + 0.5, 340, 30, 22, 0.45 * k, 0.35 * k, 0.2 * k, M_EXT);
      pool(x + 0.5, LANT_Y + 8, 18, 18, 0.55 * k, 0.42 * k, 0.22 * k, M_EXT);
      halo(x + 0.5, LANT_Y + 7, 11, 70 * k, 52 * k, 26 * k);
    }
    if (k > 0.01) pool(HAM.cx, 372, 40, 16, 0.55 * k, 0.42 * k, 0.24 * k, M_EXT);
    if (k > 0.01) { pool(251, 250, 20, 22, 0.7 * k, 0.52 * k, 0.26 * k, M_EXT); halo(251.5, 247.5, 6, 70 * k, 50 * k, 22 * k); }
    // the studio door open: warm light spills onto the doorstep
    if (LV.door > 0.01) pool(DOOR.cx, 288, 16, 12, 0.5 * LV.door * (0.3 + LV.main), 0.4 * LV.door * (0.3 + LV.main), 0.25 * LV.door * (0.3 + LV.main), M_EXT);
    // the other building: lobby glow on the pavement, more when its door slides open
    pool(BDOOR.cx, 292, 26, 9, 0.12 + 0.2 * LV.bdoor, 0.16 + 0.24 * LV.bdoor, 0.22 + 0.3 * LV.bdoor, M_EXT);
    // pendants inside
    PEND.forEach((p, i) => {
      const v = LV.pend[i] * (1 - LV.dark); if (v < 0.01) return;
      pool(p[0] + 0.5, p[1] + 34, 36, 44, 0.42 * v, 0.34 * v, 0.2 * v, M_INT);
      halo(p[0] + 0.5, p[1] + 4.5, 7, 60 * v, 46 * v, 20 * v);
    });
    // desk lamps at night
    if (LV.lampA > 0.01) { const v = LV.lampA; pool(138, UF_FEET - 14, 24, 16, 0.9 * v, 0.68 * v, 0.34 * v, M_INT); halo(141.5, UF_FEET - 19.5, 5, 60 * v, 44 * v, 18 * v); }
    if (LV.lampB > 0.01) { const v = LV.lampB; pool(160, GF_FEET - 10, 26, 16, 0.9 * v, 0.68 * v, 0.34 * v, M_INT); halo(170.5, GF_FEET - 19.5, 5, 60 * v, 44 * v, 18 * v); }
    if (LV.lampW > 0.01) { const v = LV.lampW; pool(32, UF_FEET - 14, 24, 16, 0.9 * v, 0.68 * v, 0.34 * v, M_INT); halo(30.5, UF_FEET - 19.5, 5, 60 * v, 44 * v, 18 * v); }
    // screens light the faces in front of them (a cool wash, stronger in the dark)
    const nightBoost = 1 - 0.6 * LV.main;
    const sp = (R_, on) => { if (on) pool(R_.x + R_.w / 2, R_.y + R_.h / 2 + 2, 16, 11, 0.12 * nightBoost, 0.22 * nightBoost, 0.3 * nightBoost, M_INT); };
    const on = scrOn(t) > 0.5;
    sp(SCR.w1a, on && !(t > 31.6 && t < 35.7)); sp(SCR.p4, on); sp(SCR.p2, on); sp(SCR.w2, on);
    // the laptop and the terminal glow on whoever holds them
    // attic fairy lights
    for (const f of FAIRY) pool(f[0], f[1] + 3, 10, 8, 0.18, 0.13, 0.08, M_ATT);
  }
  let TERMGLOW = null;
  function pool(cx, cy, rx, ry, cr, cg, cb, mask) {
    const x0 = Math.max(0, Math.ceil(cx - rx)), x1 = Math.min(W - 1, fl(cx + rx)), y0 = Math.max(0, Math.ceil(cy - ry)), y1 = Math.min(H - 1, fl(cy + ry));
    const R = WK.R;
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - cy) / ry, dy2 = dy * dy; if (dy2 >= 1) continue;
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x; if (!(mask & (1 << R[i]))) continue;
        const dx = (x + 0.5 - cx) / rx, d = dx * dx + dy2; if (d >= 1) continue;
        const f = (1 - d) * (1 - d), j = i * 3;
        LP[j] += cr * f; LP[j + 1] += cg * f; LP[j + 2] += cb * f;
      }
    }
  }
  function halo(cx, cy, r, cr, cg, cb) {
    const x0 = Math.max(0, Math.ceil(cx - r)), x1 = Math.min(W - 1, fl(cx + r)), y0 = Math.max(0, Math.ceil(cy - r)), y1 = Math.min(H - 1, fl(cy + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / r, dy = (y + 0.5 - cy) / r, d = dx * dx + dy * dy; if (d >= 1) continue;
      const f = (1 - d) * (1 - d) * (1 - d);
      const j = (y * W + x) * 3;
      LP[j] += 0; WK.E[j] = Math.min(255, WK.E[j] + cr * f); WK.E[j + 1] = Math.min(255, WK.E[j + 1] + cg * f); WK.E[j + 2] = Math.min(255, WK.E[j + 2] + cb * f);
    }
  }
  // the hammock: two ropes and a striped cloth between the posts, unfurling from the middle
  function hamY(x, sag) { const u = (x - HAM.cx) / 20; return 366 + sag * (1 - u * u); }
  function drawHammock(t, front) {
    let s = 0;
    if (t >= 17.8 && t < 18.8) s = s5(ph(t, 17.8, 18.8));
    else if (t >= 18.8 && t < 30.0) s = 1;
    else if (t >= 30.0 && t < 30.8) s = 1 - s5(ph(t, 30.0, 30.8));
    if (s <= 0) return;
    const occupied = t > 19.15 && t < 29.75;
    const sway = occupied ? Math.sin(TAU * 0.25 * t) * 0.8 : 0;
    const sag = 9 + (occupied ? 3 : 0);
    const reach = 20 * s;
    CR = EXT; CQ = 1;
    if (!front) {
      if (s > 0.92) { line(HAM.a + 2, HAM.hook, HAM.cx - 20 + sway, hamY(HAM.cx - 20, sag) - 1, K.e4); line(HAM.b - 1, HAM.hook, HAM.cx + 20 + sway, hamY(HAM.cx + 20, sag) - 1, K.e4); }
      for (let x = Math.ceil(HAM.cx - reach); x <= fl(HAM.cx + reach); x++) {
        const y = fl(hamY(x, sag) + sway * 0.3) - 3;
        px(x + Math.round(sway), y, K.t1); px(x + Math.round(sway), y + 1, K.t1);
      }
      return;
    }
    for (let x = Math.ceil(HAM.cx - reach); x <= fl(HAM.cx + reach); x++) {
      const y = fl(hamY(x, sag) + sway * 0.3);
      const st = fl((x - HAM.cx + 40) / 3) % 3, c = st === 0 ? K.t3 : st === 1 ? K.cw : K.q2;
      const X = x + Math.round(sway);
      px(X, y - 1, sc(c, 1.1)); px(X, y, c); px(X, y + 1, c); px(X, y + 2, sc(c, 0.8));
      if ((x & 1) === 0) px(X, y + 3, K.cw);
    }
  }
  function drawZs(t) {                              // abstract zig-zags rising from the sleeper, not letters
    if (t < 21.6 || t > 30.4) return;
    CQ = 1;
    for (let k = 0; k < 7; k++) {
      const t0 = 21.6 + k * 1.15, age = t - t0;
      if (age < 0 || age > 2.6 || t0 > 28.4) continue;
      const u = age / 2.6, x = HAM.cx - 6 + u * 10 + Math.sin(age * 2.2) * 1.5, y = 360 - u * 22;
      const sz = u < 0.3 ? 0 : u < 0.65 ? 1 : 2;
      const a = (u < 0.15 ? u / 0.15 : 1) * (u > 0.75 ? (1 - u) / 0.25 : 1);
      const pts = sz === 0 ? [[0, 0], [1, 1], [2, 0], [3, 1]] : sz === 1 ? [[0, 0], [1, 1], [2, 2], [3, 1], [4, 0], [5, 1], [6, 2]] : [[0, 0], [1, 1], [2, 2], [3, 3], [4, 2], [5, 1], [6, 0], [7, 1], [8, 2], [9, 3]];
      for (const [dx, dy] of pts) if (stip(fl(x) + dx, fl(y) + dy, a)) { epx(x + dx, y + dy, K.cw, 1); if (sz === 2) epx(x + dx, y + dy + 1, K.cw, 0.55); }
    }
  }
  function drawBubble(t) {                          // a speech bubble with three dots, no words
    if (t < 18.8 || t > 23.6) return;
    const age = t - 18.8;
    const rise = age < 1.0 ? 0 : (age - 1.0) * 5.5;
    const x0 = DOOR.cx - 3 + (age > 1.0 ? (age - 1.0) * 1.2 : 0), y0 = FAR_FEET - 38 - rise;
    const a = clamp(age / 0.3, 0, 1) * (t > 22.6 ? 1 - (t - 22.6) / 1.0 : 1);
    const w = 17, h = 9;
    CQ = 1;
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
      const corner = (x <= 0 || x >= w - 1) && (y <= 0 || y >= h - 1);
      const edge = x === -1 || x === w || y === -1 || y === h || (corner && (x === 0 || x === w - 1) && (y === 0 || y === h - 1));
      if ((x === -1 || x === w) && (y === -1 || y === h)) continue;
      if (!stip(fl(x0) + x, fl(y0) + y, a)) continue;
      epx(x0 + x, y0 + y, edge ? OUTL : K.cw, edge ? 1 : 0.95);
    }
    // tail toward the head
    if (rise < 3) for (const [dx, dy] of [[3, h], [2, h + 1], [4, h], [1, h + 2]]) if (stip(fl(x0) + dx, fl(y0) + dy, a)) epx(x0 + dx, y0 + dy, dy === h ? K.cw : OUTL, 1);
    const dots = [19.15, 19.45, 19.75];
    dots.forEach((td, k) => { if (t < td) return; const dx = 4 + k * 4; for (const [ax, ay] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (stip(fl(x0) + dx + ax, fl(y0) + 4 + ay, a)) epx(x0 + dx + ax, y0 + 4 + ay, K.ink, 1); });
  }
  // steam: soft additive wisps, periodic (each particle loops a whole number of times per loop)
  function wisps(sx, sy, n, period, rise, amp, k0) {
    for (let k = 0; k < n; k++) {
      const age = mod(TT + k * period / n, period), u = age / period;
      const a = amp * (1 - u) * Math.min(1, u * 6);
      if (a <= 0.02) continue;
      const x = sx + Math.sin(u * 5.5 + k * 2.1 + k0) * (0.6 + 1.8 * u) + u * 2, y = sy - u * rise;
      const v = 95 * a;
      eadd(x, y, v, v, v * 0.95);
      if (u > 0.35) eadd(x + 1, y, v * 0.6, v * 0.6, v * 0.58);
      if (u > 0.6) eadd(x, y - 1, v * 0.45, v * 0.45, v * 0.43);
    }
  }
  let TT = 0;
  function drawSteam(t) {
    TT = t;
    const pour = Math.max(bump(t, 38.4, 38.9, 41, 42), bump(t + D, 38.4, 38.9, 41.2, 41.9));
    const idle = bump(t, 1.5, 2.5, 25.5, 27.0) * 0.35 + bump(t, 34.8, 36.0, 39, 41) * 0.35;
    const m = Math.max(pour, idle);
    if (m > 0.02) { wisps(40, 236, 14, 2.0, 18, m, 0); wisps(32.5, 242, 8, 2.5, 12, pour * 0.8, 3); }
    // the mug she carries, then the one on her desk
    const w2 = POSES.w2;
    if (w2.prop === 'mug' && w2.layer === 'int') wisps(w2.x + (w2.face === 'L' ? -5 : 4), w2.y - 13, 6, 2.0, 9, 0.55, 5);
    if (t >= 5.9 && t < 17) wisps(107, GF_FEET - 15, 6, 2.5, 9, 0.5 * (1 - sstep(13, 17, t)), 7);
  }
  function drawBlanket(S) {
    CR = INT; CQ = 2;
    for (let y = S.y - 4; y <= S.y + 1; y++) for (let x = 60; x <= 88; x++) {
      if (y === S.y - 4 && (x < 62 || x > 86)) continue;
      px(x, y, (((x >> 2) + (y >> 1)) & 1) ? K.m2 : K.t4);
    }
    hl(61, 87, S.y - 4, K.cw);
  }

  /* ================================================================ the frame */
  const POSES = { p1: pose(), p2: pose(), p3: pose(), p4: pose(), w1: pose(), w2: pose(), w3: pose() };
  const CATP = { x: 0, y: 0, mode: 'sit', face: 'R', wph: 0 };
  let TRK = null, PROF = null;
  function trk(name, fn) { if (!TRK) { fn(); return; } const n0 = PXN; fn(); if (PXN > n0) TRK[name] = (TRK[name] || 0) + PXN - n0; }
  function visOf(layer) {
    if (layer === 'seat' || layer === 'int' || layer === 'couch') return LV.intVis > 0.06 ? 1 : LV.intVis / 0.06;
    if (layer === 'blue') return LV.blue;
    if (layer === 'bdoor') return LV.bdoor;
    return 1;
  }
  function placePerson(name, S) {
    if (!S.vis) return;
    drawPerson(P[name], S);
    if (S.clip) clip(S.clip[0], S.clip[1], S.clip[2], S.clip[3]);
    if (S.layer === 'door' && !S.clip && S.y < PL0) clip(DOOR.x0, 0, DOOR.x1, H);
    if (S.layer === 'bdoor') clip(BDOOR.x0, 0, BDOOR.x1, BDOOR.y1);
    if (S.layer === 'blue') clip(BWIN.x0, BWIN.y0, BWIN.x1, BWIN.y1);
    const reg = S.layer === 'blue' ? BLU : (S.layer === 'ext' || S.layer === 'door' || S.layer === 'bdoor' || S.layer === 'ham') ? CHX : INT;
    trk('person:' + name, () => lblit(S.x, S.y, reg, TRK ? visOf(S.layer) : undefined));
    clipAll();
  }
  // name tags: a small dark label over each of the four, following them wherever they are visible
  const NAMES = { p1: 'Cat', p2: 'Anthony', p3: 'Thariq', p4: 'Austin' };
  function drawTags() {
    T = WK; clipAll();
    for (const n of ['p1', 'p2', 'p3', 'p4']) {
      const S = POSES[n];
      if (!S.vis) continue;
      // the label fades with the light of the room they are in, and slides off the frame with them
      const a = clamp(visOf(S.layer), 0, 1) * clamp((W + 2 - S.x) / 24, 0, 1) * clamp((S.x + 2) / 24, 0, 1);
      if (a < 0.02) continue;
      const str = NAMES[n], w = textW(str, 1) + 4, h = 11;
      const lift = S.lie ? 14 : S.mode === 'sit' || S.mode === 'sitlow' ? 27 : 31;
      let y0 = Math.round(S.y - lift - h + S.dy);
      if (S.layer === 'blue') y0 = Math.max(y0, BWIN.y0 - h - 2);
      const x0 = Math.round(S.x - w / 2); y0 = Math.max(1, y0);
      const dark = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const j = (y * W + x) * 3; for (let c = 0; c < 3; c++) { WK.A[j + c] *= 1 - 0.9 * a; WK.E[j + c] *= 1 - 0.9 * a; } };
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { if ((y === y0 || y === y0 + h - 1) && (x === x0 || x === x0 + w - 1)) continue; dark(x, y); }
      dark(Math.round(S.x), y0 + h); dark(Math.round(S.x), y0 + h + 1);
      const edge = P[n].top;
      for (let x = x0 + 1; x < x0 + w - 1; x++) eadd(x, y0 + h, edge[0] * 0.8 * a, edge[1] * 0.8 * a, edge[2] * 0.8 * a);
      let cx = x0 + 2;
      for (const ch of str) {
        const g = GLY[ch];
        if (g) g.forEach((row, ry) => { for (let rx = 0; rx < 5; rx++) if (row[rx] === '#') eadd(cx + rx, y0 + 1 + ry, K.cw[0] * a, K.cw[1] * a, K.cw[2] * a); });
        cx += 6;
      }
    }
  }
  function render(t) {
    t = mod(t, D);
    if (TRK) for (const k in TRK) TRK[k] = 0;
    setTime(t);
    WK.A.set(BG.A); WK.E.set(BG.E); WK.R.set(BG.R); WK.Q.set(BG.Q);
    T = WK; clipAll(); CQ = 2;
    for (const n in POSES) { const S = POSES[n]; Object.assign(S, pose()); }
    p1Pose(t, POSES.p1); p2Pose(t, POSES.p2); p3Pose(t, POSES.p3); p4Pose(t, POSES.p4);
    w1Pose(t, POSES.w1); w2Pose(t, POSES.w2); w3Pose(t, POSES.w3);
    catPose(t, CATP);
    trk('sky', () => drawSky(t));
    drawScreens(t);
    trk('desk', () => drawDeskThings(t));
    // chairs, then whoever is sitting
    CR = INT; CQ = 2;
    const cs = (tv, tback) => (t >= tback || t < tv) ? [0, 0] : chairSpin(t, tv);
    const tp1 = t >= SWAP ? t - D : t;
    { const s = tp1 >= -2.9 ? chairSpin(tp1, -2.9) : [0, 0]; chair(SEATS.p1.x, GF_FEET, s[0], s[1], K.t2); }
    { const s = cs(5.6, SWAP); chair(SEATS.p3.x, GF_FEET, s[0], s[1], K.q1); }
    { const s = cs(10.6, SWAP); chair(SEATS.p2.x, UF_FEET, s[0], s[1], K.p1); }
    { const s = cs(17.0, SWAP); chair(SEATS.p4.x, UF_FEET, s[0], s[1], K.m0); }
    { const s = (t >= 26 || t < 4.4) ? chairSpin(t >= 26 ? t : t + D, 26.0) : [0, 0]; chair(SEATS.w2.x, GF_FEET, s[0], s[1], K.r1); }
    chair(SEATS.w1.x, UF_FEET, 0, 0, K.n4);
    // the blue window's chair
    T = WK; CR = BLU; clip(BWIN.x0, BWIN.y0, BWIN.x1, BWIN.y1); chair(336, BWIN.y1, Math.PI, 0, K.b1); clipAll();
    for (const n of ['w1', 'p4', 'p2', 'w2', 'p3', 'p1']) if (POSES[n].layer === 'seat') placePerson(n, POSES[n]);
    blitOverlay(OV1);
    // the couch sleeper and her blanket
    if (POSES.w2.layer === 'couch') { placePerson('w2', POSES.w2); drawBlanket(POSES.w2); }
    trk('steam', () => drawSteam(t));
    // the cat
    trk('cat', () => { drawCat(CATP, t); lblit(CATP.x, CATP.y, INT, TRK ? visOf('int') : undefined); });
    for (const n of ['w3', 'w2', 'p4', 'p2', 'p3', 'p1']) if (POSES[n].layer === 'int') placePerson(n, POSES[n]);
    blitOverlay(OV2);
    drawDoorBacks(t);
    for (const n of ['p1', 'p4']) if (POSES[n].layer === 'bdoor') placePerson(n, POSES[n]);
    drawDoors(t);
    for (const n of ['p1', 'p4']) if (POSES[n].layer === 'blue') placePerson(n, POSES[n]);
    // re-cover the sliding door's frame over anyone walking in
    // outdoors
    trk('hammock', () => drawHammock(t, false));
    for (const n of ['p1', 'p2', 'p3', 'p4']) if (POSES[n].layer === 'ham') placePerson(n, POSES[n]);
    trk('hammock', () => drawHammock(t, true));
    for (const n of ['p2', 'p1', 'p3', 'p4']) if (POSES[n].layer === 'door' || POSES[n].layer === 'ext') placePerson(n, POSES[n]);
    if ((t >= 17.8 && t < 19.15) || (t > 29.75 && t < 30.8)) trk('hammock', () => drawHammock(t, true));   // unfurling from the hands
    trk('zs', () => drawZs(t));
    trk('bubble', () => drawBubble(t));
    drawTags();
    drawLampsAndGlow(t);
    addPools(t);
    quantise();
  }

  /* ================================================================ light and quantise */
  function quantise() {
    const DA = [0, 1.4, 4.0, 4.4], KQ = 63 / Math.sqrt(255);
    const A = WK.A, E = WK.E, R = WK.R, Q = WK.Q;
    const a1 = AMB[EXT], a2 = AMB[INT], a4 = AMB[ATT], a5 = AMB[BLU], a7 = AMB[GLS], a8 = AMB[CHX];
    for (let y = 0, i = 0; y < H; y++) {
      const by = (y & 3) << 2, yj = y * 3;
      const s0 = SKYROW[yj], s1 = SKYROW[yj + 1], s2 = SKYROW[yj + 2];
      const w0 = WINROW[yj], w1 = WINROW[yj + 1], w2 = WINROW[yj + 2];
      const g0 = GLSROW[yj], g1 = GLSROW[yj + 1], g2 = GLSROW[yj + 2];
      for (let x = 0; x < W; x++, i++) {
        const j = i * 3, reg = R[i];
        let r, g, b;
        if (reg === SKY) { r = s0 + E[j]; g = s1 + E[j + 1]; b = s2 + E[j + 2]; }
        else if (reg === EMI) { r = E[j]; g = E[j + 1]; b = E[j + 2]; }
        else if (reg === WIN) { r = w0 + E[j]; g = w1 + E[j + 1]; b = w2 + E[j + 2]; }
        else {
          const a = reg === EXT ? a1 : reg === INT ? a2 : reg === ATT ? a4 : reg === BLU ? a5 : reg === CHX ? a8 : a7;
          r = A[j] * (a[0] + LP[j]) + E[j]; g = A[j + 1] * (a[1] + LP[j + 1]) + E[j + 1]; b = A[j + 2] * (a[2] + LP[j + 2]) + E[j + 2];
          if (reg === GLS) { r += g0; g += g1; b += g2; }
        }
        const d = BAY[by | (x & 3)] * DA[Q[i]];
        r = r <= 0 ? 0 : r >= 255 ? 63 : Math.sqrt(r) * KQ; g = g <= 0 ? 0 : g >= 255 ? 63 : Math.sqrt(g) * KQ; b = b <= 0 ? 0 : b >= 255 ? 63 : Math.sqrt(b) * KQ;
        let qr = (r + d + 0.5) | 0, qg = (g + d + 0.5) | 0, qb = (b + d + 0.5) | 0;
        qr = qr < 0 ? 0 : qr > 63 ? 63 : qr; qg = qg < 0 ? 0 : qg > 63 ? 63 : qg; qb = qb < 0 ? 0 : qb > 63 ? 63 : qb;
        OUT[i] = LUT[(qr << 12) | (qg << 6) | qb];
      }
    }
  }

  let BUILT = false;
  function build() {
    if (BUILT) return;
    buildLUT();
    paintAll();
    buildBoard();
    BUILT = true;
  }
  const core = { W, H, D, PAL, OUT, build, render, get SWAP() { return SWAP; }, setSwap(v) { SWAP = v; }, LV, POSES,
    prof(on) { PROF = on ? {} : null; return PROF; }, track(on) { TRK = on ? {} : null; return TRK; }, get TRK() { return TRK; } };
  window.__studioCore = core;
  if (typeof document === 'undefined') return;

  /* ================================================================ present */
  let SMALL = null, SG = null, IMG = null, PIX = null;
  const LE = new Uint8Array(new Uint32Array([0x01020304]).buffer)[0] === 4;
  const PACK = new Uint32Array(NPAL);
  function present(g, k) {
    if (!SMALL) {
      SMALL = document.createElement('canvas'); SMALL.width = W; SMALL.height = H;
      SG = SMALL.getContext('2d'); IMG = SG.createImageData(W, H); PIX = new Uint32Array(IMG.data.buffer);
      for (let n = 0; n < NPAL; n++) { const p = PAL[n]; PACK[n] = (LE ? ((255 << 24) | (p[2] << 16) | (p[1] << 8) | p[0]) : ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | 255)) >>> 0; }
    }
    for (let i = 0; i < NP; i++) PIX[i] = PACK[OUT[i]];
    SG.putImageData(IMG, 0, 0);
    if (!g) return;
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(SMALL, 0, 0, W * k, H * k);
  }
  function pixelsB64() {
    const buf = new Uint8Array(NP * 3);
    for (let i = 0; i < NP; i++) { const p = PAL[OUT[i]]; buf[i * 3] = p[0]; buf[i * 3 + 1] = p[1]; buf[i * 3 + 2] = p[2]; }
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  }

  /* ================================================================ mount */
  const ROOM = '#141019';
  (window.PIECES = window.PIECES || []).push({
    id: 'the-little-studio',
    title: 'The Little Studio',
    medium: 'Pixel art in 66 colours, 360 × 450, drawn in JavaScript · 40 s loop',
    note: 'Four people leave a little studio, fondly · tap to pause',
    about: 'A terracotta studio on a street corner, opened like a doll’s house, from the late gold of one day to the next. One by one four people leave, each carrying what they made there: one crosses to the blue building across the street with a little glowing terminal and waves back; one slings a hammock between two lampposts and sleeps under the stars; one stops on the doorstep with a framed app window, thinks, and wanders off down the road; one carries a potted chart over to the blue building too, and is waved in from a window. Inside, the coffee steams, the chairs swivel to rest, the cat curls up in one, a seedling is set where the chart stood, and in the small hours the lights go out and come up on a new morning.',
    tone: 'dark',
    room: ROOM,
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      SEED = 7;
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0, built = false;
      el.style.background = ROOM;
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;image-rendering:pixelated;image-rendering:crisp-edges;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(255,242,216,.85)"/><rect x="19" y="9" width="5" height="16" fill="rgba(255,242,216,.85)"/></svg>';
      el.appendChild(pauseMark);
      let K3 = 3;
      function fit() {
        const dpr = Math.min(3, window.devicePixelRatio || 1);
        let left = 0, top = 0, cssW, cssH;
        if (EXPORT) { cssW = 1080; cssH = 1350; cv.style.position = 'fixed'; K3 = 3; }
        else {
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          const f = Math.min(w * dpr / W, h * dpr / H) * 0.97;
          const k = Math.max(1, Math.floor(f));
          if (k < f * 0.88) { K3 = Math.max(1, Math.ceil(f)); cssW = W * f / dpr; cssH = H * f / dpr; }
          else { K3 = k; cssW = W * k / dpr; cssH = H * k / dpr; }
          left = Math.round((w - cssW) / 2); top = Math.round((h - cssH) / 2);
        }
        if (cv.width !== W * K3 || cv.height !== H * K3) { cv.width = W * K3; cv.height = H * K3; }
        cv.style.left = left + 'px'; cv.style.top = top + 'px'; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
        pauseMark.style.left = (left + cssW - 48) + 'px'; pauseMark.style.top = (top + 14) + 'px';
      }
      const draw = (t) => { render(t); present(g, K3); };
      fit();
      build();
      built = true;
      draw(0);
      if (EXPORT) {
        const faded = () => { const st = el.parentElement; return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999; };
        window.__studio = {
          duration: D,
          isReady: () => built && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); draw(t); window.__studio.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          pixels: pixelsB64,
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'the-little-studio';
        api.ready();
      } else {
        window.__studio = { duration: D, isReady: () => built, lastMs: 0, renderAt(t) { return new Promise((res) => { playing = false; clock = t; const t0 = performance.now(); draw(t); window.__studio.lastMs = performance.now() - t0; requestAnimationFrame(() => res()); }); } };
        api.ready();
      }
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        raf = requestAnimationFrame(frame);
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
        if (!playing) return;
        clock = (clock + dt) % D;
        const t0 = performance.now();
        draw(clock);
        if (window.__studio) window.__studio.lastMs = performance.now() - t0;
      }
      if (!EXPORT) raf = requestAnimationFrame(frame);
      const onDown = () => { if (EXPORT) return; playing = !playing; last = 0; pauseMark.style.opacity = playing ? '0' : '1'; };
      cv.addEventListener('pointerdown', onDown);
      let rt = 0;
      const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (!alive) return; fit(); draw(clock); }, 120); });
      ro.observe(el);
      return {
        destroy() {
          alive = false; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(rt);
          cv.removeEventListener('pointerdown', onDown);
          if (window.__studio) delete window.__studio;
        },
      };
    },
  });
})();
