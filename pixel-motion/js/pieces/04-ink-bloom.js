/* Ink Bloom — Perpetual Motion, piece 4.
 *
 * Drops of coloured ink fall into a tall tank of still water, seen side-on. Each drop punches in with a
 * small splash crown, plunges as a vortex ring, and the ring rolls, slows and splits into smaller rings that
 * split again, pulling the ink into mushroom heads, stems and curling silk filaments that shear and braid in
 * a slow, time-periodic background swirl, then thin out into haze.
 *
 * The flow is kinematic and divergence-free: every ring is a pair of smoothed point vortices on a prescribed
 * path, plus a separable periodic stream function for the background, all a pure function of each drop’s age.
 * At mount the ink of each drop (about 1,600 tracers laid out as material lines) is advected once through the
 * whole loop and stored; a frame is then a pure function of t. Eight drops arrive three seconds apart and each
 * one’s ink lives exactly one loop (D = 24 s), so t = D is the same frame as t = 0 and nothing accumulates.
 * Threads are drawn one pixel wide with ink conserved along them (a stretched thread is a fainter thread),
 * on a 270 × 338 grid, ordered-dithered into a 42-colour palette and shown at 4×.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 270, H = 338, N = W * H, D = 24, ND = 8, LIFE = 24, GAP = D / ND;
  const S = 40;                                    // still meniscus row
  const TAU = Math.PI * 2;
  const fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
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
  const pmod = (v, m) => ((v % m) + m) % m;

  /* ================================================================ palette (42) */
  const PAL_HEX = [
    'f6f3ec', 'e9e5dc',                                   // 0-1   air, air shade
    'fbfdfa', 'edf4f1', 'e0ebe8', 'd0dfdd', 'bdcfd1', 'a9bfc3', // 2-7 water: caustic … deep
    '6f8d98', '97afb5',                                   // 8-9   meniscus / glass, bubble rim
    'c5cbee', '8791d8', '4b56b2', '2a2f82', '15174a',     // 10-14 indigo
    'f7c6b2', 'f0835f', 'df4127', 'a8231a', '5a1010',     // 15-19 vermilion
    'f4e3a2', 'edc452', 'd69b1f', '9a6511', '533308',     // 20-24 gold
    'b7e6dc', '5ec5b5', '18968e', '0d6267', '06363c',     // 25-29 teal
    '9b4b8b', '4f1f4f',                                   // 30-31 indigo + vermilion: plum
    '7d8b4b', '3c4725',                                   // 32-33 indigo + gold: olive
    '2f7ba2', '143b5b',                                   // 34-35 indigo + teal: deep sea
    'f0792b', 'a34512',                                   // 36-37 vermilion + gold: orange
    'a15b4b', '4b2b27',                                   // 38-39 vermilion + teal: umber
    '7dbd5b', '2f6b31',                                   // 40-41 gold + teal: green
  ];
  const PAL = PAL_HEX.map((h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
  const AIR = 0, AIR1 = 1, G0 = 2, MEN = 8, BUB = 9;
  const RAMP = [10, 15, 20, 25];                         // first (lightest) index of each ink ramp
  const PAIRI = [[-1, 30, 32, 34], [30, -1, 36, 38], [32, 36, -1, 40], [34, 38, 40, -1]];

  const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bay = (x, y) => B4[((y & 3) << 2) | (x & 3)];
  const bay2 = (x, y) => B4[(((y + 1) & 3) << 2) | ((x + 2) & 3)];

  /* ================================================================ the drops */
  // x (fraction of width), ink: 0 indigo, 1 vermilion, 2 gold, 3 teal
  const DROPS = [
    { x: 0.36, c: 0 }, { x: 0.70, c: 1 }, { x: 0.48, c: 3 }, { x: 0.22, c: 2 },
    { x: 0.79, c: 0 }, { x: 0.41, c: 2 }, { x: 0.61, c: 1 }, { x: 0.28, c: 3 },
  ];
  const T0 = DROPS.map((d, i) => i * GAP);

  // half-step clock: the simulation runs at 60 Hz with midpoints, so every state lives on a 120 Hz grid
  const HZ = 120, NA = LIFE * HZ;                          // age indices 0 … NA
  const SETTLE = 2.6;                                      // ink is a little denser than water

  /* ---------------------------------------------------------------- background stream function */
  // psi = sum A sin(kx x + phase(t)) sin(ky (y - S)): zero at the surface, periodic in D
  const BGM = [
    { A: 200, kx: TAU / 310, ky: Math.PI / 300, m: 1, p: 0.7 },
    { A: 80, kx: TAU / 120, ky: Math.PI / 95, m: -1, p: 2.1 },
    { A: 30, kx: TAU / 64, ky: Math.PI / 52, m: 2, p: 4.0 },
  ];

  function bgVel(x, y, t, out) {
    let u = 0, v = 0;
    for (const b of BGM) {
      const X = b.kx * x + b.p + TAU * b.m * t / D, Y = b.ky * (y - S);
      u += b.A * b.ky * Math.sin(X) * Math.cos(Y);
      v -= b.A * b.kx * Math.cos(X) * Math.sin(Y);
    }
    out[0] = u; out[1] = v;
  }
  // gridded version for the tracers, 8 px
  const BGS = 8, BGX0 = -24, BGY0 = S - 8, BGW = Math.ceil((W + 48) / BGS) + 1, BGH = Math.ceil((H + 60 - BGY0) / BGS) + 1;
  const BGU = [new Float32Array(BGW * BGH), new Float32Array(BGW * BGH), new Float32Array(BGW * BGH)];
  const BGV = [new Float32Array(BGW * BGH), new Float32Array(BGW * BGH), new Float32Array(BGW * BGH)];
  const SINY = BGM.map(() => new Float32Array(BGH)), COSY = BGM.map(() => new Float32Array(BGH));
  const SX = new Float32Array(BGW), CX = new Float32Array(BGW);
  function initBGTables() {
    BGM.forEach((b, k) => { for (let j = 0; j < BGH; j++) { const Y = b.ky * (BGY0 + j * BGS - S); SINY[k][j] = Math.sin(Y); COSY[k][j] = Math.cos(Y); } });
  }
  function buildBG(slot, t) {
    const U = BGU[slot], V = BGV[slot];
    U.fill(0); V.fill(0);
    for (let k = 0; k < BGM.length; k++) {
      const b = BGM[k], ph = b.p + TAU * b.m * t / D;
      for (let i = 0; i < BGW; i++) { const X = b.kx * (BGX0 + i * BGS) + ph; SX[i] = Math.sin(X); CX[i] = Math.cos(X); }
      const au = b.A * b.ky, av = b.A * b.kx, sy = SINY[k], cy = COSY[k];
      for (let j = 0; j < BGH; j++) {
        const o = j * BGW, cu = au * cy[j], cv = av * sy[j];
        for (let i = 0; i < BGW; i++) { U[o + i] += cu * SX[i]; V[o + i] -= cv * CX[i]; }
      }
    }
  }

  /* ---------------------------------------------------------------- ring programmes */
  // a ring seen side-on is a vortex pair; each drop has a primary ring that splits into children that split again
  function buildProgramme(j) {
    const rnd = mulberry32(977 + j * 131);
    const x0 = DROPS[j].x * W;
    const R0 = P_R0 + rnd() * 2;
    const rings = [];
    const prim = { ab: 0, ad: 0, x: x0, y: S + 5, th: (rnd() - 0.5) * 0.22, curl: (rnd() - 0.5) * 0.05, V0: 38 + rnd() * 9, tau: 2.3, R: R0, grow0: P_GROW, kin: 0.15, fade: 1.3, parent: -1, side: 0, k0: P_K0, k1: P_K1 };
    const split1 = 3.2 + rnd() * 1.3;
    prim.ad = split1 + prim.fade;
    rings.push(prim);
    const nc = rnd() < 0.62 ? 3 : 2;
    const spread = 0.42 + rnd() * 0.25;
    const kids = [];
    for (let c = 0; c < nc; c++) {
      const side = nc === 3 ? c - 1 : (c === 0 ? -1 : 1);
      const th = side === 0 ? (rnd() - 0.5) * 0.16 : side * (spread + (rnd() - 0.5) * 0.12);
      const split2 = split1 + 3.6 + rnd() * 1.8;
      const k = { ab: split1, ad: split2 + 1.4, th, curl: (rnd() - 0.5) * 0.08, V0: side === 0 ? 19 + rnd() * 4 : 15 + rnd() * 5, tau: 3.2, R: side === 0 ? 0.5 : 0.56, grow0: 0.9, kin: 0.7, fade: 1.4, parent: 0, side, splits: rnd() < 0.85, k0: P_K0, k1: P_K1 };
      rings.push(k); kids.push(rings.length - 1);
    }
    for (const ki of kids) {
      const k = rings[ki];
      if (!k.splits) { k.ad = LIFE - 4 - rnd() * 3; k.fade = 3; continue; }
      const sp = 0.3 + rnd() * 0.22;
      for (let s = -1; s <= 1; s += 2) {
        rings.push({ ab: k.ad - k.fade, ad: Math.min(LIFE - 1, k.ad - k.fade + 7 + rnd() * 3), th: s * (sp + (rnd() - 0.5) * 0.1), curl: (rnd() - 0.5) * 0.1, V0: 9 + rnd() * 4, tau: 4, R: 0.62, grow0: 0.9, kin: 0.7, fade: 2.6, parent: ki, side: s, k0: P_K0, k1: P_K1 * 0.9 });
      }
    }
    return rings;
  }
  let ONLY = -1, KREV = 20, KC = 3, SINPHI = 0.22, LOBE = 1.6, WARP = 7;
  let P_R0 = 11, P_GROW = 0.55, P_K0 = 0.5, P_KP = 1.2, P_K1 = 0.45, P_DEL = 0.55, P_VP = 60, P_CORE = 0.55, P_SPOKE = 6, P_CAP = 0;

  // tracks: per ring, per 120 Hz age index: centre, perpendicular, radius, strength
  let TRK = null;   // TRK[j] = { n, cx, cy, nx, ny, r, g } each Float32Array(n * (NA + 1))
  const KG = 1.0;
  function buildTracks() {
    TRK = [];
    const bv = [0, 0];
    for (let j = 0; j < ND; j++) {
      const rings = buildProgramme(j), nr = rings.length, M = NA + 1;
      const T = { n: nr, cx: new Float32Array(nr * M), cy: new Float32Array(nr * M), nx: new Float32Array(nr * M), ny: new Float32Array(nr * M), r: new Float32Array(nr * M), g: new Float32Array(nr * M) };
      for (let q = 0; q < nr; q++) {
        const rg = rings[q], o = q * M;
        const i0 = Math.round(rg.ab * HZ), i1 = Math.min(NA, Math.round(rg.ad * HZ));
        let x, y, th, R;
        if (rg.parent < 0) { x = rg.x; y = rg.y; th = rg.th; R = rg.R; }
        else {
          const po = rg.parent * M + i0, P = rings[rg.parent];
          const pR = T.r[po], pnx = T.nx[po], pny = T.ny[po];
          th = P.thNow + rg.th;
          x = T.cx[po] + rg.side * pR * pnx + (rg.side === 0 ? 0.4 * pR * Math.sin(P.thNow) : 0);
          y = T.cy[po] + rg.side * pR * pny + (rg.side === 0 ? 0.4 * pR * Math.cos(P.thNow) : 0);
          R = rg.R * pR;
          rg.R = R;
        }
        const dt = 1 / HZ;
        for (let i = i0; i <= i1; i++) {
          const a = i / HZ, la = a - rg.ab;
          const V = rg.V0 * Math.exp(-la / rg.tau) + 1.5 + (rg.parent < 0 ? P_VP * Math.exp(-la / 0.35) : 0);
          const Rn = R * (rg.grow0 + (1 - rg.grow0) * (1 - Math.exp(-la / 0.8))) * (1 + 0.035 * la);
          const env = (rg.parent < 0 ? sstep(0, 0.12, la) : sstep(0, rg.kin, la)) * (1 - sstep(rg.ad - rg.fade, rg.ad, a));
          const dx = Math.sin(th), dy = Math.cos(th);
          T.cx[o + i] = x; T.cy[o + i] = y; T.nx[o + i] = dy; T.ny[o + i] = -dx; T.r[o + i] = Rn;
          const kap = rg.parent < 0 ? (la < 0.6 ? P_K0 + (P_KP - P_K0) * sstep(0, 0.6, la) : P_KP + (P_K1 - P_KP) * sstep(0.6, rg.ad - rg.fade, a)) : 1.1 + (P_K1 - 1.1) * sstep(rg.ab, rg.ad - rg.fade * 0.5, a);
          T.g[o + i] = KG * 2.18 * V * Rn * env * kap;
          rg.thNow = th;
          bgVel(x, y, T0[j] + a, bv);
          x += (V * dx + bv[0] * 0.8) * dt; y += (V * dy + bv[1] * 0.8 + SETTLE) * dt;
          th += rg.curl * dt;
          if (y < S + 2) y = S + 2;
        }
        rg.thNow = th;
      }
      TRK.push(T);
    }
  }

  /* ---------------------------------------------------------------- field states */
  const MAXD = 160, CELL = 16, BX0 = -64, BY0 = 0, BWN = Math.ceil((W + 128) / CELL), BHN = Math.ceil((H + 96) / CELL), MAXB = 40;
  function mkState() {
    return {
      nd: 0, ax: new Float64Array(MAXD), ay: new Float64Array(MAXD), bx: new Float64Array(MAXD), by: new Float64Array(MAXD),
      g: new Float64Array(MAXD), d2: new Float64Array(MAXD), cx: new Float64Array(MAXD), cy: new Float64Array(MAXD), rc2: new Float64Array(MAXD),
      cnt: new Int32Array(BWN * BHN), ids: new Int16Array(BWN * BHN * MAXB), slot: 0,
    };
  }
  function buildState(st, n, slot) {
    // n: global half-step index; field is periodic in D
    st.nd = 0; st.cnt.fill(0); st.slot = slot;
    buildBG(slot, pmod(n, D * HZ) / HZ);
    for (let j = 0; j < ND; j++) {
      const ai = pmod(n - Math.round(T0[j] * HZ), D * HZ);
      if (ai > NA) continue;
      const T = TRK[j], M = NA + 1;
      for (let q = 0; q < T.n; q++) {
        const o = q * M + ai, g = T.g[o];
        if (g < 0.5) continue;
        const k = st.nd++;
        const cx = T.cx[o], cy = T.cy[o], R = T.r[o], nx = T.nx[o], ny = T.ny[o];
        st.cx[k] = cx; st.cy[k] = cy; st.g[k] = g;
        st.ax[k] = cx - R * nx; st.ay[k] = cy - R * ny; st.bx[k] = cx + R * nx; st.by[k] = cy + R * ny;
        const del = P_DEL * R; st.d2[k] = del * del;
        const rc = 6 * R + 10; st.rc2[k] = rc * rc;
        const i0 = clamp(fl((cx - rc - BX0) / CELL), 0, BWN - 1), i1 = clamp(fl((cx + rc - BX0) / CELL), 0, BWN - 1);
        const j0 = clamp(fl((cy - rc - BY0) / CELL), 0, BHN - 1), j1 = clamp(fl((cy + rc - BY0) / CELL), 0, BHN - 1);
        for (let bj = j0; bj <= j1; bj++) for (let bi = i0; bi <= i1; bi++) {
          const c = bj * BWN + bi, m = st.cnt[c];
          if (m < MAXB) { st.ids[c * MAXB + m] = k; st.cnt[c] = m + 1; }
        }
      }
    }
  }
  let VU = 0, VV = 0;
  function vel(st, x, y) {
    // background, bilinear
    const U = BGU[st.slot], V = BGV[st.slot];
    let gx = (x - BGX0) / BGS, gy = (y - BGY0) / BGS;
    gx = clamp(gx, 0, BGW - 1.001); gy = clamp(gy, 0, BGH - 1.001);
    const ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy, o = iy * BGW + ix;
    let u = (U[o] * (1 - fx) + U[o + 1] * fx) * (1 - fy) + (U[o + BGW] * (1 - fx) + U[o + BGW + 1] * fx) * fy;
    let v = (V[o] * (1 - fx) + V[o + 1] * fx) * (1 - fy) + (V[o + BGW] * (1 - fx) + V[o + BGW + 1] * fx) * fy;
    v += SETTLE;
    const bi = clamp(fl((x - BX0) / CELL), 0, BWN - 1), bj = clamp(fl((y - BY0) / CELL), 0, BHN - 1);
    const c = bj * BWN + bi, m = st.cnt[c], base = c * MAXB;
    for (let q = 0; q < m; q++) {
      const k = st.ids[base + q];
      const dx = x - st.cx[k], dy = y - st.cy[k], dd = dx * dx + dy * dy, rc2 = st.rc2[k];
      if (dd >= rc2) continue;
      let w = 1;
      const lo = 0.36 * rc2;
      if (dd > lo) { const s = (dd - lo) / (rc2 - lo); w = 1 - s * s * (3 - 2 * s); }
      const g = st.g[k] * w, d2 = st.d2[k];
      let ex = x - st.ax[k], ey = y - st.ay[k], f = g / (ex * ex + ey * ey + d2);
      u -= ey * f; v += ex * f;
      ex = x - st.bx[k]; ey = y - st.by[k]; f = g / (ex * ex + ey * ey + d2);
      u += ey * f; v -= ex * f;
    }
    VU = u; VV = v;
  }

  /* ---------------------------------------------------------------- tracers */
  // stored samples: 30 Hz for the first 10 s of a life, 10 Hz after
  const SPLIT_A = LIFE, NS1 = SPLIT_A * 30, NS = NS1 + (LIFE - SPLIT_A) * 10 + 1;
  const QS = 16;                                    // fixed point
  let TR = null;                                    // TR[j] = { n, link: Uint8Array, m: Float32Array, pos: Int16Array(NS * n * 2) }
  function sampleOfAgeIndex(ai) {                  // ai on the 120 Hz grid, or -1
    if (ai < SPLIT_A * HZ) return ai % 4 === 0 ? ai / 4 : -1;
    const r = ai - SPLIT_A * HZ;
    return r % 12 === 0 ? NS1 + r / 12 : -1;
  }
  function seedDrop(j) {
    const rnd = mulberry32(5501 + j * 7919);
    const T = TRK[j], M = NA + 1;
    const cx = T.cx[0], cy = T.cy[0] + 0.5, R = T.r[0];
    const xs = [], ys = [], link = [], ms = [];
    const push = (x, y, l, m) => { xs.push(x); ys.push(y); link.push(l); ms.push(m); };
    // the drop body: little circles around each core, a shell around the ring and radial spokes,
    // so the rolling shows as spirals and the shell peels off into the wake
    const ring = (x, y, rr, sp, m, sq) => {
      const n = Math.max(6, Math.round(TAU * rr / sp)), a0 = rnd() * TAU;
      for (let k = 0; k <= n; k++) { const a = a0 + TAU * k / n; push(x + rr * Math.cos(a), Math.max(S + 1, y + rr * Math.sin(a) * sq), k < n ? 1 : 0, m); }
    };
    for (let s = -1; s <= 1; s += 2) for (let r = 0.7; r < P_CORE * R; r += 0.9) ring(cx + s * R, cy, r, 0.3, 1, 1);
    if (P_CAP > 0) for (let r = 1.1 * R; r < 1.6 * R; r += 0.25 * R) ring(cx, cy, r, 0.3, P_CAP, 0.85);
        const nsp = P_SPOKE, a1 = rnd() * TAU;
    for (let q = 0; q < nsp; q++) {
      const a = a1 + TAU * q / nsp, n = Math.round(1.5 * R / 0.3);
      for (let k = 0; k <= n; k++) { const rr = 0.4 + 1.5 * R * k / n; push(cx + rr * Math.cos(a), Math.max(S + 1, cy + rr * Math.sin(a) * 0.85), k < n ? 1 : 0, 0.5); }
    }
    // a skin of ink spread just under the surface by the impact
    for (let row = 0; row < 2; row++) {
      const half = 1.7 * R - row * 2, n = Math.round(2 * half / 0.3);
      for (let k = 0; k <= n; k++) push(cx - half + 2 * half * k / n, S + 1.2 + row * 1.1 + rnd() * 0.3, k < n ? 1 : 0, 0.45);
    }
    // the entry column
    for (let c = -1; c <= 1; c++) {
      const n = Math.round((cy + 1.6 * R - S) / 0.3);
      for (let k = 0; k <= n; k++) push(cx + c * 0.8, S + 1 + k * 0.3, k < n ? 2 : 0, 0.9);
    }
    const n = xs.length;
    return { n, link: Uint8Array.from(link), m: Float32Array.from(ms), x: Float64Array.from(xs), y: Float64Array.from(ys), pos: new Int16Array(NS * n * 2), ax: new Float32Array(NS) };
  }
  function store(tr, s) {
    const p = tr.pos, o = s * tr.n * 2, X = tr.x, Y = tr.y;
    let sx = 0;
    for (let k = 0; k < tr.n; k++) sx += X[k];
    tr.ax[s] = sx / tr.n;
    for (let k = 0; k < tr.n; k++) {
      p[o + 2 * k] = clamp(Math.round(X[k] * QS), -32000, 32000);
      p[o + 2 * k + 1] = clamp(Math.round(Y[k] * QS), -32000, 32000);
    }
  }

  // the whole simulation as a resumable job
  function* simJob() {
    initBGTables();
    buildTracks();
    TR = [];
    for (let j = 0; j < ND; j++) { const tr = seedDrop(j); TR.push(tr); store(tr, 0); }
    yield;
    const S0 = mkState(), S1 = mkState(), S2 = mkState();
    let A = S0, B = S1, C = S2;
    const nEnd = Math.round(T0[ND - 1] * HZ) + NA;
    const dt = 1 / 60, h = dt / 2;
    buildState(A, 0, 0);
    let slotA = 0;
    for (let n = 0; n < nEnd; n += 2) {
      const sB = (slotA + 1) % 3, sC = (slotA + 2) % 3;
      buildState(B, n + 1, sB);
      buildState(C, n + 2, sC);
      for (let j = 0; j < ND; j++) {
        const ai = n - Math.round(T0[j] * HZ);
        if (ai < 0 || ai >= NA) continue;
        const tr = TR[j], X = tr.x, Y = tr.y;
        for (let k = 0; k < tr.n; k++) {
          const x = X[k], y = Y[k];
          vel(A, x, y);
          let xm = x + VU * h, ym = y + VV * h;
          if (ym < S + 1) ym = S + 1;
          vel(B, xm, ym);
          let nx = x + VU * dt, ny = y + VV * dt;
          if (ny < S + 1) ny = S + 1;
          if (nx < 1) nx = 1; else if (nx > W - 2) nx = W - 2;
          X[k] = nx; Y[k] = ny;
        }
        const s = sampleOfAgeIndex(ai + 2);
        if (s >= 0) store(tr, s);
      }
      const t = A; A = C; C = t; slotA = sC;
      if ((n & 63) === 0) yield;
    }
    for (const tr of TR) { tr.x = null; tr.y = null; }
  }

  /* ================================================================ frame */
  const DEN = new Float32Array(N * 4);              // ink density per colour
  const HC = 3, HW = Math.ceil(W / HC) + 2, HH = Math.ceil(H / HC) + 2;
  const HZB = new Float32Array(HW * HH * 4), HZT = new Float32Array(HW * HH);
  const OUT = new Uint8Array(N);
  const YS = new Int16Array(W);                     // surface row per column
  const YSF = new Float32Array(W);

  function lifeOf(t, j) { return pmod(t - T0[j], D); }

  function surface(t) {
    for (let x = 0; x < W; x++) {
      let y = S - 2.2 * Math.exp(-x / 3.2) - 2.2 * Math.exp(-(W - 1 - x) / 3.2);
      YSF[x] = y;
    }
    for (let j = 0; j < ND; j++) {
      const a = lifeOf(t, j);
      if (a > 4) continue;
      const x0 = DROPS[j].x * W, A = 1.9 * Math.exp(-a / 1.0) * (1 - sstep(3, 4, a));
      for (let x = 0; x < W; x++) {
        const r = Math.abs(x + 0.5 - x0);
        const front = 34 * a + 3;
        if (r > front + 6) continue;
        YSF[x] += A * Math.sin(0.62 * r - 11 * a) * Math.exp(-r / 42) * sstep(front + 6, front, r) * (r < 3 && a < 0.3 ? 0 : 1);
      }
    }
    for (let x = 0; x < W; x++) YS[x] = Math.round(YSF[x]);
  }

  /* ---------------------------------------------------------------- caustics on the back wall */
  const CW = 26, CH = 19, CNX = Math.ceil(W / CW) + 3, CNY = Math.ceil(H / CH) + 3;
  const CPX = new Float32Array(CNX * CNY), CPY = new Float32Array(CNX * CNY);
  const CAU = new Float32Array(N);
  function caustics(t) {
    const ph = TAU * t / D;
    for (let j = 0; j < CNY; j++) for (let i = 0; i < CNX; i++) {
      const k = j * CNX + i;
      const m1 = 1 + fl(ih(i, j, 1) * 3), m2 = 1 + fl(ih(i, j, 2) * 3);
      const s1 = ih(i, j, 5) < 0.5 ? 1 : -1, s2 = ih(i, j, 6) < 0.5 ? 1 : -1;
      CPX[k] = i + 0.5 + 0.36 * Math.cos(s1 * m1 * ph + ih(i, j, 3) * TAU);
      CPY[k] = j + 0.5 + 0.36 * Math.sin(s2 * m2 * ph + ih(i, j, 4) * TAU);
    }
    const w1 = ph, w2 = 2 * ph;
    for (let y = S; y < H; y++) {
      const z = (y - S) / (H - S);
      const str = Math.exp(-z * 2.4);
      if (str < 0.06) { CAU.fill(0, y * W, y * W + W); continue; }
      const wy = 7 * Math.sin(y * 0.043 + w1);
      for (let x = 0; x < W; x++) {
        const qx = (x + wy + 5 * Math.sin(y * 0.083 - w2 + x * 0.021)) / CW + 1;
        const qy = (y + 6 * Math.sin(x * 0.052 + w1 + 1.3) + 3 * Math.sin(x * 0.13 - y * 0.05 + w2)) / CH + 1;
        const lum = 0.5 + 0.5 * Math.sin(x * 0.031 - y * 0.022 + w1 + 0.6 * Math.sin(y * 0.05 - w2));
        const ix = qx | 0, iy = qy | 0;
        let f1 = 1e9, f2 = 1e9;
        for (let dj = -1; dj <= 1; dj++) {
          const row = (iy + dj) * CNX;
          for (let di = -1; di <= 1; di++) {
            const k = row + ix + di;
            const dx = (CPX[k] - qx) * CW, dy = (CPY[k] - qy) * CH;
            const d = dx * dx + dy * dy;
            if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
          }
        }
        // f in squared pixels; ridge between cells
        const e = Math.sqrt(f2) - Math.sqrt(f1);
        CAU[y * W + x] = str * (0.35 + 0.65 * lum) * (1 - sstep(0.2, 1.9 + 0.8 * lum, e));
      }
    }
  }

  /* ---------------------------------------------------------------- ink */
  const PX = new Float32Array(4096), PY = new Float32Array(4096);
  function inkLayer(t) {
    DEN.fill(0); HZB.fill(0);
    for (let j = 0; j < ND; j++) {
      if (ONLY >= 0 && j !== ONLY) continue;
      const a = lifeOf(t, j);
      const tr = TR[j], c = DROPS[j].c;
      const at = (0.55 + 0.45 * sstep(0, 0.25, a)) * (1 - sstep(10, 21.5, a));
      const ah = sstep(6, 14, a) * (1 - sstep(14, 23.4, a));
      if (at <= 0.001 && ah <= 0.001) continue;
      // the simulation is the ring’s cross-section; revolve it into K azimuthal copies and project them
      // side-on, each copy a little ahead or behind in time so the split rings break into lobes
      const n = tr.n, p = tr.pos, inv = 1 / QS;
      const dc = c * N, hc = c * HW * HH;
      const ink = KC * at / KREV, haze = 0.9 * ah / KREV;
      const wa = WARP * sstep(3, 16, a), wp0 = TAU * t / D + ih(j, 9, 4) * TAU, wp1 = -TAU * 2 * t / D + ih(j, 9, 5) * TAU;
      const wv = sstep(2.2, 6, a), ph0 = ih(j, 9, 1) * TAU, ph1 = ih(j, 9, 2) * TAU, rot = ih(j, 9, 3) * Math.PI;
      for (let q = 0; q < KREV; q++) {
        const th = rot + Math.PI * (q + 0.15 + 0.7 * ih(j, q, 21)) / KREV;
        const rw = 1 + wv * (0.14 * Math.sin(2 * th + ph1) + 0.1 * (ih(j, q, 22) - 0.5));
        const cq = Math.cos(th) * rw, sq = Math.sin(th) * SINPHI * rw;
        let aq = a + wv * (LOBE * Math.sin(2 * th + ph0) + 0.5 * LOBE * Math.sin(3 * th + ph1) + 0.5 * LOBE * (ih(j, q, 23) - 0.5));
        aq = clamp(aq, 0, LIFE);
        let sf = aq < SPLIT_A ? aq * 30 : NS1 + (aq - SPLIT_A) * 10;
        if (sf > NS - 1) sf = NS - 1;
        let s0 = fl(sf); if (s0 >= NS - 1) s0 = NS - 2;
        const f = sf - s0, o0 = s0 * n * 2, o1 = o0 + n * 2;
        const ax = tr.ax[s0] * (1 - f) + tr.ax[s0 + 1] * f;
        let px = 0, py = 0, pl = 0;
        for (let k = 0; k < n; k++) {
          const x = (p[o0 + 2 * k] * (1 - f) + p[o1 + 2 * k] * f) * inv;
          const y0 = (p[o0 + 2 * k + 1] * (1 - f) + p[o1 + 2 * k + 1] * f) * inv;
          const r = x - ax;
          let X = ax + r * cq, Y = y0 + r * sq;
          if (wa > 0) {
            const wy = Y * 0.055 + wp0, wx = X * 0.04 + wp1;
            X += wa * (Math.sin(wy) + 0.5 * Math.sin(Y * 0.11 - wp1 + X * 0.02));
            Y += wa * 0.6 * Math.sin(wx + Y * 0.01);
          }
          const m = tr.m[k];
          if (haze > 0) {
            const hx = (X / HC) | 0, hy = (Y / HC) | 0;
            if (hx >= 0 && hy >= 0 && hx < HW && hy < HH) HZB[hc + hy * HW + hx] += m * haze;
          }
          if (pl && ink > 0) seg(px, py, X, Y, m * ink, dc, pl === 2 ? 70 : 9);
          px = X; py = Y; pl = tr.link[k];
        }
      }
    }
  }
  function seg(x0, y0, x1, y1, m, dc, maxl) {
    const dx = x1 - x0, dy = y1 - y0, adx = dx < 0 ? -dx : dx, ady = dy < 0 ? -dy : dy;
    const len = adx > ady ? adx : ady;
    if (len > maxl) return;
    const el = Math.sqrt(dx * dx + dy * dy);
    const w = el > 1 ? m / Math.pow(el, maxl > 9 ? 0.3 : 0.7) : m;
    const steps = len < 1 ? 1 : Math.ceil(len);
    const sx = dx / steps, sy = dy / steps;
    let x = x0, y = y0;
    for (let k = 0; k < steps; k++) {
      const ix = x | 0, iy = y | 0;
      if (ix >= 0 && iy >= 0 && ix < W && iy < H) DEN[dc + iy * W + ix] += w;
      x += sx; y += sy;
    }
  }
  function blurHaze() {
    for (let c = 0; c < 4; c++) {
      const o = c * HW * HH;
      for (let pass = 0; pass < 2; pass++) {
        // horizontal
        for (let y = 0; y < HH; y++) {
          const r = o + y * HW;
          for (let x = 0; x < HW; x++) {
            let s = 0;
            for (let k = -2; k <= 2; k++) { const xx = x + k; if (xx >= 0 && xx < HW) s += HZB[r + xx]; }
            HZT[y * HW + x] = s * 0.2;
          }
        }
        for (let x = 0; x < HW; x++) {
          for (let y = 0; y < HH; y++) {
            let s = 0;
            for (let k = -2; k <= 2; k++) { const yy = y + k; if (yy >= 0 && yy < HH) s += HZT[yy * HW + x]; }
            HZB[o + y * HW + x] = s * 0.2;
          }
        }
      }
    }
  }

  /* ---------------------------------------------------------------- composite */
  let KI = 0.55, KH = 0.05;
  function composite(t) {
    const HN = HW * HH;
    for (let y = 0; y < H; y++) {
      const z = clamp((y - S) / (H - S), 0, 1);
      const gy = (y + 0.5) / HC - 0.5, hy = clamp(gy | 0, 0, HH - 2), fy = clamp(gy - hy, 0, 1);
      for (let x = 0; x < W; x++) {
        const i = y * W + x, ys = YS[x];
        const th = bay(x, y);
        if (y < ys) {
          // air: the back wall above the water
          OUT[i] = (y < 6 ? 0.5 - y * 0.08 : 0) + 0.12 * Math.exp(-(ys - y) / 4) > th ? AIR1 : AIR;
          continue;
        }
        if (y === ys) { OUT[i] = MEN; continue; }
        if (y === ys + 1) { OUT[i] = G0; continue; }
        // water ground
        const edge = Math.exp(-x / 9) + Math.exp(-(W - 1 - x) / 9);
        let gl = 1.45 + 3.2 * Math.pow(z, 1.1) + 0.9 * edge - 2.2 * CAU[i];
        if (y <= ys + 3) gl = 0.6 + th * 0.2;
        let gi = fl(gl + th); gi = gi < 0 ? 0 : gi > 5 ? 5 : gi;
        let col = G0 + gi;
        // ink
        const gx = (x + 0.5) / HC - 0.5, hx = clamp(gx | 0, 0, HW - 2), fx = clamp(gx - hx, 0, 1);
        const ho = hy * HW + hx;
        let best = -1, bd = 0, sec = -1, sd = 0, tot = 0;
        for (let c = 0; c < 4; c++) {
          const hb = c * HN + ho;
          const hz = (HZB[hb] * (1 - fx) + HZB[hb + 1] * fx) * (1 - fy) + (HZB[hb + HW] * (1 - fx) + HZB[hb + HW + 1] * fx) * fy;
          const d = DEN[c * N + i] * KI + hz * KH;
          if (d <= 0) continue;
          tot += d;
          if (d > bd) { sec = best; sd = bd; best = c; bd = d; } else if (d > sd) { sec = c; sd = d; }
        }
        if (tot > 0.015) {
          const op = 1 - Math.exp(-tot);
          let lv = op < 0.05 ? 0 : fl(op * 5.4 + th);
          if (lv > 0) {
            if (lv > 5) lv = 5;
            let c = best;
            const share = sec >= 0 ? sd / (bd + sd) : 0;
            if (share > 0.08 && bay2(x, y) < share) c = sec;
            if (share > 0.3 && lv >= 3) col = PAIRI[best][sec] + (lv >= 4 ? 1 : 0);
            else col = RAMP[c] + lv - 1;
          }
        }
        OUT[i] = col;
      }
    }
  }

  /* ---------------------------------------------------------------- bubbles, splashes, falling drops */
  const NB = 70;
  function put(x, y, c) { x = fl(x); y = fl(y); if (x >= 0 && y >= 0 && x < W && y < H) OUT[y * W + x] = c; }
  function bubbles(t) {
    const span = H - S + 12;
    for (let b = 0; b < NB; b++) {
      const n = 1 + fl(ih(b, 1, 3) * 3);
      const y = S + 3 + pmod(ih(b, 2, 3) * span - n * span * t / D, span);
      if (y > H + 4) continue;
      const x = 6 + ih(b, 3, 3) * (W - 12) + 1.4 * Math.sin(TAU * (fl(ih(b, 4, 3) * 4) + 2) * t / D + ih(b, 5, 3) * TAU);
      const sz = ih(b, 6, 3);
      const xi = fl(x), yi = fl(y);
      if (yi <= YS[clamp(xi, 0, W - 1)] + 2) continue;
      if (sz < 0.72) put(xi, yi, OUT[yi * W + xi] >= 10 ? G0 : BUB);
      else if (sz < 0.94) { put(xi, yi, G0); put(xi + 1, yi, BUB); put(xi, yi + 1, BUB); put(xi + 1, yi + 1, BUB); }
      else { put(xi + 1, yi, BUB); put(xi, yi + 1, BUB); put(xi + 2, yi + 1, BUB); put(xi + 1, yi + 2, BUB); put(xi + 1, yi + 1, G0); }
    }
  }
  function splashes(t) {
    for (let j = 0; j < ND; j++) {
      const a = lifeOf(t, j), x0 = DROPS[j].x * W, r = RAMP[DROPS[j].c];
      // the falling drop
      if (a > LIFE - 0.34) {
        const u = (LIFE - a) / 0.34, y = S - (S + 6) * u * u, xi = fl(x0);
        put(xi, y - 1, r + 2); put(xi - 1, y, r + 3); put(xi, y, r + 3); put(xi + 1, y, r + 3);
        put(xi - 1, y + 1, r + 4); put(xi, y + 1, r + 3); put(xi + 1, y + 1, r + 4); put(xi, y + 2, r + 4);
        put(xi - 1, y, r + 1);
        if (u > 0.4) put(xi, y - 2, r + 1);
      }
      if (a > 0.9) continue;
      // crown sheet
      if (a < 0.24) {
        const u = a / 0.24, hgt = 7 * Math.sin(Math.PI * Math.min(1, u * 1.15));
        for (let s = -1; s <= 1; s += 2) for (let k = 0; k < hgt; k++) {
          const xx = x0 + s * (2 + u * 3 + k * 0.45), yy = S - 1 - k;
          put(xx, yy, k > hgt - 2 ? r + 2 : MEN);
        }
        // the cavity under the surface
        const cr = 4 * Math.sin(Math.PI * u);
        for (let yy = 0; yy < cr; yy++) for (let xx = -cr; xx <= cr; xx++) {
          const q = (xx * xx) / (cr * cr) + (yy * yy) / (cr * cr * 0.9);
          if (q < 1) put(x0 + xx, S + 1 + yy, q > 0.6 ? MEN : AIR);
        }
      }
      // crown droplets
      for (let k = 0; k < 11; k++) {
        const s = k & 1 ? 1 : -1;
        const lx = x0 + s * (2 + 3 * ih(j, k, 11)), vx = s * (10 + 34 * ih(j, k, 12)), vy = -(40 + 60 * ih(j, k, 13));
        const a0 = 0.05 + 0.12 * ih(j, k, 14), la = a - a0;
        if (la < 0) continue;
        const xx = lx + vx * la, yy = S - 2 + vy * la + 0.5 * 430 * la * la;
        if (yy >= YS[clamp(fl(xx), 0, W - 1)]) continue;
        put(xx, yy, ih(j, k, 15) < 0.5 ? r + 2 : MEN);
      }
      // Worthington jet
      if (a > 0.2 && a < 0.7) {
        const u = (a - 0.2) / 0.5, hgt = 10 * Math.sin(Math.PI * Math.min(1, u * 1.1));
        for (let k = 0; k < hgt; k++) put(x0, S - 1 - k, k > hgt - 3 ? r + 1 : (k < 2 ? r + 2 : MEN));
        put(x0 - 1, S - 1, MEN); put(x0 + 1, S - 1, MEN);
        if (u > 0.62) { const dy = S - 1 - 10 * 0.95 - 30 * (u - 0.62) + 180 * (u - 0.62) * (u - 0.62); put(x0, dy, r + 2); }
      }
    }
  }

  function drawFrame(t) {
    t = pmod(t, D);
    surface(t);
    caustics(t);
    inkLayer(t);
    blurHaze();
    composite(t);
    bubbles(t);
    splashes(t);
  }

  /* ================================================================ present */
  let IMG = null, SMALL = null, SG = null;
  const LUTR = new Uint8Array(PAL.length * 3); PAL.forEach((p, k) => { LUTR[k * 3] = p[0]; LUTR[k * 3 + 1] = p[1]; LUTR[k * 3 + 2] = p[2]; });
  function present(g) {
    if (!SMALL) { SMALL = document.createElement('canvas'); SMALL.width = W; SMALL.height = H; SG = SMALL.getContext('2d'); IMG = SG.createImageData(W, H); }
    const d = IMG.data;
    for (let i = 0, j = 0; i < N; i++, j += 4) { const k = OUT[i] * 3; d[j] = LUTR[k]; d[j + 1] = LUTR[k + 1]; d[j + 2] = LUTR[k + 2]; d[j + 3] = 255; }
    SG.putImageData(IMG, 0, 0);
    if (!g) return;
    const K = g.canvas.width / W;
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(SMALL, 0, 0, W * K, H * K);
  }

  /* ================================================================ mount */
  (window.PIECES = window.PIECES || []).push({
    id: 'ink-bloom',
    title: 'Ink Bloom',
    medium: 'Eight drops in still water, 270 × 338, advected and dithered in JavaScript · 24 s loop',
    note: 'Each drop’s ink lives exactly one loop · tap to pause',
    about: 'Drops of indigo, vermilion, gold and teal ink fall into a tall tank of clear water seen from the side. Each one punches in with a small splash crown, plunges as a vortex ring, and the ring rolls, slows and splits into smaller rings that split again, drawing the ink into mushroom heads, stems and silk filaments that shear and braid in a slow swirl before thinning into haze. Every thread is a line of ink carried by a smooth, divergence-free flow, one pixel wide; a new drop arrives every three seconds and each drop’s ink lives exactly one loop, so the water never fills up.',
    tone: 'light',
    room: '#e9f0ee',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      { const q = new URLSearchParams(location.search); if (q.has('only')) ONLY = +q.get('only');
        for (const k of ['P_R0', 'P_GROW', 'P_K0', 'P_KP', 'P_K1', 'P_DEL', 'P_VP', 'P_CORE', 'P_SPOKE', 'P_CAP', 'KI', 'KH', 'KREV', 'KC', 'SINPHI', 'LOBE', 'WARP']) if (q.has(k)) eval(k + '=' + parseFloat(q.get(k))); }
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0, built = false, tmr = 0;
      el.style.background = '#e9f0ee';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;image-rendering:pixelated;image-rendering:crisp-edges;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(40,52,70,.7)"/><rect x="19" y="9" width="5" height="16" fill="rgba(40,52,70,.7)"/></svg>';
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
      // the ink is advected once, in slices, so the page stays responsive
      const job = simJob();
      function step() {
        if (!alive) return;
        const t0 = performance.now();
        while (performance.now() - t0 < 40) { if (job.next().done) { finish(); return; } }
        tmr = setTimeout(step, 0);
      }
      const TB = performance.now();
      function finish() {
        built = true;
        console.warn('sim ms', Math.round(performance.now() - TB), TR.map((t) => t.n).join(','));
        render(clock);
        if (EXPORT) {
          const faded = () => { const st = el.parentElement; return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999; };
          window.__inkbloom = {
            duration: D,
            isReady: () => built && faded(),
            renderAt(t) { return new Promise((res) => { const t0 = performance.now(); render(t); window.__inkbloom.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
            lastMs: 0,
          };
          document.documentElement.dataset.ready = 'ink-bloom';
          api.ready();
        } else {
          window.__inkbloom = { duration: D, isReady: () => built, renderAt(t) { return new Promise((res) => { playing = false; clock = t; render(t); requestAnimationFrame(() => res()); }); } };
          api.ready();
          raf = requestAnimationFrame(frame);
        }
      }
      if (EXPORT) {
        const mo = new MutationObserver(() => { if (!built && document.documentElement.dataset.ready) delete document.documentElement.dataset.ready; });
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ready'] });
      }
      // a still, empty tank while the ink is being prepared
      g.fillStyle = '#e9f0ee'; g.fillRect(0, 0, cv.width, cv.height);
      step();
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
          if (window.__inkbloom) delete window.__inkbloom;
        },
      };
    },
  });
})();
