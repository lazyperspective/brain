/* Giant foreground wheat: stalks, twisting leaf blades, bearded ears with individual grains. */
(function () {
  'use strict';
  const LW = window.LW, SC = LW.SC, P = LW.P;

  const LAYERS = [
    { n: 46, y0: 2990, y1: 3420, s0: 0.42, s1: 0.6, stem: '#0f1d27', leafA: '#132833', leafB: '#0f1f29', grain: '#1c2f39', grainB: '#16262f', rim: P.rust, awn: '#2b4750', awnLit: P.rust, hatch: '#0c151d', vein: '#1d3540' },
    { n: 30, y0: 2860, y1: 3520, s0: 0.68, s1: 0.9, stem: '#132733', leafA: '#1a3946', leafB: '#13293a', grain: '#7a3a26', grainB: '#552821', rim: P.orange, awn: '#3e5d63', awnLit: P.orange, hatch: '#2a1a1c', vein: '#2b5560' },
    { n: 12, y0: 2700, y1: 3420, s0: 0.95, s1: 1.45, stem: '#173340', leafA: '#21505a', leafB: '#173340', grain: P.orange, grainB: P.rust, rim: P.straw, awn: P.amber, awnLit: P.straw, hatch: '#5e2a22', vein: '#3f7a78' },
  ];

  function bez(p0, p1, p2, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
      out.push(a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]);
    }
    return out;
  }
  function bez3(p0, p1, p2, p3, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push(u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]);
    }
    return out;
  }
  function at(pts, t) {
    const n = (pts.length >> 1) - 1;
    const f = t * n, i = Math.min(n - 1, Math.floor(f)), u = f - i;
    return [pts[2 * i] + (pts[2 * i + 2] - pts[2 * i]) * u, pts[2 * i + 1] + (pts[2 * i + 3] - pts[2 * i + 1]) * u,
      Math.atan2(pts[2 * i + 3] - pts[2 * i + 1], pts[2 * i + 2] - pts[2 * i])];
  }

  function leaf(ctx, L, x, y, dir, len, wid, rng) {
    // blade arcs out, droops, twists once
    const side = dir;
    const up = rng.next() < 0.25 ? rng.range(1.0, 1.5) : rng.range(0.25, 0.9);
    const p0 = [x, y];
    const p1 = [x + side * len * 0.35, y - len * up * 0.55];
    const p2 = [x + side * len * 0.75, y - len * up * 0.45 + len * 0.05];
    const droop = rng.next() < 0.3 ? rng.range(0.4, 0.75) : rng.range(0.05, 0.4);
    const p3 = [x + side * len * rng.range(0.7, 1.05), y - len * up * 0.1 + len * droop];
    const c = bez3(p0, p1, p2, p3, 40);
    const tw = rng.range(0.45, 0.8);
    const W = (t) => wid * Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 0.7 * (1 - 0.35 * t);
    const n = c.length >> 1;
    // two halves either side of the twist
    const A = new Path2D(), B = new Path2D(), ink = new Path2D();
    const sideW = (t) => { const k = (t - tw) / 0.1; return Math.abs(k) < 1 ? Math.abs(k) : 1; };
    const left = [], right = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      let tx = c[2 * b] - c[2 * a], ty = c[2 * b + 1] - c[2 * a + 1];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const w = W(t) * sideW(t) + 0.3;
      left.push(c[2 * i] - ty * w, c[2 * i + 1] + tx * w);
      right.push(c[2 * i] + ty * w, c[2 * i + 1] - tx * w);
    }
    const ti = Math.round(tw * (n - 1));
    const poly = (from, to, path) => {
      const pts = [];
      for (let i = from; i <= to; i++) pts.push(left[2 * i], left[2 * i + 1]);
      for (let i = to; i >= from; i--) pts.push(right[2 * i], right[2 * i + 1]);
      LW.polyPath(path, pts, true);
      return pts;
    };
    const pa = poly(0, ti, A), pb = poly(ti, n - 1, B);
    LW.ribbonClosed(ink, LW.resample(pa, 4), () => 1.1 * L.sc + 0.4);
    LW.ribbonClosed(ink, LW.resample(pb, 4), () => 1.1 * L.sc + 0.4);
    ctx.fillStyle = L.leafA; LW.offset(ctx, LW.REG.cool, () => ctx.fill(A));
    ctx.fillStyle = L.leafB; LW.offset(ctx, LW.REG.cool, () => ctx.fill(B));
    // veins following the blade
    const veins = new LW.FillBatch();
    for (let v = -2; v <= 2; v++) {
      const pts = [];
      for (let i = 1; i < n - 1; i++) {
        const t = i / (n - 1);
        const s = (v / 2.6) * sideW(t) * (t < tw ? 1 : -1);
        pts.push(c[2 * i] + (left[2 * i] - c[2 * i]) * s, c[2 * i + 1] + (left[2 * i + 1] - c[2 * i + 1]) * s);
      }
      LW.dashes(pts, rng, 30, 160, 4, 14, (sub) => LW.ribbon(veins.p(v === 0 ? L.vein : L.layer === 0 ? '#16303b' : P.deep), sub, (t) => (v === 0 ? 0.9 : 0.55) * L.sc * LW.taper(t, 0.2, 0.2)));
    }
    veins.flush(ctx);
    ctx.fillStyle = P.ink; ctx.fill(ink);
    // light catching the upper edge before the twist
    if (L.layer > 0) {
      const rim = [];
      for (let i = 2; i < ti - 1; i++) {
        const lx = left[2 * i], ly = left[2 * i + 1], rx = right[2 * i], ry = right[2 * i + 1];
        const topIsLeft = ly < ry;
        const ex = topIsLeft ? lx : rx, ey = topIsLeft ? ly : ry;
        const cx = c[2 * i], cy = c[2 * i + 1];
        rim.push(ex + (cx - ex) * 0.25, ey + (cy - ey) * 0.25);
      }
      if (rim.length > 6) {
        const rp = new Path2D();
        LW.ribbon(rp, rim, (t) => 1.3 * L.sc * LW.taper(t, 0.25, 0.3));
        ctx.fillStyle = L.layer === 2 ? P.amber : P.orange; ctx.fill(rp);
      }
    }
  }

  function ear(ctx, L, x, y, ang, len, nod, rng) {
    // rachis: starts along the stem direction and bends by `nod`
    const rach = [];
    let a = ang, px = x, py = y;
    const N = 30;
    rach.push(px, py);
    for (let i = 0; i < N; i++) { a += nod / N; px += Math.cos(a) * (len / N); py += Math.sin(a) * (len / N); rach.push(px, py); }
    const n = Math.round(rng.range(15, 19));
    const grains = [];
    for (let i = 0; i < n; i++) {
      const s = 0.04 + (0.94 * (i + 0.5)) / n;
      const [cx, cy, ra] = at(rach, s);
      const side = i % 2 ? 1 : -1;
      const taper = 1 - 0.45 * Math.pow(s, 2.2) - 0.15 * Math.pow(1 - s, 3);
      const gl = (len / n) * 2.75 * taper, gw = len * 0.13 * taper;
      const ga = ra + side * 0.55;
      const ox = cx + Math.cos(ra + side * Math.PI / 2) * gw * 0.3, oy = cy + Math.sin(ra + side * Math.PI / 2) * gw * 0.3;
      grains.push({ ox, oy, ga, gl, gw, side, s, ra });
    }
    // awns first (behind grains)
    const awns = new LW.FillBatch();
    for (const g of grains) {
      const tipx = g.ox + Math.cos(g.ga) * g.gl * 0.68, tipy = g.oy + Math.sin(g.ga) * g.gl * 0.68;
      const al = len * rng.range(0.75, 1.5) * (0.6 + 0.4 * g.s);
      const aa = g.ga + g.side * rng.range(0.02, 0.22) - nod * 0.15;
      const bend = rng.range(-0.25, 0.25) + nod * 0.2;
      const pts = [];
      for (let k = 0; k <= 10; k++) {
        const t = k / 10;
        const an = aa + bend * t * t;
        pts.push(tipx + Math.cos(an) * al * t, tipy + Math.sin(an) * al * t);
      }
      const lit = Math.sin(aa) < -0.2 || rng.next() < 0.3;
      LW.ribbon(awns.p(lit ? L.awnLit : L.awn), pts, (t) => (1.1 * L.sc + 0.25) * (1 - 0.85 * t));
    }
    awns.flush(ctx);
    // grains: ink union, fill, crease, shadow hatching, rim
    const ink = new Path2D(), fA = new Path2D(), fB = new Path2D();
    const hatch = new LW.FillBatch();
    const shapes = [];
    for (const g of grains) {
      const dx = Math.cos(g.ga), dy = Math.sin(g.ga), nx = -dy, ny = dx;
      const pts = [];
      const K = 10;
      for (let k = 0; k <= K; k++) { const t = k / K; const w = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.7)), 0.9) * g.gw * 0.5; pts.push(g.ox + dx * g.gl * (t - 0.3) + nx * w, g.oy + dy * g.gl * (t - 0.3) + ny * w); }
      for (let k = K - 1; k > 0; k--) { const t = k / K; const w = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.7)), 0.9) * g.gw * 0.5; pts.push(g.ox + dx * g.gl * (t - 0.3) - nx * w, g.oy + dy * g.gl * (t - 0.3) - ny * w); }
      shapes.push({ g, pts, dx, dy, nx, ny });
      LW.polyPath(ink, pts, true);
      LW.polyPath(g.side > 0 ? fA : fB, pts, true);
    }
    ctx.strokeStyle = P.ink; ctx.lineWidth = 2.2 * L.sc + 0.6; ctx.lineJoin = 'round';
    ctx.stroke(ink);
    LW.offset(ctx, LW.REG.warm, () => { ctx.fillStyle = L.grain; ctx.fill(fA); ctx.fillStyle = L.grainB; ctx.fill(fB); });
    const rims = new Path2D();
    for (const sh of shapes) {
      const { g, dx, dy, nx, ny } = sh;
      // which flank faces up (toward the sky glow)?
      const upSide = ny < 0 ? 1 : -1;
      // crease
      LW.ribbon(hatch.p(L.hatch), [g.ox - dx * g.gl * 0.3, g.oy - dy * g.gl * 0.3, g.ox + dx * g.gl * 0.4, g.oy + dy * g.gl * 0.4], (t) => 0.55 * L.sc * LW.taper(t, 0.3, 0.3));
      // shadow-flank hatching
      for (let k = 0; k < 4; k++) {
        const t = -0.12 + k * 0.17;
        const bx = g.ox + dx * g.gl * t, by = g.oy + dy * g.gl * t;
        const w = g.gw * 0.42;
        LW.ribbon(hatch.p(L.hatch), [bx - nx * upSide * w * 0.15, by - ny * upSide * w * 0.15, bx - nx * upSide * w * 0.9 + dx * 2, by - ny * upSide * w * 0.9 + dy * 2], (tt) => 0.45 * L.sc * LW.taper(tt, 0.2, 0.3));
      }
      // rim on the lit flank
      const rp = [];
      for (let k = 1; k < 9; k++) {
        const t = k / 10;
        const w = Math.pow(Math.sin(Math.PI * t), 0.75) * g.gw * 0.5 * 0.62;
        rp.push(g.ox + dx * g.gl * (t - 0.3) + nx * upSide * w, g.oy + dy * g.gl * (t - 0.3) + ny * upSide * w);
      }
      LW.ribbon(rims, rp, (t) => 0.9 * L.sc * LW.taper(t, 0.3, 0.3) + 0.15);
    }
    hatch.flush(ctx);
    ctx.fillStyle = L.rim; ctx.fill(rims);
    // a few glumes catching light at the very tip
    const tip = at(rach, 1);
    const tp = new Path2D();
    LW.ribbon(tp, [tip[0], tip[1], tip[0] + Math.cos(tip[2]) * len * 0.12, tip[1] + Math.sin(tip[2]) * len * 0.12], (t) => 1.6 * L.sc * (1 - t));
    ctx.fillStyle = P.ink; ctx.fill(tp);
  }

  function stem(ctx, L, pts, rng) {
    const ink = new Path2D(), fl = new Path2D(), hl = new Path2D();
    const hw = (t) => (5.2 - 2.4 * t) * L.sc;
    LW.ribbon(ink, pts, (t) => hw(t) + 1.3 * L.sc + 0.5);
    LW.ribbon(fl, pts, hw);
    ctx.fillStyle = P.ink; ctx.fill(ink);
    ctx.fillStyle = L.stem; LW.offset(ctx, LW.REG.cool, () => ctx.fill(fl));
    // highlight line down the sky-facing side
    const n = pts.length >> 1, side = [];
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      let tx = pts[2 * b] - pts[2 * a], ty = pts[2 * b + 1] - pts[2 * a + 1];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const t = i / (n - 1);
      const sgn = SC.sun.x < pts[2 * i] ? 1 : -1;
      side.push(pts[2 * i] + ty * hw(t) * 0.45 * sgn, pts[2 * i + 1] - tx * hw(t) * 0.45 * sgn);
    }
    LW.dashes(side, rng, 60, 240, 10, 60, (sub) => LW.ribbon(hl, sub, (t, i, x, y) => 0.9 * L.sc * LW.taper(t, 0.2, 0.2) * LW.smooth(3900, 3000, y)));
    ctx.fillStyle = L.layer === 2 ? P.sea : L.layer === 1 ? P.teal : '#1d3944'; ctx.fill(hl);
    // nodes
    for (const t of [0.35, 0.62]) {
      const [x, y, a] = at(pts, t);
      const w = hw(t) + 1;
      const np = new Path2D();
      LW.ribbon(np, [x - Math.sin(a) * w, y + Math.cos(a) * w, x + Math.sin(a) * w, y - Math.cos(a) * w], () => 1.4 * L.sc);
      ctx.fillStyle = P.ink; ctx.fill(np);
    }
  }

  LW.drawForeground = function (ctx) {
    const rng = new LW.RNG('foreground');
    const pathX = (y) => 1150 + (y - 3840) * 0.2;
    for (let li = 0; li < LAYERS.length; li++) {
      const L = Object.assign({ layer: li }, LAYERS[li]);
      const plants = [];
      for (let i = 0; i < L.n; i++) {
        let ex;
        // keep the path open: spread plants to the flanks, thinner in the middle
        for (let k = 0; k < 20; k++) {
          ex = rng.range(-120, SC.W + 120);
          const pc = pathX(3500);
          const d = Math.abs(ex - pc);
          if (d > 360 || rng.next() < (li === 2 ? 0.02 : 0.12) * (d / 360)) break;
        }
        const ey = rng.range(L.y0, L.y1) + (li === 2 ? Math.abs(ex - 1080) * -0.1 : 0) + (rng.next() < 0.25 ? rng.range(80, 260) : 0);
        plants.push({ ex, ey, sc: rng.range(L.s0, L.s1) });
      }
      if (li === 2) {
        // two big ears close to the lens, cropped by the frame edges
        plants.push({ ex: 70, ey: 2640, sc: 1.85 });
        plants.push({ ex: 2085, ey: 2760, sc: 1.7 });
      }
      plants.sort((a, b) => a.ey - b.ey);
      for (const p of plants) {
        L.sc = p.sc;
        const bx = p.ex + rng.range(-160, 160) * p.sc - (p.ex - 1080) * 0.05;
        const by = SC.H + 60;
        const lean = (p.ex - bx) / (by - p.ey);
        const midx = bx + (p.ex - bx) * 0.5 + rng.range(-40, 40) * p.sc, midy = (by + p.ey) / 2;
        const sp = bez([bx, by], [midx, midy], [p.ex, p.ey], 36);
        // leaves from the lower nodes
        const nl = rng.int(2, 3);
        for (let k = 0; k < nl; k++) {
          const t = rng.range(0.4, 0.88);
          const [x, y] = at(sp, 1 - t);
          leaf(ctx, L, x, y, rng.sign(), rng.range(200, 440) * p.sc, rng.range(8, 13.5) * p.sc, rng);
        }
        stem(ctx, L, sp, rng);
        const [, , aTop] = at(sp, 1);
        const ang = Math.atan2(p.ey - sp[sp.length - 3], p.ex - sp[sp.length - 4]);
        void aTop;
        const len = rng.range(150, 230) * p.sc;
        const nod = (rng.next() < 0.3 ? rng.range(0.6, 1.3) : rng.range(0.05, 0.4)) * (lean > 0 ? 1 : -1) * (rng.next() < 0.2 ? -1 : 1);
        ear(ctx, L, p.ex, p.ey, ang, len, nod, rng);
      }
    }
  };
})();
