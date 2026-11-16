// world.js -- "The Afternoon Underneath". Where things stand, what colour the two skies are, the shape
// of the great cloud that is in both of them, and how the water bends what it keeps.
// Design space is 1600 x 900 units. We stand at a child's eye height, 1.25 m, ankle-deep.
(function (G) {
  'use strict';
  const A = G.ART, hx = A.hex, vn = A.vn, fbm = A.fbm, ss = A.sstep, clamp = A.clamp;
  const S = A.S, Wd = (A.Wd = {});

  // ------------------------------------------------------------------ the camera
  const YH = 432, F = 1500, EYE = 1.25, VX = 800;
  Wd.YH = YH; Wd.F = F; Wd.EYE = EYE; Wd.VX = VX;
  Wd.pr = (X, Y, Z) => [VX + F * X / Z, YH - F * (Y - EYE) / Z];
  Wd.SUNSET = [470, 452];          // where the day went down
  Wd.MOON = [318, 128];            // tonight: a thin moon.  Underneath, in the same place: the sun.
  Wd.LAMP = { X: 3.75, Z: 20.5, H: 4.25, head: 3.82, arm: 0.62 };
  Wd.SWING = { X: 0.15, Z: 13.6, yaw: 0.86, len: 3.2, H: 2.45, spread: 1.0 };

  // ------------------------------------------------------------------ colours
  const c = (Wd.c = {
    paper: hx('#fbf6ea'), white: hx('#fffdf4'), cream: hx('#fff3cf'), lemon: hx('#ffe9a0'), butter: hx('#ffd978'), gold: hx('#ffc24a'),
    peach: hx('#ffc49a'), apricot: hx('#ffa97c'), coral: hx('#ff8672'), salmon: hx('#f76f82'), hot: hx('#ee4f8c'), rose: hx('#f58fb0'), blush: hx('#fbc3cf'),
    magenta: hx('#c23f95'), orchid: hx('#9a45a8'), purple: hx('#6a3a9c'), violet: hx('#4a3290'), lav: hx('#a99be6'), lilac: hx('#cfc4f4'),
    indigo: hx('#23246e'), night: hx('#151a52'), ink: hx('#0e1238'), navy: hx('#1b2f7c'),
    cobalt: hx('#1f55c8'), azure: hx('#2f8be6'), cerul: hx('#55b4ee'), aqua: hx('#8fdcec'), mint: hx('#c8f0df'), haze: hx('#f4f4d6'),
    teal: hx('#1c8f9c'), dteal: hx('#14586e'), jade: hx('#3fc0a8'), seafoam: hx('#9be6cc'),
    shadeA: hx('#b8b6ee'), shadeB: hx('#8fa4e6'), shadeC: hx('#6a86d2'), shadeD: hx('#4d68b8'),
    red: hx('#f0445e'), cherry: hx('#d82a4c'), yellow: hx('#ffd43a'), grass: hx('#5fb86a'), leaf: hx('#2f8a5a'), dleaf: hx('#17523f'),
    rust: hx('#a8503a'), umber: hx('#5a3040'), graphite: hx('#4a4a5c'), firefly: hx('#e6ff8a'),
  });

  // tonight's sky, top (t = 0) to horizon (t = 1)
  const duskRamp = A.ramp([[-0.1, hx('#101548')], [0.08, hx('#171d5e')], [0.26, hx('#2c2a80')], [0.42, hx('#553597')], [0.56, hx('#8f3d9c')], [0.68, hx('#cf4b90')], [0.79, hx('#f3667c')], [0.88, hx('#ff9370')], [0.95, hx('#ffbd7e')], [1.0, hx('#ffdc96')], [1.05, hx('#ffe6a6')]]);
  // that afternoon's sky
  const dayRamp = A.ramp([[-0.12, hx('#1a3aa6')], [0.10, hx('#1d55cc')], [0.34, hx('#2a80e4')], [0.56, hx('#4aaaee')], [0.74, hx('#84d4ee')], [0.88, hx('#bfeee0')], [0.97, hx('#eef5d4')], [1.04, hx('#fbf3cc')]]);
  Wd.duskRamp = duskRamp; Wd.dayRamp = dayRamp;
  // colour of tonight's sky at a point of the sheet (y above the horizon)
  Wd.dusk = function (x, y, out) {
    let t = y / YH;
    const dxs = Math.abs(x - Wd.SUNSET[0]);
    t -= 0.17 * ss(260, 1250, dxs) * (0.35 + 0.65 * t);            // away from where the sun went, the warm band thins
    t += 0.035 * Math.exp(-dxs * dxs / 90000) * ss(0.5, 1, t);
    return duskRamp(t, out);
  };
  // colour of that afternoon's sky, asked for by where in the sky (sky coordinates, y above the horizon)
  Wd.day = function (x, y, out) {
    let t = y / YH;
    out = dayRamp(t, out);
    const dx = x - Wd.MOON[0], dy = y - Wd.MOON[1], d = Math.sqrt(dx * dx + dy * dy);
    let g = Math.exp(-d / 62) * 0.62 + Math.exp(-d / 300) * 0.2; if (d < 26) g += (1 - g) * ss(26, 18, d);               // the sun whitens the sky round it
    out[0] += (1.0 - out[0]) * g; out[1] += (0.985 - out[1]) * g; out[2] += (0.86 - out[2]) * g * 0.9;
    return out;
  };

  // ------------------------------------------------------------------ the water
  // how much of the afternoon the water is holding at this point of the sheet (0 = only tonight)
  Wd.memAt = function (x, y) {
    if (y <= YH + 5) return 0;
    const v = y - YH, u = Math.abs(x - 800) / 800, w = Math.abs(y - 716) / 264;
    const d = Math.pow(Math.pow(u, 3.2) + Math.pow(w, 3.2), 0.3125);
    if (d < 0.6) return 1; if (d > 1.3) return 0;
    const q = 40 * Math.log(v + 6);
    const st = (vn(x / (36 + 0.45 * v), q * 0.5, 311) - 0.5) * 0.34 + (vn(x / 240, y / 34, 312) - 0.5) * 0.14 + (vn(x / (14 + 0.2 * v), q * 1.3, 313) - 0.5) * 0.10;
    return 1 - ss(0.89, 0.985, d + st);
  };
  Wd.memGrid = function (C) {
    if (C.M) return C.M;
    const W = C.W, H = C.H, k = C.k, M = (C.M = new Float32Array(W * H));
    const y0 = Math.floor(YH * k);
    for (let y = y0; y < H; y++) { const uy = (y + 0.5) / k; for (let x = 0; x < W; x++) M[y * W + x] = Wd.memAt((x + 0.5) / k, uy); }
    return M;
  };
  Wd.mem = function (C, ux, uy) { const x = clamp((ux * C.k) | 0, 0, C.W - 1), y = clamp((uy * C.k) | 0, 0, C.H - 1); return C.M[y * C.W + x]; };
  // ripples: the water's surface is small tilted mirrors. out[0] = sideways slip of the reflection,
  // out[1] = how far up or down the sky it looks instead (as a fraction of the depth), out[2] = the ripple itself (-.5 .. .5)
  Wd.rip = function (x, y, out) {
    const v = y - YH; if (v < 0) { out[0] = out[1] = out[2] = 0; return out; }
    const q = 40 * Math.log(v + 6), nx = x / (22 + 0.42 * v);
    const a = vn(nx, q * 0.36, 401) - 0.5, b = vn(nx * 2.3 + 9, q * 0.9, 402) - 0.5, e = vn(x / 330, y / 60, 403) - 0.5;
    const calm = 0.55 + 0.9 * (vn(x / 420 + 3, y / 90, 404));   // some reaches of the water are stiller than others
    out[2] = (a * 0.7 + b * 0.3) * calm;
    out[0] = (a * 0.8 + b * 0.5 + e * 0.5) * (0.5 + v * 0.011) * calm;
    out[1] = (a * 0.055 + b * 0.02) * calm;
    return out;
  };
  // where a reflected point lands once the water has bent it
  const rp = [0, 0, 0];
  Wd.bend = function (x, y) { Wd.rip(x, y, rp); return [x + rp[0], y + rp[2] * Math.min(3, (y - YH) * 0.012)]; };

  // ------------------------------------------------------------------ clouds, built from puffs
  // A cloud is a heap of spheres, some nearer to us than others. The field keeps, for every point: how far
  // inside the heap's outline it is, how high the heap stands toward us there, and which way its surface
  // faces -- once for all the puffs, once for the few big ones (the bulk of the form).
  // a puff: [x, y, r, big?, z]
  function Field(puffs, x0, y0, x1, y1, sc) {
    this.x0 = x0; this.y0 = y0; this.sc = sc; this.w = Math.ceil((x1 - x0) * sc) + 1; this.h = Math.ceil((y1 - y0) * sc) + 1;
    const w = this.w, h = this.h, n = w * h, FLOOR = -30;
    const V = new Float32Array(n).fill(-9), Z = new Float32Array(n).fill(FLOOR), ZB = new Float32Array(n).fill(FLOOR);
    for (const p of puffs) {
      const r = p[2], R = r + 8, z = p[4] || 0, gx0 = Math.max(0, Math.floor((p[0] - R - x0) * sc)), gx1 = Math.min(w - 1, Math.ceil((p[0] + R - x0) * sc)), gy0 = Math.max(0, Math.floor((p[1] - R - y0) * sc)), gy1 = Math.min(h - 1, Math.ceil((p[1] + R - y0) * sc));
      for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
        const dx = gx / sc + x0 - p[0], dy = gy / sc + y0 - p[1], d2 = dx * dx + dy * dy; if (d2 > R * R) continue;
        const i = gy * w + gx, v = r - Math.sqrt(d2); if (v > V[i]) V[i] = v;
        if (d2 < r * r) { const hh = z + Math.sqrt(r * r - d2); if (hh > Z[i]) Z[i] = hh; if (p[3] && hh > ZB[i]) ZB[i] = hh; }
      }
    }
    const blur = (src) => { const o = new Float32Array(n); for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; o[i] = (src[i] * 4 + (src[i - 1] + src[i + 1] + src[i - w] + src[i + w]) * 2 + src[i - w - 1] + src[i - w + 1] + src[i + w - 1] + src[i + w + 1]) / 16; } return o; };
    const Zs = blur(Z), Zb = blur(blur(ZB));
    const D = (this.D = new Float32Array(n * 8));
    const nrm = (A, i, j) => { let gx = (A[i + 1] - A[i - 1]) * sc * 0.5, gy = (A[i + w] - A[i - w]) * sc * 0.5; const g = Math.hypot(gx, gy); if (g > 3.2) { gx *= 3.2 / g; gy *= 3.2 / g; } const l = Math.sqrt(gx * gx + gy * gy + 1); D[j] = -gx / l; D[j + 1] = -gy / l; D[j + 2] = 1 / l; };
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x, j = i * 8; D[j] = V[i]; nrm(Zs, i, j + 1); D[j + 4] = Z[i]; nrm(Zb, i, j + 5); }
  }
  // out: [v, nx, ny, nz, z, bx, by, bz]
  Field.prototype.at = function (x, y, out) {
    const gx = (x - this.x0) * this.sc, gy = (y - this.y0) * this.sc, w = this.w;
    if (gx < 1 || gy < 1 || gx >= w - 2 || gy >= this.h - 2) { out[0] = -9; out[4] = -30; return out; }
    const ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy, D = this.D, a = (iy * w + ix) * 8, b = a + 8, cc = a + w * 8, d = cc + 8;
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
    for (let q = 0; q < 8; q++) out[q] = D[a + q] * w00 + D[b + q] * w10 + D[cc + q] * w01 + D[d + q] * w11;
    return out;
  };

  // majors: [x, y, r]; zf(y) puts the lower lobes nearer to us
  function heap(R, majors, lo, hi, depth, face, zf) {
    const out = [];
    zf = zf || (() => 0);
    for (const m of majors) out.push([m[0], m[1], m[2], 1, zf(m[1])]);
    const grow = (px, py, pr, pz, lvl) => {
      const n = lvl === 0 ? R.i(lo, hi) : R.i(3, 5);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI * R.r(-0.16, 1.16), rr = pr * (lvl === 0 ? R.r(0.22, 0.48) : R.r(0.3, 0.52)), dd = pr * R.r(0.68, 0.95);
        const x = px + Math.cos(a) * dd, y = py + Math.sin(a) * dd * 0.92, z = pz + pr * R.r(-0.25, 0.3);
        out.push([x, y, rr, 0, z]);
        if (lvl < depth && rr > 4) grow(x, y, rr, z, lvl + 1);
      }
    };
    for (const m of majors) grow(m[0], m[1], m[2], zf(m[1]), 0);
    // and bulges on the face of the heap, toward us
    if (face) for (const m of majors) {
      const n = Math.round(m[2] / 7 * face);
      for (let i = 0; i < n; i++) { const a = R() * 6.283, d = m[2] * Math.sqrt(R()) * 0.82, rr = m[2] * R.r(0.18, 0.44); out.push([m[0] + Math.cos(a) * d, m[1] + Math.sin(a) * d * 0.9, rr, 0, zf(m[1]) + 0.85 * Math.sqrt(Math.max(0, m[2] * m[2] - d * d)) - rr * R.r(0.25, 0.55)]); }
    }
    return out;
  }
  Wd.build = function () {
    if (Wd.CB) return;
    const R = A.rng(90817);
    // the great cloud: a summer thunderhead standing on the horizon to the right
    const big = [
      [900, 372, 44], [985, 352, 58], [1075, 326, 74], [1180, 306, 92], [1300, 300, 104], [1425, 304, 100], [1545, 316, 92], [1640, 330, 80],
      [1120, 236, 70], [1215, 212, 88], [1330, 196, 100], [1450, 208, 92], [1560, 232, 84],
      [1262, 132, 66], [1352, 104, 80], [1452, 122, 70], [1532, 152, 60],
      [1318, 52, 46], [1396, 34, 50], [1462, 62, 40],
      [840, 392, 26], [1010, 262, 34], [1168, 150, 34],
    ].map(p => [p[0], 400 - (400 - p[1]) * 0.9, p[2]]);
    const zf = y => (y - 200) * 0.22;
    let puffs = heap(R, big, 9, 13, 1, 1, zf);
    // base shelf
    for (let x = 830; x < 1680; x += R.r(22, 40)) puffs.push([x, 388 + R.r(-8, 6), R.r(20, 36), 0, zf(390) + R.r(10, 40)]);
    // far cumulus, two low banks of them along the horizon, small with distance
    const far = [[26, 392, 30], [70, 384, 36], [118, 379, 40], [165, 388, 32], [205, 396, 24], [244, 403, 18], [276, 409, 12],
      [578, 409, 12], [610, 399, 22], [654, 390, 30], [700, 394, 26], [740, 402, 18], [772, 409, 11]];
    puffs = puffs.concat(heap(R, far, 5, 7, 1, 0.8));
    Wd.CB = new Field(puffs, -80, -90, 1700, 450, 2); Wd.CB.puffs = puffs; Wd.CB.puffsBig = big;
    Wd.CBbase = x => 407 + 5 * (vn(x / 70, 3.1, 55) - 0.5) + 9 * ss(830, 800, x);     // the flat underside
    // fair-weather clouds that were only in the afternoon
    const fw = [];
    for (const g of [[120, 250, 30], [168, 262, 38], [226, 254, 28], [520, 300, 24], [566, 292, 32], [614, 302, 22], [708, 178, 28], [752, 168, 36], [806, 176, 26], [470, 92, 30], [520, 84, 38], [574, 94, 26], [60, 120, 40], [128, 110, 34], [920, 60, 30], [968, 52, 36], [760, 350, 14], [792, 346, 18], [380, 350, 16], [412, 346, 12]]) fw.push(g);
    const fp = heap(R, fw, 6, 9, 1, 1);
    for (const g of fw) for (let i = -1; i <= 1; i++) fp.push([g[0] + i * g[2] * 0.9, g[1] + g[2] * 0.5, g[2] * 0.62, 0, -g[2] * 0.3]);
    Wd.FW = new Field(fp, -80, -90, 1700, 450, 2); Wd.FW.puffs = fp;
  };
  const t8 = new Float32Array(8);
  // the great cloud at a point of the sky: returns how far inside its outline (sheet units; <= 0 outside)
  // and leaves the surface direction in o[1..3] (all puffs) and o[5..7] (the bulk), its height toward us in o[4]
  Wd.cloud = function (x, y, o) {
    o = o || t8; Wd.CB.at(x, y, o);
    let v = o[0] + 2.4 * (vn(x / 7, y / 7, 71) - 0.5) + 1.0 * (vn(x / 2.2, y / 2.2, 72) - 0.5);
    const cut = (Wd.CBbase(x) - y) * 1.3; if (cut < v) v = cut;
    o[0] = v; return v;
  };
  Wd.fair = function (x, y, o) {
    o = o || t8; Wd.FW.at(x, y, o);
    const v = o[0] + 2.2 * (vn(x / 6, y / 6, 73) - 0.5) + 0.9 * (vn(x / 2.2, y / 2.2, 74) - 0.5);
    o[0] = v; return v;
  };
  A.Field = Field;
})(typeof self !== 'undefined' ? self : globalThis);
