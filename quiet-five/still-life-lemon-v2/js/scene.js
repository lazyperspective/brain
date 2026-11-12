'use strict';
// ---------------------------------------------------------------------------
// Still Life with Lemon (v2) -- the painting, in the order a painter works:
// toned ground, wall, table, then the objects back to front, glazes, and
// finally the lead-white lights (kept on their own layer so the candle can
// make them breathe).
// ---------------------------------------------------------------------------
const SCN = {};
function mulc(a, b) { return [a[0] * b[0], a[1] * b[1], a[2] * b[2]]; }
function groundCol(x, y) { const t = fbm(x * 0.003, y * 0.003, 3); return C(104 + 14 * t, 80 + 10 * t, 54 + 8 * t); }

// ---------------------------------------------------------------- shadow map
// candle visibility on the receiving surfaces, sampled every 4 px
function buildShadowMap() {
  const g = 4, x0 = 0, y0 = Y_BACK - 8;
  const nx = Math.ceil(PW / g) + 2, ny = Math.ceil((PH - y0) / g) + 2;
  const V = new Float32Array(nx * ny), Gm = new Float32Array(nx * ny), Cm = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * g, y = y0 + j * g;
    let P = null, skip = null;
    const ph = (y > OY - 340 && y < OY + 200 && x > OX - 620 && x < OX + 620) ? plateHit(x, y) : null;
    if (ph) { P = [ph.X, ph.Y, ph.Z]; }
    else if (y <= Y_EDGE + 1) P = onPlaneY(x, y, TY);
    else P = onPlaneZ(x, y, TFZ);
    const s = shadowAt(P, skip);
    const k = j * nx + i; V[k] = s[0]; Gm[k] = s[1]; Cm[k] = s[2];
  }
  SCN.sm = { g, x0, y0, nx, ny, V, Gm, Cm };
}
function shadowLook(x, y) {
  const M = SCN.sm;
  let fx = (x - M.x0) / M.g, fy = (y - M.y0) / M.g;
  fx = clamp(fx, 0, M.nx - 1.001); fy = clamp(fy, 0, M.ny - 1.001);
  const i = fx | 0, j = fy | 0, ax = fx - i, ay = fy - j, k = j * M.nx + i;
  const bl = A => (A[k] * (1 - ax) + A[k + 1] * ax) * (1 - ay) + (A[k + M.nx] * (1 - ax) + A[k + M.nx + 1] * ax) * ay;
  return [bl(M.V), bl(M.Gm), bl(M.Cm)];
}

// ---------------------------------------------------------------- colour fields
function wallCol(x, y) {
  const gx = (x - 860) / 1000, gy = (y - 900) / 820;
  const gl = Math.exp(-(gx * gx + gy * gy) * 1.2);
  let c = grad([[0, C(20, 18, 14)], [0.3, C(34, 31, 25)], [0.55, C(55, 51, 40)], [0.8, C(82, 76, 58)], [1, C(106, 98, 76)]], gl);
  const ur = sm(-0.2, 1.0, (x / PW) * 0.95 - (y / PH) * 1.1 + 0.25);
  c = mix(c, C(17, 15, 12), ur * 0.55);
  const n = fbm(x / 380 + 1.3, y / 380 + 4.1, 4);
  c = scl(c, 0.9 + 0.2 * n);
  const t = fbm(x / 900 + 5, y / 700 + 3, 3);
  c = mix(c, [c[0] * 0.95, c[1] * 1.0, c[2] * 0.88], sm(0.45, 0.7, t) * 0.45);
  c = mix(c, [c[0] * 1.07, c[1] * 0.97, c[2] * 0.87], sm(0.5, 0.3, t) * 0.5);
  return c;
}
function tableCol(x, y) {
  const d = clamp((y - Y_BACK) / (Y_EDGE - Y_BACK), 0, 1);
  let c = grad([[0, C(46, 33, 22)], [0.15, C(42, 30, 20)], [0.55, C(35, 24, 15)], [1, C(28, 19, 12)]], d);
  // boards: a little wood colour variation, redder and more olive planks
  const pk = fbm(x / 520 + 3, y / 46 + 1, 3);
  c = mix(c, mulc(c, [1.1, 0.94, 0.82]), sm(0.5, 0.7, pk) * 0.6);
  c = mix(c, mulc(c, [0.94, 1.0, 0.9]), sm(0.45, 0.3, pk) * 0.5);
  const pool = Math.exp(-Math.pow((x - 760) / 760, 2) - Math.pow((y - (OY - 140)) / 320, 2));
  c = scl(c, (1.04 + 0.16 * (1 - x / PW) - 0.08) * (0.72 + 0.28 * Math.exp(-Math.pow((x - 1000) / 950, 2))) * (1 + 1.45 * pool));
  const sh = Math.exp(-Math.pow((x - 430) / 460, 2) - Math.pow((y - (Y_BACK + 70)) / 75, 2));
  c = mix(c, C(98, 78, 54), sh * 0.38);
  const g = fbm(x / 900 + 2 * fbm(x / 300, y / 40, 2), y / 6, 3);
  c = scl(c, 0.93 + 0.14 * g);
  const sv = shadowLook(x, y);
  const lit = sv[0] * (1 - sv[1]);
  c = mix(mulc(c, [0.44, 0.42, 0.44]), c, lit);
  c = mix(c, [c[0] + 0.55 * sv[2], c[1] + 0.40 * sv[2], c[2] + 0.12 * sv[2]], sv[0]);
  return c;
}
function apronCol(x, y) {
  const d = clamp((y - Y_EDGE) / (PH - Y_EDGE), 0, 1);
  let c = grad([[0, C(30, 20, 13)], [0.3, C(20, 14, 9)], [1, C(12, 9, 6)]], d);
  c = scl(c, 0.75 + 0.25 * Math.exp(-Math.pow((x - 1000) / 900, 2)));
  const sv = shadowLook(x, y);
  c = mix(mulc(c, [0.5, 0.48, 0.5]), c, sv[0] * (1 - sv[1]));
  const g = fbm(x / 700 + 2 * fbm(x / 250, y / 30, 2), y / 5, 3);
  c = scl(c, 0.9 + 0.2 * g);
  return c;
}

// pewter
const RFC = new Map();
function plateCol(x, y) {
  const dw = dwarp(x, y);
  const h = plateHit(x + dw[0], y + dw[1]); if (!h) return null;
  const fz = h.Z / (h.r || 1), fx = h.X / (h.r || 1);
  let c;
  if (h.zone === 'rim') {
    // far rim faces the lit wall: silvery; near rim mirrors the dark room
    const back = sm(0.45, -0.95, fz);
    c = grad([[0, C(62, 63, 59)], [0.35, C(96, 97, 91)], [0.7, C(140, 141, 132)], [1, C(158, 159, 148)]], back);
    let da = Math.atan2(fz, fx) + 2.2; da = Math.atan2(Math.sin(da), Math.cos(da));
    c = mix(c, C(206, 206, 192), Math.exp(-Math.pow(da / 0.7, 2)) * 0.8);
    c = scl(c, 1 + 0.14 * (-fx));
    const rr = (h.r - PL.rRim) / (plRout(h.phi) - PL.rRim);
    c = scl(c, 1 + 0.12 * Math.exp(-Math.pow(rr / 0.1, 2)) * sm(0.6, -0.4, fz) + 0.12 * sm(0.7, 1, rr) * sm(0, 0.8, fz));
  } else if (h.zone === 'lip') {
    c = mix(C(84, 84, 78), C(58, 57, 52), sm(0, 0.8, h.t));
    c = mix(c, C(84, 82, 74), sm(0.8, 1, h.t) * 0.6);
    c = scl(c, 1 + 0.15 * (-fx));
  } else if (h.zone === 'cone') {
    const tt = (h.r - PL.rIn) / (PL.rRim - PL.rIn);
    c = mix(C(48, 49, 46), C(92, 92, 86), sm(0.55, 1, tt));
    c = mix(c, C(40, 40, 38), sm(0.2, 0, tt) * 0.6);
    c = scl(c, 1 + 0.2 * (-fx));
  } else {
    const back = sm(0.5, -0.9, h.Z / PL.rIn);
    c = mix(C(72, 73, 68), C(108, 109, 101), back);
    c = scl(c, 1 + 0.14 * (-h.X / PL.rIn));
    c = mix(c, C(156, 156, 144), Math.exp(-Math.pow((h.X + 2.8) / 3.0, 2) - Math.pow((h.Z - 0.6) / 2.6, 2)) * 0.7);
    // the lemon's blurred, warm reflection in the dull metal (cached on a 6px grid)
    const ck = Math.floor(x / 6) * 10000 + Math.floor(y / 6);
    let rf = RFC.get(ck);
    if (rf === undefined) { rf = 0;
    for (let k = 0; k < 5; k++) {
      const dx = (k - 2) * 0.08, dz = (k % 2) * 0.06;
      const D = v3n([dx, SE, -CE + dz]);
      for (let t = 0.2; t < 9; t += 0.25) {
        const px = h.X + D[0] * t, py = D[1] * t, pz = h.Z + D[2] * t;
        if (py > 6) break;
        if (lemInside(px, py, pz)) { rf += Math.exp(-t * 0.18); break; }
      }
    }
    rf /= 5; RFC.set(ck, rf); }
    c = mix(c, C(156, 126, 44), Math.min(1, rf * 0.95));
  }
  // tarnish: soft darker clouds and a warm patina
  const tn = fbm(x / 90 + 2, y / 40 + 5, 4); c = scl(c, 1 - 0.12 * sm(0.55, 0.75, tn));
  const n = fbm(x / 140 + 7, y / 60 + 3, 4); c = scl(c, 0.92 + 0.16 * n);
  const p = fbm(x / 60 + 1, y / 26 + 9, 3); c = mix(c, mulc(c, [1.05, 0.98, 0.84]), sm(0.6, 0.8, p) * 0.5);
  const sv = shadowLook(x, y);
  // away from the light the metal goes cooler
  c = mix(c, mulc(c, [0.88, 0.94, 1.06]), sm(-0.1, 0.9, fx) * 0.55);
  c = mix(mulc(c, [0.38, 0.41, 0.46]), c, sv[0]);
  return c;
}

// lemon
function cutCol(h) {
  const r = h.rho, ps = h.th;
  let c;
  if (r > 0.86) {
    c = mix(C(238, 231, 204), C(212, 202, 166), sm(0.94, 1.0, r));
    c = mix(c, C(226, 216, 166), sm(0.9, 0.86, r) * 0.6);
  } else if (r < 0.15) {
    c = mix(C(236, 226, 190), C(232, 216, 156), sm(0.07, 0.15, r));
  } else {
    const nseg = 10;
    let a = (ps + 0.31) / (2 * Math.PI / nseg); const si = Math.floor(a); a -= si;
    const md = Math.min(a, 1 - a);
    const sv = hash2(((si % nseg) + nseg) % nseg, 7) - 0.5;
    c = mix(C(226, 172, 34), C(246, 210, 84), sm(0.03, 0.3, md) * sm(0.15, 0.42, r) * (1 - 0.4 * sm(0.66, 0.84, r)));
    c = scl(c, 1 + 0.06 * sv);
    c = mix(c, C(238, 224, 172), 1 - sm(0.01, 0.03, md));
    c = mix(c, C(234, 208, 112), sm(0.78, 0.86, r) * 0.5);
  }
  // translucent flesh glows more on the side toward the light
  const lx = Math.cos(ps) * 0.3 + Math.sin(ps) * -0.2;
  c = scl(c, 1 + 0.05 * lx);
  return c;
}
function lemonColHit(h) {
  if (h.cut) return cutCol(h);
  const n = h.N, ndl = dot3(n, LV);
  const peeled = h.u < lemUb(h.th);
  let c;
  if (peeled) {
    c = pithLit(ndl, n[1]);
    const g = fbm(h.u * 1.8 + 3, h.th * 2.6 + 1, 3);
    c = mix(c, mix(c, C(232, 206, 100), 0.5), sm(0.45, 0.75, g) * 0.55);
  } else {
    c = rindLit(ndl, n[1]);
    c = mix(c, mulc(c, [0.92, 0.98, 0.62]), sm(3.0, 4.6, h.u) * 0.45);
    const g = fbm(h.u * 1.3 + 9, h.th * 2.0 + 4, 3);
    c = scl(c, 0.95 + 0.1 * g);
  }
  return c;
}
function lemonColAt(x, y) { const h = lemonHit(x, y); return h ? lemonColHit(h) : null; }

// knife
function knifeSetup() {
  const pT = proj(...KN.tip), pB = proj(...KN.bol), pE = proj(...KN.end);
  const hs = (p, d) => [p[0] + d[0], p[1] + d[1]];
  // blade outline in world, then screen
  const blade = [];
  const n = 24;
  for (let i = 0; i <= n; i++) { // spine side, bolster -> tip
    const t = i / n;
    const w = KN.bw * 0.5 * (1 - 0.9 * sm(0.82, 1, t));
    const p = [KN.bol[0] + (KN.tip[0] - KN.bol[0]) * t + KN.perp[0] * w, KN.bol[1] + (KN.tip[1] - KN.bol[1]) * t + KN.perp[1] * w, KN.bol[2] + (KN.tip[2] - KN.bol[2]) * t + KN.perp[2] * w];
    blade.push(proj(...p));
  }
  for (let i = n; i >= 0; i--) { // edge side, tip -> bolster
    const t = i / n;
    const w = -KN.bw * 0.5 * (1 - Math.pow(t, 2.3));
    const p = [KN.bol[0] + (KN.tip[0] - KN.bol[0]) * t + KN.perp[0] * w, KN.bol[1] + (KN.tip[1] - KN.bol[1]) * t + KN.perp[1] * w, KN.bol[2] + (KN.tip[2] - KN.bol[2]) * t + KN.perp[2] * w];
    blade.push(proj(...p));
  }
  SCN.kn = { pT, pB, pE, blade };
  void hs;
  const hb = [KN.bol[0] + KN.hdir[0] * 0.45, KN.bol[1] + KN.hdir[1] * 0.45, KN.bol[2] + KN.hdir[2] * 0.45];
  SCN.kn.pH0 = proj(...hb);
  SCN.kn.pBol0 = proj(KN.bol[0] - KN.hdir[0] * 0.25, KN.bol[1], KN.bol[2] - KN.hdir[2] * 0.25);
}
function polyCov(poly) {
  const n = poly.length;
  return (x, y) => {
    let inside = false, md = 1e9;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
      const dx = xj - xi, dy = yj - yi, l2 = dx * dx + dy * dy;
      let t = ((x - xi) * dx + (y - yi) * dy) / (l2 || 1); t = clamp(t, 0, 1);
      md = Math.min(md, Math.hypot(x - xi - dx * t, y - yi - dy * t));
    }
    const sd = inside ? md : -md;
    return clamp(sd + 0.5, 0, 1);
  };
}
function capsCov(a, b, ra, rb, soft) {
  return (x, y) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    let t = ((x - a[0]) * dx + (y - a[1]) * dy) / l2; t = clamp(t, 0, 1);
    const d = Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t) - (ra + (rb - ra) * t);
    return clamp(0.5 - d / (soft || 1), 0, 1);
  };
}

// ---------------------------------------------------------------- painting
function paintScene(stage) {
  const T = E.T;
  stage = stage === undefined ? 99 : stage;
  knifeSetup();
  buildShadowMap();
  reseed(101);
  // ===== WALL: broad lay-in, blended body, dry scumbles in the light; thin in the darks
  const wallDir = (x, y) => { const h = hash2(Math.floor(x / 9), Math.floor(y / 9)); return (h < 0.55 ? -0.9 : h < 0.8 ? -1.4 : -0.35) + (vn(x / 500, y / 500) - 0.5) * 0.6 + gauss() * 0.12; };
  const glowAt = (x, y) => { const gx = (x - 860) / 1000, gy = (y - 900) / 820; return Math.exp(-(gx * gx + gy * gy) * 1.2); };
  const wallBox = [-120, -120, PW + 120, Y_BACK + 40];
  paintField(520, wallBox, wallCol, wallDir, { straight: true, curl: 0.6, len: [300, 700], w: [120, 220], cj: 0.015,
    s: { alpha: 0.8, thick: 0.05, dry: 0.35, bk: 0.35, wk: 0.6, soft: 0.7, rag: 0.5, flat: 0.5, mixv: 0.8, lf: 0.006, lj: 0.05, bs: 2.8 } });
  blendPass([0, 0, PW, Y_BACK + 20], 22, 0.45);
  paintField(1500, wallBox, wallCol, wallDir, { straight: true, curl: 0.6, len: [160, 420], w: [50, 110], cj: 0.014,
    s: { alpha: 0.42, thick: 0.1, dry: 0.45, bk: 0.4, wk: 0.55, soft: 0.6, rag: 0.5, flat: 0.6, mixv: 0.75, lf: 0.008, lj: 0.06 },
    sfn: (x, y, so) => { const g = glowAt(x, y); so.thick = 0.03 + 0.17 * g; so.alpha = 0.3 + 0.25 * g; so.wk = 0.7 - 0.35 * g; so.ridge = 0.25; so.bk = 0.3; } });
  blendPass([0, 0, PW, Y_BACK + 20], 8, 0.2);
  // dry scumbles of lighter paint in the glow, catching on the weave
  paintField(520, [150, 450, 1950, Y_BACK], (x, y) => scl(wallCol(x, y), 1.08), wallDir, { straight: true, len: [100, 260], w: [26, 60], cj: 0.02,
    place: (x, y) => glowAt(x, y) > 0.4,
    s: { alpha: 0.28, thick: 0.14, dry: 0.85, bk: 0.55, wk: 0.65, soft: 0.6, rag: 0.6, flat: 0.5, press: 0.85, lj: 0.06, ridge: 0.3 } });
  // broken colour, barely there: cooler grey-green and warmer umber
  paintField(220, [0, 0, PW, Y_BACK], (x, y) => mulc(wallCol(x, y), R() < 0.5 ? [0.92, 1.02, 0.96] : [1.07, 0.97, 0.86]), wallDir, { straight: true, len: [80, 220], w: [20, 46], cj: 0.01,
    s: { alpha: 0.22, thick: 0.08, dry: 0.6, bk: 0.6, wk: 0.6, soft: 0.6, rag: 0.6, press: 0.9, lj: 0.06 } });
  // thin dry drags of slightly warmer paint across the dark wall: the brush skipping over the weave
  paintField(900, [0, 0, PW, Y_BACK], (x, y) => mulc(wallCol(x, y), [1.12, 1.06, 0.95]), wallDir, { straight: true, curl: 0.7, len: [90, 260], w: [18, 44], cj: 0.02,
    s: { alpha: 0.22, thick: 0.06, dry: 0.9, bk: 0.75, wk: 0.8, soft: 0.6, rag: 0.6, press: 0.8, lj: 0.08, ridge: 0.2 } });
  glaze(PW + 100, -200, 1600, 1500, C(18, 16, 13), 0.5, 1.2, 'mix', null, 0.8);
  glaze(-200, -300, 1100, 900, C(22, 20, 16), 0.3, 1.4, 'mix', null, 0.8);
  if (stage < 2) return;

  // ===== TABLE
  reseed(202);
  const mTable = makeMask(T, [-10, Y_BACK - 10, PW + 10, Y_EDGE + 14], (x, y) => {
    const yb = Y_BACK + 1.5 * Math.sin(x / 140) + 1.0 * Math.sin(x / 37 + 1);
    return sm(yb - 3.5, yb + 3.5, y) * (1 - sm(Y_EDGE + 9, Y_EDGE + 11, y));
  });
  const tdir = (x, y) => (vn(x / 500, y / 60) - 0.5) * 0.06;
  const persp = (x, y) => 0.55 + 0.45 * clamp((y - Y_BACK) / (Y_EDGE - Y_BACK), 0, 1);
  mTable.box = [-10, Y_BACK - 10, PW + 10, Y_EDGE + 14];
  fillMask(mTable, tableCol, 1, 0.05);
  const tpool = (x, y) => Math.exp(-Math.pow((x - 760) / 760, 2) - Math.pow((y - (OY - 140)) / 320, 2));
  paintField(420, [-60, Y_BACK - 6, PW + 60, Y_EDGE + 6], tableCol, tdir, { straight: true, curl: 0.2, len: [160, 380], w: [44, 90], cj: 0.012, wscale: persp,
    s: { alpha: 0.85, thick: 0.1, dry: 0.25, bk: 0.3, wk: 0.5, soft: 0.55, rag: 0.4, flat: 0.7, mixv: 0.8, lj: 0.06, lf: 0.02, m: mTable } });
  blendPass([0, Y_BACK - 4, PW, Y_EDGE + 4], 7, 0.35, mTable);
  paintField(900, [-40, Y_BACK - 4, PW + 40, Y_EDGE + 4], tableCol, tdir, { straight: true, curl: 0.25, len: [70, 190], w: [18, 40], cj: 0.016, wscale: persp,
    s: { alpha: 0.5, thick: 0.16, dry: 0.4, bk: 0.4, wk: 0.45, soft: 0.5, rag: 0.4, flat: 0.7, mixv: 0.8, lj: 0.08, lf: 0.02, m: mTable },
    sfn: (x, y, so) => { const p = tpool(x, y); so.thick = 0.12 + 0.35 * p; so.alpha = 0.4 + 0.25 * p; } });
  // glazes: warm red-brown in the light, umber deepening away from it
  for (let k = 0; k < 10; k++) glaze(rnd(100, 2100), rnd(Y_BACK + 40, Y_EDGE - 30), rnd(150, 380), rnd(40, 110), R() < 0.5 ? C(120, 60, 30) : C(30, 22, 12), 0.12, 1.3, 'mix', mTable, 0.6);
  // the rounded front edge catching the light
  for (let x = -30; x < PW + 30; x += rnd(50, 150)) {
    const len = rnd(80, 260), y = Y_EDGE + 3 + gauss() * 1.2;
    if (R() < 0.3) continue;
    const P = seg(x, y + gauss() * 1.2, x + len, y + gauss() * 1.2, 1.6, 6);
    const sv = shadowLook(x + len / 2, Y_EDGE - 2);
    const lit = sv[0] * (1 - sv[1]);
    const pool = Math.exp(-Math.pow((x + len / 2 - 800) / 700, 2));
    const c = mix(C(30, 20, 12), C(120, 86, 52), lit * (0.2 + 0.8 * pool));
    stroke(P, { w: rnd(4, 8), col: jit(c, 0.03), col2: scl(c, 0.75), alpha: rnd(0.45, 0.75), prof: 'tail', thick: 0.3, dry: 0.6, bk: 0.7, wk: 0.35, soft: 0.45, rag: 0.5 });
  }
  // apron: dark, thin, the weave showing through
  const mApron = makeMask(T, [-10, Y_EDGE + 4, PW + 10, PH + 10], (x, y) => sm(Y_EDGE + 6, Y_EDGE + 9, y));
  fillMask(mApron, apronCol, 1, 0.03);
  paintField(700, [-60, Y_EDGE + 4, PW + 60, PH + 40], apronCol, tdir, { straight: true, curl: 0.1, len: [200, 520], w: [26, 60], cj: 0.015,
    s: { alpha: 0.85, thick: 0.05, dry: 0.5, bk: 0.6, wk: 0.8, soft: 0.45, rag: 0.4, flat: 0.6, m: mApron } });
  paintField(900, [-40, Y_EDGE + 4, PW + 40, PH + 20], apronCol, tdir, { straight: true, curl: 0.1, len: [100, 300], w: [12, 30], cj: 0.015,
    s: { alpha: 0.6, thick: 0.06, dry: 0.65, bk: 0.7, wk: 0.75, soft: 0.45, rag: 0.45, flat: 0.6, m: mApron } });
  blendPass([0, Y_EDGE + 4, PW, PH], 6, 0.5, mApron);
  glaze(1080, PH + 300, 1500, 700, C(10, 7, 5), 0.5, 1.0, 'mix', mApron, 0.9);
  if (stage < 3) return;

  // ===== ROEMER
  paintGlass(T);
  if (stage < 4) return;
  // ===== KNIFE (before the plate: its tip slips under the rim)
  paintKnife(T);
  if (stage < 5) return;
  // ===== PEWTER PLATE
  paintPlate(T);
  if (stage < 6) return;
  // ===== LEMON
  paintLemon(T);
  if (stage < 7) return;
  // ===== final glazes: unify, deepen the corners
  reseed(909);
  glaze(-150, PH + 150, 900, 900, C(8, 6, 4), 0.45, 1.3, 'mix', null, 0.9);
  glaze(PW + 150, PH + 150, 900, 900, C(8, 6, 4), 0.4, 1.3, 'mix', null, 0.9);
}

// ---------------------------------------------------------------- roemer
function paintGlass(T) {
  reseed(303);
  const gx = G.x;
  const inSil = (x, y) => { const dw = dwarp(x, y); const yy = y + dw[1] * 0.5, hw = gHalf(yy); return hw < 0 ? 0 : clamp(hw - Math.abs(x + dw[0] * 0.6 - gx) + 0.5, 0, 1); };
  const box = [gx - 275, G.rim - 50, gx + 275, G.base + 60];
  const mG = makeMask(T, box, inSil);
  const wr = gR(G.wine) * 0.985, wry = wr * gEr(G.wine);
  const inMen = (x, y) => { const dx = (x - gx) / wr, dy = (y - G.wine) / wry; return dx * dx + dy * dy <= 1; };
  const menBot = x => { const dx = (x - gx) / wr; return G.wine + wry * Math.sqrt(Math.max(0, 1 - dx * dx)); };
  const menTop = x => { const dx = (x - gx) / wr; return G.wine - wry * Math.sqrt(Math.max(0, 1 - dx * dx)); };
  const mEmpty = makeMask(T, box, (x, y) => (y < G.wine ? inSil(x, y) * sm(menTop(x) + 1, menTop(x) - 1, y) : 0));
  const mMen = makeMask(T, box, (x, y) => { const dx = (x - gx) / wr, dy = (y - G.wine) / wry; return clamp((1 - Math.sqrt(dx * dx + dy * dy)) * wry + 0.5, 0, 1); });
  const mWine = makeMask(T, box, (x, y) => (y >= G.wine - 2 && y < G.stemTop + 6 ? inSil(x, y) * sm(menBot(x) - 1, menBot(x) + 1, y) : 0));
  const mStem = makeMask(T, box, (x, y) => (y >= G.stemTop - 4 ? inSil(x, y) * sm(G.footTop + 3, G.footTop - 3, y) : 0));
  const mFoot = makeMask(T, box, (x, y) => inSil(x, y) * sm(G.footTop - 4, G.footTop + 2, y));
  SCN.mGlass = mG; SCN.mWine = mWine;
  // what the eye sees through it
  const emptyCol = (x, y) => {
    const e = Math.abs(x - gx) / gR(y);
    let c = pickB(gx + (x - gx) * 0.95, y + 4, 9);
    c = mulc(c, [0.96, 1.0, 0.93]);
    c = scl(c, 1 - 0.26 * sm(0.72, 1.0, e) + 0.02);
    return c;
  };
  const wineCol = (x, y) => {
    const r = gR(y), e = clamp((x - gx) / r, -1, 1);
    const v = clamp((y - G.wine) / (G.stemTop - G.wine), 0, 1);
    let c = grad([[-1, C(60, 58, 38)], [-0.6, C(90, 86, 56)], [0, C(116, 108, 70)], [0.5, C(146, 134, 84)], [0.82, C(170, 152, 92)], [1, C(104, 96, 58)]], e);
    c = mix(c, scl(c, 0.68), sm(0.55, 1, v) * 0.6);
    const bg = pickB(gx - (x - gx) * 0.55, y - 40, 14);
    c = mix(c, mulc(bg, [1.22, 1.18, 0.86]), 0.45);
    return c;
  };
  const menCol = (x, y) => {
    const dy = (y - G.wine) / wry, dx = (x - gx) / wr;
    let c = mix(C(146, 136, 96), C(118, 108, 70), sm(-1, 1, dy));
    c = mix(c, mulc(pickB(x, y - 60, 12), [1.15, 1.12, 0.9]), 0.35);
    c = scl(c, 1 + 0.12 * (-dx));
    return c;
  };
  const stemCol = (x, y) => {
    const r = gR(y), e = clamp((x - gx) / r, -1, 1);
    let c = grad([[-1, C(50, 54, 40)], [-0.6, C(74, 78, 58)], [0, C(98, 98, 72)], [0.55, C(124, 120, 84)], [0.85, C(110, 106, 76)], [1, C(60, 62, 44)]], e);
    const bg = pickB(gx - (x - gx) * 0.5, y, 10);
    c = mix(c, mulc(bg, [1.18, 1.2, 0.95]), 0.45);
    return c;
  };
  const footCol = (x, y) => {
    let c = pickB(gx + (x - gx) * 0.9, y + 10, 6);
    c = mix(mulc(c, [0.84, 0.92, 0.78]), C(92, 98, 72), 0.28);
    return c;
  };
  const curveDir = (x, y) => Math.PI / 2 + clamp((x - gx) / gR(y), -1, 1) * 0.35;
  const arcDir = er => (x, y) => { const e = clamp((x - gx) / gR(y), -0.95, 0.95); return Math.atan(-er * e / Math.sqrt(Math.max(0.12, 1 - e * e))) * -1; };
  // empty part of the bowl: the wall, a shade darker and greener, darker toward the edges
  paintField(300, [gx - 260, G.rim - 40, gx + 260, G.wine + 5], emptyCol, curveDir, { straight: true, curl: 0.2, len: [30, 90], w: [8, 18], cj: 0.015,
    s: { alpha: 0.45, thick: 0.05, dry: 0.3, bk: 0.3, wk: 0.4, soft: 0.6, rag: 0.4, flat: 0.6, lj: 0.05, m: mEmpty } });
  blendPass(box, 4, 0.5, mEmpty);
  // wine
  fillMask(mWine, wineCol, 1, 0.1);
  paintField(420, [gx - 260, G.wine - 10, gx + 260, G.stemTop + 6], wineCol, arcDir(0.2), { straight: true, curl: 0.25, len: [30, 90], w: [10, 20], cj: 0.01,
    s: { alpha: 0.5, thick: 0.14, dry: 0.3, bk: 0.35, wk: 0.25, soft: 0.55, rag: 0.35, flat: 0.7, lj: 0.05, m: mWine } });
  blendPass([gx - 260, G.wine - 10, gx + 260, G.stemTop + 6], 5, 0.5, mWine);
  paintField(200, [gx - 40, G.wine, gx + 260, G.stemTop], wineCol, arcDir(0.2), { straight: true, curl: 0.3, len: [20, 60], w: [6, 12], cj: 0.015,
    s: { alpha: 0.4, thick: 0.2, dry: 0.4, bk: 0.45, wk: 0.2, soft: 0.5, rag: 0.4, lj: 0.06, m: mWine } });
  // visible brushing in the wine, following the bowl, not blended away
  paintField(160, [gx - 260, G.wine + 10, gx + 260, G.stemTop - 20], (x, y) => scl(wineCol(x, y), rnd(0.95, 1.08)), arcDir(0.22), { straight: true, curl: 0.3, len: [40, 110], w: [14, 26], cj: 0.02,
    s: { alpha: 0.32, thick: 0.35, dry: 0.5, bk: 0.5, wk: 0.1, soft: 0.5, rag: 0.4, lj: 0.08, m: mWine } });
  // luminous glow where the light comes through on the shadow side
  glaze(gx + 0.58 * gR(G.wine + 110), G.wine + 110, 80, 130, C(255, 214, 120), 0.26, 1.6, 'add', mWine, 0.2);
  // surface of the wine
  fillMask(mMen, menCol, 1, 0.1);
  paintField(60, [gx - 260, G.wine - wry - 4, gx + 260, G.wine + wry + 4], menCol, () => gauss() * 0.03, { straight: true, curl: 0.1, len: [60, 140], w: [10, 18], cj: 0.006,
    s: { alpha: 0.4, thick: 0.12, dry: 0.2, bk: 0.2, wk: 0.1, soft: 0.6, rag: 0.3, lj: 0.03, m: mMen } });
  blendPass([gx - 260, G.wine - wry - 4, gx + 260, G.wine + wry + 4], 4, 0.5, mMen);
  // stem (hollow, filled with wine)
  fillMask(mStem, stemCol, 1, 0.1);
  paintField(220, [gx - 110, G.stemTop - 6, gx + 110, G.footTop + 6], stemCol, () => Math.PI / 2 + gauss() * 0.05, { straight: true, curl: 0.15, len: [24, 60], w: [8, 16], cj: 0.008,
    s: { alpha: 0.3, thick: 0.15, dry: 0.25, bk: 0.25, wk: 0.25, soft: 0.65, rag: 0.35, lj: 0.04, m: mStem } });
  blendPass([gx - 110, G.stemTop - 6, gx + 110, G.footTop + 6], 4, 0.5, mStem);
  // foot
  paintField(140, [gx - 170, G.footTop - 6, gx + 170, G.base + 50], footCol, () => gauss() * 0.06, { straight: true, curl: 0.2, len: [30, 80], w: [6, 12], cj: 0.015,
    s: { alpha: 0.7, thick: 0.08, dry: 0.3, bk: 0.4, wk: 0.35, soft: 0.45, rag: 0.4, m: mFoot } });
  // foot: the coiled thread catches the light in broken touches, nothing drawn round it
  for (let k = 0; k < 5; k++) {
    const y = G.footTop + 12 + k * 16 + gauss() * 2, rx = gR(y) + 1, ry = rx * gEr(y);
    const pts = [];
    for (let a = 0.15; a <= Math.PI - 0.15; a += 0.06) pts.push(gx + rx * Math.cos(a), y + ry * Math.sin(a) - 3);
    const segN = pts.length >> 1;
    for (let i0 = 0; i0 < segN - 2;) {
      const i1 = Math.min(segN - 1, i0 + 2 + (R() * 5 | 0));
      const lit = sm(0.3, 0.9, (pts[2 * i0] - (gx - rx)) / (2 * rx)) < 0.6;  // left side, toward the light
      if (R() < (lit ? 0.6 : 0.25)) stroke(pts.slice(2 * i0, 2 * i1 + 2), { w: rnd(2.2, 3.4), col: jit(C(176, 178, 150), 0.03), alpha: rnd(0.25, 0.5), prof: 'lens', thick: 0.5, dry: 0.5, bk: 0.6, wk: 0.2, soft: 0.5, m: mFoot });
      i0 = i1 + 1 + (R() * 3 | 0);
    }
  }
  // the foot's shadow and contact on the table: a soft mass, not a line
  {
    const y = G.base, rx = gR(y), ry = rx * gEr(y), ptsD = [];
    for (let a = 0.1; a <= Math.PI - 0.1; a += 0.05) ptsD.push(gx + rx * 1.02 * Math.cos(a) + 10, y + ry * Math.sin(a) + 6);
    stroke(ptsD, { w: 22, col: C(24, 17, 11), alpha: 0.32, prof: 'lens', thick: 0.02, dry: 0.3, bk: 0.3, wk: 0.4, soft: 0.95 });
  }
  // where the stem sits in the foot, and the collar under the bowl: thicker glass, a shade deeper
  for (const [y, rx0] of [[G.footTop + 2, gR(G.footTop) + 6], [G.stemTop + 2, gR(G.stemTop) + 12]]) {
    const ry = rx0 * gEr(y), P = [];
    for (let a = 0.1; a <= Math.PI - 0.1; a += 0.05) P.push(gx + rx0 * 0.97 * Math.cos(a), y + ry * Math.sin(a));
    const cc = scl(stemCol(gx + 10, y + 4), 0.82);
    stroke(P, { w: 14, col: cc, col2: scl(cc, 1.15), alpha: 0.55, prof: 'lens', thick: 0.45, dry: 0.3, bk: 0.3, wk: 0.1, soft: 0.75 });
  }
  // prunts: pale green drops, irregularly set, mostly transparent
  SCN.prunts = [];
  reseed(3131);
  const rows = [[G.stemTop + 66, [-62, 2, 60]], [G.stemTop + 156, [-88, -30, 34, 86]], [G.stemTop + 248, [-58, 4, 66]]];
  for (const [ry0, angs] of rows) for (const ad0 of angs) {
    const ad = ad0 + gauss() * 9;
    const a = ad * Math.PI / 180;
    const yy = ry0 + gauss() * 8;
    const rr = gR(yy) + 5;
    const px = gx + rr * Math.sin(a), py = yy + gR(yy) * gEr(yy) * Math.cos(a);
    const fs = 0.42 + 0.58 * Math.cos(a), sz = rnd(0.85, 1.15);
    const rx = (34 * fs + 4) * sz, ry = 32 * sz;
    SCN.prunts.push([px, py, rx, ry, a]);
    // the wine and wall behind, pulled a little by the drop
    const under = pickB(px - (px - gx) * 0.18, py + 5, 4);
    // shadow side first (lower right), then the lit body over it, offset toward the light
    dab(px + rx * 0.16, py + ry * 0.16, rx * 0.95, { col: mulc(under, [0.46, 0.52, 0.38]), alpha: 0.62, thick: 0.4, dry: 0.1, bk: 0.12, lj: 0.03, wk: 0, soft: 0.75, rag: 0.1 }, Math.PI / 2);
    const bodyC = mix(mulc(under, [1.12, 1.18, 1.0]), C(166, 176, 136), 0.22);
    dab(px - rx * 0.08, py - ry * 0.08, rx * 0.8, { col: bodyC, col2: scl(bodyC, 0.94), alpha: 0.62, thick: 0.7, dry: 0.05, bk: 0.1, lj: 0.03, wk: 0, soft: 0.75, rag: 0.1 }, Math.PI / 2);
    // light gathered inside the drop, opposite the source
    dab(px + rx * 0.28, py + ry * 0.3, rx * 0.32, { col: C(214, 206, 140), alpha: 0.28, thick: 0.4, dry: 0.3, bk: 0.3, wk: 0, soft: 0.95, el: 0.3 }, 0.6);
  }
  // light transmitted through the wine gathers along the shadow side of the bowl: a soft golden mass
  for (let y = G.wine + 40; y < G.stemTop - 40; y += 34) glaze(gx + 0.78 * gR(y), y, 34, 52, C(255, 214, 120), 0.14, 1.4, 'add', mWine, 0.1);
  // the far rim: a faint light, broken
  {
    const y = G.rim, rx = gR(y), ry = rx * gEr(y);
    const back = [];
    for (let a = Math.PI + 0.25; a <= 2 * Math.PI - 0.25; a += 0.04) back.push(gx + rx * 0.99 * Math.cos(a), y + ry * Math.sin(a));
    const n = back.length >> 1;
    for (let i0 = 0; i0 < n - 2;) { const i1 = Math.min(n - 1, i0 + 4 + (R() * 8 | 0)); if (R() < 0.6) stroke(back.slice(2 * i0, 2 * i1 + 2), { w: 2.6, col: C(150, 152, 128), alpha: 0.35, prof: 'lens', thick: 0.3, dry: 0.5, bk: 0.6, wk: 0.2, soft: 0.5 }); i0 = i1 + 2; }
  }
}

// ---------------------------------------------------------------- knife
function paintKnife(T) {
  reseed(404);
  const K0 = SCN.kn;
  const blade = K0.blade;
  let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
  for (const p of blade) { bx0 = Math.min(bx0, p[0]); by0 = Math.min(by0, p[1]); bx1 = Math.max(bx1, p[0]); by1 = Math.max(by1, p[1]); }
  const mBlade = makeMask(T, [bx0 - 4, by0 - 4, bx1 + 4, by1 + 4], polyCov(blade));
  const pB = K0.pB, pT = K0.pT, pE = K0.pE;
  const ax = pT[0] - pB[0], ay = pT[1] - pB[1], al = Math.hypot(ax, ay);
  const bdir = Math.atan2(ay, ax);
  // blade: dull steel reflecting the room, a dark band along the edge half
  const pperp = proj(KN.bol[0] + KN.perp[0], KN.bol[1], KN.bol[2] + KN.perp[2]);
  const px = pperp[0] - pB[0], py = pperp[1] - pB[1], pl = Math.hypot(px, py);
  const bladeCol = (x, y) => {
    const t = clamp(((x - pB[0]) * ax + (y - pB[1]) * ay) / (al * al), 0, 1);
    const c0 = ((x - pB[0]) * px + (y - pB[1]) * py) / (pl * pl) / (KN.bw * 0.5); // +1 spine, -1 edge
    let c = mix(C(62, 64, 62), C(104, 106, 100), sm(-0.4, 0.7, c0));
    c = mix(c, C(40, 42, 42), Math.exp(-Math.pow((c0 + 0.25) / 0.25, 2)) * 0.6);
    c = scl(c, 1 + 0.12 * (1 - t));
    const P = onPlaneY(x, y, -0.25);
    const sv = shadowAt(P, 'knife');
    return mix(scl(c, 0.45), c, sv[0]);
  };
  fillMask(mBlade, bladeCol, 1, 0.15);
  paintField(120, [bx0, by0, bx1, by1], bladeCol, () => bdir + gauss() * 0.03, { straight: true, curl: 0.05, len: [40, 140], w: [6, 12], cj: 0.012,
    s: { alpha: 0.5, thick: 0.25, dry: 0.2, bk: 0.35, wk: 0.15, soft: 0.45, rag: 0.25, flat: 0.8, lj: 0.05, m: mBlade } });
  // bolster: short dark iron collar
  {
    const a = K0.pBol0, b = K0.pH0, r = KN.hr * K * 1.1;
    const mB = makeMask(T, [Math.min(a[0], b[0]) - r - 4, Math.min(a[1], b[1]) - r - 4, Math.max(a[0], b[0]) + r + 4, Math.max(a[1], b[1]) + r + 4], capsCov(a, b, r * 0.92, r, 0.8));
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
    for (let k = -4; k <= 4; k++) {
      const o = k / 4.5 * r;
      const lit = sm(0.8, -0.8, k / 4);
      const c = mix(C(34, 32, 28), C(110, 104, 88), lit * lit);
      stroke([a[0] + nx * o - dx * 0.1, a[1] + ny * o - dy * 0.1, b[0] + nx * o + dx * 0.1, b[1] + ny * o + dy * 0.1], { w: r * 0.32, col: jit(c, 0.02), alpha: 0.95, prof: 'flat', thick: 0.4, dry: 0.2, bk: 0.4, wk: 0.1, soft: 0.35, m: mB });
    }
  }
  // bone handle: a cylinder, lit from upper left, yellowed ivory
  {
    const a = K0.pH0, b = pE, r0 = KN.hr * K * 0.84, r1 = KN.hr * K * 1.04;
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
    const mH = makeMask(T, [Math.min(a[0], b[0]) - r1 - 6, Math.min(a[1], b[1]) - r1 - 6, Math.max(a[0], b[0]) + r1 + 6, Math.max(a[1], b[1]) + r1 + 6], capsCov(a, b, r0, r1, 0.9));
    SCN.mHandle = mH;
    // which side of the axis faces the light? (screen normal pointing up-left)
    const sgn = (nx * -0.6 + ny * -0.8) > 0 ? 1 : -1;
    const boneCol = (x, y) => {
      const t = clamp(((x - a[0]) * ux + (y - a[1]) * uy) / l, 0, 1);
      const r = r0 + (r1 - r0) * t;
      const c = clamp(((x - a[0]) * nx + (y - a[1]) * ny) * sgn / r, -1, 1); // +1 toward light
      const ndl = 0.15 + 0.85 * c;
      let col = grad([[-1, C(70, 58, 40)], [-0.55, C(92, 78, 54)], [-0.1, C(150, 132, 96)], [0.35, C(186, 168, 128)], [0.75, C(210, 194, 156)], [1, C(196, 182, 144)]], ndl);
      col = mix(col, C(120, 106, 80), sm(-0.6, -1, c) * 0.35);
      const g = fbm(t * 9 + 3, c * 2, 3);
      col = scl(col, 0.9 + 0.18 * g);
      col = mix(col, mulc(col, [0.95, 0.88, 0.7]), sm(0.4, 1, t) * 0.5);
      const sv = shadowAt(onPlaneY(x, y, TY + KN.hr), 'knife');
      return mix(scl(col, 0.55), col, 0.4 + 0.6 * sv[0]);
    };
    const hdir = Math.atan2(uy, ux);
    fillMask(mH, boneCol, 1, 0.2);
    paintField(160, [Math.min(a[0], b[0]) - r1, Math.min(a[1], b[1]) - r1, Math.max(a[0], b[0]) + r1, Math.max(a[1], b[1]) + r1], boneCol, () => hdir + gauss() * 0.03, { straight: true, curl: 0.06, len: [90, 220], w: [12, 22], cj: 0.01, place: (x, y) => maskAt(mH, x, y) > 0.6,
      s: { alpha: 0.55, thick: 0.4, dry: 0.15, bk: 0.4, wk: 0.1, soft: 0.5, rag: 0.3, flat: 0.75, lj: 0.06, prof: 'lens', m: mH } });
    blendPass([Math.min(a[0], b[0]) - r1, Math.min(a[1], b[1]) - r1, Math.max(a[0], b[0]) + r1, Math.max(a[1], b[1]) + r1], 3, 0.4, mH);
    // grain and age lines
    for (let k = 0; k < 14; k++) {
      const o = rnd(-0.8, 0.8) * r0, t0 = rnd(0, 0.7), t1 = t0 + rnd(0.1, 0.3);
      stroke(seg(a[0] + ux * l * t0 + nx * o, a[1] + uy * l * t0 + ny * o, a[0] + ux * l * t1 + nx * o, a[1] + uy * l * t1 + ny * o, 1, 5), { w: rnd(1.2, 2.2), col: C(96, 80, 56), alpha: rnd(0.15, 0.3), prof: 'lens', thick: 0.1, dry: 0.5, bk: 0.6, wk: 0.1, soft: 0.5, m: mH });
    }
    // a few fuller strokes along the lit top of the bone
    for (let k = 0; k < 9; k++) {
      const t0 = rnd(0.02, 0.7), t1 = Math.min(0.97, t0 + rnd(0.12, 0.3)), o = rnd(0.1, 0.6) * r0 * (sgn > 0 ? 1 : -1) * -1;
      const cc = boneCol(a[0] + ux * l * (t0 + t1) / 2 - nx * o, a[1] + uy * l * (t0 + t1) / 2 - ny * o);
      stroke(seg(a[0] + ux * l * t0 - nx * o, a[1] + uy * l * t0 - ny * o, a[0] + ux * l * t1 - nx * o, a[1] + uy * l * t1 - ny * o, 1, 5), { w: rnd(9, 16), col: jit(scl(cc, rnd(1.0, 1.08)), 0.02), alpha: 0.45, prof: 'lens', thick: 0.7, dry: 0.5, bk: 0.6, wk: 0.05, soft: 0.45, rag: 0.4, lj: 0.08, m: mH });
    }
    // two iron pins through the scales, and old grime toward the end
    for (const t of [0.3, 0.68]) {
      const px = a[0] + ux * l * t, py = a[1] + uy * l * t;
      dab(px + 1, py + 1, 4.2, { col: C(40, 34, 26), alpha: 0.7, thick: 0.3, dry: 0.1, bk: 0.3, wk: 0, soft: 0.5, el: 0.3, m: mH });
      dab(px - 1, py - 1.5, 1.6, { col: C(170, 160, 130), alpha: 0.6, thick: 0.6, dry: 0.1, bk: 0.3, wk: 0, soft: 0.5, el: 0.3, m: mH });
    }
    glaze(b[0] - ux * 30, b[1] - uy * 30, 70, 50, C(110, 92, 60), 0.35, 1.2, 'mix', mH, 0.2);
    // the end of the handle: rounded cap, a touch darker
    stroke(seg(b[0] - ux * 6, b[1] - uy * 6, b[0] + ux * 2, b[1] + uy * 2, 0, 2), { w: r1 * 1.9, col: C(150, 132, 96), alpha: 0.3, prof: 'round', thick: 0.2, dry: 0.3, bk: 0.4, wk: 0.1, soft: 0.6, m: mH });
  }
}

// ---------------------------------------------------------------- plate
function paintPlate(T) {
  reseed(505);
  const box = [OX - PL.rOut * K * 1.03 - 6, OY - K * (PL.rOut * SE + PL.hRim * CE) - 8, OX + PL.rOut * K * 1.03 + 6, OY + K * (PL.rOut * SE * 1.03) + 10];
  SCN.plBox = box;
  const S = T.S;
  // 2x2 supersampled coverage
  const mP = makeMask(T, box, (x, y) => {
    let c = 0; const o = 0.25 / S;
    const dw = dwarp(x, y);
    for (const dx of [-o, o]) for (const dy of [-o, o]) if (plateHit(x + dx + dw[0], y + dy + dw[1])) c++;
    return c / 4;
  });
  softenMask(mP, box, 7, (x, y) => sm(0.2, 0.95, (x - OX) / (PL.rOut * K)) * 0.9);
  SCN.mPlate = mP;
  const ecx = OX, ecy = OY - K * PL.hRim * CE;
  const tdir = (x, y) => { const dx = x - ecx, dy = (y - ecy) / SE; return Math.atan2(SE * dx, -dy) + gauss() * 0.05; };
  const pc = (x, y) => plateCol(x, y) || C(70, 70, 64);
  fillMask(mP, (x, y) => plateCol(x, y), 1, 0.1);
  // zone masks so strokes stay within the rim, the well's slope and the floor
  const zoneOf = (x, y) => { const dw = dwarp(x, y); const h = plateHit(x + dw[0], y + dw[1]); return h ? h.zone : null; };
  const zm = {};
  for (const z of ['rim', 'cone', 'floor', 'lip']) zm[z] = new Uint8Array(T.N);
  {
    const x0 = Math.max(0, Math.floor(box[0] * S)), y0 = Math.max(0, Math.floor(box[1] * S)), x1 = Math.min(T.W - 1, Math.ceil(box[2] * S)), y1 = Math.min(T.H - 1, Math.ceil(box[3] * S));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * T.W + x; if (!mP[i]) continue;
      const z = zoneOf((x + 0.5) / S, (y + 0.5) / S); if (z) zm[z][i] = mP[i];
    }
    for (const z in zm) { zm[z].box = box; softenMask(zm[z], box, 1.5, () => 1); }
  }
  for (const z of ['floor', 'cone', 'rim', 'lip']) {
    const mz = zm[z];
    const big = z === 'floor';
    paintField(big ? 260 : 380, box, pc, tdir, { straight: true, curl: 0.4, len: big ? [60, 170] : [40, 130], w: big ? [16, 34] : [8, 18], cj: 0.008, place: (x, y) => maskAt(mz, x, y) > 0.5,
      s: { alpha: 0.55, thick: 0.16, dry: 0.3, bk: 0.4, wk: 0.25, soft: 0.55, rag: 0.3, flat: 0.75, mixv: 0.7, lj: 0.05, ridge: 0.3, m: mz } });
    paintField(big ? 500 : 650, box, pc, tdir, { straight: true, curl: 0.5, len: [24, 80], w: [6, 13], cj: 0.012, place: (x, y) => maskAt(mz, x, y) > 0.5,
      s: { alpha: 0.4, thick: 0.25, dry: 0.45, bk: 0.5, wk: 0.2, soft: 0.5, rag: 0.35, flat: 0.75, mixv: 0.7, lj: 0.07, ridge: 0.35, m: mz } });
  }
  blendPass(box, 3, 0.35, mP);
  // the broad sheen, laid on with a loaded brush where the light strikes
  {
    const lum = (x, y) => { const c = plateCol(x, y); return c ? lumc(c) : 0; };
    for (const z of ['rim', 'floor']) paintField(z === 'rim' ? 260 : 160, box, (x, y) => scl(pc(x, y), 1.07), tdir, { straight: true, curl: 0.4, len: [40, 120], w: [12, 28], cj: 0.02,
      place: (x, y) => maskAt(zm[z], x, y) > 0.6 && lum(x, y) > 0.45,
      s: { alpha: 0.45, thick: 0.55, dry: 0.5, bk: 0.55, wk: 0.1, soft: 0.5, rag: 0.4, flat: 0.7, lj: 0.08, m: zm[z] } });
  }
  // ellipse helpers (screen) for rim lines
  const ell = (r, h, a0, a1, jitR) => {
    const P = [];
    for (let a = a0; a <= a1; a += 0.012) {
      const rr = r * (r > PL.rRim + 0.5 ? plRout(a) / PL.rOut : 1) + (jitR ? (vn(a * 6, r) - 0.5) * jitR : 0);
      const p = proj(rr * Math.cos(a), h, rr * Math.sin(a)); P.push(p[0], p[1]);
    }
    return P;
  };
  const broken = (P, o, keep) => {
    const n = P.length >> 1;
    for (let i0 = 0; i0 < n - 1;) {
      const i1 = Math.min(n - 1, i0 + 6 + (R() * 22 | 0));
      if (R() < keep) stroke(P.slice(2 * i0, 2 * i1 + 2), Object.assign({}, o, { alpha: o.alpha * rnd(0.7, 1.05), col: jit(o.col, 0.02) }));
      i0 = i1 + (R() < 0.3 ? 2 : 0);
    }
  };
  // dents: two soft, slightly lighter/darker swellings in the rim
  for (const [a, k] of [[2.9, 1], [0.9, -1], [-0.6, 1]]) {
    const p = proj(9.35 * Math.cos(a), PL.hRim, 9.35 * Math.sin(a));
    stroke(seg(p[0] - 30, p[1] + gauss(), p[0] + 30, p[1] + gauss(), 1, 4), { w: 16, col: k > 0 ? C(170, 170, 156) : C(66, 66, 60), alpha: 0.18, prof: 'lens', thick: 0.1, dry: 0.4, bk: 0.5, wk: 0.2, soft: 0.8, m: mP });
  }
  // tarnish: a few warm, cloudy glazes
  for (let k = 0; k < 9; k++) {
    const x = rnd(box[0] + 80, box[2] - 80), y = rnd(box[1] + 40, box[3] - 30);
    glaze(x, y, rnd(40, 120), rnd(14, 36), C(108, 92, 60), 0.12, 1.4, 'mix', mP, 0.3);
  }
}

// blur a mask where softFn(x,y) says the edge should be lost
function softenMask(M, box, radScene, softFn) {
  const T = E.T, S = T.S, W = T.W;
  const x0 = Math.max(1, Math.floor(box[0] * S)), y0 = Math.max(1, Math.floor(box[1] * S)), x1 = Math.min(T.W - 2, Math.ceil(box[2] * S)), y1 = Math.min(T.H - 2, Math.ceil(box[3] * S));
  const rad = Math.max(1, Math.round(radScene * S));
  const src = M.slice();
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const o = src[y * W + x];
    const f = softFn(x / S, y / S); if (f <= 0.01) continue;
    let sum = 0, n = 0;
    for (let dy = -rad; dy <= rad; dy++) { const yy = clamp(y + dy, 0, T.H - 1); for (let dx = -rad; dx <= rad; dx++) { sum += src[yy * W + clamp(x + dx, 0, W - 1)]; n++; } }
    M[y * W + x] = Math.round(o + (sum / n - o) * f);
  }
}
// ---------------------------------------------------------------- lemon
function buildLemonCache(T) {
  const S = T.S, c = proj(...LEM.c);
  const box = [c[0] - 460, c[1] - 330, c[0] + 460, c[1] + 320];
  const x0 = Math.max(0, Math.floor(box[0] * S)), y0 = Math.max(0, Math.floor(box[1] * S));
  const x1 = Math.min(T.W - 1, Math.ceil(box[2] * S)), y1 = Math.min(T.H - 1, Math.ceil(box[3] * S));
  const w = x1 - x0 + 1, h = y1 - y0 + 1, n = w * h;
  const L = { x0, y0, w, h, S, box, k: new Uint8Array(n), u: new Float32Array(n), th: new Float32Array(n), rho: new Float32Array(n), nx: new Float32Array(n), ny: new Float32Array(n), nz: new Float32Array(n) };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const xs = (x0 + x + 0.5) / S, ys = (y0 + y + 0.5) / S, dw = dwarp(xs, ys);
    const H = lemonHit(xs + dw[0] * 0.7, ys + dw[1] * 0.7), i = y * w + x;
    if (!H) continue;
    L.k[i] = H.cut ? 2 : 1; L.u[i] = H.u; L.th[i] = H.th; L.rho[i] = H.rho; L.nx[i] = H.N[0]; L.ny[i] = H.N[1]; L.nz[i] = H.N[2];
  }
  const M = new Uint8Array(T.N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, v = L.k[i] ? 1 : 0;
    let edge = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && ((L.k[yy * w + xx] ? 1 : 0) !== v)) edge = true; }
    let cov = v;
    if (edge) { let c2 = 0; const xs = (x0 + x + 0.5) / S, ys = (y0 + y + 0.5) / S, dw = dwarp(xs, ys); for (const ox of [-0.25, 0.25]) for (const oy of [-0.25, 0.25]) if (lemonHit(xs + ox / S + dw[0] * 0.7, ys + oy / S + dw[1] * 0.7)) c2++; cov = c2 / 4; }
    M[(y0 + y) * T.W + x0 + x] = Math.round(cov * 255);
  }
  M.box = box;
  SCN.lc = L; SCN.mL0 = M;
}
function lemonCached(x, y) {
  const L = SCN.lc;
  const px = Math.floor(x * L.S) - L.x0, py = Math.floor(y * L.S) - L.y0;
  if (px < 0 || py < 0 || px >= L.w || py >= L.h) return null;
  const i = py * L.w + px; if (!L.k[i]) return null;
  return { cut: L.k[i] === 2, u: L.u[i], th: L.th[i], rho: L.rho[i], N: [L.nx[i], L.ny[i], L.nz[i]] };
}
function paintLemon(T) {
  reseed(606);
  const S = T.S;
  const c = proj(...LEM.c);
  buildLemonCache(T);
  const mL0 = SCN.mL0, box = mL0.box;
  // lost edges on the shadow side: blur the mask toward the lower right
  const W = T.W, x0 = Math.floor(box[0] * S), y0 = Math.floor(box[1] * S), x1 = Math.ceil(box[2] * S), y1 = Math.ceil(box[3] * S);
  const rad = Math.max(1, Math.round(3 * S));
  const mL = new Uint8Array(T.N); mL.box = box;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let sum = 0, n = 0;
    for (let dy = -rad; dy <= rad; dy += 1) for (let dx = -rad; dx <= rad; dx += 1) { sum += mL0[(y + dy) * W + x + dx]; n++; }
    const bl = sum / n, o = mL0[y * W + x];
    const fx = (x / S - c[0]) / 320, fy = (y / S - c[1]) / 200;
    const soft = sm(-0.1, 0.9, fx * 0.6 + fy * 0.8);
    mL[y * W + x] = Math.round(o + (bl - o) * soft);
  }
  SCN.mLemon = mL;
  // contact shadow beneath the lemon (on the plate)
  for (let k = 0; k < 10; k++) {
    const t = k / 9, u = lerp(-2.4, 3.2, t);
    const p = lemPoint(u, Math.PI, null);
    const q = proj(p[0], 0.02, p[2]);
    dab(q[0] + 10, q[1] + 2, 38 + 12 * Math.sin(t * 3), { col: C(24, 24, 22), alpha: 0.5, thick: 0.02, flat: 0.5, dry: 0, bk: 0.3, wk: 0.3, soft: 0.9, el: 0.6 }, 0);
  }
  // dead colouring
  fillMask(mL, (x, y) => { const h = lemonCached(x, y); return h ? lemonColHit(h) : null; }, 1, 0.12);
  // form-following strokes in surface coordinates (u along the axis, th around it)
  const vis = (u, th) => dot3(lemNormalAt(u, th), VV) > 0.06;
  const zone = (u, th) => (u < lemUb(th) ? 1 : 2);
  const paramCol = (u, th) => lemonColHit({ cut: false, u, th, N: lemNormalAt(u, th) });
  const walk = (u, th, len, along) => {
    const r = Math.max(0.3, lemR(u));
    const z0 = zone(u, th), pts = [];
    if (along === 'lat') {
      const dth = Math.min(0.08, 6 / (r * K));
      const nst = Math.max(2, Math.round(len / (r * K * dth)));
      const du = gauss() * 0.32;
      for (let k = -nst / 2; k <= nst / 2; k++) {
        const t2 = th + k * dth, uu = u + du * k / nst;
        if (!vis(uu, t2) || zone(uu, t2) !== z0 || uu < LEM.uc + 0.04) { if (pts.length >= 4) break; pts.length = 0; continue; }
        const q = proj(...lemPoint(uu, t2)); pts.push(q[0], q[1]);
      }
    } else {
      const du = 0.06, nst = Math.max(2, Math.round(len / (K * du)));
      const dth = gauss() * 0.15 / nst;
      for (let k = -nst / 2; k <= nst / 2; k++) {
        const uu = u + k * du, t2 = th + dth * k;
        if (uu < LEM.uc + 0.04 || uu > LEM.ut - 0.05 || !vis(uu, t2) || zone(uu, t2) !== z0) { if (pts.length >= 4) break; pts.length = 0; continue; }
        const q = proj(...lemPoint(uu, t2)); pts.push(q[0], q[1]);
      }
    }
    return pts;
  };
  const body = (n, wl, ll, o, filter) => {
    for (let k = 0; k < n; k++) {
      const u = rnd(LEM.uc, LEM.ut), th = rnd(-Math.PI, Math.PI);
      if (!vis(u, th)) continue;
      if (filter && !filter(u, th)) continue;
      const along = R() < 0.7 ? 'lat' : 'lon';
      const pts = walk(u, th, rnd(ll[0], ll[1]), along);
      if (pts.length < 4) continue;
      const col = jit(paramCol(u, th), o.cj || 0.012, o.lj2 || 0.03);
      const col2 = jit(paramCol(u + gauss() * 0.3, th + gauss() * 0.2), (o.cj || 0.012) * 1.3, (o.lj2 || 0.03) * 1.3);
      stroke(pts, Object.assign({ w: rnd(wl[0], wl[1]), col, col2, m: mL }, o));
    }
  };
  body(700, [16, 30], [40, 110], { alpha: 0.6, thick: 0.18, dry: 0.3, bk: 0.4, wk: 0.1, soft: 0.5, rag: 0.3, flat: 0.75, lj: 0.06, ridge: 0.25 });
  blendPass(box, 4, 0.5, mL);
  body(1700, [10, 18], [18, 46], { alpha: 0.5, thick: 0.3, dry: 0.45, bk: 0.5, wk: 0.1, soft: 0.45, rag: 0.35, flat: 0.75, lj: 0.08, ridge: 0.3, cj: 0.02, lj2: 0.07 });
  blendPass(box, 2, 0.2, mL);
  // fuller paint in the light of the rind
  body(500, [6, 12], [14, 40], { alpha: 0.5, thick: 0.5, dry: 0.5, bk: 0.6, wk: 0.05, soft: 0.45, rag: 0.4, flat: 0.7, lj: 0.08 }, (u, th) => zone(u, th) === 2 && dot3(lemNormalAt(u, th), LV) > 0.3);
  // the lit planes, stated with fuller, visible strokes
  body(260, [16, 28], [24, 60], { alpha: 0.38, thick: 0.75, dry: 0.55, bk: 0.6, wk: 0.05, soft: 0.45, rag: 0.4, flat: 0.65, lj: 0.1, cj: 0.03, lj2: 0.09 }, (u, th) => dot3(lemNormalAt(u, th), LV) > 0.35);
  // pith: soft lumpy dabs
  body(500, [5, 10], [8, 20], { alpha: 0.35, thick: 0.4, dry: 0.4, bk: 0.6, wk: 0.05, soft: 0.5, rag: 0.4, flat: 0.7, lj: 0.12 }, (u, th) => zone(u, th) === 1);
  // rind pores: tiny pits, and specks of light in the light
  for (let k = 0; k < 3200; k++) {
    const u = rnd(LEM.uc, LEM.ut), th = rnd(-Math.PI, Math.PI);
    if (!vis(u, th) || zone(u, th) !== 2) continue;
    const N = lemNormalAt(u, th), ndl = dot3(N, LV);
    const q = proj(...lemPoint(u, th));
    const c0 = paramCol(u, th);
    if (R() < 0.7) dab(q[0], q[1], rnd(1.0, 1.8), { col: scl(c0, 0.74), alpha: rnd(0.16, 0.34), thick: 0.0, flat: 0.4, dry: 0, bk: 0.3, wk: 0, soft: 0.7, el: 0.3, m: mL });
    else if (ndl > 0.2) dab(q[0] - 1, q[1] - 1, rnd(0.9, 1.5), { col: mix(c0, C(255, 246, 200), 0.4), alpha: rnd(0.2, 0.4), thick: 0.35, flat: 0.4, dry: 0, bk: 0.3, wk: 0, soft: 0.6, el: 0.3, m: mL });
  }
  // the rind's cut edge along the spiral: a white hair of pith, a soft shadow on the pith below
  {
    const pts = [], sh = [];
    for (let th = LEM.ths + 0.02; th < LEM.ths + 2 * Math.PI - 0.02; th += 0.02) {
      const u = lemUb(th);
      if (!vis(u, th)) { pts.length = 0; sh.length = 0; continue; }
      const q = proj(...lemPoint(u + 0.03, th)), qs = proj(...lemPoint(u - 0.08, th));
      pts.push(q[0], q[1]); sh.push(qs[0], qs[1]);
    }
  }
  // ---- the cut face: pith ring, flesh segments, membranes, core
  const cc = LEM.cc, rc = LEM.rc;
  const facePt = (rho, ps) => { const c1 = Math.cos(ps), s1 = Math.sin(ps); return proj(cc[0] + rho * rc * (c1 * LEM.e1[0] + s1 * LEM.e2[0]), cc[1] + rho * rc * (c1 * LEM.e1[1] + s1 * LEM.e2[1]), cc[2] + rho * rc * (c1 * LEM.e1[2] + s1 * LEM.e2[2])); };
  const faceCol = (rho, ps) => cutCol({ rho, th: ps });
  for (let k = 0; k < 90; k++) {
    const rho = rnd(0.87, 0.985), ps = rnd(0, 2 * Math.PI), len = rnd(0.3, 0.8);
    const P = []; for (let a = -len / 2; a <= len / 2; a += 0.04) { const q = facePt(rho + gauss() * 0.004, ps + a); P.push(q[0], q[1]); }
    stroke(P, { w: rnd(7, 12), col: jit(faceCol(rho, ps), 0.012), col2: jit(faceCol(rho - 0.04, ps), 0.015), alpha: 0.55, prof: 'lens', thick: 0.45, dry: 0.4, bk: 0.5, wk: 0.05, soft: 0.5, rag: 0.3, lj: 0.06, m: mL });
  }
  const nseg = 10;
  for (let sgi = 0; sgi < nseg; sgi++) {
    const a0 = -0.31 + sgi * 2 * Math.PI / nseg, a1 = a0 + 2 * Math.PI / nseg;
    // wedge: a few broad strokes from the centre outward
    for (let k = 0; k < 7; k++) {
      const ps = lerp(a0 + 0.1, a1 - 0.1, (k + R()) / 7);
      const r0 = rnd(0.17, 0.24), r1 = rnd(0.72, 0.83);
      const P = []; for (let r = r0; r <= r1; r += 0.03) { const q = facePt(r, ps + gauss() * 0.003); P.push(q[0], q[1]); }
      stroke(P, { w: rnd(7, 11), col: jit(faceCol((r0 + r1) / 2, ps), 0.015), col2: jit(faceCol(r1 - 0.05, ps), 0.02), alpha: 0.55, prof: 'tail', thick: 0.4, dry: 0.4, bk: 0.5, wk: 0.05, soft: 0.5, rag: 0.35, lj: 0.08, m: mL });
    }
    // juice vesicles: little elongated cells, a touch lighter or darker
    for (let k = 0; k < 22; k++) {
      const ps = lerp(a0 + 0.08, a1 - 0.08, R()), r = rnd(0.22, 0.8);
      const q0 = facePt(r - 0.03, ps), q1 = facePt(r + 0.03, ps);
      const base = faceCol(r, ps);
      stroke([q0[0], q0[1], q1[0], q1[1]], { w: rnd(2.6, 4.2), col: R() < 0.55 ? mix(base, C(252, 234, 150), 0.35) : scl(base, 0.9), alpha: rnd(0.3, 0.55), prof: 'lens', thick: 0.45, dry: 0.2, bk: 0.4, wk: 0, soft: 0.55, m: mL });
    }
    // membrane
    const P = []; for (let r = 0.15; r <= 0.86; r += 0.03) { const q = facePt(r, a0 + gauss() * 0.002); P.push(q[0], q[1]); }
    stroke(P, { w: rnd(1.8, 2.6), col: C(240, 230, 192), alpha: 0.6, prof: 'taper', thick: 0.4, dry: 0.3, bk: 0.4, wk: 0, soft: 0.45, m: mL });
  }
  { const q = facePt(0, 0); dab(q[0], q[1], rc * K * 0.13, { col: C(236, 226, 190), col2: C(222, 208, 160), alpha: 0.75, thick: 0.5, dry: 0.2, bk: 0.4, wk: 0, soft: 0.6, el: 0.4, m: mL }); }
  { const q0 = facePt(0.36, 1.1), q1 = facePt(0.5, 1.12); stroke([q0[0], q0[1], q1[0], q1[1]], { w: 9, col: C(236, 228, 196), col2: C(200, 188, 150), alpha: 0.8, prof: 'point', thick: 0.7, dry: 0.2, bk: 0.3, wk: 0, soft: 0.45, m: mL });
    stroke([q0[0] + 3, q0[1] + 3, q1[0] + 3, q1[1] + 3], { w: 4, col: C(150, 120, 40), alpha: 0.35, prof: 'point', thick: 0.1, dry: 0.2, bk: 0.3, wk: 0, soft: 0.6, m: mL }); }
  // a breath of shadow on the lower right of the body
  glaze(c[0] + 170, c[1] + 80, 200, 130, C(70, 56, 16), 0.22, 1.3, 'mix', mL, 0.1);
}
function flushEdge(pts, sh, mL) {
  stroke(sh.slice(), { w: 6, col: C(132, 116, 72), alpha: 0.32, prof: 'lens', thick: 0.1, dry: 0.3, bk: 0.5, wk: 0.1, soft: 0.6, m: mL });
  stroke(pts.slice(), { w: 3.4, col: C(244, 236, 204), alpha: 0.6, prof: 'lens', thick: 0.6, dry: 0.4, bk: 0.5, wk: 0.05, soft: 0.45, m: mL });
}

// ---------------------------------------------------------------- the lights
// Painted twice, for two positions of the flame (hp offsets them by a pixel or
// two and changes their size a little).  Same seed both times.
function paintHighlights(hp) {
  const T = E.T;
  reseed(8080);
  const dx = hp.dx, dy = hp.dy, kk = hp.k;
  const W = (P) => { const Q = P.slice(); for (let i = 0; i < Q.length; i += 2) { Q[i] += dx; Q[i + 1] += dy; } return Q; };
  const LW = C(250, 246, 232);
  const gx = G.x;
  // --- pewter: the one crisp highlight along the front rim, broken
  {
    const P = [];
    for (let a = 1.3; a <= 2.45; a += 0.008) { const rr = PL.rOut * plRout(a) / PL.rOut * 0.985; const p = proj(rr * Math.cos(a), PL.hRim, rr * Math.sin(a)); P.push(p[0], p[1]); }
    const n = P.length >> 1;
    for (let i0 = 0; i0 < n - 2;) {
      const i1 = Math.min(n - 1, i0 + 8 + (R() * 26 | 0));
      const mid = (i0 + i1) / 2 / n, wgt = Math.exp(-Math.pow((mid - 0.55) / 0.3, 2));
      if (R() < 0.85) stroke(W(P.slice(2 * i0, 2 * i1 + 2)), { w: (3.2 + 4.5 * wgt) * kk, col: jit(LW, 0.01), col2: C(214, 214, 200), alpha: 0.6 + 0.35 * wgt, prof: 'lens', thick: 1.0 + 1.2 * wgt, dry: 0.45, bk: 0.6, wk: 0.05, soft: 0.35, rag: 0.4 });
      i0 = i1 + (R() < 0.35 ? 2 + (R() * 4 | 0) : 0);
    }
  }
  // broad dull sheen on the back rim (scumbled)
  for (let k = 0; k < 10; k++) {
    const a = rnd(-2.85, -2.0), rr = rnd(8.6, 10.0);
    const p = proj(rr * Math.cos(a), PL.hRim, rr * Math.sin(a));
    stroke(W(seg(p[0] - 30, p[1] - 3, p[0] + 30, p[1] + 3, 1, 5)), { w: rnd(6, 12) * kk, col: C(210, 210, 196), alpha: 0.22, prof: 'lens', thick: 0.4, dry: 0.75, bk: 0.8, wk: 0.25, soft: 0.6, m: SCN.mPlate });
  }
  // --- roemer
  {
    // window reflection on the bowl (four panes, curved with the glass)
    const wx = gx - 0.7 * gR(G.rim + 80) - 4, wy = G.rim + 52;
    const pane = (px, py, w, h, a) => {
      // two soft vertical touches per pane, bent with the bowl, ends feathered
      for (let k = 0; k < 2; k++) {
        const xx = px + (k - 0.5) * w * 0.42 + gauss() * 0.8;
        const curve = (xx - gx) / 190;
        stroke(W(seg(xx + curve * 3, py + rnd(-2, 2), xx - curve * 4, py + h + rnd(-3, 3), 0.8, 3)), { w: w * 0.5 * kk, col: jit(C(226, 230, 220), 0.015), alpha: a * rnd(0.6, 0.85), prof: 'lens', thick: 0.7, dry: 0.5, bk: 0.6, wk: 0.05, soft: 0.6, rag: 0.5 });
      }
    };
    pane(wx, wy, 24, 50, 0.8); pane(wx + 31, wy - 2, 25, 50, 0.55);
    pane(wx - 2, wy + 59, 22, 45, 0.5); pane(wx + 30, wy + 56, 23, 45, 0.34);
    // brightest pane: one loaded lead-white touch
    stroke(W(seg(wx - 3, wy + 6, wx - 6, wy + 44, 0.5, 3)), { w: 10 * kk, col: LW, alpha: 0.92, prof: 'lens', thick: 2.2, dry: 0.4, bk: 0.6, wk: 0, soft: 0.45, rag: 0.4 });
    // smaller window in the wine, lower left
    pane(gx - 0.72 * gR(G.wine + 70), G.wine + 60, 12, 22, 0.42);
    // rim accents, broken
    const y = G.rim, rx = gR(y), ry = rx * gEr(y);
    for (const [a0, a1, al, th] of [[2.55, 2.85, 0.95, 1.8], [1.2, 1.5, 0.7, 1.2], [0.25, 0.45, 0.6, 1.0], [3.5, 3.75, 0.5, 0.8], [5.4, 5.7, 0.4, 0.6]]) {
      const P = []; for (let a = a0; a <= a1; a += 0.02) P.push(gx + rx * Math.cos(a), y + ry * Math.sin(a) + (a < Math.PI ? 1 : -1));
      stroke(W(P), { w: 3.2 * kk, col: LW, alpha: al, prof: 'lens', thick: th, dry: 0.4, bk: 0.5, wk: 0.05, soft: 0.35 });
    }
    // meniscus: a bright line along the back, the light catching the wine's edge
    const wr = gR(G.wine) * 0.985, wry = wr * gEr(G.wine);
    for (const [a0, a1, al] of [[3.35, 4.1, 0.85], [4.3, 4.75, 0.55], [5.6, 6.0, 0.4]]) {
      const P = []; for (let a = a0; a <= a1; a += 0.02) P.push(gx + wr * Math.cos(a), G.wine + wry * Math.sin(a));
      stroke(W(P), { w: 3 * kk, col: C(250, 236, 186), alpha: al, prof: 'lens', thick: 1.2, dry: 0.4, bk: 0.5, wk: 0.05, soft: 0.4 });
    }
    // glint on the front of the wine and the glow at the right edge
    for (let k = 0; k < 4; k++) { const yy = G.wine + 50 + k * 22; stroke(W(seg(gx + 0.62 * gR(yy) - 16, yy + gauss() * 3, gx + 0.62 * gR(yy) + 16, yy + 6 + gauss() * 3, 1, 4)), { w: rnd(10, 16) * kk, col: C(244, 214, 130), alpha: 0.16, prof: 'lens', thick: 0.3, dry: 0.6, bk: 0.6, wk: 0.1, soft: 0.8 }); }
    // prunts: a bright point on each, upper left
    for (const [px, py, prx, pry] of SCN.prunts) {
      if (R() < 0.2) continue;
      const r = Math.max(2.0, prx * rnd(0.09, 0.15));
      dab(px - prx * 0.38 + dx, py - pry * 0.42 + dy, r * kk, { col: LW, alpha: 0.92, thick: 1.6, dry: 0.2, bk: 0.4, wk: 0, soft: 0.4, el: 0.35 }, -0.8);
    }
    // stem: a long vertical streak of reflected light, and the foot's glints
    for (const [y0, y1] of [[G.stemTop + 20, G.stemTop + 70], [G.stemTop + 150, G.stemTop + 175], [G.footTop - 70, G.footTop - 22]]) stroke(W(seg(gx - 58, y0, gx - 60, y1, 1, 5)), { w: 3.5 * kk, col: C(214, 216, 196), alpha: 0.5, prof: 'lens', thick: 0.8, dry: 0.6, bk: 0.7, wk: 0.1, soft: 0.45 });
    for (let k = 0; k < 5; k++) {
      const yy = G.footTop + 10 + k * 13, rr = gR(yy), a = rnd(2.2, 2.7);
      dab(gx + rr * Math.cos(a) + dx, yy + rr * gEr(yy) * Math.sin(a) - 3 + dy, rnd(1.8, 2.8) * kk, { col: LW, alpha: 0.75, thick: 1.0, dry: 0.3, bk: 0.4, wk: 0, soft: 0.45 });
    }
  }
  // --- golden caustic on the table (its brightest core)
  {
    const M = SCN.sm;
    let bx = 0, by = 0, bv = 0;
    for (let j = 0; j < M.ny; j++) for (let i = 0; i < M.nx; i++) { const xx = M.x0 + i * M.g, yy = M.y0 + j * M.g; if (xx < G.x || xx > G.x + 900 || Math.abs(yy - G.base) > 160 || plateHit(xx, yy)) continue; const v = M.Cm[j * M.nx + i] * M.V[j * M.nx + i]; if (v > bv) { bv = v; bx = M.x0 + i * M.g; by = M.y0 + j * M.g; } }
    SCN.caustic = [bx, by, bv];
    if (bv > 0.05) {
      for (let k = 0; k < 7; k++) stroke(W(seg(bx - rnd(14, 40), by + gauss() * 3, bx + rnd(14, 40), by + gauss() * 3, 1, 4)), { w: rnd(4, 9) * kk, col: C(255, 214, 120), alpha: 0.32, prof: 'lens', thick: 0.6, dry: 0.5, bk: 0.6, wk: 0.25, soft: 0.6 });
      dab(bx + dx, by + dy, 5 * kk, { col: C(255, 236, 170), alpha: 0.6, thick: 1.0, dry: 0.3, bk: 0.4, wk: 0.1, soft: 0.6, el: 0.7 }, 0);
    }
  }
  // --- lemon rind: waxy pinpoints where the light glances, and two impasto touches
  {
    const vis = (u, th) => dot3(lemNormalAt(u, th), VV) > 0.1;
    let best = null, bs = 0;
    for (let k = 0; k < 4000; k++) {
      const u = rnd(LEM.uc + 0.2, LEM.ut - 0.3), th = rnd(-Math.PI, Math.PI);
      if (!vis(u, th) || u < lemUb(th)) continue;
      const N = lemNormalAt(u, th), sp = Math.pow(Math.max(0, dot3(N, HV)), 22);
      if (sp > bs) { bs = sp; best = [u, th]; }
      if (sp > 0.08 && R() < sp * 0.9) {
        const q = proj(...lemPoint(u, th));
        dab(q[0] + dx, q[1] + dy, rnd(0.9, 1.8) * kk, { col: C(255, 250, 220), alpha: Math.min(0.95, 0.3 + sp), thick: 0.9, dry: 0.2, bk: 0.4, wk: 0, soft: 0.5, el: 0.3, m: SCN.mLemon });
      }
    }
    if (best) {
      const [u, th] = best;
      // a soft pale bloom of light on the wax, then broken specks across it
      for (let k = 0; k < 26; k++) {
        const uu = u + gauss() * 0.35, tt = th + gauss() * 0.16;
        if (!vis(uu, tt) || uu < lemUb(tt)) continue;
        const q = proj(...lemPoint(uu, tt));
        const ln = rnd(6, 16);
        stroke(W(seg(q[0] - ln / 2, q[1] - ln * 0.2, q[0] + ln / 2, q[1] + ln * 0.2, 0.6, 3)), { w: rnd(4, 9) * kk, col: C(252, 240, 176), alpha: rnd(0.12, 0.3), prof: 'lens', thick: 0.6, dry: 0.6, bk: 0.7, wk: 0, soft: 0.6, rag: 0.5, m: SCN.mLemon });
      }
      for (let k = 0; k < 60; k++) {
        const uu = u + gauss() * 0.45, tt = th + gauss() * 0.22;
        if (!vis(uu, tt) || uu < lemUb(tt)) continue;
        const q = proj(...lemPoint(uu, tt));
        dab(q[0] + dx, q[1] + dy, rnd(1.0, 2.2) * kk, { col: C(255, 252, 228), alpha: rnd(0.4, 0.85), thick: 1.0, dry: 0.2, bk: 0.4, wk: 0, soft: 0.5, el: 0.4, m: SCN.mLemon });
      }
      const P = []; for (let k = -3; k <= 3; k++) { const q = proj(...lemPoint(u + k * 0.05, th + k * 0.03)); P.push(q[0], q[1]); }
      stroke(W(P), { w: 14 * kk, col: C(255, 248, 214), alpha: 0.85, prof: 'lens', thick: 2.4, dry: 0.5, bk: 0.7, wk: 0, soft: 0.4, rag: 0.5, m: SCN.mLemon });
    }
    // pith: two moist glints
    for (const [u, th] of [[-1.6, 2.6], [-0.9, 3.0]]) {
      const tt = th + LEM.ths - 2.42;
      if (!vis(u, tt)) continue;
      const q = proj(...lemPoint(u, tt));
      dab(q[0] + dx, q[1] + dy, 2.2 * kk, { col: LW, alpha: 0.7, thick: 1.2, dry: 0.3, bk: 0.4, wk: 0, soft: 0.5, el: 0.4, m: SCN.mLemon });
    }
    // juice on the cut flesh: little wet lights, mostly upper left of the face
    const cc = LEM.cc, rc = LEM.rc;
    const facePt = (rho, ps) => { const c1 = Math.cos(ps), s1 = Math.sin(ps); return proj(cc[0] + rho * rc * (c1 * LEM.e1[0] + s1 * LEM.e2[0]), cc[1] + rho * rc * (c1 * LEM.e1[1] + s1 * LEM.e2[1]), cc[2] + rho * rc * (c1 * LEM.e1[2] + s1 * LEM.e2[2])); };
    for (let k = 0; k < 22; k++) {
      const ps = rnd(0, 2 * Math.PI), r = rnd(0.25, 0.72);
      const q0 = facePt(r - 0.02, ps), q1 = facePt(r + 0.035, ps);
      const up = Math.max(0, Math.cos(ps - 0.6));
      if (R() > 0.35 + 0.6 * up) continue;
      stroke(W([q0[0], q0[1], q1[0], q1[1]]), { w: rnd(1.6, 3.2) * kk, col: C(255, 250, 222), alpha: rnd(0.55, 0.95), prof: 'lens', thick: k < 2 ? 2.0 : 1.0, dry: 0.2, bk: 0.4, wk: 0, soft: 0.45, m: SCN.mLemon });
    }
  }
  // --- knife: one thin bright line along the blade, bolster glint, the bone's light
  {
    const K0 = SCN.kn, pB = K0.pB, pT = K0.pT;
    const pp = proj(KN.bol[0] + KN.perp[0] * KN.bw * 0.3, KN.bol[1], KN.bol[2] + KN.perp[2] * KN.bw * 0.3);
    const ox = pp[0] - pB[0], oy = pp[1] - pB[1];
    const P = [];
    for (let t = 0.04; t <= 0.8; t += 0.02) P.push(pB[0] + (pT[0] - pB[0]) * t + ox * (1 - t * 0.4), pB[1] + (pT[1] - pB[1]) * t + oy * (1 - t * 0.4));
    const n = P.length >> 1;
    for (let i0 = 0; i0 < n - 2;) { const i1 = Math.min(n - 1, i0 + 4 + (R() * 10 | 0)); stroke(W(P.slice(2 * i0, 2 * i1 + 2)), { w: 3.6 * kk, col: LW, alpha: rnd(0.65, 0.95), prof: 'lens', thick: 1.6, dry: 0.4, bk: 0.5, wk: 0, soft: 0.35, m: SCN.mPlate, mi: true }); i0 = i1 + (R() < 0.3 ? 2 : 0); }
    const b0 = K0.pBol0, b1 = K0.pH0;
    stroke(W(seg(b0[0] - 3, b0[1] - 14, b1[0] - 3, b1[1] - 14, 0, 2)), { w: 3 * kk, col: C(236, 226, 196), alpha: 0.8, prof: 'lens', thick: 1.2, dry: 0.3, bk: 0.4, wk: 0, soft: 0.4 });
    // bone handle: a long soft light along the top, one firm touch
    const a = K0.pH0, b = K0.pE, l = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l;
    let nx = -uy, ny = ux; if (nx * -0.6 + ny * -0.8 < 0) { nx = -nx; ny = -ny; }
    const r = KN.hr * K * 0.98;
    stroke(W(seg(a[0] + ux * 20 + nx * r * 0.5, a[1] + uy * 20 + ny * r * 0.5, b[0] - ux * 30 + nx * r * 0.55, b[1] - uy * 30 + ny * r * 0.55, 1, 5)), { w: 6 * kk, col: C(244, 236, 210), alpha: 0.6, prof: 'lens', thick: 1.2, dry: 0.6, bk: 0.7, wk: 0.05, soft: 0.45, m: SCN.mHandle });
    stroke(W(seg(a[0] + ux * l * 0.55 + nx * r * 0.55, a[1] + uy * l * 0.55 + ny * r * 0.55, a[0] + ux * l * 0.78 + nx * r * 0.56, a[1] + uy * l * 0.78 + ny * r * 0.56, 0.5, 4)), { w: 8 * kk, col: LW, alpha: 0.92, prof: 'lens', thick: 2.4, dry: 0.4, bk: 0.5, wk: 0, soft: 0.4, m: SCN.mHandle });
  }
}
