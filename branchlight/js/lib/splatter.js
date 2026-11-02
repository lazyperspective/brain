/* Branchlight — splatter, drips and clots of paint, as clean pixel clusters. */
(function () {
  'use strict';
  const BL = window.BL;

  // Fleck shapes (offsets). Single pixels dominate; a few 2-px and 3-px marks.
  const SHAPES = [
    [[0, 0]],
    [[0, 0]],
    [[0, 0]],
    [[0, 0], [1, 0]],
    [[0, 0], [0, 1]],
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [0, 1]],
    [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]
  ];

  // Flecks scattered around stored strand anchors, plus a light even dusting.
  // o: { count, near (0..1 share near marks), radius, colours, depthFade, region(x,y)->bool, sizeBias }
  BL.splatter = function (S, seed, o) {
    const rnd = BL.rng(seed);
    const marks = S.marks;
    for (let i = 0; i < o.count; i++) {
      let x, y, col, depth = 0;
      if (marks.length && rnd() < (o.near == null ? 0.7 : o.near)) {
        const m = marks[Math.floor(rnd() * marks.length)];
        const r = Math.abs(rnd.gauss()) * (o.radius || 10);
        const a = rnd() * Math.PI * 2;
        x = m[0] + Math.cos(a) * r; y = m[1] + Math.sin(a) * r;
        col = rnd() < 0.6 ? m[2] : rnd.weighted(o.colours);
        depth = m[3] || 0;
      } else {
        x = rnd() * S.W; y = rnd() * S.H;
        col = rnd.weighted(o.colours);
      }
      if (o.region && !o.region(x, y)) continue;
      const bias = o.sizeBias == null ? 1 : o.sizeBias;
      let si = Math.floor(Math.pow(rnd(), 1 + 2 / bias) * SHAPES.length);
      si = Math.min(si, SHAPES.length - 1);
      const f = depth + (o.fade || 0) + (o.fadeFn ? o.fadeFn(x, y) : 0);
      const c = f > 0 ? S.fade(col, x, y, f) : col;
      for (const p of SHAPES[si]) S.px(x + p[0], y + p[1], c);
      // occasional drip
      if (o.drips && rnd() < o.drips) {
        const len = rnd.int(2, 6);
        for (let k = 1; k <= len; k++) S.px(x, y + k + (si >= 5 ? 1 : 0), c);
      }
    }
  };

  // A clot of saturated paint: a flattened, lumpy smear, a darker underside,
  // and (sometimes) one or two pixels of wet light on top.
  BL.clot = function (S, rnd, x, y, r, col, o) {
    o = o || {};
    const seedN = Math.floor(rnd() * 1e9);
    const n = BL.noise(seedN);
    const lo = o.lo || BL.snap(BL.mix(col, [20, 12, 16], 0.4));
    const ry = Math.max(0.6, r * (o.squash || rnd.range(0.4, 0.65)));
    const rx = r * rnd.range(0.9, 1.6);
    const fade = o.fade || 0;
    const shine = r > 2 && rnd() < 0.35;
    for (let j = Math.floor(-ry - 1); j <= Math.ceil(ry + 1); j++) {
      for (let i = Math.floor(-rx - 2); i <= Math.ceil(rx + 2); i++) {
        const d = Math.hypot(i / rx, j / ry);
        const lim = 0.8 + 0.45 * n(i * 0.5 + 10, j * 0.5 + 10);
        if (d > lim) continue;
        let c = col;
        if (j >= ry * 0.35 && d > lim * 0.55) c = lo;
        const px = Math.round(x + i), py = Math.round(y + j);
        S.px(px, py, fade ? S.fade(c, px, py, fade) : c);
      }
    }
    if (shine) {
      const c = BL.snap(BL.mix(col, [255, 250, 235], 0.5));
      S.px(Math.round(x - rx * 0.3), Math.round(y - ry * 0.3), fade ? S.fade(c, x, y, fade) : c);
    }
  };

  // A verge of clots along a polyline of points [[x,y,scale], ...].
  BL.verge = function (S, seed, pts, o) {
    const rnd = BL.rng(seed);
    for (let i = 0; i < o.count; i++) {
      const t = rnd() * (pts.length - 1);
      const k = Math.floor(t), f = t - k;
      const a = pts[k], b = pts[Math.min(k + 1, pts.length - 1)];
      const sc = a[2] + (b[2] - a[2]) * f;
      const x = a[0] + (b[0] - a[0]) * f + rnd.gauss() * (o.spread || 4) * sc;
      const y = a[1] + (b[1] - a[1]) * f + rnd.gauss() * (o.spreadY || 2) * sc;
      const r = rnd.range(o.r[0], o.r[1]) * sc;
      if (r < 0.6) { S.px(x, y, rnd.weighted(o.colours)); continue; }
      BL.clot(S, rnd, x, y, r, rnd.weighted(o.colours), { fade: o.fadeFn ? o.fadeFn(x, y) : 0 });
    }
  };
})();

