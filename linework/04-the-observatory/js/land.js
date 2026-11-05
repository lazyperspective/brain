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
    // gullies: dark runnels falling from the notches in the ridge, shaded on their lee side
    {
      const R = OB.rng(sp.seed + 31);
      const Pg = new Path2D(), Pt = new Path2D();
      const starts = [];
      for (let x = 20; x < W - 20; x += 3) {
        const y = sky(x);
        if (y > sky(x - 18) + 2 && y > sky(x + 18) + 2 && (!starts.length || x - starts[starts.length - 1] > 40)) starts.push(x);
      }
      for (let k = 0; k < 14; k++) starts.push(R() * W);
      for (const sx of starts) {
        let x = sx, y = sky(sx) + 3;
        const L = (sp.bottom - y) * (0.25 + 0.5 * R());
        const pts = [[x, y]];
        let pa = Math.PI / 2;
        for (let d = 0; d < L; d += 3) {
          let a = angle(x, y);
          if (Math.cos(a - pa) < 0) a += Math.PI;
          a = a * 0.6 + pa * 0.4 + (R() - 0.5) * 0.3;
          pa = a;
          x += Math.cos(a) * 3; y += Math.sin(a) * 3;
          if (!mask.inside(x, y)) break;
          pts.push([x, y]);
        }
        if (pts.length < 5) continue;
        const ww = lerp(sp.lw[0], sp.lw[1], 0.7) * 1.5;
        OB.ink(Pg, pts, ww, { t0: 0.05, t1: 0.6, wn: 0.5, ph: sx });
        for (let i = 2; i < pts.length - 2; i += 2) {
          const q = pts[i], a = Math.atan2(pts[i + 1][1] - pts[i - 1][1], pts[i + 1][0] - pts[i - 1][0]);
          const tl = (4 + 5 * R()) * (1 - i / pts.length) + 2;
          OB.ribbon(Pt, [[q[0] + 1, q[1]], [q[0] + Math.cos(a + 0.9) * tl + 1, q[1] + Math.sin(a + 0.9) * tl]], [ww * 0.55, 0.15]);
        }
      }
      ctx.fillStyle = sp.crestCss;
      ctx.fill(Pg);
      ctx.fillStyle = sp.lineCss;
      ctx.fill(Pt);
    }
    // spurs: arêtes running down from each summit, with a few side ticks on the lee side
    {
      const R = OB.rng(sp.seed + 51);
      const P = new Path2D();
      for (const pk of sp.peaks) {
        let tx = pk.x, ty = 1e9;
        for (let x = pk.x - 60; x <= pk.x + 60; x += 3) { const y = sky(x); if (y < ty) { ty = y; tx = x; } }
        if (tx < -40 || tx > W + 40) continue;
        const ns = 2 + Math.floor(R() * 3);
        for (let k = 0; k < ns; k++) {
          const side = k % 2 ? 1 : -1;
          let a = Math.PI / 2 + side * (0.45 + 0.5 * R());
          let x = tx + side * (4 + 20 * R()), y = Math.max(sky(x) + 4, ty + 6);
          const L = pk.h * (0.45 + 0.6 * R());
          const pts = [[x, y]];
          for (let d = 0; d < L; d += 3) {
            a += (R() - 0.5) * 0.35 + (Math.PI / 2 - a) * 0.025;
            x += Math.cos(a) * 3; y += Math.sin(a) * 3;
            if (!mask.inside(x, y) || y < sky(x) + 2) break;
            pts.push([x, y]);
          }
          if (pts.length < 5) continue;
          const ww = lerp(sp.lw[0], sp.lw[1], 0.8) * 1.3;
          OB.runs(P, pts, (i) => ww * (1 - 0.6 * i / pts.length), (i) => OB.N(i * 0.08 + k * 3, pk.x * 0.01) > -0.45, 3);
          for (let i = 3; i < pts.length - 2; i += 3) {
            const q = pts[i];
            if (R() < 0.4) continue;
            const ta = Math.PI / 2 + 0.3 * side, tl = (3 + 6 * R()) * (1 - i / pts.length) + 2;
            OB.ribbon(P, [[q[0], q[1]], [q[0] + Math.cos(ta) * tl, q[1] + Math.sin(ta) * tl]], [ww * 0.6, 0.15]);
          }
        }
      }
      ctx.fillStyle = sp.lineCss;
      ctx.fill(P);
    }
    // rock faces on the upper slopes: short broken strata dashes, denser in shade
    {
      const R = OB.rng(sp.seed + 41);
      const P = new Path2D();
      const nr = Math.round(W * 3);
      for (let k = 0; k < nr; k++) {
        const x = R() * W, y0 = sky(x);
        const p = peakAt(sp, sky, x);
        const y = y0 + 4 + R() * Math.max(10, (sp.base - y0) * 0.9 + 30);
        if (!mask.inside(x, y)) continue;
        const d = D(x, y);
        if (R() > 0.15 + 0.85 * smooth(sp.dLit, sp.dShadow, d)) continue;
        const L = 4 + 9 * R(), tilt = 0.25 * Math.sign(x - p.x) + (R() - 0.5) * 0.3;
        OB.ribbon(P, [[x, y], [x + L * 0.5 * Math.cos(tilt), y + L * 0.5 * Math.sin(tilt)], [x + L * Math.cos(tilt), y + L * Math.sin(tilt)]], [0.3, lerp(sp.lw[0], sp.lw[1], 0.5) * 1.3, 0.2]);
      }
      ctx.fillStyle = sp.lineCss;
      ctx.fill(P);
    }
    // crest line
    const crest = OB.roughen(top, false, 1.2, 0.05, sp.seed, 4);
    const P = new Path2D();
    OB.ink(P, crest, sp.crestW, { t0: 0, t1: 0, wn: 0.45, ph: sp.seed });
    ctx.fillStyle = sp.crestCss;
    ctx.fill(P);
    // forests: tiny tiered pines, clumped, thickening down the slopes, with a few pale tips
    if (sp.trees) {
      const R = OB.rng(sp.seed + 9);
      const T = new Path2D(), Tl = new Path2D();
      const items = [];
      for (let k = 0; k < sp.trees.n; k++) {
        const x = R() * W;
        const y0 = sky(x);
        const y = y0 + (sp.trees.top || 8) + R() * sp.trees.depth;
        if (!mask.inside(x, y) || N.fbm(x * 0.004, y * 0.004, 2) < (sp.trees.cut === undefined ? 0.05 : sp.trees.cut)) continue;
        const h = sp.trees.h * (0.6 + 0.6 * R()) * lerp(1, 1.4, (y - y0) / sp.trees.depth);
        items.push([x, y, h]);
      }
      items.sort((a, b) => a[1] - b[1]);
      for (const [x, y, h] of items) {
        OB.pineMark(T, x, y, h, R);
        if (R() < 0.25) OB.ribbon(Tl, [[x - h * 0.02, y - h * 0.95], [x - h * 0.16, y - h * 0.6]], [0.2, Math.max(0.5, h * 0.05)]);
      }
      ctx.fillStyle = sp.crestCss;
      ctx.fill(T);
      ctx.fillStyle = sp.lineCss;
      ctx.fill(Tl);
    }
  };
  // a tiny conifer silhouette: a spire with three ragged tiers and a trunk stub
  OB.pineMark = (P, x, y, h, R) => {
    const j = () => (R() - 0.5) * h * 0.05;
    const pts = [[x + j(), y - h], [x + h * 0.15 + j(), y - h * 0.66], [x + h * 0.06, y - h * 0.64], [x + h * 0.25 + j(), y - h * 0.33], [x + h * 0.08, y - h * 0.31], [x + h * 0.33 + j(), y - h * 0.05], [x + h * 0.05, y - h * 0.06], [x + h * 0.05, y + h * 0.08], [x - h * 0.05, y + h * 0.08], [x - h * 0.05, y - h * 0.06], [x - h * 0.31 + j(), y - h * 0.04], [x - h * 0.08, y - h * 0.31], [x - h * 0.24 + j(), y - h * 0.34], [x - h * 0.06, y - h * 0.64], [x - h * 0.14 + j(), y - h * 0.67]];
    OB.path(pts, true, P);
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

  // ------------------------------------------------------------------ valley floor
  // Fields in horizontal strokes, a lake with rippled line hatching and amber reflections, a
  // river glinting in from behind the massif, a pale road thread, and a village of small
  // dark houses with warm windows and a squat bell tower.
  OB.drawValley = (ctx, S) => {
    const V = S.valley, C = OB.C, R = OB.rng(61), N = OB.noise(62);
    // floor
    const floorTop = (x) => V.y0 + 10 * N(x * 0.006, 1) + 6 * N(x * 0.02, 2);
    const fl = [];
    for (let x = -30; x <= V.x1 + 40; x += 6) fl.push([x, floorTop(x)]);
    const floor = OB.path(fl.concat([[V.x1 + 40, V.y1], [-30, V.y1]]));
    OB.flatFill(ctx, floor, css(C.valleyFloor));
    ctx.save();
    ctx.clip(floor);
    OB.engrave(ctx, { bbox: [-30, V.y0 - 20, V.x1 + 40, V.y1], angle: 0.01, sp: 3.4, D: (x, y) => 0.35 + 0.35 * smooth(V.y0, V.y1, y) + 0.2 * N.fbm(x * 0.004, y * 0.02, 2), w: 1.1, levels: 8, col: css(C.rangeInk3, 0.85), wob: 0.8, seed: 63, step: 4 });
    // field patchwork: strips of parcels, each worked in its own way (ploughed lines, rows of
    // crops, orchards, rough pasture), bounded by hedgerows of dotted shrubs
    const Ph = new Path2D(), Pfl = new Path2D(), Pdot = new Path2D();
    for (let yA = V.y0 + 4; yA < V.y1;) {
      const rh = lerp(6, 17, smooth(V.y0, V.y1, yA)) * (0.8 + 0.4 * R());
      const yB = yA + rh;
      for (let xA = -30 + R() * 20; xA < V.x1 + 40;) {
        const pw = rh * (2.4 + 4.5 * R()), xB = xA + pw;
        const kind = R(), sk = (R() - 0.5) * 0.5;
        if (kind < 0.3) {
          for (let yy = yA + 1.5; yy < yB - 1; yy += 1.9 + 0.6 * R()) OB.ribbon(Pfl, [[xA + 1.5, yy], [xB - 1.5, yy + sk]], [0.65, 0.65]);
        } else if (kind < 0.52) {
          const dir = R() < 0.5 ? 1 : -1;
          for (let xx = xA + 2; xx < xB - 2; xx += 2.6) OB.ribbon(Pfl, [[xx, yB - 1], [Math.min(xB - 1, Math.max(xA + 1, xx + dir * rh * 0.5)), yA + 1]], [0.6, 0.5]);
        } else if (kind < 0.68) {
          for (let yy = yA + 2; yy < yB - 1; yy += 2.8) for (let xx = xA + 2 + (yy % 2); xx < xB - 1; xx += 3.4) OB.dot(Pdot, xx, yy, 0.7 + 0.4 * R());
        } else {
          const nd = Math.floor(pw * rh * 0.05);
          for (let k = 0; k < nd; k++) OB.dot(Pdot, xA + R() * pw, yA + R() * rh, 0.4 + 0.4 * R());
        }
        if (R() < 0.7) for (let xx = xA; xx < xB; xx += 1.6 + R()) if (OB.hash(Math.round(xx * 3), Math.round(yB)) < 0.75) OB.dot(Ph, xx, yB + 0.8 * OB.N(xx * 0.2, yB), 0.9 + 0.7 * R());
        if (R() < 0.45) for (let yy = yA; yy < yB; yy += 1.5) OB.dot(Ph, xB + 0.6 * OB.N(yy * 0.3, xB), yy, 0.8 + 0.5 * R());
        xA = xB;
      }
      yA = yB;
    }
    ctx.fillStyle = css(C.rangeInk3, 0.8);
    ctx.fill(Pfl);
    ctx.fill(Pdot);
    ctx.fillStyle = css(C.ink);
    ctx.fill(Ph);
    // lake
    const lk = V.lake;
    const shore = [];
    for (let a = 0; a < OB.TAU; a += 0.05) {
      const r = 1 + 0.12 * N(Math.cos(a) * 1.5, Math.sin(a) * 1.5) + 0.05 * N(a * 5, 3);
      shore.push([lk.x + Math.cos(a) * lk.rx * r, lk.y + Math.sin(a) * lk.ry * r]);
    }
    const lake = OB.path(shore);
    OB.flatFill(ctx, lake, css(C.water));
    ctx.save();
    ctx.clip(lake);
    OB.engrave(ctx, { bbox: [lk.x - lk.rx * 1.3, lk.y - lk.ry * 1.4, lk.x + lk.rx * 1.3, lk.y + lk.ry * 1.4], angle: 0, sp: 2.6, D: (x, y) => 0.25 + 0.4 * smooth(lk.y - lk.ry, lk.y + lk.ry, y), w: 1.0, levels: 8, col: css(C.waterLine, 0.85), wob: 0.5, seed: 64, step: 3 });
    // ripples: dark troughs and pale crests in short broken dashes, finer toward the far shore
    const Pg = new Path2D(), Prd = new Path2D();
    for (let k = 0; k < 420; k++) {
      const x = lk.x + (R() - 0.5) * lk.rx * 2.1, y = lk.y + (R() - 0.5) * lk.ry * 2.1;
      const f = smooth(lk.y - lk.ry, lk.y + lk.ry, y);
      const L = (3 + R() * 10) * (0.6 + 0.8 * f);
      if (R() < 0.4) OB.ink(Pg, [[x, y], [x + L * 0.5, y - 0.4], [x + L, y]], 0.6 + 0.5 * f, { t0: 0.3, t1: 0.3 });
      else OB.ink(Prd, [[x, y], [x + L * 0.5, y + 0.5], [x + L, y]], 0.7 + 0.7 * f, { t0: 0.3, t1: 0.3 });
    }
    ctx.fillStyle = css(C.rangeInk3, 0.55);
    ctx.fill(Prd);
    ctx.fillStyle = css(C.trailCream, 0.42);
    ctx.fill(Pg);
    ctx.restore();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = css(C.rangeInk3);
    ctx.stroke(lake);
    // river winding in from the right
    const rv = OB.spline(V.river, 4);
    const rws = rv.map((p, i) => lerp(V.riverW[0], V.riverW[1], i / (rv.length - 1)));
    const Pr = new Path2D();
    OB.ribbon(Pr, rv, rws);
    ctx.fillStyle = css(C.water);
    ctx.fill(Pr);
    const Prl = new Path2D();
    OB.runs(Prl, rv, (i) => rws[i] * 0.3, (i) => OB.N(i * 0.2, 4) > -0.2, 3);
    ctx.fillStyle = css(C.trailCream, 0.6);
    ctx.fill(Prl);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = css(C.rangeInk3);
    ctx.stroke(Pr);
    // road thread
    const rd = OB.spline(V.road, 4);
    const Pd = new Path2D();
    OB.ink(Pd, rd, 2.6, { t0: 0.02, t1: 0.05, wn: 0.3 });
    ctx.fillStyle = css(C.road, 0.85);
    ctx.fill(Pd);
    ctx.restore();
    // village: houses with a gable front, a dark side wall and a pale ridge, chimneys, warm
    // windows; a church with a lit belfry and a spire; trees, lanes and a pier
    const houses = [];
    for (let k = 0; k < 56; k++) {
      const t = R();
      const x = V.vx0 + (V.vx1 - V.vx0) * t + (R() - 0.5) * 10;
      const y = V.vy + Math.sin(t * 2.6) * 6 + (R() - 0.5) * 16 * (1 - Math.abs(t - 0.5));
      if (Math.abs(x - (V.vx0 + (V.vx1 - V.vx0) * 0.45)) < 22 && y < V.vy + 4) continue;
      houses.push({ x, y, w: 7 + R() * 9, h: 5 + R() * 5, roof: 3 + R() * 4, side: 2 + R() * 4, lit: R(), chim: R() < 0.4 });
    }
    houses.sort((a, b) => a.y - b.y);
    const ch = { x: V.vx0 + (V.vx1 - V.vx0) * 0.45, y: V.vy - 1 };
    // lanes
    {
      const Pl = new Path2D();
      for (let k = 0; k < 7; k++) {
        const a = houses[Math.floor(R() * houses.length)], b = houses[Math.floor(R() * houses.length)];
        if (Math.abs(a.x - b.x) > 140) continue;
        OB.ink(Pl, OB.spline([[a.x, a.y + 1], [(a.x + b.x) / 2, Math.max(a.y, b.y) + 4 + R() * 4], [b.x, b.y + 1]], 3), 1.1, { t0: 0.1, t1: 0.1 });
      }
      OB.ink(Pl, [[ch.x + 30, V.vy + 6], [ch.x + 34, V.lake.y - V.lake.ry * 0.9 + 6]], 1.3, { t0: 0, t1: 0 });
      ctx.fillStyle = css(C.road, 0.45);
      ctx.fill(Pl);
      // pier into the lake, with a moored boat
      const px = ch.x + 34, py = V.lake.y - V.lake.ry * 0.9 + 6;
      ctx.fillStyle = css(C.ink);
      ctx.fillRect(px - 1, py, 2.2, 16);
      for (let k = 0; k < 4; k++) ctx.fillRect(px - 2.5, py + 3 + k * 4, 5, 0.9);
      ctx.beginPath();
      ctx.moveTo(px + 4, py + 10); ctx.lineTo(px + 13, py + 10); ctx.lineTo(px + 11, py + 12.5); ctx.lineTo(px + 6, py + 12.5); ctx.closePath();
      ctx.fill();
    }
    const Pb = new Path2D(), Ps = new Path2D(), Prf = new Path2D(), Pw = new Path2D(), Pref = new Path2D(), Prh = new Path2D(), Ptr = new Path2D();
    const refl = (wx) => {
      // a broken shimmer column, wider near the shore and fading out
      const top = V.lake.y - V.lake.ry * 0.85;
      for (let r = 0; r < 11; r++) {
        if (R() < 0.25) continue;
        const ww = (6 - r * 0.45) * (0.6 + 0.8 * R());
        if (ww < 0.8) continue;
        const cx = wx + 1 + (R() - 0.5) * 3, cy = top + r * 4 + R() * 2;
        OB.ribbon(Pref, [[cx - ww, cy], [cx, cy + 0.2], [cx + ww, cy]], [0.2, 1.5, 0.2]);
      }
    };
    for (let k = 0; k < 34; k++) {
      const x = V.vx0 - 20 + R() * (V.vx1 - V.vx0 + 60), y = V.vy - 6 + R() * 18;
      const r = 3 + R() * 4;
      Ptr.moveTo(x + r, y);
      Ptr.ellipse(x, y - r * 0.6, r, r * 0.8, 0, 0, OB.TAU);
    }
    ctx.fillStyle = css(C.ink);
    ctx.fill(Ptr);
    for (const hs of houses) {
      const { x, y, w, h, roof, side } = hs;
      const xl = x - w / 2, xr = x + w / 2, sy = side * 0.35;
      Pb.rect(xl, y - h, w, h);
      OB.path([[xr, y], [xr, y - h], [xr + side, y - h - sy], [xr + side, y - sy]], true, Ps);
      OB.path([[xl - 1, y - h + 0.5], [x, y - h - roof], [xr + 1, y - h + 0.5], [xr + side + 0.8, y - h - sy + 0.5], [x + side, y - h - roof - sy]], true, Prf);
      OB.ribbon(Prh, [[x, y - h - roof], [x + side, y - h - roof - sy]], [0.8, 0.8]);
      if (hs.chim) Prf.rect(x + side * 0.6 + w * 0.15, y - h - roof - sy - 3, 2, 4);
      const nw = hs.lit > 0.3 ? 1 + Math.floor(hs.lit * 2.4) : 0;
      for (let k = 0; k < nw; k++) {
        const wx = xl + 1.5 + ((w - 4) * (k + 0.5)) / nw - 1, wy = y - h * 0.62;
        Pw.rect(wx, wy, 1.9, 2.5);
        if (y > V.lake.y - V.lake.ry - 30 && R() < 0.9) refl(wx);
      }
    }
    // church: nave, tower, belfry, spire, cross
    {
      const { x, y } = ch;
      Pb.rect(x, y - 13, 26, 13);
      OB.path([[x + 26, y], [x + 26, y - 13], [x + 31, y - 15], [x + 31, y - 2]], true, Ps);
      OB.path([[x - 1, y - 12.5], [x + 3, y - 21], [x + 30, y - 22], [x + 32, y - 14.5]], true, Prf);
      Pb.rect(x - 9, y - 34, 10, 34);
      OB.path([[x + 1, y], [x + 1, y - 34], [x + 4, y - 35], [x + 4, y - 1]], true, Ps);
      OB.path([[x - 10, y - 33.5], [x - 2.5, y - 56], [x + 2, y - 34], [x + 5, y - 35]], true, Prf);
      OB.ribbon(Prf, [[x - 2.5, y - 56], [x - 2.5, y - 64]], [1, 1]);
      OB.ribbon(Prf, [[x - 5, y - 61], [x, y - 61]], [0.9, 0.9]);
      Pw.rect(x - 5.5, y - 29, 3, 5);
      for (let k = 0; k < 3; k++) Pw.rect(x + 6 + k * 7, y - 9, 2, 4);
      refl(x - 4);
      refl(x + 13);
    }
    ctx.fillStyle = css(mix(C.rangeInk3, C.valleyFloor, 0.55));
    ctx.fill(Pb);
    ctx.fillStyle = css(C.ink);
    ctx.fill(Ps);
    ctx.fillStyle = css(C.crevice);
    ctx.fill(Prf);
    ctx.fillStyle = css(C.road, 0.45);
    ctx.fill(Prh);
    for (const hs of houses) if (hs.lit > 0.6) OB.glow(ctx, hs.x, hs.y - hs.h * 0.6, 14, C.amber, 0.18);
    OB.glow(ctx, ch.x - 4, ch.y - 26, 18, C.amber, 0.22);
    ctx.fillStyle = css(C.amberHot);
    ctx.fill(Pw);
    ctx.fillStyle = css(C.amber, 0.75);
    ctx.fill(Pref);
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
    // faults: vertical breaks every few hundred px; each block is displaced up or down so the
    // strata step instead of draping
    const faults = [x0 - 400];
    while (faults[faults.length - 1] < x1 + 400) faults.push(faults[faults.length - 1] + (o.faultW || 190) * (0.5 + R()));
    const fdy = faults.map(() => (R() - 0.5) * 1.3);
    const fang = faults.map(() => (R() - 0.5) * 0.5);
    const fcol = (x) => { let i = 0; while (i < faults.length - 2 && x > faults[i + 1]) i++; return i; };
    const off = (x) => {
      const i = fcol(x);
      const t = clamp((x - faults[i + 1] + 6) / 12);
      return lerp(fdy[i], fdy[i + 1], t);
    };
    const bands = [];
    let cur = new Float32Array(nx);
    for (let i = 0; i < nx; i++) { const x = x0 + i * xs; cur[i] = y0 - 260 + (x - x0) * tilt + o.fold * N.fbm(x * 0.0016, 0.5, 3) + off(x) * o.bandH(y0); }
    bands.push(cur);
    for (let k = 0; k < 500; k++) {
      const nxt = new Float32Array(nx);
      const hk = 0.4 + 1.5 * Math.pow(R(), 1.4);
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
    if (!o.noOutline) {
      ctx.lineWidth = o.olw * 2;
      ctx.strokeStyle = css(C.ink);
      ctx.stroke(clip);
    }
    OB.posterFill(ctx, clip, bbox, Dc, o.tones, { step: 3, dither: 0.025 });
    ctx.save();
    ctx.clip(clip);
    for (const [ya, yb, sp, lw] of o.strips) {
      for (let fi = 0; fi < faults.length - 1; fi++) {
        const bb = [Math.max(x0, faults[fi]), Math.max(y0, ya), Math.min(x1, faults[fi + 1]), Math.min(y1, yb)];
        if (bb[3] <= bb[1] || bb[2] <= bb[0]) continue;
        ctx.save();
        const cr = new Path2D();
        cr.rect(bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]);
        ctx.clip(cr);
        const blockD = (x, y) => Dc(x, y) + fdy[fi] * 0.12;
        OB.engrave(ctx, { bbox: bb, angle: Math.PI / 2 + 0.06 + fang[fi], sp: sp * (0.9 + 0.25 * OB.hash(fi, ya)), D: blockD, w: lw * 1.25, wmin: lw * 0.3, levels: 8, colAt: inkAt, wob: 0.35, seed: o.seed + ya + fi * 13, step: 4, fade: 0.22, warp: (u, v) => 2.5 * N(u * 0.008, v * 0.03), brk: 0.24 });
        OB.engrave(ctx, { bbox: bb, angle: o.dip + 0.04 + fang[fi] * 0.5 + (OB.hash(fi, 3) < 0.4 ? 0.7 : 0), sp: sp * 1.15, D: (x, y) => blockD(x, y) - 0.5, thrRange: 0.45, w: lw, wmin: lw * 0.3, levels: 8, colAt: inkAt, wob: 0.6, seed: o.seed + ya + fi * 13 + 1, step: 3, brk: 0.2 });
        OB.engrave(ctx, { bbox: bb, angle: Math.PI / 2 + 0.85 + fang[fi], sp: sp * 1.3, D: (x, y) => blockD(x, y) - 0.72, thrRange: 0.28, w: lw * 0.9, wmin: lw * 0.3, levels: 8, colAt: inkAt, wob: 0.6, seed: o.seed + ya + fi * 13 + 2, step: 3, brk: 0.22 });
        ctx.restore();
      }
    }
    // the faults themselves: dark ragged fissures
    {
      const Pf = new Path2D();
      for (let fi = 1; fi < faults.length - 1; fi++) {
        const fx = faults[fi];
        if (fx < x0 || fx > x1) continue;
        const ln = OB.wline(fx, y0 - 40, fx + (R() - 0.5) * 30, y1 + 40, 6, 3, fx);
        OB.ink(Pf, ln, 2 + (o.bandH(y1) / 40), { t0: 0, t1: 0, wn: 0.7, ph: fx });
      }
      ctx.fillStyle = css(C.ink);
      ctx.fill(Pf);
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
    // texture inside the beds: thin broken bedding lines, rain streaks hanging from the lips,
    // pitting, hairline fractures and lichen on the lit rock
    {
      const Pb = new Path2D(), Pst = new Path2D(), Pp = new Path2D(), Pc = new Path2D(), Pli = new Path2D(), Pch = new Path2D();
      const Rt = OB.rng(o.seed + 77);
      for (let k = 0; k < bands.length - 1; k++) {
        const b = bands[k], b2 = bands[k + 1];
        for (const f of [0.34, 0.58, 0.8]) {
          if (Rt() < 0.3) continue;
          const pts = [];
          for (let i = 0; i < nx; i++) pts.push([x0 + i * xs, lerp(b[i], b2[i], f + 0.04 * OB.N(i * 0.05, k + f * 9))]);
          OB.runs(Pb, pts, (q) => lwAt(pts[q][1]) * 0.55, (q) => pts[q][1] > y0 - 10 && pts[q][1] < y1 + 10 && OB.N(q * 0.07 + f * 31, k * 1.9) > 0.05, 3);
        }
        for (let i = 0; i < nx; i++) {
          if (Rt() > 0.16) continue;
          const yA = b[i], h = b2[i] - yA;
          if (yA < y0 - 20 || yA > y1 + 20 || h < 6) continue;
          const lw = lwAt(yA), xx = x0 + i * xs + (Rt() - 0.5) * xs;
          OB.flick(Pst, xx, yA + lw * 3.5, Math.PI / 2 + (Rt() - 0.5) * 0.12, h * (0.2 + 0.55 * Rt()), lw * (0.5 + 0.5 * Rt()));
        }
      }
      for (let k = 0; k < 52000; k++) {
        const x = x0 + Rt() * (x1 - x0), y = y0 + Rt() * (y1 - y0);
        const d = Dc(x, y), lw = lwAt(y);
        if (Rt() > (0.1 + 0.8 * d) * smooth(0.3, 0.7, OB.vnoise(x, y, 26 + lw * 12))) continue;
        OB.dot(Pp, x, y, lw * (0.4 + 0.7 * Math.pow(Rt(), 2)));
      }
      for (let k = 0; k < 520; k++) {
        const x = x0 + Rt() * (x1 - x0), y = y0 + Rt() * (y1 - y0), lw = lwAt(y);
        OB.crack(Pc, x, y, Math.PI / 2 + (Rt() - 0.5) * 1.2 + (Rt() < 0.35 ? Math.PI / 2 : 0), o.bandH(y) * (0.5 + 1.2 * Rt()), lw * (0.7 + 0.4 * Rt()), Rt, 0, Pch);
      }
      for (let k = 0; k < 1500; k++) {
        const x = x0 + Rt() * (x1 - x0), y = y0 + Rt() * (y1 - y0);
        if (Dc(x, y) > 0.5) continue;
        const lw = lwAt(y), rr = (2.5 + 5 * Rt()) * lw * 1.6;
        const nd = Math.floor(rr * rr * 0.35) + 3;
        for (let j = 0; j < nd; j++) {
          const a = Rt() * OB.TAU, r = rr * Math.sqrt(Rt());
          OB.dot(Pli, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, (0.35 + 0.5 * Rt()) * Math.sqrt(lw));
        }
      }
      ctx.fillStyle = css(C.ink, 0.85);
      ctx.fill(Pb);
      ctx.fill(Pst);
      ctx.fillStyle = css(C.ink, 0.72);
      ctx.fill(Pp);
      ctx.fillStyle = css(C.ink);
      ctx.fill(Pc);
      ctx.fillStyle = css(C.rockHi, 0.32);
      ctx.fill(Pch);
      ctx.fillStyle = css(C.lichen, 0.42);
      ctx.fill(Pli);
    }
    B.fill(ctx);
    ctx.fillStyle = css(C.rockHi, 0.55);
    ctx.fill(Ph);
    ctx.fillStyle = css(C.ink);
    ctx.fill(Pd);
    ctx.fillStyle = css(C.grassHi, 0.7);
    ctx.fill(Pl);
    ctx.restore();
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
    pp.forEach((p, i) => {
      // worn, uneven edges: each side frays independently
      const fl = 0.5 * (1 + 0.14 * N(i * 0.045, 1.3) + 0.06 * N(i * 0.3, 2.1));
      const fr = 0.5 * (1 + 0.14 * N(i * 0.045, 7.7) + 0.06 * N(i * 0.3, 5.9));
      Le.push([p.x - p.nx * p.w * fl, p.y - p.ny * p.w * fl]);
      Re.push([p.x + p.nx * p.w * fr, p.y + p.ny * p.w * fr]);
      dw.push(smooth(-0.3, 0.3, p.ny)); // 1: right edge is downhill
    });
    // retaining walls only where the path needs holding up: around the turns and on a few
    // exposed stretches
    const turn = pp.map((p, i) => {
      const a = pp[Math.max(0, i - 8)], b = pp[Math.min(n - 1, i + 8)];
      return 1 - (a.tx * b.tx + a.ty * b.ty);
    });
    const wallOK = pp.map((p, i) => {
      let t = 0;
      for (let k = Math.max(0, i - 30); k < Math.min(n, i + 30); k += 3) t = Math.max(t, turn[k]);
      return t > 0.25 || N(i * 0.011, 9.3) > 0.32;
    });
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
        if (flat[i] < 0.05 || !wallOK[i] || (piece.length && (dw[i] > 0.5) !== (dw[piece[0]] > 0.5)) || piece.length > 40) {
          const last = piece.length ? piece[piece.length - 1] : -1;
          flush();
          if (flat[i] >= 0.05 && wallOK[i] && last === i - 1) piece.push(i - 1);
        }
        if (flat[i] >= 0.05 && wallOK[i]) piece.push(i);
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
        ctx.fillStyle = css(mix(mix(C.pathFill, C.pathShade, 0.9 * smooth(2750, 3700, p.y)), C.pathWarm, Math.min(1, wm * 1.15)));
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
        // irregular rises, with the odd longer landing, as a path built by hand on a slope
        const gap = p.w * (nearTop ? 0.3 : 0.24) * (0.55 + 1.0 * OB.hash(i, 3)) * (OB.hash(i, 9) < 0.14 ? 2.3 : 1);
        if (acc < gap) continue;
        acc = 0;
        const a = Le[i], b = Re[i];
        const key = OB.warmCss(C.ink, p.x, p.y, 'path', 1);
        const ln = OB.wline(a[0], a[1], b[0], b[1], 6, 0.9 + p.w * 0.006, i);
        OB.ink(Bs.get(key), ln, lerp(1.0, 3.6, depth(p.y)), { t0: 0.12, t1: 0.12, wn: 0.45, ph: i });
        // the worn nose of each step catches the lantern-and-sky light just above its riser line
        const lnH = ln.map((q) => [q[0], q[1] - p.w * 0.022]);
        OB.ink(Bs.get(css(C.pathHi, 0.55)), lnH.slice(Math.floor(lnH.length * 0.1 * OB.hash(i, 5)), lnH.length - Math.floor(lnH.length * 0.2 * OB.hash(i, 6))), lerp(0.7, 2.0, depth(p.y)), { t0: 0.3, t1: 0.3, wn: 0.6, ph: i + 2 });
        const ln2 = ln.map((q) => [q[0], q[1] + p.w * 0.04]);
        OB.ink(Bs.get(css(C.ink, 0.45)), ln2, lerp(0.8, 2.6, depth(p.y)), { t0: 0.2, t1: 0.2, wn: 0.6, ph: i + 1 });
        // stone joints within the step
        const nj = Math.floor(p.w / 70) + 1;
        for (let k = 0; k < nj; k++) {
          const t = (k + 0.15 + 0.7 * OB.hash(i, k)) / (nj + 0.2);
          const q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
          OB.ink(Bs.get(key), [q, [q[0] + 1, q[1] + gap * 0.9]], lerp(0.8, 2.2, depth(p.y)), { t0: 0.2, t1: 0.2 });
        }
      }
      Bs.fill(ctx);
      // worn setts bedded in the tread where it is wide, with hairline cracks across the treads
      {
        const Pst = new Path2D(), Pc = new Path2D();
        const Rw = OB.rng(74);
        for (let i = 0; i < n; i++) {
          const p = pp[i];
          if (p.w < 50 || OB.hash(i, 41) > 0.11) continue;
          const f = (OB.hash(i, 42) - 0.5) * 0.8;
          const cx = p.x + p.nx * p.w * f, cy = p.y + p.ny * p.w * f;
          const r = p.w * (0.05 + 0.07 * OB.hash(i, 43));
          const poly = [];
          const a0 = Rw() * 6;
          for (let v = 0; v < 6; v++) { const a = a0 + (v / 6) * OB.TAU; poly.push([cx + Math.cos(a) * r * (0.75 + 0.4 * Rw()), cy + Math.sin(a) * r * 0.6 * (0.75 + 0.4 * Rw())]); }
          OB.path(poly, true, Pst);
          if (Rw() < 0.3) OB.crack(Pc, cx, cy, Math.atan2(p.ty, p.tx) + Math.PI / 2 + (Rw() - 0.5) * 0.5, p.w * 0.25, lerp(0.6, 1.4, depth(cy)), Rw, 1);
        }
        ctx.fillStyle = OB.css(C.pathHi, 0.16);
        ctx.fill(Pst);
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = OB.css(C.ink, 0.55);
        ctx.stroke(Pst);
        ctx.fillStyle = OB.css(C.ink, 0.6);
        ctx.fill(Pc);
      }
      // gravel stipple + pebbles
      const Pg = new Path2D(), Pp = new Path2D();
      for (let i = 0; i < n; i += 1) {
        const p = pp[i];
        const cnt = p.w * 0.11;
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
    // footing stone
    const base = [[x - 6 * s, y + 4 * s], [x - 5 * s, y - 2 * s], [x + 4.5 * s, y - 3 * s], [x + 6.5 * s, y + 4 * s]];
    ctx.fillStyle = css(C.stoneTones[2][1]);
    ctx.fill(OB.path(base));
    ctx.lineWidth = 1.1 * s;
    ctx.strokeStyle = css(C.ink);
    ctx.stroke(OB.path(base));
    // post
    OB.ink(P, [[x, y + 2], [x + 0.6 * s, y - 20 * s], [x, y - 40 * s]], 3.2 * s, { t0: 0, t1: 0, wn: 0.2 });
    // bracket arm, brace and finial
    OB.ink(P, [[x, y - 38 * s], [x + 9 * s, y - 40 * s], [x + 12 * s, y - 36 * s]], 1.8 * s, { t0: 0, t1: 0, wn: 0.2 });
    OB.ink(P, [[x + 0.3 * s, y - 31 * s], [x + 4 * s, y - 35 * s], [x + 7.5 * s, y - 39.3 * s]], 1.1 * s, { t0: 0, t1: 0 });
    OB.dot(P, x, y - 41.5 * s, 2 * s);
    ctx.fillStyle = css(C.ink);
    ctx.fill(P);
    // sky-lit edge on the post and the grain of its wood
    const Ph = new Path2D();
    OB.ink(Ph, [[x - 1 * s, y - 2 * s], [x - 0.5 * s, y - 38 * s]], 0.7 * s, { t0: 0.2, t1: 0.2 });
    ctx.fillStyle = OB.warmCss(C.rockHi, x, y - 20 * s, 'path', 1, 0.55);
    ctx.fill(Ph);
    const lx = x + 12 * s, ly = y - 26 * s;
    // glass box
    ctx.fillStyle = css(C.amber);
    ctx.beginPath();
    ctx.moveTo(lx - 5 * s, ly - 7 * s);
    ctx.lineTo(lx + 5 * s, ly - 7 * s);
    ctx.lineTo(lx + 4 * s, ly + 6 * s);
    ctx.lineTo(lx - 4 * s, ly + 6 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = css(C.amberHot);
    ctx.beginPath();
    ctx.ellipse(lx, ly, 1.8 * s, 2.8 * s, 0, 0, OB.TAU);
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
    OB.glow(ctx, L.lx, L.ly, 100 * s, C.amber, 0.22);
    OB.glow(ctx, L.lx, L.ly, 26 * s, C.amber, 0.4);
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

})();
