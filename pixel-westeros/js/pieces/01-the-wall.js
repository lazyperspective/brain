/* The Wall — A Song of Pixels, piece 1.
 *
 * A cliff of ancient ice seen from near its foot, looking up, in a night blizzard. The picture is a real
 * three-point perspective: every pixel casts a ray from a camera tilted 18 degrees upward, so the ice face,
 * its block courses, strata, fluting and cracks are all laid out in metres on a vertical plane and
 * foreshortened honestly, and the verticals converge toward a vanishing point far above the frame.
 * The still parts (the face, the scaffold stair, the snowfield) are painted once at mount with 2 x 2
 * supersampling. Everything that moves is a closed function of t: storm clouds and gust sheets slide as
 * tileable noise, four parallax layers of snow ride a shared time-warp so the whole storm surges and
 * slackens together, spindrift is a field of short-lived particles torn off the crest, light runs up the
 * cracks as travelling pulses, torches patrol the crest and climb the stair, and far below a column of tiny
 * shapes marches out of the white when the snow thins. D = 20 s; every term turns a whole number of times.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 270, H = 338, NP = W * H, D = 20;
  const TAU = Math.PI * 2, fl = Math.floor, PI = Math.PI;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const frac = (x) => x - fl(x);
  const SEED = 7; // the scene is composed for one seed
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(((c | 0) + SEED * 7919) | 0, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function vn1(x, s) {
    const i = fl(x), f = x - i, u = f * f * (3 - 2 * f);
    return lerp(ih(i, 17, s), ih(i + 1, 17, s), u);
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
  function fbm1(x, s, o) {
    let v = 0, a = 0.5, n = 0;
    for (let k = 0; k < (o || 4); k++) { v += a * vn1(x, s + k * 31); n += a; x *= 2.1; a *= 0.5; }
    return v / n;
  }
  // stretched cellular noise: nearest feature id and the gap to the second nearest (edge distance)
  const VO = { h: 0, e: 0 };
  function voro(x, y, s) {
    const ix = fl(x), iy = fl(y);
    let d1 = 9, d2 = 9, hid = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = ix + i, cy = iy + j;
      const px = cx + ih(cx, cy, s), py = cy + ih(cx, cy, s + 1);
      const dx = px - x, dy = py - y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < d1) { d2 = d1; d1 = d; hid = ih(cx, cy, s + 2); } else if (d < d2) d2 = d;
    }
    VO.h = hid; VO.e = d2 - d1;
    return VO;
  }
  // 8 x 8 Bayer, values in [0, 1)
  const B8 = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21].map((v) => (v + 0.5) / 64);

  /* ---------------------------------------------------------------- tileable noise tables (256 x 256) */
  function table(seed, base, oct, gain) {
    const T = new Float32Array(65536);
    let amp = 1, tot = 0;
    for (let o = 0; o < oct; o++) {
      const P = base << o, cs = 256 / P;
      for (let y = 0; y < 256; y++) {
        const gy = y / cs, j = fl(gy), fy = gy - j, uy = fy * fy * (3 - 2 * fy), j0 = j % P, j1 = (j + 1) % P;
        for (let x = 0; x < 256; x++) {
          const gx = x / cs, i = fl(gx), fx = gx - i, ux = fx * fx * (3 - 2 * fx), i0 = i % P, i1 = (i + 1) % P;
          const a = ih(i0, j0, seed + o * 13), b = ih(i1, j0, seed + o * 13), c = ih(i0, j1, seed + o * 13), d = ih(i1, j1, seed + o * 13);
          T[(y << 8) | x] += amp * lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
        }
      }
      tot += amp; amp *= gain;
    }
    let lo = 9, hi = -9;
    for (let i = 0; i < 65536; i++) { T[i] /= tot; if (T[i] < lo) lo = T[i]; if (T[i] > hi) hi = T[i]; }
    for (let i = 0; i < 65536; i++) T[i] = (T[i] - lo) / (hi - lo);
    return T;
  }
  function samp(T, u, v) {
    const iu = fl(u), iv = fl(v), fu = u - iu, fv = v - iv;
    const x0 = iu & 255, x1 = (iu + 1) & 255, y0 = (iv & 255) << 8, y1 = ((iv + 1) & 255) << 8;
    const a = T[y0 | x0], b = T[y0 | x1], c = T[y1 | x0], d = T[y1 | x1];
    return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv;
  }

  /* ================================================================ palette & LUT */
  const HEX = [
    // cold ramp, black to white
    '04050a', '080b14', '0d1220', '131a2e', '1a243e', '22304f', '2b3d61', '354b72', '405a83', '4d6a94',
    '5b7ba5', '6b8db5', '7d9fc3', '90b1d0', 'a5c3dc', 'bad3e6', 'cfe2ef', 'e2eef6', 'f2f8fc', 'ffffff',
    // slate greys
    '262c38', '343b48', '444c5a', '56606e', '6a7483', '7f8998', '959fad', 'acb5c1',
    // light in the ice
    '4fb4e6', '86d4f4', 'bdeefc',
    // the cold glow beyond
    '22407e', '3a5ea2', '5a82c6', '88aee6',
    // fire and wood
    '1c1310', '3a2216', '6e3418', 'b0561c', 'e8892c', 'ffc45e', 'fff1c8',
  ];
  const NPAL = HEX.length;
  const PR = new Float32Array(NPAL), PG = new Float32Array(NPAL), PB = new Float32Array(NPAL);
  HEX.forEach((h, i) => { PR[i] = parseInt(h.slice(0, 2), 16) / 255; PG[i] = parseInt(h.slice(2, 4), 16) / 255; PB[i] = parseInt(h.slice(4, 6), 16) / 255; });
  const LE = new Uint8Array(new Uint32Array([0x01020304]).buffer)[0] === 0x04;
  const pack = (r, g, b) => (LE ? ((255 << 24) | (b << 16) | (g << 8) | r) : ((r << 24) | (g << 16) | (b << 8) | 255)) >>> 0;
  const PAL32 = new Uint32Array(NPAL);
  for (let i = 0; i < NPAL; i++) PAL32[i] = pack(Math.round(PR[i] * 255), Math.round(PG[i] * 255), Math.round(PB[i] * 255));
  const LQ = 40; // LUT resolution per channel
  let LUT = null;
  function buildLUT() {
    LUT = new Uint8Array(LQ * LQ * LQ);
    for (let r = 0; r < LQ; r++) for (let g = 0; g < LQ; g++) for (let b = 0; b < LQ; b++) {
      const R = r / (LQ - 1), G = g / (LQ - 1), B = b / (LQ - 1);
      let best = 0, bd = 1e9;
      for (let i = 0; i < NPAL; i++) {
        const dr = R - PR[i], dg = G - PG[i], db = B - PB[i];
        const rm = (R + PR[i]) * 0.5;
        const d = (2 + rm) * dr * dr + 4 * dg * dg + (3 - rm) * db * db;
        if (d < bd) { bd = d; best = i; }
      }
      LUT[(r * LQ + g) * LQ + b] = best;
    }
  }

  /* ================================================================ camera */
  const F = 250, PSI = 57 * PI / 180, PHI = 21 * PI / 180;
  const DW = 120, HC = 14, HW = 210; // wall plane z, camera height, wall height (metres)
  const FWD = [Math.sin(PSI) * Math.cos(PHI), Math.sin(PHI), Math.cos(PSI) * Math.cos(PHI)];
  const RT = [Math.cos(PSI), 0, -Math.sin(PSI)];
  const UP = [-Math.sin(PSI) * Math.sin(PHI), Math.cos(PHI), -Math.cos(PSI) * Math.sin(PHI)];
  const RAY = [0, 0, 0];
  function ray(px, py) {
    const sx = (px - W / 2) / F, sy = (H / 2 - py) / F;
    RAY[0] = FWD[0] + sx * RT[0] + sy * UP[0];
    RAY[1] = FWD[1] + sx * RT[1] + sy * UP[1];
    RAY[2] = FWD[2] + sx * RT[2] + sy * UP[2];
    return RAY;
  }
  const PJ = { x: 0, y: 0, z: 0 };
  function proj(X, Y, Z) {
    const y0 = Y - HC;
    const cx = X * RT[0] + y0 * RT[1] + Z * RT[2];
    const cy = X * UP[0] + y0 * UP[1] + Z * UP[2];
    const cz = X * FWD[0] + y0 * FWD[1] + Z * FWD[2];
    PJ.z = cz; PJ.x = W / 2 + F * cx / cz; PJ.y = H / 2 - F * cy / cz;
    return PJ;
  }
  // the crest: big ice blocks of uneven height, a few broken notches
  function topOff(X) {
    const b = fl(X / 8.5), h = ih(b, 41, 3);
    let e = (h - 0.5) * 2.6 + 0.8 * Math.sin(X * 0.031);
    if (h > 0.94) e -= 4;
    return e;
  }
  const crest = (X) => HW + topOff(X);
  const apron = (X) => 6 + 10 * fbm1(X / 70, 91, 3); // snow banked against the foot
  // solve for the wall X that sits under screen column px at height Y
  function xAtScreen(px, Y) {
    let a = 40, b = 20000;
    for (let k = 0; k < 60; k++) { const m = (a + b) / 2; if (proj(m, Y, DW).x < px) a = m; else b = m; }
    return (a + b) / 2;
  }

  /* ================================================================ timing: one storm, closed in D */
  // time-warp: the storm advances at speed tau'(t); calm at t = 0, gusts near 5 s and 15 s, a lull at 10 s
  const tauOf = (t) => t - 0.45 * D / (2 * TAU) * Math.sin(2 * TAU * t / D) - 0.22 * D / TAU * Math.sin(TAU * t / D);
  const spdOf = (t) => 1 - 0.45 * Math.cos(2 * TAU * t / D) - 0.22 * Math.cos(TAU * t / D);
  // how thick the snow is, 0 (thin) to 1 (white-out)
  const envOf = (t) => clamp(0.5 - 0.3 * Math.cos(2 * TAU * (t - 0.6) / D) - 0.2 * Math.cos(TAU * (t - 0.6) / D), 0, 1);

  /* ================================================================ static scene */
  const TYPE = new Uint8Array(NP);      // 0 sky, 1 wall, 2 ground
  const DEP = new Float32Array(NP);     // metres along the ray
  const BR = new Float32Array(NP), BG = new Float32Array(NP), BB = new Float32Array(NP);
  const GL = new Float32Array(NP), GD = new Float32Array(NP); // ground: lateral and depth, for the ground drift
  const CRK = new Int16Array(NP).fill(-1); // crack halo: crack id
  const CRS = new Float32Array(NP);        // position along the crack 0..1
  const CRD = new Float32Array(NP);        // distance from the crack in px
  let TA = null, TB = null, TC = null, TD = null;
  let SKYI = null, GRDI = null, VEINI = null;
  const COLTOP = new Int16Array(W); // first wall row in each column

  const ICE = [[0, 0.025, 0.035, 0.075], [0.15, 0.07, 0.115, 0.22], [0.32, 0.15, 0.25, 0.42], [0.5, 0.29, 0.43, 0.63],
    [0.68, 0.5, 0.66, 0.82], [0.84, 0.75, 0.86, 0.94], [1, 0.95, 0.98, 1]];
  const CC = [0, 0, 0];
  function ramp(S, v) {
    v = clamp(v, 0, 1);
    let k = 1; while (k < S.length - 1 && S[k][0] < v) k++;
    const a = S[k - 1], b = S[k], f = (v - a[0]) / (b[0] - a[0]);
    CC[0] = lerp(a[1], b[1], f); CC[1] = lerp(a[2], b[2], f); CC[2] = lerp(a[3], b[3], f);
    return CC;
  }

  // things frozen into the ice: boulders, timbers, and a few shapes better not looked at
  const DEBRIS = [];
  // 1D cells along the face: returns position across the cell (0..1), its id, its width in metres
  const CEL = { u: 0, id: 0 };
  function cell1(x, salt) {
    const i = fl(x);
    let l = 0, r = 0, id = 0;
    const p = (j) => j + 0.15 + 0.7 * ih(j, salt, 3);
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1);
    if (x < p1) { l = p0; r = p1; id = i - 1; } else if (x < p2) { l = p1; r = p2; id = i; } else { l = p2; r = p(i + 2); id = i + 1; }
    CEL.u = (x - l) / (r - l); CEL.id = id;
    return CEL;
  }
  function wallVal(X, Y) {
    const yr = Y / HW;
    // strata: warped horizontal courses
    const warp = (fbm2(X / 150, Y / 70, 5, 3) - 0.5) * 12 + Math.sin(X / 260) * 4;
    const sw = Y + warp;
    const sj = sw + 7 * fbm1(sw / 16, 7, 3);
    const LH = 4.2, li = fl(sj / LH), lf = sj / LH - li;
    const lh = ih(li, 77, 1), lh2 = ih(li, 78, 2);
    const big = fl((sw + 9 * fbm1(X / 80, 8, 2)) / 31); // great bands, where the fluting jogs
    // great fluted columns, lit from the right; their width changes from band to band
    const cw = 13 + 16 * fbm1(X / 140, 23, 2);
    const xw = X + (fbm2(X / 50, Y / 110, 15, 3) - 0.5) * 22 + (ih(big, 4, 9) - 0.5) * 3;
    const c1 = cell1(xw / cw, 11), u1 = c1.u, id1 = c1.id;
    let sh = Math.pow(u1, 0.8);
    if (u1 > 0.86) sh = lerp(1.05, 0.55, (u1 - 0.86) / 0.14); // rounded edge rolling away from the light
    const cr1 = u1 < 0.06 ? 1 - u1 / 0.06 : 0;              // shadowed crevice where the next column starts
    // smaller flutes inside
    const c2 = cell1((xw + 7) / 4.2, 12), u2 = c2.u;
    const sh2 = Math.pow(u2, 0.7) - 0.5;
    const st = fbm2(X / 0.9, Y / 14, 9, 3);       // melt streaks, all running down
    const blot = fbm2(X / 25, Y / 30, 10, 4);       // large clouding inside the ice
    let v = 0.25;
    v += 0.38 * sh + (ih(id1, big, 21) - 0.5) * 0.16;
    v += 0.06 * sh2 + (st - 0.5) * 0.18 + (blot - 0.5) * 0.24;
    v += (lh - 0.5) * 0.07;
    v += 0.3 * yr - 0.14 * sstep(0.3, 0, yr);
    // a few great dirty bands, laid down in bad centuries
    const gb = frac((sw + 4 * fbm1(X / 120, 19, 2)) / 37 + 0.3);
    if (gb < 0.05) v -= 0.16 * Math.sin(PI * gb / 0.05);
    else if (gb > 0.05 && gb < 0.07) v += 0.08;
    v -= 0.32 * cr1;
    // seams and snow ledges between courses
    if (lf < 0.09 && lh2 < 0.35) v -= 0.18 * (1 - lf / 0.09);
    if (lf > 0.88 && lh2 > 0.62) v += 0.22 * (lf - 0.88) / 0.12 * (0.4 + sh);
    // the old block courses, faint where the face is less worn
    const keep = sstep(0.55, 0.72, fbm2(X / 60, Y / 45, 13, 3));
    if (keep > 0) {
      const bl = 10 + 12 * ih(li, 5, 3), bx = (X + ih(li, 6, 3) * 40) / bl, bf = bx - fl(bx);
      if (bf < 0.3 / bl) v -= 0.12 * keep;
      if (lf < 0.05) v -= 0.08 * keep;
    }
    // grit and stones in the dirty courses
    if (lh < 0.2) {
      const dh = ih(fl(X / 1.4), fl(Y / 1.1), 5);
      if (dh < 0.07) v = 0.06 + dh;
      else v -= 0.06;
    }
    for (let k = 0; k < DEBRIS.length; k++) {
      const o = DEBRIS[k], dx = (X - o.x) / o.rx, dy = (Y - o.y) / o.ry;
      const rr = dx * dx + dy * dy;
      if (rr < 1) v = lerp(v, o.v, sstep(1, 0.5, rr));
    }
    // crest: a cornice of snow with its shadow under it
    const dt = crest(X) - Y;
    if (dt < 1.4) v = 0.95 - 0.06 * dt;
    else if (dt < 3.6) v -= 0.34;
    return v;
  }
  function wallRGB(X, Y) {
    const v = wallVal(X, Y);
    const c = ramp(ICE, v);
    // apron of banked snow at the foot
    const ap = apron(X) - Y;
    if (ap > 0) {
      const s = 0.62 + 0.18 * fbm2(X / 9, Y / 2.5, 51, 3) - 0.1 * sstep(0, 3, ap);
      const g = ramp(ICE, s);
      return [g[0], g[1], g[2]];
    }
    return [c[0], c[1], c[2]];
  }
  const PATH = { x0: 0, z0: 0, x1: 0, z1: 0 };
  function groundRGB(X, Z, dist) {
    // wind-packed snow: long low drifts with a lit and a shadowed flank, and sharp wind-carved ridges
    const hgt = (x, z) => fbm2(x / 46, z / 14, 61, 4) + 0.18 * (1 - Math.abs(2 * fbm2(x / 14 + z / 30, z / 5, 71, 3) - 1));
    const e = 0.6;
    const sl = (hgt(X + e, Z) - hgt(X - e, Z)) * 5.5 + (hgt(X, Z + e) - hgt(X, Z - e)) * 2.6;
    let v = 0.7 + clamp(sl, -0.32, 0.22) + (hgt(X, Z) - 0.5) * 0.14;
    // a trodden track to the gate
    const px = PATH.x1 - PATH.x0, pz = PATH.z1 - PATH.z0, pl = px * px + pz * pz;
    if (pl > 0) {
      const h = clamp(((X - PATH.x0) * px + (Z - PATH.z0) * pz) / pl, 0, 1);
      const dx = X - PATH.x0 - px * h, dz = Z - PATH.z0 - pz * h, dd = Math.sqrt(dx * dx + dz * dz);
      const wob = 0.4 * Math.sin(Z * 0.21);
      if (dd < 1.5 + wob) v -= 0.12 + 0.06 * (ih(fl(X * 1.5), fl(Z * 1.2), 88) < 0.3 ? 1 : 0);
      else if (dd < 2.1 + wob) v += 0.05;
    }
    // the shadow of the wall reaching out over the snow
    v -= 0.14 * sstep(DW - 40, DW, Z);
    const c = ramp(ICE, v);
    return [c[0], c[1], c[2]];
  }

  // cracks: wandering polylines on the face, in metres
  const CRACKS = [];
  function buildCracks(xL, xR) {
    // ice fractures: long straight runs that kink sharply, a few short spurs
    for (let c = 0; c < 9; c++) {
      const u = Math.pow(ih(c, 1, 600), 1.5);
      const down = ih(c, 6, 600) < 0.4;
      let X = lerp(xL, xR, u), Y = down ? crest(X) - 3 : lerp(0, HW * 0.55, ih(c, 2, 600));
      const len = fl(lerp(6, 22, ih(c, 3, 600)));
      let ang = (ih(c, 4, 600) - 0.5) * 0.5;
      const pts = [[X, Y]];
      for (let k = 0; k < len; k++) {
        ang = clamp(ang + (ih(c, k, 601) - 0.5) * 0.9, -0.6, 0.6);
        const sl = 3 + 6 * ih(c, k, 602);
        X += Math.sin(ang) * sl; Y += (down ? -1 : 1) * Math.cos(ang) * sl;
        if (Y < 1 || Y > HW - 2) break;
        pts.push([X, Y]);
        if (ih(c, k, 603) < 0.08) {
          const bp = [[X, Y]];
          let bxx = X, byy = Y, ba = ang + (ih(c, k, 604) < 0.5 ? -1 : 1) * (0.6 + 0.6 * ih(c, k, 605));
          const bl = 2 + fl(ih(c, k, 606) * 3);
          for (let q = 0; q < bl; q++) { const l = 2 + 4 * ih(q, k, 607); ba += (ih(q, k, 608) - 0.5) * 0.6; bxx += Math.sin(ba) * l; byy += (down ? -1 : 1) * Math.cos(ba) * l; bp.push([bxx, byy]); }
          CRACKS.push({ pts: bp, major: false, trunk: c, at: k / len, br: true });
        }
      }
      CRACKS.push({ pts, major: ih(c, 5, 600) < 0.6, trunk: c, at: 0, br: false });
    }
  }

  function paint() {
    buildLUT();
    TA = table(1100, 4, 5, 0.55); // clouds
    TB = table(1200, 4, 5, 0.6);  // gust sheets and fog
    TC = table(1300, 8, 4, 0.55); // ground drift
    TD = table(1400, 2, 5, 0.6);  // big slow fog banks

    // visible span of the face
    const xL = xAtScreen(-60, 0), xR = xAtScreen(W + 10, 0);
    // debris frozen into the ice, in the near half of the face
    for (let k = 0; k < 34; k++) {
      const u = Math.pow(ih(k, 1, 700), 1.7);
      const big = ih(k, 2, 700) < 0.2;
      DEBRIS.push({ x: lerp(xL, xL + (xR - xL) * 0.25, u), y: lerp(10, HW - 20, ih(k, 3, 700)), rx: big ? 3 + ih(k, 4, 700) * 3 : 0.8 + ih(k, 4, 700) * 1.6, ry: big ? 1.5 + ih(k, 5, 700) * 2 : 0.6 + ih(k, 5, 700), v: 0.06 + ih(k, 6, 700) * 0.12 });
    }
    buildCracks(xL, lerp(xL, xR, 0.12));

    const sky = [], grd = [];
    const SS = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
    PATH.x0 = 40; PATH.z0 = 25; PATH.x1 = 104 + 15 + 14; PATH.z1 = DW;
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const i = py * W + px;
      const d = ray(px + 0.5, py + 0.5);
      let type = 0, dist = 0;
      if (d[2] > 0) {
        const t = DW / d[2], X = t * d[0], Y = HC + t * d[1];
        if (Y >= 0 && Y <= crest(X)) { type = 1; dist = t * Math.hypot(d[0], d[1], d[2]); }
      }
      if (type === 0 && d[1] < 0) {
        const t = HC / -d[1], Z = t * d[2];
        if (Z < DW) { type = 2; dist = t * Math.hypot(d[0], d[1], d[2]); }
      }
      TYPE[i] = type; DEP[i] = dist;
      if (type === 0) { sky.push(i); continue; }
      let r = 0, g = 0, b = 0, n = 0;
      for (const [ox, oy] of SS) {
        const e = ray(px + ox, py + oy);
        if (type === 1) {
          if (e[2] <= 0) continue;
          const t = DW / e[2], X = t * e[0], Y = HC + t * e[1];
          if (Y < 0 || Y > crest(X) + 0.5) continue;
          const c = wallRGB(X, Math.max(0, Y));
          r += c[0]; g += c[1]; b += c[2]; n++;
        } else {
          if (e[1] >= 0) continue;
          const t = HC / -e[1], X = t * e[0], Z = Math.min(DW, t * e[2]);
          const c = groundRGB(X, Z, t);
          r += c[0]; g += c[1]; b += c[2]; n++;
        }
      }
      if (!n) { const c = type === 1 ? ramp(ICE, 0.9) : ramp(ICE, 0.6); r = c[0]; g = c[1]; b = c[2]; n = 1; }
      BR[i] = r / n; BG[i] = g / n; BB[i] = b / n;
      if (type === 2) {
        const t = HC / -d[1];
        const wx = t * d[0], wz = t * d[2];
        GL[i] = wx * RT[0] + wz * RT[2];
        GD[i] = wx * FWD[0] + (-HC) * FWD[1] + wz * FWD[2];
        grd.push(i);
      }
    }
    SKYI = Int32Array.from(sky); GRDI = Int32Array.from(grd);
    for (let x = 0; x < W; x++) { let y = 0; while (y < H && TYPE[y * W + x] !== 1) y++; COLTOP[x] = y; }

    // static sky: deep slate, a little lighter low down and toward a hidden moon at upper right
    for (const i of SKYI) {
      const x = i % W, y = (i / W) | 0;
      const mo = Math.exp(-((x - 222) * (x - 222) + (y - 46) * (y - 46)) / 4200) + 0.6 * Math.exp(-((x - 222) * (x - 222) + (y - 46) * (y - 46)) / 300);
      const lo = sstep(60, 260, y);
      BR[i] = 0.06 + 0.08 * lo + 0.2 * mo; BG[i] = 0.08 + 0.1 * lo + 0.25 * mo; BB[i] = 0.14 + 0.13 * lo + 0.3 * mo;
    }

    // cracks: dark cores with a lit lip, and a halo map for the light that runs through them
    const core = [];
    CRACKS.forEach((cr, ci) => {
      let L = 0; const seg = [0];
      for (let k = 1; k < cr.pts.length; k++) { L += Math.hypot(cr.pts[k][0] - cr.pts[k - 1][0], cr.pts[k][1] - cr.pts[k - 1][1]); seg.push(L); }
      for (let k = 1; k < cr.pts.length; k++) {
        const a = proj(cr.pts[k - 1][0], cr.pts[k - 1][1], DW), ax = a.x, ay = a.y, az = a.z;
        const b = proj(cr.pts[k][0], cr.pts[k][1], DW), bx = b.x, by = b.y;
        const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 1.5));
        const thick = cr.major && F / az > 1.15;
        for (let q = 0; q <= n; q++) {
          const f = q / n, x = fl(lerp(ax, bx, f)), y = fl(lerp(ay, by, f));
          if (x < 0 || x >= W || y < 0 || y >= H) continue;
          const i = y * W + x;
          if (TYPE[i] !== 1) continue;
          const s = cr.br ? cr.at + 0.3 * lerp(seg[k - 1], seg[k], f) / L : lerp(seg[k - 1], seg[k], f) / L;
          core.push([x, y, cr.trunk, s, cr.br ? 0.6 : 1]);
          BR[i] *= 0.28; BG[i] *= 0.32; BB[i] *= 0.42;
          if (thick && x + 1 < W && TYPE[i + 1] === 1) { BR[i + 1] *= 0.45; BG[i + 1] *= 0.5; BB[i + 1] *= 0.6; }
          if (x > 0 && TYPE[i - 1] === 1) { BR[i - 1] = Math.min(1, BR[i - 1] * 1.25 + 0.05); BG[i - 1] = Math.min(1, BG[i - 1] * 1.2 + 0.06); BB[i - 1] = Math.min(1, BB[i - 1] * 1.12 + 0.06); }
        }
      }
    });
    CRD.fill(99);
    const RH = 5;
    for (const [x, y, ci, s, w] of core) {
      for (let dy = -RH; dy <= RH; dy++) for (let dx = -RH; dx <= RH; dx++) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
        const i = Y * W + X;
        if (TYPE[i] !== 1) continue;
        const dd = Math.sqrt(dx * dx + dy * dy) / w;
        if (dd < CRD[i]) { CRD[i] = dd; CRK[i] = ci; CRS[i] = s; }
      }
    }
    const vi = [];
    for (let i = 0; i < NP; i++) if (CRK[i] >= 0 && CRD[i] <= RH) vi.push(i);
    VEINI = Int32Array.from(vi);

    paintStair();
    buildMovers();
  }

  /* ---------------------------------------------------------------- the scaffold stair */
  const STAIR = []; // polyline of the walking path in metres: [X, Y]
  let STAIRLEN = 0; const STAIRCUM = [];
  function blendPx(x, y, r, g, b, a) {
    x = fl(x); y = fl(y);
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = y * W + x;
    BR[i] += (r - BR[i]) * a; BG[i] += (g - BG[i]) * a; BB[i] += (b - BB[i]) * a;
  }
  function lineW(X0, Y0, X1, Y1, Z, fn) {
    const a = proj(X0, Y0, Z), ax = a.x, ay = a.y, az = a.z;
    const b = proj(X1, Y1, Z), bx = b.x, by = b.y;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 1.2));
    for (let q = 0; q <= n; q++) { const f = q / n; fn(lerp(ax, bx, f), lerp(ay, by, f), F / az); }
  }
  function paintStair() {
    const Xc = 104;
    const LF = 30, RISE = 13, LAND = 2.5;
    const NF = Math.floor((HW - 6) / RISE);
    const xa = Xc - LF / 2, xb = Xc + LF / 2;
    const ZS = DW - 2.5;
    STAIR.push([xa - LAND, 0]);
    for (let k = 0; k < NF; k++) {
      const y0 = k * RISE, y1 = y0 + RISE;
      const from = k % 2 ? xb : xa, to = k % 2 ? xa : xb, dir = k % 2 ? -1 : 1;
      STAIR.push([from, y0], [to, y1], [to + dir * LAND, y1]);
    }
    STAIRCUM.push(0);
    for (let k = 1; k < STAIR.length; k++) { STAIRLEN += Math.hypot(STAIR[k][0] - STAIR[k - 1][0], STAIR[k][1] - STAIR[k - 1][1]); STAIRCUM.push(STAIRLEN); }
    // scaffold: a post under each end of every flight and one in the middle, down to the flight below
    for (let k = 1; k < NF; k++) {
      const y0 = k * RISE, from = k % 2 ? xb : xa, to = k % 2 ? xa : xb;
      for (const s of [0, 1]) {
        const X = lerp(from, to, s), Yt = y0 + RISE * s;
        const pf = (k - 1) % 2 ? xb : xa, pt = (k - 1) % 2 ? xa : xb;
        const sb = (X - pf) / (pt - pf), Yb = (k - 1) * RISE + RISE * sb;
        lineW(X, Yt - 0.4, X, Yb + 0.4, ZS + 0.8, (x, y, sc) => blendPx(x, y, 0.1, 0.08, 0.08, 0.36));
      }
    }
    for (let k = 1; k < STAIR.length; k++) {
      const a = STAIR[k - 1], b = STAIR[k];
      let n = 0;
      lineW(a[0], a[1], b[0], b[1], ZS, (x, y, sc) => {
        n++;
        blendPx(x, y, 0.09, 0.065, 0.06, 0.9);
        if (sc > 1.2) blendPx(x, y + 1, 0.11, 0.08, 0.07, 0.45);
        // snow on the treads, broken into steps
        blendPx(x, y - 1, 0.86, 0.91, 0.96, (sc > 0.9 ? 0.7 : 0.4) * ((n >> 1) & 1 ? 1 : 0.55));
        // a hand rail on the outer edge
        if (sc > 1.0 && (n & 3) === 0) blendPx(x, y - 2, 0.12, 0.1, 0.1, 0.45);
      });
    }
    // a gate at the foot of the stair, warm inside
    const g0 = proj(xb + 14, apron(xb + 14) - 1.5, DW), gs = F / g0.z;
    const gw = Math.max(2, Math.round(3.5 * gs)), gh = Math.max(3, Math.round(7 * gs));
    GATE.x = Math.round(g0.x); GATE.y = Math.round(g0.y); GATE.w = gw; GATE.h = gh;
    for (let y = 0; y < gh; y++) for (let x = -gw; x <= gw; x++) {
      const arch = y > gh - gw ? Math.sqrt(Math.max(0, 1 - Math.pow((y - (gh - gw)) / gw, 2))) * gw : gw;
      if (Math.abs(x) > arch) continue;
      blendPx(GATE.x + x, GATE.y - y, 0.03, 0.025, 0.03, 1);
    }
  }
  const GATE = { x: 0, y: 0, w: 0, h: 0 };

  /* ---------------------------------------------------------------- movers */
  const SNOW = []; // layers
  const SD = { n: 0 }, SRC = [];
  const CREST_T = [], STAIR_T = [];
  let MARCH = [];
  function buildMovers() {
    const layer = (cnt, nx, ny, kind, a0, a1, sz0, sz1, wob, gust, salt) => {
      const L = { cnt, kind, X0: new Float32Array(cnt), Y0: new Float32Array(cnt), NX: new Float32Array(cnt), NY: new Float32Array(cnt), WA: new Float32Array(cnt), WF: new Float32Array(cnt), WP: new Float32Array(cnt), TH: new Float32Array(cnt), AL: new Float32Array(cnt), SZ: new Float32Array(cnt), gust, MX: 0, MY: 0 };
      L.MX = kind === 3 ? 40 : 14; L.MY = kind === 3 ? 30 : 10;
      for (let k = 0; k < cnt; k++) {
        L.X0[k] = ih(k, 1, salt) * (W + 2 * L.MX);
        L.Y0[k] = ih(k, 2, salt) * (H + 2 * L.MY);
        L.NX[k] = nx[fl(ih(k, 3, salt) * nx.length)];
        L.NY[k] = ny[fl(ih(k, 4, salt) * ny.length)];
        L.WA[k] = wob * (0.4 + ih(k, 5, salt));
        L.WF[k] = 2 + fl(ih(k, 6, salt) * 6);
        L.WP[k] = ih(k, 7, salt) * TAU;
        L.TH[k] = ih(k, 8, salt);
        L.AL[k] = lerp(a0, a1, ih(k, 9, salt));
        L.SZ[k] = lerp(sz0, sz1, ih(k, 10, salt));
      }
      SNOW.push(L);
    };
    layer(3200, [1, 2, 2], [0, 1], 0, 0.18, 0.42, 1, 1, 3, 4, 900);
    layer(1500, [4, 5], [1, 1, 2], 1, 0.45, 0.8, 1, 1, 4, 10, 910);
    layer(520, [8, 9, 10], [2, 3], 2, 0.6, 0.95, 1, 1.6, 6, 16, 920);
    layer(40, [16, 18, 20], [3, 4, 5], 3, 0.3, 0.5, 0.9, 1.9, 10, 0, 930);

    // spindrift: particles torn off the crest
    // spindrift: streamers torn off the crest. Each source sends a steady train of particles along
    // one path, so the train reads as a single plume that swells with the gusts.
    const NS = 34, PER = 40, N = NS * PER;
    SD.n = N; SD.PX = new Float32Array(N); SD.PY = new Float32Array(N); SD.SC = new Float32Array(N); SD.XW = new Float32Array(N);
    SD.PH = new Float32Array(N); SD.K = new Float32Array(N); SD.A = new Float32Array(N); SD.U = new Float32Array(N); SD.V = new Float32Array(N); SD.C = new Float32Array(N); SD.J = new Float32Array(N);
    const sx0 = Math.max(0, xScreenCrestEnter()), sx1 = W + 6;
    for (let j = 0; j < NS; j++) {
      const sx = lerp(sx0, sx1, Math.pow((j + ih(j, 1, 950)) / NS, 0.9));
      const X = xAtCrestScreen(sx);
      const p = proj(X, crest(X) + 0.3, DW + 1);
      const kk = [5, 6, 8][fl(ih(j, 3, 950) * 3)], u0 = 22 + 16 * ih(j, 5, 950), v0 = 5 + 8 * ih(j, 6, 950), a0 = 0.35 + 0.4 * ih(j, 4, 950), c0 = ih(j, 7, 950) * TAU;
      SRC.push({ x: p.x, y: p.y, sc: F / p.z, X, kk, u: u0, v: v0, a: a0, c: c0, f1: 3 + fl(ih(j, 10, 950) * 4), f2: 9 + fl(ih(j, 11, 950) * 5) });
      for (let q = 0; q < PER; q++) {
        const k = j * PER + q;
        SD.PX[k] = p.x + (ih(k, 8, 950) - 0.5) * 1.5; SD.PY[k] = p.y; SD.SC[k] = F / p.z; SD.XW[k] = X;
        SD.PH[k] = (q + 0.5 * ih(k, 2, 950)) / PER; SD.K[k] = kk;
        SD.A[k] = a0 * (0.6 + 0.4 * ih(k, 4, 950));
        SD.U[k] = u0 * (0.85 + 0.3 * ih(k, 5, 950)); SD.V[k] = v0 * (0.7 + 0.6 * ih(k, 6, 950)); SD.C[k] = c0; SD.J[k] = (ih(k, 9, 950) - 0.5);
      }
    }

    // crest torches: braziers that stay put and patrols that walk
    const cx0 = Math.max(4, xScreenCrestEnter() + 4);
    for (let k = 0; k < 16; k++) {
      const sx = lerp(cx0, W - 8, Math.pow((k + 0.35 * ih(k, 1, 960)) / 16, 1.25));
      const X = xAtCrestScreen(sx);
      const walk = ih(k, 2, 960) < 0.6;
      CREST_T.push({ X, walk, amp: walk ? 10 + 16 * ih(k, 3, 960) : 0, ph: ih(k, 4, 960) * TAU, kk: ih(k, 5, 960) < 0.7 ? 1 : 2, fl: k * 7 + 3, n: walk && ih(k, 6, 960) < 0.4 ? 2 : 1 });
    }
    // stair climbers: trains spaced so that each train moves exactly one spacing per loop
    const trains = [[5, 1, 1], [6, -1, 2]]; // [count along stair, direction, torches per party]
    trains.forEach(([n, dir, per], ti) => {
      for (let k = 0; k < n; k++) STAIR_T.push({ s0: (k + ih(ti, 1, 970)) / n, sp: dir / n, per, fl: ti * 31 + k * 5, off: ti * 0.37 });
    });
    // the column in the far snow
    const P0 = { X: 0, Z: 0 }, P1 = { X: 0, Z: 0 };
    MARCH = buildMarch(P0, P1);
  }
  function xScreenCrestEnter() {
    // screen x where the crest line first enters the frame from the top
    for (let x = 0; x < W; x++) if (COLTOP[x] > 1) return x;
    return W;
  }
  function xAtCrestScreen(sx) {
    let a = 40, b = 30000;
    for (let k = 0; k < 60; k++) { const m = (a + b) / 2; if (proj(m, crest(m), DW).x < sx) a = m; else b = m; }
    return (a + b) / 2;
  }
  const MREP = 6;
  function buildMarch() {
    // a column walking along the foot of the wall out of the far white, in ground metres
    const figs = [];
    // one irregular pattern of figures, repeated MREP times along the path; each figure walks one
    // repeat per loop, so the column as a whole is the same at t = 0 and t = D
    const pat = [];
    let o = 0;
    for (let k = 0; k < 6; k++) { o += 0.08 + 0.2 * ih(k, 1, 980) + (ih(k, 5, 980) < 0.3 ? 0.25 : 0); pat.push(o); }
    for (let r = 0; r < MREP; r++) pat.forEach((q, k) => figs.push({ off: (r + q / (o + 0.2)) / MREP, lane: (ih(k + r * 7, 2, 980) - 0.5) * 4, tall: ih(k + r * 7, 3, 980) < 0.3, eyes: ih(k + r * 7, 4, 980) < 0.2 }));
    return figs;
  }

  /* ================================================================ per-frame */
  const R = new Float32Array(NP), G = new Float32Array(NP), B = new Float32Array(NP), FOG = new Float32Array(NP);
  function px(x, y, r, g, b, a) {
    x |= 0; y |= 0;
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
    const i = y * W + x;
    if (a > 1) a = 1;
    R[i] += (r - R[i]) * a; G[i] += (g - G[i]) * a; B[i] += (b - B[i]) * a;
  }
  function add(x, y, r, g, b) {
    x |= 0; y |= 0;
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = y * W + x;
    R[i] += r; G[i] += g; B[i] += b;
  }
  const flick = (id, t) => { const s = fl(t * 12); return 0.75 + 0.25 * ih(id, s % (12 * D), 990) + 0.15 * Math.sin(TAU * (3 * t / D) + id); };

  function render(t) {
    t = ((t % D) + D) % D;
    const tau = tauOf(t), spd = spdOf(t), env = envOf(t);
    const vis = clamp(1 - env * 1.9, 0, 1); // how far one can see
    R.set(BR); G.set(BG); B.set(BB);

    /* ---- storm sky */
    const c1 = 256 * 1 * tau / D, c2 = 256 * 3 * tau / D;
    for (let k = 0; k < SKYI.length; k++) {
      const i = SKYI[k], x = i % W, y = (i / W) | 0;
      const n1 = samp(TA, x * 0.42 - c1 - y * 0.25, y * 0.62);
      const n2 = samp(TA, x * 1.1 - c2 + 90, y * 1.9 - x * 0.35 + 40);
      const cl = sstep(0.3, 0.85, n1 * 0.7 + n2 * 0.3);
      const rim = sstep(0.55, 0.9, n2) * (1 - cl) * 0.5;
      const m = 0.55 + 0.75 * cl;
      R[i] = R[i] * m + rim * 0.07 + cl * 0.05; G[i] = G[i] * m + rim * 0.09 + cl * 0.06; B[i] = B[i] * m + rim * 0.12 + cl * 0.08;
    }

    /* ---- ground drift: snow snaking over the field */
    const cg = 256 * 1 * tau / D;
    for (let k = 0; k < GRDI.length; k++) {
      const i = GRDI[k];
      const n = samp(TC, GL[i] * 1.2 - cg, GD[i] * 1.6);
      const n2 = samp(TC, GL[i] * 0.35 - cg * 0.5 + 77, GD[i] * 0.5 + 31);
      const a = sstep(0.5, 0.85, n) * (0.25 + 0.35 * spd) * (0.6 + 0.5 * n2);
      R[i] += (0.9 - R[i]) * a; G[i] += (0.94 - G[i]) * a; B[i] += (0.98 - B[i]) * a;
    }

    /* ---- light running up the cracks */
    for (let k = 0; k < VEINI.length; k++) {
      const i = VEINI[k], c = CRK[i], s = CRS[i], d = CRD[i];
      const kk = 1 + (ih(c, 1, 1010) < 0.35 ? 1 : 0), ph = ih(c, 2, 1010);
      const u = frac(kk * t / D + ph);             // where this crack is in its cycle
      const life = 0.32;
      if (u > life) continue;
      const pr = u / life, front = pr * 1.6 - 0.2;
      const x = front - s;
      let I = x < 0 ? Math.exp(x * 14) : Math.exp(-x * 3.2);
      I *= Math.sin(PI * pr) * (ih(c, 3, 1010) < 0.5 ? 1 : 0.7);
      const fall = d < 0.6 ? 1 : Math.exp(-(d - 0.6) * 0.75) * 0.5;
      const e = I * fall;
      if (e < 0.01) continue;
      R[i] += e * 0.45; G[i] += e * 0.85; B[i] += e * 1.0;
    }

    /* ---- fog: thick, moving, fed by gust sheets */
    const cf1 = 256 * 2 * tau / D, cf2 = 256 * 1 * tau / D;
    const rho0 = 0.0021 * (0.55 + 1.05 * env);
    for (let y = 0, i = 0; y < H; y++) {
      const yb = y * 0.55, ys = y * 1.1, ob = -cf2 - y * 0.15, os = -cf1 - y * 0.12;
      for (let x = 0; x < W; x++, i++) {
        const nb = samp(TD, x * 0.5 + ob, yb);
        const ns = samp(TB, x * 0.28 + os, ys);
        let f;
        if (TYPE[i] === 0) f = 0.18 + 0.4 * env * nb;
        else f = 1 - Math.exp(-DEP[i] * rho0 * (0.45 + 1.1 * nb) * (0.7 + 0.6 * ns));
        FOG[i] = f;
        const fr = 0.27 + 0.12 * nb + 0.05 * ns, fg = 0.35 + 0.13 * nb + 0.05 * ns, fb = 0.5 + 0.13 * nb + 0.05 * ns;
        R[i] += (fr - R[i]) * f; G[i] += (fg - G[i]) * f; B[i] += (fb - B[i]) * f;
      }
    }

    /* ---- what waits in the far snow */
    drawBeyond(t, vis, env);

    /* ---- torches */
    drawTorches(t);

    /* ---- gust sheets: travelling bands of driven snow */
    const cv1 = 256 * 5 * tau / D, cv2 = 256 * 8 * tau / D;
    const va = 0.16 + 0.34 * env;
    for (let y = 0, i = 0; y < H; y++) {
      const o1 = -cv1 - y * 0.2 + 50, y1 = y * 1.6 + 120, o2 = -cv2 - y * 0.3 + 10, y2 = y * 2.6 + 200;
      for (let x = 0; x < W; x++, i++) {
        const a1 = samp(TB, x * 0.55 + o1, y1);
        if (a1 < 0.5) { const a2 = samp(TA, x * 0.9 + o2, y2); if (a2 < 0.62) continue; }
        const a2 = samp(TA, x * 0.9 + o2, y2);
        const a = va * (sstep(0.5, 0.92, a1) * 0.75 + sstep(0.62, 0.95, a2) * 0.5);
        if (a > 0.004) { R[i] += (0.8 - R[i]) * a; G[i] += (0.86 - G[i]) * a; B[i] += (0.93 - B[i]) * a; }
      }
    }

    /* ---- spindrift off the crest: a streaming veil hugging the top, and plumes torn from it */
    const ck = 256 * 6 * tau / D;
    for (let x = 0; x < W; x++) {
      const yt = COLTOP[x];
      if (yt <= 0) continue;
      const scl = 1.25 - 0.9 * x / W; // nearer crest, thicker veil
      for (let d = -10; d < 30; d++) {
        const y = yt - 1 - d;
        if (y < 0 || y >= H) continue;
        const dd = d / scl;
        const n = samp(TB, x * 0.45 - ck + dd * 0.8 + 30, dd * 0.9 + 80);
        const n2 = samp(TA, x * 1.2 - ck * 1.6 + dd * 1.4, dd * 2.2 + 140);
        let a = (d < 0 ? Math.exp(d / (2.5 * scl)) * 0.6 : Math.exp(-dd / 7)) * sstep(0.3, 0.8, n * 0.75 + n2 * 0.35);
        a *= (0.3 + 0.55 * clamp(spd, 0, 1.6)) * 0.75;
        if (a < 0.01) continue;
        const i = y * W + x;
        R[i] += (0.85 - R[i]) * a; G[i] += (0.9 - G[i]) * a; B[i] += (0.97 - B[i]) * a;
      }
    }
    drawSpindrift(t);

    /* ---- snow */
    for (const L of SNOW) drawSnow(L, t, tau, env);

    quantize();
  }

  function drawBeyond(t, vis, env) {
    // the cold glow: low on the right, where the wall goes into the white
    const gl = clamp(1 - env * 1.4, 0, 1) * (0.75 + 0.25 * Math.sin(TAU * 2 * t / D + 1.3));
    if (gl > 0.01) {
      const gx = 266, gy = 255;
      for (let y = 200; y < 300; y++) for (let x = 150; x < W; x++) {
        const dx = (x - gx) / 92, dy = (y - gy) / (y < gy ? 40 : 22), r = dx * dx + dy * dy;
        if (r > 1) continue;
        const i = y * W + x;
        const a = gl * Math.pow(1 - r, 2.2) * 0.5;
        R[i] += (0.42 - R[i]) * a * 0.8; G[i] += (0.6 - G[i]) * a * 0.9; B[i] += (0.96 - B[i]) * a;
      }
    }
    if (vis < 0.02) return;
    // a column of small dark shapes walking out of the white along the foot of the wall
    for (let k = 0; k < MARCH.length; k++) {
      const m = MARCH[k];
      const u = frac(m.off + t / D / MREP);
      const X = lerp(560, 175, u), Z = lerp(-20, 72, u) + m.lane;
      const p = proj(X, 0, Z);
      const sc = F / p.z;
      const hpx = clamp(Math.round(1.9 * sc * 1.5), 2, 3);
      const edge = Math.sin(PI * u);
      const a = vis * clamp(edge * 1.6, 0, 1) * 0.85;
      if (a < 0.03) continue;
      const x = Math.round(p.x), y = Math.round(p.y);
      const step = (fl(t * 3 + m.off * 37) & 1);
      const dr = 0.05, dg = 0.06, db = 0.1;
      for (let j = 1; j < hpx; j++) px(x, y - j, dr, dg, db, a);
      px(x - (step ? 1 : 0), y, dr, dg, db, a * 0.9);
      if (step) px(x + 1, y, dr, dg, db, a * 0.7);
      if (m.tall) px(x + 1, y - hpx, dr, dg, db, a * 0.6);
      if (m.eyes) add(x, y - hpx + 1, 0.25 * a, 0.45 * a, 0.7 * a);
    }
    // and farther, right at the foot, only pinpoints and the hint of a line of them
    for (let k = 0; k < 40; k++) {
      const u = frac(ih(k, 1, 985) + t / D / 5);
      const X = lerp(1600, 600, u), Z = DW - 6 - 10 * ih(k, 2, 985);
      const p = proj(X, 0, Z);
      const x = Math.round(p.x), y = Math.round(p.y);
      const a = vis * Math.sin(PI * u) * 0.6;
      if (a < 0.03) continue;
      px(x, y, 0.1, 0.12, 0.2, a); px(x, y - 1, 0.1, 0.12, 0.2, a * 0.8);
      if (ih(k, 3, 985) < 0.3) add(x, y - 1, 0.18 * a, 0.32 * a, 0.55 * a);
    }
  }

  function torchAt(x, y, I, id, t, big) {
    const f = flick(id, t) * I;
    if (f < 0.02) return;
    add(x, y, 0.75 * f, 0.5 * f, 0.22 * f);
    px(x, y, 1, 0.86, 0.55, f);
    const g = 0.3 * f;
    px(x - 1, y, 0.95, 0.5, 0.15, g); px(x + 1, y, 0.95, 0.5, 0.15, g);
    px(x, y - 1, 1, 0.6, 0.2, g * 1.3); px(x, y + 1, 0.8, 0.4, 0.12, g * 0.6);
    if (big) {
      px(x, y - 2, 1, 0.55, 0.15, g * 0.6);
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const r = dx * dx + dy * dy; if (r < 2 || r > 18) continue;
        const k = f * (1 - r / 19) * 0.11;
        add(x + dx, y + dy, k, k * 0.5, k * 0.14);
      }
    }
  }
  function drawTorches(t) {
    for (let k = 0; k < CREST_T.length; k++) {
      const c = CREST_T[k];
      for (let q = 0; q < c.n; q++) {
        const X = c.X + c.amp * Math.sin(TAU * c.kk * t / D + c.ph) + q * 2.2;
        const p = proj(X, crest(X) + 1.4, DW - 1);
        const x = Math.round(p.x), y = Math.round(p.y);
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const fog = FOG[y * W + x];
        torchAt(x, y, clamp(1.05 - fog * 0.85, 0.15, 1), c.fl + q, t, F / p.z > 0.6);
      }
    }
    for (let k = 0; k < STAIR_T.length; k++) {
      const c = STAIR_T[k];
      for (let q = 0; q < c.per; q++) {
        const s = frac(c.s0 + c.sp * t / D) - q * 0.006;
        const fade = sstep(0, 0.04, s) * sstep(1, 0.95, s);
        if (fade <= 0) continue;
        const L = s * STAIRLEN;
        let j = 1; while (j < STAIR.length - 1 && STAIRCUM[j] < L) j++;
        const f = (L - STAIRCUM[j - 1]) / (STAIRCUM[j] - STAIRCUM[j - 1] || 1);
        const X = lerp(STAIR[j - 1][0], STAIR[j][0], f), Y = lerp(STAIR[j - 1][1], STAIR[j][1], f);
        const p = proj(X, Y + 1.6, DW - 3);
        const x = Math.round(p.x), y = Math.round(p.y);
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        torchAt(x, y, fade * clamp(1.05 - FOG[y * W + x] * 0.8, 0.2, 1), c.fl + q, t, true);
      }
    }
    // the gate breathes a little warm light
    const gf = flick(777, t);
    for (let y = 0; y < GATE.h - 1; y++) for (let x = -GATE.w + 1; x < GATE.w; x++) {
      const a = gf * (1 - y / GATE.h) * (1 - Math.abs(x) / GATE.w);
      px(GATE.x + x, GATE.y - y, 0.9, 0.45, 0.14, a * 1.1);
    }
    for (let dy = -2; dy <= 3; dy++) for (let dx = -GATE.w - 3; dx <= GATE.w + 3; dx++) {
      const r = Math.abs(dx) / (GATE.w + 3); if (Math.abs(dx) < GATE.w && dy <= 0) continue;
      add(GATE.x + dx, GATE.y + dy, 0.05 * gf * (1 - r), 0.025 * gf * (1 - r), 0.005 * gf * (1 - r));
    }
  }

  // plume position for a source at age a (seconds) when it left the crest at te
  const PP = { x: 0, y: 0 };
  function plumeAt(S, a, te, gs) {
    const sc = S.sc;
    PP.x = S.x + sc * S.u * a * (0.55 + 0.45 * gs);
    PP.y = S.y - sc * (S.v * a - 1.4 * a * a) + sc * 2.4 * Math.sin(TAU * 2 * te / D + S.c) * a;
    return PP;
  }
  function drawSpindrift(t) {
    // continuous ribbons: every point along the plume is the snow that left the crest a seconds ago
    for (let j = 0; j < SRC.length; j++) {
      const S = SRC[j];
      const life = D / S.kk;
      const steps = Math.max(12, Math.ceil(S.sc * S.u * life * 0.9));
      for (let q = 0; q < steps; q++) {
        const a = (q + 0.5) / steps * life, te = t - a, gs = spdOf(te);
        const along = 0.5 + 0.5 * Math.sin(TAU * (S.X / 480 - 3 * te / D) + S.c * 0.3);
        const puff = sstep(0.25, 0.85, 0.5 + 0.3 * Math.sin(TAU * S.f1 * te / D + S.c) + 0.2 * Math.sin(TAU * S.f2 * te / D + 2 * S.c));
        const fade = Math.pow(1 - a / life, 1.4) * sstep(0, 0.12, a);
        const I = S.a * fade * puff * (0.3 + 0.7 * along) * (0.35 + 0.65 * clamp(gs - 0.1, 0, 1.4)) * 0.9;
        if (I < 0.01) continue;
        const p = plumeAt(S, a, te, gs);
        const r = 0.5 + 1.1 * a * Math.sqrt(S.sc);
        const x0 = fl(p.x - r), x1 = fl(p.x + r), y0 = fl(p.y - r), y1 = fl(p.y + r);
        for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
          const dx = xx + 0.5 - p.x, dy = yy + 0.5 - p.y;
          const cov = clamp(r - Math.sqrt(dx * dx + dy * dy) + 0.5, 0, 1);
          if (cov > 0) px(xx, yy, 0.86, 0.91, 0.98, I * cov / (0.6 + r * 0.5));
        }
      }
    }
    // loose grains flung off the plumes
    for (let k = 0; k < SD.n; k++) {
      const kk = SD.K[k];
      const u = frac(kk * t / D + SD.PH[k]);              // age 0..1
      const te = t - u * D / kk;                           // when it left the crest
      const gs = spdOf(te);
      const along = 0.5 + 0.5 * Math.sin(TAU * (SD.XW[k] / 480 - 3 * te / D) + SD.C[k] * 0.3);
      const a = SD.A[k] * sstep(0, 0.05, u) * Math.pow(1 - u, 1.3) * (0.3 + 0.7 * along) * (0.45 + 0.55 * clamp(gs - 0.1, 0, 1.4));
      if (a < 0.015) continue;
      const age = u * D / kk, sc = SD.SC[k];
      const spread = 1 + age * 1.4;
      const dx = sc * SD.U[k] * age * (0.55 + 0.45 * gs);
      const dy = -sc * (SD.V[k] * age - 1.3 * age * age) + sc * (2.2 * Math.sin(TAU * 2 * te / D + SD.C[k]) * age + SD.J[k] * spread * 2.2);
      px(SD.PX[k] + dx, SD.PY[k] + dy, 0.9, 0.94, 1, a);
    }
  }

  const SP = { x: 0, y: 0, bx: 0 };
  function snowPos(L, k, vx, vy, WX, WY, tt, ta) {
    const bx = L.X0[k] + vx * ta, by = L.Y0[k] + vy * ta;
    const g = L.gust * Math.sin(TAU * (bx / WX * 2 - 3 * tt / D));
    const wy = L.WA[k] * Math.sin(TAU * L.WF[k] * tt / D + L.WP[k]);
    const wx = L.WA[k] * 0.6 * Math.cos(TAU * (L.WF[k] + 1) * tt / D + L.WP[k]);
    let x = bx + g + wx, y = by + wy + 0.15 * g;
    x = ((x % WX) + WX) % WX - L.MX; y = ((y % WY) + WY) % WY - L.MY;
    SP.x = x; SP.y = y; SP.bx = bx;
  }
  function drawSnow(L, t, tau, env) {
    const WX = W + 2 * L.MX, WY = H + 2 * L.MY;
    const dt = 1 / 36, tau2 = tauOf(t - dt);
    const kind = L.kind;
    const cr = kind === 0 ? 0.72 : 0.93, cg = kind === 0 ? 0.8 : 0.96, cb = kind === 0 ? 0.9 : 1;
    const fast = spdOf(t);
    for (let k = 0; k < L.cnt; k++) {
      const vx = L.NX[k] * WX / D, vy = L.NY[k] * WY / D;
      snowPos(L, k, vx, vy, WX, WY, t, tau);
      const x = SP.x, y = SP.y, bx = SP.bx;
      const dens = clamp(0.3 + 0.7 * env + 0.22 * Math.sin(TAU * (bx / WX * 2 - 3 * t / D) - 1.2), 0, 1.2);
      const a = clamp((dens - L.TH[k]) * 5, 0, 1) * L.AL[k];
      if (a < 0.02) continue;
      if (kind <= 1) {
        px(x, y, cr, cg, cb, a);
        if (kind === 1 && vx * fast > 70) px(x - 1, y, cr, cg, cb, a * 0.4);
        continue;
      }
      snowPos(L, k, vx, vy, WX, WY, t - dt, tau2);
      let ux = x - SP.x, uy = y - SP.y;
      if (Math.abs(ux) > WX / 2 || Math.abs(uy) > WY / 2) { ux = vx * dt; uy = vy * dt; }
      if (kind === 2) {
        const len = Math.max(1, Math.round(Math.hypot(ux, uy) * 1.1));
        for (let q = 0; q <= len; q++) {
          const f = q / len;
          px(x - ux * 1.1 * (1 - f), y - uy * 1.1 * (1 - f), cr, cg, cb, a * (0.25 + 0.75 * f));
        }
        if (L.SZ[k] > 1.35) px(x + 1, y, cr, cg, cb, a * 0.5);
      } else {
        // big out-of-focus flakes close to the eye: soft capsules
        const r = L.SZ[k];
        const tx = x - ux * 0.45, ty = y - uy * 0.45;
        const x0 = fl(Math.min(x, tx) - r - 1), x1 = Math.ceil(Math.max(x, tx) + r + 1);
        const y0 = fl(Math.min(y, ty) - r - 1), y1 = Math.ceil(Math.max(y, ty) + r + 1);
        const sx = x - tx, sy = y - ty, ss = sx * sx + sy * sy || 1;
        for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
          const qx = xx + 0.5 - tx, qy = yy + 0.5 - ty;
          const h = clamp((qx * sx + qy * sy) / ss, 0, 1);
          const dx = qx - sx * h, dy = qy - sy * h, d = Math.sqrt(dx * dx + dy * dy);
          const cov = clamp(r - d + 0.5, 0, 1);
          if (cov > 0) px(xx, yy, cr, cg, cb, a * cov * (0.55 + 0.45 * h));
        }
      }
    }
  }

  /* ================================================================ present */
  let SMALL = null, SG = null, IMG = null, PIX = null;
  const VIG = new Float32Array(NP);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - W * 0.45) / (W * 0.75), dy = (y - H * 0.5) / (H * 0.7);
    VIG[y * W + x] = 1 - 0.22 * sstep(0.35, 1.1, dx * dx + dy * dy);
  }
  function quantize() {
    if (!SMALL) {
      SMALL = document.createElement('canvas'); SMALL.width = W; SMALL.height = H;
      SG = SMALL.getContext('2d'); IMG = SG.createImageData(W, H); PIX = new Uint32Array(IMG.data.buffer);
    }
    const q = LQ - 1;
    for (let y = 0; y < H; y++) {
      const row = (y & 7) << 3;
      for (let x = 0; x < W; x++) {
        const i = y * W + x, d = (B8[row | (x & 7)] - 0.5) * 0.055, vg = VIG[i];
        const r = clamp(R[i] * vg + d, 0, 1), g = clamp(G[i] * vg + d, 0, 1), b = clamp(B[i] * vg + d, 0, 1);
        PIX[i] = PAL32[LUT[((Math.round(r * q) * LQ) + Math.round(g * q)) * LQ + Math.round(b * q)]];
      }
    }
    SG.putImageData(IMG, 0, 0);
  }
  function drawFrame(t, g, cw, ch, k, ox, oy) {
    render(t);
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#04050a'; g.fillRect(0, 0, cw, ch);
    g.drawImage(SMALL, ox, oy, W * k, H * k);
  }

  /* ================================================================ mount */
  (window.PIECES = window.PIECES || []).push({
    id: 'the-wall',
    title: 'The Wall',
    medium: 'Ray-cast ice, four layers of snow, 42 colours, 270 × 338 · 20 s loop',
    note: 'Seven hundred feet of ice in a blizzard · tap to pause',
    about: 'A cliff of ancient ice seen from near its foot, looking up into a night blizzard. Snow drives sideways in four layers, from flakes close enough to blur to a fine far haze, and the storm surges and slackens in gusts that roll through as bands of white. Spindrift tears off the crest, torches patrol the top and climb a timber stair, pale light runs up the cracks, and when the snow thins, something small and dark is walking out of the north. Inspired by the novels of George R. R. Martin; an unofficial fan tribute.',
    tone: 'dark',
    room: '#04050a',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0, built = false;
      el.style.background = '#04050a';
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
      const draw = (t) => drawFrame(t, g, CW, CH, K, OX, OY);
      layout();
      if (!TA) paint();
      built = true;
      draw(0);
      if (EXPORT) {
        const faded = () => { const st = el.parentElement; return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999; };
        window.__thewall = {
          duration: D,
          isReady: () => built && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); draw(t); window.__thewall.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'the-wall';
        api.ready();
      } else {
        window.__thewall = { duration: D, isReady: () => built, renderAt(t) { return new Promise((res) => { playing = false; clock = t; draw(t); requestAnimationFrame(() => res()); }); } };
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
          if (window.__thewall) delete window.__thewall;
        },
      };
    },
  });
})();
