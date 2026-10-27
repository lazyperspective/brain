/* Tidepool — Quiet Hours, piece 2.
 *
 * A rock pool seen straight down, laid out as a living mandala with an eight-fold symmetry that is found
 * rather than mirrored: every ring is placed in one wedge and repeated with small jitters, swaps and gaps.
 * From the centre out: a great coral anemone breathing open and closed, a ring of small anemones in two
 * colours whose breathing travels round the ring, slowly turning urchins with every spine drawn on its
 * own, five-armed stars that creep a pixel or two and come back, barnacles fanning their feathery cirri,
 * packed coralline, mussels, periwinkles, sea glass and pebbles, and kelp fronds swaying from the rim.
 * Soft caustics play over the bed and the water wobbles it by a pixel. Once a loop the tide spirals in
 * from the edge as a cooler, darker dithered wash with a lace of foam at its front, covers the pool and
 * drains back out. Every frame is a pure function of t on a 360 × 450 grid in 44 colours, shown at 3×.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 360, H = 450, N = W * H, D = 24;
  const CX = 180, CY = 225;
  const TAU = Math.PI * 2, fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const fr = (v) => v - fl(v);
  const wrapA = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
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
  function vnoise(x, y, s) {
    const xi = fl(x), yi = fl(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = ih(xi, yi, s), b = ih(xi + 1, yi, s), c = ih(xi, yi + 1, s), d = ih(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, s, o) {
    let t = 0, a = 0.5, f = 1, n = 0;
    for (let k = 0; k < o; k++) { t += a * vnoise(x * f, y * f, s + k * 17); n += a; a *= 0.5; f *= 2.03; }
    return t / n;
  }

  /* ================================================================ palette (44) */
  const PAL_HEX = [
    '0b0914', '171228', '261b3d', '3a2a57', '563f77', '7d5f9c', 'ab8cc4',            // 0-6   ink, deep purples
    '0a1f24', '0f3238', '15474d', '1d605f', '2b7d76', '47a092', '79c4ae', 'b2e2cc', 'e9f7ee', // 7-15 teal to foam
    '1b3122', '2b4c2b', '4a6e33', '7a9442', 'b0b863',                                // 16-20 kelp greens
    '2e1d14', '4f3220', '7a5130', 'a87a3e', 'd3a659', 'eed08f',                      // 21-26 ochres
    '3e1626', '6c2536', 'a43e47', 'd6644f', 'f0936e', 'f9c6a2',                      // 27-32 corals
    'b44f7e', 'e89cbc',                                                              // 33-34 anemone pinks
    '232430', '3f3e4a', '625e68', '8d8780', 'bcb4a5', 'e6decc',                      // 35-40 stone, bone
    '18203a', '2e4870', '5f88b0',                                                    // 41-43 mussel blues
  ];
  const PAL = PAL_HEX.map((h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
  function nearest(r, g, b) {
    let best = 0, bd = 1e18;
    for (let k = 0; k < PAL.length; k++) {
      const p = PAL[k], dr = r - p[0], dg = g - p[1], db = b - p[2], rm = (r + p[0]) * 0.5;
      const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  // material ramps, dark to light
  const M_ROCK = 0, M_PURP = 1, M_CORAL = 2, M_PINK = 3, M_TEAL = 4, M_GLASS = 5, M_KELP = 6, M_OCHRE = 7,
    M_STONE = 8, M_MUSS = 9, M_FOAM = 10, M_SAND = 11, M_CORL = 12;
  const RAMPS = [
    [0, 1, 35, 36, 37, 38, 39, 40],
    [0, 1, 2, 3, 4, 5, 6],
    [27, 28, 29, 30, 31, 32],
    [1, 27, 28, 33, 34, 40],
    [7, 8, 9, 10, 11, 12, 13, 14, 15],
    [8, 10, 11, 12, 13, 14, 15],
    [16, 17, 18, 19, 20, 26],
    [21, 22, 23, 24, 25, 26, 40],
    [35, 36, 37, 38, 39, 40],
    [0, 41, 42, 43, 14],
    [12, 13, 14, 15],
    [1, 21, 22, 23, 38, 39],
    [1, 27, 33, 6, 34, 40],
  ];
  const RLEN = new Int32Array(RAMPS.length), ROFF = new Int32Array(RAMPS.length);
  const RFLAT = new Uint8Array(RAMPS.reduce((s, r) => s + r.length, 0));
  { let o = 0; RAMPS.forEach((r, k) => { ROFF[k] = o; RLEN[k] = r.length; r.forEach((c) => { RFLAT[o++] = c; }); }); }
  const COOL1 = new Uint8Array(PAL.length);
  function buildCool() {
    const A = [0x15, 0x47, 0x4d];
    for (let k = 0; k < PAL.length; k++) {
      const p = PAL[k];
      COOL1[k] = nearest(p[0] * 0.55 + A[0] * 0.45, p[1] * 0.55 + A[1] * 0.45, p[2] * 0.55 + A[2] * 0.45);
    }
  }
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const BAY2 = [5, 13, 7, 15, 9, 1, 11, 3, 6, 14, 4, 12, 10, 2, 8, 0].map((v) => (v + 0.5) / 16);
  const LX = -0.5, LY = -0.62, LZ = 0.6; // light from the upper left

  /* ================================================================ buffers & pens */
  const BM = new Uint8Array(N), BL = new Float32Array(N);   // the bed: material, level
  const MM = new Uint8Array(N), ML = new Float32Array(N);   // the frame
  const OUT = new Uint8Array(N);
  const RIM = new Uint8Array(N), EDG = new Float32Array(N), PRR = new Float32Array(N), PTH = new Float32Array(N);
  const S1 = new Float32Array(N), C1 = new Float32Array(N), S2 = new Float32Array(N), C2 = new Float32Array(N);
  const WT = new Float32Array(N), E = new Float32Array(N), FB = new Uint8Array(N);
  const MARK = new Int32Array(N); let STAMP = 1;
  let TM = BM, TL = BL;
  function put(x, y, m, l) {
    x = fl(x); y = fl(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x; TM[i] = m; TL[i] = l;
  }
  function dark(x, y, a) {
    x = fl(x); y = fl(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (MARK[i] === STAMP) return;
    MARK[i] = STAMP;
    const v = TL[i] - a; TL[i] = v < 0 ? 0 : v;
  }
  const newStamp = () => { STAMP++; };

  function rimR(th) {
    return 166 + 1.5 * Math.sin(3 * th + 0.7) + 1.1 * Math.sin(5 * th + 2.1) + 0.9 * Math.sin(11 * th + 0.3) + 0.6 * Math.sin(19 * th + 1.7) + 0.4 * Math.sin(31 * th + 0.9);
  }

  // a layer drawn per pixel by fn(dx, dy) -> level or -1 (fn sets LMAT), with a dropped shadow
  const LB = new Float32Array(160 * 160), LMB = new Uint8Array(160 * 160);
  let LMAT = 0;
  function layer(cx, cy, R, fn, so, sa) {
    const x0 = fl(cx - R), y0 = fl(cy - R), x1 = Math.ceil(cx + R) + so, y1 = Math.ceil(cy + R) + so;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    for (let ly = 0; ly < bh; ly++) for (let lx = 0; lx < bw; lx++) {
      const li = ly * bw + lx;
      if (lx >= bw - so || ly >= bh - so) { LB[li] = -1; continue; }
      const v = fn(x0 + lx + 0.5 - cx, y0 + ly + 0.5 - cy);
      LB[li] = v; LMB[li] = LMAT;
    }
    newStamp();
    for (let ly = 0; ly < bh; ly++) for (let lx = 0; lx < bw; lx++) {
      const li = ly * bw + lx, v = LB[li];
      if (v >= 0) put(x0 + lx, y0 + ly, LMB[li], v);
      else if (so && lx >= so && ly >= so && LB[li - so * bw - so] >= 0) dark(x0 + lx, y0 + ly, sa);
    }
  }
  // a rounded body shaded as a dome
  function dome(u, v, d2, ang) {
    const nz = Math.sqrt(Math.max(0, 1 - d2));
    const c = Math.cos(ang), s = Math.sin(ang);
    const nx = u * c - v * s, ny = u * s + v * c;
    return nx * LX + ny * LY + nz * LZ;
  }
  function blob(cx, cy, rx, ry, ang, so, sa, fn) {
    const R = Math.max(rx, ry) + 1, c = Math.cos(-ang), s = Math.sin(-ang);
    layer(cx, cy, R, (dx, dy) => {
      const u = (dx * c - dy * s) / rx, v = (dx * s + dy * c) / ry, d2 = u * u + v * v;
      if (d2 > 1) return -1;
      return fn(u, v, d2, dx, dy);
    }, so, sa);
  }

  /* ================================================================ layout */
  const GROT = 0.06;
  const SMALL = [], URCH = [], STARS = [], KELP = [], BARN = [], MOTES = [];
  let CENTRE = null;
  function tentSet(n, k) {
    const hl = new Float32Array(n), hw = new Float32Array(n), hp = new Float32Array(n);
    for (let i = 0; i < n; i++) { hl[i] = 0.86 + 0.26 * ih(i, k, 3); hw[i] = 0.85 + 0.3 * ih(i, k, 4); hp[i] = ih(i, k, 5) * TAU; }
    return { hl, hw, hp };
  }
  function layout(rnd) {
    CENTRE = {
      x: CX + 0.3, y: CY - 0.4,
      outer: Object.assign({ N: 46, rb: 9.5, L: 30, w0: 1.75, curl: 0.24, sway: 0.09, mat: M_CORAL, tip: M_CORAL, base: 1.3, top: 3.9, tipLv: 5, k: 101, ph: 0 }, tentSet(46, 101)),
      inner: Object.assign({ N: 26, rb: 7.5, L: 13, w0: 1.5, curl: -0.3, sway: 0.1, mat: M_CORAL, tip: M_PINK, base: 2.2, top: 4.4, tipLv: 4, k: 102, ph: 0.8 }, tentSet(26, 102)),
    };
    for (let k = 0; k < 8; k++) {
      const a = GROT + k * TAU / 8 + (rnd() - 0.5) * 0.05;
      const r = 57 + (rnd() - 0.5) * 2.4, sz = 1 + (rnd() - 0.5) * 0.14, ty = k & 1;
      const ph = k * TAU / 8 + (rnd() - 0.5) * 0.4;
      const o = ty === 0
        ? { N: 20, rb: 3.2 * sz, L: 9.6 * sz, w0: 1.3, curl: 0.3 + (rnd() - 0.5) * 0.2, sway: 0.12, mat: M_TEAL, tip: M_PINK, base: 2.5, top: 6.2, tipLv: 4, k: 200 + k, ph }
        : { N: 18, rb: 3.0 * sz, L: 9.0 * sz, w0: 1.35, curl: 0.3 + (rnd() - 0.5) * 0.2, sway: 0.12, mat: M_PINK, tip: M_PINK, base: 1.6, top: 3.6, tipLv: 5, k: 200 + k, ph };
      Object.assign(o, tentSet(o.N, o.k));
      const inn = { N: 10, rb: 1.6 * sz, L: 4.6 * sz, w0: 1.05, curl: -0.4, sway: 0.15, mat: o.mat, tip: o.tip, base: o.base + 0.6, top: o.top, tipLv: o.tipLv, k: 300 + k, ph: ph + 1 };
      Object.assign(inn, tentSet(inn.N, inn.k));
      SMALL.push({ x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r, ty, outer: o, inner: inn, ang: a });
      const ua = a + TAU / 16 + (rnd() - 0.5) * 0.06, ur = 86 + (rnd() - 0.5) * 3;
      URCH.push({ x: CX + Math.cos(ua) * ur, y: CY + Math.sin(ua) * ur, rb: 5.4 + (rnd() - 0.5) * 0.8, Ls: 7.2 + (rnd() - 0.5) * 1.2, dir: (k & 1) ? -1 : 1, k, ph: rnd() * TAU });
      const sa = a + (rnd() - 0.5) * 0.05, sr = 120 + (rnd() - 0.5) * 3;
      let mat = (k & 1) ? M_PURP : M_CORAL;
      if (k === 5) mat = M_OCHRE;
      const al = [], c0 = [], cp = [];
      for (let j = 0; j < 5; j++) { al.push(0.86 + 0.24 * rnd()); c0.push((rnd() - 0.5) * 0.5); cp.push(rnd() * TAU); }
      STARS.push({ x0: CX + Math.cos(sa) * sr, y0: CY + Math.sin(sa) * sr, R: 16.5 + (rnd() - 0.5) * 2.2, ang0: rnd() * TAU, mat, al, c0, cp, ph: rnd() * TAU, ph2: rnd() * TAU, k });
      const ka = a + TAU / 16 + 0.12 + (rnd() - 0.5) * 0.06;
      KELP.push({ a: ka, r0: rimR(ka) + 6, L: 74 + (rnd() - 0.5) * 8, Wm: 6.2 + (rnd() - 0.5) * 1.2, bend: 0.12 + (rnd() - 0.5) * 0.1, curv: -0.4 + (rnd() - 0.5) * 0.16, ph: k * 0.8 + rnd() * 0.5, k });
    }
    for (let k = 0; k < 18; k++) {
      const a = rnd() * TAU, r = 30 + rnd() * 125;
      MOTES.push({ x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r, rr: 4 + rnd() * 10, dir: rnd() < 0.5 ? 1 : -1, ph: rnd() * TAU, lv: 3 + rnd() * 2 });
    }
  }

  /* ================================================================ the bed */
  function buildGeometry() {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, dx = x + 0.5 - CX, dy = y + 0.5 - CY;
      const r = Math.hypot(dx, dy), th = Math.atan2(dy, dx), rr = rimR(th);
      PRR[i] = r; PTH[i] = th; EDG[i] = r - rr; RIM[i] = r > rr ? 1 : 0;
      const u = r / 290;
      const a1 = 2 * th + 19 * u, a2 = 5 * th - 9 * u;
      S1[i] = Math.sin(a1); C1[i] = Math.cos(a1); S2[i] = Math.sin(a2); C2[i] = Math.cos(a2);
    }
  }
  function buildGround() {
    const HG = new Float32Array(N), ID = new Int32Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (RIM[i]) {
        const wx = x + (fbm(x / 50, y / 50, 71, 3) - 0.5) * 34, wy = y + (fbm(x / 50, y / 50, 73, 3) - 0.5) * 34;
        worley(wx, wy, 48, 501);
        const e = WR_F2 - WR_F1;
        HG[i] = Math.sqrt(sstep(0, 30, e)) * 0.9 + fbm(x / 11, y / 11, 23, 3) * 0.28;
        ID[i] = e < 1.4 ? -1 : WR_ID;
      } else {
        HG[i] = fbm(x / 16, y / 16, 11, 3) * 0.8 + fbm(x / 5, y / 5, 13, 2) * 0.2;
      }
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, h = HG[i];
      const hb = HG[Math.max(0, y - 1) * W + Math.max(0, x - 1)] - HG[Math.min(H - 1, y + 1) * W + Math.min(W - 1, x + 1)];
      const g = ih(x, y, 5);
      if (RIM[i]) {
        const e = EDG[i];
        let lv = 0.8 + h * 2.0 + hb * 14;
        if (ID[i] < 0) lv = 0.25;
        lv -= 0.55 * (1 - sstep(0, 9, e));                         // wet band at the waterline
        lv -= 0.9 * sstep(22, 90, e);                              // the far rock sinks into shade
        if (g > 0.982 && e < 30) lv += 1.2;                        // wet glints
        let m = ih(ID[i], 3, 7) < 0.34 ? M_PURP : M_ROCK;
        if (m === M_PURP) lv = lv * 0.95 + 0.15;
        const pz = fbm(x / 13, y / 13, 41, 3);
        const band = -3 + pz * 16;
        if (e < band) { m = M_CORL; lv = 1.6 + (pz - 0.5) * 3 + hb * 6 + (g > 0.9 ? 0.8 : 0); if (e > band - 1.3) lv = 3.8; else if (e > band - 2.4) lv += 0.8; }
        BM[i] = m; BL[i] = Math.max(0, lv);
      } else {
        const d = -EDG[i];
        let lv = 1.85 + (h - 0.5) * 1.1 + hb * 4;
        if (g > 0.975) lv += 0.9; else if (g < 0.02) lv -= 0.8;
        let m = d < 6 ? M_ROCK : M_TEAL;
        const r = PRR[i], wob = (fbm(x / 7, y / 7, 131, 2) - 0.5) * 7;
        if (d >= 6 && r > 136 + wob) {                             // a ring of pink coralline turf by the wall
          m = M_PURP;
          const tf = fbm(x / 2.2, y / 2.2, 137, 2), tb = fbm(x / 9, y / 9, 139, 2);
          lv = 3.0 + (tb - 0.5) * 1.8 + hb * 3 + (tf < 0.38 ? -1 : 0);
          if (tf > 0.65) { m = M_CORL; lv = tf > 0.7 ? 4 : 3; }
          if (r < 139 + wob) { m = M_CORL; lv = 3; }
        } else if (r < 45 + wob * 0.6) {                           // shell grit round the great anemone
          m = M_PURP;
          lv = 1.7 + (h - 0.5) * 1.4 + (g > 0.9 ? 1.2 : g < 0.1 ? -0.8 : 0);
          if (r > 43 + wob * 0.6) lv = 2.6;
        }
        if (d < 6) {                                               // the pool wall
          const facing = -(Math.cos(PTH[i]) * LX + Math.sin(PTH[i]) * LY);
          lv = 1.7 + (h - 0.5) * 1.6 + facing * 1.1 * (1 - d / 6) + hb * 6;
        }
        const sx = x - 5, sy = y - 6;
        if (sx >= 0 && sy >= 0 && RIM[sy * W + sx]) lv -= 0.9;      // the overhang shadow
        BM[i] = m; BL[i] = Math.max(0, lv);
        WT[i] = 0.3 * (1 - sstep(0, 12, d));
      }
    }
  }
  let WR_F1 = 0, WR_F2 = 0, WR_ID = 0;
  function worley(x, y, cell, s) {
    const px = x / cell, py = y / cell, ix = fl(px), iy = fl(py);
    let f1 = 9, f2 = 9, id = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = ix + i, cy = iy + j;
      const ox = cx + 0.12 + 0.76 * ih(cx, cy, s), oy = cy + 0.12 + 0.76 * ih(cx, cy, s + 1);
      const dx = px - ox, dy = py - oy, d = Math.sqrt(dx * dx + dy * dy);
      if (d < f1) { f2 = f1; f1 = d; id = (cx + 500) * 1031 + cy + 500; } else if (d < f2) f2 = d;
    }
    WR_F1 = f1 * cell; WR_F2 = f2 * cell; WR_ID = id;
  }

  /* ---------------------------------------------------------------- items */
  function drawPebble(it) {
    const kind = it.kind;
    const mat = [M_STONE, M_OCHRE, M_PURP, M_STONE, M_ROCK, M_GLASS][kind];
    const base = [2.5, 2.3, 2.9, 3.9, 2.6, 2.6][kind];
    const vein = ih(it.id, 1, 9) < 0.3, va = ih(it.id, 2, 9) * TAU, vc = Math.cos(va), vs = Math.sin(va);
    blob(it.x, it.y, it.r, it.r * it.ecc, it.ang, 1, 0.9, (u, v, d2, dx, dy) => {
      LMAT = mat;
      const sh = dome(u, v, d2, it.ang);
      let lv = base + (sh - 0.45) * 2.2;
      const g = ih(fl(it.x + dx), fl(it.y + dy), 61 + it.id);
      if (g > 0.86) lv += 0.8; else if (g < 0.12) lv -= 0.7;
      if (vein && Math.abs(u * vc + v * vs) < 0.16) lv += 1.4;
      if (d2 > 0.7 && sh < 0.4) lv -= 0.7;
      if (sh > 0.93) lv += 0.9;
      return Math.max(0, lv);
    });
  }
  function drawGlass(it) {
    const mat = [M_GLASS, M_GLASS, M_OCHRE, M_PURP, M_TEAL][it.kind];
    const base = [2.5, 3.2, 4.2, 4.2, 5][it.kind];
    const R = it.r + 1, c = Math.cos(-it.ang), s = Math.sin(-it.ang);
    layer(it.x, it.y, R, (dx, dy) => {
      const u = (dx * c - dy * s) / it.r, v = (dx * s + dy * c) / (it.r * 0.72);
      const q = Math.pow(Math.abs(u), 3) + Math.pow(Math.abs(v), 3);
      if (q > 1) return -1;
      LMAT = mat;
      let lv = base + (ih(fl(it.x + dx), fl(it.y + dy), 71) - 0.5) * 0.9;
      if (q > 0.55) lv += 0.9;
      const hx = u + 0.35, hy = v + 0.35;
      if (hx * hx + hy * hy < 0.12) lv += 1.6;
      if (q > 0.62 && u + v > 0.4) lv -= 1.3;
      return lv;
    }, 1, 0.6);
  }
  function drawSnail(it) {
    // a periwinkle from above: the spire, three whorls with dark sutures and spiral bands, the aperture lip
    const mat = [M_OCHRE, M_STONE, M_PURP, M_STONE, M_OCHRE][it.kind];
    const base = [2.0, 3.0, 2.0, 2.0, 3.0][it.kind];
    const ap = it.ang, cs = Math.cos(ap), sn = Math.sin(ap);
    const R = it.r;
    blob(it.x, it.y, R, R * 0.92, ap, 1, 1.0, (u, v, d2) => {
      LMAT = mat;
      const au = u * cs + v * sn, av = -u * sn + v * cs;         // shell frame: aperture toward +au
      const ad = ((au - 0.6) * (au - 0.6)) / 0.12 + (av * av) / 0.1;
      if (ad < 1) return ad < 0.45 ? 0 : base + 2.5;
      const pu = au + 0.2, pv = av + 0.05;
      const rho = Math.sqrt(pu * pu + pv * pv) + 0.001, ph = Math.atan2(pv, pu);
      const s = ph / TAU - 1.6 * Math.log(rho * 1.2 + 0.05);
      const w = fr(s);
      const sh = dome(u, v, d2, 0);
      let lv = base + Math.round((sh - 0.5) * 2.2);
      if (w < 0.2) lv = Math.max(0, base - 2);
      else if (w < 0.34) lv += 1;
      else if (w > 0.6 && w < 0.74) lv += it.kind === 4 ? -2 : 0.5;
      if (rho < 0.13) lv = base + 3;
      if (d2 > 0.8 && sh < 0.5) lv -= 1;
      return Math.max(0, lv);
    });
  }
  function drawMussel(x, y, len, wid, ang, id) {
    const c = Math.cos(-ang), s = Math.sin(-ang);
    layer(x, y, len + 1, (dx, dy) => {
      const a = (dx * c - dy * s) / len, b = (dx * s + dy * c) / wid;
      if (a < -1 || a > 1) return -1;
      const half = Math.sqrt(1 - a * a) * (0.38 + 0.62 * (a + 1) / 2) + (a > -0.85 ? 0.05 : 0);
      if (Math.abs(b) > half) return -1;
      LMAT = M_MUSS;
      const q = b / half, nz = Math.sqrt(Math.max(0, 1 - q * q));
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const nx = -sa * q, ny = ca * q;
      const sh = nx * LX + ny * LY + nz * LZ;
      void sh;
      const side = (-sa * LX + ca * LY) * q;                     // > 0 on the side facing the light
      let lv = 1;
      if (side > 0.12 && a > -0.65 && a < 0.75) lv = side > 0.3 && a > -0.35 && a < 0.45 ? 3 : 2;
      const g = Math.hypot(a + 1, b * 0.7);
      if (fr(g * 3.2 + ih(id, 3, 5)) < 0.14 && lv > 1) lv -= 1;
      if (a > 0.7 && Math.abs(q) < 0.8) lv = 2;
      if (Math.abs(q) > 0.82 || a > 0.9) lv = side > 0.2 ? 2 : 0;
      return Math.max(0, lv);
    }, 1, 1.0);
  }
  function drawMusselCluster(it) {
    // a clump: mussels side by side, all hinged toward one anchor and fanning slightly
    const n = 4 + fl(ih(it.id, 4, 1) * 4);
    const base = it.ang;
    const ca = Math.cos(base), sa = Math.sin(base), nx = -sa, ny = ca;
    const list = [];
    for (let k = 0; k < n; k++) {
      const q = n > 1 ? k / (n - 1) - 0.5 : 0;
      const a = base + q * 0.9 + (ih(it.id, k, 7) - 0.5) * 0.3;
      const len = it.r * (0.5 + 0.18 * ih(it.id, k, 8));
      const off = q * it.r * 1.25, fwd = (ih(it.id, k, 9) - 0.5) * it.r * 0.4;
      list.push([it.x + nx * off + ca * fwd + Math.cos(a) * len * 0.35, it.y + ny * off + sa * fwd + Math.sin(a) * len * 0.35, len, len * 0.74, a, it.id * 10 + k]);
    }
    list.sort((p, q) => (p[0] - it.x) * LX + (p[1] - it.y) * LY - ((q[0] - it.x) * LX + (q[1] - it.y) * LY)).reverse();
    for (const m of list) drawMussel(...m);
  }
  function drawBarnShell(b) {
    const r = b.r, dc = Math.cos(-b.dir), ds = Math.sin(-b.dir);
    layer(b.x, b.y, r + 1, (dx, dy) => {
      const rho = Math.hypot(dx, dy) / r;
      if (rho > 1) return -1;
      LMAT = M_STONE;
      const th = Math.atan2(dy, dx);
      const u = (dx * dc - dy * ds) / r, v = (dx * ds + dy * dc) / r;
      const op = Math.abs(u) / 0.5 + Math.abs(v) / 0.34;
      if (op < 1) { LMAT = b.rim ? M_STONE : M_PURP; return b.rim ? (op < 0.5 ? 1.5 : 0.6) : (op < 0.6 ? 0.3 : 1.2); }
      if (op < 1.35) return 4.6;
      const slope = (dx * LX + dy * LY) / (Math.hypot(dx, dy) + 0.01);
      let lv = 3.1 - slope * 1.4 * rho - rho * 0.6;
      const seam = Math.abs(Math.sin((th + b.k) * 3));
      if (seam < 0.12) lv -= 1.2;
      if (fr(rho * 3.2 + th * 0.3) < 0.2) lv -= 0.4;
      if (rho > 0.86) lv -= 0.8;
      return Math.max(0, lv);
    }, 1, 1.0);
  }
  function drawCrust(it) {
    // encrusting coralline: a flat lilac-pink patch with a pale growing margin and tiny pores
    layer(it.x, it.y, it.r * 1.5 + 2, (dx, dy) => {
      const x = it.x + dx, y = it.y + dy;
      const n = fbm(x / 5, y / 5, 83 + it.id, 3);
      const rho = Math.hypot(dx, dy) / it.r;
      const lim = 0.75 + (n - 0.5) * 1.6;
      if (rho > lim) return -1;
      LMAT = M_CORL;
      let lv = 2;
      if (rho > lim - 0.14) lv = 4;
      else if (rho > lim - 0.3) lv = 3;
      else if (ih(fl(x), fl(y), 91) > 0.9) lv = 3;
      else if (n > 0.55) lv = 2.6;
      return lv;
    }, 0, 0);
  }
  function drawUlva(it) {
    layer(it.x, it.y, it.r + 2, (dx, dy) => {
      const x = it.x + dx, y = it.y + dy;
      const n = fbm(x / 4.5, y / 4.5, 97 + it.id, 3);
      const rho = Math.hypot(dx, dy) / it.r;
      const lim = 0.85 + (n - 0.5) * 0.8;
      if (rho > lim) return -1;
      LMAT = M_GLASS;
      const fold = Math.sin(rho * 9 + n * 11 + Math.atan2(dy, dx) * 2);
      let lv = 2.4 + fold * 0.7 + (n - 0.5);
      if (rho > lim - 0.12) lv += 1.0;
      return Math.max(0, lv);
    }, 1, 0.7);
  }
  function drawTuft(it) {
    newStamp();
    const segs = [];
    const branch = (x, y, a, len, depth, w) => {
      const steps = Math.max(2, fl(len / 0.5));
      let px = x, py = y;
      for (let s = 0; s < steps; s++) {
        const ss = s * 0.5;
        a += (ih(it.id, depth * 31 + s, 13) - 0.5) * 0.12;
        px += Math.cos(a) * 0.5; py += Math.sin(a) * 0.5;
        const joint = fr(ss / 2.4) < 0.22;
        segs.push([px, py, joint ? 1.8 : 3.5 + (ss / len) * 0.8 + depth * 0.2, w]);
      }
      if (depth > 0) {
        branch(px, py, a - 0.48, len * 0.74, depth - 1, 0);
        branch(px, py, a + 0.48, len * 0.74, depth - 1, 0);
      } else segs.push([px, py, 5, 0]);
    };
    const n = 2 + fl(ih(it.id, 1, 17) * 2);
    for (let k = 0; k < n; k++) branch(it.x, it.y, it.ang + (k - (n - 1) / 2) * 0.9, it.r * 0.42, 2, 1);
    for (const s of segs) dark(s[0] + 1, s[1] + 1, 0.9);
    for (const s of segs) { put(s[0], s[1], M_CORL, s[2]); if (s[3]) put(s[0] + 0.6, s[1] + 0.6, M_CORL, s[2] - 0.8); }
  }
  function drawLimpet(it) {
    const apx = 0.12 * Math.cos(it.ang), apy = 0.12 * Math.sin(it.ang);
    blob(it.x, it.y, it.r, it.r * 0.86, it.ang, 1, 1.1, (u, v, d2) => {
      LMAT = it.kind ? M_OCHRE : M_STONE;
      const pu = u - apx, pv = v - apy, rho = Math.hypot(pu, pv), ph = Math.atan2(pv, pu);
      const slope = (pu * LX + pv * LY) / (rho + 0.01);
      let lv = (it.kind ? 3.0 : 2.8) - slope * 1.5 + Math.cos(ph * 13 + it.id) * 0.6;
      if (fr(rho * 3.4) < 0.18) lv -= 0.5;
      if (rho < 0.14) lv = it.kind ? 5.2 : 4.6;
      if (d2 > 0.82) lv -= 0.9;
      return Math.max(0, lv);
    });
  }
  function drawHoldfast(kp) {
    const hx = CX + Math.cos(kp.a) * kp.r0, hy = CY + Math.sin(kp.a) * kp.r0;
    newStamp();
    for (let j = 0; j < 9; j++) {
      let a = kp.a + (j / 8 - 0.5) * 2.6 + (ih(kp.k, j, 19) - 0.5) * 0.4, x = hx, y = hy;
      const L = 4 + ih(kp.k, j, 21) * 5;
      for (let s = 0; s < L; s += 0.5) {
        x += Math.cos(a) * 0.5; y += Math.sin(a) * 0.5; a += (ih(kp.k, j * 9 + fl(s), 23) - 0.5) * 0.5;
        dark(x + 1, y + 1, 1);
        put(x, y, M_KELP, 1.6 + (s / L) * 1.4);
      }
    }
    layer(hx, hy, 3, (dx, dy) => { const d2 = (dx * dx + dy * dy) / 5.5; if (d2 > 1) return -1; LMAT = M_KELP; return 1.2 + (dome(dx / 2.4, dy / 2.4, d2, 0) - 0.4) * 2.5; }, 1, 1);
  }

  /* packing: placed in one wedge, repeated eight times with jitter, swaps and gaps */
  const GRID = new Map();
  const ITEMS = [];
  function gkey(cx, cy) { return cx * 1000 + cy; }
  function fits(x, y, r, reserved) {
    for (const d of reserved) { const dx = x - d[0], dy = y - d[1]; if (dx * dx + dy * dy < (r + d[2]) * (r + d[2])) return false; }
    const gx = fl(x / 10), gy = fl(y / 10);
    for (let j = gy - 2; j <= gy + 2; j++) for (let i = gx - 2; i <= gx + 2; i++) {
      const cell = GRID.get(gkey(i, j)); if (!cell) continue;
      for (const o of cell) { const dx = x - o.x, dy = y - o.y, rr = r + o.r + 0.6; if (dx * dx + dy * dy < rr * rr) return false; }
    }
    return true;
  }
  function addItem(it) {
    ITEMS.push(it);
    const k = gkey(fl(it.x / 10), fl(it.y / 10));
    if (!GRID.has(k)) GRID.set(k, []);
    GRID.get(k).push(it);
  }
  const ZONES = [
    { r0: 41, r1: 103, w: { peb: 3, gls: 2, snl: 2.6, tuf: 1.3, crs: 1.6, ulv: 1.0, bar: 0.5 } },
    { r0: 103, r1: 137, w: { peb: 2, gls: 1.2, snl: 1.6, mus: 1.6, crs: 1.4, tuf: 1.1, bar: 1.6, ulv: 0.6 } },
    { r0: 137, r1: 166, w: { bar: 4.2, mus: 2.6, peb: 1.6, tuf: 1.4, crs: 1.0, snl: 1.2, gls: 0.6, ulv: 0.4 } },
  ];
  const SIZE = { peb: [2.6, 5.6], gls: [2.2, 3.6], snl: [3.4, 5.6], mus: [9, 13], bar: [2.4, 4.4], crs: [4, 8], tuf: [5, 8], ulv: [5, 9] };
  function pickType(w, u) {
    let s = 0; for (const k in w) s += w[k];
    let a = u * s; for (const k in w) { a -= w[k]; if (a <= 0) return k; }
    return 'peb';
  }
  function makeItem(type, x, y, r, id, rnd) {
    const it = { type, x, y, r, id, ang: rnd() * TAU, ecc: 0.7 + rnd() * 0.3, kind: 0 };
    if (type === 'peb') { const u = rnd(); it.kind = u < 0.4 ? 0 : u < 0.5 ? 1 : u < 0.68 ? 2 : u < 0.84 ? 3 : u < 0.94 ? 4 : 5; }
    if (type === 'gls') { const u = rnd(); it.kind = u < 0.45 ? 0 : u < 0.7 ? 1 : u < 0.83 ? 2 : u < 0.93 ? 3 : 4; }
    if (type === 'snl') { const u = rnd(); it.kind = u < 0.36 ? 0 : u < 0.56 ? 1 : u < 0.72 ? 2 : u < 0.86 ? 3 : 4; if (RIM[fl(y) * W + fl(x)] && u < 0.5) it.kind = 2; }
    if (type === 'tuf') { const th = Math.atan2(y - CY, x - CX); it.ang = th + (rnd() - 0.5) * 1.2; }
    if (type === 'bar') { it.dir = Math.atan2(y - CY, x - CX) + Math.PI / 2 + (rnd() - 0.5) * 0.8; it.k = rnd() * TAU; }
    return it;
  }
  function pack(rnd) {
    const reserved = [[CX, CY, 37]];
    SMALL.forEach((s) => reserved.push([s.x, s.y, 13.5]));
    URCH.forEach((u) => reserved.push([u.x, u.y, u.rb + u.Ls + 1.5]));
    STARS.forEach((s) => reserved.push([s.x0, s.y0, s.R + 1.5]));
    let id = 1;
    const beadRing = (rad, n, rr, mats) => {
      for (let k = 0; k < n; k++) {
        if (ih(k, rad, 33) < 0.07) continue;
        const a = GROT + k * TAU / n + (ih(k, rad, 34) - 0.5) * 0.05, rj = rad + (ih(k, rad, 35) - 0.5) * 1.4;
        const x = CX + Math.cos(a) * rj, y = CY + Math.sin(a) * rj, r = rr * (0.82 + 0.36 * ih(k, rad, 36));
        if (!fits(x, y, r, reserved)) continue;
        addItem({ type: 'peb', x, y, r, id: id++, ang: a, ecc: 0.85, kind: mats[k % mats.length] });
      }
    };
    beadRing(40, 60, 1.35, [3, 3, 5, 3, 1]);
    beadRing(102, 104, 1.45, [3, 0, 3, 5, 3, 1]);
    // one wedge, repeated eight times with small jitters, swaps and gaps
    let minCopies = 6;
    const placeSym = (r0, th, type, r) => {
      const cand = [];
      for (let k = 0; k < 8; k++) {
        if (rnd() < 0.08) continue;
        const a = th + k * TAU / 8 + (rnd() - 0.5) * 0.03;
        const rr = r0 + (rnd() - 0.5) * 1.8;
        const x = CX + Math.cos(a) * rr, y = CY + Math.sin(a) * rr;
        const rs = r * (0.88 + rnd() * 0.24);
        if (Math.hypot(x - CX, y - CY) + rs > rimR(a) - 2.5) continue;
        let ty = type;
        if (rnd() < 0.1) ty = ['peb', 'snl', 'gls'][fl(rnd() * 3)];
        if (fits(x, y, rs, reserved)) cand.push(makeItem(ty, x, y, rs, id++, rnd));
      }
      if (cand.length >= minCopies) { cand.forEach(addItem); return true; }
      return false;
    };
    const wedge = TAU / 8;
    const CL = [
      [57, 0.5, 7.5, { snl: 2.2, gls: 1.6, peb: 1 }],
      [87, 0.0, 9, { tuf: 1.6, peb: 2, crs: 1.2, snl: 1 }],
      [71, 0.24, 4.5, { peb: 2, gls: 1 }],
      [71, 0.76, 4.5, { peb: 2, gls: 1, snl: 0.6 }],
      [121, 0.5, 12, { mus: 3, crs: 1.2, bar: 1.2, snl: 0.8 }],
      [109, 0.2, 5, { snl: 2, peb: 1 }],
      [109, 0.8, 5, { gls: 1.6, peb: 1 }],
      [136, 0.1, 6, { crs: 1, ulv: 1, peb: 1 }],
      [136, 0.9, 6, { crs: 1, tuf: 1, peb: 1 }],
    ];
    for (const sc of [1.0, 0.85]) {
      for (const cl of CL) {
        for (let t = 0; t < 26; t++) {
          const a = rnd() * TAU, d = Math.sqrt(rnd()) * cl[2];
          const px = Math.cos(GROT + cl[1] * wedge) * cl[0] + Math.cos(a) * d, py = Math.sin(GROT + cl[1] * wedge) * cl[0] + Math.sin(a) * d;
          const r0 = Math.hypot(px, py), th = Math.atan2(py, px);
          let type = pickType(cl[3], rnd());
          const sz = SIZE[type];
          let r = Math.max(2.2, (sz[0] + rnd() * (sz[1] - sz[0])) * sc);
          if (type === 'mus' && r < 6.5) type = 'peb';
          if ((type === 'tuf' || type === 'ulv') && r < 3.5) type = 'gls';
          placeSym(r0, th, type, r);
        }
      }
    }
    // the reef ring by the wall: packed
    minCopies = 4;
    const RING = { bar: 4.2, mus: 2.8, peb: 1.4, tuf: 1.3, crs: 1.2, snl: 1.2, gls: 0.5, ulv: 0.5 };
    for (const [sc, tries] of [[1.0, 300], [0.8, 500], [0.62, 800]]) {
      for (let t = 0; t < tries; t++) {
        const r0 = 139 + rnd() * 27, th = GROT + rnd() * wedge;
        let type = pickType(RING, rnd());
        const sz = SIZE[type];
        let r = Math.max(1.6, (sz[0] + rnd() * (sz[1] - sz[0])) * sc);
        if (type === 'mus' && r < 6.5) type = 'bar';
        if ((type === 'tuf' || type === 'ulv') && r < 3.5) type = 'bar';
        placeSym(r0, th, type, r);
      }
    }
    // a few strays on the open floor
    for (let t = 0; t < 12; t++) {
      const r0 = 44 + rnd() * 90, th = GROT + rnd() * wedge, type = rnd() < 0.5 ? 'peb' : 'gls';
      placeSym(r0, th, type, 1.6 + rnd() * 0.8);
    }
    // the rim rock: barnacle colonies, mussel beds, limpets and periwinkles, not symmetric at all
    const rimFits = (x, y, r) => {
      const xi = fl(x), yi = fl(y);
      if (xi < 1 || yi < 1 || xi >= W - 1 || yi >= H - 1) return false;
      if (!RIM[yi * W + xi]) return false;
      if (EDG[yi * W + xi] < r + 0.5) return false;
      return fits(x, y, r, []);
    };
    const around = (e0, e1) => { const a = rnd() * TAU, e = e0 + rnd() * (e1 - e0), rr = rimR(a) + e; return [CX + Math.cos(a) * rr, CY + Math.sin(a) * rr]; };
    for (let c = 0; c < 16; c++) {                                   // mussel beds at the waterline
      const [cx, cy] = around(3, 14);
      const n = 5 + fl(rnd() * 8), base = Math.atan2(cy - CY, cx - CX);
      for (let j = 0; j < n * 2; j++) {
        const a = rnd() * TAU, d = Math.sqrt(rnd()) * 9;
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, r = 4.4 + rnd() * 2.2;
        if (rimFits(x, y, r)) { const it = makeItem('mus1', x, y, r, id++, rnd); it.ang = base + (rnd() - 0.5) * 1.2; it.rim = 1; addItem(it); }
      }
    }
    for (let c = 0; c < 70; c++) {                                   // barnacle colonies
      const [cx, cy] = around(2, 4 + Math.pow(rnd(), 2) * 26);
      const n = 8 + fl(rnd() * 18);
      for (let j = 0; j < n * 3; j++) {
        const a = rnd() * TAU, d = Math.sqrt(rnd()) * 10;
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, r = 1.5 + rnd() * 1.9;
        if (rimFits(x, y, r)) { const it = makeItem('bar', x, y, r, id++, rnd); it.rim = 1; it.dir = Math.atan2(y - CY, x - CX) + Math.PI + (rnd() - 0.5) * 1.4; addItem(it); }
      }
    }
    for (let t = 0; t < 420; t++) {
      const [x, y] = around(3, 4 + Math.pow(rnd(), 1.6) * 50);
      const u = rnd();
      const type = u < 0.55 ? 'lim' : 'snl';
      const r = type === 'lim' ? 3 + rnd() * 3.4 : type === 'snl' ? 2.2 + rnd() * 1.8 : 1.6 + rnd() * 2;
      if (rimFits(x, y, r)) { const it = makeItem(type, x, y, r, id++, rnd); it.rim = 1; if (type === 'lim') it.kind = rnd() < 0.08 ? 1 : 0; addItem(it); }
    }
  }
  function drawItems() {
    const order = ['crs', 'ulv', 'peb', 'gls', 'lim', 'snl', 'mus1', 'mus', 'bar', 'tuf'];
    for (const ty of order) for (const it of ITEMS) {
      if (it.type !== ty) continue;
      if (ty === 'peb') drawPebble(it);
      else if (ty === 'gls') drawGlass(it);
      else if (ty === 'snl') drawSnail(it);
      else if (ty === 'mus') drawMusselCluster(it);
      else if (ty === 'mus1') drawMussel(it.x, it.y, it.r, it.r * 0.74, it.ang, it.id);
      else if (ty === 'crs') drawCrust(it);
      else if (ty === 'ulv') drawUlva(it);
      else if (ty === 'tuf') drawTuft(it);
      else if (ty === 'lim') drawLimpet(it);
      else if (ty === 'bar') {
        const b = { x: it.x, y: it.y, r: it.r, dir: it.dir, k: it.k, rim: it.rim || 0, ph: ih(it.id, 7, 3) * TAU, per: [4, 6, 8, 6][fl(ih(it.id, 8, 3) * 4)], n: 5 + fl(ih(it.id, 9, 3) * 3) };
        drawBarnShell(b);
        BARN.push(b);
      }
    }
  }
  function buildBed() {
    TM = BM; TL = BL;
    SMALL.length = 0; URCH.length = 0; STARS.length = 0; KELP.length = 0; BARN.length = 0; MOTES.length = 0; ITEMS.length = 0; GRID.clear();
    const rnd = mulberry32((SEED * 2654435761 + 977) >>> 0);
    buildGeometry();
    layout(rnd);
    buildGround();
    pack(rnd);
    drawItems();
    for (const kp of KELP) drawHoldfast(kp);
  }

  /* ================================================================ creatures, per frame */
  let T = 0, TT = 0, LEAN = 0, F = 2, ROT1 = 0, ROT2 = 0, CR1 = 1, SR1 = 0, CR2 = 1, SR2 = 0;

  function tentacles(cx, cy, P, open) {
    const Lmax = P.L * 1.13 + 1;
    const off = P.ph * 0.0 + (P.k % 7) * 0.13;
    const N = P.N, k2 = N / TAU;
    const common = P.curl + LEAN * 0.16;
    for (let i = 0; i < N; i++) {
      TLI[i] = P.L * P.hl[i] * (0.74 + 0.26 * open);
      TS1[i] = P.sway * Math.sin(TT * 3 + P.hp[i] + P.ph);
      TS2[i] = 0.04 * Math.sin(TT * 2 + P.hp[i] * 2);
    }
    layer(cx, cy, P.rb + Lmax + 1, (dx, dy) => {
      const rho = Math.hypot(dx, dy);
      if (rho < P.rb * 0.6 || rho > P.rb + Lmax) return -1;
      const th = Math.atan2(dy, dx);
      const f0 = (rho - P.rb) / P.L;
      const i0 = Math.round((th - off - f0 * common) * k2);
      let best = -1, bd = 9;
      for (let di = -1; di <= 1; di++) {
        const ii = i0 + di, i = ((ii % N) + N) % N;
        const Li = TLI[i];
        const f = (rho - P.rb) / Li;
        if (f > 1) continue;
        const ff = f < 0 ? 0 : f;
        const bend = ff * (common + TS1[i]) + ff * ff * TS2[i];
        const phi = ii / k2 + off + bend;
        const d = wrapA(th - phi) * rho;
        const w = P.w0 * P.hw[i] * (1 - 0.7 * ff) + 0.35;
        const tipStart = P.rb + Li - w;
        let inside;
        if (rho > tipStart) { const q = rho - tipStart; inside = q * q + d * d < w * w; } else inside = Math.abs(d) < w;
        if (!inside) continue;
        const c = Math.abs(d) / w;
        if (c < bd) { bd = c; best = i; LB_F = ff; LB_C = d / w; LB_PHI = phi; }
      }
      if (best < 0) return -1;
      const c = LB_C, nz = Math.sqrt(Math.max(0, 1 - c * c));
      const nx = -Math.sin(LB_PHI) * c, ny = Math.cos(LB_PHI) * c;
      const sh = nx * LX + ny * LY + nz * LZ;
      let lv;
      if (LB_F > 0.8) { LMAT = P.tip; lv = P.tipLv + (sh - 0.5) * 1.2; }
      else { LMAT = P.mat; lv = P.base + (P.top - P.base) * Math.pow(LB_F, 0.8) + (sh - 0.5) * 1.4; }
      if (Math.abs(c) > 0.72 && sh < 0.5) lv -= 1;
      else if (Math.abs(c) < 0.3 && sh > 0.5) lv += 0.4;
      return Math.max(0, lv);
    }, 1, 1.0);
  }
  let LB_F = 0, LB_C = 0, LB_PHI = 0;
  const TLI = new Float32Array(64), TS1 = new Float32Array(64), TS2 = new Float32Array(64);

  function drawCentre(t) {
    const C = CENTRE;
    const open = 0.5 - 0.5 * Math.cos(TAU * t / 8);
    // the column and oral disc
    layer(C.x, C.y, 13, (dx, dy) => {
      const rho = Math.hypot(dx, dy);
      if (rho > 12.5) return -1;
      const th = Math.atan2(dy, dx);
      if (rho < 9.5) {
        const ma = 0.7, mc = Math.cos(ma), ms = Math.sin(ma);
        const u = dx * mc + dy * ms, v = -dx * ms + dy * mc;
        const mw = 3.0 + open * 0.6;
        const md = (u * u) / (mw * mw) + (v * v) / 2.1;
        if (md < 1) { LMAT = M_PURP; return md < 0.5 ? 0.4 : 1.6; }
        if (md < 1.7) { LMAT = M_PINK; return 3.8 - (md - 1) * 1.2; }
        const s = Math.cos(16 * th + 0.5 * Math.sin(rho * 0.6));
        LMAT = s > 0.25 ? M_PINK : M_CORAL;
        return (LMAT === M_PINK ? 2.4 : 2.9) + rho / 9.5 * 1.0 + s * 0.35;
      }
      LMAT = M_CORAL;
      return Math.cos(24 * th) > 0.55 ? 3.6 : 1.4;
    }, 0, 0);
    tentacles(C.x, C.y, C.outer, open);
    tentacles(C.x, C.y, C.inner, 0.5 - 0.5 * Math.cos(TAU * t / 8 - 0.5));
  }
  function drawSmall(t) {
    for (const s of SMALL) {
      const open = 0.5 - 0.5 * Math.cos(TAU * t / 8 - s.outer.ph);
      layer(s.x, s.y, 4, (dx, dy) => {
        const rho = Math.hypot(dx, dy);
        if (rho > 3.6) return -1;
        if (rho < 0.9 + open * 0.4) { LMAT = M_PURP; return 0.5; }
        LMAT = s.ty === 0 ? M_PURP : M_OCHRE;
        return (s.ty === 0 ? 3.2 : 3.4) + Math.cos(Math.atan2(dy, dx) * 8) * 0.6;
      }, 1, 0.8);
      tentacles(s.x, s.y, s.outer, open);
      tentacles(s.x, s.y, s.inner, 0.5 - 0.5 * Math.cos(TAU * t / 8 - s.outer.ph - 0.6));
    }
  }
  function drawUrchins(t) {
    for (const u of URCH) {
      const rot = u.dir * TAU / 3 * (t / D) + u.ph;
      const rb = u.rb;
      layer(u.x, u.y, rb + 1, (dx, dy) => {
        const d2 = (dx * dx + dy * dy) / (rb * rb);
        if (d2 > 1) return -1;
        LMAT = M_PURP;
        const sh = dome(dx / rb, dy / rb, d2, 0);
        const rho = Math.sqrt(d2) * rb, th = Math.atan2(dy, dx) - rot;
        let lv = 2.0 + (sh - 0.45) * 2.6;
        const sec = fr(th * 15 / TAU);
        if (Math.abs(sec - 0.5) < 0.18 && fr(rho / 1.5) < 0.5) lv += 1.1;
        if (rho < 1.1) lv = 1.0; else if (rho < 1.9) lv = 4.2;
        return Math.max(0, lv);
      }, 2, 1.0);
      const pts = [];
      for (let j = 0; j < 30; j++) {
        const jm = j % 10;
        const a = TAU * j / 30 + rot + 0.04 * Math.sin(TAU * t / 6 + jm * 0.9 + u.k);
        const L = u.Ls * (0.72 + 0.5 * ih(jm, u.k, 77));
        const ca = Math.cos(a), sa = Math.sin(a);
        const lit = -(ca * LX + sa * LY);
        for (let r = rb - 0.8; r <= rb + L; r += 0.45) {
          const f = (r - rb) / L;
          pts.push(u.x + ca * r, u.y + sa * r, f > 0.86 ? 6 : 2.1 + f * 2.8 + lit * 0.7, f);
        }
        const a2 = a + TAU / 60, c2 = Math.cos(a2), s2 = Math.sin(a2);
        for (let r = rb - 0.5; r <= rb + 3.0; r += 0.5) pts.push(u.x + c2 * r, u.y + s2 * r, 2.6 + lit * 0.5, 0.2);
        if (jm % 3 === 0) {
          const a3 = a + TAU / 60 + 0.05 * Math.sin(TAU * t / 4 + jm), rf = rb + 4.5 + 1.2 * Math.sin(TAU * t / 8 + jm * 1.7);
          pts.push(u.x + Math.cos(a3) * rf, u.y + Math.sin(a3) * rf, -1, 0.5);
        }
      }
      newStamp();
      for (let k = 0; k < pts.length; k += 4) if (pts[k + 3] > 0.15) dark(pts[k] + 1, pts[k + 1] + 2, 0.9);
      for (let k = 0; k < pts.length; k += 4) {
        if (pts[k + 2] < 0) put(pts[k], pts[k + 1], M_PINK, 4);
        else put(pts[k], pts[k + 1], M_PURP, pts[k + 2]);
      }
    }
  }
  function drawStars(t) {
    for (const S of STARS) {
      const x = S.x0 + 1.5 * Math.sin(T + S.ph), y = S.y0 + 1.2 * Math.sin(T + S.ph + 1.3);
      const ang = S.ang0 + 0.07 * Math.sin(T + S.ph2);
      const ca = Math.cos(-ang), sa = Math.sin(-ang);
      const R = S.R, base = S.mat === M_PURP ? 2.6 : S.mat === M_OCHRE ? 2.8 : 2.3;
      const bump = S.mat === M_PURP ? 2.8 : 1.6;
      const cu = [];
      for (let a = 0; a < 5; a++) cu.push(S.c0[a] * 0.5 + 0.12 * Math.sin(TT * 2 + S.cp[a]));
      layer(x, y, R + 2, (dx, dy) => {
        const lx = dx * ca - dy * sa, ly = dx * sa + dy * ca;
        const rho = Math.hypot(lx, ly);
        if (rho > R * 1.25 + 1) return -1;
        const phi = Math.atan2(ly, lx);
        let lv = -1, bestQ = 9;
        for (let a = 0; a < 5; a++) {
          const del = wrapA(phi - a * TAU / 5);
          if (Math.abs(del) > 1.25) continue;
          const s = rho * Math.cos(del), d = rho * Math.sin(del);
          const La = R * S.al[a];
          if (s < 0 || s > La) continue;
          const dd = d - cu[a] * s * s / La;
          const hw = 4.9 * (1 - 0.74 * s / La) + 0.6;
          let inside = Math.abs(dd) < hw;
          const ts = La - hw;
          if (s > ts) { const q = s - ts; inside = q * q + dd * dd < hw * hw; }
          if (!inside) continue;
          const q = dd / hw;
          if (Math.abs(q) < bestQ) {
            bestQ = Math.abs(q);
            const nz = Math.sqrt(Math.max(0, 1 - q * q * 0.8));
            const aa = a * TAU / 5 + ang, nx = -Math.sin(aa) * q, ny = Math.cos(aa) * q;
            const sh = nx * LX + ny * LY + nz * LZ;
            lv = base + (sh - 0.5) * 2.2;
            const rows = [0, -0.56, 0.56];
            for (let rI = 0; rI < 3; rI++) {
              if (Math.abs(q - rows[rI]) < 0.2 && fr(s / 2.2 + rI * 0.37) < 0.48) { lv += bump * (rI ? 0.75 : 1); break; }
            }
            if (Math.abs(q) > 0.8) lv -= 0.9;
            if (s > La - 2.2) lv += 0.6;
          }
        }
        if (rho < 5.8) {
          const nz = Math.sqrt(Math.max(0, 1 - (rho / 6) * (rho / 6)));
          const sh = (lx / 6 * Math.cos(ang) - ly / 6 * Math.sin(ang)) * LX + (lx / 6 * Math.sin(ang) + ly / 6 * Math.cos(ang)) * LY + nz * LZ;
          lv = base + 0.3 + (sh - 0.5) * 1.6;
          const pa = fr((phi + TAU / 10) * 5 / TAU);
          if (Math.abs(rho - 3.4) < 0.75 && Math.abs(pa - 0.5) < 0.2) lv += bump;
          const mx = lx - 1.6, my = ly + 1.7;
          if (mx * mx + my * my < 0.9) lv = base + 3.2;
        }
        if (lv < 0) return -1;
        LMAT = S.mat;
        return Math.max(0, lv);
      }, 2, 1.1);
    }
  }
  function drawBarnacles(t) {
    newStamp();
    for (const b of BARN) {
      let ext = 0.5 - 0.5 * Math.cos(TAU * t / b.per + b.ph);
      ext = ext * ext * (3 - 2 * ext);
      if (b.rim) { const e = coverAt(b.x, b.y); ext *= sstep(0.0, 0.04, e); }
      if (ext < 0.12) continue;
      const n = b.n, L = (b.r * 1.5 + 1) * ext, spread = 0.95 * ext;
      for (let k = 0; k < n; k++) {
        const q = k / (n - 1) - 0.5;
        let a = b.dir + q * spread * 2;
        let x = b.x + Math.cos(b.dir) * 0.6, y = b.y + Math.sin(b.dir) * 0.6;
        for (let s = 0; s <= L; s += 0.5) {
          x += Math.cos(a) * 0.5; y += Math.sin(a) * 0.5;
          a -= q * 0.5 * 0.5;
          const f = s / (L + 0.01);
          dark(x + 1, y + 1, 0.7);
          put(x, y, M_STONE, f > 0.75 ? 5 : 3.6 + f);
        }
      }
    }
  }
  function drawKelp(t) {
    // golden kelp blades: a short stipe, a gas bladder, and a long ruffled blade with a pale midrib
    const ST = [];
    for (const kp of KELP) {
      const hx = CX + Math.cos(kp.a) * kp.r0, hy = CY + Math.sin(kp.a) * kp.r0;
      const h = kp.a + Math.PI + kp.bend;
      let x = hx, y = hy;
      const L = kp.L, ds = 0.45;
      let bx = 0, by = 0;
      for (let s = 0; s <= L; s += ds) {
        const f = s / L;
        const sway = 0.2 * Math.sin(TAU * t / 8 - s * 0.045 + kp.ph) * f + 0.07 * Math.sin(TAU * t / 6 - s * 0.09 + kp.ph * 2) * f;
        const hd = h - kp.curv * f + LEAN * 0.38 * f + sway;
        const ca = Math.cos(hd), sa = Math.sin(hd), nx = -sa, ny = ca;
        x += ca * ds; y += sa * ds;
        const lit = nx * LX + ny * LY;
        if (s < 9) {
          for (let w = -1.1; w <= 1.1; w += 0.5) ST.push(x + nx * w, y + ny * w, M_OCHRE, 1.6 + (w < 0 ? lit : -lit) * 0.9);
          if (Math.abs(s - 8) < ds / 2) { bx = x + ca * 1.2; by = y + sa * 1.2; }
          continue;
        }
        const g = (s - 9) / (L - 9);
        const body = kp.Wm * Math.pow(Math.sin(Math.PI * Math.min(1, 0.06 + Math.pow(g, 0.75) * 0.94)), 0.8);
        const r1 = body + 1.3 * Math.sin(s * 0.55 + kp.k * 1.7 + 2 * T) * (0.25 + g);
        const r2 = body + 1.3 * Math.sin(s * 0.5 + kp.k * 2.3 - 2 * T + 1) * (0.25 + g);
        for (let w = -r2; w <= r1; w += 0.45) {
          const q = w < 0 ? w / (r2 + 0.01) : w / (r1 + 0.01), aq = Math.abs(q);
          const edge = w < 0 ? r2 + w : r1 - w;
          let lv = 2.6 + q * lit * 1.2 + (Math.sin(s * 0.55 + kp.k * 1.7 + 2 * T) * (w > 0 ? 1 : 0) + Math.sin(s * 0.5 + kp.k * 2.3 - 2 * T + 1) * (w < 0 ? 1 : 0)) * 0.6 * aq;
          if (aq < 0.12) lv = 3.9;
          else if (aq < 0.22) lv -= 0.6;
          else if (fr(aq * 3.2 + s * 0.02) < 0.2) lv += 0.4;
          if (edge < 0.7) lv = 1.6 + (q * lit > 0 ? 1.6 : 0);
          if (g > 0.9) lv += 0.3;
          ST.push(x + nx * w, y + ny * w, M_OCHRE, lv);
        }
      }
      for (let v = -2.4; v <= 2.4; v += 0.5) for (let u = -2.4; u <= 2.4; u += 0.5) {
        const d2 = (u * u + v * v) / 5.8; if (d2 > 1) continue;
        ST.push(bx + u, by + v, M_OCHRE, 3.1 + (dome(u / 2.4, v / 2.4, d2, 0) - 0.45) * 3.6 - (d2 > 0.72 ? 0.9 : 0));
      }
    }
    newStamp();
    for (let k = 0; k < ST.length; k += 4) dark(ST[k] + 3, ST[k + 1] + 4, 1.0);
    for (let k = 0; k < ST.length; k += 4) put(ST[k], ST[k + 1], ST[k + 2], ST[k + 3]);
  }
  function drawMotes(t) {
    for (const m of MOTES) {
      const a = m.dir * T + m.ph;
      const x = m.x + Math.cos(a) * m.rr, y = m.y + Math.sin(a) * m.rr * 0.7;
      put(x, y, M_GLASS, m.lv + 0.8 * Math.sin(T * 3 + m.ph));
    }
  }

  /* ================================================================ water and tide */
  function tideFront(t) {
    // quick over the outer rock, slow across the pool, a short slack, and back out the same way
    return 1.3 - 0.62 * sstep(2, 6, t) - 0.94 * sstep(4.5, 11.5, t) + 0.94 * sstep(12.5, 19.5, t) + 0.62 * sstep(18, 22, t);
  }
  function coverAt(x, y) {
    const dx = x - CX, dy = y - CY, r = Math.hypot(dx, dy), th = Math.atan2(dy, dx), u = r / 290;
    return u + 0.13 * Math.sin(2 * th + 19 * u + ROT1) + 0.03 * Math.sin(5 * th - 9 * u - ROT2) - F;
  }
  const GS = 3, GW = 122, GH = 152;
  const CNX = [14, 22], CNY = [17, 27], CP = [new Float32Array(14 * 17 * 2), new Float32Array(22 * 27 * 2)];
  const CG = new Float32Array(GW * GH);
  function causticGrid() {
    // two layers of moving cell walls, gently warped: the bright web that sunlight makes through ripples
    for (let L = 0; L < 2; L++) {
      const cs = L ? 19 : 31, nx = CNX[L], ny = CNY[L], P = CP[L];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i, h1 = ih(i, j, 601 + L), h2 = ih(i, j, 603 + L), h3 = ih(i, j, 605 + L);
        const m = [1, -1, 2, -2, 1, -1][fl(h3 * 6)];
        const a = m * T + h1 * TAU, rr = 0.24 + 0.12 * h2;
        P[k * 2] = (i + 0.2 + 0.6 * h1 + Math.cos(a) * rr) * cs;
        P[k * 2 + 1] = (j + 0.2 + 0.6 * h2 + Math.sin(a) * rr) * cs;
      }
    }
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const x = gx * GS, y = gy * GS;
      const wx = x + 7 * Math.sin(y * 0.043 + 2 * T) + 3.5 * Math.sin(y * 0.09 - x * 0.035 - 3 * T);
      const wy = y + 7 * Math.sin(x * 0.039 - T + 1.0) + 3.5 * Math.sin(x * 0.085 + y * 0.04 + 2 * T);
      let c = 0;
      for (let L = 0; L < 2; L++) {
        const cs = L ? 19 : 31, nx = CNX[L], P = CP[L];
        const ix = fl((wx + 12) / cs), iy = fl((wy + 12) / cs);
        let f1 = 1e9, f2 = 1e9;
        for (let j = iy - 1; j <= iy + 1; j++) for (let i = ix - 1; i <= ix + 1; i++) {
          if (i < 0 || j < 0 || i >= nx || j >= CNY[L]) continue;
          const k = (j * nx + i) * 2, dx = wx + 12 - P[k], dy = wy + 12 - P[k + 1], d = dx * dx + dy * dy;
          if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
        }
        const e = Math.sqrt(f2) - Math.sqrt(f1);
        const w = L ? 3.2 : 5.0;
        let v = 1 - e / w; v = v < 0 ? 0 : v * v;
        c += L ? v * 0.5 : v;
      }
      CG[gy * GW + gx] = c > 1 ? 1 : c;
    }
  }
  // wobble: four plane waves, made separable per frame
  const WX = [[0.051, 0.033, 2, 0.2], [-0.037, 0.058, -3, 1.3]], WY = [[0.044, -0.047, 3, 2.1], [0.029, 0.063, -2, 0.7]];
  const TSX = new Float32Array(4 * W), TCX = new Float32Array(4 * W), TSY = new Float32Array(4 * H), TCY = new Float32Array(4 * H);
  function wobbleTables() {
    const waves = WX.concat(WY);
    for (let k = 0; k < 4; k++) {
      const [kx, ky, m, p] = waves[k], ph = m * TT + p;
      for (let x = 0; x < W; x++) { TSX[k * W + x] = Math.sin(kx * x); TCX[k * W + x] = Math.cos(kx * x); }
      for (let y = 0; y < H; y++) { TSY[k * H + y] = Math.sin(ky * y + ph); TCY[k * H + y] = Math.cos(ky * y + ph); }
    }
  }
  // foam lace: Worley cell edges in a frame that turns with the spiral
  function laceAt(x, y) {
    const dx = x - CX, dy = y - CY;
    const px = (dx * LC - dy * LS) / LCELL + LOFF, py = (dx * LS + dy * LC) / LCELL + LOFF;
    const ix = px | 0, iy = py | 0;
    let f1 = 9, f2 = 9;
    for (let j = iy - 1; j <= iy + 1; j++) for (let i = ix - 1; i <= ix + 1; i++) {
      const k = (j * LN + i) * 2, ddx = px - LP[k], ddy = py - LP[k + 1], d = ddx * ddx + ddy * ddy;
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    return (Math.sqrt(f2) - Math.sqrt(f1)) * LCELL;
  }
  // the lace lattice turns once per loop with the tide, its points jiggle on small loops
  const LCELL = 4.4, LOFF = 68, LN = 137, LP = new Float32Array(LN * LN * 2);
  let LC = 1, LS = 0;
  function laceLattice() {
    LC = Math.cos(-T); LS = Math.sin(-T);
    for (let j = 0; j < LN; j++) for (let i = 0; i < LN; i++) {
      const k = (j * LN + i) * 2, h1 = ih(i, j, 401), h2 = ih(i, j, 402);
      LP[k] = i + 0.5 + 0.32 * Math.sin(TT * 2 + h1 * TAU);
      LP[k + 1] = j + 0.5 + 0.32 * Math.cos(TT * 2 + h2 * TAU);
    }
  }

  function compose() {
    // the tide field
    for (let i = 0; i < N; i++) {
      const u = PRR[i] / 290;
      E[i] = u + 0.13 * (S1[i] * CR1 + C1[i] * SR1) + 0.03 * (S2[i] * CR2 - C2[i] * SR2) - F;
    }
    FB.fill(0);
    if (F < 1.2) {
      laceLattice();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, e = E[i];
        if (e < -0.007 || e > 0.09) continue;
        if (e > 0.032) { if (ih(x, y, 413 + fl(e * 90)) < 0.03 * (1 - (e - 0.032) / 0.058)) FB[i] = 1; continue; }
        const lace = laceAt(x + 0.5, y + 0.5);
        if (e < 0) {
          if (lace < 0.5 && ih(x, y, 411) < 0.55 + e * 70) FB[i] = 1;
        } else if (e < 0.0045) {
          if (lace < 2.2 || ih(x, y, 412) < 0.4) FB[i] = lace < 0.9 ? 4 : 3;
        } else {
          const w = 0.95 * (1 - (e - 0.0045) / 0.0275);
          if (lace < w) FB[i] = lace < w * 0.4 ? 3 : 2;
        }
      }
    }
    const CA = 2.2, DS = 0.55;
    for (let y = 0; y < H; y++) {
      const gyf = y / GS, gy0 = Math.min(GH - 2, fl(gyf)), fy = gyf - gy0;
      const by = (y & 3) << 2;
      const sy0 = TSY[y], cy0 = TCY[y], sy1 = TSY[H + y], cy1 = TCY[H + y], sy2 = TSY[2 * H + y], cy2 = TCY[2 * H + y], sy3 = TSY[3 * H + y], cy3 = TCY[3 * H + y];
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let cv = E[i] * 15; cv = cv < 0 ? 0 : cv > 1 ? 1 : cv;
        const wet = RIM[i] ? cv : 1;
        let j = i;
        if (wet > 0.5) {
          const A = 0.62 + 0.5 * cv;
          const wx = (TSX[x] * cy0 + TCX[x] * sy0 + TSX[W + x] * cy1 + TCX[W + x] * sy1) * A;
          const wy = (TSX[2 * W + x] * cy2 + TCX[2 * W + x] * sy2 + TSX[3 * W + x] * cy3 + TCX[3 * W + x] * sy3) * A;
          let sx = x + Math.round(wx), sy = y + Math.round(wy);
          sx = sx < 0 ? 0 : sx >= W ? W - 1 : sx; sy = sy < 0 ? 0 : sy >= H ? H - 1 : sy;
          j = sy * W + sx;
        }
        const m = MM[j];
        let lv = ML[j];
        if (wet > 0) {
          const gxf = x / GS, gx0 = gxf | 0, fx = gxf - gx0, g = gy0 * GW + gx0;
          const c = (CG[g] * (1 - fx) + CG[g + 1] * fx) * (1 - fy) + (CG[g + GW] * (1 - fx) + CG[g + GW + 1] * fx) * fy;
          lv += (RIM[i] ? wet * 0.55 : 1) * (CA * (1 + 0.2 * cv) * c - 0.32);
        }
        lv -= cv * 0.7;
        if (y > 2 && x > 2 && FB[i - 2 * W - 2] && !FB[i]) lv -= 0.8;
        let q = fl(lv + 0.5 + (BAY[by | (x & 3)] - 0.5) * DS);
        const len = RLEN[m];
        q = q < 0 ? 0 : q >= len ? len - 1 : q;
        let idx = RFLAT[ROFF[m] + q];
        const streak = S1[i] * CR1 + C1[i] * SR1;
        const tint = (RIM[i] ? 0 : WT[i]) * (1 - cv) + cv * (0.42 + 0.22 * streak);
        const b2 = BAY2[by | (x & 3)];
        if (b2 < tint) idx = COOL1[idx];
        const fb = FB[i];
        if (fb) idx = RFLAT[ROFF[M_FOAM] + (fb === 4 ? 3 : fb === 3 ? (b2 < 0.6 ? 3 : 2) : fb === 2 ? (b2 < 0.5 ? 2 : 1) : 2)];
        OUT[i] = idx;
      }
    }
  }

  /* ================================================================ frame */
  function drawFrame(t, g, k) {
    t = ((t % D) + D) % D;
    T = TAU * t / D; TT = T;
    F = tideFront(t);
    LEAN = clamp((tideFront(t - 0.05) - tideFront(t + 0.05)) / 0.1 / 0.2, -1, 1);
    ROT1 = 2 * T; ROT2 = 3 * T;
    CR1 = Math.cos(ROT1); SR1 = Math.sin(ROT1); CR2 = Math.cos(ROT2); SR2 = Math.sin(ROT2);
    MM.set(BM); ML.set(BL);
    TM = MM; TL = ML;
    drawBarnacles(t);
    drawUrchins(t);
    drawStars(t);
    drawSmall(t);
    drawCentre(t);
    drawKelp(t);
    drawMotes(t);
    causticGrid();
    wobbleTables();
    compose();
    present(g, k);
  }

  /* ================================================================ present */
  let SMALLC = null, SG = null, IMG = null;
  function present(g, k) {
    if (!SMALLC) { SMALLC = document.createElement('canvas'); SMALLC.width = W; SMALLC.height = H; SG = SMALLC.getContext('2d'); IMG = SG.createImageData(W, H); }
    const d = IMG.data;
    for (let i = 0, j = 0; i < N; i++, j += 4) { const p = PAL[OUT[i]]; d[j] = p[0]; d[j + 1] = p[1]; d[j + 2] = p[2]; d[j + 3] = 255; }
    SG.putImageData(IMG, 0, 0);
    if (!g) return;
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(SMALLC, 0, 0, W * k, H * k);
  }

  /* ================================================================ mount */
  (window.PIECES = window.PIECES || []).push({
    id: 'tidepool',
    title: 'Tidepool',
    medium: 'Pixel art in 44 colours, 360 × 450, animated in JavaScript · 24 s loop',
    note: 'A rock pool, and once a loop the tide · tap to pause',
    about: 'A rock pool seen straight down and laid out like a mandala, eight-fold but never quite mirrored. A great coral anemone breathes open and closed at the centre, ringed by small anemones in sea-green and pink, slowly turning urchins, five-armed stars that creep and come back, barnacles combing the water with feathery arms, and mussels, periwinkles, coralline, sea glass and kelp packed to the rim. Caustics drift over everything. Once a loop the tide spirals in as a cool dithered wash with a lace of foam at its edge, covers the pool, and drains away.',
    tone: 'dark',
    room: '#0b0914',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      SEED = (api.seed >>> 0) % 100000 || 7;
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0, built = false;
      el.style.background = '#0b0914';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;image-rendering:pixelated;image-rendering:crisp-edges;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(233,247,238,.8)"/><rect x="19" y="9" width="5" height="16" fill="rgba(233,247,238,.8)"/></svg>';
      el.appendChild(pauseMark);
      let K = 3;
      function fit() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        let left = 0, top = 0, cssW, cssH;
        if (EXPORT) { cssW = 1080; cssH = 1350; cv.style.position = 'fixed'; K = 3; cv.width = W * 3; cv.height = H * 3; }
        else {
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          const f = Math.min(w * dpr / W, h * dpr / H);
          const k = Math.max(1, Math.floor(f));
          if (k < f * 0.85) { K = Math.max(1, Math.ceil(f)); cssW = W * f / dpr; cssH = H * f / dpr; }
          else { K = k; cssW = W * k / dpr; cssH = H * k / dpr; }
          left = Math.round((w - cssW) / 2); top = Math.round((h - cssH) / 2);
          if (cv.width !== W * K || cv.height !== H * K) { cv.width = W * K; cv.height = H * K; }
        }
        cv.style.left = left + 'px'; cv.style.top = top + 'px'; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
        pauseMark.style.left = (left + cssW - 48) + 'px'; pauseMark.style.top = (top + 14) + 'px';
      }
      fit();
      buildCool();
      buildBed();
      built = true;
      drawFrame(0, g, K);
      if (EXPORT) {
        const faded = () => { const st = el.parentElement; return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999; };
        window.__tidepool = {
          duration: D,
          isReady: () => built && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); drawFrame(t, g, K); window.__tidepool.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'tidepool';
        api.ready();
      } else {
        window.__tidepool = { duration: D, isReady: () => built, renderAt(t) { return new Promise((res) => { playing = false; clock = t; drawFrame(t, g, K); requestAnimationFrame(() => res()); }); } };
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
      const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (!alive) return; fit(); drawFrame(clock, g, K); }, 120); });
      ro.observe(el);
      return {
        destroy() {
          alive = false; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(rt);
          cv.removeEventListener('pointerdown', onDown);
          if (window.__tidepool) delete window.__tidepool;
        },
      };
    },
  });
})();
