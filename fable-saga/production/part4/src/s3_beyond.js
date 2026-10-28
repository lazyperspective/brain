  /* ================================================================ part IV, act III (0:41–0:58): beyond */
  {
  const NOVA_AURA = [110, 109, 108, 22], WOUND1 = [-60, 58, 44, 112, 3.5], WOUND2 = [70, 34, 92, 52, 4];
  // wings like z5Wings but in any colours: flame for nova (three ranks: outer flames cycling, gold, white-hot)
  function i4Wings(x, y, s, t, spread, flap, P3, T) {
    if (spread <= 0.02) return;
    const amp = flap === undefined ? 0.24 : flap, sh = fl(t * 12);
    glow(x, y - 8 * s, 80 * s * spread, T || T_NOVA, 0.4 * spread);
    for (const sd of [-1, 1]) {
      const beat = z5Beat(t) * amp, arm = -0.78 - beat + (1 - spread) * 1.3, ax = Math.cos(arm) * sd, ay = Math.sin(arm), Lw = 44 * s * (0.35 + 0.65 * spread);
      for (const [N, len, rank] of [[10, 1, 0], [8, 0.62, 1], [7, 0.36, 2]]) for (let j = N - 1; j >= 0; j--) {
        const u = (j + 0.6) / N, bx = x + ax * Lw * u, by = y + ay * Lw * u - Math.sin(u * PI) * 5 * s;
        const bu = z5Beat(t - 0.12 * u) * amp, fr = lerp(PI / 2 - 0.12, -0.15 - bu * 1.5, Math.pow(u, 1.25)) - (1 - spread) * 0.5, fa = sd > 0 ? fr : PI - fr;
        const fl_ = 1 + 0.12 * Math.sin(t * 23 + j * 1.7 + rank), L = s * (15 + 32 * u) * len * (0.45 + 0.55 * spread) * fl_, w = s * (4.6 - rank * 0.8);
        const fill = rank === 0 ? P3[0][(j + sh) % P3[0].length] : P3[1], rim = rank === 0 ? P3[2] : rank === 1 ? P3[0][0] : P3[1];
        z5Kite(bx - Math.cos(fa) * 1.2, by - Math.sin(fa) * 1.2, fa, L + 2.4, w + 1.1, rim);
        z5Kite(bx, by, fa, L, w, rank === 2 ? 22 : fill);
      }
    }
  }
  const NOVA_W = [[104, 105, 106, 105], 108, 107];
  // the hero in Zenith Nova: flame wings, the white-hot star body, a corona; returns the actor's { hand, tip }
  function i4Nova(x, y, S, t, o) {
    o = o || {};
    const wt = o.wt === undefined ? t * 1.3 : o.wt, sp = o.spread === undefined ? 1 : o.spread, bob = z5Bob(wt, S, o.flap || 0.3) * sp, ang = o.ang || 0;
    glow(x, y, 26 * S, T_NOVA, 0.45);
    i4Wings(x - Math.sin(ang) * 6 * S, y + bob - Math.cos(ang) * 6 * S, S * 0.62, wt, sp, o.flap || 0.3, NOVA_W);
    const a = actor(HERO3({ form: 'nova', eyes: o.eyes || 'glow', mouth: o.mouth, sword: o.sw === undefined ? null : o.sw, swordCols: [105, 106, 107, 106], sq: o.sq, flip: o.flip, cracks: o.cracks }), x, y, S, ang, !!o.flip, { bob, white: o.white, noSmear: o.noSmear });
    aura(t, NOVA_AURA, o.auraR || 4 * S, { sparks: o.sparks === undefined ? 16 : o.sparks, rise: 0.6 });
    return a;
  }
  const SKY_DARK = [96, 97, 98, 101];

  /* 21 — in the crater (0:41.2–0:44.5): near black. The sea filling back in; the hero half sunk in it, still; the four orbs
     barely alight, circling slowly. A trembling hand closes on the sword. "...not... yet..." */
  shot(41.2, 44.5, (lt, t) => {
    belowWorld(t, 120, 930, 0.2);
    tintAll(T_DARK, 0.6);
    const HX = 240, HY = 200, grip = eio(lin(2.2, 3.2, lt));
    for (let k = 0; k < 5; k++) { const r = 30 + k * 30 + frac(t * 0.3 + k * 0.2) * 30; ring(HX, HY + 8, r, r * 0.22, 115); }
    actor(HERO3({ eyes: lt > 1.4 && lt < 1.55 ? 'narrow' : 'closed', sword: lerp(0.9, 0.4, grip) + z5Sh(t, 3) * 0.05 * grip, swordCols: z5Sw(t * 0.2), cracks: 0.55, legs: [3, 3, 3, 3], sq: Math.sin(t * 1.6) * 0.04 }), HX, HY - 6, 3.0, 0.12, false, { still: true });
    // the water over its lower half
    for (let y = HY + 2; y < H - LB; y++) for (let x = HX - 90; x < HX + 90; x++) { const d = Math.abs(x - HX) / 90, e = (x - HX) * (x - HX) / 8100 + (y - HY - 12) * (y - HY - 12) / 400; if (e < 1 && y > HY + 2 + Math.sin(x * 0.2 + t * 2) * 1.5 + d * 4 && bay(x, y) < 1.6 - e * 1.4) { BUF[y * W + x] = (x + y) % 5 === 0 ? 116 : 115; tintI(y * W + x, x, y, T_DARK, 0.6 + d * 0.1); } }
    // the orbs, guttering
    for (let k = 0; k < 4; k++) { const a = t * 0.6 + k * TAU / 4, fl_ = 0.6 + 0.4 * Math.sin(t * 7 + k * 2); if (ih(k, fl(t * 10), 4401) < 0.85) orbAt(HX + Math.cos(a) * 34, HY - 10 + Math.sin(a) * 9, k, 2 * fl_, t); }
    for (let k = 0; k < 14; k++) { const g = frac(t * 0.12 + ih(k, 1, 4402)); P(HX - 120 + ih(k, 2, 4402) * 240, HY - g * 120, 121); }
    z5Cam(1.25 + 0.08 * eio(lt / 3.3), 0, HX, HY - 20, 240, 150);
    if (lt < 0.8) tintAll(T_DARK, 1 - eio(lt / 0.8));
  });
  CAPS.push([42.6, 44.4, 's', 'HERO', '...NOT... YET...']);

  /* 22 — the orbs come in (0:44.5–0:46): they flare, and dive into it one after another; the sea boils away round it;
     it rises out of the water, curls in on itself — gathering */
  shot(44.5, 46.0, (lt, t) => {
    belowWorld(t, 120, 930, 0.2);
    tintAll(T_DARK, 0.6 * (1 - sstep(0.4, 1.4, lt)));
    const HX = 240, rise = eio(lin(0.3, 1.2, lt)), HY = 194 - rise * 14 + z5Sh(t, 2) * 1.5 * rise, curl = sstep(1.15, 1.45, lt);
    // the sea pushed back: a ring of boiling water, steam
    const R = 30 + eio(clamp(lt / 1.5, 0, 1)) * 90;
    for (let a = 0; a < TAU; a += 0.02) { const x = HX + Math.cos(a) * R, y = HY + 14 + Math.sin(a) * R * 0.24; for (let q = 0; q < 6; q++) P(x, y - q, q > 4 ? 119 : 117); }
    for (let k = 0; k < 30; k++) { const g = frac(t * 0.8 + ih(k, 1, 4411)), a = ih(k, 2, 4411) * TAU, r = R * (0.3 + ih(k, 3, 4411) * 0.7); cloudPuff(HX + Math.cos(a) * r, HY + 14 + Math.sin(a) * r * 0.24 - g * 40, 3 + g * 6, [19, 20, 21, 22], 4412 + k); }
    glow(HX, HY, 40 + lt * 80, T_NOVA, 0.3 + lt * 0.3);
    actor(HERO3({ eyes: lt > 0.8 ? 'angry' : 'closed', mouth: lt > 1.2 ? 2 : 0, sword: lerp(0.4, -1.6, eio(clamp((lt - 0.6) / 0.6, 0, 1))), swordCols: z5Sw(t), cracks: 0.55 * (1 - sstep(0.5, 1.3, lt)), sq: 0.35 * curl, legs: rise > 0.5 ? undefined : [3, 3, 3, 3] }), HX, HY + curl * 4, 3.0, 0, false);
    // the orbs flare and dive in, each on its own spiral
    for (let k = 0; k < 4; k++) {
      const st = 0.15 + k * 0.22, u = eic(clamp((lt - st) / 0.55, 0, 1)); if (u >= 1) { const g = lt - st - 0.55; if (g < 0.2) glow(HX, HY, 50, EL_T[k], 0.7 * (1 - g / 0.2)); continue; }
      const a = t * 0.6 + k * TAU / 4 + u * 5, r = 34 * (1 - u), x = HX + Math.cos(a) * r, y = HY - 10 + Math.sin(a) * r * 0.5 - Math.sin(u * PI) * 20;
      for (let q = 1; q < 8; q++) { const u2 = eic(clamp((lt - st - q * 0.025) / 0.55, 0, 1)), a2 = t * 0.6 + k * TAU / 4 + u2 * 5, r2 = 34 * (1 - u2); rectF(HX + Math.cos(a2) * r2 - 1, HY - 10 + Math.sin(a2) * r2 * 0.5 - Math.sin(u2 * PI) * 20 - 1, 2, 2, ORB[k][q < 3 ? 2 : 1]); }
      orbAt(x, y, k, 2 + 4 * Math.min(1, lt * 2), t);
    }
    shk(1 + lt * 3);
    z5Cam(1.25 + 0.1 * eio(lt / 1.5), 0, HX, HY - 20, 240, 150);
  });

  /* 23 — ZENITH NOVA (0:46–0:47.6): a star goes off in the sea. White-hot, molten, flame for wings — and the sword GROWS:
     the blade racing out of the hilt up into the sky, ten times its length; then raised, back, back, for the stroke */
  shot(46.0, 47.6, (lt, t) => {
    belowWorld(t, 150, 930, 0.6);
    const HX = 240, HY = 190, g = lt;
    z5Sunburst(HX, HY, 16, t * 0.5, 30, 320 * eoc(clamp(g / 0.3, 0, 1)), 0.07, [104, 105, 106, 107, 108, 22]);
    // the sea flattened in a ring
    const R = 20 + eoc(clamp(g / 0.5, 0, 1)) * 300;
    for (let a = 0; a < TAU; a += 0.012) { const x = HX + Math.cos(a) * R, y = HY + 18 + Math.sin(a) * R * 0.2; for (let q = 0; q < 8 * (1 - g / 1.6); q++) P(x, y - q, q > 5 ? 22 : 119); }
    // the growth: out it races, up into the sky (0.2–1.0); then cocked back for the stroke (1.15–1.6)
    const grow = eoc(clamp((g - 0.45) / 0.65, 0, 1)), cock = eio(lin(1.18, 1.6, g));
    const swA = -PI / 2 + 0.18 - cock * 0.9;
    const a = i4Nova(HX, HY - 6 * eob(clamp(g / 0.4, 0, 1)), 2.6, t, { sw: swA, spread: eob(clamp(g / 0.4, 0, 1)), flap: 0.4, mouth: g < 0.6 ? 2 : 1, noSmear: true, sq: -0.1 * cock });
    if (grow > 0) {
      const tip = bigBlade(a.hand[0], a.hand[1], swA, 640, 5.5, t, { form: 'nova', grow, flare: 0.8, surge: true });
      for (let k = 0; k < 4; k++) { const f = frac(g * 2 + k / 4) * grow; shockRing(a.hand[0] + Math.cos(swA) * 640 * f, a.hand[1] + Math.sin(swA) * 640 * f, 14 * (1 - f) + 4, 6 * (1 - f) + 2, 2, [22, 108, 105], 1 - f); }
    }
    if (g < 0.03) impactFrame(HX, HY, 0);
    if (g < 0.2) tintAll(T_NOVA, 0.5 * (1 - g / 0.2));
    shk(g < 0.6 ? 7 * (1 - g / 0.6) : 2);
    // the camera is thrown back by it, and climbs the blade
    const pull = eoc(clamp(g / 1.0, 0, 1));
    z5Cam(lerp(1.35, 0.95, pull) + kick(g, [[0, 2]])[0], 0, HX, lerp(HY - 20, HY - 60, pull), 240, lerp(150, 175, pull));
  });
  FLASH_CUTS.push(46.0);
  CAPS.push([46.0, 46.85, 'x', '', 'ZENITH...', 92], [46.3, 46.85, 'x', '', 'NOVA!', 140]);

  /* the giant-blade fight, in one wide frame: the hero left, him right, the blade across the frame between them.
     BK: blade angle keys [time, angle, ease]; his body pushed back further with each blow that lands */
  function i4BladeFight(t, o) {
    belowWorld(t, 150, 930 + (o.pan || 0), 0.75);
    const S = 1.7, hx = o.hx, hy = o.hy;
    const sx = o.sx, sy = o.sy, ss = o.ss;
    const so = sunderer(sx, sy, ss, t, o.sun);
    const a = i4Nova(hx, hy, S, t, { sw: o.swA, spread: o.spread === undefined ? 1 : o.spread, flap: 0.4, mouth: o.mouth || 1, noSmear: true, ang: o.ang || 0 });
    const tip = bigBlade(a.hand[0], a.hand[1], o.swA, o.len || 430, 4.4, t, { form: 'nova', flare: 0.7, surge: true });
    if (o.trail) for (let q = 1; q <= 5; q++) { const aa = o.trail(q * 0.016); if (aa === undefined) continue; for (let r = 40; r < (o.len || 430); r += 3) P(a.hand[0] + Math.cos(aa) * r, a.hand[1] + Math.sin(aa) * r, q < 2 ? 108 : q < 4 ? 109 : 110); }
    return { a, so, tip };
  }

  /* 24–29 — the duel of the giant blade (0:47.6–0:55.6), ONE continuous shot. The camera travels with the fight across the
     dark sea; the beats land on their cues: 47.6 the overhead he blocks with crossed arms and is shoved back for the first
     time · 48.6 a sweep (lower-left arm) · 49.2 a rising cut (upper-right) · 49.8 an overhead (crossed pair) · 50.6 a cut
     that gets through: a wound across his chest · 51.6 an upward cut from under his guard: a gauntlet thrown up, blades blown
     out of his crown · 53.2 the thrust: through his shoulder, driving him back onto a spire, pinned · 54.0 he laughs, takes
     the blade in his hand and draws it back out of himself. He fights with his whole body: he leans into every block, is
     shoved and recoils, winds up and drifts between blows; his arms flow from one guard to the next on arcs. */
  // a keyed track of numbers or arrays: keys [[t, value, ease]] (ease into the key: 'o' out, 'i' in, 'io' (default), 'b' back, 'l')
  function i4K(keys, t) {
    const E_ = { o: eoc, i: eic, io: eio, b: eob, l: (u) => u };
    if (t <= keys[0][0]) return keys[0][1];
    for (let n = 1; n < keys.length; n++) if (t < keys[n][0]) {
      const [t0, a] = keys[n - 1], [t1, b, e] = keys[n], u = E_[e || 'io']((t - t0) / (t1 - t0));
      return Array.isArray(a) ? a.map((v, k) => lerp(v, b[k], u)) : lerp(a, b, u);
    }
    return keys[keys.length - 1][1];
  }
  const DH = [47.6, 48.6, 49.2, 49.8, 50.6, 51.6, 53.2];
  // the blade's angle: each blow cocked back (a held wind-up), whipped through onto its cue, carried past, recovered
  const D_SW = [[47.6, -2.29], [47.64, 0.12, 'i'], [47.95, 0.3, 'o'], [48.3, 0.45], [48.52, -1.25], [48.6, 0.55, 'i'], [48.9, 0.75, 'o'], [49.1, 1.25], [49.2, -0.75, 'i'], [49.45, -1.05, 'o'], [49.7, -2.25],
    [49.8, 0.25, 'i'], [50.1, 0.4, 'o'], [50.48, -1.35], [50.6, 0.6, 'i'], [50.9, 0.85, 'o'], [51.45, 1.15], [51.6, -1.25, 'i'], [51.95, -1.5, 'o'], [52.6, -0.35], [53.05, -0.1], [53.2, -0.12, 'i'], [55.6, -0.12]];
  // where the hero is (world): pressing in, dipping under his guard, coiling back, the lunge, then dragged along its blade
  const D_HP = [[47.6, [100, 176]], [48.1, [92, 180], 'o'], [48.5, [104, 172]], [48.6, [108, 170], 'i'], [49.1, [100, 168]], [49.2, [106, 172], 'i'], [49.7, [96, 158]], [49.8, [108, 166], 'i'],
    [50.45, [116, 168]], [50.6, [134, 166], 'i'], [51.0, [126, 186], 'o'], [51.5, [140, 206]], [51.6, [150, 196], 'i'], [52.1, [136, 178], 'o'], [52.9, [108, 172]], [53.14, [212, 168], 'i'], [53.4, [214, 168], 'o'],
    [54.4, [214, 170]], [55.5, [146, 172]]];
  // him: the mask's world x (shoved back on each blow, staggering at the wound, pinned against the spire), his lean and nod
  const D_SX = [[47.6, 330], [48.1, 362, 'o'], [48.6, 362], [48.85, 372, 'o'], [49.2, 372], [49.45, 382, 'o'], [49.8, 382], [50.1, 394, 'o'], [50.6, 396], [51.05, 422, 'o'], [51.6, 424], [51.95, 434, 'o'], [53.2, 432], [53.38, 452, 'o'], [55.6, 452]];
  const D_LEAN = [[47.6, 10], [47.66, -16, 'i'], [48.1, 14, 'o'], [48.45, -8], [48.6, -18, 'i'], [48.9, 10, 'o'], [49.1, -6], [49.2, -18, 'i'], [49.5, 10, 'o'], [49.7, -10], [49.8, -22, 'i'], [50.1, 12, 'o'], [50.5, 0],
    [50.6, 4], [50.9, 26, 'o'], [51.4, 6], [51.6, -10, 'i'], [51.9, 20, 'o'], [52.8, -6], [53.2, -4], [53.35, 24, 'o'], [54.2, 18], [55.0, -6], [55.6, -10]];
  const D_NOD = [[47.6, 1], [47.7, 3, 'o'], [48.2, 0], [49.8, 0], [49.9, 2.5, 'o'], [50.5, 0.5], [50.6, 0.5], [50.85, -2.5, 'o'], [51.5, -0.5], [51.6, -0.5], [51.8, -3, 'o'], [52.6, 0.5], [53.2, 0.5], [53.4, 2, 'o'], [55.6, 0]];
  // his arms (local wrist positions): rest guards between, the block for each blow, thrown wide after the wound, out to the sides when pinned
  const D_A0 = [[47.6, [-30, 70]], [47.62, [30, 30], 'i'], [48.1, [-40, 70], 'o'], [49.5, [-120, 110]], [49.78, [0, -10], 'i'], [50.1, [-60, 30], 'o'], [50.5, [-90, 50]], [50.9, [-140, 40], 'o'], [51.5, [-60, 50]], [51.85, [-150, -90], 'o'], [52.6, [-130, 30]], [53.4, [-130, 80], 'o'], [54.2, [-90, 40]], [55.5, [-150, 40]]];
  const D_A1 = [[47.6, [40, 70]], [47.62, [-30, 36], 'i'], [48.1, [60, 80], 'o'], [48.9, [120, 120]], [49.18, [-40, 150], 'i'], [49.5, [60, 100], 'o'], [49.78, [-40, -4], 'i'], [50.1, [40, 40], 'o'], [50.6, [100, 90]], [50.9, [150, 60], 'o'], [51.6, [132, 100]], [53.2, [130, 90]], [53.4, [150, 70], 'o'], [55.6, [140, 90]]];
  const D_A2 = [[47.6, [-96, 196]], [48.3, [-110, 180]], [48.58, [-150, 130], 'i'], [48.9, [-110, 170], 'o'], [49.5, [-96, 196]], [55.6, [-96, 196]]];
  const D_A3 = [[47.6, [96, 196]], [50.6, [96, 196]], [50.9, [110, 180], 'o'], [53.4, [110, 190]], [55.6, [110, 190]]];
  const D_ANG0 = (t) => (t < 48.0 && t > 47.55 ? -0.6 : t > 49.7 && t < 50.2 ? -0.8 : undefined);
  shot(47.6, 55.6, (lt, t) => {
    const [hxW, hyW] = i4K(D_HP, t), SXW = i4K(D_SX, t), swA = i4K(D_SW, t) + (t > 50.6 && t < 51.0 ? 0.25 * eoc(clamp((t - 50.6) / 0.3, 0, 1)) : 0);
    // the camera's pan: it keeps the two of them framed, a beat behind (so it is pushed by the action, not locked to it)
    const pan = i4K([[47.6, 0], [48.6, 20], [50.6, 40], [51.6, 64], [53.2, 60], [53.6, 86], [55.6, 76]], t) + z5N(t * 0.6, 2) * 4;
    belowWorld(t, 148, 950 + pan * 1.4, 0.8);
    // the spire he will be pinned to, standing in the sea behind him the whole time
    const SPX = 500 - pan, pinned = t > 53.2;
    for (let q = 0; q < 214; q++) { const w = 72 * (1 - q / 262), cx = SPX + Math.sin(q * 0.09) * 2; for (let x = fl(cx - w / 2); x <= cx + w / 2; x++) { const f = (x - cx) / (w / 2); P(x, 252 - q, Math.abs(f) > 0.88 ? 96 : q % 37 < 2 ? 102 : pinned && t > 53.3 && Math.abs((q * 7 + x) % 61 - 30) < 1 ? 104 : f < -0.25 ? 99 : 98); } }
    for (let k = 0; k < 6; k++) cloudPuff(SPX - 40 + k * 16, 250 + Math.sin(t + k) * 1.5, 7 + k % 3 * 2, [116, 117, 117, 118], 4490 + k);
    const SX = SXW - pan, hx = hxW - pan, hy = hyW, wound = sstep(50.6, 50.68, t), cut1 = eoc(clamp((t - 50.6) / 0.08, 0, 1));
    const W1 = [WOUND1[0], WOUND1[1], lerp(WOUND1[0], WOUND1[2], cut1), lerp(WOUND1[1], WOUND1[3], cut1), WOUND1[4]], wounds = [];
    if (t > 50.6) wounds.push(W1); if (pinned) wounds.push(WOUND2);
    const crown = t < 51.6 ? 1 : 1 - 0.25 * eoc(clamp((t - 51.6) / 0.3, 0, 1));
    const laugh = [54.1, 54.35, 54.6].reduce((s_, h) => s_ + Math.max(0, Math.sin(PI * clamp((t - h) / 0.2, 0, 1))), 0), draw = eio(clamp((t - 54.4) / 1.1, 0, 1));
    const g6 = t - 50.6, g7 = t - 51.6;
    // the hero first (it never overlaps him), so the blade can be drawn inside his grip later
    const a = i4Nova(hx, hy, 1.8, t, { sw: swA, spread: t > 53.1 && t < 53.4 ? 1 : 0.8 + 0.2 * Math.sin(t * 3), flap: 0.4, mouth: t > 53 ? 2 : 1, noSmear: true, ang: t > 51.4 && t < 51.9 ? -0.25 : swA > 0.3 ? 0.15 : swA < -0.6 ? -0.12 : 0, sq: t > 52.6 && t < 53.14 ? 0.3 * Math.sin(PI * (t - 52.6) / 0.54) : 0 });
    const LEN = 430 - draw * 70, blade = () => bigBlade(a.hand[0], a.hand[1], swA, LEN, 4.6, t, { form: 'nova', flare: 0.75, surge: true });
    // the blade's slash: the arc it swept in the last frames, fading
    const trailAt = (d) => i4K(D_SW, t - d);
    for (let q = 1; q <= 5; q++) { const aa = trailAt(q * 0.016); if (Math.abs(aa - swA) < 0.05) continue; for (let r = 40; r < LEN; r += 3) P(a.hand[0] + Math.cos(aa) * r, a.hand[1] + Math.sin(aa) * r, q < 2 ? 108 : q < 4 ? 109 : 110); }
    if (t < 54.0) blade();
    // the grip that pulls it out (from 54.0): the knuckles sit over the blade, the fingers wrap down round it
    const gx = 318 + (SX - 370) - draw * 46, gy = a.hand[1] + (gx - a.hand[0]) * Math.tan(swA), GA = PI / 2 - 0.35, grip = eoc(clamp((t - 54.0) / 0.3, 0, 1));
    const A0 = t < 54.0 ? i4K(D_A0, t) : [lerp(i4K(D_A0, 54.0)[0], (gx - Math.cos(GA) * 12 - SX), grip), lerp(i4K(D_A0, 54.0)[1], (gy - Math.sin(GA) * 12 - 82), grip)];
    const blockPose = (k) => (DH.some((h) => t > h - 0.12 && t < h + 0.3) ? 'fist' : 'grab');
    const so = sunderer(SX, 82, 0.95, t, { eyes: 1.5 + (g6 > 0 && g6 < 1 ? 0.5 * Math.exp(-g6 * 3) : 0), heat: 0.85, crown, rage: t > 50.6 ? 0.5 : 0.25, roar: (g6 > 0 ? 0.6 * Math.exp(-g6 * 2) * (1 - Math.exp(-g6 * 20)) : 0) + (g7 > 0 && g7 < 1 ? 0.3 * Math.exp(-g7 * 3) : 0) + (t > 53.2 && t < 54 ? 0.6 * Math.exp(-(t - 53.2) * 2) : 0) + laugh * 0.3,
      nod: i4K(D_NOD, t) - laugh * 2, lean: i4K(D_LEAN, t), tilt: i4K(D_LEAN, t) * -0.003 + (pinned ? 0.08 : 0), wounds,
      arms: [{ x: A0[0], y: A0[1], pose: t >= 54.0 ? { curl: lerp(0.15, 0.78, grip), thumb: lerp(0.2, 0.75, grip), spread: lerp(0.6, 0.05, grip) } : t > 50.6 && t < 52.6 ? 'open' : blockPose(0), front: t >= 54.0 || (t > 47.55 && t < 48.1) || (t > 49.7 && t < 50.2) || (t > 51.6 && t < 52.4), ang: t >= 54.0 ? GA : D_ANG0(t), hold: t >= 54.0 ? blade : undefined },
        { x: i4K(D_A1, t)[0], y: i4K(D_A1, t)[1], pose: pinned ? 'open' : blockPose(1), front: (t > 47.55 && t < 48.1) || (t > 49.0 && t < 50.2), ang: t > 47.55 && t < 48.1 ? -2.4 : undefined },
        { x: i4K(D_A2, t)[0], y: i4K(D_A2, t)[1], pose: t > 48.4 && t < 48.9 ? 'open' : 'fist', front: t > 48.35 && t < 48.95 },
        { x: i4K(D_A3, t)[0], y: i4K(D_A3, t)[1], pose: 'open' }] });
    // contact: where the blade meets him on each beat (along the blade to his front)
    const contact = () => { const fr = SX - 46, al = clamp((fr - a.hand[0]) / Math.max(0.2, Math.cos(swA)), 60, LEN); return [a.hand[0] + Math.cos(swA) * al, a.hand[1] + Math.sin(swA) * al]; };
    DH.forEach((h, k) => {
      const g = t - h; if (g < 0 || g > 1.2) return;
      const [cx, cy] = k === 4 ? [SX + lerp(WOUND1[0], WOUND1[2], 0.5) * 0.95, 82 + lerp(WOUND1[1], WOUND1[3], 0.5) * 0.95] : k === 6 ? [SX + 74, 124] : contact();
      megaHit(cx, cy, g, k === 0 || k === 4 || k === 6 ? 2.6 : 2.1, [0.3, PI + PI, -PI / 2 + PI, PI / 2 + 0.3, 0.4, -PI / 2 - 0.3, -0.1][k], [22, 108, 105], 4451 + k);
      if (k === 4 && g < 0.8) rocks(cx, cy, g, 34, 240, 3, [102, 104, 105, 107], 4461, 240, 0.4, 2);
      if (k === 5 && g < 1) rocks(SX, 40, g, 9, 260, 6, [96, 97, 101, 103], 4471, 200, -PI / 2, 1.6);
      if (k === 6 && g < 1) rocks(SPX - 10, 120, g, 30, 180, 5, [97, 98, 99, 104], 4482, 200, 0, 2);
    });
    // the first block's force runs on: a trench torn in the sea to the horizon
    if (t < 48.4) { const lt0 = t - 47.6, run = eoc(clamp(lt0 / 0.35, 0, 1)); for (let q = 0; q < 120 * run; q++) { const u = q / 120, x = lerp(SX, 470, u), y = lerp(250, 152, u), hh = (1 - u) * 26 * (1 - lt0 / 0.8); for (let k = 0; k < hh; k++) { P(x - 6 * (1 - u), y - k, k > hh - 3 ? 22 : 119); P(x + 6 * (1 - u), y - k, k > hh - 3 ? 22 : 118); } P(x, y, 22); } }
    // the sea ploughed up behind him every time he is shoved back
    [47.6, 48.6, 49.2, 49.8, 50.6, 53.2].forEach((h, k) => rocks(SX + 50, 240, t - h, 20, 200, 3, [117, 118, 119, 22], 4441 + k, 260, -PI / 2 + 0.6, 1.4));
    // foreground spray drifting past the camera (depth)
    for (let k = 0; k < 10; k++) { const x = ((ih(k, 1, 4495) * 560 - pan * 2.2 - t * 30) % 560 + 560) % 560 - 40, y = 236 + ih(k, 2, 4495) * 10; cloudPuff(x, y, 10 + ih(k, 3, 4495) * 8, [115, 116, 117, 118], 4496 + k); }
    // the molten blood running out of the hole as he draws the blade out
    if (t > 54.0) { for (let k = 0; k < 10; k++) { const g = frac(t * 1.4 + ih(k, 1, 4491)); rectF(SX + 74 + (ih(k, 2, 4491) - 0.5) * 10, 120 + g * 90, 2, 3, g < 0.5 ? 105 : 103); } if (so.hands[0]) { const [px, py] = so.hands[0].palm; for (let k = 0; k < 8; k++) { const g = frac(t * 2 + k / 8); P(px + (ih(k, 1, 4492) - 0.5) * 16, py - g * 30, g < 0.4 ? 105 : 121); } } }
    if (t > 47.6 && t < 48.1) frameCrack(SX + 2, 130, clamp((t - 47.6) * 4, 0, 0.5) * (1 - sstep(0.3, 0.5, t - 47.6)), 4443, 90);
    // the camera: pushed in slowly across the fight, kicked along each blow, a slight roll toward the side giving ground
    const [kz, kr, kx, ky] = kick(t, DH.map((h, k) => [h, k === 0 || k === 4 || k === 6 ? 2 : 1.3, [0.2, PI, -PI / 2, PI / 2, 0.4, -PI / 2, 0][k]]));
    shk(DH.some((h) => t > h && t < h + 0.25) ? 6 : 1 + laugh);
    const push = 1.02 + 0.06 * eio(clamp((t - 47.6) / 6, 0, 1)) + (t > 54 ? 0.04 * eio(clamp((t - 54) / 1.6, 0, 1)) : 0);
    z5Cam(push + kz, kr + 0.012 * z5N(t * 0.5, 7), 250 - kx, 140 - ky, 240, 140);
  });
  FLASH_CUTS.push(47.6, 53.2);

  /* 30 — his brother's eye (0:55.6–0:58): close. The fist with the shard comes up to his brow and presses it in. It sinks
     into him; a spiral eye opens in his forehead. "Brother. See this." */
  shot(55.6, 58.0, (lt, t) => {
    gradient(LB, H - LB, [96, 97, 98, 101, 70]);
    const MX = 240, MY = 150, s = 3.2, press = eio(clamp(lt / 0.25, 0, 1)), sink = eic(clamp((lt - 0.2) / 0.3, 0, 1)), open = eob(clamp((lt - 0.4) / 0.4, 0, 1));
    const away = eio(clamp((lt - 0.55) / 0.5, 0, 1));
    const o = sunderer(MX, MY, s, t, { eyes: 1.4 + open * 0.4, heat: 1, crown: 0.75, rage: 0.4 + open * 0.3, third: open, body: false, nod: lerp(-1, 1, open) });
    // the fist, coming up to the brow and away again
    const fx = MX + 30 * s - press * 22 * s + away * 30 * s, fy = MY + 20 * s - press * 30 * s + away * 30 * s;
    if (sink < 1) { z5MaskShard(fx - 10 * s, fy - 12 * s, 1.6 * (1 - sink * 0.8), 0.4, 1, 0, t); glow(fx - 10 * s, fy - 12 * s, 60, T_MAG, 0.6); }
    sGauntlet(fx + 10 * s, fy + 14 * s, s * 0.9, -PI * 0.75, 'fist', 1, t);
    if (lt > 0.4) { const g = lt - 0.4; shockRing(o.brow[0], o.brow[1], 6 + g * 500, 4 + g * 300, 4, [75, 73, 104], 1 - g / 0.6); glow(o.brow[0], o.brow[1], 90 * Math.exp(-g * 2), T_MAG, 0.6); if (g < 0.03) tintAll(T_MAG, 0.45); }
    shk(lt > 0.4 && lt < 1 ? 5 * (1 - (lt - 0.4) / 0.6) : 0.8);
    z5Cam(1.02 + 0.04 * eio(lt / 2.4), 0, 240, 135);
  });
  FLASH_CUTS.push(55.6);
  CAPS.push([56.4, 57.95, 's', 'SUNDERER', 'BROTHER. SEE THIS.']);
  }
