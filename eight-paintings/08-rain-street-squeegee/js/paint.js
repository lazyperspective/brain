// paint.js — oil painting simulation: linen weave, toned ground, umber underpainting, coarse-to-fine
// colour layers of bristle strokes that follow form, transparent glazes in the darks, impasto lights.
// State: C (colour, linear reflectance), Hh (paint+canvas height), Hw (still-wet top paint, for the squeegee).
(function () {
  'use strict';
  const N = P8.noise, FB = P8.fbm, SM = P8.smooth, CL = P8.clamp;

  P8.paint = function (sc, W, H, seed, log) {
    const S = W / 2160, n = W * H, R = P8.rng(seed);
    const ref = sc.ref;
    const C = P8.img(W, H);
    const Hh = new Float32Array(n), Hw = new Float32Array(n);

    // ------------------------------------------------------------ linen canvas (plain weave)
    const weave = new Float32Array(n);
    const p = 4.4 * S;
    const thX = new Float32Array(Math.ceil(W / p) + 8), thY = new Float32Array(Math.ceil(H / p) + 8);
    for (let i = 0; i < thX.length; i++) thX[i] = 0.75 + 0.35 * R() + (R() < 0.06 ? 0.45 : 0);
    for (let i = 0; i < thY.length; i++) thY[i] = 0.75 + 0.35 * R() + (R() < 0.06 ? 0.45 : 0);
    // irregular thread spacing: map pixel -> thread coordinate
    function threadMap(L) {
      const m = new Float32Array(L); let pos = 0, i = 0, nxt = p * (0.8 + 0.45 * R());
      for (let x = 0; x < L; x++) { while (x >= pos + nxt) { pos += nxt; i++; nxt = p * (0.8 + 0.45 * R()); } m[x] = i + (x - pos) / nxt; }
      return m;
    }
    const UX = threadMap(W), VY = threadMap(H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const u = UX[x] + 0.3 * N(y / (70 * S), x / (300 * S), 3) + 0.1 * N(x / (11 * S), y / (23 * S), 4);
        const v = VY[y] + 0.3 * N(x / (70 * S), y / (300 * S), 5) + 0.1 * N(y / (11 * S), x / (23 * S), 6);
        const iu = Math.floor(u), iv = Math.floor(v), fu = u - iu, fv = v - iv;
        const over = ((iu + iv) & 1) === 0;
        const ax = Math.cos(Math.PI * (fu - 0.5)), ay = Math.cos(Math.PI * (fv - 0.5));
        const slx = 1 + 0.3 * N(y / (26 * S), iu * 1.7, 7), sly = 1 + 0.3 * N(x / (26 * S), iv * 1.7, 8);
        const warp = ax * ax * (over ? 0.6 + 0.4 * Math.sin(Math.PI * fv) : 0.45) * thX[(iu + 4) % thX.length] * slx;
        const weft = ay * ay * (!over ? 0.6 + 0.4 * Math.sin(Math.PI * fu) : 0.45) * thY[(iv + 4) % thY.length] * sly;
        weave[y * W + x] = 0.15 * (Math.max(warp, weft) + 0.1 * N(x / (2 * S), y / (2 * S), 9)) * (0.75 + 0.5 * FB(x / (60 * S), y / (60 * S), 2, 10));
      }
    }
    P8.blur(weave, W, H, 0.6 * S, 0.6 * S); // gesso softens the weave
    for (let i = 0; i < n; i++) Hh[i] = weave[i];
    log && log('weave');

    // ------------------------------------------------------------ perceptual reference + structure tensor directions
    const refP = P8.img(W, H);
    const Y = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      refP.r[i] = Math.sqrt(ref.r[i]); refP.g[i] = Math.sqrt(ref.g[i]); refP.b[i] = Math.sqrt(ref.b[i]);
      Y[i] = 0.3 * refP.r[i] + 0.59 * refP.g[i] + 0.11 * refP.b[i];
    }
    const cam = sc.cam;
    function dirField(sig) {
      const jxx = new Float32Array(n), jxy = new Float32Array(n), jyy = new Float32Array(n);
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        const gx = (Y[i + 1] - Y[i - 1]) * 2 + Y[i + 1 - W] - Y[i - 1 - W] + Y[i + 1 + W] - Y[i - 1 + W];
        const gy = (Y[i + W] - Y[i - W]) * 2 + Y[i + W + 1] - Y[i - W + 1] + Y[i + W - 1] - Y[i - W - 1];
        jxx[i] = gx * gx; jxy[i] = gx * gy; jyy[i] = gy * gy;
      }
      P8.blur(jxx, W, H, sig, sig); P8.blur(jxy, W, H, sig, sig); P8.blur(jyy, W, H, sig, sig);
      const th = new Float32Array(n);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const a = jxx[i], b = jxy[i], c = jyy[i];
        const tr = a + c, det = Math.sqrt((a - c) * (a - c) + 4 * b * b);
        const coh = tr > 1e-6 ? Math.min(1, (det / (tr + 0.002)) * Math.min(1, tr * 400)) : 0;
        let ang = 0.5 * Math.atan2(2 * b, a - c) + Math.PI / 2; // isophote direction
        // hint direction from scene semantics
        const id = sc.ID[i];
        let hint;
        if (id === 0) hint = 0.1;
        else if (id === 1 || id === 2 || id === 6) hint = Math.atan2(cam.yh - y, cam.xv - x);
        else if (id === 3 || id === 7) hint = Math.PI / 2;
        else hint = 0.0;
        const vx = coh * Math.cos(2 * ang) + (1 - coh) * 0.7 * Math.cos(2 * hint);
        const vy = coh * Math.sin(2 * ang) + (1 - coh) * 0.7 * Math.sin(2 * hint);
        th[i] = 0.5 * Math.atan2(vy, vx);
      }
      return th;
    }
    const TH = [dirField(26 * S), dirField(9 * S), dirField(3 * S)];
    log && log('directions');

    // ------------------------------------------------------------ stroke rasteriser
    const SCR = 720 * 720;
    const bestD = new Float32Array(SCR), bestU = new Float32Array(SCR), bestS = new Float32Array(SCR);
    let toothMap = new Float32Array(n);
    function updateTooth() {
      const hb = Hh.slice(); P8.blur(hb, W, H, 2.2 * S, 2.2 * S);
      for (let i = 0; i < n; i++) toothMap[i] = CL(0.5 + (hb[i] - Hh[i]) * 1.6, 0, 1);
    }
    const bristle = new Float32Array(65), bristleH = new Float32Array(65);
    // opts: {R, col:[r,g,b], op, thick, dry, ridge, pick, wet, glaze}
    function stroke(pts, o) {
      const Rr = o.R;
      let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
      for (let k = 0; k < pts.length; k++) { minx = Math.min(minx, pts[k][0]); maxx = Math.max(maxx, pts[k][0]); miny = Math.min(miny, pts[k][1]); maxy = Math.max(maxy, pts[k][1]); }
      const pad = Rr + 2;
      const bx0 = Math.max(0, Math.floor(minx - pad)), by0 = Math.max(0, Math.floor(miny - pad));
      const bx1 = Math.min(W - 1, Math.ceil(maxx + pad)), by1 = Math.min(H - 1, Math.ceil(maxy + pad));
      const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
      if (bw <= 0 || bh <= 0 || bw * bh > SCR) return;
      bestD.fill(1e9, 0, bw * bh);
      let s0 = 0;
      const segs = Math.max(1, pts.length - 1);
      for (let k = 0; k < segs; k++) {
        const a = pts[k], b = pts[Math.min(k + 1, pts.length - 1)];
        const vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy, L = Math.sqrt(L2);
        const sx0 = Math.max(bx0, Math.floor(Math.min(a[0], b[0]) - pad)), sx1 = Math.min(bx1, Math.ceil(Math.max(a[0], b[0]) + pad));
        const sy0 = Math.max(by0, Math.floor(Math.min(a[1], b[1]) - pad)), sy1 = Math.min(by1, Math.ceil(Math.max(a[1], b[1]) + pad));
        for (let y = sy0; y <= sy1; y++) {
          for (let x = sx0; x <= sx1; x++) {
            const wx = x + 0.5 - a[0], wy = y + 0.5 - a[1];
            let t = L2 > 1e-9 ? (wx * vx + wy * vy) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
            const qx = wx - vx * t, qy = wy - vy * t, d = Math.sqrt(qx * qx + qy * qy);
            const j = (y - by0) * bw + (x - bx0);
            if (d < bestD[j]) { bestD[j] = d; bestU[j] = (vx * qy - vy * qx) >= 0 ? d : -d; bestS[j] = s0 + t * L; }
          }
        }
        s0 += L;
      }
      const Ltot = Math.max(s0, 1e-3);
      // bristle profile across the brush
      const big = Rr > 2.2;
      let bacc = 0;
      for (let k = 0; k <= 64; k++) {
        const gap = big && R() < 0.07 ? 0.35 : 1;
        bacc = bacc * 0.55 + (0.78 + 0.22 * R()) * gap * 0.45;
        bristle[k] = big ? Math.min(1, bacc * 1.25) : 1;
        bristleH[k] = big ? 0.55 + 0.45 * R() : 1;
      }
      const col = o.col, op = o.op, thick = o.thick, dry = o.dry || 0, ridge = o.ridge || 0, wet = o.wet || 0, glaze = o.glaze || null;
      const cr = col[0], cg = col[1], cb = col[2];
      for (let y = by0; y <= by1; y++) {
        for (let x = bx0; x <= bx1; x++) {
          const j = (y - by0) * bw + (x - bx0);
          const d = bestD[j]; if (d > Rr + 1) continue;
          const s = bestS[j] / Ltot;
          const taper = (0.72 + 0.28 * SM(0, 0.18, s)) * (1 - 0.35 * SM(0.75, 1, s));
          const rr = Rr * taper;
          const au = Math.abs(bestU[j]) / rr;
          if (au > 1 + 0.7 / rr) continue;
          const edge = CL((1 + 0.5 / rr - au) * rr * 0.9, 0, 1); // ~1px antialiased edge
          const bi = Math.round((bestU[j] / rr * 0.5 + 0.5) * 64);
          const bq = bi < 0 ? 0 : bi > 64 ? 64 : bi;
          const load = 1 - dry * SM(0.45, 1.0, s);
          const i = y * W + x;
          const m = load * bristle[bq] * edge;
          const tooth = toothMap[i];
          let a = CL((m - tooth * 0.55 * (0.2 + dry)) * 2.6, 0, 1) * op;
          if (o.tgt) { const dr = Math.abs(o.tgt.r[i] - o.pc[0]) + Math.abs(o.tgt.g[i] - o.pc[1]) + Math.abs(o.tgt.b[i] - o.pc[2]); a *= SM(o.edgeT * 2.2, o.edgeT, dr); }
          if (a <= 0.002) continue;
          if (glaze) {
            const pool = 0.65 + 0.7 * tooth; const g = a * pool;
            C.r[i] *= 1 - g + g * glaze[0]; C.g[i] *= 1 - g + g * glaze[1]; C.b[i] *= 1 - g + g * glaze[2];
            continue;
          }
          const sv = 1 + (bristleH[bq] - 0.75) * 0.13 * (big ? 1 : 0);
          C.r[i] += (cr * sv - C.r[i]) * a; C.g[i] += (cg * sv - C.g[i]) * a; C.b[i] += (cb * sv - C.b[i]) * a;
          const rg = 1 + ridge * Math.exp(-((au - 0.8) * (au - 0.8)) / 0.012);
          const dh = thick * m * bristleH[bq] * rg * (0.75 + 0.6 * tooth);
          Hh[i] += dh; if (wet) Hw[i] += dh * wet;
        }
      }
    }
    P8._stroke = stroke;

    // ------------------------------------------------------------ toned ground + underpainting
    const ground = [0.13, 0.085, 0.055];
    for (let i = 0; i < n; i++) { C.r[i] = ground[0]; C.g[i] = ground[1]; C.b[i] = ground[2]; }
    updateTooth();
    const blurRef = function (sig) { return sig < 0.5 ? refP : P8.blurImg(P8.copyImg(refP), sig, sig); };

    function sampleDir(th, x, y) { const xi = CL(x | 0, 0, W - 1), yi = CL(y | 0, 0, H - 1); return th[yi * W + xi]; }
    function lumP(r, g, b) { return 0.3 * r + 0.59 * g + 0.11 * b; }

    // layer schedule: radius, threshold, max length (in radii), dir field, thickness, opacity, colour jitter, wetness
    const layers = [
      { R: 40, T: 0.0, L: 7, th: 0, thick: 0.05, op: 0.9, jit: 0.10, under: true, dry: 0.7 },
      { R: 26, T: 0.03, L: 8, th: 0, thick: 0.16, op: 0.92, jit: 0.06, dry: 0.35 },
      { R: 14, T: 0.035, L: 9, th: 0, thick: 0.25, op: 0.94, jit: 0.05, dry: 0.3 },
      { R: 7.5, T: 0.035, L: 9, th: 1, thick: 0.25, op: 0.96, jit: 0.045, dry: 0.2 },
      { R: 4.0, T: 0.03, L: 9, th: 1, thick: 0.2, op: 0.97, jit: 0.03, wet: 0.5, dry: 0.1, edge: 0.2 },
      { R: 2.3, T: 0.04, L: 8, th: 2, thick: 0.1, op: 0.98, jit: 0.014, wet: 0.7, dry: 0.05, edge: 0.14 },
      { R: 1.35, T: 0.05, L: 6, th: 2, thick: 0.08, op: 0.98, jit: 0.01, wet: 0.8, dry: 0.0, edge: 0.11 },
      { R: 0.95, T: 0.06, L: 4, th: 2, thick: 0.06, op: 0.98, jit: 0.008, wet: 0.8, dry: 0.0, edge: 0.09 }
    ];

    for (let li = 0; li < layers.length; li++) {
      const Ly = layers[li];
      const Rr = Ly.R * S < 0.9 ? 0.9 : Ly.R * S;
      const tgt = blurRef(Rr * 0.45);
      const th = TH[Ly.th];
      // error map (perceptual)
      const err = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const dr = tgt.r[i] - Math.sqrt(C.r[i]), dg = tgt.g[i] - Math.sqrt(C.g[i]), db = tgt.b[i] - Math.sqrt(C.b[i]);
        err[i] = Math.sqrt(dr * dr + dg * dg + db * db);
      }
      const errB = err.slice(); P8.blur(errB, W, H, Rr * 0.6, Rr * 0.6);
      const step = Math.max(1, Rr * 0.95);
      const cand = [];
      for (let gy = 0; gy < H; gy += step) for (let gx = 0; gx < W; gx += step) {
        const x0 = gx | 0, y0 = gy | 0, xc = Math.min(W - 1, (gx + step * 0.5) | 0), yc = Math.min(H - 1, (gy + step * 0.5) | 0);
        if (!Ly.under && errB[yc * W + xc] < Ly.T) continue;
        // max-error pixel in the cell (subsampled for big cells)
        let best = -1, bx = xc, by = yc;
        const st = Math.max(1, (step / 6) | 0);
        for (let y = y0; y < Math.min(H, y0 + step); y += st) for (let x = x0; x < Math.min(W, x0 + step); x += st) {
          const e = err[y * W + x]; if (e > best) { best = e; bx = x; by = y; }
        }
        cand.push(bx + R() * 0.8 - 0.4, by + R() * 0.8 - 0.4);
      }
      // shuffle
      const nc = cand.length / 2, order = new Uint32Array(nc);
      for (let i = 0; i < nc; i++) order[i] = i;
      for (let i = nc - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; const t = order[i]; order[i] = order[j]; order[j] = t; }
      for (let oi = 0; oi < nc; oi++) {
        const sx = cand[order[oi] * 2], sy = cand[order[oi] * 2 + 1];
        const i0 = CL(sy | 0, 0, H - 1) * W + CL(sx | 0, 0, W - 1);
        let cr = tgt.r[i0], cg = tgt.g[i0], cb = tgt.b[i0];
        if (Ly.under) { // monochrome umber/raw sienna underpainting
          const v = lumP(cr, cg, cb);
          cr = 0.12 + 0.62 * v; cg = 0.08 + 0.48 * v; cb = 0.05 + 0.34 * v;
        }
        // stroke path following the direction field; Hertzmann stop rule
        const pts = [[sx, sy]];
        let x = sx, y = sy, pdx = 0, pdy = 0;
        const stepL = Math.max(1, Rr * 0.8), maxL = Ly.L * Rr;
        let len = 0;
        const rot = (R() - 0.5) * 0.18;
        while (len < maxL) {
          let a = sampleDir(th, x, y) + rot;
          let dx = Math.cos(a), dy = Math.sin(a);
          if (pdx * dx + pdy * dy < 0) { dx = -dx; dy = -dy; }
          if (len === 0 && R() < 0.5) { dx = -dx; dy = -dy; }
          if (len > 0) { dx = 0.6 * dx + 0.4 * pdx; dy = 0.6 * dy + 0.4 * pdy; const l = Math.hypot(dx, dy); dx /= l; dy /= l; }
          const nx = x + dx * stepL, ny = y + dy * stepL;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) break;
          const j = (ny | 0) * W + (nx | 0);
          if (len >= Rr * 1.5 && !Ly.under) {
            const e1 = Math.abs(tgt.r[j] - cr) + Math.abs(tgt.g[j] - cg) + Math.abs(tgt.b[j] - cb);
            const e2 = Math.abs(tgt.r[j] - Math.sqrt(C.r[j])) + Math.abs(tgt.g[j] - Math.sqrt(C.g[j])) + Math.abs(tgt.b[j] - Math.sqrt(C.b[j]));
            if (e1 > e2 + 0.01) break;
          }
          x = nx; y = ny; pdx = dx; pdy = dy; len += stepL; pts.push([x, y]);
        }
        if (pts.length === 1) pts.push([sx + 0.3, sy]);
        // colour: perceptual -> linear, with a painter's jitter in value/temperature
        const jv = 1 + (R() - 0.5) * 2 * Ly.jit, jt = (R() - 0.5) * Ly.jit * 0.8;
        let lr = cr * cr * jv * (1 + jt), lg = cg * cg * jv, lb = cb * cb * jv * (1 - jt);
        const lum = 0.3 * lr + 0.59 * lg + 0.11 * lb;
        stroke(pts, {
          R: Rr * (0.85 + 0.3 * R()), col: [Math.min(0.98, lr), Math.min(0.98, lg), Math.min(0.98, lb)], op: Ly.op,
          thick: Ly.thick * 0.4 * (0.45 + 0.8 * Math.sqrt(lum)), dry: Ly.dry * (0.6 + 0.8 * R()), ridge: Rr > 3 ? 0.25 : 0.1, wet: Ly.wet || 0,
          tgt: Ly.edge ? tgt : null, pc: [cr, cg, cb], edgeT: Ly.edge || 0
        });
      }
      updateTooth();
      log && log('layer R=' + Ly.R + ' strokes ' + nc);

      // transparent glazes over the darks after the mid layers: deepen and enrich (ultramarine / alizarin / umber)
      if (li === 3 || li === layers.length - 1) {
        const gl = [[0.62, 0.68, 0.98], [0.9, 0.55, 0.62], [0.85, 0.7, 0.55], [0.6, 0.85, 0.8]];
        const nG = Math.round(5200 * S * S);
        for (let k = 0; k < nG; k++) {
          const x = R() * W, y = R() * H, i = (y | 0) * W + (x | 0);
          const v = lumP(refP.r[i], refP.g[i], refP.b[i]);
          if (v > 0.32) continue;
          const a = sampleDir(TH[0], x, y), ln = (40 + R() * 80) * S;
          const pts = [[x, y], [x + Math.cos(a) * ln * 0.5, y + Math.sin(a) * ln * 0.5], [x + Math.cos(a) * ln, y + Math.sin(a) * ln]];
          const gsel = gl[(R() * 4) | 0];
          stroke(pts, { R: (14 + R() * 22) * S, col: [0, 0, 0], op: 0.42 * (1 - v / 0.32), thick: 0, glaze: gsel, dry: 0.5 });
        }
        log && log('glazes');
      }
    }

    {
      const paintH = new Float32Array(n), wetH = Hw.slice();
      for (let i = 0; i < n; i++) paintH[i] = Hh[i] - weave[i];
      P8.blur(paintH, W, H, 0.55 * S, 0.55 * S); P8.blur(wetH, W, H, 1.1 * S, 1.1 * S);
      for (let i = 0; i < n; i++) { Hh[i] = weave[i] + paintH[i]; Hw[i] = wetH[i]; }
    }
    // ------------------------------------------------------------ impasto lights: thick short dabs on the brightest passages
    const lh = sc.lumHDR;
    const nI = Math.round(9000 * S * S);
    for (let k = 0; k < nI; k++) {
      const x0 = R() * W, y0 = R() * H, i0 = (y0 | 0) * W + (x0 | 0);
      if (lh[i0] < 1.5) continue;
      // follow the bright structure (a neon tube, a lamp's rim, a glint) with one loaded stroke
      const pts = [[x0, y0]];
      let x = x0, y = y0, pdx = 0, pdy = 0;
      const Lmax = (5 + 16 * R()) * S, st = Math.max(0.8, 1.2 * S);
      for (let s2 = 0; s2 < Lmax; s2 += st) {
        let a = sampleDir(TH[2], x, y), dx = Math.cos(a), dy = Math.sin(a);
        if (pdx * dx + pdy * dy < 0) { dx = -dx; dy = -dy; }
        const nx = x + dx * st, ny = y + dy * st;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) break;
        if (lh[(ny | 0) * W + (nx | 0)] < 1.1) break;
        x = nx; y = ny; pdx = dx; pdy = dy; pts.push([x, y]);
      }
      if (pts.length === 1) pts.push([x0 + 0.4, y0 + 0.4]);
      const c = [ref.r[i0], ref.g[i0], ref.b[i0]];
      const boost = Math.min(1.0, 0.94 / Math.max(c[0], c[1], c[2]));
      stroke(pts, { R: (0.9 + R() * 1.1) * S, col: [c[0] * boost, c[1] * boost, c[2] * boost], op: 0.9, thick: 0.35 + 0.45 * Math.min(1, (lh[i0] - 1.5) / 3), dry: 0.25, ridge: 0.5, wet: 1 });
    }
    log && log('impasto');
    return { C: C, Hh: Hh, Hw: Hw, weave: weave, S: S, toothMap: toothMap };
  };
})();
