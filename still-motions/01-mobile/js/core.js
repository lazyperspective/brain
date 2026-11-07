// "Mobile" - the whole piece as one self-contained factory (no DOM), so the page, its workers and Node can all run it.
// A Bauhaus hanging mobile, printed as a two-drum risograph (fluorescent pink + teal) on off-white uncoated paper.
//
// Paper space: 2160 x 2700 units (u). A render at scale s has (2160 s) x (2700 s) pixels; `down` box-filters
// that in linear light (s = 2, down = 2 gives a supersampled 2160 x 2700 master).
//
// Everything that belongs to the print set-up (paper tooth and fibres, each drum's film texture, roller streaks,
// halftone screens, edge raggedness, misregistration) is a pure function of paper position, so it stays put while
// the mobile moves; every frame is a fresh pull of the same plates. Every moving thing is a sum of integer
// harmonics of the loop, so frame(t + DUR) == frame(t).
function MobileCore() {
  'use strict';
  const W = 2160, H = 2700, DUR = 20, TAU = Math.PI * 2, W0 = TAU / DUR;

  // ------------------------------------------------------------------ hashing and gradient noise
  function hash(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1103515245);
    h = Math.imul(h ^ (h >>> 16), 2246822519);
    return (h ^ (h >>> 13)) >>> 0;
  }
  const GX = new Float32Array(256), GY = new Float32Array(256);
  for (let i = 0; i < 256; i++) { GX[i] = Math.cos((i + 0.5) / 256 * TAU); GY[i] = Math.sin((i + 0.5) / 256 * TAU); }
  // gradient noise, roughly -1..1 (std ~0.33)
  function noise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const a = hash(xi, yi, s) & 255, b = hash(xi + 1, yi, s) & 255, c = hash(xi, yi + 1, s) & 255, d = hash(xi + 1, yi + 1, s) & 255;
    const n00 = GX[a] * xf + GY[a] * yf, n10 = GX[b] * (xf - 1) + GY[b] * yf;
    const n01 = GX[c] * xf + GY[c] * (yf - 1), n11 = GX[d] * (xf - 1) + GY[d] * (yf - 1);
    const x0 = n00 + (n10 - n00) * u, x1 = n01 + (n11 - n01) * u;
    return (x0 + (x1 - x0) * v) * 1.6;
  }
  const rnd = (i, s) => hash(i, 7919, s) / 4294967296;
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  // logistic approximation of the normal CDF
  const Phi = (x) => 1 / (1 + Math.exp(-1.702 * x));

  // ------------------------------------------------------------------ inks and paper (sRGB as printed on this stock)
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const PAPER = [244, 239, 228].map(lin);
  const INK = { P: [252, 76, 160], T: [30, 124, 142] };
  // reflectance of a full film relative to bare paper, per channel
  const REFL = [INK.P.map((c, k) => Math.min(1, lin(c) / PAPER[k])), INK.T.map((c, k) => Math.min(1, lin(c) / PAPER[k]))];
  const HBINS = 1024, HMAX = 2;
  // FILM[p][ch * HBINS + bin] = refl ^ h  (Beer-Lambert in film thickness h)
  const FILM = REFL.map((R) => { const t = new Float32Array(3 * HBINS); for (let ch = 0; ch < 3; ch++) for (let b = 0; b < HBINS; b++) t[ch * HBINS + b] = Math.pow(R[ch], (b / (HBINS - 1)) * HMAX); return t; });
  // linear -> sRGB 8 bit
  const ENC = new Uint8Array(4097);
  for (let i = 0; i <= 4096; i++) { const c = i / 4096; ENC[i] = Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)); }

  // ------------------------------------------------------------------ the print set-up
  // misregistration of the pink drum relative to teal (constant for the whole run): u offset and a hair of rotation
  const MIS = { dx: 4.6, dy: -3.1, rot: 0.0009 };
  // halftone screens: angle and period (u) per drum
  const SCREEN = [{ ang: (75 * Math.PI) / 180, P: 10.5 }, { ang: (15 * Math.PI) / 180, P: 10.5 }];
  // equalising LUT for the cosine spot function so that a density D prints D of the area
  const ELUT = new Float32Array(1025), DLUT = new Float32Array(1025);
  (function () {
    const N = 384, hist = new Float64Array(1024);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = (i + 0.5) / N, b = (j + 0.5) / N;
      const fa = a - Math.round(a), fb = b - Math.round(b), v = Math.min(0.9999, 2 * (fa * fa + fb * fb));
      hist[Math.min(1023, Math.floor(v * 1024))]++;
    }
    let acc = 0;
    ELUT[0] = 0;
    for (let k = 0; k < 1024; k++) { acc += hist[k]; ELUT[k + 1] = acc / (N * N); }
    for (let k = 0; k <= 1024; k++) { const a = Math.max(0, k - 2), b = Math.min(1024, k + 2); DLUT[k] = (ELUT[b] - ELUT[a]) / ((b - a) / 1024); }
  })();

  // ------------------------------------------------------------------ static (paper-space) fields for one strip of rows
  // fields: paper (luminance factor), tooth (0..1), film[2], edge[2], scrT[2], scrK[2], drop[2]
  const NF = 14;
  function fillStatic(s, j0, j1, F) {
    const Wp = Math.round(W * s), aaw = 1 / s + 0.55;
    let k = 0;
    for (let j = j0; j < j1; j++) {
      const y = (j + 0.5) / s;
      for (let i = 0; i < Wp; i++, k++) {
        const x = (i + 0.5) / s;
        // --- paper: formation clouds, tooth with a raking light, flecks
        const cloud = noise(x / 210, y / 210, 11) * 0.6 + noise(x / 70, y / 70, 12) * 0.4;
        const th = noise(x / 1.35, y / 1.35, 13) * 0.45 + noise(x / 3.2, y / 3.2, 14) * 0.4 + noise(x / 8, y / 8, 15) * 0.3;
        const th2 = noise((x - 0.8) / 1.35, (y - 0.8) / 1.35, 13) * 0.45 + noise((x - 0.8) / 3.2, (y - 0.8) / 3.2, 14) * 0.4 + noise((x - 0.8) / 8, (y - 0.8) / 8, 15) * 0.3;
        let pl = 1 + cloud * 0.018 + (th - th2) * 0.085 + th * 0.016 + noise(x / 26, y / 26, 16) * 0.006;
        // fibres: sparse short curved strands, a touch lighter or darker than the sheet
        const fc = 54, fxi = Math.floor(x / fc), fyi = Math.floor(y / fc);
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const cx = fxi + ox, cy = fyi + oy, h0 = hash(cx, cy, 21);
          if ((h0 & 1023) > 520) continue;
          const px = (cx + (hash(cx, cy, 22) & 1023) / 1024) * fc, py = (cy + (hash(cx, cy, 23) & 1023) / 1024) * fc;
          const ang = ((hash(cx, cy, 24) & 1023) / 1024) * Math.PI, len = 9 + ((hash(cx, cy, 25) & 1023) / 1024) * 34;
          const dx = x - px, dy = y - py, ca = Math.cos(ang), sa = Math.sin(ang);
          const along = dx * ca + dy * sa;
          if (along < -len || along > len) continue;
          const bend = ((hash(cx, cy, 26) & 1023) / 1024 - 0.5) * 0.03;
          const across = -dx * sa + dy * ca - bend * along * along;
          const wdt = 0.55 + ((hash(cx, cy, 27) & 255) / 255) * 0.5;
          const f = Math.max(0, 1 - Math.abs(across) / wdt) * (1 - (along / len) * (along / len));
          if (f > 0) pl += f * ((h0 & 2048) ? 0.035 : -0.055);
        }
        // flecks: rare dark inclusions
        const kc = 46, kxi = Math.floor(x / kc), kyi = Math.floor(y / kc), hk = hash(kxi, kyi, 31);
        if ((hk & 1023) < 22) {
          const rr = 0.5 + ((hash(kxi, kyi, 32) & 255) / 255) * 1.2;
          const px = (kxi + 0.1 + ((hash(kxi, kyi, 33) & 1023) / 1024) * 0.8) * kc, py = (kyi + 0.1 + ((hash(kxi, kyi, 34) & 1023) / 1024) * 0.8) * kc;
          const dd = Math.hypot(x - px, y - py);
          if (dd < rr + 1) pl -= clamp01(rr + 0.5 - dd) * (0.12 + ((hk >>> 12) & 255) / 255 * 0.3);
        }
        F[0][k] = pl;
        F[1][k] = 0.5 + 0.5 * Math.tanh(th * 2.6);
        for (let p = 0; p < 2; p++) {
          const sd = 100 + p * 50;
          // --- film thickness: roller streaks (along the feed, i.e. vertical), mottle, fine grain, a drum-wide drift
          const streak = noise(x / 46, y / 2400, sd) * 0.05 + noise(x / 11, y / 900, sd + 1) * 0.03 + noise(x / 3.5, y / 260, sd + 9) * 0.015;
          const mottle = noise(x / 42, y / 42, sd + 2) * 0.045 + noise(x / 16, y / 16, sd + 3) * 0.018;
          const grain = noise(x / 1.5, y / 1.5, sd + 4) * 0.09 + noise(x / 3.6, y / 3.6, sd + 5) * 0.06;
          const drift = (p ? -0.03 : 0.025) * (x / W - 0.5) + (p ? 0.02 : -0.02) * (y / H - 0.5);
          F[2 + p][k] = 1 + streak + mottle + grain + drift;
          // --- edge raggedness (u), stencil + ink spread
          F[4 + p][k] = noise(x / 2.4, y / 2.4, sd + 6) * 0.65 + noise(x / 7.5, y / 7.5, sd + 7) * 0.55;
          // --- AM halftone threshold and its AA slope
          const S = SCREEN[p], c = Math.cos(S.ang), sn = Math.sin(S.ang);
          const a = (x * c + y * sn) / S.P, b = (-x * sn + y * c) / S.P;
          // round (Euclidean) dots: v grows with the distance to the nearest dot centre
          const fa = a - Math.round(a), fb = b - Math.round(b), r2 = fa * fa + fb * fb;
          const v = Math.min(0.9999, 2 * r2);
          const vi = v * 1024, v0 = Math.min(1023, vi | 0), fr = vi - v0;
          const E = ELUT[v0] + (ELUT[v0 + 1] - ELUT[v0]) * fr, dE = DLUT[v0] + (DLUT[v0 + 1] - DLUT[v0]) * fr;
          const G = dE * (4 * Math.sqrt(r2) / S.P) + 0.004;
          F[6 + p][k] = E + (noise(x / 2.1, y / 2.1, sd + 8) * 0.6 + noise(x / 5.5, y / 5.5, sd + 10) * 0.4) * 0.07;
          F[8 + p][k] = Math.min(60, 1 / (G * (aaw + 0.45)));
          // smallest dot the stencil holds, varying cell to cell
          // scumming: rare stray specks of ink picked up off the drum
          const sc = 64, sxi = Math.floor(x / sc), syi = Math.floor(y / sc), hs = hash(sxi, syi, sd + 40);
          let speck = 0;
          if ((hs & 1023) < 26) {
            const rr = 0.5 + ((hs >>> 10) & 255) / 255 * 1.1;
            const px = (sxi + 0.1 + ((hash(sxi, syi, sd + 41) & 1023) / 1024) * 0.8) * sc, py = (syi + 0.1 + ((hash(sxi, syi, sd + 42) & 1023) / 1024) * 0.8) * sc;
            speck = clamp01(rr + 0.5 - Math.hypot(x - px, y - py)) * (0.5 + ((hs >>> 18) & 255) / 510);
          }
          F[12 + p][k] = speck;
          F[10 + p][k] = 0.03 + 0.08 * (0.5 + 0.5 * noise(x / (S.P * 0.8), y / (S.P * 0.8), sd + 11));
        }
      }
    }
  }

  // ------------------------------------------------------------------ the mobile (u, y down, z towards the viewer)
  // arm: { lt thread length from the parent's hook, Ll/Lr lever lengths, yaw rest angle, bow sag, tilt, L, R }
  // shape: { kind, ink 'P' | 'T' | 'PT' (overprint), lt, yaw, size params, tint (halftone density instead of solid) }
  const A = (o) => Object.assign({ type: 'arm', bow: 16, tilt: 0, Tn: 9 }, o);
  const S = (o) => Object.assign({ type: 'shape', yaw: 0, roll: 0, Tn: 6, cd: 1 }, o);
  // arms give a `span`; the pivot is placed where the two sides balance (torque of sheet areas + wire weight)
  const SCENE = {
    ceil: [740, -90], z0: 330,
    root: A({ lt: 520, span: 850, yaw: 0.16, bow: 26, tilt: -0.012, Tn: 13, amp: 0.1,
      L: S({ kind: 'disc', r: 345, lt: 160, ink: 'P', yaw: 0.1, Tn: 8, amp: 0.5 }),
      R: A({ lt: 280, span: 580, yaw: -0.28, bow: -14, tilt: 0.02, Tn: 10, amp: 0.16,
        R: S({ kind: 'half', r: 175, lt: 110, ink: 'P', tint: 0.62, yaw: -0.1, Tn: 6.5, amp: 0.4 }),
        L: A({ lt: 330, span: 740, yaw: 0.22, bow: 20, tilt: -0.01, Tn: 8, amp: 0.2,
          L: S({ kind: 'quarter', r0: 120, r1: 235, lt: 70, ink: 'T', yaw: 0.15, Tn: 5.5, amp: 0.42 }),
          R: A({ lt: 420, span: 500, yaw: -0.4, bow: 12, tilt: 0.015, Tn: 7, amp: 0.24,
            L: S({ kind: 'bar', w: 440, h: 38, lt: 90, ink: 'T', yaw: -0.15, Tn: 4.6, amp: 0.36 }),
            R: A({ lt: 330, span: 420, yaw: 0.7, bow: -8, Tn: 5.8, amp: 0.28,
              L: S({ kind: 'tri', side: 200, lt: 70, ink: 'PT', yaw: 0.25, Tn: 4.2, amp: 0.45 }),
              R: S({ kind: 'disc', r: 64, lt: 100, ink: 'PT', yaw: 0.3, Tn: 5, amp: 0.45 }),
            }),
          }),
        }),
      }),
    }),
  };
  const SHADOW_INK = [0.3, 1], WIRE_SHADOWS = false, WIRE_INK = 'T', WIRE_HW = 2.6, THREAD_HW = 1.45;
  const LIGHT = { kx: 0.24, ky: 0.36, sig0: 3, sigK: 0.035 }; // shadow offset per unit depth; penumbra grows with depth
  const FOCAL = 9000, CX = W / 2, CY = H / 2;

  // ---- shape geometry in local (u, v): origin at the hanging point, v down
  function shapeInfo(n) {
    switch (n.kind) {
      case 'disc': return { area: Math.PI * n.r * n.r, rg2: n.r * n.r / 4, size: n.r, bb: [-n.r, 0, n.r, 2 * n.r], thick: n.r };
      case 'half': return { area: Math.PI * n.r * n.r / 2, rg2: n.r * n.r / 4, size: n.r, bb: [-n.r, 0, n.r, n.r], thick: n.r * 0.6 };
      case 'quarter': { const rm = (n.r0 + n.r1) / 2; return { area: Math.PI * (n.r1 * n.r1 - n.r0 * n.r0) / 4, rg2: rm * rm * 0.6, size: n.r1, bb: [-n.r1 * 0.75, -2, n.r1 * 0.75, n.r1 * 1.08], thick: (n.r1 - n.r0) / 2 }; }
      case 'bar': return { area: n.w * n.h, rg2: n.w * n.w / 12, size: n.w / 2, bb: [-n.w / 2, 0, n.w / 2, n.h], thick: n.h / 2 };
      case 'tri': { const h = n.side * Math.sqrt(3) / 2; return { area: n.side * h / 2, rg2: n.side * n.side / 24, size: n.side / 2, bb: [-n.side / 2, 0, n.side / 2, h], thick: h / 3 }; }
    }
  }

  // ------------------------------------------------------------------ physics: a linear model solved per harmonic
  // Yaw (twist about each hanging thread) is a coupled torsion system: each element's thread is a torsion spring to
  // its parent, the draught is a travelling gust made of loop harmonics, and the periodic steady state is solved
  // exactly per harmonic, (K - w^2 I + i w C) psi = F, so lower elements answer with their own lag and resonance.
  // Arm tilt and shape roll are near quasi-static pendulum responses to the same gust.
  const nodes = [];
  (function index(n, parent, side) {
    n.id = nodes.length; n.parent = parent; n.lr = side; nodes.push(n);
    if (n.type === 'arm') { index(n.L, n, -1); index(n.R, n, 1); }
    else n.info = shapeInfo(n);
  })(SCENE.root, null, 0);
  (function mass(n) {
    if (n.type === 'shape') { n.m = n.info.area * 1e-4; n.area = n.info.area * 1e-4; return n.m; }
    n.mL = mass(n.L); n.mR = mass(n.R);
    if (n.span) { n.Ll = (n.span * n.mR) / (n.mL + n.mR); n.Lr = n.span - n.Ll; }
    n.m = n.mL + n.mR + (n.Ll + n.Lr) * 5e-4; n.area = n.L.area + n.R.area;
    return n.m;
  })(SCENE.root);
  const HARM = [1, 2, 3, 4];
  const GUST = { amp: [1, 0.45, 0.2, 0.08], ph: [0.4, 2.1, 4.0, 5.3], dir: [0.82, 0.57], speed: 1700 };
  // rest positions (no motion) give the gust phase per element
  const restPos = {};
  function gustC(k, x, y) { // complex gust amplitude of harmonic index k at (x, y)
    const w = HARM[k] * W0, ph = GUST.ph[k] - (w / GUST.speed) * (x * GUST.dir[0] + y * GUST.dir[1]);
    return [GUST.amp[k] * Math.cos(ph), GUST.amp[k] * Math.sin(ph)];
  }
  // complex dense solve
  function csolve(Ar, Ai, br, bi, N) {
    for (let c = 0; c < N; c++) {
      let piv = c, best = 0;
      for (let r = c; r < N; r++) { const m = Ar[r][c] ** 2 + Ai[r][c] ** 2; if (m > best) { best = m; piv = r; } }
      [Ar[c], Ar[piv]] = [Ar[piv], Ar[c]]; [Ai[c], Ai[piv]] = [Ai[piv], Ai[c]];
      [br[c], br[piv]] = [br[piv], br[c]]; [bi[c], bi[piv]] = [bi[piv], bi[c]];
      const dr = Ar[c][c], di = Ai[c][c], dd = dr * dr + di * di;
      for (let r = c + 1; r < N; r++) {
        const fr = (Ar[r][c] * dr + Ai[r][c] * di) / dd, fi = (Ai[r][c] * dr - Ar[r][c] * di) / dd;
        for (let q = c; q < N; q++) { Ar[r][q] -= fr * Ar[c][q] - fi * Ai[c][q]; Ai[r][q] -= fr * Ai[c][q] + fi * Ar[c][q]; }
        br[r] -= fr * br[c] - fi * bi[c]; bi[r] -= fr * bi[c] + fi * br[c];
      }
    }
    const xr = new Float64Array(N), xi = new Float64Array(N);
    for (let r = N - 1; r >= 0; r--) {
      let sr = br[r], si = bi[r];
      for (let q = r + 1; q < N; q++) { sr -= Ar[r][q] * xr[q] - Ai[r][q] * xi[q]; si -= Ar[r][q] * xi[q] + Ai[r][q] * xr[q]; }
      const dr = Ar[r][r], di = Ai[r][r], dd = dr * dr + di * di;
      xr[r] = (sr * dr + si * di) / dd; xi[r] = (si * dr - sr * di) / dd;
    }
    return [xr, xi];
  }
  const MOT = { yaw: [], tilt: [], roll: [], sway: [] }; // per node: per harmonic [re, im]
  function solveMotion() {
    const N = nodes.length;
    // rest kinematics for gust phases
    const st = kinematics(null);
    for (const n of nodes) {
      if (n.type === 'arm') { n.I = n.mL * n.Ll * n.Ll + n.mR * n.Lr * n.Lr; }
      else n.I = n.m * n.info.rg2;
      const wn = TAU / n.Tn; n.kap = n.I * wn * wn; n.c = 2 * 0.22 * n.I * wn;
    }
    // per-element drag gains are calibrated (a few fixed-point passes) so that each element's twist reaches its
    // design amplitude `amp`; the coupling, lags and resonances stay those of the solved system
    let yawAmp = new Float64Array(N);
    for (const n of nodes) n.cdk = 1;
    for (let pass = 0; pass < 14; pass++) {
      yawAmp = new Float64Array(N);
      for (let k = 0; k < HARM.length; k++) {
        const w = HARM[k] * W0;
        const Ar = [], Ai = [], br = new Float64Array(N), bi = new Float64Array(N);
        for (let r = 0; r < N; r++) { Ar.push(new Float64Array(N)); Ai.push(new Float64Array(N)); }
        for (const n of nodes) {
          const i = n.id;
          Ar[i][i] += n.kap - w * w * n.I; Ai[i][i] += w * n.c;
          if (n.parent) { const p = n.parent.id; Ar[p][p] += n.kap; Ar[i][p] -= n.kap; Ar[p][i] -= n.kap; }
          let fr = 0, fi = 0;
          if (n.type === 'arm') {
            const eL = st.ends[i][0], eR = st.ends[i][1];
            const gL = gustC(k, eL[0], eL[1]), gR = gustC(k, eR[0], eR[1]), cy = Math.cos(n.yaw);
            fr = (n.Lr * n.R.area * gR[0] - n.Ll * n.L.area * gL[0]) * cy; fi = (n.Lr * n.R.area * gR[1] - n.Ll * n.L.area * gL[1]) * cy;
          } else {
            const h = st.hang[i], g = gustC(k, h[0], h[1] + n.info.size);
            fr = 0.35 * n.area * n.info.size * g[0]; fi = 0.35 * n.area * n.info.size * g[1];
          }
          br[i] = fr * n.cdk; bi[i] = fi * n.cdk;
        }
        const [xr, xi] = csolve(Ar, Ai, br, bi, N);
        for (const n of nodes) { (MOT.yaw[n.id] = MOT.yaw[n.id] || [])[k] = [xr[n.id], xi[n.id]]; yawAmp[n.id] += Math.hypot(xr[n.id], xi[n.id]); }
      }
      for (const n of nodes) n.cdk *= Math.pow(n.amp / yawAmp[n.id], 0.7);
    }
    // tilt and roll: driven pendulums well below resonance (lightly lagged quasi-static answers to the gust)
    for (let k = 0; k < HARM.length; k++) {
      const w = HARM[k] * W0;
      for (const n of nodes) {
        const wt = TAU / 3.2, rr = 1 - (w / wt) ** 2, ri = 2 * 0.3 * (w / wt), dd = rr * rr + ri * ri;
        let gr, gi;
        if (n.type === 'arm') { const a = gustC(k, st.ends[n.id][1][0], st.ends[n.id][1][1]), b = gustC(k, st.ends[n.id][0][0], st.ends[n.id][0][1]); gr = a[0] - b[0]; gi = a[1] - b[1]; }
        else { const g = gustC(k, st.hang[n.id][0], st.hang[n.id][1]); gr = g[0]; gi = g[1]; }
        (MOT.tilt[n.id] = MOT.tilt[n.id] || [])[k] = [(gr * rr + gi * ri) / dd, (gi * rr - gr * ri) / dd];
      }
      const g = gustC(k, SCENE.ceil[0], 300);
      MOT.sway[k] = [g[0], g[1]];
    }
    const tAmp = nodes.map((n) => MOT.tilt[n.id].reduce((a, v) => a + Math.hypot(v[0], v[1]), 0));
    for (const n of nodes) { const target = n.type === 'arm' ? 0.022 : 0.03; for (const v of MOT.tilt[n.id]) { v[0] *= target / tAmp[n.id]; v[1] *= target / tAmp[n.id]; } }
    const sAmp = MOT.sway.reduce((a, v) => a + Math.hypot(v[0], v[1]), 0);
    for (const v of MOT.sway) { v[0] *= 7 / sAmp; v[1] *= 7 / sAmp; }
    MOT.yawAmp = nodes.map((n) => yawAmp[n.id]);
  }
  const harm = (arr, t) => { let s = 0; for (let k = 0; k < HARM.length; k++) { const a = HARM[k] * W0 * t; s += arr[k][0] * Math.cos(a) - arr[k][1] * Math.sin(a); } return s; };

  // ------------------------------------------------------------------ kinematics -> 3D geometry for time t (null = rest)
  function kinematics(t) {
    const out = { ends: [], hang: [], shapes: [], wires: [] };
    const sway = t == null ? 0 : harm(MOT.sway, t);
    const ceil = [SCENE.ceil[0] + sway * 0.2, SCENE.ceil[1], SCENE.z0];
    (function walk(n, att) {
      const hang = [att[0] + (n === SCENE.root ? sway : 0), att[1] + n.lt, att[2]];
      out.hang[n.id] = hang;
      out.wires.push({ pts: [att, hang], hw: THREAD_HW });
      const dyaw = t == null ? 0 : harm(MOT.yaw[n.id], t), dtilt = t == null ? 0 : harm(MOT.tilt[n.id], t);
      if (n.type === 'arm') {
        const yaw = n.yaw + dyaw, tilt = n.tilt + dtilt;
        const dx = Math.cos(tilt) * Math.cos(yaw), dy = Math.sin(tilt), dz = Math.cos(tilt) * Math.sin(yaw);
        const span = n.Ll + n.Lr, mid = (n.Lr - n.Ll) / 2;
        const sag = (s) => n.bow * (((s - mid) / (span / 2)) ** 2 - ((0 - mid) / (span / 2)) ** 2);
        const P = (s) => [hang[0] + s * dx, hang[1] + s * dy + sag(s), hang[2] + s * dz];
        const pts = [];
        for (let q = 0; q <= 48; q++) pts.push(P(-n.Ll + (span * q) / 48));
        out.wires.push({ pts, hw: WIRE_HW });
        // small hooks at both ends (a loop of wire, seen in the arm's plane) and a binding at the pivot
        const ends = [];
        for (const [s, sg] of [[-n.Ll, -1], [n.Lr, 1]]) {
          const e = P(s), r = 8.5, lp = [];
          for (let q = 0; q <= 20; q++) { const a = sg * (-Math.PI / 2 + (q / 20) * Math.PI * 1.75); lp.push([e[0] + sg * r * Math.cos(a) * Math.cos(yaw) * 0.0 + r * Math.sin(a) * dx * sg, e[1] + r - r * Math.cos(a), e[2] + r * Math.sin(a) * dz * sg]); }
          out.wires.push({ pts: lp, hw: WIRE_HW * 0.85, small: true });
          ends.push([e[0], e[1] + 2 * r, e[2]]);
        }
        const bind = [];
        for (let q = 0; q <= 14; q++) { const a = (q / 14) * TAU; bind.push([hang[0] + 5 * Math.sin(a) * dx, hang[1] - 5 + 5 * Math.cos(a), hang[2] + 5 * Math.sin(a) * dz]); }
        out.wires.push({ pts: bind, hw: THREAD_HW * 1.1, small: true });
        out.ends[n.id] = ends;
        walk(n.L, ends[0]); walk(n.R, ends[1]);
      } else {
        out.shapes.push({ n, hang, yaw: n.yaw + dyaw, roll: n.roll + dtilt });
      }
    })(SCENE.root, ceil);
    return out;
  }

  // ------------------------------------------------------------------ primitives in screen space (u)
  const persp = (z) => (FOCAL - SCENE.z0) / (FOCAL - z);
  const proj = (P) => { const m = persp(P[2]); return [CX + (P[0] - CX) * m, CY + (P[1] - CY) * m]; };
  const projShadow = (P) => { const m = persp(0); return [CX + (P[0] + P[2] * LIGHT.kx - CX) * m, CY + (P[1] + P[2] * LIGHT.ky - CY) * m]; };
  // plate transform for the pink drum: q = R (p - c) + c - d   (screen -> plate)
  const plateXf = [{ c: Math.cos(MIS.rot), s: Math.sin(MIS.rot), dx: MIS.dx, dy: MIS.dy }, null];
  function plateMapPoint(p, pl) { // where a screen-space feature lands on the paper when printed by drum pl
    const X = plateXf[pl]; if (!X) return p;
    const x = p[0] - CX, y = p[1] - CY;
    return [CX + X.c * x - X.s * y + X.dx, CY + X.s * x + X.c * y + X.dy];
  }
  const KIND = { disc: 0, half: 1, quarter: 2, bar: 3, tri: 4 };
  // shape prim: local = M (q - O); `fwd` maps local -> screen for the bbox
  function shapePrim(sh, shadow, pl) {
    const n = sh.n, cy = Math.cos(sh.yaw), sy = Math.sin(sh.yaw), cr = Math.cos(sh.roll), sr = Math.sin(sh.roll);
    let O, a, b, c, d; // forward linear [a b; c d] local -> screen (before plate map)
    if (!shadow) {
      const m = persp(sh.hang[2]);
      O = proj(sh.hang);
      const cyy = Math.abs(cy) < 0.015 ? 0.015 * Math.sign(cy || 1) : cy;
      a = m * cyy * cr; b = -m * cyy * sr; c = m * sr; d = m * cr;
    } else {
      const m = persp(0);
      O = projShadow(sh.hang);
      // S(u', v') = (u' cos + u' sin kx, v' + u' sin ky), u' = u cr - v sr, v' = u sr + v cr
      const p00 = cy + sy * LIGHT.kx, p10 = sy * LIGHT.ky;
      a = m * p00 * cr; b = -m * p00 * sr; c = m * (p10 * cr + sr); d = m * (-p10 * sr + cr);
      if (Math.abs(a * d - b * c) < 1e-4 * m * m) a += 0.02 * m;
    }
    if (pl != null && plateXf[pl]) {
      const X = plateXf[pl];
      O = plateMapPoint(O, pl);
      const na = X.c * a - X.s * c, nb = X.c * b - X.s * d, nc = X.s * a + X.c * c, nd = X.s * b + X.c * d;
      a = na; b = nb; c = nc; d = nd;
    }
    const det = a * d - b * c;
    const M = [d / det, -b / det, -c / det, a / det];
    const bb = n.info.bb;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [u, v] of [[bb[0], bb[1]], [bb[2], bb[1]], [bb[0], bb[3]], [bb[2], bb[3]]]) {
      const X = O[0] + a * u + b * v, Y = O[1] + c * u + d * v;
      x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
    }
    const P = { t: 0, k: KIND[n.kind], M, O, x0, y0, x1, y1, n, thick: n.info.thick * Math.min(1, Math.abs(cy) + 0.25) };
    return P;
  }
  // signed distance in local units; writes the local gradient into G
  const G = [0, 0];
  function sdf(P, u, v) {
    const n = P.n;
    switch (P.k) {
      case 0: { const dx = u, dy = v - n.r, L = Math.hypot(dx, dy) || 1e-9; G[0] = dx / L; G[1] = dy / L; return L - n.r; }
      case 1: { const L = Math.hypot(u, v) || 1e-9, d1 = L - n.r, d2 = -v; if (d1 > d2) { G[0] = u / L; G[1] = v / L; return d1; } G[0] = 0; G[1] = -1; return d2; }
      case 2: { // quarter annulus: centre at (-rm*0.7071... ) chosen so the hanging point is the top of the arc's outer corner
        const cx = n.qcx, cyy = n.qcy, dx = u - cx, dy = v - cyy, L = Math.hypot(dx, dy) || 1e-9, rm = (n.r0 + n.r1) / 2, ht = (n.r1 - n.r0) / 2;
        const sgn = L > rm ? 1 : -1, dr = Math.abs(L - rm) - ht;
        // wedge: angles between n.a0 and n.a0 + 90 deg (screen angle, y down)
        const d1 = dx * n.w1[0] + dy * n.w1[1], d2 = dx * n.w2[0] + dy * n.w2[1];
        let d = dr; G[0] = (sgn * dx) / L; G[1] = (sgn * dy) / L;
        if (d1 > d) { d = d1; G[0] = n.w1[0]; G[1] = n.w1[1]; }
        if (d2 > d) { d = d2; G[0] = n.w2[0]; G[1] = n.w2[1]; }
        return d;
      }
      case 3: { const hw = n.w / 2, hh = n.h / 2, qx = Math.abs(u) - hw, qy = Math.abs(v - hh) - hh;
        if (qx > 0 && qy > 0) { const L = Math.hypot(qx, qy); G[0] = Math.sign(u) * qx / L; G[1] = Math.sign(v - hh) * qy / L; return L; }
        if (qx > qy) { G[0] = Math.sign(u) || 1; G[1] = 0; return qx; } G[0] = 0; G[1] = Math.sign(v - hh) || 1; return qy; }
      case 4: { let d = -1e9; for (const e of n.tri) { const dd = u * e[0] + v * e[1] - e[2]; if (dd > d) { d = dd; G[0] = e[0]; G[1] = e[1]; } } return d; }
    }
    return 1e9;
  }
  // derived geometry for quarter and triangle
  for (const n of nodes) {
    if (n.kind === 'quarter') {
      // arc spanning from straight up-left to straight down-left of its centre?  Use a quarter whose outer arc's
      // midpoint is the hanging point: centre below-right, wedge opening up-left.
      const rm = (n.r0 + n.r1) / 2; const a0 = -Math.PI * 0.75 - Math.PI / 4; // wedge from 180 deg to 270 deg (left and up)
      n.qcx = n.r1 * Math.SQRT1_2 * 0; n.qcy = n.r1 * 1.0;
      // wedge centred on straight up (-90 deg): from -135 to -45 deg, so the piece is a rainbow-like arch hung at its crown
      const t1 = -Math.PI * 0.75, t2 = -Math.PI * 0.25;
      // inside half-planes: points whose angle is between t1 and t2. Plane normals point outward.
      n.w1 = [Math.sin(t1), -Math.cos(t1)]; // left boundary (normal pointing to the left/outside)
      n.w2 = [-Math.sin(t2), Math.cos(t2)];
      n.info.bb = [-n.r1 * 0.72, -2, n.r1 * 0.72, n.r1 - n.r0 * 0.7071 + 4];
      void rm; void a0;
    }
    if (n.kind === 'tri') {
      const s = n.side, h = (s * Math.sqrt(3)) / 2; // apex at the hanging point, base below
      const V = [[0, 0], [s / 2, h], [-s / 2, h]];
      n.tri = [];
      for (let e = 0; e < 3; e++) {
        const p = V[e], q = V[(e + 1) % 3], ex = q[0] - p[0], ey = q[1] - p[1], L = Math.hypot(ex, ey);
        const nx = ey / L, ny = -ex / L; // outward for clockwise order in y-down space
        n.tri.push([nx, ny, nx * p[0] + ny * p[1]]);
      }
      // make sure normals point outwards (centroid must be inside)
      const cxx = 0, cyy = (2 * h) / 3;
      for (const e of n.tri) if (cxx * e[0] + cyy * e[1] - e[2] > 0) { e[0] = -e[0]; e[1] = -e[1]; e[2] = -e[2]; }
    }
  }
  solveMotion();

  function linePrim(pts, hw, mapPt) {
    const q = pts.map(mapPt);
    const flat = new Float64Array(q.length * 2);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    q.forEach((p, i) => { flat[2 * i] = p[0]; flat[2 * i + 1] = p[1]; x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    return { t: 1, pts: flat, hw, x0, y0, x1, y1 };
  }

  function buildFrame(t) {
    const g = kinematics(t);
    const fr = { obj: [], P: [], T: [], shadow: [] };
    for (const sh of g.shapes) {
      const base = shapePrim(sh, false, null);
      const ink = sh.n.ink;
      base.inkT = ink.includes('T'); base.tint = sh.n.tint || 0;
      fr.obj.push(base);
      if (ink.includes('P')) { const p = shapePrim(sh, false, 0); p.tint = sh.n.tint || 0; fr.P.push(p); }
      const s = shapePrim(sh, true, null);
      s.sig = LIGHT.sig0 + LIGHT.sigK * sh.hang[2];
      s.dens = 0.46 * (1 - 0.25 * clamp01(sh.hang[2] / 1200));
      fr.shadow.push(s);
    }
    for (const w of g.wires) { // wires print in teal; their shadows are too fine for the screen to hold, so none
      const l = linePrim(w.pts, w.hw, proj);
      l.inkT = WIRE_INK.includes('T');
      fr.obj.push(l);
      if (WIRE_INK.includes('P')) fr.P.push(linePrim(w.pts, w.hw, (p) => plateMapPoint(proj(p), 0)));
      if (w.small || !WIRE_SHADOWS) continue;
      const zMean = w.pts.reduce((a, p) => a + p[2], 0) / w.pts.length;
      const s = linePrim(w.pts, w.hw * 1.3, projShadow);
      s.sig = 3 + 0.014 * zMean; s.dens = 0.4;
      fr.shadow.push(s);
    }
    return fr;
  }

  // ------------------------------------------------------------------ low-resolution dynamic fields (grid of GS u)
  const GS = 4, GW = W / GS, GH = H / GS;
  const shadowLow = new Float32Array(GW * GH), starvLow = [new Float32Array(GW * GH), new Float32Array(GW * GH)];
  const tmpLow = new Float32Array(GW * GH);
  let starvMottle = null, ghostLow = null;
  // set-off: a faint, mottled, upside-down ghost of the pink plate picked up from the next sheet in the stack (static)
  function buildGhost() {
    const fr0 = buildFrame(0), g = new Float32Array(GW * GH);
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const x = (gx + 0.5) * GS, y = (gy + 0.5) * GS, xs = x - 70, ys = H - y + 150;
      let c = 0;
      for (const P of fr0.P) {
        if (P.t !== 0 || xs < P.x0 - 20 || xs > P.x1 + 20 || ys < P.y0 - 20 || ys > P.y1 + 20) continue;
        const qx = xs - P.O[0], qy = ys - P.O[1], M = P.M;
        const d = sdf(P, M[0] * qx + M[1] * qy, M[2] * qx + M[3] * qy), gxs = M[0] * G[0] + M[2] * G[1], gys = M[1] * G[0] + M[3] * G[1];
        c = Math.max(c, Phi(-d / (Math.hypot(gxs, gys) || 1e-9) / 5));
      }
      if (c > 0.001) {
        const m = clamp01(0.45 + noise(x / 90, y / 90, 401) * 0.9 + noise(x / 24, y / 24, 402) * 0.45) * clamp01(0.5 + noise(x / 400, y / 400, 403) * 1.2);
        g[gy * GW + gx] = c * m;
      }
    }
    return g;
  }
  function lowFields(fr, gyA, gyB) {
    // shadow: product of (1 - density) over casters, each caster's own coverage taken as a union (max)
    for (let k = gyA * GW; k < (gyB + 1) * GW; k++) shadowLow[k] = 1;
    for (const P of fr.shadow) {
      const pad = 3 * P.sig + 4;
      const gx0 = Math.max(0, Math.floor((P.x0 - pad) / GS)), gx1 = Math.min(GW - 1, Math.ceil((P.x1 + pad) / GS));
      const gy0 = Math.max(gyA, Math.floor((P.y0 - pad) / GS)), gy1 = Math.min(gyB, Math.ceil((P.y1 + pad) / GS));
      if (gx1 < gx0 || gy1 < gy0) continue;
      for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) tmpLow[gy * GW + gx] = 0;
      if (P.t === 0) {
        const M = P.M, th = P.thick;
        for (let gy = gy0; gy <= gy1; gy++) {
          const y = (gy + 0.5) * GS;
          for (let gx = gx0; gx <= gx1; gx++) {
            const x = (gx + 0.5) * GS, qx = x - P.O[0], qy = y - P.O[1];
            const u = M[0] * qx + M[1] * qy, v = M[2] * qx + M[3] * qy;
            const d = sdf(P, u, v), gxs = M[0] * G[0] + M[2] * G[1], gys = M[1] * G[0] + M[3] * G[1];
            const ds = d / (Math.hypot(gxs, gys) || 1e-9);
            const sc = Phi(-ds / P.sig) - Phi((-ds - 2 * th) / P.sig);
            tmpLow[gy * GW + gx] = sc;
          }
        }
      } else {
        const pts = P.pts, np = pts.length / 2;
        for (let gy = gy0; gy <= gy1; gy++) {
          const y = (gy + 0.5) * GS;
          for (let gx = gx0; gx <= gx1; gx++) {
            const x = (gx + 0.5) * GS;
            let best = 1e18;
            for (let q = 0; q < np - 1; q++) {
              const ax = pts[2 * q], ay = pts[2 * q + 1], bx = pts[2 * q + 2], by = pts[2 * q + 3];
              const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey || 1e-9;
              let tt = ((x - ax) * ex + (y - ay) * ey) / l2; tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
              const dx = x - ax - tt * ex, dy = y - ay - tt * ey, dd = dx * dx + dy * dy;
              if (dd < best) best = dd;
            }
            const dist = Math.sqrt(best);
            tmpLow[gy * GW + gx] = Phi((P.hw - dist) / P.sig) - Phi((-P.hw - dist) / P.sig);
          }
        }
      }
      for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) { const k = gy * GW + gx; shadowLow[k] *= 1 - P.dens * tmpLow[k]; }
    }
    for (let k = gyA * GW; k < (gyB + 1) * GW; k++) shadowLow[k] = 1 - shadowLow[k];
    // ink starvation: the drum loses ink across a long solid in the feed direction (top to bottom of the sheet)
    for (let p = 0; p < 2; p++) {
      const cov = starvLow[p];
      cov.fill(0, 0, (gyB + 1) * GW);
      const list = p === 0 ? fr.P : fr.obj.filter((o) => o.t === 0 && o.inkT);
      for (const P of list) {
        if (P.t !== 0) continue;
        const gx0 = Math.max(0, Math.floor(P.x0 / GS)), gx1 = Math.min(GW - 1, Math.ceil(P.x1 / GS));
        const gy0 = Math.max(0, Math.floor(P.y0 / GS)), gy1 = Math.min(gyB, Math.ceil(P.y1 / GS));
        const M = P.M;
        for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
          const qx = (gx + 0.5) * GS - P.O[0], qy = (gy + 0.5) * GS - P.O[1];
          const d = sdf(P, M[0] * qx + M[1] * qy, M[2] * qx + M[3] * qy), gxs = M[0] * G[0] + M[2] * G[1], gys = M[1] * G[0] + M[3] * G[1];
          const c = clamp01(0.5 - d / (Math.hypot(gxs, gys) || 1e-9) / GS), k = gy * GW + gx;
          if (c > cov[k]) cov[k] = c;
        }
      }
      // exponential memory down each column, then only where ink is
      const a = Math.exp(-GS / 520);
      for (let gx = 0; gx < GW; gx++) {
        let e = 0;
        for (let gy = 0; gy <= gyB; gy++) { const k = gy * GW + gx; e = e * a + cov[k] * (1 - a); cov[k] = e * starvMottle[p][k]; }
      }
    }
  }

  // ------------------------------------------------------------------ the frame
  let cache = null; // { s, F: [NF arrays] } for whole-frame static fields
  function prepare(s) {
    if (!starvMottle) {
      starvMottle = [0, 1].map((p) => { const a = new Float32Array(GW * GH); for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) { const x = (gx + 0.5) * GS, y = (gy + 0.5) * GS; a[gy * GW + gx] = Math.max(0, 1 + noise(x / 60, y / 60, 300 + p) * 0.9 + noise(x / 22, y / 22, 310 + p) * 0.5); } return a; });
    }
    if (!ghostLow) ghostLow = buildGhost();
    if (s > 1.01) { cache = null; return; }
    if (cache && cache.s === s) return;
    const Wp = Math.round(W * s), Hp = Math.round(H * s);
    const F = []; for (let f = 0; f < NF; f++) F.push(new Float32Array(Wp * Hp));
    fillStatic(s, 0, Hp, F);
    cache = { s, F };
  }

  // render output rows [oy0, oy1) of the (W s / down) x (H s / down) picture; returns that band
  function render(t, s, down, out, oy0, oy1) {
    prepare(s);
    const Wp = Math.round(W * s), Hp = Math.round(H * s), Wo = Wp / down, Ho = Hp / down;
    oy0 = oy0 || 0; oy1 = oy1 == null ? Ho : oy1;
    out = out || new Uint8ClampedArray(Wo * (oy1 - oy0) * 4);
    const fr = buildFrame(((t % DUR) + DUR) % DUR);
    const jA = oy0 * down, jB = oy1 * down;
    lowFields(fr, Math.max(0, Math.floor(jA / s / GS) - 2), Math.min(GH - 1, Math.ceil(jB / s / GS) + 2));
    const SH = 16 * down, aaw = 1 / s + 0.9;
    const covS = [new Float32Array(Wp * SH), new Float32Array(Wp * SH)], tint = [new Float32Array(Wp * SH), new Float32Array(Wp * SH)], obj = new Float32Array(Wp * SH);
    const sF = []; if (!cache) for (let f = 0; f < NF; f++) sF.push(new Float32Array(Wp * SH));
    const acc = new Float32Array(Wo * 3);
    for (let j0 = jA; j0 < jB; j0 += SH) {
      const j1 = Math.min(jB, j0 + SH), base = j0 * Wp;
      let F, off;
      if (cache) { F = cache.F; off = base; } else { fillStatic(s, j0, j1, sF); F = sF; off = 0; }
      for (let p = 0; p < 2; p++) { covS[p].fill(0); tint[p].fill(0); }
      obj.fill(0);
      const ys0 = j0 / s, ys1 = j1 / s;
      // rasterise: identity frame (knockout + teal) then the pink drum's frame
      const raster = (P, pl, target, tintT) => {
        if (P.y1 + 4 < ys0 || P.y0 - 4 > ys1) return;
        const pad = P.t ? P.hw + 4 : 4;
        const i0 = Math.max(0, Math.floor((P.x0 - pad) * s)), i1 = Math.min(Wp - 1, Math.ceil((P.x1 + pad) * s));
        const r0 = Math.max(j0, Math.floor((P.y0 - pad) * s)), r1 = Math.min(j1 - 1, Math.ceil((P.y1 + pad) * s));
        const E = F[4 + pl];
        for (let j = r0; j <= r1; j++) {
          const y = (j + 0.5) / s, row = (j - j0) * Wp, frow = off + (j - j0) * Wp;
          for (let i = i0; i <= i1; i++) {
            const x = (i + 0.5) / s;
            let ds;
            if (P.t === 0) {
              const qx = x - P.O[0], qy = y - P.O[1], M = P.M;
              const d = sdf(P, M[0] * qx + M[1] * qy, M[2] * qx + M[3] * qy), gx = M[0] * G[0] + M[2] * G[1], gy = M[1] * G[0] + M[3] * G[1];
              ds = d / (Math.hypot(gx, gy) || 1e-9);
            } else {
              const pts = P.pts, np = pts.length / 2; let best = 1e18;
              for (let q = 0; q < np - 1; q++) {
                const ax = pts[2 * q], ay = pts[2 * q + 1], bx = pts[2 * q + 2], by = pts[2 * q + 3];
                if ((x < ax - 8 && x < bx - 8) || (x > ax + 8 && x > bx + 8) || (y < ay - 8 && y < by - 8) || (y > ay + 8 && y > by + 8)) continue;
                const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey || 1e-9;
                let tt = ((x - ax) * ex + (y - ay) * ey) / l2; tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
                const dx = x - ax - tt * ex, dy = y - ay - tt * ey, dd = dx * dx + dy * dy;
                if (dd < best) best = dd;
              }
              ds = Math.sqrt(best) - P.hw;
            }
            const c = 0.5 - (ds + E[frow + i]) / aaw;
            if (c <= 0) continue;
            const cv = c > 1 ? 1 : c, k = row + i;
            if (tintT) { const tv = cv * tintT; if (tv > target[k]) target[k] = tv; }
            else if (cv > target[k]) target[k] = cv;
          }
        }
      };
      for (const P of fr.obj) {
        raster(P, 1, obj, 0);
        if (P.inkT) { if (P.tint) raster(P, 1, tint[1], P.tint); else raster(P, 1, covS[1], 0); }
      }
      for (const P of fr.P) { if (P.tint) raster(P, 0, tint[0], P.tint); else raster(P, 0, covS[0], 0); }

      // compose
      for (let j = j0; j < j1; j++) {
        const y = (j + 0.5) / s, row = (j - j0) * Wp, frow = off + (j - j0) * Wp;
        const gyf = Math.min(GH - 1.001, Math.max(0, y / GS - 0.5)), gy = gyf | 0, fy = gyf - gy;
        for (let i = 0; i < Wp; i++) {
          const x = (i + 0.5) / s, k = row + i, fk = frow + i;
          const gxf = Math.min(GW - 1.001, Math.max(0, x / GS - 0.5)), gx = gxf | 0, fx = gxf - gx, g0 = gy * GW + gx;
          const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
          const sh = shadowLow[g0] * w00 + shadowLow[g0 + 1] * w10 + shadowLow[g0 + GW] * w01 + shadowLow[g0 + GW + 1] * w11;
          const pl = F[0][fk], tooth = F[1][fk];
          let r = PAPER[0] * pl, gg = PAPER[1] * pl, b = PAPER[2] * pl;
          for (let p = 0; p < 2; p++) {
            let dens = tint[p][k];
            { const ko = sh * (1 - obj[k]) * SHADOW_INK[p]; if (ko > dens) dens = ko; }
            let c = covS[p][k];
            if (F[12 + p][fk] > c) c = F[12 + p][fk];
            if (p === 0) { const gh = (ghostLow[g0] * w00 + ghostLow[g0 + 1] * w10 + ghostLow[g0 + GW] * w01 + ghostLow[g0 + GW + 1] * w11) * 0.04; if (gh > c) c = gh; }
            if (dens > 0.004) {
              let dot = (dens - F[6 + p][fk]) * F[8 + p][fk] + 0.5;
              dot = dot < 0 ? 0 : dot > 1 ? 1 : dot;
              const gate = (dens - F[10 + p][fk]) * 40 + 0.5;
              dot *= gate < 0 ? 0 : gate > 1 ? 1 : gate;
              if (dot > c) c = dot;
            }
            if (c <= 0.002) continue;
            const sl = starvLow[p], st = sl[g0] * w00 + sl[g0 + 1] * w10 + sl[g0 + GW] * w01 + sl[g0 + GW + 1] * w11;
            // the film follows the paper's tooth (peaks take more ink), thins where the drum is starved
            const h = F[2 + p][fk] * (1 - 0.3 * st) * (0.9 + 0.2 * tooth);
            // the deepest valleys of the tooth miss the ink altogether where the film runs thin
            const thr = 0.5 * (0.8 - h);
            if (thr > 0) { const pin = (tooth - thr) * 16 + 0.5; c *= pin < 0 ? 0.2 : pin > 1 ? 1 : 0.2 + 0.8 * pin; }
            let hb = ((h / HMAX) * (HBINS - 1)) | 0; hb = hb < 0 ? 0 : hb >= HBINS ? HBINS - 1 : hb;
            const L = FILM[p];
            r *= 1 - c * (1 - L[hb]); gg *= 1 - c * (1 - L[HBINS + hb]); b *= 1 - c * (1 - L[2 * HBINS + hb]);
          }
          const ox = (i / down) | 0;
          acc[ox * 3] += r; acc[ox * 3 + 1] += gg; acc[ox * 3 + 2] += b;
        }
        if ((j - j0) % down === down - 1) {
          const oyy = ((j / down) | 0) - oy0, inv = 1 / (down * down);
          for (let ox = 0; ox < Wo; ox++) {
            const o = (oyy * Wo + ox) * 4;
            out[o] = ENC[Math.min(4096, (acc[ox * 3] * inv * 4096 + 0.5) | 0)];
            out[o + 1] = ENC[Math.min(4096, (acc[ox * 3 + 1] * inv * 4096 + 0.5) | 0)];
            out[o + 2] = ENC[Math.min(4096, (acc[ox * 3 + 2] * inv * 4096 + 0.5) | 0)];
            out[o + 3] = 255;
          }
          acc.fill(0);
        }
      }
    }
    return { w: Wo, h: oy1 - oy0, data: out };
  }

  function describe() {
    return nodes.map((n) => ({ id: n.id, type: n.type, kind: n.kind, yawAmpDeg: +(MOT.yawAmp[n.id] * 180 / Math.PI).toFixed(1), m: +n.m.toFixed(2),
      torque: n.type === 'arm' ? +(n.mR * n.Lr - n.mL * n.Ll).toFixed(1) + ' (' + (n.mL * n.Ll).toFixed(0) + ')' : undefined }));
  }
  function layout(t) { const g = kinematics(t); return { hang: g.hang.map((h) => proj(h)), shapes: g.shapes.map((s) => ({ kind: s.n.kind, at: proj(s.hang).map(Math.round), z: Math.round(s.hang[2]), yaw: +(s.yaw * 57.3).toFixed(1) })) }; }

  return { W, H, DUR, render, prepare, describe, layout };
}
if (typeof module !== 'undefined') module.exports = MobileCore;
