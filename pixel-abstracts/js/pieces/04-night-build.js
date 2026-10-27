/* Night Build — piece 4 of Small Infinities.
 *
 * A 19.2-second seamless loop. A floating isometric island builds a small city block by block, lives
 * one night, and dissolves back into the empty island as sparks. Every frame is a pure function of t.
 *
 * The world is a set of boxes, spheres and cylinders on a 54 × 54 unit island. One world unit is a
 * 4 × 2 pixel diamond on screen, so every edge is a pixel-true 2:1 line. Each art pixel casts a ray
 * along the view direction (1,1,1) and keeps the nearest hit (exact per-pixel depth order, so stacked,
 * bridged and falling blocks always overlap correctly). Hits are lit with a five-key day → night ramp
 * (each surface swatch snapped to a 41-colour palette per key, Bayer-crossfaded between keys), sun
 * shadows are traced along the sun axis, the canal traces a mirrored ray for its reflections, and the
 * 270 × 338 buffer is scaled up 4× nearest-neighbour.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 270, H = 338, NP = W * H, D = 19.2;
  const TAU = Math.PI * 2;
  const fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const eob = (u) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
  const eio = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
  const q2 = (v) => Math.round(v * 2) / 2; // snap world offsets to whole pixels
  let SEED = 7;
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(((c | 0) + SEED * 7919) | 0, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bay = (x, y) => BAY[((y & 3) << 2) | (x & 3)];

  /* ================================================================ palette (41) */
  const PAL_HEX = [
    '080b1e', '111839', '1c2551', '2b386a', '434c82', '655f93', '8f749c', 'bc8b9d', 'e2a394', 'f4c5a2', // 0-9 void: night → dusk
    'f7e3c6', 'e8ede3', 'bed8de', '98c0d4',                                                             // 10-13 void: day
    'fbf7ee', 'e6dccc', 'c4b9b1', '9a95a6', '6d6c88', '484a69',                                         // 14-19 white / slate
    'f2bca5', 'd9917c', 'ac6866', '7a4a5d',                                                             // 20-23 rose
    'add5c9', '7faeaa', '58848c', '3c5d6e',                                                             // 24-27 teal
    'c2d991', '8fbb70', '5f9464', '3d6b58', '284b48',                                                   // 28-32 green
    'd4a26d', 'ab6a4b', '78453f', '4b2d35',                                                             // 33-36 earth
    'fff3cc', 'ffc56a', 'a2e6ff', 'ff6356',                                                             // 37-40 light
  ];
  const PAL = PAL_HEX.map((h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
  const C_WHITE = 37, C_AMBER = 38, C_COOL = 39, C_RED = 40;
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
  const lut = (r, g, b) => {
    r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
    return LUT[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)];
  };

  /* ================================================================ light keys */
  // 0 day, 1 golden, 2 dusk, 3 blue hour, 4 night
  const hx = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  const KEYS = [
    { amb: [0.60, 0.64, 0.72], sun: [0.44, 0.40, 0.31], e: 1.05, top: hx('9cc2d6'), bot: hx('f6e6cc'), glow: hx('fbf2e2') },
    { amb: [0.53, 0.49, 0.61], sun: [0.62, 0.44, 0.25], e: 0.55, top: hx('a7b3cf'), bot: hx('f6c79c'), glow: hx('fbd9b0') },
    { amb: [0.45, 0.37, 0.55], sun: [0.40, 0.19, 0.13], e: 0.32, top: hx('51508a'), bot: hx('e6988a'), glow: hx('f0b49a') },
    { amb: [0.27, 0.29, 0.48], sun: [0.00, 0.00, 0.00], e: 0.25, top: hx('1d2554'), bot: hx('645c92'), glow: hx('7a6aa0') },
    { amb: [0.16, 0.18, 0.35], sun: [0.00, 0.00, 0.00], e: 0.25, top: hx('070a1c'), bot: hx('1a2352'), glow: hx('2a3468') },
  ];
  // light level factors: [amb, sun]; 0 underside, 1 right face, 2 left in shadow, 3 left lit, 4 top in shadow, 5 top lit
  const LV = [[0.50, 0.00], [0.64, 0.10], [0.86, 0.00], [0.86, 0.62], [1.00, 0.00], [1.00, 1.00]];

  /* ================================================================ materials */
  const MAT_HEX = [];
  const mat = (h) => { MAT_HEX.push(h); return MAT_HEX.length - 1; };
  const M_GRASS = mat('a9cb8a'), M_GRASSD = mat('84b06c'), M_STONE = mat('ebe2d2'), M_CREAM = mat('f8f3e8');
  const M_ROSE = mat('eca690'), M_TEAL = mat('93c3b9'), M_SLATE = mat('b1b4ca'), M_GLASS = mat('97b2c8');
  const M_LEAF = mat('8cbb6e'), M_LEAF2 = mat('6aa46c'), M_TRUNK = mat('9a6a4c'), M_EARTH1 = mat('d6a46e');
  const M_EARTH2 = mat('b47252'), M_EARTH3 = mat('8a5444'), M_SOIL = mat('6c4038'), M_ROOF = mat('dc8c72');
  const M_METAL = mat('cfc8c4'), M_TRAIN = mat('f6f0e6'), M_WATER = mat('6aaac6'), M_BED = mat('c9c0b2');
  const NM = MAT_HEX.length;
  const SW = new Uint8Array(NM * 6 * 5); // [mat][lvl][key]
  function buildSwatches() {
    for (let m = 0; m < NM; m++) {
      const a = hx(MAT_HEX[m]);
      for (let l = 0; l < 6; l++) for (let k = 0; k < 5; k++) {
        const K = KEYS[k], f = LV[l];
        const r = a[0] * (K.amb[0] * f[0] + K.sun[0] * f[1]);
        const g = a[1] * (K.amb[1] * f[0] + K.sun[1] * f[1]);
        const b = a[2] * (K.amb[2] * f[0] + K.sun[2] * f[1]);
        SW[(m * 6 + l) * 5 + k] = nearest(Math.min(255, r), Math.min(255, g), Math.min(255, b));
      }
    }
  }
  const SWA = new Uint8Array(NM * 6), SWB = new Uint8Array(NM * 6);

  /* ================================================================ timeline */
  const T_DIS = 14.0, T_DSPAN = 2.5, T_DEND = T_DIS + T_DSPAN + 0.85;
  const T_WIN0 = 9.5, T_WIN1 = 12.2;
  const T_TRAIN0 = 10.5, T_TRAIN1 = 13.5;
  // light phase p(t) in [0,4] through the five keys
  const PKEY = [[0, 0], [6.4, 0], [8.0, 1], [9.4, 2], [10.6, 3], [11.7, 4], [15.0, 4], [16.2, 3], [17.2, 2], [18.8, 0], [D, 0]];
  function phaseAt(t) {
    for (let i = 0; i < PKEY.length - 1; i++) {
      const a = PKEY[i], b = PKEY[i + 1];
      if (t >= a[0] && t < b[0]) return lerp(a[1], b[1], eio((t - a[0]) / (b[0] - a[0])));
    }
    return 0;
  }

  /* ================================================================ scene definition */
  // object kinds: 0 box, 1 sphere, 2 vertical cylinder
  const A_STATIC = 0, A_DROP = 1, A_RISE = 2, A_POP = 3, A_SLIDE = 4, A_STRIP = 5, A_WATER = 6, A_TRAIN = 7, A_BOB = 8, A_GROW = 9;
  const S_NONE = 0, S_WATER = 1, S_BEACON = 2, S_EARTH = 3;
  const W_NONE = 0, W_GRID = 1, W_PIN = 2, W_RIBBON = 3, W_TRAIN = 4, W_WIDE = 5;
  const DEFS = [];
  function obj(o) {
    const d = Object.assign({ k: 0, x1: 0, y1: 0, z1: 0, x2: 0, y2: 0, z2: 0, cx: 0, cy: 0, cz: 0, r: 0, mt: M_STONE, ml: M_STONE, mr: M_STONE,
      win: W_NONE, an: A_STATIC, t0: 0, du: 0.3, hh: 0, ax: 0, dis: true, spc: S_NONE, car: 0, ph: 0 }, o);
    d.id = DEFS.length + 1;
    DEFS.push(d);
    return d;
  }
  const box = (x1, y1, z1, x2, y2, z2, mt, ml, mr, o) => obj(Object.assign({ k: 0, x1, y1, z1, x2, y2, z2, mt, ml, mr }, o || {}));
  const sph = (cx, cy, cz, r, m, o) => obj(Object.assign({ k: 1, cx, cy, cz, r, mt: m, ml: m, mr: m }, o || {}));
  const cyl = (cx, cy, r, z1, z2, mt, ml, o) => obj(Object.assign({ k: 2, cx, cy, r, z1, z2, mt, ml, mr: ml }, o || {}));

  function tower(s) {
    let z = s.z0 || 1, k = 0;
    for (const sg of s.segs) {
      const ins = sg.ins || 0;
      for (let f = 0; f < sg.n; f++, k++) {
        box(s.x1 + ins, s.y1 + ins, z, s.x2 - ins, s.y2 - ins, z + 4, s.roof, s.mat, s.mat,
          { win: sg.win !== undefined ? sg.win : s.win, an: A_DROP, t0: s.t0 + k * s.dt, du: 0.22, hh: 7 });
        z += 4;
      }
    }
    return z;
  }
  function tree(x, y, z, r, t0, m) {
    box(x - 0.25, y - 0.25, z, x + 0.25, y + 0.25, z + r * 0.9 + 0.6, M_TRUNK, M_TRUNK, M_TRUNK, { an: A_POP, t0, du: 0.35 });
    sph(x, y, z + r * 0.9 + 0.6 + r * 0.75, r, m || M_LEAF, { an: A_POP, t0: t0 + 0.06, du: 0.45 });
  }
  function tank(x, y, z, t0) {
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
      box(x + dx * 1.1 - 0.25, y + dy * 1.1 - 0.25, z, x + dx * 1.1 + 0.25, y + dy * 1.1 + 0.25, z + 1.5, M_METAL, M_METAL, M_METAL, { an: A_GROW, t0, du: 0.25 });
    cyl(x, y, 1.7, z + 1.5, z + 4.5, M_ROOF, M_TRUNK, { an: A_DROP, t0: t0 + 0.2, du: 0.25, hh: 6 });
    cyl(x, y, 0.9, z + 4.5, z + 5.5, M_ROOF, M_ROOF, { an: A_DROP, t0: t0 + 0.32, du: 0.22, hh: 5 });
  }

  function buildScene() {
    DEFS.length = 0;
    /* --- island: three ground slabs, the canal bed, its ends, and a stepped earth cone underneath */
    const st = { dis: false };
    box(0, 0, -3, 54, 23, 0, M_GRASS, M_STONE, M_EARTH1, Object.assign({ spc: S_EARTH }, st));
    box(0, 31, -3, 54, 54, 0, M_GRASS, M_EARTH1, M_EARTH1, Object.assign({ spc: S_EARTH }, st));
    box(0, 23, -3, 4, 31, 0, M_GRASS, M_EARTH1, M_STONE, Object.assign({ spc: S_EARTH }, st));
    box(50, 23, -3, 54, 31, 0, M_GRASS, M_EARTH1, M_EARTH1, Object.assign({ spc: S_EARTH }, st));
    box(4, 23, -3, 50, 31, 0, M_GRASS, M_STONE, M_STONE, { dis: false, an: A_STRIP });
    const L = [[1.5, 2, 1, 1.5, -3, -7.5], [4, 4.5, 3.5, 3, -7.5, -11.5], [7, 6.5, 6, 6.5, -11.5, -16], [10, 10, 9.5, 9, -16, -20.5],
      [13.5, 12.5, 12.5, 12, -20.5, -24.5], [16, 16, 15.5, 15.5, -24.5, -29], [19, 19.5, 18.5, 19, -29, -33], [21.5, 22, 21.5, 21.5, -33, -37],
      [24, 24.5, 24, 24, -37, -40.5]];
    for (const [a, b, c, d, zt, zb] of L) box(a, b, zb, 54 - c, 54 - d, zt, M_EARTH1, M_EARTH1, M_EARTH1, { spc: S_EARTH, dis: false });
    // floating pebbles
    box(-8, 38, -16, -5, 41, -13.5, M_GRASS, M_EARTH1, M_EARTH1, { spc: S_EARTH, dis: false, an: A_BOB, ph: 0.1 });
    box(62, 16, -21, 64, 18, -19, M_GRASS, M_EARTH1, M_EARTH1, { spc: S_EARTH, dis: false, an: A_BOB, ph: 0.55 });
    box(60, 60, -40, 61.5, 61.5, -38.5, M_EARTH1, M_EARTH1, M_EARTH1, { spc: S_EARTH, dis: false, an: A_BOB, ph: 0.3 });

    /* --- water and plinths */
    box(4, 23, -2.5, 50, 31, -1, M_WATER, M_WATER, M_WATER, { spc: S_WATER, an: A_WATER });
    const plinth = (x1, y1, x2, y2, t0) => box(x1, y1, 0, x2, y2, 1, M_STONE, M_STONE, M_STONE, { an: A_RISE, t0, du: 0.45 });
    plinth(3, 3, 19, 21, 0.55); plinth(20, 7, 33, 22, 0.63); plinth(34, 2, 51, 21, 0.71);
    plinth(3, 35, 12, 44, 0.79); plinth(13, 37, 25, 46, 0.86); plinth(26, 32, 37, 42, 0.93); plinth(39, 36, 50, 46, 1.0);
    plinth(15, 47, 25, 52, 1.07);

    /* --- towers, floor by floor */
    tower({ x1: 22, y1: 9, x2: 31, y2: 20, mat: M_CREAM, roof: M_STONE, win: W_PIN, t0: 1.25, dt: 0.105,
      segs: [{ n: 11 }, { n: 4, ins: 1 }, { n: 2, ins: 2.5, win: W_GRID }] });                      // T2, the tall one → z 69
    tower({ x1: 5, y1: 5, x2: 12, y2: 12, mat: M_ROSE, roof: M_ROOF, win: W_GRID, t0: 1.45, dt: 0.11, segs: [{ n: 8 }] }); // T1 → 33
    tower({ x1: 36, y1: 4, x2: 44, y2: 12, mat: M_TEAL, roof: M_TEAL, win: W_RIBBON, t0: 1.7, dt: 0.11, segs: [{ n: 7 }] }); // T3 → 29
    tower({ x1: 6, y1: 14, x2: 17, y2: 20, mat: M_SLATE, roof: M_GRASS, win: W_WIDE, t0: 2.15, dt: 0.12, segs: [{ n: 4 }] }); // T5 → 17
    tower({ x1: 46, y1: 12, x2: 51, y2: 19, mat: M_ROSE, roof: M_ROOF, win: W_GRID, t0: 2.4, dt: 0.12, segs: [{ n: 5 }] });  // T4 → 21
    tower({ x1: 35, y1: 14, x2: 44, y2: 20, mat: M_CREAM, roof: M_GRASS, win: W_GRID, t0: 2.95, dt: 0.13, segs: [{ n: 2 }] }); // L1 → 9
    tower({ x1: 4, y1: 36, x2: 11, y2: 43, mat: M_TEAL, roof: M_TEAL, win: W_GRID, t0: 2.6, dt: 0.11, segs: [{ n: 6 }] });  // F1 → 25
    tower({ x1: 27, y1: 33, x2: 35, y2: 41, mat: M_SLATE, roof: M_STONE, win: W_RIBBON, t0: 3.2, dt: 0.12, segs: [{ n: 5 }] }); // F3 station → 21
    tower({ x1: 14, y1: 38, x2: 23, y2: 45, mat: M_ROSE, roof: M_GRASS, win: W_WIDE, t0: 3.5, dt: 0.13, segs: [{ n: 2 }] }); // F2 → 9
    tower({ x1: 40, y1: 37, x2: 49, y2: 45, mat: M_CREAM, roof: M_ROOF, win: W_GRID, t0: 3.75, dt: 0.13, segs: [{ n: 3 }] }); // F4 → 13
    tower({ x1: 16, y1: 48, x2: 24, y2: 51, mat: M_TEAL, roof: M_TEAL, win: W_WIDE, t0: 4.05, dt: 0.13, segs: [{ n: 1 }] }); // F5 → 5

    /* --- crowns, stepped roofs, antenna, tanks */
    box(6, 6, 33, 11, 11, 35, M_ROOF, M_ROSE, M_ROSE, { an: A_DROP, t0: 4.4, du: 0.2, hh: 6 });
    box(7, 7, 35, 10, 10, 36.5, M_ROOF, M_ROSE, M_ROSE, { an: A_DROP, t0: 4.52, du: 0.2, hh: 6 });
    box(37, 5, 29, 43, 11, 31, M_TEAL, M_TEAL, M_TEAL, { an: A_DROP, t0: 4.5, du: 0.2, hh: 6 });
    box(38, 6, 31, 42, 10, 33, M_TEAL, M_TEAL, M_TEAL, { an: A_DROP, t0: 4.62, du: 0.2, hh: 6 });
    box(39, 7, 33, 41, 9, 35, M_ROOF, M_TEAL, M_TEAL, { an: A_DROP, t0: 4.74, du: 0.2, hh: 6 });
    box(26.1, 14.1, 69, 26.9, 14.9, 77, M_METAL, M_METAL, M_METAL, { an: A_GROW, t0: 4.65, du: 0.5 });
    box(25.9, 13.9, 77, 27.1, 15.1, 78, M_METAL, M_METAL, M_METAL, { spc: S_BEACON, an: A_GROW, t0: 5.1, du: 0.2 });
    box(29.5, 35, 21, 33, 38, 23.5, M_STONE, M_SLATE, M_SLATE, { an: A_DROP, t0: 4.85, du: 0.2, hh: 6 });
    tank(48.5, 15.5, 21, 5.0);
    tank(7.5, 39.5, 25, 5.25);

    /* --- bridges */
    box(31, 9.6, 21, 36, 11.4, 23, M_STONE, M_GLASS, M_GLASS, { an: A_SLIDE, ax: 0, t0: 4.9, du: 0.5, win: W_RIBBON });
    box(27.4, 20, 16.4, 30.2, 33, 17.8, M_STONE, M_STONE, M_STONE, { an: A_SLIDE, ax: 1, t0: 5.2, du: 0.6 });
    box(28, 21, 1, 29.6, 22.2, 16.4, M_STONE, M_STONE, M_STONE, { an: A_GROW, t0: 5.0, du: 0.35 });
    box(28, 31.4, 0, 29.6, 32.6, 16.4, M_STONE, M_STONE, M_STONE, { an: A_GROW, t0: 5.1, du: 0.35 });
    for (let c = 0; c < 3; c++) box(27.7, 0, 17.8, 29.9, 0, 20.2, M_TRAIN, M_ROSE, M_TRAIN, { an: A_TRAIN, car: c, win: W_TRAIN });

    /* --- gardens and trees */
    const gt = 5.35;
    sph(8.6, 16.4, 17.6, 1.1, M_LEAF, { an: A_POP, t0: gt, du: 0.4 });
    sph(11.4, 18.2, 17.5, 0.9, M_LEAF2, { an: A_POP, t0: gt + 0.07, du: 0.4 });
    sph(14.6, 16.6, 17.7, 1.2, M_LEAF, { an: A_POP, t0: gt + 0.14, du: 0.4 });
    tree(38, 16.5, 9, 1.4, gt + 0.2, M_LEAF2); tree(41.5, 18, 9, 1.1, gt + 0.28);
    sph(16.5, 40.5, 9.6, 1.1, M_LEAF, { an: A_POP, t0: gt + 0.32, du: 0.4 });
    sph(20.5, 42.6, 9.5, 0.9, M_LEAF2, { an: A_POP, t0: gt + 0.38, du: 0.4 });
    for (let i = 0; i < 4; i++) tree(5 + i * 4.6, 22.1, 0, 1.15, gt + 0.45 + i * 0.07, i & 1 ? M_LEAF2 : M_LEAF);
    for (let i = 0; i < 4; i++) tree(36 + i * 4.2, 33.4, 0, 1.15, gt + 0.6 + i * 0.07, i & 1 ? M_LEAF : M_LEAF2);
    tree(13, 33.4, 0, 1.15, gt + 0.55); tree(20, 33.4, 0, 1.15, gt + 0.58, M_LEAF2);
    const park = [[29, 46.5, 2.0], [33.5, 49.5, 1.7], [38, 47.5, 2.2], [43, 50, 1.8], [47.5, 48, 1.6], [6.5, 47.5, 1.8], [9.5, 50.8, 1.5], [52, 34, 1.4]];
    park.forEach(([x, y, r], i) => tree(x, y, 0, r, gt + 0.75 + i * 0.08, i % 3 === 1 ? M_LEAF2 : M_LEAF));
  }

  /* ================================================================ animation → live objects */
  const LIVE = [];
  let NL = 0;
  function liveObj() {
    if (NL >= LIVE.length) LIVE.push({});
    return LIVE[NL++];
  }
  function copyDef(L, d) {
    L.k = d.k; L.x1 = d.x1; L.y1 = d.y1; L.z1 = d.z1; L.x2 = d.x2; L.y2 = d.y2; L.z2 = d.z2;
    L.cx = d.cx; L.cy = d.cy; L.cz = d.cz; L.r = d.r; L.mt = d.mt; L.ml = d.ml; L.mr = d.mr;
    L.win = d.win; L.dis = d.dis; L.spc = d.spc; L.id = d.id; L.fade = 1; L.wz = d.z1;
    return L;
  }
  function dropZ(tau, d) {
    if (tau < d.du) { const u = tau / d.du; return d.hh * (1 - u * u); }
    const tb = tau - d.du;
    if (tb < 0.15) return 0.13 * d.hh * Math.sin(Math.PI * tb / 0.15);
    if (tb < 0.24) return 0.04 * d.hh * Math.sin(Math.PI * (tb - 0.15) / 0.09);
    return 0;
  }
  function buildLive(t, full) {
    NL = 0;
    for (let n = 0; n < DEFS.length; n++) {
      const d = DEFS[n];
      if (d.dis && !full && t >= T_DEND) continue;
      const tau = t - d.t0;
      if (d.an === A_STATIC) { copyDef(liveObj(), d); continue; }
      if (d.an === A_BOB) {
        const L = copyDef(liveObj(), d), dz = q2(0.9 * Math.sin(TAU * (t / (D / 2) + d.ph)));
        L.z1 += dz; L.z2 += dz; continue;
      }
      if (d.an === A_STRIP) {
        const L = copyDef(liveObj(), d);
        const u = t < 10 ? sstep(0.3, 0.75, t) : 1 - sstep(T_DEND - 0.3, T_DEND + 0.3, t);
        L.z2 = q2(-2.5 * u) || 0;
        if (u > 0.1) L.mt = M_BED;
        continue;
      }
      if (d.an === A_WATER) {
        if (t < 0.7) continue;
        const L = copyDef(liveObj(), d);
        L.x2 = q2(lerp(d.x1, d.x2, eio(clamp((t - 0.7) / 0.75, 0, 1))));
        if (L.x2 <= L.x1 + 0.4) NL--;
        continue;
      }
      if (d.an === A_TRAIN) {
        if (t < T_TRAIN0 || t > T_TRAIN1) continue;
        const head = q2(lerp(18, 54, (t - T_TRAIN0) / (T_TRAIN1 - T_TRAIN0)));
        const y2 = head - d.car * 6.6, y1 = y2 - 6;
        const c1 = Math.max(y1, 14), c2 = Math.min(y2, 40);
        if (c2 - c1 < 0.25) continue;
        const L = copyDef(liveObj(), d);
        L.y1 = c1; L.y2 = c2; L.wy = y1; L.wl = 6;
        if (d.car === 0 && c2 === y2) L.nose = 1; else L.nose = 0;
        continue;
      }
      if (!full && tau < 0) continue;
      const L = copyDef(liveObj(), d);
      if (full) continue;
      if (d.an === A_DROP) {
        const dz = q2(dropZ(tau, d));
        if (d.k === 1) L.cz += dz; else { L.z1 += dz; L.z2 += dz; L.wz = L.z1; }
        L.fade = clamp(tau / (d.du * 0.55), 0, 1);
      } else if (d.an === A_RISE) {
        const u = clamp(tau / d.du, 0, 1), dz = q2(-(d.z2 - d.z1 + 0.5) * (1 - eob(u)));
        L.z1 += dz; L.z2 += dz;
      } else if (d.an === A_POP) {
        const u = clamp(tau / d.du, 0, 1), s = eob(u);
        if (s <= 0.02) { NL--; continue; }
        if (d.k === 1) { L.r = d.r * s; L.cz = d.cz; }
        else { L.z2 = d.z1 + (d.z2 - d.z1) * s; }
      } else if (d.an === A_GROW) {
        const u = clamp(tau / d.du, 0, 1), s = eob(u);
        L.z2 = d.z1 + Math.max(0.5, q2((d.z2 - d.z1) * s));
      } else if (d.an === A_SLIDE) {
        const u = eio(clamp(tau / d.du, 0, 1));
        if (d.ax === 0) L.x2 = d.x1 + Math.max(0.5, q2((d.x2 - d.x1) * u));
        else L.y2 = d.y1 + Math.max(0.5, q2((d.y2 - d.y1) * u));
      }
    }
  }

  /* ================================================================ per-frame state */
  let T = 0, P = 0, K0 = 0, K1 = 0, KF = 0, E = 1, SUN = 0, NIGHT = 0;
  let CX = 135, CY = 158;
  const ZB = new Float32Array(NP), HID = new Int16Array(NP), HF = new Uint8Array(NP);
  const ISL = new Uint8Array(NP), OUT = new Uint8Array(NP);
  const SKYR = new Float32Array(H), SKYG = new Float32Array(H), SKYB = new Float32Array(H);
  const ROWS = []; for (let i = 0; i < 70; i++) ROWS.push([]);
  const REFL = [];
  let DISSOLVE = true;

  function tauAt(X, Y, Z, lx, ly) {
    const hz = clamp((Z + 1.5) / 76, 0, 1);
    return T_DIS + T_DSPAN * (1 - hz) + 0.55 * ih(fl(X * 1.0), fl(Y * 1.0), fl(Z * 1.0) + 7777) + 0.3 * bay(lx, ly);
  }

  /* ================================================================ raster: per-pixel nearest hit */
  function raster(t) {
    ZB.fill(-1e9); HID.fill(-1);
    const dis = DISSOLVE && t >= T_DIS;
    for (let n = 0; n < NL; n++) {
      const o = LIVE[n];
      let bx0, bx1, by0, by1;
      if (o.k === 1) {
        const rx = 2.83 * o.r + 1, ry = 2.45 * o.r + 1, csx = 2 * (o.cx - o.cy), csy = o.cx + o.cy - 2 * o.cz;
        bx0 = csx - rx; bx1 = csx + rx; by0 = csy - ry; by1 = csy + ry;
      } else {
        const x1 = o.k === 2 ? o.cx - o.r : o.x1, x2 = o.k === 2 ? o.cx + o.r : o.x2;
        const y1 = o.k === 2 ? o.cy - o.r : o.y1, y2 = o.k === 2 ? o.cy + o.r : o.y2;
        bx0 = 2 * (x1 - y2); bx1 = 2 * (x2 - y1); by0 = x1 + y1 - 2 * o.z2; by1 = x2 + y2 - 2 * o.z1;
      }
      const px0 = Math.max(0, fl(CX + bx0 - 1)), px1 = Math.min(W - 1, Math.ceil(CX + bx1 + 1));
      const py0 = Math.max(0, fl(CY + by0 - 1)), py1 = Math.min(H - 1, Math.ceil(CY + by1 + 1));
      const fade = o.fade, odis = dis && o.dis;
      for (let py = py0; py <= py1; py++) {
        const sy = py + 0.5 - CY;
        for (let px = px0; px <= px1; px++) {
          const sx = px + 0.5 - CX;
          const X0 = (sy + sx * 0.5) * 0.5, Y0 = (sy - sx * 0.5) * 0.5;
          let s, f;
          if (o.k === 0) {
            const ax = o.x2 - X0, ay = o.y2 - Y0, az = o.z2;
            let lo = o.x1 - X0; const ly = o.y1 - Y0; if (ly > lo) lo = ly; if (o.z1 > lo) lo = o.z1;
            if (ax <= ay && ax <= az) { s = ax; f = 2; } else if (ay <= az) { s = ay; f = 1; } else { s = az; f = 0; }
            if (s <= lo) continue;
          } else if (o.k === 1) {
            const a = X0 - o.cx, b = Y0 - o.cy, c = -o.cz;
            const B = a + b + c, C = a * a + b * b + c * c - o.r * o.r;
            const disc = B * B - 3 * C;
            if (disc < 0) continue;
            s = (-B + Math.sqrt(disc)) / 3; f = 4;
          } else {
            const a = X0 - o.cx, b = Y0 - o.cy;
            const ab = a + b, disc = ab * ab - 2 * (a * a + b * b - o.r * o.r);
            if (disc < 0) continue;
            const sq = Math.sqrt(disc), hi = (-ab + sq) * 0.5, lo = (-ab - sq) * 0.5;
            if (o.z2 < hi) { s = o.z2; f = 0; } else { s = hi; f = 4; }
            if (s < lo || s < o.z1) continue;
          }
          const i = py * W + px;
          if (s <= ZB[i]) continue;
          if (fade < 1 && bay(px, py) >= fade) continue;
          if (odis && t >= tauAt(X0 + s, Y0 + s, s, px, py)) continue;
          ZB[i] = s; HID[i] = n; HF[i] = f;
        }
      }
    }
  }

  /* ================================================================ shadows (sun along −X, raised by E) */
  function buildRows() {
    for (let i = 0; i < ROWS.length; i++) ROWS[i].length = 0;
    REFL.length = 0;
    for (let n = 0; n < NL; n++) {
      const o = LIVE[n];
      if (o.spc === S_WATER || o.spc === S_EARTH || !o.dis) continue;
      const y1 = o.k === 0 ? o.y1 : o.cy - o.r, y2 = o.k === 0 ? o.y2 : o.cy + o.r;
      const r0 = Math.max(0, fl(y1)), r1 = Math.min(ROWS.length - 1, fl(y2 - 1e-6));
      for (let r = r0; r <= r1; r++) ROWS[r].push(o);
      const x1 = o.k === 0 ? o.x1 : o.cx - o.r;
      if (x1 < 50 && y1 < 31) REFL.push(o);
    }
  }
  function inShadow(X, Y, Z, self) {
    const r = fl(Y);
    if (r < 0 || r >= ROWS.length) return false;
    const row = ROWS[r], e = E;
    for (let j = 0; j < row.length; j++) {
      const o = row[j];
      if (o === self) continue;
      if (o.k === 0) {
        if (Y <= o.y1 || Y >= o.y2) continue;
        let lo = X - o.x2, hi = X - o.x1;
        const zl = (o.z1 - Z) / e, zh = (o.z2 - Z) / e;
        if (zl > lo) lo = zl; if (zh < hi) hi = zh; if (lo < 1e-3) lo = 1e-3;
        if (lo < hi) return true;
      } else if (o.k === 1) {
        const a = X - o.cx, b = Y - o.cy, c = Z - o.cz;
        const A = 1 + e * e, B = -a + e * c, C = a * a + b * b + c * c - o.r * o.r;
        const disc = B * B - A * C;
        if (disc > 0 && (-B + Math.sqrt(disc)) / A > 1e-3) return true;
      } else {
        const b = Y - o.cy, w = o.r * o.r - b * b;
        if (w <= 0) continue;
        const a = X - o.cx, sq = Math.sqrt(w);
        let lo = a - sq, hi = a + sq;
        const zl = (o.z1 - Z) / e, zh = (o.z2 - Z) / e;
        if (zl > lo) lo = zl; if (zh < hi) hi = zh; if (lo < 1e-3) lo = 1e-3;
        if (lo < hi) return true;
      }
    }
    return false;
  }

  /* ================================================================ reflections: mirrored ray (−1,−1,+1) */
  let RX = 0, RY = 0, RZ = 0, RF = 0, RO = null;
  function reflectHit(X, Y, Z, t) {
    let best = 1e9; RO = null;
    const dis = DISSOLVE && t >= T_DIS;
    for (let j = 0; j < REFL.length; j++) {
      const o = REFL[j];
      let s, f;
      if (o.k === 0) {
        const lx = X - o.x2, ly = Y - o.y2, lz = o.z1 - Z;
        let hi = X - o.x1; const hy = Y - o.y1, hz = o.z2 - Z; if (hy < hi) hi = hy; if (hz < hi) hi = hz;
        if (lx >= ly && lx >= lz) { s = lx; f = 2; } else if (ly >= lz) { s = ly; f = 1; } else { s = lz; f = 3; }
        if (s >= hi || s <= 0.01) continue;
      } else if (o.k === 1) {
        const a = X - o.cx, b = Y - o.cy, c = Z - o.cz;
        const B = -a - b + c, C = a * a + b * b + c * c - o.r * o.r, disc = B * B - 3 * C;
        if (disc < 0) continue;
        s = (-B - Math.sqrt(disc)) / 3; f = 4;
        if (s <= 0.01) continue;
      } else {
        const a = X - o.cx, b = Y - o.cy, ab = a + b, disc = ab * ab - 2 * (a * a + b * b - o.r * o.r);
        if (disc < 0) continue;
        const sq = Math.sqrt(disc), lo = (ab - sq) * 0.5, hi = (ab + sq) * 0.5;
        const zl = o.z1 - Z, zh = o.z2 - Z;
        if (zl > lo) { s = zl; f = 3; } else { s = lo; f = 4; }
        if (s >= hi || s >= zh || s <= 0.01) continue;
      }
      if (s >= best) continue;
      if (dis && o.dis && t >= tauAt(X - s, Y - s, Z + s, fl(X * 7) & 3, fl(Y * 5) & 3)) continue;
      best = s; RO = o; RF = f;
    }
    if (RO) { RX = X - best; RY = Y - best; RZ = Z + best; }
    return RO;
  }

  /* ================================================================ windows */
  function winAt(o, face, X, Y, Z) {
    let u, fw;
    if (face === 1) { u = X - o.x1; fw = o.x2 - o.x1; } else if (face === 2) { u = o.y2 - Y; fw = o.y2 - o.y1; } else return -1;
    const v = Z - o.wz;
    switch (o.win) {
      case W_GRID: {
        if (v < 1 || v >= 3 || u < 1 || u >= fw - 1) return -1;
        const c = fl((u - 1) / 2); return (u - 1) - c * 2 < 1 ? c : -1;
      }
      case W_WIDE: {
        if (v < 1 || v >= 3 || u < 1 || u >= fw - 1) return -1;
        const c = fl((u - 1) / 3); return (u - 1) - c * 3 < 2 ? c : -1;
      }
      case W_PIN: {
        if (v < 0.5 || v >= 3.5 || u < 1 || u >= fw - 1) return -1;
        const c = fl(u - 1); return (u - 1) - c < 0.5 ? c : -1;
      }
      case W_RIBBON: {
        if (v < 1.5 || v >= 3 || u < 1 || u >= fw - 1) return -1;
        return fl((u - 1) / 2);
      }
      case W_TRAIN: {
        if (face !== 2) return -1;
        const uu = Y - o.wy;
        if (v < 0.9 || v >= 1.6 || uu < 0.5 || uu >= o.wl - 0.5) return -1;
        return 99;
      }
    }
    return -1;
  }
  function winColor(o, face, c) {
    if (o.win === W_TRAIN) return T > T_WIN0 - 0.6 ? C_WHITE : -1;
    const h = ih(o.id * 3 + face, c, 31);
    if (h < 0.17) return -1;
    const ton = T_WIN0 + (T_WIN1 - T_WIN0) * ih(o.id, face * 37 + c, 77);
    if (T < ton) return -1;
    const k = ih(c, o.id, face + 5);
    return k < 0.2 ? C_COOL : k < 0.45 ? C_WHITE : C_AMBER;
  }

  /* ================================================================ shading */
  const LSX = -0.52, LSY = 0.40, LSZ = 0.75;
  function earthMat(X, Y, Z, face) {
    if (Z > -0.9) return M_GRASSD;
    if (Z > -2.7) return M_SOIL;
    const u = face === 1 ? X : Y;
    const w = Z + 0.9 * Math.sin(u * 0.42 + Z * 0.07);
    const b = fl((-w - 2.7) / 3.4);
    if (b > 9) return M_EARTH3;
    return b % 3 === 0 ? M_EARTH1 : b % 3 === 1 ? M_EARTH2 : (b > 5 ? M_EARTH3 : M_EARTH1);
  }
  function shadeHit(o, face, X, Y, Z, px, py, refl) {
    let m, lvl;
    if (face === 0) { m = o.mt; lvl = 5; }
    else if (face === 1) { m = o.ml; lvl = 3; }
    else if (face === 2) { m = o.mr; lvl = 1; }
    else if (face === 3) { m = o.ml; lvl = 0; }
    else {
      let nx, ny, nz;
      if (o.k === 1) { nx = (X - o.cx) / o.r; ny = (Y - o.cy) / o.r; nz = (Z - o.cz) / o.r; }
      else { nx = (X - o.cx) / o.r; ny = (Y - o.cy) / o.r; nz = 0; }
      const l = nx * LSX + ny * LSY + nz * LSZ + (bay(px + 1, py + 2) - 0.5) * 0.34;
      m = o.ml;
      lvl = l > 0.5 ? 5 : l > 0.0 ? 3 : 1;
      if (o.k === 1 && nz < -0.55) lvl = lvl === 5 ? 3 : 1;
    }
    if (o.spc === S_EARTH && face !== 0) m = earthMat(X, Y, Z, face);
    else if (o.spc === S_BEACON) {
      const ph = T % 1.2;
      if (P > 1.6 && ph < 0.22) return C_RED;
    }
    if (o.win && (face === 1 || face === 2)) {
      const c = winAt(o, face, X, Y, Z);
      if (c >= 0) {
        const wc = winColor(o, face, c);
        if (wc >= 0) return wc;
        m = M_GLASS;
      }
    }
    if (!refl && SUN && (lvl === 5 || lvl === 3) && o.spc !== S_EARTH && inShadow(X, Y, Z, o.k === 0 ? null : o)) lvl -= 1;
    const k = m * 6 + lvl;
    return bay(px, py) < KF ? SWB[k] : SWA[k];
  }
  function shadeWater(X, Y, Z, px, py, t) {
    // ripple: shift the mirrored ray sideways
    const rip = Math.sin(Y * 1.7 + X * 0.35 - TAU * t / (D / 12)) + 0.6 * Math.sin(X * 0.9 - Y * 0.6 + TAU * t / (D / 8));
    const dx = 0.32 * rip;
    const base = PAL[bay(px, py) < KF ? SWB[M_WATER * 6 + 5] : SWA[M_WATER * 6 + 5]];
    let r, g, b, mix = 0.42;
    if (reflectHit(X + dx, Y - dx, Z, t)) {
      const c = shadeHit(RO, RF, RX, RY, RZ, px, py, true);
      const p = PAL[c];
      if (c >= C_WHITE) mix = 0.15;
      r = p[0]; g = p[1]; b = p[2];
    } else {
      const yy = clamp(fl(H * 0.12 + (Z - Y) * 0.6), 0, H - 1);
      r = SKYR[yy]; g = SKYG[yy]; b = SKYB[yy]; mix = 0.3;
    }
    r = r * (1 - mix) + base[0] * mix; g = g * (1 - mix) + base[1] * mix; b = b * (1 - mix) + base[2] * mix;
    if (rip > 1.25) { r += 22; g += 24; b += 26; }
    const dd = (bay(px, py) - 0.5) * 22;
    return lut(r + dd, g + dd, b + dd);
  }

  /* ================================================================ sky */
  function skyPrep() {
    const a = KEYS[K0], b = KEYS[K1], f = KF;
    const t0 = [lerp(a.top[0], b.top[0], f), lerp(a.top[1], b.top[1], f), lerp(a.top[2], b.top[2], f)];
    const b0 = [lerp(a.bot[0], b.bot[0], f), lerp(a.bot[1], b.bot[1], f), lerp(a.bot[2], b.bot[2], f)];
    for (let y = 0; y < H; y++) {
      const v = Math.pow(y / (H - 1), 1.15);
      SKYR[y] = lerp(t0[0], b0[0], v); SKYG[y] = lerp(t0[1], b0[1], v); SKYB[y] = lerp(t0[2], b0[2], v);
    }
    GLOW[0] = lerp(a.glow[0], b.glow[0], f); GLOW[1] = lerp(a.glow[1], b.glow[1], f); GLOW[2] = lerp(a.glow[2], b.glow[2], f);
  }
  const GLOW = [0, 0, 0];

  /* ================================================================ sparks */
  let SPK = null; // packed: lx, ly, tau, seed
  function buildSparks() {
    const save = DISSOLVE; DISSOLVE = false;
    T = T_DIS - 0.01; setLight(T);
    buildLive(T, false); raster(T);
    const list = [];
    for (let i = 0; i < NP; i++) {
      const n = HID[i];
      if (n < 0) continue;
      const o = LIVE[n];
      if (!o.dis) continue;
      const px = i % W, py = (i / W) | 0;
      if (ih(px, py, 4242) > 0.34) continue;
      const sx = px + 0.5 - CX, sy = py + 0.5 - CY, s = ZB[i];
      const X = (sy + sx * 0.5) * 0.5 + s, Y = (sy - sx * 0.5) * 0.5 + s;
      list.push(px, py, tauAt(X, Y, s, px, py), ih(px, py, 999));
    }
    SPK = new Float32Array(list);
    DISSOLVE = save;
  }
  function drawSparks(t) {
    if (!SPK) return;
    let tt = t;
    if (tt < 2) tt += D;
    if (tt < T_DIS) return;
    for (let j = 0; j < SPK.length; j += 4) {
      const age = tt - SPK[j + 2];
      if (age < 0) continue;
      const sd = SPK[j + 3], life = 1.0 + 0.8 * sd;
      if (age >= life) continue;
      const a = age / life;
      if (a > 0.55 && ih(SPK[j], SPK[j + 1], 13) < (a - 0.55) / 0.45) continue;
      const v = 7 + 12 * ih(SPK[j], SPK[j + 1], 21);
      const x = Math.round(SPK[j] + 2.2 * Math.sin(sd * 40 + age * 2.6) + 6 * age * age + (sd - 0.5) * 6 * age);
      const y = Math.round(SPK[j + 1] - v * age - 9 * age * age);
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const cool = sd < 0.22;
      const c = a < 0.14 ? C_WHITE : cool ? (a < 0.5 ? C_COOL : 12) : a < 0.42 ? C_AMBER : a < 0.7 ? 9 : 8;
      ISL[y * W + x] = c;
    }
  }

  /* ================================================================ frame */
  function setLight(t) {
    P = phaseAt(t);
    K0 = Math.min(4, fl(P)); K1 = Math.min(4, K0 + 1); KF = P - K0;
    const a = KEYS[K0], b = KEYS[K1];
    E = lerp(a.e, b.e, KF);
    SUN = P < 2.6 ? 1 : 0;
    NIGHT = sstep(2.4, 3.6, P);
    for (let j = 0; j < NM * 6; j++) { SWA[j] = SW[j * 5 + K0]; SWB[j] = SW[j * 5 + K1]; }
  }
  function bobAt(t) { return Math.round(2.2 * Math.sin(TAU * t / (D / 2))); }

  function drawFrame(t, g, cw, ch) {
    t = ((t % D) + D) % D;
    T = t;
    setLight(t);
    skyPrep();
    buildLive(t, false);
    raster(t);
    buildRows();
    // shade island layer
    for (let py = 0; py < H; py++) {
      const sy = py + 0.5 - CY;
      for (let px = 0; px < W; px++) {
        const i = py * W + px, n = HID[i];
        if (n < 0) { ISL[i] = 255; continue; }
        const o = LIVE[n], s = ZB[i], sx = px + 0.5 - CX;
        const X = (sy + sx * 0.5) * 0.5 + s, Y = (sy - sx * 0.5) * 0.5 + s;
        if (o.spc === S_WATER && HF[i] === 0) ISL[i] = shadeWater(X, Y, s, px, py, t);
        else ISL[i] = shadeHit(o, HF[i], X, Y, s, px, py, false);
      }
    }
    drawSparks(t);
    // compose over the void
    const dy = bobAt(t);
    const gcx = CX, gcy = CY + 40 + dy, gr2 = 1 / (150 * 150);
    const starA = sstep(2.6, 3.8, P);
    for (let y = 0; y < H; y++) {
      const ly = y - dy;
      for (let x = 0; x < W; x++) {
        const o = y * W + x;
        const c = ly >= 0 && ly < H ? ISL[ly * W + x] : 255;
        if (c !== 255) { OUT[o] = c; continue; }
        const ddx = x - gcx, ddy = (y - gcy) * 1.25;
        const gl = Math.max(0, 1 - (ddx * ddx + ddy * ddy) * gr2);
        const gw = gl * gl * 0.55;
        const dd = (bay(x, y) - 0.5) * 20;
        let r = lerp(SKYR[y], GLOW[0], gw) + dd, gg = lerp(SKYG[y], GLOW[1], gw) + dd, b = lerp(SKYB[y], GLOW[2], gw) + dd;
        let cc = lut(r, gg, b);
        if (starA > 0) {
          const hs = ih(x, y, 555);
          if (hs < 0.0045 && y < 250) {
            const tw = 0.5 + 0.5 * Math.sin(TAU * (T / (D / 6) + hs * 900));
            if (ih(x, y, 556) < starA * (0.45 + 0.55 * tw)) cc = hs < 0.0012 ? C_WHITE : hs < 0.003 ? 12 : 13;
          }
        }
        OUT[o] = cc;
      }
    }
    present(g, cw, ch);
  }

  /* ================================================================ present */
  let IMG = null, SMALL = null, SG = null;
  function present(g, cw, ch) {
    if (!SMALL) { SMALL = document.createElement('canvas'); SMALL.width = W; SMALL.height = H; SG = SMALL.getContext('2d'); IMG = SG.createImageData(W, H); }
    const d = IMG.data;
    for (let i = 0, j = 0; i < NP; i++, j += 4) { const p = PAL[OUT[i]]; d[j] = p[0]; d[j + 1] = p[1]; d[j + 2] = p[2]; d[j + 3] = 255; }
    SG.putImageData(IMG, 0, 0);
    if (!g) return;
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const k = Math.max(cw / W, ch / H);
    const dw = W * k, dh = H * k;
    g.drawImage(SMALL, Math.round((cw - dw) / 2), Math.round((ch - dh) / 2), dw, dh);
  }

  /* ================================================================ mount */
  let BUILT = false;
  function init() {
    if (BUILT) return;
    buildLUT(); buildSwatches(); buildScene(); buildSparks();
    BUILT = true;
  }

  (window.PIECES = window.PIECES || []).push({
    id: 'night-build',
    title: 'Night Build',
    medium: 'Isometric pixel art in 41 colours, 270 × 338, drawn in JavaScript · 19.2 s loop',
    note: 'A city for one night · tap to pause',
    about: 'A floating island builds itself a small city, block by block: foundations, towers rising floor by floor, bridges, rooftop gardens and trees. The light goes from day to dusk to night, the windows come on one by one, a train crosses the canal, and at dawn the whole city drifts away as sparks, back to the empty island. Every pixel is traced in code on a 270 × 338 grid.',
    tone: 'dark',
    room: '#080b1e',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0;
      el.style.background = '#080b1e';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;image-rendering:pixelated;image-rendering:crisp-edges;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(242,246,255,.8)"/><rect x="19" y="9" width="5" height="16" fill="rgba(242,246,255,.8)"/></svg>';
      el.appendChild(pauseMark);
      let CW = W * 4, CH = H * 4;
      function layout() {
        let left = 0, top = 0, cssW, cssH;
        if (EXPORT) {
          cssW = 1080; cssH = 1350; CW = 1080; CH = 1350;
          cv.style.position = 'fixed';
          cv.width = CW; cv.height = CH;
        } else {
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          const fit = Math.min(w * dpr / W, h * dpr / H) * 0.97;
          let k = Math.max(1, Math.floor(fit));
          if (k < fit * 0.86) k = fit; // small screens: fill rather than shrink to a stamp
          CW = Math.round(W * k); CH = Math.round(H * k);
          cssW = CW / dpr; cssH = CH / dpr;
          left = Math.round((w - cssW) / 2); top = Math.round((h - cssH) / 2);
          if (cv.width !== CW || cv.height !== CH) { cv.width = CW; cv.height = CH; }
        }
        cv.style.left = left + 'px'; cv.style.top = top + 'px'; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
        pauseMark.style.left = (left + cssW - 48) + 'px'; pauseMark.style.top = (top + 14) + 'px';
      }
      layout();
      SEED = 7;
      init();
      drawFrame(0, g, CW, CH);
      const hook = {
        duration: D,
        isReady: () => {
          if (!BUILT) return false;
          if (!EXPORT) return true;
          const st = el.parentElement;
          return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999;
        },
        renderAt(t) {
          return new Promise((res) => {
            playing = false; clock = t;
            const t0 = performance.now();
            drawFrame(t, g, CW, CH);
            hook.lastMs = performance.now() - t0;
            requestAnimationFrame(() => requestAnimationFrame(res));
          });
        },
        lastMs: 0,
      };
      window.__nightbuild = hook;
      if (EXPORT) document.documentElement.dataset.ready = 'night-build';
      api.ready();
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        raf = requestAnimationFrame(frame);
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
        if (!playing) return;
        clock = (clock + dt) % D;
        drawFrame(clock, g, CW, CH);
      }
      if (!EXPORT) raf = requestAnimationFrame(frame);
      const onDown = () => { if (EXPORT) return; playing = !playing; last = 0; pauseMark.style.opacity = playing ? '0' : '1'; };
      cv.addEventListener('pointerdown', onDown);
      let rt = 0;
      const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (!alive) return; layout(); drawFrame(clock, g, CW, CH); }, 120); });
      ro.observe(el);
      return {
        destroy() {
          alive = false; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(rt);
          cv.removeEventListener('pointerdown', onDown);
          if (window.__nightbuild === hook) delete window.__nightbuild;
        },
      };
    },
  });
})();
