// Dawn, a Window, a Glass of Water — the glass (painted over the finished background, refracting it),
// the water surface that trembles, the caustic it throws on the sill, and the last star.
(function () {
  'use strict';
  const DW = window.DW;
  const { clamp, smooth, mix } = DW;
  const LY = DW.LY, G = LY.glass, L = 10;
  const NW = 1.333;

  const KAPPA = 0.70; // ellipse ratio per unit below eye level
  const ell = (y) => KAPPA * (y - LY.VP.y);
  const radAt = (y) => G.rb + (G.rt - G.rb) * clamp((G.yb - y) / (G.yb - G.yt), 0, 1);
  const BASEH = 0.0105;

  // ---- 2D refraction through a cylinder of water (unit radius), viewer looking along +z ----
  // returns lateral position (in radii) where the ray meets a plane D radii behind the centre, or NaN on TIR / miss
  function cylMap(xi, D, n) {
    const z1 = -Math.sqrt(Math.max(0, 1 - xi * xi));
    // entry
    let nx = xi, nz = z1; // outward normal at entry
    const eta = 1 / n;
    let cosi = -nz; // -dot(n, d) with d=(0,1)
    let k = 1 - eta * eta * (1 - cosi * cosi);
    if (k < 0) return NaN;
    let tx = eta * 0 + (eta * cosi - Math.sqrt(k)) * nx;
    let tz = eta * 1 + (eta * cosi - Math.sqrt(k)) * nz;
    let tl = Math.hypot(tx, tz); tx /= tl; tz /= tl;
    const s = -2 * (xi * tx + z1 * tz);
    const x2 = xi + s * tx, z2 = z1 + s * tz;
    // exit: inward normal N = -(x2,z2)
    const Nx = -x2, Nz = -z2;
    cosi = -(Nx * tx + Nz * tz);
    k = 1 - n * n * (1 - cosi * cosi);
    if (k < 0) return NaN;
    const ox = n * tx + (n * cosi - Math.sqrt(k)) * Nx, oz = n * tz + (n * cosi - Math.sqrt(k)) * Nz;
    if (oz <= 0.05) return NaN;
    return x2 + (ox / oz) * (D - z2);
  }
  DW.cylMap = cylMap;

  function fresnel(cosi, n) {
    const r0 = ((n - 1) / (n + 1)) ** 2;
    return r0 + (1 - r0) * Math.pow(1 - cosi, 5);
  }

  DW.glassStatic = function (S, P, Hh) {
    const { Wpx, Hpx } = S;
    const px = 1 / Wpx;
    const src = P.slice(); // painted background, before the glass
    // bounding box
    const x0 = Math.floor((G.x - G.rt - 0.01) * Wpx), x1 = Math.ceil((G.x + G.rt + 0.01) * Wpx);
    const y0 = Math.floor((G.yt - ell(G.yt) * G.rt - 0.01) * Wpx), y1 = Math.ceil((G.yb + ell(G.yb) * G.rb + 0.01) * Wpx);
    const mask = new Float32Array(Wpx * Hpx);
    // refraction lookup across xi
    const NX = 512, map = new Float32Array(NX + 1), mapOk = new Float32Array(NX + 1);
    for (let i = 0; i <= NX; i++) {
      const xi = -0.999 + (1.998 * i) / NX;
      const v = cylMap(xi, 3.0, NW);
      map[i] = isNaN(v) ? 0 : v; mapOk[i] = isNaN(v) ? 0 : 1;
    }
    const lookMap = (xi) => {
      const f = clamp((xi + 0.999) / 1.998, 0, 1) * NX, i = Math.min(NX - 1, f | 0), t = f - i;
      return [map[i] + (map[i + 1] - map[i]) * t, mapOk[i] + (mapOk[i + 1] - mapOk[i]) * t];
    };
    const smp = [0, 0, 0];
    const sample = (sx, sy, out) => DW.bilinear(src, Wpx, Hpx, 3, sx * Wpx, sy * Wpx, out);
    const SS = 3;
    const col = [0, 0, 0];
    const roomRefl = DW.srgb(30, 32, 46);
    for (let j = y0; j <= y1; j++) {
      for (let i = x0; i <= x1; i++) {
        let ar = 0, ag = 0, ab = 0, acov = 0, aH = 0;
        for (let sj = 0; sj < SS; sj++) for (let si = 0; si < SS; si++) {
          const x = (i + (si + 0.5) / SS) * px, y = (j + (sj + 0.5) / SS) * px;
          const r = radAt(y);
          const xi = (x - G.x) / r;
          if (xi <= -1 || xi >= 1) continue;
          const sq = Math.sqrt(1 - xi * xi);
          const yRimBack = G.yt - ell(G.yt) * G.rt * sq;
          const yBotFront = G.yb + ell(G.yb) * G.rb * sq;
          if (y < yRimBack || y > yBotFront) continue;
          const yRimFront = G.yt + ell(G.yt) * G.rt * sq;
          const ew = ell(G.yw) * radAt(G.yw);
          const yWBack = G.yw - ew * sq, yWFront = G.yw + ew * sq;
          const yBase = G.yb - BASEH;
          const ax = Math.abs(xi);
          let h = 0; // impasto for highlights
          if (y < yWBack) {
            // ---- empty glass: two thin walls ----
            const off = xi * xi * xi * 0.10 * r;
            sample(x + off, y, smp);
            const T = 0.92 - 0.45 * smooth(0.8, 1.0, ax);
            col[0] = smp[0] * T + 0.0012; col[1] = smp[1] * T + 0.0014; col[2] = smp[2] * T + 0.0016;
            // inside the rim opening we look down at the inner back wall: slightly darker
            if (y < yRimFront) { col[0] *= 0.96; col[1] *= 0.965; col[2] *= 0.97; }
          } else if (y < yWFront) {
            // ---- water surface seen from just above: grazing reflection of the bright window behind ----
            const zz = (y - G.yw) / (ew + 1e-6); // -sq .. sq
            const refY = G.yw - 0.040 - 0.030 * (zz + 1);
            sample(x - xi * r * 0.25, refY, smp);
            const fr = 0.55 + 0.15 * (1 - ax);
            // refracted view under the surface: the water body
            const [mx] = lookMap(xi);
            sample(G.x + mx * r * 0.94, y + 0.004, col);
            for (let k = 0; k < 3; k++) col[k] = mix(col[k] * 0.9, smp[k] * 1.05, fr);
            // meniscus lines: front and back edge of the surface ellipse catch the light
            const dF = Math.abs(y - yWFront) / px, dB = Math.abs(y - yWBack) / px;
            const lineF = Math.exp(-dF * dF / 2.2) * 0.7, lineB = Math.exp(-dB * dB / 1.6) * 0.45;
            const lum = 0.3 * smp[0] + 0.6 * smp[1] + 0.1 * smp[2];
            const add = (lineF + lineB) * (0.12 + lum * 0.6);
            col[0] += add * 1.05; col[1] += add; col[2] += add * 0.98;
            h = 0.6 * (lineF + lineB);
          } else if (y < yBase + ell(yBase) * r * sq) {
            // ---- the water body: a cylinder lens, the window behind it flipped and magnified ----
            const [mx, ok] = lookMap(xi);
            sample(G.x + mx * r * 0.94, y + 0.0025, smp);
            const cosi = sq;
            const F = fresnel(cosi, NW);
            const tr = (1 - F) * ok;
            // toward the sides the lens throws its view far off and mirrors the dark room
            const side = smooth(0.62, 0.97, ax);
            const tr2 = tr * (1 - 0.72 * side);
            col[0] = smp[0] * tr2 * 0.92 + roomRefl[0] * (1 - tr2);
            col[1] = smp[1] * tr2 * 0.95 + roomRefl[1] * (1 - tr2);
            col[2] = smp[2] * tr2 * 0.97 + roomRefl[2] * (1 - tr2);
            // the underside of the surface seen through the wall: a faint silvery band just below the meniscus
            const below = (y - yWFront) / px;
            if (below >= 0) {
              const sb = Math.exp(-below / 5) * 0.25;
              col[0] += sb * 0.09; col[1] += sb * 0.085; col[2] += sb * 0.09;
            }
          } else {
            // ---- the thick base: strongly refracting, catching light ----
            const t = clamp((y - (yBase + ell(yBase) * r * sq)) / (BASEH + 1e-6), 0, 1);
            sample(G.x - xi * r * 0.55, y - 0.03 - 0.02 * t, smp);
            const g = 1.08 + 0.25 * Math.exp(-((xi + 0.35) ** 2) / 0.05);
            col[0] = smp[0] * g * 0.92; col[1] = smp[1] * g * 0.95; col[2] = smp[2] * g * 0.95;
            const dF = Math.abs(y - yBotFront) / px;
            const ln = Math.exp(-dF * dF / 2.5);
            col[0] += ln * 0.06; col[1] += ln * 0.058; col[2] += ln * 0.062;
            h = 0.3 * ln;
          }
          // ---- edges of the glass wall: thin dark outer line, bright refracted line just inside ----
          if (ax > 0.9) {
            const dark = smooth(0.975, 0.998, ax);
            const lit = Math.exp(-((ax - 0.955) ** 2) / 0.00012);
            sample(x + xi * r * 0.6, y, smp);
            const lb = 0.3 * smp[0] + 0.6 * smp[1] + 0.1 * smp[2];
            for (let k = 0; k < 3; k++) col[k] = col[k] * (1 - 0.65 * dark) + lit * (0.03 + 0.55 * lb) * (k === 2 ? 0.97 : 1);
            h = Math.max(h, lit * 0.5);
          }
          // ---- the rim: a thin bright ellipse, strongest at the back where it is lit from behind ----
          {
            const er = ell(G.yt) * G.rt;
            const ex = (x - G.x) / G.rt, ey = (y - G.yt) / er;
            const dist = Math.abs(Math.hypot(ex, ey) - 1) * Math.min(G.rt, er * 3);
            const dpx = dist / px;
            if (dpx < 4) {
              const back = ey < 0 ? 1 : 0.55;
              const lft = 1 + 0.6 * smooth(0.2, -0.9, ex);
              const a = Math.exp(-dpx * dpx / 1.4) * back * lft;
              col[0] += a * 0.30; col[1] += a * 0.27; col[2] += a * 0.27;
              h = Math.max(h, a * 0.9);
            }
          }
          // ---- one painted highlight down the left of the glass (window light caught in the wall) ----
          {
            // laid in like a single loaded stroke: slightly wavering, broken where it crosses the water line
            const v = clamp((y - yRimFront) / (yBotFront - yRimFront), 0, 1);
            const hx = xi + 0.74 + 0.025 * Math.sin(v * 9 + 1) + (y > yWFront ? 0.05 : 0);
            const wl = Math.abs(y - G.yw) / px;
            const gap = 1 - Math.exp(-wl * wl / 30);
            const a = Math.exp(-hx * hx / 0.0011) * smooth(0.02, 0.1, v) * (1 - smooth(0.55, 0.85, v)) * gap * 0.9;
            col[0] += a * 0.16; col[1] += a * 0.15; col[2] += a * 0.155;
            h = Math.max(h, a * 0.9);
            // a fainter echo on the right wall
            const hx2 = xi - 0.83;
            const a2 = Math.exp(-hx2 * hx2 / 0.0007) * smooth(0.05, 0.2, v) * (1 - smooth(0.4, 0.75, v)) * gap * 0.5;
            col[0] += a2 * 0.07; col[1] += a2 * 0.066; col[2] += a2 * 0.07;
          }
          ar += col[0]; ag += col[1]; ab += col[2]; acov += 1; aH += h;
        }
        if (acov === 0) continue;
        const p = j * Wpx + i;
        const cv = acov / (SS * SS);
        const inv = 1 / acov;
        P[p * 3] = mix(src[p * 3], ar * inv, cv);
        P[p * 3 + 1] = mix(src[p * 3 + 1], ag * inv, cv);
        P[p * 3 + 2] = mix(src[p * 3 + 2], ab * inv, cv);
        Hh[p] = mix(Hh[p] * 0.4, 0.15 + (aH * inv) * 1.2, cv);
        mask[p] = cv;
      }
    }
    // contact shadow right under the base front
    for (let j = y0; j <= y1 + 6; j++) {
      for (let i = x0; i <= x1; i++) {
        const x = (i + 0.5) * px, y = (j + 0.5) * px;
        const xi = (x - G.x) / G.rb;
        if (Math.abs(xi) >= 1) continue;
        const yF = G.yb + ell(G.yb) * G.rb * Math.sqrt(1 - xi * xi);
        const d = (y - yF) / px;
        if (d < -1 || d > 10) continue;
        const p = j * Wpx + i;
        const s = 1 - 0.55 * Math.exp(-Math.max(0, d) / 2.5) * (1 - mask[p]) * Math.sqrt(1 - xi * xi);
        P[p * 3] *= s; P[p * 3 + 1] *= s; P[p * 3 + 2] *= s;
      }
    }
    return { mask, bbox: [x0, y0, x1, y1], src };
  };

  // ================= water: surface modes, caustic =================
  function besselJ(m, x) {
    let sum = 0, term;
    const hx = x / 2;
    let fact_k = 1, fact_km = 1;
    for (let i = 1; i <= m; i++) fact_km *= i;
    let p = Math.pow(hx, m);
    for (let k = 0; k < 25; k++) {
      term = ((k & 1) ? -1 : 1) * p / (fact_k * fact_km);
      sum += term;
      p *= hx * hx;
      fact_k *= k + 1;
      fact_km *= k + 1 + m;
    }
    return sum;
  }
  // sloshing modes of water in a round glass: [m, root of J_m', freq Hz, decay s, amplitude, orientation]
  const MODES = [
    [1, 1.8412, 3.56, 2.3, 1.0, 1.15],
    [0, 3.8317, 5.14, 1.5, 0.55, 0],
    [2, 3.0542, 4.59, 1.35, 0.38, 0.4],
    [1, 5.3314, 6.07, 1.0, 0.30, 2.2],
    [0, 7.0156, 7.9, 0.7, 0.16, 0],
  ];
  const TAP = 2.18; // the gust rattles the casement: the water is touched once per loop
  const GN = 72; // surface grid (unit disc)

  // periodic, decaying response of one mode at time t
  function modeAmp(t, f, tau, ph) {
    let tt = (((t - TAP) % L) + L) % L;
    let s = 0;
    for (let k = 0; k < 4; k++, tt += L) {
      s += (1 - Math.exp(-tt / 0.07)) * Math.exp(-tt / tau) * Math.sin(2 * Math.PI * f * tt + ph);
    }
    return s;
  }
  DW.modeAmp = modeAmp;

  DW.waterInit = function (st) {
    // mode shapes and their gradients on a grid over the unit disc
    const shapes = MODES.map(([m, kr, , , , th]) => {
      const gx = new Float32Array(GN * GN), gz = new Float32Array(GN * GN), hh = new Float32Array(GN * GN);
      for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) {
        const X = -1 + (2 * (i + 0.5)) / GN, Z = -1 + (2 * (j + 0.5)) / GN;
        const r = Math.hypot(X, Z), a = Math.atan2(Z, X);
        hh[j * GN + i] = r <= 1.02 ? besselJ(m, kr * Math.min(r, 1)) * Math.cos(m * (a - th)) : 0;
      }
      for (let j = 1; j < GN - 1; j++) for (let i = 1; i < GN - 1; i++) {
        gx[j * GN + i] = (hh[j * GN + i + 1] - hh[j * GN + i - 1]) * GN / 4;
        gz[j * GN + i] = (hh[(j + 1) * GN + i] - hh[(j - 1) * GN + i]) * GN / 4;
      }
      // normalise slope magnitude
      let mx = 1e-6;
      for (let i = 0; i < gx.length; i++) mx = Math.max(mx, Math.hypot(gx[i], gz[i]));
      for (let i = 0; i < gx.length; i++) { gx[i] /= mx; gz[i] /= mx; }
      return { gx, gz };
    });
    // caustic rays through the cylinder (static geometry in the horizontal plane)
    const Lx = 0.66, Lz = 0.75, Ln = Math.hypot(Lx, Lz);
    const ldx = Lx / Ln, ldz = Lz / Ln; // light travel direction on the sill (X right, Z toward viewer)
    const bdx = ldz, bdz = -ldx; // across the beam
    const NB = 900, rays = [];
    for (let bi = 0; bi < NB; bi++) {
      const b = -0.995 + (1.99 * (bi + 0.5)) / NB;
      // in beam frame: entry at (b, -sqrt(1-b^2)), travel +z
      const z1 = -Math.sqrt(1 - b * b);
      const eta = 1 / NW;
      let cosi = -z1;
      let k = 1 - eta * eta * (1 - cosi * cosi);
      let tx = (eta * cosi - Math.sqrt(k)) * b, tz = eta + (eta * cosi - Math.sqrt(k)) * z1;
      let tl = Math.hypot(tx, tz); tx /= tl; tz /= tl;
      const s = -2 * (b * tx + z1 * tz);
      const x2 = b + s * tx, z2 = z1 + s * tz;
      const Nx = -x2, Nz = -z2;
      cosi = -(Nx * tx + Nz * tz);
      k = 1 - NW * NW * (1 - cosi * cosi);
      if (k < 0) continue;
      let ox = NW * tx + (NW * cosi - Math.sqrt(k)) * Nx, oz = NW * tz + (NW * cosi - Math.sqrt(k)) * Nz;
      const ol = Math.hypot(ox, oz); ox /= ol; oz /= ol;
      const T = (1 - fresnel(Math.sqrt(1 - b * b), NW)) * (1 - fresnel(Math.abs(cosi), 1.0001));
      // to sill coords: X = a-frame rotated
      const toX = (bb, aa) => bb * bdx + aa * ldx, toZ = (bb, aa) => bb * bdz + aa * ldz;
      rays.push({
        ex: toX(x2, z2), ez: toZ(x2, z2), dx: toX(ox, oz), dz: toZ(ox, oz),
        mx: toX((b + x2) / 2, (z1 + z2) / 2), mz: toZ((b + x2) / 2, (z1 + z2) / 2), c: s, w: T,
      });
    }
    // caustic grid in sill coordinates (radii): X in [-2.5, 5.5], Z in [-1.5, 6.5]
    const CW = 280, CH = 280;
    st.water = { shapes, rays, CW, CH, X0: -2.5, Z0: -1.5, SPAN: 8, grid: new Float32Array(CW * CH), tmp: new Float32Array(CW * CH),
      gx: new Float32Array(GN * GN), gz: new Float32Array(GN * GN) };
  };

  DW.waterDraw = function (st, t) {
    const W = st.water, { Wpx, Hpx } = st;
    const F = st.frame, px = 1 / Wpx;
    // current surface slope field
    const gx = W.gx, gz = W.gz;
    gx.fill(0); gz.fill(0);
    let energy = 0;
    for (let m = 0; m < MODES.length; m++) {
      const [, , f, tau, amp] = MODES[m];
      const a = amp * modeAmp(t, f, tau, m * 0.7);
      energy += Math.abs(a);
      if (Math.abs(a) < 1e-5) continue;
      const sg = W.shapes[m];
      for (let i = 0; i < gx.length; i++) { gx[i] += a * sg.gx[i]; gz[i] += a * sg.gz[i]; }
    }
    const slopeAt = (X, Z) => {
      const i = clamp(((X + 1) * 0.5 * GN) | 0, 0, GN - 1), j = clamp(((Z + 1) * 0.5 * GN) | 0, 0, GN - 1);
      return [gx[j * GN + i], gz[j * GN + i]];
    };
    // ---- caustic: splat rays entering at every height of the water column ----
    const grid = W.grid; grid.fill(0);
    const CW = W.CW, CH = W.CH, sc = CW / W.SPAN;
    const cotE = 1.0 / Math.tan(0.62); // elevation of the brightest sky light
    const hw = (G.yb - BASEH - G.yw) / (G.rb * 1.0) * 0.55; // water column height in radii (foreshortened)
    const NH = 110;
    const KR = 0.55; // how strongly the trembling surface steers the light
    for (let r = 0; r < W.rays.length; r++) {
      const R = W.rays[r];
      const s = slopeAt(R.mx, R.mz);
      for (let hi = 0; hi < NH; hi++) {
        const h = ((hi + DW.hash2(r, hi, 5)) / NH) * hw;
        const l = 1.15 + h * cotE * 1.5;
        if (l <= R.c) continue;
        const go = l - R.c;
        // rays nearer the surface feel its tilt more
        const near = 0.25 + 0.75 * (hi / NH);
        const X = R.ex + R.dx * go + KR * go * s[0] * near;
        const Z = R.ez + R.dz * go + KR * go * s[1] * near;
        const gxp = (X - W.X0) * sc, gzp = (Z - W.Z0) * sc;
        const ix = gxp | 0, iz = gzp | 0;
        if (ix < 0 || iz < 0 || ix >= CW - 1 || iz >= CH - 1) continue;
        const fx = gxp - ix, fz = gzp - iz;
        const w = R.w;
        const q = iz * CW + ix;
        grid[q] += w * (1 - fx) * (1 - fz); grid[q + 1] += w * fx * (1 - fz);
        grid[q + CW] += w * (1 - fx) * fz; grid[q + CW + 1] += w * fx * fz;
      }
    }
    // soften (the sky is a broad source): two box passes
    const blurred = DW.boxBlur(grid, CW, CH, 1, 2, 2);
    // normalise to "times the unobstructed light"
    const norm = 1 / ((W.rays.length / 2) * (NH / hw) / (cotE * 1.5) / (sc * sc));
    // ---- composite onto the sill ----
    const gl = st.glass;
    const reg = st.S.region;
    const yb = G.yb, eb = ell(G.yb);
    const X0px = Math.floor((G.x + W.X0 * G.rb) * Wpx), X1px = Math.ceil((G.x + (W.X0 + W.SPAN) * G.rb) * Wpx);
    const Y0px = Math.floor((yb + W.Z0 * G.rb * eb) * Wpx), Y1px = Math.min(Hpx - 1, Math.ceil((yb + (W.Z0 + W.SPAN) * G.rb * eb) * Wpx));
    const tint = [1.0, 0.78, 0.60];
    const cs = [0];
    for (let j = Y0px; j <= Y1px; j++) {
      const y = (j + 0.5) * px;
      const Z = (y - yb) / (G.rb * eb);
      for (let i = Math.max(0, X0px); i <= Math.min(Wpx - 1, X1px); i++) {
        const p = j * Wpx + i;
        if (reg[p] !== DW.R.SILL) continue;
        const x = (i + 0.5) * px;
        const X = (x - G.x) / G.rb;
        DW.bilinear(blurred, CW, CH, 1, (X - W.X0) * sc, (Z - W.Z0) * sc, cs);
        let I = cs[0] * norm;
        if (I < 0.02) continue;
        // highlight roll-off, like paint reaching white
        I = 1.5 * (1 - Math.exp(-I / 1.5));
        const vis = 1 - gl.mask[p];
        // light on the painted board: modulate by the paint itself so the strokes show through
        const base = 0.3 * st.P[p * 3] + 0.6 * st.P[p * 3 + 1] + 0.1 * st.P[p * 3 + 2];
        const k = I * vis * (0.14 + 0.85 * base);
        F[p * 3] += k * tint[0]; F[p * 3 + 1] += k * tint[1]; F[p * 3 + 2] += k * tint[2];
        st.shade[p] = st.shade[p] * (1 - 0.5 * Math.min(1, I * 0.3)) + 0.0;
      }
    }
    // ---- water surface glimmer: reflections tilt with the slope ----
    const r = radAt(G.yw), ew = ell(G.yw) * r;
    const xs0 = Math.floor((G.x - r) * Wpx), xs1 = Math.ceil((G.x + r) * Wpx);
    const ys0 = Math.floor((G.yw - ew - 0.002) * Wpx), ys1 = Math.ceil((G.yw + ew + 0.002) * Wpx);
    const smp = [0, 0, 0];
    for (let j = ys0; j <= ys1; j++) {
      const y = (j + 0.5) * px;
      for (let i = xs0; i <= xs1; i++) {
        const x = (i + 0.5) * px;
        const xi = (x - G.x) / r;
        if (Math.abs(xi) >= 0.985) continue;
        const sq = Math.sqrt(1 - xi * xi);
        const zz = (y - G.yw) / ew;
        if (zz < -sq - 0.15 || zz > sq + 0.15) continue;
        const s = slopeAt(xi, clamp(zz, -0.99, 0.99));
        // brightness of the reflected window changes as the facets tilt
        const g = 1 + 0.9 * (s[1] * 0.8 + s[0] * 0.3);
        const p = j * Wpx + i;
        const inBand = smooth(-sq - 0.12, -sq + 0.05, zz) * (1 - smooth(sq - 0.05, sq + 0.12, zz));
        const k = mix(1, Math.max(0.35, g), inBand * 0.85);
        F[p * 3] *= k; F[p * 3 + 1] *= k; F[p * 3 + 2] *= k;
        void smp;
      }
    }
    st.waterEnergy = energy;
  };

  // ================= the last star =================
  // brightness over the loop: it dims as the sky pales, and recovers while the curtain is over it
  DW.starLevel = function (t) {
    // fades from 3.4 s, all through the loop, to its faintest at 2.35 s (just as the curtain edge reaches it);
    // it gathers itself again behind the linen and is whole when the curtain falls back at ~3.25 s
    const u = (((t - 3.4) % L) + L) % L;
    let b;
    if (u < 8.95) b = 1 - 0.6 * smooth(0, 8.95, u);
    else b = 0.4 + 0.6 * smooth(8.95, 9.85, u);
    // slow scintillation (periodic in the loop)
    const tw = 1 + 0.06 * Math.sin((2 * Math.PI * 9 * t) / L + 0.4) + 0.04 * Math.sin((2 * Math.PI * 14 * t) / L + 1.9);
    return b * tw;
  };
  DW.starDraw = function (st, t) {
    const { Wpx } = st, F = st.frame, px = 1 / Wpx;
    const S0 = LY.star;
    const b = DW.starLevel(t);
    const rc = 0.00145, hal = 0.0048;
    const i0 = Math.floor((S0.x - 0.012) * Wpx), i1 = Math.ceil((S0.x + 0.012) * Wpx);
    const j0 = Math.floor((S0.y - 0.012) * Wpx), j1 = Math.ceil((S0.y + 0.012) * Wpx);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = (i + 0.5) * px, y = (j + 0.5) * px;
      const d = Math.hypot(x - S0.x, (y - S0.y) * 1.08);
      // a dab of paint: soft-edged core (a little irregular), faint halo
      const ang = Math.atan2(y - S0.y, x - S0.x);
      const rr = rc * (1 + 0.12 * Math.sin(ang * 3 + 0.5) + 0.08 * Math.sin(ang * 5 + 2));
      const core = 1 - smooth(rr * 0.55, rr * 1.15, d);
      const halo = Math.exp(-(d * d) / (hal * hal)) * 0.11 + Math.exp(-(d * d) / (hal * hal * 9)) * 0.025;
      const p = (j * Wpx + i) * 3;
      const a = core * b;
      const cr = 0.95, cg = 0.93, cb = 0.86;
      F[p] = F[p] * (1 - a) + cr * a + halo * b * 0.55;
      F[p + 1] = F[p + 1] * (1 - a) + cg * a + halo * b * 0.55;
      F[p + 2] = F[p + 2] * (1 - a) + cb * a + halo * b * 0.62;
      if (core > 0.2) st.shade[j * Wpx + i] += 0.12 * core * b * (x < S0.x ? 1 : -0.5);
    }
  };
})();
