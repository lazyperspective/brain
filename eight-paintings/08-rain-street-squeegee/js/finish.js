// finish.js — the painting as an object: raking light over the paint height field (diffuse + varnish/oil
// specular on ridges + cavity occlusion), returned as linear reflectance image.
(function () {
  'use strict';
  const CL = P8.clamp;
  P8.finish = function (pt, W, H, seed, opt) {
    opt = opt || {};
    const S = W / 2160, n = W * H, Hh = pt.Hh, C = pt.C;
    const out = P8.img(W, H);
    const k = (opt.k || 0.11) * S; // height -> slope scale (heights are authored in 2160-px units)
    const az = -2.25, el = 0.52; // light from upper left, low (raking)
    const Lx = Math.cos(el) * Math.cos(az), Ly = Math.cos(el) * Math.sin(az), Lz = Math.sin(el);
    let hx = Lx, hy = Ly, hz = Lz + 1; const hl = Math.hypot(hx, hy, hz); hx /= hl; hy /= hl; hz /= hl;
    const shin = 38, spec0 = Math.pow(hz, shin);
    const blurH = Hh.slice(); P8.blur(blurH, W, H, 3 * S, 3 * S);
    const gloss = pt.gloss || null;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const xl = x > 0 ? i - 1 : i, xr = x < W - 1 ? i + 1 : i, yu = y > 0 ? i - W : i, yd = y < H - 1 ? i + W : i;
        const gx = (Hh[xr] - Hh[xl]) * 0.5 * k, gy = (Hh[yd] - Hh[yu]) * 0.5 * k;
        const nl = Math.sqrt(gx * gx + gy * gy + 1);
        const nx = -gx / nl, ny = -gy / nl, nz = 1 / nl;
        const ndl = nx * Lx + ny * Ly + nz * Lz;
        const diff = 1 + 0.6 * (Math.max(0, ndl) / Lz - 1);
        const ndh = Math.max(0, nx * hx + ny * hy + nz * hz);
        const g = gloss ? gloss[i] : 0.5;
        const sp = Math.max(0, Math.pow(ndh, shin) - spec0) * (0.05 + 0.1 * g);
        const cav = CL((Hh[i] - blurH[i]) * 0.35, -0.25, 0.08);
        const ao = 1 + cav;
        out.r[i] = C.r[i] * diff * ao + sp; out.g[i] = C.g[i] * diff * ao + sp * 0.98; out.b[i] = C.b[i] * diff * ao + sp * 0.95;
      }
    }
    return out;
  };
})();
