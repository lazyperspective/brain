// The painting, sitting by sitting: underdrawing, scrubbed block-in, loaded alla-prima body,
// features, restated contours, last impasto lights.
(function (G) {
  'use strict';
  const TAU = Math.PI * 2;

  function makeKit(P, plan, seed) {
    const W = P.W, k = W / 1000, rng = G.RNG(seed), nz = G.Noise(seed + 5);
    const { reg, PW, PH } = plan;
    const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
    const regAt = (x, y) => { const xi = x | 0, yi = y | 0; if (xi < 0 || yi < 0 || xi >= PW || yi >= PH) return 0; return reg[yi * PW + xi]; };
    const planCol = (x, y) => { const i = ((y | 0) * PW + (x | 0)) * 3; return [plan.col[i], plan.col[i + 1], plan.col[i + 2]]; };
    const bandAt = (x, y) => plan.band[(y | 0) * PW + (x | 0)];
    const jit = (c, a) => {
      const g = rng.gauss() * a;
      return [clamp01(c[0] + g + rng.gauss() * a * 0.45), clamp01(c[1] + g + rng.gauss() * a * 0.45), clamp01(c[2] + g + rng.gauss() * a * 0.45)];
    };
    function widths(n, L, w, prof) {
      const ws = new Float32Array(n);
      const wob = rng.next() * 100;
      for (let i = 0; i < n; i++) {
        const u = n > 1 ? i / (n - 1) : 0;
        let f;
        if (prof === 'taper') f = (0.55 + 0.45 * Math.min(1, u / 0.08)) * Math.pow(Math.max(0, 1 - u), 0.75) + 0.06;
        else if (prof === 'both') f = Math.pow(Math.sin(Math.PI * Math.min(0.999, Math.max(0.001, u))), 0.55) + 0.05;
        else if (prof === 'flick') f = Math.min(1, u / 0.25) * Math.pow(Math.max(0, 1 - u), 0.6) + 0.08;
        else f = (0.6 + 0.4 * Math.sqrt(Math.min(1, u / 0.12))) * (1 - 0.3 * Math.pow(Math.max(0, (u - 0.7) / 0.3), 1.5));
        f *= 1 + 0.08 * nz.n1(wob + u * 4);
        ws[i] = Math.max(0.6, w * k * f);
      }
      return ws;
    }
    // design-space polyline -> brush stroke
    function S(pts, w, prof, o) {
      if (pts.length < 2) return;
      const sp = Math.max(1.2, Math.min(w * 0.45, 12));
      let rs = G.Geom.resample(pts, sp);
      if (rs.length < 2) rs = [pts[0], pts[pts.length - 1]];
      const n = rs.length; const xs = new Float32Array(n), ys = new Float32Array(n);
      for (let i = 0; i < n; i++) { xs[i] = rs[i][0] * k; ys[i] = rs[i][1] * k; }
      P.stroke(xs, ys, widths(n, 0, w, prof), o);
    }
    function trace(x, y, angFn, L, step, keep, a0) {
      const pts = [[x, y]]; let pdx = 0, pdy = 0, s = 0, first = true;
      if (a0 != null) { pdx = Math.cos(a0); pdy = Math.sin(a0); first = false; }
      while (s < L) {
        const a = angFn(x, y); let dx = Math.cos(a), dy = Math.sin(a);
        if (first) { if (rng.next() < 0.5) { dx = -dx; dy = -dy; } first = false; }
        else {
          if (dx * pdx + dy * pdy < 0) { dx = -dx; dy = -dy; }
          dx = pdx * 0.55 + dx * 0.45; dy = pdy * 0.55 + dy * 0.45; const l = Math.hypot(dx, dy); dx /= l; dy /= l;
        }
        const nx = x + dx * step, ny = y + dy * step;
        if (keep && !keep(nx, ny, s)) break;
        x = nx; y = ny; s += step; pts.push([x, y]); pdx = dx; pdy = dy;
      }
      return pts;
    }
    // jittered points inside a region set
    function scatter(sp, test, bbox) {
      const pts = [];
      const [x0, y0, x1, y1] = bbox || [0, 0, 1000, 1250];
      for (let y = y0; y < y1; y += sp) for (let x = x0; x < x1; x += sp) {
        const px = x + rng.next() * sp, py = y + rng.next() * sp;
        if (test(px, py)) pts.push([px, py]);
      }
      for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); const t = pts[i]; pts[i] = pts[j]; pts[j] = t; }
      return pts;
    }
    return { k, rng, nz, regAt, planCol, bandAt, jit, S, trace, scatter, clamp01 };
  }

  G.paintPortrait = function (P, plan, seed, log) {
    const F = G.Face, C = plan.C, RG = plan.RG, mix = plan.mix;
    const K = makeKit(P, plan, seed);
    const { rng, nz, regAt, planCol, bandAt, jit, S, trace, scatter } = K;
    const inR = (set) => (x, y) => set.includes(regAt(x, y));
    const HEADREGS = [RG.FACE, RG.BROW, RG.EYE, RG.LIP, RG.MOUST];

    // ---------------- background colour design ----------------
    const split = (y) => 468 + 26 * Math.sin(y / 170) + 0.06 * (y - 600);
    function bgCol(x, y) {
      const sx = x - split(y);
      if (sx < 0) {
        // emerald field, cobalt toward the top-left corner, sap green low
        const top = Math.max(0, 1 - (x * 0.55 + y) / 520);
        let c = mix(C.emerald, C.viridian, 0.25 + 0.25 * nz.fbm(x / 200, y / 200, 2));
        c = mix(c, C.cobalt, Math.min(1, top * 1.4));
        c = mix(c, mix(C.emeraldLt, C.sap, 0.4), Math.max(0, (y - 760) / 500) * 0.7);
        return c;
      } else {
        const top = Math.max(0, 1 - ((1000 - x) * 0.6 + y) / 480);
        let c = mix(C.vermilion, C.cadOrange, Math.max(0, Math.min(1, (y - 520) / 500)) * 0.85);
        c = mix(c, C.crimson, top * 0.7);
        return c;
      }
    }
    // strokes swing around the head like a charged field, settling into diagonals toward the edges
    const hcx = F.headCenter[0], hcy = F.headCenter[1] + 40;
    const bgAng = (x, y) => {
      const dx = x - hcx, dy = (y - hcy) * 0.85; const d = Math.hypot(dx, dy);
      const tang = Math.atan2(dy, dx) + Math.PI / 2;
      const side = x < split(y) ? -1 : 1;
      const diag = (side < 0 ? -1.0 : 1.2) + 0.5 * nz.fbm(x / 300 + 7, y / 300, 2);
      const wT = Math.max(0, Math.min(1, 1.2 - d / 520)) * 0.55;
      // blend angles on the doubled circle (directions are unsigned)
      const cx = (1 - wT) * Math.cos(2 * diag) + wT * Math.cos(2 * tang), cy = (1 - wT) * Math.sin(2 * diag) + wT * Math.sin(2 * tang);
      return 0.5 * Math.atan2(cy, cx) + 0.25 * nz.n2(x / 140, y / 140);
    };

    // ======== 1. underdrawing (thin ultramarine, searching lines) ========
    P.session = 1;
    const ud = { col: [0.22, 0.27, 0.66], load: 0.7, opac: 0.75, imp: 0.04, rag: 0.35, bristle: 0.5, wash: true, pick: 0, reach: 3, touch: 0.1 };
    const udLines = [F.face, F.hairlineCtl, F.eyeL.up, F.eyeR.up, F.eyeL.lo, F.eyeR.lo, F.hoodL, F.hoodR, F.noseNearSide, F.noseShadowSide,
      F.noseBottom, F.mouthLine, F.nlL, F.nlR, F.earR, F.chinCrease, F.lapelL, F.lapelR, F.collarL, F.collarR];
    function wobbly(pl, amp) { const o = rng.next() * 50; return pl.map((p, i) => [p[0] + amp * nz.n1(o + i * 0.15), p[1] + amp * nz.n1(o + 20 + i * 0.15)]); }
    for (const pl of udLines) {
      for (let r = 0; r < 2; r++) {
        // break long lines into gestures
        const seg = Math.max(8, Math.floor(pl.length / (2 + rng.int(0, 3))));
        for (let i = 0; i < pl.length - 2; i += seg - 2) {
          const part = pl.slice(i, Math.min(pl.length, i + seg + 1));
          S(wobbly(part, r ? 2.5 : 1), 2.0 + rng.next() * 1.2, 'both', Object.assign({}, ud, { col: jit(ud.col, 0.04), opac: r ? 0.45 : 0.75 }));
        }
      }
    }
    // shoulders and hair mass, loosely
    S(wobbly(G.Geom.open(F.jacket.slice(0, Math.floor(F.jacket.length * 0.36)).map((p) => p), 1), 3), 3, 'both', ud);
    for (let i = 0; i < 40; i++) {
      const a = Math.PI * (1.05 + rng.next() * 1.1); const c = F.headCenter;
      const r0 = 200 + rng.next() * 50, r1 = r0 + 60 + rng.next() * 110;
      const pts = []; for (let t = 0; t <= 1; t += 0.1) { const r = r0 + (r1 - r0) * t; const aa = a + 0.25 * t * t * Math.sin(i); pts.push([c[0] + Math.cos(aa) * r, c[1] + Math.sin(aa) * r * 1.0]); }
      S(pts, 1.8, 'taper', Object.assign({}, ud, { opac: 0.5 }));
    }
    log && log('underdrawing');

    // ======== 2. block-in: thin, scrubbed, leaves canvas ========
    P.session = 2;
    const thin = { load: 0.62, opac: 0.62, imp: 0.08, rag: 0.4, bristle: 0.8, wash: true, pick: 0.15, reach: 1.4, dryK: 0.75, touch: 0.1 };
    // background
    for (const [x, y] of scatter(46, (x, y) => regAt(x, y) === RG.BG || regAt(x, y) === RG.HAIR)) {
      const pts = trace(x, y, bgAng, 160 + rng.next() * 200, 6, null);
      S(pts, 34 + rng.next() * 26, 'loaded', Object.assign({}, thin, { col: jit(bgCol(x, y), 0.06) }));
    }
    // jacket
    const jackAng = (x, y) => { const t = Math.min(1, Math.max(0, (y - 880) / 300)); const sl = x < 500 ? -0.42 : 0.42; return sl * (1 - t) + (x < 500 ? 1.25 : 1.9) * t + 0.6 * nz.n2(x / 160, y / 160); };
    function jackCol(x, y) {
      let c = mix(C.ultramarine, C.prussian, 0.35 + 0.3 * nz.fbm(x / 160, y / 160, 2));
      if (x > 520) c = mix(c, C.violet, 0.25);
      return c;
    }
    for (const [x, y] of scatter(30, (x, y) => regAt(x, y) === RG.JACKET)) {
      S(trace(x, y, jackAng, 90 + rng.next() * 100, 6, null), 32 + rng.next() * 18, 'loaded', Object.assign({}, thin, { col: jit(jackCol(x, y), 0.04) }));
    }
    // hair underlayer: pale and cool, with blue shadow pockets
    const hc = F.headCenter;
    for (const [x, y] of scatter(22, (x, y) => regAt(x, y) === RG.HAIR)) {
      const a = Math.atan2(y - hc[1], x - hc[0]);
      const shade = 0.5 + 0.5 * Math.cos(a - 3.6); // lit toward upper-left
      const c = rng.next() < 0.35 ? mix(C.cerulean, C.violet, rng.next()) : mix(C.skyWhite, C.lemonWhite, shade);
      S(trace(x, y, () => a + 0.3 * nz.n2(x / 50, y / 50), 40 + rng.next() * 50, 5, null, a), 18 + rng.next() * 12, 'loaded', Object.assign({}, thin, { col: jit(c, 0.05) }));
    }
    // face and neck from the plan
    const faceAng = (x, y) => {
      const i = (y | 0) * plan.PW + (x | 0); let a = plan.ang[i];
      const rr = regAt(x, y);
      if (y < 470 && rr === RG.FACE) a = 0.15 * Math.sin(a) + 0.08 * nz.n2(x / 40, y / 40); // forehead: horizontal sweeps
      else if (rr === RG.NECK || rr === RG.CHEST) a = (x < 495 ? 0.35 : -0.35) + 0.25 * nz.n2(x / 40, y / 40); // neck: wraps around
      return a;
    };
    for (const [x, y] of scatter(13, (x, y) => [RG.FACE, RG.NECK, RG.CHEST, RG.EAR, RG.LIP, RG.BROW, RG.EYE, RG.MOUST].includes(regAt(x, y)))) {
      S(trace(x, y, faceAng, 45 + rng.next() * 45, 3, null), 18 + rng.next() * 8, 'loaded', Object.assign({}, thin, { col: jit(planCol(x, y), 0.05), opac: 0.55 }));
    }
    // collars
    for (const [x, y] of scatter(10, (x, y) => regAt(x, y) === RG.COLL_L || regAt(x, y) === RG.COLL_R)) {
      const c = regAt(x, y) === RG.COLL_L ? C.warmWhite : C.skyWhite;
      S(trace(x, y, () => (regAt(x, y) === RG.COLL_L ? 2.0 : 1.1), 30, 3, null), 16, 'loaded', Object.assign({}, thin, { col: jit(c, 0.04) }));
    }
    log && log('block-in');

    // ======== 3. loaded alla-prima body ========
    P.session = 3;
    const body = { load: 1.0, opac: 0.96, imp: 0.9, rag: 0.22, bristle: 0.6, pick: 0.22, reach: 1.3, dryK: 0.55, touch: 0.35, endPile: 0.5 };
    // --- background: long sweeping loaded strokes of varied width, then a few short accents
    for (let pass = 0; pass < 2; pass++) {
      const sp = pass ? 34 : 30;
      for (const [x, y] of scatter(sp, (x, y) => regAt(x, y) === RG.BG || (pass === 0 && regAt(x, y) === RG.HAIR && rng.next() < 0.3))) {
        if (pass === 1 && rng.next() < 0.35) continue;
        let c = bgCol(x + rng.gauss() * 25, y + rng.gauss() * 25);
        const r = rng.next();
        if (x < split(y)) { if (r < 0.10) c = C.cobalt; else if (r < 0.16) c = C.turquoise; else if (r < 0.2) c = C.emeraldLt; else if (r < 0.23) c = C.sap; }
        else { if (r < 0.10) c = C.cadOrange; else if (r < 0.15) c = C.crimson; else if (r < 0.19) c = C.rose; else if (r < 0.21) c = C.cadYellow; }
        const big = rng.next() < 0.35;
        const L = pass ? 50 + rng.next() * 90 : (big ? 220 + rng.next() * 220 : 110 + rng.next() * 150);
        const w = pass ? 10 + rng.next() * 12 : (big ? 26 + rng.next() * 18 : 16 + rng.next() * 14);
        S(trace(x, y, bgAng, L, 5, (xx, yy, s) => s < 40 || regAt(xx, yy) === RG.BG || regAt(xx, yy) === RG.HAIR), w, pass ? 'both' : 'loaded',
          Object.assign({}, body, { col: jit(c, 0.05), col2: jit(mix(c, rng.pick([C.white, C.cadYellow, C.ultramarine, C.rose]), 0.35), 0.03), mix2: 0.2, imp: 0.7, reach: big ? 2.0 : 1.4, lift: 0.35 }));
      }
    }
    log && log('background');
    // --- jacket: deep, rich darks; broad strokes that follow the shoulders, cobalt catching the light
    for (let pass = 0; pass < 2; pass++) {
      for (const [x, y] of scatter(pass ? 24 : 30, (x, y) => regAt(x, y) === RG.JACKET)) {
        let c = jackCol(x, y);
        const r = rng.next();
        const lit = Math.max(0, 1 - Math.abs(y - (920 + Math.abs(x - 500) * 0.28)) / 70) * (x < 500 ? 1 : 0.55);
        if (r < 0.08 + lit * 0.55) c = mix(C.cobalt, C.cerulean, rng.next() * 0.6);
        else if (r < 0.2) c = mix(C.violet, C.ultramarine, rng.next() * 0.5);
        else if (r < 0.38) c = C.ink;
        const cross = rng.next() < 0.15;
        const ang = cross ? (x2, y2) => jackAng(x2, y2) + 1.2 : jackAng;
        const L = cross ? 30 + rng.next() * 50 : 70 + rng.next() * 170;
        const w = cross ? 8 + rng.next() * 8 : 12 + rng.next() * 22;
        S(trace(x, y, ang, L, 5, (xx, yy, s) => s < 20 || regAt(xx, yy) === RG.JACKET), w, rng.next() < 0.3 ? 'both' : 'loaded',
          Object.assign({}, body, { col: jit(c, 0.03), col2: jit(mix(c, C.ink, 0.5), 0.02), mix2: 0.25, imp: 0.7, lift: 0.4 }));
      }
    }
    // lapel edges
    for (const pl of [F.lapelL, F.lapelR]) S(wobbly(pl, 1.5), 9, 'loaded', Object.assign({}, body, { col: C.ink, load: 1.1 }));
    for (const pl of [F.lapelL, F.lapelR]) S(wobbly(pl.map((p) => [p[0] + (p[0] < 500 ? -8 : 8), p[1] - 4]), 1.5), 5, 'taper', Object.assign({}, body, { col: C.cobalt, load: 0.8 }));
    log && log('jacket');
    // --- collars & chest
    for (const [x, y] of scatter(7, (x, y) => regAt(x, y) === RG.COLL_L || regAt(x, y) === RG.COLL_R)) {
      const L = regAt(x, y) === RG.COLL_L;
      const c = rng.next() < 0.25 ? (L ? C.lemon : C.cerulean) : (L ? C.warmWhite : mix(C.skyWhite, C.lilac, 0.3));
      S(trace(x, y, () => (L ? 2.05 : 1.05) + 0.2 * rng.gauss(), 18 + rng.next() * 20, 3, (xx, yy, s) => s < 8 || regAt(xx, yy) === regAt(x, y)), 7 + rng.next() * 5, 'loaded',
        Object.assign({}, body, { col: jit(c, 0.03) }));
    }
    // --- neck, chest, ears from the plan
    for (const [x, y] of scatter(7, (x, y) => [RG.NECK, RG.CHEST, RG.EAR].includes(regAt(x, y)))) {
      const r0 = regAt(x, y);
      S(trace(x, y, faceAng, 14 + rng.next() * 22, 2.5, (xx, yy, s) => s < 6 || regAt(xx, yy) === r0), 8 + rng.next() * 6, 'loaded',
        Object.assign({}, body, { col: jit(planCol(x, y), 0.05), imp: 0.8 }));
    }
    log && log('neck');
    // --- the face: planes, stroke by stroke, stopping at colour changes
    for (let pass = 0; pass < 3; pass++) {
      const sp = [13, 11, 10][pass];
      for (const [x, y] of scatter(sp, (x, y) => [RG.FACE, RG.LIP, RG.EYE, RG.BROW, RG.MOUST].includes(regAt(x, y)))) {
        if (pass === 2 && rng.next() < 0.7) continue;
        const b0 = bandAt(x, y);
        let c = planCol(x, y);
        // broken colour: a few strokes of the neighbouring hue
        const r = rng.next();
        if (b0 >= 3 && r < 0.04) c = C.rose; else if (b0 >= 3 && r < 0.06) c = C.pink;
        else if (b0 <= 1 && y < 640 && r < 0.10) c = C.turquoise; else if (b0 <= 1 && y < 640 && r < 0.15) c = C.cobalt; else if (b0 <= 1 && r < 0.1) c = C.cadOrange;
        else if (b0 === 2 && r < 0.12) c = C.crimson;
        const L = [40, 30, 20][pass] + rng.next() * [50, 30, 20][pass];
        const w = [16, 12, 8][pass] + rng.next() * [6, 4, 3][pass];
        const free = rng.next() < 0.2;
        S(trace(x, y, faceAng, L, 2, (xx, yy, s) => s < 10 || free || (bandAt(xx, yy) === b0 && HEADREGS.includes(regAt(xx, yy))) || rng.next() < 0.04), w, pass === 2 ? 'both' : 'loaded',
          Object.assign({}, body, { col: jit(c, 0.035), col2: jit(mix(c, C.white, 0.3), 0.02), mix2: 0.12, imp: [0.8, 0.9, 1.0][pass], pick: 0.3, touch: 0.12, rag: 0.3, lift: 0.45 }));
      }
    }
    log && log('face');
    G.__paintHair && G.__paintHair(P, plan, K, rng);
    G.__paintFeatures && G.__paintFeatures(P, plan, K, rng);
  };
})(window);
