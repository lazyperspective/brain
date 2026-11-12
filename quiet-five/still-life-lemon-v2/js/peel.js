'use strict';
// ---------------------------------------------------------------------------
// The lemon peel: a 1.75 cm strip, 3 mm thick, yellow rind outside and white
// pith inside, lying from the lemon across the plate, over the rim, and
// hanging in a loose gravity-pulled helix into the dark.
// It is painted ONCE, with brush strokes, in its own surface coordinates
// (s along the strip, w across it): one canvas for the rind side, one for the
// pith side.  Every frame the posed strip is rasterised (2x2 supersampled,
// z-buffered) and those painted surfaces are mapped onto it, so the strokes
// ride with the peel and never fizz.  Light is re-mixed per frame from the
// current surface orientation and the candle flicker.
// ---------------------------------------------------------------------------
const PEEL = {};
(function () {
  const ds = 0.04;
  // ---- resting part: Catmull-Rom through hand-placed points (world cm)
  const q0 = lemPoint(LEM.uc + 1.3, LEM.ths);
  const n0q = lemNormalAt(LEM.uc + 1.3, LEM.ths);
  const Q = [
    [q0[0] + n0q[0] * 0.12, q0[1] + n0q[1] * 0.12, q0[2] + n0q[2] * 0.12],
    [0.45, 0.62, 2.95], [-0.35, 0.16, 3.95], [-1.55, 0.15, 4.85], [-2.85, 0.15, 5.45],
    [-3.55, 0.42, 6.2], [-3.95, 0.93, 7.0], [-4.18, 0.96, 7.8], [-4.3, 0.74, 8.42], [-4.33, 0.25, 8.66], [-4.33, -0.3, 8.72],
  ];
  // push the first point a little into the lemon so the strip grows out of the rind
  const pts = [];
  const cr = (p0, p1, p2, p3, t) => {
    const t2 = t * t, t3 = t2 * t;
    return [0, 1, 2].map(k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3));
  };
  for (let i = 0; i < Q.length - 1; i++) {
    const p0 = Q[Math.max(0, i - 1)], p1 = Q[i], p2 = Q[i + 1], p3 = Q[Math.min(Q.length - 1, i + 2)];
    for (let k = 0; k < 40; k++) pts.push(cr(p0, p1, p2, p3, k / 40));
  }
  pts.push(Q[Q.length - 1]);
  // ---- hanging part: integrate a loose helix (stretched above, tighter below)
  const H0 = Q[Q.length - 1];
  const rho0 = 0.3;
  const Xa = H0[0], Za = H0[2] - rho0;
  PEEL.axis = [Xa, Za];
  let th = 0, y = H0[1];
  const LH = 17.6;
  const hang = [];
  for (let sp = 0; sp <= LH; sp += 0.01) {
    const rho = rho0 + (1.08 - rho0) * sm(0, 3.0, sp) * (1 + 0.08 * Math.sin(0.75 * sp + 1.1)) + 0.3 * sm(5, 12, sp) - 0.3 * sm(13.5, LH, sp);
    const al = 0.07 + 1.12 * Math.pow(sm(0.2, 5.0, sp), 0.75) + 0.05 * Math.sin(1.1 * sp + 0.3);
    th += Math.sin(al) / Math.max(rho, 0.2) * 0.01;
    y -= Math.cos(al) * 0.01;
    hang.push([Xa + rho * Math.sin(th), y, Za + rho * Math.cos(th)]);
  }
  // resample everything by arc length
  const raw = pts.concat(hang.slice(1));
  const cum = [0];
  for (let i = 1; i < raw.length; i++) cum.push(cum[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1], raw[i][2] - raw[i - 1][2]));
  // arc length where the hanging part starts
  let restLen = 0;
  for (let i = 1; i < pts.length; i++) restLen += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
  const Ltot = cum[cum.length - 1];
  const NS = Math.floor(Ltot / ds) + 1;
  const Cx = new Float64Array(NS), Cy = new Float64Array(NS), Cz = new Float64Array(NS);
  let j = 0;
  for (let i = 0; i < NS; i++) {
    const s = i * ds;
    while (j < cum.length - 2 && cum[j + 1] < s) j++;
    const f = clamp((s - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j]), 0, 1);
    Cx[i] = raw[j][0] + (raw[j + 1][0] - raw[j][0]) * f;
    Cy[i] = raw[j][1] + (raw[j + 1][1] - raw[j][1]) * f;
    Cz[i] = raw[j][2] + (raw[j + 1][2] - raw[j][2]) * f;
  }
  // light smoothing of the centreline
  for (let pass = 0; pass < 3; pass++) for (const A of [Cx, Cy, Cz]) {
    const B = A.slice();
    for (let i = 2; i < NS - 2; i++) A[i] = (B[i - 2] + 4 * B[i - 1] + 6 * B[i] + 4 * B[i + 1] + B[i + 2]) / 16;
  }
  const sH = restLen;
  // tangents
  const Tx = new Float64Array(NS), Ty = new Float64Array(NS), Tz = new Float64Array(NS);
  for (let i = 0; i < NS; i++) {
    const a = Math.max(0, i - 1), b = Math.min(NS - 1, i + 1);
    const t = v3n([Cx[b] - Cx[a], Cy[b] - Cy[a], Cz[b] - Cz[a]]);
    Tx[i] = t[0]; Ty[i] = t[1]; Tz[i] = t[2];
  }
  // parallel-transported normal starting from the lemon's outward normal
  const p0 = [Cx[0], Cy[0], Cz[0]];
  const rx = p0[0] - LEM.c[0], ry = p0[1] - LEM.c[1], rz = p0[2] - LEM.c[2];
  const u0 = rx * LEM.d[0] + ry * LEM.d[1] + rz * LEM.d[2];
  let n0 = v3n([rx - u0 * LEM.d[0], ry - u0 * LEM.d[1], rz - u0 * LEM.d[2]]);
  const Nx = new Float64Array(NS), Ny = new Float64Array(NS), Nz = new Float64Array(NS);
  let n = n0;
  for (let i = 0; i < NS; i++) {
    const t = [Tx[i], Ty[i], Tz[i]];
    const k = dot3(n, t);
    n = v3n([n[0] - k * t[0], n[1] - k * t[1], n[2] - k * t[2]]);
    Nx[i] = n[0]; Ny[i] = n[1]; Nz[i] = n[2];
  }
  // twist (angle about T) needed to meet target normals at key places
  const twistTo = (i, tg) => {
    const t = [Tx[i], Ty[i], Tz[i]], nn = [Nx[i], Ny[i], Nz[i]];
    const k = dot3(tg, t); const g = v3n([tg[0] - k * t[0], tg[1] - k * t[1], tg[2] - k * t[2]]);
    return Math.atan2(dot3(cross3(nn, g), t), dot3(nn, g));
  };
  const idx = s => clamp(Math.round(s / ds), 0, NS - 1);
  // arc positions of the control points (approx: nearest centreline sample)
  const sOf = p => { let bi = 0, bd = 1e9; for (let i = 0; i < NS; i++) { const d = Math.hypot(Cx[i] - p[0], Cy[i] - p[1], Cz[i] - p[2]); if (d < bd) { bd = d; bi = i; } } return bi * ds; };
  const sQ2 = sOf(Q[2]), sQ4 = sOf(Q[4]), sQ6 = sOf(Q[6]);
  const keys = [];
  keys.push([0, 0]);
  keys.push([sQ2 - 0.2, twistTo(idx(sQ2 - 0.2), n0.slice())]);     // still pith-up as it leaves the lemon
  keys.push([sQ4, twistTo(idx(sQ4), [0, 1, 0])]);                   // a half twist: rind up on the plate
  keys.push([sQ6, twistTo(idx(sQ6), [0, 1, 0])]);
  // over the rim it bends freely; in the helix the rind faces outward
  for (let sp = 1.4; sp <= LH + 0.01; sp += 0.35) {
    const i = idx(sH + sp);
    const ax = Cx[i] - Xa, az = Cz[i] - Za, l = Math.hypot(ax, az) || 1;
    keys.push([sH + sp, twistTo(i, [ax / l, 0, az / l])]);
  }
  // unwrap: each key within pi of the previous, except the deliberate half twist
  for (let k = 1; k < keys.length; k++) {
    let a = keys[k][1];
    while (a - keys[k - 1][1] > Math.PI) a -= 2 * Math.PI;
    while (a - keys[k - 1][1] < -Math.PI) a += 2 * Math.PI;
    keys[k][1] = a;
  }
  const chi = new Float64Array(NS);
  for (let i = 0; i < NS; i++) {
    const s = i * ds;
    let v = keys[keys.length - 1][1];
    for (let k = 0; k < keys.length - 1; k++) {
      if (s <= keys[k + 1][0]) { const f = sm(keys[k][0], keys[k + 1][0], s); v = keys[k][1] + (keys[k + 1][1] - keys[k][1]) * f; break; }
    }
    if (s < keys[0][0]) v = keys[0][1];
    // a little irregular twist where it hangs
    const sp = s - sH;
    if (sp > 0) v += (0.16 * Math.sin(1.25 * sp + 0.5) + 0.09 * Math.sin(2.7 * sp + 1.7)) * sm(0.6, 2.5, sp);
    chi[i] = v;
  }
  for (let i = 0; i < NS; i++) {
    const t = [Tx[i], Ty[i], Tz[i]], nn = [Nx[i], Ny[i], Nz[i]], b = cross3(t, nn);
    const c = Math.cos(chi[i]), s = Math.sin(chi[i]);
    Nx[i] = nn[0] * c + b[0] * s; Ny[i] = nn[1] * c + b[1] * s; Nz[i] = nn[2] * c + b[2] * s;
  }
  // half width: irregular, tapering at the end; starts a little narrow
  const HW = new Float64Array(NS);
  for (let i = 0; i < NS; i++) {
    const s = i * ds;
    let w = 0.875 * (1 + 0.075 * Math.sin(0.9 * s + 0.3) + 0.055 * Math.sin(2.3 * s + 1.2) + 0.03 * Math.sin(5.3 * s + 0.4));
    w *= 1 - 0.82 * Math.pow(sm(Ltot - 2.6, Ltot, s), 1.2);
    w *= 0.8 + 0.2 * sm(0, 0.8, s);
    HW[i] = w;
  }
  Object.assign(PEEL, { ds, NS, Ltot, sH, Cx, Cy, Cz, Tx, Ty, Tz, Nx, Ny, Nz, HW, Rc: 1.7, th: 0.3, LH });
  // shadow casting centreline of the resting part
  const caps = [];
  for (let i = 0; i < NS && i * ds < sH - 0.6; i += 8) caps.push([Cx[i], Cy[i], Cz[i]]);
  PEEL_REST_CAPS = caps;
})();

// ---------------------------------------------------------------- motion
const LOOP = 10;
PEEL.angle = function (sp, t) {
  const lag = 0.06 * sp;                 // seconds: the lower turns follow late
  const ph = 2 * Math.PI * (t - lag) / LOOP;
  const deg = 4.0 * Math.sin(ph + 0.4) + 1.2 * Math.sin(2 * ph + 1.9) + 0.35 * Math.sin(3 * ph + 0.3);
  return deg * Math.PI / 180 * sm(0, 1.8, sp) * (0.55 + 0.45 * sm(0, 8, sp));
};
PEEL.sway = function (sp, t) {
  const a = 0.032 * sp * sm(0, 6, sp);
  return [a * Math.sin(2 * Math.PI * (t - 0.05 * sp) / LOOP + 1.2), a * 0.45 * Math.sin(2 * Math.PI * (t - 0.05 * sp) / LOOP + 2.6)];
};
// frame of sample i at time t (positions/normals/binormals rotated about the helix axis)
PEEL.frame = function (i, t, out) {
  const P = PEEL, sp = i * P.ds - P.sH;
  let cx = P.Cx[i], cy = P.Cy[i], cz = P.Cz[i];
  let tx = P.Tx[i], ty = P.Ty[i], tz = P.Tz[i], nx = P.Nx[i], ny = P.Ny[i], nz = P.Nz[i];
  if (sp > 0 && t !== null) {
    const a = P.angle(sp, t), ca = Math.cos(a), sa = Math.sin(a);
    const [Xa, Za] = P.axis;
    const x = cx - Xa, z = cz - Za;
    const sw = P.sway(sp, t);
    cx = Xa + x * ca - z * sa + sw[0]; cz = Za + x * sa + z * ca + sw[1];
    let q = tx * ca - tz * sa; tz = tx * sa + tz * ca; tx = q;
    q = nx * ca - nz * sa; nz = nx * sa + nz * ca; nx = q;
  }
  out[0] = cx; out[1] = cy; out[2] = cz; out[3] = tx; out[4] = ty; out[5] = tz; out[6] = nx; out[7] = ny; out[8] = nz;
  // binormal = T x N
  out[9] = ty * nz - tz * ny; out[10] = tz * nx - tx * nz; out[11] = tx * ny - ty * nx;
  return out;
};

// ---------------------------------------------------------------- painted surfaces
// texture space: u = s * TS texels, v in [0, TV-1] <-> w in [-1, 1]
const PT = {};
function rindLit(ndl, ny) {
  // the painter's value bands for lemon rind
  let c;
  if (ndl > 0) c = grad([[0, C(100, 78, 20)], [0.2, C(146, 118, 28)], [0.45, C(196, 160, 36)], [0.7, C(228, 190, 46)], [0.9, C(242, 208, 84)], [1, C(246, 220, 116)]], ndl);
  else c = grad([[-1, C(40, 31, 10)], [-0.3, C(56, 44, 13)], [0, C(100, 78, 20)]], ndl);
  const refl = sm(-0.1, -0.85, ny) * sm(0.15, -0.3, ndl);
  return mix(c, C(122, 106, 50), refl * 0.5);
}
function pithLit(ndl, ny) {
  let c;
  if (ndl > 0) c = grad([[0, C(112, 100, 72)], [0.25, C(166, 152, 112)], [0.55, C(212, 200, 162)], [0.85, C(238, 230, 200)], [1, C(246, 240, 216)]], ndl);
  else c = grad([[-1, C(42, 37, 25)], [-0.4, C(62, 55, 38)], [0, C(112, 100, 72)]], ndl);
  const refl = sm(-0.1, -0.85, ny) * sm(0.15, -0.3, ndl);
  return mix(c, C(128, 118, 88), refl * 0.4);
}
// rest-pose normal of the outer surface at (s, w)
function peelRestNormal(s, w) {
  const P = PEEL, i = clamp(Math.round(s / P.ds), 0, P.NS - 1);
  const f = PEEL.frame(i, null, new Float64Array(12));
  const phi = w * P.HW[i] / P.Rc;
  const c = Math.cos(phi), sn = Math.sin(phi);
  return [f[6] * c + f[9] * sn, f[7] * c + f[10] * sn, f[8] * c + f[11] * sn];
}
function texFill(T, colFn, TS, TV, seed) {
  for (let v = 0; v < T.H; v++) for (let u = 0; u < T.W; u++) {
    const c = colFn(u, v), i = v * T.W + u;
    T.r[i] = c[0]; T.g[i] = c[1]; T.b[i] = c[2];
    T.al[i] = 1;
    T.ht[i] = 0.12;
  }
}
function peelPaintTextures(S) {
  const TS = Math.max(24, Math.round(60 * S)), TV = Math.max(32, Math.round(96 * S));
  const TL = Math.ceil(PEEL.Ltot * TS) + 2;
  PT.TS = TS; PT.TV = TV; PT.TL = TL;
  const k = TV / 96; // stroke size scale in texels
  const mk = () => { const T = makeTarget(TL, TV, 1, true); T.weave.fill(0.5); return T; };
  const sw = (u, v) => [u / TS, v / (TV - 1) * 2 - 1];
  // ---- rind side
  reseed(7101);
  const out = mk(); setTarget(out);
  const outerCol = (u, v) => {
    const [s, w] = sw(u, v);
    const n = peelRestNormal(s, w);
    const ndl = dot3(n, LV);
    let c = rindLit(ndl, n[1]);
    // slight greenish cast in places, a riper patch, the white cut edge
    const g = fbm(u * 0.01 + 3, v * 0.05, 3);
    c = mix(c, mix(c, C(170, 160, 40), 0.5), sm(0.52, 0.72, g) * 0.45);
    const g2 = fbm(u * 0.006 + 8, v * 0.02 + 1, 3);
    c = mix(c, mulc(c, [1.03, 0.9, 0.7]), sm(0.55, 0.75, g2) * 0.5);   // riper, warmer
    c = scl(c, 0.92 + 0.16 * fbm(u * 0.03 + 4, v * 0.08, 2));
    return c;
  };
  texFill(out, outerCol, TS, TV, 3.1);
  for (let pass = 0; pass < 2; pass++) {
    const n = Math.round(TL / (pass ? 6 : 12));
    for (let q = 0; q < n; q++) {
      const u = rnd(-20, TL + 20), v = rnd(0.05, 0.95) * (TV - 1);
      const len = rnd(20, 54) * k * (pass ? 0.7 : 1), w = rnd(12, 24) * k * (pass ? 0.6 : 1);
      const P = seg(u - len / 2, v + gauss() * 3 * k, u + len / 2, v + gauss() * 3 * k, 1.5 * k, 4);
      stroke(P, { w, col: jit(outerCol(u, v), 0.02, pass ? 0.08 : 0.04), col2: jit(outerCol(u + len * 0.4, v), 0.025, 0.06), alpha: pass ? 0.45 : 0.6, prof: 'flat', thick: pass ? 0.4 : 0.28, dry: 0.4, bk: 0.5, wk: 0, soft: 0.45, rag: 0.4, lj: 0.07, ridge: 0.3, bs: 1.8 * k });
    }
    if (!pass) blendPass([0, 0, TL, TV], 3 * k, 0.45);
  }
  // pores: tiny dark and light dots
  for (let q = 0; q < TL * 0.9 * k; q++) {
    const u = rnd(0, TL), v = rnd(0.05, 0.95) * (TV - 1);
    const c = outerCol(u, v);
    dab(u, v, rnd(0.9, 1.6) * k, { col: scl(c, rnd(0.7, 0.82)), alpha: rnd(0.2, 0.42), thick: 0.05, flat: 0.3, dry: 0, bk: 0.3, wk: 0, soft: 0.6, el: 0.3 });
  }
  // ---- rind-side highlights (waxy): their own layer so they can breathe
  reseed(7202);
  const outH = mk(); setTarget(outH);
  for (let q = 0; q < TL * 0.3; q++) {
    const u = rnd(0, TL), v = rnd(0.12, 0.88) * (TV - 1);
    const [s, w] = sw(u, v);
    const n = peelRestNormal(s, w);
    const spec = Math.pow(Math.max(0, dot3(n, HV)), 18);
    if (spec < 0.25 || R() > spec) continue;
    const big = R() < 0.25;
    const len = (big ? rnd(10, 26) : rnd(3, 9)) * k;
    stroke(seg(u - len / 2, v, u + len / 2, v + gauss() * 1.5 * k, 0.6 * k, 3), { w: (big ? rnd(3, 6) : rnd(1.6, 3)) * k, col: jit(C(252, 246, 214), 0.02), alpha: rnd(0.5, 0.95) * Math.min(1, spec * 1.3), prof: 'lens', thick: big ? 1.4 : 0.8, dry: 0.5, bk: 0.6, wk: 0, soft: 0.45, rag: 0.4 });
  }
  // ---- pith side
  reseed(7303);
  const inn = mk(); setTarget(inn);
  const innerCol = (u, v) => {
    const [s, w] = sw(u, v);
    const n = peelRestNormal(s, w);
    const ni = [-n[0], -n[1], -n[2]];
    const ndl = dot3(ni, LV);
    let c = pithLit(ndl, ni[1]);
    // thin places let the yellow through; spongy unevenness
    const g = fbm(u * 0.02 + 11, v * 0.06 + 2, 3);
    c = mix(c, mix(c, C(232, 206, 96), 0.55), sm(0.5, 0.75, g) * 0.5);
    // inside of a helix sees less of the room
    const ao = s > PEEL.sH + 0.8 ? 0.8 : 1;
    return scl(c, ao);
  };
  texFill(inn, innerCol, TS, TV, 7.7);
  for (let pass = 0; pass < 2; pass++) {
    const n = Math.round(TL / (pass ? 6 : 12));
    for (let q = 0; q < n; q++) {
      const u = rnd(-20, TL + 20), v = rnd(0.05, 0.95) * (TV - 1);
      const len = rnd(24, 70) * k * (pass ? 0.6 : 1), w = rnd(10, 22) * k * (pass ? 0.6 : 1);
      stroke(seg(u - len / 2, v + gauss() * 2 * k, u + len / 2, v + gauss() * 2 * k, 2 * k, 4), { w, col: jit(innerCol(u, v), 0.012, 0.03), col2: jit(innerCol(u + len * 0.4, v), 0.02, 0.05), alpha: pass ? 0.45 : 0.6, prof: 'flat', thick: 0.35, dry: 0.45, bk: 0.55, wk: 0, soft: 0.45, rag: 0.45, lj: 0.1, ridge: 0.3, bs: 1.6 * k });
    }
    if (!pass) blendPass([0, 0, TL, TV], 3 * k, 0.4);
  }
  // fibrous dabs
  for (let q = 0; q < TL * 0.25; q++) {
    const u = rnd(0, TL), v = rnd(0.1, 0.9) * (TV - 1);
    const c = innerCol(u, v);
    stroke(seg(u, v, u + rnd(4, 12) * k, v + gauss() * 2 * k, 0.5, 3), { w: rnd(2, 4) * k, col: jit(scl(c, R() < 0.5 ? 1.05 : 0.92), 0.02), alpha: 0.35, prof: 'lens', thick: 0.5, dry: 0.5, bk: 0.6, wk: 0, soft: 0.5 });
  }
  PT.out = out; PT.outH = outH; PT.inn = inn;
  // ragged ends of the strip: alpha falls off at both ends
  for (const T of [out, inn]) {
    for (let v = 0; v < TV; v++) for (let u = 0; u < TL; u++) {
      const s = u / TS;
      const e = Math.min(sm(0.0, 0.25, s), 1 - sm(PEEL.Ltot - 0.12, PEEL.Ltot, s));
      T.al[v * TL + u] *= e;
    }
  }
}

// ---------------------------------------------------------------- per-frame raster
// Produces premultiplied colour, alpha and paint height for the strip inside a
// fixed rectangle of the canvas (canvas pixel coords, scale S).
const PR = {};
PEEL.prepareRaster = function (S, rect) {
  PR.S = S; PR.rect = rect;
  const SS = 2;
  PR.SS = SS;
  const w = rect[2] * SS, h = rect[3] * SS;
  PR.w = w; PR.h = h;
  PR.z = new Float32Array(w * h); PR.s = new Float32Array(w * h); PR.wv = new Float32Array(w * h); PR.id = new Uint8Array(w * h);
  const npx = rect[2] * rect[3];
  PR.cr = new Float32Array(npx); PR.cg = new Float32Array(npx); PR.cb = new Float32Array(npx); PR.ca = new Float32Array(npx); PR.ch = new Float32Array(npx);
  // mesh: samples along s (every ~0.07cm) and across w
  PR.step = Math.max(1, Math.round(0.07 / PEEL.ds));
  PR.ws = [-1, -0.67, -0.33, 0, 0.33, 0.67, 1];
};
// screen bounds of the strip over the whole loop (for the rect)
PEEL.bounds = function () {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const f = new Float64Array(12);
  for (let k = 0; k < 20; k++) {
    const t = k * LOOP / 20;
    for (let i = 0; i < PEEL.NS; i += 4) {
      PEEL.frame(i, t, f);
      for (const w of [-1, 1]) {
        const hw = PEEL.HW[i];
        const p = proj(f[0] + f[9] * hw * w, f[1] + f[10] * hw * w, f[2] + f[11] * hw * w);
        x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]);
      }
    }
  }
  return [x0 - 40, y0 - 40, x1 + 40, y1 + 40];
};

function texSample(T, u, v, out) {
  const TL = T.W, TV = T.H;
  u = clamp(u, 0, TL - 1.001); v = clamp(v, 0, TV - 1.001);
  const iu = u | 0, iv = v | 0, fu = u - iu, fv = v - iv;
  const i00 = iv * TL + iu, i10 = i00 + 1, i01 = i00 + TL, i11 = i01 + 1;
  const w00 = (1 - fu) * (1 - fv), w10 = fu * (1 - fv), w01 = (1 - fu) * fv, w11 = fu * fv;
  out[0] = T.r[i00] * w00 + T.r[i10] * w10 + T.r[i01] * w01 + T.r[i11] * w11;
  out[1] = T.g[i00] * w00 + T.g[i10] * w10 + T.g[i01] * w01 + T.g[i11] * w11;
  out[2] = T.b[i00] * w00 + T.b[i10] * w10 + T.b[i01] * w01 + T.b[i11] * w11;
  out[3] = T.al[i00] * w00 + T.al[i10] * w10 + T.al[i01] * w01 + T.al[i11] * w11;
  out[4] = T.ht[i00] * w00 + T.ht[i10] * w10 + T.ht[i01] * w01 + T.ht[i11] * w11;
}

PEEL.raster = function (t, fl) {
  const S = PR.S, SS = PR.SS, rect = PR.rect, W = PR.w, H = PR.h;
  const zb = PR.z, sb = PR.s, wb = PR.wv, ib = PR.id;
  zb.fill(-1e9); ib.fill(0);
  const P = PEEL, ws = PR.ws, nw = ws.length, step = PR.step;
  const ns = Math.floor((P.NS - 1) / step) + 1;
  // vertices for 4 surfaces: outer(1), inner(2), edge+(3), edge-(4)
  const nv = ns * nw;
  const VX = new Float32Array(nv * 2), VZ = new Float32Array(nv * 2), VY = new Float32Array(nv * 2); // [outer, inner]
  const LF = new Float32Array(nv * 2), SPf = new Float32Array(nv * 2);
  const EL = new Float32Array(ns * 2); // light factor for the two edges
  const f = new Float64Array(12);
  const sx0 = rect[0], sy0 = rect[1];
  const amb = 0.3, idf = fl.id, isf = fl.is;
  const fr = new Float64Array(12);
  for (let a = 0; a < ns; a++) {
    const i = Math.min(P.NS - 1, a * step);
    P.frame(i, t, f);
    P.frame(i, null, fr);
    const hw = P.HW[i], Rc = P.Rc, th2 = P.th * 0.5;
    for (let b = 0; b < nw; b++) {
      const phi = ws[b] * hw / Rc, c = Math.cos(phi), sn = Math.sin(phi);
      const nx = f[6] * c + f[9] * sn, ny = f[7] * c + f[10] * sn, nz = f[8] * c + f[11] * sn;
      const ox = f[9] * Rc * sn + f[6] * Rc * (c - 1), oy = f[10] * Rc * sn + f[7] * Rc * (c - 1), oz = f[11] * Rc * sn + f[8] * Rc * (c - 1);
      for (let side = 0; side < 2; side++) {
        const sg = side === 0 ? 1 : -1;
        const X = f[0] + ox + nx * th2 * sg, Y = f[1] + oy + ny * th2 * sg, Z = f[2] + oz + nz * th2 * sg;
        const p = proj(X, Y, Z);
        const k = (side * nv + a * nw + b);
        VX[k] = (p[0] * S - sx0) * SS; VY[k] = (p[1] * S - sy0) * SS; VZ[k] = Y * VV[1] + Z * VV[2];
        // light now vs. the rest pose the surface was painted in
        const n0x = fr[6] * c + fr[9] * sn, n0y = fr[7] * c + fr[10] * sn, n0z = fr[8] * c + fr[11] * sn;
        const dl = Math.max(0, sg * (nx * LV[0] + ny * LV[1] + nz * LV[2]));
        const d0 = Math.max(0, sg * (n0x * LV[0] + n0y * LV[1] + n0z * LV[2]));
        LF[k] = clamp((amb + idf * dl) / (amb + d0), 0.55, 1.6);
        const sp = Math.pow(Math.max(0, sg * (nx * HV[0] + ny * HV[1] + nz * HV[2])), 18);
        const s0 = Math.pow(Math.max(0, sg * (n0x * HV[0] + n0y * HV[1] + n0z * HV[2])), 18);
        SPf[k] = isf * clamp((sp + 0.04) / (s0 + 0.04), 0, 1.5);
      }
    }
    // edge light (normal across the width)
    for (let e = 0; e < 2; e++) {
      const sg = e === 0 ? 1 : -1;
      const phi = sg * hw / Rc, c = Math.cos(phi), sn = Math.sin(phi);
      const ex = sg * (f[9] * c - f[6] * sn), ey = sg * (f[10] * c - f[7] * sn), ez = sg * (f[11] * c - f[8] * sn);
      EL[a * 2 + e] = amb + idf * Math.max(0, ex * LV[0] + ey * LV[1] + ez * LV[2]);
    }
  }
  // rasteriser
  const tri = (ax, ay, az, as, aw, bx, by, bz, bs, bw, cx, cy, cz, cs, cw, sid) => {
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-6) return;
    let x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    let y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    const ia = 1 / area;
    for (let y = y0; y <= y1; y++) {
      const py = y + 0.5;
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) * ia;
        const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) * ia;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-5 || w1 < -1e-5 || w2 < -1e-5) continue;
        const z = w0 * az + w1 * bz + w2 * cz;
        const j = y * W + x;
        if (z <= zb[j]) continue;
        zb[j] = z; sb[j] = w0 * as + w1 * bs + w2 * cs; wb[j] = w0 * aw + w1 * bw + w2 * cw; ib[j] = sid;
      }
    }
  };
  for (let a = 0; a < ns - 1; a++) {
    const s0 = Math.min(P.NS - 1, a * step) * P.ds, s1 = Math.min(P.NS - 1, (a + 1) * step) * P.ds;
    for (let side = 0; side < 2; side++) {
      for (let b = 0; b < nw - 1; b++) {
        const k00 = side * nv + a * nw + b, k10 = side * nv + (a + 1) * nw + b, k01 = k00 + 1, k11 = k10 + 1;
        const w0 = ws[b], w1 = ws[b + 1];
        tri(VX[k00], VY[k00], VZ[k00], s0, w0, VX[k10], VY[k10], VZ[k10], s1, w0, VX[k11], VY[k11], VZ[k11], s1, w1, side + 1);
        tri(VX[k00], VY[k00], VZ[k00], s0, w0, VX[k11], VY[k11], VZ[k11], s1, w1, VX[k01], VY[k01], VZ[k01], s0, w1, side + 1);
      }
    }
    // the two cut edges (thickness); w carries 0 (rind) .. 1 (pith)
    for (let e = 0; e < 2; e++) {
      const b = e === 0 ? nw - 1 : 0;
      const o0 = a * nw + b, o1 = (a + 1) * nw + b, i0 = nv + o0, i1 = nv + o1;
      tri(VX[o0], VY[o0], VZ[o0], s0, 0, VX[o1], VY[o1], VZ[o1], s1, 0, VX[i1], VY[i1], VZ[i1], s1, 1, 3 + e);
      tri(VX[o0], VY[o0], VZ[o0], s0, 0, VX[i1], VY[i1], VZ[i1], s1, 1, VX[i0], VY[i0], VZ[i0], s0, 1, 3 + e);
    }
  }
  // resolve: shade each subsample from the painted surfaces
  const rw = rect[2], rh = rect[3];
  const cr = PR.cr, cg = PR.cg, cb = PR.cb, ca = PR.ca, ch = PR.ch;
  const TS = PT.TS, TV = PT.TV, TL = PT.TL;
  const tb = new Float64Array(5), th = new Float64Array(5);
  const inv = 1 / (SS * SS);
  const sstep = step * P.ds;
  const lfAt = (side, s, w) => {
    let a = s / sstep; a = clamp(a, 0, ns - 1.001); const ia = a | 0, fa = a - ia;
    let bb = (w + 1) / 2 * (nw - 1); bb = clamp(bb, 0, nw - 1.001); const ibb = bb | 0, fb = bb - ibb;
    const k = side * nv + ia * nw + ibb;
    const l = (LF[k] * (1 - fb) + LF[k + 1] * fb) * (1 - fa) + (LF[k + nw] * (1 - fb) + LF[k + nw + 1] * fb) * fa;
    const sp = (SPf[k] * (1 - fb) + SPf[k + 1] * fb) * (1 - fa) + (SPf[k + nw] * (1 - fb) + SPf[k + nw + 1] * fb) * fa;
    return [l, sp];
  };
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
    let r = 0, g = 0, b = 0, al = 0, hh = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const j = (y * SS + sy) * W + x * SS + sx;
      const id = ib[j]; if (!id) continue;
      const s = sb[j], w = wb[j];
      if (id <= 2) {
        const T = id === 1 ? PT.out : PT.inn;
        const u = s * TS, v = (w + 1) * 0.5 * (TV - 1);
        texSample(T, u, v, tb);
        const lf = lfAt(id - 1, s, w);
        let cr0 = tb[0] * lf[0], cg0 = tb[1] * lf[0], cb0 = tb[2] * lf[0];
        if (id === 1) {
          texSample(PT.outH, u, v, th);
          const ha = th[3] * Math.min(1, lf[1]);
          const boost = Math.max(0, lf[1] - 1) * 0.5;
          cr0 += (th[0] * (1 + boost) - cr0) * ha; cg0 += (th[1] * (1 + boost) - cg0) * ha; cb0 += (th[2] * (1 + boost) - cb0) * ha;
          tb[4] += th[4] * th[3];
        }
        const a = tb[3];
        r += cr0 * a; g += cg0 * a; b += cb0 * a; al += a; hh += tb[4] * a;
      } else {
        // cut edge: a little yellow rind over thick white pith
        const e = id - 3;
        let aa = s / sstep; aa = clamp(aa, 0, ns - 1.001); const ia = aa | 0, fa = aa - ia;
        const lf = EL[ia * 2 + e] * (1 - fa) + EL[(ia + 1) * 2 + e] * fa;
        const nz = vn(s * 9 + e * 30, w * 3);
        const cc = w < 0.3 ? C(206, 168, 40) : C(214, 202, 160);
        const k = (0.72 + 0.28 * lf) * (0.94 + 0.12 * nz);
        const fade = Math.min(sm(0, 0.25, s), 1 - sm(P.Ltot - 0.12, P.Ltot, s));
        r += cc[0] * k * fade; g += cc[1] * k * fade; b += cc[2] * k * fade; al += fade; hh += 0.3 * fade;
      }
    }
    const o = y * rw + x;
    cr[o] = r * inv; cg[o] = g * inv; cb[o] = b * inv; ca[o] = al * inv; ch[o] = hh * inv;
  }
  return PR;
};
