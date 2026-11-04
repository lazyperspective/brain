// The Observatory: land. Receding ranges with fall-line streamline hatching, valley mist in
// horizontal line bands, a distant village glimmer, the observatory massif (contour streamlines
// on the slopes, Voronoi strata blocks on the cliffs), the switchback path and its lanterns,
// and the foreground outcrop.
'use strict';
(function () {
  const OB = window.OB;
  const { clamp, smooth, lerp, mix, css } = OB;
  const W = OB.W, H = OB.H;

  // ------------------------------------------------------------------ helpers
  // Emit runs of a polyline where on(i) is true as tapered ribbons into P.
  OB.runs = (P, pts, wFn, on, minRun = 3) => {
    let a = null, ws = null;
    const flush = () => {
      if (a && a.length >= minRun) {
        const n = a.length;
        for (let k = 0; k < n; k++) ws[k] *= Math.sqrt(Math.min(1, (k + 1) / 3, (n - k) / 3));
        OB.ribbon(P, a, ws);
      }
      a = null;
    };
    for (let i = 0; i < pts.length; i++) {
      if (on(i)) {
        if (!a) { a = []; ws = []; }
        a.push(pts[i]);
        ws.push(wFn(i));
      } else flush();
    }
    flush();
  };

  // outward normals of a closed polygon (unit)
  const normals = (pts) => {
    const n = pts.length, s = OB.area(pts) > 0 ? 1 : -1, out = [];
    for (let i = 0; i < n; i++) {
      const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
      let nx = b[1] - a[1], ny = -(b[0] - a[0]);
      const l = Math.hypot(nx, ny) || 1;
      out.push([(nx / l) * s, (ny / l) * s]);
    }
    return out;
  };
  OB.normals = normals;

  // Ink outline, heavier where the edge faces away from the light (shadow side).
  OB.outline = (ctx, pts, w, colAt, o = {}) => {
    const nr = normals(pts);
    const sd = o.sd || [0.45, 0.89];
    const loop = pts.concat([pts[0]]);
    const ws = loop.map((p, i) => {
      const n = nr[i % pts.length];
      const f = Math.max(0, n[0] * sd[0] + n[1] * sd[1]);
      return w * (0.55 + 1.25 * f) * (1 + 0.25 * OB.N(i * 0.07, w));
    });
    const B = new OB.Batch();
    // split into chunks so colour can follow warm light
    const chunk = 40;
    for (let i = 0; i < loop.length - 1; i += chunk) {
      const seg = loop.slice(i, Math.min(loop.length, i + chunk + 1));
      const sw = ws.slice(i, Math.min(loop.length, i + chunk + 1));
      const m = seg[seg.length >> 1];
      OB.ribbon(B.get(colAt(m[0], m[1])), seg, sw);
    }
    B.fill(ctx);
    // lit-edge highlight: a pale line just inside edges facing the light
    if (o.hi) {
      const P = new Path2D();
      const inset = pts.map((p, i) => [p[0] - nr[i][0] * w * 1.4, p[1] - nr[i][1] * w * 1.4]);
      inset.push(inset[0]);
      OB.runs(P, inset, (i) => o.hiW * Math.max(0, -(nr[i % pts.length][0] * sd[0] + nr[i % pts.length][1] * sd[1])), (i) => -(nr[i % pts.length][0] * sd[0] + nr[i % pts.length][1] * sd[1]) > 0.35, 4);
      ctx.fillStyle = o.hi;
      ctx.fill(P);
    }
  };

  // tone picker for posterised tone tables [[ub, rgb]...]
  OB.toneOf = (tones, d) => {
    for (let i = 0; i < tones.length - 1; i++) if (d <= tones[i][0]) return tones[i][1];
    return tones[tones.length - 1][1];
  };

  // ------------------------------------------------------------------ ranges
  OB.skylineFn = (sp) => {
    const N = OB.noise(sp.seed + 5);
    return (x) => {
      let env = 0;
      for (const p of sp.peaks) {
        const dx = x - p.x, w = dx < 0 ? p.wl : p.wr;
        const t = 1 - Math.abs(dx) / w + 0.1 * N(x * 0.007, p.x * 0.01);
        if (t > 0) env = Math.max(env, p.h * Math.pow(Math.min(1, t), p.e));
      }
      const jag = N.ridged(x * 0.0055, 1.3, 5) - 0.62;
      const fine = N.ridged(x * 0.02, 4.1, 3) - 0.6;
      return sp.base - env - (0.32 * env + sp.rough) * 1.5 * jag - (0.06 * env + sp.rough * 0.3) * fine;
    };
  };
  const peakAt = (sp, sky, x) => {
    let best = sp.peaks[0], by = Infinity;
    for (const p of sp.peaks) {
      const dx = x - p.x, w = dx < 0 ? p.wl : p.wr;
      const t = 1 - Math.abs(dx) / w;
      const y = t > 0 ? sp.base - p.h * Math.pow(t, p.e) : sp.base + Math.abs(dx) * 0.2;
      if (y < by) { by = y; best = p; }
    }
    return best;
  };

  OB.drawRange = (ctx, S, sp) => {
    const N = OB.noise(sp.seed), C = OB.C;
    const sky = (sp.sky = OB.skylineFn(sp));
    const top = [];
    for (let x = -30; x <= W + 30; x += 3) top.push([x, sky(x)]);
    const poly = top.concat([[W + 30, sp.bottom], [-30, sp.bottom]]);
    const path = OB.path(poly);
    const bb = OB.bbox(poly);
    const D = (x, y) => {
      const p = peakAt(sp, sky, x);
      const ptop = sp.base - p.h;
      const side = x - p.x + (y - ptop) * (0.3 + 0.25 * N(y * 0.004, p.x)) + 40 * N.fbm(x * 0.006, y * 0.006, 3);
      let d = side > 0 ? sp.dShadow : sp.dLit;
      d += 0.1 * N.fbm(x * 0.005, y * 0.005, 3);
      d -= sp.mistFade * smooth(sp.base - 80, sp.bottom - 20, y);
      return clamp(d);
    };
    OB.posterFill(ctx, path, bb, D, sp.tones, { step: 5, dither: 0.03 });
    // fall lines radiating from the peaks, bending to vertical lower down
    const mask = OB.mask((g) => g.fill(path), 0.5);
    const angle = (x, y) => {
      const p = peakAt(sp, sky, x);
      const ptop = sp.base - p.h;
      let a = Math.atan2(Math.max(30, y - ptop), (x - p.x) * 0.9);
      const depth = clamp((y - sky(x)) / sp.blend);
      a = lerp(a, Math.PI / 2, depth * 0.55) + 0.32 * N.fbm(x * 0.005, y * 0.005, 2);
      return a;
    };
    const sep = (x, y) => lerp(sp.sepMax, sp.sepMin, D(x, y));
    const lines = OB.streamlines({ inside: (x, y) => mask.inside(x, y) && y > sky(x) + 3, angle, sep, bbox: [bb[0], bb[1] - 4, bb[2], bb[3]], step: 2.4, cell: 4, seed: sp.seed, minLen: 14, maxSteps: 260, dtest: 0.55, seedGrid: 40 });
    const B = new OB.Batch();
    for (const L of lines) {
      if (L.length < 3) continue;
      const m = L[L.length >> 1];
      const ws = OB.inkWidths(L, lerp(sp.lw[0], sp.lw[1], D(m[0], m[1])), { t0: 0.25, t1: 0.35, wn: 0.3, ph: m[0] });
      OB.ribbon(B.get(sp.lineCss), L, ws);
    }
    B.fill(ctx);
    // crest line
    const crest = OB.roughen(top, false, 1.2, 0.05, sp.seed, 4);
    const P = new Path2D();
    OB.ink(P, crest, sp.crestW, { t0: 0, t1: 0, wn: 0.45, ph: sp.seed });
    ctx.fillStyle = sp.crestCss;
    ctx.fill(P);
    // tiny conifers on the nearer ranges
    if (sp.trees) {
      const R = OB.rng(sp.seed + 9);
      const T = new Path2D();
      for (let k = 0; k < sp.trees.n; k++) {
        const x = R() * W;
        const y0 = sky(x);
        const y = y0 + 8 + R() * sp.trees.depth;
        if (D(x, y) > 0.9 || N.fbm(x * 0.004, y * 0.004, 2) < 0.05) continue;
        const h = sp.trees.h * (0.6 + 0.6 * R()) * lerp(1, 1.4, (y - y0) / sp.trees.depth);
        T.moveTo(x, y - h);
        T.lineTo(x + h * 0.22, y);
        T.lineTo(x - h * 0.22, y);
        T.closePath();
      }
      ctx.fillStyle = sp.crestCss;
      ctx.fill(T);
    }
  };

  // ------------------------------------------------------------------ mist bands
  OB.drawMist = (ctx, S, m) => {
    const N = OB.noise(m.seed), C = OB.C;
    const topY = (x) => m.top + m.amp * N.fbm(x * 0.0022, 0.3, 3) + m.amp * 0.4 * N(x * 0.008, 2);
    const pts = [];
    for (let x = -30; x <= W + 30; x += 5) pts.push([x, topY(x)]);
    const poly = pts.concat([[W + 30, m.bottom], [-30, m.bottom]]);
    const path = OB.path(OB.roughen(poly, true, 1.5, 0.05, m.seed, 5));
    ctx.save();
    ctx.translate(OB.MR[0], OB.MR[1]);
    ctx.fillStyle = css(m.fill, m.alpha);
    ctx.fill(path);
    ctx.restore();
    const B = new OB.Batch();
    let i = 0;
    for (let y = m.top - m.amp * 1.4; y < m.bottom; i++) {
      const t = smooth(m.top - m.amp, m.bottom, y);
      y += lerp(m.sp[0], m.sp[1], Math.pow(t, 0.7)) * (0.8 + 0.4 * OB.hash(i, m.seed));
      const line = [];
      for (let x = -20; x <= W + 20; x += 6) line.push([x, y + 2.5 * N(x * 0.004, y * 0.02) + 6 * N.fbm(x * 0.0015, y * 0.003, 2)]);
      const al = m.lineA * (0.45 + 0.55 * t);
      const key = css(m.lineCol, Math.round(al * 20) / 20);
      OB.runs(B.get(key), line, (k) => m.lw * (0.6 + 0.5 * t) * (1 + 0.3 * N(k * 0.1, y)), (k) => {
        const p = line[k];
        const inside = p[1] > topY(p[0]) + 3;
        const wisp = p[1] > topY(p[0]) - 22 && N(p[0] * 0.002, y * 0.03 + 9) > 0.35;
        return (inside || wisp) && N(p[0] * 0.0035 + i * 0.7, y * 0.05) > -0.35 + 0.3 * (1 - t);
      }, 4);
    }
    B.fill(ctx);
  };

  // ------------------------------------------------------------------ village glimmer
  OB.drawVillage = (ctx, S) => {
    const v = S.village, R = OB.rng(61), C = OB.C;
    const B = new OB.Batch();
    const lights = [];
    for (let k = 0; k < v.n; k++) {
      const t = R();
      const x = v.x0 + (v.x1 - v.x0) * t + R() * 18 - 9;
      const y = v.y + Math.sin(t * 3.2) * v.bow + (R() - 0.5) * v.spread * (1 - Math.abs(t - 0.5));
      lights.push([x, y, 0.9 + R() * 1.5]);
    }
    // a few roofs as tiny dark blocks behind lights
    const roofs = new Path2D();
    for (const [x, y, r] of lights) {
      if (R() < 0.5) continue;
      const w = 6 + R() * 7, h = 4 + R() * 4;
      roofs.moveTo(x - w / 2, y + 2);
      roofs.lineTo(x - w / 2, y - h * 0.6);
      roofs.lineTo(x, y - h * 1.2);
      roofs.lineTo(x + w / 2, y - h * 0.6);
      roofs.lineTo(x + w / 2, y + 2);
      roofs.closePath();
    }
    ctx.fillStyle = css(C.rangeInk3);
    ctx.fill(roofs);
    for (const [x, y, r] of lights) OB.glow(ctx, x, y, 9 + r * 4, C.amber, 0.22);
    for (const [x, y, r] of lights) {
      const p = B.get(css(R() < 0.7 ? C.amberHot : C.amber));
      p.moveTo(x + r, y);
      p.arc(x, y, r, 0, OB.TAU);
    }
    B.fill(ctx);
  };

  // ------------------------------------------------------------------ rock
  // A rock. Two kinds:
  //  'boulder': a rounded lump. Flat two-tone fill (sky-lit cap), contour lines that wrap the
  //             form, bunching toward the outline on the shadow side and dying out toward the light.
  //  'slab':    an angular strata block of a cliff mass. Thin cracks to its neighbours, a narrow
  //             lit ledge, a front face hatched along or across the bedding, a dark side plane.
  OB.drawRock = (ctx, poly, o) => {
    const R = OB.rng(o.seed), C = OB.C;
    const s = o.size;
    const boulder = o.kind === 'boulder';
    const c0 = OB.centroid(poly);
    const gap = boulder ? s * 0.04 + 1.5 : s * 0.012 + 1.2;
    let p = poly.map((q) => {
      const dx = q[0] - c0[0], dy = q[1] - c0[1];
      const l = Math.hypot(dx, dy) || 1;
      const k = Math.max(0.25, (l - gap) / l);
      return [c0[0] + dx * k, c0[1] + dy * k];
    });
    if (boulder) p = OB.chaikin(p, 2, true);
    p = OB.roughen(p, true, s * (boulder ? 0.05 : 0.025), 2.6 / s, o.seed % 997, Math.max(3, s * 0.025));
    p = OB.roughen(p, true, s * 0.008 + 0.4, 0.12, (o.seed % 991) + 5, 3);
    if (p.length < 5) return null;
    const path = OB.path(p);
    const bb = OB.bbox(p);
    const [cx, cy] = OB.centroid(p);
    let mr = 0;
    for (const q of p) mr += Math.hypot(q[0] - cx, q[1] - cy);
    mr /= p.length;
    const tag = o.tag, Db = o.D, lw = o.lw;
    const wk = OB.warm(cx, cy, tag);
    const inkAt = (x, y) => OB.warmCss(C.ink, x, y, tag, 1);
    const tone = (d) => mix(OB.toneOf(o.tones, d), C.warmStone, Math.min(0.5, wk * 0.55));
    if (o.halo !== false) {
      const k = (mr + gap * (boulder ? 1.6 : 2.5)) / mr;
      ctx.fillStyle = css(C.crevice, 0.92);
      ctx.fill(OB.path(p.map((q) => [cx + (q[0] - cx) * k, cy + (q[1] - cy) * k + gap * 0.5])));
      if (boulder) {
        ctx.fillStyle = css(C.crevice, 0.45);
        ctx.fill(OB.path(p.map((q) => [q[0] + s * 0.05, q[1] + s * 0.07])));
      }
    }
    OB.flatFill(ctx, path, css(tone(Db)));
    ctx.save();
    ctx.clip(path);
    if (boulder) {
      // sky-lit cap: a flat lighter shape offset toward the upper left
      const hlx = cx - (bb[2] - bb[0]) * 0.16, hly = cy - (bb[3] - bb[1]) * 0.26;
      const cap = p.map((q) => [hlx + (q[0] - hlx) * 0.74 - mr * 0.06, hly + (q[1] - hly) * 0.66 - mr * 0.1]);
      ctx.save();
      ctx.translate(OB.MR[0], OB.MR[1]);
      ctx.fillStyle = css(mix(tone(clamp(Db - 0.3)), C.rockHi, 0.1));
      ctx.fill(OB.path(OB.roughen(cap, true, mr * 0.05, 3 / mr, o.seed % 37, 3)));
      ctx.restore();
      // wrapping contour lines
      const B = new OB.Batch();
      const n = Math.round(clamp(mr / (o.sp * 0.9), 4, 34));
      const sd = [0.48, 0.88];
      for (let k = 1; k <= n; k++) {
        const f = 1 - Math.pow(k / (n + 1), 1.25);
        const cp = p.map((q, i) => {
          const w = 0.6 * OB.N(i * 0.05 + k * 0.3, o.seed * 0.01);
          return [hlx + (q[0] - hlx) * f + w, hly + (q[1] - hly) * f + w];
        });
        cp.push(cp[0]);
        const lvl = k / (n + 1);
        const dk = (i) => {
          const q = cp[i];
          const dx = q[0] - hlx, dy = q[1] - hly, l = Math.hypot(dx, dy) || 1;
          const side = 0.5 + 0.5 * ((dx / l) * sd[0] + (dy / l) * sd[1]);
          return Db * 0.6 + side * 0.75 - 0.5 * OB.warm(q[0], q[1], tag);
        };
        const m = cp[cp.length >> 1];
        if (f < 0.42) continue;
        OB.runs(B.get(inkAt(m[0], m[1])), cp, (i) => lw * (0.3 + 1.1 * clamp(dk(i) - 0.35 - lvl * 0.3)), (i) => dk(i) > 0.4 + lvl * 0.75 + 0.07 * OB.N(i * 0.09, k * 3.3), 3);
      }
      B.fill(ctx);
      // a pale rim where the cap meets the sky
      const rimPts = p.map((q) => [cx + (q[0] - cx) * 0.93, cy + (q[1] - cy) * 0.93]);
      rimPts.push(rimPts[0]);
      const Pr = new Path2D();
      OB.runs(Pr, rimPts, () => lw * 0.9, (i) => { const q = rimPts[i]; return (q[0] - cx) * -0.5 + (q[1] - cy) * -0.86 > mr * 0.45; }, 4);
      ctx.fillStyle = css(mix(C.rockHi, C.amberLine, Math.min(1, wk * 1.3)), 0.7);
      ctx.fill(Pr);
    } else {
      const dip = o.dip, ca = Math.cos(dip), sa = Math.sin(dip);
      let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
      for (const q of p) {
        const u = (q[0] - cx) * ca + (q[1] - cy) * sa, v = -(q[0] - cx) * sa + (q[1] - cy) * ca;
        umin = Math.min(umin, u); umax = Math.max(umax, u); vmin = Math.min(vmin, v); vmax = Math.max(vmax, v);
      }
      const hv = vmax - vmin || 1;
      const vcut = vmin + hv * (0.08 + 0.16 * R());
      const sideF = 0.2 + 0.25 * R(), slant = (R() - 0.4) * 0.5;
      const sideU = (v) => umax - (umax - umin) * sideF + (v - vmin) * slant;
      const W2 = (u, v) => [cx + u * ca - v * sa, cy + u * sa + v * ca];
      const UV = (x, y) => [(x - cx) * ca + (y - cy) * sa, -(x - cx) * sa + (y - cy) * ca];
      const Dtop = clamp(Db - 0.36), Dside = clamp(Db + 0.24);
      ctx.save();
      ctx.translate(OB.MR[0], OB.MR[1]);
      const sidePoly = [];
      for (let v = vmin - 30; v <= vmax + 30; v += 4) sidePoly.push(W2(sideU(v), v));
      sidePoly.push(W2(umax + 60, vmax + 30), W2(umax + 60, vmin - 30));
      ctx.fillStyle = css(tone(Dside));
      ctx.fill(OB.path(sidePoly));
      ctx.fillStyle = css(mix(tone(Dtop), C.rockHi, 0.12));
      ctx.fill(OB.path([W2(umin - 40, vcut), W2(umax + 40, vcut), W2(umax + 40, vmin - 40), W2(umin - 40, vmin - 40)]));
      ctx.restore();
      const Df = (x, y) => {
        const [u, v] = UV(x, y);
        if (v < vcut) return -1;
        let d = Db + 0.3 * ((v - vcut) / (vmax - vcut + 1) - 0.35) + 0.08 * ((u - umin) / (umax - umin + 1) - 0.5);
        if (u > sideU(v)) d += 0.24;
        return d - 0.5 * OB.warm(x, y, tag);
      };
      const spF = o.sp * (0.85 + 0.3 * R());
      const across = R() < 0.55; // hatch across the bedding (vertical) or along it
      const a1 = across ? Math.PI / 2 + dip + (R() - 0.5) * 0.35 : dip + (R() - 0.5) * 0.12;
      OB.engrave(ctx, { bbox: bb, angle: a1, sp: spF, D: Df, w: lw * 1.25, wmin: lw * 0.3, levels: 8, colAt: inkAt, wob: 0.5, seed: o.seed, step: 3, fade: 0.25, warp: across ? null : (u, v) => s * 0.03 * Math.sin(u / (s * 0.25) + o.seed) });
      OB.engrave(ctx, { bbox: bb, angle: a1 + (across ? -1.05 : 0.95), sp: spF * 1.15, D: (x, y) => Df(x, y) - 0.5, thrRange: 0.5, w: lw * 0.95, wmin: lw * 0.25, levels: 8, colAt: inkAt, wob: 0.5, seed: o.seed + 2, step: 3 });
      // ledge lip
      const lip = [];
      for (let u = umin - 4; u <= umax + 4; u += 3) lip.push(W2(u, vcut + s * 0.015 * OB.N(u * 0.05, o.seed)));
      const Pl = new Path2D();
      OB.ink(Pl, lip, lw * 1.3, { t0: 0.08, t1: 0.08, wn: 0.5, ph: o.seed });
      ctx.fillStyle = inkAt(cx, cy);
      ctx.fill(Pl);
      const Ph = new Path2D();
      OB.ink(Ph, lip.map((q) => [q[0] + sa * lw * 2.3, q[1] - ca * lw * 2.3]), lw, { t0: 0.25, t1: 0.3, wn: 0.7, ph: o.seed + 4 });
      ctx.fillStyle = css(mix(C.rockHi, C.amberLine, Math.min(1, wk * 1.3)), 0.75);
      ctx.fill(Ph);
      const se = [];
      for (let v = vcut; v <= vmax; v += 3) se.push(W2(sideU(v), v));
      if (se.length > 3) {
        const Ps = new Path2D();
        OB.ink(Ps, se, lw * 0.9, { t0: 0.2, t1: 0.1, wn: 0.5, ph: o.seed + 8 });
        ctx.fillStyle = inkAt(cx, cy);
        ctx.fill(Ps);
      }
    }
    // cracks
    if (s > 60 && R() < 0.7) {
      const P = new Path2D();
      const nc = 1 + Math.floor(R() * (s > 180 ? 3 : 2));
      for (let c = 0; c < nc; c++) {
        const p0 = p[Math.floor(R() * p.length)];
        let x = p0[0], y = p0[1];
        let a = Math.atan2(cy - y, cx - x) + (R() - 0.5) * 0.9;
        const pts = [[x, y]];
        const L = s * (0.25 + 0.4 * R());
        for (let d = 0; d < L; d += 5) {
          a += (R() - 0.5) * 0.7;
          x += Math.cos(a) * 5; y += Math.sin(a) * 5;
          pts.push([x, y]);
          if (R() < 0.05) {
            const br = [[x, y]];
            let bx = x, by = y, ba = a + R() * 1.4 - 0.7;
            for (let e = 0; e < L * 0.3; e += 5) { ba += (R() - 0.5) * 0.6; bx += Math.cos(ba) * 5; by += Math.sin(ba) * 5; br.push([bx, by]); }
            OB.ink(P, br, lw * 0.8, { t0: 0, t1: 0.8, wn: 0.4, ph: c * 9 });
          }
        }
        OB.ink(P, pts, lw * 1.3, { t0: 0.05, t1: 0.75, wn: 0.4, ph: c * 3 + o.seed });
      }
      ctx.fillStyle = inkAt(cx, cy);
      ctx.fill(P);
    }
    if (s > 110) {
      const P = new Path2D();
      const nd = Math.floor(s * s * 0.0006);
      for (let k = 0; k < nd; k++) {
        const x = bb[0] + R() * (bb[2] - bb[0]), y = bb[1] + R() * (bb[3] - bb[1]);
        const r = 0.6 + R() * 1.1;
        P.moveTo(x + r, y);
        P.arc(x, y, r, 0, OB.TAU);
      }
      ctx.fillStyle = css(C.ink, 0.55);
      ctx.fill(P);
    }
    ctx.restore();
    OB.outline(ctx, p, lw * (boulder ? 1.8 : 1.5) * (o.olw || 1), inkAt, {});
    return p;
  };

  // ------------------------------------------------------------------ cliff faces
  // A continuous rock face: explicit, gently folded strata bands (each with a lit ledge top and
  // a dark undercut), staggered vertical joints with shadowed side faces, fall-line burin
  // hatching whose density follows the tone, cross hatching in the undercuts, grass on ledges.
  // `clip` is the face region; it is outlined by stroking it before the interior is laid.
  OB.drawCliff = (ctx, clip, bbox, o) => {
    const N = OB.noise(o.seed), R = OB.rng(o.seed + 1), C = OB.C;
    const [x0, y0, x1, y1] = bbox;
    const xs = 6;
    const nx = Math.ceil((x1 - x0) / xs) + 2;
    const tilt = Math.tan(o.dip);
    const bands = [];
    let cur = new Float32Array(nx);
    for (let i = 0; i < nx; i++) { const x = x0 + i * xs; cur[i] = y0 - 260 + (x - x0) * tilt + o.fold * N.fbm(x * 0.0016, 0.5, 3); }
    bands.push(cur);
    for (let k = 0; k < 500; k++) {
      const nxt = new Float32Array(nx);
      const hk = 0.6 + 0.8 * R();
      let mn = Infinity;
      for (let i = 0; i < nx; i++) {
        const x = x0 + i * xs;
        nxt[i] = cur[i] + o.bandH(cur[i]) * hk * (1 + 0.22 * N(x * 0.0028, k * 1.7));
        mn = Math.min(mn, nxt[i]);
      }
      bands.push(nxt);
      cur = nxt;
      if (mn > y1 + 20) break;
    }
    const col = (x) => Math.max(0, Math.min(nx - 1, Math.round((x - x0) / xs)));
    const bandAt = (x, y) => {
      const i = col(x);
      if (y < bands[0][i]) return [-1, 0];
      let lo = 0, hi = bands.length - 1;
      if (y >= bands[hi][i]) return [hi, 0];
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (bands[m][i] <= y) lo = m; else hi = m; }
      return [lo, (y - bands[lo][i]) / (bands[hi][i] - bands[lo][i] || 1)];
    };
    const joints = bands.map((b, k) => {
      const arr = [];
      let x = x0 - R() * 300;
      while (x < x1 + 50) { x += o.bandH(b[col(x)]) * (0.9 + 2.4 * R()); arr.push(x); }
      return arr;
    });
    const Dc = (x, y) => {
      const [k, t] = bandAt(x, y);
      let d = o.D(x, y);
      if (k >= 0) {
        d += (OB.hash(k, o.seed) - 0.5) * 0.18;
        if (t < 0.17) d -= 0.4 * (1 - t / 0.17) + 0.12;
        else if (t > 0.7) d += 0.32 * smooth(0.7, 1, t);
        const J = joints[k];
        const sw = 6 + o.bandH(y) * 0.14;
        for (let j = 0; j < J.length; j++) { const dx = x - J[j]; if (dx > 0 && dx < sw) { d += 0.26 * (1 - dx / sw) + 0.1; break; } if (dx < 0) break; }
      }
      return clamp(d - 0.5 * OB.warm(x, y, o.tag));
    };
    const inkAt = (x, y) => OB.warmCss(C.ink, x, y, o.tag, 1);
    // outline: a heavy stroke whose inner half the face will cover
    ctx.lineWidth = o.olw * 2;
    ctx.strokeStyle = css(C.ink);
    ctx.stroke(clip);
    OB.posterFill(ctx, clip, bbox, Dc, o.tones, { step: 3, dither: 0.025 });
    ctx.save();
    ctx.clip(clip);
    for (const [ya, yb, sp, lw] of o.strips) {
      const bb = [x0, Math.max(y0, ya), x1, Math.min(y1, yb)];
      if (bb[3] <= bb[1]) continue;
      OB.engrave(ctx, { bbox: bb, angle: Math.PI / 2 + 0.06, sp, D: Dc, w: lw * 1.25, wmin: lw * 0.3, levels: 8, colAt: inkAt, wob: 0.35, seed: o.seed + ya, step: 4, fade: 0.22, warp: (u, v) => 2.5 * N(u * 0.008, v * 0.03) });
      OB.engrave(ctx, { bbox: bb, angle: o.dip + 0.04, sp: sp * 1.15, D: (x, y) => Dc(x, y) - 0.55, thrRange: 0.45, w: lw, wmin: lw * 0.3, levels: 8, colAt: inkAt, wob: 0.6, seed: o.seed + ya + 1, step: 3 });
    }
    // ledge lips, highlights, joints
    const B = new OB.Batch();
    const Ph = new Path2D();
    const Pd = new Path2D(), Pl = new Path2D();
    const lwAt = (y) => { for (const s of o.strips) if (y < s[1]) return s[3]; return o.strips[o.strips.length - 1][3]; };
    bands.forEach((b, k) => {
      const pts = [];
      for (let i = 0; i < nx; i++) pts.push([x0 + i * xs, b[i]]);
      const vis = pts.map((q) => q[1] > y0 - 20 && q[1] < y1 + 20);
      for (let i = 0; i < nx; i += 30) {
        const seg = pts.slice(i, Math.min(nx, i + 31));
        const m = seg[seg.length >> 1];
        const lw = lwAt(m[1]);
        OB.runs(B.get(inkAt(m[0], m[1])), seg, (q) => lw * (1.6 + 0.9 * OB.N(q * 0.2 + k, i)), (q) => vis[i + q] && OB.N((i + q) * 0.05, k * 2.3 + o.seed) > -0.55, 3);
        OB.runs(Ph, seg.map((q) => [q[0], q[1] + lw * 2.6]), () => lw * 0.95, (q) => vis[i + q] && OB.N((i + q) * 0.07 + 3, k * 1.3) > -0.1 && Dc(seg[q][0], seg[q][1] + 4) < 0.75, 3);
      }
      // joints down to the next ledge
      if (k < bands.length - 1) {
        for (const jx of joints[k]) {
          const i = col(jx);
          const ya = b[i], yb = bands[k + 1][i];
          if (yb < y0 - 20 || ya > y1 + 20) continue;
          const lw = lwAt(ya);
          const ln = OB.wline(jx, ya, jx + (R() - 0.5) * 6, yb, 5, 1.2, jx);
          OB.ink(B.get(inkAt(jx, ya)), ln, lw * 1.5, { t0: 0.05, t1: 0.25, wn: 0.5, ph: jx });
        }
      }
      // grass clinging to the ledges
      if (o.grass) {
        for (let i = 2; i < nx; i += 3) {
          if (R() > o.grass) continue;
          const q = pts[i];
          if (!vis[i]) continue;
          OB.tuft(Pd, Pl, q[0], q[1] + 4, o.bandH(q[1]) * (0.18 + 0.2 * R()), 0.35, R, 0.3);
        }
      }
    });
    B.fill(ctx);
    ctx.fillStyle = css(C.rockHi, 0.55);
    ctx.fill(Ph);
    ctx.fillStyle = css(C.ink);
    ctx.fill(Pd);
    ctx.fillStyle = css(C.grassHi, 0.7);
    ctx.fill(Pl);
    ctx.restore();
  };

  // ------------------------------------------------------------------ block fields
  // Strata-like Voronoi blocks: rows of seeds in a dipping, gently folded bed frame.
  OB.blockField = (o) => {
    const R = OB.rng(o.seed), N = OB.noise(o.seed + 1);
    const seeds = [];
    const ca = Math.cos(o.dip), sa = Math.sin(o.dip);
    const [x0, y0, x1, y1] = o.bbox;
    for (let y = y0 - 60; y < y1 + 60;) {
      const s = o.size(y);
      const rowH = s * o.aspect * (0.75 + 0.5 * R());
      y += rowH;
      let x = x0 - 80 - R() * s;
      while (x < x1 + 80) {
        const fy = y + o.fold * N(x * 0.0025, y * 0.003) + (x - (x0 + x1) / 2) * Math.tan(o.dip);
        seeds.push([x + (R() - 0.5) * s * 0.3, fy + (R() - 0.5) * rowH * 0.35, s]);
        x += s * (0.65 + 0.9 * R());
      }
    }
    // Voronoi in the stretched bed frame -> wide flat blocks
    const k = 1 / o.aspect;
    const fw = (p) => { const u = p[0] * ca + p[1] * sa, v = -p[0] * sa + p[1] * ca; return [u, v * k]; };
    const bw = (p) => { const u = p[0], v = p[1] / k; return [u * ca - v * sa, u * sa + v * ca]; };
    const tp = seeds.map(fw);
    const tb = OB.bbox(tp);
    const cells = OB.voronoi(tp, [tb[0] - 50, tb[1] - 50, tb[2] + 50, tb[3] + 50]);
    return cells.map((c, i) => ({ poly: c.map(bw), seed: seeds[i], size: seeds[i][2] })).filter((c) => c.poly.length > 2);
  };

  // crest lookup: y of the top silhouette of a polygon region per x
  OB.crestLookup = (pts) => {
    const arr = new Float32Array(W + 1).fill(1e9);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const xa = Math.min(a[0], b[0]), xb = Math.max(a[0], b[0]);
      for (let x = Math.max(0, Math.ceil(xa)); x <= Math.min(W, Math.floor(xb)); x++) {
        const t = b[0] === a[0] ? 0 : (x - a[0]) / (b[0] - a[0]);
        const y = a[1] + (b[1] - a[1]) * t;
        if (y < arr[x]) arr[x] = y;
      }
    }
    return (x) => arr[Math.max(0, Math.min(W, Math.round(x)))];
  };

  // ------------------------------------------------------------------ grass
  OB.tuft = (Pd, Pl, x, y, size, lean, R, light = 0.3) => {
    const n = 5 + Math.floor(R() * 7);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + lean + (R() - 0.5) * 1.5;
      const L = size * (0.45 + 0.65 * R());
      const bend = (R() - 0.3) * 0.9 + lean;
      const pts = [];
      let px = x + (R() - 0.5) * size * 0.25, py = y;
      let aa = a;
      for (let k = 0; k <= 5; k++) {
        pts.push([px, py]);
        aa += bend * 0.12;
        px += (Math.cos(aa) * L) / 5;
        py += (Math.sin(aa) * L) / 5;
      }
      const ws = pts.map((p, k) => Math.max(0.2, size * 0.075 * (1 - k / 5.5)));
      OB.ribbon(R() < light ? Pl : Pd, pts, ws);
    }
  };

  // ------------------------------------------------------------------ the massif
  OB.drawMassif = (ctx, S) => {
    const M = S.massif, C = OB.C;
    const N = OB.noise(41), N2 = OB.noise(42), R = OB.rng(43);
    const crest = M.crest;
    // terrain: a slope rising to the crest, carved by spurs and gullies that run down it
    const persp = (y) => lerp(0.5, 2.0, smooth(1700, 3900, y));
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
    // the big light/shadow division: the main spur runs down from the summit; right of it
    // the mountain turns away from the sky-light
    const spurX = (y) => (y < 2600 ? lerp(1780, 1560, (y - 1750) / 850) : lerp(1560, 1380, (y - 2600) / 1300)) + 70 * N.fbm(y * 0.003, 2.2, 2);
    M.D = (x, y) => {
      const g = grad(x, y);
      const sh = smooth(-90, 140, x - spurX(y));
      return clamp(0.33 - 0.3 * Math.tanh(g[0] * 2.2) + 0.3 * sh + 0.12 * smooth(1400, 2150, x) + 0.12 * smooth(2000, 3800, y)
        - 0.14 * (1 - smooth(0, 120, y - crest(x))) + 0.05 * N.fbm(x * 0.01, y * 0.01, 2) - 0.55 * OB.warm(x, y, 'massif'));
    };
    OB.posterFill(ctx, M.path, M.bbox, M.D, C.massifTones, { step: 6, dither: 0.03 });

    // slope: streamlines along the terrain contours (V-shapes in the gullies)
    {
      const ang = (x, y) => { const g = grad(x, y); return Math.atan2(g[1], g[0]) + Math.PI / 2; };
      const sep = (x, y) => lerp(13, 3.0, M.D(x, y)) * persp(y) * 0.9;
      const lines = OB.streamlines({ inside: (x, y) => M.mask.inside(x, y) && y > crest(x) + 4, angle: ang, sep, bbox: M.bbox, step: 2.5, cell: 4, seed: 44, minLen: 16, maxSteps: 240, dtest: 0.5, seedGrid: 45 });
      const B = new OB.Batch();
      for (const L of lines) {
        const m = L[L.length >> 1];
        const d = M.D(m[0], m[1]);
        const ws = OB.inkWidths(L, lerp(0.6, 1.9, d) * lerp(0.9, 1.6, smooth(1800, 3800, m[1])), { t0: 0.25, t1: 0.3, wn: 0.4, ph: m[0] * 0.1 });
        OB.ribbon(B.get(OB.warmCss(C.ink, m[0], m[1], 'massif', 1)), L, ws);
      }
      B.fill(ctx);
    }
    // fall-line cross hatching in the shadowed gullies
    ctx.save();
    ctx.clip(M.path);
    OB.engrave(ctx, { bbox: [M.bbox[0], M.bbox[1], M.bbox[2], M.bbox[3]], angle: Math.PI / 2 + 0.12, sp: 4.2, D: (x, y) => M.D(x, y) - 0.5, thrRange: 0.5, w: 1.25, wmin: 0.35, levels: 8, colAt: (x, y) => OB.warmCss(C.ink, x, y, 'massif', 1), seed: 46, step: 4, wob: 1.2, warp: (u, v) => 18 * OB.N(u * 0.004, v * 0.01) });
    ctx.restore();
    // grass ticks on the slope, thicker in the gullies
    {
      const Pd = new Path2D(), Pl = new Path2D();
      for (let k = 0; k < 3400; k++) {
        const x = R() * W, y = 1720 + R() * 2100;
        if (!M.mask.inside(x, y) || y < crest(x) + 10) continue;
        if (N2.fbm(x * 0.004, y * 0.004, 2) < -0.1) continue;
        const sz = lerp(8, 30, smooth(1700, 3800, y)) * (0.6 + 0.6 * R());
        OB.tuft(Pd, Pl, x, y, sz, 0.35, R, 0.25);
      }
      ctx.fillStyle = css(C.ink);
      ctx.fill(Pd);
      ctx.fillStyle = css(C.grassHi, 0.6);
      ctx.fill(Pl);
    }

    {
      const P = new Path2D();
      OB.ink(P, M.crestPts, 4.2, { t0: 0, t1: 0, wn: 0.4, ph: 3 });
      ctx.fillStyle = css(C.ink);
      ctx.fill(P);
    }
    // rock outcrops: clusters of rounded strata blocks; cliffs under the summit and on the
    // shadowed right flank. Rocks may stand proud of the crest line.
    const field = OB.blockField({ seed: 45, dip: -0.1, aspect: 0.62, fold: 30, bbox: [M.bbox[0], M.bbox[1] - 60, M.bbox[2], M.bbox[3]], size: (y) => lerp(42, 230, Math.pow(smooth(1680, 3950, y), 0.9)) * (0.8 + 0.5 * OB.N(y * 0.01, 3)) });
    const rocky = (x, y) => N.fbm(x * 0.0019 + 11, y * 0.0024, 3) * 1.2 + 0.55 * smooth(1550, 1980, x) + 0.75 * (1 - smooth(0, 170, y - crest(x))) - 0.05;
    const clipP = new Path2D();
    const up = M.crestPts.map((q) => [q[0], q[1] - 42]);
    OB.path(up.concat([[2200, 3900], [-40, 3900]]), true, clipP);
    ctx.save();
    ctx.clip(clipP);
    let nb = 0;
    const cliffAt = (x, y) => x > 1530 + 120 * N(y * 0.003, 1) || y < crest(x) + 150;
    const cells = field.filter((c) => {
      const [sx, sy] = c.seed;
      if (!M.mask.inside(sx, sy + c.size * 0.25)) return false;
      const pd = S.pathDist(sx, sy);
      const near = 1 - smooth(pd.w * 0.5, pd.w * 1.4 + 26, pd.d - c.size * 0.35);
      const cliff = cliffAt(sx, sy);
      c.cliff = cliff;
      const rk = rocky(sx, sy) + (cliff ? 0.15 : -0.25) - 1.1 * near;
      if (rk < 0.32) return false;
      return cliff ? R() > 0.04 : R() > 0.45;
    });
    // cliff cells merge into continuous faces; the rest become loose boulders
    const face = new Path2D();
    for (const c of cells) {
      if (!c.cliff) continue;
      const [cx, cy] = OB.centroid(c.poly);
      const ex = c.poly.map((q) => [cx + (q[0] - cx) * 1.04, cy + (q[1] - cy) * 1.04]);
      OB.path(OB.roughen(ex, true, c.size * 0.035, 2.4 / c.size, nb++ % 997, Math.max(3, c.size * 0.03)), true, face);
    }
    OB.drawCliff(ctx, face, [M.bbox[0], M.bbox[1] - 60, M.bbox[2], M.bbox[3]], {
      D: (x, y) => clamp(M.D(x, y) + 0.04), dip: -0.08, fold: 34, seed: 47, tag: 'massif', tones: C.rockTones, olw: 2.6, grass: 0.12,
      bandH: (y) => lerp(26, 120, Math.pow(smooth(1680, 3900, y), 0.9)),
      strips: [[0, 2250, 2.6, 0.95], [2250, 2900, 3.3, 1.25], [2900, 4000, 4.4, 1.7]],
    });
    const loose = cells.filter((c) => !c.cliff).sort((a, b) => a.seed[1] - b.seed[1]);
    for (const c of loose) {
      const [sx, sy] = c.seed;
      const D = clamp(M.D(sx, sy) + 0.12 * R.norm() + 0.06);
      OB.drawRock(ctx, c.poly, {
        D, dip: -0.1 + 0.25 * N(sx * 0.002, sy * 0.002), size: c.size, kind: 'boulder', tones: C.rockTones, tag: 'massif', seed: 1000 + nb,
        sp: lerp(2.4, 5.2, smooth(1700, 3900, sy)), lw: lerp(0.85, 1.9, smooth(1700, 3900, sy)),
      });
      nb++;
    }
    ctx.restore();
    S.massifBlocks = nb;
  };

  // ------------------------------------------------------------------ the path
  OB.buildPath = (S) => {
    const v = S.pathVerts;
    let pts = OB.chaikin(v, 4, false);
    pts = OB.resample(pts, 3, false);
    // smooth tangents
    const n = pts.length;
    const out = [];
    let pnx = 0, pny = 1;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 2)], b = pts[Math.min(n - 1, i + 2)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const l = Math.hypot(tx, ty) || 1;
      tx /= l; ty /= l;
      let nx = -ty, ny = tx;
      if (i === 0) { if (ny < 0) { nx = -nx; ny = -ny; } } else if (nx * pnx + ny * pny < 0) { nx = -nx; ny = -ny; }
      pnx = nx; pny = ny;
      out.push({ x: pts[i][0], y: pts[i][1], w: pts[i][2], tx, ty, nx, ny });
    }
    S.path = out;
    // distance query (coarse grid of path points)
    const cell = 40, gw = Math.ceil(W / cell) + 1, gh = Math.ceil(H / cell) + 2;
    const grid = new Array(gw * gh);
    out.forEach((p, i) => {
      if (i % 2) return;
      const k = Math.max(0, Math.min(gh - 1, Math.floor(p.y / cell))) * gw + Math.max(0, Math.min(gw - 1, Math.floor(p.x / cell)));
      (grid[k] || (grid[k] = [])).push(i);
    });
    S.pathDist = (x, y) => {
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      let bd = Infinity, bw = 60;
      for (let r = 0; r < 12; r++) {
        for (let j = cy - r; j <= cy + r; j++) for (let i = cx - r; i <= cx + r; i++) {
          if (Math.max(Math.abs(j - cy), Math.abs(i - cx)) !== r || i < 0 || j < 0 || i >= gw || j >= gh) continue;
          const a = grid[j * gw + i];
          if (!a) continue;
          for (const q of a) { const p = out[q]; const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; bw = p.w; } }
        }
        if (bd < r * cell) break;
      }
      return { d: bd, w: bw };
    };
  };

  OB.drawPath = (ctx, S) => {
    const C = OB.C, R = OB.rng(71), N = OB.noise(72);
    const pp = S.path;
    const n = pp.length;
    // consistent left/right edges; "down" weight says which one is the downhill lip
    const Le = [], Re = [], dw = [];
    for (const p of pp) {
      Le.push([p.x - p.nx * p.w * 0.5, p.y - p.ny * p.w * 0.5]);
      Re.push([p.x + p.nx * p.w * 0.5, p.y + p.ny * p.w * 0.5]);
      dw.push(smooth(-0.3, 0.3, p.ny)); // 1: right edge is downhill
    }
    const flat = pp.map((p) => Math.pow(Math.abs(p.tx), 1.6));
    const depth = (y) => smooth(1800, 3800, y);
    const dnPt = (i) => (dw[i] > 0.5 ? Re[i] : Le[i]);
    const upPt = (i) => (dw[i] > 0.5 ? Le[i] : Re[i]);
    // 1) retaining wall under the downhill edge (pieces never straddle a side flip)
    {
      const Pw = new Path2D();
      const B = new OB.Batch();
      let piece = [];
      const flush = () => {
        if (piece.length > 2) {
          const top = piece.map((i) => dnPt(i)), bot = piece.map((i) => [dnPt(i)[0], dnPt(i)[1] + pp[i].w * 0.26 * flat[i]]);
          OB.path(top.concat(bot.slice().reverse()), true, Pw);
          // joints and a course line
          let acc = 0, L = pp[piece[0]].w * 0.35;
          for (let k = 1; k < piece.length; k++) {
            const i = piece[k];
            const h = pp[i].w * 0.26 * flat[i];
            const q = top[k];
            acc += OB.dist(top[k], top[k - 1]);
            const key = OB.warmCss(C.ink, q[0], q[1], 'path', 1);
            if (acc > L && h > 3) {
              acc = 0;
              L = pp[i].w * (0.22 + 0.3 * R());
              const half = R() < 0.5;
              OB.ribbon(B.get(key), half ? [[q[0], q[1] + h * 0.5], [q[0] + 0.6, q[1] + h]] : [[q[0], q[1]], [q[0] + 0.6, q[1] + h * 0.5]], [1 + pp[i].w * 0.008, 1 + pp[i].w * 0.008]);
            }
            if (k % 3 === 0 && h > 3) OB.ribbon(B.get(key), [[q[0], q[1] + h * 0.5], [top[k - 1][0], top[k - 1][1] + h * 0.5]], [0.9, 0.9]);
            if (k % 2 === 0 && h > 3 && OB.warm(q[0], q[1], 'path') < 0.3) OB.ribbon(B.get(css(C.ink, 0.75)), [[q[0], q[1] + h * 0.2], [q[0] + 0.4, q[1] + h]], [0.8, 0.8]);
          }
          const Pb = B.get(css(C.ink));
          OB.ink(Pb, bot, lerp(1.6, 3.4, depth(bot[0][1])), { t0: 0.05, t1: 0.05, wn: 0.5 });
        }
        piece = [];
      };
      for (let i = 0; i < n; i++) {
        if (flat[i] < 0.05 || (piece.length && (dw[i] > 0.5) !== (dw[piece[0]] > 0.5)) || piece.length > 40) {
          const last = piece.length ? piece[piece.length - 1] : -1;
          flush();
          if (flat[i] >= 0.05 && last === i - 1) piece.push(i - 1);
        }
        if (flat[i] >= 0.05) piece.push(i);
      }
      flush();
      ctx.save();
      ctx.translate(OB.MR[0], OB.MR[1]);
      ctx.fillStyle = css(C.wall);
      ctx.fill(Pw);
      ctx.restore();
      B.fill(ctx);
    }
    // 2) cut bank above the uphill edge: short dark ticks
    {
      const B = new OB.Batch();
      for (let i = 0; i < n; i += 2) {
        const p = pp[i];
        const h = p.w * 0.2 * flat[i];
        if (h < 2) continue;
        const q = upPt(i);
        const key = OB.warmCss(C.ink, q[0], q[1], 'path', 1);
        const L = h * (0.5 + 0.7 * R());
        OB.ribbon(B.get(key), [[q[0], q[1] - L], [q[0] + (R() - 0.5) * 2, q[1] - L * 0.4], [q[0], q[1]]], [0.2, 0.9 + p.w * 0.008, 1.1 + p.w * 0.01]);
      }
      B.fill(ctx);
    }
    // 3) surface
    const Pf = new Path2D();
    {
      ctx.save();
      ctx.translate(OB.MR[0], OB.MR[1]);
      for (let i = 0; i < n - 1; i += 5) {
        const j = Math.min(n - 1, i + 6);
        const poly = Le.slice(i, j + 1).concat(Re.slice(i, j + 1).reverse());
        OB.path(poly, true, Pf);
        const p = pp[Math.min(n - 1, i + 3)];
        const wm = OB.warm(p.x, p.y, 'path');
        ctx.fillStyle = css(mix(mix(C.pathFill, C.pathShade, 0.75 * smooth(2900, 3850, p.y)), C.pathWarm, Math.min(1, wm * 1.15)));
        ctx.fill(OB.path(poly));
      }
      // shaded band under the bank
      for (let i = 0; i < n - 1; i += 5) {
        const j = Math.min(n - 1, i + 6);
        if (flat[i] < 0.1 || (dw[i] > 0.5) !== (dw[j] > 0.5)) continue;
        const a = [], b = [];
        for (let k = i; k <= j; k++) {
          const u = upPt(k), d = dnPt(k);
          const f = 0.3 * flat[k];
          a.push(u);
          b.push([u[0] + (d[0] - u[0]) * f, u[1] + (d[1] - u[1]) * f]);
        }
        const p = pp[i];
        const wm = OB.warm(p.x, p.y, 'path');
        ctx.fillStyle = css(mix(C.pathShade, C.pathWarm, Math.min(1, wm * 0.8)));
        ctx.fill(OB.path(a.concat(b.reverse())));
      }
      ctx.restore();
    }
    ctx.save();
    ctx.clip(Pf);
    {
      // lines along the path: ruts and edge shading
      const B = new OB.Batch();
      const offs = [-0.44, -0.38, -0.32, -0.15, 0.02, 0.16, 0.3, 0.37, 0.44];
      offs.forEach((f, k) => {
        const line = pp.map((p) => {
          const ff = f + 0.03 * N(p.x * 0.01, k * 3);
          return [p.x + p.nx * p.w * ff, p.y + p.ny * p.w * ff];
        });
        const edge = Math.abs(f) > 0.33;
        for (let i = 0; i < n; i += 40) {
          const seg = line.slice(i, Math.min(n, i + 41));
          const m = seg[seg.length >> 1];
          OB.runs(B.get(OB.warmCss(C.ink, m[0], m[1], 'path', 1, edge ? 0.85 : 0.55)), seg, (q) => (edge ? 1.2 : 0.85) * lerp(0.6, 2.2, depth(seg[q][1])), (q) => N(seg[q][0] * 0.008 + k * 5, seg[q][1] * 0.008) > (edge ? -0.35 : 0.2), 3);
        }
      });
      B.fill(ctx);
      // transverse step edges where the path climbs toward the viewer, and near the top
      const Bs = new OB.Batch();
      let acc = 0;
      for (let i = 0; i < n; i++) {
        const p = pp[i];
        const steep = 1 - flat[i];
        const nearTop = i > n - 40;
        if (steep < 0.5 && !nearTop) { acc = 0; continue; }
        acc += 3;
        const gap = p.w * (nearTop ? 0.3 : 0.24) * (0.8 + 0.4 * OB.hash(i, 3));
        if (acc < gap) continue;
        acc = 0;
        const a = Le[i], b = Re[i];
        const key = OB.warmCss(C.ink, p.x, p.y, 'path', 1);
        const ln = OB.wline(a[0], a[1], b[0], b[1], 6, 0.9 + p.w * 0.006, i);
        OB.ink(Bs.get(key), ln, lerp(1.0, 3.6, depth(p.y)), { t0: 0.12, t1: 0.12, wn: 0.45, ph: i });
        const ln2 = ln.map((q) => [q[0], q[1] + p.w * 0.04]);
        OB.ink(Bs.get(css(C.ink, 0.45)), ln2, lerp(0.8, 2.6, depth(p.y)), { t0: 0.2, t1: 0.2, wn: 0.6, ph: i + 1 });
        // stone joints within the step
        const nj = Math.floor(p.w / 70) + 1;
        for (let k = 0; k < nj; k++) {
          const t = (k + 0.3 + 0.4 * OB.hash(i, k)) / (nj + 0.2);
          const q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
          OB.ink(Bs.get(key), [q, [q[0] + 1, q[1] + gap * 0.9]], lerp(0.8, 2.2, depth(p.y)), { t0: 0.2, t1: 0.2 });
        }
      }
      Bs.fill(ctx);
      // gravel stipple + pebbles
      const Pg = new Path2D(), Pp = new Path2D();
      for (let i = 0; i < n; i += 1) {
        const p = pp[i];
        const cnt = p.w * 0.07;
        for (let k = 0; k < cnt; k++) {
          if (R() > 0.5) continue;
          const f = (R() - 0.5) * 0.95;
          const x = p.x + p.nx * p.w * f + (R() - 0.5) * 3, y = p.y + p.ny * p.w * f + (R() - 0.5) * 3;
          const r = (0.5 + R() * 0.9) * lerp(0.8, 2, depth(y));
          Pg.moveTo(x + r, y);
          Pg.arc(x, y, r, 0, OB.TAU);
          if (R() < 0.012) {
            const rr = r * (2 + R() * 2);
            Pp.moveTo(x + rr, y);
            Pp.ellipse(x, y, rr, rr * 0.55, (R() - 0.5) * 0.6, 0, OB.TAU);
          }
        }
      }
      ctx.fillStyle = css(C.ink, 0.5);
      ctx.fill(Pg);
      ctx.fillStyle = css(C.pathHi, 0.45);
      ctx.fill(Pp);
      ctx.strokeStyle = css(C.ink, 0.8);
      ctx.lineWidth = 1.1;
      ctx.stroke(Pp);
    }
    ctx.restore();
    // 4) edges: thin uphill, heavy downhill lip with a pale highlight
    {
      const B = new OB.Batch();
      const Ph = new Path2D();
      for (const [E, side] of [[Le, 0], [Re, 1]]) {
        for (let i = 0; i < n - 1; i += 40) {
          const seg = E.slice(i, Math.min(n, i + 41));
          const m = seg[seg.length >> 1];
          const ws = seg.map((q, k) => {
            const ii = i + k, down = side ? dw[ii] : 1 - dw[ii];
            return lerp(lerp(1.2, 3.2, depth(q[1])), lerp(2.4, 5.4, depth(q[1])), down) * (1 + 0.35 * OB.N(ii * 0.05, side * 7));
          });
          OB.ribbon(B.get(OB.warmCss(C.ink, m[0], m[1], 'path', 1)), seg, ws);
          const hl = seg.map((q, k) => { const p = pp[i + k], sg = side ? -1 : 1; return [q[0] + p.nx * sg * 3.5, q[1] + p.ny * sg * 3.5]; });
          OB.runs(Ph, hl, () => 1.1, (k) => (side ? dw[i + k] : 1 - dw[i + k]) > 0.7 && flat[i + k] > 0.2 && N(hl[k][0] * 0.01, i) > -0.1, 3);
        }
      }
      B.fill(ctx);
      ctx.fillStyle = css(C.pathHi, 0.65);
      ctx.fill(Ph);
    }
    // 5) grass and small stones crowding the edges, half hiding the lip
    {
      const Pd = new Path2D(), Pl = new Path2D(), Ps = new Path2D();
      for (let i = 0; i < n; i += 3) {
        const p = pp[i];
        if (R() < 0.55) continue;
        const E = R() < 0.6 ? dnPt(i) : upPt(i);
        const sz = p.w * (0.18 + 0.2 * R());
        OB.tuft(Pd, Pl, E[0] + (R() - 0.5) * 6, E[1] + (R() - 0.2) * 5, sz, 0.35, R, 0.3);
        if (R() < 0.1) {
          const r = p.w * (0.04 + 0.05 * R());
          Ps.moveTo(E[0] + r, E[1]);
          Ps.ellipse(E[0], E[1], r, r * 0.65, 0, 0, OB.TAU);
        }
      }
      ctx.fillStyle = css(C.wall);
      ctx.fill(Ps);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = css(C.ink);
      ctx.stroke(Ps);
      ctx.fillStyle = css(C.ink);
      ctx.fill(Pd);
      ctx.fillStyle = css(C.grassHi, 0.65);
      ctx.fill(Pl);
    }
  };

  // ------------------------------------------------------------------ lanterns
  OB.drawLantern = (ctx, L) => {
    const C = OB.C, s = L.s;
    const x = L.x, y = L.y;
    const P = new Path2D();
    // post
    OB.ink(P, [[x, y + 2], [x + 0.6 * s, y - 20 * s], [x, y - 40 * s]], 3.2 * s, { t0: 0, t1: 0, wn: 0.2 });
    // bracket arm
    OB.ink(P, [[x, y - 38 * s], [x + 9 * s, y - 40 * s], [x + 12 * s, y - 36 * s]], 1.8 * s, { t0: 0, t1: 0, wn: 0.2 });
    ctx.fillStyle = css(C.ink);
    ctx.fill(P);
    const lx = x + 12 * s, ly = y - 26 * s;
    // glass box
    ctx.fillStyle = css(C.amberHot);
    ctx.beginPath();
    ctx.moveTo(lx - 5 * s, ly - 7 * s);
    ctx.lineTo(lx + 5 * s, ly - 7 * s);
    ctx.lineTo(lx + 4 * s, ly + 6 * s);
    ctx.lineTo(lx - 4 * s, ly + 6 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = css([255, 248, 225]);
    ctx.beginPath();
    ctx.ellipse(lx, ly, 2 * s, 3.2 * s, 0, 0, OB.TAU);
    ctx.fill();
    // frame, roof, ring
    ctx.strokeStyle = css(C.ink);
    ctx.lineWidth = 1.3 * s;
    ctx.beginPath();
    ctx.moveTo(lx - 5 * s, ly - 7 * s); ctx.lineTo(lx - 4 * s, ly + 6 * s);
    ctx.moveTo(lx + 5 * s, ly - 7 * s); ctx.lineTo(lx + 4 * s, ly + 6 * s);
    ctx.moveTo(lx, ly - 7 * s); ctx.lineTo(lx, ly + 6 * s);
    ctx.stroke();
    ctx.fillStyle = css(C.ink);
    ctx.beginPath();
    ctx.moveTo(lx - 7.5 * s, ly - 6.5 * s);
    ctx.lineTo(lx, ly - 13 * s);
    ctx.lineTo(lx + 7.5 * s, ly - 6.5 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(lx - 5 * s, ly + 5.5 * s, 10 * s, 2.2 * s);
    L.lx = lx; L.ly = ly;
  };
  OB.lanternGlow = (ctx, L) => {
    const C = OB.C, s = L.s;
    OB.glow(ctx, L.lx, L.ly, 120 * s, C.amber, 0.28);
    OB.glow(ctx, L.lx, L.ly, 34 * s, C.amberHot, 0.5);
    // engraved rays
    const P = new Path2D();
    const R = OB.rng(Math.round(L.x));
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * OB.TAU + R() * 0.2;
      const r0 = 12 * s, r1 = (18 + 14 * R()) * s;
      OB.ribbon(P, [[L.lx + Math.cos(a) * r0, L.ly + Math.sin(a) * r0], [L.lx + Math.cos(a) * r1, L.ly + Math.sin(a) * r1]], [0.9 * s, 0.1]);
    }
    ctx.fillStyle = css(C.amberHot, 0.4);
    ctx.fill(P);
  };

  // ------------------------------------------------------------------ foreground outcrop
  OB.drawForeground = (ctx, S) => {
    const C = OB.C, R = OB.rng(81), N = OB.noise(82);
    for (const F of S.fg) {
      const D = (x, y) => clamp(F.d0 + 0.3 * smooth(2950, 3840, y) + 0.16 * N.fbm(x * 0.002, y * 0.002, 3) + (F.side === 'L' ? 0.2 * (1 - smooth(0, 600, x)) : 0.2 * smooth(1600, 2160, x)) - 0.5 * OB.warm(x, y, 'fg'));
      const mask = OB.mask((g) => g.fill(F.path), 0.5);
      OB.drawCliff(ctx, F.path, F.bbox, {
        D, dip: F.dip * 0.6, fold: 40, seed: 90 + F.seed, tag: 'fg', tones: C.fgTones, olw: 4.5, grass: 0.22,
        bandH: (y) => lerp(80, 170, smooth(2850, 3840, y)),
        strips: [[0, 3250, 4.0, 1.6], [3250, 4000, 5.2, 2.1]],
      });
      // rocks and boulders, back to front
      const field = OB.blockField({ seed: F.seed, dip: F.dip, aspect: F.aspect, fold: 50, bbox: [F.bbox[0], F.bbox[1] - 60, F.bbox[2], F.bbox[3]], size: (y) => lerp(F.size[0], F.size[1], smooth(F.bbox[1], 3840, y)) * (0.75 + 0.5 * OB.N(y * 0.01, F.seed)) });
      const clipP = OB.path(F.top.map((q) => [q[0], q[1] - 55]).concat(F.poly.slice(F.top.length)));
      ctx.save();
      ctx.clip(clipP);
      let k = 0;
      const rocks = [];
      const cells = field.filter((c) => {
        const [sx, sy] = c.seed;
        if (!mask.inside(sx, sy + c.size * 0.2)) return false;
        if (N(sx * 0.0028 + F.seed, sy * 0.0028) < 0.05) return false;
        const pd = S.pathDist(sx, sy);
        return pd.d > pd.w * 0.5 + c.size * 0.3;
      }).sort((a, b) => a.seed[1] - b.seed[1]);
      for (const c of cells) {
        const [sx, sy] = c.seed;
        const d = clamp(D(sx, sy) + 0.12 * R.norm());
        const rp = OB.drawRock(ctx, c.poly, { D: d, dip: F.dip + 0.18 * N(sx * 0.002, sy * 0.002), size: c.size, kind: 'boulder', tones: C.fgTones, tag: 'fg', seed: 5000 + F.seed * 100 + k, sp: lerp(4.2, 7, smooth(2900, 3840, sy)), lw: lerp(1.5, 2.5, smooth(2900, 3840, sy)), olw: 1.3 });
        if (rp) rocks.push({ p: rp, size: c.size });
        k++;
      }
      ctx.restore();
      // grass in the cracks and along the top edge
      {
        const Pd = new Path2D(), Pl = new Path2D();
        for (const c of rocks) {
          if (R() < 0.35) continue;
          const poly = c.p;
          // pick a low vertex (bottom of a block): grass grows in the joint beneath
          let lo = poly[0];
          for (const p of poly) if (p[1] > lo[1]) lo = p;
          if (!mask.inside(lo[0], lo[1] - 4)) continue;
          const nt = 1 + Math.floor(R() * 3);
          for (let t = 0; t < nt; t++) OB.tuft(Pd, Pl, lo[0] + (R() - 0.5) * c.size * 0.5, lo[1] - R() * 6, lerp(30, 70, smooth(2900, 3840, lo[1])) * (0.6 + 0.6 * R()), 0.4, R, 0.3);
        }
        const top = F.top;
        for (let t = 0; t < top.length; t += 3) {
          const p = top[t];
          if (R() < 0.5 || p[1] > 3700) continue;
          OB.tuft(Pd, Pl, p[0], p[1] + 6, lerp(26, 60, smooth(2800, 3840, p[1])) * (0.6 + 0.7 * R()), 0.45, R, 0.35);
        }
        ctx.fillStyle = css(C.ink);
        ctx.fill(Pd);
        ctx.fillStyle = css(C.grassHi, 0.85);
        ctx.fill(Pl);
      }
    }
  };
})();
