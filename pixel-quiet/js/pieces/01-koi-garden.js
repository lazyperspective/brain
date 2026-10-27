/* Koi Garden — Quiet Hours, piece 1.
 *
 * A koi pond seen from straight above at dusk, lit by three stone lanterns. Everything is a pure function
 * of t on a 270 × 338 grid, quantised to 48 colours through an ordered (8 × 8 Bayer) dither and shown at 4×.
 * The garden (moss, mossy boulders along an organic shoreline, a pebble beach, river stones and silt on the
 * bed, lily pads, lotus, a cherry tree, ferns, irises and the lantern roofs) is painted once into albedo
 * buffers. Each frame relights it: lantern light that breathes, caustics from two layers of slowly
 * orbiting Worley cells, depth tinting that turns the deep middle dark and green, soft koi shadows offset
 * away from the nearest lantern, then six spine-based koi whose bodies follow their paths and whose tails
 * undulate, raindrop rings whose fronts travel by geodesic distance so they bend round the pads,
 * cherry petals that fall, land, drift on the current, turn and sink, glitter in the lantern pools and
 * fireflies over the rocks. D = 24 s; every motion completes a whole number of cycles in D.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 270, H = 338, NP = W * H, D = 24;
  const TAU = Math.PI * 2, fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const wrapA = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  const SEED = 7; // the garden is composed for one seed
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(((c | 0) + SEED * 7919) | 0, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function vn2(x, y, s) {
    const i = fl(x), j = fl(y), fx = x - i, fy = y - j;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = ih(i, j, s), b = ih(i + 1, j, s), c = ih(i, j + 1, s), d = ih(i + 1, j + 1, s);
    return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
  }
  function fbm2(x, y, s, o) {
    let v = 0, a = 0.5, n = 0;
    for (let k = 0; k < (o || 4); k++) { v += a * vn2(x, y, s + k * 31); n += a; x *= 2.03; y *= 2.03; a *= 0.5; }
    return v / n;
  }
  const B8 = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21].map((v) => (v + 0.5) / 64);
  const bay = (x, y) => B8[((y & 7) << 3) | (x & 7)];

  /* ================================================================ palette (48) */
  const PAL_HEX = [
    '050d10', '08171b', '0c2226', '112e30', '173b3a', '1f4a45', '295a50', '356b5b', '467e69', '5e957c', '80b096', 'b2d4bc', // water
    '3a382c', '595440', '807759',                                                 // bed stone
    '0b140e', '15241a', '203822', '2d5029', '426d33', '62913f', '97bc5f',         // moss, pads
    '1a1d20', '2f3439', '4a4f52', '6c706c', '9a9b90', '7a6a52', 'b39a74',         // rock, cool and lantern-warm
    '4e2c16', '9a5826', 'de9846', 'f6cf7e', 'fff2c8',                             // lantern
    '5a6040', '8c8650',                                                           // lantern-lit olive
    'f2ede0', 'c4c2b6', 'e2522f', 'a83221', '661c19', 'd6dfde', 'a2acae',         // koi
    'f7d8e2', 'e8a2ba', 'c26892', '7e3a5c',                                       // blossom
    'e6f59a',                                                                     // firefly
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

  /* ================================================================ buffers */
  const T_GROUND = 0, T_ROCK = 1, T_WATER = 2, T_PAD = 3, T_LOTUS = 4, T_CANOPY = 5, T_ROOF = 6;
  const DA_T = [16, 14, 14, 9, 7, 10, 10];
  const TYPE = new Uint8Array(NP);
  const ALR = new Float32Array(NP), ALG = new Float32Array(NP), ALB = new Float32Array(NP);
  const IN = new Uint8Array(NP);
  const SD = new Float32Array(NP), DEP = new Float32Array(NP), TRN = new Float32Array(NP);
  const SCR = new Float32Array(NP), SCG = new Float32Array(NP), SCB = new Float32Array(NP);
  const PSH = new Float32Array(NP);
  const ROCKH = new Float32Array(NP), ROCKID = new Int16Array(NP).fill(-1), ROCKD = new Float32Array(NP);
  const PEB = new Uint8Array(NP);
  const LK = [new Float32Array(NP), new Float32Array(NP), new Float32Array(NP)];
  const EMR = new Float32Array(NP), EMG = new Float32Array(NP), EMB = new Float32Array(NP), EMK = new Int8Array(NP).fill(-1);
  const REF = new Float32Array(NP), REFK = new Uint8Array(NP);
  const LI = new Float32Array(NP), CF = new Float32Array(NP), CG = new Float32Array(NP);
  const OR = new Float32Array(NP), OG = new Float32Array(NP), OB = new Float32Array(NP);
  const AMPF = new Uint8Array(NP), STAMP = new Int32Array(NP);
  const SHM = new Float32Array(NP), SHT = new Float32Array(NP), SHB = new Float32Array(NP);
  const OUT = new Uint8Array(NP);
  let STAMPV = 1;

  function setA(i, r, g, b) { ALR[i] = r; ALG[i] = g; ALB[i] = b; }
  function mulA(i, k) { ALR[i] *= k; ALG[i] *= k; ALB[i] *= k; }
  function mixA(i, r, g, b, a) { ALR[i] += (r - ALR[i]) * a; ALG[i] += (g - ALG[i]) * a; ALB[i] += (b - ALB[i]) * a; }

  /* ================================================================ pond geometry */
  const PCX = 136, PCY = 172, PRX = 104, PRY = 132;
  function shoreR(th) { return 1 + 0.07 * Math.cos(2 * th - 0.5) + 0.05 * Math.cos(3 * th + 1.9) + 0.028 * Math.cos(5 * th + 0.4) + 0.016 * Math.cos(7 * th + 2.2); }
  function shorePt(th) { const R = shoreR(th); return [PCX + PRX * R * Math.cos(th), PCY + PRY * R * Math.sin(th)]; }
  const inBeach = (th) => { const a = wrapA(th); return a > 1.28 && a < 1.98; };

  function chamfer(mask, val) {
    const d = new Float32Array(NP), S2 = Math.SQRT2;
    for (let i = 0; i < NP; i++) d[i] = mask[i] === val ? 1e6 : 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; let v = d[i]; if (v === 0) continue;
      if (x > 0 && d[i - 1] + 1 < v) v = d[i - 1] + 1;
      if (y > 0) {
        if (d[i - W] + 1 < v) v = d[i - W] + 1;
        if (x > 0 && d[i - W - 1] + S2 < v) v = d[i - W - 1] + S2;
        if (x < W - 1 && d[i - W + 1] + S2 < v) v = d[i - W + 1] + S2;
      }
      d[i] = v;
    }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x; let v = d[i]; if (v === 0) continue;
      if (x < W - 1 && d[i + 1] + 1 < v) v = d[i + 1] + 1;
      if (y < H - 1) {
        if (d[i + W] + 1 < v) v = d[i + W] + 1;
        if (x < W - 1 && d[i + W + 1] + S2 < v) v = d[i + W + 1] + S2;
        if (x > 0 && d[i + W - 1] + S2 < v) v = d[i + W - 1] + S2;
      }
      d[i] = v;
    }
    return d;
  }
  function blur(src, dst, rad) { // separable box blur, whole frame
    const n = 2 * rad + 1;
    for (let y = 0; y < H; y++) {
      let acc = 0; const o = y * W;
      for (let x = -rad; x <= rad; x++) acc += src[o + clamp(x, 0, W - 1)];
      for (let x = 0; x < W; x++) {
        SHT[o + x] = acc / n;
        acc += src[o + Math.min(W - 1, x + rad + 1)] - src[o + Math.max(0, x - rad)];
      }
    }
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let y = -rad; y <= rad; y++) acc += SHT[clamp(y, 0, H - 1) * W + x];
      for (let y = 0; y < H; y++) {
        dst[y * W + x] = acc / n;
        acc += SHT[Math.min(H - 1, y + rad + 1) * W + x] - SHT[Math.max(0, y - rad) * W + x];
      }
    }
  }

  // shoreline as an arc-length table, for placing rocks
  const SHN = 2400, SHX = new Float32Array(SHN + 1), SHY = new Float32Array(SHN + 1), SHS = new Float32Array(SHN + 1);
  let SHL = 0;
  function buildShore() {
    for (let k = 0; k <= SHN; k++) { const p = shorePt(k / SHN * TAU); SHX[k] = p[0]; SHY[k] = p[1]; if (k) SHS[k] = SHS[k - 1] + Math.hypot(SHX[k] - SHX[k - 1], SHY[k] - SHY[k - 1]); }
    SHL = SHS[SHN];
  }
  function shoreAt(s) {
    s = ((s % SHL) + SHL) % SHL;
    let lo = 0, hi = SHN;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (SHS[m] <= s) lo = m; else hi = m; }
    const f = (s - SHS[lo]) / (SHS[hi] - SHS[lo] || 1);
    const x = lerp(SHX[lo], SHX[hi], f), y = lerp(SHY[lo], SHY[hi], f);
    let tx = SHX[hi] - SHX[lo], ty = SHY[hi] - SHY[lo]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    let nx = ty, ny = -tx;
    if (nx * (x - PCX) + ny * (y - PCY) < 0) { nx = -nx; ny = -ny; }
    return { x, y, tx, ty, nx, ny, th: (lo + f) / SHN * TAU };
  }

  /* ================================================================ scene description */
  // stone lanterns: hexagonal kasuga roof, a round snow-viewing roof, a small square one
  const LANTERNS = [
    { x: 44, y: 288, R: 16, kind: 'hex', rot: 0.2, P: 2.2, R0: 46, win: 0.75 },
    { x: 230, y: 292, R: 14, kind: 'round', rot: 0.0, P: 1.9, R0: 42, win: 2.4 },
    { x: 228, y: 40, R: 11, kind: 'square', rot: 0.32, P: 1.5, R0: 34, win: 2.1 },
  ];
  const PADS = [
    // upper right cluster
    { x: 196, y: 84, R: 15, rot: 2.1 }, { x: 216, y: 104, R: 10.5, rot: 0.4 }, { x: 178, y: 100, R: 8.5, rot: 4.0 },
    { x: 208, y: 66, R: 8, rot: 1.0, yel: 0.6 }, { x: 222, y: 85, R: 6.5, rot: 5.2 }, { x: 186, y: 66, R: 5, rot: 3.3 },
    // left cluster
    { x: 52, y: 196, R: 13, rot: 5.6, hole: 1 }, { x: 64, y: 216, R: 9, rot: 1.9 }, { x: 44, y: 220, R: 7, rot: 3.0, yel: 0.8 },
    { x: 66, y: 180, R: 6, rot: 0.6 }, { x: 40, y: 178, R: 5, rot: 2.4 },
    // lower right cluster
    { x: 182, y: 262, R: 14, rot: 3.7 }, { x: 204, y: 246, R: 9.5, rot: 0.9 }, { x: 164, y: 280, R: 8, rot: 5.0, yel: 0.5 },
    { x: 200, y: 274, R: 7, rot: 2.2 }, { x: 160, y: 256, R: 5, rot: 1.4 },
    // strays
    { x: 112, y: 76, R: 6.5, rot: 4.6 }, { x: 94, y: 286, R: 7, rot: 0.2 },
  ];
  const LOTUS = [
    { x: 197, y: 89, s: 1.05, rot: 0.3 },
    { x: 186, y: 266, s: 0.95, rot: 1.1 },
    { x: 56, y: 200, s: 0.5, rot: 0.6, bud: 1 },
  ];
  const DROPS = [
    { x: 168, y: 118, t0: 1.6 }, { x: 80, y: 188, t0: 6.4 }, { x: 132, y: 150, t0: 11.0 },
    { x: 214, y: 232, t0: 15.4 }, { x: 108, y: 248, t0: 19.6 }, { x: 160, y: 76, t0: 22.6 },
  ];

  /* ================================================================ painting, once */
  const ROCKS = [];
  function paintPond() {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - PCX) / PRX, dy = (y + 0.5 - PCY) / PRY;
      const r = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
      const n = (fbm2(x * 0.09, y * 0.09, 11, 3) - 0.5) * 0.05;
      IN[y * W + x] = r < shoreR(th) + n ? 1 : 0;
    }
    const din = chamfer(IN, 1), dout = chamfer(IN, 0);
    for (let i = 0; i < NP; i++) SD[i] = IN[i] ? din[i] : -dout[i];
  }

  function paintGround() {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      TYPE[i] = IN[i] ? T_WATER : T_GROUND;
      if (IN[i]) continue;
      const m1 = fbm2(x * 0.06, y * 0.06, 401, 4), m2 = fbm2(x * 0.2, y * 0.2, 403, 2);
      // moss: a bumpy surface of little cushions, embossed by light from the upper left
      const hb = (u, w) => fbm2(u * 0.4, w * 0.4, 411, 2);
      const emb = (hb(x - 0.7, y - 0.9) - hb(x + 0.7, y + 0.9)) * 2.6;
      const hh = hb(x, y);
      let v = 0.48 + 0.3 * (m1 - 0.5) * 2 + 0.1 * (m2 - 0.5) + clamp(emb * 0.45, -0.12, 0.12) - (hh < 0.3 ? 0.05 : 0) + (ih(x, y, 419) - 0.5) * 0.05;
      const hue = fbm2(x * 0.035 + 9, y * 0.035, 415, 3);            // patches of yellower and bluer mosses
      let r = lerp(14, 62, v) * lerp(0.85, 1.2, hue), g = lerp(28, 98, v), b = lerp(20, 46, v) * lerp(1.15, 0.8, hue);
      // bare soil and needles in the hollows
      // the wet bank right at the water
      const sd = -SD[i];
      if (sd < 4) { const a = sstep(4, 0, sd) * 0.55; r = lerp(r, 28, a); g = lerp(g, 34, a); b = lerp(b, 28, a); }
      setA(i, r, g, b);
    }
  }

  function paintRocks() {
    buildShore();
    let s = 0, k = 0, rPrev = 6;
    while (s < SHL - 6) {
      const big = ih(k, 1, 300) < 0.14;
      const r = big ? 8.5 + ih(k, 2, 300) * 4.5 : 4 + Math.pow(ih(k, 3, 300), 1.3) * 4.6;
      s += (rPrev + r) * 0.72; rPrev = r;
      const P = shoreAt(s);
      const bz = inBeach(P.th);
      const edge = inBeach(P.th - 0.06) !== inBeach(P.th + 0.06);
      if (bz && !edge) { k++; continue; }
      const off = r * (0.08 + 0.48 * ih(k, 4, 300));
      ROCKS.push({ x: P.x + P.nx * off, y: P.y + P.ny * off, r, asp: 0.7 + 0.3 * ih(k, 5, 300), rot: ih(k, 6, 300) * Math.PI, tone: ih(k, 7, 300), hs: 0.8 + r / 10, k: ROCKS.length });
      if (ih(k, 8, 300) < 0.62 && !bz) {
        const r2 = 2.6 + ih(k, 9, 300) * 3.4, o2 = off + r * 0.85 + r2 * 0.55, tj = (ih(k, 10, 300) - 0.5) * r;
        ROCKS.push({ x: P.x + P.nx * o2 + P.tx * tj, y: P.y + P.ny * o2 + P.ty * tj, r: r2, asp: 0.7 + 0.3 * ih(k, 11, 300), rot: ih(k, 12, 300) * Math.PI, tone: ih(k, 13, 300), hs: 0.8 + r2 / 10, k: ROCKS.length });
      }
      if (ih(k, 14, 300) < 0.3 && !bz) { // a stepping pebble just in the water
        const r3 = 1.8 + ih(k, 15, 300) * 1.6, o3 = -(r * 0.6 + r3 + 1.5);
        ROCKS.push({ x: P.x + P.nx * o3, y: P.y + P.ny * o3, r: r3, asp: 0.8, rot: 0, tone: ih(k, 16, 300), hs: 0.5, k: ROCKS.length });
      }
      k++;
    }
    // stepping stones across the moss at the top, and a flat viewing stone by each lower lantern
    const flats = [[92, 22, 7.5, 0.62, 0.3], [112, 34, 6.5, 0.66, -0.2], [132, 26, 7, 0.6, 0.5], [152, 34, 6, 0.65, 0.1], [172, 24, 6.5, 0.62, -0.4], [196, 28, 6, 0.7, 0.2],
      [58, 318, 8, 0.6, 0.3], [214, 322, 7.5, 0.62, -0.3]];
    for (const f of flats) ROCKS.push({ x: f[0], y: f[1], r: f[2], asp: f[3], rot: f[4], tone: 0.5, hs: 0.35, flat: 1, k: ROCKS.length });

    for (const R of ROCKS) {
      const c = Math.cos(R.rot), sn = Math.sin(R.rot), bb = Math.ceil(R.r * 1.3) + 1;
      for (let y = fl(R.y - bb); y <= R.y + bb; y++) for (let x = fl(R.x - bb); x <= R.x + bb; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const dx = x + 0.5 - R.x, dy = y + 0.5 - R.y;
        const lx = dx * c + dy * sn, ly = (-dx * sn + dy * c) / R.asp;
        const a = Math.atan2(ly, lx);
        const rr = R.r * (1 + 0.32 * (fbm2(Math.cos(a) * 1.4 + R.k * 7.3, Math.sin(a) * 1.4 + R.k * 3.1, 311, 3) - 0.5));
        const d = Math.hypot(lx, ly) / rr;
        if (d >= 1) continue;
        const h = R.flat ? R.hs * (1 - Math.pow(d, 6)) : Math.pow(1 - d * d, 0.55) * R.hs;
        const i = y * W + x;
        if (h > ROCKH[i]) { ROCKH[i] = h; ROCKID[i] = R.k; ROCKD[i] = d; }
      }
    }
    // classify: above the water line, or a submerged skirt on the bed
    for (let i = 0; i < NP; i++) {
      if (ROCKID[i] < 0) continue;
      if (IN[i]) { const wl = 0.12 + 0.07 * SD[i]; if (ROCKH[i] < wl) { TYPE[i] = T_WATER; continue; } }
      TYPE[i] = T_ROCK;
    }
    // shade
    const L3 = [-0.45, -0.6, 0.66];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x, id = ROCKID[i]; if (id < 0) continue;
      const R = ROCKS[id];
      const hx = (ROCKH[i + 1] - ROCKH[i - 1]) * 2.6, hy = (ROCKH[i + W] - ROCKH[i - W]) * 2.6;
      const nl = Math.hypot(hx, hy, 1);
      const lam = (-hx * L3[0] - hy * L3[1] + L3[2]) / nl;
      let sh = 0.36 + 0.9 * Math.max(0, lam);
      // crevices between touching rocks
      let crev = 0;
      for (const o of [-1, 1, -W, W]) { const j = i + o; if (ROCKID[j] !== id && ROCKID[j] >= 0 && ROCKH[j] > ROCKH[i]) crev++; if (ROCKID[j] < 0) crev += 0.3; }
      sh *= 1 - 0.14 * crev;
      sh *= 0.62 + 0.38 * sstep(0, 0.3, ROCKH[i]);
      const tn = R.tone;
      let r = tn < 0.33 ? 126 : tn < 0.7 ? 118 : 134, g = tn < 0.33 ? 130 : tn < 0.7 ? 118 : 122, b = tn < 0.33 ? 132 : tn < 0.7 ? 110 : 106;
      if (R.flat) { r = 150; g = 148; b = 136; }
      const mot = fbm2(x * 0.22 + id, y * 0.22, 321, 3), sp = ih(x, y, 323);
      const k = (0.92 + 0.36 * mot + (sp - 0.5) * 0.1) * sh * 1.12;
      r *= k; g *= k; b *= k;
      // cracks
      const cr = Math.abs(fbm2(x * 0.16 + id * 5, y * 0.16, 327, 2) - 0.5);
      if (cr < 0.022 && ROCKD[i] < 0.85) { r *= 0.55; g *= 0.55; b *= 0.55; }
      // moss cushions on the tops and in the joints, lichen rosettes
      const mo = fbm2(x * 0.19, y * 0.19, 331, 3) + 0.16 * crev + (R.flat ? -0.12 : 0) - 0.25 * (ROCKD[i] > 0.9 ? 1 : 0) + 0.1 * (ROCKD[i] < 0.5 ? 1 : 0) - 0.12 * (R.tone > 0.7 ? 1 : 0);
      if (mo > 0.66) {
        const mk = clamp((mo - 0.66) * 5, 0, 1), mm = vn2(x * 0.8, y * 0.8, 333);
        const gr = lerp(44, 92, mm) * (0.65 + 0.55 * sh), gg = lerp(78, 136, mm) * (0.65 + 0.55 * sh), gb = lerp(36, 54, mm) * (0.65 + 0.55 * sh);
        r = lerp(r, gr, 0.45 + 0.55 * mk); g = lerp(g, gg, 0.45 + 0.55 * mk); b = lerp(b, gb, 0.45 + 0.55 * mk);
      } else if (ih(x, y, 335) < 0.018 && ROCKD[i] < 0.8) { r = 156; g = 158; b = 138; }
      else if (ih(x >> 1, y >> 1, 337) < 0.02 && ROCKD[i] < 0.7) { r = r * 0.7 + 40; g = g * 0.7 + 44; b = b * 0.7 + 30; }
      if (TYPE[i] === T_WATER) { r *= 0.72; g *= 0.84; b *= 0.8; } // wet, algae-dark skirt under water
      else if (IN[i] || SD[i] > -3) {
        // the wet band at the waterline, and a 1 px meniscus sheen
        const wl = 0.12 + 0.07 * Math.max(0, SD[i]);
        if (ROCKH[i] < wl + 0.18) { r *= 0.66; g *= 0.7; b *= 0.72; }
        let nearW = false;
        for (const o of [-1, 1, -W, W]) if (TYPE[i + o] === T_WATER && ROCKID[i + o] < 0 || (TYPE[i + o] === T_WATER && IN[i + o])) nearW = true;
        if (nearW) { r = r * 0.5 + 52; g = g * 0.5 + 70; b = b * 0.5 + 68; }
      }
      setA(i, r, g, b);
    }
    // ground: contact shadow around every rock
    const rockMask = new Uint8Array(NP); for (let i = 0; i < NP; i++) rockMask[i] = TYPE[i] === T_ROCK ? 1 : 0;
    const dr = chamfer(rockMask, 0);
    for (let i = 0; i < NP; i++) if (TYPE[i] === T_GROUND && dr[i] < 4) mulA(i, 0.55 + 0.45 * sstep(0.5, 4, dr[i]));
  }

  function pebble(cx, cy, r, asp, rot, col, land, k) {
    const c = Math.cos(rot), s = Math.sin(rot), bb = Math.ceil(r + 2);
    for (let y = fl(cy - bb); y <= cy + bb; y++) for (let x = fl(cx - bb); x <= cx + bb; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x;
      if (ROCKID[i] >= 0) continue;
      if (!(IN[i] || (land && TYPE[i] === T_GROUND))) continue;
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const lx = dx * c + dy * s, ly = (-dx * s + dy * c) / asp;
      const d = Math.hypot(lx, ly) / r;
      if (d < 1) {
        let sh = 0.86 + 0.5 * (-dx * 0.55 - dy * 0.65) / (r + 0.5);
        if (d > 0.72) sh *= 0.84;
        if (d < 0.4 && (-dx - dy) > 0 && r > 2.2) sh += 0.12;
        const sp = 1 + (ih(x, y, 341 + k) - 0.5) * 0.12;
        setA(i, col[0] * sh * sp, col[1] * sh * sp, col[2] * sh * sp);
        PEB[i] = 1;
      } else if (d < 1 + 1.4 / r && !PEB[i]) mulA(i, 0.72);
    }
  }
  const STONES = [[118, 116, 108], [132, 118, 96], [74, 74, 72], [128, 96, 78], [160, 156, 142], [104, 98, 84], [96, 104, 100]];
  function paintBed() {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!IN[i] || ROCKID[i] >= 0) continue;
      const n1 = fbm2(x * 0.05, y * 0.05, 421, 4), n2 = fbm2(x * 0.3, y * 0.3, 423, 2);
      const k = (0.78 + 0.36 * n1 + 0.16 * (n2 - 0.5)) * (1 - 0.3 * sstep(0, 70, SD[i]));
      setA(i, 84 * k, 80 * k, 60 * k);
      // dark leaf litter and sunken twigs in the silt
      if (ih(x >> 1, y >> 1, 425) < 0.025) mulA(i, 0.7);
    }
    // river stones: dense in the shallows, scattered on the slope, few in the deep
    for (let k = 0; k < 4200; k++) {
      const x = 20 + ih(k, 1, 430) * 230, y = 34 + ih(k, 2, 430) * 280;
      const i = fl(y) * W + fl(x);
      if (!IN[i]) continue;
      const sd = SD[i], dep = sstep(0, 80, sd);
      if (ih(k, 3, 430) > Math.pow(1 - dep, 2.2) * 0.95 + 0.04) continue;
      const r = (1.4 + Math.pow(ih(k, 4, 430), 1.6) * 4.4) * (1 - 0.45 * dep);
      const col = STONES[fl(ih(k, 5, 430) * STONES.length)];
      pebble(x, y, r, 0.62 + 0.38 * ih(k, 6, 430), ih(k, 7, 430) * Math.PI, col, false, k);
    }
    // the pebble beach (suhama) runs up out of the water between the lower lanterns
    for (let k = 0; k < 2600; k++) {
      const th = 1.2 + ih(k, 1, 440) * 0.86, P = shorePt(th);
      const o = (ih(k, 2, 440) - 0.62) * 30;
      const dx = Math.cos(th), dy = Math.sin(th) * PRX / PRY;
      const x = P[0] + dx * o + (ih(k, 3, 440) - 0.5) * 4, y = P[1] + dy * o * 1.4;
      const i = clamp(fl(y), 0, H - 1) * W + clamp(fl(x), 0, W - 1);
      if (TYPE[i] === T_ROCK) continue;
      const fade = sstep(1.2, 1.3, th) * sstep(2.06, 1.94, th);
      if (ih(k, 4, 440) > fade) continue;
      const r = 1.3 + Math.pow(ih(k, 5, 440), 1.5) * 2.8;
      const col = STONES[fl(ih(k, 6, 440) * STONES.length)];
      pebble(x, y, r, 0.6 + 0.4 * ih(k, 7, 440), ih(k, 8, 440) * Math.PI, col, true, k + 9000);
    }
    // sunken things: a few old cherry petals and two drowned leaves
    for (let k = 0; k < 40; k++) {
      const x = fl(30 + ih(k, 1, 450) * 210), y = fl(50 + ih(k, 2, 450) * 250), i = y * W + x;
      if (!IN[i] || ROCKID[i] >= 0) continue;
      setA(i, 170, 120, 130); if (ih(k, 3, 450) < 0.5 && x + 1 < W) setA(i + 1, 150, 100, 112);
    }
    for (const [lx, ly, la] of [[118, 214, 0.6], [168, 196, 2.4]]) {
      for (let y = ly - 6; y <= ly + 6; y++) for (let x = lx - 6; x <= lx + 6; x++) {
        const dx = x + 0.5 - lx, dy = y + 0.5 - ly, a = Math.atan2(dy, dx) - la, r = Math.hypot(dx, dy);
        const lob = 3.2 + 2.2 * Math.abs(Math.cos(a * 2.5));
        if (r < lob) { const i = y * W + x; setA(i, 92, 64, 40); if (Math.abs(Math.sin(a * 2.5)) < 0.15) setA(i, 70, 46, 30); }
      }
    }
    // depth, transmission and the water body colour
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (TYPE[i] !== T_WATER) continue;
      const sd = Math.max(0, SD[i]);
      let dep = clamp(Math.pow(sstep(0, 84, sd), 0.8) * 0.96 + (fbm2(x * 0.04, y * 0.04, 461, 3) - 0.5) * 0.14 * sstep(4, 30, sd), 0, 1);
      if (ROCKID[i] >= 0) dep = Math.min(dep, Math.max(0.02, (0.12 + 0.07 * sd - ROCKH[i]) * 0.5));
      DEP[i] = dep;
      TRN[i] = Math.exp(-dep * 2.2);
      SCR[i] = lerp(40, 8, dep); SCG[i] = lerp(98, 40, Math.pow(dep, 0.9)); SCB[i] = lerp(88, 40, dep);
    }
  }

  /* ---------- lily pads and lotus */
  function paintPads() {
    const padMask = new Float32Array(NP);
    PADS.forEach((P, k) => {
      const bb = Math.ceil(P.R + 2);
      const nv = 13 + fl(ih(k, 1, 500) * 6);
      const upA = ih(k, 2, 500) * TAU, up = ih(k, 3, 500) < 0.55;
      const holeA = ih(k, 4, 500) * TAU, holeR = P.R * 0.55;
      const hx = P.x + Math.cos(holeA) * holeR, hy = P.y + Math.sin(holeA) * holeR;
      for (let y = fl(P.y - bb); y <= P.y + bb; y++) for (let x = fl(P.x - bb); x <= P.x + bb; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = y * W + x; if (TYPE[i] !== T_WATER) continue;
        const dx = x + 0.5 - P.x, dy = y + 0.5 - P.y, r = Math.hypot(dx, dy);
        const a = wrapA(Math.atan2(dy, dx) - P.rot);
        const Rr = P.R * (1 + 0.06 * (vn2(Math.cos(a) * 2.2 + k * 4, Math.sin(a) * 2.2, 503) - 0.5));
        if (r > Rr) continue;
        if (Math.abs(a) * r < 0.35 + r * 0.1 && r > 0.6) continue;               // the notch
        if (P.hole && Math.hypot(x + 0.5 - hx, y + 0.5 - hy) < 1.8) continue;     // an insect bite
        TYPE[i] = T_PAD; padMask[i] = 1;
        const tq = fbm2(x * 0.35, y * 0.35, 505 + k, 2);
        let v = 0.5 + 0.22 * (tq - 0.5) + 0.12 * (1 - r / Rr);
        // radial veins, forking in the outer half
        const va = (a + Math.PI) / TAU * nv, fv = va - fl(va), dv = Math.min(fv, 1 - fv) * TAU / nv * r;
        const vb = va * 2 + 0.5, fb = vb - fl(vb), db = Math.min(fb, 1 - fb) * TAU / (nv * 2) * r;
        if (r > 1.6 && r < Rr - 1.2 && dv < 0.5) v += 0.3;
        else if (r > 1.6 && r < Rr - 1.2 && dv < 1.1) v -= 0.08;
        else if (r > Rr * 0.55 && r < Rr - 1.2 && db < 0.42) v += 0.16;
        // waxy sheen on the upper left, darker rim, stem point
        const sh = (-dx * 0.6 - dy * 0.8) / (Rr + 0.01);
        if (r > Rr * 0.3 && r < Rr * 0.8 && sh > 0.35) v += 0.1 * sstep(0.35, 0.8, sh);
        if (r > Rr - 1.1) v -= 0.3;
        if (r < 1.2) v -= 0.18;
        let R0 = lerp(22, 140, v), G0 = lerp(48, 196, v), B0 = lerp(26, 92, v);
        if (P.yel) { const yk = P.yel * sstep(0.35, 0.75, fbm2(x * 0.18, y * 0.18, 507 + k, 3) + r / Rr * 0.25); R0 = lerp(R0, 150 * v * 1.6, yk); G0 = lerp(G0, 136 * v * 1.6, yk); B0 = lerp(B0, 64 * v * 1.6, yk); }
        if (up && r > Rr - 1.9 && Math.abs(wrapA(a + P.rot - upA)) < 0.55) { R0 = 128; G0 = 56; B0 = 86; } // curled rim shows the red underside
        setA(i, R0, G0, B0);
      }
      // droplets beaded on the bigger pads
      if (P.R > 8) for (let q = 0; q < 2; q++) {
        const a = ih(k, 10 + q, 500) * TAU, rr = P.R * (0.3 + 0.4 * ih(k, 12 + q, 500));
        const x = fl(P.x + Math.cos(a) * rr), y = fl(P.y + Math.sin(a) * rr), i = y * W + x;
        if (TYPE[i] === T_PAD && TYPE[i + W + 1] === T_PAD) { setA(i, 200, 232, 214); setA(i + W + 1, ALR[i + W + 1] * 0.55, ALG[i + W + 1] * 0.55, ALB[i + W + 1] * 0.55); }
      }
    });
    // soft pad shadows on the bed, offset by depth
    const raw = new Float32Array(NP);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!padMask[i]) continue;
      const dp = DEP[i] || 0.4;
      const tx = fl(x + 2 + 3.5 * dp), ty = fl(y + 3 + 4.5 * dp);
      if (tx < W && ty < H) raw[ty * W + tx] = 1;
    }
    blur(raw, PSH, 2);
  }

  function paintLotus() {
    LOTUS.forEach((L, k) => {
      const s = L.s;
      const rings = L.bud
        ? [{ n: 5, len: 9 * s, w: 4.4 * s, off: 0, c: 0.75 }, { n: 4, len: 6 * s, w: 3.6 * s, off: 0.6, c: 0.9 }]
        : [{ n: 9, len: 11.5 * s, w: 3.9 * s, off: 0, c: 0 }, { n: 8, len: 9 * s, w: 3.5 * s, off: 0.39, c: 0.25 }, { n: 7, len: 6.4 * s, w: 2.9 * s, off: 0.18, c: 0.5 }, { n: 5, len: 4.4 * s, w: 2.2 * s, off: 0.7, c: 0.7 }];
      const bb = Math.ceil(12.5 * s) + 2;
      for (let y = fl(L.y - bb); y <= L.y + bb; y++) for (let x = fl(L.x - bb); x <= L.x + bb; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = y * W + x; if (TYPE[i] !== T_WATER && TYPE[i] !== T_PAD) continue;
        const dx = x + 0.5 - L.x, dy = y + 0.5 - L.y, r = Math.hypot(dx, dy);
        let hit = null;
        for (let q = 0; q < rings.length; q++) {
          const R = rings[q];
          for (let p = 0; p < R.n; p++) {
            const an = L.rot + R.off + p * TAU / R.n + (ih(k * 40 + q * 10 + p, 1, 520) - 0.5) * 0.22;
            const ca = Math.cos(an), sa = Math.sin(an);
            const a = dx * ca + dy * sa, b = -dx * sa + dy * ca;
            const len = R.len * (0.92 + 0.16 * ih(k * 40 + q * 10 + p, 2, 520));
            if (a < 0.2 || a > len) continue;
            const sN = a / len, hw = R.w * Math.pow(Math.sin(Math.PI * Math.pow(sN, 0.72)), 0.85);
            if (Math.abs(b) > hw) continue;
            hit = { q, sN, bn: b / (hw + 1e-3), edge: hw - Math.abs(b) < 0.8, an, c: R.c };
          }
        }
        let cr, cg, cb;
        if (!L.bud && r < 2.5 * s + 0.6) { // seed pod with its holes
          cr = 196; cg = 206; cb = 110;
          if (ih(x, y, 530) < 0.35 && r > 0.7) { cr = 120; cg = 130; cb = 60; }
          if (r < 0.9) { cr = 226; cg = 228; cb = 150; }
        } else if (!L.bud && r < 3.5 * s + 0.6 && (!hit || hit.q >= 2)) { // ring of stamens
          const st = ih(fl(Math.atan2(dy, dx) * 6), k, 532) < 0.6;
          cr = st ? 252 : 230; cg = st ? 214 : 160; cb = st ? 120 : 70;
        } else if (hit) {
          const t = hit.sN, cc = hit.c;
          // white at the heart, blushing to pink, deep rose at the very tip
          cr = lerp(250, 236, t); cg = lerp(238, 170, Math.pow(t, 1.3)); cb = lerp(240, 196, t);
          if (t > 0.82) { const a = sstep(0.82, 1, t) * (1 - cc * 0.6); cr = lerp(cr, 196, a); cg = lerp(cg, 100, a); cb = lerp(cb, 146, a); }
          cr = lerp(cr, 252, cc * 0.4); cg = lerp(cg, 236, cc * 0.4); cb = lerp(cb, 238, cc * 0.4);
          if (L.bud) { cr *= 0.92; cg *= 0.78; cb *= 0.88; }
          const lit = Math.cos(hit.an - 3.9);
          const k2 = 0.92 + 0.1 * lit + (Math.abs(hit.bn) < 0.2 && t > 0.15 && t < 0.8 ? 0.08 : 0) - (Math.abs(hit.bn) > 0.6 ? 0.07 * Math.sign(hit.bn) * Math.sin(hit.an) : 0);
          cr *= k2; cg *= k2; cb *= k2;
          if (hit.edge) { cr *= 0.72; cg *= 0.6; cb *= 0.7; }
        } else continue;
        TYPE[i] = T_LOTUS; setA(i, cr, cg, cb);
      }
    });
  }

  /* ---------- the cherry tree that leans in over the top left corner */
  const BLOSSOMS = [];
  const BR = [[96, 40, 72], [172, 82, 128], [228, 150, 182], [250, 214, 226], [255, 240, 244]];
  function blossomRamp(v) { // a five stop rose ramp, so shading changes hue as well as value
    v = clamp(v, 0, 1) * 4; const a = Math.min(3, fl(v)), f = v - a;
    KR = lerp(BR[a][0], BR[a + 1][0], f); KG = lerp(BR[a][1], BR[a + 1][1], f); KB = lerp(BR[a][2], BR[a + 1][2], f);
  }
  function paintCanopy() {
    const br = [];
    // branches: a trunk off the corner splitting into limbs, each a chain of short wandering segments
    function limb(x, y, a, len, w, depth, k) {
      let px = x, py = y;
      for (let s = 0; s < len; s++) {
        a += (ih(k, s, 600) - 0.5) * 0.5;
        const nx = px + Math.cos(a) * 1.6, ny = py + Math.sin(a) * 1.6;
        br.push([px, py, nx, ny, Math.max(0.6, w * (1 - s / len * 0.6))]);
        if (depth < 3 && s > 3 && ih(k, s, 601) < 0.16) limb(nx, ny, a + (ih(k, s, 602) < 0.5 ? -0.8 : 0.8), len * 0.55, w * 0.6, depth + 1, k * 7 + s);
        if (ih(k, s, 603) < 0.2 && s > 2) BLOSSOMS.push([nx + (ih(k, s, 604) - 0.5) * 10, ny + (ih(k, s, 605) - 0.5) * 10, 3.4 + ih(k, s, 606) * 3.8 * (1 - depth * 0.15)]);
        px = nx; py = ny;
      }
    }
    limb(-6, -4, 0.62, 40, 3.4, 0, 1);
    limb(-6, 10, 0.2, 34, 2.8, 0, 2);
    limb(4, -6, 1.18, 30, 2.6, 0, 3);
    const CAN = new Uint8Array(NP);
    for (const b of br) {
      const n = Math.ceil(Math.hypot(b[2] - b[0], b[3] - b[1]) * 2) + 1;
      for (let q = 0; q <= n; q++) {
        const cx = lerp(b[0], b[2], q / n), cy = lerp(b[1], b[3], q / n), w = b[4];
        for (let y = fl(cy - w); y <= cy + w; y++) for (let x = fl(cx - w); x <= cx + w; x++) {
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy > w * w) continue;
          const i = y * W + x; TYPE[i] = T_CANOPY; CAN[i] = 1;
          const top = (-dx - dy) / (w + 0.01);
          const k = top > 0.35 ? 1.5 : top < -0.4 ? 0.7 : 1;
          setA(i, 52 * k, 38 * k, 34 * k);
          if (ih(x, y, 610) < 0.12) mulA(i, 0.75);
        }
      }
    }
    // blossom clusters: each a soft ball lit from the upper left, textured with five-petal flowers,
    // darker where it tucks under its neighbour
    const CLU = new Int16Array(NP).fill(-1), CLV = new Float32Array(NP);
    BLOSSOMS.forEach((B, k) => {
      const [cx, cy, r] = B, bb = Math.ceil(r + 2);
      for (let y = fl(cy - bb); y <= cy + bb; y++) for (let x = fl(cx - bb); x <= cx + bb; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, a = Math.atan2(dy, dx);
        const rr = r * (1 + 0.22 * (vn2(Math.cos(a) * 1.8 + k * 3, Math.sin(a) * 1.8, 626) - 0.5) + 0.12 * Math.cos(a * 5 + k));
        const d = Math.hypot(dx, dy) / rr; if (d > 1) continue;
        const i = y * W + x;
        const nz = Math.sqrt(1 - d * d);
        const lit = -0.04 + 0.72 * (((-dx * 0.55 - dy * 0.7) / rr) * 0.7 + nz * 0.65);
        if (CLU[i] >= 0 && d > 0.82) continue; // keep the rim of the cluster underneath
        CLU[i] = k; CLV[i] = lit - (d > 0.8 ? 0.2 : 0);
      }
    });
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, k = CLU[i]; if (k < 0) continue;
      let v = CLV[i];
      // flower texture: petal lobes catch light, flower hearts are deep rose
      const fx = x * 0.62 + (y & 1) * 0.31, fy = y * 0.62, cxi = fl(fx), cyi = fl(fy);
      const ox = fx - cxi - 0.5, oy = fy - cyi - 0.5, od = Math.hypot(ox, oy);
      if (od < 0.17 && ih(cxi, cyi, 628) < 0.6) v -= 0.3;
      else if (od > 0.42) v -= 0.08;
      v += (ih(x, y, 624) - 0.5) * 0.1;
      if (ih(x, y, 629) < 0.03) v += 0.25;
      TYPE[i] = T_CANOPY; CAN[i] = 1;
      blossomRamp(v);
      setA(i, KR, KG, KB);
    }
    // shade under the canopy edge on whatever lies below
    const dc = chamfer(CAN, 0);
    for (let i = 0; i < NP; i++) if (!CAN[i] && dc[i] < 7) { const k = 0.55 + 0.45 * sstep(0, 7, dc[i]); mulA(i, k); }
    // fallen petals scattered on the moss and the near rocks
    for (let k = 0; k < 160; k++) {
      const x = fl(Math.pow(ih(k, 1, 630), 1.4) * 120), y = fl(Math.pow(ih(k, 2, 630), 1.4) * 110), i = y * W + x;
      if (TYPE[i] !== T_GROUND && TYPE[i] !== T_ROCK) continue;
      setA(i, 236, 176, 196); if (ih(k, 3, 630) < 0.5 && x + 1 < W && TYPE[i + 1] !== T_WATER) setA(i + 1, 204, 124, 156);
    }
  }

  /* ---------- ferns and irises */
  function paintPlants() {
    function fern(cx, cy, n, len, rot, k) {
      for (let f = 0; f < n; f++) {
        const a0 = rot + f * TAU / n + (ih(k, f, 640) - 0.5) * 0.4, L = len * (0.75 + 0.35 * ih(k, f, 641)), bend = (ih(k, f, 642) - 0.5) * 0.9;
        for (let s = 0; s < L; s += 0.5) {
          const u = s / L, a = a0 + bend * u;
          const px = cx + Math.cos(a0 + bend * u * 0.5) * s, py = cy + Math.sin(a0 + bend * u * 0.5) * s;
          const put = (qx, qy, r, g, b) => { qx = fl(qx); qy = fl(qy); if (qx < 0 || qy < 0 || qx >= W || qy >= H) return; const i = qy * W + qx; if (TYPE[i] === T_WATER || TYPE[i] === T_CANOPY || TYPE[i] === T_PAD) return; TYPE[i] = T_GROUND; setA(i, r, g, b); };
          put(px, py, 70, 108, 44);
          // pinnae, alternate sides, shorter toward the tip
          const pl = (1 - u) * 4.2 + 0.8;
          if ((s * 2) % 3 < 0.6 && s > 1.5) {
            const side = (fl(s * 2) % 2) ? 1 : -1, pa = a + side * 1.25;
            for (let q = 0.5; q < pl; q += 0.5) put(px + Math.cos(pa) * q, py + Math.sin(pa) * q, q > pl - 0.8 ? 120 : 84, q > pl - 0.8 ? 168 : 132, q > pl - 0.8 ? 64 : 50);
          }
        }
      }
    }
    fern(128, 8, 7, 13, 0.4, 1);
    fern(258, 92, 6, 12, 1.0, 2);
    fern(10, 150, 6, 11, 2.0, 3);
    fern(150, 326, 6, 10, 0.2, 4);
    function iris(cx, cy, n, len, dirA, k) {
      for (let f = 0; f < n; f++) {
        const a = dirA + (f / (n - 1) - 0.5) * 1.7 + (ih(k, f, 650) - 0.5) * 0.25, L = len * (0.6 + 0.5 * ih(k, f, 651));
        for (let s = 0; s < L; s += 0.5) {
          const x = fl(cx + Math.cos(a) * s), y = fl(cy + Math.sin(a) * s);
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const i = y * W + x; if (TYPE[i] === T_PAD || TYPE[i] === T_LOTUS || TYPE[i] === T_CANOPY) continue;
          const tip = s / L;
          TYPE[i] = T_GROUND; setA(i, lerp(44, 120, tip), lerp(84, 172, tip), lerp(40, 70, tip));
          if (tip < 0.3) mulA(i, 0.8);
        }
      }
    }
    iris(258, 214, 9, 15, Math.PI * 0.95, 5);
    iris(14, 250, 8, 13, 0.0, 6);
    iris(226, 56, 7, 12, 2.4, 7);
  }

  /* ---------- lantern roofs and their light */
  function paintLanterns() {
    const L2 = [-0.6, -0.8];
    LANTERNS.forEach((Lt, k) => {
      const R = Lt.R, bb = Math.ceil(R + 6);
      for (let y = fl(Lt.y - bb); y <= Lt.y + bb; y++) for (let x = fl(Lt.x - bb); x <= Lt.x + bb; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = y * W + x, dx = x + 0.5 - Lt.x, dy = y + 0.5 - Lt.y, r = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx) - Lt.rot;
        // roof outline: hexagon, disc or square
        let ed, face = 0, ridge = false;
        if (Lt.kind === 'hex') {
          let m = 0; for (let q = 0; q < 3; q++) { const qa = q * Math.PI / 3 + Math.PI / 6; m = Math.max(m, Math.abs(Math.cos(a - qa)) * r); }
          ed = R * 0.866 - m;
          const sec = Math.round(a / (Math.PI / 3)); const da = wrapA(a - sec * Math.PI / 3);
          ridge = Math.abs(da) * r < 0.65 && r > 4.5;
          face = Math.cos(fl(a / (Math.PI / 3)) * Math.PI / 3 + Math.PI / 6 + Lt.rot - Math.atan2(L2[1], L2[0]));
        } else if (Lt.kind === 'round') {
          ed = R * (1 + 0.04 * Math.cos(a * 6)) - r;
          face = Math.cos(a + Lt.rot - Math.atan2(L2[1], L2[0])) * sstep(2, R, r);
          ridge = Math.abs(r - R * 0.52) < 0.5;
        } else {
          const m = Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))) * r;
          ed = R * 0.8 - m;
          const sq = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 0 : Math.PI) : (Math.sin(a) > 0 ? Math.PI / 2 : -Math.PI / 2);
          face = Math.cos(sq + Lt.rot - Math.atan2(L2[1], L2[0]));
          ridge = Math.abs(Math.abs(Math.cos(a)) - Math.abs(Math.sin(a))) * r < 0.7 && r > 2.5;
        }
        if (ed >= 0) {
          TYPE[i] = T_ROOF;
          let v = 0.68 + 0.3 * face + 0.14 * (fbm2(x * 0.4, y * 0.4, 660 + k, 2) - 0.5);
          if (ridge) v += 0.22;
          if (ed >= 0.6 && ed < 1.7) v += 0.2;              // the thick eave catches the sky
          let r0 = 206 * v, g0 = 196 * v, b0 = 172 * v;
          if (ed < 0.6) { r0 *= 0.45; g0 *= 0.45; b0 *= 0.45; }
          const mo = fbm2(x * 0.3, y * 0.3, 664 + k, 3);
          if (mo > 0.58 && !ridge && ed > 1) { const mm = vn2(x * 0.9, y * 0.9, 666); r0 = lerp(44, 90, mm) * v; g0 = lerp(80, 130, mm) * v; b0 = lerp(36, 52, mm) * v; }
          if (ih(x, y, 668) < 0.03) { r0 = 210; g0 = 212; b0 = 186; }
          // finial: lotus-petal collar and the onion jewel
          const jr = Lt.kind === 'square' ? 2.2 : 2.8, cr = jr + 1.7;
          if (r < cr) {
            if (r < jr) { const hl = (-dx * 0.6 - dy * 0.8) / jr; const q = 0.75 + 0.5 * hl; r0 = 170 * q; g0 = 168 * q; b0 = 156 * q; if (r < 0.8) { r0 = 236; g0 = 232; b0 = 214; } }
            else { const lob = Math.cos(Math.atan2(dy, dx) * 8) > 0; const q = lob ? 0.95 : 0.55; r0 = 150 * q; g0 = 150 * q; b0 = 140 * q; }
          }
          // corner curls on the hex roof
          if (Lt.kind === 'hex' && ed < 2.2 && r > R * 0.84) { const sec = wrapA(a - Math.round(a / (Math.PI / 3)) * Math.PI / 3); if (Math.abs(sec) < 0.12) { r0 = 230; g0 = 228; b0 = 210; } }
          setA(i, r0, g0, b0);
        } else if (ed > -8) {
          // light escaping under the eaves, strongest through the window openings
          const fan = Math.pow(Math.max(0, Math.cos(2 * (Math.atan2(dy, dx) - Lt.win))), 3);
          const e = Math.pow(1 - (-ed) / 8, 2.2) * (0.3 + 1.1 * fan) * 1.25;
          if (e > 0.05) { EMK[i] = k; EMR[i] = 255 * e * 0.9; EMG[i] = 196 * e * 0.9; EMB[i] = 108 * e * 0.9; }
        }
      }
      // the light field
      const A = LK[k];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, dx = x + 0.5 - Lt.x, dy = y + 0.5 - Lt.y, d2 = dx * dx + dy * dy;
        if (d2 > 140 * 140) continue;
        const fan = Math.pow(Math.max(0, Math.cos(2 * (Math.atan2(dy, dx) - Lt.win))), 2);
        let I = Lt.P * Math.pow(Lt.R0 * Lt.R0 / (Lt.R0 * Lt.R0 + d2), 1.5) * (0.62 + 0.38 * fan);
        if (TYPE[i] === T_ROOF && Math.sqrt(d2) < Lt.R + 1) I = 0;
        A[i] = I;
        // the glow the water surface throws back, a wider and softer pool
        if (IN[i]) { const q = Lt.P * 0.5 * Math.pow(3600 / (3600 + d2), 1.6) * (0.7 + 0.3 * fan); if (q > REF[i]) { REF[i] = q; REFK[i] = k; } }
      }
    });
  }

  /* ---------- per pixel dither amplitude */
  function finishStatic() {
    for (let i = 0; i < NP; i++) AMPF[i] = DA_T[TYPE[i]];
  }

  /* ================================================================ raindrops: geodesic ring fronts */
  function geodesic(D0) {
    const R = 52, S = 2 * R + 1, N = S * S, x0 = fl(D0.x) - R, y0 = fl(D0.y) - R;
    const dist = new Float32Array(N).fill(1e9), ax = new Int16Array(N), ay = new Int16Array(N), ad = new Float32Array(N);
    const blocked = (lx, ly) => { const x = x0 + lx, y = y0 + ly; if (x < 0 || y < 0 || x >= W || y >= H) return true; return TYPE[y * W + x] !== T_WATER; };
    const los = (sx, sy, ex, ey) => {
      const dx = ex - sx, dy = ey - sy, n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)));
      for (let s = 1; s < n; s++) if (blocked(Math.round(sx + dx * s / n), Math.round(sy + dy * s / n))) return false;
      return true;
    };
    const heap = [], hp = [];
    const push = (id, p) => { heap.push(id); hp.push(p); let c = heap.length - 1; while (c > 0) { const q = (c - 1) >> 1; if (hp[q] <= hp[c]) break; [heap[q], heap[c]] = [heap[c], heap[q]]; [hp[q], hp[c]] = [hp[c], hp[q]]; c = q; } };
    const pop = () => {
      const top = heap[0], tp = hp[0], li = heap.pop(), lp = hp.pop();
      if (heap.length) { heap[0] = li; hp[0] = lp; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && hp[l] < hp[m]) m = l; if (r < heap.length && hp[r] < hp[m]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; [hp[m], hp[c]] = [hp[c], hp[m]]; c = m; } }
      return [top, tp];
    };
    const c0 = R * S + R; dist[c0] = 0; ax[c0] = R; ay[c0] = R; ad[c0] = 0; push(c0, 0);
    while (heap.length) {
      const [u, pu] = pop(); if (pu > dist[u]) continue;
      const ux = u % S, uy = (u / S) | 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        const vx = ux + ox, vy = uy + oy; if (vx < 0 || vy < 0 || vx >= S || vy >= S) continue;
        if (blocked(vx, vy)) continue;
        const v = vy * S + vx;
        let nd, nax, nay, nad;
        const da = ad[u] + Math.hypot(vx - ax[u], vy - ay[u]);
        if (da < dist[v] - 1e-4 && los(ax[u], ay[u], vx, vy)) { nd = da; nax = ax[u]; nay = ay[u]; nad = ad[u]; }
        else { nd = dist[u] + (ox && oy ? Math.SQRT2 : 1); nax = ux; nay = uy; nad = dist[u]; }
        if (nd < dist[v] - 1e-4 && nd < R) { dist[v] = nd; ax[v] = nax; ay[v] = nay; ad[v] = nad; push(v, nd); }
      }
    }
    D0.R = R; D0.S = S; D0.x0 = x0; D0.y0 = y0; D0.g = dist;
  }

  /* ================================================================ koi */
  const KC = {
    w: [[150, 150, 144], [214, 210, 196], [252, 248, 234]],
    c: [[160, 150, 136], [222, 212, 190], [255, 248, 228]],
    r: [[140, 34, 26], [212, 66, 40], [244, 100, 62]],
    k: [[8, 10, 12], [22, 26, 30], [58, 64, 68]],
    g: [[176, 112, 34], [238, 176, 62], [255, 226, 128]],
    p: [[112, 128, 136], [184, 198, 202], [240, 248, 250]],
  };
  const KOI = [
    { name: 'kohaku', L: 52, L0: 46, Wm: 7.0, base: 'w', fin: 'w', metal: 0, z0: 0.1, n: 1, dir: -1, s0: 0.026, m: 12, ps: 0.3, pw: 0.0,
      blobs: [['r', 5.5, 0, 4.2, 9], ['r', 16, 1.6, 5.2, 4.8], ['r', 25.5, -1.2, 4.4, 6], ['r', 32, 0.8, 2.6, 3.2]],
      path: (p) => [160 + 44 * Math.cos(p) + 6 * Math.cos(2 * p + 0.7), 182 + 76 * Math.sin(p) + 8 * Math.sin(2 * p + 0.3)] },
    { name: 'showa', L: 47, L0: 42, Wm: 6.4, base: 'w', fin: 'w', finBase: 'k', metal: 0, z0: 0.22, n: 1, dir: -1, s0: 0.427, m: 13, ps: 2.0, pw: 1.3,
      blobs: [['r', 5, 0.5, 4, 8], ['r', 16, -2, 5.5, 3.6], ['r', 26, 2.2, 4, 3.5], ['k', 3, -3, 2.5, 2.2], ['k', 9, 3.2, 3.2, 2.6], ['k', 13, -0.5, 1.6, 2.2], ['k', 19, 2, 3.4, 3.6],
        ['k', 24, -3.4, 3.2, 3], ['k', 30, 3, 2.8, 2.6], ['k', 33, -1.5, 2.5, 2]],
      path: (p) => [110 + 30 * Math.sin(2 * p), 188 + 54 * Math.sin(p)] },
    { name: 'yamabuki', L: 45, L0: 45, Wm: 6.1, base: 'g', fin: 'g', metal: 1, z0: 0.16, n: 1, dir: 1, s0: 0.208, m: 14, ps: 4.1, pw: 2.2, blobs: [],
      path: (p) => [150 + 42 * Math.cos(p), 112 + 30 * Math.sin(p) + 4 * Math.sin(2 * p)] },
    { name: 'shiro', L: 41, L0: 41, Wm: 5.5, base: 'c', fin: 'c', metal: 0, z0: 0.36, n: 1, dir: 1, s0: 0.779, m: 15, ps: 1.1, pw: 3.1, blobs: [],
      path: (p) => [126 + 40 * Math.cos(p) + 5 * Math.cos(3 * p), 246 + 20 * Math.sin(p)] },
    { name: 'platinum', L: 43, L0: 43, Wm: 5.8, base: 'p', fin: 'p', metal: 1, z0: 0.24, n: 1, dir: -1, s0: 0.243, m: 14, ps: 5.0, pw: 4.4, blobs: [],
      path: (p) => [168 + 34 * Math.cos(p) + 6 * Math.cos(2 * p), 208 + 40 * Math.sin(p)] },
    { name: 'tancho', L: 36, L0: 32, Wm: 4.9, base: 'w', fin: 'w', metal: 0, z0: 0.3, n: 1, dir: 1, s0: 0.208, m: 16, ps: 3.3, pw: 5.2,
      blobs: [['r', 4.6, 0, 2.5, 2.3]],
      path: (p) => [94 + 26 * Math.cos(p) + 10 * Math.cos(2 * p), 112 + 20 * Math.sin(p) + 9 * Math.sin(2 * p)] },
  ];
  function buildPath(k) {
    const N0 = 4000, xs = new Float32Array(N0 + 1), ys = new Float32Array(N0 + 1), cum = new Float32Array(N0 + 1);
    for (let j = 0; j <= N0; j++) { const p = k.path(j / N0 * TAU); xs[j] = p[0]; ys[j] = p[1]; if (j) cum[j] = cum[j - 1] + Math.hypot(xs[j] - xs[j - 1], ys[j] - ys[j - 1]); }
    const Lt = cum[N0], N = Math.round(Lt / 0.5);
    k.PX = new Float32Array(N); k.PY = new Float32Array(N);
    let j = 0;
    for (let q = 0; q < N; q++) {
      const s = q * Lt / N; while (j < N0 - 1 && cum[j + 1] < s) j++;
      const f = (s - cum[j]) / (cum[j + 1] - cum[j] || 1);
      k.PX[q] = lerp(xs[j], xs[j + 1], f); k.PY[q] = lerp(ys[j], ys[j + 1], f);
    }
    k.N = N; k.Lt = Lt; k.ds = Lt / N; k.ns = Math.ceil(k.L / 0.42);
    k.seed = KOI.indexOf(k) * 17 + 3;
    const bs = k.L / k.L0; for (const bl of k.blobs) { bl[1] *= bs; bl[2] *= bs; bl[3] *= bs; bl[4] *= bs; }
  }
  const PA = [0, 0, 0, 0];
  function pathAt(k, s) {
    let f = s / k.ds; f = ((f % k.N) + k.N) % k.N;
    const i0 = fl(f), i1 = (i0 + 1) % k.N, ip = (i0 - 1 + k.N) % k.N, a = f - i0;
    PA[0] = lerp(k.PX[i0], k.PX[i1], a); PA[1] = lerp(k.PY[i0], k.PY[i1], a);
    let tx = k.PX[i1] - k.PX[ip], ty = k.PY[i1] - k.PY[ip]; const tl = Math.hypot(tx, ty) || 1;
    PA[2] = tx / tl; PA[3] = ty / tl;
  }
  const SPX = new Float32Array(160), SPY = new Float32Array(160), STX = new Float32Array(160), STY = new Float32Array(160);
  function spine(k, t) {
    const ns = k.ns, ph = TAU * t / D;
    const sh = k.Lt * (k.s0 + k.dir * (k.n * t / D + 0.015 * Math.sin(ph * 2 + k.ps)));
    const spd = 1 + 0.19 * Math.cos(ph * 2 + k.ps);
    k.spd = spd;
    const A = k.L * 0.05 * (0.7 + 0.8 * (spd - 0.81) / 0.38);
    for (let j = 0; j <= ns; j++) {
      const u = j / ns;
      pathAt(k, sh - k.dir * u * k.L);
      const mx = PA[2] * k.dir, my = PA[3] * k.dir, nx = -my, ny = mx;
      const wv = Math.sin(TAU * k.m * t / D - u * 4.4 + k.pw);
      const o = A * (u * u * 1.15 - 0.07 * (1 - u)) * wv;
      SPX[j] = PA[0] + nx * o; SPY[j] = PA[1] + ny * o;
    }
    for (let j = 0; j <= ns; j++) {
      const a = j > 0 ? j - 1 : j, b = j < ns ? j + 1 : j;
      let tx = SPX[a] - SPX[b], ty = SPY[a] - SPY[b]; const tl = Math.hypot(tx, ty) || 1;
      STX[j] = tx / tl; STY[j] = ty / tl; // points toward the head
    }
  }
  function wprof(u) {
    if (u < 0.07) { const q = (0.07 - u) / 0.074; return 0.66 * Math.sqrt(Math.max(0, 1 - q * q)) + 0.06; }
    if (u < 0.3) { const q = (u - 0.07) / 0.23; return 0.72 + 0.28 * Math.sin(q * Math.PI / 2); }
    if (u < 0.8) { const q = (u - 0.3) / 0.5; return 0.24 + 0.76 * Math.pow(0.5 + 0.5 * Math.cos(q * Math.PI), 0.85); }
    return 0.24 + 0.78 * sstep(0.8, 0.97, u);
  }
  function patAt(k, pu, pv) {
    let col = k.base;
    const n = (vn2(pu * 0.45 + k.seed, pv * 0.6, 61) - 0.5) * 0.7;
    for (let q = 0; q < k.blobs.length; q++) {
      const b = k.blobs[q], du = (pu - b[1]) / b[3], dv = (pv - b[2]) / b[4];
      if (du * du + dv * dv + n < 1) col = b[0];
    }
    return col;
  }
  let KR = 0, KG = 0, KB = 0;
  function ramp(c, s) {
    if (s < 0.5) { const q = s * 2; KR = lerp(c[0][0], c[1][0], q); KG = lerp(c[0][1], c[1][1], q); KB = lerp(c[0][2], c[1][2], q); }
    else { const q = (s - 0.5) * 2; KR = lerp(c[1][0], c[2][0], q); KG = lerp(c[1][1], c[2][1], q); KB = lerp(c[1][2], c[2][2], q); }
  }
  // light and water applied to a koi colour at pixel i
  function koiFinish(i, zm) {
    const I = LI[i], c = 1 + 0.12 * CF[i];
    const lr = (1.03 + I * 1.1) * c, lg = (1.02 + I * 0.75) * c, lb = (1.0 + I * 0.36) * c;
    const dp = DEP[i];
    KR = lerp(KR * lr, SCR[i] * (AR + I * WR), zm);
    KG = lerp(KG * lg, SCG[i] * (AG + I * WG), zm);
    KB = lerp(KB * lb, SCB[i] * (AB + I * WB), zm);
    void dp;
  }
  function kput(x, y, alpha, zm) {
    x = fl(x); y = fl(y); if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x; if (TYPE[i] !== T_WATER) return;
    if (alpha < 1 && STAMP[i] === STAMPV) return;
    koiFinish(i, zm);
    if (alpha >= 1) { OR[i] = KR; OG[i] = KG; OB[i] = KB; }
    else { OR[i] += (KR - OR[i]) * alpha; OG[i] += (KG - OG[i]) * alpha; OB[i] += (KB - OB[i]) * alpha; }
    STAMP[i] = STAMPV; AMPF[i] = 7;
  }
  function koiZ(k, t) { return clamp(k.z0 + 0.1 * Math.sin(TAU * t / D + k.ps * 1.7), 0, 0.8); }

  function drawFin(k, j, side, len, beta, zm, mode, ox, oy, sv) {
    const u = j / k.ns, w = wprof(u) * k.Wm * 0.72;
    const nx = -STY[j], ny = STX[j];
    const bx = SPX[j] + nx * side * w, by = SPY[j] + ny * side * w;
    const dx0 = -STX[j] * Math.cos(beta) + nx * side * Math.sin(beta), dy0 = -STY[j] * Math.cos(beta) + ny * side * Math.sin(beta);
    const px = -dy0, py = dx0;
    const bb = Math.ceil(len + 1.5);
    const cx = bx + dx0 * len * 0.5 + ox, cy = by + dy0 * len * 0.5 + oy;
    const fc = KC[k.fin];
    for (let y = fl(cy - bb); y <= cy + bb; y++) for (let x = fl(cx - bb); x <= cx + bb; x++) {
      const qx = x + 0.5 - bx - ox, qy = y + 0.5 - by - oy;
      const a = qx * dx0 + qy * dy0, b = qx * px + qy * py;
      const sN = a / len; if (sN <= 0 || sN >= 1) continue;
      const hw = len * 0.5 * Math.sqrt(sN) * Math.sqrt(1 - sN * sN);
      if (Math.abs(b) > hw) continue;
      if (mode === 1) { if (x >= 0 && y >= 0 && x < W && y < H) { const i = y * W + x; if (SHM[i] < sv * 0.6) SHM[i] = sv * 0.6; } continue; }
      const rim = hw - Math.abs(b) < 0.75 || sN > 0.86;
      const ray = Math.abs(Math.sin(Math.atan2(b, a) * 9)) < 0.35;
      let s = 0.72 + (rim ? 0.25 : 0) + (ray ? 0.08 : 0);
      ramp(k.finBase && sN < 0.42 ? KC[k.finBase] : fc, clamp(s, 0, 1));
      const fa = k.metal ? 0.12 : 0; kput(x, y, (rim ? 0.78 : ray ? 0.62 : 0.5) + fa, zm);
    }
  }

  function drawKoi(k, t, mode, ox, oy, sv) {
    const ns = k.ns, zm = mode === 0 ? 0.04 + 0.5 * k.z : 0;
    const ph = TAU * t / D;
    if (mode === 0) STAMPV++;
    // pectoral and pelvic fins, paddling slowly and out of step
    const jp = Math.round(ns * 0.2), jv = Math.round(ns * 0.52);
    for (const side of [-1, 1]) {
      const fl1 = 0.95 + 0.32 * Math.sin(ph * k.m * 0.5 + side * 1.3 + k.pw);
      if (mode === 0) STAMPV++;
      drawFin(k, jp, side, k.L * 0.23, fl1, zm, mode, ox, oy, sv);
      if (mode === 0) STAMPV++;
      drawFin(k, jv, side, k.L * 0.12, 0.85 + 0.2 * Math.sin(ph * k.m * 0.5 + side * 2.1 + 1), zm, mode, ox, oy, sv);
    }
    if (mode === 0) STAMPV++;
    const bodyStamp = STAMPV;
    // the body, laid along the bent spine
    for (let j = 0; j <= ns; j++) {
      const u = j / ns, w = wprof(u) * k.Wm;
      const tail = u > 0.8;
      if (tail && mode === 0 && j === Math.ceil(ns * 0.8)) STAMPV++;
      const nx = -STY[j], ny = STX[j];
      const nv = Math.max(1, Math.ceil(2 * w / 0.42));
      const pu = u * k.L;
      const ang = Math.atan2(STY[j], STX[j]);
      for (let m = 0; m <= nv; m++) {
        const vn = -1 + 2 * m / nv;
        if (tail && u > 0.9 + 0.1 * (0.25 + 0.75 * Math.pow(Math.abs(vn), 0.8))) continue;
        const pv = vn * w;
        const X = SPX[j] + nx * pv + ox, Y = SPY[j] + ny * pv + oy;
        if (mode === 1) {
          const x = fl(X), y = fl(Y); if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const i = y * W + x, s1 = tail ? sv * 0.55 : sv; if (SHM[i] < s1) SHM[i] = s1; continue;
        }
        if (tail) {
          const ray = Math.abs(Math.sin(vn * 7.5)) < 0.3, edge = u > 0.86 + 0.1 * (0.25 + 0.75 * Math.pow(Math.abs(vn), 0.8)) || Math.abs(vn) > 0.88;
          ramp(KC[k.fin], edge ? 0.98 : ray ? 0.82 : 0.7);
          kput(X, Y, (edge ? 0.75 : ray ? 0.6 : 0.46) + (k.metal ? 0.12 : 0), zm);
          continue;
        }
        const back = 1 - vn * vn;
        let s = 0.12 + 0.84 * Math.sqrt(back);
        let col = patAt(k, pu, pv);
        // scales: offset rows of small crescents, sharp on the shoulders
        if (u > 0.19 && u < 0.8) {
          const row = fl(pv / 2.3 + 40), cu0 = pu / 2.7 + (row & 1) * 0.5, cu = cu0 - fl(cu0);
          const cv = pv / 2.3 + 40 - row;
          const rim = cu > 0.7 || (Math.abs(cv - 0.5) > 0.4 && cu > 0.4);
          if (rim) s -= k.metal ? 0.05 : (col === 'w' || col === 'c') ? 0.08 : 0.14;
          if (k.metal) {
            const h = ih(row, fl(cu0), k.seed);
            const gl = Math.cos(ang * 2 + vn * 1.6 + h * TAU + ph * 2);
            if (!rim && gl > 0.8) s += 0.4 * (gl - 0.8) / 0.2 + 0.12;
          }
        }
        if (u < 0.19) { // the smooth head, polished on top
          if (Math.abs(vn) < 0.45 && pu > 1.5 && pu < 6) s += 0.12;
          if (pu < 1.1) s -= 0.12;
        }
        // dorsal fin folded flat along the spine
        if (u > 0.32 && u < 0.62 && Math.abs(pv) < 0.55) { s -= 0.14; if (k.finBase) col = 'k'; }
        ramp(KC[col], clamp(s, 0, 1));
        if (col === 'w' && u < 0.03) { KR *= 0.95; KG *= 0.8; KB *= 0.78; } // pink lips
        STAMPV = bodyStamp;
        kput(X, Y, 1, zm);
      }
    }
    if (mode === 1) return;
    // eyes, set into the sides of the head
    const je = Math.round(ns * 0.075), we = wprof(0.075) * k.Wm * 0.64;
    for (const side of [-1, 1]) {
      const x = fl(SPX[je] - STY[je] * side * we), y = fl(SPY[je] + STX[je] * side * we);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x; if (TYPE[i] !== T_WATER) continue;
      KR = 16; KG = 18; KB = 22; koiFinish(i, zm); OR[i] = KR; OG[i] = KG; OB[i] = KB;
    }
  }

  /* ================================================================ petals on the current */
  const PETALS = [];
  let GRX = null, GRY = null;
  function buildPetals() {
    // the current runs round the pond, parallel to the shore, slowing near the banks
    GRX = new Float32Array(NP); GRY = new Float32Array(NP);
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      const i = y * W + x; GRX[i] = (SD[i + 2] - SD[i - 2]) / 4; GRY[i] = (SD[i + 2 * W] - SD[i - 2 * W]) / 4;
    }
    const NSL = 11;
    for (let k = 0; k < NSL; k++) {
      let lx = 0, ly = 0, ok = false;
      for (let a = 0; a < 40 && !ok; a++) {
        const q = Math.pow(ih(k, a, 800), 0.8);
        lx = 46 + q * 170 + (ih(k, a, 801) - 0.5) * 40; ly = 70 + Math.pow(ih(k, a, 802), 1.3) * 200;
        const i = fl(ly) * W + fl(lx);
        ok = lx > 0 && lx < W && ly > 0 && ly < H && TYPE[i] === T_WATER && SD[i] > 10;
      }
      const P = { k, lx, ly, t0: (k + 0.4 * ih(k, 1, 803)) * D / NSL, fall: 3.6, float: 30 + ih(k, 2, 803) * 6, sink: 3.5,
        sx: 10 + ih(k, 3, 803) * 70, sy: 6 + ih(k, 4, 803) * 46, a0: ih(k, 5, 803) * TAU, spin: (ih(k, 6, 803) < 0.5 ? -1 : 1) * (0.18 + 0.2 * ih(k, 7, 803)), sz: 1.25 + 0.35 * ih(k, 8, 803) };
      // integrate the drift
      const n = Math.ceil((P.float + P.sink) * 10) + 2;
      P.tx = new Float32Array(n); P.ty = new Float32Array(n);
      let x = lx, y = ly;
      for (let s = 0; s < n; s++) {
        P.tx[s] = x; P.ty[s] = y;
        const i = clamp(fl(y), 2, H - 3) * W + clamp(fl(x), 2, W - 3);
        let gx = GRX[i], gy = GRY[i]; const gl = Math.hypot(gx, gy) || 1; gx /= gl; gy /= gl;
        const sp = 2.2 * sstep(2, 20, SD[i]) + 0.5;
        let vx = -gy * sp, vy = gx * sp;
        if (SD[i] < 9) { vx += gx * 0.8; vy += gy * 0.8; }
        vx += 0.35 * Math.sin(y * 0.05 + k); vy += 0.35 * Math.cos(x * 0.05 + k);
        x += vx * 0.1; y += vy * 0.1;
      }
      PETALS.push(P);
    }
  }
  function petalSprite(cx, cy, ang, sz, alpha, sink, above) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let y = fl(cy - 3); y <= cy + 3; y++) for (let x = fl(cx - 3); x <= cx + 3; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const a = (dx * ca + dy * sa) / sz, b = (-dx * sa + dy * ca) / sz;
      if (a * a / 4.4 + b * b / 1.9 > 1) continue;
      if (a > 1.2 && Math.abs(b) < 0.45) continue; // the notch in the tip
      if (bay(x, y) > alpha) continue;
      const i = y * W + x;
      if (!above && TYPE[i] !== T_WATER && TYPE[i] !== T_PAD) continue;
      let r = 246, g = 206, b2 = 222;
      if (a < -1.1) { r = 214; g = 128; b2 = 162; }
      else if (Math.abs(b) > 0.85 || a > 1.4) { r = 236; g = 166; b2 = 192; }
      const I = LI[i], lr = 0.66 + I * 1.3, lg = 0.74 + I * 0.95, lb = 0.82 + I * 0.55;
      r *= lr; g *= lg; b2 *= lb;
      if (sink > 0 && TYPE[i] === T_WATER) { r = lerp(r, SCR[i] * lr, sink); g = lerp(g, SCG[i] * lg, sink); b2 = lerp(b2, SCB[i] * lb, sink); }
      OR[i] = r; OG[i] = g; OB[i] = b2; AMPF[i] = 6;
    }
  }

  /* ================================================================ fireflies */
  const FLIES = [];
  function buildFlies() {
    const picks = [0.2, 0.75, 1.05, 2.35, 2.75, 3.3, 3.9, 4.5, 5.2, 5.75];
    picks.forEach((th, k) => {
      const P = shorePt(th), dx = P[0] - PCX, dy = P[1] - PCY, dl = Math.hypot(dx, dy);
      const o = 2 + ih(k, 1, 700) * 12;
      FLIES.push({ x: P[0] + dx / dl * o, y: P[1] + dy / dl * o, ax: 5 + ih(k, 2, 700) * 9, ay: 4 + ih(k, 3, 700) * 8,
        f1: 1 + fl(ih(k, 4, 700) * 2), f2: 1 + fl(ih(k, 5, 700) * 3), p1: ih(k, 6, 700) * TAU, p2: ih(k, 7, 700) * TAU,
        fb: 3 + fl(ih(k, 8, 700) * 4), pb: ih(k, 9, 700) * TAU });
    });
  }

  /* ================================================================ caustics */
  const HW = 136, HH = 170, NH = HW * HH;
  const CA = new Float32Array(NH), CBh = new Float32Array(NH);
  function layerPts(cell, seed, rad, t) {
    const nx = Math.ceil(HW / cell) + 3, ny = Math.ceil(HH / cell) + 3, P = new Float32Array(nx * ny * 2);
    for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) {
      const k = gy * nx + gx, cx = gx - 1, cy = gy - 1;
      const f = 1 + fl(ih(cx, cy, seed + 2) * 2), ph = ih(cx, cy, seed + 3) * TAU, dir = ih(cx, cy, seed + 4) < 0.5 ? 1 : -1;
      const a = dir * TAU * f * t / D + ph;
      P[k * 2] = (cx + 0.15 + 0.7 * ih(cx, cy, seed)) * cell + Math.cos(a) * rad;
      P[k * 2 + 1] = (cy + 0.15 + 0.7 * ih(cx, cy, seed + 1)) * cell + Math.sin(a) * rad;
    }
    return { P, nx, cell };
  }
  function causticLayer(L, out, add, t, wk) {
    const { P, nx, cell } = L, ph = TAU * t / D;
    for (let hy = 0; hy < HH; hy++) for (let hx = 0; hx < HW; hx++) {
      const x = hx + 0.9 * Math.sin(hy * 0.19 + ph + wk), y = hy + 0.9 * Math.sin(hx * 0.16 - 2 * ph + 1 + wk);
      const gx = fl(x / cell), gy = fl(y / cell);
      let f1 = 1e9, f2 = 1e9;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const k = (gy + oy + 1) * nx + (gx + ox + 1);
        const dx = P[k * 2] - x, dy = P[k * 2 + 1] - y, d = dx * dx + dy * dy;
        if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
      }
      const e = Math.sqrt(f2) - Math.sqrt(f1);
      let b = 1 - e / (cell * 0.2); b = b > 0 ? b * b : 0;
      const j = hy * HW + hx;
      if (add) out[j] += b * 0.62; else out[j] = b;
    }
  }
  function caustics(t) {
    causticLayer(layerPts(9, 900, 2.2, t), CA, false, t, 0);
    CBh.set(CA);
    causticLayer(layerPts(5.5, 950, 1.4, t), CBh, false, t, 2.0);
    for (let j = 0; j < NH; j++) { const a = CA[j], b = CBh[j]; CA[j] = a * 1.1 + b * 0.55 + a * b * 1.2; }
    // full res, bilinear
    for (let y = 0; y < H; y++) {
      const fy = (y + 0.5) / 2 - 0.5, y0 = clamp(fl(fy), 0, HH - 2), ay = clamp(fy - y0, 0, 1);
      for (let x = 0; x < W; x++) {
        const i = y * W + x; if (TYPE[i] !== T_WATER) { CF[i] = 0; continue; }
        const fx = (x + 0.5) / 2 - 0.5, x0 = clamp(fl(fx), 0, HW - 2), ax = clamp(fx - x0, 0, 1);
        const j = y0 * HW + x0;
        CF[i] = lerp(lerp(CA[j], CA[j + 1], ax), lerp(CA[j + HW], CA[j + HW + 1], ax), ay);
        CG[i] = lerp(lerp(CBh[j], CBh[j + 1], ax), lerp(CBh[j + HW], CBh[j + HW + 1], ax), ay);
      }
    }
  }

  // a large soft sheen field, sampled through a window that circles once per loop
  const SM = 10, SW = W + 2 * SM, SH2 = H + 2 * SM, SHEEN = new Float32Array(SW * SH2);
  function buildSheen() {
    for (let y = 0; y < SH2; y++) for (let x = 0; x < SW; x++) {
      const n = fbm2(x * 0.022, y * 0.05, 470, 4), m = fbm2(x * 0.09, y * 0.13, 472, 2);
      SHEEN[y * SW + x] = clamp((n - 0.42) * 2.6, 0, 1) * (0.6 + 0.8 * m);
    }
  }

  /* ================================================================ frame */
  function flick(k, t) {
    const p = TAU * t / D;
    return 1 + 0.045 * Math.sin(p * 5 + k * 2.1) + 0.03 * Math.sin(p * 13 + k * 4.4) + 0.018 * Math.sin(p * 31 + k);
  }
  const AR = 0.42, AG = 0.52, AB = 0.66, WR = 1.8, WG = 1.02, WB = 0.36;
  const ORDER = [];
  function drawFrame(t) {
    t = ((t % D) + D) % D;
    const ph = TAU * t / D;
    const f0 = flick(0, t), f1 = flick(1, t), f2 = flick(2, t), FK = [f0, f1, f2];
    const L0 = LK[0], L1 = LK[1], L2 = LK[2];
    for (let i = 0; i < NP; i++) { const I = f0 * L0[i] + f1 * L1[i] + f2 * L2[i]; LI[i] = I / (1 + 0.38 * I); }
    caustics(t);
    for (let i = 0; i < NP; i++) AMPF[i] = DA_T[TYPE[i]];

    // koi: spines, depth and shadows
    SHM.fill(0);
    ORDER.length = 0;
    for (const k of KOI) {
      spine(k, t);
      k.z = koiZ(k, t);
      const jm = Math.round(k.ns * 0.35), mx = SPX[jm], my = SPY[jm];
      const mi = clamp(fl(my), 0, H - 1) * W + clamp(fl(mx), 0, W - 1);
      // the shadow falls away from the brightest nearby lantern
      let sx = 0.55, sy = 0.8;
      LANTERNS.forEach((Lt, q) => { const dx = mx - Lt.x, dy = my - Lt.y, dl = Math.hypot(dx, dy) || 1; const w = LK[q][mi] * 2.2; sx += dx / dl * w; sy += dy / dl * w; });
      const sl = Math.hypot(sx, sy) || 1;
      const dp = DEP[mi] || 0.3, mag = (5 + 8 * dp) * (1 - 0.5 * k.z);
      drawKoi(k, t, 1, sx / sl * mag, sy / sl * mag, 0.62 + 0.3 * k.z);
      k.sp = { x: SPX.slice(0, k.ns + 1), y: SPY.slice(0, k.ns + 1), tx: STX.slice(0, k.ns + 1), ty: STY.slice(0, k.ns + 1) };
      ORDER.push(k);
    }
    // floating petals add their own small shadows
    const live = [];
    for (const P of PETALS) for (let m = -2; m <= 0; m++) {
      const age = ((t - P.t0) % D + D) % D - m * D;
      if (age < 0 || age > P.fall + P.float + P.sink) continue;
      live.push([P, age]);
      if (age > P.fall) {
        const s = Math.min(P.tx.length - 1, fl((age - P.fall) * 10)), x = fl(P.tx[s] + 3), y = fl(P.ty[s] + 4);
        if (x > 0 && y > 0 && x < W - 1 && y < H - 1) { const i = y * W + x; SHM[i] = Math.max(SHM[i], 0.5); SHM[i + 1] = Math.max(SHM[i + 1], 0.5); }
      }
    }
    blur(SHM, SHB, 2);

    // the base pass: lit garden, bed under water with caustics, depth tint
    const x0s = SM + Math.round(SM * 0.9 * Math.cos(ph)), y0s = SM + Math.round(SM * 0.9 * Math.sin(ph));
    for (let i = 0; i < NP; i++) {
      const I = LI[i];
      const lr = AR + I * WR, lg = AG + I * WG, lb = AB + I * WB;
      const ty = TYPE[i];
      if (ty === T_WATER) {
        const dp = DEP[i];
        const c = CF[i] * (1 - 0.45 * dp);
        const sh = 1 - 0.62 * Math.min(1, SHB[i] + PSH[i] * 0.75);
        const kb = (0.6 + c * (0.95 + 1.6 * I)) * sh;
        const T = TRN[i];
        const s2 = 1 - 0.5 * Math.min(1, SHB[i]), wr = I * Math.sqrt(I);
        // the sky’s last light, broken by a slow drift of surface sheen
        const shn = SHEEN[(y0s + ((i / W) | 0)) * SW + x0s + (i % W)] * (0.4 + 0.6 * dp);
        const rf = REF[i] * FK[REFK[i]] * (0.12 + 2.4 * CG[i] * CG[i]);
        OR[i] = (ALR[i] * kb * T * 0.92 + SCR[i] * (1 - T)) * lr * s2 + wr * 92 + shn * 10 + rf * 120;
        OG[i] = (ALG[i] * kb * T + SCG[i] * (1 - T)) * lg * s2 + wr * 56 + shn * 18 + rf * 70;
        OB[i] = (ALB[i] * kb * T * 0.96 + SCB[i] * (1 - T)) * lb * s2 + wr * 16 + shn * 22 + rf * 22;
      } else if (ty === T_CANOPY) {
        OR[i] = ALR[i] * (0.86 + I * 0.9); OG[i] = ALG[i] * (0.8 + I * 0.6); OB[i] = ALB[i] * (0.86 + I * 0.3);
      } else if (ty === T_LOTUS || ty === T_PAD) {
        const q = ty === T_LOTUS ? 1 : 0.55;
        OR[i] = ALR[i] * (lerp(AR, 0.88, q) + I * WR * 0.8); OG[i] = ALG[i] * (lerp(AG, 0.8, q) + I * WG * 0.8); OB[i] = ALB[i] * (lerp(AB, 0.86, q) + I * WB);
      } else if (ty === T_ROOF) {
        OR[i] = ALR[i] * (AR * 1.35 + 0.08); OG[i] = ALG[i] * (AG * 1.3 + 0.05); OB[i] = ALB[i] * (AB * 1.2);
      } else {
        const wr = I * Math.sqrt(I);
        OR[i] = ALR[i] * lr + wr * 22; OG[i] = ALG[i] * lg + wr * 10; OB[i] = ALB[i] * lb;
      }
    }

    // koi, deepest first
    ORDER.sort((a, b) => b.z - a.z);
    for (const k of ORDER) {
      SPX.set(k.sp.x); SPY.set(k.sp.y); STX.set(k.sp.tx); STY.set(k.sp.ty);
      drawKoi(k, t, 0, 0, 0, 0);
    }

    // raindrop rings, bending round the pads
    for (const Dr of DROPS) {
      const age = ((t - Dr.t0) % D + D) % D;
      if (age > 6.2) continue;
      const r = 1 + 7.4 * age, A0 = Math.exp(-age / 2.1) * Math.min(1, age * 7);
      const { S, x0, y0, g } = Dr;
      for (let ly = 0; ly < S; ly++) {
        const y = y0 + ly; if (y < 0 || y >= H) continue;
        for (let lx = 0; lx < S; lx++) {
          const gd = g[ly * S + lx]; if (gd > 1e8) continue;
          const xx = r - gd; if (xx < -0.6 || xx > 11) continue;
          const x = x0 + lx; if (x < 0 || x >= W) continue;
          const i = y * W + x; if (TYPE[i] !== T_WATER) continue;
          const eu = Math.hypot(lx - Dr.R, ly - Dr.R);
          const wv = Math.sin((xx + 0.6) * 1.45) * Math.exp(-xx / 3.4);
          const a = A0 * wv / (1 + gd / 26) / (1 + (gd - eu) * 0.22);
          const f = 1 + 0.5 * a;
          OR[i] *= f; OG[i] *= f; OB[i] *= f;
          if (a > 0.1) { OR[i] += 64 * a; OG[i] += 92 * a; OB[i] += 96 * a; }
        }
      }
      if (age < 0.3) { const x = fl(Dr.x), y = fl(Dr.y), i = y * W + x; const e = 1 - age / 0.3; OR[i] += 150 * e; OG[i] += 180 * e; OB[i] += 180 * e; }
    }

    // glitter on the lantern pools: the surface catching the flame
    for (let i = 0; i < NP; i++) {
      if (TYPE[i] !== T_WATER) continue;
      const I = LI[i]; if (I < 0.3) continue;
      const g = CG[i], gl = sstep(0.3, 0.95, I) * (g > 0.72 ? (g - 0.72) * 3.6 : 0);
      if (gl > 0.02) { OR[i] += 255 * gl; OG[i] += 205 * gl; OB[i] += 120 * gl; }
    }

    // cherry petals: falling, landing with a ring, drifting, turning and sinking
    for (const [P, age] of live) {
      if (age < P.fall) {
        const q = age / P.fall, e = q * q * (3 - 2 * q);
        const x = lerp(P.sx, P.lx, e) + 5 * Math.sin(q * 7 + P.k), y = lerp(P.sy, P.ly, e) + 2 * Math.cos(q * 5 + P.k);
        petalSprite(x, y, P.a0 + age * 2.2 + Math.sin(age * 3) * 0.6, P.sz * (1.35 - 0.35 * q), 1, 0, true);
      } else {
        const fa = age - P.fall, s = Math.min(P.tx.length - 1, fl(fa * 10)), fr = fa * 10 - fl(fa * 10);
        const s2 = Math.min(P.tx.length - 1, s + 1);
        const x = lerp(P.tx[s], P.tx[s2], fr), y = lerp(P.ty[s], P.ty[s2], fr);
        const sk = sstep(P.float, P.float + P.sink, fa);
        petalSprite(x, y, P.a0 + P.fall * 2.2 + fa * P.spin, P.sz * (1 - 0.15 * sk), 1 - sk, sk * 0.35, false);
        if (fa < 2.6) { // the little landing ring
          const rr = 1 + fa * 4.2, A0 = (1 - fa / 2.6) * 0.8;
          for (let y2 = fl(P.ly - rr - 2); y2 <= P.ly + rr + 2; y2++) for (let x2 = fl(P.lx - rr - 2); x2 <= P.lx + rr + 2; x2++) {
            if (x2 < 0 || y2 < 0 || x2 >= W || y2 >= H) continue;
            const i = y2 * W + x2; if (TYPE[i] !== T_WATER) continue;
            const d = Math.hypot(x2 + 0.5 - P.lx, y2 + 0.5 - P.ly), xx = rr - d;
            if (xx < -0.5 || xx > 4) continue;
            const a = A0 * Math.sin((xx + 0.5) * 1.6) * Math.exp(-xx / 1.6);
            OR[i] *= 1 + 0.45 * a; OG[i] *= 1 + 0.45 * a; OB[i] *= 1 + 0.45 * a;
            if (a > 0.12) { OR[i] += 50 * a; OG[i] += 70 * a; OB[i] += 72 * a; }
          }
        }
      }
    }

    // lantern light escaping under the eaves
    for (let i = 0; i < NP; i++) { const k = EMK[i]; if (k < 0) continue; const f = FK[k]; OR[i] += EMR[i] * f; OG[i] += EMG[i] * f; OB[i] += EMB[i] * f; AMPF[i] = 12; }

    // fireflies
    for (const F of FLIES) {
      const x = F.x + F.ax * Math.sin(ph * F.f1 + F.p1) + 3 * Math.sin(ph * 3 + F.p2), y = F.y + F.ay * Math.sin(ph * F.f2 + F.p2) + 2 * Math.cos(ph * 2 + F.p1);
      const b = Math.pow(Math.max(0, Math.sin(ph * F.fb + F.pb)), 2);
      if (b < 0.03) continue;
      const cx = fl(x), cy = fl(y);
      for (let oy = -6; oy <= 6; oy++) for (let ox = -6; ox <= 6; ox++) {
        const px = cx + ox, py = cy + oy; if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const i = py * W + px; if (TYPE[i] === T_CANOPY) continue;
        const d = Math.hypot(ox, oy);
        if (d < 0.5) { OR[i] = lerp(OR[i], 250, b); OG[i] = lerp(OG[i], 255, b); OB[i] = lerp(OB[i], 190, b); AMPF[i] = 3; continue; }
        if (d < 1.1 && b > 0.45) { OR[i] = lerp(OR[i], 214, b); OG[i] = lerp(OG[i], 240, b); OB[i] = lerp(OB[i], 130, b); AMPF[i] = 4; continue; }
        const gw = b * Math.pow(Math.max(0, 1 - d / 6), 2) * 1.3;
        OR[i] += 80 * gw; OG[i] += 110 * gw; OB[i] += 30 * gw;
      }
    }

    // quantise through the ordered dither
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, am = TYPE[i] === T_WATER && AMPF[i] === 14 ? Math.min(14, 4 + OG[i] * 0.16) : AMPF[i];
      const d = (B8[((y & 7) << 3) | (x & 7)] - 0.5) * am;
      let r = OR[i] + d, g = OG[i] + d, b = OB[i] + d;
      r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
      OUT[i] = LUT[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)];
    }
  }

  /* ================================================================ present */
  let SMALL = null, SG = null, IMG = null, PIX = null, LIVE = null;
  function present(g, cw, ch, k, ox, oy) {
    if (!SMALL) {
      SMALL = document.createElement('canvas'); SMALL.width = W; SMALL.height = H;
      SG = SMALL.getContext('2d'); IMG = SG.createImageData(W, H); PIX = new Uint32Array(IMG.data.buffer);
      LIVE = new Uint32Array(PAL.length);
      for (let q = 0; q < PAL.length; q++) LIVE[q] = (255 << 24) | (PAL[q][2] << 16) | (PAL[q][1] << 8) | PAL[q][0];
    }
    for (let i = 0; i < NP; i++) PIX[i] = LIVE[OUT[i]];
    SG.putImageData(IMG, 0, 0);
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#050d10'; g.fillRect(0, 0, cw, ch);
    g.drawImage(SMALL, ox, oy, W * k, H * k);
  }

  function stats() {
    const out = { koi: [], pairs: [] };
    for (const k of KOI) {
      let m = 1e9; for (let q = 0; q < k.N; q += 2) { const i = clamp(fl(k.PY[q]), 0, H - 1) * W + clamp(fl(k.PX[q]), 0, W - 1); m = Math.min(m, SD[i]); }
      out.koi.push({ name: k.name, len: Math.round(k.Lt), speed: +(k.Lt / D).toFixed(1), minSD: m });
    }
    const pos = (k, t) => { const sh = k.Lt * (k.s0 + k.dir * (k.n * t / D + 0.015 * Math.sin(TAU * t / D * 2 + k.ps))); pathAt(k, sh - k.dir * 0.35 * k.L); return [PA[0], PA[1]]; };
    for (let a = 0; a < KOI.length; a++) for (let b = a + 1; b < KOI.length; b++) {
      let m = 1e9, mt = 0;
      for (let t = 0; t < D; t += 0.1) { const p = pos(KOI[a], t), q = pos(KOI[b], t), d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < m) { m = d; mt = t; } }
      out.pairs.push(KOI[a].name + '-' + KOI[b].name + ' ' + m.toFixed(1) + ' @' + mt.toFixed(1));
    }
    let tot = 0; for (let q = 0; q < 10; q++) { const t0 = performance.now(); drawFrame(q * 2.1); tot += performance.now() - t0; }
    out.ms = +(tot / 10).toFixed(1);
    return out;
  }
  function build() {
    buildLUT();
    paintPond();
    paintGround();
    paintRocks();
    paintBed();
    paintPads();
    paintLotus();
    paintCanopy();
    paintPlants();
    paintLanterns();
    finishStatic();
    for (const Dr of DROPS) geodesic(Dr);
    for (const k of KOI) buildPath(k);
    buildPetals();
    buildFlies();
    buildSheen();
  }

  /* ================================================================ mount */
  (window.PIECES = window.PIECES || []).push({
    id: 'koi-garden',
    title: 'Koi Garden',
    medium: 'Pixel art in 48 colours, 270 × 338, animated in JavaScript · 24 s loop',
    note: 'Six koi, three lanterns, one slow evening · tap to pause',
    about: 'A koi pond seen from straight above as the light goes, lit by three stone lanterns. Six koi, a kohaku, a showa, a gold yamabuki, a plain white, a platinum ogon and a little tancho, glide on long closed loops with their bodies bending along the way and their tails slowly sculling, each trailing a soft shadow across the river stones. Caustics wander over the bed, the middle falls away dark and green, cherry petals drop, drift and sink, now and then a single raindrop rings out and bends round the lily pads, and fireflies wander over the mossy rocks.',
    tone: 'dark',
    room: '#050d10',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0, built = false;
      el.style.background = '#050d10';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;image-rendering:pixelated;image-rendering:crisp-edges;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(242,246,255,.8)"/><rect x="19" y="9" width="5" height="16" fill="rgba(242,246,255,.8)"/></svg>';
      el.appendChild(pauseMark);
      let K = 4, CW = W * 4, CH = H * 4, OX = 0, OY = 0;
      function layout() {
        const dpr = Math.min(3, window.devicePixelRatio || 1);
        let left = 0, top = 0, cssW, cssH;
        if (EXPORT) {
          cssW = 1080; cssH = 1350; cv.style.position = 'fixed';
          K = Math.max(1, Math.round(4 * dpr)); CW = Math.round(1080 * dpr); CH = Math.round(1350 * dpr);
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
      const draw = (t) => { drawFrame(t); present(g, CW, CH, K, OX, OY); };
      layout();
      if (!KOI[0].PX) build();
      built = true;
      draw(0);
      if (EXPORT) {
        const faded = () => { const st = el.parentElement; return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999; };
        window.__koigarden = {
          duration: D,
          isReady: () => built && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); draw(t); window.__koigarden.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          lastMs: 0,
          stats,
        };
        document.documentElement.dataset.ready = 'koi-garden';
        api.ready();
      } else {
        window.__koigarden = { duration: D, isReady: () => built, renderAt(t) { return new Promise((res) => { playing = false; clock = t; draw(t); requestAnimationFrame(() => res()); }); } };
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
          if (window.__koigarden) delete window.__koigarden;
        },
      };
    },
  });
})();
