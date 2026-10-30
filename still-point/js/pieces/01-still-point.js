/* The Still Point — piece 1.
 *
 * Blue hour, a few minutes before dawn. A young man with dense dark curls, round dark-rimmed glasses and a
 * navy cardigan over a white tee sits cross-legged on a flat granite slab at the edge of a perfectly still
 * mountain lake, eyes closed, hands open on his knees. He breathes three times in the 24-second loop (in
 * 3.5 s, out 4.5 s). With each in-breath a soft ring of light leaves his heart and travels out through the
 * sky and the mist; the lake mirrors it, and a real ripple spreads from the rock in step.
 *
 * Two treatments, one picture. The scene and the figure are pixel art on a 360 × 450 grid: albedo is painted
 * once at mount (sky, cirrus, moon, layered hills, pines, mist maps, the rock, the body), then every frame
 * re-composes and relights it (a breath warp of the upper body, the head redrawn with stirring curls and a
 * glint on the glasses, aura rim light, the water re-reflecting everything through the ripples) and
 * quantises it to 48 colours with a 4 × 4 Bayer dither, shown 3× nearest-neighbour. Over it lies a smooth
 * light layer, computed on the same grid but kept continuous, upscaled bilinearly and screen-blended: the
 * aura, the rings and their reflections, the dawn bloom, firefly halos, rising motes. Hard pixels, soft
 * light. Every frame is a pure function of t; every motion completes a whole number of cycles in D = 24 s.
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
  // value noise that wraps in x with an integer lattice period P (so drifting mist can loop)
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

  /* ================================================================ timing (all in seconds) */
  const BP = 8, INH = 3.5;                         // three breaths: in 3.5 s, out 4.5 s
  function breathAt(t) {
    const u = mod(t, BP);
    return u < INH ? 0.5 - 0.5 * Math.cos(Math.PI * u / INH) : 0.5 + 0.5 * Math.cos(Math.PI * (u - INH) / (BP - INH));
  }
  const RING_BIRTH = [0, 8, 16], RING_LIFE = 17.5;  // a ring of light leaves him at the start of each in-breath (the bowl)
  const RIP_DELAY = 0.35, RIP_LIFE = 15;            // ...and the lake answers with a ripple from the rock
  const GLINT_T = 5.0, GLINT_DUR = 2.2;             // once per loop, dawn light slides across his glasses
  const FISH_T = 13.6, FISH_LIFE = 7.5;             // once per loop, a fish rings the water far to the left

  /* ================================================================ scene geometry */
  const HY = 282;          // the far shore: horizon of the lake
  const WL = 382;          // the water line at the rock
  const CX = 180;          // his centre line
  const HEARTY = 302;      // where the light comes from

  /* ================================================================ palette (48) */
  const PAL_HEX = [
    '0c0e24', '131834', '1b2148', '232c5c', '2d3a70', '3b4a80', '4e5a90', '646b9e',      // 0-7   night → twilight
    '7d7aaa', '9988b2', 'b597b6', 'd1a3ae', 'e7b3a3', 'f4c69f', 'fbdab0', 'fff1d6',      // 8-15  lavender → apricot → cream
    '0c1b27', '122938', '1a394a', '245062', '32677a', '4b808e', '70a0a8',                // 16-22 lake teal
    'ffe08a',                                                                            // 23    firefly gold
    '24232d', '3a3846', '55525f', '7a7380', 'a69895',                                    // 24-28 granite / charcoal
    '121833', '1b2550', '283769', '3a4d86', '5568a2',                                    // 29-33 navy knit
    'e8e3ec', 'bcb6cf',                                                                  // 34-35 white tee
    '4a2b2a', '7b4a40', 'a96f5b', 'cd8f72', 'e8ae8b', 'f8d0ad',                          // 36-41 skin
    '1c120f', '31201a', '4b3124', '6c4930',                                              // 42-45 hair
    'e58aa2', '3e6b56',                                                                  // 46-47 lotus, pad
  ];
  const PAL = PAL_HEX.map(hx);
  const LUT_ENV = new Uint8Array(32768), LUT_ALL = new Uint8Array(32768);
  const ENVSET = [], ALLSET = [];
  for (let k = 0; k < PAL.length; k++) {
    if (k === 23) continue;                               // gold only where a firefly puts it
    ALLSET.push(k);
    if (!(k >= 29 && k <= 47)) ENVSET.push(k);            // no knit, skin, hair or lotus in the landscape
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
  const DITH = 11;

  /* ================================================================ buffers */
  const BG0 = new Float32Array(HY * W * 3);   // the still sky and hills, above the lake
  const BGF = new Float32Array(HY * W * 3);   // ...this frame: + mist + stars
  const MD = new Float32Array(NP);            // this frame's mist density
  const C = new Float32Array(NP * 3);         // this frame's colour
  const ZONE = new Uint8Array(NP);            // 0 landscape palette, 1 full palette (him)
  const FORCE = new Uint8Array(NP);           // palette index + 1, drawn as is
  const OUT = new Uint8Array(NP);             // the quantised frame
  const LR = new Float32Array(NP), LG = new Float32Array(NP), LB = new Float32Array(NP); // the soft light layer
  const BLR = new Float32Array(NP), BLG = new Float32Array(NP), BLB = new Float32Array(NP); // static dawn bloom
  const LOUT = new Uint8Array(NP * 3);        // light layer, 8 bit
  const OCC = new Float32Array(NP), OCCT = new Float32Array(NP);
  const LANDM = new Uint8Array(NP);           // how much of the light behind him he hides (soft-edged)

  // the near layer (rock + body) lives in a box around him
  const NX0 = 76, NY0 = 214, NW = 214, NH = 174, NN = NW * NH;
  const NC = new Float32Array(NN * 3), NZ = new Float32Array(NN), NRIM = new Float32Array(NN), NFIG = new Uint8Array(NN);
  function layer() { return { c: new Float32Array(NN * 3), z: new Float32Array(NN), rim: new Float32Array(NN), fig: new Uint8Array(NN) }; }
  const LA = layer();   // rock, legs, feet — never move
  const LB_ = layer();  // torso, arms, hands, neck, tee — warped by the breath

  /* ================================================================ materials */
  const RAMPOF = (ids) => ids.map((k) => PAL[k]);
  const R_NAVY = RAMPOF([29, 30, 31, 32, 33]);
  const R_SKIN = RAMPOF([36, 37, 38, 39, 40, 41]);
  const R_HAIR = RAMPOF([42, 43, 44, 45]);
  const R_TEE = RAMPOF([35, 34, 15]);
  const R_TROU = RAMPOF([24, 25, 26, 27, 28, 35]);
  const R_ROCK = RAMPOF([16, 24, 25, 26, 27, 28]);
  function ramp(R, l) {
    const u = clamp(l, 0, 0.9999) * (R.length - 1), k = fl(u), f = u - k;
    return [lerp(R[k][0], R[k + 1][0], f), lerp(R[k][1], R[k + 1][1], f), lerp(R[k][2], R[k + 1][2], f)];
  }
  const mix3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
  const LK = norm3(0.62, -0.42, 0.66);       // key: the dawn, low on his left (our right)
  const lam = (nx, ny, nz) => Math.max(0, nx * LK[0] + ny * LK[1] + nz * LK[2]);
  const RIMWARM = [252, 192, 150], RIMCOOL = [168, 152, 206];

  function lput(L, x, y, z, rgb, fig) {
    const lx = x - NX0, ly = y - NY0;
    if (lx < 0 || ly < 0 || lx >= NW || ly >= NH) return;
    const i = ly * NW + lx;
    if (z <= L.z[i]) return;
    L.z[i] = z; L.c[i * 3] = rgb[0]; L.c[i * 3 + 1] = rgb[1]; L.c[i * 3 + 2] = rgb[2]; L.fig[i] = fig ? 1 : 0;
  }

  /* ================================================================ sky */
  const SKY_STOPS = [
    [0.00, 10, 14, 40], [0.22, 18, 30, 72], [0.42, 34, 54, 108], [0.58, 70, 84, 140], [0.70, 122, 110, 166],
    [0.80, 186, 138, 168], [0.89, 234, 168, 156], [0.96, 250, 198, 160], [1.00, 254, 220, 178]];
  const glowX = (x) => Math.exp(-Math.pow((x - 262) / 112, 2));
  const GLOWX = new Float32Array(W); for (let x = 0; x < W; x++) GLOWX[x] = glowX(x);
  function skyRGB(x, y, o) {
    const u = clamp(y / HY, 0, 1);
    let k = 0;
    while (k < SKY_STOPS.length - 2 && u > SKY_STOPS[k + 1][0]) k++;
    const a = SKY_STOPS[k], b = SKY_STOPS[k + 1], f = (u - a[0]) / (b[0] - a[0]);
    let r = lerp(a[1], b[1], f), g = lerp(a[2], b[2], f), bb = lerp(a[3], b[3], f);
    const gl = glowX(x) * sstep(0.45, 1, u);
    r += 34 * gl; g += 20 * gl; bb -= 6 * gl;
    const cl = sstep(190, 0, x) * sstep(0.35, 1, u);
    r -= 28 * cl; g -= 14 * cl; bb += 2 * cl;
    const tl = sstep(0.6, 0.1, u) * sstep(260, 0, x);
    r -= 3 * tl; g += 7 * tl; bb += 5 * tl;
    o[0] = r; o[1] = g; o[2] = bb;
  }
  function cloudAt(x, y) {
    let d = 0;
    const c1 = 174 + 5 * Math.sin(x / 63) + (x - 200) * 0.035;
    d += Math.exp(-Math.pow((y - c1) / 3.0, 2)) * sstep(0.44, 0.72, fbm(x / 36, y / 5, 801, 4)) * sstep(96, 180, x);
    const c2 = 194 - (x - 260) * 0.05 + 2 * Math.sin(x / 31);
    d += Math.exp(-Math.pow((y - c2) / 2.3, 2)) * sstep(0.44, 0.7, fbm(x / 24, y / 4, 802, 4)) * sstep(180, 236, x);
    const c3 = 146 + 4 * Math.sin(x / 47 + 2);
    d += 0.75 * Math.exp(-Math.pow((y - c3) / 2.5, 2)) * sstep(0.5, 0.74, fbm(x / 30, y / 5, 803, 4)) * sstep(330, 230, x) * sstep(150, 220, x);
    const c4 = 206 + 3 * Math.sin(x / 40);
    d += 0.6 * Math.exp(-Math.pow((y - c4) / 2.0, 2)) * sstep(0.5, 0.75, fbm(x / 22, y / 4, 804, 4)) * sstep(120, 30, x);
    return clamp(d, 0, 1);
  }
  const MOON = [296, 92, 6.6];
  function ridgeFar(x) { return 233 + 18 * (fbm(x / 52, 0.5, 501, 4) - 0.5) + 5 * Math.sin(x / 41 + 1) - 13 * Math.exp(-Math.pow((x - 64) / 66, 2)) + 15 * Math.exp(-Math.pow((x - 262) / 36, 2)); }
  function ridgeMid(x) { return 255 + 13 * (fbm(x / 36, 2.5, 502, 4) - 0.5) - 8 * Math.exp(-Math.pow((x - 116) / 48, 2)) + 11 * Math.exp(-Math.pow((x - 266) / 32, 2)) - 4 * Math.exp(-Math.pow((x - 336) / 26, 2)); }
  const PINES = [];
  function nearLandAt(x, y) {
    // the near shore: a dark wooded spit on the left, a low point on the right
    let base = 1e9;
    if (x < 176) base = 263 + 19 * sstep(30, 172, x) - 3 * fbm(x / 9, 0.3, 503, 3);
    else if (x > 296) base = 279 - 6 * sstep(300, 338, x) - 2 * fbm(x / 8, 0.7, 504, 3);
    if (y >= base) return 1;
    for (const p of PINES) {
      const dd = y - p.top;
      if (dd < 0 || dd > p.h) continue;
      const tier = (dd % p.t) / p.t;
      const w = 0.5 + dd * p.s * (0.62 + 0.38 * tier);
      if (Math.abs(x + 0.5 - p.x) < w) return 1;
    }
    return 0;
  }
  function buildSky() {
    const R = mulberry32(7301);
    for (let k = 0; k < 26; k++) {
      const x = 4 + R() * 168, base = 263 + 19 * sstep(30, 172, x);
      const h = 9 + R() * 15 * (1 - 0.5 * sstep(90, 170, x));
      PINES.push({ x, top: base - h, h, s: 0.32 + R() * 0.08, t: 3 + R() * 1.5 });
    }
    for (const x of [314, 324, 333, 350]) { const h = 7 + ih(x, 1, 5) * 9; PINES.push({ x, top: 279 - 6 * sstep(300, 338, x) - h, h, s: 0.33, t: 3.2 }); }
    const o = [0, 0, 0];
    for (let y = 0; y < HY; y++) for (let x = 0; x < W; x++) {
      const j = (y * W + x) * 3;
      skyRGB(x, y, o);
      let r = o[0], g = o[1], b = o[2];
      // thin cirrus underlit by the coming sun
      const cd = cloudAt(x, y);
      if (cd > 0.01) {
        const gl = glowX(x);
        const cr = lerp(150, 242, gl), cg = lerp(124, 174, gl), cb = lerp(166, 168, gl);
        const lit = cloudAt(x, y + 1.5) < cd ? 1.06 : 0.84;
        r = lerp(r, cr * lit, cd * 0.8); g = lerp(g, cg * lit, cd * 0.8); b = lerp(b, cb * lit, cd * 0.8);
      }
      // the moon: a thin waning crescent, lit toward the sun below the hills
      const dm = Math.hypot(x + 0.5 - MOON[0], y + 0.5 - MOON[1]);
      if (dm < MOON[2]) {
        const ds = Math.hypot(x + 0.5 - (MOON[0] - 2.7), y + 0.5 - (MOON[1] - 2.3));
        if (ds > MOON[2] * 0.97) { const e = dm > MOON[2] - 1.1 ? 1 : 0.92; r = 255 * e; g = 240 * e; b = 214 * e; }
        else { r += 9; g += 9; b += 13; }
      }
      // far range: hazy lavender
      const rf = ridgeFar(x);
      if (y >= rf) {
        const gl = glowX(x);
        let hr = lerp(r, 128, 0.5), hg = lerp(g, 112, 0.5), hb = lerp(b, 158, 0.5);
        const hz = sstep(rf, HY, y) * 0.42;
        hr = lerp(hr, lerp(196, 240, gl), hz); hg = lerp(hg, lerp(166, 196, gl), hz); hb = lerp(hb, lerp(190, 186, gl), hz);
        { const rr = Math.exp(-(y - rf) / 1.2) * (1 - 0.8 * gl); hr += 8 * rr; hg += 6 * rr; hb += 7 * rr; }
        const tx = fbm(x / 7, y / 3, 505, 3) - 0.5; hr += tx * 6; hg += tx * 6; hb += tx * 7;
        r = hr; g = hg; b = hb;
      }
      // middle range: dusky violet, rimmed where it faces the dawn
      const rm = ridgeMid(x);
      if (y >= rm) {
        const gl = glowX(x);
        let mr = 74, mg = 72, mb = 116;
        const slope = ridgeMid(x + 2) - ridgeMid(x - 2);
        const face = clamp(-slope * 0.25, -1, 1);
        mr += face * 10 * (0.4 + gl); mg += face * 7 * (0.4 + gl); mb += face * 5;
        const hz = sstep(rm, HY, y) * 0.34;
        mr = lerp(mr, lerp(176, 232, gl), hz); mg = lerp(mg, lerp(150, 186, gl), hz); mb = lerp(mb, lerp(184, 180, gl), hz);
        { const rr = Math.exp(-(y - rm) / 1.6); mr += (30 * gl + 6) * rr; mg += (18 * gl + 4) * rr; mb += (8 * gl + 6) * rr; }
        const tx = fbm(x / 6, y / 2.5, 506, 3) - 0.5; mr += tx * 8; mg += tx * 7; mb += tx * 9;
        r = mr; g = mg; b = mb;
      }
      // the near shore and its pines: deep teal-indigo, almost a silhouette
      if (nearLandAt(x, y)) {
        let nr = 26, ng = 40, nb = 60;
        const top = !nearLandAt(x, y - 1);
        const gl = glowX(x);
        if (top) { nr += 22 + 50 * gl; ng += 18 + 30 * gl; nb += 22 + 10 * gl; }
        const hz = sstep(HY - 22, HY, y) * 0.3;
        nr = lerp(nr, 150, hz); ng = lerp(ng, 132, hz); nb = lerp(nb, 170, hz);
        r = nr; g = ng; b = nb;
      }
      BG0[j] = r; BG0[j + 1] = g; BG0[j + 2] = b;
      LANDM[y * W + x] = nearLandAt(x, y);
    }
    // a soft bloom of the brightest sky, for the light layer (and its reflection on the lake)
    const bl = new Float32Array(NP * 3);
    for (let y = 0; y < HY; y++) for (let x = 0; x < W; x++) {
      const j = (y * W + x) * 3, i = y * W + x;
      const lum = 0.3 * BG0[j] + 0.55 * BG0[j + 1] + 0.15 * BG0[j + 2];
      const k = sstep(150, 220, lum);
      bl[i * 3] = BG0[j] * k; bl[i * 3 + 1] = BG0[j + 1] * k; bl[i * 3 + 2] = BG0[j + 2] * k;
    }
    blur3(bl, W, HY, 9); blur3(bl, W, HY, 9);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let sy = y, k = 0.24;
      if (y >= HY) { sy = 2 * HY - 1 - y; k = 0.15 * (1 - sstep(HY, HY + 70, y)); }
      if (sy < 0) continue;
      const s = (sy * W + x) * 3;
      BLR[i] = bl[s] * k; BLG[i] = bl[s + 1] * k; BLB[i] = bl[s + 2] * k;
    }
  }
  function blur3(buf, w, h, r) {
    const tmp = new Float32Array(buf.length);
    for (let y = 0; y < h; y++) {
      for (let c = 0; c < 3; c++) {
        let acc = 0;
        for (let k = -r; k <= r; k++) acc += buf[(y * w + clamp(k, 0, w - 1)) * 3 + c];
        for (let x = 0; x < w; x++) {
          tmp[(y * w + x) * 3 + c] = acc / (2 * r + 1);
          acc += buf[(y * w + clamp(x + r + 1, 0, w - 1)) * 3 + c] - buf[(y * w + clamp(x - r, 0, w - 1)) * 3 + c];
        }
      }
    }
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let acc = 0;
        for (let k = -r; k <= r; k++) acc += tmp[(clamp(k, 0, h - 1) * w + x) * 3 + c];
        for (let y = 0; y < h; y++) {
          buf[(y * w + x) * 3 + c] = acc / (2 * r + 1);
          acc += tmp[(clamp(y + r + 1, 0, h - 1) * w + x) * 3 + c] - tmp[(clamp(y - r, 0, h - 1) * w + x) * 3 + c];
        }
      }
    }
  }

  /* ================================================================ mist (two wrapping banks drifting right) */
  const MY0 = 236, MY1 = 304, MH = MY1 - MY0;
  const PA = 120, PB = 90;
  const MA = new Float32Array(PA * MH), MB = new Float32Array(PB * MH);
  const BANDA = new Float32Array(MH), BANDB = new Float32Array(MH);
  function buildMist() {
    for (let y = 0; y < MH; y++) {
      const yy = y + MY0;
      for (let x = 0; x < PA; x++) MA[y * PA + x] = sstep(0.36, 0.74, fbmP(x / 30, yy / 6.5, 901, 4, 4));
      for (let x = 0; x < PB; x++) MB[y * PB + x] = sstep(0.42, 0.8, fbmP(x / 22.5, yy / 4.5, 902, 4, 4));
      BANDA[y] = Math.exp(-Math.pow((yy - 280) / 7.5, 2)) * 0.72;
      BANDB[y] = Math.exp(-Math.pow((yy - 258) / 5.0, 2)) * 0.5;
    }
  }
  function mistAt(x, y, offA, offB) {
    const ly = y - MY0;
    if (ly < 0 || ly >= MH) return 0;
    let xa = mod(x - offA, PA); const ia = fl(xa), fa = xa - ia;
    let xb = mod(x - offB, PB); const ib = fl(xb), fb = xb - ib;
    const a = lerp(MA[ly * PA + ia], MA[ly * PA + (ia + 1) % PA], fa);
    const b = lerp(MB[ly * PB + ib], MB[ly * PB + (ib + 1) % PB], fb);
    return BANDA[ly] * a + BANDB[ly] * b;
  }

  /* ================================================================ stars */
  const STARS = [];
  function buildStars() {
    const R = mulberry32(9107);
    while (STARS.length < 86) {
      const x = fl(R() * W), y = fl(3 + Math.pow(R(), 1.45) * 196);
      if (Math.hypot(x - MOON[0], y - MOON[1]) < 15) { R(); continue; }
      if (cloudAt(x, y) > 0.05) { R(); continue; }
      const dark = 1 - sstep(70, 205, y);
      const b = (0.3 + 0.7 * Math.pow(R(), 1.6)) * dark;
      const n = 1 + fl(R() * 4), ph = R() * TAU, warm = R();
      const big = b > 0.62 && R() < 0.5;
      STARS.push({ x, y, b, n, ph, big, col: warm < 0.25 ? [255, 226, 196] : warm > 0.8 ? [206, 220, 255] : [246, 242, 236] });
    }
  }

  /* ================================================================ the rock */
  function paintRock(L) {
    for (let y = 346; y < 390; y++) for (let x = NX0; x < NX0 + NW; x++) {
      const px = x + 0.5, py = y + 0.5, X = px - CX;
      const rx = (X < 0 ? 93 : 98) + 5 * (fbm(y / 4, X < 0 ? 0.5 : 7.5, 611, 3) - 0.5);
      const e = 1 - (X / rx) * (X / rx);
      if (e <= 0) continue;
      const se = Math.sqrt(e);
      const top = 364 - 6.5 * se + 2.2 * (fbm(x / 9, 0.2, 612, 3) - 0.5);
      const fe = 364 + 4 * se + 1.2 * (vn2(x / 7, 1.1, 617) - 0.5);
      const bot = WL + 0.6 + 1.4 * (vn2(x / 6, 3.3, 613) - 0.5);
      if (py < top || py > bot) continue;
      let hw = rx;
      if (py > fe) hw = rx - 0.7 * (py - fe) - 7 * (1 - Math.sqrt(Math.max(0, 1 - Math.pow((py - fe) / 19, 2)))) + 3 * (vn2(y / 3, X < 0 ? 2 : 9, 618) - 0.5);
      if (Math.abs(X) > hw) continue;
      const n = fbm(x / 6, y / 2.5, 614, 3) - 0.5;
      let l;
      if (py < fe) {
        l = 0.66 + 0.18 * X / rx + 0.14 * n;
        l -= 0.32 * Math.exp(-Math.pow(X / 52, 2)) * sstep(top + 1, fe, py);     // his shadow on the stone
        if (py - top < 1) l += 0.08;
      } else {
        // the front face: broken into a few vertical facets, darker toward the water
        const facet = Math.sin(px / 7.5 + 2.4 * fbm(px / 20, 0.3, 619, 2) * 3);
        l = 0.46 + 0.14 * X / rx - 0.2 * (py - fe) / 18 + 0.14 * n + (facet > 0.35 ? 0.08 : facet < -0.45 ? -0.08 : 0);
        if (py - fe < 1.2) l += 0.16;                                             // the lip catches the dawn
        if (bot - py < 2.2) l *= 0.66;                                            // wet at the water
        for (const xc of [118, 151, 214, 247]) if (Math.abs(px - (xc + 1.6 * Math.sin(py / 3 + xc))) < 0.55 && py > fe + 2) l -= 0.16;
      }
      const h = ih(x, y, 615);
      if (h < 0.05) l -= 0.1; else if (h > 0.965) l += 0.1;
      lput(L, x, y, 1, ramp(R_ROCK, l), 0);
      if (py < fe) { const i = (y - NY0) * NW + (x - NX0); L.rim[i] = 0.55 * Math.exp(-Math.pow(X / 64, 2)); }
    }
    // two small stones breaking the water
    for (const [sx, sy, sr] of [[282.5, 382.5, 6.2], [86.5, 383.5, 4.4]]) {
      for (let y = fl(sy - sr); y <= sy + 1; y++) for (let x = fl(sx - sr - 1); x <= sx + sr + 1; x++) {
        const u = (x + 0.5 - sx) / (sr * 1.3), v = (y + 0.5 - sy) / sr;
        if (u * u + v * v > 1 || y + 0.5 > sy + 1) continue;
        const l = 0.5 + 0.28 * u - 0.22 * v + 0.1 * (ih(x, y, 620) - 0.5) - (y + 0.5 > sy - 0.5 ? 0.15 : 0);
        lput(L, x, y, 1, ramp(R_ROCK, l), 0);
      }
    }
  }

  /* ================================================================ the body */
  function capsule(px, py, ax, ay, bx, by) {
    const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy;
    const u = clamp(((px - ax) * vx + (py - ay) * vy) / l2, 0, 1);
    const qx = ax + vx * u, qy = ay + vy * u;
    CAP_U = u; CAP_DX = px - qx; CAP_DY = py - qy;
    return Math.hypot(px - qx, py - qy);
  }
  let CAP_U = 0, CAP_DX = 0, CAP_DY = 0;
  function cylN(r) { const nx = CAP_DX / r, ny = CAP_DY / r; return [nx, ny, Math.sqrt(Math.max(0.04, 1 - nx * nx - ny * ny))]; }

  function paintLegs(L) {
    for (let y = 334; y < 368; y++) for (let x = 104; x < 258; x++) {
      const px = x + 0.5, py = y + 0.5, X = px - CX;
      if (py > 366.5) continue;
      // easy pose seen from the front: lap and thighs out to the knees, the left shin running down to the
      // right foot, the right shin crossing in front of it down to the left foot; each part its own depth
      let z = 0, rgb = null;
      let inMass = false;
      const ex = X / 40, ey = (py - 356) / 10;
      if (ex * ex + ey * ey < 1) inMass = true;
      for (const s of [-1, 1]) if (capsule(px, py, CX + s * 14, 350, CX + s * 47, 352) < 8.0) inMass = true;
      if (inMass) {
        const nx = X / 60, ny = (py - 356) / 12;
        let l = 0.3 + 0.5 * lam(nx, ny - 0.3, Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny)));
        for (const s of [-1, 1]) {                       // drag folds from the lap toward each knee
          const kx = CX + s * 51, r = Math.hypot(py - 353, px - kx), a = Math.atan2(py - 353, (px - kx) * s);
          if (r > 9 && r < 30 && Math.abs(Math.sin(a * 4 + r * 0.22 + s)) < 0.1) l -= 0.08;
        }
        l -= 0.16 * Math.exp(-X * X / 500) * sstep(352, 344, py);
        rgb = ramp(R_TROU, l); z = 2.2;
      }
      for (const s of [-1, 1]) {
        const kx = CX + s * 51, dk = Math.hypot(px - kx, py - 353.5);
        if (dk < 8.5) {
          const nx = (px - kx) / 8.5, ny = (py - 353.5) / 8.5;
          rgb = ramp(R_TROU, 0.26 + 0.56 * lam(nx, ny, Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny)))); z = 2.3;
        }
      }
      let d = capsule(px, py, 132, 357, 221, 364.6);
      if (d < 4.5) { const n = cylN(4.5); rgb = ramp(R_TROU, 0.22 + 0.5 * lam(n[0] * 0.7, n[1], n[2])); z = 2.6; }
      d = capsule(px, py, 228, 357, 143, 364.6);
      if (d < 4.8) { const n = cylN(4.8); rgb = ramp(R_TROU, 0.3 + 0.52 * lam(n[0] * 0.7, n[1], n[2])); z = 3.0; }
      // the left foot under the left knee: sole up, toes out
      const fx = (px - 136.5) / 6.6, fy = (py - 364) / 2.7;
      if (fx * fx + fy * fy < 1) {
        let l = 0.5 + 0.16 * fx - (py > 365.5 ? 0.12 : 0);
        if (px < 133 && ((x & 1) === 0)) l -= 0.12;
        rgb = ramp(R_SKIN, l); z = 3.4;
      }
      // the right foot's toes beyond the left shin
      const tx = (px - 226.5) / 4.6, ty = (py - 364.6) / 2.1;
      if (tx * tx + ty * ty < 1 && z < 2.7) { let l = 0.56 + 0.12 * tx; if (px > 228 && ((x & 1) === 1)) l -= 0.1; rgb = ramp(R_SKIN, l); z = 2.7; }
      if (z) lput(L, x, y, z, rgb, 1);
    }
  }

  const TORSO = [[282, 6.5], [284, 13], [286, 18], [288, 21.5], [291, 24], [295, 25.4], [302, 25.8], [314, 24.4], [326, 23.4], [338, 24.2], [348, 25.5]];
  function torsoHW(y) {
    if (y < TORSO[0][0] || y > TORSO[TORSO.length - 1][0]) return -1;
    for (let k = 0; k < TORSO.length - 1; k++) if (y <= TORSO[k + 1][0]) return lerp(TORSO[k][1], TORSO[k + 1][1], (y - TORSO[k][0]) / (TORSO[k + 1][0] - TORSO[k][0]));
    return -1;
  }
  const vneck = (py) => 8.8 * clamp((316 - py) / 31, 0, 1);
  const BUTTONS = [321, 330, 339];
  function paintUpper(L) {
    for (let y = 262; y < 352; y++) for (let x = 108; x < 254; x++) {
      const px = x + 0.5, py = y + 0.5, X = px - CX;
      // the neck
      if (Math.abs(X) < 5.8 && py > 268 && py < 290) {
        const l = 0.36 + 0.22 * X / 5.6 - (py < 282 ? 0.13 : 0) - (Math.abs(X) > 4.6 ? 0.06 : 0);
        lput(L, x, y, 1.0, ramp(R_SKIN, l), 1);
      }
      // torso + shoulders, sloping
      const hw = torsoHW(py);
      let tz = 0, tn = null;
      if (hw > 0 && Math.abs(X) < hw) {
        const nx = clamp(X / (hw + 1), -1, 1), ny = py < 296 ? -0.75 * sstep(296, 282, py) : 0.04;
        tn = [nx, ny, Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny))]; tz = 1.2;
      }
      for (const sx of [156, 204]) {
        const ds = Math.hypot(px - sx, py - 298.5);
        if (ds < 7.4) { const nx = (px - sx) / 7.4, ny = (py - 298.5) / 7.4; tn = [nx, ny, Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny))]; tz = 1.25; }
      }
      if (tz) {
        let l = 0.1 + 0.74 * lam(tn[0], tn[1], tn[2]);
        if (Math.abs((py - 309) - (20 - Math.abs(X)) * 1.1) < 0.6 && Math.abs(X) > 15 && Math.abs(X) < 20.5) l -= 0.1;   // drape from the armpit
        let rgb = ramp(R_NAVY, l);
        let z = tz;
        const vh = vneck(py);
        if (py > 283 && py < 316 && Math.abs(X) < vh) {
          // the white tee in the V; a ribbed crew neck round the base of the throat
          const cx2 = X / 7.6, cy2 = (py - 284.5) / 4.4;
          if (cx2 * cx2 + cy2 * cy2 < 1) rgb = ramp(R_TEE, 0.3 + 0.2 * X / 7);
          else rgb = ramp(R_TEE, 0.5 + 0.26 * X / 8 - 0.16 * sstep(298, 315, py));
          z = 1.3;
        } else if (py > 282 && py < 317 && Math.abs(X) < vh + 2.4) {
          rgb = ramp(R_NAVY, l + 0.15 - ((y & 1) ? 0.05 : 0)); z = 1.32;     // the button bands
        } else if (py >= 316 && py < 348 && Math.abs(X - 0.5) < 2.1) {
          rgb = ramp(R_NAVY, l + 0.12 - ((y & 1) ? 0.04 : 0)); z = 1.32;
          if (Math.abs(X - 1.7) < 0.5) rgb = ramp(R_NAVY, l - 0.08);
        }
        lput(L, x, y, z, rgb, 1);
      }
      // arms: upper arms hang a little forward and out; forearms run down to the hands on the knees
      for (const s of [-1, 1]) {
        const ax = CX + s * 24.5, ex = CX + s * 33, hx = CX + s * 45.5;
        let d = capsule(px, py, ax, 298, ex, 326);
        if (d < 6.2) {
          const n = cylN(6.2);
          let l = 0.1 + 0.74 * lam(n[0], n[1], n[2]);
          if (CAP_U > 0.35 && CAP_U < 0.7 && Math.abs(CAP_DY - (CAP_U - 0.5) * 6) < 0.5 && s * CAP_DX < 0) l -= 0.09;   // sleeve fold
          lput(L, x, y, 2.5, ramp(R_NAVY, l), 1);
        }
        d = capsule(px, py, ex, 326, hx, 341.5);
        if (d < 5.4) {
          const n = cylN(5.4);
          let l = 0.12 + 0.74 * lam(n[0], n[1], n[2]);
          if (CAP_U > 0.78) l += 0.1 - ((((px + py) | 0) & 1) ? 0.07 : 0);     // ribbed cuff
          if (CAP_U < 0.15 && s * CAP_DX < -1.5) l -= 0.12;                   // inside of the elbow
          lput(L, x, y, 4.5, ramp(R_NAVY, l), 1);
        }
        // the open hand, palm up on the knee; thumb and finger lightly touching
        d = capsule(px, py, CX + s * 46, 343, CX + s * 55.5, 346.3);
        if (d < 3.5) {
          const n = cylN(3.5);
          let l = 0.4 + 0.48 * lam(n[0], n[1] - 0.5, n[2]);
          if (CAP_U > 0.62) l += 0.06;
          if (Math.abs(CAP_U - 0.45) < 0.08 && CAP_DY < 1) l -= 0.12;          // palm crease
          if (CAP_DY > 2.3) l -= 0.15;
          lput(L, x, y, 5, ramp(R_SKIN, l), 1);
        }
        d = capsule(px, py, CX + s * 48.5, 340.6, CX + s * 53, 339.6);
        if (d < 1.4) lput(L, x, y, 5.2, ramp(R_SKIN, 0.55 + 0.22 * s), 1);
      }
    }
    // buttons: three small brown buttons on the band
    for (const by of BUTTONS) {
      const bx = 181;
      const P3 = [[0, -1, 44], [-1, 0, 44], [0, 0, 45], [1, 0, 45], [0, 1, 43], [1, -1, 40]];
      for (const p of P3) lput(L, bx + p[0], by + p[1], 1.4, PAL[p[2]], 1);
      lput(L, bx - 1, by + 1, 1.39, PAL[29], 1);
    }
  }

  // outline, rim, contact shading — pixel-art finishing on the rest pose
  function finishLayers() {
    const zAt = (lx, ly) => {
      if (lx < 0 || ly < 0 || lx >= NW || ly >= NH) return 0;
      const i = ly * NW + lx; return Math.max(LA.z[i], LB_.z[i]);
    };
    for (const L of [LA, LB_]) {
      const out = new Float32Array(L.c);
      for (let ly = 0; ly < NH; ly++) for (let lx = 0; lx < NW; lx++) {
        const i = ly * NW + lx, z = L.z[i];
        if (!z) continue;
        const j = i * 3;
        let c = [L.c[j], L.c[j + 1], L.c[j + 2]];
        const up = zAt(lx, ly - 1), dn = zAt(lx, ly + 1), lf = zAt(lx - 1, ly), rt = zAt(lx + 1, ly);
        const fig = L.fig[i];
        if (fig) {
          if (!rt) c = mix3(c, RIMWARM, 0.5);
          else if (!up) c = mix3(c, RIMCOOL, 0.3);
          if (!lf) c = [c[0] * 0.7, c[1] * 0.7, c[2] * 0.8];
          if (!dn && z > 1.5) c = [c[0] * 0.75, c[1] * 0.75, c[2] * 0.8];
          // something in front of me casts a little contact shadow
          if ((up > z + 0.15 && up < 9) || (lf > z + 0.15) || (rt > z + 0.15)) c = [c[0] * 0.64, c[1] * 0.64, c[2] * 0.72];
          // aura rim weight: silhouette pixels open to the sky
          let open = 0;
          for (const [ox, oy, w] of [[0, -1, 1], [-1, 0, 0.9], [1, 0, 0.9], [-1, -1, 0.7], [1, -1, 0.7], [0, -2, 0.45], [-2, 0, 0.4], [2, 0, 0.4]]) if (!zAt(lx + ox, ly + oy)) open = Math.max(open, w);
          L.rim[i] = Math.max(L.rim[i], open);
        } else {
          if (!up) c = mix3(c, RIMCOOL, 0.15);
        }
        out[j] = c[0]; out[j + 1] = c[1]; out[j + 2] = c[2];
      }
      L.c.set(out);
    }
  }

  /* ================================================================ the head (redrawn every frame) */
  const FCY = 264;                 // face centre at rest
  function faceHW(Y) {
    if (Y < -18 || Y > 15.6) return -1;
    if (Y < 0) return 12.5 * Math.sqrt(Math.max(0, 1 - Math.pow(Y / 18.5, 2)));
    const u = Y / 15.6;
    return 12.5 * (1 - 0.36 * Math.pow(u, 2.1)) * Math.sqrt(Math.max(0, 1 - Math.pow(u, 7)));
  }
  const hairline = (X) => -12.6 + 0.03 * X * X;
  const CURLS = [];
  function buildCurls() {
    const R = mulberry32(5150);
    const CY = FCY - 16, RX = 17.2, RY = 14.6;
    const capRX = (y) => (y > CY ? lerp(RX, 13.6, clamp((y - CY) / 12, 0, 1)) : RX);
    const ok = (x, y, r) => {
      const X = x - CX, Y = y - FCY;
      if (Y + r * 0.5 > hairline(X) && Math.abs(X) < faceHW(Y) + 1.4) return false;   // forehead and cheeks stay clear
      if (Y > -3.5) return false;                                                        // above the ears only
      return true;
    };
    const push = (x, y, r, rim) => {
      if (!ok(x, y, r)) return;
      for (const c of CURLS) if (Math.hypot(c.x - x, c.y - y) < (c.r + r) * 0.62) return;
      const ex = (x - CX) / capRX(y), ey = (y - CY) / RY, edge = Math.sqrt(ex * ex + ey * ey);
      CURLS.push({ x, y, r, ph: R() * TAU, ph2: R() * TAU, sp: R(), amp: 0.16 + (rim ? 0.42 : 0.1) * (y < 252 ? 1 : 0.5) + 0.0 * edge });
    };
    // a scalloped rim of curls around the dome, then the inside filled
    for (let a = -Math.PI * 1.02; a <= 0.02; a += 0.2) {
      const y = CY + Math.sin(a) * (RY - 1.2), x = CX + Math.cos(a) * (capRX(y) - 1.2);
      push(x + (R() - 0.5) * 0.8, y + (R() - 0.5) * 0.8, 2.7 + R() * 0.6, true);
    }
    for (const s of [-1, 1]) for (let y = CY + 1; y <= FCY - 4; y += 3.0) {
      push(CX + s * (capRX(y) - 1.6) + (R() - 0.5) * 0.6, y, 2.2 + R() * 0.4, true);
    }
    let row = 0;
    for (let gy = CY - RY + 3; gy <= FCY - 4; gy += 3.1, row++) {
      for (let gx = CX - RX + (row & 1) * 1.8; gx <= CX + RX; gx += 3.5) {
        const x = gx + (R() - 0.5) * 1.6, y = gy + (R() - 0.5) * 1.4;
        const ex = (x - CX) / capRX(y), ey = (y - CY) / RY;
        if (ex * ex + ey * ey > 0.92) continue;
        push(x, y, 2.4 + R() * 0.8, false);
      }
    }
    // loose curls at the hairline
    for (const [x, y, r] of [[173.2, FCY - 14.2, 2.3], [178.8, FCY - 14.8, 2.4], [184.8, FCY - 14.4, 2.3], [168.6, FCY - 12.6, 2.1], [191.2, FCY - 12.8, 2.1]]) CURLS.push({ x, y, r, ph: x, ph2: y, sp: (x * 0.13) % 1, amp: 0.14 });
    CURLS.sort((a, b) => a.y - b.y);
  }
  const HX0 = 150, HY0 = 220, HW = 60, HH = 64, HN = HW * HH;
  const HT = new Int16Array(HN);          // 0 empty, 1 skin, 2 ear, 3 frame, 4 hair, 5 lens, 6 brow/lid
  const HC = new Float32Array(HN * 3);
  const HCURL = new Int16Array(HN);
  const HRIM = new Float32Array(HN), HTMP = new Float32Array(HN * 3), CPOS = new Float32Array(512);
  const LH = norm3(0.5, -0.66, 0.56);
  function drawHead(t, hdy) {
    HT.fill(0); HCURL.fill(-1);
    const fcy = FCY - hdy;
    const set = (x, y, type, rgb) => {
      const lx = x - HX0, ly = y - HY0;
      if (lx < 0 || ly < 0 || lx >= HW || ly >= HH) return;
      const i = ly * HW + lx; HT[i] = type; HC[i * 3] = rgb[0]; HC[i * 3 + 1] = rgb[1]; HC[i * 3 + 2] = rgb[2];
    };
    // ears
    for (const s of [-1, 1]) {
      const ex = CX + s * 13.1, ey = fcy + 1;
      for (let y = fl(ey - 5); y <= ey + 5; y++) for (let x = fl(ex - 3); x <= ex + 3; x++) {
        const u = (x + 0.5 - ex) / 2.1, v = (y + 0.5 - ey) / 4.0;
        if (u * u + v * v > 1) continue;
        let l = s > 0 ? 0.62 : 0.34;
        if (Math.abs(u) < 0.5 && Math.abs(v) < 0.45) l -= 0.16;
        if (v > 0.6) l -= 0.06;
        set(x, y, 2, ramp(R_SKIN, l));
      }
    }
    // the face
    for (let y = fl(fcy - 18); y <= fcy + 16; y++) for (let x = 165; x < 195; x++) {
      const X = x + 0.5 - CX, Y = y + 0.5 - fcy, hw = faceHW(Y);
      if (hw < 0 || Math.abs(X) > hw) continue;
      const fx = x - CX, fy = y - fcy;          // integer pixel offsets: fx 0 is just right of centre
      const nx = clamp(X / (hw + 1.4), -1, 1) * 0.9, ny = clamp(Y / 18, -1, 1) * 0.5;
      let l = 0.36 + 0.58 * lam(nx, ny, Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny)));
      // planes: socket shade, cheekbones, the nose, the chin
      if (fy >= -3 && fy <= 1 && Math.abs(Math.abs(X) - 6.5) < 3) l -= 0.05;
      if (fy >= 3 && fy <= 5 && Math.abs(Math.abs(X) - 7.5) < 2.5) l += 0.04;
      if (fx === -2 && fy >= 1 && fy <= 5) l -= 0.14;
      if (fy === 6) { if (fx >= -1 && fx <= 1) l += 0.1; if (fx === -2) l -= 0.18; }
      if (fx === 0 && fy >= 2 && fy <= 4) l += 0.08;
      if (fy === 8 && (fx === -1 || fx === 0)) l -= 0.12;
      if (fy === 12 && fx >= -1 && fx <= 0) l -= 0.1;
      if (fy >= 14) l -= 0.08;
      let rgb = ramp(R_SKIN, l);
      for (const s of [-1, 1]) { const db = Math.hypot(X - s * 7.6, Y - 4); if (db < 2.6) rgb = mix3(rgb, [226, 128, 120], 0.13 * (1 - db / 2.6)); }
      // a quiet smile
      if (fy === 10 && fx >= -3 && fx <= 2) rgb = mix3(PAL[37], PAL[36], 0.2);
      if (fy === 9 && (fx === -4 || fx === 3)) rgb = mix3(rgb, PAL[37], 0.75);
      if (fy === 11 && fx >= -2 && fx <= 1) rgb = mix3(rgb, [214, 120, 112], 0.3);
      if (fy === 7 && fx === -2) rgb = PAL[37];
      if (fy === 7 && fx === 1) rgb = mix3(rgb, PAL[37], 0.6);
      // light stubble on the lip, the chin and along the jaw
      const lip = fy >= 9 && fy <= 11 && fx >= -4 && fx <= 3;
      const stub = (fy === 8 && fx >= -4 && fx <= 3 && fx !== -1 && fx !== 0) || (fy >= 12 && Math.abs(X) < hw - 0.2) || (fy >= 3 && Math.abs(X) > hw - 2.8);
      if (stub && !lip && ((x + y) & 1) === 0 && ih(x, y, 701) < 0.8) rgb = mix3(rgb, [80, 58, 60], 0.26);
      set(x, y, 1, rgb);
    }
    // the eyes, closed; the brows, relaxed
    const darken = (x, y, k) => { const lx = x - HX0, ly = y - HY0; if (lx < 0 || ly < 0 || lx >= HW || ly >= HH) return; const i = ly * HW + lx; if (HT[i]) set(x, y, HT[i], [HC[i * 3] * k, HC[i * 3 + 1] * k, HC[i * 3 + 2] * k * 1.02]); };
    for (const s of [-1, 1]) {
      const mir = (x) => (s < 0 ? x : 359 - x);
      const ey = fcy - 1;
      for (let x = 172; x <= 175; x++) darken(mir(x), ey - 1, 0.86);             // lid crease
      for (const [x, dy] of [[170, 0], [171, 1], [172, 1], [173, 1], [174, 1], [175, 1], [176, 0]]) set(mir(x), ey + dy, 6, mix3(PAL[36], PAL[42], 0.3));
      set(mir(169), ey, 6, mix3(PAL[37], PAL[42], 0.2));                         // a lash at the outer corner
      for (let x = 169; x <= 176; x++) set(mir(x), ey - 7, 6, x >= 175 ? PAL[42] : PAL[43]);
      set(mir(168), ey - 6, 6, mix3(PAL[43], PAL[38], 0.45));
      set(mir(176), ey - 6, 6, mix3(PAL[42], PAL[38], 0.5));
    }
    // round, dark-rimmed glasses
    const glintP = mod(t - GLINT_T, D) / GLINT_DUR;
    for (const s of [-1, 1]) {
      const cx = CX + s * 6.5, cy = fcy - 0.5;
      for (let y = fl(cy - 6); y <= cy + 6; y++) for (let x = fl(cx - 6); x <= cx + 6; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d2 = dx * dx + dy * dy;
        if (d2 >= 30.25) continue;
        if (d2 >= 20.25) {
          let rgb = PAL[0];
          if (dx > 0 && dy < 0 && dx - dy >= 6) rgb = s > 0 ? [118, 104, 124] : [72, 72, 100];
          else if (dx > 2 && dy > -1) rgb = s > 0 ? [54, 42, 56] : PAL[0];
          set(x, y, 3, rgb);
        } else {
          const lx = x - HX0, ly = y - HY0, i = ly * HW + lx;
          let rgb = HT[i] ? [HC[i * 3], HC[i * 3 + 1], HC[i * 3 + 2]] : PAL[38];
          rgb = mix3(rgb, [206, 196, 232], 0.1 + 0.08 * clamp(-(dx + dy) / 5, 0, 1));
          if (Math.round(dx - 0.5) === 2 && Math.round(dy + 0.5) === -3) rgb = mix3(rgb, PAL[15], 0.6);
          if (Math.round(dx - 0.5) === 3 && Math.round(dy + 0.5) === -2) rgb = mix3(rgb, PAL[15], 0.3);
          // the glint: a bright bar that slides across both lenses
          if (glintP < 1) {
            const c = lerp(-17, 17, glintP), e = Math.sin(Math.PI * glintP);
            const q = (x + 0.5 - CX) + 0.55 * dy - c;
            const k = Math.exp(-q * q / 1.7) * e + 0.6 * Math.exp(-Math.pow(q + 3, 2) / 0.5) * e;
            rgb = mix3(rgb, PAL[15], clamp(k, 0, 0.92));
          }
          set(x, y, HT[i] === 6 ? 6 : 5, rgb);
        }
      }
    }
    // bridge and arms
    set(179, fcy - 2, 3, PAL[0]); set(180, fcy - 2, 3, PAL[0]);
    for (const x of [166, 167]) set(x, fcy - 2, 3, mix3(PAL[0], PAL[36], 0.3));
    for (const x of [192, 193]) set(x, fcy - 2, 3, [60, 46, 56]);
    // a dense base of hair under the curls
    for (let y = HY0; y < HY0 + HH; y++) for (let x = HX0; x < HX0 + HW; x++) {
      const yy = y + 0.5 + hdy, X = x + 0.5 - CX, Y = yy - FCY;
      const hc = FCY - 16, rx = yy > hc ? lerp(16.2, 12.8, clamp((yy - hc) / 12, 0, 1)) : 16.2;
      const ex = X / rx, ey = (yy - hc) / 13.6;
      if (ex * ex + ey * ey > 1 || Y > -3.5) continue;
      if (Y > hairline(X) - 0.5 && Math.abs(X) < faceHW(Y) + 0.8) continue;
      const lx = x - HX0, ly = y - HY0, i = ly * HW + lx;
      if (HT[i] === 3 || HT[i] === 5 || HT[i] === 6) continue;
      HT[i] = 4; HCURL[i] = -2;
    }
    // the curls, stirred by a faint breeze
    const env = 0.65 + 0.35 * Math.cos(TAU * t / 12);
    const cpos = CPOS;
    for (let k = 0; k < CURLS.length; k++) {
      const c = CURLS[k];
      const ox = c.amp * env * Math.sin(TAU * t / 6 + c.ph + (c.x - CX) * 0.14);
      const oy = c.amp * 0.6 * env * Math.cos(TAU * t / 8 + c.ph2);
      const cx = c.x + ox, cy = c.y + oy - hdy;
      cpos[k * 2] = cx; cpos[k * 2 + 1] = cy;
      for (let y = fl(cy - c.r - 1); y <= cy + c.r + 1; y++) for (let x = fl(cx - c.r - 1); x <= cx + c.r + 1; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy > c.r * c.r) continue;
        const lx = x - HX0, ly = y - HY0;
        if (lx < 0 || ly < 0 || lx >= HW || ly >= HH) continue;
        const i = ly * HW + lx;
        if (HT[i] === 3 || HT[i] === 5) continue;      // never over the glasses
        HT[i] = 4; HCURL[i] = k;
      }
    }
    for (let ly = 0; ly < HH; ly++) for (let lx = 0; lx < HW; lx++) {
      const i = ly * HW + lx;
      if (HT[i] !== 4) continue;
      const k = HCURL[i];
      const x = lx + HX0, y = ly + HY0;
      if (k < 0) {
        const gx = (x + 0.5 - CX) / 18, gy = (y + 0.5 - (FCY - 16 - hdy)) / 16;
        const l = 0.06 + 0.22 * Math.max(0, gx * LH[0] + gy * LH[1] + Math.sqrt(Math.max(0, 1 - gx * gx - gy * gy)) * LH[2]) + 0.05 * ih(x, y, 702);
        const rgb = ramp(R_HAIR, l);
        HC[i * 3] = rgb[0]; HC[i * 3 + 1] = rgb[1]; HC[i * 3 + 2] = rgb[2];
        continue;
      }
      const c = CURLS[k];
      const dx = x + 0.5 - cpos[k * 2], dy = y + 0.5 - cpos[k * 2 + 1];
      const rho = Math.min(1, Math.hypot(dx, dy) / c.r);
      const nz = Math.sqrt(Math.max(0, 1 - rho * rho));
      let l = 0.1 + 0.5 * Math.max(0, (dx / c.r) * LH[0] + (dy / c.r) * LH[1] + nz * LH[2]);
      const gx = (x + 0.5 - CX) / 18, gy = (y + 0.5 - (FCY - 16 - hdy)) / 16;
      const gz = Math.sqrt(Math.max(0, 1 - gx * gx - gy * gy));
      l += 0.3 * Math.max(0, gx * LH[0] + gy * LH[1] + gz * LH[2]) - 0.1;
      const th = Math.atan2(dy, dx);
      const sp = th / TAU + rho * 0.9 + c.sp;
      if (sp - fl(sp) < 0.24 && rho > 0.3) l -= 0.17;
      if (rho > 0.82) l -= 0.08;
      // under a curl drawn later: shade
      for (const o of [-HW, -1, 1, HW]) { const n = i + o; if (n >= 0 && n < HN && HT[n] === 4 && HCURL[n] > k) { l -= 0.12; break; } }
      const rgb = ramp(R_HAIR, l * 1.32 + 0.02);
      HC[i * 3] = rgb[0]; HC[i * 3 + 1] = rgb[1]; HC[i * 3 + 2] = rgb[2];
    }
    // silhouette: warm rim toward the dawn, cool on top, dark on the far side
    const hrim = HRIM; hrim.fill(0);
    const occupied = (lx, ly) => {
      if (lx < 0 || ly < 0 || lx >= HW || ly >= HH) return false;
      if (HT[ly * HW + lx]) return true;
      const X = lx + HX0 - NX0, Y = ly + HY0 - NY0;
      return X >= 0 && Y >= 0 && X < NW && Y < NH && NZ[Y * NW + X] > 0 && ly + HY0 > fcy + 6;
    };
    const tmp = HTMP; tmp.set(HC);
    for (let ly = 0; ly < HH; ly++) for (let lx = 0; lx < HW; lx++) {
      const i = ly * HW + lx;
      if (!HT[i]) continue;
      const up = occupied(lx, ly - 1), dn = occupied(lx, ly + 1), lf = occupied(lx - 1, ly), rt = occupied(lx + 1, ly);
      let c = [HC[i * 3], HC[i * 3 + 1], HC[i * 3 + 2]];
      if (HT[i] === 4 || HT[i] === 2) {
        if (!rt || (!occupied(lx + 1, ly - 1) && !up)) c = mix3(c, [238, 162, 122], HT[i] === 4 ? 0.62 : 0.4);
        else if (!up) c = mix3(c, [128, 112, 164], 0.35);
        if (!lf) c = [c[0] * 0.65, c[1] * 0.65, c[2] * 0.75];
      } else if (HT[i] === 1 && !rt) c = mix3(c, RIMWARM, 0.35);
      tmp[i * 3] = c[0]; tmp[i * 3 + 1] = c[1]; tmp[i * 3 + 2] = c[2];
      let open = 0;
      for (const [ox, oy, w] of [[0, -1, 1], [-1, 0, 0.9], [1, 0, 0.9], [-1, -1, 0.7], [1, -1, 0.7], [0, -2, 0.45], [-2, 0, 0.4], [2, 0, 0.4]]) if (!occupied(lx + ox, ly + oy)) open = Math.max(open, w);
      hrim[i] = HT[i] === 4 || HT[i] === 2 ? open : open * 0.5;
    }
    // into the near layer
    for (let ly = 0; ly < HH; ly++) for (let lx = 0; lx < HW; lx++) {
      const i = ly * HW + lx;
      if (!HT[i]) continue;
      const X = lx + HX0 - NX0, Y = ly + HY0 - NY0;
      if (X < 0 || Y < 0 || X >= NW || Y >= NH) continue;
      const n = Y * NW + X;
      NZ[n] = 6; NFIG[n] = 1; NRIM[n] = hrim[i];
      NC[n * 3] = tmp[i * 3]; NC[n * 3 + 1] = tmp[i * 3 + 1]; NC[n * 3 + 2] = tmp[i * 3 + 2];
    }
  }

  /* ================================================================ lotus, reeds, fireflies, motes */
  const LOTUS_SPRITE = [
    '....c....',
    '..p.c.p..',
    '.pp.c.pp.',
    '.ppcccpp.',
    'pPpcccpPp',
    'PPppcppPP',
    '.PPPPPPP.',
  ];
  const BUD_SPRITE = ['..c..', '.pcp.', '.pcp.', 'PpcpP', '.PPP.'];
  const LOTUS = [
    { x: 58, y: 410, pads: [[0, 2, 11], [-14, 7, 8], [10, 9, 7]], flower: 1 },
    { x: 104, y: 428, pads: [[0, 2, 8], [12, -1, 6]], flower: 2 },
    { x: 280, y: 406, pads: [[2, 2, 10], [-11, 6, 7]], flower: 1 },
    { x: 246, y: 436, pads: [[0, 0, 9]], flower: 0 },
  ];
  const REEDS = [];
  function buildReeds() {
    const R = mulberry32(4242);
    // right cluster
    for (let k = 0; k < 9; k++) REEDS.push({ x: 308 + k * 5.4 + R() * 3, h: 120 + R() * 64, lean: -6 - R() * 10, ph: R() * TAU, amp: 1.6 + R() * 1.6, cat: R() < 0.55, blade: false });
    for (let k = 0; k < 6; k++) REEDS.push({ x: 300 + R() * 56, h: 70 + R() * 70, lean: -24 - R() * 20, ph: R() * TAU, amp: 2.2 + R() * 1.4, cat: false, blade: true });
    // left cluster
    for (let k = 0; k < 4; k++) REEDS.push({ x: 4 + k * 7 + R() * 4, h: 86 + R() * 46, lean: 6 + R() * 8, ph: R() * TAU, amp: 1.4 + R() * 1.2, cat: k === 1 || k === 3, blade: false });
    for (let k = 0; k < 4; k++) REEDS.push({ x: R() * 40, h: 52 + R() * 50, lean: 18 + R() * 18, ph: R() * TAU, amp: 2 + R() * 1.4, cat: false, blade: true });
    REEDS.sort((a, b) => (a.blade ? 1 : 0) - (b.blade ? 1 : 0));
  }
  const FIREFLIES = [
    // x0, ground y, height, ax, ay, nx, ny, phases, glow cycles
    [322, 432, 64, 14, 10, 1, 2, 0.3, 1.2, 3, 0.0], [296, 412, 44, 10, 8, 2, 1, 2.1, 0.4, 4, 1.7],
    [338, 440, 110, 8, 14, 1, 1, 4.0, 2.2, 2, 3.1], [86, 392, 26, 9, 9, 1, 2, 1.0, 3.0, 3, 4.4],
    [264, 390, 34, 11, 7, 2, 1, 5.2, 1.1, 3, 2.3], [34, 436, 70, 10, 12, 1, 2, 0.9, 4.1, 4, 5.5],
    [62, 400, 120, 12, 9, 1, 1, 3.3, 0.2, 2, 0.8], [306, 396, 150, 9, 10, 2, 1, 1.4, 5.0, 3, 3.9],
    [130, 412, 50, 13, 8, 1, 2, 2.7, 1.9, 2, 5.0], [236, 420, 58, 10, 9, 1, 1, 4.6, 2.8, 4, 2.6],
    [18, 410, 136, 7, 11, 2, 1, 0.1, 3.6, 3, 1.2],
  ];
  const MOTES = [];
  function buildMotes() {
    const R = mulberry32(3131);
    for (let k = 0; k < 9; k++) MOTES.push({ x: CX + (R() - 0.5) * 90, y0: 330 - R() * 20, rise: 90 + R() * 60, n: R() < 0.5 ? 1 : 2, ph: R(), wob: 2 + R() * 4, wp: R() * TAU, b: 0.5 + R() * 0.5 });
  }

  /* ================================================================ water: ripples on the ground plane */
  // a lake pixel at row y maps to ground (gx, gz), with the rock's water line at gz = 1
  let RIPS = [];
  function setRipples(t) {
    RIPS = [];
    for (let k = 0; k < 3; k++) {
      const a = mod(t - (RING_BIRTH[k] + RIP_DELAY), D);
      if (a >= RIP_LIFE) continue;
      const u = a / RIP_LIFE;
      RIPS.push({ cx: 0, cz: 1.2, half: 0.78, rad: 0.2, R: 0.02 + 0.95 * (1 - Math.pow(1 - u, 1.5)), S: sstep(0, 0.9, a) * Math.pow(1 - u, 1.2) * 1.4 / (1 + 0.8 * u), lam: 0.05 + 0.03 * u, sig: 0.045 + 0.05 * u });
    }
    const a = mod(t - FISH_T, D);
    if (a < FISH_LIFE) {
      const u = a / FISH_LIFE;
      RIPS.push({ cx: (62 - CX) / 76, cz: 100 / 76, half: 0, rad: 0, R: 0.01 + 0.3 * (1 - Math.pow(1 - u, 1.5)), S: sstep(0, 0.3, a) * Math.pow(1 - u, 1.3) * 1.5, lam: 0.045 + 0.02 * u, sig: 0.04 + 0.04 * u });
    }
  }
  let RIP_H = 0;
  function rippleSlope(gx, gz, fp) {
    let s = 0, h = 0;
    for (let k = 0; k < RIPS.length; k++) {
      const r = RIPS[k], dx = Math.max(0, Math.abs(gx - r.cx) - r.half), dz = gz - r.cz;
      const d = Math.sqrt(dx * dx + dz * dz) - r.rad, q = d - r.R;
      if (q > 3 * r.sig || q < -3 * r.sig) continue;
      const att = clamp(r.lam / (2.2 * fp) - 0.25, 0, 1);
      if (att <= 0) continue;
      const e = Math.exp(-q * q / (r.sig * r.sig)) * r.S * att, ph = TAU * q / r.lam;
      s += e * Math.cos(ph); h += e * Math.sin(ph);
    }
    RIP_H = h;
    return s;
  }

  /* ================================================================ the near light: aura + rings */
  let IA = 0;
  const RINGS = [];
  function setRings(t) {
    RINGS.length = 0;
    for (let k = 0; k < 3; k++) {
      const a = mod(t - RING_BIRTH[k], D);
      if (a >= RING_LIFE) continue;
      const u = a / RING_LIFE;
      const r = 20 + 300 * (0.55 * u + 0.45 * (1 - (1 - u) * (1 - u)));
      const I = sstep(0, 2.6, a) * Math.pow(1 - u, 1.5);
      const ph = k * 2.1 + 0.6;
      const warm = 1 - 0.55 * u;
      RINGS.push({ r, w: 3.2 + 8 * u, I, cw: Math.cos(ph), sw: Math.sin(ph), c1r: lerp(96, 150, warm), c1g: lerp(96, 112, warm), c1b: lerp(150, 88, warm) });
    }
  }
  const LO = [0, 0, 0];
  // static per-pixel geometry of the light: distance and angle from his heart, the aura falloff
  const DMAP = new Float32Array(NP), C2MAP = new Float32Array(NP), S2MAP = new Float32Array(NP), A1MAP = new Float32Array(NP), A2MAP = new Float32Array(NP);
  const EXPN = 4096, EXPQ = 8, EXPT = new Float32Array(EXPN + 1);   // exp(-q²) for |q| < 8
  function buildLightMaps() {
    for (let k = 0; k <= EXPN; k++) { const q = k / EXPN * EXPQ; EXPT[k] = Math.exp(-q * q); }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, dx = x + 0.5 - CX, dy = y + 0.5 - HEARTY, d2 = dx * dx + dy * dy;
      DMAP[i] = Math.sqrt(d2); C2MAP[i] = (dx * dx - dy * dy) / d2; S2MAP[i] = 2 * dx * dy / d2;
      A1MAP[i] = Math.exp(-d2 / (36 * 36)); A2MAP[i] = Math.exp(-d2 / (96 * 96));
    }
  }
  const gexp = (q) => { const a = q < 0 ? -q : q; return a >= EXPQ ? 0 : EXPT[(a * (EXPN / EXPQ)) | 0]; };
  function nearLight(i, mist) {
    const a1 = A1MAP[i], a2 = A2MAP[i], d = DMAP[i];
    let r = IA * (a1 * 92 + a2 * 30), g = IA * (a1 * 58 + a2 * 20), b = IA * (a1 * 40 + a2 * 30);
    const c2 = C2MAP[i], s2 = S2MAP[i];
    for (let k = 0; k < RINGS.length; k++) {
      const R = RINGS[k];
      const q = (d - R.r) / R.w;
      if (q < -4 || q > 6) continue;
      const e1 = gexp(q), e2 = gexp((q - 1.2) / 2.1), e3 = gexp((q + 1.6) / 1.4);
      const I = R.I * (0.74 + 0.26 * (c2 * R.cw - s2 * R.sw)) * (1 + 1.9 * mist);
      r += I * (e1 * R.c1r + e2 * 46 + e3 * 22);
      g += I * (e1 * R.c1g + e2 * 40 + e3 * 14);
      b += I * (e1 * R.c1b + e2 * 86 + e3 * 26);
    }
    const mb = 1 + 0.7 * mist;
    LO[0] = r * mb; LO[1] = g * mb; LO[2] = b * mb;
  }

  /* ================================================================ frame */
  function drawFrame(t) {
    t = mod(t, D);
    const br = breathAt(t);
    IA = 0.42 + 0.58 * br;
    setRings(t);
    setRipples(t);
    FORCE.fill(0);
    ZONE.fill(0);
    LR.set(BLR); LG.set(BLG); LB.set(BLB);
    const offA = PA * t / D, offB = PB * 2 * t / D;

    // 1. the sky this frame: mist drifting, stars breathing
    BGF.set(BG0);
    MD.fill(0);
    for (let y = MY0; y < MY1; y++) for (let x = 0; x < W; x++) {
      const m = mistAt(x, y, offA, offB);
      if (m < 0.004) continue;
      const i = y * W + x;
      const near = y < HY && LANDM[i] ? 0.45 : 1;
      MD[i] = m * near;
      if (y >= HY) continue;
      const gl = GLOWX[x], j = i * 3, k = m * near;
      BGF[j] = lerp(BGF[j], lerp(176, 246, gl), k); BGF[j + 1] = lerp(BGF[j + 1], lerp(158, 210, gl), k); BGF[j + 2] = lerp(BGF[j + 2], lerp(200, 192, gl), k);
    }
    for (const s of STARS) {
      const v = s.b * (0.72 + 0.28 * Math.sin(TAU * s.n * t / D + s.ph));
      const j = (s.y * W + s.x) * 3;
      BGF[j] += s.col[0] * v * 0.8; BGF[j + 1] += s.col[1] * v * 0.8; BGF[j + 2] += s.col[2] * v * 0.8;
      if (s.big) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const jj = ((s.y + oy) * W + s.x + ox) * 3;
        BGF[jj] += s.col[0] * v * 0.26; BGF[jj + 1] += s.col[1] * v * 0.26; BGF[jj + 2] += s.col[2] * v * 0.26;
      }
      if (s.big) { const i = s.y * W + s.x; LR[i] += 40 * v; LG[i] += 40 * v; LB[i] += 46 * v; }
    }
    C.set(BGF, 0);

    // 2. the near layer: rock and legs still, upper body lifted by the breath, the head redrawn
    NZ.fill(0); NFIG.fill(0); NRIM.fill(0);
    for (let i = 0; i < NN; i++) if (LA.z[i]) { NZ[i] = LA.z[i]; NFIG[i] = LA.fig[i]; NRIM[i] = LA.rim[i]; NC[i * 3] = LA.c[i * 3]; NC[i * 3 + 1] = LA.c[i * 3 + 1]; NC[i * 3 + 2] = LA.c[i * 3 + 2]; }
    const rise = 2 * br;
    for (let ly = 0; ly < NH; ly++) {
      const y = ly + NY0;
      const sh = Math.round(rise * sstep(344, 288, y));
      const sy = ly + sh;
      if (sy >= NH) continue;
      for (let lx = 0; lx < NW; lx++) {
        const s = sy * NW + lx, i = ly * NW + lx;
        const z = LB_.z[s];
        if (!z || z <= NZ[i]) continue;
        NZ[i] = z; NFIG[i] = 1; NRIM[i] = LB_.rim[s];
        NC[i * 3] = LB_.c[s * 3]; NC[i * 3 + 1] = LB_.c[s * 3 + 1]; NC[i * 3 + 2] = LB_.c[s * 3 + 2];
      }
    }
    drawHead(t, Math.round(rise));
    // aura rim light on his outline, and on the stone behind him
    const ar = 74 * IA, ag = 42 * IA, ab = 34 * IA;
    for (let i = 0; i < NN; i++) {
      if (!NZ[i]) continue;
      if (NFIG[i]) { NC[i * 3] = NC[i * 3] * 1.07 + 6 + 6 * IA; NC[i * 3 + 1] = NC[i * 3 + 1] * 1.01 + 3 + 3 * IA; NC[i * 3 + 2] *= 0.95; }
      if (NRIM[i] <= 0) continue;
      const k = NRIM[i] * (NFIG[i] ? 1 : 0.6);
      NC[i * 3] += ar * k; NC[i * 3 + 1] += ag * k; NC[i * 3 + 2] += ab * k;
    }

    // 3. the lake
    OCC.fill(0);
    for (let ly = 0; ly < NH; ly++) for (let lx = 0; lx < NW; lx++) if (NZ[ly * NW + lx]) OCC[(ly + NY0) * W + lx + NX0] = 1;
    softenOcc();
    const nearAt = (x, y) => { const lx = x - NX0, ly = y - NY0; return lx >= 0 && ly >= 0 && lx < NW && ly < NH && NZ[ly * NW + lx] > 0 ? ly * NW + lx : -1; };
    for (let y = HY; y < H; y++) {
      const dyH = y - HY + 0.5;
      const gz = 100 / dyH, fp = Math.max(100 / (dyH * dyH), 1 / dyH);
      const fade = sstep(HY, H, y);
      const refl = lerp(0.94, 0.66, Math.pow(fade, 0.8));
      const dr = lerp(26, 10, fade), dg = lerp(46, 24, fade), db = lerp(64, 40, fade);
      const shim = (dyH / 168) * (0.8 * Math.sin(0.52 * y + TAU * 3 * t / D) + 0.5 * Math.sin(0.19 * y - TAU * 2 * t / D + 1.3));
      const nrow = y - NY0;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (nrow < NH && x >= NX0 && x < NX0 + NW && NZ[nrow * NW + x - NX0] > 0) continue;
        const gx = (x + 0.5 - CX) / dyH;
        const s = rippleSlope(gx, gz, fp);
        const xs = clamp(fl(x + shim + 0.5 + s * 0.6), 0, W - 1);
        let r, g, b, hit = -1;
        if (y >= WL) {
          const ys = 2 * WL - 1 - y + Math.round(s * 1.8);
          const br = (y - WL) / 40;
          const xb = clamp(xs + Math.round(br * (Math.sin(y * 1.9 + TAU * 3 * t / D) + 0.6 * Math.sin(y * 0.7 - TAU * 2 * t / D))), 0, W - 1);
          hit = nearAt(xb, ys);
          if (hit >= 0) {
            const k = 0.52 - 0.14 * sstep(WL, WL + 60, y);
            r = NC[hit * 3] * k + dr * (1 - k) * 1.2; g = NC[hit * 3 + 1] * k + dg * (1 - k) * 1.2; b = NC[hit * 3 + 2] * k * 1.04 + db * (1 - k) * 1.2;
          }
        }
        if (hit < 0) {
          const ys = clamp(2 * HY - 1 - y + Math.round(s * (y < WL ? 1.2 : 2.2)), 0, HY - 1);
          const j = (ys * W + xs) * 3;
          r = BGF[j] * refl * 0.92 + dr * (1 - refl); g = BGF[j + 1] * refl * 0.97 + dg * (1 - refl); b = BGF[j + 2] * refl + db * (1 - refl);
        }
        const kb = 1 + 0.36 * clamp(s, -1.6, 1.6);
        if (s > 0.2) { const gl = 0.6 + 0.4 * IA; LR[i] += (s - 0.2) * 22 * gl; LG[i] += (s - 0.2) * 18 * gl; LB[i] += (s - 0.2) * 20 * gl; }
        C[i * 3] = r * kb; C[i * 3 + 1] = g * kb; C[i * 3 + 2] = b * kb;
        // the light layer on the water: rings in the air over the far water, their reflection in the near
        if (y < WL) {
          nearLight(i, MD[i]);
          const o = 1 - 0.94 * OCC[i];
          LR[i] += LO[0] * o * 0.9; LG[i] += LO[1] * o * 0.9; LB[i] += LO[2] * o * 0.9;
        } else {
          const ys = 2 * WL - 1 - y + Math.round(s * 2.2);
          if (ys >= 0 && ys < H) {
            nearLight(ys * W + xs, 0);
            const o = (1 - 0.94 * OCC[ys * W + xs]) * 0.5 * (1 + 0.6 * clamp(s, -1, 1)) * (1 - 0.35 * fade);
            LR[i] += LO[0] * o; LG[i] += LO[1] * o; LB[i] += LO[2] * o;
          }
        }
        // mist lying on the far water
        const m = MD[i];
        if (m > 0.004) {
          const gl = GLOWX[x];
          C[i * 3] = lerp(C[i * 3], lerp(176, 246, gl), m * 0.8); C[i * 3 + 1] = lerp(C[i * 3 + 1], lerp(158, 210, gl), m * 0.8); C[i * 3 + 2] = lerp(C[i * 3 + 2], lerp(200, 192, gl), m * 0.8);
        }
      }
    }
    // the light in the sky
    for (let y = 0; y < HY; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      nearLight(i, MD[i]);
      const o = 1 - 0.94 * OCC[i];
      LR[i] += LO[0] * o; LG[i] += LO[1] * o; LB[i] += LO[2] * o;
      const m = MD[i];
      if (m > 0.01) { LR[i] += m * 16; LG[i] += m * 12; LB[i] += m * 14; }
    }

    // 4. him and the rock over everything behind
    for (let ly = 0; ly < NH; ly++) for (let lx = 0; lx < NW; lx++) {
      const n = ly * NW + lx;
      if (!NZ[n]) continue;
      const i = (ly + NY0) * W + lx + NX0;
      C[i * 3] = NC[n * 3]; C[i * 3 + 1] = NC[n * 3 + 1]; C[i * 3 + 2] = NC[n * 3 + 2];
      ZONE[i] = NFIG[n];
    }

    // 5. lotus on the water
    for (const L of LOTUS) drawLotus(L, t);
    // 6. reeds in the foreground
    for (const R of REEDS) drawReed(R, t);
    // 7. fireflies and motes
    for (const f of FIREFLIES) drawFirefly(f, t);
    for (const m of MOTES) {
      const u = mod(t * m.n / D + m.ph, 1);
      const a = Math.pow(Math.sin(Math.PI * u), 2) * m.b * (0.5 + 0.5 * IA);
      const x = m.x + m.wob * Math.sin(TAU * 2 * t / D + m.wp), y = m.y0 - m.rise * u;
      splat(x, y, 1.1, 70 * a, 56 * a, 42 * a);
    }
    // the glint's soft bloom
    const gp = mod(t - GLINT_T, D) / GLINT_DUR;
    if (gp < 1) { const e = Math.sin(Math.PI * gp); splat(lerp(164, 196, gp), FCY - 2 - Math.round(rise), 2.2, 90 * e, 80 * e, 64 * e); }

    quantise();
    lightOut();
  }

  function softenOcc() {
    // a 3 × 3 box, twice, in the box around him: the light wraps his outline a little
    const x0 = NX0 - 3, x1 = NX0 + NW + 3, y0 = NY0 - 3, y1 = Math.min(H, NY0 + NH + 3);
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
    if (k === undefined) { C[i * 3] = rgb[0]; C[i * 3 + 1] = rgb[1]; C[i * 3 + 2] = rgb[2]; }
    else { C[i * 3] = lerp(C[i * 3], rgb[0], k); C[i * 3 + 1] = lerp(C[i * 3 + 1], rgb[1], k); C[i * 3 + 2] = lerp(C[i * 3 + 2], rgb[2], k); }
  }
  function fput(x, y, k) { if (x >= 0 && y >= 0 && x < W && y < H) FORCE[y * W + x] = k + 1; }
  function drawLotus(L, t) {
    // bob with the ripples passing under it
    const dyH = L.y - HY + 0.5;
    rippleSlope((L.x + 0.5 - CX) / dyH, 100 / dyH, Math.max(100 / (dyH * dyH), 1 / dyH));
    const bob = clamp(Math.round(-RIP_H * 1.4 + 0.25 * Math.sin(TAU * t / 12 + L.x)), -1, 1);
    for (const [ox, oy, rx] of L.pads) {
      const cx = L.x + ox, cy = L.y + oy + bob, ry = Math.max(1.6, rx * 0.26);
      for (let y = fl(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = fl(cx - rx - 1); x <= cx + rx + 1; x++) {
        const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry;
        if (u * u + v * v > 1) continue;
        if (u > 0.15 && Math.abs(v + (u - 0.15) * 0.5) < 0.18) continue;   // the notch
        let k = 47;
        if (v < -0.5) k = 21;
        else if (v > 0.55) k = 17;
        else if (u < -0.6) k = 18;
        fput(x, y, k);
      }
      // a dark sliver of shadow on the water below
      for (let x = fl(cx - rx * 0.8); x <= cx + rx * 0.8; x++) cput(x, fl(cy + ry + 1), PAL[16], 0.6);
    }
    if (!L.flower) return;
    const sp = L.flower === 1 ? LOTUS_SPRITE : BUD_SPRITE;
    const w = sp[0].length, h = sp.length, ox = L.x - (w >> 1), oy = L.y + bob - h + 1;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const ch = sp[j][i];
      if (ch === '.') continue;
      const lit = i >= w / 2;
      const col = ch === 'c' ? (lit ? 15 : 14) : ch === 'p' ? (lit ? 46 : 11) : (lit ? 11 : 10);
      fput(ox + i, oy + j, col);
      // its reflection, faint, right under it
      const ry = L.y + bob + (h - j) + 1;
      if (ry < H) cput(ox + i, ry, PAL[col], 0.28);
    }
    splat(L.x + 0.5, oy + h * 0.5, L.flower === 1 ? 5 : 3.5, 26, 16, 18);
  }
  function drawReed(R, t) {
    const sway = R.amp * Math.sin(TAU * t / 12 + R.ph) + 0.6 * Math.sin(TAU * t / 8 + R.ph * 1.7);
    const by = H + 6;
    const N = Math.ceil(R.h * 1.2);
    let px = -1, py = -1;
    for (let k = 0; k <= N; k++) {
      const s = k / N;
      let x, y;
      if (R.blade) { x = R.x + (R.lean + sway * 1.4) * Math.pow(s, 1.7); y = by - R.h * (s - 0.38 * s * s * s); }
      else { x = R.x + (R.lean + sway) * s * s; y = by - R.h * s; }
      const xi = fl(x), yi = fl(y);
      if (xi === px && yi === py) continue;
      px = xi; py = yi;
      const thick = R.blade ? (s < 0.5 ? 2 : 1) : (s < 0.35 ? 2 : 1);
      const dir = R.x > CX ? 1 : -1;
      for (let q = 0; q < thick; q++) cput(xi + q * -dir, yi, PAL[s < 0.2 ? 16 : 17]);
      // rim from the dawn on the side facing right
      if (s > 0.25) cput(xi + (dir > 0 ? 1 : 2), yi, s > 0.55 ? PAL[12] : PAL[19], R.blade ? 0.45 : 0.6);
      if (R.cat && s > 0.7 && s < 0.84) {
        for (let q = -1; q <= 1; q++) { cput(xi + q, yi, PAL[q < 0 ? 42 : q > 0 ? 45 : 44]); if (xi + q >= 0 && xi + q < W && yi < H) ZONE[yi * W + xi + q] = 1; }
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
      if (b > 0.55) FORCE[yi * W + xi] = 16; else if (b > 0.25) FORCE[yi * W + xi] = 24;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) cput(xi + ox, yi + oy, [255, 214, 120], 0.3 * b);
    }
    // reflection on the lake below it
    const ry = yg + hgt;
    if (ry < H && yg > HY) {
      splat(x, ry, 3, 50 * b, 40 * b, 18 * b);
      const ryi = fl(ry);
      if (b > 0.6 && xi >= 0 && xi < W && ryi < H) { const i = ryi * W + xi; if (!ZONE[i]) FORCE[i] = 24; }
    }
  }

  /* ================================================================ quantise + the soft layer */
  function quantise() {
    for (let y = 0, i = 0; y < H; y++) {
      const by = (y & 3) << 2;
      for (let x = 0; x < W; x++, i++) {
        if (FORCE[i]) { OUT[i] = FORCE[i] - 1; continue; }
        const j = i * 3, dth = (BAY[by | (x & 3)] - 0.5) * DITH;
        let r = C[j] + dth, g = C[j + 1] + dth, b = C[j + 2] + dth;
        r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
        OUT[i] = (ZONE[i] ? LUT_ALL : LUT_ENV)[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)];
      }
    }
  }
  // a gentle shoulder so nothing clips hard: 255 (1 - exp(-v / 200)), as a table in quarter steps
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
    buildLightMaps();
    buildSky();
    buildMist();
    buildStars();
    paintRock(LA);
    paintLegs(LA);
    paintUpper(LB_);
    finishLayers();
    buildCurls();
    buildReeds();
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
    medium: 'Pixel art in 48 colours under a soft light · 360 × 450 · 24 s loop',
    note: 'Breathe with him · tap to pause',
    about: 'Blue hour at the edge of a still mountain lake. A man in a navy cardigan sits cross-legged on a flat stone, eyes closed behind round glasses, and breathes: in for three and a half seconds, out for four and a half. With each in-breath a soft ring of light leaves him and drifts out through the sky and the mist; the lake holds its reflection, and a ripple spreads from the stone. Fireflies, reeds, a lotus, a fish far off. The picture is pixel art in 48 colours; the light that moves over it is smooth.',
    tone: 'dark',
    room: '#0c0e24',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0;
      el.style.background = '#0c0e24';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(255,241,214,.85)"/><rect x="19" y="9" width="5" height="16" fill="rgba(255,241,214,.85)"/></svg>';
      el.appendChild(pauseMark);
      // two small canvases: the quantised pixels and the soft light
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
