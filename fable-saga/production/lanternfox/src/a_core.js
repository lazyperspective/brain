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

