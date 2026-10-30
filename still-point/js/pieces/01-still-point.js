/* The Still Point — piece 1.
 *
 * Blue hour at the edge of a still mountain lake. A young man with dense dark curls, round dark-rimmed glasses
 * and light stubble, in a navy cardigan over a white tee and rolled linen trousers, sits cross-legged on a flat
 * granite slab, face tilted a little up, eyes closed, hands resting on his knees in a mudra. Behind him stands
 * his aura: a great disc of hand-drawn contour lines, a small bright core behind his head, deep plum, rose, then
 * apricot, with a billowing, inked, cloud-like rim that churns slowly and sheds small torn wisps. It stands on
 * the water, so the lake mirrors it. He breathes three times in the 24-second loop (in 3.5 s, out 4.5 s); with
 * each in-breath the disc swells a little, the contour lines flow outward and a new one is born at the core,
 * his curls lift in its updraft, and a ripple rings out from the stone.
 *
 * The picture is pixel art in an inked, illustrated manner on a 360 × 450 grid: albedo, ink outlines and pixel
 * hatching are painted once at mount (sky, cloud bands in polar form, hills, pines, rock, legs, hands, and the
 * upper body at eleven breath states, so the breath moves as whole re-rasterised shapes rather than shifted
 * rows); every frame re-composes and relights it (the aura's contour field and rim, the head with its curls and
 * glint, the water re-reflecting everything through the ripples, inked water lines, shore grass and reeds) and
 * quantises it to 53 colours with a light 4 × 4 Bayer dither, shown 3× nearest-neighbour. A smooth light layer,
 * computed on the same grid and upscaled bilinearly, is screen-blended over it only where light belongs: the
 * aura's core and the glow off its rim, fireflies, motes, the glint. Every frame is a pure function of t; every
 * motion completes a whole number of cycles in D = 24 s.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 360, H = 450, NP = W * H, D = 24;
  const TAU = Math.PI * 2, fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const mod = (a, n) => ((a % n) + n) % n;
  const SEED = 11; // the scene is composed for one seed
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
  // value noise that wraps in x with an integer lattice period P (for angles and drifting mist)
  function vnP(x, y, s, P) {
    const xi = fl(x), yi = fl(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const x0 = mod(xi, P), x1 = mod(xi + 1, P);
    return lerp(lerp(ih(x0, yi, s), ih(x1, yi, s), u), lerp(ih(x0, yi + 1, s), ih(x1, yi + 1, s), u), v);
  }
  function fbmP(x, y, s, P, o) {
    let a = 0, amp = 0.5, n = 0;
    for (let k = 0; k < (o || 4); k++) { a += amp * vnP(x, y, s + k * 31, P); n += amp; x *= 2; y = y * 2.03 + 1.7; P *= 2; amp *= 0.5; }
    return a / n;
  }
  const hx = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  const norm3 = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };

  /* ================================================================ timing (seconds) */
  const BP = 8, INH = 3.5;                         // three breaths: in 3.5 s, out 4.5 s, starting at 0, 8, 16
  function breathAt(t) {
    const u = mod(t, BP);
    return u < INH ? 0.5 - 0.5 * Math.cos(Math.PI * u / INH) : 0.5 + 0.5 * Math.cos(Math.PI * (u - INH) / (BP - INH));
  }
  const FLOW = 3;                                   // contour lines born at the aura's core per loop: one per in-breath (the bowl)
  const RIP_DELAY = 0.35, RIP_LIFE = 15;            // the lake answers each in-breath with a ripple from the stone
  const GLINT_T = 5.0, GLINT_DUR = 2.2;             // once per loop, light slides across his glasses
  const FISH_T = 13.6, FISH_LIFE = 7.5;             // once per loop, a fish rings the water far to the left

  /* ================================================================ scene geometry */
  const HY = 300;          // the far shore: horizon of the lake
  const DYW = 336;         // the aura stands on the lake here (its water line)
  const WL = 404;          // the water line at the rock
  const SHORE = 434;       // the near bank (roughly)
  const CX = 180;          // his centre line
  const DCX = 180, DCY = 240, R0 = 116;   // the aura

  /* ================================================================ palette (53) */
  const PAL_HEX = [
    '0b0c20', '141836', '1d2350', '283266', '36437a', '4a558c', '636a9e',               // 0-6   night ink → twilight
    '7f7cad', '9d8db6', 'bf9cb8', 'dba9ae', 'efbca5', 'f8d2ac', 'fdebcf',               // 7-13  lavender → rose → apricot → cream
    '2a1438', '42204f', '5e2e66', '80407a', 'a6588a', 'cb7392', 'e3918f',               // 14-20 the aura: plum ink → rose → coral
    '0e1d2a', '173043', '22475a', '336272', '548593',                                   // 21-25 lake teal
    'ffe08a',                                                                           // 26    firefly gold
    '25242e', '3b3946', '575361', '7d7582',                                             // 27-30 granite
    '111632', '1a234d', '263465', '384a83', '5366a0',                                   // 31-35 navy knit
    'ece6ee', 'c0b8d0',                                                                 // 36-37 white tee
    '4a2b2a', '7b4a40', 'a96f5b', 'cd8f72', 'e8ae8b', 'f8d0ad',                         // 38-43 skin
    '1c120f', '33211a', '4d3224', '6e4a32',                                             // 44-47 hair
    '867a6e', 'b3a593', 'd8ccb6',                                                       // 48-50 linen
    '2c4a36', '5a7a4e',                                                                 // 51-52 grass
  ];
  const PAL = PAL_HEX.map(hx);
  const LUT_ENV = new Uint8Array(32768), LUT_ALL = new Uint8Array(32768);
  const ENVSET = [], ALLSET = [];
  for (let k = 0; k < PAL.length; k++) {
    if (k === 26) continue;                                // gold only where a firefly puts it
    ALLSET.push(k);
    if (!(k >= 31 && k <= 50)) ENVSET.push(k);             // no knit, tee, skin, hair or linen in the landscape
  }
  function nearest(r, g, b, set) {
    let best = 0, bd = 1e18;
    for (let q = 0; q < set.length; q++) {
      const k = set[q], p = PAL[k], dr = r - p[0], dg = g - p[1], db = b - p[2];
      const rm = (r + p[0]) * 0.5;
      const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  function buildLUT() {
    for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 32; b++) {
      const i = (r << 10) | (g << 5) | b;
      LUT_ENV[i] = nearest(r * 8 + 4, g * 8 + 4, b * 8 + 4, ENVSET);
      LUT_ALL[i] = nearest(r * 8 + 4, g * 8 + 4, b * 8 + 4, ALLSET);
    }
  }
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const DITH_ENV = 10, DITH_FIG = 5;

  /* ================================================================ buffers */
  const BG0 = new Float32Array(HY * W * 3);   // the still sky, hills and pines above the lake
  const BGF = new Float32Array(HY * W * 3);   // ...this frame: + stars, cloud bands, far mist
  const MD = new Float32Array(NP);            // this frame's mist density
  const C = new Float32Array(NP * 3);         // this frame's colour
  const ZONE = new Uint8Array(NP);            // 0 landscape palette, 1 full palette (him)
  const FORCE = new Uint8Array(NP);           // palette index + 1, drawn as is
  const OUT = new Uint8Array(NP);             // the quantised frame
  const LR = new Float32Array(NP), LG = new Float32Array(NP), LB = new Float32Array(NP); // the soft light layer
  const BLR = new Float32Array(NP), BLG = new Float32Array(NP), BLB = new Float32Array(NP); // static bloom
  const LOUT = new Uint8Array(NP * 3);
  const OCC = new Float32Array(NP), OCCT = new Float32Array(NP);
  const SKYM = new Uint8Array(NP);            // open sky (not hills, not pines)
  const LANDM = new Uint8Array(NP);
  // the aura, in polar form about (DCX, DCY)
  const TB = 1024;
  const DR = new Float32Array(NP), DTB = new Uint16Array(NP), INW = new Int32Array(NP);
  const DCOL = new Float32Array(NP * 3), DCL = new Uint8Array(NP), DIDX = new Uint8Array(NP);
  const B1 = new Float32Array(TB), B2 = new Float32Array(TB), B3 = new Float32Array(TB);
  const CLV = new Uint8Array(NP), CZ = new Uint8Array(NP);

  // the near layer (rock + him) lives in a box around him
  const NX0 = 54, NY0 = 186, NW = 252, NH = 226, NN = NW * NH;
  const NC = new Float32Array(NN * 3), NZ = new Float32Array(NN), NRIM = new Float32Array(NN), NFIG = new Uint8Array(NN);
  function layer() { return { c: new Float32Array(NN * 3), z: new Float32Array(NN), rim: new Float32Array(NN), fig: new Uint8Array(NN), l: new Float32Array(NN), mat: new Uint8Array(NN), part: new Uint8Array(NN) }; }
  const LA = layer();                          // rock, legs, feet, hands — still
  const NBS = 11;
  const LBS = [];                              // torso, arms, neck, tee — at eleven breath states

  /* ================================================================ materials */
  const RAMPOF = (ids) => ids.map((k) => PAL[k]);
  const R_NAVY = RAMPOF([31, 32, 33, 34, 35]);
  const R_SKIN = RAMPOF([38, 39, 40, 41, 42, 43]);
  const R_HAIR = RAMPOF([44, 45, 46, 47]);
  const R_TEE = RAMPOF([37, 36, 13]);
  const R_LIN = RAMPOF([28, 48, 49, 50]);
  const R_ROCK = RAMPOF([27, 28, 29, 30, 8]);
  const M_NAVY = 1, M_TEE = 2, M_SKIN = 3, M_LIN = 4, M_ROCK = 5, M_BTN = 6;
  const INKOF = [null, [10, 12, 30], [118, 106, 138], [74, 43, 42], [52, 48, 62], [12, 12, 28], [20, 12, 10]];
  function ramp(R, l) {
    const u = clamp(l, 0, 0.9999) * (R.length - 1), k = fl(u), f = u - k;
    return [lerp(R[k][0], R[k + 1][0], f), lerp(R[k][1], R[k + 1][1], f), lerp(R[k][2], R[k + 1][2], f)];
  }
  const mix3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
  const LK = norm3(0.5, -0.55, 0.67);          // key: from above and to our right, the aura and the dawn
  const lam = (nx, ny, nz) => Math.max(0, nx * LK[0] + ny * LK[1] + nz * LK[2]);

  function lput(L, x, y, z, rgb, mat, part, l) {
    const lx = x - NX0, ly = y - NY0;
    if (lx < 0 || ly < 0 || lx >= NW || ly >= NH) return;
    const i = ly * NW + lx;
    if (z <= L.z[i]) return;
    L.z[i] = z; L.c[i * 3] = rgb[0]; L.c[i * 3 + 1] = rgb[1]; L.c[i * 3 + 2] = rgb[2];
    L.fig[i] = mat === M_ROCK ? 0 : 1; L.mat[i] = mat; L.part[i] = part; L.l[i] = l;
  }

  /* ================================================================ sky, hills, pines */
  const SKY_STOPS = [
    [0.00, 10, 13, 38], [0.24, 18, 28, 70], [0.44, 34, 50, 104], [0.62, 70, 80, 138], [0.74, 122, 108, 164],
    [0.84, 184, 136, 166], [0.92, 232, 166, 154], [1.00, 252, 212, 174]];
  const glowX = (x) => Math.exp(-Math.pow((x - 205) / 170, 2));
  function skyRGB(x, y, o) {
    const u = clamp(y / HY, 0, 1);
    let k = 0;
    while (k < SKY_STOPS.length - 2 && u > SKY_STOPS[k + 1][0]) k++;
    const a = SKY_STOPS[k], b = SKY_STOPS[k + 1], f = (u - a[0]) / (b[0] - a[0]);
    let r = lerp(a[1], b[1], f), g = lerp(a[2], b[2], f), bb = lerp(a[3], b[3], f);
    const gl = glowX(x) * sstep(0.5, 1, u);
    r += 26 * gl; g += 14 * gl; bb -= 4 * gl;
    const tl = sstep(0.6, 0.1, u) * sstep(260, 0, x);
    r -= 3 * tl; g += 7 * tl; bb += 5 * tl;
    o[0] = r; o[1] = g; o[2] = bb;
  }
  const MOON = [318, 56, 7.5];
  function ridgeFar(x) { return 254 + 20 * (fbm(x / 44, 0.5, 501, 4) - 0.5) + 4 * Math.sin(x / 37 + 1) - 8 * Math.exp(-Math.pow((x - 26) / 46, 2)) - 6 * Math.exp(-Math.pow((x - 344) / 36, 2)); }
  function ridgeMid(x) { return 274 + 14 * (fbm(x / 30, 2.5, 502, 4) - 0.5) - 5 * Math.exp(-Math.pow((x - 36) / 34, 2)) - 3 * Math.exp(-Math.pow((x - 330) / 30, 2)); }
  const PINES = [];
  function nearLandAt(x, y) {
    let base = 1e9;
    if (x < 84) base = 288 + 12 * sstep(20, 84, x) - 2 * fbm(x / 9, 0.3, 503, 3);
    else if (x > 288) base = 296 - 6 * sstep(292, 336, x) - 2 * fbm(x / 8, 0.7, 504, 3);
    if (y >= base) return 1;
    for (const p of PINES) {
      const dd = y - p.top;
      if (dd < 0 || dd > p.h) continue;
      const tier = (dd % p.t) / p.t;
      const w = 0.5 + dd * p.s * (0.6 + 0.4 * tier);
      if (Math.abs(x + 0.5 - p.x) < w) return 1;
    }
    return 0;
  }
  function buildSky() {
    const R = mulberry32(7301);
    for (let k = 0; k < 16; k++) { const x = 2 + R() * 78, base = 288 + 12 * sstep(20, 84, x), h = 10 + R() * 16 * (1 - 0.5 * sstep(50, 84, x)); PINES.push({ x, top: base - h, h, s: 0.3 + R() * 0.08, t: 3 + R() * 1.5 }); }
    for (let k = 0; k < 9; k++) { const x = 296 + R() * 62, base = 296 - 6 * sstep(292, 336, x), h = 8 + R() * 13; PINES.push({ x, top: base - h, h, s: 0.32, t: 3.2 }); }
    const o = [0, 0, 0];
    for (let y = 0; y < HY; y++) for (let x = 0; x < W; x++) LANDM[y * W + x] = nearLandAt(x, y);
    for (let y = 0; y < HY; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, j = i * 3;
      skyRGB(x, y, o);
      let r = o[0], g = o[1], b = o[2], sky = 1;
      // the moon: a thin waning crescent, inked
      const dm = Math.hypot(x + 0.5 - MOON[0], y + 0.5 - MOON[1]);
      if (dm < MOON[2] + 0.6) {
        const ds = Math.hypot(x + 0.5 - (MOON[0] - 3.0), y + 0.5 - (MOON[1] - 2.6));
        if (dm >= MOON[2] - 0.4) { r = 30; g = 34; b = 72; }
        else if (ds > MOON[2] * 0.96) { const e = ds < MOON[2] * 0.96 + 1.2 ? 0.9 : 1; r = 253 * e; g = 236 * e; b = 207 * e; }
        else { r += 12; g += 12; b += 16; }
      }
      // far range: hazy lavender, inked ridge, sparse hatching
      const rf = ridgeFar(x);
      if (y >= rf) {
        sky = 0;
        const gl = glowX(x);
        let hr = lerp(r, 124, 0.55), hg = lerp(g, 108, 0.55), hb = lerp(b, 156, 0.55);
        const hz = sstep(rf, HY, y) * 0.45;
        hr = lerp(hr, lerp(190, 236, gl), hz); hg = lerp(hg, lerp(160, 192, gl), hz); hb = lerp(hb, lerp(190, 186, gl), hz);
        if (y - rf < 1) { hr *= 0.72; hg *= 0.72; hb *= 0.8; }
        else if (((x + y) & 3) === 0 && y - rf > 4 && y - rf < 18) { hr *= 0.9; hg *= 0.9; hb *= 0.92; }
        r = hr; g = hg; b = hb;
      }
      // middle range: dusky indigo, inked ridge, hatched slopes
      const rm = ridgeMid(x);
      if (y >= rm) {
        sky = 0;
        let mr = 70, mg = 70, mb = 114;
        const slope = ridgeMid(x + 2) - ridgeMid(x - 2);
        const face = clamp(-slope * 0.3, -1, 1);
        mr += face * 12; mg += face * 9; mb += face * 6;
        const hz = sstep(rm, HY, y) * 0.32;
        mr = lerp(mr, 176, hz); mg = lerp(mg, 150, hz); mb = lerp(mb, 186, hz);
        if (y - rm < 1) { mr = 30; mg = 32; mb = 66; }
        else if (y - rm < 2) { mr += 26; mg += 18; mb += 14; }
        else if (((x - y) % 3 + 3) % 3 === 0 && face < 0.1 && y - rm < 14) { mr *= 0.8; mg *= 0.8; mb *= 0.86; }
        r = mr; g = mg; b = mb;
      }
      // the near shore and its pines: deep teal-indigo, inked
      if (LANDM[i]) {
        sky = 0;
        let nr = 26, ng = 40, nb = 60;
        const up = y > 0 ? LANDM[i - W] : 0, lf = x > 0 ? LANDM[i - 1] : 0, rt = x < W - 1 ? LANDM[i + 1] : 0;
        if (!up || !lf || !rt) { nr = 12; ng = 14; nb = 32; }
        else if (y > 0 && !LANDM[i - W - 1 + 2]) { nr = 52; ng = 60; nb = 92; }
        else if (((x + y) & 3) === 0) { nr *= 0.8; ng *= 0.8; nb *= 0.85; }
        r = nr; g = ng; b = nb;
      }
      SKYM[i] = sky;
      BG0[j] = r; BG0[j + 1] = g; BG0[j + 2] = b;
    }
    // a soft bloom of the brightest sky and the moon, for the light layer
    const bl = new Float32Array(NP * 3);
    for (let y = 0; y < HY; y++) for (let x = 0; x < W; x++) {
      const j = (y * W + x) * 3;
      const lum = 0.3 * BG0[j] + 0.55 * BG0[j + 1] + 0.15 * BG0[j + 2];
      const k = sstep(160, 230, lum);
      bl[j] = BG0[j] * k; bl[j + 1] = BG0[j + 1] * k; bl[j + 2] = BG0[j + 2] * k;
    }
    blur3(bl, W, HY, 7); blur3(bl, W, HY, 7);
    for (let y = 0; y < HY; y++) for (let x = 0; x < W; x++) { const i = y * W + x; BLR[i] = bl[i * 3] * 0.2; BLG[i] = bl[i * 3 + 1] * 0.2; BLB[i] = bl[i * 3 + 2] * 0.2; }
  }
  function blur3(buf, w, h, r) {
    const tmp = new Float32Array(buf.length);
    for (let y = 0; y < h; y++) for (let c = 0; c < 3; c++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += buf[(y * w + clamp(k, 0, w - 1)) * 3 + c];
      for (let x = 0; x < w; x++) {
        tmp[(y * w + x) * 3 + c] = acc / (2 * r + 1);
        acc += buf[(y * w + clamp(x + r + 1, 0, w - 1)) * 3 + c] - buf[(y * w + clamp(x - r, 0, w - 1)) * 3 + c];
      }
    }
    for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += tmp[(clamp(k, 0, h - 1) * w + x) * 3 + c];
      for (let y = 0; y < h; y++) {
        buf[(y * w + x) * 3 + c] = acc / (2 * r + 1);
        acc += tmp[(clamp(y + r + 1, 0, h - 1) * w + x) * 3 + c] - tmp[(clamp(y - r, 0, h - 1) * w + x) * 3 + c];
      }
    }
  }

  /* ================================================================ polar maps: angle from straight down, distance */
  function buildPolar() {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, dx = x + 0.5 - DCX, dy = y + 0.5 - DCY;
      DR[i] = Math.hypot(dx, dy);
      const s = mod(Math.atan2(-dx, dy) / TAU, 1);          // 0 straight down, increasing clockwise on screen
      DTB[i] = Math.min(TB - 1, fl(s * TB));
      // the neighbour one step toward the centre (for edges lit by the aura)
      const r = DR[i] || 1, ix = clamp(Math.round(x - dx / r * 1.2), 0, W - 1), iy = clamp(Math.round(y - dy / r * 1.2), 0, H - 1);
      INW[i] = iy * W + ix;
      const zz = y + 16 * (vn2(x / 34, y / 30, 451) - 0.5);
      CZ[i] = zz < 104 ? 0 : zz < 196 ? 1 : 2;
    }
  }

  /* ================================================================ cloud bands: inked contour clouds swirling round the aura */
  const RC0 = R0 + 10, NRC = 330 - RC0;
  const CQ = new Float32Array(TB * NRC);
  function buildClouds() {
    const RCS = [R0 + 30, R0 + 66, R0 + 106, R0 + 150, R0 + 196];
    for (let rb = 0; rb < NRC; rb++) {
      const r = rb + RC0;
      for (let tb = 0; tb < TB; tb++) {
        const s = tb / TB;
        const warp = 26 * (fbmP(s * 6, r / 40, 411, 6, 3) - 0.5) + 6 * Math.sin(TAU * (s * 3 + r / 150));
        const rs = r + warp - 34 * s;                    // a slow spiral: the bands creep outward as they go round
        let q = 0;
        for (let k = 0; k < RCS.length; k++) {
          const rc = RCS[k], w = 7 + 2 * k;
          // billowing tops: scallops along the outer edge
          const sc = Math.sqrt(Math.abs(Math.sin(Math.PI * s * (44 + 8 * k) + k * 1.3)));
          const rr = rs > rc ? rs - 4.5 * sc : rs;
          const e = Math.exp(-Math.pow((rr - rc) / w, 2));
          if (e < 0.05) continue;
          const g = sstep(0.5, 0.64, fbmP(s * (6 + k), k * 3.7 + r / 260, 420 + k, 6 + k, 3));
          q = Math.max(q, e * g);
        }
        CQ[rb * TB + tb] = q;
      }
    }
  }
  //               fill L1 L2 L3, outline, inner line, rim (lit by the aura)
  const CLOUDPAL = [[3, 4, 5, 1, 2, 7], [5, 6, 7, 2, 4, 9], [7, 8, 9, 4, 6, 10]];
  function drawClouds(t, br) {
    CLV.fill(0);
    const ps = 0.012, ph = TAU * t / D;
    for (let y = 0; y < HY; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!SKYM[i]) continue;
      const r = DR[i];
      if (r < RC0 + 2) continue;
      if (Math.abs(x - MOON[0]) < 16 && Math.abs(y - MOON[1]) < 16) continue;
      const rr = r - 2.5 * br - RC0;
      const rb = rr | 0;
      if (rb < 0 || rb >= NRC) continue;
      const tb = (DTB[i] + Math.round(ps * Math.sin(ph + r / 50) * TB) + TB) & (TB - 1);
      const q = CQ[rb * TB + tb];
      CLV[i] = q < 0.42 ? 0 : q < 0.62 ? 1 : q < 0.82 ? 2 : 3;
    }
    for (let y = 1; y < HY - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x, v = CLV[i];
      if (!v) continue;
      const P = CLOUDPAL[CZ[i]];
      const u = CLV[i - W], d = CLV[i + W], l = CLV[i - 1], rr = CLV[i + 1];
      let k;
      if (!u || !d || !l || !rr) k = CLV[INW[i]] === 0 ? P[5] : P[3];       // outline; the edge facing the aura is lit
      else if (u < v || d < v || l < v || rr < v) k = P[4];
      else k = P[v - 1];
      const p = PAL[k], j = i * 3;
      BGF[j] = p[0]; BGF[j + 1] = p[1]; BGF[j + 2] = p[2];
    }
  }

  /* ================================================================ mist (two wrapping banks drifting right) */
  const MY0 = 266, MY1 = 352, MH = MY1 - MY0;
  const PA = 120, PB = 90;
  const MA = new Float32Array(PA * MH), MB = new Float32Array(PB * MH);
  const BANDA = new Float32Array(MH), BANDB = new Float32Array(MH);
  function buildMist() {
    for (let y = 0; y < MH; y++) {
      const yy = y + MY0;
      for (let x = 0; x < PA; x++) MA[y * PA + x] = sstep(0.38, 0.74, fbmP(x / 30, yy / 6.5, 901, 4, 4));
      for (let x = 0; x < PB; x++) MB[y * PB + x] = sstep(0.42, 0.8, fbmP(x / 22.5, yy / 4.5, 902, 4, 4));
      BANDA[y] = Math.exp(-Math.pow((yy - 330) / 7, 2)) * 0.62;
      BANDB[y] = Math.exp(-Math.pow((yy - 290) / 6, 2)) * 0.55;
    }
  }
  function mistA(x, y, off) {
    const ly = y - MY0; if (ly < 0 || ly >= MH) return 0;
    const xa = mod(x - off, PA), ia = fl(xa), fa = xa - ia;
    return BANDA[ly] * lerp(MA[ly * PA + ia], MA[ly * PA + (ia + 1) % PA], fa);
  }
  function mistB(x, y, off) {
    const ly = y - MY0; if (ly < 0 || ly >= MH) return 0;
    const xb = mod(x - off, PB), ib = fl(xb), fb = xb - ib;
    return BANDB[ly] * lerp(MB[ly * PB + ib], MB[ly * PB + (ib + 1) % PB], fb);
  }

  /* ================================================================ stars */
  const STARS = [];
  function buildStars() {
    const R = mulberry32(9107);
    while (STARS.length < 80) {
      const x = 2 + fl(R() * (W - 4)), y = fl(3 + Math.pow(R(), 1.4) * 170);
      if (Math.hypot(x - MOON[0], y - MOON[1]) < 15) { R(); continue; }
      const dark = 1 - sstep(80, 190, y);
      const b = (0.3 + 0.7 * Math.pow(R(), 1.6)) * dark;
      const n = 1 + fl(R() * 4), ph = R() * TAU, warm = R();
      const big = b > 0.55 && R() < 0.55;
      STARS.push({ x, y, b, n, ph, big, col: warm < 0.25 ? [255, 226, 196] : warm > 0.8 ? [206, 220, 255] : [246, 242, 236] });
    }
  }

  /* ================================================================ the aura disc */
  const NRING = 22, PEXP = 0.62;
  const PSI = new Float32Array(4097), DPSI = new Float32Array(4097);   // over q = r / Rs in [0, 1.25]
  const GR = new Float32Array(1025 * 3), GLN = new Uint8Array(1025);
  const WOBR = 150, WOB = new Float32Array(WOBR * TB), ECC = new Float32Array(TB), EOFF = new Float32Array(TB);
  const GSTOPS = [
    [0.00, 13, 12], [0.15, 13, 12], [0.24, 12, 20], [0.31, 20, 18], [0.38, 19, 17], [0.46, 17, 15], [0.54, 16, 14],
    [0.62, 17, 15], [0.70, 18, 16], [0.78, 19, 17], [0.86, 20, 18], [0.93, 11, 19], [1.00, 12, 20], [1.25, 12, 20]];
  const LOBES = [];
  const WISPS = [];
  function buildAura() {
    for (let k = 0; k <= 4096; k++) {
      const q = Math.max(1e-4, k / 4096 * 1.25);
      PSI[k] = NRING * Math.pow(q, PEXP);
      DPSI[k] = NRING * PEXP * Math.pow(q, PEXP - 1) / R0;
    }
    for (let k = 0; k <= 1024; k++) {
      const q = k / 1024 * 1.25;
      let s = 0;
      while (s < GSTOPS.length - 2 && q > GSTOPS[s + 1][0]) s++;
      const a = GSTOPS[s], b = GSTOPS[s + 1], f = clamp((q - a[0]) / (b[0] - a[0]), 0, 1);
      const pa = PAL[a[1]], pb = PAL[b[1]];
      GR[k * 3] = lerp(pa[0], pb[0], f); GR[k * 3 + 1] = lerp(pa[1], pb[1], f); GR[k * 3 + 2] = lerp(pa[2], pb[2], f);
      GLN[k] = f < 0.5 ? a[2] : b[2];
    }
    // hand-drawn wobble and kinks: noise in (angle, radius), wrapping round the angle
    for (let rb = 0; rb < WOBR; rb++) for (let tb = 0; tb < TB; tb++) {
      const s = tb / TB;
      WOB[rb * TB + tb] = 0.5 * (fbmP(s * 10, rb / 10, 431, 10, 3) - 0.5) * 2 + 0.17 * (vnP(s * 72, rb / 2.5, 432, 72) - 0.5) * 2;
    }
    // tree rings are never quite round: an eccentric, lumpy scale and offset round the angle
    for (let tb = 0; tb < TB; tb++) {
      const s = tb / TB;
      ECC[tb] = 1 + 0.09 * (fbmP(s * 3, 0.5, 441, 3, 3) - 0.5) * 2;
      EOFF[tb] = 6 * (fbmP(s * 4, 2.5, 442, 4, 2) - 0.5) * 2;
    }
    // three scalloped rims (cream, apricot, peach), each a ring of overlapping lobes that churn slowly
    const R = mulberry32(6060);
    const spec = [[30, -2, 7, 8, 1.0], [36, -10, 5, 5, 0.8], [42, -17, 4, 4, 0.7]];
    for (const [L, base, rmin, rvar, mamp] of spec) {
      const ring = { L, base, lobes: [] };
      for (let k = 0; k < L; k++) {
        const h = R();
        ring.lobes.push({ th: (k + (R() - 0.5) * 0.5) / L, rho: rmin + rvar * h * h, c: (R() - 0.5) * 2.5, n: 1 + fl(R() * 3), ph: R() * TAU, m: 1 + fl(R() * 2), ph2: R() * TAU, amp: mamp });
      }
      LOBES.push(ring);
    }
    for (let k = 0; k < 9; k++) WISPS.push({ th: (k + R() * 0.6) / 9, t0: R() * D, life: 8 + R() * 4, dir: R() < 0.5 ? -1 : 1, size: 4.6 + R() * 2.4 });
  }
  function rimBound(out, ring, Rs, t) {
    const L = ring.L, lob = ring.lobes;
    const live = [];
    for (const o of lob) {
      const rho = o.rho * (1 + 0.14 * o.amp * Math.sin(TAU * o.n * t / D + o.ph));
      const th = o.th + 0.004 * Math.sin(TAU * o.m * t / D + o.ph2);
      live.push([th, rho, Rs + ring.base - rho * 0.3 + o.c]);
    }
    for (let tb = 0; tb < TB; tb++) {
      const s = tb / TB;
      let best = Rs + ring.base - 3;
      const k0 = Math.round(s * L);
      for (let dk = -3; dk <= 3; dk++) {
        const o = live[mod(k0 + dk, L)];
        let d = s - o[0]; d -= Math.round(d);
        const a = d * TAU, c = o[2], sa = c * Math.sin(a);
        if (Math.abs(sa) >= o[1]) continue;
        const v = c * Math.cos(a) + Math.sqrt(o[1] * o[1] - sa * sa);
        if (v > best) best = v;
      }
      out[tb] = best;
    }
  }
  const AX0 = 40, AX1 = 320, AY0 = 96;
  function drawAura(t, br) {
    const Rs = R0 * (1 + 0.024 * br);
    rimBound(B1, LOBES[0], Rs, t); rimBound(B2, LOBES[1], Rs, t); rimBound(B3, LOBES[2], Rs, t);
    for (let k = 0; k < TB; k++) { B2[k] = Math.min(B2[k], B1[k] - 2.5); B3[k] = Math.min(B3[k], B2[k] - 2.5); }
    const phase = FLOW * t / D + 0.3 * br;
    const kq = 4096 / (1.25 * Rs), kg = 1024 / (1.25 * Rs);
    for (let y = AY0; y < DYW; y++) for (let x = AX0; x < AX1; x++) {
      const i = y * W + x, r = DR[i], tb = DTB[i];
      DIDX[i] = 0;
      if (r > B1[tb]) { DCL[i] = 0; continue; }
      if (r > B2[tb]) { DCL[i] = 1; DIDX[i] = 14; continue; }
      if (r > B3[tb]) { DCL[i] = 2; DIDX[i] = 13; continue; }
      DCL[i] = 3;
      const re = Math.max(0, r * ECC[tb] + EOFF[tb] * sstep(10, 50, r));
      const qi = Math.min(4096, (re * kq) | 0), gi = Math.min(1024, (re * kg) | 0);
      const phi = PSI[qi] + WOB[Math.min(WOBR - 1, r | 0) * TB + tb] - phase;
      const n = Math.floor(phi), f = phi - n;
      const dpx = Math.min(f, 1 - f) / Math.max(1e-3, DPSI[qi] * R0 / Rs);
      const j = i * 3;
      const n3 = ((n % FLOW) + FLOW) % FLOW;                 // every ring attribute repeats with the flow, so the loop is seamless
      if (dpx < 0.5 && r > 0.11 * Rs && ih((tb + n3 * 341) >> 4, n3, 77) > 0.13) { DIDX[i] = GLN[gi] + 1; continue; }
      const sh = n3 === 0 ? 0.9 : n3 === 1 ? 1.06 : 0.98;
      DCOL[j] = GR[gi * 3] * sh; DCOL[j + 1] = GR[gi * 3 + 1] * sh; DCOL[j + 2] = GR[gi * 3 + 2] * sh;
    }
    // torn wisps peeling away from the rim
    for (const w of WISPS) {
      const a = mod(t - w.t0, D);
      if (a >= w.life) continue;
      const u = a / w.life;
      const s = mod(w.th + w.dir * 0.03 * u, 1), tb = fl(s * TB) & (TB - 1);
      const rr = B1[tb] - 2 + 34 * Math.pow(u, 0.85);
      const rho = w.size * Math.pow(1 - u, 0.7) * sstep(0, 0.06, u);
      if (rho < 0.5) continue;
      const ang = s * TAU, cx = DCX - Math.sin(ang) * rr, cy = DCY + Math.cos(ang) * rr;
      const s2 = s - w.dir * 0.02, ang2 = s2 * TAU, rr2 = rr - rho * 0.6;
      const tx = DCX - Math.sin(ang2) * rr2, ty = DCY + Math.cos(ang2) * rr2;
      for (let y = fl(cy - rho - 4); y <= cy + rho + 4; y++) for (let x = fl(cx - rho - 4); x <= cx + rho + 4; x++) {
        if (x < AX0 || x >= AX1 || y < AY0 || y >= DYW) continue;
        const i = y * W + x;
        if (DCL[i]) continue;
        const d1 = Math.hypot(x + 0.5 - cx, y + 0.5 - cy), d2 = Math.hypot(x + 0.5 - tx, y + 0.5 - ty);
        if (d1 < rho || d2 < rho * 0.62) { DCL[i] = 4; DIDX[i] = 14; }
      }
    }
    // ink: the outer outline, and the seams between the rim tones
    for (let y = AY0 + 1; y < DYW; y++) for (let x = AX0 + 1; x < AX1 - 1; x++) {
      const i = y * W + x, c = DCL[i];
      if (!c) continue;
      const u = DCL[i - W], d = y + 1 < DYW ? DCL[i + W] : c, l = DCL[i - 1], r = DCL[i + 1];
      if (!u || !d || !l || !r) DIDX[i] = 15;
      else if (c === 1 && (u === 2 || d === 2 || l === 2 || r === 2)) DIDX[i] = 12;
      else if (c === 2 && (u === 3 || d === 3 || l === 3 || r === 3)) DIDX[i] = 21;
    }
    for (let y = AY0; y < DYW; y++) for (let x = AX0; x < AX1; x++) {
      const i = y * W + x;
      if (DCL[i] && DIDX[i]) { const p = PAL[DIDX[i] - 1], j = i * 3; DCOL[j] = p[0]; DCOL[j + 1] = p[1]; DCOL[j + 2] = p[2]; }
    }
  }

  /* ================================================================ the rock */
  const CRACKS = [];
  function paintRock(L) {
    const R = mulberry32(3355);
    for (let k = 0; k < 9; k++) {
      let x = 90 + R() * 180, y = 392 + R() * 6; const pts = [[x, y]];
      const n = 5 + fl(R() * 8);
      for (let s = 0; s < n; s++) { x += (R() - 0.5) * 2.4; y += 0.9 + R() * 0.6; pts.push([x, y]); }
      CRACKS.push(pts);
    }
    const crackAt = new Uint8Array(NN);
    for (const pts of CRACKS) for (const [x, y] of pts) { const lx = fl(x) - NX0, ly = fl(y) - NY0; if (lx >= 0 && ly >= 0 && lx < NW && ly < NH) crackAt[ly * NW + lx] = 1; }
    for (let y = 376; y < 410; y++) for (let x = NX0; x < NX0 + NW; x++) {
      const px = x + 0.5, py = y + 0.5, X = px - CX;
      const rx = (X < 0 ? 104 : 108) + 5 * (fbm(y / 4, X < 0 ? 0.5 : 7.5, 611, 3) - 0.5);
      const e = 1 - (X / rx) * (X / rx);
      if (e <= 0) continue;
      const se = Math.sqrt(e);
      const top = 389 - 8 * se + 2.4 * (fbm(x / 9, 0.2, 612, 3) - 0.5);
      const fe = 389 + 5.5 * se + 1.2 * (vn2(x / 7, 1.1, 617) - 0.5);
      const bot = WL + 0.6 + 1.6 * (vn2(x / 6, 3.3, 613) - 0.5);
      if (py < top || py > bot) continue;
      let hw = rx;
      if (py > fe) hw = rx - 0.8 * (py - fe) - 6 * (1 - Math.sqrt(Math.max(0, 1 - Math.pow((py - fe) / 16, 2)))) + 3 * (vn2(y / 3, X < 0 ? 2 : 9, 618) - 0.5);
      if (Math.abs(X) > hw) continue;
      const n = fbm(x / 6, y / 2.5, 614, 3) - 0.5;
      let l;
      if (py < fe) {
        l = 0.68 + 0.16 * X / rx + 0.12 * n;
        l -= 0.3 * Math.exp(-Math.pow(X / 70, 2)) * sstep(top + 1, fe, py);     // his shadow on the stone
      } else {
        const facet = Math.sin(px / 8 + 6 * fbm(px / 20, 0.3, 619, 2));
        l = 0.46 + 0.14 * X / rx - 0.24 * (py - fe) / 12 + 0.12 * n + (facet > 0.35 ? 0.07 : facet < -0.45 ? -0.08 : 0);
        if (py - fe < 1.2) l += 0.14;                                             // the lip catches the light
        const strata = (py - fe) + 1.6 * Math.sin(px / 9) + 3 * fbm(px / 14, 0.5, 620, 2);
        if (Math.abs(strata - Math.round(strata / 4.5) * 4.5) < 0.5 && fbm(px / 10, py / 6, 621, 2) > 0.45) l -= 0.14;   // bedding lines
        if (bot - py < 2.2) l *= 0.7;                                             // wet at the water
      }
      let rgb = ramp(R_ROCK, l);
      const lx = x - NX0, ly = y - NY0;
      if (crackAt[ly * NW + lx] && py > top + 1) { rgb = INKOF[M_ROCK]; l = 0; }
      else if (lx > 0 && crackAt[ly * NW + lx - 1] && py > top + 1) { l += 0.15; rgb = ramp(R_ROCK, l); }
      lput(L, x, y, 1, rgb, M_ROCK, 1, l);
      if (py < fe) L.rim[ly * NW + lx] = 0.5 * Math.exp(-Math.pow(X / 80, 2));
    }
    // two small stones breaking the water
    for (const [sx, sy, sr] of [[293.5, 402.5, 6.4], [68.5, 403.5, 4.6]]) {
      for (let y = fl(sy - sr); y <= sy + 1; y++) for (let x = fl(sx - sr * 1.3 - 1); x <= sx + sr * 1.3 + 1; x++) {
        const u = (x + 0.5 - sx) / (sr * 1.3), v = (y + 0.5 - sy) / sr;
        if (u * u + v * v > 1 || y + 0.5 > sy + 1) continue;
        const l = 0.55 + 0.25 * u - 0.25 * v + 0.08 * (ih(x, y, 620) - 0.5) - (y + 0.5 > sy - 0.5 ? 0.18 : 0);
        lput(L, x, y, 1, ramp(R_ROCK, l), M_ROCK, 2, l);
      }
    }
  }

  /* ================================================================ shapes */
  let CAP_U = 0, CAP_DX = 0, CAP_DY = 0, CAP_R = 1, CAP_PERP = 0;
  // distance to a tapered capsule's surface (negative inside); sets the axis parameter and offset
  function tcap(px, py, ax, ay, bx, by, ra, rb) {
    const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy, l = Math.sqrt(l2);
    const u = clamp(((px - ax) * vx + (py - ay) * vy) / l2, 0, 1);
    const qx = ax + vx * u, qy = ay + vy * u;
    CAP_U = u; CAP_DX = px - qx; CAP_DY = py - qy; CAP_R = lerp(ra, rb, u);
    CAP_PERP = ((px - ax) * -vy + (py - ay) * vx) / l;
    return Math.hypot(CAP_DX, CAP_DY) - CAP_R;
  }
  function capN() { const nx = CAP_DX / CAP_R, ny = CAP_DY / CAP_R; return [nx, ny, Math.sqrt(Math.max(0.04, 1 - nx * nx - ny * ny))]; }

  /* ================================================================ legs and feet (still) */
  function paintLegs(L) {
    for (let y = 340; y < 396; y++) for (let x = 74; x < 290; x++) {
      const px = x + 0.5, py = y + 0.5, X = px - CX;
      if (py > 393) continue;
      let z = 0, mat = M_LIN, part = 0, l = 0, fold = false;
      // lap and thighs: flatter, linen-soft volumes
      const ex = X / 46, ey = (py - 369) / 12;
      if (ex * ex + ey * ey < 1) { const nx = ex * 0.6, ny = ey * 0.5 - 0.4; z = 2.0; part = 10; l = 0.3 + 0.5 * lam(nx, ny, Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny))); l -= 0.18 * Math.exp(-X * X / 300) * sstep(366, 356, py); }
      for (const s of [-1, 1]) {
        const d = tcap(px, py, CX + s * 24, 358, CX + s * 72, 366.5, 9.6, 9.0);
        if (d < 0 && z < 2.1) { const n = capN(); z = 2.1; part = s < 0 ? 11 : 12; l = 0.28 + 0.5 * lam(n[0] * 0.7, n[1] - 0.35, n[2]); }
        const dk = Math.hypot(px - (CX + s * 78), py - 369.5);
        if (dk < 9.6 && z < 2.2) { const nx = (px - CX - s * 78) / 9.6, ny = (py - 369.5) / 9.6; z = 2.2; part = s < 0 ? 13 : 14; l = 0.3 + 0.52 * lam(nx * 0.8, ny - 0.3, Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny))); }
      }
      // the left shin, tucked behind, from his left knee (our left) toward the right foot; the right shin across the front
      let d = tcap(px, py, 106, 376, 214, 386.5, 6.2, 4.8);
      if (d < 0 && z < 2.5) {
        const n = capN(); z = 2.5; part = 15; l = 0.26 + 0.46 * lam(n[0] * 0.6, n[1] - 0.25, n[2]);
        if (CAP_U > 0.86) { z = 2.55; part = 19; l += 0.1; if (Math.abs(CAP_U - 0.91) < 0.012) fold = true; }
        else if (Math.abs(CAP_PERP + 1.5 - 9 * (CAP_U - 0.4)) < 0.5 && CAP_U > 0.3 && CAP_U < 0.6) fold = true;
      }
      d = tcap(px, py, 254, 376, 146, 386.5, 6.5, 5.0);
      if (d < 0) {
        const n = capN(); z = 3.0; part = 16; l = 0.32 + 0.48 * lam(n[0] * 0.6, n[1] - 0.25, n[2]);
        if (CAP_U > 0.86) { z = 3.05; part = 20; l += 0.1; if (Math.abs(CAP_U - 0.91) < 0.012) fold = true; }
        else if ((Math.abs(CAP_PERP - 2 + 10 * (CAP_U - 0.35)) < 0.5 && CAP_U > 0.25 && CAP_U < 0.5) || (Math.abs(CAP_PERP + 1 + 8 * (CAP_U - 0.62)) < 0.5 && CAP_U > 0.55 && CAP_U < 0.75)) fold = true;
      }
      if (z && mat === M_LIN) {
        for (const s of [-1, 1]) {
          const kx = CX + s * 78, r = Math.hypot(py - 369.5, px - kx), a = Math.atan2(py - 369.5, (px - kx) * s);
          if ((part === 10 || part === 11 || part === 12) && r > 12 && r < 40 && Math.abs(Math.sin(a * 3.2 + r * 0.16 + s)) < 0.07) fold = true;
          if ((part === 13 || part === 14) && Math.abs(r - 6) < 0.5 && (py - 369.5) < -1 && (px - kx) * s < 2) fold = true;
        }
      }
      // feet, bare, each tucked under the opposite knee: heel toward the middle, toes outward; a row of toes
      for (const s of [-1, 1]) {
        const heel = [CX + s * 50, 388.6], ball = [CX + s * 66, 387.6];
        const zz = s < 0 ? 3.1 : 2.6;
        let hit = false, fl2 = 0;
        if (tcap(px, py, heel[0], heel[1], ball[0], ball[1], 3.4, 4.0) < 0) { hit = true; const n = capN(); fl2 = 0.42 + 0.3 * lam(n[0], n[1] - 0.4, n[2]) + (CAP_U < 0.25 ? 0.06 : 0); }
        let toe = -1;
        for (let k = 0; k < 5; k++) {
          const tx = CX + s * (70.2 + 0.4 * k), ty = 384.6 + k * 1.75, tr = k === 0 ? 1.55 : 1.15 - k * 0.05;
          if (Math.hypot(px - tx, py - ty) < tr) { toe = k; }
        }
        if (toe >= 0) { hit = true; fl2 = 0.56 - toe * 0.03; }
        if (hit && z < zz) { z = zz; mat = M_SKIN; part = (s < 0 ? 60 : 70) + (toe >= 0 ? toe + 1 : 0); l = fl2; }
      }
      if (!z) continue;
      if (mat === M_LIN) {
        let rgb = ramp(R_LIN, l + 0.04 * (fbm(x / 4, y / 3, 621, 2) - 0.5));
        if (fold) { rgb = mix3(rgb, INKOF[M_LIN], 0.7); l = Math.min(l, 0.15); }
        lput(L, x, y, z, rgb, M_LIN, part, l);
      } else lput(L, x, y, z, ramp(R_SKIN, l), M_SKIN, part, l);
    }
  }

  /* ================================================================ hands in a mudra (still) */
  function paintHands(L) {
    const HS = 1.45;                                   // a hand is about three quarters of a face long
    for (const s of [-1, 1]) {
      const WR = [117.5, 351.5], P0 = [108.5, 357], u = [-0.922, 0.387], v = [0.387, 0.922];
      const at = (a, b) => [WR[0] + HS * (P0[0] - WR[0] + u[0] * a + v[0] * b), WR[1] + HS * (P0[1] - WR[1] + u[1] * a + v[1] * b)];
      const P = at(0, 0), T = at(5.0, -6.0);
      const parts = [];
      // middle, ring and little fingers fan out over the knee; the index curls to meet the thumb
      [[-1.2, 6.6, 0.06, 1.3], [1.3, 6.0, 0.24, 1.22], [3.5, 4.7, 0.42, 1.08]].forEach(([o, len, fan, rad], k) => {
        const b0 = at(4.0, o), c = Math.cos(fan), sn = Math.sin(fan);
        const dir = [u[0] * c + v[0] * sn, u[1] * c + v[1] * sn];
        parts.push({ a: b0, b: [b0[0] + dir[0] * len * HS, b0[1] + dir[1] * len * HS], ra: rad * HS, rb: rad * HS * 0.88, id: 33 + k, l: 0.5 + 0.04 * k });
      });
      parts.push({ a: at(3.6, -2.4), b: T, ra: 1.25 * HS, rb: 1.12 * HS, id: 32, l: 0.6 });
      parts.push({ a: [WR[0] - 1.0, WR[1] - 3.4], b: T, ra: 1.6 * HS, rb: 1.15 * HS, id: 31, l: 0.62 });
      for (let y = 330; y < 382; y++) for (let x = 70; x < 132; x++) {
        const px = x + 0.5, py = y + 0.5;
        const dx = px - P[0], dy = py - P[1], a = dx * u[0] + dy * u[1], b = dx * v[0] + dy * v[1];
        let best = null, bz = 0;
        const pa = 6.4 * HS, pb = 4.4 * HS;
        if ((a / pa) * (a / pa) + (b / pb) * (b / pb) < 1) { best = { id: 30, l: 0.64 - 0.08 * Math.abs(b) / pb + (Math.abs(a + 1) < 3 && Math.abs(b) < 2 ? 0.05 : 0) - (Math.abs(a - b * 0.6 - 1) < 0.5 ? 0.14 : 0) }; bz = 6; }
        if (!best && tcap(px, py, WR[0] + 2, WR[1] - 0.5, P[0], P[1], 4.6, 5.6) < 0) { best = { id: 30, l: 0.58 }; bz = 6; }
        for (const q of parts) {
          if (tcap(px, py, q.a[0], q.a[1], q.b[0], q.b[1], q.ra, q.rb) < 0) {
            const n = capN();
            best = { id: q.id, l: q.l + 0.22 * lam(n[0], n[1], n[2]) - 0.08 + (CAP_U > 0.82 ? 0.06 : 0) }; bz = 6.1;
          }
        }
        if (!best) continue;
        const hole = at(3.1, -4.5);
        if (Math.hypot(px - hole[0], py - hole[1]) < 1.15) best = { id: 39, l: 0.02 };      // the little ring of the mudra
        const X = s < 0 ? x : 359 - x;
        lput(L, X, y, bz, ramp(R_SKIN, best.l), M_SKIN, best.id + (s < 0 ? 0 : 10), best.l);
      }
    }
  }

  /* ================================================================ the upper body, at a breath state b in [0, 1] */
  const TORSO = [[266, 9], [268, 14], [271, 19.5], [274, 24.5], [278, 28.5], [283, 31.5], [290, 33], [300, 33], [316, 31.5], [332, 30.5], [346, 31.5], [360, 33]];
  function torsoHW(y) {
    if (y < TORSO[0][0] || y > TORSO[TORSO.length - 1][0]) return -1;
    for (let k = 0; k < TORSO.length - 1; k++) if (y <= TORSO[k + 1][0]) return lerp(TORSO[k][1], TORSO[k + 1][1], (y - TORSO[k][0]) / (TORSO[k + 1][0] - TORSO[k][0]));
    return -1;
  }
  const vneck = (py) => 13 * clamp((314 - py) / 44, 0, 1);
  function paintUpper(L, b) {
    const sh = 1.7 * b, ce = 0.9 * b, eu = 0.8 * b;
    const lift = (y) => sh * sstep(348, 272, y);              // how far the cloth at rest height y has risen
    for (let y = 244; y < 364; y++) for (let x = 100; x < 260; x++) {
      const px = x + 0.5, py = y + 0.5, X = px - CX;
      const yr = py + lift(py);                              // the rest height of what is here now
      // the neck, in the shadow of the jaw
      if (Math.abs(X) < 9.4 && py > 250 && yr < 276) {
        const l = 0.46 + 0.22 * X / 9.4 - (py < 266 ? 0.12 : 0) - (Math.abs(X) > 8 ? 0.06 : 0);
        lput(L, x, y, 1.0, ramp(R_SKIN, l), M_SKIN, 40, l);
      }
      const hw = torsoHW(yr);
      let tz = 0, tn = null;
      if (hw > 0 && Math.abs(X) < hw + ce * sstep(350, 296, yr)) {
        const hh = hw + ce * sstep(350, 296, yr);
        const nx = clamp(X / (hh + 1), -1, 1), ny = yr < 290 ? -0.75 * sstep(290, 266, yr) : 0.04;
        tn = [nx, ny, Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny))]; tz = 1.2;
      }
      if (tz) {
        let l = 0.12 + 0.74 * lam(tn[0], tn[1], tn[2]);
        let part = 41, mat = M_NAVY, z = tz, rgb;
        const ax = Math.abs(X);
        // drape from the armpits, and the knit bunching where it meets the lap
        if (Math.abs((yr - 302) - (27 - ax) * 1.15) < 0.55 && ax > 17 && ax < 27) l = Math.min(l, 0.08);
        if ((Math.abs(yr - 349 - 1.5 * Math.cos(X / 7)) < 0.55 || Math.abs(yr - 355 - 1.5 * Math.cos(X / 6 + 1)) < 0.55) && ax > 6 && ax < 28) l = Math.min(l, 0.08);
        rgb = ramp(R_NAVY, l);
        const vh = vneck(yr);
        if (yr > 262 && yr < 314 && ax < vh) {
          // the white tee in the V, with its crew neck round the base of the throat
          const cy = 268, ex = X / 10.6, ey = (yr - cy) / 4.8, ex2 = X / 12.6, ey2 = (yr - cy) / 6.6;
          mat = M_TEE; z = 1.3;
          if (ex * ex + ey * ey < 1 && yr < cy + 2) { mat = M_SKIN; part = 40; l = 0.3 + 0.12 * X / 10; rgb = ramp(R_SKIN, l); }
          else if (ex2 * ex2 + ey2 * ey2 < 1) { part = 43; l = 0.32 + 0.22 * X / 12 - (((x + 1) & 1) ? 0.06 : 0); rgb = ramp(R_TEE, l); }
          else { part = 42; l = 0.56 + 0.3 * X / 13 - 0.16 * sstep(296, 314, yr); rgb = ramp(R_TEE, l); }
        } else if (yr > 262 && yr < 315 && ax < vh + 4.4) {
          part = 44; z = 1.32; l += 0.12 - ((y & 1) ? 0.07 : 0); if (ax > vh + 3.6) l -= 0.14; rgb = ramp(R_NAVY, l);   // ribbed button band
        } else if (yr >= 314 && yr < 362 && Math.abs(X - 0.5) < 3.4) {
          part = 44; z = 1.32; l += 0.1 - ((y & 1) ? 0.06 : 0); if (Math.abs(X - 1.8) < 0.5) l = 0.06; rgb = ramp(R_NAVY, l);
        }
        lput(L, x, y, z, rgb, mat, part, l);
      }
      // arms: modelled upper arm (deltoid to elbow), sleeve folds at the elbow, forearm down to a ribbed cuff
      for (const s of [-1, 1]) {
        const S = [CX + s * 35, 292 - sh], E = [CX + s * 47.5, 329 - eu], WR = [CX + s * 63.5, 351];
        let d = tcap(px, py, S[0], S[1], E[0], E[1], 9.4, 7.4);
        const dsh = Math.hypot(px - (CX + s * 32), py - (291 - sh)) - 9.6;     // the deltoid, part of the sleeve
        if (dsh < 0 && d >= 0) { d = dsh; const nx = (px - CX - s * 32) / 9.6, ny = (py - 291 + sh) / 9.6; CAP_DX = nx * 9.4; CAP_DY = ny * 9.4; CAP_R = 9.4; CAP_U = 0; CAP_PERP = 0; }
        if (d < 0) {
          const n = capN();
          let l = 0.12 + 0.72 * lam(n[0], n[1], n[2]);
          const inner = s * CAP_PERP;                       // >0 toward the body? sign by side
          if (CAP_U > 0.62 && Math.abs(CAP_PERP * s + 2.5 - (CAP_U - 0.62) * 22) < 0.55) l = Math.min(l, 0.08);
          if (CAP_U > 0.82 && Math.abs(CAP_PERP * s - 1 - (CAP_U - 0.82) * 30) < 0.55) l = Math.min(l, 0.08);
          lput(L, x, y, 1.8, ramp(R_NAVY, l), M_NAVY, s < 0 ? 50 : 51, l);
          void inner;
        }
        d = tcap(px, py, E[0], E[1], WR[0], WR[1], 7.6, 5.6);
        if (d < 0) {
          const n = capN();
          let l = 0.14 + 0.72 * lam(n[0], n[1], n[2]);
          let part = s < 0 ? 52 : 53;
          if (CAP_U < 0.22 && Math.abs(CAP_PERP * s + 1.5 - CAP_U * 18) < 0.55) l = Math.min(l, 0.08);    // folds round the elbow
          if (CAP_U > 0.82) { part = s < 0 ? 54 : 55; l += 0.1 - ((Math.round(CAP_PERP * 1.2) & 1) ? 0.1 : 0); }
          lput(L, x, y, 4.5, ramp(R_NAVY, l), M_NAVY, part, l);
        }
      }
    }
    // buttons: four brown buttons down the band, inked, with a glint
    for (const by0 of [320, 332, 344, 356]) {
      const by = Math.round(by0 - lift(by0));
      const spr = ['.oo.', 'ohbo', 'obbo', '.oo.'];
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        const ch = spr[j][i]; if (ch === '.') continue;
        const k = ch === 'o' ? 44 : ch === 'h' ? 43 : 46;
        lput(L, 179 + i, by - 2 + j, 1.4, PAL[k], M_BTN, 45, 0.5);
      }
    }
  }

  /* ================================================================ ink + hatching: the illustrated finish */
  function finish(L, other) {
    const zAt = (lx, ly) => {
      if (lx < 0 || ly < 0 || lx >= NW || ly >= NH) return 0;
      const i = ly * NW + lx; return Math.max(L.z[i], other ? other.z[i] : 0);
    };
    const pick = (lx, ly) => {
      const i = ly * NW + lx;
      if (other && other.z[i] > L.z[i]) return other;
      return L;
    };
    const out = new Float32Array(L.c);
    for (let ly = 0; ly < NH; ly++) for (let lx = 0; lx < NW; lx++) {
      const i = ly * NW + lx, z = L.z[i];
      if (!z) continue;
      const j = i * 3, mat = L.mat[i], part = L.part[i];
      let c = [L.c[j], L.c[j + 1], L.c[j + 2]];
      let ink = false, open = 0;
      for (const [ox, oy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const zz = zAt(lx + ox, ly + oy);
        if (!zz) { if (mat !== M_ROCK || oy !== 1) ink = true; continue; }
        const O = pick(lx + ox, ly + oy), n = (ly + oy) * NW + lx + ox;
        if (zz > z + 0.25 && O.mat[n] !== M_BTN) ink = true;                       // the edge of something in front
        else if (Math.abs(zz - z) <= 0.25 && O.part[n] !== part && O.mat[n] === mat && part > O.part[n] && mat === M_SKIN) ink = true;   // between fingers
        else if (O.mat[n] !== mat && zz >= z && mat !== M_BTN && O.mat[n] !== M_BTN && !(mat === M_SKIN && O.mat[n] === M_TEE)) ink = true;
      }
      if (mat === M_BTN) ink = false;
      if (ink) {
        const k = INKOF[mat];
        c = mat === M_ROCK ? mix3(c, k, 0.75) : [k[0], k[1], k[2]];
      } else {
        // pixel hatching in the shadows
        const x = lx + NX0, y = ly + NY0, l = L.l[i];
        const d1 = ((x + y) % 3) === 0, d2 = (((x - y) % 3) + 3) % 3 === 0;
        let h = 0;
        if (mat === M_NAVY) h = (l < 0.3 && d1 ? 1 : 0) + (l < 0.17 && d2 ? 1 : 0);
        else if (mat === M_LIN) h = (l < 0.42 && d1 ? 1 : 0) + (l < 0.3 && d2 ? 1 : 0);
        else if (mat === M_TEE) h = l < 0.42 && d2 ? 1 : 0;
        else if (mat === M_ROCK) h = (l < 0.36 && d1 ? 1 : 0) + (l < 0.22 && d2 ? 1 : 0);
        else if (mat === M_SKIN && part === 40) h = l < 0.2 && d1 ? 1 : 0;
        for (let k = 0; k < h; k++) c = [c[0] * 0.7, c[1] * 0.7, c[2] * 0.76];
      }
      // aura rim weight: pixels just inside the outline, open to the sky above or beside
      if (L.fig[i]) {
        for (const [ox, oy, w] of [[0, -2, 1], [-2, 0, 0.8], [2, 0, 0.8], [-1, -2, 0.8], [1, -2, 0.8], [0, -3, 0.5]]) if (!zAt(lx + ox, ly + oy)) open = Math.max(open, w);
        if (ink) open *= 0.25;
        L.rim[i] = Math.max(L.rim[i], open);
      }
      out[j] = c[0]; out[j + 1] = c[1]; out[j + 2] = c[2];
    }
    L.c.set(out);
  }

  /* ================================================================ the head (redrawn every frame) */
  const FCY = 240;
  function faceHW(Y) {
    if (Y < -21 || Y > 22) return -1;
    if (Y < 0) return 16 * Math.sqrt(Math.max(0, 1 - Math.pow(Y / 22, 2)));
    if (Y < 8) return 16 - 0.06 * Y;
    if (Y < 16) return lerp(15.5, 12.2, (Y - 8) / 8);
    return 12.2 * Math.sqrt(Math.max(0, 1 - Math.pow((Y - 16) / 6, 2)));
  }
  const hairline = (X) => -15.5 + 0.024 * X * X;
  const HCY = 223, HRX = 23.5, HRY = 19.5;
  const capRX = (y) => (y > HCY ? lerp(HRX, 18.5, clamp((y - HCY) / 14, 0, 1)) : HRX);
  const CURLS = [];
  function buildCurls() {
    const R = mulberry32(5150);
    const ok = (x, y, r) => {
      const X = x - CX, Y = y - FCY;
      if (Y + r * 0.45 > hairline(X) && Math.abs(X) < faceHW(Y) + 1.6) return false;
      if (Y > -4) return false;
      return true;
    };
    const push = (x, y, r, rim) => {
      if (!ok(x, y, r)) return;
      for (const c of CURLS) if (Math.hypot(c.x - x, c.y - y) < (c.r + r) * 0.62) return;
      CURLS.push({ x, y, r, ph: R() * TAU, ph2: R() * TAU, sp: R(), lift: rim ? (y < HCY ? 1.3 : 0.5) : (y < HCY - 6 ? 0.7 : 0.25) });
    };
    for (let a = -Math.PI * 1.04; a <= 0.04; a += 0.16) {
      const y = HCY + Math.sin(a) * (HRY - 1.5), x = CX + Math.cos(a) * (capRX(y) - 1.5);
      push(x + (R() - 0.5), y + (R() - 0.5), 4.4 + R() * 0.8, true);
    }
    for (const s of [-1, 1]) for (let y = HCY + 1; y <= FCY - 5; y += 4) push(CX + s * (capRX(y) - 2) + (R() - 0.5) * 0.6, y, 3.4 + R() * 0.5, true);
    let row = 0;
    for (let gy = HCY - HRY + 4; gy <= FCY - 6; gy += 4.4, row++) {
      for (let gx = CX - HRX + (row & 1) * 2.5; gx <= CX + HRX; gx += 5.0) {
        const x = gx + (R() - 0.5) * 2, y = gy + (R() - 0.5) * 1.6;
        const ex = (x - CX) / capRX(y), ey = (y - HCY) / HRY;
        if (ex * ex + ey * ey > 0.9) continue;
        push(x, y, 3.8 + R() * 1.0, false);
      }
    }
    for (const [x, y, r] of [[172.5, 224.2, 3.4], [179.5, 223.4, 3.6], [187, 224.2, 3.3], [166, 226.5, 3.0], [194, 226.3, 3.0]]) CURLS.push({ x, y, r, ph: x, ph2: y, sp: (x * 0.13) % 1, lift: 0.15 });
    CURLS.sort((a, b) => a.y - b.y);
  }
  const HX0 = 146, HY0 = 186, HW = 68, HH = 80, HN = HW * HH;
  const HT = new Int16Array(HN);          // 0 empty, 1 skin, 2 ear, 3 frame, 4 hair, 5 lens, 6 brow/lid
  const HC = new Float32Array(HN * 3);
  const HCURL = new Int16Array(HN);
  const HRIM = new Float32Array(HN), HTMP = new Float32Array(HN * 3), CPOS = new Float32Array(1024);
  const LH = norm3(0.45, -0.7, 0.55);
  function drawHead(t, br) {
    HT.fill(0); HCURL.fill(-1);
    const fcy = FCY;
    const set = (x, y, type, rgb) => {
      const lx = x - HX0, ly = y - HY0;
      if (lx < 0 || ly < 0 || lx >= HW || ly >= HH) return;
      const i = ly * HW + lx; HT[i] = type; HC[i * 3] = rgb[0]; HC[i * 3 + 1] = rgb[1]; HC[i * 3 + 2] = rgb[2];
    };
    const get = (x, y) => { const i = (y - HY0) * HW + (x - HX0); return [HC[i * 3], HC[i * 3 + 1], HC[i * 3 + 2]]; };
    // ears
    for (const s of [-1, 1]) {
      const ex = CX + s * 16.4, ey = fcy + 1.5;
      for (let y = fl(ey - 6); y <= ey + 6; y++) for (let x = fl(ex - 4); x <= ex + 4; x++) {
        const u = (x + 0.5 - ex) / 2.7, v = (y + 0.5 - ey) / 5.2;
        if (u * u + v * v > 1) continue;
        let l = s > 0 ? 0.6 : 0.36;
        if (Math.abs(u + s * 0.1) < 0.45 && Math.abs(v) < 0.5) l -= 0.18;
        set(x, y, 2, ramp(R_SKIN, l));
      }
    }
    // the face, tilted a little up to the light
    for (let y = fcy - 22; y <= fcy + 22; y++) for (let x = 162; x < 198; x++) {
      const X = x + 0.5 - CX, Y = y + 0.5 - fcy, hw = faceHW(Y);
      if (hw < 0 || Math.abs(X) > hw) continue;
      const fx = x - CX, fy = y - fcy;
      const nx = clamp(X / (hw + 1.6), -1, 1) * 0.9, ny = clamp((Y - 4) / 22, -1, 1) * 0.45;
      let l = 0.36 + 0.56 * lam(nx, ny, Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny)));
      if (fy >= -6 && fy <= 1 && Math.abs(Math.abs(X) - 8.5) < 4) l -= 0.05;       // sockets
      if (fy >= 4 && fy <= 7 && Math.abs(Math.abs(X) - 10) < 3) l += 0.05;          // cheekbones
      if (fy >= 9 && Math.abs(X) > hw - 3.5 && X < 0) l -= 0.08;                    // the jaw turning away
      if (fx === -3 && fy >= -1 && fy <= 4) l -= 0.14;                              // the nose
      if (fx === 0 && fy >= -2 && fy <= 3) l += 0.06;
      if (fy === 5 || fy === 6) { if (fx >= -2 && fx <= 2) l += 0.08; if (fx === -3) l -= 0.18; }
      if (fy === 8 && fx >= -2 && fx <= 1) l -= 0.12;
      if (fy === 15 && fx >= -2 && fx <= 1) l -= 0.1;
      if (fy >= 19) l -= 0.1;                                                       // under the chin
      let rgb = ramp(R_SKIN, l);
      for (const s of [-1, 1]) { const db = Math.hypot(X - s * 10, Y - 5); if (db < 3.5) rgb = mix3(rgb, [226, 128, 120], 0.14 * (1 - db / 3.5)); }
      // a quiet smile
      if (fy === 12 && fx >= -5 && fx <= 4) rgb = mix3(PAL[39], PAL[38], 0.35);
      if (fy === 11 && (fx === -6 || fx === 5)) rgb = mix3(rgb, PAL[39], 0.8);
      if (fy === 13 && fx >= -3 && fx <= 2) rgb = mix3(rgb, [214, 120, 112], 0.32);
      // nostrils, seen from a little below
      if (fy === 7 && (fx === -3 || fx === 2)) rgb = PAL[39];
      if (fy === 7 && (fx === -2 || fx === 1)) rgb = mix3(rgb, PAL[39], 0.5);
      // light stubble: lip, chin, jaw
      const lip = fy >= 11 && fy <= 13 && fx >= -6 && fx <= 5;
      const stub = (fy >= 9 && fy <= 10 && Math.abs(fx + 0.5) <= 5.5 && !(fy === 9 && (fx === -3 || fx === 2))) || (fy >= 14 && Math.abs(X) < hw - 0.3) || (fy >= 4 && Math.abs(X) > hw - 3.6);
      if (stub && !lip && ((((x * 7 + y * 3) % 5) === 0) || (((x * 3 + y * 11) % 7) === 0))) rgb = mix3(rgb, [70, 50, 54], 0.42);
      set(x, y, 1, rgb);
    }
    // closed eyes, relaxed brows
    for (const s of [-1, 1]) {
      const mir = (x) => (s < 0 ? x : 359 - x);
      for (let x = 169; x <= 173; x++) { const p = get(mir(x), fcy - 6); set(mir(x), fcy - 6, 1, [p[0] * 0.86, p[1] * 0.84, p[2] * 0.88]); }
      for (const [x, dy] of [[167, 0], [168, 1], [169, 1], [170, 2], [171, 2], [172, 2], [173, 1], [174, 1], [175, 0]]) set(mir(x), fcy - 4 + dy, 6, mix3(PAL[38], PAL[44], 0.35));
      set(mir(166), fcy - 3, 6, mix3(PAL[39], PAL[44], 0.3));
      for (let x = 165; x <= 176; x++) set(mir(x), fcy - 13, 6, x >= 174 ? PAL[44] : PAL[45]);
      for (let x = 167; x <= 174; x++) set(mir(x), fcy - 14, 6, PAL[45]);
      set(mir(164), fcy - 12, 6, mix3(PAL[45], PAL[40], 0.4));
    }
    // round, dark-rimmed glasses
    const glintP = mod(t - GLINT_T, D) / GLINT_DUR;
    for (const s of [-1, 1]) {
      const cx = CX + s * 8.5, cy = fcy - 3.5;
      for (let y = fl(cy - 8); y <= cy + 8; y++) for (let x = fl(cx - 8); x <= cx + 8; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
        if (d >= 7.05) continue;
        if (d >= 5.3) {
          let rgb = PAL[0];
          if (dx > 0.5 && dy < -0.5 && d > 6) rgb = s > 0 ? [128, 112, 136] : [80, 78, 108];       // the rim catches light
          set(x, y, 3, rgb);
        } else {
          const lx = x - HX0, ly = y - HY0, i = ly * HW + lx;
          let rgb = HT[i] ? [HC[i * 3], HC[i * 3 + 1], HC[i * 3 + 2]] : PAL[40];
          rgb = mix3(rgb, [214, 202, 236], 0.12 + 0.1 * clamp(-(dx + dy) / 6, 0, 1));
          if ((Math.round(dx - 0.5) === 2 && Math.round(dy - 0.5) === -4) || (Math.round(dx - 0.5) === 3 && Math.round(dy - 0.5) === -3)) rgb = mix3(rgb, PAL[13], 0.7);
          if (glintP < 1) {
            const c = lerp(-22, 22, glintP), e = Math.sin(Math.PI * glintP);
            const q = (x + 0.5 - CX) + 0.6 * dy - c;
            const k = Math.exp(-q * q / 2.2) * e + 0.6 * Math.exp(-Math.pow(q + 3.6, 2) / 0.6) * e;
            rgb = mix3(rgb, PAL[13], clamp(k, 0, 0.92));
          }
          set(x, y, HT[i] === 6 ? 6 : 5, rgb);
        }
      }
    }
    for (const yy of [fcy - 5, fcy - 4]) { set(179, yy, 3, PAL[0]); set(180, yy, 3, PAL[0]); }
    for (const x of [162, 163]) set(x, fcy - 4, 3, PAL[0]);
    for (const x of [196, 197]) set(x, fcy - 4, 3, [52, 40, 52]);
    // a dense base of hair under the curls
    for (let y = HY0; y < HY0 + HH; y++) for (let x = HX0; x < HX0 + HW; x++) {
      const X = x + 0.5 - CX, Y = y + 0.5 - FCY;
      const ex = X / (capRX(y + 0.5) - 1), ey = (y + 0.5 - HCY) / (HRY - 1);
      if (ex * ex + ey * ey > 1 || Y > -4) continue;
      if (Y > hairline(X) - 0.5 && Math.abs(X) < faceHW(Y) + 0.8) continue;
      const i = (y - HY0) * HW + (x - HX0);
      if (HT[i] === 3 || HT[i] === 5 || HT[i] === 6) continue;
      HT[i] = 4; HCURL[i] = -2;
    }
    // the curls, lifting in the aura's updraft
    const cpos = CPOS;
    for (let k = 0; k < CURLS.length; k++) {
      const c = CURLS[k];
      const up = c.lift * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(TAU * t / 6 + c.ph + c.x * 0.12))) * (0.7 + 0.5 * br);
      const cx = c.x + 0.3 * c.lift * Math.sin(TAU * t / 8 + c.ph2), cy = c.y - up;
      cpos[k * 2] = cx; cpos[k * 2 + 1] = cy;
      for (let y = fl(cy - c.r - 1); y <= cy + c.r + 1; y++) for (let x = fl(cx - c.r - 1); x <= cx + c.r + 1; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy > c.r * c.r) continue;
        const lx = x - HX0, ly = y - HY0;
        if (lx < 0 || ly < 0 || lx >= HW || ly >= HH) continue;
        const i = ly * HW + lx;
        if (HT[i] === 3 || HT[i] === 5) continue;
        HT[i] = 4; HCURL[i] = k;
      }
    }
    for (let ly = 0; ly < HH; ly++) for (let lx = 0; lx < HW; lx++) {
      const i = ly * HW + lx;
      if (HT[i] !== 4) continue;
      const k = HCURL[i], x = lx + HX0, y = ly + HY0;
      let l;
      if (k < 0) {
        l = 0.08 + 0.12 * ih(x, y, 702);
      } else {
        const c = CURLS[k];
        const dx = x + 0.5 - cpos[k * 2], dy = y + 0.5 - cpos[k * 2 + 1];
        const rho = Math.min(1, Math.hypot(dx, dy) / c.r), nz = Math.sqrt(Math.max(0, 1 - rho * rho));
        l = 0.14 + 0.62 * Math.max(0, (dx / c.r) * LH[0] + (dy / c.r) * LH[1] + nz * LH[2]);
        const gx = (x + 0.5 - CX) / 24, gy = (y + 0.5 - HCY) / 21, gz = Math.sqrt(Math.max(0, 1 - gx * gx - gy * gy));
        l += 0.24 * Math.max(0, gx * LH[0] + gy * LH[1] + gz * LH[2]) - 0.08;
        const sp = Math.atan2(dy, dx) / TAU + rho * 0.95 + c.sp;
        if (sp - fl(sp) < 0.19 && rho > 0.25 && rho < 0.88) l = 0.04;              // the curl's own spiral, inked
        let under = false;
        for (const o of [-HW, -1, 1, HW]) { const n = i + o; if (n >= 0 && n < HN && HT[n] === 4 && HCURL[n] > k) { under = true; break; } }
        if (under) l = 0.02;                                                        // ink where a later curl overlaps
      }
      const rgb = ramp(R_HAIR, l * 1.25);
      HC[i * 3] = rgb[0]; HC[i * 3 + 1] = rgb[1]; HC[i * 3 + 2] = rgb[2];
    }
    // ink the head's outline; a warm rim on the hair that faces the aura's glow
    const occupied = (lx, ly) => {
      if (lx < 0 || ly < 0 || lx >= HW || ly >= HH) return false;
      if (HT[ly * HW + lx]) return true;
      const X = lx + HX0 - NX0, Y = ly + HY0 - NY0;
      return X >= 0 && Y >= 0 && X < NW && Y < NH && NZ[Y * NW + X] > 0 && ly + HY0 > fcy + 12;
    };
    HRIM.fill(0);
    HTMP.set(HC);
    for (let ly = 0; ly < HH; ly++) for (let lx = 0; lx < HW; lx++) {
      const i = ly * HW + lx, ty = HT[i];
      if (!ty) continue;
      const up = occupied(lx, ly - 1), dn = occupied(lx, ly + 1), lf = occupied(lx - 1, ly), rt = occupied(lx + 1, ly);
      let c = [HC[i * 3], HC[i * 3 + 1], HC[i * 3 + 2]];
      const edge = !up || !dn || !lf || !rt;
      if (edge && (ty === 4)) c = PAL[44];
      else if (edge && (ty === 1 || ty === 2)) c = INKOF[M_SKIN];
      else if (ty === 1) {
        // the line where hair meets forehead and the ear meets the cheek
        for (const o of [-HW, -1, 1]) { const n = i + o; if (n >= 0 && n < HN && (HT[n] === 4 || HT[n] === 2)) { c = mix3(c, INKOF[M_SKIN], 0.55); break; } }
      }
      HTMP[i * 3] = c[0]; HTMP[i * 3 + 1] = c[1]; HTMP[i * 3 + 2] = c[2];
      let open = 0;
      for (const [ox, oy, w] of [[0, -2, 1], [-2, 0, 0.85], [2, 0, 0.85], [-1, -2, 0.8], [1, -2, 0.8], [0, -3, 0.5]]) if (!occupied(lx + ox, ly + oy)) open = Math.max(open, w);
      HRIM[i] = edge ? 0.2 * open : (ty === 4 || ty === 2 ? open : open * 0.5);
    }
    for (let ly = 0; ly < HH; ly++) for (let lx = 0; lx < HW; lx++) {
      const i = ly * HW + lx;
      if (!HT[i]) continue;
      const X = lx + HX0 - NX0, Y = ly + HY0 - NY0;
      if (X < 0 || Y < 0 || X >= NW || Y >= NH) continue;
      const n = Y * NW + X;
      NZ[n] = 7; NFIG[n] = 1; NRIM[n] = HRIM[i];
      NC[n * 3] = HTMP[i * 3]; NC[n * 3 + 1] = HTMP[i * 3 + 1]; NC[n * 3 + 2] = HTMP[i * 3 + 2];
    }
  }

  /* ================================================================ shore, grass, pebbles, reeds, fireflies, motes */
  const shoreY = (x) => SHORE + 3 * (fbm(x / 16, 0.3, 801, 3) - 0.5) * 2 - 20 * sstep(70, 0, x) - 18 * sstep(296, 360, x);
  const SHOREY = new Float32Array(W);
  const PEBBLES = [], TUFTS = [], REEDS = [];
  function buildShore() {
    for (let x = 0; x < W; x++) SHOREY[x] = shoreY(x);
    const R = mulberry32(8181);
    for (let k = 0; k < 26; k++) { const x = 4 + R() * 352; PEBBLES.push({ x, y: SHOREY[fl(x)] + 0.5 + R() * 6, rx: 1.8 + R() * 3.4, ry: 1.3 + R() * 1.8, t: R() }); }
    for (let k = 0; k < 40; k++) { const x = R() * W; TUFTS.push({ x, n: 3 + fl(R() * 4), h: 4 + R() * 7, ph: R() * TAU, lean: (R() - 0.5) * 0.6, lit: R() }); }
    for (let k = 0; k < 8; k++) REEDS.push({ x: 310 + k * 5.6 + R() * 3, base: shoreY(316 + k * 5) + 6, h: 104 + R() * 60, lean: -6 - R() * 10, ph: R() * TAU, amp: 1.6 + R() * 1.6, cat: R() < 0.55, blade: false });
    for (let k = 0; k < 5; k++) REEDS.push({ x: 304 + R() * 52, base: 448, h: 60 + R() * 60, lean: -22 - R() * 20, ph: R() * TAU, amp: 2.2 + R() * 1.4, cat: false, blade: true });
    for (let k = 0; k < 4; k++) REEDS.push({ x: 4 + k * 8 + R() * 4, base: shoreY(10 + k * 8) + 6, h: 92 + R() * 44, lean: 6 + R() * 8, ph: R() * TAU, amp: 1.4 + R() * 1.2, cat: k === 1 || k === 3, blade: false });
    for (let k = 0; k < 4; k++) REEDS.push({ x: R() * 44, base: 448, h: 52 + R() * 48, lean: 18 + R() * 18, ph: R() * TAU, amp: 2 + R() * 1.4, cat: false, blade: true });
    REEDS.sort((a, b) => (a.blade ? 1 : 0) - (b.blade ? 1 : 0));
  }
  const FIREFLIES = [
    // x0, ground y, height, ax, ay, nx, ny, phases, glow cycles
    [326, 430, 70, 14, 10, 1, 2, 0.3, 1.2, 3, 0.0], [300, 418, 40, 10, 8, 2, 1, 2.1, 0.4, 4, 1.7],
    [340, 432, 118, 8, 14, 1, 1, 4.0, 2.2, 2, 3.1], [72, 412, 26, 9, 9, 1, 2, 1.0, 3.0, 3, 4.4],
    [282, 410, 30, 11, 7, 2, 1, 5.2, 1.1, 3, 2.3], [30, 430, 66, 10, 12, 1, 2, 0.9, 4.1, 4, 5.5],
    [52, 414, 112, 12, 9, 1, 1, 3.3, 0.2, 2, 0.8], [318, 412, 150, 9, 10, 2, 1, 1.4, 5.0, 3, 3.9],
    [104, 422, 30, 13, 8, 1, 2, 2.7, 1.9, 2, 5.0], [256, 424, 36, 10, 9, 1, 1, 4.6, 2.8, 4, 2.6],
    [16, 420, 140, 7, 11, 2, 1, 0.1, 3.6, 3, 1.2],
  ];
  const MOTES = [];
  function buildMotes() {
    const R = mulberry32(3131);
    for (let k = 0; k < 10; k++) MOTES.push({ x: CX + (R() - 0.5) * 130, y0: 300 - R() * 30, rise: 100 + R() * 70, n: R() < 0.5 ? 1 : 2, ph: R(), wob: 2 + R() * 4, wp: R() * TAU, b: 0.5 + R() * 0.5 });
  }

  /* ================================================================ water: ripples on the ground plane */
  // a lake pixel at row y maps to ground (gx, gz), with the stone's water line at gz = 1
  const GK = WL - HY;
  let RIPS = [];
  function setRipples(t) {
    RIPS = [];
    for (let k = 0; k < 3; k++) {
      const a = mod(t - (k * 8 + RIP_DELAY), D);
      if (a >= RIP_LIFE) continue;
      const u = a / RIP_LIFE;
      RIPS.push({ cx: 0, cz: 1.2, half: 0.8, rad: 0.2, R: 0.02 + 0.95 * (1 - Math.pow(1 - u, 1.5)), S: sstep(0, 0.9, a) * Math.pow(1 - u, 1.2) * 1.5 / (1 + 0.8 * u), lam: 0.05 + 0.03 * u, sig: 0.045 + 0.05 * u });
    }
    const a = mod(t - FISH_T, D);
    if (a < FISH_LIFE) {
      const u = a / FISH_LIFE;
      RIPS.push({ cx: (64 - CX) / 72, cz: GK / 72, half: 0, rad: 0, R: 0.01 + 0.3 * (1 - Math.pow(1 - u, 1.5)), S: sstep(0, 0.3, a) * Math.pow(1 - u, 1.3) * 1.6, lam: 0.05 + 0.02 * u, sig: 0.04 + 0.04 * u });
    }
  }
  function rippleSlope(gx, gz, fp) {
    let s = 0;
    for (let k = 0; k < RIPS.length; k++) {
      const r = RIPS[k], dx = Math.max(0, Math.abs(gx - r.cx) - r.half), dz = gz - r.cz;
      const d = Math.sqrt(dx * dx + dz * dz) - r.rad, q = d - r.R;
      if (q > 3 * r.sig || q < -3 * r.sig) continue;
      const att = clamp(r.lam / (2.2 * fp) - 0.25, 0, 1);
      if (att <= 0) continue;
      s += Math.exp(-q * q / (r.sig * r.sig)) * r.S * att * Math.cos(TAU * q / r.lam);
    }
    return s;
  }

  /* ================================================================ frame */
  let IA = 0;
  function drawFrame(t) {
    t = mod(t, D);
    const br = breathAt(t);
    IA = 0.4 + 0.6 * br;
    setRipples(t);
    FORCE.fill(0);
    ZONE.fill(0);
    LR.set(BLR); LG.set(BLG); LB.set(BLB);
    const offA = PA * t / D, offB = PB * 2 * t / D;

    // 1. the far world: sky, stars, cloud bands, far mist
    BGF.set(BG0);
    for (const s of STARS) {
      const v = s.b * (0.72 + 0.28 * Math.sin(TAU * s.n * t / D + s.ph));
      const j = (s.y * W + s.x) * 3;
      BGF[j] += s.col[0] * v * 0.8; BGF[j + 1] += s.col[1] * v * 0.8; BGF[j + 2] += s.col[2] * v * 0.8;
      if (s.big) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const jj = ((s.y + oy) * W + s.x + ox) * 3;
        BGF[jj] += s.col[0] * v * 0.3; BGF[jj + 1] += s.col[1] * v * 0.3; BGF[jj + 2] += s.col[2] * v * 0.3;
      }
    }
    drawClouds(t, br);
    MD.fill(0);
    for (let y = MY0; y < MY1; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const mb = mistB(x, y, offB), ma = mistA(x, y, offA);
      MD[i] = ma;
      if (y < HY && mb > 0.004) {
        const k = mb * (LANDM[i] ? 0.5 : 1), gl = glowX(x), j = i * 3;
        BGF[j] = lerp(BGF[j], lerp(176, 240, gl), k); BGF[j + 1] = lerp(BGF[j + 1], lerp(158, 204, gl), k); BGF[j + 2] = lerp(BGF[j + 2], lerp(200, 194, gl), k);
      }
    }
    C.set(BGF, 0);

    // 2. the aura
    drawAura(t, br);

    // 3. the near layer: rock, legs and hands still; the body at its breath state; the head redrawn
    NZ.fill(0); NFIG.fill(0); NRIM.fill(0);
    for (let i = 0; i < NN; i++) if (LA.z[i]) { NZ[i] = LA.z[i]; NFIG[i] = LA.fig[i]; NRIM[i] = LA.rim[i]; NC[i * 3] = LA.c[i * 3]; NC[i * 3 + 1] = LA.c[i * 3 + 1]; NC[i * 3 + 2] = LA.c[i * 3 + 2]; }
    const LBk = LBS[Math.min(NBS - 1, Math.round(br * (NBS - 1)))];
    for (let i = 0; i < NN; i++) {
      const z = LBk.z[i];
      if (!z || z <= NZ[i]) continue;
      NZ[i] = z; NFIG[i] = 1; NRIM[i] = LBk.rim[i];
      NC[i * 3] = LBk.c[i * 3]; NC[i * 3 + 1] = LBk.c[i * 3 + 1]; NC[i * 3 + 2] = LBk.c[i * 3 + 2];
    }
    drawHead(t, br);
    const ar = 86 * IA, ag = 52 * IA, ab = 40 * IA;
    for (let i = 0; i < NN; i++) {
      if (!NZ[i] || NRIM[i] <= 0) continue;
      const k = NRIM[i] * (NFIG[i] ? 1 : 0.5);
      NC[i * 3] += ar * k; NC[i * 3 + 1] += ag * k; NC[i * 3 + 2] += ab * k;
    }
    OCC.fill(0);
    for (let ly = 0; ly < NH; ly++) for (let lx = 0; lx < NW; lx++) if (NZ[ly * NW + lx]) OCC[(ly + NY0) * W + lx + NX0] = 1;
    softenOcc();

    auraLight(br);
    // 4. the lake: the aura and the sky mirrored through the ripples, him and the stone faintly, inked water lines
    const ph = TAU * t / D;
    for (let y = HY; y < H; y++) {
      const dyH = y - HY + 0.5;
      const gz = GK / dyH, fp = Math.max(GK / (dyH * dyH), 1 / dyH);
      const fade = sstep(HY, H, y);
      const refl = lerp(0.9, 0.68, fade);
      const dr = lerp(30, 12, fade), dg = lerp(48, 26, fade), db = lerp(68, 42, fade);
      const shim = (dyH / 150) * (0.8 * Math.sin(0.52 * y + 3 * ph) + 0.5 * Math.sin(0.19 * y - 2 * ph + 1.3));
      const depth = clamp((y - HY) / (SHORE - HY), 0, 1);
      const period = 16 + 30 * depth, dlen = 3 + 9 * depth, dens = 0.32 + 0.3 * depth;
      const drift = 3.5 * Math.sin(ph + y * 0.37) + 2.5 * Math.sin(2 * ph + y * 0.11);
      const rowOff = ih(y, 1, 830) * period, inkRow = ((y - HY) % (depth < 0.35 ? 3 : 2)) === 0;
      const nrow = y - NY0;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (nrow < NH && x >= NX0 && x < NX0 + NW && NZ[nrow * NW + x - NX0] > 0) continue;
        const gx = (x + 0.5 - CX) / dyH;
        const s = rippleSlope(gx, gz, fp);
        const xs = clamp(fl(x + shim + 0.5 + s * 0.6), 0, W - 1);
        let r, g, b;
        let ys = 2 * DYW - 1 - y + Math.round(s * 2);
        if (y >= DYW && ys >= AY0 && ys < DYW && DCL[ys * W + xs]) {
          const j = (ys * W + xs) * 3, k = 0.74;
          r = DCOL[j] * k + dr * (1 - k); g = DCOL[j + 1] * k + dg * (1 - k); b = DCOL[j + 2] * k * 1.02 + db * (1 - k);
        } else {
          ys = clamp(2 * HY - 1 - y + Math.round(s * (y < WL ? 1.2 : 2.2)), 0, HY - 1);
          const j = (ys * W + xs) * 3;
          r = BGF[j] * refl * 0.92 + dr * (1 - refl); g = BGF[j + 1] * refl * 0.97 + dg * (1 - refl); b = BGF[j + 2] * refl + db * (1 - refl);
        }
        // him and the stone, broken and faint (behind the aura's own reflection in tone, not a second stone)
        if (y >= WL) {
          const yn = 2 * WL - 1 - y + Math.round(s * 1.8);
          const br2 = (y - WL) / 30;
          const xb = clamp(xs + Math.round(br2 * (Math.sin(y * 1.9 + 3 * ph) + 0.6 * Math.sin(y * 0.7 - 2 * ph))), 0, W - 1);
          const lx = xb - NX0, ly = yn - NY0;
          if (lx >= 0 && ly >= 0 && lx < NW && ly < NH && NZ[ly * NW + lx] > 0 && ((y - WL) % 3) !== 2) {
            const n = ly * NW + lx, k = 0.42 - 0.18 * sstep(WL, WL + 26, y);
            r = lerp(r, NC[n * 3] * 0.6 + 6, k); g = lerp(g, NC[n * 3 + 1] * 0.62 + 12, k); b = lerp(b, NC[n * 3 + 2] * 0.66 + 20, k);
          }
        }
        let kb = 1 + 0.4 * clamp(s, -1.6, 1.6);
        if (s > 0.62) kb = 1.5; else if (s < -0.62) kb = 0.58;               // ripple crests and troughs inked
        r *= kb; g *= kb; b *= kb;
        // inked horizontal water lines, drifting gently
        if (y > HY + 1) {
          const xo = x + drift + rowOff, seg = fl(xo / period), fpos = xo - seg * period;
          if (fpos < dlen * (0.5 + ih(seg, y, 831)) && ih(seg, y, 832) < dens) {
            if (inkRow) { r = r * 0.58 + 2; g = g * 0.6 + 6; b = b * 0.66 + 14; }
            else { r = lerp(r, 236, 0.22); g = lerp(g, 214, 0.22); b = lerp(b, 222, 0.22); }
          }
        }
        // mist on the far water
        const m = MD[i];
        if (m > 0.004 && y < DYW + 14) {
          const gl = glowX(x);
          r = lerp(r, lerp(176, 244, gl), m * 0.8); g = lerp(g, lerp(158, 208, gl), m * 0.8); b = lerp(b, lerp(200, 194, gl), m * 0.8);
        }
        C[i * 3] = r; C[i * 3 + 1] = g; C[i * 3 + 2] = b;
        // its light: the aura's glow, mirrored
        if (y >= DYW) {
          const yy = 2 * DYW - 1 - y + Math.round(s * 2);
          if (yy >= 0 && yy < DYW) { const ii = yy * W + xs; LR[i] += AL_R[ii] * 0.45; LG[i] += AL_G[ii] * 0.45; LB[i] += AL_B[ii] * 0.45; }
        }
      }
    }

    // 5. the aura itself, in front of the far world, standing on the water
    for (let y = AY0; y < DYW; y++) for (let x = AX0; x < AX1; x++) {
      const i = y * W + x;
      if (!DCL[i]) continue;
      if (DIDX[i]) FORCE[i] = DIDX[i];
      else { C[i * 3] = DCOL[i * 3]; C[i * 3 + 1] = DCOL[i * 3 + 1]; C[i * 3 + 2] = DCOL[i * 3 + 2]; }
    }
    for (let i = 0; i < DYW * W; i++) { if (AL_R[i] > 0) { const o = 1 - 0.9 * OCC[i]; LR[i] += AL_R[i] * o; LG[i] += AL_G[i] * o; LB[i] += AL_B[i] * o; } }
    // mist lying low in front of its foot
    for (let y = DYW - 16; y < DYW + 2; y++) for (let x = AX0; x < AX1; x++) {
      const i = y * W + x, m = MD[i];
      if (m < 0.05 || !DCL[i]) continue;
      if (((x + y) & 1) && m < 0.3) continue;
      FORCE[i] = 0;
      const gl = glowX(x), k = m * 0.85;
      C[i * 3] = lerp(DCOL[i * 3], lerp(196, 246, gl), k); C[i * 3 + 1] = lerp(DCOL[i * 3 + 1], lerp(170, 210, gl), k); C[i * 3 + 2] = lerp(DCOL[i * 3 + 2], lerp(204, 196, gl), k);
    }

    // 6. him and the stone over everything behind
    for (let ly = 0; ly < NH; ly++) for (let lx = 0; lx < NW; lx++) {
      const n = ly * NW + lx;
      if (!NZ[n]) continue;
      const i = (ly + NY0) * W + lx + NX0;
      FORCE[i] = 0;
      C[i * 3] = NC[n * 3]; C[i * 3 + 1] = NC[n * 3 + 1]; C[i * 3 + 2] = NC[n * 3 + 2];
      ZONE[i] = NFIG[n] ? 1 : 2;
    }

    // 7. the near bank: grass, pebbles, tufts, reeds
    drawShore(t);
    for (const R of REEDS) drawReed(R, t);
    // 8. fireflies, motes, the glint's bloom
    for (const f of FIREFLIES) drawFirefly(f, t);
    for (const m of MOTES) {
      const u = mod(t * m.n / D + m.ph, 1);
      const a = Math.pow(Math.sin(Math.PI * u), 2) * m.b * (0.5 + 0.5 * IA);
      const x = m.x + m.wob * Math.sin(TAU * 2 * t / D + m.wp), y = m.y0 - m.rise * u;
      splat(x, y, 1.1, 70 * a, 56 * a, 42 * a);
    }
    const gp = mod(t - GLINT_T, D) / GLINT_DUR;
    if (gp < 1) { const e = Math.sin(Math.PI * gp); splat(lerp(160, 200, gp), FCY - 4, 2.6, 90 * e, 80 * e, 64 * e); }

    quantise();
    lightOut();
  }

  // the aura's light: a bright core behind his head and a warm glow off the ragged rim
  const AL_R = new Float32Array(NP), AL_G = new Float32Array(NP), AL_B = new Float32Array(NP);
  function auraLight(br) {
    const k = 0.55 + 0.45 * IA;
    for (let y = AY0 - 20; y < DYW; y++) for (let x = AX0 - 20; x < AX1 + 20; x++) {
      if (x < 0 || x >= W || y < 0) continue;
      const i = y * W + x, r = DR[i], tb = DTB[i];
      let v1 = Math.exp(-r * r / (26 * 26)) * 80 + Math.exp(-r * r / (60 * 60)) * 22;
      const e = r - B1[tb];
      let v2 = 0;
      if (e > -1 && e < 22) v2 = Math.exp(-Math.max(0, e) / 6) * 26;
      v1 *= k; v2 *= 0.7 + 0.3 * IA;
      AL_R[i] = v1 * 1.0 + v2 * 1.0; AL_G[i] = v1 * 0.86 + v2 * 0.66; AL_B[i] = v1 * 0.7 + v2 * 0.5;
    }
  }
  function softenOcc() {
    const x0 = NX0 - 3, x1 = NX0 + NW + 3, y0 = NY0 - 3, y1 = Math.min(H - 1, NY0 + NH + 3);
    const tmp = OCCT;
    for (let pass = 0; pass < 2; pass++) {
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * W + x; tmp[i] = (OCC[i - 1] + OCC[i] + OCC[i + 1]) / 3; }
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * W + x; OCC[i] = (tmp[i - W] + tmp[i] + tmp[i + W]) / 3; }
    }
  }
  function splat(cx, cy, rad, r, g, b) {
    const R = Math.ceil(rad * 3);
    for (let y = fl(cy - R); y <= cy + R; y++) for (let x = fl(cx - R); x <= cx + R; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, e = Math.exp(-(dx * dx + dy * dy) / (rad * rad));
      const i = y * W + x;
      LR[i] += r * e; LG[i] += g * e; LB[i] += b * e;
    }
  }
  function cput(x, y, rgb, k) {
    x = fl(x); y = fl(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    FORCE[i] = 0;
    if (k === undefined) { C[i * 3] = rgb[0]; C[i * 3 + 1] = rgb[1]; C[i * 3 + 2] = rgb[2]; }
    else { C[i * 3] = lerp(C[i * 3], rgb[0], k); C[i * 3 + 1] = lerp(C[i * 3 + 1], rgb[1], k); C[i * 3 + 2] = lerp(C[i * 3 + 2], rgb[2], k); }
  }
  function fput(x, y, k) { x = fl(x); y = fl(y); if (x >= 0 && y >= 0 && x < W && y < H) FORCE[y * W + x] = k + 1; }
  function drawShore(t) {
    for (let x = 0; x < W; x++) {
      const top = SHOREY[x];
      for (let y = Math.max(0, fl(top)); y < H; y++) {
        const i = y * W + x, d = y + 0.5 - top;
        if (d < 0) continue;
        let k;
        if (d < 1) k = 0;
        else if (d < 2.6) k = 52;
        else {
          const n = fbm(x / 7, y / 4, 840, 2);
          k = n > 0.56 ? 51 : n > 0.42 ? 22 : 21;
          if (((x + y) % 3) === 0 && d > 5) k = k === 51 ? 22 : 21;
        }
        fput(x, y, k); ZONE[i] = 0;
      }
    }
    for (const p of PEBBLES) {
      for (let y = fl(p.y - p.ry - 1); y <= p.y + p.ry + 1; y++) for (let x = fl(p.x - p.rx - 1); x <= p.x + p.rx + 1; x++) {
        const u = (x + 0.5 - p.x) / p.rx, v = (y + 0.5 - p.y) / p.ry, d = u * u + v * v;
        if (d > 1) continue;
        let k = d > 0.62 ? 0 : (u < -0.15 && v < -0.15 ? (p.t < 0.5 ? 8 : 30) : (p.t < 0.5 ? 29 : 28));
        fput(x, y, k);
      }
    }
    for (const tf of TUFTS) {
      const bx = tf.x, by = SHOREY[fl(tf.x)] + 1.5;
      for (let b = 0; b < tf.n; b++) {
        const a = -Math.PI / 2 + tf.lean + (b - (tf.n - 1) / 2) * 0.32 + 0.07 * Math.sin(TAU * t / 6 + tf.ph + b);
        const len = tf.h * (0.6 + 0.4 * ih(b, fl(bx), 850));
        for (let s = 0; s <= len; s += 0.7) {
          const x = bx + (b - tf.n / 2) * 0.8 + Math.cos(a) * s + 0.02 * s * s * Math.sign(Math.cos(a)), y = by + Math.sin(a) * s;
          fput(x, y, s > len - 1.4 && tf.lit > 0.6 ? 12 : (b & 1) ? 51 : 52);
        }
      }
    }
  }
  function drawReed(R, t) {
    const sway = R.amp * Math.sin(TAU * t / 12 + R.ph) + 0.6 * Math.sin(TAU * t / 8 + R.ph * 1.7);
    const by = R.base;
    const N = Math.ceil(R.h * 1.2);
    let px = -1, py = -1;
    const dir = R.x > CX ? 1 : -1;
    for (let k = 0; k <= N; k++) {
      const s = k / N;
      let x, y;
      if (R.blade) { x = R.x + (R.lean + sway * 1.4) * Math.pow(s, 1.7); y = by - R.h * (s - 0.38 * s * s * s); }
      else { x = R.x + (R.lean + sway) * s * s; y = by - R.h * s; }
      const xi = fl(x), yi = fl(y);
      if (xi === px && yi === py) continue;
      px = xi; py = yi;
      const thick = R.blade ? (s < 0.5 ? 2 : 1) : (s < 0.35 ? 2 : 1);
      for (let q = 0; q < thick; q++) fput(xi + q * -dir, yi, s < 0.25 ? 0 : 21);
      if (s > 0.25) cput(xi + (dir > 0 ? 1 : 2), yi, s > 0.55 ? PAL[12] : PAL[24], R.blade ? 0.45 : 0.6);
      if (R.cat && s > 0.7 && s < 0.84) {
        for (let q = -2; q <= 2; q++) {
          const k = Math.abs(q) === 2 ? 44 : q < 0 ? 45 : q > 0 ? 47 : 46;
          if (xi + q >= 0 && xi + q < W && yi < H) { fput(xi + q, yi, k); ZONE[yi * W + xi + q] = 1; }
        }
      }
    }
  }
  function drawFirefly(f, t) {
    const [x0, yg, h0, ax, ay, nx, ny, p1, p2, nb, pb] = f;
    const x = x0 + ax * Math.sin(TAU * nx * t / D + p1);
    const hgt = h0 + ay * Math.sin(TAU * ny * t / D + p2);
    const y = yg - hgt;
    let b = 0.5 - 0.5 * Math.cos(TAU * nb * t / D + pb);
    b = b * b * (3 - 2 * b);
    if (b < 0.04) return;
    splat(x, y, 3.4, 120 * b, 96 * b, 40 * b);
    splat(x, y, 1.2, 80 * b, 70 * b, 40 * b);
    const xi = fl(x), yi = fl(y);
    if (xi >= 0 && yi >= 0 && xi < W && yi < H) {
      if (b > 0.55) FORCE[yi * W + xi] = 14; else if (b > 0.25) FORCE[yi * W + xi] = 27;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) cput(xi + ox, yi + oy, [255, 214, 120], 0.3 * b);
    }
    const ry = yg + hgt;
    if (ry < SHOREY[clamp(xi, 0, W - 1)] && yg > HY) {
      splat(x, ry, 3, 50 * b, 40 * b, 18 * b);
      const ryi = fl(ry);
      if (b > 0.6 && xi >= 0 && xi < W && ryi < H) { const i = ryi * W + xi; if (!ZONE[i]) FORCE[i] = 27; }
    }
  }

  /* ================================================================ quantise + the soft layer */
  function quantise() {
    for (let y = 0, i = 0; y < H; y++) {
      const by = (y & 3) << 2;
      for (let x = 0; x < W; x++, i++) {
        if (FORCE[i]) { OUT[i] = FORCE[i] - 1; continue; }
        const z = ZONE[i];
        const j = i * 3, dth = (BAY[by | (x & 3)] - 0.5) * (z === 1 ? DITH_FIG : DITH_ENV);
        let r = C[j] + dth, g = C[j + 1] + dth, b = C[j + 2] + dth;
        r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
        OUT[i] = (z === 1 ? LUT_ALL : LUT_ENV)[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)];
      }
    }
  }
  const TONE = new Uint8Array(4096);
  for (let k = 0; k < 4096; k++) TONE[k] = Math.round(255 * (1 - Math.exp(-(k / 4) / 200)));
  function lightOut() {
    for (let i = 0, j = 0; i < NP; i++, j += 3) {
      const r = LR[i] * 4, g = LG[i] * 4, b = LB[i] * 4;
      LOUT[j] = TONE[r <= 0 ? 0 : r >= 4095 ? 4095 : r | 0];
      LOUT[j + 1] = TONE[g <= 0 ? 0 : g >= 4095 ? 4095 : g | 0];
      LOUT[j + 2] = TONE[b <= 0 ? 0 : b >= 4095 ? 4095 : b | 0];
    }
  }
  // the full-resolution picture: pixels nearest-neighbour, light bilinear, screen-blended, finely dithered
  let XI0 = null, XI1 = null, XF = null, COMPK = 0;
  function composite(K, dst) {
    const OW = W * K, OH = H * K;
    if (COMPK !== K) {
      COMPK = K; XI0 = new Int32Array(OW); XI1 = new Int32Array(OW); XF = new Float32Array(OW);
      for (let X = 0; X < OW; X++) { const u = clamp((X + 0.5) / K - 0.5, 0, W - 1); XI0[X] = fl(u); XI1[X] = Math.min(W - 1, fl(u) + 1); XF[X] = u - fl(u); }
    }
    const stride = dst.length / (OW * OH);
    for (let Y = 0; Y < OH; Y++) {
      const v = clamp((Y + 0.5) / K - 0.5, 0, H - 1), y0 = fl(v), y1 = Math.min(H - 1, y0 + 1), fy = v - y0;
      const yp = fl(Y / K);
      for (let X = 0; X < OW; X++) {
        const p = PAL[OUT[yp * W + fl(X / K)]];
        const a = (y0 * W + XI0[X]) * 3, b = (y0 * W + XI1[X]) * 3, c = (y1 * W + XI0[X]) * 3, d = (y1 * W + XI1[X]) * 3, fx = XF[X];
        const n = (((X * 1973) ^ (Y * 9277) ^ (X * Y * 31)) & 255) / 255 - 0.5;
        const o = (Y * OW + X) * stride;
        for (let ch = 0; ch < 3; ch++) {
          const l = lerp(lerp(LOUT[a + ch], LOUT[b + ch], fx), lerp(LOUT[c + ch], LOUT[d + ch], fx), fy) / 255;
          dst[o + ch] = clamp(255 - (255 - p[ch]) * (1 - l) + n, 0, 255);
        }
        if (stride === 4) dst[o + 3] = 255;
      }
    }
  }

  /* ================================================================ build */
  let BUILT = false;
  function build() {
    if (BUILT) return;
    buildLUT();
    buildSky();
    buildPolar();
    buildClouds();
    buildMist();
    buildStars();
    buildAura();
    paintRock(LA);
    paintLegs(LA);
    paintHands(LA);
    for (let k = 0; k < NBS; k++) { const L = layer(); paintUpper(L, k / (NBS - 1)); LBS.push(L); }
    finish(LA, LBS[0]);
    for (const L of LBS) finish(L, LA);
    buildCurls();
    buildShore();
    buildMotes();
    BUILT = true;
  }

  // a canvas-free core, for tools (node) and for the render hook
  const core = { W, H, D, PAL, OUT, LOUT, build, render: drawFrame, composite, breathAt };
  window.__stillpointCore = core;

  /* ================================================================ mount */
  (window.PIECES = window.PIECES || []).push({
    id: 'still-point',
    title: 'The Still Point',
    medium: 'Inked pixel art in 53 colours under a soft light · 360 × 450 · 24 s loop',
    note: 'Breathe with him · tap to pause',
    about: 'Blue hour at the edge of a still mountain lake. A man in a navy cardigan sits cross-legged on a flat stone, eyes closed behind round glasses, hands in a mudra on his knees, and breathes: in for three and a half seconds, out for four and a half. Behind him stands his aura, a great disc of hand-drawn contour lines with a ragged, cloud-like rim, plum at its heart and apricot at its edge. With every in-breath it swells, its lines flow outward and a new one is born at its core; the lake holds its reflection, and a ripple rings out from the stone.',
    tone: 'dark',
    room: '#0b0c20',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0;
      el.style.background = '#0b0c20';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(255,241,214,.85)"/><rect x="19" y="9" width="5" height="16" fill="rgba(255,241,214,.85)"/></svg>';
      el.appendChild(pauseMark);
      const pc = document.createElement('canvas'); pc.width = W; pc.height = H;
      const pg = pc.getContext('2d'); const pimg = pg.createImageData(W, H);
      const lc = document.createElement('canvas'); lc.width = W; lc.height = H;
      const lg = lc.getContext('2d'); const limg = lg.createImageData(W, H);
      let K = 3, show = 3;
      function layout() {
        const dpr = Math.min(3, window.devicePixelRatio || 1);
        let left = 0, top = 0, cssW, cssH;
        if (EXPORT) {
          cssW = 1080; cssH = 1350; cv.style.position = 'fixed'; K = 3;
        } else {
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          const fit = Math.min(w * dpr / W, h * dpr / H) * 0.97;
          K = Math.max(1, Math.floor(fit)); show = K;
          if (K < fit * 0.88) { K = Math.max(1, Math.ceil(fit)); show = fit; }
          cssW = W * show / dpr; cssH = H * show / dpr;
          left = Math.round((w - cssW) / 2); top = Math.round((h - cssH) / 2);
        }
        if (cv.width !== W * K || cv.height !== H * K) { cv.width = W * K; cv.height = H * K; }
        cv.style.left = left + 'px'; cv.style.top = top + 'px'; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
        cv.style.imageRendering = 'auto';
        pauseMark.style.left = (left + cssW - 48) + 'px'; pauseMark.style.top = (top + 14) + 'px';
      }
      function present() {
        // on screen the GPU does the screen blend; the exported frames use composite(), the same maths in JS
        const pd = pimg.data, ld = limg.data;
        for (let i = 0; i < NP; i++) { const p = PAL[OUT[i]]; pd[i * 4] = p[0]; pd[i * 4 + 1] = p[1]; pd[i * 4 + 2] = p[2]; pd[i * 4 + 3] = 255; ld[i * 4] = LOUT[i * 3]; ld[i * 4 + 1] = LOUT[i * 3 + 1]; ld[i * 4 + 2] = LOUT[i * 3 + 2]; ld[i * 4 + 3] = 255; }
        pg.putImageData(pimg, 0, 0); lg.putImageData(limg, 0, 0);
        g.globalCompositeOperation = 'source-over';
        g.imageSmoothingEnabled = false;
        g.drawImage(pc, 0, 0, W * K, H * K);
        g.globalCompositeOperation = 'screen';
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        g.drawImage(lc, 0, 0, W * K, H * K);
        g.globalCompositeOperation = 'source-over';
      }
      const hook = {
        duration: D,
        lastMs: 0,
        isReady: () => BUILT && (!EXPORT || (() => { const st = el.parentElement; return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999; })()),
        renderAt(t) {
          return new Promise((res) => {
            if (!EXPORT) { playing = false; clock = t; }
            const t0 = performance.now(); drawFrame(t); hook.lastMs = performance.now() - t0;
            present();
            requestAnimationFrame(() => (EXPORT ? requestAnimationFrame(res) : res()));
          });
        },
        // the exported frame, 1080 × 1350 RGB, base64
        pixels() {
          const OW = W * 3, OH = H * 3, rgb = new Uint8Array(OW * OH * 3);
          composite(3, rgb);
          let s = '';
          for (let k = 0; k < rgb.length; k += 0x8000) s += String.fromCharCode.apply(null, rgb.subarray(k, k + 0x8000));
          return btoa(s);
        },
        art() { let s = ''; for (let i = 0; i < NP; i++) { const p = PAL[OUT[i]]; s += String.fromCharCode(p[0], p[1], p[2]); } return btoa(s); },
      };
      layout();
      build();
      drawFrame(0); present();
      window.__stillpoint = hook;
      if (EXPORT) document.documentElement.dataset.ready = 'still-point';
      api.ready();
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        raf = requestAnimationFrame(frame);
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
        if (!playing) return;
        clock = (clock + dt) % D;
        drawFrame(clock); present();
      }
      if (!EXPORT) raf = requestAnimationFrame(frame);
      const onDown = () => { if (EXPORT) return; playing = !playing; last = 0; pauseMark.style.opacity = playing ? '0' : '1'; };
      cv.addEventListener('pointerdown', onDown);
      let rt = 0;
      const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (!alive) return; layout(); drawFrame(clock); present(); }, 120); });
      ro.observe(el);
      return {
        destroy() {
          alive = false; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(rt);
          cv.removeEventListener('pointerdown', onDown);
          if (window.__stillpoint === hook) delete window.__stillpoint;
        },
      };
    },
  });
})();
