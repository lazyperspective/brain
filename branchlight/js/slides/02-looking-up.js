/* 02 — Looking up. Under the canopy the walker stops and tips their head back. Seen as a
 * wide upward view, the trunks rise from every edge of the frame and their strands braid
 * into a vortex that curls around one disc of white sky. The ground is a sliver of
 * curved path at the bottom edge, with the walker on it, looking up.
 */
(function () {
  'use strict';
  const BL = window.BL;
  const C = BL.C;
  const { mix, smooth, clamp } = BL;

  BL.slides.push({
    id: '02-looking-up',
    title: 'Looking up',
    seed: 2202,
    render(S) {
      const W = S.W, H = S.H;
      const DX = 180, DY = 262;            // the disc of sky
      const GR = 300, GX = 180, GY = H + GR - 50; // ground dome (fisheye) centre/radius
      const n = BL.noise(21), n2 = BL.noise(22);

      /* ------------------------------------------------ bright sky */
      S.fill((x, y) => {
        const dx = x - DX, dy = y - DY, d = Math.hypot(dx, dy);
        const ang = Math.atan2(dy, dx);
        const w = n.fbm(x * 0.01, y * 0.01, 4);
        // warm on the left, cool aqua on the right, gold near the opening
        let c = mix(C.apricotWhite, C.paleAqua, smooth(-0.6, 0.8, Math.cos(ang) + (w - 0.5) * 0.9));
        c = mix(c, C.peachPale, smooth(80, 330, d) * smooth(0.2, -0.9, Math.cos(ang)) * 0.8);
        c = mix(c, C.paleBlue, smooth(120, 380, d) * smooth(0.0, 0.9, Math.cos(ang)) * 0.6);
        c = mix(c, C.goldLight, Math.pow(clamp(1 - d / 180, 0, 1), 1.5) * 0.7);
        c = mix(c, C.paleGold, Math.pow(clamp(1 - d / 110, 0, 1), 1.2));
        c = mix(c, C.white, Math.pow(clamp(1 - d / 62, 0, 1), 0.8));
        // the ground dome
        const g = Math.hypot(x - GX, y - GY);
        if (g < GR) {
          const t = clamp((GR - g) / 60, 0, 1);
          let gc = mix(C.cream, C.sand, smooth(0, 1, t) * 0.7 + (n2.fbm(x * 0.05, y * 0.08, 3) - 0.5) * 0.4);
          c = gc;
        }
        return c;
      });
      S.snapshot();

      /* ------------------------------------------------ the dome of ground: cracked path */
      {
        const rr = BL.rng(77);
        const vn = BL.noise(23);
        for (let y = GY - GR; y < H; y++) for (let x = 0; x < W; x++) {
          const g = Math.hypot(x - GX, y - GY);
          if (g >= GR) continue;
          // the path runs from the walker down to the bottom edge, widening
          const t = (y - (GY - GR)) / 64;
          const pw = 18 + t * 90;
          const onPath = Math.abs(x - GX + (y - 600) * 0.15) < pw;
          if (!onPath) {
            const v = vn.fbm(x * 0.07, y * 0.14, 3);
            S.soft(x, y, mix(C.peach, C.salmon, smooth(0.35, 0.7, v)));
          } else {
            const v = vn.fbm(x * 0.06, y * 0.12, 4);
            if (Math.abs(v - 0.55) < 0.012) S.px(x, y, C.orange);
            else if (Math.abs(v - 0.42) < 0.01) S.px(x, y, C.darkOchre);
          }
        }
        // grit
        for (let i = 0; i < 260; i++) {
          const x = rr.range(0, W), y = rr.range(GY - GR + 4, H);
          if (Math.hypot(x - GX, y - GY) < GR - 2) S.px(x, y, rr.pick([C.umber, C.darkOchre, C.red, C.teal, C.warmGreyDark]));
        }
      }

      /* ------------------------------------------------ threads around the opening */
      BL.skyLines(S, 61, {
        count: 110,
        start: (r) => {
          const a = r() * Math.PI * 2, rr = r.range(70, 260);
          return [DX + Math.cos(a) * rr, DY + Math.sin(a) * rr, a + Math.PI / 2 * (r() < 0.75 ? 1 : -1) + r.range(-0.4, 0.4)];
        },
        len: [120, 380], curv: [-0.001, 0.0035],
        colours: [[C.red, 3], [C.vermilion, 2], [C.cobalt, 2], [C.teal, 2], [C.orange, 1.5], [C.crimson, 2], [C.gold, 1]],
        fade: [0.15, 0.5], dotted: 0.15, fadeEnds: 0.6
      });

      /* ------------------------------------------------ the trunks, from every edge */
      const cols = [
        [C.red, 3], [C.vermilion, 3], [C.crimson, 2.5], [C.orange, 2], [C.lightOrange, 0.8], [C.goldOchre, 1],
        [C.cobalt, 1.8], [C.blue, 1.2], [C.teal, 1.8], [C.tealLight, 1], [C.deepCrimson, 1.5],
        [C.umber, 1.5], [C.black, 1.2], [C.raspberry, 1]
      ];
      const trunks = [
        // ground-rooted trunks along the dome, leaning in hard (the centre is left open for the walker)
        { x: 6, y: 626, n: 56 }, { x: 62, y: 612, n: 34 }, { x: 118, y: 600, n: 26 },
        { x: 244, y: 600, n: 28 }, { x: 300, y: 610, n: 36 }, { x: 354, y: 628, n: 58 },
        // trunks entering from the edges (their roots are behind us, out of frame)
        { x: -30, y: 430, n: 64 }, { x: 390, y: 420, n: 68 },
        { x: -30, y: 190, n: 54 }, { x: 392, y: 170, n: 58 },
        { x: 40, y: -40, n: 48 }, { x: 300, y: -40, n: 50 }, { x: 175, y: -46, n: 36 }
      ];
      const field = BL.blend([
        [BL.ring(DX, DY, 78, 1, 0.8), 1],
        [(x, y) => Math.atan2(DY - y, DX - x), (x, y) => clamp((Math.hypot(x - DX, y - DY) - 120) / 140, 0, 1) * 1.0]
      ]);
      trunks.forEach((t, i) => {
        const ang = Math.atan2(DY - t.y, DX - t.x) + (t.y > 580 ? 0.12 : 0.25);
        BL.tree(S, 9000 + i * 31, {
          x: t.x, y: t.y, n: t.n, wp: 0.4, flare: t.y > 580 ? 1.0 : 0, angle: ang,
          trunkLen: Math.hypot(DX - t.x, DY - t.y) * (t.y > 580 ? 0.13 : 0.2), unit: 10, lenExp: 0.5, twigLen: 26, twigGens: 2,
          twigSpread: [0.12, 0.45], twigDecay: 0.85, colours: cols, depth: 0, twigFade: 0.08,
          field, pull: 0.02, spread: [0.45, 1.0], split: [0.28, 0.5], braid: 0.7,
          roots: t.y > 580 ? 12 : 0, rootLen: [8, 22], stray: 0.25, strayLen: [50, 180], wander: 0.006,
          back: C.plum, backMin: 8, marks: 0.25, bounds: 120
        });
      });

      /* ------------------------------------------------ clots at the roots */
      const vcol = [[C.teal, 3], [C.red, 3], [C.ochre, 2], [C.cobalt, 1.5], [C.vermilion, 2], [C.aqua, 1], [C.goldOchre, 1], [C.crimson, 1.5]];
      const rim = [];
      for (let a = Math.PI * 1.2; a <= Math.PI * 1.8; a += 0.02) rim.push([GX + Math.cos(a) * GR, GY + Math.sin(a) * GR + 2, 1]);
      rim.sort((p, q) => p[1] - q[1]);
      BL.verge(S, 71, rim, { count: 280, r: [0.6, 3.2], colours: vcol, spread: 3, spreadY: 2 });

      /* ------------------------------------------------ splatter */
      BL.splatter(S, 81, {
        count: 2600, near: 0.75, radius: 14, drips: 0.01,
        colours: [[C.red, 3], [C.vermilion, 2], [C.cobalt, 2], [C.teal, 2], [C.gold, 1.5], [C.orange, 1.5], [C.black, 1]],
        fadeFn: (x, y) => Math.pow(clamp(1 - Math.hypot(x - DX, y - DY) / 90, 0, 1), 1.2)
      });

      /* ------------------------------------------------ the walker, looking up */
      const fx = GX - 2, fy = GY - GR + 3;
      BL.castShadow(S, fx + 1, fy + 1, Math.PI / 2 + 0.1, 8, C.salmon, 2);
      BL.figure(S, 'up', fx, fy, C.black);

      /* ------------------------------------------------ the opening */
      S.bloom(DX, DY, 24, 70, C.white, 1.0, { pow: 1.2 });
      S.bloom(DX, DY, 40, 150, C.paleGold, 0.45, { pow: 2.4, crisp: 0.7 });
    }
  });
})();
