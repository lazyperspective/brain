// Features, wet into wet: brows, eyes, nose, moustache, mouth, the lines of the face; then restated
// contours and the last loaded lights.
(function (G) {
  'use strict';
  G.__paintFeatures = function (P, plan, K, rng) {
    const F = G.Face, C = plan.C, RG = plan.RG, mix = plan.mix;
    const { S, regAt, nz, jit, planCol } = K;
    const Geo = G.Geom;
    const base = { load: 1.0, opac: 0.97, imp: 0.85, rag: 0.15, bristle: 0.55, pick: 0.2, reach: 1.5, dryK: 0.5, touch: 0.3, endPile: 0.3 };
    const o = (extra) => Object.assign({}, base, extra);
    const wob = (pl, amp, f) => { const off = rng.next() * 100; f = f || 0.12; return pl.map((p, i) => [p[0] + amp * nz.n1(off + i * f), p[1] + amp * nz.n1(off + 33 + i * f)]); };
    const sub = (pl, a, b) => pl.slice(Math.floor(a * (pl.length - 1)), Math.ceil(b * (pl.length - 1)) + 1);
    const offset = (pl, dx, dy) => pl.map((p) => [p[0] + dx, p[1] + dy]);
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

    // ---------- eye sockets: deep cool shade under the brow, wrapping the hooded lids
    function socket(e, hood, near) {
      for (let i = 0; i < 10; i++) {
        const t = i / 9;
        const pl = hood.map((p, j) => [p[0] + (near ? -1 : 1) * t * 2, p[1] + 2 - t * 16 + 1.5 * Math.sin(j * 0.4 + i)]);
        const col = near ? (t < 0.6 ? rng.pick([C.violet, C.crimson, C.violet]) : rng.pick([C.rose, C.crimson])) : (t < 0.6 ? rng.pick([C.ultramarine, C.violet]) : rng.pick([C.cobalt, C.viridian]));
        S(wob(pl, 1.0), 7, 'both', o({ col: jit(col, 0.03), imp: 0.6, load: 1.0 }));
      }
      // shadow under the drooping outer hood
      const oc = e.outer;
      S([[oc[0] + (near ? 10 : -10), oc[1] - 8], [oc[0] + (near ? -8 : 8), oc[1] + 4]], 10, 'loaded', o({ col: near ? C.violet : C.ultramarine, imp: 0.5 }));
    }
    socket(F.eyeL, F.hoodL, true); socket(F.eyeR, F.hoodR, false);
    // ---------- the eyes: toned whites, a dark iris half-hidden by the heavy lid, a single catchlight
    function eyePaint(e, iris, hood, near) {
      const mid = e.up.map((p, j) => lerp(p, e.lo[e.lo.length - 1 - j] || p, 0.5));
      S(wob(mid, 0.4), 11, 'both', o({ col: jit(near ? mix(C.pinkWhite, C.lilac, 0.35) : mix(C.lilac, C.mint, 0.4), 0.02), imp: 0.5, cap: 1 }));
      const ic = iris.c, r = iris.r;
      // iris: two loaded touches, umber-violet and ultramarine, a warm glint low in the iris
      S([[ic[0] - r * 0.15, ic[1] - r * 0.1], [ic[0] + r * 0.15, ic[1] + r * 0.1]], r * 2.0, 'loaded', o({ col: [0.25, 0.10, 0.14], imp: 0.7, pick: 0.0, rag: 0.12, touch: 0, lift: 0.05, cap: 1, bristle: 0.4 }));
      S([[ic[0] - r * 0.5, ic[1] - r * 0.55], [ic[0] + r * 0.4, ic[1] - r * 0.6]], r * 0.8, 'loaded', o({ col: C.ultramarine, imp: 0.5, pick: 0, opac: 0.9, cap: 1 }));
      S([[ic[0] + r * 0.05, ic[1] + r * 0.55], [ic[0] + r * 0.5, ic[1] + r * 0.4]], r * 0.55, 'loaded', o({ col: near ? C.cadOrange : C.vermilion, imp: 0.5, opac: 0.85, load: 0.9, cap: 1, pick: 0 }));
      S([[ic[0] - r * 0.05, ic[1]], [ic[0] + r * 0.05, ic[1] + r * 0.05]], r * 0.85, 'loaded', o({ col: C.ink, imp: 0.4, pick: 0, rag: 0.1, cap: 1 }));
      // upper lid skin over the top of the iris (the hooded look)
      const lid = hood.map((p, j) => lerp(p, e.up[Math.min(e.up.length - 1, Math.round(j / (hood.length - 1) * (e.up.length - 1)))], 0.5));
      S(wob(lid, 0.5), 7.5, 'both', o({ col: jit(near ? C.pink : C.lilac, 0.03), imp: 0.7 }));
      // upper lash line: the strongest dark in the face
      S(wob(e.up, 0.5), near ? 6.5 : 7, 'loaded', o({ col: C.ink, load: 1.2, imp: 0.9, pick: 0.05, lift: 0.15 }));
      S(wob(sub(e.up, 0.3, 1), 0.6), 4.5, 'taper', o({ col: C.prussian, load: 1.1 }));
      // the hood fold drooping over the outer corner
      S(wob(hood, 0.8), 5, 'both', o({ col: jit(near ? C.crimson : C.ultramarine, 0.02), imp: 0.7 }));
      // lower lid
      S(wob(e.lo, 0.6), 3.6, 'both', o({ col: jit(near ? C.vermilion : C.crimson, 0.02), imp: 0.6 }));
      const cl = [ic[0] - r * 0.38, ic[1] - r * 0.05];
      S([[cl[0] - 0.8, cl[1] - 0.8], [cl[0] + 0.8, cl[1] + 0.6]], 5.5, 'loaded', o({ col: C.white, load: 1.4, imp: 1.6, pick: 0, opac: 1, rag: 0.05, cap: 1 }));
    }
    eyePaint(F.eyeL, F.irisL, F.hoodL, true); eyePaint(F.eyeR, F.irisR, F.hoodR, false);
    // bags and crow's feet: the warm crinkle
    for (const [bg, near, second] of [[F.bagL1, 1, 0], [F.bagL2, 1, 1], [F.bagR1, 0, 0], [F.bagR2, 0, 1]]) {
      const a0 = second ? 0.15 + rng.next() * 0.15 : 0.05, a1 = second ? 0.75 + rng.next() * 0.15 : 0.95;
      const pl = sub(bg, a0, a1);
      S(wob(pl, 1.0), second ? 3 : 3.6, 'both', o({ col: jit(near ? C.crimson : (second ? C.violet : C.crimson), 0.02), imp: 0.6 }));
      S(wob(offset(pl, 0, -5), 1.0), second ? 6 : 5, 'both', o({ col: jit(near ? C.lemonWhite : (second ? C.cadOrange : C.pink), 0.03), imp: 1.1, load: 1.1, opac: 0.85 }));
    }
    for (const c of F.crowL) S(wob(c, 0.5), 2.6, 'taper', o({ col: jit(C.rose, 0.03), imp: 0.5, opac: 0.7 }));
    for (const c of F.crowR) S(wob(c, 0.5), 2.6, 'taper', o({ col: jit(C.violet, 0.03), imp: 0.5, opac: 0.7 }));
    // ---------- brows: bushy, salt-and-pepper, hairs pulled from the inner end out and down
    function brow(poly, inner, outer, near) {
      const arc = (t) => { const p = lerp(inner, outer, t); return [p[0], p[1] - 13 * Math.sin(Math.PI * Math.min(1, t * 1.25)) + 40 * Math.max(0, t - 0.65) * Math.max(0, t - 0.65) * 4]; };
      // dark mass first
      for (let i = 0; i < 6; i++) {
        const t0 = rng.next() * 0.2, t1 = 0.75 + rng.next() * 0.25;
        const pl = []; for (let t = t0; t <= t1 + 1e-4; t += 0.05) { const p = arc(t); pl.push([p[0], p[1] + (i - 2.5) * 2.6]); }
        S(wob(pl, 1.4), 10 - Math.abs(i - 2.5) * 1.6, 'both', o({ col: jit(i % 2 ? (near ? C.violet : C.ultramarine) : C.prussian, 0.03), imp: 0.7 }));
      }
      // then the unruly hairs: grey, white, violet, a little orange
      const n = 18;
      for (let i = 0; i < n; i++) {
        const t = rng.next();
        const p = arc(t);
        const x = p[0] + rng.gauss() * 2.5, y = p[1] + rng.gauss() * 4;
        const dir = Math.atan2(outer[1] - inner[1], outer[0] - inner[0]) + (t < 0.2 ? -0.8 : t > 0.7 ? 0.55 : -0.1) + rng.gauss() * 0.3;
        const L = 14 + rng.next() * 18;
        const r = rng.next();
        const col = r < 0.35 ? (near ? C.violet : C.ultramarine) : r < 0.55 ? C.prussian : r < 0.85 ? (near ? mix(C.warmWhite, C.lilac, 0.4) : C.lilac) : C.cadOrange;
        S([[x, y], [x + Math.cos(dir) * L * 0.5, y + Math.sin(dir) * L * 0.5 - 1.5], [x + Math.cos(dir) * L, y + Math.sin(dir) * L]], 3.5 + rng.next() * 3.5, 'taper', o({ col: jit(col, 0.03), imp: 1.0, pick: 0.15 }));
      }
    }
    brow(F.browL, F.T([454, 502]), F.T([332, 516]), true);
    brow(F.browR, F.T([508, 502]), F.T([650, 516]), false);
    // glabella frown lines
    S(wob(F.frownL, 0.5), 2.4, 'both', o({ col: C.vermilion, imp: 0.5 }));
    S(wob(F.frownR, 0.5), 2.2, 'both', o({ col: C.crimson, imp: 0.5 }));
    // ---------- forehead wrinkles: a dark line with a lit ridge above, colour by plane
    for (let wi = 0; wi < F.wrinkles.length; wi++) {
      const w = F.wrinkles[wi];
      // each line is found in two or three gestures, broken where the brush lifted
      let t = rng.next() * 0.12;
      while (t < 0.92) {
        const len = 0.18 + rng.next() * 0.3; const t1 = Math.min(1, t + len);
        if (rng.next() > 0.15) {
          const dy = rng.gauss() * 2.5;
          const pl = offset(sub(w, t, t1), 0, dy); const mid = pl[pl.length >> 1];
          const bd = plan.band[(mid[1] | 0) * plan.PW + (mid[0] | 0)];
          const dark = bd >= 3 ? rng.pick([C.vermilion, C.rose, C.crimson]) : bd === 2 ? C.crimson : rng.pick([C.viridian, C.ultramarine]);
          const light = bd >= 3 ? rng.pick([C.lemonWhite, C.lemon]) : bd === 2 ? C.cadYellow : C.emeraldLt;
          S(wob(pl, 1.6, 0.08), 2.4 + rng.next() * 2.2, 'both', o({ col: jit(dark, 0.03), imp: 0.6 }));
          if (rng.next() < 0.8) S(wob(offset(pl, rng.gauss() * 4, -5 - rng.next() * 2), 1.6, 0.08), 3.5 + rng.next() * 2.5, 'both', o({ col: jit(light, 0.03), imp: 1.1, load: 1.1 }));
        }
        t = t1 + 0.02 + rng.next() * 0.08;
      }
    }
    // ---------- nose: lit ridge, green shadow plane, rosy tip, dark nostrils
    S(wob(F.noseShadowSide, 0.8), 9, 'loaded', o({ col: jit(C.emerald, 0.03), imp: 0.8 }));
    S(wob(offset(F.noseShadowSide, 6, 2), 0.8), 6, 'taper', o({ col: jit(C.turquoise, 0.03), imp: 0.7 }));
    S(wob(F.noseRidge, 0.5), 6.5, 'both', o({ col: jit(C.lemonWhite, 0.02), imp: 1.3, load: 1.2 }));
    S(wob(F.noseNearSide, 0.6), 3.4, 'both', o({ col: jit(C.cadOrange, 0.03), imp: 0.7 }));
    // nasolabial folds
    S(wob(F.nlL, 0.8), 4.5, 'both', o({ col: jit(C.crimson, 0.02), imp: 0.6 }));
    S(wob(offset(F.nlL, -6, -1), 0.8), 4.5, 'both', o({ col: jit(C.cadYellow, 0.03), imp: 1.0 }));
    S(wob(F.nlR, 0.8), 4.5, 'both', o({ col: jit(C.ultramarine, 0.02), imp: 0.6 }));
    // jowls & chin
    S(wob(F.jowlL, 0.6), 3.4, 'both', o({ col: C.crimson, imp: 0.5 }));
    S(wob(F.jowlR, 0.6), 3.4, 'both', o({ col: C.ultramarine, imp: 0.5 }));
    S(wob(F.chinCrease, 0.6), 4, 'both', o({ col: C.crimson, imp: 0.5 }));
    const ch = F.chin.c;
    S([[ch[0] - 22, ch[1] - 6], [ch[0] - 6, ch[1] - 14], [ch[0] + 8, ch[1] - 12]], 9, 'loaded', o({ col: C.cadYellow, imp: 1.1 }));
    // ---------- moustache: dark under-mass, then hairs raking down and out from under the nose
    const mouT = (t) => F.T([372 + t * 232, 650 + 5 * Math.sin(Math.PI * t) + (t > 0.85 ? (t - 0.85) * 150 : 0) + (t < 0.12 ? (0.12 - t) * 120 : 0)]);
    const mouLen = (t) => (80 + 10 * Math.sin(Math.PI * t)) * (t < 0.1 || t > 0.9 ? 0.75 : 1);
    // shadow under the nose where the moustache begins
    S(wob(G.Geom.open([F.T([408, 650]), F.T([440, 657]), F.T([470, 660]), F.T([500, 658]), F.T([540, 650])], 6), 0.6), 5, 'both', o({ col: [0.35, 0.06, 0.15], imp: 0.5 }));
    // the mass: broad strokes scattered through the shape, raking down and out, clipped to it
    const inM = (x, y) => regAt(x, y) === RG.MOUST;
    const mAng = (x, y) => { const t = Math.max(0, Math.min(1, (x - 372) / 232)); return Math.PI / 2 + (t - 0.5) * 1.5 + 0.15 * nz.n2(x / 20, y / 20); };
    const mPts = K.scatter(7, inM, [350, 630, 640, 760]);
    for (let layer = 0; layer < 3; layer++) {
      const pts0 = layer === 0 ? mPts : mPts.filter(() => rng.next() < (layer === 1 ? 0.75 : 0.35));
      for (const [x0, y0] of pts0) {
        const t = (x0 - 372) / 232; const lit = t < 0.5;
        const depth = (y0 - 650) / 85; // 0 top .. 1 bottom
        let col; const r = rng.next();
        if (layer === 0) col = r < 0.35 ? C.violet : r < 0.6 ? C.cobalt : r < 0.8 ? C.lilac : C.crimson;
        else if (layer === 1) col = depth > 0.6 ? (r < 0.5 ? C.lilac : r < 0.8 ? C.cerulean : C.skyWhite) : lit ? (r < 0.5 ? C.warmWhite : r < 0.75 ? C.lemonWhite : C.pinkWhite) : (r < 0.5 ? C.skyWhite : r < 0.8 ? C.lilac : C.mint);
        else col = depth < 0.5 ? (lit ? C.white : C.skyWhite) : C.lilac;
        let outS = -1; const extra = layer === 2 ? 0 : (rng.next() < 0.35 ? 4 + rng.next() * 14 : rng.next() * 4);
        const pts = K.trace(x0, y0, mAng, (layer === 2 ? 14 : 22) + rng.next() * 26, 2.5, (xx, yy, s) => { if (s < 6 || inM(xx, yy)) return true; if (yy < y0) return false; if (outS < 0) outS = s; return s - outS < extra; }, mAng(x0, y0));
        const w = layer === 0 ? 13 + rng.next() * 6 : layer === 1 ? 9 + rng.next() * 6 : 4.5 + rng.next() * 3;
        S(pts, w, layer === 2 ? 'both' : 'taper', o({ col: jit(col, 0.03), col2: jit(mix(col, C.white, 0.35), 0.02), mix2: 0.2, imp: layer === 2 ? 1.4 : 0.95, pick: 0.3, bristle: 0.45, lift: 0.4 }));
      }
    }
    const nt = F.noseTip.c;
    // underside of the nose: a dark warm plane that separates it from the moustache
    S(wob(G.Geom.open([F.T([426, 646]), F.T([450, 652]), F.T([470, 654]), F.T([492, 653]), F.T([516, 646])], 6), 0.5), 9, 'both', o({ col: [0.55, 0.1, 0.22], imp: 0.5 }));
    // the bulb of the tip: one big warm form, turned by a cooler underside and a hot light
    const arcP = (dy, bow, sx) => { const out = []; for (let t = -1; t <= 1.0001; t += 0.2) out.push([nt[0] + t * sx, nt[1] + dy - bow * (1 - t * t)]); return out; };
    S(arcP(-6, 8, 20), 15, 'both', o({ col: jit(C.cadOrange, 0.02), imp: 0.9, pick: 0.05 }));
    S(arcP(5, -6, 23), 15, 'both', o({ col: jit(mix(C.vermilion, C.rose, 0.5), 0.02), imp: 0.9, pick: 0.05 }));
    S(arcP(14, -8, 19), 10, 'both', o({ col: jit(C.crimson, 0.02), imp: 0.7, pick: 0.05 }));
    S([[nt[0] - 10, nt[1] - 10], [nt[0] - 4, nt[1] - 11]], 7, 'loaded', o({ col: C.pinkWhite, load: 1.4, imp: 1.8, opac: 1, cap: 1, rag: 0.08 }));
    // alae
    for (const [al, near] of [[F.alaL, 1], [F.alaR, 0]]) {
      const c = al.c, r = al.r;
      S([[c[0] - 4, c[1] - 2], [c[0] + 4, c[1] + 1]], r * 1.3, 'loaded', o({ col: jit(near ? C.cadOrange : mix(C.violet, C.rose, 0.4), 0.03), imp: 0.8, cap: 1 }));
      const arc = []; for (let t = 0; t <= 1.0001; t += 0.1) { const a = near ? Math.PI * (0.95 + t * 0.75) : Math.PI * (0.05 - t * 0.75); arc.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r * 0.9]); }
      S(wob(arc, 0.5), 4, 'both', o({ col: jit(near ? C.crimson : C.ultramarine, 0.02), imp: 0.6 }));
    }
    // nostrils: solid soft darks, not lines
    const nL = F.T([450, 651]), nR = F.T([491, 652]);
    S([[nL[0] - 5, nL[1] + 1], [nL[0] + 5, nL[1] - 1]], 8, 'loaded', o({ col: [0.30, 0.04, 0.12], imp: 0.4, pick: 0.05, cap: 1, bristle: 0.2, rag: 0.08 }));
    S([[nR[0] - 6, nR[1] - 1], [nR[0] + 6, nR[1] + 1]], 8, 'loaded', o({ col: C.ink, imp: 0.4, pick: 0.05, cap: 1, bristle: 0.2, rag: 0.08 }));
    // ---------- mouth: lower lip under the moustache's edge, the right corner lifting: the half-smile
    S(wob([F.T([424, 744]), F.T([452, 748]), F.T([480, 749]), F.T([510, 746]), F.T([540, 735]), F.T([552, 727])], 0.5), 5, 'loaded', o({ col: C.ink, imp: 0.5, pick: 0.05 }));
    for (let i = 0; i < 5; i++) {
      const y = 748 + i * 4.4;
      const pl = [F.T([436 + i * 3, y]), F.T([480, y + 1.5]), F.T([524 - i * 4, y - 6 + i * 0.8])];
      S(wob(pl, 0.5), 6.5, 'loaded', o({ col: jit(i === 0 ? [0.45, 0.04, 0.16] : i < 3 ? C.crimson : mix(C.crimson, C.rose, 0.5), 0.02), imp: 0.8, cap: 1, pick: 0.05 }));
    }
    S(wob([F.T([452, 760]), F.T([476, 762]), F.T([500, 759])], 0.4), 5, 'both', o({ col: C.pink, imp: 1.4, load: 1.25, pick: 0 }));
    S(wob([F.T([438, 774]), F.T([478, 779]), F.T([518, 771])], 0.5), 7, 'both', o({ col: C.violet, imp: 0.5, opac: 0.9 }));
    S(wob([F.T([446, 786]), F.T([482, 792]), F.T([520, 784])], 0.6), 12, 'both', o({ col: C.cadYellow, imp: 1.0, opac: 0.9 }));
    // smile: crease lifting from the right corner into the cheek, a small dimple on the left
    S(wob([F.T([546, 726]), F.T([560, 716]), F.T([566, 700])], 0.4), 3.5, 'taper', o({ col: C.crimson, imp: 0.5 }));
    S(wob([F.T([552, 732]), F.T([568, 722]), F.T([574, 704])], 0.4), 4, 'taper', o({ col: C.cadOrange, imp: 1.0 }));
    S([F.T([424, 742]), F.T([414, 739]), F.T([408, 742])], 3, 'taper', o({ col: C.crimson, imp: 0.5 }));
    // grey-blue tips along the ragged lower edge, overhanging the lip
    for (let i = 0; i < 26; i++) {
      const t = 0.05 + rng.next() * 0.9; const p = mouT(t);
      const dir = Math.PI / 2 + (t - 0.5) * 1.35;
      const L = mouLen(t);
      const ex = p[0] + Math.cos(dir) * L * 0.85, ey = p[1] + Math.sin(dir) * L * 0.85;
      S([[ex, ey], [ex + Math.cos(dir) * 14, ey + Math.sin(dir) * 14]], 3.5 + rng.next() * 3, 'taper', o({ col: jit(rng.pick([C.lilac, C.cerulean, C.violet, C.skyWhite]), 0.03), imp: 0.8 }));
    }
      // ---------- restated contours: broken ultramarine lines, found and lost (session 4)
    P.session = 4;
    const ct = (pl, w, col) => {
      let t = rng.next() * 0.08;
      while (t < 0.95) {
        const t1 = Math.min(1, t + 0.15 + rng.next() * 0.3);
        if (rng.next() > 0.22) S(wob(sub(pl, t, t1), 1.2, 0.06), w * (0.75 + rng.next() * 0.5), 'both', o({ col: jit(col, 0.03), imp: 0.9, load: 1.1, pick: 0.15, rag: 0.25 }));
        t = t1 + 0.03 + rng.next() * 0.1;
      }
    };
    const fc = F.face, n8 = 8;
    ct(fc.slice(1 * n8, 9 * n8 + 1), 10, C.ultramarine);          // near cheek, jaw, chin
    ct(fc.slice(9 * n8, 15 * n8 + 1), 9, C.prussian);          // far jaw into the ear
    ct(F.earR.slice(2, F.earR.length - 6), 7, C.ultramarine);
    ct(sub(F.noseNearSide, 0.3, 1), 3.5, C.crimson);
    for (const cl of [F.collarL, F.collarR]) ct(cl.slice(0, Math.floor(cl.length * 0.6)), 8, C.ultramarine);
    ct(F.jacket.slice(0, Math.floor(F.jacket.length * 0.3)), 12, C.ink);
    ct(F.jacket.slice(Math.floor(F.jacket.length * 0.62), Math.floor(F.jacket.length * 0.94)), 12, C.ink);
      // ---------- last loaded lights: thick, single touches where the light hits hardest
    const dab = (pts, w, col, imp) => S(pts.map((p) => F.T(p)), w, 'loaded', o({ col: jit(col, 0.02), load: 1.35, imp: imp || 1.7, pick: 0.12, cap: 1, lift: 0.4 }));
    dab([[392, 395], [430, 388], [462, 392]], 11, C.lemonWhite);
    dab([[372, 425], [400, 421]], 9, C.pinkWhite);
    dab([[420, 330], [452, 322], [480, 324]], 10, C.lemonWhite);
    dab([[340, 588], [352, 610], [358, 632]], 10, C.lemon);
    dab([[372, 572], [392, 568]], 8, C.pinkWhite);
    dab([[478, 520], [476, 548]], 6, C.lemonWhite, 1.9);
    dab([[540, 572], [566, 576]], 7, C.lemon);
    dab([[464, 800], [488, 796]], 9, C.lemon);
  };
})(window);
