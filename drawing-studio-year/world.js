/* A YEAR, STILL WARM — the place.
 *
 * The geometry is the original drawing's own (drawing-studio/scene.js is loaded,
 * not copied): the same shoreline, hills, meadow, hollow, trunk and limbs, in the
 * same 1600 x 900 design space. A film frame is a taller window onto that space,
 * so the sheet had to be extended upwards into sky and downwards into foreground,
 * the crown of the tree finished where the old sheet cut it off, and the worn
 * path bent round to come in from the bottom edge instead of the left.
 *
 * This file also lays the patient layers: every stroke of sky, sea, hill, meadow,
 * earth and bark, placed once with the original passes' tools, widths, lengths
 * and hatching angles, and remembered by the engine grain by grain.
 */
'use strict';
const path = require('path'), fs = require('fs'), crypto = require('crypto'), zlib = require('zlib');
const ORIG = path.join(__dirname, '..', 'drawing-studio');
const { createEngine: origEngine } = require(path.join(ORIG, 'engine.js'));
const { createScene: origScene } = require(path.join(ORIG, 'scene.js'));
const { createEngine } = require('./engine.js');

// the two sheets: where the window sits on the (extended) original design space
const FORMATS = {
  v: { name: '9x16', W: 1080, H: 1920, SC: 1.2, OX: 565, OY: -404 },     // tall: a great deal of sky
  p: { name: '4x5', W: 1080, H: 1350, SC: 1.02, OX: 462, OY: -150 },     // portrait: stands a step further back, trims the sky
};
const REG = { NONE: 0, SKY: 1, FAR: 3, WATER: 4, MID: 5, MEADOW: 6, PATH: 7, TRUNK: 8 };
const KIND = { UDUST: 0, UCRAY: 1, DUST: 2, CRAYON: 3, PENCIL: 4, LINE: 5 };
const VERSION = 'w7';

function createWorld(fmtKey, scale, opt) {
  opt = opt || {};
  const fm = FORMATS[fmtKey], sc = scale || 1;
  const W = Math.round(fm.W * sc), H = Math.round(fm.H * sc);
  const E = createEngine({ W, H, SC: fm.SC * sc, OX: fm.OX, OY: fm.OY, PS: 1.2 * sc, seed: 19940611 });
  const o0 = origEngine(64), Sc = origScene(o0);                 // the original's geometry, untouched
  const { vnoise, fbm, c01, sstep, R, rr, PX, PY, PP, TOOLS } = E;
  const X0 = fm.OX, Y0 = fm.OY, X1 = fm.OX + fm.W / fm.SC, Y1 = fm.OY + fm.H / fm.SC;
  const HOR = Sc.HOR, NEST = Sc.NEST;

  // ---------- the path, worn by coming back; now it comes up from the bottom of the sheet
  const PATH = [];
  (function () {
    const P = [[868, 763], [800, 786], [712, 818], [640, 862], [614, 915], [640, 985], [706, 1070], [768, 1160], [800, 1262], [816, 1340]];
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[Math.max(0, i - 1)], b = P[i], c = P[i + 1], d = P[Math.min(P.length - 1, i + 2)];
      for (let j = 0; j < 24; j++) {
        const t = j / 24, t2 = t * t, t3 = t2 * t;
        PATH.push([0.5 * ((2 * b[0]) + (-a[0] + c[0]) * t + (2 * a[0] - 5 * b[0] + 4 * c[0] - d[0]) * t2 + (-a[0] + 3 * b[0] - 3 * c[0] + d[0]) * t3),
          0.5 * ((2 * b[1]) + (-a[1] + c[1]) * t + (2 * a[1] - 5 * b[1] + 4 * c[1] - d[1]) * t2 + (-a[1] + 3 * b[1] - 3 * c[1] + d[1]) * t3)]);
      }
    }
  })();
  const depthScale = y => Math.max(0.12, (y - 520) / 222);
  const pathW = y => (13 + 34 * sstep(763, 905, y)) * depthScale(y);
  const ds = y => Math.max(0.3, Math.min(depthScale(y), 0.3 + 1.25 * Math.pow(c01((y - 600) / 300), 1.15) + Math.max(0, y - 900) / 222));
  const lean = (x, y) => -1.5708 + 0.75 * (fbm(x / 130, y / 60, 51, 2) - 0.5);

  // ---------- regions, grain by grain
  function buildRegions() {
    const reg = E.reg, SCp = E.SC, PSs = E.PS;
    const pm = new Uint8Array(E.N);
    for (let i = 0; i < PATH.length; i++) {
      const px = PATH[i][0], py = PATH[i][1], hw = pathW(py) / 2 + 3;
      const x0 = Math.max(0, ((px - hw - X0) * SCp) | 0), x1 = Math.min(W - 1, ((px + hw - X0) * SCp) | 0), y0 = Math.max(0, ((py - hw * 0.6 - Y0) * SCp) | 0), y1 = Math.min(H - 1, ((py + hw * 0.6 - Y0) * SCp) | 0);
      for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
        const x = gx / SCp + X0, y = gy / SCp + Y0;
        const d = Math.hypot(x - px, (y - py) * 2.1);
        if (d < (pathW(py) / 2) * (0.78 + 0.5 * fbm(x / 13, y / 5, 61, 2))) pm[gy * W + gx] = 1;
      }
    }
    for (let gy = 0; gy < H; gy++) {
      const y = (gy + 0.5) / SCp + Y0, fy = gy / PSs;
      for (let gx = 0; gx < W; gx++) {
        const x = (gx + 0.5) / SCp + X0, fx = gx / PSs, i = gy * W + gx;
        // a ragged edge where the hand stopped before the sheet did
        const mL = 3.5 + 5 * vnoise(fy / 34, 0.5, 91), mR = W / PSs - 3.5 - 5 * vnoise(fy / 31, 2.5, 92), mT = 3.5 + 5 * vnoise(fx / 36, 4.5, 93), mB = H / PSs - 3.5 - 5 * vnoise(fx / 33, 6.5, 94);
        if (fx < mL || fx > mR || fy < mT || fy > mB) { reg[i] = 0; continue; }
        let r;
        if (x > 860 && x < 1470 && y > 180 && y < 730 && Sc.trunkInfo(x, y).q < 1) r = REG.TRUNK;
        else if (y > Sc.groundY(x) - 2.2 * fbm(x / 3.1, y / 9, 71, 2)) r = pm[i] ? REG.PATH : REG.MEADOW;
        else if (y > Sc.midY(x)) r = REG.MID;
        else if (y > HOR) r = REG.WATER;
        else if (y > HOR - Sc.farH(x)) r = REG.FAR;
        else r = REG.SKY;
        reg[i] = r;
      }
    }
  }

  // ---------- the stroke ledger
  const L = { n: 0, x: [], y: [], reg: [], kind: [], j0: [], j1: [], j2: [], j3: [], dk: [], len: [], ang: [] };
  function newStroke(x, y, reg, kind, dk, len, ang) {
    L.x.push(x); L.y.push(y); L.reg.push(reg); L.kind.push(kind); L.j0.push(R()); L.j1.push(R()); L.j2.push(R()); L.j3.push(R()); L.dk.push(dk === undefined ? 1 : dk); L.len.push(len || 0); L.ang.push(ang || 0);
    return L.n++;
  }

  // one pass of hatching over a region, the way the original hand moved (tool, cell, width, length, angle)
  function pass(o) {
    const T = o.tool, bb = o.bbox || [X0, Y0, X1, Y1], cell = o.cell, regId = o.reg;
    const bx0 = Math.max(X0 - 4, bb[0]), by0 = Math.max(Y0 - 4, bb[1]), bx1 = Math.min(X1 + 4, bb[2]), by1 = Math.min(Y1 + 4, bb[3]);
    const seeds = [];
    for (let y = by0; y < by1; y += cell) for (let x = bx0; x < bx1; x += cell) seeds.push(x + R() * cell, y + R() * cell);
    const ns = seeds.length / 2;
    for (let i = ns - 1; i > 0; i--) {
      const j = (R() * (i + 1)) | 0;
      let t = seeds[i * 2]; seeds[i * 2] = seeds[j * 2]; seeds[j * 2] = t;
      t = seeds[i * 2 + 1]; seeds[i * 2 + 1] = seeds[j * 2 + 1]; seeds[j * 2 + 1] = t;
    }
    const inside = (x, y) => E.regAt(x, y) === regId;
    const edge = o.edge === undefined ? 0.4 : o.edge, wobA = o.wob === undefined ? 0.35 : o.wob, skip = o.skip || 0;
    const bx = new Float32Array(512), by = new Float32Array(512);
    for (let si = 0; si < ns; si++) {
      const sx = seeds[si * 2], sy = seeds[si * 2 + 1];
      if (!inside(sx, sy)) continue;
      if (skip && R() < skip) continue;
      const p = (o.p[0] + (o.p[1] - o.p[0]) * (0.25 + 0.75 * R())) * (0.82 + 0.36 * fbm(sx / 170, sy / 170, 77, 2));
      const ls = o.lenScale ? o.lenScale(sx, sy) : 1;
      const len = rr(o.len[0], o.len[1]) * ls, w = rr(o.w[0], o.w[1]) * (o.wScale ? o.wScale(sx, sy) : 1);
      const a0 = o.ang(sx, sy) + (R() - 0.5) * (o.angJit === undefined ? 0.3 : o.angJit) + 0.55 * (fbm(sx / 210, sy / 210, 78, 2) - 0.5);
      const step = Math.min(2.4, Math.max(0.7, len / 8)), hw = w * edge, kc = (R() - 0.5) * 2 * (o.curve || 0) / Math.max(4, len);
      let nb = 0, x = sx, y = sy, a = a0 + Math.PI, s = 0, lim = len * rr(0.35, 0.65);
      const ok = (x, y, a) => {
        if (!inside(x, y)) return false;
        if (hw > 0.45) { const qx = -Math.sin(a) * hw, qy = Math.cos(a) * hw; if (!inside(x + qx, y + qy) || !inside(x - qx, y - qy)) return false; }
        return true;
      };
      while (s < lim && nb < 250) { a -= kc * step; x += Math.cos(a) * step; y += Math.sin(a) * step; if (!ok(x, y, a)) break; bx[nb] = x; by[nb] = y; nb++; s += step; }
      let n = 0;
      for (let i = nb - 1; i >= 0; i--) { PX[n] = bx[i]; PY[n] = by[i]; n++; }
      PX[n] = sx; PY[n] = sy; n++;
      x = sx; y = sy; a = a0; s = 0; lim = len - lim;
      while (s < lim && n < 500) { a += kc * step; x += Math.cos(a) * step; y += Math.sin(a) * step; if (!ok(x, y, a)) break; PX[n] = x; PY[n] = y; n++; s += step; }
      if (n < 2) { if (o.dots) { PP[0] = p; E.strokeRec(1, w, T, newStroke(sx, sy, regId, o.kind, 1, 0, a0), 1); } continue; }
      if ((n - 1) * step < (o.minLen || 0)) continue;
      const ph1 = R() * 6.28, ph2 = R() * 6.28, ca = Math.cos(a0), sa_ = Math.sin(a0);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const taper = Math.min(1, t / 0.12 + 0.5) * Math.min(1, (1 - t) / 0.28 + 0.22);
        PP[i] = p * taper * (0.88 + 0.24 * R());
        const wv = wobA * (0.6 * Math.sin(i * step * 0.31 + ph1) + Math.sin(i * step * 0.09 + ph2));
        PX[i] += -sa_ * wv; PY[i] += ca * wv;
      }
      const m = n >> 1;
      E.strokeRec(n, w, T, newStroke(PX[m], PY[m], regId, o.kind, 1, (n - 1) * step, a0), o.op === undefined ? 1 : o.op);
    }
  }

  // free-hand line through control points (Catmull-Rom, with tremor) — the original's
  function pathPts(pts, o) {
    o = o || {};
    const step = o.step || 1.4, wob = o.wob === undefined ? 0.3 : o.wob, p0 = o.p0 === undefined ? 0.5 : o.p0, p1 = o.p1 === undefined ? 0.5 : o.p1, pm = o.press === undefined ? 1 : o.press;
    let n = 0; const ph1 = R() * 6.28, ph2 = R() * 6.28;
    const m = pts.length;
    if (m === 1) { PX[0] = pts[0][0]; PY[0] = pts[0][1]; PP[0] = pm; return 1; }
    let total = 0; for (let i = 0; i < m - 1; i++) total += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    let acc = 0;
    for (let i = 0; i < m - 1; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[i + 1], d = pts[Math.min(m - 1, i + 2)];
      const Ls = Math.hypot(c[0] - b[0], c[1] - b[1]), k = Math.max(1, Math.round(Ls / step));
      for (let j = 0; j < k + (i === m - 2 ? 1 : 0); j++) {
        const t = j / k, t2 = t * t, t3 = t2 * t;
        const x = 0.5 * ((2 * b[0]) + (-a[0] + c[0]) * t + (2 * a[0] - 5 * b[0] + 4 * c[0] - d[0]) * t2 + (-a[0] + 3 * b[0] - 3 * c[0] + d[0]) * t3);
        const y = 0.5 * ((2 * b[1]) + (-a[1] + c[1]) * t + (2 * a[1] - 5 * b[1] + 4 * c[1] - d[1]) * t2 + (-a[1] + 3 * b[1] - 3 * c[1] + d[1]) * t3);
        const u = (acc + Ls * t) / (total || 1), sdist = acc + Ls * t;
        const nx = -(c[1] - b[1]) / (Ls || 1), ny = (c[0] - b[0]) / (Ls || 1);
        const wv = wob * (0.6 * Math.sin(sdist * 0.33 + ph1) + Math.sin(sdist * 0.085 + ph2));
        if (n >= E.MAXP - 1) break;
        PX[n] = x + nx * wv; PY[n] = y + ny * wv;
        const tp = Math.min(1, u / 0.12 * (1 - p0) + p0) * Math.min(1, (1 - u) / 0.2 * (1 - p1) + p1);
        PP[n] = pm * tp * (0.9 + 0.2 * R());
        n++;
      }
      acc += Ls;
    }
    return n;
  }
  function line(pts, w, T, reg, dk, o) {
    const n = pathPts(pts, o), m = pts[pts.length >> 1];
    E.strokeRec(n, w, T, newStroke(m[0], m[1], reg, KIND.LINE, dk, 0, 0), o && o.op);
  }

  function drawStatic(log) {
    const { CRAYON, PENCIL, DUST } = TOOLS;
    const A = REG, tick = s => log && log(s);
    // ---- the first bright layer under everything warm (it is what the pin finds later)
    for (const r of [A.MEADOW, A.PATH, A.TRUNK]) pass({ reg: r, kind: KIND.UDUST, tool: DUST, cell: 13, w: [14, 24], len: [50, 140], ang: () => -0.5, angJit: 0.6, p: [0.6, 0.9], curve: 0.3, edge: 0.1 });
    for (const r of [A.MEADOW, A.PATH, A.TRUNK]) pass({ reg: r, kind: KIND.UCRAY, tool: CRAYON, cell: 10, w: [8, 13], len: [50, 130], ang: () => -0.62, angJit: 0.5, p: [0.3, 0.8], curve: 0.3, edge: 0.15, skip: 0.25 });
    tick('first bright layer');
    // ---- sky: thumb-rubbed chalk dust, then wax, then pencil
    pass({ reg: A.SKY, kind: KIND.DUST, tool: DUST, cell: 26, w: [30, 52], len: [140, 320], ang: () => -0.42, angJit: 0.25, p: [0.6, 0.85], curve: 0.2, edge: 0.12 });
    pass({ reg: A.SKY, kind: KIND.DUST, tool: DUST, cell: 17, w: [18, 30], len: [80, 220], ang: () => 0.06, angJit: 0.2, p: [0.55, 0.8], curve: 0.2, edge: 0.15 });
    pass({ reg: A.SKY, kind: KIND.DUST, tool: DUST, cell: 8, w: [7, 12], len: [20, 60], ang: () => -0.42, angJit: 0.8, p: [0.55, 0.8], curve: 0.2, edge: 0.05, skip: 0.3 });
    for (const r of [A.FAR, A.WATER, A.MID]) pass({ reg: r, kind: KIND.DUST, tool: DUST, cell: 7, w: [7, 12], len: [16, 60], ang: () => -0.3, angJit: 0.8, p: [0.6, 0.85], curve: 0.3, edge: 0.1 });
    tick('chalk dust, rubbed in');
    pass({ reg: A.SKY, kind: KIND.CRAYON, tool: CRAYON, cell: 9, w: [7, 12], len: [50, 150], ang: () => -0.55, angJit: 0.35, p: [0.3, 0.78], curve: 0.3, skip: 0.12 });
    pass({ reg: A.SKY, kind: KIND.CRAYON, tool: CRAYON, cell: 7, w: [4, 7], len: [30, 90], ang: () => 0.3, angJit: 0.35, p: [0.3, 0.75], curve: 0.3, skip: 0.3 });
    tick('sky wax');
    pass({ reg: A.SKY, kind: KIND.PENCIL, tool: PENCIL, cell: 3.4, w: [1.7, 2.6], len: [18, 60], ang: () => -0.58, angJit: 0.3, p: [0.35, 0.8], curve: 0.25, edge: 0.2 });
    pass({ reg: A.SKY, kind: KIND.PENCIL, tool: PENCIL, cell: 2.8, w: [1.5, 2.3], len: [12, 44], ang: () => -0.5, angJit: 0.6, p: [0.3, 0.8], curve: 0.25, edge: 0.1, skip: 0.45 });
    tick('sky pencil');
    // ---- far shore, water, middle hills
    const FB = [X0, 500, X1, 570], WB = [X0, 550, X1, 640], MB = [X0, 560, X1, 660];
    pass({ reg: A.FAR, kind: KIND.CRAYON, tool: CRAYON, bbox: FB, cell: 4, w: [3, 5], len: [10, 34], ang: () => -0.5, p: [0.35, 0.8], edge: 0.3 });
    pass({ reg: A.FAR, kind: KIND.PENCIL, tool: PENCIL, bbox: FB, cell: 2.2, w: [1.5, 2.2], len: [6, 22], ang: () => -0.6, p: [0.35, 0.8], edge: 0.1 });
    pass({ reg: A.WATER, kind: KIND.CRAYON, tool: CRAYON, bbox: WB, cell: 4.5, w: [2.6, 4.6], len: [30, 130], ang: () => 0, angJit: 0.04, p: [0.3, 0.8], edge: 0.3, curve: 0.02 });
    pass({ reg: A.WATER, kind: KIND.PENCIL, tool: PENCIL, bbox: WB, cell: 2.4, w: [1.4, 2.2], len: [12, 80], ang: () => 0, angJit: 0.05, p: [0.3, 0.8], edge: 0.1, curve: 0.02 });
    pass({ reg: A.WATER, kind: KIND.PENCIL, tool: PENCIL, bbox: WB, cell: 2.2, w: [1.3, 2.0], len: [8, 50], ang: () => 0, angJit: 0.05, p: [0.3, 0.8], edge: 0.1, curve: 0.02, skip: 0.4 });
    pass({ reg: A.MID, kind: KIND.CRAYON, tool: CRAYON, bbox: MB, cell: 5, w: [3.5, 6], len: [14, 50], ang: () => -0.9, p: [0.4, 0.85], edge: 0.3 });
    pass({ reg: A.MID, kind: KIND.PENCIL, tool: PENCIL, bbox: MB, cell: 2.3, w: [1.6, 2.4], len: [6, 26], ang: () => -1.0, angJit: 0.5, p: [0.4, 0.85], edge: 0.1 });
    pass({ reg: A.MID, kind: KIND.PENCIL, tool: PENCIL, bbox: MB, cell: 2.3, w: [1.5, 2.2], len: [5, 18], ang: () => -1.57, angJit: 0.5, p: [0.4, 0.85], edge: 0.1, skip: 0.4 });
    // the pencil lines of the land: far shore, crest of the middle hills, where water meets sky
    for (let x0 = X0 + 6; x0 < X1 - 8;) {
      const Ls = rr(40, 150), pts = [];
      for (let x = x0; x < Math.min(X1 - 6, x0 + Ls); x += 6) { const h = Sc.farH(x); if (h > 0.6) pts.push([x, HOR - h - 0.3]); }
      if (pts.length > 2) line(pts, 1.0, PENCIL, A.FAR, 0.62, { press: rr(0.25, 0.45), wob: 0.3 });
      x0 += Ls + rr(0, 30);
    }
    for (let x0 = X0 + 6; x0 < X1 - 8;) {
      const Ls = rr(30, 120), pts = [];
      for (let x = x0; x < Math.min(X1 - 6, x0 + Ls); x += 2.5) { const y = Sc.midY(x); if (y < Sc.groundY(x) - 2 && E.regAt(x, y + 2) === A.MID) pts.push([x, y - 0.2]); }
      if (pts.length > 2) line(pts, 1.1, PENCIL, A.MID, 0.5, { press: rr(0.3, 0.55), wob: 0.25 });
      x0 += Ls + rr(0, 24);
    }
    line([[X0 + 16, HOR + 0.6], [X0 + 300, HOR + 0.2], [X0 + 620, HOR + 0.7], [X1 - 20, HOR + 0.3]], 0.9, PENCIL, A.WATER, 0.7, { press: 0.28, wob: 0.3 });
    tick('far shore and water');
    // ---- meadow
    const GB = [X0, 590, X1, Y1], dsf = (x, y) => ds(y);
    pass({ reg: A.MEADOW, kind: KIND.CRAYON, tool: CRAYON, bbox: GB, cell: 8, w: [7, 12], len: [40, 110], ang: () => -0.7, angJit: 0.5, p: [0.3, 0.8], curve: 0.3, edge: 0.3 });
    pass({ reg: A.MEADOW, kind: KIND.CRAYON, tool: CRAYON, bbox: GB, cell: 6, w: [3.5, 6.5], len: [18, 60], lenScale: dsf, ang: lean, angJit: 0.5, p: [0.3, 0.8], curve: 0.5, edge: 0.25, skip: 0.15 });
    tick('meadow wax');
    pass({ reg: A.MEADOW, kind: KIND.PENCIL, tool: PENCIL, bbox: GB, cell: 3.0, w: [1.6, 2.5], len: [12, 40], lenScale: dsf, ang: lean, angJit: 0.6, p: [0.35, 0.85], curve: 0.9, edge: 0.1 });
    pass({ reg: A.MEADOW, kind: KIND.PENCIL, tool: PENCIL, bbox: GB, cell: 2.6, w: [1.4, 2.2], len: [10, 34], lenScale: dsf, ang: lean, angJit: 0.7, p: [0.35, 0.85], curve: 0.9, edge: 0.1, skip: 0.35 });
    const PB = [560, 730, 960, Y1];
    pass({ reg: A.PATH, kind: KIND.CRAYON, tool: CRAYON, bbox: PB, cell: 5, w: [3, 6], len: [14, 50], lenScale: dsf, ang: () => -0.2, angJit: 0.4, p: [0.3, 0.75], edge: 0.3 });
    pass({ reg: A.PATH, kind: KIND.PENCIL, tool: PENCIL, bbox: PB, cell: 2.5, w: [1.5, 2.3], len: [8, 36], lenScale: dsf, ang: () => -0.2, angJit: 0.5, p: [0.3, 0.8], edge: 0.1 });
    // small stones and scuffs on the worn earth
    for (let k = 0; k < 260; k++) {
      const p = PATH[(R() * PATH.length) | 0], w = pathW(p[1]);
      const x = p[0] + rr(-6, 6), y = p[1] + rr(-0.16, 0.16) * w; if (E.regAt(x, y) !== A.PATH) continue;
      const Ls = rr(1.5, 7) * ds(y);
      line([[x, y], [x + Ls, y + rr(-0.4, 0.4)]], rr(1, 1.8), PENCIL, A.PATH, rr(0.62, 0.85), { press: rr(0.3, 0.6), wob: 0.2 });
    }
    tick('meadow pencil');
    // ---- the tree's wood
    const TB = [860, 180, 1470, 740], tang = (x, y) => Sc.trunkInfo(x, y).ang;
    pass({ reg: A.TRUNK, kind: KIND.CRAYON, tool: CRAYON, bbox: TB, cell: 4, w: [3, 5.5], len: [14, 50], ang: tang, angJit: 0.2, p: [0.35, 0.85], curve: 0.3, edge: 0.3 });
    pass({ reg: A.TRUNK, kind: KIND.PENCIL, tool: PENCIL, bbox: TB, cell: 2.2, w: [1.5, 2.4], len: [8, 40], ang: tang, angJit: 0.25, p: [0.35, 0.85], curve: 0.4, edge: 0.1 });
    pass({ reg: A.TRUNK, kind: KIND.PENCIL, tool: PENCIL, bbox: TB, cell: 2.0, w: [1.3, 2.0], len: [6, 30], ang: tang, angJit: 0.3, p: [0.35, 0.85], curve: 0.4, edge: 0.1, skip: 0.3 });
    // bark furrows that follow the lean of the tree
    for (let k = 0; k < 1500; k++) {
      const x0 = rr(870, 1450), y0 = rr(190, 715);
      if (E.regAt(x0, y0) !== A.TRUNK) continue;
      const ti = Sc.trunkInfo(x0, y0), a = ti.ang + rr(-0.12, 0.12), thick = y0 > 450 && x0 > 1090 && x0 < 1190;
      const Ls = thick ? rr(12, 52) : rr(8, 26), x1 = x0 + Math.cos(a) * Ls, y1 = y0 + Math.sin(a) * Ls;
      if (E.regAt(x1, y1) !== A.TRUNK) continue;
      const mx = (x0 + x1) / 2 + rr(-1.6, 1.6), my = (y0 + y1) / 2 + rr(-1, 1);
      line([[x0, y0], [mx, my], [x1, y1]], rr(0.9, 1.7), PENCIL, A.TRUNK, rr(0.5, 0.78), { press: rr(0.35, 0.7), p0: 0.2, p1: 0.1, wob: 0.5 });
    }
    // an old knot, like a closed eye
    line([[1118, 590], [1124, 585], [1131, 589], [1126, 595], [1119, 592], [1123, 589]], 1.3, PENCIL, A.TRUNK, 0.4, { press: 0.6, wob: 0.2, step: 0.8 });
    // the outline of the wood
    for (const s of Sc.LIMBS) {
      const dx = s[3] - s[0], dy = s[4] - s[1], Ls = Math.hypot(dx, dy), nx = -dy / Ls, ny = dx / Ls;
      for (const sgn of [-1, 1]) {
        let pts = [];
        const flush = pp => line(pp, rr(1.0, 1.5), PENCIL, A.TRUNK, 0.48, { press: rr(0.45, 0.7), wob: 0.35, p0: 0.5, p1: 0.3 });
        for (let t = 0; t <= 1.001; t += 0.2) {
          const hw = s[2] + (s[5] - s[2]) * (s[6] ? Math.pow(t, 0.55) : t), x = s[0] + dx * t + nx * sgn * hw * 0.97, y = s[1] + dy * t + ny * sgn * hw * 0.97;
          if (E.regAt(x - nx * sgn * 1.5, y - ny * sgn * 1.5) === A.TRUNK && E.regAt(x + nx * sgn * 2.5, y + ny * sgn * 2.5) !== A.TRUNK) pts.push([x, y]);
          else { if (pts.length > 1) flush(pts); pts = []; }
        }
        if (pts.length > 1) flush(pts);
      }
    }
    tick('wood');
  }

  // ---------- build (or fetch from the drawer) the patient layers
  function build(log) {
    const key = crypto.createHash('md5').update([VERSION, fmtKey, W, H, fs.readFileSync(__filename), fs.readFileSync(path.join(__dirname, 'engine.js'))].join('|')).digest('hex').slice(0, 12);
    const dir = opt.cacheDir || path.join(__dirname, '.cache'), file = path.join(dir, `static-${fmtKey}-${W}x${H}-${key}.bin`);
    E.makePaper();
    if (!opt.noCache && fs.existsSync(file)) {
      const buf = zlib.gunzipSync(fs.readFileSync(file));
      let off = 0; const hdr = JSON.parse(buf.slice(4, 4 + buf.readUInt32LE(0)).toString()); off = 4 + buf.readUInt32LE(0);
      const take = (Ctor, n) => { const bytes = n * Ctor.BYTES_PER_ELEMENT; const ab = new ArrayBuffer(bytes); Buffer.from(ab).set(buf.subarray(off, off + bytes)); off += bytes; return new Ctor(ab); };
      const ids = take(Uint32Array, E.N * E.K), wq = take(Uint8Array, E.N * E.K), fill0 = take(Float32Array, E.N), reg = take(Uint8Array, E.N);
      E.importStatic({ ids, wq, fill0, reg });
      const n = hdr.n, S = { n };
      for (const k of ['x', 'y', 'j0', 'j1', 'j2', 'j3', 'dk', 'len', 'ang']) S[k] = take(Float32Array, n);
      S.reg = take(Uint8Array, n); S.kind = take(Uint8Array, n);
      log && log('patient layers: taken from the drawer (' + n + ' strokes)');
      return S;
    }
    buildRegions(); log && log('regions');
    drawStatic(log);
    E.finishStatic();
    const n = L.n, S = { n };
    for (const k of ['x', 'y', 'j0', 'j1', 'j2', 'j3', 'dk', 'len', 'ang']) S[k] = Float32Array.from(L[k]);
    S.reg = Uint8Array.from(L.reg); S.kind = Uint8Array.from(L.kind);
    if (!opt.noCache) {
      fs.mkdirSync(dir, { recursive: true });
      const ex = E.exportStatic(), hdr = Buffer.from(JSON.stringify({ n })), hl = Buffer.alloc(4); hl.writeUInt32LE(hdr.length);
      const parts = [hl, hdr, ex.ids, ex.wq, ex.fill0, ex.reg, S.x, S.y, S.j0, S.j1, S.j2, S.j3, S.dk, S.len, S.ang, S.reg, S.kind].map(a => Buffer.isBuffer(a) ? a : Buffer.from(a.buffer, a.byteOffset, a.byteLength));
      const tmp = file + '.' + process.pid + '.tmp';
      fs.writeFileSync(tmp, zlib.gzipSync(Buffer.concat(parts), { level: 1 })); fs.renameSync(tmp, file);
    }
    log && log('patient layers: drawn (' + n + ' strokes)');
    return S;
  }

  return { E, Sc, fm, fmtKey, W, H, X0, Y0, X1, Y1, HOR, NEST, REG, KIND, PATH, pathW, depthScale, ds, lean, build };
}

module.exports = { createWorld, FORMATS, REG, KIND };
