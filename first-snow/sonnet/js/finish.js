'use strict';
// ---------- canvas weave, impasto relief lighting, final grade ----------
function weaveHeight(x, y, p, noise) {
  const ca = 0.99996, sa = 0.0087; // slight rotation, avoids perfect alignment
  const xr = x * ca + y * sa, yr = -x * sa + y * ca;
  const u = xr / p, v = yr / p;
  const iu = Math.floor(u), iv = Math.floor(v);
  const fu = u - iu, fv = v - iv;
  const over = (iu + iv) & 1;
  const hu = Math.sin(Math.PI * fu), hv = Math.sin(Math.PI * fv);
  let h;
  if (over) h = Math.pow(hu, 0.8) * (0.62 + 0.38 * hv);
  else h = Math.pow(hv, 0.8) * (0.62 + 0.38 * hu);
  // thread irregularity (slubs)
  const sl = noise.n2(x * 0.06, y * 0.9) * 0.5 + noise.n2(x * 0.9, y * 0.06) * 0.5;
  return h + sl * 0.18;
}

// slight hand-wobble: displaces the paint layers by smooth noise so crisp edges never look ruled
function warpPaint(a1, a2) {
  const W = P.W, H = P.H, N = P.N;
  const nz = new Noise(31415), nz2 = new Noise(27182);
  const srcs = [P.CR, P.CG, P.CB, P.HT];
  const dsts = srcs.map(() => new Float32Array(N));
  const K = W / 2160;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = a1 * nz.n2(x / (52 * K), y / (52 * K)) + a2 * nz2.n2(x / (10 * K), y / (10 * K));
      const dy = a1 * nz.n2(x / (52 * K) + 40, y / (52 * K) + 17) + a2 * nz2.n2(x / (10 * K) + 31, y / (10 * K) + 7);
      let sx = x + dx, sy = y + dy;
      sx = sx < 0 ? 0 : sx > W - 1.001 ? W - 1.001 : sx; sy = sy < 0 ? 0 : sy > H - 1.001 ? H - 1.001 : sy;
      const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0;
      const i00 = y0 * W + x0, i10 = i00 + 1, i01 = i00 + W, i11 = i01 + 1;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      const o = y * W + x;
      for (let c = 0; c < 4; c++) { const s = srcs[c]; dsts[c][o] = s[i00] * w00 + s[i10] * w10 + s[i01] * w01 + s[i11] * w11; }
    }
  }
  P.CR = dsts[0]; P.CG = dsts[1]; P.CB = dsts[2]; P.HT = dsts[3];
}

function finishImage(opts) {
  if (opts.warp) warpPaint(opts.warp[0] * (P.W / 2160), opts.warp[1] * (P.W / 2160));
  const W = P.W, H = P.H, N = P.N;
  const noise = new Noise(7771);
  const S = new Float32Array(N);
  const K = W / 2160;
  const p = 3.7 * K;
  const wA = opts.weaveAmp, kw = opts.weaveHide, hs = opts.heightScale;
  const HT = P.HT;
  // soften bristle-scale micro-grooves a little so relief reads as paint ridges, not engraving
  const HS = new Float32Array(N), tmpb = new Float32Array(N);
  blurInto(HT, HS, tmpb, W, H, 0.85 * K);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const wv = weaveHeight(x, y, p, noise) - 0.5;
      S[i] = wv * wA * Math.exp(-HT[i] * kw) + (0.35 * HT[i] + 0.65 * HS[i]) * hs;
    }
  }
  const out = new Uint8ClampedArray(N * 4);
  const L = [-0.50, -0.58, 0.64]; const ll = Math.hypot(L[0], L[1], L[2]); L[0] /= ll; L[1] /= ll; L[2] /= ll;
  const Hh = [L[0], L[1], L[2] + 1]; const hl = Math.hypot(Hh[0], Hh[1], Hh[2]); Hh[0] /= hl; Hh[1] /= hl; Hh[2] /= hl;
  const ns = opts.normalStrength, ka = opts.diffuse, ksp = opts.spec;
  const CR = P.CR, CG = P.CG, CB = P.CB;
  const cx = W * 0.52, cy = H * 0.46;
  for (let y = 0; y < H; y++) {
    const ym = Math.max(0, y - 1) * W, yp = Math.min(H - 1, y + 1) * W, yo = y * W;
    for (let x = 0; x < W; x++) {
      const i = yo + x;
      const xm = Math.max(0, x - 1), xp = Math.min(W - 1, x + 1);
      const sx = (S[yo + xp] - S[yo + xm]) * 0.5 * ns, sy = (S[yp + x] - S[ym + x]) * 0.5 * ns;
      const il = 1 / Math.sqrt(sx * sx + sy * sy + 1);
      const nx = -sx * il, ny = -sy * il, nz = il;
      const d = nx * L[0] + ny * L[1] + nz * L[2];
      let f = 1 + ka * (d - L[2]);
      const dh = nx * Hh[0] + ny * Hh[1] + nz * Hh[2];
      let sp = dh > 0 ? Math.pow(dh, 36) : 0;
      sp *= ksp * smooth(0.04, 0.35, HT[i]);
      let r = CR[i], g = CG[i], b = CB[i];
      // thin-paint dark areas keep the colour; relief mostly modulates value
      r = r * f + sp * (0.7 + 0.3 * r); g = g * f + sp * (0.7 + 0.3 * g); b = b * f + sp * (0.7 + 0.3 * b);
      // subtle vignette
      const vx = (x - cx) / (W * 0.62), vy = (y - cy) / (H * 0.62);
      const vg = 1 - opts.vignette * smooth(0.35, 1.25, Math.sqrt(vx * vx + vy * vy));
      { const vv = 1 - vg; r *= 1 - vv * 1.0; g *= 1 - vv * 1.0; b *= 1 - vv * 0.62; }
      { const lm = 0.3 * r + 0.55 * g + 0.15 * b; const ss = 0.9; r = lm + (r - lm) * ss; g = lm + (g - lm) * ss; b = lm + (b - lm) * ss; }
      { const sc3 = (v) => { v = v < 0 ? 0 : v > 1 ? 1 : v; const t = v * v * (3 - 2 * v); return v + 0.32 * (t - v); }; r = sc3(r); g = sc3(g); b = sc3(b); }
      // dither
      const hsh = ((Math.imul(i, 2654435761) >>> 8) & 255) / 255 - 0.5;
      const o = i * 4;
      out[o] = clamp(r * 255 + hsh, 0, 255);
      out[o + 1] = clamp(g * 255 + hsh, 0, 255);
      out[o + 2] = clamp(b * 255 + hsh, 0, 255);
      out[o + 3] = 255;
    }
  }
  return out;
}
