'use strict';
const { T, rng32, hex, clamp, lerp, mixc, sstep, vnoise, fbm } = require('./engine');
const { wob, wobPath, arc, curve, fillPoly, outline, pick, grad, jit } = require('./lib');
const { HZ, SUN, skyCol } = require('./sky');

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const rotX = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; };
const rotY = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; };
const rotZ = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; };
const LW = norm([0.72, -0.2, 0.66]); // toward the afterglow (camera space: x right, y up, z into the picture)
const CRAYON = ['#ff5a5a', '#3a8aff', '#ffcc3a', '#3ac88a', '#ff7ab8', '#ff8a3a', '#8a6aff'].map(hex);

// one folded dart. X,Y screen centre, size = length in px, h heading (0 = away from us, +90deg = to the right), p climb, r bank
function plane(cv, R, X, Y, size, h, p, r, o) {
  o = o || {};
  const el = Math.atan((HZ - Y) / 1598) * 1.0, az = Math.atan((X - 800) / 1598);
  const tf = v => { let q = rotZ(v, r); q = rotX(q, -p); q = rotY(q, h); q = rotY(q, -az * 0.6); q = rotX(q, -el - 0.12); return q; };
  const V = { N: [0, 0, 1], C: [0, 0.02, -1], L: [-0.6, 0.27, -1], Rr: [0.6, 0.27, -1], K: [0, -0.3, -1], FL: [-0.22, 0.1, -1], FR: [0.22, 0.1, -1] };
  const P = {}; for (const k in V) P[k] = tf(V[k]);
  const S = v => [X + v[0] * size * 0.5, Y - v[1] * size * 0.5];
  const sun = 1 - sstep(400, 505, Y);
  const faces = [['wl', ['N', 'L', 'C']], ['wr', ['N', 'C', 'Rr']], ['k', ['N', 'C', 'K']]];
  const fs = faces.map(([id, ks]) => {
    const a = P[ks[0]], b = P[ks[1]], c = P[ks[2]];
    let n = norm(cross(sub(b, a), sub(c, a)));
    const back = n[2] > 0; if (back) n = [-n[0], -n[1], -n[2]]; // face the camera (camera looks along +z)
    const d = n[0] * LW[0] + n[1] * LW[1] + n[2] * LW[2];
    // paper: reflects when lit from our side, glows through when lit from behind
    const refl = Math.max(0, d), trans = Math.max(0, -d);
    let col;
    const amb = mixc(hex('#8d8fd2'), hex('#cfd0f4'), clamp(0.5 + n[1] * 0.6, 0, 1));
    const warm = sstep(120, 430, Y);
    const litR = mixc(hex('#fffaea'), hex('#ffecc8'), warm), litT = mixc(hex('#ffe2b0'), hex('#ffb89c'), warm);
    const k = clamp(refl * 1.5 + trans * 1.25, 0, 1);
    const lit = refl >= trans ? litR : litT;
    col = mixc(mixc(amb, hex('#a58fd6'), 0.25 * sun), lit, sun * (0.12 + 0.88 * k));
    if (!sun || sun < 0.5) col = mixc(col, hex('#ffc6a6'), 0.22 * Math.max(0, n[0]) * (1 - sun));
    if (o.tint) col = mixc(col, o.tint, 0.25);
    return { id, pts: ks.map(q => S(P[q])), z: (a[2] + b[2] + c[2]) / 3, col, n, k };
  });
  fs.sort((a, b) => b.z - a.z);
  const ink = sun > 0.5 ? hex('#a9749c') : hex('#4a4c98');
  if (size < 5.2) {
    const a = S(P.N), b = S(P.L), c = S(P.Rr);
    const col = mixc(fs[fs.length - 1].col, hex('#fffbe8'), 0.25);
    cv.stroke([b, a, c], { ...T.oil, w: clamp(size * 0.3, 0.9, 1.6), col, P: 1.1, tin: 0, tout: 0 });
    if (size > 3.2 && sun > 0.5 && R() < 0.25) cv.dust(X, Y, size * 0.9, hex('#ffe8b8'), 0.25);
    return;
  }
  for (const f of fs) {
    const [a, b, c] = f.pts;
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    if (size < 16) fillPoly(cv, f.pts, { tool: T.oil, w: clamp(size * 0.14, 1.1, 2.2), col: f.col, P: 1.12, ang, sp: 0.6, over: 0.2 }, R);
    else {
      fillPoly(cv, f.pts, { tool: T.ptip, w: clamp(size * 0.07, 2, 6), col: f.col, P: 1.12, ang, sp: 0.55, over: 0.4, cj: 0.01 }, R);
      fillPoly(cv, f.pts, { tool: T.pencil, w: 1.2, col: mixc(f.col, f.k > 0.5 ? hex('#ffa27a') : hex('#5a5cb0'), 0.4), P: 0.45, ang: ang + 0.25 + (R() - 0.5) * 0.3, sp: 3.6, jit: 0.8, wob: 0.8, bow: 0.02 }, R);
    }
  }
  if (size >= 16) {
    // crayon scribbles on the wings of the near ones
    if (size >= 44) {
      for (const f of fs) {
        if (f.id === 'k') continue;
        const [a, b, c] = f.pts, cr = CRAYON[(R() * CRAYON.length) | 0], style = (R() * 3) | 0;
        const at = (u, v) => [a[0] + (b[0] - a[0]) * u + (c[0] - a[0]) * v, a[1] + (b[1] - a[1]) * u + (c[1] - a[1]) * v];
        const col = mixc(cr, f.col, 0.3);
        if (style === 0) for (let k = 0; k < 3; k++) { const u = 0.45 + k * 0.15; const p0 = at(u * 0.82, u * 0.1), p1 = at(u * 0.36, u * 0.56); cv.stroke(wob(p0[0], p0[1], p1[0], p1[1], R, 0.6, 0.03), { ...T.oil, w: clamp(size * 0.028, 1.6, 4), col, P: 0.78 }); }
        else if (style === 1) { const zz = []; for (let k = 0; k <= 7; k++) { const t = k / 7; zz.push(at(0.2 + 0.3 * t + (k % 2 ? 0.07 : 0), 0.16 + 0.26 * t + (k % 2 ? -0.05 : 0.05))); } cv.stroke(zz, { ...T.oil, w: clamp(size * 0.024, 1.5, 3.4), col, P: 0.78 }); }
        else for (let k = 0; k < 5; k++) { const q = at(0.26 + R() * 0.26, 0.14 + R() * 0.22); cv.stroke(arc(q[0], q[1], size * 0.025, size * 0.02, 0, 6.3, R, 0.3), { ...T.oil, w: clamp(size * 0.022, 1.4, 3), col: mixc(CRAYON[(R() * 7) | 0], f.col, 0.3), P: 0.8 }); }
      }
    }
    const n = S(P.N), c = S(P.C), l = S(P.L), rr = S(P.Rr), kk = S(P.K);
    const lw = clamp(size * 0.012, 1.0, 1.9);
    const ln = (a, b, col, P0, w) => cv.stroke(wob(a[0], a[1], b[0], b[1], R, Math.min(0.7, size * 0.006), 0.006), { ...T.pencil, w: w || lw, col, P: P0 });
    { const fl = S(P.FL), fr = S(P.FR); ln(n, fl, ink, 0.45, lw * 0.8); ln(n, fr, ink, 0.45, lw * 0.8); }
    ln(n, c, ink, 0.85); ln(l, c, ink, 0.6); ln(c, rr, ink, 0.6); ln(n, l, ink, 0.75); ln(n, rr, ink, 0.75); ln(n, kk, ink, 0.7); ln(kk, c, ink, 0.6);
    // the lit leading edge, pressed hard with the cream stick
    const top = fs[fs.length - 1], e = top.id === 'wl' ? [n, l] : top.id === 'wr' ? [n, rr] : [n, kk];
    if (sun > 0.3 || true) cv.stroke(wob(e[0][0], e[0][1], e[1][0], e[1][1], R, 0.4, 0.004), { ...T.oil, w: lw * 0.9, col: sun > 0.5 ? hex('#fffdf0') : hex('#ffd8c4'), P: 0.75, tin: 0.15, tout: 0.3 });
    // a breath of air behind it
    if (size >= 30 && !o.still) {
      const dir = norm(sub(P.C, P.N)), dx = dir[0], dy = -dir[1], dl = Math.hypot(dx, dy) || 1;
      for (let k = 0; k < 3; k++) {
        const s0 = S(k === 0 ? P.L : k === 1 ? P.Rr : P.K), g = size * (0.12 + R() * 0.1), L = size * (0.25 + R() * 0.3) * dl;
        cv.stroke(wob(s0[0] + dx / dl * g, s0[1] + dy / dl * g, s0[0] + dx / dl * (g + L), s0[1] + dy / dl * (g + L), R, 0.5, 0.02), { ...T.pencil, w: 1, col: sun > 0.5 ? hex('#ffe9c8') : hex('#c4c8f4'), P: 0.5, tin: 0.1, tout: 0.6 });
      }
    }
  }
}

function drawPlanes(cv, seed) {
  const R = rng32(seed), list = [];
  // the river of paper: out of the upstairs window on the left, across the town, up into the light
  const CP = [[236, 842], [330, 770], [470, 680], [640, 580], [800, 478], [930, 380], [1010, 290], [1070, 200], [1140, 118], [1240, 56], [1370, 22], [1500, 26], [1620, 60]];
  const river = curve(CP, 24), NR = river.length;
  const sizeAt = t => 6.5 + 30 * Math.pow(1 - t, 1.25) * (0.3 + 0.7 * Math.sin(Math.PI * Math.min(1, t * 1.7 + 0.12)));
  for (let i = 0; i < 330; i++) {
    const t = Math.pow(R(), 0.82), idx = Math.min(NR - 2, (t * (NR - 1)) | 0);
    const a = river[idx], b = river[idx + 1], dx = b[0] - a[0], dy = b[1] - a[1], dl = Math.hypot(dx, dy) || 1;
    const spread = (14 + 70 * Math.sin(Math.PI * Math.min(1, t * 1.25)) + 30 * t) * (R() + R() + R() - 1.5) * 0.9;
    const X = a[0] - dy / dl * spread + (R() - 0.5) * 20, Y = a[1] + dx / dl * spread * 0.8 + (R() - 0.5) * 14;
    const size = sizeAt(t) * (0.55 + 0.9 * R() * R() + 0.2);
    const h = Math.atan2(dx / dl, 1.1) + (R() - 0.5) * 0.7, p = Math.atan2(-dy / dl, 1.6) * 0.8 + (R() - 0.5) * 0.4;
    list.push({ X, Y, size, h, p, r: (R() - 0.5) * 1.3 });
  }
  // tributaries rising from the lit windows of the low town
  const src = [[520, 838], [640, 800], [760, 850], [900, 806], [1010, 830], [1130, 790], [1260, 812], [1390, 800], [1500, 826], [1640, 800], [1780, 815], [860, 880], [690, 870], [1700, 838], [430, 790], [320, 760], [1880, 800]];
  for (const [sx, sy] of src) {
    const jt = 0.3 + R() * 0.5, j = river[(jt * (NR - 1)) | 0];
    const mid = [(sx + j[0]) / 2 + (R() - 0.5) * 160 + (sx > j[0] ? 40 : -40), (sy + j[1]) / 2 + 60 + R() * 60];
    const path = curve([[sx, sy], [sx + (mid[0] - sx) * 0.4, sy - 30 - R() * 30], mid, j], 14);
    const n = 13 + (R() * 13 | 0);
    for (let i = 0; i < n; i++) {
      const t = Math.pow(R(), 0.7), idx = Math.min(path.length - 2, (t * (path.length - 1)) | 0), a = path[idx], b = path[idx + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1], dl = Math.hypot(dx, dy) || 1;
      list.push({ X: a[0] + (R() - 0.5) * (10 + 50 * t), Y: a[1] + (R() - 0.5) * (8 + 34 * t), size: 2.6 + R() * 2.4 + t * 2.2, h: Math.atan2(dx / dl, 1) + (R() - 0.5), p: 0.3 + (R() - 0.5) * 0.5, r: (R() - 0.5) * 1.2 });
    }
  }
  // strays everywhere over the town: every window is letting one go
  for (let i = 0; i < 190; i++) { const X = R() * 1920, Y = 520 + Math.pow(R(), 0.8) * 350; list.push({ X, Y, size: 2.4 + R() * 2.6, h: 0.5 + (R() - 0.5) * 1.6, p: 0.3 + (R() - 0.5) * 0.6, r: (R() - 0.5) * 1.2 }); }
  for (let i = 0; i < 120; i++) { const X = 700 + R() * 1220, Y = 30 + R() * 500; list.push({ X, Y, size: 2.2 + R() * 2.4, h: 0.5 + (R() - 0.5) * 1.6, p: 0.4 + (R() - 0.5) * 0.6, r: (R() - 0.5) * 1.2 }); }
  // the near ones, placed by hand
  const hero = [
    { X: 800, Y: 232, size: 200, h: 0.85, p: 0.3, r: -0.75 },
    { X: 452, Y: 428, size: 104, h: 0.95, p: 0.2, r: 0.5 },
    { X: 1326, Y: 712, size: 92, h: 1.05, p: 0.3, r: -0.5 },
    { X: 96, Y: 250, size: 132, h: 1.2, p: 0.1, r: 0.25 },
    { X: 1790, Y: 250, size: 62, h: -0.5, p: 0.5, r: 0.5 },
    { X: 626, Y: 742, size: 58, h: 0.75, p: 0.3, r: -0.3 },
    { X: 1612, Y: 552, size: 46, h: 1.0, p: 0.35, r: 0.4 },
  ];
  list.sort((a, b) => a.size - b.size);
  for (const q of list) {
    if (q.X < -30 || q.X > 1950 || q.Y < -20) continue;
    if (q.X > 580 && q.X < 660 && q.Y > 712 && q.Y < 780) continue; // keep the pole top clear
    plane(cv, R, q.X, q.Y, q.size, q.h, q.p, q.r);
  }
  for (const q of hero.sort((a, b) => a.size - b.size)) plane(cv, R, q.X, q.Y, q.size, q.h, q.p, q.r);
  // the very highest ones are only glints now
  for (let i = 0; i < 11; i++) {
    const t = 0.78 + R() * 0.22, a = river[Math.min(NR - 1, (t * (NR - 1)) | 0)], x = a[0] + (R() - 0.5) * 170, y = a[1] + (R() - 0.5) * 80, s = 2 + R() * R() * 8;
    if (y < 4) continue;
    cv.stroke(wob(x - s, y, x + s, y, R, 0.2, 0), { ...T.pencil, w: 0.9, col: hex('#fff8dc'), P: 0.8, tin: 0.45, tout: 0.45 });
    cv.stroke(wob(x, y - s, x, y + s, R, 0.2, 0), { ...T.pencil, w: 0.9, col: hex('#fff8dc'), P: 0.8, tin: 0.45, tout: 0.45 });
    cv.stroke([[x - 0.4, y], [x + 0.4, y]], { ...T.oil, w: 1.8, col: hex('#ffffff'), P: 1.2 });
  }
}
module.exports = { drawPlanes, plane };
