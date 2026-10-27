/* The Glasshouse — Quiet Hours, piece 4.
 *
 * A 24-second seamless loop inside a Victorian glasshouse during soft rain. We look out through a wall
 * of arched panes in cream-painted ironwork; the garden beyond is grey, misted and softened by the wet
 * glass. Every frame is a pure function of t. The outside view, the ironwork and the whole planted
 * interior are painted once at mount into a 360 × 450 buffer in two lighting states (grey rain light and
 * low gold light); each frame mixes the two by a cosine of t, then draws the live things: hundreds of
 * raindrops that land, grow, cling and slide down in wiggly streaks (each one a tiny inverted lens on
 * the garden behind it), sliders wiping clean channels through the beaded glass, condensation on the
 * lower panes, trailing vines, tree-fern croziers that open in the warm light, a dripping spout, and
 * dust in the sunbeams. Every drop has one seeded event per loop, so t = D is t = 0. The result is
 * quantised with a 4 × 4 Bayer dither to a 48-colour palette and scaled up 3× nearest-neighbour.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 360, H = 450, NP = W * H, D = 24;
  const TAU = Math.PI * 2;
  const fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
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
  function vn2(x, y, s) {
    const xi = fl(x), yi = fl(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return lerp(lerp(ih(xi, yi, s), ih(xi + 1, yi, s), u), lerp(ih(xi, yi + 1, s), ih(xi + 1, yi + 1, s), u), v);
  }
  function fbm(x, y, s, o) {
    let a = 0, amp = 0.5, n = 0;
    for (let k = 0; k < (o || 4); k++) { a += amp * vn2(x, y, s + k * 31); n += amp; x = x * 2.03 + 5.1; y = y * 2.03 + 1.7; amp *= 0.5; }
    return a / n;
  }
  const hx = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];

  /* ================================================================ palette (48) */
  const PAL_HEX = [
    '121816', '7f8e9b',                                                                  // 0 deep shadow, 1 rain sky (mid)
    '15291c', '1f3a25', '2a4b2c', '365e34', '467340', '5a8a4a', '74a055', '94b964', 'b9d27f', // 2-10 greens
    '4e6358', '6c8172', '8fa392', 'b4c2b0',                                              // 11-14 sage
    'f3eddc', 'dcd5c0', 'bdb7a2', '99947f', '6f6c5f',                                    // 15-19 cream iron
    '4d2719', '723a24', '9b5030', 'bf6c42', 'd88f62', 'ebb48f',                          // 20-25 terracotta
    '2c3541', '3f4a58', '566473', '718091', '8f9daa', 'afbac2', 'cdd4d7', 'e6eae9',      // 26-33 rain sky
    '7a6440', 'a8894f', 'cfac62', 'e9c87e', 'f7e2a8', 'fff4d6',                          // 34-39 gold
    '2e241b', '45372a', '63503b', '86704f',                                              // 40-43 bark / soil
    'b65f72', 'dc9aa6', 'f4dde0',                                                        // 44-46 orchid
    '9fabb5',                                                                            // 47 rain sky (pale)
  ];
  const PAL = PAL_HEX.map(hx);
  const LUT = new Uint8Array(32768), LUTO = new Uint8Array(32768);
  // the garden behind the glass is quantised to a cooler sub-palette: no bark, brick or orchid
  const OUTSET = [0, 1, 47, 2, 3, 4, 11, 12, 13, 14, 15, 16, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39];
  function nearest(r, g, b, set) {
    let best = 0, bd = 1e18;
    const pinkOK = r - g > 18 && b >= g - 6;
    const n = set ? set.length : PAL.length;
    for (let q = 0; q < n; q++) {
      const k = set ? set[q] : q;
      if (k >= 44 && k <= 46 && !pinkOK) continue;
      const p = PAL[k], dr = r - p[0], dg = g - p[1], db = b - p[2];
      const rm = (r + p[0]) * 0.5;
      const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  function buildLUT() {
    for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 32; b++)
    { LUT[(r << 10) | (g << 5) | b] = nearest(r * 8 + 4, g * 8 + 4, b * 8 + 4); LUTO[(r << 10) | (g << 5) | b] = nearest(r * 8 + 4, g * 8 + 4, b * 8 + 4, OUTSET); }
  }
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bay = (x, y) => BAY[((y & 3) << 2) | (x & 3)];
  const P = (k) => PAL[k];

  /* ================================================================ buffers */
  const O0 = new Float32Array(NP * 3), O1 = new Float32Array(NP * 3);   // the garden outside, grey / gold, softened by wet glass
  const Q0 = new Float32Array(NP * 3), Q1 = new Float32Array(NP * 3);   // the same, sharp, as a drop lens sees it
  const S0 = new Float32Array(NP * 3), S1 = new Float32Array(NP * 3);   // everything static inside, grey / gold
  const SZ = new Int8Array(NP);                                         // static depth, 0 = bare glass
  const GLM = new Uint8Array(NP);                                       // glass openings in the iron wall
  const FOG = new Float32Array(NP);                                     // condensation density
  const AMBF = new Float32Array(NP);                                    // interior ambient light
  const SH = new Float32Array(NP);                                      // sunbeam field
  const C = new Float32Array(NP * 3);                                   // frame colour
  const Z = new Int8Array(NP);                                          // frame depth
  const PASS = new Float32Array(NP);                                    // seconds since a slider last wiped this pixel
  let GLIST = null;                                                     // indices of visible glass
  const MIST = new Float32Array((W + 32) * H);                          // a drifting bank of mist in the garden
  let WL = 0;                                                           // light mix of the current frame

  // light over the loop: grey rain (0) → gold (1) → grey
  const lightAt = (t) => { const c = 0.5 - 0.5 * Math.cos(TAU * t / D); return c * c * (3 - 2 * c); };
  const rainAt = (t) => 1 - 0.9 * lightAt(t);

  /* ================================================================ pixel writers */
  let MODE = 0; // 0 static, 1 frame
  const L0 = [0, 0, 0], L1 = [0, 0, 0];
  function put(x, y, z) {
    x = fl(x); y = fl(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x, j = i * 3;
    if (MODE === 0) {
      if (z < SZ[i]) return;
      SZ[i] = z;
      S0[j] = L0[0]; S0[j + 1] = L0[1]; S0[j + 2] = L0[2];
      S1[j] = L1[0]; S1[j + 1] = L1[1]; S1[j + 2] = L1[2];
    } else {
      if (z < Z[i]) return;
      Z[i] = z;
      C[j] = L0[0] + (L1[0] - L0[0]) * WL; C[j + 1] = L0[1] + (L1[1] - L0[1]) * WL; C[j + 2] = L0[2] + (L1[2] - L0[2]) * WL;
    }
  }
  // interior lighting: ambient (cool → warm), sunbeams on surfaces, backlight through thin leaves
  let AMBO = 0; // fixed ambient for things standing out in front
  function lit(c, x, y, trans, sunk) {
    const xi = clamp(fl(x), 0, W - 1), yi = clamp(fl(y), 0, H - 1), i = yi * W + xi;
    const a = AMBO || AMBF[i], s = SH[i] * (sunk || 0);
    const r = c[0], g = c[1], b = c[2];
    L0[0] = r * a * 0.97; L0[1] = g * a * 0.99; L0[2] = b * a * 1.04;
    L1[0] = r * a * 1.08 + s * 74; L1[1] = g * a * 1.0 + s * 56; L1[2] = b * a * 0.82 + s * 16;
    if (trans) {
      const tr = trans * (0.55 + 0.45 * a);
      L0[0] += tr * (r * 0.06 + 3); L0[1] += tr * (g * 0.09 + 6); L0[2] += tr * (b * 0.05 + 3);
      L1[0] += tr * (r * 0.42 + 44); L1[1] += tr * (g * 0.4 + 34); L1[2] += tr * (b * 0.04);
    }
  }
  function litMix(c, d, u, x, y, trans, sunk) {
    lit([lerp(c[0], d[0], u), lerp(c[1], d[1], u), lerp(c[2], d[2], u)], x, y, trans, sunk);
  }
  // raw two-state colour
  function raw(c0, c1) { L0[0] = c0[0]; L0[1] = c0[1]; L0[2] = c0[2]; L1[0] = c1[0]; L1[1] = c1[1]; L1[2] = c1[2]; }

  /* ================================================================ shape stamping (for outlines) */
  const TM = new Int32Array(NP), TS = new Float32Array(NP), TV = new Float32Array(NP);
  let STAMP = 0, bx0 = 0, by0 = 0, bx1 = 0, by1 = 0;
  function mapBegin() { STAMP++; bx0 = W; by0 = H; bx1 = -1; by1 = -1; }
  function mark(x, y, s, v) {
    x = fl(x); y = fl(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    TM[i] = STAMP; TS[i] = s; TV[i] = v;
    if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
  }
  const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H && TM[y * W + x] === STAMP;
  function mapEnd(fn) {
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const i = y * W + x;
      if (TM[i] !== STAMP) continue;
      const e = (inMap(x, y - 1) ? 0 : 1) | (inMap(x, y + 1) ? 0 : 2) | (inMap(x - 1, y) ? 0 : 4) | (inMap(x + 1, y) ? 0 : 8);
      fn(x, y, TS[i], TV[i], e);
    }
  }

  /* ================================================================ curves */
  let BX = 0, BY = 0, TX = 0, TY = 0;
  function cub(p, s) {
    const m = 1 - s, a = m * m * m, b = 3 * m * m * s, c = 3 * m * s * s, d = s * s * s;
    BX = a * p[0] + b * p[2] + c * p[4] + d * p[6];
    BY = a * p[1] + b * p[3] + c * p[5] + d * p[7];
    const da = -3 * m * m, db = 3 * m * m - 6 * m * s, dc = 6 * m * s - 3 * s * s, dd = 3 * s * s;
    TX = da * p[0] + db * p[2] + dc * p[4] + dd * p[6];
    TY = da * p[1] + db * p[3] + dc * p[5] + dd * p[7];
    const l = Math.hypot(TX, TY) || 1; TX /= l; TY /= l;
  }
  function cubLen(p) {
    let L = 0, px = p[0], py = p[1];
    for (let k = 1; k <= 24; k++) { cub(p, k / 24); L += Math.hypot(BX - px, BY - py); px = BX; py = BY; }
    return L;
  }
  // mark a leaf-like shape along a cubic midrib; hw(s) is the half width; hole(s,v,hw,len) cuts it
  function leafShape(p, hw, hole, dens) {
    const len = cubLen(p), ns = Math.ceil(len * (dens || 2.4));
    for (let k = 0; k <= ns; k++) {
      const s = k / ns;
      cub(p, s);
      const h = hw(s, len);
      if (h <= 0) { mark(BX, BY, s, 0); continue; }
      const nx = -TY, ny = TX, nv = Math.max(1, Math.ceil(h * 2.4));
      const cx = BX, cy = BY;
      for (let j = -nv; j <= nv; j++) {
        const v = j / nv;
        if (hole && hole(s, v, h, len)) continue;
        mark(cx + nx * v * h, cy + ny * v * h, s, v);
      }
    }
  }
  // a stroke of varying radius along a cubic
  function tube(p, r0, r1, fn, z) {
    mapBegin();
    leafShape(p, (s) => lerp(r0, r1, s), null, 2.6);
    mapEnd((x, y, s, v, e) => fn(x, y, s, v, e));
  }

  /* ================================================================ fields: ambient + sunbeams */
  function buildFields() {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let a = 1.02 - 0.16 * sstep(120, 330, y);
      if (y > 336 && x > 92) a *= 0.5 + 0.12 * sstep(392, 440, y);          // under the bench
      if (y > 392) a = Math.min(a, 0.74 + 0.08 * (1 - Math.abs(x - 180) / 180));
      const ex = Math.abs(x - 180) / 180; a *= 1 - 0.14 * ex * ex * ex;
      AMBF[i] = a;
      // sunbeams fall from the upper right, through the panes, down to the left
      const c = x + 0.5 * y;
      let s = 0;
      const beams = [[214, 16], [262, 11], [318, 20], [372, 13], [420, 17], [470, 9]];
      for (const b of beams) { const d = (c - b[0]) / b[1]; s += Math.exp(-d * d * 1.6); }
      s *= 0.45 + 0.55 * fbm(c / 18, y / 60, 91, 2);
      s *= sstep(10, 90, y) * (1 - 0.6 * sstep(330, 450, y));
      SH[i] = clamp(s, 0, 1);
    }
  }

  /* ================================================================ the garden outside */
  const HOR = 204;
  function cedar(x, y) { // a cedar of Lebanon: flat dark tiers; returns 0..1 coverage
    const tiers = [[72, 122, 30, 5], [64, 136, 46, 6], [82, 151, 58, 7], [70, 167, 70, 8], [86, 184, 78, 9]];
    let m = 0;
    for (const t of tiers) {
      const dx = (x - t[0]) / t[2], dy = (y - t[1]) / t[3];
      const edge = 0.62 + 0.7 * fbm(x / 7, y / 3.5, 40, 3) * (1 - 0.3 * Math.abs(dx));
      const q = dx * dx + dy * dy * (dy < 0 ? 1.6 : 0.9);
      if (q < edge) m = 1;
    }
    if (Math.abs(x - 74 - (y - 120) * 0.05) < 2.2 && y > 118 && y < HOR + 4) m = 1;
    return m;
  }
  function outsideColor(x, y, o0, o1) {
    const u = clamp(y / HOR, 0, 1);
    // sky
    const cl = fbm(x / 80, y / 22, 11, 4), cl2 = fbm(x / 34 + 3, y / 12, 12, 3);
    let r0 = lerp(78, 176, Math.pow(u, 0.85)), g0 = lerp(90, 184, Math.pow(u, 0.85)), b0 = lerp(106, 190, Math.pow(u, 0.85));
    const cv = (cl - 0.5) * 34 + (cl2 - 0.5) * 12;
    r0 += cv; g0 += cv; b0 += cv * 0.9;
    let r1 = lerp(112, 238, Math.pow(u, 0.9)), g1 = lerp(110, 214, Math.pow(u, 0.9)), b1 = lerp(114, 166, Math.pow(u, 0.9));
    const sx = x - 266, sy = y - 104, sd = sx * sx + sy * sy;
    const glow = Math.exp(-sd / (2 * 74 * 74)), core = Math.exp(-sd / (2 * 15 * 15));
    r1 += glow * 52 + core * 28 + cv * 0.9; g1 += glow * 40 + core * 28 + cv * 0.8; b1 += glow * 10 + core * 22 + cv * 0.5;
    // cloud edges catch the sun
    const rimc = clamp((cl - 0.55) * 4, 0, 1) * glow;
    r1 += rimc * 22; g1 += rimc * 16;
    let m = 0, tr0 = 0, tg0 = 0, tb0 = 0, tr1 = 0, tg1 = 0, tb1 = 0, mist = 0;
    const layer = (cov, c0, c1, mi) => { if (cov > 0) { m = 1; tr0 = c0[0]; tg0 = c0[1]; tb0 = c0[2]; tr1 = c1[0]; tg1 = c1[1]; tb1 = c1[2]; mist = mi; } };
    // distant hills and a far tree line
    const fh = HOR - 10 - 9 * fbm(x / 26, 0.5, 20, 3) - 4 * Math.sin(x / 47);
    layer(y > fh ? 1 : 0, [140, 150, 154], [196, 180, 146], 0.55);
    // a far palm house dome
    { const dx = x - 196, dy = y - (HOR - 6); if (dy < 0 && dx * dx / (22 * 22) + dy * dy / (17 * 17) < 1) layer(1, [150, 158, 160], [204, 188, 152], 0.5);
      if (Math.abs(dx) < 1 && y > HOR - 30 && y < HOR - 22) layer(1, [150, 158, 160], [204, 188, 152], 0.5); }
    // mid trees: a round oak and a clump of elms
    { const ok = (x, y, cx, cy, r, s) => { const d = Math.hypot((x - cx) * 0.9, y - cy) / r; return d < 0.78 + 0.32 * fbm(x / 6, y / 6, s, 3) ? 1 : 0; };
      if (ok(x, y, 236, 172, 30, 51) || ok(x, y, 262, 182, 22, 52) || ok(x, y, 140, 186, 22, 53) || ok(x, y, 116, 192, 16, 54)) layer(1, [104, 118, 114], [150, 140, 104], 0.36);
      if (Math.abs(x - 236) < 2 && y > 186) layer(1, [94, 102, 100], [140, 126, 96], 0.36); }
    // lombardy poplars on the right
    { const pop = (cx, top, hw) => { if (y < top) return 0; const q = (y - top) / (HOR + 6 - top); const w = hw * Math.pow(Math.sin(Math.PI * Math.min(1, q * 0.9 + 0.08)), 0.7); return Math.abs(x - cx) < w + (fbm(x / 3, y / 4, 60, 2) - 0.5) * 3 ? 1 : 0; };
      if (pop(316, 80, 10) || pop(338, 96, 9) || pop(300, 118, 7)) layer(1, [84, 98, 96], [128, 120, 88], 0.26); }
    // a great copper beech and a pair of dark yews, the nearest trees
    { const blob = (cx, cy, r, sd) => { const d = Math.hypot((x - cx) * 0.85, (y - cy) * 1.05) / r; return d < 0.7 + 0.42 * fbm(x / 7, y / 6, sd, 3); };
      if (blob(70, 150, 34, 41) || blob(40, 168, 28, 42) || blob(104, 166, 30, 43) || blob(76, 122, 22, 44) || blob(20, 186, 22, 45)) layer(1, [60, 72, 70], [104, 96, 74], 0.14);
      if (Math.abs(x - 72 - Math.sin(y / 9) * 1.5) < 3 && y > 170) layer(1, [52, 60, 60], [90, 80, 64], 0.14);
      const yew = (cx, top, hw) => { if (y < top) return 0; const q = (y - top) / (HOR + 4 - top); return Math.abs(x - cx) < hw * Math.pow(Math.min(1, q * 1.6), 0.6) + (fbm(x / 3, y / 3, 46, 2) - 0.5) * 3; };
      if (yew(150, 150, 9) || yew(166, 160, 7)) layer(1, [50, 64, 62], [92, 88, 68], 0.12); }
    // the garden: lawn, a gravel path, a hedge, a stone urn
    if (y >= HOR) {
      const lg = fbm(x / 30, y / 6, 70, 3);
      let lr0 = 112 + lg * 14, lg0 = 126 + lg * 14, lb0 = 112 + lg * 10;
      let lr1 = 158 + lg * 16, lg1 = 150 + lg * 14, lb1 = 102 + lg * 8;
      const pathc = 180 + (y - HOR) * 0.9, pw = 3 + (y - HOR) * 0.55;
      if (Math.abs(x - pathc) < pw) { lr0 = 150; lg0 = 152; lb0 = 146; lr1 = 206; lg1 = 188; lb1 = 150; }
      layer(1, [lr0, lg0, lb0], [lr1, lg1, lb1], 0.24);
      if (y < HOR + 8 && (x < 150 || x > 210)) layer(1, [72, 88, 82], [116, 110, 80], 0.2);
    }
    { const ux = x - 120, uy = y - 214;
      const ped = Math.abs(ux) < 4 && uy > 0 && uy < 26, bowl = uy > -9 && uy < 1 && Math.abs(ux) < 10 - (uy + 9) * 0.3, lip = uy > -11 && uy <= -9 && Math.abs(ux) < 12;
      if (ped || bowl || lip) layer(1, [150, 150, 140], [210, 196, 160], 0.22); }
    if (!m) { o0[0] = r0; o0[1] = g0; o0[2] = b0; o1[0] = r1; o1[1] = g1; o1[2] = b1; return; }
    if (y < HOR) { // foliage texture, lit a little from above
      const tex = 0.84 + 0.3 * fbm(x / 3.5, y / 3, 61, 3) + (fbm(x / 9, y / 6, 62, 2) - 0.5) * 0.2;
      tr0 *= tex; tg0 *= tex; tb0 *= tex; tr1 *= tex; tg1 *= tex; tb1 *= tex;
    }
    // atmospheric mist, thicker near the horizon
    const band = Math.exp(-Math.pow((y - (HOR - 4)) / 16, 2)) * 0.35;
    const mi = clamp(mist + band, 0, 0.9);
    const mr0 = 170, mg0 = 178, mb0 = 182, mr1 = 226, mg1 = 206, mb1 = 162;
    o0[0] = lerp(tr0, mr0, mi); o0[1] = lerp(tg0, mg0, mi); o0[2] = lerp(tb0, mb0, mi);
    const mi1 = mi * 0.82;
    o1[0] = lerp(tr1, mr1, mi1) + glow * 14; o1[1] = lerp(tg1, mg1, mi1) + glow * 10; o1[2] = lerp(tb1, mb1, mi1);
  }
  function buildOutside() {
    const a = [0, 0, 0], b = [0, 0, 0];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, j = i * 3;
      // old crown glass is never quite flat: each pane bends the garden a little
      const pane = paneId(x, y);
      const dx = Math.round(1.1 * Math.sin(y * 0.19 + pane * 2.3) + 0.7 * Math.sin(y * 0.061 + x * 0.04 + pane * 1.1));
      outsideColor(x + dx, y, a, b);
      const tint = (ih(pane, 3, 9) - 0.5) * 8;
      O0[j] = a[0] + tint * 0.6; O0[j + 1] = a[1] + tint; O0[j + 2] = a[2] + tint * 0.4;
      O1[j] = b[0] + tint * 0.8; O1[j + 1] = b[1] + tint; O1[j + 2] = b[2] + tint * 0.3;
    }
    Q0.set(O0); Q1.set(O1);
    soften(O0, 2); soften(O1, 2);
    for (let y = 0; y < H; y++) for (let x = 0; x < W + 32; x++) {
      const band = Math.exp(-Math.pow((y - 176) / 30, 2));
      const n = fbm(x / 40, y / 9, 130, 4);
      MIST[y * (W + 32) + x] = clamp((n - 0.42) * 2.2, 0, 1) * band;
    }
  }
  // a separable box blur, run twice: the wet glass scatters the garden
  function soften(buf, r) {
    const tmp = new Float32Array(NP * 3);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let a = 0, b = 0, c = 0, n = 0;
        for (let k = -r; k <= r; k++) { const xx = clamp(x + k, 0, W - 1), j = (y * W + xx) * 3; a += buf[j]; b += buf[j + 1]; c += buf[j + 2]; n++; }
        const j = (y * W + x) * 3; tmp[j] = a / n; tmp[j + 1] = b / n; tmp[j + 2] = c / n;
      }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let a = 0, b = 0, c = 0, n = 0;
        for (let k = -r; k <= r; k++) { const yy = clamp(y + k, 0, H - 1), j = (yy * W + x) * 3; a += tmp[j]; b += tmp[j + 1]; c += tmp[j + 2]; n++; }
        const j = (y * W + x) * 3; buf[j] = a / n; buf[j + 1] = b / n; buf[j + 2] = c / n;
      }
    }
  }

  /* ================================================================ the iron wall: geometry */
  const PIL = [[0, 9], [117, 126], [234, 243], [351, 360]];
  const BAYS = [[9, 117], [126, 234], [243, 351]];
  const YS = 72, BEAM = 12, SILL0 = 291, SILL1 = 302;
  const HBARS = [134, 194, 252];
  const LANCETS = [];
  for (const b of BAYS) {
    const bc = b[0] + 54;
    LANCETS.push({ x0: b[0], x1: bc - 1, bay: b }, { x0: bc + 2, x1: b[1], bay: b });
  }
  for (const l of LANCETS) { l.cx = (l.x0 + l.x1) / 2; l.r = (l.x1 - l.x0) / 2; }
  function paneId(x, y) {
    let k = 0;
    for (let n = 0; n < LANCETS.length; n++) if (x >= LANCETS[n].x0 - 1 && x < LANCETS[n].x1 + 1) k = n + 1;
    let row = 0;
    if (y > YS) { row = 1; for (const hb of HBARS) if (y > hb) row++; }
    return k * 10 + row + (x > (k ? LANCETS[k - 1].cx : 0) && y > YS ? 5 : 0);
  }

  // iron is stamped as strokes that store a lambert value; then shaded with outlines
  const IM = new Uint8Array(NP), IL = new Float32Array(NP), IK = new Uint8Array(NP);
  const LX = -0.45, LY = -0.62, LZ = 0.64;
  function ironSet(x, y, nx, ny, u, kind) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    const nz = Math.sqrt(Math.max(0, 1 - u * u));
    IM[i] = 1; IL[i] = nx * u * LX + ny * u * LY + nz * LZ; IK[i] = kind || 0;
  }
  function ironRect(x0, y0, x1, y1, vert, kind) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hw = (x1 - x0) / 2, hh = (y1 - y0) / 2;
    for (let y = fl(y0); y < Math.ceil(y1); y++) for (let x = fl(x0); x < Math.ceil(x1); x++) {
      if (vert) ironSet(x, y, 1, 0, ((x + 0.5) - cx) / hw, kind); else ironSet(x, y, 0, 1, ((y + 0.5) - cy) / hh, kind);
    }
  }
  function ironRing(cx, cy, R, th, upperOnly, kind) {
    const o = R + th / 2 + 1;
    for (let y = fl(cy - o); y <= Math.ceil(upperOnly ? cy : cy + o); y++) for (let x = fl(cx - o); x <= Math.ceil(cx + o); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = Math.hypot(dx, dy);
      const u = (r - R) / (th / 2);
      if (Math.abs(u) <= 1 && (!upperOnly || dy <= 0.5)) ironSet(x, y, dx / (r || 1), dy / (r || 1), u, kind);
    }
  }
  function ironBall(cx, cy, R, kind) {
    for (let y = fl(cy - R - 1); y <= cy + R + 1; y++) for (let x = fl(cx - R - 1); x <= cx + R + 1; x++) {
      const dx = (x + 0.5 - cx) / R, dy = (y + 0.5 - cy) / R, d = dx * dx + dy * dy;
      if (d <= 1) { const i = y * W + x; if (x < 0 || y < 0 || x >= W || y >= H) continue; IM[i] = 1; IL[i] = dx * LX + dy * LY + Math.sqrt(1 - d) * LZ; IK[i] = kind || 0; }
    }
  }
  function ironPoly(pts, th0, th1, kind) {
    let tot = 0; const segL = [];
    for (let k = 0; k < pts.length - 1; k++) { const l = Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]); segL.push(l); tot += l; }
    let acc = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1], l = segL[k] || 1e-6;
      const tx = (b[0] - a[0]) / l, ty = (b[1] - a[1]) / l, nx = -ty, ny = tx;
      const thA = lerp(th0, th1, acc / tot), thB = lerp(th0, th1, (acc + l) / tot), mx = Math.max(thA, thB) / 2 + 1;
      for (let y = fl(Math.min(a[1], b[1]) - mx); y <= Math.max(a[1], b[1]) + mx; y++) for (let x = fl(Math.min(a[0], b[0]) - mx); x <= Math.max(a[0], b[0]) + mx; x++) {
        const px = x + 0.5 - a[0], py = y + 0.5 - a[1];
        const along = clamp(px * tx + py * ty, 0, l), d = px * nx + py * ny;
        const qx = px - tx * along, qy = py - ty * along;
        const dist = Math.hypot(qx, qy), th = lerp(thA, thB, along / l) / 2;
        if (dist <= th) ironSet(x, y, nx, ny, clamp(d / th, -1, 1), kind);
      }
      acc += l;
    }
  }
  function spiral(cx, cy, r0, turns, a0, dir, th0, th1, kind) {
    const pts = [];
    const n = Math.ceil(turns * 40);
    for (let k = 0; k <= n; k++) {
      const q = k / n, a = a0 + dir * q * turns * TAU, r = r0 * (1 - 0.82 * q);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    ironPoly(pts, th0, th1, kind);
    const e = pts[pts.length - 1];
    ironBall(e[0], e[1], th1 * 0.75 + 0.6, kind);
    return pts[0];
  }
  function glassAt(x, y) {
    if (y < BEAM || y >= SILL0) return 0;
    for (const l of LANCETS) {
      if (x < l.x0 || x >= l.x1) continue;
      const bayc = l.bay[0] + 54.5;
      if (y >= YS) return 1;
      // inside the lancet arch, or in the tympanum under the bay arch
      return 1;
    }
    for (const b of BAYS) if (x >= b[0] && x < b[1]) return 1;
    return 0;
  }
  function buildIronShapes() {
    // the beam with a frieze of rings
    ironRect(0, 0, W, BEAM, false, 1);
    for (let x = 6; x < W; x += 12) ironRing(x, 6, 2.6, 1.4, false, 2);
    ironRect(0, BEAM - 1, W, BEAM + 2, false, 1);
    // spandrel scrolls above the bay arches, a pair over each pillar
    for (let k = 0; k < PIL.length; k++) {
      const pc = (PIL[k][0] + PIL[k][1]) / 2;
      for (const dir of [-1, 1]) {
        const cx = pc + dir * 21, cy = 30;
        if (cx < -10 || cx > W + 10) continue;
        spiral(cx, cy, 11, 1.35, dir > 0 ? Math.PI * 0.9 : Math.PI * 0.1, dir, 2.6, 1.6, 3);
        ironPoly([[pc, BEAM + 1], [pc + dir * 6, 22], [pc + dir * 12, 40], [pc + dir * 10, 52]], 2.2, 1.6, 3);
        spiral(pc + dir * 6, 50, 5, 1.1, dir > 0 ? Math.PI * 1.2 : -Math.PI * 0.2, -dir, 1.8, 1.2, 3);
      }
      ironBall(pc, 22, 2.4, 3);
    }
    // bay arches, lancet arches, rosettes
    for (const b of BAYS) {
      const bc = b[0] + 54;
      ironRing(bc + 0.5, YS, 52.5, 4, true, 4);
      ironRing(bc + 0.5, 31, 13.2, 2.6, false, 5);
      for (let k = 0; k < 6; k++) { const a = k / 6 * TAU - Math.PI / 2; ironRing(bc + 0.5 + Math.cos(a) * 6.6, 31 + Math.sin(a) * 6.6, 4.1, 1.4, false, 5); }
      ironBall(bc + 0.5, 31, 2.2, 5);
      // little trefoil cusps in the arch corners
      for (const dir of [-1, 1]) {
        const tx = bc + 0.5 + dir * 34, ty = 36;
        ironRing(tx, ty, 3.6, 1.4, false, 5);
        ironPoly([[tx + dir * 2, ty + 3], [tx + dir * 6, ty + 8]], 1.6, 1.2, 5);
      }
    }
    for (const l of LANCETS) {
      ironRing(l.cx, YS, l.r + 0.2, 3, true, 4);
      // little cusped foils inside each lancet head
      for (const dir of [-1, 1]) ironPoly([[l.cx + dir * (l.r - 2), YS - 3], [l.cx + dir * (l.r - 7), YS - 9], [l.cx + dir * (l.r - 9), YS - 16]], 1.6, 1.0, 5);
      ironRect(l.cx - 1, YS, l.cx + 1, SILL0, true, 6);
      for (const hb of HBARS) ironRect(l.x0, hb, l.x1, hb + 2, false, 6);
      ironRect(l.x0 - 0.5, YS - 1, l.x1 + 0.5, YS + 2, false, 6);
    }
    // mullions
    for (const b of BAYS) { const bc = b[0] + 54; ironRect(bc - 1, YS - 12, bc + 2, SILL0, true, 7); }
    // pillars with capitals and bases
    for (const p of PIL) {
      ironRect(p[0], BEAM, p[1], SILL1, true, 8);
      const pc = (p[0] + p[1]) / 2;
      ironRect(pc - 7, YS - 8, pc + 7, YS - 4, false, 9);
      ironRect(pc - 6, YS - 4, pc + 6, YS + 3, true, 9);
      ironRect(pc - 8, YS + 3, pc + 8, YS + 6, false, 9);
      ironRect(pc - 7, SILL0 - 12, pc + 7, SILL0 - 8, false, 9);
      ironRect(pc - 6, SILL0 - 8, pc + 6, SILL0, true, 9);
      // acanthus curls on the capital
      for (const dir of [-1, 1]) spiral(pc + dir * 6, YS + 8, 3.2, 1.0, dir > 0 ? -Math.PI / 2 : -Math.PI / 2, dir, 1.6, 1.1, 9);
    }
    ironRect(0, SILL0, W, SILL1, false, 10);
    ironRect(0, SILL0 - 1, W, SILL0 + 2, false, 10);
  }
  function buildGlassMask() {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      GLM[i] = (!IM[i] && glassAt(x, y)) ? 1 : 0;
    }
  }
  function shadeIron() {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!IM[i]) continue;
      const up = y > 0 && IM[i - W], dn = y < H - 1 && IM[i + W], lf = x > 0 && IM[i - 1], rt = x < W - 1 && IM[i + 1];
      const lam = IL[i];
      let k = lam > 0.82 ? 15 : lam > 0.55 ? 16 : lam > 0.25 ? 17 : 18;
      const kind = IK[i];
      // fluting on the pillars
      if (kind === 8) { const pc = PIL.find((p) => x >= p[0] && x < p[1]); if (pc) { const dx = x - pc[0]; if (dx === 2 || dx === 6) k = Math.min(18, k + 1); } }
      if (!up || !lf) k = Math.min(k, 16);
      if (!dn || !rt) k = 19;
      if (!up && !lf) k = 17;
      if (kind === 2) k = lam > 0.6 ? 17 : 18;
      if (kind === 1 && y < 2) k = 18;
      let c = P(k).slice();
      // a century of paint: chips, a little rust bleeding from the joints
      const ch = ih(x, y, 77);
      if (kind === 8 && ch < 0.003) c = P(ch < 0.001 ? 21 : 18).slice();
      const rustN = fbm(x / 3, y / 9, 78, 2);
      if (rustN > 0.8 && y > 160 && kind >= 6) c = [lerp(c[0], 155, 0.35), lerp(c[1], 90, 0.35), lerp(c[2], 60, 0.35)];
      lit(c, x, y, 0, 0.4);
      // backlit rim of gold where the iron meets the bright glass
      if (!up || !lf || !dn || !rt) {
        const g = ((!up) ? 1 : 0.55) * 0.5;
        L1[0] += 70 * g; L1[1] += 52 * g; L1[2] += 12 * g;
      }
      put(x, y, 1);
    }
    // rivets down the pillars
    for (const p of PIL) for (let y = BEAM + 8; y < SILL0 - 14; y += 14) {
      if (y > YS - 10 && y < YS + 10) continue;
      for (const xx of [p[0] + 1, p[1] - 2]) { if (xx < 1 || xx > W - 2) continue; lit(P(16), xx, y, 0, 0.3); put(xx, y, 1); lit(P(18), xx, y + 1, 0, 0); put(xx, y + 1, 1); }
    }
  }

  /* ================================================================ condensation */
  function buildFog() {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!GLM[i]) continue;
      const n = fbm(x / 22, y / 14, 120, 4), n2 = fbm(x / 6, y / 5, 121, 2);
      let f = sstep(196, 286, y + (n - 0.5) * 46) * 0.92;
      // fog creeps up from each glazing bar and clings to the iron
      let near = 0;
      for (let d = 1; d <= 5; d++) { if ((y + d < H && !GLM[i + d * W] && y > 140) || (x + d < W && !GLM[i + d]) || (x - d >= 0 && !GLM[i - d])) { near = Math.max(near, (6 - d) / 5); break; } }
      f = Math.max(f, near * 0.45 * sstep(120, 260, y));
      for (const hb of HBARS) { const dy = hb - y; if (dy > 0 && dy < 22) f = Math.max(f, (1 - dy / 22) * 0.5 * (0.6 + 0.8 * n) * sstep(150, 230, y)); }
      f *= 0.82 + 0.36 * n2;
      FOG[i] = clamp(f, 0, 0.95);
    }
    // finger trickles of condensation run down through the fog, leaving clear lines
    const R = mulberry32(4401);
    for (let k = 0; k < 26; k++) {
      let x = 12 + R() * 336, y = 214 + R() * 40;
      const len = 14 + R() * 60, ph = R() * 9;
      for (let s = 0; s < len; s++) {
        const yy = fl(y + s), xx = fl(x + Math.sin((y + s) / 7 + ph) * 1.3);
        if (yy >= SILL0) break;
        const i = yy * W + xx;
        if (!GLM[i]) break;
        FOG[i] *= 0.12; if (xx + 1 < W && GLM[i + 1]) FOG[i + 1] *= 0.55;
      }
    }
  }

  /* ================================================================ interior: wall, bench, floor */
  function buildRoom() {
    // dwarf brick wall under the sill
    for (let y = SILL1; y < 396; y++) for (let x = 0; x < W; x++) {
      const row = fl((y - SILL1 - 6) / 6), off = (row & 1) * 7;
      const bxp = (x + off) % 14, byp = (y - SILL1 - 6) % 6;
      let c;
      if (y < SILL1 + 6) { // stone coping
        const n = fbm(x / 7, y / 2, 150, 2);
        c = P(y === SILL1 + 5 ? 18 : n > 0.55 ? 16 : 17).slice();
      } else if (bxp === 0 || byp === 0) c = P(41).slice();
      else {
        const bi = ih(fl((x + off) / 14), row, 151);
        c = P(bi < 0.3 ? 21 : bi < 0.75 ? 22 : 20).slice();
        if (byp === 1) c = c.map((v) => v * 1.1);
        const n = fbm(x / 4, y / 4, 152, 2);
        if (n > 0.66) c = P(bi < 0.5 ? 22 : 23).slice();
      }
      // moss and damp in the mortar near the bottom
      const mn = fbm(x / 9, y / 5, 153, 3);
      if (y > 360 && mn > 0.6) c = P(mn > 0.7 ? 5 : 4).slice();
      if (y < SILL1 + 8 && mn > 0.62) c = P(mn > 0.7 ? 7 : 6).slice();
      lit(c, x, y, 0, 0.3);
      put(x, y, 1);
    }
    // a tiny fern growing out of the mortar
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * 0.42, L = 7 + (3 - Math.abs(k - 3)) * 2;
      for (let s = 0; s < L; s++) { const x = 338 + Math.cos(a) * s + s * s * 0.02 * (k - 3), y = 366 + Math.sin(a) * s + s * s * 0.03; lit(P(s % 2 ? 7 : 6), x, y, 0.3, 0.2); put(x, y, 2); if (s > 2 && s % 2 === 0) { lit(P(8), x + 1, y, 0.3, 0.2); put(x + 1, y, 2); } }
    }
    // the floor: worn encaustic tiles, damp
    for (let y = 392; y < H; y++) for (let x = 0; x < W; x++) {
      const q = (y - 392) / 58, sc = 1 + q * 0.7;
      const fx = (x - 180) / (10 * sc) + 20, fy = (y - 392) / (6 * sc);
      const tx = fl(fx), ty = fl(fy), ux = fx - tx, uy = fy - ty;
      const d = Math.abs(ux - 0.5) + Math.abs(uy - 0.5);
      let c;
      if (ux < 0.07 || uy < 0.1) c = P(40);
      else if (d < 0.26) c = P(((tx + ty) & 1) ? 43 : 21);
      else c = P(((tx + ty) & 1) ? 21 : 41);
      c = c.slice();
      const n = fbm(x / 10, y / 3, 160, 3);
      const k = 0.86 + n * 0.22;
      c = [c[0] * k, c[1] * k, c[2] * k];
      if (n > 0.64) c = [lerp(c[0], 150, 0.2), lerp(c[1], 160, 0.2), lerp(c[2], 164, 0.2)]; // a damp sheen
      lit(c, x, y, 0, 0.6);
      put(x, y, 1);
    }
    // the bench: silvered old timber slats
    const BX0 = 94, WOOD = [P(40), P(41), P(42), P(43), P(18), P(17)];
    for (let y = 316; y < 340; y++) for (let x = BX0; x < W; x++) {
      const yy = y - 316;
      let lam;
      if (yy < 18) {
        const slat = fl(yy / 4.5), sy = yy - slat * 4.5;
        if (sy >= 3.6) lam = 0.02;
        else {
          const g = fbm(x / 26 + slat * 7, sy * 0.5 + slat, 170, 3), gr = vn2(x / 3, slat * 3 + sy * 0.5, 171);
          lam = 0.5 + (g - 0.5) * 0.5 + (sy < 1 ? 0.12 : 0) - slat * 0.03;
          if (gr > 0.82) lam -= 0.18;
          if ((x - BX0) % 46 === 9 && (sy > 1 && sy < 2.5)) lam = 0.1;
        }
      } else {
        const g = fbm(x / 20, y / 3, 172, 3);
        lam = y === 339 ? 0.06 : 0.3 + (g - 0.5) * 0.3 - (yy - 18) * 0.02;
      }
      if (x === BX0) lam = 0.1;
      lit(ramp(WOOD, lam), x, y, 0, 0.7);
      put(x, y, 4);
    }
    // legs, stretcher and the lower shelf
    for (const lx of [100, 222, 346]) for (let y = 340; y < 404; y++) for (let x = lx; x < lx + 6; x++) {
      const u = (x - lx) / 5;
      lit(P(u < 0.25 ? 16 : u < 0.7 ? 17 : 19), x, y, 0, 0.2); put(x, y, 4);
    }
    for (let y = 372; y < 378; y++) for (let x = 100; x < 352; x++) {
      const g = fbm(x / 18, y / 2, 173, 2);
      lit(ramp(WOOD, y === 372 ? 0.6 : y === 377 ? 0.05 : 0.3 + (g - 0.5) * 0.3), x, y, 0, 0.1); put(x, y, 3);
    }
    // stacked spare pots and a seed tray on the lower shelf
    potStack(124, 372, 3); potStack(150, 372, 2);
    for (let y = 362; y < 372; y++) for (let x = 168; x < 214; x++) {
      const top = y < 364;
      lit(P(top ? 42 : y === 371 ? 40 : (x % 7 === 0 ? 41 : 43)), x, y, 0, 0); put(x, y, 3);
    }
    for (let k = 0; k < 11; k++) { const x = 171 + k * 4; for (let s = 0; s < 4; s++) { lit(P(s < 2 ? 8 : 7), x + (s === 3 ? 1 : 0), 361 - s, 0.4, 0); put(x + (s === 3 ? 1 : 0), 361 - s, 3); } lit(P(9), x - 1, 358, 0.4, 0); put(x - 1, 358, 3); lit(P(8), x + 1, 357, 0.4, 0); put(x + 1, 357, 3); }
  }
  // a terracotta pot: rolled rim, tapered body, mineral bloom, moss at the foot
  const TERRA = [P(20), P(21), P(22), P(23), P(24), P(25)];
  function ramp(R, u) { u = clamp(u, 0, 0.999) * (R.length - 1); const k = fl(u), f = u - k; return [lerp(R[k][0], R[k + 1][0], f), lerp(R[k][1], R[k + 1][1], f), lerp(R[k][2], R[k + 1][2], f)]; }
  function pot(cx, ytop, rTop, rBot, h, z, opt) {
    opt = opt || {};
    const rimH = Math.max(3, Math.round(h * 0.17));
    for (let y = ytop; y < ytop + h; y++) {
      const q = (y - ytop) / h, isRim = y < ytop + rimH;
      const r = isRim ? rTop + 1.5 : lerp(rTop, rBot, (y - ytop - rimH) / (h - rimH));
      for (let x = fl(cx - r); x <= cx + r; x++) {
        const u = (x + 0.5 - cx) / r;
        if (Math.abs(u) > 1) continue;
        const nz = Math.sqrt(Math.max(0, 1 - u * u));
        let lam = 0.18 + 0.62 * (nz * 0.7 - u * 0.45 + 0.15) - q * 0.12;
        if (isRim) { const ry = (y - ytop) / rimH; lam += ry < 0.34 ? 0.16 : ry > 0.75 ? -0.06 : 0.06; }
        else if (y < ytop + rimH + 2) lam -= 0.22; // shadow under the rolled rim
        const n = fbm(x / 3 + cx, y / 2.4, 180 + cx, 3);
        lam += (n - 0.5) * 0.12;
        let c = ramp(TERRA, lam);
        if (Math.abs(u) > 0.94) c = ramp(TERRA, lam * 0.5);
        // white mineral bloom wicking up from the base and round the rim
        const bl = fbm(x / 6 + cx * 0.3, y / 4, 190 + cx, 3);
        if (!opt.clean && bl > 0.6 && (isRim || q > 0.55)) { const m = clamp((bl - 0.6) * 5, 0, 0.7); c = [lerp(c[0], 214, m), lerp(c[1], 204, m), lerp(c[2], 184, m)]; }
        if (!opt.clean && q > 0.8 && n < 0.34) c = P(n < 0.24 ? 5 : 4).slice();
        lit(c, x, y, 0, 0.8);
        put(x, y, z);
      }
    }
    // soil showing inside the rim
    for (let x = fl(cx - rTop + 1); x <= cx + rTop - 1; x++) { lit(P(ih(x, ytop, 5) < 0.5 ? 40 : 41), x, ytop, 0, 0); put(x, ytop, z); }
  }
  function potStack(cx, ybot, n) {
    for (let k = 0; k < n; k++) pot(cx, ybot - 12 - k * 4, 9 - k * 0.0, 7, 12, 3, { clean: true });
  }

  /* ================================================================ leaves */
  // generic leaf colouring with selective outlines
  function leafPaint(base, light, dark, edgeDark, x, y, v, e, trans, z, sunk) {
    let c = v < 0 ? light : base;
    if (e) c = (e & 1) && v < 0 ? light : edgeDark;
    lit(c, x, y, trans, sunk);
    put(x, y, z);
  }
  function monstera(p, Wm, z, holesOn, seed) {
    mapBegin();
    const NR = 7;
    leafShape(p, (s) => Wm * Math.pow(Math.sin(Math.PI * (0.12 + 0.88 * s)), 0.62) * (1 - 0.12 * s), (s, v, h) => {
      if (!holesOn) return false;
      const av = Math.abs(v), q = (s - 0.3 * av) * NR + (v < 0 ? 0.3 : 0), f = q - fl(q);
      if (s > 0.12 && s < 0.88 && av > 0.5 && Math.abs(f - 0.5) < 0.08 + 0.34 * (av - 0.5)) return true;
      if (s > 0.18 && s < 0.8 && (fl(q) + (v < 0 ? 0 : 1)) % 2 === 0) { const a = (f - 0.5) / 0.12, b = (av - 0.3) / 0.1; if (a * a + b * b < 1) return true; }
      return false;
    }, 2.6);
    mapEnd((x, y, s, v, e) => {
      const av = Math.abs(v), q = (s - 0.3 * av) * NR + (v < 0 ? 0.3 : 0), f = q - fl(q);
      let c;
      if (av < 0.07) c = P(v < 0 ? 7 : 6);
      else if (f < 0.08 || f > 0.94) c = P(v < 0 ? 7 : 6);
      else {
        c = P(v < 0 ? 5 : 4);
        const g = fbm(x / 3, y / 3, seed, 2);
        if (v < -0.2 && v > -0.62 && s > 0.2 && s < 0.7 && g > 0.5) c = P(6);
        if (v > 0.6 && g < 0.4) c = P(3);
      }
      if (e) c = (e & 1) && v < 0 ? P(6) : P(2);
      lit(c, x, y, 0.18, 0.7);
      put(x, y, z);
    });
  }
  function banana(p, Wb, z, tears, seed) {
    mapBegin();
    leafShape(p, (s) => Wb * (s < 0.07 ? Math.sqrt(s / 0.07) * 0.6 + 0.1 : s > 0.82 ? Math.sqrt(Math.max(0, 1 - Math.pow((s - 0.82) / 0.18, 2))) : 1) * (1 - 0.1 * Math.sin(s * 9)), (s, v, h, len) => {
      for (const t of tears) {
        if ((v < 0) !== (t[1] < 0)) continue;
        const av = Math.abs(v);
        if (av < t[2]) continue;
        const ds = (s - t[0]) * len - (av - t[2]) * h * 0.55;
        if (Math.abs(ds) < 0.55 + (av - t[2]) * 0.8) return true;
      }
      return false;
    }, 2.4);
    mapEnd((x, y, s, v, e) => {
      const av = Math.abs(v);
      let c;
      if (av < 0.1) c = P(av < 0.045 ? 10 : 9);
      else {
        // fine parallel veins running out from the midrib, and broad pleats between them
        const along = s * 230 - av * 12 * (v < 0 ? 1 : 1);
        const vp = along - fl(along / 2.4) * 2.4;
        const pleat = Math.sin(along / 9.5) * 0.5 + 0.5;
        let lam = (v < 0 ? 0.62 : 0.42) + (pleat - 0.5) * 0.22 + (av < 0.2 ? 0.08 : 0) - av * 0.08;
        if (vp < 0.75) lam -= 0.14;
        const g = fbm(x / 5, y / 5, seed, 2);
        lam += (g - 0.5) * 0.12;
        c = ramp(BAN, lam);
        // the edges dry out and yellow
        const dry = fbm(x / 4, y / 4, seed + 7, 2);
        if (av > 0.78 + (1 - dry) * 0.25 && dry > 0.48) c = dry > 0.62 ? P(43) : P(35);
      }
      if (e) c = (e & 1) && v < 0 ? P(9) : P(av > 0.5 && fbm(x / 3, y / 3, seed + 1, 2) > 0.58 ? 42 : 4);
      lit(c, x, y, 0.85, 0.5);
      put(x, y, z);
    });
  }
  const BAN = [P(3), P(4), P(5), P(6), P(7), P(8), P(9)];
  function pinna(x0, y0, ang, len, wid, z, curl, shade) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const p = [x0, y0, x0 + ca * len * 0.35, y0 + sa * len * 0.35, x0 + ca * len * 0.7 + curl * -sa * len * 0.2, y0 + sa * len * 0.7 + curl * ca * len * 0.2, x0 + ca * len + curl * -sa * len * 0.45, y0 + sa * len + curl * ca * len * 0.45];
    mapBegin();
    const lobes = Math.max(2, Math.round(len / 2.6));
    leafShape(p, (s) => wid * (1 - Math.pow(s, 1.6)) * (0.55 + 0.45 * Math.abs(Math.sin((s * lobes + 0.25) * Math.PI))) + 0.3, null, 2.8);
    mapEnd((x, y, s, v, e) => {
      let c = P(s > 0.7 ? 8 : v < 0 ? 7 : 6);
      if (Math.abs(v) < 0.2 && s < 0.85) c = P(shade ? 5 : 6);
      if (e) c = (e & 1) ? P(8) : P(shade ? 3 : 4);
      if (shade) c = c.map((q) => q * 0.82);
      lit(c, x, y, 0.65, 0.6);
      put(x, y, z);
    });
  }
  function fernFrond(p, Lp, z, shade, seed) {
    const len = cubLen(p);
    const R = mulberry32(seed);
    // the rachis
    tube(p, 1.3, 0.5, (x, y, s, v, e) => { lit(P(s < 0.3 ? 42 : 6), x, y, 0.2, 0.3); put(x, y, z); }, z);
    const n = Math.floor(len / 4.2);
    for (let k = 2; k < n; k++) {
      const s = k / n;
      cub(p, s);
      const bx = BX, by = BY, tx = TX, ty = TY;
      const pl = Lp * Math.pow(Math.sin(Math.PI * Math.min(1, 0.12 + s * 0.98)), 0.7) * (1 - 0.35 * s) * (0.9 + 0.2 * R());
      if (pl < 2) continue;
      const base = Math.atan2(ty, tx);
      for (const side of [-1, 1]) {
        const ang = base + side * (1.05 - 0.25 * s);
        pinna(bx + side * 0.5 * -ty, by + side * 0.5 * tx, ang, pl, 1.9 + pl * 0.08, z, side * 0.5, shade);
      }
    }
  }

  /* ================================================================ the plants */
  function buildPlants() {
    // ---- tree fern: trunk, crown, fronds
    for (let y = 150; y < 318; y++) {
      const wob = Math.sin(y / 23) * 1.5, hw = 7.5 + (y - 150) * 0.012;
      for (let x = fl(300 + wob - hw); x <= 300 + wob + hw; x++) {
        const u = (x + 0.5 - 300 - wob) / hw;
        if (Math.abs(u) > 1) continue;
        const f = vn2(x / 1.3, y / 9, 200), sc = ((fl((y + (fl(x / 4) & 1) * 4) / 8)) & 1);
        let k = u < -0.4 ? 42 : u < 0.4 ? 41 : 40;
        if (f > 0.7) k = 43; else if (f < 0.25) k = 40;
        if (sc && Math.abs(u) < 0.75 && ((y % 8) < 2)) k = 42;
        if (Math.abs(u) > 0.88) k = 40;
        lit(P(k), x, y, 0, 0.5); put(x, y, 3);
      }
      // stray root fibres
      if (ih(y, 3, 201) < 0.3) { const sx = 300 + wob + (ih(y, 4, 201) < 0.5 ? -hw - 1 : hw + 1); lit(P(41), sx, y, 0, 0); put(sx, y, 3); }
    }
    const fronds = [
      [[298, 148, 284, 108, 266, 76, 262, 44], 13, true],
      [[302, 147, 304, 98, 322, 60, 346, 44], 15, true],
      [[300, 149, 270, 98, 232, 76, 200, 90], 17, false],
      [[304, 150, 338, 122, 372, 112, 392, 134], 16, false],
      [[298, 153, 252, 140, 216, 156, 196, 196], 16, false],
      [[304, 153, 340, 162, 360, 200, 366, 246], 15, false],
      [[300, 156, 276, 180, 258, 214, 252, 252], 13, false],
    ];
    fronds.forEach((f, k) => fernFrond(f[0], f[1], 3, f[2], 300 + k));
    // hairy crown
    for (let k = 0; k < 140; k++) {
      const a = ih(k, 1, 210) * TAU, r = Math.sqrt(ih(k, 2, 210)) * 9;
      const x = 300 + Math.cos(a) * r * 1.3, y = 150 + Math.sin(a) * r * 0.7;
      lit(P(ih(k, 3, 210) < 0.4 ? 43 : ih(k, 3, 210) < 0.7 ? 42 : 35), x, y, 0.2, 0.6); put(x, y, 3);
    }

    // ---- banana: pseudostem, an unfurling cigar leaf, broad torn leaves
    for (let y = 170; y < 380; y++) {
      const cx = 28 + (y - 170) * -0.02, hw = 6 + (y - 170) * 0.02;
      for (let x = fl(cx - hw); x <= cx + hw; x++) {
        const u = (x + 0.5 - cx) / hw;
        if (Math.abs(u) > 1) continue;
        const n = fbm(x / 2, y / 14, 220, 2), mot = fbm(x / 3, y / 5, 221, 3);
        // overlapping leaf sheaths: each wraps from one side, its edge a pale line
        const sheath = ((x - cx) / hw + 1) * 2.2 + Math.sin(y / 26) * 0.7, sf = sheath - fl(sheath);
        let lam = 0.62 - u * 0.36 + (sf - 0.5) * 0.16 + (n - 0.5) * 0.14;
        let k = lam > 0.78 ? 9 : lam > 0.6 ? 8 : lam > 0.44 ? 7 : lam > 0.3 ? 6 : 5;
        if (sf > 0.93) k = 10;
        if (sf < 0.07) k = 5;
        if (mot > 0.66) k = mot > 0.72 ? 42 : 43;           // the dark mottling of a banana stem
        if (Math.abs(u) > 0.9) k = 4;
        lit(P(k), x, y, 0.3, 0.4); put(x, y, 5);
      }
    }
    banana([28, 176, 6, 120, 24, 52, 62, 18], 15, 5, [[0.42, 1, 0.45], [0.6, -1, 0.3], [0.75, 1, 0.5]], 230);
    banana([30, 178, 66, 104, 120, 70, 172, 96], 18, 5, [[0.3, -1, 0.5], [0.5, -1, 0.35], [0.58, 1, 0.42], [0.72, -1, 0.3], [0.85, 1, 0.5]], 231);
    banana([30, 184, 64, 172, 88, 196, 96, 240], 14, 6, [[0.45, 1, 0.4], [0.7, -1, 0.5]], 232);
    // the cigar leaf, still rolled
    tube([30, 176, 30, 146, 33, 118, 38, 98], 2.6, 0.6, (x, y, s, v, e) => { lit(P(e ? 7 : v < -0.2 ? 10 : v < 0.4 ? 9 : 8), x, y, 0.7, 0.5); put(x, y, 6); }, 6);

    // ---- monstera in a big pot, with aerial roots
    pot(40, 368, 40, 32, 82, 7);
    const petiole = (q, z) => tube(q, 1.6, 1.1, (x, y, s, v, e) => { lit(P(e ? 4 : v < -0.2 ? 7 : 6), x, y, 0.1, 0.3); put(x, y, z); }, z);
    petiole([30, 370, 26, 330, 22, 300, 26, 262], 6);
    monstera([26, 264, 14, 236, 2, 228, -12, 240], 26, 6, true, 240);
    petiole([46, 370, 52, 340, 58, 320, 66, 300], 7);
    monstera([66, 300, 86, 290, 112, 302, 126, 330], 25, 7, true, 241);
    petiole([40, 370, 46, 320, 56, 280, 72, 250], 7);
    monstera([72, 250, 92, 230, 114, 232, 130, 250], 21, 7, true, 242);
    petiole([20, 370, 16, 350, 12, 336, 8, 326], 8);
    monstera([8, 326, 0, 312, -6, 304, -14, 302], 13, 8, false, 243);
    petiole([52, 372, 70, 364, 84, 358, 94, 352], 8);
    monstera([94, 352, 108, 352, 120, 362, 126, 380], 18, 8, true, 244);
    // aerial roots
    for (const r of [[34, 300, 1], [58, 296, -1], [20, 330, 1]]) {
      for (let s = 0; s < 70; s++) { const x = r[0] + Math.sin(s / 9) * 1.2 * r[2], y = r[1] + s; if (y > 368) break; lit(P(s % 9 === 0 ? 43 : 42), x, y, 0, 0.2); put(x, y, 7); }
    }

    // ---- bench plants
    // orchid
    pot(140, 300, 11, 8, 20, 5);
    for (const L of [[[140, 302, 128, 300, 118, 306, 112, 314], 4], [[141, 302, 154, 299, 164, 304, 170, 312], 4.5], [[140, 301, 136, 294, 130, 292, 124, 294], 3.2]]) {
      mapBegin();
      leafShape(L[0], (s) => L[1] * Math.pow(Math.sin(Math.PI * (0.15 + 0.85 * s)), 0.7));
      mapEnd((x, y, s, v, e) => { let c = P(v < 0 ? 5 : 4); if (Math.abs(v) < 0.12) c = P(6); if (e) c = (e & 1) ? P(6) : P(2); lit(c, x, y, 0.1, 0.6); put(x, y, 6); });
    }
    const spike = [141, 300, 142, 266, 152, 240, 176, 236];
    tube(spike, 0.7, 0.5, (x, y) => { lit(P(42), x, y, 0.1, 0.4); put(x, y, 5); }, 5);
    // a thin bamboo stake and a clip
    for (let y = 252; y < 300; y++) { lit(P(y % 11 === 0 ? 42 : 43), 139, y, 0, 0.3); put(139, y, 5); }
    for (const fl0 of [[0.6, 11], [0.73, 12], [0.86, 11], [0.97, 9]]) { cub(spike, fl0[0]); orchidFlower(BX, BY + 4, fl0[1], 6); }
    cub(spike, 1); bud(BX + 3, BY + 1, 6); bud(BX + 6, BY + 3, 6);
    cub(spike, 0.47); orchidFlower(BX - 2, BY + 4, 10, 6);
    // bromeliad in a pot
    pot(202, 304, 11, 9, 16, 5);
    bromeliad(202, 302, 5, 1.12);
    // a little pilea and a pot of seedlings
    pot(246, 308, 8, 6, 12, 5);
    for (let k = 0; k < 9; k++) {
      const a = -Math.PI / 2 + (k - 4) * 0.36, L = 8 + ih(k, 1, 250) * 8;
      const ex = 246 + Math.cos(a) * L, ey = 306 + Math.sin(a) * L;
      for (let s = 0; s < L - 2; s++) { lit(P(6), 246 + Math.cos(a) * s, 306 + Math.sin(a) * s, 0.2, 0.3); put(246 + Math.cos(a) * s, 306 + Math.sin(a) * s, 5); }
      coin(ex, ey, 2.8 + ih(k, 2, 250) * 1.2, 6);
    }
    pot(270, 310, 7, 5, 10, 5);
    for (let k = 0; k < 6; k++) { const x = 265 + k * 2; for (let s = 0; s < 5 + (k % 3); s++) { lit(P(8), x, 309 - s, 0.4, 0.3); put(x, 309 - s, 5); } lit(P(9), x - 1, 304 - (k % 3), 0.4, 0.3); put(x - 1, 304 - (k % 3), 5); lit(P(9), x + 1, 303 - (k % 3), 0.4, 0.3); put(x + 1, 303 - (k % 3), 5); }
    // a plant label in the seedlings
    for (let y = 300; y < 308; y++) for (let x = 274; x < 277; x++) { lit(P(y === 300 ? 15 : 16), x, y, 0, 0.3); put(x, y, 5); }
    // a trowel resting on the bench
    for (let x = 216; x < 236; x++) { const y = 317 - (x - 216) * 0.05; if (x < 226) { lit(P(41), x, y, 0, 0.2); put(x, y, 5); lit(P(42), x, y - 1, 0, 0.2); put(x, y - 1, 5); } else { lit(P(x < 228 ? 18 : 17), x, y, 0, 0.3); put(x, y, 5); lit(P(16), x, y - 1, 0, 0.5); put(x, y - 1, 5); if (x > 228 && x < 234) { lit(P(18), x, y + 1, 0, 0.3); put(x, y + 1, 5); } } }

    // ---- a bromeliad and moss tied to the left pillar
    mountedVriesea(121.5, 196);

    // ---- moss along the sill and on the capitals
    for (let x = 0; x < W; x++) {
      const n = fbm(x / 11, 0, 260, 3), h = fl((n - 0.4) * 9);
      for (let k = 0; k < h; k++) { const y = SILL0 - 1 - k; const g = ih(x, y, 261); lit(P(k === h - 1 ? (g < 0.5 ? 8 : 7) : g < 0.4 ? 5 : 6), x, y, 0.3, 0.6); put(x, y, 2); }
    }
    for (const p of PIL) { const pc = (p[0] + p[1]) / 2; mossPad(pc, YS - 9, 6, 2, 2); }

    // ---- ivy swagged along the beam
    for (let k = 0; k < 3; k++) {
      const x0 = PIL[k][1], x1 = PIL[k + 1][0];
      for (let x = x0 - 4; x < x1 + 4; x += 1) {
        const q = (x - x0) / (x1 - x0), y = BEAM + 2 + Math.sin(Math.PI * clamp(q, 0, 1)) * (9 + k * 2);
        lit(P(42), x, y, 0, 0.3); put(x, y, 2);
        if (ih(x, k, 270) < 0.34) ivyLeaf(x, y + 1, ih(x, k, 271) < 0.5 ? -1 : 1, ih(x, k, 272), 2);
      }
    }
    // hanging basket: chains and a moss-lined wire bowl
    for (const dx of [-10, 0, 10]) for (let y = BEAM + 2; y < 42; y++) { const x = 176 + dx * (y - BEAM - 2) / 30; if ((y & 1) === 0) { lit(P(18), x, y, 0, 0.2); put(x, y, 2); } else { lit(P(17), x, y, 0, 0.2); put(x, y, 2); } }
    for (let y = 42; y < 58; y++) for (let x = 162; x < 191; x++) {
      const dx = (x + 0.5 - 176.5) / 14, dy = (y + 0.5 - 42) / 15;
      if (dx * dx + dy * dy > 1) continue;
      const wire = ((x + y) % 4 === 0) || ((x - y + 400) % 4 === 0);
      const g = fbm(x / 3, y / 3, 280, 2);
      let c = wire ? P(19) : P(g > 0.6 ? 7 : g > 0.4 ? 6 : 5);
      if (dx * dx + dy * dy > 0.82) c = P(wire ? 18 : 4);
      if (y === 42) c = P(18);
      lit(c, x, y, 0.2, 0.4); put(x, y, 2);
    }
    for (let k = 0; k < 16; k++) ivyLeaf(164 + ih(k, 1, 290) * 25, 36 + ih(k, 2, 290) * 7, ih(k, 3, 290) < 0.5 ? -1 : 1, ih(k, 4, 290), 2);
  }
  // a vriesea wired to a slab of cork bark on the pillar: a fountain of banded leaves and a flaming sword
  function mountedVriesea(cx, cy) {
    for (let y = cy - 6; y < cy + 22; y++) for (let x = fl(cx - 5); x <= cx + 5; x++) {
      const u = (x + 0.5 - cx) / 5.5, edge = 0.85 + 0.15 * vn2(y / 2, 3, 700);
      if (Math.abs(u) > edge) continue;
      const n = vn2(x / 1.2, y / 4, 701);
      lit(P(Math.abs(u) > edge - 0.2 ? 40 : n > 0.6 ? 43 : n > 0.3 ? 42 : 41), x, y, 0, 0.4); put(x, y, 2);
    }
    for (const wy of [cy + 3, cy + 15]) for (let x = fl(cx - 7); x <= cx + 6; x++) { lit(P(x & 1 ? 19 : 18), x, wy + ((x >> 1) & 1), 0, 0.2); put(x, wy + ((x >> 1) & 1), 2); }
    // dangling roots
    for (const r of [[-3, 9, 0.3], [1, 12, -0.2], [3, 7, 0.4]]) for (let s = 0; s < r[1]; s++) { const x = cx + r[0] + Math.sin(s / 3) * r[2] * 3, y = cy + 18 + s; lit(P(s === r[1] - 1 ? 17 : 42), x, y, 0, 0.2); put(x, y, 2); }
    mossPad(cx, cy + 1, 6, 3, 2);
    // the leaves
    const n = 7;
    for (const k of [0, 6, 1, 5, 2, 4, 3]) {
      const q = (k + 0.5) / n, a = -Math.PI + 0.1 + q * (Math.PI - 0.2);
      const L = 17 + 7 * Math.sin(q * Math.PI) + (k % 2) * 3;
      const dx = Math.cos(a), dy = Math.sin(a), out = Math.abs(dx);
      const p = [cx, cy, cx + dx * L * 0.3, cy + dy * L * 0.75, cx + dx * L * 0.8, cy + dy * L * (0.7 - out * 0.5), cx + dx * L * 1.0, cy + dy * L * (0.3 - out * 0.4) + out * L * 0.55];
      mapBegin();
      leafShape(p, (s) => 1.9 * (1 - s * 0.6) + 0.3);
      mapEnd((x, y, s, v, e) => {
        const band = ((fl(s * L / 2.6 + 0.5)) % 2) === 0 && s > 0.15 && s < 0.85;
        let c = P(v < 0 ? 7 : 6);
        if (band) c = P(v < 0 ? 5 : 4);
        if (s > 0.9) c = P(8);
        if (e) c = (e & 1) ? P(8) : P(3);
        lit(c, x, y, 0.4, 0.6); put(x, y, 2);
      });
    }
    // the flaming sword of bracts
    for (let k = 0; k < 9; k++) {
      const yy = cy - 4 - k * 1.6, xx = cx + k * 0.25, ww = 2.2 - k * 0.12;
      for (let x = fl(xx - ww); x <= xx + ww; x++) {
        const u = (x + 0.5 - xx) / ww;
        lit(P(u < -0.3 ? 25 : u < 0.4 ? 23 : 22), x, yy, 0.5, 0.8); put(x, yy, 2);
        lit(P(u < 0 ? 24 : 22), x, yy + 1, 0.5, 0.8); put(x, yy + 1, 2);
      }
      lit(P(37), xx + (k & 1 ? ww : -ww), yy, 0.5, 0.8); put(xx + (k & 1 ? ww : -ww), yy, 2);
    }
  }
  function mossPad(cx, cy, rx, ry, z) {
    for (let y = fl(cy - ry - 2); y <= cy + ry + 2; y++) for (let x = fl(cx - rx - 2); x <= cx + rx + 2; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry, n = fbm(x / 2, y / 2, 300 + cx, 2);
      if (dx * dx + dy * dy > 0.7 + 0.6 * n) continue;
      const g = ih(x, y, 301);
      lit(P(dy < -0.3 ? (g < 0.5 ? 8 : 9) : g < 0.3 ? 5 : g < 0.7 ? 6 : 7), x, y, 0.3, 0.6); put(x, y, z);
    }
  }
  function coin(cx, cy, r, z) {
    for (let y = fl(cy - r); y <= cy + r; y++) for (let x = fl(cx - r); x <= cx + r; x++) {
      const dx = (x + 0.5 - cx) / r, dy = (y + 0.5 - cy) / r, d = dx * dx + dy * dy;
      if (d > 1) continue;
      let c = P(d > 0.7 ? (dy < 0 ? 7 : 4) : dx + dy < -0.3 ? 8 : 6);
      if (Math.abs(dx) < 0.12 && dy > -0.2) c = P(9);
      lit(c, x, y, 0.4, 0.6); put(x, y, z);
    }
  }
  const IVY = [
    '..a.a..',
    '.aabaa.',
    'aabcbaa',
    '.abcba.',
    '..aca..',
    '...c...',
  ];
  function ivyLeaf(x, y, dir, h, z) {
    const big = h < 0.6;
    for (let r = 0; r < IVY.length; r++) for (let c = 0; c < 7; c++) {
      const ch = IVY[r][dir > 0 ? c : 6 - c];
      if (ch === '.') continue;
      if (!big && (r === 0 || c === 0 || c === 6)) continue;
      const k = ch === 'a' ? (h < 0.3 ? 5 : 6) : ch === 'b' ? (h < 0.5 ? 7 : 6) : 9;
      lit(P(k), x - 3 + c, y + r - 1, 0.5, 0.6); put(x - 3 + c, y + r - 1, z);
    }
  }
  // a phalaenopsis flower: broad white petals, a dorsal and two lateral sepals, a magenta lip
  function orchidFlower(cx, cy, size, z) {
    const k = size / 10;
    const parts = [[0, -3.4, 1.9, 2.6, 1], [-2.3, 3.0, 1.5, 2.4, 2], [2.3, 3.0, 1.5, 2.4, 2], [-3.7, 0, 3.1, 3.2, 3], [3.7, 0, 3.1, 3.2, 3], [0, 2.4, 1.6, 2.1, 4]];
    mapBegin();
    for (const pp of parts) {
      const rx = pp[2] * k, ry = pp[3] * k, ox = cx + pp[0] * k, oy = cy + pp[1] * k;
      for (let y = fl(oy - ry - 1); y <= oy + ry + 1; y++) for (let x = fl(ox - rx - 1); x <= ox + rx + 1; x++) {
        const dx = (x + 0.5 - ox) / rx, dy = (y + 0.5 - oy) / ry;
        if (dx * dx + dy * dy <= 1.05) mark(x, y, pp[4], dx + dy);
      }
    }
    mapEnd((x, y, part, dd, e) => {
      let c;
      if (part === 4) c = P(e ? 21 : (y < cy + 2 * k ? 37 : 44));
      else {
        c = P(46);
        if (part === 3 && dd > 0.7) c = P(45);
        if (part === 2) c = P(dd > 0.3 ? 45 : 46);
        if (e) c = P((e & 1) && y < cy ? 46 : 45);
      }
      if (Math.abs(x + 0.5 - cx) < 0.8 && Math.abs(y + 0.5 - cy) < 1.2) c = P(15);
      lit(c, x, y, 0.5, 0.8); put(x, y, z);
    });
  }
  function bud(cx, cy, z) {
    for (let r = -1; r <= 1; r++) for (let c = -2; c <= 1; c++) { if (Math.abs(r) === 1 && (c === -2 || c === 1)) continue; lit(P(r < 0 ? 46 : c > 0 ? 45 : 9), cx + c, cy + r, 0.4, 0.6); put(cx + c, cy + r, z); }
  }
  function bromeliad(cx, cy, z, scale, green) {
    // silver-banded strap leaves arching out of a vase rosette, a pink bract in the middle
    const n = 7;
    for (const k of [0, 6, 1, 5, 2, 4, 3]) {
      const a = Math.PI * 1.5 + ((k + 0.5) / n - 0.5) * Math.PI * 0.95, L = (19 + 4 * Math.sin(k * 2.1)) * scale * (1.1 - Math.abs(k - 3) * 0.02);
      const dx = Math.cos(a), dy = Math.sin(a), out = Math.abs(dx);
      const p = [cx, cy, cx + dx * L * 0.3, cy + dy * L * 0.7, cx + dx * L * 0.8, cy + dy * L * (0.75 - out * 0.3), cx + dx * L * 1.05, cy + dy * L * (0.45 - out * 0.35) + out * L * 0.2];
      mapBegin();
      leafShape(p, (s) => 2.3 * scale * (1 - s * 0.6) + 0.4);
      mapEnd((x, y, s, v, e) => {
        const band = ((fl(s * L / 2.4)) & 1) === 0;
        let c = green ? P(s > 0.85 ? 8 : v < 0 ? 7 : 6) : P(band ? (v < 0 ? 14 : 13) : v < 0 ? 12 : 11);
        if (green && band && s < 0.5) c = P(v < 0 ? 6 : 5);
        if (e) c = (e & 1) ? P(green ? 8 : 13) : P(green ? 3 : 2);
        lit(c, x, y, 0.3, 0.6); put(x, y, z);
      });
    }
    // bract
    for (let k = 0; k < 9; k++) {
      const yy = cy - 3 - k * 1.3 * scale - 2, ww = (4 - Math.abs(k - 3.5) * 0.7) * scale + 0.5;
      for (let x = fl(cx - ww); x <= cx + ww; x++) {
        const tip = ((x + k) % 3 === 0);
        lit(green ? P(tip ? 25 : x < cx ? 24 : 23) : P(tip ? 45 : x < cx ? 45 : 44), x, yy, 0.4, 0.8); put(x, yy, z);
        if (tip && k % 2) { lit(P(30), x, yy - 1, 0.2, 0.5); put(x, yy - 1, z); }
      }
    }
  }

  /* ================================================================ basin, spout, watering can */
  const BASIN = { cx: 172, cy: 418, rx: 58, ry: 14 };
  const SPOUT = { x: 150, y: 382 };
  function buildBasin() {
    const b = BASIN;
    const STONE = [P(19), P(18), P(17), P(16), P(15)];
    // a brass standpipe behind the basin, with an elbow, a wheel tap and a spout pointing down
    const BRASS = [P(40), P(34), P(35), P(36), P(37), P(38)];
    const vx = 118;
    for (let y = 366; y < 410; y++) for (let x = vx - 2; x <= vx + 2; x++) { const u = (x - vx) / 2.5; lit(ramp(BRASS, 0.62 - u * 0.5), x, y, 0, 0.6); put(x, y, 6); }
    for (let y = 362; y < 368; y++) for (let x = vx - 3; x <= SPOUT.x + 2; x++) { const u = (y - 365) / 3; lit(ramp(BRASS, 0.66 - u * 0.5), x, y, 0, 0.6); put(x, y, 6); }
    for (let y = 362; y < SPOUT.y; y++) for (let x = SPOUT.x - 2; x <= SPOUT.x + 2; x++) { const u = (x - SPOUT.x) / 2.5; lit(ramp(BRASS, 0.62 - u * 0.5), x, y, 0, 0.6); put(x, y, 6); }
    for (const jx of [vx, SPOUT.x]) for (let x = jx - 3; x <= jx + 3; x++) for (const y of [362, 368]) { lit(BRASS[x < jx ? 4 : 2], x, y, 0, 0.6); put(x, y, 6); }
    for (let x = SPOUT.x - 3; x <= SPOUT.x + 3; x++) { lit(BRASS[1], x, SPOUT.y - 1, 0, 0.4); put(x, SPOUT.y - 1, 6); }
    // the wheel tap
    const wx = 134, wy = 357;
    for (let y = wy; y < 362; y++) { lit(BRASS[3], wx, y, 0, 0.6); put(wx, y, 6); }
    for (let x = wx - 5; x <= wx + 5; x++) { lit(BRASS[Math.abs(x - wx) === 5 ? 1 : x < wx ? 5 : 3], x, wy - 1, 0, 0.6); put(x, wy - 1, 6); lit(BRASS[1], x, wy, 0, 0.3); put(x, wy, 6); }
    lit(BRASS[5], wx, wy - 2, 0, 0.6); put(wx, wy - 2, 6);
    // the bowl's outer face
    for (let y = b.cy - b.ry - 4; y < 448; y++) for (let x = b.cx - b.rx - 4; x <= b.cx + b.rx + 4; x++) {
      const dx = (x + 0.5 - b.cx) / (b.rx + 3), dy = (y + 0.5 - b.cy) / (b.ry + 3);
      const rim = dx * dx + dy * dy;
      const bodyH = 448 - b.cy;
      let inBody = false, u = 0;
      if (y >= b.cy) { const taper = 1 - Math.pow((y - b.cy) / bodyH, 1.5) * 0.12; inBody = Math.abs(dx) < taper; u = dx / taper; }
      if (rim > 1 && !inBody) continue;
      const n = fbm(x / 4, y / 3, 320, 3);
      let c;
      if (rim <= 1) {
        const ri = (dx * dx * (b.rx + 3) * (b.rx + 3)) / (b.rx * b.rx) + (dy * dy * (b.ry + 3) * (b.ry + 3)) / ((b.ry - 1) * (b.ry - 1));
        if (ri < 1) continue; // water, drawn next
        let lam = 0.7 + (dy < 0 ? 0.15 : -0.1) + (n - 0.5) * 0.25;
        if (ri < 1.12) lam -= 0.35; // inner lip in shadow
        if (rim > 0.9) lam -= 0.25;
        c = ramp(STONE, lam);
      } else {
        const nz = Math.sqrt(Math.max(0, 1 - u * u));
        let lam = 0.12 + 0.6 * (nz * 0.6 - u * 0.4 + 0.1) - (y - b.cy) / bodyH * 0.25 + (n - 0.5) * 0.18;
        const yy = y - b.cy - b.ry;
        if (yy >= 0 && yy < 2) lam -= 0.3; // shadow under the lip
        if (yy === 9) lam += 0.12;
        c = ramp(STONE, lam);
      }
      c = c.slice();
      const mn = fbm(x / 7, y / 4, 321, 3);
      if (mn > 0.66 && (rim > 0.8 || y > 438)) c = P(mn > 0.72 ? 6 : 5).slice();
      if (mn < 0.3 && y > b.cy + 6) c = ramp(STONE, 0.15);
      lit(c, x, y, 0, 0.5); put(x, y, 7);
    }
    mossPad(b.cx - b.rx + 6, b.cy - 6, 6, 3, 8);
    mossPad(b.cx + b.rx - 10, b.cy + 2, 5, 2, 8);
    // a fern tucked behind the basin
    for (let k = 0; k < 9; k++) {
      const a = -Math.PI / 2 + (k - 4) * 0.32, L = 14 + (4 - Math.abs(k - 4)) * 3;
      for (let s = 0; s < L; s++) {
        const x = 236 + Math.cos(a) * s + (k - 4) * s * s * 0.012, y = 408 + Math.sin(a) * s + s * s * 0.02;
        lit(P(6), x, y, 0.5, 0.4); put(x, y, 6);
        if (s > 2 && s % 2 === 0) { const ln = Math.max(1, 3 - s / L * 2); for (let q = 1; q <= ln; q++) { lit(P(8), x - q, y + q * 0.3, 0.5, 0.4); put(x - q, y + q * 0.3, 6); lit(P(7), x + q, y + q * 0.3, 0.5, 0.4); put(x + q, y + q * 0.3, 6); } }
      }
    }
  }
  function waterAt(x, y) {
    const b = BASIN, dx = (x + 0.5 - b.cx) / b.rx, dy = (y + 0.5 - b.cy) / (b.ry - 1);
    return dx * dx + dy * dy < 1;
  }
  function buildWater() {
    const b = BASIN;
    for (let y = b.cy - b.ry; y <= b.cy + b.ry; y++) for (let x = b.cx - b.rx; x <= b.cx + b.rx; x++) {
      if (!waterAt(x, y)) continue;
      const dy = (y + 0.5 - b.cy) / (b.ry - 1);
      const q = (dy + 1) / 2;
      const n = fbm(x / 16, y / 2, 330, 2);
      // the far half mirrors the bright window; the near half looks down into dark water
      const refl = (1 - sstep(0.1, 0.6, q + (n - 0.5) * 0.25)) * 0.5;
      const r0 = lerp(30, 150, refl), g0 = lerp(46, 162, refl), b0 = lerp(46, 168, refl);
      const r1 = lerp(48, 236, refl), g1 = lerp(54, 206, refl), b1 = lerp(42, 150, refl);
      L0[0] = r0; L0[1] = g0; L0[2] = b0; L1[0] = r1; L1[1] = g1; L1[2] = b1;
      // reflections of the mullions as darker bands
      const mx = ((x - b.cx) * 3 + 400) % 117;
      if (mx < 9 && refl > 0.3) { const k = 0.72; L0[0] *= k; L0[1] *= k; L0[2] *= k; L1[0] *= k; L1[1] *= k; L1[2] *= k; }
      // a dark rim of shadow just inside the lip
      const dx = (x + 0.5 - b.cx) / b.rx; if (dx * dx + dy * dy > 0.86) { L0[0] *= 0.7; L0[1] *= 0.7; L0[2] *= 0.7; L1[0] *= 0.7; L1[1] *= 0.7; L1[2] *= 0.7; }
      put(x, y, 7);
    }
    // a lily pad and a fallen leaf
    for (let y = 410; y < 430; y++) for (let x = 180; x < 222; x++) {
      const dx = (x + 0.5 - 201) / 11, dy = (y + 0.5 - 422) / 4.2, d = dx * dx + dy * dy;
      if (d > 1) continue;
      const ang = Math.atan2(dy, dx);
      if (ang > -0.35 && ang < 0.05) continue;
      let c = P(d > 0.72 ? (dy < 0 ? 7 : 3) : 6);
      if (Math.abs(Math.sin(ang * 4)) < 0.15 && d < 0.75) c = P(5);
      if (d < 0.25 && dx < 0) c = P(7);
      lit(c, x, y, 0.2, 0.7); put(x, y, 8);
    }
    for (let k = 0; k < 6; k++) { lit(P(k < 3 ? 36 : 35), 132 + k, 426 + (k > 2 ? 1 : 0), 0, 0.5); put(132 + k, 426 + (k > 2 ? 1 : 0), 8); }
  }
  function buildCan() {
    // a zinc watering can on the floor: ribbed body, domed top, a long spout with a rose
    const cx = 314, top = 398, bot = 440, rx = 25;
    const ZINC = [P(26), P(27), P(28), P(29), P(30), P(31)];
    // the spout first, behind the body
    const sp = [cx - 20, 432, cx - 34, 420, cx - 50, 400, cx - 62, 384];
    tube(sp, 2.6, 1.5, (x, y, s, v, e) => { lit(e ? ZINC[0] : ramp(ZINC, 0.55 - v * 0.4), x, y, 0, 0.5); put(x, y, 7); }, 7);
    // the rose, a flat cap facing up and out
    for (let y = 370; y < 390; y++) for (let x = cx - 74; x < cx - 52; x++) {
      const ox = x + 0.5 - (cx - 63), oy = y + 0.5 - 380;
      const ax = ox * 0.8 + oy * 0.6, ay = -ox * 0.6 + oy * 0.8;
      const d = (ax / 4.2) * (ax / 4.2) + (ay / 6.5) * (ay / 6.5);
      if (d > 1) continue;
      let c = ramp(ZINC, 0.75 - ay / 12);
      if (d > 0.72) c = ZINC[1];
      else if (ax < -1.2 && ((x * 2 + y) % 3 === 0)) c = ZINC[0];
      lit(c, x, y, 0, 0.6); put(x, y, 7);
    }
    // body
    for (let y = top; y < bot; y++) for (let x = cx - rx; x <= cx + rx; x++) {
      const u = (x + 0.5 - cx) / rx;
      if (Math.abs(u) > 1) continue;
      const yy = y - top;
      if (yy > bot - top - 3 && Math.abs(u) > 0.94) continue;
      const nz = Math.sqrt(1 - u * u);
      let lam = 0.2 + 0.7 * (nz * 0.65 - u * 0.5 + 0.2) - yy / (bot - top) * 0.12;
      const rib = yy % 14;
      if (rib === 4) lam += 0.2; else if (rib === 5) lam -= 0.18;
      if (yy < 2) lam += 0.15;
      const n = fbm(x / 4, y / 3, 340, 3);
      lam += (n - 0.5) * 0.1;
      let c = ramp(ZINC, lam);
      if (Math.abs(u) > 0.95) c = ZINC[0];
      if (Math.abs(x - (cx + 9)) < 0.6) c = ZINC[1]; // the seam
      if (n > 0.7) c = [lerp(c[0], 214, 0.3), lerp(c[1], 216, 0.3), lerp(c[2], 210, 0.3)];
      lit(c, x, y, 0, 0.6); put(x, y, 8);
    }
    // the domed top with its filling hole
    for (let y = top - 8; y < top; y++) for (let x = cx - rx; x <= cx + rx; x++) {
      const ox = (x + 0.5 - cx) / rx, oy = (y + 0.5 - top) / 8;
      if (ox * ox + oy * oy > 1) continue;
      let c = ramp(ZINC, 0.6 - ox * 0.35 - oy * 0.25);
      if (ox * ox + oy * oy > 0.86) c = ZINC[1];
      const hx0 = (x + 0.5 - (cx + 8)) / 7, hy0 = (y + 0.5 - (top - 4)) / 2.4;
      if (hx0 * hx0 + hy0 * hy0 < 1) c = hx0 * hx0 + hy0 * hy0 > 0.55 ? ZINC[4] : P(26);
      lit(c, x, y, 0, 0.7); put(x, y, 8);
    }
    // the carrying handle over the top and the back handle
    for (let a = 0; a <= Math.PI; a += 0.015) {
      const x = cx + 6 + Math.cos(a) * 17, y = top - 6 - Math.sin(a) * 16;
      lit(ZINC[4], x, y - 1, 0, 0.7); put(x, y - 1, 8); lit(ZINC[2], x, y, 0, 0.4); put(x, y, 8); lit(ZINC[0], x, y + 1, 0, 0.2); put(x, y + 1, 8);
    }
    for (let a = -1.3; a <= 1.3; a += 0.02) {
      const x = cx + rx - 2 + Math.cos(a) * 9, y = top + 16 + Math.sin(a) * 12;
      lit(ZINC[3], x, y, 0, 0.5); put(x, y, 8); lit(ZINC[0], x + 1, y, 0, 0.2); put(x + 1, y, 8);
    }
    // its shadow and a little wet ring on the tiles
    for (let x = cx - rx - 4; x < cx + rx + 8; x++) for (let y = bot; y < bot + 3; y++) { const i = y * W + x; if (y >= H || SZ[i] > 1) continue; lit(P(y === bot ? 0 : 40), x, y, 0, 0); put(x, y, 1); }
  }

  /* ================================================================ drops on the glass */
  let BEADS = [], DROPS = [];
  function onGlass(x, y) { x = fl(x); y = fl(y); return x >= 0 && y >= 0 && x < W && y < H && GLM[y * W + x] === 1; }
  function buildDrops() {
    const R = mulberry32(9001);
    BEADS = []; DROPS = [];
    while (BEADS.length < 4400) {
      const x = R() * W, y = BEAM + R() * (SILL0 - BEAM);
      if (!onGlass(x, y)) continue;
      if (y > 236 && R() < 0.5) continue;
      BEADS.push({ x: fl(x), y: fl(y), ph: R(), life: 0.18 + R() * 0.3, big: R() < 0.3, faint: R() < 0.5, k: (R() * 1e6) | 0, grow: 0.2 + R() * 0.5 });
    }
    while (DROPS.length < 1000) {
      const x = R() * W, y = BEAM + R() * (SILL0 - BEAM - 24);
      if (!onGlass(x, y) || !onGlass(x - 2, y) || !onGlass(x + 2, y)) continue;
      const slider = R() < 0.34;
      const big = R();
      const d = { x: x, y: y, ph: R(), rmax: slider ? 2.4 + R() * 1.9 : 1.5 + big * big * 3.2, grow: 2 + R() * 6, hold: 0.3 + R() * 3, slider, life: 0.3 + R() * 0.28, k: (R() * 1e6) | 0 };
      if (slider) {
        d.v = 6 + R() * 12; d.om = TAU / (1.1 + R() * 2.4); d.b = 0.72 + R() * 0.24;
        d.a1 = 1.2 + R() * 2.6; d.l1 = 8 + R() * 10; d.p1 = R() * TAU; d.a2 = 0.5 + R() * 1.0; d.l2 = 3 + R() * 3; d.p2 = R() * TAU; d.dr = (R() - 0.5) * 0.08;
        // how far can it run before it meets iron?
        let s = 0;
        for (; s < 300; s += 0.5) { const yy = d.y + s, xx = pathX(d, s); if (!onGlass(xx, yy + d.rmax + 0.5) || !onGlass(xx - 1.5, yy) || !onGlass(xx + 1.5, yy)) break; }
        d.smax = Math.max(0, s - 0.5);
        if (d.smax < 6) d.slider = false;
      }
      DROPS.push(d);
    }
  }
  function pathX(d, s) { return d.x + d.a1 * (Math.sin(s / d.l1 + d.p1) - Math.sin(d.p1)) + d.a2 * (Math.sin(s / d.l2 + d.p2) - Math.sin(d.p2)) + d.dr * s; }
  function slideS(d, tau) { return d.v * (tau - (d.b / d.om) * Math.sin(d.om * tau)); }

  // the lit garden at an integer pixel
  let SR = 0, SGc = 0, SB = 0;
  function sampleO(x, y) {
    x = clamp(fl(x), 0, W - 1); y = clamp(fl(y), 0, H - 1);
    const j = (y * W + x) * 3;
    SR = Q0[j] + (Q1[j] - Q0[j]) * WL; SGc = Q0[j + 1] + (Q1[j + 1] - Q0[j + 1]) * WL; SB = Q0[j + 2] + (Q1[j + 2] - Q0[j + 2]) * WL;
  }
  function gput(x, y, r, g, b) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (SZ[i] !== 0 || !GLM[i]) return;
    const j = i * 3; C[j] = r; C[j + 1] = g; C[j + 2] = b;
  }
  // a drop is a tiny lens: it shows the garden upside down and a little brighter, with a dark lower rim
  function drawDrop(cx, cy, r, elong) {
    const ix = Math.round(cx), iy = Math.round(cy);
    const R = Math.ceil(r), up = Math.ceil(r * elong);
    const hx0 = -Math.max(1, Math.round(r * 0.4)), hy0 = -Math.max(1, Math.round(r * elong * 0.45));
    for (let dy = -up; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const nx = dx / r, ny = dy > 0 ? dy / r : dy / (r * elong);
      const d2 = nx * nx + ny * ny;
      if (d2 > 1 + 0.4 / r) continue;
      // a wide, inverted view: the sky lands in the bottom of the drop, the trees and lawn at the top
      sampleO(ix - nx * 14, iy - ny * 26 + 6);
      let k = 1.16, add = 16 - ny * 6;
      const edge = d2 > 0.42 + 0.1 * r;
      if (edge && ny > 0.2) { k = 0.46; add = -2; }              // the dark meniscus along the bottom
      else if (edge && ny > -0.35) { k = 0.78; add = 0; }        // darker flanks
      else if (edge) { k = 1.02; add = 10; }                     // a pale top edge
      let rr = SR * k + add, gg = SGc * k + add, bb = SB * k + add;
      if ((dx === hx0 && dy === hy0) || (r >= 3 && dx === hx0 + 1 && dy === hy0)) { rr = lerp(242, 255, WL); gg = lerp(246, 246, WL); bb = lerp(244, 214, WL); }
      else if (r >= 2.5 && dy === Math.round(r * 0.55) - 1 && Math.abs(dx) <= (r >= 3.5 ? 1 : 0)) { rr += 26; gg += 24; bb += 20; }
      gput(ix + dx, iy + dy, rr, gg, bb);
    }
  }
  function bead(x, y, big, faint) {
    const j = (y * W + x) * 3;
    if (faint) { gput(x, y, C[j] * 1.06 + 14, C[j + 1] * 1.06 + 14, C[j + 2] * 1.06 + 14); return; }
    sampleO(x, y + 8);
    gput(x, y, SR * 1.2 + 30, SGc * 1.2 + 30, SB * 1.16 + 28);
    if (big) {
      const j2 = j + W * 3, j3 = j2 + 3;
      gput(x, y + 1, C[j2] * 0.62, C[j2 + 1] * 0.62, C[j2 + 2] * 0.66);
      if (big > 1) { gput(x + 1, y, SR * 1.06 + 12, SGc * 1.06 + 12, SB * 1.04 + 12); gput(x + 1, y + 1, C[j3] * 0.7, C[j3 + 1] * 0.7, C[j3 + 2] * 0.74); }
    }
  }

  /* ================================================================ live layers */
  const VINES = [];
  function buildVines() {
    const R = mulberry32(5150);
    for (let k = 0; k < 9; k++) {
      VINES.push({ x: 164 + k * 3 + R() * 2, y: 50 + R() * 6, L: 40 + R() * (k % 3 === 1 ? 140 : 80), ph: R() * TAU, A: 1.6 + R() * 1.8, f: k % 2 ? 1 : 2, seed: k, lean: (k - 4) * 0.06 });
    }
    // a few tendrils hanging from the ivy swags
    for (const x of [44, 82, 268, 312, 338]) VINES.push({ x, y: BEAM + 12 + R() * 8, L: 18 + R() * 30, ph: R() * TAU, A: 1.2, f: 1, seed: 20 + x, lean: 0 });
  }
  const VLEAF = [
    '.aa.aa.',
    'abbabba',
    'abbcbba',
    '.abcba.',
    '..aca..',
    '...a...',
  ];
  function drawVines(t) {
    for (const v of VINES) {
      let px = v.x, py = v.y;
      const n = Math.ceil(v.L);
      for (let s = 0; s <= n; s++) {
        const q = s / v.L;
        const sw = v.A * Math.pow(q, 1.6) * Math.sin(TAU * v.f * t / D + v.ph + q * 0.8) + v.lean * s;
        const x = v.x + sw, y = v.y + s;
        lit(P(s % 5 === 0 ? 42 : 6), x, y, 0.3, 0.3); put(x, y, 2);
        if (s > 3 && s % 6 === (v.seed % 6)) {
          const side = ((s / 6) | 0) % 2 ? 1 : -1, h = ih(s, v.seed, 400);
          const lx = Math.round(x + side * 3), ly = Math.round(y);
          const small = h < 0.35;
          for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
            const ch = VLEAF[r][side > 0 ? c : 6 - c];
            if (ch === '.') continue;
            if (small && (r === 0 || c === 0 || c === 6 || r === 5)) continue;
            const k = ch === 'a' ? (h < 0.5 ? 5 : 6) : ch === 'b' ? (h < 0.6 ? 7 : 8) : 9;
            lit(P(k), lx - 3 + c, ly + r, 0.6, 0.6); put(lx - 3 + c, ly + r, 2);
          }
        }
        px = x; py = y;
      }
    }
  }
  // tree-fern croziers: furled in the grey, opening toward the warm light
  const CROZ = [[294, 146, -2.0, 36], [301, 143, -1.62, 44], [309, 146, -1.12, 34]];
  function drawCroziers(t) {
    const w = WL;
    CROZ.forEach((cz, idx) => {
      const curl = 1 - 0.62 * w;
      const L = cz[3] * (0.78 + 0.22 * w);
      let x = cz[0], y = cz[1], a = cz[2];
      const ds = 0.5, steps = Math.ceil(L / ds);
      const K = curl * 4 * 3.2 * Math.PI / L;
      const dir = idx === 0 ? -1 : 1;
      for (let k = 0; k <= steps; k++) {
        const s = k * ds, q = s / L;
        const kap = K * q * q * q;
        a += dir * kap * ds;
        x += Math.cos(a) * ds; y += Math.sin(a) * ds;
        const rad = 2.3 - q * 1.2;
        for (let oy = -3; oy <= 3; oy++) for (let ox = -3; ox <= 3; ox++) {
          if (ox * ox + oy * oy > rad * rad + 0.3) continue;
          const lightSide = (ox * Math.cos(a + Math.PI / 2) + oy * Math.sin(a + Math.PI / 2)) * dir < 0;
          lit(P(q > 0.6 && curl > 0.6 ? (lightSide ? 35 : 42) : lightSide ? 8 : 6), x + ox, y + oy, 0.5, 0.8); put(x + ox, y + oy, 4);
        }
        // the hairy brown fur of a tree-fern crozier
        if (k % 3 === 0) {
          const nx = -Math.sin(a) * dir, ny = Math.cos(a) * dir;
          lit(P(ih(k, idx, 410) < 0.5 ? 43 : 35), x + nx * (rad + 1), y + ny * (rad + 1), 0.4, 0.8); put(x + nx * (rad + 1), y + ny * (rad + 1), 4);
        }
        // pinnae unfold on the part that has straightened
        if (k % 4 === 2 && kap < 0.08 && q > 0.15) {
          const pl = Math.min(4, (0.08 - kap) * 60) * (1 - q * 0.6);
          for (const side of [-1, 1]) for (let m = 1; m <= pl; m++) {
            const xx = x + Math.cos(a + side * 1.0) * m, yy = y + Math.sin(a + side * 1.0) * m;
            lit(P(m > pl - 1 ? 9 : 7), xx, yy, 0.6, 0.7); put(xx, yy, 4);
          }
        }
      }
    });
  }
  // the spout drips every three seconds; rings spread on the basin
  const DRIP_P = 3;
  function drawDrip(t) {
    const b = BASIN;
    const hitY = 414;
    for (let back = 0; back < 2; back++) {
      const u0 = t / DRIP_P, n = fl(u0) - back, a = (u0 - fl(u0) + back) * DRIP_P;
      // forming at the spout lip
      if (back === 0) {
        if (a < 2.4) {
          const r = 0.6 + a / 2.4 * 1.4;
          for (let dy = 0; dy <= Math.ceil(r * 1.6); dy++) for (let dx = -1; dx <= 1; dx++) { if (Math.abs(dx) > r) continue; lit(P(dy === 0 ? 31 : dx < 0 ? 33 : 30), SPOUT.x + dx, SPOUT.y + dy, 0.2, 0.5); put(SPOUT.x + dx, SPOUT.y + dy, 9); }
        } else if (a < 2.4 + 0.42) {
          const ft = a - 2.4, y = SPOUT.y + 2 + 0.5 * 175 * ft * ft;
          if (y < hitY) for (let dy = -2; dy <= 1; dy++) { lit(P(dy < 0 ? 31 : 33), SPOUT.x, y + dy, 0.2, 0.5); put(SPOUT.x, y + dy, 9); }
        }
      }
      // rings: age since impact
      const tImp = 2.4 + Math.sqrt(2 * (hitY - SPOUT.y - 2) / 175);
      const age = a - tImp;
      if (age < 0 || age > 4.5) continue;
      if (age < 0.25) { for (let k = -2; k <= 2; k++) { lit(P(33), SPOUT.x + k * 1.5, hitY - 1 - (2 - Math.abs(k)) * age * 12, 0, 0.4); put(SPOUT.x + k * 1.5, hitY - 1 - (2 - Math.abs(k)) * age * 12, 9); } }
      for (let ring = 0; ring < 3; ring++) {
        const ra = age - ring * 0.55;
        if (ra <= 0) continue;
        const R = 2 + ra * 9, fade = 1 - ra / 3.6;
        if (fade <= 0) continue;
        const n = Math.ceil(R * 7);
        for (let k = 0; k < n; k++) {
          const ang = k / n * TAU, x = Math.round(SPOUT.x + Math.cos(ang) * R), y = Math.round(hitY + Math.sin(ang) * R * 0.26);
          if (!waterAt(x, y)) continue;
          if (ih(k, ring, 420 + n) > fade + 0.1) continue;
          const i = y * W + x;
          if (Z[i] > 8) continue;
          const j = i * 3, up = Math.sin(ang) < 0, f = fade * (up ? 1 : 0.6);
          C[j] = C[j] * (1 + (up ? 0.3 : -0.25) * f) + (up ? 34 : 0) * f; C[j + 1] = C[j + 1] * (1 + (up ? 0.3 : -0.25) * f) + (up ? 34 : 0) * f; C[j + 2] = C[j + 2] * (1 + (up ? 0.28 : -0.22) * f) + (up ? 30 : 0) * f;
        }
      }
    }
  }
  // dust turning slowly in the sunbeams
  const MOTES = [];
  function buildMotes() {
    const R = mulberry32(777);
    while (MOTES.length < 70) {
      const x = R() * W, y = 40 + R() * 300;
      if (SH[fl(y) * W + fl(x)] < 0.35) continue;
      MOTES.push({ x, y, ax: 4 + R() * 8, ay: 3 + R() * 8, kx: 1 + fl(R() * 2), ky: 1 + fl(R() * 2), px: R() * TAU, py: R() * TAU, tw: R() * TAU });
    }
  }
  function drawMotes(t) {
    if (WL < 0.05) return;
    for (const m of MOTES) {
      const x = Math.round(m.x + m.ax * Math.sin(TAU * m.kx * t / D + m.px)), y = Math.round(m.y + m.ay * Math.sin(TAU * m.ky * t / D + m.py) + 5 * Math.sin(TAU * t / D + m.tw));
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x, s = SH[i] * WL * WL * (0.6 + 0.4 * Math.sin(TAU * 3 * t / D + m.tw));
      if (s < 0.25) continue;
      const j = i * 3;
      C[j] += 60 * s; C[j + 1] += 50 * s; C[j + 2] += 26 * s;
    }
  }
  // rain falling in the garden, faint behind the glass
  function drawRainOutside(t, rain) {
    const n = Math.round(46 * rain);
    for (let k = 0; k < n; k++) {
      const x0 = ih(k, 1, 500) * (W + 40), sp = 14 + fl(ih(k, 2, 500) * 4);
      const y0 = (ih(k, 3, 500) * 520 + t * sp * 520 / D) % 520 - 40;
      for (let s = 0; s < 12; s++) {
        const y = fl(y0 + s), x = fl(x0 - (y0 + s) * 0.08);
        if (y < 0 || y >= SILL0 || x < 0 || x >= W) continue;
        const i = y * W + x;
        if (SZ[i] || !GLM[i]) continue;
        const j = i * 3;
        C[j] += 7; C[j + 1] += 7; C[j + 2] += 8;
      }
    }
  }

  /* ================================================================ frame */
  function drawFrame(t, g, cw, ch, k, ox, oy) {
    t = ((t % D) + D) % D;
    WL = lightAt(t);
    const w = WL, rain = rainAt(t);
    // 1. static scene and the garden
    for (let i = 0, j = 0; i < NP; i++, j += 3) {
      if (SZ[i]) { C[j] = S0[j] + (S1[j] - S0[j]) * w; C[j + 1] = S0[j + 1] + (S1[j + 1] - S0[j + 1]) * w; C[j + 2] = S0[j + 2] + (S1[j + 2] - S0[j + 2]) * w; }
      else { C[j] = O0[j] + (O1[j] - O0[j]) * w; C[j + 1] = O0[j + 1] + (O1[j + 1] - O0[j + 1]) * w; C[j + 2] = O0[j + 2] + (O1[j + 2] - O0[j + 2]) * w; }
    }
    Z.set(SZ);
    drawRainOutside(t, rain);
    // 2. sliders: channels through the beaded glass
    PASS.fill(1e9);
    const live = [];
    for (const d of DROPS) {
      for (let back = 0; back < 2; back++) {
        const u = t / D - d.ph, n = fl(u) - back, ts = (n + d.ph) * D, a = t - ts;
        if (a < 0) continue;
        if (ih(d.k, ((n % 1) + 1) % 1, 7) > rainAt(((ts % D) + D) % D) + 0.08) continue;
        live.push([d, a]);
      }
    }
    for (const e of live) {
      const d = e[0], a = e[1];
      if (!d.slider) continue;
      const t0 = d.grow + d.hold;
      const tau = a - t0;
      if (tau <= 0) continue;
      // march the run, recording when each row was passed
      const hw = Math.max(1, Math.round(d.rmax - 0.6));
      let lastRow = -1;
      for (let tt = 0; tt <= tau; tt += 1 / 30) {
        const s = Math.min(d.smax, slideS(d, tt));
        const row = fl(d.y + s);
        if (row === lastRow) { if (s >= d.smax) break; continue; }
        lastRow = row;
        const x = Math.round(pathX(d, s)), age = tau - tt;
        if (age > 14) continue;
        for (let dx = -hw; dx <= hw; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= W || row < 0 || row >= H) continue;
          const i = row * W + xx;
          if (age < PASS[i]) PASS[i] = age;
        }
        if (s >= d.smax) break;
      }
    }
    // the mist bank breathes and drifts a little, back and forth
    {
      const off = 16 + Math.round(12 * Math.sin(TAU * t / D)), amt = 0.34 - 0.12 * w;
      const mr = lerp(178, 232, w), mg = lerp(186, 214, w), mb = lerp(190, 170, w);
      for (let n = 0; n < GLIST.length; n++) {
        const i = GLIST[n], y = (i / W) | 0, x = i - y * W;
        const m = MIST[y * (W + 32) + x + off] * amt;
        if (m < 0.01) continue;
        const j = i * 3;
        C[j] += (mr - C[j]) * m; C[j + 1] += (mg - C[j + 1]) * m; C[j + 2] += (mb - C[j + 2]) * m;
      }
    }
    // 3. wet haze over the glass, cleared where a slider has just run
    const hz = 0.2 - 0.06 * w, hr = lerp(196, 234, w), hg = lerp(202, 218, w), hb = lerp(204, 184, w);
    for (let n = 0; n < GLIST.length; n++) {
      const i = GLIST[n], j = i * 3;
      const p = PASS[i];
      let h = hz;
      if (p < 1e8) {
        h *= sstep(1.2, 12, p);
        if (p < 3) { C[j] += 8 * (1 - p / 3); C[j + 1] += 8 * (1 - p / 3); C[j + 2] += 8 * (1 - p / 3); }
      }
      C[j] += (hr - C[j]) * h; C[j + 1] += (hg - C[j + 1]) * h; C[j + 2] += (hb - C[j + 2]) * h;
    }
    // 4. beads: tiny clinging droplets, wiped by any slider that passed after they landed
    for (const b of BEADS) {
      for (let back = 0; back < 2; back++) {
        const u = t / D - b.ph, n = fl(u) - back, ts = (n + b.ph) * D, a = t - ts;
        if (a < 0 || a > b.life * D) continue;
        if (ih(b.k, 1, 8) > rainAt(((ts % D) + D) % D) + 0.05) continue;
        const i = b.y * W + b.x;
        if (PASS[i] < a) continue;
        bead(b.x, b.y, b.big && a > b.grow * b.life * D ? (b.k & 3) === 0 ? 2 : 1 : 0, b.faint);
      }
    }
    // fresh trails: a thin wet line and a string of left-behind beads
    for (const e of live) {
      const d = e[0], a = e[1];
      if (!d.slider) continue;
      const tau = a - d.grow - d.hold;
      if (tau <= 0) continue;
      const sNow = Math.min(d.smax, slideS(d, tau));
      for (let s = 0; s < sNow - d.rmax - 4; s += 1) {
        const yy = fl(d.y + s), xx = Math.round(pathX(d, s));
        if (yy < 0 || yy >= H || xx < 0 || xx >= W) continue;
        const i = yy * W + xx, p = PASS[i];
        if (p > 11) continue;
        const h = ih(d.k, s, 9);
        if (h < 0.16) { const bx = xx + (h < 0.05 ? -1 : h < 0.1 ? 1 : 0); bead(bx, yy, h < 0.03, false); continue; }
        if (p < 9) {
          const f = (1 - p / 9), j = i * 3;
          gput(xx, yy, C[j] * (1 + 0.1 * f) + 16 * f, C[j + 1] * (1 + 0.1 * f) + 16 * f, C[j + 2] * (1 + 0.1 * f) + 15 * f);
          if (p < 4) { const xs = xx + (pathX(d, s + 2) > pathX(d, s) ? -1 : 1), j2 = (yy * W + xs) * 3; if (xs >= 0 && xs < W) gput(xs, yy, C[j2] * (1 - 0.14 * (1 - p / 4)), C[j2 + 1] * (1 - 0.14 * (1 - p / 4)), C[j2 + 2] * (1 - 0.12 * (1 - p / 4))); }
        }
      }
    }
    // 5. drops and sliders
    for (const e of live) {
      const d = e[0], a = e[1];
      const end = d.life * D;
      if (a > end + 1.5) continue;
      let r = d.rmax * Math.min(1, Math.pow(a / d.grow, 0.6));
      if (a > end) r = d.rmax * (1 - (a - end) / 1.5);
      let x = d.x, y = d.y, el = 0.88;
      if (d.slider && a > d.grow + d.hold) {
        const tau = a - d.grow - d.hold, s = Math.min(d.smax, slideS(d, tau));
        x = pathX(d, s); y = d.y + s;
        const moving = s < d.smax;
        if (a <= end) r = d.rmax + 0.6 * Math.min(1, s / 70);
        el = moving ? 1.6 : 0.85;
        if (moving) {
          // water drawn out behind the head
          for (let q = 1; q <= 5; q++) { const yy = Math.round(y - r * el - q), xx = Math.round(pathX(d, Math.max(0, s - r * el - q))); sampleO(xx, yy + 8); gput(xx, yy, SR * 1.1 + 10, SGc * 1.1 + 10, SB * 1.08 + 10); }
        }
      } else {
        // a still drop sitting where a slider passed is swallowed into it
        const i = fl(y) * W + fl(x);
        if (PASS[i] < a) continue;
      }
      r = Math.round(r * 2) / 2;
      if (r < 0.5) continue;
      if (r <= 1) { bead(Math.round(x), Math.round(y), true, false); continue; }
      drawDrop(x, y, r, el);
    }
    // 6. condensation on the inside of the lower panes
    const fr = lerp(206, 236, w), fg = lerp(212, 222, w), fb = lerp(212, 196, w), fk = 1 - 0.28 * w;
    for (let n = 0; n < GLIST.length; n++) {
      const i = GLIST[n], f = FOG[i] * fk;
      if (f <= 0.01) continue;
      const j = i * 3, sp = (ih(i, 0, 600) - 0.5) * 22 * f;
      C[j] += (fr + sp - C[j]) * f; C[j + 1] += (fg + sp - C[j + 1]) * f; C[j + 2] += (fb + sp - C[j + 2]) * f;
    }
    // 7. live interior
    MODE = 1;
    drawVines(t);
    drawCroziers(t);
    drawDrip(t);
    MODE = 0;
    // 8. sunbeams in the air
    if (w > 0.01) {
      const br = 30 * w, bg = 23 * w, bb = 8 * w;
      for (let i = 0, j = 0; i < NP; i++, j += 3) { const s = SH[i]; if (s < 0.02) continue; C[j] += br * s; C[j + 1] += bg * s; C[j + 2] += bb * s; }
    }
    drawMotes(t);
    present(g, cw, ch, k, ox, oy);
  }

  /* ================================================================ present */
  let SMALL = null, SG = null, IMG = null, PIX = null;
  const LE = new Uint8Array(new Uint32Array([0x01020304]).buffer)[0] === 4;
  const PACK = new Uint32Array(PAL.length);
  function present(g, cw, ch, k, ox, oy) {
    if (!SMALL) {
      SMALL = document.createElement('canvas'); SMALL.width = W; SMALL.height = H;
      SG = SMALL.getContext('2d'); IMG = SG.createImageData(W, H); PIX = new Uint32Array(IMG.data.buffer);
      for (let n = 0; n < PAL.length; n++) { const p = PAL[n]; PACK[n] = (LE ? ((255 << 24) | (p[2] << 16) | (p[1] << 8) | p[0]) : ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | 255)) >>> 0; }
    }
    for (let y = 0, i = 0; y < H; y++) {
      const by = (y & 3) << 2;
      for (let x = 0; x < W; x++, i++) {
        const j = i * 3, dth = (BAY[by | (x & 3)] - 0.5) * 12;
        let r = C[j] + dth, gg = C[j + 1] + dth, b = C[j + 2] + dth;
        r = r < 0 ? 0 : r > 255 ? 255 : r; gg = gg < 0 ? 0 : gg > 255 ? 255 : gg; b = b < 0 ? 0 : b > 255 ? 255 : b;
        PIX[i] = PACK[(Z[i] === 0 ? LUTO : LUT)[((r >> 3) << 10) | ((gg >> 3) << 5) | (b >> 3)]];
      }
    }
    SG.putImageData(IMG, 0, 0);
    if (!g) return;
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#121816'; g.fillRect(0, 0, cw, ch);
    g.drawImage(SMALL, ox, oy, W * k, H * k);
  }

  /* ================================================================ build */
  function build() {
    buildLUT();
    buildFields();
    buildIronShapes();
    buildGlassMask();
    buildOutside();
    MODE = 0;
    shadeIron();
    buildFog();
    buildRoom();
    buildPlants();
    AMBO = 0.7;
    buildBasin();
    buildWater();
    AMBO = 0.6;
    buildCan();
    AMBO = 0;
    const gl = [];
    for (let i = 0; i < NP; i++) if (!SZ[i] && GLM[i]) gl.push(i);
    GLIST = new Int32Array(gl);
    buildDrops();
    buildVines();
    buildMotes();
  }

  /* ================================================================ mount */
  (window.PIECES = window.PIECES || []).push({
    id: 'glasshouse',
    title: 'The Glasshouse',
    medium: 'Pixel art in 48 colours, 360 × 450, drawn in JavaScript · 24 s loop',
    note: 'Soft rain on the glass · tap to pause',
    about: 'Inside a Victorian glasshouse while it rains. Through the arched panes and the cream ironwork the garden is grey and misted; on the glass hundreds of drops land, swell, cling and then slide down in wandering streaks, each one a tiny lens holding the garden upside down. As the rain eases the light warms to gold and the tree fern’s croziers open toward it, then the grey comes back and the rain with it.',
    tone: 'dark',
    room: '#121816',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      SEED = 7; // the room is composed for one seed
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0, built = false;
      el.style.background = '#121816';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;image-rendering:pixelated;image-rendering:crisp-edges;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(243,237,220,.85)"/><rect x="19" y="9" width="5" height="16" fill="rgba(243,237,220,.85)"/></svg>';
      el.appendChild(pauseMark);
      let K = 3, CW = W * 3, CH = H * 3, OX = 0, OY = 0;
      function layout() {
        const dpr = Math.min(3, window.devicePixelRatio || 1);
        let left = 0, top = 0, cssW, cssH;
        if (EXPORT) {
          cssW = 1080; cssH = 1350; cv.style.position = 'fixed';
          K = Math.max(1, Math.round(3 * dpr)); CW = Math.round(1080 * dpr); CH = Math.round(1350 * dpr);
          OX = 0; OY = 0;
        } else {
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          const fit = Math.min(w * dpr / W, h * dpr / H) * 0.97;
          K = Math.max(1, Math.floor(fit));
          let show = K;
          if (K < fit * 0.88) { K = Math.max(1, Math.ceil(fit)); show = fit; }
          CW = W * K; CH = H * K; OX = 0; OY = 0;
          cssW = W * show / dpr; cssH = H * show / dpr;
          left = Math.round((w - cssW) / 2); top = Math.round((h - cssH) / 2);
        }
        if (cv.width !== CW || cv.height !== CH) { cv.width = CW; cv.height = CH; }
        cv.style.left = left + 'px'; cv.style.top = top + 'px'; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
        pauseMark.style.left = (left + cssW - 48) + 'px'; pauseMark.style.top = (top + 14) + 'px';
      }
      const draw = (t) => drawFrame(t, g, CW, CH, K, OX, OY);
      layout();
      build();
      built = true;
      draw(0);
      if (EXPORT) {
        const faded = () => { const st = el.parentElement; return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999; };
        window.__glasshouse = {
          duration: D,
          isReady: () => built && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); draw(t); window.__glasshouse.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'glasshouse';
        api.ready();
      } else {
        window.__glasshouse = { duration: D, isReady: () => built, renderAt(t) { return new Promise((res) => { playing = false; clock = t; draw(t); requestAnimationFrame(() => res()); }); } };
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
          if (window.__glasshouse) delete window.__glasshouse;
        },
      };
    },
  });
})();
