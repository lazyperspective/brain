/* The Seed and the Stone — Quiet Hours, piece 6.
 *
 * "All glory comes from daring to begin."
 *
 * A 24-second seamless loop, seen from the ground: a slab of weathered granite fills the frame, and in its one
 * long crack lies a seed. Dawn: it swells, splits, puts down a pale root and sends up a curled shoot. The shoot
 * meets a loose flake of stone, strains, pauses, and breaks it off; the crack opens, grit trickles in. At midday
 * the stem climbs and its leaves unfold one by one, backlit, veins glowing. In the golden hour a nodding bud
 * lifts and opens into a single crumpled poppy, the only red in the world; a hoverfly calls; the words come and
 * go. Then the petals fall, the head dries to a pod, the evening wind tips it and flicks one seed away along the
 * stone, and the camera follows it into a fresh, narrow stretch of the same crack: frame 0.
 *
 * Every frame is a pure function of t. The stone is painted once at mount as albedo, normals, ambient occlusion
 * and a 16-direction horizon map, periodic along x with the camera's travel per loop (280 px), and is relit
 * every frame by one raking sun that walks round it (dawn from the left, noon from behind, gold from behind
 * right, a dim violet turn through the front back to dawn), so every grain and pit throws its own shadow. The
 * plant is built every frame in 3D (a turtle-integrated stem with real thickness, leaves unfolding from folded,
 * a cup of four parametric petals with a crumple field) and throws a long shadow across the stone. The image is
 * quantised with a 4 × 4 Bayer dither in a square-root space to a 48-colour palette in which only the plant may
 * use the saturated greens, reds and the seed's russet; 360 × 450, shown at 3×.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 360, H = 450, NP = W * H, D = 24;
  const TAU = Math.PI * 2, fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const s5 = (u) => { u = clamp(u, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };
  const ph = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const fr = (v) => v - fl(v);
  const mod = (a, n) => ((a % n) + n) % n;
  // ease out with a little overshoot (anticipation's other half)
  const back = (u, c) => { u = clamp(u, 0, 1); c = c === undefined ? 1.7 : c; const v = u - 1; return 1 + (c + 1) * v * v * v + c * v * v; };
  const per = (k, t) => TAU * k * t / D;       // a phase that turns k whole times per loop
  let SEED = 6;
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
  // value noise and fbm that repeat along x every nx lattice cells (the stone is periodic with the camera's travel)
  function pvn(x, y, s, nx) {
    const xi = fl(x), yi = fl(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const x0 = mod(xi, nx), x1 = mod(xi + 1, nx);
    return lerp(lerp(ih(x0, yi, s), ih(x1, yi, s), u), lerp(ih(x0, yi + 1, s), ih(x1, yi + 1, s), u), v);
  }
  function pfbm(x, y, s, o, nx) {
    let a = 0, amp = 0.5, n = 0;
    for (let k = 0; k < o; k++) { a += amp * pvn(x, y, s + k * 31, nx); n += amp; x *= 2; y = y * 2.03 + 1.7; nx *= 2; amp *= 0.5; }
    return a / n;
  }
  const hx = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];

  /* ================================================================ palette (48) */
  const PAL_HEX = [
    '120e14', '1e1820', '2c242c', '3b3139', '4b4046', '5d5153', '716461', '86786f',  // 0-7   stone: warm greys, dark
    '9c8d7f', 'b2a290', 'c8b8a2', 'ddceb5', 'efe3ca', 'fdf6e4',                      // 8-13  stone: warm greys, light
    '37344a', '4f4a66', '6f6987', '938fac', 'b9b8cc', 'dcdbe4',                      // 14-19 violet shadow, dawn haze
    '6b5236', '8f6f45', 'b48c58', 'd6ac72', 'efcb92',                                // 20-24 ochre, gold
    'e6b28a', 'c7957a', '9c7568',                                                    // 25-27 warm haze, rose
    '50492f', '7d7a55', 'a9aa84',                                                    // 28-30 olive, sage (lichen, dry stalk)
    '0e2612', '1c4519', '2c6a1f', '479627', '73bf35', 'a6de55', 'd6f592',            // 31-37 the plant: greens
    '260709', '560c10', '8c1712', 'c22418', 'e6441e', 'ff7436', 'ff9e6c',            // 38-44 the flower: reds
    '5a2410', '93461c', 'd08a3c',                                                    // 45-47 the seed: russet, amber
  ];
  const PAL = PAL_HEX.map(hx), NPAL = PAL.length;

  // nearest colour, looked up in a 64³ table indexed in a square-root space so the darks get the resolution.
  // The greens and reds belong to the plant: only strongly saturated green or red inputs may use them, so the
  // stone, the light and the haze stay near-monochrome however they are lit.
  const QN = 64, LUT = new Uint8Array(QN * QN * QN);
  function nearest(r, g, b) {
    let best = 0, bd = 1e18;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx > 1 ? (mx - mn) / mx : 0;
    const greenOK = sat > 0.4 && g >= r * 1.04 && g >= b, oliveOK = g >= r * 0.93;
    const redOK = sat > 0.5 && r > g * 1.55 && r >= b, seedOK = sat > 0.6 && r > g * 1.45 && r >= b;
    for (let k = 0; k < NPAL; k++) {
      if (k >= 31 && k <= 37 && !greenOK) continue;
      if (k >= 38 && k <= 44 && !redOK) continue;
      if (k >= 45 && !seedOK) continue;
      if (k >= 28 && k <= 30 && !oliveOK) continue;
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
  const C2 = new Float32Array(NP * 3);   // scratch copy (soft focus)
  const OUT = new Uint8Array(NP);        // palette indices
  let PXN = 0;                           // pixels drawn by the tracked groups (motion check)

  /* ================================================================ time: the light walks round the stone */
  // cyclic Catmull–Rom through keys [t, v...]; dv is how much each value climbs per period (for unwrapped angles)
  function cyc(keys, period, x, out, dv) {
    const n = keys.length, m = keys[0].length - 1;
    x = mod(x, period);
    let i = n - 1;
    for (let k = 0; k < n; k++) if (keys[k][0] <= x) i = k;
    const get = (j) => { const q = mod(j, n), wrap = Math.floor(j / n); return [keys[q][0] + wrap * period, wrap]; };
    const [t0, w0] = get(i - 1), [t1, w1] = get(i), [t2, w2] = get(i + 1), [t3, w3] = get(i + 2);
    const k0 = keys[mod(i - 1, n)], k1 = keys[mod(i, n)], k2 = keys[mod(i + 1, n)], k3 = keys[mod(i + 2, n)];
    let xx = x; if (xx < t1) xx += period;
    const h = t2 - t1, s = (xx - t1) / h, s2 = s * s, s3 = s2 * s;
    for (let c = 0; c < m; c++) {
      const d = dv ? dv[c] : 0;
      const v0 = k0[c + 1] + w0 * d, v1 = k1[c + 1] + w1 * d, v2 = k2[c + 1] + w2 * d, v3 = k3[c + 1] + w3 * d;
      const m1 = (v2 - v0) / (t2 - t0) * h, m2 = (v3 - v1) / (t3 - t1) * h;
      out[c] = (2 * s3 - 3 * s2 + 1) * v1 + (s3 - 2 * s2 + s) * m1 + (-2 * s3 + 3 * s2) * v2 + (s3 - s2) * m2;
    }
    return out;
  }
  // the time of day w (0 dawn, .25 noon, .5 golden hour, .75 the violet turn) against loop time: dawn lingers,
  // the gold arrives with the bud and holds through the bloom
  const WKEYS = [[0, 0], [5.2, 0.1], [10.6, 0.25], [15.6, 0.47], [19.4, 0.6], [22.0, 0.8]];
  const WTMP = [0];
  const dayAt = (t) => cyc(WKEYS, D, t, WTMP, [1])[0];
  // the light at each time of day: elevation (deg), azimuth (× π), sun strength, sun rgb, sky (shadow) rgb,
  // haze top rgb, haze bottom rgb, bokeh strength
  const LKEYS = [
    [0.00, 12, -0.12, 1.38, 1.0, 0.8, 0.6, 0.32, 0.33, 0.56, 0.66, 0.62, 0.84, 1.0, 0.76, 0.6, 0.65],
    [0.25, 30, 0.50, 0.86, 1.0, 0.95, 0.86, 0.36, 0.38, 0.52, 0.72, 0.74, 0.74, 0.9, 0.84, 0.72, 0.70],
    [0.50, 13, 0.86, 1.45, 1.0, 0.66, 0.36, 0.34, 0.31, 0.6, 0.80, 0.57, 0.41, 0.97, 0.73, 0.49, 1.00],
    [0.75, 9, 1.45, 0.8, 0.95, 0.7, 0.78, 0.3, 0.28, 0.5, 0.5, 0.45, 0.68, 0.85, 0.62, 0.64, 0.40],
  ];
  const LDV = new Array(16).fill(0); LDV[1] = 2;
  const LT = new Array(16).fill(0);
  // this frame's light (filled by setLight)
  const LS = { w: 0, el: 0, lx: 0, ly: 0, lz: 0, tx: 0, ty: 0, tz: 0, ta: 0, tan: 0, sun: 0, sr: 0, sg: 0, sb: 0, ar: 0, ag: 0, ab: 0,
    h0: [0, 0, 0], h1: [0, 0, 0], bok: 0, back: 0 };
  function setLight(t) {
    const w = dayAt(t);
    cyc(LKEYS, 1, w, LT, LDV);
    const el = LT[0] * Math.PI / 180, az = LT[1] * Math.PI;
    LS.w = w; LS.el = el;
    // toward the sun, world: x right, y up, z toward the viewer. az 0: from the left; .5: from behind; 1: right; 1.5: front
    LS.lx = -Math.cos(el) * Math.cos(az); LS.ly = Math.sin(el); LS.lz = -Math.cos(el) * Math.sin(az);
    // the same in the stone's tangent frame (x right, y down the picture = toward the viewer, z out of the rock)
    LS.tx = LS.lx; LS.ty = LS.lz; LS.tz = LS.ly;
    LS.ta = Math.atan2(LS.ty, LS.tx); LS.tan = Math.tan(el);
    LS.sun = LT[2]; LS.sr = LT[3]; LS.sg = LT[4]; LS.sb = LT[5];
    LS.ar = LT[6]; LS.ag = LT[7]; LS.ab = LT[8];
    LS.h0[0] = LT[9]; LS.h0[1] = LT[10]; LS.h0[2] = LT[11];
    LS.h1[0] = LT[12]; LS.h1[1] = LT[13]; LS.h1[2] = LT[14];
    LS.bok = LT[15];
    LS.back = Math.max(0, -LS.lz) * LS.sun;       // how much the sun is behind things (backlight, glow, motes)
  }

  /* ================================================================ the breeze, and the camera */
  // the wind: a few slow sways that turn whole numbers of times per loop, and the evening gust that takes the seed
  const gust = (t) => Math.exp(5 * (Math.cos(TAU * (t - 21.2) / D) - 1)) * (1 + 0.35 * Math.sin(per(40, t)));
  function windAt(t) {
    return 0.55 * Math.sin(per(3, t) + 0.4) + 0.3 * Math.sin(per(7, t) + 1.1) + 0.14 * Math.sin(per(17, t) + 2.0) + 1.6 * gust(t);
  }
  // the camera drifts along the stone by exactly one period of its texture per loop: slowly while the plant grows,
  // then gliding after the seed. velocity = base + a periodic bump; integrated once into a table
  const P = 280;                        // stone period = camera travel per loop (px)
  const X0 = 222;                       // where the seed lies on screen at t = 0
  const CAMN = 4800, CAM = new Float64Array(CAMN + 1);
  function buildCam() {
    const v = (t) => 1 + 26 * Math.exp(4.5 * (Math.cos(TAU * (t - 21.5) / D) - 1));
    let s = 0; CAM[0] = 0;
    for (let i = 1; i <= CAMN; i++) { s += (v((i - 0.5) * D / CAMN)) * D / CAMN; CAM[i] = s; }
    for (let i = 0; i <= CAMN; i++) CAM[i] *= P / s;
  }
  function camAt(t) { t = mod(t, D); const f = t / D * CAMN, i = Math.min(CAMN - 1, fl(f)); return lerp(CAM[i], CAM[i + 1], f - i); }
  let CAMI = 0;                         // this frame's camera offset, whole pixels (the stone scrolls crisply)

  /* ================================================================ the stone: painted once */
  // A texture P px wide (it repeats exactly once per loop, as the camera travels) covering screen rows TY0..H.
  // Height in pixels; albedo 0..1; normals in the tangent frame (x right, y toward the viewer, z out of the rock).
  const TW = P, TY0 = 150, TH = H - TY0, TN = TW * TH, NA = 16;
  const SM = new Uint8Array(TN);                // 1 = rock
  const SHT = new Float32Array(TN);             // height
  const SALB = new Float32Array(TN * 3);        // albedo
  const SNRM = new Float32Array(TN * 3);        // normal
  const SAO = new Float32Array(TN);             // sky visibility
  const SHOR = new Float32Array(TN * NA);       // tangent of the horizon in 16 directions (for the raking shadows)
  const SGL = new Float32Array(TN);             // mica and quartz glints: how mirror-like
  const RIM = new Float32Array(TW);             // screen y of the far edge of the rock, per texture column
  const CRY = new Float32Array(TW), CRW = new Float32Array(TW);   // the crack: centre (screen y), half width
  const CSX = 140;                              // texture column of the seed's place in the crack
  let SITE_Y = 0;                               // screen y of the crack centre there
  const OFFX = CSX - X0;                        // texture column = screen x + CAMI + OFFX (mod TW)
  const FLK = new Uint8Array(TN);               // the loose flake beside the seed (texels)
  let FLKX0 = 0, FLKX1 = 0, FLKY0 = 0, FLKY1 = 0, FLKCX = 0, FLKCY = 0;   // its box and centre, texture coords
  const wrapd = (d) => mod(d + TW / 2, TW) - TW / 2;

  function rimAt(tx) { return 182 + 11 * (2 * pfbm(tx / 70, 0.5, 300, 3, 4) - 1) + 2.2 * (2 * pvn(tx / 7, 3.1, 301, 40) - 1); }
  function crackAt(tx) {
    return 316 + 11 * (2 * pfbm(tx / 70, 3.3, 50, 3, 4) - 1) + 2.4 * (2 * pvn(tx / 10, 7.7, 51, 28) - 1);
  }
  // rows close to the far edge are foreshortened: the noise is sampled in a coordinate that runs faster there
  const vOf = (dr) => dr + 26 * (1 - Math.exp(-dr / 13));
  const vRate = (dr) => 1 + 2 * Math.exp(-dr / 13);

  function paintStone() {
    const R = mulberry32(6061);
    for (let x = 0; x < TW; x++) { RIM[x] = rimAt(x); CRY[x] = crackAt(x); CRW[x] = 1.0 + 1.5 * pfbm(x / 35, 9.1, 52, 2, 8); }
    // keep the crack calm where the seed lies
    const cy0 = CRY[CSX];
    for (let x = CSX - 16; x <= CSX + 16; x++) { const k = mod(x, TW), u = Math.exp(-Math.pow((x - CSX) / 9, 2)); CRY[k] = lerp(CRY[k], cy0, u * 0.7); CRW[k] = lerp(CRW[k], 1.5, u); }
    SITE_Y = Math.round(CRY[CSX]);
    const MIN = [[0.2, 0.18, 0.19], [0.72, 0.62, 0.53], [0.52, 0.52, 0.53], [0.78, 0.75, 0.69]];
    const MINH = [-0.5, 0.15, 0.35, 0.05];
    const PAT = [0.56, 0.53, 0.48];
    const FRESH = new Uint8Array(TN), DARK = new Float32Array(TN), CRK = new Float32Array(TN).fill(99);
    // ---- relief and minerals
    for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) {
      const i = ty * TW + tx, sy = ty + TY0, dr = sy - RIM[tx];
      if (dr < 0) continue;
      SM[i] = 1;
      const v = vOf(dr);
      let h = 10 * pfbm(tx / 70, v / 60, 11, 4, 4) + 2.6 * pfbm(tx / 28, v / 24, 13, 3, 10) + 0.9 * pfbm(tx / 7, v / 6, 12, 2, 40);
      // grains: a jittered cell per 9 px, periodic (granite at this magnification: crystals as big as seeds)
      const gx = tx / 9.333, gy = v / 8, cx = fl(gx), cy = fl(gy);
      let f1 = 9, f2 = 9, id = 0, idy = 0;
      for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
        const qx = cx + k, qy = cy + j, w = mod(qx, 30);
        const px = qx + 0.15 + 0.7 * ih(w, qy, 21), py = qy + 0.15 + 0.7 * ih(w, qy, 22);
        const d = Math.hypot(gx - px, gy - py);
        if (d < f1) { f2 = f1; f1 = d; id = w; idy = qy; } else if (d < f2) f2 = d;
      }
      const mr = ih(id, idy, 23), mi = mr < 0.05 ? 0 : mr < 0.45 ? 1 : mr < 0.78 ? 2 : 3;
      h += MINH[mi] + 0.25 * (ih(id, idy, 24) - 0.5);
      const e = (f2 - f1) * 8.5;
      if (e < 1.0) h -= 0.25 * (1 - e / 1.0);
      h += 0.5 * (vn2(tx / 2.2 + id * 3, v / 2.2, 29 + mi) - 0.5);
      let a = MIN[mi], j0 = 0.94 + 0.12 * ih(id, idy, 25);
      const sp = 0.86 + 0.2 * vn2(tx / 1.6, v / 1.6, 30 + id);
      let ar = lerp(a[0], PAT[0], 0.42) * j0 * sp, ag = lerp(a[1], PAT[1], 0.42) * j0 * sp, ab = lerp(a[2], PAT[2], 0.42) * j0 * sp;
      // black mica flecks, scattered through every crystal (the pepper in the salt)
      const fk = ih(tx, ty, 37);
      if (fk < 0.035 + 0.03 * (mi === 2 ? 1 : 0)) { ar = 0.17; ag = 0.15; ab = 0.16; h -= 0.3; SGL[i] = fk < 0.02 ? 1 : 0.4; }
      if (mi === 0 || mi === 2) SGL[i] = (mi === 0 ? 0.9 : 0.45) * (ih(id, idy, 26) > 0.55 ? 1 : 0.15);
      // feldspar megacrysts: a few big blocky pale-pink crystals
      {
        const mx = tx / 28, my = v / 26, ncx = fl(mx), ncy = fl(my), w = mod(ncx, 10);
        if (ih(w, ncy, 27) < 0.16) {
          const ccx = ncx + 0.5, ccy = ncy + 0.5, ang = ih(w, ncy, 28) * Math.PI;
          const ux = (mx - ccx) * 28, uy = (my - ccy) * 26, ca = Math.cos(ang), sa = Math.sin(ang);
          const p = Math.abs(ux * ca + uy * sa), q = Math.abs(-ux * sa + uy * ca);
          if (p < 9 && q < 5.5) {
            ar = lerp(0.76, PAT[0], 0.3); ag = lerp(0.64, PAT[1], 0.3); ab = lerp(0.56, PAT[2], 0.3);
            h += 0.3; if (fr((ux * ca + uy * sa) * 0.9 + 0.3) < 0.12) h -= 0.25;        // cleavage
            if (p > 8 || q > 4.6) h -= 0.3;
          }
        }
      }
      // iron stain and the dark water streaks of weathering
      const st = sstep(0.56, 0.78, pfbm(tx / 56, v / 50, 60, 3, 5));
      ar = lerp(ar, 0.64, 0.3 * st); ag = lerp(ag, 0.5, 0.3 * st); ab = lerp(ab, 0.36, 0.3 * st);
      const dk = 1 - 0.2 * sstep(0.55, 0.78, pfbm(tx / 28, v / 80, 61, 3, 10));
      ar *= dk; ag *= dk; ab *= dk;
      // the hairline fracture network: the edges of big cells, where a mask lets them show
      {
        const bx = tx / 56, by = v / 50, cbx = fl(bx), cby = fl(by);
        let g1 = 9, g2 = 9;
        for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
          const qx = cbx + k, qy = cby + j, w = mod(qx, 5);
          const d = Math.hypot(bx - (qx + 0.5 + 0.6 * (ih(w, qy, 31) - 0.5)), by - (qy + 0.5 + 0.6 * (ih(w, qy, 32) - 0.5)));
          if (d < g1) { g2 = g1; g1 = d; } else if (d < g2) g2 = d;
        }
        const ee = (g2 - g1) * 50 * 0.5 + 1.4 * (pfbm(tx / 8, v / 7, 33, 2, 35) - 0.5);
        const msk = sstep(0.5, 0.6, pfbm(tx / 40, v / 40, 34, 2, 7));
        if (ee < 0.7 && msk > 0) { h -= 1.1 * (1 - ee / 0.7) * msk; DARK[i] = Math.max(DARK[i], 0.22 * msk * (1 - ee / 0.7)); }
      }
      SHT[i] = h;
      SALB[i * 3] = ar; SALB[i * 3 + 1] = ag; SALB[i * 3 + 2] = ab;
    }
    // ---- pits and chips (periodic stamps)
    const stamp = (cx, cy, rx, ry, fn) => {
      for (let y = fl(cy - ry) - 1; y <= cy + ry + 1; y++) for (let x = fl(cx - rx) - 1; x <= cx + rx + 1; x++) {
        const ty = y - TY0; if (ty < 0 || ty >= TH) continue;
        const tx = mod(x, TW), i = ty * TW + tx; if (!SM[i]) continue;
        const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, d = u * u + v * v;
        if (d <= 1) fn(i, d, u, v);
      }
    };
    for (let k = 0; k < 260; k++) {
      const x = R() * TW, y = 190 + R() * 262, r = 0.8 + 2.6 * Math.pow(R(), 2.2), dep = 0.8 + 1.8 * R(), sq = 1 / vRate(y - rimAt(x));
      if (pfbm(x / 40, y / 40, 35, 2, 7) < 0.47 && R() < 0.75) continue;            // pits come in weathered clusters
      stamp(x, y, r, r * sq, (i, d) => { SHT[i] -= dep * (1 - d); for (let c = 0; c < 3; c++) SALB[i * 3 + c] *= 0.86 + 0.1 * d; });
    }
    for (let k = 0; k < 9; k++) {
      const x = R() * TW, y = 205 + R() * 240, r = 4 + 6 * R(), dep = 1.1 + 1.1 * R(), sq = 1 / vRate(y - rimAt(x)), ang = R() * TAU;
      stamp(x, y, r, r * 0.75 * sq, (i, d, u, v) => {
        const lip = Math.cos(Math.atan2(v, u) - ang);                      // a conchoidal scoop, deeper toward one side
        SHT[i] -= dep * (1 - d) * (0.65 + 0.35 * lip); FRESH[i] = 1;
      });
    }
    // ---- lichen: crusty rosettes and scattered flecks, pale and quiet
    for (let k = 0; k < 13; k++) {
      const x = R() * TW, y = 200 + R() * 245, Rr = 5 + 9 * R(), kind = R() < 0.6 ? 0 : 1, sq = 1 / vRate(y - rimAt(x)), p0 = R() * TAU, lobes = 5 + fl(R() * 4);
      if (Math.abs(wrapd(x - CSX)) < 30 && Math.abs(y - SITE_Y) < 22) continue;
      const col = kind ? [0.77, 0.71, 0.53] : [0.68, 0.7, 0.61];
      stamp(x, y, Rr * 1.35, Rr * 1.35 * sq, (i, d, u, v) => {
        const th = Math.atan2(v, u), rr = Math.sqrt(d) * 1.35;
        const edge = 1 + 0.2 * Math.sin(lobes * th + p0) + 0.12 * (vn2(th * 3 + k * 7, 0, 70) - 0.5);
        if (rr > edge) return;
        const q = rr / edge, lobe = fr((th + p0) / TAU * lobes * 2);
        let m = 0.86 + 0.22 * vn2(u * 9 + k, v * 9, 71);
        if (q > 0.82) m *= 1.1;                                            // the growing rim is paler
        if (lobe < 0.12 && q > 0.3) m *= 0.84;                             // between the lobes
        let c = col;
        if (q < 0.55 && ih(i, k, 72) < 0.09) c = [0.32, 0.27, 0.22];       // fruiting dots in the old centre
        SALB[i * 3] = c[0] * m; SALB[i * 3 + 1] = c[1] * m; SALB[i * 3 + 2] = c[2] * m;
        SHT[i] += 0.45 + 0.25 * (1 - q) + (lobe < 0.12 ? -0.15 : 0);
      });
    }
    for (let k = 0; k < 220; k++) {
      const x = R() * TW, y = 192 + R() * 260, r = 0.6 + 1.2 * R(), kind = R(), sq = 1 / vRate(y - rimAt(x));
      const c = kind < 0.45 ? [0.68, 0.7, 0.62] : kind < 0.75 ? [0.78, 0.72, 0.55] : [0.22, 0.21, 0.22];
      stamp(x, y, r, Math.max(0.5, r * sq), (i) => { SALB[i * 3] = c[0]; SALB[i * 3 + 1] = c[1]; SALB[i * 3 + 2] = c[2]; SHT[i] += 0.25; });
    }
    // ---- branch cracks running off the main crack, thin and wandering
    for (let b = 0; b < 4; b++) {
      let x = (CSX + 50 + b * 62 + R() * 30) % TW;
      if (Math.abs(wrapd(x - CSX)) < 30) x = mod(x + 50, TW);
      let y = CRY[fl(x)], dir = (b % 2 ? -1 : 1), ang = dir > 0 ? 1.2 + R() * 0.5 : -1.3 - R() * 0.4;
      const len = 40 + R() * 70;
      for (let s = 0; s < len; s += 0.5) {
        ang += (R() - 0.5) * 0.18; const w = 0.75 * (1 - s / len) + 0.2;
        x += Math.cos(ang) * 0.5; y += Math.sin(ang) * 0.5 * (dir < 0 ? 1 / vRate(y - rimAt(x)) : 1);
        if (y < rimAt(x) + 2 || y > H) break;
        stamp(x, y, w + 0.6, w + 0.6, (i, d) => { const q = Math.sqrt(d) * (w + 0.6); if (q < w) { CRK[i] = Math.min(CRK[i], q / w); } });
      }
    }
    // ---- the main crack, its lips, the grit and dust settled in it
    for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) {
      const i = ty * TW + tx; if (!SM[i]) continue;
      const sy = ty + TY0, sl = (CRY[(tx + 1) % TW] - CRY[(tx + TW - 1) % TW]) / 2;
      const dd = Math.abs(sy + 0.5 - CRY[tx]) / Math.sqrt(1 + sl * sl), hw = CRW[tx];
      if (dd < hw) {
        SIN[i] = 1;
        SHT[i] -= 9 * Math.sqrt(1 - (dd / hw) * (dd / hw)) + 1.5;
        const g = ih(tx, ty, 80);
        let c = g > 0.72 ? [0.6, 0.54, 0.46] : g > 0.5 ? [0.42, 0.38, 0.36] : [0.3, 0.27, 0.27];
        SALB[i * 3] = c[0]; SALB[i * 3 + 1] = c[1]; SALB[i * 3 + 2] = c[2]; SGL[i] = 0;
      } else if (dd < hw + 1.8) {
        const q = 1 - (dd - hw) / 1.8;
        SHT[i] -= 1.0 * q * q;
        const du = 0.4 * q * (0.6 + 0.4 * ih(tx, ty, 81));
        SALB[i * 3] = lerp(SALB[i * 3], 0.7, du); SALB[i * 3 + 1] = lerp(SALB[i * 3 + 1], 0.62, du); SALB[i * 3 + 2] = lerp(SALB[i * 3 + 2], 0.5, du);
      }
      if (CRK[i] < 1) { SHT[i] -= 2.6 * (1 - CRK[i] * CRK[i]); DARK[i] = Math.max(DARK[i], 0.35); }
    }
    // ---- the flake: a loose scale of rock on the far lip, just right of the seed, ringed by a hairline
    {
      const cx = CSX + 13, cy = SITE_Y - CRW[CSX] - 3.8;
      FLKCX = cx; FLKCY = cy - TY0; FLKX0 = 1e9; FLKX1 = -1; FLKY0 = 1e9; FLKY1 = -1;
      for (let y = fl(cy - 8); y <= cy + 6; y++) for (let x = fl(cx - 12); x <= cx + 12; x++) {
        const ty = y - TY0, i = ty * TW + x;
        const u = (x + 0.5 - cx) / 9, v = (y + 0.5 - cy) / 4.2, th = Math.atan2(v, u);
        const r = Math.hypot(u, v), edge = 1 + 0.16 * Math.sin(3 * th + 1.3) + 0.08 * Math.sin(7 * th);
        const onCrack = (y + 0.5) > CRY[x] - CRW[x] - 0.2;
        if (r < edge && !onCrack) {
          FLK[i] = 1; FLKX0 = Math.min(FLKX0, x); FLKX1 = Math.max(FLKX1, x); FLKY0 = Math.min(FLKY0, ty); FLKY1 = Math.max(FLKY1, ty);
          SHT[i] = SHT[i] * 0.4 + 1.6 + 0.6 * (1 - r);                           // a scale standing proud of the surface
          SALB[i * 3] = lerp(SALB[i * 3], 0.72, 0.3); SALB[i * 3 + 1] = lerp(SALB[i * 3 + 1], 0.68, 0.3); SALB[i * 3 + 2] = lerp(SALB[i * 3 + 2], 0.62, 0.3);
        } else if (r < edge + 0.35 && !onCrack) { SHT[i] -= 2.2; DARK[i] = Math.max(DARK[i], 0.7); }
      }
    }
    // ---- dust in the hollows (against a local mean), fresh chips paler, dark lines darker
    const MEAN = new Float32Array(TN);
    for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) {
      let s = 0, n = 0;
      for (let j = -3; j <= 3; j++) { const yy = ty + j; if (yy < 0 || yy >= TH) continue; for (let k = -3; k <= 3; k++) { const ii = yy * TW + mod(tx + k, TW); if (SM[ii]) { s += SHT[ii]; n++; } } }
      MEAN[ty * TW + tx] = n ? s / n : 0;
    }
    for (let i = 0; i < TN; i++) {
      if (!SM[i]) continue;
      const low = MEAN[i] - SHT[i];
      if (low > 0.35 && low < 5) { const u = clamp((low - 0.35) * 0.45, 0, 0.55); SALB[i * 3] = lerp(SALB[i * 3], 0.71, u); SALB[i * 3 + 1] = lerp(SALB[i * 3 + 1], 0.63, u); SALB[i * 3 + 2] = lerp(SALB[i * 3 + 2], 0.51, u); }
      if (FRESH[i]) { SALB[i * 3] = lerp(SALB[i * 3], 0.76, 0.5); SALB[i * 3 + 1] = lerp(SALB[i * 3 + 1], 0.72, 0.5); SALB[i * 3 + 2] = lerp(SALB[i * 3 + 2], 0.66, 0.5); }
      if (DARK[i] > 0) { const m = 1 - DARK[i]; SALB[i * 3] *= m; SALB[i * 3 + 1] *= m; SALB[i * 3 + 2] *= m * 1.02; }
    }
    // ---- normals (with the dome: the surface rolls away toward the far edge)
    for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) {
      const i = ty * TW + tx; if (!SM[i]) continue;
      const hL = SHT[ty * TW + mod(tx - 1, TW)], hR = SHT[ty * TW + mod(tx + 1, TW)];
      const iu = ty > 0 && SM[i - TW] ? i - TW : i, idn = ty < TH - 1 ? i + TW : i;
      const dr = ty + TY0 - RIM[tx], vr = vRate(dr);
      const dhx = (hR - hL) / 2, dhy = (SHT[idn] - SHT[iu]) / ((idn - iu) / TW || 1) / vr;
      let nx = -dhx, ny = -dhy, nz = 1;
      const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const tau = 1.05 * Math.exp(-dr / 15) - 0.14 * sstep(380, 450, ty + TY0);
      const ct = Math.cos(tau), st = Math.sin(tau);
      SNRM[i * 3] = nx; SNRM[i * 3 + 1] = ny * ct - nz * st; SNRM[i * 3 + 2] = ny * st + nz * ct;
    }
    // ---- horizons: for 16 directions, the steepest rise seen from each texel (soft raking shadows every frame)
    const KS = [1, 2, 3, 4, 5, 6, 8, 10, 13, 17, 22, 28];
    for (let a = 0; a < NA; a++) {
      const ca = Math.cos(a / NA * TAU), sa = Math.sin(a / NA * TAU);
      for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) {
        const i = ty * TW + tx; if (!SM[i]) continue;
        const h0 = SHT[i]; let m = -1;
        for (const k of KS) {
          const yy = Math.round(ty + sa * k);
          if (yy >= TH) break;
          let hh;
          if (yy < 0) hh = -30; else { const j = yy * TW + mod(Math.round(tx + ca * k), TW); hh = SM[j] ? SHT[j] : -30; }
          const g = (hh - h0) / k; if (g > m) m = g;
        }
        SHOR[i * NA + a] = m;
      }
    }
    for (let i = 0; i < TN; i++) {
      if (!SM[i]) continue;
      let s = 0; for (let a = 0; a < NA; a++) s += Math.max(0, SHOR[i * NA + a]) / Math.sqrt(1 + SHOR[i * NA + a] * SHOR[i * NA + a]);
      SAO[i] = clamp(1 - 1.5 * s / NA, 0.15, 1);
    }
  }

  /* ================================================================ the haze behind: distant sunlit grass, out of focus */
  const BGH = 200;                              // rows of background that can show above the rock
  const BGG = new Float32Array(W * BGH), BGR = new Float32Array(W * BGH);
  const BOKEH = [];                             // { idx: Int32Array, wt: Float32Array, ph, k, a }
  function paintBackground() {
    const R = mulberry32(911);
    for (let y = 0; y < BGH; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      BGG[i] = clamp(y / 192, 0, 1);
      // a soft band of grass along the bottom: blurred vertical strokes, lighter tips catching the sun
      const band = sstep(105, 186, y + 10 * (fbm(x / 60, 0.3, 90, 2) - 0.5));
      const strokes = 0.55 + 0.45 * fbm(x / 7, y / 70, 91, 3);
      BGR[i] = band * strokes;
    }
    const spots = [[38, 92, 15, 0.7], [112, 128, 11, 0.55], [262, 74, 17, 0.6], [318, 138, 12, 0.8], [204, 150, 9, 0.5], [84, 160, 8, 0.6],
      [296, 32, 10, 0.32], [24, 30, 8, 0.3], [170, 108, 6, 0.4], [350, 96, 7, 0.45], [236, 168, 6, 0.5], [140, 60, 5, 0.3]];
    for (const [cx, cy, r, a] of spots) {
      const idx = [], wt = [];
      for (let y = fl(cy - r - 2); y <= cy + r + 2; y++) for (let x = fl(cx - r - 2); x <= cx + r + 2; x++) {
        if (x < 0 || y < 0 || x >= W || y >= BGH) continue;
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
        if (d > 1.15) continue;
        // a disc with a soft edge and a slightly brighter rim, the way a lens draws a point of light out of focus
        const w = sstep(1.15, 0.88, d) * (0.78 + 0.22 * sstep(0.5, 0.95, d));
        idx.push(y * W + x); wt.push(w);
      }
      BOKEH.push({ idx: Int32Array.from(idx), wt: Float32Array.from(wt), ph: R() * TAU, k: 1 + fl(R() * 3), a });
    }
  }

  /* ================================================================ per frame: the haze */
  const GLC = new Float32Array(W);
  function drawBackground(t) {
    const h0 = LS.h0, h1 = LS.h1, bk = LS.bok;
    // the sun's side of the haze glows when the sun is behind things
    const sxs = 180 + 230 * LS.lx, gl = 0.22 * LS.back + 0.05;
    const gr = [0.74, 0.70, 0.55];                       // the grass band: an olive-ochre darkening of the haze
    for (let x = 0; x < W; x++) { const dx = (x - sxs) / 190; GLC[x] = gl * Math.exp(-dx * dx); }
    for (let y = 0; y < BGH; y++) {
      const g = BGG[y * W], gg = Math.pow(g, 1.25), r0 = lerp(h0[0], h1[0], gg), g0 = lerp(h0[1], h1[1], gg), b0 = lerp(h0[2], h1[2], gg), gf = 1 - 0.45 * g;
      for (let x = 0; x < W; x++) {
        const i = y * W + x, j = i * 3;
        let r = r0, gn = g0, b = b0;
        const s = GLC[x] * gf;
        r += s * LS.sr; gn += s * LS.sg; b += s * LS.sb;
        const m = BGR[i] * 0.42;
        r *= 1 - m * (1 - gr[0]); gn *= 1 - m * (1 - gr[1]); b *= 1 - m * (1 - gr[2]);
        C[j] = r * 255; C[j + 1] = gn * 255; C[j + 2] = b * 255;
      }
    }
    // bokeh: soft discs of light that breathe a little, brightest when the grass is backlit
    const bm = 62 * bk * (0.55 + 0.45 * LS.back), br = (0.55 * LS.sr + 0.45 * h1[0]) * bm, bg = (0.55 * LS.sg + 0.45 * h1[1]) * bm, bb = (0.55 * LS.sb + 0.45 * h1[2]) * bm;
    for (const B of BOKEH) {
      const a = B.a * (0.82 + 0.18 * Math.sin(per(B.k, t) + B.ph));
      for (let n = 0; n < B.idx.length; n++) { const j = B.idx[n] * 3, w = B.wt[n] * a; C[j] += br * w; C[j + 1] += bg * w; C[j + 2] += bb * w; }
    }
  }

  /* ================================================================ the sky: soft clouds, a flock at dawn */
  // A few soft clouds form, drift slowly and dissolve again (each lives a window of the loop, so the sky at t = D is
  // the sky at t = 0); their edges catch the colour of the hour on the side toward the sun. None of them sits behind
  // the words while the words are up.
  const CLOUDS = [
    { y: 50, x: 150, v: 3.2, tm: 3.0, life: 12, w: 64, h: 11, a: 0.8 },
    { y: 112, x: 262, v: 2.4, tm: 8.5, life: 14, w: 54, h: 10, a: 0.5 },
    { y: 138, x: 46, v: 3.0, tm: 18.5, life: 12, w: 50, h: 9, a: 0.42 },
    { y: 150, x: 300, v: 2.0, tm: 13.0, life: 13, w: 70, h: 8, a: 0.4 },
  ];
  function buildClouds() {
    CLOUDS.forEach((c, k) => {
      const w = c.w, h = c.h, cw = 2 * w + 1, ch = 3 * h + 1;
      const Dn = new Float32Array(cw * ch);
      for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
        const u = (i - w) / w, v = (j - 2 * h) / h;              // the cloud's base sits at v = 0, puffs rise to v = −2
        const top = 1.2 + 0.8 * fbm(i / 16 + k * 7, 0.5, 700 + k, 3) - 0.9 * u * u;
        const inside = v < 0 ? (-v) / Math.max(0.2, top) : v / 0.55;
        let d = 1 - inside * inside - 0.5 * u * u;
        d += 0.55 * (fbm(i / 9 + k * 3, j / 5, 710 + k, 3) - 0.5);
        Dn[j * cw + i] = clamp(d * 1.8, 0, 1);
      }
      c.cw = cw; c.ch = ch; c.D = Dn;
    });
  }
  function drawClouds(t) {
    const sdx = LS.lx >= 0 ? 1 : -1;                              // which side the sun is on
    for (const c of CLOUDS) {
      const dt = mod(t - c.tm + D / 2, D) - D / 2;
      if (Math.abs(dt) >= c.life / 2) continue;
      const al = c.a * Math.pow(Math.sin(Math.PI * (dt / c.life + 0.5)), 2);
      const ox = Math.round(c.x + c.v * dt - c.w), oy = Math.round(c.y - 2 * c.h), cw = c.cw, Dn = c.D;
      for (let j = 0; j < c.ch; j++) {
        const y = oy + j; if (y < 0 || y >= BGH) continue;
        for (let i = 1; i < cw - 1; i++) {
          const x = ox + i; if (x < 0 || x >= W) continue;
          const d = Dn[j * cw + i]; if (d <= 0) continue;
          // light on the edge facing the sun and on the tops, a cooler belly
          const lit = clamp((Dn[j * cw + i - sdx] - d) * -3 + (j > 0 ? (d - Dn[(j - 1) * cw + i]) * 2.2 : 0), 0, 1);
          const belly = j > 2 * c.h - 2 ? 0.08 : 0;
          const k = (y * W + x) * 3, a = d * al;
          const r = C[k] * (1.04 - belly) + (24 + 70 * lit) * LS.sr * LS.sun * 0.5;
          const g = C[k + 1] * (1.03 - belly) + (22 + 60 * lit) * LS.sg * LS.sun * 0.5;
          const b = C[k + 2] * (1.02 - belly * 0.5) + (20 + 40 * lit) * LS.sb * LS.sun * 0.5;
          C[k] += (r - C[k]) * a; C[k + 1] += (g - C[k + 1]) * a; C[k + 2] += (b - C[k + 2]) * a;
          if (a > 0.06) PXN++;                       // the motion check counts what shows
        }
      }
    }
  }
  // a small flock crossing high at first light, in a loose V, wings beating; enters and leaves by the edges
  const FLOCK = [[0, 0], [9, -5], [8, 6], [18, -10], [17, 11], [27, -14]];
  function drawFlock(t) {
    const u = mod(t - 23.3, D);
    if (u > 6.6) return;
    const x0 = 392 - 72 * u, y0 = 74 - 5 * u + 3 * Math.sin(u * 1.3);
    const cr = LS.h0[0] * 255 * 0.34, cg = LS.h0[1] * 255 * 0.3, cb = LS.h0[2] * 255 * 0.38;
    for (let i = 0; i < FLOCK.length; i++) {
      const x = x0 + FLOCK[i][0] + 1.6 * Math.sin(u * 2.1 + i), y = y0 + FLOCK[i][1] * 0.85 + 1.3 * Math.sin(u * 3.1 + i * 1.7);
      if (x < -6 || x > W + 6) continue;
      const fp = Math.sin(TAU * 3.3 * u + i * 1.3);
      mixPx(x, y, cr, cg, cb, 0.9); mixPx(x + 1, y, cr, cg, cb, 0.75);
      for (let s = 1; s <= 3; s++) {
        const wy = y - fp * s * 0.6 + (s === 3 ? 0.3 : 0);
        mixPx(x + 0.4 - s * 0.35, wy - (s > 1 ? 0 : 0), cr, cg, cb, 0.8 - s * 0.12);
        mixPx(x + 0.6 + s * 0.35, wy + 0.1, cr, cg, cb, 0.8 - s * 0.12);
      }
    }
  }
  // first light: a warm shaft of low sun sweeping across the rock from the left; it arrives as the seed lands at the
  // end of the loop and is on the seed at t = 0, then moves on and fades as the day comes up
  const T_BEAM = 22.6;
  function drawBeam(t) {
    const u = mod(t - T_BEAM, D);
    const E = sstep(0, 1.1, u) * (1 - sstep(3.4, 5.4, u));
    if (E <= 0.002) return;
    const xs = X0 + 58 * (u - 1.6), w = 30;
    const wr = 0.9 * LS.sr, wg = 0.72 * LS.sg, wb = 0.42 * LS.sb, tx0 = mod(CAMI + OFFX, TW);
    for (let y = 0; y < H; y++) {
      const off = xs + 0.62 * (y - SITE_Y);
      const x0 = Math.max(0, fl(off - 2.6 * w)), x1 = Math.min(W - 1, Math.ceil(off + 2.6 * w));
      for (let x = x0; x <= x1; x++) {
        const q = (x - off) / w, b = Math.exp(-q * q) * E;
        if (b < 0.01) continue;
        const j = (y * W + x) * 3, sky = y < RIM[mod(tx0 + x, TW)];
        if (sky) { const a = 16 * b; C[j] += a * wr; C[j + 1] += a * wg; C[j + 2] += a * wb; }
        else { const m = 0.62 * b; C[j] *= 1 + m * wr; C[j + 1] *= 1 + m * wg; C[j + 2] *= 1 + m * wb; C[j] += 8 * b * wr; C[j + 1] += 6 * b * wg; C[j + 2] += 3 * b * wb; }
      }
    }
  }

  /* ================================================================ per frame: the rock, relit */
  const PSH = new Float32Array(NP);             // the plant's shadow on the rock, 0..1
  const CRM = new Uint8Array(NP);               // 1 where the rock shows the inside of the crack this frame
  const SIN = new Uint8Array(TN);               // texels inside the crack (set at paint time)
  let A0 = 0, A1 = 0, AF = 0, HX = 0, HY = 0, HZ = 0;
  function lightPrep() {
    const fa = mod(LS.ta / TAU * NA, NA); A0 = fl(fa) % NA; A1 = (A0 + 1) % NA; AF = fa - fl(fa);
    // half vector between the sun and the eye (low, looking across the rock) for the mica glints
    const vx = 0, vy = 0.8, vz = 0.6;
    HX = LS.tx + vx; HY = LS.ty + vy; HZ = LS.tz + vz; const hl = Math.hypot(HX, HY, HZ) || 1; HX /= hl; HY /= hl; HZ /= hl;
  }
  const SC = [0, 0, 0];
  // shade texel i (screen pixel p, screen row y) into SC; albedo may be overridden
  function shadeTexel(i, p, dr, ar, ag, ab, aoMul) {
    const nx = SNRM[i * 3], ny = SNRM[i * 3 + 1], nz = SNRM[i * 3 + 2];
    let ndl = nx * LS.tx + ny * LS.ty + nz * LS.tz; if (ndl < 0) ndl = 0;
    const hor = SHOR[i * NA + A0] * (1 - AF) + SHOR[i * NA + A1] * AF;
    const sh = sstep(-0.05, 0.09, LS.tan - hor) * (1 - 0.88 * PSH[p]);
    const sun = LS.sun * ndl * sh * 1.6;
    const sky = (0.42 + 0.58 * nz) * SAO[i] * (aoMul || 1) * 0.78;
    let r = ar * (LS.sr * sun + LS.ar * sky) * 255, g = ag * (LS.sg * sun + LS.ag * sky) * 255, b = ab * (LS.sb * sun + LS.ab * sky) * 255;
    const gl = SGL[i];
    if (gl > 0 && sh > 0.4) {
      const d = nx * HX + ny * HY + nz * HZ;
      if (d > 0.9) { const s = Math.pow((d - 0.9) / 0.1, 6) * gl * LS.sun * sh * 150; r += s * LS.sr; g += s * LS.sg; b += s * LS.sb; }
    }
    if (dr < 30) { const f = 0.34 * Math.exp(-dr / 8); r = lerp(r, LS.h1[0] * 236, f); g = lerp(g, LS.h1[1] * 236, f); b = lerp(b, LS.h1[2] * 236, f); }
    SC[0] = r; SC[1] = g; SC[2] = b;
  }
  let RIMTOP = 0;
  function drawStone() {
    const tx0 = mod(CAMI + OFFX, TW);
    for (let y = RIMTOP; y < H; y++) {
      const ty = y - TY0, row = ty * TW;
      let tx = tx0;
      for (let x = 0; x < W; x++, tx++) {
        if (tx >= TW) tx -= TW;
        const i = row + tx, p = y * W + x;
        if (!SM[i]) { CRM[p] = 0; continue; }
        CRM[p] = SIN[i];
        shadeTexel(i, p, y - RIM[tx], SALB[i * 3], SALB[i * 3 + 1], SALB[i * 3 + 2]);
        const j = p * 3; C[j] = SC[0]; C[j + 1] = SC[1]; C[j + 2] = SC[2];
      }
    }
  }
  // soft focus: the near rock at the bottom of the frame and the far edge are a little out of the focal plane
  function softFocus() {
    const pass = (y, a) => {
      for (let x = 0; x < W; x++) {
        const j = (y * W + x) * 3, l = (y * W + Math.max(0, x - 1)) * 3, r = (y * W + Math.min(W - 1, x + 1)) * 3;
        const u = (Math.max(RIMTOP, y - 1) * W + x) * 3, d = (Math.min(H - 1, y + 1) * W + x) * 3;
        for (let c = 0; c < 3; c++) C2[j + c] = C[j + c] * (1 - a) + a * 0.25 * (C[l + c] + C[r + c] + C[u + c] + C[d + c]);
      }
    };
    for (let y = 404; y < H; y++) pass(y, 0.85 * sstep(404, 450, y));
    for (let y = 404; y < H; y++) for (let x = 0, j = y * W * 3; x < W; x++, j += 3) { C[j] = C2[j]; C[j + 1] = C2[j + 1]; C[j + 2] = C2[j + 2]; }
  }

  /* ================================================================ the crack where the seed is: widening, the flake, chips, grit, dust */
  const T_LIFT = 5.9, T_BREAK = 7.25;
  const widenAt = (tau) => 0.4 * sstep(T_LIFT, T_BREAK, tau) + 1.9 * back(ph(tau, T_BREAK, T_BREAK + 0.4), 1.2);
  const FS = new Float32Array(48 * 24 * 3), FSM = new Uint8Array(48 * 24);   // the flake's own pixels, this frame
  const FRESHC = [0.76, 0.72, 0.65];
  function flakePose(tau) {
    // lift during the strain (with the shoot's tremble), then the break: it flips over to the left and lands
    if (tau < T_BREAK) {
      const lift = 1.6 * sstep(T_LIFT, 6.85, tau) + (tau > 6.2 && tau < 6.85 ? 0.35 * Math.sin(tau * 61) * sstep(6.2, 6.6, tau) : 0);
      return [0, -lift, 0, 1];
    }
    const u = ph(tau, T_BREAK, T_BREAK + 0.62), e = s5(u);
    let ox = 15 * e, oy = -1.6 - 6.5 * Math.sin(Math.PI * Math.min(1, u * 1.05)) + 3.2 * e;
    let flip = 1 - 0.62 * Math.sin(Math.PI * e), rot = -0.45 * Math.sin(Math.PI * u) + 0.1 * e;
    const v = ph(tau, T_BREAK + 0.62, T_BREAK + 0.95);
    if (v > 0 && v < 1) { oy -= 1.2 * Math.sin(Math.PI * v) * (1 - v); rot += 0.06 * Math.sin(v * 12) * (1 - v); }
    return [ox, oy, rot, flip];
  }
  function drawSite(k, t) {
    const sx = X0 - CAMI + k * P, tau = t - k * D;
    if (sx < -60 || sx > W + 60 || tau < T_LIFT - 0.1) return;
    const wd = widenAt(tau);
    const tx0 = mod(CAMI + OFFX, TW);
    // the crack opens: new crack interior, fresh pale walls and lips
    for (let y = SITE_Y - 9; y <= SITE_Y + 9; y++) for (let x = Math.max(0, sx - 34); x <= Math.min(W - 1, sx + 34); x++) {
      const tx = mod(tx0 + x, TW), ty = y - TY0, i = ty * TW + tx, p = y * W + x;
      if (!SM[i] || FLK[i]) continue;
      const g = Math.exp(-Math.pow((x - sx - 2) / 13, 2)), add = wd * g;
      if (add < 0.05) continue;
      const sl = (CRY[(tx + 1) % TW] - CRY[(tx + TW - 1) % TW]) / 2, dy = y + 0.5 - CRY[tx];
      const dd = Math.abs(dy) / Math.sqrt(1 + sl * sl), hw = CRW[tx], hwE = hw + add;
      const j = p * 3;
      if (dd >= hw && dd < hwE) {
        CRM[p] = 1;
        if (dy < 0 && dd > hwE - 1.0) {                       // the far wall, freshly broken, faces us
          shadeTexel(i, p, 99, FRESHC[0] * 0.8, FRESHC[1] * 0.8, FRESHC[2] * 0.8, 0.55);
          C[j] = SC[0]; C[j + 1] = SC[1]; C[j + 2] = SC[2];
        } else {
          const a = 0.3 + 0.1 * ih(tx, ty, 82);
          C[j] = a * LS.ar * 255 * 0.5; C[j + 1] = a * LS.ag * 255 * 0.48; C[j + 2] = a * LS.ab * 255 * 0.52;
        }
      } else if (dd >= hwE && dd < hwE + 1.1 && add > 0.35) {
        const f = 0.55 * sstep(0.35, 1.0, add);
        shadeTexel(i, p, 99, lerp(SALB[i * 3], FRESHC[0], f), lerp(SALB[i * 3 + 1], FRESHC[1], f), lerp(SALB[i * 3 + 2], FRESHC[2], f));
        C[j] = SC[0]; C[j + 1] = SC[1]; C[j + 2] = SC[2];
      }
    }
    // the flake: shade its own pixels, paint what is under it, then draw it where it is now
    const fw = FLKX1 - FLKX0 + 1, fh = FLKY1 - FLKY0 + 1;
    const fx0 = FLKX0 - CSX + sx, fy0 = FLKY0 + TY0;       // screen position of the flake box at rest
    FSM.fill(0);
    for (let v = 0; v < fh; v++) for (let u = 0; u < fw; u++) {
      const i = (FLKY0 + v) * TW + FLKX0 + u; if (!FLK[i]) continue;
      const x = fx0 + u, y = fy0 + v, p = clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1);
      shadeTexel(i, p, 99, SALB[i * 3], SALB[i * 3 + 1], SALB[i * 3 + 2]);
      const q = v * fw + u; FSM[q] = 1; FS[q * 3] = SC[0]; FS[q * 3 + 1] = SC[1]; FS[q * 3 + 2] = SC[2];
      if (x < 0 || x >= W) continue;
      // under the flake: in its shadow while it is lifted, a pale fresh scar once it has gone
      const gone = sstep(T_BREAK, T_BREAK + 0.3, tau);
      shadeTexel(i, p, 99, FRESHC[0], FRESHC[1], FRESHC[2], 0.7);
      const dark = 0.22;
      const j = p * 3;
      C[j] = lerp(SC[0] * dark, SC[0], gone); C[j + 1] = lerp(SC[1] * dark, SC[1], gone); C[j + 2] = lerp(SC[2] * dark, SC[2], gone);
    }
    const [ox, oy, rot, flip] = flakePose(tau), moved = ox !== 0 || oy !== 0 || rot !== 0 || flip !== 1;
    const ccx = FLKCX - FLKX0, ccy = FLKCY - FLKY0;           // centre within the box
    const cr = Math.cos(rot), sr = Math.sin(rot), R = Math.max(fw, fh);
    const dcx = fx0 + ccx + ox, dcy = fy0 + ccy + oy;
    // under-side colour: fresh rock in the light
    const und = [0, 0, 0];
    { const nz = flip < 0 ? 1 : 0.6, l = LS.sun * Math.max(0, LS.tz * nz + LS.ty * 0.3) * 1.2, s = 0.9;
      und[0] = FRESHC[0] * (LS.sr * l + LS.ar * s) * 255; und[1] = FRESHC[1] * (LS.sg * l + LS.ag * s) * 255; und[2] = FRESHC[2] * (LS.sb * l + LS.ab * s) * 255; }
    for (let y = fl(dcy - R); y <= dcy + R; y++) for (let x = fl(dcx - R); x <= dcx + R; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const qx = x + 0.5 - dcx, qy = y + 0.5 - dcy;
      let u = cr * qx + sr * qy, v = -sr * qx + cr * qy;
      if (Math.abs(flip) < 0.12) { if (Math.abs(v) > 0.6) continue; v = 0; } else v /= flip;
      const su = fl(u + ccx), sv = fl(v + ccy);
      if (su < 0 || sv < 0 || su >= fw || sv >= fh) continue;
      const q = sv * fw + su; if (!FSM[q]) continue;
      if (k === 0 && tau < T_BREAK) FOCC[y * W + x] = FR;
      const j = (y * W + x) * 3;
      if (moved) PXN++;
      if (flip > 0) { const m = 0.75 + 0.25 * flip; C[j] = FS[q * 3] * m; C[j + 1] = FS[q * 3 + 1] * m; C[j + 2] = FS[q * 3 + 2] * m; }
      else { const m = 0.7 + 0.3 * -flip; C[j] = und[0] * m; C[j + 1] = und[1] * m; C[j + 2] = und[2] * m; }
    }
    // a thin shadow where the flake has landed
    if (tau > T_BREAK + 0.55) {
      const a = sstep(T_BREAK + 0.55, T_BREAK + 0.8, tau);
      for (let u = -fw / 2 + 1; u < fw / 2 - 1; u++) mixPx(dcx + u, dcy + fh * 0.5 * Math.abs(flip) + 0.6, LS.ar * 60, LS.ag * 55, LS.ab * 70, 0.5 * a);
    }
    if (k !== 0) return;
    drawChips(sx, tau); drawGrit(sx, tau, tx0); drawDust(sx, tau);
  }
  function mixPx(x, y, r, g, b, a) {
    x = fl(x); y = fl(y);
    if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
    PXN++;
    const j = (y * W + x) * 3;
    C[j] += (r - C[j]) * a; C[j + 1] += (g - C[j + 1]) * a; C[j + 2] += (b - C[j + 2]) * a;
  }
  // a point drawn at a sub-pixel position, spread over the four pixels it touches (smooth slow motion)
  function softPx(x, y, r, g, b, a) {
    const xi = fl(x - 0.5), yi = fl(y - 0.5), fx = x - 0.5 - xi, fy = y - 0.5 - yi;
    mixPx(xi, yi, r, g, b, a * (1 - fx) * (1 - fy)); mixPx(xi + 1, yi, r, g, b, a * fx * (1 - fy));
    mixPx(xi, yi + 1, r, g, b, a * (1 - fx) * fy); mixPx(xi + 1, yi + 1, r, g, b, a * fx * fy);
  }
  function litRock(albr, albg, albb, nup) {
    const l = LS.sun * Math.max(0, LS.tz * nup + 0.35 * Math.abs(LS.tx)) * 1.25, s = 0.9;
    SC[0] = albr * (LS.sr * l + LS.ar * s) * 255; SC[1] = albg * (LS.sg * l + LS.ag * s) * 255; SC[2] = albb * (LS.sb * l + LS.ab * s) * 255;
    return SC;
  }
  // chips that spring off the lip at the break
  const CHIPS = [];
  function buildChips() {
    const R = mulberry32(4242);
    for (let k = 0; k < 7; k++) CHIPS.push({ x: -3 + R() * 13, y: -3.5 + R() * 2.5, vx: (R() - 0.45) * 70, vy: -30 - R() * 40, land: 1 + R() * 6, big: R() < 0.35, sh: 0.8 + R() * 0.25 });
  }
  function drawChips(sx, tau) {
    if (tau < T_BREAK) return;
    const dt = tau - T_BREAK;
    for (const c of CHIPS) {
      // flight under gravity until it comes down to its landing row, then it lies there
      const g = 320, tl = (-c.vy + Math.sqrt(c.vy * c.vy + 2 * g * c.land)) / g, tt = Math.min(dt, tl);
      const x = sx + c.x + c.vx * tt, y = SITE_Y + c.y + c.vy * tt + 0.5 * g * tt * tt;
      const col = litRock(FRESHC[0] * c.sh, FRESHC[1] * c.sh, FRESHC[2] * c.sh, 1);
      mixPx(x, y, col[0], col[1], col[2], 1);
      if (c.big) mixPx(x + 1, y, col[0] * 0.85, col[1] * 0.85, col[2] * 0.85, 1);
      if (dt >= tl) mixPx(x, y + 1, LS.ar * 50, LS.ag * 45, LS.ab * 60, 0.6);
    }
  }
  // grit trickling over the lips into the opening crack
  const GRIT = [];
  function buildGrit() {
    const R = mulberry32(777);
    for (let k = 0; k < 26; k++) {
      const early = k < 9;
      GRIT.push({ t0: early ? 6.0 + R() * 1.2 : T_BREAK + Math.pow(R(), 1.6) * 4.2, dx: -13 + R() * 26, far: R() < 0.6, dur: 0.55 + R() * 0.7, sh: 0.75 + R() * 0.35 });
    }
  }
  function drawGrit(sx, tau, tx0) {
    for (const g of GRIT) {
      const u = (tau - g.t0) / g.dur;
      if (u < 0 || u > 1) continue;
      const x = sx + g.dx + 0.6 * Math.sin(u * 5 + g.dx), tx = mod(tx0 + fl(x), TW);
      const hw = CRW[tx] + widenAt(tau) * Math.exp(-Math.pow((x - sx - 2) / 13, 2));
      const yLip = CRY[tx] + (g.far ? -hw - 0.8 : hw + 0.6), y = lerp(yLip, CRY[tx] + (g.far ? 0.5 : -0.5), u * u);
      const col = litRock(0.72 * g.sh, 0.64 * g.sh, 0.52 * g.sh, 1), dk = 1 - 0.85 * sstep(0.35, 1, u);
      mixPx(x, y, col[0] * dk, col[1] * dk, col[2] * dk, 1 - 0.6 * sstep(0.6, 1, u));
    }
  }
  // a breath of dust at the break, drifting off on the air and thinning
  const DUST = [];
  function buildDust() {
    const R = mulberry32(31337);
    for (let k = 0; k < 34; k++) DUST.push({ x: (R() - 0.3) * 9, y: -2 - R() * 3, vx: (R() - 0.5) * 16, vy: -5 - R() * 12, life: 1.1 + R() * 1.1, a: 0.25 + R() * 0.3 });
  }
  function drawDust(sx, tau) {
    const dt = tau - T_BREAK;
    if (dt < 0 || dt > 2.4) return;
    const col = litRock(0.82, 0.74, 0.62, 0.8);
    for (const d of DUST) {
      const u = dt / d.life; if (u >= 1) continue;
      const e = 1 - Math.exp(-dt * 2.2);
      const x = sx + 5 + d.x + d.vx * e / 2.2 + 4 * dt, y = SITE_Y + d.y + d.vy * e / 2.2 - 2 * dt;
      softPx(x, y, col[0], col[1], col[2], d.a * Math.pow(1 - u, 2) * sstep(0, 0.08, u));
    }
  }

  /* ================================================================ the plant: built every frame in 3D */
  // Plant-local space: X right, Y up from the crack, Z toward the viewer; screen = (BX + X, BY − Y + 0.3 Z).
  // Every sample is shaded with one light model and z-buffered into its own layer, which is then composited over
  // the rock with selective outlines (dark on the side away from the sun, a glowing rim on the side toward it).
  const PZ = new Float32Array(NP), PST = new Int32Array(NP), PCOL = new Float32Array(NP * 3), PID = new Uint8Array(NP), PBL = new Uint8Array(NP);
  const FOCC = new Int32Array(NP);              // the flake's pixels this frame: it hides the shoot pushing under it
  let FR = 0, BX = 0, BY = 0, PB0 = W, PB1 = -1, PB2 = H, PB3 = -1, SB0 = W, SB1 = -1, SB2 = H, SB3 = -1;
  function splat(X, Y, Z, id, below) {
    const x = fl(BX + X), y = fl(BY - Y + 0.3 * Z);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (PST[i] === FR && PZ[i] >= Z) return;
    PST[i] = FR; PZ[i] = Z; PID[i] = id; PBL[i] = below ? 1 : 0;
    const j = i * 3; PCOL[j] = PS[0]; PCOL[j + 1] = PS[1]; PCOL[j + 2] = PS[2];
    if (x < PB0) PB0 = x; if (x > PB1) PB1 = x; if (y < PB2) PB2 = y; if (y > PB3) PB3 = y;
  }
  const PS = [0, 0, 0];
  // shade a plant sample: albedo, normal (world), translucency and the colour light takes on passing through,
  // gloss, and how much of the sun reaches it (in the crack, very little)
  let VHX = 0, VHY = 0, VHZ = 0;
  function pshade(ar, ag, ab, nx, ny, nz, tr, tcr, tcg, tcb, gloss, sunMul) {
    if (nz + 0.3 * ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const ndl = nx * LS.lx + ny * LS.ly + nz * LS.lz, sun = LS.sun * sunMul;
    const dif = ndl > 0 ? ndl : 0, tra = ndl < 0 ? -ndl * tr * sun : 0;
    const amb = 0.42 + 0.36 * (ny > 0 ? ny : 0) + 0.22 * (nz > 0 ? nz : 0);
    let r = ar * (LS.sr * sun * dif * 1.35 + LS.ar * amb * 1.1) + tcr * LS.sr * tra;
    let g = ag * (LS.sg * sun * dif * 1.35 + LS.ag * amb * 1.1) + tcg * LS.sg * tra;
    let b = ab * (LS.sb * sun * dif * 1.35 + LS.ab * amb * 1.1) + tcb * LS.sb * tra;
    if (gloss > 0) {
      const d = nx * VHX + ny * VHY + nz * VHZ;
      if (d > 0.82) { const s = Math.pow((d - 0.82) / 0.18, 4) * gloss * sun; r += s * LS.sr; g += s * LS.sg; b += s * LS.sb; }
    }
    PS[0] = r * 255; PS[1] = g * 255; PS[2] = b * 255;
  }
  // the plant's shadow, thrown along the sun onto the rock (as a ground plane at the crack's height)
  let GX = 0, GY = 0, GK = 0;
  function gproj(X, Y, Z) { const k = Math.max(0, Y) / Math.max(0.06, LS.ly); GK = k; GX = BX + X - LS.lx * k; GY = BY + 0.3 * (Z - LS.lz * k); }
  function shMark(x, y, w) {
    x = fl(x); y = fl(y);
    if (x < 0 || y < RIMTOP || x >= W || y >= H) return;
    const i = y * W + x; if (w > PSH[i]) PSH[i] = w;
    if (x < SB0) SB0 = x; if (x > SB1) SB1 = x; if (y < SB2) SB2 = y; if (y > SB3) SB3 = y;
  }
  const shW = (Y) => 0.9 * (1 - 0.5 * sstep(15, 170, Y)) * Math.exp(-GK / 700);
  function shDot(X, Y, Z) {
    if (Y < 0.5) return;
    gproj(X, Y, Z); const w = shW(Y);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) shMark(GX + i, GY + j, w);
  }
  function shSeg(X0, Y0, Z0, X1, Y1, Z1, rad) {
    if (Y0 < 0.5 && Y1 < 0.5) return;
    gproj(X0, Y0, Z0); const ax = GX, ay = GY, w = shW((Y0 + Y1) / 2);
    gproj(X1, Y1, Z1); const bx = GX, by = GY;
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 0.7) + 1;
    if (n > 900) return;
    for (let k = 0; k <= n; k++) {
      const x = lerp(ax, bx, k / n), y = lerp(ay, by, k / n);
      for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) shMark(x + i, y + j * 0.6, w);
    }
  }

  /* ---------------------------------------------------------------- growth */
  function stemLen(tau) {
    return 19 * s5(ph(tau, 3.4, 5.6)) + 2.5 * sstep(5.6, T_BREAK, tau) + 18 * back(ph(tau, T_BREAK, 8.0), 1.4)
      + 145 * Math.pow(s5(ph(tau, 8.0, 13.2)), 1.2) + 22 * s5(ph(tau, 13.2, 14.6));
  }
  const dryAt = (tau) => s5(ph(tau, 19.6, 22.6));
  const T_REL = 21.05;                          // the pod lets its seed go
  const SN = 420, STX = new Float32Array(SN), STY = new Float32Array(SN), STA = new Float32Array(SN);
  let STN = 0;
  // the stem's centre line by integrating curvature along it: a gentle S, the wind, the seedling's hook, the
  // nodding bud, and the dry stalk tipping over
  function stemCurve(tau, t) {
    const L = stemLen(tau);
    if (L < 0.3) { STN = 0; return 0; }
    const hook = Math.PI * (1 + 0.16 * sstep(5.6, 6.8, tau) * (1 - sstep(T_BREAK, 7.5, tau))) * (1 - s5(ph(tau, 7.6, 9.4)));
    const Lh = Math.min(L, 15);
    const nod = budNod(FLOWERS[0], tau), Ln = 34;
    const dry = 1.15 * s5(ph(tau, 20.2, 21.0)) - 0.75 * s5(ph(tau, 21.3, 23.0)), Ld = 62;
    const wf = sstep(16, 80, L) * windAt(t);
    const trem = (tau > 5.7 && tau < 6.85) ? 0.05 * sstep(5.7, 6.4, tau) * (1 - sstep(6.6, 6.85, tau)) * Math.sin(t * 57) : 0;
    let a = Math.PI / 2 + 0.07 - 0.1 * sstep(20.4, 21.4, tau) + 0.12 * sstep(21.3, 23.0, tau) + trem, x = 0, y = 0, n = 0;
    for (let s = 0; s <= L + 1e-6 && n < SN; s += 0.5) {
      STX[n] = x; STY[n] = y; STA[n] = a; n++;
      let k = 0.0032 * Math.sin(TAU * s / 170 + 0.5) * sstep(30, 120, L);
      k -= 0.0038 * wf * (1 - s / (L + 1)) * (1 - s / (L + 1));
      if (s > L - Lh) k -= hook / Lh;
      if (nod > 0 && s > L - Ln) k -= nod / Ln;
      if (dry > 0 && s > L - Ld) k -= dry / Ld;
      a += k * 0.5;
      x += Math.cos(a) * 0.5; y += Math.sin(a) * 0.5;
    }
    STN = n; return L;
  }
  const mixC = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
  const GREEN = [0.2, 0.5, 0.12], PALEG = [0.66, 0.74, 0.36], DRY = [0.56, 0.47, 0.29], DRYL = [0.6, 0.5, 0.3];
  // a stem or branch as a shaded tube along its centre line, with fine hairs
  function drawTube(XA, YA, AA, N, L, rB, tau, dry, id, hs) {
    const main = id === 1, young = main ? 1 - s5(ph(tau, 7.4, 10.8)) : 0;
    const hairy = sstep(9.5, 12, tau);
    let px = XA[0], py = YA[0];
    for (let n = 0; n < N; n++) {
      const s = n * 0.5, cx = XA[n], cy = YA[n], a = AA[n];
      const tip = L - s < 1.6 ? 0.55 + 0.45 * (L - s) / 1.6 : 1;
      const r = rB * (1 - 0.28 * s / (L + 1)) * tip;
      const nx = -Math.sin(a), ny = Math.cos(a);
      const yg = main ? Math.max(young, 0.35 * sstep(10, 0, s)) : 0, dd = sstep(0, 1, dry * 1.15 - 0.15 * s / (L + 1));
      const c0 = lerp(lerp(GREEN[0], PALEG[0], yg), DRY[0], dd), c1 = lerp(lerp(GREEN[1], PALEG[1], yg), DRY[1], dd), c2 = lerp(lerp(GREEN[2], PALEG[2], yg), DRY[2], dd);
      const below = cy < 0.2, sm = cy < 2.5 ? 0.25 : 1;
      for (let w = -r; w <= r + 1e-6; w += 0.42) {
        const q = w / Math.max(0.5, r), nz = Math.sqrt(Math.max(0, 1 - q * q));
        pshade(c0, c1, c2, nx * q, ny * q, nz, 0.45, c0 * 1.4 + 0.1, c1 * 1.5 + 0.2, c2 * 0.6, 0.12, sm);
        splat(cx + nx * w, cy + ny * w, nz * r, id, below);
      }
      if (n % 3 === 0) { if (n) shSeg(px, py, 0, cx, cy, 0, rB > 1.6 ? 1 : 0); px = cx; py = cy; }
      // fine hairs standing off the stem, lit up when the sun is behind
      if (hairy > 0 && s > 6 && s < L - 4 && ih(n, 3, 501 + hs * 7) < 0.08 * hairy) {
        const side = ih(n, 4, 501 + hs * 7) < 0.5 ? -1 : 1, hl = 2 + 2.2 * ih(n, 5, 501 + hs * 7), up = 0.5;
        const hx = nx * side * 0.85 + Math.cos(a) * up, hy = ny * side * 0.85 + Math.sin(a) * up;
        const hc = mixC([0.5, 0.66, 0.32], DRY, dry);
        for (let q = 0.5; q <= hl; q += 0.5) {
          pshade(hc[0], hc[1], hc[2], hx, hy, 0.3, 0.9, 0.8, 0.95, 0.45, 0, 1);
          splat(cx + nx * side * r + hx * q, cy + ny * side * r + hy * q, 0.2, 13, false);
        }
      }
    }
  }
  /* ---------------------------------------------------------------- the seed */
  const SEEDC = [0.6, 0.3, 0.1];
  function drawSeed(X, Y, rot, swell, split, shell, id, sunMul) {
    const rx = 6.4 * (1 + 0.2 * swell) * (1 - 0.12 * shell), ry = 4.1 * (1 + 0.24 * swell) * (1 - 0.25 * shell), rz = 3.6;
    const cr = Math.cos(rot), sr = Math.sin(rot), R = rx + 1;
    const base = mixC(mixC(SEEDC, [0.78, 0.46, 0.16], swell * 0.7), [0.32, 0.17, 0.08], shell);
    for (let v = -R; v <= R; v += 0.45) for (let u = -R; u <= R; u += 0.45) {
      const lu = (u * cr + v * sr) / rx, lv = (-u * sr + v * cr) / ry, d = lu * lu + lv * lv;
      if (d > 1) continue;
      const nz = Math.sqrt(1 - d);
      // a kidney seed: a shallow notch on one side, a fine net of ridges over the coat
      if (lv > 0.55 && Math.abs(lu) < 0.25) continue;
      let c = base, m = 0.88 + 0.24 * ih(fl(lu * 5 + 9), fl(lv * 4 + 9), 510 + id);
      if (split > 0 && Math.abs(lv + 0.1) < split * 0.32 && Math.abs(lu) < 0.85) c = mixC([0.88, 0.82, 0.62], [0.55, 0.62, 0.3], shell), m = 1;
      pshade(c[0] * m, c[1] * m, c[2] * m, lu * 0.8 * cr - lv * 0.8 * sr, -(lu * 0.8 * sr + lv * 0.8 * cr), nz, 0.05, 0, 0, 0, 0.9, sunMul);
      splat(X + u, Y - v, nz * rz + 0.5, id, false);
      if (Y > 2.4 && ih(fl(u * 3), fl(v * 3), 515) < 0.3) shDot(X + u, Y - v, 0);
    }
    // the glint of first light on its coat: a small bright highlight toward the sun
    if (shell < 0.5) {
      const g = (1 - 2 * shell) * LS.sun, hx = X - rx * 0.3 + 2 * Math.max(-1, Math.min(1, LS.lx)), hy = Y + ry * 0.45;
      PS[0] = (110 + 120 * LS.sr * g); PS[1] = (90 + 110 * LS.sg * g); PS[2] = (70 + 90 * LS.sb * g);
      splat(hx, hy, rz + 1, id, false); splat(hx + 1, hy, rz + 1, id, false);
      PS[0] *= 0.8; PS[1] *= 0.8; PS[2] *= 0.8; splat(hx - 1, hy + 0.2, rz + 1, id, false);
    }
  }
  function drawRoot(tau) {
    const g = s5(ph(tau, 3.0, 5.2));
    if (g <= 0) return;
    const len = 3 + 14 * g;
    let x = -2, y = 0, a = -Math.PI / 2 - 0.5;
    for (let s = 0; s < len; s += 0.4) {
      a += 0.05 * Math.sin(s * 0.6);
      x += Math.cos(a) * 0.4; y += Math.sin(a) * 0.4;
      pshade(0.93, 0.89, 0.74, 0, 0.2, 1, 0.2, 0.9, 0.85, 0.6, 0, 0.3);
      splat(x, y, 0.2, 12, true);
      if (s < len - 2) { splat(x + 0.45, y, 0.1, 12, true); splat(x - 0.45, y, 0.1, 12, true); }
    }
  }
  /* ---------------------------------------------------------------- leaves */
  const LEAVES = [
    { s: 46, psi: Math.PI - 0.35, len: 60, wid: 13, t0: 0 }, { s: 74, psi: -0.4, len: 54, wid: 12, t0: 0 },
    { s: 104, psi: Math.PI + 0.5, len: 44, wid: 10, t0: 0 }, { s: 136, psi: 0.45, len: 33, wid: 7.5, t0: 0 },
  ];
  function buildLeafTimes() {
    for (const Lf of LEAVES) { let a = 7, b = 15; for (let k = 0; k < 40; k++) { const m = (a + b) / 2; if (stemLen(m) < Lf.s + 3) a = m; else b = m; } Lf.t0 = (a + b) / 2; }
  }
  const MRX = new Float32Array(41), MRY = new Float32Array(33), MRZ = new Float32Array(33);
  const LEAFC = [0.19, 0.47, 0.1], VEINC = [0.42, 0.66, 0.2];
  // one leaf: a midrib arching out from its node, the blade folded along it (V) and opening flat; lobed margins;
  // veins that glow brighter than the blade when the sun is behind
  function leafBlade(bx, by, bz, psi, e0, droop, len, wid, fold, lobes, dry, id, trans) {
    const dx = Math.cos(psi), dz = Math.sin(psi), M = 40;
    let x = bx, y = by, z = bz;
    for (let m = 0; m <= M; m++) {
      MRX[m] = x; MRY[m] = y; MRZ[m] = z;
      const e = e0 - droop * (m / M), ce = Math.cos(e);
      x += ce * dx * len / M; y += Math.sin(e) * len / M; z += ce * dz * len / M;
    }
    const SXv = -dz, SZv = dx;                                // the blade's side direction (horizontal)
    const cf = Math.cos(fold), sf = Math.sin(fold);
    const ns = Math.max(4, Math.ceil(len * 1.75));
    const lc = mixC(LEAFC, DRYL, dry), vc = mixC(VEINC, [0.66, 0.56, 0.34], dry);
    for (let q = 0; q <= ns; q++) {
      const s = q / ns, mf = s * M, m0 = Math.min(M - 1, fl(mf)), f = mf - m0;
      const cx = lerp(MRX[m0], MRX[m0 + 1], f), cy = lerp(MRY[m0], MRY[m0 + 1], f), cz = lerp(MRZ[m0], MRZ[m0 + 1], f);
      let tx = MRX[m0 + 1] - MRX[m0], ty = MRY[m0 + 1] - MRY[m0], tz = MRZ[m0 + 1] - MRZ[m0];
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      // N0 = side × tangent (points up off the blade)
      let nx = 0 * tz - SZv * ty, ny = SZv * tx - SXv * tz, nz = SXv * ty - 0 * tx;
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      let hw = wid * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.72)), 0.85);
      if (lobes) hw *= 1 - 0.34 * Math.pow(1 - Math.abs(Math.sin(Math.PI * s * 4.5 + 0.4)), 2.2) * sstep(0.1, 0.3, s);
      hw *= 1 + 0.06 * Math.sin(s * 70);
      const nv = Math.max(1, Math.ceil(hw * 1.75));
      for (let j = -nv; j <= nv; j++) {
        const v = j / nv, av = Math.abs(v), sg = v < 0 ? -1 : 1;
        const ox = cf * sg * SXv + sf * nx, oy = sf * ny, oz = cf * sg * SZv + sf * nz;
        const hnx = cf * nx - sf * sg * SXv, hny = cf * ny, hnz = cf * nz - sf * sg * SZv;
        const px = cx + ox * hw * av, py = cy + oy * hw * av, pz = cz + oz * hw * av;
        const vein = av < 0.13 || (av < 0.86 && fr(s * 6.5 - av * 0.6) < 0.1);
        const c = vein ? vc : lc, m = 0.92 + 0.12 * ih(q, j, 520 + id) - (av > 0.9 ? 0.06 : 0);
        const tg = vein ? 1.25 : 0.95;
        pshade(c[0] * m, c[1] * m, c[2] * m, hnx, hny, hnz, trans, 0.5 * tg, 0.95 * tg, 0.18 * tg, 0.2, 1);
        splat(px, py, pz, id, false);
        if ((q + j) % 3 === 0) shDot(px, py, pz);
      }
    }
  }
  // leaves on the side branches (unfold as the branch passes their node)
  const BLEAVES = [{ b: 0, f: 0.42, psi: -0.25, len: 30, wid: 7, t0: 0 }, { b: 1, f: 0.48, psi: Math.PI + 0.3, len: 27, wid: 6.4, t0: 0 }, { b: 2, f: 0.5, psi: 0.7, len: 18, wid: 4.4, t0: 0 }];
  function buildBranchLeafTimes() {
    for (const Lf of BLEAVES) { const B = BRANCHES[Lf.b]; let a = B.t0, b = B.t1; for (let k = 0; k < 40; k++) { const m = (a + b) / 2; if (branchLen(B, m) < Lf.f * B.len + 3) a = m; else b = m; } Lf.t0 = (a + b) / 2; }
  }
  function leafAt(XA, YA, AA, ni, Lf, k, tau, t, dry, ws, id) {
    const a = ph(tau, Lf.t0, Lf.t0 + 2.1);
    const g = (0.1 + 0.9 * back(a, 0.7)) * (1 - 0.1 * dry);
    const ld = sstep(0, 1, dry * 1.3 - k * 0.1);
    const fold = lerp(1.42, 0.2, s5(ph(tau, Lf.t0 + 0.2, Lf.t0 + 1.9))) + 0.75 * ld;
    const e0 = lerp(1.3, 0.48, s5(a)) + 0.07 * Math.sin(per(19 + 2 * k, t) + k) * ws - 0.55 * ld + 0.25 * (AA[ni] - Math.PI / 2) * Math.cos(Lf.psi);
    const droop = lerp(0.3, 0.95, s5(a)) + 0.8 * ld;
    const psi = Lf.psi + 0.09 * Math.sin(per(11 + k, t) + 2 * k) * ws;
    leafBlade(XA[ni], YA[ni], 0, psi, e0, droop, Lf.len * g, Lf.wid * g, fold, true, ld, id, 0.95);
  }
  function drawLeaves(tau, t, dry) {
    const ws = 0.6 + 0.4 * Math.abs(windAt(t));
    for (let k = 0; k < LEAVES.length; k++) {
      const Lf = LEAVES[k];
      if (tau < Lf.t0) continue;
      leafAt(STX, STY, STA, Math.min(STN - 1, Math.round(Lf.s / 0.5)), Lf, k, tau, t, dry, ws, 3 + k);
    }
    for (let k = 0; k < BLEAVES.length; k++) {
      const Lf = BLEAVES[k], B = BRANCHES[Lf.b];
      if (tau < Lf.t0 || B.n < 2) continue;
      leafAt(B.X, B.Y, B.A, Math.min(B.n - 1, Math.round(Lf.f * B.len / 0.5)), Lf, k + 4, tau, t, dry, ws, 14 + k);
    }
  }
  function drawCotyledons(tau, t, dry) {
    if (tau < 3.6) return;
    const L = stemLen(tau), Lc = Math.min(L, stemLen(9.6)), ni = Math.min(STN - 1, Math.round(Lc / 0.5));
    const o = back(ph(tau, 9.0, 10.3), 1.3), grow = 0.35 + 0.65 * s5(ph(tau, 8.6, 11.0));
    const cd = sstep(0, 1, dry * 1.4 + 0.25 * sstep(17, 20, tau));
    // closed, they point back down along the hooked tip; open, they spread level, left and right
    const ta = STA[ni];
    for (const side of [-1, 1]) {
      const psi = side < 0 ? Math.PI - 0.22 : 0.22;
      // closed: along the stem's own direction at the tip (mirrored for the left one); open: level, a little up
      const e0 = lerp(side < 0 ? Math.PI - ta : ta, 0.38, o) - 0.4 * cd;
      leafBlade(STX[ni], STY[ni], side * 0.4, psi, e0, 0.3 + 0.4 * cd, 15 * grow, 3.8 * grow, 0.25 + 0.4 * cd, false, cd, 2, 0.8);
    }
  }

  /* ---------------------------------------------------------------- branches and flowers */
  // The hero flower crowns the main stem; three side shoots leave it, curve back up toward the light and carry a
  // smaller flower each (the last stays a bud, droops and dries). Blooms are staggered through the golden hour:
  // the first side flower just before the hero, the hero as the words come, the second side flower just after.
  const FLOWERS = [
    { b: -1, sc: 1.0, to: 15.0, td: [19.25, 19.7, 20.05, 20.4] },
    { b: 0, sc: 0.72, to: 13.9, td: [18.35, 18.7, 19.0, 19.35] },
    { b: 1, sc: 0.66, to: 16.6, td: [19.7, 20.0, 20.3, 20.65] },
    { b: 2, sc: 0.56, to: 99, td: null, tb: 13.4 },
  ];
  for (const f of FLOWERS) if (f.tb === undefined) f.tb = f.to - 2.6;
  const budNod = (f, tau) => 2.5 * sstep(f.tb - 0.1, f.tb + 0.7, tau) * (1 - s5(ph(tau, f.to - 0.9, f.to + 0.1)));
  const BRANCHES = [
    { s: 60, out: 1, a: 0.66, len: 92, t0: 10.2, t1: 13.0, up: 0.55 },
    { s: 86, out: -1, a: 0.62, len: 78, t0: 10.9, t1: 14.0, up: 0.5 },
    { s: 118, out: 1, a: 0.5, len: 46, t0: 11.8, t1: 14.6, up: 0.3 },
  ];
  const BN = 220;
  for (const B of BRANCHES) { B.X = new Float32Array(BN); B.Y = new Float32Array(BN); B.A = new Float32Array(BN); B.n = 0; B.L = 0; }
  const branchLen = (B, tau) => B.len * Math.pow(s5(ph(tau, B.t0, B.t1)), 1.1);
  function branchCurve(bi, tau, t) {
    const B = BRANCHES[bi], L = branchLen(B, tau), f = FLOWERS[bi + 1];
    B.L = L; B.n = 0;
    const ni = Math.round(B.s / 0.5);
    if (L < 0.3 || ni >= STN) return 0;
    const nod = budNod(f, tau), Ln = Math.min(L, 22 * f.sc + 4);
    const dry = 0.9 * s5(ph(tau, 20.0, 21.6));
    const wf = windAt(t) * sstep(10, 50, L);
    let a = STA[ni] - B.out * B.a, x = STX[ni], y = STY[ni], n = 0;
    for (let s = 0; s <= L + 1e-6 && n < BN; s += 0.5) {
      B.X[n] = x; B.Y[n] = y; B.A[n] = a; n++;
      let k = B.out * B.up / B.len;
      k -= 0.006 * wf * (1 - s / (L + 1));
      if (nod > 0 && s > L - Ln) k -= B.out * nod / Ln;
      if (dry > 0) k -= B.out * dry / L;
      a += k * 0.5; x += Math.cos(a) * 0.5; y += Math.sin(a) * 0.5;
    }
    B.n = n; return L;
  }
  // the flower frame at the tip of a stem: centre, axis (tilted a little toward us), and two axes across it
  const FF = { cx: 0, cy: 0, cz: 0, ax: 0, ay: 1, az: 0, e1x: 1, e1y: 0, e1z: 0, e2x: 0, e2y: 0, e2z: 1 };
  function frameAt(F, XA, YA, AA, n, lift) {
    const a = AA[n];
    let ax = Math.cos(a), ay = Math.sin(a), az = lift;
    const al = Math.hypot(ax, ay, az); ax /= al; ay /= al; az /= al;
    F.ax = ax; F.ay = ay; F.az = az;
    F.cx = XA[n] + ax * 0.6; F.cy = YA[n] + ay * 0.6; F.cz = az * 0.6;
    let e1x = ay, e1y = -ax, e1z = 0; const el = Math.hypot(e1x, e1y) || 1; e1x /= el; e1y /= el;
    F.e1x = e1x; F.e1y = e1y; F.e1z = e1z;
    F.e2x = e1y * az - e1z * ay; F.e2y = e1z * ax - e1x * az; F.e2z = e1x * ay - e1y * ax;
    return F;
  }
  function flowerFrame(F, fi) {
    const f = FLOWERS[fi];
    if (f.b < 0) return STN > 0 ? frameAt(F, STX, STY, STA, STN - 1, 0.45) : null;
    const B = BRANCHES[f.b];
    return B.n > 0 ? frameAt(F, B.X, B.Y, B.A, B.n - 1, 0.45) : null;
  }
  const PET = [{ th: Math.PI * 0.25, big: 1.06, inner: 0 }, { th: Math.PI * 0.75, big: 0.96, inner: 1 }, { th: Math.PI * 1.25, big: 1.03, inner: 0 }, { th: Math.PI * 1.75, big: 0.95, inner: 1 }];
  const TD = FLOWERS[0].td;
  let PSC = 1;                                  // the size of the flower being drawn
  let PPX = 0, PPY = 0, PPZ = 0, PNX = 0, PNY = 0, PNZ = 0;
  function petalPt(F, k, r, a, op, loose) {
    const pk = PET[k], R = lerp(13, 28, s5(op)) * pk.big * PSC;
    const hwt = lerp(0.42, 1.0, op) * (0.3 + 0.7 * Math.sin(Math.PI / 2 * Math.min(1, r / 0.7)));
    const th = pk.th + a * hwt;
    const beta = lerp(0.33 + 0.15 * r, 0.2 + 0.8 * Math.pow(r, 1.15), op) - pk.inner * 0.1 * op + loose * r;
    const cb = Math.cos(beta), sb = Math.sin(beta), ct = Math.cos(th), st = Math.sin(th);
    const rx = ct * F.e1x + st * F.e2x, ry = ct * F.e1y + st * F.e2y, rz = ct * F.e1z + st * F.e2z;
    const ox = cb * rx - sb * F.ax, oy = cb * ry - sb * F.ay, oz = cb * rz - sb * F.az;
    // the crumple field, tabulated per petal at build (bilinear)
    const fr0 = clamp(r, 0, 1) * CRN, fa0 = (clamp(a, -1, 1) + 1) * 0.5 * CRN, ri = Math.min(CRN - 1, fl(fr0)), ai = Math.min(CRN - 1, fl(fa0)), fr1 = fr0 - ri, fa1 = fa0 - ai;
    const o0 = (k * (CRN + 1) + ri) * (CRN + 1) + ai, o1 = o0 + CRN + 1;
    const cr = lerp(1.9, 0.55, s5(op)) * PSC * CRA[ri] * lerp(lerp(CRT[o0], CRT[o0 + 1], fa1), lerp(CRT[o1], CRT[o1 + 1], fa1), fr1);
    const d = R * r;
    PPX = F.cx + d * (cb * F.ax + sb * rx) + cr * ox; PPY = F.cy + d * (cb * F.ay + sb * ry) + cr * oy; PPZ = F.cz + d * (cb * F.az + sb * rz) + cr * oz;
    PNX = ox; PNY = oy; PNZ = oz;
  }
  const CRN = 48, CRT = new Float32Array(4 * (CRN + 1) * (CRN + 1)), CRA = new Float32Array(CRN + 1);
  function buildCrumple() {
    for (let ri = 0; ri <= CRN; ri++) CRA[ri] = Math.pow(ri / CRN, 0.7);
    for (let k = 0; k < 4; k++) for (let ri = 0; ri <= CRN; ri++) for (let ai = 0; ai <= CRN; ai++) {
      const r = ri / CRN, a = ai / CRN * 2 - 1, hwt = 0.3 + 0.7 * Math.sin(Math.PI / 2 * Math.min(1, r / 0.7));
      CRT[(k * (CRN + 1) + ri) * (CRN + 1) + ai] = (vn2(r * 5 + k * 9, a * 3.5 + 2, 120) - 0.5) * 1.4
        + 0.28 * Math.sin(a * hwt * 17 + 5 * vn2(r * 2.5, a * 2 + k * 5, 121) + k) * sstep(0.12, 0.4, r) + 0.5 * (vn2(r * 11 + k * 4, a * 9, 124) - 0.5);
    }
  }
  const PETC = [0.86, 0.085, 0.05], PETO = [0.76, 0.1, 0.06], BLOT = [0.06, 0.02, 0.03];
  // petal surfaces are evaluated once per point on a grid (r along the petal, a across it); normals come from the
  // neighbouring grid points. A fully open petal's shape in its own flower frame never changes, so it is baked once
  // (open, and loosened for the fall) and each frame only moves it with the flower.
  const PGX = new Float32Array(80 * 160), PGY = new Float32Array(80 * 160), PGZ = new Float32Array(80 * 160), PGO = new Int8Array(80 * 160);
  const CF = { cx: 0, cy: 0, cz: 0, ax: 0, ay: 0, az: 1, e1x: 1, e1y: 0, e1z: 0, e2x: 0, e2y: 1, e2z: 0 };   // canonical frame
  const PCACHE = [];
  function petalDims(k, op) {
    const R = lerp(13, 28, s5(op)) * PET[k].big * PSC;
    return [Math.min(78, Math.ceil(R * 1.8)), Math.min(158, Math.ceil(2 * lerp(0.42, 1.0, op) * R * Math.sin(Math.min(1.4, 0.2 + 0.8 * op + 0.35)) * 1.9) + 2)];
  }
  function petalGrid(F, k, op, loose, put) {
    const [nr, na] = petalDims(k, op), nA = na + 1;
    for (let qi = 0; qi <= nr; qi++) {
      const r = Math.max(0.02, qi / nr), rmEdge = r > 0.8 ? Math.sqrt(Math.max(0, 1 - Math.pow((r - 0.8) / 0.2, 2))) : 1;
      for (let qa = 0; qa <= na; qa++) {
        const a = (qa / na * 2 - 1) * Math.max(0.02, rmEdge), g = qi * nA + qa;
        petalPt(F, k, r, a, op, loose);
        put(g, PPX, PPY, PPZ, Math.abs(a) > (1 - 0.07 * Math.abs(Math.sin(r * 9 + k))) * rmEdge ? 0 : 1);
      }
    }
    return [nr, na];
  }
  function buildPetalCache() {
    for (let fi = 0; fi < FLOWERS.length; fi++) {
      PCACHE.push([]);
      PSC = FLOWERS[fi].sc;
      for (let k = 0; k < 4; k++) {
        const v = [];
        for (const loose of [0, 0.22]) {
          const [nr, na] = petalDims(k, 1), n = (nr + 1) * (na + 1);
          const U = new Float32Array(n), V = new Float32Array(n), Wc = new Float32Array(n), O = new Int8Array(n);
          petalGrid(CF, k, 1, loose, (g, x, y, z, o) => { U[g] = x; V[g] = y; Wc[g] = z; O[g] = o; });
          petalPt(CF, k, 0.5, 0, 1, loose);
          v.push({ nr, na, U, V, W: Wc, O, on: [PNX, PNY, PNZ] });
        }
        PCACHE[fi].push(v);
      }
    }
    PSC = 1;
  }
  function drawPetal(F, k, op, loose, xf, id, dark, cache) {
    let nr, na, ox, oy, oz;
    if (cache) {
      nr = cache.nr; na = cache.na;
      const U = cache.U, V = cache.V, Wc = cache.W, n = (nr + 1) * (na + 1);
      for (let g = 0; g < n; g++) {
        const u = U[g], v = V[g], w = Wc[g];
        let x = F.cx + u * F.e1x + v * F.e2x + w * F.ax, y = F.cy + u * F.e1y + v * F.e2y + w * F.ay, z = F.cz + u * F.e1z + v * F.e2z + w * F.az;
        if (xf) { xf(x, y, z); x = XFX; y = XFY; z = XFZ; }
        PGX[g] = x; PGY[g] = y; PGZ[g] = z; PGO[g] = cache.O[g];
      }
      const o = cache.on; ox = o[0] * F.e1x + o[1] * F.e2x + o[2] * F.ax; oy = o[0] * F.e1y + o[1] * F.e2y + o[2] * F.ay; oz = o[0] * F.e1z + o[1] * F.e2z + o[2] * F.az;
    } else {
      [nr, na] = petalGrid(F, k, op, loose, (g, x, y, z, o) => { PGX[g] = x; PGY[g] = y; PGZ[g] = z; PGO[g] = o; });
      petalPt(F, k, 0.5, 0, op, loose); ox = PNX; oy = PNY; oz = PNZ;
    }
    if (xf) { ox = XFNX; oy = XFNY; oz = XFNZ; }
    const nA = na + 1;
    for (let qi = 0; qi < nr; qi++) {
      const r = Math.max(0.02, qi / nr), st = Math.max(1, Math.min(8, fl(0.85 / Math.max(r, 0.1))));   // the grid is denser than needed near the base
      for (let qa = (qi * 7) % st; qa < na; qa += st) {
        const g = qi * nA + qa; if (!PGO[g]) continue;
        const x = PGX[g], y = PGY[g], z = PGZ[g];
        const ux = PGX[g + nA] - x, uy = PGY[g + nA] - y, uz = PGZ[g + nA] - z, vx = PGX[g + 1] - x, vy = PGY[g + 1] - y, vz = PGZ[g + 1] - z;
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        const facing = nz + 0.3 * ny > 0 ? 1 : -1, inner = (nx * ox + ny * oy + nz * oz) * facing < 0;
        let c = inner ? PETC : PETO, tr = 1.15, tc0 = 1.0, tc1 = 0.3, tc2 = 0.08;
        if (inner && r < 0.19 + 0.06 * BLV[(qa * 16 / na) | 0 & 15]) { c = BLOT; tr = 0.15; tc0 = 0.3; tc1 = 0.05; tc2 = 0.04; }
        const m = (0.93 + 0.1 * ih(qi >> 1, qa >> 1, 123 + k)) * dark;
        pshade(c[0] * m, c[1] * m, c[2] * m, nx, ny, nz, tr, tc0, tc1, tc2, 0.32, 1);
        splat(x, y, z, id, false);
        if ((qi + qa) % 4 === 0) shDot(x, y, z);
      }
    }
  }
  const BLV = new Float32Array(17);             // the black blotch's ragged edge
  for (let i = 0; i < 17; i++) BLV[i] = ih(i, 7, 122);
  // the falling petals: a rigid tumble about the petal's middle while it drifts down; flattened once it lands
  const PFALL = [];                             // per flower, per petal: frame at release, centroid, axis, landing
  let XFX = 0, XFY = 0, XFZ = 0, XFNX = 0, XFNY = 0, XFNZ = 0, XFOX = 0, XFOY = 0;
  function petalFallXf(pf, dt) {
    const dl = pf.dl, dd = Math.min(dt, dl), al = (1.7 * Math.sin(2.6 * dd + pf.k) - 1.7 * Math.sin(pf.k) + 0.9 * dd * pf.sg);
    const ca = Math.cos(al), sa = Math.sin(al), K = pf.K;
    const ox = pf.cx + 3 * dd + 5 * pf.sg * (1 - Math.cos(1.9 * dd)), oy = pf.cy - Math.min(pf.cy - 1, 50 * dd - 2.5 * Math.sin(5 * dd + pf.k) + 2.5 * Math.sin(pf.k));
    const oz = pf.cz + pf.zl * sstep(0, dl, dd) + 2 * Math.sin(1.3 * dd + pf.k);
    const sq = sstep(dl, dl + 0.25, dt);
    const k0 = K[0], k1 = K[1], k2 = K[2], c1 = 1 - ca;
    let RX = 0, RY = 0, RZ = 0;
    const rot = (x, y, z) => {
      const kd = k0 * x + k1 * y + k2 * z;
      RX = x * ca + (k1 * z - k2 * y) * sa + k0 * kd * c1; RY = y * ca + (k2 * x - k0 * z) * sa + k1 * kd * c1; RZ = z * ca + (k0 * y - k1 * x) * sa + k2 * kd * c1;
    };
    rot(pf.nx, pf.ny, pf.nz); XFNX = RX; XFNY = RY; XFNZ = RZ;
    XFOX = ox; XFOY = oy;
    const ys = 1 - 0.88 * sq, shr = 1 - 0.55 * sstep(dl + 0.3, dl + 3.6, dt);   // once down, it shrivels
    return (x, y, z) => {
      rot(x - pf.cx, y - pf.cy, z - pf.cz);
      XFX = ox + RX * shr; XFY = oy + RY * ys * shr; XFZ = oz + RZ * shr;
      if (XFY < 0.6) XFY = 0.6 + (XFY - 0.6) * 0.15;
    };
  }
  function geomAt(tau, t) { stemCurve(tau, t); for (let b = 0; b < BRANCHES.length; b++) branchCurve(b, tau, t); }
  function buildPetalFall() {
    for (let fi = 0; fi < FLOWERS.length; fi++) {
      const f = FLOWERS[fi], list = [];
      PFALL.push(list);
      if (!f.td) continue;
      for (let k = 0; k < 4; k++) {
        const td = f.td[k];
        geomAt(td, td);
        const F = flowerFrame({}, fi);
        const R = 28 * PET[k].big * f.sc, b = 0.2 + 0.8 * Math.pow(0.55, 1.15) - PET[k].inner * 0.1 + 0.22 * 0.55, ct = Math.cos(PET[k].th), st = Math.sin(PET[k].th);
        const rx = ct * F.e1x + st * F.e2x, ry = ct * F.e1y + st * F.e2y, rz = ct * F.e1z + st * F.e2z;
        const cx = F.cx + R * 0.55 * (Math.cos(b) * F.ax + Math.sin(b) * rx), cy = F.cy + R * 0.55 * (Math.cos(b) * F.ay + Math.sin(b) * ry), cz = F.cz + R * 0.55 * (Math.cos(b) * F.az + Math.sin(b) * rz);
        const kk = k + fi * 4, sg = kk % 2 ? -1 : 1, Kx = Math.cos(kk * 1.7 + 0.3), Kz = Math.sin(kk * 1.7 + 0.3), Kl = Math.hypot(Kx, 0.35, Kz);
        const pf = { F, k: kk, cx, cy, cz, sg, K: [Kx / Kl, 0.35 / Kl, Kz / Kl], nx: Math.cos(b) * rx - Math.sin(b) * F.ax, ny: Math.cos(b) * ry - Math.sin(b) * F.ay, nz: Math.cos(b) * rz - Math.sin(b) * F.az, zl: [7, -4, 10, 3][k] + (fi === 2 ? -3 : fi === 1 ? 4 : 0), dl: 0 };
        let dt = 0; while (dt < 8 && cy - (50 * dt - 2.5 * Math.sin(5 * dt + kk) + 2.5 * Math.sin(kk)) > 1) dt += 0.005;
        pf.dl = dt;
        list.push(pf);
      }
    }
  }
  function drawBud(F, tau, t, dry, f) {
    const sc = f.sc, bb = s5(ph(tau, f.tb, f.tb + 2.2)), lb = (4 + 10 * bb) * sc, rb = (2.3 + 4.2 * bb) * sc;
    const o = ph(tau, f.to - 0.15, f.to + 0.25), fallT = tau - (f.to + 0.25);
    const bx = F.cx, by = F.cy, bz = F.cz;
    const cd = sstep(f.to + 0.8, f.to + 2.9, tau);
    for (const side of [-1, 1]) {
      // each sepal: half of the bud's shell; it swings open about the base, then drops
      const gam = 1.5 * s5(o) * side;
      let fx = 0, fy = 0, rot2 = 0, sq = 0;
      if (fallT > 0) {
        const tl = Math.sqrt(2 * Math.max(0, F.cy - 1) / 260), d = Math.min(fallT, tl);
        fx = side * 11 * d; fy = -0.5 * 260 * d * d; rot2 = side * 5 * d; sq = sstep(tl, tl + 0.15, fallT);
      }
      const cg = Math.cos(gam + rot2), sgm = Math.sin(gam + rot2);
      const nu = Math.max(3, Math.ceil(lb * 1.4));
      const c0 = mixC([0.3, 0.5, 0.18], DRY, Math.max(dry, cd * (fallT > 0 ? 1 : 0)));
      for (let qu = -nu; qu <= nu; qu++) {
        const u = qu / nu, rr = rb * Math.sqrt(Math.max(0, 1 - u * u)) * (u > 0 ? 1 - 0.3 * u * u : 1);
        const nph = Math.max(4, Math.ceil(rr * TAU * 2.3));
        for (let qp = 0; qp < nph; qp++) {
          const p = qp / nph * TAU, cp = Math.cos(p), sp = Math.sin(p);
          if (cp * side < -0.02) continue;
          const la = (u + 1) * lb / 2, lc = rr * cp;
          const la2 = la * cg - lc * sgm, lc2 = la * sgm + lc * cg;
          let x = bx + F.ax * la2 + F.e1x * lc2 + F.e2x * rr * sp, y = by + F.ay * la2 + F.e1y * lc2 + F.e2y * rr * sp, z = bz + F.az * la2 + F.e1z * lc2 + F.e2z * rr * sp;
          x += fx; y += fy;
          if (sq > 0) y = lerp(y, 0.8 + (y - (by + fy)) * 0.15, sq);
          const nx = F.e1x * cp + F.e2x * sp + F.ax * u * 0.6, ny = F.e1y * cp + F.e2y * sp + F.ay * u * 0.6, nz = F.e1z * cp + F.e2z * sp + F.az * u * 0.6;
          const nl = Math.hypot(nx, ny, nz) || 1;
          const m = Math.abs(cp) < 0.1 ? 0.7 : 0.9 + 0.15 * ih(qu, qp, 530);
          pshade(c0[0] * m, c0[1] * m, c0[2] * m, nx / nl, ny / nl, nz / nl, 0.5, 0.45, 0.85, 0.2, 0.1, 1);
          splat(x, y, z, 7, false);
          if ((qu + qp) % 4 === 0) shDot(x, y, z);
          if (fallT <= 0 && ih(qu, qp, 531) < 0.07 && Math.abs(u) < 0.85) {
            const hx = nx / nl, hy = ny / nl, hz = nz / nl, hc = mixC([0.62, 0.74, 0.42], DRY, dry);
            for (let q = 0.6; q <= 1.6; q += 0.5) { pshade(hc[0], hc[1], hc[2], hx, hy, 0.3, 1.3, 0.95, 1, 0.6, 0, 1); splat(x + hx * q, y + hy * q, z + hz * q, 13, false); }
          }
        }
      }
    }
  }
  function drawCentre(F, tau, dry, f) {
    const sc = f.sc, t0 = f.td[0];
    const g = s5(ph(tau, f.to + 0.9, t0 + 1.2)), pd = s5(ph(tau, t0 + 0.55, t0 + 1.75));
    const rc = (3.2 + 1.2 * g) * sc, hc = (5.2 + 2 * g) * sc;
    const body = mixC([0.42, 0.5, 0.3], [0.64, 0.53, 0.35], pd), disc = mixC([0.3, 0.17, 0.22], [0.4, 0.31, 0.22], pd);
    const rayc = mixC([0.5, 0.44, 0.48], [0.55, 0.46, 0.32], pd);
    // the capsule: a small barrel along the flower's axis
    for (let h = 0; h <= hc; h += 0.4) {
      const rr = rc * (0.75 + 0.3 * Math.sin(Math.PI * h / hc));
      const nph = Math.max(6, Math.ceil(rr * TAU * 2.3));
      for (let q = 0; q < nph; q++) {
        const p = q / nph * TAU, cp = Math.cos(p), sp = Math.sin(p);
        const nx = F.e1x * cp + F.e2x * sp, ny = F.e1y * cp + F.e2y * sp, nz = F.e1z * cp + F.e2z * sp;
        const m = 0.9 + 0.12 * Math.cos(p * 9);
        pshade(body[0] * m, body[1] * m, body[2] * m, nx, ny, nz, 0.2, 0.6, 0.7, 0.3, 0.2, 1);
        splat(F.cx + F.ax * h + nx * rr, F.cy + F.ay * h + ny * rr, F.cz + F.az * h + nz * rr, 10, false);
      }
    }
    // the stigmatic disc on top, with its rays
    const dr = rc * 1.18;
    for (let rr = 0; rr <= dr; rr += 0.4) {
      const nph = Math.max(1, Math.ceil(rr * TAU * 2.3));
      for (let q = 0; q < nph; q++) {
        const p = q / nph * TAU, cp = Math.cos(p), sp = Math.sin(p);
        const c = Math.abs(Math.sin(p * 4)) < 0.22 && rr > 0.5 ? rayc : disc;
        const lx = F.e1x * cp + F.e2x * sp, ly = F.e1y * cp + F.e2y * sp, lz = F.e1z * cp + F.e2z * sp;
        pshade(c[0], c[1], c[2], F.ax + lx * 0.3, F.ay + ly * 0.3, F.az + lz * 0.3, 0.1, 0, 0, 0, 0.2, 1);
        splat(F.cx + F.ax * (hc + 0.3) + lx * rr, F.cy + F.ay * (hc + 0.3) + ly * rr, F.cz + F.az * (hc + 0.3) + lz * rr, 10, false);
      }
    }
    shDot(F.cx + F.ax * hc, F.cy + F.ay * hc, F.cz);
    // stamens: a dark ring of filaments with anthers, withering away after the petals go
    const sl = 5.6 * sc * (1 - s5(ph(tau, t0 + 0.05, t0 + 1.35)));
    const nm = Math.round(34 * sc);
    if (sl > 0.3) for (let m = 0; m < nm; m++) {
      const p = m / nm * TAU + 0.13, cp = Math.cos(p), sp = Math.sin(p), b = 0.75 + 0.2 * ih(m, 1, 540);
      const rx = F.e1x * cp + F.e2x * sp, ry = F.e1y * cp + F.e2y * sp, rz = F.e1z * cp + F.e2z * sp;
      const dx = Math.cos(b) * F.ax + Math.sin(b) * rx, dy = Math.cos(b) * F.ay + Math.sin(b) * ry, dz = Math.cos(b) * F.az + Math.sin(b) * rz;
      const x0 = F.cx + rx * rc * 0.8 + F.ax * 0.6, y0 = F.cy + ry * rc * 0.8 + F.ay * 0.6, z0 = F.cz + rz * rc * 0.8 + F.az * 0.6;
      const pollen = ih(m, 2, 540) < 0.4;
      for (let s = 0; s <= sl; s += 0.45) {
        const end = s > sl - 0.9;
        if (end) { if (pollen) pshade(0.85, 0.78, 0.55, rx, ry, rz, 0.1, 0, 0, 0, 0.3, 1); else pshade(0.16, 0.12, 0.18, rx, ry, rz, 0.1, 0, 0, 0, 0.3, 1); }
        else pshade(0.1, 0.07, 0.1, rx, ry, rz, 0.1, 0, 0, 0, 0, 1);
        splat(x0 + dx * s, y0 + dy * s, z0 + dz * s, 10, false);
      }
    }
  }
  function drawFlower(fi, tau, t, dry) {
    const f = FLOWERS[fi];
    if (tau < f.tb) return null;
    const F = flowerFrame(FF, fi);
    if (!F) return null;
    PSC = f.sc;
    drawBud(F, tau, t, dry, f);
    if (f.td && tau >= f.to - 0.15) {
      const op = back(ph(tau, f.to, f.to + 1.7), 0.9);
      for (let q = 0; q < 4; q++) {
        if (tau >= f.td[q]) continue;
        const loose = 0.22 * sstep(f.td[q] - 0.6, f.td[q], tau);
        drawPetal(F, q, op, loose, null, 8, 1, op >= 1 && loose === 0 ? PCACHE[fi][q][0] : null);
      }
      drawCentre(F, tau, dry, f);
    }
    PSC = 1;
    return F;
  }

  /* ---------------------------------------------------------------- the seed let go */
  let PRX = 0, PRY = 0;                         // the hero pod's mouth at release (plant-local)
  const SEED_ROT = 0.16;
  function seedPathAt(tau) {
    const t1 = 22.6, t2 = 23.0, t3 = 23.28, t4 = 23.62, t5 = 23.95, XB1 = P - 70;
    let X, Y, rot = SEED_ROT + 6 * Math.PI * s5(ph(tau, T_REL, t4));
    if (tau < t1) { const u = ph(tau, T_REL, t1); X = PRX + (XB1 - PRX) * u * (1.5 - 0.5 * u); Y = PRY + 9 * u - (PRY + 9 - 1.8) * u * u; }
    else if (tau < t2) { const u = ph(tau, t1, t2); X = XB1 + 30 * u; Y = 1.8 + 9 * Math.sin(Math.PI * u); }
    else if (tau < t3) { const u = ph(tau, t2, t3); X = XB1 + 30 + 18 * u; Y = 1.8 + 3.2 * Math.sin(Math.PI * u); }
    else if (tau < t4) { const u = ph(tau, t3, t4); X = XB1 + 48 + 22 * (1 - (1 - u) * (1 - u)); Y = 1.8 + 1.2 * (1 - s5(ph(tau, t4 - 0.08, t4))); }
    else { const v = ph(tau, t4, t5); X = P; Y = 1.8; rot += 0.28 * Math.sin(Math.PI * 3 * v) * (1 - v); }
    return [X, Y, rot];
  }
  function drawSeedFlight(tau) {
    if (tau < T_REL || tau >= D) return;
    const p = seedPathAt(tau);
    drawSeed(p[0], p[1], p[2], 0, 0, 0, 11, 0.9 + 0.1 * sstep(1.6, 3, p[1]));
  }

  /* ---------------------------------------------------------------- one plant (k = 0 this loop's, k = −1 the last one's) */
  function drawPlant(k, t) {
    const tauRaw = t - k * D, tau = Math.min(tauRaw, D - 0.001);
    BX = X0 - CAMI + k * P; BY = SITE_Y;
    if (k === 0) drawSeedFlight(tau);
    if (BX < -170 || BX > W + 110) return;
    const L = stemCurve(tau, t), dry = dryAt(tau);
    // the seed: resting, swelling, splitting; afterwards its empty coat stays in the crack
    const sw = s5(ph(tau, 1.2, 3.0)) * (1 + 0.04 * Math.sin(tau * 5.2) * sstep(1.2, 2.0, tau) * (1 - sstep(2.6, 3.0, tau)));
    const sp = s5(ph(tau, 3.0, 3.5)), shell = s5(ph(tau, 3.5, 6.0));
    drawSeed(0, 1.8, SEED_ROT, sw, sp, shell, 11, 0.9);
    drawRoot(tau);
    if (L > 0) {
      drawTube(STX, STY, STA, STN, L, 1.6 + 1.0 * s5(ph(tau, 8.5, 14)) + 0.45 * sstep(5.6, 6.8, tau) * (1 - sstep(T_BREAK, 7.6, tau)), tau, dry, 1, 0);
      for (let b = 0; b < BRANCHES.length; b++) {
        const B = BRANCHES[b], Lb = branchCurve(b, tau, t);
        if (Lb > 0.3) drawTube(B.X, B.Y, B.A, B.n, Lb, 0.8 + 0.75 * s5(ph(tau, B.t0, B.t1 + 1)), tau, dry, 17, 1 + b);
      }
      drawCotyledons(tau, t, dry);
      drawLeaves(tau, t, dry);
      for (let fi = 0; fi < FLOWERS.length; fi++) {
        const F = drawFlower(fi, tau, t, dry);
        if (fi === 0 && k === 0 && F) { FLX = BX + F.cx; FLY = BY - F.cy + 0.3 * F.cz; }
      }
    }
    for (let fi = 0; fi < FLOWERS.length; fi++) {
      const f = FLOWERS[fi];
      if (!f.td) continue;
      for (let q = 0; q < 4; q++) {
        const dt = tauRaw - f.td[q];
        if (dt < 0) continue;
        const pf = PFALL[fi][q], xf = petalFallXf(pf, dt);
        if (BX + XFOX < -40 || BX + XFOX > W + 40 || BY - XFOY < -40) continue;
        drawPetal(pf.F, q, 1, 0.22, xf, 8, 1 - 0.6 * sstep(pf.dl, pf.dl + 3.6, dt), PCACHE[fi][q][1]);
      }
    }
  }

  /* ---------------------------------------------------------------- composite the plant over the rock */
  const PNAME = ['', 'stem', 'cotyledons', 'leaf1', 'leaf2', 'leaf3', 'leaf4', 'bud', 'petals', 'fallen', 'pod', 'seed', 'root', 'hairs', 'bleaf1', 'bleaf2', 'bleaf3', 'branches'];
  let FHIDE = false;
  function compositePlant() {
    if (PB1 < PB0) return;
    // the sun's direction across the picture, for which edges get the dark line and which the glowing rim
    let lx = LS.lx, ly = -LS.ly; const ll = Math.hypot(lx, ly) || 1; lx /= ll; ly /= ll;
    const glow = 0.25 + 0.75 * LS.back;
    const vis = (i) => PST[i] === FR && !(PBL[i] && !CRM[i]) && !(FHIDE && FOCC[i] === FR && PID[i] <= 2);
    for (let y = PB2; y <= PB3; y++) for (let x = PB0; x <= PB1; x++) {
      const i = y * W + x;
      if (!vis(i)) continue;
      const j = i * 3;
      let r = PCOL[j], g = PCOL[j + 1], b = PCOL[j + 2];
      let e = 0;
      if (y > 0 && !vis(i - W)) e += -ly; if (y < H - 1 && !vis(i + W)) e += ly;
      if (x > 0 && !vis(i - 1)) e += -lx; if (x < W - 1 && !vis(i + 1)) e += lx;
      const id = PID[i];
      if (e > 0.3 && id !== 11 && id !== 12) { const k = 1 + 0.5 * glow; r = r * k + 18 * glow * LS.sr; g = g * k + 14 * glow * LS.sg; b = b * k + 6 * glow * LS.sb; }
      else if (e < -0.3) { r *= 0.66; g *= 0.68; b *= 0.72; }
      C[j] = r; C[j + 1] = g; C[j + 2] = b;
      if (TRK) TRK[PNAME[id]] = (TRK[PNAME[id]] || 0) + 1;
    }
    OLN.fill(0, 0, 0);
    for (let y = PB2; y <= PB3; y++) for (let x = PB0; x <= PB1; x++) {
      const i = y * W + x;
      if (PID[i] !== 11 || !vis(i)) continue;
      for (const [dx, dy, a] of SEEDRING) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const n = yy * W + xx; if (vis(n) && PID[n] !== 13) continue;
        if (OLS[n] !== FR || OLA[n] < a) { OLS[n] = FR; OLA[n] = a; }
      }
    }
    for (let y = Math.max(0, PB2 - 1); y <= Math.min(H - 1, PB3 + 3); y++) for (let x = Math.max(0, PB0 - 2); x <= Math.min(W - 1, PB1 + 2); x++) {
      const n = y * W + x; if (OLS[n] !== FR) continue;
      const m = 1 - OLA[n], j = n * 3; C[j] *= m; C[j + 1] *= m; C[j + 2] *= m * 1.05;
    }
  }
  const OLN = [0], OLS = new Int32Array(NP), OLA = new Float32Array(NP);
  const SEEDRING = [[-1, 0, 0.55], [1, 0, 0.55], [0, -1, 0.5], [0, 1, 0.62], [1, 1, 0.5], [-1, 1, 0.45], [0, 2, 0.32], [1, 2, 0.25]];
  function blurShadow() {
    if (SB1 < SB0) return;
    const x0 = Math.max(0, SB0 - 1), x1 = Math.min(W - 1, SB1 + 1), y0 = Math.max(RIMTOP, SB2 - 1), y1 = Math.min(H - 1, SB3 + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let s = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = clamp(x + i, 0, W - 1), yy = clamp(y + j, 0, H - 1); s += PSH[yy * W + xx]; }
      C2[y * W + x] = s / 9;
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) PSH[y * W + x] = C2[y * W + x];
  }

  /* ================================================================ dust motes in the sun */
  const MOTES = [];
  function buildMotes() {
    const R = mulberry32(5150);
    for (let k = 0; k < 30; k++) MOTES.push({ x: 20 + R() * 320, y: 30 + R() * 270, ax: 8 + R() * 18, ay: 5 + R() * 12, fx: 1 + fl(R() * 2), fy: 1 + fl(R() * 2),
      p1: R() * TAU, p2: R() * TAU, p3: R() * TAU, tw: 3 + fl(R() * 6), s: 0.45 + 0.55 * R() });
  }
  function drawMotes(t) {
    const lit = (0.2 + 0.8 * LS.back) * LS.sun;
    if (lit < 0.02) return;
    for (const m of MOTES) {
      const x = m.x + m.ax * Math.sin(per(m.fx, t) + m.p1) + 4 * Math.sin(per(5, t) + m.p3);
      const y = m.y + m.ay * Math.sin(per(m.fy, t) + m.p2) + 3 * Math.sin(per(4, t) + m.p1);
      const tw = 0.5 + 0.5 * Math.sin(per(m.tw, t) + m.p3);
      const a = lit * m.s * (0.3 + 0.7 * tw * tw) * (y < 200 ? 1 : 0.7);
      const xi = fl(x - 0.5), yi = fl(y - 0.5), fx = x - 0.5 - xi, fy = y - 0.5 - yi;
      const w = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
      for (let q = 0; q < 4; q++) {
        const px = xi + (q & 1), py = yi + (q >> 1);
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const j = (py * W + px) * 3, v = 60 * a * w[q];
        C[j] += v * LS.sr; C[j + 1] += v * LS.sg; C[j + 2] += v * LS.sb; PXN++;
      }
    }
  }

  /* ================================================================ a hoverfly, once, at the flower */
  let FLX = -999, FLY = -999;                   // the flower's centre on screen this frame (set by the plant)
  const FLYK = [[16.7, 210, -100], [17.2, 70, -42], [17.55, 18, -12], [17.8, 7, -6], [18.0, 3, -3.5], [18.45, 3, -3.5], [18.7, 24, -24], [19.05, 120, -100], [19.4, 260, -200]];
  function flyPos(t) {
    let i = 0; while (i < FLYK.length - 2 && FLYK[i + 1][0] <= t) i++;
    const k0 = FLYK[Math.max(0, i - 1)], k1 = FLYK[i], k2 = FLYK[i + 1], k3 = FLYK[Math.min(FLYK.length - 1, i + 2)];
    const s = ph(t, k1[0], k2[0]), s2 = s * s, s3 = s2 * s;
    const out = [0, 0];
    for (let c = 1; c <= 2; c++) {
      const m1 = (k2[c] - k0[c]) * 0.5, m2 = (k3[c] - k1[c]) * 0.5;
      out[c - 1] = (2 * s3 - 3 * s2 + 1) * k1[c] + (s3 - 2 * s2 + s) * m1 + (-2 * s3 + 3 * s2) * k2[c] + (s3 - s2) * m2;
    }
    return out;
  }
  function drawInsect(t) {
    if (t < 16.7 || t > 19.4 || FLX < -900) return;
    const p = flyPos(t), landed = t > 17.95 && t < 18.5;
    const jx = landed ? 0 : 1.1 * Math.sin(t * 23) + 0.5 * Math.sin(t * 41 + 1), jy = landed ? 0 : 0.8 * Math.sin(t * 31 + 2);
    const x = FLX + p[0] + jx, y = FLY + p[1] + jy;
    if (x < -10 || x > W + 10 || y < -10) return;
    const q = flyPos(t + 0.05), dir = q[0] - p[0] < -0.2 ? -1 : q[0] - p[0] > 0.2 ? 1 : (t < 18.2 ? -1 : 1);
    const l = LS.sun * 0.9, am = 0.95;
    const sh = (c) => [c[0] * (LS.sr * l + LS.ar * am) * 255, c[1] * (LS.sg * l + LS.ag * am) * 255, c[2] * (LS.sb * l + LS.ab * am) * 255];
    // body, head first: eyes, a bronze thorax, a banded abdomen
    const parts = [[-3, 0, [0.2, 0.12, 0.09]], [-3, -1, [0.24, 0.14, 0.1]], [-2, 0, [0.3, 0.26, 0.13]], [-1, 0, [0.32, 0.27, 0.14]], [-1, -1, [0.36, 0.3, 0.15]],
      [0, 0, [0.82, 0.62, 0.24]], [1, 0, [0.14, 0.11, 0.07]], [2, 0, [0.8, 0.6, 0.23]], [3, 0, [0.15, 0.11, 0.07]], [0, 1, [0.62, 0.46, 0.18]], [1, 1, [0.12, 0.1, 0.06]], [2, 1, [0.6, 0.45, 0.17]]];
    for (const [u, v, c] of parts) { const s = sh(c); mixPx(x - u * dir, y + v, s[0], s[1], s[2], 1); }
    // wings: a pale blur above the thorax
    const wa = landed ? 0.45 : 0.3 + 0.08 * Math.sin(t * 90);
    const wc = [235 * (0.6 + 0.4 * LS.sr), 238 * (0.6 + 0.4 * LS.sg), 242 * (0.6 + 0.4 * LS.sb)];
    for (const [u, v] of [[-1, -2], [0, -2], [1, -2], [0, -3], [1, -3], [2, -2]]) mixPx(x - u * dir, y + v, wc[0], wc[1], wc[2], wa);
    const s0 = sh([0.75, 0.75, 0.8]);
    mixPx(x + 3 * dir, y - 1, s0[0], s0[1], s0[2], 0.5);       // a glint on the eye
  }

  /* ================================================================ the words */
  // a small serif pixel face drawn for this piece: x-height 6, caps and ascenders 9, descenders 3
  const GLYPH = {
    A: ['...#...', '...#...', '..#.#..', '..#.#..', '.#...#.', '.#####.', '.#...#.', '#.....#', '##...##'],
    l: ['##.', '.#.', '.#.', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
    g: [null, null, null, '.####', '#...#', '#...#', '#...#', '#...#', '.####', '....#', '#...#', '.###.'],
    o: [null, null, null, '.###.', '#...#', '#...#', '#...#', '#...#', '.###.'],
    r: [null, null, null, '##.##', '.##..', '.#...', '.#...', '.#...', '###..'],
    y: [null, null, null, '##.##', '#...#', '.#.#.', '.#.#.', '..#..', '..#..', '.#...', '.#...', '##...'],
    c: [null, null, null, '.###', '#...', '#...', '#...', '#...', '.###'],
    m: [null, null, null, '##.#..#..', '.##.##.#.', '.#..#..#.', '.#..#..#.', '.#..#..#.', '##.###.##'],
    e: [null, null, null, '.###.', '#...#', '#####', '#....', '#...#', '.###.'],
    s: [null, null, null, '.###', '#...', '.##.', '...#', '...#', '###.'],
    f: ['..##', '.#..', '.#..', '###.', '.#..', '.#..', '.#..', '.#..', '###.'],
    d: ['...##', '....#', '....#', '.####', '#...#', '#...#', '#...#', '#...#', '.####'],
    a: [null, null, null, '.###.', '....#', '.####', '#...#', '#...#', '.####'],
    i: [null, '.#.', null, '##.', '.#.', '.#.', '.#.', '.#.', '###'],
    n: [null, null, null, '##.#.', '.##.#', '.#..#', '.#..#', '.#..#', '##.##'],
    t: [null, '.#..', '.#..', '###.', '.#..', '.#..', '.#..', '.#.#', '..#.'],
    b: ['##...', '.#...', '.#...', '.###.', '.#..#', '.#..#', '.#..#', '.#..#', '####.'],
    '.': [null, null, null, null, null, null, null, null, '#'],
  };
  const LINES = ['All glory comes', 'from daring to begin.'];
  const TEXTPX = [];                            // [x, y] of every inked pixel
  function buildText() {
    const gw = (ch) => (ch === ' ' ? 3 : GLYPH[ch].reduce((m, r) => Math.max(m, r ? r.length : 0), 0));
    LINES.forEach((ln, li) => {
      let w = 0; for (const ch of ln) w += gw(ch) + 1; w -= 1;
      let x = Math.round(180 - w / 2);
      const y0 = 30 + li * 15;
      for (const ch of ln) {
        if (ch !== ' ') GLYPH[ch].forEach((row, ry) => { if (row) for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') TEXTPX.push([x + rx, y0 + ry]); });
        x += gw(ch) + 1;
      }
    });
  }
  const TXF0 = 15.9, TXF1 = 17.1, TXF2 = 19.5, TXF3 = 20.6;
  function drawText(t) {
    const f = s5(ph(t, TXF0, TXF1)) * (1 - s5(ph(t, TXF2, TXF3)));
    if (f <= 0) return;
    const n0 = PXN;
    for (const [x, y] of TEXTPX) mixPx(x + 1, y + 1, 92, 66, 58, 0.28 * f);
    for (const [x, y] of TEXTPX) mixPx(x, y, 244, 232, 206, f);
    PXN = n0 + Math.round(TEXTPX.length * f);       // the motion check sees the words as much as they show
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
  let PROF = null, TRK = null;
  const stage = (name, fn, t) => {
    if (!PROF) { trk(name, () => fn(t)); return; }
    const t0 = performance.now(); fn(t); PROF[name] = (PROF[name] || 0) + performance.now() - t0;
  };
  function trk(name, fn) { if (!TRK) { fn(); return; } const n0 = PXN; fn(); if (PXN > n0) TRK[name] = (TRK[name] || 0) + PXN - n0; }
  function plants(t) {
    FR++; PB0 = W; PB1 = -1; PB2 = H; PB3 = -1; SB0 = W; SB1 = -1; SB2 = H; SB3 = -1;
    PSH.fill(0);
    FLX = -999;
    drawPlant(-1, t);
    drawPlant(0, t);
    blurShadow();
  }
  function render(t) {
    t = mod(t, D);
    if (TRK) for (const k in TRK) TRK[k] = 0;
    setLight(t); lightPrep();
    { const vx = 0, vy = 0.29, vz = 0.96; VHX = LS.lx + vx; VHY = LS.ly + vy; VHZ = LS.lz + vz; const l = Math.hypot(VHX, VHY, VHZ) || 1; VHX /= l; VHY /= l; VHZ /= l; }
    CAMI = Math.round(camAt(t));
    stage('plant', plants, t);
    stage('haze', drawBackground, t);
    stage('clouds', drawClouds, t);
    stage('flock', drawFlock, t);
    stage('stone', drawStone, t);
    FHIDE = t < T_BREAK;
    stage('site', (tt) => { drawSite(-1, tt); drawSite(0, tt); }, t);
    stage('focus', softFocus, t);
    stage('composite', compositePlant, t);
    stage('beam', drawBeam, t);
    stage('insect', drawInsect, t);
    stage('motes', drawMotes, t);
    stage('text', drawText, t);
    stage('quantise', quantise, t);
  }

  let BUILT = false;
  function build() {
    if (BUILT) return;
    buildLUT();
    buildCam();
    paintStone();
    RIMTOP = H; for (let x = 0; x < TW; x++) RIMTOP = Math.min(RIMTOP, fl(RIM[x]));
    paintBackground();
    buildClouds();
    buildChips(); buildGrit(); buildDust();
    buildLeafTimes();
    buildCrumple();
    buildPetalCache();
    buildBranchLeafTimes();
    buildPetalFall();
    { geomAt(T_REL, T_REL); const F = flowerFrame({}, 0), hc = 5.2 + 2; PRX = F.cx + F.ax * (hc + 0.8); PRY = F.cy + F.ay * (hc + 0.8); }
    buildMotes();
    buildText();
    BUILT = true;
  }

  const core = { W, H, D, PAL, OUT, C, build, render, camAt, get CAMI() { return CAMI; }, get SITE_Y() { return SITE_Y; }, LS, LEAVES, TD,
    prof(on) { PROF = on ? {} : null; return PROF; }, get PROF() { return PROF; }, track(on) { TRK = on ? {} : null; return TRK; }, get TRK() { return TRK; } };
  window.__seedCore = core;
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
  const ROOM = '#17131a';
  (window.PIECES = window.PIECES || []).push({
    id: 'the-seed-and-the-stone',
    title: 'The Seed and the Stone',
    medium: 'Pixel art in 48 colours, 360 × 450, drawn in JavaScript · 24 s loop',
    note: 'All glory comes from daring to begin · tap to pause',
    about: 'A seed in a crack in a granite slab, seen from the ground. At dawn it splits and sends up a curled shoot, which meets a flake of stone, strains, and breaks it off. Through the day the sun walks round the rock, every grain throwing its own small shadow, while the stem climbs and its leaves unfold against the light. In the golden hour a nodding bud lifts and opens into a single red poppy. Then the petals fall, the head dries to a pod, and the evening wind flicks one seed away along the stone into a fresh, narrow crack.',
    tone: 'dark',
    room: ROOM,
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      SEED = 6; // composed for one seed
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
        window.__seed = {
          duration: D,
          isReady: () => built && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); draw(t); window.__seed.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          pixels: pixelsB64,
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'the-seed-and-the-stone';
        api.ready();
      } else {
        window.__seed = { duration: D, isReady: () => built, lastMs: 0, renderAt(t) { return new Promise((res) => { playing = false; clock = t; const t0 = performance.now(); draw(t); window.__seed.lastMs = performance.now() - t0; requestAnimationFrame(() => res()); }); } };
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
        if (window.__seed) window.__seed.lastMs = performance.now() - t0;
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
          if (window.__seed) delete window.__seed;
        },
      };
    },
  });
})();
