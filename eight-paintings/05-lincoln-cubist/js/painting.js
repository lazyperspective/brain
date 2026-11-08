// The painting campaign, in the order a painter works: canvas and ground, a thin warm imprimatura, the charcoal
// scaffold, a lean block-in, the body of the planes in hatched strokes clipped to their facets, the collage planes,
// the features, contour and scaffold lines, and the final loaded lights.
(function (G) {
  'use strict';
  const R = G.R, PU = G.PaintUtil;
  const { clamp, sstep } = R;

  function paint(plan, W, H, k, q) {
    const P = new G.Painter(W, H, k);
    const rng = R.rng(1809);
    const tgt = plan.tgt, ids = plan.ids, gw = plan.gw, regs = plan.regs;
    P.setClip(ids, gw);
    const regAt = (x, y) => ids[2 * (y | 0) * gw + 2 * (x | 0)];
    const tAt = (x, y) => { const p = ((y | 0) * W + (x | 0)) * 3; return [tgt[p], tgt[p + 1], tgt[p + 2]]; };
    const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    // jitter a colour in value/temperature
    function vary(c, amt, r) {
      const v = 1 + (r() - 0.5) * 2 * amt, t = (r() - 0.5) * amt;
      return [clamp(c[0] * v * (1 + t), 0, 1), clamp(c[1] * v, 0, 1), clamp(c[2] * v * (1 - t), 0, 1)];
    }
    const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };

    // 1. canvas, gesso, imprimatura
    P.makeWeave(6.2 * k, 77);
    const gesso = R.hex('#e8e1d0');
    P.fillGround((x, y) => gesso);
    for (let i = 0; i < W * H; i++) P.h[i] = 0.04;
    const impr = [R.hex('#b49a72'), R.hex('#a68d68'), R.hex('#bca47c')];
    {
      const sp = 70 * k, list = [];
      for (let y = -sp; y < H + sp; y += sp) for (let x = -sp; x < W + sp; x += sp) list.push([x + rng() * sp, y + rng() * sp]);
      shuffle(list, rng).forEach(([x, y], i) => {
        const a = (rng() < 0.5 ? -0.6 : 0.9) + (rng() - 0.5) * 0.5;
        P.stroke({ pts: PU.bentPts(x, y, a, (160 + rng() * 180) * k, (rng() - 0.5) * 0.5, 120 * k), w: (90 + rng() * 60) * k, c: impr[i % 3], c2: impr[(i + 1) % 3],
          load: 0.55, fade: 0.7, op: 0.55, hs: 0.05, pickup: 0.5, seed: 10000 + i, rough: 1.5, blob: 0, lip: 0, scrape: 0 });
      });
    }
    P.dry(0);
    // 2. charcoal scaffold: the cuts and the main contours
    const charcoal = R.hex('#2a2622');
    function charLine(pts, w, seed, op) {
      P.stroke({ pts, w: w * k, c: charcoal, load: 0.32, fade: 0.3, op: op || 0.7, hs: 0.0, pickup: 0, seed, rough: 2, blob: 0, lip: 0, brush: 'round', scrape: 0, bristle: 0.8 });
    }
    plan.LINES.forEach((l, i) => {
      const r2 = R.rng(500 + i);
      const t0 = r2() * 0.3, t1 = 0.7 + r2() * 0.3;
      const ax = l.a[0] + (l.b[0] - l.a[0]) * t0, ay = l.a[1] + (l.b[1] - l.a[1]) * t0, bx = l.a[0] + (l.b[0] - l.a[0]) * t1, by = l.a[1] + (l.b[1] - l.a[1]) * t1;
      const n = 8; const seg = [];
      for (let j = 0; j <= n; j++) seg.push([(ax + (bx - ax) * j / n) * k, (ay + (by - ay) * j / n) * k]);
      for (let j = 0; j + 2 < seg.length; j += 2) if (r2() < 0.8) charLine(seg.slice(j, j + 3), 5, 600 + i * 20 + j, 0.6);
    });
    for (const s of plan.shapes) {
      if (!['face', 'beard', 'hairBack', 'earL', 'earR', 'eyeL', 'eyeR', 'noseLit', 'noseShadow', 'collar', 'coatL', 'coatR', 'lowerLip', 'browL', 'browR', 'socketL', 'socketR'].includes(s.name)) continue;
      const pts = s.poly.map((p) => [p[0] * k, p[1] * k]);
      for (let j = 0; j < pts.length; j += 3) charLine(pts.slice(j, Math.min(pts.length, j + 5)), 4, 900 + j + s.name.length * 77, 0.75);
    }
    P.dry(0);

    // generic hatched layer over the whole canvas
    function layer(o) {
      const sp = o.sp * k, list = [];
      for (let y = sp * 0.5; y < H; y += sp) for (let x = sp * 0.5; x < W; x += sp) {
        const px = x + (rng() - 0.5) * sp, py = y + (rng() - 0.5) * sp;
        if (!inb(px, py)) continue;
        const rid = regAt(px, py), rg = regs[rid];
        if (o.filter && !o.filter(rg, px, py)) continue;
        list.push([px, py, rid]);
      }
      shuffle(list, rng);
      list.forEach(([x, y, rid], i) => {
        const rg = regs[rid];
        const r2 = R.rng(o.seed * 100003 + i);
        let c = tAt(x, y);
        if (o.colour) c = o.colour(c, rg, r2);
        const vv = (o.vary || 0.05) * (rg && rg.fig ? 1 : 0.6);
        const cA = vary(c, vv, r2), cB = vary(c, vv * 1.6, r2);
        const ang = ((rg.hatch + (r2() - 0.5) * (o.angJ || 24)) * Math.PI) / 180;
        const len = (o.len[0] + r2() * (o.len[1] - o.len[0])) * k;
        const w = (o.w[0] + r2() * (o.w[1] - o.w[0])) * k;
        const clip = r2() < (o.clipP === undefined ? 0.85 : o.clipP) * (rg && rg.shape && /^hollow/.test(rg.shape.name) ? 0.5 : 1) ? rid : 0;
        P.stroke({ pts: PU.bentPts(x, y, ang, len, (r2() - 0.5) * (o.bend || 0.3), w), w, c: cA, c2: cB, mixAmt: 0.7,
          load: o.load * (0.85 + 0.3 * r2()), fade: o.fade || 0.55, op: o.op || 1, hs: o.hs * (0.75 + 0.7 * Math.sqrt(R.lum(cA))), pickup: o.pickup || 0.3, seed: o.seed * 7777 + i,
          clip, rough: o.rough || 1, blob: o.blob, lip: o.lip, brush: o.brush, scrape: o.scrape });
      });
    }
    const notCollage = (rg) => rg && rg.kind !== 'news' && rg.kind !== 'wood';
    // neighbour colour for broken passage: sample across the hatch
    const hairy = (rg) => rg && (rg.kind === 'hair' || rg.kind === 'beard' || rg.kind === 'hairlight');
    const broken = (c, rg, r2, x, y) => {
      if (r2() > 0.16 || hairy(rg)) return c;
      const a = (rg.hatch * Math.PI) / 180 + Math.PI / 2, d = (r2() < 0.5 ? -1 : 1) * (30 + r2() * 50) * k;
      const xx = clamp(x + Math.cos(a) * d, 0, W - 1), yy = clamp(y + Math.sin(a) * d, 0, H - 1);
      const n = tAt(xx, yy);
      if (R.lum(c) < 0.06 && R.lum(n) > R.lum(c) * 1.5) return c;
      return R.mix3(c, n, 0.4);
    };
    // 3. lean block-in
    layer({ sp: 40, w: [60, 84], len: [90, 170], load: 0.9, fade: 0.45, op: 0.95, hs: 0.12, pickup: 0.35, seed: 1, clipP: 0.55, vary: 0.07, rough: 1.4, blob: 0.1, lip: 0.1,
      colour: (c) => R.mul3(c, 0.93) });
    P.dry(0.4);
    // 4. body of the planes: hatched, clipped to their facets, colour broken across the cuts
    layer({ sp: 26, w: [24, 40], len: [60, 130], load: 1.0, fade: 0.55, hs: 0.42, pickup: 0.35, seed: 2, clipP: 0.86, vary: 0.11, filter: notCollage, colour: broken });
    P.dry(0.5);
    layer({ sp: 17, w: [13, 22], len: [34, 80], load: 0.95, fade: 0.5, hs: 0.36, pickup: 0.3, seed: 3, clipP: 0.92, vary: 0.06,
      filter: (rg) => rg && rg.fig, colour: broken });
    P.dry(0.4);
    // 5. collage: pasted newsprint and painted wood grain
    collage(P, plan, W, H, k, tAt);
    // 6. the features, small and clipped
    layer({ sp: 8, w: [6, 11], len: [14, 34], load: 0.9, fade: 0.45, hs: 0.3, pickup: 0.25, seed: 4, clipP: 1, vary: 0.04, angJ: 10,
      filter: (rg) => rg && rg.shape && rg.shape.feat });
    // 6b. hair and beard: long flowing strokes, lighter strands, the silhouette left ragged
    hairPass(P, plan, W, H, k, tAt, regAt);
    // 7. corrections where the paint strays from the plan
    errorPass(P, plan, W, H, k, tAt, regAt, 5);
    // 7a. a stippled plane, Synthetic-Cubist confetti, in the lower right
    stipple(P, plan, W, H, k);
    P.dry(0.3);
    // 7b. passage: here and there a cut is opened, the two planes dragged into each other wet-in-wet
    soften(P, plan, W, H, k, tAt);
    // 8. lines: the scaffold of the cuts and the drawing of the head, in dark paint and in light
    lines(P, plan, W, H, k);
    ageLines(P, k);
    // 9. the last loaded lights
    lights(P, plan, W, H, k, tAt, regAt);
    return P;
  }

  function hairPass(P, plan, W, H, k, tAt, regAt) {
    const r = R.rng(6262), regs = plan.regs;
    const lut = new Uint8Array(65536);
    regs.forEach((rg, id) => { if (rg && (rg.kind === 'hair' || rg.kind === 'beard' || rg.kind === 'hairlight' || rg.kind === 'bg')) lut[id] = 1; });
    const strand = [R.hex('#4b4440'), R.hex('#5c6670'), R.hex('#3e3128'), R.hex('#6a5a4a')];
    const sp = 13 * k, list = [];
    for (let y = 0; y < H; y += sp) for (let x = 0; x < W; x += sp) {
      const px = x + r() * sp, py = y + r() * sp, rg = regs[regAt(px, py)];
      if (rg && (rg.kind === 'hair' || rg.kind === 'beard' || rg.kind === 'hairlight')) list.push([px, py, rg]);
    }
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = list[i]; list[i] = list[j]; list[j] = t; }
    list.forEach(([x, y, rg], i) => {
      const beard = rg.kind === 'beard';
      let c = tAt(x, y);
      const lightS = r() < (beard ? 0.1 : 0.14);
      if (lightS) c = R.mix3(c, strand[Math.floor(r() * strand.length)], 0.6);
      c = R.mul3(c, 0.85 + r() * 0.3);
      // direction: beard falls along the jaw; hair follows its lock, with a wave
      let a = (rg.hatch * Math.PI) / 180 + (r() - 0.5) * 0.5;
      if (beard) {
        const fx = x / k - G.PLAN.CX;
        a = Math.atan2(1, -fx / 700) + (r() - 0.5) * 0.35;
      }
      const w = (lightS ? 4 + r() * 4 : 6 + r() * 7) * k;
      const len = (beard ? 40 + r() * 70 : 60 + r() * 110) * k;
      P.stroke({ pts: PU.bentPts(x, y, a, len, (r() - 0.5) * 1.1, w), w, c, c2: R.mul3(c, 0.8), mixAmt: 0.8, load: 0.75 + r() * 0.3, fade: 0.7, hs: 0.35, pickup: 0.15,
        seed: 70000 + i, clip: lut, brush: 'round', taper: 0.6, rough: 1.4, blob: 0.1, lip: 0.15 });
    });
  }

  function stipple(P, plan, W, H, k) {
    const poly = [[1700, 2140], [2160, 2040], [2160, 2700], [1780, 2700]];
    const r = R.rng(3737), regs = plan.regs, ids = plan.ids, gw = plan.gw;
    const lut = new Uint8Array(65536); regs.forEach((rg, id) => { if (rg && rg.kind === 'bg') lut[id] = 1; });
    const pal = [R.hex('#6f7c88'), R.hex('#4a5560'), R.hex('#9a7b55'), R.hex('#2a2828'), R.hex('#c9b48a'), R.hex('#dcd2bc')];
    const sp = 19;
    let i = 0;
    for (let y = 1940; y < 2720; y += sp * 0.87) for (let x = 1620 + ((Math.round(y / (sp * 0.87)) & 1) ? sp / 2 : 0); x < 2180; x += sp) {
      const px = x + (r() - 0.5) * 7, py = y + (r() - 0.5) * 7;
      if (!G.V.inside(poly, px, py)) continue;
      const X = px * k, Y = py * k;
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      if (!lut[ids[2 * (Y | 0) * gw + 2 * (X | 0)]]) continue;
      const c = pal[Math.floor(r() * (r() < 0.6 ? 3 : pal.length))];
      const a = r() * 6.28, w = (12 + r() * 5) * k;
      P.stroke({ pts: [[X - Math.cos(a) * 2 * k, Y - Math.sin(a) * 2 * k], [X + Math.cos(a) * 2 * k, Y + Math.sin(a) * 2 * k]], w, c, c2: R.mul3(c, 0.9), load: 1.2, fade: 0.2, hs: 0.7, pickup: 0.2, seed: 120000 + i++, brush: 'round', taper: 0, clip: lut, blob: 0.5, lip: 0.3, rough: 0.8 });
    }
  }

  function errorPass(P, plan, W, H, k, tAt, regAt, seed) {
    const g = Math.max(4, Math.round(10 * k)), col = P.col, tgt = plan.tgt;
    const cand = [];
    for (let y = 0; y + g <= H; y += g) for (let x = 0; x + g <= W; x += g) {
      let e = 0;
      for (let yy = y; yy < y + g; yy += 2) for (let xx = x; xx < x + g; xx += 2) {
        const p = (yy * W + xx) * 3;
        const d = Math.abs(Math.sqrt(col[p] * 0.3 + col[p + 1] * 0.6 + col[p + 2] * 0.1) - Math.sqrt(tgt[p] * 0.3 + tgt[p + 1] * 0.6 + tgt[p + 2] * 0.1));
        e += d;
      }
      e /= (g * g) / 4;
      if (e > 0.06) cand.push([x + g / 2, y + g / 2, e]);
    }
    const r = R.rng(seed * 991);
    cand.forEach(([x, y, e], i) => {
      const rid = regAt(x, y), rg = plan.regs[rid];
      if (!rg || rg.kind === 'news' || rg.kind === 'wood') return;
      const c = tAt(x, y);
      const ang = ((rg.hatch + (r() - 0.5) * 16) * Math.PI) / 180;
      const w = (8 + r() * 6) * k;
      P.stroke({ pts: PU.bentPts(x, y, ang, (18 + r() * 26) * k, (r() - 0.5) * 0.3, w), w, c, c2: R.mul3(c, 0.95 + r() * 0.1), load: 0.9, fade: 0.4, hs: 0.3, pickup: 0.2, seed: seed * 50000 + i, clip: rid });
    });
  }

  function collage(P, plan, W, H, k, tAt) {
    const col = P.col, h = P.h, wv = P.weave, ids = plan.ids, gw = plan.gw, regs = plan.regs;
    // newsprint: yellowed paper, fibres, columns of illegible print, a cut edge that stands off the canvas
    const news = plan.news, poly = news.poly.map((p) => [p[0] * k, p[1] * k]);
    const paper = R.hex('#d7ccb0');
    const ux = [poly[1][0] - poly[0][0], poly[1][1] - poly[0][1]], uy = [poly[3][0] - poly[0][0], poly[3][1] - poly[0][1]];
    const lu = Math.hypot(ux[0], ux[1]), lv = Math.hypot(uy[0], uy[1]);
    const ex = [ux[0] / lu, ux[1] / lu], ey = [uy[0] / lv, uy[1] / lv];
    const cols = 3, gutter = 26 * k, lineH = 15 * k, xH = 8 * k;
    const colW = (lu - 2 * 40 * k - (cols - 1) * gutter) / cols;
    const word = (ci, li, wx) => R.hash2(ci * 131 + li, Math.floor(wx / (6 * k)), 41);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, Math.ceil(y1)); y++) {
      for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(W - 1, Math.ceil(x1)); x++) {
        const gi = 2 * y * gw + 2 * x;
        let inN = 0;
        for (const o of [0, 1, gw, gw + 1]) { const rg = regs[ids[gi + o]]; if (rg && rg.kind === 'news') inN++; }
        if (!inN) continue;
        const a = inN / 4;
        // paper coordinates (u along the columns, v down)
        const dx = x - poly[0][0], dy = y - poly[0][1];
        // bilinear-ish: project onto edges of the (nearly rectangular) sheet
        const u = dx * ex[0] + dy * ex[1], v = dx * ey[0] + dy * ey[1];
        let ink = 0;
        const top = 120 * k;
        // a glyph-like mark: letter boxes with counters, stems, ascenders and descenders, words and spaces; never a
        // real letter, so nothing can be read
        const glyph = (gx, gy, cw, xh, seedA, seedB) => {
          const li2 = Math.floor(gx / cw), fx = gx / cw - li2;
          const hs = R.hash2(seedA, li2, seedB);
          if (hs < 0.16) return 0; // space
          const wfr = 0.55 + 0.32 * R.hash2(seedA, li2, seedB + 1);
          if (fx > wfr) return 0;
          const lx = fx / wfr;
          const asc = hs > 0.74, desc = hs < 0.24;
          const stem = lx < 0.3;
          if (gy < 0) return asc && stem && gy > -0.45 ? 1 : 0;
          if (gy > 1) return desc && stem && gy < 1.4 ? 1 : 0;
          if (hs > 0.55 && hs < 0.68 && lx > 0.32 && lx < 0.72 && gy > 0.3 && gy < 0.7) return 0; // counter
          if (hs >= 0.24 && hs < 0.33 && lx > 0.35 && gy < 0.45) return 0; // open shape
          return 1;
        };
        if (v > 40 * k && v < 104 * k && u > 40 * k && u < lu - 40 * k) {
          // headline: heavy smudged blocks, too blurred by the paint to be letters
          const hx = u - 40 * k, cell = Math.floor(hx / (115 * k)), fx = hx / (115 * k) - cell;
          const on = fx < 0.55 + 0.35 * R.hash2(cell, 6, 7);
          const yy = (v - 52 * k) / (40 * k);
          const er = R.fbm(u / (6 * k), v / (6 * k), 91, 3);
          if (on && yy > 0.08 && yy < 0.92 && er > 0.36) ink = 0.62 * (0.55 + 0.45 * er);
          if (Math.abs(v - 110 * k) < 1.4 * k) ink = 0.7;
        } else if (v > top && u > 40 * k && u < lu - 40 * k) {
          const cu = u - 40 * k, ci = Math.floor(cu / (colW + gutter)), cx = cu - ci * (colW + gutter);
          if (cx < colW) {
            const li = Math.floor((v - top) / lineH), ly = (v - top) - li * lineH;
            const para = R.hash2(ci, Math.floor(li / 9), 9) < 0.18 && li % 9 === 8;
            const lineEnd = li % 9 === 7 ? colW * (0.3 + 0.5 * R.hash2(ci, li, 13)) : colW;
            if (!para && cx < lineEnd) {
              const g = glyph(cx, (ly - (lineH - xH) / 2) / xH, 6.4 * k, xH, ci * 977 + li, 21);
              if (g) ink = 0.8;
            }
          } else if (Math.abs(cx - colW - gutter / 2) < 0.8 * k) ink = 0.5;
        }
        ink *= 0.72 + 0.28 * R.vnoise(x / (1.5 * k), y / (1.5 * k), 61);
        // paper colour shaded like the plane it sits in
        const t = tAt(x, y), lt = R.lum(t) / 0.6;
        const fib = 0.94 + 0.08 * R.fbm(x / (5 * k), y / (40 * k), 33, 3) + (R.hash2(x, y, 4) - 0.5) * 0.03;
        const sh = clamp(0.62 + 0.45 * lt, 0.55, 1.15) * fib;
        const ink3 = R.hex('#1e1c1a');
        const p3 = (y * W + x) * 3;
        for (let c = 0; c < 3; c++) {
          const v0 = paper[c] * sh, v1 = v0 + (ink3[c] - v0) * clamp(ink, 0, 1);
          col[p3 + c] += (v1 - col[p3 + c]) * a;
        }
        // paper is flat: it hides the weave, and its cut edge stands a little proud
        const p = y * W + x;
        h[p] = h[p] * (1 - a) + a * (0.1 + 0.05 * R.vnoise(x / (60 * k), y / (60 * k), 3));
        wv[p] = wv[p] * (1 - a * 0.85) + a * 0.85 * 0.35;
        P.wet[p] *= 1 - a;
      }
    }
    // wood: a painted faux-bois, laid in flat and combed
    const wood = plan.wood, wp = wood.poly.map((p) => [p[0] * k, p[1] * k]);
    const wl = R.hex('#b08552'), wd = R.hex('#6e4a2b'), wdd = R.hex('#4a3020');
    x0 = Infinity; x1 = -Infinity; y0 = Infinity; y1 = -Infinity;
    for (const p of wp) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const ang = Math.atan2(wp[3][1] - wp[0][1], wp[3][0] - wp[0][0]);
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, Math.ceil(y1)); y++) {
      for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(W - 1, Math.ceil(x1)); x++) {
        const gi = 2 * y * gw + 2 * x;
        let inW = 0;
        for (const o of [0, 1, gw, gw + 1]) { const rg = regs[ids[gi + o]]; if (rg && rg.kind === 'wood') inW++; }
        if (!inW) continue;
        const a = inW / 4;
        const dx = x - wp[0][0], dy = y - wp[0][1];
        const along = dx * ca + dy * sa, across = -dx * sa + dy * ca;
        // grain: stretched, warped rings, with a knot
        const kx = across - 210 * k, ky = along - 520 * k;
        const knot = 1 / (1 + (kx * kx + ky * ky * 0.25) / (900 * k * k));
        const warp = (R.fbm(across / (90 * k), along / (600 * k), 71, 3) - 0.5) * 60 * k + knot * 40 * k * Math.sign(kx);
        const cath = Math.min(Math.hypot(across + warp * 0.5 - 170 * k, (along - 760 * k) * 0.32), Math.hypot(across + warp * 0.5 - 230 * k, (along - 1250 * k) * 0.3) + 14 * k);
        const ring = Math.sin((cath / (10 * k)) * Math.PI + R.vnoise(across / (40 * k), along / (300 * k), 72) * 2.2);
        const fine = R.vnoise(across / (1.6 * k), along / (60 * k), 73);
        let g = 0.5 + 0.5 * ring; g = Math.pow(g, 2.2) * 0.8 + fine * 0.25;
        const t = tAt(x, y), lt = R.lum(t) / R.lum(wood.col);
        const base = R.mix3(wl, wd, clamp(g, 0, 1));
        const c3 = R.mix3(base, wdd, knot * 0.5);
        const sh = clamp(0.7 + 0.3 * lt, 0.6, 1.15);
        const p3 = (y * W + x) * 3;
        for (let c = 0; c < 3; c++) col[p3 + c] += (c3[c] * sh - col[p3 + c]) * a;
        const p = y * W + x;
        h[p] = h[p] * (1 - a) + a * (0.16 + 0.05 * fine);
        P.wet[p] *= 1 - a * 0.5;
      }
    }
    // combed streaks along the grain
    const r = R.rng(4242);
    for (let i = 0; i < 40; i++) {
      const t = r(), sx = wp[0][0] + (wp[1][0] - wp[0][0]) * t, sy = wp[0][1] + (wp[1][1] - wp[0][1]) * t;
      const L = Math.hypot(wp[3][0] - wp[0][0], wp[3][1] - wp[0][1]);
      const n = 10, pts = [];
      const s0 = r() * 0.3, s1 = 0.6 + r() * 0.4;
      for (let j = 0; j <= n; j++) {
        const f = s0 + (s1 - s0) * (j / n);
        pts.push([sx + Math.cos(ang) * L * f + Math.sin(f * 9 + i) * 6 * k, sy + Math.sin(ang) * L * f]);
      }
      const rid = plan.regs.findIndex((rg) => rg && rg.kind === 'wood');
      const lut = new Uint8Array(65536); plan.regs.forEach((rg, id) => { if (rg && rg.kind === 'wood') lut[id] = 1; });
      P.stroke({ pts, w: (14 + r() * 22) * k, c: r() < 0.6 ? wd : wdd, c2: wl, mixAmt: 1, load: 0.5, fade: 0.5, op: 0.85, hs: 0.08, seed: 7000 + i, clip: lut, rough: 2.2, bristle: 3.5 * k, blob: 0, lip: 0, scrape: 0.1 });
    }
  }

  // straight cuts drawn in dark paint (broken), a few in light; head contours in dark
  function lines(P, plan, W, H, k) {
    const r = R.rng(3131);
    const dark = R.hex('#1d1a18'), light = R.hex('#ece4d0');
    const line = (pts, w, c, load, seed, op) => P.stroke({ pts, w: w * k, c, c2: R.mul3(c, 0.85), load, fade: 0.55, op: op || 0.95, hs: 0.3, pickup: 0.2, seed, rough: 1.2, brush: 'round', blob: 0.2, lip: 0.3, taper: 0.5 });
    plan.LINES.forEach((l, i) => {
      const n = 2 + Math.floor(r() * 2);
      for (let j = 0; j < n; j++) {
        const t0 = r(), len = 0.08 + r() * 0.12, t1 = Math.min(1, t0 + len);
        const pts = [];
        for (let q = 0; q <= 6; q++) { const t = t0 + (t1 - t0) * (q / 6); pts.push([(l.a[0] + (l.b[0] - l.a[0]) * t) * k + (r() - 0.5) * 1.5 * k, (l.a[1] + (l.b[1] - l.a[1]) * t) * k + (r() - 0.5) * 1.5 * k]); }
        const isLight = r() < 0.12;
        // keep heavy lines off the face
        if (pts.some((p) => { const rg = plan.regs[plan.ids[2 * Math.min(H - 1, Math.max(0, p[1] | 0)) * plan.gw + 2 * Math.min(W - 1, Math.max(0, p[0] | 0))]]; return !rg || rg.kind !== 'bg'; })) continue;
        if (false && pts.some((p) => plan.figPix[(Math.min(H - 1, Math.max(0, p[1] | 0))) * W + Math.min(W - 1, Math.max(0, p[0] | 0))])) continue;
        if (isLight) P.stroke({ pts, w: (12 + r() * 8) * k, c: light, c2: R.hex('#cdbf9f'), load: 0.42, fade: 0.6, op: 0.7, hs: 0.15, pickup: 0.4, seed: 20000 + i * 10 + j, rough: 2, blob: 0, lip: 0 });
        else line(pts, 8 + r() * 6, dark, 0.75, 20000 + i * 10 + j, 0.9);
      }
    });
    // contour drawing of the head
    const want = { noseProfile: [0, 1], lapelL: [0, 1], lapelR: [0, 1], eyeL: [0, 1], eyeR: [0, 1], browL: [0, 1], browR: [0, 1], noseShadow: [0.0, 0.5], collar: [0, 1] };
    for (const s of plan.shapes) {
      if (!want[s.name]) continue;
      const pts = s.poly.map((p) => [p[0] * k, p[1] * k]);
      const n = pts.length;
      const seg = s.name === 'eyeL' || s.name === 'eyeR' ? n : s.name === 'noseProfile' ? 6 : 4;
      for (let j = 0; j < n; j += seg) {
        if (s.name !== 'noseProfile' && r() < (s.name === 'face' || s.name === 'hairBack' ? 0.55 : 0.2)) continue;
        if (s.name === 'noseProfile' && j > n * 0.6) continue;
        const sl = []; for (let q = 0; q <= Math.min(seg, n - 1); q++) sl.push(pts[(j + q) % n]);
        line(sl, s.name.startsWith('eye') ? 3.5 : 5 + r() * 2, dark, 0.95, 30000 + j + s.name.length * 999, 0.85);
      }
    }
  }

  // the drawing of age: forehead creases, the furrow between the brows, bags under the eyes, the cheek furrows
  function ageLines(P, k) {
    const CX = G.PLAN.CX, CY = G.PLAN.CY, S = G.PLAN.SC;
    const T = (x, y) => [(CX + S * x * 0.88) * k, (CY + S * y) * k];
    const dark = R.hex('#3a2c22'), lt = R.hex('#e6cfa2');
    const r = R.rng(4545);
    const ln = (pts, w, c, op, seed) => P.stroke({ pts: G.V.path(pts.map((p) => T(p[0], p[1])), false, 6), w: w * k, c, c2: R.mul3(c, 0.9), load: 1.3, fade: 0.3, op, hs: 0.2, pickup: 0.35, seed, brush: 'round', taper: 0.8, rough: 1, blob: 0, lip: 0.1 });
    // forehead creases (three, broken, slightly arched)
    [[-300, -235, 0.9], [-262, -195, 1], [-230, -160, 0.8]].forEach(([y0, y1, a], i) => {
      ln([[-210, y0 + 14], [-140, y0], [-60, y0 - 6], [0, y0 - 8]], 5, dark, 0.62 * a, 50 + i);
      ln([[30, y0 - 4], [100, y0 - 4], [160, y0 + 2], [210, y0 + 14]], 5, dark, 0.55 * a, 60 + i);
      ln([[-190, y0 + 20], [-100, y0 + 10], [-20, y0 + 6], [10, y0 + 6]], 5, lt, 0.3 * a, 70 + i);
    });
    // vertical furrows between the brows
    ln([[-26, -140], [-20, -100], [-16, -70]], 6, dark, 0.7, 81);
    ln([[22, -146], [18, -104], [16, -72]], 5, dark, 0.6, 82);
    // bags under the eyes
    ln([[-205, 36], [-150, 58], [-80, 44]], 5, dark, 0.6, 83);
    ln([[200, 32], [140, 54], [78, 42]], 5, dark, 0.6, 84);
    ln([[-200, 62], [-140, 80], [-86, 70]], 5, lt, 0.35, 85);
    // cheek furrows: the long vertical lines of the gaunt cheeks
    ln([[-250, 160], [-236, 260], [-222, 350]], 7, dark, 0.55, 86);
    ln([[262, 160], [250, 260], [236, 340]], 7, dark, 0.55, 87);
    // crow's feet
    for (let i = 0; i < 3; i++) { ln([[-220, -6 + i * 14], [-262, -20 + i * 22]], 3.5, dark, 0.5, 90 + i); ln([[212, -8 + i * 14], [254, -22 + i * 22]], 3.5, dark, 0.5, 95 + i); }
  }

  // thick light paint on the lit planes: forehead, nose, cheekbone, collar, a few ground planes
  function lights(P, plan, W, H, k, tAt, regAt) {
    const r = R.rng(8080);
    const spots = [
    ];
    for (const [name, n, amt] of spots) {
      const s = plan.shapes.find((q) => q.name === name);
      if (!s) continue;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of s.poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      let made = 0, tries = 0;
      while (made < n && tries++ < 400) {
        const x = (x0 + r() * (x1 - x0)) * k, y = (y0 + r() * (y1 - y0)) * k;
        const rid = regAt(x, y), rg = plan.regs[rid];
        if (!rg || rg.shape !== s) continue;
        const c = tAt(x, y);
        const lc = R.mix3(c, R.hex('#efe2c4'), 0.2 * amt);
        const ang = ((rg.hatch + (r() - 0.5) * 20) * Math.PI) / 180;
        const w = (14 + r() * 12) * k;
        P.stroke({ pts: PU.bentPts(x, y, ang, (40 + r() * 60) * k, (r() - 0.5) * 0.4, w), w, c: lc, c2: R.mix3(lc, c, 0.5), load: 1.3, fade: 0.8, hs: 0.8, pickup: 0.6, seed: 90000 + made + name.length * 1000, clip: r() < 0.5 ? rid : 0, blob: 0.3, lip: 0.4, rough: 1.6 });
        made++;
      }
    }
    // the mole: one dark round touch
    const m = plan.shapes.find((q) => q.name === 'mole');
    if (m) {
      let cx = 0, cy = 0; for (const p of m.poly) { cx += p[0]; cy += p[1]; } cx /= m.poly.length; cy /= m.poly.length;
      P.stroke({ pts: [[(cx - 4) * k, (cy - 1) * k], [(cx + 4) * k, (cy + 1) * k]], w: 22 * k, c: R.hex('#2a1a14'), c2: R.hex('#3b2418'), load: 1.0, fade: 0.2, hs: 0.5, pickup: 0.1, seed: 99, brush: 'round', blob: 0.3, lip: 0.1 });
    }
  }

  function soften(P, plan, W, H, k, tAt) {
    const r = R.rng(5151);
    plan.LINES.forEach((l, i) => {
      const dx = l.b[0] - l.a[0], dy = l.b[1] - l.a[1], len = Math.hypot(dx, dy);
      const nx = -dy / len, ny = dx / len;
      for (let t = r() * 0.1; t < 1; t += (40 + r() * 30) / len) {
        // open stretches: about a third of each cut
        if (R.vnoise(t * len / 300, i * 7.3, 88) < 0.58) continue;
        const x = (l.a[0] + dx * t) * k, y = (l.a[1] + dy * t) * k;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const side = r() < 0.5 ? 1 : -1;
        const sx = x + nx * side * 18 * k, sy = y + ny * side * 18 * k;
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
        const headK = (xx, yy) => { const rg = plan.regs[plan.ids[2 * (yy | 0) * plan.gw + 2 * (xx | 0)]]; return rg && rg.fig && rg.kind !== 'cloth' && rg.kind !== 'hat' && rg.kind !== 'white' && rg.kind !== 'black' ? rg.kind : null; };
        const ox = x - nx * side * 18 * k, oy = y - ny * side * 18 * k;
        if (ox < 0 || oy < 0 || ox >= W || oy >= H) continue;
        const k1 = headK(sx, sy), k2 = headK(ox, oy);
        if ((k1 || k2) && !(k1 === 'skin' && k2 === 'skin')) continue;
        const c = tAt(sx, sy);
        const a = Math.atan2(ny, nx) * (side > 0 ? 1 : -1) + (r() - 0.5) * 0.7 + (side < 0 ? Math.PI : 0);
        const w = (16 + r() * 14) * k;
        P.stroke({ pts: PU.bentPts(x, y, a + Math.PI / 2 * (r() < 0.5 ? 0 : 1) * 0.3, (40 + r() * 40) * k, (r() - 0.5) * 0.4, w), w, c, load: 0.55, fade: 0.7, op: 0.85, hs: 0.2, pickup: 0.75, drag: 26 * k, seed: 40000 + i * 997 + Math.round(t * 1000), rough: 1.6, blob: 0, lip: 0.1 });
      }
    });
  }

  G.PAINTING = { paint, light: { heightScale: 2.2, weaveScale: 0.9 } };
})(typeof window !== 'undefined' ? window : globalThis);
