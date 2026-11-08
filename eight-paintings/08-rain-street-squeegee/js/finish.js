// finish.js — the painting as an object: raking light over the paint height field (diffuse + varnish/oil
// specular on ridges + cavity occlusion), returned as linear reflectance image.
(function () {
  'use strict';
  const CL = P8.clamp;
  P8.finish = function (pt, W, H, seed, opt) {
    opt = opt || {};
    const S = W / 2160, n = W * H, Hh = pt.Hh, C = pt.C;
    const out = P8.img(W, H);
    const k = (opt.k || 1.2) * S; // height -> slope scale (heights are authored in 2160-px units)
    const az = -2.25, el = 0.52; // light from upper left, low (raking)
    const Lx = Math.cos(el) * Math.cos(az), Ly = Math.cos(el) * Math.sin(az), Lz = Math.sin(el);
    let hx = Lx, hy = Ly, hz = Lz + 1; const hl = Math.hypot(hx, hy, hz); hx /= hl; hy /= hl; hz /= hl;
    const shin = 38, spec0 = Math.pow(hz, shin);
    const HL = new Float32Array(n);
    const fr = new Float32Array(n);
    if (pt.fresh) { for (let i = 0; i < n; i++) fr[i] = Math.min(4, pt.fresh[i]); P8.blur(fr, W, H, 3 * S, 2.2 * S); }
    for (let i = 0; i < n; i++) HL[i] = Hh[i] + 1.1 * fr[i];
    const blurH = HL.slice(); P8.blur(blurH, W, H, 3 * S, 3 * S);
    const gloss = pt.gloss || null;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const xl = x > 0 ? i - 1 : i, xr = x < W - 1 ? i + 1 : i, yu = y > 0 ? i - W : i, yd = y < H - 1 ? i + W : i;
        const gx = (HL[xr] - HL[xl]) * 0.5 * k, gy = (HL[yd] - HL[yu]) * 0.5 * k;
        const nl = Math.sqrt(gx * gx + gy * gy + 1);
        const nx = -gx / nl, ny = -gy / nl, nz = 1 / nl;
        const ndl = nx * Lx + ny * Ly + nz * Lz;
        const diff = 1 + 0.6 * (Math.max(0, ndl) / Lz - 1);
        const ndh = Math.max(0, nx * hx + ny * hy + nz * hz);
        const g = gloss ? gloss[i] : 0.5;
        const sp = Math.max(0, Math.pow(ndh, shin) - spec0) * (0.035 + 0.1 * g * g);
        const cav = CL((HL[i] - blurH[i]) * 0.3, -0.2, 0.08);
        const ao = 1 + cav;
        out.r[i] = C.r[i] * diff * ao + sp; out.g[i] = C.g[i] * diff * ao + sp * 0.98; out.b[i] = C.b[i] * diff * ao + sp * 0.95;
      }
    }
    return out;
  };
})();
