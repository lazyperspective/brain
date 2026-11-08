// Painting engine: lays the picture down as oil paint on a toned canvas.
// Underpainting (dead colouring) -> layered passes of bristle strokes whose direction follows
// form (strata, cloud contours, the fall of light) -> glazes/blending in sky and distance ->
// crisp small strokes in the foreground. Every stroke deposits paint height for the impasto pass.
(function (G) {
  'use strict';
  const { makeRng, makeNoise, clamp, mix, smooth, blurPlane } = G.CORE;

  // ------------------------------------------------------------ resampling helpers
  function upsampleRGB(src, sw, sh, W, H) {
    const out = new Float32Array(W * H * 3);
    const sx = sw / W, sy = sh / H;
    for (let y = 0; y < H; y++) {
      let fy = (y + 0.5) * sy - 0.5; if (fy < 0) fy = 0; if (fy > sh - 1.001) fy = sh - 1.001;
      const j = fy | 0, v = fy - j;
      for (let x = 0; x < W; x++) {
        let fx = (x + 0.5) * sx - 0.5; if (fx < 0) fx = 0; if (fx > sw - 1.001) fx = sw - 1.001;
        const i = fx | 0, u = fx - i;
        const k00 = (j * sw + i) * 3, k10 = k00 + 3, k01 = k00 + sw * 3, k11 = k01 + 3;
        const o = (y * W + x) * 3;
        for (let c = 0; c < 3; c++) {
          const a = src[k00 + c] + (src[k10 + c] - src[k00 + c]) * u;
          const b = src[k01 + c] + (src[k11 + c] - src[k01 + c]) * u;
          out[o + c] = a + (b - a) * v;
        }
      }
    }
    return out;
  }
  function upsample1(src, sw, sh, W, H, nearest) {
    const out = new Float32Array(W * H);
    const sx = sw / W, sy = sh / H;
    for (let y = 0; y < H; y++) {
      let fy = (y + 0.5) * sy - 0.5; if (fy < 0) fy = 0; if (fy > sh - 1.001) fy = sh - 1.001;
      const j = fy | 0, v = fy - j;
      for (let x = 0; x < W; x++) {
        let fx = (x + 0.5) * sx - 0.5; if (fx < 0) fx = 0; if (fx > sw - 1.001) fx = sw - 1.001;
        const i = fx | 0, u = fx - i;
        if (nearest) { out[y * W + x] = src[Math.round(fy) * sw + Math.round(fx)]; continue; }
        const k = j * sw + i;
        const a = src[k] + (src[k + 1] - src[k]) * u;
        const b = src[k + sw] + (src[k + sw + 1] - src[k + sw]) * u;
        out[y * W + x] = a + (b - a) * v;
      }
    }
    return out;
  }

  // ------------------------------------------------------------ direction field
  // Orientation as doubled-angle vectors: scene hints (strata contours) blended with the
  // structure tensor of the study (isophotes), smoothed at a given scale.
  function directionField(study, sigma) {
    const { RW, RH, col, ang, angW, mat } = study;
    const N = RW * RH;
    const lum = new Float32Array(N);
    for (let k = 0; k < N; k++) lum[k] = 0.3 * col[k * 3] + 0.59 * col[k * 3 + 1] + 0.11 * col[k * 3 + 2];
    const T = new Float32Array(N * 3);
    for (let y = 1; y < RH - 1; y++) for (let x = 1; x < RW - 1; x++) {
      const k = y * RW + x;
      const gx = (lum[k + 1] - lum[k - 1]) * 0.5, gy = (lum[k + RW] - lum[k - RW]) * 0.5;
      T[k * 3] = gx * gx; T[k * 3 + 1] = gy * gy; T[k * 3 + 2] = gx * gy;
    }
    const Ts = blurPlane(T, RW, RH, 3, sigma, 2);
    const V = new Float32Array(N * 2);
    for (let k = 0; k < N; k++) {
      const a = Ts[k * 3], b = Ts[k * 3 + 1], c = Ts[k * 3 + 2];
      // eigen: dominant gradient orientation; strokes run perpendicular (along isophotes)
      const tr = a + b, det = Math.sqrt((a - b) * (a - b) + 4 * c * c);
      const coh = tr > 1e-9 ? det / tr : 0;
      const gAng = 0.5 * Math.atan2(2 * c, a - b);
      const sAng = gAng + Math.PI / 2;
      const sw = coh * Math.min(1, tr * 4000);
      let vx = Math.cos(2 * sAng) * sw, vy = Math.sin(2 * sAng) * sw;
      const hw = angW[k] * (mat[k] === 0 ? 1.6 : 4.0);
      vx += Math.cos(2 * ang[k]) * hw; vy += Math.sin(2 * ang[k]) * hw;
      if (mat[k] === 0) { vx += 0.35; } // sky: gentle horizontal bias
      V[k * 2] = vx; V[k * 2 + 1] = vy;
    }
    const Vs = blurPlane(V, RW, RH, 2, sigma * 0.6, 2);
    const out = new Float32Array(N);
    for (let k = 0; k < N; k++) out[k] = 0.5 * Math.atan2(Vs[k * 2 + 1], Vs[k * 2]);
    return out;
  }

  // ------------------------------------------------------------ bristle library
  function makeBristles(rng) {
    const lib = [];
    for (let i = 0; i < 48; i++) {
      const n = 160, a = new Float32Array(n), dry = new Float32Array(n);
      let prev = 0.8;
      for (let j = 0; j < n; j++) {
        // clumped bristles: correlated random walk with occasional gaps
        prev = mix(prev, rng(), 0.55);
        const gap = rng() < 0.06 ? 0.35 : 1;
        a[j] = clamp(0.55 + 0.6 * prev, 0, 1.1) * gap;
        dry[j] = rng();
      }
      lib.push({ a, dry });
    }
    return lib;
  }

  // ------------------------------------------------------------ the painter
  function paint(study, W, H, scale, stage) {
    const t0 = performance.now();
    const rng = makeRng(90210);
    const NZ = makeNoise(777);
    const N = W * H;
    const S = scale; // px scale relative to 2160 wide
    const ref = upsampleRGB(study.col, study.RW, study.RH, W, H);
    const mat = upsample1(Float32Array.from(study.mat), study.RW, study.RH, W, H, true);
    const depth = upsample1(study.depth.map((d) => Math.min(d, 60)), study.RW, study.RH, W, H, false);
    const sun = upsample1(study.sunlit, study.RW, study.RH, W, H, false);

    // direction fields at two scales (study res), sampled nearest at paint time
    const dirC = directionField(study, 10);
    const dirF = directionField(study, 3.5);
    const fx = study.RW / W, fy = study.RH / H;
    function dirAt(x, y, fine) {
      let i = (x * fx) | 0, j = (y * fy) | 0;
      if (i < 0) i = 0; else if (i >= study.RW) i = study.RW - 1;
      if (j < 0) j = 0; else if (j >= study.RH) j = study.RH - 1;
      return (fine ? dirF : dirC)[j * study.RW + i];
    }

    // detail budget: smallest brush radius allowed per pixel (px at 2160 scale)
    const minR = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      const m = mat[k];
      if (m === 0) minR[k] = 3.2;
      else if (m === 3) minR[k] = 1.1;
      else {
        const d = depth[k];
        minR[k] = d < 1.2 ? 1.3 : d < 3 ? 1.6 : d < 6 ? 1.8 : 2.2;
      }
    }

    // canvas state
    const C = new Float32Array(N * 3);
    const Hh = new Float32Array(N); // paint height
    const Th = new Float32Array(N); // paint film thickness (for weave show-through)
    // toned ground: warm imprimatura, slightly uneven
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x;
      const n = NZ.fbm(x / (300 * S), y / (300 * S), 3) * 0.04;
      C[k * 3] = 0.56 + n; C[k * 3 + 1] = 0.40 + n * 0.8; C[k * 3 + 2] = 0.27 + n * 0.6;
    }

    const bristles = makeBristles(rng);
    // scratch buffers for stroke rasterisation
    let scrCap = 1 << 16;
    let scrD = new Float32Array(scrCap), scrS = new Float32Array(scrCap), scrV = new Float32Array(scrCap);

    let strokesTotal = 0;
    function stroke(pts, R, col, o) {
      // pts: [x0,y0,x1,y1,...]; R half-width px; col [r,g,b]; o: options
      const np = pts.length / 2;
      let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
      for (let i = 0; i < np; i++) {
        const x = pts[i * 2], y = pts[i * 2 + 1];
        if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
      }
      const wd = o.widths;
      let wmax = 1;
      if (wd) for (let i = 0; i < wd.length; i++) if (wd[i] > wmax) wmax = wd[i];
      const pad = R * wmax + 2;
      const x0 = Math.max(0, Math.floor(minx - pad)), x1 = Math.min(W - 1, Math.ceil(maxx + pad));
      const y0 = Math.max(0, Math.floor(miny - pad)), y1 = Math.min(H - 1, Math.ceil(maxy + pad));
      if (x1 < x0 || y1 < y0) return;
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1, bn = bw * bh;
      if (bn > scrCap) {
        scrCap = bn; scrD = new Float32Array(bn); scrS = new Float32Array(bn); scrV = new Float32Array(bn);
      }
      scrD.fill(1e9, 0, bn);
      // segment lengths
      let L = 0;
      const segStart = new Float32Array(np);
      for (let i = 0; i < np - 1; i++) {
        segStart[i] = L;
        L += Math.hypot(pts[i * 2 + 2] - pts[i * 2], pts[i * 2 + 3] - pts[i * 2 + 1]);
      }
      segStart[np - 1] = L;
      if (np === 1) {
        // a dab
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const dx = x - pts[0], dy = y - pts[1];
          const d = Math.hypot(dx, dy);
          const k = (y - y0) * bw + (x - x0);
          scrD[k] = d / R; scrS[k] = 0; scrV[k] = dy / R;
        }
      } else {
        for (let i = 0; i < np - 1; i++) {
          const ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[i * 2 + 2], by = pts[i * 2 + 3];
          const ex = bx - ax, ey = by - ay;
          const ll = ex * ex + ey * ey || 1e-6;
          const sl = Math.sqrt(ll);
          const nx = -ey / sl, ny = ex / sl;
          const sx0 = Math.max(x0, Math.floor(Math.min(ax, bx) - pad)), sx1 = Math.min(x1, Math.ceil(Math.max(ax, bx) + pad));
          const sy0 = Math.max(y0, Math.floor(Math.min(ay, by) - pad)), sy1 = Math.min(y1, Math.ceil(Math.max(ay, by) + pad));
          for (let y = sy0; y <= sy1; y++) {
            for (let x = sx0; x <= sx1; x++) {
              const px = x - ax, py = y - ay;
              const tr = (px * ex + py * ey) / ll;
              const t = tr < 0 ? 0 : tr > 1 ? 1 : tr;
              const qx = px - ex * t, qy = py - ey * t;
              const across = qx * nx + qy * ny;
              const along = Math.sqrt(qx * qx + qy * qy);
              const k = (y - y0) * bw + (x - x0);
              const Rl = wd ? R * (wd[i] + (wd[i + 1] - wd[i]) * t) : R;
              const dn = along / Rl;
              if (dn < scrD[k]) {
                scrD[k] = dn;
                scrS[k] = segStart[i] + tr * sl;
                scrV[k] = across / Rl;
              }
            }
          }
        }
      }
      // composite
      const br = bristles[(rng() * bristles.length) | 0];
      const boff = (rng() * 40) | 0;
      const nb = Math.max(4, Math.min(110, Math.round(R * o.bristleDensity)));
      const soft = o.soft, op = o.opacity, dryness = o.dry;
      const thick = o.thick, pickup = o.pickup || 0;
      const cr = col[0], cg = col[1], cb = col[2];
      const Ltot = L + 1e-3;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const k = (y - y0) * bw + (x - x0);
          const d = scrD[k];
          if (d >= 1) continue;
          const v = clamp(scrV[k], -1, 1);
          const s = scrS[k];
          // edge profile (rounded caps come from distance)
          const ad = d;
          let a = 1 - smooth(1 - soft, 1, ad);
          // bristles
          const bi = boff + Math.min(nb - 1, Math.max(0, Math.floor((v * 0.5 + 0.5) * nb)));
          const bv = br.a[bi];
          const u = clamp(s / Ltot, 0, 1);
          const load = 1 - dryness * u * u * 1.2;
          const thr = br.dry[bi] * 0.7;
          const bris = smooth(thr - 0.25, thr + 0.05, bv * load);
          a *= mix(1, bris, o.bristleContrast);
          // ends taper a little
          a *= smooth(-R * 0.9, R * 0.2, s) * smooth(-R * 0.9, R * 0.3, L - s);
          if (a <= 0.003) continue;
          const A = a * op;
          const gi = ((y0 + 0) + (y - y0)) * W + x;
          const ci = gi * 3;
          let r = cr, g = cg, b = cb;
          if (pickup > 0) {
            const pm = pickup * u;
            r = mix(r, C[ci], pm); g = mix(g, C[ci + 1], pm); b = mix(b, C[ci + 2], pm);
          }
          C[ci] += (r - C[ci]) * A; C[ci + 1] += (g - C[ci + 1]) * A; C[ci + 2] += (b - C[ci + 2]) * A;
          if (thick > 0) {
            const ridge = 1 + 0.55 * smooth(0.55, 0.95, Math.abs(v)) * (1 - u * 0.5);
            const groove = 0.65 + 0.35 * bv;
            const dep = thick * ridge * groove * (1.15 - 0.5 * u) * a;
            Hh[gi] = Hh[gi] * (1 - 0.45 * a) + dep;
            Th[gi] = Th[gi] * (1 - 0.3 * a) + thick * a;
          }
        }
      }
      strokesTotal++;
    }

    // colour helpers
    function lumOf(r, g, b) { return 0.3 * r + 0.59 * g + 0.11 * b; }
    function jitterColor(r, g, b, amt, rr) {
      const l = lumOf(r, g, b);
      const dv = (rr() - 0.5) * amt;
      const dt = (rr() - 0.5) * amt * 0.8; // temperature shift
      const ds = 1 + (rr() - 0.5) * amt * 1.5; // chroma
      r = l + (r - l) * ds + dv + dt; g = l + (g - l) * ds + dv; b = l + (b - l) * ds + dv - dt;
      return [clamp(r, 0, 1.2), clamp(g, 0, 1.2), clamp(b, 0, 1.2)];
    }

    // reference blurred per pass
    function blurredRef(sig) {
      if (sig < 0.8) return ref;
      return blurPlane(ref, W, H, 3, sig, 3);
    }

    // trace a stroke path along the direction field
    function trace(x, y, R, maxSteps, refI, col, fine, horizontalBias, brk) {
      const pts = [x, y];
      let px = x, py = y, pdx = 0, pdy = 0;
      const step = R * 1.05;
      const fwd = rng() < 0.5 ? 1 : -1;
      for (let i = 0; i < maxSteps; i++) {
        let a = dirAt(px, py, fine);
        let dx = Math.cos(a), dy = Math.sin(a);
        if (horizontalBias) { dx = mix(dx, Math.sign(dx || 1), horizontalBias); dy *= 1 - horizontalBias; const l = Math.hypot(dx, dy); dx /= l; dy /= l; }
        if (i === 0) { dx *= fwd; dy *= fwd; }
        else if (dx * pdx + dy * pdy < 0) { dx = -dx; dy = -dy; }
        if (i > 0) { dx = mix(pdx, dx, 0.6); dy = mix(pdy, dy, 0.6); const l = Math.hypot(dx, dy); dx /= l; dy /= l; }
        const nx = px + dx * step, ny = py + dy * step;
        if (nx < -R || ny < -R || nx > W + R || ny > H + R) break;
        const xi = clamp(nx | 0, 0, W - 1), yi = clamp(ny | 0, 0, H - 1);
        const k = (yi * W + xi) * 3;
        const dr = Math.abs(refI[k] - col[0]) + Math.abs(refI[k + 1] - col[1]) + Math.abs(refI[k + 2] - col[2]);
        if (i >= 1 && dr > brk) break;
        pts.push(nx, ny);
        px = nx; py = ny; pdx = dx; pdy = dy;
      }
      return pts;
    }

    // ----------------------------------------------------------------- passes
    const PASSES = [
      // R, blur, opacity, threshold, maxSteps, soft, bristleContrast, thick, pickup
      { R: 46, sig: 26, op: 0.9, thr: -1, steps: 5, soft: 0.5, bc: 0.35, thick: 0.25, under: true },
      { R: 30, sig: 14, op: 0.8, thr: 0.02, steps: 6, soft: 0.45, bc: 0.45, thick: 0.35 },
      { R: 19, sig: 8, op: 0.8, thr: 0.022, steps: 7, soft: 0.4, bc: 0.5, thick: 0.45 },
      { R: 12, sig: 4.5, op: 0.82, thr: 0.025, steps: 7, soft: 0.35, bc: 0.55, thick: 0.5 },
      { R: 7.5, sig: 2.2, op: 0.85, thr: 0.028, steps: 7, soft: 0.3, bc: 0.55, thick: 0.55 },
      { R: 4.6, sig: 1.0, op: 0.88, thr: 0.024, steps: 6, soft: 0.3, bc: 0.5, thick: 0.6 },
      { R: 3.0, sig: 0, op: 0.9, thr: 0.024, steps: 5, soft: 0.3, bc: 0.45, thick: 0.6 },
      { R: 1.9, sig: 0, op: 0.92, thr: 0.026, steps: 4, soft: 0.3, bc: 0.35, thick: 0.55 },
      { R: 1.25, sig: 0, op: 0.95, thr: 0.03, steps: 3, soft: 0.35, bc: 0.25, thick: 0.5 },
    ];
    const maxPass = stage === 'under' ? 1 : PASSES.length;
    for (let pi = 0; pi < maxPass; pi++) {
      const P = PASSES[pi];
      const R = P.R * S;
      if (R < 0.6) continue;
      const refI = blurredRef(P.sig * S);
      const sp = Math.max(1, R * 1.15);
      const cells = [];
      for (let cy = 0; cy < H; cy += sp) for (let cx = 0; cx < W; cx += sp) cells.push(cx, cy);
      // shuffle cells
      const nc = cells.length / 2;
      const order = new Uint32Array(nc);
      for (let i = 0; i < nc; i++) order[i] = i;
      for (let i = nc - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = order[i]; order[i] = order[j]; order[j] = t; }
      let made = 0;
      for (let oi = 0; oi < nc; oi++) {
        const ci = order[oi];
        const cx = cells[ci * 2], cy = cells[ci * 2 + 1];
        // evaluate error in cell; find worst pixel
        let err = 0, cnt = 0, worst = -1, wx = 0, wy = 0, mr = 0;
        const ex1 = Math.min(W, cx + sp), ey1 = Math.min(H, cy + sp);
        const stepE = Math.max(1, Math.floor(sp / 6));
        for (let y = cy | 0; y < ey1; y += stepE) for (let x = cx | 0; x < ex1; x += stepE) {
          const k = y * W + x;
          const e = Math.abs(C[k * 3] - refI[k * 3]) + Math.abs(C[k * 3 + 1] - refI[k * 3 + 1]) + Math.abs(C[k * 3 + 2] - refI[k * 3 + 2]);
          err += e; cnt++;
          mr += minR[k];
          if (e > worst) { worst = e; wx = x; wy = y; }
        }
        if (!cnt) continue;
        err /= cnt; mr /= cnt;
        if (P.R < mr * 0.999 && !P.under) continue; // detail budget
        if (P.thr > 0 && err < P.thr) continue;
        const sx = P.under ? cx + rng() * sp : wx + (rng() - 0.5) * sp * 0.3;
        const sy = P.under ? cy + rng() * sp : wy + (rng() - 0.5) * sp * 0.3;
        const xi = clamp(sx | 0, 0, W - 1), yi = clamp(sy | 0, 0, H - 1);
        const k0 = yi * W + xi;
        let r = refI[k0 * 3], g = refI[k0 * 3 + 1], b = refI[k0 * 3 + 2];
        const m = mat[k0];
        if (P.under) {
          // dead colouring: warmer, lower chroma, a touch darker
          const l = lumOf(r, g, b);
          r = mix(l, r, 0.55) * 0.92 + 0.04; g = mix(l, g, 0.55) * 0.9 + 0.015; b = mix(l, b, 0.55) * 0.85;
        }
        const jit = m === 0 ? 0.008 : m === 3 ? 0.05 : depth[k0] > 3 ? 0.016 : 0.03;
        const col = jitterColor(r, g, b, jit, rng);
        const sky = m === 0;
        const fine = P.R < 10;
        const steps = sky ? P.steps + 6 : P.steps;
        const pts = trace(sx, sy, R, steps, refI, col, fine, sky ? 0.25 : 0, sky ? 0.035 : 0.045);
        // paint load and impasto: highlights get loaded paint
        const lum = lumOf(col[0], col[1], col[2]);
        const lit = sun[k0];
        let thick = P.thick;
        if (sky) thick *= 0.18 + 0.9 * smooth(0.95, 1.02, lum);
        else if (m === 3) thick *= 0.8 + 1.4 * smooth(0.45, 0.8, lum) + lit * 0.6;
        else thick *= 0.45 + 1.0 * smooth(0.55, 0.85, lum) * (depth[k0] < 4 ? 1 : 0.5);
        stroke(pts, R * (0.85 + rng() * 0.3), col, {
          opacity: P.op * (sky ? 0.82 : 1),
          soft: sky ? Math.min(0.85, P.soft + 0.35) : P.soft,
          bristleDensity: 0.9,
          bristleContrast: sky ? P.bc * 0.45 : P.bc,
          dry: sky ? 0.25 : 0.45,
          thick,
          pickup: sky ? 0.25 : 0.12,
        });
        made++;
      }
      console.log('pass', pi, 'R', R.toFixed(1), 'strokes', made, Math.round(performance.now() - t0), 'ms');
    }
    console.log('strokes total', strokesTotal);
    // badger-blending: soften the brushwork along the stroke direction in the sky and the far
    // distance (the hidden brushwork of the Luminists); the foreground keeps its crisp touch
    if (stage !== 'noblend') {
      const L = Math.max(2, Math.round(7 * S));
      const out = new Float32Array(N * 3), outH = new Float32Array(N);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const k = y * W + x;
          const m = mat[k];
          const str = m === 0 ? 0.75 : m === 3 ? 0 : 0.35 * smooth(2.5, 6, depth[k]);
          if (str <= 0.01) { out[k * 3] = C[k * 3]; out[k * 3 + 1] = C[k * 3 + 1]; out[k * 3 + 2] = C[k * 3 + 2]; outH[k] = Hh[k]; continue; }
          let sr = 0, sg = 0, sb = 0, sh = 0, sw = 0;
          for (const dir of [1, -1]) {
            let px2 = x + 0.5, py2 = y + 0.5;
            for (let i = 0; i <= L; i++) {
              if (i > 0 || dir === 1) {
                const xi = px2 | 0, yi = py2 | 0;
                if (xi < 0 || yi < 0 || xi >= W || yi >= H) break;
                const kk = yi * W + xi;
                if ((mat[kk] === 0) !== (m === 0)) break; // never blend across the horizon
                const w = 1 - i / (L + 1);
                sr += C[kk * 3] * w; sg += C[kk * 3 + 1] * w; sb += C[kk * 3 + 2] * w; sh += Hh[kk] * w; sw += w;
              }
              const a = dirAt(px2, py2, true);
              px2 += Math.cos(a) * dir; py2 += Math.sin(a) * dir;
            }
          }
          out[k * 3] = mix(C[k * 3], sr / sw, str); out[k * 3 + 1] = mix(C[k * 3 + 1], sg / sw, str); out[k * 3 + 2] = mix(C[k * 3 + 2], sb / sw, str);
          outH[k] = mix(Hh[k], sh / sw, str * 0.8);
        }
      }
      C.set(out); Hh.set(outH);
      console.log('blend', Math.round(performance.now() - t0), 'ms');
    }
    return { C, Hh, Th, mat, depth, sun, ref, W, H, S, stroke, rng, study };
  }

  G.PAINT = { paint };
})(typeof window !== 'undefined' ? window : globalThis);
