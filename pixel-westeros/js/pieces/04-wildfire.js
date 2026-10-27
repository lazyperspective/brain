/* Wildfire — A Song of Pixels, piece 4.
 *
 * A dark bay at night: a walled city on the cliffs to the left with a few warm windows, a low headland to
 * the right, a chain boom floating across the water between two towers, and a fleet of small anonymous
 * ship silhouettes riding at anchor. A green pot arcs down from the walls, and alchemical fire blooms from
 * that one point: a front spreads across spilled oil, races along slicks, climbs masts and sails, and at a
 * pool where the slicks meet it erupts in a white-green fireball that rolls up into a mushroom of flame.
 * Then it burns down into floating embers and smoke, the smoke thins away, and the calm night returns
 * before the next pot falls.
 *
 * Everything is a pure function of t on a 270 × 338 grid (shown at 4×). At mount the water is laid out in
 * perspective, the oil and slicks are painted on it, and a Dijkstra pass over the water pixels gives every
 * pixel the time the fire reaches it. A frame then lights the burning water as flame sources, rasterises the
 * ships far to near (their sails become sources once the fire climbs them), and grows every flame upward in
 * one row-by-row pass whose sideways offsets and scrolling noise make the tongues lick and curl. The fireball,
 * thousands of sparks, embers and smoke are particles. Upright light is mirrored about its own waterline and
 * read back through the rippled water; the light of the fire is pooled into a soft glow map that tints sky,
 * smoke, stone and wave crests. The image is quantised to a 33-colour palette with 4 × 4 ordered dither.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 270, H = 338, N = W * H, D = 20;
  const TAU = Math.PI * 2;
  const fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const pmod = (v, m) => ((v % m) + m) % m;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul((c | 0) + 7919, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  /* ---------------------------------------------------------------- the scene */
  const YH = 168, Y0 = 2, FOC = 160, CXS = 135;   // horizon row, perspective offset, focal length, centre column
  const IGN = 1.2;                                // the pot lands
  const TFB = 4.7;                                // the eruption
  const IGX = 112, IGY = 246;                     // ignition point
  const FBX = 160, FBY = 207;                     // eruption point
  const WIND = 7;                                 // px / s, to the right

  /* ================================================================ palette (33) */
  const PAL_HEX = [
    '020207', '05060f', '090b1b', '0e1128', '141936', '1c2246', '262e5a', '333d70', '455088', // 0-8 night indigo
    '8d96c8', 'dde3fa',                                                                       // 9-10 stars
    'ffe6a8', 'f2ad4e', 'b8642c', '5e3020',                                                   // 11-14 warm windows
    '10181e', '1a2629', '263634', '354a44', '4a6458',                                         // 15-19 smoke
    '0a1628', '0e2234', '133040', '183a4c', '22504e',                                         // 20-24 teal night
    '05262a', '073a38', '0a5244', '0d6e4e', '109456', '1cbc62', '44de80', '86f2aa', 'c6fcd6', 'f4fff6', // 23-32 wildfire
  ];
  const PAL = PAL_HEX.map((h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
  const FR0 = 25, NFR = 10;
  const FLUM = new Float32Array(NFR);
  for (let k = 0; k < NFR; k++) { const p = PAL[FR0 + k]; FLUM[k] = 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]; }
  // background quantiser: a 64³ table indexed in square-root space, so the darks get most of the resolution
  const LUT = new Uint8Array(64 * 64 * 64);
  const SQ = new Uint8Array(1024);               // value (0..1023 in quarter steps of 0..255) → sqrt index
  function buildLUT() {
    const ps = PAL.map((p) => p.map((v) => Math.sqrt(v / 255)));
    for (let r = 0; r < 64; r++) for (let g = 0; g < 64; g++) for (let b = 0; b < 64; b++) {
      const R = r / 63, G = g / 63, B = b / 63;
      let best = 0, bd = 1e9;
      for (let k = 0; k < ps.length; k++) {
        if (k >= 11 && k <= 14) continue;           // warm only on purpose
        const p = ps[k], dr = R - p[0], dg = G - p[1], db = B - p[2];
        const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
        if (d < bd) { bd = d; best = k; }
      }
      LUT[(r << 12) | (g << 6) | b] = best;
    }
    for (let v = 0; v < 1024; v++) SQ[v] = Math.round(Math.sqrt(v / 1023) * 63);
  }

  const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bay = (x, y) => B4[((y & 3) << 2) | (x & 3)];

  /* ================================================================ noise */
  // rank-equalised, tileable value-noise fbm: values are uniform in 0..1
  function makeNoise(size, cells, seed) {
    const T = new Float32Array(size * size), rnd = mulberry32(seed);
    let amp = 1;
    for (const c of cells) {
      const g = size / c, G = new Float32Array(g * g);
      for (let k = 0; k < g * g; k++) G[k] = rnd();
      for (let y = 0; y < size; y++) {
        const gy = y / c, iy = fl(gy), f0 = gy - iy, fy = f0 * f0 * (3 - 2 * f0), r0 = (iy % g) * g, r1 = ((iy + 1) % g) * g;
        for (let x = 0; x < size; x++) {
          const gx = x / c, ix = fl(gx), e0 = gx - ix, fx = e0 * e0 * (3 - 2 * e0), c0 = ix % g, c1 = (ix + 1) % g;
          const a = G[r0 + c0], b = G[r0 + c1], cc = G[r1 + c0], d = G[r1 + c1];
          T[y * size + x] += amp * ((a + (b - a) * fx) * (1 - fy) + (cc + (d - cc) * fx) * fy);
        }
      }
      amp *= 0.55;
    }
    const idx = Array.from({ length: size * size }, (_, k) => k).sort((p, q) => T[p] - T[q]);
    const out = new Float32Array(size * size);
    idx.forEach((k, r) => { out[k] = r / (size * size - 1); });
    return out;
  }
  let NA = null, NB = null, NC = null;
  function nA(x, y) {
    const xf = Math.floor(x), yf = Math.floor(y), fx = x - xf, fy = y - yf;
    const x0 = xf & 255, x1 = (xf + 1) & 255, y0 = (yf & 255) << 8, y1 = ((yf + 1) & 255) << 8;
    const a = NA[y0 + x0], b = NA[y0 + x1], c = NA[y1 + x0], d = NA[y1 + x1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function nC(x, y) {
    const xf = Math.floor(x), yf = Math.floor(y), fx = x - xf, fy = y - yf;
    const x0 = xf & 63, x1 = (xf + 1) & 63, y0 = (yf & 63) << 6, y1 = ((yf + 1) & 63) << 6;
    const a = NC[y0 + x0], b = NC[y0 + x1], c = NC[y1 + x0], d = NC[y1 + x1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function nB(x, y) {
    const xf = Math.floor(x), yf = Math.floor(y), fx = x - xf, fy = y - yf;
    const x0 = xf & 63, x1 = (xf + 1) & 63, y0 = (yf & 63) << 6, y1 = ((yf + 1) & 63) << 6;
    const a = NB[y0 + x0], b = NB[y0 + x1], c = NB[y1 + x0], d = NB[y1 + x1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  /* ================================================================ land, city, water geometry */
  const FOOT = new Int16Array(W);     // first water row per column
  const TOP = new Int16Array(W);      // first land row per column (FOOT where there is no land)
  const FAR = new Uint8Array(N);      // 0 sky, 1 rock, 2 building, 3 window, 4 tower (chain), 5 headland
  const WINID = new Int16Array(N).fill(-1);
  const RIM = new Float32Array(N);    // how much a land pixel faces the bay
  const ZR = new Float32Array(H);     // plane depth per water row
  const PXA = new Float32Array(N), PZA = new Float32Array(N);
  let NWIN = 0;
  const WINPH = [], WINRT = [], WINLV = [];

  function buildLand() {
    const rnd = mulberry32(4242);
    for (let x = 0; x < W; x++) {
      let foot = YH, top = YH;
      if (x < 126) {
        const u = 1 - x / 126;
        foot = Math.round(YH + 50 * Math.pow(u, 1.15) + 1.5 * Math.sin(x * 0.7) * u);
        let ct = 116 + x * 0.17 + 3 * Math.sin(x * 0.11) + 1.5 * Math.sin(x * 0.37);
        if (x > 100) ct = lerp(ct, foot, Math.pow((x - 100) / 26, 0.8));
        top = Math.round(Math.min(ct, foot));
      } else if (x > 194) {
        const u = (x - 194) / 76;
        foot = Math.round(YH + 17 * Math.pow(u, 1.1));
        top = Math.round(YH - 24 * Math.pow(u, 0.7) - 2 * Math.sin(x * 0.21) * u - 1.2 * Math.sin(x * 0.6));
      }
      FOOT[x] = Math.max(YH, foot); TOP[x] = Math.min(top, FOOT[x]);
      for (let y = TOP[x]; y < FOOT[x]; y++) FAR[y * W + x] = x < 126 ? 1 : 5;
    }
    const put = (x, y, v) => { if (x >= 0 && x < W && y >= 0 && y < H) FAR[y * W + x] = v; };
    const rect = (x0, y0, x1, y1, v) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, v); };
    const bottomAt = (x) => TOP[clamp(x, 0, W - 1)] + 3;
    // houses behind the wall, many small blocks climbing the hill
    for (let k = 0; k < 70; k++) {
      const cx = 2 + fl(rnd() * 104), w = 3 + fl(rnd() * 6);
      const hh = 5 + fl(rnd() * (6 + 10 * Math.sin(Math.PI * cx / 110)));
      const b = bottomAt(cx), t0 = b - 6 - hh;
      rect(cx - (w >> 1), t0, cx + (w >> 1), b, 2);
      const roof = rnd();
      if (roof < 0.45) for (let r = 1; r <= (w >> 1) + 1; r++) rect(cx - (w >> 1) + r - 1, t0 - r, cx + (w >> 1) - r + 1, t0 - r, 2);
      else if (roof < 0.6) { rect(cx - (w >> 1) + 1, t0 - 2, cx + (w >> 1) - 1, t0 - 1, 2); put(cx, t0 - 3, 2); }
    }
    // the wall along the cliff edge, crenellated
    for (let x = 0; x <= 104; x++) {
      const tp = TOP[x];
      for (let y = tp - 7; y < tp + 2; y++) put(x, y, 2);
      if (x % 4 < 2) put(x, tp - 8, 2);
    }
    // towers and the great dome
    const towers = [
      { cx: 6, w: 6, top: 86, roof: 0 }, { cx: 19, w: 5, top: 78, roof: 1 }, { cx: 31, w: 4, top: 66, roof: 2 },
      { cx: 66, w: 5, top: 74, roof: 1 }, { cx: 79, w: 4, top: 50, roof: 2 }, { cx: 92, w: 6, top: 84, roof: 0 }, { cx: 104, w: 5, top: 100, roof: 1 },
    ];
    for (const tw of towers) {
      const b = bottomAt(tw.cx), x0 = tw.cx - (tw.w >> 1), x1 = x0 + tw.w - 1;
      rect(x0, tw.top, x1, b, 2);
      if (tw.roof === 1) { for (let x = x0 - 1; x <= x1 + 1; x++) { put(x, tw.top, 2); put(x, tw.top + 1, 2); if ((x - x0) % 2 === 0) put(x, tw.top - 1, 2); } }
      else if (tw.roof === 0) { const hw = (tw.w >> 1) + 1; for (let r = 0; r < 9; r++) { const ww = Math.round(hw * (1 - r / 9)); rect(tw.cx - ww, tw.top - r, tw.cx + ww - (tw.w % 2 ? 0 : 1), tw.top - r, 2); } }
      else { for (let r = 0; r < 16; r++) { const ww = r < 3 ? 1 : 0; rect(tw.cx - ww, tw.top - r, tw.cx + ww, tw.top - r, 2); } }
      // windows: a few lit rows
      for (let y = tw.top + 4; y < b - 8; y += 5 + fl(rnd() * 4)) {
        if (rnd() < 0.5) continue;
        const wx = x0 + 1 + fl(rnd() * Math.max(1, tw.w - 2));
        winAt(wx, y, rnd); if (rnd() < 0.5) winAt(wx, y + 1, rnd, NWIN - 1);
      }
    }
    // the great dome on its drum
    {
      const cx = 49, b = bottomAt(cx), drum = 84;
      rect(cx - 11, drum, cx + 11, b, 2);
      for (let y = 0; y <= 12; y++) { const ww = Math.round(Math.sqrt(Math.max(0, 1 - (y / 12) * (y / 12))) * 11); rect(cx - ww, drum - y, cx + ww, drum - y, 2); }
      rect(cx - 1, drum - 17, cx + 1, drum - 12, 2); put(cx, drum - 18, 2); put(cx, drum - 19, 2); put(cx, drum - 20, 2);
      for (const dx of [-17, 17]) { const c2 = cx + dx; rect(c2 - 3, drum + 4, c2 + 3, b, 2); for (let y = 0; y <= 4; y++) { const ww = Math.round(Math.sqrt(Math.max(0, 1 - (y / 4) * (y / 4))) * 3); rect(c2 - ww, drum + 4 - y, c2 + ww, drum + 4 - y, 2); } put(c2, drum - 1, 2); put(c2, drum - 2, 2); }
      for (let x = cx - 9; x <= cx + 9; x += 3) { winAt(x, drum + 5, rnd); winAt(x, drum + 6, rnd, NWIN - 1); }
    }
    // windows in the houses
    for (let k = 0; k < 46; k++) {
      const x = 2 + fl(rnd() * 104), b = TOP[x];
      for (let y = b - 18; y < b - 2; y++) {
        if (FAR[y * W + x] === 2 && FAR[(y - 1) * W + x] === 2 && FAR[y * W + x - 1] === 2 && FAR[y * W + x + 1] === 2 && rnd() < 0.18) { winAt(x, y, rnd); break; }
      }
    }
    // the chain towers: one at the cliff foot, one on the headland
    rect(70, 156, 75, FOOT[72] - 1, 4); for (let x = 69; x <= 76; x++) { put(x, 155, 4); if (x % 2) put(x, 154, 4); }
    winAt(72, 162, rnd); winAt(73, 170, rnd);
    rect(230, 140, 235, FOOT[232] - 1, 4); for (let x = 229; x <= 236; x++) { put(x, 139, 4); if (x % 2 === 0) put(x, 138, 4); }
    winAt(232, 146, rnd);
    // light from the bay: faces that look right and down catch it
    for (let y = 0; y < YH + 60; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, f = FAR[i];
      if (!f || f === 3) continue;
      let r = 0;
      for (let d = 1; d <= 3; d++) { if (x + d < W && FAR[i + d] === 0) { r = Math.max(r, 1 - (d - 1) * 0.35); break; } }
      if (f === 1 || f === 5) r = Math.max(r * 0.8, 0.22 + 0.35 * sstep(TOP[x], FOOT[x], y));
      RIM[i] = r;
    }
  }
  function winAt(x, y, rnd, same) {
    const i = y * W + x;
    FAR[i] = 3;
    if (same !== undefined) { WINID[i] = same; return; }
    WINID[i] = NWIN++;
    WINPH.push(rnd() * TAU); WINRT.push(1 + fl(rnd() * 4)); WINLV.push(rnd());
  }

  function buildWaterGeometry() {
    for (let y = YH; y < H; y++) ZR[y] = FOC / (y - YH + Y0);
    for (let y = YH; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      PZA[i] = ZR[y]; PXA[i] = (x + 0.5 - CXS) * ZR[y] / FOC;
    }
  }
  const toPlane = (x, y) => { const Z = FOC / (y - YH + Y0); return [(x + 0.5 - CXS) * Z / FOC, Z]; };
  const isWater = (x, y) => x >= 0 && x < W && y < H && y >= FOOT[x];

  /* ================================================================ oil, slicks and arrival times */
  const OIL = new Float32Array(N), ARR = new Float32Array(N).fill(1e9), LB = new Float32Array(N);
  let WLIST = null;                    // water pixels that can burn, sorted by arrival time
  let WARR = null;
  // slicks: screen polylines, speed in plane units per second, width in plane units
  const SLICKS = [
    { p: [[IGX, IGY], [126, 236], [141, 226], [150, 216], [FBX, FBY]], v: 0.95, w: 0.07 },
    { p: [[IGX, IGY], [140, 258], [170, 266], [200, 282], [236, 300], [270, 306]], v: 1.4, w: 0.08 },
    { p: [[FBX, FBY], [178, 203], [200, 205], [230, 213], [270, 216]], v: 1.0, w: 0.06 },
    { p: [[IGX, IGY], [92, 236], [70, 228], [44, 236], [20, 254], [0, 270]], v: 1.3, w: 0.07 },
    { p: [[IGX, IGY], [104, 268], [86, 296], [64, 322], [52, 338]], v: 1.2, w: 0.09 },
    { p: [[FBX, FBY], [150, 200], [136, 196], [120, 194], [100, 196], [86, 192]], v: 1.5, w: 0.05 },
    { p: [[FBX, FBY], [170, 198], [190, 194], [210, 189], [222, 184]], v: 1.5, w: 0.05 },
  ];
  // the boom
  const CHAIN = [];
  function buildChain() {
    const ax = 84, ay = 191, bx = 222, by = 180;
    for (let k = 0; k <= 200; k++) {
      const s = k / 200, x = lerp(ax, bx, s), y = lerp(ay, by, s) + 10 * Math.sin(Math.PI * s) + 1.2 * Math.sin(s * 9);
      CHAIN.push([x, y]);
    }
  }

  function buildOil() {
    const segs = SLICKS.map((s) => s.p.map(([x, y]) => toPlane(x, Math.max(y, YH + 1))));
    const [igX, igZ] = toPlane(IGX, IGY), [fbX, fbZ] = toPlane(FBX, FBY);
    const SL = new Float32Array(N); // slick speed where on a slick
    for (let y = YH; y < H; y++) for (let x = 0; x < W; x++) {
      if (!isWater(x, y)) continue;
      const i = y * W + x, X = PXA[i], Z = PZA[i];
      // patchy oil: noise in the plane, thinning out with distance from the ignition and the eruption
      const dI = Math.hypot(X - igX, (Z - igZ) * 0.8), dF = Math.hypot(X - fbX, (Z - fbZ) * 0.7);
      const n = nA(X * 34 + 11, Z * 34 + 40), n2 = nA(X * 90 + 70, Z * 90 + 3);
      let oil = sstep(0.4, 0.6, n * 0.75 + n2 * 0.25 + 0.42 - 0.17 * Math.min(dI, dF * 1.2));
      if (dI < 0.3) oil = 1;
      if (dF < 0.45) oil = Math.max(oil, 1 - sstep(0.3, 0.45, dF));
      // slicks
      let best = 0;
      SLICKS.forEach((s, k) => {
        const P = segs[k];
        let dm = 1e9;
        for (let j = 0; j < P.length - 1; j++) {
          const ax = P[j][0], az = P[j][1], bx = P[j + 1][0], bz = P[j + 1][1];
          const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz;
          const u = clamp(((X - ax) * vx + (Z - az) * vz) / l2, 0, 1);
          const d = Math.hypot(X - ax - u * vx, Z - az - u * vz);
          if (d < dm) dm = d;
        }
        const wv = s.w * (0.6 + 0.8 * nA(X * 20 + k * 37, Z * 20));
        if (dm < wv) { oil = Math.max(oil, 0.85); if (s.v > best) best = s.v; }
      });
      OIL[i] = oil; SL[i] = best;
      LB[i] = 4.5 + 6.5 * nA(X * 14 + 90, Z * 14 + 120);
    }
    // the boom carries a slick of its own
    for (const [cx, cy] of CHAIN) {
      const x = Math.round(cx), y = Math.round(cy);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!isWater(x + dx, y + dy)) continue;
        const i = (y + dy) * W + x + dx; OIL[i] = Math.max(OIL[i], 0.8); SL[i] = 2.2;
      }
    }
    // Dijkstra over the water pixels
    const heapI = new Int32Array(N * 4), heapK = new Float64Array(N * 4);
    let hn = 0;
    const push = (i, k) => {
      let c = hn++;
      while (c > 0) { const p = (c - 1) >> 1; if (heapK[p] <= k) break; heapI[c] = heapI[p]; heapK[c] = heapK[p]; c = p; }
      heapI[c] = i; heapK[c] = k;
    };
    const pop = () => {
      const ri = heapI[0], rk = heapK[0]; hn--;
      const li = heapI[hn], lk = heapK[hn];
      let c = 0;
      for (;;) {
        let m = 2 * c + 1; if (m >= hn) break;
        if (m + 1 < hn && heapK[m + 1] < heapK[m]) m++;
        if (heapK[m] >= lk) break;
        heapI[c] = heapI[m]; heapK[c] = heapK[m]; c = m;
      }
      heapI[c] = li; heapK[c] = lk;
      popK = rk; return ri;
    };
    let popK = 0;
    const speed = (i) => SL[i] > 0 ? SL[i] : OIL[i] > 0.3 ? 0.42 * (0.6 + 0.8 * nA(PXA[i] * 25 + 5, PZA[i] * 25 + 9)) : 0.06;
    const s0 = IGY * W + IGX;
    ARR[s0] = 0; push(s0, 0);
    const done = new Uint8Array(N);
    while (hn > 0) {
      const i = pop(), k = popK;
      if (done[i]) continue;
      done[i] = 1;
      const x = i % W, y = (i - x) / W, si = speed(i);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (!dx && !dy) continue;
        const adx = dx < 0 ? -dx : dx, ady = dy < 0 ? -dy : dy;
        if (adx + ady > 3 || (adx === 2 && ady === 0) || (ady === 2 && adx === 0) || (adx === 2 && ady === 2)) continue;
        const xx = x + dx, yy = y + dy;
        if (!isWater(xx, yy)) continue;
        const j = yy * W + xx;
        if (done[j]) continue;
        const dist = Math.hypot(PXA[j] - PXA[i], PZA[j] - PZA[i]);
        const nk = k + dist / (0.5 * (si + speed(j)));
        if (nk < ARR[j]) { ARR[j] = nk; push(j, nk); }
      }
    }
    // a little ragged noise on the front
    for (let i = 0; i < N; i++) if (ARR[i] < 1e8 && ARR[i] > 0.15) ARR[i] += 0.5 * (nA(PXA[i] * 60 + 3, PZA[i] * 60 + 77) - 0.5) * Math.min(1, ARR[i]);
    // the burnable list
    const L = [];
    for (let i = 0; i < N; i++) if (OIL[i] > 0.3 && ARR[i] < 14) L.push(i);
    L.sort((a, b) => ARR[a] - ARR[b]);
    WLIST = Int32Array.from(L); WARR = Float32Array.from(L.map((i) => ARR[i]));
  }
  const ENV = (tau) => 1 - sstep(10, 15.5, tau);
  // steady burn intensity of a water pixel at fire-time tau (no flicker)
  function burnAt(i, tau) {
    const la = tau - ARR[i];
    if (la < 0) return 0;
    const o = OIL[i];
    return (1.4 * Math.exp(-la / 0.3) * Math.sqrt(o) + o * sstep(0, 0.5, la) * (1 - sstep(LB[i] - 2.5, LB[i], la))) * ENV(tau);
  }
  function countBefore(tau) { let lo = 0, hi = WARR.length; while (lo < hi) { const m = (lo + hi) >> 1; if (WARR[m] <= tau) lo = m + 1; else hi = m; } return lo; }

  /* ================================================================ ships */
  // x, y: waterline centre; k: 0 two masts, 1 single lateen, 2 three masts; d: facing
  const SHIPS = [
    { x: 142, y: 176, k: 1, d: 1 }, { x: 179, y: 177, k: 0, d: -1 }, { x: 116, y: 181, k: 0, d: 1 }, { x: 205, y: 183, k: 1, d: -1 },
    { x: 104, y: 207, k: 0, d: 1 }, { x: 208, y: 212, k: 2, d: -1 }, { x: 247, y: 221, k: 0, d: -1 }, { x: 60, y: 225, k: 1, d: 1 },
    { x: 186, y: 259, k: 2, d: 1 }, { x: 76, y: 272, k: 0, d: -1 }, { x: 252, y: 292, k: 2, d: -1 }, { x: 28, y: 326, k: 2, d: 1 },
    { x: 140, y: 312, k: 1, d: -1 },
  ];
  function buildShips() {
    SHIPS.forEach((s, j) => {
      s.u = (s.y - YH + Y0) / 40;
      s.ph = ih(j, 3, 1) * TAU; s.ph2 = ih(j, 3, 2) * TAU;
      // the ship catches from the burning oil around it
      let a = 1e9;
      const r = Math.max(2, Math.round(5 * s.u));
      for (let dy = -2; dy <= 3; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = s.x + dx, y = s.y + dy;
        if (!isWater(x, y)) continue;
        const i = y * W + x;
        if (OIL[i] > 0.4 && ARR[i] < a) a = ARR[i];
      }
      s.arr = a < 12 && s.u < 2.6 ? a + 0.25 : 1e9;    // the nearest hulls stay dark, framing the fire
      s.dur = 6 + 3 * ih(j, 3, 4);
      s.climb = (6 + 5 * ih(j, 3, 5));
    });
  }

  /* ================================================================ frame buffers */
  const SRC = new Float32Array(N), SRCB = new Int16Array(N), SRCR = new Float32Array(N);
  const FLV = new Float32Array(N), FLB = new Int16Array(N), FLR = new Float32Array(N), FL0 = new Float32Array(N);
  const SHIPB = new Int16Array(N), SHIPC = new Uint8Array(N);
  const E = new Float32Array(N), R0E = new Float32Array(N), R0S = new Uint8Array(N), SM = new Float32Array(N);
  const CR = new Float32Array(N), CG = new Float32Array(N), CB = new Float32Array(N);
  const OUT = new Uint8Array(N);
  const GS = 6, GW = Math.ceil(W / GS) + 1, GH = Math.ceil(H / GS) + 1;
  const GA = new Float32Array(GW * GH), GT = new Float32Array(GW * GH), GL = new Float32Array(GW * GH);
  const GS2 = 18, GW2 = Math.ceil(W / GS2) + 1, GH2 = Math.ceil(H / GS2) + 1;
  const GB = new Float32Array(GW2 * GH2), GBT = new Float32Array(GW2 * GH2);
  const GLOW = new Float32Array(N);

  // emission splat with occlusion by nearer ships and a mirror image about its own waterline
  function addE(x, y, e, base, refl) {
    x = fl(x); y = fl(y);
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = y * W + x;
    if (SHIPB[i] > base) return;
    E[i] += e;
    if (refl && y < base) { const ry = 2 * base - y; if (ry < H) R0E[ry * W + x] += e * refl; }
  }
  function discE(cx, cy, r, e, base, refl, sm) {
    const x0 = Math.max(0, fl(cx - r)), x1 = Math.min(W - 1, fl(cx + r)), y0 = Math.max(0, fl(cy - r)), y1 = Math.min(H - 1, fl(cy + r));
    const r2 = r * r;
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx, q = (dx * dx + dy * dy) / r2;
        if (q >= 1) continue;
        const i = y * W + x, w = 1 - q;
        if (SHIPB[i] > base) continue;
        if (sm > 0) SM[i] += sm * w;
        if (e > 0) {
          E[i] += e * w;
          if (refl && y < base) { const ry = 2 * base - y; if (ry < H) R0E[ry * W + x] += e * w * refl; }
        }
      }
    }
  }

  /* ================================================================ water surface fire */
  function surfaceFire(t) {
    const tau = t - IGN;
    if (tau < 0 || tau > 16.5) return;
    const env = ENV(tau);
    const o1 = 256 * t / D, o2 = 512 * t / D;
    for (let k = 0; k < WLIST.length; k++) {
      if (WARR[k] > tau) break;
      const i = WLIST[k], la = tau - ARR[i], o = OIL[i];
      const front = 1.6 * Math.exp(-la / 0.32) * Math.sqrt(o);
      const body = o * sstep(0, 0.5, la) * (1 - sstep(LB[i] - 2.5, LB[i], la));
      if (front + body < 0.02) continue;
      const X = PXA[i], Z = Math.min(PZA[i], 9);
      const f1 = nA(X * 22 - o1, Z * 55 + 0.6 * nA(X * 30 + o2, Z * 30) * 20), f2 = nA(X * 60 + o2, Z * 90 - o1);
      const flick = 0.06 + 1.9 * sstep(0.45, 0.85, f1 * 0.7 + f2 * 0.4);
      const S = (front + body * flick * 0.95) * env;
      if (S < 0.05) continue;
      const y = (i / W) | 0;
      if (SHIPB[i] > y) continue;
      E[i] += S * 0.55 * (1 + 0.2 * S);
    }
  }

  /* ================================================================ flame tongues on the water */
  // thousands of tongue sprites, each anchored on a burning pixel for one short life, then re-anchored;
  // each slot lives an integer number of times per loop
  let TG = null;
  function buildTongues() {
    const rnd = mulberry32(3131), tg = [];
    for (let k = 0; k < 7000; k++) tg.push([20 + fl(rnd() * 26), rnd(), rnd(), rnd(), rnd() * TAU, rnd()]);
    TG = tg;
  }
  function tongues(t) {
    const tau = t - IGN;
    if (tau < 0 || tau > 16.5) return;
    for (let k = 0; k < TG.length; k++) {
      const p = TG[k], nk = p[0], L = D / nk;
      const u = t / L + p[1], cyc = fl(u), age = u - cyc;
      const tc = pmod((cyc - p[1]) * L, D) - IGN;
      if (tc < 0) continue;
      const cnt = countBefore(tc);
      if (!cnt) continue;
      const i = WLIST[fl(ih(k, cyc % nk, 77) * cnt)];
      const S = burnAt(i, tc + age * L);
      if (S < 0.08) continue;
      const b = (i / W) | 0, x0 = (i % W) + 0.5, sc = b - YH + Y0;
      const Sc = Math.min(S, 2.2);
      const hmax = (0.05 + 0.13 * Sc) * Math.pow(sc, 0.85) * (0.55 + 0.9 * p[2]);
      const wd = Math.max(0.55, (0.008 + 0.008 * Sc) * sc * (0.7 + 0.6 * p[3]));
      const h = hmax * sstep(0, 0.3, age);
      const lift = hmax * 0.9 * Math.pow(sstep(0.4, 1, age), 1.5);
      const fade = 1 - sstep(0.55, 1, age);
      const curl = wd * 1.8, ph = p[4] + 7 * age;
      const ef = 1.25 * Math.min(S, 1.8) * fade * (0.7 + 0.6 * p[5]);
      if (h < 0.6 || ef < 0.05) continue;
      const yb = b - lift;
      const y1 = fl(yb), y0 = fl(yb - h);
      for (let y = y1; y >= y0; y--) {
        if (y < 0 || y >= H) continue;
        const r = clamp((yb - y - 0.5) / h, 0, 1);
        const hw = wd * Math.pow(Math.sin(Math.PI * (0.18 + 0.82 * r)), 0.8) * Math.pow(1 - r, 0.25) * (r < 0.18 && lift < 0.5 ? 1 : 1);
        if (hw < 0.3) continue;
        const xc = x0 + curl * Math.pow(r, 1.4) * Math.sin(ph + r * 2.6);
        const xa = Math.max(0, Math.ceil(xc - hw - 0.5)), xb = Math.min(W - 1, fl(xc + hw - 0.5));
        const er = ef * (1.05 - 0.75 * r);
        for (let x = xa; x <= xb; x++) {
          const d = Math.abs(x + 0.5 - xc) / hw;
          if (d >= 1) continue;
          const j = y * W + x;
          if (SHIPB[j] > b) continue;
          const e = er * (1 - d * d);
          E[j] += e;
          if (y < b) { const ry = 2 * b - y; if (ry < H) R0E[ry * W + x] += e * 0.8; }
        }
      }
    }
  }

  /* ================================================================ ships and the boom */
  function shipPix(x, y, base, c, src, hs) {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = y * W + x;
    if (SHIPB[i] > base) return;
    SHIPB[i] = base; SHIPC[i] = c;
    if (src > 0.04) { const tl = nB(x * 0.3 + 11, y * 0.1 + FLT); SRC[i] = src; SRCB[i] = base; SRCR[i] = src / Math.max(2, hs * (0.2 + 1.6 * tl * tl) * (0.5 + 0.3 * Math.min(src, 2))); }
    else if (SRCB[i] < base) SRC[i] = 0;
    if (y < base) { const ry = 2 * base - y; if (ry < H) R0S[ry * W + x] = 1; }
  }
  let FLT = 0;
  function drawShips(t) {
    FLT = 64 * 3 * t / D;
    const tau = t - IGN, env = ENV(tau);
    for (let j = 0; j < SHIPS.length; j++) {
      const s = SHIPS[j], u = s.u;
      const bob = 0.35 * u * Math.sin(TAU * 2 * t / D + s.ph) + 0.25 * u * Math.sin(TAU * 3 * t / D + s.ph2);
      const y0 = s.y + bob, base = Math.round(y0);
      const rock = 0.045 * Math.sin(TAU * 2 * t / D + s.ph + 1.3) + 0.02 * Math.sin(TAU * 5 * t / D + s.ph2);
      const la = tau - s.arr;
      const burning = la > 0 && la < s.dur + 3;
      const sEnv = burning ? env * (1 - sstep(s.dur - 1.5, s.dur + 2, la)) : 0;
      const climb = burning ? la * s.climb : -1;     // burnt height in hull units
      const rate = 3 + 5 * u;              // flame height scale in px
      const L = 6, hh = 2.2;
      const masts = s.k === 1 ? [[0.8, 12]] : s.k === 0 ? [[-1.4, 13], [3.0, 10.5]] : [[-3.6, 9.5], [0.4, 14], [3.9, 11]];
      const belly = 0.55 + 0.2 * Math.sin(TAU * 2 * t / D + s.ph);
      const fire = (ly, lx) => {
        if (!burning) return 0;
        const nn = nB(lx * 1.3 + j * 13, ly * 0.9 - 64 * t / D);
        const front = climb - ly + 4 * (nn - 0.5);
        if (front < 0) return 0;
        // a bright burning edge crawling up the canvas, and flickering patches behind it
        const nn2 = nB(lx * 2.6 + j * 7 + 30, ly * 1.9 - 64 * 3 * t / D);
        const band = Math.exp(-front / 0.9) * (0.6 + 0.8 * nn2);
        const patch = sstep(0.55, 0.85, nn2) * 0.9 * (1 - sstep(4, 12, front) * 0.5);
        return (1.7 * band + patch) * sEnv;
      };
      // bounding box in screen
      const top = 15.5 * u, xr = 9.5 * u;
      const bx0 = fl(s.x - xr - top * 0.06), bx1 = Math.ceil(s.x + xr + top * 0.06), by0 = fl(y0 - top - 1), by1 = Math.ceil(y0 + 0.5 * u + 1);
      for (let py = by0; py <= by1; py++) {
        if (py < 0 || py >= H) continue;
        const ly = (y0 - (py + 0.5)) / u;
        for (let px = bx0; px <= bx1; px++) {
          if (px < 0 || px >= W) continue;
          const lx = s.d * ((px + 0.5) - s.x - (y0 - py) * rock) / u;
          let c = 0;
          // hull: a low curved body with a raised stern castle and a rising bow
          const deck = lx < -4.3 ? hh + 1.5 : lx > 4.0 ? hh + (lx - 4.0) * 0.45 : hh;
          const left = -L + Math.max(0, 0.9 - ly) * 1.3, right = L + 0.8 - Math.max(0, 1.6 - ly) * 1.2;
          if (ly >= -0.35 && ly <= deck && lx >= left && lx <= right) c = 1;
          // sails
          if (!c && u > 0.45) {
            for (let m = 0; m < masts.length; m++) {
              const mx = masts[m][0], mh = masts[m][1];
              if (s.k === 1) {
                // lateen: a triangle from a long slanted yard
                const a0 = hh + 1.0, a1 = hh + mh;
                if (ly > a0 && ly < a1) {
                  const q = (ly - a0) / (a1 - a0);
                  const xl = mx - 3.6 * (1 - q) + 0.3, xr2 = mx + 0.2 + 2.6 * (1 - q) * (1 - q) + belly * Math.sin(Math.PI * q) * 0.8;
                  if (lx > xl && lx < xr2) { c = 2; break; }
                }
              } else {
                const hw = (m === 1 && s.k === 2) || (m === 0 && s.k === 0) ? 3.2 : 2.6;
                for (let sl = 0; sl < 2; sl++) {
                  const a0 = sl ? hh + 0.6 * mh : hh + 1.4, a1 = sl ? hh + 0.92 * mh : hh + 0.55 * mh, wf = sl ? 0.78 : 1;
                  if (ly > a0 && ly < a1) {
                    const q = (ly - a0) / (a1 - a0), bl = belly * Math.sin(Math.PI * q);
                    const w = hw * wf * (1 - 0.12 * q);
                    if (lx > mx - w + bl && lx < mx + w + bl) { c = 2; break; }
                  }
                }
                if (c) break;
              }
            }
          }
          if (c) {
            const f = fire(ly, lx) * (c === 2 ? 0.6 : 0.45);
            shipPix(px, py, base, c, f, rate);
          }
        }
      }
      // masts, yards and rigging as lines
      const P = (lx, ly) => [s.x + s.d * lx * u + ly * u * rock, y0 - ly * u];
      const line = (a, b, c, fire0) => {
        const [x0, yy0] = a, [x1, yy1] = b, n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(yy1 - yy0))) + 1;
        for (let k = 0; k <= n; k++) {
          const q = k / n, x = fl(lerp(x0, x1, q)), y = fl(lerp(yy0, yy1, q));
          const ly = (y0 - y) / u;
          shipPix(x, y, base, c, fire0 ? fire(ly, 0) * 0.7 : 0, rate);
        }
      };
      for (let m = 0; m < masts.length; m++) {
        const mx = masts[m][0], mh = masts[m][1];
        line(P(mx, hh), P(mx, hh + mh + 0.6), 3, true);
        if (u > 0.45) {
          if (s.k === 1) line(P(mx - 3.8, hh + 1.0), P(mx + 0.6, hh + mh + 1.2), 3, true);
          else {
            const hw = (m === 1 && s.k === 2) || (m === 0 && s.k === 0) ? 3.2 : 2.6;
            line(P(mx - hw * 1.1, hh + 0.55 * mh), P(mx + hw * 1.1, hh + 0.55 * mh), 3, true);
            line(P(mx - hw * 0.9, hh + 0.92 * mh), P(mx + hw * 0.9, hh + 0.92 * mh), 3, true);
          }
        }
        if (u > 1.4 && m === 0) line(P(mx, hh + mh), P(-L - 0.3, hh + 1.5), 3, false);
        if (u > 1.4 && m === masts.length - 1) line(P(mx, hh + mh), P(L + 2.6, hh + 1.6), 3, false);
      }
      if (u > 0.45) line(P(L + 0.5, hh + 0.9), P(L + 3.0, hh + 2.2), 3, false);
    }
  }
  function drawChain(t) {
    const tau = t - IGN, env = ENV(tau);
    for (let k = 0; k < CHAIN.length; k += 1) {
      const [cx, cy] = CHAIN[k];
      const x = Math.round(cx), bob = 0.6 * Math.sin(TAU * 3 * t / D - cx * 0.09) + 0.4 * Math.sin(TAU * 2 * t / D + cx * 0.21);
      const y = Math.round(cy + bob), base = y + 1;
      // a link pattern: flat links and upright links
      const flat = (x >> 1) & 1;
      const i = y * W + x;
      const la = tau - ARR[clamp(y + 1, 0, H - 1) * W + x];
      const glow = la > 0 ? env * (0.9 * Math.exp(-la / 1.5) + 0.25) * (0.5 + nB(x * 0.5, 0)) : 0;
      shipPix(x, y, base, 4, glow * 0.6, 6);
      if (!flat) shipPix(x, y - 1, base, 4, glow * 0.4, 6);
      if (k % 18 === 9) { shipPix(x - 1, y - 1, base, 4, 0, 0); shipPix(x, y - 1, base, 4, 0, 0); shipPix(x + 1, y - 1, base, 4, 0, 0); shipPix(x, y - 2, base, 4, 0, 0); }
      void i;
    }
    // the hanging ends, from each tower down to the water
    const hang = (ax, ay, bx, by) => {
      const n = Math.ceil(Math.hypot(bx - ax, by - ay));
      for (let k = 0; k <= n; k++) {
        const q = k / n, x = Math.round(lerp(ax, bx, q)), y = Math.round(lerp(ay, by, q) + 2.5 * Math.sin(Math.PI * q));
        shipPix(x, y, Math.round(by) + 1, 4, 0, 0);
      }
    };
    hang(75, 172, CHAIN[0][0], CHAIN[0][1]);
    hang(230, 152, CHAIN[CHAIN.length - 1][0], CHAIN[CHAIN.length - 1][1]);
  }

  /* ================================================================ flames: one upward pass */
  const PSC = new Float32Array(H); for (let y = 0; y < H; y++) PSC[y] = clamp(Math.sqrt(30 / Math.max(4, y - YH + Y0)), 0.55, 1.1);
  const SINX = new Float32Array(W); for (let x = 0; x < W; x++) SINX[x] = Math.sin(x * 0.05);
  function flamePass(t) {
    const NOFL = DBG.indexOf('nofl') >= 0;
    const v = 64 * 2 * t / D;     // scroll of the licking texture (nB is 64-periodic)
    const w = TAU * 3 * t / D;
    FLV.fill(0);
    let live = false;
    for (let y = H - 1; y >= 0; y--) {
      const row = y * W, wob = Math.sin(y * 0.19 - w) * 0.55, wob2 = Math.sin(y * 0.071 + w * 0.5 + 1.0) * 0.5;
      const rowLive = live;
      live = false;
      for (let x = 0; x < W; x++) {
        const i = row + x;
        let c = 0, cr = 0, cb = 0, c0 = 0;
        if (y < H - 1 && rowLive && (FLV[i + W] > 0 || (x > 0 && FLV[i + W - 1] > 0) || (x < W - 1 && FLV[i + W + 1] > 0) || (x > 1 && FLV[i + W - 2] > 0) || (x < W - 2 && FLV[i + W + 2] > 0))) {
          const off = 0;
          const xs = x - off;
          if (xs >= 0 && xs < W) {
            const j = i + W - off, cj = FLV[j];
            if (cj > 0) {
              c = cj - FLR[j];
              if (c < 0.03) c = 0;
              cr = FLR[j]; cb = FLB[j]; c0 = FL0[j];
            }
          }
        }
        const s = SRC[i];
        // whichever flame reaches higher carries on: the one from below, or a new one from this pixel
        let se = 0;
        if (s > 0) {
          const sb = SRCB[i];
          if (SHIPB[i] <= sb) se = s * 0.45 * (1 + 0.2 * s);
          if (c <= 0 || s / SRCR[i] > c / cr) { c = s; cr = SRCR[i]; cb = sb; c0 = s; }
        }
        if (c <= 0) continue;
        FLV[i] = c; FLR[i] = cr; FLB[i] = cb; FL0[i] = c0; live = true;
        if (SHIPB[i] > cb) { if (se > 0) E[i] += se; continue; }
        // a tongue survives to height q where the rising noise is above q: separate licks with rounded tips
        const q = 1 - c / c0;
        const ps = PSC[cb], sw = Math.sin(y * 0.15 * ps - w * 2 + x * 0.05 * ps) + wob;
        const n = nC((x + (0.6 + 2.4 * q) * sw) * 1.5 * ps, (y - cb) * 0.25 * ps + cb * 0.53 + v);
        const thr = 0.3 + q * 0.72, m = sstep(thr - 0.03, thr + 0.3, n);
        const k = 1 - q;
        let e = c0 * (0.08 * m + 1.5 * m * m * Math.pow(k, 1.3)) * (0.45 + 0.5 * Math.min(c0, 2.4));
        if (NOFL) e = 0;
        if (se > e) e = se;
        if (e <= 0) continue;
        E[i] += e;
        if (y < cb) { const ry = 2 * cb - y; if (ry < H) R0E[ry * W + x] += e * 0.75; }
      }
    }
  }

  /* ================================================================ particles */
  // all particle parameters are drawn once at mount
  let SP = null, BU = null, EM = null, SK = null, CAP = null, STEM = null, ASH = null;
  function buildParticles() {
    const rnd = mulberry32(9001);
    // rising sparks from the burning water and the burning ships
    const sp = [];
    for (let k = 0; k < 5200; k++) {
      const tb = IGN + 0.2 + 13.5 * Math.pow(rnd(), 1.25), tau = tb - IGN, L = 0.8 + 2.4 * rnd();
      let x0, y0, base;
      if (rnd() < 0.78) {
        const cnt = countBefore(tau);
        if (!cnt) continue;
        const i = WLIST[fl(rnd() * cnt)];
        if (burnAt(i, tau) < rnd() * 1.1) continue;
        x0 = (i % W) + rnd(); y0 = (i / W) | 0; base = y0;
      } else {
        const s = SHIPS[fl(rnd() * SHIPS.length)], la = tau - s.arr;
        if (la < 0.3 || la > s.dur || s.u < 0.4) continue;
        const h = Math.min(la * s.climb, 15) * rnd();
        x0 = s.x + (rnd() - 0.5) * 7 * s.u; y0 = s.y - h * s.u; base = s.y;
      }
      const sc = clamp((base - YH + Y0) / 60, 0.25, 2.6);
      sp.push([tb, L, x0, y0, base, sc, (14 + 46 * rnd()) * sc, (1.5 + 6 * rnd()) * sc, 2.5 + 7 * rnd(), rnd() * TAU, 0.55 + 0.45 * rnd(), rnd()]);
    }
    SP = sp;
    // the burst at the eruption: ballistic streaks that fall back into the bay
    const bu = [];
    for (let k = 0; k < 900; k++) {
      let dx, dy, dz;
      do { dx = rnd() * 2 - 1; dy = rnd() * 2 - 1; dz = rnd() * 2 - 1; } while (dx * dx + dy * dy + dz * dz > 1);
      const sp2 = 40 + 230 * Math.pow(rnd(), 1.6);
      const l = Math.hypot(dx, dy, dz) || 1;
      bu.push([dx / l * sp2, -(Math.abs(dy / l) * 0.85 + 0.15) * sp2, dz / l, 0.8 + 1.6 * rnd(), rnd(), rnd() * 0.25]);
    }
    BU = bu;
    // embers floating on the water as the fire dies
    const em = [];
    for (let k = 0; k < 1400; k++) {
      const tb = IGN + 5 + 9 * rnd(), tau = tb - IGN;
      const cnt = countBefore(tau - 2);
      if (!cnt) continue;
      const i = WLIST[fl(rnd() * cnt)];
      const L = Math.min(2.5 + 4 * rnd(), D - 0.6 - tb);
      if (L < 1) continue;
      em.push([tb, L, (i % W) + rnd(), (i / W) | 0, rnd() * TAU, 3 + 8 * rnd(), rnd()]);
    }
    EM = em;
    // smoke
    const sk = [];
    for (let k = 0; k < 1100; k++) {
      const tb = IGN + 1.2 + 12 * rnd(), tau = tb - IGN;
      let x0, y0, base;
      if (rnd() < 0.8) {
        const cnt = countBefore(tau);
        if (!cnt) continue;
        const i = WLIST[fl(rnd() * cnt)];
        if (burnAt(i, tau) < rnd() * 0.8) continue;
        x0 = i % W; y0 = (i / W) | 0; base = y0;
      } else {
        const s = SHIPS[fl(rnd() * SHIPS.length)], la = tau - s.arr;
        if (la < 0.5 || la > s.dur || s.u < 0.4) continue;
        x0 = s.x; y0 = s.y - 12 * s.u; base = s.y;
      }
      const L = Math.min(4 + 3 * rnd(), D - 0.7 - tb);
      if (L < 1.5) continue;
      const sc = clamp((base - YH + Y0) / 60, 0.35, 2.4);
      sk.push([tb, L, x0, y0, base, sc, 0.5 + rnd(), rnd() * TAU, rnd()]);
    }
    SK = sk;
    // the mushroom: puffs on a rolling torus, a twisting stem, and the base surge
    const cap = [];
    for (let k = 0; k < 4200; k++) cap.push([rnd() * TAU, rnd() * TAU, Math.sqrt(rnd()), rnd(), rnd()]);
    CAP = cap;
    const stem = [];
    for (let k = 0; k < 1300; k++) stem.push([rnd(), rnd() * TAU, Math.sqrt(rnd()), rnd()]);
    STEM = stem;
    // drifting ash embers high in the smoke
    const ash = [];
    for (let k = 0; k < 900; k++) ash.push([TFB + 1.5 + 9 * rnd(), 2.5 + 3 * rnd(), rnd(), rnd(), rnd() * TAU, rnd()]);
    ASH = ash;
  }

  function sparks(t) {
    for (let k = 0; k < SP.length; k++) {
      const p = SP[k], age = t - p[0];
      if (age < 0 || age > p[1]) continue;
      const L = p[1], sc = p[5], q = age / L;
      const yv = p[6] * age * (1 - 0.3 * q);
      const sw = p[7] * Math.sin(p[8] * age + p[9]) * Math.pow(age, 0.6);
      const x = p[2] + WIND * sc * age + sw, y = p[3] - yv;
      const b = Math.pow(1 - q, 1.1) * (0.65 + 0.35 * Math.sin(31 * age + p[9] * 3));
      const e = (0.6 + 2.6 * b) * p[10];
      addE(x, y, e, p[4], 0.55);
      if (p[6] > 30 * sc && b > 0.3) addE(x - p[7] * 0.12 * Math.cos(p[8] * age + p[9]), y + 1, e * 0.45, p[4], 0.4);
    }
  }
  function burst(t) {
    const a = t - TFB;
    if (a < 0 || a > 3) return;
    const g = 120;
    for (let k = 0; k < BU.length; k++) {
      const p = BU[k], age = a - p[5];
      if (age < 0 || age > p[3]) continue;
      const kd = 1.6, dd = (1 - Math.exp(-kd * age)) / kd;
      const yl = FBY + p[2] * 34;                       // where it meets the water
      const ballistic = (aa) => { const d2 = (1 - Math.exp(-kd * aa)) / kd; return [FBX + p[0] * d2, FBY - 8 + p[1] * d2 + 0.5 * g * aa * aa]; };
      const [x, y] = ballistic(age);
      const q = age / p[3];
      if (y > yl && age > 0.15) {
        // landed: a burning drop on the water for a moment
        let lo = 0.15, hi = age;
        for (let it = 0; it < 6; it++) { const m = (lo + hi) / 2; if (ballistic(m)[1] > yl) hi = m; else lo = m; }
        const after = age - hi;
        if (after < 1.4) { const [lx] = ballistic(hi); const e = 1.6 * (1 - after / 1.4); addE(lx, yl, e, Math.round(yl), 0); addE(lx, yl + 2, e * 0.35, Math.round(yl), 0); }
        continue;
      }
      const e = (3.2 * Math.exp(-age * 1.4) + 0.8) * (1 - q * q) * (0.8 + 0.4 * p[4]);
      const base = Math.round(yl);
      addE(x, y, e, base, 0.5);
      // a streak behind it
      for (let s = 1; s <= 3; s++) { const [tx, ty] = ballistic(Math.max(0, age - s * 0.018)); addE(tx, ty, e * (0.55 - s * 0.13), base, 0.4); }
      void dd;
    }
  }
  function embers(t) {
    for (let k = 0; k < EM.length; k++) {
      const p = EM[k], age = t - p[0];
      if (age < 0 || age > p[1]) continue;
      const q = age / p[1];
      const y = p[3], sc = clamp((y - YH + Y0) / 60, 0.3, 2.6);
      const x = p[2] + 2.2 * sc * age + 0.6 * sc * Math.sin(age * 1.3 + p[4]);
      const tw = 0.6 + 0.4 * Math.sin(p[5] * age + p[4]);
      const e = (0.5 + 1.8 * p[6]) * sstep(0, 0.4, age) * (1 - sstep(0.55, 1, q)) * tw;
      addE(x, y, e, y + 1, 0);
      if (sc > 1.7) addE(x + 1, y, e * 0.8, y + 1, 0);
      addE(x, y + 2, e * 0.3, y + 1, 0);
      if (sc > 1.2) addE(x, y + 3, e * 0.18, y + 1, 0);
    }
  }
  function ash(t) {
    for (let k = 0; k < ASH.length; k++) {
      const p = ASH[k], age = t - p[0];
      if (age < 0 || age > p[1]) continue;
      const q = age / p[1];
      const x = FBX - 50 + p[2] * 120 + (WIND + 4) * age + 6 * Math.sin(age * 1.7 + p[4]);
      const y = 40 + p[3] * 150 - 9 * age;
      const fl2 = Math.sin(age * 9 + p[4] * 5) > -0.2 ? 1 : 0.2;
      addE(x, y, (0.45 + 1.0 * p[5]) * (1 - q) * fl2 * sstep(0, 0.3, age), FBY, 0);
    }
  }
  function smoke(t) {
    for (let k = 0; k < SK.length; k++) {
      const p = SK[k], age = t - p[0];
      if (age < 0 || age > p[1]) continue;
      const q = age / p[1], sc = p[5];
      const x = p[2] + (WIND + 3) * sc * age * 0.9 + 4 * sc * Math.sin(age * 0.8 + p[7]) * q;
      const y = p[3] - (10 + 6 * p[6]) * sc * age * (1 - 0.25 * q);
      const r = (2 + 9 * Math.sqrt(q)) * Math.sqrt(sc) * (0.7 + 0.5 * p[8]);
      const d = 0.3 * Math.pow(Math.sin(Math.PI * q), 0.7) * p[6];
      discE(x, y, r, 0, p[4], 0, d);
    }
  }

  // the eruption and the mushroom it rolls into
  function mushroom(t) {
    const a = t - TFB;
    if (a < 0 || a > 14.5) return;
    const hc = 6 + 132 * (1 - Math.exp(-a / 2.2)) + 2.0 * a;          // cap height above the water
    const Rr = 5 + 50 * (1 - Math.exp(-a / 2.4)) + 1.2 * a;             // ring radius
    const rt = 6 + 26 * (1 - Math.exp(-a / 2.0)) + 0.9 * a;             // tube radius
    const rot = 9 * (1 - Math.exp(-a / 3.6));                          // roll, slowing
    const sphere = 1 - sstep(0.15, 1.6, a);                             // early: a ball
    const drift = WIND * 0.7 * a;
    const cx = FBX + drift, cy = FBY - hc;
    const heat = 2.0 * Math.exp(-a / 5) + 0.6 * Math.exp(-a / 9);
    const fade = 1 - sstep(6.5, 12.5, a);
    const smk = sstep(2.0, 6.5, a) * (1 - sstep(9, 14.5, a));
    const ELEV = 0.22;
    // the flash ball
    if (a < 0.9) {
      const rb = 4 + 26 * Math.sqrt(a / 0.9);
      discE(FBX, FBY - rb * 0.55 - 2, rb, 2.4 * (1 - a / 0.9) + 0.6, FBY, 0.7, 0);
    }
    for (let k = 0; k < CAP.length; k++) {
      const p = CAP[k];
      const th = p[0], rr = p[2];
      const phi = p[1] - rot * (1.25 - 0.5 * rr);
      const r = rt * rr;
      let hor = Rr + r * Math.cos(phi), ver = r * Math.sin(phi);
      let x = cx + hor * Math.cos(th), y = cy - ver - hor * Math.sin(th) * ELEV;
      if (sphere > 0) {
        // early on the puffs sit on a rising ball
        const R = 6 + 22 * Math.sqrt(Math.min(1, a / 1.2));
        const sx = FBX + R * rr * Math.cos(th) * Math.sin(p[1]), sy = FBY - R * 0.9 - 4 * a * 8 * 0 - R * rr * Math.cos(p[1]) * 0.9 - a * 22;
        x = lerp(x, sx, sphere); y = lerp(y, sy, sphere);
      }
      // spiral bands: material lines rolling with the vortex
      const band = 0.3 + 0.7 * sstep(-0.6, 0.8, Math.sin(2 * p[1] + th + 3 * rr));
      const front = Math.sin(th) > 0 ? 1 : 0.75;                        // the near side of the ring a little brighter
      const e = heat * (1.3 - 0.85 * rr) * band * front * fade * (0.8 + 0.4 * p[3]);
      const rad = (1.2 + 1.8 * (1 - rr) + 1.0 * p[4]) * (0.75 + 0.14 * Math.min(a, 7));
      discE(x, y, rad, e * 0.3, FBY, 0.75, (smk * 0.1 + 0.05 * sstep(0.8, 3, a) * rr * rr) * (0.6 + 0.4 * p[4]) * (1.1 - band * 0.5));
    }
    // the stem: rising, twisting, brightest low and in its core
    const sh = Math.max(0, hc - rt * 0.6);
    for (let k = 0; k < STEM.length; k++) {
      const p = STEM[k], s = p[0];
      const y = FBY - s * sh;
      const wid = (4 + 11 * s * s + 2.5 * Math.sin(s * 9 - a * 2)) * (0.6 + 0.4 * sstep(0, 2, a));
      const ang = p[1] + 2.5 * a + 6 * s;
      const x = FBX + drift * s * s + wid * p[2] * Math.cos(ang);
      const band = 0.25 + 0.75 * sstep(-0.5, 0.8, Math.sin(18 * s - 7 * a + p[1]));
      const e = heat * (1.2 - 0.5 * p[2]) * (0.6 + 0.6 * (1 - s)) * band * fade * (1 - sstep(4, 9, a) * s);
      discE(x, y, 1.3 + 1.6 * (1 - p[2]) + 1.2 * s, e * 0.2, FBY, 0.75, smk * 0.07 * s);
    }
    // base surge: a ring rolling out across the water
    if (a < 6) {
      const Rb = 70 * (1 - Math.exp(-a / 1.1));
      const eb = 1.6 * Math.exp(-a / 1.5) * (1 - sstep(4, 6, a));
      for (let k = 0; k < 260; k++) {
        const th = TAU * k / 260 + 0.3 * Math.sin(k * 1.7);
        const x = FBX + Rb * Math.cos(th) * (0.9 + 0.2 * ih(k, 7, 1)), yb = FBY + Rb * Math.sin(th) * 0.22;
        const hgt = (3 + 6 * ih(k, 7, 2)) * (1 - a / 6);
        discE(x, yb - hgt * 0.5, 1.5 + 2 * ih(k, 7, 3), eb * (0.5 + ih(k, 7, 4)), Math.round(yb), 0.6, sstep(0.5, 2, a) * 0.05);
      }
    }
  }

  // the pot thrown from the walls
  function comet(t) {
    const t0 = 0.25;
    if (t < t0 || t > IGN + 0.9) return;
    const sx = 98, sy = 126;
    const pos = (tt) => { const s = clamp((tt - t0) / (IGN - t0), 0, 1); return [lerp(sx, IGX, s), lerp(sy, IGY, s * s) - 40 * Math.sin(Math.PI * s) * (1 - s * 0.4)]; };
    if (t < IGN) {
      for (let k = 0; k < 14; k++) {
        const tt = t - k * 0.018;
        if (tt < t0) break;
        const [x, y] = pos(tt);
        const e = 3 * (1 - k / 14);
        addE(x, y, e, IGY, 0.6);
        if (k === 0) { addE(x + 1, y, e * 0.6, IGY, 0.6); addE(x, y + 1, e * 0.6, IGY, 0.6); addE(x + 1, y + 1, e * 0.5, IGY, 0.6); }
      }
      for (let k = 0; k < 10; k++) {
        const tb = t0 + (IGN - t0) * ih(k, 5, 1), age = t - tb;
        if (age < 0 || age > 0.5) continue;
        const [x, y] = pos(tb);
        addE(x + (ih(k, 5, 2) - 0.5) * 12 * age, y + 40 * age * age + 6 * age, 1.6 * (1 - age / 0.5), IGY, 0.5);
      }
    } else {
      const a = t - IGN, r = 2 + 16 * Math.sqrt(a / 0.9);
      discE(IGX, IGY - r * 0.5, r * 0.9, 2.6 * (1 - a / 0.9), IGY, 0.7, 0);
    }
  }

  /* ================================================================ glow */
  function glow(t) {
    GA.fill(0);
    for (let y = 0; y < H; y++) {
      const gy = (y / GS) | 0;
      for (let x = 0; x < W; x++) {
        const e = E[y * W + x];
        if (e > 0.05) GA[gy * GW + ((x / GS) | 0)] += Math.min(e, 4);
      }
    }
    for (let k = 0; k < GA.length; k++) GA[k] /= GS * GS;
    // small blur
    blur(GA, GT, GW, GH, 2); blur(GA, GT, GW, GH, 2);
    // wide blur on a coarser grid
    GB.fill(0);
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) GB[((gy * GS / GS2) | 0) * GW2 + ((gx * GS / GS2) | 0)] += GA[gy * GW + gx] / 9;
    blur(GB, GBT, GW2, GH2, 3); blur(GB, GBT, GW2, GH2, 3); blur(GB, GBT, GW2, GH2, 2);
    const a = t - TFB, flash = a >= 0 ? 1.0 * Math.exp(-a / 0.22) : 0;
    const ia = t - IGN, flash2 = ia >= 0 ? 0.35 * Math.exp(-ia / 0.2) : 0;
    for (let y = 0; y < H; y++) {
      const fy = y / GS - 0.5, iy = clamp(fl(fy), 0, GH - 2), wy = clamp(fy - iy, 0, 1);
      const fy2 = y / GS2 - 0.5, iy2 = clamp(fl(fy2), 0, GH2 - 2), wy2 = clamp(fy2 - iy2, 0, 1);
      for (let x = 0; x < W; x++) {
        const fx = x / GS - 0.5, ix = clamp(fl(fx), 0, GW - 2), wx = clamp(fx - ix, 0, 1), o = iy * GW + ix;
        const g1 = (GA[o] * (1 - wx) + GA[o + 1] * wx) * (1 - wy) + (GA[o + GW] * (1 - wx) + GA[o + GW + 1] * wx) * wy;
        const fx2 = x / GS2 - 0.5, ix2 = clamp(fl(fx2), 0, GW2 - 2), wx2 = clamp(fx2 - ix2, 0, 1), o2 = iy2 * GW2 + ix2;
        const g2 = (GB[o2] * (1 - wx2) + GB[o2 + 1] * wx2) * (1 - wy2) + (GB[o2 + GW2] * (1 - wx2) + GB[o2 + GW2 + 1] * wx2) * wy2;
        GLOW[y * W + x] = 0.55 * g1 + 1.7 * g2 + flash + flash2;
      }
    }
  }
  function blur(A, T, w, h, r) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let d = -r; d <= r; d++) { const xx = x + d; if (xx >= 0 && xx < w) { s += A[y * w + xx]; n++; } }
      T[y * w + x] = s / n;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let d = -r; d <= r; d++) { const yy = y + d; if (yy >= 0 && yy < h) { s += T[yy * w + x]; n++; } }
      A[y * w + x] = s / n;
    }
  }

  /* ================================================================ stars */
  let STARS = null;
  function buildStars() {
    const rnd = mulberry32(777), st = [];
    for (let k = 0; k < 210; k++) {
      const x = fl(rnd() * W), y = fl(Math.pow(rnd(), 1.4) * (YH - 14));
      if (y >= TOP[x] - 2) continue;
      st.push([x, y, 0.3 + 0.7 * Math.pow(rnd(), 2), 1 + fl(rnd() * 5), rnd() * TAU]);
    }
    STARS = st;
  }

  /* ================================================================ composite */
  const GR = 0.10, GG = 0.62, GBL = 0.42;      // the colour of the fire light
  function composeFar(t) {
    const cs = 256 * t / D, cs2 = 256 * 2 * t / D;
    for (let y = 0; y < YH + 52; y++) {
      const v = y / YH;
      const br = 2 + 22 * Math.pow(Math.min(1, v), 2.2), bg = 2 + 26 * Math.pow(Math.min(1, v), 2.2), bb = 8 + 56 * Math.pow(Math.min(1, v), 1.8);
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (y >= FOOT[x]) continue;
        const f = FAR[i], gl = Math.min(GLOW[i], 3);
        let r, g, b;
        if (f === 0) {
          r = br; g = bg; b = bb;
          // drifting cloud streaks
          const n1 = nA(x * 0.9 - cs, y * 3.2), n2 = nA(x * 0.45 + cs2 * 0.5 + 60, y * 2.0 + 40);
          const band = sstep(18, 40, y) * (1 - sstep(95, 135, y)) + 0.4 * (1 - sstep(10, 30, y));
          const cl = sstep(0.42, 0.8, n1 * 0.6 + n2 * 0.5 - 0.05) * band;
          r += cl * 8; g += cl * 10; b += cl * 20;
          r += gl * (GR * 40 + cl * 14); g += gl * (GG * 40 + cl * 70); b += gl * (GBL * 40 + cl * 40);
        } else if (f === 3) {
          const k = WINID[i], ph = WINPH[k], lv = WINLV[k];
          const fk = 0.75 + 0.25 * Math.sin(TAU * WINRT[k] * t / D + ph) * Math.sin(TAU * (WINRT[k] + 2) * t / D + ph * 2);
          const on = lv < 0.12 ? (Math.sin(TAU * t / D + ph) > 0 ? 1 : 0.15) : 1;
          const w = fk * on * (0.75 + 0.25 * lv);
          r = 255 * w; g = 190 * w * w; b = 90 * w * w * w;
        } else {
          // stone and buildings: almost black, catching the fire on the faces that look at it
          const rim = RIM[i];
          const tex = f === 1 || f === 5 ? (nA(x * 2.5, y * 6) > 0.62 ? 1.6 : 0) : 0;
          r = 2 + tex; g = 3 + tex; b = 9 + tex * 2;
          const lit = gl * rim;
          r += lit * GR * 70; g += lit * GG * 80; b += lit * GBL * 70;
        }
        CR[i] = r; CG[i] = g; CB[i] = b;
      }
    }
    // stars
    for (const s of STARS) {
      const i = s[1] * W + s[0];
      const tw = s[2] * (0.6 + 0.4 * Math.sin(TAU * s[3] * t / D + s[4]));
      const dim = Math.max(0, 1 - GLOW[i] * 1.6 - SM[i] * 4);
      const v = tw * dim;
      if (v < 0.2) continue;
      const k = v > 0.75 ? 10 : 9, p = PAL[k];
      const m = v > 0.75 ? 1 : v * 0.9;
      CR[i] = lerp(CR[i], p[0], m); CG[i] = lerp(CG[i], p[1], m); CB[i] = lerp(CB[i], p[2], m);
    }
  }

  // ripples: a few plane waves, faded where they would alias
  const WAVES = [
    { kx: 4, kz: 26, n: 4, a: 0.010, p: 0.3 }, { kx: -9, kz: 41, n: -6, a: 0.006, p: 1.9 },
    { kx: 17, kz: 63, n: 8, a: 0.0035, p: 4.1 }, { kx: -25, kz: 93, n: -10, a: 0.0022, p: 2.7 },
    { kx: 2, kz: 12, n: 2, a: 0.016, p: 5.2 },
  ];
  const WATT = WAVES.map(() => new Float32Array(H));
  function buildWaves() {
    WAVES.forEach((wv, k) => {
      const lam = TAU / Math.hypot(wv.kx, wv.kz);
      for (let y = YH; y < H; y++) { const Z = ZR[y], pxl = lam * FOC / (Z * Z) * 1.0; WATT[k][y] = sstep(1.6, 4.5, pxl); }
    });
  }
  function composeWater(t) {
    const ph = WAVES.map((w) => TAU * w.n * t / D), po = 256 * t / D;
    for (let y = YH; y < H; y++) {
      const Z = ZR[y], near = (y - YH) / (H - YH);
      const fr = 0.86 - 0.42 * near;                // more mirror toward the horizon
      for (let x = 0; x < W; x++) {
        if (y < FOOT[x]) continue;
        const i = y * W + x, X = PXA[i];
        let sx = 0, sz = 0;
        for (let k = 0; k < WAVES.length; k++) {
          const wv = WAVES[k], at = WATT[k][y];
          if (at <= 0) continue;
          const c = Math.cos(wv.kx * X + wv.kz * Z - ph[k] + wv.p) * wv.a * at;
          sx += c * wv.kx; sz += c * wv.kz;
        }
        const dx = Math.round(sx * 9), dy = Math.round(sz * 7 * (0.5 + near));
        // the far scene, mirrored about the shore line of its column
        const xx = clamp(x + dx, 0, W - 1);
        let ry = 2 * FOOT[xx] - 1 - y + dy;
        ry = clamp(ry, 0, FOOT[xx] - 1);
        const j = ry * W + xx;
        let r = 1 + 3 * (1 - near), g = 2 + 4 * (1 - near), b = 6 + 12 * (1 - near);
        r += CR[j] * fr * 0.8; g += CG[j] * fr * 0.8; b += CB[j] * fr * 0.85;
        // upright things mirrored about their own waterlines
        const yr = clamp(y + dy, 0, H - 1), jr = yr * W + xx;
        if (R0S[jr]) { r *= 0.35; g *= 0.35; b *= 0.4; }
        const re = R0E[jr];
        if (re > 0 && SHIPB[i] === 0 && DBG.indexOf('nore') < 0) {
          // broken into streaks by the ripples
          const st = sstep(-0.15, 0.45, sz * 3 + (nA(x * 0.09 + po, y * 0.8 - po) - 0.5) * 1.2);
          E[i] += re * (0.18 + 0.5 * st) * (R0S[jr] ? 0.4 : 1);
        }
        // fire light on the water, brightest on the crests that face us
        const gl = DBG.indexOf('nogl') >= 0 ? 0 : Math.min(GLOW[i], 2), patch = sstep(0.35, 0.8, nA(x * 0.06 + po, y * 0.7 - po * 0.5));
        const crest = sstep(0.5, 0.95, -sz * 2.6) * patch * (0.4 + 0.6 * near);
        const lit = gl * (0.12 + 1.8 * crest * crest);
        r += lit * GR * 60 + crest * 10; g += lit * GG * 60 + crest * 12; b += lit * GBL * 60 + crest * 30;
        CR[i] = r; CG[i] = g; CB[i] = b;
      }
    }
  }
  let SMO = 0;
  function composeTop() {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let r = CR[i], g = CG[i], b = CB[i];
        const gl = DBG.indexOf('nogl') >= 0 ? 0 : Math.min(GLOW[i], 3);
        // ships and the boom: silhouettes with a green rim
        if (SHIPB[i]) {
          const c = SHIPC[i];
          const lk = c === 2 ? 0.55 : c === 4 ? 0.7 : 0.35;
          const rim = (x + 1 < W && SHIPB[i + 1] !== SHIPB[i]) || (y > 0 && SHIPB[i - W] !== SHIPB[i]) ? 1.6 : 1;
          r = 3 + gl * lk * rim * GR * 50; g = 3 + gl * lk * rim * GG * 50; b = 9 + gl * lk * rim * GBL * 50;
          if (c === 2) { r += 2; g += 3; b += 6; }
        }
        // smoke, lit from below by the fire
        const sm = SM[i];
        if (sm > 0.005 && DBG.indexOf('nosm') < 0) {
          const tx = nA(x * 0.7 - SMO * 0.5, y * 0.9 + SMO);
          const al = 1 - Math.exp(-sm * (0.6 + 1.8 * tx));
          const sr = 7 + gl * 12, sg = 11 + gl * 50, sb = 15 + gl * 36;
          r = lerp(r, sr, al); g = lerp(g, sg, al); b = lerp(b, sb, al);
        }
        CR[i] = r; CG[i] = g; CB[i] = b;
        const th = bay(x, y);
        const e = E[i];
        const lum = 0.3 * r + 0.59 * g + 0.11 * b;
        if (e > 0.02) {
          let lv = fl(e * 2.5 + (th - 0.5) * 1.1);
          if (lv >= 1) {
            if (lv > NFR) lv = NFR;
            if (FLUM[lv - 1] >= lum * 0.9) { OUT[i] = FR0 + lv - 1; continue; }
          }
        }
        const d = (th - 0.5) * 0.07;
        const qr = clamp(Math.sqrt(clamp(r, 0, 255) / 255) + d, 0, 1), qg = clamp(Math.sqrt(clamp(g, 0, 255) / 255) + d, 0, 1), qb = clamp(Math.sqrt(clamp(b, 0, 255) / 255) + d, 0, 1);
        OUT[i] = LUT[(Math.round(qr * 63) << 12) | (Math.round(qg * 63) << 6) | Math.round(qb * 63)];
      }
    }
  }

  const DBG = (location.search.match(/dbg=([a-z,]+)/) || [0, ''])[1].split(',');
  function drawFrame(t) {
    t = ((t % D) + D) % D;
    SRC.fill(0); SRCB.fill(0); SHIPB.fill(0); SHIPC.fill(0); E.fill(0); R0E.fill(0); R0S.fill(0); SM.fill(0);
    const P = window.__wfprof = {}; let pt = performance.now();
    const m = (k) => { const n = performance.now(); P[k] = +(n - pt).toFixed(1); pt = n; };
    drawChain(t);
    drawShips(t); m('ships');
    surfaceFire(t); m('surf');
    tongues(t); m('tongues');
    flamePass(t); m('flame');
    mushroom(t); m('mush');
    burst(t);
    sparks(t);
    embers(t);
    ash(t); m('parts');
    smoke(t); m('smoke');
    comet(t);
    glow(t); m('glow');
    composeFar(t); m('far');
    composeWater(t); m('water');
    SMO = 256 * t / D;
    composeTop(); m('top');
  }

  function build() {
    buildLUT();
    NA = makeNoise(256, [64, 32, 16, 8, 4], 31);
    NB = makeNoise(64, [16, 8, 4, 2], 57);
    NC = makeNoise(64, [8, 4, 2], 91);
    buildLand();
    buildWaterGeometry();
    buildChain();
    buildOil();
    buildShips();
    buildWaves();
    buildStars();
    buildParticles();
    buildTongues();
  }

  /* ================================================================ present */
  let IMG = null, SMALL = null, SG = null;
  const LUTR = new Uint8Array(PAL.length * 3); PAL.forEach((p, k) => { LUTR[k * 3] = p[0]; LUTR[k * 3 + 1] = p[1]; LUTR[k * 3 + 2] = p[2]; });
  function present(g) {
    if (!SMALL) { SMALL = document.createElement('canvas'); SMALL.width = W; SMALL.height = H; SG = SMALL.getContext('2d'); IMG = SG.createImageData(W, H); }
    const d = IMG.data;
    for (let i = 0, j = 0; i < N; i++, j += 4) { const k = OUT[i] * 3; d[j] = LUTR[k]; d[j + 1] = LUTR[k + 1]; d[j + 2] = LUTR[k + 2]; d[j + 3] = 255; }
    SG.putImageData(IMG, 0, 0);
    const K = g.canvas.width / W;
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(SMALL, 0, 0, W * K, H * K);
  }

  /* ================================================================ mount */
  const ROOM = '#020207';
  (window.PIECES = window.PIECES || []).push({
    id: 'wildfire',
    title: 'Wildfire',
    medium: 'Burning water, 270 × 338, dithered in JavaScript · 20 s loop',
    note: 'One pot, one bloom, one night · tap to pause',
    about: 'A dark bay at night under a walled city on the cliffs, a chain boom across the water and a fleet riding at anchor. A green pot falls from the walls and alchemical fire blooms from where it lands: it runs across spilled oil, races along the slicks, climbs the masts and sails, and erupts in a white-green fireball that rolls up into a mushroom of flame before burning down to floating embers and smoke, and the calm night comes back. Everything reflects in the rippled water. Inspired by the novels of George R. R. Martin; an unofficial fan tribute.',
    tone: 'dark',
    room: ROOM,
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0, built = false, tmr = 0;
      el.style.background = ROOM;
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;image-rendering:pixelated;image-rendering:crisp-edges;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(140,240,180,.7)"/><rect x="19" y="9" width="5" height="16" fill="rgba(140,240,180,.7)"/></svg>';
      el.appendChild(pauseMark);
      function layout() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        let left = 0, top = 0, cssW, cssH;
        if (EXPORT) {
          // 270 × 338 at 4× is 1080 × 1352: the canvas is exactly 1080 × 1350 and the last two rows fall off
          cssW = 1080; cssH = 1350; cv.style.position = 'fixed';
          cv.width = 1080; cv.height = 1350;
        } else {
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          const fit = Math.min(w * dpr / W, h * dpr / H) * 0.97;
          let k = Math.max(1, Math.floor(fit));
          if (k < fit * 0.9) { k = Math.max(1, Math.ceil(fit)); cssW = W * fit / dpr; cssH = H * fit / dpr; }
          else { cssW = W * k / dpr; cssH = H * k / dpr; }
          left = Math.round((w - cssW) / 2); top = Math.round((h - cssH) / 2);
          if (cv.width !== W * k || cv.height !== H * k) { cv.width = W * k; cv.height = H * k; }
        }
        cv.style.left = left + 'px'; cv.style.top = top + 'px'; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
        pauseMark.style.left = (left + cssW - 48) + 'px'; pauseMark.style.top = (top + 14) + 'px';
      }
      layout();
      const render = (t) => { if (!built) return; drawFrame(t); present(g); };
      g.fillStyle = ROOM; g.fillRect(0, 0, cv.width, cv.height);
      if (EXPORT) {
        const mo = new MutationObserver(() => { if (!built && document.documentElement.dataset.ready) delete document.documentElement.dataset.ready; });
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ready'] });
      }
      tmr = setTimeout(() => {
        if (!alive) return;
        build();
        built = true;
        render(clock);
        if (EXPORT) {
          const faded = () => { const st = el.parentElement; return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999; };
          window.__wildfire = {
            duration: D,
            isReady: () => built && faded(),
            renderAt(t) { return new Promise((res) => { const t0 = performance.now(); render(t); window.__wildfire.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
            lastMs: 0,
          };
          document.documentElement.dataset.ready = 'wildfire';
          api.ready();
        } else {
          window.__wildfire = { duration: D, isReady: () => built, renderAt(t) { return new Promise((res) => { playing = false; clock = t; render(t); requestAnimationFrame(() => res()); }); } };
          api.ready();
          raf = requestAnimationFrame(frame);
        }
      }, 0);
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        raf = requestAnimationFrame(frame);
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
        if (!playing) return;
        clock = (clock + dt) % D;
        render(clock);
      }
      const onDown = () => { if (EXPORT) return; playing = !playing; last = 0; pauseMark.style.opacity = playing ? '0' : '1'; };
      cv.addEventListener('pointerdown', onDown);
      let rt = 0;
      const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (!alive) return; layout(); render(clock); }, 120); });
      ro.observe(el);
      return {
        destroy() {
          alive = false; cancelAnimationFrame(raf); clearTimeout(tmr); ro.disconnect(); clearTimeout(rt);
          cv.removeEventListener('pointerdown', onDown);
          if (window.__wildfire) delete window.__wildfire;
        },
      };
    },
  });
})();
