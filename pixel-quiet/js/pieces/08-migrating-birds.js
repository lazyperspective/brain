/* Migrating Birds — Quiet Hours, piece 8.
 *
 * A 40-second seamless loop over a meadow. On the left a big terracotta-leaved tree is home to a flock of small
 * birds, each with its own colour and manner; across the meadow, small with distance, stands a cool blue-leaved
 * tree. Through one turn of the light (golden afternoon, sunset, dusk with fireflies, night with stars, dawn, and
 * gold again) four birds leave, one at a time. A yellow one flies to the blue tree and settles there. A cream one
 * with a russet cap and a tuft, who always has a twig in its beak, flies there too and takes its twig along. A
 * plump lavender one, sleepy all evening, glides down to a hollow in an old stump, tucks its head under its wing
 * and sleeps. A teal one with a long tail flies to the signpost where the path forks, and looks one way, then the
 * other, and at dawn flies off over the horizon. The home tree stays full: the others preen, hop and sing, sleep
 * through the night, wake into a dawn chorus, and an egg in the nest hatches.
 *
 * The loop closes with everyone out of sight at the seam: at t = 0 the four are tucked inside the home tree's
 * leaves and hop out onto the branches in the first seconds; by t = D the two in the blue tree have gone in among
 * its leaves to roost, the sleeper has curled back into the dark of its hollow, and the bird at the signpost has
 * flown beyond the hills. The chick is under its brooding parent at both ends. Nobody comes back.
 *
 * Every frame is a pure function of t. The meadow, the hills, the stump, the signpost, the trunk and every leaf
 * cluster are painted once at mount as albedo and a light coefficient, and relit every frame by the hour's
 * ambient and sun colours (the sun is in the picture, so the trees are rim-lit from the right). The birds are
 * rasterised every frame from a few ellipses and triangles (body, head, wing, tail, beak, crest) with a selective
 * outline, so they can tilt their heads, flap and glide at any size; they shrink with distance as they fly away.
 * The image is quantised with a 4 × 4 Bayer dither in a square-root space to a 64-colour palette (the birds and
 * small sprites with a much weaker dither so they stay crisp); 360 × 450, shown at 3×.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 360, H = 450, NP = W * H, D = 40;
  const TAU = Math.PI * 2, fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const s5 = (u) => { u = clamp(u, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };
  const ph = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const mod = (a, n) => ((a % n) + n) % n;
  const per = (k, t) => TAU * k * t / D;       // a phase that turns k whole times per loop
  const bump = (t, a, b, e) => sstep(a, a + e, t) * (1 - sstep(b - e, b, t));
  let SEED = 8;
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

  /* ================================================================ palette (64) */
  const PAL_HEX = [
    '0a0b1a', '131833', '1d2549', '2a3762', '3b4c7c', '536894', '7088ad', '93abc7', 'bcd0de', 'e2ecee',   // 0-9   sky, night
    '2b1d3d', '46305a', '664678', '8c6290', 'b5809f', 'd9a2ae',                                     // 10-15 dusk violets, rose
    'f2c1a4', 'f8d6a8', 'fdebc6', 'fff8e6', 'f4ae6a', 'e8854e',                                     // 16-21 warm sky, cream, orange
    '2e1016', '4c1a1f', '6e2525', '92322b', 'b44834', 'd2633f', 'ea8556', 'f5a877',                 // 22-29 the home tree: terracotta, coral
    '1d2b45', '2a4466', '3c6188', '5784ad', '7eabcd', 'a9cde3',                                     // 30-35 the blue tree
    '1c1214', '33211f', '4f3427', '6e4b33', '916844', 'b58b5c', 'd6b585',                           // 36-42 bark, wood, path
    '111c14', '1b2d1d', '293f23', '3b5529', '536e31', '708b3b', '92a74b', 'b8c26b', 'dbd897',       // 43-51 the meadow
    'f6cf55', 'd6a032', '9c7a2c',                                                                   // 52-54 yellow (a bird, buttercups)
    'a69bc0', 'cfc5de', '6f6a8a',                                                                   // 55-57 lavender (a bird)
    '1f6b6a', '2e9690', '6ccab6',                                                                   // 58-60 teal (a bird)
    'e3f7a0', 'ff9a8a', 'a8968a',                                                                   // 61-63 firefly, blush, warm grey
  ];
  const PAL = PAL_HEX.map(hx), NPAL = PAL.length;
  // nearest colour in a square-root space, with a few families reserved for inputs that clearly ask for them,
  // so the sky never turns teal and the grass never turns yellow-bird
  const QN = 64, LUT = new Uint8Array(QN * QN * QN);
  function nearest(r, g, b) {
    let best = 0, bd = 1e18;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx > 1 ? (mx - mn) / mx : 0;
    const tealOK = g > r * 1.25 && g > b * 0.92 && sat > 0.3;
    const yelOK = r > b * 1.9 && g > b * 1.5 && sat > 0.45;
    const fireOK = g >= r * 0.98 && g > b * 1.35 && mx > 200;
    const pinkOK = r > g * 1.35 && r > b * 1.2 && mx > 190;
    const greenOK = g >= r * 0.78 && g >= b * 1.0;
    const blueOK = b > r * 1.1;
    for (let k = 0; k < NPAL; k++) {
      if (k >= 58 && k <= 60 && !tealOK) continue;
      if (k >= 52 && k <= 54 && !yelOK) continue;
      if (k === 61 && !fireOK) continue;
      if (k === 62 && !pinkOK) continue;
      if (k >= 43 && k <= 51 && !greenOK) continue;
      if (k >= 30 && k <= 35 && !blueOK) continue;
      const p = PAL[k], dr = r - p[0], dg = g - p[1], db = b - p[2], rm = (r + p[0]) * 0.5;
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
  const C = new Float32Array(NP * 3);    // frame colour, 0..255
  const DM = new Uint8Array(NP);         // 1 = crisp (sprites): weak dither
  const OUT = new Uint8Array(NP);        // palette indices
  let PXN = 0;                           // how much the tracked groups show (motion check)
  // leak check: where a bird that should be out of sight would be drawn, and what covers it
  const HM = new Uint8Array(NP), COV = new Uint8Array(NP);
  let HIDE = false, LEAK = false;

  /* ================================================================ the light: one turn of the day per loop */
  // cyclic Catmull–Rom through keys [t, v...]
  function cyc(keys, period, x, out) {
    const n = keys.length, m = keys[0].length - 1;
    x = mod(x, period);
    let i = n - 1;
    for (let k = 0; k < n; k++) if (keys[k][0] <= x) i = k;
    const tk = (j) => keys[mod(j, n)][0] + Math.floor(j / n) * period;
    const t0 = tk(i - 1), t1 = tk(i), t2 = tk(i + 1), t3 = tk(i + 2);
    const k0 = keys[mod(i - 1, n)], k1 = keys[mod(i, n)], k2 = keys[mod(i + 1, n)], k3 = keys[mod(i + 2, n)];
    let xx = x; if (xx < t1) xx += period;
    const h = t2 - t1, s = (xx - t1) / h, s2 = s * s, s3 = s2 * s;
    for (let c = 0; c < m; c++) {
      const v0 = k0[c + 1], v1 = k1[c + 1], v2 = k2[c + 1], v3 = k3[c + 1];
      const m1 = (v2 - v0) / (t2 - t0) * h * 0.85, m2 = (v3 - v1) / (t3 - t1) * h * 0.85;
      out[c] = (2 * s3 - 3 * s2 + 1) * v1 + (s3 - 2 * s2 + s) * m1 + (-2 * s3 + 3 * s2) * v2 + (s3 - s2) * m2;
    }
    return out;
  }
  // [t, ambient rgb, sun rgb, sky top rgb, sky middle rgb, sky horizon rgb, night, fireflies, sun glow]
  const LKEYS = [
    [0.0, 0.56, 0.52, 0.56, 0.70, 0.56, 0.34, 112, 152, 200, 196, 204, 206, 252, 216, 166, 0, 0, 0.75],   // golden afternoon
    [5.5, 0.52, 0.44, 0.48, 0.78, 0.50, 0.26, 104, 132, 186, 210, 182, 176, 252, 196, 128, 0, 0, 0.9],    // late gold
    [10.5, 0.44, 0.33, 0.40, 0.80, 0.38, 0.16, 82, 92, 156, 204, 134, 146, 248, 156, 96, 0, 0, 1.0],     // sunset
    [14.0, 0.33, 0.25, 0.38, 0.34, 0.14, 0.12, 56, 60, 112, 150, 98, 140, 224, 134, 122, 0.05, 0.1, 0.45], // afterglow
    [18.0, 0.26, 0.24, 0.42, 0.08, 0.07, 0.12, 30, 36, 82, 70, 62, 116, 136, 92, 132, 0.45, 0.8, 0.08],   // dusk
    [22.0, 0.24, 0.27, 0.45, 0.15, 0.18, 0.30, 12, 15, 38, 24, 32, 66, 46, 54, 96, 0.95, 1.0, 0],        // night
    [28.5, 0.24, 0.27, 0.45, 0.15, 0.18, 0.30, 11, 14, 36, 22, 30, 64, 44, 52, 94, 1.0, 1.0, 0],        // night
    [31.5, 0.26, 0.25, 0.40, 0.14, 0.10, 0.14, 30, 36, 78, 84, 72, 124, 186, 124, 142, 0.55, 0.55, 0.15], // first light
    [34.5, 0.38, 0.34, 0.44, 0.58, 0.38, 0.30, 86, 108, 166, 202, 162, 172, 252, 190, 158, 0.05, 0, 0.7],  // dawn
    [37.5, 0.52, 0.48, 0.54, 0.70, 0.54, 0.36, 108, 146, 196, 196, 198, 204, 252, 212, 168, 0, 0, 0.75],  // morning gold
  ];
  const SUNK = [[0, 258, 168], [5.5, 270, 208], [10.5, 283, 258], [14, 292, 300], [20, 296, 380], [27, 196, 390], [32, 198, 306],
    [34.5, 204, 272], [37.5, 228, 210]];
  const LT = new Array(18).fill(0), ST = [0, 0];
  const LS = { ar: 0, ag: 0, ab: 0, kr: 0, kg: 0, kb: 0, top: [0, 0, 0], mid: [0, 0, 0], hor: [0, 0, 0], night: 0, fire: 0, glow: 0,
    sx: 0, sy: 0, moon: 0, mx: 0, my: 0 };
  function setLight(t) {
    cyc(LKEYS, D, t, LT);
    LS.ar = LT[0]; LS.ag = LT[1]; LS.ab = LT[2]; LS.kr = Math.max(0, LT[3]); LS.kg = Math.max(0, LT[4]); LS.kb = Math.max(0, LT[5]);
    LS.top[0] = LT[6]; LS.top[1] = LT[7]; LS.top[2] = LT[8];
    LS.mid[0] = LT[9]; LS.mid[1] = LT[10]; LS.mid[2] = LT[11];
    LS.hor[0] = LT[12]; LS.hor[1] = LT[13]; LS.hor[2] = LT[14];
    LS.night = clamp(LT[15], 0, 1); LS.fire = clamp(LT[16], 0, 1); LS.glow = clamp(LT[17], 0, 1.2);
    cyc(SUNK, D, t, ST); LS.sx = ST[0]; LS.sy = ST[1];
    // the moon: up from dusk to dawn, drifting slowly up and right
    LS.moon = sstep(16.5, 20, t) * (1 - sstep(32.5, 35.5, t));
    const mu = ph(t, 15, 37);
    LS.mx = 236 + 44 * mu; LS.my = 78 - 26 * Math.sin(mu * Math.PI * 0.8);
  }
  const wind = (t) => 0.6 * Math.sin(per(3, t) + 0.4) + 0.3 * Math.sin(per(7, t) + 1.1) + 0.14 * Math.sin(per(13, t) + 2.0);

  /* ================================================================ the scene, painted once */
  const HZ = 280;                                  // the far edge of the meadow
  const WALB = new Float32Array(NP * 3);           // albedo of the static world (hills, meadow, stump, signpost)
  const WLIT = new Float32Array(NP);               // how much of the sun each pixel gets
  const WFOG = new Float32Array(NP);               // how much of the horizon's air lies over it
  const WM = new Uint8Array(NP);                   // 1 = world, 0 = sky
  const SKYGLOW = new Float32Array(NP);            // grass tips that catch the low sun (rim on the meadow)
  const farRidge = (x) => 254 + 9 * fbm(x / 70, 0.3, 11, 3) + 3 * Math.sin(x / 31) - 7 * Math.exp(-Math.pow((x - 120) / 60, 2));
  const nearRidge = (x) => 271 + 5 * fbm(x / 50, 2.3, 12, 3) - 6 * Math.exp(-Math.pow((x - 300) / 40, 2)) + 2 * Math.exp(-Math.pow((x - 200) / 30, 2));
  // the path: from the bottom of the frame up to the signpost, where it forks left and right
  const SPX = 206, SPY = 336;                      // the signpost's foot
  const PATH = [
    [[262, 464, 40], [250, 436, 32], [228, 408, 24], [212, 380, 17], [208, 356, 12], [SPX + 1, SPY + 2, 9]],
    [[SPX, SPY + 1, 9], [186, 322, 7], [160, 308, 5], [136, 298, 3.5], [112, 290, 2.2], [92, 286, 1.4]],
    [[SPX + 2, SPY + 1, 9], [232, 320, 7], [262, 305, 5], [292, 295, 3.5], [322, 289, 2.2], [350, 285, 1.4]],
  ];
  function pathDist(x, y) {                        // (distance to the path edge, negative inside)
    let best = 1e9;
    for (const P of PATH) for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1], vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy;
      const u = clamp(((x - a[0]) * vx + (y - a[1]) * vy) / L2, 0, 1);
      const dx = x - a[0] - u * vx, dy = y - a[1] - u * vy, w = lerp(a[2], b[2], u) / 2;
      const d = Math.hypot(dx, dy * 1.6) - w;
      if (d < best) best = d;
    }
    return best;
  }
  const setW = (i, r, g, b, lit, fog) => { WALB[i * 3] = r; WALB[i * 3 + 1] = g; WALB[i * 3 + 2] = b; WLIT[i] = lit; WFOG[i] = fog; WM[i] = 1; };

  function paintWorld() {
    for (let x = 0; x < W; x++) {
      const fr0 = farRidge(x), nr0 = nearRidge(x);
      for (let y = 0; y < H; y++) {
        const i = y * W + x;
        if (y >= fr0 && y < nr0) {
          // the far hills: hazy, with a hint of trees along their crests
          const tr = fbm(x / 6, y / 3, 13, 3);
          const u = (y - fr0) / Math.max(1, nr0 - fr0);
          setW(i, 96 + 20 * tr, 112 + 24 * tr, 104 + 10 * tr, 0.3 + 0.4 * (1 - u) * tr, 0.62 - 0.1 * u);
        } else if (y >= nr0) {
          // the meadow: texture scales up toward the viewer
          const dep = clamp((y - HZ) / (H - HZ), 0, 1), s = 1 + 6 * dep * dep;
          const n1 = fbm(x / (5 * s), y / (1.6 * s), 21, 4), n2 = fbm(x / (1.3 * s), y / (0.9 * s), 22, 2);
          const patch = fbm(x / 60, y / 25, 23, 3);
          let r = lerp(112, 92, dep) + 34 * (patch - 0.5) + 30 * (n1 - 0.5);
          let g = lerp(146, 132, dep) + 30 * (patch - 0.5) + 34 * (n1 - 0.5);
          let b = lerp(80, 60, dep) + 10 * (n1 - 0.5);
          // dry golden patches toward the far meadow
          const dry = sstep(0.55, 0.75, fbm(x / 40, y / 12, 24, 3)) * (1 - dep * 0.6);
          r += 24 * dry; g += 14 * dry; b -= 4 * dry;
          let lit = 0.35 + 0.5 * n2 * n1 + 0.15 * (1 - dep);
          // blade strokes in the near meadow
          if (dep > 0.25) { const bl = vn2(x / 1.2, y / (2.2 + 4 * dep), 25); if (bl > 0.72) { r *= 1.12; g *= 1.14; lit += 0.25; } else if (bl < 0.22) { r *= 0.72; g *= 0.74; b *= 0.8; lit *= 0.7; } }
          const fog = 0.36 * Math.pow(1 - dep, 4);
          setW(i, r, g, b, clamp(lit, 0, 1), fog);
          SKYGLOW[i] = (1 - dep) * (n2 > 0.6 ? 1 : 0.3);
          // the path
          const pd = pathDist(x + 0.5, y + 0.5);
          const edge = (fbm(x / 3, y / 2, 26, 2) - 0.5) * (1.4 + 3 * dep);
          if (pd + edge < 0) {
            const pn = fbm(x / (1.6 * s), y / (1.1 * s), 27, 3) * 0.7 + 0.3 * vn2(x / 1.3, y / 1.3, 29), peb = ih(x, y, 28);
            let pr = 206 + 30 * (pn - 0.5), pg = 176 + 26 * (pn - 0.5), pb = 124 + 20 * (pn - 0.5), pl = 0.55 + 0.3 * pn;
            if (pd + edge > -1.2) { pr *= 0.86; pg *= 0.84; pb *= 0.82; pl *= 0.8; }           // the worn edge
            if (dep > 0.3 && peb > 0.985) { pr = 150; pg = 136; pb = 120; pl = 0.9; }            // pebbles
            if (dep > 0.3 && peb < 0.012) { pr = 120; pg = 98; pb = 80; pl = 0.3; }
            setW(i, pr, pg, pb, pl, fog);
          }
        }
      }
    }
    // a soft shade under the home tree
    for (let y = 300; y < H; y++) for (let x = 0; x < 200; x++) {
      const i = y * W + x; if (!WM[i]) continue;
      const d = Math.hypot((x - 82) / 120, (y - 438) / 40), sh = 1 - 0.45 * Math.exp(-d * d * 1.6);
      WLIT[i] *= sh; WALB[i * 3] *= lerp(1, sh, 0.5); WALB[i * 3 + 1] *= lerp(1, sh, 0.4); WALB[i * 3 + 2] *= lerp(1, sh, 0.3);
    }
    paintFlowers();
    paintSignpost();
    paintStump();
  }

  // flowers: specks far away, little stars near; the nearest ones are drawn every frame so they can nod
  const NEARFL = [];
  function paintFlowers() {
    const R = mulberry32(808);
    const kinds = [[250, 246, 232, 250, 214, 90], [246, 210, 84, 246, 210, 84], [236, 128, 92, 250, 170, 120], [196, 170, 226, 230, 210, 240], [250, 196, 204, 255, 230, 230]];
    for (let n = 0; n < 1300; n++) {
      const yy = HZ + 2 + Math.pow(R(), 0.8) * (H - HZ - 2), x = R() * W, y = yy;
      const xi = fl(x), yi = fl(y), i = yi * W + xi;
      if (yi >= H || !WM[i]) continue;
      if (pathDist(x, y) < 1.5) continue;
      if (y < nearRidge(x) + 1) continue;
      if (x < 165 && y > 300 && Math.hypot((x - 80) / 34, (y - 420) / 30) < 1) continue;          // not on the trunk's roots
      const kd = kinds[R() < 0.42 ? 0 : R() < 0.35 ? 1 : R() < 0.5 ? 2 : R() < 0.6 ? 3 : 4];
      const dep = (y - HZ) / (H - HZ);
      if (dep > 0.72) { if (R() < 0.18) NEARFL.push({ x, y, k: kd, s: 1 + (R() < 0.4 ? 1 : 0), ph: R() * TAU }); continue; }
      const fog = 0.36 * Math.pow(1 - dep, 4);
      if (dep < 0.3) { if (R() < 0.6) setW(i, kd[0], kd[1], kd[2], 0.7, fog); continue; }
      // a small cross with a centre
      setW(i, kd[3], kd[4], kd[5], 0.8, fog);
      if (dep > 0.55 && R() < 0.5) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]]) { const j = (yi + dy) * W + xi + dx; if (xi + dx >= 0 && xi + dx < W) setW(j, kd[0], kd[1], kd[2], 0.75, fog); }
      if (dep > 0.45 && yi + 1 < H) setW((yi + 1) * W + xi, 60, 96, 44, 0.3, fog);
    }
  }

  // the signpost where the path forks: a weathered post, two arrow boards, no letters
  const SIGN = { top: 293, lx0: 183, ly: 300, rx1: 232, ry: 309 };
  function paintSignpost() {
    const px0 = SPX - 2, px1 = SPX + 2;
    for (let y = SIGN.top; y <= SPY + 2; y++) for (let x = px0; x <= px1; x++) {
      const u = (x - px0) / (px1 - px0), gr = ih(x, y >> 1, 40);
      const lit = x === px1 ? 0.95 : x === px0 ? 0.15 : 0.5 + 0.1 * u;
      setW(y * W + x, 118 + 20 * gr, 86 + 14 * gr, 58, lit, 0.05);
    }
    for (let x = px0 - 1; x <= px1 + 1; x++) setW((SIGN.top - 1) * W + x, 96, 70, 50, x > SPX ? 0.8 : 0.3, 0.05);  // its little cap
    // the boards: a left arrow above, a right arrow below
    const board = (x0, x1, y0, dir) => {
      for (let y = y0; y < y0 + 6; y++) for (let x = x0 - 4; x <= x1 + 4; x++) {
        const dy = Math.abs(y - (y0 + 2.5));
        let inside = x >= x0 && x <= x1;
        if (dir < 0 && x < x0) inside = (x0 - x) <= 3.5 - dy + 0.2;
        if (dir > 0 && x > x1) inside = (x - x1) <= 3.5 - dy + 0.2;
        if (!inside) continue;
        const gr = vn2(x / 3, y * 2, 41), edgeT = y === y0, edgeB = y === y0 + 5;
        let r = 172 + 30 * gr, g = 134 + 22 * gr, b = 88 + 10 * gr, lit = 0.6 + 0.2 * gr;
        if (edgeT) { r *= 1.08; g *= 1.08; lit = 0.95; }
        if (edgeB) { r *= 0.62; g *= 0.6; b *= 0.62; lit = 0.2; }
        if ((y === y0 + 2) && ih(x, 0, 42) > 0.75 && x >= x0 && x <= x1) { r *= 0.85; g *= 0.83; }        // grain
        setW(y * W + x, r, g, b, lit, 0.05);
      }
      // two nail heads
      const nx = dir < 0 ? x1 - 2 : x0 + 2;
      setW((y0 + 2) * W + nx, 70, 60, 56, 0.3, 0.05);
    };
    board(SIGN.lx0 + 3, SPX + 3, SIGN.ly, -1);
    board(SPX - 2, SIGN.rx1 - 3, SIGN.ry, 1);
    // tufts of grass round its foot
    for (let k = 0; k < 14; k++) { const x = SPX - 6 + k, h = 2 + fl(3 * ih(k, 1, 43)); for (let j = 0; j < h; j++) setW((SPY + 2 - j) * W + x, 84, 120, 56, 0.6 + 0.1 * j, 0.05); }
  }

  // the old stump in the near meadow, with a hollow where a bird can sleep
  const STUMP = { cx: 304, top: 370, bot: 422, rx: 27, ry: 7, hx: 295, hy: 393, hrx: 8, hry: 9.5 };
  function stumpHollow(x, y) { return Math.pow((x - STUMP.hx) / STUMP.hrx, 2) + Math.pow((y - STUMP.hy) / STUMP.hry, 2); }
  function paintStump() {
    const S = STUMP;
    for (let y = S.top - S.ry - 1; y <= S.bot + 3; y++) for (let x = S.cx - S.rx - 6; x <= S.cx + S.rx + 6; x++) {
      if (x < 0 || x >= W) continue;
      const i = y * W + x, dx = (x + 0.5 - S.cx) / S.rx;
      // the body flares out at the foot (roots)
      const flare = sstep(S.bot - 12, S.bot + 2, y) * (0.28 + 0.12 * Math.sin(y * 0.9 + x * 0.2));
      const half = 1 + flare + 0.04 * Math.sin(y * 0.7);
      const topY = S.top + S.ry * Math.sqrt(Math.max(0, 1 - dx * dx));      // front edge of the cut
      const inCut = Math.pow((x + 0.5 - S.cx) / S.rx, 2) + Math.pow((y + 0.5 - S.top) / S.ry, 2) < 1;
      const inBody = Math.abs(dx) < half && y >= S.top && y <= S.bot + 2 - 2 * Math.abs(dx) * (1 - flare);
      if (inCut) {
        // the cut top: pale wood with rings, moss creeping over the back rim
        const rr = Math.hypot((x + 0.5 - S.cx) / S.rx, (y + 0.5 - S.top) / S.ry);
        const ring = 0.5 + 0.5 * Math.sin(rr * 18 + fbm(x / 4, y / 2, 50, 2) * 4);
        let r = 196 + 26 * ring, g = 162 + 20 * ring, b = 112 + 14 * ring, lit = 0.8;
        if (rr > 0.86) { r = 120; g = 86; b = 58; lit = 0.6; }
        const moss = fbm(x / 5, y / 3, 51, 3);
        if (moss > 0.58 && y < S.top) { r = 106; g = 142; b = 58; lit = 0.85; }
        setW(i, r, g, b, lit, 0.0);
      } else if (inBody) {
        const nx = clamp(dx / half, -1, 1);
        const groove = vn2(x / 1.6, y / 9, 52), mo = fbm(x / 6, y / 4, 53, 3);
        let r = 112 + 30 * groove, g = 80 + 22 * groove, b = 58 + 12 * groove;
        let lit = clamp(0.15 + 0.85 * Math.max(0, nx * 0.9 + 0.25), 0, 1) * (0.7 + 0.3 * groove);
        if (groove < 0.3) { r *= 0.6; g *= 0.6; b *= 0.65; lit *= 0.6; }
        if (mo > 0.6 && (nx < 0 || y > S.bot - 8)) { r = 92 + 30 * mo; g = 128 + 30 * mo; b = 52; }      // moss
        // the hollow: a dark oval with a lit lip
        const hd = stumpHollow(x + 0.5, y + 0.5);
        if (hd < 1) { const k = Math.sqrt(hd); r = 26 + 22 * k; g = 16 + 14 * k; b = 18 + 10 * k; lit = 0.05 + 0.1 * k; }
        else if (hd < 1.45) { const top = y + 0.5 < S.hy; r = top ? 70 : 168; g = top ? 48 : 128; b = top ? 36 : 88; lit = top ? 0.2 : 0.75; }
        void topY;
        setW(i, r, g, b, lit, 0.0);
      }
    }
    // two small mushrooms at its foot, a fern on the left
    const mush = (mx, my, h, cw) => {
      for (let y = my - h; y <= my; y++) setW(y * W + mx, 236, 222, 196, 0.7, 0);
      for (let x = mx - cw; x <= mx + cw; x++) for (let y = my - h - 2; y <= my - h; y++) {
        if (y === my - h - 2 && Math.abs(x - mx) === cw) continue;
        const dot = (x + y) % 3 === 0 && y === my - h - 1;
        setW(y * W + x, dot ? 250 : 214, dot ? 236 : 88, dot ? 220 : 64, x > mx ? 0.95 : 0.55, 0);
      }
    };
    mush(S.cx + S.rx + 2, S.bot + 1, 3, 2); mush(S.cx + S.rx + 6, S.bot + 3, 2, 1);
    for (let k = 0; k < 9; k++) {                                   // fern fronds
      const a = -2.3 + k * 0.18, L = 9 + 4 * Math.sin(k);
      for (let s = 0; s < L; s++) {
        const x = Math.round(S.cx - S.rx - 1 + Math.cos(a) * s + 0.02 * s * s), y = Math.round(S.bot + 2 + Math.sin(a) * s + 0.04 * s * s);
        if (x >= 0 && x < W && y < H) setW(y * W + x, 70 + 4 * s, 112 + 5 * s, 48, 0.4 + 0.04 * s, 0);
      }
    }
  }

  /* ================================================================ sprite layers: trees, painted once */
  function newLayer(x0, y0, w, h) {
    return { x0, y0, w, h, alb: new Float32Array(w * h * 3), lit: new Float32Array(w * h), a: new Float32Array(w * h), fog: 0 };
  }
  function lput(L, x, y, r, g, b, lit, a) {
    const lx = x - L.x0, ly = y - L.y0;
    if (lx < 0 || ly < 0 || lx >= L.w || ly >= L.h) return;
    const j = ly * L.w + lx;
    L.alb[j * 3] = r; L.alb[j * 3 + 1] = g; L.alb[j * 3 + 2] = b; L.lit[j] = lit; L.a[j] = a === undefined ? 1 : a;
  }

  // a leaf cluster: a cauliflower of small round clumps, each made of little shaded leaves, rim-lit from the right
  const LDIR = (() => { const x = 0.78, y = -0.5, z = -0.25, l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; })();
  function paintCluster(cl, k, pal) {
    const { cx, cy, rx, ry } = cl;
    const pad = 4, L = newLayer(fl(cx - rx - pad), fl(cy - ry - pad), Math.ceil(2 * rx + 2 * pad), Math.ceil(2 * ry + 2 * pad));
    const R = mulberry32(1000 + k * 17);
    // clumps
    const n = Math.min(70, Math.round(6 + rx * ry / 22)), clumps = [];
    for (let q = 0; q < n; q++) {
      const a = R() * TAU, rr = Math.sqrt(R()) * 0.78;
      const cr = (0.28 + 0.22 * R()) * Math.min(rx, ry) + 2;
      clumps.push([cx + Math.cos(a) * rr * (rx - cr * 0.4), cy + Math.sin(a) * rr * (ry - cr * 0.4) * 0.95, cr]);
    }
    clumps.push([cx, cy, Math.min(rx, ry) * 0.7]);
    clumps.sort((a, b) => a[1] - b[1]);
    for (let ly = 0; ly < L.h; ly++) for (let lx = 0; lx < L.w; lx++) {
      const x = L.x0 + lx + 0.5, y = L.y0 + ly + 0.5;
      // the front-most (lowest) clump that covers this pixel; the edge is ragged with single leaves
      let best = -1;
      const rag = 0.22 * (vn2(x / 2.2, y / 2.2, 60 + k) - 0.5) + 0.2 * (ih(fl(x / 2), fl(y / 2), 65 + k) - 0.5);
      for (let q = 0; q < clumps.length; q++) { const c = clumps[q], d = Math.hypot(x - c[0], y - c[1]) / c[2]; if (d < 1 + rag) best = q; }
      // a few gaps where the sky shows through, near the rim
      if (best >= 0 && !cl.dim && cl.layer !== 2) { const bx = (x - cx) / rx, by = (y - cy) / ry, rr = bx * bx + by * by; if (rr > 0.55 && ih(fl(x / 2), fl(y / 2), 66 + k) > 0.93) best = -1; }
      if (best < 0) continue;
      const c = clumps[best];
      const nx = (x - c[0]) / c[2], ny = (y - c[1]) / c[2], nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const bx = (x - cx) / rx, by = (y - cy) / ry, bz = Math.sqrt(Math.max(0, 1 - bx * bx - by * by));
      const dn = (nx * 0.6 + bx * 0.4) * LDIR[0] + (ny * 0.6 + by * 0.4) * LDIR[1] + (nz * 0.6 + bz * 0.4) * LDIR[2];
      // little leaves: a jittered grid of tiny ellipses, each lit on its upper right
      const gx = Math.floor(x / 3), gy = Math.floor(y / 2.5);
      let lf = 0.5, lv = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const cxl = (gx + ox) * 3 + 3 * ih(gx + ox, gy + oy, 61 + k), cyl = (gy + oy) * 2.5 + 2.5 * ih(gx + ox, gy + oy, 62 + k);
        const ex = (x - cxl) / 1.9, ey = (y - cyl) / 1.25, d = ex * ex + ey * ey;
        if (d < 1) { lf = 0.5 + 0.5 * clamp(ex * 0.7 - ey * 0.9, -1, 1); lv = ih(gx + ox, gy + oy, 63 + k); }
      }
      // edge of the clump: darker crease where it tucks under the one in front
      let crease = 0;
      for (let q = best + 1; q < clumps.length; q++) { const c2 = clumps[q], d2 = Math.hypot(x - c2[0], y - c2[1]) / c2[2]; if (d2 < 1.15) crease = Math.max(crease, 1 - (d2 - 1) / 0.15); }
      const ao = 0.66 + 0.34 * sstep(-0.9, 0.3, -by) - 0.18 * crease;
      const dim = cl.dim || 1;
      let lit = clamp(0.04 + 1.15 * Math.max(0, dn) + 0.3 * (lf - 0.5), 0, 1) * ao * (dim < 1 ? 0.5 : 1);
      const tone = lv;
      let r = lerp(pal[0][0], pal[1][0], tone), g = lerp(pal[0][1], pal[1][1], tone), b = lerp(pal[0][2], pal[1][2], tone);
      const shade = (0.8 + 0.3 * lf) * (0.78 + 0.22 * ao) * dim;
      r *= shade; g *= shade; b *= shade * 0.96;
      if (lv > 0.92 && dn > 0.25 && dim === 1) { r = pal[2][0]; g = pal[2][1]; b = pal[2][2]; lit = Math.max(lit, 0.7); }   // a few pale new leaves
      if (crease > 0.7) { r *= 0.88; g *= 0.84; b *= 0.88; }
      lput(L, L.x0 + lx, L.y0 + ly, r, g, b, lit, 1);
    }
    L.sway = cl.sway === undefined ? 1 : cl.sway; L.ph = ih(k, 3, 64) * TAU; L.layer = cl.layer; L.leaf = pal === HPAL;
    return L;
  }

  // a limb: control points [x, y, width] smoothed by Catmull–Rom into a dense chain of short segments
  function smoothLimb(pts) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let s = 0; s < 8; s++) {
        const u = s / 8, u2 = u * u, u3 = u2 * u;
        const f = (k) => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3);
        out.push([f(0), f(1), lerp(p1[2], p2[2], u)]);
      }
    }
    out.push(pts[pts.length - 1].slice());
    return out;
  }
  // the top of a limb at a given x (where a bird's feet go)
  function limbTop(li, x) {
    const P = HT.dense[li];
    let best = null, bd = 1e9;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      if ((x - a[0]) * (x - b[0]) > 0) continue;
      const u = (x - a[0]) / ((b[0] - a[0]) || 1e-6), y = lerp(a[1], b[1], u), w = lerp(a[2], b[2], u);
      if (Math.abs(b[0] - a[0]) < Math.abs(b[1] - a[1]) * 0.5) continue;      // too steep to stand on
      const top = y - w / 2;
      if (best === null || top < bd) { bd = top; best = { x, y: Math.round(top + 0.3) }; }
    }
    return best || { x, y: 0 };
  }
  // a branch as a tapered capsule chain, with bark grooves, cylinder shading and moss on its upper side
  function paintLimb(L, pts, salt) {
    let along0 = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const pad = Math.max(a[2], b[2]) / 2 + 1;
      const x0 = Math.min(a[0], b[0]) - pad, x1 = Math.max(a[0], b[0]) + pad, y0 = Math.min(a[1], b[1]) - pad, y1 = Math.max(a[1], b[1]) + pad;
      const vx = b[0] - a[0], vy = b[1] - a[1], len = Math.hypot(vx, vy) || 1e-6, tx = vx / len, ty = vy / len;
      for (let y = fl(y0); y <= y1; y++) for (let x = fl(x0); x <= x1; x++) {
        const px = x + 0.5 - a[0], py = y + 0.5 - a[1];
        const u = clamp((px * tx + py * ty) / len, 0, 1), w = lerp(a[2], b[2], u) / 2;
        const d = Math.hypot(px - u * vx, py - u * vy);
        if (d > w) continue;
        const side = (px * -ty + py * tx), along = along0 + u * len;
        const s = clamp(side / Math.max(0.6, w), -1, 1);
        // world normal across the limb; the light comes from the right, above and a little behind
        let nxw = -ty * s, nyw = tx * s;
        if (nxw * 0 + nyw > 0 && Math.abs(ty) > 0.9) { /* vertical: keep */ }
        const nz = Math.sqrt(Math.max(0, 1 - s * s));
        const dn = nxw * LDIR[0] + nyw * LDIR[1] + nz * LDIR[2] * 0.6;
        const groove = vn2(along / 6 + salt * 7, s * 1.6 * Math.max(1, w / 2.2), 70 + salt);
        let r = 124 + 36 * groove, g = 88 + 24 * groove, bb = 66 + 14 * groove;
        if (groove < 0.34 && w > 2.2) { r *= 0.55; g *= 0.55; bb *= 0.6; }
        let lit = clamp(0.06 + 1.05 * Math.max(0, dn), 0, 1) * (0.72 + 0.28 * groove);
        const mo = fbm(x / 5, y / 4, 71 + salt, 3);
        if (mo > 0.58 && nyw < -0.25 && w > 2) { r = 96 + 44 * mo; g = 124 + 34 * mo; bb = 60; lit = Math.max(lit, 0.45); }
        if (Math.abs(s) > 0.78 && w > 1.4) { r *= 0.7; g *= 0.68; bb *= 0.74; }
        // the existing pixel wins if it is on a thicker limb (so joints look grown, not stacked)
        const lx = x - L.x0, ly = y - L.y0;
        if (lx < 0 || ly < 0 || lx >= L.w || ly >= L.h) continue;
        const q = ly * L.w + lx;
        if (L.a[q] > 0 && L.wd[q] > w + 0.6) continue;
        lput(L, x, y, r, g, bb, lit, 1); L.wd[q] = w;
      }
      along0 += len;
    }
  }

  // the home tree: a curved trunk and limbs; a dim inner mass of leaves; lobes; a few lobes in front
  const HT = {
    trunk: [[56, 458, 48], [64, 432, 36], [68, 404, 29], [70, 374, 26], [74, 344, 24], [82, 314, 22], [90, 288, 20], [96, 266, 17]],
    limbs: [
      [[95, 268, 15], [80, 242, 12], [58, 216, 9], [36, 198, 7], [16, 188, 5], [-6, 184, 4]],                          // 0 left
      [[96, 266, 15], [100, 234, 13], [98, 200, 11], [102, 162, 8.5], [110, 124, 6.5], [116, 92, 4.5], [118, 66, 3]],   // 1 leader
      [[90, 292, 12], [118, 274, 9], [148, 260, 7.5], [178, 251, 6], [206, 246, 4.6], [228, 244, 3.2], [244, 245, 2]],   // 2 the long low limb
      [[100, 208, 9], [128, 188, 7], [156, 174, 5.5], [184, 164, 4.2], [210, 158, 3], [232, 156, 2]],                   // 3 right middle
      [[106, 150, 7], [132, 130, 5], [160, 116, 4], [186, 106, 3], [208, 102, 2]],                                        // 4 upper right
      [[100, 188, 7], [78, 162, 5.5], [56, 142, 4.5], [34, 128, 3.4], [12, 120, 2.5]],                                   // 5 upper left
      [[112, 110, 5], [96, 86, 3.8], [80, 68, 3], [64, 58, 2]],                                                           // 6 top left
      [[36, 198, 4], [24, 210, 3], [10, 216, 2]],                                                                         // twigs
      [[156, 174, 3.2], [168, 186, 2.4], [180, 192, 1.6]],
      [[148, 260, 3.4], [158, 270, 2.4], [168, 274, 1.6]],
      [[58, 216, 4], [52, 232, 3], [44, 242, 2]],
    ],
    inner: [
      { cx: 106, cy: 122, rx: 92, ry: 74, layer: 0, dim: 0.68 }, { cx: 64, cy: 206, rx: 56, ry: 34, layer: 0, dim: 0.68 },
      { cx: 168, cy: 206, rx: 52, ry: 30, layer: 0, dim: 0.68 }, { cx: 30, cy: 130, rx: 40, ry: 50, layer: 0, dim: 0.68 },
    ],
    lobes: [
      { cx: 72, cy: 46, rx: 40, ry: 27 }, { cx: 132, cy: 40, rx: 38, ry: 25 }, { cx: 184, cy: 76, rx: 30, ry: 21 },
      { cx: 24, cy: 100, rx: 34, ry: 27 }, { cx: 94, cy: 90, rx: 36, ry: 25 }, { cx: 154, cy: 98, rx: 32, ry: 21 },
      { cx: 40, cy: 162, rx: 34, ry: 22 }, { cx: 128, cy: 154, rx: 30, ry: 19 }, { cx: 190, cy: 144, rx: 24, ry: 15 },
      { cx: 18, cy: 232, rx: 30, ry: 19 }, { cx: 80, cy: 220, rx: 28, ry: 17 }, { cx: 152, cy: 228, rx: 32, ry: 17 }, { cx: 206, cy: 234, rx: 22, ry: 13 },
    ],
    front: [
      { cx: 196, cy: 236, rx: 14, ry: 11 }, { cx: 198, cy: 146, rx: 14, ry: 11 }, { cx: 116, cy: 182, rx: 14, ry: 11 }, { cx: 178, cy: 92, rx: 17, ry: 12 },
      { cx: 54, cy: 192, rx: 15, ry: 10 }, { cx: 172, cy: 236, rx: 15, ry: 11 },
    ],
    dense: [],
  };
  const HPAL = [[210, 86, 74], [246, 136, 110], [255, 192, 160]];          // terracotta, coral, and pale new leaves
  const BPAL = [[52, 118, 168], [96, 168, 212], [168, 214, 236]];
  let TRUNK = null, HCL = [], BTL = null, BCL = [];
  function paintTrees() {
    TRUNK = newLayer(-10, 20, 262, 432); TRUNK.wd = new Float32Array(TRUNK.w * TRUNK.h);
    const trunk = smoothLimb(HT.trunk);
    HT.dense = HT.limbs.map(smoothLimb);
    paintLimb(TRUNK, trunk, 0);
    HT.dense.forEach((l, k) => paintLimb(TRUNK, l, k + 1));
    // roots spreading into the grass
    const roots = [[[60, 440, 16], [40, 450, 10], [22, 456, 6]], [[66, 442, 16], [90, 451, 10], [110, 457, 5]], [[62, 446, 12], [70, 456, 8]]];
    roots.forEach((r, k) => paintLimb(TRUNK, smoothLimb(r), 20 + k));
    // a knot hole on the trunk
    for (let y = 352; y < 362; y++) for (let x = 66; x < 76; x++) {
      const d = Math.pow((x + 0.5 - 71) / 3.2, 2) + Math.pow((y + 0.5 - 357) / 4.2, 2);
      if (d < 1) lput(TRUNK, x, y, 40, 26, 24, 0.05, 1); else if (d < 1.8) lput(TRUNK, x, y, x > 71 ? 170 : 90, x > 71 ? 128 : 64, x > 71 ? 90 : 48, x > 71 ? 0.9 : 0.2, 1);
    }
    HCL = [];
    HT.inner.forEach((c, k) => HCL.push(paintCluster(c, k, HPAL)));
    HT.lobes.forEach((c, k) => HCL.push(paintCluster(Object.assign({ layer: 1 }, c), 10 + k, HPAL)));
    HT.front.forEach((c, k) => { const L = paintCluster(Object.assign({ layer: 2, sway: 0 }, c), 40 + k, HPAL); L.cover = true; HCL.push(L); });
    // the blue tree, far off on its knoll
    BTL = newLayer(262, 214, 60, 70); BTL.wd = new Float32Array(BTL.w * BTL.h);
    paintLimb(BTL, smoothLimb([[292, 284, 4.5], [292, 266, 3.4], [291, 246, 2.6], [290, 232, 1.8]]), 40);
    paintLimb(BTL, smoothLimb([[292, 262, 2.2], [280, 248, 1.6], [272, 240, 1.2]]), 41);
    paintLimb(BTL, smoothLimb([[291, 254, 2], [304, 242, 1.5], [312, 236, 1.1]]), 42);
    BTL.fog = 0.18;
    const bcl = [
      { cx: 291, cy: 233, rx: 21, ry: 15, layer: 0, dim: 0.7 }, { cx: 277, cy: 243, rx: 13, ry: 10, layer: 1 }, { cx: 306, cy: 241, rx: 13, ry: 10, layer: 1 },
      { cx: 286, cy: 224, rx: 12, ry: 9, layer: 1 }, { cx: 299, cy: 227, rx: 11, ry: 8, layer: 1 }, { cx: 292, cy: 249, rx: 12, ry: 6, layer: 2 },
      { cx: 281, cy: 251, rx: 8, ry: 5, layer: 2 }, { cx: 303, cy: 251, rx: 8, ry: 5, layer: 2 },
    ];
    BCL = bcl.map((c, k) => { const L = paintCluster(c, 70 + k, BPAL); L.fog = 0.18; L.sway = c.layer === 2 ? 0 : 0.5; L.cover = c.layer === 2; return L; });
  }

  /* ================================================================ per frame: sky */
  const STARS = [];
  function buildStars() {
    const R = mulberry32(77);
    for (let n = 0; n < 170; n++) {
      const x = R() * W, y = Math.pow(R(), 1.3) * 250;
      STARS.push({ x: fl(x), y: fl(y), b: 0.25 + 0.75 * Math.pow(R(), 2.2), k: 2 + fl(R() * 5), ph: R() * TAU, big: R() < 0.06 });
    }
  }
  const CLOUDS = [
    { y: 58, x: 230, v: 1.6, tm: 6, life: 22, w: 54, h: 8, a: 0.55 },
    { y: 112, x: 300, v: 1.1, tm: 12, life: 20, w: 46, h: 6, a: 0.6 },
    { y: 150, x: 250, v: 1.3, tm: 30, life: 20, w: 60, h: 6, a: 0.5 },
    { y: 36, x: 300, v: 1.4, tm: 34, life: 22, w: 40, h: 7, a: 0.45 },
    { y: 190, x: 330, v: 0.9, tm: 2, life: 20, w: 50, h: 5, a: 0.45 },
  ];
  function buildClouds() {
    CLOUDS.forEach((c, k) => {
      const w = c.w, h = c.h, cw = 2 * w + 1, ch = 3 * h + 1, Dn = new Float32Array(cw * ch);
      for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
        const u = (i - w) / w, v = (j - 2 * h) / h;
        const top = 1.0 + 0.9 * fbm(i / 12 + k * 7, 0.5, 700 + k, 3) - 0.8 * u * u;
        const inside = v < 0 ? (-v) / Math.max(0.2, top) : v / 0.6;
        let d = 1 - inside * inside - 0.6 * u * u;
        d += 0.5 * (fbm(i / 7 + k * 3, j / 4, 710 + k, 3) - 0.5);
        Dn[j * cw + i] = clamp(d * 2, 0, 1);
      }
      c.cw = cw; c.ch = ch; c.D = Dn;
    });
  }
  function skyAt(y, out) {
    const T = LS.top, M = LS.mid, Hh = LS.hor;
    if (y < 150) { const u = sstep(0, 150, y) * 0.9 + y / 1500; out[0] = lerp(T[0], M[0], u); out[1] = lerp(T[1], M[1], u); out[2] = lerp(T[2], M[2], u); }
    else { const u = clamp((y - 150) / (HZ - 150), 0, 1); out[0] = lerp(M[0], Hh[0], u * u); out[1] = lerp(M[1], Hh[1], u * u); out[2] = lerp(M[2], Hh[2], u * u); }
    return out;
  }
  const SKR = [0, 0, 0];
  function drawSky(t) {
    const sx = LS.sx, sy = LS.sy, gl = LS.glow;
    // the sun's colour: pale gold high, orange low
    const low = sstep(200, 275, sy);
    const sr = 255, sg = lerp(236, 170, low), sb = lerp(190, 96, low);
    for (let y = 0; y < HZ + 6; y++) {
      skyAt(y, SKR);
      for (let x = 0; x < W; x++) {
        const i = y * W + x, j = i * 3;
        const dx = x - sx, dy = (y - sy) * 1.25, d2 = dx * dx + dy * dy;
        const g1 = gl * (0.55 * Math.exp(-d2 / 9000) + 0.35 * Math.exp(-d2 / 900));
        C[j] = SKR[0] + g1 * (sr - SKR[0] * 0.6) * 0.7;
        C[j + 1] = SKR[1] + g1 * (sg - SKR[1] * 0.6) * 0.62;
        C[j + 2] = SKR[2] + g1 * (sb - SKR[2] * 0.6) * 0.5;
        DM[i] = 0;
      }
    }
    // stars
    if (LS.night > 0.01) for (const s of STARS) {
      const tw = 0.75 + 0.25 * Math.sin(per(s.k, t) + s.ph), a = LS.night * s.b * tw;
      const j = (s.y * W + s.x) * 3;
      C[j] += (236 - C[j]) * a; C[j + 1] += (238 - C[j + 1]) * a; C[j + 2] += (250 - C[j + 2]) * a;
      if (s.big && a > 0.3) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = ((s.y + oy) * W + s.x + ox) * 3; if (k >= 0) { C[k] += (200 - C[k]) * a * 0.4; C[k + 1] += (210 - C[k + 1]) * a * 0.4; C[k + 2] += (240 - C[k + 2]) * a * 0.4; } }
    }
    // the moon: a soft halo and a small crescent
    if (LS.moon > 0.01) {
      const mx = LS.mx, my = LS.my, a = LS.moon;
      for (let y = fl(my - 26); y <= my + 26; y++) for (let x = fl(mx - 26); x <= mx + 26; x++) {
        if (x < 0 || x >= W || y < 0) continue;
        const j = (y * W + x) * 3, d = Math.hypot(x + 0.5 - mx, y + 0.5 - my);
        const halo = a * 0.22 * Math.exp(-d * d / 160);
        C[j] += 150 * halo; C[j + 1] += 160 * halo; C[j + 2] += 190 * halo;
        if (d < 6) {
          const dd = Math.hypot(x + 0.5 - mx + 2.6, y + 0.5 - my - 1.6);
          const lit = dd > 5.2 ? 1 : 0.12;
          C[j] = lerp(C[j], lerp(C[j], 250, lit), a); C[j + 1] = lerp(C[j + 1], lerp(C[j + 1], 244, lit), a); C[j + 2] = lerp(C[j + 2], lerp(C[j + 2], 214, lit), a);
          DM[y * W + x] = lit > 0.5 ? 1 : 0;
        }
      }
    }
    // the sun's disc
    if (sy < HZ + 8) {
      for (let y = fl(sy - 9); y <= sy + 9; y++) for (let x = fl(sx - 9); x <= sx + 9; x++) {
        if (y < 0 || y >= H || x < 0 || x >= W) continue;
        const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy); if (d > 8.2) continue;
        const j = (y * W + x) * 3, e = clamp(8.2 - d, 0, 1);
        C[j] = lerp(C[j], 255, e); C[j + 1] = lerp(C[j + 1], lerp(244, 196, low), e); C[j + 2] = lerp(C[j + 2], lerp(190, 120, low), e); DM[y * W + x] = 1;
      }
    }
    drawClouds(t);
  }
  function drawClouds(t) {
    const sdx = LS.sx > 180 ? 1 : -1;
    for (const c of CLOUDS) {
      const dt = mod(t - c.tm + D / 2, D) - D / 2;
      if (Math.abs(dt) >= c.life / 2) continue;
      const al = c.a * Math.pow(Math.sin(Math.PI * (dt / c.life + 0.5)), 2);
      const ox = Math.round(c.x + c.v * dt - c.w), oy = Math.round(c.y - 2 * c.h), cw = c.cw, Dn = c.D;
      // clouds take the sky's light: lit edges in the sun's colour, bellies in the hour's mauve
      const lr = lerp(LS.hor[0], 255, 0.4), lg = lerp(LS.hor[1], 236, 0.3), lb = lerp(LS.hor[2], 210, 0.2);
      for (let j = 0; j < c.ch; j++) {
        const y = oy + j; if (y < 0 || y >= HZ) continue;
        for (let i = 1; i < cw - 1; i++) {
          const x = ox + i; if (x < 0 || x >= W) continue;
          const d = Dn[j * cw + i]; if (d <= 0) continue;
          const lit = clamp((Dn[j * cw + i - sdx] - d) * -3 + (j > 2 * c.h - 1 ? 0.6 : 0), 0, 1);
          const k = (y * W + x) * 3, a = d * al;
          const r = lerp(C[k] * 1.05 + 8, lr, 0.35 + 0.5 * lit * Math.max(LS.glow, 0.2));
          const g = lerp(C[k + 1] * 1.03 + 6, lg, 0.3 + 0.45 * lit * Math.max(LS.glow, 0.2));
          const b = lerp(C[k + 2] * 1.02 + 6, lb, 0.25 + 0.3 * lit * Math.max(LS.glow, 0.2));
          C[k] += (r - C[k]) * a; C[k + 1] += (g - C[k + 1]) * a; C[k + 2] += (b - C[k + 2]) * a;
          PXN += a;
        }
      }
    }
  }

  /* ================================================================ per frame: the world and the trees, relit */
  function drawWorld(t) {
    const ar = LS.ar, ag = LS.ag, ab = LS.ab, kr = LS.kr, kg = LS.kg, kb = LS.kb, Hh = LS.hor;
    const sx = LS.sx, gl = LS.glow;
    for (let y = 150; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!WM[i]) continue;
      const j = i * 3, lit = WLIT[i], fog = WFOG[i];
      let r = WALB[j] / 255 * (ar + kr * lit) * 255, g = WALB[j + 1] / 255 * (ag + kg * lit) * 255, b = WALB[j + 2] / 255 * (ab + kb * lit) * 255;
      // the low sun gilds the tips of the far grass
      const sg = SKYGLOW[i] * gl * Math.exp(-Math.pow((x - sx) / 110, 2)) * 0.35;
      r += 120 * sg; g += 80 * sg; b += 30 * sg;
      r = lerp(r, Hh[0], fog); g = lerp(g, Hh[1], fog); b = lerp(b, Hh[2], fog);
      C[j] = r; C[j + 1] = g; C[j + 2] = b; DM[i] = 0;
    }
  }
  function layerIndex(L) {                           // the opaque pixels of a layer, listed once
    let n = 0; for (let q = 0; q < L.w * L.h; q++) if (L.a[q] > 0) n++;
    L.idx = new Int32Array(n); n = 0;
    for (let q = 0; q < L.w * L.h; q++) if (L.a[q] > 0) L.idx[n++] = q;
  }
  function drawLayer(L, dx, dy, mul) {
    const ar = LS.ar, ag = LS.ag, ab = LS.ab, kr = LS.kr, kg = LS.kg, kb = LS.kb, Hh = LS.hor, fog = L.fog;
    const m = mul === undefined ? 1 : mul, glw = LS.glow;
    if (!L.idx) layerIndex(L);
    const idx = L.idx, lw = L.w;
    for (let n = 0; n < idx.length; n++) {
      const q = idx[n], ly = (q / lw) | 0, lx = q - ly * lw;
      const y = L.y0 + ly + dy; if (y < 0 || y >= H) continue;
      const x = L.x0 + lx + dx; if (x < 0 || x >= W) continue;
      const a = L.a[q], i = y * W + x, j = i * 3, lit = L.lit[q];
      let r = L.alb[q * 3] / 255 * (ar + kr * lit) * 255 * m, g = L.alb[q * 3 + 1] / 255 * (ag + kg * lit) * 255 * m, b = L.alb[q * 3 + 2] / 255 * (ab + kb * lit) * 255 * m;
      if (L.leaf) { const gl = glw * lit * lit * lit; r += 96 * gl; g += 44 * gl; b += 10 * gl; }      // sun through the leaves
      if (fog) { r = lerp(r, Hh[0], fog); g = lerp(g, Hh[1], fog); b = lerp(b, Hh[2], fog); }
      C[j] += (r - C[j]) * a; C[j + 1] += (g - C[j + 1]) * a; C[j + 2] += (b - C[j + 2]) * a; DM[i] = 0;
      if (LEAK && L.cover && a > 0.5) COV[i] = 1;
    }
  }
  const swayOf = (L, t) => Math.round(L.sway * (0.8 * wind(t + L.ph * 0.3) + 0.35 * Math.sin(per(5, t) + L.ph)));

  /* ================================================================ birds */
  // colour sets: body, belly, wing, head (cap), beak, legs, tail, cheek, crest, wingbar
  const BC = (o) => { const r = {}; for (const k in o) r[k] = o[k] ? hx(o[k]) : null; return r; };
  // the four who leave
  const YEL = BC({ body: 'f0cc48', belly: 'f9e690', wing: 'b8952c', head: 'f4d454', beak: 'e8883a', legs: '8a6a4a', tail: 'a8862a', cheek: 'f6b860' });
  const BLD = BC({ body: 'eee0c6', belly: 'fbf4e4', wing: 'b0875a', head: 'f2e6d0', cap: 'b8482e', beak: '4a3a34', legs: '6a4a3a', tail: '8a6a48', cheek: 'f2a08a', crest: 'c4502e' });
  const LAV = BC({ body: 'a99bc2', belly: 'ddd2ea', wing: '7a6d98', head: 'b4a7cb', beak: 'e6a65c', legs: '8a6a5a', tail: '6c6288', cheek: 'f4a2b4' });
  const TEA = BC({ body: '33a094', belly: 'c2eadb', wing: '1d6766', head: '3cb2a2', beak: '2c2a32', legs: '4a4a50', tail: '1d6766' });
  // the home flock
  const RES_COL = [
    BC({ body: '8c6c4a', belly: 'ec8858', wing: '6a4e36', head: '8c6c4a', beak: '3a2a2a', legs: '5a4030', tail: '6a4e36' }),                    // robin
    BC({ body: 'a87c52', belly: 'eadcc0', wing: '6e4b33', head: '7a583c', beak: '4a3a30', legs: '6a5040', tail: '6e4b33', cheek: 'f2e0c8', wingbar: 'efe3ca' }),   // sparrow
    BC({ body: 'c8664a', belly: 'f2b49a', wing: '7a4a38', head: 'dc5a40', beak: 'e8c89a', legs: '6a4a3a', tail: '7a4a38' }),                    // rosy finch
    BC({ body: 'a8744a', belly: 'dab282', wing: '7e5438', head: 'a8744a', beak: '5a4030', legs: '6a5040', tail: '7e5438' }),                    // wren
    BC({ body: 'f09a6c', belly: 'f8c89c', wing: 'c85a3a', head: 'f4b07c', beak: 'f6e2b0', legs: '8a6a5a', tail: 'c85a3a', cheek: 'ff8a80' }),   // lovebird, coral
    BC({ body: 'f4e0c4', belly: 'fff4e2', wing: 'c8a07a', head: 'f6e6cc', beak: 'e8a050', legs: '8a6a5a', tail: 'c8a07a', cheek: 'f6a0a0' }),   // lovebird, cream
    BC({ body: 'b08a68', belly: 'eedcc4', wing: '7e5e48', head: 'b89270', beak: 'e09048', legs: '7a5a48', tail: '7e5e48', cheek: 'f0c0a0' }),   // the parent on the nest
    BC({ body: 'e8743e', belly: 'f6b46e', wing: '5a3a2a', head: 'ec7a40', beak: '3a2a2a', legs: '5a4030', tail: '5a3a2a' }),                    // the singer at the top
    BC({ body: 'eac49c', belly: 'fbeed6', wing: 'c09070', head: 'eecaa4', beak: 'f0c070', legs: '9a7a5a', tail: 'c09070', cheek: 'f7a092' }),   // a young one
    BC({ body: 'a48e7c', belly: 'dccab8', wing: '7a6858', head: 'ae9886', beak: '5a4a40', legs: '8a6a5a', tail: '6a5848', cheek: 'e8b8a8' }),   // a dove
    BC({ body: 'f0d8c0', belly: 'fff2e2', wing: 'b89070', head: 'f2dcc6', beak: 'd08040', legs: '8a6a5a', tail: 'b89070', cheek: 'ff8f8f' }),   // a cream one with rosy cheeks
    BC({ body: '7e5a40', belly: 'cca482', wing: '4f3427', head: '6e4c36', beak: 'e0b070', legs: '6a5040', tail: '4f3427', wingbar: 'f2e6cc' }),// brown with white bars
    BC({ body: 'b44834', belly: 'eaa27c', wing: '6e2525', head: 'c0503a', beak: 'f0d090', legs: '6a4a3a', tail: '6e2525' }),                    // terracotta
  ];
  const FAR_COL = [BC({ body: 'dfe4ea', belly: 'f4f6f8', wing: '8aa0b8', head: 'e4e8ee', beak: '4a4a50', legs: '5a5a60', tail: '8aa0b8' }),
    BC({ body: 'a8b8cc', belly: 'e0e8f0', wing: '6a809a', head: 'b0c0d4', beak: '4a4a50', legs: '5a5a60', tail: '6a809a' }),
    BC({ body: 'c8b8a8', belly: 'eee4da', wing: '8a7a6a', head: 'd0c0b0', beak: '4a4a50', legs: '5a5a60', tail: '8a7a6a' })];

  // a scratch mask for rasterising one bird: part id per pixel and its colour
  const BB = [0, 0, 0, 0];
  const BMW = 52, BMH = 52, BM = new Int8Array(BMW * BMH), BCR = new Float32Array(BMW * BMH * 3);
  const P_NONE = 0, P_TAIL = 1, P_BODY = 2, P_WING = 3, P_HEAD = 4, P_BEAK = 5, P_EYE = 6, P_LEG = 7, P_FWING = 8, P_CREST = 9, P_TWIG = 10, P_OUT = -1;
  let ER = NaN, EC = 1, ES = 0;
  const inEll = (x, y, cx, cy, rx, ry, rot) => {
    if (rot !== ER) { ER = rot; EC = Math.cos(rot); ES = Math.sin(rot); }
    const c = EC, s = ES, dx = x - cx, dy = y - cy;
    const u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry;
    return u * u + v * v;
  };
  function inTri(px, py, a, b, c) {
    const d1 = (px - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (py - b[1]);
    const d2 = (px - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (py - c[1]);
    const d3 = (px - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (py - a[1]);
    return !(((d1 < 0) || (d2 < 0) || (d3 < 0)) && ((d1 > 0) || (d2 > 0) || (d3 > 0)));
  }
  const shadeCol = (c, k, out) => {          // k: -1 shadow, 0 base, 1 highlight
    if (k > 0) { out[0] = lerp(c[0], 255, 0.28); out[1] = lerp(c[1], 246, 0.24); out[2] = lerp(c[2], 220, 0.18); }
    else if (k < 0) { out[0] = c[0] * 0.74; out[1] = c[1] * 0.7; out[2] = c[2] * 0.78 + 8; }
    else { out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; }
    return out;
  };
  const TMPC = [0, 0, 0];
  /* A pose: x, y (the feet, or the body's place in the air), face (1 right, -1 left), r (body radius), mode
     ('perch' | 'fly' | 'sleep'), tilt (head, rad, + = beak down), beak (0 shut .. 1 open), blink, puff, flap
     (wing phase 0..1, or -1 to glide), pitch, crouch (0..1), twig, alpha, clip (a function that hides pixels),
     dark (0..1, how far into a hollow's shadow), z. */
  function rasterBird(col, o) {
    const r = o.r, face = o.face, mode = o.mode, puff = o.puff || 0;
    const ox = 24, oy = 30;                          // where the feet sit in the scratch mask
    // body: round, a little upright when perched
    const legL = mode === 'perch' ? Math.max(0.9, r * 0.28) * (1 - 0.7 * (o.crouch || 0)) : 0;
    const brx = r * (mode === 'sleep' ? 1.1 : mode === 'fly' ? 1.15 : 0.98) * (1 + puff * 0.1) * (o.sleek ? 1.05 : 1);
    const bry = r * (mode === 'sleep' ? 0.98 : mode === 'fly' ? 0.68 : 0.86) * (1 + puff * 0.12) * (o.sleek ? 0.94 : 1);
    const lean = mode === 'perch' ? -0.32 + (o.crouch ? 0.15 : 0) : mode === 'fly' ? (o.pitch || 0) : 0;
    const cyB = mode === 'fly' ? 0 : -(legL + bry * 0.95);
    const cxB = 0;
    // head: big and round (that is most of the charm)
    const rh = r * (o.headK || 0.7) * (mode === 'sleep' ? 0.85 : 1);
    let hcx, hcy;
    if (mode === 'fly') { hcx = brx * 0.86; hcy = cyB - bry * 0.62; }
    else if (mode === 'sleep') { hcx = brx * 0.4; hcy = cyB - bry * 0.62; }
    else { hcx = r * 0.58 + (o.headDx || 0); hcy = cyB - r * 0.92 + (o.headDy || 0); }
    const tilt = o.tilt || 0, open = o.beak || 0;
    const bang = tilt + (mode === 'fly' ? 0.15 : 0);
    const bl = Math.max(1.3, r * 0.4);
    const bx0 = hcx + rh * 0.86 * Math.cos(bang), by0 = hcy + rh * 0.86 * Math.sin(bang) + 0.4;
    const ex = hcx + rh * (0.34 * Math.cos(tilt) + 0.12 * Math.sin(tilt)), ey = hcy - rh * 0.14 + rh * 0.28 * Math.sin(tilt);
    const tall = r >= 4.1 ? 1 : 0;
    // tail: thin, angled down and back (cocked up for a wren, long for one of the leavers)
    const tl = r * (mode === 'sleep' ? 0.45 : 0.82) * (o.longTail ? 2.0 : 1);
    const ta = mode === 'fly' ? 0.05 + (o.pitch || 0) : (o.cocked ? -0.95 : 0.62) + (o.tailLift || 0);
    const tx0 = -brx * 0.62, ty0 = cyB + bry * (mode === 'fly' ? 0.05 : 0.32);
    const tdx = -Math.cos(ta), tdy = Math.sin(ta);
    // wings
    const fold = mode !== 'fly';
    const wcx = mode === 'sleep' ? brx * 0.02 : -r * 0.18, wcy = cyB + (mode === 'sleep' ? -bry * 0.2 : r * 0.02);
    const wrx = (mode === 'sleep' ? brx * 0.94 : r * 0.82) * (1 + 0.2 * (o.wingOut || 0)), wry = mode === 'sleep' ? bry * 0.68 : r * 0.46;
    const wrot = mode === 'sleep' ? -0.42 : -0.38 - 0.45 * (o.wingOut || 0);
    let S1, S2, TP, TP2, lift = 0;
    if (!fold) {
      const f = o.flap;
      lift = f < 0 ? 0.3 : Math.cos(f * TAU);
      const sh = [r * 0.05, cyB - bry * 0.4];
      S1 = [sh[0] + r * 0.5, sh[1] + 0.3]; S2 = [sh[0] - r * 0.55, sh[1] + 0.3];
      TP = f < 0 ? [sh[0] - r * 1.25, sh[1] - r * 0.95] : [sh[0] - r * (0.35 + 0.75 * (1 - Math.abs(lift))), sh[1] - r * 2.0 * lift];
      TP2 = [TP[0] + r * 0.6, TP[1] + r * 0.2];
    }
    const CR1 = [hcx + rh * 0.15, hcy - rh * 0.78], CR2 = [hcx - rh * 0.95, hcy - rh * 1.55], CR3 = [hcx - rh * 0.45, hcy - rh * 0.6];
    const up = bang - 0.38 * open, dn = bang + 0.5 * open;
    const BA1 = [bx0 - 0.4, by0 - 0.75], BA2 = [bx0 - 0.4, by0 + 0.75], BAM = [bx0 - 0.4, by0], BAM2 = [bx0 - 0.4, by0 + 0.2];
    const BTU = [bx0 + bl * Math.cos(up), by0 + bl * Math.sin(up) - 0.15], BTD = [bx0 + bl * 0.8 * Math.cos(dn), by0 + bl * 0.8 * Math.sin(dn) + 0.2];
    let FM1 = null, FM2 = null, FW1 = null, FW2 = null;
    if (!fold) {
      FM1 = [lerp(S1[0], TP[0], 0.5) + 0.6, lerp(S1[1], TP[1], 0.5)]; FM2 = [lerp(S2[0], TP[0], 0.5) - 0.6, lerp(S2[1], TP[1], 0.5)];
      FW1 = [S1[0] - r * 0.2, S1[1] - 0.6]; FW2 = [S2[0] + r * 0.4, S2[1] - 0.6];
    }
    BM.fill(0);
    const ext = Math.ceil(3.2 * r + 5);
    const MX0 = Math.max(1, ox - ext), MX1 = Math.min(BMW - 2, ox + ext), MY0 = Math.max(1, oy - Math.ceil(4.3 * r + 6)), MY1 = Math.min(BMH - 2, oy + Math.ceil(2.5 * r + 4));
    BB[0] = MX0 - 1; BB[1] = MX1 + 1; BB[2] = MY0 - 1; BB[3] = MY1 + 1;
    for (let my = MY0; my <= MY1; my++) for (let mx = MX0; mx <= MX1; mx++) {
      const x = (mx - ox + 0.5) * face, y = my - oy + 0.5;
      let part = P_NONE;
      // far wing (behind everything)
      if (!fold && lift > 0.25 && inTri(x, y, FW1, TP2, FW2)) part = P_WING;
      // tail
      { const ux = x - tx0, uy = y - ty0, along = ux * tdx + uy * tdy, perp = -ux * tdy + uy * tdx;
        const tw = r * (0.2 + 0.1 * clamp(along / (tl + 0.01), 0, 1)) + 0.25;
        if (along > -1 && along < tl && Math.abs(perp) < tw) part = P_TAIL; }
      // legs
      if (mode === 'perch' && legL > 0.5 && y > -legL - 0.6 && y < 0.2 && (Math.abs(x + r * 0.15) < 0.5 || Math.abs(x - r * 0.28) < 0.5)) part = P_LEG;
      // body
      if (inEll(x, y, cxB, cyB, brx, bry, lean) < 1) part = P_BODY;
      // folded wing
      if (fold && inEll(x, y, wcx, wcy, wrx, wry, wrot) < 1) part = P_WING;
      // head (in sleep the wing wraps over its front)
      if (inEll(x, y, hcx, hcy, rh, rh * 0.95, 0) < 1) part = (mode === 'sleep' && inEll(x, y, wcx, wcy, wrx, wry, wrot) < 1.08) ? P_WING : P_HEAD;
      // crest: a small swept tuft
      if (o.crest && mode !== 'sleep' && inTri(x, y, CR1, CR2, CR3)) part = P_CREST;
      // beak
      if (mode !== 'sleep' && Math.abs(x - bx0) < bl + 1.5 && Math.abs(y - by0) < bl + 1.5) {
        if (open > 0.2) { if (inTri(x, y, BA1, BTU, BAM) || inTri(x, y, BAM2, BTD, BA2)) part = P_BEAK; }
        else if (inTri(x, y, BA1, BTU, BA2)) part = P_BEAK;
      }
      // the near wing in flight
      if (!fold && (inTri(x, y, S1, TP, S2) || inTri(x, y, S1, FM1, FM2))) part = P_FWING;
      // the eye
      if (mode !== 'sleep' && part === P_HEAD && !o.blink && Math.abs(x - ex) < 0.5 && y > ey - 0.5 - tall && y < ey + 0.5) part = P_EYE;
      BM[my * BMW + mx] = part;
    }
    // the twig in the beak
    if (o.twig && mode !== 'sleep') {
      const tw = (sx, sy) => { const mx = Math.floor(sx * face + ox), my = Math.floor(sy + oy); if (mx >= 0 && mx < BMW && my >= 0 && my < BMH && BM[my * BMW + mx] !== P_EYE) BM[my * BMW + mx] = P_TWIG; };
      for (let s = -2; s <= 3.5; s += 0.5) tw(bx0 + bl * 0.4 + s, by0 + 0.4 + s * 0.3);
      tw(bx0 + bl * 0.4 + 1.6, by0 - 0.8); tw(bx0 + bl * 0.4 + 2.4, by0 - 1.6);
    }
    // colours and shading
    const capY = hcy - rh * 0.2;
    for (let my = BB[2]; my <= BB[3]; my++) for (let mx = BB[0]; mx <= BB[1]; mx++) {
      const q = my * BMW + mx, p = BM[q]; if (p <= 0) continue;
      const wx = mx - ox + 0.5, x = wx * face, y = my - oy + 0.5;
      let c, k = 0;
      if (p === P_BODY) {
        const belly = (x * 0.5 + (y - cyB) * 0.9) > -bry * 0.05 && x > -brx * 0.45;
        c = belly ? col.belly : col.body;
        const tone = (wx - cxB) / brx * 0.5 - (y - cyB) / bry * 0.85;
        k = tone > 0.6 ? 1 : tone < -0.45 ? -1 : 0;
      } else if (p === P_HEAD) {
        c = col.cap && y < capY ? col.cap : (col.head || col.body);
        if (col.throat && y > hcy + rh * 0.25 && x > hcx - rh * 0.2) c = col.throat;
        if (col.cheek && mode !== 'sleep' && r > 2.6 && Math.abs(x - (hcx + rh * 0.02)) < 0.75 && Math.abs(y - (ey + 1.6 + tall * 0.3)) < 0.6) c = col.cheek;
        const tone = (wx - hcx * face) / rh * 0.5 - (y - hcy) / rh * 0.85;
        k = tone > 0.5 ? 1 : tone < -0.6 ? -1 : 0;
      } else if (p === P_WING) {
        c = col.wing; k = fold ? ((y < wcy - wry * 0.3) ? 0 : -1) : -1;
        if (col.wingbar && fold && Math.abs(y - wcy - 0.3) < 0.55 && x < wcx + 0.5) { c = col.wingbar; k = 0; }
      } else if (p === P_FWING) {
        c = col.wing; const d = Math.hypot(x - S2[0], y - S2[1]); k = d < r * 0.6 ? 0 : 0;
        if (lift < -0.3) k = -1; else if (lift > 0.6) k = 1;
      } else if (p === P_TAIL) { c = col.tail; k = -1; }
      else if (p === P_BEAK) { c = col.beak; }
      else if (p === P_EYE) { c = [22, 16, 22]; }
      else if (p === P_LEG) { c = col.legs; }
      else if (p === P_CREST) { c = col.crest || col.cap || col.head; }
      else if (p === P_TWIG) { c = [118, 82, 50]; }
      shadeCol(c, k, TMPC);
      BCR[q * 3] = TMPC[0]; BCR[q * 3 + 1] = TMPC[1]; BCR[q * 3 + 2] = TMPC[2];
    }
    // a selective outline: dark below and behind, softer on the lit side; none round legs, twig and beak
    for (let my = BB[2]; my <= BB[3]; my++) for (let mx = BB[0]; mx <= BB[1]; mx++) {
      const q = my * BMW + mx; if (BM[q] !== 0) continue;
      let nb = -1;
      for (const d of [BMW, -1, 1, -BMW]) { const p = BM[q + d]; if (p > 0 && p !== P_LEG && p !== P_TWIG && p !== P_BEAK) { nb = q + d; break; } }
      if (nb < 0) continue;
      BM[q] = P_OUT;
      const wx = mx - ox + 0.5, wy = my - oy + 0.5;
      const sideLit = (wx * 0.5 - (wy - cyB) * 0.8) > 0.55 * r;
      const k = sideLit ? 0.6 : 0.36;
      BCR[q * 3] = BCR[nb * 3] * k * 0.9; BCR[q * 3 + 1] = BCR[nb * 3 + 1] * k * 0.82; BCR[q * 3 + 2] = BCR[nb * 3 + 2] * k + 12;
    }
    return { ox, oy };
  }
  // draw the rasterised bird into the frame, lit by the hour
  function drawBird(col, o) {
    if ((o.alpha === undefined ? 1 : o.alpha) <= 0.01 || o.r < 0.5) return;
    const { ox, oy } = rasterBird(col, o);
    const bx = Math.round(o.x), by = Math.round(o.y);
    const ar = LS.ar, ag = LS.ag, ab = LS.ab, kr = LS.kr, kg = LS.kg, kb = LS.kb, Hh = LS.hor;
    const lit = 0.72, a0 = o.alpha === undefined ? 1 : o.alpha, fog = o.fog || 0, dark = o.dark || 0;
    // birds keep a little of their own colour at night (the eye forgives them)
    const lr = Math.max(ar + kr * lit, 0.44), lg = Math.max(ag + kg * lit, 0.46), lb = Math.max(ab + kb * lit, 0.62);
    for (let my = BB[2]; my <= BB[3]; my++) {
      const y = by + my - oy; if (y < 0 || y >= H) continue;
      for (let mx = BB[0]; mx <= BB[1]; mx++) {
        const q = my * BMW + mx, p = BM[q]; if (p === 0) continue;
        const x = bx + mx - ox; if (x < 0 || x >= W) continue;
        if (o.clip && o.clip(x, y)) continue;
        const i = y * W + x, j = i * 3;
        if (HIDE) { HM[i] = 1; continue; }
        let r = BCR[q * 3] * lr, g = BCR[q * 3 + 1] * lg, b = BCR[q * 3 + 2] * lb;
        if (fog) { r = lerp(r, Hh[0], fog); g = lerp(g, Hh[1], fog); b = lerp(b, Hh[2], fog); }
        if (dark) { r = lerp(r, 24, dark); g = lerp(g, 15, dark); b = lerp(b, 18, dark); }
        const a = p === P_OUT ? a0 * 0.92 : a0;
        C[j] += (r - C[j]) * a; C[j + 1] += (g - C[j + 1]) * a; C[j + 2] += (b - C[j + 2]) * a;
        DM[i] = 1;
        PXN += a * (1 - Math.min(1, dark));
      }
    }
  }

  /* ---------------------------------------------------------------- behaviour */
  // perches in the home tree (feet positions), on the tops of the limbs
  const PER = {};
  const NEST = { x: 122, y: 262 };                 // the nest sits in the crook where the long low limb leaves the trunk
  function pose0(o) {
    o.mode = 'perch'; o.tilt = 0; o.beak = 0; o.blink = 0; o.puff = 0; o.flap = 0; o.pitch = 0; o.crouch = 0; o.twig = 0;
    o.alpha = 1; o.clip = null; o.dark = 0; o.fog = 0; o.headDx = 0; o.headDy = 0; o.wingOut = 0; o.tailLift = 0;
    return o;
  }
  // idle at a perch: a seeded choice of small actions in one-second slots (40 per loop, so it repeats exactly)
  const SL = 1.0, NSL = Math.round(D / SL);
  function idle(b, t, o, wts) {
    const slot = mod(fl(t / SL), NSL), u = t / SL - fl(t / SL);
    const h = ih(b.id, slot, 90), w = wts || b.wts;
    let a = 0, acc = 0;
    for (let k = 0; k < w.length; k++) { acc += w[k]; if (h * (w.reduce((p, q) => p + q, 0)) < acc) { a = k; break; } }
    const e = Math.sin(Math.PI * clamp(u * 1.15, 0, 1));
    const dir = ih(b.id, slot, 91) < 0.5 ? -1 : 1;
    switch (a) {
      case 1: o.tilt = 0.42 * dir * s5(e * 1.4); o.headDy = -0.2 * e; break;                                       // head tilt
      case 2: if (u > 0.08 && u < 0.92) o.face = -o.face; break;                                                  // look round
      case 3: { const s = Math.sin(u * TAU * 2.5); o.tilt = 0.9 * s5(e * 1.3); o.headDx = -1.3 * s5(e * 1.3); o.headDy = 1.0 * s5(e * 1.3) + 0.4 * s; o.wingOut = 0.3 * e; break; }  // preen
      case 4: { o.tilt = -0.42 * s5(e * 1.4); o.beak = (u > 0.1 && u < 0.9 && Math.sin(u * TAU * 3.5) > 0) ? 1 : 0; o.puff = 0.3 * e; o.sing = u; break; }   // sing
      case 5: { const hu = ph(u, 0.2, 0.55); o.y -= 3.2 * Math.sin(Math.PI * hu); o.crouch = (u > 0.12 && u < 0.2) || (u > 0.55 && u < 0.64) ? 1 : 0; o.wingOut = 0.4 * Math.sin(Math.PI * hu); break; } // hop
      case 6: o.puff = 0.9 * Math.sin(Math.PI * ph(u, 0.2, 0.7)); break;                                         // fluff
      default: break;
    }
    // blinks
    if (ih(b.id, slot, 92) < 0.45) { const bt = 0.2 + 0.6 * ih(b.id, slot, 93); if (u > bt && u < bt + 0.09) o.blink = 1; }
    return a;
  }
  // a hop between two perches: crouch, arc, land
  function hopTo(o, A, B, u, hgt) {
    const k = ph(u, 0.15, 0.85);
    o.x = lerp(A.x, B.x, k); o.y = lerp(A.y, B.y, k) - (hgt || (2.5 + Math.abs(B.x - A.x) * 0.25)) * Math.sin(Math.PI * k);
    if (u < 0.15 || u > 0.85) o.crouch = 1;
    o.wingOut = 0.6 * Math.sin(Math.PI * k);
    if (B.x !== A.x) o.face = B.x > A.x ? 1 : -1;
  }
  // a flight along a cubic Bézier: flaps in bursts, glides between, flares to land
  function bez(P, u, out) {
    const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
    out[0] = a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0];
    out[1] = a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1];
    return out;
  }
  const BZ = [0, 0], BZ2 = [0, 0];
  function fly(o, P, t0, t1, t, r0, r1, glideK) {
    const u0 = ph(t, t0, t1);
    // ease: a quick launch, a long glide in, a soft landing
    const u = u0 < 0.5 ? 2 * u0 * u0 * 0.9 + u0 * 0.1 : 1 - Math.pow(2 - 2 * u0, 2) / 2 * 0.9 - (1 - u0) * 0.1;
    bez(P, u, BZ); bez(P, Math.min(1, u + 0.02), BZ2);
    o.mode = 'fly'; o.x = BZ[0]; o.y = BZ[1];
    const vx = BZ2[0] - BZ[0], vy = BZ2[1] - BZ[1];
    if (Math.abs(vx) > 0.01) o.face = vx > 0 ? 1 : -1;
    o.pitch = clamp(Math.atan2(vy, Math.abs(vx) + 1e-3) * 0.5, -0.5, 0.5);
    o.r = lerp(r0, r1, u);
    const tt = t - t0, burst = (tt % 1.1) / 1.1;
    const gl = glideK || 0.45;
    // flap in bursts; flare and beat hard at the very end
    if (u0 > 0.9) o.flap = mod(tt * 7.5, 1);
    else if (u0 < 0.12) o.flap = mod(tt * 7, 1);
    else o.flap = burst < 1 - gl ? mod(tt * 6.5, 1) : -1;
    // birds fly with their feet at the body; place the body relative to the "feet" convention used for drawing
    return u0;
  }

  /* ---------------------------------------------------------------- the cast */
  const RES = [];                                   // residents: {id, col, P (perch), face, r, wts, sleep window, extras}
  const LV = [];                                    // the four who leave
  const FAR = [];                                   // the blue tree's own birds
  function buildCast() {
    // perches: feet positions on the tops of the limbs, or on top of a lobe of leaves
    const lobeTop = (k, dx) => { const c = HT.lobes[k]; return { x: c.cx + (dx || 0), y: Math.round(c.cy - c.ry * Math.sqrt(1 - Math.pow((dx || 0) / c.rx, 2)) + 3), lobe: HT.inner.length + k }; };
    Object.assign(PER, {
      robin: limbTop(3, 168), sparrow: limbTop(0, 44), finch: limbTop(4, 168), wren: limbTop(0, 66), love: limbTop(5, 44),
      top: lobeTop(1, 2), juv: lobeTop(2, 4), dove: limbTop(0, 18), cream: lobeTop(0, -6), bars: limbTop(3, 194), terra: limbTop(6, 86),
      sp2: limbTop(5, 16), nest: limbTop(2, 124),
      yel: limbTop(2, 216), bld: limbTop(3, 226), lav: limbTop(2, 145), tea: limbTop(4, 198),
    });
    NEST.x = PER.nest.x; NEST.y = PER.nest.y + 2;
    const W0 = [5, 2, 1, 1.2, 1, 0.6, 0.5];        // none, tilt, look, preen, sing, hop, fluff
    const mk = (id, ci, per, face, r, wts, extra) => Object.assign({ id, col: RES_COL[ci], P: PER[per], lobe: PER[per].lobe, face, r, wts: wts || W0, s0: 21 + 1.6 * ih(id, 1, 95), s1: 30.6 + 1.6 * ih(id, 2, 95) }, extra || {});
    RES.push(
      mk(1, 0, 'robin', -1, 4.5, [4, 2, 1, 1, 2.2, 0.6, 0.4]),                     // robin, a singer
      mk(2, 1, 'sparrow', 1, 4.3, [4, 1.6, 1.5, 0.8, 0.8, 1.6, 0.5]),              // sparrow, a hopper
      mk(3, 2, 'finch', -1, 4.1, [4, 1.5, 1, 2.2, 0.8, 0.5, 0.6]),                 // rosy finch, a preener
      mk(4, 3, 'wren', 1, 3.7, [3, 1.5, 1.8, 0.6, 1, 2, 0.4], { cocked: 1 }),      // wren, busy
      mk(5, 4, 'love', 1, 4.3, [5, 2.5, 0.2, 1, 0.6, 0.2, 0.6]),                   // lovebirds
      mk(6, 5, 'love', -1, 4.2, [5, 2.5, 0.2, 1, 0.6, 0.2, 0.6]),
      mk(8, 7, 'top', 1, 4.3, [3, 1.5, 1, 0.5, 3.2, 0.3, 0.3]),                    // the singer at the top
      mk(9, 8, 'juv', -1, 3.8, [3, 2, 1.5, 0.6, 0.8, 2.2, 1], { headK: 0.76 }),    // a young one
      mk(10, 9, 'dove', 1, 4.9, [6, 1, 0.6, 1.2, 0.4, 0.2, 1]),                    // a dove
      mk(11, 10, 'cream', 1, 4.0, [4, 2, 1, 1, 1.2, 0.8, 0.5]),                    // cream, rosy cheeks
      mk(12, 11, 'bars', -1, 4.3, [4, 1.5, 1.2, 1, 1, 0.8, 0.5]),                  // brown with bars
      mk(13, 12, 'terra', -1, 4.4, [4, 1.5, 1, 0.8, 1.6, 0.4, 0.5]),               // terracotta
      mk(14, 1, 'sp2', 1, 4.0, [4, 1.5, 1.5, 1, 0.8, 1.2, 0.5]),                   // another sparrow
    );
    // the lovebirds sit close
    RES[4].P = limbTop(5, 39); RES[5].P = limbTop(5, 50);
    // the parent on the nest
    RES.push({ id: 7, col: RES_COL[6], P: NEST, face: 1, r: 4.6, wts: [6, 1.2, 0.8, 0.6, 0.2, 0, 0.6], s0: 21.5, s1: 30.4, nest: 1 });
    // the four who leave: where they hide at the start, and where they first perch
    const hideOf = (k) => { const c = HT.front[k]; return { x: c.cx, y: c.cy + 6 }; };
    LV.push(
      { id: 21, col: YEL, r: 4.2, sleek: 1, hide: hideOf(0), P: PER.yel, face: 1 },
      { id: 22, col: BLD, r: 4.5, crest: 1, twig: 1, hide: hideOf(1), P: PER.bld, face: 1 },
      { id: 23, col: LAV, r: 5.2, headK: 0.72, hide: hideOf(5), P: PER.lav, face: 1 },
      { id: 24, col: TEA, r: 4.3, longTail: 1, hide: hideOf(3), P: PER.tea, face: 1 },
    );
    FAR.push({ id: 31, col: FAR_COL[0], P: { x: 296, y: 218 }, face: -1, r: 1.6 }, { id: 32, col: FAR_COL[1], P: { x: 304, y: 228 }, face: -1, r: 1.5 },
      { id: 33, col: FAR_COL[2], P: { x: 286, y: 226 }, face: 1, r: 1.5 });
  }
  // places in the blue tree, at the signpost and at the stump
  const BT1 = { x: 278, y: 233 }, BT2 = { x: 289, y: 216 };
  const BTH1 = { x: 281, y: 252 }, BTH2 = { x: 293, y: 251 };
  const SPT = { x: SPX + 0.5, y: SIGN.top - 1 }, SPL = { x: SIGN.lx0 + 4, y: SIGN.ly }, SPR = { x: SIGN.rx1 - 4, y: SIGN.ry };
  const HOL = { x: STUMP.hx + 0.5, y: STUMP.hy + 5 };

  /* ---------------------------------------------------------------- timings (loop time) */
  const T = {
    out: [0.35, 1.0, 1.7, 2.4],                     // the four hop out of the leaves
    l1: [3.9, 8.3],                                  // yellow: to the blue tree
    l2: [9.9, 14.7],                                 // the builder, with its twig
    l3: [16.4, 19.3],                                // lavender: down to the hollow
    l4: [23.0, 25.5],                                // teal: to the signpost
    l4go: [33.7, 37.4],                              // and away over the hills
    hatch: 33.8,
  };

  const PO = pose0({});
  function drawResidents(t, layer) {
    for (const b of RES) {
      if ((b.layer || 0) !== layer) continue;
      pose0(PO); PO.x = b.P.x + (b.lobe !== undefined ? swayOf(HCL[b.lobe], t) : 0); PO.y = b.P.y; PO.face = b.face; PO.r = b.r; PO.cocked = b.cocked; PO.headK = b.headK;
      const asleep = t > b.s0 && t < b.s1;
      if (b.nest) { nestPose(b, t, PO); }
      else if (asleep) { PO.mode = 'sleep'; PO.puff = 0.3 + 0.08 * Math.sin(per(9, t) + b.id); }
      else {
        // wake into a dawn chorus: more singing just after the night
        const dawn = t > b.s1 && t < b.s1 + 6;
        idle(b, t, PO, dawn ? [2, 1, 0.5, 0.5, 4, 0.5, 0.8] : null);
        if (PO.sing !== undefined) { note(b, t, PO); PO.sing = undefined; }
        // wake up or nod off with a little shake
        if (Math.abs(t - b.s1) < 0.6 || Math.abs(t - b.s0) < 0.6) PO.puff = Math.max(PO.puff, 0.7 * Math.sin(Math.PI * clamp(1 - Math.abs(t - (Math.abs(t - b.s1) < 0.6 ? b.s1 : b.s0)) / 0.6, 0, 1)));
      }
      drawBird(b.col, PO);
    }
  }
  // the parent on the nest; the egg, and at dawn the chick
  function nestPose(b, t, o) {
    o.y = NEST.y + 1;
    o.puff = 0.35;
    const off = limbTop(2, NEST.x + 11);
    if (t < 30.7 || t > 37.9) {
      if (t > b.s0 && t < b.s1) { o.mode = 'sleep'; o.puff = 0.45; }
      else idle(b, t, o, [6, 1.2, 0.6, 0.8, 0.2, 0, 0.6]);
      if (t > 37.3) o.puff = 0.35 + 0.4 * Math.sin(Math.PI * ph(t, 37.3, 37.9));      // settling back down
      o.crouch = 1;
    } else if (t < 31.1) { hopTo(o, { x: NEST.x, y: NEST.y + 1 }, off, ph(t, 30.7, 31.1), 3); }
    else if (t < 36.9) {
      o.x = off.x; o.y = off.y; o.face = -1;
      o.tilt = 0.55 + 0.15 * Math.sin(t * 2.1);                                          // looking down at the egg
      if (t > 33.85 && t < 34.2) o.y -= 1.5 * Math.sin(Math.PI * ph(t, 33.85, 34.2));    // a little start of surprise
      if (t > 35.6 && t < 36.3) { o.headDx = -1.2 * Math.sin(Math.PI * ph(t, 35.6, 36.3)); o.tilt = 0.9; }   // a nuzzle
      if (t > 34.6 && t < 35.2) o.puff = 0.5;
      const bl = mod(t, 2.3); if (bl < 0.1) o.blink = 1;
    } else hopTo(o, off, { x: NEST.x, y: NEST.y + 1 }, ph(t, 36.9, 37.3), 3);
  }
  function drawNest(t, front) {
    const nx = NEST.x, ny = NEST.y;
    const ar = LS.ar + LS.kr * 0.6, ag = LS.ag + LS.kg * 0.6, ab = LS.ab + LS.kb * 0.6;
    // the egg and the chick take a little more light than the twigs (as the birds do)
    const er = Math.max(ar, 0.62), eg = Math.max(ag, 0.62), eb = Math.max(ab, 0.7);
    if (!front) {
      // the egg, and the chick
      if (t > 30.7 && t < 37.7) {
        const wob = t > 32.0 && t < 33.8 ? Math.round(Math.sin(t * 9) * Math.sin(Math.PI * ph(t, 32.0, 33.8)) * 1.3) : 0;
        const hatched = t > T.hatch;
        if (!hatched) {
          for (let y = -7; y <= 0; y++) for (let x = -3; x <= 3; x++) {
            const d = Math.pow(x / 3.3, 2) + Math.pow((y + 3.2) / 4.1, 2); if (d > 1) continue;
            const px = nx + x + wob * (y < -3 ? 1 : 0), py = ny + y - 1, sp = ih(x, y, 96) > 0.82;
            const lit = x > 0 || y < -5 ? 1.08 : 0.84;
            let r = 240 * lit, g = 232 * lit, b = 214 * lit;
            if (sp) { r = 186; g = 160; b = 128; }
            if (t > 33.2 && ((y === -4 && x !== 0 && Math.abs(x) < 3) || (y === -3 && x === 0))) { r = 96; g = 72; b = 62; }   // the crack
            putPx(px, py, r * er, g * eg, b * eb, 1, 1);
          }
        } else {
          // the chick: a fluffy ball that pops up, its beak opening to cheep; the eggshell's lower half round it
          const up = s5(ph(t, T.hatch, T.hatch + 0.35)), cy = ny - 2 - 4 * up;
          const cheep = t > 34.3 && t < 36.1 && Math.sin((t - 34.3) * TAU * 1.6) > 0.3;
          const wig = Math.round(Math.sin(t * 5) * 0.6);
          for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
            const d = (x * x) / 14 + (y * y) / 13; if (d > 1) continue;
            const fz = ih(x, y, 97) > 0.7 && d > 0.55;                                       // fluff
            const lit = x + y * 0.5 > -1 ? 1.06 : 0.84;
            const out = d > 0.8 && (x < 0 || y > 1);
            putPx(nx + x + wig, Math.round(cy + y), (out ? 200 : fz ? 255 : 252) * lit * er, (out ? 160 : fz ? 246 : 230) * lit * eg, (out ? 110 : fz ? 214 : 150) * lit * eb, 1, 1);
          }
          if (Math.sin(t * 1.7) < 0.95) putPx(nx + 1 + wig, Math.round(cy - 1), 26, 18, 24, 1, 1);    // its eye (blinking)
          putPx(nx + 4 + wig, Math.round(cy), 246 * er, 150 * eg, 60 * eb, 1, 1);                   // its beak
          putPx(nx + 5 + wig, Math.round(cy), 246 * er, 150 * eg, 60 * eb, 1, 1);
          if (cheep) putPx(nx + 4 + wig, Math.round(cy + 1), 220 * er, 110 * eg, 50 * eb, 1, 1);
          // the shell's lower half
          for (let x = -3; x <= 3; x++) putPx(nx + x, ny - 1, 240 * er, 232 * eg, 214 * eb, 1, 1);
          for (let x = -3; x <= 3; x += 2) putPx(nx + x, ny - 2, 240 * er, 232 * eg, 214 * eb, 1, 1);
          // the cap of the shell, tipped off
          const cu = ph(t, T.hatch, T.hatch + 0.6);
          if (cu < 1) { const sx = nx - 1 - 6 * cu, sy = ny - 8 - 5 * Math.sin(Math.PI * cu) + 7 * cu * cu; for (let x = -1; x <= 1; x++) putPx(Math.round(sx + x), Math.round(sy), 240 * er, 232 * eg, 214 * eb, 1, 1); }
          else for (let x = -1; x <= 1; x++) putPx(nx - 6 + x, ny - 1, 232 * er, 224 * eg, 206 * eb, 1, 1);
          if (cheep && t % 0.6 < 0.3) songMark(nx + 6, cy - 6 - (t % 0.6) * 6, 0.75);
        }
      }
      // the back of the nest
      for (let x = -8; x <= 8; x++) for (let y = -3; y <= -1; y++) {
        if (Math.abs(x) > 8 - (y + 3) * 0.2 - (y === -3 ? 2 : 0)) continue;
        if (y > -3 && Math.abs(x) < 6) continue;
        const tw = ih(x, y, 98), str = (x * 2 + y + 40) % 4 === 0;
        putPx(nx + x, ny + y, (str ? 214 : 150 + 40 * tw) * ar, (str ? 176 : 112 + 30 * tw) * ag, (str ? 112 : 70 + 16 * tw) * ab, 1, 1);
      }
    } else {
      // the front of the nest: a woven bowl of straw and twigs, a few ends sticking out
      for (let x = -9; x <= 9; x++) for (let y = 0; y <= 4; y++) {
        const half = 9.3 - y * y * 0.32; if (Math.abs(x) > half) continue;
        const tw = ih(x, y, 99), lit = x > 1 ? 1.08 : x < -4 ? 0.78 : 0.94;
        const str = ((x + y * 3 + 60) % 4 === 0) || (y === 0);
        const gap = !str && tw < 0.22;
        let r = str ? 222 : 176 + 34 * tw, g = str ? 186 : 136 + 28 * tw, b = str ? 120 : 84 + 18 * tw;
        if (gap) { r = 104; g = 74; b = 48; }
        if (y === 4 || Math.abs(x) > half - 0.8) { r *= 0.72; g *= 0.68; b *= 0.7; }
        putPx(nx + x, ny + y, r * lit * ar, g * lit * ag, b * lit * ab, 1, 1);
      }
      const tw = [[-10, -1], [-11, -2], [10, 0], [11, -1], [-6, 5], [7, 5]];
      for (const [x, y] of tw) putPx(nx + x, ny + y, 150 * ar, 108 * ag, 66 * ab, 1, 1);
    }
  }
  function putPx(x, y, r, g, b, a, crisp) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = y * W + x, j = i * 3;
    C[j] += (r - C[j]) * a; C[j + 1] += (g - C[j + 1]) * a; C[j + 2] += (b - C[j + 2]) * a;
    if (crisp) DM[i] = 1;
    PXN += a;
  }

  /* ---------------------------------------------------------------- the four who leave */
  const LO = pose0({});
  function departer(k, t, o) {
    const b = LV[k];
    pose0(o); o.r = b.r; o.face = b.face; o.sleek = b.sleek; o.crest = b.crest; o.longTail = b.longTail; o.headK = b.headK;
    o.twig = b.twig ? 1 : 0;
    o.z = 0;
    const tout = T.out[k];
    // tucked in the leaves until it hops out
    if (t < tout) { o.x = b.hide.x; o.y = b.hide.y; o.hidden = 1; return o; }
    o.hidden = 0; o.noLeak = 0;
    if (t < tout + 0.5) { hopTo(o, b.hide, b.P, ph(t, tout, tout + 0.5), 5); return o; }
    o.x = b.P.x; o.y = b.P.y;
    if (k === 0) {                                                  // the yellow one
      if (t < T.l1[0] - 0.4) { idle(b, t, o, [3, 2, 0.4, 0.6, 1.5, 0.4, 0.4]); o.face = t > 2.4 ? 1 : o.face; if (o.sing !== undefined) { note(b, t, o); o.sing = undefined; } }
      else if (t < T.l1[0]) { o.crouch = 1; o.face = 1; o.tilt = -0.2; }
      else if (t < T.l1[1]) {
        fly(o, [[b.P.x, b.P.y - 4], [236, 120], [262, 196], [BT1.x, BT1.y - 2]], T.l1[0], T.l1[1], t, b.r, 1.7, 0.5);
        o.fog = 0.2 * ph(t, T.l1[0], T.l1[1]); o.z = 2;
      } else farIdle(b, t, o, BT1, BTH1, 21.0, T.l1[1]);
    } else if (k === 1) {                                           // the builder, with its twig
      if (t < T.l2[0] - 0.4) { idle(b, t, o, [3, 2, 1.2, 0.2, 0, 0.6, 0.4]); }
      else if (t < T.l2[0]) { o.crouch = 1; o.face = 1; }
      else if (t < T.l2[1]) {
        fly(o, [[b.P.x, b.P.y - 4], [222, 168], [272, 180], [BT2.x, BT2.y - 2]], T.l2[0], T.l2[1], t, b.r, 1.75, 0.4);
        o.fog = 0.2 * ph(t, T.l2[0], T.l2[1]); o.z = 2;
      } else farIdle(b, t, o, BT2, BTH2, 22.2, T.l2[1]);
    } else if (k === 2) {                                           // lavender: sleepy, then down to the hollow
      if (t < T.l3[0] - 0.4) {
        idle(b, t, o, [6, 1, 0.3, 1.2, 0, 0, 1.2]);
        if (t > 11.6 && t < 12.6) { const u = ph(t, 11.6, 12.6); o.beak = Math.sin(Math.PI * u); o.tilt = -0.5 * Math.sin(Math.PI * u); o.puff = 0.6 * Math.sin(Math.PI * u); o.blink = u > 0.15 && u < 0.85 ? 1 : 0; } // a yawn
        if (t > 13.8) { const nod = Math.max(0, Math.sin((t - 13.8) * 2.6)); o.tilt = 0.5 * nod; o.headDy = 0.8 * nod; o.blink = nod > 0.5 ? 1 : 0; }  // nodding off
      } else if (t < T.l3[0]) { o.crouch = 1; o.face = 1; o.blink = 0; }
      else if (t < T.l3[1]) {
        fly(o, [[b.P.x, b.P.y - 4], [215, 200], [270, 300], [HOL.x + 1, HOL.y - 2]], T.l3[0], T.l3[1], t, b.r, 4.3, 0.7);
        o.z = 2;
      } else hollow(b, t, o);
    } else {                                                        // teal: to the signpost, and on
      if (t < T.l4[0] - 0.4) { idle(b, t, o, [3, 2.4, 2.2, 0.5, 0.6, 0.6, 0.4]); }
      else if (t < T.l4[0]) { o.crouch = 1; o.face = 1; }
      else if (t < T.l4[1]) {
        fly(o, [[b.P.x, b.P.y - 4], [236, 220], [214, 270], [SPT.x, SPT.y - 1]], T.l4[0], T.l4[1], t, b.r, 3.1, 0.5);
        o.z = 2;
      } else signpost(b, t, o);
    }
    return o;
  }
  // a bird at the blue tree: settles, looks about, is greeted, and at nightfall goes in among the leaves to roost
  function farIdle(b, t, o, P, Hd, tin, tarr) {
    o.r = b.k === undefined ? 1.75 : o.r; o.r = LV[0] === b ? 1.7 : 1.75; o.fog = 0.2;
    o.x = P.x; o.y = P.y;
    if (t < tarr + 0.3) { o.crouch = 1; o.wingOut = 1 - ph(t, tarr, tarr + 0.3); }
    else if (t < tin) idle(b, t, o, [3, 2, 1, 0.5, 0.6, 0.6, 0.4]);
    else if (t < tin + 0.6) { hopTo(o, P, Hd, ph(t, tin, tin + 0.6), 2); }
    else { o.x = Hd.x; o.y = Hd.y; o.mode = 'sleep'; o.hidden = 1; }
    o.z = 1;
  }
  // the sleeper at the stump: lands on the lip, settles, tucks its head in; at dawn it curls back into the dark
  function hollow(b, t, o) {
    o.x = HOL.x; o.y = HOL.y; o.face = -1; o.z = 3;
    const S = STUMP;
    o.clip = (x, y) => y > S.hy + 6 && stumpHollow(x + 0.5, y + 0.5) > 1;    // the lip hides its feet
    if (t < T.l3[1] + 0.35) { o.crouch = 1; o.wingOut = 1 - ph(t, T.l3[1], T.l3[1] + 0.35); o.face = 1; }
    else if (t < T.l3[1] + 0.9) { o.puff = 0.8 * Math.sin(Math.PI * ph(t, T.l3[1] + 0.35, T.l3[1] + 0.9)); o.face = t < T.l3[1] + 0.6 ? 1 : -1; }
    else {
      o.mode = 'sleep'; o.puff = 0.4 + 0.1 * Math.sin(t * 1.7);
      // at dawn: shuffle back into the hollow, into its shade
      const back = s5(ph(t, 35.4, 37.4));
      o.dark = back * 1.02; o.y = HOL.y - 1.5 * back;
      o.clip = (x, y) => stumpHollow(x + 0.5, y + 0.5) > (back > 0 ? 1 : 1.5) && (back > 0 || y > S.hy + 6);
      if (back >= 1) { o.alpha = 0; o.hidden = 1; o.noLeak = 1; }
    }
  }
  // at the signpost: looks one way, the other way, tries each arrow, looks at the sky, and at dawn goes on
  function signpost(b, t, o) {
    o.r = 3.1; o.x = SPT.x; o.y = SPT.y; o.z = 1;
    const a = T.l4[1];
    if (t < a + 0.3) { o.crouch = 1; o.wingOut = 1 - ph(t, a, a + 0.3); o.face = -1; }
    else if (t < 26.6) { o.face = 1; o.tilt = 0.25 * Math.sin(t * 2); }
    else if (t < 27.8) { o.face = -1; o.tilt = -0.35 * s5(ph(t, 26.6, 27.2)); }
    else if (t < 28.2) hopTo(o, SPT, SPL, ph(t, 27.8, 28.2), 3);
    else if (t < 29.5) { o.x = SPL.x; o.y = SPL.y; o.face = -1; o.tilt = 0.4 * Math.sin(Math.PI * ph(t, 28.4, 29.3)); if (t > 29.0) o.face = 1; }
    else if (t < 29.9) hopTo(o, SPL, SPT, ph(t, 29.5, 29.9), 3);
    else if (t < 30.3) hopTo(o, SPT, SPR, ph(t, 29.9, 30.3), 3);
    else if (t < 31.6) { o.x = SPR.x; o.y = SPR.y; o.face = 1; o.tilt = -0.4 * Math.sin(Math.PI * ph(t, 30.5, 31.4)); if (t > 31.2) o.face = -1; }
    else if (t < 32.0) hopTo(o, SPR, SPT, ph(t, 31.6, 32.0), 3);
    else if (t < T.l4go[0] - 0.4) {
      o.face = t < 32.5 ? 1 : t < 32.9 ? -1 : 1;
      o.tilt = t > 32.9 ? -0.6 * s5(ph(t, 32.9, 33.2)) : 0;                         // looks up at the sky
    } else if (t < T.l4go[0]) { o.crouch = 1; o.face = 1; o.tilt = -0.4; }
    else {
      // away into the dawn, up and over the far hills, getting smaller until it's gone
      const u = fly(o, [[SPT.x, SPT.y - 3], [222, 250], [236, 214], [250, 196]], T.l4go[0], T.l4go[1], t, 3.1, 0.4, 0.35);
      o.fog = 0.5 * u; o.alpha = 1 - sstep(0.75, 1, u);
      if (u >= 1) { o.hidden = 1; o.noLeak = 1; }
      o.z = 1;
    }
  }
  function drawFar(t) {
    for (const b of FAR) {
      pose0(PO); PO.x = b.P.x; PO.y = b.P.y; PO.face = b.face; PO.r = b.r; PO.fog = 0.2;
      if (t > 21.5 + b.id * 0.2 && t < 30.6 + b.id * 0.25) PO.mode = 'sleep';
      else {
        idle(b, t, PO, [3, 2, 1.5, 0.5, 0.4, 0.8, 0.3]);
        // greet the newcomers: a hop toward them and back
        if (b.id === 33 && t > T.l1[1] + 0.4 && t < T.l1[1] + 1.4) { const u = ph(t, T.l1[1] + 0.4, T.l1[1] + 1.4); PO.face = -1; PO.x = b.P.x - 3 * Math.sin(Math.PI * u); PO.y = b.P.y - 1.5 * Math.abs(Math.sin(TAU * u)); }
        if (b.id === 31 && t > T.l2[1] + 0.4 && t < T.l2[1] + 1.4) { const u = ph(t, T.l2[1] + 0.4, T.l2[1] + 1.4); PO.face = -1; PO.x = b.P.x - 3 * Math.sin(Math.PI * u); PO.y = b.P.y - 1.5 * Math.abs(Math.sin(TAU * u)); }
      }
      drawBird(b.col, PO);
    }
  }

  /* ---------------------------------------------------------------- song, z's, fireflies, leaves */
  const NOTE = ['.##', '.#.', '##.', '##.'];
  function songMark(x, y, a) {
    const r = lerp(LS.ar * 255, 255, 0.7), g = lerp(LS.ag * 255, 246, 0.7), b = lerp(LS.ab * 255, 224, 0.7);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) if (NOTE[j][i] === '#') putPx(x + i, y + j, r, g, b, a, 1);
  }
  function note(b, t, o) {
    // a little note rising from the beak while it sings
    const u = o.sing; if (u === undefined || u < 0.15 || u > 0.95) return;
    const k = ph(u, 0.15, 0.95), a = Math.sin(Math.PI * k) * 0.85;
    songMark(o.x + o.face * (o.r + 3) + (o.face < 0 ? -3 : 0) + 2 * Math.sin(k * 5), o.y - 2 * o.r - 6 - 9 * k, a);
  }
  const ZG = [['#####', '...#.', '..#..', '.#...', '#####'], ['######', '....#.', '...#..', '..#...', '.#....', '######']];
  function drawZs(t) {
    const t0 = T.l3[1] + 1.4, t1 = 37.2;
    for (let n = 0; n < 16; n++) {
      const born = t0 + n * 1.3, life = 3.2;
      if (born > t1) break;
      const age = t - born; if (age < 0 || age > life) continue;
      const u = age / life, a = Math.min(1, Math.sin(Math.PI * u) * 1.3);
      const g = ZG[u < 0.5 ? 0 : 1];
      const x = HOL.x + 3 + 9 * u + 2 * Math.sin(u * 6 + n), y = HOL.y - 16 - 22 * u;
      const r = lerp(LS.ar * 255, 240, 0.75), gg = lerp(LS.ag * 255, 232, 0.75), b = lerp(LS.ab * 255, 250, 0.8);
      for (let j = 0; j < g.length; j++) for (let i = 0; i < g[j].length; i++) if (g[j][i] === '#') putPx(x + i + 1, y + j + 1, 30, 24, 48, a * 0.45, 1);
      for (let j = 0; j < g.length; j++) for (let i = 0; i < g[j].length; i++) if (g[j][i] === '#') putPx(x + i, y + j, r, gg, b, a, 1);
    }
  }
  const FF = [];
  function buildFireflies() {
    const R = mulberry32(55);
    for (let n = 0; n < 30; n++) FF.push({ x: 20 + R() * 330, y: 292 + R() * 130, ax: 6 + R() * 16, ay: 3 + R() * 8, kx: 1 + fl(R() * 3), ky: 2 + fl(R() * 3), ph: R() * TAU, pk: 10 + fl(R() * 6), pp: R() * TAU });
    // a few up in the home tree's shadow, and round the signpost
    for (let n = 0; n < 6; n++) FF.push({ x: 40 + R() * 160, y: 200 + R() * 70, ax: 8, ay: 5, kx: 1, ky: 2, ph: R() * TAU, pk: 11 + fl(R() * 5), pp: R() * TAU });
    // three keep the bird at the signpost company
    for (let n = 0; n < 3; n++) FF.push({ x: SPX + [-14, 15, 2][n], y: SIGN.top + [4, 10, -10][n], ax: 6, ay: 4, kx: 1 + n, ky: 2, ph: n * 2.1, pk: 12 + n, pp: n * 1.7 });
  }
  function drawFireflies(t) {
    if (LS.fire < 0.01) return;
    for (const f of FF) {
      const x = f.x + f.ax * Math.sin(per(f.kx, t) + f.ph), y = f.y + f.ay * Math.sin(per(f.ky, t) + f.ph * 1.7);
      // a gentle pulse: ~2.5–4 s per glow, never a blink
      const p = 0.5 + 0.5 * Math.sin(per(f.pk, t) + f.pp), a = LS.fire * (0.25 + 0.75 * p * p);
      const xi = Math.round(x), yi = Math.round(y);
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const d2 = dx * dx + dy * dy, h = a * 0.32 * Math.exp(-d2 / 3.2);
        if (h < 0.01 || (dx === 0 && dy === 0)) continue;
        const X = xi + dx, Y = yi + dy; if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
        const j = (Y * W + X) * 3; C[j] += 200 * h; C[j + 1] += 230 * h; C[j + 2] += 110 * h;
      }
      putPx(xi, yi, 236, 250, 170, clamp(a * 1.1, 0, 1), 1);
    }
  }
  const LEAVES = [];
  function buildLeaves() {
    const R = mulberry32(31);
    const starts = [[150, 120], [196, 150], [60, 196], [176, 230], [120, 90], [210, 214], [30, 230], [160, 70], [100, 210], [196, 120]];
    starts.forEach((s, k) => LEAVES.push({ x: s[0], y: s[1], t0: k * D / starts.length + R() * 2, vy: 9 + 5 * R(), drift: 6 + 10 * R(), amp: 5 + 5 * R(), ph: R() * TAU, col: R() < 0.3 ? 2 : R() < 0.6 ? 1 : 0, land: 300 + R() * 140 }));
  }
  function drawLeaves(t) {
    for (const l of LEAVES) {
      const age = mod(t - l.t0, D), fall = (l.land - l.y) / l.vy;
      if (age > fall + 4.5) continue;
      const fa = Math.min(age, fall);
      const x = l.x + l.drift * fa + l.amp * Math.sin(fa * 2.2 + l.ph), y = l.y + l.vy * fa + 1.2 * Math.sin(fa * 4.4 + l.ph);
      const a = age < 0.6 ? age / 0.6 : age > fall + 2 ? 1 - (age - fall - 2) / 2.5 : 1;
      const pc = HPAL[l.col], sp = Math.sin(fa * 2.2 + l.ph);
      const lr = LS.ar + LS.kr * 0.7, lg = LS.ag + LS.kg * 0.7, lb = LS.ab + LS.kb * 0.7;
      // a tiny leaf turning: wide, edge-on, wide
      const xi = Math.round(x), yi = Math.round(y);
      const shape = age > fall ? [[0, 0], [1, 0], [-1, 0]] : Math.abs(sp) < 0.35 ? [[0, 0], [0, 1]] : sp > 0 ? [[0, 0], [1, 0], [1, 1]] : [[0, 0], [-1, 0], [0, 1]];
      shape.forEach(([dx, dy], q) => putPx(xi + dx, yi + dy, pc[0] * lr * (q ? 0.85 : 1.05), pc[1] * lg * (q ? 0.85 : 1.05), pc[2] * lb, clamp(a, 0, 1), 1));
    }
  }

  /* ---------------------------------------------------------------- the near meadow: grass and flowers that move */
  const BLADES = [];
  function buildGrass() {
    const R = mulberry32(99);
    for (let n = 0; n < 900; n++) {
      const y = 380 + Math.pow(R(), 0.7) * 74, x = R() * (W + 10) - 5;
      if (pathDist(x, y) < -2) continue;
      const dep = (y - 380) / 70;
      BLADES.push({ x, y, h: 4 + R() * 7 + 6 * dep, lean: (R() - 0.5) * 0.6, ph: R() * TAU, c: R(), k: 0.6 + 0.8 * R() });
    }
    BLADES.sort((a, b) => a.y - b.y);
  }
  function drawGrass(t) {
    const w0 = wind(t);
    const lr = LS.ar + LS.kr * 0.6, lg = LS.ag + LS.kg * 0.6, lb = LS.ab + LS.kb * 0.6;
    for (const b of BLADES) {
      const sway = (b.lean + 0.18 * w0 * b.k + 0.08 * Math.sin(per(9, t) + b.ph));
      const n = Math.ceil(b.h);
      for (let s = 0; s < n; s++) {
        const u = s / b.h, x = b.x + sway * b.h * u * u, y = b.y - s;
        const tip = u > 0.6;
        const r = (tip ? 128 + 34 * b.c : 66 + 26 * b.c), g = (tip ? 158 + 26 * b.c : 108 + 26 * b.c), bb = (tip ? 72 : 48);
        const lit = tip ? 0.95 + 0.3 * LS.glow : 0.72;
        putPx(x, y, r * lr * lit, g * lg * lit, bb * lb * lit, 1, 0);
      }
    }
    for (const f of NEARFL) {
      const sway = 0.25 * wind(t + f.x * 0.01) + 0.1 * Math.sin(per(7, t) + f.ph);
      const h = 5 + f.s * 3, tx = f.x + sway * h, ty = f.y - h;
      for (let s = 0; s < h; s++) putPx(f.x + sway * s, f.y - s, 70 * lr, 110 * lg, 50 * lb, 1, 0);
      const k = f.k, big = f.s > 1;
      const pts = big ? [[0, 0, 1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [2, 0, 0], [-2, 0, 0], [0, -2, 0], [1, -1, 0], [-1, -1, 0], [1, 1, 0], [-1, 1, 0]]
        : [[0, 0, 1], [1, 0, 0], [-1, 0, 0], [0, -1, 0], [0, 1, 0]];
      for (const [dx, dy, ctr] of pts) {
        if (big && Math.abs(dx) === 1 && Math.abs(dy) === 1 && ctr === 0 && (dx + dy) !== 0) continue;
        const li = dx > 0 || dy < 0 ? 1.06 : 0.86;
        putPx(tx + dx, ty + dy, (ctr ? k[3] : k[0]) * lr * li, (ctr ? k[4] : k[1]) * lg * li, (ctr ? k[5] : k[2]) * lb * li, 1, 1);
      }
    }
  }

  /* ================================================================ moonlight: colours drain toward blue at night */
  function moonlight() {
    const k = clamp(0.62 - (LS.kr + LS.kg + LS.kb) * 0.55, 0, 0.6); if (k < 0.01) return;
    const am = (LS.ar + LS.ag + LS.ab) / 3, tr = LS.ar / am, tg = LS.ag / am, tb = LS.ab / am;
    for (let y = 150; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (DM[i] || !WM[i] && y < HZ) continue;      // the sky, and birds and sprites, keep their colour
      const j = i * 3, l = 0.3 * C[j] + 0.55 * C[j + 1] + 0.15 * C[j + 2];
      C[j] = lerp(C[j], l * tr * 0.95, k); C[j + 1] = lerp(C[j + 1], l * tg * 0.95, k); C[j + 2] = lerp(C[j + 2], l * tb * 1.05, k);
    }
  }

  /* ================================================================ quantise */
  function quantise() {
    const K = 63 / Math.sqrt(255);
    for (let y = 0, i = 0; y < H; y++) {
      const by = (y & 3) << 2;
      for (let x = 0; x < W; x++, i++) {
        const j = i * 3, d = BAY[by | (x & 3)] * (DM[i] ? 0.3 : 4.4);
        let r = C[j], g = C[j + 1], b = C[j + 2];
        r = r <= 0 ? 0 : r >= 255 ? 63 : Math.sqrt(r) * K; g = g <= 0 ? 0 : g >= 255 ? 63 : Math.sqrt(g) * K; b = b <= 0 ? 0 : b >= 255 ? 63 : Math.sqrt(b) * K;
        let qr = (r + d + 0.5) | 0, qg = (g + d + 0.5) | 0, qb = (b + d + 0.5) | 0;
        qr = qr < 0 ? 0 : qr > 63 ? 63 : qr; qg = qg < 0 ? 0 : qg > 63 ? 63 : qg; qb = qb < 0 ? 0 : qb > 63 ? 63 : qb;
        OUT[i] = LUT[(qr << 12) | (qg << 6) | qb];
      }
    }
  }

  /* ================================================================ frame */
  let PROF = null, TRK = null;
  function trk(name, fn) { if (!TRK) { fn(); return; } const n0 = PXN; fn(); if (PXN > n0) TRK[name] = (TRK[name] || 0) + PXN - n0; }
  const stage = (name, fn, t) => {
    if (!PROF) { fn(t); return; }
    const t0 = performance.now(); fn(t); PROF[name] = (PROF[name] || 0) + performance.now() - t0;
  };
  const LP = [pose0({}), pose0({}), pose0({}), pose0({})];
  const drawLeaver = (k) => { if (!LP[k].hidden) trk('leaver' + k, () => drawBird(LV[k].col, LP[k])); };
  let LEAKN = [0, 0, 0, 0], VISN = [0, 0, 0, 0];
  function render(t) {
    t = mod(t, D);
    if (TRK) for (const k in TRK) TRK[k] = 0;
    if (LEAK) COV.fill(0);
    setLight(t);
    for (let k = 0; k < 4; k++) departer(k, t, LP[k]);
    stage('sky', (tt) => { drawSky(tt); }, t);
    stage('world', drawWorld, t);
    // the blue tree and its birds
    stage('bluetree', (tt) => {
      drawLayer(BTL, 0, 0);
      for (const L of BCL) if (L.layer < 2) drawLayer(L, swayOf(L, tt), 0);
      trk('far', () => drawFar(tt));
      for (let k = 0; k < 2; k++) if (LP[k].z === 1) drawLeaver(k);
      for (const L of BCL) if (L.layer === 2) drawLayer(L, swayOf(L, tt), 0);
    }, t);
    stage('signbird', () => { if (LP[3].z === 1) drawLeaver(3); }, t);
    stage('hollow', () => { if (LP[2].z === 3) drawLeaver(2); trk('zs', () => drawZs(t)); }, t);
    stage('leaves', () => trk('leaves', () => drawLeaves(t)), t);
    // the home tree, back to front, with the flock in among it
    stage('tree', (tt) => {
      for (const L of HCL) if (L.layer === 0) drawLayer(L, swayOf(L, tt), 0);
      drawLayer(TRUNK, 0, 0);
      for (const L of HCL) if (L.layer === 1) drawLayer(L, swayOf(L, tt), 0);
      trk('nest', () => drawNest(tt, false));
      trk('flock', () => drawResidents(tt, 0));
      trk('nest', () => drawNest(tt, true));
      for (let k = 0; k < 4; k++) if (LP[k].z === 0) drawLeaver(k);
      for (const L of HCL) if (L.layer === 2) drawLayer(L, swayOf(L, tt), 0);
    }, t);
    stage('grass', drawGrass, t);
    stage('flying', () => { for (let k = 0; k < 4; k++) if (LP[k].z === 2) drawLeaver(k); }, t);
    stage('fireflies', () => trk('fireflies', () => drawFireflies(t)), t);
    // leak check: would any part of a bird that should be out of sight show?
    // (also: how much of each leaver actually shows, for the motion check)
    if (LEAK) for (let k = 0; k < 4; k++) {
      LEAKN[k] = 0; VISN[k] = 0;
      if (LP[k].hidden && LP[k].noLeak) continue;
      HM.fill(0); HIDE = true; drawBird(LV[k].col, Object.assign({}, LP[k], { alpha: 1 })); HIDE = false;
      const behind = LP[k].z === 0 || LP[k].z === 1, a = LP[k].alpha === undefined ? 1 : LP[k].alpha;
      let n = 0;
      for (let i = 0; i < NP; i++) if (HM[i] && !(behind && COV[i])) n++;
      if (LP[k].hidden) LEAKN[k] = n; else VISN[k] = n * a * (1 - Math.min(1, LP[k].dark || 0));
    }
    stage('moonlight', moonlight, t);
    stage('quantise', quantise, t);
  }

  let BUILT = false;
  function build() {
    if (BUILT) return;
    buildLUT();
    paintWorld();
    paintTrees();
    buildStars(); buildClouds(); buildCast(); buildFireflies(); buildLeaves(); buildGrass();
    BUILT = true;
  }

  const core = { W, H, D, PAL, OUT, C, build, render, T, LS, PER, LV, RES, DM, leak(on) { LEAK = on; return LEAKN; }, VISN,
    _test: { drawBird, pose0, RES_COL, YEL, BLD, LAV, TEA, FAR_COL, setLight, quantise },
    prof(on) { PROF = on ? {} : null; return PROF; }, get PROF() { return PROF; }, track(on) { TRK = on ? {} : null; return TRK; }, get TRK() { return TRK; } };
  window.__birdsCore = core;
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
    const buf = new Uint8Array(NP * 3);
    for (let i = 0; i < NP; i++) { const p = PAL[OUT[i]]; buf[i * 3] = p[0]; buf[i * 3 + 1] = p[1]; buf[i * 3 + 2] = p[2]; }
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  }

  /* ================================================================ mount */
  const ROOM = '#14141f';
  (window.PIECES = window.PIECES || []).push({
    id: 'migrating-birds',
    title: 'Migrating Birds',
    medium: 'Pixel art in 64 colours, 360 × 450, drawn in JavaScript · 40 s loop',
    note: 'Some fly on; the tree stays full · tap to pause',
    about: 'A big terracotta tree full of small birds, each with its own colour and manner, and across the meadow a cooler blue one. Through one turn of the light, from a golden afternoon through sunset, fireflies and stars to dawn, four birds leave: two fly over to the blue tree, one carrying a twig; one glides down to a hollow stump to sleep; one sits on the signpost where the path forks and looks one way, then the other. The home tree stays full and singing, and at dawn an egg in its nest hatches.',
    tone: 'dark',
    room: ROOM,
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      SEED = 8; // composed for one seed
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0, built = false;
      el.style.background = ROOM;
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;image-rendering:pixelated;image-rendering:crisp-edges;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(244,232,206,.85)"/><rect x="19" y="9" width="5" height="16" fill="rgba(244,232,206,.85)"/></svg>';
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
        window.__birds = {
          duration: D,
          isReady: () => built && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); draw(t); window.__birds.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          pixels: pixelsB64,
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'migrating-birds';
        api.ready();
      } else {
        window.__birds = { duration: D, isReady: () => built, lastMs: 0, renderAt(t) { return new Promise((res) => { playing = false; clock = t; const t0 = performance.now(); draw(t); window.__birds.lastMs = performance.now() - t0; requestAnimationFrame(() => res()); }); } };
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
        if (window.__birds) window.__birds.lastMs = performance.now() - t0;
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
          if (window.__birds) delete window.__birds;
        },
      };
    },
  });
})();
