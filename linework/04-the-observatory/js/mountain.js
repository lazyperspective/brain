// The Observatory: mountain rock. Faceted granite (each plane lit and hatched in its own
// direction), a facet-cell slope texture whose lines change direction cell by cell, broken rock
// bands with undercut shadows, scree fans at gully mouths, grass patches, alpine flowers, and
// the massif / foreground assemblies built from them.
'use strict';
(function () {
  const OB = window.OB;
  const { clamp, smooth, lerp, mix, css } = OB;
  const W = OB.W;
  const LIGHT = (() => { const l = [-0.5, -0.62, 0.6]; const n = Math.hypot(...l); return l.map((v) => v / n); })();

  const tri = (P) => { const p = new Path2D(); p.moveTo(P[0][0], P[0][1]); p.lineTo(P[1][0], P[1][1]); p.lineTo(P[2][0], P[2][1]); p.closePath(); return p; };
  const segAngle = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);

  // ------------------------------------------------------------------ alpine flowers
  OB.flowers = (P, Pc, x, y, s, R, n = 4) => {
    for (let k = 0; k < n; k++) {
      const fx = x + (R() - 0.5) * s * 3, fy = y - R() * s * 1.4;
      const r = s * (0.45 + 0.4 * R());
      const np = 5;
      const a0 = R() * 6.28;
      for (let i = 0; i < np; i++) {
        const a = a0 + (i / np) * OB.TAU;
        const px = fx + Math.cos(a) * r * 0.55, py = fy + Math.sin(a) * r * 0.45;
        P.moveTo(px + r * 0.42, py);
        P.ellipse(px, py, r * 0.42, r * 0.28, a, 0, OB.TAU);
      }
      Pc.moveTo(fx + r * 0.22, fy);
      Pc.arc(fx, fy, r * 0.22, 0, OB.TAU);
    }
  };

  // ------------------------------------------------------------------ granite
  OB.drawGranite = (ctx, poly, o) => {
    const R = OB.rng(o.seed), C = OB.C;
    const s = o.size, tag = o.tag, lw = o.lw;
    const c0 = OB.centroid(poly);
    const gap = o.gap === undefined ? s * 0.025 + 1.5 : o.gap;
    let base = poly.map((q) => {
      const dx = q[0] - c0[0], dy = q[1] - c0[1];
      const l = Math.hypot(dx, dy) || 1;
      const k = Math.max(0.3, (l - gap) / l);
      return [c0[0] + dx * k, c0[1] + dy * k];
    });
    // drop near-duplicate vertices, then knock a corner off for a fractured silhouette
    base = base.filter((q, i) => OB.dist(q, base[(i + 1) % base.length]) > s * 0.06);
    if (base.length < 3) return null;
    if (R() < 0.6 && base.length > 3) {
      const i = Math.floor(R() * base.length), a = base[(i - 1 + base.length) % base.length], b = base[i], c = base[(i + 1) % base.length];
      const t1 = 0.25 + 0.25 * R(), t2 = 0.25 + 0.25 * R();
      base.splice(i, 1, [b[0] + (a[0] - b[0]) * t1, b[1] + (a[1] - b[1]) * t1], [b[0] + (c[0] - b[0]) * t2, b[1] + (c[1] - b[1]) * t2]);
    }
    const out = OB.roughen(base, true, s * 0.012 + 0.5, 0.09, o.seed % 997, Math.max(3, s * 0.02));
    const outPath = OB.path(out);
    const bb = OB.bbox(out);
    const [cx, cy] = OB.centroid(base);
    const w = bb[2] - bb[0], h = bb[3] - bb[1];
    const inkAt = (x, y) => OB.warmCss(C.ink, x, y, tag, 1);
    const wk = OB.warm(cx, cy, tag);
    const tone = (d) => mix(OB.toneOf(o.tones, d), C.warmStone, Math.min(0.45, wk * 0.5));
    if (o.halo !== false) {
      const k = 1 + (Math.max(gap, s * 0.02 + 2) * 2.2) / Math.max(10, Math.min(w, h) * 0.5);
      ctx.fillStyle = css(C.crevice, 0.92);
      ctx.fill(OB.path(base.map((q) => [cx + (q[0] - cx) * k, cy + (q[1] - cy) * k + Math.max(gap, 3) * 0.6])));
      ctx.fillStyle = css(C.crevice, 0.5);
      ctx.fill(OB.path(base.map((q) => [q[0] + s * 0.035, q[1] + s * 0.06])));
    }
    // block planes: a sky-lit top cut off by a kinked lip, then front planes split by
    // fracture lines; the face turned to the light is pale, the one turned away is dark
    const xL = bb[0] - 20, xR = bb[2] + 20, yT = bb[1] - 30, yB = bb[3] + 30;
    const nk = 2 + Math.floor(R() * 2);
    const cut = [];
    const tf = o.topF === undefined ? 0.24 + 0.16 * R() : o.topF;
    const tiltC = (R() - 0.5) * 0.55;
    for (let i = 0; i <= nk; i++) {
      const x = lerp(xL, xR, i / nk) + (i > 0 && i < nk ? (R() - 0.5) * w * 0.25 : 0);
      cut.push([x, bb[1] + h * (tf + (R() - 0.5) * 0.34) + (x - cx) * tiltC]);
    }
    const cutY = (x) => {
      for (let i = 0; i < cut.length - 1; i++) if (x <= cut[i + 1][0]) return lerp(cut[i][1], cut[i + 1][1], (x - cut[i][0]) / (cut[i + 1][0] - cut[i][0] || 1));
      return cut[cut.length - 1][1];
    };
    // fracture lines down the front
    const ns = w > s * 0.5 ? 1 + Math.floor(R() * 2.4) : 1;
    const splits = [];
    for (let k = 1; k <= ns; k++) {
      const x0 = lerp(bb[0], bb[2], k / (ns + 1) + (R() - 0.5) * 0.18);
      splits.push([[x0, cutY(x0)], [x0 + (R() - 0.35) * w * 0.25, yB]]);
    }
    const faces = [];
    faces.push({ poly: cut.concat([[xR, yT], [xL, yT]]), n: [(R() - 0.5) * 0.5, -0.88, 0.45], top: true });
    const xs = [[[xL, cutY(xL)], [xL, yB]]].concat(splits, [[[xR, cutY(xR)], [xR, yB]]]);
    for (let k = 0; k < xs.length - 1; k++) {
      const a = xs[k], b = xs[k + 1];
      const topPts = [];
      for (let x = a[0][0]; x <= b[0][0]; x += 6) topPts.push([x, cutY(x)]);
      topPts.push(b[0]);
      const poly = [a[0]].concat(topPts, [b[1], a[1]]);
      const t = (k + 0.5) / (xs.length - 1);
      faces.push({ poly, n: [lerp(-0.75, 0.8, t) + (R() - 0.5) * 0.3, 0.05 + (R() - 0.5) * 0.25, 0.7] });
    }
    ctx.save();
    ctx.clip(outPath);
    const fd = faces.map((f) => {
      const l = Math.hypot(...f.n);
      const lam = Math.max(0, (f.n[0] * LIGHT[0] + f.n[1] * LIGHT[1] + f.n[2] * LIGHT[2]) / l);
      const fc = OB.centroid(f.poly.filter((q) => q[0] >= bb[0] - 5 && q[0] <= bb[2] + 5));
      return { F: f.poly, top: f.top, lam, d: clamp(o.D + 0.8 * (0.5 - lam) + 0.05 * R.norm() - 0.5 * OB.warm(fc[0], fc[1], tag)) };
    });
    ctx.save();
    ctx.translate(OB.MR[0], OB.MR[1]);
    for (const f of fd) {
      ctx.fillStyle = css(f.top ? mix(tone(f.d), C.rockHi, 0.14) : tone(f.d));
      ctx.fill(OB.path(f.F));
    }
    ctx.restore();
    fd.forEach((f, k) => {
      const ang = f.top ? (R() < 0.5 ? Math.atan2(cut[cut.length - 1][1] - cut[0][1], cut[cut.length - 1][0] - cut[0][0]) + (R() - 0.5) * 0.3 : (R() - 0.5) * 1.6 + Math.PI / 2 * R.sign() * 0.6) : Math.PI / 2 + (k - fd.length / 2) * 0.22 + (R() - 0.5) * 0.45;
      ctx.save();
      ctx.clip(OB.path(f.F));
      const D = (x, y) => f.d + (f.top ? 0.15 * (y - bb[1]) / (h + 1) : 0.18 * ((y - cutY(x)) / (bb[3] - cutY(x) + 1) - 0.3)) - 0.45 * OB.warm(x, y, tag);
      OB.engrave(ctx, { bbox: bb, angle: ang, sp: o.sp * (f.top ? 1.3 : 0.95 + 0.15 * R()), D, w: lw * 1.2, wmin: lw * 0.3, levels: 8, colAt: inkAt, wob: 0.35, seed: o.seed * 7 + k, step: 3, fade: 0.25 });
      if (f.d > 0.58) OB.engrave(ctx, { bbox: bb, angle: ang + 0.95 + (R() - 0.5) * 0.3, sp: o.sp * 1.1, D: (x, y) => D(x, y) - 0.55, thrRange: 0.45, w: lw, wmin: lw * 0.3, levels: 8, colAt: inkAt, wob: 0.4, seed: o.seed * 7 + k + 100, step: 3 });
      ctx.restore();
    });
    // edges: the lip (pale above, ink below) and the fracture lines
    {
      const Pk = new Path2D(), Ph = new Path2D();
      const lip = OB.resample(cut, 4);
      OB.ink(Pk, lip.map((q, i) => [q[0], q[1] + 0.8 * OB.N(i * 0.3, o.seed)]), lw * 1.3, { t0: 0.05, t1: 0.05, wn: 0.5, ph: o.seed });
      OB.ink(Ph, lip.map((q) => [q[0], q[1] - lw * 2.2]), lw * 0.9, { t0: 0.2, t1: 0.2, wn: 0.7, ph: o.seed + 3 });
      for (const sp of splits) OB.ink(Pk, OB.wline(sp[0][0], sp[0][1], sp[1][0], sp[1][1], 5, 0.8 + s * 0.004, sp[0][0]), lw * (0.9 + 0.4 * R()), { t0: 0.05, t1: 0.3, wn: 0.5, ph: sp[0][1] });
      ctx.fillStyle = inkAt(cx, cy);
      ctx.fill(Pk);
      ctx.fillStyle = css(mix(C.rockHi, C.amberLine, Math.min(1, wk * 1.3)), 0.7);
      ctx.fill(Ph);
    }
    // cracks
    if (s > 50) {
      const P = new Path2D();
      const nc = Math.floor(R() * (s > 180 ? 4 : 2.6));
      for (let c = 0; c < nc; c++) {
        const p0 = out[Math.floor(R() * out.length)];
        let x = p0[0], y = p0[1];
        let a = Math.atan2(cy - y, cx - x) + (R() - 0.5) * 0.8;
        const pts = [[x, y]];
        const L = s * (0.3 + 0.5 * R());
        for (let d = 0; d < L; d += 4) {
          a += (R() - 0.5) * 0.9;
          x += Math.cos(a) * 4; y += Math.sin(a) * 4;
          pts.push([x, y]);
        }
        OB.ink(P, pts, lw * 1.25, { t0: 0.05, t1: 0.8, wn: 0.5, ph: c * 3 + o.seed });
      }
      ctx.fillStyle = inkAt(cx, cy);
      ctx.fill(P);
    }
    // lichen: speckle colonies on the lit planes, dark pits elsewhere
    if (s > 45) {
      const Pl = new Path2D(), Pd = new Path2D();
      const colonies = 1 + Math.floor(R() * Math.min(7, 3 * (s / 150)));
      for (let c = 0; c < colonies; c++) {
        const f = fd.reduce((best, q) => (q.lam > best.lam && R() < 0.7 ? q : best), fd[0]);
        const fc = OB.centroid(f.F);
        const rr = Math.min(22, s * (0.03 + 0.05 * R()));
        const nd = Math.floor(rr * rr * 0.12);
        for (let k = 0; k < nd; k++) {
          const a = R() * OB.TAU, r = rr * Math.sqrt(R());
          const x = fc[0] + Math.cos(a) * r, y = fc[1] + Math.sin(a) * r * 0.7;
          const rd = 0.5 + R() * 0.9;
          Pl.moveTo(x + rd, y);
          Pl.arc(x, y, rd, 0, OB.TAU);
        }
      }
      const np = Math.floor(s * s * 0.0005);
      for (let k = 0; k < np; k++) {
        const x = bb[0] + R() * w, y = bb[1] + R() * h, rd = 0.5 + R() * 0.9;
        Pd.moveTo(x + rd, y);
        Pd.arc(x, y, rd, 0, OB.TAU);
      }
      ctx.fillStyle = css(C.lichen, 0.55);
      ctx.fill(Pl);
      ctx.fillStyle = css(C.ink, 0.55);
      ctx.fill(Pd);
    }
    ctx.restore();
    OB.outline(ctx, out, lw * 1.6 * (o.olw || 1), inkAt, {});
    return out;
  };

  // ------------------------------------------------------------------ seeds / cells
  OB.seedField = (bbox, size, R, jit = 0.7) => {
    const seeds = [];
    for (let y = bbox[1]; y < bbox[3] + size(bbox[3]);) {
      const s = size(y);
      let x = bbox[0] - R() * s;
      while (x < bbox[2] + s) {
        seeds.push([x + (R() - 0.5) * s * jit, y + (R() - 0.5) * s * jit * 0.8, s]);
        x += s * (0.8 + 0.4 * R());
      }
      y += s * 0.82;
    }
    return seeds;
  };
  OB.cellsOf = (seeds, bbox) => {
    const cells = OB.voronoi(seeds, [bbox[0] - 200, bbox[1] - 200, bbox[2] + 200, bbox[3] + 200]);
    return cells.map((c, i) => ({ poly: c, seed: seeds[i], size: seeds[i][2] })).filter((c) => c.poly.length > 2);
  };

  // ------------------------------------------------------------------ the massif, part 1: slope
  OB.drawMassifBase = (ctx, S) => {
    const M = S.massif, C = OB.C;
    const N = OB.noise(41), N2 = OB.noise(42), R = OB.rng(43);
    const crest = M.crest;
    const persp = (y) => lerp(0.5, 2.0, smooth(1700, 3900, y));
    M.persp = persp;
    const hgt = (x, y) => {
      const p = persp(y);
      const sx = x / (240 * p), sy = y / (760 * p);
      const r1 = 1 - Math.abs(N2(sx, sy));
      const r2 = 1 - Math.abs(N2(sx * 2.2 + 5.1, sy * 2.0));
      return -y + p * (62 * r1 * r1 + 20 * r2 * r2);
    };
    const grad = (x, y) => {
      const e = 4;
      return [(hgt(x + e, y) - hgt(x - e, y)) / (2 * e), (hgt(x, y + e) - hgt(x, y - e)) / (2 * e)];
    };
    M.grad = grad;
    const spurX = (y) => (y < 2600 ? lerp(1780, 1560, (y - 1750) / 850) : lerp(1560, 1380, (y - 2600) / 1300)) + 70 * N.fbm(y * 0.003, 2.2, 2);
    // big faceted planes: the mountain as a crystal of lit and shadowed faces
    const Rm = OB.rng(48);
    const msize = (y) => lerp(150, 520, Math.pow(smooth(1680, 3950, y), 0.85));
    const mseeds = OB.seedField([-100, 1600, W + 100, 3950], msize, Rm, 0.85);
    const mval = mseeds.map((q) => {
      const g = grad(q[0], q[1]);
      // plane normal: tilted by the local terrain plus a strong random facet tilt
      const nx = clamp(-g[0] * 1.2 + (Rm() - 0.5) * 1.3, -0.95, 0.95), ny = -0.25 + (Rm() - 0.5) * 0.5;
      const nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny));
      const lam = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      return 0.5 - 0.62 * (lam - 0.55);
    });
    const mcs = 120, mgw = Math.ceil((W + 400) / mcs), mgrid = new Map();
    mseeds.forEach((q, i) => { const k = Math.floor((q[1] + 200) / mcs) * mgw + Math.floor((q[0] + 200) / mcs); (mgrid.get(k) || mgrid.set(k, []).get(k)).push(i); });
    const macroAt = (x, y) => {
      const gx = Math.floor((x + 200) / mcs), gy = Math.floor((y + 200) / mcs);
      let best = 0, bd = Infinity;
      for (let r = 1; r <= 5; r++) {
        for (let j = gy - r; j <= gy + r; j++) for (let i = gx - r; i <= gx + r; i++) {
          const a = mgrid.get(j * mgw + i);
          if (!a) continue;
          for (const q of a) { const d = (mseeds[q][0] - x) ** 2 + (mseeds[q][1] - y) ** 2; if (d < bd) { bd = d; best = q; } }
        }
        if (bd < ((r - 1) * mcs) ** 2) break;
      }
      return best;
    };
    M.D = (x, y) => {
      const sh = smooth(-90, 140, x - spurX(y));
      return clamp(0.12 + 0.62 * mval[macroAt(x, y)] + 0.26 * sh + 0.1 * smooth(1400, 2150, x) + 0.1 * smooth(2000, 3800, y)
        - 0.14 * (1 - smooth(0, 120, y - crest(x))) + 0.06 * N.fbm(x * 0.008, y * 0.008, 2) - 0.55 * OB.warm(x, y, 'massif'));
    };
    M.macro = { seeds: mseeds, val: mval };
    M.grass = (x, y) => N.fbm(x * 0.0035 + 3, y * 0.0045, 3) - 0.08 * smooth(1500, 2000, x);
    OB.posterFill(ctx, M.path, M.bbox, M.D, C.massifTones, { step: 6, dither: 0.03 });

    // facet cells: each a little plane hatched in its own direction
    const size = (y) => lerp(34, 190, Math.pow(smooth(1680, 3950, y), 0.9));
    const seeds = OB.seedField([0, 1650, W, 3900], size, R);
    const cells = OB.cellsOf(seeds, [0, 1650, W, 3900]).filter((c) => M.mask.inside(c.seed[0], c.seed[1]) || M.mask.inside(c.seed[0], c.seed[1] + c.size * 0.5));
    M.cells = cells;
    ctx.save();
    ctx.clip(M.path);
    const Bc = new OB.Batch();
    cells.forEach((c, k) => {
      const [sx, sy] = c.seed;
      const g = grad(sx, sy);
      const fall = Math.atan2(-g[1], -g[0]);
      const grassy = M.grass(sx, sy) > 0.12;
      const mode = R();
      const ang = mode < 0.5 ? fall + (R() - 0.5) * 0.7 : mode < 0.85 ? fall + Math.PI / 2 + (R() - 0.5) * 0.5 : fall + 0.75 * R.sign();
      const off = 0.09 * R.norm() + (grassy ? -0.1 : 0.02);
      const rp = OB.roughen(c.poly, true, c.size * 0.04, 2.5 / c.size, k % 997, Math.max(3, c.size * 0.04));
      const cb = OB.bbox(rp);
      const ch = cb[3] - cb[1] + 1;
      ctx.save();
      ctx.clip(OB.path(rp));
      const p = persp(sy);
      OB.engrave(ctx, {
        bbox: cb, angle: ang, sp: lerp(2.5, 5.2, smooth(1700, 3900, sy)) * (grassy ? 1.25 : 1), D: (x, y) => M.D(x, y) + off + 0.16 * ((y - cb[1]) / ch - 0.45),
        w: lerp(0.8, 1.8, smooth(1700, 3900, sy)), wmin: 0.3, levels: 8, colAt: (x, y) => OB.warmCss(C.ink, x, y, 'massif', 1), wob: 0.4, seed: 2000 + k, step: 3 + p, fade: 0.25,
      });
      ctx.restore();
      // crack network: broken cell edges, stronger where the ground is rocky
      if (!grassy) {
        const loop = rp.concat([rp[0]]);
        const m = loop[loop.length >> 1];
        const lw = lerp(0.8, 1.7, smooth(1700, 3900, sy));
        OB.runs(Bc.get(OB.warmCss(C.ink, m[0], m[1], 'massif', 1)), loop, (i) => lw * (0.8 + 0.6 * OB.N(i * 0.1, k)), (i) => OB.N(i * 0.06 + k * 1.3, k * 0.7) > -0.05, 3);
      }
    });
    Bc.fill(ctx);
    // arêtes: ink along the edges between the big planes, with a pale lit lip where the
    // upper plane faces the light
    {
      const mc = OB.voronoi(M.macro.seeds, [-300, 1400, W + 300, 4200]);
      const Pk = new Path2D(), Ph = new Path2D();
      mc.forEach((poly, i) => {
        const loop = OB.resample(poly.concat([poly[0]]), 6, false);
        const pts = OB.roughen(loop, false, 5, 0.03, i % 97, 6);
        const ws = pts.map((q) => lerp(1.2, 3.2, smooth(1700, 3900, q[1])));
        OB.runs(Pk, pts, (k) => ws[k] * (0.7 + 0.6 * OB.N(k * 0.08, i)), (k) => M.mask.inside(pts[k][0], pts[k][1]) && pts[k][1] > crest(pts[k][0]) + 12 && OB.N(k * 0.05 + i, 3.3) > -0.3, 3);
        if (M.macro.val[i] < 0.42) OB.runs(Ph, pts.map((q) => [q[0], q[1] - 3]), () => 1.0, (k) => M.mask.inside(pts[k][0], pts[k][1]) && pts[k][1] > crest(pts[k][0]) + 12 && OB.N(k * 0.07 + i, 8.1) > 0.15, 3);
      });
      ctx.fillStyle = css(C.ink);
      ctx.fill(Pk);
      ctx.fillStyle = css(C.rockHi, 0.45);
      ctx.fill(Ph);
    }

    // scree fans at gully mouths: loose angular stones spilling down the fall line
    {
      const Ps = new Path2D(), Pf = new Path2D(), Pd = new Path2D();
      for (const f of S.scree) {
        const p = persp(f.y);
        const L = f.len * p, spread = f.spread;
        const fan = [[f.x, f.y]];
        for (let a = -spread; a <= spread + 1e-6; a += spread / 8) fan.push([f.x + Math.sin(a + f.tilt) * L * (0.9 + 0.15 * OB.N(a * 5, f.x)), f.y + Math.cos(a + f.tilt) * L * (0.9 + 0.15 * OB.N(a * 5, f.x))]);
        const Rf = OB.rng(Math.round(f.x));
        const nst = Math.floor(L * L * spread * 0.012);
        for (let k = 0; k < nst; k++) {
          const t = Math.sqrt(Rf()), a = (Rf() * 2 - 1) * spread * (0.3 + 0.7 * t);
          const x = f.x + Math.sin(a + f.tilt) * L * t * 0.95, y = f.y + Math.cos(a + f.tilt) * L * t * 0.95;
          const r = p * (1.2 + 4.2 * t * Rf()) * (1 - 0.5 * Math.abs(a) / spread);
          const poly = [];
          const nv = 4 + Math.floor(Rf() * 3), a0 = Rf() * 6;
          for (let v = 0; v < nv; v++) { const aa = a0 + (v / nv) * OB.TAU; poly.push([x + Math.cos(aa) * r * (0.7 + 0.5 * Rf()), y + Math.sin(aa) * r * 0.65 * (0.7 + 0.5 * Rf())]); }
          OB.path(poly, true, Ps);
          OB.path(poly.map((q) => [q[0] + r * 0.25, q[1] + r * 0.3]), true, Pd);
          if (Rf() < 0.3) OB.ribbon(Pf, [[x, y - r * 2], [x + 0.5, y - r * 0.8]], [0.2, 0.9 * p]);
        }
      }
      ctx.fillStyle = css(C.ink, 0.75);
      ctx.fill(Pd);
      ctx.fillStyle = css(C.screeStone);
      ctx.fill(Ps);
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = css(C.ink);
      ctx.stroke(Ps);
      ctx.fillStyle = css(C.ink);
      ctx.fill(Pf);
    }

    // alpine grass patches drawn as tufts
    {
      const Pd = new Path2D(), Pl = new Path2D(), Pfl = new Path2D(), Pfc = new Path2D();
      for (let k = 0; k < 5200; k++) {
        const x = R() * W, y = 1720 + R() * 2150;
        if (!M.mask.inside(x, y) || y < crest(x) + 8) continue;
        const gr = M.grass(x, y);
        if (gr < 0.12 && R() > 0.12) continue;
        const sz = lerp(8, 34, smooth(1700, 3800, y)) * (0.6 + 0.6 * R());
        OB.tuft(Pd, Pl, x, y, sz, 0.35, R, 0.3);
        if (gr > 0.3 && R() < 0.05 && y > 2300) OB.flowers(Pfl, Pfc, x, y - sz * 0.3, sz * 0.12, R, 3);
      }
      ctx.fillStyle = css(C.ink);
      ctx.fill(Pd);
      ctx.fillStyle = css(C.grassHi, 0.7);
      ctx.fill(Pl);
      ctx.fillStyle = css(C.flower, 0.85);
      ctx.fill(Pfl);
      ctx.fillStyle = css(C.amberLine, 0.8);
      ctx.fill(Pfc);
    }
    ctx.restore();
    const P = new Path2D();
    OB.ink(P, M.crestPts, 4.2, { t0: 0, t1: 0, wn: 0.4, ph: 3 });
    ctx.fillStyle = css(C.ink);
    ctx.fill(P);
  };

  // ------------------------------------------------------------------ the massif, part 2: rock
  OB.drawMassifRocks = (ctx, S) => {
    const M = S.massif, C = OB.C;
    const N = OB.noise(51), R = OB.rng(52);
    const crest = M.crest, persp = M.persp;
    const clipP = new Path2D();
    OB.path(M.crestPts.map((q) => [q[0], q[1] - 42]).concat([[2200, 3900], [-40, 3900]]), true, clipP);
    ctx.save();
    ctx.clip(clipP);
    // 1) broken rock bands: little cliffs with a lit lip and an undercut shadow beneath
    const face = new Path2D();
    const shadows = new Path2D();
    const bandEdges = [];
    let nb = 0;
    for (const b of S.rockBands) {
      const segs = [];
      let cur = null;
      for (let x = b.x0; x <= b.x1; x += 6) {
        const yc = b.y + (x - b.x0) * b.slope + b.fold * N.fbm(x * 0.002, b.y * 0.01, 3);
        const p = persp(yc);
        const th = b.h * 1.45 * p * (0.55 + 0.9 * Math.max(0, N(x * 0.006, b.y)));
        const pd = S.pathDist(x, yc);
        const onPath = pd.d < pd.w * 0.75 + th * 0.4;
        const alive = N(x * 0.0045 + b.y, 7) > b.gaps + 0.12 && M.mask.inside(x, yc + th * 0.5) && yc > crest(x) + 30 && (!onPath || b.occlude);
        if (alive) { (cur || (cur = [])).push([x, yc - th * 0.45, yc + th * 0.55, th]); }
        else if (cur) { if (cur.length > 5) segs.push(cur); cur = null; }
      }
      if (cur && cur.length > 5) segs.push(cur);
      for (const sg of segs) {
        const nseg = sg.length;
        // a step in the slope: a near-level top that blends into the ground above, a jagged
        // face hanging below it, thickest mid-way and dying out at the ends
        const tops = [], bots = [];
        sg.forEach((q, i) => {
          const e = Math.pow(Math.sin(Math.PI * (i + 0.5) / nseg), 0.7) * (0.7 + 0.3 * OB.N(i * 0.15, q[0]));
          const ty = q[1] + q[3] * 0.45 * (1 - e) + 2 * OB.N(i * 0.3, 1);
          tops.push([q[0], ty]);
          bots.push([q[0], ty + q[3] * e + q[3] * 0.18 * OB.N(i * 0.4, 2) * e]);
        });
        const pr = persp(sg[0][1]);
        const poly = OB.roughen(tops.concat(bots.slice().reverse()), true, 2.5 * pr, 0.08, nb++ % 97, 4);
        OB.path(poly, true, face);
        bandEdges.push({ tops, bots, pr });
        const sh = bots.map((q, i) => [q[0], q[1] + (q[1] - tops[i][1]) * 0.22]);
        OB.path(bots.map((q) => [q[0], q[1] - 2]).concat(sh.reverse()), true, shadows);
      }
    }
    ctx.fillStyle = css(C.crevice, 0.55);
    ctx.fill(shadows);
    OB.drawCliff(ctx, face, [0, 1700, W, 3900], {
      D: (x, y) => clamp(M.D(x, y) + 0.05), dip: -0.06, fold: 20, seed: 57, tag: 'massif', tones: C.rockTones, olw: 2.2, grass: 0.14,
      bandH: (y) => lerp(16, 70, Math.pow(smooth(1680, 3900, y), 0.9)),
      strips: [[0, 2250, 2.5, 0.95], [2250, 2900, 3.2, 1.2], [2900, 4000, 4.2, 1.6]], noOutline: true,
    });
    {
      // ink only where the step casts its edge: a heavy undercut line, a broken lit lip on top
      const Pk = new Path2D(), Ph = new Path2D();
      bandEdges.forEach((e, i) => {
        OB.ink(Pk, e.bots, 2.4 * e.pr, { t0: 0.12, t1: 0.12, wn: 0.5, ph: i });
        OB.runs(Pk, e.tops, () => 1.1 * e.pr, (k) => OB.N(k * 0.08, i + 3) > 0.05, 3);
        OB.runs(Ph, e.tops.map((q) => [q[0], q[1] + 2.5 * e.pr]), () => 1.1 * e.pr, (k) => OB.N(k * 0.06, i + 7) > -0.2, 3);
      });
      ctx.fillStyle = css(C.ink);
      ctx.fill(Pk);
      ctx.fillStyle = css(C.rockHi, 0.55);
      ctx.fill(Ph);
    }
    // 2) the summit crown and the shadowed right flank: continuous cliff
    const cliffAt = (x, y) => x > 1560 + 140 * N(y * 0.003, 1) || y < crest(x) + 140;
    const rocky = (x, y) => N.fbm(x * 0.0019 + 11, y * 0.0024, 3) * 1.2 + 0.55 * smooth(1550, 1980, x) + 0.75 * (1 - smooth(0, 170, y - crest(x))) - 0.05;
    const cells = M.cells.filter((c) => {
      const [sx, sy] = c.seed;
      if (!M.mask.inside(sx, sy + c.size * 0.25)) return false;
      const pd = S.pathDist(sx, sy);
      const near = 1 - smooth(pd.w * 0.5, pd.w * 1.4 + 26, pd.d - c.size * 0.35);
      c.cliff = cliffAt(sx, sy);
      const rk = rocky(sx, sy) + (c.cliff ? 0.1 : -0.3) - 1.2 * near;
      if (rk < 0.34) return false;
      return c.cliff ? R() > 0.05 : R() > 0.5;
    });
    const cf = new Path2D();
    for (const c of cells) {
      if (!c.cliff) continue;
      const [cx, cy] = OB.centroid(c.poly);
      const ex = c.poly.map((q) => [cx + (q[0] - cx) * 1.05, cy + (q[1] - cy) * 1.05]);
      OB.path(OB.roughen(ex, true, c.size * 0.035, 2.4 / c.size, nb++ % 997, Math.max(3, c.size * 0.03)), true, cf);
    }
    OB.drawCliff(ctx, cf, [0, 1640, W, 3900], {
      D: (x, y) => clamp(M.D(x, y) + 0.04), dip: -0.08, fold: 26, seed: 47, tag: 'massif', tones: C.rockTones, olw: 2.6, grass: 0.12,
      bandH: (y) => lerp(24, 110, Math.pow(smooth(1680, 3900, y), 0.9)),
      strips: [[0, 2250, 2.6, 0.95], [2250, 2900, 3.3, 1.25], [2900, 4000, 4.4, 1.7]],
    });
    // 3) granite outcrops strewn on the slope
    const loose = cells.filter((c) => !c.cliff).sort((a, b) => a.seed[1] - b.seed[1]);
    for (const c of loose) {
      const [sx, sy] = c.seed;
      OB.drawGranite(ctx, c.poly, { D: clamp(M.D(sx, sy) + 0.05 + 0.1 * R.norm()), size: c.size, tones: C.rockTones, tag: 'massif', seed: 3000 + nb++, sp: lerp(2.4, 5, smooth(1700, 3900, sy)), lw: lerp(0.8, 1.8, smooth(1700, 3900, sy)) });
    }
    ctx.restore();
    // 4) rocks and grass mounds that stand in front of the path, hiding stretches of it
    for (const oc of S.pathOccluders) {
      const p = S.path[Math.floor(oc.t * (S.path.length - 1))];
      const s = p.w * oc.s;
      const x = p.x + oc.dx * p.w, y = p.y + oc.dy * p.w;
      const Ro = OB.rng(Math.round(x));
      // a grassy hump standing between the viewer and the path: tone, hatching, then dense tufts
      const hump = [];
      for (let a = Math.PI; a <= OB.TAU + 1e-6; a += 0.12) hump.push([x + Math.cos(a) * s * 1.5 * (1 + 0.15 * OB.N(a * 3, x)), y + Math.sin(a) * s * 0.55 * (1 + 0.25 * OB.N(a * 4, y))]);
      hump.push([x + s * 1.5, y + s * 0.35], [x - s * 1.5, y + s * 0.35]);
      const hp = OB.path(hump);
      OB.flatFill(ctx, hp, css(OB.toneOf(C.massifTones, M.D(x, y) + 0.1)));
      ctx.save();
      ctx.clip(hp);
      OB.engrave(ctx, { bbox: OB.bbox(hump), angle: Math.PI / 2 + 0.3, sp: lerp(2.6, 5, smooth(1700, 3900, y)), D: (px, py) => M.D(px, py) + 0.25 * (py - (y - s * 0.55)) / s, w: lerp(0.9, 1.8, smooth(1700, 3900, y)), levels: 8, colAt: (px, py) => OB.warmCss(C.ink, px, py, 'massif', 1), seed: 4100 + Math.round(x), step: 3 });
      ctx.restore();
      const nst = 1 + Math.floor(Ro() * 2);
      for (let k = 0; k < nst; k++) {
        const rx = x + (Ro() - 0.5) * s * 1.6, ry = y - s * 0.05 + Ro() * s * 0.2, rs = s * (0.3 + 0.25 * Ro());
        const poly = [];
        for (let v = 0; v < 6; v++) { const a = ((v + (Ro() - 0.5) * 0.6) / 6) * OB.TAU; poly.push([rx + Math.cos(a) * rs * (0.8 + 0.4 * Ro()), Math.min(ry + rs * 0.25, ry + Math.sin(a) * rs * 0.65)]); }
        OB.drawGranite(ctx, poly, { D: clamp(M.D(rx, ry)), size: rs * 1.6, tones: C.rockTones, tag: 'massif', seed: 4200 + Math.round(rx), sp: lerp(2.6, 5, smooth(1700, 3900, ry)), lw: lerp(0.9, 1.8, smooth(1700, 3900, ry)), gap: 0, halo: false });
      }
      const Pd = new Path2D(), Pl = new Path2D();
      for (let k = 0; k < 34; k++) {
        const a = Math.PI + Ro() * Math.PI;
        OB.tuft(Pd, Pl, x + Math.cos(a) * s * 1.4 * Ro(), y + Math.sin(a) * s * 0.5 * Ro() + s * 0.1, s * (0.3 + 0.35 * Ro()), 0.35, Ro, 0.3);
      }
      ctx.fillStyle = css(C.ink);
      ctx.fill(Pd);
      ctx.fillStyle = css(C.grassHi, 0.7);
      ctx.fill(Pl);
    }
    S.massifBlocks = nb;
  };

  // ------------------------------------------------------------------ foreground: fractured granite
  OB.drawForeground = (ctx, S) => {
    const C = OB.C, R = OB.rng(81), N = OB.noise(82);
    for (const F of S.fg) {
      const D = (x, y) => clamp(F.d0 + 0.18 * smooth(2950, 3500, y) + 0.22 * smooth(3400, 3840, y) + 0.12 * N.fbm(x * 0.002, y * 0.002, 3) + (F.side === 'L' ? 0.25 * (1 - smooth(0, 650, x)) : 0.25 * smooth(1550, 2160, x)) - 0.5 * OB.warm(x, y, 'fg'));
      // joints and soil between the stones
      OB.flatFill(ctx, F.path, css(C.crevice));
      ctx.lineWidth = 9;
      ctx.strokeStyle = css(C.ink);
      ctx.stroke(F.path);
      const mask = OB.mask((g) => g.fill(F.path), 0.5);
      // a boulder field: rocks of power-law sizes, laid back to front so nearer ones overlap
      const size = (y) => lerp(F.size[0], F.size[1], smooth(F.bbox[1], 3840, y));
      const cand = OB.seedField([F.bbox[0] - 60, F.bbox[1] - 30, F.bbox[2] + 60, F.bbox[3] + 80], (y) => size(y) * 0.62, R, 0.9);
      const rocksIn = [];
      for (const c of cand) {
        const [sx, sy] = c;
        if (!mask.inside(sx, sy) && !mask.inside(sx, sy - 40)) continue;
        const pd = S.pathDist(sx, sy);
        const r = size(sy) * (0.32 + 0.75 * Math.pow(R(), 1.8));
        if (pd.d < pd.w * 0.5 + r * 0.55) continue;
        if (R() < 0.1) continue; // open ground for grass
        rocksIn.push({ x: sx, y: sy, r });
      }
      rocksIn.sort((a, b) => a.y + a.r * 0.3 - (b.y + b.r * 0.3));
      const clipP = OB.path(F.top.map((q) => [q[0], q[1] - 70]).concat(F.poly.slice(F.top.length)));
      ctx.save();
      ctx.clip(clipP);
      // soil and scree between the stones
      {
        const Pg = new Path2D();
        for (let k = 0; k < 2600; k++) {
          const x = F.bbox[0] + R() * (F.bbox[2] - F.bbox[0]), y = F.bbox[1] + R() * (F.bbox[3] - F.bbox[1]);
          if (!mask.inside(x, y)) continue;
          const r = 0.8 + R() * 2.4;
          Pg.moveTo(x + r, y);
          Pg.ellipse(x, y, r, r * 0.6, 0, 0, OB.TAU);
        }
        ctx.fillStyle = css(C.scree, 0.55);
        ctx.fill(Pg);
      }
      const rocks = [];
      rocksIn.forEach((q, k) => {
        const nv = 6 + Math.floor(R() * 3);
        const flat = R();
        const sq = flat < 0.25 ? 0.6 : 0.8 + 0.25 * R();
        const poly = [];
        const a0 = R() * OB.TAU;
        for (let v = 0; v < nv; v++) {
          const a = a0 + ((v + (R() - 0.5) * 0.5) / nv) * OB.TAU;
          let y = q.y + Math.sin(a) * q.r * sq * (0.75 + 0.4 * R());
          y = Math.min(y, q.y + q.r * sq * 0.6);
          poly.push([q.x + Math.cos(a) * q.r * (0.75 + 0.4 * R()), y]);
        }
        const rp = OB.drawGranite(ctx, poly, { D: clamp(D(q.x, q.y) + 0.1 * R.norm()), size: q.r * 1.6, tones: C.fgTones, tag: 'fg', seed: 6000 + F.seed * 1000 + k, sp: lerp(3.8, 6.4, smooth(2900, 3840, q.y)), lw: lerp(1.4, 2.4, smooth(2900, 3840, q.y)), olw: 1.35, gap: 0, topF: flat < 0.25 ? 0.4 + 0.12 * R() : 0.14 + 0.16 * R() });
        if (rp) rocks.push({ p: rp, size: q.r * 1.6, x: q.x, y: q.y });
      });
      // grass and flowers in the joints
      const Pd = new Path2D(), Pl = new Path2D(), Pf = new Path2D(), Pc = new Path2D();
      for (const r of rocks) {
        const poly = r.p;
        const nt = 1 + Math.floor(R() * 4);
        for (let t = 0; t < nt; t++) {
          // lower edge points: where the joint is
          let best = poly[0];
          for (let q = 0; q < 6; q++) { const c = poly[Math.floor(R() * poly.length)]; if (c[1] > best[1] - R() * r.size * 0.3) best = c; }
          if (!mask.inside(best[0], best[1])) continue;
          const sz = lerp(28, 64, smooth(2900, 3840, best[1])) * (0.6 + 0.6 * R());
          OB.tuft(Pd, Pl, best[0] + (R() - 0.5) * 10, best[1] + 4, sz, 0.38, R, 0.32);
          if (R() < 0.3) OB.flowers(Pf, Pc, best[0], best[1] - sz * 0.25, sz * 0.13, R, 2 + Math.floor(R() * 4));
        }
      }
      for (let t = 0; t < F.top.length; t += 3) {
        const p = F.top[t];
        if (R() < 0.45) continue;
        OB.tuft(Pd, Pl, p[0], p[1] + 5, lerp(26, 60, smooth(2800, 3840, p[1])) * (0.6 + 0.7 * R()), 0.42, R, 0.35);
      }
      ctx.fillStyle = css(C.ink);
      ctx.fill(Pd);
      ctx.fillStyle = css(C.grassHi, 0.8);
      ctx.fill(Pl);
      ctx.fillStyle = css(C.flower, 0.9);
      ctx.fill(Pf);
      ctx.fillStyle = css(C.amberLine, 0.85);
      ctx.fill(Pc);
      ctx.restore();
    }
  };
})();
