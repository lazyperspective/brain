/* The Night Shift — piece 1.
 *
 * A 20-second seamless loop of real pixel art: a haunted mansion shown as a dollhouse cutaway, sixteen
 * rooms from a bat turret down to a crypt under the garden, everyone at a little routine until the
 * doorbell rings. Every frame is a pure function of t. The house is painted into a 360 × 450 art-pixel
 * buffer (palette index, light mode and room per pixel), lit room by room with stepped, ordered-dithered
 * light, quantised to a 40-colour palette and scaled up nearest-neighbour, with a hard cut to a 3x
 * close-up for the doorstep and a blackout that puts everyone back in their rooms.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const AW = 360, AH = 450, NP = AW * AH, D = 20;
  const TAU = Math.PI * 2;
  const fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const io = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let SEED = 7;
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(((c | 0) + SEED * 7919) | 0, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  const st10 = (t) => fl(t * 10 + 1e-6) / 10; // sprite clock, 10 fps

  /* ================================================================ palette (40) */
  const PAL_HEX = [
    '05060f', '0c1226', '15203f', '1f3160', '2e4a85', '4a6fae', '7fa0d4', 'c3d6f0', 'f2f6ff', // 0-8 moonlight
    '1a0f24', '2c1a3a', '45284f', '6a3f6e',                                                 // 9-12 purple shadow
    '2a0d16', '4a1424', '721e33', '9e2f42', 'c85a5a',                                       // 13-17 wine
    '3a1e10', '5e3418', '8c5426', 'c07a32', 'eaa646', 'ffd77a', 'fff4cc',                   // 18-24 wood / amber
    '12261c', '1f4a33', '3c7a4a', '6fbf5a', 'b8f08a',                                       // 25-29 gaslight green
    '5a5560', '8f8a8a', 'cfc6b4', 'f4ecd8',                                                 // 30-33 stone / bone
    '6b4a3a', 'a87454', 'e3b48e',                                                           // 34-36 fur / skin
    'e8741c', '7a3fb0', 'b07ad8',                                                           // 37-39 pumpkin, witch
  ];
  const PAL = PAL_HEX.map((h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
  const LUT = new Uint8Array(32768);
  function nearest(r, g, b) {
    let best = 0, bd = 1e18;
    for (let k = 0; k < PAL.length; k++) {
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
  const DARK = [], LITE = [];
  function buildMaps() {
    for (let k = 0; k < PAL.length; k++) {
      const p = PAL[k];
      let d = nearest(p[0] * 0.64, p[1] * 0.64, p[2] * 0.68); if (d === k) d = 0;
      DARK[k] = d;
      let l = nearest(p[0] * 1.25 + 18, p[1] * 1.25 + 18, p[2] * 1.2 + 18); if (l === k) l = 8;
      LITE[k] = l;
    }
  }
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bay = (x, y) => BAY[((y & 3) << 2) | (x & 3)];

  /* ================================================================ targets & pens */
  // light modes: 0 emissive, 1 lit by its room (per pixel, dithered), 2 sprite (uniform light slot), 3 always lit
  const ME = 0, MR = 1, MS = 2, MX = 3;
  function mkT(w, h, full) { return { w, h, c: new Uint8Array(w * h), m: new Uint8Array(w * h), r: full ? new Uint8Array(w * h) : null, x0: 0, y0: 0, x1: w, y1: h }; }
  let TG = null, PM = MR, PR = 0;
  const pen = (m, r) => { PM = m; if (r !== undefined) PR = r; };
  function put(x, y, col) {
    x = fl(x); y = fl(y);
    const T = TG;
    if (x < T.x0 || y < T.y0 || x >= T.x1 || y >= T.y1) return;
    const i = y * T.w + x;
    T.c[i] = col + 1; T.m[i] = PM; if (T.r) T.r[i] = PR;
  }
  const get = (x, y) => { x = fl(x); y = fl(y); if (x < 0 || y < 0 || x >= TG.w || y >= TG.h) return 0; return TG.c[y * TG.w + x]; };
  function rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c); }
  function hl(x0, x1, y, c) { for (let x = x0; x <= x1; x++) put(x, y, c); }
  function vl(x, y0, y1, c) { for (let y = y0; y <= y1; y++) put(x, y, c); }
  function line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      put(x0, y0, c);
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
        if (u * u + v * v <= 1) put(x, y, fn ? fn(x, y, u, v) : c);
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
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) put(x, y, fn ? fn(x, y) : c);
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

  /* ================================================================ 3x5 font */
  const F3 = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
    9: '111101111001110', ':': '000010000010000', '!': '010010010000010', '.': '000000000000010', ',': '000000000010100',
    '?': '110001010000010', "'": '010010000000000', '-': '000000111000000', ' ': '000000000000000',
  };
  function text(s, x, y, c, sh, sc) {
    sc = sc || 1;
    let cx = x;
    for (const ch of s) {
      const g = F3[ch] || F3[' '];
      for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === '1') {
        if (sh !== undefined) rect(cx + i * sc + 1, y + j * sc + 1, sc, sc, sh);
      }
      for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === '1') rect(cx + i * sc, y + j * sc, sc, sc, c);
      cx += 4 * sc;
    }
    return cx - x;
  }

  function textO(s, x, y, c, oc, sc) {
    // outlined lettering: draw the glyph mask fattened by one pixel in the outline colour first
    sc = sc || 1;
    let cx = x;
    for (const ch of s) {
      const g = F3[ch] || F3[' '];
      for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === '1') rect(cx + i * sc - 1, y + j * sc - 1, sc + 2, sc + 2, oc);
      cx += 4 * sc;
    }
    text(s, x, y, c, undefined, sc);
  }
  /* ================================================================ layout */
  // floors: y of the walking surface
  const F_ATT = 92, F4Y = 152, F3Y = 208, F2Y = 264, F1Y = 332, FCY = 392, GY = 338;
  const HX0 = 8, HX1 = 320, DOORX = 316;
  const MOONX = 326, MOONY = 44;
  const R_EXT = 0, R_ATT = 1, R_TUR = 2, R_VAMP = 3, R_LIB = 4, R_BATH = 5, R_WOLF = 6, R_FRANK = 7, R_ARM = 8,
    R_KIT = 9, R_CONS = 10, R_BALL = 11, R_PARL = 12, R_HALL = 13, R_CEL = 14, R_STR = 15, R_EARTH = 16, R_PORCH = 17, R_TOMB = 18;
  // rooms: id, rect (interior)
  const ROOMS = [
    [R_TUR, 12, 40, 56, 92],
    [R_VAMP, 12, 96, 92, 152], [R_LIB, 96, 96, 176, 152], [R_BATH, 180, 96, 262, 152],
    [R_WOLF, 12, 156, 86, 208], [R_FRANK, 90, 156, 180, 208], [R_ARM, 184, 156, 262, 208],
    [R_KIT, 12, 212, 112, 264], [R_CONS, 116, 212, 262, 264],
    [R_BALL, 12, 268, 176, 332], [R_PARL, 180, 268, 262, 332],
    [R_HALL, 266, 96, 316, 332], [R_CEL, 12, 336, 316, 392], [R_TOMB, 122, 406, 198, 436],
  ];
  const INTERIOR = new Uint8Array(32);
  for (const r of ROOMS) INTERIOR[r[0]] = 1;
  INTERIOR[R_ATT] = 1;
  const roofY = (x) => 14 + Math.abs(x - 190) / 138 * 78;
  function roomAt(x, y) {
    for (const r of ROOMS) if (x >= r[1] && x < r[3] && y >= r[2] && y < r[4]) return r[0];
    if (y < F_ATT && x >= 60 && x < 316 && y > roofY(x) + 5) return R_ATT;
    return R_EXT;
  }
  // lights per room: [x, y, radius, [r,g,b], intensity, flicker]
  const LIGHTS = {};
  const AMB = {};
  function setupLights() {
    AMB[R_EXT] = [0.42, 0.52, 0.86]; AMB[R_STR] = [0.62, 0.66, 0.9]; AMB[R_EARTH] = [0.38, 0.4, 0.62]; AMB[R_PORCH] = [0.42, 0.5, 0.82];
    AMB[R_ATT] = [0.26, 0.22, 0.36]; AMB[R_TUR] = [0.26, 0.28, 0.44]; AMB[R_VAMP] = [0.28, 0.18, 0.3]; AMB[R_LIB] = [0.24, 0.22, 0.26];
    AMB[R_BATH] = [0.2, 0.28, 0.3]; AMB[R_WOLF] = [0.3, 0.22, 0.32]; AMB[R_FRANK] = [0.2, 0.28, 0.28]; AMB[R_ARM] = [0.28, 0.22, 0.26];
    AMB[R_KIT] = [0.28, 0.2, 0.26]; AMB[R_CONS] = [0.26, 0.32, 0.48]; AMB[R_BALL] = [0.3, 0.2, 0.26]; AMB[R_PARL] = [0.26, 0.2, 0.26];
    AMB[R_HALL] = [0.22, 0.26, 0.28]; AMB[R_CEL] = [0.2, 0.16, 0.24]; AMB[R_TOMB] = [0.16, 0.14, 0.22];
    LIGHTS[R_TUR] = [[34, 58, 34, [0.55, 0.7, 1.0], 0.8, '']];
    LIGHTS[R_ATT] = [[182, 76, 58, [1.0, 0.72, 0.4], 1.1, 'candle'], [190, 34, 30, [0.5, 0.65, 1.0], 0.6, '']];
    LIGHTS[R_VAMP] = [[85, 122, 54, [1.0, 0.62, 0.38], 1.15, 'candle']];
    LIGHTS[R_LIB] = [[147, 122, 52, [1.0, 0.85, 0.5], 1.15, '']];
    LIGHTS[R_BATH] = [[229, 114, 62, [0.72, 1.0, 0.78], 0.85, 'gas']];
    LIGHTS[R_WOLF] = [[26, 168, 56, [1.0, 0.86, 0.55], 1.2, '']];
    LIGHTS[R_FRANK] = [[168, 168, 62, [0.5, 1.0, 0.72], 1.0, 'gas'], [134, 182, 40, [0.7, 0.9, 1.0], 0, 'arc']];
    LIGHTS[R_ARM] = [[229, 166, 54, [1.0, 0.66, 0.38], 1.15, 'candle']];
    LIGHTS[R_KIT] = [[32, 254, 52, [1.0, 0.55, 0.25], 1.3, 'fire'], [32, 240, 30, [0.5, 1.0, 0.4], 0.6, 'brew']];
    LIGHTS[R_CONS] = [[196, 226, 84, [0.55, 0.7, 1.0], 0.7, ''], [252, 238, 34, [1.0, 0.75, 0.45], 0.8, 'candle']];
    LIGHTS[R_BALL] = [[94, 279, 84, [1.0, 0.7, 0.42], 1.2, 'candle']];
    LIGHTS[R_PARL] = [[228, 322, 58, [1.0, 0.55, 0.25], 1.3, 'fire']];
    LIGHTS[R_HALL] = [[280, 112, 46, [0.55, 1.0, 0.6], 0.9, 'gas'], [269, 172, 46, [0.55, 1.0, 0.6], 0.9, 'gas'], [269, 228, 46, [0.55, 1.0, 0.6], 0.9, 'gas'],
      [269, 290, 56, [0.6, 1.0, 0.62], 1.0, 'gas'], [314, 316, 30, [1.0, 0.7, 0.4], 0.5, 'porch']];
    LIGHTS[R_CEL] = [[152, 380, 62, [1.0, 0.45, 0.22], 1.2, 'fire'], [40, 356, 36, [1.0, 0.8, 0.5], 0.6, 'candle'], [246, 364, 22, [0.5, 1.0, 0.45], 0.55, 'brew']];
    LIGHTS[R_TOMB] = [[190, 426, 34, [1.0, 0.7, 0.4], 1.1, 'candle']];
    LIGHTS[R_PORCH] = [[324, 288, 32, [1.0, 0.7, 0.38], 1.0, 'candle']];
  }

  /* ================================================================ buffers */
  const SC = mkT(AW, AH, true);
  const BS = mkT(AW, AH, true);
  const SL = new Uint8Array(NP);        // sprite light slot per pixel
  const SLOTS = [];                      // [r,g,b] per slot
  const OUT = new Uint8Array(NP);

  /* ================================================================ static house */
  const slab = (x0, x1, y) => { for (let x = x0; x <= x1; x++) for (let k = 0; k < 4; k++) put(x, y + k, k === 0 ? 32 : k === 3 ? 30 : 31); };
  const wall = (x, y0, y1) => { for (let y = y0; y < y1; y++) for (let k = 0; k < 4; k++) put(x + k, y, k === 0 ? 32 : k === 3 ? 30 : 31); };
  function buildBase() {
    TG = BS;
    // ---- sky
    pen(ME, R_EXT);
    for (let y = 0; y < GY; y++) for (let x = 0; x < AW; x++) {
      const b = bay(x, y);
      let c = y < 80 ? 1 : y < 190 ? (b < (y - 80) / 110 ? 2 : 1) : y < 300 ? (b < (y - 190) / 110 ? 3 : 2) : 3;
      const dm = Math.hypot(x + 0.5 - MOONX, y + 0.5 - MOONY);
      if (dm < 38) c = dm < 24 ? 4 : (b < (38 - dm) / 14 ? 4 : c);
      if (dm < 56 && dm >= 38 && b < (56 - dm) / 34) c = Math.max(c, 3);
      if (ih(x, y, 3) < 0.012 && dm > 20) c = ih(x, y, 4) < 0.3 ? 7 : 5;
      put(x, y, c);
    }
    ell(MOONX, MOONY, 14, 14, 7); ell(MOONX - 1, MOONY - 1, 12.5, 12.5, 8);
    for (const [dx, dy, r] of [[-5, -4, 2.5], [4, 4, 3], [-2, 6, 1.6], [6, -6, 1.8], [-7, 3, 1.4]]) ell(MOONX + dx, MOONY + dy, r, r, 7);
    for (const [cx, cy, w] of [[302, 66, 28], [348, 74, 20], [24, 14, 30], [112, 8, 22], [336, 150, 26]]) {
      for (let k = 0; k < w; k++) { const x = cx - w / 2 + k, h = Math.round(Math.sin(k / w * Math.PI) * 3); for (let y = 0; y <= h; y++) put(x, cy - y, y === h ? 5 : 4); }
    }
    // a far hill behind the porch, with a little chapel and one lit window
    for (let x = 320; x < AW; x++) { const hy = Math.round(306 + 5 * Math.sin(x / 11) + (x - 320) * 0.15); for (let y = hy; y < GY; y++) put(x, y, y === hy ? 3 : 2); }
    rect(352, 307, 6, 8, 1); poly([[351, 307], [355, 302], [359, 307]], 1); vl(355, 297, 302, 1); hl(354, 356, 299, 1); put(354, 310, 23);
    // ---- earth
    pen(MR, R_EARTH);
    for (let y = GY; y < AH; y++) for (let x = 0; x < AW; x++) {
      let c = y < GY + 3 ? (y === GY ? 27 : 26) : 19;
      if (y >= GY + 3) {
        if (ih(x >> 1, y >> 1, 7) < 0.08) c = 18;
        if (ih(x, y, 8) < 0.03) c = 20;
        if (y > 412 && ih(x >> 2, y >> 2, 9) < 0.06) c = 30;
        if (y >= 438 && bay(x, y) < (y - 438) / 14) c = 18;
      }
      put(x, y, c);
    }
    for (let x = 0; x < AW; x += 2) if (ih(x, 1, 10) < 0.5) put(x, GY - 1, 27);
    buildUnderground();
    // ---- structure (cut sections), lit cold by the moon
    pen(MR, R_STR);
    // chimney with two pots
    rect(240, 24, 12, 30, 15); for (let y = 24; y < 54; y += 3) hl(240, 251, y, 14); for (let y = 25; y < 54; y += 6) { put(245, y + 1, 14); put(248, y + 4, 14); }
    rect(238, 22, 16, 3, 30); hl(238, 253, 22, 31); rect(241, 17, 3, 5, 19); rect(247, 18, 3, 4, 19); hl(241, 243, 17, 20);
    // the gable: slate roof slab
    for (let x = 56; x < 332; x++) {
      const yr = Math.round(roofY(x));
      for (let y = yr - 3; y < yr + 4; y++) {
        if (y > 95) continue;
        const row = y - yr + 3;
        put(x, y, row === 0 ? 12 : row === 6 ? 9 : ((x + row * 3) % 6 === 0 ? 9 : (row & 1 ? 10 : 11)));
      }
    }
    // finial and a bat weather vane
    vl(190, 4, 10, 31); put(190, 3, 32); spr(['o.....o', 'oo.o.oo', '.ooooo.', '..o.o..'], { o: 1 }, 192, 0);
    // the turret: walls, cornice, a fish-scale cone and a pennant
    wall(HX0, 36, 92); wall(56, 36, 92);
    for (let x = 6; x < 62; x++) { put(x, 36, 32); put(x, 37, 31); put(x, 38, 30); if (x % 3 === 0) put(x, 39, 30); }
    poly([[4, 36], [34, 3], [64, 36]], 10, (x, y) => {
      const row = fl((y - 3) / 3), u = (((x + (row & 1) * 2) % 4) + 4) % 4;
      if ((y - 3) % 3 === 2 && u !== 1) return 9;
      return x > 36 ? 11 : 10;
    });
    vl(34, 0, 3, 31); put(35, 0, 16); put(36, 0, 16); put(37, 1, 16); put(35, 1, 16);
    // floors and walls
    slab(HX0, HX1 - 1, F_ATT); slab(HX0, HX1 - 1, F4Y); slab(HX0, HX1 - 1, F3Y); slab(HX0, HX1 - 1, F2Y); slab(HX0 - 2, HX1 + 1, F1Y); slab(HX0, HX1 - 1, FCY);
    wall(HX0, 96, 332); wall(HX1 - 4, 96, 332); wall(HX0, 336, 392); wall(HX1 - 4, 336, 392);
    for (const [x, y0, y1] of [[92, 96, 152], [176, 96, 152], [86, 156, 208], [180, 156, 208], [112, 212, 264], [176, 268, 332],
      [262, 96, 152], [262, 156, 208], [262, 212, 264], [262, 268, 332]]) wall(x, y0, y1);
    // ---- rooms
    buildTurret(); buildAttic(); buildVamp(); buildLib(); buildBath(); buildWolf(); buildFrank(); buildArm();
    buildKitchen(); buildCons(); buildBall(); buildParl(); buildHall(); buildCellar(); buildTomb();
    // doorways in the partitions (cut openings with frames)
    const doorway = (x, yFloor, room) => {
      pen(MR, room);
      for (let y = yFloor - 28; y < yFloor; y++) for (let k = 0; k < 4; k++) put(x + k, y, 10);
      pen(MR, R_STR);
      hl(x - 1, x + 4, yFloor - 29, 20); hl(x - 1, x + 4, yFloor - 30, 21);
    };
    doorway(92, F4Y, R_VAMP); doorway(176, F4Y, R_LIB); doorway(262, F4Y, R_BATH);
    doorway(86, F3Y, R_WOLF); doorway(180, F3Y, R_FRANK); doorway(262, F3Y, R_ARM);
    doorway(112, F2Y, R_KIT); doorway(262, F2Y, R_CONS);
    doorway(176, F1Y, R_BALL); doorway(262, F1Y, R_PARL);
    // the front door opening in the right wall (the door itself is drawn live)
    pen(ME, R_EXT); for (let y = F1Y - 32; y < F1Y; y++) for (let k = 0; k < 4; k++) put(HX1 - 4 + k, y, 1);
    // scalloped barge boards under the eaves
    pen(MR, R_STR);
    for (let x = 58; x < 332; x++) {
      const yb = Math.round(roofY(x)) + 4; if (yb > 91) continue;
      put(x, yb, 20); if ((x & 3) !== 0) put(x, yb + 1, 20); if ((x & 3) === 2) put(x, yb + 2, 21);
    }
    buildPorch();
  }

  function wallpaper(x0, y0, x1, y1, room, base, pat, kind) {
    pen(MR, room);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      let c = base;
      if (kind === 'damask') { const u = (x - x0) % 8, v = (y - y0) % 10; if ((u === 4 && (v === 2 || v === 6)) || ((u === 3 || u === 5) && v === 4) || (u === 0 && v === 8)) c = pat; }
      else if (kind === 'stripe') { if ((x - x0) % 6 < 2) c = pat; }
      else if (kind === 'grid') { if ((x - x0) % 4 === 0 || (y - y0) % 4 === 0) c = pat; }
      else if (kind === 'tile') { const u = (x - x0) >> 2, v = (y - y0) >> 2; c = (u + v) & 1 ? base : pat; }
      else if (kind === 'brick') { const row = (y - y0) >> 2, off = (row & 1) * 4; if ((y - y0) % 4 === 3 || (x - x0 + off) % 8 === 7) c = pat; }
      else if (kind === 'plank') { if ((x - x0) % 7 === 0) c = pat; else if (ih(x >> 1, y >> 2, 5) < 0.05) c = pat; }
      else if (kind === 'stone') { const row = fl((y - y0) / 5), off = (row & 1) * 5; if ((y - y0) % 5 === 4 || (x - x0 + off) % 10 === 9) c = pat; }
      else if (kind === 'diamond') { const u = (x - x0) % 8, v = (y - y0) % 8; if (Math.abs(u - 4) + Math.abs(v - 4) === 3) c = pat; }
      put(x, y, c);
    }
  }
  function floorBoards(x0, x1, y, room, a, b) { pen(MR, room); for (let x = x0; x < x1; x++) { put(x, y - 1, (x % 9 === 0) ? b : a); } }
  function wainscot(x0, x1, yTop, yBot, room, a, b, rail) {
    pen(MR, room);
    for (let y = yTop; y < yBot; y++) for (let x = x0; x < x1; x++) put(x, y, (x - x0) % 10 === 0 ? b : a);
    hl(x0, x1 - 1, yTop, rail); hl(x0, x1 - 1, yTop + 1, b);
  }
  function crown(x0, x1, y, room, a, b) { pen(MR, room); hl(x0, x1 - 1, y, a); hl(x0, x1 - 1, y + 1, b); for (let x = x0; x < x1; x += 3) put(x, y + 2, b); }
  function frame(x, y, w, h, fc, inner) { rect(x, y, w, h, fc); hl(x, x + w - 1, y, LITE[fc]); rect(x + 1, y + 1, w - 2, h - 2, inner); }
  // a window in a back wall: the night sky in it is emissive
  function nightWindow(x, y, w, h, room, drape) {
    pen(MR, room); rect(x - 1, y - 1, w + 2, h + 2, 21);
    pen(ME, room);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let c = bay(x + i, y + j) < j / h ? 3 : 2;
      if (ih(x + i, y + j, 71) < 0.035) c = 6;
      put(x + i, y + j, c);
    }
    pen(MR, room); vl(x + (w >> 1), y, y + h - 1, 20); hl(x, x + w - 1, y + (h >> 1), 20);
    hl(x - 2, x + w + 1, y + h + 1, 22); hl(x - 2, x + w + 1, y + h + 2, 20);
    if (drape !== undefined) {
      const dd = DARK[drape];
      for (let j = -3; j < h + 3; j++) { const sw = j < 2 ? 3 : Math.max(2, 3 - fl(j / 10)); for (let i = 0; i < sw; i++) { put(x - 2 - i, y + j, i === 1 ? dd : drape); put(x + w + 1 + i, y + j, i === 1 ? dd : drape); } }
      hl(x - 5, x + w + 4, y - 3, LITE[drape]); hl(x - 5, x + w + 4, y - 2, drape);
    }
  }
  function bookshelf(x0, y0, w, h, room) {
    pen(MR, room);
    rect(x0, y0, w, h, 19); rect(x0 + 1, y0 + 1, w - 2, h - 2, 9); hl(x0, x0 + w - 1, y0, 21);
    const BC = [15, 16, 4, 26, 27, 21, 38, 11, 17, 3, 20, 13];
    for (let sy = y0 + 1; sy + 9 < y0 + h; sy += 10) {
      hl(x0 + 1, x0 + w - 2, sy + 9, 20);
      let x = x0 + 1;
      while (x < x0 + w - 1) {
        if (ih(x, sy, 54) < 0.07) { x += 1 + fl(ih(x, sy, 55) * 2); continue; }
        const bw = ih(x, sy, 51) < 0.3 ? 2 : 1, bh = 5 + fl(ih(x, sy, 52) * 4);
        const c = BC[fl(ih(x, sy, 53) * BC.length)];
        const ww = Math.min(bw, x0 + w - 1 - x);
        rect(x, sy + 9 - bh, ww, bh, c);
        if (bh > 6) put(x, sy + 10 - bh, LITE[c]);
        if (bh > 7 && ih(x, sy, 56) < 0.5) put(x, sy + 9 - fl(bh / 2), 22);
        x += ww;
      }
    }
  }
  function cobweb(x, y, dx, dy, s) {
    for (let k = 0; k <= 2; k++) line(x, y, x + dx * s * (k === 1 ? 0.8 : 1) * (k === 2 ? 0.3 : 1), y + dy * s * (k === 0 ? 0.3 : k === 1 ? 0.8 : 1), 31);
    for (let r = 2; r < s; r += 3) line(x + dx * r, y + dy * r * 0.3, x + dx * r * 0.3, y + dy * r, 31);
  }
  // portraits whose eyes follow the action: registry for the live pass
  const PORTRAITS = [];
  function portrait(x, y, w, h, room, kind) {
    pen(MR, room);
    frame(x, y, w, h, 21, 13);
    const cx = x + w / 2;
    if (kind === 'lady') { ell(cx, y + h * 0.62, w * 0.3, h * 0.42, 11); ell(cx, y + h * 0.4, w * 0.2, h * 0.2, 31); rect(fl(cx - w * 0.24), y + 2, fl(w * 0.48), 3, 1); }
    else if (kind === 'count') { poly([[x + 2, y + h - 1], [cx, y + h * 0.5], [x + w - 2, y + h - 1]], 1); ell(cx, y + h * 0.42, w * 0.2, h * 0.22, 7); rect(fl(cx - w * 0.2), y + 2, fl(w * 0.4) + 1, 3, 0); }
    else if (kind === 'wolf') { ell(cx, y + h * 0.66, w * 0.32, h * 0.36, 34); ell(cx, y + h * 0.42, w * 0.24, h * 0.24, 35); put(cx - 3, y + 2, 34); put(cx + 2, y + 2, 34); put(cx - 3, y + 3, 34); put(cx + 2, y + 3, 34); }
    else { ell(cx, y + h * 0.66, w * 0.32, h * 0.38, 26); ell(cx, y + h * 0.4, w * 0.22, h * 0.24, 35); put(cx - 3, y + 2, 34); put(cx + 2, y + 2, 34); }
    PORTRAITS.push({ x: Math.round(cx) - 2, y: Math.round(y + h * 0.4), room });
  }

  function buildUnderground() {
    pen(MR, R_EARTH);
    // roots, rocks, a worm, a fossil, a lost treasure chest, a mole in his tunnel and a pumpkin someone buried
    line(30, 398, 20, 420, 18); line(20, 420, 12, 432, 18); line(250, 398, 262, 414, 18); line(262, 414, 266, 432, 18); line(212, 398, 206, 410, 18);
    for (let x = 96; x < 104; x++) put(x, 424 + Math.round(Math.sin(x * 1.3)), 17); put(103, 423, 17);
    for (const [rx, ry, rr] of [[40, 408, 3], [104, 442, 4], [236, 410, 3], [214, 444, 2.5], [306, 430, 3.5], [8, 436, 3], [70, 444, 3], [350, 420, 3], [340, 444, 2.5]]) { ell(rx, ry, rr, rr * 0.7, 30); put(rx - 1, ry - 1, 31); }
    // fossil
    ell(276, 440, 8, 3.5, 32); ell(271, 439, 1.8, 1.3, 18); hl(268, 283, 442, 31); for (let x = 276; x < 284; x += 2) put(x, 443, 33);
    for (let k = 0; k < 6; k++) rect(262 - k * 5, 439 + (k & 1), 3, 2, 32);
    // treasure chest
    rect(48, 424, 14, 9, 20); hl(48, 61, 424, 22); hl(48, 61, 427, 18); put(54, 428, 23); put(55, 428, 23); put(63, 432, 23); put(45, 433, 23); put(65, 431, 22);
    // the mole's tunnel under the porch
    for (let k = 0; k < 34; k++) { const x = 322 + k, y = 362 + Math.round(Math.sin(k / 5) * 3); vl(x, y, y + 3, 18); }
    ell(350, 364, 4, 3, 34); put(354, 364, 17); put(352, 363, 0); put(347, 367, 36); put(352, 367, 36);
    ell(334, 404, 4, 3.4, 37); put(334, 400, 27); put(332, 403, 20); put(336, 403, 20);
  }

  function buildTurret() {
    wallpaper(12, 40, 56, 92, R_TUR, 30, 10, 'stone');
    pen(ME, R_TUR);
    ell(34, 60, 8, 8, 21); ell(34, 60, 6.5, 6.5, 3); ell(36, 58, 3, 3, 6); put(31, 63, 6);
    pen(MR, R_TUR); vl(34, 53, 67, 20); hl(27, 41, 60, 20);
    // perch beam for the bats
    hl(13, 55, 46, 20); hl(13, 55, 47, 19);
    // a telescope on a tripod, aimed at the window
    line(44, 91, 48, 79, 20); line(52, 91, 48, 79, 20); line(48, 91, 48, 79, 19);
    line(48, 78, 41, 68, 31); line(49, 78, 42, 68, 30); line(47, 78, 40, 69, 32); rect(48, 77, 3, 3, 21);
    // guano, a skull, a crate
    for (let x = 16; x < 40; x++) if (ih(x, 1, 41) < 0.6) { put(x, 91, 31); if (ih(x, 2, 41) < 0.3) put(x, 90, 32); }
    ell(24, 89, 2.5, 2, 33); put(23, 89, 0); put(25, 89, 0);
    rect(13, 80, 10, 11, 20); hl(13, 22, 80, 21); line(13, 80, 22, 90, 19); line(22, 80, 13, 90, 19);
    cobweb(13, 48, 1, 1, 6); cobweb(55, 48, -1, 1, 5);
  }
  function buildAttic() {
    pen(MR, R_ATT);
    for (let y = 10; y < F_ATT; y++) for (let x = 60; x < 316; x++) {
      if (y < roofY(x) + 5) continue;
      let c = (x % 8 === 0) ? 18 : 19;
      if (ih(x >> 1, y >> 2, 21) < 0.05) c = 18;
      put(x, y, c);
    }
    // rafters & collar beam
    for (const x of [100, 138, 240, 278]) for (let y = Math.round(roofY(x) + 5); y < F_ATT; y++) { put(x, y, 20); put(x + 1, y, 20); put(x + 2, y, 18); }
    hl(146, 234, 46, 20); hl(146, 234, 47, 18);
    // round gable window
    pen(ME, R_ATT); ell(190, 32, 7, 7, 21); ell(190, 32, 5.5, 5.5, 3); ell(192, 30, 2.6, 2.6, 7); pen(MR, R_ATT); vl(190, 26, 38, 20); hl(184, 196, 32, 20);
    // a rocking horse, a trunk, a dress form, a stack of portraits, hat boxes
    ell(112, 82, 7, 3, 21); rect(106, 81, 12, 3, 21); ell(119, 78, 2.6, 2.4, 21); put(120, 76, 20); put(121, 78, 0); hl(105, 108, 80, 20);
    line(107, 84, 104, 89, 20); line(117, 84, 120, 89, 20); for (let x = 100; x < 125; x++) put(x, 90 - Math.round(((x - 112) / 12) * ((x - 112) / 12) * 2), 18);
    rect(126, 80, 18, 12, 19); hl(126, 143, 80, 21); rect(126, 84, 18, 1, 18); put(134, 86, 22); put(135, 86, 22); rect(126, 80, 2, 12, 20); rect(142, 80, 2, 12, 20);
    ell(152, 74, 4.5, 7, 15); rect(151, 66, 2, 3, 31); vl(152, 81, 91, 18); hl(149, 155, 91, 18); put(150, 72, 16); put(154, 75, 16);
    // the tea table
    rect(164, 81, 36, 3, 20); hl(164, 199, 81, 21); rect(166, 84, 2, 8, 18); rect(196, 84, 2, 8, 18);
    for (let x = 166; x < 199; x += 2) put(x, 84, 32);
    rect(165, 78, 3, 3, 33); put(168, 79, 33); hl(164, 168, 80, 32);
    rect(189, 78, 3, 3, 33); put(192, 79, 33); hl(188, 192, 80, 32);
    ell(180, 80, 3.5, 1, 32); put(178, 79, 21); put(180, 79, 21); put(182, 79, 20);
    rect(181, 74, 2, 4, 33); // the candle (flame live)
    rect(252, 72, 12, 20, 18); rect(253, 73, 10, 18, 11); rect(255, 76, 6, 6, 31); rect(258, 70, 9, 22, 19); rect(259, 72, 7, 8, 13);
    rect(270, 82, 10, 10, 38); hl(270, 279, 82, 39); rect(271, 76, 8, 6, 16); hl(271, 278, 76, 17); hl(270, 279, 86, 22);
    // the hatch in the floor above the stairwell
    rect(268, 92, 10, 1, 18);
    cobweb(62, Math.round(roofY(62)) + 6, 1, 1, 6); cobweb(312, Math.round(roofY(312)) + 5, -1, 1, 4);
    cobweb(146, 48, 1, 1, 5); cobweb(233, 48, -1, 1, 5);
  }
  function buildVamp() {
    wallpaper(12, 96, 92, 152, R_VAMP, 15, 16, 'damask');
    wainscot(12, 92, 138, 152, R_VAMP, 13, 14, 21);
    crown(12, 92, 96, R_VAMP, 21, 13);
    floorBoards(12, 92, 152, R_VAMP, 14, 13);
    pen(MR, R_VAMP);
    // a tall window with heavy drapes
    nightWindow(45, 106, 10, 22, R_VAMP, 16);
    poly([[44, 106], [50, 100], [56, 106]], 21); poly([[46, 106], [50, 102], [54, 106]], 2);
    // an upright coffin with its lid leaning beside it
    poly([[14, 120], [18, 116], [26, 116], [30, 120], [28, 152], [16, 152]], 13);
    poly([[15.5, 121], [18.5, 118], [25.5, 118], [28.5, 121], [27, 151], [17, 151]], 16, (x) => (x < 19 ? 15 : 16));
    for (let y = 122; y < 150; y += 4) hl(19, 25, y, 17);
    poly([[31, 121], [34, 117], [38, 117], [41, 121], [40, 152], [32, 152]], 18); vl(36, 126, 140, 21); hl(33, 39, 131, 21);
    portrait(16, 100, 12, 14, R_VAMP, 'count');
    // standing mirror (the glass is drawn live)
    rect(64, 118, 16, 34, 21); hl(64, 79, 118, 23); rect(65, 119, 14, 30, 18); put(71, 116, 22); put(72, 116, 22); put(71, 117, 21); put(72, 117, 21);
    rect(66, 150, 2, 2, 20); rect(76, 150, 2, 2, 20);
    // side table + candelabra
    rect(82, 134, 7, 2, 20); rect(84, 136, 3, 16, 19);
    vl(85, 126, 133, 21); hl(82, 88, 128, 21); vl(82, 124, 128, 21); vl(88, 124, 128, 21);
    // a garlic wreath (ironic) and a bat-shaped clock
    ell(85, 106, 3, 3, 32); ell(85, 106, 1.5, 1.5, 15);
    spr(['o.....o', 'oo.o.oo', '.ooooo.', '..o.o..'], { o: 1 }, 59, 101); put(62, 102, 22);
    // rug
    for (let x = 36; x < 66; x++) put(x, 151, (x & 1) ? 16 : 13);
  }
  function buildLib() {
    wallpaper(96, 96, 176, 152, R_LIB, 25, 26, 'stripe');
    crown(96, 176, 96, R_LIB, 21, 20);
    floorBoards(96, 176, 152, R_LIB, 19, 18);
    bookshelf(98, 100, 25, 52, R_LIB); bookshelf(150, 100, 25, 52, R_LIB);
    pen(MR, R_LIB);
    // the rolling ladder
    line(153, 101, 160, 151, 21); line(157, 101, 164, 151, 21); for (let k = 1; k < 10; k++) { const y = 101 + k * 5; hl(153 + Math.round(k * 0.7), 157 + Math.round(k * 0.7), y, 20); }
    hl(150, 174, 100, 31);
    // a map of the house over the chair
    rect(126, 102, 18, 12, 32); rect(127, 103, 16, 10, 33); poly([[128, 112], [134, 105], [140, 112]], 31); hl(129, 139, 108, 30); vl(134, 106, 111, 30);
    // the wing-back armchair (the reader is drawn live)
    rect(124, 118, 5, 27, 16); rect(127, 120, 3, 9, 15); rect(124, 140, 18, 5, 16); hl(125, 141, 140, 17); rect(138, 132, 4, 8, 15); hl(138, 141, 132, 17);
    rect(125, 145, 2, 7, 19); rect(139, 145, 2, 7, 19);
    // reading lamp with a green shade and a little table
    vl(147, 124, 151, 31); hl(144, 150, 151, 31); poly([[144, 122], [150, 122], [151, 125], [143, 125]], 26);
    rect(141, 141, 6, 2, 20); rect(143, 143, 2, 9, 19);
    // a globe and a skull bookend
    ell(167, 140, 4, 4, 5, (x, y) => (ih(x, y, 91) < 0.4 ? 27 : 5)); vl(167, 144, 151, 21); hl(164, 170, 151, 21); line(163, 136, 171, 144, 21);
    ell(121, 148, 2.4, 2, 33); put(120, 148, 0); put(122, 148, 0);
    for (let x = 104; x < 172; x++) put(x, 151, (x & 3) ? 15 : 22);
  }
  function buildBath() {
    wallpaper(180, 96, 262, 132, R_BATH, 26, 27, 'stripe');
    wallpaper(180, 132, 262, 152, R_BATH, 32, 31, 'grid');
    crown(180, 262, 96, R_BATH, 31, 26);
    pen(MR, R_BATH); hl(180, 261, 132, 33); hl(180, 261, 133, 31);
    // clawfoot tub with bubbles and a duck
    for (let y = 139; y < 149; y++) { const ins = y < 142 ? 0 : Math.round(Math.pow((y - 141) / 7, 2) * 4); hl(184 + ins, 212 - ins, y, y === 139 ? 33 : y === 140 ? 31 : (y > 145 ? 31 : 32)); put(184 + ins, y, 31); }
    hl(185, 211, 138, 33);
    rect(186, 148, 2, 4, 22); rect(208, 148, 2, 4, 22); put(185, 151, 22); put(210, 151, 22);
    for (let k = 0; k < 8; k++) ell(187 + k * 3.2, 136.5 - (k % 3 === 1 ? 1 : 0), 1.8, 1.5, 8);
    ell(204, 135, 2, 1.5, 22); put(205, 133, 22); put(206, 133, 22); put(207, 133, 37); put(205, 132, 0);
    // shower ring and a curtain pulled back
    hl(183, 213, 110, 31); for (let y = 111; y < 137; y++) for (let x = 183; x < 189; x++) put(x, y, (x + (y >> 2)) % 3 === 0 ? 27 : 28);
    // a toilet with a high tank, and its roll of paper (the mummy's favourite)
    rect(216, 116, 9, 7, 33); hl(216, 224, 116, 8); vl(218, 123, 137, 31); put(223, 118, 31);
    rect(215, 137, 12, 2, 32); rect(216, 139, 10, 3, 33); rect(218, 142, 6, 10, 32);
    rect(229, 130, 3, 4, 33); put(229, 129, 31); put(231, 129, 31);
    // pedestal sink, mirror and toothbrush cup
    rect(240, 132, 14, 3, 33); rect(245, 135, 4, 17, 32); hl(240, 253, 132, 8);
    rect(241, 112, 12, 14, 21); rect(242, 113, 10, 12, 4); put(244, 115, 6); put(245, 116, 6);
    rect(250, 129, 2, 3, 6); put(250, 128, 17); put(251, 127, 28);
    // gaslight sconce (flame live), towel rail
    rect(228, 117, 3, 4, 21); put(229, 116, 31);
    hl(255, 261, 112, 31); rect(256, 113, 5, 11, 16); hl(256, 260, 119, 33);
    floorBoards(180, 262, 152, R_BATH, 31, 30);
    for (let x = 214; x < 228; x++) put(x, 151, (x & 1) ? 38 : 39);
  }
  function buildWolf() {
    wallpaper(12, 156, 86, 208, R_WOLF, 11, 12, 'stripe');
    wainscot(12, 86, 194, 208, R_WOLF, 10, 9, 20);
    crown(12, 86, 156, R_WOLF, 21, 10);
    floorBoards(12, 86, 208, R_WOLF, 19, 18);
    pen(MR, R_WOLF);
    // vanity table with a bulb-ringed mirror (bulbs live)
    rect(15, 188, 22, 3, 20); hl(15, 36, 188, 22); rect(16, 191, 3, 17, 19); rect(33, 191, 3, 17, 19); rect(20, 191, 12, 5, 19); put(25, 193, 22);
    rect(17, 168, 18, 19, 21); rect(19, 170, 14, 15, 4); put(21, 172, 6); put(22, 173, 6); put(23, 174, 6);
    rect(20, 184, 2, 4, 28); rect(23, 183, 2, 5, 38); rect(26, 185, 3, 3, 17); hl(29, 33, 187, 20);
    // full-moon calendar and a portrait of himself as a puppy
    rect(56, 166, 14, 16, 33); hl(56, 69, 166, 16); ell(63, 173, 3.5, 3.5, 22); for (let k = 0; k < 4; k++) hl(58, 67, 178 + k, k & 1 ? 33 : 31);
    portrait(42, 162, 10, 12, R_WOLF, 'wolf');
    // stool
    rect(40, 200, 12, 2, 16); rect(41, 202, 2, 6, 18); rect(49, 202, 2, 6, 18);
    // coat stand with a fur stole, a chewed slipper and a bone
    vl(79, 168, 207, 20); hl(76, 82, 207, 20); hl(76, 82, 168, 21); put(76, 169, 21); put(82, 169, 21);
    rect(77, 170, 5, 12, 35); for (let y = 171; y < 182; y += 2) put(77 + (y & 2 ? 1 : 3), y, 34); hl(76, 82, 182, 36);
    rect(64, 205, 6, 2, 16); put(69, 204, 16); put(66, 205, 13);
    hl(56, 61, 206, 33); put(55, 205, 33); put(55, 207, 33); put(62, 205, 33); put(62, 207, 33);
    for (let x = 22; x < 64; x++) put(x, 207, (x & 2) ? 38 : 11);
  }
  function buildFrank() {
    wallpaper(90, 156, 180, 208, R_FRANK, 30, 2, 'stone');
    floorBoards(90, 180, 208, R_FRANK, 30, 2);
    pen(MR, R_FRANK);
    // big knife switch on the wall
    rect(98, 164, 8, 12, 19); rect(99, 165, 6, 10, 2); vl(100, 166, 173, 31); vl(103, 166, 173, 31); line(101, 173, 105, 162, 32); put(106, 161, 16);
    // pipes, gauges, a valve wheel
    hl(90, 179, 160, 31); hl(90, 179, 161, 30); ell(116, 167, 3, 3, 32); put(116, 167, 16); put(117, 166, 0);
    ell(124, 167, 2.5, 2.5, 32); put(124, 167, 0); put(125, 166, 0); vl(121, 162, 164, 31);
    ell(176, 172, 3, 3, 16); hl(173, 179, 172, 17); vl(176, 169, 175, 17); vl(176, 162, 168, 31);
    // a chalkboard of very important sums
    rect(130, 163, 22, 13, 19); rect(131, 164, 20, 11, 25);
    for (let k = 0; k < 4; k++) for (let i = 0; i < 16; i++) if (ih(i, k, 93) < 0.6) put(133 + i, 166 + k * 2, 32);
    // tesla lamp (the coil glow is live)
    rect(164, 198, 8, 10, 19); rect(166, 182, 4, 16, 31); ell(168, 180, 4, 3, 21);
    // ironing board
    poly([[106, 188], [150, 188], [152, 190], [106, 190]], 33); hl(106, 151, 190, 31);
    line(114, 190, 136, 208, 31); line(136, 190, 114, 208, 31);
    // the suit rack
    vl(173, 168, 194, 31); hl(169, 179, 168, 31); put(174, 167, 31);
    rect(171, 172, 7, 16, 2); vl(174, 178, 188, 1);
    // laundry basket
    rect(93, 198, 11, 10, 20); for (let x = 93; x < 104; x += 2) vl(x, 199, 207, 19); rect(94, 195, 9, 3, 16);
    // cables from the lightning rod above
    line(156, 156, 158, 168, 1); line(158, 168, 166, 181, 1);
  }
  function buildArm() {
    wallpaper(184, 156, 262, 208, R_ARM, 19, 18, 'plank');
    crown(184, 262, 156, R_ARM, 21, 18);
    floorBoards(184, 262, 208, R_ARM, 30, 31);
    pen(MR, R_ARM);
    // banners
    for (const bx of [196, 246]) {
      hl(bx - 1, bx + 9, 160, 21);
      for (let y = 161; y < 184; y++) for (let x = bx; x < bx + 9; x++) { if (y > 180 && Math.abs(x - bx - 4) < y - 180) continue; put(x, y, x === bx || x === bx + 8 ? 17 : 16); }
      vl(bx + 4, 165, 175, 22); hl(bx + 2, bx + 6, 168, 22);
    }
    // crossed swords and a shield
    line(212, 162, 230, 180, 32); line(230, 162, 212, 180, 32); hl(211, 215, 165, 22); hl(227, 231, 165, 22);
    ell(221, 171, 4.5, 5, 21); ell(221, 171, 3.4, 4, 16); vl(221, 167, 175, 22); hl(218, 224, 171, 22);
    // a suit of armour on a stand (just for show)
    ell(189, 172, 2.6, 3, 31); hl(188, 191, 172, 0); rect(186, 175, 7, 9, 31); vl(189, 175, 183, 32); rect(186, 184, 2, 10, 30); rect(191, 184, 2, 10, 30); hl(185, 194, 207, 19); vl(189, 194, 206, 19);
    // spear rack
    for (const x of [252, 255, 258]) { vl(x, 170, 206, 20); put(x, 169, 32); put(x, 168, 32); put(x - 1, 170, 32); put(x + 1, 170, 32); }
    hl(250, 260, 196, 19);
    // the table with a velvet cushion (the head is drawn live)
    rect(202, 196, 22, 2, 20); hl(202, 223, 196, 21); rect(204, 198, 2, 10, 19); rect(220, 198, 2, 10, 19);
    rect(206, 193, 14, 3, 16); hl(206, 219, 193, 17); put(205, 194, 22); put(220, 194, 22);
    // candle sconce
    rect(228, 168, 3, 3, 21); rect(229, 165, 1, 3, 33);
    for (let x = 196; x < 244; x++) put(x, 207, (x & 3) ? 16 : 22);
  }
  function buildKitchen() {
    wallpaper(12, 212, 112, 264, R_KIT, 14, 13, 'brick');
    pen(MR, R_KIT);
    // hearth
    rect(16, 230, 34, 34, 30); rect(19, 234, 28, 30, 1); for (let y = 230; y < 264; y += 4) hl(16, 49, y, 31);
    rect(14, 226, 38, 4, 19); hl(14, 51, 226, 21);
    // the cauldron (bubbles live)
    ell(33, 254, 11, 8, 1, (x, y, u, v) => (u > 0.4 && v < 0.2 ? 3 : 2)); rect(22, 246, 23, 3, 3); hl(22, 44, 246, 4);
    rect(26, 261, 3, 3, 1); rect(38, 261, 3, 3, 1);
    // shelves with jars
    for (const sy of [220, 228]) { hl(56, 79, sy, 20); hl(56, 79, sy + 1, 19); }
    const jars = [[57, 28], [61, 38], [65, 16], [70, 22], [74, 26], [58, 29], [63, 37], [68, 17], [73, 21]];
    jars.forEach(([x, c], k) => { const sy = k < 5 ? 220 : 228; rect(x, sy - 5, 3, 5, c); put(x + 1, sy - 6, 31); put(x, sy - 4, LITE[c]); });
    ell(77, 226, 2, 2, 33); put(76, 226, 0); put(78, 226, 0);
    // hanging herbs and garlic
    for (const [x, c] of [[58, 27], [64, 33], [70, 26], [76, 33]]) { vl(x, 212, 214, 31); ell(x, 216, 1.6, 2, c); }
    // cookbook on a lectern
    rect(60, 250, 2, 14, 19); poly([[54, 246], [68, 244], [68, 248], [54, 250]], 20); rect(56, 244, 10, 3, 33); vl(61, 244, 246, 31);
    // a window over the kitchen table
    nightWindow(88, 218, 14, 14, R_KIT, 38);
    pen(MR, R_KIT);
    rect(84, 250, 24, 2, 20); hl(84, 107, 250, 21); rect(85, 252, 2, 12, 19); rect(105, 252, 2, 12, 19);
    ell(90, 249, 4, 1.5, 22); hl(87, 93, 248, 21); rect(97, 249, 8, 1, 21); hl(98, 102, 248, 37); hl(102, 106, 247, 32);
    // a broom rack (the broom is drawn live, it leaves when the bell rings)
    hl(104, 110, 236, 31);
    floorBoards(12, 112, 264, R_KIT, 30, 1);
  }
  function buildCons() {
    // a wall of glass panes on iron ribs, a low brick wall below
    pen(ME, R_CONS);
    for (let y = 212; y < 250; y++) for (let x = 116; x < 262; x++) {
      let c = bay(x, y) < (y - 212) / 46 ? 3 : 2;
      if (ih(x, y, 81) < 0.025) c = 6;
      if (Math.hypot(x - 150, y - 222) < 6) c = 6;
      put(x, y, c);
    }
    ell(150, 222, 4, 4, 7);
    pen(MR, R_CONS);
    for (let x = 116; x < 262; x += 12) { vl(x, 212, 249, 1); vl(x + 1, 212, 249, 30); }
    for (let y = 212; y < 250; y += 10) hl(116, 261, y, 1);
    for (let x = 116; x < 262; x++) put(x, 212 + Math.round(3 * Math.abs(Math.sin((x - 116) / 12 * Math.PI))), 30);
    wallpaper(116, 250, 262, 264, R_CONS, 14, 13, 'brick');
    hl(116, 261, 250, 21); hl(116, 261, 251, 20);
    // hanging baskets with trailing ivy
    for (const hx of [140, 226]) {
      vl(hx - 3, 212, 218, 31); vl(hx + 3, 212, 218, 31); ell(hx, 220, 5, 2.6, 20);
      for (let k = -4; k <= 4; k++) { const l = 4 + fl(ih(hx, k, 61) * 9); for (let j = 0; j < l; j++) if ((j + k) % 3 !== 0) put(hx + k, 221 + j, (j & 1) ? 27 : 26); }
    }
    // potted fern, cactus, a sapling
    rect(120, 256, 8, 8, 35); hl(119, 128, 256, 36);
    for (let k = 0; k < 9; k++) { const a = Math.PI * (0.12 + 0.76 * k / 8); line(124, 256, 124 - Math.cos(a) * 12, 256 - Math.sin(a) * 14, k & 1 ? 26 : 27); }
    rect(134, 258, 8, 6, 34); hl(133, 142, 258, 35);
    rect(136, 242, 4, 16, 27); rect(133, 247, 2, 6, 27); hl(133, 135, 252, 27); rect(141, 245, 2, 5, 27); hl(140, 142, 249, 27); for (let y = 243; y < 257; y += 3) { put(135, y, 28); put(140, y + 1, 28); } put(137, 241, 17); put(138, 241, 23);
    rect(160, 258, 7, 6, 35); hl(159, 167, 258, 36); vl(163, 240, 257, 20); for (const [lx, ly] of [[159, 242], [167, 244], [160, 248], [166, 250]]) ell(lx, ly, 3, 1.6, 27);
    // the giant's pot (the plant is drawn live)
    poly([[184, 250], [208, 250], [205, 264], [187, 264]], 35, (x) => (x < 190 ? 34 : 35)); hl(183, 209, 250, 36); hl(184, 208, 251, 36); hl(185, 207, 256, 34);
    // potting bench: seed trays, a watering can, mandrakes in little pots, a lantern
    rect(230, 246, 30, 2, 20); hl(230, 259, 246, 21); rect(231, 248, 2, 16, 19); rect(257, 248, 2, 16, 19);
    rect(232, 243, 8, 3, 19); for (let x = 233; x < 240; x += 2) put(x, 242, 28);
    for (const mx of [243, 248]) { rect(mx, 242, 4, 4, 35); put(mx + 1, 241, 27); put(mx + 2, 240, 28); put(mx + 2, 241, 27); }
    rect(222, 258, 6, 6, 5); hl(222, 227, 258, 6); line(228, 259, 232, 256, 5); vl(221, 259, 262, 5);
    rect(251, 239, 4, 7, 1); hl(250, 255, 238, 31);
    for (let x = 116; x < 262; x++) put(x, 263, ((x >> 2) & 1) ? 26 : 30);
  }
  function buildBall() {
    wallpaper(12, 268, 176, 332, R_BALL, 15, 21, 'damask');
    wainscot(12, 176, 316, 332, R_BALL, 13, 14, 22);
    crown(12, 176, 268, R_BALL, 22, 21);
    nightWindow(23, 282, 12, 26, R_BALL, 16);
    nightWindow(153, 282, 12, 26, R_BALL, 16);
    pen(MR, R_BALL);
    portrait(106, 284, 12, 15, R_BALL, 'lady');
    // party bunting in two swags
    for (const [x0, x1] of [[14, 94], [94, 174]]) for (let x = x0; x <= x1; x++) {
      const y = 272 + Math.round(5 * Math.sin(Math.PI * (x - x0) / (x1 - x0)));
      put(x, y, 31);
      const k = x - x0; if (k % 7 === 2) { const c = [37, 38, 22][fl(k / 7) % 3]; for (let j = 1; j <= 4; j++) hl(x - 2 + fl(j / 2), x + 2 - fl(j / 2), y + j, c); }
    }
    // a jack-o'-lantern amplifier
    rect(76, 318, 9, 14, 1); rect(77, 319, 7, 9, 30); for (let y = 320; y < 328; y += 2) hl(77, 83, y, 2); ell(80, 329, 2.6, 2, 37); put(80, 327, 27); vl(85, 324, 331, 31);
    // the punch table: a bowl of punch and a bowl of eyeballs
    rect(136, 318, 34, 2, 33); for (let y = 320; y < 328; y++) for (let x = 136; x < 170; x++) put(x, y, (x + y) % 5 === 0 ? 32 : 33); for (let x = 136; x < 170; x += 2) put(x, 328, 32);
    ell(146, 316, 5, 2.6, 16, (x, y, u, v) => (v < -0.3 ? 17 : 16)); hl(141, 151, 315, 15); rect(143, 313, 1, 3, 31);
    ell(160, 316, 4, 2, 32); for (const [ex, ey] of [[158, 315], [161, 314], [163, 316], [159, 316]]) { put(ex, ey, 33); put(ex + 1, ey, 4); }
    rect(166, 313, 2, 4, 6); rect(153, 313, 2, 4, 6);
    // chandelier chain
    vl(94, 268, 277, 31);
    // checkered floor strip
    for (let x = 12; x < 176; x++) { put(x, 331, ((x >> 2) & 1) ? 33 : 1); put(x, 330, ((x >> 2) & 1) ? 1 : 33); }
  }
  function buildParl() {
    wallpaper(180, 268, 262, 332, R_PARL, 11, 12, 'diamond');
    wainscot(180, 262, 318, 332, R_PARL, 10, 9, 20);
    crown(180, 262, 268, R_PARL, 21, 10);
    pen(MR, R_PARL);
    // fireplace (fire live) with a mantel of curiosities
    rect(214, 300, 28, 32, 31); rect(218, 306, 20, 26, 0); for (let y = 302; y < 332; y += 4) { put(215, y, 30); put(240, y, 30); }
    rect(212, 297, 32, 3, 32); hl(212, 243, 297, 33); hl(212, 243, 300, 30);
    rect(225, 289, 6, 8, 21); ell(228, 292, 2, 2, 33); put(228, 291, 0); put(228, 292, 0); put(229, 292, 0);
    rect(215, 291, 1, 6, 33); rect(240, 291, 1, 6, 33);
    ell(235, 295, 2.4, 2.2, 33); put(234, 295, 0); put(236, 295, 0); rect(219, 293, 3, 4, 28); put(220, 292, 31);
    portrait(222, 273, 12, 14, R_PARL, 'gent');
    // the armchair by the fire
    rect(186, 300, 4, 26, 16); rect(188, 303, 3, 9, 15); rect(186, 322, 18, 4, 16); hl(187, 203, 322, 17); rect(200, 316, 4, 6, 15); hl(200, 203, 316, 17);
    rect(187, 326, 2, 6, 19); rect(201, 326, 2, 6, 19);
    // yarn basket
    rect(206, 326, 7, 6, 20); for (let x = 206; x < 213; x += 2) vl(x, 327, 331, 19); ell(208, 325, 2, 2, 37); ell(211, 325, 2, 2, 38); put(210, 324, 22);
    // a standard lamp and a little skull-shaped clock... no, a fern
    vl(252, 290, 331, 31); hl(249, 255, 331, 31); poly([[248, 286], [256, 286], [258, 290], [246, 290]], 22);
    for (let x = 184; x < 258; x++) put(x, 331, (x & 3) ? 13 : 22);
  }
  function buildHall() {
    wallpaper(266, 96, 316, 332, R_HALL, 26, 25, 'stripe');
    wainscot(266, 316, 316, 332, R_HALL, 19, 18, 21);
    pen(MR, R_HALL);
    // portraits, the grandfather clock under the stairs, sconces (flames live)
    portrait(284, 102, 12, 15, R_HALL, 'count');
    portrait(284, 160, 12, 14, R_HALL, 'gent');
    portrait(284, 214, 12, 14, R_HALL, 'lady');
    rect(282, 296, 9, 36, 19); hl(282, 290, 296, 21); rect(283, 298, 7, 7, 33); rect(284, 307, 5, 18, 2); vl(282, 296, 331, 20);
    for (const [x, y] of [[279, 113], [268, 173], [268, 229], [268, 291]]) { rect(x, y, 3, 4, 21); put(x + 1, y - 1, 31); }
    // ladder to the attic hatch
    for (let y = 96; y < 152; y++) { put(270, y, 20); put(276, y, 20); if (y % 5 === 0) hl(270, 276, y, 21); }
    // landings & stairs: flights of 7 steps
    const land = (x0, x1, y) => { for (let x = x0; x <= x1; x++) for (let k = 0; k < 4; k++) put(x, y + k, k === 0 ? 21 : k === 3 ? 18 : 19); };
    const flight = (xa, ya, xb, yb) => {
      const n = 7, dx = (xb - xa) / n, dy = (yb - ya) / n;
      for (let s = 0; s < n; s++) {
        const x0 = Math.round(xa + dx * s), y0 = Math.round(ya + dy * s + dy);
        const x1 = Math.round(xa + dx * (s + 1));
        const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
        hl(lo, hi, y0 - 1, 21); hl(lo, hi, y0, 20);
        for (let y = y0 + 1; y < y0 + 4; y++) hl(lo, hi, y, 19);
      }
      line(xa, ya + 3, xb, yb + 3, 18);
    };
    for (const [y0, y1] of [[F4Y, F3Y], [F3Y, F2Y], [F2Y, F1Y]]) {
      const m = y1 - y0 > 60 ? y0 + 32 : y0 + 28;
      land(302, 315, m); flight(272, y0, 308, m); flight(304, m, 272, y1);
      for (const [x, y] of [[272, y0], [308, m], [272, y1]]) { vl(x, y - 8, y - 1, 20); put(x, y - 9, 21); }
      line(272, y0 - 8, 308, m - 8, 20); line(304, m - 8, 272, y1 - 8, 20);
    }
    // coat hooks, the doorbell (drawn live), a pumpkin and a welcome mat by the door
    hl(293, 301, 306, 31); rect(293, 307, 3, 11, 38); rect(298, 307, 3, 13, 16);
    ell(310, 328, 4, 3.5, 37); put(310, 324, 27); put(308, 327, 22); put(312, 327, 22); hl(308, 312, 329, 22);
    hl(298, 315, 331, 38);
    // the trapdoor to the cellar (opened live)
    rect(287, F1Y, 14, 1, 18);
  }
  function buildCellar() {
    wallpaper(12, 336, 316, 392, R_CEL, 11, 10, 'stone');
    pen(MR, R_CEL);
    // stone piers and vaults
    for (const px of [92, 196]) { rect(px, 336, 6, 56, 31); for (let y = 339; y < 392; y += 5) hl(px, px + 5, y, 30); }
    for (const [x0, x1] of [[12, 92], [98, 196], [202, 316]]) for (let x = x0; x < x1; x++) { const u = (x - x0) / (x1 - x0) * 2 - 1; const y = 336 + Math.round(7 * u * u); put(x, y, 31); put(x, y + 1, 30); }
    // pipes
    hl(12, 315, 341, 31); hl(12, 315, 342, 30); vl(70, 336, 350, 31); ell(70, 350, 2, 2, 16);
    // furnace and its flue, a coal heap and a shovel
    rect(140, 362, 24, 30, 1); rect(142, 364, 20, 26, 2); rect(146, 376, 12, 8, 13); for (let x = 147; x < 157; x += 2) vl(x, 377, 383, 14);
    rect(149, 336, 6, 26, 31); vl(152, 336, 361, 30); ell(152, 368, 2.5, 2.5, 32); put(152, 368, 16);
    poly([[166, 392], [175, 381], [186, 392]], 1); for (let k = 0; k < 14; k++) put(168 + fl(ih(k, 1, 77) * 16), 384 + fl(ih(k, 2, 77) * 7), 30);
    line(186, 391, 192, 374, 20); rect(184, 389, 4, 3, 31);
    // shelves of candy bowls (the zombie's stash)
    for (const sy of [366, 378]) { hl(18, 60, sy, 20); hl(18, 60, sy + 1, 19); }
    for (let k = 0; k < 5; k++) { const x = 20 + k * 8; ell(x + 2, 364, 3, 2, 38); put(x + 1, 362, 37); put(x + 3, 362, 28); put(x + 2, 361, 17); }
    for (let k = 0; k < 5; k++) { const x = 20 + k * 8; ell(x + 2, 376, 3, 2, 37); put(x + 1, 374, 22); put(x + 3, 374, 39); }
    rect(38, 352, 2, 4, 33); // candle on the top shelf bracket
    hl(30, 46, 357, 20);
    // the zombie's sorting table
    rect(46, 382, 22, 2, 20); rect(48, 384, 2, 8, 19); rect(64, 384, 2, 8, 19);
    // candy sacks
    for (const [x, h] of [[102, 14], [114, 11], [124, 13]]) { poly([[x, 392], [x + 2, 392 - h], [x + 4, 392 - h - 2], [x + 6, 392 - h], [x + 9, 392]], 20); put(x + 4, 392 - h - 3, 21); }
    for (let k = 0; k < 9; k++) put(102 + fl(ih(k, 1, 33) * 30), 390 + fl(ih(k, 2, 33) * 2), [17, 28, 22, 39, 37][k % 5]);
    // barrels
    for (const [x, y] of [[204, 376], [217, 376], [210, 360]]) { rect(x, y, 12, 16, 19); hl(x, x + 11, y + 3, 31); hl(x, x + 11, y + 12, 31); vl(x + 5, y, y + 15, 18); }
    // a brain in a jar, wired to a box of dials (the liquid is live)
    rect(232, 372, 30, 2, 20); rect(233, 374, 2, 18, 19); rect(259, 374, 2, 18, 19);
    rect(239, 354, 14, 2, 31); rect(240, 356, 1, 16, 6); rect(251, 356, 1, 16, 6); hl(240, 251, 371, 6);
    rect(254, 362, 7, 10, 19); put(256, 364, 16); put(258, 364, 28); put(256, 367, 22); line(246, 354, 249, 349, 31); line(249, 349, 257, 362, 31);
    // the cellar stair from the trapdoor
    for (let s = 0; s < 8; s++) { const x = 296 - s * 4, y = 340 + s * 7; hl(x - 4, x + 2, y, 21); rect(x - 4, y + 1, 7, 3, 19); }
    floorBoards(12, 316, 392, R_CEL, 30, 2);
  }
  function buildTomb() {
    // a little crypt under the garden, where the neighbour lives
    pen(MR, R_STR);
    rect(118, 402, 84, 38, 30); for (let y = 404; y < 440; y += 4) hl(118, 201, y, 31);
    wallpaper(122, 406, 198, 436, R_TOMB, 10, 9, 'stone');
    pen(MR, R_TOMB);
    rect(132, 428, 52, 8, 31); hl(132, 183, 428, 32);
    poly([[136, 420], [178, 420], [182, 424], [178, 428], [136, 428], [134, 424]], 18); poly([[137, 422], [177, 422], [180, 424], [177, 427], [137, 427], [136, 424]], 13);
    ell(140, 424, 3, 1.6, 33);
    // shelf with a framed photo, books, the candle
    hl(124, 136, 414, 20); rect(125, 409, 5, 5, 21); rect(126, 410, 3, 3, 2); rect(131, 410, 2, 4, 15); rect(133, 409, 2, 5, 26);
    rect(189, 428, 2, 6, 33);
    text('RIP', 152, 408, 31);
  }
  function buildPorch() {
    pen(MR, R_PORCH);
    rect(320, 332, 28, 3, 20); hl(320, 347, 332, 22); rect(320, 335, 28, 3, 19);
    for (let s = 0; s < 2; s++) rect(346 + s * 3, 335 + s, 4, 3 - s, 20);
    // awning on a post
    poly([[318, 276], [354, 276], [350, 281], [318, 281]], 15); hl(318, 353, 276, 16); for (let x = 320; x < 350; x += 4) put(x, 281, 14);
    rect(346, 281, 2, 51, 20); vl(346, 281, 331, 21);
    // porch lantern (flame live) and the outside bell button
    rect(322, 284, 5, 7, 1); hl(321, 327, 283, 31);
    rect(321, 312, 2, 3, 31); put(321, 313, 22);
    // a jack-o'-lantern on the steps
    ell(352, 334, 4.5, 3.6, 37); put(352, 330, 27); put(350, 333, 22); put(354, 333, 22); hl(350, 354, 335, 22);
    pen(MR, R_EXT);
    for (let x = 350; x < AW; x++) put(x, GY, 31);
    for (let x = 357; x < AW; x += 4) { vl(x, 322, 337, 1); put(x, 321, 4); }
    hl(357, AW - 1, 325, 1); hl(357, AW - 1, 331, 1);
    rect(0, 326, 6, 12, 31); hl(0, 5, 326, 32);
  }

  /* ================================================================ sprite layers */
  function mkL(w, h) { return { w, h, c: new Uint8Array(w * h), m: new Uint8Array(w * h), r: null, x0: 0, y0: 0, x1: w, y1: h }; }
  const POOL = [];
  let poolI = 0;
  function layer(w, h) {
    let L = POOL[poolI];
    if (!L || L.w !== w || L.h !== h) { L = mkL(w, h); POOL[poolI] = L; }
    poolI++;
    L.c.fill(0); L.m.fill(MS);
    return L;
  }
  function flipL(L) {
    const w = L.w, h = L.h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w >> 1; x++) {
      const a = y * w + x, b = y * w + (w - 1 - x);
      let t = L.c[a]; L.c[a] = L.c[b]; L.c[b] = t;
      t = L.m[a]; L.m[a] = L.m[b]; L.m[b] = t;
    }
  }
  function outline(L, oc) {
    const w = L.w, h = L.h, src = L.c.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (src[i]) continue;
      if ((x > 0 && src[i - 1]) || (x < w - 1 && src[i + 1]) || (y > 0 && src[i - w]) || (y < h - 1 && src[i + w])) { L.c[i] = oc + 1; L.m[i] = MS; }
    }
  }
  // stamp a layer into the scene, lit uniformly by the room it stands in
  function stamp(L, ox, oy, lx, ly, opt) {
    opt = opt || {};
    const room = opt.room !== undefined ? opt.room : roomAt(lx, ly);
    const Lr = roomLight(room, lx, ly, -1), dm = INTERIOR[room] ? DIM : 1;
    let Lt = [(0.45 + 0.62 * Lr[0]) * dm, (0.45 + 0.62 * Lr[1]) * dm, (0.45 + 0.62 * Lr[2]) * dm];
    if (opt.bright) Lt = [Lt[0] * opt.bright, Lt[1] * opt.bright, Lt[2] * opt.bright];
    const slot = SLOTS.length; SLOTS.push(Lt);
    ox = Math.round(ox); oy = Math.round(oy);
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const i = y * L.w + x, c = L.c[i]; if (!c) continue;
      const X = ox + x, Y = oy + y;
      if (X < 0 || Y < 0 || X >= AW || Y >= AH) continue;
      if (opt.ghost && ((X + Y) & 1) && L.m[i] !== ME) continue; // translucent: every other pixel
      const j = Y * AW + X;
      SC.c[j] = c; SC.m[j] = L.m[i] === ME ? ME : MS; SC.r[j] = room; SL[j] = slot;
    }
  }

  /* ================================================================ heads (facing right) */
  const HEADS = {
    vamp: { rows: ['.hhhhh..', 'hhhHHhh.', 'hhhhshh.', 'hhsssss.', 'hsssess.', 'hssssss.', '.sswwm..', '.sssss..', '..sss...'], map: { h: 1, H: 4, s: 7, e: 0, w: 8, m: 15 } },
    vampScare: { rows: ['.hhhhh..', 'hhhHHhh.', 'hhhhshh.', 'hhsssss.', 'hssseew.', 'hssssss.', '.ssmmmm.', '.ssw.w..', '..sss...'], map: { h: 1, H: 4, s: 7, e: 16, w: 8, m: 15 } },
    frank: { rows: ['hhhhhhh.', 'hhhhhhh.', 'hshhshs.', 'sssssss.', 'ddddddd.', 'ssssess.', 'sssssss.', 'ssmmmm..', 'ssssss..', '.ssss...'], map: { h: 1, s: 28, d: 27, e: 0, m: 26 } },
    mummy: { rows: ['.wwwww.', 'wbwwwbw', 'wwwwwww', 'bwwweww', 'wwwwwbw', 'wbwwwww', 'wwwwbw.', '.wwww..'], map: { w: 33, b: 31, e: 23 } },
    wolf: { rows: ['.f....f...', 'fF...fF...', 'fffffff...', 'ffffeff...', 'ffffffffn.', 'fffffffff.', 'fffwfwf...', '.ffffff...', '..ffff....'], map: { f: 34, F: 17, e: 23, n: 0, w: 33 } },
    wolfHowl: { rows: ['.f....f...', 'fF...fF...', 'fffffff...', 'ffffeff...', 'ffffffffn.', 'ffffmmmm..', 'ffffwmwm..', '.ffffff...', '..ffff....'], map: { f: 34, F: 17, e: 23, n: 0, w: 33, m: 13 } },
    witch: { rows: ['......hh.', '.....hh..', '.....hh..', '....hhh..', '....hhh..', '...bbbbb.', 'hhhhhhhhh', '.rrsssss.', '.rrsess..', '.rrssssss', '.rrsmss..', '..rsss...'], map: { h: 1, b: 38, r: 37, s: 28, e: 0, m: 13 } },
    skull: { rows: ['.wwwww.', 'wwwwwww', 'wkwwkww', 'wkwwkww', 'wwwkwww', '.wwwww.'], map: { w: 33, k: 0 } },
    zombie: { rows: ['.h.hh.h.', 'hhhhhhh.', 'hsssssh.', 'sssesse.', 'sdsssss.', 'ssmmmss.', 'sssssss.', '.ssss...'], map: { h: 19, s: 27, d: 26, e: 23, m: 13 } },
    reaper: { rows: ['..HHHh..', '.HHhhhh.', 'Hhhhhhhh', 'hhhwwwwh', 'hhwkwwkh', 'hhwwwwwh', 'hhhwkwk.', 'hhhhwww.', '.hhhhh..'], map: { h: 2, H: 3, w: 33, k: 0 } },
    reaperScare: { rows: ['..HHHh..', '.HHhhhh.', 'Hhhhhhhh', 'hhhwwwwh', 'hhwewwew', 'hhwwwwwh', 'hhhkkkk.', 'hhhwkwk.', '.hhhhh..'], map: { h: 2, H: 3, w: 33, k: 0, e: 16 } },
    none: { rows: ['........'], map: {} },
  };
  const HELM = { rows: ['...rr...', '..rrr...', '.ssSss..', 'sssSsss.', 'sssskkk.', 'ssssess.', 'sssssss.', '.sssss..'], map: { s: 6, S: 8, k: 0, e: 23, r: 16 } };
  const HELM_ANGRY = { rows: HELM.rows, map: { s: 6, S: 8, k: 0, e: 16, r: 16 } };
  const HELM_BLINK = { rows: HELM.rows, map: { s: 6, S: 8, k: 0, e: 0, r: 16 } };
  function head(name, x, y, flip) { const H = HEADS[name]; spr(H.rows, H.map, x, y, flip); return H.rows.length; }

  /* ================================================================ the humanoid rig */
  // spec: leg, torso, sw (shoulder width), hw (hip width), arm, colors, head(name), extra(J,p)
  // pose: run (-1 or phase), sit, crouch, lean, aF, aB (degrees: 0 down, 90 forward, 180 up), hdy, headName
  function rig(spec, p) {
    const W = 40, Hh = 46;
    const L = layer(W, Hh); TG = L; PM = MS;
    const ox = 20, oy = Hh - 2;
    const cr = p.crouch || 0, lean = p.lean || 0;
    const hipX = ox + lean * 0.4, hipY = oy - spec.leg + cr;
    const shX = ox + lean, shY = hipY - spec.torso;
    const J = { ox, oy, hipX, hipY, shX, shY };
    const thick = (x0, y0, x1, y1, c, w) => { for (let k = 0; k < (w || 2); k++) line(x0 + k, y0, x1 + k, y1, c); };
    // ----- legs
    let feet;
    if (p.sit) feet = [[hipX + 5, oy, hipX + 5, hipY], [hipX + 6, oy, hipX + 6, hipY]];
    else if (p.run >= 0) {
      const ph = p.run & 3;
      const fx = [[-4, 4], [0, 1], [4, -4], [1, 0]][ph], lf = [[0, 0], [2, 0], [0, 0], [0, 2]][ph];
      feet = [[ox + fx[0], oy - lf[0]], [ox + fx[1], oy - lf[1]]];
    } else feet = [[ox - 2, oy], [ox + 2, oy]];
    const drawLeg = (ft, c) => {
      if (p.sit) { thick(hipX - 1, hipY, ft[2], ft[3], c); thick(ft[2], ft[3], ft[0], ft[1], c); rect(ft[0], ft[1] - 1, 3, 2, spec.shoe); }
      else { thick(hipX - 1 + (ft === feet[1] ? 1 : 0), hipY, ft[0] - 1, ft[1] - 1, c); rect(ft[0] - 1, ft[1] - 1, 3, 2, spec.shoe); }
    };
    drawLeg(feet[0], spec.legD); drawLeg(feet[1], spec.leg_c);
    J.feet = feet;
    // ----- arms
    const arm = (a, side, c) => {
      const r = a * Math.PI / 180, len = spec.arm;
      const sx = shX + side, sy = shY + 1;
      const hx = sx + Math.sin(r) * len, hy = sy + Math.cos(r) * len;
      thick(sx, sy, hx, hy, c);
      rect(Math.round(hx), Math.round(hy) - 1, 2, 2, spec.hand);
      return [Math.round(hx), Math.round(hy)];
    };
    J.hB = arm(p.aB !== undefined ? p.aB : 10, -1, spec.sleeveD);
    // ----- torso
    const sw = spec.sw, hw = spec.hw;
    poly([[shX - sw / 2, shY], [shX + sw / 2, shY], [hipX + hw / 2, hipY + 1], [hipX - hw / 2, hipY + 1]], spec.torso_c, (x) => (x < shX - sw / 2 + 2 ? spec.torsoD : spec.torso_c));
    if (spec.extra) spec.extra(J, p, 'torso');
    // ----- head
    const hn = p.headName || spec.head;
    const Hd = HEADS[hn];
    const hw2 = Hd.rows[0].length;
    J.headX = Math.round(shX - hw2 / 2 + (spec.headDx || 0)); J.headY = Math.round(shY - Hd.rows.length + 1 + (p.hdy || 0) + (spec.headDy || 0));
    if (spec.extra) spec.extra(J, p, 'prehead');
    head(hn, J.headX, J.headY, false);
    if (spec.extra) spec.extra(J, p, 'head');
    J.hF = arm(p.aF !== undefined ? p.aF : -10, 1, spec.sleeve);
    if (spec.extra) spec.extra(J, p, 'front');
    if (p.flip) flipL(L);
    outline(L, 0);
    return { L, ox, oy, J, W };
  }

  /* ---------------------------------------------------------------- the cast */
  const SPEC = {
    vamp: { leg: 10, torso: 9, sw: 8, hw: 6, arm: 8, leg_c: 1, legD: 0, shoe: 0, torso_c: 1, torsoD: 0, sleeve: 1, sleeveD: 0, hand: 7, head: 'vamp', eye: 16,
      extra(J, p, stage) {
        if (stage === 'torso') {
          // shirt front, bow, red-lined cape
          poly([[J.shX - 1, J.shY], [J.shX + 2, J.shY], [J.shX + 0.5, J.shY + 5]], 8); put(J.shX, J.shY, 16); put(J.shX + 1, J.shY, 16);
          const spread = p.cape || 0;
          poly([[J.shX - 4, J.shY - 1], [J.shX - 6 - spread * 6, J.hipY - 2 + spread * 2], [J.shX - 3 - spread * 6, J.oy - 1 - spread * 3], [J.shX - 2, J.hipY]], 16, (x) => (x < J.shX - 5 - spread * 4 ? 15 : 16));
        }
        if (stage === 'prehead') { // high collar behind the head
          poly([[J.shX - 5, J.shY + 1], [J.shX - 6, J.shY - 6], [J.shX - 2, J.shY - 1]], 16);
          poly([[J.shX + 3, J.shY + 1], [J.shX + 4, J.shY - 5], [J.shX + 1, J.shY - 1]], 15);
        }
        if (stage === 'front' && p.cape) {
          const s = p.cape;
          poly([[J.shX + 3, J.shY], [J.shX + 6 + s * 5, J.shY + 2 - s * 3], [J.shX + 5 + s * 4, J.oy - 3 - s * 3], [J.shX + 2, J.hipY]], 1, (x) => (x > J.shX + 5 ? 16 : 1));
        }
        if (stage === 'front' && p.comb) { const [hx, hy] = J.hF; hl(hx - 1, hx + 2, hy - 1, 31); put(hx, hy, 31); put(hx + 2, hy, 31); }
        if (stage === 'front' && p.candy) { const [hx, hy] = J.hF; put(hx + 2, hy - 1, 17); put(hx + 3, hy - 1, 23); }
      } },
    frank: { leg: 11, torso: 11, sw: 11, hw: 8, arm: 9, leg_c: 2, legD: 1, shoe: 0, torso_c: 32, torsoD: 31, sleeve: 28, sleeveD: 27, hand: 28, head: 'frank', eye: 23, eyeDy: 5,
      extra(J, p, stage) {
        if (stage === 'torso') {
          if (p.jacket === 1) poly([[J.shX - 5.5, J.shY], [J.shX + 1, J.shY], [J.hipX + 1, J.hipY + 1], [J.hipX - 4, J.hipY + 1]], 2, (x) => (x > J.shX - 1 ? 3 : 2));
          if (p.jacket === 2) { poly([[J.shX - 5.5, J.shY], [J.shX + 5.5, J.shY], [J.hipX + 4, J.hipY + 1], [J.hipX - 4, J.hipY + 1]], 2); poly([[J.shX - 1, J.shY], [J.shX + 2, J.shY], [J.shX + 0.5, J.shY + 6]], 32); put(J.shX, J.shY + 1, 16); }
          hl(J.hipX - 4, J.hipX + 3, J.hipY, 19); // belt
        }
        if (stage === 'head') { // neck bolts and a scar
          put(J.headX - 1, J.headY + 8, 31); put(J.headX + 7, J.headY + 8, 31); put(J.headX - 2, J.headY + 8, 32); put(J.headX + 8, J.headY + 8, 32);
          hl(J.headX + 2, J.headX + 5, J.headY + 3, 26); put(J.headX + 3, J.headY + 2, 26); put(J.headX + 5, J.headY + 2, 26);
          if (p.zap) { for (const [dx, dy] of [[0, -2], [2, -3], [4, -2], [6, -3], [1, -1], [5, -1]]) put(J.headX + dx, J.headY + dy, 1); }
        }
        if (stage === 'front' && p.iron) { const [hx, hy] = J.hF; rect(hx - 2, hy, 6, 2, 31); poly([[hx - 2, hy + 2], [hx + 4, hy + 2], [hx + 3, hy + 3], [hx - 2, hy + 3]], 30); put(hx + 1, hy - 1, 1); }
      } },
    mummy: { leg: 10, torso: 9, sw: 8, hw: 7, arm: 8, leg_c: 32, legD: 31, shoe: 31, torso_c: 32, torsoD: 31, sleeve: 32, sleeveD: 31, hand: 33, head: 'mummy', eye: 23, eyeDy: 3,
      extra(J, p, stage) {
        if (stage === 'torso') for (let y = J.shY + 1; y < J.hipY; y += 2) hl(J.hipX - 3, J.hipX + 3, y, (y >> 1) & 1 ? 31 : 33);
        if (stage === 'front' && p.brush) { const [hx, hy] = J.hF; hl(hx, hx + 3, hy - 1, 6); put(hx + 3, hy - 2, 8); if (p.foam) { put(hx + 4, hy - 3, 8); put(hx + 2, hy - 3, 8); } }
        if (stage === 'front' && p.spin) { for (let k = 0; k < 3; k++) { const yy = J.shY + 2 + k * 3 + (p.spin & 1); hl(J.hipX - 6, J.hipX + 6, yy, 33); } }
      } },
    wolf: { leg: 10, torso: 9, sw: 10, hw: 7, arm: 8, leg_c: 4, legD: 3, shoe: 34, torso_c: 35, torsoD: 34, sleeve: 34, sleeveD: 34, hand: 35, head: 'wolf', headDx: 1, eye: 23, eyeDy: 3,
      extra(J, p, stage) {
        if (stage === 'torso') { rect(J.shX - 3, J.shY + 2, 7, 5, 16); hl(J.shX - 3, J.shX + 3, J.shY + 2, 17); } // tank top
        if (stage === 'head' && p.poof > 0) {
          const n = Math.round(p.poof * 4);
          const cx = J.headX + 4, cy = J.headY + 4;
          for (let a = 0; a < 18; a++) {
            const th = a / 18 * TAU; if (Math.sin(th) > 0.55 && Math.cos(th) > 0) continue;
            const r0 = 4.5, r1 = r0 + n * (0.7 + 0.5 * ih(a, 1, 9));
            line(cx + Math.cos(th) * r0, cy + Math.sin(th) * r0 * 0.9, cx + Math.cos(th) * r1, cy + Math.sin(th) * r1 * 0.9, a & 1 ? 35 : 34);
          }
          for (let a = 0; a < 10; a++) { const xx = J.shX - 5 + a, yy = J.shY - fl(n * 0.6 * ih(a, 2, 9)); vl(xx, yy, J.shY + 1, 34); }
        }
        if (stage === 'front' && p.dryer) { const [hx, hy] = J.hF; rect(hx - 1, hy - 3, 4, 3, 16); put(hx + 3, hy - 2, 31); vl(hx, hy, hy + 2, 1); }
      } },
    witch: { leg: 9, torso: 9, sw: 8, hw: 10, arm: 8, leg_c: 1, legD: 0, shoe: 0, torso_c: 38, torsoD: 11, sleeve: 38, sleeveD: 11, hand: 28, head: 'witch', headDy: 1, eye: 29, eyeDy: 8,
      extra(J, p, stage) {
        if (stage === 'torso') { poly([[J.hipX - 6, J.hipY], [J.hipX + 6, J.hipY], [J.hipX + 7, J.oy - 1], [J.hipX - 7, J.oy - 1]], 38, (x) => ((x & 3) === 0 ? 11 : 38)); }
        if (stage === 'front' && p.paddle) { const [hx, hy] = J.hF; line(hx, hy - 3, hx + 7, hy + 9, 20); line(hx + 1, hy - 3, hx + 8, hy + 9, 19); }
      } },
    skel: { leg: 8, torso: 8, sw: 7, hw: 5, arm: 7, leg_c: 33, legD: 32, shoe: 33, torso_c: 0, torsoD: 0, sleeve: 33, sleeveD: 32, hand: 33, head: 'skull', eye: 16, eyeDy: 2,
      extra(J, p, stage) {
        if (stage === 'torso') {
          for (let y = J.shY; y < J.hipY - 1; y += 2) hl(J.shX - 3, J.shX + 3, y, 33);
          vl(Math.round(J.shX), J.shY, J.hipY, 32); hl(J.hipX - 3, J.hipX + 3, J.hipY, 32);
          if (p.tie) { put(J.shX - 1, J.shY - 1, 16); put(J.shX + 1, J.shY - 1, 16); put(J.shX, J.shY - 1, 15); }
          if (p.band) hl(J.shX - 3, J.shX + 2, J.shY - 7, 16);
        }
        if (stage === 'head') {
          if (!p.jawOff) { hl(J.headX + 1, J.headX + 5, J.headY + 6, p.sing ? 0 : 33); hl(J.headX + 1, J.headX + 5, J.headY + 6 + (p.sing ? 1 : 0), 33); put(J.headX + 2, J.headY + 6 + (p.sing ? 1 : 0), 0); put(J.headX + 4, J.headY + 6 + (p.sing ? 1 : 0), 0); }
          if (p.band) hl(J.headX, J.headX + 6, J.headY + 1, 16);
        }
        if (stage === 'front' && p.sticks) { for (const h of [J.hF, J.hB]) { line(h[0], h[1], h[0] + 3, h[1] - 3, 33); put(h[0] + 3, h[1] - 4, 33); put(h[0] + 4, h[1] - 3, 33); } }
        if (stage === 'front' && p.holdJaw) { const [hx, hy] = J.hF; hl(hx, hx + 4, hy - 2, 33); put(hx + 1, hy - 3, 33); put(hx + 3, hy - 3, 33); }
      } },
    zombie: { leg: 10, torso: 9, sw: 9, hw: 7, arm: 8, leg_c: 3, legD: 2, shoe: 19, torso_c: 5, torsoD: 4, sleeve: 5, sleeveD: 4, hand: 27, head: 'zombie', eye: 23, eyeDy: 3,
      extra(J, p, stage) {
        if (stage === 'torso') { put(J.shX + 2, J.shY + 4, 27); put(J.shX - 1, J.shY + 6, 27); put(J.shX + 1, J.hipY - 1, 3); hl(J.hipX - 3, J.hipX + 3, J.hipY + 1, 19); }
        if (stage === 'front' && p.bowl) { const [hx, hy] = J.hF; ell(hx + 2, hy + 1, 4, 2.2, 37); put(hx, hy - 1, 17); put(hx + 2, hy - 2, 22); put(hx + 4, hy - 1, 28); put(hx + 3, hy - 1, 39); }
        if (stage === 'front' && p.scoop) { const [hx, hy] = J.hF; rect(hx, hy - 1, 3, 2, 31); }
        if (stage === 'front' && p.candy) { const [hx, hy] = J.hF; put(hx + 1, hy - 2, 17); }
      } },
    knight: { leg: 11, torso: 10, sw: 10, hw: 8, arm: 9, leg_c: 5, legD: 4, shoe: 3, torso_c: 6, torsoD: 5, sleeve: 6, sleeveD: 4, hand: 5, head: 'none', eye: 23,
      extra(J, p, stage) {
        if (stage === 'torso') {
          rect(Math.round(J.shX) - 1, J.shY + 2, 3, J.hipY - J.shY - 1, 16); put(Math.round(J.shX), J.shY + 4, 22);
          vl(Math.round(J.shX) + 3, J.shY + 1, J.hipY - 2, 7); hl(J.hipX - 4, J.hipX + 3, J.hipY, 19);
          hl(J.shX - 5, J.shX - 3, J.shY, 7); hl(J.shX + 3, J.shX + 5, J.shY, 7);
        }
        if (stage === 'head') { hl(J.shX - 3, J.shX + 3, J.shY - 1, 7); hl(J.shX - 2, J.shX + 2, J.shY - 2, 0); put(J.shX, J.shY - 3, 15); put(J.shX - 1, J.shY - 3, 15); }
        if (stage === 'front' && p.cloth) { const [hx, hy] = J.hF; rect(hx, hy - 1, 3, 3, 33); put(hx + 1, hy + 2, 32); }
        if (stage === 'front' && p.helm) { const [hx, hy] = J.hF; const H = p.helm; spr(H.rows, H.map, hx - 1, hy - 7); J.eyeAt = [hx + 4, hy - 2]; }
      } },
    reaper: { leg: 10, torso: 10, sw: 9, hw: 10, arm: 8, leg_c: 2, legD: 1, shoe: 1, torso_c: 2, torsoD: 1, sleeve: 2, sleeveD: 1, hand: 33, head: 'reaper', eye: 16,
      extra(J, p, stage) {
        if (stage === 'torso') {
          if (!p.sit) poly([[J.hipX - 6, J.hipY - 1], [J.hipX + 6, J.hipY - 1], [J.hipX + 7 + (p.run >= 0 ? 2 : 0), J.oy], [J.hipX - 8, J.oy]], 2, (x, y) => (((x + y) & 3) === 0 ? 1 : 2));
          else poly([[J.hipX - 5, J.hipY - 1], [J.hipX + 8, J.hipY - 1], [J.hipX + 8, J.oy], [J.hipX + 4, J.oy]], 2, (x) => ((x & 3) === 0 ? 1 : 2));
          hl(J.shX - 3, J.shX + 3, J.hipY - 3, 1);
        }
        if (stage === 'front' && p.knit) {
          const [hx, hy] = J.hF, k = p.knit & 1;
          line(hx - 2, hy - 3 + k, hx + 4, hy + 1, 31); line(hx - 2, hy + 1, hx + 4, hy - 3 + k, 31);
          rect(hx, hy + 1, 3, 3, 16); put(hx + 1, hy + 2, 37);
        }
        if (stage === 'front' && p.scythe) {
          const [hx, hy] = J.hF, up = p.scythe === 2;
          const top = up ? hy - 16 : hy - 12, bot = up ? hy + 6 : hy + 12;
          vl(hx + 1, top, bot, 20); vl(hx + 2, top, bot, 19);
          for (let k = 0; k < 11; k++) { const bx = hx + 1 - k, by = top + Math.round((k * k) / 22) + (k < 2 ? 0 : 1); put(bx, by, 32); put(bx, by + 1, k > 1 && k < 10 ? 33 : 32); }
        }
      } },
  };
  // a cast member drawn at feet (x, y); remembers where the eyes are for the blackout
  const EYES = [];
  function actor(name, x, y, p, opt) {
    const S = SPEC[name], R = rig(S, p);
    const ox = x - R.ox, oy = y - R.oy;
    stamp(R.L, ox, oy, x, y - 14, opt);
    let ex = R.J.headX + 4, ey = R.J.headY + (S.eyeDy || 4);
    if (R.J.eyeAt) { ex = R.J.eyeAt[0]; ey = R.J.eyeAt[1]; }
    if (S.head === 'none' && !R.J.eyeAt) return R;
    if (p.flip) ex = R.W - 1 - ex - 2;
    EYES.push([Math.round(ox + ex), Math.round(oy + ey), S.eye || 23]);
    return R;
  }

  /* ---------------------------------------------------------------- ghosts, cat, spider, kid */
  function ghost(x, y, p) {
    const L = layer(18, 20); TG = L; PM = MS;
    const ph = p.ph || 0;
    ell(9, 7, 6, 6.5, 33);
    rect(3, 7, 13, 7, 33);
    for (let i = 0; i < 13; i++) { const w = ((i + ph) % 4); if (w < 2) put(3 + i, 14, 33); if (w === 0) put(3 + i, 15, 33); }
    for (let yy = 2; yy < 15; yy++) { if (get(3, yy)) put(3, yy, 32); if (get(4, yy) && yy > 9) put(4, yy, 32); }
    rect(10, 5, 2, 3, 0); rect(13, 5, 1, 3, 0);
    if (p.mouth) { rect(11, 9, 2, 2, 0); } else put(12, 9, 0);
    if (p.blush) { put(9, 8, 17); put(14, 8, 17); }
    const aU = p.armsUp;
    if (aU) { put(2, 5, 33); put(1, 4, 33); put(16, 5, 33); put(17, 4, 33); }
    else { put(16, 9, 33); put(17, 8, 33); }
    if (p.hold) p.hold(L);
    if (p.flip) flipL(L);
    outline(L, 3);
    stamp(L, x - 9, y - 16, x, y - 8, { room: p.room, bright: 1.15 });
    EYES.push([x - 9 + (p.flip ? 5 : 10), y - 10, 8]);
  }
  const CAT_SIT = ['k....k..', 'kk..kk..', 'kkkkkk..', 'kekkek..', 'kkkkkk..', '.kkkk...', 'kkkkkk..', 'kkkkkkk.', 'kkkkkkkk', '.k.k..kk'];
  const CAT_SWAT = ['k....k....', 'kk..kk..kk', 'kkkkkk..k.', 'kekkekkk..', 'kkkkkkk...', '.kkkk.....', 'kkkkkk....', 'kkkkkkk...', 'kkkkkkkk..', '.k.k..kk..'];
  function cat(x, y, rows, flip, opt) {
    const L = layer(14, 12); TG = L; PM = MS;
    spr(rows, { k: 1, e: 29 }, 1, 12 - rows.length - 1, false);
    for (let i = 0; i < L.c.length; i++) if (L.c[i] === 30) L.m[i] = ME;
    if (flip) flipL(L);
    outline(L, 4);
    stamp(L, x - 7, y - 11, x, y - 4, opt);
  }
  function kid(x, y, p) {
    const L = layer(22, 22); TG = L; PM = MS;
    const ox = 11, oy = 20;
    const ph = p.walk >= 0 ? p.walk & 1 : -1;
    rect(ox - 3 + (ph === 1 ? 1 : 0), oy - 1, 3, 2, 31); rect(ox + 1 - (ph === 1 ? 1 : 0), oy - 1, 3, 2, 31);
    rect(ox - 3, oy - 5, 7, 4, 33); rect(ox - 4, oy - 11, 9, 7, 33); hl(ox - 4, ox + 4, oy - 8, 16); rect(ox - 1, oy - 10, 2, 2, 4); put(ox + 2, oy - 10, 17);
    rect(ox - 6, oy - 11, 2, 6, 31); // backpack
    ell(ox + 0.5, oy - 15, 4.6, 4.4, 33); ell(ox + 1.5, oy - 15, 3, 2.6, 4); put(ox + 2, oy - 16, 7); put(ox + 3, oy - 15, 6);
    put(ox - 3, oy - 19, 31); put(ox - 3, oy - 20, 16);
    if (p.bagOut) { hl(ox + 3, ox + 6, oy - 9, 33); rect(ox + 6, oy - 10, 2, 2, 32); poly([[ox + 5, oy - 8], [ox + 10, oy - 8], [ox + 11, oy - 2], [ox + 4, oy - 2]], 37); hl(ox + 5, ox + 9, oy - 8, 22); put(ox + 7, oy - 5, 0); put(ox + 8, oy - 5, 0); hl(ox + 6, ox + 9, oy - 4, 0); }
    else if (p.press) { line(ox - 3, oy - 10, ox - 6, oy - 15, 33); rect(ox - 7, oy - 16, 2, 2, 32); poly([[ox + 2, oy - 6], [ox + 6, oy - 6], [ox + 7, oy - 1], [ox + 1, oy - 1]], 37); }
    else { vl(ox + 4, oy - 10, oy - 6, 33); poly([[ox + 3, oy - 5], [ox + 8, oy - 5], [ox + 9, oy], [ox + 2, oy]], 37); hl(ox + 3, ox + 7, oy - 5, 22); }
    if (p.flip) flipL(L);
    outline(L, 0);
    stamp(L, x - ox, y - oy, x, y - 10, { room: R_PORCH });
  }
  function bubble(x, y, lines, tailX) {
    TG = SC; pen(MX, R_EXT);
    const w = Math.max(...lines.map((s) => s.length)) * 4 + 3, h = lines.length * 6 + 3;
    rect(x, y, w, h, 8); hl(x + 1, x + w - 2, y - 1, 8); hl(x + 1, x + w - 2, y + h, 8); vl(x - 1, y + 1, y + h - 2, 8); vl(x + w, y + 1, y + h - 2, 8);
    hl(x + 1, x + w - 2, y - 2, 0); hl(x + 1, x + w - 2, y + h + 1, 0); vl(x - 2, y + 1, y + h - 2, 0); vl(x + w + 1, y + 1, y + h - 2, 0);
    put(x - 1, y, 0); put(x + w, y, 0); put(x - 1, y + h - 1, 0); put(x + w, y + h - 1, 0);
    const tx = tailX !== undefined ? tailX - 2 : x + w - 8;
    const tl = 7;
    for (let k = 0; k < tl; k++) { const a = tx + Math.round(k * 0.35), b = tx + 3 - Math.round(k * 0.3); hl(a, Math.max(a, b), y + h + k, 8); put(a - 1, y + h + k, 0); put(Math.max(a, b) + 1, y + h + k, 0); }
    put(tx + Math.round(tl * 0.35), y + h + tl, 0);
    lines.forEach((s, k) => text(s, x + 2, y + 2 + k * 6, 0));
  }
  // bats: hanging in the turret, or flying
  const BAT_FLY = [['oo...........oo', 'ooo.........ooo', '.orro.o.o.orro.', '..orrooooorro..', '...oooeoeooo...', '.....ooooo.....', '......o.o......'],
    ['......o.o......', '.....ooooo.....', '...oooeoeooo...', '.ooorrooorrooo.', 'ooo.rro.orr.ooo', 'oo...o...o...oo', 'o.............o']];
  const BAT_SM = [['o.....o', 'oo.o.oo', '.oeoeo.', '..ooo..'], ['.......', 'oooeooo', '.oo.oo.', '..o.o..'], ['...o...', '..eoe..', '.ooooo.', 'o.o.o.o']];
  function flyer(x, y, f, big, opt) {
    const rows = big ? BAT_FLY[f & 1] : BAT_SM[f % 3];
    const L = layer(rows[0].length + 2, rows.length + 2); TG = L; PM = MS;
    spr(rows, { o: big ? 12 : 11, r: 16, e: 16 }, 1, 1);
    for (let i = 0; i < L.c.length; i++) if (L.c[i] === 17) L.m[i] = MX;
    outline(L, 0);
    stamp(L, x - (L.w >> 1), y - (L.h >> 1), x, y, Object.assign({ bright: 1.25 }, opt || {}));
  }
  function poof(x, y, u) {
    TG = SC; pen(MX, R_EXT);
    for (let ring = 0; ring < 2; ring++) {
      const r = 2 + u * (ring ? 6 : 10);
      for (let a = 0; a < 18; a++) {
        const th = a / 18 * TAU + ring;
        if (ih(a, ring, fl(u * 9)) < u * 0.8) continue;
        const px = x + Math.cos(th) * r, py = y + Math.sin(th) * r * 0.8;
        put(px, py, ring ? 33 : 32); if (u < 0.5) put(px + 1, py, 32);
      }
    }
  }

  /* ================================================================ the story */
  const T_BELL = 7.8, T_RUN = 8.4, T_OPEN = 11.6, T_POSE = 12.1, T_COOL = 12.9, T_SIGH = 14.7, T_CANDY = 15.2, T_LEAVE = 15.9,
    T_DARK = 17.0, T_LIGHT = 17.8;
  function along(pts, u) {
    let tot = 0; const seg = [];
    for (let i = 0; i + 1 < pts.length; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(l); tot += l; }
    let s = clamp(u, 0, 1) * tot;
    for (let i = 0; i < seg.length; i++) {
      if (s <= seg[i] || i === seg.length - 1) {
        const k = seg[i] ? clamp(s / seg[i], 0, 1) : 0, a = pts[i], b = pts[i + 1];
        return { x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], k), dir: b[0] > a[0] + 0.01 ? 1 : b[0] < a[0] - 0.01 ? -1 : 0, len: tot };
      }
      s -= seg[i];
    }
    return { x: pts[pts.length - 1][0], y: pts[pts.length - 1][1], dir: 0, len: tot };
  }
  const plen = (pts) => along(pts, 0).len;
  // stairwell route pieces: down from one floor to the next (the last flight is taller)
  const DN = (y0, y1) => { const m = y1 - y0 > 60 ? y0 + 32 : y0 + 28; return [[308, m], [304, m], [272, y1]]; };
  const TO_F2 = [[272, F4Y]].concat(DN(F4Y, F3Y), DN(F3Y, F2Y));
  const F2_LANDING = [[308, 296], [304, 296]];
  const CAST = {
    vamp: { path: [[56, F4Y - 14], [140, 196], [306, F1Y - 14]], end: [306, F1Y], d0: 0.25, ta: 10.3 },
    invis: { path: [[134, F4Y]].concat(TO_F2, F2_LANDING, [[282, 321]]), d0: 0.35, ta: 11.5 },
    mummy: { path: [[232, F4Y]].concat(TO_F2, F2_LANDING, [[292, 309.5]]), d0: 0.2, ta: 11.3 },
    wolf: { path: [[46, F3Y], [272, F3Y]].concat(DN(F3Y, F2Y), F2_LANDING, [[272, F1Y], [283, F1Y]]), d0: 0.1, ta: 11.4 },
    frank: { path: [[140, F3Y], [272, F3Y]].concat(DN(F3Y, F2Y), F2_LANDING, [[272, F1Y], [271, F1Y]]), d0: 0.4, ta: 11.8 },
    knight: { path: [[234, F3Y], [272, F3Y]].concat(DN(F3Y, F2Y), F2_LANDING, [[272, F1Y], [259, F1Y]]), d0: 0.3, ta: 11.6 },
    witch: { path: [[60, F2Y], [64, 252], [150, 250], [250, 252], [290, 251]], d0: 0.1, ta: 10.2 },
    drum: { path: [[50, F1Y], [272, F1Y], [304, 296], [286, 276]], d0: 0.3, ta: 11.2 },
    bass: { path: [[92, F1Y], [272, F1Y], [304, 296], [296, 285]], d0: 0.5, ta: 11.0 },
    sing: { path: [[124, F1Y], [272, F1Y], [304, 296], [310, 296]], d0: 0.0, ta: 10.8 },
    reaper: { path: [[198, F1Y], [249, F1Y]], d0: 0.8, ta: 10.6 },
    zombie: { path: [[74, FCY], [264, FCY], [294, 341]], d0: 0.2, ta: 11.3 },
  };
  for (const k in CAST) CAST[k].len = plen(CAST[k].path);
  // where is a cast member, and what are they doing?
  function where(name, t) {
    const C = CAST[name];
    if (t < T_BELL || t >= T_LIGHT) return { mode: 'home' };
    const go = T_RUN + C.d0;
    if (t < go) return { mode: 'freeze' };
    if (t < C.ta) { const a = along(C.path, (t - go) / (C.ta - go)); return { mode: 'run', x: a.x, y: a.y, dir: a.dir }; }
    const end = C.end || C.path[C.path.length - 1];
    return { mode: t < T_POSE ? 'ready' : t < T_SIGH ? 'pose' : 'slump', x: end[0], y: end[1], dir: 1 };
  }
  const runPh = (t) => fl(t * 12) & 3;

  // marks over heads when the bell rings
  const MARKS = [];
  function mark(x, y) { MARKS.push([Math.round(x), Math.round(y)]); }
  function drawMarks(t) {
    if (t < T_BELL + 0.15 || t >= T_RUN + 0.1) return;
    TG = SC; pen(MX, R_EXT);
    for (const [x, y] of MARKS) {
      const j = (fl(t * 15) & 1);
      rect(x - 1, y - 7 - j, 3, 7, 0); rect(x - 1, y - 9 - j, 3, 1, 0);
      vl(x, y - 6 - j, y - 3 - j, 8); put(x, y - 1 - j, 8); put(x, y - 2 - j, 0);
    }
  }
  // dust puffs behind runners
  function dust(x, y, t, dir) { TG = SC; pen(MR, roomAt(x, y - 2)); const k = fl(t * 12) % 3; for (let i = 0; i < 2 + k; i++) put(x - dir * (4 + i * 2), y - 1 - (i & 1), 31); }

  /* ---------------------------------------------------------------- each member of the cast */
  let COMB = null, SIGH = null, AIR = null, IRON = null, JAW = null, POUR = null;
  function doVamp(t, q) {
    const w = where('vamp', t), C = CAST.vamp, go = T_RUN + C.d0;
    const p = { aF: -10, aB: 10, cape: 0, headName: 'vamp' };
    let x = 56, y = F4Y, flip = false;
    if (w.mode === 'run') {
      flyer(w.x, w.y, fl(t * 14), true, { room: roomAt(w.x, w.y) || R_HALL });
    } else {
      if (w.mode === 'home' || w.mode === 'freeze') {
        const u = (w.mode === 'freeze' ? T_BELL : q) % 5;
        if (u < 1.0) { p.aF = 150; p.aB = 140; p.headName = 'vampScare'; p.lean = 1; }
        else if (u < 1.6) { p.aF = 20; p.aB = 15; }
        else if (u < 2.6) { p.aF = 100; p.aB = 100; p.cape = 1; p.headName = 'vampScare'; }
        else if (u < 3.1) { p.aF = 40; p.aB = 40; p.hdy = 1; }
        else if (u < 4.6) { p.aF = 165 + ((fl(q * 6) & 1) ? 8 : -8); p.comb = true; }
        if (w.mode === 'freeze') { p.headName = 'vamp'; p.comb = false; p.aF = 30; p.aB = 20; mark(x + 1, y - 30); }
      } else {
        x = w.x; y = w.y;
        if (w.mode === 'ready') { p.aF = 30; p.aB = 20; }
        if (w.mode === 'pose') { p.aF = 120; p.aB = 140; p.cape = 1.2; p.headName = 'vampScare'; p.lean = 1; }
        if (w.mode === 'slump') {
          p.aF = 5; p.aB = 5; p.hdy = 1;
          if (t >= T_SIGH && t < T_CANDY) { p.hdy = 2; SIGH = [x + 4, y - 30, t - T_SIGH]; flip = t > T_SIGH + 0.25; if (flip) p.aF = 60; }
          else if (t >= T_CANDY && t < T_CANDY + 0.25) { flip = true; p.aF = 70; p.candy = true; }
          else if (t >= T_CANDY + 0.25 && t < T_LEAVE) { p.aF = 85; p.candy = t < T_CANDY + 0.45; p.hdy = 1; }
        }
      }
      if (flip) p.flip = true;
      actor('vamp', x, y, p);
    }
    if (t >= go && t < go + 0.4) poof(56, F4Y - 14, (t - go) / 0.4);
    if (t >= C.ta && t < C.ta + 0.4) poof(306, F1Y - 14, (t - C.ta) / 0.4);
  }
  function doMummy(t, q) {
    const w = where('mummy', t);
    const p = { aF: -5, aB: 5 };
    let x = 232, y = F4Y, flip = false;
    if (w.mode === 'home' || w.mode === 'freeze') {
      const u = (w.mode === 'freeze' ? T_BELL : q) % 2.5;
      p.aF = 150 + ((fl(q * 8) & 1) ? 6 : -6); p.brush = true; p.foam = u > 1.2;
      if (w.mode === 'freeze') { p.aF = 140; mark(x + 1, y - 27); }
    } else if (w.mode === 'run') {
      x = w.x; y = w.y; flip = w.dir < 0;
      p.run = runPh(t); p.aF = 100; p.aB = 80; p.spin = fl(t * 10); dust(x, y, t, w.dir || 1);
    } else {
      x = w.x; y = w.y;
      if (w.mode === 'pose') { p.aF = 95; p.aB = 90; p.lean = 1; }
      else if (w.mode === 'slump') p.hdy = 1;
      else p.aF = 20;
    }
    if (flip) p.flip = true;
    actor('mummy', x, y, p);
  }
  function trailLen(t) {
    // the unrolled bandage (in px along the route) grows while he brushes and reels in when he runs
    const full = 330, L0 = 40;
    if (t < T_BELL) return lerp(L0, full, t / T_BELL);
    if (t < T_RUN + 0.25) return full;
    if (t < T_RUN + 1.4) return full * (1 - (t - T_RUN - 0.25) / 1.15);
    if (t < T_LIGHT) return 0;
    return L0 * clamp((t - T_LIGHT) / (D - T_LIGHT), 0, 1);
  }
  const TRAIL = [[229, 144], [231, 151], [272, 151], [308, 179], [304, 179], [272, 207], [308, 235], [304, 235], [272, 263], [308, 295], [304, 295], [272, 331], [300, 331]];
  function drawTrail(t) {
    const L = trailLen(t); if (L < 1) return;
    const tot = plen(TRAIL);
    TG = SC;
    const n = Math.ceil(L);
    for (let s = 0; s <= n; s++) {
      const a = along(TRAIL, s / tot);
      pen(MR, roomAt(a.x, a.y - 1));
      put(a.x, a.y, (s % 7 === 0) ? 31 : 33); put(a.x, a.y - 1, s % 3 === 0 ? 32 : 33);
    }
  }
  function doWolf(t, q) {
    const w = where('wolf', t);
    const p = { aF: 10, aB: 10, poof: 0 };
    let x = 46, y = F3Y, flip = true;
    if (w.mode === 'home' || w.mode === 'freeze') {
      const u = (w.mode === 'freeze' ? T_BELL : q) % 5;
      p.sit = true; y = F3Y - 6;
      if (u < 3.3) { p.poof = u / 3.3; p.aF = 160; p.dryer = true; AIR = [x - 10, y - 20, q]; }
      else if (u < 4.2) { p.poof = 1 - (u - 3.3) / 0.9; p.aF = 170 + ((fl(q * 8) & 1) ? 6 : -6); p.aB = 160; }
      else { p.poof = 0; p.aF = 30; }
      if (w.mode === 'freeze') { p.headName = 'wolf'; AIR = null; mark(x - 1, y - 30); }
    } else if (w.mode === 'run') {
      x = w.x; y = w.y; flip = w.dir < 0; p.poof = 1;
      p.run = runPh(t); p.aF = 110; p.aB = 70; p.lean = 2; dust(x, y, t, w.dir || 1);
    } else {
      x = w.x; y = w.y; flip = false; p.poof = 0.9;
      if (w.mode === 'pose') { p.aF = 150; p.aB = 160; p.crouch = 2; p.headName = 'wolfHowl'; }
      else if (w.mode === 'slump') { p.hdy = 1; p.poof = 0.6; }
    }
    if (flip) p.flip = true;
    actor('wolf', x, y, p);
  }
  function doFrank(t, q) {
    const w = where('frank', t);
    const p = { aF: 0, aB: 0, jacket: 0 };
    let x = 140, y = F3Y, flip = true;
    if (w.mode === 'home' || w.mode === 'freeze') {
      const u = (w.mode === 'freeze' ? T_BELL : q) % 4;
      const stroke = Math.sin(q * Math.PI) * 0.5 + 0.5;
      p.aF = 60 + stroke * 30; p.iron = true; p.aB = 20;
      IRON = [x - 8 - stroke * 9, F3Y - 21, q];
      p.zap = u > 2.0 && u < 2.3;
      if (w.mode === 'freeze') { p.zap = false; mark(x, y - 34); }
    } else if (w.mode === 'run') {
      x = w.x; y = w.y; flip = w.dir < 0;
      p.run = runPh(t); p.jacket = 1; p.aF = 95; p.aB = 60; p.lean = 1; dust(x, y, t, w.dir || 1);
    } else {
      x = w.x; y = w.y; flip = false; p.jacket = 1;
      if (w.mode === 'pose') { p.aF = 92; p.aB = 88; }
      else if (w.mode === 'slump') p.hdy = 1;
    }
    if (flip) p.flip = true;
    actor('frank', x, y, p);
  }
  function doKnight(t, q) {
    const w = where('knight', t);
    const p = { aF: 10, aB: 10 };
    let x = 234, y = F3Y, flip = true;
    if (w.mode === 'home' || w.mode === 'freeze') {
      // polishing his own head on its cushion
      p.aF = 78 + Math.sin(q * TAU * 2) * 10; p.cloth = true; p.lean = 1; p.aB = 20;
      if (w.mode === 'freeze') { p.aF = 30; p.cloth = false; mark(x - 2, y - 26); }
    } else if (w.mode === 'run') {
      x = w.x; y = w.y; flip = w.dir < 0;
      p.run = runPh(t); p.aF = 60; p.aB = 60; p.helm = HELM; dust(x, y, t, w.dir || 1);
    } else {
      x = w.x; y = w.y; flip = false;
      if (w.mode === 'ready') { p.aF = 50; p.helm = HELM; }
      if (w.mode === 'pose') { p.aF = 115; p.aB = 160; p.helm = HELM_ANGRY; p.lean = 1; }
      if (w.mode === 'slump') { p.aF = 25; p.helm = HELM; p.hdy = 1; }
    }
    if (flip) p.flip = true;
    actor('knight', x, y, p);
  }
  function doReaper(t, q) {
    const w = where('reaper', t);
    const p = { aF: 70, aB: 80 };
    let x = 198, y = F1Y, flip = false;
    if (w.mode === 'home' || w.mode === 'freeze') {
      p.sit = true; p.knit = fl(q * 6); p.aF = 72 + ((fl(q * 6) & 1) ? 5 : -5);
      if (w.mode === 'freeze') { p.knit = 0; p.aF = 80; mark(x + 1, y - 30); }
    } else if (w.mode === 'run') {
      x = w.x; y = w.y; p.run = runPh(t); p.aF = 110; p.scythe = 1;
    } else {
      x = w.x; y = w.y;
      if (w.mode === 'ready') { p.aF = 60; p.scythe = 1; }
      if (w.mode === 'pose') { p.aF = 170; p.aB = 150; p.scythe = 2; p.headName = 'reaperScare'; }
      if (w.mode === 'slump') { p.aF = 15; p.scythe = 1; p.hdy = 1; }
    }
    if (flip) p.flip = true;
    actor('reaper', x, y, p);
  }
  function scarfLen(t) {
    if (t < T_BELL) return lerp(30, 64, t / T_BELL);
    if (t < T_LIGHT) return 64;
    return lerp(26, 30, (t - T_LIGHT) / (D - T_LIGHT));
  }
  function drawScarf(t) {
    // the reaper's endless scarf: from the needles, down the chair, along the rug
    const w = where('reaper', t), knitting = w.mode === 'home' || w.mode === 'freeze';
    const pts = knitting ? [[207, 316], [208, 324], [206, 331], [182, 331], [182, 324]] : [[210, 331], [182, 331], [182, 324]];
    const L = scarfLen(t), tot = plen(pts);
    TG = SC; pen(MR, R_PARL);
    for (let s = 0; s < Math.min(L, tot); s++) { const a = along(pts, s / tot); const c = (fl(s / 3) & 1) ? 16 : 37; put(a.x, a.y, c); put(a.x + (a.y > 330 ? 0 : 1), a.y - (a.y > 330 ? 1 : 0), c); }
    if (!knitting) { line(211, 329, 216, 326, 31); line(211, 326, 216, 329, 31); }
  }
  function doWitch(t, q) {
    const w = where('witch', t);
    const p = { aF: 60, aB: 30 };
    let x = 60, y = F2Y, flip = true, broom = false;
    if (w.mode === 'home' || w.mode === 'freeze') {
      const u = (w.mode === 'freeze' ? T_BELL : q);
      const a = u * TAU / 1.25;
      p.aF = 75 + Math.sin(a) * 18; p.paddle = true; p.lean = Math.cos(a) > 0 ? 1 : 0;
      if (w.mode === 'freeze') mark(x, y - 33);
    } else if (w.mode === 'run') {
      x = w.x; y = w.y; flip = w.dir < 0; broom = true; p.sit = true; p.aF = 70; p.aB = 60;
    } else {
      x = w.x; y = w.y; flip = false; broom = true; p.sit = true;
      if (w.mode === 'pose') { p.aF = 160; p.aB = 150; }
      else if (w.mode === 'slump') { p.hdy = 1; p.aF = 40; }
      y += Math.round(Math.sin(t * 4) * 1);
    }
    if (broom) {
      TG = SC; pen(MR, roomAt(x, y - 4));
      const f = flip ? -1 : 1;
      line(x - 12 * f, y - 4, x + 10 * f, y - 6, 20);
      for (let k = 0; k < 5; k++) line(x - 12 * f, y - 4, x - 17 * f, y - 6 + k, 22);
    } else { TG = SC; pen(MR, R_KIT); line(107, 236, 105, 258, 20); for (let k = 0; k < 5; k++) line(105, 258, 102 + k * 1.5, 264, 22); }
    if (flip) p.flip = true;
    actor('witch', x, y, p);
    // the kitchen cat bats at the bubbles, then rides along on the broom
    if (w.mode === 'home' || w.mode === 'freeze') {
      const swat = (fl(q * 10) % 20) < 4 && w.mode === 'home';
      cat(44, 226, swat ? CAT_SWAT : CAT_SIT, true, { room: R_KIT });
      if (w.mode === 'freeze') mark(43, 214);
    } else cat(Math.round(x + (flip ? 6 : -6)), Math.round(y - 6), CAT_SIT, !flip, {});
  }
  function doSkel(name, t, q) {
    const w = where(name, t);
    const home = { drum: [50, F1Y], bass: [92, F1Y], sing: [124, F1Y] }[name];
    const p = { aF: 10, aB: 10, tie: name === 'sing', band: name === 'drum' };
    let x = home[0], y = home[1], flip = name === 'sing';
    const beat = fl(q * 4) & 1;
    if (w.mode === 'home' || w.mode === 'freeze') {
      const u = (w.mode === 'freeze' ? T_BELL : q) % 5;
      if (name === 'drum') { p.sit = true; y = F1Y - 5; p.sticks = true; p.aF = beat ? 60 : 100; p.aB = beat ? 100 : 60; }
      if (name === 'bass') { p.aF = 70 + (beat ? 10 : 0); p.aB = 40; p.hdy = beat; }
      if (name === 'sing') {
        p.sing = (fl(q * 5) & 1) === 1; p.aF = 120; p.aB = 20;
        if (u > 2.6 && u < 3.8) { p.jawOff = true; p.sing = false; if (u > 3.0) { p.holdJaw = true; p.aF = 60; } else JAW = [x - 4, F1Y - 22 + (u - 2.6) * 40, u]; }
        if (u >= 3.8 && u < 4.2) p.aF = 150;
      }
      if (w.mode === 'freeze') { mark(x, y - 26); p.sing = false; p.jawOff = false; p.holdJaw = false; JAW = null; }
    } else if (w.mode === 'run') {
      x = w.x; y = w.y; flip = w.dir < 0;
      p.run = runPh(t + (name === 'bass' ? 0.1 : 0)); p.aF = 140; p.aB = 150; dust(x, y, t, w.dir || 1);
      if (name === 'drum') p.sticks = true;
    } else {
      x = w.x; y = w.y; flip = name === 'sing';
      if (w.mode === 'pose') { p.aF = 150; p.aB = 160; p.sing = true; }
      else if (w.mode === 'slump') p.hdy = 1;
      if (name === 'drum') p.sticks = true;
    }
    if (flip) p.flip = true;
    actor('skel', x, y, p);
  }
  function doZombie(t, q) {
    const w = where('zombie', t);
    const p = { aF: 40, aB: 10 };
    let x = 74, y = FCY, flip = true;
    if (w.mode === 'home' || w.mode === 'freeze') {
      const u = (w.mode === 'freeze' ? T_BELL : q) % 5;
      if (u < 2.1) { p.aF = 80 + Math.sin(u * 6) * 6; p.scoop = true; POUR = [x - 13, FCY - 12, u]; }
      else if (u < 2.9) { p.aF = 150; p.candy = true; }
      else if (u < 3.8) { p.aF = 10; p.hdy = (fl(q * 8) & 1); }
      else { p.aF = 20; flip = (fl(q * 2) & 1) === 0; }
      if (w.mode === 'freeze') { p.hdy = 0; POUR = null; mark(x, y - 28); }
    } else if (w.mode === 'run') {
      x = w.x; y = w.y; flip = w.dir < 0;
      p.run = runPh(t); p.bowl = true; p.aF = 85;
    } else {
      x = w.x; y = w.y; flip = false; p.bowl = true; p.aF = 85;
      if (w.mode === 'pose') { p.aF = 90; p.aB = 95; p.lean = 1; }
      if (w.mode === 'slump') p.hdy = 1;
      if (t >= T_SIGH && t < T_CANDY + 0.2) p.aF = 70;
    }
    if (flip) p.flip = true;
    actor('zombie', x, y, p);
  }
  // the invisible reader: a hat, spectacles, a scarf, gloves and shoes
  function doInvis(t, q) {
    const w = where('invis', t);
    let x = 134, y = F4Y, flip = false;
    const p = {};
    const L = layer(28, 42); TG = L; PM = MS;
    const ox = 14, oy = 40;
    let sit = false, ph = -1, gl, book = false, hatUp = 0, cup = null;
    if (w.mode === 'home' || w.mode === 'freeze') {
      sit = true;
      const u = q % 5;
      book = true;
      gl = [[4, 7], [10, 7]];
      if (u >= 3.0 && u < 4.2) { gl = [[4, 7], [3, 2]]; cup = [3, 1]; }
      if (w.mode === 'freeze') { gl = [[-4, -4], [8, -5]]; cup = null; mark(x + 1, y - 34); }
    } else if (w.mode === 'run') {
      x = w.x; y = w.y; flip = w.dir < 0; ph = runPh(t);
      gl = [[-5, 8 + (ph & 1)], [5, 8 - (ph & 1)]];
    } else {
      x = w.x; y = w.y;
      if (w.mode === 'ready') gl = [[-4, 11], [4, 11]];
      if (w.mode === 'pose') { gl = [[-7, -5], [6, -12]]; hatUp = 1; }
      if (w.mode === 'slump') gl = [[-4, 12], [4, 12]];
    }
    const hx = ox + (sit ? 1 : 0), hy = oy - (sit ? 24 : 30) + (w.mode === 'slump' ? 1 : 0) + (ph >= 0 ? (ph & 1) : 0);
    // shoes
    if (sit) { rect(ox + 9, oy - 1, 3, 2, 19); rect(ox + 13, oy - 1, 3, 2, 19); }
    else {
      const fx = ph < 0 ? [-2, 2] : [[-4, 3], [-1, 1], [3, -4], [1, -1]][ph], lf = ph < 0 ? [0, 0] : [[0, 0], [2, 0], [0, 0], [0, 2]][ph];
      rect(ox + fx[0] - 1, oy - 1 - lf[0], 3, 2, 19); rect(ox + fx[1] - 1, oy - 1 - lf[1], 3, 2, 18);
    }
    // bowler hat, raised in the pose
    const hatY = hy - 7 - (hatUp ? 6 : 0), hatX = hx + (hatUp ? 6 : 0);
    hl(hatX - 4, hatX + 4, hatY + 3, 19); rect(hatX - 3, hatY, 7, 3, 19); hl(hatX - 3, hatX + 3, hatY + 2, 16); put(hatX - 2, hatY, 20);
    // spectacles
    for (const gx of [hx - 1, hx + 3]) { put(gx - 1, hy, 31); put(gx + 1, hy, 31); put(gx, hy - 1, 31); put(gx, hy + 1, 31); PM = ME; put(gx, hy, 7); PM = MS; }
    put(hx + 1, hy, 31);
    // scarf
    hl(hx - 3, hx + 3, hy + 5, 16); hl(hx - 2, hx + 2, hy + 6, 15);
    const tl = ph >= 0 ? -3 : 0; line(hx - 2, hy + 6, hx - 3 + tl, hy + 11 - (ph >= 0 ? 3 : 0), 16);
    // gloves (and the book, and the floating teacup)
    if (book) { const bx = hx + 5, by = hy + 4; rect(bx, by, 7, 5, 15); hl(bx + 1, bx + 5, by + 1, 33); hl(bx + 1, bx + 5, by + 2, 32); vl(bx + 3, by, by + 4, 14); if ((q % 2.5) > 2.2) vl(bx + 3 + fl(((q % 2.5) - 2.2) * 10), by - 1, by + 3, 33); }
    for (const [gx, gy] of gl) { rect(hx + gx, hy + gy, 2, 2, 33); put(hx + gx + (gx < 0 ? 0 : 1), hy + gy - 1, 33); }
    if (cup) { const [cx, cy] = cup; rect(hx + cx - 1, hy + cy, 3, 2, 33); put(hx + cx + 2, hy + cy, 33); }
    if (flip) flipL(L);
    outline(L, 0);
    stamp(L, x - ox, y - oy, x, y - 14);
    EYES.push([Math.round(x - ox + (flip ? 27 - hx - 2 : hx - 1)), Math.round(y - oy + hy), 7]);
    // the book stays on the chair when he runs; the teacup on its table
    TG = SC; pen(MR, R_LIB);
    if (!book) { rect(136, 138, 6, 2, 15); hl(137, 140, 138, 33); }
    if (!cup) { rect(142, 138, 3, 2, 33); put(145, 138, 33); }
  }
  function doGhosts(t, q) {
    const G = [
      { home: [158, 84], spot: [276, 215], path: [[158, 84], [220, 150], [276, 215]], d: 0.05 },
      { home: [182, 70], spot: [294, 210], path: [[182, 70], [250, 110], [294, 210]], d: 0.2 },
      { home: [206, 84], spot: [308, 224], path: [[206, 84], [290, 120], [308, 224]], d: 0.35 },
    ];
    G.forEach((g, k) => {
      const go = T_RUN + g.d, arrive = go + 1.4;
      let x = g.home[0], y = g.home[1];
      const pp = { ph: fl(q * 6) + k, flip: k === 2 };
      const bob = Math.round(Math.sin(q * TAU / 2.5 + k * 2) * 1.2);
      if (t < T_BELL || t >= T_LIGHT) {
        y += bob;
        if (k === 0) pp.hold = teapot(q);
        if (k === 1) pp.hold = biscuit(q);
        if (k === 2) pp.hold = teacup(q);
      } else if (t < go) { y += bob; pp.mouth = true; mark(x, y - 16); }
      else if (t < arrive) { const a = along(g.path, (t - go) / 1.4); x = a.x; y = a.y; pp.flip = a.dir < 0; pp.armsUp = true; pp.mouth = true; }
      else { x = g.spot[0]; y = g.spot[1] + bob; pp.flip = false; if (t >= T_POSE && t < T_SIGH) { pp.armsUp = true; pp.mouth = true; } }
      pp.room = roomAt(x, y - 6);
      if (pp.room === R_EXT) pp.room = R_HALL;
      ghost(x, y, pp);
    });
  }
  function teapot(q) {
    return (L) => {
      const u = q % 4, tilt = u > 0.8 && u < 2.4;
      TG = L; PM = MS;
      if (tilt) { rect(13, 7, 5, 4, 38); put(17, 8, 38); put(18, 9, 38); put(15, 6, 39); PM = ME; vl(18, 10, 12, 21); PM = MS; }
      else { rect(14, 9, 4, 4, 38); put(18, 10, 38); put(15, 8, 39); }
    };
  }
  function biscuit(q) {
    return (L) => {
      const u = (q % 5) * 5 / 5; TG = L; PM = MS;
      // the biscuit goes down into the ghost's own body and comes out half eaten
      const by = u < 1 ? 9 : u < 2.5 ? 9 + (u - 1) * 4 : u < 3.5 ? 15 - (u - 2.5) * 6 : 9;
      const half = u >= 2.5;
      const inside = by > 10.5;
      PM = ME; for (let j = 0; j < 2; j++) for (let i = 0; i < (half ? 2 : 3); i++) { const X = 13 + i, Y = Math.round(by) + j; if (inside && ((X + Y) & 1)) continue; put(X, Y, i === 0 && j === 0 ? 22 : 21); } PM = MS;
      if (u > 3.6 && u < 4.4) { PM = ME; put(12, 16 + fl((u - 3.6) * 5), 20); PM = MS; }
    };
  }
  function teacup(q) {
    return (L) => {
      const u = q % 2.5; TG = L; PM = MS;
      const up = u > 0.8 && u < 1.7;
      rect(5, up ? 8 : 10, 3, 2, 33); put(4, up ? 9 : 11, 33);
      if (u > 1.0 && u < 2.3) { PM = ME; const yy = 9 + fl((u - 1.0) * 7); for (let j = 0; j < 2; j++) if (((7 + yy + j) & 1) === 0 || yy + j > 15) put(7, yy + j, 21); PM = MS; } // the tea runs straight through
    };
  }
  function doSpider(t, q) {
    // web building from the moment the lights come back on; torn when the bats and the broom go by
    const tau = ((t - T_LIGHT) % D + D) % D;
    const prog = clamp(tau / 9.6, 0, 1);
    const torn = t >= T_RUN + 0.4 && t < T_LIGHT;
    const cx = 310, cy = 102;
    TG = SC; pen(MR, R_HALL);
    const rays = 7;
    const ang = (k) => Math.PI * 0.5 + (k / (rays - 1)) * Math.PI * 0.55;
    let sx = cx, sy = cy;
    if (!torn) {
      const nr = Math.min(rays, fl(prog * 2.2 * rays));
      for (let k = 0; k < nr; k++) { const a = ang(k); line(cx, cy, cx + Math.cos(a) * 15, cy - Math.sin(a) * 5 + Math.max(0, -Math.cos(a)) * 0, 31); }
      const sp = clamp((prog - 0.45) / 0.55, 0, 1);
      const turns = fl(sp * 4);
      for (let r = 1; r <= turns; r++) {
        const rr = 3 + r * 2.6;
        for (let k = 0; k + 1 < rays; k++) { const a = ang(k), b = ang(k + 1); line(cx + Math.cos(a) * rr, cy - Math.sin(a) * rr * 0.33, cx + Math.cos(b) * rr, cy - Math.sin(b) * rr * 0.33, 31); }
      }
      const a = ang(Math.min(rays - 1, nr)); const rr = turns ? 3 + turns * 2.6 : 15 * ((prog * 2.2 * rays) % 1);
      sx = cx + Math.cos(a) * rr; sy = cy - Math.sin(a) * rr * 0.33;
    } else {
      line(cx, cy, cx - 6, cy - 4, 31); line(cx, cy, cx - 14, cy + 1, 31); line(cx - 2, cy + 1, cx - 4, cy + 6, 31);
    }
    if (t >= T_BELL && t < T_RUN) mark(sx, sy - 3);
    let x = sx, y = sy;
    if (t >= T_RUN && t < T_LIGHT) {
      const down = sstep(T_RUN, T_RUN + 2.2, t);
      x = 313; y = lerp(cy, 254, down);
      vl(313, 97, Math.round(y) - 1, 31);
    }
    const slot = SLOTS.length; SLOTS.push([DIM, DIM, DIM]);
    const spot = (X, Y, c) => { X = Math.round(X); Y = Math.round(Y); if (X < 0 || Y < 0 || X >= AW || Y >= AH) return; const j = Y * AW + X; SC.c[j] = c + 1; SC.m[j] = MS; SL[j] = slot; };
    const lg = fl(q * 8) & 1;
    spot(x, y, 0); spot(x + 1, y, 0); spot(x, y + 1, 0); spot(x + 1, y + 1, 0);
    for (const s of [-1, 1]) { spot(x + (s > 0 ? 2 : -1), y - lg, 0); spot(x + (s > 0 ? 3 : -2), y + 1 - lg, 0); spot(x + (s > 0 ? 2 : -1), y + 2, 0); }
    spot(x, y, 16);
  }
  function doBats(t, q) {
    // six bats on the perch; at the bell they pour out of the turret and circle the porch
    for (let k = 0; k < 6; k++) {
      const hx = 17 + k * 7, go = T_RUN + 0.15 + k * 0.09, arrive = go + 1.5;
      if (t < go || t >= T_LIGHT) {
        const L = layer(7, 8); TG = L; PM = MS;
        const stretch = k === 3 && (q % 5) > 4.2;
        const sway = k === 1 ? Math.round(Math.sin(t * TAU / 2)) : 0;
        if (stretch) spr(['..o.o..', '.ooooo.', 'ooooooo', 'o.ooo.o', '..eoe..', '..o.o..'], { o: 12, e: 16 }, 0, 1);
        else spr(['.o.o.', '.ooo.', 'ooooo', 'ooooo', '.eoe.', '.o.o.'], { o: 12, e: 16 }, 1 + sway, 1);
        outline(L, 0);
        stamp(L, hx - 3, 47, hx, 52, { room: R_TUR });
        if (k === 2 && t >= T_BELL && t < T_RUN) mark(hx + 3, 46);
        continue;
      }
      const spot = [330 + (k % 3) * 10 + Math.cos(t * 5 + k) * 4, 214 + fl(k / 3) * 12 + Math.sin(t * 6 + k * 2) * 3];
      let x, y;
      if (t < arrive) {
        const u = (t - go) / 1.5;
        const a = along([[hx, 52], [60 + k * 8, 26], [200 + k * 10, 12 + (k & 1) * 6], spot], io(u));
        x = a.x; y = a.y;
      } else { x = spot[0]; y = spot[1]; }
      flyer(x, y, fl(t * 12) + k, t < arrive && y < 150, { room: R_EXT });
    }
  }
  function doPlant(t, q) {
    // the giant flytrap in the conservatory: snaps at a moth, and at the bell stretches its neck round the door
    const bx = 196, by = 250;
    const homeAt = (qq) => [196 + 16 * Math.cos((qq - 0.35) * TAU / 4), 230 + 6 * Math.sin((qq - 0.35) * TAU / 2)];
    let hx, hy, open, moth = true, look = 1;
    if (t < T_BELL || t >= T_LIGHT) { [hx, hy] = homeAt(q); const u = q % 2; open = u < 1.4 ? 1 : u < 1.6 ? 0 : 0.6; look = Math.cos((q - 0.35) * TAU / 4) > 0.6 ? -1 : 1; }
    else {
      const h0 = homeAt(st10(T_BELL)), k = sstep(T_RUN + 0.6, T_RUN + 2.2, t);
      hx = lerp(h0[0], 276, k); hy = lerp(h0[1], 238, k);
      open = t < T_RUN ? 0.3 : t >= T_POSE && t < T_SIGH ? 1 : 0.4;
      if (t >= T_SIGH) { hy += 3; open = 0.15; }
      if (t < T_RUN) mark(hx, hy - 8);
      moth = t < T_RUN;
    }
    // stalk: a quadratic curve from the pot, through the doorway when it reaches
    const reach = clamp((hx - 215) / 60, 0, 1);
    const cx = lerp((bx + hx) / 2 - 8, 240, reach), cy = lerp(Math.max(by, hy) + 6, 262, reach);
    TG = SC;
    for (let i = 0; i <= 60; i++) {
      const s = i / 60, a = (1 - s) * (1 - s), b = 2 * s * (1 - s), c = s * s;
      const X = a * bx + b * cx + c * (hx - 5 * look), Y = a * by + b * cy + c * hy;
      pen(MR, roomAt(X, Y) || R_CONS);
      put(X, Y, 27); put(X + 1, Y, 26);
      if (i === 18 || i === 38) { ell(X - 3, Y - 1, 3, 1.4, 27); ell(X + 3, Y - 2, 3, 1.4, 28); }
    }
    const L = layer(14, 14); TG = L; PM = MS;
    const g = Math.round(open * 2.5);
    ell(6, 5 - g, 5.5, 2.6, 27); ell(6, 8 + g, 5.5, 2.6, 27);
    hl(2, 10, 4 - g, 28); put(4, 3 - g, 28); put(8, 3 - g, 28);
    if (g > 0) { rect(2, 6 - g + 1, 10, 2 * g, 16); for (let x = 2; x < 12; x += 2) { put(x, 7 - g, 33); put(x + 1, 6 + g + 1, 33); } }
    else hl(1, 11, 7, 25);
    put(5, 1 - g, 33); put(6, 1 - g, 0);
    if (look < 0) flipL(L);
    outline(L, 0);
    stamp(L, hx - 6, hy - 7, hx, hy, { room: roomAt(hx, hy) || R_CONS });
    if (moth) { TG = SC; pen(MX, R_CONS); const mx = 196 + 22 * Math.cos(q * TAU / 4), my = 226 + 7 * Math.sin(q * TAU / 2), f = fl(t * 15) & 1; put(mx, my, 33); put(mx - 1, my - f, 32); put(mx + 1, my - f, 32); }
  }
  function doNeighbour(t, q) {
    // the skeleton in the crypt under the garden reads by candlelight; the doorbell is not his problem
    TG = SC; pen(MR, R_TOMB);
    const L = layer(48, 14); TG = L; PM = MS;
    spr(HEADS.skull.rows, HEADS.skull.map, 2, 3);
    for (let x = 10; x < 26; x += 2) vl(x, 6, 9, 33); hl(9, 26, 7, 32);
    hl(26, 40, 8, 33); hl(26, 40, 9, 32); rect(40, 6, 2, 4, 33);
    const read = t < T_BELL || t >= T_LIGHT;
    if (read) {
      rect(12, 1, 8, 5, 15); hl(13, 18, 2, 33); hl(13, 18, 3, 32); vl(16, 1, 5, 14); if ((q % 5) > 4.6) vl(16 + fl(((q % 5) - 4.6) * 8), 0, 4, 33);
      put(11, 4, 33); put(20, 4, 33);
    } else {
      ell(5, 6, 5, 3.2, 33); hl(1, 9, 8, 32); // a pillow over his head
      put(12, 6, 33); put(13, 5, 33);
    }
    outline(L, 0);
    stamp(L, 136, 413, 160, 420, { room: R_TOMB });
    if (t >= T_BELL && t < T_RUN) mark(141, 410);
    if (!read && t >= T_RUN) { TG = SC; pen(MR, R_TOMB); const z = (t * 1.5) % 1; text('Z', 168 + fl(z * 8), 418 - fl(z * 6), 31); text('Z', 168 + fl(((z + 0.5) % 1) * 8), 418 - fl(((z + 0.5) % 1) * 6), 32); }
  }
  function doRocker(t) {
    // the attic rocking chair rocks on its own (nobody ever sits in it)
    TG = SC; pen(MR, R_ATT);
    const a = 0.2 * Math.sin(t * TAU / 2), cx = 228, cy = 91;
    const P = (x, y) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)];
    const L2 = (x0, y0, x1, y1, c) => { const p = P(x0, y0), r = P(x1, y1); line(p[0], p[1], r[0], r[1], c); };
    for (let k = -8; k < 8; k++) { const p = P(cx + k, cy - (k * k) / 26); put(p[0], p[1], 20); }
    L2(222, 89, 222, 82, 19); L2(234, 89, 234, 82, 19); L2(221, 82, 235, 82, 21); L2(221, 83, 235, 83, 20);
    L2(222, 82, 219, 66, 20); L2(225, 82, 222, 67, 19); for (let y = 70; y < 82; y += 4) L2(220 + (82 - y) * -0.2, y, 224 + (82 - y) * -0.2, y, 19);
    L2(233, 82, 236, 76, 20); L2(236, 76, 231, 76, 20);
  }
  function doBrain(t, q) {
    TG = SC; pen(ME, R_CEL);
    for (let y = 358; y < 371; y++) for (let x = 241; x < 251; x++) put(x, y, bay(x, y) < 0.5 ? 28 : 27);
    for (let k = 0; k < 4; k++) { const u = ((q + k * 0.37) % 1.25) / 1.25; put(242 + ((k * 3) % 8), 370 - fl(u * 12), 29); }
    pen(MR, R_CEL);
    const pulse = (fl(q * 4) & 1);
    ell(246, 362, 4 + pulse * 0.5, 3, 17); hl(243, 249, 362, 16); put(245, 360, 16); put(247, 364, 16);
    const lk = Math.round(Math.sin(q * TAU / 5) * 1.4);
    pen(MX, R_CEL); put(244 + lk, 363, 33); put(248 + lk, 363, 33);
    if (t >= T_BELL && t < T_RUN) mark(246, 352);
    pen(ME, R_CEL); if (fl(q * 5) & 1) put(256, 364, 17); if (fl(q * 3) & 1) put(258, 364, 29);
  }

  /* ---------------------------------------------------------------- props that live */
  function liveProps(t, q, fi) {
    TG = SC;
    const lit = DIM > 0.3;
    const flame = (x, y, room, big) => {
      if (!lit) return;
      pen(ME, room);
      const f = ih(fl(t * 12), x * 7 + y, 5);
      put(x, y, 23); put(x, y - 1, f < 0.5 ? 24 : 23); if (big || f > 0.7) put(x, y - 2, 22);
      if (f < 0.25) put(x + 1, y - 1, 22);
    };
    const gas = (x, y, room) => { if (!lit) return; pen(ME, room); const f = ih(fl(t * 8), x, 6); put(x, y, 29); put(x, y - 1, f < 0.5 ? 28 : 29); put(x + (f < 0.3 ? 1 : 0), y - 2, 28); };
    // candles
    flame(85, 125, R_VAMP); flame(82, 123, R_VAMP); flame(88, 123, R_VAMP);
    flame(182, 73, R_ATT, true);
    flame(229, 164, R_ARM); flame(215, 290, R_PARL); flame(240, 290, R_PARL);
    flame(38, 351, R_CEL); flame(190, 427, R_TOMB, true); flame(252, 237, R_CONS);
    // chandelier
    pen(MR, R_BALL);
    hl(85, 103, 281, 21); hl(87, 101, 282, 20); for (const x of [85, 90, 94, 98, 103]) { vl(x, 278, 280, 33); flame(x, 277, R_BALL); }
    vl(94, 282, 285, 21); put(94, 286, 22);
    // gas sconces
    gas(229, 115, R_BATH); gas(280, 112, R_HALL); gas(269, 172, R_HALL); gas(269, 228, R_HALL); gas(269, 290, R_HALL);
    // the reading lamp
    if (lit) { pen(ME, R_LIB); hl(145, 149, 126, 24); put(147, 127, 23); }
    // vanity bulbs
    if (lit) { pen(ME, R_WOLF); for (let k = 0; k < 5; k++) { put(18 + k * 4, 167, 23); put(18 + k * 4, 187, 23); } for (let k = 0; k < 4; k++) { put(16, 170 + k * 4, 23); put(35, 170 + k * 4, 23); } }
    // tesla lamp glow
    if (lit) { pen(ME, R_FRANK); const tg = ih(fl(t * 10), 1, 7); ell(168, 179, 2.5, 2, tg < 0.5 ? 29 : 28); if (tg > 0.6) line(168, 177, 165 + fl(tg * 6), 172, 29); }
    // fires: kitchen hearth, parlour, furnace
    if (lit) {
      pen(ME, R_KIT);
      for (let k = 0; k < 6; k++) { const x = 26 + k * 2, f = ih(fl(t * 12), k, 8), h = 2 + fl(f * 4); for (let j = 0; j < h; j++) put(x, 261 - j, j > 2 ? 23 : j > 0 ? 22 : 37); }
      pen(ME, R_PARL);
      for (let k = 0; k < 9; k++) { const x = 220 + k * 2, f = ih(fl(t * 12), k, 18), h = 3 + fl(f * 6); for (let j = 0; j < h; j++) put(x + (j > 3 ? (f < 0.5 ? 1 : 0) : 0), 330 - j, j > 4 ? 23 : j > 1 ? 22 : 37); }
      hl(219, 237, 331, 37);
      pen(ME, R_CEL); for (let x = 147; x < 157; x += 2) for (let y = 378; y < 383; y++) put(x + 1, y, ih(fl(t * 10), x + y, 11) < 0.5 ? 37 : 22);
    }
    // the brew, its bubbles, and the overflow
    pen(ME, R_KIT); hl(24, 42, 247, 28); hl(25, 41, 248, 27);
    const over = 0.5 + 0.5 * Math.sin(q * TAU / 5);
    for (let k = 0; k < 4; k++) { const dx = [24, 29, 38, 42][k]; const len = Math.round(over * (3 + k)); for (let j = 0; j < len; j++) put(dx, 249 + j, j === len - 1 ? 29 : 28); }
    if (over > 0.7) { hl(20, 24, 263, 28); hl(41, 46, 263, 28); }
    const per = [1.25, 2, 2.5, 1, 20 / 12, 20 / 14];
    for (let k = 0; k < 6; k++) {
      const u = ((q + k * 0.7) % per[k]) / per[k];
      const bx = 26 + ((k * 5) % 16) + Math.round(Math.sin(u * 7 + k) * 1.5), by = 246 - u * 26;
      const r = 1 + (k % 3 === 0 ? 1 : 0);
      if (u > 0.92) { put(bx - 1, by, 29); put(bx + 1, by, 29); put(bx, by - 1, 29); continue; }
      if (r > 1) { put(bx, by, 29); put(bx + 1, by, 28); put(bx, by + 1, 28); put(bx + 1, by + 1, 28); } else put(bx, by, 29);
    }
    // the trousers on the ironing board, while he is at it
    { const wf = where('frank', t); if (wf.mode === 'home' || wf.mode === 'freeze') { pen(MR, R_FRANK); rect(108, 185, 18, 3, 2); hl(108, 125, 185, 3); line(116, 185, 119, 187, 32); put(121, 186, 22); put(123, 186, 22); rect(125, 185, 3, 3, 3); } }
    // the knight's head, being polished on its cushion
    { const wk = where('knight', t); if (wk.mode === 'home' || wk.mode === 'freeze') { pen(MR, R_ARM); const H = (q % 2.5) > 2.3 ? HELM_BLINK : wk.mode === 'freeze' ? HELM_ANGRY : HELM; spr(H.rows, H.map, 209, 185, true); if (wk.mode === 'home') EYES.push([211, 190, 23]); } }
    // the reaper's scythe, leaning on the mantel while he knits
    { const wr = where('reaper', t); if (wr.mode === 'home' || wr.mode === 'freeze') { pen(MR, R_PARL); vl(246, 290, 331, 20); vl(247, 290, 331, 19); for (let k = 0; k < 11; k++) { const bx = 246 - k, by = 290 + Math.round((k * k) / 22) + (k < 2 ? 0 : 1); put(bx, by, 32); put(bx, by + 1, k > 1 && k < 10 ? 33 : 32); } } }
    // the trapdoor, open while the zombie is up the cellar stair
    { const wz = where('zombie', t); if (wz.mode !== 'home' && wz.mode !== 'freeze' && (wz.mode !== 'run' || t > CAST.zombie.ta - 0.6)) { pen(MR, R_HALL); for (let y = F1Y; y < F1Y + 4; y++) hl(287, 300, y, 10); rect(285, F1Y - 14, 2, 14, 19); vl(285, F1Y - 14, F1Y - 1, 20); } }
    // the vampire's mirror: no reflection, except the comb
    pen(ME, R_VAMP);
    for (let y = 119; y < 149; y++) for (let x = 65; x < 79; x++) {
      let c = 14; const u = (79 - x) % 8, v = (y - 119) % 10; if ((u === 4 && (v === 2 || v === 6)) || ((u === 3 || u === 5) && v === 4)) c = 15;
      if (y > 137) c = 13;
      if (x + (y - 119) * 0.6 > 70 && x + (y - 119) * 0.6 < 72) c = LITE[c];
      put(x, y, lit ? c : DARK[c]);
    }
    { const wv = where('vamp', t); const u = q % 5; COMB = wv.mode === 'home' && u >= 3.1 && u < 4.6 ? [58 + ((fl(q * 6) & 1) ? 1 : 0), F4Y - 25] : null; }
    if (COMB) { const mx = 2 * 66 - COMB[0], my = COMB[1]; hl(mx - 1, mx + 2, my, 32); put(mx - 1, my + 1, 32); put(mx + 1, my + 1, 32); }
    // grandfather clock pendulum and face
    pen(MR, R_HALL); const sw = Math.round(Math.sin(t * Math.PI) * 1.6);
    vl(286, 309, 318, 31); vl(286 + sw, 318, 321, 22); put(286 + sw, 322, 23);
    pen(lit ? ME : MR, R_HALL); ell(286.5, 301.5, 2.6, 2.6, 33); put(286, 299, 0); put(286, 300, 0); put(286, 301, 0); put(287, 301, 0);
    // porch lantern
    pen(ME, R_PORCH); const pf = ih(fl(t * 10), 2, 12); rect(323, 285, 3, 4, pf < 0.5 ? 22 : 23); put(324, 286, 24);
    // portraits' eyes follow the action
    for (const P of PORTRAITS) {
      const fx = FOCUS[P.room] !== undefined ? FOCUS[P.room] : P.x;
      const dx = clamp(Math.round((fx - P.x) / 18), -1, 1);
      pen(ME, P.room); put(P.x + dx, P.y, 0); put(P.x + 3 + dx, P.y, 0);
    }
    // chimney smoke and the bats around the moon
    pen(ME, R_EXT);
    for (let k = 0; k < 4; k++) { const u = ((t / 5 + k / 4) % 1); const sx = 244 + Math.round(Math.sin(u * 5 + k) * 3 + u * 12), sy = 16 - u * 16; if (sy >= 0) { put(sx, sy, 5); put(sx + 1, sy, 4); if (u < 0.5) put(sx, sy - 1, 4); } }
    for (let k = 0; k < 3; k++) {
      const a = t * TAU / 10 * (k === 1 ? -1 : 1) + k * 2.1;
      const bx = MOONX - 6 + Math.cos(a) * (22 + k * 6), by = MOONY + 4 + Math.sin(a) * (12 + k * 4);
      const f = (fl(t * 10) + k) % 3;
      spr(BAT_SM[f], { o: 0, e: 0 }, Math.round(bx) - 3, Math.round(by) - 2);
    }
    // the bell button glows while it is pressed
  }
  function liveFX(t, q, fi) {
    TG = SC;
    // Frankenstein's iron: steam and an arc of lightning
    if (IRON) {
      const [ix, iy, qq] = IRON; pen(ME, R_FRANK);
      for (let k = 0; k < 3; k++) { const u = ((qq * 1.5 + k / 3) % 1); const sx = ix + Math.round(Math.sin(u * 9 + k) * 1.5), sy = iy - 2 - u * 12; if (u < 0.85) { put(sx, sy, 7); if (k === 1) put(sx + 1, sy, 6); } }
      const zz = (qq % 4) > 2.0 && (qq % 4) < 2.3;
      if (zz) {
        let ax = ix + 2, ay = iy - 1; const bx = 134, by = F3Y - 26;
        for (let s = 0; s < 6; s++) { const nx = lerp(ix + 2, bx, (s + 1) / 6) + (s < 5 ? (ih(fi, s, 9) - 0.5) * 6 : 0), ny = lerp(iy - 1, by, (s + 1) / 6) + (s < 5 ? (ih(fi, s, 10) - 0.5) * 4 : 0); line(ax, ay, nx, ny, 8); ax = nx; ay = ny; }
        LV[R_FRANK][1][4] = 1.2;
      }
    }
    // the werewolf's dryer: hot air
    if (AIR) { pen(ME, R_WOLF); const [ax, ay, qq] = AIR; for (let k = 0; k < 3; k++) { const u = (qq * 3 + k / 3) % 1; hl(ax + 4 - fl(u * 6), ax + 5 - fl(u * 6), ay + k * 2 - 1, 22); } }
    // the zombie pours candy
    if (POUR) { pen(MR, R_CEL); const [px, py, u] = POUR; for (let k = 0; k < 3; k++) { const v = ((u * 2 + k / 3) % 1); put(px + (k - 1), py + fl(v * 7), [17, 28, 39][k]); } }
    // the singer's jaw falling
    if (JAW) { pen(MR, R_BALL); const [jx, jy] = JAW; hl(jx, jx + 4, Math.round(jy), 33); put(jx + 1, Math.round(jy) - 1, 33); put(jx + 3, Math.round(jy) - 1, 33); }
    // the vampire's sigh
    if (SIGH) { pen(ME, R_HALL); const [sx, sy, u] = SIGH; const r = fl(u * 8); put(sx + r, sy - r, 8); put(sx + r + 1, sy - r, 8); put(sx + r + 2, sy - r - 1, 7); }
  }
  function frontProps(t, q) {
    TG = SC; pen(MR, R_BALL);
    const home = where('drum', t).mode === 'home';
    const hit = home && (fl(q * 4) & 1);
    // drum kit: bass drum with a skull, snare, cymbal
    const dx = 58;
    ell(dx, 323, 5.5, 5.5, 33); ell(dx, 323, 4.5, 4.5, 16, (x, y, u) => (u < -0.5 ? 15 : 16));
    put(dx - 1, 321, 33); put(dx + 1, 321, 33); put(dx, 322, 33); put(dx - 1, 323, 33); put(dx, 323, 33); put(dx + 1, 323, 33); put(dx, 325, 33);
    rect(dx - 5, 328, 2, 2, 31); rect(dx + 3, 328, 2, 2, 31);
    rect(dx + 4, 317, 6, 3, 31); hl(dx + 4, dx + 9, 317, 33); vl(dx + 6, 320, 329, 30);
    vl(dx + 10, 312, 329, 30); hl(dx + 7 - (hit ? 0 : 1), dx + 13 + (hit ? 0 : 1), 312 + (hit ? 1 : 0), 22); put(dx + 10, 311, 22);
    // upright bass
    const bx = 99;
    ell(bx, 322, 4, 6.5, 20, (x, y, u) => (u < -0.4 ? 19 : 20)); hl(bx - 3, bx + 3, 317, 20); put(bx - 2, 322, 18); put(bx + 2, 322, 18);
    vl(bx, 300, 316, 18); put(bx - 1, 299, 18); put(bx, 298, 18); put(bx + 1, 300, 18); vl(bx, 317, 326, 32);
    vl(bx, 328, 329, 31);
    // vintage microphone on a stand
    const mx = 117;
    vl(mx, 312, 329, 31); hl(mx - 3, mx + 3, 329, 31); rect(mx - 1, 308, 3, 4, 30); hl(mx - 1, mx + 1, 309, 32); put(mx, 307, 31);
  }
  const FOCUS = {};

  /* ---------------------------------------------------------------- the front door, bell, kid */
  function doDoor(t) {
    TG = SC;
    const open = t < T_OPEN ? 0 : t < T_OPEN + 0.5 ? io((t - T_OPEN) / 0.5) : t < T_LEAVE + 0.5 ? 1 : t < T_LEAVE + 0.9 ? 1 - io((t - T_LEAVE - 0.5) / 0.4) : 0;
    if (open < 0.02) { pen(MR, R_STR); for (let y = F1Y - 32; y < F1Y; y++) for (let k = 0; k < 4; k++) put(DOORX + k, y, k === 0 ? 21 : 20); put(DOORX, F1Y - 16, 22); put(DOORX, F1Y - 15, 22); }
    else {
      // the open door hangs inside, behind the cast, seen face-on
      pen(MR, R_HALL); const w = Math.round(14 * Math.sin(open * Math.PI / 2));
      for (let y = F1Y - 31; y < F1Y; y++) for (let x = DOORX - w; x < DOORX; x++) put(x, y, (x === DOORX - w) ? 21 : ((y - F1Y + 31) % 15 < 2 || x === DOORX - w + 2) ? 19 : 20);
      if (w > 4) put(DOORX - w + 2, F1Y - 15, 22);
    }
  }
  function doBell(t) {
    TG = SC; pen(MR, R_HALL);
    const ring = t >= T_BELL && t < T_RUN;
    const sw = ring ? ((fl(t * 20) & 1) ? 1 : -1) : 0;
    const bx = 306, by = 302;
    rect(bx + sw, by, 4, 3, 22); hl(bx - 1 + sw, bx + 4 + sw, by + 3, 21); put(bx + 1 + sw, by - 1, 21); put(bx + 2 + sw, by - 1, 21); put(bx + 1 + sw * 2, by + 4, 18);
    if (ring) {
      pen(MX, R_HALL);
      const w = fl(t * 10) % 3;
      for (let k = 0; k <= w; k++) { put(bx - 3 - k * 2, by - k, 23); put(bx - 3 - k * 2, by + 3 + k, 23); put(bx + 6 + k * 2, by - k, 23); }
      const jx = (fl(t * 15) & 1), jy = (fl(t * 13) & 1);
      TG = SC; pen(MX, R_EXT);
      textO('DING', 326 + jx, 226 + jy, 23, 0, 2);
      if (t >= T_BELL + 0.3) textO('DONG', 326 - jx, 242 + jy, 22, 0, 2);
      const r = 2 + (fl(t * 10) % 3) * 2;
      for (let a = -1.2; a <= 1.2; a += 0.3) put(322 + Math.cos(a) * r, 313 + Math.sin(a) * r, 23);
    }
  }
  function doKid(t) {
    let x = null, y = F1Y; const p = { walk: -1 };
    if (t >= 4.4 && t < 7.3) { const u = (t - 4.4) / 2.9; x = lerp(384, 339, u); y = x > 348 ? GY : F1Y; p.walk = fl(t * 7); p.flip = true; }
    else if (t >= 7.3 && t < T_LEAVE) {
      x = 338; p.flip = true;
      if (t >= 7.4 && t < 7.85) p.press = true;
      if (t >= 12.6 && t < T_LEAVE) p.bagOut = true;
      if (t >= T_CANDY + 0.3 && t < T_CANDY + 0.55) { TG = SC; pen(MX, R_PORCH); const u = (t - T_CANDY - 0.3) / 0.25; put(lerp(312, 330, u), 318 - Math.sin(u * Math.PI) * 6 + u * 6, 17); }
    } else if (t >= T_LEAVE && t < 19.0) { const u = (t - T_LEAVE) / 3.1; x = lerp(339, 392, u); y = x > 348 ? GY : F1Y; p.walk = fl(t * 7); }
    if (x === null) return;
    kid(Math.round(x), y, p);
    if (t >= T_COOL && t < T_SIGH) bubble(318, 284, ['COOL', 'COSTUMES.'], 338);
  }

  /* ---------------------------------------------------------------- per frame */
  function drawLive(t, fi) {
    const q = st10(t);
    poolI = 0; MARKS.length = 0; EYES.length = 0; COMB = null; SIGH = null; AIR = null; IRON = null; JAW = null; POUR = null;
    for (const k in FOCUS) delete FOCUS[k];
    const alarm = t >= T_BELL && t < T_LIGHT;
    FOCUS[R_VAMP] = 56; FOCUS[R_BALL] = 90; FOCUS[R_PARL] = alarm ? 262 : 200; FOCUS[R_HALL] = alarm ? 330 : 280;
    // background things first
    liveProps(t, q, fi);
    doDoor(t);
    drawTrail(t);
    drawScarf(t);
    doRocker(t);
    doBrain(t, q);
    doNeighbour(t, q);
    doPlant(t, q);
    // the cast: those on the stairs first, then the front row at the door
    doSkel('drum', t, q); doSkel('bass', t, q); doSkel('sing', t, q);
    doMummy(t, q); doInvis(t, q);
    doReaper(t, q); doKnight(t, q);
    doFrank(t, q); doWolf(t, q); doVamp(t, q); doZombie(t, q);
    doWitch(t, q);
    frontProps(t, q);
    doGhosts(t, q);
    doSpider(t, q);
    doBats(t, q);
    doBell(t);
    doKid(t);
    liveFX(t, q, fi);
    drawMarks(t);
    // in the blackout only the eyes are left, and they blink once
    if (DIM < 0.3 && !(t > T_DARK + 0.4 && t < T_DARK + 0.48)) {
      TG = SC; pen(MX, R_HALL);
      for (const [x, y, c] of EYES) { put(x, y, c); put(x + 2, y, c); }
    }
    // a lightning flash outside when they all strike their poses
    FLASH = 0;
    if (t >= T_POSE && t < T_POSE + 0.12) FLASH = 0.9; else if (t >= T_POSE + 0.22 && t < T_POSE + 0.28) FLASH = 0.5;
    if (FLASH > 0) { TG = SC; pen(ME, R_EXT); let x = 352, y = 192; for (let s = 0; s < 8; s++) { const nx = x + (s & 1 ? 4 : -3), ny = y + 10; line(x, y, nx, ny, 8); x = nx; y = ny; } }
  }
  let FLASH = 0, DIM = 1;
  function dimAt(t) {
    // the lights go out after the door shuts, and come back on with everyone in their rooms
    if (t < T_DARK || t >= T_LIGHT + 0.12) return 1;
    if (t < T_DARK + 0.06) return 0.45;
    if (t < T_DARK + 0.12) return 0.85;
    if (t < T_DARK + 0.2) return 0.2;
    if (t < T_LIGHT) return 0.05;
    return 0.6;
  }
  function cameraAt(t) {
    if (t >= T_OPEN && t < T_LIGHT) return { x: 240, y: 190, z: 3 };
    return { x: 0, y: 0, z: 1 };
  }
  /* ================================================================ light */
  const STEP = 0.12, BW = 0.35;
  function band(I, b) {
    const s = I / STEP; let k = fl(s); const f = s - k; const lo = 0.5 - BW * 0.5;
    if (f >= lo + BW) k++; else if (f > lo && (f - lo) / BW > b) k++;
    return k * STEP;
  }
  let LV = {}; // live light state per room, set per frame
  function flick(kind, t, k) {
    const q = fl(t * 12);
    if (kind === 'candle') return 0.88 + 0.12 * ih(q, k, 61);
    if (kind === 'fire') return 0.8 + 0.25 * ih(q, k, 62);
    if (kind === 'gas') return 0.95 + 0.05 * ih(fl(t * 6), k, 63);
    return 1;
  }
  function roomLight(room, x, y, b) {
    const a = AMB[room] || AMB[R_EXT];
    let r = a[0], g = a[1], bb = a[2];
    const Ls = LV[room];
    if (Ls) for (const L of Ls) {
      if (L[4] <= 0) continue;
      const dx = x - L[0], dy = y - L[1];
      const I = L[4] * L[2] * L[2] / (L[2] * L[2] + dx * dx + dy * dy);
      const Ib = b < 0 ? I : band(I, b);
      r += Ib * L[3][0]; g += Ib * L[3][1]; bb += Ib * L[3][2];
    }
    if (INTERIOR[room] && DIM < 1) { r *= DIM; g *= DIM; bb *= DIM; }
    return [r, g, bb];
  }
  function lightPass(flash) {
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
      const i = y * AW + x, m = SC.m[i], col = SC.c[i] ? SC.c[i] - 1 : 0;
      if (m === MX) { OUT[i] = col; continue; }
      if (m === ME) {
        let c = col;
        if (DIM < 1 && INTERIOR[SC.r[i]]) c = DIM < 0.3 ? DARK[DARK[c]] : DARK[c];
        OUT[i] = flash > 0 ? LITE[c] : c; continue;
      }
      let L;
      if (m === MS) L = SLOTS[SL[i]];
      else L = roomLight(SC.r[i], x + 0.5, y + 0.5, BAY[((y & 3) << 2) | (x & 3)]);
      const p = PAL[col];
      let r = p[0] * (L[0] + flash), g = p[1] * (L[1] + flash), bb = p[2] * (L[2] + flash * 1.1);
      r = r > 255 ? 255 : r; g = g > 255 ? 255 : g; bb = bb > 255 ? 255 : bb;
      OUT[i] = LUT[((r >> 3) << 10) | ((g >> 3) << 5) | (bb >> 3)];
    }
  }

  /* ================================================================ frame */
  function drawFrame(t, g, k) {
    t = ((t % D) + D) % D;
    const fi = fl(t * 30 + 1e-4);
    DIM = dimAt(t);
    LV = {};
    for (const key in LIGHTS) LV[key] = LIGHTS[key].map((L, j) => { const o = L.slice(); o[4] = L[4] * flick(L[5], t, j + (+key) * 7); return o; });
    SC.c.set(BS.c); SC.m.set(BS.m); SC.r.set(BS.r);
    SLOTS.length = 0;
    TG = SC;
    drawLive(t, fi);
    lightPass(FLASH);
    present(g, k, t);
  }

  /* ================================================================ present */
  let IMG = null, SMALL = null, SG = null;
  function present(g, k, t) {
    if (!SMALL) { SMALL = document.createElement('canvas'); SMALL.width = AW; SMALL.height = AH; SG = SMALL.getContext('2d'); IMG = SG.createImageData(AW, AH); }
    const d = IMG.data;
    for (let i = 0, j = 0; i < NP; i++, j += 4) { const p = PAL[OUT[i]]; d[j] = p[0]; d[j + 1] = p[1]; d[j + 2] = p[2]; d[j + 3] = 255; }
    SG.putImageData(IMG, 0, 0);
    if (!g) return;
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const cam = cameraAt(t);
    const s = k * cam.z;
    g.drawImage(SMALL, -cam.x * s, -cam.y * s, AW * s, AH * s);
  }

  /* ================================================================ mount */
  (window.PIECES = window.PIECES || []).push({
    id: 'nightshift',
    title: 'The Night Shift',
    medium: 'Pixel art in 40 colours, 360 × 450, animated in JavaScript · 20 s loop',
    note: 'Somebody is at the door · tap to pause',
    about: 'A haunted mansion on Halloween, run like backstage at a theatre: sixteen rooms from the bat turret to a crypt under the garden, every monster at a tiny routine in its own lamplit room, until the doorbell rings and the whole cast scrambles down the stairs to give one small trick-or-treater the scare of a lifetime. Drawn pixel by pixel in code on a 360 × 450 grid, each room lit by its own lamp.',
    tone: 'dark',
    room: '#05060f',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      SEED = (api.seed >>> 0) % 100000 || 7;
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0, built = false;
      el.style.background = '#05060f';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;image-rendering:pixelated;image-rendering:crisp-edges;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(242,246,255,.8)"/><rect x="19" y="9" width="5" height="16" fill="rgba(242,246,255,.8)"/></svg>';
      el.appendChild(pauseMark);
      let K = 3;
      function layout() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        let left = 0, top = 0, cssW, cssH;
        if (EXPORT) { cssW = 1080; cssH = 1350; cv.style.position = 'fixed'; K = Math.max(1, Math.round(1080 / AW * dpr)); cv.width = AW * K; cv.height = AH * K; }
        else {
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          const fit = Math.min(w * dpr / AW, h * dpr / AH) * 0.97;
          const k = Math.max(1, Math.floor(fit));
          K = k;
          if (k < fit * 0.9) { K = Math.max(1, Math.ceil(fit)); cssW = AW * fit / dpr; cssH = AH * fit / dpr; }
          else { cssW = AW * k / dpr; cssH = AH * k / dpr; }
          left = Math.round((w - cssW) / 2); top = Math.round((h - cssH) / 2);
          if (cv.width !== AW * K || cv.height !== AH * K) { cv.width = AW * K; cv.height = AH * K; }
        }
        cv.style.left = left + 'px'; cv.style.top = top + 'px'; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
        pauseMark.style.left = (left + cssW - 48) + 'px'; pauseMark.style.top = (top + 14) + 'px';
      }
      layout();
      buildLUT(); buildMaps(); setupLights(); buildBase();
      built = true;
      drawFrame(0, g, K);
      if (EXPORT) {
        const mo = new MutationObserver(() => { if (!built && document.documentElement.dataset.ready) delete document.documentElement.dataset.ready; });
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ready'] });
        const faded = () => { const st = el.parentElement; return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999; };
        window.__nightshift = {
          duration: D,
          isReady: () => built && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); drawFrame(t, g, K); window.__nightshift.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'nightshift';
        api.ready();
      } else {
        window.__nightshift = { duration: D, isReady: () => built, renderAt(t) { return new Promise((res) => { playing = false; clock = t; drawFrame(t, g, K); requestAnimationFrame(() => res()); }); } };
        api.ready();
      }
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        raf = requestAnimationFrame(frame);
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
        if (!playing) return;
        clock = (clock + dt) % D;
        drawFrame(clock, g, K);
      }
      if (!EXPORT) raf = requestAnimationFrame(frame);
      const onDown = () => { if (EXPORT) return; playing = !playing; last = 0; pauseMark.style.opacity = playing ? '0' : '1'; };
      cv.addEventListener('pointerdown', onDown);
      let rt = 0;
      const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (!alive) return; layout(); drawFrame(clock, g, K); }, 120); });
      ro.observe(el);
      return {
        destroy() {
          alive = false; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(rt);
          cv.removeEventListener('pointerdown', onDown);
          if (window.__nightshift) delete window.__nightshift;
        },
      };
    },
  });
})();
