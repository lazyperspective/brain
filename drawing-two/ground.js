'use strict';
// Everything below the horizon.
const { hash2, vnoise, fbm, n1, hex, mix, ramp, clamp, sstep } = require('./engine.js');

module.exports = function (E, A, on) {
  const { T, W, H, HY, VPX, F, EH, SUNX, SKYP, skyCol, skyScene, trailPt, trailW, patch, nearPencil } = A;
  const sq = (v) => v * v;
  const XC = 1.0;                       // the strip's centre line sits a little to our right
  const gp = (X, Z) => [VPX + F * X / Z, HY + F * EH / Z];
  const rp = (Xr, Z) => gp(Xr + XC, Z); // strip coordinates -> page
  const gZ = (y) => F * EH / (y - HY);
  const gX = (x, y) => (x - VPX) * EH / (y - HY);
  const rX = (x, y) => gX(x, y) - XC;
  const RW = 4.5, ZEND = 540, YEND = HY + F * EH / ZEND;
  const edgeAt = (Z, sd) => RW + 0.24 * (vnoise(Z / 2.5, sd * 7 + 3, 71) - 0.5) + 0.12 * (vnoise(Z * 1.3, sd * 7 + 9, 72) - 0.5);
  function inRunway(x, y) {
    if (y <= YEND) return false;
    const X = rX(x, y);
    return Math.abs(X) < edgeAt(gZ(y), X < 0 ? -1 : 1);
  }

  // ---- the edge lamps: two rows, every ten metres, some of them gone out
  const LAMP = [], NL = 54, LZ0 = 9.5, LH = 0.6;
  const DEAD = { '-1:0': 1, '-1:3': 1, '-1:8': 1, '-1:9': 1, '-1:14': 1, '-1:21': 1, '-1:22': 1, '-1:30': 1, '1:4': 1, '1:11': 1, '1:17': 1, '1:18': 1, '1:26': 1, '1:33': 1, '1:34': 1, '-1:40': 1, '1:44': 1 };
  const DIM = { '-1:5': 0.45, '1:7': 0.5, '-1:15': 0.6, '1:2': 0.8 };
  for (let k = 0; k < NL; k++) for (const sd of [-1, 1]) {
    const key = sd + ':' + k;
    LAMP.push({ X: XC + sd * 5.0, Z: LZ0 + 10 * k, on: DEAD[key] ? 0 : (DIM[key] || 1), k, sd, tilt: key === '-1:0' ? 0.09 : key === '1:4' ? -0.08 : 0 });
  }
  function lampLight(X, Z) {
    let I = 0; const k0 = Math.round((Z - LZ0) / 10);
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      if (k < 0 || k >= NL) continue;
      for (let s = 0; s < 2; s++) { const L = LAMP[k * 2 + s]; if (!L.on) continue; I += L.on * Math.exp(-(sq(X - L.X) + sq(Z - L.Z)) / 1.5); }
    }
    return I;
  }

  // ---- standing water (strip coordinates)
  const PUD = [[-2.0, 7.2, 1.9, 1.2], [-0.5, 6.2, 1.2, 0.6], [-3.5, 6.3, 0.8, 0.7], [3.3, 6.3, 1.4, 0.7], [1.9, 5.7, 0.8, 0.45],
    [-1.5, 120, 1.0, 26], [1.2, 260, 1.2, 70]];
  function puddle(X, Z) {
    let f = -1;
    for (let i = 0; i < PUD.length; i++) { const p = PUD[i], u = (X - p[0]) / p[2], v = (Z - p[1]) / p[3], g = 1 - (u * u + v * v); if (g > f) f = g; }
    if (f < -0.6) return -1;
    return f + (fbm(X * 1.3 + 7, Z * 0.8, 61, 3) - 0.5) * 0.7;
  }
  const PT = 0.12;
  function inPuddle(x, y) { if (!inRunway(x, y)) return false; return puddle(rX(x, y), gZ(y)) > PT; }

  const ASA = hex('#1a1e42'), ASB = hex('#2b2d58'), AMB = hex('#ffb060'), AMB2 = hex('#ffd890');
  function wetCol(x, y) {
    const X = rX(x, y), Z = gZ(y), d = y - HY;
    const wet = sstep(0.3, 0.72, fbm(X / 2.2 + 3, Z / 5, 51, 3));
    const k = clamp(0.07 + 0.2 * wet + (0.25 + 0.6 * wet) * Math.exp(-d / 170), 0, 0.94);
    const ry = 2 * HY - y - 40 * Math.exp(-d / 120) - E.rnd() * E.rnd() * 300 * (d / 700 + 0.12);
    const refl = skyScene(x + E.rr(-20, 20), ry);
    let c = mix(mix(ASA, ASB, fbm(X * 1.7, Z * 0.6, 52, 3)), refl, k);
    const I = lampLight(X + XC, Z);
    if (I > 0.02) c = mix(c, AMB, clamp(I * 0.8, 0, 0.6));
    return c;
  }

  // a glow rubbed in with a fingertip: overlapping soft dabs, never a clean gradient
  function softGlow(x, y, R, c0, c1, str, o) {
    o = o || {};
    const sqh = o.squash || 1, n = o.n || 22;
    for (let i = 0; i < n; i++) {
      const f = Math.pow(E.rnd(), 0.7), rr = R * 0.6 * f, a = E.rnd() * 6.283, k = E.rr(0.8, 1.2), dir = E.rnd() * 3.1416;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * sqh;
      const wd = R * (0.78 - 0.4 * f) * k;
      const c = mix(c0, c1, f);
      if (sqh < 0.9) {
        const hl = wd * 0.5;
        E.line(px - hl, py, px + hl, py + E.rr(-1, 1) * wd * sqh * 0.2, T.smudge, c, { w: wd * sqh * 1.3 / T.smudge.width, edge: wd * sqh * 0.7, p: str * (1 - 0.45 * f) });
      } else {
        const l = wd * 0.22;
        E.line(px - Math.cos(dir) * l, py - Math.sin(dir) * l, px + Math.cos(dir) * l, py + Math.sin(dir) * l, T.smudge, c, { w: wd / T.smudge.width, edge: wd * 0.55, p: str * (1 - 0.45 * f) });
      }
    }
  }

  // ================================================================ far land
  function drawFar() {
    E.reseed(800);
    const my = (x) => HY - 22 - 78 * fbm(x / 900 + 3, 1.7, 81, 4) * (0.55 + 0.45 * sstep(300, 1500, Math.abs(x - 1650))) - 22 * Math.exp(-sq((x - 640) / 420));
    const mcol = (x, y) => { const g = Math.exp(-sq((x - SUNX) / 800)); return mix(mix(hex('#84508c'), hex('#c8708a'), g), skyCol(x, HY - 5), 0.2); };
    const mins = (x, y) => y > my(x) && y < HY + 4;
    E.hatch({ inside: mins, bbox: [0, HY - 130, W, HY + 4], angle: 0.02, spacing: 5, tool: T.tip, color: mcol, p: 0.88, len: [60, 260], endJit: 3, step: 2, w: 0.6 });
    E.hatch({ inside: mins, bbox: [0, HY - 130, W, HY + 4], angle: -0.7, spacing: 7, tool: T.pencil, color: hex('#6a4a90'), p: 0.45, len: [16, 70], step: 2 });
    const ty = (x) => HY - 4 - 30 * sstep(0.3, 0.72, fbm(x / 260, 2.2, 83, 3)) * (0.35 + 0.65 * vnoise(x / 38, 5, 84)) * (0.22 + 0.78 * sstep(90, 520, Math.abs(x - 1560))) - 5 * vnoise(x / 9, 7, 85);
    const tcol = (x, y) => mix(hex('#2b2a5c'), hex('#6a3f74'), 0.6 * Math.exp(-sq((x - SUNX) / 700)));
    E.hatch({ inside: (x, y) => y > ty(x) && y < HY + 8, bbox: [0, HY - 46, W, HY + 8], angle: 1.45, spacing: 3.2, tool: T.pencil, color: tcol, p: 0.95, len: [6, 30], endJit: 1.5, step: 1.5, w: 1.25, cover: 0.93, tooth: 0.4 });
    // small pylons walking off behind the trees
    E.reseed(801);
    const pyl = [[1900, 96], [2010, 78], [2200, 58], [2345, 44], [2470, 34]];
    const pc = hex('#5a3f78');
    for (const [x, h] of pyl.slice(0, 4)) {
      const b = HY - 6, w = h * 0.2;
      E.line(x - w, b, x - w * 0.18, b - h, T.sharp, pc, { p: 0.75, taper: 0 }); E.line(x + w, b, x + w * 0.18, b - h, T.sharp, pc, { p: 0.75, taper: 0 });
      for (let k = 1; k < 6; k++) { const f = k / 6, ww = w * (1 - 0.82 * f), yy = b - h * f; E.line(x - ww, yy, x + ww, yy - h / 12, T.sharp, pc, { p: 0.5, taper: 0 }); E.line(x + ww, yy, x - ww, yy - h / 12, T.sharp, pc, { p: 0.45, taper: 0 }); }
      for (const f of [0.72, 0.86, 0.98]) E.line(x - w * 1.5, b - h * f, x + w * 1.5, b - h * f, T.sharp, pc, { p: 0.8, taper: 0 });
    }
    for (let i = 0; i < pyl.length - 1; i++) for (const f of [0.72, 0.86, 0.98]) for (const sd of [-1, 1]) {
      const a = pyl[i], b = pyl[i + 1];
      const ax = a[0] + sd * a[1] * 0.3, ay = HY - 6 - a[1] * f, bx = b[0] + sd * b[1] * 0.3, by = HY - 6 - b[1] * f;
      E.curve([[ax, ay], [(ax + bx) / 2, (ay + by) / 2 + 7], [bx, by]], T.sharp, pc, { p: 0.42, taper: 0, wob: 0.3, w: 0.7 });
    }
    // a town, far off, switching its lights on
    E.reseed(802);
    const tw = [hex('#ffd08a'), hex('#ffe9b8'), hex('#9ad8ff'), hex('#ffb070')];
    for (let i = 0; i < 30; i++) {
      const x = 60 + 820 * Math.pow(E.rnd(), 0.8) + (i % 5 === 0 ? 2650 : 0), y = HY - 1 - E.rr(0, 7), c = tw[Math.floor(E.rnd() * tw.length)], b = E.rnd();
      softGlow(x, y, 9 + 6 * b, c, c, 0.5, { n: 5 });
      E.dot(x, y, 1.3 + 1.2 * b, T.chalk, mix(c, [1, 1, 1], 0.4), { p: 1.1 });
    }
  }

  // ================================================================ ground under-layer
  const GB = [[0, hex('#5c4a7e')], [22, hex('#3e426f')], [90, hex('#293f5e')], [300, hex('#1c3550')], [740, hex('#132842')]];
  const gcol = (x, y) => {
    const d = y - HY; const c = ramp(GB, d);
    const g = Math.exp(-sq((x - SUNX) / 900)) * Math.exp(-d / 45);
    return mix(c, hex('#b0607f'), 0.45 * g);
  };
  function drawGroundBase() {
    E.reseed(900);
    const ins = (x, y) => !inRunway(x, y);
    E.hatch({ inside: ins, bbox: [0, HY + 1, W, HY + 64], angle: 0.01, spacing: 4.5, tool: T.tip, color: gcol, p: 0.95, len: [80, 300], endJit: 3, step: 3, w: 0.7, tooth: 0.12 });
    E.hatch({ inside: ins, bbox: [0, HY + 54, W, H], angle: 0.02, spacing: 13, tool: T.soft, color: gcol, p: 0.96, len: [100, 360], endJit: 5, step: 4, tooth: 0.1 });
    E.hatch({ inside: ins, bbox: [0, HY + 54, W, H], angle: -0.3, spacing: 24, tool: T.pastel, w: 0.6, color: (x, y) => gcol(x, y + E.rr(-30, 30)), p: 0.6, len: [80, 260], step: 4 });
  }

  // ================================================================ the strip
  function paintCol(x, y) {
    const d = y - HY;
    let c = mix(hex('#a8a4d0'), skyScene(x, 2 * HY - y), 0.25);
    c = mix(c, hex('#f8d2b8'), 0.6 * Math.exp(-d / 150));
    const I = lampLight(gX(x, y), gZ(y));
    if (I > 0.02) c = mix(c, AMB2, clamp(I * 1.1, 0, 0.75));
    return c;
  }
  function paintQuad(Xa, Xb, Z0, Z1, wear, sid) {
    const xm = (Xa + Xb) / 2, a = rp(xm, Z0), b = rp(xm, Z1);
    const c = [rp(Xa, Z0), rp(Xb, Z0), rp(Xa, Z1), rp(Xb, Z1)];
    const bb = [Math.min(c[0][0], c[2][0]) - 4, c[2][1] - 3, Math.max(c[1][0], c[3][0]) + 4, c[0][1] + 3];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const wpx = (Xb - Xa) * F / ((Z0 + Z1) / 2);
    const ins = (x, y) => {
      if (y <= HY + 1) return false;
      const Z = gZ(y), X = rX(x, y);
      if (X < Xa || X > Xb || Z < Z0 || Z > Z1) return false;
      if (puddle(X, Z) > PT - 0.05) return false;
      return fbm(X * 2.2 + sid * 7.3, Z * 0.9, 91, 3) + 0.2 * vnoise(X * 9, Z * 3, 92) - 0.1 > wear;
    };
    if (wpx > 40) {
      E.hatch({ inside: ins, bbox: bb, angle: ang, spacing: 6, tool: T.tip, w: 0.62, color: paintCol, p: 0.9, len: [30, 150], endJit: 3, step: 2.5, tooth: 0.6 });
      E.hatch({ inside: ins, bbox: bb, angle: ang + 0.5, spacing: 9, tool: T.pencil, color: (x, y) => mix(paintCol(x, y), [1, 1, 1], 0.3), p: 0.55, len: [14, 60], step: 2.5 });
    } else {
      E.hatch({ inside: ins, bbox: bb, angle: ang, spacing: clamp(wpx / 4, 1.6, 3.2), tool: T.pencil, w: 1.15, cover: 0.94, color: paintCol, p: 0.95, len: [8, 60], endJit: 1.5, step: 1.6, tooth: 0.5 });
    }
  }

  function drawRunway() {
    E.reseed(1000);
    E.hatch({ inside: inRunway, bbox: [0, YEND, W, HY + 130], angle: 1.52, spacing: 4.5, tool: T.tip, color: wetCol, p: 0.95, len: [8, 46], endJit: 2, step: 2, w: 0.8, tooth: 0.12 });
    E.hatch({ inside: inRunway, bbox: [0, HY + 112, W, H], angle: 1.5, spacing: 12, tool: T.soft, color: wetCol, p: 0.96, len: [40, 190], endJit: 4, step: 4, w: 0.85, tooth: 0.1 });
    E.hatch({ inside: inRunway, bbox: [0, HY + 112, W, H], angle: 1.63, spacing: 21, tool: T.soft, color: wetCol, p: 0.7, len: [40, 160], endJit: 4, step: 4, w: 0.7, tooth: 0.7 });
    // broken colour dragged over the top so the paper's tooth sparkles through
    E.reseed(1004);
    for (let i = 0; i < 1500; i++) {
      const x = E.rr(-60, W + 60), y = HY + 16 + (H - HY) * Math.pow(E.rnd(), 0.75), d = y - HY, k = E.rnd();
      if (!inRunway(x, y)) { E.rnd(); E.rnd(); E.rnd(); continue; }
      const toVP = Math.atan2(HY - y, (VPX + XC * 0) - x) + E.rr(-0.25, 0.25), L = E.rr(30, 130) * (0.25 + d / 500);
      const c0 = wetCol(x, y), c = k < 0.5 ? mix(c0, hex('#0e1030'), 0.5) : mix(c0, hex('#8a86c0'), 0.35 + 0.3 * Math.exp(-d / 200));
      E.line(x, y, x + Math.cos(toVP) * L, y + Math.sin(toVP) * L, T.pastel, c, { p: E.rr(0.28, 0.5), w: E.rr(0.3, 0.7) * (0.3 + d / 600) });
    }
    // grain of the tarmac: pencil running away to the vanishing point
    E.reseed(1001);
    const dk = hex('#10143a'), lt = hex('#5d5c96'), pk = hex('#e8a0a8');
    for (let i = 0; i < 1700; i++) {
      const X = E.rr(-4.4, 4.4), Z0 = 5 + Math.pow(E.rnd(), 2.4) * 240, Z1 = Z0 * E.rr(1.06, 1.6), k = E.rnd();
      const a = rp(X + E.rr(-0.05, 0.05), Z0), b = rp(X, Z1);
      const far = Z0 > 40;
      E.line(a[0], a[1], b[0], b[1], T.pencil, k < (far ? 0.3 : 0.55) ? dk : (far ? pk : lt), { p: E.rr(0.22, 0.55) * (far ? 0.6 : 1), taper: 1 });
    }
    // rubber left by every landing there ever was
    for (let i = 0; i < 70; i++) {
      const sd = E.rnd() < 0.5 ? -1 : 1, X = sd * (1.25 + E.rr(-0.5, 0.5)), Z0 = E.rr(12, 34), Z1 = Z0 + E.rr(3, 12);
      const a = rp(X, Z0), b = rp(X + E.rr(-0.08, 0.08), Z1);
      E.line(a[0], a[1], b[0], b[1], T.tip, hex('#10122e'), { p: E.rr(0.15, 0.32), w: E.rr(0.25, 0.5), taper: 1, tooth: 0.85 });
    }
    hatchTarmac();
    // paint
    E.reseed(1002);
    const bars = [-3.45, -2.15, -0.85, 0.85, 2.15, 3.45];
    bars.forEach((xc, i) => paintQuad(xc - 0.45, xc + 0.45, 10, 21.5, 0.36, i + 1));
    let z = 24, i = 0;
    while (z < 420) { paintQuad(-0.2, 0.2, z, z + 12, 0.24, 20 + i); z += 22; i++; }
    paintQuad(-4.22, -4.04, 5, 420, 0.42, 60); paintQuad(4.04, 4.22, 5, 420, 0.42, 61);
    // cracks
    E.reseed(1003);
    for (let c = 0; c < 14; c++) {
      let X = E.rr(-4.3, 4.3), Z = 5.2 + Math.pow(E.rnd(), 1.6) * 24, dir = E.rnd() * 6.283; const n = 4 + Math.floor(E.rnd() * 7), pts = [];
      for (let k = 0; k < n; k++) {
        pts.push(rp(X, Z)); dir += E.rr(-0.7, 0.7);
        X += Math.cos(dir) * E.rr(0.15, 0.45); Z += Math.sin(dir) * E.rr(0.2, 0.8) * (Z / 8); if (Z < 5.1) Z = 5.1; X = clamp(X, -4.5, 4.5);
      }
      const cp = E.rr(0.4, 0.75), cw = E.rr(0.7, 1.3), hi = E.rnd() < 0.6;
      for (let k = 0; k < pts.length - 1; k++) {
        E.line(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], T.sharp, hex('#0b0d26'), { p: cp, w: cw, taper: 0, bow: 0, wob: 1.6 });
        if (hi) E.line(pts[k][0], pts[k][1] + 2.5, pts[k + 1][0], pts[k + 1][1] + 2.5, T.sharp, hex('#6c68a0'), { p: 0.22, taper: 0, bow: 0 });
      }
    }
  }

  function drawPuddles() {
    E.reseed(1100);
    const mirCol = (x, y) => mix(skyScene(x + E.rr(-6, 6), 2 * HY - y), hex('#1a2048'), 0.16 + 0.1 * sstep(1850, 2160, y));
    E.hatch({ inside: inPuddle, bbox: [0, YEND, W, HY + 130], angle: 0, spacing: 2.0, tool: T.pencil, w: 1.2, cover: 0.95, color: mirCol, p: 1.0, len: [12, 90], endJit: 1.5, step: 2, angJit: 0.006, tooth: 0.3 });
    E.hatch({ inside: inPuddle, bbox: [0, HY + 100, W, H], angle: 0, spacing: 4.5, tool: T.tip, w: 0.5, color: mirCol, p: 0.97, len: [30, 220], endJit: 2.5, step: 2.5, angJit: 0.008, tooth: 0.3 });
    E.hatch({ inside: inPuddle, bbox: [0, HY + 100, W, H], angle: 0.004, spacing: 9, tool: T.pencil, color: (x, y) => nearPencil(SKYP, skyScene(x, 2 * HY - y), E), p: 0.5, len: [30, 160], step: 2.5, angJit: 0.006 });
    // the trail, upside down in the water
    E.reseed(1101);
    const cross = [];
    for (let i = 0; i < 260; i++) {
      const t = 0.03 + 0.5 * E.rnd(), q = (E.rnd() + E.rnd() - 1) * 0.3, r = E.rnd();
      const [px, py, tx, ty] = trailPt(t), w = trailW(t);
      const x = px - ty * q * w, y = 2 * HY - (py + tx * q * w);
      if (y > H + 20 || !inPuddle(x, y)) continue;
      // water lies flat, so the marks do too
      const hl = 8 + w * 0.5 * r;
      E.line(x - hl, y + E.rr(-1, 1), x + hl, y + E.rr(-1, 1), T.smudge, mix(hex('#d890a8'), hex('#f8c8b8'), q + 0.5), { w: (5 + w * 0.22) / T.smudge.width, edge: 4 + w * 0.1, p: 0.75, flow: 1.6, taper: 1, ti: 0.4, to: 0.4 });
      if (r < 0.3) cross.push([x, y, hl]);
    }
    for (const [x, y, hl] of cross) {
      E.line(x - hl * 2.2, y + E.rr(-3, 3), x + hl * 2.2, y + E.rr(-3, 3), T.pencil, nearPencil(SKYP, skyScene(x, 2 * HY - y), E), { p: 0.55, taper: 1 });
      E.line(x - hl, y + E.rr(-2, 2), x + hl * 0.6, y + E.rr(-2, 2), T.pencil, hex('#ffd8c8'), { p: 0.5, taper: 1 });
    }
    // banks: a dark lip on the far side, a thread of light on the near one
    E.reseed(1102);
    for (let x = -4; x < W + 4; x += 5 + 4 * hash2(x | 0, 3, 5)) {
      let prev = false;
      for (let y = YEND + 2; y < H + 4; y += Math.max(1, (y - HY) * 0.006)) {
        const cur = inPuddle(x, y);
        if (cur && !prev) E.line(x - 5, y - 1, x + 5, y - 1 + E.rr(-1, 1), T.sharp, hex('#0c0e2c'), { p: y < HY + 150 ? 0.3 : 0.75, w: 1.2 });
        else if (!cur && prev) { if (E.rnd() < 0.55) E.line(x - 5, y, x + 5, y + E.rr(-1, 1), T.sharp, hex('#cfc4ea'), { p: 0.45 }); else E.rnd(); }
        prev = cur;
      }
    }
  }

  // upright things seen again in the water below them
  function reflectLine(x, y0, y1, lean, col, w, seed, p) {
    E.reseed(seed);
    E.hatch({ inside: inPuddle, bbox: [x - w / 2, y0, x + w / 2, Math.min(H, y1)], angle: 1.5708 + lean, spacing: 3.2, tool: T.pencil, color: col, p: p || 0.6, len: [10, 46], endJit: 3, step: 2,
      w: 1.0, cover: 0.85, wob: 2.4, skip: 0.2, spJit: 0.8 });
  }

  // ================================================================ lamps
  const CORE = hex('#fff8dc'), HALO = hex('#ffb24a'), HALO2 = hex('#ff8e4a');
  function drawLamp(L, idx) {
    const [x, y] = gp(L.X, L.Z), m = F / L.Z, h = LH * m;
    E.reseed(9000 + idx);
    if (m >= 250) return bigLamp(L, x, y, m);
    if (!E.vis(x - 2.6 * m - 40, y - h - 2.6 * m - 40, x + 2.6 * m + 40, y + 2.6 * m + 40)) return;
    const ly = y - h * 0.84;
    if (m < 13) {
      if (!L.on) return;
      const far = sstep(13, 5.5, m), hc = mix(HALO, hex('#ffd0a0'), far * 0.6);
      E.line(x, y + 1, x + E.rr(-1, 1), y + 2 + m * 0.7, T.pencil, HALO, { p: 0.6 * L.on, w: 0.9, taper: 2 });
      softGlow(x, ly, Math.max(7, m * 0.8), hex('#ffe2a8'), hc, 0.6 * L.on, { n: 5 });
      E.dot(x, ly, Math.max(2.1, m * 0.085), T.chalk, CORE, { p: 1.2 * L.on });
      return;
    }
    if (L.on) {
      // pool of light on the ground, and its smear down the wet tarmac
      softGlow(x, y + 0.03 * m, 1.5 * m, hex('#e8b868'), hex('#a8683f'), 0.42 * L.on, { n: 14, squash: Math.max(0.14, EH / L.Z * 1.6) });
      const len = 0.75 * m;
      for (let j = 0; j < 3; j++) {
        const xx = x + E.rr(-1, 1) * 0.05 * m, l = len * E.rr(0.5, 1);
        if (!inRunway(xx, y + 0.3 * m)) continue;
        E.line(xx, y + 0.06 * m, xx + E.rr(-2, 2), y + 0.06 * m + l, T.smudge, j ? HALO : hex('#ffd890'), { w: 0.2 * m / T.smudge.width, edge: 0.16 * m, p: 0.55 * L.on, taper: 2 });
      }
      for (let j = 0; j < Math.round(4 + m * 0.08); j++) {
        const f = E.rnd(), yy = y + 0.1 * m + f * len * 0.9, hl = m * (0.03 + 0.05 * E.rnd());
        if (!inRunway(x, yy)) continue;
        E.line(x - hl, yy, x + hl, yy + E.rr(-1, 1), T.pencil, hex('#ffe2a0'), { p: 0.7 * (1 - 0.7 * f) * L.on, taper: 1 });
      }
    }
    // the fixture
    const sw = Math.max(0.3, 0.05 * m / T.char.width);
    const dark = hex('#161a3c');
    const tx = x + L.tilt * h;
    E.line(x, y, x + L.tilt * h * 0.66, y - h * 0.66, T.char, dark, { p: 0.95, w: sw, taper: 0 });
    E.line(x - 0.1 * m, y, x + 0.1 * m, y, T.char, L.on ? hex('#a0783a') : dark, { p: 0.9, w: sw * 1.2, taper: 0 });
    E.line(x - 0.05 * m, y - 0.07 * m, x + 0.05 * m, y - 0.07 * m, T.char, L.on ? hex('#c99a45') : dark, { p: 0.9, w: sw, taper: 0 });
    if (!L.on) {
      E.line(x + L.tilt * h * 0.66, y - h * 0.66, tx, y - h, T.char, hex('#2a2f58'), { p: 0.95, w: Math.max(0.5, 0.13 * m / T.char.width), taper: 0 });
      E.line(tx - 0.035 * m, y - h * 0.95, tx - 0.035 * m, y - h * 0.75, T.sharp, hex('#a9a4d0'), { p: 0.6, taper: 1 });
      return;
    }
    const R = (0.85 + 0.45 * L.on) * m;
    softGlow(x, ly, R, hex('#ffd58a'), HALO2, 0.42 * L.on, { n: 18 });
    softGlow(x, ly, R * 0.42, hex('#fff0bc'), hex('#ffc874'), 0.85 * L.on, { n: 12 });
    // a few scumbled pencil marks so the glow still shows a hand
    E.glow(x, ly, R * 0.8, T.pencil, hex('#ffe2a0'), { n: Math.round(8 + m * 0.12), p: 0.45 * L.on, fall: 1.0, gam: 1.2, len: 0.35, radial: true, rmin: 0.25 });
    E.glow(x, ly, R * 1.05, m > 60 ? T.pastel : T.tip, (r) => mix(hex('#ffe0a0'), hex('#f08a48'), r), { n: Math.round(14 + m * 0.3), p: 0.5 * L.on, fall: 1.0, gam: 0.9, len: 0.32, w: m > 60 ? 0.3 : 0.5, rmin: 0.15, pmin: 0.06, tooth: 0.9 });
    // the glass
    E.line(tx - 0.03 * m, y - h * 0.7, tx + 0.03 * m, y - h * 0.7, T.char, dark, { p: 0.95, w: Math.max(0.4, 0.07 * m / T.char.width), taper: 0 });
    E.line(tx, y - h * 0.76, tx, y - h * 0.96, T.tip, mix(HALO, CORE, 0.45), { p: 1, w: 0.21 * m / T.tip.width, taper: 0, tooth: 0.2 });
    E.dot(tx, y - h * 0.86, Math.max(1.6, 0.075 * m), T.chalk, CORE, { p: 1.2, tooth: 0.1 });
    // cross-filter flare, the way old film caught a light
    const fl = (0.7 + 0.5 * L.on) * m;
    E.line(x - fl, ly, x + fl, ly + E.rr(-1, 1), T.sharp, hex('#ffeec0'), { p: 0.6 * L.on, taper: 1, ti: 0.5, to: 0.5 });
    E.line(x, ly - fl * 0.7, x + E.rr(-1, 1), ly + fl * 0.7, T.sharp, hex('#ffeec0'), { p: 0.5 * L.on, taper: 1, ti: 0.5, to: 0.5 });
  }

  // the two lamps nearest to us: one burning, its twin across the strip dark and leaning
  function bigLamp(L, x, y, m) {
    if (!E.vis(x - 900, y - 900, x + 900, y + 600)) return;
    const lit = L.on > 0, s = m * 1.2, a = L.tilt, ct = Math.cos(a), st = Math.sin(a);
    const P = (u, v) => [x + u * ct + v * st, y - v * ct + u * st];
    const seg = (u0, v0, u1, v1, tool, col, o) => { const p = P(u0, v0), q = P(u1, v1); E.line(p[0], p[1], q[0], q[1], tool, col, o); };
    const lamp = P(0, 0.415 * s);
    if (lit) {
      softGlow(x - 20, y + 8, 1.7 * m, hex('#e8b868'), hex('#a8683f'), 0.45, { n: 22, squash: 0.2 });
      softGlow(x - 10, y + 6, 0.8 * m, hex('#ffe2a0'), hex('#f0b060'), 0.6, { n: 14, squash: 0.2 });
      // its reflection, running down the wet tarmac toward us
      for (let j = 0; j < 7; j++) {
        const xx = x + E.rr(-26, 26), l = E.rr(120, 330);
        E.line(xx, y + 30, xx + E.rr(-6, 6), y + 30 + l, T.smudge, j < 2 ? hex('#ffe6a8') : HALO, { w: E.rr(0.5, 1.1), edge: 22, p: 0.85, taper: 2 });
      }
      for (let j = 0; j < 46; j++) {
        const f = Math.pow(E.rnd(), 1.2), yy = y + 34 + f * 300, hl = E.rr(8, 34) * (1 - 0.5 * f), xx = x + E.rr(-18, 18);
        if (!inRunway(xx, yy)) continue;
        E.line(xx - hl, yy, xx + hl, yy + E.rr(-1.5, 1.5), inPuddle(xx, yy) ? T.tip : T.pencil, inPuddle(xx, yy) ? hex('#fff0b8') : hex('#ffd890'), { p: 0.8 * (1 - 0.7 * f), w: inPuddle(xx, yy) ? 0.3 : 1.2, taper: 1 });
      }
      // halo
      softGlow(lamp[0], lamp[1], 1.3 * m, hex('#ffc070'), hex('#e87840'), 0.34, { n: 26 });
      softGlow(lamp[0], lamp[1], 0.72 * m, hex('#ffe3a0'), hex('#ffa850'), 0.5, { n: 22 });
      softGlow(lamp[0], lamp[1], 0.32 * m, hex('#fff6d0'), hex('#ffd890'), 0.95, { n: 16 });
      E.glow(lamp[0], lamp[1], 1.0 * m, T.pencil, (r) => mix(hex('#fff0bc'), hex('#ffb060'), r), { n: 70, p: 0.5, fall: 1.0, gam: 1.2, len: 0.3, radial: true, rmin: 0.22 });
      // dragged pastel round the lamp: the light is laid on in arcs, and the tooth breaks it up
      E.glow(lamp[0], lamp[1], 1.25 * m, T.pastel, (r) => mix(hex('#ffe0a0'), hex('#f08a48'), r), { n: 95, p: 0.42, fall: 1.0, gam: 1.0, len: 0.3, w: 0.5, rmin: 0.12, pmin: 0.06 });
      E.glow(lamp[0], lamp[1], 0.6 * m, T.tip, hex('#fff2c0'), { n: 60, p: 0.6, fall: 1.0, gam: 0.8, len: 0.4, w: 0.7, rmin: 0.2, tooth: 0.9 });
    }
    // base cone: old yellow paint
    const coneC = lit ? [[0, hex('#f2cf6c')], [0.5, hex('#c8963f')], [1, hex('#7d5a34')]] : [[0, hex('#8f8478')], [0.5, hex('#5f566c')], [1, hex('#33304e')]];
    for (let i = 0; i < 28; i++) {
      const u = (i + E.rnd()) / 28 * 2 - 1;
      seg(u * 0.12 * s, E.rr(-0.008, 0.006) * s, u * 0.045 * s, 0.115 * s + E.rr(-0.005, 0.005) * s, T.tip, ramp(coneC, clamp(0.5 + u * 0.55 + E.rr(-0.15, 0.15), 0, 1)), { p: 0.95, w: 0.6, taper: 0, tooth: 0.3 });
    }
    seg(-0.125 * s, -0.005 * s, 0.125 * s, -0.008 * s, T.char, hex('#2a2030'), { p: 0.9, w: 0.7 });
    // stem and coupling
    const steel = hex('#1f234a'), steelL = lit ? hex('#b89a80') : hex('#8e8ac0');
    for (const o of [-0.016, -0.005, 0.005, 0.016]) seg(o * s, 0.11 * s, o * s, 0.275 * s, T.char, o > 0 && lit ? hex('#3a3350') : steel, { p: 0.97, w: 0.8, taper: 0 });
    seg(-0.021 * s, 0.115 * s, -0.021 * s, 0.27 * s, T.sharp, steelL, { p: 0.55, taper: 0 });
    seg(-0.034 * s, 0.19 * s, 0.034 * s, 0.19 * s, T.char, steel, { p: 0.97, w: 1.0, taper: 0 });
    if (lit) seg(-0.032 * s, 0.2 * s, 0.032 * s, 0.2 * s, T.sharp, hex('#d9a060'), { p: 0.5, taper: 0 });
    // collar
    for (let i = 0; i < 4; i++) seg(-0.062 * s, (0.28 + i * 0.012) * s, 0.062 * s, (0.28 + i * 0.012) * s, T.char, i > 1 && lit ? hex('#5a4038') : hex('#262a50'), { p: 0.97, w: 0.9, taper: 0 });
    if (lit) seg(-0.06 * s, 0.326 * s, 0.06 * s, 0.326 * s, T.sharp, hex('#ffcf80'), { p: 0.8, taper: 0 });
    // glass dome
    const g0 = 0.33 * s, g1 = 0.5 * s, gw = 0.07 * s;
    for (let i = 0; i < 18; i++) {
      const u = (i + E.rnd()) / 18 * 2 - 1, au = Math.abs(u);
      const top = g1 - (1 - Math.sqrt(1 - u * u * 0.96)) * gw * 1.1;
      const c = lit ? mix(hex('#fffbe8'), hex('#ffc060'), Math.pow(au, 1.6)) : mix(hex('#3d4478'), hex('#161a40'), clamp(0.5 + u * 0.7, 0, 1));
      seg(u * gw, g0, u * gw * 0.97, top, T.tip, c, { p: 1.1, w: 0.55, taper: 0, tooth: 0.15 });
    }
    for (let i = -2; i <= 2; i++) seg(i * gw * 0.42, g0 + 2, i * gw * 0.4, g1 - 6 - Math.abs(i) * 6, T.sharp, lit ? hex('#e8963c') : hex('#151838'), { p: 0.55, taper: 1 });
    const oc = [[-gw - 1, g0], [-gw - 1, g1 - gw * 0.5], [-gw * 0.6, g1 - 2], [0, g1 + 3], [gw * 0.6, g1 - 2], [gw + 1, g1 - gw * 0.5], [gw + 1, g0]].map((p) => P(p[0], p[1]));
    E.curve(oc, T.sharp, lit ? hex('#c8742c') : hex('#0f1230'), { p: 0.7, taper: 0 });
    if (lit) {
      seg(0, g0 + 4, 0, g1 - 10, T.chalk, hex('#ffffff'), { p: 1.3, w: 2.4, taper: 1, tooth: 0.1 });
      const fx = lamp[0], fy = lamp[1];
      for (let k = 0; k < 3; k++) {
        E.line(fx - 330 + k * 60, fy + E.rr(-2, 2), fx + 330 - k * 60, fy + E.rr(-2, 2), k ? T.sharp : T.pencil, hex('#fff0c4'), { p: 0.75 - k * 0.1, taper: 1, ti: 0.5, to: 0.5 });
        E.line(fx + E.rr(-2, 2), fy - 230 + k * 40, fx + E.rr(-2, 2), fy + 230 - k * 40, T.sharp, hex('#fff0c4'), { p: 0.7 - k * 0.1, taper: 1, ti: 0.5, to: 0.5 });
      }
      for (const an of [0.78, -0.78]) E.line(fx - Math.cos(an) * 130, fy - Math.sin(an) * 130, fx + Math.cos(an) * 130, fy + Math.sin(an) * 130, T.sharp, hex('#ffe0a0'), { p: 0.5, taper: 1, ti: 0.5, to: 0.5 });
    } else {
      // the dark glass keeps a sliver of the sky and nothing else
      seg(-gw * 0.55, g0 + 8, -gw * 0.5, g1 - 18, T.chalk, hex('#c9b8e0'), { p: 0.8, w: 0.9, taper: 1 });
      seg(-gw * 0.25, g1 - 22, -gw * 0.2, g1 - 10, T.sharp, hex('#f0a0b0'), { p: 0.6, taper: 1 });
      seg(gw * 0.7, g0 + 6, gw * 0.66, g1 - 26, T.sharp, hex('#5a6aa8'), { p: 0.5, taper: 1 });
    }
  }

  // small blue lights marking a turning that leads off to the right; red ones across the far end
  const TAXI = [];
  for (let row = 0; row < 2; row++) for (let i = 0; i < 9; i++) {
    if (row === 1 && (i === 4 || i === 7)) continue; // two of them have gone too
    TAXI.push({ X: XC + 6.2 + i * 2.4 + row * 0.6, Z: 50 - 1.8 * i + row * 6.5, dim: (row === 0 && i === 2) ? 0.5 : 1 });
  }
  function drawTaxiLight(L, idx) {
    E.reseed(1300 + idx);
    const BL = hex('#4aa8ff'), BLC = hex('#e6f6ff');
    const [x, y] = gp(L.X, L.Z), m = F / L.Z, h = 0.68 * m;
    softGlow(x, y - h, m * 0.95, hex('#9ad8ff'), BL, 0.85 * L.dim, { n: 12 });
    softGlow(x, y - h, m * 0.3, hex('#d8f0ff'), hex('#8ad0ff'), 0.9 * L.dim, { n: 6 });
    E.glow(x, y - h, m * 0.7, T.pencil, hex('#8ac8ff'), { n: 10, p: 0.5 * L.dim, len: 0.35, rmin: 0.2, gam: 1 });
    E.line(x, y, x, y - h, T.sharp, hex('#141838'), { p: 0.85, taper: 0, w: 1.2 });
    E.dot(x, y - h, Math.max(2.4, m * 0.06), T.chalk, BLC, { p: 1.2 * L.dim, tooth: 0.1 });
  }
  function drawEndLights() {
    E.reseed(1299);
    for (let i = 0; i < 6; i++) {
      const [x, y] = rp(-4 + i * 1.6, ZEND);
      softGlow(x, y - 2, 11, hex('#ff8090'), hex('#ff4a6a'), 0.8, { n: 6 });
      E.dot(x, y - 2, 2.0, T.chalk, hex('#ffc8c8'), { p: 1.1 });
    }
  }

  // evening mist lying in the far grass
  function drawMist() {
    E.reseed(1350);
    for (let i = 0; i < 90; i++) {
      const x = E.rr(-200, W + 200), f = Math.pow(E.rnd(), 1.6), y = HY + 5 + 62 * f, L = E.rr(160, 700) * (0.5 + f), k = E.rnd();
      if (inRunway(x, y) && inRunway(x + L, y)) { continue; }
      const g = Math.exp(-sq((x - SUNX) / 900));
      const c = mix(mix(hex('#a892c4'), hex('#8f96c8'), k), hex('#f0a8a0'), 0.6 * g);
      E.line(x, y, x + L, y + E.rr(-3, 3), T.smudge, c, { w: (7 + 22 * f) / T.smudge.width, edge: 5 + 14 * f, p: E.rr(0.6, 1.0) * (1 - 0.4 * f), flow: 2.2, taper: 1, ti: 0.3, to: 0.3 });
    }
  }

  // ================================================================ poles and their wires (they follow some other road)
  const POLE = [];
  { const lean = [0.02, -0.014, 0.022, -0.008, 0.012, -0.01, 0.006, -0.004, 0.004, 0.003, -0.003];
    for (let i = 0; i < 11; i++) { const Z = 26 + 25 * i; POLE.push({ X: -11.5 - 0.2 * (Z - 26), Z, lean: lean[i], h: 8.5 }); } }
  const DARK = hex('#131838');
  function poleTop(P, hh) { const [x, y] = gp(P.X, P.Z), m = F / P.Z; return [x + P.lean * hh * m, y - hh * m, m]; }
  function drawPole(P, idx) {
    const [x, y] = gp(P.X, P.Z), m = F / P.Z;
    E.reseed(9500 + idx);
    if (!E.vis(x - 2 * m - 30, y - 9 * m, x + 2 * m + 30, y + 10)) return;
    const [tx, ty] = poleTop(P, P.h);
    const pw = 0.26 * m, fade = sstep(4, 60, m), col = mix(hex('#4a3f72'), DARK, fade);
    const n = Math.max(1, Math.round(pw / 5));
    for (let i = 0; i < n; i++) {
      const o = n === 1 ? 0 : (i / (n - 1) - 0.5) * (pw - 4);
      E.line(x + o * 1.15, y + 2, tx + o * 0.8, ty, T.char, col, { p: 0.97, w: Math.max(0.35, Math.min(1, pw / T.char.width)), taper: 0, wob: 0.7, bow: 0.002 });
    }
    if (m > 20) {
      E.line(x + pw * 0.5, y - 4, tx + pw * 0.38, ty + 6, T.sharp, hex('#f08a9a'), { p: 0.7, taper: 1, ti: 0.05, to: 0.05, wob: 0.6 });
      E.line(x + pw * 0.38, y - 0.5 * m, tx + pw * 0.3, ty + 1.2 * m, T.sharp, hex('#ffb89a'), { p: 0.45, taper: 1, wob: 0.6 });
      E.line(x - pw * 0.45, y - 4, tx - pw * 0.35, ty + 6, T.sharp, hex('#3d4a86'), { p: 0.5, taper: 1, wob: 0.6 });
      for (let k = 0; k < 6; k++) { const f0 = E.rnd() * 0.8, f1 = f0 + E.rr(0.05, 0.2), o = E.rr(-0.3, 0.3) * pw; E.line(x + (tx - x) * f0 + o, y + (ty - y) * f0, x + (tx - x) * f1 + o, y + (ty - y) * f1, T.sharp, hex('#2a3060'), { p: 0.5 }); }
    }
    const [ax, ay] = poleTop(P, P.h - 0.6), aw = 1.05 * m, th = Math.max(0.3, 0.11 * m / T.char.width);
    E.line(ax - aw, ay + 0.02 * m, ax + aw, ay - 0.02 * m, T.char, col, { p: 0.97, w: th, taper: 0, wob: 0.3 });
    if (m > 12) {
      E.line(ax - aw * 0.62, ay, ax, ay + 0.75 * m, T.sharp, col, { p: 0.9, taper: 0, w: Math.max(0.6, m / 60) });
      E.line(ax + aw * 0.62, ay, ax, ay + 0.75 * m, T.sharp, col, { p: 0.9, taper: 0, w: Math.max(0.6, m / 60) });
      E.line(ax - aw, ay - 0.03 * m, ax + aw, ay - 0.07 * m, T.sharp, hex('#e88a9a'), { p: 0.45 * fade, taper: 1 });
      for (const o of [-0.85, 0, 0.85]) {
        const ix = ax + o * m, iy = (o === 0 ? ty : ay) - 0.02 * m;
        E.line(ix, iy, ix, iy - 0.2 * m, T.char, col, { p: 0.95, w: Math.max(0.3, 0.09 * m / T.char.width), taper: 0 });
        if (m > 40) E.dot(ix - 0.02 * m, iy - 0.16 * m, 0.025 * m, T.chalk, hex('#b8b0dc'), { p: 0.7 });
      }
    }
    if (idx === 1 && m > 20) {
      const [cx, cy] = poleTop(P, P.h - 1.9);
      for (let i = 0; i < 7; i++) E.line(cx + pw * 0.5 + i * 0.06 * m, cy - 0.4 * m, cx + pw * 0.5 + i * 0.06 * m, cy + 0.4 * m, T.char, i > 4 ? hex('#5a3f6a') : DARK, { p: 0.97, w: 0.6, taper: 0 });
      E.line(cx + pw * 0.5 + 0.4 * m, cy - 0.38 * m, cx + pw * 0.5 + 0.4 * m, cy + 0.38 * m, T.sharp, hex('#f08a9a'), { p: 0.6 });
    }
  }
  function drawWires() {
    E.reseed(9600);
    const wc = hex('#1a1c44');
    const ends = [{ X: -11.5 + 0.2 * 19, Z: 7, lean: 0, h: 8.5 }].concat(POLE);
    for (let i = 0; i < ends.length - 1; i++) {
      const a = ends[i], b = ends[i + 1];
      const hs = [[-0.85, a.h - 0.4, 0.5], [0, a.h + 0.2, 0.55], [0.85, a.h - 0.4, 0.5], [0.12, a.h - 2.6, 0.75]];
      for (const [xo, hh, sag] of hs) {
        const pts = [];
        for (let k = 0; k <= 14; k++) {
          const t = k / 14, Z = a.Z + (b.Z - a.Z) * t, hgt = hh - sag * 4 * t * (1 - t);
          const X = a.X + (b.X - a.X) * t + xo + (a.lean + (b.lean - a.lean) * t) * hh;
          pts.push([VPX + F * X / Z, HY + F * (EH - hgt) / Z]);
        }
        const m = F / ((a.Z + b.Z) / 2), fade = sstep(5, 70, m);
        E.curve(pts, T.sharp, mix(hex('#5a4a80'), wc, fade), { p: 0.5 + 0.45 * fade, w: xo === 0.12 ? 1.5 : 1.0, taper: 0, wob: 0.35 });
        if (i < 2 && xo !== 0.12) E.curve(pts.map((p) => [p[0] + 1, p[1] - 2.2]), T.sharp, hex('#e890a0'), { p: 0.28, taper: 1, wob: 0.3, w: 0.7 });
      }
    }
  }

  // ================================================================ windsock, hanging straight down
  const WS = { X: XC + 13, Z: 34 };
  function drawWindsock() {
    const [x, y] = gp(WS.X, WS.Z), m = F / WS.Z, h = 6 * m;
    E.reseed(9700);
    if (!E.vis(x - 200, y - h - 80, x + 300, y + 20)) return;
    const tx = x - 6, ty = y - h;
    const bands = 9;
    for (let b = 0; b < bands; b++) {
      const f0 = b / bands, f1 = (b + 1) / bands, red = b % 2 === 1;
      for (const o of [-3.5, 0, 3.5]) {
        const c = red ? (o < 0 ? hex('#c8686a') : hex('#8a4660')) : (o < 0 ? hex('#e6d6dc') : o === 0 ? hex('#b4a8cc') : hex('#7a74a4'));
        E.line(x + (tx - x) * f0 + o, y + (ty - y) * f0, x + (tx - x) * f1 + o, y + (ty - y) * f1, T.char, c, { p: 0.97, w: 0.55, taper: 0, wob: 0.5 });
      }
    }
    E.line(x - 6, y, tx - 6, ty, T.sharp, hex('#ffc8a8'), { p: 0.6, taper: 0, wob: 0.5 });
    E.line(x + 6, y, tx + 6, ty, T.sharp, hex('#2a2a5a'), { p: 0.7, taper: 0, wob: 0.5 });
    // swivel arm and hoop
    const hx = tx + 44, hy = ty + 30;
    E.line(tx, ty + 6, hx, hy - 34, T.sharp, DARK, { p: 0.9, w: 1.6, taper: 0 });
    E.line(tx, ty + 58, hx, hy + 30, T.sharp, DARK, { p: 0.9, w: 1.6, taper: 0 });
    E.curve([[hx, hy - 38], [hx + 9, hy - 20], [hx + 10, hy + 8], [hx + 4, hy + 36], [hx - 5, hy + 12], [hx - 6, hy - 16], [hx, hy - 38]], T.sharp, hex('#d8cce0'), { p: 0.85, taper: 0, w: 1.3 });
    // the sock: nothing to fill it, so it folds at the hoop and hangs
    const cl = [[hx + 6, hy - 20], [hx + 30, hy + 22], [hx + 37, hy + 90], [hx + 30, hy + 170], [hx + 36, hy + 246], [hx + 28, hy + 312]];
    const cut = (t) => { const u = t * (cl.length - 1), i = Math.min(cl.length - 2, Math.floor(u)), f = u - i; return [cl[i][0] + (cl[i + 1][0] - cl[i][0]) * f, cl[i][1] + (cl[i + 1][1] - cl[i][1]) * f]; };
    const wAt = (t) => (36 - 19 * t) * (1 + 0.16 * Math.sin(t * 17 + 1));
    const NB = 6;
    for (let b = 0; b < NB; b++) {
      const orange = b % 2 === 0;
      for (let s = 0; s < 13; s++) {
        const u = (s + E.rnd()) / 13 * 2 - 1;
        const t0 = b / NB, t1 = (b + 1) / NB, pts = [];
        for (let k = 0; k <= 4; k++) { const t = t0 + (t1 - t0) * k / 4, p = cut(t); pts.push([p[0] + u * wAt(t), p[1]]); }
        const shade = clamp(0.5 + u * 0.6 + 0.25 * Math.sin(u * 7 + b), 0, 1);
        const c = orange ? mix(hex('#f08a5c'), hex('#8a4064'), shade) : mix(hex('#f1e2de'), hex('#7f78aa'), shade);
        E.curve(pts, T.tip, c, { p: 0.95, w: 0.5, taper: 0, tooth: 0.3, wob: 0.6 });
      }
    }
    for (const u of [-0.55, 0.1, 0.6]) {
      const pts = []; for (let k = 0; k <= 8; k++) { const t = 0.06 + 0.9 * k / 8, p = cut(t); pts.push([p[0] + (u + 0.12 * Math.sin(t * 9 + u * 5)) * wAt(t), p[1]]); }
      E.curve(pts, T.sharp, hex('#4a3a6a'), { p: 0.5, taper: 1 });
    }
    for (const sd of [-1, 1]) {
      const pts = []; for (let k = 0; k <= 10; k++) { const t = k / 10, p = cut(t); pts.push([p[0] + sd * wAt(t), p[1]]); }
      E.curve(pts, T.sharp, sd < 0 ? hex('#ffd0b0') : hex('#3a3060'), { p: sd < 0 ? 0.6 : 0.7, taper: 0, wob: 0.5 });
    }
    softGlow(tx, ty - 8, 34, hex('#ff8090'), hex('#ff4a6a'), 0.8, { n: 10 });
    E.dot(tx, ty - 8, 4, T.chalk, hex('#ffd0d0'), { p: 1.2 });
    E.line(tx, ty, tx, ty - 6, T.sharp, DARK, { p: 0.9, taper: 0 });
  }

  // ================================================================ grass, row by row, far to near
  const G_FAR = ['#3a3f6c', '#4a4a7a', '#2f3a64', '#5a4f80', '#44507a'].map(hex);
  const G_MID = ['#1f3552', '#274a5c', '#1a2c4a', '#2f5a62', '#35506e', '#223e58'].map(hex);
  const G_NEAR = ['#132640', '#1b3a4c', '#102038', '#245058', '#2c6064', '#16304a'].map(hex);
  const G_LIT = ['#3f5a3e', '#5f733c', '#8f8a3c', '#c99a45', '#e9c46a', '#f6e09a'].map(hex);
  const G_SKY = hex('#5f8f98'), G_PINK = hex('#b889a8'), G_ROSE = hex('#d8869a');
  const pick = (a) => a[Math.floor(E.rnd() * a.length)];
  function bladeCol(x, y, d, X, Z, I) {
    const r = E.rnd(), r2 = E.rnd();
    if (I > 0.05 && r2 < Math.min(0.9, I * 1.5)) {
      const k = clamp(I * 1.0 + (r - 0.5) * 0.5, 0, 0.999);
      return G_LIT[Math.floor(k * G_LIT.length)];
    }
    const patchy = fbm(X / 6, Z / 14, 95, 3);
    let c = d < 28 ? pick(G_FAR) : d < 210 ? pick(G_MID) : pick(G_NEAR);
    if (d < 60) c = mix(c, hex('#b0607f'), 0.4 * Math.exp(-sq((x - SUNX) / 900)) * Math.exp(-d / 45));
    if (r < 0.07 + 0.1 * patchy) c = mix(c, G_SKY, 0.55);
    else if (r < 0.10 + 0.1 * patchy) c = mix(c, d < 120 ? G_ROSE : G_PINK, 0.6);
    else if (patchy < 0.42) c = mix(c, hex('#0e1a36'), 0.35);
    return c;
  }
  function drawGrass(objs) {
    let oi = 0, row = 0;
    const hero = gp(XC + 5.0, LZ0), HX = hero[0], HYB = hero[1], HX2 = gp(XC - 5.0, LZ0)[0];
    for (let y = HY + 2; y < H + 330;) {
      const d = y - HY, bl = Math.max(3.5, 0.34 * d);
      while (oi < objs.length && objs[oi].y <= y) { objs[oi].fn(); oi++; }
      row++;
      E.reseed(20000 + row);
      if (E.vis(-100, y - bl * 2.5 - 14, W + 100, y + 8)) {
        const xs = Math.max(2.2, bl * 0.085), Z = gZ(y);
        const tool = bl < 60 ? T.pencil : T.tip;
        for (let x = -60 + E.rnd() * xs; x < W + 60; x += xs * E.rr(0.5, 1.5)) {
          const X = (x - VPX) * EH / d, Xr = X - XC, ax = Math.abs(Xr);
          // grass creeps in over the crumbling edge, and does not grow on the tarmac
          const lim = RW - 0.05 + 0.7 * (vnoise(Z / 1.3, Xr < 0 ? 2 : 8, 96) - 0.35);
          if (ax < lim && y > YEND) continue;
          const I = lampLight(X, Z);
          let hgt = E.rr(0.45, 1.15);
          const drift = fbm(X / 5 + 9, Z / 9, 97, 3), tall = fbm(X / 3 + 40, Z / 6, 98, 2);
          if (tall > 0.62 && E.rnd() < 0.3) hgt *= 1.7;
          if (ax < RW + 0.5) hgt *= 0.45 + 0.5 * E.rnd();
          if ((Math.abs(x - HX) < 100 || Math.abs(x - HX2) < 100) && y > HYB - 4 && y < HYB + 110) hgt *= 0.3;
          const lean = (n1(x / 310 + y / 97) - 0.5) * 0.5 + E.rr(-0.28, 0.28);
          const L = bl * hgt;
          const c = bladeCol(x, y, d, X, Z, I);
          const ex = x + Math.sin(lean) * L, ey = y - Math.cos(lean) * L;
          if (bl < 60) E.line(x, y, ex, ey, tool, c, { p: E.rr(0.7, 1), w: clamp(bl / 16, 0.8, 2.2), taper: 2, bow: E.rr(-0.14, 0.14), cover: 0.9, tooth: 0.7 });
          else E.line(x, y, ex, ey, tool, c, { p: E.rr(0.6, 0.95), w: clamp(bl / 150, 0.45, 1.3), w0: 1, w1: 0.25, taper: 2, bow: E.rr(-0.16, 0.16), tooth: 0.8 });
          // drifts of small pale flowers, and seed that has gone over
          const k = E.rnd();
          if (drift > 0.56 && k < 0.2 * sstep(0.56, 0.7, drift) * (1 - 0.75 * sstep(150, 420, d)) && d > 9) {
            const fc = I > 0.15 ? hex('#fff0c0') : (E.rnd() < 0.25 ? hex('#f0a8b8') : hex('#d6cef0'));
            const fr = clamp(bl * 0.05, 1.6, 7);
            for (let q = 0; q < 3; q++) {
              const fa = -1.5708 + E.rr(-0.9, 0.9), fx = ex + E.rr(-1, 1) * fr * 0.4, fy = ey + bl * 0.1 + E.rr(-1, 1) * fr * 0.3;
              E.line(fx, fy, fx + Math.cos(fa) * fr, fy + Math.sin(fa) * fr, T.pencil, fc, { p: E.rr(0.7, 1.1), w: clamp(fr * 0.22, 0.7, 1.5), taper: 2, cover: 0.95, tooth: 0.5 });
            }
          } else if (hgt > 1.5 && d > 20) {
            E.line(ex, ey, ex + Math.sin(lean) * bl * 0.3, ey - Math.cos(lean) * bl * 0.3, T.pencil, I > 0.15 ? hex('#e9c46a') : (k < 0.5 ? hex('#6f6494') : hex('#8a6a92')), { p: 0.85, w: clamp(bl / 26, 0.9, 2.2), taper: 1, cover: 0.9, tooth: 0.7 });
          }
        }
      }
      y += Math.max(1.6, bl * 0.11);
    }
    while (oi < objs.length) { objs[oi].fn(); oi++; }
  }

  // ================================================================ things growing through the tarmac, close to us
  function tuft(bx, by, n, len, spread, seed, opt) {
    E.reseed(seed);
    opt = opt || {};
    if (!E.vis(bx - len * 1.2, by - len * 1.3, bx + len * 1.2, by + 40)) return;
    const darks = ['#0d1830', '#122440', '#0f1e3a', '#183248', '#1c4050'].map(hex);
    const heads = [];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (E.rnd() + E.rnd() - 1) * spread + (opt.bias || 0), L = len * E.rr(0.35, 1), bend = E.rr(-1, 1), droop = E.rnd() < 0.3 ? E.rr(0.1, 0.35) : 0.03;
      const dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx;
      const b0 = [bx + E.rr(-0.14, 0.14) * len * 0.5, by + E.rr(-6, 6)];
      const p1 = [b0[0] + dx * L * 0.45 + px * bend * L * 0.06, b0[1] + dy * L * 0.45 + py * bend * L * 0.06];
      const p2 = [b0[0] + dx * L * 0.8 + px * bend * L * 0.2, b0[1] + dy * L * 0.8 + py * bend * L * 0.2 + droop * L * 0.25];
      const p3 = [b0[0] + dx * L + px * bend * L * 0.38, b0[1] + dy * L + py * bend * L * 0.38 + droop * L];
      const k = E.rnd();
      let c = pick(darks);
      const lit = opt.lit ? opt.lit(p2[0], p2[1]) : 0;
      if (lit > 0 && E.rnd() < lit) c = pick(G_LIT);
      E.curve([b0, p1, p2, p3], T.tip, c, { p: 1, w: clamp(L / 330, 0.4, 1.25) * E.rr(0.7, 1.1), w0: 1, w1: 0.16, taper: 0, tooth: 0.25, wob: 0.8 });
      if (k < 0.42) {
        const s = bend > 0 ? -1.5 : 1.5;
        E.curve([[p1[0] + s, p1[1]], [p2[0] + s, p2[1]], [p3[0] + s * 0.5, p3[1]]], T.sharp, k < 0.2 ? hex('#e88aa0') : hex('#6fa0a8'), { p: 0.55, taper: 1 });
      }
      if (E.rnd() < (opt.heads || 0.16) && L > len * 0.55) heads.push([p2, p3]);
    }
    for (const [p2, p3] of heads) {
      let dx = p3[0] - p2[0], dy = p3[1] - p2[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const hl = len * E.rr(0.09, 0.14);
      for (let j = 0; j < 26; j++) {
        const t = E.rnd(), wv = Math.sin(Math.PI * Math.pow(t, 0.8)) * hl * 0.13 + 1, sd = E.rnd() < 0.5 ? -1 : 1;
        const cx = p3[0] + dx * t * hl, cy = p3[1] + dy * t * hl;
        const ex = cx + dx * hl * 0.12 + sd * (-dy) * wv * E.rr(0.6, 1.5), ey = cy + dy * hl * 0.12 + sd * dx * wv * E.rr(0.6, 1.5);
        E.line(cx, cy, ex, ey, T.pencil, j % 5 === 0 ? hex('#d98aa0') : j % 3 === 0 ? hex('#4a4a7a') : hex('#131c3a'), { p: 0.9, w: 1.2, taper: 2, cover: 0.92, tooth: 0.4 });
      }
      E.line(p3[0], p3[1], p3[0] + dx * hl, p3[1] + dy * hl, T.tip, hex('#0f1832'), { p: 0.95, w: 0.4, w0: 1, w1: 0.3, taper: 0 });
    }
  }
  function flower(x, y, r, c) {
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * 6.283 + E.rr(-0.3, 0.3), l = r * E.rr(0.8, 1.15);
      E.line(x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.2, x + Math.cos(a) * l, y + Math.sin(a) * l * 0.75, T.chalk, c, { p: 1, w: Math.max(0.5, r / 9), taper: 3, tooth: 0.2 });
    }
    E.dot(x, y, Math.max(1.2, r * 0.22), T.chalk, hex('#e9b24a'), { p: 1 });
  }
  function drawForeground() {
    const hero = gp(XC + 5.0, LZ0);
    const heroLit = (x, y) => clamp(1.25 - Math.hypot(x - hero[0], (y - hero[1] + 20) * 1.6) / 420, 0, 0.9);
    E.reseed(1400);
    const crk = hex('#080a20');
    const jag = (pts, w) => { for (let k = 0; k < pts.length - 1; k++) E.line(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], T.sharp, crk, { p: 0.9, w, taper: 0, bow: 0, wob: 2.5 }); };
    jag([[120, 2175], [240, 2138], [330, 2126], [420, 2140], [520, 2132], [640, 2096], [760, 2088], [930, 2100]], 2.2);
    jag([[520, 2132], [560, 2150], [600, 2168]], 1.8);
    jag([[980, 2168], [1060, 2138], [1150, 2128], [1240, 2144], [1330, 2138], [1420, 2112], [1520, 2106]], 2);
    jag([[2380, 2160], [2470, 2130], [2560, 2120], [2640, 2132], [2700, 2126], [2810, 2100], [2900, 2096]], 2);
    jag([[3300, 2170], [3390, 2140], [3480, 2132], [3560, 2146], [3640, 2138], [3750, 2104], [3850, 2092]], 2);
    tuft(700, 2100, 12, 90, 0.7, 1410); tuft(1330, 2146, 14, 120, 0.8, 1411); tuft(2560, 2124, 16, 130, 0.75, 1412); tuft(2860, 2104, 9, 70, 0.8, 1413);
    tuft(1180, 2190, 26, 250, 0.62, 1414, { heads: 0.2 });
    tuft(600, 2200, 54, 520, 0.55, 1415, { heads: 0.24, bias: 0.1 });
    tuft(40, 2210, 30, 330, 0.6, 1416, { bias: 0.1 });
    tuft(3740, 2215, 44, 440, 0.55, 1417, { heads: 0.2, bias: -0.12, lit: heroLit });
    tuft(3520, 2230, 20, 240, 0.6, 1418, { lit: heroLit });
    // small pale flowers that nobody planted
    E.reseed(1420);
    const fl = [[436, 1998, 9], [500, 2046, 11], [612, 1975, 8], [690, 2058, 12], [380, 2090, 10], [760, 2015, 7], [90, 2060, 8], [1140, 2070, 8], [1215, 2040, 7], [1262, 2092, 9],
      [3585, 2020, 9], [3650, 2050, 10], [3700, 1990, 8], [3780, 2040, 11], [3660, 2090, 12], [2575, 2068, 6], [716, 2052, 6], [3480, 2120, 7]];
    for (const [x, y, r] of fl) {
      const lit = heroLit(x, y);
      E.line(x, y, x + E.rr(-8, 8), y + r * 6, T.sharp, hex('#1c3a4a'), { p: 0.8, taper: 0 });
      flower(x, y, r, mix(hex('#cfc6ea'), hex('#fff3c8'), clamp(lit * 1.4, 0, 1)));
    }
    // two or three moths, the only ones who came
    E.reseed(1430);
    const lx = hero[0], ly = hero[1] - 150;
    const moths = [[lx - 70, ly - 40, 0.5], [lx + 84, ly - 78, -0.7], [lx + 30, ly + 36, 2.2]];
    for (const [x, y, a] of moths) {
      const loop = [];
      for (let k = 0; k < 9; k++) { const t = k / 8; loop.push([x - Math.cos(a + t * 3.6) * (26 + 30 * t) + 20 * Math.cos(a), y - Math.sin(a + t * 3.6) * (16 + 22 * t) + 12 * Math.sin(a)]); }
      E.curve(loop, T.sharp, hex('#ffe6b0'), { p: 0.28, taper: 3, w: 0.8 });
      E.line(x, y, x - 9, y - 7, T.chalk, hex('#fff6dc'), { p: 1, w: 0.9, taper: 2 });
      E.line(x, y, x + 9, y - 6, T.chalk, hex('#fff6dc'), { p: 1, w: 0.9, taper: 2 });
      E.dot(x, y + 1, 1.6, T.chalk, hex('#e9c890'), { p: 1 });
    }
  }

  // the same slanting pencil that went over the sky goes over the land, so the whole sheet is one hand
  const pcsG = ['#141a40', '#1c2a66', '#2f6f7f', '#5a4a90', '#23406a'].map(hex);
  function hatchTarmac() {
    E.reseed(1500);
    for (let k = 0; k < 2; k++) {
      const sd = 120 + k;
      E.hatch({ inside: (x, y) => inRunway(x, y) && fbm(x / 260, y / 160, sd, 2) > 0.47, bbox: [0, HY + 60, W, H], angle: -0.62 + k * 0.13, spacing: 11 + k * 3, tool: T.pencil,
        color: () => pcsG[Math.floor(E.rnd() * pcsG.length)], p: (x, y) => 0.2 + 0.25 * sstep(HY + 60, HY + 400, y), len: [50, 190], endJit: 14, step: 5, angJit: 0.05, skip: 0.12 });
    }
  }
  function hatchGrass() {
    E.reseed(1510);
    const keep = [];
    LAMP.forEach((L) => { const m = F / L.Z; if (m >= 13 && L.on) { const q = gp(L.X, L.Z); keep.push([q[0], q[1] - LH * m * 0.8, (m >= 250 ? 1.9 : 2.3) * m + 24]); } });
    TAXI.forEach((L) => { const m = F / L.Z, q = gp(L.X, L.Z); keep.push([q[0], q[1] - 0.6 * m, 1.1 * m]); });
    const p0 = gp(POLE[0].X, POLE[0].Z)[0], ws = gp(WS.X, WS.Z), tw = gp(XC - 5, LZ0);
    const ok = (x, y) => {
      if (inRunway(x, y)) return false;
      if (Math.abs(x - p0) < 34 || (Math.abs(x - ws[0]) < 26 && y < ws[1] + 10) || (Math.abs(x - tw[0]) < 70 && Math.abs(y - tw[1] + 110) < 150)) return false;
      for (let i = 0; i < keep.length; i++) { const k = keep[i], dx = x - k[0], dy = y - k[1]; if (dx * dx + dy * dy < k[2] * k[2]) return false; }
      return true;
    };
    for (let k = 0; k < 2; k++) {
      const sd = 130 + k;
      E.hatch({ inside: (x, y) => ok(x, y) && fbm(x / 240, y / 150, sd, 2) > 0.46, bbox: [0, HY + 46, W, H], angle: -0.62 + k * 0.14, spacing: 10 + k * 3, tool: T.pencil,
        color: () => pcsG[Math.floor(E.rnd() * pcsG.length)], p: (x, y) => 0.2 + 0.22 * sstep(HY + 46, HY + 400, y), len: [40, 170], endJit: 14, step: 5, angJit: 0.05, skip: 0.12 });
    }
  }

  // ================================================================ order of work
  if (on('far')) drawFar();
  if (on('gbase')) drawGroundBase();
  if (on('runway')) drawRunway();
  if (on('puddles')) {
    drawPuddles();
    const p0 = gp(POLE[0].X, POLE[0].Z), ws = gp(WS.X, WS.Z);
    reflectLine(p0[0], p0[1], H, -0.02, hex('#141838'), 20, 1150, 0.6);
    reflectLine(ws[0], ws[1], ws[1] + 620, 0.01, hex('#b0a4c8'), 8, 1151, 0.45);
  }
  if (on('grass')) {
    const objs = [];
    LAMP.forEach((L, i) => objs.push({ y: gp(L.X, L.Z)[1], fn: () => drawLamp(L, i) }));
    POLE.forEach((P, i) => objs.push({ y: gp(P.X, P.Z)[1], fn: () => drawPole(P, i) }));
    objs.push({ y: gp(POLE[0].X, POLE[0].Z)[1] - 0.5, fn: drawWires });
    objs.push({ y: gp(WS.X, WS.Z)[1], fn: drawWindsock });
    TAXI.forEach((L, i) => objs.push({ y: gp(L.X, L.Z)[1], fn: () => drawTaxiLight(L, i) }));
    objs.push({ y: HY + 9, fn: drawEndLights });
    objs.push({ y: HY + 72, fn: drawMist });
    objs.sort((a, b) => a.y - b.y);
    drawGrass(objs);
  }
  if (on('ghatch')) hatchGrass();
  if (on('fore')) drawForeground();
};
