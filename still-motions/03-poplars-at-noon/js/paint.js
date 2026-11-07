// The painter: turns the plan (scene.js) into a list of dabs of pure colour, the way a divisionist works.
//  - a limited palette of unmixed pigments, used straight or lightened with white (never mixed with each other)
//  - every dab picks a pigment from a recipe: the local colour of the thing, the colour of the light on it (warm
//    yellows and oranges in sun), the colour of its shadow (ultramarine, violet), reflected colour, and a sparing
//    accent of the complementary, so neighbouring dabs contrast and the eye mixes them
//  - error diffusion keeps the optical mixture true to the plan: what one dab gets wrong, its neighbours repay
//  - touches are placed by dart-throwing (no grid), smaller toward the horizon, oriented with the form
(function (G) {
  'use strict';
  const R = G.RNG, S = G.SCENE;
  const { clamp, mix, sstep } = S;

  // ---------- palette ------------------------------------------------------------------------------------------
  const PIG = {
    W: [247, 244, 234], CYL: [250, 229, 62], CY: [246, 182, 26], OR: [238, 116, 30], VER: [222, 50, 36], ROSE: [204, 46, 96],
    VIO: [148, 72, 172], UMV: [62, 34, 120], UM: [30, 44, 160], COB: [28, 86, 192], CER: [36, 140, 204], VIR: [14, 112, 98],
    EM: [36, 164, 92], YG: [146, 192, 48], DG: [12, 60, 50], RB: [124, 44, 28],
  };
  const PNAMES = Object.keys(PIG);
  const WHITE_LIN = PIG.W.map((c) => R.toLin(c / 255));
  const TINTS = [0, 0.12, 0.25, 0.38, 0.5, 0.62, 0.72, 0.8, 0.87, 0.92];
  const DEEPS = [0.25, 0.45, 0.6]; // pigment in mass tone, thickly loaded (darker)
  const DEEPOK = ['UM', 'UMV', 'VIR', 'DG', 'COB', 'VIO', 'RB', 'EM', 'CER', 'ROSE', 'VER'];
  const ENTRIES = {}; // pigment -> [{lin, lab}]
  for (const n of PNAMES) {
    const lin = PIG[n].map((c) => R.toLin(c / 255));
    const list = [];
    for (const t of TINTS) {
      const c = [mix(lin[0], WHITE_LIN[0], t), mix(lin[1], WHITE_LIN[1], t), mix(lin[2], WHITE_LIN[2], t)];
      list.push({ lin: c, lab: R.oklab(c[0], c[1], c[2]), p: n });
    }
    if (DEEPOK.includes(n)) for (const d of DEEPS) {
      const c = lin.map((v) => v * (1 - d));
      list.push({ lin: c, lab: R.oklab(c[0], c[1], c[2]), p: n });
    }
    ENTRIES[n] = list;
  }

  // ---------- recipes ------------------------------------------------------------------------------------------
  // local: the colour of the thing; light: what the sun adds; shade: the colour of its shadow;
  // refl: colour bounced in from neighbours (sky into water and shadows, grass into undersides); comp: contrast accent
  const RECIPES = {
    sky: { local: ['CER', 'COB', 'W', 'UM'], light: ['CYL', 'ROSE', 'OR'], shade: ['UM', 'VIO'], refl: ['ROSE', 'VIO'], comp: ['OR'], r: [0.94, 0.025, 0.015, 0.01, 0.015] },
    skyLow: { local: ['W', 'CER', 'CYL', 'COB'], light: ['CYL', 'ROSE', 'OR', 'CY'], shade: ['VIO', 'CER'], refl: ['EM', 'ROSE'], comp: ['OR', 'ROSE'], r: [0.8, 0.07, 0.04, 0.04, 0.05] },
    cloud: { local: ['W', 'CER'], light: ['CYL', 'OR', 'ROSE'], shade: ['VIO', 'COB', 'UM', 'ROSE'], refl: ['CER', 'EM'], comp: ['CY', 'OR'], r: [0.66, 0.12, 0.12, 0.04, 0.06] },
    fartree: { local: ['COB', 'VIO', 'EM', 'CER', 'VIR'], light: ['CYL', 'OR', 'ROSE'], shade: ['UM', 'UMV'], refl: ['CER'], comp: ['OR', 'ROSE'], r: [0.7, 0.08, 0.1, 0.05, 0.07] },
    field: { local: ['YG', 'CYL', 'CY', 'EM', 'W'], light: ['CYL', 'OR', 'W'], shade: ['COB', 'VIO', 'CER', 'UM'], refl: ['CER', 'ROSE'], comp: ['VIO', 'ROSE'], r: [0.7, 0.1, 0.08, 0.05, 0.07] },
    meadow: { local: ['EM', 'YG', 'VIR', 'CY', 'CYL'], light: ['CYL', 'CY', 'YG', 'W'], shade: ['VIR', 'UM', 'VIO', 'DG', 'COB'], refl: ['CER', 'COB'], comp: ['VIO', 'ROSE', 'OR'], r: [0.68, 0.1, 0.1, 0.06, 0.06] },
    foliage: { local: ['YG', 'EM', 'VIR', 'DG', 'CYL'], light: ['CYL', 'CY', 'YG', 'OR'], shade: ['UM', 'UMV', 'DG', 'VIR', 'VIO', 'COB'], refl: ['CER', 'COB'], comp: ['OR', 'RB', 'ROSE', 'VIO'], r: [0.56, 0.14, 0.18, 0.07, 0.05] },
    trunk: { local: ['VIO', 'RB', 'UMV'], light: ['OR', 'CY'], shade: ['UM', 'DG'], refl: ['EM'], comp: ['OR'], r: [0.6, 0.15, 0.15, 0.05, 0.05] },
    towpath: { local: ['OR', 'CY', 'ROSE', 'W'], light: ['CYL', 'W', 'CY'], shade: ['VIO', 'COB', 'UM'], refl: ['EM', 'CER'], comp: ['CER', 'VIO'], r: [0.64, 0.14, 0.1, 0.05, 0.07] },
    towpathShade: { local: ['VIO', 'COB', 'UM', 'UMV', 'CER'], light: ['OR', 'ROSE'], shade: ['UMV', 'UM'], refl: ['EM', 'VIR'], comp: ['OR', 'CY'], r: [0.66, 0.08, 0.12, 0.06, 0.08] },
    meadowShade: { local: ['DG', 'VIR', 'UM', 'UMV', 'EM', 'COB'], light: ['EM', 'YG'], shade: ['UMV', 'UM', 'VIO'], refl: ['CER', 'COB'], comp: ['OR', 'RB', 'VER', 'ROSE'], r: [0.6, 0.08, 0.14, 0.08, 0.1] },
    bank: { local: ['EM', 'VIR', 'RB', 'OR', 'YG'], light: ['CY', 'YG'], shade: ['UM', 'VIO', 'DG'], refl: ['CER'], comp: ['ROSE', 'OR'], r: [0.66, 0.1, 0.13, 0.04, 0.07] },
    wall: { local: ['W', 'ROSE', 'OR', 'CY', 'CER', 'VIO', 'COB'], light: ['CYL', 'W', 'OR'], shade: ['VIO', 'COB', 'CER'], refl: ['EM'], comp: ['CER', 'OR'], r: [0.72, 0.1, 0.12, 0.02, 0.04] },
    roof: { local: ['VER', 'OR', 'ROSE'], light: ['CY'], shade: ['VIO', 'UMV'], refl: ['RB'], comp: ['CER', 'COB'], r: [0.74, 0.08, 0.1, 0.03, 0.05] },
    slate: { local: ['COB', 'VIO', 'CER', 'UM'], light: ['ROSE', 'OR', 'W'], shade: ['UM', 'UMV'], refl: ['W'], comp: ['OR'], r: [0.74, 0.08, 0.1, 0.03, 0.05] },
    willow: { local: ['YG', 'EM', 'VIR', 'CER', 'CYL'], light: ['CYL', 'CY', 'OR'], shade: ['COB', 'VIO', 'UM', 'CER', 'VIR'], refl: ['CER', 'COB'], comp: ['OR', 'ROSE', 'VIO'], r: [0.56, 0.14, 0.16, 0.06, 0.08] },
    hayShade: { local: ['VIO', 'COB', 'UMV', 'ROSE', 'CER'], light: ['OR', 'CY'], shade: ['UM', 'UMV'], refl: ['VER', 'ROSE'], comp: ['OR', 'CY'], r: [0.56, 0.1, 0.1, 0.1, 0.14] },
    hay: { local: ['CY', 'OR', 'CYL', 'VER'], light: ['CYL', 'W', 'CY'], shade: ['VIO', 'ROSE', 'COB'], refl: ['VER', 'ROSE'], comp: ['VIO', 'CER', 'COB'], r: [0.6, 0.12, 0.1, 0.07, 0.11] },
    water: { local: ['CER', 'COB', 'W', 'EM', 'UM'], light: ['W', 'CYL'], shade: ['UM', 'VIR', 'UMV'], refl: ['EM', 'VIO'], comp: ['OR', 'ROSE'], r: [0.72, 0.05, 0.1, 0.07, 0.06] },
    waterDark: { local: ['DG', 'VIR', 'UM', 'UMV', 'EM'], light: ['EM', 'YG'], shade: ['UMV', 'UM', 'VIO'], refl: ['COB', 'CER'], comp: ['OR', 'RB', 'VER'], r: [0.6, 0.06, 0.14, 0.1, 0.1] },
    boat: { local: ['W', 'CER', 'OR', 'COB', 'UM', 'RB', 'VER', 'VIO'], light: ['CYL', 'W'], shade: ['VIO', 'COB'], refl: ['CER'], comp: ['OR'], r: [0.7, 0.1, 0.12, 0.03, 0.05] },
    figure: { local: ['W', 'CER', 'OR', 'ROSE'], light: ['CYL', 'W'], shade: ['VIO', 'COB'], refl: ['CER'], comp: ['OR'], r: [0.72, 0.1, 0.12, 0.02, 0.04] },
    parasol: { local: ['VER', 'OR', 'ROSE'], light: ['CY', 'OR'], shade: ['ROSE', 'VIO'], refl: ['VER'], comp: ['CER'], r: [0.74, 0.1, 0.12, 0.02, 0.02] },
    any: { local: PNAMES, light: ['CYL', 'W'], shade: ['UM', 'VIO'], refl: ['CER'], comp: ['OR'], r: [1, 0, 0, 0, 0] },
  };
  RECIPES.fieldShade = RECIPES.field;
  RECIPES.sky.maxC = 0.085; RECIPES.skyLow.maxC = 0.08; RECIPES.cloud.maxC = 0.07;
  RECIPES.sky.J = 0.014; RECIPES.skyLow.J = 0.012; RECIPES.water.J = 0.013; RECIPES.cloud.J = 0.011;
  const GROUPS = ['local', 'light', 'shade', 'refl', 'comp'];
  const DARKS = ['DG', 'VIR', 'UM', 'UMV', 'VIO', 'COB', 'EM', 'DG', 'UM'];

  // ---------- error diffusion grids ------------------------------------------------------------------------------
  const CELL = 9;
  const GW = Math.ceil(S.W / CELL) + 2, GH = Math.ceil(S.H / CELL) + 2;
  const grids = {};
  function grid(ch) { return grids[ch] || (grids[ch] = new Float32Array(GW * GH * 3)); }

  // choose a pigment entry for target colour T (linear) at (x,y), dab area A, light 0..1
  function choose(rng, fam, T, lit, x, y, A, ch, opts) {
    const rec = RECIPES[fam] || RECIPES.any;
    const g = grid(ch);
    const cx = clamp(Math.floor(x / CELL) + 1, 1, GW - 2), cy = clamp(Math.floor(y / CELL) + 1, 1, GH - 2);
    const ci = (cy * GW + cx) * 3;
    const D = [clamp(T[0] + g[ci] * 0.9, 0, 1), clamp(T[1] + g[ci + 1] * 0.9, 0, 1), clamp(T[2] + g[ci + 2] * 0.9, 0, 1)];
    g[ci] = g[ci + 1] = g[ci + 2] = 0;
    const Dl = R.oklab(D[0], D[1], D[2]);
    // group by rates; light and shade trade with the light level
    const r = rec.r.slice();
    const accent = opts && opts.accent !== undefined ? opts.accent : 1;
    r[1] *= 0.3 + 1.4 * lit; r[2] *= 0.3 + 1.4 * (1 - lit);
    for (let k = 1; k < 5; k++) r[k] *= accent;
    let tot = r[0] + r[1] + r[2] + r[3] + r[4], u = rng() * tot, gi = 0;
    while (gi < 4 && u > r[gi]) { u -= r[gi]; gi++; }
    const wL = 2.4;
    let best = null, bc = 1e9;
    const chD = Math.hypot(Dl[1], Dl[2]);
    const pick = (names, wab, J, maxDL, maxC) => {
      for (const n of names) for (const e of ENTRIES[n]) {
        const dL = e.lab[0] - Dl[0], da = e.lab[1] - Dl[1], db = e.lab[2] - Dl[2];
        if (Math.abs(dL) > maxDL) continue;
        if (maxC && Math.hypot(e.lab[1], e.lab[2]) > maxC) continue;
        const c = wL * dL * dL + wab * (da * da + db * db) + rng() * J;
        if (c < bc) { bc = c; best = e; }
      }
    };
    // an accent must sit close in value to what it accents: contrast of hue, not of tone
    // darks are built from saturated deep pigments side by side (ultramarine, violet, viridian, red-brown)
    const dark = sstep(0.5, 0.28, Dl[0]);
    if (gi > 0) pick(rec[GROUPS[gi]], 0.3, 0.004, (opts && opts.maxDL) || 0.085, rec.maxC || chD * 1.1 + 0.035 + 0.3 * dark);
    if (!best) {
      if (dark > 0 && rng() < 0.55 * dark) pick(DARKS, 0.35, 0.006, 0.07);
      if (!best) pick(rec.local, 1.0 - 0.6 * dark, rec.J || 0.009, 9);
    }
    // the residual goes to the neighbours
    const gain = Math.min(1.2, A / (CELL * CELL));
    const res = [D[0] - best.lin[0], D[1] - best.lin[1], D[2] - best.lin[2]];
    const Wn = [0.05, 0.15, 0.05, 0.15, 0.2, 0.15, 0.05, 0.15, 0.05];
    let k = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++, k++) {
      const o = ((cy + j) * GW + (cx + i)) * 3, w = Wn[k] * gain;
      for (let q = 0; q < 3; q++) g[o + q] = clamp(g[o + q] + res[q] * w, -0.45, 0.45);
    }
    return best;
  }

  // ---------- dart-throwing scatter --------------------------------------------------------------------------------
  // sampleFn(x,y) -> sample with .sp (centre spacing, px) or null. Returns accepted samples with x,y.
  function scatter(rng, x0, y0, x1, y1, sampleFn, density) {
    const TILE = 24, cs = 3;
    const gw = Math.ceil((x1 - x0) / cs) + 1, gh = Math.ceil((y1 - y0) / cs) + 1;
    const head = new Int32Array(gw * gh).fill(-1);
    const cand = [];
    for (let ty = y0; ty < y1; ty += TILE) for (let tx = x0; tx < x1; tx += TILE) {
      let sp = 1e9;
      for (let b = 0; b <= 4; b++) for (let a = 0; a <= 4; a++) {
        const s = sampleFn(Math.min(x1 - 0.01, tx + a * TILE / 4), Math.min(y1 - 0.01, ty + b * TILE / 4));
        if (s) sp = Math.min(sp, s.sp);
      }
      if (sp > 1e8) {
        // maybe a sliver of the region in the tile: probe more densely
        sp = 6;
      }
      const n = Math.ceil(((TILE * TILE) / (sp * sp)) * (density || 2.6));
      for (let i = 0; i < n; i++) cand.push(tx + rng() * TILE, ty + rng() * TILE);
    }
    // random order (Fisher-Yates on pairs)
    const N = cand.length / 2;
    for (let i = N - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const ax = cand[2 * i], ay = cand[2 * i + 1];
      cand[2 * i] = cand[2 * j]; cand[2 * i + 1] = cand[2 * j + 1]; cand[2 * j] = ax; cand[2 * j + 1] = ay;
    }
    const out = [], next = [], px = [], py = [], pr = [];
    for (let i = 0; i < N; i++) {
      const x = cand[2 * i], y = cand[2 * i + 1];
      if (x < x0 || x >= x1 || y < y0 || y >= y1) continue;
      const s = sampleFn(x, y);
      if (!s) continue;
      const r = s.sp;
      const reach = Math.ceil((r + 18) / 2 / cs);
      const gx = Math.floor((x - x0) / cs), gy = Math.floor((y - y0) / cs);
      let ok = true;
      for (let j = Math.max(0, gy - reach); j <= Math.min(gh - 1, gy + reach) && ok; j++) {
        for (let k = Math.max(0, gx - reach); k <= Math.min(gw - 1, gx + reach); k++) {
          for (let q = head[j * gw + k]; q >= 0; q = next[q]) {
            const dx = px[q] - x, dy = py[q] - y, m = Math.min(r, pr[q]);
            if (dx * dx + dy * dy < m * m) { ok = false; break; }
          }
          if (!ok) break;
        }
      }
      if (!ok) continue;
      const id = px.length;
      px.push(x); py.push(y); pr.push(r);
      next.push(head[gy * gw + gx]); head[gy * gw + gx] = id;
      s.x = x; s.y = y;
      out.push(s);
    }
    return out;
  }

  // ---------- dab records ------------------------------------------------------------------------------------------
  // 24 floats per dab: x y len wid | ang hamp seed type | c0 rgb alpha | c1 rgb k | p0..p3 | q0..q3
  // type: 0 static, 1 water, 2 sway (tree), 3 cloud shadow, 4 grass in wind, 5 underpainting (thin), 6 sway underpainting
  const STRIDE = 24;
  function Dabs() { this.a = []; }
  Dabs.prototype.push = function (d) { this.a.push(d); };

  function lin3(c) { return [R.toLin(clamp(c[0], 0, 1)), R.toLin(clamp(c[1], 0, 1)), R.toLin(clamp(c[2], 0, 1))]; }

  function build(progress) {
    const rng = R.mulberry32(20240607);
    const W = S.W, H = S.H, YH = S.YH;
    const layers = []; // [{order, dabs: []}]
    const L = (order) => { const o = { order, list: [] }; layers.push(o); return o.list; };

    // 1. underpainting: broad thin strokes of a darker local tone so gaps between dabs never read as bare white
    const under = L(0);
    for (let y = 0; y < H; y += 20) for (let x = 0; x < W; x += 20) {
      const px = x + rng() * 20, py = y + rng() * 20;
      if (S.insideCrownBy(px, py) > 30) continue;
      const s = S.sceneAt(px, py);
      const c = lin3(s.col);
      const k = 0.55 + 0.35 * sstep(0.15, 0.7, S.lum(s.col));
      const big = py < YH ? 1 : 0.6 + 0.6 * (py - YH) / (H - YH);
      under.push({ x: px, y: py, len: 64 * big, wid: 26 * big, ang: (s.water ? 0 : py < YH ? (rng() < 0.5 ? -0.6 : 0.6) : 0.15 * (rng() - 0.5)), hamp: 0.6, seed: rng(), type: 5,
        c0: [c[0] * k, c[1] * k, c[2] * k], alpha: 0.94 });
    }

    // 2. the scene's own dabs (everything but the poplars)
    const sub = {};
    const SL = (k) => sub[k] || (sub[k] = L(k));
    // back to front: each scene layer gets its first coat and then its second, static paint before moving paint
    const slot = (d, s, coat) => SL(1 + 0.1 * (s.layer || 0) + (coat ? 0.05 : 0));
    const inBand = (x, y) => Math.min(x, W - x, y, H - y) < S.B - 3;
    const sample = (x, y) => {
      if (inBand(x, y)) return null;
      if (S.insideCrownBy(x, y) > 22) return null;
      const s = S.sceneAt(x, y);
      const z = S.dabSize(s, x, y);
      s.z = z;
      const L0 = S.lum(s.col);
      s.sp = z * (0.64 - 0.1 * sstep(0.3, 0.05, L0));
      return s;
    };
    const pts = scatter(rng, 0, 0, W, H, sample, 3.4);
    if (progress) progress('scatter ' + pts.length);
    for (const s of pts) { const d = dabFromSample(rng, s); slot(d, s, 0).push(d); }

    // 3. second coat: sparser touches laid over the first, mostly accents of light and contrast
    const pts2 = scatter(rng, 0, 0, W, H, (x, y) => { const s = sample(x, y); if (s) s.sp *= 2.4; return s; }, 1.6);
    for (const s of pts2) { const d = dabFromSample(rng, s, 1.15); d.len *= 0.85; d.wid *= 0.85; slot(d, s, 1).push(d); }

    // 3b. wildflowers, single touches of pure pigment on the near meadow
    const fl = L(5);
    const fpts = scatter(rng, S.B, S.YH + 300, W - S.B, H - S.B, (x, y) => {
      const f = S.flowerAt(x, y);
      if (!f) return null;
      f.sp = 9 + 6 * (y - S.YH) / (H - S.YH);
      return f;
    }, 1.0);
    for (const f of fpts) {
      const z = (4 + 7 * (f.y - S.YH) / (H - S.YH)) * (0.8 + 0.4 * rng());
      const list = ENTRIES[f.p];
      const e = list[Math.min(list.length - 1, Math.round(rng() * 2 + (f.p === 'W' || f.p === 'CYL' ? 0 : 0)))];
      let c = e.lin;
      if (f.shade > 0.3) { if (rng() < 0.6) continue; c = c.map((v) => v * (0.12 + 0.2 * (1 - f.shade))); }
      fl.push({ x: f.x, y: f.y, len: z * 1.05, wid: z * 0.95, ang: rng() * 3, hamp: 0.45 * z, seed: rng(), type: 0, c0: c, alpha: 1 });
    }

    // 4. the poplars, far to near; each tree sways as one
    for (let k = S.TREES.length - 1; k >= 0; k--) {
      const T = S.TREES[k];
      const tu = L(10 + 2 * (S.TREES.length - k)), tl = L(11 + 2 * (S.TREES.length - k));
      const x0 = T.x - T.cw - 30, x1 = T.x + T.cw + 30, y0 = T.top - 10, y1 = T.base + 4;
      // under-layer of dark foliage
      for (let y = y0; y < y1; y += 14) for (let x = x0; x < x1; x += 10) {
        const px = x + rng() * 10, py = y + rng() * 14;
        const p = S.poplarAt(px, py, k);
        if (!p || p.part !== 'crown') continue;
        const c = lin3(S.mix3(p.col, [0.03, 0.08, 0.07], 0.45));
        tu.push(swayParams(T, { x: px, y: py, len: 34 * (1 - 0.6 * p.far), wid: 14 * (1 - 0.6 * p.far), ang: Math.PI / 2 + 0.3 * (rng() - 0.5), hamp: 0.5, seed: rng(), type: 6, c0: c, alpha: 0.92 }));
      }
      const tp = scatter(rng, Math.max(0, x0), Math.max(0, y0), Math.min(W, x1), Math.min(H, y1), (x, y) => {
        const p = S.poplarAt(x, y, k);
        if (!p || inBand(x, y)) return null;
        p.z = mix(10.5, 4.6, p.far) * (p.part === 'trunk' ? 0.7 : 1);
        p.sp = p.z * (0.6 - 0.08 * sstep(0.3, 0.05, p.lit));
        p.ch = 'tree';
        return p;
      }, 3.6);
      for (const s of tp) { const d = dabFromSample(rng, s); tl.push(swayParams(T, d)); }
      const tp2 = scatter(rng, Math.max(0, x0), Math.max(0, y0), Math.min(W, x1), Math.min(H, y1), (x, y) => {
        const p = S.poplarAt(x, y, k);
        if (!p || p.part !== 'crown') return null;
        p.z = mix(10.5, 4.6, p.far); p.sp = p.z * 1.9; p.ch = 'tree';
        return p;
      }, 1.6);
      for (const s of tp2) { const d = dabFromSample(rng, s, 1.15); d.len *= 0.85; d.wid *= 0.85; tl.push(swayParams(T, d)); }
    }

    // 4b. the willows on the near meadow (drawn after the poplars; they are nearer)
    for (let k = S.WILLOWS.length - 1; k >= 0; k--) {
      const T = S.WILLOWS[k];
      const pseudo = { base: T.base, h: T.h, phase: T.phase };
      const tu = L(40 + 2 * (S.WILLOWS.length - k)), tl = L(41 + 2 * (S.WILLOWS.length - k));
      const x0 = T.x - 1.7 * T.rx, x1 = T.x + 1.7 * T.rx, y0 = T.top, y1 = T.base + 3;
      for (let y = y0; y < y1; y += 12) for (let x = x0; x < x1; x += 10) {
        const px = x + rng() * 10, py = y + rng() * 12;
        const p = S.willowAt(px, py, k);
        if (!p || p.part !== 'crown') continue;
        const c = lin3(S.mix3(p.col, [0.12, 0.16, 0.26], 0.3));
        tu.push(swayParams(pseudo, { x: px, y: py, len: 30, wid: 13, ang: Math.PI / 2 + 0.4 * (rng() - 0.5), hamp: 0.5, seed: rng(), type: 6, c0: c, alpha: 0.92 }, 0.4));
      }
      const fn = (sp) => (x, y) => { const p = S.willowAt(x, y, k); if (!p) return null; p.z = 10.5; p.sp = p.z * sp; p.ch = 'tree'; return p; };
      for (const s of scatter(rng, x0, y0, x1, y1, fn(0.6), 3.6)) tl.push(swayParams(pseudo, dabFromSample(rng, s), 0.4));
      for (const s of scatter(rng, x0, y0, x1, y1, fn(1.9), 1.6)) { const d = dabFromSample(rng, s, 1.15); d.len *= 0.85; d.wid *= 0.85; tl.push(swayParams(pseudo, d, 0.4)); }
    }

    // 5. painted border of complementary dots
    const bunder = L(89), border = L(90);
    const BW = S.B;
    const bpts = scatter(rng, 0, 0, W, H, (x, y) => {
      const e = Math.min(x, W - x, y, H - y);
      if (e >= BW) return null;
      return { sp: 6.0, z: 8.5 };
    }, 3.4);
    for (const s of bpts) {
      const x = s.x, y = s.y;
      const dx = Math.min(x, W - x), dy = Math.min(y, H - y);
      const horiz = dy < dx;
      // the picture next to this point of the border (averaged over a few samples)
      let a = [0, 0, 0];
      for (let k = 0; k < 4; k++) {
        const ix = clamp(x + (k - 1.5) * 14, BW + 18, W - BW - 18) + (horiz ? 0 : (x < W / 2 ? 14 * k : -14 * k));
        const iy = clamp(y + (horiz ? 0 : (k - 1.5) * 14), BW + 18, H - BW - 18) + (horiz ? (y < H / 2 ? 14 * k : -14 * k) : 0);
        const p = S.poplarAt(ix, iy);
        const c = lin3(p ? p.col : S.sceneAt(ix, iy).col);
        a = [a[0] + c[0] / 4, a[1] + c[1] / 4, a[2] + c[2] / 4];
      }
      const lab = R.oklab(a[0], a[1], a[2]);
      // the complementary hue, darker than the picture beside it, so the band frames and intensifies it
      const ch = Math.hypot(lab[1], lab[2]), hue = Math.atan2(lab[2], lab[1]) + Math.PI;
      const cc = Math.max(0.1, Math.min(0.17, ch * 1.3));
      const L0 = clamp(0.36 + 0.22 * (lab[0] - 0.45), 0.3, 0.5);
      let T = R.oklabToLin(L0, cc * Math.cos(hue), cc * Math.sin(hue)).map((v) => clamp(v, 0, 1));
      const deep = [0.025, 0.03, 0.16];
      const kd = rng() < 0.55 ? 0.75 : 0.15;
      T = [mix(T[0], deep[0], kd), mix(T[1], deep[1], kd), mix(T[2], deep[2], kd)];
      const e = choose(rng, 'any', T, 0.5, x, y, 70, 'border');
      border.push({ x, y, len: 10 * (0.85 + 0.3 * rng()), wid: 7.2 * (0.85 + 0.3 * rng()), ang: (horiz ? 0 : Math.PI / 2) + 0.35 * (rng() - 0.5), hamp: 2.6, seed: rng(), type: 0, c0: e.lin, alpha: 1 });
    }
    // a dark underlayer for the band, so it reads as one painted frame
    for (let y = 0; y < H; y += 20) for (let x = 0; x < W; x += 20) {
      const px = x + rng() * 20, py = y + rng() * 20;
      if (Math.min(px, W - px, py, H - py) >= BW - 6) continue;
      bunder.push({ x: px, y: py, len: 40, wid: 18, ang: rng() * 3, hamp: 0.5, seed: rng(), type: 5, c0: [0.03, 0.03, 0.09], alpha: 0.95 });
    }

    // flatten in painting order; within a layer the order is random
    layers.sort((a, b) => a.order - b.order);
    // Split into a static part (baked once) and a dynamic part (drawn every frame on top of the bake). The bake is
    // exact if no static dab is painted after an overlapping dynamic one. Within a layer the order is free (it is
    // random anyway), so in each layer: static dabs clear of all earlier dynamic paint first, then static dabs that
    // touch it (these become dynamic), then the moving dabs.
    const GC = 32, gw = Math.ceil(W / GC) + 1, gh = Math.ceil(H / GC) + 1;
    const cells = new Array(gw * gh);
    const bounds = (d) => {
      const r = 0.5 * Math.max(d.len, d.wid) * 1.25 + 2;
      let mx = 0, my = 0;
      if (d.type === 1) mx = Math.abs(d.q[1]) * 1.3 + 0.25 * d.len;
      if (d.type === 2 || d.type === 6) { mx = Math.abs(d.p[3]) * 1.05 + 2; my = 0.12 * Math.abs(d.p[3]) + 2; }
      if (d.type === 4) mx = 3;
      return [d.x - r - mx, d.x + r + mx, d.y - r - my, d.y + r + my];
    };
    const span = (b) => [Math.max(0, Math.floor(b[0] / GC)), Math.min(gw - 1, Math.floor(b[1] / GC)), Math.max(0, Math.floor(b[2] / GC)), Math.min(gh - 1, Math.floor(b[3] / GC))];
    const touches = (b) => {
      const [cx0, cx1, cy0, cy1] = span(b);
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        const c = cells[cy * gw + cx];
        if (c) for (const o of c) if (o[0] < b[1] && o[1] > b[0] && o[2] < b[3] && o[3] > b[2]) return true;
      }
      return false;
    };
    const mark = (b) => { const [cx0, cx1, cy0, cy1] = span(b); for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) (cells[cy * gw + cx] || (cells[cy * gw + cx] = [])).push(b); };
    const statics = [], dynamics = [];
    const counts = { infected: 0 };
    for (const l of layers) {
      const list = l.list;
      for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = list[i]; list[i] = list[j]; list[j] = t; }
      const clean = [], edge = [], moving = [];
      for (const d of list) {
        if (d.type !== 0 && d.type !== 5) moving.push(d);
        else if (touches(bounds(d))) edge.push(d);
        else clean.push(d);
      }
      for (const d of clean) statics.push(d);
      for (const d of edge) { dynamics.push(d); mark(bounds(d)); counts.infected++; }
      for (const d of moving) { dynamics.push(d); mark(bounds(d)); }
    }
    const all = statics.concat(dynamics);
    const n = all.length, nStatic = statics.length;
    const buf = new Float32Array(n * STRIDE);
    let o = 0;
    for (const d of all) {
      const c1 = d.c1 || d.c0, p = d.p || [0, 0, 0, 0], q = d.q || [0, 0, 0, 0];
      buf.set([d.x, d.y, d.len, d.wid, d.ang, d.hamp, d.seed, d.type, d.c0[0], d.c0[1], d.c0[2], d.alpha, c1[0], c1[1], c1[2], d.k || 0, p[0], p[1], p[2], p[3], q[0], q[1], q[2], q[3]], o);
      o += STRIDE;
      counts[d.type] = (counts[d.type] || 0) + 1;
    }
    return { buf, count: n, nStatic, counts };
  }

  function swayParams(T, d, amt) {
    if (d.type === 0) d.type = 2;
    d.p = [T.base, T.h, T.phase, 0.0062 * T.h * (amt || 1)];
    d.q = [T.phase * 1.7 + 0.3, 0, 0, 0];
    return d;
  }

  // one dab from a scene sample: colour(s), shape, animation
  function dabFromSample(rng, s, accent) {
    const z = s.z;
    const T = lin3(s.col);
    const A = z * z * 0.8;
    const e = choose(rng, s.fam, T, s.lit, s.x, s.y, A, s.ch || 'land', { accent: accent || 1 });
    const elong = s.water ? 2.1 : s.droop ? 2.2 : s.fam === 'sky' || s.fam === 'cloud' ? 1.25 : s.grass ? 1.6 : 1.35;
    const sz = z * (0.82 + 0.36 * rng());
    const d = { x: s.x, y: s.y, len: sz * Math.sqrt(elong), wid: sz / Math.sqrt(elong), ang: s.ang + 0.25 * (rng() - 0.5), hamp: 0.32 * sz, seed: rng(), type: 0, c0: e.lin, alpha: 1 };
    if (s.water) {
      // a second state of the moving water: the reflection seen through a different ripple
      const s2 = S.waterAt(s.x, s.y, 1);
      const e2 = choose(rng, s2.fam, lin3(s2.col), s2.lit, s.x, s.y, A, 'water2', { accent: accent || 1 });
      // ripples: a slow wave drifting toward us (phase falls with y), broken up by a random part per dab
      d.type = 1; d.c1 = e2.lin; d.k = 2;
      const bright = sstep(0.45, 0.8, s.refl);
      const wave = -s.y / 150 - s.x / 900 + 0.25 * R.fbm(s.x / 120, s.y / 40, 401, 2);
      d.p = [wave + 0.35 * rng(), 0.55 + 0.45 * rng(), 1 + Math.floor(rng() * 3), rng()];
      d.q = [rng() < 0.07 + 0.08 * bright ? (0.35 + 0.5 * bright) * (0.6 + 0.4 * rng()) : 0, 0.6 + 1.6 * ((s.y - S.YH) / (S.H - S.YH)), 0, 0];
    } else if (s.shadowable) {
      const T2 = lin3(s.col2);
      const e2 = choose(rng, s.fam, T2, s.lit * 0.3, s.x, s.y, A, 'shadow', { accent: accent || 1 });
      d.type = 3; d.c1 = e2.lin; d.p = [0.1 * (rng() - 0.5), 0, 0, 0];
    } else if (s.grass && rng() < 0.4) {
      const c = s.col, T2 = lin3([c[0] * 1.12 + 0.06, c[1] * 1.1 + 0.05, c[2] * 0.95]);
      const e2 = choose(rng, s.fam, T2, Math.min(1, s.lit + 0.2), s.x, s.y, A, 'grass2', { accent: accent || 1 });
      d.type = 4; d.c1 = e2.lin; d.k = 2; d.p = [760, 2400, rng() * 0.15, 0.8 + 0.2 * rng()]; d.q = [rng() < 0.5 ? 1 : -1, 0, 0, 0];
    }
    return d;
  }

  G.PAINT = { build, STRIDE, PIG, ENTRIES };
})(window);
