/* 06 — A Small Night, Mended Twice
 *
 * One tenmoku tea bowl, photographed like a treasure. The bowl is a lathe mesh
 * (a hand-authored profile revolved, then disturbed per angle the way a potter's
 * hands disturb it), shaded per pixel: a glassy clear coat over near-black glaze,
 * hare's-fur streaks, yōhen oil spots whose halos are thin-film interference,
 * gold kintsugi seams laid out in (angle, profile arc-length) space so a crack
 * runs unbroken from the outside wall, over the lip, and down into the bowl.
 * Lights are a procedural studio: softboxes are rounded rectangles in an
 * environment function, so every reflection moves correctly as the bowl turns.
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const v3n = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
  const v3x = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  /* ------------------------------------------------------------ the profile
   * (r, y) in units of the rim radius; y = 0 is the table. Walked from the
   * centre of the well, up the inside, over the lip, down the outside, round
   * the foot ring and in under the base to the axis. */
  const CTRL = [
    [0.000, 0.205], [0.070, 0.2062], [0.140, 0.2125], [0.210, 0.233], [0.300, 0.290], [0.420, 0.392],
    [0.560, 0.540], [0.700, 0.700], [0.815, 0.832], [0.890, 0.905], [0.922, 0.940], [0.934, 0.975], // 11 lip, inside
    [0.943, 1.001], [0.961, 1.014], [0.979, 1.007], [0.990, 0.985], //                                13 rim top, 15 lip outside
    [0.987, 0.958], [0.975, 0.933], [0.968, 0.905], [0.944, 0.868], [0.860, 0.768], [0.720, 0.600],
    [0.580, 0.430], [0.470, 0.300], [0.405, 0.215], [0.370, 0.165], [0.352, 0.136], //                26 end of wall
    [0.336, 0.124], [0.329, 0.100], [0.325, 0.050], [0.321, 0.012], [0.311, 0.000], [0.285, 0.000],
    [0.262, 0.000], [0.251, 0.010], [0.247, 0.040], [0.243, 0.062], [0.224, 0.071], [0.150, 0.075],
    [0.070, 0.078], [0.000, 0.080],
  ];

  function crPoint(p0, p1, p2, p3, u) { // centripetal Catmull-Rom (Barry–Goldman)
    const d = (a, b) => Math.max(1e-5, Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5));
    const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
    const t = t1 + (t2 - t1) * u;
    const L = (a, b, ta, tb) => { const k = (t - ta) / (tb - ta); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; };
    const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
    const B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
    return L(B1, B2, t1, t2);
  }

  function buildProfile() {
    const P = CTRL, n = P.length;
    const ext = [[-P[1][0], P[1][1]], ...P, [-P[n - 2][0], P[n - 2][1]]];
    const SUB = 48, dense = [], ctrlIdx = [];
    for (let i = 0; i < n - 1; i++) {
      ctrlIdx.push(dense.length);
      for (let k = 0; k < SUB; k++) dense.push(crPoint(ext[i], ext[i + 1], ext[i + 2], ext[i + 3], k / SUB));
    }
    ctrlIdx.push(dense.length); dense.push(P[n - 1].slice());
    const S = new Float64Array(dense.length);
    for (let i = 1; i < dense.length; i++) S[i] = S[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]);
    const at = (s) => { // (r, y) at arc length s
      s = clamp(s, 0, S[S.length - 1]);
      let lo = 0, hi = S.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
      const k = (s - S[lo]) / Math.max(1e-9, S[hi] - S[lo]);
      return [dense[lo][0] + (dense[hi][0] - dense[lo][0]) * k, dense[lo][1] + (dense[hi][1] - dense[lo][1]) * k];
    };
    const curv = new Float64Array(dense.length);
    for (let i = 1; i < dense.length - 1; i++) {
      const a = Math.atan2(dense[i][1] - dense[i - 1][1], dense[i][0] - dense[i - 1][0]);
      const b = Math.atan2(dense[i + 1][1] - dense[i][1], dense[i + 1][0] - dense[i][0]);
      let da = b - a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
      curv[i] = Math.abs(da) / Math.max(1e-6, 0.5 * (S[i + 1] - S[i - 1]));
    }
    const curvAt = (s) => {
      let lo = 0, hi = S.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
      let c = 0; for (let k = Math.max(0, lo - 6); k <= Math.min(S.length - 1, lo + 6); k++) c = Math.max(c, curv[k]);
      return c;
    };
    const key = ctrlIdx.map((i) => S[i]);
    // exterior: y -> s
    const sAtExtY = (y) => {
      for (let i = ctrlIdx[15]; i < ctrlIdx[26]; i++) if (dense[i][1] >= y && dense[i + 1][1] < y) {
        const k = (dense[i][1] - y) / (dense[i][1] - dense[i + 1][1]); return S[i] + (S[i + 1] - S[i]) * k;
      }
      return key[26];
    };
    return { S, total: S[S.length - 1], at, curvAt, key, sAtExtY };
  }

  /* periodic smooth functions of the angle */
  function fourier(rng, k0, K, amp, pw) {
    const a = [], p = [];
    for (let k = k0; k < k0 + K; k++) { a.push(amp * (0.55 + 0.9 * rng()) / Math.pow(k, pw)); p.push(rng() * TAU); }
    return (th) => { let v = 0; for (let i = 0; i < a.length; i++) v += a[i] * Math.cos((k0 + i) * th + p[i]); return v; };
  }
  function noise1(rng, n) { // smooth 1-D value noise on [0, 1], n knots
    const v = []; for (let i = 0; i <= n + 2; i++) v.push(rng() * 2 - 1);
    return (t) => { const x = clamp(t, 0, 1) * n; const i = Math.floor(x); const f = x - i; const u = f * f * (3 - 2 * f); return v[i] + (v[i + 1] - v[i]) * u; };
  }

  /* -------------------------------------------------------------- the bowl */
  async function buildBowl(seed, alive) {
    const rng = mulberry32(seed ^ 0x9e3779b9);
    const prof = buildProfile();
    const K = prof.key;
    const sLipIn = K[11], sRim = K[13], sLipOut = K[15], sWallEnd = K[26];

    // hand: the rim's rise and fall, ovality, a lean, a lip that wanders
    const rimDy = fourier(rng, 1, 6, 0.010, 0.9);
    const oval = fourier(rng, 2, 5, 0.011, 1.1);
    const lipWob = fourier(rng, 3, 9, 0.0035, 0.6);
    const leanA = rng() * TAU, leanM = 0.006 + 0.006 * rng();
    const lean = [Math.cos(leanA) * leanM, Math.sin(leanA) * leanM];

    // glaze line: where the glaze stopped running, with drips
    const dripBase = prof.sAtExtY(0.385 + 0.035 * rng());
    const dripWave = fourier(rng, 1, 7, 0.012, 0.7);
    const drips = [];
    const nDrips = 5 + Math.floor(rng() * 5);
    for (let i = 0; i < nDrips; i++) drips.push({ th: rng() * TAU, w: 0.035 + 0.05 * rng(), d: 0.02 + 0.11 * Math.pow(rng(), 1.3) });
    const dripW = (th) => {
      let dd = 0, wt = 0;
      for (const d of drips) {
        let x = th - d.th; x -= Math.round(x / TAU) * TAU; x /= d.w;
        if (Math.abs(x) < 3) { const b = Math.exp(-x * x * 1.6); dd = Math.max(dd, d.d * b); wt = Math.max(wt, b * Math.min(1, d.d / 0.05)); }
      }
      return [dd, wt];
    };
    const dripAt = (th) => { const [dd, wt] = dripW(th); return [dripBase + dripWave(th) + dd, 0.0048 + 0.0075 * wt]; };
    const glazeThick = (e, A) => {
      if (e <= 0) return 0;
      const edge = Math.sqrt(smooth(0, 0.005, e));
      return (0.0018 + A * Math.exp(-Math.pow((e - 0.009) / 0.0075, 2))) * edge;
    };

    // the repairs. Crack A (the first break) crosses the rim; crack B leaves a rebuilt chip.
    const thA = rng() * TAU;
    const thC = thA + (rng() < 0.5 ? -1 : 1) * (1.85 + 0.7 * rng());
    const chip = { th: thC, s: sRim + 0.004, ax: 0.075 + 0.025 * rng(), ayIn: 0.058 + 0.02 * rng(), ayOut: 0.036 + 0.014 * rng(), rad: [] };
    for (let i = 0; i < 7; i++) chip.rad.push(0.78 + 0.34 * rng());
    const chipF = (th, s) => { // signed distance (approx, in units) to the chip outline
      let dth = th - chip.th; dth -= Math.round(dth / TAU) * TAU;
      const r = prof.at(s)[0];
      const x = dth * r / chip.ax, y = (s - chip.s) / (s < chip.s ? chip.ayIn : chip.ayOut);
      const ang = Math.atan2(y, x), rr = Math.hypot(x, y);
      const u = ((ang / TAU) + 1) % 1 * 7, i0 = Math.floor(u) % 7, i1 = (i0 + 1) % 7, f = u - Math.floor(u);
      const rho = chip.rad[i0] + (chip.rad[i1] - chip.rad[i0]) * f; // facets: a conchoidal flake
      return (rr - rho) * Math.min(chip.ax, chip.ayOut) * 0.9;
    };

    /* rows: adaptive in curvature, dense through the drip zone */
    const dripLo = dripBase - 0.03, dripHi = dripBase + 0.16;
    const rows = [0];
    { let s = 0; const T = prof.total;
      while (s < T) {
        let ds = clamp(0.045 / (prof.curvAt(s) + 1e-3), 0.0024, 0.011);
        if (s > dripLo && s < dripHi) ds = Math.min(ds, 0.003);
        if (s > sLipIn - 0.04 && s < sLipOut + 0.05) ds = Math.min(ds, 0.004);
        s = Math.min(T, s + ds); rows.push(s);
      } }
    const NR = rows.length, NC = 512, NV = NC + 1;
    const pos = new Float32Array(NR * NV * 3), uv = new Float32Array(NR * NV * 2);
    const thArr = new Float64Array(NV); for (let j = 0; j < NV; j++) thArr[j] = (j / NC) * TAU;
    const colRimDy = [], colOval = [], colWob = [], colDrip = [];
    for (let j = 0; j < NV; j++) { const t = thArr[j]; colRimDy.push(rimDy(t)); colOval.push(oval(t)); colWob.push(lipWob(t)); colDrip.push(dripAt(t)); }
    for (let i = 0; i < NR; i++) {
      const s = rows[i]; const [r0, y0] = prof.at(s);
      const wUp = smooth(0.12, 1.0, y0), wTop = smooth(0.45, 1.0, y0), wLip = smooth(0.9, 1.0, y0);
      const nearRim = Math.abs(s - sRim) < 0.12;
      for (let j = 0; j < NV; j++) {
        const th = thArr[j];
        let rr = r0 * (1 + colOval[j] * Math.pow(wUp, 1.4)) + colWob[j] * wLip * (r0 > 0.5 ? 1 : 0);
        let yy = y0 + colRimDy[j] * wTop * y0;
        if (nearRim) { const f = chipF(th, s); if (f < 0.012) yy -= 0.0045 * smooth(0.012, -0.012, f) * wLip; }
        const k = (i * NV + j) * 3;
        pos[k] = rr * Math.cos(th) + lean[0] * wUp * wUp;
        pos[k + 1] = yy;
        pos[k + 2] = rr * Math.sin(th) + lean[1] * wUp * wUp;
        uv[(i * NV + j) * 2] = th; uv[(i * NV + j) * 2 + 1] = s;
      }
    }
    if (!alive()) return null;
    await nextFrame();

    // normals & s-tangents from the grid
    const nrm = new Float32Array(NR * NV * 3), tns = new Float32Array(NR * NV * 3);
    const P = (i, j) => { const k = (i * NV + j) * 3; return [pos[k], pos[k + 1], pos[k + 2]]; };
    for (let i = 0; i < NR; i++) {
      for (let j = 0; j < NV; j++) {
        const k = (i * NV + j) * 3;
        const th = thArr[j];
        const a = P(Math.max(0, i - 1), j), b = P(Math.min(NR - 1, i + 1), j);
        let ts = v3n([b[0] - a[0] + 1e-9, b[1] - a[1], b[2] - a[2]]);
        let n;
        if (i === 0) { n = [0, 1, 0]; ts = [Math.cos(th), 0, Math.sin(th)]; }
        else if (i === NR - 1) { n = [0, -1, 0]; ts = [-Math.cos(th), 0, -Math.sin(th)]; }
        else {
          const jl = j === 0 ? NC - 1 : j - 1, jr = j === NC ? 1 : j + 1;
          const c = P(i, jl), d = P(i, jr);
          n = v3n(v3x([d[0] - c[0], d[1] - c[1], d[2] - c[2]], ts)); // outward for this walk of the profile
        }
        nrm[k] = n[0]; nrm[k + 1] = n[1]; nrm[k + 2] = n[2];
        tns[k] = ts[0]; tns[k + 1] = ts[1]; tns[k + 2] = ts[2];
      }
    }
    // glaze thickness on the outside wall: the roll, the drips (geometry; the shader adds detail)
    for (let i = 0; i < NR; i++) {
      const s = rows[i]; if (s <= sLipOut || s >= sWallEnd) continue;
      for (let j = 0; j < NV; j++) {
        const [ds, A] = colDrip[j];
        const g = glazeThick(ds - s, A) + 0.0012 * smooth(sLipOut, ds, s) * (s < ds ? 1 : 0);
        if (g <= 0) continue;
        const k = (i * NV + j) * 3;
        pos[k] += nrm[k] * g; pos[k + 1] += nrm[k + 1] * g; pos[k + 2] += nrm[k + 2] * g;
      }
    }
    const idx = new Uint32Array((NR - 1) * NC * 6);
    { let q = 0;
      for (let i = 0; i < NR - 1; i++) for (let j = 0; j < NC; j++) {
        const a = i * NV + j, b = (i + 1) * NV + j, c = (i + 1) * NV + j + 1, d = i * NV + j + 1;
        idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = a; idx[q++] = d; idx[q++] = c;
      } }
    if (!alive()) return null;
    await nextFrame();

    /* --------------------------------------------- the cracks, as polylines in (θ, s) */
    const rAt = (s) => Math.max(0.05, prof.at(s)[0]);
    function walk(start, alpha0, len, step, w0, rngW) {
      const pts = [{ th: start.th, s: start.s }];
      const mean = noise1(rngW, 5), fine = noise1(rngW, 40), wid = noise1(rngW, 14);
      let th = start.th, s = start.s, a = alpha0;
      const n = Math.max(2, Math.ceil(len / step));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const nearRim = smooth(0.07, 0.0, Math.abs(s - sRim));
        let target = alpha0 + 0.5 * mean(t) + 0.05 * fine(t);
        target = target + (alpha0 - target) * nearRim * 0.85;
        a += (target - a) * 0.3 + (rngW() - 0.5) * 0.03;
        const st = step * (0.7 + 0.6 * rngW());
        s += st * Math.cos(a); th += st * Math.sin(a) / rAt(s);
        pts.push({ th, s });
      }
      for (let k = 0; k < pts.length; k++) {
        const t = k / (pts.length - 1);
        let w = w0 * (0.84 + 0.3 * (wid(t) * 0.5 + 0.5));
        w *= 0.45 + 0.55 * smooth(0, 0.12, t) * smooth(1, 0.75, t) + 0.0; // taper the ends
        pts[k].w = w;
      }
      // a few flakes along the crack edge, where the gold widens
      const flakes = Math.floor(rngW() * 2.6);
      for (let f = 0; f < flakes; f++) {
        const c = 0.15 + 0.7 * rngW(), wdt = 0.012 + 0.02 * rngW(), amp = 0.35 + 0.5 * rngW();
        for (let k = 0; k < pts.length; k++) { const t = k / (pts.length - 1); pts[k].w *= 1 + amp * Math.exp(-Math.pow((t - c) / wdt, 2)); }
      }
      return pts;
    }
    const rngC = mulberry32(seed ^ 0x51ed270b);
    const cracks = [];
    // A: from the outside wall, over the rim, into the bowl
    const extDepth = 0.42 + 0.22 * rngC(), intDepth = 0.50 + 0.22 * rngC();
    const startA = { th: thA + (rngC() - 0.5) * 0.25, s: sLipOut + extDepth };
    const A = walk(startA, Math.PI + (rngC() - 0.5) * 0.25, extDepth + (sLipOut - sLipIn) + intDepth, 0.007, 0.0088, rngC);
    cracks.push(A);
    let thCross = thA; for (let k = 1; k < A.length; k++) if (A[k - 1].s >= sRim && A[k].s < sRim) { thCross = A[k].th; break; }
    { // a branch inside the bowl, and a short spur on the outside
      let kb = A.findIndex((p) => p.s < sLipIn - 0.12 - 0.15 * rngC()); if (kb < 0) kb = Math.floor(A.length * 0.75);
      const side = rngC() < 0.5 ? -1 : 1;
      cracks.push(walk(A[kb], Math.PI + side * (0.55 + 0.35 * rngC()), 0.22 + 0.2 * rngC(), 0.007, 0.0066, rngC));
      let ke = A.findIndex((p) => p.s < sLipOut + 0.12 + 0.12 * rngC()); if (ke < 1) ke = 4;
      cracks.push(walk(A[ke], -side * (0.7 + 0.5 * rngC()), 0.05 + 0.07 * rngC(), 0.006, 0.0052, rngC));
    }
    // B: runs out of the chip, both ways
    const dirB = (rngC() - 0.5) * 0.3;
    cracks.push(walk({ th: chip.th + dirB * 0.3, s: chip.s - chip.ayIn * 0.7 }, Math.PI + dirB, 0.26 + 0.16 * rngC(), 0.007, 0.0072, rngC));
    cracks.push(walk({ th: chip.th - dirB * 0.2, s: chip.s + chip.ayOut * 0.7 }, -dirB * 0.8, 0.16 + 0.14 * rngC(), 0.007, 0.0066, rngC));

    // distance field texture (θ × s): R = seams ∪ chip, G = chip alone
    const TW = 2048, TH = 1024, cS0 = 0.25, cS1 = sWallEnd;
    const dsT = (cS1 - cS0) / TH;
    const field = new Float32Array(TW * TH * 2).fill(0.03);
    const rRow = new Float64Array(TH); for (let j = 0; j < TH; j++) rRow[j] = rAt(cS0 + (j + 0.5) * dsT);
    const M = 0.028;
    const stamp = (a, b) => {
      const sMin = Math.min(a.s, b.s) - M, sMax = Math.max(a.s, b.s) + M;
      const j0 = Math.max(0, Math.floor((sMin - cS0) / dsT)), j1 = Math.min(TH - 1, Math.ceil((sMax - cS0) / dsT));
      for (let j = j0; j <= j1; j++) {
        const st = cS0 + (j + 0.5) * dsT, rr = rRow[j], mth = M / rr;
        const i0 = Math.floor((Math.min(a.th, b.th) - mth) / TAU * TW), i1 = Math.ceil((Math.max(a.th, b.th) + mth) / TAU * TW);
        const bx = (b.th - a.th) * rr, by = b.s - a.s, bb = Math.max(1e-12, bx * bx + by * by);
        for (let i = i0; i <= i1; i++) {
          const tht = (i + 0.5) / TW * TAU;
          const px = (tht - a.th) * rr, py = st - a.s;
          let t = (px * bx + py * by) / bb; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const dx = px - t * bx, dy = py - t * by;
          const f = Math.sqrt(dx * dx + dy * dy) - (a.w + (b.w - a.w) * t);
          const ii = ((i % TW) + TW) % TW, q = (j * TW + ii) * 2;
          if (f < field[q]) field[q] = f;
        }
      }
    };
    for (const c of cracks) for (let k = 0; k < c.length - 1; k++) stamp(c[k], c[k + 1]);
    { // the chip
      const span = (chip.ax * 1.6 + M) / 0.9;
      const j0 = Math.max(0, Math.floor((chip.s - chip.ayIn * 1.5 - M - cS0) / dsT)), j1 = Math.min(TH - 1, Math.ceil((chip.s + chip.ayOut * 1.5 + M - cS0) / dsT));
      for (let j = j0; j <= j1; j++) {
        const st = cS0 + (j + 0.5) * dsT, mth = span / rRow[j];
        const i0 = Math.floor((chip.th - mth) / TAU * TW), i1 = Math.ceil((chip.th + mth) / TAU * TW);
        for (let i = i0; i <= i1; i++) {
          const f = chipF((i + 0.5) / TW * TAU, st);
          const ii = ((i % TW) + TW) % TW, q = (j * TW + ii) * 2;
          if (f < field[q]) field[q] = f;
          if (f < field[q + 1]) field[q + 1] = f;
        }
      }
    }
    if (!alive()) return null;

    // drip texture (θ): R = drip line s − ref, G = roll amplitude
    const DW = 1024, dripRef = dripBase;
    const dripTex = new Float32Array(DW * 2);
    for (let i = 0; i < DW; i++) { const d = dripAt((i + 0.5) / DW * TAU); dripTex[i * 2] = d[0] - dripRef; dripTex[i * 2 + 1] = d[1]; }

    // oil-spot clusters, in the inside chart (s cosθ, s sinθ)
    const clus = new Float32Array(32);
    for (let i = 0; i < 8; i++) {
      const s = 0.25 + 0.75 * Math.sqrt(rng()), a = rng() * TAU;
      clus[i * 4] = s * Math.cos(a); clus[i * 4 + 1] = s * Math.sin(a);
      clus[i * 4 + 2] = 0.08 + 0.16 * rng(); clus[i * 4 + 3] = i < 3 ? 0.9 + 0.5 * rng() : 0.25 + 0.6 * rng();
    }
    return {
      pos, nrm, tns, uv, idx, NR, NC,
      keys: { sLipIn, sRim, sLipOut, sWallEnd, foot: K[30] },
      field, TW, TH, cS0, cS1, dripTex, DW, dripRef, clus,
      lean, thA, thC, thCross,
      seedv: [rng() * 97, rng() * 89, rng() * 83, rng() * 79],
    };
  }

  /* -------------------------------------------------------- the light rig */
  const frameOf = (d, hint) => { const ax = v3n(v3x(hint, d)); return { d, ax, ay: v3x(d, ax) }; };
  const KEY = frameOf(v3n([-0.55, 0.72, 0.42]), [0, 1, 0]);
  const ACC = frameOf(v3n([-0.66, 0.50, 0.56]), [0, 1, 0]);
  const RIM = frameOf(v3n([0.18, 0.46, -0.87]), [0, 1, 0]);
  const TOP = frameOf(v3n([0.10, 1.0, 0.35]), [0, 0, -1]);
  const BNC = frameOf(v3n([0.82, 0.08, 0.56]), [0, 1, 0]);
  const g3 = (v) => 'vec3(' + v.map((x) => x.toFixed(5)).join(',') + ')';

  const COMMON = `#version 300 es
#define HDR_OUT __HDR__
precision highp float;
precision highp int;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCam;
uniform float uExpo;
const float PI = 3.14159265, TAU = 6.2831853;
const vec3 KEY_D = ${g3(KEY.d)}, KEY_X = ${g3(KEY.ax)}, KEY_Y = ${g3(KEY.ay)};
const vec3 ACC_D = ${g3(ACC.d)}, ACC_X = ${g3(ACC.ax)}, ACC_Y = ${g3(ACC.ay)};
const vec3 RIM_D = ${g3(RIM.d)}, RIM_X = ${g3(RIM.ax)}, RIM_Y = ${g3(RIM.ay)};
const vec3 BNC_D = ${g3(BNC.d)}, BNC_X = ${g3(BNC.ax)}, BNC_Y = ${g3(BNC.ay)};
const vec3 TOP_D = ${g3(TOP.d)}, TOP_X = ${g3(TOP.ax)}, TOP_Y = ${g3(TOP.ay)};
const vec3 KEY_L = vec3(1.0, 0.93, 0.84) * 1.25;  // a big silk, upper left
const vec3 ACC_L = vec3(1.0, 0.92, 0.80) * 10.0;  // a small hot box beside it
const vec3 RIM_L = vec3(0.92, 0.95, 1.0) * 6.0;   // strip light behind
const vec3 BNC_L = vec3(1.0, 0.74, 0.50) * 0.30;  // warm card, low right
const vec3 TOP_L = vec3(0.95, 0.93, 0.90) * 0.06; // the dim ceiling
const vec2 KEY_H = vec2(0.85, 0.62), ACC_H = vec2(0.15, 0.10), RIM_H = vec2(0.07, 0.40), BNC_H = vec2(0.42, 0.20), TOP_H = vec2(0.9, 0.9);
const vec3 KEY_C = vec3(1.0, 0.93, 0.84), RIM_C = vec3(0.92, 0.95, 1.0);
const float KEY_E = 1.55, ACC_E = 0.55, RIM_E = 0.65, BNC_E = 0.10; // irradiance at normal incidence

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 hash32(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yzz) * p3.zyx); }
vec4 hash41(float p) { vec4 p4 = fract(vec4(p) * vec4(.1031, .1030, .0973, .1099)); p4 += dot(p4, p4.wzxy + 33.33); return fract((p4.xxyz + p4.yzzw) * p4.zywx); }
float hash13(vec3 p3) { p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm2(vec2 p) { float a = 0.5, s = 0.; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
vec4 vnoised(vec3 x) { // value noise and its gradient
  vec3 p = floor(x), w = fract(x);
  vec3 u = w * w * w * (w * (w * 6. - 15.) + 10.), du = 30. * w * w * (w * (w - 2.) + 1.);
  float a = hash13(p), b = hash13(p + vec3(1, 0, 0)), c = hash13(p + vec3(0, 1, 0)), d = hash13(p + vec3(1, 1, 0));
  float e = hash13(p + vec3(0, 0, 1)), f = hash13(p + vec3(1, 0, 1)), g = hash13(p + vec3(0, 1, 1)), h = hash13(p + vec3(1, 1, 1));
  float k1 = b - a, k2 = c - a, k3 = e - a, k4 = a - b - c + d, k5 = a - c - e + g, k6 = a - b - e + f, k7 = -a + b + c - d + e - f - g + h;
  return vec4(a + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y + k5 * u.y * u.z + k6 * u.z * u.x + k7 * u.x * u.y * u.z,
    du * vec3(k1 + k4 * u.y + k6 * u.z + k7 * u.y * u.z, k2 + k5 * u.z + k4 * u.x + k7 * u.z * u.x, k3 + k6 * u.x + k5 * u.y + k7 * u.x * u.y));
}

vec3 softbox(vec3 d, vec3 c, vec3 ax, vec3 ay, vec2 hs, float rad, vec3 L, float blur, float grad) {
  float z = dot(d, c);
  if (z <= 0.05) return vec3(0.);
  vec2 p = vec2(dot(d, ax), dot(d, ay)) / z;
  vec2 q = abs(p) - hs + rad;
  float sd = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - rad;
  float m = 1. - smoothstep(-blur, blur, sd);
  vec2 pn = clamp(p / hs, -1.0, 1.0);
  float panel = 1.0 - 0.30 * dot(pn, pn) + 0.06 * pn.y;
  panel *= 0.55 + 0.45 * smoothstep(0.0, 0.05 + 0.2 * rad, -sd); // the diffuser's edge falls off
  panel *= mix(1.0, (0.2 + 0.8 * smoothstep(-1.0, 0.9, pn.y)) * (0.45 + 0.55 * smoothstep(1.0, -0.6, pn.x)), grad); // a graduated scrim
  float A = 4. * hs.x * hs.y, e = A / (A + 2.4 * blur * blur);
  return L * m * panel * e;
}
// the studio, seen in direction d through a surface of roughness a
vec3 env(vec3 d, float a) {
  float blur = 0.006 + a * (0.3 + 0.9 * a);
  vec3 c = vec3(0.010, 0.0085, 0.0068) * (0.35 + 0.65 * smoothstep(-0.15, 0.7, d.y));
  c = d.y < 0. ? vec3(0.0055, 0.0048, 0.0042) : c;
  c += softbox(d, KEY_D, KEY_X, KEY_Y, KEY_H, 0.5, KEY_L, blur + 0.14, 1.0);
  c += softbox(d, ACC_D, ACC_X, ACC_Y, ACC_H, 0.04, ACC_L, blur, 0.3);
  c += softbox(d, RIM_D, RIM_X, RIM_Y, RIM_H, 0.04, RIM_L, blur, 0.0);
  c += softbox(d, BNC_D, BNC_X, BNC_Y, BNC_H, 0.10, BNC_L, blur * 1.5 + 0.05, 0.0);
  c += softbox(d, TOP_D, TOP_X, TOP_Y, TOP_H, 0.5, TOP_L, blur + 0.3, 0.0);
  return c;
}

/* the bowl as an occluder, for the table */
float bowlRad(float y) { return y < 0.125 ? 0.322 : min(0.99, 0.33 + (y - 0.125) * 0.84); }
float discShadow(vec2 xz, vec3 L, float soft) {
  float v = 1.0;
  for (int i = 0; i < 7; i++) {
    float y = 0.03 + float(i) * 0.163;
    vec2 c = -L.xz * (y / L.y);
    float d = length(xz - c) - bowlRad(y);
    float pen = 0.012 + soft * y / L.y;
    v = min(v, smoothstep(-pen, pen, d));
  }
  return v;
}
float floorAO(vec2 xz) {
  float rho = length(xz);
  float contact = 1.0 - 0.8 * exp(-max(rho - 0.305, 0.0) / 0.022);
  float under = mix(0.3, 1.0, smoothstep(0.28, 1.3, rho));
  return contact * under;
}
vec3 slate(vec2 xz, float detail) {
  vec2 q = xz * mat2(0.94, 0.34, -0.34, 0.94);
  float n1 = fbm2(q * 1.6);
  float n2 = vnoise(q * vec2(1.1, 19.0)) * 0.6 + vnoise(q * vec2(0.6, 47.0)) * 0.4; // cleavage
  float n3 = vnoise(q * 140.0) * 0.6 + vnoise(q * 330.0) * 0.4;
  float a = 0.030 * (0.84 + 0.26 * n1 + detail * (0.14 * (n2 - 0.5) + 0.12 * (n3 - 0.5)));
  return a * vec3(0.98, 0.95, 0.92);
}
vec3 floorLight(vec3 p, float detail) { // diffuse radiance of the table at p
  vec2 xz = p.xz;
  vec3 kp = KEY_D * 5.0; vec3 l = kp - p; float dl = length(l); l /= dl;
  float Ek = (KEY_E + ACC_E) * l.y * (25.0 / (dl * dl));
  vec2 pc = (xz - vec2(-0.3, 0.2)) * vec2(0.8, 1.0);
  Ek *= 0.15 + 0.85 * exp(-dot(pc, pc) / 2.8);          // a gridded light: a pool
  float shK = discShadow(xz, KEY_D, 0.30);
  float shR = discShadow(xz, RIM_D, 0.08);
  vec2 pr = xz - vec2(0.15, -0.9);
  float Er = RIM_E * RIM_D.y * exp(-dot(pr, pr) / 3.0);
  vec3 E = KEY_C * Ek * shK + RIM_C * Er * shR + vec3(0.05, 0.04, 0.032);
  return slate(xz, detail) / PI * E * floorAO(xz);
}
// soft gloss of the slate: the strip light behind, blocked by the bowl
vec3 floorSheen(vec3 p, vec3 V, float k) {
  vec3 R = reflect(-V, vec3(0., 1., 0.));
  float F = 0.04 + 0.96 * pow(1.0 - max(V.y, 0.0), 5.0);
  vec3 toB = vec3(0.0, 0.5, 0.0) - p;
  float db = length(toB);
  float ang = acos(clamp(dot(R, toB / db), -1.0, 1.0));
  float rad = atan(0.92 / db);
  float occ = smoothstep(rad * 0.75, rad * 1.25 + 0.12, ang);
  return F * env(R, 0.55) * occ * floorAO(p.xz) * k;
}
vec3 finish(vec3 hdr) {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 vc = (uv - vec2(0.5, 0.52)) * vec2(uRes.x / max(uRes.x, uRes.y), uRes.y / max(uRes.x, uRes.y)) * 1.6;
  hdr *= mix(1.0, 0.45, smoothstep(0.25, 1.15, dot(vc, vc)));
  vec3 x = hdr * uExpo;
  vec3 c = x * (1.0 + x / 36.0) / (1.0 + x);          // gentle shoulder
  c = pow(c, vec3(1.0 / 2.2));
  c = c * c * (3.0 - 2.0 * c) * 0.18 + c * 0.82;      // a little contrast
  float g = hash12(gl_FragCoord.xy + fract(uTime * 7.31) * 911.0) + hash12(gl_FragCoord.yx * 1.31 + fract(uTime * 3.7) * 577.0) - 1.0;
  c += g * (0.010 + 0.022 * c * (1.0 - c));
  return c;
}
vec4 outColor(vec3 c) {
#if HDR_OUT
  return vec4(clamp(c, 0.0, 60.0), 1.0);
#else
  return vec4(finish(c), 1.0);
#endif
}
`;

  const FLOOR_FS = COMMON + `
uniform vec3 uCR, uCU, uCF;
uniform vec3 uFrust; // tanX, tanY, shiftY
out vec4 fragColor;
void main() {
  vec2 ndc = gl_FragCoord.xy / uRes * 2.0 - 1.0;
  vec3 rd = normalize(uCF + ndc.x * uFrust.x * uCR + (ndc.y - uFrust.z) * uFrust.y * uCU);
  vec3 col = vec3(0.004, 0.0034, 0.003);
  if (rd.y < -1e-4) {
    float t = -uCam.y / rd.y;
    vec3 p = uCam + rd * t;
    float detail = exp(-pow(length(p.xz) / 3.2, 2.0));       // the lens focuses on the bowl
    col = floorLight(p, 0.35 + 0.65 * detail);
    col += floorSheen(p, -rd, 0.30) * (0.85 + 0.3 * vnoise(p.xz * 30.0) * detail);
  }
  fragColor = outColor(col);
}
`;

  const BOWL_VS = `#version 300 es
precision highp float;
in vec3 aPos; in vec3 aNrm; in vec3 aTs; in vec2 aUV;
uniform mat4 uVP; uniform mat3 uRot;
out vec3 vPos; out vec3 vNrm; out vec3 vTs; out vec3 vObj; out vec2 vUV;
void main() {
  vec3 wp = uRot * aPos;
  vPos = wp; vNrm = uRot * aNrm; vTs = uRot * aTs; vObj = aPos; vUV = aUV;
  gl_Position = uVP * vec4(wp, 1.0);
}
`;

  const BOWL_FS = COMMON + `
in vec3 vPos; in vec3 vNrm; in vec3 vTs; in vec3 vObj; in vec2 vUV;
uniform mat3 uRot;
uniform sampler2D uCrack, uDrip;
uniform vec4 uS;      // sLipIn, sRim, sLipOut, sWallEnd
uniform vec4 uC;      // crack tex s0, s1, drip ref, foot
uniform vec4 uSeed;
uniform vec2 uLean;
uniform vec4 uClus[8];
out vec4 fragColor;

vec3 thinFilm(float dnm, float cosI) {
  float n = 1.75;
  float cosT = sqrt(1.0 - (1.0 - cosI * cosI) / (n * n));
  vec3 ph = TAU * 2.0 * n * dnm * cosT / vec3(640.0, 545.0, 455.0);
  vec3 f = 0.5 - 0.5 * cos(ph);
  return mix(vec3(dot(f, vec3(0.3333))), f, 0.82);
}
float glazeThick(float e, float A) {
  if (e <= 0.0) return 0.0;
  float edge = sqrt(smoothstep(0.0, 0.005, e));
  return (0.0018 + A * exp(-pow((e - 0.009) / 0.0075, 2.0))) * edge;
}
// hare's fur: one layer of fine filaments, in cells around the circumference
float fur(float th, float dth, float sd, float N, float seed, float density, out float tint) {
  float x = th / TAU * N;
  float k = floor(x), fx = x - k;
  vec4 h = hash41(mod(k, N) + seed);
  float c = 0.25 + 0.5 * h.x;
  float w = mix(0.03, 0.15, h.y * h.y);
  float L = mix(0.05, 0.85, h.z);
  float a = smoothstep(1.0 - density, 1.0, h.w);
  float fw = dth / TAU * N;
  float ww = max(w, fw * 0.8);
  float line = (1.0 - smoothstep(0.0, ww, abs(fx - c))) * (w / ww);
  float along = smoothstep(L, L * 0.3, sd) * smoothstep(-0.02, 0.012, sd);
  tint = h.x;
  return line * along * a;
}
// yōhen spots: a cell layer of irregular pale islands, each with a tight aura
void spotLayer(vec2 P, float cell, vec2 rr, float dens, float seed, float hk, inout float core, inout float ring, inout float halo, inout float dk) {
  vec2 g = floor(P / cell), f = P / cell - g;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 o = vec2(float(i), float(j));
    vec3 h = hash32(g + o + seed);
    float present = dens - h.z;
    if (present <= 0.0) continue;
    vec2 c = o + 0.15 + 0.7 * h.xy;
    vec2 dv = (f - c) * cell;
    float hr = hash12(g + o + seed + 17.3);
    float r = mix(rr.x, rr.y, hr * hr) * smoothstep(0.0, 0.25, present);
    float an = atan(dv.y, dv.x + 1e-7);
    float lob = 1.0 + 0.12 * sin(an * 2.0 + hr * 20.0) + 0.06 * sin(an * 3.0 + h.x * 30.0);
    float d = length(dv) / lob;
    core = max(core, 1.0 - smoothstep(r * 0.86, r, d));
    float isRing = step(0.6, hr);
    ring = max(ring, isRing * smoothstep(r * 0.42, r * 0.7, d) * (1.0 - smoothstep(r * 0.86, r, d)));
    dk = max(dk, isRing * (1.0 - smoothstep(r * 0.3, r * 0.55, d)));
    vec2 hv = hash32(g + o + seed + 5.7).xy;
    float hw = r * (0.7 + 1.5 * hv.x) + 0.003;
    float x = max(length(dv - (hv - 0.5) * r * 0.5) / lob - r * 0.85, 0.0) / hw;
    halo = max(halo, exp(-x * x * 1.6) * hk * smoothstep(0.1, 0.5, hv.y) * (0.5 + 0.5 * h.y));
  }
}

void main() {
  float th = vUV.x, s = vUV.y;
  vec3 Ng = normalize(vNrm);
  vec3 V = normalize(uCam - vPos);
  mat3 Rinv = transpose(uRot);
  vec3 Tth = uRot * vec3(-sin(th), 0.0, cos(th));
  Tth = normalize(Tth - Ng * dot(Tth, Ng) + 1e-6);
  vec3 Ts = normalize(vTs - Ng * dot(vTs, Ng) + 1e-6);
  float r = max(length(vObj.xz - uLean), 1e-3);
  float yObj = vObj.y;
  float pw = length(fwidth(vPos));                     // world size of a pixel
  float dth = length(fwidth(vec2(cos(th), sin(th))));  // angular footprint, seam-free
  float sLipIn = uS.x, sRim = uS.y, sLipOut = uS.z, sWallEnd = uS.w;
  vec2 cs = vec2(cos(th), sin(th));

  // --- the kintsugi field
  vec2 cuv = vec2(th / TAU, (s - uC.x) / (uC.y - uC.x));
  vec2 ct = 1.0 / vec2(textureSize(uCrack, 0));
  vec2 F0 = texture(uCrack, cuv).rg;
  float fu1 = texture(uCrack, cuv + vec2(ct.x, 0.)).r, fu0 = texture(uCrack, cuv - vec2(ct.x, 0.)).r;
  float fs1 = texture(uCrack, cuv + vec2(0., ct.y)).r, fs0 = texture(uCrack, cuv - vec2(0., ct.y)).r;
  vec2 gradF = vec2((fu1 - fu0) / (2.0 * ct.x * TAU * r), (fs1 - fs0) / (2.0 * ct.y * (uC.y - uC.x)));
  float inCrackRange = step(uC.x + 0.01, s) * step(s, uC.y - 0.01);
  vec2 ep = vec2(th * r, s);
  float edgeN = (vnoise(ep * 240.0 + uSeed.xy) - 0.5) * 0.0022 + (vnoise(ep * 800.0) - 0.5) * 0.0011;
  float fz = F0.r + edgeN;
  float aaF = max(fwidth(F0.r), 0.0003) * 0.8;
  float gold = (1.0 - smoothstep(-aaF, aaF, fz)) * inCrackRange;
  float chipM = (1.0 - smoothstep(-0.002, 0.002, F0.g)) * inCrackRange;
  // a faint dark line of lacquer just outside the gold, where the powder did not take
  float lacq = (1.0 - smoothstep(0.0, 0.0012, fz)) * smoothstep(-aaF * 2.0, 0.0, fz) * inCrackRange;

  // --- drip line
  vec2 dr = texture(uDrip, vec2(th / TAU, 0.5)).rg;
  float dripS = uC.z + dr.x;
  float dW = 1.0 / float(textureSize(uDrip, 0).x);
  float dripD = (texture(uDrip, vec2(th / TAU + dW, 0.5)).r - texture(uDrip, vec2(th / TAU - dW, 0.5)).r) / (2.0 * dW * TAU * r);
  float e = dripS - s;
  float aaS = max(fwidth(s), 0.0003);
  float isExt = smoothstep(sLipOut - 0.006, sLipOut + 0.006, s);
  float isIn = 1.0 - smoothstep(sLipIn - 0.006, sLipIn + 0.006, s);
  float glazed = mix(1.0, smoothstep(-aaS, aaS, e), step(sLipOut + 0.1, s));
  float clay = 1.0 - glazed;

  // --- relief, as a gradient in (u = arc along θ, s)
  vec2 gr = vec2(0.0);
  float ridgeFade = 1.0 - smoothstep(0.003, 0.010, pw);
  float wob = vnoise(cs * 2.0 + s * 3.0 + uSeed.z) * 2.4;
  float rAmp = 0.4 + 0.9 * vnoise(cs * 3.0 + vec2(s * 9.0, 0.0) + uSeed.w);
  float rphase = s / 0.047 * TAU + wob + th * 0.5;
  float extRidge = isExt * glazed * smoothstep(sWallEnd, sLipOut + 0.3, s) * smoothstep(sLipOut + 0.02, sLipOut + 0.08, s);
  gr.y += cos(rphase) * (TAU / 0.047) * 0.00022 * rAmp * ridgeFade * extRidge;
  if (isExt > 0.5 && s < sWallEnd) {   // the roll of glaze at its edge
    float ge = 0.0007;
    float dg = (glazeThick(e + ge, dr.y) - glazeThick(e - ge, dr.y)) / (2.0 * ge);
    gr += dg * vec2(dripD, -1.0) * 0.8;
  }
  float q = -fz;
  if (q > -0.002 && inCrackRange > 0.5) { // gold lacquer stands proud; rounded section
    float qb = 0.0028;
    float x = clamp(q / qb, 0.0, 1.0);
    float dh = q > 0.0 && q < qb ? 0.0008 * 6.0 * x * (1.0 - x) / qb : 0.0;
    gr += -dh * gradF;
  }
  vec3 Nb = Ng - (gr.x * Tth + gr.y * Ts);
  // glaze flow and orange peel; clay grit; gold powder (object-space noise)
  vec4 n1 = vnoised(vObj * 9.0 + uSeed.xyz);
  vec4 n2 = vnoised(vObj * 31.0 + uSeed.yzx);
  vec3 Go = n1.yzw * 0.0013 * 9.0 + n2.yzw * 0.00022 * 31.0 * (1.0 - smoothstep(0.003, 0.01, pw));
  vec4 n3 = vnoised(vObj * 160.0);
  vec4 n4 = vnoised(vObj * 420.0 + 3.1);
  Go = mix(Go, n3.yzw * 0.0011 * 160.0 + n4.yzw * 0.00028 * 420.0, clay);
  vec4 n5 = vnoised(vObj * 700.0 + 9.7);
  Go = mix(Go, n5.yzw * 0.00006 * 700.0 + n2.yzw * 0.0005 * 31.0, gold);
  vec3 Gw = uRot * Go;
  Nb -= Gw - Ng * dot(Gw, Ng);
  vec3 N = normalize(Nb);
  if (dot(N, V) < 0.02) N = normalize(N + V * (0.02 - dot(N, V)));
  float NoV = clamp(dot(N, V), 1e-3, 1.0);
  vec3 R = reflect(-V, N);

  // --- what the inside can see: the rim shadows the key, and hides reflections
  vec3 Lk = Rinv * KEY_D, Lr = Rinv * RIM_D, Ro = Rinv * R;
  float inside = 1.0 - smoothstep(sRim - 0.01, sRim + 0.004, s);
  float visK = 1.0, visA = 1.0, visR = 1.0, occR = 1.0;
  vec3 La = Rinv * ACC_D;
  if (inside > 0.0) {
    float rimY = 1.0, rimR = 0.952;
    float tk = max(rimY - yObj, 0.0) / max(Lk.y, 0.05);
    vec2 qk = vObj.xz + Lk.xz * tk - uLean;
    visK = mix(1.0, smoothstep(-0.03 - tk * 0.55, 0.03 + tk * 0.55, rimR - length(qk)), inside);
    float ta = max(rimY - yObj, 0.0) / max(La.y, 0.05);
    vec2 qa = vObj.xz + La.xz * ta - uLean;
    visA = mix(1.0, smoothstep(-0.01 - ta * 0.12, 0.01 + ta * 0.12, rimR - length(qa)), inside);
    float tr = max(rimY - yObj, 0.0) / max(Lr.y, 0.05);
    vec2 qr = vObj.xz + Lr.xz * tr - uLean;
    visR = mix(1.0, smoothstep(-0.01 - tr * 0.06, 0.01 + tr * 0.06, rimR - length(qr)), inside);
    float to = max(rimY - yObj, 0.0) / max(Ro.y, 0.02);
    vec2 qo = vObj.xz + Ro.xz * to - uLean;
    occR = Ro.y <= 0.0 ? 0.0 : smoothstep(-0.015 - to * 0.05, 0.015 + to * 0.05, rimR - length(qo));
    occR = mix(1.0, occR, inside);
  }
  float ao = mix(1.0, mix(0.3, 1.0, smoothstep(0.22, 0.98, yObj)), inside);
  ao *= mix(1.0, mix(0.35, 1.0, smoothstep(0.0, 0.3, vPos.y)), 1.0 - inside);

  float kd = max(0.0, (dot(N, KEY_D) + 0.35) / 1.35);
  float ad = max(0.0, (dot(N, ACC_D) + 0.08) / 1.08);
  float rdf = max(0.0, (dot(N, RIM_D) + 0.1) / 1.1);
  float bd = max(0.0, (dot(N, BNC_D) + 0.3) / 1.3);
  vec3 Eamb = mix(vec3(0.07, 0.048, 0.032), vec3(0.04, 0.036, 0.032), smoothstep(-0.8, 0.4, N.y));
  vec3 E = KEY_C * (KEY_E * kd * visK + ACC_E * ad * visA) + RIM_C * RIM_E * rdf * visR + vec3(1.0, 0.74, 0.5) * BNC_E * bd + Eamb * ao;

  // what a reflection sees
  vec3 envR;
  {
    vec3 eR = env(R, 0.03);
    if (R.y < 0.0 && inside < 0.5) {     // the table, near the bowl
      float t = vPos.y / max(-R.y, 1e-3);
      vec3 fp = vPos + R * t;
      eR = floorLight(fp, 0.5) + floorSheen(fp, -R, 0.30);
    }
    vec3 interiorSeen = vec3(0.0035, 0.0029, 0.0024) + E * 0.0015;
    envR = mix(interiorSeen, eR, occR);
  }

  // ===== glaze body
  // outside: black-brown with hare's fur; the lip breaks to iron brown
  float sdE = s - sLipOut;
  float thw = th + (vnoise(vec2(cs.x * 2.3 + sdE * 3.1, cs.y * 2.3 - sdE * 1.7) + uSeed.w) - 0.5) * 0.05;
  float t1, t2, t3;
  // the fur gathers in drifts: some passages of the wall are full of it, some almost bare
  float drift = smoothstep(0.25, 0.75, vnoise(vec2(cs.x * 3.1 + sdE * 1.3, cs.y * 3.1) + uSeed.xz));
  float fA = fur(thw, dth, sdE * (1.25 - 0.5 * drift), 433.0, uSeed.x, 0.25 + 0.5 * drift, t1);
  float fB = fur(thw + 0.37, dth, sdE * (1.4 - 0.5 * drift), 271.0, uSeed.y, 0.2 + 0.45 * drift, t2);
  float fC = fur(thw + 1.1, dth, sdE * 0.9, 619.0, uSeed.z, 0.15 + 0.5 * drift, t3);
  vec3 rust = vec3(0.15, 0.055, 0.018), goldBrown = vec3(0.19, 0.11, 0.04), silver = vec3(0.085, 0.08, 0.075);
  vec3 furCol = fA * mix(rust, goldBrown, t1) + fB * mix(goldBrown, rust, t2) * 0.8 + fC * mix(silver, rust, t3) * 0.7;
  float furAmt = clamp(fA + fB * 0.8 + fC * 0.7, 0.0, 1.0);
  float thick = smoothstep(sLipOut + 0.05, dripS, s);
  float bodyN = vnoise(vec2(cs.x * 4.0 + s * 2.0, cs.y * 4.0 - s) + uSeed.yw);
  vec3 black = mix(vec3(0.012, 0.0088, 0.0066), vec3(0.0065, 0.0052, 0.0045), thick);
  black *= mix(vec3(0.75, 0.8, 0.9), vec3(1.25, 1.1, 0.95), bodyN);
  vec3 extAlb = mix(black, furCol / max(furAmt, 1e-3), furAmt * (1.0 - 0.7 * thick));
  float lipB = exp(-pow((s - sRim) / 0.017, 2.0));
  vec3 lipCol = vec3(0.115, 0.046, 0.017) * (0.75 + 0.5 * vnoise(vec2(th * 50.0, s * 40.0)));
  extAlb = mix(extAlb, lipCol, lipB * 0.85);
  extAlb = mix(extAlb, vec3(0.004, 0.0035, 0.0032), smoothstep(0.006, 0.014, e) * smoothstep(0.03, 0.016, e) * isExt * 0.7);
  extAlb = mix(extAlb, vec3(0.045, 0.022, 0.011), smoothstep(0.004, 0.0, e) * glazed * isExt);

  // inside: blue-black, short streaks under the lip, the spots, the pooled well
  float sdI = sLipIn - s;
  vec2 Pc0 = s * cs;
  float u1, u2;
  float iA = fur(thw, dth, sdI * 2.4, 433.0, uSeed.y + 5.0, 0.5, u1);
  float iB = fur(thw + 0.21, dth, sdI * 3.0, 271.0, uSeed.z + 9.0, 0.4, u2);
  vec3 inFur = iA * mix(rust, goldBrown, u1) + iB * rust * 0.8;
  float inFurAmt = clamp(iA + iB * 0.8, 0.0, 1.0);
  vec3 inBlack = vec3(0.0075, 0.0078, 0.0098) * mix(vec3(1.2, 1.05, 0.9), vec3(0.85, 0.95, 1.15), vnoise(Pc0 * 3.0 + uSeed.zx));
  vec3 inAlb = mix(inBlack, inFur / max(inFurAmt, 1e-3), inFurAmt * 0.8);
  inAlb = mix(inAlb, lipCol, lipB * 0.85);

  vec2 Pc = Pc0 + (vec2(vnoise(Pc0 * 7.0 + uSeed.xy), vnoise(Pc0 * 7.0 + uSeed.zw)) - 0.5) * 0.04;
  float dens = 0.34;
  for (int i = 0; i < 8; i++) { vec2 dq = Pc - uClus[i].xy; dens += uClus[i].w * exp(-dot(dq, dq) / (uClus[i].z * uClus[i].z)); }
  dens *= (0.3 + 1.15 * vnoise(Pc * 4.0 + uSeed.wx)) * smoothstep(0.06, 0.3, s) * (1.0 - smoothstep(sLipIn - 0.3, sLipIn - 0.07, s));
  float core = 0.0, ring = 0.0, halo = 0.0, dk = 0.0;
  if (isIn > 0.0 && dens > 0.02) {
    spotLayer(Pc, 0.08, vec2(0.0085, 0.025), dens * 0.8, uSeed.x, 1.0, core, ring, halo, dk);
    spotLayer(Pc + 0.31, 0.03, vec2(0.0025, 0.006), dens * 0.95, uSeed.y, 0.7, core, ring, halo, dk);
  }
  float pool = 1.0 - smoothstep(0.12, 0.19, s);
  core *= 1.0 - 0.6 * pool; ring *= 1.0 - 0.7 * pool; halo *= 1.0 - 0.4 * pool;
  vec3 coreCol = mix(vec3(0.15, 0.135, 0.105), vec3(0.11, 0.10, 0.085), vnoise(Pc * 160.0));
  coreCol = mix(coreCol, vec3(0.012, 0.012, 0.014), dk * 0.85);
  inAlb = mix(inAlb, coreCol, core);
  inAlb = mix(inAlb, vec3(0.19, 0.17, 0.13), ring * 0.6);
  inAlb = mix(inAlb, vec3(0.0045, 0.0047, 0.006), pool * 0.7);

  vec3 glazeAlb = mix(inAlb, extAlb, smoothstep(sRim - 0.004, sRim + 0.004, s));

  // ===== glaze = clear coat over the coloured body
  float Fg = 0.04 + 0.96 * pow(1.0 - NoV, 5.0);
  vec3 glazeCol = glazeAlb / PI * E * (1.0 - Fg) + Fg * envR;
  glazeCol += core * (1.0 - dk) * isIn * 0.05 * mix(vec3(0.003), env(R, 0.3), occR); // a dull silver sheen on the spots
  // thin-film halos around the spots: structural colour, seen in reflection
  float neb = smoothstep(0.4, 1.4, dens);   // the faint blue haze a cluster sits in
  if ((halo > 0.01 || neb > 0.0) && isIn > 0.0) {
    float filmP = max(halo, 0.07 * neb) * (1.0 - 0.65 * core);
    float dnm = 152.0 + 56.0 * clamp(halo, 0.0, 1.0) + 8.0 * (vnoise(Pc * 11.0 + uSeed.zw) - 0.5);
    vec3 film = thinFilm(dnm, NoV);
    vec3 hl = mix(vec3(0.003), env(R, 0.22), occR);
    glazeCol += film * filmP * (hl * 0.65 + E * 0.09 + 0.01) * isIn;
  }

  // ===== raw clay below the glaze line
  float grit = hash13(floor(vObj * 520.0));
  float grit2 = vnoise(ep * 90.0);
  vec3 clayAlb = vec3(0.062, 0.032, 0.022) * (0.78 + 0.4 * grit2) * mix(vec3(1.1, 0.95, 0.9), vec3(0.9, 1.0, 1.1), vnoise(ep * 7.0));
  clayAlb = mix(clayAlb, vec3(0.19, 0.16, 0.125), step(0.972, grit) * 0.75);
  clayAlb = mix(clayAlb, vec3(0.018, 0.012, 0.010), step(grit, 0.06) * 0.7);
  float trim = sin(s / 0.0105 * TAU + vnoise(vec2(th * 6.0, s * 20.0)) * 3.0 + th * 2.0);
  clayAlb *= 1.0 + 0.10 * trim;
  clayAlb = mix(clayAlb, vec3(0.03, 0.017, 0.012), smoothstep(-0.012, 0.0, e) * 0.6);  // iron skin under the glaze edge
  float Fc = 0.03 + 0.97 * pow(1.0 - NoV, 5.0);
  vec3 clayCol = clayAlb / PI * E * (1.0 - Fc) + Fc * env(R, 0.62) * 0.5 * (R.y > 0.0 ? 1.0 : 0.3);

  // ===== gold: powdered, satin, on lacquer
  vec3 goldF0 = vec3(1.0, 0.74, 0.34);
  float gpow = hash13(floor(vObj * 1400.0));
  float ga = 0.30 + 0.10 * (n5.x - 0.5) + 0.06 * chipM;
  vec3 Fau = goldF0 + (1.0 - goldF0) * pow(1.0 - NoV, 5.0);
  vec3 envG = mix(vec3(0.004, 0.003, 0.002), env(R, ga), occR);
  if (R.y < 0.0 && inside < 0.5) envG = floorLight(vPos + R * (vPos.y / max(-R.y, 1e-3)), 0.3);
  vec3 goldCol = Fau * envG * (0.85 + 0.3 * gpow) + goldF0 * vec3(0.95, 0.82, 0.6) / PI * (E + 0.06) * 0.5;
  goldCol += goldF0 * pow(gpow, 40.0) * env(R, 0.08) * 0.15; // now and then a coarser flake

  // ===== compose
  vec3 col = mix(glazeCol, clayCol, clay * isExt);
  col *= 1.0 - 0.6 * lacq;
  col = mix(col, goldCol, gold);
  fragColor = outColor(col);
}
`;

  const POST_VS = `#version 300 es
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
  // 4×4 box down-sample with a soft knee: only the bright things bloom
  const DOWN_FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uKnee;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy * 4.0 * uTexel;
  vec3 c = texture(uSrc, uv + uTexel * vec2(-1.0, -1.0)).rgb + texture(uSrc, uv + uTexel * vec2(1.0, -1.0)).rgb
         + texture(uSrc, uv + uTexel * vec2(-1.0, 1.0)).rgb + texture(uSrc, uv + uTexel * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  float l = max(c.r, max(c.g, c.b));
  float w = uKnee > 0.0 ? smoothstep(uKnee, uKnee * 3.0, l) : 1.0;
  o = vec4(c * w, 1.0);
}`;
  const BLUR_FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc; uniform vec2 uDir;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / vec2(textureSize(uSrc, 0));
  vec3 c = texture(uSrc, uv).rgb * 0.2270270;
  c += (texture(uSrc, uv + uDir * 1.3846154).rgb + texture(uSrc, uv - uDir * 1.3846154).rgb) * 0.3162162;
  c += (texture(uSrc, uv + uDir * 3.2307692).rgb + texture(uSrc, uv - uDir * 3.2307692).rgb) * 0.0702703;
  o = vec4(c, 1.0);
}`;
  const COPY_FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
out vec4 o;
void main() { o = texelFetch(uSrc, ivec2(gl_FragCoord.xy), 0); }`;
  const COMP_FS = COMMON.replace('__HDR__', '0') + `
uniform sampler2D uHdr, uB1, uB2;
uniform vec2 uBloom;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 c = texture(uHdr, uv).rgb + texture(uB1, uv).rgb * uBloom.x + texture(uB2, uv).rgb * uBloom.y;
  o = vec4(finish(c), 1.0);
}`;

  /* ------------------------------------------------------------- GL helpers */
  function compile(gl, type, src) {
    const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh); gl.deleteShader(sh);
      throw new Error('shader: ' + log);
    }
    return sh;
  }
  function program(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const name = info.name.replace(/\[0\]$/, ''); u[name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  const FS_TRI_VS = `#version 300 es
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

  // column-major 4x4 helpers
  function lookAt(e, t, up) {
    const f = v3n([t[0] - e[0], t[1] - e[1], t[2] - e[2]]);
    const r = v3n(v3x(f, up)); const u = v3x(r, f);
    return { r, u, f, m: [r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0,
      -(r[0] * e[0] + r[1] * e[1] + r[2] * e[2]), -(u[0] * e[0] + u[1] * e[1] + u[2] * e[2]), (f[0] * e[0] + f[1] * e[1] + f[2] * e[2]), 1] };
  }
  function mul4(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; }
    return o;
  }

  (window.PIECES = window.PIECES || []).push({
    id: 'tenmoku',
    title: 'A Small Night, Mended Twice',
    medium: 'Stoneware with yōhen tenmoku glaze; urushi lacquer and gold',
    note: 'Drag to turn it in your hands.',
    about: 'One tea bowl, lit like a museum photograph: black glaze with hare’s-fur streaks outside and, inside, oil spots whose halos are thin-film interference, shifting as it turns. It was broken and mended twice with gold, and the seams run unbroken over the lip. Nothing here is an image; the bowl, the light and the room are computed as you look.',
    tone: 'dark',
    room: '#0a0807',
    mount(el, api) {
      let destroyed = false, raf = 0;
      const alive = () => !destroyed && api.isCurrent();
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab;background:#0a0807';
      el.appendChild(canvas);
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
      const fail = (msg) => {
        const d = document.createElement('div');
        d.textContent = msg;
        d.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#b9ab98;font:italic 18px serif;padding:24px;text-align:center';
        el.appendChild(d); api.ready();
      };
      if (!gl) { fail('This work needs WebGL2 to be drawn.'); return { destroy() { destroyed = true; } }; }

      const state = {
        rot: 0, vel: 0, elev: 0.58, elevTarget: 0.58, dragging: false, lastX: 0, lastY: 0, lastT: 0,
        idleK: 1, lastInteract: -1e9, W: 1, H: 1, dpr: 1,
      };
      let geo = null, progF = null, progB = null, vao = null, nIdx = 0, texC = null, texD = null, bufs = [];
      let cam = null;

      function resize() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
        state.W = w; state.H = h; state.dpr = dpr;
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      }
      function camera() {
        const W = canvas.width, H = canvas.height, aspect = W / H;
        const el_ = state.elev;
        const target = [0, 0.55, -0.08];
        const D = 12.0;
        const eye = [target[0], target[1] + D * Math.sin(el_), target[2] + D * Math.cos(el_)];
        const L = lookAt(eye, target, [0, 1, 0]);
        // frame the bowl: ~50% of the height in landscape, ~80% of the width in portrait
        const bowlH = 1.55, bowlW = 2.1;
        const halfH = Math.max(bowlH / (2 * 0.56), (bowlW / (2 * 0.80)) / aspect);
        const tanY = halfH / D, tanX = tanY * aspect;
        const shiftY = -0.035;
        const n = 1, f = 40;
        const P = [1 / tanX, 0, 0, 0, 0, 1 / tanY, 0, 0, 0, shiftY, -(f + n) / (f - n), -1, 0, 0, -2 * f * n / (f - n), 0];
        // shiftY placed in column 2 row 1: y_ndc += shiftY (since w = -z)
        P[9] = -shiftY;
        cam = { eye, L, tanX, tanY, shiftY, VP: mul4(P, L.m) };
      }

      // render targets: an MSAA scene buffer (half-float when we can), resolved, then a small halation
      let RT = null, hdr = false, progDown = null, progBlur = null, progComp = null, progCopy = null;
      function freeTargets() {
        if (!RT) return;
        [RT.msF, RT.rs && RT.rs.f, RT.a0 && RT.a0.f, RT.a1 && RT.a1.f, RT.b0 && RT.b0.f, RT.b1 && RT.b1.f].forEach((f) => f && gl.deleteFramebuffer(f));
        [RT.rs, RT.a0, RT.a1, RT.b0, RT.b1].forEach((x) => x && gl.deleteTexture(x.t));
        [RT.msC, RT.msD].forEach((r) => r && gl.deleteRenderbuffer(r));
        RT = null;
      }
      function makeTex(w, h, ldr) {
        const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        if (ldr) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        return { t, f, w, h };
      }
      function buildTargets() {
        freeTargets();
        const W = canvas.width, H = canvas.height;
        const samples = Math.max(1, Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 1));
        RT = { W, H };
        RT.msF = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, RT.msF);
        RT.msC = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, RT.msC);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, hdr ? gl.RGBA16F : gl.RGBA8, W, H);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, RT.msC);
        RT.msD = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, RT.msD);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, W, H);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, RT.msD);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('scene buffer incomplete');
        RT.rs = makeTex(W, H, !hdr);
        if (hdr) {
          const aw = Math.max(1, Math.ceil(W / 4)), ah = Math.max(1, Math.ceil(H / 4));
          const bw = Math.max(1, Math.ceil(aw / 4)), bh = Math.max(1, Math.ceil(ah / 4));
          RT.a0 = makeTex(aw, ah); RT.a1 = makeTex(aw, ah); RT.b0 = makeTex(bw, bh); RT.b1 = makeTex(bw, bh);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      function pass(prog, target, setup) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.f : null);
        gl.viewport(0, 0, target ? target.w : canvas.width, target ? target.h : canvas.height);
        gl.useProgram(prog.p); setup(prog.u);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      function bindTex(unit, t) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); }

      function render(t) {
        if (!geo) return;
        camera();
        const W = canvas.width, H = canvas.height;
        if (!RT || RT.W !== W || RT.H !== H) buildTargets();
        gl.bindFramebuffer(gl.FRAMEBUFFER, RT.msF);
        gl.viewport(0, 0, W, H);
        gl.clearColor(0.004, 0.0035, 0.003, 1); gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        const c = Math.cos(state.rot), s = Math.sin(state.rot);
        const rotM = [c, 0, s, 0, 1, 0, -s, 0, c]; // column-major: world angle = θ + rot
        const expo = 1.6;
        // floor
        gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE);
        gl.useProgram(progF.p);
        gl.uniform2f(progF.u.uRes, W, H); gl.uniform1f(progF.u.uTime, t); gl.uniform3fv(progF.u.uCam, cam.eye);
        gl.uniform1f(progF.u.uExpo, expo);
        gl.uniform3fv(progF.u.uCR, cam.L.r); gl.uniform3fv(progF.u.uCU, cam.L.u); gl.uniform3fv(progF.u.uCF, cam.L.f);
        gl.uniform3f(progF.u.uFrust, cam.tanX, cam.tanY, cam.shiftY);
        gl.bindVertexArray(null);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        // bowl
        gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS); gl.enable(gl.CULL_FACE);
        gl.useProgram(progB.p);
        gl.uniform2f(progB.u.uRes, W, H); gl.uniform1f(progB.u.uTime, t); gl.uniform3fv(progB.u.uCam, cam.eye);
        gl.uniform1f(progB.u.uExpo, expo);
        gl.uniformMatrix4fv(progB.u.uVP, false, new Float32Array(cam.VP));
        gl.uniformMatrix3fv(progB.u.uRot, false, new Float32Array(rotM));
        bindTex(0, texC); gl.uniform1i(progB.u.uCrack, 0);
        bindTex(1, texD); gl.uniform1i(progB.u.uDrip, 1);
        const k = geo.keys;
        gl.uniform4f(progB.u.uS, k.sLipIn, k.sRim, k.sLipOut, k.sWallEnd);
        gl.uniform4f(progB.u.uC, geo.cS0, geo.cS1, geo.dripRef, k.foot);
        gl.uniform4fv(progB.u.uSeed, geo.seedv);
        gl.uniform2fv(progB.u.uLean, geo.lean);
        gl.uniform4fv(progB.u.uClus, geo.clus);
        gl.bindVertexArray(vao);
        gl.drawElements(gl.TRIANGLES, nIdx, gl.UNSIGNED_INT, 0);
        gl.bindVertexArray(null);
        gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.depthMask(false);
        // resolve
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, RT.msF);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, RT.rs.f);
        gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
        if (!hdr) { pass(progCopy, null, (u) => { bindTex(0, RT.rs.t); gl.uniform1i(u.uSrc, 0); }); bindTex(0, null); return; }
        // halation: a tight glow and a wide one, from the brightest things only
        pass(progDown, RT.a0, (u) => { bindTex(0, RT.rs.t); gl.uniform1i(u.uSrc, 0); gl.uniform2f(u.uTexel, 1 / W, 1 / H); gl.uniform1f(u.uKnee, 0.35); });
        pass(progBlur, RT.a1, (u) => { bindTex(0, RT.a0.t); gl.uniform1i(u.uSrc, 0); gl.uniform2f(u.uDir, 1.2 / RT.a0.w, 0); });
        pass(progBlur, RT.a0, (u) => { bindTex(0, RT.a1.t); gl.uniform1i(u.uSrc, 0); gl.uniform2f(u.uDir, 0, 1.2 / RT.a0.h); });
        pass(progDown, RT.b0, (u) => { bindTex(0, RT.a0.t); gl.uniform1i(u.uSrc, 0); gl.uniform2f(u.uTexel, 1 / RT.a0.w, 1 / RT.a0.h); gl.uniform1f(u.uKnee, 0.0); });
        pass(progBlur, RT.b1, (u) => { bindTex(0, RT.b0.t); gl.uniform1i(u.uSrc, 0); gl.uniform2f(u.uDir, 1.5 / RT.b0.w, 0); });
        pass(progBlur, RT.b0, (u) => { bindTex(0, RT.b1.t); gl.uniform1i(u.uSrc, 0); gl.uniform2f(u.uDir, 0, 1.5 / RT.b0.h); });
        pass(progComp, null, (u) => {
          bindTex(0, RT.rs.t); bindTex(1, RT.a0.t); bindTex(2, RT.b0.t);
          gl.uniform1i(u.uHdr, 0); gl.uniform1i(u.uB1, 1); gl.uniform1i(u.uB2, 2);
          gl.uniform2f(u.uRes, W, H); gl.uniform1f(u.uTime, t); gl.uniform1f(u.uExpo, expo);
          gl.uniform2f(u.uBloom, 0.10, 0.07);
        });
        bindTex(0, null); bindTex(1, null); bindTex(2, null);
      }

      let tPrev = performance.now(), t0 = tPrev;
      let fence = null, fenceT = 0, nFrames = 0, minGap = 0, lastDraw = 0;
      const px1 = new Uint8Array(4);
      function frame(now) {
        raf = 0;
        if (!alive()) return;
        // never queue frames faster than the GPU finishes them
        if (fence) {
          const st = gl.clientWaitSync(fence, 0, 0);
          const done = st === gl.ALREADY_SIGNALED || st === gl.CONDITION_SATISFIED || st === gl.WAIT_FAILED;
          if (!done && now - fenceT < 400) { raf = requestAnimationFrame(frame); return; }
          gl.deleteSync(fence); fence = null;
        }
        if (now - lastDraw < minGap) { raf = requestAnimationFrame(frame); return; }
        const dt = Math.min(0.25, (now - tPrev) / 1000); tPrev = now;
        const since = (now - state.lastInteract) / 1000;
        if (!state.dragging) {
          state.rot += state.vel * dt;
          state.vel *= Math.exp(-dt / 0.7);
          state.idleK = smooth(1.5, 5.0, since);
          state.rot += state.idleK * dt * (TAU / 160);
          if (since > 6) state.elevTarget += (0.58 - state.elevTarget) * Math.min(1, dt * 0.25);
        }
        state.elev += (state.elevTarget - state.elev) * Math.min(1, dt * 6);
        const tr = performance.now();
        render((now - t0) / 1000);
        if (++nFrames === 3) {
          // measure one frame end to end; a slow GPU gets fewer frames rather than a growing queue
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1);
          const cost = performance.now() - tr;
          minGap = cost > 40 ? cost * 1.4 : 0;
        }
        lastDraw = performance.now();
        fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); fenceT = lastDraw; gl.flush();
        raf = requestAnimationFrame(frame);
      }

      // pointer: drag turns the bowl, and tilts the view a little
      const onDown = (e) => {
        state.dragging = true; state.lastX = e.clientX; state.lastY = e.clientY; state.lastT = performance.now();
        state.vel = 0; state.lastInteract = performance.now();
        canvas.style.cursor = 'grabbing';
        try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      };
      const onMove = (e) => {
        if (!state.dragging) return;
        const now = performance.now();
        const dx = e.clientX - state.lastX, dy = e.clientY - state.lastY;
        const k = 3.2 / Math.max(320, Math.min(state.W, state.H * 1.4));
        const dr = dx * k;
        state.rot -= dr;
        const dtm = Math.max(1, now - state.lastT) / 1000;
        state.vel = state.vel * 0.6 + (-dr / dtm) * 0.4;
        state.elevTarget = clamp(state.elevTarget + dy * 0.0016, 0.36, 0.78);
        state.lastX = e.clientX; state.lastY = e.clientY; state.lastT = now; state.lastInteract = now;
      };
      const onUp = (e) => {
        if (!state.dragging) return;
        state.dragging = false; state.lastInteract = performance.now();
        if (performance.now() - state.lastT > 80) state.vel = 0;
        state.vel = clamp(state.vel, -3, 3);
        canvas.style.cursor = 'grab';
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      };
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onUp);

      const ro = new ResizeObserver(() => { resize(); if (geo && !raf) render((performance.now() - t0) / 1000); });
      ro.observe(el);
      resize();

      (async () => {
        try {
          await nextFrame();
          const g = await buildBowl(api.seed >>> 0, alive);
          if (!g || !alive()) return;
          await nextFrame();
          if (!alive()) return;
          hdr = !!gl.getExtension('EXT_color_buffer_float');
          const H = hdr ? '1' : '0';
          progF = program(gl, FS_TRI_VS, FLOOR_FS.replace('__HDR__', H));
          progB = program(gl, BOWL_VS, BOWL_FS.replace('__HDR__', H));
          if (hdr) { progDown = program(gl, POST_VS, DOWN_FS); progBlur = program(gl, POST_VS, BLUR_FS); progComp = program(gl, POST_VS, COMP_FS); }
          else progCopy = program(gl, POST_VS, COPY_FS);
          vao = gl.createVertexArray(); gl.bindVertexArray(vao);
          const attr = (name, data, size) => {
            const loc = gl.getAttribLocation(progB.p, name); const b = gl.createBuffer(); bufs.push(b);
            gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
            if (loc >= 0) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); }
          };
          attr('aPos', g.pos, 3); attr('aNrm', g.nrm, 3); attr('aTs', g.tns, 3); attr('aUV', g.uv, 2);
          const ib = gl.createBuffer(); bufs.push(ib);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.idx, gl.STATIC_DRAW);
          nIdx = g.idx.length;
          gl.bindVertexArray(null);
          texC = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texC);
          gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, g.TW, g.TH, 0, gl.RG, gl.FLOAT, g.field);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          texD = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texD);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, g.DW, 1, 0, gl.RG, gl.FLOAT, g.dripTex);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.cullFace(gl.BACK); gl.frontFace(gl.CCW);
          geo = g;
          // begin with the long seam coming over the far rim, a little to the left
          state.rot = (1.42 * Math.PI) - g.thCross;
          render(0);
          api.ready();
          tPrev = performance.now();
          raf = requestAnimationFrame(frame);
        } catch (err) {
          console.error(err);
          fail('This work could not be drawn here.');
        }
      })();

      return {
        destroy() {
          destroyed = true;
          if (raf) cancelAnimationFrame(raf); raf = 0;
          try { if (fence) gl.deleteSync(fence); } catch (_) { /* ignore */ }
          ro.disconnect();
          canvas.removeEventListener('pointerdown', onDown);
          canvas.removeEventListener('pointermove', onMove);
          canvas.removeEventListener('pointerup', onUp);
          canvas.removeEventListener('pointercancel', onUp);
          try {
            bufs.forEach((b) => gl.deleteBuffer(b));
            if (texC) gl.deleteTexture(texC); if (texD) gl.deleteTexture(texD);
            freeTargets();
            const ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext();
          } catch (_) { /* ignore */ }
        },
      };
    },
  });
})();
