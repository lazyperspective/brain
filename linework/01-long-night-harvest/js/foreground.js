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

  // ---------------------------------------------------------------- leaf blades with varied gestures
  // turtle-walk a centreline; kind sets the curvature profile, creases and the end
  function bladeLine(x, y, side, len, kind, rng) {
    const N = 48, ds = len / N;
    let a, k0, crease = -1, creaseTurn = 0, curlFrom = 2, curlK = 0, sK = 0;
    switch (kind) {
      case 'upright': a = -Math.PI / 2 + side * rng.range(0.05, 0.25); k0 = side * rng.range(0.1, 0.5); crease = rng.range(0.55, 0.75); creaseTurn = side * rng.range(1.6, 2.4); break;
      case 'fold': a = -Math.PI / 2 + side * rng.range(0.5, 0.9); k0 = side * rng.range(0.2, 0.6); crease = rng.range(0.35, 0.55); creaseTurn = side * rng.range(1.3, 1.9); break;
      case 'curl': a = -Math.PI / 2 + side * rng.range(0.3, 0.7); k0 = side * rng.range(1.2, 1.9); curlFrom = rng.range(0.62, 0.75); curlK = side * rng.range(9, 14); break;
      case 'edge': a = -Math.PI / 2 + side * rng.range(0.2, 0.6); k0 = side * rng.range(0.3, 0.8); sK = side * rng.range(1.5, 2.6); break;
      case 'broken': a = -Math.PI / 2 + side * rng.range(0.4, 1.0); k0 = side * rng.range(1.0, 2.2); break;
      default: a = -Math.PI / 2 + side * rng.range(0.3, 0.9); k0 = side * rng.range(1.6, 2.8);
    }
    const pts = [x, y];
    let px = x, py = y, creaseIdx = -1;
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      let k = k0 + sK * Math.sin(t * Math.PI * 2);
      if (t > curlFrom) k += curlK * Math.pow((t - curlFrom) / (1 - curlFrom), 1.5);
      a += k * (1 / N);
      if (crease > 0 && creaseIdx < 0 && t >= crease) { a += creaseTurn; creaseIdx = i; }
      // gravity: long free blades sag
      a += side * 0.004 * (Math.cos(a) * side > 0 ? 1 : 0);
      px += Math.cos(a) * ds; py += Math.sin(a) * ds;
      pts.push(px, py);
    }
    return { pts, creaseIdx };
  }

  function blade(ctx, L, x, y, side, len, wid, kind, rng, out) {
    const { pts: c, creaseIdx } = bladeLine(x, y, side, len, kind, rng);
    const n = c.length >> 1;
    const broken = kind === 'broken';
    if (kind === 'edge') wid *= 0.38;
    if (kind === 'curl') wid *= 0.9;
    const W = (t) => broken ? wid * Math.pow(Math.min(1, t * 5), 0.5) * (1 - 0.3 * t) : wid * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08 + 0.02)), 0.6) * (1 - 0.35 * t);
    // twist positions: width pinches to zero and the underside shows
    const twists = [];
    if (creaseIdx > 0) twists.push(creaseIdx / (n - 1));
    else if (kind !== 'edge' && rng.next() < 0.65) twists.push(rng.range(0.4, 0.8));
    const pinch = (t) => { let m = 1; for (const tw of twists) { const k = Math.abs(t - tw) / 0.07; if (k < 1) m = Math.min(m, creaseIdx > 0 ? 0.35 + 0.65 * k : k); } return m; };
    const left = [], right = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      let tx = c[2 * b] - c[2 * a], ty = c[2 * b + 1] - c[2 * a + 1];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const w = W(t) * pinch(t) + 0.35;
      left.push(c[2 * i] - ty * w, c[2 * i + 1] + tx * w);
      right.push(c[2 * i] + ty * w, c[2 * i + 1] - tx * w);
    }
    if (broken) {
      // ragged torn end
      const i = n - 1, lx = left[2 * i], ly = left[2 * i + 1], rx = right[2 * i], ry = right[2 * i + 1];
      const tx = c[2 * i] - c[2 * i - 2], ty = c[2 * i + 1] - c[2 * i - 1], l = Math.hypot(tx, ty) || 1;
      const jag = [];
      for (let k = 1; k < 5; k++) { const u = k / 5; const d = (k % 2 ? 1 : -0.4) * wid * rng.range(0.4, 0.9); jag.push(lx + (rx - lx) * u + (tx / l) * d, ly + (ry - ly) * u + (ty / l) * d); }
      out = out || {};
      out.jag = jag;
    }
    const segs = [0].concat(twists.map((t) => Math.round(t * (n - 1)))).concat([n - 1]);
    const ink = new Path2D();
    const dead = broken || (kind === 'curl' && rng.next() < 0.3);
    for (let sI = 0; sI < segs.length - 1; sI++) {
      const from = segs[sI], to = segs[sI + 1];
      const poly = [];
      for (let i = from; i <= to; i++) poly.push(left[2 * i], left[2 * i + 1]);
      if (broken && sI === segs.length - 2 && out && out.jag) for (let q = out.jag.length - 2; q >= 0; q -= 2) poly.push(out.jag[q], out.jag[q + 1]);
      for (let i = to; i >= from; i--) poly.push(right[2 * i], right[2 * i + 1]);
      const path = new Path2D(); LW.polyPath(path, poly, true);
      const under = sI % 2 === 1;
      let col = under ? L.leafB : L.leafA;
      if (dead && sI === segs.length - 2) col = L.layer === 2 ? '#7a3a26' : '#4a2620';
      ctx.fillStyle = col; LW.offset(ctx, LW.REG.cool, () => ctx.fill(path));
      ctx.fill(path);
      LW.ribbonClosed(ink, LW.resample(poly, 3.5), (t, i, x2, y2) => (1.05 * L.sc + 0.35) * (0.85 + 0.3 * LW.N2(x2 * 0.04, y2 * 0.04)));
      // engraved veins in this segment; the underside gets denser hatching (shadow)
      const veins = new LW.FillBatch();
      const nv = under ? 4 : 2;
      for (let v = -nv; v <= nv; v++) {
        const vp = [];
        for (let i = Math.max(1, from); i <= Math.min(n - 2, to); i++) {
          const t = i / (n - 1);
          const sv = (v / (nv + 0.8)) * pinch(t);
          vp.push(c[2 * i] + (left[2 * i] - c[2 * i]) * sv, c[2 * i + 1] + (left[2 * i + 1] - c[2 * i + 1]) * sv);
        }
        if (vp.length < 4) continue;
        LW.dashes(vp, rng, 30, 200, 4, 16, (sub) => LW.ribbon(veins.p(v === 0 ? (under ? '#0e1b23' : L.vein) : under ? '#0f1d26' : (L.layer === 0 ? '#16303b' : P.deep)), sub, (t) => (v === 0 ? 0.95 : 0.55) * L.sc * LW.taper(t, 0.2, 0.2) + 0.15));
      }
      veins.flush(ctx);
      {
        // fine dry striations between the veins and stipple drifting toward the shadowed edge
        const trng = new LW.RNG('blade-tex' + Math.round(x) + '_' + Math.round(y) + '_' + sI);
        const st = new LW.FillBatch();
        const dk = under ? '#09131a' : L.layer === 0 ? '#0b161e' : '#0d1a22';
        const ns = under ? 9 : 7;
        for (let v = -ns; v <= ns; v++) {
          if (v === 0) continue;
          const base = v / (ns + 0.6) + trng.range(-0.03, 0.03);
          const vp = [];
          for (let i = Math.max(1, from); i <= Math.min(n - 2, to); i++) {
            const t = i / (n - 1);
            const sv = base * pinch(t);
            vp.push(c[2 * i] + (left[2 * i] - c[2 * i]) * sv, c[2 * i + 1] + (left[2 * i + 1] - c[2 * i + 1]) * sv);
          }
          if (vp.length < 4) continue;
          LW.dashes(vp, trng, 8, 70, 3, 22, (sub) => LW.ribbon(st.p(dk), sub, (t) => (0.3 * L.sc + 0.12) * LW.taper(t, 0.3, 0.3)));
        }
        const area = (to - from) * wid * 0.8;
        for (let k = 0; k < area * 0.5; k++) {
          const i = Math.floor(trng.range(Math.max(1, from), Math.min(n - 2, to)));
          const t = i / (n - 1);
          const sv = (under ? trng.range(-1, 1) : -Math.pow(trng.next(), 0.6)) * 0.92 * pinch(t);
          const px = c[2 * i] + (left[2 * i] - c[2 * i]) * sv, py = c[2 * i + 1] + (left[2 * i + 1] - c[2 * i + 1]) * sv;
          LW.dot(st.p(dk), px, py, trng.range(0.35, 0.5 + 0.45 * L.sc));
        }
        st.flush(ctx);
      }
      // rim light on the upper edge of top-surface segments
      if (!under && L.layer > 0 && !(dead && sI === segs.length - 2)) {
        const rim = [];
        for (let i = from + 1; i < to; i++) {
          const lx = left[2 * i], ly = left[2 * i + 1], rx = right[2 * i], ry = right[2 * i + 1];
          const top = ly < ry;
          const ex = top ? lx : rx, ey = top ? ly : ry;
          rim.push(ex + (c[2 * i] - ex) * 0.28, ey + (c[2 * i + 1] - ey) * 0.28);
        }
        if (rim.length > 6) {
          const rp = new Path2D();
          LW.ribbon(rp, rim, (t) => 1.25 * L.sc * LW.taper(t, 0.25, 0.3));
          ctx.fillStyle = L.layer === 2 ? P.amber : P.orange; ctx.fill(rp);
        }
      }
    }
    // crease line
    if (creaseIdx > 0) {
      const i = creaseIdx;
      LW.ribbon(ink, [left[2 * i], left[2 * i + 1], right[2 * i], right[2 * i + 1]], () => 1.1 * L.sc + 0.4);
    }
    ctx.fillStyle = P.ink; ctx.fill(ink);
    return { left, right, c, n };
  }

  // a bead of dew: dark lower crescent, bright upper glint
  function dew(fb, x, y, r, big) {
    LW.polyPath(fb.p(P.ink), LW.scallop(x, y, r + 1.2, new LW.RNG(x * 7 + y), { bumps: 8, depth: 0.02, per: 3 }), true);
    fb.p('#2d5a63').moveTo(x + r, y); fb.p('#2d5a63').arc(x, y, r, 0, 6.2832);
    const q = fb.p(P.straw); q.moveTo(x + r * 0.7, y + r * 0.2); q.arc(x, y + r * 0.2, r * 0.7, 0.1, Math.PI - 0.1); 
    const g = fb.p('#fff6dc'); g.moveTo(x - r * 0.3 + r * 0.3, y - r * 0.35); g.arc(x - r * 0.3, y - r * 0.35, r * 0.3, 0, 6.2832);
    if (big) {
      for (const [dx, dy, L] of [[1, 0, 4.5], [-1, 0, 4.5], [0, 1, 3], [0, -1, 3]]) LW.ribbon(fb.p('#fff6dc'), [x - r * 0.3, y - r * 0.35, x - r * 0.3 + dx * r * L, y - r * 0.35 + dy * r * L], (t) => 0.9 * (1 - t));
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

  // ---------------------------------------------------------------- heroes
  // engraved contour hatching inside a closed shape: rings shrinking toward a light point
  function hatchInside(ctx, pts, cx, cy, lx, ly, col, gap, w, rng) {
    const path = new Path2D(); LW.polyPath(path, pts, true);
    ctx.save(); ctx.clip(path);
    const fb = new LW.FillBatch();
    for (let k = 1; k < 30; k++) {
      const sc = 1 - k * gap;
      if (sc < 0.08) break;
      const ring = [];
      for (let i = 0; i < pts.length; i += 2) {
        // shrink toward the light point, so lines bunch up on the shadow side
        ring.push(lx + (pts[i] - lx) * sc + (cx - lx) * 0 , ly + (pts[i + 1] - ly) * sc);
      }
      LW.dashes(ring.concat(ring.slice(0, 2)), rng, 20, 120, 2, 9, (sub) => LW.ribbon(fb.p(col), sub, (t) => w * (0.5 + 0.5 * (1 - sc)) * LW.taper(t, 0.2, 0.2)));
    }
    fb.flush(ctx);
    ctx.restore();
  }

  function poppy(ctx, x, y, r, tilt, rng) {
    const RED = '#c4402a', DEEP = '#7e2620', LIT = '#e8763a';
    // four cupped petals: two back, two front
    const petals = [];
    const angs = [-2.4, -0.75, 2.3, 0.85];
    for (let k = 0; k < 4; k++) {
      const a = angs[k] + tilt + rng.range(-0.15, 0.15);
      const back = k < 2;
      const pr = r * (back ? rng.range(0.95, 1.08) : rng.range(0.85, 0.98));
      const pts = [];
      const N = 34;
      for (let i = 0; i <= N; i++) {
        const u = i / N;                          // around the petal
        const th = a + (u - 0.5) * 2.3;
        const rad = pr * (0.25 + 0.75 * Math.pow(Math.sin(Math.PI * u), 0.45)) * (1 + 0.06 * Math.sin(u * 23 + k));
        pts.push(x + Math.cos(th) * rad, y + Math.sin(th) * rad * 0.72 - (back ? r * 0.12 : -r * 0.05));
      }
      pts.push(x, y + r * 0.08);
      petals.push({ pts, back, a });
    }
    for (const pt of petals) {
      const path = new Path2D(); LW.polyPath(path, pt.pts, true);
      ctx.fillStyle = pt.back ? DEEP : RED;
      LW.offset(ctx, LW.REG.warm, () => ctx.fill(path));
      ctx.fill(path);
      // radiating veins from the base; dense near the centre (shadow), sparse at the lit rim
      const fb = new LW.FillBatch();
      ctx.save(); ctx.clip(path);
      for (let i = 0; i < 26; i++) {
        const th = pt.a + (i / 25 - 0.5) * 2.2;
        const L = r * rng.range(0.55, 1.05);
        const pts = [];
        for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push(x + Math.cos(th + 0.12 * Math.sin(t * 3)) * L * t, y + Math.sin(th) * L * t * 0.72); }
        LW.ribbon(fb.p(pt.back ? '#4a1a1a' : DEEP), pts, (t) => (1 - t) * 1.6 + 0.2);
      }
      fb.flush(ctx);
      ctx.restore();
      // lit rim on the upper edge
      const rim = [];
      for (let i = 2; i < pt.pts.length - 4; i += 2) if (pt.pts[i + 1] < y) rim.push(pt.pts[i] + (x - pt.pts[i]) * 0.05, pt.pts[i + 1] + (y - pt.pts[i + 1]) * 0.07);
      if (rim.length > 6 && !pt.back) { const rp = new Path2D(); LW.ribbon(rp, rim, (t) => 2.2 * LW.taper(t, 0.2, 0.2)); ctx.fillStyle = LIT; ctx.fill(rp); }
      const ink = new Path2D(); LW.ribbonClosed(ink, LW.resample(pt.pts, 3), (t, i, x2, y2) => 1.6 * (0.8 + 0.4 * LW.N2(x2 * 0.05, y2 * 0.05)));
      ctx.fillStyle = P.ink; ctx.fill(ink);
    }
    // seed head and ring of stamens
    const fb = new LW.FillBatch();
    for (let i = 0; i < 46; i++) {
      const th = (i / 46) * 6.283;
      const rr = r * rng.range(0.2, 0.3);
      const px = x + Math.cos(th) * rr, py = y - r * 0.02 + Math.sin(th) * rr * 0.7;
      LW.ribbon(fb.p(P.ink), [x + Math.cos(th) * r * 0.1, y + Math.sin(th) * r * 0.07, px, py], () => 0.8);
      const q = fb.p(i % 3 ? P.ink : '#2a1a1c'); q.moveTo(px + 2.4, py); q.arc(px, py, 2.4, 0, 6.2832);
    }
    const cap = LW.scallop(x, y - r * 0.03, r * 0.13, rng, { bumps: 8, depth: 0.1, per: 4, squash: 0.75 });
    LW.polyPath(fb.p('#2c5f66'), cap, true);
    fb.flush(ctx, [P.ink, '#2a1a1c', '#2c5f66']);
    for (let i = 0; i < 8; i++) {
      const th = (i / 8) * 6.283;
      const rp = new Path2D(); LW.ribbon(rp, [x, y - r * 0.03, x + Math.cos(th) * r * 0.12, y - r * 0.03 + Math.sin(th) * r * 0.085], () => 0.9);
      ctx.fillStyle = P.pale; ctx.fill(rp);
    }
  }

  function poppyBud(ctx, x, y, r, a, rng) {
    const pts = [];
    for (let i = 0; i < 40; i++) {
      const u = (i / 40) * 6.283;
      const rad = r * (1 + 0.35 * Math.cos(u)) * (u > 2.6 && u < 3.7 ? 0.9 : 1);
      pts.push(x + Math.cos(u + a) * rad * 0.62, y + Math.sin(u + a) * rad);
    }
    const path = new Path2D(); LW.polyPath(path, pts, true);
    ctx.fillStyle = '#21505a'; ctx.fill(path);
    hatchInside(ctx, pts, x, y, x - r * 0.4, y - r * 0.5, '#122833', 0.12, 0.9, rng);
    // a slit of red showing through the opening sepals
    const sl = new Path2D(); LW.ribbon(sl, [x - r * 0.1, y + r * 0.9, x + r * 0.05, y, x - r * 0.02, y - r * 0.85], (t) => 2.4 * Math.sin(Math.PI * t));
    ctx.fillStyle = '#c4402a'; ctx.fill(sl);
    const ink = new Path2D(); LW.ribbonClosed(ink, pts, () => 1.5);
    ctx.fillStyle = P.ink; ctx.fill(ink);
    // hairs
    const fb = new LW.FillBatch();
    for (let i = 0; i < pts.length; i += 4) { const dx = pts[i] - x, dy = pts[i + 1] - y, l = Math.hypot(dx, dy); LW.ribbon(fb.p(P.sea), [pts[i], pts[i + 1], pts[i] + (dx / l) * 6, pts[i + 1] + (dy / l) * 6], (t) => 0.5 * (1 - t)); }
    fb.flush(ctx);
  }

  function cornflower(ctx, x, y, r, rng) {
    const BLUE = '#3f7f9a', LITE = '#8fc1c8', DEEPB = '#1f4a63';
    const fb = new LW.FillBatch();
    const n = 10;
    // ray florets: little trumpets with toothed mouths
    for (let k = 0; k < n; k++) {
      const th = (k / n) * 6.283 + rng.range(-0.1, 0.1);
      const L = r * rng.range(0.85, 1.05);
      const cx2 = x + Math.cos(th) * L, cy2 = y + Math.sin(th) * L * 0.75;
      const nx = -Math.sin(th), ny = Math.cos(th) * 0.75;
      const mw = r * 0.32;
      const pts = [x + nx * 3, y + ny * 3];
      for (let tth = 0; tth <= 5; tth++) {
        const u = tth / 5 - 0.5;
        const tooth = tth % 2 ? 0.82 : 1;
        pts.push(x + (cx2 - x) * tooth + nx * mw * u * 2, y + (cy2 - y) * tooth + ny * mw * u * 2);
      }
      pts.push(x - nx * 3, y - ny * 3);
      const up = Math.sin(th) < 0;
      LW.polyPath(fb.p(up ? LITE : k % 2 ? BLUE : DEEPB), pts, true);
      LW.ribbon(fb.p(DEEPB), [x, y, (cx2 + x) / 2 + nx * 2, (cy2 + y) / 2 + ny * 2], () => 0.7);
      LW.ribbonClosed(fb.p(P.ink), pts, () => 1.0);
    }
    fb.flush(ctx, [DEEPB, BLUE, LITE, P.ink]);
    const c = new LW.FillBatch();
    for (let i = 0; i < 18; i++) { const th = rng.range(0, 6.28), rr = rng.range(0, r * 0.28); const q = c.p(i % 2 ? '#2a1a3a' : P.ink); q.moveTo(x + Math.cos(th) * rr + 2, y + Math.sin(th) * rr); q.arc(x + Math.cos(th) * rr, y + Math.sin(th) * rr, 2, 0, 6.283); }
    c.flush(ctx);
  }

  // harvest mouse clinging to a stalk, looking up at the ear
  function mouse(ctx, sx, sy, sc, rng) {
    const s = sc;
    const FUR = '#9c4529', FURD = '#5e2a22', BELLY = '#f0d49a';
    // body: a bean shape hugging the stalk, head up-left
    const body = [];
    for (let i = 0; i < 60; i++) {
      const u = (i / 60) * 6.283;
      const rx = 30 * s, ry = 48 * s;
      const bump = 1 + 0.12 * Math.cos(u * 2 + 0.6) + (Math.sin(u) < 0 ? -0.08 * Math.sin(u) : 0);
      let px = Math.cos(u) * rx * bump, py = Math.sin(u) * ry * bump;
      const rot = -0.35;
      body.push(sx + 9 * s + px * Math.cos(rot) - py * Math.sin(rot), sy + px * Math.sin(rot) + py * Math.cos(rot));
    }
    // head: a teardrop pointing up-left, attached to the top of the body
    const hx = sx - 6 * s, hy = sy - 52 * s;
    const head = [];
    for (let i = 0; i < 50; i++) {
      const u = (i / 50) * 6.283;
      const r0 = 22 * s * (1 + 0.55 * Math.pow(Math.max(0, Math.cos(u - 3.75)), 3));
      head.push(hx + Math.cos(u) * r0, hy + Math.sin(u) * r0 * 0.85);
    }
    // tail: prehensile, wraps the stalk twice below the body
    const tail = [];
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const wrap = Math.sin(t * Math.PI * 4.2) * 15 * s;
      tail.push(sx + 4 * s + wrap - t * 10 * s, sy + 40 * s + t * 150 * s);
    }
    // tail behind stalk segments first
    const tb = new Path2D(), tf = new Path2D();
    for (let i = 0; i < 80; i++) {
      const t = i / 80;
      const front = Math.cos(t * Math.PI * 4.2) > 0;
      LW.ribbon(front ? tf : tb, [tail[2 * i], tail[2 * i + 1], tail[2 * i + 2], tail[2 * i + 3]], () => 3.4 * s * (1 - 0.6 * t) + 0.5);
    }
    ctx.fillStyle = FURD; ctx.fill(tb);
    LW.mouseStalk && LW.mouseStalk();
    const bp = new Path2D(); LW.polyPath(bp, body, true);
    const hp = new Path2D(); LW.polyPath(hp, head, true);
    ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = 3.2 * s + 1;
    ctx.stroke(bp); ctx.stroke(hp);
    ctx.fillStyle = FUR; LW.offset(ctx, LW.REG.warm, () => { ctx.fill(bp); ctx.fill(hp); });
    ctx.fill(bp); ctx.fill(hp);
    // belly
    const belly = [];
    for (let i = 0; i < 30; i++) { const u = -1.2 + (i / 29) * 2.6; belly.push(sx + 9 * s - 28 * s * Math.cos(u) * 0.55 - 10 * s, sy + Math.sin(u) * 40 * s); }
    const bl = new Path2D(); LW.ribbon(bl, belly, (t) => 7 * s * Math.sin(Math.PI * t));
    ctx.save(); ctx.clip(bp); ctx.fillStyle = BELLY; ctx.fill(bl); ctx.restore();
    // fur: short strokes following the body form, dense in shadow (right/bottom), sparse on the lit back
    const fb = new LW.FillBatch();
    const furStrokes = (cx, cy, rx, ry, rot, nS, clip) => {
      ctx.save(); ctx.clip(clip);
      for (let i = 0; i < nS; i++) {
        const u = rng.range(0, 6.283), d = Math.sqrt(rng.next());
        const px = Math.cos(u) * rx * d, py = Math.sin(u) * ry * d;
        const X = cx + px * Math.cos(rot) - py * Math.sin(rot), Y = cy + px * Math.sin(rot) + py * Math.cos(rot);
        const lit = -Math.cos(u) * 0.7 - Math.sin(u) * 0.5;
        if (lit > 0.45 && rng.next() < 0.7) continue;
        const ang = rot + Math.PI / 2 + 0.6 * Math.cos(u) + rng.range(-0.2, 0.2);
        const L = rng.range(5, 10) * s;
        LW.ribbon(fb.p(lit > 0.2 ? '#d07a3a' : lit > -0.3 ? FURD : '#2a1a1c'), [X, Y, X + Math.cos(ang) * L, Y + Math.sin(ang) * L], (t) => 0.9 * s * (1 - t) + 0.2);
      }
      fb.flush(ctx);
      ctx.restore();
    };
    furStrokes(sx + 9 * s, sy, 30 * s, 48 * s, -0.35, 520, bp);
    furStrokes(hx, hy, 22 * s, 20 * s, -0.8, 220, hp);
    // rim light on the back and crown (sun is to the left, low)
    const rim = new Path2D();
    const rb = [];
    for (let i = 0; i < body.length; i += 2) { const dx = body[i] - (sx + 9 * s); if (dx < -10 * s && body[i + 1] > sy - 40 * s) rb.push(body[i] + 2.5 * s, body[i + 1]); }
    if (rb.length > 6) LW.ribbon(rim, rb, (t) => 2.4 * s * LW.taper(t, 0.2, 0.2));
    const rh = [];
    for (let i = 0; i < head.length; i += 2) { if (head[i + 1] < hy - 4 * s && head[i] < hx + 8 * s) rh.push(head[i] + 1.5 * s, head[i + 1] + 2 * s); }
    if (rh.length > 6) LW.ribbon(rim, rh, (t) => 2.2 * s * LW.taper(t, 0.2, 0.2));
    ctx.fillStyle = P.straw; ctx.fill(rim);
    // ear
    const ex = hx + 8 * s, ey = hy - 16 * s;
    const ear = LW.scallop(ex, ey, 11 * s, rng, { bumps: 6, depth: 0.05, per: 5 });
    const ep = new Path2D(); LW.polyPath(ep, ear, true);
    ctx.fillStyle = FURD; ctx.fill(ep);
    ctx.fillStyle = '#d4652b'; ctx.beginPath(); ctx.ellipse(ex - 1.5 * s, ey + 1 * s, 6 * s, 7 * s, 0.3, 0, 6.283); ctx.fill();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 2.4 * s + 0.6; ctx.stroke(ep);
    // eye with a catch-light toward the farmhouse
    const eyx = hx - 6 * s, eyy = hy - 4 * s;
    ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(eyx, eyy, 5.2 * s, 5.8 * s, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#fff6dc'; ctx.beginPath(); ctx.arc(eyx - 1.8 * s, eyy - 2 * s, 1.7 * s, 0, 6.283); ctx.fill();
    // nose and whiskers
    const nx = hx - 34 * s, ny = hy + 6 * s;
    ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(nx, ny, 3 * s, 0, 6.283); ctx.fill();
    const wb = new LW.FillBatch();
    for (let k = 0; k < 5; k++) {
      const a = Math.PI + rng.range(-0.55, 0.45);
      const L = rng.range(26, 44) * s;
      LW.ribbon(wb.p(k % 2 ? P.pale : P.mist), [nx + 4 * s, ny, nx + Math.cos(a) * L * 0.5, ny + Math.sin(a) * L * 0.5 + 2 * s, nx + Math.cos(a) * L, ny + Math.sin(a) * L + 5 * s], (t) => 0.6 * (1 - t) + 0.15);
    }
    wb.flush(ctx);
    // hands and feet gripping the stalk
    const hf = new LW.FillBatch();
    for (const [fx, fy] of [[sx - 2 * s, sy - 26 * s], [sx - 1 * s, sy + 34 * s]]) {
      for (let k = 0; k < 3; k++) {
        const pts = [fx - 6 * s, fy + k * 3 * s, fx + 2 * s, fy + k * 3 * s - 1 * s, fx + 6 * s, fy + k * 3 * s + 2 * s];
        LW.ribbon(hf.p(P.ink), pts, () => 1.6 * s + 0.5);
        LW.ribbon(hf.p('#e8a88a'), pts, () => 0.9 * s);
      }
    }
    hf.flush(ctx, [P.ink, '#e8a88a']);
    ctx.fillStyle = FURD; ctx.fill(tf);
    const ti = new Path2D();
    for (let i = 0; i < 80; i += 1) { const t = i / 80; if (Math.cos(t * Math.PI * 4.2) > 0) LW.ribbon(ti, [tail[2 * i], tail[2 * i + 1] - 1.2 * s, tail[2 * i + 2], tail[2 * i + 3] - 1.2 * s], () => 0.6 * s); }
    ctx.fillStyle = P.amber; ctx.fill(ti);
  }

  // a moth in flight, seen from above and behind: soft broad wings, fine veins, a pale furry fringe
  function moth(ctx, x, y, s, a, rng) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(s, s);
    const WING = '#4f5a52', WINGD = '#39433f', HIND = '#3d4844', FRINGE = '#a9b39f', VEIN = '#232c2b';
    // wing outline: root at the body, leading edge nearly straight, broad rounded-triangular tip, scalloped trailing edge
    const wingPts = (sgn, fore) => {
      const span = fore ? 44 : 30, chord = fore ? 20 : 22, sweep = fore ? -0.32 : 0.42;
      const pts = [];
      const N = 30;
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        // leading edge from root to tip
        const lx = span * u, ly = -chord * 0.18 * Math.sin(Math.PI * u * 0.9);
        pts.push(lx, ly);
      }
      for (let i = N; i >= 0; i--) {
        const u = i / N;
        // trailing edge back from tip to root, bellied, with tiny scallops
        const belly = chord * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.08)), 0.75) * (fore ? 1 - 0.25 * u : 1 - 0.1 * u);
        const sc = 0.7 * Math.sin(u * 40);
        pts.push(span * u * 0.97, belly + sc);
      }
      const out = [];
      const ca = Math.cos(sweep), sa = Math.sin(sweep);
      for (let i = 0; i < pts.length; i += 2) {
        const px = pts[i], py = pts[i + 1];
        out.push(sgn * (px * ca - py * sa), px * sa + py * ca + (fore ? -3 : 4));
      }
      return out;
    };
    const fb = new LW.FillBatch();
    for (const fore of [false, true]) for (const sgn of [-1, 1]) {
      const pts = wingPts(sgn, fore);
      LW.polyPath(fb.p(fore ? WING : HIND), pts, true);
      // fine veins radiating from the root
      for (let k = 0; k < 6; k++) {
        const e = 6 + Math.floor(((pts.length >> 1) / 2 - 6) * (k / 5));
        const tx = pts[2 * (pts.length / 2 - 1 - e)], ty = pts[2 * (pts.length / 2 - 1 - e) + 1];
        LW.ribbon(fb.p(VEIN), [0, 0, tx * 0.45, ty * 0.45 + 1, tx * 0.9, ty * 0.9], (t) => 0.35 + 0.2 * (1 - t));
      }
      // a soft darker band across the forewing, drawn as short parallel hatch
      if (fore) for (let k = 0; k < 7; k++) {
        const u = 0.45 + k * 0.04;
        const px = sgn * 44 * u, py0 = -3 + (-0.32) * 44 * u * sgn * sgn * 0;
        LW.ribbon(fb.p(WINGD), [px * Math.cos(-0.32) , py0 - 2 + px * Math.sin(-0.32) * sgn, px * Math.cos(-0.32) + sgn * 1.5, py0 + 12 + px * Math.sin(-0.32) * sgn], () => 0.4);
      }
      // pale furry fringe along the trailing edge
      const half = pts.length / 2;
      for (let i = half + 2; i < pts.length - 4; i += 4) {
        const px = pts[i], py = pts[i + 1];
        LW.ribbon(fb.p(FRINGE), [px, py - 0.5, px + rng.range(-0.6, 0.6), py + 1.2, px + rng.range(-0.8, 0.8), py + 2.6], (t) => 0.55 * (1 - t));
      }
      // faint warm light on the leading edge (the glow is behind and low)
      const lead = pts.slice(4, half - 6);
      if (fore) LW.ribbon(fb.p('#c98a4a'), lead, (t) => 0.55 * LW.taper(t, 0.2, 0.3));
      LW.ribbonClosed(fb.p(VEIN), pts, () => 0.55);
    }
    // small furry body and thin antennae
    LW.ribbon(fb.p('#2b3431'), [0, -9, 0, 2, 0, 15], (t) => 2.6 * Math.sin(Math.PI * (0.1 + t * 0.8)));
    for (let k = 0; k < 10; k++) { const yy = -6 + k * 2; LW.ribbon(fb.p(FRINGE), [-2, yy, 2, yy + 0.6], () => 0.25); }
    for (const sgn of [-1, 1]) LW.ribbon(fb.p(VEIN), [0, -9, sgn * 4, -17, sgn * 9, -23, sgn * 12, -25], (t) => 0.35);
    fb.flush(ctx, [HIND, WING, WINGD, VEIN, FRINGE, '#c98a4a', '#2b3431']);
    ctx.restore();
  }

  // near-black framing silhouettes: huge blades and stems right at the lens
  function framing(ctx, rng) {
    const ink = new Path2D(), rim = new LW.FillBatch();
    const L = { layer: 3, sc: 2.2 };
    const items = [
      [-60, 3880, 1, 1050, 70, 'arch'], [140, 3900, 1, 760, 54, 'fold'], [-40, 3640, 1, 640, 46, 'curl'],
      [2220, 3880, -1, 1100, 72, 'arch'], [1990, 3920, -1, 700, 50, 'curl'], [2200, 3600, -1, 560, 40, 'edge'],
      [520, 3910, -1, 520, 40, 'edge'], [1660, 3910, 1, 560, 42, 'edge'],
    ];
    for (const [x, y, side, len, wid, kind] of items) {
      const { pts: c } = bladeLine(x, y, side, len, kind, rng);
      const n = c.length >> 1;
      const left = [], right = [];
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
        let tx = c[2 * b] - c[2 * a], ty = c[2 * b + 1] - c[2 * a + 1];
        const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
        const w = (kind === 'edge' ? 0.4 : 1) * wid * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.03)), 0.55) * (1 - 0.3 * t) + 0.5;
        left.push(c[2 * i] - ty * w, c[2 * i + 1] + tx * w);
        right.push(c[2 * i] + ty * w, c[2 * i + 1] - tx * w);
      }
      const poly = left.slice();
      for (let i = n - 1; i >= 0; i--) poly.push(right[2 * i], right[2 * i + 1]);
      LW.polyPath(ink, poly, true);
      // thin cool rim on the upper edge only, broken
      // rim only along stretches where the same edge stays on top (no zig-zag across twists)
      let top = [], lastLt = null;
      const flushTop = () => { if (top.length >= 12) LW.dashes(top, rng, 80, 400, 30, 120, (sub) => LW.ribbon(rim.p('#2c5f66'), sub, (t) => 1.6 * LW.taper(t, 0.2, 0.2))); top = []; };
      for (let i = 2; i < n - 2; i++) {
        const lt = left[2 * i + 1] < right[2 * i + 1];
        if (lastLt !== null && lt !== lastLt) flushTop();
        lastLt = lt;
        top.push(lt ? left[2 * i] : right[2 * i], (lt ? left[2 * i + 1] : right[2 * i + 1]) + 2.5);
      }
      flushTop();
      // a few interior vein lines in very dark teal
      for (const sv of [-0.35, 0.3]) {
        const vp = [];
        for (let i = 2; i < n - 3; i++) vp.push(c[2 * i] + (left[2 * i] - c[2 * i]) * sv, c[2 * i + 1] + (left[2 * i + 1] - c[2 * i + 1]) * sv);
        LW.dashes(vp, rng, 60, 300, 20, 60, (sub) => LW.ribbon(rim.p('#132530'), sub, (t) => 1.2 * LW.taper(t, 0.2, 0.2)));
      }
    }
    void L;
    ctx.fillStyle = '#080d13'; ctx.fill(ink);
    rim.flush(ctx, ['#132530', '#2c5f66', P.rust]);
  }

  // dark ground at the very bottom: base of the stalks swallowed by shadow
  function groundShade(ctx, rng) {
    const fb = new LW.FillBatch();
    const top = (x) => 3600 + 70 * LW.N1(x * 0.004, 7.7) + 30 * LW.N2(x * 0.02, 1.1) - 100 * Math.exp(-(((x - 1020) / 260) ** 2)) * 0 + 120 * (1 - Math.exp(-(((x - 1060) / 700) ** 2)));
    // a dense comb of grass silhouettes defines the top edge (no hard horizontal line)
    for (let x = -20; x < SC.W + 20; x += rng.range(3, 7)) {
      if (Math.abs(x - (1060 + (top(x) - 3840) * 0.2)) < 150) continue;
      const y0 = top(x) + rng.range(-10, 30);
      const h = rng.range(30, 130);
      const a = rng.range(-0.35, 0.35);
      LW.ribbon(fb.p('#0a1118'), [x, SC.H + 10, x + Math.sin(a) * h * 0.3, y0, x + Math.sin(a) * h, y0 - h], (t) => 3.2 * (1 - t) + 0.4);
    }
    const base = [];
    for (let x = -20; x <= SC.W + 20; x += 10) { const pc = 1060 + (top(x) - 3840) * 0.2; base.push(x, Math.abs(x - pc) < 160 ? SC.H + 30 : top(x) + 40); }
    base.push(SC.W + 20, SC.H + 30, -20, SC.H + 30);
    LW.polyPath(fb.p('#0a1118'), base, true);
    fb.flush(ctx);
  }

  LW.drawForeground = function (ctx) {
    const rng = new LW.RNG('foreground');
    const pathX = (y) => 1150 + (y - 3840) * 0.2;
    const KINDS = ['arch', 'arch', 'upright', 'upright', 'fold', 'fold', 'curl', 'curl', 'edge', 'edge', 'edge', 'broken'];
    const leafRng = new LW.RNG('leaves');
    const heroes = { mouse: null };
    for (let li = 0; li < LAYERS.length; li++) {
      const L = Object.assign({ layer: li }, LAYERS[li]);
      const plants = [];
      for (let i = 0; i < L.n; i++) {
        let ex;
        for (let k = 0; k < 20; k++) {
          ex = rng.range(-120, SC.W + 120);
          const d = Math.abs(ex - pathX(3500));
          if (d > 360 || rng.next() < (li === 2 ? 0.02 : 0.12) * (d / 360)) break;
        }
        const ey = rng.range(L.y0, L.y1) + (li === 2 ? Math.abs(ex - 1080) * -0.1 : 0) + (rng.next() < 0.25 ? rng.range(80, 260) : 0);
        plants.push({ ex, ey, sc: rng.range(L.s0, L.s1) });
      }
      if (li === 2) {
        plants.push({ ex: 70, ey: 2640, sc: 1.85 });
        plants.push({ ex: 2085, ey: 2760, sc: 1.7 });
        plants.push({ ex: 560, ey: 2930, sc: 1.25, mouse: true, nod: 0.5 });
      }
      plants.sort((a, b) => a.ey - b.ey);
      if (li === 1) {
        // the poppy and its bud stand among the middle layer, right of the path
        const pp = [1480, 3150];
        const st = bez([1530, SC.H + 60], [1470, 3500], pp, 30);
        stem(ctx, Object.assign({}, L, { sc: 0.75 }), st, rng);
        blade(ctx, Object.assign({}, L, { sc: 0.9 }), 1500, 3520, 1, 260, 11, 'arch', leafRng);
        const bs = bez([1560, SC.H + 60], [1600, 3420], [1640, 3290], 24);
        stem(ctx, Object.assign({}, L, { sc: 0.45 }), bs, rng);
        poppyBud(ctx, 1652, 3262, 30, 0.5, rng);
        poppy(ctx, pp[0], pp[1] - 30, 112, 0.1, rng);
      }
      for (const p of plants) {
        L.sc = p.sc;
        const bx = p.ex + rng.range(-160, 160) * p.sc - (p.ex - 1080) * 0.05;
        const by = SC.H + 60;
        const lean = (p.ex - bx) / (by - p.ey);
        const midx = bx + (p.ex - bx) * 0.5 + rng.range(-40, 40) * p.sc, midy = (by + p.ey) / 2;
        const sp = bez([bx, by], [midx, midy], [p.ex, p.ey], 36);
        const nl = rng.int(2, 3);
        const leaves = [];
        for (let k = 0; k < nl; k++) {
          const t = rng.range(0.4, 0.88);
          const [x, y] = at(sp, 1 - t);
          const kind = KINDS[Math.floor(leafRng.next() * KINDS.length)];
          leaves.push(blade(ctx, L, x, y, leafRng.sign(), leafRng.range(200, 460) * p.sc * (kind === 'broken' ? 0.5 : 1), leafRng.range(8, 13.5) * p.sc, kind, leafRng));
        }
        stem(ctx, L, sp, rng);
        if (p.mouse) heroes.mouse = { sp, sc: p.sc };
        const ang = Math.atan2(p.ey - sp[sp.length - 3], p.ex - sp[sp.length - 4]);
        const len = rng.range(150, 230) * p.sc;
        const nod = p.nod !== undefined ? p.nod : (rng.next() < 0.3 ? rng.range(0.6, 1.3) : rng.range(0.05, 0.4)) * (lean > 0 ? 1 : -1) * (rng.next() < 0.2 ? -1 : 1);
        if (p.mouse) {
          const [mx, my] = at(sp, 0.8);
          mouse(ctx, mx, my, 1.35, rng);
        }
        ear(ctx, L, p.ex, p.ey, ang, len, nod, rng);
        // dew on a few near leaves
        if (li === 2) {
          const fb = new LW.FillBatch();
          for (const lf of leaves) {
            if (leafRng.next() > 0.45) continue;
            const nd = leafRng.int(1, 3);
            for (let k = 0; k < nd; k++) {
              const i = Math.floor(leafRng.range(0.2, 0.7) * lf.n);
              const top = lf.left[2 * i + 1] < lf.right[2 * i + 1] ? lf.left : lf.right;
              const x = lf.c[2 * i] + (top[2 * i] - lf.c[2 * i]) * 0.3, y = lf.c[2 * i + 1] + (top[2 * i + 1] - lf.c[2 * i + 1]) * 0.3;
              dew(fb, x, y, leafRng.range(2.6, 4.8) * p.sc, leafRng.next() < 0.18);
            }
          }
          fb.flush(ctx, [P.ink, '#2d5a63', P.straw, '#fff6dc']);
        }
      }
      if (li === 0) groundShade(ctx, rng);
      if (li === 2) {
        // cornflowers, left of the path, in front
        for (const [cx, cy, r] of [[250, 3330, 64], [400, 3440, 50], [178, 3480, 40]]) {
          const st2 = bez([cx + 50, SC.H + 60], [cx + 14, (cy + SC.H) / 2], [cx, cy + r * 0.4], 24);
          stem(ctx, Object.assign({}, L, { sc: 0.4 }), st2, rng);
          cornflower(ctx, cx, cy, r, rng);
        }
      }
    }
    moth(ctx, 1345, 2690, 0.9, -0.18, rng);
    framing(ctx, rng);
  };
})();
