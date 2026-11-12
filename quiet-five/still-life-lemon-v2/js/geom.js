'use strict';
// ---------------------------------------------------------------------------
// Composition geometry.  The painter's "set-up": a table seen from a little
// above (orthographic, 20 deg), one warm source upper left.  World units cm:
// X right, Y up, Z toward the viewer; origin = centre of the pewter plate's
// floor.  Screen units = pixels of the 2160x2700 canvas.
// The geometry only informs the drawing (forms, value zones, cast shadows);
// everything visible is made of brush strokes.
// ---------------------------------------------------------------------------
const K = 77, EL = 20 * Math.PI / 180, CE = Math.cos(EL), SE = Math.sin(EL);
const OX = 1150, OY = 1700;
function proj(X, Y, Z) { return [OX + K * X, OY + K * (Z * SE - Y * CE)]; }
function v3n(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
const LV = v3n([-0.6, 0.8, 0.28]);           // toward the candle
const VV = [0, SE, CE];                         // toward the viewer
const HV = v3n([LV[0] + VV[0], LV[1] + VV[1], LV[2] + VV[2]]);
const TY = -0.3, TFZ = 3.8, WZ = -17;             // table top, table front edge, wall
const Y_BACK = proj(0, TY, WZ)[1];              // ~1495
const Y_EDGE = proj(0, TY, TFZ)[1];             // ~2267
function onPlaneY(sx, sy, h) { const X = (sx - OX) / K, q = (sy - OY) / K; return [X, h, (q + h * CE) / SE]; }
function onPlaneZ(sx, sy, z) { const X = (sx - OX) / K, q = (sy - OY) / K; return [X, (z * SE - q) / CE, z]; }

// ---------------------------------------------------------------- roemer
// drawn in screen space (its ellipses follow a gentle perspective of their own)
const G = { x: 566, base: 1508, footTop: 1414, stemTop: 1085, rim: 628, wine: 825, yc: 821, Rb: 222, Rv: 276 };
function gR(y) {
  if (y >= G.footTop) { const t = clamp((y - G.footTop) / (G.base - G.footTop), 0, 1); return 103 + 72 * Math.pow(t, 1.6); }
  if (y >= G.stemTop) return 96 + 6 * (y - G.stemTop) / (G.footTop - G.stemTop);
  const dy = (y - G.yc) / G.Rv;
  return Math.max(101, G.Rb * Math.sqrt(Math.max(0, 1 - dy * dy)));
}
function gEr(y) { return 0.16 + 0.11 * clamp((y - G.rim) / (G.base - G.rim), 0, 1); }
// half width of the silhouette at screen row y (-1 outside)
function gHalf(y) {
  if (y >= G.rim && y <= G.base) return gR(y);
  if (y < G.rim) { const R0 = gR(G.rim), ry = R0 * gEr(G.rim); const t = (G.rim - y) / ry; return t < 1 ? R0 * Math.sqrt(1 - t * t) : -1; }
  const R0 = gR(G.base), ry = R0 * gEr(G.base); const t = (y - G.base) / ry; return t < 1 ? R0 * Math.sqrt(1 - t * t) : -1;
}
// world placement for shadows: glass stands at the back left of the table
const GW = { X: (G.x - OX) / K, Z: 0, H: 0 };
GW.Z = ((G.base - OY) / K + TY * CE) / SE;
GW.H = (G.base - G.rim) / (K * CE);
function gRw(h) { return gR(G.base - h * K * CE) / K; }   // world radius at height h above the table
const G_HB = (G.base - G.stemTop) / (K * CE), G_HW = (G.base - G.wine) / (K * CE), G_HF = (G.base - G.footTop) / (K * CE);

// ---------------------------------------------------------------- plate (pewter)
const PL = { rIn: 6.0, rRim: 7.3, rOut: 9.0, hRim: 0.8, hLip: 0.5 };
function plRout(phi) { return PL.rOut * (1 + 0.006 * Math.sin(3 * phi + 1) + 0.004 * Math.sin(5 * phi + 2) + 0.003 * Math.sin(2 * phi + 0.4)); }
function plSurfY(r) { return r <= PL.rIn ? 0 : r >= PL.rRim ? PL.hRim : PL.hRim * (r - PL.rIn) / (PL.rRim - PL.rIn); }
// first surface of the plate hit by the view ray through screen (sx,sy)
function plateHit(sx, sy) {
  const X = (sx - OX) / K, q = (sy - OY) / K;
  let best = null, bz = -1e9;
  // outer lip (front half only can be seen)
  const Ro0 = plRout(Math.atan2(Math.sqrt(Math.max(0, PL.rOut * PL.rOut - X * X)), X));
  if (Math.abs(X) < Ro0) {
    const Zl = Math.sqrt(Ro0 * Ro0 - X * X), Yl = (Zl * SE - q) / CE;
    if (Yl >= PL.hLip && Yl <= PL.hRim && Zl > bz) { bz = Zl; best = { zone: 'lip', X, Y: Yl, Z: Zl, t: (PL.hRim - Yl) / (PL.hRim - PL.hLip) }; }
  }
  const Z1 = (q + PL.hRim * CE) / SE, r1 = Math.hypot(X, Z1);
  if (r1 >= PL.rRim && r1 <= plRout(Math.atan2(Z1, X)) && Z1 > bz) { bz = Z1; best = { zone: 'rim', X, Y: PL.hRim, Z: Z1 }; }
  // the well's slope: march from the front
  if (Math.abs(X) < PL.rRim) {
    let prev = null, pz = 0;
    for (let k = 0; k <= 48; k++) {
      const Z = PL.rRim - k * (2 * PL.rRim / 48);
      const r = Math.hypot(X, Z);
      const g = (Z * SE - q) / CE - plSurfY(r);
      if (prev !== null && (prev > 0) !== (g > 0)) {
        let a = pz, b = Z, ga = prev;
        for (let it = 0; it < 14; it++) {
          const m = (a + b) * 0.5, gm = (m * SE - q) / CE - plSurfY(Math.hypot(X, m));
          if ((gm > 0) === (ga > 0)) { a = m; ga = gm; } else b = m;
        }
        const Zc = (a + b) * 0.5, rc = Math.hypot(X, Zc);
        if (rc >= PL.rIn && rc <= PL.rRim && Zc > bz) { bz = Zc; best = { zone: 'cone', X, Y: plSurfY(rc), Z: Zc }; }
        break;
      }
      prev = g; pz = Z;
    }
  }
  const Z0 = q / SE, r0 = Math.hypot(X, Z0);
  if (r0 <= PL.rIn && Z0 > bz) { bz = Z0; best = { zone: 'floor', X, Y: 0, Z: Z0 }; }
  if (best) { best.r = Math.hypot(best.X, best.Z); best.phi = Math.atan2(best.Z, best.X); }
  return best;
}

// ---------------------------------------------------------------- lemon
const LEM = {
  c: [1.3, 3.08, -1.2],
  d: v3n([0.8, -0.07, -0.6]),
  uc: -3.5, ut: 4.92,
};
LEM.e1 = v3n((function () { const up = [0, 1, 0], k = dot3(up, LEM.d); return [up[0] - k * LEM.d[0], up[1] - k * LEM.d[1], up[2] - k * LEM.d[2]]; })());
LEM.e2 = cross3(LEM.d, LEM.e1);
function lemR(u) {
  if (u < LEM.uc - 1e-6 || u > LEM.ut) return 0;
  const body = 3.0 * Math.pow(Math.max(0, 1 - (u / 4.5) * (u / 4.5)), 0.6) * (1 + 0.03 * Math.sin(u * 0.9 + 0.5));
  const nip = 0.62 * Math.pow(Math.max(0, 1 - ((u - 4.3) / 0.62) * ((u - 4.3) / 0.62)), 0.7);
  return Math.max(body, nip);
}
function lemDR(u) { return (lemR(u + 0.01) - lemR(u - 0.01)) / 0.02; }
LEM.rc = lemR(LEM.uc + 1e-4);
LEM.cc = [LEM.c[0] + LEM.d[0] * LEM.uc, LEM.c[1] + LEM.d[1] * LEM.uc, LEM.c[2] + LEM.d[2] * LEM.uc]; // cut-face centre
function lemInside(x, y, z) {
  const rx = x - LEM.c[0], ry = y - LEM.c[1], rz = z - LEM.c[2];
  const u = rx * LEM.d[0] + ry * LEM.d[1] + rz * LEM.d[2];
  if (u < LEM.uc || u > LEM.ut) return false;
  const px = rx - u * LEM.d[0], py = ry - u * LEM.d[1], pz = rz - u * LEM.d[2];
  const rr = lemR(u);
  return px * px + py * py + pz * pz <= rr * rr;
}
// spiral peel boundary on the rind: peeled where u < lemUb(theta)
LEM.ths = 0; // set below: angle where the strip leaves the lemon (bottom front)
function lemPhi(th) { let p = (th - LEM.ths) / (2 * Math.PI); p -= Math.floor(p); return p; }
function lemUb(th) { return LEM.uc + 0.6 + 1.3 * lemPhi(th); }
(function () {
  const v = v3n([0, -0.55, 0.85]);
  LEM.ths = Math.atan2(dot3(v, LEM.e2), dot3(v, LEM.e1)) + 0.12;
})();
function lemPoint(u, th, out) {
  const r = lemR(u), c = Math.cos(th), s = Math.sin(th);
  const p = [LEM.c[0] + LEM.d[0] * u + r * (c * LEM.e1[0] + s * LEM.e2[0]),
    LEM.c[1] + LEM.d[1] * u + r * (c * LEM.e1[1] + s * LEM.e2[1]),
    LEM.c[2] + LEM.d[2] * u + r * (c * LEM.e1[2] + s * LEM.e2[2])];
  return p;
}
function lemNormalAt(u, th) {
  const c = Math.cos(th), s = Math.sin(th), dr = lemDR(u);
  const rad = [c * LEM.e1[0] + s * LEM.e2[0], c * LEM.e1[1] + s * LEM.e2[1], c * LEM.e1[2] + s * LEM.e2[2]];
  return v3n([rad[0] - dr * LEM.d[0], rad[1] - dr * LEM.d[1], rad[2] - dr * LEM.d[2]]);
}
// view ray through a screen point -> first lemon surface
function lemonHit(sx, sy) {
  const X = (sx - OX) / K, q = (sy - OY) / K;
  const by = -q * CE, bz = q * SE; // base point; ray = base + t*VV
  // bounding sphere
  const cx = X - LEM.c[0], cy = by - LEM.c[1], cz = bz - LEM.c[2];
  const B = cx * VV[0] + cy * VV[1] + cz * VV[2];
  const Cq = cx * cx + cy * cy + cz * cz - 5.0 * 5.0;
  const disc = B * B - Cq; if (disc <= 0) return null;
  const sq = Math.sqrt(disc);
  let t0 = -B + sq, t1 = -B - sq; // from near (large t) to far
  const dt = 0.035;
  let prevT = t0, hit = -1;
  for (let t = t0; t >= t1; t -= dt) {
    if (lemInside(X, by + t * VV[1], bz + t * VV[2])) { hit = t; break; }
    prevT = t;
  }
  if (hit < 0) return null;
  let a = prevT, b = hit;
  for (let it = 0; it < 16; it++) { const m = (a + b) * 0.5; if (lemInside(X, by + m * VV[1], bz + m * VV[2])) b = m; else a = m; }
  const P = [X, by + b * VV[1], bz + b * VV[2]];
  const rx = P[0] - LEM.c[0], ry = P[1] - LEM.c[1], rz = P[2] - LEM.c[2];
  const u = rx * LEM.d[0] + ry * LEM.d[1] + rz * LEM.d[2];
  const px = rx - u * LEM.d[0], py = ry - u * LEM.d[1], pz = rz - u * LEM.d[2];
  const rho = Math.hypot(px, py, pz);
  const th = Math.atan2(px * LEM.e2[0] + py * LEM.e2[1] + pz * LEM.e2[2], px * LEM.e1[0] + py * LEM.e1[1] + pz * LEM.e1[2]);
  if (u - LEM.uc < 0.02 && rho < lemR(LEM.uc + 0.02) - 0.005) {
    return { cut: true, P, u, th, rho: rho / LEM.rc, N: [-LEM.d[0], -LEM.d[1], -LEM.d[2]] };
  }
  return { cut: false, P, u, th, rho, N: lemNormalAt(u, th) };
}

// ---------------------------------------------------------------- knife (lying on the table, handle over the edge)
const KN = { tip: [6.0, -0.24, -3.8], bol: [9.6, -0.18, 3.4], end: [11.4, -0.1, 9.8], hr: 0.52, bw: 1.1 };
(function () {
  const d = v3n([KN.bol[0] - KN.tip[0], 0, KN.bol[2] - KN.tip[2]]);
  KN.dir = d;
  // the blade rests a little on its side: width direction between the table plane and up
  const ca = Math.cos(1.05), sa = Math.sin(1.05);
  KN.perp = [d[2] * ca, sa, -d[0] * ca];
  const h = v3n([KN.end[0] - KN.bol[0], KN.end[1] - KN.bol[1], KN.end[2] - KN.bol[2]]);
  KN.hdir = h;
})();

// ---------------------------------------------------------------- shadows
// visibility of the candle from world point P; skip: object to ignore
// returns [vis (opaque occluders), glass attenuation, caustic]
let PEEL_REST_CAPS = null; // filled by peel.js: [[x,y,z],...] centreline of the resting strip
function segDist(p, a, b) {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
  let t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby + (p[2] - a[2]) * abz) / (abx * abx + aby * aby + abz * abz);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(p[0] - a[0] - abx * t, p[1] - a[1] - aby * t, p[2] - a[2] - abz * t);
}
function shadowAt(P, skip) {
  let minR = 1e9, gOcc = 0, caus = 0;
  let prevPl = null, prevR = 0;
  for (let t = 0.12; t < 30; t += (t < 2 ? 0.05 : t < 8 ? 0.12 : 0.25)) {
    const x = P[0] + LV[0] * t, y = P[1] + LV[1] * t, z = P[2] + LV[2] * t;
    if (y > 20) break;
    const pen = 0.05 + 0.05 * t;
    // roemer (transparent): attenuation and the golden caustic of the wine
    const h = y - TY;
    if (h > 0 && h < GW.H && skip !== 'glass') {
      const rg = gRw(h), rho = Math.hypot(x - GW.X, z - GW.Z);
      const occ = sm(pen * 1.5, -pen * 1.5, rho - rg);
      let k = 0.35;
      if (h < G_HF) k = 0.62; else if (h < G_HB) k = 0.7; else if (h < G_HW) k = 0.62; else k = 0.28;
      gOcc = Math.max(gOcc, occ * k);
      if (h > G_HB + 0.4 && h < G_HW - 0.2) caus = Math.max(caus, Math.exp(-Math.pow(rho / (0.33 * rg), 2)) * 0.9);
      else if (h > G_HF + 0.5 && h < G_HB - 0.2) caus = Math.max(caus, Math.exp(-Math.pow(rho / (0.22 * rg), 2)) * 0.35);
      // the thick rim of glass at the silhouette darkens the shadow edge
      gOcc = Math.max(gOcc, Math.exp(-Math.pow((rho - rg) / (pen + 0.06), 2)) * 0.5);
    }
    // plate: thin shell, detect crossings of its surface
    if (skip !== 'plate') {
      const r = Math.hypot(x, z);
      if (r < 11.5 && y > -0.4 && y < 1.5) {
        const g = y - plSurfY(r);
        if (prevPl !== null && (prevPl > 0) !== (g > 0)) {
          const rc = (r + prevR) * 0.5;
          minR = Math.min(minR, (rc - plRout(Math.atan2(z, x))) / pen);
        }
        prevPl = g; prevR = r;
      } else prevPl = null;
    }
    // lemon
    if (skip !== 'lemon') {
      const rx = x - LEM.c[0], ry = y - LEM.c[1], rz = z - LEM.c[2];
      if (rx * rx + ry * ry + rz * rz < 36) {
        const u = rx * LEM.d[0] + ry * LEM.d[1] + rz * LEM.d[2];
        const px = rx - u * LEM.d[0], py = ry - u * LEM.d[1], pz = rz - u * LEM.d[2];
        const m = Math.max(Math.hypot(px, py, pz) - lemR(clamp(u, LEM.uc, LEM.ut)), LEM.uc - u, u - LEM.ut);
        minR = Math.min(minR, m / pen);
      }
    }
    // knife
    if (skip !== 'knife' && y < 1.2) {
      const p = [x, y, z];
      const dh = segDist(p, KN.bol, KN.end) - KN.hr;
      const db = segDist(p, KN.tip, KN.bol) - 0.12;
      minR = Math.min(minR, Math.min(dh, db) / pen);
    }
    // resting peel strip (flat, ~1.75 wide)
    if (PEEL_REST_CAPS && skip !== 'peel' && t < 3 && y < 1.4) {
      const p = [x, y, z], C = PEEL_REST_CAPS;
      for (let i = 0; i + 1 < C.length; i++) {
        const a = C[i], b = C[i + 1];
        if (Math.abs(a[0] - x) > 2.5 && Math.abs(b[0] - x) > 2.5) continue;
        const dd = segDist(p, a, b);
        const ym = (a[1] + b[1]) * 0.5;
        if (Math.abs(y - ym) < 0.22) minR = Math.min(minR, (dd - 0.82) / pen);
      }
    }
  }
  return [sm(-1, 1, minR), gOcc, caus];
}

// the painter's hand: silhouettes drawn freehand wobble a little
function dwarp(x, y) {
  return [(vn(x / 170 + 11, y / 170 + 3) - 0.5) * 5 + (vn(x / 45 + 2, y / 45 + 7) - 0.5) * 1.4,
    (vn(x / 170 + 31, y / 170 + 13) - 0.5) * 5 + (vn(x / 45 + 9, y / 45 + 1) - 0.5) * 1.4];
}
