/* Still Life with Lemon — the oil-paint layer.
   Everything here is a fixed linear operator on the light layers (resampling, blurs, strokes that
   deposit averaged colour with fixed alpha), so the painted layers can still be re-mixed per frame
   for the candle flicker. Plus a static paint-surface model: canvas weave, stroke relief, impasto,
   craquelure and varnish gloss.                                                                 */
(function (G) {
  'use strict';
  const Q = G.Q;
  const ID = Q.ID;
  const NP = Q.makeNoise(31337);
  const NC = Q.makeNoise(2024);
  const sqrt = Math.sqrt, abs = Math.abs, min = Math.min, max = Math.max, exp = Math.exp, floor = Math.floor;
  const NCH = 12;
  const BRI = new Float32Array(128), DRY = new Float32Array(128);
  const SCR = { d: new Float32Array(1), t: new Float32Array(1), s: new Float32Array(1) };

  function lumOf(L, i) { const o = i * NCH; return 0.3 * (L[o] + L[o + 3] + 0.5 * (L[o + 6] + L[o + 9])) + 0.6 * (L[o + 1] + L[o + 4] + 0.5 * (L[o + 7] + L[o + 10])) + 0.1 * (L[o + 2] + L[o + 5] + 0.5 * (L[o + 8] + L[o + 11])); }
  Q.lumOf = lumOf;

  // bilinear sample of a NCH-channel buffer
  function sample(L, W, H, x, y, out) {
    if (x < 0) x = 0; if (y < 0) y = 0; if (x > W - 1.001) x = W - 1.001; if (y > H - 1.001) y = H - 1.001;
    const ix = x | 0, iy = y | 0, fx = x - ix, fy = y - iy;
    const i00 = (iy * W + ix) * NCH, i10 = i00 + NCH, i01 = i00 + W * NCH, i11 = i01 + NCH;
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
    for (let c = 0; c < NCH; c++) out[c] = L[i00 + c] * w00 + L[i10 + c] * w10 + L[i01 + c] * w01 + L[i11 + c] * w11;
  }

  // separable box blur (in place) of a NCH buffer, radius r, `passes` times
  function boxBlur(L, W, H, r, passes) {
    const tmp = new Float32Array(max(W, H) * NCH);
    const acc = new Float64Array(NCH);
    for (let p = 0; p < passes; p++) {
      for (let y = 0; y < H; y++) {
        acc.fill(0);
        const row = y * W;
        for (let x = -r; x <= r; x++) { const xx = min(max(x, 0), W - 1); const o = (row + xx) * NCH; for (let c = 0; c < NCH; c++) acc[c] += L[o + c]; }
        for (let x = 0; x < W; x++) {
          for (let c = 0; c < NCH; c++) tmp[x * NCH + c] = acc[c] / (2 * r + 1);
          const xa = min(x + r + 1, W - 1), xr = max(x - r, 0);
          const oa = (row + xa) * NCH, orr = (row + xr) * NCH;
          for (let c = 0; c < NCH; c++) acc[c] += L[oa + c] - L[orr + c];
        }
        L.set(tmp.subarray(0, W * NCH), row * NCH);
      }
      for (let x = 0; x < W; x++) {
        acc.fill(0);
        for (let y = -r; y <= r; y++) { const yy = min(max(y, 0), H - 1); const o = (yy * W + x) * NCH; for (let c = 0; c < NCH; c++) acc[c] += L[o + c]; }
        for (let y = 0; y < H; y++) {
          for (let c = 0; c < NCH; c++) tmp[y * NCH + c] = acc[c] / (2 * r + 1);
          const ya = min(y + r + 1, H - 1), yr = max(y - r, 0);
          const oa = (ya * W + x) * NCH, orr = (yr * W + x) * NCH;
          for (let c = 0; c < NCH; c++) acc[c] += L[oa + c] - L[orr + c];
        }
        for (let y = 0; y < H; y++) { const o = (y * W + x) * NCH; for (let c = 0; c < NCH; c++) L[o + c] = tmp[y * NCH + c]; }
      }
    }
  }
  function boxBlur1(A, W, H, r, passes) {
    const tmp = new Float32Array(max(W, H));
    for (let p = 0; p < passes; p++) {
      for (let y = 0; y < H; y++) {
        let acc = 0; const row = y * W;
        for (let x = -r; x <= r; x++) acc += A[row + min(max(x, 0), W - 1)];
        for (let x = 0; x < W; x++) { tmp[x] = acc / (2 * r + 1); acc += A[row + min(x + r + 1, W - 1)] - A[row + max(x - r, 0)]; }
        A.set(tmp.subarray(0, W), row);
      }
      for (let x = 0; x < W; x++) {
        let acc = 0;
        for (let y = -r; y <= r; y++) acc += A[min(max(y, 0), H - 1) * W + x];
        for (let y = 0; y < H; y++) { tmp[y] = acc / (2 * r + 1); acc += A[min(y + r + 1, H - 1) * W + x] - A[max(y - r, 0) * W + x]; }
        for (let y = 0; y < H; y++) A[y * W + x] = tmp[y];
      }
    }
  }
  Q.boxBlur1 = boxBlur1;

  // ---------------------------------------------------------------- canvas weave height (pixels in 4K units)
  function weave(x, y) {
    const p = 6.2;
    const wx = x + 1.2 * NC.n2(y * 0.013, x * 0.004), wy = y + 1.2 * NC.n2(x * 0.013 + 9, y * 0.004);
    const u = wx / p, v = wy / p;
    const iu = floor(u), iv = floor(v), fu = u - iu, fv = v - iv;
    // per-thread thickness irregularity (slubs)
    const tu = 0.75 + 0.5 * Q.hash2i(iu, floor(v * 0.11), 11);
    const tv = 0.75 + 0.5 * Q.hash2i(floor(u * 0.11), iv, 12);
    const su = Math.sin(Math.PI * fu), sv = Math.sin(Math.PI * fv);
    const over = ((iu + iv) & 1) === 0;
    // the thread on top bulges in the middle of the crossing
    const hu = su * tu * (over ? 0.6 + 0.4 * sv : 0.35 + 0.25 * sv);
    const hv = sv * tv * (over ? 0.35 + 0.25 * su : 0.6 + 0.4 * su);
    return max(hu, hv);
  }

  // ---------------------------------------------------------------- craquelure (F2-F1 on a warped jittered grid)
  function cracks(x, y) {
    // returns [crackStrength 0..1, cupHeight]
    const cell = 30;
    const wx = x + 9 * NC.fbm2(x * 0.008, y * 0.008, 3), wy = y + 9 * NC.fbm2(x * 0.008 + 17, y * 0.008 - 5, 3);
    // anisotropic: oil craquelure on canvas tends to run in a loose grid
    const u = wx / (cell * 1.15), v = wy / cell;
    const iu = floor(u), iv = floor(v);
    let d1 = 1e9, d2 = 1e9;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cu = iu + i, cv = iv + j;
      const px = cu + 0.15 + 0.7 * Q.hash2i(cu, cv, 1), py = cv + 0.15 + 0.7 * Q.hash2i(cu, cv, 2);
      const dx = (u - px) * 1.15, dy = v - py;
      const d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    const e = (sqrt(d2) - sqrt(d1)) * cell; // ~ pixel distance to the cell border
    let c = exp(-(e * e) / (2 * 0.45 * 0.45));
    // fine secondary network, only in patches
    const cell2 = 13;
    const u2 = (wx + 300) / cell2, v2 = (wy - 120) / cell2;
    const ju = floor(u2), jv = floor(v2);
    let e1 = 1e9, e2 = 1e9;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cu = ju + i, cv = jv + j;
      const px = cu + 0.1 + 0.8 * Q.hash2i(cu, cv, 5), py = cv + 0.1 + 0.8 * Q.hash2i(cu, cv, 6);
      const d = (u2 - px) * (u2 - px) + (v2 - py) * (v2 - py);
      if (d < e1) { e2 = e1; e1 = d; } else if (d < e2) e2 = d;
    }
    const ee = (sqrt(e2) - sqrt(e1)) * cell2;
    const patch = Q.smooth(0.05, 0.35, NC.fbm2(x * 0.0022 + 40, y * 0.0022, 3));
    c = max(c, 0.6 * patch * exp(-(ee * ee) / (2 * 0.5 * 0.5)));
    // the main cracks are not continuous everywhere
    c *= 0.25 + 0.75 * Q.smooth(-0.3, 0.25, NC.n2(x * 0.02, y * 0.02));
    const cup = d1 * 1.0;
    return [c, cup];
  }

  // ---------------------------------------------------------------- the painting pass
  // st: static render (layers, id, tang...). Returns painted layers + surface buffers.
  Q.paintStatic = function (st, log) {
    const W = st.W, H = st.H, N = W * H;
    const sc = W / 2160;
    const src = st.layers;
    const rnd = Q.mulberry32(777);
    log = log || (() => {});

    // 1. hand-drawn wobble: resample everything with a slow displacement field
    const warped = new Float32Array(N * NCH);
    const id = new Uint8Array(N), tang = new Float32Array(N * 2), depth = new Float32Array(N);
    const tmp = new Float32Array(NCH);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const ox = 3.2 * sc * NP.fbm2(x / W * 11, y / H * 11, 3), oy = 3.2 * sc * NP.fbm2(x / W * 11 + 50, y / H * 11, 3);
      sample(src, W, H, x + ox, y + oy, tmp);
      warped.set(tmp, i * NCH);
      const xs = min(max(Math.round(x + ox), 0), W - 1), ys = min(max(Math.round(y + oy), 0), H - 1);
      const j = ys * W + xs;
      id[i] = st.id[j]; tang[i * 2] = st.tang[j * 2]; tang[i * 2 + 1] = st.tang[j * 2 + 1]; depth[i] = st.depth[j];
    }
    log('wobble');

    // nominal luminance
    const lum = new Float32Array(N);
    for (let i = 0; i < N; i++) lum[i] = lumOf(warped, i);

    // 2. soften: lose edges in the darks, keep them in the lights
    // first: stray bright pixels in the background (antialiased glints) are clamped so no stroke drags them
    {
      const lw = new Float32Array(lum);
      boxBlur1(lw, W, H, max(2, Math.round(10 * sc)), 2);
      for (let i = 0; i < N; i++) {
        if ((id[i] === ID.WALL || id[i] === ID.APRON) && lum[i] > 1.3 * lw[i] + 0.0005) {
          const k = (1.3 * lw[i] + 0.0005) / lum[i];
          const o = i * NCH; for (let c = 0; c < NCH; c++) warped[o + c] *= k;
          lum[i] *= k;
        }
      }
    }
    const soft = new Float32Array(warped);
    boxBlur(soft, W, H, max(1, Math.round(2.5 * sc)), 2);
    const wide = new Float32Array(warped);
    boxBlur(wide, W, H, max(2, Math.round(9 * sc)), 2);
    log('blur');
    const lumWide = new Float32Array(N);
    for (let i = 0; i < N; i++) lumWide[i] = lumOf(wide, i);
    const base = warped; // reuse buffer: base becomes the softened image
    for (let i = 0; i < N; i++) {
      const l = lum[i];
      const dark = 1 - Q.smooth(0.004, 0.06, l);
      const kid = id[i];
      let wS = 0.35 + 0.65 * dark;           // general softness
      let wW = 0;
      if (kid === ID.WALL) { wS = 1; wW = 0.85; }
      else if (kid === ID.APRON) { wS = 1; wW = 0.7; }
      else if (kid === ID.TOP || kid === ID.FRONT) { wW = 0.25 * dark; }
      else if (kid === ID.GLASS) { wS = 0.25 + 0.5 * dark; }
      else if (kid === 21) { wS = 0.25; }
      const o = i * NCH;
      for (let c = 0; c < NCH; c++) {
        const v0 = base[o + c], v1 = soft[o + c], v2 = wide[o + c];
        const a = v0 + (v1 - v0) * wS;
        base[o + c] = a + (v2 - a) * wW;
      }
    }
    log('soften');

    // 3. brush strokes
    const canvas = new Float32Array(base);
    const paintH = new Float32Array(N);    // paint thickness / relief
    // stroke direction field
    const dirAt = (x, y, i, pass) => {
      const kid = id[i];
      let tx = tang[i * 2], ty = tang[i * 2 + 1];
      if (kid === ID.WALL || kid === ID.APRON || kid === 0) {
        const a = 0.75 + 1.1 * NP.fbm2(x / W * 2.2 + pass * 3.1, y / H * 2.2, 3) + (pass & 1) * 1.15;
        tx = Math.cos(a); ty = Math.sin(a);
      } else if (kid === ID.TOP || kid === ID.FRONT || kid === ID.NOSE) {
        const a = 0.08 * NP.n2(x / W * 6, y / H * 6 + pass);
        tx = Math.cos(a); ty = Math.sin(a);
      } else if (kid === ID.GLASS) {
        tx = 0.0; ty = 1.0;
      }
      return [tx, ty];
    };
    // classes: brush radius ranges in 4K px
    const brushFor = (kid) => {
      switch (kid) {
        case ID.WALL: return [30, 46, 7.5, 0.55];      // rMin, rMax, lengthFactor, opacity
        case ID.APRON: return [20, 30, 6, 0.5];
        case ID.TOP: return [12, 24, 7, 0.5];
        case ID.FRONT: case ID.NOSE: return [8, 14, 7, 0.45];
        case ID.PLATE: return [8, 16, 5, 0.5];
        case ID.GLASS: return [4, 8, 4, 0.32];
        case ID.LEMON: return [8, 16, 3.2, 0.5];
        case 21: return [4, 8, 2.5, 0.4];
        case 22: return [8, 16, 3.2, 0.55];
        case ID.HANDLE: return [7, 13, 4, 0.5];
        case ID.BLADE: case ID.BOLSTER: return [4, 7, 4, 0.45];
        default: return [10, 20, 5, 0.5];
      }
    };
    // gradient magnitude of log luminance (detail measure) for brush size modulation
    const detail = new Float32Array(N);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const gx = Math.log(lum[i + 1] + 0.003) - Math.log(lum[i - 1] + 0.003);
      const gy = Math.log(lum[i + W] + 0.003) - Math.log(lum[i - W] + 0.003);
      detail[i] = sqrt(gx * gx + gy * gy);
    }
    boxBlur1(detail, W, H, max(1, Math.round(4 * sc)), 2);

    const strokes = [];
    const passes = 3;
    for (let pass = 0; pass < passes; pass++) {
      const scaleP = pass === 0 ? 1.0 : pass === 1 ? 0.6 : 0.36;
      const spacing = 16 * sc * (pass === 0 ? 1.6 : pass === 1 ? 1.0 : 0.7);
      for (let gy = 0; gy < H; gy += spacing) for (let gx = 0; gx < W; gx += spacing) {
        const x = gx + rnd() * spacing, y = gy + rnd() * spacing;
        if (x >= W || y >= H) continue;
        const i = (y | 0) * W + (x | 0);
        const kid = id[i];
        const b = brushFor(kid);
        const det = Q.clamp(detail[i] * 3.0, 0, 1);
        let R = (b[1] - (b[1] - b[0]) * det) * scaleP * sc;
        // later passes only where there is detail (or on the wall, for scumbling)
        if (pass > 0 && det < 0.15 * pass && kid !== ID.WALL && rnd() > 0.35) continue;
        if (pass === 0 && kid !== ID.WALL && kid !== ID.APRON && kid !== ID.TOP && rnd() < 0.3) continue;
        // area check: is this location still worth a stroke at this brush size? (min density)
        if (R * 2 < spacing * 0.5 && rnd() < 0.5) continue;
        strokes.push({ x, y, R, kid, pass, len: R * b[2] * (0.6 + 0.8 * rnd()), op: b[3] * (0.8 + 0.4 * rnd()), seed: (rnd() * 1e9) | 0 });
      }
    }
    log('strokes planned ' + strokes.length);
    // render strokes in order (large first; passes are already ordered)
    const pathX = new Float32Array(256), pathY = new Float32Array(256);
    const col = new Float64Array(NCH);
    let painted = 0;
    for (let s = 0; s < strokes.length; s++) {
      const st0 = strokes[s];
      const R = st0.R;
      const step = max(1, R * 0.5);
      // trace path both ways along the field
      const i0 = (st0.y | 0) * W + (st0.x | 0);
      const kid = st0.kid;
      const lum0 = lum[i0];
      if (R > 8 * sc && lum0 > 1.6 * lumWide[i0] + 0.002) continue; // don't drag a stray highlight across the wall
      let n = 0;
      const half = st0.len * 0.5;
      const fw = [], bw = [];
      for (let dirSign = 1; dirSign >= -1; dirSign -= 2) {
        let x = st0.x, y = st0.y, px = 0, py = 0, l = 0;
        const list = dirSign > 0 ? fw : bw;
        while (l < half && list.length < 120) {
          const ii = (y | 0) * W + (x | 0);
          let d = dirAt(x, y, ii, st0.pass);
          let tx = d[0] * dirSign, ty = d[1] * dirSign;
          if (l > 0 && tx * px + ty * py < 0) { tx = -tx; ty = -ty; }
          px = tx; py = ty;
          x += tx * step; y += ty * step; l += step;
          if (x < 0 || y < 0 || x >= W || y >= H) break;
          const jj = (y | 0) * W + (x | 0);
          if (id[jj] !== kid) break;
          const lj = lum[jj];
          if (abs(Math.log((lj + 0.002) / (lum0 + 0.002))) > 0.55) break;
          list.push(x, y);
        }
      }
      for (let k = bw.length - 2; k >= 0; k -= 2) { pathX[n] = bw[k]; pathY[n] = bw[k + 1]; n++; }
      pathX[n] = st0.x; pathY[n] = st0.y; n++;
      for (let k = 0; k < fw.length; k += 2) { pathX[n] = fw[k]; pathY[n] = fw[k + 1]; n++; }
      if (n < 2) { pathX[1] = st0.x + 0.5; pathY[1] = st0.y; n = 2; }
      // stroke colour: average of the source along the path
      col.fill(0);
      let nUsed = 0;
      for (let k = 0; k < n; k++) {
        const ii = (pathY[k] | 0) * W + (pathX[k] | 0);
        if (R > 8 * sc && lum[ii] > 1.5 * lumWide[ii] + 0.001) continue; // ignore stray highlights
        sample(base, W, H, pathX[k], pathY[k], tmp); for (let c = 0; c < NCH; c++) col[c] += tmp[c]; nUsed++;
      }
      if (nUsed === 0) { sample(wide, W, H, st0.x, st0.y, tmp); for (let c = 0; c < NCH; c++) col[c] = tmp[c]; nUsed = 1; }
      for (let c = 0; c < NCH; c++) col[c] /= nUsed;
      // subtle broken colour
      const r1 = Q.hash2i(st0.seed, 1, 9) - 0.5, r2 = Q.hash2i(st0.seed, 2, 9) - 0.5, r3 = Q.hash2i(st0.seed, 3, 9) - 0.5;
      const vj = kid === ID.WALL || kid === ID.APRON ? 0.16 : kid === ID.TOP ? 0.09 : 0.06;
      const cm = [1 + vj * (r1 + 0.4 * r2), 1 + vj * (r1 * 0.9 + 0.3 * r3), 1 + vj * (r1 * 0.8 - 0.5 * r2)];
      for (let c = 0; c < NCH; c++) col[c] *= cm[c % 3];
      const lumC = lumOf(col, 0);
      const streak = kid === ID.WALL || kid === ID.APRON ? 0.24 : kid === ID.TOP ? 0.18 : kid === ID.GLASS ? 0.07 : 0.17;
      const thick = (0.12 + 0.9 * Math.pow(Q.clamp(lumC / 0.9, 0, 1), 0.6)) * (0.6 + 0.4 * Q.clamp(R / (12 * sc), 0, 1.5));
      // rasterize: for each segment, pixels within R
      let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
      for (let k = 0; k < n; k++) { minx = min(minx, pathX[k]); maxx = max(maxx, pathX[k]); miny = min(miny, pathY[k]); maxy = max(maxy, pathY[k]); }
      const x0 = max(0, floor(minx - R - 1)), x1 = min(W - 1, Math.ceil(maxx + R + 1));
      const y0 = max(0, floor(miny - R - 1)), y1 = min(H - 1, Math.ceil(maxy + R + 1));
      // cumulative length
      const cum = new Float32Array(n);
      for (let k = 1; k < n; k++) cum[k] = cum[k - 1] + Math.hypot(pathX[k] - pathX[k - 1], pathY[k] - pathY[k - 1]);
      const totalL = cum[n - 1] || 1;
      const bristleF = 1.0 / max(1.2 * sc, R * 0.16); // bristle spacing
      // per-stroke bristle tables across the width (streaks run the length of the stroke)
      for (let k = 0; k < 128; k++) {
        const bq = ((k / 127) * 2 - 1) * R * bristleF + (st0.seed % 97);
        BRI[k] = 0.55 + 0.45 * NP.n2(bq, st0.seed % 13) + 0.25 * NP.n2(bq * 2.7, 3.3);
        DRY[k] = 0.6 + 0.5 * NP.n2(bq * 1.7, 7 + (st0.seed % 7));
      }
      const bw2 = x1 - x0 + 1, bh2 = y1 - y0 + 1;
      if (bw2 * bh2 > SCR.d.length) { SCR.d = new Float32Array(bw2 * bh2 * 2); SCR.t = new Float32Array(bw2 * bh2 * 2); SCR.s = new Float32Array(bw2 * bh2 * 2); }
      const SD = SCR.d, ST = SCR.t, SS = SCR.s;
      SD.fill(1e9, 0, bw2 * bh2);
      const R2 = R * R;
      for (let k = 0; k < n - 1; k++) {
        const ax = pathX[k], ay = pathY[k], bx = pathX[k + 1], by = pathY[k + 1];
        const vx = bx - ax, vy = by - ay; const vv = vx * vx + vy * vy || 1e-6; const vl = Math.sqrt(vv);
        const sx0 = max(x0, floor(min(ax, bx) - R)), sx1 = min(x1, Math.ceil(max(ax, bx) + R));
        const sy0 = max(y0, floor(min(ay, by) - R)), sy1 = min(y1, Math.ceil(max(ay, by) + R));
        for (let yy = sy0; yy <= sy1; yy++) {
          const row = (yy - y0) * bw2 - x0;
          for (let xx = sx0; xx <= sx1; xx++) {
            let t = ((xx - ax) * vx + (yy - ay) * vy) / vv; t = t < 0 ? 0 : t > 1 ? 1 : t;
            const dx = xx - (ax + vx * t), dy = yy - (ay + vy * t); const d = dx * dx + dy * dy;
            if (d < R2 && d < SD[row + xx]) { SD[row + xx] = d; ST[row + xx] = cum[k] + t * vl; SS[row + xx] = (vx * (yy - ay) - vy * (xx - ax)) / vl; }
          }
        }
      }
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
        const si = (yy - y0) * bw2 + (xx - x0);
        const bd = SD[si];
        if (bd >= R2) continue;
        const bt = ST[si], bs = SS[si];
        const d = sqrt(bd) / R;
        const i = yy * W + xx;
        if (id[i] !== kid && !(kid === ID.WALL && id[i] === 0)) continue;
        const along = bt / totalL;
        // bristle streaks across the width
        let bk = ((bs / R) * 0.5 + 0.5) * 127; bk = bk < 0 ? 0 : bk > 127 ? 127 : bk | 0;
        const bri = BRI[bk] * (0.92 + 0.08 * Math.sin(along * 9 + bk));
        const prof = Q.smooth(1.0, 0.55, d);
        // paint load: starts full, breaks up toward the end (dry brush)
        const dry = Q.smooth(0.55, 1.0, along) * DRY[bk] * (0.85 + 0.3 * along);
        let a = st0.op * prof * Q.clamp(bri, 0, 1.2) * (1 - Q.clamp(dry, 0, 0.85)) * Q.smooth(0.0, 0.06, along);
        if (a <= 0.003) continue;
        if (a > 0.95) a = 0.95;
        const o = i * NCH;
        // bristle streaks carry slightly different paint: value modulation along the hairs
        const vm = 1 + streak * (bri - 0.8);
        for (let c = 0; c < NCH; c++) canvas[o + c] += (col[c] * vm - canvas[o + c]) * a;
        // relief: ridges along bristles + pushed-up edge
        const ridge = 0.6 + 0.4 * bri + 0.35 * exp(-((d - 0.82) * (d - 0.82)) / 0.012);
        const h = thick * ridge * (1 - 0.5 * dry);
        paintH[i] += (h - paintH[i]) * min(1, a * 1.2);
      }
      painted++;
    }
    log('strokes painted ' + painted);

    // 4. impasto in the highlights: thick little touches of lead white along the form
    const spec = new Float32Array(N);
    for (let i = 0; i < N; i++) { const o = i * NCH; spec[i] = 0.3 * (canvas[o + 6] + canvas[o + 9]) + 0.6 * (canvas[o + 7] + canvas[o + 10]) + 0.1 * (canvas[o + 8] + canvas[o + 11]); }
    const dabs = [];
    const dsp = 4 * sc;
    for (let gy = 0; gy < H; gy += dsp) for (let gx = 0; gx < W; gx += dsp) {
      const x = gx + rnd() * dsp, y = gy + rnd() * dsp;
      if (x >= W || y >= H) continue;
      const i = (y | 0) * W + (x | 0);
      const l = lum[i] + spec[i] * 0.5;
      const hi = Q.smooth(0.10, 0.55, spec[i] + 0.22 * lum[i]);
      if (hi <= 0.02 || rnd() > hi * 1.4) continue;
      dabs.push({ x, y, R: (2.2 + 3.2 * rnd()) * sc * (0.7 + 0.6 * hi), hi, seed: (rnd() * 1e9) | 0, l });
    }
    for (let s = 0; s < dabs.length; s++) {
      const dd = dabs[s];
      const i0 = (dd.y | 0) * W + (dd.x | 0);
      const kid = id[i0];
      const d = dirAt(dd.x, dd.y, i0, 0);
      const len = dd.R * (1.5 + 2 * Q.hash2i(dd.seed, 4, 4));
      sample(canvas, W, H, dd.x, dd.y, tmp);
      // the dab carries a bit more of the highlight than its surroundings
      const x0 = max(0, floor(dd.x - len - dd.R)), x1 = min(W - 1, Math.ceil(dd.x + len + dd.R));
      const y0 = max(0, floor(dd.y - len - dd.R)), y1 = min(H - 1, Math.ceil(dd.y + len + dd.R));
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
        const rx = xx - dd.x, ry = yy - dd.y;
        const al = rx * d[0] + ry * d[1], ac = -rx * d[1] + ry * d[0];
        const q = (al / len) * (al / len) + (ac / dd.R) * (ac / dd.R);
        if (q >= 1) continue;
        const i = yy * W + xx;
        if (id[i] !== kid) continue;
        const prof = 1 - q;
        const bri = 0.6 + 0.4 * NP.n2(ac / (1.1 * sc) + (dd.seed % 50), al * 0.05);
        const a = Q.clamp(prof * 1.6, 0, 1) * 0.55 * dd.hi;
        const o = i * NCH;
        for (let c = 0; c < NCH; c++) canvas[o + c] += (tmp[c] * 1.04 - canvas[o + c]) * a;
        const h = (1.6 + 1.6 * dd.hi) * (0.4 + 0.6 * prof) * bri;
        if (h > paintH[i]) paintH[i] += (h - paintH[i]) * Q.clamp(prof * 2, 0, 1);
      }
    }
    log('impasto dabs ' + dabs.length);

    // 5. surface: canvas weave under thin paint + paint relief + craquelure cupping
    const height = new Float32Array(N);
    const crackM = new Float32Array(N);
    const weaveA = new Float32Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const X = x / sc, Y = y / sc;
      const thin = exp(-paintH[i] * 1.6) * (1 - Q.smooth(0.02, 0.35, lum[i]) * 0.6);
      const cr = cracks(X, Y);
      crackM[i] = cr[0];
      weaveA[i] = weave(X, Y) * thin;
      height[i] = weave(X, Y) * 0.9 * thin + paintH[i] * 0.85 + cr[1] * 0.35 - cr[0] * 0.5;
    }
    log('surface');
    // relief lighting from upper left (the room light on the canvas)
    const relief = new Float32Array(N), gloss = new Float32Array(N);
    const lx = -0.42, ly = -0.55, lz = 0.72; // light dir in screen space (y down)
    const hx = lx, hy = ly, hz = lz + 1; const hl = sqrt(hx * hx + hy * hy + hz * hz);
    const kH = 2.0 / sc; // height units -> slope
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const xl = x > 0 ? i - 1 : i, xr = x < W - 1 ? i + 1 : i, yu = y > 0 ? i - W : i, yd = y < H - 1 ? i + W : i;
      const gx = (height[xr] - height[xl]) * 0.5 * kH, gy = (height[yd] - height[yu]) * 0.5 * kH;
      let nx = -gx, ny = -gy, nz = 1; const nl = sqrt(nx * nx + ny * ny + 1); nx /= nl; ny /= nl; nz /= nl;
      const ndl = nx * lx + ny * ly + nz * lz;
      relief[i] = Q.clamp(1 + 0.9 * (ndl - lz), 0.55, 1.4);
      const ndh = max(0, (nx * hx + ny * hy + nz * hz) / hl);
      const thick = Q.smooth(0.3, 2.0, paintH[i]);
      gloss[i] = Math.pow(ndh, 90) * (0.05 + 0.95 * thick);
    }
    log('relief');
    return { W, H, layers: canvas, relief, gloss, crack: crackM, weave: weaveA, id, depth, lum, paintH };
  };

  // weave + cracks only (for dynamic overlays painted "on the same canvas")
  Q.canvasOnly = function (x, y, sc) { return weave(x / sc, y / sc); };
})(typeof window !== 'undefined' ? window : globalThis);
