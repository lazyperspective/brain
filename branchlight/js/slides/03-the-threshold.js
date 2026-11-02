/* 03 — The threshold. Close to the light. The branches of the last trees curl into a near
 * circle around a blazing white opening; the path runs straight into it. The walker is a
 * silhouette at its lower edge, mid-stride, about to step in. Everything is bleached.
 */
(function () {
  'use strict';
  const BL = window.BL;
  const C = BL.C;
  const { mix, smooth, clamp } = BL;

  BL.slides.push({
    id: '03-the-threshold',
    title: 'The threshold',
    seed: 3303,
    render(S) {
      const W = S.W, H = S.H;
      const OX = 180, OY = 296, OR = 66;   // the opening (slightly tall ellipse)
      const SQ = 0.82;                     // vertical squash for distances (makes it taller)
      const yH = 384;
      const n = BL.noise(31);
      const dO = (x, y) => Math.hypot(x - OX, (y - OY) * SQ);

      /* ------------------------------------------------ blinding haze */
      S.fill((x, y) => {
        const d = dO(x, y);
        const w = n.fbm(x * 0.012, y * 0.009, 4);
        let c = mix(C.coolWhite, C.blush, smooth(0.2, 0.8, x / W + (w - 0.5) * 0.6));
        c = mix(c, C.grey, smooth(120, 330, d) * 0.8 * smooth(0.75, 0.15, x / W));
        c = mix(c, C.lilac, smooth(140, 360, d) * 0.5 * smooth(0.3, 0.9, x / W));
        c = mix(c, C.peach, smooth(220, 420, d) * 0.45 * smooth(0.5, 1, x / W));
        if (y > yH) c = mix(c, mix(C.cream2, C.warmGrey, smooth(yH, H, y + (n.fbm(x * 0.03, y * 0.03, 3) - 0.5) * 120) * 0.8), smooth(yH, yH + 50, y) * 0.85);
        c = mix(c, C.warmWhite, Math.pow(clamp(1 - d / 230, 0, 1), 1.2));
        c = mix(c, C.white, Math.pow(clamp(1 - (d - OR * 0.7) / 80, 0, 1), 1.0));
        return c;
      });
      S.snapshot();

      /* ------------------------------------------------ the path into the light */
      const X = BL.spline([1, 2, 4, 30], [0.1, 0.05, 0, 0]);
      const path = BL.path(S, 33, {
        horizon: yH - 14, vpX: OX, scale: 150, halfW: 0.75, centre: X, top: yH - 8,
        plate: [3.6, 1.9], crackW: 0.1, grit: 600, detailFrom: 0.12, tintAmt: 0.35,
        gritColours: [[C.warmGreyMid, 2], [C.darkOchre, 2], [C.umber, 1], [C.red, 0.6], [C.teal, 0.4]],
        farFade: (u) => Math.pow(clamp(1 - u / 0.55, 0, 1), 1.3)
      });

      /* ------------------------------------------------ rays */
      {
        const rr = BL.rng(35);
        for (let i = 0; i < 26; i++) {
          const a = rr.range(0, Math.PI * 2), wa = rr.range(0.015, 0.05), str = rr.range(0.25, 0.6);
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const d = dO(x, y);
            if (d < OR * 0.9) continue;
            const da = Math.abs(BL.angDiff(Math.atan2(y - OY, x - OX), a));
            if (da > wa) continue;
            const f = (1 - da / wa) * str * clamp(1 - (d - OR) / 260, 0, 1);
            const k = (y * W + x) * 3;
            if (S.mode[y * W + x] === 0) {
              S.rgb[k] += (255 - S.rgb[k]) * f; S.rgb[k + 1] += (252 - S.rgb[k + 1]) * f; S.rgb[k + 2] += (245 - S.rgb[k + 2]) * f;
            }
          }
        }
      }

      /* ------------------------------------------------ the ring of branches */
      const cols = [
        [C.red, 2.5], [C.crimson, 2.5], [C.vermilion, 2], [C.orange, 1.2], [C.deepCrimson, 1.5],
        [C.cobalt, 1.6], [C.blue, 0.8], [C.teal, 1.5], [C.tealLight, 0.6],
        [C.umber, 1.6], [C.black, 1.6], [C.darkUmber, 1.2], [C.slateDark, 1]
      ];
      const ringL = BL.ring(OX, OY, OR + 22, 1, 1.0, 1 / SQ);
      const ringR = BL.ring(OX, OY, OR + 22, -1, 1.0, 1 / SQ);
      const ring2L = BL.ring(OX, OY, OR + 70, 1, 0.8, 1 / SQ);
      const ring2R = BL.ring(OX, OY, OR + 70, -1, 0.8, 1 / SQ);
      // depth: inner, smaller, paler trees first, then the big framing trunks;
      // a few limbs enter from the top corners and close the circle overhead
      const trees = [
        { x: 120, y: 392, n: 18, side: -1, d: 0.55, len: 14, f: ringL },
        { x: 240, y: 393, n: 18, side: 1, d: 0.55, len: 14, f: ringR },
        { x: 92, y: 408, n: 30, side: -1, d: 0.35, len: 22, f: ringL },
        { x: 270, y: 410, n: 30, side: 1, d: 0.35, len: 22, f: ringR },
        { x: -40, y: 150, n: 44, side: -1, d: 0.2, len: 24, a: -0.75, f: ringL },
        { x: 400, y: 140, n: 44, side: 1, d: 0.2, len: 24, a: Math.PI + 0.75, f: ringR },
        { x: 50, y: 452, n: 56, side: -1, d: 0.1, len: 40, f: ringL },
        { x: 314, y: 456, n: 58, side: 1, d: 0.1, len: 40, f: ringR },
        { x: -30, y: 300, n: 50, side: -1, d: 0.05, len: 30, a: -0.6, f: ring2L },
        { x: 392, y: 280, n: 50, side: 1, d: 0.05, len: 30, a: Math.PI + 0.6, f: ring2R },
        { x: -18, y: 560, n: 84, side: -1, d: 0, len: 64, f: ring2L },
        { x: 380, y: 566, n: 88, side: 1, d: 0, len: 64, f: ring2R }
      ];
      trees.forEach((t, i) => {
        const grounded = t.a == null;
        BL.tree(S, 3300 + i * 41, {
          x: t.x, y: t.y, n: t.n, wp: 0.42, flare: grounded ? 0.9 : 0, angle: grounded ? -Math.PI / 2 - t.side * 0.25 : t.a,
          trunkLen: t.len, unit: 7 + t.n * 0.07, lenExp: 0.5, twigLen: 14 + t.n * 0.16, twigGens: 3,
          twigSpread: [0.12, 0.4], colours: cols, depth: t.d, twigFade: 0.05,
          field: t.f, pull: 0.04, spread: [0.3, 0.75], split: [0.2, 0.45], braid: 0.65,
          roots: grounded ? Math.round(t.n / 5) : 0, rootLen: [6, 10 + t.n * 0.3], stray: 0.25, strayLen: [50, 160], wander: 0.006,
          back: C.plum, backMin: 9, marks: 0.25, bounds: 140
        });
      });

      /* ------------------------------------------------ long threads circling the opening */
      BL.skyLines(S, 37, {
        count: 80,
        start: (r) => {
          const a = r() * Math.PI * 2, rr = r.range(OR + 30, OR + 200);
          return [OX + Math.cos(a) * rr, OY + Math.sin(a) * rr / SQ, a + Math.PI / 2 * (r() < 0.5 ? 1 : -1) + r.range(-0.3, 0.3)];
        },
        len: [120, 320], curv: [-0.004, 0.004],
        colours: [[C.crimson, 2], [C.red, 2], [C.cobalt, 1.5], [C.slateDark, 2], [C.umber, 1.5], [C.teal, 1]],
        fade: [0.3, 0.6], dotted: 0.2, fadeEnds: 0.6,
        fadeFn: (x, y) => clamp(1 - (dO(x, y) - OR) / 60, 0, 1), clipY: yH - 10
      });

      /* ------------------------------------------------ verges */
      const vcol = [[C.teal, 3], [C.red, 2.5], [C.ochre, 2], [C.cobalt, 1.5], [C.vermilion, 1.5], [C.aqua, 0.8], [C.crimson, 1.2], [C.umber, 1]];
      const vfade = (x, y) => clamp(1 - (y - yH) / 120, 0, 1) * 0.8;
      BL.verge(S, 38, path.edges.left.map((p) => [p[0] - 8 * p[2], p[1], 0.3 + p[2] * 1.4]), { count: 800, r: [0.5, 2.6], colours: vcol, spread: 6, spreadY: 1.5, fadeFn: vfade });
      BL.verge(S, 39, path.edges.right.map((p) => [p[0] + 8 * p[2], p[1], 0.3 + p[2] * 1.4]), { count: 800, r: [0.5, 2.6], colours: vcol, spread: 6, spreadY: 1.5, fadeFn: vfade });

      // clots heaped at the trunk feet
      BL.verge(S, 41, [[0, 556, 1.3], [40, 560, 1.2], [70, 470, 0.9]].sort((a, b) => a[1] - b[1]), { count: 140, r: [0.6, 3.4], colours: vcol, spread: 10, spreadY: 3 });
      BL.verge(S, 42, [[300, 474, 0.9], [330, 562, 1.2], [360, 566, 1.3]], { count: 140, r: [0.6, 3.4], colours: vcol, spread: 10, spreadY: 3 });
      BL.splatter(S, 40, {
        count: 1800, near: 0.75, radius: 13, drips: 0.01,
        colours: [[C.red, 3], [C.crimson, 2], [C.cobalt, 1.5], [C.teal, 1.5], [C.ochre, 1], [C.black, 1]],
        fadeFn: (x, y) => clamp(1 - (dO(x, y) - OR * 0.8) / 70, 0, 1)
      });

      /* ------------------------------------------------ the light eats the inner edge */
      S.bloom(OX, OY, OR * 0.92, OR * 1.35, C.white, 1.0, { pow: 1.0, squash: SQ });
      S.bloom(OX, OY, OR * 1.1, OR * 2.4, C.warmWhite, 0.5, { pow: 2.2, crisp: 0.7, squash: SQ });

      /* ------------------------------------------------ the walker at the edge */
      const fx = OX - 2, fy = OY + OR / SQ * 0.9 + 6;
      // long shadow thrown back toward us
      for (let sdx = 1; sdx < 150; sdx++) {
        const y = fy + sdx, w = 0.8 + sdx * 0.025;
        for (let k = -w; k <= w; k += 1) {
          const x = Math.round(fx + k + sdx * 0.05);
          if (BL.bayer(x, y) < 0.62 - sdx / 260) S.px(x, y, sdx < 30 ? C.warmGreyMid : C.warmGrey);
        }
      }
      BL.figure(S, 'stride', fx, fy, C.black);
    }
  });
})();
