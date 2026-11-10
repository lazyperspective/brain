// lan.js — the lantern ("me"): hand-drawn sprites at six sizes + banded glow.
(function (g) {
  'use strict';
  const P = g.PX, C = P.C, L = P.LUT;
  const M = { k: C.A1, m: C.A2, n: C.A3, o: C.A4, 4: C.A4, 5: C.A5, 6: C.A6, 7: C.A7, 8: C.A8, d: C.A0 };
  const SP = [
    P.spr(['5', '7'], M),
    P.spr(['.m.', '575', '.m.'], M),
    P.spr(['.k.', '565', '686', '565', '.m.'], M),
    P.spr(['..k..', '.mnm.', 'k565k', 'k686k', 'k575k', 'k565k', '.mnm.'], M),
    P.spr(['...kkk...', '...k.k...', '..mnnnm..', '.kkkkkkk.', '.k45654k.', '.k56765k.', '.k57875k.', '.k57875k.', '.k56765k.', '.k45654k.', '.kkkkkkk.', '..mnnnm..'], M),
    P.spr(['.....kkk.....', '....k...k....', '....k...k....', '....mnnnm....', '...mnooonm...', '..kkkkkkkkk..',
      '..k4556554k..', '..k4567654k..', '..k5678765k..', '..k5688865k..', '..k5788875k..', '..k5788875k..', '..k5678765k..', '..k4567654k..',
      '..kkkkkkkkk..', '...mnnnnnm...', '..mmnnonnmm..'], M)
  ];
  // unlit versions (cold glass, for the window going dark)
  const MD = { k: C.N2, m: C.N3, n: C.N4, o: C.N5, 4: C.N3, 5: C.N3, 6: C.N4, 7: C.N4, 8: C.N5 };
  const SPD = [
    P.spr(['3', '4'], { 3: C.N3, 4: C.N4 }), P.spr(['.m.', 'm4m', '.m.'], MD),
    P.spr(['.k.', '565', '686', '565', '.m.'], MD), P.spr(['..k..', '.mnm.', 'k565k', 'k686k', 'k575k', 'k565k', '.mnm.'], MD),
    P.spr(['...kkk...', '...k.k...', '..mnnnm..', '.kkkkkkk.', '.k45654k.', '.k56765k.', '.k57875k.', '.k57875k.', '.k56765k.', '.k45654k.', '.kkkkkkk.', '..mnnnm..'], MD),
    P.spr(['.....kkk.....', '....k...k....', '....k...k....', '....mnnnm....', '...mnooonm...', '..kkkkkkkkk..',
      '..k4556554k..', '..k4567654k..', '..k5678765k..', '..k5688865k..', '..k5788875k..', '..k5788875k..', '..k5678765k..', '..k4567654k..',
      '..kkkkkkkkk..', '...mnnnnnm...', '..mmnnonnmm..'], MD)
  ];
  const GLOW = [null, null, [[3, 5], 0], [[4, 7, 10], 0], [[6, 9, 13, 18], 0], [[9, 13, 18, 24, 31], 0]];
  // glow bands: night darks go straight onto the amber ramp (no grey in-betweens), lighter things step up
  function bandLUT(k) { // k: 0 inner .. 4 outer
    const base = [C.A3, C.A2, C.A1, C.A0, C.A0][k], hi = [C.A4, C.A3, C.A2, C.A1, C.A1][k], T = P.idLUT();
    [C.N0, C.N1, C.N2].forEach(c => { T[c] = base; });
    if (k === 4) T[C.N2] = C.A0;
    [C.N3, C.N4, C.T0, C.V0, C.R0, C.M0, C.A0].forEach(c => { T[c] = k < 4 ? hi : base; });
    if (k < 3) { [C.N5, C.N6, C.N7, C.M1, C.A1, C.A2].forEach(c => { T[c] = [C.A5, C.A4, C.A3][k]; }); [C.N8, C.N9].forEach(c => { T[c] = [C.A6, C.A5, C.A4][k]; }); }
    return T;
  }
  const GL = [0, 1, 2, 3, 4].map(bandLUT);
  // draw lantern of size index s centred at (cx,cy). lit 0..1 (dithered), glow 0..1 scales the bands
  function draw(b, cx, cy, s, o) {
    o = o || {};
    const sp = SP[s], x = Math.round(cx - sp.w / 2), y = Math.round(cy - sp.h / 2);
    const lit = o.lit === undefined ? 1 : o.lit, gl = o.glow === undefined ? lit : o.glow;
    if (gl > 0 && GLOW[s] && !o.noGlow) {
      const rad = GLOW[s][0], n = rad.length;
      const k = Math.max(1, Math.round(n * gl));           // number of bands lit (grows in steps, like a flame catching)
      const r = rad.slice(0, k), lu = GL.slice(0, k).map((q, i) => GL[Math.min(4, i + (n - k))]);
      P.glow(b, cx, cy + (s === 5 ? 2 : 0), r.map(v => v * (o.gscale || 1)), lu, { dw: o.dw === undefined ? 2 : o.dw, clip: o.clip });
    }
    if (lit >= 1) P.blit(b, sp, x, y);
    else { P.blit(b, SPD[s], x, y); if (lit > 0) P.blit(b, sp, x, y, { lv: Math.round(lit * 16) }); }
  }
  g.LAN = { SP, SPD, draw };
})(typeof window !== 'undefined' ? window : globalThis);
