/* The Night Shift — piece 1.
 *
 * A 36-second seamless loop of real pixel art: a haunted house shown as a dollhouse cutaway, every room
 * lit by its own lamp, everyone at their little routine until the doorbell rings. Every frame is a pure
 * function of t. The house is painted into a 270 × 338 art-pixel buffer (palette index, light mode and
 * room per pixel), lit room by room with stepped, ordered-dithered light, quantised to a 40-colour
 * palette and scaled up nearest-neighbour, with a hard cut to an 8x close-up for the doorstep.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const AW = 270, AH = 338, NP = AW * AH, D = 36;
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
  // light modes: 0 emissive, 1 lit by its room (per pixel, dithered), 2 sprite (uniform light slot)
  const ME = 0, MR = 1, MS = 2;
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
  const F_ATT = 74, F3Y = 130, F2Y = 186, F1Y = 246, FCY = 292;
  const HX0 = 10, HX1 = 234;
  // rooms: id, rect (interior), name
  const R_EXT = 0, R_ATT = 1, R_VAMP = 2, R_BATH = 3, R_WOLF = 4, R_FRANK = 5, R_KIT = 6, R_BALL = 7, R_HALL = 8, R_CEL = 9, R_STR = 10, R_EARTH = 11, R_PORCH = 12;
  const ROOMS = [
    [R_VAMP, 13, 78, 90, 130], [R_BATH, 94, 78, 176, 130], [R_HALL, 180, 78, 231, 246],
    [R_WOLF, 13, 134, 80, 186], [R_FRANK, 84, 134, 176, 186],
    [R_KIT, 13, 190, 82, 246], [R_BALL, 86, 190, 176, 246], [R_CEL, 13, 250, 231, 292],
  ];
  const roofY = (x) => { const peak = 122, py = 6, half = 124; return py + Math.abs(x - peak) / half * 70; };
  function roomAt(x, y) {
    if (y < F_ATT && x > 14 && x < 230 && y > roofY(x) + 5) return R_ATT;
    for (const r of ROOMS) if (x >= r[1] && x < r[3] && y >= r[2] && y < r[4]) return r[0];
    return R_EXT;
  }
  // lights per room: [x, y, radius, [r,g,b], intensity, flicker]
  const LIGHTS = {};
  const AMB = {};
  function setupLights() {
    AMB[R_EXT] = [0.42, 0.52, 0.86]; AMB[R_STR] = [0.62, 0.66, 0.9]; AMB[R_EARTH] = [0.38, 0.4, 0.62]; AMB[R_PORCH] = [0.42, 0.5, 0.82];
    AMB[R_ATT] = [0.26, 0.22, 0.36]; AMB[R_VAMP] = [0.28, 0.18, 0.3]; AMB[R_BATH] = [0.2, 0.28, 0.3]; AMB[R_WOLF] = [0.3, 0.22, 0.32];
    AMB[R_FRANK] = [0.2, 0.28, 0.28]; AMB[R_KIT] = [0.28, 0.2, 0.26]; AMB[R_BALL] = [0.3, 0.2, 0.26]; AMB[R_HALL] = [0.22, 0.26, 0.28]; AMB[R_CEL] = [0.2, 0.16, 0.24];
    LIGHTS[R_ATT] = [[128, 60, 46, [1.0, 0.72, 0.4], 1.1, 'candle'], [66, 50, 26, [0.5, 0.65, 1.0], 0.6, '']];
    LIGHTS[R_VAMP] = [[85, 100, 52, [1.0, 0.62, 0.38], 1.15, 'candle']];
    LIGHTS[R_BATH] = [[136, 92, 60, [0.72, 1.0, 0.78], 0.85, 'gas']];
    LIGHTS[R_WOLF] = [[26, 146, 56, [1.0, 0.86, 0.55], 1.2, '']];
    LIGHTS[R_FRANK] = [[160, 146, 60, [0.5, 1.0, 0.72], 1.0, 'gas'], [116, 120 + 0, 40, [0.7, 0.9, 1.0], 0, 'arc']];
    LIGHTS[R_KIT] = [[32, 236, 50, [1.0, 0.55, 0.25], 1.3, 'fire'], [32, 222, 30, [0.5, 1.0, 0.4], 0.6, 'brew']];
    LIGHTS[R_BALL] = [[131, 204, 70, [1.0, 0.7, 0.42], 1.2, 'candle']];
    LIGHTS[R_HALL] = [[196, 100, 60, [0.55, 1.0, 0.6], 0.9, 'gas'], [184, 206, 58, [0.6, 1.0, 0.62], 1.0, 'gas'], [228, 228, 30, [1.0, 0.7, 0.4], 0.5, 'porch']];
    LIGHTS[R_CEL] = [[132, 280, 56, [1.0, 0.45, 0.22], 1.2, 'fire'], [60, 258, 30, [1.0, 0.8, 0.5], 0.6, '']];
    LIGHTS[R_PORCH] = [[239, 216, 30, [1.0, 0.7, 0.38], 1.0, 'candle']];
  }

  /* ================================================================ buffers */
  const SC = mkT(AW, AH, true);
  const BS = mkT(AW, AH, true);
  const SL = new Uint8Array(NP);        // sprite light slot per pixel
  const SLOTS = [];                      // [r,g,b] per slot
  const OUT = new Uint8Array(NP);

  /* ================================================================ static house */
  const WEB_ANCHOR = [];
  function buildBase() {
    const R = mulberry32(SEED * 9301 + 49297);
    TG = BS;
    // ---- sky
    pen(ME, R_EXT);
    for (let y = 0; y < 252; y++) for (let x = 0; x < AW; x++) {
      const b = bay(x, y);
      let c = y < 60 ? 1 : y < 140 ? (b < (y - 60) / 80 ? 2 : 1) : y < 220 ? (b < (y - 140) / 80 ? 3 : 2) : 3;
      const dm = Math.hypot(x + 0.5 - 238, y + 0.5 - 30);
      if (dm < 34) c = dm < 22 ? 4 : (b < (34 - dm) / 12 ? 4 : c);
      if (dm < 48 && dm >= 34 && b < (48 - dm) / 30) c = Math.max(c, 3);
      if (ih(x, y, 3) < 0.012 && dm > 18) c = ih(x, y, 4) < 0.3 ? 7 : 5;
      put(x, y, c);
    }
    // moon
    ell(238, 30, 13, 13, 7); ell(237, 29, 11.5, 11.5, 8);
    for (const [cx, cy, r] of [[233, 26, 2.5], [242, 34, 3], [236, 36, 1.6], [244, 24, 1.8]]) ell(cx, cy, r, r, 7);
    // clouds near the moon
    pen(ME, R_EXT);
    for (const [cx, cy, w] of [[214, 46, 22], [250, 52, 18], [40, 30, 26]]) {
      for (let k = 0; k < w; k++) { const x = cx - w / 2 + k, h = Math.round(Math.sin(k / w * Math.PI) * 3); for (let y = 0; y <= h; y++) put(x, cy - y, y === h ? 5 : 4); }
    }
    // the bare tree (left, behind the house)
    pen(MR, R_EXT);
    const br = (x0, y0, x1, y1, w) => { for (let k = 0; k < w; k++) line(x0 + k, y0, x1 + k * 0.5, y1, 1); };
    br(0, 252, 2, 120, 7); br(2, 120, 6, 70, 5); br(6, 70, 14, 40, 3); br(14, 40, 30, 22, 2); br(8, 60, 2, 36, 2); br(2, 36, 0, 20, 1);
    br(20, 32, 40, 30, 1); br(26, 26, 34, 12, 1); br(10, 52, 0, 50, 1); br(4, 100, 0, 92, 2); br(30, 22, 46, 26, 1); br(14, 40, 8, 26, 1);
    // ---- earth (cut) around the cellar
    pen(MR, R_EARTH);
    for (let y = 252; y < AH; y++) for (let x = 0; x < AW; x++) {
      let c = y < 256 ? (y === 252 ? 27 : 26) : 19;
      if (y >= 256) { if (ih(x >> 1, y >> 1, 7) < 0.08) c = 18; if (ih(x, y, 8) < 0.03) c = 20; if (y > 300 && ih(x >> 2, y >> 2, 9) < 0.06) c = 30; }
      put(x, y, c);
    }
    // grass tufts
    for (let x = 0; x < AW; x += 2) if (ih(x, 1, 10) < 0.5) put(x, 251, 27);
    // roots and a worm
    pen(MR, R_EARTH);
    line(40, 296, 30, 320, 18); line(30, 320, 22, 330, 18); line(180, 300, 196, 318, 18); line(196, 318, 200, 334, 18);
    hl(150, 154, 318, 17); put(155, 317, 17); put(149, 319, 17);
    // an old buried coffin, a bone, rocks, a mole's tunnel
    poly([[64, 312], [68, 308], [96, 308], [100, 312], [96, 316], [68, 316]], 18); poly([[66, 312], [69, 309.5], [95, 309.5], [98, 312], [95, 314.5], [69, 314.5]], 19); hl(78, 84, 312, 20); vl(81, 310, 314, 20);
    hl(214, 222, 326, 32); put(213, 325, 32); put(213, 327, 32); put(223, 325, 32); put(223, 327, 32);
    for (const [rx, ry, rr] of [[30, 304, 3], [120, 330, 4], [238, 300, 3], [176, 322, 2.5], [258, 318, 3.5], [8, 326, 3]]) { ell(rx, ry, rr, rr * 0.7, 30); put(rx - 1, ry - 1, 31); }
    for (let k = 0; k < 26; k++) { const x = 232 + k, y = 268 + Math.round(Math.sin(k / 4) * 3); put(x, y, 18); put(x, y + 1, 18); }
    ell(259, 266, 3, 2.2, 34); put(261, 265, 27); put(262, 266, 36);
    // ---- house: structure (cut sections), lit cold by the moon
    pen(MR, R_STR);
    // roof slab
    for (let x = 2; x < 244; x++) {
      const yr = roofY(x);
      for (let y = Math.round(yr) - 3; y < Math.round(yr) + 4; y++) { if (y > 77) continue; put(x, y, y < yr ? 3 : ((x + y) % 4 === 0 ? 10 : 11)); }
    }
    // chimney
    rect(186, 18, 10, 34, 15); for (let y = 18; y < 52; y += 3) hl(186, 195, y, 14); rect(184, 16, 14, 3, 30);
    // weather vane bat
    vl(122, 0, 6, 31); spr(['o.....o', 'oo.o.oo', '.ooooo.', '..o.o..'], { o: 1 }, 119, 0);
    // walls & slabs
    const slab = (x0, x1, y) => { for (let x = x0; x <= x1; x++) for (let k = 0; k < 4; k++) put(x, y + k, k === 0 ? 32 : k === 3 ? 30 : 31); };
    slab(HX0, HX1 - 1, F_ATT); slab(HX0, HX1 - 1, F3Y); slab(HX0, HX1 - 1, F2Y); slab(HX0 - 2, HX1 + 1, F1Y); slab(HX0, HX1 - 1, FCY);
    const wall = (x, y0, y1) => { for (let y = y0; y < y1; y++) for (let k = 0; k < 4; k++) put(x + k, y, k === 0 ? 32 : k === 3 ? 30 : 31); };
    wall(HX0, 78, 246); wall(HX1 - 4 + 1, 78, 246); wall(HX0, 250, 292); wall(HX1 - 3, 250, 292);
    wall(90, 78, 130); wall(176, 78, 130); wall(80, 134, 186); wall(176, 134, 186); wall(82, 190, 246); wall(176, 190, 246);
    // ---- room interiors
    buildAttic(R); buildVamp(R); buildBath(R); buildWolf(R); buildFrank(R); buildKitchen(R); buildBall(R); buildHall(R); buildCellar(R);
    // doorways in partitions (cut openings with frames)
    const doorway = (x, yFloor, room) => {
      pen(MR, room);
      for (let y = yFloor - 28; y < yFloor; y++) for (let k = 0; k < 4; k++) put(x + k, y, 10);
      pen(MR, R_STR);
      hl(x - 1, x + 4, yFloor - 29, 20); hl(x - 1, x + 4, yFloor - 30, 21);
    };
    doorway(90, F3Y, R_VAMP); doorway(176, F3Y, R_BATH); doorway(80, F2Y, R_WOLF); doorway(176, F2Y, R_FRANK); doorway(82, F1Y, R_KIT); doorway(176, F1Y, R_BALL);
    // the front door opening in the right wall (door drawn live)
    pen(ME, R_EXT); for (let y = F1Y - 32; y < F1Y; y++) for (let k = 0; k < 4; k++) put(HX1 - 3 + k, y, 1);
    // ---- porch
    buildPorch(R);
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
      put(x, y, c);
    }
  }
  function floorBoards(x0, x1, y, room, a, b) { pen(MR, room); for (let x = x0; x < x1; x++) { put(x, y - 1, (x % 9 === 0) ? b : a); } }
  function wainscot(x0, x1, yTop, yBot, room, a, b, rail) {
    pen(MR, room);
    for (let y = yTop; y < yBot; y++) for (let x = x0; x < x1; x++) put(x, y, (x - x0) % 10 === 0 ? b : a);
    hl(x0, x1 - 1, yTop, rail); hl(x0, x1 - 1, yTop + 1, b);
  }
  function frame(x, y, w, h, fc, inner) { rect(x, y, w, h, fc); hl(x, x + w - 1, y, LITE[fc]); rect(x + 1, y + 1, w - 2, h - 2, inner); }
  // portraits whose eyes follow the action: registry for the live pass
  const PORTRAITS = [];
  function portrait(x, y, w, h, room, kind) {
    pen(MR, room);
    frame(x, y, w, h, 21, 13);
    const cx = x + w / 2;
    if (kind === 'lady') { ell(cx, y + h * 0.62, w * 0.3, h * 0.42, 11); ell(cx, y + h * 0.4, w * 0.2, h * 0.2, 31); rect(fl(cx - w * 0.24), y + 2, fl(w * 0.48), 3, 1); }
    else if (kind === 'count') { poly([[x + 2, y + h - 1], [cx, y + h * 0.5], [x + w - 2, y + h - 1]], 1); ell(cx, y + h * 0.42, w * 0.2, h * 0.22, 7); rect(fl(cx - w * 0.2), y + 2, fl(w * 0.4) + 1, 3, 0); }
    else { ell(cx, y + h * 0.66, w * 0.32, h * 0.38, 26); ell(cx, y + h * 0.4, w * 0.22, h * 0.24, 35); put(cx - 3, y + 2, 34); put(cx + 2, y + 2, 34); }
    PORTRAITS.push({ x: Math.round(cx) - 2, y: Math.round(y + h * 0.4), room });
  }

  function buildAttic() {
    pen(MR, R_ATT);
    for (let y = 8; y < F_ATT; y++) for (let x = 14; x < 230; x++) {
      if (y < roofY(x) + 4) continue;
      let c = (x % 7 === 0) ? 18 : 19;
      if (ih(x >> 1, y >> 2, 21) < 0.05) c = 18;
      put(x, y, c);
    }
    // rafters
    for (const x of [46, 86, 158, 198]) { for (let y = Math.round(roofY(x) + 4); y < F_ATT; y++) { put(x, y, 20); put(x + 1, y, 20); put(x + 2, y, 18); } }
    hl(30, 214, 50, 18); hl(30, 214, 51, 20);
    // round attic window
    pen(ME, R_ATT); ell(122, 34, 7, 7, 21); ell(122, 34, 5.5, 5.5, 3); ell(124, 32, 2.6, 2.6, 7); vl(122, 28, 40, 20); hl(116, 128, 34, 20);
    pen(MR, R_ATT);
    // trunk and old things
    rect(26, 62, 18, 12, 19); hl(26, 43, 62, 21); rect(26, 66, 18, 1, 18); put(34, 68, 22); put(35, 68, 22);
    ell(60, 66, 5, 8, 15); rect(59, 58, 2, 3, 31); vl(60, 70, 73, 18); // dress form
    // tea table
    rect(106, 63, 40, 3, 20); hl(106, 145, 63, 21); rect(108, 66, 2, 8, 18); rect(142, 66, 2, 8, 18);
    for (let x = 108; x < 145; x += 2) put(x, 66, 32); // tablecloth fringe
    rect(105, 60, 3, 3, 33); put(108, 61, 33); hl(104, 108, 62, 32); // cups and saucers
    rect(129, 60, 3, 3, 33); put(132, 61, 33); hl(128, 132, 62, 32);
    ell(140, 62, 3.5, 1, 32); put(138, 61, 21); put(140, 61, 21); put(142, 61, 20); // biscuits
    // armchair for a ghost and a stack of portraits
    rect(170, 66, 14, 8, 15); rect(170, 60, 3, 8, 15); rect(181, 60, 3, 8, 15); rect(173, 63, 8, 4, 16);
    rect(200, 58, 12, 16, 18); rect(201, 59, 10, 14, 11); rect(203, 61, 6, 6, 31);
    // dusty cobwebs in the corners (the spider builds a new one live)
    pen(MR, R_ATT);
    line(16, roofY(16) + 6, 26, roofY(16) + 14, 31); line(20, roofY(20) + 4, 24, roofY(20) + 12, 31);
  }
  function buildVamp() {
    wallpaper(13, 78, 90, 130, R_VAMP, 15, 16, 'damask');
    wainscot(13, 90, 114, 130, R_VAMP, 13, 14, 21);
    floorBoards(13, 90, 130, R_VAMP, 14, 13);
    pen(MR, R_VAMP);
    // an upright coffin with its lid leaning beside it
    poly([[18, 98], [22, 94], [30, 94], [34, 98], [32, 130], [20, 130]], 13);
    poly([[19.5, 99], [22.5, 96], [29.5, 96], [32.5, 99], [31, 129], [21, 129]], 16, (x, y) => (x < 23 ? 15 : 16));
    for (let y = 100; y < 128; y += 4) hl(23, 29, y, 17);
    poly([[36, 99], [39, 95], [44, 95], [47, 99], [46, 130], [37, 130]], 18); vl(41, 104, 118, 21); hl(39, 109, 44, 21);
    // portrait of a stern ancestor
    portrait(52, 86, 12, 15, R_VAMP, 'count');
    // standing mirror (the glass is drawn live)
    rect(64, 96, 16, 34, 21); hl(64, 79, 96, 23); rect(65, 97, 14, 30, 18); put(71, 94, 22); put(72, 94, 22); put(71, 95, 21); put(72, 95, 21);
    rect(66, 128, 2, 2, 20); rect(76, 128, 2, 2, 20);
    // side table + candelabra
    rect(82, 112, 7, 2, 20); rect(84, 114, 3, 16, 19);
    pen(MR, R_VAMP); vl(85, 104, 111, 21); hl(82, 88, 106, 21); vl(82, 102, 106, 21); vl(88, 102, 106, 21);
    // rug
    for (let x = 40; x < 66; x++) { put(x, 129, (x & 1) ? 16 : 13); }
  }
  function buildBath() {
    wallpaper(94, 78, 176, 112, R_BATH, 26, 27, 'stripe');
    wallpaper(94, 112, 176, 130, R_BATH, 32, 31, 'grid');
    pen(MR, R_BATH); hl(94, 175, 112, 33); hl(94, 175, 113, 31);
    // clawfoot tub with bubbles
    pen(MR, R_BATH);
    for (let y = 117; y < 127; y++) { const ins = y < 120 ? 0 : Math.round(Math.pow((y - 119) / 7, 2) * 4); hl(98 + ins, 126 - ins, y, y === 117 ? 33 : y === 118 ? 31 : (y > 123 ? 31 : 32)); put(98 + ins, y, 31); }
    hl(99, 125, 116, 33);
    rect(100, 126, 2, 4, 22); rect(122, 126, 2, 4, 22); put(99, 129, 22); put(124, 129, 22);
    for (let k = 0; k < 8; k++) ell(101 + k * 3.2, 114.5 - (k % 3 === 1 ? 1 : 0), 1.8, 1.5, 8);
    // rubber duck
    ell(118, 113, 2, 1.5, 22); put(119, 111, 22); put(120, 111, 22); put(121, 111, 37); put(119, 110, 0);
    // pedestal sink with mirror and toothbrush cup
    rect(150, 110, 14, 3, 33); rect(155, 113, 4, 17, 32); hl(150, 163, 110, 8);
    rect(151, 90, 12, 14, 21); rect(152, 91, 10, 12, 4); put(154, 93, 6); put(155, 94, 6);
    rect(160, 107, 2, 3, 6); put(160, 106, 17); put(161, 105, 28);
    // gaslight sconce (flame drawn live)
    rect(135, 96, 3, 4, 21); put(136, 95, 31);
    // towel rail
    hl(164, 172, 98, 31); rect(165, 99, 6, 9, 16); hl(165, 170, 104, 33);
    floorBoards(94, 176, 130, R_BATH, 31, 30);
  }
  function buildWolf() {
    wallpaper(13, 134, 80, 186, R_WOLF, 11, 12, 'stripe');
    wainscot(13, 80, 172, 186, R_WOLF, 10, 9, 20);
    floorBoards(13, 80, 186, R_WOLF, 19, 18);
    pen(MR, R_WOLF);
    // vanity table with a bulb-ringed mirror (bulbs live)
    rect(15, 166, 22, 3, 20); hl(15, 36, 166, 22); rect(16, 169, 3, 17, 19); rect(33, 169, 3, 17, 19); rect(20, 169, 12, 5, 19); put(25, 171, 22);
    rect(17, 146, 18, 19, 21); rect(19, 148, 14, 15, 4); put(21, 150, 6); put(22, 151, 6); put(23, 152, 6);
    // bottles, brush, comb
    rect(20, 162, 2, 4, 28); rect(23, 161, 2, 5, 38); rect(26, 163, 3, 3, 17); hl(29, 33, 165, 20);
    // full-moon calendar
    rect(56, 144, 14, 16, 33); hl(56, 69, 144, 16); ell(63, 151, 3.5, 3.5, 22); for (let k = 0; k < 4; k++) hl(58, 67, 156 + k, k & 1 ? 33 : 31);
    // stool
    rect(40, 178, 12, 2, 16); rect(41, 180, 2, 6, 18); rect(49, 180, 2, 6, 18);
    // rug
    for (let x = 22; x < 64; x++) put(x, 185, (x & 2) ? 38 : 11);
  }
  function buildFrank() {
    wallpaper(84, 134, 176, 186, R_FRANK, 30, 2, 'stone');
    floorBoards(84, 176, 186, R_FRANK, 30, 2);
    pen(MR, R_FRANK);
    // big knife switch on the wall
    rect(92, 142, 8, 12, 19); rect(93, 143, 6, 10, 2); vl(94, 144, 151, 31); vl(97, 144, 151, 31); line(95, 151, 99, 140, 32); put(100, 139, 16);
    // pipes & gauges
    hl(84, 175, 138, 31); hl(84, 175, 139, 30); ell(110, 145, 3, 3, 32); put(110, 145, 16); put(111, 144, 0);
    // tesla lamp (the coil glow is live)
    rect(158, 176, 8, 10, 19); rect(160, 160, 4, 16, 31); ell(162, 158, 4, 3, 21);
    // ironing board
    poly([[100, 166], [144, 166], [146, 168], [100, 168]], 33); hl(100, 145, 168, 31);
    line(108, 168, 130, 186, 31); line(130, 168, 108, 186, 31);
    // the suit rack with trousers
    vl(166, 146, 172, 31); hl(162, 172, 146, 31); put(167, 145, 31);
    rect(164, 150, 7, 16, 2); vl(167, 156, 166, 1);
    // laundry basket
    rect(87, 176, 11, 10, 20); for (let x = 87; x < 98; x += 2) vl(x, 177, 185, 19); rect(88, 173, 9, 3, 16);
  }
  function buildKitchen() {
    wallpaper(13, 190, 82, 246, R_KIT, 14, 13, 'brick');
    pen(MR, R_KIT);
    // hearth
    rect(16, 212, 34, 34, 30); rect(19, 216, 28, 30, 1); for (let y = 212; y < 246; y += 4) hl(16, 49, y, 31);
    rect(14, 208, 38, 4, 19); hl(14, 51, 208, 21);
    // the cauldron (bubbles live)
    ell(33, 236, 11, 8, 1, (x, y, u, v) => (u > 0.4 && v < 0.2 ? 3 : 2)); rect(22, 228, 23, 3, 3); hl(22, 44, 228, 4);
    rect(26, 243, 3, 3, 1); rect(38, 243, 3, 3, 1);
    // shelves with jars
    for (const sy of [198, 206]) { hl(56, 79, sy, 20); hl(56, 79, sy + 1, 19); }
    const jars = [[57, 28], [61, 38], [65, 16], [70, 22], [74, 26], [58, 29], [63, 37], [68, 17], [73, 21]];
    jars.forEach(([x, c], k) => { const sy = k < 5 ? 198 : 206; rect(x, sy - 5, 3, 5, c); put(x + 1, sy - 6, 31); put(x, sy - 4, LITE[c]); });
    // hanging herbs and garlic
    for (const [x, c] of [[58, 27], [64, 33], [70, 26], [76, 33]]) { vl(x, 190, 193, 31); ell(x, 195, 1.6, 2, c); }
    // broom leaning by the door (it flies away when the bell rings, drawn live)
    // cookbook on a lectern
    rect(60, 232, 2, 14, 19); poly([[54, 228], [68, 226], [68, 230], [54, 232]], 20); rect(56, 226, 10, 3, 33); vl(61, 226, 228, 31);
    floorBoards(13, 82, 246, R_KIT, 30, 1);
  }
  function buildBall() {
    wallpaper(86, 190, 176, 246, R_BALL, 15, 21, 'damask');
    wainscot(86, 176, 230, 246, R_BALL, 13, 14, 22);
    pen(MR, R_BALL);
    // tall window at the back showing the moonlit night
    pen(ME, R_BALL); rect(144, 198, 14, 26, 21); rect(145, 199, 12, 24, 2); for (let y = 200; y < 222; y++) for (let x = 146; x < 156; x++) if (ih(x, y, 31) < 0.03) put(x, y, 6);
    vl(150, 199, 222, 21); hl(145, 156, 210, 21);
    pen(MR, R_BALL);
    rect(141, 196, 3, 32, 16); rect(158, 196, 3, 32, 16); hl(140, 161, 196, 22);
    portrait(104, 200, 12, 15, R_BALL, 'lady');
    // checkered floor strip
    for (let x = 86; x < 176; x++) { put(x, 245, ((x >> 2) & 1) ? 33 : 1); put(x, 244, ((x >> 2) & 1) ? 1 : 33); }
    // chandelier chain
    vl(131, 190, 196, 31);
  }
  function buildHall() {
    wallpaper(180, 78, 231, 246, R_HALL, 26, 25, 'stripe');
    wainscot(180, 231, 230, 246, R_HALL, 19, 18, 21);
    pen(MR, R_HALL);
    // landings
    const land = (x0, x1, y) => { for (let x = x0; x <= x1; x++) for (let k = 0; k < 4; k++) put(x, y + k, k === 0 ? 21 : k === 3 ? 18 : 19); };
    land(222, 230, 158); land(222, 230, 216);
    // stairs: flights of 7 steps
    const flight = (xa, ya, xb, yb) => {
      const n = 7, dx = (xb - xa) / n, dy = (yb - ya) / n;
      for (let s = 0; s < n; s++) {
        const x0 = Math.round(xa + dx * s), y0 = Math.round(ya + dy * s + dy);
        const x1 = Math.round(xa + dx * (s + 1));
        const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
        hl(lo, hi, y0 - 1, 21); hl(lo, hi, y0, 20);
        for (let y = y0 + 1; y < y0 + 4; y++) hl(lo, hi, y, 19);
      }
      // stringer
      line(xa, ya + 3, xb, yb + 3, 18);
    };
    flight(196, F3Y, 226, 158); flight(222, 158, 192, F2Y); flight(202, F2Y, 226, 216); flight(222, 216, 194, F1Y);
    // banister posts
    for (const [x, y] of [[196, F3Y], [226, 158], [192, F2Y], [222, 216], [194, F1Y]]) { vl(x, y - 8, y - 1, 20); put(x, y - 9, 21); }
    // ladder to the attic hatch
    for (let y = 80; y < 130; y++) { put(184, y, 20); put(190, y, 20); if (y % 5 === 0) hl(184, 190, y, 21); }
    // portraits up the stairwell
    portrait(183, 140, 12, 15, R_HALL, 'count');
    portrait(184, 196, 12, 15, R_HALL, 'gent');
    // grandfather clock under the stairs (pendulum live)
    rect(181, 212, 9, 34, 19); hl(181, 189, 212, 21); rect(182, 214, 7, 7, 33); rect(183, 223, 5, 16, 2); vl(181, 212, 245, 20);
    // the doorbell on the wall
    rect(224, 222, 2, 2, 31);
    // coat hooks and a pumpkin by the door
    hl(212, 220, 226, 31); rect(212, 227, 3, 10, 38); rect(217, 227, 3, 12, 16);
    ell(224, 242, 4, 3.5, 37); put(224, 238, 27); put(222, 241, 22); put(226, 241, 22); hl(222, 226, 243, 22);
    // trapdoor to the cellar
    rect(198, F1Y, 14, 1, 18);
    // gas sconces
    rect(195, 100, 3, 4, 21); rect(183, 206, 3, 4, 21);
  }
  function buildCellar() {
    wallpaper(13, 250, 231, 292, R_CEL, 30, 10, 'stone');
    pen(MR, R_CEL);
    // furnace
    rect(120, 262, 24, 30, 1); rect(122, 264, 20, 26, 2); rect(126, 276, 12, 8, 13); for (let x = 127; x < 137; x += 2) vl(x, 277, 283, 14);
    rect(128, 250, 6, 12, 31); vl(131, 250, 261, 30);
    // pipes
    hl(13, 230, 254, 31); hl(13, 230, 255, 30); vl(70, 250, 262, 31);
    // shelves with candy bowls
    for (const sy of [266, 278]) { hl(18, 60, sy, 20); hl(18, 60, sy + 1, 19); }
    for (let k = 0; k < 5; k++) { const x = 20 + k * 8; ell(x + 2, 264, 3, 2, 38); put(x + 1, 262, 37); put(x + 3, 262, 28); put(x + 2, 261, 17); }
    for (let k = 0; k < 5; k++) { const x = 20 + k * 8; ell(x + 2, 276, 3, 2, 37); put(x + 1, 274, 22); put(x + 3, 274, 39); }
    // candy sacks
    for (const [x, h] of [[150, 14], [162, 11], [172, 13]]) { poly([[x, 292], [x + 2, 292 - h], [x + 4, 292 - h - 2], [x + 6, 292 - h], [x + 9, 292]], 20); put(x + 4, 292 - h - 3, 21); }
    for (let k = 0; k < 9; k++) put(150 + fl(ih(k, 1, 33) * 30), 290 + fl(ih(k, 2, 33) * 2), [17, 28, 22, 39, 37][k % 5]);
    // barrels
    for (const x of [186]) { rect(x, 276, 12, 16, 19); hl(x, x + 11, 279, 31); hl(x, x + 11, 288, 31); }
    // the cellar stair (from the trapdoor down to the cellar floor)
    for (let s = 0; s < 8; s++) { const x = 198 - s * 4, y = 254 + s * 5; hl(x - 4, x + 2, y, 21); rect(x - 4, y + 1, 7, 3, 19); }
    // table for the zombie's candy sorting
    rect(46, 282, 22, 2, 20); rect(48, 284, 2, 8, 19); rect(64, 284, 2, 8, 19);
    floorBoards(13, 231, 292, R_CEL, 30, 2);
  }
  function buildPorch() {
    pen(MR, R_PORCH);
    rect(234, 246, 24, 3, 20); hl(234, 257, 246, 22); rect(234, 249, 24, 3, 19);
    for (let s = 0; s < 2; s++) rect(256 + s * 3, 249 + s * 1, 4, 3 - s, 20);
    // awning
    poly([[232, 204], [262, 204], [258, 208], [232, 208]], 15); hl(232, 261, 204, 16); for (let x = 234; x < 260; x += 4) put(x, 208, 14);
    rect(256, 208, 2, 38, 20); vl(256, 208, 245, 21);
    // porch lantern (flame live) and the outside bell button
    rect(237, 212, 5, 7, 1); hl(236, 242, 211, 31);
    rect(236, 230, 2, 3, 31); put(236, 231, 22);
    // a jack-o'-lantern on the steps
    ell(262, 243, 4.5, 3.6, 37); put(262, 239, 27);
    // the path and an iron fence
    pen(MR, R_EXT);
    for (let x = 258; x < AW; x++) put(x, 252, 31);
    for (let x = 262; x < AW; x += 4) { vl(x, 238, 251, 1); put(x, 237, 4); }
    hl(262, AW - 1, 241, 1); hl(262, AW - 1, 247, 1);
    // tombstones by the tree
    rect(0, 240, 6, 12, 31); hl(0, 5, 240, 32);
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
    let Lt = roomLight(room, lx, ly, -1);
    Lt = [0.45 + 0.62 * Lt[0], 0.45 + 0.62 * Lt[1], 0.45 + 0.62 * Lt[2]];
    if (opt.bright) Lt = [Lt[0] * opt.bright, Lt[1] * opt.bright, Lt[2] * opt.bright];
    const slot = SLOTS.length; SLOTS.push(Lt);
    ox = Math.round(ox); oy = Math.round(oy);
    const clip = opt.clip;
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const i = y * L.w + x, c = L.c[i]; if (!c) continue;
      const X = ox + x, Y = oy + y;
      if (X < 0 || Y < 0 || X >= AW || Y >= AH) continue;
      if (clip && (X < clip[0] || Y < clip[1] || X >= clip[2] || Y >= clip[3])) continue;
      if (opt.ghost && ((X + Y) & 1) && L.m[i] !== ME) continue; // translucent: every other pixel
      const j = Y * AW + X;
      SC.c[j] = c; SC.m[j] = L.m[i] === ME ? ME : MS; SL[j] = slot;
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
  };
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
    return { L, ox, oy, J };
  }
  function put1(x, y, c) { put(x, y, c); }

  /* ---------------------------------------------------------------- the cast */
  const SPEC = {
    vamp: { leg: 10, torso: 9, sw: 8, hw: 6, arm: 8, leg_c: 1, legD: 0, shoe: 0, torso_c: 1, torsoD: 0, sleeve: 1, sleeveD: 0, hand: 7, head: 'vamp',
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
    frank: { leg: 11, torso: 11, sw: 11, hw: 8, arm: 9, leg_c: 2, legD: 1, shoe: 0, torso_c: 32, torsoD: 31, sleeve: 28, sleeveD: 27, hand: 28, head: 'frank',
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
        if (stage === 'front' && p.jacketHeld) { const [hx, hy] = J.hF; rect(hx - 1, hy, 4, 7, 2); }
      } },
    mummy: { leg: 10, torso: 9, sw: 8, hw: 7, arm: 8, leg_c: 32, legD: 31, shoe: 31, torso_c: 32, torsoD: 31, sleeve: 32, sleeveD: 31, hand: 33, head: 'mummy',
      extra(J, p, stage) {
        if (stage === 'torso') for (let y = J.shY + 1; y < J.hipY; y += 2) hl(J.hipX - 3, J.hipX + 3, y, (y >> 1) & 1 ? 31 : 33);
        if (stage === 'front' && p.brush) { const [hx, hy] = J.hF; hl(hx, hx + 3, hy - 1, 6); put(hx + 3, hy - 2, 8); if (p.foam) { put(hx + 4, hy - 3, 8); put(hx + 2, hy - 3, 8); } }
        if (stage === 'front' && p.spin) { for (let k = 0; k < 3; k++) { const yy = J.shY + 2 + k * 3 + (p.spin & 1); hl(J.hipX - 6, J.hipX + 6, yy, 33); } }
      } },
    wolf: { leg: 10, torso: 9, sw: 10, hw: 7, arm: 8, leg_c: 4, legD: 3, shoe: 34, torso_c: 35, torsoD: 34, sleeve: 34, sleeveD: 34, hand: 35, head: 'wolf', headDx: 1,
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
    witch: { leg: 9, torso: 9, sw: 8, hw: 10, arm: 8, leg_c: 1, legD: 0, shoe: 0, torso_c: 38, torsoD: 11, sleeve: 38, sleeveD: 11, hand: 28, head: 'witch', headDy: 1,
      extra(J, p, stage) {
        if (stage === 'torso') { poly([[J.hipX - 6, J.hipY], [J.hipX + 6, J.hipY], [J.hipX + 7, J.oy - 1], [J.hipX - 7, J.oy - 1]], 38, (x) => ((x & 3) === 0 ? 11 : 38)); }
        if (stage === 'front' && p.paddle) { const [hx, hy] = J.hF; line(hx, hy - 3, hx + 7, hy + 9, 20); line(hx + 1, hy - 3, hx + 8, hy + 9, 19); }
      } },
    skel: { leg: 8, torso: 8, sw: 7, hw: 5, arm: 7, leg_c: 33, legD: 32, shoe: 33, torso_c: 0, torsoD: 0, sleeve: 33, sleeveD: 32, hand: 33, head: 'skull',
      extra(J, p, stage) {
        if (stage === 'torso') {
          for (let y = J.shY; y < J.hipY - 1; y += 2) hl(J.shX - 3, J.shX + 3, y, 33);
          vl(Math.round(J.shX), J.shY, J.hipY, 32); hl(J.hipX - 3, J.hipX + 3, J.hipY, 32);
          if (p.tie) { put(J.shX - 1, J.shY - 1, 16); put(J.shX + 1, J.shY - 1, 16); put(J.shX, J.shY - 1, 15); }
          if (p.band) hl(J.shX - 3, J.shX + 2, J.shY - 7, 16);
        }
        if (stage === 'head') {
          if (p.jawOff) { /* the jaw is missing */ } else { hl(J.headX + 1, J.headX + 5, J.headY + 6, p.sing ? 0 : 33); hl(J.headX + 1, J.headX + 5, J.headY + 6 + (p.sing ? 1 : 0), 33); put(J.headX + 2, J.headY + 6 + (p.sing ? 1 : 0), 0); put(J.headX + 4, J.headY + 6 + (p.sing ? 1 : 0), 0); }
          if (p.band) hl(J.headX, J.headX + 6, J.headY + 1, 16);
        }
        if (stage === 'front' && p.sticks) { for (const h of [J.hF, J.hB]) { line(h[0], h[1], h[0] + 3, h[1] - 3, 33); put(h[0] + 3, h[1] - 4, 33); put(h[0] + 4, h[1] - 3, 33); } }
        if (stage === 'front' && p.holdJaw) { const [hx, hy] = J.hF; hl(hx, hx + 4, hy - 2, 33); put(hx + 1, hy - 3, 33); put(hx + 3, hy - 3, 33); }
      } },
    zombie: { leg: 10, torso: 9, sw: 9, hw: 7, arm: 8, leg_c: 3, legD: 2, shoe: 19, torso_c: 5, torsoD: 4, sleeve: 5, sleeveD: 4, hand: 27, head: 'zombie',
      extra(J, p, stage) {
        if (stage === 'torso') { put(J.shX + 2, J.shY + 4, 27); put(J.shX - 1, J.shY + 6, 27); put(J.shX + 1, J.hipY - 1, 3); hl(J.hipX - 3, J.hipX + 3, J.hipY + 1, 19); }
        if (stage === 'front' && p.bowl) { const [hx, hy] = J.hF; ell(hx + 2, hy + 1, 4, 2.2, 37); put(hx, hy - 1, 17); put(hx + 2, hy - 2, 22); put(hx + 4, hy - 1, 28); put(hx + 3, hy - 1, 39); }
        if (stage === 'front' && p.scoop) { const [hx, hy] = J.hF; rect(hx, hy - 1, 3, 2, 31); }
        if (stage === 'front' && p.candy) { const [hx, hy] = J.hF; put(hx + 1, hy - 2, 17); }
      } },
  };
  // a cast member drawn at feet (x, y)
  function actor(name, x, y, p, opt) {
    const R = rig(SPEC[name], p);
    stamp(R.L, x - R.ox, y - R.oy, x, y - 14, opt);
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
    // face
    rect(10, 5, 2, 3, 0); rect(13, 5, 1, 3, 0);
    if (p.mouth) { rect(11, 9, 2, 2, 0); } else put(12, 9, 0);
    if (p.blush) { put(9, 8, 17); put(14, 8, 17); }
    // arms
    const aU = p.armsUp;
    if (aU) { put(2, 5, 33); put(1, 4, 33); put(16, 5, 33); put(17, 4, 33); }
    else { put(16, 9, 33); put(17, 8, 33); }
    if (p.hold) p.hold(L);
    if (p.flip) flipL(L);
    outline(L, 3);
    stamp(L, x - 9, y - 16, x, y - 8, { room: p.room, bright: 1.15 });
  }
  const CAT_SIT = ['k....k..', 'kk..kk..', 'kkkkkk..', 'kekkek..', 'kkkkkk..', '.kkkk...', 'kkkkkk..', 'kkkkkkk.', 'kkkkkkkk', '.k.k..kk'];
  const CAT_SWAT = ['k....k....', 'kk..kk..kk', 'kkkkkk..k.', 'kekkekkk..', 'kkkkkkk...', '.kkkk.....', 'kkkkkk....', 'kkkkkkk...', 'kkkkkkkk..', '.k.k..kk..'];
  const CAT_RUN = [['k.k.........', 'kkkk.......k', 'kekk......k.', 'kkkkkkkkkk..', '.kkkkkkkkk..', '.k.k...k.k..', 'k...k.k...k.'], ['k.k.........', 'kkkk......k.', 'kekk.....k..', 'kkkkkkkkkk..', '.kkkkkkkkk..', '..kk...kk...', '..k.k..k.k..']];
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
    // boots
    rect(ox - 3 + (ph === 1 ? 1 : 0), oy - 1, 3, 2, 31); rect(ox + 1 - (ph === 1 ? 1 : 0), oy - 1, 3, 2, 31);
    // suit
    rect(ox - 3, oy - 5, 7, 4, 33); rect(ox - 4, oy - 11, 9, 7, 33); hl(ox - 4, ox + 4, oy - 8, 16); rect(ox - 1, oy - 10, 2, 2, 4); put(ox + 2, oy - 10, 17);
    rect(ox - 6, oy - 11, 2, 6, 31); // backpack
    // helmet
    ell(ox + 0.5, oy - 15, 4.6, 4.4, 33); ell(ox + 1.5, oy - 15, 3, 2.6, 4); put(ox + 2, oy - 16, 7); put(ox + 3, oy - 15, 6);
    put(ox - 3, oy - 19, 31); put(ox - 3, oy - 20, 16);
    // arm and the candy bag
    if (p.bagOut) { hl(ox + 3, ox + 6, oy - 9, 33); rect(ox + 6, oy - 10, 2, 2, 32); poly([[ox + 5, oy - 8], [ox + 10, oy - 8], [ox + 11, oy - 2], [ox + 4, oy - 2]], 37); hl(ox + 5, ox + 9, oy - 8, 22); put(ox + 7, oy - 5, 0); put(ox + 8, oy - 5, 0); hl(ox + 6, ox + 9, oy - 4, 0); }
    else if (p.press) { line(ox - 3, oy - 10, ox - 6, oy - 15, 33); rect(ox - 7, oy - 16, 2, 2, 32); poly([[ox + 2, oy - 6], [ox + 6, oy - 6], [ox + 7, oy - 1], [ox + 1, oy - 1]], 37); }
    else { vl(ox + 4, oy - 10, oy - 6, 33); poly([[ox + 3, oy - 5], [ox + 8, oy - 5], [ox + 9, oy], [ox + 2, oy]], 37); hl(ox + 3, ox + 7, oy - 5, 22); }
    if (p.flip) flipL(L);
    outline(L, 0);
    stamp(L, x - ox, y - oy, x, y - 10, { room: R_PORCH });
  }
  function bubble(x, y, lines, tailX) {
    TG = SC; pen(ME, R_EXT);
    const w = Math.max(...lines.map((s) => s.length)) * 4 + 3, h = lines.length * 6 + 3;
    rect(x, y, w, h, 8); hl(x + 1, x + w - 2, y - 1, 8); hl(x + 1, x + w - 2, y + h, 8); vl(x - 1, y + 1, y + h - 2, 8); vl(x + w, y + 1, y + h - 2, 8);
    hl(x + 1, x + w - 2, y - 2, 0); hl(x + 1, x + w - 2, y + h + 1, 0); vl(x - 2, y + 1, y + h - 2, 0); vl(x + w + 1, y + 1, y + h - 2, 0);
    put(x - 1, y, 0); put(x + w, y, 0); put(x - 1, y + h - 1, 0); put(x + w, y + h - 1, 0);
    // tail toward the kid (down-right)
    const tx = tailX !== undefined ? tailX - 2 : x + w - 8;
    const tl = tailX !== undefined ? 9 : 4;
    for (let k = 0; k < tl; k++) { const a = tx + Math.round(k * 0.35), b = tx + 3 - Math.round(k * 0.1); hl(a, Math.max(a, b), y + h + k, 8); put(a - 1, y + h + k, 0); put(Math.max(a, b) + 1, y + h + k, 0); }
    put(tx + Math.round(tl * 0.35), y + h + tl, 0);
    lines.forEach((s, k) => text(s, x + 2, y + 2 + k * 6, 0));
  }
  /* ================================================================ the story */
  const T_BELL = 20.0, T_RUN = 20.9, T_OPEN = 24.0, T_POSE = 24.6, T_COOL = 25.4, T_SIGH = 27.4, T_CANDY = 27.9, T_LEAVE = 28.6, T_BACK = 29.6;
  const DOORX = 231;
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
  // stairwell route pieces
  const DOWN3 = [[196, F3Y], [226, 158], [222, 158], [192, F2Y]];
  const DOWN2 = [[202, F2Y], [226, 216], [222, 216], [194, F1Y]];
  const CAST = {
    vamp: { path: [[56, F3Y], [92, F3Y], [178, F3Y]].concat(DOWN3, DOWN2, [[221, F1Y]]), d0: 0.0, d1: 0.35, v: 118, vb: 62, face: 1 },
    mummy: { path: [[146, F3Y], [178, F3Y]].concat(DOWN3, DOWN2.slice(0, 3), [[205, 234.2]]), d0: 0.25, d1: 0.0, v: 90, vb: 55, face: 1 },
    wolf: { path: [[47, F2Y], [82, F2Y], [178, F2Y]].concat(DOWN2, [[209, F1Y]]), d0: 0.15, d1: 0.2, v: 95, vb: 52, face: -1 },
    frank: { path: [[132, F2Y], [178, F2Y]].concat(DOWN2, [[186, F1Y]]), d0: 0.45, d1: 0.1, v: 70, vb: 45, face: -1 },
    drum: { path: [[100, F1Y], [178, F1Y], [194, F1Y], [213, 225.6]], d0: 0.3, d1: 0.0, v: 60, vb: 40, face: 1 },
    bass: { path: [[136, F1Y], [178, F1Y], [194, F1Y], [212, 226], [213, 205]], d0: 0.55, d1: 0.15, v: 70, vb: 40, face: 1 },
    sing: { path: [[160, F1Y], [178, F1Y], [194, F1Y], [222, 216], [227, 216]], d0: 0.0, d1: 0.3, v: 75, vb: 40, face: -1 },
    zombie: { path: [[74, FCY], [168, FCY], [198, 254], [197, F1Y]], d0: 0.2, d1: 0.25, v: 75, vb: 40, face: -1 },
    witch: { path: [[60, F1Y], [62, 228], [130, 214], [197, 209]], d0: 0.1, d1: 0.0, v: 75, vb: 50, face: -1 },
  };
  for (const k in CAST) CAST[k].len = plen(CAST[k].path);
  // where is a cast member, and what are they doing?
  function where(name, t) {
    const C = CAST[name];
    const arrive = T_RUN + C.d0 + C.len / C.v;
    const back0 = T_BACK + C.d1, home = back0 + C.len / C.vb;
    if (t < T_BELL || t >= home) return { mode: 'home' };
    if (t < T_RUN + C.d0) return { mode: 'freeze' };
    if (t < arrive) { const a = along(C.path, (t - T_RUN - C.d0) / (arrive - T_RUN - C.d0)); return { mode: 'run', x: a.x, y: a.y, dir: a.dir }; }
    const end = C.path[C.path.length - 1];
    if (t < back0) return { mode: t < T_POSE ? 'ready' : t < T_SIGH ? 'pose' : 'slump', x: end[0], y: end[1], dir: 1 };
    const a = along(C.path, 1 - (t - back0) / (home - back0));
    return { mode: 'back', x: a.x, y: a.y, dir: -a.dir };
  }
  const runPh = (t) => fl(t * 12) & 3;
  const walkPh = (t) => fl(t * 7) & 3;

  // marks over heads when the bell rings
  const MARKS = [];
  function mark(x, y) { MARKS.push([Math.round(x), Math.round(y)]); }
  function drawMarks(t) {
    if (t < T_BELL + 0.15 || t >= T_RUN + 0.1) return;
    TG = SC; pen(ME, R_EXT);
    for (const [x, y] of MARKS) {
      const j = (fl(t * 15) & 1);
      rect(x - 1, y - 7 - j, 3, 7, 0); rect(x - 1, y - 9 - j, 3, 1, 0);
      vl(x, y - 6 - j, y - 3 - j, 8); put(x, y - 1 - j, 8); put(x, y - 2 - j, 0);
    }
  }
  // dust puffs behind runners
  function dust(x, y, t, dir) { TG = SC; pen(MR, roomAt(x, y - 2)); const k = fl(t * 12) % 3; for (let i = 0; i < 2 + k; i++) put(x - dir * (4 + i * 2), y - 1 - (i & 1), 31); }

  /* ---------------------------------------------------------------- each member of the cast */
  function doVamp(t, q) {
    const w = where('vamp', t);
    const p = { aF: -10, aB: 10, cape: 0, headName: 'vamp' };
    let x = 56, y = F3Y, flip = false;
    if (w.mode === 'home' || w.mode === 'freeze') {
      const u = (w.mode === 'freeze' ? T_BELL : q) % 6;
      if (u < 1.2) { p.aF = 150; p.aB = 140; p.headName = 'vampScare'; p.lean = 1; }
      else if (u < 2.0) { p.aF = 20; p.aB = 15; p.hdy = 0; }
      else if (u < 3.2) { p.aF = 100; p.aB = 100; p.cape = 1; p.headName = 'vampScare'; }
      else if (u < 3.8) { p.aF = 40; p.aB = 40; p.hdy = 1; }
      else if (u < 5.6) { p.aF = 165 + ((fl(q * 6) & 1) ? 8 : -8); p.comb = true; COMB = [x + 2 + ((fl(q * 6) & 1) ? 1 : 0), y - 25]; }
      if (w.mode === 'freeze') { p.headName = 'vamp'; mark(x + 1, y - 30); }
    } else if (w.mode === 'run' || w.mode === 'back') {
      x = w.x; y = w.y; flip = w.dir < 0;
      if (w.mode === 'run') { p.run = runPh(t); p.aF = 120; p.aB = 120; p.cape = 0.6; p.lean = 2; dust(x, y, t, w.dir || 1); }
      else { p.run = walkPh(t); p.aF = 5; p.aB = 5; p.hdy = 1; p.lean = 1; }
    } else {
      x = w.x; y = w.y;
      if (w.mode === 'ready') { p.aF = 30; p.aB = 20; }
      if (w.mode === 'pose') { p.aF = 120; p.aB = 140; p.cape = 1.2; p.headName = 'vampScare'; p.lean = 1; }
      if (w.mode === 'slump') {
        p.aF = 5; p.aB = 5; p.hdy = 1;
        if (t >= T_SIGH && t < T_CANDY) { p.hdy = 2; SIGH = [x + 4, y - 30, t - T_SIGH]; flip = t > T_SIGH + 0.25; if (flip) { p.aF = 60; } }
        else if (t >= T_CANDY && t < T_CANDY + 0.25) { flip = true; p.aF = 70; p.candy = true; }
        else if (t >= T_CANDY + 0.25 && t < T_LEAVE) { p.aF = 85; p.candy = t < T_CANDY + 0.45; p.hdy = 1; }
      }
    }
    if (flip) p.flip = true;
    actor('vamp', x, y, p);
    return { x, y };
  }
  let COMB = null, SIGH = null;
  function doMummy(t, q) {
    const w = where('mummy', t);
    const p = { aF: -5, aB: 5 };
    let x = 146, y = F3Y, flip = false;
    if (w.mode === 'home' || w.mode === 'freeze') {
      const u = (w.mode === 'freeze' ? T_BELL : q) % 3;
      p.aF = 150 + ((fl(q * 8) & 1) ? 6 : -6); p.brush = true; p.foam = u > 1;
      if (w.mode === 'freeze') { p.aF = 140; mark(x + 1, y - 27); }
    } else if (w.mode === 'run' || w.mode === 'back') {
      x = w.x; y = w.y; flip = w.dir < 0;
      p.run = w.mode === 'run' ? runPh(t) : walkPh(t);
      if (w.mode === 'run') { p.aF = 100; p.aB = 80; p.spin = fl(t * 10); dust(x, y, t, w.dir || 1); } else { p.hdy = 1; }
    } else {
      x = w.x; y = w.y;
      if (w.mode === 'pose') { p.aF = 95; p.aB = 90; p.lean = 1; }
      else if (w.mode === 'slump') { p.hdy = 1; }
      else { p.aF = 20; }
    }
    if (flip) p.flip = true;
    actor('mummy', x, y, p);
    return { x, y, mode: w.mode };
  }
  function trailLen(t) {
    // the unrolled bandage (in px along the route), grows while he brushes, reels in when he runs
    const full = 250, L0 = 46;
    if (t < T_BELL) return lerp(L0, full, t / T_BELL);
    if (t < T_RUN + 0.25) return full;
    if (t < T_RUN + 1.6) return full * (1 - (t - T_RUN - 0.25) / 1.35);
    const home = T_BACK + CAST.mummy.d1 + CAST.mummy.len / CAST.mummy.vb;
    if (t < home) return 0;
    return L0 * clamp((t - home) / (D - home), 0, 1);
  }
  const TRAIL = [[143, 122], [145, 129], [178, 129], [196, 129], [226, 157], [222, 157], [192, 185], [202, 185], [226, 215], [222, 215], [194, 245], [216, 245]];
  function drawTrail(t) {
    const L = trailLen(t); if (L < 1) return;
    const tot = plen(TRAIL);
    TG = SC;
    const n = Math.ceil(L);
    for (let s = 0; s <= n; s++) {
      const a = along(TRAIL, s / tot);
      pen(MR, roomAt(a.x, a.y - 1));
      const w = (s % 7 === 0) ? 31 : 33;
      put(a.x, a.y, w); put(a.x, a.y - 1, s % 3 === 0 ? 32 : 33);
    }
  }
  function doWolf(t, q) {
    const w = where('wolf', t);
    const p = { aF: 10, aB: 10, poof: 0 };
    let x = 47, y = F2Y, flip = true;
    if (w.mode === 'home' || w.mode === 'freeze') {
      const u = (w.mode === 'freeze' ? T_BELL : q) % 6;
      p.sit = true; y = F2Y - 6;
      if (u < 4) { p.poof = u / 4; p.aF = 160; p.dryer = true; AIR = [x - 10, y - 20, q]; }
      else if (u < 5) { p.poof = 1 - (u - 4); p.aF = 170 + ((fl(q * 8) & 1) ? 6 : -6); p.aB = 160; }
      else { p.poof = 0; p.aF = 30; }
      if (w.mode === 'freeze') { p.headName = 'wolf'; mark(x - 1, y - 30); }
    } else if (w.mode === 'run' || w.mode === 'back') {
      x = w.x; y = w.y; flip = w.dir < 0; p.poof = w.mode === 'run' ? 1 : 0.5;
      p.run = w.mode === 'run' ? runPh(t) : walkPh(t);
      if (w.mode === 'run') { p.aF = 110; p.aB = 70; p.lean = 2; dust(x, y, t, w.dir || 1); } else { p.hdy = 1; }
    } else {
      x = w.x; y = w.y; flip = false; p.poof = 0.9;
      if (w.mode === 'pose') { p.aF = 150; p.aB = 160; p.crouch = 2; p.headName = 'wolfHowl'; }
      else if (w.mode === 'slump') { p.hdy = 1; p.poof = 0.6; }
    }
    if (flip) p.flip = true;
    actor('wolf', x, y, p);
    return { x, y };
  }
  let AIR = null;
  function doFrank(t, q) {
    const w = where('frank', t);
    const p = { aF: 0, aB: 0, jacket: 0 };
    let x = 134, y = F2Y, flip = true;
    if (w.mode === 'home' || w.mode === 'freeze') {
      const u = (w.mode === 'freeze' ? T_BELL : q) % 4;
      const stroke = Math.sin(q * Math.PI) * 0.5 + 0.5;
      p.aF = 60 + stroke * 30; p.iron = true; p.aB = 20;
      IRON = [x - 8 - stroke * 9, F2Y - 21, q];
      p.zap = u > 2.0 && u < 2.3;
      if (w.mode === 'freeze') { p.zap = false; mark(x, y - 34); }
    } else if (w.mode === 'run' || w.mode === 'back') {
      x = w.x; y = w.y; flip = w.dir < 0;
      p.run = w.mode === 'run' ? runPh(t) : walkPh(t);
      if (w.mode === 'run') { p.jacket = 1; p.aF = 95; p.aB = 60; p.lean = 1; dust(x, y, t, w.dir || 1); }
      else { p.jacketHeld = true; p.aF = 30; p.hdy = 1; }
    } else {
      x = w.x; y = w.y; flip = false; p.jacket = 1;
      if (w.mode === 'pose') { p.aF = 92; p.aB = 88; }
      else if (w.mode === 'slump') { p.hdy = 1; }
    }
    if (flip) p.flip = true;
    actor('frank', x, y, p);
    return { x, y };
  }
  let IRON = null;
  function doWitch(t, q) {
    const w = where('witch', t);
    const p = { aF: 60, aB: 30 };
    let x = 60, y = F1Y, flip = true, broom = false;
    if (w.mode === 'home' || w.mode === 'freeze') {
      const u = (w.mode === 'freeze' ? T_BELL : q);
      const a = u * TAU / 1.5;
      p.aF = 75 + Math.sin(a) * 18; p.paddle = true; p.lean = Math.cos(a) > 0 ? 1 : 0;
      if (w.mode === 'freeze') mark(x, y - 33);
    } else if (w.mode === 'run' || w.mode === 'back') {
      x = w.x; y = w.y; flip = w.dir < 0; broom = true; p.sit = true; p.aF = 70; p.aB = 60;
      if (w.mode === 'back') p.hdy = 1;
    } else {
      x = w.x; y = w.y; flip = false; broom = true; p.sit = true;
      if (w.mode === 'pose') { p.aF = 160; p.aB = 150; }
      else if (w.mode === 'slump') { p.hdy = 1; p.aF = 40; }
      y += Math.round(Math.sin(t * 4) * 1);
    }
    if (broom) {
      // the broom under her
      TG = SC; pen(MR, roomAt(x, y));
      const f = flip ? -1 : 1;
      line(x - 12 * f, y - 4, x + 10 * f, y - 6, 20);
      for (let k = 0; k < 5; k++) line(x - 12 * f, y - 4, x - 17 * f, y - 6 + k, 22);
    }
    if (flip) p.flip = true;
    actor('witch', x, y, p);
    return { x, y, broom, flip };
  }
  function doSkel(name, t, q) {
    const w = where(name, t);
    const home = { drum: [100, F1Y], bass: [136, F1Y], sing: [160, F1Y] }[name];
    const p = { aF: 10, aB: 10, tie: name === 'sing', band: name === 'drum' };
    let x = home[0], y = home[1], flip = name === 'sing';
    const beat = fl(q * 4) & 1;
    if (w.mode === 'home' || w.mode === 'freeze') {
      const u = (w.mode === 'freeze' ? T_BELL : q) % 6;
      if (name === 'drum') { p.sit = true; y = F1Y - 5; p.sticks = true; p.aF = beat ? 60 : 100; p.aB = beat ? 100 : 60; }
      if (name === 'bass') { p.aF = 70 + (beat ? 10 : 0); p.aB = 40; p.hdy = beat; }
      if (name === 'sing') {
        p.sing = (fl(q * 5) & 1) === 1; p.aF = 120; p.aB = 20;
        if (u > 3.0 && u < 4.2) { p.jawOff = true; p.sing = false; if (u > 3.4) { p.holdJaw = true; p.aF = 60; } else JAW = [x - 4, F1Y - 22 + (u - 3.0) * 40, u]; }
        if (u >= 4.2 && u < 4.6) { p.aF = 150; }
      }
      if (w.mode === 'freeze') { mark(x, y - 26); p.sing = false; }
    } else if (w.mode === 'run' || w.mode === 'back') {
      x = w.x; y = w.y; flip = w.dir < 0;
      p.run = w.mode === 'run' ? runPh(t + (name === 'bass' ? 0.1 : 0)) : walkPh(t);
      if (w.mode === 'run') { p.aF = 140; p.aB = 150; dust(x, y, t, w.dir || 1); } else { p.hdy = 1; }
      if (name === 'drum') p.sticks = true;
    } else {
      x = w.x; y = w.y; flip = name === 'sing';
      if (w.mode === 'pose') { p.aF = 150; p.aB = 160; p.sing = true; }
      else if (w.mode === 'slump') { p.hdy = 1; }
      if (name === 'drum') p.sticks = true;
    }
    if (flip) p.flip = true;
    actor('skel', x, y, p);
    return { x, y };
  }
  let JAW = null;
  function doZombie(t, q) {
    const w = where('zombie', t);
    const p = { aF: 40, aB: 10 };
    let x = 74, y = FCY, flip = true;
    if (w.mode === 'home' || w.mode === 'freeze') {
      const u = (w.mode === 'freeze' ? T_BELL : q) % 6;
      if (u < 2.5) { p.aF = 80 + Math.sin(u * 6) * 6; p.scoop = true; POUR = [x - 13, FCY - 12, u]; }
      else if (u < 3.5) { p.aF = 150; p.candy = true; }
      else if (u < 4.5) { p.aF = 10; p.hdy = (fl(q * 8) & 1); }
      else { p.aF = 20; flip = (fl(q * 2) & 1) === 0; }
      if (w.mode === 'freeze') { p.hdy = 0; mark(x, y - 28); }
    } else if (w.mode === 'run' || w.mode === 'back') {
      x = w.x; y = w.y; flip = w.dir < 0;
      p.run = w.mode === 'run' ? runPh(t) : walkPh(t); p.bowl = true; p.aF = 85;
      if (w.mode === 'back') p.hdy = 1;
    } else {
      x = w.x; y = w.y; flip = false; p.bowl = true; p.aF = 85;
      if (w.mode === 'pose') { p.aF = 90; p.aB = 95; p.lean = 1; }
      if (w.mode === 'slump') { p.hdy = 1; }
      if (t >= T_SIGH && t < T_CANDY + 0.2) { p.aF = 70; }
    }
    if (flip) p.flip = true;
    actor('zombie', x, y, p);
    return { x, y };
  }
  let POUR = null;
  function doGhosts(t, q) {
    const G = [
      { home: [98, 64], spot: [188, 178], path: [[98, 64], [150, 120], [188, 178]], d: 0.05 },
      { home: [126, 58], spot: [205, 175], path: [[126, 58], [172, 120], [205, 175]], d: 0.2 },
      { home: [155, 64], spot: [223, 198], path: [[155, 64], [212, 92], [223, 198]], d: 0.35 },
    ];
    const out = [];
    G.forEach((g, k) => {
      const arrive = T_RUN + g.d + 1.1, back0 = T_BACK + 0.4 * k, home = back0 + 2.4;
      let x = g.home[0], y = g.home[1], pp = { ph: fl(q * 6) + k, flip: k === 2 };
      const bob = Math.round(Math.sin(q * TAU / 3 + k * 2) * 1.2);
      if (t < T_BELL || t >= home) {
        y += bob;
        if (k === 0) pp.hold = teapot(q); // pouring tea
        if (k === 1) pp.hold = biscuit(q);
        if (k === 2) { pp.hold = teacup(q); }
      } else if (t < T_RUN + g.d) { y += bob; pp.mouth = true; mark(x, y - 16); }
      else if (t < arrive) { const a = along(g.path, (t - T_RUN - g.d) / 1.1); x = a.x; y = a.y; pp.flip = a.dir < 0; pp.armsUp = true; pp.mouth = true; }
      else if (t < back0) { x = g.spot[0]; y = g.spot[1] + bob; pp.flip = false; if (t >= T_POSE && t < T_SIGH) { pp.armsUp = true; pp.mouth = true; } }
      else { const a = along(g.path, 1 - (t - back0) / 2.4); x = a.x; y = a.y + bob; pp.flip = a.dir > 0; }
      pp.room = roomAt(x, y - 6) || R_ATT;
      if (pp.room === R_EXT) pp.room = R_HALL;
      ghost(x, y, pp);
      out.push({ x, y });
    });
    return out;
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
      const u = (q % 4.5) * 5 / 4.5; TG = L; PM = MS;
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
      const u = q % 3; TG = L; PM = MS;
      const up = u > 1 && u < 2;
      rect(5, up ? 8 : 10, 3, 2, 33); put(4, up ? 9 : 11, 33);
      if (u > 1.3 && u < 2.8) { PM = ME; const yy = 9 + fl((u - 1.3) * 7); for (let j = 0; j < 2; j++) if (((7 + yy + j) & 1) === 0 || yy + j > 15) put(7, yy + j, 21); PM = MS; } // the tea runs straight through
    };
  }
  function doSpider(t, q) {
    // web building: progress from 0 (t = 33) to 1 (t = 18), torn by a ghost at 21.3
    const tau = ((t - 33) % D + D) % D;
    const prog = clamp(tau / 21, 0, 1);
    const torn = t >= 21.3 && t < 33;
    const cx = 216, cy = 90;
    TG = SC; pen(MR, R_HALL);
    const rays = 7;
    const ang = (k) => Math.PI * 0.5 + (k / (rays - 1)) * Math.PI * 0.55;
    let sx = cx, sy = cy;
    if (!torn) {
      const nr = Math.min(rays, fl(prog * 2.2 * rays));
      for (let k = 0; k < nr; k++) { const a = ang(k); line(cx, cy, cx + Math.cos(a) * 15, cy - Math.sin(a) * 14 + 0, 31); }
      const sp = clamp((prog - 0.45) / 0.55, 0, 1);
      const turns = fl(sp * 5);
      for (let r = 1; r <= turns; r++) {
        const rr = 3 + r * 2.2;
        for (let k = 0; k + 1 < rays; k++) { const a = ang(k), b = ang(k + 1); line(cx + Math.cos(a) * rr, cy - Math.sin(a) * rr, cx + Math.cos(b) * rr, cy - Math.sin(b) * rr, 31); }
      }
      const a = ang(Math.min(rays - 1, nr)); const rr = turns ? 3 + turns * 2.2 : 15 * ((prog * 2.2 * rays) % 1);
      sx = cx + Math.cos(a) * rr; sy = cy - Math.sin(a) * rr;
    } else {
      line(cx, cy, cx - 6, cy - 12, 31); line(cx, cy, cx - 14, cy - 3, 31); line(cx - 2, cy + 1, cx - 4, cy + 6, 31); line(cx - 10, cy - 1, cx - 12, cy + 5, 31);
    }
    if (t >= T_BELL && t < T_RUN) mark(sx, sy - 3);
    // spider: rappels to the hall when the bell rings
    let x = sx, y = sy;
    if (t >= T_RUN && t < 33) {
      const down = sstep(T_RUN, T_RUN + 2.2, t), up = sstep(T_BACK + 0.5, 32.6, t);
      const yy = lerp(cy, 176, down) * (1 - up) + cy * up;
      x = 228; y = yy;
      vl(228, 79, Math.round(y) - 1, 31);
    }
    pen(MS); SLOTS.push([1, 1, 1]); const slot = SLOTS.length - 1;
    const spot = (X, Y, c) => { X = Math.round(X); Y = Math.round(Y); if (X < 0 || Y < 0 || X >= AW || Y >= AH) return; const j = Y * AW + X; SC.c[j] = c + 1; SC.m[j] = MS; SL[j] = slot; };
    const lg = fl(q * 8) & 1;
    spot(x, y, 0); spot(x + 1, y, 0); spot(x, y + 1, 0); spot(x + 1, y + 1, 0);
    for (const s of [-1, 1]) { spot(x + (s > 0 ? 2 : -1), y - lg, 0); spot(x + (s > 0 ? 3 : -2), y + 1 - lg, 0); spot(x + (s > 0 ? 2 : -1), y + 2, 0); }
    spot(x, y, 16);
  }

  /* ---------------------------------------------------------------- props that live */
  function liveProps(t, q, fi) {
    TG = SC;
    // flames
    const flame = (x, y, room, big) => {
      pen(ME, room);
      const f = ih(fl(t * 12), x * 7 + y, 5);
      put(x, y, 23); put(x, y - 1, f < 0.5 ? 24 : 23); if (big || f > 0.7) put(x, y - 2, 22);
      if (f < 0.25) put(x + 1, y - 1, 22);
    };
    flame(85, 103, R_VAMP); flame(82, 101, R_VAMP); flame(88, 101, R_VAMP);
    flame(128, 62, R_ATT, true); pen(MR, R_ATT); rect(127, 62, 2, 1, 33);
    // chandelier
    pen(MR, R_BALL);
    hl(122, 140, 199, 21); hl(124, 138, 200, 20); for (const x of [122, 127, 131, 135, 140]) { vl(x, 196, 198, 33); flame(x, 195, R_BALL); }
    vl(131, 200, 203, 21); put(131, 204, 22);
    // gas sconces (green-blue flames)
    const gas = (x, y, room) => { pen(ME, room); const f = ih(fl(t * 8), x, 6); put(x, y, 29); put(x, y - 1, f < 0.5 ? 28 : 29); put(x + (f < 0.3 ? 1 : 0), y - 2, 28); };
    gas(136, 94, R_BATH); gas(196, 98, R_HALL); gas(184, 204, R_HALL);
    // vanity bulbs
    pen(ME, R_WOLF); for (let k = 0; k < 5; k++) { put(18 + k * 4, 145, 23); put(18 + k * 4, 165, 23); } for (let k = 0; k < 4; k++) { put(16, 148 + k * 4, 23); put(35, 148 + k * 4, 23); }
    // tesla lamp glow
    pen(ME, R_FRANK); const tg = ih(fl(t * 10), 1, 7); ell(162, 157, 2.5, 2, tg < 0.5 ? 29 : 28); if (tg > 0.6) { line(162, 155, 159 + fl(tg * 6), 150, 29); }
    // kitchen fire and the cauldron
    pen(ME, R_KIT);
    for (let k = 0; k < 6; k++) { const x = 26 + k * 2, f = ih(fl(t * 12), k, 8), h = 2 + fl(f * 4); for (let j = 0; j < h; j++) put(x, 243 - j, j > 2 ? 23 : j > 0 ? 22 : 37); }
    // brew surface and bubbles (and the overflow)
    pen(ME, R_KIT); hl(24, 42, 229, 28); hl(25, 41, 230, 27);
    const over = 0.5 + 0.5 * Math.sin(q * TAU / 6);
    for (let k = 0; k < 4; k++) { const dx = [24, 29, 38, 42][k]; const len = Math.round(over * (3 + k)); for (let j = 0; j < len; j++) put(dx, 231 + j, j === len - 1 ? 29 : 28); }
    if (over > 0.7) { hl(20, 24, 245, 28); hl(41, 46, 245, 28); }
    const BUB = [];
    for (let k = 0; k < 6; k++) {
      const period = [1.5, 1.8, 2, 2.25, 1.2, 2.4][k], u = ((q + k * 0.7) % period) / period;
      const bx = 26 + ((k * 5) % 16) + Math.round(Math.sin(u * 7 + k) * 1.5), by = 228 - u * 26;
      const r = 1 + (k % 3 === 0 ? 1 : 0);
      if (u > 0.92) { put(bx - 1, by, 29); put(bx + 1, by, 29); put(bx, by - 1, 29); continue; } // pop
      if (r > 1) { put(bx, by, 29); put(bx + 1, by, 28); put(bx, by + 1, 28); put(bx + 1, by + 1, 28); } else put(bx, by, 29);
      BUB.push([bx, by]);
    }
    { const wf = where('frank', t); if (wf.mode === 'home' || wf.mode === 'freeze') { pen(MR, R_FRANK); rect(102, 163, 18, 3, 2); hl(102, 119, 163, 3); line(110, 163, 113, 165, 32); put(115, 164, 22); put(117, 164, 22); rect(119, 163, 3, 3, 3); } }
    // the vampire's mirror: no reflection, except the comb
    pen(ME, R_VAMP);
    for (let y = 97; y < 127; y++) for (let x = 65; x < 79; x++) {
      let c = 14; const u = (79 - x) % 8, v = (y - 97) % 10; if ((u === 4 && (v === 2 || v === 6)) || ((u === 3 || u === 5) && v === 4)) c = 15;
      if (y > 115) c = 13;
      if (x + (y - 97) * 0.6 > 70 && x + (y - 97) * 0.6 < 72) c = LITE[c];
      put(x, y, c);
    }
    put(66, 103, 22); put(66, 102, 23);
    { const wv = where('vamp', t); const u = q % 6; COMB = wv.mode === 'home' && u >= 3.8 && u < 5.6 ? [58 + ((fl(q * 6) & 1) ? 1 : 0), F3Y - 25] : null; }
    if (COMB) { const mx = 2 * 66 - COMB[0], my = COMB[1]; hl(mx - 1, mx + 2, my, 32); put(mx - 1, my + 1, 32); put(mx + 1, my + 1, 32); }
    // grandfather clock pendulum and face
    pen(MR, R_HALL); const sw = Math.round(Math.sin(t * Math.PI) * 1.6);
    vl(185, 224, 234, 31); vl(185 + sw, 233, 236, 22); put(185 + sw, 237, 23);
    pen(ME, R_HALL); ell(185.5, 217.5, 2.6, 2.6, 33); put(185, 215, 0); put(185, 216, 0); put(185, 217, 0); put(186, 217, 0);
    // furnace grate glow
    pen(ME, R_CEL); for (let x = 127; x < 137; x += 2) for (let y = 278; y < 283; y++) put(x + 1, y, ih(fl(t * 10), x + y, 11) < 0.5 ? 37 : 22);
    // porch lantern
    pen(ME, R_PORCH); const pf = ih(fl(t * 10), 2, 12); rect(238, 213, 3, 4, pf < 0.5 ? 22 : 23); put(239, 214, 24);
    // portraits' eyes follow the action
    for (const P of PORTRAITS) {
      let fx = FOCUS[P.room] !== undefined ? FOCUS[P.room] : P.x;
      const dx = clamp(Math.round((fx - P.x) / 18), -1, 1);
      pen(ME, P.room); put(P.x + dx, P.y, 0); put(P.x + 3 + dx, P.y, 0);
    }
    // attic window, chimney smoke, bats
    pen(ME, R_EXT);
    for (let k = 0; k < 4; k++) { const u = ((t / 6 + k / 4) % 1); const sx = 191 + Math.round(Math.sin(u * 5 + k) * 3 + u * 10), sy = 14 - u * 14; if (sy >= 0) { put(sx, sy, 5); put(sx + 1, sy, 4); if (u < 0.5) put(sx, sy - 1, 4); } }
    for (let k = 0; k < 3; k++) {
      const a = t * TAU / 12 * (k === 1 ? -1 : 1) + k * 2.1;
      const bx = 238 + Math.cos(a) * (24 + k * 8), by = 34 + Math.sin(a) * (12 + k * 4);
      const f = (fl(t * 10) + k) % 3;
      const B = [['o.....o', 'oo.o.oo', '.ooooo.', '..o.o..'], ['.......', 'ooooooo', '.oo.oo.', '..o.o..'], ['...o...', '..ooo..', '.ooooo.', 'o.o.o.o']][f];
      spr(B, { o: 0 }, Math.round(bx) - 3, Math.round(by) - 2);
    }
    return BUB;
  }
  function liveFX(t, q, fi) {
    TG = SC;
    // Frankenstein's iron: steam and an arc of lightning
    if (IRON) {
      const [ix, iy, qq] = IRON; pen(ME, R_FRANK);
      for (let k = 0; k < 3; k++) { const u = ((qq * 1.5 + k / 3) % 1); const sx = ix + Math.round(Math.sin(u * 9 + k) * 1.5), sy = iy - 2 - u * 12; if (u < 0.85) { put(sx, sy, 7); if (k === 1) put(sx + 1, sy, 6); } }
      const zz = (qq % 4) > 2.0 && (qq % 4) < 2.3;
      if (zz) {
        let ax = ix + 2, ay = iy - 1; const bx = 128, by = F2Y - 26;
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
    ell(108, 239, 5.5, 5.5, 33); ell(108, 239, 4.5, 4.5, 16, (x, y, u, v) => (u < -0.5 ? 15 : 16));
    put(107, 237, 33); put(109, 237, 33); put(108, 238, 33); put(107, 239, 33); put(108, 239, 33); put(109, 239, 33); put(108, 241, 33);
    rect(103, 244, 2, 2, 31); rect(111, 244, 2, 2, 31);
    rect(112, 233, 6, 3, 31); hl(112, 117, 233, 33); vl(114, 236, 245, 30);
    vl(118, 228, 245, 30); hl(115 - (hit ? 0 : 1), 121 + (hit ? 0 : 1), 228 + (hit ? 1 : 0), 22); put(118, 227, 22);
    // upright bass
    ell(143, 238, 4, 6.5, 20, (x, y, u) => (u < -0.4 ? 19 : 20)); hl(140, 146, 233, 20); put(141, 238, 18); put(145, 238, 18);
    vl(143, 216, 232, 18); put(142, 215, 18); put(143, 214, 18); put(144, 216, 18); vl(143, 233, 242, 32);
    vl(143, 244, 245, 31);
    // vintage microphone on a stand
    vl(153, 228, 245, 31); hl(150, 156, 245, 31); rect(152, 224, 3, 4, 30); hl(152, 154, 225, 32); put(153, 223, 31);
  }
  const FOCUS = {};

  /* ---------------------------------------------------------------- the front door, bell, kid */
  function doDoor(t) {
    TG = SC;
    const open = t < T_OPEN ? 0 : t < T_OPEN + 0.5 ? io((t - T_OPEN) / 0.5) : t < T_LEAVE + 0.6 ? 1 : t < T_LEAVE + 1.0 ? 1 - io((t - T_LEAVE - 0.6) / 0.4) : 0;
    if (open < 0.02) { pen(MR, R_STR); for (let y = F1Y - 32; y < F1Y; y++) for (let k = 0; k < 4; k++) put(DOORX + k, y, k === 0 ? 21 : 20); put(DOORX, F1Y - 16, 22); put(DOORX, F1Y - 15, 22); }
    else {
      // the open door hangs behind the cast, seen face-on
      pen(MR, R_HALL); const w = Math.round(14 * Math.sin(open * Math.PI / 2));
      for (let y = F1Y - 31; y < F1Y; y++) for (let x = DOORX - w; x < DOORX; x++) put(x, y, (x === DOORX - w) ? 21 : ((y - F1Y + 31) % 15 < 2 || x === DOORX - w + 2) ? 19 : 20);
      if (w > 4) put(DOORX - w + 2, F1Y - 15, 22);
    }
    return open;
  }
  function doBell(t) {
    TG = SC; pen(MR, R_HALL);
    const ring = t >= T_BELL && t < T_RUN;
    const sw = ring ? ((fl(t * 20) & 1) ? 1 : -1) : 0;
    rect(223 + sw, 224, 4, 3, 22); hl(222 + sw, 227 + sw, 227, 21); put(224 + sw, 223, 21); put(225 + sw, 223, 21); put(224 + sw * 2, 228, 18);
    if (ring) {
      pen(ME, R_HALL);
      const w = fl(t * 10) % 3;
      for (let k = 0; k <= w; k++) { put(220 - k * 2, 224 - k, 23); put(220 - k * 2, 227 + k, 23); put(229 + k * 2, 224 - k, 23); }
      const jx = (fl(t * 15) & 1), jy = (fl(t * 13) & 1);
      TG = SC; pen(ME, R_EXT);
      textO('DING', 237 + jx, 150 + jy, 23, 0, 2);
      if (t >= T_BELL + 0.4) textO('DONG', 237 - jx, 164 + jy, 22, 0, 2);
      // ripples from the bell button
      const r = 2 + (fl(t * 10) % 3) * 2;
      for (let a = -1.2; a <= 1.2; a += 0.3) put(236 + Math.cos(a + Math.PI) * -r, 231 + Math.sin(a) * r, 23);
    }
  }
  function doKid(t) {
    let x = null, y = F1Y, p = { walk: -1 };
    if (t >= 16 && t < 19.4) { const u = (t - 16) / 3.4; x = lerp(282, 247, u); y = x > 258 ? 252 : F1Y; p.walk = fl(t * 7); p.flip = true; }
    else if (t >= 19.4 && t < T_LEAVE) {
      x = 246; p.flip = true;
      if (t >= 19.6 && t < 20.1) p.press = true;
      if (t >= 25.0 && t < T_LEAVE) p.bagOut = true;
      if (t >= T_CANDY + 0.3 && t < T_CANDY + 0.55) { TG = SC; pen(ME, R_PORCH); put(lerp(224, 236, (t - T_CANDY - 0.3) / 0.25), 222 + (t - T_CANDY - 0.3) * 30, 17); }
    } else if (t >= T_LEAVE && t < 31.5) { const u = (t - T_LEAVE) / 2.9; x = lerp(247, 290, u); y = x > 258 ? 252 : F1Y; p.walk = fl(t * 7); }
    if (x === null) return null;
    kid(Math.round(x), y, p);
    if (t >= T_COOL && t < T_SIGH) bubble(229, 168, ['COOL', 'COSTUMES.'], 247);
    return { x, y };
  }

  /* ---------------------------------------------------------------- per frame */
  function drawLive(t, fi) {
    const q = st10(t);
    poolI = 0; MARKS.length = 0; COMB = null; SIGH = null; AIR = null; IRON = null; JAW = null; POUR = null;
    for (const k in FOCUS) delete FOCUS[k];
    FOCUS[R_VAMP] = 56; FOCUS[R_BALL] = 140; FOCUS[R_HALL] = t >= T_BELL && t < T_BACK + 2 ? 240 : 200;
    // background things first
    liveProps(t, q, fi);
    doDoor(t);
    drawTrail(t);
    // the cast (pass 1: those who stay in their rooms are drawn by depth order of the floors)
    // back row first: those on the stairs, then the front row; the werewolf crouches in front of the cape
    doMummy(t, q);
    doSkel('drum', t, q); doSkel('bass', t, q); doSkel('sing', t, q);
    doFrank(t, q); doZombie(t, q); doVamp(t, q); doWolf(t, q);
    doWitch(t, q);
    frontProps(t, q);
    // kitchen cat batting the bubbles (rides along on the broom when the bell rings)
    {
      const w = where('witch', t);
      if (w.mode === 'home' || w.mode === 'freeze') {
        const swat = (fl(q * 10) % 14) < 3 && w.mode === 'home';
        cat(44, 208, swat ? CAT_SWAT : CAT_SIT, true, { room: R_KIT });
        if (w.mode === 'freeze') mark(43, 196);
      } else {
        const f = w.dir < 0 || w.mode === 'back';
        cat(Math.round(w.x + (f ? 6 : -6)), Math.round(w.y - 6), CAT_SIT, !f, {});
      }
    }
    doGhosts(t, q);
    doSpider(t, q);
    doBell(t);
    doKid(t);
    liveFX(t, q, fi);
    drawMarks(t);
    // a lightning flash outside when they all strike their poses
    FLASH = 0;
    if (t >= T_POSE && t < T_POSE + 0.12) FLASH = 0.9; else if (t >= T_POSE + 0.22 && t < T_POSE + 0.28) FLASH = 0.5;
    if (FLASH > 0) { TG = SC; pen(ME, R_EXT); let x = 258, y = 120; for (let s = 0; s < 9; s++) { const nx = x + (s & 1 ? 4 : -3), ny = y + 10; line(x, y, nx, ny, 8); x = nx; y = ny; } }
  }
  let FLASH = 0;
  function cameraAt(t) {
    if (t >= T_OPEN && t < T_BACK) return { x: 180, y: 150, z: 3 };
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
    return [r, g, bb];
  }
  function lightPass(flash) {
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
      const i = y * AW + x, m = SC.m[i], col = SC.c[i] ? SC.c[i] - 1 : 0;
      if (m === ME) { OUT[i] = flash > 0 ? LITE[col] : col; continue; }
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
    // live lights
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
    medium: 'Pixel art in 40 colours, 270 × 338, animated in JavaScript · 36 s loop',
    note: 'Somebody is at the door · tap to pause',
    about: 'A haunted house on Halloween, run like backstage at a theatre: every monster at a tiny routine in its own lamplit room, until the doorbell rings and the whole cast scrambles down the stairs to give one small trick-or-treater the scare of a lifetime. Drawn pixel by pixel in code on a 270 × 338 grid, each room lit by its own lamp.',
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
      let K = 4;
      function layout() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        let left = 0, top = 0, cssW, cssH;
        if (EXPORT) { cssW = 1080; cssH = 1350; cv.style.position = 'fixed'; K = Math.max(1, Math.round(4 * dpr)); cv.width = AW * K; cv.height = Math.round(1350 * dpr); }
        else {
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          const fit = Math.min(w * dpr / AW, h * dpr / AH) * 0.97;
          let k = Math.max(1, Math.floor(fit));
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
