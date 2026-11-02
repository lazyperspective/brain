/* 04 — Beyond. Out the other side: open ground in soft gold light. A single small tree
 * stands on a rise; the walker stands beneath it, still. The sky lines have gone loose and
 * slow. Far off on the left horizon, the tunnel they came through is a small dark tangle.
 */
(function () {
  'use strict';
  const BL = window.BL;
  const C = BL.C;
  const { mix, smooth, clamp } = BL;

  BL.slides.push({
    id: '04-beyond',
    title: 'Beyond',
    seed: 4404,
    render(S) {
      const W = S.W, H = S.H;
      const SX = 286, SY = 404;          // low sun
      const n = BL.noise(41), n2 = BL.noise(42);
      // the land: a long rise from the left up to a crest on the right of centre
      const horizon = (x) => 420 + 8 * Math.sin(x * 0.012 + 1) + 4 * (n(x * 0.02, 5) - 0.5) * 2;
      const rise = (x) => {
        const hx = 222;
        return 448 - 44 * Math.exp(-Math.pow((x - hx) / 95, 2)) + (n(x * 0.03, 9) - 0.5) * 3;
      };

      /* ------------------------------------------------ gold sky */
      S.fill((x, y) => {
        const fy = y / H;
        const w = n.fbm(x * 0.007, y * 0.012, 4);
        let c = mix(mix(C.lilacWhite, C.blush, smooth(0.35, 0.7, w)), C.paleGold, smooth(0.0, 0.45, fy + (w - 0.5) * 0.25));
        c = mix(c, C.goldLight, smooth(0.35, 0.62, fy + (w - 0.5) * 0.15) * 0.85);
        c = mix(c, C.paleBlue, smooth(0.2, 0.0, fy) * 0.3 * smooth(0.5, 0.0, x / W));
        const d = Math.hypot(x - SX, (y - SY) * 1.4);
        c = mix(c, C.gold, Math.pow(clamp(1 - d / 210, 0, 1), 1.6) * 0.5);
        c = mix(c, C.paleGold, Math.pow(clamp(1 - d / 90, 0, 1), 1.3));
        c = mix(c, C.warmWhite, Math.pow(clamp(1 - d / 34, 0, 1), 0.8));
        // distant land band
        const hz = horizon(x);
        if (y > hz) {
          const t = smooth(hz, hz + 40, y);
          c = mix(c, mix(C.goldLight, C.paleGrass, t), 0.85);
          c = mix(c, C.lilac, (1 - t) * 0.25 * smooth(0.6, 0, x / W));
        }
        // near meadow
        const rz = rise(x);
        if (y > rz) {
          const t = smooth(rz, H, y + (n2.fbm(x * 0.03, y * 0.05, 3) - 0.5) * 70);
          let g = mix(C.goldLight, C.gold, smooth(0, 0.4, t));
          g = mix(g, C.goldOchre, smooth(0.35, 0.8, t) * 0.8);
          g = mix(g, C.dryGrass, smooth(0.5, 1, t) * 0.5 * n2.fbm(x * 0.02, y * 0.02, 3) * 1.6);
          g = mix(g, C.ochre, smooth(0.75, 1, t) * 0.5);
          c = g;
        }
        return c;
      });
      S.snapshot();

      /* ------------------------------------------------ loose, slow sky lines */
      BL.skyLines(S, 47, {
        count: 34,
        start: (r) => [r.range(-120, W), r.range(30, 330), r.range(-0.18, 0.12)],
        len: [200, 480], curv: [-0.0018, 0.0018], dcurv: 0.000004,
        colours: [[C.vermilion, 2], [C.orange, 2], [C.goldOchre, 2], [C.skyBlue, 1.5], [C.teal, 1], [C.rose, 1.5], [C.crimson, 1]],
        fade: [0.35, 0.65], dotted: 0.25, fadeEnds: 0.6
      });

      /* ------------------------------------------------ the tunnel left behind */
      BL.tree(S, 4471, {
        x: 34, y: horizon(34) + 2, n: 8, wp: 0.5, angle: -Math.PI / 2 + 0.3, trunkLen: 8, unit: 3, twigLen: 5, twigGens: 3,
        colours: [[C.umber, 2], [C.crimson, 1], [C.violet, 1], [C.cobalt, 1]], depth: 0.55,
        field: BL.ring(48, horizon(48) - 9, 9, 1, 0.8), pull: 0.06, marks: 0
      });
      BL.tree(S, 4472, {
        x: 64, y: horizon(64) + 2, n: 8, wp: 0.5, angle: -Math.PI / 2 - 0.3, trunkLen: 8, unit: 3, twigLen: 5, twigGens: 3,
        colours: [[C.umber, 2], [C.crimson, 1], [C.violet, 1], [C.cobalt, 1]], depth: 0.55,
        field: BL.ring(48, horizon(48) - 9, 9, -1, 0.8), pull: 0.06, marks: 0
      });
      S.bloom(48, horizon(48) - 5, 2, 7, C.warmWhite, 0.9, { pow: 1 });

      /* ------------------------------------------------ the path, winding up the rise */
      {
        const pts = [];
        for (let t = 0; t <= 1; t += 0.002) {
          const y = BL.lerp(H + 4, rise(206) + 2, Math.pow(t, 0.8));
          const x = 120 + 86 * t + 40 * Math.sin(t * 3.4 + 0.3) * (1 - t);
          const w = BL.lerp(46, 2.5, Math.pow(t, 0.6));
          pts.push([x, y, w]);
        }
        const vn = BL.noise(48);
        const rows = new Map();
        for (const [x, y, w] of pts) {
          const yy = Math.round(y);
          if (!rows.has(yy)) rows.set(yy, [x, w]);
        }
        for (const [y, [x, w]] of rows) {
          for (let i = Math.floor(x - w); i <= Math.ceil(x + w); i++) {
            const q = Math.abs(i - x) / w;
            const ragged = 0.85 + 0.25 * vn(i * 0.15, y * 0.15);
            if (q > ragged) continue;
            let c = mix(C.paleGold, C.cream, 0.6);
            c = mix(c, C.goldLight, smooth(0.5, 1, q / ragged) * 0.8);
            S.soft(i, y, c);
            const v = vn.fbm(i * 0.08, y * 0.16, 3);
            if (Math.abs(v - 0.55) < 0.01 && y > 470) S.px(i, y, C.goldOchre);
            else if (Math.abs(v - 0.44) < 0.008 && y > 520) S.px(i, y, C.lightOrange);
          }
        }
      }

      /* ------------------------------------------------ meadow: crisp grass strokes */
      {
        const rr = BL.rng(49);
        const gcols = [[C.ochre, 3], [C.darkOchre, 2], [C.goldOchre, 2], [C.dryGrass, 2], [C.sage, 1.2], [C.olive, 0.8], [C.vermilion, 0.5], [C.teal, 0.4], [C.brown, 0.8]];
        const cl = BL.noise(50);
        for (let i = 0; i < 3200; i++) {
          const x = rr.range(-4, W + 4);
          const top = rise(x);
          const y = top + 2 + Math.pow(rr(), 1.4) * (H - top);
          const near = (y - top) / (H - top);
          // grass grows in tussocks; bare, sunlit patches between
          if (cl.fbm(x * 0.035, y * 0.06, 3) < 0.5 + 0.08 * (1 - near)) continue;
          const len = 1 + Math.round(near * rr.range(2, 9));
          const lean = rr.range(-0.5, 0.35);
          let col = rr.weighted(gcols);
          col = S.fade(col, x, y, (1 - near) * 0.5);
          const pts = [];
          for (let s = 0; s <= len; s += 0.5) pts.push(x + lean * s, y - s);
          S.polyline(pts, col);
        }
      }

      /* ------------------------------------------------ the small tree on the rise */
      const TX = 252, TY = rise(252) + 3;
      BL.tree(S, 4490, {
        x: TX, y: TY, n: 48, wp: 0.36, flare: 0.9, angle: -Math.PI / 2 - 0.05, trunkLen: 36,
        unit: 8, lenExp: 0.5, twigLen: 18, twigGens: 3, twigSpread: [0.14, 0.45], twigDecay: 0.85, braid: 0.7,
        colours: [[C.crimson, 2], [C.red, 2], [C.vermilion, 1.6], [C.orange, 1.2], [C.umber, 2], [C.darkUmber, 1.2],
          [C.teal, 1], [C.cobalt, 0.8], [C.goldOchre, 0.6]],
        depth: 0, twigFade: 0.08, field: BL.fan(TX + 4, TY + 40), pull: 0.016, spread: [0.4, 0.95], split: [0.25, 0.5],
        roots: 8, rootLen: [5, 14], stray: 0.15, strayLen: [30, 90], wander: 0.01, back: C.plum, backMin: 8, marks: 0.3,
        rim: { col: C.gold, amt: 0.5, side: 1 }
      });
      // clots of paint gathered at its roots
      BL.verge(S, 4491, [[TX - 22, TY, 0.8], [TX, TY + 2, 0.9], [TX + 24, TY + 1, 0.8]],
        { count: 70, r: [0.5, 2.4], colours: [[C.teal, 2], [C.red, 2], [C.ochre, 2], [C.cobalt, 1], [C.vermilion, 1]], spread: 8, spreadY: 1.5 });

      /* ------------------------------------------------ splatter, gentle */
      BL.splatter(S, 4492, {
        count: 900, near: 0.55, radius: 16, drips: 0,
        colours: [[C.vermilion, 2], [C.orange, 2], [C.goldOchre, 2], [C.teal, 1], [C.crimson, 1], [C.skyBlue, 0.8]],
        fade: 0.1
      });

      /* ------------------------------------------------ the walker, at rest beneath it */
      const fx = 206, fy = Math.round(rise(206)) + 2;
      // shadow falls away from the low sun, long across the rise
      for (let s = 1; s < 30; s++) {
        const x = Math.round(fx - s * 0.9), y = Math.round(fy + s * 0.18);
        if (BL.bayer(x, y) < 0.9 - s / 40) { S.px(x, y, C.darkOchre); S.px(x, y + 1, C.goldOchre); }
      }
      BL.figure(S, 'stand', fx, fy, C.plum);

      /* ------------------------------------------------ the sun */
      S.bloom(SX, SY, 6, 22, C.white, 1.0, { pow: 1.2 });
      S.bloom(SX, SY, 12, 70, C.paleGold, 0.4, { pow: 2, crisp: 0.5 });
    }
  });
})();
