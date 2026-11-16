// world.js -- "She Said They Were Stars".
// Where we stand: a child's eye height, close in under a big old umbrella that somebody else is holding,
// looking up and ahead into the rain. The umbrella is a real one, built in three dimensions and seen in
// perspective -- eight steel ribs, eight stretchers, a runner, a shaft that leaves the sheet towards the hand
// that holds it. Everything is in the design space of the sheet: 1600 x 900 units.
(function (G) {
  'use strict';
  const A = G.ART, hx = A.hex, vn = A.vn, fbm = A.fbm, ss = A.sstep, clamp = A.clamp, mix = A.mix;
  const Wd = (A.Wd = {});
  A.S = A.S || {};
  const D = Math.PI / 180;

  // ------------------------------------------------------------------ the camera
  const CAM = Object.assign({ p: [0.0, 0.0, 1.36], pitch: 38 * D, yaw: -3 * D, roll: -5 * D, F: 900, cx: 800, cy: 450 }, G.CAMX || {});
  (function () {
    const cp = Math.cos(CAM.pitch), sp = Math.sin(CAM.pitch), cy = Math.cos(CAM.yaw), sy = Math.sin(CAM.yaw);
    const f = [sy * cp, cy * cp, sp];
    let r = [f[1], -f[0], 0]; const rl = Math.hypot(r[0], r[1]); r = [r[0] / rl, r[1] / rl, 0];
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const cr = Math.cos(CAM.roll), sr = Math.sin(CAM.roll);
    CAM.f = f; CAM.r = [r[0] * cr + u[0] * sr, r[1] * cr + u[1] * sr, r[2] * cr + u[2] * sr]; CAM.u = [-r[0] * sr + u[0] * cr, -r[1] * sr + u[1] * cr, -r[2] * sr + u[2] * cr];
  })();
  Wd.CAM = CAM;
  // a point of the world -> the sheet.  [x, y, depth]
  Wd.pr = function (P) {
    const x = P[0] - CAM.p[0], y = P[1] - CAM.p[1], z = P[2] - CAM.p[2];
    const dz = x * CAM.f[0] + y * CAM.f[1] + z * CAM.f[2], dx = x * CAM.r[0] + y * CAM.r[1] + z * CAM.r[2], dy = x * CAM.u[0] + y * CAM.u[1] + z * CAM.u[2];
    const q = CAM.F / (dz < 0.02 ? 0.02 : dz);
    return [CAM.cx + dx * q, CAM.cy - dy * q, dz];
  };
  // a direction of the world -> where on the sheet it vanishes
  Wd.vanish = function (d) { const dz = d[0] * CAM.f[0] + d[1] * CAM.f[1] + d[2] * CAM.f[2], dx = d[0] * CAM.r[0] + d[1] * CAM.r[1] + d[2] * CAM.r[2], dy = d[0] * CAM.u[0] + d[1] * CAM.u[1] + d[2] * CAM.u[2]; return [CAM.cx + CAM.F * dx / dz, CAM.cy - CAM.F * dy / dz, dz]; };

  // ------------------------------------------------------------------ the umbrella
  const N = 8;
  const UM = Object.assign({ apex: [-0.205, 0.505, 1.97], lean: [-0.16, -0.10, -1], R: 0.63, depth: 0.25, shaft: 0.92, runner: 0.265, joint: 0.47, phi0: 0.36, scallop: 0.085 }, G.UMX || {});
  (function () {
    const l = UM.lean, n = Math.hypot(l[0], l[1], l[2]); const a = UM.a = [l[0] / n, l[1] / n, l[2] / n];
    // two directions across the axis
    let e1 = [1, 0, 0]; const d = e1[0] * a[0] + e1[1] * a[1] + e1[2] * a[2]; e1 = [e1[0] - a[0] * d, e1[1] - a[1] * d, e1[2] - a[2] * d]; const n1 = Math.hypot(e1[0], e1[1], e1[2]); e1 = [e1[0] / n1, e1[1] / n1, e1[2] / n1];
    UM.e1 = e1; UM.e2 = [a[1] * e1[2] - a[2] * e1[1], a[2] * e1[0] - a[0] * e1[2], a[0] * e1[1] - a[1] * e1[0]];
    UM.alpha = 2 * Math.atan(UM.depth / UM.R); UM.Ra = UM.R / Math.sin(UM.alpha);
  })();
  Wd.N = N; Wd.UM = UM;
  // an old umbrella is not true: every rib has its own small error, and one has been bent and bound up again
  const ribErr = []; { const R = A.rng(808); for (let g = 0; g < N; g++) ribErr.push({ dphi: (R() - 0.5) * 0.035, droop: (R() - 0.5) * 0.012, len: 1 + (R() - 0.5) * 0.012 }); }
  Wd.BENT = 7; ribErr[Wd.BENT].kink = 0.66; ribErr[Wd.BENT].droop = 0.03;
  // a point of rib g, s = 0 at the crown, 1 at the tip (a little beyond 1 is the bare tip past the cloth)
  function rib(g, s, out) {
    g = ((g % N) + N) % N; const e = ribErr[g], t = s * UM.alpha * e.len, phi = UM.phi0 + g * 2 * Math.PI / N + e.dphi;
    let r = UM.Ra * Math.sin(t), d = UM.Ra * (1 - Math.cos(t)) + e.droop * s * s + 0.012;
    if (e.kink && s > e.kink) { const q = s - e.kink; d += q * 0.11; r -= q * 0.02; }
    const c = Math.cos(phi) * r, sn = Math.sin(phi) * r; out = out || [0, 0, 0];
    out[0] = UM.apex[0] + UM.a[0] * d + UM.e1[0] * c + UM.e2[0] * sn; out[1] = UM.apex[1] + UM.a[1] * d + UM.e1[1] * c + UM.e2[1] * sn; out[2] = UM.apex[2] + UM.a[2] * d + UM.e1[2] * c + UM.e2[2] * sn;
    return out;
  }
  Wd.rib = rib;
  // the hem between two tips is cut hollow
  Wd.smax = function (th) { const u = th - Math.floor(th); return 1 - UM.scallop * Math.pow(Math.sin(Math.PI * u), 0.85); };
  // a point of the cloth: th = gore number + how far across the gore (0..N), s = how far down from the crown
  const _a = [0, 0, 0], _b = [0, 0, 0];
  function cloth(th, s, out) {
    const g = Math.floor(th), u = th - g; rib(g, s, _a); rib(g + 1, s, _b); out = out || [0, 0, 0];
    // pulled tight between the ribs, with the least belly inward
    const bel = 1 - 0.035 * Math.sin(Math.PI * u) * s;
    out[0] = UM.apex[0] + ((_a[0] + (_b[0] - _a[0]) * u) - UM.apex[0]) * bel; out[1] = UM.apex[1] + ((_a[1] + (_b[1] - _a[1]) * u) - UM.apex[1]) * bel; out[2] = UM.apex[2] + ((_a[2] + (_b[2] - _a[2]) * u) - UM.apex[2]) * bel;
    return out;
  }
  Wd.cloth = cloth;
  const _c = [0, 0, 0];
  Wd.cp = function (th, s) { return Wd.pr(cloth(th, s, _c)); };       // cloth -> sheet
  Wd.rp = function (g, s) { return Wd.pr(rib(g, s, _c)); };           // rib -> sheet
  Wd.axis = function (d, out) { out = out || [0, 0, 0]; out[0] = UM.apex[0] + UM.a[0] * d; out[1] = UM.apex[1] + UM.a[1] * d; out[2] = UM.apex[2] + UM.a[2] * d; return out; };
  Wd.ap = function (d) { return Wd.pr(Wd.axis(d, _c)); };            // a point of the shaft -> sheet
  // which way the cloth faces (towards us, into the bowl)
  const _p = [0, 0, 0], _q = [0, 0, 0], _r = [0, 0, 0];
  Wd.normal = function (th, s, out) {
    const g = Math.floor(th), u = clamp(th - g, 0.02, 0.98), tt = g + u, sv = clamp(s, 0.03, 1);
    cloth(tt, sv, _p); cloth(tt + 0.01, sv, _q); cloth(tt, sv + 0.01, _r);
    const ax = _q[0] - _p[0], ay = _q[1] - _p[1], az = _q[2] - _p[2], bx = _r[0] - _p[0], by = _r[1] - _p[1], bz = _r[2] - _p[2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const n = Math.hypot(nx, ny, nz) || 1; nx /= n; ny /= n; nz /= n;
    // make it the side that looks down the shaft
    if (nx * UM.a[0] + ny * UM.a[1] + nz * UM.a[2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
    out = out || [0, 0, 0]; out[0] = nx; out[1] = ny; out[2] = nz; return out;
  };

  // ------------------------------------------------------------------ the map: for every point of the sheet, which point of the cloth
  // G.th, G.s at design resolution (s runs on past the hem so the edge can be found exactly); 9 = no cloth there
  const GW = 1600, GH = 900, SEXT = 1.16;
  Wd.build = function () {
    if (Wd.G) return;
    const TH = new Float32Array(GW * GH).fill(-1), SS = new Float32Array(GW * GH).fill(9);
    const nu = 40, ns = 120, P = [];
    for (let g = 0; g < N; g++) {
      for (let j = 0; j <= ns; j++) for (let i = 0; i <= nu; i++) { const th = g + i / nu, s = SEXT * Math.pow(j / ns, 1.25); const p = Wd.cp(th === N ? N - 1e-6 : th, s); P[(j * (nu + 1) + i) * 2] = p[0]; P[(j * (nu + 1) + i) * 2 + 1] = p[1]; }
      const tri = (i0, j0, i1, j1, i2, j2) => {
        const x0 = P[(j0 * (nu + 1) + i0) * 2], y0 = P[(j0 * (nu + 1) + i0) * 2 + 1], x1 = P[(j1 * (nu + 1) + i1) * 2], y1 = P[(j1 * (nu + 1) + i1) * 2 + 1], x2 = P[(j2 * (nu + 1) + i2) * 2], y2 = P[(j2 * (nu + 1) + i2) * 2 + 1];
        const den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2); if (Math.abs(den) < 1e-9) return;
        const xa = Math.max(0, Math.floor(Math.min(x0, x1, x2))), xb = Math.min(GW - 1, Math.ceil(Math.max(x0, x1, x2))), ya = Math.max(0, Math.floor(Math.min(y0, y1, y2))), yb = Math.min(GH - 1, Math.ceil(Math.max(y0, y1, y2)));
        const t0 = g + i0 / nu, t1 = g + i1 / nu, t2 = g + i2 / nu, s0 = SEXT * Math.pow(j0 / ns, 1.25), s1 = SEXT * Math.pow(j1 / ns, 1.25), s2 = SEXT * Math.pow(j2 / ns, 1.25);
        for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
          const px = x + 0.5, py = y + 0.5, w0 = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / den, w1 = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / den, w2 = 1 - w0 - w1;
          if (w0 < -0.002 || w1 < -0.002 || w2 < -0.002) continue;
          const k = y * GW + x, s = w0 * s0 + w1 * s1 + w2 * s2; if (s < SS[k]) { SS[k] = s; TH[k] = w0 * t0 + w1 * t1 + w2 * t2; }
        }
      };
      for (let j = 0; j < ns; j++) for (let i = 0; i < nu; i++) { tri(i, j, i + 1, j, i, j + 1); tri(i + 1, j, i + 1, j + 1, i, j + 1); }
    }
    Wd.G = { th: TH, s: SS };
  };
  // look the cloth up under a point of the sheet. out[0] = th, out[1] = s, out[2] = how far inside the hem (in s). returns true if there is cloth
  Wd.at = function (x, y, out) {
    const Gd = Wd.G; let fx = x - 0.5, fy = y - 0.5; if (fx < 0) fx = 0; if (fy < 0) fy = 0; if (fx > GW - 1.001) fx = GW - 1.001; if (fy > GH - 1.001) fy = GH - 1.001;
    const xi = fx | 0, yi = fy | 0, k = yi * GW + xi; fx -= xi; fy -= yi;
    const s00 = Gd.s[k], s10 = Gd.s[k + 1], s01 = Gd.s[k + GW], s11 = Gd.s[k + GW + 1];
    if (s00 > 8 || s10 > 8 || s01 > 8 || s11 > 8) { // at the border of the map: take the nearest that has an answer
      const kk = (fx < 0.5 ? 0 : 1) + (fy < 0.5 ? 0 : GW), sv = Gd.s[k + kk]; out[0] = Gd.th[k + kk]; out[1] = sv; out[2] = sv > 8 ? -1 : Wd.smax(out[0]) - sv; return sv < 8 && out[2] >= 0;
    }
    const t00 = Gd.th[k]; let t10 = Gd.th[k + 1], t01 = Gd.th[k + GW], t11 = Gd.th[k + GW + 1];
    if (t10 - t00 > N / 2) t10 -= N; else if (t00 - t10 > N / 2) t10 += N; if (t01 - t00 > N / 2) t01 -= N; else if (t00 - t01 > N / 2) t01 += N; if (t11 - t00 > N / 2) t11 -= N; else if (t00 - t11 > N / 2) t11 += N;
    let th = t00 + (t10 - t00) * fx + (t01 - t00) * fy + (t00 - t10 - t01 + t11) * fx * fy; if (th < 0) th += N; else if (th >= N) th -= N;
    const s = s00 + (s10 - s00) * fx + (s01 - s00) * fy + (s00 - s10 - s01 + s11) * fx * fy;
    out[0] = th; out[1] = s; out[2] = Wd.smax(th) - s; return out[2] >= 0;
  };
  // a full-resolution stencil: 1 where the cloth is, 0 where the night shows
  Wd.stencil = function (C) {
    if (C.CL) return C.CL;
    const W = C.W, H = C.H, k = C.k, M = (C.CL = new Uint8Array(W * H)), o = [0, 0, 0];
    for (let y = 0; y < H; y++) { const uy = (y + 0.5) / k; for (let x = 0; x < W; x++) M[y * W + x] = Wd.at((x + 0.5) / k, uy, o) ? 1 : 0; }
    return M;
  };
})(typeof self !== 'undefined' ? self : globalThis);
