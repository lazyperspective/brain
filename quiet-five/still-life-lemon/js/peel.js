/* Still Life with Lemon — the moving parts.
   1) The lemon peel: a ribbon built from the boundary of the peeled zone on the lemon, lying across the
      pewter plate, falling over its rim and hanging as a corkscrew. The hanging part turns a few degrees
      in a slow draft (torsional swing, lower turns lag). Rendered per frame with a deferred 2x2
      supersampled rasterizer, z-tested against the static painting, lit by the same flickering candle,
      self-shadowed via a light-space depth map, translucent where back-lit.
   2) The bubble: clings inside the wine, slowly grows, lets go once per loop, slides up the glass and
      merges with the meniscus; a new one is already nucleating at the same site.                     */
(function (G) {
  'use strict';
  const Q = G.Q;
  const S = Q.SCENE;
  const sqrt = Math.sqrt, min = Math.min, max = Math.max, abs = Math.abs, floor = Math.floor, PI = Math.PI;
  const NPL = Q.makeNoise(5150);
  const WIDTH = 1.45;
  const NS = 520, NW = 7;
  const P = (Q.PEEL = { built: false });

  function v3(x, y, z) { return [x, y, z]; }
  function add(a, b, k) { return [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]; }
  const norm = Q.norm3, cross = Q.cross, dot = Q.dot;

  function lemonPoint(u, phi) {
    const LM = Q.LEMON_FRAME, C = S.lemon.C;
    const d = [LM.b[0] * Math.cos(phi) + LM.c[0] * Math.sin(phi), LM.b[1] * Math.cos(phi) + LM.c[1] * Math.sin(phi), LM.b[2] * Math.cos(phi) + LM.c[2] * Math.sin(phi)];
    const o = add(C, LM.a, u);
    let lo = 0, hi = 5;
    for (let k = 0; k < 40; k++) { const m = 0.5 * (lo + hi); const p = add(o, d, m); if (Q.sdLemon(p[0], p[1], p[2]) < 0) lo = m; else hi = m; }
    const p = add(o, d, lo);
    const e = 0.003;
    const f = Q.sdLemon;
    const n = norm([f(p[0] + e, p[1], p[2]) - f(p[0] - e, p[1], p[2]), f(p[0], p[1] + e, p[2]) - f(p[0], p[1] - e, p[2]), f(p[0], p[1], p[2] + e) - f(p[0], p[1], p[2] - e)]);
    return { p, n, d };
  }

  // centripetal-ish Catmull-Rom through points
  function catmull(pts, t) {
    const n = pts.length - 1;
    let i = Math.floor(t * n); if (i >= n) i = n - 1; if (i < 0) i = 0;
    const u = t * n - i;
    const p0 = pts[max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[min(n, i + 2)];
    const u2 = u * u, u3 = u2 * u;
    const out = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      out[c] = 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * u3);
    }
    return out;
  }

  function build() {
    const LM = Q.LEMON_FRAME;
    // attach point: on the boundary of the peeled zone, low on the lemon, facing the viewer
    const target = norm([0.25, -0.55, 0.8]);
    let best = -2, phi0 = 0;
    for (let k = 0; k < 720; k++) {
      const phi = -PI + (k / 720) * 2 * PI;
      const d = [LM.b[0] * Math.cos(phi) + LM.c[0] * Math.sin(phi), LM.b[1] * Math.cos(phi) + LM.c[1] * Math.sin(phi), LM.b[2] * Math.cos(phi) + LM.c[2] * Math.sin(phi)];
      const v = dot(d, target); if (v > best) { best = v; phi0 = phi; }
    }
    const A0 = lemonPoint(Q.peelBoundary(phi0) - 0.12, phi0);
        const pts = [], nh = [];
    const pl = S.plate;
    const onPlate = (x, z, lift) => { const r = Math.hypot(x - pl.x, z - pl.z); return [x, Q.plateTop(r) + lift, z]; };
    // leaves the lemon low on its front, half-twists under it and lies rind-up across the plate
    pts.push(A0.p); nh.push(A0.n);
    pts.push(onPlate(A0.p[0] - 0.1, A0.p[2] + 1.15, 0.2)); nh.push(norm([A0.n[0], 0.2, A0.n[2]]));
    pts.push(onPlate(A0.p[0] - 0.35, A0.p[2] + 2.4, 0.14)); nh.push([0.15, 1, 0.25]);
    pts.push(onPlate(A0.p[0] - 0.8, A0.p[2] + 4.3, 0.13)); nh.push([0.05, 1, 0.1]);
    pts.push(onPlate(A0.p[0] - 1.1, A0.p[2] + 6.2, 0.13)); nh.push([-0.05, 1, 0.05]);
    // rim
    const rimAng = Math.atan2(A0.p[2] + 7.6 - pl.z, A0.p[0] - 1.3 - pl.x);
    const rimP = (r, lift) => { const x = pl.x + Math.cos(rimAng) * r, z = pl.z + Math.sin(rimAng) * r; return [x, Q.plateTop(r) + lift, z]; };
    pts.push(rimP(9.1, 0.13)); nh.push([0, 1, 0.1]);
    pts.push(rimP(10.15, 0.2)); nh.push([0, 1, 0.3]);
    const edge = rimP(10.95, 0.0);
    pts.push([edge[0], edge[1] + 0.12, edge[2]]); nh.push(norm([0.1, 0.9, 0.7]));
    pts.push([edge[0] - 0.03, edge[1] - 0.2, edge[2] + 0.42]); nh.push(norm([0.15, 0.45, 1]));
    const H = [edge[0] - 0.06, edge[1] - 0.75, edge[2] + 0.55];
    pts.push(H); nh.push([0.3, 0.05, 1]);
    const iHang = pts.length - 1;
    // corkscrew below the hang point
    const turns = 1.9, pitch = 2.25;
    const rho0 = 1.2, rho1 = 0.88;
    const Ax = H[0] - rho0 * 0.15, Az = H[2] - rho0 * 0.9;
    const nh0 = 16;
    for (let k = 1; k <= nh0 * turns; k++) {
      const f = k / (nh0 * turns);
      const ph = PI / 2 - 0.25 + f * turns * 2 * PI;
      const rho = rho0 + (rho1 - rho0) * f;
      const y = H[1] - 0.55 - pitch * turns * (f + 0.08 * f * f) - 0.1;
      // the helix axis drifts a little (gravity, uneven peel)
      const ax = Ax + 0.25 * Math.sin(f * 2.1), az = Az + 0.18 * f;
      pts.push([ax + rho * Math.cos(ph), y, az + rho * Math.sin(ph)]);
      const bank = 0.35 * Math.sin(f * 7.0 + 0.5); // the strip tilts, showing its pith now and then
      nh.push([Math.cos(ph), bank, Math.sin(ph)]);
    }
    // sample the spline uniformly in arc length
    const dense = 4000;
    const dp = [], dn = [];
    for (let i = 0; i <= dense; i++) { const t = i / dense; dp.push(catmull(pts, t)); dn.push(norm(catmull(nh, t))); }
    const cum = [0];
    for (let i = 1; i <= dense; i++) cum.push(cum[i - 1] + Math.hypot(dp[i][0] - dp[i - 1][0], dp[i][1] - dp[i - 1][1], dp[i][2] - dp[i - 1][2]));
    const total = cum[dense];
    const tHang = iHang / (pts.length - 1);
    const sHang = cum[Math.round(tHang * dense)];
    const C = [], T = [], Nn = [], B = [], Sarr = [];
    let j = 0;
    for (let i = 0; i < NS; i++) {
      const s = (i / (NS - 1)) * total;
      while (j < dense - 1 && cum[j + 1] < s) j++;
      const f = (s - cum[j]) / max(1e-6, cum[j + 1] - cum[j]);
      const p = [0, 1, 2].map((c) => dp[j][c] + (dp[j + 1][c] - dp[j][c]) * f);
      const nn = norm([0, 1, 2].map((c) => dn[j][c] + (dn[j + 1][c] - dn[j][c]) * f));
      C.push(p); Nn.push(nn); Sarr.push(s);
    }
    for (let i = 0; i < NS; i++) {
      const a = C[max(0, i - 1)], b = C[min(NS - 1, i + 1)];
      const t = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
      let n = Nn[i];
      const k = dot(n, t); n = norm([n[0] - t[0] * k, n[1] - t[1] * k, n[2] - t[2] * k]);
      const bb = cross(t, n);
      T.push(t); Nn[i] = n; B.push(bb);
    }
    P.C = C; P.T = T; P.N = Nn; P.B = B; P.S = Sarr; P.total = total; P.sHang = sHang; P.H = H;
    P.iHang = Sarr.findIndex((s) => s >= sHang);
    // width profile: emerges from the lemon, tapers to a rounded tip
    P.halfW = Sarr.map((s) => (WIDTH / 2) * (0.55 + 0.45 * Q.smooth(0.0, 1.2, s)) * (0.2 + 0.8 * Q.smooth(total, total - 2.4, s)) * (0.9 + 0.1 * Math.sin(s * 1.1) + 0.04 * Math.sin(s * 3.7)));
    P.built = true;
  }

  // rest-pose vertex buffers
  let VX, VN, VS, VW, VSH; // positions, normals, s, w, static shadow per vertex
  function buildVerts() {
    const nv = NS * NW;
    VX = new Float64Array(nv * 3); VN = new Float64Array(nv * 3); VS = new Float32Array(nv); VW = new Float32Array(nv); VSH = new Float32Array(nv);
    for (let i = 0; i < NS; i++) for (let j = 0; j < NW; j++) {
      const w = (j / (NW - 1)) * 2 - 1;
      const hw = P.halfW[i];
      const curl = 0.16 * w * w; // cross-section curvature: edges curl toward the pith side
      const k = i * NW + j;
      for (let c = 0; c < 3; c++) {
        VX[k * 3 + c] = P.C[i][c] + P.B[i][c] * w * hw - P.N[i][c] * curl * (hw / (WIDTH / 2));
        VN[k * 3 + c] = P.N[i][c] + P.B[i][c] * w * 0.45;
      }
      const l = Math.hypot(VN[k * 3], VN[k * 3 + 1], VN[k * 3 + 2]);
      VN[k * 3] /= l; VN[k * 3 + 1] /= l; VN[k * 3 + 2] /= l;
      VS[k] = P.S[i]; VW[k] = w;
    }
    // static occlusion by scene objects (the lemon over the first part, plate rim nothing)
    for (let k = 0; k < nv; k++) {
      const x = VX[k * 3], y = VX[k * 3 + 1], z = VX[k * 3 + 2];
      VSH[k] = Q.softShadowAt(x + VN[k * 3] * 0.02, y + VN[k * 3 + 1] * 0.02 + 0.02, z + VN[k * 3 + 2] * 0.02, -1);
    }
  }

  // static shadow of the resting part of the peel onto the plate/lemon (for the static render)
  function staticShadow(px, py, pz) {
    if (!P.built) return 1;
    const L = Q.LIGHT.P;
    // quick reject: receiver far from the resting peel
    if (px < P.bb[0] || px > P.bb[3] || pz < P.bb[2] || pz > P.bb[5] || py > P.bb[4]) return 1;
    let dx = L[0] - px, dy = L[1] - py, dz = L[2] - pz; const dl = sqrt(dx * dx + dy * dy + dz * dz); dx /= dl; dy /= dl; dz /= dl;
    let occ = 0;
    for (let i = 0; i < P.iHang + 4; i += 2) {
      const c = P.C[i], n = P.N[i], b = P.B[i], t = P.T[i];
      const den = dx * n[0] + dy * n[1] + dz * n[2];
      if (abs(den) < 1e-4) continue;
      const tt = ((c[0] - px) * n[0] + (c[1] - py) * n[1] + (c[2] - pz) * n[2]) / den;
      if (tt <= 0.01) continue;
      const qx = px + dx * tt - c[0], qy = py + dy * tt - c[1], qz = pz + dz * tt - c[2];
      const along = abs(qx * t[0] + qy * t[1] + qz * t[2]);
      const across = abs(qx * b[0] + qy * b[1] + qz * b[2]);
      const segL = (P.S[min(NS - 1, i + 2)] - P.S[i]) * 0.55 + 0.01;
      if (along > segL) continue;
      const pen = 0.02 + tt * 0.025; // penumbra grows with distance
      const o = Q.smooth(P.halfW[i] + pen, P.halfW[i] - pen, across);
      if (o > occ) occ = o;
      if (occ > 0.99) break;
    }
    return 1 - occ;
  }

  Q.peelInit = function () {
    if (!P.built) build();
    // bounding box of the resting part (expanded)
    let bb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    for (let i = 0; i <= P.iHang + 4 && i < NS; i++) for (let c = 0; c < 3; c++) { bb[c] = min(bb[c], P.C[i][c] - 1.2); bb[c + 3] = max(bb[c + 3], P.C[i][c] + 1.2); }
    bb[4] += 0.5;
    P.bb = bb;
    Q.peelStaticShadow = staticShadow;
    buildVerts();
  };

  // ---------------------------------------------------------------- motion
  const LOOP = 10;
  P.angle = function (sPrime, t) {
    const lag = 0.055 * sPrime; // seconds: the lower turns follow late
    const ph = (2 * PI * (t - lag)) / LOOP;
    const deg = 4.2 * Math.sin(ph + 0.4) + 1.3 * Math.sin(2 * ph + 1.9) + 0.4 * Math.sin(3 * ph + 0.3);
    return ((deg * PI) / 180) * Q.smooth(0, 1.6, sPrime) * (0.55 + 0.45 * Q.smooth(0, 8, sPrime));
  };
  const CUR = { X: null, N: null };
  function posePeel(t) {
    const nv = NS * NW;
    if (!CUR.X) { CUR.X = new Float64Array(nv * 3); CUR.N = new Float64Array(nv * 3); }
    const H = P.H;
    for (let i = 0; i < NS; i++) {
      const sp = P.S[i] - P.sHang;
      const a = sp > 0 ? P.angle(sp, t) : 0;
      const ca = Math.cos(a), sa = Math.sin(a);
      // a slight pendulum drift of the lower turns as well
      const sway = sp > 0 ? 0.035 * sp * Math.sin((2 * PI * (t - 0.05 * sp)) / LOOP + 1.2) * Q.smooth(0, 6, sp) : 0;
      for (let j = 0; j < NW; j++) {
        const k = i * NW + j;
        const x = VX[k * 3] - H[0], y = VX[k * 3 + 1], z = VX[k * 3 + 2] - H[2];
        CUR.X[k * 3] = H[0] + x * ca - z * sa + sway * 0.6;
        CUR.X[k * 3 + 1] = y;
        CUR.X[k * 3 + 2] = H[2] + x * sa + z * ca + sway * 0.25;
        const nx = VN[k * 3], nz = VN[k * 3 + 2];
        CUR.N[k * 3] = nx * ca - nz * sa; CUR.N[k * 3 + 1] = VN[k * 3 + 1]; CUR.N[k * 3 + 2] = nx * sa + nz * ca;
      }
    }
  }
  Q.posePeel = posePeel;

  // ---------------------------------------------------------------- raster buffers
  const RB = { cap: 0 };
  function ensure(n) {
    if (RB.cap >= n) return;
    RB.cap = n; RB.z = new Float32Array(n); RB.tri = new Int32Array(n); RB.b1 = new Float32Array(n); RB.b2 = new Float32Array(n);
  }
  const PJ = [0, 0, 0];
  let SX, SY, SZ; // projected (supersampled) vertex coords
  // light-space shadow map
  const SM = { n: 640, z: null };
  function buildShadowMap() {
    const L = Q.LIGHT.P;
    const nv = NS * NW;
    // light frame looking at the peel centre
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < nv; k++) { cx += CUR.X[k * 3]; cy += CUR.X[k * 3 + 1]; cz += CUR.X[k * 3 + 2]; }
    cx /= nv; cy /= nv; cz /= nv;
    const f = norm([cx - L[0], cy - L[1], cz - L[2]]);
    const r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
    SM.f = f; SM.r = r; SM.u = u;
    // fit extent
    let ext = 0;
    const lx = new Float32Array(nv), ly = new Float32Array(nv), lz = new Float32Array(nv);
    for (let k = 0; k < nv; k++) {
      const dx = CUR.X[k * 3] - L[0], dy = CUR.X[k * 3 + 1] - L[1], dz = CUR.X[k * 3 + 2] - L[2];
      const zc = dx * f[0] + dy * f[1] + dz * f[2];
      const xc = (dx * r[0] + dy * r[1] + dz * r[2]) / zc, yc = (dx * u[0] + dy * u[1] + dz * u[2]) / zc;
      lx[k] = xc; ly[k] = yc; lz[k] = Math.hypot(dx, dy, dz);
      ext = max(ext, abs(xc), abs(yc));
    }
    ext *= 1.05; SM.ext = ext;
    const n = SM.n;
    if (!SM.z) SM.z = new Float32Array(n * n);
    SM.z.fill(1e9);
    const toS = (v) => ((v / ext) * 0.5 + 0.5) * (n - 1);
    for (let i = 0; i < NS - 1; i++) for (let j = 0; j < NW - 1; j++) {
      const k0 = i * NW + j, k1 = k0 + 1, k2 = k0 + NW, k3 = k2 + 1;
      rasterDepth(toS(lx[k0]), toS(ly[k0]), lz[k0], toS(lx[k1]), toS(ly[k1]), lz[k1], toS(lx[k2]), toS(ly[k2]), lz[k2], SM.z, n);
      rasterDepth(toS(lx[k1]), toS(ly[k1]), lz[k1], toS(lx[k3]), toS(ly[k3]), lz[k3], toS(lx[k2]), toS(ly[k2]), lz[k2], SM.z, n);
    }
  }
  function rasterDepth(x0, y0, z0, x1, y1, z1, x2, y2, z2, buf, n) {
    const minx = max(0, floor(min(x0, x1, x2))), maxx = min(n - 1, Math.ceil(max(x0, x1, x2)));
    const miny = max(0, floor(min(y0, y1, y2))), maxy = min(n - 1, Math.ceil(max(y0, y1, y2)));
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (abs(area) < 1e-9) return;
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
      const px = x, py = y;
      // conservative: expand a little so thin ribbons still shadow
      const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area;
      const w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < -0.03 || w1 < -0.03 || w2 < -0.03) continue;
      const z = w0 * z0 + w1 * z1 + w2 * z2;
      const i = y * n + x;
      if (z < buf[i]) buf[i] = z;
    }
  }
  function shadowLookup(x, y, z) {
    const L = Q.LIGHT.P;
    const dx = x - L[0], dy = y - L[1], dz = z - L[2];
    const f = SM.f, r = SM.r, u = SM.u;
    const zc = dx * f[0] + dy * f[1] + dz * f[2];
    const xc = (dx * r[0] + dy * r[1] + dz * r[2]) / zc, yc = (dx * u[0] + dy * u[1] + dz * u[2]) / zc;
    const n = SM.n;
    const sx = ((xc / SM.ext) * 0.5 + 0.5) * (n - 1), sy = ((yc / SM.ext) * 0.5 + 0.5) * (n - 1);
    const d = Math.hypot(dx, dy, dz);
    // tent-filtered PCF (smooth, no stair steps)
    let lit = 0, cnt = 0;
    const bx = floor(sx), by = floor(sy);
    for (let oy = -3; oy <= 3; oy++) for (let ox = -3; ox <= 3; ox++) {
      const ix = bx + ox, iy = by + oy;
      const wx = max(0, 3.2 - abs(ix - sx)), wy = max(0, 3.2 - abs(iy - sy));
      const w = wx * wy;
      if (w <= 0) continue;
      cnt += w;
      if (ix < 0 || iy < 0 || ix >= n || iy >= n) { lit += w; continue; }
      if (SM.z[iy * n + ix] > d - 0.45) lit += w;
    }
    return lit / cnt;
  }

  // ---------------------------------------------------------------- per-frame draw
  const AMB = [0.034, 0.030, 0.022];
  Q.peelDraw = function (out, t, fl, pt, W, H) {
    if (!P.built || !VX) return;
    posePeel(t);
    buildShadowMap();
    const nv = NS * NW;
    const ss = W > 1500 ? 2 : 1; // supersampling (export 4K: 2x2; live 1080: 1x)
    const SW = W * ss, SH = H * ss;
    if (!SX || SX.length < nv) { SX = new Float32Array(nv); SY = new Float32Array(nv); SZ = new Float32Array(nv); }
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    const E = S.E;
    for (let k = 0; k < nv; k++) {
      Q.project(CUR.X[k * 3], CUR.X[k * 3 + 1], CUR.X[k * 3 + 2], PJ);
      SX[k] = (PJ[0] + 0.5) * ss - 0.5; SY[k] = (PJ[1] + 0.5) * ss - 0.5;
      SZ[k] = Math.hypot(CUR.X[k * 3] - E[0], CUR.X[k * 3 + 1] - E[1], CUR.X[k * 3 + 2] - E[2]);
      minx = min(minx, SX[k]); maxx = max(maxx, SX[k]); miny = min(miny, SY[k]); maxy = max(maxy, SY[k]);
    }
    const bx0 = max(0, floor(minx) - 2), by0 = max(0, floor(miny) - 2);
    const bx1 = min(SW - 1, Math.ceil(maxx) + 2), by1 = min(SH - 1, Math.ceil(maxy) + 2);
    // align to pixel grid
    const px0 = floor(bx0 / ss), py0 = floor(by0 / ss), px1 = floor(bx1 / ss), py1 = floor(by1 / ss);
    const bw = (px1 - px0 + 1) * ss, bh = (py1 - py0 + 1) * ss;
    ensure(bw * bh);
    RB.z.fill(1e9, 0, bw * bh); RB.tri.fill(-1, 0, bw * bh);
    const ox = px0 * ss, oy = py0 * ss;
    // raster all ribbon triangles
    let tid = 0;
    for (let i = 0; i < NS - 1; i++) for (let j = 0; j < NW - 1; j++) {
      const k0 = i * NW + j, k1 = k0 + 1, k2 = k0 + NW, k3 = k2 + 1;
      rasterTri(k0, k1, k2, tid++, ox, oy, bw, bh);
      rasterTri(k1, k3, k2, tid++, ox, oy, bw, bh);
    }
    // shade samples, resolve to pixels
    const depth = pt.depth;
    const L = Q.LIGHT;
    const lc = S.L.col, I = S.L.I;
    const cm = Q.canvasMul;
    for (let py = py0; py <= py1; py++) for (let px = px0; px <= px1; px++) {
      let r = 0, g = 0, b = 0, cov = 0;
      const pix = py * W + px;
      const dstat = depth[pix];
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const bi = (py * ss + sy - oy) * bw + (px * ss + sx - ox);
        const tr = RB.tri[bi];
        if (tr < 0) continue;
        if (!G.NODEPTH && RB.z[bi] > dstat + 0.3) continue; // behind the static scene (lemon, plate)
        shadeSample(tr, RB.b1[bi], RB.b2[bi], fl, L, lc, I);
        r += SHD[0]; g += SHD[1]; b += SHD[2]; cov++;
      }
      if (!cov) continue;
      const a = cov / (ss * ss);
      const m = cm ? cm[pix] : 1;
      const q = pix * 3;
      out[q] = out[q] * (1 - a) + (r / (ss * ss)) * m;
      out[q + 1] = out[q + 1] * (1 - a) + (g / (ss * ss)) * m;
      out[q + 2] = out[q + 2] * (1 - a) + (b / (ss * ss)) * m;
    }
  };

  function rasterTri(a, b, c, tid, ox, oy, bw, bh) {
    const x0 = SX[a] - ox, y0 = SY[a] - oy, x1 = SX[b] - ox, y1 = SY[b] - oy, x2 = SX[c] - ox, y2 = SY[c] - oy;
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (abs(area) < 1e-9) return;
    const minx = max(0, Math.ceil(min(x0, x1, x2) - 0.5)), maxx = min(bw - 1, floor(max(x0, x1, x2) + 0.5));
    const miny = max(0, Math.ceil(min(y0, y1, y2) - 0.5)), maxy = min(bh - 1, floor(max(y0, y1, y2) + 0.5));
    const za = SZ[a], zb = SZ[b], zc = SZ[c];
    const inv = 1 / area;
    for (let y = miny; y <= maxy; y++) {
      const py = y + 0.5;
      for (let x = minx; x <= maxx; x++) {
        const px = x + 0.5;
        const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) * inv;
        const w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) * inv;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * za + w1 * zb + w2 * zc;
        const i = y * bw + x;
        if (z < RB.z[i]) { RB.z[i] = z; RB.tri[i] = tid; RB.b1[i] = w1; RB.b2[i] = w2; }
      }
    }
  }

  const SHD = [0, 0, 0];
  function shadeSample(tid, w1, w2, fl, Lt, lc, I) {
    const q = tid >> 1, cell = q, i = (cell / (NW - 1)) | 0, j = cell % (NW - 1);
    const k0 = i * NW + j, k1 = k0 + 1, k2 = k0 + NW, k3 = k2 + 1;
    let va, vb, vc;
    if ((tid & 1) === 0) { va = k0; vb = k1; vc = k2; } else { va = k1; vb = k3; vc = k2; }
    const w0 = 1 - w1 - w2;
    const X = CUR.X, Nn = CUR.N;
    const x = X[va * 3] * w0 + X[vb * 3] * w1 + X[vc * 3] * w2;
    const y = X[va * 3 + 1] * w0 + X[vb * 3 + 1] * w1 + X[vc * 3 + 1] * w2;
    const z = X[va * 3 + 2] * w0 + X[vb * 3 + 2] * w1 + X[vc * 3 + 2] * w2;
    let nx = Nn[va * 3] * w0 + Nn[vb * 3] * w1 + Nn[vc * 3] * w2;
    let ny = Nn[va * 3 + 1] * w0 + Nn[vb * 3 + 1] * w1 + Nn[vc * 3 + 1] * w2;
    let nz = Nn[va * 3 + 2] * w0 + Nn[vb * 3 + 2] * w1 + Nn[vc * 3 + 2] * w2;
    const s = VS[va] * w0 + VS[vb] * w1 + VS[vc] * w2;
    const w = VW[va] * w0 + VW[vb] * w1 + VW[vc] * w2;
    const shS = VSH[va] * w0 + VSH[vb] * w1 + VSH[vc] * w2;
    let nl0 = Math.hypot(nx, ny, nz) || 1; nx /= nl0; ny /= nl0; nz /= nl0;
    const E = S.E;
    let vx = E[0] - x, vy = E[1] - y, vz = E[2] - z; const vl = Math.hypot(vx, vy, vz); vx /= vl; vy /= vl; vz /= vl;
    let rind = true;
    if (nx * vx + ny * vy + nz * vz < 0) { nx = -nx; ny = -ny; nz = -nz; rind = false; }
    // painted texture in the ribbon's own parameter space (moves with it)
    const bri = 0.9 + 0.12 * NPL.n2(w * 6.5 + s * 0.35, s * 0.45) + 0.06 * NPL.n2(w * 17 + 3.1, s * 1.3);
    const edge = Q.smooth(0.72, 0.97, abs(w)); // the cut edge shows white pith
    let ar, ag, ab, wrap, rough, spk;
    const mott = NPL.n2(s * 1.4, w * 1.1 + 5);
    if (rind) {
      ar = 0.82 + 0.06 * mott; ag = 0.54 + 0.05 * mott; ab = 0.04; wrap = 0.4; rough = 0.24; spk = 1.6;
    } else {
      ar = 0.84; ag = 0.77; ab = 0.53; wrap = 0.65; rough = 0.45; spk = 0.3;
    }
    ar += (0.80 - ar) * edge; ag += (0.735 - ag) * edge; ab += (0.50 - ab) * edge;
    ar *= bri; ag *= bri; ab *= bri;
    // light
    const LP = Lt.P;
    let lx = LP[0] - x, ly = LP[1] - y, lz = LP[2] - z;
    const d2 = lx * lx + ly * ly + lz * lz, dl = sqrt(d2); lx /= dl; ly /= dl; lz /= dl;
    const Ein = (I / d2) * Q.spot(x, y, z);
    const shSelf = shadowLookup(x, y, z);
    const sh = shSelf * shS;
    const nl = nx * lx + ny * ly + nz * lz;
    let diff = max(0, (nl + wrap) / (1 + wrap)) * sh;
    // translucency: light arriving on the far side glows through the thin peel
    const trans = max(0, -nl) * sh * (rind ? 0.22 : 0.38);
    const tr = rind ? [1.0, 0.62, 0.08] : [1.0, 0.82, 0.35];
    const fid = fl.id;
    let r = 0, g = 0, b = 0;
    r += (ar * diff + tr[0] * trans * ar) * Ein * lc[0] * fid;
    g += (ag * diff + tr[1] * trans * ag) * Ein * lc[1] * fid;
    b += (ab * diff + tr[2] * trans * ab) * Ein * lc[2] * fid;
    // ambient & dim bounce
    const skyw = 0.55 + 0.45 * ny;
    r += ar * AMB[0] * skyw; g += ag * AMB[1] * skyw; b += ab * AMB[2] * skyw;
    // speculars (two flame positions, mixed like the static layers)
    if (sh > 0.01) {
      const pr = 0.12 * NPL.n3(x * 15, y * 15, z * 15);
      const snx = nx + pr * (rind ? 1 : 0.3), sny = ny + pr * 0.5, snz = nz - pr * (rind ? 1 : 0.3);
      const sl = Math.hypot(snx, sny, snz);
      const sa = Q.specTerm(snx / sl, sny / sl, snz / sl, vx, vy, vz, Lt.A, x, y, z, rough) * (1 - fl.m);
      const sb = Q.specTerm(snx / sl, sny / sl, snz / sl, vx, vy, vz, Lt.B, x, y, z, rough) * fl.m;
      const sp = (sa + sb) * fl.is * 0.045 * spk * sh * Q.spot(x, y, z);
      r += sp * lc[0]; g += sp * lc[1]; b += sp * lc[2];
    }
    SHD[0] = r; SHD[1] = g; SHD[2] = b;
  }

  // ---------------------------------------------------------------- the bubble
  const BUB = { rmax: 0.13, tRel: 5.6 };
  (function () {
    const GL = S.glass;
    const ex = S.E[0] - GL.x, ez = S.E[2] - GL.z; const el = Math.hypot(ex, ez);
    const ang = Math.atan2(ez / el, ex / el) + 0.42; // a little to the right of the axis facing us
    BUB.ca = Math.cos(ang); BUB.sa = Math.sin(ang);
    BUB.y0 = GL.wl - 1.75;
  })();
  function wallPoint(y, inset) {
    const GL = S.glass;
    const ry = (y - GL.yc) / GL.b; const rr = GL.a * sqrt(max(0, 1 - ry * ry)) - inset;
    return [GL.x + BUB.ca * rr, y, GL.z + BUB.sa * rr];
  }
  P.bubbleState = function (t) {
    const L = LOOP;
    const tau = (((t - BUB.tRel) % L) + L) % L; // time since the last release
    const list = [];
    // the clinging bubble, growing (diffusion-limited ~ sqrt)
    const rg = BUB.rmax * Math.pow(tau / L, 0.5);
    if (rg > 0.012) list.push({ p: wallPoint(BUB.y0, rg * 0.85), r: rg, a: Q.smooth(0.012, 0.03, rg) });
    // the released bubble sliding up the wall to the meniscus
    const riseT = 0.95;
    if (tau < riseT + 0.4) {
      const GL = S.glass;
      const u = Math.min(tau / riseT, 1);
      // eases off the glass, accelerates, slows into the meniscus
      const e = u * u * (3 - 2 * u) * 0.75 + u * 0.25;
      const y = BUB.y0 + (GL.wl - 0.08 - BUB.y0) * e;
      const r = BUB.rmax * (1 + 0.06 * e);
      const pop = tau > riseT ? 1 - Q.smooth(riseT + 0.18, riseT + 0.36, tau) : 1;
      if (pop > 0.001) list.push({ p: wallPoint(y, r * 0.95 + 0.04 * Math.sin(u * PI)), r, a: pop, rise: u });
    }
    return list;
  };
  Q.bubbleDraw = function (out, t, fl, pt, W, H) {
    const bs = P.bubbleState(t);
    const sc = W / 2160;
    const L = Q.LIGHT;
    for (const bb of bs) {
      Q.project(bb.p[0], bb.p[1], bb.p[2], PJ);
      const cx = PJ[0], cy = PJ[1];
      const fpx = (H / 2) / (Math.tan(S.fovY / 2) * PJ[2]); // pixels per cm at that depth
      const R = bb.r * fpx * 1.06; // slight magnification through the wine
      const x0 = max(0, floor(cx - R - 3)), x1 = min(W - 1, Math.ceil(cx + R + 3));
      const y0 = max(0, floor(cy - R - 3)), y1 = min(H - 1, Math.ceil(cy + R + 3));
      const Ein = (S.L.I / ((L.P[0] - bb.p[0]) ** 2 + (L.P[1] - bb.p[1]) ** 2 + (L.P[2] - bb.p[2]) ** 2)) * Q.spot(bb.p[0], bb.p[1], bb.p[2]);
      // highlight toward the light (upper left in screen)
      const hx = cx - R * 0.38, hy = cy - R * 0.42;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy; const d = sqrt(dx * dx + dy * dy);
        const cov = Q.clamp(R - d + 0.5, 0, 1) * bb.a;
        const q = (y * W + x) * 3;
        if (cov > 0) {
          const rr = d / max(R, 0.5);
          // inside: darker, refracted wine; rim: silvery total internal reflection
          const rim = Q.smooth(0.55, 0.95, rr);
          const dark = 0.7;
          const rimL = 0.035 * Ein * rim * fl.id;
          out[q] = out[q] * (1 - cov) + cov * (out[q] * dark + rimL * 1.0);
          out[q + 1] = out[q + 1] * (1 - cov) + cov * (out[q + 1] * dark + rimL * 0.92);
          out[q + 2] = out[q + 2] * (1 - cov) + cov * (out[q + 2] * dark + rimL * 0.70);
        }
        // specular dot (lead white touch), and a faint warm transmitted spot opposite
        const hd = Math.hypot(x - hx, y - hy) / max(R * 0.28, 0.9);
        const hs = Math.exp(-hd * hd * 1.6) * bb.a * fl.is * 0.5 * Ein;
        const td = Math.hypot(x - (cx + R * 0.35), y - (cy + R * 0.4)) / max(R * 0.35, 0.7);
        const ts = Math.exp(-td * td * 2) * bb.a * fl.id * 0.05 * Ein;
        out[q] += hs + ts; out[q + 1] += hs * 0.97 + ts * 0.8; out[q + 2] += hs * 0.9 + ts * 0.4;
      }
      void sc;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
