'use strict';
// ---------- Hertzmann-style layered stroke passes driven by the reference, with hand-designed flow fields ----------
function boxMean(arr, W, H, x, y, r) { // cheap point sample of 5 taps
  let s = 0;
  for (let k = 0; k < 5; k++) {
    const xx = clamp(Math.round(x + (k === 1 ? r : k === 2 ? -r : 0)), 0, W - 1), yy = clamp(Math.round(y + (k === 3 ? r : k === 4 ? -r : 0)), 0, H - 1);
    s += arr[yy * W + xx];
  }
  return s * 0.2;
}

// cfg: layers[], allowReg (bitmask), clipAllow (bitmask or 0), scaleY(y), flow(x,y,reg), style(reg,l,lum), lenF[reg], tol[reg], layerRange[reg]=[a,b], errT[l]
async function refPass(ref, rd, cfg) {
  const W = P.W, H = P.H, N = P.N, K = W / 2160;
  const rng = cfg.rng || new RNG(cfg.seed || 1);
  const BR = new Float32Array(N), BG = new Float32Array(N), BB = new Float32Array(N), BL = new Float32Array(N), tmp = new Float32Array(N);
  const reg = rd.reg;
  const CR = P.CR, CG = P.CG, CB = P.CB;
  for (let l = 0; l < cfg.layers.length; l++) {
    const wl = cfg.layers[l] * K;
    const sig = Math.max(0.8, wl * (cfg.blurF || 0.38));
    blurInto(rd.R, BR, tmp, W, H, sig); blurInto(rd.G, BG, tmp, W, H, sig); blurInto(rd.B, BB, tmp, W, H, sig);
    for (let i = 0; i < N; i++) BL[i] = 0.3 * BR[i] + 0.55 * BG[i] + 0.15 * BB[i];
    // collect seeds
    const seeds = [];
    const y0 = cfg.y0 !== undefined ? cfg.y0 * K * 2 : 0, y1 = cfg.y1 !== undefined ? cfg.y1 * K * 2 : H;
    const x0 = cfg.x0 !== undefined ? cfg.x0 * K * 2 : 0, x1 = cfg.x1 !== undefined ? cfg.x1 * K * 2 : W;
    let y = y0;
    while (y < y1) {
      const sy = cfg.scaleY ? cfg.scaleY(y / (2 * K)) : 1;
      let x = x0 + rng.next() * wl;
      while (x < x1) {
        seeds.push([x + rng.range(-0.3, 0.3) * wl * sy, y + rng.range(-0.3, 0.3) * wl * sy, sy]);
        x += wl * sy * cfg.gridF * rng.range(0.75, 1.25);
      }
      y += wl * sy * cfg.gridF * rng.range(0.7, 1.1);
    }
    // shuffle
    for (let i = seeds.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); const t = seeds[i]; seeds[i] = seeds[j]; seeds[j] = t; }
    let count = 0, painted = 0;
    for (const sd of seeds) {
      const sx = sd[0], sy_ = sd[1], scl = sd[2]; const srnd = rng.next();
      const ix = clamp(Math.round(sx), 0, W - 1), iy = clamp(Math.round(sy_), 0, H - 1);
      const rg = reg[iy * W + ix];
      if (!(cfg.allowReg & (1 << rg))) continue;
      const lr = cfg.layerRange[rg];
      if (!lr || l < lr[0] || l > lr[1]) continue;
      const w = wl * scl * (cfg.regScale ? cfg.regScale[rg] || 1 : 1) * rng.range(0.72, 1.35);
      if (w < 1.2 * K) continue;
      // error test
      if (l > cfg.firstLayer) {
        const r = Math.max(2, w * 0.45);
        let e = 0;
        for (let k = 0; k < 5; k++) {
          const xx = clamp(Math.round(sx + (k === 1 ? r : k === 2 ? -r : 0)), 0, W - 1), yy = clamp(Math.round(sy_ + (k === 3 ? r : k === 4 ? -r : 0)), 0, H - 1);
          const ii = yy * W + xx;
          e += Math.max(Math.abs(CR[ii] - BR[ii]), Math.abs(CG[ii] - BG[ii]), Math.abs(CB[ii] - BB[ii]));
        }
        e *= 0.2;
        const th = cfg.errT[l] * (cfg.errMul ? cfg.errMul[rg] || 1 : 1);
        if (e < th) continue;
      }
      // trace the path both ways
      const st = cfg.style(rg, l, 0);
      const ds = Math.max(2, w * 0.5);
      const maxSteps = Math.max(2, Math.round((w * cfg.lenF[rg] * rng.range(0.6, 1.4)) / ds));
      const c0r = BR[iy * W + ix], c0g = BG[iy * W + ix], c0b = BB[iy * W + ix];
      const tol = cfg.tol[rg];
      const trace = (dir0) => {
        const out = [];
        let px = sx, py = sy_, pa = null;
        for (let s = 0; s < maxSteps; s++) {
          const ia = clamp(Math.round(px), 0, W - 1), ib = clamp(Math.round(py), 0, H - 1);
          const rr = reg[ib * W + ia];
          if (cfg.stopReg && !(cfg.stopReg & (1 << rr))) break;
          let ang = cfg.flow(px / (2 * K), py / (2 * K), rr, srnd);
          // edge tangent
          const e = Math.max(1.5, w * 0.3);
          const gx = BL[ib * W + clamp(Math.round(px + e), 0, W - 1)] - BL[ib * W + clamp(Math.round(px - e), 0, W - 1)];
          const gy = BL[clamp(Math.round(py + e), 0, H - 1) * W + ia] - BL[clamp(Math.round(py - e), 0, H - 1) * W + ia];
          const gm = Math.hypot(gx, gy) / (2 * e) * w;
          const wt = smooth(cfg.edgeLo, cfg.edgeHi, gm);
          let fx = Math.cos(ang), fy = Math.sin(ang);
          if (wt > 0.001) {
            const gl = Math.hypot(gx, gy) + 1e-9;
            let ex = -gy / gl, ey = gx / gl;
            if (ex * fx + ey * fy < 0) { ex = -ex; ey = -ey; }
            fx = fx * (1 - wt) + ex * wt; fy = fy * (1 - wt) + ey * wt;
          }
          let fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
          if (pa) {
            // keep direction continuous + smooth
            if (fx * pa[0] + fy * pa[1] < 0) { fx = -fx; fy = -fy; }
            fx = 0.55 * fx + 0.45 * pa[0]; fy = 0.55 * fy + 0.45 * pa[1];
            fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
          } else if (dir0 < 0) { fx = -fx; fy = -fy; }
          pa = [fx, fy];
          px += fx * ds; py += fy * ds;
          const ja = clamp(Math.round(px), 0, W - 1), jb = clamp(Math.round(py), 0, H - 1);
          const jj = jb * W + ja;
          if (s > 1) {
            const dd = Math.max(Math.abs(BR[jj] - c0r), Math.abs(BG[jj] - c0g), Math.abs(BB[jj] - c0b));
            if (dd > tol) break;
          }
          if (cfg.stopReg && !(cfg.stopReg & (1 << reg[jj]))) break;
          out.push(px, py);
        }
        return out;
      };
      // forward only trace reversed by rewinding: simpler to trace backward from the seed with reversed direction
      const fwd = trace(1);
      const bwd = trace(-1);
      const pts = [];
      for (let i = bwd.length - 2; i >= 0; i -= 2) pts.push(bwd[i], bwd[i + 1]);
      pts.push(sx, sy_);
      for (let i = 0; i < fwd.length; i += 2) pts.push(fwd[i], fwd[i + 1]);
      if (pts.length < 4) continue;
      // colour along the stroke
      const n = pts.length / 2;
      const mi = Math.floor(n / 2);
      const ei = n - 1;
      const sampleC = (px, py) => { const ii = clamp(Math.round(py), 0, H - 1) * W + clamp(Math.round(px), 0, W - 1); return [BR[ii], BG[ii], BB[ii]]; };
      const cs = sampleC(pts[0], pts[1]), cm = sampleC(pts[2 * mi], pts[2 * mi + 1]), ce = sampleC(pts[2 * ei], pts[2 * ei + 1]);
      let col = [(cs[0] + cm[0] * 2 + ce[0]) / 4, (cs[1] + cm[1] * 2 + ce[1]) / 4, (cs[2] + cm[2] * 2 + ce[2]) / 4];
      const lum = 0.3 * col[0] + 0.55 * col[1] + 0.15 * col[2];
      // painterly colour variation: value + temperature
      const vj = rng.gauss() * (cfg.vj || 0.03), tj = rng.gauss() * (cfg.tj || 0.02);
      col = [col[0] * (1 + vj) + tj, col[1] * (1 + vj), col[2] * (1 + vj) - tj];
      if (cfg.accent && rng.next() < cfg.accent) { const ac = cfg.accentCols[Math.floor(rng.next() * cfg.accentCols.length)]; const am = rng.range(0.12, 0.3); col = [col[0] + (ac[0] - col[0]) * am, col[1] + (ac[1] - col[1]) * am, col[2] + (ac[2] - col[2]) * am]; }
      const col2 = ce[0] !== cs[0] ? [(ce[0] + cm[0]) / 2 + tj * 0.5, (ce[1] + cm[1]) / 2, (ce[2] + cm[2]) / 2 - tj * 0.5] : null;
      const so = cfg.style(rg, l, lum);
      const clip = cfg.clipAllow ? { map: reg, allow: cfg.clipAllow } : null;
      stroke(pts, {
        w, color: col, color2: so.useC2 ? col2 : null, mix: so.mix, alpha: so.alpha, streak: so.streak, dry: so.dry, thick: so.thick, pick: so.pick, cj: so.cj, clip, rng,
      });
      painted++;
      if ((++count & 255) === 0) await tick();
    }
    if (cfg.log) console.log('layer', l, 'seeds', seeds.length, 'painted', painted);
    await tick();
  }
}
