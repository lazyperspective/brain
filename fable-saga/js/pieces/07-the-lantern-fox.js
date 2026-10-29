/* The Lantern Fox — a Fable Saga Christmas short.
 *
 * Christmas Eve, blue dusk. A fox kit finds an old brass lantern still burning in the snow and carries it through the
 * woods, across a frozen waterfall and an aurora meadow, to a lighthouse whose lamp has gone out, and an old keeper
 * who has given up. Every frame is a pure function of t, drawn into a 480 × 270 indexed buffer and shown at 4×.
 * Built from the parts in fable-saga/production/lanternfox/src.
 */
(function () {
  'use strict';
  /* ================================================================ constants & helpers */
  const W = 480, H = 270, NP = W * H, D = 36;
  const TAU = Math.PI * 2, PI = Math.PI, fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const lin = (a, b, x) => clamp((x - a) / (b - a), 0, 1);
  const frac = (x) => x - Math.floor(x);
  const eoc = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
  const eic = (u) => Math.pow(clamp(u, 0, 1), 3);
  const eio = (u) => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const eis = (u) => { u = clamp(u, 0, 1); return 0.5 - 0.5 * Math.cos(PI * u); };     // sine in-out
  const eob = (u) => { u = clamp(u, 0, 1); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
  const SEED = 41;
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(((c | 0) + SEED * 7919) | 0, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function vn(x, y, c, s) {
    const gx = x / c, gy = y / c, i = fl(gx), j = fl(gy), fx = gx - i, fy = gy - j;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    return lerp(lerp(ih(i, j, s), ih(i + 1, j, s), ux), lerp(ih(i, j + 1, s), ih(i + 1, j + 1, s), ux), uy);
  }
  function fbm(x, y, c, oct, s) { let v = 0, a = 1, n = 0; for (let k = 0; k < oct; k++) { v += a * vn(x, y, c, s + k * 31); n += a; a *= 0.5; c *= 0.5; } return v / n; }
  // 1-D smooth noise in [-1, 1] (for wobble, wind, sway)
  const n1 = (x, s) => { const i = fl(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(ih(i, 7, s), ih(i + 1, 7, s), u) * 2 - 1; };
  const B8 = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21].map((v) => (v + 0.5) / 64);
  const bay = (x, y) => B8[((y & 7) << 3) | (x & 7)];
  const BAYF = new Float32Array(64); for (let i = 0; i < 64; i++) BAYF[i] = B8[i];

  /* ================================================================ palette (the saga's 176 + The Lantern Fox's 79) */
  const PAL_HEX = [
    '000000', '07060d', '0e0c1a', '171530', '221f48', '2f2b63', '3f3a80', '524ca0', '6c64bd',     // 0-8 night and sky violets
    '2a0f1f', '4a1426', '7a1e2c', 'b0322f', 'e0582f', 'f28c3a', 'ffc060', 'ffe9a8',               // 9-16 dusk fire
    '3a3550', '5a5370', '8a83a0', 'c4bfd6', 'eceaf4', 'ffffff',                                   // 17-22 cloud and light
    '0e1f1a', '18352a', '26503a', '3a7048',                                                       // 23-26 forest
    '201814', '3a2a20', '5a4030', '7c5a40', 'a07a58',                                             // 27-31 earth and rock
    '4a4a52', '6c6c74', '9a9aa2',                                                                 // 32-34 stone
    'd97757', 'a8553b', 'f2a585', '6e2a1a',                                                       // 35-38 hero coral
    '141218', '24202c', '3a3444', 'ff2a4a', 'a0102a', 'ff8aa0',                                   // 39-44 the Null
    '1f66bd', '3f98f2', '95d4ff', '3a952c', '7bd23e', 'c8f27c', 'cf9c17', 'ffd84a', 'fff4b0',     // 45-53 water, leaf, lightning
    '4a1d80', '7c3ccc', 'ad78ff', 'e0c8ff',                                                       // 54-57 starlight
    'ffb020', 'ffe066', 'fffbe0', '30e0ff', '5a2a8a', '120c24',                                   // 58-63 gold aura, electric cyan, deep violets
    'f4efe6', 'd8d0c4', 'b3a998', '857a6c', '4e463e', '2a2420',                                   // 64-69 porcelain (the Unmaker's mask)
    '3a0030', '6a0050', 'a8007a', 'e01aa8', 'ff5ad0', 'ffb0ec',                                   // 70-75 magenta (its eyes and magic)
    '050008', '0c0418', '16082c', '220c3e', '2e1050',                                             // 76-80 void
    'ff3040', 'ff9020', 'fff040', '40ff80', '30d0ff', '5060ff', 'c040ff',                         // 81-87 prism
    '0a3a6a', '1a7ad0', '60c8ff', 'e8faff',                                                       // 88-91 storm
    '1c1c20', '3a3a40', '6a6a72', 'a8a8b0',                                                       // 92-95 drained grey
    // part IV
    '0a0506', '170b0b', '2a1414', '42201e', '5e302a',                                             // 96-100 obsidian (the Sunderer's body)
    '4a0606', '7e0c0c', 'b8170f', 'f0301a', 'ff6a24', 'ffb03a', 'ffe6a0',                         // 101-107 crimson to molten to white-hot
    'fff7e8', 'ffd890', 'ff9440',                                                                 // 108-110 nova (a star's body)
    '1e1412', '3a2622', 'ff4a30',                                                                 // 111-113 last light (charred, ember)
    '03090f', '071623', '0e2a3c', '1c4a62', '3e7c96', 'a6dcea',                                   // 114-119 the ocean under the clouds
    '2a2224', '4a3e3c', '74645e', 'a8968c',                                                       // 120-123 ash and broken rock
    // Carry
    '102a2c', '1e4a48', '347a70', '5aae98', '94dcc0', 'd6f6e4',                                   // 124-129 the snail (translucent sea-glass green)
    '3a2414', '6e4420', 'a87030', 'e0aa54',                                                       // 130-133 the shell's rim (amber horn)
    '0c1426', '142240', '1e3458', '2e4c74', '4a6e96',                                             // 134-138 night blues (sky, water, distance)
    '0e1e12', '17301c', '24462a', '386440', '58884e',                                             // 139-143 night meadow greens
    'ffe9b8', 'ffc878', 'f08a48',                                                                 // 144-146 warm window light
    '9ad8ff', 'd8f0ff',                                                                           // 147-148 atmosphere, ice
    // Snow Globe
    '0b2018', '133426', '1e4c34', '2e6844', '4a8a5a',                                             // 149-153 pine
    '3a0a12', '62121c', '962028', 'c8383a', 'ee6a5a',                                             // 154-158 Christmas red
    '24140c', '3c2416', '5c3820', '84542e', 'ac7840',                                             // 159-163 wood
    'f2c9a4', 'd69c78', 'a8705a',                                                                 // 164-166 skin
    '5a7aa8', '8aa6cc', 'bcd0ea', 'e6f0ff',                                                       // 167-170 snow at night
    '4a2a36', '6e3e48',                                                                           // 171-172 rug and wallpaper
    '5a4018', '8a6a2a', 'c8a050',                                                                 // 173-175 brass
    // The Lantern Fox
    '1e0e14', '3e1a1a', '6a2a1a', '983e1a', 'c45c1c', 'e8822a', 'ffa848', 'ffd08a',             // 176-183 fox orange, shadow to lantern-lit
    '4a2c44', '74404c', 'a0605a',                                                             // 184-186 fox orange in blue light
    'fff4e2', 'ffe2bc', 'f6c496', 'dc9e78', 'b47e82', '8a6a8c',                                 // 187-192 warm-lit whites to violet
    '9aa6d4', 'cdd6f0',                                                                       // 193-194 cool whites
    '120e18', '261e2c', '40343e',                                                             // 195-197 socks, ink, nose
    '2c1a0a', 'eec660', 'fff0b4', 'ff8a1e',                                                   // 198-201 brass deep, brass bright, brass hot, flame
    '080c26', '101a44', '1a2a62', '28407e', '42589a', '6c78b4', '9c96c0', 'cfaec4',             // 202-209 blue-hour sky to the rose band
    '0a161e', '10262e', '183840', '244c50', '386462',                                         // 210-214 teal pines at dusk
    '18141c', '28202a', '3c3038', '56464a',                                                   // 215-218 cool bark
    '744630', 'a46838', 'd4985a',                                                             // 219-221 warm-lit bark
    '04142a', '0a2842', '124260', '1c6080', '348ca8', '66bcd0', 'a4e2ee', 'dafaff',             // 222-229 ice
    '0a3a30', '106e48', '1ca664', '4ede8a', 'a6ffcc',                                         // 230-234 aurora
    '281e24', '46362e', '6a523e', '947656', 'c4a680',                                         // 235-239 deer
    '04080c', '0a1218', '121c26', '1e2a36', '324050', '505e6a', '7a8892', 'b2bec6',             // 240-247 storm sea and sky
    '281e1c', '483a32', '6c5848', '967c62',                                                   // 248-251 the tower's stone and wood
    '7e4c48', '2c2642', 'f0b4a4',                                                             // 252-254 skin shadow, violet shadow, blush
  ];
  const PAL = PAL_HEX.map((h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
  const NPAL = PAL.length;
  // the colours a lit surface may resolve to: the natural ones (none of the saga's neon magic, glitch reds or prisms)
  const NATURAL = [];
  for (let i = 0; i < NPAL; i++) if (!((i >= 39 && i <= 44) || i === 61 || (i >= 70 && i <= 87) || (i >= 96 && i <= 106) || (i >= 111 && i <= 113) || (i >= 124 && i <= 129) || i === 45 || i === 46 || i === 48 || i === 49 || i === 50 || i === 54 || i === 55)) NATURAL.push(i);
  function nearestIn(r, g, b, cand) {
    let best = 0, bd = 1e18;
    for (let q = 0; q < cand.length; q++) {
      const k = cand[q], p = PAL[k], rm = (p[0] + r) / 2, dr = p[0] - r, dg = p[1] - g, db = p[2] - b;
      const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  const ALLC = PAL.map((_, i) => i);
  const nearest = (r, g, b) => nearestIn(r, g, b, NATURAL);
  // tint tables: 8 levels of mixing (or adding) a colour into every palette entry
  function mkTab(hex, add, cand) {
    cand = cand || NATURAL;
    const q = [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)], T = [];
    for (let lv = 0; lv <= 8; lv++) {
      const a = lv / 8, tab = new Uint8Array(256);
      for (let i = 0; i < NPAL; i++) {
        const p = PAL[i];
        tab[i] = lv === 0 ? i : add ? nearestIn(Math.min(255, p[0] + q[0] * a), Math.min(255, p[1] + q[1] * a), Math.min(255, p[2] + q[2] * a), cand)
          : nearestIn(lerp(p[0], q[0], a), lerp(p[1], q[1], a), lerp(p[2], q[2], a), cand);
      }
      T.push(tab);
    }
    return T;
  }
  // multiply tables: every entry darkened toward a tinted shadow (rgb factors), 8 levels
  function mkMul(fr, fg, fb) {
    const T = [];
    for (let lv = 0; lv <= 8; lv++) {
      const a = lv / 8, tab = new Uint8Array(256);
      for (let i = 0; i < NPAL; i++) { const p = PAL[i]; tab[i] = lv === 0 ? i : nearest(p[0] * lerp(1, fr, a), p[1] * lerp(1, fg, a), p[2] * lerp(1, fb, a)); }
      T.push(tab);
    }
    return T;
  }
  const T_DARK = mkTab('000000', false), T_WH = mkTab('ffffff', true), T_GOLD = mkTab('ffc040', true);
  const T_WARM = mkTab('ffb060', true), T_CYAN = mkTab('60d8ff', true), T_BL = mkTab('3f98f2', true), T_GR = mkTab('50e090', true);
  const T_NIGHT = mkTab('080c26', false), T_LAMP = mkTab('ff9a40', true), T_SHADE = mkMul(0.55, 0.6, 0.85);

  /* ================================================================ buffer & primitives */
  const BUF = new Uint8Array(NP);
  const LB = 26, ROW0 = LB, ROW1 = H - 1 - LB;               // the letterbox, and the picture's first and last rows
  function P(x, y, c) { x = fl(x); y = fl(y); if (x >= 0 && x < W && y >= ROW0 && y <= ROW1) BUF[y * W + x] = c; }
  function rectF(x, y, w, h, c) {
    const x0 = Math.max(0, fl(x)), y0 = Math.max(0, fl(y)), x1 = Math.min(W, fl(x + w)), y1 = Math.min(H, fl(y + h));
    if (!(x1 > x0) || !(y1 > y0)) return;
    for (let yy = y0; yy < y1; yy++) BUF.fill(c, yy * W + x0, yy * W + x1);
  }
  function lineF(x0, y0, x1, y1, fn) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, L = Math.max(dx, -dy) || 1;
    let e = dx + dy, n = 0;
    for (;;) {
      fn(x0, y0, n / L);
      if ((x0 === x1 && y0 === y1) || ++n > 3000) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  const lineP = (x0, y0, x1, y1, c) => lineF(x0, y0, x1, y1, (x, y) => P(x, y, c));
  function discF(cx, cy, r, c) {
    const r2 = r * r, y0 = Math.max(ROW0, fl(cy - r)), y1 = Math.min(ROW1, Math.ceil(cy + r)), x0 = Math.max(0, fl(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy <= r2) BUF[y * W + x] = c; }
  }
  function tintI(i, x, y, T, a) {
    let lv = (a * 8 + 0.5 + (bay(x, y) - 0.5) * 0.6) | 0;
    if (lv <= 0) return;
    if (lv > 8) lv = 8;
    BUF[i] = T[lv][BUF[i]];
  }
  function tintP(x, y, T, a) { x = fl(x); y = fl(y); if (x >= 0 && x < W && y >= ROW0 && y <= ROW1) tintI(y * W + x, x, y, T, a); }
  function tintAll(T, a) { if (a <= 0.004) return; for (let y = ROW0; y <= ROW1; y++) for (let x = 0; x < W; x++) tintI(y * W + x, x, y, T, a); }
  // a soft additive glow (pw 1: linear falloff, else quadratic); ry squashes it vertically
  function glow(cx, cy, r, T, amax, pw, ry) {
    if (amax <= 0.004 || r <= 0) return;
    const rv = r * (ry || 1);
    const y0 = Math.max(ROW0, fl(cy - rv)), y1 = Math.min(ROW1, Math.ceil(cy + rv)), x0 = Math.max(0, fl(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r)), ir = 1 / r, irv = 1 / rv;
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - cy) * irv;
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) * ir, d = dx * dx + dy * dy;
        if (d >= 1) continue;
        const f = 1 - Math.sqrt(d);
        tintI(y * W + x, x, y, T, amax * (pw === 1 ? f : f * f));
      }
    }
  }
  function sparkle(x, y, L, c0, c1) {
    x = Math.round(x); y = Math.round(y);
    if (L < 0.5) return;
    P(x, y, c0);
    const l = Math.round(L);
    for (let k = 1; k <= l; k++) { const c = k <= l * 0.45 ? c0 : c1; P(x + k, y, c); P(x - k, y, c); P(x, y + k, c); P(x, y - k, c); }
    if (l >= 3) { const d = Math.max(1, Math.round(l * 0.3)); for (let k = 1; k <= d; k++) { P(x + k, y + k, c1); P(x - k, y - k, c1); P(x + k, y - k, c1); P(x - k, y + k, c1); } }
  }
  // pick from a ramp (dark → light) at level v ∈ [0, 1], dithered by d ∈ [0, 1)
  const rp = (R, v, d) => R[clamp(fl(v * (R.length - 1) + d), 0, R.length - 1)];
  // the same, with the dither held to a narrow seam (dw < 1): crisper bands
  const rq = (R, v, d, dw) => R[clamp(fl(v * (R.length - 1) + 0.5 + (d - 0.5) * dw), 0, R.length - 1)];
  function letterbox(h) { rectF(0, 0, W, h, 0); rectF(0, H - h, W, h, 0); }

  /* ================================================================ the film: shots */
  let T_NOW = 0;
  const SHOTS = [], BUILDERS = [];
  const shot = (t0, t1, fn, opt) => SHOTS.push(Object.assign({ t0, t1, fn }, opt || {}));
  // a second buffer, for dissolves: draw A into BUF, keep it, draw B, then mix them. The mix is a real colour blend (the
  // nearest palette colour to 25 / 50 / 75 % of the way from A to B, memoised per pair), dithered between those levels:
  // a film dissolve, not a checkerboard.
  const BUFA = new Uint8Array(NP), MIX25 = new Uint8Array(65536).fill(255), MIX50 = new Uint8Array(65536).fill(255);
  function mixC(a, b, q) {                                   // q: 1 = 25 %, 2 = 50 %, 3 = 75 % toward b (255 = not yet known)
    if (a === b) return a;
    if (q === 2) {
      const k = a < b ? (a << 8) | b : (b << 8) | a;
      if (MIX50[k] === 255) { const A = PAL[a], B = PAL[b]; MIX50[k] = nearestIn((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2, NATURAL); }
      return MIX50[k];
    }
    if (q === 3) { const t = a; a = b; b = t; }
    const k = (a << 8) | b;
    if (MIX25[k] === 255) { const A = PAL[a], B = PAL[b]; MIX25[k] = nearestIn(A[0] * 0.75 + B[0] * 0.25, A[1] * 0.75 + B[1] * 0.25, A[2] * 0.75 + B[2] * 0.25, NATURAL); }
    return MIX25[k];
  }
  function dissolve(drawA, drawB, u, seed) {
    if (u <= 0) { drawA(); return; }
    if (u >= 1) { drawB(); return; }
    drawA(); BUFA.set(BUF); drawB();
    const f = u * 4;
    for (let y = ROW0; y <= ROW1; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, q = (f + bay(x, y) * 0.999) | 0;
      if (q <= 0) BUF[i] = BUFA[i]; else if (q < 4) BUF[i] = mixC(BUFA[i], BUF[i], q);
    }
  }
  // a dip between two shots: down through the dark (or a warm light), then up into the next: never two pictures at once
  function dip(drawA, drawB, u, T, amax) {
    T = T || T_DARK; amax = amax === undefined ? 0.92 : amax;
    const a = u < 0.5 ? eio(u / 0.5) : eio((1 - u) / 0.5);
    if (u < 0.5) drawA(); else drawB();
    const lv = Math.round(a * amax * 8); if (lv <= 0) return;
    const TT = T[Math.min(8, lv)];
    for (let y = ROW0; y <= ROW1; y++) { const o = y * W; for (let x = 0; x < W; x++) BUF[o + x] = TT[BUF[o + x]]; }
  }


  /* ================================================================ light: materials, the lantern, deferred layers
     A surface is a material (an albedo, and the palette colours it may resolve to) lit by three lights: the scene's
     ambient floor, its sky light (moon or dusk, scaled by the surface's shade s, where texture, AO and form live) and
     the lantern (l: falloff × Lambert × the cage's shadows). Each scene builds a table TAB[m][s][l] → palette index
     once; a lit pixel is one dithered table lookup. Static scenery is painted once into G-buffer layers (material,
     shade, depth, normal, sparkle seed) and shaded per frame, so the warm pool really slides over everything. */
  const MATS = [null];
  function defMat(hex, pal, o) {
    o = o || {};
    MATS.push({ rgb: [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255], pal: pal || NATURAL, gloss: o.gloss || 0, lampK: o.lampK === undefined ? 1 : o.lampK });
    return MATS.length - 1;
  }
  const NS = 18, NL = 14, SQ = 10, LQ = 6;                    // shade levels (0 .. 1.7, steps of 0.1), lamp levels (0 .. 2.17, steps of 1/6)
  // a lighting rig: rgb (0..1+) of the ambient floor, the sky light at s = 1, the lantern at l = 1
  function mkRig(amb, sky, lamp) {
    const NM = MATS.length, tab = new Uint8Array(NM * NS * NL);
    for (let m = 1; m < NM; m++) {
      const M = MATS[m], a = M.rgb;
      for (let si = 0; si < NS; si++) for (let li = 0; li < NL; li++) {
        const s = si / SQ, l = li / LQ * M.lampK;
        const rgb = [0, 1, 2].map((k) => {
          let v = a[k] * (amb[k] + s * sky[k] + l * lamp[k]);
          if (l > 1) v += (l - 1) * 0.3 * lamp[k];                  // the hot core near the flame
          if (s > 1) v += (s - 1) * (0.25 + M.gloss) * sky[k];      // a sheen past full light
          return v;
        });
        // a soft shoulder that keeps the hue (warm light on white fur goes cream, not blank white)
        const mx = Math.max(rgb[0], rgb[1], rgb[2]), kn = 0.82;
        if (mx > kn) { const k = (kn + (1.02 - kn) * (1 - Math.exp(-(mx - kn) / (1.02 - kn)))) / mx; for (let q = 0; q < 3; q++) rgb[q] *= k; }
        for (let q = 0; q < 3; q++) rgb[q] = clamp(rgb[q] * 255, 0, 255);
        tab[(m * NS + si) * NL + li] = nearestIn(rgb[0], rgb[1], rgb[2], M.pal);
      }
    }
    return tab;
  }
  let TAB = null;
  // a lit colour: material m, shade s, lamp l, at screen (X, Y); dithered between levels with a narrowed seam
  // the same with a narrower dither seam (characters: crisper, calmer bands)
  function mcq(m, s, l, X, Y) {
    const b = BAYF[((Y & 7) << 3) | (X & 7)];
    let si = (s * SQ + 0.5 + (b - 0.5) * 0.5) | 0, li = (l * LQ + 0.5 + (BAYF[(((Y + 3) & 7) << 3) | ((X + 5) & 7)] - 0.5) * 0.6) | 0;
    si = si < 0 ? 0 : si >= NS ? NS - 1 : si; li = li < 0 ? 0 : li >= NL ? NL - 1 : li;
    return TAB[(m * NS + si) * NL + li];
  }
  function mc(m, s, l, X, Y) {
    const b = BAYF[((Y & 7) << 3) | (X & 7)];
    let si = (s * SQ + 0.5 + (b - 0.5) * 0.9) | 0, li = (l * LQ + 0.5 + (BAYF[(((Y + 3) & 7) << 3) | ((X + 5) & 7)] - 0.5) * 0.9) | 0;
    si = si < 0 ? 0 : si >= NS ? NS - 1 : si; li = li < 0 ? 0 : li >= NL ? NL - 1 : li;
    return TAB[(m * NS + si) * NL + li];
  }

  /* ---------------------------------------------------------------- the lantern as a light
     LAMP: screen position (x, y), depth z, intensity I, reach R (screen px), rot (the cage's turn, for its spoke
     shadows), on. Depth is in screen px at zoom 1. Shadow casters: ellipses on the ground that block the lamp (the fox's
     own shadow, thrown back from the flame) or the sky (contact shadows). */
  const LAMP = { on: 0, x: 0, y: 0, z: 0, I: 0, R: 40, rot: 0, zoom: 1, cut: 0, h: 16 };
  const SHAD = [];                                           // {x, y, rx, ry, a, lamp: 1 blocks the lamp / 0 the sky}
  // the lamp's light reaching a surface at screen (X, Y), depth zp, normal (nx, ny) (toward the camera nc ≥ 0)
  function lampAt(X, Y, zp, nx, ny) {
    if (!LAMP.on) return 0;
    const dx = X + 0.5 - LAMP.x, dy = Y + 0.5 - LAMP.y, R = LAMP.R, Rm = R * 3.2;
    if (dx > Rm || dx < -Rm || dy > Rm || dy < -Rm) return 0;
    const dz = (zp - LAMP.z) * LAMP.zoom;
    if (ny < -0.99) {
      // the ground (normal straight up): the lamp hangs LAMP.h above it; screen rows here mean depth, not height
      const hh = LAMP.h * LAMP.zoom, g2 = dx * dx + dz * dz + hh * hh;
      if (g2 >= Rm * Rm) return 0;
      const w = 1 - g2 / (Rm * Rm), fall = w * w / (1 + g2 / (R * R)), lam = Math.min(1, 1.25 * hh / Math.sqrt(g2) + 0.12);
      let cage = 1;
      if (g2 > 36) { const a = Math.atan2(dz * 1.6, dx) * 2 + LAMP.rot, c = Math.cos(a); cage = 1 - 0.2 * c * c * c * c; }
      return LAMP.I * fall * lam * cage;
    }
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= Rm * Rm) return 0;
    const w = 1 - d2 / (Rm * Rm), fall = w * w / (1 + d2 / (R * R));
    const d = Math.sqrt(d2) + 0.001, nc = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const dot = (-nx * dx - ny * dy + nc * dz) / d, lam = dot < -0.5 ? 0 : (dot + 0.5) / 1.5;
    // the cage: four bars throw soft spokes of shadow; the cap shades what is above the flame
    let cage = 1;
    if (d2 > 36) { const a = Math.atan2(dy, dx * 0.8) * 2 + LAMP.rot, c = Math.cos(a); cage = 1 - 0.22 * c * c * c * c; }
    if (dy < -4) { const up = -dy / d; if (up > 0.8) cage *= 1 - 0.5 * sstep(0.8, 0.97, up) * sstep(4, 20, -dy); }
    return LAMP.I * fall * lam * cage;
  }
  function shadAt(X, Y, lampOnly) {
    let a = 0;
    for (let k = 0; k < SHAD.length; k++) {
      const S = SHAD[k]; if (S.lamp !== lampOnly) continue;
      const u = (X + 0.5 - S.x) / S.rx, v = (Y + 0.5 - S.y) / S.ry, q = u * u + v * v;
      if (q < 1) { const f = (1 - q) * S.a; if (f > a) a = f; }
    }
    return a > 1 ? 1 : a;
  }

  /* ---------------------------------------------------------------- G-buffer layers */
  // M: material (0 empty, 255 = unlit: S holds a palette index), S: shade × 150, Z: depth (z0 + Z·zk), N: normal (x, y)
  // × 127, F: sparkle seed (0 none). recv: does it take shadows (the ground). fog: haze level (0..1) toward FOGT.
  function mkLayer(w, h, o) {
    o = o || {};
    return { w, h, M: new Uint8Array(w * h), S: new Uint8Array(w * h), Z: new Uint8Array(w * h), N: new Int8Array(w * h * 2), F: new Uint8Array(w * h), z0: o.z0 || 0, zk: o.zk || 1, recv: !!o.recv };
  }
  function lput(L, x, y, m, s, z, nx, ny, f) {
    x = fl(x); y = fl(y); if (x < 0 || y < 0 || x >= L.w || y >= L.h) return;
    const i = y * L.w + x;
    L.M[i] = m; L.S[i] = clamp(Math.round(s * 150), 0, 255); L.Z[i] = clamp(Math.round(z), 0, 255);
    L.N[i * 2] = clamp(Math.round((nx || 0) * 127), -127, 127); L.N[i * 2 + 1] = clamp(Math.round((ny || 0) * 127), -127, 127);
    L.F[i] = f || 0;
  }
  const lputC = (L, x, y, c) => { x = fl(x); y = fl(y); if (x < 0 || y < 0 || x >= L.w || y >= L.h) return; const i = y * L.w + x; L.M[i] = 255; L.S[i] = c; L.F[i] = 0; };
  let FOGT = T_NIGHT;                                         // the scene's haze table (mkTab toward its haze colour)
  let SPK_SNOW = 0;                                           // which material sparkles (snow), and the sparkle palette
  const SPK = { t: 0, rate: 1 };
  /* draw a layer: layer point (ox, oy) lands at the screen centre (240, 135), magnified zoom; fog f (+ fy per row below
     the layer's mist line, for low mist); clip rows [ya, yb] */
  function comp(L, ox, oy, zoom, fog, opt) {
    opt = opt || {};
    const iz = 1 / zoom, w = L.w, h = L.h, M = L.M, S = L.S, Z = L.Z, N = L.N, F = L.F, z0 = L.z0, zk = L.zk, recv = L.recv;
    const ya = Math.max(ROW0, opt.ya === undefined ? ROW0 : opt.ya), yb = Math.min(ROW1, opt.yb === undefined ? ROW1 : opt.yb);
    const mist = opt.mist || 0, mistY = opt.mistY || 0, mistH = opt.mistH || 40, sk = opt.noSpark ? 0 : SPK_SNOW, t = SPK.t;
    const lamp = LAMP.on && !opt.noLamp, Rm = LAMP.R * 3.2, hasSh = SHAD.length > 0 && recv, dark = opt.dark || 0;
    const cust = opt.custom || null, cm0 = opt.cm0 || 0, cm1 = opt.cm1 || 0;
    for (let Y = ya; Y <= yb; Y++) {
      const ly = fl(oy + (Y + 0.5 - 135) * iz);
      if (ly < 0 || ly >= h) continue;
      const row = ly * w, o = Y * W;
      let fg = fog;
      if (mist) fg = clamp(fog + mist * clamp((ly - mistY) / mistH, 0, 1), 0, 1);
      const lampRow = lamp && Math.abs(Y + 0.5 - LAMP.y) < Rm;
      const x0 = Math.max(0, Math.ceil((-ox) * zoom + 240 - 0.5)), x1 = Math.min(W - 1, fl((w - ox) * zoom + 240 - 0.5));
      for (let X = x0; X <= x1; X++) {
        const lx = fl(ox + (X + 0.5 - 240) * iz);
        if (lx < 0 || lx >= w) continue;
        const i = row + lx, m = M[i];
        if (!m) continue;
        let c;
        if (m === 255) c = S[i];
        else {
          let s = S[i] * (1 / 150), l = 0;
          if (lampRow) {
            l = lampAt(X, Y, z0 + Z[i] * zk, N[i * 2] * (1 / 127), N[i * 2 + 1] * (1 / 127));
            if (hasSh && l > 0.01) { const a = shadAt(X, Y, 1); if (a > 0) l *= 1 - a; }
          }
          if (hasSh) { const a = shadAt(X, Y, 0); if (a > 0) s *= 1 - a; }
          if (dark) s *= 1 - dark;
          if (cust && m >= cm0 && m <= cm1) c = cust(m, s, l, F[i], X, Y, lx, ly, N[i * 2] * (1 / 127));
          else c = mc(m, s, l, X, Y);
          // snow crust: a crystal here and there catches the light and twinkles (warm and many near the lantern)
          if (m === sk && F[i]) {
            const f = F[i], tw = frac(f * 0.0391 + t * (0.55 + (f & 7) * 0.09)), on = tw < 0.16 ? 1 - tw / 0.16 : 0;
            if (on > 0) {
              const k = on * (0.32 * s + 1.6 * l);
              if (k > 0.5) c = l > 0.25 ? (k > 1.1 ? 22 : 200) : k > 0.75 ? 22 : 194;
            }
          }
        }
        if (fg > 0.004) { let lv = (fg * 8 + 0.5 + (BAYF[((Y & 7) << 3) | (X & 7)] - 0.5) * 0.6) | 0; if (lv > 8) lv = 8; if (lv > 0) c = FOGT[lv][c]; }
        BUF[o + X] = c;
      }
    }
  }
  // screen → layer coordinates for a comp() call (and back)
  const toLX = (ox, zoom, X) => ox + (X + 0.5 - 240) / zoom, toLY = (oy, zoom, Y) => oy + (Y + 0.5 - 135) / zoom;
  const toSX = (ox, zoom, lx) => (lx - ox) * zoom + 240 - 0.5, toSY = (oy, zoom, ly) => (ly - oy) * zoom + 135 - 0.5;

  /* ================================================================ materials (albedo, and what each may resolve to) */
  const rng = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; };
  const PAL_SNOW = [0, 1, 2, 3, 4, 5, 20, 21, 22, 134, 135, 136, 137, 138, 147, 148, ...rng(167, 170), ...rng(187, 194), ...rng(202, 209), 253, 182, 183, 16, 60, 108, 109];
  const PAL_PINE = [0, 1, 2, 23, 24, 25, 26, 139, 140, 141, 142, 143, ...rng(149, 153), ...rng(210, 214), 134, 135, 136, 137, 27, 28, 29, 219, 162];
  const PAL_BARK = [0, 1, 2, 3, 27, 28, 29, 30, 31, 92, 93, ...rng(159, 163), ...rng(215, 221), 134, 135, 136, 137, 253, 248, 249, 250, 176, 177, 178, 182, 183, 189, 190];
  const PAL_FOX = [0, 1, 2, 3, 4, 5, ...rng(176, 192), 195, 196, 197, 9, 10, 11, 14, 15, 16, 108, 109, 253, 254];
  const PAL_FOXW = [0, 1, 2, 3, 4, 5, 6, 7, 8, 19, 20, 21, 22, 134, 135, 136, 137, 138, ...rng(167, 170), ...rng(187, 194), 253, 254, 16, 108, 64, 65];
  const PAL_INK = [0, 1, 2, 3, 4, ...rng(195, 197), 176, 177, 184, 185, 215, 216, 217, 253, 178, 179, 192];
  const PAL_ICE = [0, 1, 2, ...rng(114, 119), 134, 135, 136, 137, 138, 147, 148, ...rng(222, 229), 22, 21, 16, 15, 59, 60, 182, 183, 199, 200, 187, 188, 91, 90, 88];
  const PAL_ROCK = [0, 1, 2, 3, 4, 5, 32, 33, 34, 92, 93, 94, ...rng(120, 123), ...rng(134, 138), ...rng(215, 221), ...rng(240, 247), 253, 248, 249, 250, 251];
  const PAL_DEER = [0, 1, 2, 3, 4, ...rng(235, 239), 27, 28, 29, 30, 31, 120, 121, 122, 123, ...rng(215, 218), 134, 135, 136, 137, 64, 65, 66, 67, 187, 188, 189, 190, 219, 220, 221, 253];
  const PAL_WOOL = [0, 1, 2, 3, ...rng(154, 158), 176, 177, 178, 179, 180, 9, 10, 11, 12, 13, 252, 253, 184, 185, 186, 96, 97, 98, 99, 100];
  const PAL_CREAM = [0, 1, 2, 3, 4, 5, 6, ...rng(64, 69), ...rng(187, 194), 19, 20, 21, 22, 253, 167, 168, 169, 251, 250, 239, 16, 108];
  const PAL_SKIN = [0, 1, 2, 3, ...rng(164, 166), 252, 254, 176, 177, 178, 184, 185, 186, 187, 188, 189, 190, 191, 158, 36, 37, 99, 100, 253];
  const PAL_STONE = [0, 1, 2, 3, 4, 5, 32, 33, 34, 92, 93, 94, 95, ...rng(120, 123), ...rng(240, 247), ...rng(248, 251), ...rng(64, 69), 19, 20, 21, 22, 253, 187, 188, 189, 190, 191, 134, 135, 136, 137, 138];
  const PAL_WOOD = [0, 1, 2, 27, 28, 29, 30, 31, ...rng(159, 163), ...rng(215, 221), ...rng(248, 251), 253, 176, 177, 178, 179, 182, 183, 15, 16];
  const PAL_IRON = [0, 1, 2, 3, 4, 92, 93, 94, 95, ...rng(195, 197), ...rng(215, 218), ...rng(240, 246), 253, 248, 249, 219, 220, 221, 198, 173];
  const PAL_RED = [0, 1, 2, 3, ...rng(154, 158), 176, 177, 178, 179, 9, 10, 11, 12, 252, 253, 184, 185, 186, 96, 97, 98, 99];
  const PAL_BRASS = [0, 1, 2, 198, 173, 174, 175, 199, 200, 130, 131, 132, 133, 15, 16, 22, 60, 159, 160, 161, 219, 220, 221, 253];

  const M_SNOW = defMat('eef2ff', PAL_SNOW);
  const M_PINE = defMat('2c5c50', PAL_PINE);
  const M_PINED = defMat('1a3a34', PAL_PINE);
  const M_BARK = defMat('6e5650', PAL_BARK);
  const M_BIRCH = defMat('d8d4d0', PAL_STONE);
  const M_FOX = defMat('ff7a2c', PAL_FOX);
  const M_FOXW = defMat('fffaf4', PAL_FOXW.filter((c) => c !== 192 && c !== 8 && c !== 7));
  const M_FOXK = defMat('342a30', PAL_INK);
  const M_EARIN = defMat('ffc0b0', [254, 186, 190, 191, 185, 184, 189, 188, 187, 176, 177, 253, 165, 164, 252]);
  const M_ICE = defMat('a8e4ff', PAL_ICE, { gloss: 0.4 });
  const M_ICED = defMat('3a8cc0', PAL_ICE, { gloss: 0.3 });
  const M_ROCK = defMat('5e5c6c', PAL_ROCK);
  const M_DEER = defMat('8c6a50', PAL_DEER);
  const M_DEERW = defMat('ece2d2', PAL_DEER);
  const M_DEERK = defMat('3a2c2a', PAL_DEER);
  const M_OWL = defMat('c08a5a', PAL_DEER.concat([176, 177, 178, 184, 185, 186]));
  const M_OWLW = defMat('ecc898', PAL_DEER.concat([191, 192, 252, 186]));
  const M_WOOL = defMat('b8262a', PAL_WOOL);
  const M_WOOLC = defMat('f0e4cc', [0, 1, 2, 3, 4, 19, 20, 21, 64, 65, 66, 67, 187, 188, 189, 190, 191, 192, 193, 194, 253, 168, 169, 16]);
  const M_BEARD = defMat('f6f4f0', [0, 1, 2, 3, 4, 5, 6, 19, 20, 21, 22, 134, 135, 136, 137, 138, 167, 168, 169, 170, 187, 188, 189, 193, 194, 253, 64, 16, 108]);
  const M_SKIN = defMat('eeb08c', PAL_SKIN);
  const M_CAP = defMat('3c5a48', PAL_PINE.concat([253, 196, 197]));
  const M_TROU = defMat('3a3448', PAL_IRON.concat([5, 6, 134, 135, 136]));
  const M_BOOT = defMat('5a3a26', PAL_WOOD);
  const M_WHITEW = defMat('e8e4dc', PAL_STONE);
  const M_REDW = defMat('a8302c', PAL_RED);
  const M_STONE = defMat('8c7c6c', PAL_STONE.concat(PAL_WOOD));
  const M_WOOD = defMat('8a5a34', PAL_WOOD);
  const M_IRON = defMat('3c3c46', PAL_IRON);
  const M_BRASSM = defMat('d0a448', PAL_BRASS, { gloss: 0.5 });
  const M_GLASS = defMat('cce8f0', PAL_ICE.concat([64, 65, 194]), { gloss: 0.5 });
  const M_GRASS = defMat('b49a70', PAL_DEER.concat([162, 163, 31, 30]));

  /* ================================================================ soft bodies: smooth unions of tapered capsules
     A pass is a list of capsules (a → b, radius ra → rb, smooth join k, part id, along-range u0..u1, tuft amplitude),
     already in screen space. The field gives the inside depth, its gradient (the surface's lean: a pillowy normal), the
     nearest part, how far along it, which side of its axis. Rasterised row by row over only the capsules that reach the
     row, skipping ahead outside by the field value (a lower bound on the distance). The shader gets everything. */
  const SD_ST = 20, SD_MAX = 64, SDP = new Float64Array(SD_MAX * SD_ST), SDA = new Int32Array(SD_MAX), SDX0 = new Float64Array(SD_MAX), SDX1 = new Float64Array(SD_MAX);
  const SDB = [0, 0, 0, 0];
  let sdN = 0;
  // the last evaluation: gradient, nearest part, radius there, along, side (+1 left of a→b, −1 right), lateral offset
  const SDF = { gx: 0, gy: 0, id: 0, r: 1, u: 0, side: 1, lat: 0, d: 0 };
  function sdBegin() { sdN = 0; SDB[0] = 1e9; SDB[1] = 1e9; SDB[2] = -1e9; SDB[3] = -1e9; }
  function sdCap(ax, ay, bx, by, ra, rb, k, id, u0, u1, tuft) {
    if (sdN >= SD_MAX) return;
    const o = sdN++ * SD_ST, R = Math.max(ra, rb) + k + (tuft || 0) + 2;
    SDP[o] = ax; SDP[o + 1] = ay; SDP[o + 2] = bx - ax; SDP[o + 3] = by - ay;
    const L2 = SDP[o + 2] * SDP[o + 2] + SDP[o + 3] * SDP[o + 3];
    SDP[o + 4] = L2 > 1e-9 ? 1 / L2 : 0; SDP[o + 5] = ra; SDP[o + 6] = rb - ra; SDP[o + 7] = Math.max(0.01, k); SDP[o + 8] = id;
    SDP[o + 9] = u0 || 0; SDP[o + 10] = u1 === undefined ? 1 : u1;
    SDP[o + 11] = Math.min(ax, bx) - R; SDP[o + 12] = Math.min(ay, by) - R; SDP[o + 13] = Math.max(ax, bx) + R; SDP[o + 14] = Math.max(ay, by) + R;
    SDP[o + 15] = tuft || 0; SDP[o + 16] = Math.sqrt(L2);
    if (SDP[o + 11] < SDB[0]) SDB[0] = SDP[o + 11]; if (SDP[o + 12] < SDB[1]) SDB[1] = SDP[o + 12];
    if (SDP[o + 13] > SDB[2]) SDB[2] = SDP[o + 13]; if (SDP[o + 14] > SDB[3]) SDB[3] = SDP[o + 14];
  }
  const sdBall = (x, y, r, k, id, tuft) => sdCap(x, y, x, y, r, r, k, id, 0, 0, tuft);
  // a tuft profile: a sawtooth of soft points (fur flicks), q along the edge
  const tuftF = (q) => { const f = q - Math.floor(q); return f < 0.7 ? f / 0.7 : (1 - f) / 0.3; };
  function sdField(x, y, na) {
    let s = 1e9, gx = 0, gy = 0, best = 1e9, id = 0, rl = 1, al = 0, side = 1, lat = 0, tf = 0;
    for (let a = 0; a < na; a++) {
      if (x < SDX0[a] || x > SDX1[a]) continue;
      const o = SDA[a], bx = SDP[o + 2], by = SDP[o + 3], px = x - SDP[o], py = y - SDP[o + 1];
      let h = (px * bx + py * by) * SDP[o + 4]; h = h < 0 ? 0 : h > 1 ? 1 : h;
      const dx = px - bx * h, dy = py - by * h, dl = Math.sqrt(dx * dx + dy * dy) + 1e-9, r = SDP[o + 5] + SDP[o + 6] * h;
      let d = dl - r;
      const tu = SDP[o + 15];
      let tq = 0;
      if (tu > 0 && d > -tu * 2.5) {
        // fur: little points along the edge, flowing toward the end of the part
        const L = SDP[o + 16], cr = bx * py - by * px;
        const q = L > 0.5 ? (h * L + (cr > 0 ? 0.45 : 0)) / (2.1 * Math.max(0.6, tu)) : Math.atan2(dy, dx) * 2.2;
        tq = tu * (tuftF(q) - 0.35);
        d -= tq;
      }
      if (d < best) { best = d; id = SDP[o + 8]; al = SDP[o + 9] + (SDP[o + 10] - SDP[o + 9]) * h; const cr = bx * py - by * px; side = cr >= 0 ? 1 : -1; lat = dl / Math.max(0.3, r); tf = tq; }
      const ex = dx / dl, ey = dy / dl;
      if (s > 1e8) { s = d; gx = ex; gy = ey; rl = r; }
      else { const k = SDP[o + 7], g = 0.5 + 0.5 * (d - s) / k, q = g < 0 ? 0 : g > 1 ? 1 : g; s = d + (s - d) * q - k * q * (1 - q); gx = ex + (gx - ex) * q; gy = ey + (gy - ey) * q; rl = r + (rl - r) * q; }
    }
    SDF.gx = gx; SDF.gy = gy; SDF.id = id; SDF.r = rl; SDF.u = al; SDF.side = side; SDF.lat = lat; SDF.d = s; SDF.tf = tf;
    return s;
  }
  // rasterise the pass: shade(X, Y, s) → palette index (or −1 to leave the pixel); clip to [cx0, cx1] × rows
  function sdDraw(shade, cx0, cx1) {
    if (!sdN) return;
    cx0 = cx0 === undefined ? 0 : cx0; cx1 = cx1 === undefined ? W - 1 : cx1;
    const Y0 = Math.max(ROW0, fl(SDB[1])), Y1 = Math.min(ROW1, Math.ceil(SDB[3]));
    for (let Y = Y0; Y <= Y1; Y++) {
      const y = Y + 0.5;
      let na = 0, xa = 1e9, xb = -1e9;
      for (let i = 0, o = 0; i < sdN; i++, o += SD_ST) {
        if (y < SDP[o + 12] || y > SDP[o + 14]) continue;
        const R = SDP[o + 13] - Math.max(SDP[o], SDP[o] + SDP[o + 2]), ay = SDP[o + 1], dy = SDP[o + 3];
        let h0 = 0, h1 = 1;
        if (Math.abs(dy) > 1e-6) { const ha = (y - R - ay) / dy, hb = (y + R - ay) / dy; h0 = Math.max(0, Math.min(ha, hb)); h1 = Math.min(1, Math.max(ha, hb)); if (h0 > h1) continue; }
        const xa0 = SDP[o] + SDP[o + 2] * h0, xa1 = SDP[o] + SDP[o + 2] * h1;
        SDX0[na] = Math.min(xa0, xa1) - R; SDX1[na] = Math.max(xa0, xa1) + R; SDA[na] = o;
        if (SDX0[na] < xa) xa = SDX0[na]; if (SDX1[na] > xb) xb = SDX1[na]; na++;
      }
      if (!na) continue;
      const X0 = Math.max(cx0, fl(xa)), X1 = Math.min(cx1, Math.ceil(xb)), o = Y * W;
      for (let X = X0; X <= X1; X++) {
        const s = sdField(X + 0.5, y, na);
        if (s >= 0) {
          // skip ahead: no nearer than the field says, and never past where another capsule's reach begins
          let sk = s > 1e8 ? 1e9 : fl(s - 2.2);
          if (sk > 0) { const x = X + 0.5; for (let a = 0; a < na; a++) if (SDX0[a] > x) { const g = fl(SDX0[a] - x); if (g < sk) sk = g; } if (sk > 0) X += sk - (sk > 1e8 ? 0 : 0); }
          continue;
        }
        const c = shade(X, Y, s);
        if (c >= 0) BUF[o + X] = c;
      }
    }
  }
  // the pillowy normal at the last evaluation (depth −s inside a part of radius r): [nx, ny, nc]
  const SDN = [0, 0, 1];
  function sdNormal(s) {
    const gl = Math.sqrt(SDF.gx * SDF.gx + SDF.gy * SDF.gy) || 1, rel = clamp(-s / Math.max(0.5, SDF.r), 0, 1), m = 1 - rel;
    const mm = Math.sqrt(m * (2 - m));                        // a round profile: steep at the rim, flat in the middle
    SDN[0] = SDF.gx / gl * mm; SDN[1] = SDF.gy / gl * mm; SDN[2] = Math.sqrt(Math.max(0, 1 - mm * mm));
    return SDN;
  }

  /* ================================================================ the fox kit
     A rig in local units (≈ 1 cm; the kit is ~38 long without its tail), x forward, y down, ground at y = 0. Its head is
     a sphere in 3-D (yaw turns it from profile toward the camera, so the eyes, muzzle, ears and cheek ruffs move over it
     as they would on a real head); the body, legs and tail are 2-D chains in four passes (far legs and far ear, tail,
     body and near legs, head). Shaded per pixel: fur albedo by region (orange coat, white bib, cheeks, muzzle and tail
     tip, black socks and ear tips, cream ear insides), sky light with a cool rim, the lantern's warm light with Lambert,
     snow bounce from below, fur grain in local space (it moves with the fox, never swims), an ink edge. */
  function foxPose(o) {
    return Object.assign({
      ph: 0, gait: 0, A: 0, lift: 0, bob: 0, sq: 0, pitch: 0,
      hx: 0, hy: 0, tilt: 0, yaw: 0.42, nod: 0,
      earN: 0, earF: 0, perk: 0,
      tLift: 0, tCurl: 0, wag: 0, wagD: null,
      mouth: 0, eyes: 1, happy: 0, lookX: 0.3, lookY: 0, wide: 0,
      dig: 0, digReach: 0, sit: 0, curl: 0, breath: 0, sniff: 0, sleep: 0,
    }, o || {});
  }
  // two-bone IK: from a to target t with bone lengths l1, l2; bend +1 or −1; returns the joint
  function ik2(ax, ay, tx, ty, l1, l2, bend) {
    let dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy);
    const dm = Math.max(0.01, Math.min(d, l1 + l2 - 0.01));
    const a = Math.atan2(dy, dx), c = clamp((l1 * l1 + dm * dm - l2 * l2) / (2 * l1 * dm), -1, 1), b = Math.acos(c) * bend;
    return [ax + Math.cos(a + b) * l1, ay + Math.sin(a + b) * l1];
  }
  // the head's 3-D frame: a feature at (az, el) on a sphere of radius r about (cx, cy) → [x, y, z (toward camera)]
  function hfeat(F, az, el, r) {
    const ce = Math.cos(el), x = ce * (Math.cos(az) * F.fx + Math.sin(az) * F.rx), z = ce * (Math.cos(az) * F.fz + Math.sin(az) * F.rz), y = -Math.sin(el);
    // tilt (nose down) turns the frame about the ear-to-ear axis (approximately: a rotation in the screen plane)
    const ct = Math.cos(F.tilt), st = Math.sin(F.tilt);
    return [F.cx + (x * ct - y * st) * r, F.cy + (x * st + y * ct) * r, z];
  }
  const FOX = {};                                              // the rig of the frame being drawn (local units)
  function foxRig(p) {
    const R = FOX, g = p.gait, cur = p.curl, sit = p.sit;
    const bob = p.bob - (g > 0 ? 0.55 * g * Math.cos(p.ph * TAU * 2) : 0) - p.lift;
    const br = 0.18 * Math.sin(p.breath);
    // the body: rump, waist, chest; pitch tips it (nose down +), sitting lowers the rump, curling bends it round
    const pc = Math.cos(p.pitch), ps = Math.sin(p.pitch);
    const rot = (x, y) => [x * pc - y * ps, x * ps + y * pc];
    let [rx, ry] = rot(-5.8, -15.4), [mx, my] = rot(-0.2, -16.0), [cx, cy] = rot(5.2, -16.0);
    ry += bob; my += bob; cy += bob;
    if (sit > 0) { rx = lerp(rx, -4.5, sit); ry = lerp(ry, -6.8, sit); mx = lerp(mx, 0.3, sit); my = lerp(my, -12.5, sit); cx = lerp(cx, 4.6, sit); cy = lerp(cy, -18.0, sit); }
    if (cur > 0) { // lying curled: rump to the left, chest round in front, low to the ground
      rx = lerp(rx, -6, cur); ry = lerp(ry, -6.2, cur); mx = lerp(mx, 0, cur); my = lerp(my, -7.4, cur); cx = lerp(cx, 6.5, cur); cy = lerp(cy, -6.4, cur);
    }
    R.rump = [rx, ry, 5.7 + br * 0.5]; R.mid = [mx, my, 4.9 + br]; R.chest = [cx, cy, 5.4 + br];
    // the head: on the neck, ahead of the chest and above it
    let hxl = cx + 7.6 + p.hx, hyl = cy - 9.6 + p.hy - (g > 0 ? 0.35 * g * Math.cos(p.ph * TAU * 2 + 0.9) : 0);
    if (cur > 0) { hxl = lerp(hxl, 10.5, cur); hyl = lerp(hyl, -9.2, cur); }
    R.hc = [hxl, hyl]; R.hr = 7.1;
    const yaw = p.yaw, ya = yaw * PI / 2;
    R.F = { cx: hxl, cy: hyl, fx: Math.cos(ya), fz: Math.sin(ya), rx: -Math.sin(ya), rz: Math.cos(ya), tilt: p.tilt + p.nod + p.pitch * 0.5 };
    // legs: four foot paths (trot: diagonal pairs), with IK
    const legs = [];
    const A = p.A, lift = p.lift;
    const LEG = [ // [front?, near?, hip x, hip y, paw x, phase offset]
      [1, 1, cx + 1.2, cy + 2.8, cx + 1.6, 0.0], [1, 0, cx - 0.4, cy + 2.2, cx - 0.1, 0.5],
      [0, 1, rx - 0.6, ry + 2.8, rx - 1.0, 0.5], [0, 0, rx + 0.8, ry + 2.2, rx + 0.3, 0.0]];
    for (let k = 0; k < 4; k++) {
      const [fr, nr, hx, hy, px0] = LEG[k], off = LEG[k][5];
      let fx = px0, fy = 0;
      if (g > 0 && A > 0) {
        const q = frac(p.ph + off);
        if (q < 0.56) fx = px0 + A * (1 - 2 * q / 0.56);
        else { const u = (q - 0.56) / 0.44; fx = px0 - A + 2 * A * eis(u); fy = -(fr ? 3.4 : 2.8) * Math.sin(PI * u) * Math.min(1, A / 3); }
      }
      if (fr && nr && p.dig > 0) { // digging: the near forepaw reaches forward and scrapes back
        fx = lerp(fx, cx + 4.5 + p.digReach * 4.5, p.dig); fy = lerp(fy, -1.2 - 4.0 * clamp(p.digReach, 0, 1) * (1 - p.digReach * 0.5), p.dig);
      }
      if (p.lift > 0) { fy -= p.lift * 0.92; fx += (fr ? -1.2 : 1.4) * Math.min(1, p.lift / 4); }   // airborne: the paws leave the snow and tuck
      if (sit > 0 && !fr) { fx = lerp(fx, rx + 5.5, sit); }
      if (sit > 0 && fr) { fx = lerp(fx, cx + 1.4, sit); }
      if (cur > 0) { fx = lerp(fx, fr ? cx + 3.2 + (nr ? 0 : -1.5) : rx + 4.0 + (nr ? 0 : -1.5), cur); fy = lerp(fy, fr ? -0.8 : -1.0, cur); }
      const top = [hx, hy];
      if (fr) {
        const pawX = fx, pawY = fy - 1.5;
        const el = ik2(hx, hy, pawX - 0.3, pawY, 6.5, 6.4, cur > 0.5 ? -1 : 1);
        legs.push({ fr, nr, top, j1: el, j2: null, paw: [pawX, pawY] });
      } else {
        const pawX = fx, pawY = fy - 1.5, hk = [pawX - 1.5 + (sit > 0 ? -2.5 * sit : 0), pawY - 4.2 + (sit > 0 ? 2.6 * sit : 0)];
        const kn = ik2(hx, hy, hk[0], hk[1], 5.8, 5.6, -1);
        legs.push({ fr, nr, top, j1: kn, j2: hk, paw: [pawX, pawY] });
      }
    }
    R.legs = legs;
    // the tail: a chain from the rump, lifted and curled, its wag delayed down its length (follow-through)
    const tb = [rx - 5.0, ry - 1.4], wagD = p.wagD || ((d) => p.wag);
    const pts = [];
    for (let k = 0; k <= 8; k++) {
      const u = k / 8;
      // rest shape: out and back, then up toward the tip
      let ax = -u * 18 - u * u * 1.5 + u * u * u * 4, ay = u * 2.5 - u * u * 11.5;
      const lf = p.tLift * u, cu = p.tCurl * u * u;
      const ang = lf + wagD(u) * (0.25 + 0.75 * u) + cu * 1.2;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      let x = tb[0] + ax * ca - ay * sa, y = tb[1] + ax * sa + ay * ca;
      if (cur > 0) { // curled: from the rump along the front of the body (over the paws), its tip up over the nose
        const cx2 = -12 + 24.5 * u, cy2 = -2.6 - 1.2 * Math.sin(PI * u) - 9 * Math.max(0, u - 0.7) ** 1.2;
        x = lerp(x, cx2, cur); y = lerp(y, cy2, cur);
      }
      pts.push([x, y]);
    }
    R.tail = pts;
    return R;
  }
  const TAILR0 = (u) => (2.4 + 4.6 * Math.pow(Math.sin(PI * clamp(u * 0.86 + 0.07, 0, 1)), 0.55)) * (u > 0.92 ? 1 - (u - 0.92) * 4.5 : 1);
  let TAILK = 1;
  const TAILR = (u) => TAILR0(u) * TAILK;
  // fur grain: a tile of streaky noise (in local units), looked up cheaply
  const FURT = new Float32Array(64 * 64);
  for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) FURT[j * 64 + i] = (vn(i * 0.7 + j * 0.25, j * 2.2, 2.6, 771) - 0.5) * 1.1 + (vn(i * 1.6, j * 4.5, 2, 773) - 0.5) * 0.5;
  const furG = (x, y) => FURT[((fl(y * 2) & 63) << 6) | (fl(x * 2) & 63)];

  /* drawFox(p, sx, sy, S, f, light): screen point (sx, sy) is the ground under the body centre; S px per unit; f = ±1
     facing. light: {sky: [dx, dy] direction the sky light comes from, rim, amb, z: the fox's depth for the lamp,
     shadowY: where its shadow falls}. Returns the screen positions of the mouth and the eyes. */
  const FOXOUT = { mouth: [0, 0], nose: [0, 0], eye: [0, 0], head: [0, 0], chest: [0, 0] };
  let FXs = 0, FYs = 0, FS = 1, FF = 1, FLT = null, FP = null;
  const fX = (x) => FXs + FF * x * FS, fY = (y) => FYs + y * FS;
  function foxShade(X, Y, s, pass) {
    const S = FS, ol = Math.max(0.75, 0.55 * S);
    const id = SDF.id;
    if (-s < ol) return pass === 0 ? 196 : 176;                // the ink edge (darker still on the far side)
    const n = sdNormal(s), nx = n[0], ny = n[1], nc = n[2];
    const lx = (X + 0.5 - FXs) / (S * FF), ly = (Y + 0.5 - FYs) / S;
    const L = FLT;
    // sky light from above and behind (cool), a rim where the surface turns away, a little cool bounce from the snow
    const sdx = L.sky[0] * FF, sdy = L.sky[1];
    const dsk = nx * sdx + ny * sdy;
    let sk = L.amb + 0.55 * Math.max(0, dsk * 0.75 + nc * 0.4) + 0.12 * Math.max(0, ny);
    const rim = (1 - nc) * (1 - nc) * Math.max(0, dsk + 0.2) * L.rim;
    sk += rim;
    // the lantern (it hangs on the camera side, in front of the chest)
    let l = lampAt(X, Y, L.z, nx, Math.max(-0.98, ny)) * (L.gain || 1);
    // which fur: by part and region
    let m = M_FOX, g = furG(lx * 1.3, ly);
    if (id === 16) { // tail: white tip, a darker band before it, paler under
      const u = SDF.u;
      if (u > 0.8 + 0.03 * Math.sin(SDF.lat * 7)) m = M_FOXW; else if (u > 0.66) sk -= 0.12;
      g = furG(u * 22, SDF.lat * 3 + SDF.side * 4) * 1.3;
      if (SDF.lat > 0.75) sk += 0.05;
    } else if (id === 8 || id === 9) { // ears: black tips, black backs on the far ear, cream insides on the near
      const u = SDF.u;
      if (u > 0.6) m = M_FOXK;
      else if (id === 8 && SDF.side * FF * FP.earSide > 0 && SDF.lat < 0.78 && u > 0.1) { m = M_EARIN; sk += 0.1; }
      else if (id === 9) sk -= 0.08;
    } else if (id === 7) m = M_FOXW;
    else if (id === 6) { // muzzle: white below the line from the nose to the cheek, orange above
      const F = FOX.F;
      if ((SDF.side * FF > 0 && SDF.lat > 0.12) || (F.fz > 0.75 && SDF.lat < 0.55) || SDF.u > 0.9) m = M_FOXW;
    } else if (id === 5) {
      // the head: a white blaze round the muzzle and under the eyes
      const F = FOX.F, hc = FOX.hc, r = FOX.hr;
      const dx = (lx - hc[0]) / r, dy = (ly - hc[1]) / r, fw = dx * F.fx;
      if (dy > 0.32 - 0.38 * clamp(fw, -0.2, 1) + 0.06 * Math.sin(dx * 9)) m = M_FOXW;
    } else if (id >= 10 && id <= 15) { // legs: black socks below the elbow and hock
      const u = SDF.u;
      if ((id === 10 || id === 11 || id === 12) ? u > 0.62 + 0.06 * Math.sin(lx * 3) : u > 0.74) m = M_FOXK;
      if (id === 12 || id === 15) m = M_FOXK;
    } else if (id === 3 || id === 4) {
      // the bib: white down the front of the throat and chest (not round the back of the neck)
      const ch = FOX.chest;
      if (id === 4) { if (SDF.side * FF > 0 && SDF.lat > 0.25 - 0.1 * Math.sin(ly * 2.5)) m = M_FOXW; }
      else if (lx > ch[0] + 1.2 + 0.6 * Math.sin(ly * 2.4) && ly > ch[1] - 3.2) m = M_FOXW;
    } else if (id === 1 || id === 2) {
      if (ly > FOX.mid[1] + 3.3) sk += 0.06;
    }
    if (m === M_FOXK) g *= 0.6;
    sk += g * 0.11;
    if (pass === 0) { sk *= 0.72; l *= 0.62; }
    return mcq(m, sk, l, X, Y);
  }
  function foxPassFar(R) {
    sdBegin();
    const S = FS;
    for (const g of R.legs) if (!g.nr) foxLeg(g);
    // the far ear (behind the head)
    const E = R.earF; sdCap(fX(E[0]), fY(E[1]), fX(E[2]), fY(E[3]), 4.3 * S, 0.7 * S, 0.6 * S, 9, 0, 1, 0.2 * S);
    sdDraw((X, Y, s) => foxShade(X, Y, s, 0));
  }
  function foxLeg(g) {
    const S = FS, [hx, hy] = g.top, [jx, jy] = g.j1, [px, py] = g.paw, idb = g.fr ? 10 : 13;
    if (g.fr) {
      sdCap(fX(hx), fY(hy), fX(jx), fY(jy), 2.5 * S, 1.6 * S, 1.2 * S, idb, 0, 0.5);
      sdCap(fX(jx), fY(jy), fX(px), fY(py), 1.6 * S, 1.35 * S, 0.7 * S, idb + 1, 0.5, 1);
      sdBall(fX(px + 0.6), fY(py + 0.35), 1.7 * S, 0.8 * S, 12);
    } else {
      const [kx, ky] = g.j2;
      sdCap(fX(hx), fY(hy), fX(jx), fY(jy), 3.5 * S, 2.1 * S, 1.6 * S, idb, 0, 0.4);
      sdCap(fX(jx), fY(jy), fX(kx), fY(ky), 2.0 * S, 1.4 * S, 1.0 * S, idb + 1, 0.4, 0.7);
      sdCap(fX(kx), fY(ky), fX(px), fY(py), 1.4 * S, 1.3 * S, 0.6 * S, idb + 1, 0.7, 1);
      sdBall(fX(px + 0.5), fY(py + 0.35), 1.65 * S, 0.8 * S, 15);
    }
  }
  function foxPassTail(R, k0, k1) {
    sdBegin();
    const S = FS, T = R.tail;
    for (let k = k0 || 0; k < (k1 || 8); k++) {
      const u0 = k / 8, u1 = (k + 1) / 8;
      sdCap(fX(T[k][0]), fY(T[k][1]), fX(T[k + 1][0]), fY(T[k + 1][1]), TAILR(u0) * S, TAILR(u1) * S, 1.4 * S, 16, u0, u1, 0.62 * S);
    }
    sdDraw((X, Y, s) => foxShade(X, Y, s, 1));
  }
  function foxPassBody(R) {
    sdBegin();
    const S = FS, ru = R.rump, mi = R.mid, ch = R.chest, hc = R.hc;
    sdCap(fX(ru[0]), fY(ru[1]), fX(mi[0]), fY(mi[1]), ru[2] * S, mi[2] * S, 2.5 * S, 1, 0, 0.5, 0.3 * S);
    sdCap(fX(mi[0]), fY(mi[1]), fX(ch[0]), fY(ch[1]), mi[2] * S, ch[2] * S, 2.5 * S, 2, 0.5, 1, 0.25 * S);
    // the neck up into the head's ruff, and the chest's fluff
    sdCap(fX(ch[0] + 1.2), fY(ch[1] - 1.5), fX(hc[0] - 2.4), fY(hc[1] + 3.8), 4.6 * S, 3.8 * S, 2.4 * S, 4, 0, 1, 0.3 * S);
    sdBall(fX(ch[0] + 3.0), fY(ch[1] + 0.8), 3.9 * S, 2.0 * S, 3, 0.45 * S);
    for (const g of R.legs) if (g.nr) foxLeg(g);
    sdDraw((X, Y, s) => foxShade(X, Y, s, 1));
  }
  function foxPassHead(R) {
    sdBegin();
    const S = FS, F = R.F, hc = R.hc, r = R.hr;
    sdBall(fX(hc[0]), fY(hc[1]), r * S, 1.5 * S, 5);
    // the muzzle: out along the face's forward direction, a little below centre
    const m0 = hfeat(F, 0, -0.32, r * 0.42), m1 = hfeat(F, 0, -0.33, r * 1.3);
    sdCap(fX(m0[0]), fY(m0[1]), fX(m1[0]), fY(m1[1]), 3.6 * S, 1.9 * S, 1.8 * S, 6, 0, 1);
    FOXOUT.mzl = hfeat(F, 0, -0.42, r * 0.62);
    // cheek ruffs: white tufts out at the sides, low
    for (const sd of [1, -1]) {
      const c = hfeat(F, sd * 1.38, -0.52, r * 0.82);
      if (c[2] > -0.55) sdBall(fX(c[0]), fY(c[1] + 0.4), (3.5 + 0.6 * c[2]) * S, 1.6 * S, 7, 0.55 * S);
    }
    // the near ear
    const E = R.earN;
    sdCap(fX(E[0]), fY(E[1]), fX(E[2]), fY(E[3]), 4.5 * S, 0.7 * S, 1.0 * S, 8, 0, 1, 0.2 * S);
    sdDraw((X, Y, s) => foxShade(X, Y, s, 1));
  }
  function foxEars(R, p) {
    const F = R.F, r = R.hr;
    // base on the crown; tip up and out; perk lifts them, earN/earF swing them back (+) or forward
    const ear = (sd, swing) => {
      const b = hfeat(F, sd * 0.78, 0.98, r * 0.78);
      const side = b[0] - F.cx;                               // ears flare away from the middle of the head
      const a = -PI / 2 + clamp(side / r, -1, 1) * 0.42 - swing + F.tilt * 0.8 + F.fx * 0.1;
      const L = 10.6 + 1.0 * p.perk;
      return [b[0], b[1], b[0] + Math.cos(a) * L * 0.9, b[1] + Math.sin(a) * L, b[2]];
    };
    const e1 = ear(1, p.earN), e2 = ear(-1, p.earF);
    // whichever base is nearer the camera is the near ear
    if (e1[4] >= e2[4]) { R.earN = e1; R.earF = e2; p.earSide = 1; } else { R.earN = e2; R.earF = e1; p.earSide = -1; }
  }
  // eyes, nose, mouth and whiskers, drawn over the head
  function foxFace(R, p) {
    const S = FS, F = R.F, r = R.hr;
    const L = FLT;
    // eyes
    for (const sd of [1, -1]) {
      const e = hfeat(F, sd * 0.56, 0.16, r * 0.98);
      if (e[2] < 0.3) continue;
      const vis = clamp((e[2] - 0.3) / 0.3, 0, 1);
      const ex = fX(e[0]), ey = fY(e[1]);
      if (sd === 1 || e[2] > 0) { FOXOUT.eye = [ex, ey]; }
      const rh = (2.25 + 0.45 * p.wide) * S, rw = rh * (0.42 + 0.5 * e[2]) * (0.75 + 0.25 * vis);
      const open = clamp(p.eyes, 0, 1), happy = p.happy;
      const x0 = fl(ex - rw - 2), x1 = Math.ceil(ex + rw + 2), y0 = fl(ey - rh - 2), y1 = Math.ceil(ey + rh + 2);
      const lidY = ey - rh + (1 - open) * 2 * rh;            // the upper lid comes down to here
      const lw = Math.max(0.6, 0.38 * S);
      for (let Y = Math.max(ROW0, y0); Y <= Math.min(ROW1, y1); Y++) for (let X = Math.max(0, x0); X <= Math.min(W - 1, x1); X++) {
        const u = (X + 0.5 - ex) / rw, v = (Y + 0.5 - ey) / rh, d = u * u + v * v;
        if (p.sleep > 0.5) { // asleep: a soft downward curve of lid and lashes, two pixels thick
          const av = v + 0.05, ad = Math.sqrt(u * u * 0.8 + av * av * 1.8);
          if (Math.abs(ad - 0.62) < lw / rh * 1.6 && av > -0.05) BUF[Y * W + X] = ad > 0.62 ? 176 : 177;
          continue;
        }
        if (happy > 0.5) { // closed in a smile: an arch
          const av = v + 0.15, ad = Math.sqrt(u * u * 0.85 + av * av * 1.4);
          if (Math.abs(ad - 0.72) < lw / rh * 0.9 && av < 0.18) BUF[Y * W + X] = 176;
          continue;
        }
        if (open < 0.2) { if (Math.abs(v - 0.15) < lw / rh && Math.abs(u) < 0.95) BUF[Y * W + X] = 176; continue; }
        if (d > 1) continue;
        if (Y + 0.5 < lidY) continue;
        if (Y + 0.5 < lidY + lw * 1.2 && open < 0.98) { BUF[Y * W + X] = 176; continue; }
        // the eye: a dark glossy ball; a warm iris low where the lantern lights it; catchlights
        const lx = u - p.lookX * 0.18, ly = v - p.lookY * 0.16;
        let c = 195;
        if (d > 0.8 && S < 1.6) c = 195;
        else {
          const warm = clamp(LAMP.I * 0.8, 0, 1);
          if (ly > 0.2 && S >= 1.3) c = ly > 0.55 ? (warm > 0.3 ? 178 : 197) : (warm > 0.3 ? 177 : 196);
          if (lx * lx + ly * ly < 0.16 && S >= 1.8) c = 195;
        }
        // highlights: the big one up and toward the sky, a little one opposite, the lantern's spark low
        const h1x = u + 0.34 * FF * (L.sky[0] < 0 ? 1 : -1) * -1, h1y = v + 0.38;
        if (h1x * h1x + h1y * h1y < (S >= 2 ? 0.1 : 0.16)) c = 22;
        else if (S >= 1.6) {
          const h2x = u - 0.38 * FF, h2y = v - 0.34;
          if (h2x * h2x + h2y * h2y < 0.035) c = 194;
          const h3x = u + 0.05, h3y = v - 0.52;
          if (LAMP.I > 0.25 && h3x * h3x * 2 + h3y * h3y * 3 < 0.06) c = 183;
        }
        if (d > 0.82 && S >= 2) c = c === 22 ? 22 : 195;
        BUF[Y * W + X] = c;
      }
    }
    // the nose: a small glossy button at the muzzle's tip
    const nz = hfeat(F, 0, -0.27, r * 1.4);
    const nx = fX(nz[0]), ny = fY(nz[1]), nr = Math.max(0.9, 1.25 * S);
    for (let Y = fl(ny - nr - 1); Y <= Math.ceil(ny + nr + 1); Y++) for (let X = fl(nx - nr * 1.4 - 1); X <= Math.ceil(nx + nr * 1.4 + 1); X++) {
      if (Y < ROW0 || Y > ROW1 || X < 0 || X >= W) continue;
      const u = (X + 0.5 - nx) / (nr * (1.05 + 0.25 * F.fz)), v = (Y + 0.5 - ny) / nr;
      if (u * u + v * v * (v < 0 ? 1.4 : 1) > 1) continue;
      BUF[Y * W + X] = (u + 0.35 * FF) * (u + 0.35 * FF) + (v + 0.4) * (v + 0.4) < 0.16 && S >= 1.2 ? 197 : 195;
    }
    if (S >= 1.5) P(nx - FF * 0.3 * S, ny - 0.45 * S, 194);
    // the mouth: a little line back from under the nose (open around the bail when carrying, a smile when happy)
    const m0 = hfeat(F, 0, -0.5, r * 1.18), mback = hfeat(F, -0.3 * (1 - F.fz), -0.6, r * 0.95);
    if (S >= 1.1) {
      const ax = fX(m0[0]), ay = fY(m0[1]), bx = fX(mback[0]), by = fY(mback[1]) + (p.happy > 0 || p.mouth === 2 ? -0.8 * S : 0.3 * S);
      lineF(nx, ny + nr * 0.8, ax, ay, (x, y) => P(x, y, 176));
      lineF(ax, ay, bx, by, (x, y, u) => { if (u < 0.92) P(x, y, 176); });
      if (p.mouth === 2 && S >= 1.6) { // an open happy mouth: a dark crescent with a pink tongue
        const cx = (ax + bx) / 2, cy = (ay + by) / 2 + 0.9 * S;
        for (let Y = fl(cy - 1.4 * S); Y <= Math.ceil(cy + 1.4 * S); Y++) for (let X = fl(cx - 2 * S); X <= Math.ceil(cx + 2 * S); X++) {
          const u = (X + 0.5 - cx) / (1.9 * S), v = (Y + 0.5 - cy) / (1.2 * S);
          if (u * u + v * v < 1 && v > -0.3) P(X, Y, v > 0.35 && Math.abs(u) < 0.6 ? 254 : 177);
        }
      }
    }
    // whiskers (only close up): fine pale lines that catch the light
    if (S >= 2.2 && p.whisk) {
      for (let k = 0; k < 2; k++) {
        const a0 = hfeat(F, 0.22, -0.4 - k * 0.07, r * 1.18), wx = fX(a0[0]), wy = fY(a0[1]);
        const ang = (-0.25 + k * 0.22), L = (4.8 - k * 0.6) * S;
        lineF(wx, wy, wx + FF * Math.cos(ang) * L, wy + Math.sin(ang) * L + L * 0.12, (x, y, u) => { if (u > 0.3 && bay(x, y) < 0.7 - u * 0.6) P(x, y, LAMP.I > 0.4 ? 190 : 192); });
      }
    }
  }
  // set up the rig for a frame (no drawing): where its mouth, nose, head and chest land on screen
  function foxPrep(p, sx, sy, S, f, light) {
    p = foxPose(p);
    FXs = sx; FYs = sy; FS = S; FF = f; FLT = light; FP = p;
    const R = foxRig(p);
    if (p.sq) { // squash and stretch about the ground point
      const ky = 1 - p.sq * 0.42, kx = 1 + p.sq * 0.3;
      const sc = (q) => { q[0] *= kx; q[1] *= ky; };
      [R.rump, R.mid, R.chest, R.hc].forEach(sc); R.F.cx = R.hc[0]; R.F.cy = R.hc[1];
      for (const g of R.legs) { sc(g.top); sc(g.j1); if (g.j2) sc(g.j2); sc(g.paw); }
      R.tail.forEach(sc);
    }
    foxEars(R, p);
    const F = R.F, r = R.hr;
    const m0 = hfeat(F, 0, -0.5, r * 1.18), mb = hfeat(F, -0.3 * (1 - F.fz), -0.6, r * 0.95);
    FOXOUT.mouth = [fX(lerp(m0[0], mb[0], 0.45)), fY(lerp(m0[1], mb[1], 0.45) + 0.5)];
    const nz = hfeat(F, 0, -0.27, r * 1.4); FOXOUT.nose = [fX(nz[0]), fY(nz[1])];
    FOXOUT.head = [fX(R.hc[0]), fY(R.hc[1])]; FOXOUT.chest = [fX(R.chest[0]), fY(R.chest[1])];
    FOXOUT.top = fY(Math.min(R.earN[3], R.earF[3])); FOXOUT.p = p; FOXOUT.R = R;
    return FOXOUT;
  }
  function drawFox(p, sx, sy, S, f, light) {
    foxPrep(p, sx, sy, S, f, light);
    p = FP; const R = FOXOUT.R;
    TAILK = 1 - 0.18 * clamp(p.curl, 0, 1);
    foxPassFar(R);
    if (p.curl < 0.5) foxPassTail(R);
    foxPassBody(R);
    if (p.preHead) p.preHead();
    foxPassHead(R);
    foxFace(R, p);
    if (p.curl >= 0.5) foxPassTail(R);                           // curled: the tail round the front, its tip over the nose
    return FOXOUT;
  }

  /* ================================================================ the lantern
     An old brass hand lantern: a wire bail, a vented conical cap with a knob, four glass panes in a brass frame (seen
     corner-on: two edge bars and a middle one), a stub of candle with its flame, a ridged base. Local units, the bail's
     top (where it is held) at (0, 0), y down; the flame's heart at (0, 10). Drawn by inverse-rotating each pixel by the
     swing angle. The candle's flicker is slow noise: it breathes, it never strobes. */
  const LANT_FLAME = [0, 10.1];
  const flick = (t) => 1 + 0.045 * n1(t * 7.3, 811) + 0.03 * n1(t * 15.1, 812) + 0.02 * Math.sin(t * 4.1);
  // the pendulum: θ (0 = hanging straight down, + swings the lantern toward +x) for a pivot moving along piv(t) →
  // [x, y] in lantern units; integrated over the last 1.6 s from rest at its equilibrium (so: a pure function of t)
  const PEND_X = new Float64Array(400), PEND_Y = new Float64Array(400);
  function pendulum(t, piv, tStart) {
    const h = 1 / 120, Tw = Math.min(1.6, Math.max(0, t - (tStart === undefined ? -1e9 : tStart)));
    const n = Math.max(2, Math.round(Tw / h)) + 2;
    for (let k = 0; k < n; k++) { const p = piv(t - (n - 2 - k) * h); PEND_X[k] = p[0]; PEND_Y[k] = p[1]; }
    const g = 980, L = 9.5, c = 3.2;
    // start: the angle that balances the pivot's acceleration at the window's start
    const ax0 = (PEND_X[2] - 2 * PEND_X[1] + PEND_X[0]) / (h * h), ay0 = (PEND_Y[2] - 2 * PEND_Y[1] + PEND_Y[0]) / (h * h);
    let th = clamp(Math.atan2(-ax0, g + ay0), -0.5, 0.5), w = 0;
    for (let k = 1; k < n - 1; k++) {
      const ax = (PEND_X[k + 1] - 2 * PEND_X[k] + PEND_X[k - 1]) / (h * h), ay = (PEND_Y[k + 1] - 2 * PEND_Y[k] + PEND_Y[k - 1]) / (h * h);
      const acc = -((g + ay) * Math.sin(th) + ax * Math.cos(th)) / L - c * w;
      w += acc * h; th += w * h;
      th = clamp(th, -0.9, 0.9);
    }
    return th;
  }
  // where the flame is on screen for a lantern held at (px, py), scale S, swing th
  function lanternFlame(px, py, S, th) { const c = Math.cos(th), s = Math.sin(th); return [px - s * LANT_FLAME[1] * S + c * LANT_FLAME[0] * S, py + c * LANT_FLAME[1] * S]; }
  const R_BRASS = [195, 198, 173, 174, 175, 199, 200, 22];
  /* o: { snow (0..1: snow lying on it), lit (0..1 how alive the flame is), bury: screen y below which it is hidden,
     t, cut(x, y) → true to skip a pixel } */
  function drawLantern(px, py, S, th, o) {
    o = o || {};
    const t = o.t || T_NOW, lit = o.lit === undefined ? 1 : o.lit, ca = Math.cos(th), sa = Math.sin(th);
    const R = 16.5 * S, x0 = Math.max(0, fl(px - R)), x1 = Math.min(W - 1, Math.ceil(px + R)), y0 = Math.max(ROW0, fl(py - 2 * S)), y1 = Math.min(ROW1, Math.ceil(py + R)), iS = 1 / S;
    const fk = flick(t), sway = 0.32 * n1(t * 3.1, 821) + 0.18 * Math.sin(t * 9.3), hw = Math.max(0.5, 0.65 * iS);
    const bury = o.bury === undefined ? 1e9 : o.bury, snow = o.snow || 0;
    for (let Y = y0; Y <= y1; Y++) {
      if (Y >= bury) break;
      for (let X = x0; X <= x1; X++) {
        const dx = X + 0.5 - px, dy = Y + 0.5 - py;
        const u = (dx * ca + dy * sa) * iS, v = (-dx * sa + dy * ca) * iS;
        if (v < -1 || v > 15.3 || u < -4.6 || u > 4.6) continue;
        if (o.cut && o.cut(X, Y)) continue;
        const b = bay(X, Y);
        let c = -1;
        // the bail: a wire half-hoop over the cap
        if (v < 4.4) {
          const bd = Math.hypot(u, v - 4.2) - 3.6;
          if (Math.abs(bd) < hw && v < 4.2) c = u < -0.8 ? R_BRASS[4] : u < 1.2 ? R_BRASS[5] : R_BRASS[3];
          if (v > 3.4 && Math.abs(u) < 1.0 && Math.hypot(u, v - 4.3) < 0.95) c = u < 0 ? R_BRASS[5] : R_BRASS[3];   // the knob
        }
        if (c < 0 && v >= 4.6 && v < 7.7) {
          // the cap: a cone with a vent ring, and its rolled rim
          const q = (v - 4.6) / 2.4, wc = v < 7.0 ? lerp(1.3, 3.9, q) : 4.25;
          if (Math.abs(u) < wc) {
            const nx = u / wc;
            let val = 0.42 - nx * 0.33 + (v < 7.0 ? -q * 0.12 : 0.12) + (1 - nx * nx) * 0.1;
            if (v > 7.0) val += 0.18 - Math.abs(v - 7.35) * 0.35;
            if (v > 5.3 && v < 5.9 && Math.abs(Math.sin(u * 2.6)) > 0.7 && v < 7.0) val -= 0.35;       // the vents
            if (Math.abs(nx + 0.45) < 0.12 && v < 7.0) val += 0.35;                                       // the gleam
            if (v > 7.4) val += 0.25 * lit;                                                               // lit from below
            if (snow > 0 && v < 4.6 + 2.4 * snow * (1.2 - 0.6 * Math.abs(nx)) && v < 7.0 + snow * 0.5 && ih(fl(u * 3), 0, 831) < 0.5 + snow * 0.5) c = v < 5.2 ? 22 : nx < 0.2 ? 194 : 168;
            else c = rp(R_BRASS, clamp(val, 0, 1), b);
          }
        }
        if (c < 0 && v >= 7.7 && v < 13.7) {
          const wg = 3.45 + 0.22 * Math.sin(PI * (v - 7.7) / 6);
          if (Math.abs(u) < wg) {
            const eu = Math.abs(u);
            // frame bars: the two edges and the middle (a corner of the lantern toward us)
            if (eu > wg - 0.75 || Math.abs(u - 0.15) < 0.38 || v < 8.05 || v > 13.35) {
              const val = 0.36 + (u < 0 ? 0.18 : -0.1) + (Math.abs(u - 0.15) < 0.38 ? 0.12 : 0) + 0.3 * lit * (1 - eu / wg);
              c = rp(R_BRASS, clamp(val, 0, 1), b);
              if (v > 13.35 || v < 8.05) c = rp(R_BRASS, clamp(0.3 + (u < 0 ? 0.2 : 0) + 0.25 * lit, 0, 1), b);
            } else {
              // inside the glass: the candle, its flame, the glow on the glass
              const fy = (v - 7.9) / 3.3;                                        // 0 at the tip … 1 at the base of the flame
              const fu = u - sway * (1 - fy) * (1 - fy) * 1.2;
              let fw = fy > 0 && fy < 1 ? 1.05 * Math.pow(Math.sin(PI * (0.08 + 0.86 * fy)), 0.85) * (0.75 + 0.25 * fk) * fy : 0;
              const inFl = lit > 0.05 && Math.abs(fu) < fw * lit;
              if (inFl) {
                const k = Math.abs(fu) / (fw * lit + 1e-6);
                c = fy > 0.78 && k < 0.5 ? (lit > 0.6 ? 59 : 201) : k < 0.42 && fy > 0.35 ? 60 : k < 0.75 ? (fy < 0.3 ? 201 : 16) : 201;
                if (fy > 0.9 && k < 0.35) c = 47;                                // the blue root of the flame
              } else if (v > 11.25 && Math.abs(u) < 1.05) {
                // the candle: a cream stub, a drip, the wick
                const top = 11.25 + 0.18 * Math.sin(u * 3);
                c = v < top + 0.4 ? (lit > 0.3 ? 187 : 189) : u < -0.45 ? 189 : u < 0.3 ? 188 : 190;
                if (Math.abs(u - 0.62) < 0.22 && v < 12.6) c = 187;
              } else if (v > 10.9 && v < 11.4 && Math.abs(u) < 0.12) c = 195;
              else {
                // the glass, lit from inside: hottest by the flame, a soot shadow at the top, a reflection streak
                const d = Math.hypot(u * 0.9, v - 10.0);
                let val = lit * (1.05 - d / 4.6) * (0.92 + 0.08 * fk);
                if (v < 8.8) val -= 0.25;
                if (Math.abs(u + wg * 0.58) < 0.32 && v > 8.6 && v < 12.8) val += 0.35;
                c = val > 0.82 ? 200 : val > 0.62 ? 199 : val > 0.44 ? (b < 0.5 ? 183 : 182) : val > 0.28 ? 182 : val > 0.14 ? 181 : lit > 0.05 ? 180 : (b < 0.5 ? 196 : 197);
              }
            }
          }
        }
        if (c < 0 && v >= 13.7 && v < 15.2) {
          // the base: a rolled ring, ridged
          const wb = 4.05 - (v - 13.7) * 0.25;
          if (Math.abs(u) < wb) {
            const nx = u / wb;
            let val = 0.5 - nx * 0.3 - (v - 13.7) * 0.18 + (v < 14.1 ? 0.22 * lit : 0);
            if (Math.abs(v - 14.4) < 0.18) val -= 0.25;
            c = rp(R_BRASS, clamp(val, 0, 1), b);
          }
        }
        if (c >= 0) BUF[Y * W + X] = c;
      }
    }
  }
  // the lantern's halo: a soft warm glow round the glass (bloom does the rest)
  function lanternGlow(fx, fy, S, lit) {
    if (lit <= 0.02) return;
    const fk = flick(T_NOW);
    glow(fx, fy, 30 * S * lit * fk, T_LAMP, 0.42 * lit);
    glow(fx, fy, 12 * S * lit, T_WARM, 0.35 * lit);
  }

  /* ================================================================ the scene kit
     Keyframe tracks; painters that write scenery into G-buffer layers (snowy pines with boughs that droop under their
     snow, snow ground with drifts and sparkle seeds, bark, rock); the sky; snow falling in depth. */
  // keyframes: [{t, e (ease into this key: 'io' | 'o' | 'i' | 's' sine | 'l' | 'b' back), ...numbers}] → eased values
  const KE = { io: eio, o: eoc, i: eic, s: eis, l: (u) => u, b: eob, h: (u) => (u >= 1 ? 1 : 0) };
  function kt(keys, t, out) {
    out = out || {};
    let k = 0;
    while (k < keys.length - 1 && keys[k + 1].t <= t) k++;
    const A = keys[k], B = keys[k + 1];
    for (const f in A) if (f !== 't' && f !== 'e') out[f] = A[f];
    if (B && t > A.t) {
      const u = KE[B.e || 's'](clamp((t - A.t) / (B.t - A.t), 0, 1));
      for (const f in B) if (f !== 't' && f !== 'e' && typeof B[f] === 'number') { const a = typeof A[f] === 'number' ? A[f] : B[f]; out[f] = a + (B[f] - a) * u; }
    }
    return out;
  }
  // fill missing fields forward so every key carries every value
  function KF(...keys) { for (let i = 1; i < keys.length; i++) for (const f in keys[i - 1]) if (!(f in keys[i]) && f !== 'e') keys[i][f] = keys[i - 1][f]; return keys; }
  // a smooth bump: 0 → 1 → 0 over [a, b]
  const bump = (a, b, x) => (x <= a || x >= b ? 0 : Math.sin(PI * (x - a) / (b - a)));

  /* ---------------------------------------------------------------- sky (a direct-colour layer) */
  function paintSky(L, ramp, y0, y1, seed) {
    for (let y = 0; y < L.h; y++) {
      const f = clamp((y - y0) / (y1 - y0), 0, 0.9999) * (ramp.length - 1), k = fl(f), r = f - k;
      for (let x = 0; x < L.w; x++) {
        const n = (vn(x, y, 40, seed) - 0.5) * 0.35;
        const kk = clamp(fl(f + n + (bay(x, y) - 0.5) * 0.9 + 0.5), 0, ramp.length - 1);
        lputC(L, x, y, ramp[kk]);
      }
    }
  }
  // the same gradient drawn live, dithered in screen space (crisp at any zoom): layer rows y0 → y1 over the ramp
  function skyLive(ramp, y0, y1, ox, oy, z, seed) {
    const n = ramp.length - 1, iz = 1 / z;
    for (let Y = ROW0; Y <= ROW1; Y++) {
      const ly = oy + (Y + 0.5 - 135) * iz, f0 = clamp((ly - y0) / (y1 - y0), 0, 0.9999) * n, o = Y * W;
      for (let X = 0; X < W; X++) {
        const lx = ox + (X + 0.5 - 240) * iz, nn = (vn(lx, ly, 40, seed) - 0.5) * 0.35;
        BUF[o + X] = ramp[clamp(fl(f0 + nn + (BAYF[((Y & 7) << 3) | (X & 7)] - 0.5) * 0.9 + 0.5), 0, n)];
      }
    }
  }
  function paintStars(L, n, yMax, seed, cols) {
    for (let k = 0; k < n; k++) {
      const x = fl(ih(k, 1, seed) * L.w), y = fl(ih(k, 2, seed) * yMax), b = ih(k, 3, seed);
      lputC(L, x, y, b > 0.93 ? cols[2] : b > 0.6 ? cols[1] : cols[0]);
      if (b > 0.97) { lputC(L, x + 1, y, cols[0]); lputC(L, x - 1, y, cols[0]); lputC(L, x, y + 1, cols[0]); lputC(L, x, y - 1, cols[0]); }
    }
  }
  // twinkling stars drawn live over the sky (they shimmer gently, never blink hard)
  function liveStars(t, n, seed, ox, oy, zoom, yMax, okc) {
    for (let k = 0; k < n; k++) {
      const wx = ih(k, 1, seed) * 900, wy = ih(k, 2, seed) * yMax;
      const X = fl(toSX(ox, zoom, wx)), Y = fl(toSY(oy, zoom, wy));
      if (X < 0 || X >= W || Y < ROW0 || Y > ROW1) continue;
      const i = Y * W + X; if (okc && !okc(BUF[i])) continue;
      const tw = 0.5 + 0.5 * Math.sin(t * (1.1 + ih(k, 3, seed) * 1.6) + ih(k, 4, seed) * 6.28), b = ih(k, 5, seed) * (0.55 + 0.45 * tw);
      BUF[i] = b > 0.8 ? 22 : b > 0.55 ? 194 : b > 0.3 ? 207 : 206;
      if (b > 0.86 && zoom > 0.9) { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (Y + dy) * W + X + dx; if (Y + dy >= ROW0 && Y + dy <= ROW1 && (!okc || okc(BUF[j]))) BUF[j] = 206; } }
    }
  }

  /* ---------------------------------------------------------------- snowy pines
     A fir loaded with snow: tiers of boughs, each a drooping fan whose upper face carries a cap of snow in soft clumps
     and whose tips hang under the weight; dark needles beneath with a ragged fringe; the trunk shows below the lowest
     tier. lod 0 (far silhouette) … 2 (near, every clump and needle). z: depth (layer units) at the base. */
  function paintPine(L, x, yb, h, w, seed, z, lod, o) {
    o = o || {};
    const top = yb - h, nT = Math.max(3, Math.round(h / (lod >= 2 ? 13 : lod ? 11 : 9))), trunkW = Math.max(1, w * 0.085);
    const snowAmt = o.snow === undefined ? 1 : o.snow, lean = o.lean || 0, pine = o.dark ? M_PINED : M_PINE;
    // trunk first (behind the boughs)
    const tTop = top + h * 0.15;
    for (let y = fl(tTop); y < yb + 2; y++) {
      const tw = trunkW * (1 + 0.5 * sstep(yb - 8, yb + 2, y));
      for (let dx = -Math.ceil(tw); dx <= Math.ceil(tw); dx++) {
        const q = dx / tw; if (Math.abs(q) > 1) continue;
        const gr = lod >= 1 ? (vn(dx * 3 + x, y * 0.35, 1.5, seed + 5) - 0.5) * 0.35 : 0;
        lput(L, x + dx + lean * (yb - y) / h, y, M_BARK, 0.32 - q * 0.22 + gr, z, q * 0.9, 0, 0);
      }
    }
    const TS = [], TSN = [];
    for (let i = 0; i < 8; i++) TS.push(ih(i, 31, seed));
    for (let i = 0; i < nT; i++) TSN.push(0.55 + 0.6 * ih(i, 33, seed));
    for (let i = 0; i < nT; i++) {
      const f0 = (i + 0.0) / nT, f1 = (i + 1) / nT;
      const yt = top + h * 0.92 * Math.pow(f0, 1.06), th = h * 0.92 * (Math.pow(f1, 1.06) - Math.pow(f0, 1.06)) * 1.55 + 3;
      const wi = w * (0.18 + 0.82 * Math.pow(f1, 0.9)) * (0.86 + 0.28 * ih(i, 1, seed));
      const cx = x + lean * (yb - yt) / h + (ih(i, 2, seed) - 0.5) * w * 0.08;
      const droop = th * (0.42 + 0.25 * ih(i, 3, seed));
      for (let dy = 0; dy < th + droop + 2; dy++) {
        const y = fl(yt + dy);
        for (let dx = -Math.ceil(wi) - 2; dx <= Math.ceil(wi) + 2; dx++) {
          const ax = Math.abs(dx) / wi, side = dx < 0 ? -1 : 1;
          if (ax > 1.12) continue;
          // the bough's outline: widening down from the tier's top; the underside hangs lower toward the tips
          const fr = lod >= 1 ? (ih(dx + x * 3, fl(dy / 2), seed + 7) - 0.5) * 0.16 + (vn(dx * 0.9, i * 7, 2.2, seed + 9) - 0.5) * 0.18 : 0;
          // the bough is a fan of branches: fingers out from the trunk, with gaps between them
          const fing = 0.5 + 0.5 * Math.sin(dx * (6.5 / Math.max(4, wi)) * PI * 0.5 + i * 2.1 + TS[i % 8] * 6), fg = lod ? fing : 0.6;
          const reach = Math.pow(clamp(dy / (th * 0.62), 0, 1), 0.62) * (1 + fr) * (0.86 + 0.16 * fg);
          if (ax > reach) continue;
          const yBot = th * (0.42 + 0.2 * fg) + droop * Math.pow(ax, 1.6) * (0.7 + 0.5 * fg) + (lod >= 1 ? (ih(dx * 5 + x, i, seed + 11) - 0.5) * 3.2 + (ih(fl((dx + 300) / 2), i, seed + 12) < 0.3 ? 2.5 : 0) : 0);
          if (dy > yBot) continue;
          // snow on the upper face: pillows along each branch, more on the windward side, thinning toward the tips
          const surf = Math.pow(ax / Math.max(0.05, reach), 2.0) * th * 0.18 - fg * 1.2;
          const sThick = (th * (0.24 - 0.1 * ax) * (0.45 + 0.85 * fg) + (lod >= 1 ? (vn(dx * 0.7 + x, i * 3.1, 2.6, seed + 13) - 0.42) * th * 0.4 : 0)) * snowAmt * TSN[i] * (side < 0 ? 1.08 : 0.86);
          const depthS = dy - surf;                                                     // below the face's top
          const onSnow = snowAmt > 0 && depthS < sThick && dy < yBot - 1.2;
          const ex = 1 - ax;
          if (onSnow) {
            // clumps: rounded lumps catching the sky from above-left; deeper snow is bluer, the edge lips over
            const lump = lod >= 1 ? vn(dx * 1.3 + x, dy * 1.6 + i * 9, 2.1, seed + 17) : 0.5;
            let s = 0.82 + 0.28 * (1 - depthS / Math.max(1, sThick)) - side * 0.08 + (lump - 0.5) * 0.35;
            if (depthS > sThick - 1.3) s -= 0.22;                                       // the shadowed lip
            const sp = lod >= 2 && ih(x + dx, y, seed + 19) < 0.05 ? 1 + fl(ih(x + dx, y, seed + 21) * 254) : 0;
            lput(L, cx + dx, y, M_SNOW, s, z - 1, side * ax * 0.45, -0.75, sp);
          } else {
            // needles: dark, darker inward and lower; a ragged lighter fringe at the very tips
            const nd = lod >= 1 ? (ih(fl((cx + dx) / 1), fl(y / 1), seed + 23) - 0.5) * 0.22 + (vn(dx * 2.2, dy * 1.3 + i * 5, 1.6, seed + 25) - 0.5) * 0.3 : 0;
            let s = 0.22 + 0.16 * ax - 0.12 * clamp((dy - th * 0.4) / th, 0, 1) + nd - side * 0.04;
            if (ax > reach - 0.08) s += 0.08;
            lput(L, cx + dx, y, pine, s, z, side * (0.35 + 0.5 * ax), 0.15, 0);
          }
        }
      }
    }
    // the very top: a snowy spire
    for (let dy = -3; dy < h * 0.06 + 2; dy++) for (let dx = -1; dx <= 1; dx++) if (Math.abs(dx) <= dy * 0.4 + 0.3) lput(L, x + dx + lean, top + dy, dy < 2 ? M_SNOW : pine, dy < 2 ? 0.95 : 0.3, z, dx * 0.3, -0.5, 0);
  }

  /* ---------------------------------------------------------------- the snow ground
     surf(x) → the surface row at layer column x; depth(y) → depth at a ground row. AO wells round tree feet (wells:
     [{x, r}]); drift ripples; sparkle seeds. */
  function paintGround(L, surf, depth, seed, o) {
    o = o || {};
    const wells = o.wells || [], y1 = o.y1 || L.h;
    for (let x = 0; x < L.w; x++) {
      const ys = surf(x), slope = surf(x + 1) - surf(x - 1);
      for (let y = Math.max(0, fl(ys)); y < y1; y++) {
        const dd = y - ys;
        // soft drifts: a large ripple field (wind-sculpted) and a fine crust
        const rip = vn(x * 0.5 + y * 0.9, y * 2.4, 9, seed) - 0.5, fine = (ih(x, y, seed + 1) - 0.5) * 0.06;
        let s = 0.5 + 0.16 * clamp(1 - dd / 30, 0, 1) - slope * 0.12 + rip * 0.2 + fine;
        if (dd < 1.2) s += 0.22;                                       // the lit crest of the bank
        let ao = 0;
        for (const wl of wells) { const d = Math.hypot((x - wl.x) / wl.r, (y - wl.y) / (wl.r * 0.35)); if (d < 1) ao = Math.max(ao, (1 - d) * (wl.a || 0.5)); }
        s -= ao;
        // long moon shadows of the trees, laid across the snow
        if (o.shadows) for (const sh of o.shadows) { const q = (x - sh.x - (y - sh.y) * sh.dx) / sh.w; if (y > sh.y - 2 && Math.abs(q) < 1) s -= sh.a * (1 - q * q) * clamp(1 - (y - sh.y) / 90, 0.3, 1); }
        const nx = 0, ny = -1;                                         // (ground: lit by the lamp from above)
        const sp = ih(x, y, seed + 3) < (o.spark === undefined ? 0.045 : o.spark) ? 1 + fl(ih(x, y, seed + 4) * 254) : 0;
        lput(L, x, y, M_SNOW, s, depth(y), nx, ny, sp);
      }
    }
  }

  /* ---------------------------------------------------------------- snow falling, in three depths
     Flakes fall and sway on loops of their own; par: how much each depth moves with the camera (cx, cy: camera in the
     main plane's pixels); near the lantern they catch its light and glitter. */
  const FLK_N = [70, 46, 18];
  function snowfall(t, cx, cy, zoom, o) {
    o = o || {};
    const dens = o.dens === undefined ? 1 : o.dens, wind = o.wind || 0;
    for (let d = 0; d < 3; d++) {
      const par = [0.45, 0.9, 1.6][d], n = Math.round(FLK_N[d] * dens), fall = [16, 26, 44][d] * (o.fall || 1), sz = d;
      for (let k = 0; k < n; k++) {
        const s = 1300 + d * 97, h1 = ih(k, 1, s), h2 = ih(k, 2, s), h3 = ih(k, 3, s);
        const sp = fall * (0.75 + 0.5 * h3);
        let x = h1 * 640 + Math.sin(t * (0.6 + h2) + k) * (3 + d * 2) + t * wind * (0.5 + d * 0.5) - cx * par;
        let y = h2 * 300 + t * sp - cy * par;
        x = ((x % 640) + 640) % 640 - 80; y = ((y % 300) + 300) % 300 - 20;
        const X = fl(240 + (x - 240) * (1 + (zoom - 1) * par * 0.6)), Y = fl(135 + (y - 135) * (1 + (zoom - 1) * par * 0.6));
        if (X < 0 || X >= W - 1 || Y < ROW0 || Y > ROW1 - 1) continue;
        let l = 0;
        if (LAMP.on) { const dx = X - LAMP.x, dy = Y - LAMP.y, q = (dx * dx + dy * dy) / (LAMP.R * LAMP.R * (d === 2 ? 2.2 : 1.4)); l = q < 4 ? LAMP.I / (1 + q * 2.2) : 0; }
        const tw = ih(k, fl(t * 6 + h1 * 10), s + 5);
        let c = d === 0 ? 168 : d === 1 ? 169 : 194;
        if (l > 0.15) c = l > 0.55 ? (tw < 0.3 ? 22 : 187) : l > 0.3 ? 188 : 189;
        if (o.cool && l <= 0.15) c = o.cool[d];
        const i = Y * W + X;
        if (sz === 0) BUF[i] = c;
        else if (sz === 1) { BUF[i] = c; if (h3 > 0.6) BUF[i + 1] = c; }
        else if (wind > 30) { BUF[i] = c; if (X > 1) BUF[i - 1] = l > 0.15 ? 189 : 168; if (X > 2 && h3 > 0.5) BUF[i - 2 + W] = l > 0.15 ? 190 : 167; BUF[i + W] = c; }
        else { BUF[i] = c; BUF[i + 1] = c; BUF[i + W] = c; BUF[i + W + 1] = l > 0.15 ? 189 : 168; }
      }
    }
  }
  // the camera's slow handheld drift (very gentle, smooth)
  const drift = (t, k, a) => a * (Math.sin(t * 0.53 + k) * 0.6 + Math.sin(t * 0.91 + k * 2.1) * 0.4);

  /* ---------------------------------------------------------------- the aurora
     Curtains of green light hanging in folds: a sinuous lower hem, vertical rays that drift along the curtain, brightest
     just above the hem (with a violet fringe below it) and fading upward. Drawn straight after the sky, before anything
     else. Curtains: [{y (hem, sky-layer units), amp, len (how far up it reaches), k (fold frequency), ph, x0, x1 (extent)}]. */
  const R_AUR = [230, 231, 232, 233, 234];
  function aurora(t, ox, oy, z, amt, curtains, yClip) {
    if (amt <= 0.01) return;
    const yc = yClip === undefined ? ROW1 : Math.min(ROW1, yClip);
    for (let X = 0; X < W; X++) {
      const wx = toLX(ox, z, X);
      for (const C of curtains) {
        const env = sstep(C.x0, C.x0 + 110, wx) * (1 - sstep(C.x1 - 110, C.x1, wx));
        if (env <= 0.01) continue;
        // the hem folds and drifts; the rays are thin bright streaks over a faint veil, sliding along the curtain
        const hem = C.y + C.amp * Math.sin(wx * C.k + t * 0.22 + C.ph) + C.amp * 0.35 * Math.sin(wx * C.k * 2.9 - t * 0.33 + C.ph * 2);
        const r1 = 0.5 + 0.5 * Math.sin(wx * 0.33 + 3.1 * Math.sin(wx * 0.017 + t * 0.21 + C.ph) + t * 0.55);
        const r2 = 0.5 + 0.5 * Math.sin(wx * 0.91 - 2.0 * Math.sin(wx * 0.041 - t * 0.37) + t * 1.1 + C.ph);
        const r3 = 0.5 + 0.5 * Math.sin(wx * 0.06 + t * 0.15 + C.ph * 2);
        const ray = 0.45 + 0.3 * sstep(0.45, 0.8, r1) + 0.18 * r2 + 0.22 * r3;   // fine rays in a soft veil
        const fold = 0.6 + 0.4 * Math.sin(wx * C.k * 1.7 + t * 0.3 + C.ph * 3);   // brighter where the curtain turns toward us
        const q = env * amt * ray * fold * (C.b || 1);
        const len = C.len;
        const Yh = toSY(oy, z, hem), Yt = toSY(oy, z, hem - len);
        const y0 = Math.max(ROW0, fl(Yt)), y1 = Math.min(yc, Math.ceil(Yh + 4 * z));
        for (let Y = y0; Y <= y1; Y++) {
          const d = (Yh - Y) / z, b = bay(X, Y), i = Y * W + X;
          if (d > 4 && ih(X, Y, 1777) > Math.exp(-d / len * 1.2) + 0.25) continue;   // the upper veil thins out unevenly
          if (d < 0) { const A = q * Math.exp(d / 1.4); if (A > 0.5 && b < (A - 0.5) * 2) BUF[i] = 192; continue; }
          const u = d / len, A = q * (d < 2.5 ? 0.75 + d * 0.1 : Math.exp(-u * 2.6) * (1 - u * u));
          const lv = A * 5 + (b - 0.5) * 1.2;
          if (lv < 0.4) continue;
          if (lv < 1.2) { if (b < (lv - 0.4) * 1.3) BUF[i] = 230; continue; }
          BUF[i] = R_AUR[clamp(fl(lv - 0.2), 0, 4)];
        }
      }
    }
  }
  /* the aurora, as curtains: a sinuous hem that folds (brightest where a fold turns edge-on to us), each curtain of
     uneven height along its length, its rays irregular (two octaves of noise) and leaning as they rise, a violet fringe
     under the hem, mint-white at the hem, green, then teal and thinning out above. */
  const R_AUL = [230, 231, 232, 233, 234], R_AUH = [124, 125, 230, 231, 232];
  function aurora2(t, ox, oy, z, amt, curtains) {
    if (amt <= 0.01) return;
    for (let X = 0; X < W; X++) {
      const wx = toLX(ox, z, X);
      for (let ci = 0; ci < curtains.length; ci++) {
        const C = curtains[ci], env = sstep(C.x0, C.x0 + 140, wx) * (1 - sstep(C.x1 - 140, C.x1, wx));
        if (env <= 0.01) continue;
        const a1 = wx * C.k + t * 0.22 + C.ph, a2 = wx * C.k * 2.9 - t * 0.33 + C.ph * 2;
        const hem = C.y + C.amp * Math.sin(a1) + C.amp * 0.35 * Math.sin(a2), slope = C.amp * C.k * (Math.cos(a1) + 1.015 * Math.cos(a2));
        const fold = 0.5 + 0.5 * Math.min(1, Math.abs(slope) * 1.6), q = env * amt * fold * (C.b || 1);
        const lenL = C.len * (0.6 + 0.55 * (0.5 + 0.5 * n1(wx * 0.011 + C.ph * 3 + t * 0.05, 7311)));
        const Yh = toSY(oy, z, hem), y0 = Math.max(ROW0, fl(toSY(oy, z, hem - lenL))), y1 = Math.min(ROW1, Math.ceil(Yh + 5 * z));
        const lean = 0.3 * Math.sin(wx * 0.006 + C.ph + t * 0.08);
        for (let Y = y0; Y <= y1; Y++) {
          const d = (Yh - Y) / z, b = BAYF[((Y & 7) << 3) | (X & 7)], i = Y * W + X;
          if (d < 0) { const A = q * Math.exp(d / 1.7) * 0.7; if (A > 0.28 + b * 0.5) BUF[i] = A > 0.62 ? 192 : 253; continue; }
          const u = d / lenL; if (u > 0.3 && ih(X, Y, 1777) > Math.exp(-(u - 0.3) * 1.2) + 0.42) continue;
          const rx = wx + d * lean, r1 = 0.5 + 0.5 * n1(rx * 0.05 + t * 0.3 + C.ph * 5, 7312), r2 = 0.5 + 0.5 * n1(rx * 0.21 - t * 0.7 + C.ph, 7313);
          const ray = 0.42 + 0.5 * r1 * r1 + 0.2 * r2 * r2, prof = d < 2 ? 0.72 + d * 0.14 : Math.exp(-u * 2.3) * (1 - u * u * 0.5);
          const lv = q * ray * prof * 5.4 + (b - 0.5) * 1.1;
          if (lv < 0.42) continue;
          BUF[i] = d < 2.5 && lv > 3.4 ? 234 : (u > 0.5 ? R_AUH : R_AUL)[clamp(fl(lv - 0.42), 0, 4)];
        }
      }
    }
  }
  // a dark trunk sweeping past the lens (a wipe): its centre x on screen, half-width hw
  function wipeTrunk(cxs, hw, t, lampLit) {
    const x0 = Math.max(0, fl(cxs - hw - 2)), x1 = Math.min(W - 1, Math.ceil(cxs + hw + 2));
    for (let Y = ROW0; Y <= ROW1; Y++) {
      const wob = 3 * Math.sin(Y * 0.02 + 1.3) + 2 * Math.sin(Y * 0.071);
      for (let X = x0; X <= x1; X++) {
        const q = (X + 0.5 - cxs - wob) / hw; if (Math.abs(q) > 1) continue;
        // furrowed bark: long vertical grooves wandering a little, plates between them; round, dark, out of focus
        const nc = Math.sqrt(1 - q * q), u = Math.asin(q) * 6.5 + n1(Y * 0.013, 9101) * 0.8;
        const fu = Math.abs(Math.sin(u * PI)), plate = vn(u * 3, Y * 0.03, 1.5, 9103);
        let v = 0.25 + 0.5 * nc - (fu < 0.18 ? 0.35 : 0) + (plate - 0.5) * 0.2 - q * 0.15;
        let c = v > 0.62 ? 217 : v > 0.42 ? 216 : v > 0.22 ? 215 : 195;
        if (q < -0.88) c = 217;                                          // cool rim
        if (q > 0.9 && lampLit > 0) c = bay(X, Y) < 0.5 ? 219 : 177;    // a thin warm edge from the lantern
        if (q < -0.3 && fu > 0.6 && vn(u, Y * 0.05, 2, 9102) > 0.78) c = 136;   // snow caught on the windward plates
        BUF[Y * W + X] = c;
      }
    }
  }

  /* ================================================================ owls
     A round tawny owl on a branch: egg body, big head that turns on its neck (the facial disc, eyes and beak slide round
     the head as it does, and the far tuft hides behind), ear tufts, folded barred wings, a speckled pale breast, talons
     gripping the branch. Local units, origin at the feet, y down. yaw: 0 facing us, ±1 profile (+ toward screen right);
     roll: a head tilt; open: eyelids (0 shut, 1 open), with soft upper lids for a drowsy look. */
  let OWX = 0, OWY = 0, OWS = 1, OWL = null, OWP = null;
  const oX = (x) => OWX + x * OWS, oY = (y) => OWY + y * OWS;
  function owlShade(X, Y, s) {
    const S = OWS;
    if (-s < Math.max(0.7, 0.45 * S)) return 196;
    const n = sdNormal(s), nx = n[0], ny = n[1], nc = n[2], id = SDF.id;
    const lx = (X + 0.5 - OWX) / S, ly = (Y + 0.5 - OWY) / S;
    const L = OWL;
    let sk = L.amb + 0.5 * Math.max(0, (nx * L.sky[0] + ny * L.sky[1]) * 0.75 + nc * 0.4) + (1 - nc) * (1 - nc) * 0.4 * Math.max(0, nx * L.sky[0] + ny * L.sky[1] + 0.2);
    let l = lampAt(X, Y, L.z, nx, Math.max(-0.98, ny)) * 1.3, m = M_OWL;
    const P = OWP;
    if (id === 1) { // the breast: pale, speckled with little dark chevrons; the back darker
      const front = Math.abs(lx) < 3.4 - 0.25 * Math.max(0, ly + 6) && ly > -9;
      if (front) { m = M_OWLW; const q = ih(fl(lx * 1.1 + 40), fl(ly * 1.2 + 40), 901); if (q < 0.22) { m = M_OWL; sk -= 0.1; } }
      else sk -= 0.08 + (ih(fl(lx * 1.4 + 40), fl(ly * 0.9 + 40), 902) < 0.3 ? 0.1 : 0);
    } else if (id === 3) { // wings: barred
      sk -= 0.1; if (frac(ly * 0.55 + lx * 0.1) < 0.28) sk -= 0.14;
      if (SDF.u > 0.8) sk -= 0.1;
    } else if (id === 2) { // the head: a pale facial disc round the eyes, turned with the head
      const F = P.F, r = P.hr, dcx = F.dc[0], dcy = F.dc[1];
      const du = (lx - dcx) / (r * (0.5 + 0.48 * F.fc)), dv = (ly - dcy) / (r * 0.74), dd = du * du + dv * dv;
      if (dd < 1 && F.fc > 0.05) { m = M_OWLW; sk += 0.06 - dd * 0.12; if (dd > 0.84) { m = M_OWL; sk -= 0.15; } }
      else { if (ih(fl(lx * 1.5 + 50), fl(ly * 1.5 + 50), 903) < 0.25) sk += 0.08; }
    } else if (id === 4) { sk -= 0.05; if (SDF.u > 0.6) sk -= 0.15; }
    else if (id === 5) { m = M_OWL; sk -= 0.12; }
    sk += furG(lx * 2.2, ly * 1.5) * 0.08;
    return mcq(m, sk, l, X, Y);
  }
  function drawOwl(x, y, S, o, light) {
    OWX = x; OWY = y; OWS = S; OWL = light;
    const yaw = clamp(o.yaw || 0, -1.6, 1.6), roll = o.roll || 0, open = o.open === undefined ? 1 : o.open, fluff = o.fluff || 0;
    const hc = [0 + Math.sin(yaw) * 0.3, -13.2 - (o.lift || 0)], hr = 4.9 + fluff * 0.4;
    const fc = Math.cos(yaw);                                   // how much the face is toward us
    const F = { fc, dc: [hc[0] + Math.sin(yaw) * hr * 0.62, hc[1] + 0.7] };
    OWP = { F, hr };
    sdBegin();
    // tail and wings behind, body, head
    sdCap(oX(0), oY(-4), oX(0.4), oY(1.6), 2.6 * S, 1.6 * S, 1.2 * S, 5);
    sdBall(oX(0), oY(-6.2), (5.2 + fluff * 0.5) * S, 2.5 * S, 1, 0.3 * S);
    sdBall(oX(0), oY(-3.6), (5.4 + fluff * 0.6) * S, 2.5 * S, 1, 0.3 * S);
    for (const sd of [-1, 1]) sdCap(oX(sd * 4.3), oY(-8.4), oX(sd * 3.6), oY(-1.0), 2.4 * S, 1.5 * S, 1.0 * S, 3, 0, 1);
    sdDraw(owlShade);
    sdBegin();
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const hp = (dx, dy) => [hc[0] + dx * cr - dy * sr, hc[1] + dx * sr + dy * cr];
    sdBall(oX(hc[0]), oY(hc[1]), hr * S, 1.5 * S, 2, 0.25 * S);
    // ear tufts: two little feathered horns at the crown's corners, the far one dipping behind as the head turns
    for (const sd of [-1, 1]) {
      const az = sd * 0.75 + yaw * 0.9, vis = Math.cos(az);
      if (vis < -0.25) continue;
      const b = hp(Math.sin(az) * hr * 0.72, -hr * 0.62), tp = hp(Math.sin(az) * hr * 0.95 + sd * 0.6, -hr * 1.18);
      sdCap(oX(b[0]), oY(b[1]), oX(tp[0]), oY(tp[1]), 1.6 * S, 0.45 * S, 0.8 * S, 4, 0, 1);
    }
    sdDraw(owlShade);
    // the eyes and beak: on the face, which turns with the head (and rolls with it)
    if (fc > 0.02) {
      for (const sd of [-1, 1]) {
        const az = sd * 0.42 + yaw, ez = Math.cos(az); if (ez < 0.15) continue;
        const e = hp(Math.sin(az) * hr * 0.8, -0.2), ex = oX(e[0]), ey = oY(e[1]);
        const er = 1.55 * S, ew = er * (0.35 + 0.65 * ez);
        const lidY = ey - er + (1 - open) * 2 * er;
        for (let Y = fl(ey - er - 1); Y <= Math.ceil(ey + er + 1); Y++) for (let X = fl(ex - ew - 1); X <= Math.ceil(ex + ew + 1); X++) {
          if (Y < ROW0 || Y > ROW1 || X < 0 || X >= W) continue;
          const u = (X + 0.5 - ex) / ew, v = (Y + 0.5 - ey) / er, d = u * u + v * v;
          if (d > 1) continue;
          if (Y + 0.5 < lidY) { BUF[Y * W + X] = Y + 1.5 > lidY ? 196 : mcq(M_OWL, 0.4, lampAt(X, Y, light.z, 0, -0.3), X, Y); continue; }
          const pu = u - (o.lookX || 0) * 0.25, pv = v - (o.lookY || 0) * 0.2, pd = pu * pu + pv * pv;
          const lit = LAMP.on ? clamp(lampAt(X, Y, light.z, 0, 0) * 2, 0, 1) : 0;
          let c = d > 0.72 ? 196 : pd < 0.3 ? 195 : lit > 0.3 ? (v > 0.2 ? 59 : 58) : (v > 0.2 ? 15 : 58);
          if (S >= 1.2 && (u + 0.35) * (u + 0.35) + (v + 0.38) * (v + 0.38) < 0.09) c = 22;
          BUF[Y * W + X] = c;
        }
      }
      const bk = hp(Math.sin(yaw) * hr * 0.9, 1.4), bx = oX(bk[0]), by = oY(bk[1]);
      for (let k = 0; k < Math.max(2, Math.round(1.6 * S)); k++) { P(bx, by + k, 177); if (S > 1.2 && k < 1.2 * S) P(bx + (yaw > 0 ? 1 : -1), by + k, 178); }
    }
    // talons on the branch
    for (const sd of [-1, 1]) { const tx = oX(sd * 1.6), ty = oY(0.2); P(tx, ty, 174); P(tx + 1, ty, 173); P(tx - 1, ty + 1, 173); }
  }

  /* ================================================================ deer
     Red deer in the snow: barrel body on long legs, a neck that swings from grazing (muzzle in the snow) to alert (head
     high), a narrow head with a dark nose, big mobile ears, a pale rump patch and throat, a short tail that flicks. The
     stag carries antlers. Local units, origin on the ground under the body, x forward, y down. o: { up (0 graze .. 1
     alert), turn (head toward camera 0..1), earF (flick), tail, step (gait phase), gait, fawn }. */
  let DRX = 0, DRY = 0, DRS = 1, DRF = 1, DRL = null;
  const dX = (x) => DRX + DRF * x * DRS, dY = (y) => DRY + y * DRS;
  function deerShade(X, Y, s) {
    const S = DRS;
    if (-s < Math.max(0.65, 0.45 * S)) return 196;
    const n = sdNormal(s), nx = n[0], ny = n[1], nc = n[2], id = SDF.id, L = DRL;
    const lx = (X + 0.5 - DRX) / (S * DRF), ly = (Y + 0.5 - DRY) / S;
    const sdx = L.sky[0] * DRF, sdy = L.sky[1], dsk = nx * sdx + ny * sdy;
    let sk = L.amb + 0.5 * Math.max(0, dsk * 0.8 + nc * 0.35) + (1 - nc) * (1 - nc) * 0.7 * Math.max(0, dsk + 0.25) + 0.1 * Math.max(0, ny);
    let l = lampAt(X, Y, L.z, nx, Math.max(-0.98, ny)) * 1.4, m = M_DEER;
    if (id === 1) { // body: pale belly, white rump patch
      if (ly > L.belly) m = M_DEERW;
      if (lx < L.rumpX && ly < L.belly - 1 && ly > L.rumpY) m = M_DEERW;
      sk += furG(lx * 1.6, ly) * 0.08 - 0.05 + (ly < L.belly - 9.5 ? -0.07 : 0) + 0.18 * Math.max(0, -ny - 0.55);   // a darker line down the back, moonlight on the top
    } else if (id === 2) { if (SDF.side * DRF > 0 && SDF.lat > 0.3) m = M_DEERW; sk -= 0.02; }      // neck: a pale throat
    else if (id === 3) { if (SDF.u > 0.86) m = M_DEERK; else if (SDF.side * DRF > 0 && SDF.lat > 0.45) m = M_DEERW; } // head: dark nose, pale chin
    else if (id === 4) { m = SDF.lat < 0.55 && SDF.u < 0.7 ? M_DEERW : M_DEER; sk -= 0.08; }   // ears
    else if (id === 5) { if (SDF.u > 0.86) m = M_DEERK; sk -= 0.06; }                       // legs: dark hooves
    else if (id === 6) { m = M_DEERW; }                                                     // tail
    else if (id === 7) { m = M_DEERK; sk += 0.25; }                                         // antlers
    else if (id === 8) { sk -= 0.22; l *= 0.6; if (SDF.u > 0.86) m = M_DEERK; }             // far legs
    return mcq(m, sk, l, X, Y);
  }
  function drawDeer(x, y, S, f, o, light) {
    DRX = x; DRY = y; DRS = S; DRF = f;
    const fawn = o.fawn ? 1 : 0, k = fawn ? 0.7 : 1, up = clamp(o.up, 0, 1), g = o.gait || 0, ph = o.step || 0;
    const bodyY = -(fawn ? 26 : 34) * (1 + 0.02 * Math.sin(ph * TAU * 2) * g);
    const rump = [-11 * k, bodyY], chest = [10 * k, bodyY - 1.5 * k];
    DRL = Object.assign({}, light, { belly: bodyY + 4.4 * k, rumpX: rump[0] - 2.5 * k, rumpY: bodyY - 5 * k });
    // the neck: from the chest up and forward to the head; grazing swings it down to the snow
    const na = lerp(0.75, -1.05, up) + (o.nod || 0), nl = 15 * k;
    const nb = [chest[0] + 2 * k, chest[1] - 3 * k], nt = [nb[0] + Math.cos(na) * nl, nb[1] + Math.sin(na) * nl];
    const ha = lerp(1.25, 0.35, up) + (o.tilt || 0), hl = 9.5 * k;
    const hn = [nt[0] + Math.cos(ha) * hl, nt[1] + Math.sin(ha) * hl];
    const legs = [[chest[0] - 1.5 * k, 0, 0], [chest[0] + 1.2 * k, 1, 0.5], [rump[0] + 1.5 * k, 0, 0.5], [rump[0] - 1.2 * k, 1, 0]];
    const legPath = (hx, off, far) => {
      let fx = hx + (far ? 1.2 : 0) * k, fy = 0;
      if (g > 0) { const q = frac(ph + off); if (q < 0.6) fx += 5 * k * (1 - 2 * q / 0.6) * g; else { const u = (q - 0.6) / 0.4; fx += 5 * k * (-1 + 2 * eis(u)) * g; fy = -3.5 * k * Math.sin(PI * u) * g; } }
      return [fx, fy];
    };
    // far legs first
    sdBegin();
    for (const [hx, far, off] of legs) if (far) {
      const [fx, fy] = legPath(hx, off, 1), hind = hx < 0, top = [hx, bodyY + 3 * k], kn = hind ? [lerp(hx, fx, 0.45) - 3.6 * k, bodyY * 0.42] : [lerp(hx, fx, 0.5) + 0.8 * k, bodyY * 0.36];
      sdCap(dX(top[0]), dY(top[1]), dX(kn[0]), dY(kn[1]), (hind ? 3.8 : 3.0) * k * S, 1.5 * k * S, 1.2 * S, 8, 0, 0.5);
      sdCap(dX(kn[0]), dY(kn[1]), dX(fx), dY(fy - 0.8), 1.25 * k * S, 0.9 * k * S, 0.6 * S, 8, 0.5, 1);
    }
    sdDraw(deerShade);
    sdBegin();
    // body, neck, head, near legs, tail
    sdCap(dX(rump[0]), dY(rump[1]), dX(chest[0]), dY(chest[1]), 6.2 * k * S, 6.8 * k * S, 2.5 * S, 1, 0, 1, 0.2 * S);
    sdCap(dX(rump[0] + 1.5 * k), dY(bodyY - 1.5 * k), dX(rump[0] - 0.5 * k), dY(bodyY + 2.5 * k), 7.0 * k * S, 6.0 * k * S, 2.5 * S, 1, 0, 1);       // the haunch
    sdCap(dX(chest[0] - 2 * k), dY(bodyY - 2.5 * k), dX(chest[0] + 0.5 * k), dY(bodyY + 3.5 * k), 6.0 * k * S, 5.6 * k * S, 2.5 * S, 1, 0, 1);      // the shoulder and deep chest
    sdCap(dX(nb[0]), dY(nb[1]), dX(nt[0]), dY(nt[1]), 4.6 * k * S, 3.0 * k * S, 2.5 * S, 2, 0, 1);
    sdCap(dX(nt[0]), dY(nt[1]), dX(hn[0]), dY(hn[1]), 3.4 * k * S, 1.6 * k * S, 1.5 * S, 3, 0, 1);
    for (const [hx, far, off] of legs) if (!far) {
      const [fx, fy] = legPath(hx, off, 0), hind = hx < 0, top = [hx, bodyY + 3 * k], kn = hind ? [lerp(hx, fx, 0.45) - 3.8 * k, bodyY * 0.42] : [lerp(hx, fx, 0.5) + 0.8 * k, bodyY * 0.36];
      sdCap(dX(top[0]), dY(top[1]), dX(kn[0]), dY(kn[1]), (hind ? 4.4 : 3.4) * k * S, 1.6 * k * S, 1.4 * S, 5, 0, 0.5);
      sdCap(dX(kn[0]), dY(kn[1]), dX(fx), dY(fy - 0.8), 1.35 * k * S, 1.0 * k * S, 0.6 * S, 5, 0.5, 1);
    }
    const tl = (o.tail || 0);
    sdCap(dX(rump[0] - 6 * k), dY(rump[1] - 2.5 * k), dX(rump[0] - 8 * k - tl * 1.5), dY(rump[1] + 1 * k - tl * 3), 1.8 * k * S, 1.1 * k * S, 0.8 * S, 6);
    sdDraw(deerShade);
    // ears and antlers on the head
    sdBegin();
    const ea = ha - PI / 2 - 0.5 + (o.earF || 0), eb = [nt[0] + Math.cos(ha) * 1.5 * k, nt[1] + Math.sin(ha) * 1.5 * k - 1.5 * k];
    for (const sd of [-1, 1]) {
      const a = ea + sd * 0.35 - (o.turn || 0) * sd * 0.4, L = 5.5 * k;
      sdCap(dX(eb[0] + sd * 0.6), dY(eb[1]), dX(eb[0] + Math.cos(a) * L + sd * 0.6), dY(eb[1] + Math.sin(a) * L), 1.2 * k * S, 1.6 * k * S, 0.4 * S, 4, 0, 1);
    }
    if (o.antlers) {
      for (const sd of [-1, 1]) {
        let px = eb[0] + 1.5 + sd * 0.8, py = eb[1] - 1, a = -PI / 2 - 0.35 * sd - 0.3;
        for (let seg = 0; seg < 4; seg++) {
          const L = 5 - seg * 0.6, qx = px + Math.cos(a) * L, qy = py + Math.sin(a) * L;
          sdCap(dX(px), dY(py), dX(qx), dY(qy), 0.75 * S, 0.55 * S, 0.3 * S, 7);
          const ta = a + 0.9, tx = qx + Math.cos(ta) * 2.6, ty = qy + Math.sin(ta) * 2.6;
          if (seg > 0) sdCap(dX(qx), dY(qy), dX(tx), dY(ty), 0.55 * S, 0.35 * S, 0.2 * S, 7);
          px = qx; py = qy; a -= 0.32 * sd + 0.1;
        }
      }
    }
    sdDraw(deerShade);
    // the eye: a dark glossy bead with a glint (warm when the lantern is near)
    const ex = dX(lerp(nt[0], hn[0], 0.3) + Math.cos(ha - PI / 2) * 0.9 * k), ey = dY(lerp(nt[1], hn[1], 0.3) + Math.sin(ha - PI / 2) * 0.9 * k);
    const er = Math.max(0.7, 0.95 * k * S);
    discF(ex, ey, er, 195); if (S >= 0.9) P(ex - DRF * 0.3, ey - 0.4, LAMP.on && Math.abs(ex - LAMP.x) < 80 ? 183 : 194);
    return { head: [dX(hn[0]), dY(hn[1])], body: [dX(0), dY(bodyY)] };
  }

  /* ================================================================ the keeper
     An old lighthouse keeper on a three-legged stool: heavy boots, dark wool trousers, a red knitted sweater with a cream
     band of snowflakes across the chest (rib knit, stitches you can see close up), a big white beard and moustache, a
     round ruddy nose, bushy white brows, a green knit cap with a turned-up band. Local units, origin on the floor under
     the stool, facing +x (toward the lens), y down. Pose: { lean (forward), head (down +), look (-1..1 up), brow (0 sad
     .. 1 lifted), smile (-1 sad .. 1), eyes (open), handR / handL targets [x, y] or null (resting on the knees), stand }. */
  let KPX = 0, KPY = 0, KPS = 1, KPF = 1, KPL = null, KPP = null;
  const kX = (x) => KPX + KPF * x * KPS, kY = (y) => KPY + y * KPS;
  function keeperShade(X, Y, s) {
    const S = KPS;
    if (-s < Math.max(0.7, 0.42 * S)) return SDF.id === 2 ? 155 : SDF.id === 7 ? 193 : 196;   // (sleeves fold into the sweater, the beard's edge is soft)
    const n = sdNormal(s), nx = n[0], ny = n[1], nc = n[2], id = SDF.id, L = KPL, P = KPP;
    const lx = (X + 0.5 - KPX) / (S * KPF), ly = (Y + 0.5 - KPY) / S;
    const sdx = L.sky[0] * KPF, sdy = L.sky[1], dsk = nx * sdx + ny * sdy;
    let sk = L.amb + 0.45 * Math.max(0, dsk * 0.8 + nc * 0.4) + (1 - nc) * (1 - nc) * 0.45 * Math.max(0, dsk + 0.3);
    let l = lampAt(X, Y, L.z, nx, Math.max(-0.98, ny)) * (L.gain || 1.3), m = M_WOOL;
    if (id === 1 || id === 2) { // the sweater: rib knit, a cream band of snowflakes across the chest
      const band = ly > P.bandY0 && ly < P.bandY1, rib = frac(lx * 0.9 + (id === 2 ? SDF.u * 6 : 0));
      if (band) {
        const bx = frac(lx / 5.5 + 0.5), by = (ly - P.bandY0) / (P.bandY1 - P.bandY0);
        const flake = Math.abs(bx - 0.5) < 0.09 || (Math.abs(by - 0.5) < 0.12 && Math.abs(bx - 0.5) < 0.38) || Math.abs(Math.abs(bx - 0.5) - Math.abs(by - 0.5) * 0.8) < 0.07;
        m = flake ? M_WOOLC : M_WOOL;
        if (by < 0.12 || by > 0.88) m = M_WOOLC;
      }
      if (S >= 1.6 && rib < 0.22) sk -= 0.1;                 // the knit's ribs
      if (S >= 2.2 && ih(fl(lx * 2), fl(ly * 2.4), 951) < 0.18) sk += 0.07;
      if (id === 2) { sk -= 0.1 - 0.12 * (1 - SDF.lat); if (SDF.u > 0.88) sk -= 0.12; }   // sleeves: their own roundness, the cuffs
    } else if (id === 3) { m = M_SKIN; sk += 0.05; }          // hands
    else if (id === 4) { m = M_TROU; sk -= 0.05; if (S >= 2 && frac(lx * 0.7) < 0.2) sk -= 0.06; }
    else if (id === 5) { m = M_BOOT; sk += 0.04; if (SDF.u > 0.85) sk -= 0.15; }
    else if (id === 6) { m = M_SKIN; }                       // face
    else if (id === 7) { m = M_BEARD; sk += 0.3 + furG(lx * 3, ly * 1.2) * 0.14; l *= 1.2; }   // beard and brows
    else if (id === 8) { m = M_CAP; if (ly > P.capBand) { sk += 0.1; if (frac(lx * 1.1) < 0.3) sk -= 0.12; } else if (frac(lx * 1.1 + ly * 0.3) < 0.25) sk -= 0.08; }
    else if (id === 9) { m = M_WOOD; }                       // the stool
    else if (id === 10) { m = M_SKIN; sk += 0.15; if (SDF.lat < 0.5 && nx * KPF < 0.2) m = M_SKIN; }          // the nose
    return mcq(m, sk, l, X, Y);
  }
  function drawKeeper(x, y, S, f, o, light) {
    KPX = x; KPY = y; KPS = S; KPF = f; KPL = light;
    const lean = o.lean || 0, st = o.stand || 0;
    const hip = [lerp(0, 2, st), lerp(-24, -36, st)];
    const ca = Math.cos(lean), sa = Math.sin(lean);
    const chest = [hip[0] + sa * 19, hip[1] - ca * 19], neck = [hip[0] + sa * 25, hip[1] - ca * 25];
    const hd = o.head || 0, lookUp = o.look || 0;
    const head = [neck[0] + 3.8 + Math.sin(hd) * 4.5, neck[1] - 7.6 + hd * 2.6];
    KPP = { bandY0: chest[1] - 2.2, bandY1: chest[1] + 3.4, capBand: head[1] - 7.4, hx: head[0], hy: head[1] };
    sdBegin();
    // the stool
    sdCap(kX(-7), kY(-22.5), kX(7), kY(-22.5), 1.6 * S, 1.6 * S, 0.4 * S, 9);
    for (const lx of [-6, 6]) sdCap(kX(lx), kY(-21.5), kX(lx * 1.3), kY(0), 1.0 * S, 0.9 * S, 0.3 * S, 9);
    sdDraw(keeperShade);
    sdBegin();
    // the far leg and arm (behind)
    const knee2 = [hip[0] + lerp(10, 3, st), lerp(-24.5, -18, st)], foot2 = [knee2[0] + 2, -2.2];
    sdCap(kX(hip[0] - 1), kY(hip[1] + 1), kX(knee2[0] - 1), kY(knee2[1]), 4.8 * S, 4.0 * S, 1.5 * S, 4);
    sdCap(kX(knee2[0] - 1), kY(knee2[1]), kX(foot2[0] - 1), kY(foot2[1] - 2), 3.6 * S, 3.2 * S, 1.2 * S, 4);
    sdCap(kX(foot2[0] - 2.5), kY(-2.4), kX(foot2[0] + 4.5), kY(-2.2), 2.6 * S, 2.4 * S, 1 * S, 5, 0, 1);
    sdDraw((X, Y, s) => { const c = keeperShade(X, Y, s); return c === 196 ? 196 : T_SHADE[3][c]; });
    sdBegin();
    // near leg
    const knee = [hip[0] + lerp(11, 3, st), lerp(-24, -18, st)], foot = [knee[0] + 2.5, -2.4];
    sdCap(kX(hip[0]), kY(hip[1]), kX(knee[0]), kY(knee[1]), 5.0 * S, 4.2 * S, 1.6 * S, 4);
    sdCap(kX(knee[0]), kY(knee[1]), kX(foot[0]), kY(foot[1] - 2), 3.8 * S, 3.3 * S, 1.2 * S, 4);
    sdCap(kX(foot[0] - 3), kY(-2.6), kX(foot[0] + 5), kY(-2.4), 2.8 * S, 2.6 * S, 1 * S, 5, 0, 1);
    // the body in its sweater: a big soft barrel
    sdCap(kX(hip[0] - 1), kY(hip[1] - 2), kX(chest[0]), kY(chest[1]), 9.6 * S, 9.2 * S, 3 * S, 1, 0, 1, 0.25 * S);
    sdBall(kX(chest[0] + 1.5), kY(chest[1] + 4), 8.2 * S, 3 * S, 1, 0.25 * S);
    sdCap(kX(chest[0]), kY(chest[1]), kX(neck[0]), kY(neck[1]), 7.4 * S, 4.6 * S, 2.5 * S, 1);
    sdDraw(keeperShade);
    // arms: shoulder → elbow → hand (two-bone IK); resting on the knees unless reaching
    const armPass = (near) => {
      sdBegin();
      const sh = [chest[0] + (near ? 1.5 : -1.5), chest[1] - 2.5];
      let tgt = (near ? o.handR : o.handL) || [knee[0] + (near ? 1 : -1.5), knee[1] - 5.2];
      { const dx = tgt[0] - sh[0], dy = tgt[1] - sh[1], d = Math.hypot(dx, dy); if (d > 19.2) tgt = [sh[0] + dx / d * 19.2, sh[1] + dy / d * 19.2]; }   // (within reach)
      const el = ik2(sh[0], sh[1], tgt[0], tgt[1], 10, 10, near ? 1 : 1);
      sdCap(kX(sh[0]), kY(sh[1]), kX(el[0]), kY(el[1]), 3.8 * S, 3.2 * S, 1.5 * S, 2, 0, 0.5);
      sdCap(kX(el[0]), kY(el[1]), kX(tgt[0]), kY(tgt[1]), 3.2 * S, 2.8 * S, 1.2 * S, 2, 0.5, 1);
      sdBall(kX(tgt[0] + 0.8), kY(tgt[1] + 0.2), 2.5 * S, 1 * S, 3);
      sdDraw(near ? keeperShade : (X, Y, s) => { const c = keeperShade(X, Y, s); return c === 196 ? 196 : T_SHADE[2][c]; });
      return tgt;
    };
    const handL = armPass(false);
    // the head: a big round face, the cap set back on it, white hair below it, a full white beard under the chin
    sdBegin();
    sdBall(kX(head[0]), kY(head[1]), 8.2 * S, 1.5 * S, 6);
    sdDraw(keeperShade);
    sdBegin();
    sdBall(kX(head[0] - 6.0), kY(head[1] - 0.8), 2.8 * S, 1.2 * S, 7, 0.45 * S);      // white hair under the cap, at the back
    sdBall(kX(head[0] - 4.4), kY(head[1] + 2.6), 3.0 * S, 1.2 * S, 7, 0.5 * S);       // the side whiskers
    const by = head[1] + 4.8 - lookUp * 0.6;
    sdBall(kX(head[0] + 3.2), kY(by + 3.2), 5.0 * S, 2 * S, 7, 0.6 * S);
    sdBall(kX(head[0] + 0.8), kY(by + 5.6), 4.6 * S, 2 * S, 7, 0.6 * S);
    sdBall(kX(head[0] + 5.4), kY(by + 1.0), 3.0 * S, 1.4 * S, 7, 0.5 * S);
    sdDraw(keeperShade);
    sdBegin();
    const cap = [head[0] - 2.4, head[1] - 6.4 + hd * 0.4];
    sdCap(kX(cap[0] - 5.2), kY(cap[1] + 1.4), kX(cap[0] + 4.6), kY(cap[1] - 0.4), 2.0 * S, 2.0 * S, 1 * S, 8);
    sdBall(kX(cap[0] - 1.0), kY(cap[1] - 2.8), 5.0 * S, 2 * S, 8);
    sdBall(kX(cap[0] - 3.6), kY(cap[1] - 7.6), 1.9 * S, 0.6 * S, 8, 0.35 * S);     // a little pompom
    sdDraw(keeperShade);
    // the face's features, over the head
    keeperFace(head, o, S);
    const handR = armPass(true);
    return { head: [kX(head[0]), kY(head[1])], handR: [kX(handR[0]), kY(handR[1])], handL: [kX(handL[0]), kY(handL[1])], lap: [kX(knee[0] - 2), kY(knee[1] - 6)], boot: [kX(foot[0] + 4), kY(-1)] };
  }
  function keeperFace(head, o, S) {
    const hx = head[0], hy = head[1], lookUp = o.look || 0, brow = clamp(o.brow || 0, 0, 1), smile = o.smile || 0, open = o.eyes === undefined ? 1 : o.eyes;
    const ex = hx + 4.3, ey = hy - 1.3 - lookUp * 0.5;
    const E = [kX(ex), kY(ey)];
    // the eye: a small dark oval; a heavy lid when he is sad; a glint when the light finds it
    const er = Math.max(0.9, 1.05 * S), lidK = clamp(open * (0.5 + 0.5 * brow + 0.25 * lookUp), 0, 1);
    for (let Y = fl(E[1] - er - 1); Y <= Math.ceil(E[1] + er + 1); Y++) for (let X = fl(E[0] - er * 0.8 - 1); X <= Math.ceil(E[0] + er * 0.8 + 1); X++) {
      const u = (X + 0.5 - E[0]) / (er * 0.8), v = (Y + 0.5 - E[1]) / er;
      if (u * u + v * v > 1) continue;
      if (v < 1 - 2 * lidK) { if (v > 1 - 2 * lidK - 0.55) P(X, Y, 252); continue; }
      P(X, Y, 195);
    }
    if (lidK > 0.45 && S >= 1.5) P(E[0] - KPF * 0.35 * S, E[1] - 0.35 * S + (1 - lidK) * er, LAMP.on && LAMP.I > 0.3 ? 183 : 194);
    // the brow: a bushy white tuft; sad, it slants down at the outer end; hope lifts it
    const inner = [ex + 2.4, ey - 2.1 - brow * 1.6], outer = [ex - 2.6, ey - 2.7 + (1 - brow) * 1.8 - brow * 0.6];
    for (let k = 0; k <= 10; k++) {
      const u = k / 10, bx = kX(lerp(outer[0], inner[0], u)), byy = kY(lerp(outer[1], inner[1], u) - Math.sin(u * PI) * 0.5);
      P(bx, byy, 187); P(bx, byy - 1, 194); if (S > 1.8) { P(bx, byy + 1, 193); if (k % 3 === 0) P(bx - KPF, byy - 2, 194); }
    }
    // the nose: big, round and ruddy
    sdBegin(); sdBall(kX(hx + 8.0), kY(hy + 1.5), 2.5 * S, 0.5 * S, 10); sdDraw(keeperShade);
    // moustache: two soft white drifts under the nose
    sdBegin(); sdBall(kX(hx + 7.0), kY(hy + 4.3), 2.5 * S, 1 * S, 7, 0.4 * S); sdBall(kX(hx + 4.6), kY(hy + 4.7 + (smile < 0 ? 0.6 : 0)), 2.3 * S, 1 * S, 7, 0.4 * S); sdDraw(keeperShade);
    // the mouth, just showing under it: down when sad, up when he smiles
    if (Math.abs(smile) > 0.2) { const mx0 = hx + 4.2, mx1 = hx + 7.2, my = hy + 7.0; for (let k = 0; k <= 8; k++) { const u = k / 8, curve = (u - 0.5) * (u - 0.5) * 4 - 1; P(kX(lerp(mx0, mx1, u)), kY(my + smile * curve * 0.9), 252); } }
    // a rosy cheek above the beard
    const cx = kX(hx + 3.6), cy = kY(hy + 2.2);
    for (let Y = fl(cy - 1.4 * S); Y <= cy + 1.4 * S; Y++) for (let X = fl(cx - 1.8 * S); X <= cx + 1.8 * S; X++) { const u = (X - cx) / (1.8 * S), v = (Y - cy) / (1.2 * S); if (u * u + v * v < 1 && bay(X, Y) < 0.5 && Y >= ROW0 && Y <= ROW1 && X >= 0 && X < W) { const i = Y * W + X; if (BUF[i] !== 195) BUF[i] = 254; } }
  }

  /* ================================================================ the lighthouse, outside (drawn live: it is seen from
     far, near, and with its beam blazing). A tapering whitewashed tower with two red bands and a little masonry showing
     through, small windows up it, an arched door at its foot; a railed gallery; the lantern room (glass panes between
     iron mullions; dark, or alight with the lens) under a domed cap with a ball and vane. Local units, base centre at
     (0, 0), y down. o: { lit (0..1), sweep (beam angle), door (0..1 glow in the doorway) }. */
  const TW = { H: 120, w0: 16, w1: 11, gal: 3.2, room: 17, cap: 9 };
  function drawTower(bx, by, S, o, light) {
    const lit = o.lit || 0, H = TW.H, top = by - H * S, door = o.door || 0;
    const x0 = Math.max(0, fl(bx - (TW.w0 + 7) * S)), x1 = Math.min(W - 1, Math.ceil(bx + (TW.w0 + 7) * S));
    const y0 = Math.max(ROW0, fl(top - (TW.gal + TW.room + TW.cap + 9) * S)), y1 = Math.min(ROW1, Math.ceil(by + 2 * S));
    const lx = light.sky[0];
    for (let Y = y0; Y <= y1; Y++) {
      const v = (by - (Y + 0.5)) / S;                          // height above the base, units
      for (let X = x0; X <= x1; X++) {
        const dx = (X + 0.5 - bx) / S, d = BAYF[((Y & 7) << 3) | (X & 7)];
        let c = -1;
        if (v < -1.5) { }
        else if (v < 6.5) {
          // the plinth: big dressed blocks, a snowed-on ledge, steps up to the door, drifts banked against the foot
          const w = TW.w0 + 3.2 - Math.max(0, v - 5.2) * 1.2, q = dx / w;
          const drift = 2.6 + 1.4 * Math.sin(dx * 0.31 + 1) + (dx < 0 ? 1.6 : 0) - Math.abs(q) * 0.8;
          if (Math.abs(dx) < w + 2.5 && v < drift - 0.5 && v > -1.5 && !(Math.abs(dx) < 5.5 && v > 0.6)) c = mc(M_SNOW, 0.42 + (dx < 0 ? 0.12 : 0) + (v > drift - 1.4 ? 0.14 : 0), lampAt(X, Y, light.z, 0, -1), X, Y);
          else if (Math.abs(dx) < 5.5 && v < 4.2) {               // three stone steps
            const st = fl(v / 1.4), f = v - st * 1.4, sw = 5.5 - st * 0.9;
            if (Math.abs(dx) < sw) c = f > 1.05 ? mc(M_SNOW, 0.6 + (dx < 0 ? 0.1 : 0), lampAt(X, Y, light.z, 0, -1), X, Y) : mc(M_STONE, 0.28 - f * 0.08 + (dx < 0 ? 0.06 : 0), lampAt(X, Y, light.z, 0, 0), X, Y);
          }
          if (c < 0 && Math.abs(q) < 1 && v >= 0) {
            const nc = Math.sqrt(1 - q * q), blk = frac(Math.asin(q) * w / 5.2 + (fl(v / 3.2) & 1) * 0.5), cr = frac(v / 3.2);
            let sh = 0.24 + 0.34 * Math.max(0, -q * 0.7 + nc * 0.5) + (ih(fl(Math.asin(q) * w / 5.2 + (fl(v / 3.2) & 1) * 0.5), fl(v / 3.2), 958) - 0.5) * 0.1;
            if (cr < 0.12 || blk < 0.06 / Math.max(0.3, nc)) sh -= 0.12; else if (cr > 0.8) sh -= 0.05; else if (cr < 0.25) sh += 0.05;
            c = v > 5.2 ? mc(M_SNOW, 0.55 + (dx < 0 ? 0.12 : 0), 0, X, Y) : mc(M_STONE, sh, lampAt(X, Y, light.z, q * 0.9, 0), X, Y);
          }
        } else if (v <= H) {
          const u = v / H, w = lerp(TW.w0, TW.w1, u);
          if (Math.abs(dx) < w) {
            const q = dx / w, nc = Math.sqrt(1 - q * q), ang = Math.asin(q);
            // masonry under the whitewash: courses, blocks foreshortened round the curve, each with its bevel
            const cv = v / 3.4, course = fl(cv), cr = cv - course, bk = ang * w / 4.6 + (course & 1) * 0.5, bf = frac(bk), bi = fl(bk);
            let sh = 0.3 + 0.78 * Math.max(0, -q * (-lx) * 0.95 + nc * 0.5) + 0.1 * sstep(0.82, 0.98, q);   // moonlit side, and the storm's rim on the far edge
            sh += (ih(bi, course, 961) - 0.5) * 0.05;
            if (cr < 0.08 || bf < 0.035 / Math.max(0.3, nc)) sh -= 0.07; else if (cr > 0.84) sh -= 0.025; else if (cr < 0.22) sh += 0.03;
            // weathering: streaks down from the gallery and the windows, salt and grime low down, a crack or two
            const streak = vn(ang * 9, v * 0.035, 1, 962), grime = (1 - sstep(6, 26, v)) * (0.6 + 0.4 * vn(ang * 6, v * 0.2, 1, 963));
            if (streak > 0.72) sh -= (streak - 0.72) * 0.35 * (0.4 + 0.6 * u);
            sh -= grime * 0.12;
            for (let wi = 0; wi < 3; wi++) { const wv = 34 + wi * 28; if (v < wv - 3 && v > wv - 16 && Math.abs(dx - 1) < 2.4) sh -= 0.05 * (1 - (wv - 3 - v) / 13); }
            const band = (u > 0.3 && u < 0.4) || (u > 0.62 && u < 0.72), bandEdge = Math.abs(u - 0.3) < 0.004 || Math.abs(u - 0.4) < 0.004 || Math.abs(u - 0.62) < 0.004 || Math.abs(u - 0.72) < 0.004;
            let m = band ? M_REDW : M_WHITEW;
            if (bandEdge) sh -= 0.08;
            // snow plastered on the windward side, and lying on every ledge
            if (q < -0.35 && ih(fl(ang * 40), fl(v * 1.5), 964) > 0.93) { m = M_SNOW; sh = 0.85; }
            // the door, arched, in a deep reveal: planks, iron straps, a ring; its glow when the kit slips in
            if (v < 18.5 && Math.abs(dx) < 4.6) {
              const ar = 12.2 + 3.6 * Math.sqrt(Math.max(0, 1 - dx * dx / 13));
              if (v < ar + 1.2 && Math.abs(dx) < 4.6) {
                const inner = Math.abs(dx) < 3.5 && v < ar - 0.4 && v > 6.5;
                if (inner) {
                  const g = door; if (g > 0.05 && d < g * (1 - (v - 6.5) / 14)) c = g > 0.6 && v < 12 ? 182 : 180;
                  else { const plank = frac((dx + 3.5) / 1.75) < 0.12, strap = Math.abs(v - 9) < 0.45 || Math.abs(v - 14) < 0.45; c = strap ? mc(M_IRON, 0.32, lampAt(X, Y, light.z, 0, 0), X, Y) : mc(M_WOOD, 0.2 + (plank ? -0.08 : 0) + (dx < 0 ? 0.06 : 0), lampAt(X, Y, light.z, 0, 0) * 1.1, X, Y); if (Math.hypot(dx - 2, v - 11) < 0.7) c = mc(M_BRASSM, 0.5, 0.3, X, Y); }
                } else if (v > 6.5) { m = M_STONE; sh = 0.36 + (dx < 0 ? 0.08 : -0.04) - (Math.abs(dx) < 4 ? 0.12 : 0); }
              }
            }
            // three small windows up the tower: a stone surround, dark glass (or lit), a sill holding snow
            for (let wi = 0; wi < 3 && c < 0; wi++) {
              const wv = 34 + wi * 28, ex = dx - 1, ev = v - wv;
              if (Math.abs(ex) < 2.4 && ev > -3.6 && ev < 3.4) {
                if (ev < -2.8) c = mc(M_SNOW, 0.6, 0, X, Y);
                else if (Math.abs(ex) < 1.5 && ev < 2.6 && ev > -2.6) c = lit > 0.3 ? (ev > 0 ? 182 : 181) : (ex < -0.6 && ev > 0.8 ? 243 : d < 0.25 ? 242 : 241);
                else { m = M_STONE; sh = 0.4 + (ex < 0 ? 0.08 : -0.05); }
              }
            }
            if (c < 0) c = mc(m, sh, lampAt(X, Y, light.z, q * 0.9, 0) * 1.2 + lit * 0.25 * (u > 0.85 ? 1 : 0), X, Y);
          } else if (v > H - 5 && Math.abs(dx) < TW.w1 + 3) {        // the corbels under the gallery
            const cb = frac((dx + 30) / 2.6), cv = (v - (H - 5)) / 5;
            if (Math.abs(cb - 0.5) < 0.22 + cv * 0.25 && Math.abs(dx) < w + 3 * cv) c = mc(M_STONE, 0.18 + cv * 0.2 + (dx < 0 ? 0.08 : 0), lit * 0.4, X, Y);
          }
        } else {
          const vv = v - H;
          if (vv <= TW.gal) {
            // the gallery: its slab (snowed on), a railing of posts, a mid rail and a top rail
            if (vv < 1.5 && Math.abs(dx) < TW.w1 + 4) c = vv > 1.0 ? mc(M_SNOW, 0.6 + (dx < 0 ? 0.12 : 0), lit * 0.3, X, Y) : mc(M_STONE, 0.3 + (dx < 0 ? 0.08 : 0), lit * 0.5, X, Y);
            else if (Math.abs(dx) < TW.w1 + 3.6) {
              const post = Math.abs(frac((dx + 30) / 2.3) - 0.5) < 0.16, rail = vv > TW.gal - 0.55 || Math.abs(vv - 2.1) < 0.25;
              if (post || rail) c = mc(M_IRON, 0.22 + (rail && vv > TW.gal - 0.55 ? 0.14 : 0) + (dx < 0 ? 0.08 : 0), lit * 0.6, X, Y);
              if (rail && vv > TW.gal - 0.3 && dx < -3 && d < 0.5) c = mc(M_SNOW, 0.6, 0, X, Y);
            }
          } else if (vv <= TW.gal + TW.room) {
            // the lantern room: a low iron sill, then glazing between mullions with diagonal storm panes
            const rw = TW.w1 * 0.88, ry = vv - TW.gal, q = dx / rw;
            if (Math.abs(q) < 1) {
              const ang = Math.asin(q), seg = ang / (PI / 5), sf = frac(seg + 0.5), mull = Math.abs(sf - 0.5) > 0.5 - 0.06 / Math.max(0.35, Math.cos(ang));
              const lat = Math.abs(frac((ang * rw + ry) / 5.5) - 0.5) < 0.05 || Math.abs(frac((ang * rw - ry) / 5.5) - 0.5) < 0.05;
              if (ry < 2.4) c = mc(M_IRON, 0.24 + (q < 0 ? 0.1 : 0) - (ry < 0.4 ? 0.06 : 0), lit * 0.8, X, Y);
              else if (ry > TW.room - 0.9 || mull) c = mc(M_IRON, 0.26 + (q < 0 ? 0.1 : 0), lit * 0.8, X, Y);
              else if (lit > 0.02) {
                // alight: the lens burning gold-white inside, its prism rings as bright bands, hottest at the centre
                const r = Math.hypot(q, (ry - TW.room / 2) / (TW.room / 2)), ring = Math.abs(frac((ry - TW.room / 2) / 1.6) - 0.5) < 0.12 ? 0.18 : 0;
                const g = lit * (1.25 - r * 0.6 + ring) - (lat ? 0.25 : 0);
                c = g > 1 ? 22 : g > 0.8 ? 60 : g > 0.6 ? 200 : g > 0.4 ? 199 : g > 0.2 ? 182 : 181;
              } else if (lat) c = mc(M_IRON, 0.2, 0, X, Y);
              else {
                // dark glass holding the storm: lighter where it faces the sky, a cold streak of reflection, the lens
                // faint behind it
                const refl = 0.3 + 0.35 * (1 - ry / TW.room) + (q < -0.2 ? 0.2 : 0) + (Math.abs(q + 0.45 - ry * 0.03) < 0.08 ? 0.5 : 0), lens = Math.abs(q) < 0.45 && Math.abs(frac(ry / 1.6) - 0.5) < 0.1 ? 0.12 : 0;
                const g = refl + lens + (d - 0.5) * 0.18;
                c = g > 0.95 ? 194 : g > 0.75 ? 246 : g > 0.55 ? 244 : g > 0.35 ? 243 : 242;
              }
            }
          } else if (vv <= TW.gal + TW.room + TW.cap + 7) {
            // the domed cap with its ribs and a cushion of snow, the ventilator ball, the lightning rod and the vane
            const cv = (vv - TW.gal - TW.room) / TW.cap, cw = TW.w1 * 0.98 * Math.sqrt(Math.max(0, 1 - cv * cv * 0.86));
            if (cv < 0.84 && Math.abs(dx) < cw) {
              const q = dx / Math.max(0.5, cw), rib = Math.abs(frac(Math.asin(clamp(q, -1, 1)) / (PI / 6) + 0.5) - 0.5) > 0.42;
              const snow = q < 0.1 && cv > 0.25 + q * 0.3 && vn(dx * 1.4, cv * 6, 1, 966) > 0.4;
              c = snow ? mc(M_SNOW, 0.55 + (q < -0.4 ? 0.12 : 0), lit * 0.2, X, Y) : mc(M_IRON, 0.16 + (q < -0.3 ? 0.18 : 0) + (rib ? 0.1 : 0) + (cv < 0.08 ? 0.1 : 0) - (q > 0.6 ? 0.06 : 0), lit * 0.4, X, Y);
            } else {
              const bvv = (vv - TW.gal - TW.room) - TW.cap * 0.84;
              if (Math.hypot(dx, bvv - 1.4) < 1.5) c = mc(M_IRON, 0.3 + (dx < -0.4 && bvv > 1.6 ? 0.3 : 0), lit * 0.3, X, Y);
              else if (Math.abs(dx) < 0.35 && bvv > 2.6 && bvv < 6.8) c = mc(M_IRON, 0.32, 0, X, Y);
              else if (bvv > 5.0 && bvv < 5.7 && dx > -3.2 && dx < 3.2) c = mc(M_IRON, 0.3, 0, X, Y);                 // the vane's arm
              else if (bvv > 4.6 && bvv < 6.1 && dx > 2.4 && dx < 3.8 && Math.abs(bvv - 5.35) < (3.8 - dx) * 0.6) c = mc(M_IRON, 0.36, 0, X, Y);   // its arrowhead
            }
          }
        }
        if (c >= 0) BUF[Y * W + X] = c;
      }
    }
    return { lamp: [bx, top - (TW.gal + TW.room / 2) * S], door: [bx, by - 9 * S] };
  }
  // the keeper's cottage: stone walls, a snow-heavy roof, a lit window, a chimney (its smoke torn off by the wind)
  function drawCottage(bx, by, S, light, t) {
    const w = 22, h = 13, roofH = 12;
    for (let Y = Math.max(ROW0, fl(by - (h + roofH + 6) * S)); Y <= Math.min(ROW1, Math.ceil(by)); Y++) {
      const v = (by - Y - 0.5) / S;
      for (let X = Math.max(0, fl(bx - (w / 2 + 3) * S)); X <= Math.min(W - 1, Math.ceil(bx + (w / 2 + 3) * S)); X++) {
        const dx = (X + 0.5 - bx) / S;
        let c = -1;
        if (v < h && Math.abs(dx) < w / 2) {
          const win = Math.abs(dx - 4) < 2.6 && Math.abs(v - 6.5) < 2.6;
          if (win) c = Math.abs(dx - 4) < 0.35 || Math.abs(v - 6.5) < 0.35 ? 162 : (v > 6.5 ? 15 : 182);
          else { const course = frac(v / 2.6), joint = frac(dx / 3.4 + (fl(v / 2.6) & 1) * 0.5); c = mc(M_STONE, 0.2 + (course < 0.18 || joint < 0.1 ? -0.08 : 0.04) + (dx < 0 ? 0.06 : 0), lampAt(X, Y, light.z, dx / w, 0), X, Y); }
          if (Math.abs(dx + 4) < 2.2 && v < 8) c = mc(M_WOOD, 0.2, lampAt(X, Y, light.z, 0, 0), X, Y);     // the door
        } else if (v >= h - 1 && v < h + roofH) {
          const rw = (w / 2 + 2.5) * (1 - (v - h + 1) / (roofH + 1));
          if (Math.abs(dx) < rw) { const edge = Math.abs(dx) > rw - 1.4 || v < h + 0.8; c = mc(M_SNOW, (edge ? 0.62 : 0.48) + (dx < 0 ? 0.14 : -0.04) + (vn(dx * 2, v * 2, 2, 971) - 0.5) * 0.15, 0, X, Y); }
        }
        if (Math.abs(dx - 6) < 1.6 && v >= h + 4 && v < h + roofH + 2) c = mc(M_STONE, 0.18, 0, X, Y);   // chimney
        if (c >= 0) BUF[Y * W + X] = c;
      }
    }
    // the window's light on the snow below it
    glow(bx + 4 * S, by - 6.5 * S, 9 * S, T_LAMP, 0.35);
    // smoke, torn sideways
    for (let k = 0; k < 16; k++) { const u = frac(k / 16 + t * 0.6), sx = bx + 6 * S + u * 40 * S + Math.sin(u * 6 + k) * 3, sy = by - (h + roofH + 3) * S - u * 10 * S; if (bay(fl(sx), fl(sy)) < 0.5 * (1 - u)) { P(sx, sy, 244); P(sx + 1, sy, 245); } }
  }
  // the small ship, lost: a dark hull, a wheelhouse with warm windows, a mast with its red and green lights; it pitches
  function drawShip(x, y, S, roll, lights, turn) {
    const ca = Math.cos(roll), sa = Math.sin(roll);
    for (let Y = fl(y - 16 * S); Y <= Math.ceil(y + 4 * S); Y++) for (let X = fl(x - 14 * S); X <= Math.ceil(x + 14 * S); X++) {
      if (Y < ROW0 || Y > ROW1 || X < 0 || X >= W) continue;
      const dx = (X + 0.5 - x) / S, dy = (Y + 0.5 - y) / S, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
      let c = -1;
      if (v > -1.5 && v < 2.5 && Math.abs(u) < 11 - (v > 0 ? v * 1.6 : 0) + (u > 0 ? 1.5 : 0)) c = v < -0.5 ? 245 : 241;   // hull
      else if (v > -6 && v <= -1.5 && u > -6 && u < 1) c = (Math.abs(v + 3.8) < 0.9 && (u > -5 && u < -0.5) && (fl(u + 6) % 2 === 0)) ? (lights ? 15 : 243) : 242;   // wheelhouse
      else if (Math.abs(u - 3) < 0.4 && v > -14 && v <= -1.5) c = 243;                                                     // mast
      if (c >= 0) BUF[Y * W + X] = c;
    }
    // its lights: masthead white, port red, starboard green (they swing as it pitches)
    const mh = [x + (3 * ca + 14 * sa) * S, y + (3 * sa - 14 * ca) * S];
    if (lights) { glow(mh[0], mh[1], 6, T_WH, 0.5); P(mh[0], mh[1], 22); P(x + (-6 * ca + 2 * sa) * S, y + (-6 * sa - 2 * ca) * S, 157); P(x + (8 * ca + 1 * sa) * S, y + (8 * sa - 1 * ca) * S, 233); }
    return mh;
  }

  /* ================================================================ the great lens
     A first-order Fresnel lens: a beehive of glass in a brass cage. The middle drum is the bull's-eye belt (each panel a
     set of concentric rings that gathers the flame into a beam); above and below it, rings of prisms step in toward the
     top and the bottom. Dark, it is cold blue glass holding the window light in thin lines; alight, it burns gold-white
     from the centre out, its prism edges flashing cyan and gold. Local units, centre at (0, 0), y down.
     lit: 0..1 overall; catch: 0..1 how far the light has spread from the centre ring by ring; rot: the panels' turn. */
  const LENS = { H: 34, R: 22 };
  const lensR = (v) => { const a = Math.abs(v); if (a < 9) return LENS.R; const u = (a - 9) / 25; return LENS.R * (1 - 0.48 * Math.pow(u, 1.5)) * (1 - 0.04 * frac(u * 7.8)); };
  function drawLens(cx, cy, S, o) {
    const lit = o.lit || 0, ct = o.catch === undefined ? lit : o.catch, rot = o.rot || 0;
    const x0 = Math.max(0, fl(cx - (LENS.R + 3) * S)), x1 = Math.min(W - 1, Math.ceil(cx + (LENS.R + 3) * S));
    const y0 = Math.max(ROW0, fl(cy - (LENS.H + 3) * S)), y1 = Math.min(ROW1, Math.ceil(cy + (LENS.H + 3) * S));
    for (let Y = y0; Y <= y1; Y++) {
      const v = (Y + 0.5 - cy) / S, av = Math.abs(v);
      if (av > LENS.H + 2) continue;
      const r = lensR(v);
      for (let X = x0; X <= x1; X++) {
        const u = (X + 0.5 - cx) / S, b = bay(X, Y);
        let c = -1;
        // the brass rings top and bottom, and the cage's vertical bars (8 round; the front ones show)
        if (av > LENS.H - 2.5 && av <= LENS.H + 1 && Math.abs(u) < r + 1.5) { const q = u / (r + 1.5); c = rq(R_BRASS, clamp(0.24 - q * 0.3 + (av > LENS.H ? -0.1 : 0.12) + lit * 0.5, 0, 1), b, 0.8); }
        else if (Math.abs(u) < r) {
          const q = u / r, phi = Math.asin(clamp(q, -1, 1));
          let bar = false;
          for (let k = 0; k < 8; k++) { const a = rot + k * TAU / 8; if (Math.cos(a) < 0.1) continue; if (Math.abs(Math.sin(a) - q) < 0.045 / Math.max(0.3, Math.cos(a))) bar = true; }
          if (bar) c = rq(R_BRASS, clamp(0.18 - q * 0.2 + lit * 0.6, 0, 1), b, 0.8);
          else {
            // the glass: which ring, where in it
            let ring, f;
            if (av < 9) {                                        // the belt: concentric rings round the nearest panel's centre
              let best = 9, pc = 0;
              for (let k = 0; k < 8; k++) { const a = rot + k * TAU / 8 + TAU / 16; if (Math.cos(a) < 0) continue; const d = Math.abs(Math.sin(a) - q); if (d < best) { best = d; pc = Math.sin(a); } }
              const rr = Math.hypot((q - pc) * r * 1.1, v);
              ring = rr / 2.1; f = frac(ring);
            } else { ring = (av - 9) / 3.2; f = frac(ring); }
            const reach = Math.min(1, ct * 1.25 - (Math.hypot(u / LENS.R, v / LENS.H)) * 0.25);   // how far the light has spread
            const g = lit * clamp(reach * 1.6, 0, 1) * (1.1 - Math.hypot(u / LENS.R, v / LENS.H) * 0.55);
            const edge = f > 0.82, shine = -q * 0.6 + (f < 0.3 ? 0.25 : 0);
            if (g > 0.08) {
              // alight: gold-white heart; the prism edges catch it cyan and gold; a ripple of brighter rings
              // each ring a band from deep gold at its root to white-gold at its lip, so the rings still read when it burns
              const w = Math.min(0.92, g) * (0.55 + 0.5 * f) + 0.1 * Math.sin(ring * 2.2 - T_NOW * 3);
              if (edge && g > 0.3) c = fl(ring) & 1 ? 229 : 22;
              else c = w > 0.9 ? 60 : w > 0.72 ? 200 : w > 0.56 ? 199 : w > 0.4 ? 183 : w > 0.27 ? 182 : w > 0.16 ? 181 : 180;
              if (g < 0.35 && b > g * 2.8) c = edge ? 226 : 224;
            } else {
              // dark: deep blue glass, thin bright lines along the prism edges, a soft reflection of the windows
              // dark: clear glass (the room and the storm show through it, cooled), thin bright lines on the prism lips,
              // a soft reflection of the windows; the lantern's warm light catches it near
              const wl = 0.3 + shine * 0.5 + (edge ? 0.35 : 0) + (Math.abs(q + 0.55) < 0.08 ? 0.3 : 0);
              const lm = LAMP.on ? lampAt(X, Y, 0, q * 0.8, 0) : 0;
              if (edge) c = lm > 0.35 ? (lm > 0.7 ? 200 : 182) : wl > 0.6 ? 227 : 225;
              else { const g2 = wl > 0.55 ? 225 : wl > 0.38 ? 224 : wl > 0.25 ? 223 : 222; c = mixC(BUF[Y * W + X], g2, 2); if (lm > 0.4 && b < (lm - 0.4) * 1.5) c = 181; }
            }
          }
        }
        if (c >= 0) BUF[Y * W + X] = c;
      }
    }
  }

  /* ================================================================ 1 · The find (0.0 – 5.0)
     Blue dusk on Christmas Eve, deep in a fir wood. Close on a fox kit sniffing at a warm glow in a hump of snow: it
     paws the snow away, an old brass lantern comes out of it still burning, the light opens on the kit's face, it is
     delighted (eyes wide, a head-cock, a smile, a hop), and it takes the bail in its mouth. Camera: up from black, a slow
     push in, then a drift right as the kit turns to go; dissolving (4.75–5.25) to the wide shot of the woods. */
  const F1 = { L: {}, rig: null };
  const R_DUSK = [202, 203, 204, 205, 206, 207, 208, 209];
  BUILDERS.push(() => {
    F1.rig = mkRig([0.04, 0.05, 0.13], [0.5, 0.58, 0.9], [1.0, 0.56, 0.24]);
    const L = F1.L;
    // the sky: blue hour, deep overhead, a rose-lavender band low behind the trees; a young moon; the first stars
    L.sky = mkLayer(520, 270);
    paintStars(L.sky, 60, 110, 102, [206, 207, 194]);
    { const mx = 392, my = 60;                                   // a thin crescent, its dark side faintly lit
      for (let y = my - 9; y <= my + 9; y++) for (let x = mx - 9; x <= mx + 9; x++) {
        const d = Math.hypot(x - mx, y - my), d2 = Math.hypot(x - mx - 3.6, y - my - 1.8);
        if (d < 7.2 && d2 > 6.4) lputC(L.sky, x, y, d2 > 7.4 ? 22 : 194);
        else if (d < 7.2) lputC(L.sky, x, y, 205);
        else if (d < 9.5 && bay(x, y) < 0.5 * (9.5 - d) / 2.3) lputC(L.sky, x, y, 207);
      } }
    // far pines: a hazy wall of spires (fog does the rest)
    L.far = mkLayer(600, 270, { z0: 200, zk: 1 });
    for (let k = 0; k < 46; k++) { const x = k * 13.5 + ih(k, 1, 111) * 9, h = 52 + ih(k, 2, 111) * 44; paintPine(L.far, x, 178 + ih(k, 3, 111) * 6, h, 9 + h * 0.13, 1110 + k, 100, 0); }
    for (let x = 0; x < 600; x++) for (let y = 172 + fl(3 * Math.sin(x * 0.05)); y < 270; y++) lput(L.far, x, y, M_SNOW, 0.6, 100, 0, -0.8, 0);
    // mid pines
    L.mid = mkLayer(640, 270, { z0: 200, zk: 1 });
    for (let k = 0; k < 22; k++) { const x = k * 30 + ih(k, 1, 121) * 18, h = 90 + ih(k, 2, 121) * 60; paintPine(L.mid, x, 186 + ih(k, 3, 121) * 6, h, 15 + h * 0.15, 1210 + k, 100, 1); }
    for (let x = 0; x < 640; x++) { const ys = 183 + 3 * Math.sin(x * 0.031) + 2 * Math.sin(x * 0.11); for (let y = fl(ys); y < 270; y++) lput(L.mid, x, y, M_SNOW, 0.62 + (y - ys < 1 ? 0.2 : 0), 100, 0, -0.8, 0); }
    // the near wood: a big fir behind the kit (left), another right of the clearing, a snowbank
    L.back = mkLayer(680, 270, { z0: 0, zk: 1 });
    paintPine(L.back, 78, 200, 230, 70, 131, 110, 2);
    paintPine(L.back, 520, 198, 250, 76, 132, 110, 2);
    paintPine(L.back, 300, 194, 120, 34, 133, 120, 1);
    paintPine(L.back, 640, 196, 170, 48, 134, 115, 2);
    { const surf = (x) => 192 + 4 * Math.sin(x * 0.02 + 1) + 2.5 * Math.sin(x * 0.07); paintGround(L.back, surf, (y) => 105, 135, { spark: 0.02, y1: 232 }); }
    // the clearing: drifts, a log under snow at the right, dry stalks and a sapling poking through, the kit's ground
    L.main = mkLayer(700, 270, { z0: -128, zk: 1, recv: true });
    const surfM = (x) => 198 + 5 * Math.sin(x * 0.013 + 0.4) + 2.2 * Math.sin(x * 0.041 + 2) + 1.2 * Math.sin(x * 0.12);
    const depM = (y) => 128 + (214 - y) * 3;
    paintGround(L.main, surfM, depM, 141, { wells: [{ x: 452, y: 206, r: 40, a: 0.35 }], spark: 0.05,
      shadows: [{ x: 60, y: 202, dx: -1.6, w: 34, a: 0.3 }, { x: 330, y: 200, dx: -1.6, w: 16, a: 0.22 }, { x: 560, y: 200, dx: -1.6, w: 40, a: 0.3 }] });
    // its tracks: a line of small dents coming in from the left through the snow
    for (let k = 0; k < 14; k++) {
      const x = 8 + k * 11.5 + (k & 1) * 3, y = 214 + (k & 1 ? 3 : -1) + Math.sin(k * 0.7) * 2;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const q = dx * dx / 5 + dy * dy / 2.2; if (q < 1) { const i = (fl(y + dy)) * L.main.w + fl(x + dx); L.main.S[i] = clamp(L.main.S[i] - (q < 0.5 ? 40 : 22) + (dy < 0 ? -10 : 8), 0, 255); } }
    }
    // the fallen log, under a long cap of snow
    for (let x = 400; x < 520; x++) {
      const q = (x - 400) / 120, top = 196 - 9 * Math.sin(PI * clamp(q * 1.1, 0, 1)) + (ih(x, 0, 142) - 0.5);
      for (let y = fl(top); y < 210; y++) {
        const dd = y - top, r = 9 * Math.sin(PI * clamp(q * 1.1, 0, 1)) + 1;
        if (dd < r * 0.55) lput(L.main, x, y, M_SNOW, 0.9 - dd * 0.04 + (vn(x, y, 3, 143) - 0.5) * 0.2, depM(208), -0.2, -0.8, ih(x, y, 144) < 0.05 ? 1 + fl(ih(x, y, 145) * 250) : 0);
        else if (dd < r * 1.25) lput(L.main, x, y, M_BARK, 0.25 - (dd - r * 0.55) * 0.03 + (vn(x * 0.3, y * 2, 2, 146) - 0.5) * 0.3, depM(208), 0, 0.4, 0);
      }
    }
    // the log's sawn end: rings
    for (let y = 186; y < 210; y++) for (let x = 512; x < 526; x++) { const d = Math.hypot((x - 518) / 6, (y - 199) / 9); if (d < 1) lput(L.main, x, y, d > 0.82 ? M_BARK : M_WOOD, d > 0.82 ? 0.3 : 0.45 + 0.15 * Math.sin(d * 18), depM(208), 0.7, 0, 0); }
    // dry grass through the snow: thin pale stems, bent seed heads, a pinch of snow on some
    for (let k = 0; k < 26; k++) {
      const x = 14 + ih(k, 1, 147) * 660, ys = surfM(x) + 6 + ih(k, 2, 147) * 30, hgt = 7 + ih(k, 3, 147) * 15, lean = (ih(k, 4, 147) - 0.5) * 9;
      if (x > 200 && x < 300) continue;
      for (let b2 = 0; b2 < 3; b2++) {
        const bx = x + (b2 - 1) * 2.2, bh = hgt * (0.65 + 0.35 * ih(k, 5 + b2, 147)), bl = lean * (0.6 + 0.5 * ih(k, 9 + b2, 147));
        for (let j = 0; j < bh; j++) { const u = j / bh, xx = bx + bl * u * u; lput(L.main, xx, ys - j, M_GRASS, 0.42 + 0.25 * u, depM(ys), -0.5, 0, 0); }
        if (b2 === 1) for (let j = 0; j < 4; j++) lput(L.main, bx + bl + (bl > 0 ? 1 : -1) * j * 0.6, ys - bh + j * 0.8, M_GRASS, 0.75, depM(ys), 0, -0.5, 0);
        if (ih(k, 13 + b2, 147) < 0.4) lput(L.main, bx + bl, ys - bh - 1, M_SNOW, 0.95, depM(ys), 0, -0.9, 0);
      }
    }
    // a little sapling fir by the log
    paintPine(L.main, 382, 206, 66, 26, 148, depM(206), 1);
    // the foreground: a drift lip along the bottom, and a heavy bough hanging in from the top left
    L.fore = mkLayer(800, 270, { z0: -128, zk: 1 });
    for (let x = 0; x < 800; x++) {
      const top = 236 + 6 * Math.sin(x * 0.018 + 0.8) + 3 * Math.sin(x * 0.07) + (x > 520 ? -6 * sstep(520, 640, x) : 0);
      for (let y = fl(top); y < 270; y++) { const dd = y - top; lput(L.fore, x, y, M_SNOW, 0.46 + 0.22 * clamp(1 - dd / 5, 0, 1) + (vn(x, y, 6, 151) - 0.5) * 0.18, 0, -0.1, -0.85, ih(x, y, 152) < 0.03 ? 1 + fl(ih(x, y, 153) * 250) : 0); }
    }
  });
  // a fir bough hanging into the frame: a twig curving down from (x, y), side twigs, needles in sprays, snow on top
  function paintBough(L, x, y, len, wid, a, seed, z) {
    const ca = Math.cos(a), sa = Math.sin(a), pts = [];
    for (let s = 0; s <= len; s++) { const u = s / len; pts.push([x + ca * s - sa * u * u * len * 0.3, y + sa * s + ca * u * u * len * 0.3]); }
    const twig = (px, py, dx, dy, n, w0, sd) => {
      for (let s = 0; s < n; s++) {
        const u = s / n, bx = px + dx * s, by = py + dy * s + u * u * n * 0.15, w = w0 * (1 - u * 0.55);
        lput(L, bx, by, M_BARK, 0.12, z, 0, 0, 0);
        // needles: short strokes fanning down and out on both sides
        for (let k = 0; k < 2; k++) {
          const sd2 = k ? 1 : -1, ang = Math.atan2(dy, dx) + sd2 * (1.05 + 0.4 * ih(s, k, sd)) + 0.35, nl = w * (0.6 + 0.5 * ih(s, k + 3, sd));
          for (let q = 1; q < nl; q++) lput(L, bx + Math.cos(ang) * q, by + Math.sin(ang) * q, M_PINED, 0.12 + 0.14 * (q / nl) + (ih(s, q, sd + 5) - 0.5) * 0.1, z, Math.cos(ang) * 0.6, Math.sin(ang) * 0.4, 0);
        }
        // snow on the upper side, in clumps
        const sn = w * 0.55 * (0.35 + 0.65 * vn(s, 0, 5, sd + 7)) * (1 - u * 0.4);
        for (let q = 0; q < sn; q++) lput(L, bx + (ih(s, q, sd + 9) - 0.5), by - 1 - q, M_SNOW, 0.66 + 0.25 * (q / Math.max(1, sn)) + (vn(bx, by - q, 2, sd + 11) - 0.5) * 0.3, z, -0.2, -0.8, 0);
      }
    };
    twig(x, y, ca, sa, len, wid * 0.35, seed);
    for (let k = 0; k < 7; k++) {
      const s = fl(len * (0.12 + 0.12 * k)), p = pts[Math.min(len, s)], side = k & 1 ? 1 : -1;
      const da = a + side * (0.55 + 0.25 * ih(k, 1, seed)) + 0.4;
      twig(p[0], p[1], Math.cos(da), Math.sin(da), fl(wid * (0.6 + 0.5 * ih(k, 2, seed)) * (1 - k * 0.08)), wid * 0.3, seed + k * 13);
    }
  }

  /* ---------------------------------------------------------------- the performance */
  const F1S = 2.3;                                               // the kit's size here (px per unit at zoom 1)
  const F1LX = 252, F1LY = 215, F1LS = 1.02 * F1S;               // the lantern on the ground (its base), its size
  // the kit's track (world: main-layer pixels at zoom 1)
  const F1K = KF(
    { t: 0.0, x: 188, pitch: 0.14, tilt: 0.42, hy: 2.6, hx: 0.4, yaw: 0.34, perk: 0.4, tLift: -0.12, wa1: 0.1, wa2: 0, mouth: 0, wide: 0, lookX: 0.5, lookY: 0.6, sniff: 1, dig: 0, sq: 0, lift: 0 },
    { t: 1.5, x: 190, pitch: 0.16, tilt: 0.45, sniff: 1 },
    { t: 1.75, pitch: 0.22, tilt: 0.36, hy: 2.0, sniff: 0.2, dig: 1, tLift: 0.08, wa1: 0.06, wa2: 0.12, perk: 0.7 },
    { t: 2.7, pitch: 0.22, tilt: 0.36, dig: 1 },
    { t: 2.95, pitch: 0.02, tilt: 0.12, hy: 0.2, dig: 0, sniff: 0, wide: 1, perk: 1, yaw: 0.56, lookY: 0.4, lookX: 0.6, wa2: 0, wa1: 0.02, e: 'o' },
    { t: 3.3, yaw: 0.7, tilt: 0.06, wide: 1 },
    { t: 3.48, yaw: 0.86, tilt: -0.24, hx: -0.4, wa2: 0.34, tLift: 0.3, e: 'o' },
    { t: 3.62, sq: 0.2, lift: 0, e: 'i' },
    { t: 3.74, sq: -0.2, lift: 3.4, tilt: -0.1, e: 'o' },
    { t: 3.88, sq: -0.06, lift: 6.4, e: 'o' },
    { t: 4.02, sq: 0.0, lift: 3.0, e: 'i' },
    { t: 4.1, sq: 0.3, lift: 0, e: 'i' },
    { t: 4.26, sq: 0, yaw: 0.6, tilt: 0.1, hx: 0.4, x: 190, e: 'o' },
    { t: 4.5, x: 203, pitch: 0.16, tilt: 0.5, hy: 5.4, yaw: 0.4, wa2: 0.12, wide: 0.3, lookY: 0.8, lookX: 0.3 },
    { t: 4.62, mouth: 1 },
    { t: 4.95, x: 212, pitch: -0.04, tilt: 0.08, hy: 0, yaw: 0.42, wa2: 0.16, wide: 0, lookY: 0, lookX: 0.5, tLift: 0.1 },
  );
  const F1P = {};
  // three scrapes: when each reaches forward (each scrape takes 0.32 s)
  const F1SCR = [1.78, 2.1, 2.42];
  const f1Dig = (t) => { let p = 0; for (const s of F1SCR) p += sstep(s + 0.12, s + 0.3, t); return p / F1SCR.length; };
  function f1Pose(t) {
    const k = kt(F1K, t, F1P);
    const wagD = (u) => { const tt = t - u * 0.16; return k.wa1 * Math.sin(TAU * 1.1 * tt) + k.wa2 * Math.sin(TAU * 3.3 * tt); };
    let tilt = k.tilt + k.sniff * 0.05 * Math.sin(t * TAU * 4.6) * (0.6 + 0.4 * Math.sin(t * 2.3));
    let earN = 0.45 * bump(1.02, 1.2, t) + 0.3 * bump(3.0, 3.16, t) - 0.12 * k.perk, earF = 0.25 * bump(1.06, 1.24, t) - 0.12 * k.perk;
    // digging: the near forepaw reaches and scrapes back, three times
    let reach = 0;
    for (const s of F1SCR) { const q = (t - s) / 0.32; if (q > 0 && q < 1) reach = q < 0.35 ? eoc(q / 0.35) * 1.3 : 1.3 * (1 - eis((q - 0.35) / 0.65)); }
    let eyes = 1;
    for (const b of [0.55, 2.0, 4.38]) { const q = (t - b) / 0.14; if (q > 0 && q < 1) eyes = Math.abs(q * 2 - 1); }
    const happy = t > 3.52 && t < 3.98 ? 1 : 0;
    return {
      gait: t > 4.7 ? sstep(4.7, 5.0, t) : 0, ph: (t - 4.7) * 2.6, A: 3.6 * sstep(4.7, 5.0, t),
      pitch: k.pitch, tilt, hy: k.hy, hx: k.hx, yaw: k.yaw, earN, earF, perk: k.perk, tLift: k.tLift, wagD,
      mouth: happy ? 2 : k.mouth > 0.5 ? 1 : 0, eyes, happy, wide: k.wide, lookX: k.lookX, lookY: k.lookY,
      dig: k.dig, digReach: reach, sq: k.sq, lift: k.lift, breath: t * TAU * 0.9, whisk: 0,
    };
  }
  const F1LIGHT = { sky: [-0.45, -0.9], rim: 0.75, amb: 0.36, z: 4, gain: 1.6 };
  // the camera: (x, y) main-layer point at the screen centre, zoom
  function f1Cam(t) {
    const zp = 1 + 0.3 * eis(t / 3.5) - 0.12 * eis((t - 4.2) / 0.8);
    const fx = 226, fy = 192;                                    // the push in holds this point still on screen
    let x = fx - (fx - 240) / zp, y = fy - (fy - 135) / zp;
    x += 24 * eis((t - 4.3) / 1.2) + drift(t, 1, 0.8); y += drift(t, 2, 0.5);
    return [x, y, zp];
  }
  // the hump of snow over the lantern (it goes down as the kit digs), and what it throws
  function f1Mound(t, cam, dig) {
    const [cx, cy, z] = cam, sx = (wx) => toSX(cx, z, wx), sy = (wy) => toSY(cy, z, wy);
    const hgt = lerp(25, 3.2, dig), rx = lerp(27, 17, dig);
    const X0 = fl(sx(F1LX - rx - 2)), X1 = Math.ceil(sx(F1LX + rx + 2)), Y0 = fl(sy(F1LY - hgt - 3)), Y1 = Math.ceil(sy(F1LY + 6));
    for (let Y = Math.max(ROW0, Y0); Y <= Math.min(ROW1, Y1); Y++) for (let X = Math.max(0, X0); X <= Math.min(W - 1, X1); X++) {
      const wx = toLX(cx, z, X), wy = toLY(cy, z, Y), u = (wx - F1LX) / rx;
      if (Math.abs(u) >= 1) continue;
      const lump = (vn(wx * 1.4, 0, 3, 171) - 0.5) * 3 * (1 - dig * 0.5), top = F1LY + 2 - hgt * Math.pow(1 - u * u, 0.75) + lump;
      // after the digging: a ring of snow round the lantern's foot (the hollow it was in), lower in front of it
      if (wy < top || wy > F1LY + 4 + 2 * (1 - u * u)) continue;
      const dd = wy - top, d2 = Math.hypot(wx - F1LX, (wy - (F1LY - 7 * F1LS / F1S)) * 1.2);
      // light inside the snow: it glows warm round the lantern, through the thinning hump
      const sss = (0.75 + 0.6 * LAMP.I) * Math.exp(-Math.max(0, d2 - 4) / (6.5 + 7 * dig));
      const s = 0.42 + 0.3 * clamp(1 - dd / 3, 0, 1) - u * 0.18 + (vn(wx, wy, 2.5, 172) - 0.5) * 0.22;
      const l = lampAt(X, Y, 0, -u * 0.6, -0.6) * 0.4 + sss * 0.85;
      BUF[Y * W + X] = mc(M_SNOW, s, l, X, Y);
    }
    // snow thrown back by each scrape: a spray of clods, arcing and falling
    for (const s of F1SCR) {
      const g = t - s - 0.12; if (g < 0 || g > 0.8) continue;
      for (let k = 0; k < 22; k++) {
        const a = -PI * (0.62 + 0.3 * ih(k, 1, 173)), v = 70 + 90 * ih(k, 2, 173);
        const wx = F1LX - 14 + Math.cos(a) * v * g, wy = F1LY - 8 + Math.sin(a) * v * g + 260 * g * g;
        if (wy > F1LY + 8) continue;
        const X = fl(sx(wx)), Y = fl(sy(wy)), sz = ih(k, 3, 173) < 0.3 ? 2 : 1;
        const l = lampAt(X, Y, 0, 0, -0.5);
        for (let j = 0; j < sz; j++) for (let i = 0; i < sz; i++) P(X + i, Y + j, mc(M_SNOW, 0.95, l * 0.9, X + i, Y + j));
      }
    }
  }
  function f1Lamp(t) { // how alive the light is: dim and buried, waking as it is uncovered, then open
    const dig = f1Dig(t);
    return { dig, I: 0.35 + 0.45 * dig + 0.6 * sstep(2.78, 3.35, t), R: 20 + 16 * dig + 26 * sstep(2.78, 3.4, t) };
  }
  function f1Draw(t) {
    TAB = F1.rig; FOGT = F1FOG; SPK_SNOW = M_SNOW;
    const cam = f1Cam(t), [cx, cy, z] = cam, L = F1.L;
    const lay = (Ly, p, py) => [240 + (cx - 240) * p, 135 + (cy - 135) * py];
    // the kit and its lantern: where things are this frame (before anything is lit)
    const p = f1Pose(t), fk = kt(F1K, t, {});
    const S = F1S * z, fxs = toSX(cx, z, fk.x), fys = toSY(cy, z, 212);
    foxPrep(p, fxs, fys, S, 1, F1LIGHT);
    const mouth = FOXOUT.mouth;
    const lm = f1Lamp(t);
    // the lantern: on the ground until the kit takes it (4.62), then in its mouth
    const gpx = toSX(cx, z, F1LX), gpy = toSY(cy, z, F1LY - 15 * F1LS);
    const hold = sstep(4.56, 4.7, t);
    const lpx = lerp(gpx, mouth[0], hold), lpy = lerp(gpy, mouth[1], hold);
    let th = 0;
    if (t > 4.6) th = pendulum(t, (tt) => { const q = f1Pose(tt), kk = kt(F1K, tt, {}); foxPrep(q, kk.x, 212, F1S, 1, F1LIGHT); return [FOXOUT.mouth[0] / F1LS, FOXOUT.mouth[1] / F1LS]; }, 4.6) * sstep(4.6, 4.75, t);
    foxPrep(p, fxs, fys, S, 1, F1LIGHT);                         // (the pendulum borrowed the rig)
    const LS = F1LS * z, fl0 = lanternFlame(lpx, lpy, LS, th);
    LAMP.on = 1; LAMP.x = fl0[0]; LAMP.y = fl0[1]; LAMP.z = 3; LAMP.h = Math.max(4, (toSY(cy, z, lerp(215, 213, hold)) - fl0[1]) / z); LAMP.I = lm.I * flick(t); LAMP.R = lm.R * z; LAMP.zoom = z; LAMP.rot = th * 2;
    // the kit's own shadow, thrown back from the flame across the snow, and the soft one under it
    SHAD.push({ x: fxs - 18 * z, y: fys + 2 * z, rx: 42 * z, ry: 7 * z, a: 0.7 * sstep(2.6, 3.4, t) + 0.2, lamp: 1 });
    SHAD.push({ x: fxs + 2 * z, y: fys + 1, rx: 30 * z, ry: 4.5 * z, a: 0.4, lamp: 0 });
    // paint, back to front
    skyLive(R_DUSK, 20, 205, 240 + (cx - 240) * 0.06, 135 + (cy - 135) * 0.06, z, 101);
    comp(L.sky, 240 + (cx - 240) * 0.06, 135 + (cy - 135) * 0.06, z, 0);
    liveStars(t, 24, 191, 240 + (cx - 240) * 0.06, 135, z, 100, (c) => c >= 202 && c <= 205);
    const [a1, b1] = lay(0, 0.3, 0.3); comp(L.far, a1, b1, z, 0.7, { mist: 0.25, mistY: 150, mistH: 30 });
    const [a2, b2] = lay(0, 0.55, 0.55); comp(L.mid, a2, b2, z, 0.5, { mist: 0.3, mistY: 160, mistH: 30 });
    const [a3, b3] = lay(0, 0.8, 0.8); comp(L.back, a3, b3, z, 0.2, { mist: 0.25, mistY: 180, mistH: 20 });
    comp(L.main, cx, cy, z, 0);
    // the lantern (until it is lifted, half in its hump of snow), and the kit
    const drawL = () => drawLantern(lpx, lpy, LS, th, { lit: clamp(lm.I * 1.1, 0, 1), snow: 1 - sstep(2.2, 2.9, t) });
    if (t < 4.6) { drawL(); f1Mound(t, cam, lm.dig); }
    drawFox(Object.assign(p, { preHead: t >= 4.6 ? () => {} : null }), fxs, fys, S, 1, F1LIGHT);
    if (t >= 4.6) drawL();
    lanternGlow(LAMP.x, LAMP.y, z, clamp(lm.I, 0, 1));
    if (t < 3) glow(toSX(cx, z, F1LX), toSY(cy, z, F1LY - 6), 26 * z, T_LAMP, 0.32 * (1 - sstep(2.4, 3, t)));
    comp(L.fore, 240 + (cx - 240) * 1.4, 135 + (cy - 135) * 1.4, z, 0, { noSpark: false });
    snowfall(t, cx, cy, z, { dens: 0.8 });
    // up from black
    if (t < 1.0) tintAll(T_DARK, 1 - eis(t / 1.0));
  }
  let F1FOG = null;
  BUILDERS.push(() => { F1FOG = mkTab('6c74b0', false); });
  shot(0, 4.75, (lt, t) => f1Draw(t));

  /* ================================================================ 2 · Through the woods (4.75 – 10.45 … 11.0)
     The wide shot: the kit trots right through the deep blue fir wood with the lantern swinging from its mouth; the warm
     pool slides over the snow and up the trunks, the crust glitters where it passes, paw prints follow it. A pair of owls
     (a parent and a fluffy owlet) and then a third turn their heads to watch it go. Camera: tracking, a beat behind the
     kit. It ends behind a dark trunk sweeping past the lens (10.25–11.0), the frozen falls dissolving in behind it. */
  const F2 = { L: {}, rig: null };
  const F2S = 1.32, F2G = 208, F2LS = 1.02 * F2S;              // kit size, ground row, lantern size
  const F2OFF = 120;                                             // main layer x = world x + this
  // the kit's way: eased up to a trot, then steady (world px)
  const f2X = (t) => { const d = Math.max(0, t - 4.75); return 112 + 55 * d - 32 * 0.45 * (1 - Math.exp(-d / 0.45)); };
  const f2Cam = (t) => { const x = f2X(t - 0.28) + 44 + drift(t, 3, 1.2); return [x, 132 + drift(t, 4, 0.8), 1]; };
  // the owls: [world x, branch y, size, which tree]
  const OWLS = [{ x: 280, y: 109, S: 2.1, ph: 0.2 }, { x: 298, y: 111, S: 1.45, ph: 0.9, chick: 1 }, { x: 462, y: 124, S: 2.0, ph: 2.1 }];
  BUILDERS.push(() => {
    F2.rig = mkRig([0.04, 0.05, 0.13], [0.5, 0.58, 0.9], [1.0, 0.56, 0.24]);
    const L = F2.L;
    L.sky = mkLayer(560, 270);
    paintStars(L.sky, 70, 110, 202, [206, 207, 194]);
    L.far = mkLayer(700, 270, { z0: 200 });
    for (let k = 0; k < 58; k++) { const x = k * 12.5 + ih(k, 1, 211) * 8, h = 46 + ih(k, 2, 211) * 40; paintPine(L.far, x, 176 + ih(k, 3, 211) * 6, h, 8 + h * 0.13, 2110 + k, 100, 0); }
    for (let x = 0; x < 700; x++) for (let y = 172 + fl(3 * Math.sin(x * 0.05)); y < 270; y++) lput(L.far, x, y, M_SNOW, 0.55, 100, 0, -0.8, 0);
    L.mid = mkLayer(820, 270, { z0: 200 });
    for (let k = 0; k < 30; k++) { const x = k * 28 + ih(k, 1, 221) * 16, h = 80 + ih(k, 2, 221) * 70; paintPine(L.mid, x, 186 + ih(k, 3, 221) * 5, h, 14 + h * 0.16, 2210 + k, 100, 1); }
    for (let x = 0; x < 820; x++) { const ys = 183 + 3 * Math.sin(x * 0.031) + 2 * Math.sin(x * 0.11); for (let y = fl(ys); y < 270; y++) lput(L.mid, x, y, M_SNOW, 0.55 + (y - ys < 1 ? 0.2 : 0), 100, 0, -0.8, 0); }
    // the near wood: tall firs whose crowns go up out of frame, some bare dead branches low down (the owls' perches)
    L.back = mkLayer(980, 270, { z0: 0 });
    for (let k = 0; k < 10; k++) { const x = 30 + k * 98 + ih(k, 1, 231) * 50, h = 130 + ih(k, 2, 231) * 110; paintPine(L.back, x, 196 + ih(k, 3, 231) * 4, h, 26 + h * (0.1 + 0.06 * ih(k, 4, 231)), 2310 + k, 110, 2, { snow: 0.6 + 0.5 * ih(k, 5, 231) }); }
    { const surf = (x) => 193 + 3 * Math.sin(x * 0.02 + 1) + 2 * Math.sin(x * 0.07); paintGround(L.back, surf, (y) => 105, 235, { spark: 0.02, y1: 230 }); }
    // the kit's path: the snow, and the big trunks beside it (main plane, lit by the lantern as it passes)
    const W2 = 1000;
    L.main = mkLayer(W2, 270, { z0: -128, recv: true });
    const surfM = (x) => 200 + 3.5 * Math.sin(x * 0.017 + 0.4) + 2 * Math.sin(x * 0.047 + 2) + 1 * Math.sin(x * 0.13);
    const depM = (y) => 128 + (F2G - y) * 3;
    const TR = [[60, 26], [250, 30], [360, 18], [420, 32], [610, 24], [760, 34], [900, 22]];
    paintGround(L.main, surfM, depM, 241, { spark: 0.05, wells: TR.map(([x, w]) => ({ x: x + F2OFF, y: surfM(x + F2OFF) + 3, r: w * 1.6, a: 0.3 })),
      shadows: TR.map(([x, w]) => ({ x: x + F2OFF, y: surfM(x + F2OFF) + 2, dx: -1.5, w: w * 0.9, a: 0.25 })) });
    for (const [wx, w] of TR) paintTrunk(L.main, wx + F2OFF, surfM(wx + F2OFF) + 3, w * 0.5, depM(surfM(wx + F2OFF) + 3), 2400 + wx);
    // the owls' perches: dead branches stubbing out of two trunks, with snow along their tops
    paintBranch(L.main, 250 + F2OFF + 10, 111, 1, 56, depM(204), 251);
    paintBranch(L.main, 420 + F2OFF + 12, 124, 1, 50, depM(204), 252);
    paintBranch(L.main, 60 + F2OFF - 12, 96, -1, 40, depM(204), 253);
    paintBranch(L.main, 610 + F2OFF + 10, 112, 1, 30, depM(204), 254);
    // undergrowth: a few small firs half buried, dry grass
    for (const [x, h] of [[150, 40], [520, 48], [700, 36], [850, 52]]) paintPine(L.main, x + F2OFF, surfM(x + F2OFF) + 8, h, h * 0.42, 2500 + x, depM(surfM(x + F2OFF) + 8), 1);
    for (let k = 0; k < 40; k++) {
      const x = ih(k, 1, 261) * W2, ys = surfM(x) + 6 + ih(k, 2, 261) * 36, hgt = 6 + ih(k, 3, 261) * 12, lean = (ih(k, 4, 261) - 0.5) * 8;
      for (let b2 = 0; b2 < 3; b2++) { const bx = x + (b2 - 1) * 2, bh = hgt * (0.6 + 0.4 * ih(k, 5 + b2, 261)); for (let j = 0; j < bh; j++) { const u = j / bh; lput(L.main, bx + lean * u * u, ys - j, M_GRASS, 0.4 + 0.25 * u, depM(ys), -0.5, 0, 0); } }
    }
    // foreground: drifts along the bottom, a snowy shrub now and then
    L.fore = mkLayer(1300, 270, { z0: -128 });
    for (let x = 0; x < 1300; x++) {
      const top = 238 + 5 * Math.sin(x * 0.015 + 0.8) + 3 * Math.sin(x * 0.06) - 14 * Math.max(0, Math.sin(x * 0.0105 + 1.3)) ** 6;
      for (let y = fl(top); y < 270; y++) { const dd = y - top; lput(L.fore, x, y, M_SNOW, 0.36 + 0.22 * clamp(1 - dd / 5, 0, 1) + (vn(x, y, 6, 271) - 0.5) * 0.16, 0, -0.1, -0.85, ih(x, y, 272) < 0.03 ? 1 + fl(ih(x, y, 273) * 250) : 0); }
    }
    for (const x of [180, 610, 1020]) paintPine(L.fore, x, 262, 70, 40, 2700 + x, 0, 2, { dark: 1 });
  });
  // a big fir trunk: furrowed bark, a cool rim on the moon side, snow on the windward ridges, roots into the snow
  function paintTrunk(L, x, yb, hw, z, seed) {
    for (let y = 0; y < yb + 2; y++) {
      const flare = 1 + 0.55 * Math.pow(sstep(yb - 26, yb + 2, y), 1.6), w = hw * flare * (1 + 0.04 * Math.sin(y * 0.045 + seed) - 0.18 * (1 - y / yb));
      for (let dx = -Math.ceil(w); dx <= Math.ceil(w); dx++) {
        const q = dx / w; if (Math.abs(q) > 1) continue;
        const nx = q, nc = Math.sqrt(1 - q * q);
        // furrows: long vertical grooves that wander, plates between them
        const fu = vn(dx * 2.4 + seed, y * 0.08, 1.6, seed) , grain = vn(dx * 1.2, y * 0.5, 2.5, seed + 1);
        let s = 0.3 + 0.24 * nc - 0.1 * q + (fu < 0.32 ? -0.17 : fu > 0.72 ? 0.08 : 0) + (grain - 0.5) * 0.16;
        let m = M_BARK;
        if (q < -0.55 && fu > 0.6 && vn(dx, y * 0.2, 3, seed + 2) > 0.55) { m = M_SNOW; s = 0.55 + (q + 1) * 0.3; }   // snow stuck in the windward bark
        if (q < -0.86) s += 0.12;                                       // the cool rim
        lput(L, x + dx, y, m, s, z, nx * 0.95, 0, 0);
      }
    }
  }
  function paintBranch(L, x, y, dir, len, z, seed) {
    for (let s = 0; s < len; s++) {
      const u = s / len, bx = x + dir * s, by = y + u * u * 6 - Math.sin(u * 3) * 2, th = Math.max(1, 3.2 * (1 - u));
      for (let k = -th; k <= th; k++) lput(L, bx, by + k, M_BARK, 0.25 - k * 0.04, z, 0, k / th * 0.8, 0);
      const sn = Math.max(0, (2.6 - u * 2) * (0.6 + 0.6 * vn(s, 0, 4, seed)));
      for (let k = 1; k <= sn; k++) lput(L, bx, by - th - k + 1, M_SNOW, 0.7 + 0.2 * (k / sn), z, 0, -0.8, 0);
      if (s > 8 && ih(s, 1, seed) < 0.12) for (let j = 0; j < 7; j++) lput(L, bx + dir * j * 0.6, by - j, M_BARK, 0.2, z, 0, 0, 0);   // a twig
    }
  }
  const F2LIGHT = { sky: [-0.45, -0.9], rim: 0.75, amb: 0.36, z: 4, gain: 1.5 };
  const f2Pose = (t) => {
    const ph = (t - 4.7) * 2.6, g = sstep(4.7, 5.25, t);
    const wagD = (u) => { const tt = t - u * 0.15; return 0.1 * Math.sin(TAU * 1.3 * tt) + 0.08 * Math.sin(TAU * 2.6 * tt + 1); };
    let eyes = 1; for (const b of [6.1, 8.4, 9.9]) { const q = (t - b) / 0.14; if (q > 0 && q < 1) eyes = Math.abs(q * 2 - 1); }
    // it glances up at the owls as it passes under them
    const look = bump(6.5, 7.7, t) + bump(8.9, 9.9, t);
    return { ph, gait: g, A: 4.4 * g, yaw: 0.44 + 0.12 * look, tilt: 0.06 - 0.2 * look, mouth: 1, tLift: 0.05, wagD,
      earN: 0.1 + 0.25 * bump(7.9, 8.1, t), earF: 0.1, perk: 0.6, eyes, lookY: -0.6 * look, lookX: 0.4, breath: t * TAU * 1.4, pitch: -0.03 };
  };
  // paw prints left behind: where each foot was set down
  function f2Prints(t, cx, cy, z) {
    for (let leg = 0; leg < 4; leg++) {
      const off = [0, 0.5, 0.5, 0][leg], lx = [6.6, 5.1, -6.8, -5.5][leg], near = leg === 0 || leg === 2;
      for (let k = 0; k < 20; k++) {
        const tk = 4.7 + (k - off) / 2.6; if (tk > t - 0.05 || tk < 4.9) continue;
        const wx = f2X(tk) + (lx + 3.7) * F2S, wy = F2G + (near ? 1.5 : -1.2);
        const X = toSX(cx, z, wx), Y = toSY(cy, z, wy);
        if (X < -3 || X > W + 3) continue;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) {
          const q = dx * dx / 4.5 + dy * dy / 1.4; if (q >= 1) continue;
          const xx = fl(X + dx), yy = fl(Y + dy); if (xx < 0 || xx >= W || yy < ROW0 || yy > ROW1) continue;
          BUF[yy * W + xx] = mc(M_SNOW, dy < 0 ? 0.26 : 0.4, lampAt(xx, yy, (F2G - wy) * 3, 0, -1) * 0.75, xx, yy);
        }
      }
    }
  }
  function f2Owl(o, t, cx, cy, z, lpx) {
    const X = toSX(cx, z, o.x), Y = toSY(cy, z, o.y);
    if (X < -30 || X > W + 30) return;
    // where the lantern is from the owl: the head follows it, a beat late; drowsy until the light comes near
    const near = sstep(150, 60, Math.abs(lpx - X)), dx = lpx - X;
    const yaw = clamp(Math.atan2(dx, 70) * 1.25, -1.35, 1.35) * sstep(0, 1, near * 1.4 + 0.2) + (o.chick ? 0.12 * Math.sin(t * 2.2) : 0);
    let open = lerp(0.4, 1, sstep(0.05, 0.5, near));
    const bq = (t * 0.7 + o.ph) % 2.6; if (bq < 0.12) open *= Math.abs(bq / 0.06 - 1);
    const roll = (o.chick ? 0.28 * sstep(0.3, 0.9, near) * Math.sign(dx) : 0.08 * Math.sin(t * 0.8 + o.ph)) * (dx > 0 ? 1 : 0.6);
    drawOwl(X, Y, o.S * z, { yaw, open, roll, lookY: 0.5, lookX: clamp(dx / 80, -1, 1), fluff: o.chick ? 1 : 0 }, { sky: [-0.45, -0.9], amb: 0.5, z: 6 });
  }
  function f2Draw(t) {
    TAB = F2.rig; FOGT = F1FOG; SPK_SNOW = M_SNOW; SHAD.length = 0; LAMP.on = 0;
    const [cx, cy, z] = f2Cam(t), L = F2.L;
    const p = f2Pose(t), fwx = f2X(t);
    const fxs = toSX(cx, z, fwx), fys = toSY(cy, z, F2G), S = F2S * z;
    // the lantern on its pendulum, from the kit's mouth
    const th = pendulum(t, (tt) => { foxPrep(f2Pose(tt), f2X(tt), F2G, F2S, 1, F2LIGHT); return [FOXOUT.mouth[0] / F2LS, FOXOUT.mouth[1] / F2LS]; }, 4.6);
    foxPrep(p, fxs, fys, S, 1, F2LIGHT);
    const [mx, my] = FOXOUT.mouth, LS = F2LS * z, fl0 = lanternFlame(mx, my, LS, th);
    LAMP.on = 1; LAMP.x = fl0[0]; LAMP.y = fl0[1]; LAMP.z = 0; LAMP.h = Math.max(4, (fys - fl0[1]) / z); LAMP.I = 1.15 * flick(t); LAMP.R = 58 * z; LAMP.zoom = z; LAMP.rot = th * 2;
    SHAD.push({ x: fxs - 22 * z, y: fys + 1.5 * z, rx: 34 * z, ry: 5 * z, a: 0.65, lamp: 1 });
    SHAD.push({ x: fxs + 2 * z, y: fys + 1, rx: 22 * z, ry: 3.5 * z, a: 0.45, lamp: 0 });
    skyLive(R_DUSK, 10, 200, 240 + cx * 0.06, 135 + (cy - 135) * 0.06, z, 201);
    comp(L.sky, 240 + cx * 0.06, 135 + (cy - 135) * 0.06, z, 0);
    liveStars(t, 30, 291, 240 + cx * 0.06, 135, z, 100, (c) => c >= 202 && c <= 205);
    comp(L.far, 200 + cx * 0.3, 135 + (cy - 135) * 0.3, z, 0.7, { mist: 0.25, mistY: 150, mistH: 30 });
    comp(L.mid, 160 + cx * 0.55, 135 + (cy - 135) * 0.55, z, 0.5, { mist: 0.3, mistY: 160, mistH: 30 });
    comp(L.back, 120 + cx * 0.8, 135 + (cy - 135) * 0.8, z, 0.2, { mist: 0.25, mistY: 180, mistH: 20 });
    comp(L.main, cx + F2OFF, cy, z, 0);
    f2Prints(t, cx, cy, z);
    for (const o of OWLS) f2Owl(o, t, cx, cy, z, LAMP.x);
    drawFox(p, fxs, fys, S, 1, F2LIGHT);
    drawLantern(mx, my, LS, th, { lit: 1 });
    lanternGlow(LAMP.x, LAMP.y, z, 1);
    comp(L.fore, 30 + cx * 1.4, 135 + (cy - 135) * 1.4, z, 0);
    snowfall(t, cx, cy, z, { dens: 0.9 });
  }
  shot(4.75, 10.8, (lt, t) => {
    if (t < 5.25) dissolve(() => f1Draw(t), () => f2Draw(t), eis((t - 4.75) / 0.5), 31);
    else f2Draw(t);
    if (t > 10.6) f23Trunk(t);
  });

  /* ================================================================ 3 · The frozen waterfall (10.45 … 11.0 – 17.0)
     A gorge: dark rock walls with snow on every ledge, and between them a waterfall frozen into organ pipes of ice,
     bulging in steps, hung with icicles, mounds of frozen spray at its foot. The kit crosses the frozen river in front.
     The ice is shaded live: cool and deep where it is dark, glowing gold inside where the lantern reaches, cyan at the
     refracting rims, caustic bands wavering, cracks lighting up. The river ice is a dark mirror (the falls, the kit and
     its lantern reflected) with the water still moving under it. Camera: low and close (z 1.25), craning up and widening
     to the whole height, then tilting up past the lip into the sky, where the aurora is beginning. */
  const F3 = { L: {}, rig: null };
  const OY3 = 300;                                               // layer y = world y + this (the layers reach up into the sky)
  const F3S = 1.3, F3G = 214, F3LS = 1.02 * F3S, F3POOL = 191;    // kit size, its row on the ice, lantern size, where the falls meet the ice
  const F3FX0 = 196, F3FX1 = 404;                                 // the falls' sides
  const M_RIVER = defMat('1a3a5a', PAL_ICE);
  BUILDERS.push(() => {
    F3.rig = mkRig([0.03, 0.05, 0.11], [0.42, 0.56, 0.86], [1.0, 0.56, 0.24]);
    const L = F3.L, H3 = 580;
    L.sky = mkLayer(700, H3);
    paintStars(L.sky, 240, OY3 - 60, 302, [206, 207, 194]);
    // far mountains, snow-capped, hazy
    L.far = mkLayer(700, H3, { z0: 200 });
    { const ht = (x) => 30 * fbm(x, 0, 80, 4, 311) + 34 * Math.abs(Math.sin(x * 0.0095 + 0.6)) ** 3;
      for (let x = 0; x < 700; x++) {
        const top = OY3 - 112 - ht(x), sl = (ht(x + 2) - ht(x - 2)) / 4;
        for (let y = fl(top); y < OY3 - 70; y++) {
          // a far ridge, mostly in shadow: a lit snowy crest on the faces turned to the light
          const dd = y - top, snow = dd < 2 + 7 * fbm(x, 0, 22, 2, 313);
          lput(L.far, x, y, snow ? M_SNOW : M_ROCK, snow ? 0.42 + clamp(sl, -0.15, 0.15) - dd * 0.02 : 0.18 - dd * 0.001, 200, 0, -0.4, 0);
        }
      } }
    // the gorge: rock walls, and the frozen falls between them
    L.gorge = mkLayer(720, H3, { z0: 0 });
    paintGorge(L.gorge);
    // the river: dark ice, and the snowbank in front
    L.main = mkLayer(800, H3, { z0: -128, recv: true });
    const depM = (y) => 128 + (F3G - y) * 3;
    for (let x = 0; x < 800; x++) {
      const yb = OY3 + 229 + 3 * Math.sin(x * 0.03 + 1) + 2 * Math.sin(x * 0.09);
      for (let y = OY3 + F3POOL; y < yb; y++) {
        const wy = y - OY3, f = ih(x, y, 331) < 0.004 ? 1 + fl(ih(x, y, 332) * 250) : 0;   // trapped bubbles
        lput(L.main, x, y, M_RIVER, 0.3 + 0.1 * vn(x * 0.4, wy * 2, 6, 333), depM(wy), 0, -1, f);
      }
      for (let y = fl(yb); y < H3; y++) {
        const dd = y - yb, wy = y - OY3;
        lput(L.main, x, y, M_SNOW, 0.48 + 0.2 * clamp(1 - dd / 4, 0, 1) + (vn(x, y, 7, 334) - 0.5) * 0.18, depM(wy), 0, -1, ih(x, y, 335) < 0.04 ? 1 + fl(ih(x, y, 336) * 250) : 0);
      }
    }
    // frozen reeds along the near bank, each with a bead of ice
    for (let k = 0; k < 30; k++) {
      const x = ih(k, 1, 337) * 800, yb = OY3 + 232 + ih(k, 2, 337) * 10, h = 8 + ih(k, 3, 337) * 14, ln = (ih(k, 4, 337) - 0.5) * 6;
      for (let j = 0; j < h; j++) lput(L.main, x + ln * (j / h) ** 2, yb - j, M_GRASS, 0.35 + 0.3 * j / h, depM(yb - OY3), -0.4, 0, 0);
      lput(L.main, x + ln, yb - h, M_ICE, 0.9, depM(yb - OY3), 0, -0.5, 2);
    }
    L.fore = mkLayer(1000, H3, { z0: -128 });
    for (let x = 0; x < 1000; x++) {
      const top = OY3 + 246 + 5 * Math.sin(x * 0.02 + 0.4) + 3 * Math.sin(x * 0.07) - 18 * Math.max(0, Math.sin(x * 0.011 + 2.2)) ** 8;
      for (let y = fl(top); y < H3; y++) lput(L.fore, x, y, M_SNOW, 0.34 + 0.2 * clamp(1 - (y - top) / 4, 0, 1) + (vn(x, y, 6, 341) - 0.5) * 0.14, 0, 0, -1, ih(x, y, 342) < 0.03 ? 1 + fl(ih(x, y, 343) * 250) : 0);
    }
  });
  // craggy rock: jittered cells (facets), each tilted its own way; dark crevices between; snow on the facets that face up
  const RK = { s: 0, nx: 0, ny: 0, snow: 0 };
  function rockAt(x, y, seed) {
    // tall slabs: cells stretched upright, sheared a little, so the cliff reads as fractured columns of rock
    const xs = x + y * 0.18, cw = 19, ch = 38, gx = fl(xs / cw), gy = fl(y / ch);
    let d1 = 9, d2 = 9, id = 0, ccy = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const i = gx + di, j = gy + dj, cx = (i + 0.2 + 0.6 * ih(i, j, seed)) * cw, cy = (j + 0.15 + 0.7 * ih(i, j, seed + 1)) * ch;
      const d = ((xs - cx) / cw) ** 2 + ((y - cy) / ch) ** 2 * 0.8;
      if (d < d1) { d2 = d1; d1 = d; id = i * 7919 + j; ccy = cy; } else if (d < d2) d2 = d;
    }
    const nx = (ih(id, 3, seed) - 0.5) * 1.1, ny = (ih(id, 4, seed) - 0.55) * 0.9, e = Math.sqrt(d2) - Math.sqrt(d1);
    const grain = vn(xs * 0.7, y * 0.08, 1.4, seed + 9) - 0.5;
    let s = 0.26 + (-0.5 * nx - 0.6 * ny) * 0.3 + grain * 0.14 + (vn(x, y, 3, seed + 5) - 0.5) * 0.1 + (ih(id, 6, seed) - 0.5) * 0.1;
    if (e < 0.06) s -= 0.2 * (1 - e / 0.06);
    RK.snow = ny < -0.25 && ih(id, 8, seed) < 0.32 && y < ccy - ch * (0.32 + 0.18 * vn(x * 2, 0, 3, seed + 7)) && e > 0.07 ? 1 : 0;
    RK.s = s; RK.nx = nx; RK.ny = ny;
    return RK;
  }
  function paintGorge(L) {
    const oy = OY3, LIP = -72, Y0 = -130;
    // where the walls end and the ice begins (wavy; the rock overhangs the ice near the lip)
    const wallL = (y) => F3FX0 + 7 * Math.sin(y * 0.031 + 1) + 4 * Math.sin(y * 0.11) + (y < LIP + 40 ? (LIP + 40 - y) * 0.45 : 0);
    const wallR = (y) => F3FX1 + 6 * Math.sin(y * 0.037 + 2) + 4 * Math.sin(y * 0.09 + 1) - (y < LIP + 40 ? (LIP + 40 - y) * 0.4 : 0);
    const lip = (x) => LIP + 3 * Math.sin(x * 0.07) + 2 * Math.sin(x * 0.19);
    const topL = (x) => LIP - 26 + 14 * fbm(x, 0, 30, 3, 351), topR = (x) => LIP - 20 + 14 * fbm(x, 0, 30, 3, 352);
    // the columns: organ pipes of ice, overlapping in depth (the front ones brighter); each swells irregularly down its
    // length, flares at a few steps (with drips hanging off the flare), and some end in icicles part way down
    const COLS = [];
    for (let x = F3FX0 - 14, k = 0; x < F3FX1 + 14; k++) {
      const w = 3 + ih(k, 1, 361) ** 1.4 * 12, end = ih(k, 2, 361) < 0.32 ? LIP + 50 + ih(k, 3, 361) * 150 : 194;
      const steps = []; for (let y = LIP + 30 + ih(k, 6, 361) * 50; y < end - 20; y += 45 + ih(k, fl(y), 362) * 55) steps.push(y);
      COLS.push({ x: x + w * 0.8, w, end, ph: ih(k, 4, 361) * 60, k, steps, dz: ih(k, 10, 361), top: lip(x) + (ih(k, 11, 361) < 0.25 ? ih(k, 12, 361) * 40 : 0),
        crk: [LIP + ih(k, 7, 361) * 250, LIP + ih(k, 8, 361) * 250], cs: (ih(k, 9, 361) - 0.5) * 1.6 });
      x += w * (1.0 + ih(k, 5, 361) * 0.9);
    }
    COLS.sort((a, b) => a.dz - b.dz);                            // back to front
    const colW = (C, y) => {
      let fw = 1;
      for (const sy of C.steps) { const d = y - sy; if (d > -8 && d < 16) fw += 0.5 * Math.exp(-((d - 2) * (d - 2)) / 34); }
      return C.w * fw * (1 + 0.28 * n1(y * 0.028 + C.ph, 363) + 0.12 * n1(y * 0.1 + C.ph, 364)) * (y > C.end - 24 ? Math.max(0, (C.end - y) / 24) ** 0.65 : 1) * (y < C.top + 10 ? 0.6 + 0.4 * Math.max(0, y - C.top) / 10 : 1);
    };
    for (let y = Y0; y < 200; y++) {
      const ly = y + oy;
      for (let x = 0; x < L.w; x++) {
        const wl = wallL(y), wr = wallR(y);
        // ---- the walls
        if (x < wl || x > wr) {
          const left = x < wl, top = left ? topL(x) : topR(x);
          if (y < top) continue;
          const ed = left ? wl - x : x - wr;
          const R = rockAt(x, y, left ? 371 : 372);
          if (y < top + 3 + 2 * vn(x, 0, 5, 373) || R.snow) { lput(L, x, ly, M_SNOW, 0.72 + (y < top + 3 ? 0.15 : -0.1) + (vn(x, y, 3, 374) - 0.5) * 0.2, 60, R.nx * 0.3, -0.8, ih(x, y, 375) < 0.03 ? 1 + fl(ih(x, y, 376) * 250) : 0); continue; }
          lput(L, x, ly, M_ROCK, R.s - (ed < 5 ? 0.12 : 0) - (y > 150 ? (y - 150) * 0.004 : 0), 56 + Math.min(30, ed * 0.15), R.nx, R.ny, 0);
          continue;
        }
        // ---- the falls
        const lp = lip(x);
        if (y < lp - 7) continue;
        if (y < lp) { lput(L, x, ly, M_SNOW, 0.85 - (lp - y) * 0.04 + (vn(x, y, 2, 377) - 0.5) * 0.2, 50, 0, -0.9, 0); continue; }
        let best = null;
        for (let ci = COLS.length - 1; ci >= 0; ci--) {           // the front-most column covering this pixel
          const C = COLS[ci];
          if (y > C.end + 4 || y < C.top) continue;
          if (Math.abs(x - C.x) > C.w * 2.2) continue;
          const w = colW(C, y), q = (x - C.x) / Math.max(0.4, w);
          if (Math.abs(q) < 1) { best = { C, q }; break; }
        }
        if (best) {
          const { C, q } = best, aq = Math.abs(q);
          const str = vn(x * 1.5, y * 0.05, 1.3, 381 + C.k);
          let s = 0.3 + 0.58 * aq * aq * aq + (str - 0.5) * 0.3 + 0.12 * C.dz + 0.08 * n1(y * 0.05 + C.ph, 365), f = 0;
          let rime = y < lp + 4 + 3 * vn(x, 0, 2, 387);
          for (const sy of C.steps) { const d = y - sy; if (d > -3 && d < 0.5 + 2.2 * vn(x, 0, 3, 388) && ih(C.k, fl(sy), 390) < 0.35) rime = true; }
          if (rime) { lput(L, x, ly, M_SNOW, 0.78 - aq * 0.2, 44, q * 0.5, -0.7, 0); continue; }
          if (aq > 0.8) f |= 2;
          for (const cy0 of C.crk) { const d = (y - cy0) - (x - C.x) * C.cs; if (Math.abs(d) < 0.55 && Math.abs(y - cy0) < C.w * 2.5 && ih(C.k, fl(cy0), 389) < 0.7) f |= 1; }
          lput(L, x, ly, M_ICE, s, 40 + aq * 4 - C.dz * 4, q * 0.85, 0.05, f | ((fl(ih(x, y, 383) * 63)) << 2));
        } else {
          const str = vn(x * 2.0, y * 0.045, 1.5, 384);
          lput(L, x, ly, M_ICED, 0.2 + (str - 0.5) * 0.32 + (y > 170 ? (y - 170) * 0.01 : 0), 48, 0, 0, (fl(ih(x, y, 386) * 63)) << 2);
        }
      }
    }
    // drips hanging off each column's flares
    for (const C of COLS) for (const sy of C.steps) {
      const w = colW(C, sy + 2);
      for (let k = 0; k < 4; k++) {
        const x = C.x + (ih(C.k, k + fl(sy), 396) - 0.5) * 2 * w, len = 3 + ih(C.k, k + fl(sy), 397) ** 2 * 12;
        for (let j = 0; j < len; j++) { lput(L, x, sy + 8 + j + oy, M_ICE, j === fl(len) - 1 ? 1.2 : 0.75, 38, -0.3, 0, 2); if (j < len * 0.4) lput(L, x + 1, sy + 8 + j + oy, M_ICE, 0.45, 38, 0.6, 0, 0); }
      }
    }
    // firs standing along both cliff tops
    for (let k = 0; k < 26; k++) {
      const x = k * 29 + ih(k, 1, 321) * 16; if (x > F3FX0 - 18 && x < F3FX1 + 18) continue;
      const top = x < F3FX0 ? topL(x) : topR(x), h = 34 + ih(k, 2, 321) * 52;
      paintPine(L, x, top + oy + 3, h, 9 + h * 0.17, 3210 + k, 70, 1);
    }
    // mounds of frozen spray at the foot, snow on their tops
    for (let k = 0; k < 9; k++) {
      const mx = F3FX0 + 10 + k * (F3FX1 - F3FX0 - 20) / 8 + (ih(k, 1, 391) - 0.5) * 14, mr = 14 + ih(k, 2, 391) * 12, mh = 10 + ih(k, 3, 391) * 12;
      for (let y = fl(F3POOL - mh - 2); y <= F3POOL + 2; y++) for (let x = fl(mx - mr); x <= mx + mr; x++) {
        const u = (x - mx) / mr, top = F3POOL + 1 - mh * Math.sqrt(Math.max(0, 1 - u * u)); if (y < top || Math.abs(u) >= 1) continue;
        const dd = y - top, sn = dd < 2.5 + 1.5 * vn(x, 0, 3, 392);
        lput(L, x, y + oy, sn ? M_SNOW : M_ICE, sn ? 0.85 - u * 0.15 : 0.42 + (1 - dd / mh) * 0.4 - u * 0.2, 38, u * 0.6, -0.6, sn ? 0 : (2 | (fl(ih(x, y, 393) * 63) << 2)));
      }
    }
    // icicles: long ones under the lip and the overhangs, short ones under the snowy facets of the walls
    for (let k = 0; k < 260; k++) {
      const onLip = k < 70, x = onLip ? F3FX0 - 20 + ih(k, 1, 395) * (F3FX1 - F3FX0 + 40) : ih(k, 2, 395) * L.w;
      let y0 = onLip ? lip(x) + 1 : LIP - 10 + ih(k, 3, 395) * 250;
      if (!onLip) { if (x > wallL(y0) - 3 && x < wallR(y0) + 3) continue; const R = rockAt(x, y0 - 2, x < F3FX0 ? 371 : 372); if (!R.snow) continue; y0 += 1; }
      else if (x > wallL(y0) + 4 && x < wallR(y0) - 4 && ih(k, 9, 395) < 0.5) continue;
      const len = (onLip ? 8 : 3) + ih(k, 4, 395) ** 2 * (onLip ? 34 : 14), w = 0.8 + ih(k, 5, 395) * (onLip ? 2.2 : 1.2);
      for (let j = 0; j < len; j++) { const ww = w * (1 - j / len) ** 0.8; for (let dx = -Math.ceil(ww); dx <= Math.ceil(ww); dx++) if (Math.abs(dx) <= ww) lput(L, x + dx, y0 + j + oy, M_ICE, 0.62 + (dx < 0 ? 0.3 : 0) - j / len * 0.2, 40, dx / Math.max(1, ww) * 0.8, 0, 2); }
    }
  }
  // the ice, live: cool and deep in the dark; gold inside and cyan at the rims where the lantern reaches; caustics; cracks
  const R_ICEC = [222, 223, 224, 225, 226, 227, 228, 229];
  const R_ICEW = [225, 226, 227, 228, 229, 188, 187, 200, 22];       // light diffusing through ice: it stays icy until near the flame, then cream-gold
  function iceShade(m, s, l, f, X, Y, lx, ly, nx) {
    const b = bay(X, Y);
    if (m === M_RIVER) return riverShade(s, l, f, X, Y, lx, ly, b);
    const deep = m === M_ICED;
    const g = l * (deep ? 1.3 : 1.8);
    if ((f & 1) && g > 0.16) return g > 0.55 ? 22 : 200;                          // a crack lit from within
    if (f & 1) return deep ? 225 : 227;
    // caustics: thin bright filaments where the refracted light gathers, wavering as the flame and the lantern move
    const ph = lx * 0.23 + ly * 0.05 + (X - LAMP.x) * 0.04 + 1.7 * Math.sin(ly * 0.07 + lx * 0.02 + T_NOW * 0.9) + T_NOW * 0.7;
    const filament = 1 - Math.abs(Math.sin(ph));
    if ((f & 2) && g > 0.15) return g > 0.6 || filament > 0.8 ? 229 : 228;      // a refracting rim: cyan
    const v = (deep ? s * 0.75 : s) + (f & 2 ? 0.2 : 0);
    if (g > 0.08) {
      if (filament > 0.93 && g > 0.22) return g > 0.5 ? 229 : 228;               // a cyan filament in the gold
      const w = g * (0.9 + 0.25 * filament) - 0.08;
      // a smooth handover from the cool ice to the warm glow (a narrow dither seam)
      const k = clamp((w - 0.06) * 3.2, 0, 1);
      if (b < k) return rq(R_ICEW, clamp(w * 0.8 + v * 0.18, 0, 1), b, 0.6);
    }
    return rq(R_ICEC, clamp(v * 0.6 + (deep ? -0.05 : 0.04), 0, 1), b, 0.8);
  }
  // the river's surface: near-black glass, the moving water under it, bubbles, a warm sheen round the lantern
  const RIVM = new Uint8Array(NP);
  function riverShade(s, l, f, X, Y, lx, ly, b) {
    RIVM[Y * W + X] = 1;
    const flow = Math.sin(lx * 0.045 - T_NOW * 1.1 + 2.5 * Math.sin(ly * 0.5 + lx * 0.01) + vn(lx * 0.3, ly * 2, 8, 401) * 4);
    let v = s * 0.8 + (flow > 0.8 ? 0.16 : flow > 0.55 ? 0.07 : 0);
    if (f) { const tw = frac(f * 0.11 + T_NOW * 0.2); if (tw < 0.5) return l > 0.2 ? 188 : 226; }
    if (l > 0.12) { const w = l * 1.5; if (b < w - 0.08) return rq([224, 178, 180, 182, 183, 199], clamp(w * 0.6 + v * 0.2, 0, 1), b, 0.8); }
    return rq([240, 222, 223, 224, 225], clamp(v, 0, 1), b, 0.8);
  }
  // reflections in the river ice: everything above the pool line, mirrored, darkened, rippled; the lantern a streak
  const T_REFL = mkMul(0.55, 0.62, 0.8);
  function reflectRiver(yLine, src, maskFn) {
    for (let Y = Math.max(ROW0, Math.ceil(yLine)); Y <= ROW1; Y++) {
      const Yr = fl(2 * yLine - Y);
      if (Yr < ROW0) continue;
      const fade = clamp(1 - (Y - yLine) / 46, 0, 1);
      if (fade <= 0.05) continue;
      for (let X = 0; X < W; X++) {
        const i = Y * W + X; if (!RIVM[i]) continue;
        const wob = Math.round(1.4 * Math.sin(Y * 0.9 + T_NOW * 2.1) * (0.5 + (Y - yLine) / 40));
        const Xs = clamp(X + wob, 0, W - 1), j = Yr * W + Xs;
        if (maskFn && !maskFn(j)) continue;
        const c = src[j], lm = LUMP2[c];
        if (lm < 40) continue;
        if (bay(X, Y) > fade * (0.35 + lm / 300)) continue;
        BUF[i] = T_REFL[lm > 160 ? 3 : 5][c];
      }
    }
  }
  const LUMP2 = PAL.map((p) => p[0] * 0.3 + p[1] * 0.55 + p[2] * 0.15);
  const BUFR = new Uint8Array(NP), BUFF = new Uint8Array(NP);
  /* ---------------------------------------------------------------- the performance */
  const f3X = (t) => { const d = Math.max(0, t - 10.45); return 96 + 52 * d - 6 * bump(13.1, 13.9, t); };
  const f3Pose = (t) => {
    const ph = (t - 4.7) * 2.6 + 0.37;
    const slip = bump(13.1, 13.8, t), slip2 = bump(13.15, 13.45, t);
    const wagD = (u) => { const tt = t - u * 0.15; return 0.1 * Math.sin(TAU * 1.3 * tt) + 0.06 * Math.sin(TAU * 2.6 * tt + 1) + 0.25 * bump(13.15, 13.9, tt) * Math.sin(TAU * 4 * tt); };
    let eyes = 1; for (const b of [12.2, 14.6]) { const q = (t - b) / 0.14; if (q > 0 && q < 1) eyes = Math.abs(q * 2 - 1); }
    // it looks up at the falls as it goes, and slips once on the ice: legs splay, body dips, ears back, a wobble
    const look = sstep(11.6, 12.4, t) * (1 - sstep(14.8, 15.4, t));
    return { ph, gait: 1 - 0.5 * slip, A: 4.0 + 2.6 * slip2, yaw: 0.45 + 0.15 * look, tilt: 0.05 - 0.22 * look + 0.15 * slip2, mouth: 1, tLift: 0.05 + 0.4 * slip, wagD,
      earN: 0.1 + 0.6 * slip, earF: 0.1 + 0.5 * slip, perk: 0.6 - 0.5 * slip, eyes, wide: slip, lookY: -0.7 * look, lookX: 0.3,
      breath: t * TAU * 1.4, pitch: -0.03 + 0.12 * slip2 * Math.sin((t - 13.15) * 30), sq: 0.25 * slip2, bob: 1.5 * slip2 };
  };
  const F3LIGHT = { sky: [-0.3, -0.95], rim: 0.85, amb: 0.36, z: 4, gain: 1.5 };
  function f3Cam(t) {
    const u = eis((t - 10.45) / 4.4), v = eio((t - 14.4) / 2.55);
    const z = lerp(1.25, 1.0, u), cy = lerp(lerp(184, 118, u), -372, v), cx = lerp(186, 238, eis((t - 10.45) / 5.2)) + drift(t, 5, 1);
    return [cx, cy, z];
  }
  function f3Draw(t) {
    TAB = F3.rig; FOGT = F3FOG; SPK_SNOW = M_SNOW; SHAD.length = 0; LAMP.on = 0;
    const [cx, cy, z] = f3Cam(t), L = F3.L, oy = (p) => OY3 + 135 + (cy - 135) * p;
    const p = f3Pose(t), fwx = f3X(t), fxs = toSX(cx, z, fwx), fys = toSY(cy, z, F3G), S = F3S * z;
    const th = pendulum(t, (tt) => { foxPrep(f3Pose(tt), f3X(tt), F3G, F3S, 1, F3LIGHT); return [FOXOUT.mouth[0] / F3LS, FOXOUT.mouth[1] / F3LS]; }, 10.45);
    foxPrep(p, fxs, fys, S, 1, F3LIGHT);
    const [mx, my] = FOXOUT.mouth, LS = F3LS * z, fl0 = lanternFlame(mx, my, LS, th);
    LAMP.on = 1; LAMP.x = fl0[0]; LAMP.y = fl0[1]; LAMP.z = 0; LAMP.h = Math.max(4, (fys - fl0[1]) / z); LAMP.I = 1.15 * flick(t); LAMP.R = 62 * z; LAMP.zoom = z; LAMP.rot = th * 2;
    SHAD.push({ x: fxs - 20 * z, y: fys + 1.5 * z, rx: 32 * z, ry: 4.5 * z, a: 0.6, lamp: 1 });
    // the sky is the meadow's (heavens): placed so that at the hand-over (16.95 s, both cameras at rest) it is exactly where
    // the meadow's camera has it, and moving with this camera until then
    { const [hx, hy] = f4SkyAt(16.95), [cx0, cy0] = f3Cam(16.95), sx = hx + (cx - cx0) * 0.1, sy = hy + (cy - cy0) * 0.82;
      heavens(t, sx, sy, z, 0.25 + 0.75 * sstep(15.3, 16.8, t)); }
    comp(L.far, 220 + cx * 0.35, oy(0.88), z, 0.3, { mist: 0.2, mistY: OY3 - 110, mistH: 40 });
    RIVM.fill(0);
    comp(L.gorge, 120 + cx * 0.85, oy(0.95), z, 0.08, { custom: iceShade, cm0: M_ICE, cm1: M_ICED });
    comp(L.main, cx + 120, oy(1), z, 0, { custom: iceShade, cm0: M_RIVER, cm1: M_RIVER });
    // the falls in the river ice
    BUFR.set(BUF);
    reflectRiver(toSY(oy(0.95) - OY3, z, F3POOL), BUFR, null);
    // the kit and the lantern, then their reflections below the kit's feet
    BUFF.set(BUF);
    drawFox(p, fxs, fys, S, 1, F3LIGHT);
    drawLantern(mx, my, LS, th, { lit: 1 });
    reflectRiver(fys + 0.5 * z, BUF.slice(0), (j) => BUF[j] !== BUFF[j]);
    lanternGlow(LAMP.x, LAMP.y, z, 1);
    comp(L.fore, 120 + cx * 1.3, oy(1.08), z, 0);
    snowfall(t, cx, cy, z, { dens: 0.7 });
  }
  const F3AUR = [{ y: OY3 - 165, amp: 16, len: 95, k: 0.013, ph: 0.4, x0: 100, x1: 680, b: 1 }, { y: OY3 - 230, amp: 12, len: 80, k: 0.018, ph: 2.2, x0: 20, x1: 520, b: 0.8 }];
  const f23Trunk = (t) => { if (t > 10.6 && t < 11.45) wipeTrunk(lerp(580, -160, eio((t - 10.6) / 0.8)), 98, t, 0.8); };
  let F3FOG = null;
  BUILDERS.push(() => { F3FOG = mkTab('3a5a8a', false); });
  shot(10.8, 16.7, (lt, t) => {
    if (t < 11.2) {
      // the trunk sweeps past; behind it the woods dissolve into the gorge
      dissolve(() => f2Draw(t), () => f3Draw(t), eis((t - 10.8) / 0.4), 33);
      f23Trunk(t);
    } else f3Draw(t);
  });

  /* ================================================================ 4 · The aurora meadow (16.7 … 17.2 – 23.0)
     Out of the trees: a wide snowfield under a high moon and green aurora curtains, a herd of deer in the snow, birches at
     the wood's edge, and far off on the coast, under a dark bank of storm cloud over the sea, a lighthouse with no light.
     Camera: in the sky with the aurora (the falls' sky dissolving into this one), tilting down onto the meadow; tracking
     the kit as it trots among the deer, whose heads come up one after another as the light passes; the kit stops and
     looks at the lighthouse; the camera pushes in on it. */
  const F4 = { L: {}, rig: null };
  const OY4 = 300, F4S = 0.98, F4G = 206, F4LS = 1.02 * F4S;
  const LH4 = { x: 470, y: OY4 + 128 };                         // the far lighthouse's foot, in the far layer's coordinates
  const F4P = 0.4, F4PY = 0.92;                                  // the far layer's parallax                                  // the far lighthouse (its foot, world)
  const DEER = [
    { x: 92, y: 198, S: 0.82, f: 1, ph: 0.2, up0: 0 },
    { x: 128, y: 200, S: 0.8, f: 1, ph: 1.3, fawn: 1, up0: 0.1 },
    { x: 178, y: 193, S: 0.74, f: -1, ph: 2.1, antlers: 1, up0: 0 },
    { x: 232, y: 196, S: 0.76, f: -1, ph: 0.7, up0: 0.2 },
    { x: 276, y: 190, S: 0.66, f: 1, ph: 2.8, up0: 0 },
    { x: 318, y: 188, S: 0.6, f: -1, ph: 1.9, up0: 0.5 },
  ];
  BUILDERS.push(() => {
    F4.rig = mkRig([0.04, 0.06, 0.12], [0.58, 0.68, 0.96], [1.0, 0.56, 0.24]);
    const L = F4.L, H4 = 600;
    L.sky = mkLayer(800, H4);
    paintStars(L.sky, 300, OY4 + 120, 402, [206, 207, 194]);
    // the far coast: the sea from the wood's end to the right edge, a rocky headland with the lighthouse on it
    L.far = mkLayer(900, H4, { z0: 220 });
    const headTop = (x) => { const u = (x - 470) / 62; return u > -1 && u < 1 ? OY4 + 151 - 22 * Math.pow(1 - u * u, 0.6) - 3 * fbm(x, 0, 8, 2, 412) : 1e9; };
    for (let x = 0; x < 900; x++) {
      for (let y = OY4 + 110; y < OY4 + 182; y++) {
        const ht = headTop(x);
        if (y >= ht) {                                          // the headland: dark rock, snow on its crown and ledges
          const dd = y - ht, sn = dd < 1.5 + 2 * vn(x, 0, 4, 414) || (vn(x * 0.8, y * 1.6, 3, 415) > 0.78 && dd < 10);
          lput(L.far, x, y, sn ? M_SNOW : M_ROCK, sn ? 0.46 + (x < 470 ? 0.1 : -0.06) : 0.12 + (x < 470 ? 0.05 : 0) + (vn(x, y, 3, 418) - 0.5) * 0.08, 220, 0, -0.5, 0);
          continue;
        }
        if (y >= OY4 + 150) {                                   // the sea: near-black, a path of moon glitter
          const dy = y - OY4 - 150, gl = Math.abs(x - 300 - dy * 1.5) < 14 + dy * 2 && ih(fl(x / 2), y, 416) < 0.22 - dy * 0.008;
          lputC(L.far, x, y, gl ? (ih(x, y, 417) < 0.4 ? 207 : 206) : dy < 1 ? 205 : dy < 6 ? 203 : 202);
        }
      }
    }
    // the wood's edge behind the meadow
    L.mid = mkLayer(900, H4, { z0: 150 });
    for (let k = 0; k < 40; k++) { const x = k * 12 + ih(k, 1, 421) * 10; if (x > 300) break; const h = (28 + ih(k, 2, 421) * 40) * (1 - 0.65 * sstep(150, 300, x)); paintPine(L.mid, x, OY4 + 170 + ih(k, 3, 421) * 4, h, 7 + h * 0.16, 4210 + k, 100, 1); }
    for (let x = 0; x < 900; x++) { const ys = OY4 + 166 + 2 * Math.sin(x * 0.03) + (x > 330 ? (x - 330) * 0.02 : 0); for (let y = fl(ys); y < OY4 + 182; y++) lput(L.mid, x, y, M_SNOW, 0.55 + (y - ys < 1 ? 0.15 : 0), 100, 0, -1, 0); }
    // the meadow
    L.main = mkLayer(1000, H4, { z0: -128, recv: true });
    const surf = (x) => OY4 + 176 + 3 * Math.sin(x * 0.011 + 0.4) + 2 * Math.sin(x * 0.037 + 2);
    const depM = (y) => 128 + (F4G - (y - OY4)) * 3;
    paintGround(L.main, surf, depM, 431, { spark: 0.05, shadows: [{ x: 60, y: OY4 + 180, dx: 1.2, w: 14, a: 0.25 }, { x: 980, y: OY4 + 178, dx: 1.2, w: 12, a: 0.2 }] });
    // birches at the wood's edge: white trunks with dark marks, fine bare twigs dusted with snow
    for (const [bx, h, w] of [[34, 150, 4.5], [58, 120, 3.4], [96, 96, 2.8]]) paintBirch(L.main, bx, surf(bx) + 6, h, w, depM(surf(bx) + 6), 440 + bx);
    for (let k = 0; k < 60; k++) {
      const x = ih(k, 1, 451) * 1000, ys = surf(x) + 8 + ih(k, 2, 451) * 80, hgt = 4 + ih(k, 3, 451) * 10, ln = (ih(k, 4, 451) - 0.5) * 6;
      for (let b2 = 0; b2 < 3; b2++) { const bx = x + (b2 - 1) * 2, bh = hgt * (0.6 + 0.4 * ih(k, 5 + b2, 451)); for (let j = 0; j < bh; j++) lput(L.main, bx + ln * (j / bh) ** 2, ys - j, M_GRASS, 0.42 + 0.25 * j / bh, depM(ys), -0.5, 0, 0); }
    }
    L.fore = mkLayer(1300, H4, { z0: -128 });
    for (let x = 0; x < 1300; x++) {
      const top = OY4 + 240 + 4 * Math.sin(x * 0.017 + 0.8) + 3 * Math.sin(x * 0.06);
      for (let y = fl(top); y < H4; y++) lput(L.fore, x, y, M_SNOW, 0.42 + 0.22 * clamp(1 - (y - top) / 4, 0, 1) + (vn(x, y, 6, 461) - 0.5) * 0.14, 0, 0, -1, ih(x, y, 462) < 0.03 ? 1 + fl(ih(x, y, 463) * 250) : 0);
    }
  });
  function paintBirch(L, x, yb, h, w, z, seed) {
    for (let y = fl(yb - h); y < yb; y++) {
      const ww = w * (0.65 + 0.35 * (y - yb + h) / h), lean = 2 * Math.sin((yb - y) * 0.01 + seed);
      for (let dx = -Math.ceil(ww); dx <= Math.ceil(ww); dx++) {
        const q = dx / ww; if (Math.abs(q) > 1) continue;
        const mark = vn((x + dx) * 0.3, y * 0.35, 1.6, seed) > 0.72 && ih(fl(y / 2), 0, seed) < 0.6;
        lput(L, x + dx + lean, y, mark ? M_BARK : M_BIRCH, mark ? 0.15 : 0.45 + (1 - q * q) * 0.35 - q * 0.25, z, q * 0.9, 0, 0);
      }
    }
    // bare twigs: thin, splitting upward and out, each with a line of snow along its top
    for (let k = 0; k < 9; k++) {
      let px = x + 2 * Math.sin(seed), py = yb - h * (0.45 + 0.55 * ih(k, 1, seed)), a = -PI / 2 + (ih(k, 2, seed) - 0.5) * 2.2;
      for (let s = 0; s < 18 + ih(k, 3, seed) * 20; s++) {
        px += Math.cos(a); py += Math.sin(a); a += (ih(k, s, seed + 1) - 0.5) * 0.4 + (a < -PI / 2 ? 0.02 : -0.02);
        lput(L, px, py, M_BARK, 0.2, z, 0, 0, 0); if (s % 3 === 0) lput(L, px, py - 1, M_SNOW, 0.8, z, 0, -0.8, 0);
      }
    }
  }
  const f4X = (t) => 18 + 52 * Math.max(0, t - 17) - 52 * 0.6 * eis((t - 21.25) / 0.6) * 0 - (t > 21.3 ? 52 * (t - 21.3) - 52 * 0.35 * eoc(Math.min(1, (t - 21.3) / 0.35)) : 0);
  const f4Pose = (t) => {
    const stop = sstep(21.25, 21.6, t), ph = (t - 4.7) * 2.6 + 0.81;
    const wagD = (u) => { const tt = t - u * 0.15; return 0.1 * Math.sin(TAU * 1.3 * tt) + 0.06 * Math.sin(TAU * 2.6 * tt + 1); };
    let eyes = 1; for (const b of [18.9, 20.6, 22.4]) { const q = (t - b) / 0.14; if (q > 0 && q < 1) eyes = Math.abs(q * 2 - 1); }
    // it looks at each deer as it passes (a little up), then stops and looks out toward the sea and the lighthouse
    const look = bump(18.4, 19.4, t) * 0.6 + bump(19.6, 20.5, t) * 0.8 + bump(20.6, 21.2, t) * 0.5;
    return { ph, gait: 1 - stop, A: 4.0 * (1 - stop), yaw: 0.45 + 0.25 * look * 0 + 0.2 * stop, tilt: 0.05 - 0.18 * look - 0.14 * stop, mouth: 1, tLift: 0.05 + 0.1 * stop, wagD,
      earN: 0.1 - 0.15 * stop + 0.3 * bump(19.9, 20.1, t), earF: 0.1 - 0.15 * stop, perk: 0.6 + 0.4 * stop, eyes, lookY: -0.5 * look - 0.3 * stop, lookX: 0.4 + 0.5 * stop,
      breath: t * TAU * 1.4, pitch: -0.03, hy: -1.5 * stop };
  };
  const F4LIGHT = { sky: [-0.55, -0.85], rim: 0.9, amb: 0.4, z: 4, gain: 1.5 };
  function f4Cam(t) {
    const v = eio((t - 17.0) / 1.8), push = eio((t - 21.65) / 1.45);
    let cx = lerp(170, 236, eis((t - 16.7) / 4.8)) + drift(t, 7, 1), cy = lerp(-120, 132, v), z = 1;
    if (push > 0) {
      // the push in on the far lighthouse: it slides to a place right of centre and everything grows round it
      const oxF = 300 + cx * F4P, oyF = OY4 + 135 + (cy - 135) * F4PY;
      const sx0 = (LH4.x - oxF) + 240, sy0 = (LH4.y - 12 - oyF) + 135;
      z = lerp(1, 2.1, push);
      const sx = lerp(sx0, 300, push), sy = lerp(sy0, 128, push);
      cx = (LH4.x - (sx - 240) / z - 300) / F4P;
      cy = (LH4.y - 12 - (sy - 135) / z - OY4 - 135) / F4PY + 135;
    }
    return [cx, cy, z];
  }
  // the far lighthouse, drawn live (it stays crisp as the camera pushes in): a tapering white tower with two red bands,
  // a railed gallery, a dark lantern room (one cold glint on its glass), a domed cap; the keeper's cottage at its foot
  function farLighthouse(oxF, oyF, z, t) {
    const bx = toSX(oxF, z, LH4.x), by = toSY(oyF, z, LH4.y), S = z * 0.85;
    const h = 24 * S, w0 = 3.6 * S, w1 = 2.6 * S;
    for (let Y = fl(by - h - 9 * S); Y <= Math.ceil(by); Y++) {
      if (Y < ROW0 || Y > ROW1) continue;
      const u = (by - (Y + 0.5)) / h;
      for (let X = fl(bx - w0 - 3 * S); X <= Math.ceil(bx + w0 + 3 * S); X++) {
        if (X < 0 || X >= W) continue;
        const dx = X + 0.5 - bx;
        let c = -1;
        if (u >= 0 && u <= 1) {
          const w = lerp(w0, w1, u);
          if (Math.abs(dx) < w) {
            const q = dx / w, band = (u > 0.28 && u < 0.4) || (u > 0.6 && u < 0.72);
            const lv = 0.55 - q * 0.45;                          // lit from the moon's side
            c = band ? (lv > 0.6 ? 157 : lv > 0.3 ? 156 : 155) : (lv > 0.7 ? 194 : lv > 0.45 ? 247 : lv > 0.2 ? 246 : 245);
            if (Math.abs(u - 0.5) < 0.04 && Math.abs(q) < 0.25 && S > 1.2) c = 241;   // a small window
          }
        } else if (u > 1) {
          const v = (Y + 0.5 - (by - h)) / S;                     // above the tower: gallery, lantern room, cap
          if (v > -1.2 && v <= 0 && Math.abs(dx) < w1 + 1.4 * S) c = v > -0.5 ? 242 : 244;
          else if (v > -1.9 && v <= -1.2 && Math.abs(dx) < w1 + 1.3 * S && (fl(dx / Math.max(1, 0.7 * S)) & 1)) c = 243;     // railing
          else if (v > -5.2 && v <= -1.2 && Math.abs(dx) < w1 * 0.9) {
            const pane = Math.abs(dx) < 0.45 * S || Math.abs(Math.abs(dx) - w1 * 0.55) < 0.35 * S;
            c = pane ? 243 : (dx < -w1 * 0.3 && v < -3.5 ? 205 : 241);                      // dark glass, mullions, a cold glint
          }
          else if (v > -7.4 && v <= -5.2) { const ww = w1 * (1 - ((-5.2 - v) / 2.2) ** 2); if (Math.abs(dx) < ww) c = dx < 0 ? 243 : 241; }
          else if (v > -8.6 && v <= -7.4 && Math.abs(dx) < 0.5 * S) c = 243;
        }
        if (c >= 0) BUF[Y * W + X] = c;
      }
    }
    // the keeper's cottage beside it: a dark gable, a lit window (someone is still there)
    const hx = bx + 8 * S, hy = by;
    for (let Y = fl(hy - 6 * S); Y <= hy; Y++) for (let X = fl(hx - 4 * S); X <= Math.ceil(hx + 4 * S); X++) {
      if (Y < ROW0 || Y > ROW1 || X < 0 || X >= W) continue;
      const dx = X + 0.5 - hx, v = (hy - Y) / S;
      if (v < 3.2 ? Math.abs(dx) < 3.6 * S : Math.abs(dx) < (6.2 - v) * 1.4 * S) BUF[Y * W + X] = v > 3.2 ? (v > 3.6 ? 244 : 194) : 242;
    }
    if (S > 0.9) { rectF(hx - 1.6 * S, hy - 2.4 * S, Math.max(1, 1.2 * S), Math.max(1, 1.2 * S), 15); }
  }
  // a bank of storm cloud low over the sea: heaped puffs, moon-silvered tops, dark undersides
  const STORM4 = [];
  for (let k = 0; k < 30; k++) { const x = 360 + k * 17 + ih(k, 1, 471) * 10, e = sstep(350, 520, x); STORM4.push({ x, y: OY4 + 149 - (6 + ih(k, 2, 471) * 12) * e - 6 * e, r: (8 + ih(k, 3, 471) * 11) * (0.45 + 0.55 * e) }); }
  function stormBank(oxF, oyF, z, t) {
    for (const c of STORM4) {
      const cxw = c.x + t * 1.2, X0 = Math.max(0, fl(toSX(oxF, z, cxw - c.r * 1.3 - 2))), X1 = Math.min(W - 1, Math.ceil(toSX(oxF, z, cxw + c.r * 1.3 + 2)));
      const Y0 = Math.max(ROW0, fl(toSY(oyF, z, c.y - c.r - 2))), Y1 = Math.min(ROW1, Math.ceil(toSY(oyF, z, OY4 + 149)));
      for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) {
        const wx = toLX(oxF, z, X), wy = toLY(oyF, z, Y);
        if (wy > OY4 + 149.5) continue;
        const dx = (wx - cxw) / (c.r * 1.3), dy = (wy - c.y) / c.r, n = vn(wx * 1.3, wy * 1.3, 3.5, 472);
        const d = dx * dx + (dy > 0 ? dy * dy * 0.25 : dy * dy) - (n - 0.5) * 0.35;
        if (d > 1) continue;
        const lit = -dy * 0.9 - dx * 0.3;                         // the moon is high, to the left
        BUF[Y * W + X] = d > 0.78 && lit > 0.35 ? (bay(X, Y) < 0.6 ? 207 : 206) : lit > 0.5 ? 244 : lit > 0.05 ? 243 : dy > 0.4 ? 241 : 242;
      }
    }
  }
  // the moon: a soft full disc with faint maria and a halo, over everything in the sky
  function moon4(ox, oy, z) {
    const mx = toSX(ox, z, 268), my = toSY(oy, z, OY4 + 52), r = 11 * z;
    for (let Y = fl(my - 3 * r); Y <= my + 3 * r; Y++) for (let X = fl(mx - 3 * r); X <= mx + 3 * r; X++) {
      if (Y < ROW0 || Y > ROW1 || X < 0 || X >= W) continue;
      const d = Math.hypot(X + 0.5 - mx, Y + 0.5 - my), i = Y * W + X;
      if (d < r) { const ma = vn((X - mx) / z * 1.3 + 50, (Y - my) / z * 1.3 + 50, 5, 403); BUF[i] = d > r - 1.2 ? 194 : ma > 0.64 ? 193 : ma > 0.56 && bay(X, Y) < 0.5 ? 194 : 22; }
      else if (d < 3 * r && bay(X, Y) < 0.5 * Math.pow(1 - (d - r) / (2 * r), 2)) { const c = BUF[i]; if (c >= 202 && c <= 206 || c === 230) BUF[i] = d < r * 1.5 ? 207 : 206; }
    }
  }
  function f4Deer(o, k, t, cx, cy, z, foxX) {
    const X = toSX(cx, z, o.x), Y = toSY(cy, z, o.y);
    if (X < -60 || X > W + 60) return;
    // heads come up as the light comes near (a beat each), and stay up watching it go; ears flick; the fawn steps
    const near = sstep(95, 30, Math.abs(foxX - o.x) - 0) , passed = foxX > o.x + 20 ? 1 : 0;
    const up = clamp(Math.max(o.up0 + 0.08 * Math.sin(t * 1.3 + o.ph), sstep(0, 0.6, near) + passed * 0.8), 0, 1);
    const turn = sstep(0.2, 1, near) * 0.6;
    const earF = 0.4 * bump(o.ph % 1.7 + 18.2, o.ph % 1.7 + 18.4, t) + 0.5 * bump(19 + o.ph, 19.2 + o.ph, t) + 0.35 * near * Math.sin(t * 9);
    const fawnStep = o.fawn ? sstep(19.0, 19.3, t) * (1 - sstep(20.1, 20.4, t)) : 0;
    const x = o.fawn ? o.x - 18 * eis((t - 19.0) / 1.4) : o.x;
    const Xs = toSX(cx, z, x);
    // its shadow on the snow, long, away from the moon
    for (let j = 0; j < 4; j++) glow(Xs + 14 * z * o.S + j * 3, Y + 1, (12 + j * 3) * z * o.S, T_SHADE, 0.32, 1, 0.22);
    drawDeer(Xs, Y, o.S * z, o.f, { up, turn, earF, tail: 0.5 * bump(19.5 + o.ph * 0.3, 19.8 + o.ph * 0.3, t), antlers: o.antlers, fawn: o.fawn, gait: fawnStep, step: t * 1.8 }, { sky: [-0.55, -0.85], amb: 0.42, z: (F4G - o.y) * 3 });
  }
  /* the one sky the falls tilt up into and the meadow tilts down from (in the meadow's sky coordinates): its gradient,
     stars, aurora and moon, so that the hand-over between the two shots, in the sky, is the same picture */
  function heavens(t, ox, oy, z, amt) {
    skyLive([202, 202, 203, 203, 204, 204, 205, 206, 207], 30, OY4 + 150, ox, oy, z, 401);
    comp(F4.L.sky, ox, oy, z, 0);
    aurora2(t, ox, oy, z, amt, F4AUR);
    liveStars(t, 30, 491, ox, oy, z, OY4 + 100, (c) => c >= 202 && c <= 205);
    moon4(ox, oy, z);
  }
  // where f4's sky sits at time t (the falls' sky is drawn at the same place while the two hand over)
  const f4SkyAt = (t) => { const [cx, cy, z] = f4Cam(t); return [300 + cx * 0.1, OY4 + 135 + (cy - 135) * 0.86, z]; };
  function f4Draw(t) {
    TAB = F4.rig; FOGT = F4FOG; SPK_SNOW = M_SNOW; SHAD.length = 0; LAMP.on = 0;
    const [cx, cy, z] = f4Cam(t), L = F4.L, oy = (p) => OY4 + 135 + (cy - 135) * p;
    const p = f4Pose(t), fwx = f4X(t), fxs = toSX(cx, z, fwx), fys = toSY(cy, z, F4G), S = F4S * z;
    const th = pendulum(t, (tt) => { foxPrep(f4Pose(tt), f4X(tt), F4G, F4S, 1, F4LIGHT); return [FOXOUT.mouth[0] / F4LS, FOXOUT.mouth[1] / F4LS]; }, 16.7);
    foxPrep(p, fxs, fys, S, 1, F4LIGHT);
    const [mx, my] = FOXOUT.mouth, LS = F4LS * z, fl0 = lanternFlame(mx, my, LS, th);
    LAMP.on = 1; LAMP.x = fl0[0]; LAMP.y = fl0[1]; LAMP.z = 0; LAMP.h = Math.max(4, (fys - fl0[1]) / z); LAMP.I = 1.15 * flick(t); LAMP.R = 54 * z; LAMP.zoom = z; LAMP.rot = th * 2;
    SHAD.push({ x: fxs + 14 * z, y: fys + 1, rx: 26 * z, ry: 3.5 * z, a: 0.55, lamp: 1 });
    heavens(t, 300 + cx * 0.1, oy(0.86), z, 1);
    const oxF = 300 + cx * F4P, oyF = oy(F4PY);
    stormBank(oxF, oyF, z, t);
    comp(L.far, oxF, oyF, z, 0.3);
    farLighthouse(oxF, oyF, z, t);
    comp(L.mid, 160 + cx * 0.7, oy(0.96), z, 0.3, { mist: 0.2, mistY: OY4 + 160, mistH: 20 });
    comp(L.main, cx + 150, oy(1), z, 0);
    // the herd, back to front, and the kit among them
    const order = DEER.map((o, k) => [o.y, k]).sort((a, b) => a[0] - b[0]);
    let foxDone = false;
    for (const [dy, k] of order) {
      if (!foxDone && dy > F4G) { drawFox(p, fxs, fys, S, 1, F4LIGHT); drawLantern(mx, my, LS, th, { lit: 1 }); foxDone = true; }
      f4Deer(DEER[k], k, t, cx, cy, z, fwx);
    }
    if (!foxDone) { drawFox(p, fxs, fys, S, 1, F4LIGHT); drawLantern(mx, my, LS, th, { lit: 1 }); }
    lanternGlow(LAMP.x, LAMP.y, z, 1);
    comp(L.fore, 120 + cx * 1.25, oy(1.05), z, 0);
    snowfall(t, cx, cy, z, { dens: 0.45 });
  }
  const F4AUR = [{ y: OY4 + 72, amp: 18, len: 120, k: 0.011, ph: 1.1, x0: 20, x1: 640, b: 1 }, { y: OY4 - 40, amp: 24, len: 110, k: 0.008, ph: 3.0, x0: 230, x1: 780, b: 0.55 }, { y: OY4 - 175, amp: 14, len: 90, k: 0.015, ph: 0.2, x0: -40, x1: 380, b: 0.4 }];
  let F4FOG = null;
  BUILDERS.push(() => { F4FOG = mkTab('425a90', false); });
  shot(16.7, 22.75, (lt, t) => {
    if (t < 17.12) dissolve(() => f3Draw(t), () => f4Draw(t), eis((t - 16.92) / 0.2), 35);
    else f4Draw(t);
  });

  /* ================================================================ 5a · The dark lighthouse (22.35 … 22.6 – 25.6)
     The headland in a snowstorm: the lighthouse standing dark over a black sea, the keeper's cottage with one lit window,
     the waves running in with their whitecaps and bursting on the rocks below, and out on the water a small ship pitching,
     its lights the only ones out there, lost. The kit comes running up the path with its lantern and slips in at the
     door. Camera: the meadow's push in dissolves into this; it eases back to show the sea and the ship, then pushes in on
     the door as the kit reaches it. The same place, later, is where the beam blazes out (6). */
  const F5 = { L: {}, rig: null };
  const T5X = 166, T5Y = 195, T5S = 1.12;                         // the tower's foot (world) and size
  const F5G = 198, F5S = 0.86, F5LS = 1.02 * F5S, HORIZ = 112;
  BUILDERS.push(() => {
    F5.rig = mkRig([0.04, 0.045, 0.06], [0.42, 0.48, 0.6], [1.0, 0.56, 0.24]);
    const L = F5.L;
    // the headland: snow on the plateau, the trodden path, fence posts along the edge, the cliff falling to the sea
    L.main = mkLayer(800, 300, { z0: -128, recv: true });
    const surf = (x) => 196 - 4 * sstep(0, 200, x) + 2 * Math.sin(x * 0.03) + 1.5 * Math.sin(x * 0.11) + (x > 300 ? (x - 300) * 0.08 : 0);
    const edgeX = (y) => 336 + Math.max(0, y - 194) * 0.75 + 5 * Math.sin(y * 0.11) + 3 * Math.sin(y * 0.37);
    const depM = (y) => 128 + (F5G - y) * 3;
    for (let x = 0; x < 800; x++) {
      const wx = x - 100, ys = surf(wx);
      for (let y = fl(ys); y < 300; y++) {
        const ex = edgeX(y);
        if (wx > ex) continue;
        const dd = y - ys, edge = ex - wx, onPath = Math.abs(y - (200 + (wx - 60) * 0.02)) < 3 + 2 * vn(wx, 0, 6, 501) && wx < 170;
        // where the plateau breaks into the cliff face, falling away to the sea: rock with snow on its ledges
        if (edge < 10 + 14 * vn(0, y, 12, 502) * sstep(194, 215, y) && dd > 1) { const R = rockAt(wx * 1.2, y * 1.2, 503); lput(L.main, x, y, R.snow ? M_SNOW : M_ROCK, R.snow ? 0.5 : R.s * 0.75 + (edge < 2 ? 0.08 : 0), depM(Math.min(y, 210)), R.nx, R.ny, 0); continue; }
        let s = 0.46 + 0.16 * clamp(1 - dd / 20, 0, 1) + (vn(wx * 0.5 + y, y * 2.2, 8, 504) - 0.5) * 0.18 + (dd < 1 ? 0.16 : 0);
        if (onPath) s -= 0.14 + (ih(fl(wx / 3), fl(y / 2), 505) < 0.3 ? 0.08 : 0);
        lput(L.main, x, y, M_SNOW, s, depM(y), 0, -1, ih(x, y, 506) < 0.04 ? 1 + fl(ih(x, y, 507) * 250) : 0);
      }
    }
    for (let k = 0; k < 9; k++) {                                  // fence posts along the cliff edge, a sagging rope
      const wx = 214 + k * 15, x = wx + 100, yb = surf(wx) + 4 + k * 0.6, h = 11 - k * 0.3;
      for (let j = 0; j < h; j++) { lput(L.main, x, yb - j, M_WOOD, 0.22, depM(yb), -0.3, 0, 0); lput(L.main, x + 1, yb - j, M_WOOD, 0.12, depM(yb), 0.5, 0, 0); }
      lput(L.main, x, yb - h, M_SNOW, 0.8, depM(yb), 0, -1, 0); lput(L.main, x + 1, yb - h, M_SNOW, 0.7, depM(yb), 0, -1, 0);
      if (k < 8) for (let q = 1; q < 15; q++) lput(L.main, x + q, yb - h + 3 + Math.sin(q / 15 * PI) * 2.2 + 0.6 * q / 15, M_WOOD, 0.18, depM(yb), 0, 0, 0);
    }
    L.fore = mkLayer(1100, 300, { z0: -128 });
    for (let x = 0; x < 1100; x++) {
      const top = 236 + 6 * Math.sin(x * 0.017 + 0.4) + 3 * Math.sin(x * 0.07) - 14 * Math.max(0, Math.sin(x * 0.009 + 2.6)) ** 6;
      for (let y = fl(top); y < 300; y++) lput(L.fore, x, y, M_SNOW, 0.3 + 0.18 * clamp(1 - (y - top) / 4, 0, 1) + (vn(x, y, 6, 511) - 0.5) * 0.12, 0, 0, -1, 0);
    }
  });
  // the storm sky: torn cloud racing past, heavier low over the sea (live, for its movement)
  function stormSky(cx, cy, z, t, beam) {
    for (let Y = ROW0; Y <= ROW1; Y++) {
      const wy = toLY(135 + (cy - 135) * 0.85, z, Y);
      if (wy > HORIZ + 1) break;
      const o = Y * W, g = clamp((wy + 60) / (HORIZ + 60), 0, 1);
      for (let X = 0; X < W; X++) {
        const wx = toLX(240 + cx * 0.3, z, X);
        const n = vn(wx * 0.6 + t * 22, wy * 1.4 - t * 2, 34, 521) * 0.65 + vn(wx * 1.3 + t * 40, wy * 2.2, 12, 522) * 0.35;
        const v = n * 0.9 + g * 0.35 - 0.12 + (BAYF[((Y & 7) << 3) | (X & 7)] - 0.5) * 0.14;
        BUF[o + X] = v > 0.78 ? 245 : v > 0.64 ? 244 : v > 0.5 ? 243 : v > 0.36 ? 242 : 241;
      }
    }
  }
  // the sea: dark swells rolling in, whitecaps, spray at the rocks; the ship's lights (and later the beam) on the water
  const SEA_R = [240, 241, 242, 243, 244, 245];
  function stormSea(cx, cy, z, t, cliffX, glints) {
    for (let Y = ROW0; Y <= ROW1; Y++) {
      const wy = toLY(135 + (cy - 135) * 0.95, z, Y);
      if (wy < HORIZ) continue;
      const p = (wy - HORIZ) / 120, o = Y * W, dist = 1 / (p + 0.05);
      for (let X = 0; X < W; X++) {
        const wx = toLX(240 + cx * 0.95, z, X), d = BAYF[((Y & 7) << 3) | (X & 7)];
        // long swells rolling in, foreshortened toward the horizon: each a steep face catching the sky's grey light and a
        // long darkening back; a choppy texture over them; whitecaps tearing along the crests and foam lacing the backs
        const warp = n1(wx * 0.006 + 3, 531) * 2.2 * (1 - 0.75 * Math.min(1, p)) + n1(wx * 0.012 + 7, 534) * 0.35;
        const sw = dist * 1.25 - t * 0.6 + warp, f = frac(sw), fi = fl(sw);
        const chop = vn(wx * (0.35 + p * 0.5) + t * 3, wy * (2.2 + p * 2) - t * 4, 2 + p * 3, 535) - 0.5;
        let v = f < 0.28 ? 0.62 - f * 1.4 : 0.2 + (f - 0.28) * 0.18;
        v += chop * (0.08 + p * 0.1) + (1 - sstep(0, 0.12, p)) * 0.28;
        const fn = vn(wx * (0.22 + p * 0.5), sw * 5, 1.5 + p * 3, 532);
        let c = SEA_R[clamp(fl(v * 6.5 + (d - 0.5) * 0.55 - 0.5), 0, 5)];
        if (f < 0.08 + 0.05 * p && fn > 0.48 - p * 0.15) c = fn > 0.72 ? 194 : fn > 0.6 ? 246 : 245;          // whitecaps
        else if (f > 0.3 && f < 0.7 && p > 0.22) { const lace = vn(wx * (0.18 + p * 0.3), sw * 9 + fi * 3.1, 1.6, 536); if (lace > 0.86 - (0.7 - f) * 0.08) c = lace > 0.93 ? 245 : 244; }   // foam lacing the back
        BUF[o + X] = c;
      }
    }
    for (const g of glints) {                                      // light lying on the water below a lamp
      for (let k = 0; k < g.n; k++) { const yy = g.y + 3 + k * 2.2 * z, xx = g.x + Math.sin(t * 3 + k * 1.7) * (1 + k * 0.5) * z; if (bay(fl(xx), fl(yy)) < (1 - k / g.n) * g.a) { P(xx, yy, g.c); P(xx + 1, yy, g.c2); } }
    }
  }
  // spray bursting up the cliff foot when a swell hits (a few times a second, somewhere along the rocks)
  function spray(cx, cy, z, t) {
    for (let b = 0; b < 3; b++) {
      const per = 2.3 + b * 0.7, u = frac(t / per + b * 0.37), sx = 262 + b * 26 + (ih(b, fl(t / per + b * 0.37), 541) - 0.5) * 20;
      if (u > 0.7) continue;
      const k = u / 0.7;
      for (let q = 0; q < 34; q++) {
        const a = -PI / 2 + (ih(q, b, 542) - 0.5) * 1.5, v = 60 + 90 * ih(q, b + 7, 542);
        const wx = sx + Math.cos(a) * v * k * 0.8 + k * 18, wy = 246 + Math.sin(a) * v * k + 120 * k * k;
        const X = toSX(240 + cx * 0.95, z, wx), Y = toSY(135 + (cy - 135) * 0.95, z, wy);
        if (bay(fl(X), fl(Y)) < 1 - k) { P(X, Y, k < 0.4 ? 194 : 246); if (ih(q, b, 543) < 0.3) P(X + 1, Y, 245); }
      }
    }
  }
  const f5X = (t) => lerp(-10, T5X - 2, eis(clamp((t - 22.75) / 2.4, 0, 1)) * 0.25 + clamp((t - 22.75) / 2.4, 0, 1) * 0.75);
  const f5Pose = (t) => {
    const ph = t * 3.3, inside = t > 25.15;
    const wagD = (u) => { const tt = t - u * 0.12; return 0.12 * Math.sin(TAU * 1.6 * tt) + 0.05 * Math.sin(TAU * 3.3 * tt); };
    let eyes = 1; for (const b of [23.5]) { const q = (t - b) / 0.14; if (q > 0 && q < 1) eyes = Math.abs(q * 2 - 1); }
    return { ph, gait: 1 - sstep(24.9, 25.15, t) * 0.7, A: 4.6, yaw: 0.4, tilt: 0.1, mouth: 1, tLift: -0.1, wagD, earN: 0.45, earF: 0.4, perk: 0.2, eyes, breath: t * TAU * 1.8, pitch: 0.04 };
  };
  const F5LIGHT = { sky: [-0.5, -0.85], rim: 0.6, amb: 0.3, z: 4, gain: 1.5 };
  function f5Cam(t) {
    const a = eis((t - 22.75) / 1.5), b = eio((t - 24.0) / 1.6);
    let z = lerp(1.25, 1.0, a), cx = lerp(208, 246, a) + drift(t, 9, 1), cy = lerp(126, 134, a);
    if (b > 0) { z = lerp(z, 1.8, b); const fx = T5X, fy = T5Y - 10, sx = lerp(toSX(cx, 1, fx), 250, b), sy = lerp(toSY(cy, 1, fy), 150, b); cx = fx - (sx + 0.5 - 240) / z; cy = fy - (sy + 0.5 - 135) / z; }
    return [cx, cy, z];
  }
  const cliff5 = (wy) => (wy < 200 ? 262 + (wy - HORIZ) * 0.1 : 262 + (wy - 200) * 0.2);
  // the whole place at time t: o = { lit (the lamp room alight 0..1), beamA, door (glow in the doorway), shipTurn (0..1),
  // setLamp (puts the kit's lantern light back after the reset) }
  function stormPlace(t, cam, o) {
    const [cx, cy, z] = cam, L = F5.L, lit = o.lit || 0;
    TAB = F5.rig; FOGT = F5FOG; SPK_SNOW = M_SNOW; SHAD.length = 0; LAMP.on = 0;
    if (o.setLamp) o.setLamp();
    stormSky(cx, cy, z, t);
    // far headlands; the harbour's lights along the far shore (right)
    for (let X = 0; X < W; X++) {
      const wx = toLX(240 + cx * 0.6, z, X), hy = HORIZ - 3 - 6 * fbm(wx, 0, 30, 3, 551) * sstep(330, 420, wx);
      for (let Y = Math.max(ROW0, fl(toSY(135 + (cy - 135) * 0.9, z, hy))); Y <= Math.min(ROW1, toSY(135 + (cy - 135) * 0.9, z, HORIZ + 1)); Y++) BUF[Y * W + X] = 241;
    }
    const harb = [];
    for (let k = 0; k < 14; k++) { const wx = 392 + ih(k, 0, 552) ** 1.6 * 70, wy = HORIZ - 1.5 - ih(k, 2, 552) ** 2 * 5 - (wx < 420 ? 2 : 0); const X = toSX(240 + cx * 0.6, z, wx), Y = toSY(135 + (cy - 135) * 0.9, z, wy); P(X, Y, 0.7 + 0.3 * Math.sin(t * 2 + k) > 0.85 ? 16 : 15); harb.push([X, Y]); }
    // the ship: lost and pitching; once the light is lit it comes about and heads for the harbour
    const sh = o.shipTurn || 0;
    const sxw = 592 - sh * 40, syw = 140 + 2.5 * Math.sin(t * 1.7 + 1), roll = 0.18 * Math.sin(t * 1.7) + 0.07 * Math.sin(t * 3.1);
    const sX = toSX(240 + cx * 0.95, z, sxw), sY = toSY(135 + (cy - 135) * 0.95, z, syw);
    stormSea(cx, cy, z, t, cliff5, [{ x: sX, y: sY, n: 6, a: 0.7, c: 15, c2: 241 }]);
    drawShip(sX, sY, 1.05 * z, roll * (1 - 2 * sstep(0.3, 0.7, sh)), true, sh);
    for (const [X, Y] of harb) glow(X, Y, 4 * z, T_LAMP, 0.3);
    if (lit > 0 && beamFx) beamFx(t, cam, lit, o.beamA || 0, false);
    if (LAMP.on) SHAD.push({ x: LAMP.x + 16 * z, y: toSY(cy, z, F5G) + 1, rx: 22 * z, ry: 3 * z, a: 0.5, lamp: 1 });
    comp(L.main, cx + 100, cy, z, 0);
    spray(cx, cy, z, t);
    const tw = drawTower(toSX(cx, z, T5X), toSY(cy, z, T5Y), T5S * z, { lit, door: o.door || 0 }, { sky: [-0.5, -0.85], z: 6 });
    drawCottage(toSX(cx, z, T5X - 122), toSY(cy, z, T5Y + 1), z, { z: 30 }, t);
    if (lit > 0 && beamFx) beamFx(t, cam, lit, o.beamA || 0, true, tw.lamp);
    return tw;
  }
  function f5Draw(t) {
    const cam = f5Cam(t), [cx, cy, z] = cam;
    const p = f5Pose(t), fwx = f5X(t), fxs = toSX(cx, z, fwx), fys = toSY(cy, z, F5G), S = F5S * z;
    const th = pendulum(t, (tt) => { foxPrep(f5Pose(tt), f5X(tt), F5G, F5S, 1, F5LIGHT); return [FOXOUT.mouth[0] / F5LS, FOXOUT.mouth[1] / F5LS]; }, 22.3);
    const inside = sstep(25.05, 25.25, t);
    foxPrep(p, fxs, fys, S, 1, F5LIGHT);
    const [mx, my] = FOXOUT.mouth, LS = F5LS * z, fl0 = lanternFlame(mx, my, LS, th);
    const setLamp = () => { LAMP.on = 1; LAMP.x = fl0[0]; LAMP.y = fl0[1]; LAMP.z = 0; LAMP.h = Math.max(4, (fys - fl0[1]) / z); LAMP.I = 1.15 * flick(t) * (1 - inside * 0.6); LAMP.R = 50 * z; LAMP.zoom = z; LAMP.rot = th * 2; };
    stormPlace(t, cam, { door: inside, setLamp });
    if (inside < 1) {
      foxPrep(p, fxs, fys, S, 1, F5LIGHT);
      drawFox(p, fxs, fys, S, 1, F5LIGHT);
      drawLantern(mx, my, LS, th, { lit: 1 });
    }
    lanternGlow(LAMP.x, LAMP.y, z, 1 - inside * 0.5);
    comp(F5.L.fore, 40 + cx * 1.25, 135 + (cy - 135) * 1.1, z, 0);
    snowfall(t, cx, cy, z, { dens: 1.3, wind: 70, fall: 1.4 });
  }
  let F5FOG = null;
  BUILDERS.push(() => { F5FOG = mkTab('324050', false); });
  let beamFx = null;                                             // (the beam is given by shot 6)
  shot(22.75, 25.3, (lt, t) => {
    if (t < 23.25) dip(() => f4Draw(t), () => f5Draw(t), (t - 22.75) / 0.5);
    else f5Draw(t);
  });

  /* ================================================================ 5b · The climb, 5c · the lamp room (25.3 … 25.6 – 30.0)
     Inside the tower: the curved stone wall, the iron spiral stair winding round its stone newel, slit windows full of
     storm. The kit races up, round and round (in front of the newel, then behind it), its lantern's light climbing the
     masonry with it; the camera rises with it, through the hatch in the floor, into the lamp room: tall panes all round
     with the storm beyond, the great lens dark on its pedestal, and the keeper on his stool, head bowed. The kit pops up
     out of the hatch; its light reaches him; he looks up. */
  const FI = { L: {}, rig: null, rigLit: null };
  const OYI = 320, SHAFT = 330, NEW_X = 240, STAIR_R0 = 14, STAIR_R1 = 150, WALL_R = 176;
  const TREAD_N = 33, TREAD_DY = SHAFT / (TREAD_N + 0.4), TREAD_DA = TAU / 16, TREAD_A0 = -PI / 2;
  const tread = (k) => ({ a: TREAD_A0 + k * TREAD_DA, y: SHAFT - 8 - k * TREAD_DY });
  const HATCH_X = 152, KEEP_X = 262, LENS_X = 372, LENS_Y = -100, LENS_S = 1.95;
  BUILDERS.push(() => {
    FI.rig = mkRig([0.06, 0.055, 0.08], [0.5, 0.52, 0.7], [1.0, 0.56, 0.24]);
    const L = FI.L, Hh = 960;
    // the wall, the newel and the treads behind it (back), and the treads and rail in front (front)
    L.back = mkLayer(480, Hh, { z0: -60 });
    const oy = OYI;
    for (let y = -6; y < SHAFT + 30; y++) for (let x = 0; x < 480; x++) {
      const dx = x - NEW_X, q = dx / WALL_R;
      if (Math.abs(q) >= 1) {
        // the tower cut away: the section through its thick wall (big blocks, the cut face lighter), then outside
        if (Math.abs(dx) < WALL_R + 24) { const sx = Math.abs(dx) - WALL_R, blk = ((fl(y / 12) + fl(sx / 12)) & 1), j = frac(y / 12) < 0.08 || frac(sx / 12 + 0.5 * (fl(y / 12) & 1)) < 0.07; lput(L.back, x, y + oy, M_STONE, (j ? 0.18 : 0.34 + blk * 0.05 + ih(fl(y / 12), fl(sx / 12), 604) * 0.08) - (sx > 21 ? 0.12 : 0), 30, dx < 0 ? 0.8 : -0.8, 0, 0); }
        continue;
      }
      // the curved wall: courses of dressed stone, foreshortened toward the sides; mortar; damp streaks; slit windows
      const phi = Math.asin(q), course = fl(y / 9.5), cf = frac(y / 9.5), along = (phi * WALL_R) / 15 + (course & 1) * 0.5 + ih(course, 0, 601) * 0.3, af = frac(along);
      const mortar = cf < 0.1 || af < 0.05 / Math.max(0.25, Math.cos(phi));
      const stoneV = ih(course, fl(along), 602) - 0.5;
      let s = 0.36 + 0.2 * Math.cos(phi) + stoneV * 0.12 - (mortar ? 0.13 : 0) - vn(x * 0.4, y * 0.05, 6, 603) * 0.08;
      lput(L.back, x, y + oy, M_STONE, s, 50 + 60 * (1 - Math.cos(phi)), -q * 0.95, 0, 0);
    }
    // slit windows with deep splayed reveals (the storm shows through them, drawn live): transparent here
    for (const [wx, wy] of [[150, 260], [330, 165], [168, 70]]) {
      for (let y = wy - 16; y < wy + 16; y++) for (let x = wx - 9; x <= wx + 9; x++) {
        const dx = x - wx, top = wy - 12 + Math.abs(dx) * 0.3, inn = Math.abs(dx) < 2.5 && y > wy - 10 + Math.abs(dx);
        if (inn && y < wy + 13) { const i = (y + oy) * 480 + x; L.back.M[i] = 0; continue; }
        if (Math.abs(dx) < 8 && y > top && y < wy + 15) lput(L.back, x, y + oy, M_STONE, 0.14 + (dx < 0 ? 0.08 : -0.02) + (y > wy + 12 ? 0.1 : 0), 70, dx < 0 ? 0.6 : -0.6, 0, 0);
      }
    }
    // the door at the foot (an arch, ajar, the storm outside)
    for (let y = SHAFT - 44; y < SHAFT; y++) for (let x = 84; x < 122; x++) {
      const dx = x - 103, top = SHAFT - 30 - Math.sqrt(Math.max(0, 19 * 19 - dx * dx)) * 0.75;
      if (y < top) continue;
      if (Math.abs(dx) < 15) { const i = (y + oy) * 480 + x; if (dx > 4) lput(L.back, x, y + oy, M_WOOD, 0.22 + (frac(dx / 5) < 0.15 ? -0.08 : 0), 40, -0.6, 0, 0); else L.back.M[i] = 0; }
      else lput(L.back, x, y + oy, M_STONE, 0.32, 45, 0, 0, 0);
    }
    // the lamp room: floorboards (with the hatch), a parapet, the window frames (panes transparent: the storm is live)
    for (let y = -6; y < 6; y++) for (let x = 0; x < 480; x++) {
      if (Math.abs(x - HATCH_X) < 26 && y > -6) { if (y > 2) continue; }
      lput(L.back, x, y + oy, M_WOOD, (y < -4 ? 0.5 : 0.28) + (frac(x / 23) < 0.06 ? -0.12 : 0) + (vn(x * 0.3, y, 4, 611) - 0.5) * 0.1, 0, 0, y < -4 ? -1 : 0.4, 0);
    }
    for (let y = -250; y < -6; y++) for (let x = 0; x < 480; x++) {
      let m = 0, s = 0, nx = 0, ny = 0;
      if (y > -48) { m = M_STONE; s = 0.26 + (y < -44 ? 0.2 : 0) + (frac(x / 30 + (fl(y / 10) & 1) * 0.5) < 0.04 || frac(y / 10) < 0.1 ? -0.07 : 0); ny = y < -44 ? -1 : 0; }    // parapet
      else if (y < -222) { m = M_IRON; s = 0.16 + (frac(x / 40) < 0.08 ? 0.1 : 0); }                       // the roof's iron ribs
      else {
        const mul = frac(x / 96 + 0.5), bar = Math.min(mul, 1 - mul) * 96 < 3.2, transom = Math.abs(y + 136) < 2.5 || y < -216 || y > -54;
        if (bar || transom) { m = M_IRON; s = 0.2 + (bar && mul < 0.5 ? 0.1 : 0); nx = bar ? (mul < 0.5 ? -0.7 : 0.7) : 0; }
      }
      if (m) lput(L.back, x, y + oy, m, s, 30, nx, ny, 0);
    }
    // the lamp room, furnished: wood panelling under the glass with a brass rail; frost in the panes' corners; the
    // gallery railing outside; an oilskin coat on a hook and the ship's bell on the mullions; a desk with the open log,
    // an inkwell, a mug and an oil can; a little iron stove with its kettle and a red-glowing grate; an oil barrel
    for (let y = -48; y < -6; y++) for (let x = 0; x < 480; x++) {
      if (y < -45) { lput(L.back, x, y + oy, M_BRASSM, 0.45 + (y < -47 ? 0.3 : 0), 20, 0, y < -47 ? -1 : 0, 0); continue; }
      const pw = 40, px = frac(x / pw), inset = px > 0.1 && px < 0.9 && y > -40 && y < -12, edge = inset && (px < 0.14 || px > 0.86 || y < -37 || y > -15);
      lput(L.back, x, y + oy, M_WOOD, 0.3 + (inset ? -0.05 : 0.04) + (edge ? (px < 0.14 || y < -37 ? -0.08 : 0.08) : 0) + (vn(x * 0.5, y * 0.08, 3, 612) - 0.5) * 0.08, 20, 0, 0, 0);
    }
    for (let y = -216; y < -54; y++) for (let x = 0; x < 480; x++) {
      const i = (y + oy) * 480 + x; if (L.back.M[i]) continue;
      const mul = frac(x / 96 + 0.5), dmul = Math.min(mul, 1 - mul) * 96, dtop = Math.min(Math.abs(y + 136), y + 216, -54 - y);
      const frost = Math.min(dmul, dtop); if (frost < 9 && ih(x, y, 613) < Math.pow((9 - frost) / 9, 1.6) * 0.55) { lput(L.back, x, y + oy, M_SNOW, 0.5 + ih(x, y, 614) * 0.3, 30, 0, 0, 0); continue; }
      if (Math.abs(y + 78) < 1.2 || Math.abs(y + 64) < 0.8 || (Math.abs(frac(x / 24) - 0.5) < 0.04 && y > -80)) lput(L.back, x, y + oy, M_IRON, 0.12, 200, 0, 0, 0);   // the gallery rail beyond the glass
    }
    const coat = (x, y) => { const cx = 48, top = -170; if (y < top || y > -76) return false; const hw = 4 + (y - top) * 0.13 + Math.sin((y - top) * 0.2) * 1.5; return Math.abs(x - cx) < hw; };
    for (let y = -178; y < -74; y++) for (let x = 20; x < 80; x++) {
      if (Math.abs(x - 48) < 2 && y < -170) { lput(L.back, x, y + oy, M_IRON, 0.3, 15, 0, 0, 0); continue; }
      if (coat(x, y)) { const fold = Math.sin((x - 48) * 0.6 + y * 0.05), sl = Math.abs(x - 48) > 6 + (y + 170) * 0.05; lput(L.back, x, y + oy, M_CAP, 0.28 + fold * 0.08 + (x < 46 ? 0.08 : -0.06) - (sl ? 0.06 : 0), 15, (x - 48) / 12, 0, 0); }
    }
    for (let y = -150; y < -120; y++) for (let x = 268; x < 296; x++) {
      const dx = x - 282, v = y + 150;
      if (Math.abs(dx) < 1 && v < 5) lput(L.back, x, y + oy, M_IRON, 0.3, 15, 0, 0, 0);
      else if (v >= 5 && Math.abs(dx) < 3 + (v - 5) * 0.42 && v < 26) lput(L.back, x, y + oy, M_BRASSM, 0.35 - dx * 0.04 + (v > 24 ? 0.15 : 0), 15, dx / 10, 0, 0);
      else if (v >= 26 && v < 29 && Math.abs(dx) < 1.4) lput(L.back, x, y + oy, M_BRASSM, 0.5, 15, 0, 0, 0);
    }
    for (let y = -40; y < -6; y++) for (let x = 30; x < 122; x++) {                 // the desk and what is on it
      const dx = x - 76;
      if (y >= -34 && y < -30 && Math.abs(dx) < 44) { lput(L.back, x, y + oy, M_WOOD, y < -33 ? 0.55 : 0.32, 12, 0, y < -33 ? -1 : 0, 0); continue; }
      if (y >= -30 && (Math.abs(dx + 39) < 2 || Math.abs(dx - 39) < 2)) { lput(L.back, x, y + oy, M_WOOD, 0.24, 12, 0, 0, 0); continue; }
      if (y >= -30 && y < -24 && Math.abs(dx) < 36) { lput(L.back, x, y + oy, M_WOOD, 0.2 + (Math.abs(dx) < 1 ? -0.08 : 0) + (Math.abs(dx - 18) < 2 && y > -28 ? 0.25 : 0), 12, 0, 0, 0); continue; }
      if (y < -34 && y >= -37 && dx > -30 && dx < -2) { const page = dx < -16 ? -16 - dx : dx + 16, line = frac((y + 37) / 1.5) < 0.3 && page > 2; lput(L.back, x, y + oy, M_WOOLC, 0.6 - (Math.abs(dx + 16) < 0.8 ? 0.2 : 0) - (line ? 0.18 : 0), 12, 0, -1, 0); continue; }
      if (y < -34 && y >= -39 && Math.abs(dx - 6) < 2.5) { lput(L.back, x, y + oy, M_IRON, 0.2 + (dx < 6 ? 0.1 : 0), 12, 0, 0, 0); continue; }      // the inkwell
      if (y < -34 && y >= -36 && Math.abs(dx - 9) < 0.5) { lput(L.back, x, y + oy, M_WOOLC, 0.7, 12, 0, 0, 0); }
      if (y < -34 && y >= -40 && Math.abs(dx - 17) < 3) { lput(L.back, x, y + oy, M_WOOL, 0.4 - (dx - 17) * 0.05 + (y < -39 ? 0.2 : 0), 12, 0, 0, 0); continue; }   // the mug
      if (y < -34 && y >= -44 && dx > 26 && dx < 36) { const hw = 4 - Math.max(0, -40 - y) * 0.7; if (Math.abs(dx - 31) < hw) lput(L.back, x, y + oy, M_BRASSM, 0.35 - (dx - 31) * 0.05, 12, (dx - 31) / 5, 0, 0); else if (y < -40 && dx > 33 && Math.abs(y + 42 - (dx - 33) * 0.4) < 0.7) lput(L.back, x, y + oy, M_BRASSM, 0.4, 12, 0, 0, 0); }
    }
    for (let y = -60; y < -6; y++) for (let x = 410; x < 480; x++) {                // the stove, its pipe, the kettle, the barrel
      const sx = x - 436;
      if (Math.abs(sx) < 3 && y < -40) { lput(L.back, x, y + oy, M_IRON, 0.2 + (sx < 0 ? 0.1 : 0), 14, sx / 3, 0, 0); continue; }
      if (Math.abs(sx) < 13 && y >= -40 && y < -12) {
        const grate = Math.abs(sx) < 7 && y > -28 && y < -17, bars = Math.abs(frac(sx / 3) - 0.5) < 0.15;
        if (grate) { L.back.M[(y + oy) * 480 + x] = 0; continue; }
        lput(L.back, x, y + oy, M_IRON, 0.18 + (sx < -8 ? 0.12 : 0) + (y < -38 ? 0.15 : 0) + (bars && Math.abs(y + 22) < 6 ? 0 : 0), 14, sx / 13, 0, 0); continue;
      }
      if (Math.abs(sx) < 11 && y >= -12 && (Math.abs(sx + 9) < 1.5 || Math.abs(sx - 9) < 1.5)) { lput(L.back, x, y + oy, M_IRON, 0.16, 14, 0, 0, 0); continue; }
      const kx = sx + 2, ky = y + 46; if (Math.hypot(kx / 7, ky / 5) < 1 && y < -40) { lput(L.back, x, y + oy, M_IRON, 0.26 - kx * 0.03 + (ky < -3 ? 0.12 : 0), 14, kx / 7, ky / 5, 0); continue; }
      if (y < -48 && y > -53 && kx > 5 && Math.abs(y + 50 - (kx - 5) * 0.5) < 0.8) { lput(L.back, x, y + oy, M_IRON, 0.3, 14, 0, 0, 0); continue; }
      const bx = x - 466; if (Math.abs(bx) < 11 && y > -34) { const st = Math.abs(y + 26) < 1 || Math.abs(y + 12) < 1; lput(L.back, x, y + oy, st ? M_IRON : M_WOOD, (st ? 0.28 : 0.22 + 0.2 * Math.sqrt(Math.max(0, 1 - (bx / 11) ** 2))) - bx * 0.01, 14, bx / 11, 0, 0); }
    }
    // the lens's pedestal: an iron column with a brass collar
    for (let y = -46; y < -6; y++) for (let x = LENS_X - 18; x <= LENS_X + 18; x++) {
      const w = y > -12 ? 18 : y > -40 ? 11 : 16, q = (x - LENS_X) / w; if (Math.abs(q) > 1) continue;
      lput(L.back, x, y + oy, y < -40 ? M_BRASSM : M_IRON, 0.25 + 0.3 * Math.sqrt(1 - q * q) - q * 0.15, 10, q * 0.9, 0, 0);
    }
  });
  // outside the windows and the slits: the storm (dark sky, the faint sea, driving snow), live
  function outside(cx, cy, z, t, beamOut) {
    for (let Y = ROW0; Y <= ROW1; Y++) {
      const wy = toLY(cy, z, Y), o = Y * W;
      for (let X = 0; X < W; X++) {
        const wx = toLX(cx, z, X), b = BAYF[((Y & 7) << 3) | (X & 7)];
        if (wy > cy + 6) {                                      // the sea far below (its horizon at eye level): dark swells, whitecaps
          const sw = (wy - cy - 6) * 0.16 - t * 0.7 + n1(wx * 0.01, 622) * 1.5, f = frac(sw);
          BUF[o + X] = f < 0.06 && vn(wx * 0.3, wy, 3, 624) > 0.55 ? 245 : f < 0.4 ? 241 : 240;
          continue;
        }
        // torn storm cloud racing past, lighter toward the horizon
        const n = vn(wx * 0.7 + t * 34, wy * 1.6, 22, 621) * 0.6 + vn(wx * 1.6 + t * 52, wy * 3, 8, 625) * 0.4;
        const v = n * 0.85 + clamp((wy + 220) / 130, 0, 1) * 0.3 + (b - 0.5) * 0.12;
        BUF[o + X] = v > 0.74 ? 244 : v > 0.58 ? 243 : v > 0.42 ? 242 : 241;
      }
    }
    for (let k = 0; k < 110; k++) {                              // snow driving past the glass in the wind
      const sp = 0.35 + ih(k, 2, 623) * 0.4, x = frac(ih(k, 1, 623) + t * sp) * 540 - 30, y = frac(ih(k, 3, 623) + t * sp * 0.45) * 260 + ROW0 - 20;
      const c = ih(k, 4, 623) < 0.3 ? 247 : 246;
      P(x, y, c); P(x - 1, y - 0.5, 245); if (ih(k, 5, 623) < 0.4) P(x - 2, y - 1, 244);
    }
  }
  // the stove's fire through its grate: embers breathing red and gold, a faint warm glow round it
  function stoveGlow(cx, cy, z, t) {
    const X0 = fl(toSX(cx, z, 429)), X1 = Math.ceil(toSX(cx, z, 443)), Y0 = fl(toSY(cy, z, -28)), Y1 = Math.ceil(toSY(cy, z, -17));
    if (X1 < 0 || X0 >= W || Y1 < ROW0 || Y0 > ROW1) return;
    for (let Y = Math.max(ROW0, Y0); Y <= Math.min(ROW1, Y1); Y++) for (let X = Math.max(0, X0); X <= Math.min(W - 1, X1); X++) {
      const lx = toLX(cx, z, X) - 436, ly = toLY(cy, z, Y), bars = Math.abs(frac(lx / 3) - 0.5) < 0.17;
      const e = 0.5 + 0.5 * Math.sin(lx * 0.9 + t * 3.1) * Math.sin(ly * 0.7 - t * 2.3) + (ly + 17) * 0.06;
      BUF[Y * W + X] = bars ? 195 : e > 0.85 ? 182 : e > 0.55 ? 180 : e > 0.3 ? 178 : 177;
    }
    glow(toSX(cx, z, 436), toSY(cy, z, -22), 26 * z, T_WARM, 0.22 + 0.05 * Math.sin(t * 5));
  }
  // the stair, live (so the half in front can be cut away clear of the kit). Each tread is a cast-iron wedge seen a little
  // from above or below (by its height against the camera's): its top (a cast diamond pattern) or its ribbed underside,
  // its nosing edge catching the lantern, two balusters at its outer end; the handrail runs over them. pass: 0 the back
  // half, 1 the front half (cut short unless near kFox)
  const TSTP = new Uint32Array(NP); let tStamp = 0;
  const TSIN = new Float32Array(1024), TCOS = new Float32Array(1024), TTH = new Float32Array(1024);
  function stairLive(cx, cy, z, pass, kFox) {
    for (let k = 0; k < TREAD_N; k++) {
      const T = tread(k), a0 = T.a, a1 = T.a + TREAD_DA * 0.92, cm = Math.cos(T.a + TREAD_DA * 0.46), front = cm > 0;
      if ((pass === 1) !== front) continue;
      const near = Math.abs(k - kFox) < 2.6, r1 = front && !near ? 58 : STAIR_R1;
      const Yt = toSY(cy, z, T.y); if (Yt < ROW0 - 30 || Yt > ROW1 + 30) continue;
      const kk = clamp((T.y - cy) * 0.0018, -0.14, 0.14), above = kk < 0;      // seen from above (its top) or from below
      // the slab: rows of (r, angle) samples; the top/underside, then its leading edge's thickness
      const nA = Math.ceil((a1 - a0) * r1 * z * 1.6) + 2; tStamp++;
      for (let ai = 0; ai <= nA; ai++) { const th = lerp(a0, a1, ai / nA); TSIN[ai] = Math.sin(th); TCOS[ai] = Math.cos(th); TTH[ai] = th; }
      for (let ri = 0; ; ri++) {
        const r = STAIR_R0 + ri * 0.6 / z; if (r > r1) break;
        const fade = front && !near ? 1 - (r - STAIR_R0) / (58 - STAIR_R0) : 1;
        for (let ai = 0; ai <= nA; ai++) {
          const th = TTH[ai], sx = NEW_X + r * TSIN[ai], dz = r * TCOS[ai], X = fl(toSX(cx, z, sx)), Y = fl(Yt - dz * kk * z);
          if (X < 0 || X >= W || Y < ROW0 || Y > ROW1) continue;
          const pi = Y * W + X; if (TSTP[pi] === tStamp) continue; TSTP[pi] = tStamp;
          if (fade < 1 && BAYF[((Y & 7) << 3) | (X & 7)] > fade * 1.4) continue;
          const pat = (Math.abs(frac(r / 6 + th * 3) - 0.5) < 0.12 || Math.abs(frac(r / 6 - th * 3) - 0.5) < 0.12) ? -0.07 : 0;
          const rib = !above && Math.abs(frac((th - a0) / (a1 - a0) * 3) - 0.5) < 0.12 ? 0.08 : 0;
          const s0 = above ? 0.52 + pat + (r > r1 - 3 ? 0.16 : 0) - (r < STAIR_R0 + 6 ? 0.12 : 0) : 0.24 + rib;
          BUF[Y * W + X] = mc(M_IRON, s0, lampAt(X, Y, -dz * 0.5, 0, above ? -1 : 0.9), X, Y);
        }
      }
      // the leading edge (the nosing), three units thick, lit face on
      const thick = 3 * z;
      for (let ri = 0; ; ri++) {
        const r = STAIR_R0 + ri * 0.5 / z; if (r > r1) break;
        const th = a0, sx = NEW_X + r * Math.sin(th), dz = r * Math.cos(th), X = fl(toSX(cx, z, sx)), Yb = Yt - dz * kk * z;
        if (X < 0 || X >= W) continue;
        const fade = front && !near ? 1 - (r - STAIR_R0) / (58 - STAIR_R0) : 1;
        for (let dd = 0; dd < thick; dd++) { const Y = fl(Yb + dd); if (Y < ROW0 || Y > ROW1) continue; if (fade < 1 && BAYF[((Y & 7) << 3) | (X & 7)] > fade * 1.4) continue; BUF[Y * W + X] = mc(M_IRON, dd < 1 ? 0.48 : 0.22 - dd * 0.02, lampAt(X, Y, -dz * 0.5, 0, 0), X, Y); }
      }
      // two balusters at the outer end, up to the handrail
      if (r1 === STAIR_R1) for (const f of [0.2, 0.75]) {
        const th = lerp(a0, a1, f), sx = NEW_X + STAIR_R1 * Math.sin(th), dz = STAIR_R1 * Math.cos(th), X = toSX(cx, z, sx), Yb = Yt - dz * kk * z;
        for (let d = 0; d < 14 * z; d++) { const YY = fl(Yb - d); if (YY < ROW0 || YY > ROW1) continue; for (let w = 0; w < Math.max(1, fl(1.4 * z)); w++) { const XX = fl(X) + w; if (XX < 0 || XX >= W) continue; BUF[YY * W + XX] = mc(M_IRON, w === 0 ? 0.36 : 0.18, lampAt(XX, YY, -dz * 0.5, w === 0 ? -0.6 : 0.6, 0), XX, YY); } }
      }
    }
    // the handrail: a helix over the balusters, two px thick, its top catching the light
    for (let a = TREAD_A0; a < TREAD_A0 + TREAD_N * TREAD_DA; a += 0.004 / z) {
      const ca = Math.cos(a); if ((pass === 1) !== (ca > 0)) continue;
      const k = (a - TREAD_A0) / TREAD_DA; if (pass === 1 && Math.abs(k - kFox) > 3) continue;
      const hy = SHAFT - 8 - k * TREAD_DY - 14, kk = clamp((hy - cy) * 0.0018, -0.14, 0.14), dz = STAIR_R1 * ca;
      const X = fl(toSX(cx, z, NEW_X + STAIR_R1 * Math.sin(a))), Y = fl(toSY(cy, z, hy) - dz * kk * z);
      for (let d = 0; d < Math.max(2, fl(2 * z)); d++) { const YY = Y + d; if (X >= 0 && X < W && YY >= ROW0 && YY <= ROW1) BUF[YY * W + X] = mc(M_IRON, d === 0 ? 0.5 : 0.18, lampAt(X, YY, -dz * 0.5, 0, d === 0 ? -0.8 : 0.4), X, YY); }
    }
  }
  // the lantern throws the stair's shadows across the curved wall behind: each tread's outer edge and its balusters,
  // projected from the flame onto the masonry (so the shadows sweep round as the kit climbs)
  function stairShadows(cx, cy, z, kFox) {
    if (!LAMP.on) return;
    const Lx = toLX(cx, z, LAMP.x), Ly = toLY(cy, z, LAMP.y), Lz = LAMP.z > 30 ? -60 : 40;
    const put = (wx, wy, a) => { const X = fl(toSX(cx, z, wx)), Y = fl(toSY(cy, z, wy)); if (X < 0 || X >= W || Y < ROW0 || Y > ROW1) return; const i = Y * W + X; const l = lampAt(X, Y, -100, 0, 0); if (l < 0.15) return; const lv = clamp(fl(a * 8 * Math.min(1, l * 1.5)), 0, 6); if (lv > 0) BUF[i] = T_DARK[lv][BUF[i]]; };
    for (let k = Math.max(0, fl(kFox - 5)); k < Math.min(TREAD_N, kFox + 6); k++) {
      const T = tread(k);
      for (let f = 0; f <= 1; f += 0.012) {
        const th = T.a + TREAD_DA * 0.92 * f;
        for (const [r, h, a] of [[STAIR_R1, 0, 0.34], [STAIR_R1, -14, 0.3]]) {
          const px = NEW_X + r * Math.sin(th), pz = r * Math.cos(th), py = T.y + h;
          if (pz > Lz - 2) continue;
          // the wall point behind along the ray from the flame: x on the wall's circle, depth behind
          const dirx = px - Lx, diry = py - Ly, dirz = pz - Lz;
          let s = 1.2; for (let it = 0; it < 4; it++) { const wx = Lx + dirx * s - NEW_X, wz = Lz + dirz * s; const rr = Math.hypot(wx, wz); s *= WALL_R / Math.max(1, rr); }
          const wx = Lx + dirx * s, wy = Ly + diry * s; if (Lz + dirz * s > 0) continue;
          put(wx, wy, a);
        }
      }
      // the balusters' long shadows
      for (const f of [0.2, 0.75]) {
        const th = T.a + TREAD_DA * 0.92 * f, px = NEW_X + STAIR_R1 * Math.sin(th), pz = STAIR_R1 * Math.cos(th);
        if (pz > Lz - 2) continue;
        for (let h = 0; h < 14; h += 0.6) {
          const py = T.y - h, dirx = px - Lx, diry = py - Ly, dirz = pz - Lz;
          let s = 1.2; for (let it = 0; it < 4; it++) { const wx = Lx + dirx * s - NEW_X, wz = Lz + dirz * s; s *= WALL_R / Math.max(1, Math.hypot(wx, wz)); }
          put(Lx + dirx * s, Ly + diry * s, 0.3);
        }
      }
    }
  }
  // the rope handrail fixed to the wall (the back half), sagging between its iron eyes
  function wallRope(cx, cy, z) {
    for (let a = TREAD_A0; a < TREAD_A0 + TREAD_N * TREAD_DA; a += 0.003 / z) {
      const ca = Math.cos(a); if (ca > -0.05) continue;
      const k = (a - TREAD_A0) / TREAD_DA, seg = frac(k * 2), sag = Math.sin(seg * PI) * 2.2;
      const X = fl(toSX(cx, z, NEW_X + 172 * Math.sin(a))), Y = fl(toSY(cy, z, SHAFT - 8 - k * TREAD_DY - 16 + sag));
      if (X < 0 || X >= W || Y < ROW0 || Y > ROW1 - 1) continue;
      const tw = frac(a * 60) < 0.5;
      BUF[Y * W + X] = mc(M_WOOD, tw ? 0.4 : 0.28, lampAt(X, Y, -150, 0, -0.5), X, Y); BUF[(Y + 1) * W + X] = mc(M_WOOD, 0.14, 0, X, Y + 1);
      if (seg < 0.02 && Y + 3 <= ROW1) for (let d = -1; d <= 2; d++) BUF[(Y + d) * W + X] = mc(M_IRON, 0.35, 0, X, Y + d);
    }
  }
  // cold storm light falling in through the slit windows: pale shafts slanting down across the shaft, and snow in them
  function slitShafts(cx, cy, z, t) {
    for (const [wx, wy, dir] of [[150, 260, 1], [330, 165, -1], [168, 70, 1]]) {
      const X0 = Math.max(0, fl(toSX(cx, z, Math.min(wx, wx + dir * 100) - 20))), X1 = Math.min(W - 1, Math.ceil(toSX(cx, z, Math.max(wx, wx + dir * 100) + 20)));
      const Y0 = Math.max(ROW0, fl(toSY(cy, z, wy - 12))), Y1 = Math.min(ROW1, Math.ceil(toSY(cy, z, wy + 90)));
      for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) {
        const px = toLX(cx, z, X) - wx, py = toLY(cy, z, Y) - (wy - 4), along = (px * dir * 0.8 + py * 0.6), across = (-px * dir * 0.6 + py * 0.8);
        if (along < 0 || along > 110) continue;
        const wdt = 4 + along * 0.1, e = (1 - Math.abs(across) / wdt) * (1 - along / 110) * 0.7; if (e <= 0) continue;
        const b = BAYF[((Y & 7) << 3) | (X & 7)]; if (b < e) BUF[Y * W + X] = T_WH[e > 0.45 && b < e * 0.5 ? 3 : 2][BUF[Y * W + X]];
      }
      for (let q = 0; q < 10; q++) { const u = frac(ih(q, wx, 631) + t * 0.5), d = u * 100, x = wx + dir * d * 0.75 + (ih(q, 3, 631) - 0.5) * 10, y = wy - 4 + d * 0.55 + (ih(q, 4, 631) - 0.5) * 8; P(toSX(cx, z, x), toSY(cy, z, y), u < 0.6 ? 194 : 246); }
    }
  }
  function newelLive(cx, cy, z) {
    const X0 = fl(toSX(cx, z, NEW_X - 13)), X1 = Math.ceil(toSX(cx, z, NEW_X + 13));
    for (let Y = ROW0; Y <= ROW1; Y++) {
      const wy = toLY(cy, z, Y); if (wy < -4 || wy > SHAFT + 30) continue;
      for (let X = X0; X <= X1; X++) { const q = (toLX(cx, z, X) - NEW_X) / 13; if (Math.abs(q) > 1) continue; const ring = frac(wy / 21) < 0.08; BUF[Y * W + X] = mc(M_STONE, 0.3 + 0.28 * Math.sqrt(1 - q * q) - q * 0.14 - (ring ? 0.1 : 0), lampAt(X, Y, 0, q * 0.9, 0), X, Y); }
    }
  }
  const climbA = (t) => { const u = clamp((t - 25.65) / 2.6, 0, 1); return TREAD_A0 + eis(u) * 0.12 * (TREAD_N - 1) * TREAD_DA + u * 0.88 * (TREAD_N - 1) * TREAD_DA; };
  const climbK = (t) => (climbA(t) - TREAD_A0) / TREAD_DA;
  const fiPose = (t, dir) => {
    const ph = t * 3.0;
    const wagD = (u) => { const tt = t - u * 0.12; return 0.12 * Math.sin(TAU * 1.6 * tt); };
    return { ph, gait: 1, A: 3.6, yaw: 0.35 + 0.5 * (1 - Math.abs(dir)), tilt: -0.1, pitch: -0.22, mouth: 1, tLift: 0.1, wagD, earN: 0.2, earF: 0.2, perk: 0.5, breath: t * TAU * 2, bob: -1.5 * Math.abs(Math.sin(ph * PI)) };
  };
  const FILIGHT = { sky: [-0.4, -0.9], rim: 0.4, amb: 0.3, z: 0, gain: 1.6 };
  // the kit on the stair at time t: world position, facing, how near (+ in front of the newel)
  function fiFox(t) {
    const a = climbA(t), k = climbK(t), y = SHAFT - 8 - k * TREAD_DY, r = 100;
    const x = NEW_X + r * Math.sin(a), dir = Math.cos(a + TREAD_DA * 0.46);
    return { x, y, f: dir >= 0 ? 1 : -1, dir, front: dir > 0 };
  }
  function fiCam(t) {
    const fx = fiFox(Math.min(t, 28.25));
    const cyA = clamp(fx.y - 20, -20, SHAFT - 100), rise = eio((t - 28.0) / 1.0);
    return [240 + drift(t, 11, 1.2), lerp(cyA, LENS_Y + 2, rise), 1];
  }
  function fiDraw(t) {
    TAB = FI.rig; FOGT = F5FOG; SPK_SNOW = 0; SHAD.length = 0; LAMP.on = 0;
    const [cx, cy, z] = fiCam(t), L = FI.L;
    outside(cx, cy, z, t);
    // the kit: on the stair, then up through the hatch onto the floor, a few steps toward the keeper
    let fx, fy, f = 1, front = true, p;
    if (t < 28.25) { const F = fiFox(t); fx = F.x; fy = F.y; f = F.f; front = F.front; p = fiPose(t, F.dir); }
    else {
      const u = eis((t - 28.25) / 0.45), w = eoc((t - 28.7) / 0.7);
      fx = lerp(fiFox(28.25).x, HATCH_X + 4, u) + 46 * w; fy = lerp(fiFox(28.25).y, 0, u) - 8 * bump(28.25, 28.75, t);
      f = 1; front = true;
      p = roomFoxPose(t);
    }
    const fxs = toSX(cx, z, fx), fys = toSY(cy, z, fy), S = 1.22 * z, LS = 1.02 * S;
    foxPrep(p, fxs, fys, S, f, FILIGHT);
    const th = 0.25 * Math.sin(t * 6.2) * (t < 28.7 ? 1 : 0.4) * f;
    const [mx, my] = FOXOUT.mouth, fl0 = lanternFlame(mx, my, LS, th);
    LAMP.on = 1; LAMP.x = fl0[0]; LAMP.y = fl0[1]; LAMP.z = front ? 0 : 60; LAMP.h = 10; LAMP.I = 1.25 * flick(t); LAMP.R = 70; LAMP.zoom = 1; LAMP.rot = th * 2;
    comp(L.back, 240, OYI + cy, z, 0);
    stoveGlow(cx, cy, z, t);
    const kF = t < 28.25 ? climbK(t) : 99;
    if (t < 28.4) { slitShafts(cx, cy, z, t); wallRope(cx, cy, z); stairShadows(cx, cy, z, Math.min(kF, TREAD_N)); }
    const drawKit = () => { drawFox(p, fxs, fys, S, f, Object.assign({}, FILIGHT, { z: front ? 4 : 64 })); drawLantern(mx, my, LS, th, { lit: 1 }); };
    stairLive(cx, cy, z, 0, kF);
    if (!front) drawKit();                                        // (behind the newel on the far half of the turn)
    newelLive(cx, cy, z);
    stairLive(cx, cy, z, 1, kF);
    // the lamp room's furniture and its keeper (above the floor)
    if (toSY(cy, z, 0) > ROW0) {
      drawLens(toSX(cx, z, LENS_X), toSY(cy, z, LENS_Y), LENS_S * z, { lit: 0, rot: 0.3 });
      keeperAt(t, cx, cy, z);
    }
    if (front) drawKit();
    lanternGlow(LAMP.x, LAMP.y, z, 1);
    // the room's dark corners
    if (t < 28.25) for (let Y = ROW0; Y <= ROW1; Y++) for (let X = 0; X < W; X += 1) { const e = Math.abs(X - 240) / 240; if (e > 0.72 && bay(X, Y) < (e - 0.72) * 2.4) BUF[Y * W + X] = T_DARK[5][BUF[Y * W + X]]; }
  }
  // the kit once it is up in the room: it pops out, trots to the keeper's knee, looks up at him, tail going
  function roomFoxPose(t) {
    const ph = t * 2.6, walk = sstep(28.6, 28.8, t) * (1 - sstep(29.3, 29.5, t));
    const wagD = (u) => { const tt = t - u * 0.15; return 0.18 * Math.sin(TAU * 2.4 * tt) + 0.06 * Math.sin(TAU * 1.1 * tt); };
    let eyes = 1; for (const b of [29.9]) { const q = (t - b) / 0.14; if (q > 0 && q < 1) eyes = Math.abs(q * 2 - 1); }
    return { ph, gait: walk, A: 3.4 * walk, yaw: 0.5 + 0.2 * sstep(29.3, 29.7, t), tilt: -0.28 * sstep(29.2, 29.6, t), mouth: 1, tLift: 0.25, wagD, earN: 0.05, earF: 0.05, perk: 0.9, eyes, lookY: -0.8 * sstep(29.2, 29.6, t), lookX: 0.5, breath: t * TAU * 1.2, sit: 0.6 * sstep(29.4, 29.9, t) };
  }
  // the keeper in the lamp room: slumped, sad; the light reaches him; he looks up; hope
  function keeperAt(t, cx, cy, z) {
    const look = sstep(28.95, 29.35, t), hope = sstep(29.5, 30.2, t);
    const o = { lean: 0.32 - 0.22 * look, head: 0.55 - 0.75 * look, look: look, brow: 0.0 + 0.9 * hope, smile: -0.8 + 1.4 * hope, eyes: 1, handR: null, handL: null };
    let eb = 1; for (const b of [29.45]) { const q = (t - b) / 0.16; if (q > 0 && q < 1) eb = Math.abs(q * 2 - 1); }
    o.eyes = eb;
    return drawKeeper(toSX(cx, z, KEEP_X), toSY(cy, z, 0), 2.05 * z, -1, o, { sky: [-0.4, -0.9], amb: 0.3, z: 10, gain: 1.4 });
  }
  shot(25.3, 30.0, (lt, t) => {
    if (t < 25.8) dip(() => f5Draw(t), () => fiDraw(t), (t - 25.3) / 0.5);
    else fiDraw(t);
  });

  /* ================================================================ 6 · The light (30.0 – 36.0)
     The keeper leans down and takes the lantern from the kit's mouth; its light is on his face; he turns to the lens and
     sets it inside. The lens catches: ring after ring takes the flame, from the centre out, until the whole beehive burns
     (over half a second: never a flash). Outside, the beam blazes out over the black sea, sweeping through the snow, and
     the lost ship comes about for the harbour's lights. Inside again, in the warm lamp-room light, the kit turns once and
     curls up against the keeper's boots, tail over its nose, and he smiles down at it; snow falls past the glass; the
     beam goes round once more. Hold. */
  const T_LENS = 31.4, T_CATCH = 31.45;                       // the lantern set down inside; the light catching
  const lensCatch = (t) => eis(clamp((t - T_CATCH) / 0.55, 0, 1));
  const beamAngle = (t) => (t - T_CATCH) * 1.25 - 0.9;         // the lens turns: the beam's bearing (0 = straight at us)
  // the beam outside: a long cone from the lamp room, foreshortened as it turns, widening and fading with distance;
  // snow glittering in it; brightest (a flare at the lantern room) when it swings toward us
  beamFx = function (t, cam, lit, A, front, lamp) {
    const [cx, cy, z] = cam, lp = lamp || [toSX(cx, z, T5X), toSY(cy, z, T5Y - (TW.H + TW.gal + TW.room / 2) * T5S)];
    for (let k = 0; k < 2; k++) {                               // two beams, opposite each other
      const a = A + k * PI, ca = Math.cos(a), sa = Math.sin(a);
      if ((ca < 0) === front) continue;                           // (back beams behind the tower, front ones over it)
      const dirx = sa, diry = 0.12 + 0.05 * Math.abs(sa), L = 520 * z * (0.25 + 0.75 * Math.abs(sa)), w0 = 3 * z, w1 = (26 + 50 * (1 - Math.abs(sa))) * z;
      const ex = lp[0] + dirx * L, ey = lp[1] + diry * L;
      const x0 = Math.max(0, fl(Math.min(lp[0], ex) - w1)), x1 = Math.min(W - 1, Math.ceil(Math.max(lp[0], ex) + w1));
      const y0 = Math.max(ROW0, fl(Math.min(lp[1], ey) - w1)), y1 = Math.min(ROW1, Math.ceil(Math.max(lp[1], ey) + w1));
      const dx = ex - lp[0], dy = ey - lp[1], L2 = dx * dx + dy * dy, toward = Math.max(0, ca);
      for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) {
        const px = X + 0.5 - lp[0], py = Y + 0.5 - lp[1], u = (px * dx + py * dy) / L2;
        if (u < 0 || u > 1) continue;
        const qx = px - u * dx, qy = py - u * dy, d = Math.sqrt(qx * qx + qy * qy), wd = lerp(w0, w1, u);
        if (d > wd) continue;
        const across = 1 - d / wd, a2 = lit * (1 - u) * (1 - u * 0.4) * (0.35 + 0.65 * across * across) * (0.55 + 0.45 * toward) * (0.9 + 0.1 * Math.sin(u * 40 - t * 6));
        tintI(Y * W + X, X, Y, a2 > 0.55 ? T_WH : a2 > 0.25 ? T_GOLD : T_WARM, Math.min(0.9, a2 * 1.25));
      }
      // snow caught in the beam
      for (let q = 0; q < 70; q++) {
        const u = ih(q, k, 701), fx = lp[0] + dx * u, fy = lp[1] + dy * u, wd = lerp(w0, w1, u);
        const off = (frac(ih(q, k, 702) + t * (0.4 + ih(q, 3, 702) * 0.5)) - 0.5) * 2 * wd;
        const X = fx - dy / Math.sqrt(L2) * off, Y = fy + dx / Math.sqrt(L2) * off + frac(ih(q, 4, 702) + t * 0.6) * 6;
        if (bay(fl(X), fl(Y)) < lit * (1 - u)) P(X, Y, u < 0.4 ? 22 : 187);
      }
    }
    // the flare at the lantern room as a beam swings across us
    const face = Math.max(Math.cos(A), Math.cos(A + PI));
    glow(lp[0], lp[1], (16 + 40 * Math.pow(face, 6)) * z, T_WH, lit * (0.45 + 0.4 * Math.pow(face, 6)));
    glow(lp[0], lp[1], 60 * z, T_WARM, lit * 0.3);
  };
  // the room, alight or not: lens catch c (0..1)
  function roomDraw(t, cam, c, kitFn, keeperFn, beamOut) {
    TAB = FI.rig; FOGT = F5FOG; SPK_SNOW = 0; SHAD.length = 0;
    const [cx, cy, z] = cam, L = FI.L;
    outside(cx, cy, z, t);
    if (beamOut > 0) windowBeam(t, cx, cy, z, beamOut);
    comp(L.back, 240, OYI + cy, z, 0);
    stoveGlow(cx, cy, z, t);
    drawLens(toSX(cx, z, LENS_X), toSY(cy, z, LENS_Y), LENS_S * z, { lit: c, catch: c, rot: 0.3 + Math.max(0, t - T_CATCH) * 0.35 });
    keeperFn();
    kitFn();
  }
  // outside the panes: the beam going round, a broad band of light swinging over the sea and through the snow
  function windowBeam(t, cx, cy, z, amt) {
    const A = beamAngle(t);
    for (let k = 0; k < 2; k++) {
      const s = Math.sin(A + k * PI), c = Math.cos(A + k * PI);
      if (c < -0.2) continue;
      const bx = 240 + s * 300, w = 60 + 80 * c;
      for (let Y = ROW0; Y <= ROW1; Y++) {
        const wy = toLY(cy, z, Y); if (wy > -48 || wy < -222) continue;
        for (let X = Math.max(0, fl(bx - w)), X1 = Math.min(W - 1, Math.ceil(bx + w)); X <= X1; X++) {
          const d = Math.abs(X - bx + (Y - 100) * 0.35) / w; if (d > 1) continue;
          tintI(Y * W + X, X, Y, T_WARM, amt * (1 - d) * (0.4 + 0.5 * c));
        }
      }
    }
  }
  // the keeper's acting through shot 6
  function keeper6(t, cx, cy, z, mouth) {
    const take = sstep(30.05, 30.45, t), lift = sstep(30.45, 30.8, t), turn = t > 30.85 ? 1 : 0, place = sstep(30.9, 31.38, t), back = sstep(31.55, 32.0, t);
    const smileUp = sstep(30.5, 31.0, t);
    let f = turn ? 1 : -1, o;
    const ks = 2.05 * z, kx = toSX(cx, z, KEEP_X), ky = toSY(cy, z, 0);
    if (!turn) {
      // lean down to the kit, take the bail, lift the lantern to his face
      const hx = (mouth[0] - kx) / (ks * f), hy = (mouth[1] - ky) / ks;
      const tgt = [lerp(lerp(14, hx, take), 15, lift), lerp(lerp(-24, hy - 1, take), -45, lift)];
      o = { lean: 0.15 + 0.42 * take - 0.4 * lift, head: 0.25 + 0.15 * take - 0.4 * lift, look: 0.6, brow: 0.9, smile: 0.6 + 0.4 * smileUp, eyes: 1, handR: tgt, handL: null };
    } else {
      // half up off the stool, turned to the lens, reaching into it; then the hand comes back
      const lx = (toSX(cx, z, LENS_X - 6) - kx) / ks, ly = (toSY(cy, z, LENS_Y + 6) - ky) / ks;
      const tgt = [lerp(lerp(12, lx, place), 14, back), lerp(lerp(-40, ly, place), -26, back)];
      o = { lean: 0.35 * place * (1 - back) + 0.1, stand: 0.45 * (1 - back), head: 0.05 - 0.1 * back, look: 0.4 + 0.4 * back, brow: 0.9 + 0.1 * back, smile: 0.7 + 0.3 * back, eyes: 1, handR: tgt, handL: null };
    }
    let eb = 1; for (const b of [31.3, 33.4]) { const q = (t - b) / 0.15; if (q > 0 && q < 1) eb = Math.abs(q * 2 - 1); }
    o.eyes = eb;
    const hand = [kx + f * (o.handR[0] + 0.8) * ks, ky + (o.handR[1] + 0.2) * ks];
    return { kx, ky, ks, f, o, hand };
  }
  const drawKeeper6 = (K) => drawKeeper(K.kx, K.ky, K.ks, K.f, K.o, { sky: [-0.4, -0.9], amb: 0.32, z: 10, gain: 1.5 });
  function f6Draw(t) {
    const cam = [240 + drift(t, 11, 1.2) * 0.5, LENS_Y + 2, 1], [cx, cy, z] = cam;
    const c = lensCatch(t);
    // the kit at the keeper's knee (sitting, watching), its lantern going from its mouth to his hand, then into the lens
    const kp = roomFoxPose(Math.min(t, 29.99));
    kp.sit = 0.6; kp.tilt = -0.3 + 0.15 * sstep(30.4, 30.8, t); kp.mouth = t < 30.45 ? 1 : 2; kp.happy = t > 31.9 && t < 32.4 ? 1 : 0;
    kp.wagD = (u) => { const tt = t - u * 0.15; return (0.18 + 0.1 * sstep(31.8, 32, t)) * Math.sin(TAU * 2.4 * tt); };
    const fxw = HATCH_X + 50, fxs = toSX(cx, z, fxw), fys = toSY(cy, z, 0), S = 1.22 * z, LS = 1.02 * S;
    foxPrep(kp, fxs, fys, S, 1, FILIGHT);
    const mouth = FOXOUT.mouth.slice();
    // where the lantern is: in the kit's mouth, then the keeper's hand, then inside the lens
    const K = { hand: null };
    let lpx = mouth[0], lpy = mouth[1], th = 0.08 * Math.sin(t * 5);
    TAB = FI.rig;
    const KP = keeper6(t, cx, cy, z, mouth), kk = KP.hand;
    if (t >= 30.45 && t < T_LENS) { lpx = kk[0]; lpy = kk[1] - 1; th = 0.25 * Math.sin((t - 30.45) * 7) * Math.exp(-(t - 30.45) * 1.5); }
    if (t >= T_LENS) { lpx = toSX(cx, z, LENS_X - 1); lpy = toSY(cy, z, LENS_Y - 8); th = 0; }
    const fl0 = lanternFlame(lpx, lpy, LS, th);
    LAMP.on = 1; LAMP.x = fl0[0]; LAMP.y = fl0[1]; LAMP.z = 0; LAMP.h = 12; LAMP.I = (1.25 + 0.6 * c) * flick(t); LAMP.R = 70 + 110 * c; LAMP.zoom = 1; LAMP.rot = th * 2;
    roomDraw(t, cam, c, () => {
      drawFox(kp, fxs, fys, S, 1, FILIGHT);
      if (t < T_LENS + 0.2) drawLantern(lpx, lpy, LS, th, { lit: 1 });
    }, () => { drawKeeper6(KP); }, 0);
    if (t >= T_LENS && c < 1) drawLantern(lpx, lpy, LS * 0.9, 0, { lit: 1 });      // seen through the open panel, until the light swamps it
    lanternGlow(LAMP.x, LAMP.y, z, 1);
    if (c > 0) { const lx = toSX(cx, z, LENS_X), ly = toSY(cy, z, LENS_Y); glow(lx, ly, 70 + 80 * c, T_WARM, 0.35 * c); glow(lx, ly, 30 + 30 * c, T_WH, 0.3 * c); }
  }
  // outside: the beam blazing over the sea, the ship coming about
  function f6Out(t) {
    const u = eis((t - 32.2) / 2.2), cam = [lerp(250, 236, u), lerp(126, 118, u), lerp(1.08, 1.0, u)];
    const lit = 0.75 + 0.25 * sstep(32.2, 32.8, t);
    stormPlace(t, cam, { lit, beamA: beamAngle(t), shipTurn: sstep(32.6, 34.0, t) });
    comp(F5.L.fore, 40 + cam[0] * 1.25, 135 + (cam[1] - 135) * 1.1, cam[2], 0);
    snowfall(t, cam[0], cam[1], cam[2], { dens: 1.1, wind: 55, fall: 1.2 });
  }
  // inside again: warm; the kit turns once and curls up against his boots; he smiles down at it; the beam goes round
  function f6End(t) {
    TAB = FI.rig;
    const pu = eis((t - 34.2) / 1.75), zz = 1 + 0.22 * pu, fyp = -74;   // a slow push in on the two of them
    const cam = [lerp(240, 252, pu) + drift(t, 11, 1.2) * 0.5, lerp(LENS_Y + 6, fyp, pu), zz], [cx, cy, z] = cam;
    const curl = eis((t - 34.55) / 0.85), turn = sstep(34.3, 34.6, t) * (1 - sstep(34.6, 34.75, t));
    const eyesC = 1 - sstep(35.15, 35.5, t);
    const p = { ph: t * 2.2, gait: turn, A: 2.2 * turn, curl, yaw: lerp(0.5, 0.9, curl), tilt: 0.05 * curl, mouth: 0, eyes: eyesC, sleep: t > 35.45 ? 1 : 0, perk: 0.4 * (1 - curl), earN: 0.3 * curl, earF: 0.3 * curl,
      wagD: (u) => 0.08 * Math.sin(TAU * 0.7 * (t - u * 0.3)) * (1 - curl * 0.7), breath: t * TAU * 0.6, tLift: 0 };
    const fxw = KEEP_X - 72 + 6 * curl, fxs = toSX(cx, z, fxw), fys = toSY(cy, z, 0), S = 1.55 * z;
    LAMP.on = 1; LAMP.x = toSX(cx, z, LENS_X); LAMP.y = toSY(cy, z, LENS_Y); LAMP.z = -10; LAMP.h = 100; LAMP.I = 1.7 * flick(t); LAMP.R = 190 * z; LAMP.zoom = z; LAMP.rot = 0;
    const kx = toSX(cx, z, KEEP_X), ky = toSY(cy, z, 0), ks = 2.05 * z;
    const rest = eis((t - 35.0) / 0.7);                          // his hand comes down to rest on the kit's back
    const handT = [lerp(13, (kx - (fxs + 2 * S)) / ks, rest), lerp(-29, (fys - 9 * S - ky) / ks, rest)];
    roomDraw(t, cam, 1, () => { foxPrep(p, fxs, fys, S, 1, FILIGHT); drawFox(p, fxs, fys, S, 1, Object.assign({}, FILIGHT, { gain: 1.25, amb: 0.48 })); }, () => {
      const settle = eis((t - 34.2) / 1.4);
      drawKeeper(kx, ky, ks, -1, { lean: 0.16 + 0.1 * settle, head: 0.3 + 0.12 * settle, look: 0.1, brow: 1, smile: 1, eyes: 1 - 0.6 * sstep(35.4, 35.8, t), handR: null, handL: null }, { sky: [-0.4, -0.9], amb: 0.34, z: 10, gain: 1.3 });
    }, 0.6);
    const lx = toSX(cx, z, LENS_X), ly = toSY(cy, z, LENS_Y), face = Math.pow(Math.max(0, Math.cos(beamAngle(t) * 2)), 8);
    glow(lx, ly, 110, T_WARM, 0.26); glow(lx, ly, 34 + 30 * face, T_WH, 0.2 + 0.3 * face);
    snowGlass(t, cx, cy, z);
  }
  // snow falling past the panes (beyond the glass, in front of the storm)
  function snowGlass(t, cx, cy, z) {
    for (let k = 0; k < 70; k++) {
      const x = frac(ih(k, 1, 711) + t * 0.05 * (ih(k, 2, 711) - 0.3)) * 480, y = frac(ih(k, 3, 711) + t * (0.08 + ih(k, 4, 711) * 0.06)) * 180 - 222;
      const X = toSX(cx, z, x + Math.sin(t + k) * 4), Y = toSY(cy, z, y);
      if (Y < ROW0 || Y > ROW1 || X < 0 || X >= W) continue;
      const i = fl(Y) * W + fl(X), cur = BUF[i];
      if (cur >= 240 && cur <= 246 || cur === 241) BUF[i] = ih(k, 5, 711) < 0.3 ? 194 : 246;
    }
  }
  shot(30.0, 32.25, (lt, t) => f6Draw(t));
  shot(32.25, 34.2, (lt, t) => {
    if (t < 32.75) dip(() => f6Draw(Math.min(t, 32.4)), () => f6Out(t), (t - 32.25) / 0.5, T_WARM, 0.55);
    else f6Out(t);
  });
  shot(34.2, 36.0, (lt, t) => {
    if (t < 34.7) dip(() => f6Out(t), () => f6End(t), (t - 34.2) / 0.5);
    else f6End(t);
  });

  /* ================================================================ frame */
  let BUILT = false;
  function buildAll() { if (BUILT) return; BUILT = true; for (const f of BUILDERS) f(); }
  function render(t) {
    buildAll();
    t = clamp(t, 0, D - 1 / 30);
    T_NOW = t; BUF.fill(0); SHAD.length = 0; LAMP.on = 0; LAMP.zoom = 1; LAMP.h = 16; SPK.t = t;
    let S = SHOTS[0];
    for (const s of SHOTS) if (t >= s.t0) S = s;
    S.fn(t - S.t0, t);
    grade();
    letterbox(LB);
  }

  /* ================================================================ grade: light that spills, and a darkened edge
     Bloom: bright pixels (emitters) are gathered into a coarse grid, blurred, and spilled back over their neighbourhood as a
     tint of their own hue, only onto what is darker than the light itself. Vignette: the corners sink a little. */
  const GC = 4, GW = W / GC, GH = Math.ceil(H / GC), GR = new Float32Array(GW * GH), GG = new Float32Array(GW * GH), GB2 = new Float32Array(GW * GH), GT = new Float32Array(GW * GH), GTI = new Uint8Array(GW * GH);
  const LUMP = PAL.map((p) => p[0] * 0.3 + p[1] * 0.55 + p[2] * 0.15);
  const BLOOM_T = [[T_WH, [1, 1, 1]], [T_GOLD, [1, 0.75, 0.25]], [T_WARM, [1, 0.69, 0.38]], [T_LAMP, [1, 0.6, 0.25]], [T_CYAN, [0.38, 0.85, 1]], [T_BL, [0.25, 0.6, 0.95]], [T_GR, [0.31, 0.88, 0.56]]];
  const VIG = new Float32Array(NP);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2 - LB), r = Math.sqrt(dx * dx * 0.8 + dy * dy * 0.6); VIG[y * W + x] = 0.34 * sstep(0.6, 1.2, r); }
  let BLOOM_K = 1;
  function blur(A) {
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < GH; y++) { let acc = 0; const row = y * GW; for (let x = -3; x < GW + 3; x++) { if (x + 3 < GW) acc += A[row + x + 3]; if (x - 4 >= 0) acc -= A[row + x - 4]; if (x >= 0 && x < GW) GT[row + x] = acc / 7; } }
      for (let x = 0; x < GW; x++) { let acc = 0; for (let y = -3; y < GH + 3; y++) { if (y + 3 < GH) acc += GT[(y + 3) * GW + x]; if (y - 4 >= 0) acc -= GT[(y - 4) * GW + x]; if (y >= 0 && y < GH) A[y * GW + x] = acc / 7; } }
    }
  }
  function grade() {
    GR.fill(0); GG.fill(0); GB2.fill(0);
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
      const c = BUF[y * W + x], l = LUMP[c]; if (l < 170) continue;
      const k = (l - 170) / 85 / (GC * GC), p = PAL[c], j = fl(y / GC) * GW + fl(x / GC);
      GR[j] += p[0] / 255 * k; GG[j] += p[1] / 255 * k; GB2[j] += p[2] / 255 * k;
    }
    blur(GR); blur(GG); blur(GB2);
    for (let j = 0; j < GW * GH; j++) {
      const r = GR[j], g = GG[j], b = GB2[j], m = Math.max(r, g, b); GT[j] = m > 0.02 ? m : 0; if (m <= 0.02) continue;
      let best = 0, bd = 1e9;
      for (let k = 0; k < BLOOM_T.length; k++) { const q = BLOOM_T[k][1], d = (r / m - q[0]) ** 2 + (g / m - q[1]) ** 2 + (b / m - q[2]) ** 2; if (d < bd) { bd = d; best = k; } }
      GTI[j] = best;
    }
    for (let y = LB; y < H - LB; y++) {
      const gy = Math.min(GH - 1, fl(y / GC));
      for (let x = 0; x < W; x++) {
        const i = y * W + x, j = gy * GW + fl(x / GC), m = GT[j];
        if (m > 0 && LUMP[BUF[i]] < m * 255 * 2.2) tintI(i, x, y, BLOOM_T[GTI[j]][0], Math.min(0.45, m * 1.5) * 0.5 * BLOOM_K);
        if (VIG[i] > 0.01) tintI(i, x, y, T_DARK, VIG[i]);
      }
    }
  }

  /* ================================================================ present */
  const LE = new Uint8Array(new Uint32Array([0x01020304]).buffer)[0] === 0x04;
  const pack = (r, g, b) => (LE ? ((255 << 24) | (b << 16) | (g << 8) | r) : ((r << 24) | (g << 16) | (b << 8) | 255)) >>> 0;
  const LIVE = new Uint32Array(256);
  for (let i = 0; i < NPAL; i++) LIVE[i] = pack(PAL[i][0], PAL[i][1], PAL[i][2]);
  let SMALL = null, SG = null, IMG = null, PIX = null;
  function drawFrame(t, g, cw, ch, k, ox, oy) {
    render(t);
    if (!SMALL) {
      SMALL = document.createElement('canvas'); SMALL.width = W; SMALL.height = H;
      SG = SMALL.getContext('2d'); IMG = SG.createImageData(W, H); PIX = new Uint32Array(IMG.data.buffer);
    }
    for (let i = 0; i < NP; i++) PIX[i] = LIVE[BUF[i]];
    SG.putImageData(IMG, 0, 0);
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#04050b'; g.fillRect(0, 0, cw, ch);
    g.drawImage(SMALL, ox, oy, W * k, H * k);
  }

  /* ================================================================ mount */
  if (typeof window !== 'undefined') window.__foxcore = { render, BUF, PAL, W, H, D, SHAKE: () => [0, 0] };
  (window.PIECES = window.PIECES || []).push({
    id: 'the-lantern-fox',
    title: 'The Lantern Fox',
    medium: 'Pixel art, 480 × 270, drawn in JavaScript · 36 s',
    note: 'A Christmas short · tap to pause',
    about: 'Christmas Eve, blue dusk. A fox kit finds an old brass lantern still burning in the snow, and carries it in its mouth through the pine woods, across a frozen waterfall and an aurora meadow, to a lighthouse whose lamp has gone out, and a keeper who had given up waiting. Thirty-six seconds, every frame drawn as it plays: the lantern is a real moving light, and everything it passes is lit by it.',
    tone: 'dark',
    room: '#04050b',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0, ready = false;
      el.style.background = '#04050b';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;image-rendering:pixelated;image-rendering:crisp-edges;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(255,230,210,.8)"/><rect x="19" y="9" width="5" height="16" fill="rgba(255,230,210,.8)"/></svg>';
      el.appendChild(pauseMark);
      let K = 4, CW = W * 4, CH = H * 4;
      function layout() {
        const dpr = Math.min(3, window.devicePixelRatio || 1);
        let left = 0, top = 0, cssW, cssH;
        if (EXPORT) {
          cssW = 1920; cssH = 1080; cv.style.position = 'fixed';
          K = Math.max(1, Math.round(4 * dpr)); CW = Math.round(1920 * dpr); CH = Math.round(1080 * dpr);
        } else {
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          const fit = Math.min(w * dpr / W, h * dpr / H);
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
      const draw = (t) => drawFrame(t, g, CW, CH, K, 0, 0);
      layout();
      draw(0);
      ready = true;
      if (EXPORT) {
        const faded = () => { const st = el.parentElement; return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999; };
        window.__thefox = {
          duration: D,
          isReady: () => ready && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); draw(t); window.__thefox.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'the-lantern-fox';
        api.ready();
      } else {
        window.__thefox = { duration: D, isReady: () => ready, renderAt(t) { return new Promise((res) => { playing = false; clock = t; draw(t); requestAnimationFrame(() => res()); }); } };
        api.ready();
      }
      let hold = 0;
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        raf = requestAnimationFrame(frame);
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
        if (!playing) return;
        if (clock >= D) { hold += dt; if (hold < 2.0) return; hold = 0; clock = 0; }   // rest on the last frame, then again
        clock = Math.min(D, clock + dt);
        draw(Math.min(clock, D - 1 / 30));
      }
      if (!EXPORT) raf = requestAnimationFrame(frame);
      const onDown = () => { if (EXPORT) return; playing = !playing; last = 0; pauseMark.style.opacity = playing ? '0' : '1'; };
      cv.addEventListener('pointerdown', onDown);
      let rt = 0;
      const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (!alive) return; layout(); draw(Math.min(clock, D - 1 / 30)); }, 120); });
      ro.observe(el);
      return {
        destroy() {
          alive = false; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(rt);
          cv.removeEventListener('pointerdown', onDown);
          if (window.__thefox) delete window.__thefox;
        },
      };
    },
  });

})();
