/* A YEAR, STILL WARM — the tree.
 *
 * The wood (trunk and great limbs) is one of the patient layers. Everything else
 * about the tree is alive and is drawn again every frame:
 *
 *   - a skeleton of lesser branches and some four thousand twigs, grown outwards
 *     from the original limbs to the original leaf-clumps, so that when the leaves
 *     go there is a real winter tree where the summer one stood;
 *   - about a hundred thousand leaf strokes, laid with the original canopy passes,
 *     each belonging to a twig and each with its own spring (when it opens), its
 *     own autumn (when and what colour it turns) and its own last day (how much
 *     wind and rain it takes to let go);
 *   - the leaves that are in the air, and the ones that have come down;
 *   - the shadow all of this throws on the ground, traced from the sun through
 *     every tuft that still has leaves on it.
 */
'use strict';
const { c01, sstep, lerp, hash1, KX, KY, XC, HOR } = require('./clock.js');
const { PAPER, mix3 } = require('./look.js');

function create(ctx) {
  const { K, Wd, Lk, Pt, E } = ctx, Sc = Wd.Sc, st = Lk.st, C = K.C, F = K.F, FPS = K.FPS;
  const { R, rr, fbm, vnoise, hash2, PX, PY, PP, TOOLS } = E;
  const CRAYON = TOOLS.CRAYON, PENCIL = TOOLS.PENCIL;
  E.reseed(0x7ee5eed);
  const XMAX = Wd.X1 + 40;

  // ---------- the crown: the original's five masses, and the dome the old sheet cut off
  const BIG = Sc.BIG.map(b => b.slice()).concat([[1200, 40, 230, 150], [1370, 10, 190, 130]]);
  const HOLES = [[1058, 306, 30], [1296, 176, 26], [1236, 356, 26], [1420, 300, 24], [880, 318, 16], [1130, 120, 22], [1500, 120, 20], [985, 232, 20], [1340, 60, 18]].concat(   // (the original's sky-holes; scene.js keeps them private)
   [[1262, -24, 22], [1122, 6, 18], [1424, -44, 18], [1336, -84, 14]]);
  function bigField(x, y, o) {
    let m = -9, bx = 0, by = 0;
    for (const b of BIG) { const dx = (x - b[0]) / b[2], dy = (y - b[1]) / b[3], v = 1 - Math.sqrt(dx * dx + dy * dy); if (v > m) { m = v; bx = dx / b[2]; by = dy / b[3]; } }
    if (o) { const l = Math.hypot(bx, by) || 1, mag = c01(1.15 - m * 1.3); o[0] = bx / l * mag; o[1] = by / l * mag; }
    return m;
  }
  const CLUMPS = Sc.CLUMPS.map(c => c.slice());
  { let tries = 0, added = 0;
    while (added < 78 && tries++ < 4000) {
      const b = BIG[5 + ((R() * 2) | 0)], a = R() * 6.283, q = Math.sqrt(R());
      const x = b[0] + Math.cos(a) * b[2] * q, y = b[1] + Math.sin(a) * b[3] * q;
      if (y > 64) continue;
      const bf = bigField(x, y); if (bf < 0) continue;
      const r = (16 + 26 * R()) * (0.6 + 0.9 * c01(bf * 2.2));
      let ok = true; for (const h of HOLES) if (Math.hypot(x - h[0], y - h[1]) < r * 0.9 + h[2]) { ok = false; break; }
      if (!ok) continue;
      CLUMPS.push([x, y, r]); added++;
    } }
  // "max of blobs" fields on a 2-unit grid
  const GX0 = 740, GY0 = -150, GW = 460, GH = 346;
  const mk = () => ({ v: new Float32Array(GW * GH).fill(-1), nx: new Float32Array(GW * GH), ny: new Float32Array(GW * GH), id: new Int32Array(GW * GH).fill(-1) });
  function splat(Fd, cx, cy, rx, ry, id) {
    const x0 = Math.max(0, Math.floor((cx - rx - GX0) / 2)), x1 = Math.min(GW - 1, Math.ceil((cx + rx - GX0) / 2)), y0 = Math.max(0, Math.floor((cy - ry - GY0) / 2)), y1 = Math.min(GH - 1, Math.ceil((cy + ry - GY0) / 2));
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
      const dx = (gx * 2 + 1 + GX0 - cx) / rx, dy = (gy * 2 + 1 + GY0 - cy) / ry, v = 1 - Math.sqrt(dx * dx + dy * dy), i = gy * GW + gx;
      if (v > Fd.v[i]) { Fd.v[i] = v; Fd.nx[i] = dx; Fd.ny[i] = dy; Fd.id[i] = id; }
    }
  }
  const cl = (v, a, b) => v < a ? a : v > b ? b : v;
  function fv(Fd, x, y) {
    const fx = cl((x - GX0) / 2 - 0.5, 0, GW - 1.001), fy = cl((y - GY0) / 2 - 0.5, 0, GH - 1.001), ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, i = iy * GW + ix;
    return (Fd.v[i] * (1 - tx) + Fd.v[i + 1] * tx) * (1 - ty) + (Fd.v[i + GW] * (1 - tx) + Fd.v[i + GW + 1] * tx) * ty;
  }
  const fi = (x, y) => (cl((y - GY0) / 2, 0, GH - 1) | 0) * GW + (cl((x - GX0) / 2, 0, GW - 1) | 0);
  const CNF = mk(), CN2 = mk();
  CLUMPS.forEach((c, i) => splat(CNF, c[0], c[1], c[2], c[2] * 0.88, i));
  // small scalloped tufts of leaves riding on the big clumps: each is the end of a twig
  const TUFT = [];
  { let tries = 0;
    while (TUFT.length < 4200 && tries++ < 60000) {
      const x = rr(760, 1640), y = rr(-140, 520);
      if (fv(CNF, x, y) < 0.03) continue;
      const r = rr(6.5, 15); splat(CN2, x, y, r, r * 0.86, TUFT.length); TUFT.push({ x, y, r, clump: CNF.id[fi(x, y)] });
    } }
  const canopyV = (x, y) => fv(CNF, x, y) + 0.24 * (c01(fv(CN2, x, y)) - 0.3) + 0.12 * (fbm(x / 8, y / 8, 3, 3) - 0.5);
  const inCanopy = (x, y) => x > 760 && y < 522 && fv(CNF, x, y) > -0.25 && canopyV(x, y) > 0.1;

  // ---------- the skeleton
  const FORK = [1122, 470];
  const nodes = [];          // {x, y, w, parent, cnt, flex}
  const branches = [];       // {nodes: [idx...], order}
  function addNode(x, y, w, parent, limb) { nodes.push({ x, y, w, parent, cnt: 0, limb: !!limb }); return nodes.length - 1; }
  { // the original limbs, sampled
    const ends = {};
    for (const s of Sc.LIMBS) {
      const L = Math.hypot(s[3] - s[0], s[4] - s[1]), k = Math.max(1, Math.round(L / 11));
      let prev = -1;
      for (let j = 0; j <= k; j++) { const t = j / k; prev = addNode(s[0] + (s[3] - s[0]) * t, s[1] + (s[4] - s[1]) * t, s[2] + (s[5] - s[2]) * t, prev, true); }
    }
  }
  const limbNodeCount = nodes.length;
  function nearestNode(x, y, minW, pred) {
    let best = -1, bc = 1e18;
    for (let i = 0; i < nodes.length; i++) {
      const nd = nodes[i]; if (nd.w < minW) continue; if (nd.y > 500 && nd.limb) continue;
      const dx = x - nd.x, dy = y - nd.y, d = Math.hypot(dx, dy);
      // a branch likes to keep going outwards from the fork, and upwards
      let ox = nd.x - FORK[0], oy = nd.y - FORK[1]; const ol = Math.hypot(ox, oy) || 1; ox /= ol; oy /= ol;
      const cs = d > 0 ? (dx * ox + dy * oy) / d : 1;
      const c = d * (1 + 0.85 * (1 - cs)) + (pred ? pred(nd) : 0);
      if (c < bc) { bc = c; best = i; }
    }
    return best;
  }
  { const order = CLUMPS.map((c, i) => i).sort((a, b) => Math.hypot(CLUMPS[a][0] - FORK[0], CLUMPS[a][1] - FORK[1]) - Math.hypot(CLUMPS[b][0] - FORK[0], CLUMPS[b][1] - FORK[1]));
    for (const ci of order) {
      const c = CLUMPS[ci];
      const ni = nearestNode(c[0], c[1], 0.9), nd = nodes[ni];
      const L = Math.hypot(c[0] - nd.x, c[1] - nd.y); if (L < 6) { c.node = ni; continue; }
      const k = Math.max(2, Math.round(L / 12)), bend = rr(-0.22, 0.22) * L, px = -(c[1] - nd.y) / L, py = (c[0] - nd.x) / L;
      const br = { nodes: [ni], seed: (R() * 1e9) | 0 };
      let prev = ni;
      for (let j = 1; j <= k; j++) {
        const t = j / k, s = Math.sin(Math.PI * t), sag = -6 * s * (L / 120);       // young wood reaches up a little
        prev = addNode(nd.x + (c[0] - nd.x) * t + px * bend * s + rr(-1.5, 1.5), nd.y + (c[1] - nd.y) * t + py * bend * s + sag + rr(-1.5, 1.5), 1, prev, false);
        br.nodes.push(prev);
      }
      c.node = prev; branches.push(br);
      for (let p = ni; p >= 0; p = nodes[p].parent) nodes[p].cnt++;
    } }
  // twigs: from the nearest wood to the heart of each tuft
  const twigs = [];
  for (let ti = 0; ti < TUFT.length; ti++) {
    const t = TUFT[ti]; if (t.x > XMAX + 30) t.off = true;
    const ni = nearestNode(t.x, t.y, 0.5), nd = nodes[ni];
    const L = Math.hypot(t.x - nd.x, t.y - nd.y);
    t.node = ni; t.bx = nd.x; t.by = nd.y;
    for (let p = ni; p >= 0; p = nodes[p].parent) nodes[p].cnt++;
    const k = L > 26 ? 2 : 1, bend = rr(-0.25, 0.25) * L, px = L > 0 ? -(t.y - nd.y) / L : 0, py = L > 0 ? (t.x - nd.x) / L : 0;
    const pts = [[nd.x, nd.y]];
    for (let j = 1; j <= k; j++) { const u = j / (k + 0.0), s = Math.sin(Math.PI * u * 0.8); pts.push([nd.x + (t.x - nd.x) * u + px * bend * s, nd.y + (t.y - nd.y) * u + py * bend * s - 2.5 * s]); }
    // one or two sprigs past the heart of the tuft, so the bare tree is feathered
    const sprigs = [];
    const ns = 1 + ((R() * 2.4) | 0), a0 = Math.atan2(t.y - nd.y, t.x - nd.x);
    for (let s = 0; s < ns; s++) { const a = a0 + rr(-1.0, 1.0) - 0.25, l = t.r * rr(0.5, 1.15), u = rr(0.45, 1); sprigs.push([nd.x + (t.x - nd.x) * u, nd.y + (t.y - nd.y) * u, a, l]); }
    const tw = { ti, pts, sprigs, w: rr(0.75, 1.15), seed: (R() * 1e9) | 0 }; if (!t.off) twigs.push(tw);
  }
  // thickness from how much each bit of wood carries; flexibility from how far out it is
  for (let i = limbNodeCount; i < nodes.length; i++) { const nd = nodes[i]; nd.w = Math.min(7, 0.85 + 0.30 * Math.sqrt(nd.cnt)); }
  for (const br of branches) { const base = nodes[br.nodes[0]]; let w = base.limb ? Math.min(base.w * 1.3, 9) : base.w; for (let j = 1; j < br.nodes.length; j++) { const nd = nodes[br.nodes[j]]; nd.w = Math.min(nd.w, w * 0.96); w = nd.w; } }
  const flexAt = (x, y) => { const d = Math.hypot(x - FORK[0], y - FORK[1] + 40); return Math.pow(c01(d / 520), 1.5) * 7.5; };
  for (const nd of nodes) nd.flex = nd.limb ? 0.35 * flexAt(nd.x, nd.y) * sstep(14, 4, nd.w) : flexAt(nd.x, nd.y);
  for (const t of TUFT) { t.flex = flexAt(t.x, t.y) * 1.15 + 0.6; t.ph = R() * 6.283; t.zoff = (R() - 0.5) * 2; t.f1 = 2 + ((R() * 4) | 0); t.f2 = 3 + ((R() * 5) | 0); t.dead = !!t.off; }

  // ---------- the leaves: laid once with the original canopy passes
  const LS = { n: 0, sn: [], thin: [], x: [], y: [], w: [], tool: [], layer: [], tuft: [], p0: [], pn: [], cnx: [], cny: [], tnx: [], tny: [], bnx: [], bny: [], v2: [], bf: [], nz: [], U0: [], j0: [], j1: [], j2: [], j3: [] };
  const pool = [];
  const bn = [0, 0];
  let serial = 0;
  function addLeaf(n, w, tool, layer, sx, sy) {
    const r0 = R(), r1 = R(), r2 = R(), r3 = R(), sn = serial++;     // (drawn whether or not this sheet keeps the leaf, so both sheets grow the same tree)
    if (sx > XMAX || sx < Wd.X0 - 30 || sy < Wd.Y0 - 30) return;
    const i = fi(sx, sy);
    let ti = CN2.id[i];
    if (ti < 0 || TUFT[ti].dead) { let bd = 1e9; for (let k = 0; k < TUFT.length; k++) { const t = TUFT[k]; if (t.dead) continue; const d = (t.x - sx) * (t.x - sx) + (t.y - sy) * (t.y - sy); if (d < bd) { bd = d; ti = k; } } }
    LS.x.push(sx); LS.y.push(sy); LS.w.push(w); LS.tool.push(tool); LS.layer.push(layer); LS.tuft.push(ti); LS.p0.push(pool.length / 3); LS.pn.push(n);
    for (let k = 0; k < n; k++) pool.push(PX[k] - sx, PY[k] - sy, PP[k]);
    const bfv = bigField(sx, sy, bn);
    LS.thin.push(c01(1 - fv(CNF, sx, sy) * 2.4));
    LS.cnx.push(CNF.nx[i]); LS.cny.push(CNF.ny[i]); LS.tnx.push(CN2.nx[i]); LS.tny.push(CN2.ny[i]); LS.bnx.push(bn[0]); LS.bny.push(bn[1]); LS.v2.push(CN2.v[i]); LS.bf.push(bfv);
    const nzv = fbm(sx / 30, sy / 30, 18, 3); LS.nz.push(nzv);
    // the original's light from the hollow on the undersides of the leaves
    let dx = Sc.NEST.x - sx, dy = Sc.NEST.y - sy; const dist = Math.hypot(dx, dy); dx /= dist; dy /= dist;
    let U = (0.18 + 0.20 * (CNF.nx[i] * dx + CNF.ny[i] * dy) + 0.30 * (CN2.nx[i] * dx + CN2.ny[i] * dy) + 0.52 * (bn[0] * dx + bn[1] * dy) + 0.26 * (nzv - 0.5)) * 1.75 / (1 + (dist / 400) * (dist / 400));
    U *= 0.72 + 0.28 * sstep(0.0, 0.4, CN2.v[i]);
    LS.U0.push(U); LS.j0.push(r0); LS.j1.push(r1); LS.j2.push(r2); LS.j3.push(r3); LS.sn.push(sn);
    LS.n++;
  }
  function leafPass(o) {
    const cell = o.cell, seeds = [];
    for (let y = -140; y < 524; y += cell) for (let x = 760; x < 1640; x += cell) seeds.push(x + R() * cell, y + R() * cell);
    const ns = seeds.length / 2;
    for (let i = ns - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; let t = seeds[i * 2]; seeds[i * 2] = seeds[j * 2]; seeds[j * 2] = t; t = seeds[i * 2 + 1]; seeds[i * 2 + 1] = seeds[j * 2 + 1]; seeds[j * 2 + 1] = t; }
    const edge = o.edge, bx = new Float32Array(256), by = new Float32Array(256);
    for (let si = 0; si < ns; si++) {
      const sx = seeds[si * 2], sy = seeds[si * 2 + 1];
      if (!inCanopy(sx, sy)) continue;
      if (o.skip && R() < o.skip) continue;
      const p = (o.p[0] + (o.p[1] - o.p[0]) * (0.25 + 0.75 * R())) * (0.82 + 0.36 * fbm(sx / 170, sy / 170, 77, 2));
      const len = rr(o.len[0], o.len[1]), w = rr(o.w[0], o.w[1]);
      const ii = fi(sx, sy), a0 = Math.atan2(CN2.nx[ii], -CN2.ny[ii]) + (R() - 0.5) * o.angJit + 0.55 * (fbm(sx / 210, sy / 210, 78, 2) - 0.5);
      const step = Math.min(2.4, Math.max(0.7, len / 8)), hw = w * edge, kc = (R() - 0.5) * 2 * 0.9 / Math.max(4, len);
      const ok = (x, y, a) => { if (!inCanopy(x, y)) return false; if (hw > 0.45) { const qx = -Math.sin(a) * hw, qy = Math.cos(a) * hw; if (!inCanopy(x + qx, y + qy) || !inCanopy(x - qx, y - qy)) return false; } return true; };
      let nb = 0, x = sx, y = sy, a = a0 + Math.PI, s = 0, lim = len * rr(0.35, 0.65);
      while (s < lim && nb < 120) { a -= kc * step; x += Math.cos(a) * step; y += Math.sin(a) * step; if (!ok(x, y, a)) break; bx[nb] = x; by[nb] = y; nb++; s += step; }
      let n = 0;
      for (let i = nb - 1; i >= 0; i--) { PX[n] = bx[i]; PY[n] = by[i]; n++; }
      PX[n] = sx; PY[n] = sy; n++;
      x = sx; y = sy; a = a0; s = 0; lim = len - lim;
      while (s < lim && n < 240) { a += kc * step; x += Math.cos(a) * step; y += Math.sin(a) * step; if (!ok(x, y, a)) break; PX[n] = x; PY[n] = y; n++; s += step; }
      if (n < 2) continue;
      const ph1 = R() * 6.28, ph2 = R() * 6.28, ca = Math.cos(a0), sa_ = Math.sin(a0);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), taper = Math.min(1, t / 0.12 + 0.5) * Math.min(1, (1 - t) / 0.28 + 0.22);
        PP[i] = p * taper * (0.88 + 0.24 * R());
        const wv = 0.35 * (0.6 * Math.sin(i * step * 0.31 + ph1) + Math.sin(i * step * 0.09 + ph2));
        PX[i] += -sa_ * wv; PY[i] += ca * wv;
      }
      // thin the points: a leaf stroke needs few
      let m = 0; const keep = Math.max(1, Math.round(2.2 / step));
      for (let i = 0; i < n; i += keep) { PX[m] = PX[i]; PY[m] = PY[i]; PP[m] = PP[i]; m++; }
      if ((n - 1) % keep) { PX[m] = PX[n - 1]; PY[m] = PY[n - 1]; PP[m] = PP[n - 1]; m++; }
      addLeaf(m, w, o.tool, o.layer, sx, sy);
    }
  }
  function curve3(x0, y0, x1, y1, x2, y2, p0, p1) {
    const k = 5; for (let j = 0; j <= k; j++) { const t = j / k, u = 1 - t; PX[j] = u * u * x0 + 2 * u * t * x1 + t * t * x2; PY[j] = u * u * y0 + 2 * u * t * y1 + t * t * y2; PP[j] = p0 * Math.min(1, t / 0.15 * 0.5 + 0.5) * (1 - t * (1 - p1)); } return k + 1;
  }
  leafPass({ layer: 0, tool: 0, cell: 7, w: [6, 10], len: [16, 50], angJit: 0.7, p: [0.35, 0.85], edge: 0.3 });
  leafPass({ layer: 1, tool: 0, cell: 4.6, w: [3, 5.5], len: [7, 18], angJit: 2.4, p: [0.35, 0.85], edge: 0.25 });
  leafPass({ layer: 2, tool: 1, cell: 2.6, w: [1.8, 3.0], len: [5, 13], angJit: 3.1, p: [0.4, 0.9], edge: 0.1 });
  leafPass({ layer: 3, tool: 1, cell: 2.4, w: [1.5, 2.4], len: [4, 12], angJit: 3.1, p: [0.4, 0.9], edge: 0.1, skip: 0.4 });
  // leaves along the silhouette (layer 4), leaf-shadows in the lit masses (5), and the pin's glints (6)
  for (let k = 0; k < 13000; k++) {
    const x = rr(760, 1640), y = rr(-140, 520);
    if (fv(CNF, x, y) < -0.2) continue;
    const v = canopyV(x, y); if (v < 0.0 || v > 0.24) continue;
    const i = fi(x, y), a = Math.atan2(CNF.ny[i], CNF.nx[i]) + rr(-1.3, 1.3), L = rr(4, 8.5), tx = x + Math.cos(a) * L, ty = y + Math.sin(a) * L;
    if (ty > 520 && Sc.trunkInfo(tx, ty).q < 1) continue;
    const n = curve3(x, y, (x + tx) / 2 + Math.sin(a) * L * 0.18, (y + ty) / 2 - Math.cos(a) * L * 0.18, tx, ty, rr(0.6, 0.95), 0.3);
    addLeaf(n, rr(2.0, 3.4), 0, 4, x, y);
  }
  for (let k = 0; k < 11000; k++) {
    const x = rr(760, 1640), y = rr(-140, 520);
    if (!inCanopy(x, y)) continue;
    const a = rr(0, 6.283), L = rr(3.5, 7.5);
    const n = curve3(x, y, x + Math.cos(a) * L * 0.5 + Math.sin(a) * 1.2, y + Math.sin(a) * L * 0.5 - Math.cos(a) * 1.2, x + Math.cos(a) * L, y + Math.sin(a) * L, rr(0.35, 0.7), 0.3);
    addLeaf(n, rr(1.4, 2.4), 1, 5, x, y);
  }
  for (let k = 0; k < 17000; k++) {
    const x = rr(770, 1640), y = rr(-136, 520);
    if (!inCanopy(x, y)) continue;
    const a = rr(0, 6.283), L = rr(2.6, 6);
    const n = curve3(x, y, x + Math.cos(a) * L * 0.5 + Math.sin(a) * 0.9, y + Math.sin(a) * L * 0.5 - Math.cos(a) * 0.9, x + Math.cos(a) * L, y + Math.sin(a) * L, 1, 0.5);
    addLeaf(n, rr(0.7, 1.25), 2, 6, x, y);
  }
  const NL = LS.n, P = Float32Array.from(pool);
  const L_ = {}; for (const k of ['thin', 'x', 'y', 'w', 'cnx', 'cny', 'tnx', 'tny', 'bnx', 'bny', 'v2', 'bf', 'nz', 'U0', 'j0', 'j1', 'j2', 'j3']) L_[k] = Float32Array.from(LS[k]);
  L_.sn = Int32Array.from(LS.sn); L_.tool = Uint8Array.from(LS.tool); L_.layer = Uint8Array.from(LS.layer); L_.tuft = Int32Array.from(LS.tuft); L_.p0 = Int32Array.from(LS.p0); L_.pn = Uint8Array.from(LS.pn);

  // ---------- each leaf's own calendar
  // tuft-level character first (leaves on one twig keep roughly the same time), then the leaf's own
  for (let ti = 0; ti < TUFT.length; ti++) {
    const t = TUFT[ti];
    const bf = c01(bigField(t.x, t.y) * 1.6), low = c01((t.y + 100) / 620), nzA = fbm(t.x / 120, t.y / 120, 501, 2), nzB = fbm(t.x / 70, t.y / 70, 502, 2), nzC = fbm(t.x / 150, t.y / 150, 503, 2);
    const hq = k => hash2(ti, k, 505);
    t.bud = 0.085 + 0.62 * (0.45 * nzA + 0.25 * (1 - low) + 0.3 * hq(1));             // lower, sheltered twigs open first
    t.turn = 0.10 + 0.50 * c01(0.50 * nzB + 0.30 * bf + 0.25 * hq(2) - 0.02);        // the outside of the crown turns first
    if (hq(3) < 0.022) t.turn = 0.012 + 0.05 * hq(4);                                  // a few leaves give up in August
    t.hue = c01(0.55 * nzC + 0.25 * (1 - bf) + 0.3 * hq(5) - 0.05);                  // 0 gold .. 1 red, in drifts through the crown
    t.cling = hq(6) < 0.012 ? 1 : 0;                                                  // a few brown ones hang on into the snow
  }
  const bud = new Float32Array(NL), turn = new Float32Array(NL), hue = new Float32Array(NL), fall = new Float32Array(NL);
  const LAYER_BUD = [0.22, 0.12, 0.0, 0.04, 0.0, 0.28, 0.08], LAYER_FALL = [0.55, 0.8, 1, 1.05, 1.15, 0.5, 0.9];
  for (let i = 0; i < NL; i++) {
    const t = TUFT[L_.tuft[i]], ly = L_.layer[i], s = L_.sn[i];
    bud[i] = t.bud + LAYER_BUD[ly] + 0.09 * (L_.j3[i] - 0.5);
    turn[i] = Math.max(0.008, t.turn + 0.11 * (hash2(s, 7, 91) - 0.5) - (ly === 0 ? 0.03 : 0));
    hue[i] = c01(t.hue + 0.22 * (hash2(s, 8, 92) - 0.5));
    const q = c01(0.62 * (turn[i] - 0.05) / 0.6 + 0.38 * hash2(s, 9, 93));
    fall[i] = t.cling && ly >= 2 && ly <= 4 && hash2(s, 3, 94) < 0.5 ? 2.5 + 1.9 * hash2(s, 4, 95) : (0.035 + 1.45 * Math.pow(q, 1.6)) * LAYER_FALL[ly];
  }

  // ---------- leaves in the air and on the ground (a share of the fine leaves become particles)
  const PARTS = [];
  { // frames in "leaf-year" order, starting where the stress counter resets, so D only ever grows
    let fr = 0; for (let f = 0; f < F; f++) if (C.D[f] < C.D[(f - 1 + F) % F] - 0.5) fr = f;
    const Dk = new Float32Array(F); for (let k = 0; k < F; k++) Dk[k] = C.D[(fr + k) % F];
    const frameWhen = thr => { let lo = 0, hi = F - 1; if (Dk[hi] < thr) return -1; while (lo < hi) { const m = (lo + hi) >> 1; if (Dk[m] >= thr) hi = m; else lo = m + 1; } return (fr + lo) % F; };
    const wv = [0, 0], so = [0, 0];
    for (let i = 0; i < NL; i++) {
      const ly = L_.layer[i]; if (ly < 2 || ly > 4) continue;
      const sn = L_.sn[i]; if (hash2(sn, 11, 97) > (ly === 4 ? 0.24 : 0.12)) continue;
      const f0 = frameWhen(fall[i]); if (f0 < 0) continue;
      const h1 = hash2(sn, 12, 98), h2 = hash2(sn, 13, 99), h3 = hash2(sn, 14, 100), h4 = hash2(sn, 15, 101);
      // where on the ground it is headed: mostly under the crown, some carried towards us
      const x0 = L_.x[i], y0 = L_.y[i];
      const Zr = 108 + (h1 < 0.75 ? (h2 - 0.5) * 420 : -80 - h2 * 330), yL = 520 + 600 * 222 / (600 + Zr) + (h3 - 0.5) * 6;
      const sc0 = 0.85, sc1 = Math.max(0.5, (yL - 520) / 222);
      const vy = (46 + 50 * h3) * (0.8 + 0.5 * sc1);                         // o-units a second
      const dur = Math.max(0.6, (yL - y0) / vy), nF = Math.round(dur * FPS);
      // the wind it meets on the way down decides where it lands
      const kw = 55 + 70 * h4;
      const f1 = (f0 + nF) % F;
      const dW = (C.Wint[f1] - C.Wint[f0]) + (f1 < f0 ? C.Wint[F] : 0);
      const x1 = x0 + kw * dW * sc1;
      PARTS.push({ i, f0, nF, x0, y0, x1, yL, sc0, sc1, kw, sw: 5 + 11 * h1, om: 2.2 + 2.6 * h2, ph: h3 * 6.283, spin: (h4 - 0.5) * 9, mob: 20 + 120 * h2 * h2, life: h1, rot: h2 * 6.283, gone: 14.6 + 2.6 * h3 });
    }
    // how far the gales shift each fallen leaf before something stops it (the hollow, the foot of the tree, the path's edge)
    const gnd = (x, y) => y > Sc.groundY(x) + 2;
    for (const p of PARTS) {
      const fL = (p.f0 + p.nF) % F; p.fL = fL;
      const E0 = C.Egale[fL];
      let stop = 1e9;
      for (let e = 0.02; e < 3; e += 0.04) {
        const x = p.x1 + p.mob * e * p.sc1, y = p.yL;
        Sc.s2w(x, y, wv);
        const inHollow = Math.hypot(wv[0], wv[1]) < 84, atFoot = Math.hypot(wv[0] - 224, wv[1] - 108) < 44, onPath = E.regAt(x, y) === Wd.REG.PATH && hash2(p.i, (e * 25) | 0, 103) < 0.22;
        if (inHollow || atFoot || onPath || !gnd(x, y)) { stop = e; break; }
      }
      p.stop = stop;
    }
  }

  // ---------- per-frame state
  const NT = TUFT.length, tdx = new Float32Array(NT), tdy = new Float32Array(NT), tleaf = new Float32Array(NT), tcnt = new Float32Array(NT), trot = new Float32Array(NT);
  const ndx = new Float32Array(nodes.length), ndy = new Float32Array(nodes.length);
  const lvis = new Float32Array(NL), lgrow = new Float32Array(NL);
  for (let i = 0; i < NL; i++) tcnt[L_.tuft[i]]++;
  const api = { litterAmt: 0, litterCol: [0.72, 0.36, 0.14], leafCover: 0, TUFT, nodes, branches, twigs, CLUMPS, NL, PARTS };
  const GUST = Pt.ADV.gust;
  function localWind(x, y) {
    const g = Pt.pv((x * 0.9 - C.Wint[st.f] * GUST.k) / GUST.cell, y / 240 + 7, 331, GUST.P);
    return st.wind * (0.55 + 0.95 * g);
  }
  const TWO_PI = 6.283185307;
  function prepare() {
    const tau = st.tau, SP = st.SP, D = st.D;
    // --- sway: every node and tuft leans with the wind where it is, and trembles at its own pace
    for (let i = 0; i < nodes.length; i++) {
      const nd = nodes[i]; if (nd.flex < 0.01) { ndx[i] = 0; ndy[i] = 0; continue; }
      const wl = localWind(nd.x, nd.y), osc = Math.sin(TWO_PI * (2 + (i & 3)) / 8 * tau + i * 1.7);
      ndx[i] = nd.flex * (1.5 * wl + 0.55 * Math.abs(wl) * osc); ndy[i] = nd.flex * 0.22 * Math.abs(wl) * Math.cos(TWO_PI * (3 + (i & 3)) / 8 * tau + i);
    }
    for (let i = 0; i < NT; i++) {
      const t = TUFT[i]; if (t.dead) continue;
      const wl = localWind(t.x, t.y), aw = Math.abs(wl), osc = Math.sin(TWO_PI * t.f1 / 8 * tau + t.ph), osc2 = Math.cos(TWO_PI * t.f2 / 8 * tau + t.ph * 1.3);
      tdx[i] = t.flex * (1.5 * wl + 0.6 * aw * osc); tdy[i] = t.flex * (0.3 * aw * osc2 + 0.25 * aw);
      trot[i] = 0.5 * wl * (0.6 + 0.4 * osc2) * Math.min(1, t.flex / 5);
      tleaf[i] = 0;
    }
    // --- which leaves are out
    let tot = 0; const late = st.cal > 6.5 && st.cal < 17.5;
    for (let i = 0; i < NL; i++) {
      const g = late ? 1 : sstep(bud[i], bud[i] + 0.24, SP), fd = fall[i];
      const on = D < fd ? Math.min(1, (fd - D) / (0.012 + 0.04 * fd)) : 0;
      const v = g * on; lvis[i] = v; lgrow[i] = g;
      if (v > 0) { tleaf[L_.tuft[i]] += v; tot += v; }
    }
    for (let i = 0; i < NT; i++) tleaf[i] = tcnt[i] > 0 ? tleaf[i] / tcnt[i] : 0;
    api.leafCover = tot / NL;
    // --- what lies under the tree
    const d = st.cal, fallen = sstep(0.03, 1.25, D) * (d > 9.5 || d < 0.5 ? 1 : 0);
    api.litterAmt = fallen * (1 - sstep(13.6, 16.9, d)) * (d < 0.5 ? 0 : 1);
    mix3([0.80, 0.47, 0.13], [0.40, 0.27, 0.19], sstep(11.8, 14, d), api.litterCol);
    castShadow();
  }

  // ---------- the shadow: the sun, traced through every tuft and limb onto the ground
  const TBX = 224.4, TBZ = 108.5, q = [0, 0];
  function splatSh(Xw, hgt, Zr, rw, dens) {
    const ly = st.ly, lx = st.lx, lz = st.lz;
    const Xs = Xw - hgt * lx / ly, Zs = Zr + hgt * lz / ly, Z = 600 + Zs;
    if (Z < 170 || Z > 6000) return;
    const sx = Sc.NEST.x + Xs * 600 / Z, sy = 520 + 600 * 222 / Z;
    const str = Math.min(4.5, 1 / ly), hl = Math.hypot(lx, lz) || 1, ax = Math.abs(lx) / hl, az = Math.abs(lz) / hl;
    const rx = rw * 600 / Z * (1 + (str - 1) * ax) + 3, ry = rw * (600 * 222 / (Z * Z)) * (1 + (str - 1) * az) + 2.2;
    const sh = Pt.shadow, SHG = Pt.SHG, shW = Pt.shW, shH = Pt.shH;
    const gx = (sx - Wd.X0) / SHG, gy = (sy - 540) / SHG, grx = rx / SHG, gry = ry / SHG;
    const x0 = Math.max(0, Math.floor(gx - grx)), x1 = Math.min(shW - 1, Math.ceil(gx + grx)), y0 = Math.max(0, Math.floor(gy - gry)), y1 = Math.min(shH - 1, Math.ceil(gy + gry));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = (x - gx) / grx, dy = (y - gy) / gry, d2 = dx * dx + dy * dy; if (d2 >= 1) continue;
      const k = dens * (1 - d2) * (1 - d2), i = y * shW + x; sh[i] = 1 - (1 - sh[i]) * (1 - k);
    }
  }
  function castShadow() {
    const sh = Pt.shadow; sh.fill(0);
    if (st.ly < 0.035 || st.direct < 0.01) return;
    const fade = sstep(0.035, 0.12, st.ly);
    for (let i = 0; i < NT; i++) {
      const t = TUFT[i]; if (t.dead || tleaf[i] < 0.02) continue;
      splatSh(TBX + (t.x + tdx[i] - 1150) / 0.847, (708 - t.y) / 0.847, TBZ + t.zoff * 95, t.r / 0.847 * 1.15, 0.36 * tleaf[i] * fade);
    }
    for (const s of Sc.LIMBS) {
      const L = Math.hypot(s[3] - s[0], s[4] - s[1]), k = Math.max(1, Math.round(L / 9));
      for (let j = 0; j <= k; j++) { const u = j / k, x = s[0] + (s[3] - s[0]) * u, y = s[1] + (s[4] - s[1]) * u, hw = s[2] + (s[5] - s[2]) * u; if (y > 700) continue; splatSh(TBX + (x - 1150) / 0.847, (708 - y) / 0.847, TBZ, hw / 0.847 * 1.25, 0.8 * fade); }
    }
    // soften, as a shadow from a long way up is soft
    const tmp = Pt.shTmp, w = Pt.shW, h = Pt.shH;
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; tmp[i] = (sh[i] * 2 + sh[x > 0 ? i - 1 : i] + sh[x < w - 1 ? i + 1 : i]) * 0.25; }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; sh[i] = (tmp[i] * 2 + tmp[y > 0 ? i - w : i] + tmp[y < h - 1 ? i + w : i]) * 0.25; }
    }
  }

  // ---------- colour of wood out in the weather
  const o3 = [0, 0, 0], al = [0, 0, 0], col = [0, 0, 0], c2 = [0, 0, 0];
  function woodCol(x, y, side, o) {
    const A = st.Av, Sn = st.Sv, G = st.Gv;
    const lit = c01(0.45 + 0.5 * (side * st.lx) + 0.25 * st.ly + 0.3 * st.lz) ;
    let dx = Sc.NEST.x - x, dy = Sc.NEST.y - y; const dist = Math.hypot(dx, dy);
    const gl = 0.5 / (1 + (dist / 300) * (dist / 300));
    const wk = 1 - 0.3 * st.wet, cover = 1 - 0.5 * api.leafCover * sstep(10, 40, st.alt);
    const r = 0.44 * wk * (Sn[0] * lit * cover + A[0] * 0.9 + G[0] * gl + st.bounce + st.flashK * 0.4), g = 0.27 * wk * (Sn[1] * lit * cover + A[1] * 0.9 + G[1] * gl + st.bounce + st.flashK * 0.45), b = 0.26 * wk * (Sn[2] * lit * cover + A[2] * 0.9 + G[2] * gl + st.bounce * 1.2 + st.flashK * 0.6);
    Lk.grade(o, 0, r, g, b);
    const vk = st.veil * 0.16, fog = st.fogCol; o[0] += (fog[0] - o[0]) * vk; o[1] += (fog[1] - o[1]) * vk; o[2] += (fog[2] - o[2]) * vk;
    return o;
  }
  const snowCol = [0, 0, 0];
  function snowColour() {
    const A = st.Av, Sn = st.Sv, ly = Math.max(0, st.ly);
    Lk.grade(snowCol, 0, 0.98 * (Sn[0] * (0.45 + 0.55 * ly) + A[0] * 1.05 + st.Gv[0] * 0.05), 0.975 * (Sn[1] * (0.45 + 0.55 * ly) + A[1] * 1.05 + st.Gv[1] * 0.05), 0.955 * (Sn[2] * (0.45 + 0.55 * ly) + A[2] * 1.05));
    return snowCol;
  }

  function drawWood() {
    // lesser branches, then twigs; all of it follows the sway of its own nodes
    const bare = 1 - api.leafCover;
    for (let bi = 0; bi < branches.length; bi++) {
      const br = branches[bi], nn = br.nodes.length;
      let wmax = 0;
      for (let j = 0; j < nn; j++) { const ni = br.nodes[j], nd = nodes[ni]; PX[j] = nd.x + ndx[ni]; PY[j] = nd.y + ndy[ni]; PP[j] = 0.55 + 0.45 * c01(nd.w / 3.2); if (j > 0 && nd.w > wmax) wmax = nd.w; }
      const m = nodes[br.nodes[nn >> 1]];
      woodCol(m.x, m.y, hash1(bi, 5) > 0.5 ? 1 : -1, o3);
      const jl = (hash1(bi, 6) - 0.5) * 0.06; o3[0] += jl; o3[1] += jl; o3[2] += jl;
      PP[nn - 1] *= 0.6;
      E.stroke(nn, Math.max(1.1, wmax * 1.7), wmax > 2.4 ? CRAYON : PENCIL, o3, 1, br.seed);
      if (wmax > 2.4) { o3[0] *= 0.72; o3[1] *= 0.72; o3[2] *= 0.8; E.stroke(nn, 1.0, PENCIL, o3, 0.8, br.seed + 1); }
    }
    // twigs are only worth drawing where they can be seen
    for (let k = 0; k < twigs.length; k++) {
      const tw = twigs[k], ti = tw.ti, t = TUFT[ti];
      const vis = 1 - 0.85 * sstep(0.25, 0.8, tleaf[ti]); if (vis < 0.05) continue;
      const pts = tw.pts, np = pts.length, sx = tdx[ti], sy = tdy[ti], bx = ndx[t.node], by = ndy[t.node];
      for (let j = 0; j < np; j++) { const u = j / (np - 1); PX[j] = pts[j][0] + bx + (sx - bx) * u; PY[j] = pts[j][1] + by + (sy - by) * u; PP[j] = 0.85 - 0.35 * u; }
      woodCol(t.x, t.y, tw.seed & 1 ? 1 : -1, o3);
      E.stroke(np, tw.w * 1.25, PENCIL, o3, vis, tw.seed);
      for (let s = 0; s < tw.sprigs.length; s++) {
        const sp = tw.sprigs[s], ca = Math.cos(sp[2]), sa = Math.sin(sp[2]);
        PX[0] = sp[0] + sx * 0.8; PY[0] = sp[1] + sy * 0.8; PP[0] = 0.7; PX[1] = sp[0] + ca * sp[3] * 0.55 + sx; PY[1] = sp[1] + sa * sp[3] * 0.55 - 1 + sy; PP[1] = 0.55; PX[2] = sp[0] + ca * sp[3] + sx * 1.15; PY[2] = sp[1] + sa * sp[3] - 2.4 + sy * 1.15; PP[2] = 0.2;
        E.stroke(3, 0.85, PENCIL, o3, vis, tw.seed + 3 + s);
      }
      // buds: a dot of new colour at the end of the twig while spring gathers
      const sw = sstep(t.bud - 0.16, t.bud - 0.02, st.SP) * (1 - sstep(t.bud + 0.02, t.bud + 0.2, st.SP));
      if (sw > 0.05) {
        c2[0] = 0.72; c2[1] = 0.80; c2[2] = 0.30; shadeLeaf(c2, 0.6, 0.3, 0.5, col);
        PX[0] = t.x + sx; PY[0] = t.y + sy; PP[0] = 0.9; E.stroke(1, 2.2 * sw + 0.8, PENCIL, col, sw, tw.seed + 9);
      }
    }
  }

  function drawSnowOnWood() {
    const sb = st.snowB; if (sb < 0.03) return;
    const sc = snowColour();
    const cap = (x0, y0, x1, y1, w0, w1, seed, thr) => {
      const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy); if (L < 3) return;
      const flat = Math.abs(dx) / L; if (flat < 0.45) return;
      const a = c01((sb - thr) / 0.25) * c01((flat - 0.45) / 0.3); if (a <= 0.02) return;
      const th = (1.6 + 0.45 * Math.max(w0, w1)) * (0.5 + 0.8 * sb) * a;
      PX[0] = x0; PY[0] = y0 - w0 * 0.55 - th * 0.35; PP[0] = 0.7; PX[1] = (x0 + x1) / 2; PY[1] = (y0 + y1) / 2 - (w0 + w1) * 0.275 - th * 0.45; PP[1] = 1; PX[2] = x1; PY[2] = y1 - w1 * 0.55 - th * 0.35; PP[2] = 0.6;
      E.erase(3, th * 2.6, 0.9 * a, sc);
      E.stroke(3, th, CRAYON, sc, a, seed);
    };
    for (let li = 0; li < Sc.LIMBS.length; li++) { const s = Sc.LIMBS[li]; if (s[1] > 520 && s[4] > 520) continue; cap(s[0], s[1], s[3], s[4], s[2] * 1.9, s[5] * 1.9, 9000 + li, 0.06 + 0.3 * hash1(li, 71)); }
    for (let bi = 0; bi < branches.length; bi++) {
      const br = branches[bi], nn = br.nodes.length, thr = 0.08 + 0.5 * hash1(bi, 72);
      if (sb < thr) continue;
      for (let j = 0; j < nn - 1; j += 2) { const a = nodes[br.nodes[j]], b = nodes[br.nodes[Math.min(nn - 1, j + 2)]]; cap(a.x + ndx[br.nodes[j]], a.y + ndy[br.nodes[j]], b.x + ndx[br.nodes[Math.min(nn - 1, j + 2)]], b.y + ndy[br.nodes[Math.min(nn - 1, j + 2)]], a.w, b.w, 12000 + bi * 8 + j, thr); }
    }
  }

  // ---------- one leaf's colour: what it is this week, in this light
  function shadeLeaf(alb, ndl, trans, occ, o, U, rim) {
    const A = st.Av, Sn = st.Sv, G = st.Gv;
    const gk = U === undefined ? 0 : Math.max(0, U) * 2.6, ge = U === undefined ? 0 : Math.max(0, U - 0.2) * 1.5;
    const tr = trans, fl = st.flashK;
    // (light that comes through a leaf from behind is yellower than the leaf; the small light is gold on leaves, as in the original)
    const r = alb[0] * (Sn[0] * ndl * 1.2 + A[0] * occ + G[0] * gk * 1.12 + st.bounce + fl * 0.45) + Sn[0] * tr * (0.35 + 0.65 * alb[0]) * 0.80 + G[0] * ge * ge * 0.62;
    const g = alb[1] * (Sn[1] * ndl * 1.2 + A[1] * occ + G[1] * gk * 0.90 + st.bounce + fl * 0.5) + Sn[1] * tr * (0.30 + 0.70 * alb[1]) * 0.86 + G[1] * ge * ge * 0.50;
    const b = alb[2] * (Sn[2] * ndl * 1.2 + A[2] * occ + G[2] * gk * 0.80 + st.bounce + fl * 0.65) + Sn[2] * tr * alb[2] * 0.30 + G[2] * ge * ge * 0.26;
    // the sky's own colour along the tops of the masses (the blue rim of the original's night leaves)
    const rk = rim ? rim * 0.30 : 0, z = st.zenith;
    Lk.grade(o, 0, r + z[0] * rk, g + z[1] * rk, b + z[2] * rk);
    const vk = st.veil * 0.14, fog = st.fogCol; o[0] += (fog[0] - o[0]) * vk; o[1] += (fog[1] - o[1]) * vk; o[2] += (fog[2] - o[2]) * vk;
    return o;
  }
  const A_NEW = [0.74, 0.86, 0.36], A_SUM = [0.24, 0.53, 0.24], A_LATE = [0.24, 0.42, 0.20];
  const A_GOLD = [0.96, 0.80, 0.20], A_ORNG = [0.95, 0.52, 0.14], A_RED = [0.80, 0.21, 0.16], A_BRWN = [0.46, 0.30, 0.17];
  function leafAlbedo(i, o) {
    const SP = st.SP, AP = st.AP, b = bud[i];
    const mat = sstep(b + 0.10, b + 0.72, SP);
    mix3(A_NEW, A_SUM, mat, o);
    if (st.dry > 0.2) mix3(o, A_LATE, (st.dry - 0.2) * 0.7, o);
    const u = c01((AP - turn[i]) / 0.17);
    if (u > 0) {
      const h = hue[i];
      // green -> gold -> (orange -> red for those that go that far) -> brown
      const us = u * u * (3 - 2 * u);
      if (h < 0.42) mix3(o, A_GOLD, us, o);
      else if (h < 0.72) { mix3(o, A_GOLD, Math.min(1, us * 1.7), o); mix3(o, A_ORNG, c01(us * 1.7 - 0.7) * (0.6 + 0.4 * (h - 0.42) / 0.3), o); }
      else { mix3(o, A_GOLD, Math.min(1, us * 2.2), o); mix3(o, A_ORNG, c01(us * 2.2 - 0.6), o); mix3(o, A_RED, c01(us * 2.2 - 1.2) * (0.7 + 0.3 * (h - 0.72) / 0.28), o); }
      const ub = c01((AP - turn[i] - 0.42) / 0.5);
      if (ub > 0) mix3(o, A_BRWN, ub * (0.75 + 0.25 * L_.j0[i]), o);
    }
    return o;
  }

  function drawLeaves() {
    if (api.leafCover < 0.0005) return;
    const lx = st.lx, ly = st.ly, lz = st.lz, tau = st.tau;
    const wet = st.wet;
    const hiSun = sstep(15, 60, st.alt), backl = Math.max(0, -lz) * sstep(-1, 6, st.alt), paperHalo = [PAPER[0], PAPER[1], PAPER[2]];
    // the pale rim the eraser leaves round every mass of leaves (the original's bare-paper edge)
    for (let i = 0; i < NT; i++) {
      const t = TUFT[i]; if (t.dead) continue; const lf = tleaf[i]; if (lf < 0.12) continue;
      PX[0] = t.x + tdx[i]; PY[0] = t.y + tdy[i]; PP[0] = 1;
      E.erase(1, t.r * 2.5, 0.20 * sstep(0.12, 0.6, lf), null);
    }
    for (let i = 0; i < NL; i++) {
      const v = lvis[i]; if (v <= 0.01) continue;
      const ti = L_.tuft[i], layer = L_.layer[i], g = lgrow[i];
      // geometry: the stroke rides its tuft, turned a little by the wind
      const rot = trot[ti] * (0.6 + 0.8 * L_.j1[i]) + 0.10 * Math.abs(st.wind) * Math.sin(TWO_PI * (2 + (i & 7)) / 4 * tau + i);
      const ca = Math.cos(rot), sa = Math.sin(rot), gs = 0.35 + 0.65 * g;
      const ox = L_.x[i] + tdx[ti], oy = L_.y[i] + tdy[ti], n = L_.pn[i];
      let p = L_.p0[i] * 3;
      for (let k = 0; k < n; k++, p += 3) { const dx = P[p] * gs, dy = P[p + 1] * gs; PX[k] = ox + dx * ca - dy * sa; PY[k] = oy + dx * sa + dy * ca; PP[k] = P[p + 2]; }
      // light: big mass, clump and tuft each turn a face to the sun
      let nx = 0.25 * L_.cnx[i] + 0.35 * L_.tnx[i] + 0.62 * L_.bnx[i], ny = 0.25 * L_.cny[i] + 0.35 * L_.tny[i] + 0.62 * L_.bny[i];
      const nl = nx * nx + ny * ny; if (nl > 0.96) { const s = 0.98 / Math.sqrt(nl); nx *= s; ny *= s; }
      let nz = Math.sqrt(Math.max(0.04, 1 - nx * nx - ny * ny));
      // leaves mostly hold their faces up to the sky
      { const uy = ny - 0.5, il = 1 / Math.sqrt(nx * nx + uy * uy + nz * nz); nx *= il; ny = uy * il; nz *= il; }
      let ndl = nx * lx - ny * ly + nz * lz;
      ndl = 0.30 + 0.80 * ndl + 0.24 * (L_.nz[i] - 0.5); ndl = ndl < 0.03 ? 0.03 : ndl;
      // and the upper masses shade the lower ones when the sun is high
      ndl *= 1 - 0.5 * hiSun * c01(L_.bf[i] * 1.4) * c01((L_.y[i] + 60) / 520);
      const edge = c01(1.1 - 1.1 * c01(L_.bf[i] * 2.2)) * 0.6 + 0.4 * (1 - nz);
      const trans = backl * (0.12 + 0.88 * Math.max(edge * 0.8, L_.thin[i])) * 1.5;
      const up = c01(-ny * 1.3), occ = (0.62 + 0.38 * c01(0.5 - 0.6 * ny)) * 1.35 + 0.9 * up * up;
      leafAlbedo(i, al);
      if (wet > 0.05) { al[0] *= 1 - 0.18 * wet; al[1] *= 1 - 0.12 * wet; al[2] *= 1 - 0.1 * wet; }
      const tuftLit = 0.72 + 0.28 * sstep(0.0, 0.4, L_.v2[i]);
      let w = L_.w[i], op = v, T = CRAYON;
      if (layer === 5) { shadeLeaf(al, ndl * tuftLit * 0.6, trans * 0.5, occ * 0.72, col, L_.U0[i] * 0.55); T = PENCIL; }
      else if (layer === 6) {
        // the pin: only where there is light to find
        const br = Math.max(c01((ndl - 0.42) * 1.6) * st.direct, c01((L_.U0[i] - 0.05) * 2.2) * st.glow * (L_.U0[i] < 0.42 ? 1 : 0), trans * 0.8);
        if (br < 0.08) continue;
        mix3(al, [1, 0.95, 0.6], 0.45, c2); shadeLeaf(c2, ndl * 1.45, trans * 1.3, occ, col, L_.U0[i] * 1.5);
        E.scratch(n, w * gs + 0.2, 0.9 * v * c01(br * 1.6), col); continue;
      }
      else {
        shadeLeaf(al, ndl * tuftLit, trans, occ, col, L_.U0[i], up * up * (0.5 + L_.j1[i]));
        if (layer >= 2 && layer <= 3) T = PENCIL;
      }
      const j = (L_.j0[i] - 0.5) * 0.11, jh = (L_.j2[i] - 0.5) * 0.07;
      Lk.crayon(col[0] + j + jh, col[1] + j + jh * 0.5, col[2] + j - jh, col, 0);
      E.stroke(n, w * (0.5 + 0.5 * g), T, col, op, i);
    }
  }

  // ---------- leaves in the air; leaves on the ground
  function partColour(p, age, o) {
    // the colour it had when it let go, browning as it lies
    const i = p.i, h = hue[i];
    if (h < 0.42) mix3(A_GOLD, A_ORNG, 0.15, al); else if (h < 0.72) mix3(A_GOLD, A_ORNG, 0.75, al); else mix3(A_ORNG, A_RED, 0.75, al);
    const early = c01((turn[i] + 0.2 - C.AP[p.f0]) / 0.2); if (early > 0) mix3(al, A_GOLD, early * 0.6, al);
    // late leaves were already brown on the twig
    mix3(al, A_BRWN, c01(Math.max(age, (C.AP[p.f0] - turn[i] - 0.42) / 0.5)), al);
    return al;
  }
  function drawLitter() {
    const f = st.f, d = st.cal;
    if (!(d > 8 || d < 0.6)) return;
    const snow = st.snow, eg = C.Egale[f], sunK = 0.30 + 0.70 * Math.pow(Math.max(0, st.ly), 0.75);
    for (let k = 0; k < PARTS.length; k++) {
      const p = PARTS[k];
      let df = f - p.fL; if (df < 0) df += F;
      // has it landed (this leaf-year)?
      let since = f - p.f0; if (since < 0) since += F;
      if (since < p.nF || since > F * 0.52) continue;
      const dd = d < 2 ? d + 18 : d;
      const fade = 1 - sstep(p.gone - 0.9, p.gone, dd); if (fade <= 0.01) continue;
      let e = eg - C.Egale[p.fL]; if (e < -0.25) e = -0.25; if (e > p.stop) e = p.stop;
      const x = p.x1 + p.mob * e * p.sc1, y = p.yL;
      if (x < Wd.X0 - 10 || x > Wd.X1 + 10 || y > Wd.Y1 + 6) continue;
      // snow buries it; the thaw gives it back, darker
      const cover = sstep(0.05 + 0.3 * p.life, 0.2 + 0.3 * p.life, snow); if (cover > 0.97) continue;
      const age = (df / FPS) / 14 + sstep(12.6, 14.2, dd) * 0.8;
      partColour(p, age, al);
      const sh = Pt.shadowAt(x, y), L0 = Sc.nestLight(x, y);
      const A = st.Av, Sn = st.Sv, G = st.Gv, wk = 1 - 0.25 * st.wet;
      Lk.grade(col, 0, al[0] * wk * (Sn[0] * sunK * (1 - sh) + A[0] + G[0] * L0 * 2), al[1] * wk * (Sn[1] * sunK * (1 - sh) + A[1] + G[1] * L0 * 2), al[2] * wk * (Sn[2] * sunK * (1 - sh) + A[2] + G[2] * L0 * 2));
      const s = p.sc1, a = p.rot + (e < p.stop ? e * 9 : 0), L = (2.4 + 2.2 * p.life) * s, ca = Math.cos(a), sa = Math.sin(a) * 0.45;
      PX[0] = x - ca * L; PY[0] = y - sa * L; PP[0] = 0.6; PX[1] = x; PY[1] = y - 0.5 * s; PP[1] = 1; PX[2] = x + ca * L; PY[2] = y + sa * L; PP[2] = 0.5;
      E.stroke(3, (2.0 + 1.4 * p.life) * s, CRAYON, col, fade * (1 - cover), p.i);
    }
  }
  function drawFalling() {
    const f = st.f;
    const A = st.Av, Sn = st.Sv, back = Math.max(0, -st.lz) * sstep(-1, 6, st.alt);
    for (let k = 0; k < PARTS.length; k++) {
      const p = PARTS[k];
      let since = f - p.f0; if (since < 0) since += F;
      if (since >= p.nF) continue;
      const t = since / FPS, u = since / p.nF;
      const dW = (C.Wint[f] - C.Wint[p.f0]) + (f < p.f0 ? C.Wint[F] : 0);
      const sc = lerp(p.sc0, p.sc1, u);
      const settle = 1 - u * u * u;
      const x = p.x0 + p.kw * dW * lerp(p.sc0, p.sc1, u * 0.5) + p.sw * sc * Math.sin(p.om * t + p.ph) * settle;
      const y = p.y0 + (p.yL - p.y0) * (0.25 * u + 0.75 * u * u * (0.6 + 0.4 * u)) + 2.5 * sc * Math.cos(2 * p.om * t + p.ph) * settle;
      if (x < Wd.X0 - 12 || x > Wd.X1 + 12) continue;
      partColour(p, 0, al);
      const face = 0.55 + 0.45 * Math.sin(p.spin * t + p.ph);        // it shows its face and its edge by turns
      const lit = 0.55 + 0.45 * face + back * 0.5;
      // a leaf in the air is thin: whatever light is left in the sky comes through it
      const hz = st.horizon, tk = 0.75 - 0.3 * st.day;
      Lk.grade(col, 0, al[0] * (Sn[0] * lit + A[0] * 1.2 + hz[0] * tk + st.Gv[0] * 0.25), al[1] * (Sn[1] * lit + A[1] * 1.2 + hz[1] * tk + st.Gv[1] * 0.2), al[2] * (Sn[2] * lit * 0.8 + A[2] * 1.2 + hz[2] * tk * 0.8));
      const a = p.rot + p.spin * t * 0.6, L = (2.6 + 2.4 * p.life) * sc, ca = Math.cos(a), sa = Math.sin(a);
      PX[0] = x - ca * L; PY[0] = y - sa * L; PP[0] = 0.6; PX[1] = x + sa * 0.8; PY[1] = y - ca * 0.8; PP[1] = 1; PX[2] = x + ca * L; PY[2] = y + sa * L; PP[2] = 0.5;
      E.stroke(3, (1.2 + 2.6 * Math.abs(face - 0.1) + 1.2 * p.life) * sc, CRAYON, col, Math.min(1, since / 3), p.i);
    }
  }

  // ---------- the bare tree's shadow: every branch laid down on the ground (or the snow) by the sun
  const gcol = [0, 0, 0];
  function shPoint(x, y, zo, o) {
    const ly = st.ly, Xw = TBX + (x - 1150) / 0.847, hgt = (708 - y) / 0.847;
    const Xs = Xw - hgt * st.lx / ly, Zs = TBZ + zo + hgt * st.lz / ly, Z = 600 + Zs;
    if (Z < 175 || Z > 5000) return false;
    o[0] = Sc.NEST.x + Xs * 600 / Z; o[1] = 520 + 600 * 222 / Z; o[2] = 600 / Z; return true;
  }
  const sp3 = [0, 0, 0];
  function drawBranchShadows() {
    const bare = 1 - c01(api.leafCover * 1.6); if (bare < 0.05 || st.ly < 0.07 || st.direct < 0.06) return;
    const a0 = bare * c01(st.direct * 1.3) * sstep(0.07, 0.16, st.ly) * 0.8;
    const shade = k => { gcol[0] *= 0.60; gcol[1] *= 0.66; gcol[2] *= 0.80; };
    for (let bi = 0; bi < branches.length; bi++) {
      const br = branches[bi], nn = br.nodes.length, zo = (hash1(bi, 81) - 0.5) * 90; let n = 0, wm = 0, sc = 1;
      for (let j = 0; j < nn; j++) { const ni = br.nodes[j], nd = nodes[ni]; if (!shPoint(nd.x + ndx[ni], nd.y + ndy[ni], zo, sp3)) { n = 0; break; } PX[n] = sp3[0]; PY[n] = sp3[1]; PP[n] = 0.5 + 0.4 * c01(nd.w / 3); sc = sp3[2]; if (nd.w > wm) wm = nd.w; n++; }
      if (n < 2) continue;
      const mx = PX[n >> 1], my = PY[n >> 1]; if (mx < Wd.X0 - 40 || mx > Wd.X1 + 40 || my > Wd.Y1 + 30 || my < Sc.groundY(mx)) continue;
      Pt.groundCol(mx, my, gcol); shade();
      E.stroke(n, Math.max(1.2, wm * 2.0 * sc / 0.847), wm * sc > 2 ? CRAYON : PENCIL, gcol, a0 * 0.85, br.seed + 77);
    }
    for (let k = 0; k < twigs.length; k += 1) {
      const tw = twigs[k], ti = tw.ti, t = TUFT[ti]; if (tleaf[ti] > 0.3) continue;
      const zo = t.zoff * 60, p0 = tw.pts[0], p1 = tw.pts[tw.pts.length - 1];
      if (!shPoint(p0[0], p0[1], zo, sp3)) continue; PX[0] = sp3[0]; PY[0] = sp3[1]; PP[0] = 0.7;
      if (!shPoint(p1[0] + tdx[ti], p1[1] + tdy[ti], zo, sp3)) continue; PX[1] = sp3[0]; PY[1] = sp3[1]; PP[1] = 0.4;
      if (PX[0] < Wd.X0 - 20 || PX[0] > Wd.X1 + 20 || PY[0] > Wd.Y1 + 20 || PY[0] < Sc.groundY(PX[0])) continue;
      Pt.groundCol(PX[0], PY[0], gcol); shade();
      E.stroke(2, Math.max(0.9, 1.3 * sp3[2] / 0.847), PENCIL, gcol, a0 * 0.6, tw.seed + 78);
    }
  }
  function draw() { drawWood(); drawSnowOnWood(); drawLeaves(); drawFalling(); }
  Object.assign(api, { prepare, draw, drawLitter, drawBranchShadows, drawFalling, localWind, snowColour, shadeLeaf, woodCol, TBX, TBZ, bigField, inCanopy });
  return api;
}

module.exports = { create };
