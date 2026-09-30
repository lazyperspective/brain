/* render.js — camera, z-buffer, cast shadows and the tone buffer that drives the pen.
 * The buffers are only ever *measurements* of the procedural geometry (depth, normal,
 * light); nothing is sampled from any image. */
(function () {
  'use strict';
  const HS = window.HS;
  const { clamp, lerp, smooth, V } = HS;
  const cos = Math.cos, sin = Math.sin, sqrt = Math.sqrt;

  /* --- generic triangle rasteriser with a per-pixel callback --- */
  function rasterTri(w, h, ax, ay, bx, by, cx, cy, fn) {
    const minx = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxx = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx)));
    const miny = Math.max(0, Math.floor(Math.min(ay, by, cy))), maxy = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)));
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-9) return;
    const inv = 1 / area;
    for (let y = miny; y <= maxy; y++) {
      const py = y + 0.5;
      for (let x = minx; x <= maxx; x++) {
        const px = x + 0.5;
        const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) * inv;
        const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) * inv;
        const w2 = 1 - w0 - w1;
        if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
        fn(y * w + x, w0, w1, w2);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  HS.prepareStudy = function (hand, pose, rect) {
    const view = pose.view;
    const mir = pose.side < 0 ? -1 : 1;
    const wf = (pose.wrist && pose.wrist.flex) || 0, wd = (pose.wrist && pose.wrist.dev) || 0;
    const Rm = HS.viewMatrix(view.yaw || 0, view.pitch || 0, view.roll || 0);
    const D = view.dist || 55;
    const pivot = view.pivot || [0, 4, 0];

    const toCam = (x, y, z) => {
      const s = smooth(-3.5, 3, y);
      const a1 = -wf * s, c1 = cos(a1), s1 = sin(a1);
      let y1 = y * c1 - z * s1, z1 = y * s1 + z * c1;
      const a2 = wd * s, c2 = cos(a2), s2 = sin(a2);
      let x1 = x * c2 - y1 * s2; y1 = x * s2 + y1 * c2;
      x1 = x1 * mir - pivot[0]; y1 -= pivot[1]; z1 -= pivot[2];
      return [Rm[0] * x1 + Rm[1] * y1 + Rm[2] * z1, Rm[3] * x1 + Rm[4] * y1 + Rm[5] * z1, Rm[6] * x1 + Rm[7] * y1 + Rm[8] * z1];
    };
    const xfArr = (src) => {
      const out = new Float32Array(src.length);
      for (let i = 0; i < src.length; i += 3) {
        const q = toCam(src[i], src[i + 1], src[i + 2]);
        out[i] = q[0]; out[i + 1] = q[1]; out[i + 2] = q[2];
      }
      return out;
    };

    // bounding box at unit scale
    let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
    for (const s of hand.surfs) {
      s.Q = xfArr(s.P);
      s.QR = xfArr(s.R);
      for (let i = 0; i < s.Q.length; i += 3) {
        const f = D / (D - s.Q[i + 2]);
        const sx = s.Q[i] * f, sy = -s.Q[i + 1] * f;
        if (sx < mnx) mnx = sx; if (sx > mxx) mxx = sx;
        if (sy < mny) mny = sy; if (sy > mxy) mxy = sy;
      }
    }
    const k = Math.min(rect.w / (mxx - mnx), rect.h / (mxy - mny)) * (rect.fit || 1);
    const cxs = rect.x + rect.w / 2 - (k * (mnx + mxx)) / 2;
    const cys = rect.y + rect.h / 2 - (k * (mny + mxy)) / 2;
    const pad = 14;
    const tx0 = Math.floor(cxs + k * mnx) - pad, ty0 = Math.floor(cys + k * mny) - pad;
    const tw = Math.ceil(k * (mxx - mnx)) + pad * 2 + 1, th = Math.ceil(k * (mxy - mny)) + pad * 2 + 1;
    const cam = { k, D, cx: cxs - tx0, cy: cys - ty0, Rm, mir, toCam };

    const project = (Q, i) => {
      const f = D / (D - Q[i + 2]);
      return [cam.cx + k * Q[i] * f, cam.cy - k * Q[i + 1] * f, D - Q[i + 2]];
    };
    cam.project = (q) => { const f = D / (D - q[2]); return [cam.cx + k * q[0] * f, cam.cy - k * q[1] * f, D - q[2]]; };

    // light in camera space
    const lp = pose.light || [-0.6, 0.55, 0.66];
    const L = V.norm(lp);
    const Lr = V.norm([0.75, -0.35, 0.35]);

    for (const s of hand.surfs) {
      const { nu, nv, cyc } = s, n = nu * nv;
      s.Sx = new Float32Array(n); s.Sy = new Float32Array(n); s.Sd = new Float32Array(n);
      s.N = new Float32Array(n * 3); s.F = new Float32Array(n); s.Lam = new Float32Array(n);
      if (!s.att) s.att = new Float32Array(n).fill(1);
      const Q = s.Q;
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const id = i * nv + j, o = id * 3;
        const p = project(Q, o);
        s.Sx[id] = p[0]; s.Sy[id] = p[1]; s.Sd[id] = p[2];
        const i0 = Math.max(0, i - 1), i1 = Math.min(nu - 1, i + 1);
        let j0 = j - 1, j1 = j + 1;
        if (cyc) { if (j0 < 0) j0 = nv - 2; if (j1 > nv - 1) j1 = 1; } else { j0 = Math.max(0, j0); j1 = Math.min(nv - 1, j1); }
        const a = (i0 * nv + j) * 3, b = (i1 * nv + j) * 3, c = (i * nv + j0) * 3, d = (i * nv + j1) * 3;
        const du = [Q[b] - Q[a], Q[b + 1] - Q[a + 1], Q[b + 2] - Q[a + 2]];
        const dv = [Q[d] - Q[c], Q[d + 1] - Q[c + 1], Q[d + 2] - Q[c + 2]];
        let nn = V.cross(du, dv);
        const ref = [Q[o] - s.QR[o], Q[o + 1] - s.QR[o + 1], Q[o + 2] - s.QR[o + 2]];
        let l = V.len(nn);
        if (l < 1e-9) nn = V.norm(ref); else nn = V.mul(nn, 1 / l);
        if (V.dot(nn, ref) < 0) nn = V.mul(nn, -1);
        s.N[o] = nn[0]; s.N[o + 1] = nn[1]; s.N[o + 2] = nn[2];
        const vv = V.norm([-Q[o], -Q[o + 1], D - Q[o + 2]]);
        s.F[id] = V.dot(nn, vv);
        s.Lam[id] = Math.max(0, V.dot(nn, L));
      }
      // metric extents (cm)
      const mi = nu >> 1, mj = nv >> 1;
      let eu = 0, ev = 0;
      for (let i = 1; i < nu; i++) { const a = (i * nv + mj) * 3, b = ((i - 1) * nv + mj) * 3; eu += Math.hypot(Q[a] - Q[b], Q[a + 1] - Q[b + 1], Q[a + 2] - Q[b + 2]); }
      for (let j = 1; j < nv; j++) { const a = (mi * nv + j) * 3, b = (mi * nv + j - 1) * 3; ev += Math.hypot(Q[a] - Q[b], Q[a + 1] - Q[b + 1], Q[a + 2] - Q[b + 2]); }
      s.extU = eu; s.extV = ev;
      if (s.cm === undefined) s.cm = null;
    }
    for (const ln of hand.lines) {
      ln.Q = ln.pts.map((p) => toCam(p[0], p[1], p[2]));
      ln.S = ln.Q.map((q) => cam.project(q));
    }

    const tile = { x0: tx0, y0: ty0, w: tw, h: th, cam, L, Lr, D, k, surfs: hand.surfs, hand };
    rasterize(tile);
    shadeTile(tile, pose);
    return tile;
  };

  /* ---------------- rasterise depth / normal / id ---------------- */
  function rasterize(tile) {
    const { w, h } = tile;
    const n = w * h;
    tile.depth = new Float32Array(n).fill(1e9);
    tile.id = new Uint8Array(n);
    tile.nx = new Float32Array(n); tile.ny = new Float32Array(n); tile.nz = new Float32Array(n);
    tile.fade = new Float32Array(n);
    const { depth, id, nx, ny, nz, fade } = tile;
    for (const s of tile.surfs) {
      const { nu, nv, Sx, Sy, Sd, N, att } = s;
      const sid = s.id;
      for (let i = 0; i < nu - 1; i++) for (let j = 0; j < nv - 1; j++) {
        const v00 = i * nv + j, v10 = (i + 1) * nv + j, v01 = i * nv + j + 1, v11 = (i + 1) * nv + j + 1;
        const tris = [[v00, v10, v11], [v00, v11, v01]];
        for (const t of tris) {
          const a = t[0], b = t[1], c = t[2];
          rasterTri(w, h, Sx[a], Sy[a], Sx[b], Sy[b], Sx[c], Sy[c], (idx, w0, w1, w2) => {
            const d = w0 * Sd[a] + w1 * Sd[b] + w2 * Sd[c];
            if (d < depth[idx]) {
              depth[idx] = d; id[idx] = sid;
              nx[idx] = w0 * N[a * 3] + w1 * N[b * 3] + w2 * N[c * 3];
              ny[idx] = w0 * N[a * 3 + 1] + w1 * N[b * 3 + 1] + w2 * N[c * 3 + 1];
              nz[idx] = w0 * N[a * 3 + 2] + w1 * N[b * 3 + 2] + w2 * N[c * 3 + 2];
              fade[idx] = w0 * att[a] + w1 * att[b] + w2 * att[c];
            }
          });
        }
      }
    }
  }

  /* ---------------- tone: light, cast shadow, cavity ---------------- */
  function boxBlurMasked(src, mask, w, h, r) {
    // separable box blur of (src*mask)/mask
    const A = new Float32Array(w * h), B = new Float32Array(w * h), Am = new Float32Array(w * h), Bm = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      let s = 0, m = 0;
      const row = y * w;
      for (let x = -r; x <= r; x++) if (x >= 0 && x < w) { s += src[row + x] * mask[row + x]; m += mask[row + x]; }
      for (let x = 0; x < w; x++) {
        A[row + x] = s; Am[row + x] = m;
        const xo = x - r, xi = x + r + 1;
        if (xo >= 0) { s -= src[row + xo] * mask[row + xo]; m -= mask[row + xo]; }
        if (xi < w) { s += src[row + xi] * mask[row + xi]; m += mask[row + xi]; }
      }
    }
    for (let x = 0; x < w; x++) {
      let s = 0, m = 0;
      for (let y = -r; y <= r; y++) if (y >= 0 && y < h) { s += A[y * w + x]; m += Am[y * w + x]; }
      for (let y = 0; y < h; y++) {
        B[y * w + x] = s; Bm[y * w + x] = m;
        const yo = y - r, yi = y + r + 1;
        if (yo >= 0) { s -= A[yo * w + x]; m -= Am[yo * w + x]; }
        if (yi < h) { s += A[yi * w + x]; m += Am[yi * w + x]; }
      }
    }
    for (let i = 0; i < w * h; i++) B[i] = Bm[i] > 0 ? B[i] / Bm[i] : 0;
    return B;
  }

  function shadeTile(tile, pose) {
    const { w, h, depth, id, nx, ny, nz, cam, L, Lr, k, D } = tile;
    const n = w * h;
    // ---- shadow map (orthographic along L) ----
    let Lx = V.norm(V.cross([0, 1, 0], L));
    const Ly = V.cross(L, Lx);
    let mnu = 1e9, mxu = -1e9, mnv = 1e9, mxv = -1e9;
    for (const s of tile.surfs) for (let i = 0; i < s.Q.length; i += 3) {
      const q = [s.Q[i], s.Q[i + 1], s.Q[i + 2]];
      const u = V.dot(q, Lx), v = V.dot(q, Ly);
      if (u < mnu) mnu = u; if (u > mxu) mxu = u; if (v < mnv) mnv = v; if (v > mxv) mxv = v;
    }
    const msc = k * 0.9;
    const sw = Math.ceil((mxu - mnu) * msc) + 8, sh = Math.ceil((mxv - mnv) * msc) + 8;
    const smap = new Float32Array(sw * sh).fill(1e9);
    for (const s of tile.surfs) {
      if (s.kind === 'cut') continue;
      const { nu, nv, Q } = s;
      const lx = new Float32Array(nu * nv), ly = new Float32Array(nu * nv), ld = new Float32Array(nu * nv);
      for (let i = 0; i < nu * nv; i++) {
        const q = [Q[i * 3], Q[i * 3 + 1], Q[i * 3 + 2]];
        lx[i] = (V.dot(q, Lx) - mnu) * msc + 4; ly[i] = (V.dot(q, Ly) - mnv) * msc + 4; ld[i] = -V.dot(q, L);
      }
      for (let i = 0; i < nu - 1; i++) for (let j = 0; j < nv - 1; j++) {
        const v00 = i * nv + j, v10 = (i + 1) * nv + j, v01 = i * nv + j + 1, v11 = (i + 1) * nv + j + 1;
        for (const t of [[v00, v10, v11], [v00, v11, v01]]) {
          const a = t[0], b = t[1], c = t[2];
          rasterTri(sw, sh, lx[a], ly[a], lx[b], ly[b], lx[c], ly[c], (idx, w0, w1, w2) => {
            const d = w0 * ld[a] + w1 * ld[b] + w2 * ld[c];
            if (d < smap[idx]) smap[idx] = d;
          });
        }
      }
    }
    // ---- cavity term from the depth buffer ----
    const mask = new Float32Array(n);
    for (let i = 0; i < n; i++) mask[i] = id[i] ? 1 : 0;
    const dep = new Float32Array(n);
    for (let i = 0; i < n; i++) dep[i] = id[i] ? depth[i] : 0;
    const b1 = boxBlurMasked(dep, mask, w, h, Math.max(3, Math.round(k * 0.12)));
    const b2 = boxBlurMasked(dep, mask, w, h, Math.max(6, Math.round(k * 0.35)));
    tile.T = new Float32Array(n);
    tile.LamPx = new Float32Array(n);
    const rnd = HS.rng(77);
    const nz3 = HS.makeNoise(31);
    const mottle = (a, b) => nz3(a, b, 0.5) + 0.5 * nz3(a * 2.3, b * 2.3, 4.1);
    const cx = cam.cx, cy = cam.cy;
    const amb = pose.amb == null ? 0.08 : pose.amb;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!id[i]) continue;
      let ax = nx[i], ay = ny[i], az = nz[i];
      const l = Math.hypot(ax, ay, az) || 1; ax /= l; ay /= l; az /= l;
      if (az < 0) { ax = -ax; ay = -ay; az = -az; }
      const dd = depth[i];
      const X = ((x + 0.5 - cx) * dd) / (k * D), Y = (-(y + 0.5 - cy) * dd) / (k * D), Z = D - dd;
      const ndl = ax * L[0] + ay * L[1] + az * L[2];
      // shadow lookup (5 taps)
      let sh = 0;
      const su = ((X * Lx[0] + Y * Lx[1] + Z * Lx[2]) - mnu) * msc + 4;
      const sv = ((X * Ly[0] + Y * Ly[1] + Z * Ly[2]) - mnv) * msc + 4;
      const sd = -(X * L[0] + Y * L[1] + Z * L[2]);
      const bias = 0.05 + 0.22 * (1 - Math.max(0, ndl));
      for (let t = 0; t < 5; t++) {
        const ox = t === 0 ? 0 : (rnd() - 0.5) * 3.2, oy = t === 0 ? 0 : (rnd() - 0.5) * 3.2;
        const xi = Math.round(su + ox), yi = Math.round(sv + oy);
        if (xi < 0 || yi < 0 || xi >= sw || yi >= sh) continue;
        if (smap[yi * sw + xi] < sd - bias) sh += 0.2;
      }
      const lam = clamp((ndl + 0.12) / 1.12, 0, 1);
      const refl = Math.pow(Math.max(0, ax * Lr[0] + ay * Lr[1] + az * Lr[2]), 1.4) * 0.2;
      // cavity (deeper than surroundings)
      const cav = clamp(((dd - b1[i]) * 1.0 + (dd - b2[i]) * 0.5) / 1.1, 0, 1);
      let Il = amb + (1 - amb) * Math.pow(lam, 1.15) * (1 - 0.9 * sh) + refl * (1 - lam * 0.7);
      Il = clamp(Il, 0, 1);
      let tone = clamp((1 - Il - 0.1) / 0.88, 0, 1);
      tone = Math.pow(tone, 0.92);
      tone = tone + cav * 0.6 * (1 - tone * 0.5);
      tone = clamp(tone + 0.07 * mottle(x * 0.018, y * 0.018), 0, 1) * (tile.fade[i]);
      tile.T[i] = tone;
      tile.LamPx[i] = lam;
    }
  }

  HS.debugShade = function (tile, ctx, ox, oy) {
    const img = ctx.createImageData(tile.w, tile.h);
    for (let i = 0; i < tile.w * tile.h; i++) {
      const v = tile.id[i] ? Math.round(255 * (1 - tile.T[i] * 0.95)) : 240;
      img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, tile.x0, tile.y0);
  };
})();
