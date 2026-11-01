/* The Descent — Quiet Hours, piece 5.
 *
 * One continuous 32-second fall from a sunny sea surface to a hydrothermal vent in the abyss, and back.
 * The camera hangs half in, half out of the water, sinks through the meniscus in a burst of bubbles,
 * looks up at the underside of the waves and Snell's window, and passes a reef wall where caustics play
 * on the coral. In the blue a bait ball of silver fish swirls and parts around it and a green turtle rows
 * past; the light shafts thin. In the twilight jellies pulse and a siphonophore trails its chain while
 * marine snow streams upward. In the midnight zone only living light is left: the rainbow cilia of a comb
 * jelly, the photophores of passing lanternfish, blue sparks in their wakes, and an anglerfish's lure that
 * drifts closer until its own glow shows the fish behind it. Then the seabed comes up warm: a black smoker
 * shimmering with heat, glowing mineral seams, a garden of tube worms with red plumes, white crabs and
 * shrimp. A cluster of vent bubbles lets go, the camera rides it up through every zone, and it breaks the
 * surface into the first frame.
 *
 * Every frame is a pure function of t. World y runs down from the surface (y = 0). The camera path is a
 * Hermite spline through hand-placed keys and is exactly periodic, as is every motion in the piece.
 * Painted layers (the reef, the vent dioramas) store albedo, normals and baked light; each frame relights
 * them with depth-attenuated sun, moving caustics and flickering vent light. Creatures are drawn per frame
 * through one light model: depth ambient that loses red, then green, plus bioluminescent point lights that
 * also light the particles around them. The result is quantised with a 4 × 4 Bayer dither, in a perceptual
 * (square-root) space, to a 52-colour palette on a 360 × 450 grid shown at 3×.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 360, H = 450, NP = W * H, D = 32;
  const TAU = Math.PI * 2, fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const fr = (v) => v - fl(v);
  const mod = (a, n) => ((a % n) + n) % n;
  let SEED = 5;
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
  const hx = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  const per = (k, t) => TAU * k * t / D;       // a phase that turns k whole times per loop

  /* ================================================================ palette (50) */
  const PAL_HEX = [
    '020308', '050915', '091022', '0c1834', '15184a', '0f2758', '0c3a72', '0a5290', // 0-7   abyss → blue
    '0c6ca8', '1288bc', '1ea6c8', '44c2d0', '7cdcd6', 'b6f0e4',                     // 8-13  blue → shallow turquoise
    'fffbea', 'ffe7a0', 'a6dcf2', '62b2e6', '3a86cc', '1f4f86',                     // 14-19 sun, glitter, sky
    '2860ff', '58b4ff', '36f0dc', 'c0fff2', '78ff70', 'ff58d0', 'ffe048',           // 20-26 living light
    '1c0907', '421207', '76200c', 'b03a12', 'e8641c', 'ffa03a', 'ffd27a',           // 27-33 vent embers
    '6a0a22', 'c4163a', 'ff6262',                                                   // 34-36 worm plumes
    'eeeae0', 'b8bec2', '7c8a96', '434c58', '262a33',                               // 37-41 bone, silver, slate
    'e0c890', 'a8905e', '6e5e3c', '3e3824', 'd87c66', '93485a', '5c7a3c', '6a4aa0', // 42-49 sand, olive, coral, algae, violet
    '4b98d6', '8ccaec',                                                             // 50-51 sea seen from above
  ];
  const PAL = PAL_HEX.map(hx), NPAL = PAL.length;
  const P = (k) => PAL[k];

  // nearest colour, looked up in a 64³ table indexed in a square-root space so the darks get the resolution
  const QN = 64, LUT = new Uint8Array(QN * QN * QN);
  function nearest(r, g, b) {
    let best = 0, bd = 1e18;
    // the living-light colours are kept for living light: only strongly saturated inputs may use them
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx > 1 ? (mx - mn) / mx : 0;
    for (let k = 0; k < NPAL; k++) {
      if ((k === 22 || k === 24 || k === 25 || k === 26) && sat < 0.62) continue;
      if (k === 20 && sat < 0.7) continue;
      const p = PAL[k], dr = r - p[0], dg = g - p[1], db = b - p[2], rm = (r + p[0]) * 0.5;
      // weigh by brightness so near-black colours are told apart as carefully as bright ones
      const s = 1 / (14 + (r + g + b + p[0] + p[1] + p[2]) / 6);
      const d = ((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db) * s;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  function buildLUT() {
    const dec = new Float32Array(QN);
    for (let q = 0; q < QN; q++) { const u = q / (QN - 1); dec[q] = 255 * u * u; }
    for (let r = 0; r < QN; r++) for (let g = 0; g < QN; g++) for (let b = 0; b < QN; b++)
      LUT[(r << 12) | (g << 6) | b] = nearest(dec[r], dec[g], dec[b]);
  }
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

  /* ================================================================ buffers */
  const C = new Float32Array(NP * 3);    // frame colour, 0..255 linear-ish sRGB
  const C2 = new Float32Array(NP * 3);   // scratch copy (heat haze, lens refraction)
  const OUT = new Uint8Array(NP);        // palette indices

  /* ================================================================ the water column: colour and light by depth */
  const YT0 = -900, YT1 = 4900, NYT = YT1 - YT0;
  const WCT = new Float32Array(NYT * 3);   // colour of open water at world depth y (what you see looking out sideways)
  const AMT = new Float32Array(NYT * 3);   // light reaching a surface at depth y: red goes first, then green
  const SURF = 0, YBED = 3880;
  const WSTOPS = [
    [-900, 120, 214, 214], [0, 96, 206, 208], [140, 58, 182, 204], [420, 32, 150, 196], [800, 18, 112, 176],
    [1200, 12, 76, 148], [1600, 13, 48, 112], [1950, 16, 30, 82], [2250, 12, 18, 52], [2550, 7, 11, 31],
    [2900, 4, 7, 19], [3300, 3, 5, 13], [4900, 2, 4, 11],
  ];
  const ASTOPS = [
    [-900, 1.2, 1.18, 1.08], [0, 1.15, 1.13, 1.04], [160, 0.84, 1.02, 1.0], [450, 0.48, 0.86, 0.96], [800, 0.22, 0.62, 0.84],
    [1200, 0.09, 0.36, 0.64], [1600, 0.04, 0.17, 0.4], [1950, 0.02, 0.08, 0.22], [2300, 0.008, 0.03, 0.09],
    [2700, 0.003, 0.01, 0.035], [3200, 0.001, 0.004, 0.014], [4900, 0.001, 0.003, 0.01],
  ];
  function stopsAt(S, y, out, o) {
    let k = 0;
    while (k < S.length - 2 && y > S[k + 1][0]) k++;
    const a = S[k], b = S[k + 1], u = sstep(a[0], b[0], y);
    out[o] = lerp(a[1], b[1], u); out[o + 1] = lerp(a[2], b[2], u); out[o + 2] = lerp(a[3], b[3], u);
  }
  function buildDepth() {
    for (let i = 0; i < NYT; i++) { stopsAt(WSTOPS, i + YT0, WCT, i * 3); stopsAt(ASTOPS, i + YT0, AMT, i * 3); }
  }
  const yIdx = (y) => { y = (y | 0) - YT0; return (y < 0 ? 0 : y >= NYT ? NYT - 1 : y) * 3; };

  /* ================================================================ camera */
  // keys: [t, h, dh/dt] — h is the world y seen on the frame's centre row (225)
  const KEYS = [
    [0.0, -40, 0], [1.05, -24, 34], [2.15, 196, 300], [3.5, 480, 196], [5.4, 800, 150],
    [7.6, 1090, 92], [9.6, 1340, 170], [11.7, 1770, 205], [13.8, 2170, 160], [15.5, 2410, 108],
    [18.3, 2690, 86], [20.7, 2930, 125], [22.6, 3330, 185], [24.6, 3690, 66], [26.3, 3772, 0],
    [27.5, 3752, -60], [28.7, 3220, -980], [30.1, 1060, -1380], [31.15, 130, -500], [32.0, -40, 0],
  ];
  let CH = 0, CV = 0, RE = 225, CX = 0, TT = 0;
  function camAt(t) {
    let k = 0;
    while (k < KEYS.length - 2 && t > KEYS[k + 1][0]) k++;
    const a = KEYS[k], b = KEYS[k + 1], dt = b[0] - a[0], s = clamp((t - a[0]) / dt, 0, 1);
    const s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    const y = h00 * a[1] + h10 * dt * a[2] + h01 * b[1] + h11 * dt * b[2];
    const d00 = 6 * s2 - 6 * s, d10 = 3 * s2 - 4 * s + 1, d01 = -6 * s2 + 6 * s, d11 = 3 * s2 - 2 * s;
    const v = (d00 * a[1] + d10 * dt * a[2] + d01 * b[1] + d11 * dt * b[2]) / dt;
    return [y, v];
  }
  function setCamera(t) {
    TT = t;
    const c = camAt(t); CH = c[0]; CV = c[1];
    // the camera looks up at the light near the surface, level in the deep
    RE = 225 + 118 * (1 - sstep(1.4, 6.2, t)) + 118 * sstep(29.6, 31.9, t);
    CX = 7 * Math.sin(per(1, t) + 0.6) + 2.5 * Math.sin(per(3, t) + 2.0);
  }
  const hAt = (t) => camAt(mod(t, D))[0];

  /* ================================================================ lights */
  // point lights for this frame: x, y (screen), z (toward viewer), r, g, b, radius, halo
  const LIGHTS = [];
  function addLight(x, y, r, g, b, rad, halo, z) { LIGHTS.push({ x, y, z: z || 6, r, g, b, rad, halo: halo || 0 }); }
  // light falling on a point from the living lights, written to LR, LG, LB
  let LR = 0, LG = 0, LB = 0;
  function pointLight(x, y, nx, ny, nz) {
    LR = 0; LG = 0; LB = 0;
    for (let k = 0; k < LIGHTS.length; k++) {
      const L = LIGHTS[k], dx = L.x - x, dy = L.y - y, dz = L.z;
      const d2 = dx * dx + dy * dy + dz * dz, rr = L.rad * L.rad;
      if (d2 > rr * 9) continue;
      const d = Math.sqrt(d2);
      let lam = 1;
      if (nx !== undefined) lam = 0.35 + 0.65 * Math.max(0, (nx * dx + ny * dy + nz * dz) / d);
      const a = lam / (1 + d2 / rr) * (1 - d2 / (rr * 9));
      LR += L.r * a; LG += L.g * a; LB += L.b * a;
    }
  }

  // shade one creature pixel: albedo 0..1, a normal (y down, z toward the viewer), fog toward the water, alpha
  function lightPx(x, y, ar, ag, ab, nx, ny, nz, fog, alpha, er, eg, eb) {
    x = fl(x); y = fl(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const yw = CH + y - 225, o = yIdx(yw), i = y * W + x, j = i * 3;
    const dif = 0.4 + 0.6 * clamp(-ny * 0.8 + nz * 0.45, 0, 1);
    // creatures are lit a little brighter than the open water scatters (they sit in the light, not behind it)
    const lb = 255 * 1.75 * dif;
    let r = AMT[o] * lb, g = AMT[o + 1] * lb, b = AMT[o + 2] * lb;
    if (LIGHTS.length) { pointLight(x, y, nx, ny, nz); r += LR; g += LG; b += LB; }
    r = r * ar + (er || 0); g = g * ag + (eg || 0); b = b * ab + (eb || 0);
    if (fog > 0) { r += (WCT[o] - r) * fog; g += (WCT[o + 1] - g) * fog; b += (WCT[o + 2] - b) * fog; }
    if (alpha >= 1) { C[j] = r; C[j + 1] = g; C[j + 2] = b; }
    else { C[j] += (r - C[j]) * alpha; C[j + 1] += (g - C[j + 1]) * alpha; C[j + 2] += (b - C[j + 2]) * alpha; }
  }
  // add light (glow, sparkle) to a pixel
  function addPx(x, y, r, g, b) {
    x = fl(x); y = fl(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const j = (y * W + x) * 3;
    C[j] += r; C[j + 1] += g; C[j + 2] += b;
  }
  function mixPx(x, y, r, g, b, a) {
    x = fl(x); y = fl(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const j = (y * W + x) * 3;
    C[j] += (r - C[j]) * a; C[j + 1] += (g - C[j + 1]) * a; C[j + 2] += (b - C[j + 2]) * a;
  }

  /* ================================================================ shape stamping (outlines) */
  const TM = new Int32Array(NP), TS = new Float32Array(NP), TV = new Float32Array(NP);
  let STAMP = 0, bx0 = 0, by0 = 0, bx1 = 0, by1 = 0;
  function mapBegin() { STAMP++; bx0 = W; by0 = H; bx1 = -1; by1 = -1; }
  function mark(x, y, s, v) {
    x = fl(x); y = fl(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    TM[i] = STAMP; TS[i] = s; TV[i] = v;
    if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
  }
  const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H && TM[y * W + x] === STAMP;
  function mapEnd(fn) {
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const i = y * W + x;
      if (TM[i] !== STAMP) continue;
      const e = (inMap(x, y - 1) ? 0 : 1) | (inMap(x, y + 1) ? 0 : 2) | (inMap(x - 1, y) ? 0 : 4) | (inMap(x + 1, y) ? 0 : 8);
      fn(x, y, TS[i], TV[i], e);
    }
  }

  /* ================================================================ caustics: a moving web of light */
  // two jittered lattices whose points circle a whole number of times per loop; the web is the
  // Worley F2 - F1 ridge, warped a little. Coordinates are in cell units and the lattice wraps.
  const CN = 16, CPA = new Float32Array(CN * CN * 2), CPB = new Float32Array(CN * CN * 2);
  let CW1 = 0, CW2 = 0;
  function causLattice(t) {
    for (let L = 0; L < 2; L++) {
      const Pp = L ? CPB : CPA;
      for (let j = 0; j < CN; j++) for (let i = 0; i < CN; i++) {
        const k = j * CN + i, h1 = ih(i, j, 601 + L), h2 = ih(i, j, 603 + L), h3 = ih(i, j, 605 + L);
        const m = [1, -1, 2, -2, 3, -1, 1, -2][fl(h3 * 8)] * (L ? 2 : 1);
        const a = per(m, t) + h1 * TAU, rr = 0.2 + 0.14 * h2;
        Pp[k * 2] = i + 0.18 + 0.64 * h1 + Math.cos(a) * rr;
        Pp[k * 2 + 1] = j + 0.18 + 0.64 * h2 + Math.sin(a) * rr;
      }
    }
    CW1 = per(2, t); CW2 = per(3, t);
  }
  function worleyEdge(Pp, x, y) {
    const ix = fl(x), iy = fl(y);
    let f1 = 9, f2 = 9;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ci = ix + di, cj = iy + dj, wi = ((ci % CN) + CN) % CN, wj = ((cj % CN) + CN) % CN, k = (wj * CN + wi) * 2;
      const px = Pp[k] + (ci - wi), py = Pp[k + 1] + (cj - wj);
      const dx = x - px, dy = y - py, d = dx * dx + dy * dy;
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    return Math.sqrt(f2) - Math.sqrt(f1);
  }
  // world/plane position in pixels → web brightness 0..1 (sharp: thin bright lines)
  function causAt(x, y, sc) {
    const u = x / sc, v = y / sc;
    const wx = u + 0.22 * Math.sin(v * 1.7 + CW1) + 0.1 * Math.sin(v * 3.1 - u * 1.3 + CW2);
    const wy = v + 0.22 * Math.sin(u * 1.5 - CW1 + 1.0) + 0.1 * Math.sin(u * 2.9 + v * 1.1 + CW2);
    let e = worleyEdge(CPA, wx, wy), c = 1 - e / 0.16; c = c < 0 ? 0 : c * c;
    e = worleyEdge(CPB, wx * 1.63 + 3.1, wy * 1.63 + 7.7); let c2 = 1 - e / 0.2; c2 = c2 < 0 ? 0 : c2 * c2;
    const s = c + 0.55 * c2;
    return s > 1 ? 1 : s;
  }

  /* ================================================================ static fields */
  const NZT = 512, NZ = new Float32Array(W * NZT);     // soft texture of the open water, tiling in y
  const SKY = new Float32Array(W * 400 * 3);            // the sky above the horizon, row 0 = horizon
  const VPX = 214, VPY = -400;                          // where the sun's rays converge, above the frame
  const SHU0 = -0.75, SHU1 = 0.55, NSH = 1024;
  const SHI = new Uint16Array(NP), SHR = new Float32Array(NP);
  const SHP = new Float32Array(NSH), SHQ = new Float32Array(NSH);
  const BEAMS = [];
  function buildFields() {
    for (let y = 0; y < NZT; y++) for (let x = 0; x < W; x++) {
      // tile in y by blending the noise with itself one period down
      const u = y / NZT, a = fbm(x / 70, y / 46, 31, 3), b = fbm(x / 70, (y - NZT) / 46, 31, 3);
      NZ[y * W + x] = lerp(a, b, u) - 0.5;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, u = (x + 0.5 - VPX) / (y + 0.5 - VPY);
      SHI[i] = clamp(Math.round((u - SHU0) / (SHU1 - SHU0) * (NSH - 1)), 0, NSH - 1);
      SHR[i] = Math.hypot(x - VPX, y - VPY);
    }
    const R = mulberry32(911);
    for (let k = 0; k < 30; k++) {
      BEAMS.push({ u: lerp(-0.62, 0.44, (k + R() * 0.8) / 30), w: 0.004 + 0.016 * R() * R(), a: 0.35 + 0.65 * R(),
        k: 1 + fl(R() * 2), sw: 0.008 + 0.02 * R(), ph: R() * TAU, k2: 2 + fl(R() * 4), ph2: R() * TAU });
    }
    buildSky();
  }
  const SUNX = 248, SUNQ = 128;   // the sun in the above-water sky: x, rows above the horizon
  let CLOUDS = null;
  function cloudAt(x, q) {
    if (!CLOUDS) {
      const R = mulberry32(31337);
      CLOUDS = [];
      for (const [cx, cq, w] of [[54, 70, 104], [214, 40, 70], [322, 104, 74], [128, 176, 58], [4, 230, 54], [292, 236, 40]]) {
        const puffs = [], n = 4 + fl(w / 16);
        for (let k = 0; k < n; k++) {
          const u = k / (n - 1), r = w * (0.13 + 0.12 * (1 - Math.abs(2 * u - 1))) * (0.75 + 0.5 * R());
          puffs.push([cx + (u - 0.5) * w * 0.9 + (R() - 0.5) * 6, cq + r * (0.45 + 0.4 * R()), r]);
        }
        for (let k = 0; k < n; k++) { const pp = puffs[fl(R() * n)]; puffs.push([pp[0] + (R() - 0.5) * pp[2], pp[1] + pp[2] * 0.6, pp[2] * (0.45 + 0.3 * R())]); }
        CLOUDS.push({ cq, puffs });
      }
    }
    for (const c of CLOUDS) {
      if (q < c.cq - 1) continue;
      let best = null, bz = -1;
      for (const pp of c.puffs) {
        const dx = (x - pp[0]) / pp[2], dq = (q - pp[1]) / pp[2], d = dx * dx + dq * dq;
        const wob = 1 + 0.12 * (fbm(x / 4, q / 4, 77, 2) - 0.5);
        if (d < wob) { const z = Math.sqrt(Math.max(0, wob - d)) * pp[2] + pp[1] * 0.2; if (z > bz) { bz = z; best = [dx, dq]; } }
      }
      if (!best) continue;
      // lit from the sun, up and to the right; a flat grey-blue base
      const lam = clamp(0.55 + 0.5 * (best[0] * 0.45 + best[1] * 0.75), 0, 1);
      const base = clamp((q - c.cq) / 6, 0, 1);
      const k = lam * (0.55 + 0.45 * base);
      return [lerp(150, 255, k), lerp(176, 252, k), lerp(206, 242, k), q - c.cq < 1 ? 0.7 : 1];
    }
    return null;
  }
  function buildSky() {
    for (let q = 0; q < 400; q++) for (let x = 0; x < W; x++) {
      const j = (q * W + x) * 3, u = clamp(q / 300, 0, 1);
      let r = lerp(196, 52, Math.pow(u, 0.6)), g = lerp(232, 146, Math.pow(u, 0.6)), b = lerp(240, 222, Math.pow(u, 0.7));
      const dx = x - SUNX, dq = q - SUNQ, d = Math.sqrt(dx * dx + dq * dq);
      const glow = Math.exp(-d / 70) * 0.9 + Math.exp(-d / 22) * 0.8;
      r += glow * 70; g += glow * 52; b += glow * 26;
      const cl = cloudAt(x, q);
      if (cl) { r = lerp(r, cl[0], cl[3]); g = lerp(g, cl[1], cl[3]); b = lerp(b, cl[2], cl[3]); }
      if (d < 7.5) { const k = clamp(8 - d, 0, 1); r = lerp(r, 255, k); g = lerp(g, 252, k); b = lerp(b, 236, k); }
      SKY[j] = r; SKY[j + 1] = g; SKY[j + 2] = b;
    }
  }

  /* ================================================================ background: water, surface, sky */
  const SINT = new Float32Array(1024), SINK = 1024 / TAU;
  for (let i = 0; i < 1024; i++) SINT[i] = Math.sin(i / SINK);
  const FOC = 232;
  const CEW = new Float32Array(W + 2);                    // focal length in pixels for the surface seen from below / above
  function shaftProfile(t) {
    SHP.fill(0);
    for (const b of BEAMS) {
      const c = b.u + b.sw * Math.sin(per(b.k, t) + b.ph);
      const amp = b.a * (0.6 + 0.4 * Math.sin(per(b.k2, t) + b.ph2));
      const w = b.w, i0 = Math.max(0, fl((c - 3 * w - SHU0) / (SHU1 - SHU0) * (NSH - 1))), i1 = Math.min(NSH - 1, Math.ceil((c + 3 * w - SHU0) / (SHU1 - SHU0) * (NSH - 1)));
      for (let i = i0; i <= i1; i++) { const u = SHU0 + (SHU1 - SHU0) * i / (NSH - 1), d = (u - c) / w; SHP[i] += amp * Math.exp(-d * d); }
    }
    for (let i = 0; i < NSH; i++) { const v = Math.min(1.4, SHP[i]); SHP[i] = v; SHQ[i] = v * v * v * 0.6; }
  }
  // the waterline across the lens, in rows; > 0 means some of the frame is above water
  function waterline(x, t) {
    return 225 - CH + 4.5 * Math.sin(x * 0.019 + per(2, t)) + 2.2 * Math.sin(x * 0.051 - per(5, t) + 1.0)
      + 5 * Math.sin(per(4, t) + 0.4) + 1.2 * Math.sin(x * 0.13 + per(7, t));
  }
  let WLMAX = -1, WLMIN = 1e9;
  const WLX = new Float32Array(W);
  function drawWater(t) {
    const nzOff = mod(fl(CH * 0.5), NZT);
    const shD = new Float32Array(H), shK = new Float32Array(H);
    for (let y = 0; y < H; y++) {
      const yw = CH + y - 225;
      shD[y] = yw < -2 ? 0 : sstep(-2, 60, yw) * (Math.exp(-yw / 330) * 0.95 + 0.05 * Math.exp(-yw / 900));
      shK[y] = sstep(250, 1100, yw);
    }
    for (let y = 0; y < H; y++) {
      const yw = CH + y - 225, o = yIdx(yw);
      const wr = WCT[o], wg = WCT[o + 1], wb = WCT[o + 2];
      const nrow = mod(y + nzOff, NZT) * W;
      const sd = shD[y], sk = shK[y], lum = (wr + wg + wb) / 3;
      for (let x = 0; x < W; x++) {
        const i = y * W + x, j = i * 3;
        const n = 1 + NZ[nrow + x] * (0.16 + 0.1 * (lum < 40 ? 1 : 0));
        let r = wr * n, g = wg * n, b = wb * n;
        if (sd > 0.003) {
          const si = SHI[i], s = (SHP[si] * (1 - sk) + SHQ[si] * sk) * sd;
          const lm = 0.72 + 0.28 * SINT[((SHR[i] * 0.021 + si * 0.05 + CW1) * SINK) & 1023];
          r += 64 * s * lm; g += 98 * s * lm; b += 86 * s * lm;
        }
        C[j] = r; C[j + 1] = g; C[j + 2] = b;
      }
    }
  }
  // the underside of the surface: Snell's window overhead, a rippled mirror beyond it, fading into the blue
  // waves on the surface as seen from below: five travelling sines per row, stepped along x by recurrence
  const CW_K = [[0.045, 0.03, -3, 0], [0.09, -0.06, 5, 1.3], [0.02, 0.13, -7, 0], [-0.02, 0.05, 4, Math.PI / 2], [0.07, 0.11, -6, 2]];
  const CSN = new Float64Array(5), CCS = new Float64Array(5), CSA = new Float64Array(5), CCA = new Float64Array(5);
  function drawCeiling(t) {
    // just under the surface the lens still sees the ceiling from a little below it
    const hh = 24 + Math.max(0, CH + 6) * (1 - 22 / Math.max(22, CH + 30));
    if (hh > 1100) return;
    for (let y = 0; y < Math.min(H, RE - 1); y++) {
      const tp = (RE - y) / FOC;               // tangent of the elevation of this row's ray
      const s = hh / tp, path = hh * Math.sqrt(1 + 1 / (tp * tp));
      const LF = 210 + 0.3 * hh;
      const vis = Math.exp(-path / LF);
      if (vis < 0.012) continue;
      const sinE = tp / Math.sqrt(1 + tp * tp);
      const amp = Math.exp(-s / 520);
      // X = ax * x + bx along the row; each wave's phase is kx * X + ks * S + w t
      const ax = s / FOC, bx = -180 * s / FOC + CX * 3;
      for (let k = 0; k < 5; k++) {
        const K = CW_K[k], ph0 = K[0] * bx + K[1] * s + per(K[2], t) + K[3], st = K[0] * ax;
        CSN[k] = Math.sin(ph0); CCS[k] = Math.cos(ph0); CSA[k] = Math.sin(st); CCA[k] = Math.cos(st);
      }
      const doWeb = amp * vis > 0.03;
      const o = yIdx(160), wr0 = WCT[o], wg0 = WCT[o + 1], wb0 = WCT[o + 2];
      for (let x = 0; x < W; x++) {
        const sx = 0.5 * CSN[0] + 0.35 * CSN[1] + 0.2 * CSN[2], sy = 0.5 * CCS[3] + 0.3 * CSN[4];
        for (let k = 0; k < 5; k++) { const sn = CSN[k] * CCA[k] + CCS[k] * CSA[k]; CCS[k] = CCS[k] * CCA[k] - CSN[k] * CSA[k]; CSN[k] = sn; }
        if (WLX[x] > y) continue;              // above water on the lens
        const i = y * W + x, j = i * 3;
        const el = sinE + 0.11 * amp * sy;
        let r, g, b;
        if (el > 0.664) {
          // inside the window: the sky, squeezed into a disc, with the sun high on one side
          const q = clamp((el - 0.664) / 0.336, 0, 1);
          r = 150 + 86 * q; g = 222 + 28 * q; b = 232 + 14 * q;
          const sdx = (x - 232 - 30 * sx * amp) / 24, sdy = (y - (RE - FOC * 2.4)) / 30;
          const sun = Math.exp(-(sdx * sdx + sdy * sdy));
          r += sun * 60; g += sun * 50; b += sun * 30;
          if (el < 0.7) { const k = (0.7 - el) / 0.036; r -= 40 * k; g -= 6 * k; b += 6 * k; }
        } else {
          // beyond the window the surface is a mirror of the depths, lit by wriggling lines where it bends light in
          let web = 0;
          if (doWeb) {
            if (!(y & 1) && !(x & 1)) { web = causAt((ax * x + bx) * 0.7 + 400, s * 1.3 + 200, 34) * amp; CEW[x] = web; CEW[x + 1] = web; }
            else web = (x & 1) ? (CEW[x - 1] + CEW[Math.min(W, x + 1)]) * 0.5 : CEW[x];
          }
          const m = 0.55 + 0.45 * (sx * 0.5 + 0.5);
          r = wr0 * m * 1.25 + web * 120; g = wg0 * m * 1.18 + web * 150; b = wb0 * m * 1.06 + web * 128;
          if (el > 0.6) { const k = (el - 0.6) / 0.064; r *= 1 - 0.3 * k; g *= 1 - 0.22 * k; b *= 1 - 0.12 * k; }
        }
        C[j] += (r - C[j]) * vis; C[j + 1] += (g - C[j + 1]) * vis; C[j + 2] += (b - C[j + 2]) * vis;
      }
    }
  }
  // above the waterline: the sky, a band of glittering swells, the sun path
  function drawAbove(t) {
    if (WLMAX <= 0) return;
    const hor = 225 - CH - 92;              // horizon row
    const st = fl(t * 12);
    for (let y = 0; y < Math.min(H, Math.ceil(WLMAX)); y++) {
      for (let x = 0; x < W; x++) {
        if (WLX[x] <= y) continue;
        const i = y * W + x, j = i * 3;
        let r, g, b;
        if (y < hor) {
          const q = clamp(fl(hor - y), 0, 399), k = (q * W + clamp(x + Math.round(3 * Math.sin(per(1, t))), 0, W - 1)) * 3;
          r = SKY[k]; g = SKY[k + 1]; b = SKY[k + 2];
        } else {
          // the sea seen from just above: rows near the horizon are far away, so their swells fade out
          const dy = y - hor + 0.6, s = 900 / dy, X = (x - 180) * s / FOC;
          const near = clamp((dy - 3) / 50, 0, 1);
          const sw = (Math.sin(s * 0.11 + X * 0.018 + per(9, t)) * 0.6 + Math.sin(s * 0.27 - X * 0.05 + per(13, t) + 1) * 0.3) * near * near
            + Math.sin(s * 0.6 + X * 0.11 - per(19, t)) * 0.18 * clamp((dy - 20) / 30, 0, 1);
          const fade = clamp(dy / 80, 0, 1);
          r = lerp(140, 52, fade) + sw * 18; g = lerp(202, 138, fade) + sw * 24; b = lerp(234, 210, fade) + sw * 14;
          // the face of a swell turned to the sky is paler
          if (sw > 0.5) { r += 30; g += 30; b += 16; }
          else if (sw < -0.6) { r -= 16; g -= 24; b -= 20; }
          // the sun's glitter path widens toward the lens
          const pw = 8 + dy * 0.75, px = (x - SUNX - (y - hor) * 0.18) / pw;
          const path = Math.exp(-px * px * 1.4);
          r += path * 56 * (1 - fade * 0.5); g += path * 62 * (1 - fade * 0.5); b += path * 50 * (1 - fade * 0.5);
          const hsh = ih(x, y, st + 900);
          if (path > 0.08 && sw > 0.2 && hsh < 0.08 * path) { r = 255; g = 250; b = 226; }
          else if (path > 0.05 && hsh < 0.03 * path + 0.004) { r += 90; g += 80; b += 50; }
        }
        C[j] = r; C[j + 1] = g; C[j + 2] = b;
      }
    }
  }
  // the meniscus line on the lens and the water clinging under it
  function drawWaterlineEdge(t) {
    if (WLMAX <= -4 || WLMIN > H + 6) return;
    for (let x = 0; x < W; x++) {
      const w = WLX[x], y0 = fl(w);
      for (let d = -2; d <= 7; d++) {
        const y = y0 + d;
        if (y < 0 || y >= H) continue;
        const j = (y * W + x) * 3;
        if (d === -1) { C[j] = C[j] * 0.6 + 100; C[j + 1] = C[j + 1] * 0.6 + 104; C[j + 2] = C[j + 2] * 0.6 + 100; }
        else if (d === 0) { C[j] = 240; C[j + 1] = 252; C[j + 2] = 246; }
        else if (d === 1) { C[j] = C[j] * 0.4 + 120; C[j + 1] = C[j + 1] * 0.4 + 150; C[j + 2] = C[j + 2] * 0.4 + 150; }
        else if (d >= 2) { const k = 0.5 * (1 - (d - 2) / 6); C[j] *= 1 - k; C[j + 1] *= 1 - k * 0.8; C[j + 2] *= 1 - k * 0.6; }
      }
    }
  }

  /* ================================================================ drifting particles: plankton, marine snow */
  const PN = 560;
  const PXa = new Float32Array(PN), PYa = new Float32Array(PN), PPa = new Float32Array(PN), PSa = new Float32Array(PN),
    PHa = new Float32Array(PN), PKa = new Uint8Array(PN);
  const PMARG = 24, PHT = H + PMARG * 2;
  function buildParticles() {
    const R = mulberry32(1234);
    for (let k = 0; k < PN; k++) {
      PXa[k] = R() * (W + 40) - 20; PYa[k] = R() * PHT;
      const u = R(); PPa[k] = u < 0.7 ? 0.55 + 0.6 * R() : 1.15 + 1.1 * R() * R();
      PSa[k] = R(); PHa[k] = R() * TAU; PKa[k] = fl(R() * 4);
    }
  }
  function partPos(k, h, t) {
    const p = PPa[k];
    const x = PXa[k] - CX * p + 3 * Math.sin(per(1 + PKa[k], t) + PHa[k]);
    const y = mod(PYa[k] - h * p + 4 * Math.sin(per(2, t) + PHa[k] * 1.7), PHT) - PMARG;
    return [x, y];
  }
  function drawParticles(t) {
    const hPrev = hAt(t - 1 / 30);
    for (let k = 0; k < PN; k++) {
      const p = PPa[k], q = partPos(k, CH, t);
      let x = q[0], y = q[1];
      if (x < -3 || x > W + 3 || y < -40 || y > H + 40) continue;
      const yw = CH + (y - 225) / p, o = yIdx(yw);
      if (yw < 4) continue;
      // plankton and snow are a little paler than the water around them; living light lights them strongly
      const sv = 0.35 + 0.65 * PSa[k];
      let r = WCT[o] * (1 + 0.32 * sv) + (14 + 40 * sv) * AMT[o], g = WCT[o + 1] * (1 + 0.3 * sv) + (16 + 44 * sv) * AMT[o + 1], b = WCT[o + 2] * (1 + 0.24 * sv) + (16 + 40 * sv) * AMT[o + 2];
      // a floor so the snow is faintly there in the dark, as if lit by the starlight of everything else alive
      const dz = sstep(1300, 2200, yw);
      r += (5 + 9 * dz) * sv; g += (7 + 14 * dz) * sv; b += (11 + 22 * dz) * sv;
      // glints where a shaft crosses
      if (yw < 1300 && y >= 0 && y < H) { const si = SHI[fl(y) * W + clamp(fl(x), 0, W - 1)]; const sh = SHP[si] * Math.exp(-yw / 400); r += 60 * sh * sv; g += 80 * sh * sv; b += 70 * sh * sv; }
      if (LIGHTS.length) { pointLight(x, y); r += LR * 1.1 * sv; g += LG * 1.1 * sv; b += LB * 1.1 * sv; }
      const strength = p > 1.3 ? 0.6 : 0.9;
      // only real speed smears the specks into streaks (the ascent)
      const dy = (CH - hPrev) * p;
      const len = Math.min(70, Math.abs(dy));
      const big = p > 1.6 ? 2 : 1;
      if (len > 22) {
        const n = Math.ceil(len), a = Math.min(0.85, 3.2 / Math.sqrt(n));
        for (let s = 0; s < n; s++) { const yy = y + Math.sign(dy) * s; mixPx(x, yy, r, g, b, a * strength * (1 - s / n * 0.6)); if (big === 2) mixPx(x + 1, yy, r, g, b, a * strength * 0.5 * (1 - s / n)); }
      } else if (big === 2) {
        mixPx(x, y, r, g, b, strength * 0.75); mixPx(x + 1, y, r, g, b, strength * 0.5); mixPx(x, y + 1, r, g, b, strength * 0.5); mixPx(x + 1, y + 1, r, g, b, strength * 0.3);
      } else mixPx(x, y, r, g, b, strength);
    }
  }

  /* ================================================================ bubbles */
  function bubble(cx, cy, r, tint, a) {
    a = a === undefined ? 1 : a;
    const x0 = fl(cx - r - 1), x1 = Math.ceil(cx + r + 1), y0 = fl(cy - r - 1), y1 = Math.ceil(cy + r + 1);
    const tr = tint ? tint[0] : 230, tg = tint ? tint[1] : 250, tb = tint ? tint[2] : 248;
    if (r < 0.9) { mixPx(cx, cy, tr, tg, tb, 0.8 * a); return; }
    if (r < 1.6) {
      mixPx(cx, cy, tr, tg, tb, 0.5 * a); mixPx(cx - 1, cy, tr, tg, tb, 0.55 * a); mixPx(cx + 1, cy, tr, tg, tb, 0.45 * a);
      mixPx(cx, cy - 1, tr, tg, tb, 0.7 * a); mixPx(cx, cy + 1, tr, tg, tb, 0.4 * a); return;
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.sqrt(dx * dx + dy * dy);
      if (d > r + 0.5) continue;
      const u = d / r;
      let k;
      if (u > 0.78) k = 0.75 - (dy > 0 ? 0.2 : 0);           // the rim
      else k = 0.12 + 0.15 * (dy / r);                       // a faint lens of light inside
      mixPx(x, y, tr, tg, tb, clamp(k, 0, 1) * a);
    }
    // a window highlight up and to the left, a small one bottom right
    const hx2 = cx - r * 0.42, hy = cy - r * 0.45;
    mixPx(hx2, hy, 255, 255, 250, 0.95 * a);
    if (r > 3.5) { mixPx(hx2 + 1, hy, 255, 255, 250, 0.7 * a); mixPx(hx2, hy + 1, 255, 255, 250, 0.6 * a); }
    if (r > 2.5) mixPx(cx + r * 0.5, cy + r * 0.45, tr, tg, tb, 0.6 * a);
  }

  /* ================================================================ painted layers */
  // A layer is a painted diorama: albedo, normal, height and fog per pixel, baked once into BASE (lit by
  // the sun as it reaches that depth, fogged toward the water) and CAU (what caustic light would add).
  // Vent layers also bake the light of each fixed vent glow (BK0, BK1) and an emissive term (EM).
  const LM = 16;                                // horizontal margin for the camera's sideways drift
  function makeLayer(h, p, y0, opts) {
    const w = W + LM * 2, n = w * h;
    const L = { w, h, n, p, y0, M: new Uint8Array(n), A: new Float32Array(n * 3), N: new Float32Array(n * 3), Z: new Float32Array(n),
      F: new Float32Array(n), CWt: new Float32Array(n), BASE: new Float32Array(n * 3), CAU: null, BK0: null, BK1: null, EM: null, ID: new Uint16Array(n) };
    if (opts && opts.caus) L.CAU = new Float32Array(n * 3);
    if (opts && opts.vent) { L.BK0 = new Float32Array(n * 3); L.BK1 = new Float32Array(n * 3); L.EM = new Float32Array(n * 3); }
    return L;
  }
  let LAY = null, PID = 1;
  const VLIGHTS = [];
  function lset(lx, ly, r, g, b, nx, ny, nz, z, cw) {
    lx = fl(lx); ly = fl(ly);
    const L = LAY;
    if (lx < 0 || ly < 0 || lx >= L.w || ly >= L.h) return;
    const i = ly * L.w + lx;
    L.M[i] = 1; L.A[i * 3] = r; L.A[i * 3 + 1] = g; L.A[i * 3 + 2] = b;
    const nl = Math.hypot(nx, ny, nz) || 1;
    L.N[i * 3] = nx / nl; L.N[i * 3 + 1] = ny / nl; L.N[i * 3 + 2] = nz / nl;
    L.Z[i] = z; L.CWt[i] = cw === undefined ? clamp(0.2 - ny / nl * 0.9, 0, 1) : cw; L.ID[i] = PID;
  }
  const lmask = (lx, ly) => lx >= 0 && ly >= 0 && lx < LAY.w && ly < LAY.h && LAY.M[ly * LAY.w + lx];
  // a dome (coral head, pillow, boulder): fn(u, v, lx, ly) returns [r, g, b] albedo or null
  function ldome(cx, cy, rx, ry, z0, zh, fn, flatBottom) {
    for (let y = fl(cy - ry); y <= cy + ry; y++) for (let x = fl(cx - rx); x <= cx + rx; x++) {
      const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, d = u * u + v * v;
      if (d > 1 || (flatBottom && v > flatBottom)) continue;
      const nz = Math.sqrt(1 - d), c = fn(u, v, x, y, nz);
      if (!c) continue;
      lset(x, y, c[0], c[1], c[2], u * 0.9, v * 0.9, nz + 0.15, z0 + zh * nz, c[3]);
    }
  }
  // a tapering tube along a polyline with cylinder normals: fn(s, w, lx, ly) → albedo
  function ltube(pts, r0, r1, z0, fn) {
    let tot = 0; const sl = [];
    for (let k = 0; k < pts.length - 1; k++) { const l = Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]); sl.push(l); tot += l; }
    let acc = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1], l = sl[k] || 1e-6, tx = (b[0] - a[0]) / l, ty = (b[1] - a[1]) / l, nx = -ty, ny = tx;
      const ra = lerp(r0, r1, acc / tot), rb = lerp(r0, r1, (acc + l) / tot), m = Math.max(ra, rb) + 1;
      for (let y = fl(Math.min(a[1], b[1]) - m); y <= Math.max(a[1], b[1]) + m; y++) for (let x = fl(Math.min(a[0], b[0]) - m); x <= Math.max(a[0], b[0]) + m; x++) {
        const px = x + 0.5 - a[0], py = y + 0.5 - a[1], al = clamp(px * tx + py * ty, 0, l);
        const qx = px - tx * al, qy = py - ty * al, r = lerp(ra, rb, al / l), dd = Math.hypot(qx, qy);
        if (dd > r) continue;
        const w = (qx * nx + qy * ny) / Math.max(0.5, r), nz = Math.sqrt(Math.max(0, 1 - w * w));
        const c = fn((acc + al) / tot, w, x, y);
        if (!c) continue;
        lset(x, y, c[0], c[1], c[2], nx * w, ny * w, nz, z0 + r * nz);
      }
      acc += l;
    }
  }
  function lline(x0, y0, x1, y1, fn, z) {
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) + 1;
    for (let k = 0; k <= n; k++) { const s = k / n, x = lerp(x0, x1, s), y = lerp(y0, y1, s), c = fn(s, x, y); if (c) lset(x, y, c[0], c[1], c[2], 0, -0.3, 1, z); }
  }
  // finish a layer: ambient occlusion, cast shadow from the light above, and the baked light
  function bakeLayer(L, opts) {
    const w = L.w, h = L.h, AO = new Float32Array(L.n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!L.M[i]) continue;
      const z = L.Z[i];
      let occ = 0;
      for (let k = 1; k <= 4; k++) {
        for (const [dx, dy] of [[k, 0], [-k, 0], [0, k], [0, -k]]) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (L.M[j]) occ += Math.max(0, L.Z[j] - z - k * 0.4) / (k + 1);
        }
      }
      // shadow: something taller above (light comes from above and a little toward us)
      let sh = 0;
      for (let k = 1; k <= 26; k++) {
        const yy = y - k; if (yy < 0) break;
        const j = yy * w + x;
        if (L.M[j] && L.Z[j] > z + 1.5 + k * 0.55) { sh = Math.max(sh, 1 - k / 30); }
      }
      AO[i] = clamp(1 - occ * (opts && opts.ao ? opts.ao : 0.06), 0.18, 1) * (1 - 0.55 * sh);
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!L.M[i]) continue;
      const yw = layerWorldY(L, y), o = yIdx(yw);
      const nx = L.N[i * 3], ny = L.N[i * 3 + 1], nz = L.N[i * 3 + 2];
      const dif = (0.3 + 0.7 * clamp(-ny * 0.75 + nz * 0.5 - nx * 0.12, 0, 1)) * AO[i];
      const fog = L.F[i], ar = L.A[i * 3], ag = L.A[i * 3 + 1], ab = L.A[i * 3 + 2];
      const amb = opts && opts.amb !== undefined ? opts.amb : 1;
      const fl0 = opts && opts.fill ? opts.fill : null;
      L.BASE[i * 3] = ar * AMT[o] * 255 * dif * amb * (1 - fog);
      L.BASE[i * 3 + 1] = ag * AMT[o + 1] * 255 * dif * amb * (1 - fog);
      L.BASE[i * 3 + 2] = ab * AMT[o + 2] * 255 * dif * amb * (1 - fog);
      if (fl0) { L.BASE[i * 3] += ar * fl0[0] * 255 * dif * (1 - fog); L.BASE[i * 3 + 1] += ag * fl0[1] * 255 * dif * (1 - fog); L.BASE[i * 3 + 2] += ab * fl0[2] * 255 * dif * (1 - fog); }
      if (L.CAU) {
        const k = L.CWt[i] * (1 - fog) * (0.4 + 0.6 * AO[i]) * Math.exp(-Math.max(0, yw) / 300) * 255;
        L.CAU[i * 3] = ar * k * 0.9 + 16 * k / 255; L.CAU[i * 3 + 1] = ag * k + 30 * k / 255; L.CAU[i * 3 + 2] = ab * k * 0.95 + 26 * k / 255;
      }
      if (L.BK0) {
        for (let q = 0; q < 2; q++) {
          const V = VLIGHTS[q], BK = q ? L.BK1 : L.BK0;
          const dx = V.x - (x - LM), dy = V.y - y, dz = V.z, d2 = dx * dx + dy * dy + dz * dz, d = Math.sqrt(d2);
          const lam = 0.25 + 0.75 * Math.max(0, (nx * dx + ny * dy + nz * dz) / d);
          const a = lam / (1 + d2 / (V.rad * V.rad)) * (1 - fog) * (0.45 + 0.55 * AO[i]);
          BK[i * 3] = ar * V.r * a; BK[i * 3 + 1] = ag * V.g * a; BK[i * 3 + 2] = ab * V.b * a;
        }
      }
    }
  }
  // which world y a layer row shows when the camera rests at h = CREF (rows are pixels; a layer with p < 1 drifts slower)
  function layerWorldY(L, ly) { return L.p === 1 ? L.y0 + ly : L.wy0 + ly / L.p; }
  // where layer row 0 is on screen right now
  function layerTop(L) { return L.p === 1 ? L.y0 - CH + 225 : 225 + L.p * (L.y0 - CH); }
  // composite a layer onto the frame
  function drawLayer(L, fn) {
    const top = Math.round(layerTop(L)), sx = Math.round(LM + CX * L.p);
    const y0 = Math.max(0, top), y1 = Math.min(H, top + L.h);
    for (let y = y0; y < y1; y++) {
      const ly = y - top, row = ly * L.w;
      for (let x = 0; x < W; x++) {
        const li = row + x + sx;
        if (!L.M[li]) continue;
        const j = (y * W + x) * 3, k = li * 3;
        fn(j, k, li, x, y);
      }
    }
  }

  /* ================================================================ the reef */
  const REEF_Y0 = 40, REEF_H = 1160;
  let REEF = null, BOMMIE = null;
  function reefEdge(wy) {   // left edge of the reef wall at world y
    let e = 238 + 46 * (fbm(wy / 80, 3.3, 11, 3) - 0.5) + 14 * (fbm(wy / 23, 7.1, 12, 2) - 0.5);
    // ledges that jut out, flat-topped, curving back underneath
    for (const L of [[262, 168, 46], [560, 196, 34], [858, 214, 28]]) {
      const u = (wy - L[0]) / L[2];
      if (u >= 0 && u <= 1) e = Math.min(e, lerp(L[1], e, u * u));
    }
    return e + 26 * sstep(900, 1180, wy);
  }
  function reefCrest(wx) { return 132 + 10 * (fbm(wx / 40, 1.1, 13, 3) - 0.5) - 10 * sstep(250, 380, wx); }
  const ALB = {
    stone: [0.56, 0.52, 0.44], pink: [0.86, 0.5, 0.44], mauve: [0.6, 0.32, 0.42], olive: [0.42, 0.48, 0.26], ochre: [0.78, 0.6, 0.34],
    sand: [0.9, 0.84, 0.64], violet: [0.46, 0.32, 0.66], orange: [0.96, 0.56, 0.26], cream: [0.92, 0.88, 0.74], dark: [0.2, 0.2, 0.22],
    green: [0.36, 0.56, 0.3], teal: [0.3, 0.6, 0.6], red: [0.82, 0.24, 0.28], yellow: [0.94, 0.8, 0.3],
  };
  const mixA = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
  function rockAlbedo(wx, wy, z) {
    const n1 = fbm(wx / 26, wy / 21, 41, 3), n2 = fbm(wx / 9, wy / 8, 42, 2), n3 = fbm(wx / 14 + 9, wy / 12, 43, 3);
    let c = mixA(ALB.stone, ALB.ochre, n2 * 0.6);
    if (n1 > 0.58) c = mixA(c, ALB.pink, clamp((n1 - 0.58) * 6, 0, 0.85));
    else if (n1 < 0.36) c = mixA(c, ALB.olive, clamp((0.36 - n1) * 6, 0, 0.8));
    if (n3 > 0.66) c = mixA(c, ALB.mauve, 0.7);
    if (n3 < 0.24 && n2 > 0.5) c = mixA(c, ALB.violet, 0.6);
    const sp = ih(fl(wx), fl(wy), 44);
    if (sp < 0.05) c = mixA(c, ALB.cream, 0.35);
    else if (sp > 0.985) c = mixA(c, ALB.orange, 0.7);
    const k = 0.75 + 0.03 * z;
    return [c[0] * k, c[1] * k, c[2] * k];
  }
  function rockZ(wx, wy) { return 8 + 12 * fbm(wx / 30, wy / 24, 45, 3) + 5 * fbm(wx / 8, wy / 7, 46, 2) + 3 * vn2(wx / 3, wy / 3, 47); }
  function paintRock(L, inside) {
    const Zt = new Float32Array(L.n);
    for (let ly = 0; ly < L.h; ly++) for (let lx = 0; lx < L.w; lx++) {
      const wx = lx - LM, wy = layerWorldY(L, ly), d = inside(wx, wy);
      if (d <= 0) continue;
      Zt[ly * L.w + lx] = rockZ(wx, wy) - 16 * Math.pow(1 - Math.min(1, d / 14), 2);
    }
    for (let ly = 0; ly < L.h; ly++) for (let lx = 0; lx < L.w; lx++) {
      const i = ly * L.w + lx, wx = lx - LM, wy = layerWorldY(L, ly);
      if (inside(wx, wy) <= 0) continue;
      const z = Zt[i], zx = (Zt[i + 1] || z) - (Zt[i - 1] || z), zy = (Zt[i + L.w] || z) - (Zt[i - L.w] || z);
      const c = rockAlbedo(wx, wy, z);
      PID = 1;
      lset(lx, ly, c[0], c[1], c[2], -zx * 0.45, -zy * 0.45, 1, z);
    }
  }
  // a reef mass built from overlapping rounded lumps: each pixel belongs to the tallest lump over it
  function paintLumps(L, lumps, R, albedoFn) {
    const ZB = new Float32Array(L.n).fill(-1), NB = new Float32Array(L.n * 2), OWN = new Int32Array(L.n).fill(-1);
    for (let bi = 0; bi < lumps.length; bi++) {
      const b = lumps[bi];
      const [cx, cy, rx, ry, zc] = b;
      for (let y = Math.max(0, fl(cy - ry)); y <= Math.min(L.h - 1, cy + ry); y++) for (let x = Math.max(0, fl(cx - rx)); x <= Math.min(L.w - 1, cx + rx); x++) {
        // lumpy outline: the radius breathes with angle
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, a = Math.atan2(dy, dx);
        const wob = 1 + 0.13 * Math.sin(a * 3 + cx) + 0.08 * Math.sin(a * 7 + cy) + 0.1 * (vn2(x / 5, y / 5, 63) - 0.5);
        const d = (dx * dx + dy * dy) / (wob * wob);
        if (d >= 1) continue;
        const nz = Math.sqrt(1 - d), z = zc + Math.min(rx, ry) * 0.7 * nz;
        const i = y * L.w + x;
        if (z > ZB[i]) { ZB[i] = z; NB[i * 2] = dx / wob; NB[i * 2 + 1] = dy / wob; OWN[i] = bi; }
      }
    }
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const i = y * L.w + x;
      if (ZB[i] < 0) continue;
      const wx = x - LM, wy = layerWorldY(L, y), z = ZB[i];
      const nn = 0.25 * (vn2(wx / 3, wy / 3, 64) - 0.5), nm = 0.25 * (vn2(wx / 3 + 9, wy / 3, 65) - 0.5);
      let c = albedoFn(wx, wy, z);
      // a crevice where a taller neighbouring lump overlaps this one: a dark seam, a lighter lip above it
      let crev = 0;
      for (const d of [-1, 1, -L.w, L.w]) { const j = i + d; if (j >= 0 && j < L.n && OWN[j] >= 0 && OWN[j] !== OWN[i] && ZB[j] > z + 0.5) crev = Math.max(crev, d === L.w ? 1 : 0.75); }
      if (crev) c = [c[0] * (1 - 0.6 * crev), c[1] * (1 - 0.6 * crev), c[2] * (1 - 0.55 * crev)];
      else if (y > 0 && OWN[i - L.w] !== OWN[i] && NB[i * 2 + 1] < -0.3) c = [c[0] * 1.18, c[1] * 1.18, c[2] * 1.15];
      PID = 1;
      lset(x, y, c[0], c[1], c[2], NB[i * 2] * 0.85 + nn, NB[i * 2 + 1] * 0.85 + nm, 0.75, z);
    }
  }
  function paintReef() {
    REEF = makeLayer(REEF_H, 1, REEF_Y0, { caus: true });
    LAY = REEF;
    const L = REEF, ly = (wy) => wy - REEF_Y0, lx = (wx) => wx + LM;
    const R = mulberry32(77);
    // the body: big lumps along the edge, smaller ones on the face, a deep fill behind
    const lumps = [];
    for (let wy = REEF_Y0 + 60; wy < REEF_Y0 + REEF_H + 40; wy += 9 + R() * 8) {
      const e = reefEdge(wy), c = reefCrest(e + 20);
      if (wy < c + 8) continue;
      const rx = 16 + R() * 26, ry = 12 + R() * 18;
      lumps.push([lx(e + rx * 0.75), ly(wy), rx, ry, 4 + R() * 4]);
    }
    for (let k = 0; k < 700; k++) {
      const wy = REEF_Y0 + 70 + R() * (REEF_H - 30), e = reefEdge(wy), wx = e + 10 + R() * (W + LM - e);
      if (wy < reefCrest(wx) + 10) continue;
      const r = 7 + R() * 20;
      lumps.push([lx(wx), ly(wy), r * (1 + R() * 0.5), r, R() * 3]);
    }
    for (let wx = 160; wx < W + LM + 20; wx += 14) { const c = reefCrest(wx); if (wx > reefEdge(c + 12) + 6) lumps.push([lx(wx), ly(c + 16), 16, 14, 3]); }
    // fill so no water shows through the middle of the wall
    for (let wy = REEF_Y0 + 80; wy < REEF_Y0 + REEF_H + 30; wy += 16) for (let wx = reefEdge(wy) + 40; wx < W + LM + 30; wx += 22) lumps.push([lx(wx), ly(wy), 20, 16, -3]);
    lumps.sort((a, b) => a[4] - b[4]);
    paintLumps(L, lumps.filter((b) => b[1] - b[3] > ly(reefCrest(b[0] - LM)) - 6 || true), R, rockAlbedo);
    // clip anything poking above the crest line (the sand shelf lies there)
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) { const wx = x - LM, wy = y + REEF_Y0; if (wy < reefCrest(wx) - 1 || wx < reefEdge(wy) - 26) L.M[y * L.w + x] = 0; }
    // the sand shelf along the crest, rippled, catching the most light
    for (let wx = -LM; wx < W + LM; wx++) {
      const c = reefCrest(wx), e = reefEdge(c + 6);
      if (wx < e - 6) continue;
      for (let d = -2; d < 8; d++) {
        const wy = c + d;
        if (d < 0 && ih(wx, d, 48) > 0.55 + d * 0.15) continue;
        const rip = Math.sin(wx * 0.55 + Math.sin(wx * 0.09) * 2.5) * 0.5 + 0.5;
        const k = d > 4 ? 0.8 - (d - 4) * 0.06 : 1;
        const sd = mixA(ALB.sand, ALB.ochre, (1 - rip) * 0.35 + d * 0.03);
        lset(lx(wx), ly(wy), sd[0] * k, sd[1] * k, sd[2] * k, 0, -0.9 + (rip - 0.5) * 0.5, 0.45, 20, 1);
      }
    }
    // sand on the ledge tops
    for (const Lg of [[262, 168], [560, 196], [858, 214]]) {
      for (let wx = Lg[1] - 2; wx < reefEdge(Lg[0] + 30) + 40; wx++) for (let d = 0; d < 4; d++) {
        if (ih(wx, d, 49) > 1 - d * 0.22 || !lmask(lx(wx), ly(Lg[0] + d + 2))) continue;
        const sd = mixA(ALB.sand, ALB.stone, d * 0.18);
        lset(lx(wx), ly(Lg[0] + d - 1), sd[0], sd[1], sd[2], 0, -1, 0.3, 22, 1);
      }
    }
    // the crest garden, standing up into the light
    seafan(L, lx(258), ly(reefCrest(258) + 1), 40, R, ALB.violet);
    staghorn(L, lx(226), ly(reefCrest(226) + 3), 32, 1.0, R, ALB.ochre);
    braincoral(L, lx(288), ly(reefCrest(288) - 5), 25, 16, R);
    tablecoral(L, lx(334), ly(reefCrest(334) - 24), 36, R);
    staghorn(L, lx(362), ly(reefCrest(362) + 2), 24, 0.8, R, ALB.cream);
    sponges(L, lx(312), ly(reefCrest(312) + 2), R, ALB.orange, 3);
    softcorals(L, lx(246), ly(reefCrest(246) - 1), R, ALB.pink);
    softcorals(L, lx(374), ly(reefCrest(374) - 1), R, ALB.yellow);
    braincoral(L, lx(206), ly(reefCrest(206) - 1), 12, 8, R);
    anemone(L, lx(300), ly(reefCrest(300) + 1), 9, R);
    // dense growth down the wall: packed, thinning and losing the reef-builders with depth
    const spots = [];
    for (let k = 0; k < 6000 && spots.length < 260; k++) {
      const wy = 150 + R() * 1000 * Math.pow(R(), 0.65), e = reefEdge(wy);
      const edgey = R() < 0.4;
      const wx = edgey ? e - 4 + R() * 16 : e + 6 + R() * (W + LM - e - 8);
      const sz = edgey ? 9 + R() * 14 : 6 + R() * 12;
      if (wy < reefCrest(wx) + 6 || spots.some((q) => Math.hypot(q[0] - wx, q[1] - wy) < (q[2] + sz) * 0.62)) continue;
      spots.push([wx, wy, sz, edgey]);
    }
    spots.sort((a, b) => a[1] - b[1]);
    for (const [wx, wy, sz, edgey] of spots) {
      const u = R(), deep = sstep(300, 900, wy);
      if (edgey && u < 0.45) { seafan(L, lx(wx), ly(wy), sz * 1.8, R, [ALB.violet, ALB.red, ALB.orange][fl(R() * 3)], -1); continue; }
      if (u < 0.2 - 0.12 * deep) braincoral(L, lx(wx), ly(wy), sz, sz * 0.66, R);
      else if (u < 0.3 - 0.06 * deep) tablecoral(L, lx(wx), ly(wy), sz * 1.4, R);
      else if (u < 0.45) sponges(L, lx(wx), ly(wy), R, [ALB.violet, ALB.pink, ALB.yellow, ALB.violet][fl(R() * 4)], 2 + fl(R() * 3));
      else if (u < 0.58) seafan(L, lx(wx), ly(wy), sz * 1.5, R, R() < 0.6 ? ALB.violet : ALB.red);
      else if (u < 0.78) softcorals(L, lx(wx), ly(wy), R, [ALB.pink, ALB.yellow, ALB.teal, ALB.cream, ALB.violet][fl(R() * 5)]);
      else if (u < 0.88 - 0.2 * deep) staghorn(L, lx(wx), ly(wy), sz * 1.2, 0.7, R, R() < 0.5 ? ALB.ochre : ALB.cream);
      else if (u < 0.94) anemone(L, lx(wx), ly(wy), sz * 0.6, R);
      else whips(L, lx(wx), ly(wy), R);
    }
    // fog: the wall leans away into the blue below the drop-off
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const i = y * L.w + x, wy = y + REEF_Y0;
      L.F[i] = 0.05 + 0.95 * sstep(520, 1190, wy + 60 * (fbm(x / 40, wy / 60, 50, 2) - 0.5));
    }
    bakeLayer(L);

    // a far reef pinnacle to the left, hazy, fading out downward
    BOMMIE = makeLayer(700, 0.62, 0, { caus: true });
    BOMMIE.wy0 = 150; BOMMIE.y0 = 150;
    LAY = BOMMIE;
    const bx = (wy) => 92 + 34 * (fbm(wy / 60, 2.2, 61, 3) - 0.5) - 26 * sstep(140, 420, wy) + 30 * sstep(500, 1300, wy);
    const bl = [];
    for (let k = 0; k < 120; k++) {
      const yy = 30 + R() * 660, wy = layerWorldY(BOMMIE, yy), e = bx(wy);
      const r = 10 + R() * 22;
      bl.push([LM + e - r * 0.6 - R() * 40, yy, r, r * 0.8, R() * 3]);
    }
    for (let yy = 40; yy < 700; yy += 18) bl.push([LM - 10, yy, 50, 20, -2]);
    paintLumps(BOMMIE, bl, R, rockAlbedo);
    for (let y = 0; y < BOMMIE.h; y++) for (let x = 0; x < BOMMIE.w; x++) if (layerWorldY(BOMMIE, y) < 196 + 34 * (fbm(x / 14, 0, 66, 3) - 0.5) + 10 * Math.sin(x / 9) - (x - LM) * 0.2) BOMMIE.M[y * BOMMIE.w + x] = 0;
    for (let k = 0; k < 40; k++) {
      const ly2 = 30 + R() * 420, wy = layerWorldY(BOMMIE, ly2), wx = bx(wy) - 4 - R() * 50;
      if (wx < -10 || !lmask(fl(wx + LM), fl(ly2 + 2))) continue;
      const u = R();
      if (u < 0.35) braincoral(BOMMIE, wx + LM, ly2, 6 + R() * 7, 4 + R() * 4, R);
      else if (u < 0.7) seafan(BOMMIE, wx + LM, ly2, 12 + R() * 14, R, ALB.violet);
      else softcorals(BOMMIE, wx + LM, ly2, R, ALB.pink);
    }
    for (let i = 0; i < BOMMIE.n; i++) { const yy = fl(i / BOMMIE.w); BOMMIE.F[i] = 0.56 + 0.44 * sstep(60, 560, yy); }
    bakeLayer(BOMMIE);
  }
  function anemone(L, cx, cy, r, R) {
    PID++;
    const col = R() < 0.5 ? ALB.pink : ALB.cream;
    for (let k = 0; k < 26; k++) {
      const a = -Math.PI + (k / 25) * Math.PI + (R() - 0.5) * 0.2, len = r * (0.8 + R() * 0.5);
      const pts = [[cx, cy], [cx + Math.cos(a) * len * 0.5, cy + Math.sin(a) * len * 0.6], [cx + Math.cos(a) * len, cy + Math.sin(a) * len * 0.9 - 1]];
      ltube(pts, 0.9, 0.6, 26, (s) => (s > 0.8 ? mixA(col, [1, 1, 1], 0.5) : col));
    }
    ldome(cx, cy + 1, r * 0.5, 2.5, 25, 2, () => mixA(ALB.red, ALB.dark, 0.2));
  }
  function braincoral(L, cx, cy, rx, ry, R) {
    PID++;
    const s = R() * 100, base = R() < 0.5 ? ALB.ochre : ALB.olive, light = R() < 0.5 ? ALB.cream : ALB.yellow;
    ldome(cx, cy, rx, ry, L.Z[clamp(fl(cy), 0, L.h - 1) * L.w + clamp(fl(cx), 0, L.w - 1)] + 2, ry * 0.9, (u, v, x, y) => {
      // meandering ridges: the level sets of a warped noise
      const wq = fbm(x / 7 + s, y / 7, 70, 3), m = Math.sin((wq * 9 + fbm(x / 3, y / 3, 71, 2) * 1.2) * TAU * 0.5);
      if (m > 0.55) return mixA(light, base, 0.25);
      if (m < -0.55) return mixA(base, ALB.dark, 0.45);
      return base;
    }, 0.86);
  }
  function tablecoral(L, cx, cy, rw, R) {
    PID++;
    const col = R() < 0.5 ? ALB.olive : mixA(ALB.ochre, ALB.teal, 0.3);
    // the stalk
    ltube([[cx, cy + 14], [cx + 1, cy]], 3.2, 2.2, 14, () => mixA(col, ALB.dark, 0.3));
    // a flat plate seen nearly edge-on: a lit top with the rim of tips, a dark underside
    for (let y = fl(cy - 5); y <= cy + 3; y++) for (let x = fl(cx - rw); x <= cx + rw; x++) {
      const u = (x - cx) / rw, edge = 1 - u * u;
      const top = cy - 1 - 3.2 * Math.sqrt(Math.max(0, edge)), bot = cy + 1.5 + 0.8 * u * u;
      if (y < top || y > bot || Math.abs(u) > 1) continue;
      const v = (y - top) / Math.max(1, bot - top);
      let c, ny;
      if (v < 0.5) { c = mixA(col, ALB.cream, 0.35 + 0.3 * (ih(x, y, 72) > 0.6 ? 1 : 0)); ny = -1; }
      else { c = mixA(col, ALB.dark, 0.35); ny = 0.8; }
      lset(x, y, c[0], c[1], c[2], u * 0.3, ny, 0.5, 28, v < 0.5 ? 1 : 0.05);
    }
    // tips along the rim
    for (let x = fl(cx - rw); x <= cx + rw; x += 2) { const u = (x - cx) / rw, top = cy - 1 - 3.2 * Math.sqrt(Math.max(0, 1 - u * u)); if (ih(x, cy, 73) < 0.6) lset(x, top - 1, ALB.cream[0], ALB.cream[1], ALB.cream[2], 0, -1, 0.4, 29, 1); }
  }
  function staghorn(L, bx2, by, size, spread, R, col) {
    PID++;
    const branches = [];
    const grow = (x, y, ang, len, r, depth) => {
      const pts = [[x, y]]; let a = ang;
      for (let k = 0; k < 4; k++) { a += (R() - 0.5) * 0.35; x += Math.cos(a) * len / 4; y += Math.sin(a) * len / 4; pts.push([x, y]); }
      branches.push([pts, r]);
      if (depth > 0) { grow(pts[2][0], pts[2][1], a - 0.5 * spread - R() * 0.3, len * 0.62, r * 0.75, depth - 1); if (R() < 0.7) grow(pts[3][0], pts[3][1], a + 0.45 * spread + R() * 0.3, len * 0.5, r * 0.7, depth - 1); }
    };
    for (let k = 0; k < 4; k++) grow(bx2 + (R() - 0.5) * 8, by, -Math.PI / 2 + (k - 1.5) * 0.5 * spread + (R() - 0.5) * 0.3, size * (0.7 + 0.4 * R()), 2.3, 2);
    for (const [pts, r] of branches) ltube(pts, r, Math.max(0.9, r * 0.6), 24, (s) => s > 0.82 ? mixA(ALB.cream, [0.75, 0.85, 0.95], 0.4) : mixA(col, ALB.cream, s * 0.5));
  }
  function seafan(L, bx2, by, size, R, col, dir) {
    PID++;
    // a gorgonian: a trunk splitting into a fan of fine branches joined by a lace of cross-links
    const tips = [];
    const grow = (x, y, ang, len, depth) => {
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      lline(x, y, x2, y2, () => mixA(col, ALB.dark, 0.15), 30);
      if (depth > 0) { grow(x2, y2, ang - 0.28 - R() * 0.2, len * 0.78, depth - 1); grow(x2, y2, ang + 0.28 + R() * 0.2, len * 0.78, depth - 1); }
      else tips.push([x2, y2]);
    };
    const lean = (R() - 0.5) * 0.5 + (dir ? dir * 0.9 : 0);
    grow(bx2, by, -Math.PI / 2 + lean, size * 0.28, 4);
    for (let k = 0; k < 90; k++) {
      const a = tips[fl(R() * tips.length)], b = tips[fl(R() * tips.length)];
      if (!a || !b || Math.hypot(a[0] - b[0], a[1] - b[1]) > size * 0.3) continue;
      const s = 0.3 + R() * 0.6;
      lline(lerp(bx2, a[0], s), lerp(by, a[1], s), lerp(bx2, b[0], s), lerp(by, b[1], s), () => mixA(col, ALB.pink, 0.2), 30);
    }
  }
  function sponges(L, bx2, by, R, col, n) {
    PID++;
    for (let k = 0; k < n; k++) {
      const x = bx2 + (k - (n - 1) / 2) * 5 + (R() - 0.5) * 3, h = 8 + R() * 13, r = 1.8 + R() * 1.2, lean = (R() - 0.5) * 7;
      const pts = [[x, by], [x + lean * 0.3, by - h * 0.35], [x + lean * 0.7, by - h * 0.7], [x + lean, by - h]];
      ltube(pts, r * 0.8, r * 1.25, 26, (s, w) => {
        const rings = Math.sin(s * h * 1.3) > 0.6 ? 0.12 : 0;
        return mixA(mixA(col, ALB.cream, 0.15 + 0.25 * s), ALB.dark, (1 - s) * 0.18 + rings);
      });
      // the lip and the dark mouth
      const tx = x + lean, ty = by - h;
      for (let dx = -Math.ceil(r * 1.25); dx <= Math.ceil(r * 1.25); dx++) {
        const u = dx / (r * 1.25 + 0.5);
        lset(tx + dx, ty - 1, col[0], col[1], col[2], 0, -0.6, 0.6, 40, 0.6);
        if (Math.abs(u) < 0.5) lset(tx + dx, ty, col[0] * 0.35, col[1] * 0.3, col[2] * 0.35, 0, -0.5, 0.4, 40, 0);
      }
    }
  }
  function softcorals(L, bx2, by, R, col) {
    PID++;
    for (let k = 0; k < 16; k++) {
      const x = bx2 + (R() - 0.5) * 18, y = by - R() * 9, r = 1.3 + R() * 1.8;
      ldome(x, y, r, r, 30, r, (u, v) => (v < -0.3 ? mixA(col, ALB.cream, 0.45) : v > 0.4 ? mixA(col, ALB.dark, 0.3) : col));
    }
  }
  function whips(L, bx2, by, R) {
    PID++;
    for (let k = 0; k < 4; k++) {
      let x = bx2, y = by, a = -Math.PI / 2 - 0.5 + R();
      const len = 18 + R() * 26, col = R() < 0.5 ? ALB.yellow : ALB.red;
      for (let s = 0; s < len; s++) { a += (R() - 0.5) * 0.12 - 0.01; x += Math.cos(a); y += Math.sin(a); lset(x, y, col[0], col[1], col[2], 0, -0.3, 1, 30); }
    }
  }
  function drawReef(t) {
    if (CH > 1500) return;
    // on the fast ride up the wall streams past as a soft wash, not a strobe
    const keep = 1 - 0.92 * Math.pow(clamp((Math.abs(CV) - 200) / 500, 0, 1), 0.7);
    if (keep < 0.02) return;
    if (BOMMIE && layerTop(BOMMIE) < H && layerTop(BOMMIE) + BOMMIE.h > 0) {
      const B = BOMMIE;
      drawLayer(B, (j, k, li, x, y) => {
        const f = 1 - (1 - B.F[li]) * keep, c = (B.CAU[k + 1] > 0.5) ? causGrid(x, y) * 0.6 : 0;
        C[j] = (B.BASE[k] + B.CAU[k] * c) * keep + f * C[j]; C[j + 1] = (B.BASE[k + 1] + B.CAU[k + 1] * c) * keep + f * C[j + 1]; C[j + 2] = (B.BASE[k + 2] + B.CAU[k + 2] * c) * keep + f * C[j + 2];
      });
    }
    const top = layerTop(REEF);
    if (top > H || top + REEF.h < 0) return;
    const L = REEF, M = L.M, F = L.F, BA = L.BASE, CA = L.CAU, sx = Math.round(LM + CX);
    const tp = Math.round(top), y0 = Math.max(0, tp), y1 = Math.min(H, tp + L.h);
    for (let y = y0; y < y1; y++) {
      const row = (y - tp) * L.w + sx;
      for (let x = 0; x < W; x++) {
        const li = row + x;
        if (!M[li]) continue;
        const j = (y * W + x) * 3, k = li * 3, f = 1 - (1 - F[li]) * keep, c = CA[k + 1] > 0.5 ? causGrid(x, y) : 0;
        C[j] = (BA[k] + CA[k] * c) * keep + f * C[j]; C[j + 1] = (BA[k + 1] + CA[k + 1] * c) * keep + f * C[j + 1]; C[j + 2] = (BA[k + 2] + CA[k + 2] * c) * keep + f * C[j + 2];
      }
    }
  }
  // caustics on things in the world, computed on a 2-pixel grid, row by row as needed, and interpolated
  const GSZ = 3, GW = fl(W / GSZ) + 2, GH = fl(H / GSZ) + 2, CGW = new Float32Array(GW * GH), CGS = new Int32Array(GW * GH);
  let CGST = 1;
  const cg = (o, gx, gy) => { if (CGS[o] !== CGST) { CGS[o] = CGST; CGW[o] = causAt(gx * GSZ + CX, (gy * GSZ + CH - 225) * 1.35, 30); } return CGW[o]; };
  const G3 = [0, 1 / 3, 2 / 3];
  function causGrid(x, y) {
    const gx = (x / GSZ) | 0, gy = (y / GSZ) | 0, o = gy * GW + gx;
    cg(o, gx, gy); cg(o + 1, gx + 1, gy); cg(o + GW, gx, gy + 1); cg(o + GW + 1, gx + 1, gy + 1);
    const fx = G3[x - gx * GSZ], fy = G3[y - gy * GSZ];
    return (CGW[o] * (1 - fx) + CGW[o + 1] * fx) * (1 - fy) + (CGW[o + GW] * (1 - fx) + CGW[o + GW + 1] * fx) * fy;
  }
  /* ================================================================ sprites: lit pixels with selective outlines */
  const SA = new Float32Array(NP * 8);
  function sprBegin() { mapBegin(); }
  // albedo r g b (0..1), normal, emissive (added light), stored for the outline pass
  function sput(x, y, r, g, b, nx, ny, nz, em) {
    x = fl(x); y = fl(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    mark(x, y, 0, 0);
    const k = (y * W + x) * 8;
    SA[k] = r; SA[k + 1] = g; SA[k + 2] = b; SA[k + 3] = nx; SA[k + 4] = ny; SA[k + 5] = nz; SA[k + 6] = em || 0;
  }
  // outline: the lower and back edges darken, the upper edge catches a rim of light
  function sprEnd(fog, alpha, dark, rim) {
    mapEnd((x, y, s, v, e) => {
      const k = (y * W + x) * 8;
      let r = SA[k], g = SA[k + 1], b = SA[k + 2], em = SA[k + 6];
      if (e) {
        if ((e & 2) || (e & 8 && !(e & 1))) { const q = dark === undefined ? 0.55 : dark; r *= q; g *= q; b *= q; }
        else if (e & 1) { const q = rim === undefined ? 1.25 : rim; r *= q; g *= q; b *= q; }
      }
      lightPx(x, y, r, g, b, SA[k + 3], SA[k + 4], SA[k + 5], fog, alpha === undefined ? 1 : alpha, em * (0.35 + 0.65 * SA[k]), em * (0.35 + 0.65 * SA[k + 1]), em * (0.35 + 0.65 * SA[k + 2]));
    });
  }

  /* ================================================================ fish */
  // a fish seen from the side along screen heading (hx, hy): len, height in px; scheme gives colours
  const SCH = {
    silver: { back: [0.3, 0.42, 0.56], flank: [0.84, 0.9, 0.95], belly: [1, 1, 1], line: [0.5, 0.6, 0.72], fin: [0.62, 0.7, 0.78] },
    anthias: { back: [0.95, 0.45, 0.32], flank: [0.98, 0.58, 0.42], belly: [0.98, 0.8, 0.6], line: [0.85, 0.3, 0.5], fin: [0.95, 0.4, 0.55] },
    damsel: { back: [0.3, 0.4, 0.8], flank: [0.4, 0.6, 0.95], belly: [0.7, 0.85, 0.95], line: [0.2, 0.3, 0.7], fin: [0.95, 0.85, 0.3] },
  };
  function drawFish(cx, cy, hx, hy, len, ht, sc, fog, glint, wag, alpha) {
    const hl = Math.hypot(hx, hy) || 1; hx /= hl; hy /= hl;
    const nx = -hy, ny = hx;              // perpendicular; flip so "up" on the fish is up on screen
    const up = ny > 0 ? -1 : 1;
    if (len < 3.2) {
      const c = sc.flank, gl = glint * 1.6;
      lightPx(cx, cy, c[0], c[1], c[2], 0, -0.3, 1, fog, alpha * 0.9, gl * 60, gl * 70, gl * 74);
      if (len > 2) lightPx(cx - hx * 1.2, cy - hy * 1.2, sc.back[0], sc.back[1], sc.back[2], 0, 0, 1, fog, alpha * 0.7);
      return;
    }
    const ex = Math.abs(hx) * len * 0.62 + Math.abs(nx) * ht * 0.7 + 1.5, ey = Math.abs(hy) * len * 0.62 + Math.abs(ny) * ht * 0.7 + 1.5;
    const quick = len < 9;
    if (!quick) sprBegin();
    for (let y = fl(cy - ey); y <= cy + ey; y++) for (let x = fl(cx - ex); x <= cx + ex; x++) {
      const px = x + 0.5 - cx, py = y + 0.5 - cy;
      const a = px * hx + py * hy;                    // along, + toward the nose
      let s = 0.5 - a / len;                          // 0 nose .. 1 tail
      if (s < 0 || s > 1.08) continue;
      const bend = wag * s * s * len * 0.12;
      const w = (px * nx + py * ny) * up - bend;      // + is up (dorsal)
      let half, tail = false;
      if (s < 0.8) half = ht * 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, (s + 0.04) / 0.86)), 0.75);
      else { tail = true; const q = (s - 0.8) / 0.28; half = ht * (0.1 + 0.5 * q); if (Math.abs(w) < ht * 0.42 * q * q && q > 0.55) continue; }
      if (Math.abs(w) > half) continue;
      const v = w / Math.max(0.5, half);              // +1 top .. -1 belly
      let c;
      const small = ht < 4;
      if (tail) c = sc.fin;
      else if (small) c = v > 0.5 && ht >= 3 ? mixA(sc.back, sc.flank, 0.4) : v < -0.5 ? sc.belly : sc.flank;
      else if (v > 0.45) c = sc.back;
      else if (v > 0.12) c = mixA(sc.back, sc.flank, (0.45 - v) / 0.33);
      else if (v > -0.05 && v < 0.08 && s > 0.2 && s < 0.78) c = sc.line;
      else if (v < -0.55) c = sc.belly;
      else c = sc.flank;
      let em = 0;
      if (!tail && v < 0.5) em = (glint * (0.6 + 0.4 * (1 - Math.abs(v))) * 210 + SILVER * 90);
      // eye
      if (len >= 7 && Math.abs(s - 0.12) < 0.5 / len + 0.02 && Math.abs(v - 0.18) < 0.3) { c = [0.05, 0.05, 0.08]; em = 0; }
      if (quick) { const e = em * AMTlum(), ed = Math.abs(v) > 0.7 ? (v < 0 ? 0.85 : 1.08) : 1; lightPx(x, y, c[0] * ed, c[1] * ed, c[2] * ed, 0, -v * 0.8, 0.6, fog, alpha, e * (0.35 + 0.65 * c[0]), e * (0.35 + 0.65 * c[1]), e * (0.35 + 0.65 * c[2])); }
      else sput(x, y, c[0], c[1], c[2], 0, -v * 0.8, 0.6, em * AMTlum());
    }
    if (!quick) sprEnd(fog, alpha, 0.62, 1.15);
  }
  let AMTL = 1, SILVER = 0;
  const AMTlum = () => AMTL;

  /* ================================================================ the bait ball */
  const SCHOOL = [];
  const SY = 1105, SZ0 = 250, SRAD = 120;
  function buildSchool() {
    const R = mulberry32(4242);
    for (let k = 0; k < 640; k++) {
      // most fish crowd the outer shell of the ball
      const yv = (R() * 2 - 1), rr = SRAD * Math.sqrt(1 - yv * yv * 0.9) * (0.55 + 0.45 * Math.pow(R(), 0.35));
      SCHOOL.push({ r: rr, y: yv * 88, th: R() * TAU, w: (0.5 + 0.35 * R()) * (rr < 90 ? 1.2 : 1), ph: R() * TAU, sz: 0.8 + 0.4 * R(), b: R() });
    }
  }
  function schoolPos(f, t, out) {
    // the ball turns about a vertical axis; each fish weaves on its own, and the whole thing breathes
    const breathe = 1 + 0.08 * Math.sin(per(3, t) + f.ph * 0.3);
    const th = f.th + f.w * t + 0.25 * Math.sin(per(5, t) + f.ph);
    const r = f.r * breathe + 10 * Math.sin(per(7, t) + f.ph * 2);
    let X = 180 + Math.cos(th) * r, Z = SZ0 + Math.sin(th) * r * 0.8, Y = SY + f.y + 12 * Math.sin(per(4, t) + f.ph + th);
    // the school parts around the camera: fish within reach of it are pushed out
    const dx = X - (180 + CX), dy = Y - CH, dz = Z, d = Math.hypot(dx, dy * 1.2, dz);
    const RP = 120;
    if (d < RP) { const k = (RP - d) / d * 0.95; X += dx * k; Y += dy * k * 1.1; Z += dz * k * 0.6; }
    out[0] = X; out[1] = Y; out[2] = Z; out[3] = th;
  }
  function drawSchool(t) {
    if (Math.abs(CH - SY) > 720) return;
    const list = [], a = [0, 0, 0, 0], b = [0, 0, 0, 0];
    const F0 = SZ0;
    for (const f of SCHOOL) {
      schoolPos(f, t, a); schoolPos(f, t + 0.05, b);
      if (a[2] < 22) continue;
      const sc = F0 / a[2], scb = F0 / b[2];
      const sx = 180 + (a[0] - 180 - CX) * sc, sy = 225 + (a[1] - CH) * sc;
      if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) continue;
      // heading on screen from where it will be a moment later
      const sx2 = 180 + (b[0] - 180 - CX) * scb, sy2 = 225 + (b[1] - CH) * scb;
      let hx = sx2 - sx, hy = sy2 - sy;
      const vx = b[0] - a[0], vy = b[1] - a[1], vz = b[2] - a[2], v3 = Math.hypot(vx, vy, vz) || 1;
      // how much of the flank faces us: sideways swimmers show it, those heading at us are end-on
      const side = Math.sqrt(Math.max(0, 1 - (vz / v3) * (vz / v3)));
      if (Math.hypot(hx, hy) < 1e-4) { hx = 1; hy = 0; }
      list.push([a[2], sx, sy, hx, hy, sc, side, f]);
    }
    list.sort((p, q) => q[0] - p[0]);
    const o = yIdx(SY); AMTL = (AMT[o] + AMT[o + 1] + AMT[o + 2]) / 3;
    for (const [z, sx, sy, hx, hy, sc, side, f] of list) {
      const len = (10 * f.sz) * sc * (0.3 + 0.7 * side), ht = 3.3 * f.sz * sc;
      // silver flashes ripple through the school as the fish turn their flanks to the light
      const turn = Math.sin(f.th * 3 + per(6, t) + f.b * 2 + sy * 0.03);
      const glint = side * Math.pow(Math.max(0, turn), 6) * 1.2 + 0.12 * side;
      const fog = clamp(1 - Math.exp(-z / 520), 0, 0.8);
      const wag = Math.sin(t * 14 + f.ph * 7);
      SILVER = side;
      drawFish(sx, sy, hx, hy, len, Math.min(ht, len * 0.5 + 1), SCH.silver, fog * 0.8, glint, wag, 1);
      SILVER = 0;
    }
  }

  /* ================================================================ reef fish */
  const REEFFISH = [];
  function buildReefFish() {
    const R = mulberry32(5150);
    for (let k = 0; k < 22; k++) {
      const wy = 120 + Math.pow(R(), 1.6) * 520;
      const e = reefEdge(wy);
      REEFFISH.push({ x: e - 14 - R() * 50, y: wy - 4 - R() * 18, ax: 6 + R() * 14, ay: 2 + R() * 5, k: 1 + fl(R() * 3), ph: R() * TAU, sz: 6 + R() * 3, sc: R() < 0.7 ? SCH.anthias : SCH.damsel });
    }
  }
  function drawReefFish(t) {
    if (CH > 1100) return;
    for (const f of REEFFISH) {
      const a = per(f.k, t) + f.ph;
      const x = f.x + f.ax * Math.sin(a) - CX, y = f.y + f.ay * Math.sin(a * 2 + 1) - CH + 225;
      if (y < -10 || y > H + 10) continue;
      const vx = Math.cos(a);
      drawFish(x, y, vx >= 0 ? 1 : -1, 0.1 * Math.cos(a * 2 + 1), f.sz, f.sz * 0.42, f.sc, 0.06, 0.15, Math.sin(t * 16 + f.ph), 1);
    }
  }

  /* ================================================================ the turtle */
  // a green turtle rowing slowly across, heading left and sinking with us a little
  function turtleAt(t) { return [214 - (t - 2.2) * 30, 440 + (t - 2.2) * 95]; }
  let SHELL = null;
  function buildShell(shell, pale) {
    // the carapace's scutes in body coordinates, painted once: tortoiseshell streaks, pale seams
    const seeds = [[-16, -13], [-3, -17], [11, -17], [24, -12], [34, -6], [-25, -5], [-12, -5], [1, -7], [14, -6], [27, -2], [38, 0], [-20, 2], [-6, 2], [8, 2], [21, 3]];
    SHELL = [];
    for (let v = -32; v < 32; v++) for (let u = -40; u < 56; u++) {
      let best = 0, bd = 1e9, sec = 1e9, c;
      for (let k = 0; k < seeds.length; k++) { const d = Math.hypot(u - seeds[k][0], (v - seeds[k][1]) * 1.3); if (d < bd) { sec = bd; bd = d; best = k; } else if (d < sec) sec = d; }
      if (sec - bd < 1.1) c = mixA(pale, shell[2], 0.3);
      else {
        const base = shell[best % shell.length];
        const ang = Math.atan2(v - seeds[best][1] - 6, u - seeds[best][0] - 6);
        const st = Math.sin(ang * 5 + best * 2 + fbm(u / 7, v / 7, 803 + best, 2) * 2.5);
        const edge = clamp((sec - bd - 1) / 3, 0, 1);
        c = st > 0.5 ? mixA(base, [0.95, 0.78, 0.42], 0.5) : st < -0.55 ? mixA(base, [0.3, 0.2, 0.1], 0.55) : base;
        c = mixA([0.3, 0.22, 0.12], c, 0.55 + 0.45 * edge);
      }
      SHELL.push(c);
    }
  }
  function drawTurtle(t) {
    if (t < 2.0 || t > 11.5) return;
    const p = turtleAt(t), cx = p[0] - CX, cy = p[1] - CH + 225;
    if (cx < -120 || cx > W + 120 || cy < -80 || cy > H + 80) return;
    const ts = fl(t * 12) / 12;                       // sprite time: the flippers step at 12 fps
    const stroke = Math.sin(per(10, ts));             // front flipper: -1 up .. +1 down
    const pitch = -0.1 + 0.05 * Math.sin(per(10, ts) - 1.2);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const toS = (u, v) => [cx + u * cp - v * sp, cy + u * sp + v * cp];
    const fog = 0.1;
    const shell = [[0.62, 0.46, 0.24], [0.76, 0.56, 0.28], [0.86, 0.66, 0.34], [0.54, 0.5, 0.28], [0.7, 0.48, 0.26], [0.8, 0.6, 0.3]];
    const skin = [0.66, 0.66, 0.46], scale = [0.5, 0.48, 0.32], pale = [0.96, 0.92, 0.74];
    // flippers are tapered blades from a shoulder, swept by an angle
    const blade = (sx0, sy0, ang, L, Wd, dark, far) => {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      sprBegin();
      const R = L + Wd + 2;
      for (let y = fl(sy0 - R); y <= sy0 + R; y++) for (let x = fl(sx0 - R); x <= sx0 + R; x++) {
        const px = x + 0.5 - sx0, py = y + 0.5 - sy0, a = px * ca + py * sa, w = -px * sa + py * ca;
        if (a < 0 || a > L) continue;
        const s = a / L, half = Wd * (s < 0.25 ? 0.6 + 1.6 * s : 1 - 0.85 * Math.pow((s - 0.25) / 0.75, 1.4)) * (w < 0 ? 1.05 : 0.8);
        if (Math.abs(w) > half) continue;
        // big scales with pale seams along the leading edge, small ones behind
        const q = w / half, cell = vn2(x * 0.5, y * 0.5, 801) > 0.62;
        let c = cell ? pale : (q < -0.5 ? mixA(scale, pale, 0.25) : scale);
        if (s > 0.85) c = mixA(c, pale, 0.3);
        if (dark) c = mixA(c, [0.12, 0.14, 0.12], 0.45);
        sput(x, y, c[0], c[1], c[2], 0, -q * 0.6 - 0.2, 0.7);
      }
      sprEnd(far ? 0.22 : fog, 1, 0.5, 1.1);
    };
    // far front flipper, behind the body
    const fs = toS(-14, 6);
    blade(fs[0] + 3, fs[1] - 2, Math.PI * 0.62 + stroke * 0.75, 42, 7, true, true);
    // rear flipper
    const rs = toS(28, 6);
    blade(rs[0], rs[1], Math.PI * 0.3 + 0.15 * Math.sin(per(10, ts) + 2), 15, 6, false);
    // head and neck
    {
      const hc = toS(-38, 0);
      sprBegin();
      for (let y = fl(hc[1] - 12); y <= hc[1] + 12; y++) for (let x = fl(hc[0] - 16); x <= hc[0] + 18; x++) {
        const px = x + 0.5 - hc[0], py = y + 0.5 - hc[1];
        const u = px * cp + py * sp, v = -px * sp + py * cp;
        // a blunt head, beak forward, neck widening back into the shell
        const head = (u + 2) * (u + 2) / 81 + (v + 1) * (v + 1) / 36 < 1;
        const neck = u > 0 && u < 16 && Math.abs(v - 1) < 4.5 + u * 0.2;
        if (!head && !neck) continue;
        let c = skin;
        if (head) {
          // the head's big scales: pale seams over a dark brown
          const sc2 = vn2(x * 0.7, y * 0.7, 802);
          c = sc2 > 0.6 ? pale : sc2 > 0.45 ? [0.42, 0.32, 0.18] : [0.52, 0.4, 0.22];
          if (v > 2.5) c = mixA(pale, skin, 0.3);
          if (u < -9 && v > -1 && v < 1.2) c = [0.2, 0.18, 0.12];     // the beak line
          // the eye
          if (Math.abs(u + 4) < 1.6 && Math.abs(v + 2) < 1.4) c = (u < -4.2 && v < -2) ? [0.9, 0.9, 0.85] : [0.04, 0.04, 0.05];
        } else c = (fl(u * 0.7 + v * 0.3) & 1) ? skin : mixA(skin, scale, 0.5);
        sput(x, y, c[0], c[1], c[2], 0, v / 6, 0.8);
      }
      sprEnd(fog, 1, 0.5, 1.2);
    }
    // the shell: a dome of scutes, each streaked like tortoiseshell, with pale seams
    {
      sprBegin();
      if (!SHELL) buildShell(shell, pale);
      for (let y = fl(cy - 30); y <= cy + 16; y++) for (let x = fl(cx - 34); x <= cx + 46; x++) {
        const px = x + 0.5 - cx, py = y + 0.5 - cy;
        const u = px * cp + py * sp, v = -px * sp + py * cp;
        const uu = (u - 5) / 39;
        if (Math.abs(uu) > 1) continue;
        const top = -20 * Math.pow(1 - uu * uu, 0.6) + 2, bot = 6 + 1.5 * uu;
        if (v < top || v > bot + 1) continue;
        const vv = (v - top) / (bot - top);
        let c, ny = -0.9 + vv * 1.6;
        if (v > bot - 2) {
          // the rim of marginal scutes and the pale plastron edge
          c = (fl(u / 4) & 1) ? [0.5, 0.42, 0.24] : [0.62, 0.52, 0.3];
          if (v > bot) c = pale;
        } else c = SHELL[clamp(Math.round(v) + 32, 0, 63) * 96 + clamp(Math.round(u) + 40, 0, 95)];
        // caustics dapple the top of the shell
        let em = 0;
        if (vv < 0.6 && x >= 0 && y >= 0 && x < W && y < H) em = causGrid(x, y) * 55 * (1 - vv / 0.6) * Math.exp(-Math.max(0, CH + y - 225) / 500);
        sput(x, y, c[0], c[1], c[2], uu * 0.5, ny, 0.6, em);
      }
      sprEnd(fog, 1, 0.45, 1.3);
    }
    // the near front flipper, in front of everything
    const ns = toS(-16, 4);
    blade(ns[0], ns[1], Math.PI * 0.6 + stroke * 0.85, 46, 7.5, false, false);
  }

  /* ================================================================ deep things: placement by depth layer */
  // a creature at world (X, Y) on a layer with parallax p appears here
  const scrX = (X, p) => 180 + (X - 180) - CX * p;
  const scrY = (Y, p) => 225 + p * (Y - CH);

  /* ================================================================ jellyfish */
  // pulse: a quick contraction then a slow relaxation, period 2 s (16 per loop)
  function pulseAt(t, ph) { const u = fr(t / 2 + ph); return u < 0.28 ? Math.sin(u / 0.28 * Math.PI / 2) : 0.5 + 0.5 * Math.cos((u - 0.28) / 0.72 * Math.PI); }
  const JELLY = {
    stripe: { bell: [0.95, 0.86, 0.74], stripe: [0.62, 0.22, 0.32], inner: [0.6, 0.66, 0.8], arm: [0.96, 0.82, 0.8], tent: [0.8, 0.5, 0.5], glow: [34, 70, 120] },
    helmet: { bell: [0.7, 0.24, 0.34], stripe: [0.4, 0.08, 0.18], inner: [0.5, 0.16, 0.3], arm: [0.85, 0.4, 0.5], tent: [0.7, 0.3, 0.4], glow: [50, 40, 110] },
    moon: { bell: [0.8, 0.86, 0.95], stripe: [0.85, 0.7, 0.9], inner: [0.6, 0.7, 0.9], arm: [0.85, 0.85, 0.95], tent: [0.7, 0.75, 0.9], glow: [36, 80, 130] },
  };
  function drawJelly(cx, cy, s, t, kind, ph, fog, tilt) {
    const J = JELLY[kind], ts = fl(t * 12) / 12;
    const c = pulseAt(ts, ph);
    const tall = kind === 'helmet' ? 1.45 : kind === 'moon' ? 0.55 : 0.85;
    const w = 28 * s * (1 - 0.2 * c), hb = 28 * s * tall * (1 + 0.14 * c);
    const ct = Math.cos(tilt || 0), st = Math.sin(tilt || 0);
    const local = (x, y) => { const dx = x - cx, dy = y - cy; return [dx * ct + dy * st, -dx * st + dy * ct]; };
    const world = (u, v) => [cx + u * ct - v * st, cy + u * st + v * ct];
    // tentacles first, behind the bell: thin lines from the rim, a wave running down them
    const nT = kind === 'moon' ? 26 : 18, Lt = hb * (kind === 'moon' ? 1.2 : 3.4);
    for (let k = 0; k < nT; k++) {
      const u0 = (k / (nT - 1) * 2 - 1) * w * 0.92, len = Lt * (0.7 + 0.3 * ih(k, 1, 901));
      let px = null, py = null;
      for (let q = 0; q <= len; q += 1) {
        const qq = q / len;
        const u = u0 * (1 - 0.35 * qq) + Math.sin(q * 0.09 - per(10, t) + k * 0.7 + ph * 6) * (2 + 7 * s * qq) * qq;
        const v = hb + q;
        const p = world(u, v), x = Math.round(p[0]), y = Math.round(p[1]);
        if (x === px && y === py) continue; px = x; py = y;
        lightPx(x, y, J.tent[0], J.tent[1], J.tent[2], 0, 0, 1, fog, 0.6 * (1 - qq * 0.75), J.glow[0] * 1.1, J.glow[1] * 1.1, J.glow[2] * 1.1);
      }
    }
    // oral arms: frilled ribbons from the middle
    if (kind !== 'moon') {
      const La = hb * (kind === 'helmet' ? 0.9 : 2.7);
      for (let a = 0; a < 4; a++) {
        const u0 = (a - 1.5) * 3 * s;
        for (let q = 0; q <= La; q += 0.7) {
          const qq = q / La, wid = (3.6 - 2.6 * qq) * s + 0.6;
          const u = u0 + Math.sin(q * 0.06 - per(8, t) + a * 1.9 + ph * 5) * (3 + 9 * s) * qq + (a - 1.5) * qq * 6 * s;
          for (let d = -wid; d <= wid; d += 0.8) {
            const fr2 = ih(fl(q), a * 31 + fl(d * 2), 902) < 0.3 + 0.5 * (Math.abs(d) / wid);
            if (Math.abs(d) > wid * 0.6 && fr2) continue;
            const p = world(u + d, hb * 0.82 + q);
            lightPx(p[0], p[1], J.arm[0], J.arm[1], J.arm[2], d / wid * 0.6, 0, 0.8, fog, 0.55 * (1 - qq * 0.55), J.glow[0] * (0.9 + 0.5 * (1 - Math.abs(d) / wid)), J.glow[1] * (0.9 + 0.5 * (1 - Math.abs(d) / wid)), J.glow[2] * (0.9 + 0.5 * (1 - Math.abs(d) / wid)));
          }
        }
      }
    }
    // the bell: thin and clear in the middle, thick and bright at its edge, striped from the crown
    sprBegin();
    const R = Math.max(w, hb) + 4;
    for (let y = fl(cy - R); y <= cy + R + hb; y++) for (let x = fl(cx - R - 2); x <= cx + R + 2; x++) {
      const l = local(x + 0.5, y + 0.5), u = l[0], v = l[1];
      if (v < 0 || v > hb + 2.5) continue;
      const vv = Math.min(1, v / hb);
      let half = kind === 'helmet' ? w * Math.pow(Math.sin(Math.min(1, vv * 1.05) * Math.PI / 2), 0.7) : w * Math.sqrt(Math.max(0, 1 - Math.pow(1 - vv, 2)));
      // the margin: scalloped lappets, flaring when relaxed
      if (v > hb - 1) { const sc = Math.abs(Math.sin(u / w * 8 * Math.PI)); half *= 1 + 0.06 * (1 - c); if (v > hb + 0.5 + 1.5 * sc) continue; }
      if (Math.abs(u) > half) continue;
      const e = 1 - Math.abs(u) / Math.max(1, half);                      // 0 at the edge
      const innerHalf = half * 0.84, inCav = vv > 0.3 && Math.abs(u) < innerHalf && v > hb * 0.36 + (u * u) / (w * w) * hb * 0.1;
      let col = J.bell, al = 0.34 + 0.5 * Math.pow(1 - e, 3) + (vv < 0.15 ? 0.2 : 0);
      const ang = Math.atan2(u, v + hb * 0.5);
      if (kind !== 'moon' && Math.sin(ang * 15) > 0.5 && vv > 0.08) { col = J.stripe; al += 0.12; }
      if (inCav) { col = mixA(J.inner, col, 0.4); al *= 0.55; }
      // gonads: four milky folds near the middle
      if (vv > 0.28 && vv < 0.62 && Math.abs(u) < w * 0.55 && Math.sin(u / w * Math.PI * 2.2 + 0.4) > 0.35 && Math.sin(v * 0.9 / s + u * 0.3) > -0.4) { col = kind === 'moon' ? [0.86, 0.6, 0.86] : [0.98, 0.9, 0.82]; al = 0.7; }
      const glowE = 0.22 + Math.pow(1 - e, 4) * 1.3 + (v > hb - 1.5 ? 0.8 : 0) + (vv < 0.25 ? (0.25 - vv) * 3 : 0);
      SA[(y * W + x) * 8 + 7] = clamp(al, 0, 0.95);
      sput(x, y, col[0], col[1], col[2], u / w * 0.8, (v - hb) / hb * 0.8, 0.6, 0);
      SA[(y * W + x) * 8 + 6] = glowE;
    }
    mapEnd((x, y, s2, v2, e) => {
      const k = (y * W + x) * 8;
      const g = SA[k + 6];
      lightPx(x, y, SA[k], SA[k + 1], SA[k + 2], SA[k + 3], SA[k + 4], SA[k + 5], fog, e ? Math.min(0.95, SA[k + 7] + 0.25) : SA[k + 7], J.glow[0] * g, J.glow[1] * g, J.glow[2] * g);
    });
  }

  /* ================================================================ the siphonophore */
  // a long colonial chain: a float, a stack of swimming bells pulsing in turn, then a stem of feeding units
  function drawSiphonophore(t) {
    const p = 0.72, Y0 = 2230, X0 = 96;
    const hx = scrX(X0 - (t - 11) * 4, p), hy = scrY(Y0 + (t - 11) * 10, p);
    if (hy < -420 || hy > H + 60) return;
    const L = 560, ang = 2.15;               // heading down and to the left, trailing behind up-right
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const pt = (sd) => {
      // the chain trails behind (opposite its heading), undulating
      const wv = Math.sin(sd * 0.026 - per(5, t)) * (4 + sd * 0.05) + Math.sin(sd * 0.011 + per(2, t)) * sd * 0.06;
      return [hx - dx * sd - dy * wv, hy - dy * sd + dx * wv];
    };
    const fog = 0.1, gl = [40, 110, 200];
    // the stem
    let px = -1, py = -1;
    for (let sd = 0; sd < L; sd += 0.7) {
      const q = pt(sd), x = Math.round(q[0]), y = Math.round(q[1]);
      if (x === px && y === py) continue; px = x; py = y;
      lightPx(x, y, 0.9, 0.7, 0.75, 0, 0, 1, fog, 0.8 * (1 - sd / L * 0.4), gl[0] * 0.75, gl[1] * 0.75, gl[2] * 0.75);
    }
    // feeding units with hanging tentacles, a faint light in each
    for (let k = 0; k < 26; k++) {
      const sd = 64 + k * 17, q = pt(sd);
      // tentacle: down, swaying, with tentilla beads
      for (let r = 0; r < 26 + 10 * ih(k, 3, 910); r++) {
        const x = q[0] + Math.sin(r * 0.15 - per(6, t) + k) * r * 0.18, y = q[1] + r;
        lightPx(x, y, 0.9, 0.5, 0.55, 0, 0, 1, fog, 0.5 * (1 - r / 36), gl[0] * 0.45, gl[1] * 0.45, gl[2] * 0.45);
        if (r % 5 === 4) lightPx(x + 1, y, 1, 0.6, 0.6, 0, 0, 1, fog, 0.6, gl[0] * 0.9, gl[1] * 0.9, gl[2] * 0.9);
      }
      // the gastrozooid: a small pink sac; a clear leaf-like bract over it
      for (let a = 0; a < 6; a++) lightPx(q[0] - 1 + (a % 2), q[1] + 1 + (a >> 1), 1, 0.55, 0.6, 0, 0.3, 0.9, fog, 0.85, 4, 8, 14);
      for (let a = -3; a <= 3; a++) lightPx(q[0] + a, q[1] - 2 + Math.abs(a) * 0.4, 0.75, 0.85, 1, 0, -0.6, 0.6, fog, 0.45, gl[0] * 0.8, gl[1] * 0.8, gl[2] * 0.8);
      const tw = 0.5 + 0.5 * Math.sin(per(4, t) - k * 0.6);
      addPx(q[0], q[1] + 2, 14 * tw, 60 * tw, 120 * tw);
      if (tw > 0.6) addLight(q[0], q[1] + 2, 10 * tw, 40 * tw, 90 * tw, 8, 0.1, 3);
    }
    // swimming bells: pairs of clear cups pulsing one after another down the stack
    for (let k = 0; k < 7; k++) {
      const sd = 8 + k * 7.5, q = pt(sd), pu = Math.max(0, Math.sin(per(16, t) - k * 0.9));
      for (const side of [-1, 1]) {
        const bx = q[0] + side * (3.6 - pu * 0.8) * -dy, by = q[1] + side * (3.6 - pu * 0.8) * dx;
        for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) {
          const d = Math.hypot(xx, yy * 1.2);
          if (d > 3.3 - pu * 0.5) continue;
          lightPx(bx + xx, by + yy, 0.8, 0.9, 1, xx / 3, yy / 3, 0.6, fog, d > 2.2 ? 0.7 : 0.25, gl[0] * 0.9, gl[1] * 0.9, gl[2] * 0.9);
        }
      }
    }
    // the float, a little amber bead with a glint
    const f = pt(-3);
    for (let yy = -2; yy <= 2; yy++) for (let xx = -2; xx <= 2; xx++) if (xx * xx + yy * yy <= 4) lightPx(f[0] + xx, f[1] + yy, 1, 0.6, 0.3, xx / 2, yy / 2, 0.6, fog * 0.5, 0.9, 30, 16, 6);
    addPx(f[0] - 1, f[1] - 1, 40, 40, 40);
  }

  /* ================================================================ comb jelly */
  // an oval of glass with eight rows of beating cilia; waves of diffracted colour run down them
  const RAINBOW = [[255, 70, 200], [90, 110, 255], [40, 230, 240], [110, 255, 110], [255, 230, 70], [255, 120, 60]];
  function rainbow(u) { u = fr(u) * RAINBOW.length; const k = fl(u), f = u - k, a = RAINBOW[k], b = RAINBOW[(k + 1) % RAINBOW.length]; return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)]; }
  function combAt(t) { return [292 - (t - 14.6) * 8, 2440 + (t - 14.6) * 42]; }
  function drawComb(t) {
    if (t < 13.6 || t > 19.5) return;
    const p = 0.9, q = combAt(t), cx = scrX(q[0], p), cy = scrY(q[1], p);
    if (cy < -60 || cy > H + 60) return;
    const rx = 20, ry = 32, rot = per(1, t) * 0.5, tilt = 0.25 + 0.08 * Math.sin(per(2, t));
    const ct = Math.cos(tilt), st = Math.sin(tilt), fog = 0.08;
    // its own soft light, which also falls on the snow around it
    const hue = rainbow(t * 0.3);
    addLight(cx, cy, hue[0] * 0.3 + 24, hue[1] * 0.3 + 56, hue[2] * 0.3 + 80, 44, 0.14, 12);
    // the body: faint glass, brighter rim, a central canal
    for (let y = fl(cy - ry - 4); y <= cy + ry + 4; y++) for (let x = fl(cx - ry - 4); x <= cx + ry + 4; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = (dx * ct + dy * st) / rx, v = (-dx * st + dy * ct) / ry;
      const d = u * u + v * v * (v < 0 ? 1.05 : 0.95);
      if (d > 1) continue;
      const rim = Math.pow(d, 3);
      const canal = Math.abs(u) < 0.08 && Math.abs(v) < 0.75;
      const al = canal ? 0.45 : 0.1 + 0.4 * rim;
      lightPx(x, y, 0.7, 0.85, 1, u, v, Math.sqrt(1 - Math.min(1, d)), fog, al, 6 + 20 * rim, 14 + 40 * rim, 22 + 50 * rim);
    }
    // the comb rows: meridians on the turning oval; only the near ones show
    for (let k = 0; k < 8; k++) {
      const phi = k / 8 * TAU + rot, front = Math.cos(phi);
      if (front < -0.15) continue;
      for (let s = -0.88; s <= 0.88; s += 0.026) {
        const wv = Math.sqrt(1 - s * s), u = Math.sin(phi) * wv * 0.96, v = s;
        const x = cx + u * rx * ct - v * ry * st, y = cy + u * rx * st + v * ry * ct;
        // the beat travels from the mouth down the row; each plate flashes its colour as it passes
        const beat = Math.pow(0.5 + 0.5 * Math.sin(s * 14 - per(48, t) + k * 0.8), 2);
        const col = rainbow(s * 0.9 + t * 0.55 + k * 0.13);
        const a = (0.35 + 0.65 * beat) * (0.45 + 0.55 * clamp(front + 0.15, 0, 1));
        addPx(x, y, col[0] * a, col[1] * a, col[2] * a);
        if (beat > 0.7 && front > 0.4) addPx(x + Math.sign(u), y, col[0] * 0.25, col[1] * 0.25, col[2] * 0.25);
      }
    }
    // the mouth at the top, a pale slit
    for (let a = -3; a <= 3; a++) lightPx(cx + a * ct + ry * st * 0.98, cy + a * st - ry * ct * 0.98 + 1, 0.9, 0.9, 1, 0, -1, 0.5, fog, 0.5, 20, 30, 40);
  }

  /* ================================================================ lanternfish */
  const LANTERN = [];
  function buildLantern() {
    const R = mulberry32(6060);
    for (let k = 0; k < 15; k++) LANTERN.push({ p: 0.7 + 0.5 * R(), y: 2640 + R() * 110, x0: 400 + R() * 120, v: 52 + R() * 26, ph: R() * TAU, sz: 0.85 + 0.35 * R(), t0: 15.2 + R() * 1.6 });
  }
  function lanternPos(f, t) { return [f.x0 - (t - f.t0) * f.v * (0.6 + 0.4 * f.p), f.y + 5 * Math.sin(per(3, t) + f.ph)]; }
  function drawLanternfish(t) {
    if (t < 15 || t > 22.5) return;
    for (const f of LANTERN) {
      const q = lanternPos(f, t), x = scrX(q[0], f.p), y = scrY(q[1], f.p);
      if (x < -30 || x > W + 30 || y < -20 || y > H + 20) continue;
      const s = f.sz * (1.0 + 0.7 * f.p), len = 18 * s, ht = 6.2 * s, wag = Math.sin(t * 13 + f.ph);
      // a dark body, seen only where its own lights fall on it
      addLight(x - len * 0.1, y + ht * 0.5, 40, 130, 220, 9 * s, 0, 2);
      drawFish(x, y, -1, 0.04 * Math.sin(per(5, t) + f.ph), len, ht, { back: [0.18, 0.2, 0.26], flank: [0.32, 0.36, 0.42], belly: [0.4, 0.44, 0.5], line: [0.22, 0.24, 0.3], fin: [0.2, 0.22, 0.28] }, 0.15, 0, wag, 1);
      LIGHTS.pop();
      // photophores: a row along the belly, two on the tail, a bright one by the eye
      const tw = 0.75 + 0.25 * Math.sin(per(9, t) + f.ph * 3);
      for (let k = 0; k < 7; k++) { const u = -0.38 + k * 0.11, px = x + u * len, py = y + ht * 0.34 + Math.abs(u) * 1.4; addPx(px, py, 40 * tw, 160 * tw, 230 * tw); }
      addPx(x + len * 0.36, y + ht * 0.1, 30 * tw, 120 * tw, 220 * tw);
      addPx(x - len * 0.38, y - ht * 0.08, 80, 210, 255);
      addPx(x + len * 0.42, y - ht * 0.2, 30 * tw, 110 * tw, 230 * tw);
      // the big eye catches the light
      addPx(x - len * 0.4, y - ht * 0.18, 60, 110, 140); addPx(x - len * 0.4 + 1, y - ht * 0.18, 20, 40, 60);
    }
  }

  /* ================================================================ sparks */
  // dinoflagellates flash blue when something brushes past: along each lanternfish's wake, and round the angler
  function drawSparks(t) {
    if (t < 15 || t > 23) return;
    for (const f of LANTERN) {
      for (let n = 0; n < 14; n++) {
        const te = fl(t / 0.2) * 0.2 - n * 0.2 + ih(n, fl(t / 0.2) - n, 920 + f.t0 * 10) * 0.18;
        const age = t - te;
        if (age < 0 || age > 2.4 || te < f.t0 - 0.5) continue;
        if (ih(fl(te * 50), fl(f.t0 * 100), 921) > 0.55) continue;
        const q = lanternPos(f, te), x = scrX(q[0] + 6 + ih(fl(te * 50), 1, 922) * 10, f.p), y = scrY(q[1] + (ih(fl(te * 50), 2, 922) - 0.5) * 10, f.p);
        const a = Math.min(1, age / 0.12) * Math.exp(-age / 0.55);
        if (a < 0.03) continue;
        addPx(x, y, 30 * a, 90 * a, 255 * a);
        if (a > 0.4) { addPx(x + 1, y, 10 * a, 30 * a, 90 * a); addPx(x - 1, y, 10 * a, 30 * a, 90 * a); addPx(x, y + 1, 10 * a, 30 * a, 90 * a); addPx(x, y - 1, 10 * a, 30 * a, 90 * a); }
      }
    }
  }

  /* ================================================================ far lights */
  // tiny living lights far off in the dark, drifting with the slowest layer
  const FARL = [];
  function buildFarLights() {
    const R = mulberry32(7171);
    for (let k = 0; k < 90; k++) FARL.push({ x: R() * (W + 40) - 20, y: 1700 + R() * 2200, p: 0.18 + 0.3 * R(), ph: R() * TAU, k: 1 + fl(R() * 4), c: R() < 0.7 ? [30, 110, 255] : R() < 0.5 ? [40, 255, 200] : [120, 255, 120] });
  }
  function drawFarLights(t) {
    for (const f of FARL) {
      const x = f.x - CX * f.p, y = 225 + f.p * (f.y - CH) - (1 - f.p) * 0;
      if (y < -4 || y > H + 4 || x < 0 || x >= W) continue;
      const yw = CH + y - 225, deep = sstep(1700, 2500, yw);
      const tw = Math.max(0, Math.sin(per(f.k, t) + f.ph)), a = deep * Math.pow(tw, 3) * 0.6;
      if (a < 0.02) continue;
      addPx(x, y, f.c[0] * a * 0.5, f.c[1] * a * 0.5, f.c[2] * a * 0.5);
    }
  }

  /* ================================================================ the anglerfish */
  // the lure is seen first, a point far off; it drifts nearer until its glow shows the fish behind it
  function anglerState(t) {
    const a = sstep(16.6, 20.2, t), away = sstep(20.5, 22.7, t);
    const s = lerp(0.3, 1.5, Math.pow(a, 1.3)) + 0.12 * away;
    const x = lerp(118, 200, a) - 70 * away + 4 * Math.sin(per(3, t));
    const y = lerp(372, 230, a) - 300 * away * away + 5 * Math.sin(per(2, t) + 1);
    const glow = sstep(15.9, 17.1, t) * (1 - sstep(21.9, 23.0, t));
    return { s, x, y, glow, turn: away };
  }
  function drawAngler(t) {
    if (t < 15.2 || t > 23.2) return;
    const A = anglerState(t), s = A.s, ts = fl(t * 12) / 12;
    const sway = Math.sin(per(5, ts) + 0.4) * 2.5, bob = Math.cos(per(4, ts)) * 1.5;
    const lx = A.x + (-36 + sway) * s, ly = A.y + (-32 + bob) * s;
    const pulse = 0.84 + 0.16 * Math.sin(per(6, t));
    const I = A.glow * pulse;
    // the lure's light: it falls on the face, the teeth, the snow
    addLight(lx, ly, 80 * I * 3, 200 * I * 3, 255 * I * 3, 34 * s + 8, 0.5 * I, 8 * s);
    if (A.glow < 0.15) return;
    const fog = 0.04;
    const body = [0.56, 0.48, 0.46], dark = [0.3, 0.25, 0.25], light = [0.72, 0.64, 0.6];
    const toS = (u, v) => [A.x + u * s, A.y + v * s];
    const upLip = (u) => -5 + (u + 26) * 0.32, loLip = (u) => 9 - (u + 26) * 0.12;   // jaw lines, u in [-26, 2]
    // fins first, translucent with dark rays
    const fin = (u0, v0, a0, a1, r0, r1) => {
      for (let y = fl(A.y + (v0 - r1) * s); y <= A.y + (v0 + r1) * s; y++) for (let x = fl(A.x + (u0 - r1) * s); x <= A.x + (u0 + r1) * s; x++) {
        const u = (x + 0.5 - A.x) / s - u0, v = (y + 0.5 - A.y) / s - v0, d = Math.hypot(u, v), a = Math.atan2(v, u);
        let da = a - a0; while (da < -Math.PI) da += TAU; while (da > Math.PI) da -= TAU;
        const span = a1 - a0;
        if (d < r0 || d > r1 * (0.85 + 0.15 * Math.cos((da / span - 0.5) * 6)) || da < 0 || da > span) continue;
        const ray = Math.abs(Math.sin(da / span * Math.PI * 7)) < 0.3;
        lightPx(x, y, ray ? 0.5 : 0.62, ray ? 0.42 : 0.52, ray ? 0.42 : 0.52, Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0.8, fog, ray ? 0.85 : 0.45);
      }
    };
    const fw = Math.sin(per(5, ts)) * 0.15;
    fin(38, 0, -0.75 + fw, 0.75 + fw, 0, 17);                 // tail
    fin(22, -15, -2.3, -1.2, 0, 11);                          // dorsal
    fin(24, 14, 1.15, 2.1, 0, 10);                            // anal
    // body and head
    sprBegin();
    for (let y = fl(A.y - 30 * s); y <= A.y + 30 * s; y++) for (let x = fl(A.x - 32 * s); x <= A.x + 42 * s; x++) {
      const u = (x + 0.5 - A.x) / s, v = (y + 0.5 - A.y) / s;
      const hh = u < 8 ? 24 : 24 - (u - 8) * 0.6;
      const bodyD = Math.pow((u - 6) / (u < 6 ? 30 : 34), 2) + Math.pow((v - 1) / hh, 2);
      const jaw = u > -29 && u < 4 && v > loLip(u) - 0.5 && v < loLip(u) + 4 + (u + 29) * 0.18;
      if (bodyD > 1 && !jaw) continue;
      const gape = u > -26 && u < 2 && v > upLip(u) && v < loLip(u);
      let c, nx = (u - 6) / 30, ny = (v - 1) / 24, nz = Math.sqrt(Math.max(0.05, 1 - Math.min(1, bodyD)));
      const tex = fbm(u / 4, v / 4, 930, 3);
      c = tex > 0.6 ? light : tex < 0.38 ? dark : body;
      if (ih(fl(u), fl(v), 931) < 0.025) c = light;
      if (Math.abs(v - 4 - u * 0.06) < 0.6 && (((fl(u) % 4) + 4) % 4 === 0) && u > -6 && u < 34) c = [0.85, 0.78, 0.7];
      if (jaw && !gape) { c = tex > 0.5 ? light : body; ny = 0.7; nz = 0.6; }
      if (gape) c = v < (upLip(u) + loLip(u)) / 2 ? [0.12, 0.04, 0.06] : [0.08, 0.02, 0.04];
      if (!gape && u > -26 && u < 2 && (Math.abs(v - upLip(u)) < 0.9 || Math.abs(v - loLip(u)) < 0.9)) c = [0.66, 0.3, 0.32];
      const ed = Math.hypot(u + 6, v + 11);
      if (ed < 2.6) c = ed < 0.9 ? [1, 1, 1] : ed < 1.9 ? [0.06, 0.1, 0.12] : [0.7, 0.62, 0.55];
      sput(x, y, c[0], c[1], c[2], nx, ny, nz, 0);
    }
    sprEnd(fog, 1, 0.55, 1.2);
    fin(10, 8, 0.2, 1.4, 1, 10);                              // pectoral, over the body
    // fangs: long glassy needles, the longest at the front, the upper ones raking back
    const fang = (u, v, len, dir, lean) => {
      const n = Math.ceil(len * s * 1.6);
      for (let q = 0; q <= n; q++) {
        const qq = q / n, p = toS(u + lean * qq * len * 0.3, v + dir * qq * len);
        lightPx(p[0], p[1], 1, 0.98, 0.92, -0.6, -dir * 0.3, 0.7, fog, 0.95 - qq * 0.35);
        if (s > 1.1 && qq < 0.4) lightPx(p[0] + 1, p[1], 0.9, 0.88, 0.82, 0.2, 0, 0.8, fog, 0.7);
      }
    };
    for (const [u, L] of [[-24, 8], [-20, 5], [-16.5, 9.5], [-12, 4.5], [-8, 7], [-4, 4], [-0.5, 3]]) fang(u, upLip(u) + 0.3, L, 1, 0.6);
    for (const [u, L] of [[-27, 10], [-23, 6], [-19, 11], [-14.5, 5], [-10, 8], [-6, 4], [-2, 3]]) fang(u, loLip(u) - 0.3, L, -1, -0.4);
    // the rod, arching forward from the forehead
    const r0 = toS(-6, -22), c1 = [A.x - 16 * s, A.y - 44 * s];
    for (let q = 0; q <= 1; q += 0.015 / Math.max(0.5, s)) {
      const x = lerp(lerp(r0[0], c1[0], q), lerp(c1[0], lx, q), q), y = lerp(lerp(r0[1], c1[1], q), lerp(c1[1], ly + 2 * s, q), q);
      lightPx(x, y, 0.7, 0.62, 0.58, 0, -0.5, 0.8, fog, 0.95);
    }
    // the esca: a bulb with a hot core and fine filaments
    const er = Math.max(1, 2.4 * s);
    for (let y = fl(ly - er - 1); y <= ly + er + 1; y++) for (let x = fl(lx - er - 1); x <= lx + er + 1; x++) {
      const d = Math.hypot(x + 0.5 - lx, y + 0.5 - ly) / er;
      if (d > 1) continue;
      const k = (1 - d * d) * I;
      addPx(x, y, 140 * k + 20 * I, 240 * k + 60 * I, 255 * k + 90 * I);
    }
    for (let q = 1; q < 6 * s; q++) { addPx(lx - q * 0.5, ly - er - q * 0.7, 10 * I, 70 * I, 110 * I); addPx(lx + q * 0.7, ly - er - q * 0.4, 10 * I, 60 * I, 100 * I); addPx(lx - q * 0.8, ly + er * 0.3 - q * 0.1, 8 * I, 50 * I, 80 * I); }
  }

  /* ================================================================ the vent: dioramas */
  const CREST = 3772;                                 // where the camera rests
  const ORX = 150, ORY = 3664;                        // the main orifice, world
  let VFAR = null, VMID = null, VMAIN = null, VNEAR = null;
  const WORMS = [];                                   // tube tops (world) for the live plumes
  const VA = {
    basalt: [0.2, 0.2, 0.24], basalt2: [0.3, 0.29, 0.32], glass: [0.42, 0.44, 0.5], sulf: [0.16, 0.13, 0.12], rust: [0.62, 0.3, 0.14],
    ochre: [0.82, 0.62, 0.24], anhy: [0.86, 0.82, 0.74], mat: [0.92, 0.9, 0.84], mussel: [0.5, 0.4, 0.2], musselL: [0.78, 0.66, 0.36],
    tube: [0.88, 0.86, 0.8], tubeD: [0.6, 0.56, 0.54], sed: [0.36, 0.3, 0.26],
  };
  function ventGround(wx) { return 3852 + 14 * (fbm(wx / 60, 4.4, 151, 3) - 0.5) - 22 * Math.exp(-Math.pow((wx - 150) / 60, 2)); }
  function chimneyW(wy) {
    const u = clamp((wy - ORY) / (3836 - ORY), 0, 1);
    return lerp(8, 32, Math.pow(u, 1.25)) + 3.2 * Math.sin(wy / 9) * (0.4 + u) + 2.5 * (fbm(wy / 14, 2.2, 152, 2) - 0.5) * 2;
  }
  const chimneyX = (wy) => ORX + 5 * Math.sin((wy - ORY) / 46) - 3 * (wy - ORY) / 240;
  function ventFlicker(t, k) { return 1 + 0.1 * Math.sin(per(7 + k * 4, t) + k) + 0.05 * Math.sin(per(17 + k, t) + 2 * k); }
  function paintVent() {
    const R = mulberry32(3880);
    const fill = [0.012, 0.02, 0.05];
    /* ---- far: a ridge with two little smokers, one glowing */
    VFAR = makeLayer(300, 0.45, 0, { vent: true }); VFAR.y0 = VFAR.wy0 = CREST - 45 / 0.45; LAY = VFAR;
    {
      const L = VFAR, bl = [];
      for (let x = -20; x < L.w + 20; x += 10) { const top = 92 + 26 * fbm(x / 70, 1.2, 160, 3) - 30 * Math.exp(-Math.pow((x - 270) / 50, 2)); bl.push([x, top + 22, 18 + R() * 10, 22, R() * 2]); for (let y = top + 40; y < L.h + 20; y += 26) bl.push([x, y, 16, 18, -1]); }
      paintLumps(L, bl, R, (wx, wy) => mixA(VA.basalt, VA.basalt2, fbm(wx / 9, wy / 9, 161, 2)));
      for (const [x0, top, w0] of [[286, 30, 7], [58, 70, 5], [330, 60, 4]]) {
        PID++;
        for (let y = top; y < top + 70; y++) { const w = w0 * (0.5 + 0.7 * (y - top) / 70) + Math.sin(y / 4) * 0.8; for (let x = fl(x0 - w); x <= x0 + w; x++) lset(x + LM, y, 0.22, 0.18, 0.17, (x - x0) / w * 0.8, 0, 0.6, 30); }
      }
      VLIGHTS.length = 0; VLIGHTS.push({ x: 286, y: 32, z: 8, r: 255, g: 120, b: 40, rad: 30 }, { x: 150, y: 10, z: 30, r: 120, g: 50, b: 20, rad: 90 });
      for (let i = 0; i < L.n; i++) L.F[i] = 0.5;
      bakeLayer(L, { fill });
      L.EM.fill(0);
      for (let y = 26; y < 36; y++) for (let x = 282; x < 291; x++) { const i = y * L.w + x + LM; if (L.M[i] && ih(x, y, 162) < 0.5) { L.EM[i * 3] = 120; L.EM[i * 3 + 1] = 50; L.EM[i * 3 + 2] = 14; } }
    }
    /* ---- mid: mounds, a second chimney on the right with a mirror flange */
    VMID = makeLayer(340, 0.72, 0, { vent: true }); VMID.y0 = VMID.wy0 = CREST - 105 / 0.72; LAY = VMID;
    {
      const L = VMID, bl = [];
      for (let x = -20; x < L.w + 20; x += 12) { const top = 176 + 30 * fbm(x / 60, 3.2, 170, 3) - 34 * Math.exp(-Math.pow((x - 316) / 40, 2)); bl.push([x, top + 18, 16 + R() * 12, 18, R() * 2]); for (let y = top + 36; y < L.h + 20; y += 22) bl.push([x + R() * 8, y, 18, 16, -1]); }
      paintLumps(L, bl, R, (wx, wy) => { const n = fbm(wx / 8, wy / 8, 171, 2); return n > 0.62 ? VA.glass : mixA(VA.basalt, VA.basalt2, n); });
      PID++;
      const cx = 316 + LM;
      for (let y = 60; y < 186; y++) {
        const u = (y - 60) / 126, w = lerp(5, 15, Math.pow(u, 1.2)) + 1.6 * Math.sin(y / 5);
        for (let x = fl(cx - w); x <= cx + w; x++) {
          const q = (x - cx) / w, n = fbm(x / 4, y / 4, 172, 2);
          const c = n > 0.66 ? VA.rust : n < 0.3 ? VA.anhy : VA.sulf;
          lset(x, y, c[0], c[1], c[2], q * 0.9, -0.1, Math.sqrt(1 - Math.min(1, q * q)), 30);
        }
      }
      VLIGHTS.length = 0; VLIGHTS.push({ x: 316, y: 62, z: 8, r: 255, g: 130, b: 50, rad: 38 }, { x: 150, y: 40, z: 40, r: 170, g: 70, b: 25, rad: 120 });
      for (let i = 0; i < L.n; i++) L.F[i] = 0.25;
      bakeLayer(L, { fill });
      for (let y = 58; y < 186; y++) for (let x = cx - 16; x <= cx + 16; x++) {
        const i = y * L.w + x; if (!L.M[i]) continue;
        const n = Math.abs(fbm(x / 6, y / 11, 173, 3) - 0.5);
        const hot = y < 66 ? 1 : n < 0.022 ? 0.6 * (1 - (y - 60) / 160) : 0;
        if (hot > 0) { L.EM[i * 3] = 230 * hot; L.EM[i * 3 + 1] = 100 * hot; L.EM[i * 3 + 2] = 26 * hot; }
      }
    }
    /* ---- main: the black smoker, its mound, the worm garden */
    VMAIN = makeLayer(500, 1, 3540, { vent: true }); LAY = VMAIN;
    {
      const L = VMAIN, ly = (wy) => wy - 3540, lx = (wx) => wx + LM;
      // the ground: pillows and boulders, the mound under the chimney
      const bl = [];
      for (let wx = -30; wx < W + 40; wx += 9 + R() * 6) {
        const g = ventGround(wx), r = 9 + R() * 14;
        bl.push([lx(wx), ly(g + r * 0.55), r * (1 + R() * 0.4), r * 0.75, 2 + R() * 3]);
        for (let wy = g + r + 8; wy < 4060; wy += 14 + R() * 8) bl.push([lx(wx + R() * 10), ly(wy), 12 + R() * 12, 9 + R() * 8, 1 + R() * 4]);
      }
      paintLumps(L, bl, R, (wx, wy, z) => {
        const n = fbm(wx / 7, wy / 7, 180, 2), d = Math.hypot(wx - 150, (wy - 3836) * 1.6);
        let c = n > 0.66 ? VA.glass : mixA(VA.basalt, VA.basalt2, n);
        if (z > 0 && fbm(wx / 3, wy / 3, 179, 2) > 0.7) c = mixA(c, [0.6, 0.62, 0.68], 0.6);
        // stained and crusted near the vent: rust, sulphur, white mats
        const st = fbm(wx / 12, wy / 10, 181, 3);
        if (d < 130 && st > 0.58) c = mixA(c, st > 0.68 ? VA.ochre : VA.rust, clamp((130 - d) / 60, 0, 0.8));
        if (d < 160 && st < 0.3) c = mixA(c, VA.mat, clamp((160 - d) / 50, 0, 0.75));
        return c;
      });
      // sediment and white bacterial mats lying on the tops of the rocks
      for (let wx = -LM; wx < W + LM; wx++) {
        let y0 = -1;
        for (let y = 0; y < L.h; y++) if (L.M[y * L.w + lx(wx)]) { y0 = y; break; }
        if (y0 < 0) continue;
        const d = Math.abs(wx - 150), matty = fbm(wx / 9, 1, 182, 2) > 0.45 && d < 190;
        for (let k = 0; k < 3; k++) {
          const c = matty ? mixA(VA.mat, VA.anhy, k * 0.3) : mixA(VA.sed, VA.basalt2, k * 0.3);
          if (k === 2 && ih(wx, 0, 183) < 0.5) continue;
          lset(lx(wx), y0 + k, c[0], c[1], c[2], 0, -1, 0.4, 30, 1);
        }
        if (matty && ih(wx, 1, 184) < 0.4) lset(lx(wx), y0 - 1, VA.mat[0], VA.mat[1], VA.mat[2], 0, -1, 0.4, 31, 1);
      }
      // the chimney: knobbly, banded with minerals, flanges sticking out, a side spire
      PID++;
      for (let wy = ORY - 2; wy < 3846; wy++) {
        const w = chimneyW(wy), cx = chimneyX(wy);
        let wl = w, wr = w;
        for (const [fy, side, out] of [[3712, 1, 15], [3758, -1, 13], [3800, 1, 10]]) { const u = (wy - fy) / 5; if (u > -1 && u < 1) { if (side > 0) wr = Math.max(wr, w + out * (1 - u * u)); else wl = Math.max(wl, w + out * (1 - u * u)); } }
        for (let x = fl(cx - wl); x <= cx + wr; x++) {
          const q = (x + 0.5 - cx) / (x < cx ? wl : wr), z = fbm(x / 4, wy / 4, 185, 3);
          const band = fbm(x / 5, wy / 26, 186, 3), n = fbm(x / 4, wy / 9, 187, 2);
          let c = VA.sulf;
          if (band > 0.6) c = mixA(VA.rust, VA.ochre, (band - 0.6) * 3);
          else if (band < 0.36) c = mixA(VA.sulf, VA.basalt2, 0.5);
          if (n > 0.7) c = VA.anhy;
          if (wy < ORY + 40 && n < 0.45) c = mixA(VA.sulf, [0.08, 0.07, 0.07], 0.6);
          if (wy < ORY + 2 && Math.abs(q) > 0.55) c = mixA(VA.ochre, VA.rust, 0.5);
          const nz = Math.sqrt(Math.max(0.1, 1 - q * q));
          lset(lx(x), ly(wy), c[0], c[1], c[2], q * 0.95 + (z - 0.5) * 0.5, (n - 0.5) * 0.6 - 0.15, nz, 40 + nz * 20);
        }
      }
      // the side spire
      for (let wy = 3742; wy < 3818; wy++) {
        const u = (wy - 3742) / 76, cx = lerp(108, 124, u), w = lerp(3.5, 9, u) + 1.4 * Math.sin(wy / 4) + 1.2 * (vn2(wy / 3, 0, 189) - 0.5);
        for (let x = fl(cx - w); x <= cx + w; x++) {
          const q = (x + 0.5 - cx) / w, n = fbm(x / 4, wy / 8, 191, 2);
          const c = n > 0.62 ? VA.rust : n < 0.32 ? VA.anhy : VA.sulf;
          lset(lx(x), ly(wy), c[0], c[1], c[2], q * 0.9, -0.1, Math.sqrt(Math.max(0.1, 1 - q * q)), 50);
        }
      }
      // mussel beds round the base
      for (let k = 0; k < 140; k++) {
        const wx = 60 + R() * 200, g = ventGround(wx), wy = g + 2 + R() * 10;
        if (Math.abs(wx - 150) < chimneyW(wy) + 2) continue;
        const a = (R() - 0.5) * 1.2, ca = Math.cos(a), sa = Math.sin(a);
        PID++;
        for (let yy = -3; yy <= 3; yy++) for (let xx = -4; xx <= 4; xx++) {
          const u = (xx * ca + yy * sa) / 4.2, v = (-xx * sa + yy * ca) / 2.2;
          if (u * u + v * v > 1) continue;
          const c = v < -0.3 ? VA.musselL : v > 0.5 ? mixA(VA.mussel, VA.basalt, 0.5) : VA.mussel;
          lset(lx(wx) + xx, ly(wy) + yy, c[0], c[1], c[2], u * 0.5, v * 0.8, 0.6, 46);
        }
      }
      // tube worms: white tubes rising in clusters (their red plumes are alive and drawn each frame)
      const clusters = [[74, 34, 22], [218, 36, 20], [284, 20, 10], [22, 16, 8], [126, 8, 5], [334, 16, 8]];
      for (const [cx0, spread, n] of clusters) {
        const tubes = [];
        for (let k = 0; k < n; k++) {
          const bx = cx0 + (R() - 0.5) * spread * 2, g = ventGround(bx) + 6;
          const hgt = 16 + R() * 62 * (1 - Math.abs(bx - cx0) / (spread * 1.5)), lean = (R() - 0.5) * 14;
          tubes.push([bx, g, hgt, lean, 1.7 + R() * 1.1]);
        }
        tubes.sort((a, b) => b[2] - a[2]);
        for (const [bx, g, hgt, lean, r] of tubes) {
          PID++;
          const top = [bx + lean, g - hgt];
          ltube([[lx(bx), ly(g)], [lx(bx + lean * 0.3), ly(g - hgt * 0.4)], [lx(bx + lean * 0.75), ly(g - hgt * 0.8)], [lx(top[0]), ly(top[1])]], r * 1.2, r, 60, (s, w) => {
            const ring = Math.sin(s * hgt * 0.9) > 0.7;
            return mixA(ring ? VA.tubeD : VA.tube, [0.7, 0.5, 0.5], s * 0.15);
          });
          WORMS.push({ L: VMAIN, lx: lx(top[0]), ly: ly(top[1]), r, ph: R() * TAU, k: 1 + fl(R() * 3), ret: R(), sz: 0.9 + 0.6 * R() });
        }
      }
      VLIGHTS.length = 0;
      VLIGHTS.push({ x: ORX, y: ly(ORY + 2), z: 16, r: 300, g: 150, b: 52, rad: 105 }, { x: 150, y: ly(3828), z: 26, r: 300, g: 110, b: 36, rad: 120 });
      for (let i = 0; i < L.n; i++) L.F[i] = 0.04;
      bakeLayer(L, { fill, ao: 0.13 });
      // glowing seams: thin hot cracks on the chimney and the mound, brighter low and at the throat
      for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
        const i = y * L.w + x; if (!L.M[i]) continue;
        const wx = x - LM, wy = y + 3540, d = Math.hypot(wx - 150, (wy - 3832) * 1.4);
        const onChim = Math.abs(wx - chimneyX(wy)) < chimneyW(wy) + 1 && wy < 3846;
        const n = Math.abs(fbm(wx / 7, wy / 13, 188, 3) - 0.5);
        let hot = 0;
        if (onChim && n < 0.007 + 0.006 * sstep(3760, 3840, wy)) hot = 0.5 + 0.5 * sstep(3760, 3840, wy);
        if (!onChim && d < 60 && n < 0.016) hot = 0.8 * (1 - d / 60);
        if (wy < ORY + 6 && onChim) { const q = Math.abs(wx - chimneyX(wy)) / chimneyW(wy); if (q < 0.45 - (wy - ORY) * 0.07) hot = 1.1; }
        if (hot > 0) { L.EM[i * 3] = 255 * hot; L.EM[i * 3 + 1] = 96 * hot; L.EM[i * 3 + 2] = 22 * hot; }
      }
    }
    /* ---- near: dark foreground rocks with a crab's ledge and a few worms */
    VNEAR = makeLayer(170, 1.3, 0, { vent: true }); VNEAR.y0 = VNEAR.wy0 = CREST + 108 / 1.3; LAY = VNEAR;
    {
      const L = VNEAR, bl = [];
      for (let x = -20; x < 110; x += 9) bl.push([x + LM, 40 + (x + 20) * 0.6 + R() * 12, 20 + R() * 12, 16 + R() * 6, R() * 3]);
      for (let x = 268; x < L.w + 20; x += 9) bl.push([x + LM, 50 + (L.w - x) * 0.45 + R() * 12, 20 + R() * 12, 16 + R() * 6, R() * 3]);
      for (const b of bl.slice()) for (let y = b[1] + 20; y < L.h + 20; y += 20) bl.push([b[0], y, b[2], 16, b[4] - 1]);
      paintLumps(L, bl, R, (wx, wy) => mixA(VA.basalt, VA.glass, fbm(wx / 6, wy / 6, 190, 2) > 0.62 ? 0.6 : 0.1));
      // a clump of big worms close to us on each side
      for (const [cx0, n] of [[52, 7], [314, 6]]) {
        const tubes = [];
        for (let k = 0; k < n; k++) {
          const bx = cx0 + (R() - 0.5) * 40 + LM;
          let g = 0; while (g < L.h - 1 && !L.M[g * L.w + fl(bx)]) g++;
          tubes.push([bx, g + 6, 30 + R() * 50, (R() - 0.5) * 16, 2.6 + R() * 1.2]);
        }
        tubes.sort((a, b) => b[2] - a[2]);
        for (const [bx, g, hgt, lean, r] of tubes) {
          PID++;
          ltube([[bx, g], [bx + lean * 0.3, g - hgt * 0.4], [bx + lean * 0.75, g - hgt * 0.8], [bx + lean, g - hgt]], r * 1.2, r, 60, (s2) => mixA(Math.sin(s2 * hgt * 0.7) > 0.7 ? VA.tubeD : VA.tube, [0.7, 0.5, 0.5], s2 * 0.15));
          WORMS.push({ L: VNEAR, lx: bx + lean, ly: g - hgt, r, ph: R() * TAU, k: 1 + fl(R() * 3), ret: R(), sz: 2.0 + 0.6 * R() });
        }
      }
      VLIGHTS.length = 0; VLIGHTS.push({ x: ORX, y: -170, z: 60, r: 300, g: 140, b: 50, rad: 150 }, { x: 150, y: -40, z: 40, r: 300, g: 100, b: 34, rad: 150 });
      for (let i = 0; i < L.n; i++) L.F[i] = 0;
      bakeLayer(L, { fill: [0.004, 0.006, 0.014] });
      L.EM.fill(0);
    }
  }
  function drawVentLayer(L, f0, f1, fe) {
    const top = layerTop(L);
    if (top > H || top + L.h < 0) return;
    drawLayer(L, (j, k, li) => {
      const f = L.F[li];
      C[j] = L.BASE[k] + L.BK0[k] * f0 + L.BK1[k] * f1 + L.EM[k] * fe + f * C[j];
      C[j + 1] = L.BASE[k + 1] + L.BK0[k + 1] * f0 + L.BK1[k + 1] * f1 + L.EM[k + 1] * fe + f * C[j + 1];
      C[j + 2] = L.BASE[k + 2] + L.BK0[k + 2] * f0 + L.BK1[k + 2] * f1 + L.EM[k + 2] * fe + f * C[j + 2];
    });
  }
  // the plume of black smoke: tiling noise advected upward three whole tiles per loop
  function drawSmoke(t, ox, oy, scale, alpha) {
    if (oy < -20) return;
    const rise = per(3, t) / TAU * NZT;
    const ytop = Math.max(0, fl(oy - 520 * scale));
    for (let y = ytop; y < Math.min(H, oy + 2); y++) {
      const dy = oy - y;                                  // height above the orifice
      const wv = (5 + dy * 0.2 + 8 * Math.min(1, dy / 160)) * scale;
      const drift = 6 * Math.sin(dy * 0.018 - per(2, t)) * Math.min(1, dy / 80) * scale;
      const row1 = mod(fl(y + rise + CH * 0.0), NZT) * W, row2 = mod(fl(y * 0.6 + rise * 1.6 + 200), NZT) * W;
      for (let x = Math.max(0, fl(ox - wv * 1.6 + drift)); x <= Math.min(W - 1, ox + wv * 1.6 + drift); x++) {
        const u = (x - ox - drift) / wv;
        const n = NZ[row1 + clamp(fl(x * 1.7 + 40), 0, W - 1)] + 0.6 * NZ[row2 + clamp(fl(x * 2.6 + 9), 0, W - 1)];
        let dens = Math.exp(-u * u * 1.4) * (0.75 + 1.9 * n);
        dens *= Math.min(1, dy / 3 + 0.5) * (1 - sstep(320 * scale, 520 * scale, dy));
        if (dens <= 0.02) continue;
        const a = clamp(dens, 0, 0.92) * alpha;
        // lit orange from below near the throat, grey-black above
        const hot = Math.exp(-dy / (12 * scale));
        const r = 12 + 220 * hot, g = 9 + 90 * hot, b = 10 + 24 * hot;
        const j = (y * W + x) * 3;
        C[j] += (r - C[j]) * a; C[j + 1] += (g - C[j + 1]) * a; C[j + 2] += (b - C[j + 2]) * a;
      }
    }
  }
  // shimmer: the hot water bends what is behind it
  function drawHaze(t, ox, oy, scale) {
    const y0 = Math.max(0, fl(oy - 120 * scale)), y1 = Math.min(H - 1, Math.ceil(oy + 4));
    if (y1 <= y0) return;
    const x0 = Math.max(0, fl(ox - 40 * scale)), x1 = Math.min(W - 1, Math.ceil(ox + 40 * scale));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const j = (y * W + x) * 3; C2[j] = C[j]; C2[j + 1] = C[j + 1]; C2[j + 2] = C[j + 2]; }
    for (let y = y0; y <= y1; y++) {
      const dy = oy - y, env = Math.min(1, dy / 10 + 0.3) * (1 - dy / (120 * scale));
      for (let x = x0; x <= x1; x++) {
        const u = (x - ox) / (40 * scale), e = env * Math.max(0, 1 - u * u);
        const d = Math.round(1.6 * e * Math.sin(y * 0.42 + per(24, t) + Math.sin(x * 0.2 + per(5, t)) * 1.3));
        const sx = clamp(x + d, x0, x1), j = (y * W + x) * 3, k = (y * W + sx) * 3;
        C[j] = C2[k]; C[j + 1] = C2[k + 1]; C[j + 2] = C2[k + 2];
      }
    }
  }
  function drawWorms(t, layer) {
    const ts = fl(t * 12) / 12;
    for (const w of WORMS) {
      if (w.L !== layer) continue;
      const x = w.lx - LM - CX * w.L.p, y = layerTop(w.L) + w.ly;
      if (y < -30 || y > H + 30) continue;
      // now and then a worm pulls its plume in and slowly pushes it out again
      const rc = fr(ts / 8 + w.ret), ext = rc < 0.06 ? 1 - rc / 0.06 : rc < 0.22 ? (rc - 0.06) / 0.16 : 1;
      const out = w.ret < 0.35 ? ext * ext * (3 - 2 * ext) : 1;
      const hgt = (8 + 6 * w.sz) * out, wid = (2.2 + 1.7 * w.sz) * Math.max(0.4, out);
      const sway = Math.sin(per(w.k, ts) + w.ph) * 1.6 + Math.sin(per(w.k + 3, ts) + w.ph * 2) * 0.6;
      if (hgt < 0.8) continue;
      sprBegin();
      for (let yy = fl(y - hgt - 1); yy <= y + 1; yy++) for (let xx = fl(x - wid - 3); xx <= x + wid + 3; xx++) {
        const v = (y + 0.5 - yy) / hgt;                    // 0 at the collar, 1 at the tip
        if (v < 0 || v > 1) continue;
        const cxv = x + sway * v * v;
        const half = wid * Math.sin(Math.PI * Math.min(1, 0.2 + v * 0.95)) * (v > 0.8 ? 1 - (v - 0.8) * 2.5 : 1);
        const u = (xx + 0.5 - cxv) / Math.max(0.6, half);
        if (Math.abs(u) > 1) continue;
        // gill lamellae: vertical leaves of blood red with pink edges
        const lam = Math.sin(u * 5.5 + v * 2) > 0.2;
        const c = lam ? (v > 0.75 ? [1.6, 0.6, 0.62] : [1.5, 0.2, 0.3]) : [0.8, 0.06, 0.18];
        sput(xx, yy, c[0], c[1], c[2], u * 0.7, -v * 0.6, 0.6, (w.L === VNEAR ? 70 : 34) * (0.5 + 0.5 * v));
      }
      sprEnd(0.02, 1, 0.55, 1.35);
      if (w.L === VNEAR) continue;
      // the white collar at the tube's mouth
      lightPx(x - 1, y + 1, 0.95, 0.9, 0.86, 0, -1, 0.5, 0, 1); lightPx(x, y + 1, 0.95, 0.9, 0.86, 0, -1, 0.5, 0, 1); lightPx(x + 1, y + 1, 0.95, 0.9, 0.86, 0, -1, 0.5, 0, 1);
    }
  }
  // white vent crabs picking their way over the rocks; legs step at 12 fps
  const CRABS = [[40, 0.9, 0.3], [112, 1.2, 1.7], [196, 1.0, 3.1], [250, 1.1, 4.2], [300, 0.8, 5.0], [176, 0.7, 2.2]];
  function drawCrabs(t) {
    const ts = fl(t * 12) / 12;
    for (const [x0, sz, ph] of CRABS) {
      const wx = x0 + 14 * Math.sin(per(1, t) + ph) + 6 * Math.sin(per(3, t) + ph * 2);
      const wy = ventGround(wx) - 1;
      const x = wx - CX, y = wy - CH + 225;
      if (y < -10 || y > H + 10) continue;
      const dir = Math.cos(per(1, t) + ph) >= 0 ? 1 : -1;
      const step = fl(ts * 6 + ph * 3) & 1;
      const s = sz * 1.15, body = [0.95, 0.93, 0.88], leg = [0.86, 0.82, 0.76];
      // legs: three a side, alternating
      for (let k = 0; k < 3; k++) for (const side of [-1, 1]) {
        const bx = x + side * (2 + k * 1.6) * s, lift = ((k + (side > 0 ? 1 : 0) + step) & 1) ? 1 : 0;
        lightPx(bx + side * 1.5 * s, y - 1 - lift, leg[0], leg[1], leg[2], side * 0.5, -0.5, 0.6, 0, 1);
        lightPx(bx + side * 2.5 * s, y - lift * 0.5, leg[0], leg[1], leg[2], side * 0.5, 0, 0.6, 0, 1);
        lightPx(bx + side * 3 * s, y + 1, leg[0], leg[1], leg[2], side * 0.5, 0.3, 0.6, 0, 1);
      }
      // carapace
      sprBegin();
      for (let yy = fl(y - 5 * s); yy <= y; yy++) for (let xx = fl(x - 6 * s); xx <= x + 6 * s; xx++) {
        const u = (xx + 0.5 - x) / (5.5 * s), v = (yy + 0.5 - (y - 2.2 * s)) / (2.8 * s);
        if (u * u + v * v > 1) continue;
        sput(xx, yy, body[0], body[1], body[2], u * 0.7, v * 0.8, 0.6, 0);
      }
      sprEnd(0, 1, 0.6, 1.2);
      // claws held out in front
      const cx2 = x + dir * 6.5 * s, cy2 = y - 3 * s;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, -1], [1, -1], [2, -1], [2, 0]]) lightPx(cx2 + dir * dx, cy2 + dy, body[0], body[1], body[2], dir * 0.5, -0.4, 0.6, 0, 1);
    }
  }
  // a swarm of pale shrimp grazing the warm flanks of the chimney
  const SHRIMP = [];
  function buildShrimp() {
    const R = mulberry32(9090);
    for (let k = 0; k < 70; k++) {
      const wy = 3690 + R() * 140, side = R() < 0.5 ? -1 : 1;
      SHRIMP.push({ wy, side, off: R() * 6 - 1, ph: R() * TAU, k: 1 + fl(R() * 4), a: 3 + R() * 6, sz: 0.8 + 0.4 * R() });
    }
  }
  function drawShrimp(t) {
    const ts = fl(t * 12) / 12;
    for (const s2 of SHRIMP) {
      const wy = s2.wy + s2.a * Math.sin(per(s2.k, ts) + s2.ph);
      const wx = chimneyX(wy) + s2.side * (chimneyW(wy) + 1 + s2.off * 0.5 + Math.sin(per(s2.k + 2, ts) + s2.ph));
      const x = Math.round(wx - CX), y = Math.round(wy - CH + 225);
      if (y < -6 || y > H + 6) continue;
      const dn = Math.cos(per(s2.k, ts) + s2.ph) > -0.3 ? 1 : -1;      // mostly head down, grazing
      const L = s2.sz > 1 ? 5 : 4, sd = s2.side;
      for (let q = 0; q < L; q++) {
        const yy = y + dn * q, curl = q >= L - 1 ? sd : 0;
        const c = q === 0 ? [1, 0.82, 0.8] : q === L - 1 ? [1, 0.7, 0.7] : [1, 0.96, 0.92];
        lightPx(x + curl, yy, c[0], c[1], c[2], sd * 0.6, -0.2, 0.7, 0, 1, 34, 26, 24);
        if (q > 0 && q < L - 1) lightPx(x + sd, yy, 0.8, 0.7, 0.7, sd, 0, 0.4, 0, 0.6);
      }
    }
  }
  // an eelpout weaving slowly through the worm garden
  function drawEelpout(t) {
    const a = per(1, t) + 0.8;
    const wx = 170 + 120 * Math.sin(a), wy = 3812 + 8 * Math.sin(per(3, t));
    const x = wx - CX, y = wy - CH + 225;
    if (y < -20 || y > H + 20) return;
    const dir = Math.cos(a) >= 0 ? 1 : -1;
    drawFish(x, y, dir, 0.08 * Math.sin(per(5, t)), 40, 7, { back: [0.86, 0.66, 0.62], flank: [0.95, 0.8, 0.76], belly: [0.98, 0.9, 0.86], line: [0.8, 0.6, 0.6], fin: [0.9, 0.72, 0.7] }, 0.02, 0, Math.sin(t * 6) * 1.6, 1);
  }
  function ventVisible() { return CH > 3150 || (TT > 26 && TT < 29.5); }
  function drawVent(t) {
    if (!ventVisible()) return;
    const f0 = ventFlicker(t, 0), f1 = ventFlicker(t, 1), fe = 0.85 + 0.15 * Math.sin(per(9, t)) * Math.sin(per(5, t) + 1);
    drawVentLayer(VFAR, f0 * 0.9, f1, fe);
    // the far smokers' wisps
    drawSmoke(t, 286 - CX * 0.45 + 0, layerTop(VFAR) + 30, 0.35, 0.5);
    drawVentLayer(VMID, f0, f1, fe);
    drawSmoke(t, 316 - CX * 0.72, layerTop(VMID) + 60, 0.55, 0.7);
    drawVentLayer(VMAIN, f0, f1, fe);
    const ox = ORX - CX, oy = ORY - CH + 225;
    drawSmoke(t, ox, oy, 1, 0.95);
    drawSmoke(t, 107 - CX, 3736 - CH + 225, 0.35, 0.6);
    drawHaze(t, ox, oy, 1);
    drawShrimp(t);
    drawWorms(t, VMAIN);
    drawCrabs(t);
    drawEelpout(t);
  }
  function drawVentNear(t) {
    if (!ventVisible()) return;
    const f0 = ventFlicker(t, 0), f1 = ventFlicker(t, 1);
    drawVentLayer(VNEAR, f0, f1, 1);
    drawWorms(t, VNEAR);
  }
  function ventLights(t) {
    if (!ventVisible()) return;
    const f0 = ventFlicker(t, 0), f1 = ventFlicker(t, 1);
    const oy = ORY - CH + 225;
    addLight(ORX - CX, oy + 2, 255 * 1.5 * f0, 120 * 1.5 * f0, 40 * 1.5 * f0, 90, 0.07 * f0, 14);
    addLight(150 - CX, 3828 - CH + 225, 255 * f1, 90 * f1, 30 * f1, 110, 0.06 * f1, 24);
    addLight(316 - CX * 0.72, layerTop(VMID) + 62, 220 * f0, 100 * f0, 34 * f0, 30, 0.12, 8);
  }

  /* ================================================================ bubbles: the vent's breath, the ride up, the plunge */
  // the colour a bubble takes from where it is: the light around it, the water, a silver skin
  function bubbleTint(x, y) {
    const yw = CH + y - 225, o = yIdx(yw);
    let r = WCT[o] * 1.9 + 70 * AMT[o] + 40, g = WCT[o + 1] * 1.7 + 80 * AMT[o + 1] + 56, b = WCT[o + 2] * 1.5 + 80 * AMT[o + 2] + 76;
    if (LIGHTS.length) { pointLight(x, y); r += LR * 1.2; g += LG * 1.2; b += LB * 1.2; }
    return [Math.min(255, r), Math.min(255, g), Math.min(255, b)];
  }
  const VBX = 184, VBY = 3830;                       // the crack the bubbles come from
  const RIDE0 = 27.15;                               // the cluster lets go
  function rideY(t) {                                // world y of the cluster's big bubble
    const h = hAt(t);
    return h + lerp(VBY - hAt(RIDE0), -34, sstep(RIDE0, RIDE0 + 1.5, t)) - 60 * sstep(30.6, 31.7, t);
  }
  const RIDERS = [];
  function buildRiders() {
    const R = mulberry32(2718);
    RIDERS.push({ dx: 0, dy: 0, r0: 4, r1: 11, ph: 0 });
    RIDERS.push({ dx: 9, dy: 10, r0: 2.5, r1: 6.5, ph: 1.3 }, { dx: -10, dy: 16, r0: 2, r1: 5.5, ph: 2.6 });
    for (let k = 0; k < 22; k++) { const a = R() * TAU, d = 10 + R() * 34; RIDERS.push({ dx: Math.cos(a) * d * 0.8, dy: Math.sin(a) * d + 12, r0: 0.7 + R() * 1.4, r1: 1.2 + R() * 3.6, ph: R() * TAU }); }
    for (let k = 0; k < 26; k++) RIDERS.push({ dx: (R() - 0.5) * 10, dy: 24 + k * 9 + R() * 6, r0: 0.6, r1: 0.6 + R() * 1.4, ph: R() * TAU, trail: true });
  }
  function drawRiders(t) {
    if (t < RIDE0 - 0.01) return;
    const yb = rideY(t);
    if (yb < -10) return;
    const grow = clamp((VBY - yb) / VBY, 0, 1);       // bubbles swell as the pressure falls
    for (const b of RIDERS) {
      const wob = Math.sin(t * 9 + b.ph) * (1.5 + b.r1 * 0.3);
      const age = t - RIDE0;
      const spread = Math.min(1, age / 1.2);
      const x = VBX - 4 * sstep(RIDE0, 29, t) + b.dx * spread + wob - CX;
      const wy = yb + b.dy * spread;
      if (wy < 1) continue;                             // reached the surface
      const y = wy - CH + 225;
      if (y < -12 || y > H + 12) continue;
      const r = lerp(b.r0, b.r1, Math.pow(grow, 0.7)) * (1 + 0.06 * Math.sin(t * 13 + b.ph));
      bubble(x, y, r, bubbleTint(x, y), 1);
    }
  }
  // a thin stream from the crack while the camera rests at the vent
  function drawVentStream(t) {
    if (!ventVisible()) return;
    for (let k = 0; k < 40; k++) {
      const te = fl(t / 0.21) * 0.21 - k * 0.21;
      const age = t - te;
      const sp = 46 + 20 * ih(fl(te * 100), 1, 940);
      const wy = VBY - age * sp - 0.5 * age * age * 8;
      const x = VBX + (ih(fl(te * 100), 2, 940) - 0.5) * 6 + Math.sin(age * 7 + te * 9) * 1.6 - CX;
      const y = wy - CH + 225;
      if (y < -4 || y > H + 4) continue;
      bubble(x, y, 0.7 + 1.6 * ih(fl(te * 100), 3, 940) * Math.min(1, age / 3), bubbleTint(x, y), 0.9);
    }
  }
  // the plunge: air dragged under with the camera, rushing back up
  function drawPlunge(t) {
    const dt = mod(t - 1.0, D);
    if (dt > 3.2) return;
    for (let k = 0; k < 170; k++) {
      const te = 1.05 + 0.9 * Math.pow(ih(k, 1, 950), 1.5);
      const age = t - te;
      if (age < 0 || age > 2.2) continue;
      const h0 = hAt(te);
      const x = 180 + (ih(k, 2, 950) - 0.5) * (W + 60) * (0.5 + 0.5 * ih(k, 5, 950)) + Math.sin(age * 6 + k) * 3 - CX;
      const r = 0.6 + 6.5 * Math.pow(ih(k, 3, 950), 2.6);
      const wy = h0 + 60 + ih(k, 4, 950) * 260 - age * (90 + 50 * r) - age * age * 30;
      if (wy < 2) continue;
      const y = wy - CH + 225;
      if (y < -8 || y > H + 8) continue;
      bubble(x, y, r * (1 + 0.08 * Math.sin(age * 20 + k)), bubbleTint(x, y), Math.min(1, (2.2 - age) * 2));
    }
  }
  // a few drops clinging to the lens while it is out of the water, running down and back into the sea
  function drawLens(t) {
    if (WLMAX <= 0) return;
    const age = mod(t - 31.75, D);
    if (age > 3.5) return;
    for (let k = 0; k < 9; k++) {
      const x = 12 + ih(k, 1, 960) * 336, r = 2 + 3.5 * ih(k, 2, 960);
      const y = 20 + ih(k, 3, 960) * 220 + age * (6 + 26 * ih(k, 4, 960) * r / 4) * age * 0.5;
      if (y > WLX[clamp(fl(x), 0, W - 1)] - r) continue;
      // a tiny lens: the sky flipped, a dark rim below, a bright point above
      for (let yy = fl(y - r); yy <= y + r; yy++) for (let xx = fl(x - r); xx <= x + r; xx++) {
        const dx = xx + 0.5 - x, dy = yy + 0.5 - y, d = Math.hypot(dx, dy) / r;
        if (d > 1 || xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const sy = clamp(fl(y - dy * 3), 0, H - 1), sx = clamp(fl(x - dx * 2), 0, W - 1), j = (yy * W + xx) * 3, k2 = (sy * W + sx) * 3;
        let rr = C[k2] * 1.04 + 6, gg = C[k2 + 1] * 1.04 + 6, bb = C[k2 + 2] * 1.03 + 6;
        if (d > 0.8 && dy > r * 0.4) { rr *= 0.9; gg *= 0.92; bb *= 0.95; }
        C2[j] = rr; C2[j + 1] = gg; C2[j + 2] = bb;
      }
      for (let yy = fl(y - r); yy <= y + r; yy++) for (let xx = fl(x - r); xx <= x + r; xx++) {
        const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y) / r;
        if (d > 1 || xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = (yy * W + xx) * 3; C[j] = C2[j]; C[j + 1] = C2[j + 1]; C[j + 2] = C2[j + 2];
      }
      addPx(x - r * 0.35, y - r * 0.4, 140, 140, 130); if (r > 3.5) addPx(x - r * 0.35 + 1, y - r * 0.4, 70, 70, 60);
    }
  }
  // speed blur: on the fast ride up, the world smears vertically (a running box filter per column)
  const BLR = new Float32Array(H * 3);
  function speedBlur() {
    const rad = Math.round(clamp((Math.abs(CV) - 420) / 36, 0, 22));
    if (rad < 1) return;
    const n = rad * 2 + 1;
    for (let x = 0; x < W; x++) {
      let sr = 0, sg = 0, sb = 0;
      for (let y = -rad; y <= rad; y++) { const j = (clamp(y, 0, H - 1) * W + x) * 3; sr += C[j]; sg += C[j + 1]; sb += C[j + 2]; }
      for (let y = 0; y < H; y++) {
        BLR[y * 3] = sr / n; BLR[y * 3 + 1] = sg / n; BLR[y * 3 + 2] = sb / n;
        const ja = (clamp(y + rad + 1, 0, H - 1) * W + x) * 3, jb = (clamp(y - rad, 0, H - 1) * W + x) * 3;
        sr += C[ja] - C[jb]; sg += C[ja + 1] - C[jb + 1]; sb += C[ja + 2] - C[jb + 2];
      }
      for (let y = 0; y < H; y++) { const j = (y * W + x) * 3; C[j] = BLR[y * 3]; C[j + 1] = BLR[y * 3 + 1]; C[j + 2] = BLR[y * 3 + 2]; }
    }
  }

  /* ================================================================ the manta */
  // gliding overhead in the blue, seen a little from below: a spotted pale belly in shadow, slow wingbeats
  function drawManta(t) {
    if (t < 8.4 || t > 13.6) return;
    const p = 0.6, s = 1.5, yaw = 0.95, cyw = Math.cos(yaw), syw = Math.sin(yaw);
    const proj = (u, w, lift) => [cx + (u * cyw + w * syw) * s, cy + ((-u * syw + w * cyw) * f - lift) * s];
    const cx = scrX(470 - (t - 8.4) * 118, p), cy = scrY(1430 - (t - 8.4) * 14, p);
    if (cx < -160 || cx > W + 160) return;
    const ts = fl(t * 12) / 12;
    const flap = Math.sin(per(9, ts));                  // a wingbeat every 3.6 s
    const S = 62, f = 0.66, fog = 0.26;
    // planform: leading edge from the head to the tip, a swept trailing edge back to the body
    const lead = (aw) => -20 + 32 * Math.pow(aw / S, 1.5), trail = (aw) => 22 - 10 * Math.pow(aw / S, 2.4) - (aw < 9 ? 0 : 3 * Math.sin((aw - 9) / (S - 9) * Math.PI));
    sprBegin();
    for (let w = -S; w <= S; w += 0.45 / s) {
      const aw = Math.abs(w), u0 = lead(aw), u1 = trail(aw);
      if (u1 < u0) continue;
      const lift = flap * 16 * Math.pow(aw / S, 1.8);
      for (let u = u0; u <= u1; u += 0.45 / s) {
        const pp = proj(u, w, lift), x = pp[0], y = pp[1];
        const rim = aw > S - 6 || u > u1 - 2.5 || u < u0 + 1.2;
        const spot = aw < 26 && u > -6 && u < 14 && vn2(u / 2.6, w / 2.6, 960) > 0.72;
        const gill = aw > 6 && aw < 13 && u > -10 && u < 2 && fr((u + 10) / 2.4) < 0.2;
        let c = rim ? [0.2, 0.22, 0.26] : spot || gill ? [0.24, 0.26, 0.3] : [1.15, 1.2, 1.25];
        if (!rim && aw > 30) c = mixA(c, [0.3, 0.32, 0.36], (aw - 30) / 40);
        sput(x, y, c[0], c[1], c[2], w / S * 0.3, 0.3, 0.8, 0);
      }
    }
    // cephalic fins curled at the head, the whip of a tail behind
    for (const side of [-1, 1]) for (let q = 0; q < 12; q++) { const a = q / 12, pp = proj(-21 - a * 7 + a * a * 4, side * (7 + a * 2) - a * a * 3 * side, 0); sput(pp[0], pp[1], 0.2, 0.22, 0.26, 0, 0.5, 0.6, 0); }
    for (let q = 0; q < 60; q += 0.6) { const pp = proj(22 + q, Math.sin(q * 0.12 - per(9, ts)) * 2 * (q / 60), 0); sput(pp[0], pp[1], 0.22, 0.24, 0.28, 0, 0, 1, 0); }
    sprEnd(fog, 1, 0.7, 1.4);
  }

  /* ================================================================ post: living-light halos and the shafts' veil */
  function drawHalos() {
    for (const L of LIGHTS) {
      if (!L.halo) continue;
      const R = L.rad * 2.2, x0 = Math.max(0, fl(L.x - R)), x1 = Math.min(W - 1, Math.ceil(L.x + R)), y0 = Math.max(0, fl(L.y - R)), y1 = Math.min(H - 1, Math.ceil(L.y + R));
      const rr = (L.rad * 0.35) * (L.rad * 0.35);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = x - L.x, dy = y - L.y, d2 = dx * dx + dy * dy;
        if (d2 > R * R) continue;
        const a = L.halo / (1 + d2 / rr) * (1 - d2 / (R * R));
        const j = (y * W + x) * 3;
        C[j] += L.r * a; C[j + 1] += L.g * a; C[j + 2] += L.b * a;
      }
    }
  }

  /* ================================================================ quantise */
  function quantise() {
    const DA = 4.2, K = 63 / Math.sqrt(255);
    for (let y = 0, i = 0; y < H; y++) {
      const by = (y & 3) << 2;
      for (let x = 0; x < W; x++, i++) {
        const j = i * 3, d = BAY[by | (x & 3)] * DA;
        let r = C[j], g = C[j + 1], b = C[j + 2];
        r = r <= 0 ? 0 : r >= 255 ? 63 : Math.sqrt(r) * K; g = g <= 0 ? 0 : g >= 255 ? 63 : Math.sqrt(g) * K; b = b <= 0 ? 0 : b >= 255 ? 63 : Math.sqrt(b) * K;
        let qr = (r + d + 0.5) | 0, qg = (g + d + 0.5) | 0, qb = (b + d + 0.5) | 0;
        qr = qr < 0 ? 0 : qr > 63 ? 63 : qr; qg = qg < 0 ? 0 : qg > 63 ? 63 : qg; qb = qb < 0 ? 0 : qb > 63 ? 63 : qb;
        OUT[i] = LUT[(qr << 12) | (qg << 6) | qb];
      }
    }
  }

  /* ================================================================ frame */
  let PROF = null;
  const stage = (name, fn, t) => {
    if (!PROF) { fn(t); return; }
    const t0 = performance.now(); fn(t); PROF[name] = (PROF[name] || 0) + performance.now() - t0;
  };
  function render(t) {
    t = mod(t, D);
    setCamera(t);
    LIGHTS.length = 0;
    causLattice(t);
    CGST++;
    shaftProfile(t);
    WLMAX = -1e9; WLMIN = 1e9;
    for (let x = 0; x < W; x++) { const w = waterline(x, t); WLX[x] = w; if (w > WLMAX) WLMAX = w; if (w < WLMIN) WLMIN = w; }
    collectLights(t);
    stage('water', drawWater, t);
    stage('ceiling', drawCeiling, t);
    stage('reef', drawReef, t);
    stage('reeffish', drawReefFish, t);
    stage('school', drawSchool, t);
    stage('turtle', drawTurtle, t);
    stage('scene', drawScene, t);
    stage('stream', drawVentStream, t);
    stage('particles', drawParticles, t);
    stage('near', drawNear, t);
    stage('halos', drawHalos, t);
    stage('blur', speedBlur, t);
    stage('riders', drawRiders, t);
    stage('plunge', drawPlunge, t);
    stage('above', drawAbove, t);
    stage('lens', drawLens, t);
    stage('edge', drawWaterlineEdge, t);
    stage('quantise', quantise, t);
  }
  // filled in below
  function collectLights(t) { ventLights(t); }
  function drawScene(t) {
    drawFarLights(t);
    drawManta(t);
    // twilight: two far jellies, the siphonophore, a near jelly
    if (t > 9.5 && t < 18) {
      drawJelly(scrX(64, 0.45), scrY(1990 + (t - 12) * 30, 0.45), 0.55, t, 'helmet', 0.3, 0.22, 0.15);
      drawJelly(scrX(292, 0.55), scrY(2070 + (t - 12) * 20, 0.55), 0.62, t, 'moon', 0.65, 0.18, -0.2);
      drawJelly(scrX(250, 0.78), scrY(2010 + (t - 12) * 24, 0.78), 0.82, t, 'moon', 0.45, 0.1, -0.1 + 0.04 * Math.sin(per(3, t)));
      drawSiphonophore(t);
      drawJelly(scrX(118 + (t - 11) * 3, 0.95), scrY(1810 + (t - 11) * 30, 0.95), 1.3, t, 'stripe', 0.1, 0.08, 0.12 + 0.05 * Math.sin(per(2, t)));
    }
    drawComb(t);
    drawLanternfish(t);
    drawSparks(t);
    drawAngler(t);
    drawVent(t);
  }
  function drawNear(t) { drawVentNear(t); }

  let BUILT = false;
  function build() {
    if (BUILT) return;
    buildLUT();
    buildDepth();
    buildFields();
    buildParticles();
    paintReef();
    buildReefFish();
    buildSchool();
    buildLantern();
    buildFarLights();
    paintVent();
    buildShrimp();
    buildRiders();
    BUILT = true;
  }

  const core = { W, H, D, PAL, OUT, C, build, render, hAt, get CH() { return CH; }, prof(on) { PROF = on ? {} : null; return PROF; }, get PROF() { return PROF; } };
  window.__descentCore = core;
  if (typeof document === 'undefined') return;

  /* ================================================================ present */
  let SMALL = null, SG = null, IMG = null, PIX = null;
  const LE = new Uint8Array(new Uint32Array([0x01020304]).buffer)[0] === 4;
  const PACK = new Uint32Array(NPAL);
  function present(g, k) {
    if (!SMALL) {
      SMALL = document.createElement('canvas'); SMALL.width = W; SMALL.height = H;
      SG = SMALL.getContext('2d'); IMG = SG.createImageData(W, H); PIX = new Uint32Array(IMG.data.buffer);
      for (let n = 0; n < NPAL; n++) { const p = PAL[n]; PACK[n] = (LE ? ((255 << 24) | (p[2] << 16) | (p[1] << 8) | p[0]) : ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | 255)) >>> 0; }
    }
    for (let i = 0; i < NP; i++) PIX[i] = PACK[OUT[i]];
    SG.putImageData(IMG, 0, 0);
    if (!g) return;
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(SMALL, 0, 0, W * k, H * k);
  }
  function pixelsB64() {
    // the 360 × 450 frame as raw RGB, base64 (the export scales it ×3 nearest-neighbour)
    const buf = new Uint8Array(NP * 3);
    for (let i = 0; i < NP; i++) { const p = PAL[OUT[i]]; buf[i * 3] = p[0]; buf[i * 3 + 1] = p[1]; buf[i * 3 + 2] = p[2]; }
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  }

  /* ================================================================ mount */
  (window.PIECES = window.PIECES || []).push({
    id: 'the-descent',
    title: 'The Descent',
    medium: 'Pixel art in 52 colours, 360 × 450, drawn in JavaScript · 32 s loop',
    note: 'From the sunlit surface to a vent in the abyss · tap to pause',
    about: 'One continuous fall through the sea. The camera sinks through the sparkling surface, past a reef where caustics dance, through a swirling bait ball of silver fish and a passing turtle, into the blue twilight of jellies and siphonophores where marine snow streams upward, and on into the midnight zone, where the only light is alive: comb jellies, lanternfish, an anglerfish’s lure. At the bottom a black smoker glows and shimmers among tube worms, crabs and shrimp, until a cluster of its bubbles lets go and carries the camera all the way back up into the sun.',
    tone: 'dark',
    room: '#020308',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      SEED = 5; // composed for one seed
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0, built = false;
      el.style.background = '#020308';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;image-rendering:pixelated;image-rendering:crisp-edges;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(230,244,240,.82)"/><rect x="19" y="9" width="5" height="16" fill="rgba(230,244,240,.82)"/></svg>';
      el.appendChild(pauseMark);
      let K = 3;
      function fit() {
        const dpr = Math.min(3, window.devicePixelRatio || 1);
        let left = 0, top = 0, cssW, cssH;
        if (EXPORT) { cssW = 1080; cssH = 1350; cv.style.position = 'fixed'; K = 3; }
        else {
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          const f = Math.min(w * dpr / W, h * dpr / H) * 0.97;
          const k = Math.max(1, Math.floor(f));
          if (k < f * 0.88) { K = Math.max(1, Math.ceil(f)); cssW = W * f / dpr; cssH = H * f / dpr; }
          else { K = k; cssW = W * k / dpr; cssH = H * k / dpr; }
          left = Math.round((w - cssW) / 2); top = Math.round((h - cssH) / 2);
        }
        if (cv.width !== W * K || cv.height !== H * K) { cv.width = W * K; cv.height = H * K; }
        cv.style.left = left + 'px'; cv.style.top = top + 'px'; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
        pauseMark.style.left = (left + cssW - 48) + 'px'; pauseMark.style.top = (top + 14) + 'px';
      }
      const draw = (t) => { render(t); present(g, K); };
      fit();
      build();
      built = true;
      draw(0);
      if (EXPORT) {
        const faded = () => { const st = el.parentElement; return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999; };
        window.__descent = {
          duration: D,
          isReady: () => built && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); draw(t); window.__descent.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          pixels: pixelsB64,
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'the-descent';
        api.ready();
      } else {
        window.__descent = { duration: D, isReady: () => built, lastMs: 0, renderAt(t) { return new Promise((res) => { playing = false; clock = t; const t0 = performance.now(); draw(t); window.__descent.lastMs = performance.now() - t0; requestAnimationFrame(() => res()); }); } };
        api.ready();
      }
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        raf = requestAnimationFrame(frame);
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
        if (!playing) return;
        clock = (clock + dt) % D;
        const t0 = performance.now();
        draw(clock);
        if (window.__descent) window.__descent.lastMs = performance.now() - t0;
      }
      if (!EXPORT) raf = requestAnimationFrame(frame);
      const onDown = () => { if (EXPORT) return; playing = !playing; last = 0; pauseMark.style.opacity = playing ? '0' : '1'; };
      cv.addEventListener('pointerdown', onDown);
      let rt = 0;
      const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (!alive) return; fit(); draw(clock); }, 120); });
      ro.observe(el);
      return {
        destroy() {
          alive = false; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(rt);
          cv.removeEventListener('pointerdown', onDown);
          if (window.__descent) delete window.__descent;
        },
      };
    },
  });
})();
