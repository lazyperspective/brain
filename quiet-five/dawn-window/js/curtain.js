// Dawn, a Window, a Glass of Water — the sheer linen curtain.
// Cloth: each horizontal slice is a pleated curve (an irregular trochoid: folds can turn edge-on and double over).
// Every frame the slice is walked in fine material steps and its arc length is deposited into screen pixels, so a
// pixel knows how much linen lies in front of it (1 = one flat layer, more where folds turn edge-on or overlap,
// x3 in the hems). Light: the dawn seen straight through the gaps of the weave (sharp, falling off as layers stack),
// light scattered forward by the fibres (a glow fed by the window behind), and a little room light on the front.
// Motion: a periodic draft drives damped oscillators whose phase lags down the length (the hem lags, folds travel).
(function () {
  'use strict';
  const DW = window.DW;
  const { clamp, smooth, mix } = DW;
  const LY = DW.LY, L = 10;

  const C = {
    yTop: LY.rodY + 0.0085,
    yHem: 0.983 + (window.DW.LY.OY - 0.035),
    xl0: 0.600, xl1: 0.630,
    xr0: 0.905, xr1: 0.93,
    Np: 10,
    camD: 1.3, // camera distance (canvas widths) for perspective of depth offsets
  };
  DW.CURT = C;

  // ---------- the draft: periodic forcing, and damped responses with height-dependent lag ----------
  const NF = 28;
  function wrapG(t, c, s) {
    let v = 0;
    for (let k = -2; k <= 2; k++) { const d = (t - c + k * L) / s; v += Math.exp(-d * d); }
    return v;
  }
  function forcing(t) {
    return wrapG(t, 2.25, 0.62) + 0.38 * wrapG(t, 6.55, 0.95) + 0.12 * (0.5 + 0.5 * Math.sin((2 * Math.PI * t) / L + 2.2))
      + 0.05 * Math.sin((2 * Math.PI * 3 * t) / L + 0.7);
  }
  const coef = (() => {
    const M = 512, re = new Float64Array(NF + 1), im = new Float64Array(NF + 1);
    for (let i = 0; i < M; i++) {
      const t = (i / M) * L, f = forcing(t);
      for (let n = 0; n <= NF; n++) {
        const a = (2 * Math.PI * n * t) / L;
        re[n] += f * Math.cos(a); im[n] -= f * Math.sin(a);
      }
    }
    for (let n = 0; n <= NF; n++) { re[n] /= M; im[n] /= M; }
    return { re, im };
  })();
  // response of a damped oscillator (natural period T0, damping zeta) with pure delay tau, at time t
  function respond(t, T0, zeta, tau) {
    const w0 = (2 * Math.PI) / T0;
    let v = coef.re[0];
    for (let n = 1; n <= NF; n++) {
      const w = (2 * Math.PI * n) / L;
      const r = w / w0;
      // H = exp(-i w tau) / (1 - r^2 + 2 i zeta r)
      const dr = 1 - r * r, di = 2 * zeta * r, dd = dr * dr + di * di;
      let hr = dr / dd, hi = -di / dd;
      const cr = Math.cos(w * tau), ci = -Math.sin(w * tau);
      const h2r = hr * cr - hi * ci, h2i = hr * ci + hi * cr;
      // c_n * H * e^{i w t}, doubled (real signal)
      const er = Math.cos(w * t), ei = Math.sin(w * t);
      const pr = coef.re[n] * h2r - coef.im[n] * h2i, pi = coef.re[n] * h2i + coef.im[n] * h2r;
      v += 2 * (pr * er - pi * ei);
    }
    return v;
  }
  DW.curtResp = respond;
  const F0 = coef.re[0];

  // per-row motion state
  function rowState(s, t, o) {
    const sw = respond(t, 1.75, 0.34, 0.62 * s) - F0;
    const bl = respond(t, 2.3, 0.42, 0.42 * s);
    const tr = respond(t, 2.0, 0.6, 0.5 * s) - F0;
    const prof = Math.pow(Math.max(0, s), 0.6);
    o.swing = -0.046 * sw * prof;
    o.billow = bl * Math.pow(Math.max(0, s), 1.35);
    o.travel = 1.05 * tr * (0.35 + 0.65 * s);
    return o;
  }
  DW.curtRow = rowState;

  // ---------- leading edge position at a given height (for checking the star) ----------
  DW.curtEdgeAt = function (y, t) {
    const s = (y - C.yTop) / (C.yHem - C.yTop);
    const o = rowState(s, t, {});
    return mix(C.xl0, C.xl1, Math.pow(s, 1.1)) + o.swing;
  };

  // ---------- material textures (painted strokes along the cloth, linen slubs) ----------
  DW.curtainInit = function (st) {
    const sc = st.Wpx / 2160;
    const NU = Math.round(2048 * sc), NS = Math.round(2048 * sc);
    const brush = new Float32Array(NU * NS);
    const slub = new Float32Array(NU * NS);
    const rnd = DW.rng(9091);
    // brush: long vertical strokes in material space, scumbled light and dark
    for (let k = 0; k < 2600; k++) {
      const u0 = rnd(), s0 = rnd() * 1.1 - 0.05, ls = 0.06 + 0.3 * rnd() * rnd(), wu = 0.0018 + 0.006 * rnd();
      const v = (rnd() - 0.5) * 2, op = 0.25 + 0.5 * rnd();
      const tilt = (rnd() - 0.5) * 0.02;
      const NB = 9, br = [];
      for (let b = 0; b < NB; b++) br.push(rnd() < 0.15 ? 0.2 : 0.6 + 0.4 * rnd());
      const i0 = Math.max(0, Math.floor((u0 - wu - 0.02) * NU)), i1 = Math.min(NU - 1, Math.ceil((u0 + wu + 0.02) * NU));
      const j0 = Math.max(0, Math.floor(s0 * NS)), j1 = Math.min(NS - 1, Math.ceil((s0 + ls) * NS));
      for (let j = j0; j <= j1; j++) {
        const ss = (j / NS - s0) / ls; // 0..1 along
        const uc = u0 + tilt * ss * ls * 10;
        const endA = Math.min(1, ss * 8) * (1 - smooth(0.6, 1, ss));
        for (let i = i0; i <= i1; i++) {
          const tb = (i / NU - uc) / wu;
          if (tb <= -1 || tb >= 1) continue;
          const bf = (tb * 0.5 + 0.5) * (NB - 1), bi = bf | 0;
          const bd = br[bi] + (br[Math.min(NB - 1, bi + 1)] - br[bi]) * (bf - bi);
          const a = op * endA * (1 - smooth(0.75, 1, Math.abs(tb))) * smooth(0.3 + 0.4 * ss * ss, 0.6 + 0.4 * ss * ss, bd);
          const q = j * NU + i;
          brush[q] = brush[q] * (1 - a) + v * bd * a;
        }
      }
    }
    // slubs: thicker irregular threads, mostly in the weft (across)
    for (let k = 0; k < 5200; k++) {
      const weft = rnd() < 0.72;
      const u0 = rnd(), s0 = rnd();
      const len = (0.006 + 0.05 * rnd() * rnd()) * (weft ? 1 : 0.8);
      const th = (0.00045 + 0.0011 * rnd()) / (weft ? 1 : 1);
      const str = 0.25 + 0.7 * rnd();
      if (weft) {
        const j0 = Math.floor((s0 - th * 2) * NS), j1 = Math.ceil((s0 + th * 2) * NS);
        const i0 = Math.floor(u0 * NU), i1 = Math.ceil((u0 + len) * NU);
        for (let j = Math.max(0, j0); j <= Math.min(NS - 1, j1); j++) {
          const d = (j / NS - s0) / th;
          for (let i = Math.max(0, i0); i <= Math.min(NU - 1, i1); i++) {
            const a = (i / NU - u0) / len;
            const tp = Math.sin(Math.PI * clamp(a, 0, 1));
            const w = Math.exp(-d * d / (0.4 + 0.6 * tp)) * tp;
            slub[j * NU + i] -= str * w;
          }
        }
      } else {
        const i0 = Math.floor((u0 - th * 2) * NU), i1 = Math.ceil((u0 + th * 2) * NU);
        const j0 = Math.floor(s0 * NS), j1 = Math.ceil((s0 + len) * NS);
        for (let j = Math.max(0, j0); j <= Math.min(NS - 1, j1); j++) {
          const a = (j / NS - s0) / len;
          const tp = Math.sin(Math.PI * clamp(a, 0, 1));
          for (let i = Math.max(0, i0); i <= Math.min(NU - 1, i1); i++) {
            const d = (i / NU - u0) / th;
            slub[j * NU + i] -= str * Math.exp(-d * d) * tp;
          }
        }
      }
    }
    // gentle uneven density of the weave
    for (let j = 0; j < NS; j++) for (let i = 0; i < NU; i++) {
      slub[j * NU + i] += (DW.fbm(i / NU * 9, j / NS * 30, 333, 3) - 0.5) * 0.35;
    }
    // fold character: depth and a slow wander of each fold's phase down the length (static fields over (phase, s))
    const TU = 640, TS = 256;
    const tDepth = new Float32Array(TU * TS), tPsi = new Float32Array(TU * TS);
    for (let j = 0; j < TS; j++) for (let i = 0; i < TU; i++) {
      const ph = (i / (TU - 1)) * 2 * Math.PI * C.Np, sv = j / (TS - 1);
      tDepth[j * TU + i] = 0.5 + 1.0 * DW.fbm(ph * 0.22, sv * 1.7, 501, 3);
      tPsi[j * TU + i] = (DW.fbm(ph * 0.11 + 7, sv * 1.25, 502, 3) - 0.5) * 2.6 + (DW.fbm(ph * 0.4 + 2, sv * 3.0, 503, 2) - 0.5) * 0.7;
    }
    // per-pixel scratch for one frame (bounding box rows)
    const W = st.Wpx;
    st.curt = {
      NU, NS, brush, slub, TU, TS, tDepth, tPsi,
      D: new Float32Array(W + 2), Dl: new Float32Array(W + 2), Dm: new Float32Array(W + 2), Dn: new Float32Array(W + 2),
      hc: new Float32Array(st.N), alpha: new Float32Array(st.N), touched: [],
    };
  };

  const LN_O = Math.log(0.30); // openness of one layer of this sheer (fraction of light passing straight through)
  const linT = [1.0, 0.93, 0.83], linR = [0.92, 0.9, 0.86];

  DW.curtainDraw = function (st, t) {
    const cu = st.curt, { Wpx, Hpx } = st;
    const F = st.frame, px = 1 / Wpx;
    const { NU, NS, brush, slub, TU, TS, tDepth, tPsi } = cu;
    const D = cu.D, Dl = cu.Dl, Dm = cu.Dm, Dn = cu.Dn;
    const wide = st.wide;
    const len = C.yHem - C.yTop;
    const lenPx = len * Wpx;
    const VPy = LY.VP.y;
    const Phi = 2 * Math.PI * C.Np;
    const o = {};
    const wb = [0, 0, 0];
    const hc = cu.hc, alphaA = cu.alpha;
    const j0 = Math.max(0, Math.floor((C.yTop - 0.004) * Wpx)), j1 = Math.min(Hpx - 1, Math.ceil((C.yHem + 0.03) * Wpx));
    const sideHemPx = 13 * (Wpx / 2160);
    let bx0 = Wpx, bx1 = 0;
    const phw0 = 0.7, phw1 = 0.35, phw2 = 0.15;
    const warpPhase = (ph) => ph + phw0 * Math.sin(0.41 * ph + 1.3) + phw1 * Math.sin(0.93 * ph + 0.2) + phw2 * Math.sin(1.71 * ph + 2.0);
    const wEnd = warpPhase(Phi) - warpPhase(0);
    for (let j = j0; j <= j1; j++) {
      const y = (j + 0.5) * px;
      const s0 = clamp((y - C.yTop) / len, 0, 1.06);
      rowState(Math.min(1, s0), t, o);
      const sP = Math.pow(s0, 1.1);
      const xl = mix(C.xl0, C.xl1, sP) + o.swing + 0.007 * Math.sin(Math.PI * s0 * 1.4 + 0.3) * Math.min(1, s0 * 4);
      const xr = mix(C.xr0, C.xr1, s0) + 0.22 * o.swing;
      const bil = clamp(o.billow, -0.5, 2.5);
      const beta = mix(1.12, 0.78, smooth(0, 0.55, s0)) * (1 - 0.26 * clamp(bil, 0, 1.5)) * (1 + 0.3 * Math.exp(-s0 / 0.025));
      const tRow = Math.min(TS - 1, Math.max(0, Math.min(1, s0) * (TS - 1))) | 0;
      const psi = 0.55 * Math.sin(2.3 * s0 + 0.4) + o.travel;
      const pW = (xr - xl) / C.Np;
      const amp = (pW / (2 * Math.PI)) * beta;
      const zA = pW * beta * 0.45;
      const bz = 0.032 * bil * Math.pow(Math.min(1, s0), 1.35);
      const persp = (y - VPy) / C.camD;
      // the cloth lifts a touch as it swings in
      const lift = 0.0035 * bil * s0 * s0;
      const nS = Math.ceil((xr - xl) * Wpx * 3.4);
      // clear accumulators over this row's span
      const xa = Math.max(0, Math.floor((xl - 0.03) * Wpx)), xb = Math.min(Wpx - 1, Math.ceil((xr + 0.03) * Wpx));
      for (let i = xa; i <= xb + 1; i++) { D[i] = 0; Dl[i] = 0; Dm[i] = 0; Dn[i] = 0; }
      let pxPrev = 0, pzPrev = 0, have = false, uPrev = 0;
      let rowAny = false;
      for (let k = 0; k <= nS; k++) {
        const ph = (k / nS) * Phi;
        const u = k / nS;
        const pw = warpPhase(ph);
        const un = (pw - warpPhase(0)) / wEnd;
        const ti0 = (u * (TU - 1)) | 0;
        const ang = pw + psi + tPsi[tRow * TU + ti0] * (0.35 + 0.65 * Math.min(1, s0 * 1.5));
        const depthVar = tDepth[tRow * TU + ti0];
        const xx = xl + (xr - xl) * un - amp * depthVar * Math.sin(ang);
        const bzu = bz * (1 - 0.55 * u);
        const zz = zA * depthVar * Math.cos(ang) + bzu;
        // perspective of depth: nearer cloth sits lower on the screen and a touch wider
        const xs = (xx + (xx - 0.5) * zz / C.camD) * Wpx;
        const zs = zz * Wpx;
        if (have) {
          const dxp = xs - pxPrev, dzp = zs - pzPrev;
          const arc = Math.sqrt(dxp * dxp + dzp * dzp);
          // material coordinates of this segment
          const um = (u + uPrev) * 0.5;
          const zm = zz;
          const sm = (y - C.yTop + lift - persp * zm) / len;
          if (sm > -0.002 && sm < 1.0 + 2 / lenPx) {
            // hem anti-aliasing and layer count (hems and heading tape are folded double/triple)
            let cov = clamp((1 - sm) * lenPx + 0.5, 0, 1) * clamp(sm * lenPx + 0.5, 0, 1);
            let layers = 1 + 2 * clamp((sm - (1 - 0.026)) * lenPx + 0.5, 0, 1);
            layers += 1.5 * clamp((0.028 - sm) * lenPx + 0.5, 0, 1);
            const uPx = um * (xr - xl) * Wpx * 2.1;
            if (uPx < sideHemPx) layers += 2;
            const dep = arc * cov * layers;
            if (dep > 0) {
              const ti = clamp((um * (NU - 1)) | 0, 0, NU - 1), tj = clamp((sm * (NS - 1)) | 0, 0, NS - 1);
              const q = tj * NU + ti;
              const lnO = LN_O + slub[q] * 0.55;
              const m = brush[q];
              const face = arc > 1e-6 ? Math.abs(dxp) / arc : 1;
              // deposit over the pixels the segment spans (box filter)
              let a = pxPrev, b = xs;
              if (a > b) { const tt = a; a = b; b = tt; }
              const span = b - a;
              if (span < 1e-6) {
                const i = a | 0;
                if (i >= 0 && i < Wpx) { D[i] += dep; Dl[i] += dep * lnO; Dm[i] += dep * m; Dn[i] += dep * face; }
              } else {
                const ia = a | 0, ib = b | 0;
                for (let i = ia; i <= ib; i++) {
                  if (i < 0 || i >= Wpx) continue;
                  const lo = Math.max(a, i), hi = Math.min(b, i + 1);
                  if (hi <= lo) continue;
                  const w = dep * (hi - lo) / span;
                  D[i] += w; Dl[i] += w * lnO; Dm[i] += w * m; Dn[i] += w * face;
                }
              }
              rowAny = true;
            }
          }
        }
        pxPrev = xs; pzPrev = zs; uPrev = u; have = true;
      }
      if (!rowAny) continue;
      // soften the density across a pixel or two: an edge-on fold is a soft line, not a hairline
      {
        let p0 = D[xa - 1 >= 0 ? xa - 1 : xa], pl0 = Dl[xa], pm0 = Dm[xa], pn0 = Dn[xa];
        p0 = D[xa]; 
        for (let i = xa; i <= xb; i++) {
          const c = D[i], n = D[i + 1];
          const cl = Dl[i], nl = Dl[i + 1], cm = Dm[i], nm = Dm[i + 1], cn = Dn[i], nn = Dn[i + 1];
          D[i] = 0.25 * p0 + 0.5 * c + 0.25 * n; Dl[i] = 0.25 * pl0 + 0.5 * cl + 0.25 * nl;
          Dm[i] = 0.25 * pm0 + 0.5 * cm + 0.25 * nm; Dn[i] = 0.25 * pn0 + 0.5 * cn + 0.25 * nn;
          p0 = c; pl0 = cl; pm0 = cm; pn0 = cn;
        }
      }
      // shade the row
      for (let i = xa; i <= xb; i++) {
        const d = D[i];
        if (d < 1e-4) continue;
        const p = j * Wpx + i;
        const alpha = d < 1 ? d : 1;
        const De = d < 1 ? 1 : d;
        const lnO = Dl[i] / d, mm = Dm[i] / d, face = Dn[i] / d;
        const Tdir = Math.exp(lnO * De) * (1 - 0.25 * mm);
        const Dc = De < 4 ? De : 4 + (De - 4) * 0.25;
        const Ttot = (0.8 * Math.exp(-0.03 * Dc)) / (1 + 0.3 * (Dc - 1));
        const diff = Math.max(0, Ttot - Math.exp(lnO * De)) * (0.7 + 0.3 * face) * (1 + 0.32 * mm);
        const Rf = 0.5 * (1 - 1 / (1 + 0.6 * De));
        const x = (i + 0.5) * px;
        DW.bilinear(wide.data, wide.w, wide.h, 3, x * Wpx / wide.f, y * Wpx / wide.f, wb);
        const q3 = p * 3;
        const B0 = F[q3], B1 = F[q3 + 1], B2 = F[q3 + 2];
        // room light on the front of the cloth: a little of the window's light come back off the walls
        const wl = 0.3 * wb[0] + 0.6 * wb[1] + 0.1 * wb[2];
        const E0 = 0.0035 + 0.07 * wl, E1 = 0.0038 + 0.072 * wl, E2 = 0.0052 + 0.08 * wl;
        const g = 1.15;
        const c0 = B0 * Tdir + wb[0] * linT[0] * diff * g + E0 * linR[0] * Rf * (1 + 0.1 * mm);
        const c1 = B1 * Tdir + wb[1] * linT[1] * diff * g + E1 * linR[1] * Rf * (1 + 0.1 * mm);
        const c2 = B2 * Tdir + wb[2] * linT[2] * diff * g + E2 * linR[2] * Rf * (1 + 0.1 * mm);
        F[q3] = B0 + (c0 - B0) * alpha;
        F[q3 + 1] = B1 + (c1 - B1) * alpha;
        F[q3 + 2] = B2 + (c2 - B2) * alpha;
        // paint height on the cloth: strokes along the folds
        hc[p] = (0.35 + 0.25 * mm + 0.08 * Math.min(3, De)) * alpha;
        alphaA[p] = alpha;
        if (i < bx0) bx0 = i;
        if (i > bx1) bx1 = i;
      }
    }
    // relief of the paint on the cloth (raking light), blended over the background relief by coverage
    const sh = st.shade, shC = st.shadeCanvas;
    const gain = 0.9 / (Wpx / 2160);
    const lx = -0.5, ly = -0.62, lz = 0.6, Ln = Math.hypot(lx, ly, lz);
    for (let j = Math.max(1, j0); j <= Math.min(Hpx - 2, j1); j++) {
      for (let i = Math.max(1, bx0); i <= Math.min(Wpx - 2, bx1); i++) {
        const p = j * Wpx + i;
        const a = alphaA[p];
        if (a <= 0) continue;
        const gx = (hc[p + 1] - hc[p - 1]) * 0.5 * gain, gy = (hc[p + Wpx] - hc[p - Wpx]) * 0.5 * gain;
        const nl = (-gx * lx - gy * ly + lz) / Math.sqrt(gx * gx + gy * gy + 1) / Ln;
        const s = nl / (lz / Ln) - 1;
        sh[p] = sh[p] + (shC[p] + s * 0.6 - sh[p]) * a;
      }
    }
    // clear scratch for next frame
    for (let j = j0; j <= j1; j++) {
      const r = j * Wpx;
      for (let i = bx0; i <= bx1; i++) { hc[r + i] = 0; alphaA[r + i] = 0; }
    }
    // rings on the rod at the front-most folds of the heading
    drawRings(st, t);
  };

  function drawRings(st, t) {
    const { Wpx } = st, F = st.frame, px = 1 / Wpx;
    const o = rowState(0, t, {});
    const xl = C.xl0 + o.swing, xr = C.xr0 + 0.22 * o.swing;
    const ringR = 0.0068, thick = 0.0011;
    const base = DW.srgb(20, 20, 27), hl = DW.srgb(62, 60, 74);
    for (let k = 0; k < C.Np; k++) {
      const cx = xl + (xr - xl) * ((k + 0.5 + 0.28 * Math.sin(k * 2.1 + 0.4)) / C.Np);
      const cy = LY.rodY;
      const i0 = Math.floor((cx - ringR - 0.003) * Wpx), i1 = Math.ceil((cx + ringR + 0.003) * Wpx);
      const j0 = Math.floor((cy - ringR - 0.003) * Wpx), j1 = Math.ceil((cy + ringR + 0.003) * Wpx);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = (i + 0.5) * px, y = (j + 0.5) * px;
        // a ring seen nearly edge-on: a thin ellipse around the rod
        const ex = (x - cx) / (ringR * 0.42), ey = (y - cy) / ringR;
        const r = Math.hypot(ex, ey);
        const d = Math.abs(r - 1) * ringR * 0.6;
        const a = clamp(0.5 - (d - thick * 0.5) / px, 0, 1) * (y > cy - ringR * 0.2 || Math.abs(ex) > 0.2 ? 1 : 1);
        if (a <= 0) continue;
        const p = (j * Wpx + i) * 3;
        const lit = clamp((y - cy) / ringR, 0, 1) * 0.7;
        for (let c = 0; c < 3; c++) F[p + c] = F[p + c] * (1 - a) + mix(base[c], hl[c], lit) * a;
      }
    }
  }
})();
