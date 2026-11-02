/* 01 — The way in. Dawn. One enormous strand-tree holds the right side; the path swings
 * past its roots and bends back left into a far tunnel of trees that curls around a
 * white light. The walker has just set out.
 */
(function () {
  'use strict';
  const BL = window.BL;
  const C = BL.C;
  const { mix, smooth, clamp } = BL;

  BL.slides.push({
    id: '01-the-way-in',
    title: 'The way in',
    seed: 1101,
    render(S) {
      const W = S.W, H = S.H;
      const VX = 146, VY = 318;          // the light / vanishing point
      const yH = 322;                    // horizon
      const n = BL.noise(11), n2 = BL.noise(12);

      /* ------------------------------------------------ haze: dawn */
      S.fill((x, y) => {
        const fx = x / W, fy = y / H;
        // cool lilac-grey on the left, apricot-rose on the right, cream high up
        const wash = n.fbm(x * 0.008, y * 0.006, 4);
        let c = mix(C.lilacWhite, C.peachPale, smooth(0.25, 0.85, fx + (wash - 0.5) * 0.5));
        c = mix(c, C.peach, smooth(0.55, 1.0, fx) * smooth(0.25, 0.6, fy) * smooth(0.95, 0.6, fy) * 0.7);
        c = mix(c, C.lilac, smooth(0.45, 0.0, fx) * smooth(0.3, 0.7, fy) * 0.45 * (0.6 + wash));
        c = mix(c, C.warmWhite, smooth(0.35, 0.0, fy) * 0.55);
        // ground below the horizon: blush banks, warmer and darker toward the viewer
        if (y > yH) {
          const g = smooth(yH, H, y + (n2.fbm(x * 0.02, y * 0.05, 3) - 0.5) * 60);
          let gc = mix(C.blush, C.peachPale, smooth(0.0, 0.6, g));
          gc = mix(gc, C.peach, smooth(0.5, 1.0, g) * (0.5 + 0.5 * n2.fbm(x * 0.03, y * 0.03, 3)));
          gc = mix(gc, C.lilac, smooth(0.5, 0.0, fx) * g * 0.5);
          c = mix(c, gc, smooth(yH, yH + 30, y));
        }
        // the light
        const d = Math.hypot(x - VX, (y - VY) * 1.05);
        c = mix(c, C.warmWhite, Math.pow(clamp(1 - d / 170, 0, 1), 1.8) * 0.85);
        c = mix(c, C.white, Math.pow(clamp(1 - d / 70, 0, 1), 1.4));
        return c;
      });
      S.snapshot();

      /* ------------------------------------------------ path */
      const X = BL.spline([1, 1.35, 1.9, 2.8, 4.5, 8, 30], [-0.75, 0.15, 0.85, 0.85, 0.45, 0.12, 0]);
      const path = BL.path(S, 21, {
        horizon: yH, vpX: VX, scale: 118, halfW: 0.95, centre: X, top: yH + 2,
        plate: [3.2, 1.6], crackW: 0.16, grit: 900, detailFrom: 0.1,
        gritColours: [[C.umber, 2], [C.warmGreyMid, 2], [C.darkOchre, 2], [C.red, 1], [C.teal, 0.6], [C.ink, 0.6]],
        farFade: (u) => Math.pow(clamp(1 - u / 0.42, 0, 1), 1.6) * 0.95
      });

      const strandCols = [
        [C.crimson, 3], [C.red, 2.4], [C.vermilion, 2], [C.orange, 1.6], [C.deepCrimson, 1.6],
        [C.cobalt, 1.8], [C.blue, 0.8], [C.teal, 1.4], [C.tealLight, 0.5],
        [C.umber, 1.8], [C.darkUmber, 1.4], [C.black, 1.4], [C.brown, 1]
      ];
      const farCols = [
        [C.crimson, 2], [C.red, 1.5], [C.vermilion, 1], [C.umber, 2], [C.slateDark, 2],
        [C.cobalt, 1], [C.teal, 0.8], [C.violet, 1.2], [C.darkUmber, 1]
      ];

      /* ------------------------------------------------ long thrown lines */
      const flowL = BL.swirl(VX, VY, 1, 0.55, 0.15);
      const flowR = BL.swirl(VX, VY, -1, 0.55, 0.15);
      BL.skyLines(S, 31, {
        count: 90,
        start: (r) => {
          const x = r.range(-40, W + 40), y = r.range(-30, yH - 20);
          const f = x < VX ? flowL : flowR;
          return [x, y, f(x, y) + r.range(-0.5, 0.5) + (r() < 0.5 ? Math.PI : 0)];
        },
        len: [120, 420], curv: [-0.004, 0.004], dcurv: 0.00001,
        colours: [[C.crimson, 3], [C.red, 2], [C.cobalt, 2], [C.slateDark, 2], [C.umber, 2], [C.vermilion, 1], [C.teal, 1], [C.black, 1]],
        fade: [0.25, 0.7], dotted: 0.3, fadeEnds: 0.6, clipY: yH + 20
      });

      // a second set flung outward from the tunnel, spiralling to the frame edges
      BL.skyLines(S, 32, {
        count: 70,
        start: (r) => {
          const a = r.range(-Math.PI * 1.05, 0.05), rr = r.range(55, 120);
          const x = VX + Math.cos(a) * rr, y = VY + Math.sin(a) * rr * 1.1;
          return [x, y, a + (x < VX ? 0.5 : -0.5) + r.range(-0.2, 0.2)];
        },
        len: [140, 380], curv: [-0.0025, 0.0025],
        colours: [[C.crimson, 3], [C.red, 2], [C.cobalt, 1.5], [C.umber, 2], [C.vermilion, 1], [C.teal, 1], [C.slateDark, 1]],
        fade: [0.2, 0.55], dotted: 0.15, fadeEnds: 0.7, clipY: yH + 20
      });

      /* ------------------------------------------------ the far tunnel */
      // Trees along both verges, from the light outward; each one smaller, paler, finer.
      const rows = [];
      const us = [0.045, 0.06, 0.075, 0.095, 0.12, 0.15, 0.19, 0.24, 0.3];
      us.forEach((u, k) => {
        const y = yH + u * (H - yH);
        const z = 1 / u;
        const cx = VX + X(z) * u * 118;
        const hw = 0.95 * u * 118;
        rows.push({ u, side: -1, x: cx - hw - (8 + 30 * u) - 4 * u * 118 * 0.1 * (k % 2), y, k });
        if (u < 0.27) rows.push({ u, side: 1, x: cx + hw + (6 + 26 * u), y: y + 1, k });
      });
      rows.sort((a, b) => a.u - b.u);
      rows.forEach((t, i) => {
        const sc = t.u / 0.3;
        const lean = t.side < 0 ? 0.35 : -0.35;
        const R = 22 + 70 * sc;
        BL.tree(S, 500 + i * 17, {
          x: t.x, y: t.y, n: Math.round(7 + 22 * sc), wp: 0.45, angle: -Math.PI / 2 + lean,
          trunkLen: 10 + 30 * sc, unit: 4 + 8 * sc, lenExp: 0.5, twigLen: 6 + 10 * sc, twigGens: sc < 0.4 ? 3 : 4,
          colours: sc < 0.6 ? farCols : strandCols,
          depth: 0.7 * (1 - sc) + 0.1, twigFade: 0.06,
          field: BL.ring(VX, VY - 4, R, t.side < 0 ? 1 : -1, 0.9, 1.15), pull: 0.045,
          spread: [0.25, 0.6], split: [0.2, 0.45], roots: Math.round(2 + 4 * sc), rootLen: [3, 8 + 10 * sc],
          stray: 0.15, strayLen: [20, 90], wander: 0.008, marks: 0.12,
          back: C.darkUmber, backMin: 10
        });
      });

      /* ------------------------------------------------ verges: clots of paint */
      const vcol = [[C.teal, 3], [C.tealLight, 1.5], [C.red, 2.5], [C.vermilion, 1.5], [C.ochre, 2], [C.goldOchre, 1],
        [C.cobalt, 1.5], [C.crimson, 1.5], [C.umber, 1], [C.aqua, 0.7], [C.orange, 1]];
      const vfade = (x, y) => Math.pow(clamp(1 - (y - yH) / 150, 0, 1), 1.4) * 0.85;
      // dense, flattened clots along both verges, larger toward the viewer
      const vL = path.edges.left.map((p) => [p[0] - 6 * p[2], p[1], 0.35 + p[2] * 1.3]);
      const vR = path.edges.right.map((p) => [p[0] + 6 * p[2], p[1], 0.35 + p[2] * 1.3]);
      BL.verge(S, 41, vL, { count: 900, r: [0.5, 2.6], colours: vcol, spread: 6, spreadY: 1.5, fadeFn: vfade });
      BL.verge(S, 42, vR, { count: 700, r: [0.5, 2.4], colours: vcol, spread: 5, spreadY: 1.5, fadeFn: vfade });

      /* ------------------------------------------------ the great tree */
      const bigX = 290, bigY = 488;
      BL.tree(S, 777, {
        x: bigX, y: bigY, n: 136, wp: 0.34, flare: 1.1, angle: -Math.PI / 2 - 0.08, trunkCurv: -0.004, split: [0.2, 0.46],
        trunkLen: 92, unit: 11.5, lenExp: 0.5, twigLen: 28, twigGens: 3, twigDecay: 0.86, twigSpread: [0.12, 0.42],
        colours: strandCols, depth: 0, twigFade: 0.08, taper: 0.3,
        field: BL.blend([
          [BL.fan(bigX + 70, bigY + 90), 1],
          [BL.swirl(VX, VY, -1, 0.2, 0.2), (x, y) => 2.2 * Math.max(0, 1 - Math.hypot(x - VX, y - VY) / 230)]
        ]),
        back: C.plum, backMin: 8, backW: 0.75,
        pull: 0.02, spread: [0.4, 1.0], braid: 0.7,
        roots: 26, rootLen: [10, 38], stray: 0.22, strayLen: [60, 200], wander: 0.006, curl: 0.003,
        rim: { col: C.peach, amt: 0.35, side: 1 }, marks: 0.3
      });
      // a second, smaller tree on the near left bank, mostly out of frame — a frame for the eye
      BL.tree(S, 913, {
        x: -14, y: 600, n: 64, wp: 0.4, flare: 0.8, angle: -Math.PI / 2 + 0.3, trunkLen: 90, unit: 10.5, lenExp: 0.5, twigLen: 26,
        twigGens: 3, twigSpread: [0.12, 0.42], colours: strandCols, depth: 0.04, split: [0.2, 0.45], spread: [0.35, 0.9],
        field: BL.blend([[BL.fan(-40, 700), 1], [BL.ring(VX, VY - 30, 150, 1, 0.5, 1.2), (x, y) => (y < 420 ? 1.6 : 0.3)]]), pull: 0.02, roots: 8, stray: 0.22, strayLen: [60, 180],
        back: C.plum
      });

      // near-verge clots heaped at the roots
      BL.verge(S, 43, [[bigX - 40, bigY + 4, 1.2], [bigX - 10, bigY + 8, 1.3], [bigX + 30, bigY + 6, 1.2], [bigX + 70, bigY + 2, 1]],
        { count: 320, r: [0.8, 3.4], colours: vcol, spread: 9, spreadY: 2.5 });
      BL.verge(S, 44, [[0, 566, 1.2], [26, 572, 1.3], [52, 590, 1.2]], { count: 90, r: [0.8, 3.6], colours: vcol, spread: 6, spreadY: 3 });

      /* ------------------------------------------------ splatter */
      BL.splatter(S, 51, {
        count: 2000, near: 0.75, radius: 12, drips: 0.012,
        colours: [[C.red, 3], [C.crimson, 2], [C.vermilion, 2], [C.cobalt, 1.5], [C.teal, 1.5], [C.ochre, 1.5], [C.black, 1], [C.orange, 1]],
        fadeFn: (x, y) => Math.pow(clamp(1 - Math.hypot(x - VX, y - VY) / 90, 0, 1), 1.2)
      });

      /* ------------------------------------------------ the light swallows what is near it */
      S.bloom(VX, VY, 20, 78, C.white, 1.0, { pow: 1.3 });
      S.bloom(VX, VY, 34, 150, C.warmWhite, 0.55, { pow: 2.2, crisp: 0.8 });

      /* ------------------------------------------------ the walker (after the bloom, so the light never bleaches them) */
      const fy = yH + 0.2 * (H - yH);
      const fx = VX + X(5) * 0.2 * 118 + 2;
      BL.castShadow(S, fx, fy + 1, Math.PI / 2 + 0.35, 14, C.peach, 2);
      BL.figure(S, 'walk', fx, fy, C.black);

    }
  });
})();
